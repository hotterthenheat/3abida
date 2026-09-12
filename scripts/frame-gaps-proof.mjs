// Frame-gap meter: how smoothly does the hover whisper animate while the tape
// ticks? Samples requestAnimationFrame deltas across N reveals of a target.
//   node scripts/probe-frames.mjs "<hover selector>" [reveals]
import { chromium } from 'playwright';

const sel = process.argv[2] ?? 'h1';
const reveals = Number(process.argv[3] ?? 6);

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
await page.goto('http://localhost:5199/trace/live-tape', { waitUntil: 'networkidle' });
await page.waitForSelector('tbody tr');
await page.waitForTimeout(1500);

const start = () =>
  page.evaluate(() => {
    window.__gaps = [];
    const id = (window.__id = (window.__id ?? 0) + 1);
    let last = performance.now();
    const tick = t => {
      if (window.__id !== id) return; // a newer loop took over — retire
      window.__gaps.push(t - last);
      last = t;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
const stop = () =>
  page.evaluate(() => {
    window.__id += 1;
    return window.__gaps.slice(1);
  });
const stats = (gaps, label) => {
  const s = [...gaps].sort((a, b) => a - b);
  const p = q => s[Math.min(s.length - 1, Math.floor(q * s.length))];
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  const dropped = s.filter(g => g > 32).length;
  console.log(
    `${label.padEnd(10)} frames ${String(s.length).padStart(4)}  mean ${mean.toFixed(1)}ms  p95 ${p(0.95).toFixed(1)}ms  max ${p(1).toFixed(
      1
    )}ms  dropped(>32ms) ${dropped}`
  );
  return { mean, p95: p(0.95), max: p(1), dropped, n: s.length };
};

// Idle first: the tape's own jitter with nothing animating.
await page.mouse.move(900, 700);
await start();
await page.waitForTimeout(800);
stats(await stop(), 'idle');

let all = [];
for (let i = 0; i < reveals; i++) {
  await start();
  await page.hover(sel);
  await page.waitForTimeout(650);
  await page.mouse.move(900, 700);
  await page.waitForTimeout(650);
  const g = await stop();
  all = all.concat(g);
  stats(g, `reveal ${i + 1}`);
}
stats(all, 'ALL');
await browser.close();
