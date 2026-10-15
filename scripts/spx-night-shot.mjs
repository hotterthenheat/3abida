/*
  SPX OVERNIGHT NEXT TO SPY OVER THE SAME NIGHT (the owner, 2026-10-15: "Screenshot SPX overnight next to SPY over the
  same night").

    npm run spx:night                                   the shot, against the dev server on this machine
    npm run spx:night -- --url=http://127.0.0.1:5173    another address for the page
    npm run spx:night -- --out=<dir>                    where it goes (docs/spx-overnight/<date_time>/)
    npm run spx:night -- --hours=16                     how many hours of 5-minute bars the panes show (16)

  RUN ON THE ALWAYS-ON MACHINE, where the recorder reads SPX through Theta's terminal: between 6:00 and 9:25 am New York
  the panes hold the whole night just gone (8:15 pm to now). Two panes, SPX left and SPY right, five-minute bars, the
  field on; each pane zoomed to the hours asked. It writes spx-vs-spy.png, a close crop of each plot, and notes.json —
  what each pane says of its minutes (the price chip, the bars it holds, the words over its gaps), so the picture is read
  with its numbers. It changes nothing on the desk: the panes it sets are put back as they were.
*/
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const flag = name => args.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const base = (flag('url') ?? process.env.SPX_NIGHT_URL ?? 'http://127.0.0.1:5173').replace(/\/+$/, '');
/* 0: the panes as they open (a gap's words show where the run is wide enough to hold them) */
const hours = Number(flag('hours') ?? 16);
const stamp = new Date().toLocaleString('sv-SE', { timeZone: 'America/New_York' }).replace(' ', '_').replace(/:/g, '').slice(0, 15);
const out = flag('out') ?? join('docs', 'spx-overnight', stamp);
mkdirSync(out, { recursive: true });

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, ...(process.env.SPX_NIGHT_TZ ? { timezoneId: process.env.SPX_NIGHT_TZ } : {}) });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
const settle = ms => page.waitForTimeout(ms);

/* the desk as it was, put back at the end */
await page.goto(`${base}/terrain`, { waitUntil: 'domcontentloaded' });
const had = await page.evaluate(() => localStorage.getItem('slayer_terrain_v1'));
const pane = ticker => ({ ticker, timeframe: '5m', overlays: { trails: true }, ladder: true });
await page.evaluate(cfg => localStorage.setItem('slayer_terrain_v1', JSON.stringify(cfg)), { layout: 2, panes: [pane('SPX'), pane('SPY'), pane('QQQ'), pane('IWM')] });
await page.goto(`${base}/terrain`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-chart-ink]', { timeout: 60_000 });
await settle(20_000);

/* each pane zoomed out until it shows the hours asked (12 bars an hour) */
const plots = await page.locator('[data-chart-ink]').all();
for (const p of hours > 0 ? plots : []) {
  const b = await p.boundingBox();
  if (!b) continue;
  await page.mouse.move(b.x + b.width * 0.6, b.y + b.height * 0.5);
  for (let i = 0; i < 12; i++) {
    const shown = await p.evaluate(el => {
      const v = (el.closest('[data-chart-view]') ?? el.querySelector('[data-chart-view]'))?.getAttribute('data-chart-view') ?? '';
      const [a, b] = v.split('-').map(Number);
      return b - a;
    });
    if (Number.isFinite(shown) && shown >= hours * 12) break;
    await page.mouse.wheel(0, 240);
    await settle(250);
  }
}
await page.mouse.move(5, 5);
await settle(3000);
await page.screenshot({ path: join(out, 'spx-vs-spy.png') });
for (const [i, p] of plots.entries()) {
  const b = await p.boundingBox();
  if (b) await page.screenshot({ path: join(out, `pane-${i + 1}.png`), clip: { x: b.x, y: b.y, width: b.width, height: b.height } });
}
const notes = await page.evaluate(() => ({
  heads: [...document.querySelectorAll('[data-pane-head]')].map(h => h.textContent?.replace(/\s+/g, ' ').trim().slice(0, 200)),
  prices: [...document.querySelectorAll('[data-pane-print]')].map(e => `${e.getAttribute('data-pane-print')}: ${e.textContent?.trim()}`),
  empty: [...document.querySelectorAll('[data-no-bars]')].map(e => e.textContent?.trim()),
  /* name|timeframe|bars|first|last|field columns|revision, a pane each */
  charts: [...document.querySelectorAll('[data-chart-state]')].map(e => e.getAttribute('data-chart-state')),
}));
writeFileSync(join(out, 'notes.json'), JSON.stringify({ at: new Date().toISOString(), base, hours, notes, errors }, null, 1));
console.log(JSON.stringify(notes, null, 1));
console.log(`the shot: ${join(out, 'spx-vs-spy.png')}`);

/* the desk put back */
await page.evaluate(v => (v == null ? localStorage.removeItem('slayer_terrain_v1') : localStorage.setItem('slayer_terrain_v1', v)), had);
await browser.close();
