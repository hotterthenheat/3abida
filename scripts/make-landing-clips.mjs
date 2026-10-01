/*
  THE LANDING'S FILMS (2026-10-01) — `npm run landing:clips`, with the dev server up.

  The owner, of the stills: "why are my photos just a photo and dont move so you cant see all the features my website
  offers?" — and then, of the films that followed: "it should just be a cursor make it a sped up version of you actually
  using the desk". So every page the tour names is FILMED, not drawn: the real terminal, staged exactly as its still is
  (landing-stage.mjs — the same first visit, the same steps a reader takes), and then USED, at three times its own speed,
  by a pointer and nothing else — no words over it, no ring where it presses, no bar: a timeframe changed and changed
  back, a menu opened and a choice made, a name typed into the search, a price dragged, a desk switched, a day opened.
  The live feed keeps moving underneath, three times as fast as well: prints arrive, candles grow, the book redraws.

  ONE MOMENT FOR EVERY FILM. The page's clock is set to the same minute of an open market (AT, in New York's zone, as the
  terminal reads the market), so every desk is filmed on the same day with the same prices (a name's history is drawn
  from that day: core/simulator.ts), and every film's mark says live.

  HOW IT IS FILMED. The page's clock is held (Playwright's clock: Date, timers and animation frames, in the terminal's own
  frame too) and stepped SPEED thirtieths of a second at a time; after each step the screen is taken at device pixels. So a
  film is a smooth 30 frames a second however long a picture takes to take, and the charts are drawn at the picture's
  own density (a screencast is capped at the page's CSS size, and scaling the page up blurred every canvas — both
  measured). The frames are encoded to H.264 (MP4, which every browser plays, a phone's too).

  A FILM LOOPS WITHOUT A SEAM: whatever a film changes it changes back before it ends (the timeframe, the choice in a
  menu, the desk, the side of the chain), the pointer goes home and fades, and the last frame is the first one again.

  WHAT IT WRITES, per page, theme and size —
      public/landing/clips/<page>-<theme>-<desk|phone>.mp4    the film
      public/landing/<page>-<theme>-<desk|phone>.webp         its first frame, the still the landing shows until it plays
      src/pages/landing/clips.json                            each film's length
  and for each room on the landing's wall (the hero's eight screens: ROOM_PAGES), from the desk film —
      public/landing/wall/clips/<page>-<theme>.mp4            a small copy, 640 wide
      public/landing/wall/<page>-<theme>.webp                 its first frame

  The encoder is ffmpeg with libx264: FFMPEG names one, else `ffmpeg` on the PATH. After the address: pages ("/terrain"),
  a size ("desk" | "phone"), a theme ("dark" | "light") — as landing:shots takes them. PREVIEW=1 films an act small and
  quick into the system's temp folder, to check it — nothing in public/ or src/ is touched.
*/
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { ALL_PAGES, ROOM_PAGES, SEED, PREPARE, slug } from './landing-stage.mjs';

const BASE = process.argv[2] ?? 'http://localhost:5199';
const ARGS = process.argv.slice(3);
const ONLY = ARGS.filter(a => a.startsWith('/'));
const FORMS = ARGS.filter(a => a === 'desk' || a === 'phone');
const ONLY_THEMES = ARGS.filter(a => a === 'dark' || a === 'light');
const FFMPEG = process.env.FFMPEG ?? 'ffmpeg';
const PREVIEW = !!process.env.PREVIEW;
const PUBLIC = PREVIEW ? resolve(tmpdir(), 'slayer-clip-preview') : resolve(process.cwd(), 'public/landing');
const CLIPS = resolve(PUBLIC, 'clips');
const WALL = resolve(PUBLIC, 'wall');
const MANIFEST = PREVIEW ? resolve(PUBLIC, 'clips.json') : resolve(process.cwd(), 'src/pages/landing/clips.json');
mkdirSync(CLIPS, { recursive: true });
mkdirSync(resolve(WALL, 'clips'), { recursive: true });

const PAGES = ALL_PAGES.filter(p => !ONLY.length || ONLY.includes(p));
const THEMES = ['dark', 'light'].filter(t => !ONLY_THEMES.length || ONLY_THEMES.includes(t));
/* a desk's screen at 1.5 device pixels a point, as its still; a phone's at two — the film is what a phone's window shows,
   and at two it is sharp in a 390-point band at a fraction of the frames' cost (three took as long as a desk's) */
const SIZES = [
  { form: 'desk', w: 1440, h: 1000, dpr: PREVIEW ? 0.75 : 1.5, crf: 28 },
  { form: 'phone', w: 390, h: 760, dpr: PREVIEW ? 1 : 2, crf: 27 },
].filter(z => !FORMS.length || FORMS.includes(z.form));
const FPS = 30;
/** how much faster than life the films run: each frame is SPEED thirtieths of a second of the page's time */
const SPEED = 3;
/** the minute every film is set in: a Thursday afternoon, the market open (13:42 in New York) — a day with reports on the
    earnings board (the week's reports are drawn per day: on the Wednesday before, the board held one) */
const AT = '2026-10-01T17:42:00Z';
/* where the pointer rests when it is not working: low on the right, out of the way of every page's head */
const HOME = size => [size.w * 0.84, size.h * 0.9];

/* ---- WHERE THE POINTER GOES ---------------------------------------------------------------------------------------- */

/* what stands under the phone's top bar is out of reach: the bar is over it */
const top = size => (size.form === 'phone' ? 48 : 2);
/* The boxes of everything matching `sel` that stand on the screen — under the phone's top bar and inside the frame */
const boxes = async ({ frame, size }, sel) =>
  (await frame.locator(sel).evaluateAll(els =>
    els.map(e => {
      const r = e.getBoundingClientRect();
      const s = getComputedStyle(e);
      return [r.x, r.y, r.width, r.height, s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05];
    })
  ).catch(() => []))
    .filter(([x, y, w, h, shown]) => shown && w > 2 && h > 2 && y + h > top(size) && y < size.h - 14 && x < size.w - 6 && x + w > 6)
    .map(([x, y, w, h]) => [x, y, w, h]);

/** A point on the n-th element matching `sel` that is on screen: `n` counts from the top (or from the end, below zero),
    'mid' is the one nearest the screen's middle; `fx`, `fy` place the point inside its box. */
const on = (sel, n = 0, fx = 0.5, fy = 0.5) => async ctx => {
  const all = await boxes(ctx, sel);
  if (!all.length) return null;
  let i = n === 'mid' ? all.reduce((best, b, k) => (Math.abs(b[1] + b[3] / 2 - ctx.size.h / 2) < Math.abs(all[best][1] + all[best][3] / 2 - ctx.size.h / 2) ? k : best), 0) : n < 0 ? all.length + n : n;
  i = Math.max(0, Math.min(all.length - 1, i));
  const [x, y, w, h] = all[i];
  return [x + w * fx, y + h * fy];
};
/** …the one k on from the element nearest the screen's middle */
const near = (sel, k, fx = 0.5) => async ctx => {
  const all = (await boxes(ctx, sel)).filter(b => b[1] > 70 && b[1] + b[3] < ctx.size.h - 20);
  if (!all.length) return null;
  const mid = all.reduce((best, b, j) => (Math.abs(b[1] - ctx.size.h / 2) < Math.abs(all[best][1] - ctx.size.h / 2) ? j : best), 0);
  const [x, y, w, h] = all[Math.max(0, Math.min(all.length - 1, mid + k))];
  return [x + w * fx, y + h / 2];
};
/** A button (or anything) whose own words are `words`, inside `scope` — the n-th of them on screen */
const btn = (words, scope = 'body', n = 0, fx = 0.5) => async ctx => {
  const want = String(typeof words === 'function' ? words(ctx) : words).trim().toLowerCase();
  if (!want) return null;
  const all = (await ctx.frame.locator(`${scope} button, ${scope} [role="button"], ${scope} [role="tab"]`).evaluateAll((els, want) =>
    els.filter(e => (e.textContent ?? '').replace(/\s+/g, ' ').trim().toLowerCase() === want).map(e => {
      const r = e.getBoundingClientRect();
      return [r.x, r.y, r.width, r.height];
    }), want).catch(() => []))
    .filter(([x, y, w, h]) => w > 2 && h > 2 && y + h > top(ctx.size) && y < ctx.size.h - 10 && x < ctx.size.w - 6 && x + w > 6);
  if (!all.length) return null;
  const [x, y, w, h] = all[Math.max(0, Math.min(all.length - 1, n < 0 ? all.length + n : n))];
  return [x + w * fx, y + h / 2];
};
/** The timeframe strip's button (the n-th strip on the page) — `words` may be read off what the film remembered */
const tf = (words, n = 0) => async ctx => {
  const want = String((typeof words === 'function' ? words(ctx) : words) ?? '').trim().toLowerCase();
  if (!want) return null;
  const all = (await ctx.frame.locator('[role="group"][aria-label="Timeframe"]').nth(n).locator('button').evaluateAll((els, want) =>
    els.filter(e => (e.textContent ?? '').trim().toLowerCase() === want).map(e => {
      const r = e.getBoundingClientRect();
      return [r.x, r.y, r.width, r.height];
    }), want).catch(() => []))
    .filter(([, , w, h]) => w > 2 && h > 2);
  if (!all.length) return null;
  const [x, y, w, h] = all[0];
  return [x + w / 2, y + h / 2];
};
/** a point by fractions of the screen */
const at = (fx, fy) => async ({ size }) => [fx * size.w, fy * size.h];
/** a point off another, by points */
const off = (target, dx, dy) => async ctx => {
  const p = await target(ctx);
  return p && [p[0] + dx, p[1] + dy];
};

/** the lines of a search box's open menu (Trace's FlowSearch: the names, then a name's contracts) */
const SEARCH_MENU = label => `div.relative:has(> div > input[aria-label="${label}"]) > div.absolute button`;

/** A phone's chart wears its timeframe as one button that opens the strip (ChartToolbar's compact form): what it says now */
const tfButtonNow = (n = 0) => async ({ frame }) =>
  frame.locator('button[title="Timeframe"]').nth(n).textContent({ timeout: 1500 }).then(t => t?.trim()).catch(() => null);
/** …and the beats that change it: the button pressed, a timeframe picked off the strip it opens */
const tfVia = (words, n = 0) => [
  { press: on('button[title="Timeframe"]', n), dur: 0.5 }, { hold: 0.3 },
  { press: tf(words, 0), dur: 0.4 }, { hold: 0.7 },
];

/** What the n-th timeframe strip is set to now */
const tfNow = (n = 0) => async ({ frame }) =>
  frame.locator('[role="group"][aria-label="Timeframe"]').nth(n).locator('button[aria-pressed="true"]').first().textContent({ timeout: 1500 }).then(t => t?.trim()).catch(() => null);

/* ---- THE ACTS: what each desk is used for, in the order a reader would do it ---------------------------------------- */
/* A beat is one of
     { to, dur }                  the pointer glides there
     { press, dur }               it glides there (if a place is given) and presses
     { pick: id, option, dur }    it opens the menu `id` and makes a choice: words its line starts with, or a step from
                                  the choice already made (1: the next one); the choice it found is remembered…
     { unpick: id }               …and made again here, so the film ends on the menu it began on
     { type: 'NVDA' }             it types, a key at a time       { key: 'Enter' }   one key
     { scroll: px, dur }          the page scrolls by that much, as a wheel or a trackpad would (down is positive) — the page
                                  itself, never the chart under the pointer (a wheel over a chart zooms it)
     { scrollTo: sel, at, dur }   the page scrolls until `sel` stands `at` of the way down the screen
     { drag: to, dur }            it presses, glides there and lets go        { double: true }   a double-click where it is
     { remember: name, of }       a reading of the page, kept for a later beat (ctx.memo[name])
     { hold }                     it rests while the page works
   Durations are the film's seconds; the page lives SPEED times as fast beneath them. */
const DESK = {
  '/pulse': [
    { remember: 'tf', of: tfNow(0) },
    { to: on('[data-chart-ground]', 0, 0.35, 0.5), dur: 0.5 },
    { to: on('[data-chart-ground]', 0, 0.82, 0.38), dur: 0.9 },
    { press: tf('5m', 0), dur: 0.45 }, { hold: 0.7 },
    { to: on('[data-chart-ground]', 0, 0.55, 0.45), dur: 0.5 }, { to: on('[data-chart-ground]', 0, 0.85, 0.35), dur: 0.7 },
    { to: near('[data-ladder-row]', -3, 0.55), dur: 0.5 }, { to: near('[data-ladder-row]', 0, 0.55), dur: 0.4 }, { to: near('[data-ladder-row]', 3, 0.55), dur: 0.4 },
    { pick: 'ladder-strikes', option: 1, dur: 0.45 }, { hold: 0.8 },
    { to: on('[data-compass-card]', 0, 0.5, 0.45), dur: 0.5 }, { to: on('[data-compass-card]', 1, 0.5, 0.45), dur: 0.4 }, { hold: 0.3 },
    { press: btn('The Day Ahead'), dur: 0.55 }, { hold: 1.0 },
    { to: at(0.55, 0.45), dur: 0.5 }, { to: at(0.8, 0.6), dur: 0.5 },
    { press: btn('Market Structure'), dur: 0.55 }, { hold: 0.6 },
    { unpick: 'ladder-strikes' },
    { press: tf(c => c.memo.tf, 0), dur: 0.5 }, { hold: 0.4 },
  ],
  '/pulse/board': [
    { remember: 'tf1', of: tfNow(1) },
    { remember: 'tf3', of: tfNow(3) },
    { to: on('[data-chart-ink]', 0, 0.3, 0.55), dur: 0.5 }, { to: on('[data-chart-ink]', 0, 0.85, 0.4), dur: 0.8 },
    { press: tf('5m', 1), dur: 0.5 }, { hold: 0.6 },
    { to: on('[data-chart-ink]', 1, 0.3, 0.5), dur: 0.4 }, { to: on('[data-chart-ink]', 1, 0.85, 0.42), dur: 0.8 },
    { to: on('[data-chart-ink]', 2, 0.3, 0.5), dur: 0.5 }, { to: on('[data-chart-ink]', 2, 0.85, 0.45), dur: 0.8 },
    { press: tf('1h', 3), dur: 0.55 }, { hold: 0.7 },
    { to: on('[data-chart-ink]', 3, 0.3, 0.5), dur: 0.4 }, { to: on('[data-chart-ink]', 3, 0.85, 0.45), dur: 0.8 },
    { press: tf(c => c.memo.tf3, 3), dur: 0.5 }, { hold: 0.3 },
    { press: tf(c => c.memo.tf1, 1), dur: 0.6 }, { hold: 0.4 },
  ],
  '/compass': [
    { to: on('[data-compass-card]', 0, 0.5, 0.45), dur: 0.5 }, { hold: 0.3 },
    /* only a card not yet chosen is pressed — a chosen card's second press opens its page */
    { press: on('[data-compass-card]:not([data-selected])', 1, 0.45, 0.4), dur: 0.45, unless: '[data-compass-card][data-selected]' }, { hold: 0.6 },
    { to: on('[title^="Open "][title*="full analysis"]', 1, 0.5), dur: 0.5 }, { to: on('[title^="Open "][title*="full analysis"]', 3, 0.5), dur: 0.4 }, { hold: 0.3 },
    { press: on('[data-compass-card]:not([data-selected])', 2, 0.45, 0.4), dur: 0.5, unless: '[data-compass-card][data-selected]' }, { hold: 0.6 },
    { pick: 'compass-kind', option: 1, dur: 0.5 }, { hold: 1.0 },
    { to: on('[data-compass-card]', 1, 0.5, 0.45), dur: 0.5 }, { hold: 0.3 },
    { unpick: 'compass-kind' }, { hold: 0.5 },
    /* the card the board opened on, chosen again — unless the board already has it (a second press opens its page) */
    { press: c => on(`[data-compass-card="${c.memo.sel}"]:not([data-selected])`, 0, 0.45, 0.4)(c), dur: 0.5, optional: true, unless: '[data-compass-card][data-selected]' }, { hold: 0.4 },
  ],
  '/compass/tracker': [
    { to: at(0.3, 0.25), dur: 0.5 }, { to: at(0.62, 0.25), dur: 0.6 }, { hold: 0.3 },
    { press: btn('Table'), dur: 0.55 }, { hold: 0.9 },
    { to: at(0.4, 0.3), dur: 0.5 }, { to: at(0.7, 0.36), dur: 0.6 }, { hold: 0.4 },
    { press: btn('Cards'), dur: 0.6 }, { hold: 0.6 },
    { to: at(0.85, 0.25), dur: 0.6 }, { hold: 0.4 },
  ],
  '/terrain': [
    { to: on('[data-chart-ink]', 0, 0.3, 0.6), dur: 0.5 }, { to: on('[data-chart-ink]', 0, 0.85, 0.48), dur: 0.9 },
    { press: on('[data-profile-view="net"]', 0), dur: 0.5 }, { hold: 0.7 },
    { to: off(on('[data-profile-view="net"]', 0), 20, 280), dur: 0.5 }, { to: off(on('[data-profile-view="net"]', 0), 20, 420), dur: 0.5 },
    { press: on('[data-profile-view="ladder"]', 0), dur: 0.55 }, { hold: 0.5 },
    { press: on('button[aria-label="3 charts"]', 0), dur: 0.6 }, { hold: 1.0 },
    { to: on('[data-chart-ink]', 2, 0.4, 0.5), dur: 0.5 }, { to: on('[data-chart-ink]', 2, 0.85, 0.45), dur: 0.7 },
    { press: on('button[aria-label="2 charts"]', 0), dur: 0.6 }, { hold: 0.6 },
    { to: on('[data-chart-ink]', 1, 0.3, 0.55), dur: 0.5 }, { to: on('[data-chart-ink]', 1, 0.85, 0.45), dur: 0.8 },
  ],
  '/pinpoint/map': [
    { to: near('[data-matrix-row] [data-matrix-leg="net"]', -2, 0.6), dur: 0.45 }, { to: near('[data-matrix-row] [data-matrix-leg="net"]', 1, 0.6), dur: 0.4 }, { hold: 0.3 },
    { pick: 'ledger-view', option: 'Calendar', dur: 0.55 }, { hold: 1.1 },
    { to: at(0.45, 0.45), dur: 0.5 }, { to: at(0.62, 0.55), dur: 0.5 }, { hold: 0.3 },
    { pick: 'ledger-strikes', option: 1, dur: 0.5 }, { hold: 0.9 },
    { unpick: 'ledger-strikes' },
    { unpick: 'ledger-view' }, { hold: 0.6 },
    { to: near('[data-matrix-row] [data-matrix-leg="net"]', 3, 0.6), dur: 0.5 }, { hold: 0.4 },
  ],
  '/pinpoint/building': [
    { to: on('[data-build-row]', 0, 0.3), dur: 0.45 }, { to: on('[data-build-row]', 2, 0.6), dur: 0.4 }, { hold: 0.2 },
    /* a fold of steady strikes opened (it has no close: the order's switch below lays the rows out afresh) */
    { press: on('[data-build-fold]', 0, 0.5), dur: 0.5 }, { hold: 0.9 },
    { to: on('[data-build-row]', 1, 0.55), dur: 0.4 }, { to: on('[data-build-row]', 4, 0.8), dur: 0.4 }, { hold: 0.3 },
    { pick: 'build-order', option: 1, dur: 0.5 }, { hold: 1.0 },
    { to: on('[data-build-row]', 2, 0.5), dur: 0.4 }, { hold: 0.3 },
    { unpick: 'build-order' }, { hold: 0.5 },
  ],
  '/pinpoint/wall': [
    { to: on('[data-wall-beam]', 0, 0.3, 0.5), dur: 0.5 }, { to: on('[data-wall-beam]', 0, 0.7, 0.5), dur: 0.6 },
    { to: on('[data-wall-factor]', 0, 0.4), dur: 0.4 }, { to: on('[data-wall-factor]', 2, 0.4), dur: 0.35 },
    { pick: 'wall-pick', option: 1, dur: 0.5 }, { hold: 1.0 },
    { to: on('[data-wall-paths]', 0, 0.35, 0.6), dur: 0.5 }, { to: on('[data-wall-paths]', 0, 0.75, 0.35), dur: 0.6 },
    /* a wall picked becomes the page's focus (the chip in its head): letting go of it is what puts the page back on its
       own wall — picking the first wall again left the chip standing at the film's end */
    { press: on('button[aria-label="Let go of the strike"]', 0), dur: 0.6 }, { hold: 0.6 },
    { to: on('[data-wall-factor]', 3, 0.4), dur: 0.5 }, { hold: 0.3 },
  ],
  '/pinpoint/compare': [
    { to: on('[data-h2h-row]', 0, 0.35), dur: 0.45 }, { to: on('[data-h2h-row]', 3, 0.6), dur: 0.4 },
    { press: on('[data-h2h-swap]', 0), dur: 0.5 }, { hold: 0.9 },
    { to: on('[data-h2h-row]', 1, 0.4), dur: 0.4 }, { to: on('[data-h2h-row]', 4, 0.65), dur: 0.4 },
    { press: on('[data-h2h-swap]', 0), dur: 0.5 }, { hold: 0.6 },
    { pick: 'compare-greek', option: 1, dur: 0.5 }, { hold: 1.0 },
    { unpick: 'compare-greek' }, { hold: 0.5 },
  ],
  '/trace/live-tape': [
    { to: on('[data-tape-body] .ag-row', 2, 0.3), dur: 0.5 }, { to: on('[data-tape-body] .ag-row', 6, 0.55), dur: 0.5 },
    { press: on('input[aria-label="Search by ticker or contract"]', 0, 0.4), dur: 0.55 },
    { type: 'NVDA' }, { hold: 0.3 },
    /* the name picked closes the menu — there is no second line to pick — and the tape narrows to it */
    { press: on(SEARCH_MENU('Search by ticker or contract'), 0, 0.3), dur: 0.4 }, { hold: 1.4 },
    { to: on('[data-tape-body] .ag-row', 1, 0.4), dur: 0.5 }, { to: on('[data-tape-body] .ag-row', 4, 0.6), dur: 0.4 },
    { press: on('button[aria-label="Clear search"]', 0), dur: 0.55 }, { hold: 0.5 },
    { pick: 'tape-kind', option: 1, dur: 0.55 }, { hold: 1.0 },
    { unpick: 'tape-kind' }, { hold: 0.4 },
  ],
  '/trace/net-flow': [
    { to: on('[data-menu-clip] canvas', 0, 0.2, 0.45), dur: 0.5 }, { to: on('[data-menu-clip] canvas', 0, 0.85, 0.4), dur: 1.0 },
    { press: on('[data-ticker]', 1), dur: 0.55 }, { hold: 0.8 },
    { to: on('[data-menu-clip] canvas', 0, 0.5, 0.5), dur: 0.5 }, { to: on('[data-menu-clip] canvas', 0, 0.8, 0.45), dur: 0.6 },
    { press: on('[data-ticker]', 3), dur: 0.5 }, { hold: 0.8 },
    { pick: 'pane-money', option: 1, dur: 0.5 }, { hold: 0.9 },
    { unpick: 'pane-money' },
    { press: on('button[aria-label="Clear search"]', 0), dur: 0.55 }, { hold: 0.5 },
  ],
  '/trace/dark-pool': [
    { to: on('[data-trace-grid] .ag-row', 1, 0.35), dur: 0.45 }, { to: on('[data-trace-grid] .ag-row', 4, 0.5), dur: 0.4 },
    { press: on('[data-dark-pool-shelf]', 0), dur: 0.5 }, { hold: 0.8 },
    { press: on('[data-dark-pool-shelf]', 3), dur: 0.45 }, { hold: 0.8 },
    { press: on('[data-dark-pool-shelf]', 3), dur: 0.3 }, { hold: 0.4 },
    { pick: 'dark-pool-size', option: 1, dur: 0.5 }, { hold: 0.9 },
    { to: on('[data-trace-grid] .ag-row', 2, 0.45), dur: 0.4 },
    { unpick: 'dark-pool-size' }, { hold: 0.5 },
  ],
  '/trace/screener': [
    { to: on('[data-trace-grid] .ag-row', 1, 0.3), dur: 0.45 }, { to: on('[data-trace-grid] .ag-row', 4, 0.45), dur: 0.4 },
    { pick: 'screener-screen', option: 1, dur: 0.55 }, { hold: 1.0 },
    { to: on('[data-trace-grid] .ag-row', 2, 0.4), dur: 0.4 }, { to: on('[data-trace-grid] .ag-row', 5, 0.6), dur: 0.4 },
    { pick: 'screener-side', option: 1, dur: 0.5 }, { hold: 0.9 },
    { unpick: 'screener-side' },
    { unpick: 'screener-screen' }, { hold: 0.5 },
  ],
  '/weigher': [
    { to: on('[data-chain-grid] .ag-row', 'mid', 0.3), dur: 0.5 }, { to: on('[data-chain-grid] .ag-row', 'mid', 0.7), dur: 0.4 },
    { to: on('[data-price-ruler]', 0, 0.5, 0.5), dur: 0.55 },
    { drag: on('[data-price-ruler]', 0, 0.22, 0.5), dur: 1.0 }, { hold: 0.4 },
    { drag: on('[data-price-ruler]', 0, 0.86, 0.5), dur: 1.2 }, { hold: 0.4 },
    { press: btn('By price'), dur: 0.5 }, { hold: 0.8 },
    { press: btn('By date'), dur: 0.4 }, { hold: 0.3 },
    /* a double-click glides the ruler home to the market's price (PriceRuler) */
    { to: on('[data-price-ruler]', 0, 0.62, 0.5), dur: 0.5 }, { double: true }, { hold: 0.9 },
    { pick: 'weigher-side', option: 1, dur: 0.55 }, { hold: 0.8 },
    { unpick: 'weigher-side' }, { hold: 0.4 },
  ],
  '/dossier/news': [
    { to: on('[data-news-pin]', 0), dur: 0.5 }, { to: on('[data-news-pin]', 2), dur: 0.45 }, { hold: 0.3 },
    { press: on('[data-news-tape-step="on"]', 0), dur: 0.5 }, { hold: 0.3 }, { press: true }, { hold: 0.5 },
    { press: on('[data-news-kind="Earnings"]', 0), dur: 0.55 }, { hold: 0.9 },
    { press: on('[data-news-row]', 1, 0.4), dur: 0.5 }, { hold: 0.9 },
    { press: on('[data-news-kind="all"]', 0), dur: 0.55 }, { hold: 0.5 },
    { press: on('[data-news-row]', 0, 0.4), dur: 0.5 }, { hold: 0.7 },
    /* a story flies the map to where it lands; Fit glides it home to the whole world, as the page opened */
    { press: on('[data-news-map-fit]', 0), dur: 0.5 }, { hold: 0.6 },
  ],
  '/dossier/earnings': [
    { to: on('[data-earnings-card]', 0), dur: 0.5 }, { to: on('[data-earnings-card]', 2), dur: 0.4 }, { to: on('[data-earnings-card]', 3), dur: 0.35 },
    { pick: 'earnings-week', option: 1, dur: 0.55 }, { hold: 1.0 },
    { to: on('[data-earnings-card]', 1), dur: 0.45 }, { to: on('[data-earnings-grid] .ag-row', 1, 0.5), dur: 0.45 },
    { pick: 'earnings-layout', option: 1, dur: 0.55 }, { hold: 0.9 },
    { unpick: 'earnings-layout' },
    { unpick: 'earnings-week' }, { hold: 0.5 },
  ],
  '/dossier/insiders': [
    { to: on('[data-insiders-grid] .ag-row', 1, 0.3), dur: 0.5 },
    { press: on('[data-insiders-name]', 1), dur: 0.5 }, { hold: 0.9 },
    { to: on('[data-insiders-grid] .ag-row', 0, 0.5), dur: 0.45 }, { hold: 0.3 },
    { press: on('[data-insiders-name]', 1), dur: 0.5 }, { hold: 0.4 },
    { press: on('[data-insiders-name]', 4), dur: 0.45 }, { hold: 0.8 },
    { press: on('[data-insiders-name]', 4), dur: 0.3 }, { hold: 0.3 },
    { pick: 'insiders-window', option: -1, dur: 0.55 }, { hold: 0.9 },
    { unpick: 'insiders-window' }, { hold: 0.4 },
  ],
  '/dossier/congress': [
    { to: on('[data-congress-grid] .ag-row', 1, 0.35), dur: 0.5 },
    { press: on('[data-congress-report]', 0), dur: 0.5 }, { hold: 0.9 },
    { to: on('[data-congress-grid] .ag-row', 0, 0.5), dur: 0.45 }, { hold: 0.3 },
    { press: on('[data-congress-report]', 0), dur: 0.5 }, { hold: 0.4 },
    { pick: 'congress-chamber', option: 1, dur: 0.55 }, { hold: 0.9 },
    { to: on('[data-congress-grid] .ag-row', 3, 0.45), dur: 0.45 },
    { unpick: 'congress-chamber' }, { hold: 0.5 },
  ],
  '/dossier/stocks': [
    { to: on('[data-stocks-grid] .ag-row', 1, 0.3), dur: 0.5 },
    { press: on('[data-stocks-sector]', 0), dur: 0.5 }, { hold: 0.8 },
    { press: on('[data-stocks-sector]', 7), dur: 0.5 }, { hold: 0.8 },
    { to: on('[data-stocks-grid] .ag-row', 1, 0.45), dur: 0.45 },
    { press: on('[data-stocks-sector]', 7), dur: 0.45 }, { hold: 0.4 },
    { pick: 'stocks-screen', option: 1, dur: 0.55 }, { hold: 0.9 },
    { unpick: 'stocks-screen' }, { hold: 0.5 },
  ],
  '/practice/paper': [
    { remember: 'tf', of: tfNow(0) },
    { to: on('[data-chart-ground]', 0, 0.35, 0.55), dur: 0.5 }, { to: on('[data-chart-ground]', 0, 0.7, 0.4), dur: 0.7 },
    { press: tf('5m', 0), dur: 0.5 }, { hold: 0.6 },
    { to: on('[data-chart-position]', 0, 0.5, 0.5), dur: 0.55 }, { hold: 0.2 },
    { drag: off(on('[data-chart-position]', 0, 0.5, 0.5), 0, -66), dur: 0.7 }, { hold: 0.4 },
    { to: on('[data-chart-position]', 0, 0.5, 0.5), dur: 0.4 },
    { drag: off(on('[data-chart-position]', 0, 0.5, 0.5), 0, 58), dur: 0.7 }, { hold: 0.6 },
    { to: near('[data-paper-chain-grid] .ag-row', -2, 0.5), dur: 0.5 }, { to: near('[data-paper-chain-grid] .ag-row', 1, 0.5), dur: 0.35 },
    { press: on('[data-paper-chain-side-pick="P"]', 0), dur: 0.5 }, { hold: 0.8 },
    { press: on('[data-paper-chain-side-pick="C"]', 0), dur: 0.4 }, { hold: 0.4 },
    { press: on('[data-chart-cancel="target"]', 0), dur: 0.55 }, { hold: 0.3 },
    { press: on('[data-chart-cancel="stop"]', 0), dur: 0.45 }, { hold: 0.3 },
    { press: tf(c => c.memo.tf, 0), dur: 0.55 }, { hold: 0.4 },
  ],
  '/practice/backtest': [
    { to: on('[data-chart-ground]', 0, 0.4, 0.5), dur: 0.5 }, { to: on('[data-chart-ground]', 0, 0.75, 0.4), dur: 0.6 },
    { press: on('[data-replay-step="on"]', 0), dur: 0.55 }, { hold: 0.35 },
    { press: true }, { hold: 0.35 }, { press: true }, { hold: 0.35 }, { press: true }, { hold: 0.6 },
    { to: on('[data-chain-row]', 3, 0.5), dur: 0.5 }, { to: on('[data-chain-row]', 6, 0.5), dur: 0.35 },
    { pick: 'review-side', option: 1, dur: 0.5 }, { hold: 0.8 },
    { unpick: 'review-side' }, { hold: 0.3 },
    { press: on('[data-replay-step="back"]', 0), dur: 0.6 }, { hold: 0.3 },
    { press: true }, { hold: 0.3 }, { press: true }, { hold: 0.3 }, { press: true }, { hold: 0.5 },
  ],
  '/practice/journal': [
    { press: on('[data-journal-day][data-trades]:not([data-trades="0"])', 3), dur: 0.55 }, { hold: 0.9 },
    { to: at(0.4, 0.9), dur: 0.5 }, { hold: 0.2 },
    { press: on('[data-journal-day][data-trades]:not([data-trades="0"])', 9), dur: 0.55 }, { hold: 0.6 },
    /* down to the day it opened: its trades, and how the day went */
    { scroll: 420, dur: 0.9 }, { to: at(0.5, 0.62), dur: 0.5 }, { to: at(0.75, 0.7), dur: 0.5 }, { hold: 0.5 },
    { scroll: -420, dur: 0.8 }, { hold: 0.2 },
    { press: on('[data-journal-day][data-trades]:not([data-trades="0"])', 13), dur: 0.5 }, { hold: 0.9 },
    { press: c => on(`[data-journal-day="${c.memo.day}"]`, 0)(c), dur: 0.55 }, { hold: 0.6 },
  ],
};

/* A PHONE'S ACTS: the same use at a phone's size — a menu or a switch, the page read down and back up */
const PHONE = {
  /* a phone's Pulse is one chart, full screen (Pulse.tsx): the chart is worked, not scrolled past */
  '/pulse': [
    { remember: 'tf', of: tfButtonNow(0) },
    { to: at(0.3, 0.42), dur: 0.5 }, { to: at(0.8, 0.36), dur: 0.8 },
    ...tfVia('5m'),
    { to: at(0.35, 0.45), dur: 0.5 }, { to: at(0.85, 0.4), dur: 0.8 }, { hold: 0.3 },
    ...tfVia(c => c.memo.tf),
  ],
  '/pulse/board': [
    { remember: 'tf', of: tfButtonNow(0) },
    { to: at(0.3, 0.38), dur: 0.5 }, { to: at(0.8, 0.34), dur: 0.7 },
    ...tfVia('5m'),
    { to: at(0.4, 0.36), dur: 0.4 }, { to: at(0.85, 0.32), dur: 0.6 },
    { scroll: 560, dur: 1.1 }, { hold: 0.3 }, { to: at(0.4, 0.5), dur: 0.5 }, { to: at(0.8, 0.45), dur: 0.6 },
    { scroll: -560, dur: 1.0 }, { hold: 0.2 },
    ...tfVia(c => c.memo.tf),
  ],
  '/compass': [
    { press: on('[data-compass-card]:not([data-selected])', 1, 0.45, 0.4), dur: 0.6, unless: '[data-compass-card][data-selected]' }, { hold: 0.7 },
    { scroll: 520, dur: 1.2 }, { hold: 0.6 },
    { scroll: -520, dur: 1.2 }, { hold: 0.3 },
    { press: c => on(`[data-compass-card="${c.memo.sel}"]:not([data-selected])`, 0, 0.45, 0.4)(c), dur: 0.55, optional: true, unless: '[data-compass-card][data-selected]' }, { hold: 0.5 },
  ],
  '/compass/tracker': [
    { press: btn('Table'), dur: 0.6 }, { hold: 0.9 },
    { scroll: 400, dur: 1.0 }, { hold: 0.4 }, { scroll: -400, dur: 1.0 },
    { press: btn('Cards'), dur: 0.6 }, { hold: 0.6 },
  ],
  '/terrain': [
    { remember: 'tf', of: tfButtonNow(0) },
    { to: at(0.3, 0.45), dur: 0.5 }, { to: at(0.8, 0.4), dur: 0.8 },
    ...tfVia('5m'),
    { to: at(0.35, 0.5), dur: 0.5 }, { to: at(0.85, 0.42), dur: 0.8 }, { hold: 0.3 },
    ...tfVia(c => c.memo.tf),
  ],
  '/pinpoint/map': [
    { scroll: 420, dur: 1.0 }, { hold: 0.3 },
    { to: near('[data-matrix-row] [data-matrix-leg="net"]', 0, 0.6), dur: 0.5 }, { to: near('[data-matrix-row] [data-matrix-leg="net"]', 3, 0.6), dur: 0.4 }, { hold: 0.4 },
    { scroll: 500, dur: 1.0 }, { hold: 0.4 },
    { scroll: -920, dur: 1.4 }, { hold: 0.4 },
  ],
  '/pinpoint/building': [
    { scroll: 360, dur: 1.0 }, { hold: 0.2 },
    { press: on('[data-build-fold]', 0, 0.5), dur: 0.6 }, { hold: 0.8 },
    { scroll: 300, dur: 0.9 }, { to: at(0.5, 0.5), dur: 0.5 }, { to: at(0.75, 0.62), dur: 0.5 }, { hold: 0.3 },
    { scroll: -660, dur: 1.2 }, { hold: 0.4 },
  ],
  '/pinpoint/wall': [
    { pick: 'wall-pick', option: 1, dur: 0.6 }, { hold: 0.9 },
    { scroll: 520, dur: 1.2 }, { hold: 0.5 }, { scroll: -520, dur: 1.1 },
    { press: on('button[aria-label="Let go of the strike"]', 0), dur: 0.6 }, { hold: 0.5 },
  ],
  '/pinpoint/compare': [
    { press: on('[data-h2h-swap]', 0), dur: 0.6 }, { hold: 0.9 },
    { scroll: 480, dur: 1.1 }, { hold: 0.4 }, { scroll: -480, dur: 1.0 },
    { press: on('[data-h2h-swap]', 0), dur: 0.55 }, { hold: 0.5 },
  ],
  '/trace/live-tape': [
    { press: on('input[aria-label="Search by ticker or contract"]', 0, 0.4), dur: 0.6 },
    { type: 'NVDA' }, { hold: 0.3 },
    /* the name picked closes the menu — there is no second line to pick — and the tape narrows to it */
    { press: on(SEARCH_MENU('Search by ticker or contract'), 0, 0.3), dur: 0.4 }, { hold: 1.4 },
    { scroll: 360, dur: 1.0 }, { hold: 0.4 }, { scroll: -360, dur: 0.9 },
    { press: on('button[aria-label="Clear search"]', 0), dur: 0.55 }, { hold: 0.6 },
  ],
  '/trace/net-flow': [
    { scroll: 330, dur: 1.0 }, { hold: 0.2 },
    { press: on('[data-ticker]', 1), dur: 0.55 }, { hold: 0.6 },
    /* the board stands over the pane on a phone: down to the picked name's session */
    { scroll: 360, dur: 0.9 }, { to: at(0.4, 0.6), dur: 0.5 }, { to: at(0.8, 0.55), dur: 0.6 }, { hold: 0.3 },
    { scroll: -690, dur: 1.2 }, { hold: 0.2 },
    { press: on('button[aria-label="Clear search"]', 0), dur: 0.55 }, { hold: 0.6 },
  ],
  '/trace/dark-pool': [
    { scroll: 380, dur: 1.0 }, { hold: 0.3 },
    { press: on('[data-dark-pool-shelf]', 1), dur: 0.55 }, { hold: 0.8 },
    { press: on('[data-dark-pool-shelf]', 1), dur: 0.35 }, { hold: 0.3 },
    { scroll: -380, dur: 1.0 }, { hold: 0.5 },
  ],
  '/trace/screener': [
    { pick: 'screener-screen', option: 1, dur: 0.6 }, { hold: 0.9 },
    { scroll: 380, dur: 1.0 }, { hold: 0.4 }, { scroll: -380, dur: 0.9 },
    { unpick: 'screener-screen' }, { hold: 0.5 },
  ],
  '/weigher': [
    { scroll: 460, dur: 1.0 }, { hold: 0.3 },
    { pick: 'weigher-side', option: 1, dur: 0.6 }, { hold: 0.8 },
    { unpick: 'weigher-side' }, { hold: 0.3 },
    { scroll: -460, dur: 1.0 }, { hold: 0.5 },
  ],
  '/dossier/news': [
    { press: on('[data-news-tape-step="on"]', 0), dur: 0.6 }, { hold: 0.3 }, { press: true }, { hold: 0.5 },
    { scroll: 600, dur: 1.3 }, { hold: 0.5 }, { scroll: -600, dur: 1.2 }, { hold: 0.4 },
  ],
  '/dossier/earnings': [
    { pick: 'earnings-week', option: 1, dur: 0.6 }, { hold: 0.9 },
    { scroll: 420, dur: 1.0 }, { hold: 0.3 }, { scroll: -420, dur: 0.9 },
    { unpick: 'earnings-week' }, { hold: 0.5 },
  ],
  '/dossier/insiders': [
    { press: on('[data-insiders-name]', 1), dur: 0.6 }, { hold: 0.8 },
    { scroll: 420, dur: 1.0 }, { hold: 0.3 }, { scroll: -420, dur: 0.9 },
    { press: on('[data-insiders-name]', 1), dur: 0.5 }, { hold: 0.5 },
  ],
  '/dossier/congress': [
    { press: on('[data-congress-report]', 0), dur: 0.6 }, { hold: 0.8 },
    { scroll: 420, dur: 1.0 }, { hold: 0.3 }, { scroll: -420, dur: 0.9 },
    { press: on('[data-congress-report]', 0), dur: 0.5 }, { hold: 0.5 },
  ],
  '/dossier/stocks': [
    { press: on('[data-stocks-sector]', 1), dur: 0.6 }, { hold: 0.8 },
    { scroll: 420, dur: 1.0 }, { hold: 0.3 }, { scroll: -420, dur: 0.9 },
    { press: on('[data-stocks-sector]', 1), dur: 0.5 }, { hold: 0.5 },
  ],
  '/practice/paper': [
    { to: on('[data-chart-ground]', 0, 0.4, 0.55), dur: 0.5 }, { to: on('[data-chart-ground]', 0, 0.75, 0.42), dur: 0.7 },
    { scroll: 560, dur: 1.2 }, { hold: 0.4 },
    { press: on('[data-paper-chain-side-pick="P"]', 0), dur: 0.55 }, { hold: 0.8 },
    { press: on('[data-paper-chain-side-pick="C"]', 0), dur: 0.45 }, { hold: 0.4 },
    { scroll: -560, dur: 1.1 }, { hold: 0.4 },
  ],
  /* the replay bar stands under the chart on a phone: down to it, a minute at a time on and back */
  '/practice/backtest': [
    { scroll: 400, dur: 1.0 }, { hold: 0.2 },
    { press: on('[data-replay-step="on"]', 0), dur: 0.6 }, { hold: 0.35 }, { press: true }, { hold: 0.35 }, { press: true }, { hold: 0.6 },
    { press: on('[data-replay-step="back"]', 0), dur: 0.5 }, { hold: 0.3 }, { press: true }, { hold: 0.3 }, { press: true }, { hold: 0.4 },
    { scroll: -400, dur: 0.9 }, { hold: 0.4 },
  ],
  '/practice/journal': [
    { scroll: 360, dur: 1.0 }, { hold: 0.2 },
    { press: on('[data-journal-day][data-trades]:not([data-trades="0"])', 3), dur: 0.6 }, { hold: 0.6 },
    /* the day opens under the year's figures: down to its trades, then shut again */
    { scrollTo: 'button[aria-label="Close the day"]', at: 0.22, dur: 1.5 }, { hold: 0.8 },
    { press: on('button[aria-label="Close the day"]', 0), dur: 0.5 }, { hold: 0.4 },
    { scroll: -4000, dur: 1.6 }, { hold: 0.4 },
  ],
};
/* the Journal's still is a day opened (landing-stage.mjs): the film keeps which, to end on it */
const REMEMBER = {
  '/practice/journal': [{ remember: 'day', of: async ({ frame }) => frame.locator('[data-journal-day][data-on]').first().getAttribute('data-journal-day', { timeout: 1500 }).catch(() => null) }],
};
/* the Compass board's chosen card, read before either act begins */
REMEMBER['/compass'] = [{ remember: 'sel', of: async ({ frame }) => frame.locator('[data-compass-card][data-selected]').first().getAttribute('data-compass-card', { timeout: 1500 }).catch(() => null) }];

/* ---- THE CAMERA ---------------------------------------------------------------------------------------------------- */

const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
/* the pointer: a plain arrow, white with a dark edge, so it reads on either ground */
const POINTER = `<svg width="22" height="28" viewBox="0 0 22 28"><path d="M2 2 L2 22 L7.5 17 L11 25.5 L14.5 24 L11 15.8 L18.5 15.8 Z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>`;

const webpOf = async (page, png, width) =>
  page.evaluate(async ([b64, width]) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = width ?? img.naturalWidth;
    c.height = Math.round((c.width / img.naturalWidth) * img.naturalHeight);
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, 'image/webp', 0.8));
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return btoa(s);
  }, [png, width]);

/* A PAGE IS READY when nothing on the screen is still on its way: no skeleton, nothing busy or "working", no "Awaiting
   feed", the fonts in and every picture drawn. A fixed wait was not enough (2026-10-01): the first films of a run met a
   dev server just started, and Pulse's clock was held on "Awaiting feed initialization…" (light) and on a widget's
   skeleton (dark) — the still under each film was that frame, and every loop flashed it. Waited out in real time, up to
   25 s; a page that never settles is filmed as it stands, and the run says so. */
const BUSY = '.skeleton, [data-skeleton], [aria-busy="true"], [data-working]';
const settled = page =>
  page
    .frameLocator('#t')
    .locator('body')
    .evaluate((body, busy) => {
      const onScreen = el => {
        if (!el.getClientRects().length) return false;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height || r.bottom <= 0 || r.right <= 0 || r.top >= innerHeight || r.left >= innerWidth) return false;
        return getComputedStyle(el).visibility !== 'hidden';
      };
      return {
        busy: [...document.querySelectorAll(busy)].filter(onScreen).length,
        waiting: /awaiting feed/i.test(body.innerText),
        pictures: [...document.images].filter(i => onScreen(i) && !i.complete).length,
        fonts: document.fonts.status,
      };
    }, BUSY)
    .catch(() => null);
const settle = async (page, label) => {
  const until = Date.now() + 25000;
  let s = null;
  while (Date.now() < until) {
    s = await settled(page);
    if (s && !s.busy && !s.waiting && !s.pictures && s.fonts === 'loaded') return true;
    await page.waitForTimeout(250);
  }
  console.log(`${label}: still loading after 25 s (${JSON.stringify(s)}) — filmed as it stands`);
  return false;
};

const film = async (browser, path, theme, size, manifest) => {
  const ctx = await browser.newContext({ viewport: { width: size.w, height: size.h }, deviceScaleFactor: size.dpr, timezoneId: 'America/New_York', locale: 'en-US' });
  await ctx.addInitScript(seed => {
    try {
      for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
    } catch {}
  }, SEED);
  await ctx.clock.install({ time: new Date(AT) });
  const page = await ctx.newPage();
  /* the stills' host (landing-stage): the terminal in a frame of the same origin, so it keeps its storage */
  await page.route(`${BASE}/__clip-host`, r =>
    r.fulfill({
      contentType: 'text/html',
      body: `<html><body style="margin:0;background:#000;overflow:hidden"><iframe id="t" src="${path}?embed=1&photo=1&theme=${theme}" style="border:0;display:block;width:${size.w}px;height:${size.h}px"></iframe>
<div id="cur" style="position:fixed;left:-2px;top:-2px;z-index:9;pointer-events:none;opacity:0;transform-origin:2px 2px;will-change:transform,opacity">${POINTER}</div></body></html>`,
    })
  );
  await page.goto(`${BASE}/__clip-host`);
  await page.waitForTimeout(size.form === 'desk' ? 6500 : 5500);
  const label = `${slug(path)}-${theme}-${size.form}`;
  await settle(page, label);
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
  const desk = size.form === 'desk';
  const beats = [...(REMEMBER[path] ?? []), ...((desk ? DESK : PHONE)[path] ?? [])];

  const dir = resolve(tmpdir(), `slayer-clip-${slug(path)}-${theme}-${size.form}-${process.pid}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const cdp = await ctx.newCDPSession(page);
  let n = 0;
  const start = rest && rest[0] > 0 && rest[0] < size.w && rest[1] > 0 && rest[1] < size.h ? rest : HOME(size);
  let pos = start;
  let cursor = 0;
  let pressAt = -99;
  const memo = { was: {}, words: {} };
  const c = { frame, size, page, memo };
  await page.mouse.move(pos[0], pos[1]);
  const shoot = async () => {
    const r = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 90, optimizeForSpeed: true, clip: { x: 0, y: 0, width: size.w, height: size.h, scale: size.dpr } });
    writeFileSync(resolve(dir, `f${String(n).padStart(5, '0')}.jpg`), Buffer.from(r.data, 'base64'));
    n++;
  };
  /* one frame: the pointer drawn (a press dips it a little, and it springs back), SPEED thirtieths of a second passed, the
     screen taken */
  /* A LOOP RUNS ON THE FILM'S CLOCK. The page's clock is held and stepped, but a CSS animation runs on the browser's own,
     and each frame takes a moment of real time to shoot: Trace's LIVE breath (1.4 s each way) pulsed every dozen frames
     and the mark's foil panned four times too fast (measured). Every animation that loops for ever is held, and stepped a
     frame's time at a time with the clock. One that ends is left to run — something may be waiting for its end. */
  const loops = dt =>
    frame
      .locator('body')
      .evaluate((_, dt) => {
        const held = (window.__filmHeld ??= new WeakSet());
        for (const a of document.getAnimations()) {
          if (a.effect?.getComputedTiming?.().iterations !== Infinity) continue;
          if (a.playState === 'running') {
            a.pause();
            held.add(a);
          } else if (held.has(a) && dt > 0) a.currentTime = (Number(a.currentTime) || 0) + dt;
        }
      }, dt)
      .catch(() => {});
  const step = async () => {
    const age = n - pressAt;
    const dip = age >= 0 && age < 6 ? 1 - 0.12 * Math.sin((age / 6) * Math.PI) : 1;
    await page.evaluate(
      ([x, y, o, k]) => {
        const el = document.getElementById('cur');
        el.style.transform = `translate(${x}px,${y}px) scale(${k})`;
        el.style.opacity = String(o);
      },
      [pos[0], pos[1], cursor, dip]
    );
    await ctx.clock.runFor((1000 / FPS) * SPEED);
    await loops((1000 / FPS) * SPEED);
    await shoot();
  };
  const frames = s => Math.max(1, Math.round(s * FPS));
  const fade = async (to, count) => {
    const from = cursor;
    for (let k = 1; k <= count; k++) {
      cursor = from + (to - from) * (k / count);
      await step();
    }
  };
  const glide = async (pt, dur = 0.5) => {
    const from = pos;
    const count = Math.max(2, frames(dur));
    for (let k = 1; k <= count; k++) {
      const e = ease(k / count);
      pos = [from[0] + (pt[0] - from[0]) * e, from[1] + (pt[1] - from[1]) * e];
      await page.mouse.move(pos[0], pos[1]);
      await step();
    }
  };
  const press = async () => {
    pressAt = n;
    await page.mouse.down();
    await step();
    await page.mouse.up();
    await step();
  };
  const idle = async s => {
    for (let k = 0; k < frames(s); k++) await step();
  };
  /* the page's own scroller: the terminal's <main> */
  const scroller = async () =>
    frame.locator('main').first().evaluate(m => ({ top: m.scrollTop, max: m.scrollHeight - m.clientHeight })).catch(() => ({ top: 0, max: 0 }));
  /* the lines of an open menu, and which of them is the choice already made (a menu of ticks keeps several) */
  const menuLines = id =>
    frame.locator(`[data-dropdown-card="${id}"] [role="menuitemradio"], [data-dropdown-card="${id}"] [role="menuitemcheckbox"], [data-dropdown-card="${id}"] [role="menuitem"]`).evaluateAll(els =>
      els.map(e => {
        const r = e.getBoundingClientRect();
        return { words: (e.textContent ?? '').replace(/\s+/g, ' ').trim(), on: e.getAttribute('data-state') === 'checked' || e.getAttribute('aria-checked') === 'true', tick: e.getAttribute('role') === 'menuitemcheckbox', box: [r.x, r.y, r.width, r.height] };
      })
    ).catch(() => []);
  /* A CHOICE IN A MENU, made as a reader makes it: the menu opened at its trigger, the line pressed. A radio menu closes on
     the press; a menu of ticks stays open and is closed by a press on its trigger. What was chosen before is remembered,
     so the film can make it again (a radio: the line that was on; ticks: the line that was ticked, ticked again). */
  const choose = async (id, option, dur, remember) => {
    const door = await on(`[data-dropdown="${id}"]`, 0, 0.5, 0.5)(c);
    if (!door) return idle(dur + 0.6);
    await glide(door, dur);
    await press();
    await idle(0.3);
    const lines = await menuLines(id);
    if (!lines.length) {
      await page.keyboard.press('Escape');
      return idle(0.2);
    }
    const ticks = lines.some(l => l.tick);
    const was = Math.max(0, lines.findIndex(l => l.on));
    const i =
      typeof option === 'number'
        ? (((was + option) % lines.length) + lines.length) % lines.length
        : typeof option === 'string'
          ? lines.findIndex(l => l.words.toLowerCase().startsWith(option.toLowerCase()))
          : option?.index ?? was;
    /* a choice to make again is found by its words first: a live list can re-order between the pick and the unpick, and
       its place alone then names another line (measured: a Wall film that came back on another wall) */
    const back = option?.words != null ? lines.findIndex(l => l.words === option.words) : -1;
    const k = back >= 0 ? back : i < 0 ? was : i;
    if (remember && memo.was[id] == null) {
      memo.was[id] = ticks ? k : was;
      memo.words[id] = lines[ticks ? k : was]?.words;
    }
    const [x, y, w, h] = lines[k].box;
    await glide([x + Math.min(w * 0.3, 60), y + h / 2], 0.35);
    await press();
    if (ticks) {
      await idle(0.45);
      await glide(door, 0.3);
      await press();
    }
  };

  /* the stage may have opened what loads in its turn: the frame is held only once that has drawn too */
  await settle(page, label);
  /* held at the page's own time — this process's clock and the page's are not the same one (measured: a hold at our
     "now" was in the page's past once) */
  /* (a busy page can let its clock run past a near mark while the call travels: "cannot fast-forward to the past" —
     measured on the Weigher; the mark is set further out when it does) */
  for (const ahead of [250, 2000, 8000]) {
    try {
      await ctx.clock.pauseAt((await page.evaluate(() => Date.now())) + ahead);
      break;
    } catch (e) {
      if (ahead === 8000) throw e;
    }
  }
  /* one frame's time before the first frame: what waited on the held clock (a chart's next draw, a panel's deferred
     mount) lands first, so the still is the film's own first frame and the second does not jump from it (measured on
     Pulse: frame 0 to 1 differed as much as a page loading, 33 dB, where every later pair stays near 57) */
  await loops(0);
  await ctx.clock.runFor((1000 / FPS) * SPEED);
  await loops((1000 / FPS) * SPEED);
  /* the first frame is the still: no pointer yet */
  await shoot();
  writeFileSync(resolve(dir, 'poster.png'), Buffer.from((await cdp.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: size.w, height: size.h, scale: size.dpr } })).data, 'base64'));
  await fade(1, 8);
  let missed = 0;
  for (const b of beats) {
    if (b.remember) {
      memo[b.remember] = await b.of(c);
      continue;
    }
    if (b.pick) {
      await choose(b.pick, b.option ?? 1, b.dur ?? 0.5, true);
      continue;
    }
    if (b.unpick) {
      if (memo.was[b.unpick] != null) await choose(b.unpick, { index: memo.was[b.unpick], words: memo.words[b.unpick] }, b.dur ?? 0.5, false);
      continue;
    }
    const target = typeof b.press === 'function' ? b.press : b.to ?? b.drag;
    if (target) {
      const pt = await target(c);
      if (pt) {
        if (b.drag) {
          pressAt = n;
          await page.mouse.down();
        }
        await glide(pt, b.dur ?? 0.5);
        if (b.drag) await page.mouse.up();
      } else {
        if (!b.optional) missed++;
        /* the page did not have it: the beat's time passes all the same */
        await idle(b.dur ?? 0.5);
        if (b.press) continue;
      }
    }
    if (b.press) {
      /* a press the act does not mean is held back: `unless` names what must not be under the pointer when the glide ends
         (the Compass board re-ranks live, and the card under the pointer can turn out to be the chosen one — whose
         second press opens its page: measured, a desk film that left the board for a setup's page and stayed there) */
      if (b.unless && (await frame.locator('body').evaluate((_, [x, y, sel]) => !!document.elementFromPoint(x, y)?.closest(sel), [pos[0], pos[1], b.unless]).catch(() => false))) {
        await idle(0.15);
        continue;
      }
      await press();
    }
    if (b.double) {
      pressAt = n;
      await page.mouse.dblclick(pos[0], pos[1]);
      await step();
      await step();
    }
    if (b.type) {
      for (const ch of b.type) {
        await page.keyboard.type(ch);
        await idle(0.1);
      }
    }
    if (b.key) {
      await page.keyboard.press(b.key);
      await step();
    }
    if (b.scrollTo) {
      const s0 = await scroller();
      const y = await frame.locator(b.scrollTo).first().evaluate((e, frac) => {
        const m = document.querySelector('main');
        return m.scrollTop + e.getBoundingClientRect().top - innerHeight * frac;
      }, b.at ?? 0.3).catch(() => null);
      if (y == null) missed++;
      const goal = y == null ? s0.top : Math.max(0, Math.min(s0.max, y));
      const count = frames(b.dur ?? 1);
      for (let k = 1; k <= count; k++) {
        await frame.locator('main').first().evaluate((m, y) => (m.scrollTop = y), s0.top + (goal - s0.top) * ease(k / count)).catch(() => {});
        await step();
      }
    }
    if (b.scroll) {
      const s0 = await scroller();
      const goal = Math.max(0, Math.min(s0.max, s0.top + b.scroll));
      const count = frames(b.dur ?? 1);
      for (let k = 1; k <= count; k++) {
        const y = s0.top + (goal - s0.top) * ease(k / count);
        await frame.locator('main').first().evaluate((m, y) => (m.scrollTop = y), y).catch(() => {});
        await step();
      }
    }
    if (b.hold) await idle(b.hold);
  }
  /* nothing left holding focus, as the page began: "Clear search" leaves its box focused, caret and all, and the film's
     last frame then met a first frame without it */
  await frame.locator('body').evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined)).catch(() => {});
  /* home, the pointer out, and the film ends on the frame it began on */
  await glide(start, 0.7);
  await fade(0, 8);
  await idle(0.2);

  /* the still: the first frame, as WebP, encoded by the browser itself */
  const png = readFileSync(resolve(dir, 'poster.png')).toString('base64');
  const key = `${slug(path)}-${theme}-${size.form}`;
  writeFileSync(resolve(PUBLIC, `${key}.webp`), Buffer.from(await webpOf(page, png), 'base64'));
  const room = desk && ROOM_PAGES.includes(path);
  if (room) writeFileSync(resolve(WALL, `${slug(path)}-${theme}.webp`), Buffer.from(await webpOf(page, png, 640), 'base64'));
  await ctx.close();

  const out = resolve(CLIPS, `${key}.mp4`);
  const encode = (to, crf, scale) =>
    execFileSync(FFMPEG, [
      '-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', resolve(dir, 'f%05d.jpg'),
      ...(scale ? ['-vf', `scale=${scale}:-2:flags=lanczos`] : []),
      '-c:v', 'libx264', '-preset', 'slow', '-tune', 'animation', '-crf', String(crf), '-g', String(FPS * 10),
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', to,
    ]);
  encode(out, size.crf);
  /* the wall's copy: a fifth of the pixels, for a screen a fifth of the size */
  if (room) encode(resolve(WALL, 'clips', `${slug(path)}-${theme}.mp4`), 31, 640);
  rmSync(dir, { recursive: true, force: true });
  manifest[key] = { d: Number((n / FPS).toFixed(2)) };
  const kb = Math.round(readFileSync(out).length / 1024);
  console.log(`${key}.mp4  ${(n / FPS).toFixed(1)} s  ${kb} KB${missed ? `  · ${missed} beat${missed > 1 ? 's' : ''} found nothing` : ''}${room ? '  · and the wall’s copy' : ''}`);
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
        writeFileSync(MANIFEST, JSON.stringify(Object.fromEntries(Object.entries(all).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, { d: v.d }])), null, 1) + '\n');
      } catch (e) {
        console.log(`${slug(path)}-${theme}-${size.form}: not filmed — ${String(e).split('\n')[0]}`);
      }
    }
  }
}
console.log(`\n${made} films · ${(kb / 1024).toFixed(1)} MB in ${CLIPS}`);
await browser.close();
