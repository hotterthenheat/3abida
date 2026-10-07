/* the first screen at several sizes, settled, and how much of it is empty: PORT OUT TAG [SIZES=1440x900,…] node first-screen.mjs
   (a size ending in c is taken with reduced motion) */
import { chromium } from '/home/user/3abida/node_modules/playwright/index.mjs';
import fs from 'fs';
const { PORT, OUT, TAG = 'h', SIZES = '1440x900,1440x900c,1280x720,1280x800,1366x768,1536x864,1920x1080,1920x1200,390x844,360x780,430x932' } = process.env;
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
for (const s of SIZES.split(',')) {
  const calm = s.endsWith('c');
  const [W, H] = s.replace(/c$/, '').split('x').map(Number);
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: 'dark', reducedMotion: calm ? 'reduce' : 'no-preference', hasTouch: W < 600, isMobile: W < 600 });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
  await page.waitForTimeout(2600);
  const q = await page.evaluate(() => { const q = document.querySelector('[data-landing-quote]'); const r = q.getBoundingClientRect(); return { size: getComputedStyle(q).fontSize, w: Math.round(r.width), h: Math.round(r.height), lines: Math.round(r.height / parseFloat(getComputedStyle(q).lineHeight)) }; });
  await page.screenshot({ path: `${OUT}/${TAG}-${s}.png` });
  console.log(s, JSON.stringify(q));
  await ctx.close();
}
await browser.close();
