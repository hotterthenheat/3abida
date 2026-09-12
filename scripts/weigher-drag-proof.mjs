// Where inside a drag does the long task land? Timestamps every long task and
// frame gap against the pointer events (down / moves / up) and the 1.5s tick
// cadence, for a leftward pan (into history) and a rightward pan (into the
// runway). Then holds still with the button down across ticks.
import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto('http://localhost:5199/weigher', { waitUntil: 'networkidle' });
await page.waitForSelector('tr[aria-selected]');
await page.waitForFunction(() => !document.body.innerText.includes('ENTERING TERMINAL'), null, { timeout: 8000 });
await page.waitForTimeout(1500);

const found = await page.evaluate(() => {
  const canvases = [...document.querySelectorAll('canvas')].map(c => ({ c, r: c.getBoundingClientRect() })).filter(x => x.r.width > 300 && x.r.height > 100);
  canvases.sort((a, b) => b.r.width * b.r.height - a.r.width * a.r.height);
  for (const { c, r } of canvases) {
    let el = c.parentElement;
    while (el && !el.__chart) el = el.parentElement;
    if (el) {
      window.__chartEl = el;
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    }
  }
  return null;
});
if (!found) {
  console.log('no chart handle found');
  await browser.close();
  process.exit(1);
}
await page.evaluate(() => {
  window.__ev = [];
  const push = (kind, extra) => window.__ev.push({ t: performance.now(), kind, ...extra });
  new PerformanceObserver(list => {
    for (const e of list.getEntries()) window.__ev.push({ t: e.startTime, kind: 'LONGTASK', dur: Math.round(e.duration) });
  }).observe({ entryTypes: ['longtask'] });
  let last = performance.now();
  const tick = t => {
    if (t - last > 32) window.__ev.push({ t: last, kind: 'gap', dur: Math.round(t - last) });
    last = t;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  window.addEventListener('pointerdown', () => push('down'), true);
  window.addEventListener('pointerup', () => push('up'), true);
  let moves = 0;
  window.addEventListener('pointermove', () => {
    moves++;
    if (moves % 10 === 1) push('move#' + moves);
  }, true);
});
const range = () => page.evaluate(() => {
  const r = window.__chartEl.__chart.timeScale().getVisibleLogicalRange();
  return r ? `${r.from.toFixed(0)}..${r.to.toFixed(0)}` : null;
});
const report = async label => {
  const ev = await page.evaluate(() => window.__ev.splice(0));
  const t0 = ev.find(e => e.kind === 'down')?.t ?? ev[0]?.t ?? 0;
  console.log(`— ${label} —`);
  for (const e of ev) {
    const rel = Math.round(e.t - t0);
    if (e.kind === 'LONGTASK' || e.kind === 'gap') console.log(`   +${String(rel).padStart(5)}ms  ${e.kind.padEnd(8)} ${e.dur}ms`);
    else console.log(`   +${String(rel).padStart(5)}ms  ${e.kind}`);
  }
};

const drag = async (dir, label) => {
  const x0 = found.x + found.w * 0.5;
  const y0 = found.y + found.h * 0.5;
  await page.mouse.move(x0, y0);
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__ev.splice(0));
  const before = await range();
  await page.mouse.down();
  for (let i = 1; i <= 30; i++) {
    await page.mouse.move(x0 + dir * i * 6, y0);
    await page.waitForTimeout(33);
  }
  const after = await range();
  const samples = [];
  for (let i = 0; i < 9; i++) {
    await page.waitForTimeout(500);
    samples.push(await range());
  }
  await page.mouse.up();
  await page.waitForTimeout(200);
  console.log(`\n${label}: range ${before} → ${after}; while holding still: ${samples.every(s => s === after) ? 'view held' : 'VIEW MOVED ' + samples.join(' | ')}`);
  await report('timeline (relative to pointerdown)');
};

await drag(+1, 'pan LEFT into history (mouse moves right)');
await drag(-1, 'pan RIGHT into the runway (mouse moves left)');
await browser.close();
