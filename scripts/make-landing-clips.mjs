/*
  THE LANDING'S FILMS (2026-10-01) — `npm run landing:clips`, with the dev server up.

  The owner, of the stills: "why are my photos just a photo and dont move so you cant see all the features my website
  offers?" So every page the tour names is FILMED, not drawn: the real terminal, staged exactly as its still is
  (landing-stage.mjs — the same first visit, the same steps a reader takes), and then worked by a pointer the viewer can
  see — a strike hovered and its card read, a price dragged and the return following it, a day of the journal opened. The
  live feed keeps moving underneath: prints arrive, candles grow, the book redraws.

  HOW IT IS FILMED. The page's clock is held (Playwright's clock: Date, timers and animation frames, in the terminal's own
  frame too) and stepped a thirtieth of a second at a time; after each step the screen is taken at device pixels. So a
  film is a smooth 30 frames a second however long a picture takes to take, and the charts are drawn at the picture's
  own density (a screencast is capped at the page's CSS size, and scaling the page up blurred every canvas — both
  measured). The frames are encoded to H.264 (MP4, which every browser plays, a phone's too).

  WHAT IT WRITES, per page, theme and size —
      public/landing/clips/<page>-<theme>-<desk|phone>.mp4    the film
      public/landing/<page>-<theme>-<desk|phone>.webp         its first frame, the still the landing shows until it plays
      src/pages/landing/clips.json                            each film's length and the words it says, and when
  The pointer is drawn into the film (a desk only — a phone has none), and fades in after the first frame and out before
  the last, so a film begins and ends on its still and loops without a seam.

  The encoder is ffmpeg with libx264: FFMPEG names one, else `ffmpeg` on the PATH. After the address: pages ("/terrain"),
  a size ("desk" | "phone"), a theme ("dark" | "light") — as landing:shots takes them.
*/
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { ALL_PAGES, SEED, PREPARE, slug } from './landing-stage.mjs';

const BASE = process.argv[2] ?? 'http://localhost:5199';
const ARGS = process.argv.slice(3);
const ONLY = ARGS.filter(a => a.startsWith('/'));
const FORMS = ARGS.filter(a => a === 'desk' || a === 'phone');
const ONLY_THEMES = ARGS.filter(a => a === 'dark' || a === 'light');
const FFMPEG = process.env.FFMPEG ?? 'ffmpeg';
const PUBLIC = resolve(process.cwd(), 'public/landing');
const CLIPS = resolve(PUBLIC, 'clips');
const MANIFEST = resolve(process.cwd(), 'src/pages/landing/clips.json');
mkdirSync(CLIPS, { recursive: true });

const PAGES = ALL_PAGES.filter(p => !ONLY.length || ONLY.includes(p));
const THEMES = ['dark', 'light'].filter(t => !ONLY_THEMES.length || ONLY_THEMES.includes(t));
/* a desk's screen at 1.5 device pixels a point, as its still; a phone's at two — the film is what a phone's window shows,
   and at two it is sharp in a 390-point band at a fraction of the frames' cost (three took as long as a desk's) */
const SIZES = [
  { form: 'desk', w: 1440, h: 1000, dpr: 1.5, out: null, crf: 28 },
  { form: 'phone', w: 390, h: 760, dpr: 2, out: null, crf: 27 },
].filter(z => !FORMS.length || FORMS.includes(z.form));
const FPS = 30;
/* where the pointer rests when it is not working: low on the right, out of the way of every page's head */
const HOME = (size) => [size.w * 0.84, size.h * 0.9];

/* ---- THE ACTS: what the pointer does on each page, and what the film says while it does ---------------------------- */

/** A point on the n-th element matching `sel` that is on screen: `n` counts from the top (or from the end, below zero),
    'mid' is the one nearest the screen's middle; `fx`, `fy` place the point inside its box. */
const on = (sel, n = 0, fx = 0.5, fy = 0.5, fallback = null) => async ({ frame, size }) => {
  const boxes = (await frame.locator(sel).evaluateAll(els => els.map(e => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; })).catch(() => []))
    .filter(([x, y, w, h]) => w > 2 && h > 2 && y + h > 60 && y < size.h - 30 && x < size.w - 10 && x + w > 10);
  if (!boxes.length) return fallback ? [fallback[0] * size.w, fallback[1] * size.h] : null;
  let i = n === 'mid' ? boxes.reduce((best, b, k) => (Math.abs(b[1] + b[3] / 2 - size.h / 2) < Math.abs(boxes[best][1] + boxes[best][3] / 2 - size.h / 2) ? k : best), 0) : n < 0 ? boxes.length + n : n;
  i = Math.max(0, Math.min(boxes.length - 1, i));
  const [x, y, w, h] = boxes[i];
  return [x + w * fx, y + h * fy];
};
/** …and the same, k rows on from the one nearest the middle; `first` keeps to the leftmost column (a matrix's net cells
    stand in every greek's column, and the pointer should walk down one, not hop across them) */
const near = (sel, k, fx = 0.5, first = false) => async ctx => {
  let all = (await ctx.frame.locator(sel).evaluateAll(els => els.map(e => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; })).catch(() => []))
    .filter(([x, y, w, h]) => w > 2 && h > 2 && y > 70 && y + h < ctx.size.h - 30);
  if (first && all.length) {
    const left = Math.min(...all.map(b => b[0]));
    all = all.filter(b => b[0] < left + 4);
  }
  if (!all.length) return null;
  const mid = all.reduce((best, b, j) => (Math.abs(b[1] - ctx.size.h / 2) < Math.abs(all[best][1] - ctx.size.h / 2) ? j : best), 0);
  const [x, y, w, h] = all[Math.max(0, Math.min(all.length - 1, mid + k))];
  return [x + w * fx, y + h / 2];
};
/** a point by fractions of the screen */
const at = (fx, fy) => async ({ size }) => [fx * size.w, fy * size.h];

/* each desk act runs about ten seconds; a beat is one of
     { say }              the film's words from here
     { to, dur }          the pointer glides there      { hold }   it stays
     { click }            it presses where it is        { drag, dur }   it presses, glides there, lets go
     { scroll, dur }      the page scrolls (a share of what it can, or pixels)  */
const DESK = {
  '/pulse': [
    { say: 'Your own desk of live panels.' },
    { to: on('[data-chart-ground]', 0, 0.3, 0.55), dur: 0.9 },
    { to: on('[data-chart-ground]', 0, 0.78, 0.42), dur: 1.8 },
    { say: 'The hedging at every strike, row by row.' },
    { to: near('[data-ladder-row]', -3, 0.55), dur: 0.8 }, { hold: 0.5 },
    { to: near('[data-ladder-row]', 0, 0.55), dur: 0.5 }, { hold: 0.5 },
    { to: near('[data-ladder-row]', 3, 0.55), dur: 0.5 }, { hold: 0.6 },
    { say: 'Setups and the earnings week, beside it.' },
    { to: on('[data-compass-card]', 0, 0.5, 0.5, [0.25, 0.86]), dur: 1.0 }, { hold: 0.7 },
    { to: on('[data-compass-card]', 1, 0.5, 0.5, [0.45, 0.86]), dur: 0.6 }, { hold: 0.7 },
  ],
  '/pulse/board': [
    { say: 'Four names at once.' },
    { to: on('[data-chart-ink]', 0, 0.35, 0.5), dur: 0.9 }, { to: on('[data-chart-ink]', 0, 0.8, 0.45), dur: 1.1 },
    { to: on('[data-chart-ink]', 1, 0.35, 0.5), dur: 0.8 }, { to: on('[data-chart-ink]', 1, 0.8, 0.45), dur: 1.1 },
    { say: 'Each on its own timeframe and overlays.' },
    { to: on('[data-chart-ink]', 2, 0.35, 0.5), dur: 0.8 }, { to: on('[data-chart-ink]', 2, 0.8, 0.45), dur: 1.1 },
    { to: on('[data-chart-ink]', 3, 0.35, 0.5), dur: 0.8 }, { to: on('[data-chart-ink]', 3, 0.8, 0.45), dur: 1.1 },
  ],
  '/compass': [
    { say: 'Contracts picked off today’s levels.' },
    { to: on('[data-compass-card]', 0), dur: 0.9 }, { hold: 0.9 },
    { to: on('[data-compass-card]', 1), dur: 0.6 }, { hold: 0.8 },
    { say: 'Each one marked active, watch or fading.' },
    { to: on('[data-compass-card]', 2), dur: 0.6 }, { hold: 0.8 },
    { to: on('[data-compass-card]', 3), dur: 0.6 }, { hold: 0.8 },
    { say: 'The heaviest contracts on the top name.' },
    { to: at(0.84, 0.35), dur: 0.9 }, { hold: 0.5 }, { to: at(0.84, 0.55), dur: 0.8 }, { hold: 0.6 },
  ],
  '/compass/tracker': [
    { say: 'What you kept, followed to the close.' },
    { to: at(0.32, 0.3), dur: 1.0 }, { hold: 1.0 },
    { to: at(0.6, 0.3), dur: 0.8 }, { hold: 1.0 },
    { say: 'Each setup’s premium since you kept it.' },
    { to: at(0.85, 0.3), dur: 0.8 }, { hold: 1.2 },
  ],
  '/terrain': [
    { say: 'Charts, and nothing in the way.' },
    { to: on('[data-chart-ink]', 0, 0.3, 0.6), dur: 0.9 }, { to: on('[data-chart-ink]', 0, 0.85, 0.5), dur: 1.6 },
    { say: 'The book beside the chart, strike by strike.' },
    { to: near('[data-profile-panel] [data-ladder-row]', -2, 0.6), dur: 0.8 }, { hold: 0.5 },
    { to: near('[data-profile-panel] [data-ladder-row]', 2, 0.6), dur: 0.7 }, { hold: 0.6 },
    { say: 'Two names on one set of controls.' },
    { to: on('[data-chart-ink]', 1, 0.3, 0.55), dur: 1.0 }, { to: on('[data-chart-ink]', 1, 0.85, 0.45), dur: 1.4 },
  ],
  '/pinpoint/map': [
    { say: 'Every strike and expiry: put, call and net.' },
    { to: near('[data-matrix-row] [data-matrix-leg="net"]', -4, 0.6, true), dur: 0.8 }, { hold: 0.9 },
    { to: near('[data-matrix-row] [data-matrix-leg="net"]', -1, 0.6, true), dur: 0.6 }, { hold: 0.9 },
    { say: 'Hover a strike: its open interest and heaviest expiry.' },
    { to: near('[data-matrix-row] [data-matrix-leg="net"]', 2, 0.6, true), dur: 0.6 }, { hold: 1.0 },
    { to: near('[data-matrix-row] [data-matrix-leg="net"]', 5, 0.6, true), dur: 0.6 }, { hold: 1.0 },
  ],
  '/pinpoint/building': [
    { say: 'What was added to the book today.' },
    { to: on('[data-build-row]', 0, 0.3), dur: 0.9 }, { hold: 0.8 },
    { to: on('[data-build-row]', 1, 0.3), dur: 0.5 }, { hold: 0.7 },
    { say: 'Building or fading, strike by strike.' },
    { to: on('[data-build-row]', 2, 0.55), dur: 0.6 }, { hold: 0.7 },
    { to: on('[data-build-row]', 3, 0.85), dur: 0.7 }, { hold: 0.8 },
    { to: on('[data-build-row]', 5, 0.85), dur: 0.6 }, { hold: 0.8 },
  ],
  '/pinpoint/wall': [
    { say: 'At the wall: does it hold or break?' },
    { to: on('[data-wall-beam]', 0, 0.3, 0.5), dur: 1.0 }, { hold: 0.8 },
    { to: on('[data-wall-factor]', 0, 0.4), dur: 0.7 }, { hold: 0.6 },
    { to: on('[data-wall-factor]', 3, 0.4), dur: 0.6 }, { hold: 0.6 },
    { say: 'And what happens either way.' },
    { to: on('[data-wall-paths]', 0, 0.35, 0.6), dur: 0.8 }, { hold: 0.8 },
    { to: on('[data-wall-paths]', 0, 0.7, 0.3), dur: 0.8 }, { hold: 0.9 },
  ],
  '/pinpoint/compare': [
    { say: 'Two names, side by side on one ruler.' },
    { to: on('[data-h2h-row]', 0, 0.35), dur: 0.9 }, { hold: 0.7 },
    { to: on('[data-h2h-row]', 2, 0.35), dur: 0.5 }, { hold: 0.6 },
    { to: on('[data-h2h-row]', 4, 0.6), dur: 0.5 }, { hold: 0.6 },
    { say: 'Every level, read against the other name.' },
    { to: on('[data-h2h-row]', 6, 0.6), dur: 0.5 }, { hold: 0.7 },
    { to: on('[data-h2h-strike]', 0), dur: 0.7 }, { hold: 1.0 },
  ],
  '/trace/live-tape': [
    { say: 'Every print, as it happens.' },
    { hold: 1.2 },
    { to: on('[data-tape-body] .ag-row', 2, 0.3), dur: 0.9 }, { hold: 0.8 },
    { say: 'Sweeps, blocks and dark-pool crosses.' },
    { to: on('[data-tape-body] .ag-row', 5, 0.55), dur: 0.6 }, { hold: 0.8 },
    { to: on('[data-tape-body] .ag-row', 8, 0.75), dur: 0.6 }, { hold: 1.0 },
    { to: on('[data-tape-body] .ag-row', 11, 0.4), dur: 0.6 }, { hold: 1.0 },
  ],
  '/trace/net-flow': [
    { say: 'Calls against puts, through the day.' },
    { to: on('[data-menu-clip] canvas', 0, 0.2, 0.45, [0.6, 0.6]), dur: 0.9 },
    { to: on('[data-menu-clip] canvas', 0, 0.85, 0.4, [0.9, 0.55]), dur: 2.2 },
    { say: 'The busiest names, a click apart.' },
    { to: on('[data-ticker]', 1), dur: 0.9 }, { hold: 0.4 }, { click: true }, { hold: 1.2 },
    { to: on('[data-menu-clip] canvas', 0, 0.55, 0.5, [0.75, 0.6]), dur: 0.9 }, { hold: 0.8 },
  ],
  '/trace/dark-pool': [
    { say: 'Off-exchange crosses, largest first.' },
    { to: on('[data-trace-grid] .ag-row', 1, 0.35), dur: 0.9 }, { hold: 0.7 },
    { to: on('[data-trace-grid] .ag-row', 4, 0.5), dur: 0.5 }, { hold: 0.6 },
    { say: 'The levels they keep printing at.' },
    { to: on('[data-dark-pool-shelf]', 0), dur: 0.9 }, { hold: 0.7 },
    { to: on('[data-dark-pool-shelf]', 2), dur: 0.5 }, { hold: 0.7 },
    { to: on('[data-dark-pool-shelf]', 4), dur: 0.5 }, { hold: 0.8 },
  ],
  '/trace/screener': [
    { say: 'Every contract, filtered your way.' },
    { to: on('[data-trace-grid] .ag-row', 1, 0.3), dur: 0.9 }, { hold: 0.6 },
    { to: on('[data-trace-grid] .ag-row', 4, 0.45), dur: 0.5 }, { hold: 0.6 },
    { say: 'Sorted by what you care about.' },
    { to: on('[data-trace-grid] .ag-header-cell', 6, 0.5, 0.5), dur: 0.9 }, { hold: 0.3 }, { click: true }, { hold: 1.1 },
    { to: on('[data-trace-grid] .ag-row', 3, 0.6), dur: 0.8 }, { hold: 0.9 },
  ],
  '/weigher': [
    { say: 'Weigh a contract before you take it.' },
    { to: on('[data-chain-grid] .ag-row', 'mid', 0.3), dur: 0.9 }, { hold: 0.6 },
    { to: on('[data-chain-grid] .ag-row', 'mid', 0.7), dur: 0.6 }, { hold: 0.5 },
    { say: 'Drag the price: the return at every level.' },
    { to: on('[data-price-ruler]', 0, 0.5, 0.5), dur: 1.0 }, { hold: 0.3 },
    { drag: on('[data-price-ruler]', 0, 0.78, 0.5), dur: 1.4 }, { hold: 0.5 },
    { drag: on('[data-price-ruler]', 0, 0.28, 0.5), dur: 1.6 }, { hold: 0.6 },
    { say: 'Positions and the watchlist on one desk.' },
    { to: on('[data-list] .ag-row', 0, 0.4, 0.5, [0.3, 0.8]), dur: 0.9 }, { hold: 0.9 },
  ],
  '/dossier/news': [
    { say: 'The wire, on a map.' },
    { to: on('[data-news-pin]', 0), dur: 1.0 }, { hold: 0.9 },
    { to: on('[data-news-pin]', 2), dur: 0.7 }, { hold: 0.8 },
    { say: 'Each story where it happens.' },
    { to: on('[data-news-tape-item]', 1, 0.3), dur: 0.9 }, { hold: 0.7 },
    { to: on('[data-news-tape-item]', 3, 0.3), dur: 0.5 }, { hold: 0.9 },
  ],
  '/dossier/earnings': [
    { say: 'The week’s reports.' },
    { to: on('[data-earnings-card]', 0), dur: 1.0 }, { hold: 0.8 },
    { to: on('[data-earnings-card]', 1), dur: 0.5 }, { hold: 0.7 },
    { say: 'And the move priced for each.' },
    { to: on('[data-earnings-card]', 3), dur: 0.6 }, { hold: 0.7 },
    { to: on('[data-earnings-grid] .ag-row', 0, 0.55, 0.5, [0.55, 0.8]), dur: 0.9 }, { hold: 0.6 },
    { to: on('[data-earnings-grid] .ag-row', 2, 0.75, 0.5, [0.75, 0.86]), dur: 0.6 }, { hold: 0.8 },
  ],
  '/dossier/insiders': [
    { say: 'Who filed, what, and when.' },
    { to: on('[data-insiders-name]', 0), dur: 1.0 }, { hold: 0.7 },
    { to: on('[data-insiders-name]', 2), dur: 0.6 }, { hold: 0.7 },
    { to: on('[data-insiders-grid] .ag-row', 1, 0.3), dur: 0.8 }, { hold: 0.6 },
    { say: 'Bought, sold or planned, name by name.' },
    { to: on('[data-insiders-grid] .ag-row', 4, 0.6), dur: 0.6 }, { hold: 0.7 },
    { to: on('[data-insiders-grid] .ag-row', 7, 0.45), dur: 0.6 }, { hold: 0.8 },
  ],
  '/dossier/congress': [
    { say: 'Trades disclosed by members of Congress.' },
    { to: on('[data-congress-report]', 0), dur: 1.0 }, { hold: 0.7 },
    { to: on('[data-congress-report]', 2), dur: 0.6 }, { hold: 0.7 },
    { to: on('[data-congress-grid] .ag-row', 1, 0.35), dur: 0.8 }, { hold: 0.6 },
    { say: 'When it was traded, and how late it was filed.' },
    { to: on('[data-congress-grid] .ag-row', 4, 0.6), dur: 0.6 }, { hold: 0.7 },
    { to: on('[data-congress-grid] .ag-row', 7, 0.45), dur: 0.6 }, { hold: 0.8 },
  ],
  '/dossier/stocks': [
    { say: 'A plain read of any name.' },
    { to: on('[data-stocks-sector]', 0), dur: 1.0 }, { hold: 0.6 },
    { to: on('[data-stocks-sector]', 3), dur: 0.6 }, { hold: 0.6 },
    { say: 'Strong, good, caution or poor.' },
    { to: on('[data-stocks-grid] .ag-row', 1, 0.3), dur: 0.8 }, { hold: 0.6 },
    { to: on('[data-stocks-grid] .ag-row', 4, 0.55), dur: 0.6 }, { hold: 0.7 },
    { to: on('[data-stocks-grid] .ag-row', 7, 0.4), dur: 0.6 }, { hold: 0.8 },
  ],
  '/practice/paper': [
    { say: 'Options on today’s prices, with paper money.' },
    { to: on('[data-chart-position]', 0, 0.5, 0.5, [0.5, 0.5]), dur: 1.0 }, { hold: 0.8 },
    { say: 'A target and a stop, pulled off the position.' },
    { drag: async c => { const p = await on('[data-chart-position]', 0, 0.5, 0.5)(c); return p && [p[0], p[1] - 64]; }, dur: 1.1 }, { hold: 0.6 },
    { to: on('[data-chart-position]', 0, 0.5, 0.5, [0.5, 0.5]), dur: 0.7 },
    { drag: async c => { const p = await on('[data-chart-position]', 0, 0.5, 0.5)(c); return p && [p[0], p[1] + 58]; }, dur: 1.1 }, { hold: 0.8 },
    { say: 'Every order from the chain beside it.' },
    { to: on('[data-chain-row]', 3, 0.5, 0.5, [0.8, 0.7]), dur: 1.0 }, { hold: 0.8 },
  ],
  '/practice/backtest': [
    { say: 'A past day, replayed a minute at a time.' },
    { to: on('[data-replay-play]', 0, 0.5, 0.5, [0.2, 0.9]), dur: 1.0 }, { hold: 0.3 }, { click: true }, { hold: 2.4 },
    { say: 'Traded off the chain as it stood.' },
    { to: on('[data-chain-row]', 4, 0.5, 0.5, [0.8, 0.7]), dur: 1.0 }, { hold: 0.8 },
    { to: on('[data-chain-row]', 7, 0.5, 0.5, [0.8, 0.78]), dur: 0.6 }, { hold: 1.2 },
  ],
  '/practice/journal': [
    { say: 'Every closed trade, on its day.' },
    { to: on('[data-journal-day][data-trades]:not([data-trades="0"])', 3), dur: 1.0 }, { hold: 0.5 }, { click: true }, { hold: 1.4 },
    { say: 'Open a day: its trades, and how it went.' },
    { to: on('[data-journal-day][data-trades]:not([data-trades="0"])', 8), dur: 0.8 }, { hold: 0.4 }, { click: true }, { hold: 1.6 },
    { to: on('[data-journal-stat]', 2, 0.5, 0.5, [0.85, 0.5]), dur: 0.9 }, { hold: 0.8 },
  ],
};

/* A phone has no pointer: its film is the page read top to bottom and back, with the same words */
const phoneAct = path => {
  const says = (DESK[path] ?? []).filter(b => b.say).map(b => b.say);
  return [
    { say: says[0] ?? '' },
    { hold: 1.1 },
    { scroll: 0.5, dur: 3.2 },
    ...(says[1] ? [{ say: says[1] }] : []),
    { hold: 1.3 },
    { scroll: 0, dur: 2.4 },
    { hold: 0.6 },
  ];
};

/* ---- THE CAMERA ---------------------------------------------------------------------------------------------------- */

const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
/* the pointer: a plain arrow, white with a dark edge, so it reads on either ground */
const POINTER = `<svg width="22" height="28" viewBox="0 0 22 28"><path d="M2 2 L2 22 L7.5 17 L11 25.5 L14.5 24 L11 15.8 L18.5 15.8 Z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>`;

const film = async (browser, path, theme, size, manifest) => {
  const ctx = await browser.newContext({ viewport: { width: size.w, height: size.h }, deviceScaleFactor: size.dpr });
  await ctx.addInitScript(seed => {
    try {
      for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
    } catch {}
  }, SEED);
  await ctx.clock.install();
  const page = await ctx.newPage();
  /* the stills' host (landing-stage): the terminal in a frame of the same origin, so it keeps its storage */
  await page.route(`${BASE}/__clip-host`, r =>
    r.fulfill({
      contentType: 'text/html',
      body: `<html><body style="margin:0;background:#000;overflow:hidden"><iframe id="t" src="${path}?embed=1&photo=1&theme=${theme}" style="border:0;display:block;width:${size.w}px;height:${size.h}px"></iframe>
<div id="cur" style="position:fixed;left:-2px;top:-2px;z-index:9;pointer-events:none;opacity:0;will-change:transform,opacity">${POINTER}</div>
<div id="tap" style="position:fixed;left:-17px;top:-17px;width:34px;height:34px;z-index:8;border-radius:50%;border:2px solid ${theme === 'dark' ? 'rgba(255,255,255,.85)' : 'rgba(10,10,10,.7)'};pointer-events:none;opacity:0"></div></body></html>`,
    })
  );
  await page.goto(`${BASE}/__clip-host`);
  await page.waitForTimeout(size.form === 'desk' ? 6500 : 5500);
  /* where the stage leaves the pointer is where the film's pointer appears — and where it comes back to, so the film
     opens and closes on the same frame (the Map's still has a row under the pointer, and so do both ends of its film) */
  let rest = null;
  const move = page.mouse.move.bind(page.mouse);
  page.mouse.move = async (x, y, o) => {
    rest = [x, y];
    return move(x, y, o);
  };
  await PREPARE[path]?.(page, theme, { form: size.form, w: size.w, h: size.h, dpr: size.dpr });
  page.mouse.move = move;
  await page.waitForTimeout(400);
  const frame = page.frameLocator('#t');
  const beats = size.form === 'desk' ? DESK[path] ?? [] : phoneAct(path);
  const desk = size.form === 'desk';

  const dir = resolve(tmpdir(), `slayer-clip-${slug(path)}-${theme}-${size.form}-${process.pid}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const cdp = await ctx.newCDPSession(page);
  let n = 0;
  const start = rest && rest[0] > 0 && rest[0] < size.w && rest[1] > 0 && rest[1] < size.h ? rest : HOME(size);
  let pos = start;
  let ring = -1;
  let cursor = 0;
  const captions = [];
  await page.mouse.move(pos[0], pos[1]);
  const shoot = async () => {
    const r = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 90, optimizeForSpeed: true, clip: { x: 0, y: 0, width: size.w, height: size.h, scale: size.dpr } });
    writeFileSync(resolve(dir, `f${String(n).padStart(5, '0')}.jpg`), Buffer.from(r.data, 'base64'));
    n++;
  };
  /* one frame: the pointer and the ring drawn, a thirtieth of a second passed, the screen taken */
  const step = async () => {
    const age = ring < 0 ? 99 : n - ring;
    await page.evaluate(
      ([x, y, o, age]) => {
        const c = document.getElementById('cur');
        c.style.transform = `translate(${x}px,${y}px)`;
        c.style.opacity = String(o);
        const t = document.getElementById('tap');
        const k = Math.min(1, age / 12);
        t.style.transform = `translate(${x}px,${y}px) scale(${0.45 + k})`;
        t.style.opacity = age < 12 ? String(0.9 * (1 - k)) : '0';
      },
      [pos[0], pos[1], desk ? cursor : 0, age]
    );
    await ctx.clock.runFor(1000 / FPS);
    await shoot();
  };
  const fade = async (to, frames) => {
    const from = cursor;
    for (let k = 1; k <= frames; k++) {
      cursor = from + (to - from) * (k / frames);
      await step();
    }
  };
  const scroller = async () =>
    frame.locator('main').first().evaluate(m => ({ top: m.scrollTop, max: m.scrollHeight - m.clientHeight })).catch(() => ({ top: 0, max: 0 }));

  /* held at the page's own time — this process's clock and the page's are not the same one (measured: a hold at our
     "now" was in the page's past once) */
  await ctx.clock.pauseAt((await page.evaluate(() => Date.now())) + 50);
  /* the first frame is the still: no pointer yet */
  await shoot();
  writeFileSync(resolve(dir, 'poster.png'), Buffer.from((await cdp.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: size.w, height: size.h, scale: size.dpr } })).data, 'base64'));
  await fade(1, 8);
  for (const b of beats) {
    if (b.say) captions.push([Number((n / FPS).toFixed(2)), b.say]);
    const target = b.to ?? b.drag;
    if (target) {
      const pt = await target({ frame, size, page });
      if (pt) {
        if (b.drag) await page.mouse.down();
        const from = pos;
        const frames = Math.max(2, Math.round((b.dur ?? 0.7) * FPS));
        for (let k = 1; k <= frames; k++) {
          const e = ease(k / frames);
          pos = [from[0] + (pt[0] - from[0]) * e, from[1] + (pt[1] - from[1]) * e];
          await page.mouse.move(pos[0], pos[1]);
          await step();
        }
        if (b.drag) await page.mouse.up();
      } else {
        /* the page did not have it: the beat's time passes all the same, so the words keep their place */
        for (let k = 0; k < Math.round((b.dur ?? 0.7) * FPS); k++) await step();
      }
    }
    if (b.click) {
      ring = n;
      await page.mouse.down();
      await page.mouse.up();
      await step();
    }
    if (b.scroll != null) {
      const s0 = await scroller();
      const goal = b.scroll <= 1 ? Math.min(s0.max * b.scroll, size.h * 1.6) : Math.min(b.scroll, s0.max);
      const frames = Math.max(2, Math.round((b.dur ?? 2) * FPS));
      for (let k = 1; k <= frames; k++) {
        const y = s0.top + (goal - s0.top) * ease(k / frames);
        await frame.locator('main').first().evaluate((m, y) => (m.scrollTop = y), y).catch(() => {});
        await step();
      }
    }
    if (b.hold) for (let k = 0; k < Math.round(b.hold * FPS); k++) await step();
  }
  /* back where it started, the pointer out, and the film ends on the frame it began on */
  if (desk) {
    const from = pos;
    const end = start;
    const frames = Math.round(0.9 * FPS);
    for (let k = 1; k <= frames; k++) {
      const e = ease(k / frames);
      pos = [from[0] + (end[0] - from[0]) * e, from[1] + (end[1] - from[1]) * e];
      await page.mouse.move(pos[0], pos[1]);
      await step();
    }
  }
  await fade(0, 8);

  /* the still: the first frame, as WebP, encoded by the browser itself */
  const png = readFileSync(resolve(dir, 'poster.png')).toString('base64');
  const webp = await page.evaluate(async b64 => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    const blob = await new Promise(r => c.toBlob(r, 'image/webp', 0.8));
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return btoa(s);
  }, png);
  await ctx.close();

  const key = `${slug(path)}-${theme}-${size.form}`;
  writeFileSync(resolve(PUBLIC, `${key}.webp`), Buffer.from(webp, 'base64'));
  const out = resolve(CLIPS, `${key}.mp4`);
  execFileSync(FFMPEG, [
    '-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', resolve(dir, 'f%05d.jpg'),
    ...(size.out ? ['-vf', `scale=${size.out[0]}:${size.out[1]}:flags=lanczos`] : []),
    '-c:v', 'libx264', '-preset', 'slow', '-tune', 'animation', '-crf', String(size.crf), '-g', String(FPS * 10),
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', out,
  ]);
  rmSync(dir, { recursive: true, force: true });
  manifest[key] = { d: Number((n / FPS).toFixed(2)), c: captions };
  const kb = Math.round(readFileSync(out).length / 1024);
  console.log(`${key}.mp4  ${(n / FPS).toFixed(1)} s  ${kb} KB  · ${captions.length} lines`);
  return kb;
};

/* ---- THE RUN -------------------------------------------------------------------------------------------------------- */

if (!existsSync(FFMPEG) && FFMPEG !== 'ffmpeg') throw new Error(`No ffmpeg at ${FFMPEG}`);
/* the films this run makes — merged into the file on disk after each one */
const manifest = {};
/* Chrome where it is installed; else the Chromium Playwright brings (PW_CHROMIUM names another) */
const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}));
let made = 0;
let kb = 0;
for (const size of SIZES) {
  for (const theme of THEMES) {
    for (const path of PAGES) {
      try {
        kb += await film(browser, path, theme, size, manifest);
        made++;
        /* written after each film, merged with what is on disk (two runs may film side by side), keys in a stable order,
           so a stopped run keeps what it made */
        const disk = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};
        const all = { ...disk, ...manifest };
        writeFileSync(MANIFEST, JSON.stringify(Object.fromEntries(Object.entries(all).sort(([a], [b]) => a.localeCompare(b))), null, 1) + '\n');
      } catch (e) {
        console.log(`${slug(path)}-${theme}-${size.form}: not filmed — ${String(e).split('\n')[0]}`);
      }
    }
  }
}
console.log(`\n${made} films · ${(kb / 1024).toFixed(1)} MB in public/landing/clips`);
await browser.close();
