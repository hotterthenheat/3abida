/* THE DIRECTIVE'S SWEEP (2026-10-06): scroll in small steps to a stop every three-quarters of a screen, hold each stop
   1.5 s, capture. Runs: 1440×900, 1280×720, 390×844 in dark and light, and 1440×900 dark with reduced motion.
   usage: PORT=5200 OUT=dir [RUNS=1440x900:dark,...] node sweep.mjs */
import { chromium } from '/home/user/3abida/node_modules/playwright/index.mjs';
import fs from 'fs';
const port = process.env.PORT || 5200;
const OUT = process.env.OUT;
const RUNS = (process.env.RUNS || '1440x900:dark,1440x900:light,1280x720:dark,1280x720:light,390x844:dark,390x844:light,1440x900:dark:calm').split(',');
const HOLD = +(process.env.HOLD || 1500);
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const report = {};
for (const run of RUNS) {
  const [size, theme, calm] = run.split(':');
  const [W, H] = size.split('x').map(Number);
  const tag = `${theme}-${size}${calm ? '-calm' : ''}`;
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, colorScheme: theme, reducedMotion: calm ? 'reduce' : 'no-preference', hasTouch: W < 600, isMobile: W < 600 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  /* the dev server's first compile is not the page: load once, then read the page fresh */
  await page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  await page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
  await page.waitForTimeout(1800);
  const step = Math.round(H * 0.75);
  let y = 0;
  let i = 0;
  const stops = [];
  for (;;) {
    const total = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    const to = Math.min(y, total);
    /* small steps, a frame or two apart, as a reader's wheel does */
    const from = await page.evaluate(() => scrollY);
    const n = Math.max(1, Math.ceil(Math.abs(to - from) / 45));
    for (let k = 1; k <= n; k++) {
      await page.evaluate(v => scrollTo(0, v), Math.round(from + ((to - from) * k) / n));
      await page.waitForTimeout(24);
    }
    if (W >= 600) await page.mouse.move(W - 6, H - 6);
    await page.waitForTimeout(HOLD);
    const file = `${OUT}/${tag}-${String(i).padStart(2, '0')}.png`;
    await page.screenshot({ path: file });
    stops.push({ i, y: to, file });
    i++;
    if (to >= total || i > 40) break;
    y += step;
  }
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  report[tag] = { height, stops: stops.length, errors };
  console.log(tag, 'height', height, 'stops', stops.length, errors.length ? 'ERRORS ' + errors.slice(0, 3).join(' | ') : 'ok');
  await ctx.close();
}
fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
await browser.close();
