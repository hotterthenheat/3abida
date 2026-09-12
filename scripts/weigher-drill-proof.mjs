// The chain dropdown, frame by frame: click a strike, then sample every
// animation frame for 600ms — frame gaps, long tasks, and when the drill
// panel reaches its final height. Repeated on three rows.
import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto('http://localhost:5199/weigher', { waitUntil: 'networkidle' });
await page.waitForSelector('tr[aria-selected]');
await page.waitForFunction(() => !document.body.innerText.includes('ENTERING TERMINAL'), null, { timeout: 8000 });
await page.waitForTimeout(1500);

await page.evaluate(() => {
  window.__lt = [];
  new PerformanceObserver(list => {
    for (const e of list.getEntries()) window.__lt.push(Math.round(e.duration));
  }).observe({ entryTypes: ['longtask'] });
  window.__ev = [];
  new PerformanceObserver(list => {
    for (const e of list.getEntries()) if (e.name === 'click') window.__ev.push({ work: Math.round(e.processingEnd - e.processingStart), paint: Math.round(e.duration) });
  }).observe({ type: 'event', durationThreshold: 16, buffered: true });
});

const rows = page.locator('tr[aria-selected]');
for (const i of [4, 9, 14]) {
  await page.evaluate(() => {
    window.__lt.length = 0;
    window.__ev.length = 0;
    window.__frames = [];
    window.__t0 = performance.now();
    let last = performance.now();
    const tick = t => {
      const panel = document.querySelector('tr[aria-selected="true"] + tr');
      window.__frames.push({ t: Math.round(t - window.__t0), gap: Math.round(t - last), h: panel ? Math.round(panel.getBoundingClientRect().height) : 0 });
      last = t;
      if (t - window.__t0 < 700) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await rows.nth(i).click();
  await page.waitForTimeout(800);
  const r = await page.evaluate(() => {
    const f = window.__frames;
    const gaps = f.map(x => x.gap).slice(1);
    const finalH = f[f.length - 1].h;
    const settled = f.find(x => x.h > 0 && x.h >= finalH - 1)?.t;
    const first = f.find(x => x.h > 0)?.t;
    return {
      frames: f.length,
      maxGap: Math.max(...gaps),
      dropped: gaps.filter(g => g > 20).length,
      panelFirstSeen: first,
      panelSettled: settled,
      finalHeight: finalH,
      longTasks: window.__lt.slice(),
      click: window.__ev[window.__ev.length - 1],
    };
  });
  console.log(`row ${i}:`, r);
}
await browser.close();
