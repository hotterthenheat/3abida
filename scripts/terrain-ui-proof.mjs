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
import { existsSync } from 'node:fs';

const args = process.argv.slice(2);
const flag = name => args.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const base = (flag('url') ?? process.env.TERRAIN_URL ?? 'http://127.0.0.1:5180').replace(/\/+$/, '');
const only = flag('only');
const exe = process.env.PW_CHROMIUM ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const results = [];

/** A page on Terrain with the panes asked, the desk put back by `done`; `at` holds the page's clock from that instant */
async function terrain(panes, { width = 1440, height = 900, layout = 1, at = null, railCut = undefined, cvd = null, theme = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, timezoneId: 'America/Los_Angeles' });
  const page = await ctx.newPage();
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
check('phone: the ladder lays over the chart, the keys go in and back, How to read opens, the tools are a sheet', async () => {
  const { page, errors, done } = await terrain([{ ticker: 'SPY', timeframe: '5m', overlays: { trails: true }, ladder: false }], { width: 390, height: 844 });
  try {
    const t0 = Date.now();
    const before = await page.evaluate(() => Math.round(document.querySelector('[data-chart-ink]')?.getBoundingClientRect().width ?? 0));
    const door = page.locator('[data-ladder-peek], [data-narrow-ladder]').first();
    await door.focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(700);
    const open = await page.evaluate(() => ({ w: Math.round(document.querySelector('[data-chart-ink]')?.getBoundingClientRect().width ?? 0), panel: Math.round(document.querySelector('[data-profile-panel]')?.getBoundingClientRect().width ?? 0), pos: getComputedStyle(document.querySelector('[data-profile-panel]')).position, inside: !!document.activeElement?.closest('[data-profile-panel]') }));
    await page.locator('[data-profile-panel] [data-profile-guide]').first().click().catch(() => {});
    const guide = await page.waitForSelector('[data-popover-card="profile-guide"]', { timeout: 2500 }).then(() => true).catch(() => false);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    const closed = await page.evaluate(() => ({ panel: !!document.querySelector('[data-profile-panel]'), back: !!document.activeElement?.closest('[data-ladder-peek], [data-narrow-ladder]') }));
    const sheetDoor = await page.locator('[data-draw-sheet-door]').count();
    const pass = open.pos === 'absolute' && open.w >= before - 2 && open.inside && guide && !closed.panel && closed.back && sheetDoor >= 1 && !errors.length;
    return { pass, ms: Date.now() - t0, notes: [`chart ${before} px wide, ${open.w} px with the ladder (${open.panel} px, ${open.pos}) over it; the keys ${open.inside ? 'in the ladder' : 'elsewhere'}; How to read ${guide ? 'opened' : 'did nothing'}; after Esc the ladder ${closed.panel ? 'stands' : 'closed'} and the keys ${closed.back ? 'back on its door' : 'elsewhere'}; the drawing tools: ${sheetDoor ? 'a sheet behind one door' : 'no sheet door'}`, ...(errors.length ? [`page errors: ${errors.join(' | ')}`] : [])] };
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
