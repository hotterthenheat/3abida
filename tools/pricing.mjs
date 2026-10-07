/* the pricing section alone: usage PORT=… OUT=dir node pricing.mjs */
import { chromium } from '/home/user/3abida/node_modules/playwright/index.mjs';
import fs from 'fs';
const port = process.env.PORT;
const OUT = process.env.OUT;
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
for (const [W, H, theme] of [[1440, 900, 'dark'], [1440, 900, 'light'], [390, 844, 'dark'], [390, 844, 'light']]) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, colorScheme: theme, hasTouch: W < 600, isMobile: W < 600 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  await page.evaluate(() => document.getElementById('pricing').scrollIntoView());
  await page.waitForTimeout(1500);
  const el = await page.$('#pricing');
  await el.screenshot({ path: `${OUT}/pricing-${theme}-${W}.png` });
  const info = await page.evaluate(() => {
    const plans = [...document.querySelectorAll('[data-landing-plan]')].map(p => {
      const r = p.getBoundingClientRect();
      return { plan: p.getAttribute('data-landing-plan'), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), door: p.querySelector('a')?.getBoundingClientRect().height };
    });
    return { plans, chips: document.querySelectorAll('[data-landing-in-place-of] li').length, usd: [...document.querySelectorAll('[data-landing-plan] p')].map(p => p.textContent).join(' | ') };
  });
  console.log(theme, W, JSON.stringify(info), errors.length ? 'ERR ' + errors[0] : '');
  await ctx.close();
}
await browser.close();
