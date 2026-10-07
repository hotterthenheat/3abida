/* the page's left and right edges in each section: PORT=… node edges.mjs */
import { chromium } from '/home/user/3abida/node_modules/playwright/index.mjs';
const { PORT, SIZES = '1280x720,1440x900,1920x1080,1920x950' } = process.env;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
for (const s of SIZES.split(',')) {
  const [W, H] = s.split('x').map(Number);
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: 'dark' });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    const box = el => { if (!el) return null; const b = el.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.right), Math.round(b.width)]; };
    const q = s => document.querySelector(s);
    const sessionText = q('[data-session] > div');
    const stage = q('[data-session-stage]');
    const win = stage?.firstElementChild;
    const roomsWin = q('[data-rooms-window]');
    const roomsGrid = roomsWin?.parentElement;
    const roomsText = roomsGrid?.firstElementChild;
    const roomsInner = roomsWin?.querySelector('.landing-window, [data-theme]');
    const pricing = q('#pricing [data-landing-plans]') ?? q('#pricing .grid');
    const faq = q('#faq dl');
    const faqGrid = faq?.parentElement;
    const trust = q('[data-landing-does]');
    return {
      root: getComputedStyle(document.documentElement).fontSize,
      sessionText: box(sessionText), sessionStage: box(stage), sessionWindow: box(win),
      roomsText: box(roomsText), roomsCell: box(roomsWin), roomsWindow: box(roomsInner),
      trust: box(trust), pricing: box(pricing), faqGrid: box(faqGrid),
    };
  });
  console.log(`${W}x${H}`, JSON.stringify(r));
  await ctx.close();
}
await browser.close();
