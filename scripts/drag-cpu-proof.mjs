// CPU profile of a leftward pan on the Weigher chart, via CDP: which functions
// own the self time while the pointer is down?
import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto('http://localhost:5199/weigher', { waitUntil: 'networkidle' });
await page.waitForSelector('tr[aria-selected]');
await page.waitForFunction(() => !document.body.innerText.includes('ENTERING TERMINAL'), null, { timeout: 8000 });
await page.waitForTimeout(1500);
const box = await page.evaluate(() => {
  const canvases = [...document.querySelectorAll('canvas')].map(c => c.getBoundingClientRect()).filter(r => r.width > 300 && r.height > 100);
  canvases.sort((a, b) => b.width * b.height - a.width * a.height);
  const r = canvases[0];
  return { x: r.x, y: r.y, w: r.width, h: r.height };
});

const cdp = await page.context().newCDPSession(page);
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 250 });

const x0 = box.x + box.w * 0.5;
const y0 = box.y + box.h * 0.5;
await page.mouse.move(x0, y0);
await page.waitForTimeout(300);
await cdp.send('Profiler.start');
await page.mouse.down();
for (let i = 1; i <= 30; i++) {
  await page.mouse.move(x0 + i * 6, y0); // pan LEFT into history
  await page.waitForTimeout(33);
}
await page.waitForTimeout(600);
const { profile } = await cdp.send('Profiler.stop');
await page.mouse.up();

// Self time per node → aggregate by function+file, top 18.
const byId = new Map(profile.nodes.map(n => [n.id, n]));
const self = new Map();
for (let i = 0; i < profile.samples.length; i++) {
  const n = byId.get(profile.samples[i]);
  const dt = (profile.timeDeltas[i] ?? 0) / 1000;
  const f = n.callFrame;
  const file = (f.url || '').split('/').slice(-2).join('/').split('?')[0];
  const key = `${f.functionName || '(anonymous)'}  ${file}${f.lineNumber >= 0 ? ':' + (f.lineNumber + 1) : ''}`;
  self.set(key, (self.get(key) ?? 0) + dt);
}
const total = [...self.values()].reduce((a, b) => a + b, 0);
const top = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 18);
console.log(`profiled ${total.toFixed(0)}ms of samples during a 1.6s leftward pan; top self time:`);
for (const [k, ms] of top) console.log(`  ${ms.toFixed(1).padStart(7)}ms  ${k}`);
await browser.close();
