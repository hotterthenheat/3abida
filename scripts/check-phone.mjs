/*
  THE PHONE SWEEP (2026-09-19) — `npm run phone:check`, with the dev server up. The phone pass of 2026-09-13 deleted its
  probe and said "rewrite it"; this is it, kept, because every layout change since (the landing, the not-found pages, the
  phone menu, the drawing sheet) was a chance to break a phone.

  On EVERY route, at 360 (a small Android), 390 (an iPhone) and 768 (a tablet, where the side rail leaves a 532px column):

    SIDEWAYS SCROLL   the document, or the page's <main>, wider than the screen — and WHICH box pushed it
    SMALL TYPE IN A FIELD   an input under 16px: iOS zooms the whole page in when it is focused, and does not zoom back
    FAILED REQUESTS   anything the page asked for that answered 4xx/5xx or not at all
    PAGE ERRORS       uncaught exceptions

  Exits 1 on sideways scroll or a page error.
*/
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:5199';
const ONLY = process.argv.slice(3);
const ALL_ROUTES = [
  '/', '/pulse', '/pulse/board', '/terrain', '/compass', '/compass/tracker', '/weigher',
  '/trace/live-tape', '/trace/dark-pool', '/trace/screener', '/trace/net-flow', '/trace/footprints', '/trace/watchers', '/trace/intervals', '/trace/odte', '/trace/multi-leg', '/trace/compare', '/trace/tracker',
  '/pinpoint/map', '/pinpoint/ahead', '/pinpoint/building', '/pinpoint/wall', '/pinpoint/targets', '/pinpoint/board', '/pinpoint/compare',
  '/dossier/news', '/dossier/earnings', '/dossier/earnings/NVDA', '/dossier/insiders', '/dossier/congress', '/dossier/stocks', '/dossier/stocks/NVDA',
  '/practice/paper', '/practice/backtest', '/practice/futures', '/practice/journal', '/practice/backtest/not-a-session',
  '/community', '/settings/account', '/settings/billing', '/settings/data', '/settings/appearance', '/settings/desk', '/settings/keyboard', '/settings/about',
  '/pinpoint/not-a-page', '/not-a-page',
];
const ROUTES = ONLY.length ? ONLY : ALL_ROUTES;
const SIZES = [
  { name: '360', width: 360, height: 740 },
  { name: '390', width: 390, height: 844 },
  { name: '768', width: 768, height: 1024 },
];

const browser = await chromium.launch({ channel: 'chrome' });
let bad = 0;
const smallFields = new Map();
let covered = 0;
const failed = new Map();
for (const size of SIZES) {
  const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('slayer_theme', 'dark');
    } catch {}
  });
  const page = await ctx.newPage();
  let where = '';
  page.on('pageerror', e => {
    bad++;
    console.log(`  PAGE ERROR ${size.name} ${where}: ${String(e).slice(0, 160)}`);
  });
  page.on('response', r => {
    if (r.status() >= 400) failed.set(`${r.status()} ${new URL(r.url()).pathname}`, where);
  });
  page.on('requestfailed', r => {
    const u = r.url();
    if (!u.startsWith('data:') && !/\/@vite|hot-update/.test(u)) failed.set(`failed ${new URL(u).pathname}`, where);
  });
  const dirty = [];
  for (const route of ROUTES) {
    where = route;
    await page.goto(BASE + route, { waitUntil: 'load' });
    await page.waitForTimeout(route === '/' ? 4200 : 3000);
    const r = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const docOver = document.documentElement.scrollWidth - vw;
      const main = document.querySelector('main');
      const mainOver = main ? main.scrollWidth - main.clientWidth : 0;
      /* the pusher: the deepest box that reaches past the screen's right edge while every box above it lets it through */
      let pusher = null;
      if (docOver > 1 || mainOver > 1) {
        const limit = main ? main.getBoundingClientRect().right : vw;
        for (const el of document.querySelectorAll('body *')) {
          const b = el.getBoundingClientRect();
          if (b.width === 0 || b.right <= limit + 1) continue;
          let clipped = false;
          /* …up to <main>, which is the scroller itself — past it nothing clips */
          for (let p = el.parentElement; p && p !== document.body && p !== main; p = p.parentElement) {
            const o = getComputedStyle(p).overflowX;
            if (o !== 'visible') {
              clipped = true;
              break;
            }
          }
          if (!clipped) pusher = `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 70)} → right ${Math.round(b.right)}`;
        }
      }
      const fields = [...document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]):not([type=hidden]), textarea, select')]
        .filter(e => e.getBoundingClientRect().width > 0)
        .map(e => ({ px: parseFloat(getComputedStyle(e).fontSize), what: e.getAttribute('aria-label') || e.getAttribute('placeholder') || e.getAttribute('data-settings-field') || e.tagName.toLowerCase() }))
        .filter(f => f.px < 16);
      /* THE EMULATOR CANNOT BE A TOUCH SCREEN to CSS: it never matches `(hover: none)`, so the rule that makes every field
         16px on a phone (index.css, "a touch screen's two traps") does not apply in here and the fields read small. The
         sweep looks for the rule itself instead. */
      let touchRule = false;
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) if (rule instanceof CSSMediaRule && /hover:\s*none/.test(rule.conditionText) && /font-size:\s*16px/.test(rule.cssText)) touchRule = true;
        } catch {}
      }
      return { docOver, mainOver, pusher, fields, touchRule };
    });
    if (r.docOver > 1 || r.mainOver > 1) dirty.push(`${route}  doc +${r.docOver}px · main +${r.mainOver}px · ${r.pusher ?? 'pusher not found'}`);
    if (!r.touchRule) for (const f of r.fields) smallFields.set(`${f.what} (${f.px}px)`, route);
    else covered += r.fields.length;
  }
  console.log(`${size.name}px: ${ROUTES.length} routes · sideways scroll on ${dirty.length}`);
  for (const d of dirty) console.log('  ' + d);
  bad += dirty.length;
  await ctx.close();
}
console.log(`\nfields under 16px (iOS zooms the page on focus): ${smallFields.size}${covered ? ` · ${covered} small fields seen, all made 16px on a real phone by the touch rule in index.css` : ''}`);
for (const [f, route] of smallFields) console.log(`  ${f}  — ${route}`);
console.log(`\nfailed requests: ${failed.size}`);
for (const [f, route] of failed) console.log(`  ${f}  — first seen on ${route}`);
await browser.close();
process.exit(bad ? 1 : 0);
