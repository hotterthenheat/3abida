// Does expanding the Weigher's price pane keep the reader's view? Pan the
// chart, note bar spacing + the right edge, open fullscreen, read the
// fullscreen chart, close it, read again.
import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto('http://localhost:5199/weigher', { waitUntil: 'networkidle' });
await page.waitForSelector('tr[aria-selected]');
await page.waitForFunction(() => !document.body.innerText.includes('ENTERING TERMINAL'), null, { timeout: 8000 });
await page.waitForTimeout(1500);

const view = () =>
  page.evaluate(() => {
    // The largest chart handle on screen (the fullscreen one when open).
    const els = [...document.querySelectorAll('div')].filter(d => d.__chart);
    els.sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width);
    const el = els[0];
    const ts = el.__chart.timeScale();
    const r = ts.getVisibleLogicalRange();
    return {
      width: Math.round(el.getBoundingClientRect().width),
      from: Math.round(r.from),
      to: Math.round(r.to),
      bars: Math.round(r.to - r.from),
      spacing: +ts.options().barSpacing.toFixed(2),
      scroll: +ts.scrollPosition().toFixed(1),
    };
  });
const box = await page.evaluate(() => {
  const el = [...document.querySelectorAll('div')].find(d => d.__chart);
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
});
// Pan into history so the view is unmistakably the reader's own.
const x0 = box.x + box.w * 0.5;
const y0 = box.y + box.h * 0.5;
await page.mouse.move(x0, y0);
await page.mouse.down();
for (let i = 1; i <= 25; i++) {
  await page.mouse.move(x0 + i * 8, y0);
  await page.waitForTimeout(16);
}
await page.mouse.up();
await page.waitForTimeout(400);
const docked = await view();
console.log('docked, after panning :', docked);

await page.getByTitle('Fullscreen chart').first().click();
await page.waitForTimeout(900);
const full = await view();
console.log('fullscreen            :', full);
const kept = Math.abs(full.spacing - docked.spacing) < 0.05 && Math.abs(full.scroll - docked.scroll) < 1.5;
console.log(`→ view ${kept ? 'KEPT (same spacing and right edge; wider pane shows more bars)' : 'RESET to a default window'}`);

await page.keyboard.press('Escape');
await page.waitForTimeout(900);
const back = await view();
console.log('docked again          :', back);
console.log(`→ view ${Math.abs(back.scroll - docked.scroll) < 1.5 && Math.abs(back.spacing - docked.spacing) < 0.05 ? 'KEPT on return' : 'RESET on return'}`);
await browser.close();
