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
async function terrain(panes, { width = 1440, height = 900, layout = 1, at = null, railCut = undefined } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, timezoneId: 'America/Los_Angeles' });
  const page = await ctx.newPage();
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
        for (let y = 40; y < h - 40; y += 2) {
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
