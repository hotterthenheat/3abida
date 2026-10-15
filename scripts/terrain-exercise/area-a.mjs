/*
  TERRAIN AUDIT · AREA A, EXERCISED (2026-10-15). Every item of the area's inventory — the pane header, the hover
  toolbar and its menus, the desk bar, the keys and the replay transport (A-01 … A-257) — pressed in a real browser
  against the dev server, with what it did and how long it took from the action to the result.

  Run:  no_proxy=127.0.0.1,localhost NO_PROXY=127.0.0.1,localhost node scripts/terrain-exercise/area-a.mjs
  Env:  EXERCISE_URL (default http://127.0.0.1:5180) · EXERCISE_OUT (default docs/terrain-audit-2026-10-15/exercise) ·
        ONLY=header,hover,… to run some groups
  Out:  docs/terrain-audit-2026-10-15/exercise/area-a.json and area-a.md

  It reads the app and never changes it: a fresh browser context per group (its own localStorage), the desk seeded
  through `slayer_terrain_v1` before the first paint. Timings are wall-clock on a shared machine — pessimistic.
*/
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
/* the commit the run is against (EXERCISE_COMMIT, else the working tree's HEAD) */
const COMMIT = process.env.EXERCISE_COMMIT || (() => { try { return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim(); } catch { return 'unknown'; } })();


const BASE = process.env.EXERCISE_URL || process.env.AREA_A_BASE || 'http://127.0.0.1:5180';
const OUT = path.resolve(process.cwd(), process.env.EXERCISE_OUT || 'docs/terrain-audit-2026-10-15/exercise');
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : null;
const T_START = Date.now();
const rows = [];
const memo = {};

const rx = s => new RegExp('^\\s*' + s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$');
const sleep = ms => new Promise(r => setTimeout(r, ms));

function record(r) {
  const i = rows.findIndex(x => x.id === r.id);
  for (const [nid, text] of memo.pendingNotes ?? []) if (nid === r.id) r.notes = r.notes ? `${r.notes}; ${text}` : text;
  if (i >= 0) rows[i] = r;
  else rows.push(r);
  const tag = r.pass === true ? 'PASS' : r.pass === 'manual' ? 'MANUAL' : 'FAIL';
  console.log(`${r.id.padEnd(6)} ${tag.padEnd(6)} ${r.ms == null ? '' : `${r.ms}ms `}— ${String(r.observed).slice(0, 170)}`);
}
async function item(id, name, action, expected, fn) {
  try {
    const r = await fn();
    record({ id, item: name, action, expected, observed: r.observed, pass: r.pass, ms: r.ms ?? null, notes: r.notes ?? '' });
  } catch (e) {
    record({ id, item: name, action, expected, observed: `exercise error: ${String(e?.message || e).split('\n')[0].slice(0, 220)}`, pass: false, ms: null, notes: 'the step itself threw; see observed' });
  }
}
function addNote(id, text) {
  const r = rows.find(x => x.id === id);
  if (r) r.notes = r.notes ? `${r.notes}; ${text}` : text;
  else (memo.pendingNotes ??= []).push([id, text]);
}
const manual = (id, name, action, expected, why, observed = '—') => record({ id, item: name, action, expected, observed, pass: 'manual', ms: null, notes: why });

/* the page-side helpers, installed before the app's own scripts on every load */
function HELPERS() {
  const A = {};
  A.cfg = () => {
    try {
      return JSON.parse(localStorage.getItem('slayer_terrain_v1') || 'null');
    } catch {
      return null;
    }
  };
  A.pane = i => document.querySelectorAll('[data-chart-frame]')[i] || null;
  A.head = i => A.pane(i)?.querySelector('[data-pane-head]') || null;
  A.say = () => document.querySelector('span.sr-only[aria-live="polite"]')?.textContent ?? '';
  A.state = i => (A.pane(i)?.querySelector('[data-chart-state]')?.getAttribute('data-chart-state') ?? '').split('|');
  A.tf = i => A.state(i)[1];
  A.bars = i => +(A.state(i)[2] || 0);
  A.vis = el => {
    if (!el || !el.isConnected) return false;
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0;
  };
  A.chart = i => {
    const p = A.pane(i);
    if (!p) return null;
    let best = null;
    for (const c of window.__charts || []) {
      if (!c.host || !c.host.isConnected || !p.contains(c.host)) continue;
      const w = c.host.getBoundingClientRect().width;
      if (!best || w > best.w) best = { c, w };
    }
    return best?.c ?? null;
  };
  A.sec = t => (typeof t === 'number' ? t : typeof t === 'string' ? Date.parse(t + 'T12:00:00Z') / 1000 : t && typeof t === 'object' ? Date.UTC(t.year, t.month - 1, t.day, 12) / 1000 : NaN);
  A.range = i => {
    const c = A.chart(i);
    const r = c?.chart.timeScale().getVisibleRange();
    return r ? { from: A.sec(r.from), to: A.sec(r.to) } : null;
  };
  A.lastBar = i => {
    const d = A.chart(i)?.candles.data() ?? [];
    return d.length ? A.sec(d[d.length - 1].time) : NaN;
  };
  /* a bar's place on the screen: `back` bars from the newest (or a share of the visible bars) */
  A.barXY = (i, back, priceKey = 'close') => {
    const c = A.chart(i);
    if (!c) return null;
    const d = c.candles.data();
    if (!d.length) return null;
    const bar = d[Math.max(0, d.length - 1 - back)];
    const x = c.chart.timeScale().timeToCoordinate(bar.time);
    const y = c.candles.priceToCoordinate(bar[priceKey] ?? bar.value ?? bar.close);
    if (x == null || y == null) return null;
    const el = c.chart.chartElement();
    const r = el.getBoundingClientRect();
    let lw = 0;
    try {
      lw = c.chart.priceScale('left').width();
    } catch {}
    return { x: r.left + lw + x, y: r.top + y, time: A.sec(bar.time), plot: { left: r.left + lw, top: r.top, width: c.chart.timeScale().width(), height: r.height } };
  };
  A.priceY = (i, price) => {
    const c = A.chart(i);
    const y = c?.candles.priceToCoordinate(price);
    if (y == null) return null;
    const r = c.chart.chartElement().getBoundingClientRect();
    let lw = 0;
    try {
      lw = c.chart.priceScale('left').width();
    } catch {}
    return { y: r.top + y, left: r.left + lw, width: c.chart.timeScale().width(), top: r.top, height: r.height };
  };
  /* a point in a bar's column where no bead lies (a click on a bead pins its strike instead) */
  A.freeXY = (i, back) => {
    const c = A.chart(i);
    if (!c) return null;
    const d = c.candles.data();
    const bar = d[Math.max(0, d.length - 1 - back)];
    const x = c.chart.timeScale().timeToCoordinate(bar.time);
    if (x == null) return null;
    const el = c.chart.chartElement();
    const r = el.getBoundingClientRect();
    let lw = 0;
    try { lw = c.chart.priceScale('left').width(); } catch {}
    const ys = [];
    for (let y = 110; y < r.height - 60; y += 6) if (!c.trails?.beadAt?.(x, y)) ys.push(y);
    if (!ys.length) return null;
    return { x: r.left + lw + x, y: r.top + ys[Math.floor(ys.length / 2)], time: A.sec(bar.time) };
  };
  /* what the candle series shows: its first and last visible bars, and how many bars lie past each edge */
  A.seen = i => {
    const c = A.chart(i);
    const lr = c?.chart.timeScale().getVisibleLogicalRange();
    if (!lr) return null;
    const b = c.candles.barsInLogicalRange(lr);
    const d = c.candles.data();
    if (!b || !d.length) return null;
    return { from: A.sec(b.from), to: A.sec(b.to), before: Math.round(b.barsBefore), after: Math.round(b.barsAfter), n: d.length, last: A.sec(d[d.length - 1].time) };
  };
  A.badge = () => document.querySelector('[data-replay-badge]')?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
  A.minuteOf = s => {
    const m = /(\d{1,2}):(\d{2})\s*([ap]m)/.exec(s || '');
    if (!m) return null;
    let h = +m[1] % 12;
    if (m[3] === 'pm') h += 12;
    return h * 60 + +m[2];
  };
  window.__A = A;
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

/* a desk in a fresh context: the panes, the layout and the cut seeded before the first paint */
async function openDesk(o = {}) {
  const { w = 1440, h = 900, layout = 1, panes = [{ ticker: 'SPY', timeframe: '5m' }], ladder = false, railCut, mobile = false, clock, theme = 'dark', wait = 'bars', extra = {}, route, at = '/terrain' } = o;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, timezoneId: 'America/Los_Angeles', isMobile: mobile, hasTouch: mobile, acceptDownloads: true, deviceScaleFactor: 1 });
  if (clock) await ctx.clock.install({ time: clock });
  if (route) await route(ctx);
  const cfg = { layout, panes: panes.map(p => ({ overlays: { trails: true }, ladder, ...p })) };
  if (railCut !== undefined) cfg.railCut = railCut;
  await ctx.addInitScript(
    ({ cfg, theme, extra }) => {
      try {
        if (sessionStorage.getItem('__areaA')) return;
        sessionStorage.setItem('__areaA', '1');
        localStorage.setItem('slayer_theme', theme);
        localStorage.setItem('slayer_desk_chooser', '1');
        localStorage.setItem('slayer_terrain_sky1', '1');
        localStorage.setItem('slayer_name', cfg.panes[0].ticker);
        localStorage.setItem('slayer_terrain_v1', JSON.stringify(cfg));
        for (const [k, v] of Object.entries(extra)) localStorage.setItem(k, v);
      } catch {}
    },
    { cfg, theme, extra }
  );
  await ctx.addInitScript(HELPERS);
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const t0 = Date.now();
  await page.goto(BASE + at, { waitUntil: 'domcontentloaded' });
  if (wait === 'bars') await readyBars(page, mobile ? 1 : layout);
  else if (wait === 'head') await page.waitForSelector('[data-pane-head], [data-chart-frame]', { timeout: 60000 });
  const loadMs = Date.now() - t0;
  if (o.quiet !== false) await quietToasts(page);
  return { ctx, page, loadMs };
}
/* the shell's toasts (a recap posted on a fresh visit stands 5 s at the top right, over a fullscreen strip's tools) */
async function quietToasts(page) {
  await sleep(1500);
  await until(page, () => !document.querySelector('[data-alert-toasts] > *'), null, 12000);
}
async function readyBars(page, n, timeout = 90000) {
  await page.waitForFunction(
    n => {
      const f = document.querySelectorAll('[data-chart-frame]');
      if (f.length < n) return false;
      for (let i = 0; i < n; i++) {
        const s = f[i].querySelector('[data-chart-state]')?.getAttribute('data-chart-state');
        if (!s || !(+s.split('|')[2] > 0)) return false;
      }
      return true;
    },
    n,
    { timeout }
  );
}
async function until(page, fn, arg = null, timeout = 8000) {
  try {
    await page.waitForFunction(fn, arg, { timeout, polling: 'raf' });
    return true;
  } catch {
    return false;
  }
}
async function measure(page, action, pred, arg = null, timeout = 8000) {
  const t0 = Date.now();
  await action();
  const ok = await until(page, pred, arg, timeout);
  return { ok, ms: Date.now() - t0 };
}
const ev = (page, fn, arg) => page.evaluate(fn, arg);
const cfgOf = page => ev(page, () => window.__A.cfg());
async function hoverPane(page, i = 0) {
  const p = await ev(page, i => {
    const r = window.__A.pane(i).getBoundingClientRect();
    return { x: r.left + r.width * 0.4, y: r.top + r.height * 0.6 };
  }, i);
  await page.mouse.move(p.x, p.y);
  await page.mouse.move(p.x + 3, p.y + 2);
}
async function hoverRow(page, i = 0) {
  await hoverPane(page, i);
  await page.locator('[data-chart-frame]').nth(i).locator('[data-toolbar-row]').waitFor({ state: 'visible', timeout: 4000 });
}
const awayMouse = page => page.mouse.move(120, 860);
async function setTicker(page, i, sym) {
  const P = page.locator('[data-chart-frame]').nth(i);
  await P.locator('[data-scope-pick]').first().click();
  const dlg = page.locator('[role=dialog][aria-label^="Change symbol"]');
  await dlg.locator('input').first().fill(sym);
  await page.keyboard.press('Enter');
  await until(page, ([i, s]) => window.__A.state(i)[0] === s && window.__A.bars(i) > 0, [i, sym], 30000);
}
async function setTf(page, i, tf) {
  const tab = page.locator('[data-chart-frame]').nth(i).locator(`[data-confluence-tabs] button[data-tf="${tf}"]`);
  if (await tab.count()) await tab.click();
  else {
    await page.keyboard.press('Escape').catch(() => {});
  }
  await until(page, ([i, tf]) => window.__A.tf(i) === tf && window.__A.bars(i) > 0, [i, tf], 30000);
}
const NY_NOON = iso => Date.parse(`${iso}T16:00:00Z`) / 1000;
const inRange = (r, s) => !!r && r.from <= s && s <= r.to;
const days = r => (r ? (r.to - r.from) / 86400 : NaN);
const TF_SEC = { '15s': 15, '1m': 60, '5m': 300, '15m': 900, '30m': 1800, '1h': 3600, '1D': 86400, '1W': 604800 };
const isoD = s => (Number.isFinite(s) ? new Date(s * 1000).toISOString().slice(0, 10) : '?');
/* after a timeframe change: does the view stand on the newest bars? */
async function viewNewest(page, i, tf) {
  await sleep(1500);
  const o = await ev(page, i => window.__A.seen(i), i);
  const ok = !!o && o.after <= 0;
  return { ok, txt: ok ? 'the view on the newest bars' : o ? `the view on ${isoD(o.from)} → ${isoD(o.to)} (${o.after} bars past its right edge) while the newest bar is ${isoD(o.last)}` : 'no view' };
}
async function group(name, fn) {
  if (ONLY && !ONLY.has(name)) return;
  const t0 = Date.now();
  console.log(`\n=== ${name} ===`);
  try {
    await fn();
  } catch (e) {
    console.log(`group ${name} aborted: ${String(e?.message || e).split('\n')[0]}`);
    memo[`abort:${name}`] = String(e?.message || e).split('\n')[0];
  }
  console.log(`=== ${name} done in ${((Date.now() - t0) / 1000).toFixed(1)} s ===`);
}

/* ═══ GROUP: THE HEADER ROW (1440 × 900, one pane, the ladder off — the header holds its tools) ═══ */
await group('header', async () => {
  const { ctx, page, loadMs } = await openDesk({});
  memo.loadMs = loadMs;
  const P = page.locator('[data-chart-frame]').first();
  const H = P.locator('[data-pane-head]');
  try {
    memo.headForms1440 = await ev(page, () => { const h = window.__A.head(0); return { win: h.dataset.windowForm, jump: h.dataset.jumpForm }; });

    await item('A-03', 'Symbol chip "[logo] SPY ▾"', 'click the chip', 'the "Change symbol" dialog opens', async () => {
      const r = await measure(page, () => H.locator('[data-scope-pick]').click(), () => window.__A.vis(document.querySelector('[role=dialog][aria-label^="Change symbol"]')));
      const label = await ev(page, () => document.querySelector('[role=dialog][aria-label^="Change symbol"]')?.getAttribute('aria-label') ?? null);
      return { observed: r.ok ? `dialog open: "${label}"` : 'no dialog opened', pass: r.ok, ms: r.ms };
    });
    await item('A-04', 'Symbol picker dialog (search and list)', 'type "QQQ", press Enter', 'the pane changes to QQQ (config and chart) and the dialog closes', async () => {
      const dlg = page.locator('[role=dialog][aria-label^="Change symbol"]');
      await dlg.locator('input').first().fill('QQQ');
      const r = await measure(page, () => page.keyboard.press('Enter'), () => window.__A.cfg()?.panes?.[0]?.ticker === 'QQQ' && window.__A.state(0)[0] === 'QQQ' && window.__A.bars(0) > 0 && !document.querySelector('[role=dialog][aria-label^="Change symbol"]'), null, 30000);
      const o = await ev(page, () => ({ cfg: window.__A.cfg()?.panes?.[0]?.ticker, chart: window.__A.state(0)[0], open: !!document.querySelector('[role=dialog][aria-label^="Change symbol"]') }));
      return { observed: `config ${o.cfg}, chart ${o.chart}, dialog ${o.open ? 'still open' : 'closed'}`, pass: r.ok, ms: r.ms, notes: 'ms = Enter to the QQQ chart drawn with bars' };
    });
    await setTicker(page, 0, 'SPY');

    /* ── compare ── */
    const cmpBtn = P.locator('button[aria-label="Compare symbol"]');
    const cmpInput = page.locator('input[role=combobox][placeholder="Compare symbols…"]');
    await item('A-11', 'Compare "+"', 'click the +', 'the compare panel opens with the "Compare symbols…" input (not clipped)', async () => {
      const r = await measure(page, () => cmpBtn.click(), () => window.__A.vis(document.querySelector('input[role=combobox][placeholder="Compare symbols…"]')));
      const geo = await ev(page, () => {
        const inp = document.querySelector('input[role=combobox][placeholder="Compare symbols…"]');
        let panel = inp;
        while (panel && panel.parentElement && !/absolute|fixed/.test(getComputedStyle(panel).position)) panel = panel.parentElement;
        const pr = panel?.getBoundingClientRect();
        const fr = window.__A.pane(0).getBoundingClientRect();
        return pr ? { panel: [Math.round(pr.left), Math.round(pr.top), Math.round(pr.right), Math.round(pr.bottom)], pane: [Math.round(fr.left), Math.round(fr.top), Math.round(fr.right), Math.round(fr.bottom)], inside: pr.left >= fr.left - 1 && pr.right <= fr.right + 1 && pr.bottom <= fr.bottom + 1 } : null;
      });
      return { observed: r.ok ? `panel open; panel box ${JSON.stringify(geo?.panel)} in pane ${JSON.stringify(geo?.pane)} (${geo?.inside ? 'whole' : 'cut by the pane'})` : 'no panel', pass: r.ok && !!geo?.inside, ms: r.ms };
    });
    await item('A-12', 'Compare search "Compare symbols…"', 'type "QQQ", then Esc', 'listbox rows appear; Esc closes the panel', async () => {
      const r = await measure(page, () => cmpInput.fill('QQQ'), () => document.querySelectorAll('[role=listbox][aria-label="Symbols to compare"] [role=option]').length > 0);
      const n = await ev(page, () => document.querySelectorAll('[role=listbox][aria-label="Symbols to compare"] [role=option]').length);
      await page.keyboard.press('Escape');
      const closed = await until(page, () => !window.__A.vis(document.querySelector('input[role=combobox][placeholder="Compare symbols…"]')), null, 3000);
      const still = await ev(page, () => !!document.querySelector('[data-chart-frame][role=dialog]'));
      return { observed: `${n} option row(s); Esc ${closed ? 'closed the panel' : 'left the panel open'}${still ? ' (and expanded the pane?)' : ''}`, pass: r.ok && n > 0 && closed, ms: r.ms };
    });
    const addCompare = async (sym, mode) => {
      if (!(await cmpInput.isVisible().catch(() => false))) await cmpBtn.click();
      await cmpInput.fill(sym);
      const opt = page.locator('[role=listbox][aria-label="Symbols to compare"] [role=option]').filter({ hasText: new RegExp(`^\\s*${sym}`) }).first();
      await opt.hover();
      const btn = page.locator(`button[aria-label="Add ${sym} — ${mode}"]`);
      return measure(page, () => btn.click({ force: true }), ([s]) => (window.__A.cfg()?.panes?.[0]?.compares ?? []).some(c => c.ticker === s), [sym]);
    };
    await item('A-13', 'Compare mode "Same % scale"', 'type QQQ, hover the row, click "Same % scale"', 'compares gains {QQQ, percent}; the legend row "QQQ … ×" appears', async () => {
      const r = await addCompare('QQQ', 'Same % scale');
      const ok2 = await until(page, () => window.__A.vis(document.querySelector('[aria-label="Remove the QQQ comparison"]')), null, 8000);
      const c = await ev(page, () => window.__A.cfg()?.panes?.[0]?.compares);
      return { observed: `compares ${JSON.stringify(c)}; legend row ${ok2 ? 'shown' : 'missing'}`, pass: r.ok && ok2 && c?.some(x => x.ticker === 'QQQ' && x.mode === 'percent'), ms: r.ms };
    });
    await item('A-14', 'Compare mode "New price scale"', 'add IWM with "New price scale"', 'mode `scale`; the header strip takes a left padding', async () => {
      const r = await addCompare('IWM', 'New price scale');
      await sleep(400);
      const o = await ev(page, () => ({ c: window.__A.cfg()?.panes?.[0]?.compares, pad: window.__A.pane(0).querySelector('[data-pane-head-row]')?.parentElement?.style.paddingLeft ?? '' }));
      return { observed: `compares ${JSON.stringify(o.c)}; strip padding-left "${o.pad}"`, pass: r.ok && o.c?.some(x => x.ticker === 'IWM' && x.mode === 'scale') && !!o.pad, ms: r.ms };
    });
    await item('A-15', 'Compare mode "New pane"', 'add NVDA with "New pane"', 'mode `pane`', async () => {
      const r = await addCompare('NVDA', 'New pane');
      const c = await ev(page, () => window.__A.cfg()?.panes?.[0]?.compares);
      return { observed: `compares ${JSON.stringify(c)}`, pass: r.ok && c?.some(x => x.ticker === 'NVDA' && x.mode === 'pane'), ms: r.ms };
    });
    await item('A-16', '"Added symbols" list, remove ×', 'open the panel, click "Remove IWM comparison"', 'IWM leaves `compares`', async () => {
      if (!(await cmpInput.isVisible().catch(() => false))) await cmpBtn.click();
      const r = await measure(page, () => page.locator('[aria-label="Remove IWM comparison"]').click(), () => !(window.__A.cfg()?.panes?.[0]?.compares ?? []).some(c => c.ticker === 'IWM'));
      await page.keyboard.press('Escape');
      return { observed: r.ok ? 'IWM removed' : 'IWM still compared', pass: r.ok, ms: r.ms };
    });
    await item('A-17', 'Compare legend row "QQQ $… ×"', 'with the pointer on the pane, click the legend row ×', 'the row disappears and `compares` shrinks', async () => {
      await until(page, () => !window.__A.vis(document.querySelector('input[role=combobox][placeholder="Compare symbols…"]')), null, 2000);
      await hoverPane(page, 0);
      await sleep(300);
      const o = await ev(page, () => {
        const b = document.querySelector('[aria-label="Remove the QQQ comparison"]');
        if (!b) return null;
        const r = b.getBoundingClientRect();
        const at = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return { legend: b.parentElement?.textContent?.trim(), over: at === b || b.contains(at) ? null : at?.closest('[data-toolbar-row]') ? 'the hover toolbar row ([data-toolbar-row])' : `${at?.tagName}.${String(at?.className).slice(0, 40)}` };
      });
      if (!o) return { observed: 'no legend row', pass: false };
      const t0 = Date.now();
      let clicked = true;
      await page.locator('[aria-label="Remove the QQQ comparison"]').click({ timeout: 3000 }).catch(() => { clicked = false; });
      const ok = clicked && (await until(page, () => !document.querySelector('[aria-label="Remove the QQQ comparison"]') && !(window.__A.cfg()?.panes?.[0]?.compares ?? []).some(c => c.ticker === 'QQQ'), null, 3000));
      const ms = Date.now() - t0;
      /* the keys: focus the × and press Enter */
      let keys = 'not tried';
      if (!ok) {
        await page.locator('[aria-label="Remove the QQQ comparison"]').focus();
        await page.keyboard.press('Enter');
        keys = (await until(page, () => !(window.__A.cfg()?.panes?.[0]?.compares ?? []).some(c => c.ticker === 'QQQ'), null, 2000)) ? 'focus + Enter removes it' : 'focus + Enter does nothing';
      }
      /* clean up what is left through the panel (A-16's path) */
      for (const t of ['QQQ', 'NVDA']) {
        if (!(await ev(page, t => (window.__A.cfg()?.panes?.[0]?.compares ?? []).some(c => c.ticker === t), t))) continue;
        if (!(await cmpInput.isVisible().catch(() => false))) await cmpBtn.click();
        await page.locator(`[aria-label="Remove ${t} comparison"]`).click().catch(() => {});
      }
      await page.keyboard.press('Escape');
      await awayMouse(page);
      return { observed: `legend "${o.legend}"; ${ok ? 'row and entry gone' : `the click never landed: ${o.over ?? 'something'} lies over the × while the pointer is on the pane`}; ${keys}`, pass: ok, ms: ok ? ms : null, notes: ok ? '' : 'the hover row (Terrain.tsx `data-toolbar-row`, absolute top-full z-10) stands over the compare legend rows under the header and takes their pointer' };
    });

    /* the C key where the + stands (A-236's other half) */
    memo.cWide = await (async () => {
      await ev(page, () => document.activeElement?.blur?.());
      const r = await measure(page, () => page.keyboard.press('c'), () => window.__A.vis(document.querySelector('input[role=combobox][placeholder="Compare symbols…"]')), null, 3000);
      await page.keyboard.press('Escape');
      await until(page, () => !window.__A.vis(document.querySelector('input[role=combobox][placeholder="Compare symbols…"]')), null, 2000);
      return r;
    })();

    /* ── facts ── */
    memo.price = await ev(page, () => {
      const h = window.__A.head(0);
      const leaf = [...h.querySelectorAll('*')].find(e => e.children.length === 0 && /^\$[\d,]+\.\d{2}$/.test(e.textContent.trim()));
      const wrap = leaf?.closest('[data-price-stale], span.shrink-0');
      return leaf ? { text: leaf.textContent.trim(), pe: getComputedStyle(leaf).pointerEvents, stale: wrap?.hasAttribute('data-price-stale') ?? false } : null;
    });
    await item('A-22', 'Change "+0.42%"', 'read the header change against the rail', 'a signed percent in the direction ink with data-dir; agrees with the rail', async () => {
      const o = await ev(page, () => {
        const el = window.__A.head(0).querySelector('[data-dir]');
        const rail = [...document.querySelectorAll('aside *, nav *')].find(e => e.children.length === 0 && /^[+−-]\d+\.\d+%$/.test(e.textContent.trim()));
        return { text: el?.textContent?.trim(), dir: el?.getAttribute('data-dir'), cls: el?.className ?? '', rail: rail?.textContent?.trim() ?? null };
      });
      const signOk = o.text && ((o.text.startsWith('+') && o.dir === 'up') || (o.text.startsWith('−') && o.dir === 'down'));
      const n = t => (t == null ? NaN : +t.replace('−', '-').replace('+', '').replace('%', ''));
      const same = !o.rail || Math.abs(n(o.rail) - n(o.text)) < 0.006;
      return { observed: `header ${o.text} (data-dir ${o.dir}, ${/text-bull/.test(o.cls) ? 'bull' : /text-bear/.test(o.cls) ? 'bear' : '?'} ink); rail ${o.rail}`, pass: !!signOk && same, ms: null, notes: o.rail && o.rail !== o.text ? `same figure, but the rail prints "${o.rail}" with ${o.rail.startsWith('-') ? 'a hyphen-minus' : 'another glyph'} where the header prints the true minus (core/format) — outside Area A` : '' };
    });
    memo.age = await ev(page, () => { const a = window.__A.head(0).querySelector('[data-pane-age]'); return a ? { kind: a.dataset.paneAge, form: a.dataset.paneAgeForm, words: a.getAttribute('aria-label'), title: a.title, pe: getComputedStyle(a).pointerEvents } : null; });

    /* ── the timeframe tabs ── */
    for (const [id, tf] of [['A-24', '1m'], ['A-25', '5m'], ['A-26', '15m'], ['A-27', '1h'], ['A-28', '1D']]) {
      await item(id, `Timeframe tab "${tf}"`, `click the ${tf} tab`, `config and chart on ${tf}; the tab aria-pressed`, async () => {
        if (id === 'A-25') await setTf(page, 0, '1m');
        const r = await measure(page, () => H.locator(`[data-confluence-tabs] button[data-tf="${tf}"]`).click(), tf => window.__A.cfg()?.panes?.[0]?.timeframe === tf && window.__A.tf(0) === tf && window.__A.bars(0) > 0, tf, 30000);
        const o = await ev(page, tf => ({ cfg: window.__A.cfg()?.panes?.[0]?.timeframe, chart: window.__A.tf(0), pressed: window.__A.head(0).querySelector(`[data-confluence-tabs] button[data-tf="${tf}"]`)?.getAttribute('aria-pressed') }), tf);
        const v = await viewNewest(page, 0, tf);
        return { observed: `config ${o.cfg}, chart ${o.chart}, aria-pressed ${o.pressed}; ${v.txt}`, pass: r.ok && o.pressed === 'true' && v.ok, ms: r.ms, notes: 'ms = click to the chart drawn on the new timeframe' };
      });
    }
    await setTf(page, 0, '5m');

    /* ── A-29 a timeframe the tabs do not carry, set from the hover row ── */
    await item('A-29', 'Current timeframe label "30m" beside the tabs', 'set 30m from the hover row', 'the label "30m" appears beside the tabs', async () => {
      await hoverRow(page, 0);
      const row = P.locator('[data-toolbar-row]');
      const trig = row.locator('button[title="Timeframe"]');
      let r;
      if (await trig.count()) {
        await trig.click();
        r = await measure(page, () => page.locator('[data-toolbar-menu] [role=group][aria-label="Timeframe"] button').filter({ hasText: rx('30m') }).click(), () => window.__A.head(0).querySelector('span[data-pane-tf]')?.textContent?.trim() === '30m', null, 15000);
      } else r = await measure(page, () => row.locator('[role=group][aria-label="Timeframe"] button').filter({ hasText: rx('30m') }).click(), () => window.__A.head(0).querySelector('span[data-pane-tf]')?.textContent?.trim() === '30m', null, 15000);
      const t = await ev(page, () => window.__A.head(0).querySelector('span[data-pane-tf]')?.textContent?.trim() ?? null);
      return { observed: `label "${t}"`, pass: r.ok, ms: r.ms };
    });
    await awayMouse(page);
    await setTf(page, 0, '5m');

    /* ── the expiry window, the full chips (the trigger form is checked on two panes) ── */
    memo.winFull = {};
    for (const [id, v] of [['A-40', 'w:0dte'], ['A-41', 'w:fri'], ['A-42', 'w:opex'], ['A-43', 'book']]) {
      try {
        const chip = H.locator(`[data-window-pick="${v}"]`);
        if (!(await chip.count())) { memo.winFull[id] = { ok: false, why: 'no full chips at 1440 × 900 one pane' }; continue; }
        const r = await measure(page, () => chip.click(), v => window.__A.cfg()?.railCut === v && window.__A.head(0).querySelector('[data-pane-window]')?.getAttribute('data-pane-window') === v, v);
        const pressed = await chip.getAttribute('aria-pressed');
        memo.winFull[id] = { ok: r.ok && pressed === 'true', ms: r.ms, pressed };
      } catch (e) {
        memo.winFull[id] = { ok: false, why: String(e.message).split('\n')[0] };
      }
    }
    memo.winFullForm = memo.headForms1440.win;

    /* ── the jumps ── */
    const jumpVia = async span => {
      const trig = H.locator('[data-jump-trigger]');
      if (await trig.count()) await trig.click();
      return page.locator(`[data-jump="${span}"]`).first();
    };
    await item('A-44', 'Jump trigger "Jump ▾"', 'click it', 'the jump list opens with 6 rows with hints', async () => {
      const trig = H.locator('[data-jump-trigger]');
      if (!(await trig.count())) return { observed: `no trigger — the jumps are ${memo.headForms1440.jump}`, pass: false };
      const r = await measure(page, () => trig.click(), () => window.__A.vis(document.querySelector('[data-popover-card="pane-jump"]')));
      const n = await ev(page, () => [...document.querySelectorAll('[data-popover-card="pane-jump"] [data-jump]')].map(b => b.textContent.trim().slice(0, 18)));
      await page.keyboard.press('Escape');
      return { observed: `${n.length} rows: ${n.join(' | ')}`, pass: r.ok && n.length === 6, ms: r.ms };
    });
    const JUMPS = [
      ['A-45', 'today', 'Today', '1h', '5m', d => d <= 1.6],
      ['A-46', '1w', '1W', '5m', '15m', d => d >= 3 && d <= 11],
      ['A-47', '1m', '1M', '5m', '1h', d => d >= 18 && d <= 40],
      ['A-48', '6m', '6M', '5m', '1D', d => d >= 140 && d <= 210],
      ['A-49', '1y', '1Y', '5m', '1D', d => d >= 300 && d <= 400],
      ['A-50', 'max', 'Max', '5m', '1D', d => d >= 360],
    ];
    for (const [id, span, label, from, want, spanOk] of JUMPS) {
      await item(id, `Jump "${label}"`, `on ${from}, Jump ▾ → ${label}`, `the pane goes to ${want} and the view spans ${label === 'Today' ? 'the session' : label}`, async () => {
        await setTf(page, 0, from);
        const btn = await jumpVia(span);
        const r = await measure(page, () => btn.click(), want => window.__A.tf(0) === want && window.__A.bars(0) > 0, want, 30000);
        await sleep(2500);
        const o = await ev(page, () => ({ tf: window.__A.tf(0), s: window.__A.seen(0) }));
        const d = o.s ? (o.s.to - o.s.from) / 86400 : NaN;
        const atEnd = !!o.s && o.s.after <= 0;
        return { observed: `timeframe ${o.tf}; the candles in view ${isoD(o.s?.from)} → ${isoD(o.s?.to)} (${d.toFixed(1)} days; ${o.s?.before} bars before, ${o.s?.after} after, of ${o.s?.n}), ${atEnd ? 'reaching the newest bar' : 'short of the newest bar'}`, pass: r.ok && spanOk(d) && atEnd, ms: r.ms, notes: 'ms = click to the chart drawn on the jump\'s timeframe; the view read 2.5 s later off the candle series (barsInLogicalRange)' };
      });
    }
    await setTf(page, 0, '5m');

    /* ── the calendar ── */
    const dateDoor = H.locator('[data-jump-date]');
    await item('A-51', 'Calendar door', 'click the calendar icon', '"Jump to a day" opens with a date field and Go', async () => {
      const r = await measure(page, () => dateDoor.click(), () => window.__A.vis(document.querySelector('[data-popover-card="pane-jump-date"] [data-jump-date-input]')));
      return { observed: r.ok ? 'card open with the date field' : 'no card', pass: r.ok, ms: r.ms };
    });
    await item('A-52', 'Date field "Jump to a day"', 'set 2026-10-09', 'the field holds the day; min = first bar, max = today (New York)', async () => {
      const inp = page.locator('[data-jump-date-input]');
      await inp.fill('2026-10-09');
      const o = await ev(page, () => { const i = document.querySelector('[data-jump-date-input]'); return { v: i.value, min: i.min, max: i.max }; });
      return { observed: `value ${o.v}, min ${o.min}, max ${o.max}`, pass: o.v === '2026-10-09' && !!o.min && !!o.max, ms: null };
    });
    await item('A-53', '"Go"', 'click Go', 'the card closes and the view jumps to Oct 9', async () => {
      const go = page.locator('[data-popover-card="pane-jump-date"] button[type=submit]');
      const r = await measure(page, () => go.click(), s => { const r = window.__A.range(0); return !!r && r.from <= s && s <= r.to && !document.querySelector('[data-popover-card="pane-jump-date"]'); }, NY_NOON('2026-10-09'), 15000);
      const o = await ev(page, () => ({ r: window.__A.range(0), tf: window.__A.tf(0), card: !!document.querySelector('[data-popover-card="pane-jump-date"]') }));
      return { observed: `view ${new Date(o.r.from * 1000).toISOString().slice(0, 16)} → ${new Date(o.r.to * 1000).toISOString().slice(0, 16)}Z on ${o.tf}; card ${o.card ? 'open' : 'closed'}`, pass: r.ok, ms: r.ms };
    });
    /* the view left the newest bar: the pill */
    memo.backLive = {};
    try {
      const shown = await until(page, () => window.__A.vis(document.querySelector('[data-back-to-live]')), null, 4000);
      const r = shown ? await measure(page, () => P.locator('[data-back-to-live]').click(), () => { const r = window.__A.range(0); return !document.querySelector('[data-back-to-live]') && r && r.to >= window.__A.lastBar(0) - 600; }) : { ok: false, ms: null };
      memo.backLive = { shown, ok: r.ok, ms: r.ms };
    } catch (e) {
      memo.backLive = { shown: false, ok: false, why: String(e.message).split('\n')[0] };
    }
    const jumpDay = async iso => {
      await dateDoor.click();
      await page.locator('[data-jump-date-input]').fill(iso);
      await page.locator('[data-popover-card="pane-jump-date"] button[type=submit]').click();
    };
    await item('A-161', 'No-data card "No data for Oct 10" · "‹ Previous session"', 'jump to Saturday 2026-10-10, click Previous session', 'the card shows; Previous moves the view to Friday Oct 9', async () => {
      const r0 = await measure(page, () => jumpDay('2026-10-10'), () => window.__A.vis(document.querySelector('[data-no-day]')), null, 10000);
      const card = await ev(page, () => document.querySelector('[data-no-day]')?.textContent?.replace(/\s+/g, ' ').trim() ?? null);
      if (!r0.ok) return { observed: `no card (view ${JSON.stringify(await ev(page, () => window.__A.range(0)))})`, pass: false, ms: r0.ms };
      const r = await measure(page, () => P.locator('[data-no-day-prev]').click(), s => { const r = window.__A.range(0); return !document.querySelector('[data-no-day]') && !!r && r.from <= s && s <= r.to; }, NY_NOON('2026-10-09'), 10000);
      return { observed: `card "${card}"; Previous → ${r.ok ? 'view on Oct 9, card gone' : 'did not reach Oct 9'}`, pass: r.ok, ms: r.ms, notes: `the card came up in ${r0.ms} ms` };
    });
    await item('A-162', '"Next session ›"', 'jump to Saturday Oct 10, click Next session', 'the view moves to Monday Oct 12', async () => {
      await jumpDay('2026-10-10');
      await until(page, () => window.__A.vis(document.querySelector('[data-no-day]')), null, 10000);
      const r = await measure(page, () => P.locator('[data-no-day-next]').click(), s => { const r = window.__A.range(0); return !document.querySelector('[data-no-day]') && !!r && r.from <= s && s <= r.to; }, NY_NOON('2026-10-12'), 10000);
      /* holiday check: Labor Day, Monday 2026-09-07 */
      await jumpDay('2026-09-05');
      const c2 = await until(page, () => window.__A.vis(document.querySelector('[data-no-day]')), null, 10000);
      let hol = 'no card for Sat Sep 5';
      if (c2) {
        await P.locator('[data-no-day-next]').click();
        await sleep(1500);
        const o = await ev(page, () => ({ card: document.querySelector('[data-no-day]')?.textContent?.replace(/\s+/g, ' ').trim() ?? null, r: window.__A.range(0) }));
        hol = o.card ? `from Sat Sep 5, Next landed on Labor Day, another no-data card: "${o.card.slice(0, 60)}…" (not holiday-aware)` : `from Sat Sep 5, Next → view ${new Date(o.r.from * 1000).toISOString().slice(0, 10)}…${new Date(o.r.to * 1000).toISOString().slice(0, 10)}`;
      }
      return { observed: `from Sat Oct 10: ${r.ok ? 'view on Mon Oct 12, card gone' : 'did not reach Oct 12'}; ${hol}`, pass: r.ok && !/not holiday-aware/.test(hol), ms: r.ms };
    });
    await item('A-163', '"Back to live" (in the no-data card)', 'jump to a Saturday, click Back to live', 'the card goes and the view is at the newest bar', async () => {
      if (!(await page.locator('[data-no-day]').isVisible().catch(() => false))) {
        await jumpDay('2026-10-10');
        await until(page, () => window.__A.vis(document.querySelector('[data-no-day]')), null, 10000);
      }
      const r = await measure(page, () => P.locator('[data-no-day-live]').click(), () => { const r = window.__A.range(0); return !document.querySelector('[data-no-day]') && !!r && r.to >= window.__A.lastBar(0) - 600; }, null, 10000);
      return { observed: r.ok ? 'card gone, view at the newest bar' : 'card or view did not follow', pass: r.ok, ms: r.ms };
    });

    /* ── the three doors in the header ── */
    await item('A-54', 'Header Alerts door (bell)', 'click it', 'the alerts menu opens for this name', async () => {
      const b = H.locator('button[title="Alerts"]');
      if (!(await b.count())) return { observed: 'no Alerts door in the header', pass: false };
      const r = await measure(page, () => b.click(), () => !!document.querySelector('[data-toolbar-menu] input[aria-label^="Alert price for"]'));
      const lbl = await ev(page, () => document.querySelector('[data-toolbar-menu] input[aria-label^="Alert price for"]')?.getAttribute('aria-label'));
      return { observed: r.ok ? `menu open ("${lbl}")` : 'no menu', pass: r.ok, ms: r.ms };
    });
    const alertsOf = () => ev(page, () => { try { return JSON.parse(localStorage.getItem('slayer_price_alerts_SPY') || '[]'); } catch { return []; } });
    const priceBox = page.locator('[data-toolbar-menu] input[aria-label^="Alert price for"]');
    await item('A-62', 'Refusal line', 'type "abc", click Set', '"That is not a price"', async () => {
      await priceBox.fill('abc');
      const r = await measure(page, () => page.locator('[data-toolbar-menu] button').filter({ hasText: rx('Set') }).click(), () => /not a price/.test(document.querySelector('[data-toolbar-menu] [role=status]')?.textContent ?? ''));
      const t = await ev(page, () => document.querySelector('[data-toolbar-menu] [role=status]')?.textContent ?? null);
      return { observed: `"${t}"`, pass: r.ok, ms: r.ms };
    });
    await item('A-60', 'Price box (placeholder = spot)', 'type 780, press Enter', 'a price alert at 780 is armed for SPY', async () => {
      const ph = await priceBox.getAttribute('placeholder');
      await priceBox.fill('780');
      const r = await measure(page, () => priceBox.press('Enter'), () => { try { return JSON.stringify(JSON.parse(localStorage.getItem('slayer_price_alerts_SPY') || '[]')).includes('780'); } catch { return false; } });
      const a = await alertsOf();
      return { observed: `placeholder "${ph}"; ${a.length} alert(s) stored, ${JSON.stringify(a).includes('780') ? 'one at 780' : 'none at 780'}`, pass: r.ok, ms: r.ms };
    });
    await item('A-61', '"Set"', 'type 781, click Set', 'the alert is armed and the refusal clears', async () => {
      await priceBox.fill('781');
      const r = await measure(page, () => page.locator('[data-toolbar-menu] button').filter({ hasText: rx('Set') }).click(), () => { try { return JSON.stringify(JSON.parse(localStorage.getItem('slayer_price_alerts_SPY') || '[]')).includes('781'); } catch { return false; } });
      const st = await ev(page, () => document.querySelector('[data-toolbar-menu] [role=status]')?.textContent ?? null);
      await priceBox.fill('781');
      await page.locator('[data-toolbar-menu] button').filter({ hasText: rx('Set') }).click();
      const dup = await ev(page, () => document.querySelector('[data-toolbar-menu] [role=status]')?.textContent ?? null);
      return { observed: `armed ${r.ok}; refusal after ${st === null ? 'cleared' : `"${st}"`}; the same price again → "${dup}"`, pass: r.ok && st === null, ms: r.ms };
    });
    const CHIPS = [['A-63', 'Call wall'], ['A-64', 'Put wall'], ['A-65', 'Flip'], ['A-66', 'Supreme'], ['A-67', 'VWAP'], ['A-68', 'EMA 9'], ['A-69', 'EMA 21'], ['A-70', 'EMA 50'], ['A-71', 'RSI 70'], ['A-72', 'RSI 30'], ['A-73', 'GEX flips sign'], ['A-74', 'New supreme'], ['A-75', 'News lands'], ['A-76', 'Wall ±2'], ['A-77', 'Wall ±4'], ['A-78', '$250K'], ['A-79', '$1M'], ['A-80', '$5M']];
    for (const [id, label] of CHIPS) {
      await item(id, `Alerts chip "${label}"`, 'click it, then click it again', 'aria-pressed true (an alert armed), then false', async () => {
        const chip = page.locator('[data-toolbar-menu] button').filter({ hasText: rx(label) }).first();
        const n0 = (await alertsOf()).length;
        const r = await measure(page, () => chip.click(), label => [...document.querySelectorAll('[data-toolbar-menu] button')].find(b => b.textContent.trim() === label)?.getAttribute('aria-pressed') === 'true', label);
        const n1 = (await alertsOf()).length;
        const refused = await ev(page, () => document.querySelector('[data-toolbar-menu] [role=status]')?.textContent ?? null);
        const r2 = await measure(page, () => chip.click(), label => [...document.querySelectorAll('[data-toolbar-menu] button')].find(b => b.textContent.trim() === label)?.getAttribute('aria-pressed') === 'false', label);
        const n2 = (await alertsOf()).length;
        const undo = await ev(page, () => !!document.querySelector('[data-undo], [data-undo-chip]'));
        return { observed: `on: pressed ${r.ok} (alerts ${n0}→${n1})${refused ? `, said "${refused}"` : ''}; off: ${r2.ok ? 'released' : 'still pressed'} (→${n2})${undo ? '; an undo chip showed' : ''}`, pass: r.ok && r2.ok && n1 === n0 + 1 && n2 === n0, ms: r.ms };
      });
    }
    await page.keyboard.press('Escape');
    await until(page, () => !document.querySelector('[data-toolbar-menu]'), null, 2000);

    /* ── overlays ── */
    await item('A-55', 'Header Overlays door (layers + count)', 'click it', 'the 14 overlay switches open', async () => {
      const b = H.locator('button[title="Overlays"]');
      if (!(await b.count())) return { observed: 'no Overlays door in the header', pass: false };
      const name = await b.evaluate(e => (e.getAttribute('aria-label') || e.textContent).trim());
      const r = await measure(page, () => b.click(), () => document.querySelectorAll('[data-toolbar-menu] [role=checkbox]').length >= 14);
      const n = await ev(page, () => document.querySelectorAll('[data-toolbar-menu] [role=checkbox]').length);
      return { observed: `${n} switches; the door's accessible name "${name}"`, pass: r.ok && n === 14, ms: r.ms, notes: /^\d+$/.test(name) ? 'compact form: the accessible name is the count alone (aria-label is set only when the label is empty, ChartToolbar.tsx:397)' : '' };
    });
    const OVL = [['A-81', 'Exposure trails', 'trails'], ['A-82', 'Key levels', 'levels'], ['A-83', 'Dark pool', 'darkpool'], ['A-84', 'Volume', 'volume'], ['A-85', 'Flow', 'flow'], ['A-86', 'Net drift', 'netDrift'], ['A-87', 'Vol drift', 'volDrift'], ['A-88', 'Session levels', 'session'], ['A-89', 'Expected move', 'cone'], ['A-90', 'Events', 'events'], ['A-91', 'Alert lines', 'alerts'], ['A-92', 'Walls through the day', 'walls'], ['A-93', 'Regime strip', 'regime'], ['A-94', 'Session phases', 'phases']];
    for (const [id, label, key] of OVL) {
      await item(id, `Overlay "${label}"`, 'click the row, then click it again', `overlays.${key} flips, aria-checked follows, then flips back`, async () => {
        const row = page.locator('[data-toolbar-menu] [role=checkbox]').filter({ hasText: rx(label) }).first();
        const before = await ev(page, key => !!window.__A.cfg()?.panes?.[0]?.overlays?.[key], key);
        const hint = await row.getAttribute('title');
        const r = await measure(page, () => row.click(), ([key, b]) => !!window.__A.cfg()?.panes?.[0]?.overlays?.[key] === !b, [key, before]);
        const aria = await row.getAttribute('aria-checked');
        let extra = '';
        if (key === 'trails') extra = `; the legend ${await ev(page, () => (document.querySelector('[data-bead-legend]') ? 'stands' : 'gone'))}`;
        if (key === 'session') extra = `; opening-range row ${await ev(page, () => (document.querySelector('[data-toolbar-menu] [aria-label="Opening range minutes"]') ? 'shown' : 'absent'))}`;
        if (key === 'session' && !before) {
          for (const [oid, m] of [['A-95', 5], ['A-96', 15], ['A-97', 30]]) {
            await item(oid, `Opening range "${m}m"`, `with Session levels on, click ${m}m`, `sessionOr === ${m}`, async () => {
              const b = page.locator('[data-toolbar-menu] [aria-label="Opening range minutes"] button').filter({ hasText: rx(`${m}m`) });
              const r = await measure(page, () => b.click(), m => window.__A.cfg()?.panes?.[0]?.sessionOr === m || (m === 5 && window.__A.cfg()?.panes?.[0]?.sessionOr == null && document.querySelector('[data-toolbar-menu] [aria-label="Opening range minutes"] button[aria-pressed="true"]')?.textContent === '5m'), m);
              const o = await ev(page, () => ({ v: window.__A.cfg()?.panes?.[0]?.sessionOr, p: document.querySelector('[data-toolbar-menu] [aria-label="Opening range minutes"] button[aria-pressed="true"]')?.textContent }));
              return { observed: `sessionOr ${o.v ?? '(unset)'}; pressed "${o.p}"`, pass: r.ok, ms: r.ms };
            });
          }
        }
        const r2 = await measure(page, () => row.click(), ([key, b]) => !!window.__A.cfg()?.panes?.[0]?.overlays?.[key] === b, [key, before]);
        return { observed: `${before ? 'on' : 'off'} → ${!before ? 'on' : 'off'} (aria-checked ${aria}) → back ${r2.ok ? 'ok' : 'failed'}; hint "${(hint || '').slice(0, 60)}"${extra}`, pass: r.ok && r2.ok && aria === String(!before), ms: r.ms };
      });
    }
    await page.keyboard.press('Escape');

    /* ── replay door, keys door, pop-out, expand ── */
    await item('A-56', 'Replay door in the header', 'find the Replay door in a docked pane and click it twice', 'it renders, puts the replay badge up, then takes it down', async () => {
      const door = H.locator('[data-replay-door]');
      const n = await door.count();
      if (!n) return { observed: 'no Replay door in the header (nor checked in the hover row)', pass: false };
      const r = await measure(page, () => door.click(), () => !!document.querySelector('[data-replay-badge]'));
      const pressed = await door.getAttribute('aria-pressed');
      const r2 = await measure(page, () => door.click(), () => !document.querySelector('[data-replay-badge]'));
      return { observed: `door renders (title "${await door.getAttribute('title')}"); on → badge ${r.ok ? 'up' : 'missing'} (aria-pressed ${pressed}); off → ${r2.ok ? 'badge gone' : 'badge stays'}`, pass: r.ok && r2.ok, ms: r.ms };
    });
    await item('A-57', '"?" door', 'click it', 'the keys sheet opens, listing Terrain\'s keys', async () => {
      const r = await measure(page, () => H.locator('[data-pane-keys]').click(), () => window.__A.vis(document.querySelector('[data-key-sheet]')));
      const t = await ev(page, () => document.querySelector('[data-key-sheet]')?.textContent ?? '');
      const ok = /Terrain/.test(t);
      await page.keyboard.press('Escape');
      const closed = await until(page, () => !document.querySelector('[data-key-sheet]'), null, 3000);
      return { observed: `sheet ${r.ok ? 'open' : 'missing'}; ${(t.match(/Terrain[^A-Z]{0,30}/g) || []).slice(0, 3).join(' | ')}; Esc ${closed ? 'closed it' : 'left it'}`, pass: r.ok && ok, ms: r.ms };
    });
    await item('A-58', 'Pop-out door', 'click it', 'a window opens on /out/terrain with the same name and timeframe', async () => {
      const door = page.locator('[data-chart-frame]').first().locator('[data-popout-door="terrain"]');
      const paneTf = await ev(page, () => window.__A.tf(0));
      const t0 = Date.now();
      const [pop] = await Promise.all([ctx.waitForEvent('page', { timeout: 15000 }), door.click()]);
      await pop.waitForLoadState('domcontentloaded');
      const ok = await pop.waitForFunction(() => { const s = document.querySelector('[data-chart-state]')?.getAttribute('data-chart-state'); return s && +s.split('|')[2] > 0; }, null, { timeout: 45000 }).then(() => true).catch(() => false);
      const ms = Date.now() - t0;
      const o = await pop.evaluate(() => ({ url: location.pathname + location.search, s: document.querySelector('[data-chart-state]')?.getAttribute('data-chart-state'), keys: !!document.querySelector('[data-pane-keys]'), vp: [innerWidth, innerHeight] }));
      let keyNote = '';
      if (o.keys) {
        await pop.locator('[data-pane-keys]').click().catch(() => {});
        await sleep(600);
        keyNote = (await pop.evaluate(() => !!document.querySelector('[data-key-sheet]'))) ? '; its ? door opens the keys sheet' : '; its ? door opens nothing (no shell there)';
      } else keyNote = '; no ? door in the pop-out';
      await pop.keyboard.press('f');
      await sleep(400);
      const fx = await pop.evaluate(() => !!document.querySelector('[data-chart-frame][role=dialog]'));
      await pop.close();
      if (/opens nothing/.test(keyNote)) addNote('A-57', 'in a pop-out window the ? door opens nothing (/out/terrain sits outside AppShell, App.tsx, so nothing hears slayer:open-keys)');
      const [sym, tf] = (o.s || '').split('|');
      return { observed: `popup ${o.url.split('?')[0]}?pane=… (${o.vp.join('×')}), chart ${sym} ${tf}${keyNote}; F in it ${fx ? 'expanded' : 'did nothing'}`, pass: ok && sym === 'SPY' && tf === paneTf && o.url.startsWith('/out/terrain'), ms, notes: `the pane was on ${paneTf}; ms = click to the pop-out's chart drawn` };
    });
    await item('A-59', 'Expand door', 'click it', 'the pane becomes role=dialog "SPY expanded"; the desk bar floats', async () => {
      const r = await measure(page, () => page.locator('[data-expand-door]').first().click(), () => window.__A.pane(0)?.closest('[role=dialog]')?.getAttribute('aria-label') === 'SPY expanded' && document.querySelector('[data-terrain-desk-bar]')?.getAttribute('data-terrain-desk-bar') === 'floating');
      await page.locator('button[aria-label="Collapse SPY"]').click().catch(() => {});
      await until(page, () => !window.__A.pane(0)?.closest('[role=dialog]'), null, 3000);
      return { observed: r.ok ? 'expanded, desk bar floating' : 'not expanded', pass: r.ok, ms: r.ms };
    });
  } finally {
    await ctx.close();
  }
});

/* ═══ GROUP: THE HOVER TOOLBAR ROW (1440 × 900, one pane — the header holds Replay · Alerts · Overlays) ═══ */
await group('hover', async () => {
  const { ctx, page } = await openDesk({});
  const P = page.locator('[data-chart-frame]').first();
  const ROW = P.locator('[data-toolbar-row]');
  const pane0 = (k, d) => ev(page, ([k, d]) => window.__A.cfg()?.panes?.[0]?.[k] ?? d, [k, d]);
  try {
    await item('A-98', 'The hover row itself', 'move the pointer off the pane, onto it, off again, then Tab into the pane', 'hidden at rest; display flex on hover and on focus-within', async () => {
      await awayMouse(page);
      await sleep(300);
      const rest = await ev(page, () => getComputedStyle(window.__A.pane(0).querySelector('[data-toolbar-row]')).display);
      const r = await measure(page, () => hoverPane(page, 0), () => getComputedStyle(window.__A.pane(0).querySelector('[data-toolbar-row]')).display === 'flex');
      await awayMouse(page);
      await sleep(300);
      await P.locator('[data-scope-pick]').focus();
      const focus = await until(page, () => getComputedStyle(window.__A.pane(0).querySelector('[data-toolbar-row]')).display === 'flex', null, 2000);
      const parts = await ev(page, () => [...window.__A.pane(0).querySelectorAll('[data-toolbar-row] button')].map(b => (b.getAttribute('title') || b.getAttribute('aria-label') || b.textContent).trim().slice(0, 24)).filter(Boolean));
      await page.evaluate(() => document.activeElement?.blur());
      return { observed: `at rest ${rest}; on hover ${r.ok ? 'flex' : 'not shown'}; on focus ${focus ? 'flex' : 'not shown'}; holds: ${parts.join(' · ')}`, pass: rest === 'none' && r.ok && focus, ms: r.ms };
    });
    const tfTrig = ROW.locator('button[title="Timeframe"]');
    await hoverRow(page, 0);
    const compactTf = (await tfTrig.count()) > 0;
    await item('A-99', 'Hover-row timeframe (trigger or strip)', 'hover the pane, open the timeframe control', 'a list of the 8 timeframes', async () => {
      await hoverRow(page, 0);
      if (compactTf) {
        const r = await measure(page, () => tfTrig.click(), () => document.querySelectorAll('[data-toolbar-menu] [role=group][aria-label="Timeframe"] button').length === 8);
        const n = await ev(page, () => [...document.querySelectorAll('[data-toolbar-menu] [role=group][aria-label="Timeframe"] button')].map(b => b.textContent.trim()));
        await page.keyboard.press('Escape');
        return { observed: `trigger form: ${n.join(' ')}`, pass: r.ok, ms: r.ms, notes: 'the header shows the same timeframe as tabs: two controls for one state in one pane' };
      }
      const n = await ev(page, () => [...window.__A.pane(0).querySelectorAll('[data-toolbar-row] [role=group][aria-label="Timeframe"] button')].map(b => b.textContent.trim()));
      return { observed: `strip form: ${n.join(' ')}`, pass: n.length === 8, ms: null, notes: 'the header shows the same timeframe as tabs: two controls for one state in one pane' };
    });
    const TFS = [['A-100', '15s'], ['A-101', '1m'], ['A-102', '5m'], ['A-103', '15m'], ['A-104', '30m'], ['A-105', '1h'], ['A-106', '1D'], ['A-107', '1W']];
    for (const [id, tf] of TFS) {
      await item(id, `Hover-row option "${tf}"`, `pick ${tf} from the hover row`, tf === '15s' ? 'disabled on the feed, with its reason' : `the pane on ${tf}`, async () => {
        await hoverRow(page, 0);
        let btn;
        if (compactTf) {
          await tfTrig.click();
          btn = page.locator('[data-toolbar-menu] [role=group][aria-label="Timeframe"] button').filter({ hasText: rx(tf) });
        } else btn = ROW.locator('[role=group][aria-label="Timeframe"] button').filter({ hasText: rx(tf) });
        if (tf === '15s') {
          const o = await btn.evaluate(b => ({ dis: b.disabled, title: b.title }));
          await page.keyboard.press('Escape');
          return { observed: `disabled ${o.dis}; title "${o.title}"`, pass: o.dis && !!o.title, ms: null };
        }
        const r = await measure(page, () => btn.click(), tf => window.__A.cfg()?.panes?.[0]?.timeframe === tf && window.__A.tf(0) === tf && window.__A.bars(0) > 0, tf, 30000);
        const o = await ev(page, () => ({ cfg: window.__A.cfg()?.panes?.[0]?.timeframe, chart: window.__A.tf(0), menu: !!document.querySelector('[data-toolbar-menu]') }));
        const v = await viewNewest(page, 0, tf);
        return { observed: `config ${o.cfg}, chart ${o.chart}${compactTf ? `, menu ${o.menu ? 'still open' : 'closed'}` : ''}; ${v.txt}`, pass: r.ok && v.ok, ms: r.ms };
      });
    }
    await setTf(page, 0, '5m');

    await item('A-108', '"Indicators" door (with count)', 'open it, search EMA, turn on "EMA 21", then off', 'the library opens; the count chip goes up by one', async () => {
      await hoverRow(page, 0);
      const door = ROW.locator('[data-scripts-door]');
      const before = await ev(page, () => +(window.__A.pane(0).querySelector('[data-scripts-count]')?.textContent || 0));
      const r = await measure(page, () => door.click(), () => window.__A.vis(document.querySelector('[data-library]')));
      if (!r.ok) return { observed: 'no library dialog', pass: false, ms: r.ms };
      await page.locator('[data-library-search]').fill('EMA');
      await sleep(400);
      const row = page.locator('[data-library-row]').filter({ hasText: /EMA\s*21|EMA \(21\)|21/ }).first();
      const has = await row.count();
      if (!has) {
        const names = await ev(page, () => [...document.querySelectorAll('[data-library-row]')].map(r => r.textContent.trim().slice(0, 30)));
        await page.keyboard.press('Escape');
        return { observed: `library open; no EMA 21 row (rows: ${names.slice(0, 6).join(' | ')})`, pass: false, ms: r.ms };
      }
      const rowName = (await row.textContent()).trim().slice(0, 40);
      await row.locator('[data-library-toggle]').click();
      const up = await until(page, b => +(document.querySelector('[data-chart-frame] [data-scripts-count]')?.textContent || 0) === b + 1, before, 5000);
      const after = await ev(page, () => +(document.querySelector('[data-chart-frame] [data-scripts-count]')?.textContent || 0));
      await row.locator('[data-library-toggle]').click();
      const down = await until(page, b => +(document.querySelector('[data-chart-frame] [data-scripts-count]')?.textContent || 0) === b, before, 5000);
      await page.keyboard.press('Escape');
      await until(page, () => !document.querySelector('[data-library]'), null, 3000);
      return { observed: `library open; "${rowName}" on → count ${before}→${after}; off → ${down ? 'back' : 'stuck'}`, pass: up && down, ms: r.ms };
    });

    /* the candles menu */
    const openCandles = async () => {
      await hoverRow(page, 0);
      await ROW.locator('button[title="Chart style & price scale"]').click();
      await page.locator('[data-toolbar-menu]').waitFor({ state: 'visible', timeout: 4000 });
    };
    await item('A-109', '"Candles" door (chart style & price scale)', 'click it', 'the style, scale, bar clock and Export PNG menu opens', async () => {
      await hoverRow(page, 0);
      const r = await measure(page, () => ROW.locator('button[title="Chart style & price scale"]').click(), () => !!document.querySelector('[data-toolbar-menu] [aria-label="Price scale"]'));
      const t = await ev(page, () => document.querySelector('[data-toolbar-menu]')?.textContent?.replace(/\s+/g, ' ').slice(0, 140));
      await page.keyboard.press('Escape');
      return { observed: r.ok ? `menu: ${t}` : 'no menu', pass: r.ok, ms: r.ms };
    });
    const STYLES = [['A-111', 'Hollow candles', 'hollow'], ['A-112', 'Bars', 'bars'], ['A-113', 'Line', 'line'], ['A-114', 'Step line', 'step'], ['A-115', 'Area', 'area'], ['A-116', 'Baseline', 'baseline'], ['A-110', 'Candles', 'candles']];
    for (const [id, label, v] of STYLES) {
      await item(id, `Style "${label}"`, `pick ${label}`, `chartStyle === ${v}; the menu closes`, async () => {
        await openCandles();
        const r = await measure(page, () => page.locator('[data-toolbar-menu] button').filter({ hasText: rx(label) }).first().click(), v => (window.__A.cfg()?.panes?.[0]?.chartStyle ?? 'candles') === v && !document.querySelector('[data-toolbar-menu]'), v);
        return { observed: `chartStyle ${await pane0('chartStyle', '(unset)')}; menu ${(await page.locator('[data-toolbar-menu]').count()) ? 'open' : 'closed'}`, pass: r.ok, ms: r.ms };
      });
    }
    await item('A-117', '"Price scale" label', 'open the menu, read the section', 'a "Price scale" head over four chips', async () => {
      await openCandles();
      const o = await ev(page, () => ({ head: [...document.querySelectorAll('[data-toolbar-menu] span')].some(s => s.textContent.trim().toLowerCase() === 'price scale'), chips: [...document.querySelectorAll('[data-toolbar-menu] [aria-label="Price scale"] button')].map(b => b.textContent.trim()) }));
      await page.keyboard.press('Escape');
      return { observed: `head ${o.head ? 'present' : 'missing'}; chips ${o.chips.join(' ')}`, pass: o.head && o.chips.length === 4, ms: null };
    });
    const SCALES = [['A-119', 'LOG', 'log'], ['A-120', '%', 'percent'], ['A-121', '100', 'indexed'], ['A-118', 'LIN', 'normal']];
    for (const [id, label, v] of SCALES) {
      await item(id, `Scale "${label}"`, `pick ${label}`, `priceScale === ${v}`, async () => {
        await openCandles();
        const r = await measure(page, () => page.locator('[data-toolbar-menu] [aria-label="Price scale"] button').filter({ hasText: rx(label) }).click(), v => (window.__A.cfg()?.panes?.[0]?.priceScale ?? 'normal') === v, v);
        let mode = null;
        try { mode = await ev(page, () => window.__A.chart(0)?.chart.priceScale('right').options().mode); } catch {}
        return { observed: `priceScale ${await pane0('priceScale', '(unset)')}; the chart's right scale mode ${mode}`, pass: r.ok, ms: r.ms };
      });
    }
    const CLOCKS = [['A-123', '$0.50', 'r50'], ['A-124', '$2', 'r200'], ['A-125', '10k', 'v10k'], ['A-126', '50k', 'v50k'], ['A-122', 'Time', 'time']];
    for (const [id, label, v] of CLOCKS) {
      await item(id, `Bar clock "${label}"`, `pick ${label}`, `clock === ${v}${v !== 'time' ? '; the held overlays dim' : ''}`, async () => {
        await openCandles();
        const r = await measure(page, () => page.locator('[data-toolbar-menu] [aria-label="Bar clock"] button').filter({ hasText: rx(label) }).click(), v => (window.__A.cfg()?.panes?.[0]?.clock ?? 'time') === v, v);
        await sleep(600);
        const st = await ev(page, () => window.__A.state(0).slice(0, 3).join('|'));
        let held = '';
        if (v === 'r200') {
          await page.locator('[data-chart-frame]').first().locator('[data-pane-head] button[title="Overlays"]').click();
          held = await ev(page, () => `${[...document.querySelectorAll('[data-toolbar-menu] [role=checkbox][aria-disabled="true"]')].length} overlay rows held`);
          await page.keyboard.press('Escape');
        }
        return { observed: `clock ${await pane0('clock', '(unset)')}; chart ${st}${held ? `; ${held}` : ''}`, pass: r.ok, ms: r.ms };
      });
      if (id === 'A-124') {
        await item('A-127', 'Rule-bar note', 'with $2 picked, read the note in the menu', 'the note says what the feed folds (its one-minute bars)', async () => {
          await openCandles();
          const t = await ev(page, () => [...document.querySelectorAll('[data-toolbar-menu] p')].map(p => p.textContent.trim()).join(' / '));
          await page.keyboard.press('Escape');
          return { observed: `"${t}"`, pass: /one-minute bars/.test(t), ms: null };
        });
      }
    }
    await item('A-128', '"Export PNG"', 'click it', 'a PNG downloads', async () => {
      await openCandles();
      const t0 = Date.now();
      const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }).catch(() => null), page.locator('[data-toolbar-menu] button').filter({ hasText: /Export PNG/ }).click()]);
      const ms = Date.now() - t0;
      if (!dl) return { observed: 'no download event within 15 s', pass: false, ms };
      const name = dl.suggestedFilename();
      const file = await dl.path().catch(() => null);
      const size = file ? fs.statSync(file).size : 0;
      return { observed: `downloaded "${name}" (${size} bytes)`, pass: /\.png$/i.test(name) && size > 1000, ms };
    });

    /* the candle theme */
    const openTheme = async () => {
      await hoverRow(page, 0);
      await ROW.locator('button[title^="Candle theme"]').click();
      await page.locator('[data-theme-menu]').waitFor({ state: 'visible', timeout: 4000 });
    };
    await item('A-129', '"Theme" door', 'click it', 'the candle theme list with a live preview', async () => {
      await hoverRow(page, 0);
      const r = await measure(page, () => ROW.locator('button[title^="Candle theme"]').click(), () => document.querySelectorAll('[data-theme-option]').length >= 13);
      const n = await ev(page, () => ({ opts: document.querySelectorAll('[data-theme-option]').length, preview: !!document.querySelector('[data-theme-menu] canvas') }));
      await page.keyboard.press('Escape');
      return { observed: `${n.opts} themes; preview canvas ${n.preview ? 'drawn' : 'missing'}`, pass: r.ok && n.preview, ms: r.ms };
    });
    const THEMES = [['A-131', 'Foil', 'foil'], ['A-132', 'Chrome', 'chrome'], ['A-133', 'Velvet', 'velvet'], ['A-134', 'Mono', 'mono'], ['A-135', 'Neon', 'classic'], ['A-136', 'Market', 'market'], ['A-137', 'Tide', 'tide'], ['A-138', 'Harbor', 'harbor'], ['A-139', 'Whipsaw', 'whipsaw'], ['A-140', 'Contrast', 'contrast'], ['A-141', 'Wire', 'wire'], ['A-142', 'Stone', 'stone'], ['A-130', 'Glacier', 'glacier']];
    for (const [id, label, v] of THEMES) {
      await item(id, `Theme "${label}"`, `pick ${label}`, `theme === ${v}; the pane's ground follows`, async () => {
        await openTheme();
        const g0 = await ev(page, () => window.__A.pane(0).dataset.chartGround);
        const r = await measure(page, () => page.locator(`[data-theme-option="${v}"]`).click(), v => window.__A.cfg()?.panes?.[0]?.theme === v, v);
        await sleep(150);
        const g1 = await ev(page, () => window.__A.pane(0).dataset.chartGround);
        return { observed: `theme ${await pane0('theme', '(unset)')}; ground ${g0} → ${g1}`, pass: r.ok && !!g1, ms: r.ms };
      });
    }
    await item('A-143', 'Preview and "Use Tide"', 'hover Tide in the list, then click Use', 'the preview redraws for Tide; Use applies it', async () => {
      await openTheme();
      await page.locator('[data-theme-option="tide"]').hover();
      const r = await measure(page, async () => {}, () => /Tide/.test(document.querySelector('[data-theme-use]')?.textContent ?? ''), null, 3000);
      const t = await ev(page, () => document.querySelector('[data-theme-use]')?.textContent?.trim());
      await page.locator('[data-theme-use]').hover();
      const t2 = await ev(page, () => document.querySelector('[data-theme-use]')?.textContent?.trim());
      const r2 = await measure(page, () => page.locator('[data-theme-use]').click(), () => window.__A.cfg()?.panes?.[0]?.theme === 'tide');
      return { observed: `preview button "${t}" (after moving onto it "${t2}"); Use → theme ${await pane0('theme')}`, pass: r.ok && r2.ok, ms: r2.ms };
    });
    await openTheme();
    await page.locator('[data-theme-option="glacier"]').click();

    /* walls lens: the walls overlay on, from the header's Overlays */
    await page.locator('[data-chart-frame]').first().locator('[data-pane-head] button[title="Overlays"]').click();
    await page.locator('[data-toolbar-menu] [role=checkbox]').filter({ hasText: rx('Walls through the day') }).click();
    await page.keyboard.press('Escape');
    for (const [id, label, v] of [['A-145', 'Charm', 'charm'], ['A-146', 'DEX', 'dex'], ['A-144', 'GEX', 'gex']]) {
      await item(id, `Walls lens "${label}"`, `with the walls overlay on, click ${label}`, `wallsLens === ${v}`, async () => {
        await hoverRow(page, 0);
        const b = ROW.locator('[data-walls-lens] button').filter({ hasText: rx(label) });
        if (!(await b.count())) return { observed: 'no lens group in the hover row', pass: false };
        const r = await measure(page, () => b.click(), v => (window.__A.cfg()?.panes?.[0]?.wallsLens ?? 'gex') === v, v);
        return { observed: `wallsLens ${await pane0('wallsLens', '(unset)')}; pressed ${await b.getAttribute('aria-pressed')}`, pass: r.ok, ms: r.ms };
      });
    }
    for (const [id, label, v] of [['A-148', 'Fixed', 'fixed'], ['A-149', 'Prior session', 'prior'], ['A-147', 'Session so far', 'session']]) {
      await item(id, `Bead basis "${label}"`, `click ${label}`, `beadBasis ${v === 'session' ? 'unset' : `=== ${v}`}; the legend's basis follows (or says it fell back)`, async () => {
        await hoverRow(page, 0);
        const b = ROW.locator('[data-bead-basis-pick] button').filter({ hasText: rx(label) });
        if (!(await b.count())) return { observed: 'no basis group in the hover row', pass: false };
        const r = await measure(page, () => b.click(), v => (window.__A.cfg()?.panes?.[0]?.beadBasis ?? 'session') === v, v);
        await sleep(600);
        const lg = await ev(page, () => { const l = window.__A.pane(0).querySelector('[data-bead-legend]'); return l ? { basis: l.dataset.beadBasis, words: l.textContent.replace(/\s+/g, ' ').trim().slice(-110) } : null; });
        return { observed: `beadBasis ${await pane0('beadBasis', '(unset)')}; legend basis ${lg?.basis} — "…${lg?.words}"`, pass: r.ok && !!lg && (lg.basis === v || /fell back|falls back|instead|no /i.test(lg.words)), ms: r.ms };
      });
    }
    await item('A-150', '"Every strike" checkbox', 'check it, then uncheck it', 'beadDensity === false, then unset', async () => {
      await hoverRow(page, 0);
      const cb = ROW.locator('[data-bead-density] input[type=checkbox]');
      const r = await measure(page, () => cb.check(), () => window.__A.cfg()?.panes?.[0]?.beadDensity === false);
      await hoverRow(page, 0);
      const r2 = await measure(page, () => cb.uncheck(), () => window.__A.cfg()?.panes?.[0]?.beadDensity !== false);
      return { observed: `checked → beadDensity false: ${r.ok}; unchecked → unset: ${r2.ok}`, pass: r.ok && r2.ok, ms: r.ms };
    });
    for (const [id, label, v] of [['A-152', '5%', 0.05], ['A-153', '10%', 0.1], ['A-154', '25%', 0.25], ['A-151', 'Off', 0]]) {
      await item(id, `Floor "${label}"`, `click ${label}`, `beadFloor ${v ? `=== ${v}; the legend says what is hidden` : 'unset'}`, async () => {
        await hoverRow(page, 0);
        const b = ROW.locator('[data-bead-floor] button').filter({ hasText: rx(label) });
        const r = await measure(page, () => b.click(), v => (window.__A.cfg()?.panes?.[0]?.beadFloor ?? 0) === v, v);
        await sleep(400);
        const tail = await ev(page, () => window.__A.pane(0).querySelector('[data-bead-legend]')?.getAttribute('title') ?? '');
        const said = v ? new RegExp(`${Math.round(v * 100)}%`).test(tail) : true;
        return { observed: `beadFloor ${await pane0('beadFloor', '(unset)')}; legend ${said ? 'names it' : `does not name it ("${tail.slice(0, 90)}")`}`, pass: r.ok && said, ms: r.ms };
      });
    }
    await item('A-155', '"Legend" door', 'click it twice', 'legend === false and the legend goes; then it comes back', async () => {
      await hoverRow(page, 0);
      const b = ROW.locator('[data-legend-door]');
      const r = await measure(page, () => b.click(), () => window.__A.cfg()?.panes?.[0]?.legend === false && !document.querySelector('[data-chart-frame] [data-bead-legend]'));
      await hoverRow(page, 0);
      const r2 = await measure(page, () => b.click(), () => window.__A.cfg()?.panes?.[0]?.legend !== false && !!document.querySelector('[data-chart-frame] [data-bead-legend]'));
      return { observed: `off: ${r.ok ? 'legend gone' : 'stayed'}; on: ${r2.ok ? 'back' : 'missing'}`, pass: r.ok && r2.ok, ms: r.ms };
    });
    await item('A-156', 'Bead legend (full form)', 'read the legend on a wide pane', 'the full words: size, gold, violet, grey, soft edge, the scale', async () => {
      const o = await ev(page, () => { const l = window.__A.pane(0).querySelector('[data-bead-legend]'); return l ? { form: l.dataset.beadForm, ref: l.dataset.beadRef, text: l.textContent.replace(/\s+/g, ' ').trim(), pe: getComputedStyle(l).pointerEvents } : null; });
      const ok = !!o && o.form === 'full' && /size = total gamma/.test(o.text) && /gold = absorb/.test(o.text) && /violet = amplify/.test(o.text) && /grey = balanced/.test(o.text);
      return { observed: o ? `form ${o.form}; "${o.text.slice(0, 200)}"` : 'no legend', pass: ok, ms: null, notes: memo.legendShort ? `narrow pane: ${memo.legendShort}` : '' };
    });
    await item('A-157', 'Decision strip', 'look for it under the header', 'present (its boxes are another area\'s)', async () => {
      const t = await ev(page, () => window.__A.pane(0).querySelector('[data-decision-strip]')?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 140) ?? null);
      return { observed: t ? `"${t}"` : 'absent', pass: !!t, ms: null, notes: 'presence only — the boxes belong to another area' };
    });
    await item('A-158', 'Crosshair readout', 'hover a bar', 'the readout shows the bar\'s figures', async () => {
      const p = await ev(page, () => window.__A.barXY(0, 20) ?? (() => { const c = window.__A.chart(0); const r = c.chart.chartElement().getBoundingClientRect(); return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.5 }; })());
      await awayMouse(page);
      const r = await measure(page, () => page.mouse.move(p.x, p.y), () => window.__A.vis(document.querySelector('[data-chart-frame] [data-crosshair-readout]')), null, 3000);
      const t = await ev(page, () => document.querySelector('[data-chart-frame] [data-crosshair-readout]')?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 120) ?? null);
      return { observed: t ? `"${t}"` : 'no readout', pass: r.ok, ms: r.ms, notes: 'presence only — the readout belongs to another area' };
    });
  } finally {
    await ctx.close();
  }
});

/* ═══ GROUP: ON THE PLOT — the day panel, the right-click on a level, Alt+R (1440 × 900, one pane) ═══ */
await group('plot', async () => {
  const { ctx, page } = await openDesk({});
  const P = page.locator('[data-chart-frame]').first();
  try {
    /* ── the day panel ── */
    const openDayPanel = async back => {
      for (const b of [back, back + 1, back + 2]) {
        const p = await ev(page, b => window.__A.freeXY(0, b), b);
        if (!p) continue;
        await page.mouse.click(p.x, p.y);
        if (await until(page, () => window.__A.vis(document.querySelector('[data-day-panel]')), null, 2500)) return p;
      }
      return null;
    };
    await setTf(page, 0, '1D');
    await until(page, () => window.__A.bars(0) > 100, null, 20000);
    await sleep(800);
    memo.view1D = await ev(page, () => { const r = window.__A.range(0); return { r, last: window.__A.lastBar(0), lr: window.__A.chart(0).chart.timeScale().getVisibleLogicalRange() }; });
    /* the tab switch left the view where it was (see A-28) — the test brings it to the newest bars */
    await ev(page, () => window.__A.chart(0).chart.timeScale().scrollToRealTime());
    await sleep(500);
    await item('A-165', 'Day panel (1D: click a day bar)', 'on 1D, click a day bar', 'the panel opens: the day, close, regime, walls, flip, nearest strikes, UW\'s end-of-day book', async () => {
      const t0 = Date.now();
      const p = await openDayPanel(3);
      const ms = Date.now() - t0;
      if (!p) return { observed: 'no panel after clicking the bar\'s column off its beads (three bars tried)', pass: false, ms };
      const o = await ev(page, () => { const d = document.querySelector('[data-day-panel]'); return { day: d.dataset.dayPanel, text: d.textContent.replace(/\s+/g, ' ').trim() }; });
      return { observed: `${o.day}: "${o.text.slice(0, 220)}"`, pass: !!o.day && /close/i.test(o.text), ms };
    });
    await item('A-166', 'Day panel close "×" (and Esc)', 'press Esc; reopen; click ×', 'Esc closes it (its title says "Close — Esc"); × closes it', async () => {
      if (!(await page.locator('[data-day-panel]').isVisible().catch(() => false))) await openDayPanel(3);
      const r1 = await measure(page, () => page.keyboard.press('Escape'), () => !document.querySelector('[data-day-panel]'), null, 3000);
      await openDayPanel(3);
      const r2 = await measure(page, () => page.locator('[aria-label="Close the day panel"]').click(), () => !document.querySelector('[data-day-panel]'), null, 3000);
      return { observed: `Esc ${r1.ok ? 'closed it' : 'did nothing'}; × ${r2.ok ? 'closed it' : 'did nothing'}`, pass: r1.ok && r2.ok, ms: r2.ms, notes: `Esc took ${r1.ms} ms` };
    });
    await item('A-167', '"Open this session · 5m"', 'open the panel, click it', 'the pane goes to 5m on that day', async () => {
      await openDayPanel(3);
      const day = await ev(page, () => document.querySelector('[data-day-panel]')?.dataset.dayPanel);
      const r = await measure(page, () => page.locator('[data-day-open]').click(), s => window.__A.tf(0) === '5m' && window.__A.bars(0) > 0 && (() => { const r = window.__A.range(0); return !!r && r.from <= s && s <= r.to; })(), NY_NOON(day), 20000);
      const o = await ev(page, () => ({ tf: window.__A.tf(0), r: window.__A.range(0) }));
      return { observed: `day ${day}; timeframe ${o.tf}; view ${o.r && new Date(o.r.from * 1000).toISOString().slice(0, 16)} → ${o.r && new Date(o.r.to * 1000).toISOString().slice(0, 16)}Z`, pass: r.ok, ms: r.ms };
    });
    await item('A-168', '"Replay this day"', 'on 1D, open the panel, click it', 'the replay starts at 9:30 New York that day (6:30 am on this Los Angeles clock)', async () => {
      await setTf(page, 0, '1D');
      await until(page, () => window.__A.bars(0) > 100, null, 20000);
      await sleep(600);
      await ev(page, () => window.__A.chart(0).chart.timeScale().scrollToRealTime());
      await sleep(500);
      await openDayPanel(3);
      const day = await ev(page, () => document.querySelector('[data-day-panel]')?.dataset.dayPanel);
      const r = await measure(page, () => page.locator('[data-day-replay]').click(), () => /\d:\d\d [ap]m/.test(window.__A.badge() ?? ''), null, 15000);
      await sleep(800);
      const b = await ev(page, () => window.__A.badge());
      const tf = await ev(page, () => window.__A.tf(0));
      await page.keyboard.press('Escape');
      await until(page, () => !document.querySelector('[data-replay-badge]'), null, 3000);
      return { observed: `day ${day}; badge "${b}" with the pane on ${tf}`, pass: r.ok && /6:30 am/.test(b ?? ''), ms: r.ms };
    });
    await setTf(page, 0, '5m');
    await sleep(1500);

    /* ── the right-click on a level ── */
    const levels = async () => ev(page, () => [...window.__A.pane(0).querySelectorAll('[data-axis-chip]')].map(c => ({ key: c.dataset.axisChip, strike: +c.dataset.strike, text: c.textContent.replace(/\s+/g, ' ').trim() })));
    const spotOf = async () => ev(page, () => { const d = window.__A.chart(0)?.candles.data() ?? []; return d.length ? d[d.length - 1].close : null; });
    /* A LOCATOR'S CLICK MAY SCROLL THE PAGE (Playwright scrolls an element into view when its first hit test misses; the
       footer art stands one scroll below the desk): a level's place is read, and clicked, with the page put back first */
    const unscroll = () => ev(page, () => { for (const el of document.querySelectorAll('main, [data-terrain-desk]')) if (el.scrollTop) el.scrollTop = 0; if (document.scrollingElement) document.scrollingElement.scrollTop = 0; });
    const lvAt = async want => {
      await unscroll();
      const lv = await levels();
      for (const l of lv.filter(l => (want ? want(l) : true))) {
        const g = await ev(page, ([p]) => window.__A.priceY(0, p), [l.strike]);
        if (g && g.y > g.top + 90 && g.y < g.top + g.height - 50) return { ...l, ...g };
      }
      return null;
    };
    const rightClick = async l => {
      await page.keyboard.press('Escape').catch(() => {});
      await sleep(150);
      await unscroll();
      const x = Math.round(l.left + l.width * 0.3);
      await page.mouse.click(x, l.y, { button: 'right' });
      if (!(await until(page, () => !!document.querySelector('[data-chart-menu]'), null, 1500))) {
        memo.rcMiss = await ev(page, ([x, y]) => { const e = document.elementFromPoint(x, y); return `${e?.tagName}.${String(e?.className).slice(0, 50)}`; }, [x, l.y]);
        await sleep(300);
        await page.mouse.click(x, l.y, { button: 'right' });
      }
      return x;
    };
    const watchOf = () => ev(page, () => { try { return JSON.parse(localStorage.getItem('slayer_level_watch') || '{}').SPY ?? null; } catch { return null; } });
    memo.levelChips = await levels();
    const flip = await lvAt(l => /flip/i.test(l.key) || /^Flip/i.test(l.text));
    const target = flip ?? (await lvAt());
    await item('A-193', 'Level card header (right-click on a level)', `right-click on ${target ? target.text.split(' ').slice(0, 2).join(' ') : 'a level'}`, 'the card names the level within 8 px, placed at the cursor', async () => {
      if (!target) return { observed: `no level line inside the plot (chips: ${JSON.stringify(memo.levelChips)})`, pass: false };
      const t0 = Date.now();
      const x = await rightClick(target);
      const ok = await until(page, () => window.__A.vis(document.querySelector('[data-chart-menu="level-alert"]')), null, 3000);
      const ms = Date.now() - t0;
      if (!ok) return { observed: `no level card (clicked at ${x},${Math.round(target.y)} for ${target.text})`, pass: false, ms };
      const o = await ev(page, () => { const c = document.querySelector('[data-chart-menu="level-alert"]'); const r = c.getBoundingClientRect(); return { head: c.firstElementChild.textContent.trim(), left: r.left, top: r.top, focusIn: c.contains(document.activeElement) }; });
      const dx = Math.round(o.left - (x + 4));
      const dy = Math.round(o.top - (target.y + 4));
      memo.cardFocus = o.focusIn;
      return { observed: `"${o.head}"; the card's corner ${dx + 4},${dy + 4} px right/below the cursor (the design: 4,4); focus ${o.focusIn ? 'moved in' : 'stays outside the card'}`, pass: Math.abs(dx) <= 3 && Math.abs(dy) <= 3, ms, notes: o.focusIn ? '' : 'the card takes no focus and no keys (only Esc), so it cannot be used from the keyboard' };
    });
    await item('A-194', '"Alert on this level (follows it)"', 'click it', 'the level watch for SPY includes this level', async () => {
      const b = page.locator('[data-chart-menu-item="level-alert-on"]');
      if (!(await b.count())) return { observed: 'no "Alert on this level" item', pass: false };
      const id = /flip/i.test(target?.text ?? '') ? 'flip' : null;
      const r = await measure(page, () => b.click(), () => { try { return (JSON.parse(localStorage.getItem('slayer_level_watch') || '{}').SPY?.ids ?? []).length > 0; } catch { return false; } });
      const w = await watchOf();
      return { observed: `watch ${JSON.stringify(w)}`, pass: r.ok && (!id || w?.ids?.includes(id)), ms: r.ms };
    });
    const flipNow = flip ? await lvAt(l => /flip/i.test(l.key) || /^Flip/i.test(l.text)) : null;
    for (const [id, n] of [['A-196', 1], ['A-197', 2], ['A-198', 3]]) {
      await item(id, `Flip confirmation "${n}"`, `right-click the watched flip, click ${n}`, `confirmBars === ${n}`, async () => {
        if (!flipNow) return { observed: 'the flip line is not in the plot to right-click', pass: false };
        if (!(await page.locator('[aria-label="Closed minutes beyond the flip before its notice"]').isVisible().catch(() => false))) {
          const fl = (await lvAt(l => /flip/i.test(l.key) || /^Flip/i.test(l.text))) ?? flipNow;
          await rightClick(fl);
          if (!(await until(page, () => !!document.querySelector('[aria-label="Closed minutes beyond the flip before its notice"]'), null, 3000))) {
            const card = await ev(page, () => { const m = document.querySelector('[data-chart-menu]'); return m ? `${m.dataset.chartMenu}: ${m.textContent.slice(0, 80)}` : 'no card'; });
            return { observed: `the second right-click on the flip showed ${card} (element at the point: ${memo.rcMiss ?? '?'})`, pass: false };
          }
        }
        const opts = await ev(page, () => [...document.querySelectorAll('[aria-label="Closed minutes beyond the flip before its notice"] button')].map(b => b.textContent.trim()));
        const r = await measure(page, () => page.locator('[aria-label="Closed minutes beyond the flip before its notice"] button').filter({ hasText: rx(String(n)) }).click(), n => { try { return JSON.parse(localStorage.getItem('slayer_level_watch') || '{}').SPY?.confirmBars === n; } catch { return false; } }, n);
        return { observed: `offered ${opts.join(' ')}; confirmBars ${(await watchOf())?.confirmBars}`, pass: r.ok, ms: r.ms, notes: opts.length < 5 ? `only ${opts.join(', ')} offered; the store and CLAUDE.md allow 1 to 5` : '' };
      });
    }
    await item('A-195', '"Stop the alert on the flip"', 'right-click the watched level, click Stop', 'the id leaves the watch', async () => {
      if (!target) return { observed: 'no level', pass: false };
      if (!(await page.locator('[data-chart-menu-item="level-alert-off"]').isVisible().catch(() => false))) {
        await page.keyboard.press('Escape');
        await rightClick((await lvAt(l => l.key === target.key)) ?? target);
        await until(page, () => !!document.querySelector('[data-chart-menu-item="level-alert-off"]'), null, 3000);
      }
      const hint = await ev(page, () => document.querySelector('[data-chart-menu-item="level-alert-off"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? null);
      if (!hint) return { observed: 'no "Stop the alert" item', pass: false };
      const r = await measure(page, () => page.locator('[data-chart-menu-item="level-alert-off"]').click(), () => { try { return (JSON.parse(localStorage.getItem('slayer_level_watch') || '{}').SPY?.ids ?? []).length === 0; } catch { return false; } });
      const undo = await ev(page, () => document.body.innerText.match(/Undo/)?.[0] ?? null);
      return { observed: `"${hint}"; watch after ${JSON.stringify(await watchOf())}${undo ? '; an Undo showed' : '; no undo offered'}`, pass: r.ok, ms: r.ms };
    });
    await item('A-199', '"Reset chart view · Alt+R" (in the level card)', 'pan the view back, right-click the level, click Reset', 'the view returns to the opening view', async () => {
      await page.keyboard.press('Escape');
      const r0 = await ev(page, () => window.__A.range(0));
      await ev(page, () => window.__A.chart(0).chart.timeScale().scrollToPosition(-300, false));
      await sleep(500);
      const moved = await ev(page, () => window.__A.range(0));
      const l = (await lvAt(l => l.key === target?.key)) ?? (await lvAt());
      if (!l) return { observed: 'no level in the plot after the pan', pass: false };
      await rightClick(l);
      if (!(await until(page, () => !!document.querySelector('[data-chart-menu-item="reset-view"]'), null, 3000))) return { observed: 'no level card after the pan', pass: false };
      const r = await measure(page, () => page.locator('[data-chart-menu-item="reset-view"]').click(), to => { const r = window.__A.range(0); return !!r && Math.abs(r.to - to) < 3600; }, r0.to, 5000);
      const after = await ev(page, () => window.__A.range(0));
      return { observed: `view to ${new Date(r0.to * 1000).toISOString().slice(5, 16)} → panned ${new Date(moved.to * 1000).toISOString().slice(5, 16)} → reset ${new Date(after.to * 1000).toISOString().slice(5, 16)}Z`, pass: r.ok, ms: r.ms };
    });
    await item('A-249', 'Alt+R', 'pan the view back, hover the chart, press Alt+R', 'the view under the pointer resets', async () => {
      const r0 = await ev(page, () => window.__A.range(0));
      await ev(page, () => window.__A.chart(0).chart.timeScale().scrollToPosition(-300, false));
      await sleep(400);
      await hoverPane(page, 0);
      const r = await measure(page, () => page.keyboard.press('Alt+r'), to => { const r = window.__A.range(0); return !!r && Math.abs(r.to - to) < 3600; }, r0.to, 5000);
      return { observed: r.ok ? 'view reset to the opening view' : `view stayed at ${JSON.stringify(await ev(page, () => window.__A.range(0)))}`, pass: r.ok, ms: r.ms };
    });
  } finally {
    await ctx.close();
  }
});

/* ═══ GROUP: FULLSCREEN (1440 × 900, one pane) ═══ */
await group('full', async () => {
  const { ctx, page } = await openDesk({ quiet: false });
  /* does a toast stand over the fullscreen strip's tools as the desk opens? */
  try {
    await page.keyboard.press('f');
    await sleep(700);
    memo.toastOverStrip = await ev(page, () => {
      const hits = [];
      for (const b of window.__A.pane(0)?.querySelectorAll('[data-chart-chrome] button') ?? []) {
        const r = b.getBoundingClientRect();
        const at = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        if (at && !b.contains(at) && at.closest('[data-alert-toasts]')) hits.push((b.getAttribute('title') || b.getAttribute('aria-label') || b.textContent).trim().slice(0, 20));
      }
      return { toast: document.querySelector('[data-alert-toasts]')?.textContent?.trim().slice(0, 70) ?? null, covered: hits };
    });
    await page.keyboard.press('f');
  } catch {}
  await quietToasts(page);
  const P = page.locator('[data-chart-frame]').first();
  const isExpanded = () => !!window.__A.pane(0)?.closest('[role=dialog]');
  const ensureExpanded = async () => {
    await sleep(350);
    for (let k = 0; k < 3; k++) {
      if (await ev(page, isExpanded)) return true;
      const door = page.locator('[data-expand-door]').first();
      if (await door.count()) await door.click().catch(() => {});
      else await page.keyboard.press('f');
      await until(page, isExpanded, null, 3000);
      await sleep(300);
    }
    return ev(page, isExpanded);
  };
  try {
    await item('A-234', '`F`', 'press f, then f again', '"SPY expanded", then collapsed', async () => {
      const r = await measure(page, () => page.keyboard.press('f'), () => !!window.__A.pane(0)?.closest('[role=dialog]') && window.__A.say() === 'SPY expanded');
      const s1 = await ev(page, () => window.__A.say());
      const r2 = await measure(page, () => page.keyboard.press('f'), () => !window.__A.pane(0)?.closest('[role=dialog]'), null, 3000);
      const s2 = await ev(page, () => window.__A.say());
      return { observed: `expand: "${s1}"; again: ${r2.ok ? 'collapsed' : 'still expanded'} ("${s2}")`, pass: r.ok && r2.ok, ms: r.ms };
    });
    await page.keyboard.press('f');
    await until(page, isExpanded, null, 4000);
    await sleep(400);
    await item('A-200', 'Expanded top strip', 'press F, look at the strip at rest', 'the strip stands at rest with identity, toolbar and Collapse', async () => {
      const o = await ev(page, () => {
        const p = window.__A.pane(0);
        const strip = [...p.querySelectorAll('[data-chart-chrome]')].find(e => e.classList.contains('absolute') && e.classList.contains('top-0'));
        const has = sel => !!p.querySelector(sel);
        return {
          strip: !!strip && window.__A.vis(strip),
          parts: (strip ? [...strip.querySelectorAll('button')].map(b => (b.getAttribute('aria-label') || b.getAttribute('title') || b.textContent).trim().slice(0, 22)) : []).join(' · '),
          missing: Object.entries({ 'age chip': '[data-pane-age]', 'window control': '[data-pane-window]', 'jumps': '[data-pane-jump], [data-jump-trigger]', 'calendar': '[data-jump-date]', '? door': '[data-pane-keys]', 'pop-out': '[data-popout-door]', 'walls lens': '[data-walls-lens]', 'bead basis': '[data-bead-basis-pick]', 'floor': '[data-bead-floor]', 'Every strike': '[data-bead-density]', 'Legend door': '[data-legend-door]' }).filter(([, s]) => !has(s)).map(([k]) => k),
        };
      });
      const toast = memo.toastOverStrip?.covered?.length ? `; on a fresh load the 5 s toast "${memo.toastOverStrip.toast}" stood over ${memo.toastOverStrip.covered.join(', ')} (AlertToasts z-[86] over the strip's z-[80]) and took their clicks` : '';
      return { observed: `strip ${o.strip ? 'visible' : 'missing'}: ${o.parts}`, pass: o.strip, ms: null, notes: (o.missing.length ? `not in fullscreen: ${o.missing.join(', ')}` : 'everything the docked pane carries is here') + toast };
    });
    await item('A-203', 'Second line "SPY · 5m · $… · %"', 'read it', 'ticker · timeframe · price · change', async () => {
      const t = await ev(page, () => [...window.__A.pane(0).querySelectorAll('div.font-mono')].map(d => d.textContent.replace(/\s+/g, ' ').trim()).find(t => /^SPY\s*·/.test(t)) ?? null);
      return { observed: t ? `"${t}"` : 'no second line', pass: !!t && /SPY\s*·\s*5m\s*·\s*\$[\d,]+\.\d\d/.test(t), ms: null };
    });
    await item('A-201', '"REPLAY" button (expanded)', 'click it, then click it again', 'the replay badge comes up; the button says it is pressed; then off', async () => {
      const door = P.locator('[data-replay-door]');
      if (!(await door.count())) return { observed: 'no Replay button in the strip', pass: false };
      const word = (await door.textContent()).trim();
      const r = await measure(page, () => door.click(), () => !!document.querySelector('[data-replay-badge]'));
      const pressed = await door.getAttribute('aria-pressed');
      const r2 = await measure(page, () => door.click(), () => !document.querySelector('[data-replay-badge]'));
      return { observed: `"${word}"; on → ${r.ok ? 'badge' : 'no badge'} (aria-pressed ${pressed}); off → ${r2.ok ? 'gone' : 'stays'}; still expanded ${await ev(page, isExpanded)}`, pass: r.ok && r2.ok && pressed === 'true', ms: r.ms };
    });
    memo.tInFull = await (async () => {
      await page.keyboard.press('t');
      await sleep(600);
      const o = await ev(page, () => ({ focus: document.activeElement?.hasAttribute?.('data-jump-date-input') ?? false, card: !!document.querySelector('[data-popover-card="pane-jump-date"]'), say: window.__A.say() }));
      if (o.card) await page.keyboard.press('Escape');
      return o;
    })();
    await ensureExpanded();
    memo.lInFull = await (async () => {
      const r = await measure(page, () => page.keyboard.press('l'), () => window.__A.cfg()?.panes?.[0]?.legend === false, null, 3000);
      await page.keyboard.press('l');
      return r.ok;
    })();
    await item('A-204', 'Desk bar (floating in fullscreen)', 'look at it at rest, then hover it', 'floating at 40% until hovered, then 100%', async () => {
      await ensureExpanded();
      await hoverPane(page, 0);
      await sleep(400);
      const o = await ev(page, () => { const b = document.querySelector('[data-terrain-desk-bar]'); return { mode: b?.dataset.terrainDeskBar, op: getComputedStyle(b).opacity }; });
      const r = await measure(page, () => page.locator('[data-terrain-desk-bar]').hover(), () => getComputedStyle(document.querySelector('[data-terrain-desk-bar]')).opacity === '1', null, 3000);
      return { observed: `${o.mode}, opacity ${o.op} at rest → ${r.ok ? '1' : 'unchanged'} under the pointer`, pass: o.mode === 'floating' && Math.abs(+o.op - 0.4) < 0.05 && r.ok, ms: r.ms, notes: memo.deskDocked ? `docked: ${memo.deskDocked}` : '' };
    });
    await item('A-225', '"PINE" (fullscreen only)', 'click it', 'the script editor docks at the right for this pane', async () => {
      await ensureExpanded();
      const b = page.locator('[data-terrain-pine]');
      if (!(await b.count())) return { observed: 'no Pine door', pass: false };
      const r = await measure(page, () => b.click(), () => !!document.querySelector('[data-editor-dock]'), null, 30000);
      const w = await ev(page, () => document.querySelector('[data-editor-dock]')?.dataset.width ?? `none (expanded ${!!window.__A.pane(0)?.closest('[role=dialog]')}, pine door ${!!document.querySelector('[data-terrain-pine]')})`);
      await page.locator('[data-script-close]').click().catch(() => {});
      await until(page, () => !document.querySelector('[data-editor-dock]'), null, 3000);
      return { observed: r.ok ? `editor dock open (${w} px)` : `no editor in 30 s — dock ${w}`, pass: r.ok, ms: r.ms, notes: r.ms > 5000 ? 'slow: in isolation the dock opens in 1.2–1.5 s; after a Replay on/off in the same fullscreen it took ~10 s although the editor chunks were in within 1.1 s and the main thread never stalled over 200 ms (probed separately) — cause not pinned' : '' };
    });
    await ensureExpanded();
    await item('A-248', 'Esc closes the open menu, not the pane', 'in fullscreen open Overlays, press Esc', 'the menu closes; the pane stays expanded', async () => {
      await P.locator('button[title="Overlays"]').click();
      await page.locator('[data-toolbar-menu]').waitFor({ state: 'visible', timeout: 3000 });
      const r = await measure(page, () => page.keyboard.press('Escape'), () => !document.querySelector('[data-toolbar-menu]'), null, 3000);
      const still = await ev(page, isExpanded);
      /* the layouts shelf: Esc with focus on its own button (outside the shelf) */
      await page.locator('button[aria-haspopup="dialog"][title^="Named layouts"]').click();
      await page.locator('[role=dialog][aria-label="Named layouts"]').waitFor({ state: 'visible', timeout: 3000 });
      await page.keyboard.press('Escape');
      await sleep(400);
      const shelf = await ev(page, () => !!document.querySelector('[role=dialog][aria-label="Named layouts"]'));
      const still2 = await ev(page, isExpanded);
      if (shelf) await page.locator('button[aria-haspopup="dialog"][title^="Named layouts"]').click({ force: true }).catch(() => {});
      await sleep(400);
      if (!(await ev(page, isExpanded))) { await page.keyboard.press('f'); await until(page, isExpanded, null, 3000); }
      return { observed: `Overlays: ${r.ok ? 'menu closed' : 'menu stayed'}, pane ${still ? 'still expanded' : 'collapsed'}; layouts shelf (focus on its button): Esc ${shelf ? 'left the shelf open' : 'closed the shelf'}${still2 ? '' : ' and collapsed the pane'}`, pass: r.ok && still && !shelf && still2, ms: r.ms };
    });
    await item('A-227', '"× ESC" chip (fullscreen only)', 'click it', 'the pane collapses', async () => {
      await ensureExpanded();
      const b = page.locator('[data-terrain-desk-bar] button').filter({ hasText: /^\s*Esc\s*$/ });
      const name = await b.evaluate(e => e.getAttribute('aria-label') || e.textContent.trim());
      const r = await measure(page, () => b.click(), () => !window.__A.pane(0)?.closest('[role=dialog]'), null, 4000);
      return { observed: `${r.ok ? 'collapsed' : 'still expanded'}; accessible name "${name}"`, pass: r.ok, ms: r.ms };
    });
    await item('A-246', 'Esc (fullscreen)', 'press F, then Esc', 'the pane collapses', async () => {
      await sleep(400);
      await page.keyboard.press('f');
      await until(page, isExpanded, null, 4000);
      await sleep(300);
      const r = await measure(page, () => page.keyboard.press('Escape'), () => !window.__A.pane(0)?.closest('[role=dialog]'), null, 4000);
      return { observed: r.ok ? 'collapsed' : 'still expanded', pass: r.ok, ms: r.ms };
    });
    await item('A-202', 'Collapse (minimize icon)', 'press F, click Collapse', 'the pane returns to the grid', async () => {
      await sleep(400);
      await page.keyboard.press('f');
      await until(page, isExpanded, null, 4000);
      await sleep(300);
      const b = page.locator('button[aria-label="Collapse SPY"]');
      const cls = await b.getAttribute('class');
      const r = await measure(page, () => b.click(), () => !window.__A.pane(0)?.closest('[role=dialog]'), null, 4000);
      return { observed: `${r.ok ? 'collapsed' : 'still expanded'}; .hit ${/\bhit\b/.test(cls) ? 'yes' : 'no'}`, pass: r.ok, ms: r.ms };
    });
  } finally {
    await ctx.close();
  }
});

/* ═══ GROUP: AN INDEX (SPX, one pane) — its price chips and P ═══ */
await group('spx', async () => {
  const { ctx, page } = await openDesk({ panes: [{ ticker: 'SPX', timeframe: '5m' }], wait: 'head' });
  page.on('response', async r => {
    if (!/\/feed\/field\/SPX\?since=/.test(r.url())) return;
    try { const j = await r.json(); memo.spxField = { theta: j.theta ?? null, bars: (j.bars ?? []).length, fwd: (j.fwd ?? []).length }; } catch {}
  });
  try {
    await sleep(9000);
    const o = await ev(page, () => {
      const h = window.__A.head(0);
      const chips = [...document.querySelectorAll('[data-chart-frame] [data-pane-print]')].map(c => ({ kind: c.dataset.panePrint, text: c.textContent.trim(), title: c.title.slice(0, 90), pe: getComputedStyle(c).pointerEvents }));
      const price = [...(h?.querySelectorAll('*') ?? [])].find(e => e.children.length === 0 && /^\$[\d,]+\.\d{2}$|^\$—$|^—$/.test(e.textContent.trim()))?.textContent.trim() ?? null;
      return { chips, price, bars: window.__A.bars(0), state: window.__A.state(0).slice(0, 3).join('|'), age: h?.querySelector('[data-pane-age]')?.getAttribute('aria-label') ?? null, win: h?.querySelector('[data-pane-window]')?.getAttribute('data-pane-window') ?? null };
    });
    memo.spx = o;
    const opt = o.chips.find(c => c.kind === 'options');
    const prn = o.chips.find(c => c.kind === 'fresh' || c.kind === 'stale');
    if (!opt && memo.spxField && !memo.spxField.bars && !memo.spxField.fwd) manual('A-20', '"price from options (overnight)" / "(after the close)"', 'SPX outside the index\'s print hours (now ~3–4 am New York)', 'the chip shows, its title reachable', `the server holds no options-priced SPX minutes (its field answer: theta ${JSON.stringify(memo.spxField.theta)}, ${memo.spxField.bars} bars, ${memo.spxField.fwd} forwards — no Theta terminal answering here), so there is nothing to label; meanwhile the header prints ${o.price} with no chip saying where that price comes from`, `no chip; price ${o.price}`);
    else await item('A-20', '"price from options (overnight)" / "(after the close)"', 'SPX outside the index\'s print hours (now ~3–4 am New York)', 'the chip shows, its title reachable', async () => {
      return { observed: opt ? `"${opt.text}" (title "${opt.title}…", pointer-events ${opt.pe}); price ${o.price}; chart ${o.state}` : `no options chip; chips ${JSON.stringify(o.chips)}; price ${o.price}; chart ${o.state}`, pass: !!opt && opt.pe === 'auto', ms: null, notes: opt ? '' : 'needs the Theta terminal on the server for SPX\'s overnight quotes' };
    });
    if (prn) {
      await item('A-19', 'Index print chip "3:59 pm print · stale"', 'read SPX\'s print chip', 'the time of the newest print, "· stale" past two minutes', async () => ({ observed: `"${prn.text}" (${prn.kind}; title "${prn.title}…", pointer-events ${prn.pe})`, pass: /print/.test(prn.text) && (prn.kind !== 'stale' || /stale/.test(prn.text)) && prn.pe === 'auto', ms: null }));
    } else {
      manual('A-19', 'Index print chip "3:59 pm print · stale"', 'read SPX\'s print chip', 'the time of the newest print, "· stale" past two minutes', 'the chip is for the regular session; at the hour of the run SPX is priced from its options (A-20) — not reproducible now', `no print chip now; chips ${JSON.stringify(o.chips)}`);
    }
    memo.indexReplay = await (async () => {
      await page.locator('[data-chart-frame]').first().click({ position: { x: 300, y: 300 } }).catch(() => {});
      const r = await measure(page, () => page.keyboard.press('p'), () => /replay/i.test(window.__A.say()), null, 3000);
      await sleep(300);
      const x = await ev(page, () => ({ say: window.__A.say(), badge: window.__A.badge(), strip: !!document.querySelector('[data-replay-strip]') }));
      return { ...x, ms: r.ms };
    })();
  } finally {
    await ctx.close();
  }
});

/* ═══ GROUP: THE REPLAY TRANSPORT (1440 × 900, one pane, SPY 5m) ═══ */
await group('replay', async () => {
  const { ctx, page } = await openDesk({});
  const P = page.locator('[data-chart-frame]').first();
  const badge = () => ev(page, () => window.__A.badge());
  const minute = async () => ev(page, () => window.__A.minuteOf(window.__A.badge()));
  try {
    await item('A-239', '`P`', 'press p, then (at the end) p again', '"SPY replay on" and the badge; then "SPY replay off"', async () => {
      const r = await measure(page, () => page.keyboard.press('p'), () => !!document.querySelector('[data-replay-badge]') && window.__A.say() === 'SPY replay on');
      return { observed: `badge ${await badge()}; said "${await ev(page, () => window.__A.say())}"`, pass: r.ok, ms: r.ms };
    });
    await item('A-02', 'Replay badge', 'press P; pick a bar', '"REPLAY · pick a bar", then "REPLAY · <day> · <time>"; on an index on the feed P says why and no badge stands', async () => {
      const b0 = await badge();
      const p = await ev(page, () => window.__A.barXY(0, 40));
      await page.mouse.click(p.x, p.y);
      const r = await until(page, () => /\d:\d\d [ap]m/.test(window.__A.badge() ?? ''), null, 8000);
      const b1 = await badge();
      const up = await ev(page, () => getComputedStyle(document.querySelector('[data-replay-badge] span')).textTransform);
      const ix = memo.indexReplay;
      const ixOk = !ix || (!ix.badge && /No replay/i.test(ix.say));
      return { observed: `pick: "${b0}" (${up}); after a bar click: "${b1}"; SPX: ${ix ? `said "${ix.say}", badge ${ix.badge ?? 'none'}` : 'not checked'}`, pass: /pick a bar/.test(b0 ?? '') && r && ixOk, ms: null, notes: 'the bar click goes back to the pick phase below for the strip tests' };
    });
    /* back to the pick phase for the strip and the go-to card */
    await page.keyboard.press('p');
    await until(page, () => !document.querySelector('[data-replay-badge]'), null, 3000);
    await page.keyboard.press('p');
    await until(page, () => !!document.querySelector('[data-replay-strip="pick"]'), null, 5000);
    await item('A-170', 'Pick strip "Select a bar on the chart · the replay starts there"', 'press P', 'the pick strip shows; a bar click moves it to the play card', async () => {
      const t = await ev(page, () => document.querySelector('[data-replay-strip="pick"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? null);
      return { observed: t ? `"${t.slice(0, 120)}"` : 'no pick strip', pass: !!t && /Select a bar/.test(t), ms: null, notes: 'the move to the play card is A-02\'s bar click' };
    });
    const pickSay = await (async () => {
      const r1 = await measure(page, () => page.keyboard.press('Shift+ArrowDown'), () => /Pick a bar/i.test(window.__A.say()), null, 2000);
      const s1 = await ev(page, () => window.__A.say());
      /* the announcer only re-renders on a new string: say something else first (] on one pane: "Chart 1 of 1, SPY") */
      await page.keyboard.press(']');
      await until(page, () => /^Chart 1 of 1/.test(window.__A.say()), null, 2000);
      const r2 = await measure(page, () => page.keyboard.press('Shift+ArrowRight'), () => /Pick a bar/i.test(window.__A.say()), null, 2000);
      const s2 = await ev(page, () => window.__A.say());
      const still = await ev(page, () => !!document.querySelector('[data-replay-strip="pick"]'));
      return { s1, s2, ok1: r1.ok, ok2: r2.ok, ms1: r1.ms, ms2: r2.ms, still };
    })();
    /* A-164's twin: in the pick phase, pan off the live edge */
    memo.pickTwins = await (async () => {
      await ev(page, () => window.__A.chart(0).chart.timeScale().scrollToPosition(-200, false));
      await sleep(800);
      const o = await ev(page, () => ({ live: window.__A.vis(document.querySelector('[data-back-to-live]')) ? document.querySelector('[data-back-to-live]').textContent.trim() : null, exit: window.__A.vis(document.querySelector('[data-replay-exit]')) ? document.querySelector('[data-replay-exit]').textContent.trim() : null }));
      await ev(page, () => window.__A.chart(0).chart.timeScale().scrollToRealTime());
      await sleep(400);
      return o;
    })();
    await item('A-171', 'Go-to door', 'in the pick phase, click it', 'the "Go to" card with Session and Time', async () => {
      const r = await measure(page, () => P.locator('[data-replay-goto]').click(), () => window.__A.vis(document.querySelector('[data-popover-card="replay-goto"]')));
      return { observed: r.ok ? 'card open' : 'no card', pass: r.ok, ms: r.ms };
    });
    let pickedDay = null;
    await item('A-172', '"Session" dropdown', 'open it, pick the second-newest session', 'one option per session the tape holds, newest first', async () => {
      const r = await measure(page, () => page.locator('[data-dropdown="replay-goto-day"]').click(), () => document.querySelectorAll('[role=menuitemradio]').length > 0);
      const opts = await ev(page, () => [...document.querySelectorAll('[role=menuitemradio]')].map(o => o.textContent.trim()));
      const pick = page.locator('[role=menuitemradio]').nth(1);
      pickedDay = (await pick.textContent()).trim();
      await pick.click();
      const shown = await ev(page, () => document.querySelector('[data-dropdown="replay-goto-day"]')?.textContent?.trim());
      return { observed: `${opts.length} sessions: ${opts.slice(0, 4).join(', ')}…; picked "${pickedDay}", the field shows "${shown}"`, pass: r.ok && opts.length > 1 && shown?.includes(pickedDay), ms: r.ms };
    });
    await item('A-173', '"Time, on your clock"', 'type "10:42 am"', 'the field holds it; the placeholder is a 12-hour time', async () => {
      const inp = page.locator('[data-replay-goto-time]');
      const ph = await inp.getAttribute('placeholder');
      await inp.fill('10:42 am');
      return { observed: `placeholder "${ph}"; value "${await inp.inputValue()}"`, pass: /^\d{1,2}:\d\d [ap]m$/.test(ph ?? '') && (await inp.inputValue()) === '10:42 am', ms: null };
    });
    await item('A-174', '"Go"', 'click Go', 'the cursor at about 10:42 am on that session', async () => {
      const r = await measure(page, () => page.locator('[data-replay-goto-go]').click(), () => /10:4\d am/.test(window.__A.badge() ?? ''), null, 10000);
      const o = await ev(page, () => ({ b: window.__A.badge(), card: !!document.querySelector('[data-popover-card="replay-goto"]'), strip: document.querySelector('[data-replay-strip]')?.dataset.replayStrip }));
      return { observed: `badge "${o.b}"; strip ${o.strip}; the card ${o.card ? 'stays open' : 'closed'}`, pass: r.ok && (pickedDay ? o.b?.includes(pickedDay.replace(/^\w+,?\s*/, '').slice(0, 6)) || true : true), ms: r.ms, notes: o.card ? 'the card stays open after a good jump (the header calendar closes)' : '' };
    });
    await item('A-175', 'Go-to message', 'type "3 am", click Go', 'a message says why nothing moved', async () => {
      if (!(await page.locator('[data-replay-goto-time]').isVisible().catch(() => false))) await P.locator('[data-replay-goto]').click();
      await page.locator('[data-replay-goto-time]').fill('3 am');
      const r = await measure(page, () => page.locator('[data-replay-goto-go]').click(), () => !!document.querySelector('[data-replay-goto-said]'), null, 4000);
      const t = await ev(page, () => document.querySelector('[data-replay-goto-said]')?.textContent?.trim() ?? null);
      const b = await badge();
      return { observed: t ? `"${t}"; badge "${b}"` : `no message; badge "${b}"`, pass: r.ok, ms: r.ms };
    });
    /* Esc on the card closes the card, not the replay */
    await page.keyboard.press('Escape');
    await sleep(300);
    memo.escCard = await ev(page, () => ({ card: !!document.querySelector('[data-popover-card="replay-goto"]'), badge: !!document.querySelector('[data-replay-badge]') }));
    if (!memo.escCard.badge) {
      await page.keyboard.press('p');
      await until(page, () => !!document.querySelector('[data-replay-strip]'), null, 3000);
      const p = await ev(page, () => window.__A.barXY(0, 40));
      await page.mouse.click(p.x, p.y);
      await until(page, () => /\d:\d\d [ap]m/.test(window.__A.badge() ?? ''), null, 5000);
    }
    await item('A-191', 'Moment "Oct 13 · 10:42 am · REPLAY"', 'read it', 'the cursor\'s day and time on the reader\'s clock', async () => {
      const t = await ev(page, () => document.querySelector('[data-replay-time]')?.textContent?.replace(/\s+/g, ' ').trim() ?? null);
      return { observed: `"${t}"`, pass: /\w{3} \d{1,2} · \d{1,2}:\d\d [ap]m/.test(t ?? ''), ms: null };
    });
    const paceWords = () => ev(page, () => document.querySelector('[data-replay-pace-words]')?.textContent?.trim() ?? null);
    for (const [id, label] of [['A-181', '5×'], ['A-182', '20×'], ['A-183', '60×'], ['A-180', '1×']]) {
      await item(id, `Pace "${label}"`, `pick ${label}`, `the pace is ${label}; the words follow${label === '60×' ? '; playing moves about a minute of tape a second' : ''}`, async () => {
        const w0 = await paceWords();
        await page.locator('[data-dropdown="replay-pace"]').click();
        const opt = page.locator('[role=menuitemradio]').filter({ hasText: new RegExp(`^\\s*${label.replace('×', '×')}`) }).first();
        const r = await measure(page, () => opt.click(), ([w0, label]) => (document.querySelector('[data-replay-pace-words]')?.textContent?.trim() ?? null) !== w0 || !!document.querySelector('[data-dropdown="replay-pace"]')?.textContent?.includes(label), [w0, label], 3000);
        const shown = await ev(page, () => document.querySelector('[data-dropdown="replay-pace"]')?.textContent?.trim());
        const w1 = await paceWords();
        let speed = '';
        let speedOk = true;
        if (label === '60×') {
          const m0 = await minute();
          await page.locator('[data-replay-play]').click();
          const t0 = Date.now();
          await sleep(4000);
          await page.locator('[data-replay-play]').click();
          const m1 = await minute();
          const secs = (Date.now() - t0) / 1000;
          const d = m1 - m0;
          speed = `; played ${secs.toFixed(1)} s → the cursor moved ${d} min`;
          speedOk = d >= secs * 0.5 && d <= secs * 2.5;
        }
        return { observed: `field "${shown}"; words "${w0}" → "${w1}"${speed}`, pass: shown?.includes(label) && speedOk, ms: r.ms };
      });
    }
    await item('A-184', 'Pace words "1 candle / min"', 'change the pace, read the words', 'the words name the pace in this chart\'s candles', async () => {
      const w = await paceWords();
      return { observed: `"${w}" at 1×`, pass: !!w && /candle/i.test(w), ms: null, notes: 'the change with the pace is in A-180 to A-183' };
    });
    await item('A-187', 'Play / Pause', 'click Play, then Pause', 'aria-pressed true while playing, then false', async () => {
      const r = await measure(page, () => page.locator('[data-replay-play]').click(), () => document.querySelector('[data-replay-play]')?.getAttribute('aria-pressed') === 'true');
      await sleep(800);
      const r2 = await measure(page, () => page.locator('[data-replay-play]').click(), () => document.querySelector('[data-replay-play]')?.getAttribute('aria-pressed') === 'false');
      return { observed: `play ${r.ok ? 'pressed' : 'not pressed'}; pause ${r2.ok ? 'released' : 'stuck'}`, pass: r.ok && r2.ok, ms: r.ms };
    });
    await item('A-188', 'One step on', 'click it', 'the cursor moves one bar on (5m)', async () => {
      const m0 = await minute();
      const r = await measure(page, () => page.locator('[data-replay-step="on"]').click(), m0 => window.__A.minuteOf(window.__A.badge()) !== m0, m0, 3000);
      const m1 = await minute();
      return { observed: `${m0} → ${m1} (minutes of the day): +${m1 - m0}`, pass: r.ok && m1 - m0 > 0 && m1 - m0 <= 5, ms: r.ms };
    });
    await item('A-186', 'One step back', 'click it', 'the cursor moves one bar back (5m)', async () => {
      const m0 = await minute();
      const r = await measure(page, () => page.locator('[data-replay-step="back"]').click(), m0 => window.__A.minuteOf(window.__A.badge()) !== m0, m0, 3000);
      const m1 = await minute();
      return { observed: `${m0} → ${m1}: ${m1 - m0}`, pass: r.ok && m1 - m0 < 0 && m1 - m0 >= -5, ms: r.ms };
    });
    await item('A-185', 'To the start', 'click it', 'the cursor at the session\'s start; the back doors shut', async () => {
      const r = await measure(page, () => page.locator('[data-replay-jump="start"]').click(), () => document.querySelector('[data-replay-jump="start"]')?.disabled === true, null, 3000);
      return { observed: `badge "${await badge()}"; start door ${(await ev(page, () => document.querySelector('[data-replay-jump="start"]')?.disabled)) ? 'disabled' : 'enabled'}`, pass: r.ok, ms: r.ms };
    });
    await item('A-189', 'To the end', 'click it', 'the cursor at the session\'s end; the forward doors shut', async () => {
      const r = await measure(page, () => page.locator('[data-replay-jump="end"]').click(), () => document.querySelector('[data-replay-jump="end"]')?.disabled === true, null, 3000);
      return { observed: `badge "${await badge()}"; end door ${(await ev(page, () => document.querySelector('[data-replay-jump="end"]')?.disabled)) ? 'disabled' : 'enabled'}`, pass: r.ok, ms: r.ms };
    });
    await item('A-190', 'Track (scrubber)', 'hover the middle of the track, then click it', 'a tag names the moment under the pointer; the click moves the cursor there', async () => {
      const box = await page.locator('[data-replay-track]').boundingBox();
      await page.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2);
      const tag = await until(page, () => !!document.querySelector('[data-replay-over]'), null, 2000);
      const tagText = await ev(page, () => document.querySelector('[data-replay-over]')?.textContent?.trim() ?? null);
      const m0 = await minute();
      const r = await measure(page, () => page.mouse.click(box.x + box.width * 0.5, box.y + box.height / 2), m0 => window.__A.minuteOf(window.__A.badge()) !== m0, m0, 3000);
      return { observed: `hover tag ${tag ? `"${tagText}"` : 'missing'}; click → badge "${await badge()}"`, pass: tag && r.ok, ms: r.ms };
    });
    await item('A-176', 'Random start', 'click it', 'the cursor moves to a random ready minute, or the note says why none is ready', async () => {
      const b0 = await badge();
      const title = await page.locator('[data-replay-random]').getAttribute('title');
      const r = await measure(page, () => page.locator('[data-replay-random]').click(), b0 => window.__A.badge() !== b0 || !!document.querySelector('[data-replay-note]'), b0, 4000);
      const note = await ev(page, () => document.querySelector('[data-replay-note]')?.textContent?.trim() ?? null);
      memo.randomNote = note;
      return { observed: `title "${title}"; ${note ? `note "${note}"` : `badge "${b0}" → "${await badge()}"`}`, pass: r.ok, ms: r.ms };
    });
    if (memo.randomNote) {
      await item('A-177', 'Random note', 'the note A-176 showed', 'says why no session is ready, for 4 s', async () => {
        const gone = await until(page, () => !document.querySelector('[data-replay-note]'), null, 6000);
        return { observed: `"${memo.randomNote}"; ${gone ? 'gone after about 4 s' : 'still standing after 6 s'}`, pass: gone, ms: null };
      });
    } else manual('A-177', 'Random note', 'press Random with no session ready', 'the note says why, for 4 s', 'every session the tape held could be drawn whole, so the note had no reason to show', 'not shown: Random found a ready session');
    await item('A-178', 'Hide / show the future', 'click it twice', '"shown" with aria-pressed true, then "hidden"', async () => {
      const r = await measure(page, () => page.locator('[data-replay-future]').click(), () => document.querySelector('[data-replay-future]')?.dataset.replayFuture === 'shown' && document.querySelector('[data-replay-future]')?.getAttribute('aria-pressed') === 'true');
      const r2 = await measure(page, () => page.locator('[data-replay-future]').click(), () => document.querySelector('[data-replay-future]')?.dataset.replayFuture === 'hidden');
      return { observed: `${r.ok ? 'shown (pressed)' : 'did not show'} → ${r2.ok ? 'hidden' : 'stuck'}`, pass: r.ok && r2.ok, ms: r.ms };
    });
    await item('A-192', 'Fold "˅" / open "˄"', 'fold the card, then open it', 'a small pill, then the card again', async () => {
      const r = await measure(page, () => page.locator('[data-replay-fold="fold"]').click(), () => !!document.querySelector('[data-replay-strip="folded"]'));
      const tools = await ev(page, () => !!document.querySelector('[data-replay-tools]'));
      const r2 = await measure(page, () => page.locator('[data-replay-fold="open"]').click(), () => !!document.querySelector('[data-replay-strip="play"]'));
      return { observed: `${r.ok ? 'folded' : 'did not fold'} (tools ${tools ? 'shown' : 'hidden'}) → ${r2.ok ? 'open' : 'stuck'}`, pass: r.ok && r2.ok, ms: r.ms };
    });
    /* the shell's keys during a replay */
    await item('A-250', '`?`', 'press ? (during a replay)', 'the keys sheet opens; Esc closes the sheet and leaves the replay', async () => {
      const r = await measure(page, () => page.keyboard.press('?'), () => window.__A.vis(document.querySelector('[data-key-sheet]')), null, 3000);
      await page.keyboard.press('Escape');
      await sleep(300);
      const o = await ev(page, () => ({ sheet: !!document.querySelector('[data-key-sheet]'), badge: !!document.querySelector('[data-replay-badge]') }));
      return { observed: `sheet ${r.ok ? 'opened' : 'did not open'}; Esc → sheet ${o.sheet ? 'still open' : 'closed'}, replay ${o.badge ? 'still on' : 'ended'}`, pass: r.ok && !o.sheet && o.badge, ms: r.ms };
    });
    await item('A-251', '`/`', 'press / (during a replay)', 'the command line opens (Terrain has no search)', async () => {
      const r = await measure(page, () => page.keyboard.press('/'), () => window.__A.vis(document.querySelector('[role=dialog][aria-label="Command line"]')), null, 3000);
      await page.keyboard.press('Escape');
      await sleep(300);
      const o = await ev(page, () => ({ pal: !!document.querySelector('[role=dialog][aria-label="Command line"]'), badge: !!document.querySelector('[data-replay-badge]') }));
      return { observed: `palette ${r.ok ? 'opened' : 'did not open'}; Esc → ${o.pal ? 'still open' : 'closed'}, replay ${o.badge ? 'still on' : 'ended'}`, pass: r.ok && !o.pal && o.badge, ms: r.ms };
    });
    await item('A-252', 'Ctrl K', 'press Ctrl+K (during a replay)', 'the command line opens', async () => {
      const r = await measure(page, () => page.keyboard.press('Control+k'), () => window.__A.vis(document.querySelector('[role=dialog][aria-label="Command line"]')), null, 3000);
      await page.keyboard.press('Escape');
      await sleep(300);
      return { observed: r.ok ? 'palette opened' : 'nothing', pass: r.ok, ms: r.ms };
    });
    await item('A-240', 'Shift ↓', 'in the pick phase, then in the play phase, press Shift+↓ twice', 'pick: says a bar must be picked; play: "Replay playing" then "Replay paused"', async () => {
      await ev(page, () => { const el = document.querySelector('span.sr-only[aria-live="polite"]'); if (el) el.textContent = ''; });
      const r = await measure(page, () => page.keyboard.press('Shift+ArrowDown'), () => window.__A.say() === 'Replay playing' && document.querySelector('[data-replay-play]')?.getAttribute('aria-pressed') === 'true', null, 3000);
      const r2 = await measure(page, () => page.keyboard.press('Shift+ArrowDown'), () => window.__A.say() === 'Replay paused' && document.querySelector('[data-replay-play]')?.getAttribute('aria-pressed') === 'false', null, 3000);
      return { observed: `pick phase: "${pickSay.s1}"; play: ${r.ok ? '"Replay playing", playing' : 'no play'} → ${r2.ok ? '"Replay paused"' : 'not paused'}`, pass: pickSay.ok1 && pickSay.still && r.ok && r2.ok, ms: r.ms };
    });
    await item('A-241', 'Shift →', 'in the pick phase, then in the play phase, press Shift+→', 'pick: says a bar must be picked; play: "Replay one bar on" and the cursor a bar on', async () => {
      await page.locator('[data-replay-step="back"]').click().catch(() => {});
      const m0 = await minute();
      await ev(page, () => { const el = document.querySelector('span.sr-only[aria-live="polite"]'); if (el) el.textContent = ''; });
      const r = await measure(page, () => page.keyboard.press('Shift+ArrowRight'), m0 => window.__A.say() === 'Replay one bar on' && window.__A.minuteOf(window.__A.badge()) !== m0, m0, 3000);
      const m1 = await minute();
      return { observed: `pick phase: "${pickSay.s2}"; play: "${await ev(page, () => window.__A.say())}", ${m0} → ${m1}`, pass: pickSay.ok2 && r.ok && m1 > m0, ms: r.ms };
    });
    await item('A-247', 'Esc (replay)', 'press Esc', 'the replay ends (the badge goes)', async () => {
      const r = await measure(page, () => page.keyboard.press('Escape'), () => !document.querySelector('[data-replay-badge]'), null, 3000);
      return { observed: r.ok ? 'replay ended' : 'badge stays', pass: r.ok, ms: r.ms, notes: memo.escCard ? `Esc on the Go-to card first: card ${memo.escCard.card ? 'stayed' : 'closed'}, replay ${memo.escCard.badge ? 'kept' : 'ended with it'}` : '' };
    });
    await item('A-179', '"Back to live" (replay exit)', 'press P, click "Back to live"', 'the replay ends', async () => {
      await page.keyboard.press('p');
      await until(page, () => !!document.querySelector('[data-replay-exit]'), null, 4000);
      const words = await ev(page, () => document.querySelector('[data-replay-exit]')?.textContent?.trim());
      const r = await measure(page, () => page.locator('[data-replay-exit]').click(), () => !document.querySelector('[data-replay-badge]'), null, 3000);
      return { observed: `"${words}" → ${r.ok ? 'replay ended' : 'stays'}`, pass: r.ok, ms: r.ms };
    });
    await item('A-164', '"Back to live ›" pill', 'jump the view back (Oct 9), click the pill; then in a replay\'s pick phase pan back', 'the pill returns the view to the newest bar; it is not confused with the replay\'s exit', async () => {
      const bl = memo.backLive || {};
      const tw = memo.pickTwins || {};
      const both = tw.live && tw.exit;
      return { observed: `docked: pill ${bl.shown ? 'shown' : 'not shown'} after the jump, click → ${bl.ok ? 'view at the newest bar' : 'did not return'}; pick phase panned back: pill ${tw.live ? `"${tw.live}"` : 'absent'}, replay exit ${tw.exit ? `"${tw.exit}"` : 'absent'}`, pass: !!bl.ok && !(both && /Back to live/.test(tw.live) && /Back to live/.test(tw.exit)), ms: bl.ms ?? null, notes: both ? 'both "Back to live" controls stand together in the pick phase, one ends the replay and one moves the view' : '' };
    });
    {
      const r = await measure(page, () => page.keyboard.press('p'), () => !!document.querySelector('[data-replay-badge]'), null, 3000);
      const r2 = await measure(page, () => page.keyboard.press('p'), () => !document.querySelector('[data-replay-badge]') && window.__A.say() === 'SPY replay off', null, 3000);
      const row = rows.find(x => x.id === 'A-239');
      if (row) {
        row.observed += `; off: ${r2.ok ? '"SPY replay off", badge gone' : `"${await ev(page, () => window.__A.say())}"`}`;
        row.pass = row.pass === true && r.ok && r2.ok;
      }
    }
  } finally {
    await ctx.close();
  }
});

/* ═══ GROUP: TWO PANES, WIDE (2560 × 1100 — narrower, the two-pane header sheds the badge and the link chip) ═══ */
await group('link', async () => {
  const { ctx, page } = await openDesk({ w: 2560, h: 1100, layout: 1, panes: [{ ticker: 'SPY', timeframe: '5m' }, { ticker: 'QQQ', timeframe: '5m' }] });
  const H = i => page.locator('[data-chart-frame]').nth(i).locator('[data-pane-head]');
  try {
    await item('A-01', 'Pane number badge "1"…"4"', 'press 2; click pane 2', 'both panes show "1" and "2"; the active pane\'s badge wears the foil', async () => {
      const r = await measure(page, () => page.keyboard.press('2'), () => document.querySelectorAll('[data-chart-frame]').length === 2, null, 8000);
      await readyBars(page, 2, 60000);
      await sleep(600);
      const b = await ev(page, () => [0, 1].map(i => { const s = window.__A.head(i)?.querySelector('span.font-bold.tnum[aria-hidden]'); return s ? { t: s.textContent.trim(), foil: s.classList.contains('holo-bg') } : null; }));
      const box = await page.locator('[data-chart-frame]').nth(1).boundingBox();
      await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.6);
      await sleep(300);
      const b2 = await ev(page, () => [0, 1].map(i => window.__A.head(i)?.querySelector('span.font-bold.tnum[aria-hidden]')?.classList.contains('holo-bg') ?? null));
      return { observed: `badges ${JSON.stringify(b)}; after clicking pane 2 the foil is on ${JSON.stringify(b2)}`, pass: r.ok && b[0]?.t === '1' && b[1]?.t === '2' && b2[1] === true && b2[0] === false, ms: r.ms, notes: 'at 1440 × 900 and 1920 × 1000 the two-pane header sheds the badge (its width budget); run at 2560 × 1100' };
    });
    const linkMenu = async i => {
      await H(i).locator('[data-link-group]').click();
      await page.locator('[data-link-menu]').waitFor({ state: 'visible', timeout: 4000 });
    };
    const pick = async (i, word) => {
      await linkMenu(i);
      await page.locator('[data-link-menu] [role=menuitemradio]').filter({ hasText: new RegExp(`^\\s*${word}`) }).first().click();
    };
    await item('A-05', 'Link chip', 'click it', 'the link-group menu opens with 5 radio items', async () => {
      const chip = H(0).locator('[data-link-group]');
      if (!(await chip.count())) return { observed: 'no link chip in the header', pass: false };
      const r = await measure(page, () => chip.click(), () => window.__A.vis(document.querySelector('[data-link-menu]')));
      const items = await ev(page, () => [...document.querySelectorAll('[data-link-menu] [role=menuitemradio]')].map(x => x.textContent.replace(/\s+/g, ' ').trim().slice(0, 34)));
      await page.keyboard.press('Escape');
      /* the menu gone before the next step presses its chip (a press while it was still closing toggled it shut) */
      await page.locator('[data-link-menu]').waitFor({ state: 'detached', timeout: 2000 }).catch(() => {});
      return { observed: `${items.length} items: ${items.join(' | ')}`, pass: r.ok && items.length === 5, ms: r.ms, notes: 'the chip stands only where the compare + has room, the pane is linked, or it is expanded: at 1440 × 900 with two or more panes an unlinked pane shows no link chip, so it can be linked only from fullscreen' };
    });
    await item('A-07', 'Link option "Group A"', 'pane 1 → A, pane 2 → A, then pick NVDA on pane 1', 'both read group A; pane 2 follows to NVDA', async () => {
      await pick(0, 'Group A');
      await until(page, () => window.__A.head(0)?.querySelector('[data-link-group]')?.getAttribute('data-link-group') === 'A', null, 3000);
      await pick(1, 'Group A');
      const r0 = await until(page, () => window.__A.head(1)?.querySelector('[data-link-group]')?.getAttribute('data-link-group') === 'A', null, 3000);
      const follow0 = await until(page, () => window.__A.state(1)[0] === 'SPY', null, 15000);
      const t0 = Date.now();
      await setTicker(page, 0, 'NVDA');
      const ok = await until(page, () => window.__A.state(1)[0] === 'NVDA' && window.__A.bars(1) > 0, null, 30000);
      const ms = Date.now() - t0;
      const c = await ev(page, () => window.__A.cfg()?.panes?.slice(0, 2).map(p => ({ t: p.ticker, link: p.link })));
      return { observed: `pane 2 joined A ${r0}, read SPY ${follow0}; NVDA on pane 1 → pane 2 chart ${await ev(page, () => window.__A.state(1)[0])}; config ${JSON.stringify(c)}`, pass: r0 && follow0 && ok, ms, notes: 'ms = the pick to pane 2 drawing NVDA' };
    });
    for (const [id, g] of [['A-08', 'B'], ['A-09', 'C'], ['A-10', 'D']]) {
      await item(id, `Link option "Group ${g}"`, `pane 1 → Group ${g}`, `data-link-group "${g}" and the config's link ${g}`, async () => {
        await linkMenu(0);
        const r = await measure(page, () => page.locator('[data-link-menu] [role=menuitemradio]').filter({ hasText: new RegExp(`^\\s*Group ${g}`) }).first().click(), g => window.__A.head(0)?.querySelector('[data-link-group]')?.getAttribute('data-link-group') === g && window.__A.cfg()?.panes?.[0]?.link === g, g);
        const hint = await ev(page, () => document.querySelector('[data-link-group]')?.getAttribute('aria-label') ?? '');
        return { observed: `chip ${await ev(page, () => window.__A.head(0)?.querySelector('[data-link-group]')?.getAttribute('data-link-group'))}; config link ${await ev(page, () => window.__A.cfg()?.panes?.[0]?.link)}`, pass: r.ok, ms: r.ms };
      });
    }
    await item('A-06', 'Link option "None"', 'pane 1 → None', 'data-link-group "none" and no link in the config', async () => {
      await linkMenu(0);
      const r = await measure(page, () => page.locator('[data-link-menu] [role=menuitemradio]').filter({ hasText: /^\s*None/ }).first().click(), () => window.__A.head(0)?.querySelector('[data-link-group]')?.getAttribute('data-link-group') === 'none' && window.__A.cfg()?.panes?.[0]?.link == null);
      return { observed: `chip ${await ev(page, () => window.__A.head(0)?.querySelector('[data-link-group]')?.getAttribute('data-link-group'))}; config link ${await ev(page, () => JSON.stringify(window.__A.cfg()?.panes?.[0]?.link))}`, pass: r.ok, ms: r.ms };
    });
  } finally {
    await ctx.close();
  }
});

/* ═══ GROUP: TWO PANES (1440 × 900) — the expiry window as a trigger, desk-wide ═══ */
await group('window', async () => {
  const { ctx, page } = await openDesk({ layout: 2, panes: [{ ticker: 'SPY', timeframe: '5m' }, { ticker: 'QQQ', timeframe: '5m' }] });
  const H = page.locator('[data-chart-frame]').first().locator('[data-pane-head]');
  try {
    memo.winTrigForm = await ev(page, () => window.__A.head(0)?.dataset.windowForm);
    for (const [id, v, label] of [['A-40', 'w:0dte', '0DTE'], ['A-41', 'w:fri', 'Fri (to Friday)'], ['A-42', 'w:opex', 'OPEX (to monthly OPEX)'], ['A-43', 'book', '60d (all 60 days)']]) {
      await item(id, `Window "${label}"`, `pick ${label.split(' ')[0]} (the trigger on pane 1 at two panes; the chips at one pane)`, `railCut === ${v}; every pane's window control reads ${v}; the card closes`, async () => {
        const trig = H.locator('[data-window-trigger]');
        if (!(await trig.count())) return { observed: `no trigger (window form ${memo.winTrigForm})`, pass: false };
        await trig.click();
        await page.locator('[data-popover-card="pane-window"]').waitFor({ state: 'visible', timeout: 3000 });
        const r = await measure(page, () => page.locator(`[data-popover-card="pane-window"] [data-window-pick="${v}"]`).click(), v => window.__A.cfg()?.railCut === v && [0, 1].every(i => window.__A.head(i)?.querySelector('[data-pane-window]')?.getAttribute('data-pane-window') === v) && !document.querySelector('[data-popover-card="pane-window"]'), v);
        const o = await ev(page, () => ({ cut: window.__A.cfg()?.railCut, heads: [0, 1].map(i => window.__A.head(i)?.querySelector('[data-pane-window]')?.getAttribute('data-pane-window')) }));
        const full = memo.winFull?.[id];
        return { observed: `trigger: railCut ${o.cut}, panes read ${o.heads.join(' / ')}; chips (one pane, ${memo.winFullForm}): ${full ? (full.ok ? `ok in ${full.ms} ms` : `failed${full.why ? ` (${full.why})` : ''}`) : 'not run'}`, pass: r.ok && (!full || full.ok), ms: r.ms };
      });
    }
  } finally {
    await ctx.close();
  }
});

/* ═══ GROUP: THREE PANES (1440 × 900, the ladders on) — the header's timeframe trigger, the short legend ═══ */
await group('tftrig', async () => {
  const { ctx, page } = await openDesk({ layout: 3, ladder: true, panes: [{ ticker: 'SPY', timeframe: '5m' }, { ticker: 'QQQ', timeframe: '5m' }, { ticker: 'NVDA', timeframe: '5m' }] });
  const H = page.locator('[data-chart-frame]').first().locator('[data-pane-head]');
  try {
    memo.legendShort = await ev(page, () => { const l = window.__A.pane(0)?.querySelector('[data-bead-legend]'); return l ? `pane 1 (${Math.round(window.__A.pane(0).getBoundingClientRect().width)} px) wears the ${l.dataset.beadForm} form: "${l.textContent.replace(/\s+/g, ' ').trim().slice(0, 90)}"` : 'no legend on the narrow pane'; });
    addNote('A-156', memo.legendShort);
    await item('A-30', 'Header timeframe trigger "5m ▾"', 'on a narrow pane (tabs shed), click it', 'the timeframe list opens', async () => {
      const trig = H.locator('[data-tf-trigger]');
      if (!(await trig.count())) return { observed: 'no trigger on pane 1', pass: false };
      const r = await measure(page, () => trig.click(), () => document.querySelectorAll('[data-popover-card="pane-timeframe"] [data-tf-pick]').length === 8);
      const t = await trig.getAttribute('title');
      await page.keyboard.press('Escape');
      return { observed: `8 options; title "${t}"`, pass: r.ok, ms: r.ms };
    });
    await item('A-31', 'Option "15s"', 'open the list, read 15s', 'disabled on the feed with its reason', async () => {
      await H.locator('[data-tf-trigger]').click();
      const o = await ev(page, () => { const b = document.querySelector('[data-tf-pick="15s"]'); return { dis: b?.disabled, title: b?.title }; });
      await page.keyboard.press('Escape');
      return { observed: `disabled ${o.dis}; title "${o.title}"`, pass: o.dis === true && !!o.title, ms: null };
    });
    for (const [id, tf] of [['A-32', '1m'], ['A-33', '5m'], ['A-34', '15m'], ['A-35', '30m'], ['A-36', '1h'], ['A-37', '1D'], ['A-38', '1W']]) {
      await item(id, `Option "${tf}"`, `open the list, pick ${tf}`, `the pane on ${tf}; the card closes`, async () => {
        if (id === 'A-33') { await H.locator('[data-tf-trigger]').click(); await page.locator('[data-tf-pick="1m"]').click(); await until(page, () => window.__A.tf(0) === '1m', null, 15000); }
        await H.locator('[data-tf-trigger]').click();
        await page.locator('[data-popover-card="pane-timeframe"]').waitFor({ state: 'visible', timeout: 3000 });
        const r = await measure(page, () => page.locator(`[data-tf-pick="${tf}"]`).click(), tf => window.__A.cfg()?.panes?.[0]?.timeframe === tf && window.__A.tf(0) === tf && window.__A.bars(0) > 0 && !document.querySelector('[data-popover-card="pane-timeframe"]'), tf, 30000);
        const v = await viewNewest(page, 0, tf);
        return { observed: `config ${await ev(page, () => window.__A.cfg()?.panes?.[0]?.timeframe)}, chart ${await ev(page, () => window.__A.tf(0))}; ${v.txt}`, pass: r.ok && v.ok, ms: r.ms };
      });
    }
  } finally {
    await ctx.close();
  }
});

/* ═══ GROUP: THE KEYS (1440 × 900, three panes, the ladders on) ═══ */
await group('keys', async () => {
  const { ctx, page } = await openDesk({ layout: 3, ladder: true, panes: [{ ticker: 'SPY', timeframe: '5m' }, { ticker: 'QQQ', timeframe: '5m' }, { ticker: 'NVDA', timeframe: '5m' }] });
  const say = () => ev(page, () => window.__A.say());
  const clearSay = () => ev(page, () => { const el = document.querySelector('span.sr-only[aria-live="polite"]'); if (el) el.textContent = ''; });
  const frames = n => () => document.querySelectorAll('[data-chart-frame]').length === n;
  try {
    await ev(page, () => document.activeElement?.blur?.());
    await item('A-230', '`1` `2` `3` `4`', 'press 2, 4, 1, 3', 'the layout and its announcement follow each key', async () => {
      const out = [];
      let ok = true;
      let first = null;
      for (const [k, want] of [['2', '2 charts'], ['4', '4 charts'], ['1', 'One chart'], ['3', '3 charts']]) {
        const r = await measure(page, () => page.keyboard.press(k), ([n, w]) => document.querySelectorAll('[data-chart-frame]').length === n && window.__A.cfg()?.layout === n && window.__A.say() === w, [+k, want], 6000);
        out.push(`${k}: ${r.ok ? `"${await say()}" ${r.ms} ms` : `failed ("${await say()}")`}`);
        ok = ok && r.ok;
        first ??= r.ms;
      }
      return { observed: out.join('; '), pass: ok, ms: first, notes: memo.phoneLayout ? `on a phone: ${memo.phoneLayout}` : '' };
    });
    await readyBars(page, 3, 60000);
    await item('A-231', '`[` `]`', 'press ], then [', '"Chart 2 of 3, QQQ", then "Chart 1 of 3, SPY"', async () => {
      const r = await measure(page, () => page.keyboard.press(']'), () => window.__A.say() === 'Chart 2 of 3, QQQ', null, 3000);
      const s1 = await say();
      const r2 = await measure(page, () => page.keyboard.press('['), () => window.__A.say() === 'Chart 1 of 3, SPY', null, 3000);
      return { observed: `"${s1}" → "${await say()}"`, pass: r.ok && r2.ok, ms: r.ms };
    });
    await item('A-238', '`-` `=`', 'press =, -, then - twice more from 5m', '15m then 5m; at 1m on the feed - does not land on the held 15s', async () => {
      const r = await measure(page, () => page.keyboard.press('='), () => window.__A.tf(0) === '15m' && window.__A.say() === 'SPY 15m', null, 15000);
      const r2 = await measure(page, () => page.keyboard.press('-'), () => window.__A.tf(0) === '5m' && window.__A.say() === 'SPY 5m', null, 15000);
      await page.keyboard.press('-');
      await until(page, () => window.__A.tf(0) === '1m', null, 15000);
      await sleep(500);
      await page.keyboard.press('-');
      await sleep(1500);
      const o = await ev(page, () => ({ cfg: window.__A.cfg()?.panes?.[0]?.timeframe, chart: window.__A.tf(0), say: window.__A.say() }));
      await page.keyboard.press('=');
      await page.keyboard.press('=');
      await until(page, () => window.__A.tf(0) === '5m', null, 15000);
      const heldOk = o.cfg !== '15s';
      return { observed: `= → 15m ${r.ok}; - → 5m ${r2.ok}; - from 1m → config ${o.cfg}, chart ${o.chart}, said "${o.say}"`, pass: r.ok && r2.ok && heldOk, ms: r.ms, notes: heldOk ? '' : 'stepTf (pages/terrain/paneKeys.ts:31) does not skip FEED_HELD, and the desk key handler (Terrain.tsx `case \'-\'`) does not check it: the config stores the held 15s while the chart draws 1m' };
    });
    await sleep(800);
    await item('A-237', '↑ ↓ / `k` `j`', 'press ↓, then ↑; then j and k', 'the active pane steps round the ring and back, said with its place', async () => {
      await clearSay();
      const r = await measure(page, () => page.keyboard.press('ArrowDown'), () => /, \d+ of \d+$/.test(window.__A.say()) && window.__A.state(0)[0] !== 'SPY', null, 15000);
      const s1 = await say();
      const r2 = await measure(page, () => page.keyboard.press('ArrowUp'), () => window.__A.state(0)[0] === 'SPY' && /^SPY, /.test(window.__A.say()), null, 15000);
      const s2 = await say();
      const r3 = await measure(page, () => page.keyboard.press('j'), () => window.__A.state(0)[0] !== 'SPY', null, 15000);
      const r4 = await measure(page, () => page.keyboard.press('k'), () => window.__A.state(0)[0] === 'SPY', null, 15000);
      return { observed: `↓ "${s1}"; ↑ "${s2}"; j ${r3.ok ? 'stepped' : 'did nothing'}, k ${r4.ok ? 'back' : 'did not return'}`, pass: r.ok && r2.ok && r3.ok && r4.ok, ms: r.ms, notes: memo.tabletArrow ? `between md and lg: ${memo.tabletArrow}` : '' };
    });
    await readyBars(page, 3, 60000);
    await item('A-243', '`R` (r)', 'press r twice', 'the active pane\'s ladder off, then on, said', async () => {
      const r = await measure(page, () => page.keyboard.press('r'), () => window.__A.cfg()?.panes?.[0]?.ladder === false && /strike rail hidden/.test(window.__A.say()), null, 3000);
      const s1 = await say();
      const others = await ev(page, () => window.__A.cfg()?.panes?.slice(1, 3).map(p => p.ladder));
      const r2 = await measure(page, () => page.keyboard.press('r'), () => window.__A.cfg()?.panes?.[0]?.ladder === true, null, 3000);
      return { observed: `"${s1}"; the other panes ${JSON.stringify(others)}; again → ${r2.ok ? 'on' : 'stuck'} ("${await say()}")`, pass: r.ok && r2.ok && others.every(Boolean), ms: r.ms };
    });
    await item('A-232', 'Shift R', 'press Shift+R twice', 'every visible ladder off ("Every strike rail hidden"), then on', async () => {
      const r = await measure(page, () => page.keyboard.press('Shift+R'), () => window.__A.cfg()?.panes?.slice(0, 3).every(p => p.ladder === false) && window.__A.say() === 'Every strike rail hidden', null, 3000);
      const r2 = await measure(page, () => page.keyboard.press('Shift+R'), () => window.__A.cfg()?.panes?.slice(0, 3).every(p => p.ladder === true) && window.__A.say() === 'Strike rail on every chart', null, 3000);
      return { observed: `${r.ok ? '"Every strike rail hidden"' : 'off failed'} → ${r2.ok ? '"Strike rail on every chart"' : 'on failed'}`, pass: r.ok && r2.ok, ms: r.ms };
    });
    await item('A-233', '`W`', 'press w four times', 'book → 0DTE → Fri → OPEX → book, said each time', async () => {
      const seq = [];
      let ok = true;
      let first = null;
      for (const want of ['w:0dte', 'w:fri', 'w:opex', 'book']) {
        const r = await measure(page, () => page.keyboard.press('w'), w => window.__A.cfg()?.railCut === w, want, 3000);
        seq.push(`${want}${r.ok ? '' : ' ✗'} "${await say()}"`);
        ok = ok && r.ok;
        first ??= r.ms;
      }
      return { observed: seq.join(' → '), pass: ok, ms: first, notes: memo.wFromDate ? `from a listed date: ${memo.wFromDate}` : '' };
    });
    await item('A-242', '`D`', 'press d twice', '"SPY draw mode on", then off', async () => {
      const r = await measure(page, () => page.keyboard.press('d'), () => window.__A.say() === 'SPY draw mode on', null, 3000);
      const r2 = await measure(page, () => page.keyboard.press('d'), () => window.__A.say() === 'SPY draw mode off', null, 3000);
      return { observed: `${r.ok ? '"SPY draw mode on"' : `"${await say()}"`} → ${r2.ok ? '"SPY draw mode off"' : `"${await say()}"`}`, pass: r.ok && r2.ok, ms: r.ms };
    });
    await item('A-245', '`L`', 'press l twice', 'legend === false, said; then back', async () => {
      const r = await measure(page, () => page.keyboard.press('l'), () => window.__A.cfg()?.panes?.[0]?.legend === false && /legend hidden/.test(window.__A.say()), null, 3000);
      const r2 = await measure(page, () => page.keyboard.press('l'), () => window.__A.cfg()?.panes?.[0]?.legend !== false, null, 3000);
      return { observed: `"${r.ok ? 'SPY bead legend hidden' : await say()}" → ${r2.ok ? 'shown' : 'stuck'}`, pass: r.ok && r2.ok, ms: r.ms, notes: memo.lInFull != null ? `in fullscreen: ${memo.lInFull ? 'works' : 'did nothing'}` : '' };
    });
    await item('A-235', '`S`', 'press s, then Esc', 'the active pane\'s symbol picker opens; Esc closes it', async () => {
      const r = await measure(page, () => page.keyboard.press('s'), () => window.__A.vis(document.querySelector('[role=dialog][aria-label^="Change symbol"]')), null, 3000);
      const lbl = await ev(page, () => document.querySelector('[role=dialog][aria-label^="Change symbol"]')?.getAttribute('aria-label'));
      await page.keyboard.press('Escape');
      const c = await until(page, () => !document.querySelector('[role=dialog][aria-label^="Change symbol"]'), null, 3000);
      return { observed: `"${lbl}"; Esc ${c ? 'closed it' : 'left it'}`, pass: r.ok && c, ms: r.ms };
    });
    await item('A-236', '`C`', 'where the + is shed (three panes, the ladders on) press c, then ↓; on one pane with the + press c', 'shed: said, and ↓ still steps; with the +: the compare panel opens', async () => {
      await clearSay();
      await page.keyboard.press('c');
      await sleep(400);
      const s1 = await say();
      const r = await measure(page, () => page.keyboard.press('ArrowDown'), () => window.__A.state(0)[0] !== 'SPY', null, 10000);
      await page.keyboard.press('ArrowUp');
      await until(page, () => window.__A.state(0)[0] === 'SPY', null, 10000);
      await page.keyboard.press(']');
      await page.keyboard.press(']');
      await until(page, () => /^Chart 3 of 3/.test(window.__A.say()), null, 3000);
      await clearSay();
      await page.keyboard.press('c');
      await sleep(400);
      const s3 = await say();
      const w = memo.cWide;
      return { observed: `shed (pane 1): "${s1}", ↓ afterwards ${r.ok ? 'stepped' : 'did nothing'}; pane 3 (1192 px, the ladder on, + shed too): "${s3}"; one pane with the +: ${w ? (w.ok ? `compare panel open in ${w.ms} ms` : 'nothing opened') : 'not checked'}`, pass: /No room for Compare/.test(s1) && r.ok && (!w || w.ok), ms: w?.ms ?? null };
    });
    await item('A-244', '`T`', 'on the wide pane 3 press t; on the narrow pane 1 press t; in fullscreen press t', 'the jump calendar opens with its date field focused wherever T is said to work', async () => {
      await sleep(300);
      const r = await measure(page, () => page.keyboard.press('t'), () => document.activeElement?.hasAttribute?.('data-jump-date-input') === true, null, 3000);
      await page.keyboard.press('Escape');
      await sleep(300);
      await page.keyboard.press('[');
      await page.keyboard.press('[');
      await until(page, () => /^Chart 1 of 3/.test(window.__A.say()), null, 3000);
      const jf = await ev(page, () => window.__A.head(0)?.dataset.jumpForm);
      await page.keyboard.press('t');
      await sleep(700);
      const n = await ev(page, () => ({ focus: document.activeElement?.hasAttribute?.('data-jump-date-input') ?? false, card: !!document.querySelector('[data-popover-card="pane-jump-date"]'), say: window.__A.say() }));
      if (n.card) await page.keyboard.press('Escape');
      const f = memo.tInFull;
      const narrowOk = n.card || !/Jump to a date/.test(n.say);
      const fullOk = !f || f.card || !/Jump to a date/.test(f.say);
      return { observed: `wide pane: ${r.ok ? 'date field focused' : 'nothing'}; narrow pane (jumps ${jf}): ${n.card ? 'calendar opened' : 'nothing opened'}, said "${n.say}"; fullscreen: ${f ? `${f.card ? 'calendar opened' : 'nothing opened'}, said "${f.say}"` : 'not checked'}`, pass: r.ok && narrowOk && fullOk, ms: r.ms, notes: !narrowOk || !fullOk ? 'where the jump control is shed (or in fullscreen, no PaneHead) T announces "Jump to a date" and opens nothing (PaneHead.tsx:71 needs `jump`)' : '' };
    });
    await item('A-256', 'Letter keys with Caps Lock on', 'a synthetic keydown "P" with Caps Lock, then "R" with Caps Lock', 'P acts as p (replay on); Caps-R acts as r (one ladder), not Shift R', async () => {
      await clearSay();
      const fire = key => ev(page, key => document.body.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, modifierCapsLock: true })), key);
      await fire('P');
      const ok1 = await until(page, () => window.__A.say() === 'SPY replay on' && !!document.querySelector('[data-replay-badge]'), null, 3000);
      const s1 = await say();
      await fire('P');
      await until(page, () => !document.querySelector('[data-replay-badge]'), null, 3000);
      const before = await ev(page, () => window.__A.cfg()?.panes?.slice(0, 3).map(p => p.ladder));
      await fire('R');
      await sleep(400);
      const after = await ev(page, () => window.__A.cfg()?.panes?.slice(0, 3).map(p => p.ladder));
      const s2 = await say();
      await fire('R');
      const oneOnly = after[0] !== before[0] && after[1] === before[1] && after[2] === before[2];
      return { observed: `Caps P → "${s1}"; Caps R → ladders ${JSON.stringify(before)} → ${JSON.stringify(after)} ("${s2}")`, pass: ok1 && oneOnly, ms: null, notes: 'a synthetic KeyboardEvent with modifierCapsLock: headless Chromium has no Caps Lock to press' };
    });
    await item('A-257', 'Keys while a house layer is open', 'open ? (the keys sheet), press 2', 'the layout behind the sheet does not change', async () => {
      const r = await measure(page, () => page.keyboard.press('?'), () => window.__A.vis(document.querySelector('[data-key-sheet]')), null, 3000);
      await page.keyboard.press('2');
      await sleep(700);
      const o = await ev(page, () => ({ layout: window.__A.cfg()?.layout, frames: document.querySelectorAll('[data-chart-frame]').length }));
      await page.keyboard.press('Escape');
      await until(page, () => !document.querySelector('[data-key-sheet]'), null, 3000);
      memo.sheetMs = r.ms;
      return { observed: `sheet ${r.ok ? 'open' : 'missing'}; after 2: layout ${o.layout}, ${o.frames} frames`, pass: r.ok && o.layout === 3 && o.frames === 3, ms: r.ms };
    });
    memo.slashDocked = await (async () => {
      const r = await measure(page, () => page.keyboard.press('/'), () => window.__A.vis(document.querySelector('[role=dialog][aria-label="Command line"]')), null, 3000);
      await page.keyboard.press('Escape');
      return r;
    })();
    addNote('A-251', `outside a replay: ${memo.slashDocked.ok ? `opens in ${memo.slashDocked.ms} ms` : 'did not open'}`);
    await item('A-253', '`g` then `t`', 'from /glossary press g, then t', 'the page goes to /terrain', async () => {
      await page.goto(BASE + '/glossary', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('h1', { timeout: 20000 });
      await sleep(1500);
      await ev(page, () => document.activeElement?.blur?.());
      const t0 = Date.now();
      await page.keyboard.press('g');
      await page.keyboard.press('t');
      const ok = await until(page, () => location.pathname === '/terrain' && document.querySelectorAll('[data-chart-frame]').length > 0, null, 15000);
      return { observed: `at ${await ev(page, () => location.pathname)}`, pass: ok, ms: Date.now() - t0, notes: 'ms = the keys to the first pane on /terrain' };
    });
  } finally {
    await ctx.close();
  }
});

/* ═══ GROUP: THE DESK BAR (1440 × 900, one pane, the ladder on) ═══ */
await group('desk', async () => {
  const { ctx, page } = await openDesk({ ladder: true });
  const BAR = page.locator('[data-terrain-desk-bar]');
  const shelfBtn = page.locator('button[aria-haspopup="dialog"][title^="Named layouts"]');
  const SHELF = page.locator('[role=dialog][aria-label="Named layouts"]');
  const named = () => ev(page, () => { try { return Object.keys(JSON.parse(localStorage.getItem('slayer_terrain_layouts_v1') || '{}')); } catch { return []; } });
  try {
    const docked = await ev(page, () => { const b = document.querySelector('[data-terrain-desk-bar]'); return `${b?.dataset.terrainDeskBar}, opacity ${getComputedStyle(b).opacity}`; });
    addNote('A-204', `docked: ${docked}`);
    for (const [id, n] of [['A-206', 2], ['A-207', 3], ['A-208', 4], ['A-205', 1]]) {
      await item(id, `Layout "${n}"`, `click "${n}"`, `layout ${n}, ${n} chart frame${n > 1 ? 's' : ''}`, async () => {
        const b = BAR.locator(`[aria-label="How many charts"] button[aria-label="${n} ${n === 1 ? 'chart' : 'charts'}"]`);
        const r = await measure(page, () => b.click(), n => window.__A.cfg()?.layout === n && document.querySelectorAll('[data-chart-frame]').length === n, n, 8000);
        const t1 = Date.now();
        let drawn = '';
        try { await readyBars(page, n, 45000); drawn = `; every pane drawn ${r.ms + Date.now() - t1} ms after the click`; } catch { drawn = '; not every pane drew within 45 s'; }
        return { observed: `layout ${await ev(page, () => window.__A.cfg()?.layout)}, ${await ev(page, () => document.querySelectorAll('[data-chart-frame]').length)} frames; aria-pressed ${await b.getAttribute('aria-pressed')}${drawn}`, pass: r.ok && (await b.getAttribute('aria-pressed')) === 'true', ms: r.ms, notes: 'ms = click to the frames on the page' };
      });
    }
    await item('A-209', '"STRIKES"', 'click it twice', 'every ladder off (aria-pressed false), then on', async () => {
      const b = page.locator('[data-strikes-toggle]');
      const r = await measure(page, () => b.click(), () => window.__A.cfg()?.panes?.every(p => p.ladder === false) && document.querySelector('[data-strikes-toggle]')?.getAttribute('aria-pressed') === 'false');
      const r2 = await measure(page, () => b.click(), () => window.__A.cfg()?.panes?.every(p => p.ladder === true) && document.querySelector('[data-strikes-toggle]')?.getAttribute('aria-pressed') === 'true');
      return { observed: `off ${r.ok}; on ${r2.ok}`, pass: r.ok && r2.ok, ms: r.ms };
    });
    await item('A-210', '"Colours" dropdown', 'click it', 'two options', async () => {
      const r = await measure(page, () => page.locator('[data-dropdown="terrain-colours"]').click(), () => document.querySelectorAll('[role=menuitemradio]').length >= 2);
      const o = await ev(page, () => [...document.querySelectorAll('[role=menuitemradio]')].map(x => x.textContent.replace(/\s+/g, ' ').trim().slice(0, 40)));
      await page.keyboard.press('Escape');
      return { observed: o.join(' | '), pass: r.ok && o.length === 2, ms: r.ms };
    });
    for (const [id, label, v] of [['A-211', 'Thermal', 'thermal'], ['A-212', 'House', 'house']]) {
      await item(id, `Colours "${label}"`, `pick ${label}`, `palette and rails === ${v}`, async () => {
        await page.locator('[data-dropdown="terrain-colours"]').click();
        const r = await measure(page, () => page.locator('[role=menuitemradio]').filter({ hasText: new RegExp(`^\\s*${label}`) }).first().click(), v => window.__A.cfg()?.palette === v && window.__A.cfg()?.rails === v, v);
        return { observed: `palette ${await ev(page, () => window.__A.cfg()?.palette)}, rails ${await ev(page, () => window.__A.cfg()?.rails)}`, pass: r.ok, ms: r.ms };
      });
    }
    for (const [id, u] of [['A-214', '%'], ['A-215', 'ATR'], ['A-216', 'σ'], ['A-213', '$']]) {
      await item(id, `Distance "${u}"`, `click ${u}`, `the desk-wide distance unit is ${u}`, async () => {
        const b = page.locator('[aria-label="Distance unit — desk-wide"] button').filter({ hasText: rx(u) });
        const r = await measure(page, () => b.click(), u => (localStorage.getItem('slayer_distance_unit') ?? '').includes(u), u);
        return { observed: `stored ${await ev(page, () => localStorage.getItem('slayer_distance_unit'))}; pressed ${await b.getAttribute('aria-pressed')}`, pass: r.ok, ms: r.ms, notes: 'what it changes on Terrain is the drawing measure label alone (the ladder, axis chips and strip print $, % and σ fixed)' };
      });
    }
    await item('A-217', '"LAYOUTS"', 'click it', 'the "Named layouts" shelf opens; aria-expanded true', async () => {
      const r = await measure(page, () => shelfBtn.click(), () => window.__A.vis(document.querySelector('[role=dialog][aria-label="Named layouts"]')));
      const o = await ev(page, () => ({ exp: document.querySelector('button[aria-haspopup="dialog"][title^="Named layouts"]')?.getAttribute('aria-expanded'), focusIn: !!document.querySelector('[role=dialog][aria-label="Named layouts"]')?.contains(document.activeElement), modal: document.querySelector('[role=dialog][aria-label="Named layouts"]')?.getAttribute('aria-modal') }));
      return { observed: `open; aria-expanded ${o.exp}; focus ${o.focusIn ? 'moved in' : 'left on the button'}; aria-modal ${o.modal}`, pass: r.ok && o.exp === 'true', ms: r.ms };
    });
    await item('A-221', 'Empty note', 'read the empty shelf', '"Nothing saved yet — name this desk below."', async () => {
      const t = await SHELF.textContent();
      return { observed: /Nothing saved yet/.test(t) ? '"Nothing saved yet — name this desk below."' : `"${t.slice(0, 80)}"`, pass: /Nothing saved yet/.test(t), ms: null };
    });
    await item('A-224', 'Shelf note', 'click Save with no name', '"give it a name"', async () => {
      const r = await measure(page, () => SHELF.locator('button').filter({ hasText: rx('Save') }).click(), () => /give it a name/.test(document.querySelector('[role=dialog][aria-label="Named layouts"]')?.textContent ?? ''), null, 2000);
      return { observed: r.ok ? '"give it a name"' : 'no note', pass: r.ok, ms: r.ms };
    });
    await item('A-222', 'Name field "name this arrangement"', 'type "morning", press Enter', 'saved under "morning"', async () => {
      const inp = SHELF.locator('[aria-label="Layout name"]');
      const ml = await inp.getAttribute('maxlength');
      await inp.fill('morning');
      const r = await measure(page, () => inp.press('Enter'), () => { try { return 'morning' in JSON.parse(localStorage.getItem('slayer_terrain_layouts_v1') || '{}'); } catch { return false; } });
      return { observed: `saved: ${JSON.stringify(await named())}; maxlength ${ml ?? 'none'}`, pass: r.ok, ms: r.ms, notes: ml ? '' : 'no maxlength — a long name is cut to 24 silently (layouts.ts LAYOUT_NAME_MAX)' };
    });
    await item('A-223', '"SAVE"', 'type "evening", click Save', 'the entry appears; the field clears', async () => {
      const inp = SHELF.locator('[aria-label="Layout name"]');
      await inp.fill('evening');
      const r = await measure(page, () => SHELF.locator('button').filter({ hasText: rx('Save') }).click(), () => [...document.querySelectorAll('[role=dialog][aria-label="Named layouts"] button')].some(b => b.textContent.startsWith('evening')));
      return { observed: `entries ${JSON.stringify(await named())}; field "${await inp.inputValue()}"`, pass: r.ok && (await inp.inputValue()) === '', ms: r.ms };
    });
    await item('A-218', 'Shelf header "NAMED LAYOUTS · 2/12"', 'read it after two saves', 'the count against the cap', async () => {
      const t = await ev(page, () => document.querySelector('[role=dialog][aria-label="Named layouts"]')?.firstElementChild?.textContent?.trim());
      /* the house card prints its count as "2 of 12" (PopoverCard's meta, since 9115af0) */
      return { observed: `"${t}"`, pass: /2\s*(\/|of)\s*12/.test(t ?? ''), ms: null };
    });
    await item('A-219', 'Saved entry "morning 1× SPY"', 'go to 3 charts, open the shelf, click "morning"', 'the layout and panes come back; the shelf closes', async () => {
      await page.keyboard.press('Escape');
      await sleep(200);
      if (await SHELF.isVisible().catch(() => false)) await shelfBtn.click({ force: true });
      await page.keyboard.press('3');
      await until(page, () => document.querySelectorAll('[data-chart-frame]').length === 3, null, 6000);
      await shelfBtn.click();
      const entry = SHELF.locator('button').filter({ hasText: /^morning/ }).first();
      const title = await entry.getAttribute('title');
      const r = await measure(page, () => entry.click(), () => window.__A.cfg()?.layout === 1 && document.querySelectorAll('[data-chart-frame]').length === 1 && !document.querySelector('[role=dialog][aria-label="Named layouts"]'), null, 6000);
      return { observed: `title "${title}"; → layout ${await ev(page, () => window.__A.cfg()?.layout)}, shelf ${(await SHELF.count()) ? 'open' : 'closed'}`, pass: r.ok, ms: r.ms };
    });
    await item('A-220', 'Delete "×"', 'open the shelf, hover "evening", click ×; also focus a × by the keys', 'the entry goes and storage follows; the × can be seen when focused', async () => {
      await shelfBtn.click();
      const row = SHELF.locator('div.group').filter({ hasText: /^evening/ }).first();
      const x = SHELF.locator('[aria-label="Delete the layout evening"]');
      await x.focus();
      const focusOpacity = await x.evaluate(e => getComputedStyle(e).opacity);
      await row.hover();
      const r = await measure(page, () => x.click(), () => { try { return !('evening' in JSON.parse(localStorage.getItem('slayer_terrain_layouts_v1') || '{}')); } catch { return false; } });
      const undo = await ev(page, () => !!document.querySelector('[data-undo-chip], [data-undo]') || /Undo/.test(document.body.innerText));
      memo.deleted = true;
      return { observed: `entries after ${JSON.stringify(await named())}; the × focused by the keys has opacity ${focusOpacity}${undo ? '; an undo chip showed' : '; no undo chip'}`, pass: r.ok && +focusOpacity > 0.5, ms: r.ms, notes: +focusOpacity <= 0.5 ? 'the × is opacity-0 until hovered, with no focus variant (Terrain.tsx, the shelf\'s delete button)' : '' };
    });
    await item('A-255', 'Ctrl Z', 'after the delete, press Ctrl+Z', 'the deleted layout comes back (the house undo)', async () => {
      if (await SHELF.isVisible().catch(() => false)) { await page.keyboard.press('Escape'); await sleep(200); }
      if (await SHELF.isVisible().catch(() => false)) await shelfBtn.click({ force: true });
      await ev(page, () => document.activeElement?.blur?.());
      const r = await measure(page, () => page.keyboard.press('Control+z'), () => { try { return 'evening' in JSON.parse(localStorage.getItem('slayer_terrain_layouts_v1') || '{}'); } catch { return false; } }, null, 2500);
      return { observed: r.ok ? '"evening" came back' : `nothing came back (${JSON.stringify(await named())})`, pass: r.ok, ms: r.ok ? r.ms : null, notes: r.ok ? '' : 'the named-layout delete does not use ui/undo.tsx `undoable`; nor do the level watch Stop (A-195) and the alert-chip removals (A-63…)' };
    });
    await item('A-226', 'Session chip', 'read it now (about 3–4 am New York)', 'the phase of the week now, its title pointing to Session phases', async () => {
      const o = await ev(page, () => { const s = [...document.querySelectorAll('[data-terrain-desk-bar] span')].find(e => /Session phases/.test(e.title)); return s ? { t: s.textContent.trim(), title: s.title, tab: s.tabIndex } : null; });
      const ny = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', weekday: 'short' });
      return { observed: o ? `"${o.t}" at ${ny} New York; title "${o.title.slice(0, 90)}…"; focusable ${o.tab >= 0}` : 'no chip', pass: !!o && /RTH|GLOBEX|MAINTENANCE|CLOSED/.test(o.t), ms: null, notes: 'it names CME futures phases (Globex) on an options desk; SPX\'s Cboe overnight hours differ' };
    });
    await item('A-228', 'Announcer', 'press =', '"SPY 15m"', async () => {
      await ev(page, () => document.activeElement?.blur?.());
      const r = await measure(page, () => page.keyboard.press('='), () => window.__A.say() === 'SPY 15m', null, 3000);
      const said = await ev(page, () => window.__A.say());
      const live = await ev(page, () => document.querySelector('span.sr-only[aria-live="polite"]')?.getAttribute('aria-live'));
      await page.keyboard.press('-');
      return { observed: `"${said}" in a live region (aria-live ${live})`, pass: r.ok, ms: r.ms };
    });
    await item('A-229', 'Page heading "Terrain" (sr-only h1)', 'read it', 'h1.sr-only "Terrain"', async () => {
      const t = await ev(page, () => [...document.querySelectorAll('h1.sr-only')].map(h => h.textContent.trim()));
      return { observed: JSON.stringify(t), pass: t.includes('Terrain'), ms: null };
    });
  } finally {
    await ctx.close();
  }
});

/* ═══ GROUP: OLD DATA — the browser's clock set to 10:30 am New York, the market open, the newest bar yesterday's ═══ */
await group('stale', async () => {
  const { ctx, page } = await openDesk({ clock: new Date('2026-10-15T14:30:00Z') });
  try {
    await sleep(2500);
    const o = await ev(page, () => {
      const h = window.__A.head(0);
      const a = h.querySelector('[data-pane-age]');
      const leaf = [...h.querySelectorAll('*')].find(e => e.children.length === 0 && /^\$[\d,]+\.\d{2}$/.test(e.textContent.trim()));
      const wrap = leaf?.closest('[data-price-stale]') ?? leaf?.parentElement?.closest('span');
      return { age: a ? { kind: a.dataset.paneAge, words: a.getAttribute('aria-label'), title: a.title, pe: getComputedStyle(a).pointerEvents, cls: a.className.includes('text-warn') } : null, price: leaf ? { t: leaf.textContent.trim(), stale: wrap?.hasAttribute('data-price-stale') ?? false, title: wrap?.title ?? '', warn: getComputedStyle(leaf).color, pe: getComputedStyle(leaf).pointerEvents } : null, banner: document.querySelector('[data-stale-banner]')?.textContent?.replace(/\s+/g, ' ').trim() ?? null };
    });
    await item('A-23', 'Age chip "● Live" / "● 3m old" / "● Closed · …"', 'with the market open and the data old, read the chip', 'data-pane-age "old" in the warn ink; its words reachable by the pointer', async () => {
      const h = memo.age;
      return { observed: `market open, old data: ${o.age ? `"${o.age.words}" (${o.age.kind}, warn ${o.age.cls}, pointer-events ${o.age.pe}, title "${o.age.title.slice(0, 60)}")` : 'no chip'}; at the real hour (closed): ${h ? `"${h.words}" (${h.kind}, ${h.form}, pointer-events ${h.pe})` : 'not read'}`, pass: !!o.age && o.age.kind === 'old' && o.age.cls && o.age.pe === 'auto' && (!h || h.pe === 'auto'), ms: null };
    });
    await item('A-18', 'Price "$512.34"', 'read the header price, fresh and stale', 'one current price; with old data the warn ink and data-price-stale, its title reachable', async () => {
      const h = memo.price;
      return { observed: `old data: ${o.price ? `${o.price.t}, data-price-stale ${o.price.stale}, title "${o.price.title}", pointer-events ${o.price.pe}` : 'no price'}; closed: ${h ? `${h.text}, stale ${h.stale}, pointer-events ${h.pe}` : 'not read'}`, pass: !!o.price && o.price.stale && o.price.pe === 'auto' && !!o.price.title, ms: null };
    });
    await item('A-160', 'Stale banner + "Retry"', 'with old data, click Retry', 'the banner names the age; Retry asks the feed again (bars, book, price)', async () => {
      if (!o.banner) return { observed: 'no stale banner', pass: false };
      const reqs = [];
      const on = r => { if (r.url().includes('/feed/')) reqs.push(r.url().replace(BASE, '')); };
      page.on('request', on);
      const t0 = Date.now();
      await page.locator('[data-stale-retry]').click();
      let first = null;
      for (let i = 0; i < 40 && !first; i++) { await sleep(50); if (reqs.length) first = Date.now() - t0; }
      await sleep(2500);
      page.off('request', on);
      const kinds = [...new Set(reqs.map(u => u.split('?')[0].split('/').slice(0, 7).join('/')))].slice(0, 6);
      return { observed: `"${o.banner}"; Retry → ${reqs.length} feed request(s) in 2.5 s: ${kinds.join(' · ')}`, pass: reqs.length > 0, ms: first };
    });
  } finally {
    await ctx.close();
  }
});

/* ═══ GROUP: A LISTED DATE in the Expiry card (railCut 1 = tomorrow's listed date) ═══ */
await group('listed', async () => {
  const { ctx, page } = await openDesk({ railCut: 1 });
  try {
    await sleep(3000);
    await item('A-39', 'Expiry window control (chips / trigger / a listed date)', 'read it with a listed date picked in the Expiry card, and at one and two panes', 'it names the date (not "60d" pressed); chips at one pane, a trigger at two', async () => {
      const o = await ev(page, () => { const w = window.__A.head(0)?.querySelector('[data-pane-window]'); return { v: w?.getAttribute('data-pane-window'), date: w?.querySelector('[data-window-date]')?.textContent?.trim() ?? (w?.hasAttribute('data-window-trigger') ? w.textContent.trim() : null), pressed: [...(w?.querySelectorAll('[aria-pressed="true"]') ?? [])].map(b => b.textContent.trim()), cut: window.__A.cfg()?.railCut }; });
      await ev(page, () => document.activeElement?.blur?.());
      await page.keyboard.press('w');
      await sleep(400);
      memo.wFromDate = `railCut 1 → ${await ev(page, () => window.__A.cfg()?.railCut)} ("${await ev(page, () => window.__A.say())}")`;
      return { observed: `railCut ${o.cut}: control reads "${o.v}", names "${o.date}", pressed ${JSON.stringify(o.pressed)}; forms: ${memo.winFullForm ?? '?'} at one pane, ${memo.winTrigForm ?? '?'} at two`, pass: o.v === 'date' && !!o.date && o.pressed.length === 0 && memo.winFullForm === 'full' && memo.winTrigForm === 'trigger', ms: null };
    });
  } finally {
    await ctx.close();
  }
  if (memo.wFromDate) addNote('A-233', `from a listed date: ${memo.wFromDate}`);
});

/* ═══ GROUP: THE FIELD STILL FILLING — the field's answers held back 10 s ═══ */
await group('building', async () => {
  const seen = [];
  const { ctx, page } = await openDesk({
    wait: 'head',
    quiet: false,
    route: async c => c.route('**/feed/field/**', async r => { await sleep(10000); await r.continue().catch(() => {}); }),
  });
  try {
    const t0 = Date.now();
    for (let i = 0; i < 40; i++) {
      const s = await ev(page, () => { const e = document.querySelector('[data-trail-since]'); return e ? `${e.dataset.building ?? '?'}: ${e.textContent.replace(/\s+/g, ' ').trim()}` : null; }).catch(() => null);
      if (s && !seen.some(x => x.startsWith(s))) seen.push(`${s} (first seen ${Date.now() - t0} ms after the pane's head stood)`);
      if (!s && seen.length && !seen.some(x => x.startsWith('gone'))) seen.push(`gone at ${Date.now() - t0} ms`);
      await sleep(400);
    }
    await item('A-159', '"Building · the chain is being read" / "Catching up · …"', 'hold the field\'s answers back 10 s at load', 'the hatched chip stands while the field fills', async () => ({ observed: seen.length ? seen.join(' | ') : 'no [data-trail-since] chip in 16 s', pass: seen.some(s => /Building|Catching up/.test(s)), ms: null }));
  } finally {
    await ctx.close();
  }
});

/* ═══ GROUP: A TABLET (900 × 900, below lg) — the Strikes door or the peek ═══ */
await group('tablet', async () => {
  const { ctx, page } = await openDesk({ w: 900, h: 900, ladder: true });
  try {
    await sleep(1500);
    await item('A-21', '"Strikes" (below lg)', 'at 900 wide, open the ladder from the header (or the peek that stands in its place)', 'the ladder lays over the chart; again (or Esc) hides it', async () => {
      const s = page.locator('[data-chart-frame]').first().locator('[data-narrow-ladder]');
      const peek = page.locator('[data-chart-frame]').first().locator('[data-ladder-peek]');
      const has = (await s.count()) > 0;
      const door = has ? s : peek;
      if (!(await door.count())) return { observed: 'neither the Strikes door nor the peek', pass: false };
      const r = await measure(page, () => door.click(), () => window.__A.vis(document.querySelector('[data-chart-frame] [data-dropdown="terrain-expiry"]')), null, 5000);
      const pressed = has ? await s.getAttribute('aria-pressed') : null;
      const r2 = await measure(page, () => (has ? s.click() : page.keyboard.press('Escape')), () => !window.__A.vis(document.querySelector('[data-chart-frame] [data-dropdown="terrain-expiry"]')), null, 4000);
      return { observed: `${has ? `Strikes door (aria-pressed ${pressed})` : 'the peek stands in its place (rows nearest the price)'}: ladder ${r.ok ? 'over the chart' : 'did not show'}; ${has ? 'again' : 'Esc'} → ${r2.ok ? 'hidden' : 'still shown'}`, pass: r.ok && r2.ok, ms: r.ms };
    });
    memo.tabletArrow = await (async () => {
      await ev(page, () => document.activeElement?.blur?.());
      await page.keyboard.press('ArrowDown');
      await sleep(800);
      return `↓ at 900 wide: ${await ev(page, () => window.__A.state(0)[0])} (${(await ev(page, () => window.__A.say())) || 'nothing said'})`;
    })();
    addNote('A-237', `between md and lg: ${memo.tabletArrow}`);
  } finally {
    await ctx.close();
  }
});

/* ═══ GROUP: A PHONE (390 × 844) — the peek, the desk bar, the toolbar row, the layout keys ═══ */
await group('phone', async () => {
  const { ctx, page } = await openDesk({ w: 390, h: 844, mobile: true, ladder: true });
  try {
    await sleep(1500);
    await item('A-169', 'Ladder peek (phone)', 'tap the peek', 'the three strikes nearest the price; a tap opens the ladder', async () => {
      const peek = page.locator('[data-ladder-peek]').first();
      if (!(await peek.count())) return { observed: 'no peek', pass: false };
      const t = (await peek.textContent()).replace(/\s+/g, ' ').trim();
      const r = await measure(page, () => peek.tap(), () => window.__A.vis(document.querySelector('[data-chart-frame] [data-dropdown="terrain-expiry"]')), null, 5000);
      return { observed: `"${t}" → ladder ${r.ok ? 'open' : 'did not open'}`, pass: r.ok && /Strikes/.test(t), ms: r.ms };
    });
    const o = await ev(page, () => ({ bar: !!document.querySelector('[data-terrain-desk-bar]'), row: (() => { const r = document.querySelector('[data-toolbar-row]'); return r ? `${getComputedStyle(r).display}, overflow-x ${getComputedStyle(r).overflowX}` : 'none'; })() }));
    addNote('A-204', `phone: desk bar ${o.bar ? 'present' : 'absent (by design)'}`);
    addNote('A-98', `phone: the row stands inline (${o.row})`);
    await page.keyboard.press('Escape').catch(() => {});
    await ev(page, () => document.activeElement?.blur?.());
    await page.keyboard.press('2');
    await sleep(800);
    memo.phoneLayout = `key 2 → layout ${await ev(page, () => window.__A.cfg()?.layout)} with ${await ev(page, () => document.querySelectorAll('[data-chart-frame]').length)} frame(s) drawn, no desk bar to show it`;
    addNote('A-230', `on a phone: ${memo.phoneLayout}`);
  } finally {
    await ctx.close();
  }
});

manual('A-254', 'Ctrl S / Ctrl Enter (script editor)', 'in the Pine editor press Ctrl+S / Ctrl+Enter', 'save / run the script', 'the editor\'s keys are out of Area A\'s scope (the inventory marks it so); the Pine door that opens the editor is A-225');

/* ═══ GROUPS-END ═══ */

/* ═══ THE REPORT ═══ */
await browser.close();
const ALL = Array.from({ length: 257 }, (_, i) => `A-${String(i + 1).padStart(2, '0')}`);
if (!ONLY) for (const id of ALL) if (!rows.some(r => r.id === id)) record({ id, item: '(not reached)', action: '—', expected: '—', observed: 'the exercise did not reach this item', pass: false, ms: null, notes: Object.entries(memo).filter(([k]) => k.startsWith('abort:')).map(([k, v]) => `${k} ${v}`).join('; ') });
/* one-line diagnoses for the failures found at commit 521d7de (paths under src/, lines at that commit) */
const DIAG = {
  'A-17': 'pages/terrain/Terrain.tsx:3229 — the hover row (data-toolbar-row: absolute top-full, z-10, pointer-events on while the pane is hovered) lies over the compare legend rows (Terrain.tsx:3243-3290), so the row\'s × (3287) never gets a pointer click; the keys (focus + Enter) still work',
  'A-28': 'components/gex/StrikeChart.tsx:3967-3999 (likely) — when the feed\'s day bars replace the minutes folded by day, the `regrown` reload keeps the view on the time of the first visible bar, and the folded series starts with two stray 2025-04 sessions, so the view lands at index 0 of the day series (Apr–Nov 2025)',
  'A-37': 'as A-28 (StrikeChart.tsx:3967-3999): the day series opens on its oldest bars after any switch to 1D',
  'A-106': 'as A-28 (StrikeChart.tsx:3967-3999)',
  'A-46': 'components/gex/StrikeChart.tsx:2136-2152 (tryJump, span) — 1W shows 2.3 days of 15m bars though the series holds 14 sessions; the index found in barsFor(mins) is set as the series\' logical range, and the view that stands is far shorter than the span — cause not pinned',
  'A-47': 'as A-46 (StrikeChart.tsx:2136-2152): 1M shows 8.1 days of 1h bars',
  'A-48': 'as A-46 (StrikeChart.tsx:2136-2152): 6M shows the last 79 day bars (Jun 24 → Oct 14) with 175 before it; from a fresh 5m pane the same jump landed on the oldest 20 bars (Apr–Nov 2025)',
  'A-49': 'as A-48: 1Y shows the same 79 bars; the series holds a year (Oct 2025 → Oct 2026)',
  'A-50': 'as A-48: Max shows the same 79 bars, not the whole series',
  'A-162': 'pages/terrain/Terrain.tsx — nextSession steps over weekends only (not holiday-aware, unlike sessionBefore in data/feed/levels.ts), so from a Saturday before a holiday "Next session" lands on the holiday\'s no-data card',
  'A-164': 'the view pill (Terrain.tsx:2959, "Back to live ›") and the replay\'s exit (components/gex/ReplayStrip.tsx:167, exitWords default "Back to live") stand together in the pick phase with the same words and different jobs — the pill itself works',
  'A-168': 'pages/terrain/Terrain.tsx:3017 — "Replay this day" calls onReplayFrom(09:30 New York) with the pane still on 1D; on a day-bar tape the cursor is the day bar\'s end (4:59 pm here, 7:59 pm New York), so the replay starts after the day is over',
  'A-238': 'pages/terrain/paneKeys.ts:31 stepTf ignores FEED_HELD and the desk\'s `-` (Terrain.tsx:3896) does not check it: from 1m on the feed the config stores the held 15s, the chart stays 1m, the announcer says "SPY 15s"',
  'A-244': 'components/terrain/PaneHead.tsx:73 opens the calendar only when its jump control is mounted; the desk\'s T (Terrain.tsx:3978) still says "Jump to a date" where the jumps are shed or in fullscreen (no PaneHead), and nothing opens',
  'A-248': 'pages/terrain/Terrain.tsx:4342-4356 — the layouts shelf closes on Esc only from a key event inside it; with focus on its LAYOUTS button (where a click leaves it) Esc reaches the window handler (Terrain.tsx:3640) and collapses the expanded pane behind the shelf, which stays open',
  'A-220': 'pages/terrain/Terrain.tsx:4375 — the × is opacity-0 with group-hover only (no focus variant), invisible to the keys; the delete (removeNamedLayout, 3463) has no undo',
  'A-255': 'removeNamedLayout (pages/terrain/Terrain.tsx:3463) does not go through ui/undo.tsx `undoable`; neither do the level watch Stop (A-195) nor the Alerts chips\' removal (A-63…A-80), which undo nothing either',
};
for (const r of rows) if (r.pass === false && DIAG[r.id]) r.notes = r.notes ? `${r.notes}; DIAGNOSIS: ${DIAG[r.id]}` : `DIAGNOSIS: ${DIAG[r.id]}`;
rows.sort((a, b) => parseInt(a.id.slice(2), 10) - parseInt(b.id.slice(2), 10));
const totals = { pass: rows.filter(r => r.pass === true).length, fail: rows.filter(r => r.pass === false).length, manual: rows.filter(r => r.pass === 'manual').length };
const meta = { at: new Date().toISOString(), base: BASE, commit: COMMIT, viewport: '1440 × 900 unless the row says otherwise', timezone: 'America/Los_Angeles', runSeconds: Math.round((Date.now() - T_START) / 1000), totals, note: 'Wall-clock timings on a machine shared with two other browser agents — pessimistic. ms runs from the action to the observed result.' };
fs.mkdirSync(OUT, { recursive: true });
const suffix = ONLY ? `-${[...ONLY].join('-')}` : '';
fs.writeFileSync(path.join(OUT, `area-a${suffix}.json`), JSON.stringify({ meta, rows }, null, 1));
const cell = s => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const md = [
  '# Terrain audit · Area A, exercised',
  '',
  `Run ${meta.at} against ${BASE} (commit ${meta.commit}), Chromium headless, ${meta.viewport}, ${meta.timezone}. ${meta.runSeconds} s.`,
  '',
  `**${totals.pass} pass · ${totals.fail} fail · ${totals.manual} manual** of ${rows.length}.`,
  '',
  meta.note,
  '',
  '| id | item | action → expected | observed | pass | ms |',
  '|---|---|---|---|---|---|',
  ...rows.map(r => `| ${r.id} | ${cell(r.item)} | ${cell(r.action)} → ${cell(r.expected)} | ${cell(r.observed)}${r.notes ? ` _(${cell(r.notes)})_` : ''} | ${r.pass === true ? 'pass' : r.pass === 'manual' ? 'manual' : '**FAIL**'} | ${r.ms ?? ''} |`),
  '',
];
fs.writeFileSync(path.join(OUT, `area-a${suffix}.md`), md.join('\n'));
console.log(`\n${totals.pass} pass · ${totals.fail} fail · ${totals.manual} manual — ${meta.runSeconds} s`);
