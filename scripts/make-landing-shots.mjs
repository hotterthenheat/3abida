/*
  THE LANDING'S PICTURES (2026-09-19) — `npm run landing:shots`, with the dev server up.

  The landing's window shows STILLS of the terminal, not the terminal itself (Noah: "keep our interactive visuals but then
  make them static… a static image breeds mystery and desire"). They are still THE REAL THING — photographs of this app,
  never drawings: this opens every page the tour names, the way the landing's live window used to (the embed seam: the
  rail folded, no launch gate, no sound, the theme named by the address), and photographs it

      in both themes      the window turns with the page half way down the tour
      at two sizes        a desk's screen (1440 × 1000) and the terminal's own phone layout (390 × 760)

  into public/landing/<page>-<theme>-<desk|phone>.webp. The pages are READ FROM THE TOUR'S OWN LIST in Landing.tsx, so a
  page added to the tour is photographed the next time this runs. Re-run it when a page's look changes.

  WHAT EACH PAGE OPENS ON is a first-time visitor's terminal, with the exceptions Noah set by picture:
      Terrain      two charts side by side, SPY on the dark candles and QQQ on Stone, each with its strike rail open
      the Map      the ladder with all five greeks (its own first view since 2026-09-21), a row under the pointer with its card
      the Weigher  a desk in use (2026-09-20: "right now all 3 sections are blank") — contracts watched and positions held
                   across a few names, one position open in the card at the right; see PREPARE below
*/
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = process.argv[2] ?? 'http://localhost:5199';
/* after the address: pages to re-take ("/terrain"), and/or a size ("desk" | "phone"), and/or a theme ("dark" | "light") */
const ARGS = process.argv.slice(3);
const ONLY = ARGS.filter(a => a.startsWith('/'));
const FORMS = ARGS.filter(a => a === 'desk' || a === 'phone');
const ONLY_THEMES = ARGS.filter(a => a === 'dark' || a === 'light');
const OUT = resolve(process.cwd(), 'public/landing');
mkdirSync(OUT, { recursive: true });

const landing = readFileSync(resolve(process.cwd(), 'src/pages/landing/Landing.tsx'), 'utf8');
const PAGES = [...new Set([...landing.matchAll(/path: '(\/[a-z/-]+)'/g)].map(m => m[1]))].filter(p => !ONLY.length || ONLY.includes(p));

const SIZES = [
  { form: 'desk', w: 1440, h: 1000, dpr: 1.5 },
  /* three device pixels a point, as phones are: at two the picture was drawn soft on an iPhone (measured: 780px of picture on 1,068px of screen) */
  { form: 'phone', w: 390, h: 760, dpr: 3 },
];
const THEMES = ['dark', 'light'].filter(t => !ONLY_THEMES.length || ONLY_THEMES.includes(t));

/* what a page opens on, where a first-time visitor's terminal is not what the picture should be */
const SEED = {
  slayer_candle_theme_sky1: '1',
  slayer_terrain_sky1: '1',
  /* the Weigher's sash pulled up (its own control; 560 by default): the picture is 1,000px tall, and at the default the
     Watchlist card — the third thing the picture is there to show — starts below its edge */
  slayer_weigher_top: '360',
  /* THE PULSE DESK AS NOAH ARRANGED IT (2026-09-22, with his picture: "live chart on left, strike pressure ladder on
     right, compass on the bottom left and the earnings calendar on the bottom right"): the first desk, rearranged the
     way a reader would leave it — a desk saves as you go, so this is the state such a reader's desk is in */
  slayer_desks_v1: JSON.stringify({
    active: 'Market Structure',
    desks: {
      'Market Structure': {
        instances: [
          { id: 'live-chart-1', key: 'live-chart' },
          { id: 'gex-heatmap-1', key: 'gex-heatmap' },
          { id: 'top-setups-1', key: 'top-setups' },
          { id: 'earnings-1', key: 'earnings' },
        ],
        layout: [
          { i: 'live-chart-1', x: 0, y: 0, w: 6, h: 5 },
          { i: 'gex-heatmap-1', x: 6, y: 0, w: 6, h: 5 },
          { i: 'top-setups-1', x: 0, y: 5, w: 6, h: 5 },
          { i: 'earnings-1', x: 6, y: 5, w: 6, h: 5 },
        ],
      },
    },
  }),
  /* the drawing rail folded to its tab, as in Noah's picture — the chart is the subject */
  slayer_draw_rail: JSON.stringify({ dock: 'left', open: false }),
  slayer_terrain_v1: JSON.stringify({
    layout: 2,
    /* the rails read one expiry, two weeks out (his picture: "Oct 2") */
    railCut: 14,
    panes: [
      { ticker: 'SPY', timeframe: '15m', theme: 'glacier', ladder: true },
      { ticker: 'QQQ', timeframe: '15m', theme: 'stone', ladder: true },
    ],
  }),
};

export const slug = path => path.replace(/^\//, '').replace(/\//g, '-');

/* A PAGE THAT IS EMPTY FOR A FIRST-TIME VISITOR is set up by USING the terminal, the way a reader would — never by typing
   its storage by hand. The Tracker holds what you kept, so three setups are kept first: each is opened off the board and its
   "Track setup" pressed. */
const go = async (page, to, theme, wait = 4500) => {
  await page.evaluate(src => (document.getElementById('t').src = src), `${to}?embed=1&photo=1&theme=${theme}`);
  await page.waitForTimeout(wait);
};
const PREPARE = {
  /* THE LIVE TAPE, FULL (2026-09-22, Noah: "live tape on the landing page cuts off, it should read full"): a first visit's
     tape holds the prints of its first few seconds and the box grows with them, so the picture caught fourteen rows and
     a window of black under them. The tape is let run — nothing typed, nothing seeded — until its box reaches the
     window's foot, or 45 seconds pass. */
  '/trace/live-tape': async (page, theme, size) => {
    const frame = page.frameLocator('#t');
    const t0 = Date.now();
    while (Date.now() - t0 < 45000) {
      const bottom = await frame.locator('[data-tape-body]').evaluate(el => el.getBoundingClientRect().bottom).catch(() => 0);
      if (bottom >= size.h - 4) break;
      await page.waitForTimeout(800);
    }
    await page.waitForTimeout(600);
  },
  '/compass/tracker': async (page, theme) => {
    const frame = page.frameLocator('#t');
    await go(page, '/compass', theme, 5500);
    const ids = await frame.locator('[data-compass-card]').evaluateAll(els => els.slice(0, 3).map(e => e.getAttribute('data-compass-card')));
    for (const id of ids) {
      await go(page, `/compass/${id}`, theme, 5000);
      const track = frame.locator('[data-setup-track="off"]').first();
      if (await track.count()) await track.click();
      await page.waitForTimeout(500);
    }
    await go(page, '/compass/tracker', theme, 5500);
  },

  /* THE WEIGHER, IN USE (Noah, 2026-09-20: "i would like a few things to be in the your positions and watchlist sections
     with a position being opened up on the right. add a few different tickers"). A first-time visitor's desk is three
     empty cards — true, and no picture of what the desk is FOR. So the desk is used, by its own doors, the way a reader
     would: the name is switched on the chart's capsule, a strike is watched with the chain's +, a position is entered on
     the "Add a position" form. Nothing is typed into storage — every row is marked by the store at the tick it was added.
     The LAST thing entered is the position the card opens on (the desk picks a position the moment it is added).
     Desk only: the phone's picture ends above these cards. */
  '/weigher': async (page, theme, size) => {
    if (size.form !== 'desk') return;
    const frame = page.frameLocator('#t');
    const name = async sym => {
      await frame.locator('[data-weigher-desk] button[title="Switch ticker"]').first().click();
      const box = frame.getByPlaceholder('Search S&P 500 + more…');
      await box.fill(sym);
      await page.waitForTimeout(350);
      await box.press('Enter');
      /* the chain for the new name is built on the desk's sweep */
      await page.waitForTimeout(3800);
    };
    /* the strikes the chain has on screen, and the money between them */
    const ladder = () =>
      frame.locator('[data-chain-grid]').evaluate(grid => {
        const strikes = [...grid.querySelectorAll('[data-chain-watch]')].map(b => Number(b.getAttribute('data-chain-watch'))).sort((a, b) => a - b);
        const spot = Number((grid.querySelector('[data-chain-divider]')?.textContent ?? '').replace(/[^0-9.]/g, ''));
        return { strikes, spot };
      });
    /* `steps` strikes out of the money (calls: above the market; puts: below) — or, below zero, that many INTO it */
    const strikeOut = async (steps, side = 'C') => {
      const { strikes, spot } = await ladder();
      const above = strikes.filter(k => k > spot);
      const below = strikes.filter(k => k < spot).reverse();
      const [out, into] = side === 'C' ? [above, below] : [below, above];
      const from = steps >= 0 ? out : into;
      return from[Math.min(steps >= 0 ? steps : -steps - 1, from.length - 1)];
    };
    const watch = async steps => {
      const k = await strikeOut(steps);
      await frame.locator(`[data-chain-watch="${k}"]`).click();
      await page.waitForTimeout(700);
    };
    const enter = async ({ k, side, contracts, expires, paid }) => {
      await frame.locator('[data-add-position]').click();
      const form = frame.locator('[data-position-form]');
      await form.locator('[data-field="strike"]').fill(String(k));
      if (side === 'P') await form.getByRole('button', { name: 'Put', exact: true }).click();
      await form.locator('[data-field="contracts"]').fill(String(contracts));
      if (expires) {
        await form.locator('[data-field="expiry"]').click();
        await frame.locator('[data-quick-picks]').getByRole('button', { name: expires, exact: true }).click();
      }
      if (paid) await form.locator('[data-field="entry"]').fill(paid);
      await form.locator('[data-save-position]').click();
      await page.waitForTimeout(1200);
    };
    /* A POSITION BOUGHT EARLIER: entered once to learn what the desk marks that very contract at (its own expiry, not
       the chain's on screen), taken off, and entered again with what was paid — a share of that mark. Entered blank, a
       position is marked at the tick it was added and every return in the picture reads +$0. */
    const hold = async ({ steps, side = 'C', contracts, expires, paidShare }) => {
      const k = await strikeOut(steps, side);
      await enter({ k, side, contracts, expires });
      const newest = frame.locator('[data-list="positions"] .ag-row[row-index="0"]');
      const mark = Number(((await newest.locator('[col-id="mark"]').textContent()) ?? '').replace(/[^0-9.]/g, ''));
      if (!(mark > 0)) return;
      await newest.locator('[data-list-remove]').click();
      await page.waitForTimeout(900);
      await enter({ k, side, contracts, expires, paid: (mark * paidShare).toFixed(2) });
    };

    /* watched: four names (the list is newest first, and the picture ends three rows into it) */
    await name('AAPL');
    await watch(1);
    await name('AMD');
    await watch(2);
    await name('META');
    await watch(1);
    await name('QQQ');
    await watch(3);
    /* held: five names, some ahead and some behind — the last one entered is the one the card opens on. Next Friday, not
       the next session: a contract a day from its bell swings by half in the minute this takes */
    await name('SPY');
    await hold({ steps: 2, contracts: 10, expires: 'Next Friday', paidShare: 0.82 });
    await name('TSLA');
    await hold({ steps: 1, side: 'P', contracts: 3, expires: 'Next Friday', paidShare: 1.12 });
    await name('MSFT');
    await hold({ steps: 1, contracts: 2, expires: 'Monthly', paidShare: 0.9 });
    await name('COIN');
    await hold({ steps: 2, contracts: 4, expires: 'Next Friday', paidShare: 1.2 });
    /* the one the card opens on: a strike INSIDE the market, so the chain's market line stays in view above the picked
       row (picked above the line, the row's own details push the line out and the chain raises its "back to the market" pill) */
    await name('NVDA');
    await hold({ steps: -1, contracts: 5, expires: 'Next Friday', paidShare: 0.78 });
    /* the tape moves the marks a little before the picture is taken */
    await page.waitForTimeout(6000);
  },
};

/* REVIEW, IN USE (2026-09-20). A first-time visitor has no sessions: the page is an empty list — true, and no picture of
   what the room is FOR. So a session is run, by its own doors: the rules are picked on the form's cards, the session is
   started, the clock is played forward on its bar, a contract is bought off the chain, and (where there is a chart wide
   enough to do it on) a target and a stop are pulled off the position's own chip. Nothing is typed into storage. */
const reviewSession = async (page, size, { roundTrips = 0 } = {}) => {
  const frame = page.frameLocator('#t');
  const choose = async (card, words) => {
    await frame.locator(`[data-dropdown="${card}"]`).click();
    await page.waitForTimeout(350);
    await frame.locator(`[data-dropdown-card="${card}"]`).getByText(words, { exact: false }).first().click();
    await page.waitForTimeout(350);
  };
  if (size.form === 'desk') {
    await choose('review-rule-open', '3 positions');
    await choose('review-rule-risk', '5% of the account');
    await choose('review-rule-day', 'Down 3%');
  }
  await frame.locator('[data-review-start]').click();
  await frame.locator('[data-review-tape="page"]').waitFor({ timeout: 20000 });
  await page.waitForTimeout(2500);
  const top = () => frame.locator('main').evaluate(m => (m.scrollTop = 0));
  /* the clock, by its own track: a share of the day */
  const playTo = async share => {
    await top();
    const t = await frame.locator('[data-replay-track]').first().boundingBox();
    if (t) await page.mouse.click(t.x + t.width * share, t.y + t.height / 2);
    await page.waitForTimeout(1500);
  };
  /* the Order card is the paper desk's (2026-09-26): a press on Buy takes it at the ask */
  const buy = async row => {
    await frame.locator('[data-chain-row]').nth(row).click();
    await frame.locator('[data-order-act="buy"]').first().waitFor();
    await page.waitForTimeout(400);
    await frame.locator('[data-order-act="buy"]').first().click();
    await page.waitForTimeout(900);
    await top();
  };
  await playTo(0.16);
  /* closed trades for the journal and the book: in, a while on, out */
  for (let i = 0; i < roundTrips; i++) {
    await buy(11 + (i % 3));
    await playTo(0.2 + i * 0.07);
    /* out by the × on the chart's own chip: the book's Close is a far column, and a phone's grid does not draw those */
    await top();
    await frame.locator('[data-chart-close]').first().click();
    await page.waitForTimeout(900);
  }
  return { frame, top, playTo, buy };
};
/* THE MAP (2026-09-22): it opens on all five greeks by itself (MapDesk's pick), so nothing is picked — an earlier
   recipe that ticked "All five" would now untick it. What the picture adds is THE ROW UNDER THE POINTER (Noah: "the
   hover button should be visible in the screenshot"): a strike a few rows under spot is hovered, so its row lights and
   its card stands with the put, the call and the net. Desk only — a phone has no pointer. */
PREPARE['/pinpoint/map'] = async (page, theme, size) => {
  if (size.form !== 'desk') return;
  const frame = page.frameLocator('#t');
  /* the Map opens on the Exposure Matrix (2026-09-28): the pointer rests on the fourth row under spot, over its GEX net
     cell, so the still carries the row lit and the card beside it */
  await frame.locator('[data-matrix-row]').first().waitFor({ timeout: 15000 });
  const spot = await frame.locator('[data-matrix-spot]').boundingBox();
  const rows = frame.locator('[data-matrix-row]');
  const n = await rows.count();
  let target = null;
  for (let i = 0; i < n; i++) {
    const b = await rows.nth(i).boundingBox();
    if (b && spot && b.y > spot.y) { target = rows.nth(Math.min(n - 1, i + 3)); break; }
  }
  if (target) {
    const cell = await target.locator('[data-matrix-leg="net"]').first().boundingBox();
    if (cell) {
      await page.mouse.move(cell.x + cell.width * 0.6, cell.y + cell.height / 2, { steps: 6 });
      await page.waitForTimeout(900);
    }
  }
};

PREPARE['/practice/backtest'] = async (page, theme, size) => {
  const { frame, top, playTo, buy } = await reviewSession(page, size, { roundTrips: size.form === 'desk' ? 2 : 0 });
  /* the morning is played FIRST: what is bought last is what the picture is of, still open, its target and stop still working */
  await playTo(0.44);
  await buy(12);
  if (size.form === 'desk') {
    /* a target up and a stop down, pulled off the position's chip the way a reader would */
    for (const dy of [-64, 58]) {
      const c = await frame.locator('[data-chart-position]').first().boundingBox();
      if (!c) break;
      await page.mouse.move(c.x + 40, c.y + 11);
      await page.mouse.down();
      await page.mouse.move(c.x + 40, c.y + 11 + dy / 2, { steps: 5 });
      await page.mouse.move(c.x + 40, c.y + 11 + dy, { steps: 8 });
      await page.mouse.up();
      await page.waitForTimeout(800);
    }
    /* three minutes on, by the bar's own step: the figures move, and neither line is reached */
    for (let i = 0; i < 3; i++) await frame.locator('[aria-label="One step on"]').first().click();
    /* the ticket is left on a strike NOT held: its drop-down open in the chain, a buy on the ticket with the Spread choice —
       on the held one it says, in amber, that the contracts are spoken for (true, and not what the picture is of) */
    await frame.locator('[data-chain-row]').nth(10).click();
    await page.waitForTimeout(900);
  }
  await top();
  /* the pointer off the chart: no crosshair in the picture */
  await page.mouse.move(size.w - 10, 6);
  await page.waitForTimeout(1500);
};
/* THE JOURNAL, AS IT OPENS (2026-09-26): calendar first, on the sample September (data/paper/sample.ts) — a day opened on
   the desk form, so the picture shows what a press on a day gives */
PREPARE['/practice/journal'] = async (page, theme, size) => {
  const frame = page.frameLocator('#t');
  /* THE SAMPLE IS ONE MONTH'S (September 2026). Read in a later month (2026-10-01), "This month" and the calendar open on
     an empty one: the picture takes the year instead, and the calendar steps back, a month at a time, to the sample's */
  await frame.locator('[data-journal-month-prev]').waitFor({ timeout: 20000 });
  await page.waitForTimeout(800);
  if (!(await frame.locator('[data-journal-daybars]').count())) {
    await frame.getByRole('group', { name: 'Which period' }).getByRole('button', { name: 'This year', exact: true }).click();
    await page.waitForTimeout(800);
  }
  const traded = () => frame.locator('[data-journal-day]').evaluateAll(els => els.some(d => +d.getAttribute('data-trades') > 0));
  for (let back = 0; back < 12 && !(await traded()); back++) {
    await frame.locator('[data-journal-month-prev]').click();
    await page.waitForTimeout(500);
  }
  await frame.locator('[data-journal-daybars]').waitFor({ timeout: 20000 });
  await page.waitForTimeout(1500);
  if (size.form === 'desk') {
    const busiest = await frame.locator('[data-journal-day]').evaluateAll(els => els.sort((a, b) => +b.getAttribute('data-trades') - +a.getAttribute('data-trades'))[0]?.getAttribute('data-journal-day'));
    if (busiest) {
      await frame.locator(`[data-journal-day="${busiest}"]`).click();
      await page.waitForTimeout(1200);
    }
    await frame.locator('main').evaluate(m => (m.scrollTop = 0));
  }
  /* the pointer parked on empty ground: at the corner it raised the rail's "Home" tooltip over the page's title */
  await page.mouse.move(size.w * 0.6, size.h - 40);
  await page.waitForTimeout(600);
};
/* PAPER, IN USE (2026-09-26 — Noah, of the start page's two cards: "the page should be a look of the options papertrading
   not just some image of 2 boxes"). In the landing's window the paper store holds nothing; in THE PHOTOGRAPHER'S WINDOW
   (embed.ts PHOTO, the `photo=1` above) it may start a throwaway account and run it in memory. So, the way a reader would:
   a practice account of $25,000 started by the page's own door, a strike of SPY's chain opened, one call bought at the
   ask — the picture is the desk with the position on its chart and the strike's order open under it. */
PREPARE['/practice/paper'] = async (page, theme, size) => {
  const frame = page.frameLocator('#t');
  await frame.locator('[data-paper-start]').waitFor({ timeout: 20000 });
  await page.waitForTimeout(800);
  await frame.locator('[data-paper-start-size="25000"]').click();
  /* the paper chain is the Weigher's grid (AG Grid rows, `row-id` s<strike>), lowest strike first, the market's line among them */
  const rows = frame.locator('[data-paper-chain-grid] .ag-row');
  await rows.first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(2500);
  const top = () => frame.locator('main').evaluate(m => (m.scrollTop = 0));
  try {
    /* a strike a little out of the money: two rows above the middle of what is drawn */
    const n = await rows.count();
    const row = rows.nth(Math.min(n - 1, Math.floor(n / 2) + 2));
    await row.scrollIntoViewIfNeeded();
    await row.click();
    await frame.locator('[data-order-act="buy"]').first().waitFor({ timeout: 8000 });
    await page.waitForTimeout(500);
    await frame.locator('[data-order-act="buy"]').first().click();
    await page.waitForTimeout(2500);
  } catch (e) {
    console.log(`  paper: the buy did not go (${String(e).split('\n')[0]}) — the picture is the desk without it`);
  }
  await top();
  await page.mouse.move(size.w - 10, 6);
  await page.waitForTimeout(800);
};

/* Chrome where it is installed; else the Chromium Playwright brings (PW_CHROMIUM names another) */
const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}));
let made = 0;
let bytes = 0;
for (const size of SIZES.filter(z => !FORMS.length || FORMS.includes(z.form))) {
  for (const theme of THEMES) {
    for (const path of PAGES) {
      /* a fresh visitor every time: nothing one page did is left for the next */
      const ctx = await browser.newContext({ viewport: { width: size.w + 40, height: size.h + 40 }, deviceScaleFactor: size.dpr });
      await ctx.addInitScript(seed => {
        try {
          for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
        } catch {}
      }, SEED);
      const page = await ctx.newPage();
      /* THE TERMINAL IN A WINDOW (src/embed.ts): a frame, asked for with ?embed — exactly how the landing used to hold it.
         The page that holds the frame is served FROM THE SAME ORIGIN (a made-up address, answered here): in a frame under a
         blank page the browser denies the terminal its storage, and it opened as a stranger's — the seed above never read
         (measured: Terrain came out as the default three charts). */
      await page.route(`${BASE}/__shot-host`, r =>
        r.fulfill({
          contentType: 'text/html',
          /* `photo=1` (embed.ts PHOTO): the photographer's window — the paper desk may start a throwaway account for its picture */
          body: `<html><body style="margin:0;background:#000"><iframe id="t" src="${path}?embed=1&photo=1&theme=${theme}" style="border:0;display:block;width:${size.w}px;height:${size.h}px"></iframe></body></html>`,
        })
      );
      await page.goto(`${BASE}/__shot-host`);
      await page.waitForTimeout(size.form === 'desk' ? 6500 : 5500);
      await PREPARE[path]?.(page, theme, size);
      const png = await page.locator('#t').screenshot({ type: 'png' });
      /* WebP, encoded by the browser itself — no image library to install */
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
      }, png.toString('base64'));
      const file = `${slug(path)}-${theme}-${size.form}.webp`;
      const data = Buffer.from(webp, 'base64');
      writeFileSync(resolve(OUT, file), data);
      made++;
      bytes += data.length;
      console.log(`${file}  ${Math.round(data.length / 1024)} KB`);
      await ctx.close();
    }
  }
}
console.log(`\n${made} pictures · ${(bytes / 1024 / 1024).toFixed(1)} MB in public/landing`);
await browser.close();
