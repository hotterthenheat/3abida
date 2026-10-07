/* the phone's windows: the first terminal and each beat's picture, captured with their text sizes: PORT OUT THEME */
import { chromium } from '/home/user/3abida/node_modules/playwright/index.mjs';
import fs from 'fs';
const { PORT, OUT, THEME = 'dark', W = 390, H = 844 } = process.env;
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await (await browser.newContext({ viewport: { width: +W, height: +H }, colorScheme: THEME, hasTouch: true, isMobile: true, deviceScaleFactor: 3 })).newPage();
await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
await page.waitForTimeout(1200);
const fig = await page.$('[data-landing-hero-window]');
await fig.scrollIntoViewIfNeeded();
await page.evaluate(() => scrollBy(0, -80));
await page.waitForTimeout(2500);
await fig.screenshot({ path: `${OUT}/reveal-${THEME}-${W}.png` });
const beats = await page.$$('[data-session-beat]');
for (const [i, b] of beats.entries()) {
  await b.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);
  await b.screenshot({ path: `${OUT}/beat-${i}-${THEME}-${W}.png` });
  const info = await b.evaluate(el => {
    const img = el.querySelector('img');
    const box = img?.parentElement?.getBoundingClientRect();
    const r = img?.getBoundingClientRect();
    return { frame: box && [Math.round(box.width * 10) / 10, Math.round(box.height * 10) / 10], img: r && Math.round(r.width), src: img?.getAttribute('src'), crop: box && r && Math.round((box.width / r.width) * 1680 / 3 * 10) / 10, scale: box && r && Math.round((r.width / (1680 / 3)) * 1000) / 1000 };
  });
  console.log('beat', i, JSON.stringify(info));
}
const rw = await page.evaluate(() => { const w = document.querySelector('[data-landing-hero-window] [data-terminal-window]'); const r = w.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), w.getAttribute('data-terminal-window')]; });
console.log('reveal window', JSON.stringify(rw), 'svh70', Math.round(844 * 0.7));
await browser.close();
