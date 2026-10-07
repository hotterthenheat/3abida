/* P0-1's done-check: stops every STEP svh through the rooms stage (from a screen above it to its end), held HOLD ms,
   reading the stage's moving parts — each must stand at 0 or 1 — and capturing a small picture of each stop.
   usage: PORT=5200 OUT=dir SIZE=1440x900 THEME=dark [STEP=4] node rooms-stops.mjs */
import { chromium } from '/home/user/3abida/node_modules/playwright/index.mjs';
import fs from 'fs';
const port = process.env.PORT || 5200;
const OUT = process.env.OUT;
const [W, H] = (process.env.SIZE || '1440x900').split('x').map(Number);
const theme = process.env.THEME || 'dark';
const STEP = +(process.env.STEP || 4);
const HOLD = +(process.env.HOLD || 1500);
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, colorScheme: theme });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
await page.waitForTimeout(1000);
await page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
await page.waitForTimeout(1500);
const geo = await page.evaluate(() => {
  const t = document.querySelector('[data-rooms-track]');
  const r = t.getBoundingClientRect();
  return { top: r.top + scrollY, h: r.height };
});
const vh = H;
const bad = [];
const rows = [];
let n = 0;
const glide = async to => {
  const from = await page.evaluate(() => scrollY);
  const k = Math.max(1, Math.ceil(Math.abs(to - from) / 45));
  for (let i = 1; i <= k; i++) {
    await page.evaluate(v => scrollTo(0, v), Math.round(from + ((to - from) * i) / k));
    await page.waitForTimeout(20);
  }
};
for (let s = -100; s <= (geo.h / vh) * 100 - 100 + 4; s += STEP) {
  await glide(Math.round(geo.top + (s / 100) * vh));
  await page.waitForTimeout(HOLD);
  const st = await page.evaluate(() => {
    const op = el => (el ? +getComputedStyle(el).opacity : null);
    const stage = document.querySelector('[data-rooms-stage]');
    const labels = [...stage.querySelectorAll('[data-rooms-slot] > span:last-child')].map(op);
    const pics = [...stage.querySelectorAll('[data-rooms-slot] > span:first-child')].map(op);
    const frame = stage.querySelector('.will-change-transform');
    const words = stage.querySelector('[data-room-words]')?.closest('.min-w-0.flex');
    const win = stage.querySelector('[data-rooms-window]');
    const turnA = stage.querySelector('[data-rooms-turn="a"]');
    const turnB = stage.querySelector('[data-rooms-turn="b"]');
    const head = stage.querySelector('[data-rooms-slot]')?.closest('.flex-col')?.firstElementChild;
    return {
      labels, pics,
      frame: op(frame),
      words: op(words),
      win: win ? getComputedStyle(win).visibility : null,
      turnA: op(turnA), turnB: op(turnB),
      head: op(head),
      ground: getComputedStyle(stage).backgroundColor,
      room: stage.querySelector('[data-room-words]')?.getAttribute('data-room-words'),
      theme: stage.getAttribute('data-theme'),
    };
  });
  const mid = v => v !== null && v > 0.02 && v < 0.98;
  const half = [...st.labels, ...st.pics, st.frame, st.words, st.turnA, st.turnB, st.head].filter(mid);
  /* the wall half dealt: some cards in, some not */
  const lit = st.labels.filter(v => v > 0.98).length;
  const partWall = lit > 0 && lit < st.labels.length;
  const row = { s, ...st, lit, partWall, half: half.length };
  rows.push(row);
  if (half.length || partWall) bad.push(row);
  const file = `${OUT}/${theme}-${W}x${H}-${String(n).padStart(3, '0')}.png`;
  await page.screenshot({ path: file });
  n++;
}
fs.writeFileSync(`${OUT}/${theme}-${W}x${H}.json`, JSON.stringify({ geo, rows, bad, errors }, null, 1));
console.log(`${theme} ${W}x${H}: ${rows.length} stops, ${bad.length} unfinished, errors ${errors.length}`);
for (const b of bad) console.log('  UNFINISHED s=', b.s, JSON.stringify({ labels: b.labels.map(v => +v.toFixed(2)), frame: b.frame, words: b.words, turnA: b.turnA, turnB: b.turnB, head: b.head }));
await browser.close();
