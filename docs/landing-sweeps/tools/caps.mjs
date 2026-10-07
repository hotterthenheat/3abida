/* tracked caps on the landing: any visible text set uppercase, or spaced 0.05em or more (the footer and the terminal's
   own pictures aside): PORT=… node caps.mjs */
import { chromium } from '/home/user/3abida/node_modules/playwright/index.mjs';
const { PORT, W = 1440, H = 900 } = process.env;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await (await browser.newContext({ viewport: { width: +W, height: +H }, reducedMotion: 'reduce' })).newPage();
await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
await page.waitForTimeout(1500);
const out = await page.evaluate(() => {
  const found = [];
  const walk = document.createTreeWalker(document.querySelector('[data-landing]'), NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walk.nextNode())) {
    const t = n.textContent.trim();
    if (!t || !/[a-z]/i.test(t)) continue;
    const el = n.parentElement;
    if (el.closest('footer, [data-terminal-window] img, [aria-hidden="true"]')) continue;
    const cs = getComputedStyle(el);
    const ls = parseFloat(cs.letterSpacing) / parseFloat(cs.fontSize);
    if (cs.textTransform === 'uppercase' || (Number.isFinite(ls) && ls >= 0.05)) found.push(`${el.tagName.toLowerCase()} "${t.slice(0, 40)}" ${cs.textTransform} ${cs.letterSpacing}`);
  }
  return found;
});
console.log(`${out.length} tracked or uppercase`);
for (const f of out.slice(0, 30)) console.log('  ' + f);
await browser.close();
