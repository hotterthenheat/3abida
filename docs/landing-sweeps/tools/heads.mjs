/* the sections' heads, one picture each: usage PORT=… OUT=… TAG=… node heads.mjs */
import { chromium } from '/home/user/3abida/node_modules/playwright/index.mjs';
import fs from 'fs';
const { PORT, OUT, TAG } = process.env;
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, colorScheme: 'dark', reducedMotion: 'reduce' });
const page = await ctx.newPage();
await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
await page.waitForTimeout(2000);
for (const sel of ['#rooms-head', '#trust', '#pricing', '#faq']) {
  await page.evaluate(s => { const el = document.querySelector(s); if (el) scrollTo(0, el.getBoundingClientRect().top + scrollY - 150); }, sel);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/${TAG}-${sel.slice(1)}.png` });
}
await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
await page.waitForTimeout(600);
const close = await page.evaluate(() => { const el = [...document.querySelectorAll('h2')].find(h => /Seen enough/.test(h.textContent)); el?.scrollIntoView({ block: 'center' }); return !!el; });
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/${TAG}-close.png` });
console.log('close found', close);
await browser.close();
