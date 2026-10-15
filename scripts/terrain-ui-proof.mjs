/*
  TERRAIN IN THE BROWSER (the owner, 2026-10-15: "Fix every failure that is a bug, each with a test" — the full Terrain
  audit). Each check drives the real page in a browser and says PASS or FAIL with what it measured; a fixed bug keeps
  its check here so it cannot come back unseen.

    npm run terrain:check                                  against the dev server on 5180
    npm run terrain:check -- --url=http://127.0.0.1:5183   another address (the built page under `vite preview`)
    npm run terrain:check -- --only=axis                   the checks whose name holds a word

  The desk it sets is put back as it was. Exits 1 on any FAIL.
*/
import { chromium } from 'playwright';
import { existsSync, readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const flag = name => args.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const base = (flag('url') ?? process.env.TERRAIN_URL ?? 'http://127.0.0.1:5180').replace(/\/+$/, '');
const only = flag('only');
const exe = process.env.PW_CHROMIUM ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const results = [];

/** A page on Terrain with the panes asked, the desk put back by `done`; `at` holds the page's clock from that instant */
async function terrain(panes, { width = 1440, height = 900, layout = 1, at = null, railCut = undefined, cvd = null, theme = null, init = null, block = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, timezoneId: 'America/Los_Angeles' });
  const page = await ctx.newPage();
  /* a script run before the page's own (a recorder of the canvas's words), and requests refused (a feed route, by regex —
     a glob on "feed" also caught the page's own src/data/feed modules) */
  if (init) await page.addInitScript(init);
  if (block) await page.route(block, r => r.abort());
  /* the reader's colour vision and theme, set before the first paint as Settings leaves them (index.html reads them) */
  if (cvd || theme)
    await page.addInitScript(([cvd, theme]) => {
      if (cvd) localStorage.setItem('slayer_cvd', cvd);
      if (theme) localStorage.setItem('slayer_theme', theme);
    }, [cvd, theme]);
  if (at) await page.clock.install({ time: new Date(at) });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
  await page.goto(`${base}/terrain`, { waitUntil: 'domcontentloaded' });
  const had = await page.evaluate(() => localStorage.getItem('slayer_terrain_v1'));
  const hadName = await page.evaluate(() => localStorage.getItem('slayer_name'));
  const all = [...panes, ...['QQQ', 'IWM', 'SPX', 'SPY'].map(ticker => ({ ticker }))].slice(0, 4);
  await page.evaluate(cfg => {
    localStorage.setItem('slayer_terrain_v1', JSON.stringify(cfg));
    /* the first pane follows the name the reader last had (context/marketStore slayer_name) */
    localStorage.setItem('slayer_name', cfg.panes[0].ticker);
  }, { layout, panes: all, ...(railCut ? { railCut } : {}) });
  await page.goto(`${base}/terrain`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-chart-ink]', { timeout: 60_000 });
  /* the bars in, the field handed: the chart's state names its bars */
  await page.waitForFunction(() => [...document.querySelectorAll('[data-chart-state]')].some(e => Number((e.getAttribute('data-chart-state') ?? '').split('|')[2]) > 0), null, { timeout: 60_000 });
  await page.waitForTimeout(4000);
  const done = async () => {
    if (cvd) await page.evaluate(() => localStorage.removeItem('slayer_cvd'));
    if (theme) await page.evaluate(() => localStorage.removeItem('slayer_theme'));
    await page.evaluate(v => (v == null ? localStorage.removeItem('slayer_terrain_v1') : localStorage.setItem('slayer_terrain_v1', v)), had);
    await page.evaluate(v => (v == null ? localStorage.removeItem('slayer_name') : localStorage.setItem('slayer_name', v)), hadName);
    await ctx.close();
  };
  return { page, errors, done };
}

function check(name, fn) {
  if (only && !name.includes(only)) return;
  results.push({ name, fn });
}

/* ─── THE PRICE AXIS FOLLOWS THE CANDLES IN VIEW (round 3, item 1) ─────────────────────────────────────────────────
   Before: the first press or wheel on the chart switched autoscale off, so a drag back a day at one minute kept
   today's range and the day's candles stood off the chart (SPY: candles 777.5–779.9, axis 764.9–772.9). */
check('axis: a pan and a wheel keep the candles in view; an axis drag is the reader\'s', async () => {
  const { page, errors, done } = await terrain([{ ticker: 'SPY', timeframe: '1m', overlays: { trails: true }, ladder: true }]);
  const fit = () =>
    page.evaluate(() => {
      const e = [...window.__charts][0];
      const tr = e.chart.timeScale().getVisibleRange();
      const ps = e.chart.priceScale('right');
      const pr = ps.getVisibleRange();
      const bars = e.candles.data().filter(b => b.time >= tr.from && b.time <= tr.to && 'high' in b);
      let lo = Infinity;
      let hi = -Infinity;
      for (const b of bars) {
        if (b.low < lo) lo = b.low;
        if (b.high > hi) hi = b.high;
      }
      return { auto: ps.options().autoScale, bars: bars.length, lo, hi, axis: pr ? [pr.from, pr.to] : null, inside: !!pr && lo >= pr.from && hi <= pr.to };
    });
  const notes = [];
  let pass = true;
  const say = (what, f) => {
    notes.push(`${what}: candles ${f.lo.toFixed(2)}–${f.hi.toFixed(2)}, axis ${f.axis?.map(v => v.toFixed(2)).join('–')}, auto ${f.auto}`);
  };
  try {
    const b = await page.locator('[data-chart-ink]').first().boundingBox();
    const t0 = Date.now();
    /* a drag back with a hand's vertical drift */
    for (let i = 0; i < 6; i++) {
      await page.mouse.move(b.x + 200, b.y + 400);
      await page.mouse.down();
      await page.mouse.move(b.x + 700, b.y + 412, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(300);
    }
    await page.waitForTimeout(1200);
    const dragged = await fit();
    say('dragged', dragged);
    if (!dragged.auto || !dragged.inside || dragged.bars < 10) pass = false;
    await page.mouse.move(b.x + b.width * 0.5, b.y + 400);
    for (let i = 0; i < 4; i++) {
      await page.mouse.wheel(0, 240);
      await page.waitForTimeout(150);
    }
    await page.waitForTimeout(1200);
    const wheeled = await fit();
    say('wheeled', wheeled);
    if (!wheeled.auto || !wheeled.inside) pass = false;
    /* the price axis dragged: the reader's scale, kept through the ticks */
    const ax = { x: b.x + b.width - 30, y: b.y + 300 };
    await page.mouse.move(ax.x, ax.y);
    await page.mouse.down();
    await page.mouse.move(ax.x, ax.y + 80, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    const byHand = await fit();
    await page.waitForTimeout(3000);
    const later = await fit();
    say('axis dragged', byHand);
    if (byHand.auto || !later.axis || Math.abs(later.axis[0] - byHand.axis[0]) > 1e-6 || Math.abs(later.axis[1] - byHand.axis[1]) > 1e-6) {
      pass = false;
      notes.push('the hand-set scale moved within 3 s');
    }
    /* a double-click gives it back */
    await page.mouse.dblclick(b.x + b.width * 0.5, b.y + 300);
    await page.waitForTimeout(1200);
    const back = await fit();
    say('double-click', back);
    if (!back.auto || !back.inside) pass = false;
    if (errors.length) {
      pass = false;
      notes.push(`page errors: ${errors.join(' | ')}`);
    }
    return { pass, ms: Date.now() - t0, notes };
  } finally {
    await done();
  }
});

/* ─── A TILED TIMEFRAME WITH NO MINUTES TODAY (round 3, found by the gap sweep) ─────────────────────────────────────
   From midnight New York to the first pre-market minute, and all weekend, every minute the vendor returns falls on a
   session the server tiled, so today's minutes were none and the chart returned before it merged the tiles' bars: SPY at
   15 minutes drew a blank pane, QQQ at 1 minute too, and at 5 minutes the bars came without a column. The page's clock is
   held on a Saturday so the case stands whatever the hour the proof runs. */
for (const tf of ['15m', '5m', '1m']) {
  check(`no minutes today (a Saturday): SPY at ${tf} draws its sessions' bars and the field`, async () => {
    const { page, errors, done } = await terrain([{ ticker: 'SPY', timeframe: tf, overlays: { trails: true }, ladder: true }], { at: '2026-10-17T16:00:00Z' });
    try {
      const t0 = Date.now();
      await page.waitForFunction(() => [...document.querySelectorAll('[data-chart-state]')].some(e => /\|f[1-9]\d*\|/.test(e.getAttribute('data-chart-state') ?? '')), null, { timeout: 30_000 }).catch(() => null);
      const st = await page.evaluate(want => [...document.querySelectorAll('[data-chart-state]')].map(e => e.getAttribute('data-chart-state')).filter(x => x?.startsWith(want)), `SPY|${tf}|`);
      /* the pane's chart: the one holding the most bars (a chart from the open before the desk was set can linger a frame) */
      const s0 = ([...st].sort((a, b) => Number(b.split('|')[2]) - Number(a.split('|')[2]))[0] ?? '').split('|');
      const bars = Number(s0[2] ?? 0);
      const cols = Number((s0[5] ?? 'f0').slice(1)) || 0;
      /* at least two sessions' bars: under the old code a 5-minute pane held one session (78 bars) of the many tiled */
      const twoSessions = { '1m': 780, '5m': 156, '15m': 52 }[tf];
      return { pass: bars >= twoSessions && cols > 0 && !errors.length, ms: Date.now() - t0, notes: [`chart state: ${st.join(' ; ') || 'none (no chart drawn)'} — needs ${twoSessions} bars or more (two sessions)`, ...(errors.length ? [`page errors: ${errors.join(' | ')}`] : [])] };
    } finally {
      await done();
    }
  });
}

/* ─── THE HOVER AND THE PIN NAME THE NODE UNDER THE POINTER (the audit, B-07) ──────────────────────────────────────
   With the drawing rail docked left and open (the default) the chart starts 56 px in; the hover, the card and the pin
   measured the pointer from the outer box and named the node 56 px to its right. A node is found through the renderer's
   own hit test, the pointer put on it, and the hovered node must be that node. */
check('hover: the node under the pointer is the one hovered, the rail docked left', async () => {
  const { page, errors, done } = await terrain([{ ticker: 'SPY', timeframe: '5m', overlays: { trails: true }, ladder: true }]);
  try {
    await page.waitForFunction(() => [...window.__charts].some(e => e.trails && /\|f[1-9]/.test(e.box()?.getAttribute('data-chart-state') ?? '')), null, { timeout: 30_000 });
    const t0 = Date.now();
    const found = await page.evaluate(() => {
      const e = [...window.__charts].find(x => x.trails && x.box()?.isConnected && x.candles.data().length);
      const box = e.box().getBoundingClientRect();
      const w = e.chart.paneSize(0).width;
      const h = e.chart.paneSize(0).height;
      for (const fx of [0.55, 0.65, 0.75, 0.45]) {
        const x = Math.round(w * fx);
        /* below the chrome band (the header strip, the legend and the hover row, which stands over the plot's top under a
           pointer) — a node there is behind the row by design */
        for (let y = Math.round(h * 0.3); y < h - 40; y += 2) {
          const b = e.trails.beadAt(x, y);
          if (b) return { x, y, px: box.left + x, py: box.top + y, strike: b.strike, time: b.time, inset: box.left - e.box().parentElement.getBoundingClientRect().left };
        }
      }
      return null;
    });
    if (!found) return { pass: false, notes: ['no node found to hover'] };
    await page.mouse.move(found.px, found.py, { steps: 4 });
    await page.waitForTimeout(250);
    const hovered = await page.evaluate(() => {
      const e = [...window.__charts].find(x => x.trails && x.box()?.isConnected && x.candles.data().length);
      const h = e.trails.hover;
      return h ? { strike: h.strike, time: h.time } : null;
    });
    const pass = !!hovered && hovered.strike === found.strike && hovered.time === found.time && !errors.length;
    const at = t => new Date(t * 1000).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' });
    return { pass, ms: Date.now() - t0, notes: [`under the pointer: ${found.strike} at ${at(found.time)} (chart starts ${Math.round(found.inset)} px in); hovered: ${hovered ? `${hovered.strike} at ${at(hovered.time)}` : 'none'}`, ...(errors.length ? [`page errors: ${errors.join(' | ')}`] : [])] };
  } finally {
    await done();
  }
});

/* ─── THE RIGHT-CLICK LEVEL CARD OPENS AT THE CLICK (the audit, A-193) ─────────────────────────────────────────────── */
check('level card: a right-click on a level opens its card at the click, the rail docked left', async () => {
  const { page, errors, done } = await terrain([{ ticker: 'SPY', timeframe: '5m', overlays: { trails: true }, ladder: true }]);
  try {
    await page.waitForSelector('[data-axis-chip]', { timeout: 30_000 });
    const t0 = Date.now();
    const at = await page.evaluate(() => {
      const e = [...window.__charts].find(x => x.box()?.isConnected && x.candles.data().length);
      const box = e.box().getBoundingClientRect();
      const w = e.chart.paneSize(0).width;
      const h = e.chart.paneSize(0).height;
      for (const key of ['flip', 'cw', 'pw']) {
        const el = document.querySelector(`[data-axis-chip="${key}"]`);
        const price = Number(el?.getAttribute('data-strike'));
        const y = Number.isFinite(price) ? e.candles.priceToCoordinate(price) : null;
        if (y == null || y < 0 || y > h) continue;
        /* a point the chart itself holds — not under the legend or a chip */
        for (const fx of [0.5, 0.35, 0.65, 0.8]) {
          const x = box.left + Math.round(w * fx);
          const el = document.elementFromPoint(x, box.top + y);
          if (el && e.box().contains(el)) return { key, price, x, y: box.top + y };
        }
      }
      return null;
    });
    if (!at) return { pass: false, notes: ['no level in view to right-click'] };
    await page.mouse.click(at.x, at.y, { button: 'right' });
    const card = await page.waitForSelector('[data-chart-menu="level-alert"]', { timeout: 3000 }).catch(() => null);
    const r = card ? await card.boundingBox() : null;
    await page.keyboard.press('Escape');
    const dx = r ? r.x - at.x : NaN;
    return { pass: !!r && Math.abs(dx - 4) <= 3 && !errors.length, ms: Date.now() - t0, notes: [`right-click on the ${at.key} (${at.price}) at x ${Math.round(at.x)}: card ${r ? `at x ${Math.round(r.x)} (${dx >= 0 ? '+' : ''}${Math.round(dx)} px; 4 asked)` : 'not opened'}`, ...(errors.length ? [`page errors: ${errors.join(' | ')}`] : [])] };
  } finally {
    await done();
  }
});

/* ─── AN INDICATOR ON THROUGH A REPLAY (the audit, D) ─────────────────────────────────────────────────────────────────
   The indicators' effect wrote the cursor's bar with update(); a step back handed it an older time, which the chart
   library refuses (it throws). EMA 9 on, a replay picked mid-plot, three steps back and two on: no page error, and the
   line holds a point at the cursor's bar. */
check('replay: an indicator on, steps back and on, no error', async () => {
  const { page, errors, done } = await terrain([{ ticker: 'SPY', timeframe: '5m', overlays: { trails: true }, ladder: true, indicators: { ema9: true } }]);
  try {
    const b = await page.locator('[data-chart-ink]').first().boundingBox();
    /* the pane takes the keys from a click on its header (a click on the plot can pin a node's card) */
    const head = await page.locator('[data-pane-head]').first().boundingBox();
    await page.mouse.click(head.x + head.width * 0.6, head.y + head.height / 2);
    const t0 = Date.now();
    await page.keyboard.press('p');
    await page.waitForTimeout(600);
    await page.mouse.click(b.x + b.width * 0.5, b.y + b.height * 0.5);
    await page.waitForSelector('[data-replay-step="back"]', { timeout: 8000 });
    await page.waitForTimeout(800);
    for (let i = 0; i < 3; i++) {
      await page.click('[data-replay-step="back"]');
      await page.waitForTimeout(350);
    }
    for (let i = 0; i < 2; i++) {
      await page.click('[data-replay-step="on"]');
      await page.waitForTimeout(350);
    }
    /* the line ends at the cursor's bar, as the candles do — never a value past the cursor */
    const ends = await page.evaluate(() => {
      const e = [...window.__charts].find(x => x.box()?.isConnected && x.candles.data().length);
      const lastCandle = e.candles.data().at(-1)?.time ?? null;
      const lines = e.chart.panes()[0].getSeries().filter(s => s.seriesType() === 'Line' && s.data().some(d => 'value' in d));
      const lastLine = lines.map(s => [...s.data()].reverse().find(d => 'value' in d)?.time ?? null);
      return { lastCandle, lastLine, cursor: Number(e.box().getAttribute('data-replay-time') ?? NaN) };
    });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    const past = ends.lastLine.filter(t => t != null && ends.lastCandle != null && t > ends.lastCandle).length;
    return { pass: !errors.length && ends.lastLine.length > 0 && past === 0, ms: Date.now() - t0, notes: [errors.length ? `page errors: ${errors.join(' | ')}` : 'no page error', `last candle ${ends.lastCandle}; line ends ${ends.lastLine.join(', ') || 'none'}; ${past} past the cursor's bar`] };
  } finally {
    await done();
  }
});

/* ─── NOTHING PAST THE CURSOR IN A REPLAY (the audit — found checking D's replay crash) ─────────────────────────────────
   The replay's tape is the live tape cut at the cursor, but it carried the server's tiled sessions (`pre`) uncut: with
   the cursor on a tiled day the chart drew that day's later bars and the field's later columns. A replay picked mid-plot
   at 5 minutes: no candle and no column of the field may start after the cursor's minute. */
check('replay: no candle and no field column past the cursor', async () => {
  const { page, errors, done } = await terrain([{ ticker: 'SPY', timeframe: '5m', overlays: { trails: true }, ladder: true }]);
  try {
    const b = await page.locator('[data-chart-ink]').first().boundingBox();
    const head = await page.locator('[data-pane-head]').first().boundingBox();
    await page.mouse.click(head.x + head.width * 0.6, head.y + head.height / 2);
    const t0 = Date.now();
    await page.keyboard.press('p');
    await page.waitForTimeout(600);
    await page.mouse.click(b.x + b.width * 0.5, b.y + b.height * 0.5);
    await page.waitForFunction(() => !!document.querySelector('[data-as-of]'), null, { timeout: 8000 });
    await page.waitForTimeout(1500);
    const got = await page.evaluate(() => {
      const box = document.querySelector('[data-as-of]');
      const e = [...window.__charts].find(x => x.box() === box);
      const asOf = Number(box.getAttribute('data-as-of'));
      const cursor = asOf / 1000 - 60;
      const bars = e.candles.data().filter(d => 'close' in d);
      const cols = e.trails.snapshots ?? [];
      /* a column of a wider bar stands for its peak minute (GexLevel.at); a level's minute past the cursor is a read past it */
      const levelPast = cols.reduce((n, c) => n + c.levels.filter(l => (l.at ?? c.time) > cursor).length, 0);
      const days = new Set(cols.map(c => new Date(c.time * 1000).toISOString().slice(0, 10))).size;
      return { cursor, lastBar: bars.at(-1)?.time ?? null, barsPast: bars.filter(d => d.time > cursor).length, colsPast: cols.filter(c => c.time > cursor).length, levelPast, cols: cols.length, days };
    });
    await page.keyboard.press('Escape');
    const ny = t => (t == null ? '—' : new Date(t * 1000).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }));
    return { pass: got.barsPast === 0 && got.colsPast === 0 && got.levelPast === 0 && got.days > 1 && !errors.length, ms: Date.now() - t0, notes: [`cursor ${ny(got.cursor)} New York; last candle ${ny(got.lastBar)}; ${got.barsPast} candles, ${got.colsPast} of ${got.cols} columns and ${got.levelPast} cells' minutes past the cursor; columns over ${got.days} days (the sessions before stand)`, ...(errors.length ? [`page errors: ${errors.join(' | ')}`] : [])] };
  } finally {
    await done();
  }
});

/* ─── NO BLANK WITHOUT A REASON: A WINDOW WITH NO EXPIRY THAT DAY (round 3, item 4's sweep) ──────────────────────────
   Before: AAPL lists no contract settling on a Tuesday or a Thursday, so its 0DTE window's columns those days held no
   strike, counted as columns, and the chart stood blank with no words (78 of 78 columns empty on Oct 6, 8 and 13). */
check('gaps: a window with no expiry that day says so, every empty bar labelled', async () => {
  const { page, errors, done } = await terrain([{ ticker: 'AAPL', timeframe: '5m', overlays: { trails: true }, ladder: true }], { railCut: 'w:0dte' });
  try {
    const t0 = Date.now();
    await page.waitForTimeout(6000);
    const b = await page.locator('[data-chart-ink]').first().boundingBox();
    await page.mouse.move(b.x + b.width * 0.6, b.y + b.height * 0.5);
    for (let i = 0; i < 10; i++) {
      await page.mouse.wheel(0, 300);
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(5000);
    await page.mouse.move(b.x + b.width * 0.6, b.y + b.height * 0.5 + 1);
    await page.waitForTimeout(800);
    const got = await page.evaluate(() => {
      const e = [...window.__charts].find(x => x.host.isConnected && x.candles.data().length);
      const tr = e.chart.timeScale().getVisibleRange();
      const runs = e.gaps();
      const bars = e.candles.data().filter(d => 'close' in d && d.time >= tr.from && d.time <= tr.to);
      let empty = 0;
      let unlabelled = 0;
      const days = new Set();
      /* read off the columns themselves (not the renderer's own test), so the check runs on the old code too */
      const snaps = e.trails.snapshots;
      const kindAt = t => {
        const inBar = snaps.filter(c => c.time >= t && c.time < t + 300);
        if (!inBar.length) return 'none';
        return inBar.some(c => c.levels.some(l => l.value || l.gross)) ? 'full' : 'empty';
      };
      for (const d of bars) {
        if (kindAt(d.time) !== 'empty') continue;
        empty++;
        days.add(new Date(d.time * 1000).toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric' }));
        if (!runs.some(r => d.time >= r.t0 && d.time <= r.t1)) unlabelled++;
      }
      const said = runs.filter(r => /no AAPL expiry settles this day/.test(r.words)).length;
      return { empty, unlabelled, said, days: [...days] };
    });
    return { pass: got.empty > 0 && got.unlabelled === 0 && got.said > 0 && !errors.length, ms: Date.now() - t0, notes: [`${got.empty} bars in view with columns that hold no strike (${got.days.join(', ')}); ${got.unlabelled} unlabelled; ${got.said} runs say "no AAPL expiry settles this day"`, ...(errors.length ? [`page errors: ${errors.join(' | ')}`] : [])] };
  } finally {
    await done();
  }
});

/* ─── THE REPLAY DOOR IN A DOCKED PANE (the audit's A-56) ──────────────────────────────────────────────────────────────
   Before: the header's toolbar mount was compact and named no `replay`, the hover row's dropped it, so a docked pane
   showed no Replay button at any width — only P, a bead card or the day panel led into a replay. */
check('replay door: a docked pane has a Replay button at one and four panes, and it starts a replay', async () => {
  const notes = [];
  let pass = true;
  const t0 = Date.now();
  for (const layout of [1, 4]) {
    const { page, errors, done } = await terrain([{ ticker: 'SPY', timeframe: '5m', overlays: { trails: true }, ladder: true }], { layout });
    try {
      const pane = page.locator('[data-pane-head]').first();
      const hb = await pane.boundingBox();
      /* the hover row stands only under the pointer: put it on the pane */
      await page.mouse.move(hb.x + hb.width * 0.5, hb.y + hb.height + 120);
      await page.waitForTimeout(500);
      const doors = await page.locator('[data-replay-door]').count();
      const visible = await page.locator('[data-replay-door]').first().isVisible().catch(() => false);
      let started = false;
      if (doors && visible) {
        await page.locator('[data-replay-door]').first().click();
        started = await page.waitForSelector('[data-replay-badge]', { timeout: 5000 }).then(() => true).catch(() => false);
        if (started) await page.keyboard.press('Escape');
      }
      notes.push(`${layout} pane${layout > 1 ? 's' : ''}: ${doors} Replay door${doors === 1 ? '' : 's'}, ${visible ? 'visible' : 'not visible'}; a click ${started ? 'starts a replay' : 'starts nothing'}`);
      if (!doors || !visible || !started || errors.length) pass = false;
      if (errors.length) notes.push(`page errors: ${errors.join(' | ')}`);
    } finally {
      await done();
    }
  }
  return { pass, ms: Date.now() - t0, notes };
});

/* ─── THE DESK'S KEYS (the audit's A-236, A-240/241, A-247, A-256, A-257, A-02) ────────────────────────────────────────
   Before: with the keys sheet open, `2` changed the layout behind it; in a replay `?` and `/` were dead (the replay was a
   layer that blocked the shell's keys); Caps Lock made P, T, W … match nothing; Shift ↓ before a bar was picked said
   "Replay playing" and nothing played; C on a pane too narrow for its Compare door set a menu nothing cleared, and ↑ ↓
   then stood still; P on an index on the feed put up a badge with no transport that only P took down. */
check('keys: the sheet holds the keys, ? in a replay, Caps Lock, Shift before a pick, C with no room', async () => {
  const notes = [];
  let pass = true;
  const t0 = Date.now();
  const said = page => page.evaluate(() => document.querySelector('span.sr-only[aria-live="polite"]')?.textContent ?? '');
  const layoutOf = page => page.evaluate(() => JSON.parse(localStorage.getItem('slayer_terrain_v1') ?? '{}').layout ?? null);
  {
    const { page, errors, done } = await terrain([{ ticker: 'SPY', timeframe: '5m', overlays: { trails: true }, ladder: true }]);
    try {
      const b = await page.locator('[data-chart-ink]').first().boundingBox();
      await page.mouse.click(b.x + b.width * 0.3, b.y + 20);
      /* the sheet open: 2 does nothing behind it */
      await page.keyboard.press('?');
      const sheet = await page.waitForSelector('[data-key-sheet]', { timeout: 4000 }).then(() => true).catch(() => false);
      await page.keyboard.press('2');
      await page.waitForTimeout(500);
      const behind = await layoutOf(page);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      notes.push(`keys sheet ${sheet ? 'opened' : 'did not open'}; 2 pressed over it → layout ${behind}`);
      if (!sheet || behind !== 1) pass = false;
      /* Caps Lock on: P starts a replay */
      await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'P', modifierCapsLock: true, bubbles: true })));
      const capsP = await page.waitForSelector('[data-replay-badge]', { timeout: 4000 }).then(() => true).catch(() => false);
      notes.push(`Caps Lock + p → ${capsP ? 'a replay' : 'nothing'}`);
      if (!capsP) pass = false;
      /* Shift ↓ before a bar is picked */
      await page.keyboard.press('Shift+ArrowDown');
      await page.waitForTimeout(300);
      const pickWords = await said(page);
      notes.push(`Shift ↓ before a pick says "${pickWords}"`);
      if (!/Pick a bar/.test(pickWords)) pass = false;
      /* ? in a replay */
      await page.keyboard.press('?');
      const sheetInReplay = await page.waitForSelector('[data-key-sheet]', { timeout: 4000 }).then(() => true).catch(() => false);
      notes.push(`? in a replay → ${sheetInReplay ? 'the sheet' : 'nothing'}`);
      if (!sheetInReplay) pass = false;
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      const stillReplay = await page.locator('[data-replay-badge]').count();
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      const after = await page.locator('[data-replay-badge]').count();
      notes.push(`Esc closed the sheet and left the replay (${stillReplay}), a second Esc ended it (${after})`);
      if (stillReplay !== 1 || after !== 0) pass = false;
      if (errors.length) {
        pass = false;
        notes.push(`page errors: ${errors.join(' | ')}`);
      }
    } finally {
      await done();
    }
  }
  /* C on a pane with no room for Compare: ↓ still flips the name */
  {
    const { page, errors, done } = await terrain([{ ticker: 'SPY', timeframe: '5m', overlays: { trails: true }, ladder: true }], { layout: 4, width: 1280, height: 800 });
    try {
      const doors = await page.locator('[data-pane-head]').first().locator('button[aria-label="Compare symbol"]').count();
      const b = await page.locator('[data-chart-ink]').first().boundingBox();
      await page.mouse.click(b.x + b.width * 0.3, b.y + 20);
      await page.keyboard.press('c');
      await page.waitForTimeout(300);
      const cWords = await said(page);
      const before = await page.locator('[data-pane-head]').first().innerText();
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(1500);
      const afterName = await page.locator('[data-pane-head]').first().innerText();
      const moved = before.split('\n')[0] !== afterName.split('\n')[0] || before !== afterName;
      notes.push(`4 panes at 1280: ${doors} Compare door in pane 1; C says "${cWords}"; ↓ then ${moved ? 'flips the name' : 'does nothing'}`);
      if (doors === 0 && (!/No room for Compare/.test(cWords) || !moved)) pass = false;
      if (errors.length) {
        pass = false;
        notes.push(`page errors: ${errors.join(' | ')}`);
      }
    } finally {
      await done();
    }
  }
  return { pass, ms: Date.now() - t0, notes };
});

/* ─── COLOUR VISION: THE OVALS AND THE LADDER WEAR THE PAIR THE READER CHOSE (the audit's CVD pass) ────────────────────
   Before: under Settings' blue–orange pair the tokens moved (gold 250 222 110, violet 150 78 230 on a dark ground) but
   the renderer and the ladder drew numbers — the standard 232 185 74 and 128 100 247 — beside blue and orange candles;
   and the ladder's Δ-from-spot ink was `rgb(var(--bull))`, which a canvas cannot read, so it never drew in its colour. */
check('colour vision: the ovals and the ladder follow the blue-orange pair, on black and on paper', async () => {
  const notes = [];
  let pass = true;
  const t0 = Date.now();
  for (const theme of ['dark', 'light']) {
    const { page, errors, done } = await terrain([{ ticker: 'SPY', timeframe: '5m', overlays: { trails: true }, ladder: true, view: 'net' }], { cvd: 'blue-orange', theme });
    try {
      await page.waitForFunction(() => [...(window.__charts ?? [])].some(e => e.host.isConnected && e.trails?.snapshots?.length), null, { timeout: 30000 });
      await page.waitForTimeout(2500);
      const got = await page.evaluate(() => {
        const e = [...window.__charts].find(x => x.host.isConnected && x.trails?.snapshots?.length);
        const paper = !!e.trails.paper;
        /* the tokens on the tape's own ground, read the way the page reads them */
        const probe = document.createElement('span');
        probe.setAttribute('data-theme', paper ? 'light' : 'dark');
        document.body.appendChild(probe);
        const tok = n => getComputedStyle(probe).getPropertyValue(n).trim().split(/\s+/).map(Number);
        const want = { put: tok('--amplify'), call: tok('--absorb') };
        probe.remove();
        const inks = e.trails.legend()?.inks ?? null;
        /* the ladder's canvas: pixels of the chosen pair, and of the standard pair */
        const cv = document.querySelector('[data-profile-panel] canvas');
        let chosen = 0;
        let standard = 0;
        if (cv) {
          const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
          const std = paper ? [[91, 60, 230], [158, 114, 0]] : [[128, 100, 247], [232, 185, 74]];
          const near = (i, c) => Math.abs(d[i] - c[0]) <= 2 && Math.abs(d[i + 1] - c[1]) <= 2 && Math.abs(d[i + 2] - c[2]) <= 2;
          for (let i = 0; i < d.length; i += 4) {
            if (d[i + 3] < 250) continue;
            if (near(i, want.put) || near(i, want.call)) chosen++;
            else if (near(i, std[0]) || near(i, std[1])) standard++;
          }
        }
        return { paper, want, inks, chosen, standard };
      });
      const same = (a, b) => !!a && !!b && a.every((v, i) => Math.abs(v - b[i]) <= 1);
      const ok = same(got.inks?.put, got.want.put) && same(got.inks?.call, got.want.call) && got.chosen > 0 && got.standard === 0;
      notes.push(`${theme} page, ${got.paper ? 'paper' : 'dark'} tape: ovals put ${got.inks?.put?.join(' ')} call ${got.inks?.call?.join(' ')} — tokens ${got.want.put.join(' ')} / ${got.want.call.join(' ')}; ladder ${got.chosen} px of the chosen pair, ${got.standard} of the standard`);
      if (!ok || errors.length) pass = false;
      if (errors.length) notes.push(`page errors: ${errors.join(' | ')}`);
    } finally {
      await done();
    }
  }
  return { pass, ms: Date.now() - t0, notes };
});

/* ─── THE LADDER (the audit's C-15, C-23, C-32) ───────────────────────────────────────────────────────────────────────
   Before: the key named "the spine now" and "at the open" in the Net view, which draws neither; the Δ from spot was
   given `rgb(var(--bull))`, which a canvas cannot read, so it never drew green or red; the hover card printed
   "++0.52% from spot". */
check('ladder: the key names what is drawn, the Δ wears its direction, the card prints one sign', async () => {
  const notes = [];
  let pass = true;
  const t0 = Date.now();
  {
    const { page, errors, done } = await terrain([{ ticker: 'SPY', timeframe: '5m', overlays: { trails: true }, ladder: true }]);
    try {
      await page.waitForSelector('[data-profile-panel] canvas[data-key]', { timeout: 20000 });
      await page.locator('[data-profile-view="net"]').first().click();
      await page.waitForTimeout(800);
      const netKey = await page.locator('[data-profile-panel] canvas').first().getAttribute('data-key');
      await page.locator('[data-profile-view="ladder"]').first().click();
      await page.waitForTimeout(800);
      const sidesKey = await page.locator('[data-profile-panel] canvas').first().getAttribute('data-key');
      notes.push(`Net key: "${netKey}"`, `Sides key: "${sidesKey}"`);
      if (/spine|open/.test(netKey ?? '') || !/spine/.test(sidesKey ?? '')) pass = false;
      /* the Δ from spot: the direction pair's pixels in the strike column (no other ink on the ladder is green or red) */
      const dir = await page.evaluate(() => {
        const cv = document.querySelector('[data-profile-panel] canvas');
        const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
        let green = 0;
        let red = 0;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i + 3] < 200) continue;
          if (d[i + 1] > 150 && d[i] < 110 && d[i + 2] < 140) green++;
          if (d[i] > 200 && d[i + 1] < 110 && d[i + 2] < 100) red++;
        }
        return { green, red };
      });
      notes.push(`Δ from spot: ${dir.green} green and ${dir.red} red pixels on the ladder`);
      /* the rows in view may all stand on one side of the price: the direction inks drawn at all is the check */
      if (dir.green + dir.red < 10) pass = false;
      if (errors.length) {
        pass = false;
        notes.push(`page errors: ${errors.join(' | ')}`);
      }
    } finally {
      await done();
    }
  }
  {
    /* three panes, Sides: the ladder too narrow for figures, so a hover opens the card */
    const { page, errors, done } = await terrain([{ ticker: 'SPY', timeframe: '5m', overlays: { trails: true }, ladder: true }], { layout: 3 });
    try {
      await page.locator('[data-profile-view="ladder"]').first().click();
      await page.waitForTimeout(600);
      const panel = page.locator('[data-profile-panel]').first();
      const b = await panel.boundingBox();
      let text = '';
      for (let y = b.y + b.height * 0.35; y < b.y + b.height * 0.75 && !text; y += 14) {
        await page.mouse.move(b.x + b.width * 0.5, y);
        await page.waitForTimeout(150);
        text = (await page.locator('[data-profile-card]').first().textContent({ timeout: 300 }).catch(() => '')) ?? '';
      }
      notes.push(`hover card: "${text.slice(0, 80)}"`);
      if (!text || /\+\+/.test(text)) pass = false;
      if (errors.length) {
        pass = false;
        notes.push(`page errors: ${errors.join(' | ')}`);
      }
    } finally {
      await done();
    }
  }
  return { pass, ms: Date.now() - t0, notes };
});

/* ─── A JUMP ON A LONG ONE-MINUTE TAPE (the audit's B-73) ─────────────────────────────────────────────────────────────
   Before: the jump counted bars over the whole tape (five weeks of minutes, thousands of bars) while the series held
   only the recent 1,000, so a day a week back set a range far past the series and the view showed no bar of that day. */
/* A RANGE JUMP KEEPS ITS RANGE (the audit's A-46–A-50): 1W and 6M change the timeframe, whose bars arrive in pieces; the
   timeframe's own second load (a replay hand-back that ran with no replay) and the pieces arriving after the jump had put
   1W on a day and a half and 6M on three weeks */
check('jump: 1W and 6M land on their range and keep it as the bars arrive', async () => {
  const { page, errors, done } = await terrain([{ ticker: 'SPY', timeframe: '5m', overlays: { trails: true }, ladder: true }]);
  try {
    const t0 = Date.now();
    const notes = [];
    let pass = true;
    for (const [span, tf, lo, hi] of [['1w', '15m', 5, 9.5], ['6m', '1D', 150, 200]]) {
      const door = page.locator(`[data-pane-head] [data-jump="${span}"]`).first();
      if (!(await door.isVisible().catch(() => false))) await page.locator('[data-jump-trigger]').first().click();
      await page.locator(`[data-jump="${span}"]`).first().click();
      await page.waitForTimeout(6000);
      const got = await page.evaluate(() => {
        const e = [...window.__charts].find(x => x.trails && x.host.isConnected && x.candles.data().length);
        const r = e.chart.timeScale().getVisibleRange();
        const d = e.candles.data().filter(x => 'close' in x);
        return { tf: (e.host.getAttribute('data-chart-state') ?? '').split('|')[1], days: r ? (r.to - r.from) / 86400 : 0, last: d[d.length - 1]?.time ?? 0, to: r?.to ?? 0, n: d.length };
      });
      const ok = got.tf === tf && got.days >= lo && got.days <= hi && got.to >= got.last;
      pass &&= ok;
      notes.push(`${span}: ${got.tf}, the view ${got.days.toFixed(1)} days wide (${lo}–${hi} asked), ${got.to >= got.last ? 'reaching the newest bar' : 'short of the newest bar'}, ${got.n} bars held`);
    }
    if (errors.length) notes.push(`page errors: ${errors.join(' | ')}`);
    return { pass: pass && !errors.length, ms: Date.now() - t0, notes };
  } finally {
    await done();
  }
});

check('jump: a day a week back on one-minute bars lands on that day', async () => {
  const { page, errors, done } = await terrain([{ ticker: 'SPY', timeframe: '1m', overlays: { trails: true }, ladder: true }]);
  try {
    const t0 = Date.now();
    const b = await page.locator('[data-chart-ink]').first().boundingBox();
    await page.mouse.click(b.x + b.width * 0.3, b.y + 20);
    /* the day a week back: the sessions the tape holds, read off the chart */
    const day = await page.evaluate(() => {
      const e = [...window.__charts].find(x => x.host.isConnected && x.candles.data().length);
      const ny = t => new Date(t * 1000).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
      const all = [...new Set(e.candles.data().filter(d => 'close' in d).map(d => ny(d.time)))];
      return { want: null, seen: all };
    });
    const sessions = [];
    await page.keyboard.press('t');
    await page.waitForSelector('[data-jump-date-input]', { timeout: 4000 });
    /* five sessions back on the calendar's own weekdays */
    const target = await page.evaluate(() => {
      const d = new Date();
      let n = 0;
      while (n < 6) {
        d.setDate(d.getDate() - 1);
        if (d.getDay() !== 0 && d.getDay() !== 6) n++;
      }
      return d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    });
    await page.fill('[data-jump-date-input]', target);
    await page.click('form button[type="submit"]');
    await page.waitForTimeout(3500);
    const got = await page.evaluate(want => {
      const e = [...window.__charts].find(x => x.host.isConnected && x.candles.data().length);
      const tr = e.chart.timeScale().getVisibleRange();
      const ny = t => new Date(t * 1000).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
      const inView = e.candles.data().filter(d => 'close' in d && d.time >= tr.from && d.time <= tr.to);
      return { tf: (e.host.getAttribute('data-chart-state') ?? '').split('|')[1], held: e.candles.data().length, inView: inView.length, onDay: inView.filter(d => ny(d.time) === want).length, from: ny(tr.from), to: ny(tr.to) };
    }, target);
    sessions.push(...day.seen);
    return { pass: got.onDay > 0 && !errors.length, ms: Date.now() - t0, notes: [`jumped to ${target} at ${got.tf}: view ${got.from} to ${got.to}, ${got.onDay} of ${got.inView} bars in view on that day; the series holds ${got.held} bars`, ...(errors.length ? [`page errors: ${errors.join(' | ')}`] : [])] };
  } finally {
    await done();
  }
});

/* ─── INDICATORS: THEIR OWN PANES, A FITTED AXIS, A LIGHT TAPE (the audit's D(a), D(d), D(h)) ─────────────────────────
   Before: RSI took pane 1 by a fixed index and landed inside the regime strip's pane on its scale; SMA 200 and Bollinger
   widened the axis fitted to the candles; on a light tape the lines read 1.0 to 1.5:1. */
check('indicators: a pane of their own beside the regime strip, the fitted axis kept, readable on a light tape', async () => {
  const notes = [];
  let pass = true;
  const t0 = Date.now();
  for (const theme of ['dark', 'light']) {
    const { page, errors, done } = await terrain([{ ticker: 'SPY', timeframe: '5m', overlays: { trails: true, regime: true }, ladder: true, indicators: { rsi: true, sma: true, bb: true } }], { theme });
    try {
      await page.waitForTimeout(3000);
      const got = await page.evaluate(() => {
        const e = [...window.__charts].find(x => x.host.isConnected && x.candles.data().length);
        const panes = e.chart.panes();
        const perPane = panes.map(p => p.getSeries().length);
        /* the fitted axis against the candles in view */
        const tr = e.chart.timeScale().getVisibleRange();
        const bars = e.candles.data().filter(b => 'close' in b && b.time >= tr.from && b.time <= tr.to);
        let lo = Infinity, hi = -Infinity;
        for (const b of bars) { lo = Math.min(lo, b.low); hi = Math.max(hi, b.high); }
        const pr = e.chart.priceScale('right').getVisibleRange();
        /* the overlay lines' inks on this tape */
        /* the indicators' lines: drawn lines on the price pane (a helper series with no points is not a line) */
        const inks = panes[0].getSeries().filter(s => s.seriesType() === 'Line' && s.data().length > 0).map(s => s.options().color);
        const ground = (e.host.closest('[data-chart-ground]') ?? document.querySelector('[data-chart-ground]'))?.getAttribute('data-chart-ground');
        return { panes: panes.length, perPane, axis: pr ? [pr.from, pr.to] : null, lo, hi, inks, ground };
      });
      const span = got.axis ? got.axis[1] - got.axis[0] : 0;
      const candleSpan = got.hi - got.lo;
      const lum = c => {
        const m = /#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(c);
        if (!m) return null;
        const f = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
        return 0.2126 * f(parseInt(m[1], 16)) + 0.7152 * f(parseInt(m[2], 16)) + 0.0722 * f(parseInt(m[3], 16));
      };
      const darkest = got.inks.map(lum).filter(v => v != null);
      const worstLight = got.ground === 'light' && darkest.length ? Math.min(...darkest.map(l => (0.5 + 0.05) / (l + 0.05))) : null;
      notes.push(`${theme} page (${got.ground} tape): ${got.panes} panes, series a pane ${got.perPane.join('/')}; candles ${got.lo.toFixed(2)}–${got.hi.toFixed(2)} (${candleSpan.toFixed(2)}), axis ${got.axis?.map(v => v.toFixed(2)).join('–')} (${span.toFixed(2)})${worstLight != null ? `; worst overlay ink on the light tape ${worstLight.toFixed(2)}:1` : ''}`);
      /* price + regime + RSI = 3 panes; the axis no wider than the eight-strike floor or twice the candles' span */
      if (got.panes < 3 || errors.length) pass = false;
      if (span > Math.max(8 * 1, candleSpan * 2.2) + 0.5) pass = false;
      if (worstLight != null && worstLight < 2.9) pass = false;
      if (errors.length) notes.push(`page errors: ${errors.join(' | ')}`);
    } finally {
      await done();
    }
  }
  return { pass, ms: Date.now() - t0, notes };
});

/* ─── A SCRIPT THAT FAILS AT RUN TIME (the audit's D §3) ──────────────────────────────────────────────────────────────
   Before: a run that failed (over its budget, or asking request.*, which compiles) left its last lines drawn and the
   legend showed a normal row. */
check('scripts: a script that fails when it runs draws nothing and its legend says so', async () => {
  const { page, errors, done } = await terrain([{ ticker: 'SPY', timeframe: '5m', overlays: { trails: true }, ladder: true }]);
  try {
    const t0 = Date.now();
    const placed = await page.evaluate(async () => {
      const api = window.__paneScripts;
      if (!api) return null;
      const s = await api.save({ title: 'Fails at run', source: '//@version=6\nindicator("Fails at run", overlay=true)\nx = request.security(syminfo.tickerid, "D", close)\nplot(x)\n' });
      const cs = await api.place('terrain:1', s.id);
      return { scriptId: s.id, status: s.status, chartId: cs.id };
    });
    if (!placed) return { pass: false, notes: ['the development hook window.__paneScripts is missing'] };
    await page.waitForTimeout(2500);
    const got = await page.evaluate(() => {
      const row = document.querySelector('[data-script-legend] [data-legend-row]');
      return { legend: row?.textContent ?? null, fault: row?.querySelector('[data-legend-fault]')?.getAttribute('title') ?? null };
    });
    await page.evaluate(async p => { await window.__paneScripts.lift('terrain:1', p.chartId); }, placed);
    const pass = !!got.legend && /does not run/.test(got.legend) && !!got.fault && !errors.length;
    return { pass, ms: Date.now() - t0, notes: [`saved with status "${placed.status}"; legend: "${got.legend}"; reason: "${got.fault}"`, ...(errors.length ? [`page errors: ${errors.join(' | ')}`] : [])] };
  } finally {
    await done();
  }
});

/* ─── IN A REPLAY: ONE WAY BACK, NO LIVE ALERTS (the audit's A-164, A-60) ─────────────────────────────────────────────── */
check('replay: before a bar is picked one way back stands, and no live alert can be armed', async () => {
  const { page, errors, done } = await terrain([{ ticker: 'SPY', timeframe: '5m', overlays: { trails: true }, ladder: true }]);
  try {
    const t0 = Date.now();
    const b = await page.locator('[data-chart-ink]').first().boundingBox();
    /* the view off the last bar first, so the view's "Back to live" would stand */
    await page.mouse.move(b.x + b.width * 0.3, b.y + b.height * 0.55);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width * 0.7, b.y + b.height * 0.55, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(600);
    await page.mouse.move(b.x + b.width * 0.5, b.y + b.height * 0.55);
    await page.waitForTimeout(400);
    const before = { backLive: await page.locator('[data-back-to-live]').count(), alerts: await page.locator('button[title="Alerts"]').count() };
    await page.mouse.click(b.x + b.width * 0.3, b.y + 20);
    await page.keyboard.press('p');
    await page.waitForSelector('[data-replay-badge]', { timeout: 4000 });
    await page.mouse.move(b.x + b.width * 0.5, b.y + b.height * 0.55);
    await page.waitForTimeout(600);
    const during = { backLive: await page.locator('[data-back-to-live]').count(), alerts: await page.locator('button[title="Alerts"]').count() };
    await page.keyboard.press('Escape');
    return { pass: before.backLive === 1 && before.alerts >= 1 && during.backLive === 0 && during.alerts === 0 && !errors.length, ms: Date.now() - t0, notes: [`live, off the last bar: "Back to live" ${before.backLive}, Alerts doors ${before.alerts}; replaying before a pick: "Back to live" ${during.backLive}, Alerts doors ${during.alerts}`, ...(errors.length ? [`page errors: ${errors.join(' | ')}`] : [])] };
  } finally {
    await done();
  }
});

/* ─── FULL SCREEN KEEPS THE HEADER'S CONTROLS (the audit's A-200) ──────────────────────────────────────────────────────
   Before: F opened a strip with the identity and the toolbar alone — no age chip, no expiry window, no jumps or their
   calendar (so T did nothing), no keys door, no walls lens, bead basis or floor, no Legend door. */
check('full screen: the age, the window, the jumps, T and the legend stand there too', async () => {
  const { page, errors, done } = await terrain([{ ticker: 'SPY', timeframe: '5m', overlays: { trails: true }, ladder: true }]);
  try {
    const t0 = Date.now();
    const b = await page.locator('[data-chart-ink]').first().boundingBox();
    await page.mouse.click(b.x + b.width * 0.3, b.y + 20);
    await page.keyboard.press('f');
    await page.waitForTimeout(800);
    const extras = page.locator('[data-expanded-extras]');
    const got = {
      extras: await extras.count(),
      age: await extras.locator('[data-pane-age]').count(),
      window: await extras.locator('[data-window-pick]').count(),
      jumps: await extras.locator('[data-jump]').count(),
      legend: await extras.locator('[data-legend-door]').count(),
    };
    await page.keyboard.press('t');
    const cal = await page.waitForSelector('[data-jump-date-input]', { timeout: 3000 }).then(() => true).catch(() => false);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    const pass = got.extras === 1 && got.age === 1 && got.window >= 4 && got.jumps >= 5 && got.legend === 1 && cal && !errors.length;
    return { pass, ms: Date.now() - t0, notes: [`full screen: age chip ${got.age}, window choices ${got.window}, jumps ${got.jumps}, Legend door ${got.legend}; T ${cal ? 'opens the calendar' : 'does nothing'}`, ...(errors.length ? [`page errors: ${errors.join(' | ')}`] : [])] };
  } finally {
    await done();
  }
});

/* ---- the audit's exercise runs (2026-10-15, batch 4): each fix with its check ---------------------------------------- */
const chartOf = () => {
  const e = [...window.__charts].find(x => x.trails && x.host.isConnected && x.candles.data().length);
  return e;
};

/* C-58 / A-168: "Replay this day" from a 1D pane plays the day's session from 9:30 am New York on five-minute bars */
check('day panel: Replay this day starts the session at 9:30 am New York on 5m, or says why it cannot', async () => {
  const { page, errors, done } = await terrain([{ ticker: 'SPY', timeframe: '1D', overlays: { trails: true }, ladder: true }]);
  try {
    const t0 = Date.now();
    const notes = [];
    let day = null;
    for (let back = 0; back <= 6 && !day; back++) {
      const g = await page.evaluate(([back, f]) => {
        const e = eval(f)();
        const d = e.candles.data().filter(x => 'close' in x);
        const b = d[d.length - 1 - back];
        const r = e.host.getBoundingClientRect();
        const x = e.chart.timeScale().timeToCoordinate(b.time);
        const y = e.candles.priceToCoordinate((b.high + b.low) / 2);
        return { x: r.left + x, y: r.top + y };
      }, [back, `(${chartOf.toString()})`]);
      await page.mouse.click(g.x, g.y);
      const opened = await page.waitForSelector('[data-day-panel]', { timeout: 2500 }).then(() => true).catch(() => false);
      if (!opened) continue;
      const d = await page.getAttribute('[data-day-panel]', 'data-day-panel');
      const btn = page.locator('[data-day-replay]');
      if (await btn.isDisabled()) {
        notes.push(`${d}: not offered — "${await btn.getAttribute('title')}"`);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        continue;
      }
      day = d;
      await btn.click();
    }
    if (!day) return { pass: notes.length > 0 && notes.every(n => /minutes/.test(n)) && !errors.length, ms: Date.now() - t0, notes: ['no day on the tape holds its open', ...notes] };
    await page.waitForTimeout(5000);
    const got = await page.evaluate(() => ({ badge: document.querySelector('[data-replay-badge]')?.textContent ?? '', tf: (document.querySelector('[data-chart-state]')?.getAttribute('data-chart-state') ?? '').split('|')[1], asOf: Number(document.querySelector('[data-as-of]')?.getAttribute('data-as-of') ?? 0) }));
    const ny = got.asOf ? new Date(got.asOf).toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true }) : '';
    const nyDay = got.asOf ? new Date(got.asOf).toLocaleDateString('en-CA', { timeZone: 'America/New_York' }) : '';
    const pass = got.tf === '5m' && nyDay === day && /^9:3\d AM$/.test(ny) && !errors.length;
    notes.push(`${day}: the pane on ${got.tf}, the cursor knowable at ${ny} New York; badge "${got.badge}"`);
    return { pass, ms: Date.now() - t0, notes: [...notes, ...(errors.length ? [`page errors: ${errors.join(' | ')}`] : [])] };
  } finally {
    await done();
  }
});

/* S-1D-view / A-28: a 1D pane opens on the newest bars — every load, and from a switch — never on the oldest */
check('1D view: a 1D pane opens on the newest bars, loaded or switched to', async () => {
  const notes = [];
  let pass = true;
  const t0 = Date.now();
  for (let k = 0; k < 3; k++) {
    const { page, done } = await terrain([{ ticker: 'SPY', timeframe: k < 2 ? '1D' : '5m', overlays: { trails: true }, ladder: true }]);
    try {
      if (k === 2) {
        const tab = page.locator('[data-confluence-tabs] button[data-tf="1D"]').first();
        if (await tab.count()) await tab.click();
        else {
          await page.locator('[data-tf-trigger]').first().click();
          await page.locator('[data-tf-pick="1D"]').first().click();
        }
        await page.waitForTimeout(5000);
      }
      const r = await page.evaluate(f => {
        const e = eval(f)();
        const v = e.chart.timeScale().getVisibleRange();
        const d = e.candles.data().filter(x => 'close' in x);
        return { to: v.to, last: d[d.length - 1].time, n: d.length, back: !!document.querySelector('[data-back-to-live]') };
      }, `(${chartOf.toString()})`);
      const ok = r.to >= r.last && !r.back;
      pass &&= ok;
      notes.push(`${k < 2 ? 'loaded on 1D' : 'switched from 5m'}: ${r.n} day bars, ${ok ? 'the view reaches the newest' : 'the view stops short of the newest'}${r.back ? ', Back to live up' : ''}`);
    } finally {
      await done();
    }
  }
  return { pass, ms: Date.now() - t0, notes };
});

/* A-248 / A-220 / A-255: the named layouts are the house's card — Esc from its button closes it and leaves the full-screen
   pane; a delete acts at once and comes back on the undo */
check('layouts: Esc from the button closes the shelf, not the full screen; a delete comes back on Ctrl Z', async () => {
  const { page, errors, done } = await terrain([{ ticker: 'SPY', timeframe: '5m', overlays: { trails: true } }], { layout: 2 });
  try {
    const t0 = Date.now();
    await page.locator('[data-expand-door]').first().click();
    await page.waitForTimeout(800);
    const focusOnOpen = await page.evaluate(() => document.activeElement?.hasAttribute('data-collapse-pane') ?? false);
    await page.locator('[data-terrain-layouts]').focus();
    await page.keyboard.press('Enter');
    await page.waitForSelector('[data-popover-card="terrain-layouts"]', { timeout: 3000 });
    await page.locator('[data-terrain-layouts]').focus();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => ({ shelf: !!document.querySelector('[data-popover-card="terrain-layouts"]'), expanded: !!document.querySelector('[role=dialog][aria-label$="expanded"]') }));
    await page.locator('[data-terrain-layouts]').click();
    await page.fill('[data-layout-name]', 'Proof desk');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    const saved = await page.locator('[data-layout-recall="Proof desk"]').count();
    await page.locator('[data-layout-delete="Proof desk"]').click({ force: true });
    await page.waitForTimeout(200);
    const gone = await page.locator('[data-layout-recall="Proof desk"]').count();
    await page.keyboard.press('Escape');
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(300);
    await page.locator('[data-terrain-layouts]').click();
    const back = await page.locator('[data-layout-recall="Proof desk"]').count();
    if (back) await page.locator('[data-layout-delete="Proof desk"]').click({ force: true });
    const pass = focusOnOpen && !after.shelf && after.expanded && saved === 1 && gone === 0 && back === 1 && !errors.length;
    return { pass, ms: Date.now() - t0, notes: [`full screen focus on Collapse: ${focusOnOpen}; Esc with the keys on the button: shelf ${after.shelf ? 'still open' : 'closed'}, pane ${after.expanded ? 'still expanded' : 'collapsed'}; saved ${saved}, after delete ${gone}, after Ctrl Z ${back}`, ...(errors.length ? [`page errors: ${errors.join(' | ')}`] : [])] };
  } finally {
    await done();
  }
});

/* C-35 / C-13 / B-56: on a phone the ladder lays over the chart (the chart keeps its width), takes the keys and gives them
   back; How to read opens there with the desk's ladder off; the drawing tools are a sheet, not the rail's column */
check('phone: the ladder lays over the chart on its own ground, the keys go in and back, How to read opens, the tools are a sheet', async () => {
  const { page, errors, done } = await terrain([{ ticker: 'SPY', timeframe: '5m', overlays: { trails: true }, ladder: false }], { width: 390, height: 844 });
  try {
    const t0 = Date.now();
    const before = await page.evaluate(() => Math.round(document.querySelector('[data-chart-ink]')?.getBoundingClientRect().width ?? 0));
    const door = page.locator('[data-ladder-peek], [data-narrow-ladder]').first();
    await door.focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(700);
    const open = await page.evaluate(() => ({ w: Math.round(document.querySelector('[data-chart-ink]')?.getBoundingClientRect().width ?? 0), panel: Math.round(document.querySelector('[data-profile-panel]')?.getBoundingClientRect().width ?? 0), pos: getComputedStyle(document.querySelector('[data-profile-panel]')).position, bg: getComputedStyle(document.querySelector('[data-profile-panel]')).backgroundColor, inside: !!document.activeElement?.closest('[data-profile-panel]') }));
    /* its own ground, opaque (the after-run's shot: the chart's candles and words showed through its rows) */
    const opaque = /^rgb\(/.test(open.bg) || /^rgba\([^)]*,\s*1\)$/.test(open.bg);
    await page.locator('[data-profile-panel] [data-profile-guide]').first().click().catch(() => {});
    const guide = await page.waitForSelector('[data-popover-card="profile-guide"]', { timeout: 2500 }).then(() => true).catch(() => false);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    const closed = await page.evaluate(() => ({ panel: !!document.querySelector('[data-profile-panel]'), back: !!document.activeElement?.closest('[data-ladder-peek], [data-narrow-ladder]') }));
    const sheetDoor = await page.locator('[data-draw-sheet-door]').count();
    const pass = open.pos === 'absolute' && opaque && open.w >= before - 2 && open.inside && guide && !closed.panel && closed.back && sheetDoor >= 1 && !errors.length;
    return { pass, ms: Date.now() - t0, notes: [`chart ${before} px wide, ${open.w} px with the ladder (${open.panel} px, ${open.pos}, ground ${open.bg}${opaque ? '' : ' — see-through'}) over it; the keys ${open.inside ? 'in the ladder' : 'elsewhere'}; How to read ${guide ? 'opened' : 'did nothing'}; after Esc the ladder ${closed.panel ? 'stands' : 'closed'} and the keys ${closed.back ? 'back on its door' : 'elsewhere'}; the drawing tools: ${sheetDoor ? 'a sheet behind one door' : 'no sheet door'}`, ...(errors.length ? [`page errors: ${errors.join(' | ')}`] : [])] };
  } finally {
    await done();
  }
});

/* B-26 / B-34 / B-35: every product pane wears its name chip from the first load */
check('pane chips: the flow, regime and vol drift panes are named from the first load', async () => {
  const { page, errors, done } = await terrain([{ ticker: 'SPY', timeframe: '5m', overlays: { trails: true, regime: true, volDrift: true, flow: true }, ladder: true }]);
  try {
    const chips = await page.evaluate(() => [...document.querySelectorAll('[data-pane-chip]')].map(e => e.getAttribute('data-pane-chip')));
    const pass = ['flow', 'regime', 'volDrift'].every(k => chips.includes(k)) && !errors.length;
    return { pass, notes: [`chips: ${chips.join(', ') || 'none'}`] };
  } finally {
    await done();
  }
});

/* B-08: pinning a node in view keeps the fitted axis where it was — the node stays under the pointer */
check('pin: a node pinned in view leaves the axis where it was', async () => {
  const { page, errors, done } = await terrain([{ ticker: 'SPY', timeframe: '5m', overlays: { trails: true }, ladder: true }]);
  try {
    const t0 = Date.now();
    const at = await page.evaluate(f => {
      const e = eval(f)();
      const tr = e.trails;
      const r = e.host.getBoundingClientRect();
      const ps = e.candles.priceScale();
      const before = ps.getVisibleRange?.() ?? null;
      for (let y = Math.round(r.height * 0.35); y < r.height * 0.85; y += 3)
        for (let x = Math.round(r.width * 0.5); x < r.width * 0.85; x += 4) {
          const b = tr.beadAt(x, y);
          if (b) return { x: r.left + x, y: r.top + y, strike: b.strike, before };
        }
      return null;
    }, `(${chartOf.toString()})`);
    if (!at) return { pass: false, notes: ['no node found to pin'] };
    const range = () => page.evaluate(f => { const e = eval(f)(); const h = e.host.getBoundingClientRect().height; return [e.candles.coordinateToPrice(0), e.candles.coordinateToPrice(h * 0.8)]; }, `(${chartOf.toString()})`);
    const r0 = await range();
    await page.mouse.click(at.x, at.y);
    await page.waitForTimeout(700);
    const r1 = await range();
    const moved = Math.max(Math.abs(r1[0] - r0[0]), Math.abs(r1[1] - r0[1]));
    const still = await page.evaluate(([f, x, y]) => { const e = eval(f)(); const r = e.host.getBoundingClientRect(); return e.trails.beadAt(x - r.left, y - r.top)?.strike ?? null; }, [`(${chartOf.toString()})`, at.x, at.y]);
    await page.keyboard.press('Escape');
    const pass = moved < 0.01 && still === at.strike && !errors.length;
    return { pass, ms: Date.now() - t0, notes: [`pinned ${at.strike}: the axis moved ${moved.toFixed(3)}; under the pointer after: ${still}`] };
  } finally {
    await done();
  }
});

/* C-40 / C-50: with the market shut and no column today, the decision strip's regime reads the last session, dated */
check('regime at night: the strip reads the last session, dated, never a bare dash', async () => {
  const { page, errors, done } = await terrain([{ ticker: 'SPY', timeframe: '5m', overlays: { trails: true }, ladder: true }]);
  try {
    const box = await page.evaluate(() => {
      const b = document.querySelector('[data-decision-box="regime"]');
      return b ? { text: b.textContent ?? '', title: b.getAttribute('title') ?? '' } : null;
    });
    const live = await page.evaluate(() => document.querySelector('[data-pane-age]')?.getAttribute('data-pane-age'));
    if (live === 'live') return { pass: true, notes: [`the market is open (the age chip reads live) — the night's case does not arise: "${box?.text}"`] };
    const pass = !!box && !/^Regime\s*—$/.test(box.text.trim()) && /amplify|absorb/.test(box.text + box.title) && !errors.length;
    return { pass, notes: [`regime box: "${box?.text}" — title "${box?.title.slice(0, 140)}"`] };
  } finally {
    await done();
  }
});

/* A-17 / B-44 / the readout: with the pointer on the plot the hover row covers none of the chrome under the strip */
check('hover row: the readout and the legends stand clear of the hover row', async () => {
  const { page, errors, done } = await terrain([{ ticker: 'SPY', timeframe: '5m', overlays: { trails: true }, ladder: true }]);
  try {
    const b = await page.locator('[data-chart-ink]').first().boundingBox();
    await page.mouse.move(b.x + b.width * 0.5, b.y + b.height * 0.55);
    await page.waitForTimeout(800);
    const r = await page.evaluate(() => {
      const box = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? r : null; };
      const row = [...document.querySelectorAll('[data-toolbar-row]')].map(box).find(Boolean);
      const others = [...document.querySelectorAll('[data-chart-chrome], [data-script-legend]')].map(e => ({ e, r: box(e) })).filter(x => x.r && !x.e.contains(document.querySelector('[data-toolbar-row]')));
      const hit = row ? others.filter(o => Math.min(o.r.right, row.right) - Math.max(o.r.left, row.left) > 1 && Math.min(o.r.bottom, row.bottom) - Math.max(o.r.top, row.top) > 1) : [];
      return { row: !!row, n: others.length, hit: hit.length };
    });
    const pass = r.row && r.hit === 0 && !errors.length;
    return { pass, notes: [`hover row ${r.row ? 'shown' : 'not shown'}; ${r.hit} of ${r.n} chrome boxes under it`] };
  } finally {
    await done();
  }
});

/* A-244: T on a pane whose jumps were shed for room still opens the calendar */
check('T key: a narrow pane with its jumps shed still opens the calendar', async () => {
  const { page, errors, done } = await terrain([{ ticker: 'SPY', timeframe: '5m', overlays: { trails: true }, ladder: true }], { layout: 4, width: 1280, height: 800 });
  try {
    const form = await page.evaluate(() => document.querySelector('[data-pane-head]')?.getAttribute('data-jump-form'));
    const b = await page.locator('[data-chart-ink]').first().boundingBox();
    await page.mouse.click(b.x + b.width * 0.4, b.y + 30);
    await page.keyboard.press('t');
    const cal = await page.waitForSelector('[data-jump-date-input]', { timeout: 3000 }).then(() => true).catch(() => false);
    await page.keyboard.press('Escape');
    return { pass: cal && !errors.length, notes: [`the first pane's jumps: ${form}; T ${cal ? 'opens the calendar' : 'opens nothing'}`] };
  } finally {
    await done();
  }
});

/* A-22: the rail prints the change with the true minus, as the pane head does */
check('rail: the change wears the true minus', async () => {
  const { page, errors, done } = await terrain([{ ticker: 'SPY', timeframe: '5m', overlays: { trails: true } }]);
  try {
    const t = await page.evaluate(() => [...document.querySelectorAll('[data-subject]')].map(e => e.textContent + ' ' + (e.getAttribute('data-tip') ?? '') + ' ' + (e.getAttribute('aria-label') ?? '')).join(' | '));
    const hyphen = /(^|\s)-\d/.test(t);
    return { pass: !hyphen && !errors.length, notes: [`the rail's subject: "${t.slice(0, 160)}"`] };
  } finally {
    await done();
  }
});

/* ---- batch 4, the checks for the fixes with no check above -------------------------------------------------------- */
/* every word a canvas writes, with its font — the cone tag, the session phases, the VPOC (B-29, B-31, C-11) */
const recordCanvasWords = () => {
  const words = [];
  window.__canvasWords = words;
  const f = CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText = function (text, x, y, w) {
    if (words.length < 40000) words.push({ text: String(text), font: this.font, h: this.canvas.height / Math.max(1, this.canvas.clientHeight || this.canvas.height) });
    return f.call(this, text, x, y, w);
  };
};
const cssPx = w => {
  const m = /(\d+(?:\.\d+)?)px/.exec(w.font);
  return m ? Number(m[1]) / (w.h || 1) : null;
};

check('canvas words: the cone tag, the session phases and the VPOC at 11 px, the tag through the house formatter', async () => {
  const { page, errors, done } = await terrain([{ ticker: 'SPY', timeframe: '5m', overlays: { trails: true, cone: true, phases: true }, ladder: true }], { init: recordCanvasWords, block: u => u.pathname.startsWith('/feed/') });
  try {
    await page.locator('[data-profile-panel] button[title^="Volume profile"]').first().click().catch(() => {});
    await page.waitForTimeout(2500);
    const words = await page.evaluate(() => window.__canvasWords.slice(-6000));
    const pick = re => words.filter(w => re.test(w.text));
    const em = pick(/^EM ±/);
    const phases = pick(/^(lunch|power hour|after hours|the open|pre-market|open)$/i);
    const vpoc = pick(/^VPOC$/);
    const sizes = list => [...new Set(list.map(cssPx).filter(v => v != null).map(v => Math.round(v * 10) / 10))];
    const okSize = list => list.length > 0 && list.every(w => (cssPx(w) ?? 0) >= 10.9);
    const emFormat = em.every(w => /^EM ±\$\d{1,3}(,\d{3})*\.\d{2}$/.test(w.text));
    const pass = okSize(em) && emFormat && okSize(phases) && okSize(vpoc) && !errors.length;
    return { pass, notes: [`cone tag "${em[0]?.text ?? '—'}" at ${sizes(em).join(', ') || '—'} px; phase words ${[...new Set(phases.map(w => w.text))].join(', ') || '—'} at ${sizes(phases).join(', ') || '—'} px; VPOC at ${sizes(vpoc).join(', ') || '—'} px`] };
  } finally {
    await done();
  }
});

check('Net view: the puts lean left of the centre line, as the Sides view and the spine keep them', async () => {
  const { page, errors, done } = await terrain([{ ticker: 'SPY', timeframe: '5m', overlays: { trails: true }, ladder: true }]);
  try {
    await page.locator('[data-profile-view="net"]').first().click().catch(() => {});
    await page.waitForTimeout(800);
    const r = await page.evaluate(() => {
      const c = document.querySelector('[data-profile-panel] canvas');
      const g = c.getContext('2d');
      const { width: W, height: H } = c;
      const d = g.getImageData(0, 0, W, H).data;
      let vx = 0, vn = 0, gx = 0, gn = 0;
      for (let y = Math.round(H * 0.15); y < H * 0.95; y += 2)
        for (let x = 0; x < W; x += 2) {
          const k = (y * W + x) * 4;
          const [R, G, B] = [d[k], d[k + 1], d[k + 2]];
          if (B > R + 40 && B > G + 60) { vx += x; vn++; }
          else if (R > 170 && G > 130 && B < 110 && R - B > 90) { gx += x; gn++; }
        }
      return { violet: vn ? vx / vn / W : null, gold: gn ? gx / gn / W : null, vn, gn };
    });
    const pass = r.violet != null && r.gold != null && r.violet < r.gold && !errors.length;
    return { pass, notes: [`violet (the puts, amplify) at ${r.violet?.toFixed(2)} of the width (${r.vn} px), gold (the calls, absorb) at ${r.gold?.toFixed(2)} (${r.gn} px)`] };
  } finally {
    await done();
  }
});

check('ladder: a drag of the width grip pins no strike', async () => {
  const { page, errors, done } = await terrain([{ ticker: 'SPY', timeframe: '5m', overlays: { trails: true }, ladder: true }], { layout: 3 });
  try {
    const before = await page.evaluate(() => [...window.__charts].find(x => x.trails && x.host.isConnected)?.trails.focusStrike ?? null);
    const grip = await page.locator('[data-profile-grip]').first().boundingBox();
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
    await page.mouse.down();
    await page.mouse.move(grip.x - 30, grip.y + grip.height / 2, { steps: 6 });
    await page.mouse.move(grip.x - 60, grip.y + grip.height * 0.6, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => [...window.__charts].find(x => x.trails && x.host.isConnected)?.trails.focusStrike ?? null);
    return { pass: before == null && after == null && !errors.length, notes: [`the chart's kept strike: before ${before ?? 'none'}, after the grip drag ${after ?? 'none'}`] };
  } finally {
    await done();
  }
});

check('Move box: with no book yet no σ is measured from a price the pane does not hold', async () => {
  const { page, errors, done } = await terrain([{ ticker: 'SPY', timeframe: '5m', overlays: { trails: true }, ladder: true }], { block: /\/spot-exposures\/strike/ });
  try {
    const move = await page.evaluate(() => document.querySelector('[data-decision-box="move"]')?.textContent ?? null);
    return { pass: move != null && !/σ day/.test(move) && !errors.length, notes: [`Move box: "${move}"`] };
  } finally {
    await done();
  }
});

check('scripts: an overlay script far off the candles leaves the fitted axis where the candles put it', async () => {
  const { page, errors, done } = await terrain([{ ticker: 'SPY', timeframe: '5m', overlays: { trails: true }, ladder: true }]);
  try {
    const span = () => page.evaluate(() => {
      const e = [...window.__charts].find(x => x.trails && x.host.isConnected && x.candles.data().length);
      const h = e.host.getBoundingClientRect().height;
      return Math.abs(e.candles.coordinateToPrice(h * 0.2) - e.candles.coordinateToPrice(h * 0.8));
    });
    const s0 = await span();
    const placed = await page.evaluate(async () => {
      const api = window.__paneScripts;
      const s = await api.save({ title: 'Far off', source: '//@version=6\nindicator("Far off", overlay=true)\nplot(close * 1.25)\n' });
      const cs = await api.place('terrain:1', s.id);
      return { chartId: cs.id };
    });
    await page.waitForTimeout(2500);
    const s1 = await span();
    await page.evaluate(async p => { await window.__paneScripts.lift('terrain:1', p.chartId); }, placed);
    return { pass: s1 <= s0 * 1.05 && !errors.length, notes: [`the axis over 60% of the height: ${s0.toFixed(2)} before, ${s1.toFixed(2)} with the script plotting 25% above the price`] };
  } finally {
    await done();
  }
});

/* ─── PINE'S barcolor() COLOURS THE CANDLES (the owner's approval 13, 2026-10-15: "barcolor(): implement it") ─────────────
   Before: the runtime ran barcolor() and kept its colours, and nothing read them — every candle kept its theme's colours.
   A script with `barcolor(close > open ? color.blue : na)` on a pane: every rising candle wears one blue on its body,
   border and wick (a hollow theme's rising body stays hollow), every other candle none, and lifting the script gives the
   candles back their own. In a replay the candles wear it up to the cursor and none past it. */
const BARCOLOR_SRC = '//@version=6\nindicator("Blue rises", overlay=true)\nbarcolor(close > open ? color.blue : na)\n';
/** The pane's candles read for their colours: the rising ones coloured, the others not, and the one ink they share */
const readBarColours = page =>
  page.evaluate(() => {
    /* the pane's own chart — on screen (the Journal's recap draws an off-screen chart of its own, on a rewound clock), the
       replaying one in a replay */
    const onScreen = el => {
      const r = el?.getBoundingClientRect();
      return !!r && el.isConnected && r.width > 0 && r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight;
    };
    const box = [...document.querySelectorAll('[data-as-of]')].find(onScreen) ?? null;
    const e = [...window.__charts].find(x => (box ? x.box() === box : onScreen(x.box())) && x.candles.data().length);
    if (!e) return { bars: 0, rising: 0, risingOk: 0, hollowRising: 0, other: 0, otherBare: 0, coloured: 0, inks: [], last: null, cursor: null, past: 0 };
    const rows = e.candles.data().filter(d => 'open' in d);
    const inks = new Set();
    let rising = 0;
    let risingOk = 0;
    let hollowRising = 0;
    let other = 0;
    let otherBare = 0;
    let coloured = 0;
    for (const d of rows) {
      const any = d.color !== undefined || d.borderColor !== undefined || d.wickColor !== undefined;
      if (any) coloured++;
      if (d.close > d.open) {
        rising++;
        if (d.wickColor && d.borderColor === d.wickColor && d.color !== undefined) {
          risingOk++;
          inks.add(d.wickColor);
          if (d.color !== d.wickColor) hollowRising++;
        }
      } else {
        other++;
        /* a flat or falling candle wears nothing */
        if (!any) otherBare++;
      }
    }
    const cursor = box ? Number(box.getAttribute('data-as-of')) / 1000 - 60 : null;
    return { bars: rows.length, rising, risingOk, hollowRising, other, otherBare, coloured, inks: [...inks], last: rows.at(-1)?.time ?? null, cursor, past: cursor == null ? 0 : rows.filter(d => d.time > cursor).length };
  });
const placeBarScript = page =>
  page.evaluate(async src => {
    const api = window.__paneScripts;
    if (!api) return null;
    const s = await api.save({ title: 'Blue rises', source: src });
    const cs = await api.place('terrain:1', s.id);
    return { chartId: cs.id, status: s.status };
  }, BARCOLOR_SRC);
/** A blue ink (its blue channel the largest) — Pine's color.blue, or its light tape's cut */
const isBlue = css => {
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(css ?? '');
  const fn = /^rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(css ?? '');
  const c = hex ? hex.slice(1, 4).map(v => parseInt(v, 16)) : fn ? fn.slice(1, 4).map(Number) : null;
  return !!c && c[2] > c[0] && c[2] > c[1];
};

check('scripts: barcolor() colours the rising candles and lifting the script gives them back', async () => {
  const { page, errors, done } = await terrain([{ ticker: 'SPY', timeframe: '5m', overlays: { trails: true }, ladder: true }]);
  try {
    const t0 = Date.now();
    const placed = await placeBarScript(page);
    if (!placed) return { pass: false, notes: ['the development hook window.__paneScripts is missing'] };
    await page.waitForTimeout(2500);
    const on = await readBarColours(page);
    await page.evaluate(async p => { await window.__paneScripts.lift('terrain:1', p.chartId); }, placed);
    await page.waitForTimeout(2000);
    const off = await readBarColours(page);
    const onOk = on.rising > 0 && on.risingOk === on.rising && on.otherBare === on.other && on.inks.length === 1 && isBlue(on.inks[0]) && on.hollowRising === 0;
    const offOk = off.coloured === 0;
    return {
      pass: onOk && offOk && !errors.length,
      ms: Date.now() - t0,
      notes: [
        `saved with status "${placed.status}"; on: ${on.risingOk} of ${on.rising} rising candles in ${on.inks.join(', ') || 'no ink'} (body, border and wick), ${on.other - on.otherBare} of ${on.other} others coloured, over ${on.bars} candles`,
        `lifted: ${off.coloured} of ${off.bars} candles still coloured`,
        ...(errors.length ? [`page errors: ${errors.join(' | ')}`] : []),
      ],
    };
  } finally {
    await done();
  }
});

check('scripts: barcolor() keeps a hollow theme\'s rising bodies hollow (Neon under the blue-orange pair)', async () => {
  const { page, errors, done } = await terrain([{ ticker: 'SPY', timeframe: '5m', theme: 'classic', overlays: { trails: true }, ladder: true }], { cvd: 'blue-orange' });
  try {
    const t0 = Date.now();
    const placed = await placeBarScript(page);
    if (!placed) return { pass: false, notes: ['the development hook window.__paneScripts is missing'] };
    await page.waitForTimeout(2500);
    const on = await readBarColours(page);
    await page.evaluate(async p => { await window.__paneScripts.lift('terrain:1', p.chartId); }, placed);
    const pass = on.rising > 0 && on.risingOk === on.rising && on.hollowRising === on.rising && on.otherBare === on.other && on.inks.length === 1 && isBlue(on.inks[0]) && !errors.length;
    return { pass, ms: Date.now() - t0, notes: [`${on.hollowRising} of ${on.rising} rising candles hollow with a ${on.inks.join(', ') || 'missing'} border and wick; ${on.other - on.otherBare} of ${on.other} others coloured`, ...(errors.length ? [`page errors: ${errors.join(' | ')}`] : [])] };
  } finally {
    await done();
  }
});

check('replay: a barcolor() script colours the candles up to the cursor, none past it', async () => {
  const { page, errors, done } = await terrain([{ ticker: 'SPY', timeframe: '5m', overlays: { trails: true }, ladder: true }]);
  try {
    const t0 = Date.now();
    const placed = await placeBarScript(page);
    if (!placed) return { pass: false, notes: ['the development hook window.__paneScripts is missing'] };
    await page.waitForTimeout(1500);
    const b = await page.locator('[data-chart-ink]').first().boundingBox();
    const head = await page.locator('[data-pane-head]').first().boundingBox();
    await page.mouse.click(head.x + head.width * 0.6, head.y + head.height / 2);
    await page.keyboard.press('p');
    await page.waitForTimeout(600);
    await page.mouse.click(b.x + b.width * 0.5, b.y + b.height * 0.5);
    await page.waitForFunction(() => !!document.querySelector('[data-as-of]'), null, { timeout: 8000 });
    await page.waitForTimeout(2000);
    const got = await readBarColours(page);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);
    await page.evaluate(async p => { await window.__paneScripts.lift('terrain:1', p.chartId); }, placed);
    const ny = t => (t == null ? '—' : new Date(t * 1000).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }));
    const pass = got.cursor != null && got.past === 0 && got.rising > 0 && got.risingOk === got.rising && got.otherBare === got.other && got.inks.length === 1 && isBlue(got.inks[0]) && !errors.length;
    return { pass, ms: Date.now() - t0, notes: [`cursor ${ny(got.cursor)} New York, last candle ${ny(got.last)}, ${got.past} candles past it; ${got.risingOk} of ${got.rising} rising candles in ${got.inks.join(', ') || 'no ink'}, ${got.other - got.otherBare} of ${got.other} others coloured`, ...(errors.length ? [`page errors: ${errors.join(' | ')}`] : [])] };
  } finally {
    await done();
  }
});

check('replay pick: the line stands at the pointer with the drawing rail docked left', async () => {
  const { page, errors, done } = await terrain([{ ticker: 'SPY', timeframe: '5m', overlays: { trails: true }, ladder: true }]);
  try {
    const b = await page.locator('[data-chart-ink]').first().boundingBox();
    /* the pane made active on its time axis (no node, no chrome there), then P — its replay's pick */
    await page.mouse.click(b.x + b.width * 0.4, b.y + b.height - 12);
    await page.keyboard.press('p');
    await page.waitForSelector('[data-pick-time]', { timeout: 5000 }).catch(() => {});
    const x = b.x + b.width * 0.45;
    await page.mouse.move(x, b.y + b.height * 0.5);
    await page.waitForTimeout(300);
    const line = await page.locator('[data-pick-line]').first().boundingBox({ timeout: 3000 }).catch(() => null);
    const off = line ? line.x - x : null;
    await page.keyboard.press('Escape');
    return { pass: off != null && Math.abs(off) <= 2 && !errors.length, notes: [`the pick line ${off == null ? 'not drawn' : `${off.toFixed(1)} px from the pointer`}`] };
  } finally {
    await done();
  }
});

check('field words: the chips, pills and gap notes are painted by a view over the candles', async () => {
  const { page, errors, done } = await terrain([{ ticker: 'SPY', timeframe: '5m', overlays: { trails: true }, ladder: true }]);
  try {
    const r = await page.evaluate(() => {
      const e = [...window.__charts].find(x => x.trails && x.host.isConnected);
      return { orders: e.trails.paneViews().map(v => v.zOrder()), words: typeof e.trails.pendingWords };
    });
    return { pass: r.orders.includes('bottom') && r.orders.includes('top') && r.words === 'function' && !errors.length, notes: [`the field's views: ${r.orders.join(', ')}; this frame's words ${r.words === 'function' ? 'handed to the top view' : 'none'}`] };
  } finally {
    await done();
  }
});

check('volume: the sessions before today carry their volume', async () => {
  const { page, errors, done } = await terrain([{ ticker: 'SPY', timeframe: '5m', overlays: { trails: true, volume: true }, ladder: true }]);
  try {
    await page.waitForTimeout(8000);
    const r = await page.evaluate(() => {
      const e = [...window.__charts].find(x => x.trails && x.host.isConnected && x.candles.data().length);
      const vol = e.chart.panes()[0].getSeries().find(s => s.seriesType() === 'Histogram' && s.data().length > 50);
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
      const past = (vol?.data() ?? []).filter(p => new Date(p.time * 1000).toLocaleDateString('en-CA', { timeZone: 'America/New_York' }) < today);
      return { n: past.length, withVol: past.filter(p => (p.value ?? 0) > 0).length };
    });
    return { pass: r.n > 0 && r.withVol / r.n > 0.9 && !errors.length, notes: [`${r.withVol} of ${r.n} bars of the sessions before today carry volume`] };
  } finally {
    await done();
  }
});

check('guide: How to read speaks gold and violet, never orange and blue', async () => {
  const { page, errors, done } = await terrain([{ ticker: 'SPY', timeframe: '5m', overlays: { trails: true }, ladder: true }]);
  try {
    await page.locator('[data-profile-guide]').first().click();
    const card = await page.waitForSelector('[data-popover-card="profile-guide"]', { timeout: 3000 }).catch(() => null);
    const text = card ? await card.textContent() : '';
    await page.keyboard.press('Escape');
    const pass = !!card && /violet/i.test(text) && /gold/i.test(text) && !/\borange\b|\bblue\b/i.test(text) && !errors.length;
    return { pass, notes: [`guide ${card ? 'open' : 'missing'}; violet ${/violet/i.test(text)}, gold ${/gold/i.test(text)}, orange/blue ${/\borange\b|\bblue\b/i.test(text)}`] };
  } finally {
    await done();
  }
});

check('pop-out: a pane in its own window shows no keys door; the Overlays door has a name', async () => {
  const { page, errors, done } = await terrain([{ ticker: 'SPY', timeframe: '5m', overlays: { trails: true }, ladder: true }]);
  try {
    const name = await page.locator('button[title="Overlays"]').first().getAttribute('aria-label');
    await page.goto(`${base}/out/terrain`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-chart-ink]', { timeout: 30_000 });
    await page.waitForTimeout(1500);
    const keys = await page.locator('[data-pane-keys]').count();
    return { pass: keys === 0 && (name === null || /Overlays/.test(name)) && !errors.length, notes: [`pop-out keys doors: ${keys}; the Overlays door's name: ${name ?? '(its words)'}`] };
  } finally {
    await done();
  }
});

/* the house's overlay contract on the toolbar's menus (A-54/A-55) and the pin's Esc a mode on the layer stack (B-08) */
check('menus: Esc closes the toolbar menu and keeps the pin; the keys go into the menu and back to its door', async () => {
  const { page, errors, done } = await terrain([{ ticker: 'SPY', timeframe: '5m', overlays: { trails: true }, ladder: true }]);
  try {
    const at = await page.evaluate(() => {
      const e = [...window.__charts].find(x => x.trails && x.host.isConnected && x.candles.data().length);
      const r = e.host.getBoundingClientRect();
      for (let y = Math.round(r.height * 0.35); y < r.height * 0.85; y += 3)
        for (let x = Math.round(r.width * 0.5); x < r.width * 0.85; x += 4) {
          const b = e.trails.beadAt(x, y);
          if (b) return { x: r.left + x, y: r.top + y, strike: b.strike };
        }
      return null;
    });
    if (!at) return { pass: false, notes: ['no node to pin'] };
    await page.mouse.click(at.x, at.y);
    await page.waitForTimeout(400);
    const pin = () => page.evaluate(() => [...window.__charts].find(x => x.trails && x.host.isConnected)?.trails.focusStrike ?? null);
    const pinned = await pin();
    const door = page.locator('button[title="Overlays"]').first();
    await door.focus();
    await page.keyboard.press('Enter');
    await page.waitForSelector('[data-toolbar-menu]', { timeout: 3000 });
    await page.waitForTimeout(200);
    const inMenu = await page.evaluate(() => !!document.activeElement?.closest('[data-toolbar-menu]'));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    const after = await page.evaluate(() => ({ menu: !!document.querySelector('[data-toolbar-menu]'), onDoor: document.activeElement?.getAttribute('title') === 'Overlays' }));
    const stillPinned = await pin();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    const released = await pin();
    const pass = pinned === at.strike && inMenu && !after.menu && after.onDoor && stillPinned === at.strike && released == null && !errors.length;
    return { pass, notes: [`pinned ${pinned}; the keys ${inMenu ? 'in the menu' : 'not in the menu'} on open; Esc: menu ${after.menu ? 'still open' : 'closed'}, keys ${after.onDoor ? 'back on its door' : 'elsewhere'}, pin ${stillPinned ?? 'gone'}; a second Esc: pin ${released ?? 'let go'}`] };
  } finally {
    await done();
  }
});

/* ─── A PRESS IN THE DRAWING SHEET IS NOT A PRESS ON THE CHART (the audit's B-59) ────────────────────────────────────
   Before: the sheet is portalled into the chart's box, so a tab or a tile pressed over a node bubbled to the chart's
   click and pinned that node; its card (which takes the pointer) then stood where the first trend line began, and the
   drag was lost. */
check('drawings: a press in the sheet pins no node, and the first drag after a pick draws', async () => {
  const { page, errors, done } = await terrain([{ ticker: 'SPY', timeframe: '1m', overlays: { trails: true }, ladder: true }]);
  try {
    await page.evaluate(() => {
      const e = [...window.__charts].find(x => x.trails && x.host.isConnected && x.candles.data().length);
      const s = e.trails.snapshots;
      const last = s[s.length - 1].time;
      e.chart.timeScale().setVisibleRange({ from: last - 80 * 60, to: last + 5 * 60 });
    });
    await page.waitForTimeout(600);
    await page.locator('[data-chart-rail]').first().hover();
    await page.locator('[data-draw-sheet-door]').first().click();
    await page.waitForSelector('[data-draw-sheet]', { timeout: 3000 });
    /* a tab of the sheet with a node under its middle (tabs leave the sheet open) */
    const over = await page.evaluate(() => {
      const e = [...window.__charts].find(x => x.trails && x.host.isConnected);
      const r = e.host.getBoundingClientRect();
      for (const el of document.querySelectorAll('[data-draw-sheet] [data-draw-tab], [data-draw-sheet] [data-draw-tile]')) {
        const b = el.getBoundingClientRect();
        for (const [fx, fy] of [[0.5, 0.5], [0.25, 0.5], [0.75, 0.5], [0.5, 0.25], [0.5, 0.75]]) {
          const x = b.left + b.width * fx;
          const y = b.top + b.height * fy;
          const n = e.trails.beadAt(x - r.left, y - r.top);
          if (n) return { x, y, strike: n.strike, what: el.getAttribute('data-draw-tab') ? 'tab' : 'tile' };
        }
      }
      return null;
    });
    const notes = [];
    let pass = true;
    if (over) {
      if (over.what === 'tab') await page.mouse.click(over.x, over.y);
      else await page.mouse.move(over.x, over.y);
      await page.waitForTimeout(350);
      const st = await page.evaluate(() => ({
        card: document.querySelector('[data-bead-card]')?.getAttribute('data-bead-card') ?? null,
        pin: [...window.__charts].find(x => x.trails && x.host.isConnected)?.trails.focusStrike ?? null,
      }));
      notes.push(`a ${over.what} over the ${over.strike} node ${over.what === 'tab' ? 'pressed' : 'hovered'}: card ${st.card ?? 'none'}, pin ${st.pin ?? 'none'}`);
      if (st.card || st.pin != null) pass = false;
    } else notes.push('no node under the sheet in this view (the press-through part not exercised)');
    if (!(await page.locator('[data-draw-sheet]').count())) await page.locator('[data-draw-sheet-door]').first().click();
    await page.locator('[data-draw-search]').fill('');
    await page.locator('[data-draw-search]').fill('trend');
    await page.locator('[data-draw-tile="trend"]').first().click();
    await page.waitForTimeout(350);
    const count = () => page.evaluate(() => {
      let n = 0;
      for (const k of Object.keys(localStorage)) if (k.startsWith('slayer_chart_drawings_')) n += JSON.parse(localStorage.getItem(k) || '[]').length;
      return n;
    });
    const n0 = await count();
    const b = await page.locator('[data-chart-ink]').first().boundingBox();
    const a = { x: b.x + b.width * 0.32, y: b.y + b.height * 0.42 };
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(a.x + 140, a.y + 60, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(600);
    const n1 = await count();
    notes.push(`the first drag after the pick: drawings ${n0} → ${n1}`);
    if (n1 !== n0 + 1) pass = false;
    if (errors.length) {
      pass = false;
      notes.push(...errors);
    }
    return { pass, notes };
  } finally {
    await done();
  }
});

/* ─── EVERY CARD ON THE CHART CLOSES ON ITS OWN ESC (the audit's h: the house's overlay contract, ui/layers.ts) ─────────
   Before: the drawing sheet, the rail's family list, the level-alert card and the chart's right-click card each had a
   capture-phase Escape of their own, and the alerts field stopped the key — so the field's Esc did nothing once the
   toolbar menu joined the layer stack, and the level-alert card's Esc let the pin go with it. */
check('menus: Esc closes the drawing sheet, the right-click card and the alerts field\'s menu, one at a time, and keeps the pin', async () => {
  const { page, errors, done } = await terrain([{ ticker: 'SPY', timeframe: '5m', overlays: { trails: true }, ladder: true }]);
  try {
    const at = await page.evaluate(() => {
      const e = [...window.__charts].find(x => x.trails && x.host.isConnected && x.candles.data().length);
      const r = e.host.getBoundingClientRect();
      for (let y = Math.round(r.height * 0.35); y < r.height * 0.85; y += 3)
        for (let x = Math.round(r.width * 0.5); x < r.width * 0.85; x += 4) {
          const b = e.trails.beadAt(x, y);
          if (b) return { x: r.left + x, y: r.top + y, strike: b.strike };
        }
      return null;
    });
    if (!at) return { pass: false, notes: ['no node to pin'] };
    await page.mouse.click(at.x, at.y);
    await page.waitForTimeout(400);
    const pin = () => page.evaluate(() => [...window.__charts].find(x => x.trails && x.host.isConnected)?.trails.focusStrike ?? null);
    const notes = [`pinned ${await pin()}`];
    let pass = (await pin()) === at.strike;
    const step = async (what, open, sel) => {
      await open();
      const shown = await page.waitForSelector(sel, { timeout: 3000 }).then(() => true).catch(() => false);
      await page.waitForTimeout(200);
      const inside = await page.evaluate(sel => !!document.activeElement?.closest(sel), sel);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(250);
      const still = await page.locator(sel).count();
      const p = await pin();
      notes.push(`${what}: ${shown ? 'open' : 'never opened'}, keys ${inside ? 'inside' : 'outside'}; Esc → ${still ? 'still open' : 'closed'}, pin ${p ?? 'gone'}`);
      if (!shown || !inside || still || p !== at.strike) pass = false;
    };
    await step(
      'the drawing sheet',
      async () => {
        await page.locator('[data-chart-rail]').first().hover();
        await page.locator('[data-draw-sheet-door]').first().click();
      },
      '[data-draw-sheet]'
    );
    /* a right-click: the level-alert card near a level, the chart's own card elsewhere */
    const b = await page.locator('[data-chart-ink]').first().boundingBox();
    await step('the right-click card', () => page.mouse.click(b.x + b.width * 0.45, b.y + b.height * 0.3, { button: 'right' }), '[data-chart-menu="level-alert"], [role="menu"][aria-label="Chart"]');
    await step(
      'the alerts menu, Esc from its price field',
      async () => {
        await page.locator('button[title="Alerts"]').first().click();
        await page.waitForSelector('[data-toolbar-menu] input[aria-label^="Alert price"]', { timeout: 3000 });
        await page.locator('[data-toolbar-menu] input[aria-label^="Alert price"]').first().focus();
      },
      '[data-toolbar-menu]'
    );
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    const released = await pin();
    notes.push(`a last Esc: pin ${released ?? 'let go'}`);
    if (released != null) pass = false;
    if (errors.length) {
      pass = false;
      notes.push(...errors);
    }
    return { pass, notes };
  } finally {
    await done();
  }
});

/* ─── THE LADDER'S SASH, ITS NET HEAD AND ITS LANE NAMES (the audit's C-29b, C-16, C-09) ───────────────────────────────
   Before: a drag of the lanes' sash ended as a click and pinned the strike under it; the Net view drew its Δ figures under
   no head; at the rest widths the lane names were laid out 0–28 px wide (in the DOM, never read). */
check('ladder: a drag of the lanes\' sash pins no strike; the Net view heads its Δ column; a lane name stands only where it fits', async () => {
  const { page, errors, done } = await terrain([{ ticker: 'SPY', timeframe: '5m', overlays: { trails: true }, ladder: true, lane: 'both' }], { init: recordCanvasWords });
  try {
    const notes = [];
    let pass = true;
    const kept = () => page.evaluate(() => [...window.__charts].find(x => x.trails && x.host.isConnected)?.trails.focusStrike ?? null);
    const sash = await page.locator('[data-profile-split-grip]').first().boundingBox({ timeout: 3000 }).catch(() => null);
    if (!sash) {
      pass = false;
      notes.push('no sash between the lanes');
    } else {
      /* area C's own gestures: a drag right toward the strike column, then a double-click on the sash (its reset) */
      const y = sash.y + sash.height * 0.55;
      await page.mouse.move(sash.x + sash.width / 2, y);
      await page.mouse.down();
      await page.mouse.move(sash.x + sash.width / 2 + 30, y, { steps: 4 });
      await page.mouse.move(sash.x + sash.width / 2 + 60, y, { steps: 4 });
      await page.mouse.up();
      await page.waitForTimeout(400);
      const k1 = await kept();
      const g2 = await page.locator('[data-profile-split-grip]').first().boundingBox();
      await page.mouse.dblclick(g2.x + g2.width / 2, g2.y + g2.height * 0.55);
      await page.waitForTimeout(400);
      const k2 = await kept();
      notes.push(`the chart keeps ${k1 ?? 'no strike'} after the sash drag, ${k2 ?? 'no strike'} after its double-click`);
      if (k1 != null || k2 != null) pass = false;
    }
    const heads = await page.$$eval('[data-lane-head]', es => es.map(e => ({ lane: e.getAttribute('data-lane-head'), w: Math.round(e.getBoundingClientRect().width) })));
    notes.push(`lane names: ${heads.length ? heads.map(h => `${h.lane} ${h.w} px`).join(', ') : 'none drawn (the column heads name the lanes)'}`);
    if (heads.some(h => h.w < 40)) pass = false;
    await page.locator('[data-profile-view="net"]').first().click().catch(() => {});
    await page.evaluate(() => window.__canvasWords.splice(0));
    await page.waitForTimeout(1200);
    const words = await page.evaluate(() => window.__canvasWords.map(w => w.text));
    const deltaHead = words.some(t => /^Δ SPOT/.test(t));
    notes.push(`the Net view's Δ head ${deltaHead ? 'drawn' : 'missing'}`);
    if (!deltaHead) pass = false;
    if (errors.length) {
      pass = false;
      notes.push(...errors);
    }
    return { pass, notes };
  } finally {
    await done();
  }
});

/* ─── THE NOTE'S WORDS FIELD STANDS AT THE CLICK (the audit's B-63) ────────────────────────────────────────────────────
   Before: with the drawing rail docked left the field stood 56 px left of the click. */
check('note: the words field opens at the click with the drawing rail docked left', async () => {
  const { page, errors, done } = await terrain([{ ticker: 'SPY', timeframe: '5m', overlays: { trails: true }, ladder: true }]);
  try {
    await page.locator('[data-chart-rail]').first().hover();
    await page.locator('[data-draw-sheet-door]').first().click();
    await page.waitForSelector('[data-draw-sheet]', { timeout: 3000 });
    await page.locator('[data-draw-search]').fill('note');
    await page.locator('[data-draw-tile="note"]').first().click();
    await page.waitForTimeout(350);
    const b = await page.locator('[data-chart-ink]').first().boundingBox();
    const at = { x: b.x + b.width * 0.4, y: b.y + b.height * 0.5 };
    await page.mouse.click(at.x, at.y);
    const field = await page.waitForSelector('input[aria-label^="The mark\'s words"]', { timeout: 3000 }).catch(() => null);
    const box = field ? await field.boundingBox() : null;
    const off = box ? box.x - at.x : null;
    await page.keyboard.press('Escape');
    return { pass: off != null && Math.abs(off) <= 16 && !errors.length, notes: [`the words field ${off == null ? 'never opened' : `${off.toFixed(1)} px from the click`}`] };
  } finally {
    await done();
  }
});

/* ─── THE DAY PANEL SAYS IT IS READING, NEVER "NO MODELED COLUMN" ON ITS WAY IN (the audit's C-55) ────────────────────
   Before: for 0.1–0.35 s while the day's tile came, the panel said the day had no modeled column, then showed it. */
check('day panel: no "No modeled column" flash while the day\'s columns load', async () => {
  const { page, errors, done } = await terrain([{ ticker: 'SPY', timeframe: '1D', overlays: { trails: true }, ladder: true }]);
  try {
    const notes = [];
    let flashes = 0;
    let opened = 0;
    for (let back = 1; back <= 4; back++) {
      const g = await page.evaluate(back => {
        const e = [...window.__charts].find(x => x.trails && x.host.isConnected && x.candles.data().length);
        const d = e.candles.data().filter(x => 'close' in x);
        const b = d[d.length - 1 - back];
        const r = e.host.getBoundingClientRect();
        return { x: r.left + e.chart.timeScale().timeToCoordinate(b.time), y: r.top + e.candles.priceToCoordinate((b.high + b.low) / 2) };
      }, back);
      /* every word the panel shows from the click on, sampled each frame */
      await page.evaluate(() => {
        window.__dayWords = [];
        const tick = () => {
          const el = document.querySelector('[data-day-panel]');
          if (el) window.__dayWords.push(el.textContent ?? '');
          if (window.__dayWords.length < 120) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      await page.mouse.click(g.x, g.y);
      await page.waitForTimeout(2200);
      const seen = await page.evaluate(() => window.__dayWords);
      if (!seen.length) continue;
      opened++;
      const last = seen[seen.length - 1];
      const flashed = seen.some(t => /No modeled column/i.test(t)) && !/No modeled column/i.test(last);
      if (flashed) flashes++;
      notes.push(`${await page.getAttribute('[data-day-panel]', 'data-day-panel').catch(() => '?')}: ${seen.length} frames, ${flashed ? 'FLASHED "No modeled column"' : /No modeled column/i.test(last) ? 'no modeled column (said once, stays)' : 'no flash'}`);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
    return { pass: opened > 0 && flashes === 0 && !errors.length, notes };
  } finally {
    await done();
  }
});

/* ─── THE LEVEL CARD TAKES THE KEYS, AND KNOWS ITS WATCH (the audit's A-193…A-198, B-47) ─────────────────────────────────
   Before: the card stood hidden until measured and the house trap's one try at focus fell on a hidden control, so the keys
   stayed outside it; the after-run's second right-click missed because the test's own click had scrolled the page. */
check('level card: the keys go into it; on, then a second right-click on the level offers Stop', async () => {
  const { page, errors, done } = await terrain([{ ticker: 'SPY', timeframe: '5m', overlays: { trails: true }, ladder: true }]);
  try {
    await page.evaluate(() => localStorage.removeItem('slayer_level_watch'));
    const at = await page.evaluate(() => {
      const e = [...window.__charts].find(x => x.host.isConnected && x.trails);
      const r = e.host.getBoundingClientRect();
      const ph = e.chart.paneSize(0).height;
      const lv = [...document.querySelectorAll('[data-axis-chip]')].map(c => ({ k: c.dataset.axisChip, s: Number(c.dataset.strike), y: e.candles.priceToCoordinate(Number(c.dataset.strike)) })).filter(o => o.y != null && o.y > 60 && o.y < ph - 40);
      const L = lv.find(o => ['pw', 'cw', 'flip'].includes(o.k)) ?? lv[0];
      return L ? { k: L.k, x: r.left + e.chart.paneSize(0).width * 0.5, y: r.top + L.y } : null;
    });
    if (!at) return { pass: false, notes: ['no level inside the plot'] };
    const notes = [];
    let pass = true;
    await page.mouse.click(at.x, at.y, { button: 'right' });
    await page.waitForSelector('[data-chart-menu="level-alert"]', { timeout: 3000 });
    await page.waitForTimeout(250);
    const inside = await page.evaluate(() => !!document.activeElement?.closest('[data-chart-menu="level-alert"]'));
    notes.push(`${at.k}: the keys ${inside ? 'went into the card' : 'stayed outside it'}`);
    if (!inside) pass = false;
    const on = await page.locator('[data-chart-menu-item="level-alert-on"]').first().boundingBox();
    const top0 = await page.evaluate(() => document.querySelector('main')?.scrollTop ?? 0);
    await page.mouse.click(on.x + on.width / 2, on.y + on.height / 2);
    await page.waitForTimeout(450);
    const top1 = await page.evaluate(() => document.querySelector('main')?.scrollTop ?? 0);
    await page.mouse.click(at.x, at.y, { button: 'right' });
    const off = await page.waitForSelector('[data-chart-menu-item="level-alert-off"]', { timeout: 3000 }).then(() => true).catch(() => false);
    notes.push(`the page ${top1 === top0 ? 'stayed put' : `moved ${top1 - top0} px`}; the second right-click ${off ? 'offers Stop' : 'offers no Stop'}`);
    if (!off || top1 !== top0) pass = false;
    if (off) await page.locator('[data-chart-menu-item="level-alert-off"]').first().click();
    await page.keyboard.press('Escape');
    if (errors.length) {
      pass = false;
      notes.push(...errors);
    }
    return { pass, notes };
  } finally {
    await page.evaluate(() => localStorage.removeItem('slayer_level_watch')).catch(() => {});
    await done();
  }
});

/* ─── THE MOVE'S READOUT STANDS INSIDE THE PLOT (the after-run's shot: with the newest bar past the view's right edge
   the words "−1.6σ · 100% of the day's variance used" ran off it, cut to "−1.(") ─────────────────────────────────── */
check('cone readout: in a session (the clock held at 3:30 pm) the words stay inside the plot', async () => {
  const recordWidths = () => {
    window.__ro = [];
    const f = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (t, x, y, ...r) {
      if (/variance used/.test(String(t))) {
        window.__ro.push({ t: String(t), x, w: this.measureText(String(t)).width, cw: this.canvas.width, a: this.getTransform().a });
        if (window.__ro.length > 200) window.__ro.splice(0, 100);
      }
      return f.call(this, t, x, y, ...r);
    };
  };
  /* the after-run's own scene: the page's clock held at 3:30 pm New York on Oct 14 (a session in progress, the cone
     drawn), the view on the session's last two hours, then taken to the newest bar */
  const { page, errors, done } = await terrain([{ ticker: 'SPY', timeframe: '1m', overlays: { trails: true, cone: true }, ladder: true }], { init: recordWidths, at: '2026-10-14T19:30:00Z' });
  try {
    await page.evaluate(() => {
      const e = [...window.__charts].find(x => x.host.isConnected && x.trails);
      const sn = e.trails.snapshots;
      const last = sn[sn.length - 1].time;
      e.chart.timeScale().setVisibleRange({ from: last - 120 * 60, to: last + 5 * 60 });
    });
    await page.mouse.move(110, 640);
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
      [...window.__charts].find(x => x.host.isConnected && x.trails).chart.timeScale().scrollToRealTime();
      window.__ro = [];
    });
    await page.waitForTimeout(1500);
    const ro = await page.evaluate(() => window.__ro.slice(-5));
    if (!ro.length) return { pass: false, notes: ['no readout drawn (the priced move not in on this machine?)'] };
    const worst = ro.reduce((m, o) => Math.max(m, o.x * o.a + o.w * o.a - o.cw), -Infinity);
    return { pass: worst <= 0 && !errors.length, notes: [`"${ro[ro.length - 1].t}" ends ${worst <= 0 ? `${Math.round(-worst)} px inside` : `${Math.round(worst)} px past`} the plot's edge`] };
  } finally {
    await done();
  }
});

/* ─── ONE LIST EACH: THE EXPIRY WINDOWS AND THE REPLAY'S PACES (the round-3 audit's 6i, merged on the owner's approval of
   2026-10-15) ────────────────────────────────────────────────────────────────────────────────────────────────────────
   Before: the header's windows (PaneHead WINDOW_OPTS) and the Expiry card's (Terrain WINDOW_CHOICES) were two lists of
   the same words, and the replay's paces were two (Terrain REPLAY_PACES beside replayFrame REPLAY_SPEEDS). The merge
   changes nothing on screen: the header, the card and the pace card offer what they offered, entry for entry and word for
   word (each place keeps its own words for the 60-day book: the header's "reads", the card's "keeps") — and Terrain holds
   no list of its own: the card's windows are read off WINDOW_OPTS and the paces off replayFrame's REPLAY_PACES. */
const HEAD_WINDOWS = [
  ['w:0dte', '0DTE', "0DTE — The contracts that settle the session's own day"],
  ['w:fri', 'Fri', 'To Friday — Every expiry to the Friday of this week'],
  ['w:opex', 'OPEX', "To monthly OPEX — Every expiry to the month's third Friday (the next month's once it has passed)"],
  ['book', '60d', "All 60 days — The field: every expiry within 60 days; the ladder reads Unusual Whales' book on every expiry"],
];
const CARD_WINDOWS = [
  ['w:0dte', '0DTE', "The contracts that settle the session's own day"],
  ['w:fri', 'To Friday', 'Every expiry to the Friday of this week'],
  ['w:opex', 'To monthly OPEX', "Every expiry to the month's third Friday (the next month's once it has passed)"],
  ['book', 'All 60 days', "The field: every expiry within 60 days. The ladder keeps Unusual Whales' book on every expiry."],
];
const PACES = ['1×', '5×', '20×', '60×'];
check('lists: the expiry windows and the replay paces offered on screen are the ones they were, from one list each', async () => {
  const { page, errors, done } = await terrain([{ ticker: 'SPY', timeframe: '5m', overlays: { trails: true }, ladder: true }]);
  try {
    const t0 = Date.now();
    const notes = [];
    let pass = true;
    const same = (what, got, want) => {
      if (JSON.stringify(got) === JSON.stringify(want)) notes.push(`${what}: ${got.length}, as they were (${got.map(g => (Array.isArray(g) ? g[1] : g)).join(' · ')})`);
      else {
        pass = false;
        notes.push(`${what}: ${JSON.stringify(got)} — wanted ${JSON.stringify(want)}`);
      }
    };
    /* the header's chips (the feed's windows: Terrain draws them only while the field reads the feed), read in full screen
       where the header lays them out whole whatever the pane's width (F, then Esc) */
    const hb = await page.locator('[data-pane-head]').first().boundingBox();
    await page.mouse.click(hb.x + hb.width * 0.6, hb.y + hb.height / 2);
    await page.keyboard.press('f');
    await page.waitForSelector('[data-expanded-extras]', { timeout: 4000 });
    const head = await page.locator('[data-expanded-extras] [data-window-pick]').evaluateAll(els => els.map(e => [e.getAttribute('data-window-pick'), (e.textContent ?? '').trim(), e.getAttribute('title')]));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);
    same("the header's windows", head, HEAD_WINDOWS);
    /* the Expiry card's foot: every choice that is not a day */
    await page.click('[data-dropdown="terrain-expiry"]');
    await page.waitForSelector('[data-dropdown-card="terrain-expiry"]', { timeout: 4000 });
    const card = await page.locator('[data-dropdown-card="terrain-expiry"] [data-expiry-choice]').evaluateAll(els => els.map(e => [e.getAttribute('data-expiry-choice'), (e.textContent ?? '').trim(), e.getAttribute('title')]));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    same("the Expiry card's windows", card, CARD_WINDOWS);
    /* the replay's pace card: the pane takes the keys from its header, P, a bar picked, the card opened */
    const b = await page.locator('[data-chart-ink]').first().boundingBox();
    const hb2 = await page.locator('[data-pane-head]').first().boundingBox();
    await page.mouse.click(hb2.x + hb2.width * 0.6, hb2.y + hb2.height / 2);
    await page.keyboard.press('p');
    await page.waitForTimeout(600);
    await page.mouse.click(b.x + b.width * 0.5, b.y + b.height * 0.5);
    await page.waitForSelector('[data-dropdown="replay-pace"]', { timeout: 8000 });
    await page.click('[data-dropdown="replay-pace"]');
    await page.waitForSelector('[data-dropdown-card="replay-pace"] [role="menuitemradio"]', { timeout: 4000 });
    const paces = await page.locator('[data-dropdown-card="replay-pace"] [role="menuitemradio"]').evaluateAll(els => els.map(e => (e.querySelector('span.font-mono')?.textContent ?? '').trim()));
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    same("the replay's paces", paces, PACES);
    /* ONE LIST EACH: Terrain holds no window or pace list of its own (the source, as the page was served from it) */
    const terrainSrc = readFileSync(new URL('../src/pages/terrain/Terrain.tsx', import.meta.url), 'utf8');
    const frameSrc = readFileSync(new URL('../src/data/replayFrame.ts', import.meta.url), 'utf8');
    const ownWindows = /const WINDOW_CHOICES[^=]*=\s*\[/.test(terrainSrc) || !/WINDOW_CHOICES[^=]*=\s*WINDOW_OPTS\b/.test(terrainSrc);
    const ownPaces = /const REPLAY_PACES\s*=\s*\[/.test(terrainSrc) || !/export const REPLAY_PACES\b[^=]*=\s*REPLAY_SPEEDS\.map\(/.test(frameSrc) || !/import \{[^}]*\bREPLAY_PACES\b[^}]*\} from '\.\.\/\.\.\/data\/replayFrame'/.test(terrainSrc);
    if (ownWindows || ownPaces) pass = false;
    notes.push(`one list: the card's windows ${ownWindows ? 'are a list of Terrain\'s own' : "are read off PaneHead's WINDOW_OPTS"}; the paces ${ownPaces ? 'are a list of Terrain\'s own' : "are replayFrame's REPLAY_PACES, built off REPLAY_SPEEDS"}`);
    if (errors.length) {
      pass = false;
      notes.push(`page errors: ${errors.join(' | ')}`);
    }
    return { pass, ms: Date.now() - t0, notes };
  } finally {
    await done();
  }
});

/* ─── THE INDICATORS' INKS (the owner's approvals 4, 5 and 11, 2026-10-15) ──────────────────────────────────────────────
   Before: EMA 9, SMA 200, RSI, MACD's signal, the Pine averages, Ichimoku's base, Keltner, the stochastic, ATR and
   Williams %R stood within OKLab 0.15 of the field's gold or violet; EMA 9/21/50 and VWAP wore the compare lines' own
   inks, and the Pine EMA ribbon, VWAP, Donchian, MFI, CCI and OBV repeated them; six shipped scripts repeated a chart
   built-in; and "The flip" washed the pane red under it. Each line the chart draws is read off the chart itself: each
   Indicators-menu key ticked in the library alone, each shipped script placed alone, on a dark page's tape and a light
   page's, the field's gold and violet read off the tape's own box. */
check('inks: every indicator and shipped script draws its own ink, off gold and violet and off the direction pair\'s hues, readable as drawn on a light tape; the six are off the shelf and a placed one is kept', async () => {
  const t0 = Date.now();
  const notes = [];
  let pass = true;
  const lin = c => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const oklab = ([r, g, b]) => {
    const [R, G, B] = [lin(r), lin(g), lin(b)];
    const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
    const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
    const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
    return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
  };
  const dE = (a, b) => Math.hypot(...oklab(a).map((v, i) => v - oklab(b)[i]));
  const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  /* a line as drawn: its ink at its alpha over the tape (the review: the VWAP bands at 60% read 2.4:1 on Stone) */
  const overG = (rgb, a, g) => rgb.map((v, i) => v * a + g[i] * (1 - a));
  /* OKLCh chroma and hue — a line with a hue (chroma 0.04 or more) within 30° of the direction pair reads as up or down */
  const lch = rgb => { const [, a, b] = oklab(rgb); return { C: Math.hypot(a, b), h: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360 }; };
  const hueGap = (x, y) => { const d = Math.abs(x - y) % 360; return d > 180 ? 360 - d : d; };
  const parse = s => {
    s = String(s ?? '').trim();
    let m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(s);
    if (m) return { rgb: [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16)), a: m[2] ? parseInt(m[2], 16) / 255 : 1 };
    m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/i.exec(s);
    return m ? { rgb: [+m[1], +m[2], +m[3]], a: m[4] == null ? 1 : +m[4] } : null;
  };
  const hex = rgb => `#${rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
  const COMPARE = ['#5B9CF6', '#BBB2E8', '#EDE4CD', '#6BD3C7'].map(c => parse(c).rgb);
  const SIX = ['ema-ribbon', 'vwap', 'bollinger', 'rsi', 'macd', 'atr'];
  for (const theme of ['dark', 'light']) {
    const { page, errors, done } = await terrain([{ ticker: 'SPY', timeframe: '5m', overlays: { trails: true }, ladder: true }], { theme });
    try {
      /* the series on the chart now, and the house's inks off the tape's own box */
      const snap = () =>
        page.evaluate(() => {
          const e = [...window.__charts].find(x => x.trails && x.host.isConnected && !x.host.closest('[data-recap-shot]') && x.candles.data().length);
          window.__inkSeen ??= new WeakSet();
          const all = e.chart.panes().flatMap((p, i) => p.getSeries().map(s => ({ s, i })));
          const fresh = all.filter(o => !window.__inkSeen.has(o.s));
          const inks = fresh.flatMap(({ s, i }) => {
            const o = s.options();
            const base = [o.color, o.lineColor].filter(c => typeof c === 'string');
            const per = [...new Set(s.data().map(d => d.color).filter(Boolean))];
            const visible = o.visible !== false && (o.lineVisible !== false || o.pointMarkersVisible) && s.data().some(d => 'value' in d);
            return visible ? [...base, ...per].map(c => ({ c, pane: i })) : [];
          });
          return { n: all.length, inks };
        });
      const seenAll = () => page.evaluate(() => {
        const e = [...window.__charts].find(x => x.trails && x.host.isConnected && !x.host.closest('[data-recap-shot]') && x.candles.data().length);
        window.__inkSeen ??= new WeakSet();
        for (const p of e.chart.panes()) for (const s of p.getSeries()) window.__inkSeen.add(s);
        return e.chart.panes().reduce((n, p) => n + p.getSeries().length, 0);
      });
      const tokens = await page.evaluate(() => {
        const e = [...window.__charts].find(x => x.trails && x.host.isConnected && !x.host.closest('[data-recap-shot]') && x.candles.data().length);
        const box = e.box();
        const css = getComputedStyle(box);
        const t = n => css.getPropertyValue(n).trim().split(/\s+/).map(Number);
        const bg = e.chart.options().layout.background;
        const light = e.host.closest('[data-chart-ground]')?.getAttribute('data-chart-ground') === 'light';
        /* the field's gold and violet on this tape's ground, as the ovals take them (heatmap.ts: off a probe of the ground) */
        const probe = document.createElement('span');
        probe.setAttribute('data-theme', light ? 'light' : 'dark');
        probe.style.display = 'none';
        document.body.appendChild(probe);
        const pcs = getComputedStyle(probe);
        const g = n => pcs.getPropertyValue(n).trim().split(/\s+/).map(Number);
        const out = { gold: g('--absorb'), violet: g('--amplify'), bull: t('--bull'), bear: t('--bear'), supreme: t('--supreme'), flip: t('--flip'), select: t('--select'), ground: bg?.color ?? null, light };
        probe.remove();
        return out;
      });
      const ground = parse(tokens.ground)?.rgb ?? (tokens.light ? [221, 220, 215] : [10, 10, 10]);
      const HOUSE = [tokens.gold, tokens.violet, tokens.bull, tokens.bear, tokens.supreme, tokens.flip, tokens.select, ...['#E8B94A', '#8064F7', '#30D158', '#FF3B30', '#EA00FF', '#9CA3AF', '#C7D3E8'].map(c => parse(c).rgb)].map(hex);
      /* every owner's inks: [owner, part ink] */
      const owned = [];
      const take = (owner, got) => {
        for (const { c } of got.inks) {
          const p = parse(c);
          if (!p || p.a === 0) continue;
          owned.push({ owner, rgb: p.rgb, a: p.a, css: c });
        }
      };
      /* the Indicators menu, one key at a time, through the library as a reader ticks it */
      const openLib = async () => {
        if (await page.locator('[data-library]').count()) return;
        const b = await page.locator('[data-chart-ink]').first().boundingBox();
        await page.mouse.move(b.x + b.width * 0.5, b.y + b.height * 0.55);
        await page.waitForTimeout(150);
        await page.locator('button[data-scripts-door]').filter({ visible: true }).first().click();
        await page.locator('[data-library]').first().waitFor({ timeout: 5000 });
      };
      const closeLib = async () => {
        await page.keyboard.press('Escape');
        await page.locator('[data-library]').first().waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
      };
      const tick = async key => {
        await openLib();
        await page.locator('[data-library-shelf="chart"]').first().click();
        await page.locator(`[data-library-row="chart:${key}"] [data-library-toggle]`).first().click();
        await closeLib();
        await page.waitForTimeout(700);
      };
      for (const key of ['ema9', 'ema21', 'ema50', 'sma', 'vwap', 'vwapBands', 'bb', 'rsi', 'macd', 'atrPane']) {
        await seenAll();
        await tick(key);
        take(`indicator:${key}`, await snap());
        await tick(key);
      }
      /* the shelf, read in the library, then every shipped script on it placed alone */
      await openLib();
      await page.locator('[data-library-shelf="technicals"]').first().click();
      const technicals = await page.locator('[data-library-row]').evaluateAll(els => els.map(e => e.getAttribute('data-library-row')));
      await page.locator('[data-library-shelf="slayer"]').first().click();
      const slayerRows = await page.locator('[data-library-row]').evaluateAll(els => els.map(e => e.getAttribute('data-library-row')));
      await closeLib();
      const shelf = [...slayerRows, ...technicals].filter(k => k?.startsWith('builtin:'));
      const still = SIX.filter(s => shelf.includes(`builtin:${s}`));
      if (still.length) {
        pass = false;
        notes.push(`${theme}: the shelf still lists ${still.join(', ')}`);
      }
      for (const id of shelf) {
        const n0 = await seenAll();
        const placed = await page.evaluate(async id => (await window.__paneScripts.place('terrain:1', id)).id, id);
        await page.waitForFunction(n0 => [...window.__charts].find(x => x.trails && x.host.isConnected && !x.host.closest('[data-recap-shot]')).chart.panes().reduce((n, p) => n + p.getSeries().length, 0) > n0, n0, { timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(300);
        take(id.replace('builtin:', 'script:'), await snap());
        await page.evaluate(async c => window.__paneScripts.lift('terrain:1', c), placed);
        await page.waitForTimeout(300);
      }
      /* the measure: categorical inks only (a wall, the flip, the supreme, the direction pair and the silver are the house's) */
      const lines = owned.filter(o => o.a >= 0.6 && !HOUSE.includes(hex(o.rgb)));
      const uniq = [];
      for (const o of lines) if (!uniq.some(u => u.owner === o.owner && hex(u.rgb) === hex(o.rgb))) uniq.push(o);
      const field = uniq.map(o => ({ o, d: Math.min(dE(o.rgb, tokens.gold), dE(o.rgb, tokens.violet)) })).filter(x => x.d < 0.15);
      const pairs = [];
      for (let a = 0; a < uniq.length; a++) for (let b = a + 1; b < uniq.length; b++) {
        const d = dE(uniq[a].rgb, uniq[b].rgb);
        if (d < 0.08) pairs.push(`${uniq[a].owner} ${hex(uniq[a].rgb)} ~ ${uniq[b].owner} ${hex(uniq[b].rgb)} ${d.toFixed(3)}`);
      }
      const cmp = uniq.flatMap(o => COMPARE.filter(c => dE(o.rgb, c) < 0.08).map(c => `${o.owner} ${hex(o.rgb)} ~ compare ${hex(c)}`));
      const asDrawn = o => contrast(overG(o.rgb, o.a, ground), ground);
      /* every line as drawn, its alpha kept apart (a band shares its basis's ink at a lower alpha) */
      const drawnLines = [];
      for (const o of lines) if (!drawnLines.some(u => u.owner === o.owner && hex(u.rgb) === hex(o.rgb) && Math.abs(u.a - o.a) < 0.01)) drawnLines.push(o);
      const dim = tokens.light ? drawnLines.filter(o => asDrawn(o) < 3).map(o => `${o.owner} ${hex(o.rgb)}${o.a < 1 ? ` at ${o.a.toFixed(2)}` : ''} ${asDrawn(o).toFixed(2)}:1`) : [];
      /* no line reads as up or down: the tape's own direction pair, off its box */
      const dirH = [lch(tokens.bull).h, lch(tokens.bear).h];
      const onDir = uniq.filter(o => lch(o.rgb).C >= 0.04 && Math.min(...dirH.map(h => hueGap(lch(o.rgb).h, h))) < 30).map(o => `${o.owner} ${hex(o.rgb)} ${Math.min(...dirH.map(h => hueGap(lch(o.rgb).h, h))).toFixed(0)}°`);
      /* the house's inks a script draws, on a light tape: the tape's own tokens */
      const houseOnLight = tokens.light ? owned.filter(o => ['#E8B94A', '#8064F7', '#30D158', '#FF3B30', '#EA00FF', '#9CA3AF'].includes(hex(o.rgb))).map(o => `${o.owner} ${hex(o.rgb)}`) : [];
      const owners = new Set(owned.map(o => o.owner));
      notes.push(`${theme} page (${tokens.light ? 'light' : 'dark'} tape ${tokens.ground}): ${owners.size} indicators and scripts read, ${uniq.length} inks of their own; shelf ${shelf.length}`);
      if (field.length) notes.push(`  near the field's gold or violet: ${field.slice(0, 8).map(x => `${x.o.owner} ${hex(x.o.rgb)} ${x.d.toFixed(3)}`).join('; ')}`);
      if (pairs.length) notes.push(`  under 0.08 apart: ${pairs.slice(0, 8).join('; ')}${pairs.length > 8 ? ` … ${pairs.length} in all` : ''}`);
      if (cmp.length) notes.push(`  on a compare line's ink: ${cmp.slice(0, 6).join('; ')}`);
      if (dim.length) notes.push(`  under 3:1 on the light tape, as drawn: ${dim.slice(0, 8).join('; ')}${dim.length > 8 ? ` … ${dim.length} in all` : ''}`);
      if (onDir.length) notes.push(`  within 30° of hue of the tape's direction pair: ${onDir.slice(0, 8).join('; ')}${onDir.length > 8 ? ` … ${onDir.length} in all` : ''}`);
      if (houseOnLight.length) notes.push(`  a house ink drawn in its dark value on the light tape: ${houseOnLight.slice(0, 6).join('; ')}`);
      if (owners.size < 25 || field.length || pairs.length || cmp.length || dim.length || onDir.length || houseOnLight.length) pass = false;
      /* "The flip" paints no wash: its own run, in the page's own modules */
      const flipRun = await page.evaluate(async () => {
        const b = await import('/src/data/builtinScripts.ts');
        const p = await import('/src/core/pine/index.ts');
        const flip = b.builtinScripts().find(s => s.id === 'builtin:flip');
        const bars = Array.from({ length: 200 }, (_, i) => ({ time: 1_760_000_000 + i * 60, open: 480, high: 481, low: 479, close: 479.5 + Math.sin(i / 9), volume: 1000 }));
        const r = p.run(p.compile(flip.source), bars, { timeframe: '1m', slayer: { callWall: 485, putWall: 475, flip: 480, supreme: 482 } });
        return { fills: r.fills.length, washed: (r.bgcolors ?? []).filter(Boolean).length, ink: r.plots[0]?.ink };
      });
      if (theme === 'dark') notes.push(`  "The flip": ${flipRun.fills} fills, ${flipRun.washed} washed bars, its line ${flipRun.ink}`);
      if (flipRun.fills || flipRun.washed || String(flipRun.ink).toUpperCase() !== '#9CA3AF') pass = false;
      /* a reader who had the RSI script on a pane keeps it, as their own, through a reload */
      if (theme === 'dark') {
        await page.evaluate(async () => window.__paneScripts.place('terrain:1', 'builtin:rsi'));
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForSelector('[data-chart-ink]', { timeout: 60_000 });
        await page.waitForTimeout(4000);
        const legend = await page.locator('[data-script-legend] [data-legend-row]').evaluateAll(els => els.map(e => e.getAttribute('data-legend-row')));
        await openLib();
        await page.locator('[data-library-shelf="mine"]').first().click();
        const mine = await page.locator('[data-library-row]').evaluateAll(els => els.map(e => `${e.getAttribute('data-library-row')} ${e.textContent?.slice(0, 40) ?? ''}`));
        await closeLib();
        const keptOk = legend.includes('builtin:rsi') && mine.some(m => m.startsWith('builtin:rsi '));
        notes.push(`  the RSI script placed before, after a reload: legend ${legend.join(', ') || 'empty'}; My scripts ${mine.join(' | ') || 'empty'}`);
        if (!keptOk) pass = false;
      }
      if (errors.length) {
        pass = false;
        notes.push(`page errors: ${errors.slice(0, 3).join(' | ')}`);
      }
    } finally {
      await done();
    }
  }
  return { pass, ms: Date.now() - t0, notes };
});

/* ─── A LIGHT TAPE'S HOUSE INKS THROUGH A LOAD (the review of approvals 4, 5 and 11, 2026-10-15) ───────────────────────
   Before: the scripts effect read a light tape's tokens off the chart's box through a ref that the box's ref callback
   fills by state — still null when the effects of the first commit run — so after any load a script's flip, supreme,
   direction pair and silver were read off the document's root, and nothing redrew once the box was there. On a dark
   page a Stone tape drew them in their dark values (the flip #9CA3AF at 1.35:1, the up line #30D158 at 1.07:1); on a
   light page in the page's own (the flip #4B5563, not the tape's #6B7280). Placed live they were right, so this check
   places them, reloads twice and reads the series' colours each time against the tape's own tokens. */
check('inks: a light tape keeps the house inks of a placed script through a reload, on a dark page and a light one, and under blue and orange', async () => {
  const t0 = Date.now();
  const notes = [];
  let pass = true;
  const hexOf = s => {
    s = String(s ?? '').trim();
    let m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(s);
    if (m) return `#${m[1].toUpperCase()}`;
    m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(s);
    if (!m) m = /^([\d.]+)\s+([\d.]+)\s+([\d.]+)$/.exec(s);
    return m ? `#${[m[1], m[2], m[3]].map(v => Math.round(+v).toString(16).padStart(2, '0')).join('').toUpperCase()}` : null;
  };
  const IDS = ['builtin:walls', 'builtin:flip', 'builtin:supreme', 'builtin:supertrend'];
  /* the palette's dark values (gex/palette.ts) — a script's house ink in one of these on a light tape is the bug — and,
     under blue and orange, the dark island's pair (tokens.css), which beat the light set on the box until the review */
  const DARK = ['#9CA3AF', '#EA00FF', '#30D158', '#FF3B30', '#E8B94A', '#8064F7'];
  const CVD_DARK = ['#50A4FF', '#FF8526'];
  const lin = c => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const lum = h => { const [r, g, b] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
  const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  for (const { theme, cvd } of [{ theme: 'dark' }, { theme: 'light' }, { theme: 'dark', cvd: 'blue-orange' }]) {
    const { page, errors, done } = await terrain([{ ticker: 'SPY', timeframe: '5m', theme: 'stone', overlays: { trails: true }, ladder: true }], { theme, cvd });
    const run = `${theme} page${cvd ? `, ${cvd}` : ''}`;
    try {
      /* every ink the chart's series draw, the tape's own tokens, the root's, and the light ground's gold and violet */
      const read = () =>
        page.evaluate(() => {
          const e = [...window.__charts].find(x => x.trails && x.host.isConnected && !x.host.closest('[data-recap-shot]') && x.candles.data().length);
          const inks = new Set();
          let n = 0;
          for (const p of e.chart.panes())
            for (const s of p.getSeries()) {
              n++;
              const o = s.options();
              for (const c of [o.color, o.lineColor]) if (typeof c === 'string') inks.add(c);
              for (const d of s.data()) if (typeof d.color === 'string') inks.add(d.color);
            }
          const box = e.host.closest('[data-chart-ground]');
          const of = (el, names) => Object.fromEntries(names.map(k => [k, getComputedStyle(el).getPropertyValue(k).trim()]));
          const probe = document.createElement('span');
          probe.setAttribute('data-theme', 'light');
          probe.style.display = 'none';
          document.body.appendChild(probe);
          const walls = of(probe, ['--absorb', '--amplify']);
          probe.remove();
          const names = ['--flip', '--supreme', '--bull', '--bear'];
          const bg = e.chart.options().layout.background;
          return { n, inks: [...inks], ground: box.getAttribute('data-chart-ground'), tape: of(box, names), root: of(document.documentElement, names), walls, bg: bg?.color ?? null };
        });
      const reloaded = async want => {
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForSelector('[data-chart-ink]', { timeout: 60_000 });
        await page
          .waitForFunction(
            want => {
              const e = [...(window.__charts ?? [])].find(x => x.trails && x.host.isConnected && !x.host.closest('[data-recap-shot]') && x.candles.data().length);
              return !!e && e.chart.panes().reduce((n, p) => n + p.getSeries().length, 0) >= want;
            },
            want,
            { timeout: 30_000 }
          )
          .catch(() => {});
        await page.waitForTimeout(1500);
        return read();
      };
      const base = await read();
      if (base.ground !== 'light') {
        pass = false;
        notes.push(`${run}: the Stone pane's tape is ${base.ground}, not light`);
        continue;
      }
      const baseInks = new Set(base.inks.map(hexOf));
      for (const id of IDS) await page.evaluate(async id => window.__paneScripts.place('terrain:1', id), id);
      await page
        .waitForFunction(n0 => [...window.__charts].find(x => x.trails && x.host.isConnected && !x.host.closest('[data-recap-shot]') && x.candles.data().length).chart.panes().reduce((n, p) => n + p.getSeries().length, 0) >= n0 + 4, base.n, { timeout: 10_000 })
        .catch(() => {});
      await page.waitForTimeout(1200);
      const live = await read();
      const stages = [['placed live', live], ['after a reload', await reloaded(live.n)], ['after a second reload', await reloaded(live.n)]];
      const want = {
        flip: hexOf(live.tape['--flip']),
        supreme: hexOf(live.tape['--supreme']),
        up: hexOf(live.tape['--bull']),
        down: hexOf(live.tape['--bear']),
        'call wall': hexOf(live.walls['--absorb']),
        'put wall': hexOf(live.walls['--amplify']),
      };
      const wantSet = new Set(Object.values(want));
      /* a wrong ink: the palette's dark value, or the root's own token where the tape's differs */
      const wrong = new Set([...DARK, ...(cvd ? CVD_DARK : []), ...Object.values(live.root).map(hexOf)].filter(h => h && !wantSet.has(h)));
      notes.push(`${run}, Stone tape — the tape's: ${Object.entries(want).map(([k, v]) => `${k} ${v}`).join(', ')}`);
      /* under the reader's colour vision the tape's direction pair is the reader's light pair: never the dark island's, and
         read 3:1 on the tape (it was the dark ground's #50A4FF and #FF8526, 1.38 and 1.29:1 on Stone) */
      if (cvd) {
        const tapeBg = hexOf(live.bg) ?? '#BEBDB8';
        for (const k of ['up', 'down']) {
          const c = contrast(want[k], tapeBg);
          notes.push(`  ${k} ${want[k]} ${c.toFixed(2)}:1 on the tape ${tapeBg}`);
          if (CVD_DARK.includes(want[k]) || c < 3) pass = false;
        }
      }
      for (const [label, got] of stages) {
        const drawn = [...new Set(got.inks.map(hexOf))].filter(h => h && !baseInks.has(h));
        const missing = Object.entries(want).filter(([, v]) => !drawn.includes(v)).map(([k, v]) => `${k} ${v}`);
        const bad = drawn.filter(h => wrong.has(h));
        notes.push(`  ${label}: the scripts drew ${drawn.join(' ') || 'nothing'}${missing.length ? ` — missing ${missing.join(', ')}` : ''}${bad.length ? ` — wrong ${bad.join(' ')}` : ''}`);
        if (missing.length || bad.length) pass = false;
      }
      if (errors.length) {
        pass = false;
        notes.push(`page errors: ${errors.slice(0, 3).join(' | ')}`);
      }
    } finally {
      await done();
    }
  }
  return { pass, ms: Date.now() - t0, notes };
});

/* ─── THE READER'S COLOUR VISION ON THE CHART'S CHROME (the review of approvals 4, 5 and 11, 2026-10-15) ──────────────
   Before: the chart box is a dark island, and tokens.css's colour-vision set for a dark island beat index.css's light
   chart set on it — under high contrast a Stone tape's ladder and words were the dark ground's near-white (250 250 250)
   on the light tape — and the chart sets on the chrome blocks named the house pair outright, so under blue and orange a
   dark tape's head kept green and red. Read off the page: the pane head's and the box's tokens, and the ladder's words
   as drawn against the tape. */
check('inks: the reader\'s colour vision reaches the chart\'s chrome — blue and orange on a dark tape, high contrast on a light one', async () => {
  const t0 = Date.now();
  const notes = [];
  let pass = true;
  const lin = c => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const chan = s => {
    const t = String(s ?? '').trim();
    const h = /^#([0-9a-f]{6})/i.exec(t);
    return h ? [0, 2, 4].map(i => parseInt(h[1].slice(i, i + 2), 16)) : (t.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [0, 0, 0]);
  };
  const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const read = page =>
    page.evaluate(() => {
      const e = [...window.__charts].find(x => x.trails && x.host.isConnected && !x.host.closest('[data-recap-shot]') && x.candles.data().length);
      const box = e.host.closest('[data-chart-ground]');
      const head = document.querySelector('[data-pane-head]');
      const of = el => Object.fromEntries(['--bull', '--bear', '--text-primary', '--text-muted'].map(k => [k, getComputedStyle(el).getPropertyValue(k).trim()]));
      /* the chart's own box inside the frame (the ladder and the legends read their words off it) and the head's colour */
      const ink = box.querySelector('[data-chart-ink]') ?? box;
      return { ground: box.getAttribute('data-chart-ground'), bg: e.chart.options().layout.background?.color ?? null, box: of(box), ink: of(ink), head: of(head), headColor: getComputedStyle(head).color };
    });
  /* blue and orange on a dark tape: the head and the box take the reader's dark pair */
  {
    const { page, errors, done } = await terrain([{ ticker: 'SPY', timeframe: '5m', theme: 'glacier', overlays: { trails: true }, ladder: true }], { theme: 'dark', cvd: 'blue-orange' });
    try {
      const r = await read(page);
      const ok = r.ground === 'dark' && r.head['--bull'] === '80 164 255' && r.head['--bear'] === '255 133 38' && r.box['--bull'] === '80 164 255';
      notes.push(`blue-orange, dark tape: the head's pair ${r.head['--bull']} / ${r.head['--bear']}, the box's ${r.box['--bull']} / ${r.box['--bear']} (want 80 164 255 / 255 133 38)`);
      if (!ok) pass = false;
      if (errors.length) { pass = false; notes.push(`page errors: ${errors.slice(0, 3).join(' | ')}`); }
    } finally {
      await done();
    }
  }
  /* high contrast on a Stone tape (a dark page): the box's words and the ladder's are dark on the light tape, 7:1 */
  {
    const { page, errors, done } = await terrain([{ ticker: 'SPY', timeframe: '5m', theme: 'stone', overlays: { trails: true }, ladder: true }], { theme: 'dark', cvd: 'high-contrast' });
    try {
      const r = await read(page);
      /* the tape's ground: Stone on a dark page (candleTheme.ts) — the chart paints its own background transparent */
      const tape = chan(/^#|rgb/.test(String(r.bg)) ? r.bg : '#BEBDB8');
      const cBox = contrast(chan(r.box['--text-primary']), tape);
      const cMuted = contrast(chan(r.box['--text-muted']), tape);
      const cInk = contrast(chan(r.ink['--text-primary']), tape);
      const cHead = contrast(chan(r.headColor), tape);
      notes.push(`high contrast, Stone tape (${r.ground}) ${r.bg}: the frame's words ${r.box['--text-primary']} ${cBox.toFixed(2)}:1, muted ${r.box['--text-muted']} ${cMuted.toFixed(2)}:1; the chart box's ${r.ink['--text-primary']} ${cInk.toFixed(2)}:1; the head ${r.headColor} ${cHead.toFixed(2)}:1; the pair ${r.box['--bull']} / ${r.box['--bear']}`);
      if (r.ground !== 'light' || cBox < 7 || cMuted < 7 || cInk < 7 || cHead < 7 || r.box['--bull'] === '110 245 140') pass = false;
      if (errors.length) { pass = false; notes.push(`page errors: ${errors.slice(0, 3).join(' | ')}`); }
    } finally {
      await done();
    }
  }
  return { pass, ms: Date.now() - t0, notes };
});

let failed = 0;
for (const { name, fn } of results) {
  let r;
  try {
    r = await fn();
  } catch (e) {
    r = { pass: false, notes: [String(e).slice(0, 400)] };
  }
  if (!r.pass) failed++;
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${name}${r.ms != null ? `  (${r.ms} ms)` : ''}`);
  for (const n of r.notes ?? []) console.log(`      ${n}`);
}
await browser.close();
console.log(`${results.length - failed} of ${results.length} passed`);
process.exit(failed ? 1 : 0);
