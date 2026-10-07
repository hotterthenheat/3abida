/* every control on the phone's landing whose hit area is under 44 px tall (or wide) — the hit area measured by pressing
   the screen: from each control's centre, outwards, the run of points that land on it (so a ::before box round a small
   control counts, as a finger would find it): PORT=… node targets2.mjs */
import { chromium } from '/home/user/3abida/node_modules/playwright/index.mjs';
const { PORT, W = 390, H = 844 } = process.env;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await (await browser.newContext({ viewport: { width: +W, height: +H }, colorScheme: 'dark', hasTouch: true, isMobile: true })).newPage();
await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
await page.waitForTimeout(1500);
const read = async (label, scope) => {
  const n = await page.evaluate(s => {
    window.__targets = [...document.querySelectorAll(`${s} a[href], ${s} button, ${s} [role=tab], ${s} summary, ${s} input, ${s} select`)].filter(el => {
      if (el.closest('footer') || el.closest('[aria-hidden=true]')) return false;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
    });
    return window.__targets.length;
  }, scope);
  const small = [];
  for (let i = 0; i < n; i++) {
    const res = await page.evaluate(async i => {
      const el = window.__targets[i];
      if (!el.closest('header')) el.scrollIntoView({ block: 'center', inline: 'center' });
      await new Promise(r => setTimeout(r, 60));
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const on = (x, y) => { const h = document.elementFromPoint(x, y); return !!h && (h === el || el.contains(h)); };
      const run = (x0, y0, dx, dy) => { let k = 0; while (k < 80 && on(x0 + dx * (k + 1), y0 + dy * (k + 1))) k++; return k; };
      if (!on(cx, cy)) return { name: el.textContent.trim().slice(0, 40), covered: true, w: Math.round(r.width), h: Math.round(r.height) };
      const hh = 1 + run(cx, cy, 0, -1) + run(cx, cy, 0, 1);
      const ww = 1 + run(cx, cy, -1, 0) + run(cx, cy, 1, 0);
      return { name: `${el.tagName.toLowerCase()}${el.getAttribute('role') ? '[' + el.getAttribute('role') + ']' : ''} "${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40)}"`, w: Math.round(r.width), h: Math.round(r.height), hw: Math.min(ww, 161), hh: Math.min(hh, 161) };
    }, i);
    if (res.covered) small.push(`  (covered at its centre) "${res.name}" ${res.w}×${res.h}`);
    else if (res.hh < 44 || res.hw < 44) small.push(`  ${res.name} box ${res.w}×${res.h}, hit ${res.hw}×${res.hh}`);
  }
  console.log(`${label}: ${n} controls, ${small.length} with a hit area under 44 px`);
  for (const s of small) console.log(s);
};
await read('page', '[data-landing]');
/* the menu, open */
await page.evaluate(() => scrollTo(0, 0));
await page.waitForTimeout(300);
const menu = await page.$('header button[aria-label*="menu" i], header button[aria-expanded]');
if (menu) { await menu.click(); await page.waitForTimeout(500); await read('menu open', 'header'); }
await browser.close();
