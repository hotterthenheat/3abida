// Catch the jolt: watch a Trace page across a full minute turn and log every
// long task (a freeze) and every layout dimension change (a hop), each stamped
// with seconds-past-the-minute so a periodic cause shows itself.
//   node scripts/probe-jolt.mjs <page> [seconds]
import { chromium } from 'playwright';

const pageName = process.argv[2] ?? 'screener';
const secs = Number(process.argv[3] ?? 75);
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto(`http://localhost:5199/trace/${pageName}`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !document.body.innerText.includes('ENTERING TERMINAL'), null, { timeout: 8000 });
await page.waitForTimeout(1500);

await page.evaluate(() => {
  window.__ev = [];
  const push = e => window.__ev.push({ wall: performance.timeOrigin + (e.t ?? performance.now()), ...e });
  // 1. Freezes: any task over 50ms on the main thread.
  new PerformanceObserver(list => {
    for (const e of list.getEntries()) push({ t: e.startTime, kind: 'longtask', dur: Math.round(e.duration) });
  }).observe({ entryTypes: ['longtask'] });
  // 2. Hops: the page's width (scrollbar), the head's height, the table's top.
  const main = document.querySelector('main');
  const read = document.querySelector('p.line-clamp-2');
  const table = document.querySelector('table');
  const snap = () => ({
    mainW: main?.clientWidth,
    mainH: main?.clientHeight,
    scrollH: main?.scrollHeight,
    readH: read?.getBoundingClientRect().height,
    tableTop: table ? Math.round(table.getBoundingClientRect().top + (main?.scrollTop ?? 0)) : null,
    bodyW: document.body.clientWidth,
  });
  let last = snap();
  setInterval(() => {
    const now = snap();
    for (const k of Object.keys(now)) {
      if (now[k] !== last[k]) push({ kind: 'layout', what: k, from: last[k], to: now[k] });
    }
    last = now;
  }, 100);
  // 3. Frame gaps over 40ms, as a second witness to the freezes.
  let lastF = performance.now();
  const tick = t => {
    if (t - lastF > 40) push({ t: lastF, kind: 'gap', dur: Math.round(t - lastF) });
    lastF = t;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});

console.log(`watching /trace/${pageName} for ${secs}s (starts ${new Date().toLocaleTimeString()})…`);
await page.waitForTimeout(secs * 1000);
const ev = await page.evaluate(() => window.__ev);
const stamp = w => {
  const d = new Date(w);
  return `${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}.${String(d.getMilliseconds()).padStart(3, '0')}`;
};
for (const e of ev) {
  if (e.kind === 'longtask') console.log(`  ${stamp(e.wall)}  FREEZE  long task ${e.dur}ms`);
  else if (e.kind === 'gap') console.log(`  ${stamp(e.wall)}  gap     ${e.dur}ms between frames`);
  else console.log(`  ${stamp(e.wall)}  HOP     ${e.what} ${e.from} → ${e.to}`);
}
console.log(`${ev.length} events`);
await browser.close();
