/* the read (Why Slayer) and the questions, whole, at a desk and a phone: PORT OUT TAG node trustfaq.mjs */
import { chromium } from '/home/user/3abida/node_modules/playwright/index.mjs';
import fs from 'fs';
const { PORT, OUT, TAG } = process.env;
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
for (const [W, H, theme] of [[1440, 900, 'dark'], [390, 844, 'light']]) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: theme, reducedMotion: 'reduce', hasTouch: W < 600, isMobile: W < 600 });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  /* the floating bar would print over a capture taller than the screen */
  await page.addStyleTag({ content: 'header { visibility: hidden !important; }' });
  for (const [name, sel] of [['trust', '#trust'], ['faq', '#faq dl, [data-landing-faq-list]']]) {
    let el = await page.$(sel);
    if (el && name === 'faq') el = await el.evaluateHandle(e => e.parentElement.parentElement);
    if (!el) { console.log(TAG, name, 'missing'); continue; }
    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    const h = await el.evaluate(e => Math.round(e.getBoundingClientRect().height));
    await el.screenshot({ path: `${OUT}/${TAG}-${name}-${theme}-${W}.png` });
    console.log(TAG, name, `${W}x${H}`, 'height', h);
  }
  await ctx.close();
}
await browser.close();
