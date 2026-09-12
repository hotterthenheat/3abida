// Where does the Weigher's time go? Long tasks at idle, click→expand latency
// on a chain row, the strike dropdown's open latency, frame gaps while
// scrolling the chain, and the size of what is on the page.
import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto('http://localhost:5199/weigher', { waitUntil: 'networkidle' });
await page.waitForSelector('tr[aria-selected]');
await page.waitForFunction(() => !document.body.innerText.includes('ENTERING TERMINAL'), null, { timeout: 8000 });
await page.waitForTimeout(1000);

await page.evaluate(() => {
  window.__lt = [];
  window.__ev = [];
  new PerformanceObserver(list => {
    for (const e of list.getEntries()) window.__lt.push({ t: Math.round(e.startTime), dur: Math.round(e.duration) });
  }).observe({ entryTypes: ['longtask'] });
  // Event Timing: for each click, input delay / handler+render / to next paint.
  new PerformanceObserver(list => {
    for (const e of list.getEntries()) {
      if (e.name !== 'click') continue;
      window.__ev.push({
        delay: Math.round(e.processingStart - e.startTime),
        work: Math.round(e.processingEnd - e.processingStart),
        toPaint: Math.round(e.duration),
      });
    }
  }).observe({ type: 'event', durationThreshold: 16, buffered: true });
});
const drain = () => page.evaluate(() => window.__lt.splice(0));
const clicks = () => page.evaluate(() => window.__ev.splice(0));
const size = await page.evaluate(() => ({
  domNodes: document.querySelectorAll('*').length,
  chainRows: document.querySelectorAll('tr[aria-selected]').length,
  chainCols: document.querySelector('tr[aria-selected]')?.querySelectorAll('td').length,
  canvases: document.querySelectorAll('canvas').length,
}));
console.log('page size:', size);

// 1. Idle for 8s.
await page.waitForTimeout(8000);
const idle = await drain();
console.log(`idle 8s: ${idle.length} long tasks ${idle.map(e => e.dur + 'ms').join(' ')}`);

// 2. Click a chain row → time until its stats panel exists.
const rows = page.locator('tr[aria-selected]');
for (const i of [3, 6]) {
  await drain();
  const t0 = Date.now();
  await rows.nth(i).click();
  await page.waitForFunction(() => !!document.querySelector('tr[aria-selected="true"] + tr'), null, { timeout: 5000 });
  const dt = Date.now() - t0;
  await page.waitForTimeout(600);
  const lt = await drain();
  const ev = await clicks();
  const e = ev[ev.length - 1];
  console.log(
    `click row ${i}: panel after ${dt}ms | event timing: input delay ${e?.delay ?? '?'}ms, handler+render ${e?.work ?? '?'}ms, to next paint ${e?.toPaint ?? '?'}ms | long tasks ${lt.map(x => x.dur + 'ms').join(' ') || 'none'}`
  );
}

// 3. The strike dropdown (the picker beside the chain).
// The strike picker lives in the CONTRACT lens: switch lens, then open it.
const lens = page.getByRole('button', { name: /^contract$/i }).first();
if ((await lens.count()) > 0) {
  await lens.click();
  await page.waitForTimeout(500);
}
const picker = page.locator('button', { hasText: /^\S+ [\d.]+ (Call|Put)/ }).first();
if ((await picker.count()) > 0) {
  await drain();
  await clicks();
  const t0 = Date.now();
  await picker.click();
  // The list renders 301 strike buttons, each carrying aria-selected — on top of the chain's own 301 rows.
  await page.waitForFunction(() => document.querySelectorAll('[aria-selected]').length > 400, null, { timeout: 5000 });
  const dt = Date.now() - t0;
  await page.waitForTimeout(500);
  const lt = await drain();
  const e = (await clicks()).pop();
  console.log(
    `strike dropdown: open after ${dt}ms | event timing: handler+render ${e?.work ?? '?'}ms, to next paint ${e?.toPaint ?? '?'}ms | long tasks ${lt.map(x => x.dur + 'ms').join(' ') || 'none'}`
  );
  await page.keyboard.press('Escape');
} else console.log('strike dropdown: picker button not found in the contract lens');

// 4. Scroll the chain: wheel 20 ticks, measure frame gaps.
const box = await rows.nth(0).boundingBox();
await page.mouse.move(box.x + 100, box.y + 100);
await page.evaluate(() => {
  window.__gaps = [];
  let last = performance.now();
  window.__on = true;
  const tick = t => {
    window.__gaps.push(t - last);
    last = t;
    if (window.__on) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
await drain();
for (let i = 0; i < 20; i++) {
  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(40);
}
await page.waitForTimeout(400);
const gaps = await page.evaluate(() => {
  window.__on = false;
  return window.__gaps;
});
const lt = await drain();
const sorted = [...gaps].sort((a, b) => a - b);
console.log(
  `scroll: ${gaps.length} frames, p95 ${sorted[Math.floor(sorted.length * 0.95)].toFixed(0)}ms, max ${sorted[sorted.length - 1].toFixed(0)}ms, >32ms ${gaps.filter(g => g > 32).length} | long tasks ${lt.map(e => e.dur + 'ms').join(' ') || 'none'}`
);
await browser.close();
