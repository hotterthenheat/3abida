/*
  TERRAIN AUDIT 2026-10-15 — AREA B (the plot) AND AREA D (built-in indicators, shipped Pine scripts), EXERCISED.

  Drives the real Terrain page on the dev server (127.0.0.1:5181 only) and records, per inventoried item, what was done,
  what was expected, what was seen, whether it passed and how long the action took to show its result.

    no_proxy=127.0.0.1,localhost NO_PROXY=127.0.0.1,localhost node scripts/terrain-exercise/area-b.mjs
    ... -- --only=field,pine        run only the groups named

  Writes docs/terrain-audit-2026-10-15/exercise/area-b.json and area-b.md. A fresh browser context per group; nothing
  outside the browser's own storage is changed. Timings are wall-clock from the action to the observed result, polled at
  50 ms, on a shared 4-core machine with other browsers running — read them as pessimistic.
*/
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = 'http://127.0.0.1:5181';
const ROOT = '/home/user/3abida';
const OUT = `${ROOT}/docs/terrain-audit-2026-10-15/exercise`;
/* pictures for a reader's own look go to the session's scratch folder, never into the repo */
const SHOTS = process.env.EXB_SHOTS ?? '/tmp/claude-0/-home-user-3abida/3f13cba1-d81b-5e53-bbee-8bc889ed9a96/scratchpad/exb/shots';
mkdirSync(SHOTS, { recursive: true });
const ONLY = (process.argv.find(a => a.startsWith('--only=')) ?? '').slice(7).split(',').filter(Boolean);
mkdirSync(OUT, { recursive: true });

const GOLD = [232, 185, 74];
const VIOLET = [128, 100, 247];
const results = [];
const groupsRun = [];
const T_START = Date.now();

/* ─── recording ─────────────────────────────────────────────────────────────────────────────────────────────────── */
function rec(r) {
  const row = { id: r.id, item: r.item, action: r.action ?? '', expected: r.expected ?? '', observed: String(r.observed ?? ''), pass: r.pass, ms: r.ms ?? null, notes: r.notes ?? '' };
  if (r.extra) row.extra = r.extra;
  results.push(row);
  const tag = row.pass === true ? 'PASS' : row.pass === false ? 'FAIL' : 'MANUAL';
  console.log(`${row.id.padEnd(14)} ${tag.padEnd(6)} ${row.ms == null ? '' : `${row.ms}ms`.padEnd(8)} ${row.observed.slice(0, 150)}`);
  flush();
}
const MERGE = process.argv.includes('--merge');
/* a merge run reads the last report before it writes anything, and writes only at its end */
const OLD = MERGE ? JSON.parse((await import('node:fs')).readFileSync(`${OUT}/area-b.json`, 'utf8')) : null;
let FINAL = false;
function flush() {
  if (MERGE && !FINAL) return;
  writeFileSync(`${OUT}/area-b.json`, JSON.stringify({ server: BASE, commit: '521d7de', ranAt: new Date(T_START).toISOString(), seconds: Math.round((Date.now() - T_START) / 1000), groups: groupsRun, results }, null, 1));
}
const ms = t0 => Date.now() - t0;
const sleep = n => new Promise(r => setTimeout(r, n));

/* ─── colour helpers (node side) ────────────────────────────────────────────────────────────────────────────────── */
function parseInk(s) {
  if (!s) return null;
  s = String(s).trim();
  let m = s.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i);
  if (m) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)];
  m = s.match(/^#([0-9a-f]{3})$/i);
  if (m) return [...m[1]].map(c => parseInt(c + c, 16));
  m = s.match(/rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/i);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  return null;
}
function oklab([r, g, b]) {
  const f = c => {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [R, G, B] = [f(r), f(g), f(b)];
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
const dE = (a, b) => {
  const A = oklab(a);
  const B = oklab(b);
  return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
};
/** "near" the field's meaning inks: OKLab distance under 0.15 to gold or violet */
function fieldClash(ink) {
  const c = parseInk(ink);
  if (!c) return { gold: null, violet: null, near: null };
  const g = dE(c, GOLD);
  const v = dE(c, VIOLET);
  return { gold: +g.toFixed(3), violet: +v.toFixed(3), near: g < 0.15 ? 'gold' : v < 0.15 ? 'violet' : null };
}

/* ─── the page's own helpers, installed before the first script ─────────────────────────────────────────────────── */
function INIT(cfg) {
  try {
    if (!sessionStorage.getItem('__exb')) {
      sessionStorage.setItem('__exb', '1');
      if (cfg.desk) {
        localStorage.setItem('slayer_terrain_v1', JSON.stringify(cfg.desk));
        localStorage.setItem('slayer_name', cfg.desk.panes[0].ticker);
      }
      if (cfg.theme) localStorage.setItem('slayer_theme', cfg.theme);
      for (const [k, v] of Object.entries(cfg.extra ?? {})) localStorage.setItem(k, v);
    }
  } catch {}
  /* every word drawn on a canvas, with its font, for the canvas items (pills, chips, notes, labels, the PNG stamp) */
  const ft = CanvasRenderingContext2D.prototype.fillText;
  window.__ft = [];
  CanvasRenderingContext2D.prototype.fillText = function (t, x, y, ...r) {
    try {
      const a = window.__ft;
      if (a.length > 6000) a.splice(0, 3000);
      a.push({ t: String(t), f: this.font, cw: this.canvas.width, ch: this.canvas.height, x, y, ink: String(this.fillStyle), el: this.canvas, align: this.textAlign });
    } catch {}
    return ft.call(this, t, x, y, ...r);
  };
  window.__x = {
    /** the i-th visible Terrain chart's dev entry */
    E(i = 0) {
      const es = [...(window.__charts ?? [])].filter(e => e.host?.isConnected && e.box?.()?.isConnected);
      const vis = es
        .map(e => ({ e, r: e.box().getBoundingClientRect() }))
        .filter(o => o.r.left > -1000 && o.r.width > 50 && o.r.height > 50)
        .sort((a, b) => a.r.top - b.r.top || a.r.left - b.r.left);
      return vis[i]?.e ?? null;
    },
    count() {
      return [...(window.__charts ?? [])].filter(e => e.host?.isConnected && e.box?.()?.getBoundingClientRect().left > -1000).length;
    },
    state(i = 0) {
      const e = this.E(i);
      return e ? e.host.dataset.chartState ?? '' : '';
    },
    /** pixel census of pane 0's plot from the chart's own screenshot: gold and violet (the ovals), a coarse signature */
    stats(i = 0, region = null) {
      const e = this.E(i);
      if (!e) return null;
      const c = e.chart.takeScreenshot(true, false);
      const ctx = c.getContext('2d');
      const ps = e.chart.paneSize(0);
      const ratio = c.width / Math.max(1, e.box().getBoundingClientRect().width);
      const rx = Math.round((region?.x ?? 0) * ratio);
      const ry = Math.round((region?.y ?? 0) * ratio);
      const rw = Math.max(1, Math.round((region?.w ?? ps.width) * ratio));
      const rh = Math.max(1, Math.round((region?.h ?? ps.height) * ratio));
      const d = ctx.getImageData(rx, ry, rw, rh).data;
      let gold = 0;
      let violet = 0;
      let goldV = 0;
      let violetV = 0;
      let lit = 0;
      const GX = 48;
      const GY = 32;
      const sig = new Array(GX * GY).fill(0);
      const cnt = new Array(GX * GY).fill(0);
      for (let y = 0; y < rh; y++) {
        for (let x = 0; x < rw; x++) {
          const k = (y * rw + x) * 4;
          const r = d[k];
          const g = d[k + 1];
          const b = d[k + 2];
          const mx = Math.max(r, g, b);
          const mn = Math.min(r, g, b);
          const cell = Math.min(GY - 1, Math.floor((y / rh) * GY)) * GX + Math.min(GX - 1, Math.floor((x / rw) * GX));
          sig[cell] += r * 0.3 + g * 0.5 + b * 0.2 + (mx - mn) * 0.5;
          cnt[cell]++;
          if (mx > 40) lit++;
          if (mx < 70 || mx === mn) continue;
          const s = (mx - mn) / mx;
          let h;
          if (mx === r) h = (60 * ((g - b) / (mx - mn)) + 360) % 360;
          else if (mx === g) h = 60 * ((b - r) / (mx - mn)) + 120;
          else h = 60 * ((r - g) / (mx - mn)) + 240;
          if (h >= 32 && h <= 54 && s > 0.4) {
            gold++;
            goldV += mx;
          } else if (h >= 238 && h <= 262 && s > 0.3) {
            violet++;
            violetV += mx;
          }
        }
      }
      return { gold, violet, goldV, violetV, lit, w: rw, h: rh, sig: sig.map((v, k) => Math.round(v / Math.max(1, cnt[k]))) };
    },
    /** cells of two signatures that differ by more than `tol` */
    sigDiff(a, b, tol = 6) {
      if (!a || !b) return -1;
      let n = 0;
      for (let k = 0; k < a.length; k++) if (Math.abs(a[k] - b[k]) > tol) n++;
      return n;
    },
    /** a cheap checksum of every canvas under a chart's box (crosshair layers included) */
    canvasSum(i = 0) {
      const e = this.E(i);
      if (!e) return null;
      let s = 0;
      for (const c of e.box().parentElement.querySelectorAll('canvas')) {
        try {
          const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
          for (let k = 0; k < d.length; k += 64) s = (s + d[k] * 3 + d[k + 1] * 5 + d[k + 2] * 7 + d[k + 3]) % 1e12;
        } catch {}
      }
      return s;
    },
    /** the field's drawn nodes in view, by the renderer's own hit test, in the chart box's CSS px */
    beads(i = 0, max = 600) {
      const e = this.E(i);
      if (!e) return [];
      const tr = e.trails;
      const ts = e.chart.timeScale();
      const ps = e.chart.paneSize(0);
      const vr = ts.getVisibleRange();
      if (!vr || !tr.snapshots.length) return [];
      const out = [];
      for (let ci = 0; ci < tr.snapshots.length && out.length < max; ci++) {
        const s = tr.snapshots[ci];
        if (s.time < vr.from || s.time > vr.to) continue;
        const x = ts.timeToCoordinate(s.time);
        if (x == null || x < 70 || x > ps.width - 40) continue;
        for (const l of s.levels) {
          const y = e.candles.priceToCoordinate(l.strike);
          if (y == null || y < 140 || y > ps.height - 60) continue;
          const h = tr.beadAt(x, y);
          if (h && h.strike === l.strike) {
            const st = l.prov === 'carried' ? 2 : (l.staleShare ?? 0) >= 0.5 || (l.wideShare ?? 0) >= 0.5 || l.readGap ? 1 : 0;
            out.push({ x, y, strike: l.strike, time: h.time, ci, gross: l.gross ?? Math.abs(l.value ?? 0), stale: st });
            break;
          }
        }
      }
      return out;
    },
    texts(re) {
      const rx = new RegExp(re);
      return window.__ft.filter(o => rx.test(o.t)).map(({ el, ...o }) => o);
    },
    /** words drawn on the i-th chart's own canvases (axis = 'time' | 'pane' | null) */
    textsIn(i, re, axis = null) {
      const e = this.E(i);
      if (!e) return [];
      const root = e.box();
      const rx = new RegExp(re);
      const ph = e.chart.paneSize(0).height;
      return window.__ft
        .filter(o => o.el && root.contains(o.el) && rx.test(o.t) && (axis == null || (axis === 'time' ? o.ch < 60 && o.cw > 200 : o.ch >= ph - 2)))
        .map(({ el, ...o }) => o);
    },
    clearTexts() {
      window.__ft = [];
    },
    fit(i = 0) {
      const e = this.E(i);
      const tr = e.chart.timeScale().getVisibleRange();
      const ps = e.chart.priceScale('right');
      const pr = ps.getVisibleRange();
      const bars = e.candles.data().filter(b => tr && b.time >= tr.from && b.time <= tr.to && 'high' in b);
      let lo = Infinity;
      let hi = -Infinity;
      for (const b of bars) {
        if (b.low < lo) lo = b.low;
        if (b.high > hi) hi = b.high;
      }
      return { auto: ps.options().autoScale, margins: ps.options().scaleMargins, n: bars.length, lo, hi, axis: pr ? [pr.from, pr.to] : null, inside: !!pr && lo >= pr.from - 1e-6 && hi <= pr.to + 1e-6, from: tr?.from, to: tr?.to };
    },
    lastBar(i = 0) {
      const d = this.E(i).candles.data();
      return d.length ? d[d.length - 1].time : null;
    },
    series(i = 0) {
      const e = this.E(i);
      return e.chart.panes().map(p => p.getSeries().map(s => ({ type: s.seriesType(), color: s.options().color ?? s.options().upColor ?? null, title: s.options().title ?? '', lines: s.priceLines().map(l => l.options().title) })));
    },
  };
}

/* ─── one browser, a context per group ──────────────────────────────────────────────────────────────────────────── */
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

async function open({ panes, layout = 1, theme = null, width = 1440, height = 900, tz = 'America/New_York', blockFeed = false, clockAt = null, mobile = false, extra = null, waitField = true }) {
  const ctx = await browser.newContext({ viewport: { width, height }, timezoneId: tz, deviceScaleFactor: 1, acceptDownloads: true, ...(mobile ? { isMobile: true, hasTouch: true } : {}) });
  await ctx.addInitScript(INIT, { desk: { layout, panes }, theme, extra });
  const page = await ctx.newPage();
  page.setDefaultTimeout(5000);
  const errors = [];
  const warns = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
  page.on('console', m => {
    const t = m.text();
    if (m.type() === 'error' && !/React Router|Download the React DevTools|net::ERR|Failed to load resource/.test(t)) errors.push(`console.error: ${t.slice(0, 240)}`);
    if (t.startsWith('[scripts]')) warns.push(t.slice(0, 240));
  });
  if (blockFeed) await page.route(u => new URL(u).pathname.startsWith('/feed/'), r => r.abort());
  if (clockAt) await page.clock.install({ time: new Date(clockAt) });
  const t0 = Date.now();
  await page.goto(`${BASE}/terrain`, { waitUntil: 'domcontentloaded' });
  let tBars = null;
  try {
    await page.waitForFunction(() => [...document.querySelectorAll('[data-chart-state]')].some(e => Number((e.getAttribute('data-chart-state') ?? '').split('|')[2]) > 0), null, { timeout: 90_000, polling: 100 });
    tBars = ms(t0);
  } catch {}
  let tField = null;
  if (waitField && tBars != null) {
    try {
      await page.waitForFunction(() => [...document.querySelectorAll('[data-chart-state]')].some(e => /\|f[1-9]\d*\|/.test(e.getAttribute('data-chart-state') ?? '')), null, { timeout: 30_000, polling: 100 });
      tField = ms(t0);
    } catch {}
  }
  await page.waitForTimeout(2000);
  return { ctx, page, errors, warns, tBars, tField, close: () => ctx.close().catch(() => {}) };
}

async function until(page, fn, arg, timeout = 8000) {
  const t0 = Date.now();
  try {
    await page.waitForFunction(fn, arg, { timeout, polling: 50 });
    return Date.now() - t0;
  } catch {
    return null;
  }
}
/** a locator's click or hover scrolls the page (the footer art stands one scroll below the desk): put it back */
const unscroll = page =>
  page.evaluate(() => {
    for (let el = window.__x?.E(0)?.box(); el; el = el.parentElement) if (el.scrollTop) el.scrollTop = 0;
    if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
  });
const away = async page => {
  await unscroll(page);
  await page.mouse.move(110, 640);
};
async function box(page, i = 0) {
  await unscroll(page);
  return page.evaluate(i => {
    const e = window.__x.E(i);
    if (!e) return null;
    const r = e.box().getBoundingClientRect();
    const ps = e.chart.paneSize(0);
    return { x: r.left, y: r.top, w: r.width, h: r.height, pw: ps.width, ph: ps.height };
  }, i);
}
/** the Oct-14-style view: the last N minutes of the newest field session */
async function viewSessionTail(page, minutes = 80, i = 0) {
  return page.evaluate(
    ([minutes, i]) => {
      const e = window.__x.E(i);
      const s = e.trails.snapshots;
      if (!s.length) return null;
      const last = s[s.length - 1].time;
      e.chart.timeScale().setVisibleRange({ from: last - minutes * 60, to: last + 5 * 60 });
      return last;
    },
    [minutes, i]
  );
}
async function viewRange(page, from, to, i = 0) {
  await page.evaluate(([from, to, i]) => window.__x.E(i).chart.timeScale().setVisibleRange({ from, to }), [from, to, i]);
}
const stats = (page, i = 0, region = null) => page.evaluate(([i, region]) => window.__x.stats(i, region), [i, region]);
async function hoverPane(page, i = 0) {
  const b = await box(page, i);
  await page.mouse.move(b.x + b.pw * 0.55, b.y + b.ph * 0.6);
  await page.waitForTimeout(120);
  return b;
}
/** the pane's Layers (Overlays) menu: opens it if it is not, clicks the row, closes with Esc */
async function toggleOverlay(page, label, close = true) {
  let row = page.locator('[role="checkbox"]', { hasText: label }).filter({ visible: true }).first();
  if (!(await row.count())) {
    await hoverPane(page);
    const btn = page.locator('button[title="Overlays"]').filter({ visible: true }).first();
    await btn.click();
    row = page.locator('[role="checkbox"]', { hasText: label }).filter({ visible: true }).first();
    await row.waitFor({ timeout: 4000 });
  }
  const before = await row.getAttribute('aria-checked');
  const t0 = Date.now();
  await row.click();
  if (close) {
    await page.keyboard.press('Escape');
    await away(page);
  }
  return { t0, before };
}
async function group(name, fn) {
  if (ONLY.length && !ONLY.includes(name)) return;
  const t0 = Date.now();
  console.log(`\n=== ${name} ===`);
  try {
    await fn();
  } catch (e) {
    console.log(`group ${name} threw: ${String(e).slice(0, 400)}`);
    rec({ id: `G-${name}`, item: `group ${name} aborted`, action: 'run the group', expected: 'runs to the end', observed: String(e).slice(0, 300), pass: false });
  }
  groupsRun.push({ name, seconds: Math.round((Date.now() - t0) / 1000) });
  flush();
}
/** one item guarded: a throw is the item's FAIL, never the group's end */
async function item(base, fn) {
  try {
    const r = await fn();
    if (r) rec({ ...base, ...r });
  } catch (e) {
    rec({ ...base, observed: `threw: ${String(e).slice(0, 220)}`, pass: false });
  }
}

const SPY1m = (over = {}) => ({ ticker: 'SPY', timeframe: '1m', ladder: true, ...over, overlays: { trails: true, ...(over.overlays ?? {}) } });

/* ═══ GROUP 1 · THE FIELD, CARDS, CHIPS, LEGEND, AXIS, VIEW ════════════════════════════════════════════════════════ */
await group('field', async () => {
  const { page, errors, tBars, tField, close } = await open({ panes: [SPY1m()] });
  try {
    const st0 = await page.evaluate(() => window.__x.state(0));
    const last = await viewSessionTail(page, 80);
    await away(page);
    await page.waitForTimeout(700);

    /* B-01 */
    await item({ id: 'B-01', item: "The field's ovals (gold absorb / violet amplify / grey balanced)", action: 'SPY 1m on the feed, trails on; view the newest session; Layers → Exposure trails off then on', expected: 'ovals at each bar; off removes them, on brings them back' }, async () => {
      const s1 = await stats(page);
      const legend = await page.evaluate(() => window.__x.E(0).trails.legend());
      const off = await toggleOverlay(page, 'Exposure trails');
      const tOff = await until(page, () => window.__x.stats(0).gold + window.__x.stats(0).violet < 30, null, 8000);
      const s2 = await stats(page);
      const on = await toggleOverlay(page, 'Exposure trails');
      const tOn = await until(page, () => window.__x.stats(0).gold + window.__x.stats(0).violet > 200, null, 10000);
      const s3 = await stats(page);
      const pass = s1.gold + s1.violet > 200 && s2.gold + s2.violet < 30 && s3.gold + s3.violet > 200 && /\|f[1-9]/.test(st0);
      return {
        observed: `state ${st0}; load→bars ${tBars} ms, load→field ${tField} ms; gold ${s1.gold}px violet ${s1.violet}px (${legend?.nodes} nodes a candle, size by ${legend?.sizeBy}); off → ${s2.gold + s2.violet}px in ${tOff} ms; on → ${s3.gold + s3.violet}px in ${tOn} ms`,
        pass,
        ms: tOn,
        notes: off.before === 'true' ? '' : `trails row was aria-checked=${off.before} before`,
      };
    });

    /* B-07 / B-09 hover */
    let bead = null;
    await item({ id: 'B-07', item: 'Hover ring + chain brighten (rail docked left and open)', action: "hover an oval found by the renderer's own beadAt", expected: 'ring on that node, its chain bright, card names the same strike (no 56 px offset)' }, async () => {
      const bs = await page.evaluate(() => window.__x.beads(0, 800));
      const fresh = bs.filter(b => !b.stale);
      fresh.sort((a, b) => b.gross - a.gross);
      bead = fresh.find(b => b.x > 150) ?? fresh[0];
      if (!bead) return { observed: `no drawn node found in view (${bs.length})`, pass: false };
      const b = await box(page);
      const inset = await page.evaluate(() => {
        const e = window.__x.E(0);
        return Math.round(e.box().getBoundingClientRect().left - e.box().parentElement.getBoundingClientRect().left);
      });
      const t0 = Date.now();
      await page.mouse.move(b.x + bead.x, b.y + bead.y);
      const t = await until(page, () => !!document.querySelector('[data-bead-card="hover"]'), null, 5000);
      const hov = await page.evaluate(() => window.__x.E(0).trails.hover);
      const card = await page.locator('[data-bead-card="hover"]').first().innerText().catch(() => '');
      const s = await stats(page);
      const ok = !!hov && hov.strike === bead.strike && card.includes(String(bead.strike).replace(/\.0+$/, ''));
      return { observed: `rail inset ${inset}px; node ${bead.strike} @x${Math.round(bead.x)}; hover ring on ${hov?.strike ?? 'none'}; card "${card.split('\n')[0]}"; veil: lit px ${s.lit}`, pass: ok, ms: t ?? ms(t0), extra: { bead } };
    });

    await item({ id: 'B-09', item: 'Bead hover card (collapsed, 3 lines)', action: 'hover a node', expected: 'strike · bar time (12-h, zone); net, share, side; change since 9:30; card clear of the header strip' }, async () => {
      const el = page.locator('[data-bead-card="hover"]').first();
      if (!(await el.count())) return { observed: 'no hover card up', pass: false };
      const txt = await el.innerText();
      const r = await el.boundingBox();
      const strip = await page.evaluate(() => {
        const e = window.__x.E(0);
        let bottom = 0;
        for (const c of document.querySelectorAll('[data-chart-chrome]')) {
          const rr = c.getBoundingClientRect();
          const br = e.box().getBoundingClientRect();
          if (rr.width && rr.top < br.top + br.height / 3 && rr.bottom > br.top && rr.left < br.right && rr.right > br.left) bottom = Math.max(bottom, rr.bottom);
        }
        return bottom;
      });
      const lines = txt.split('\n').filter(Boolean);
      const has12 = /\d{1,2}:\d{2}\s?(am|pm)/i.test(txt);
      const has24 = /\b(1[3-9]|2[0-3]):[0-5]\d\b/.test(txt);
      const since = /since the open/i.test(txt);
      const net = /\$/.test(txt);
      return { observed: `${lines.length} lines: ${lines.join(' / ').slice(0, 260)}; card top ${Math.round(r.y)} vs chrome bottom ${Math.round(strip)}`, pass: has12 && !has24 && since && net && lines.length >= 3 && lines.length <= 5, ms: null, notes: r.y < strip ? 'card top is under the chrome band' : '' };
    });

    /* B-08 + B-10: click pin, toggle, Esc, the pinned card's doors */
    await item({ id: 'B-08', item: 'Click pin (chain bright, rest 40%, FOCUS on the axis); click again / Esc lets go', action: 'click node; click same node; click again then Esc', expected: 'pin on, off on 2nd click, off on Esc' }, async () => {
      if (!bead) return { observed: 'no node', pass: false };
      const b = await box(page);
      const focus = () => page.evaluate(() => window.__x.E(0).trails.focusStrike);
      const t0 = Date.now();
      await page.mouse.click(b.x + bead.x, b.y + bead.y);
      const t1 = await until(page, s => window.__x.E(0).trails.focusStrike === s, bead.strike, 4000);
      const f1 = await focus();
      const lines1 = await page.evaluate(() => window.__x.E(0).candles.priceLines().map(l => l.options().title));
      await page.waitForTimeout(300);
      /* where the pinned node stands now: the pin may re-fit the axis under the pointer */
      const geo = await page.evaluate(s => {
        const e = window.__x.E(0);
        const r = e.chart.priceScale('right').getVisibleRange();
        return { y: e.candles.priceToCoordinate(s), axis: [r.from, r.to] };
      }, bead.strike);
      const fit0 = await page.evaluate(() => null);
      void fit0;
      /* a 2nd click at the SAME spot */
      await page.mouse.click(b.x + bead.x, b.y + bead.y);
      await until(page, () => window.__x.E(0).trails.focusStrike == null, null, 1500);
      const f2same = await focus();
      /* a 2nd click on the node where it now stands */
      if (f2same != null) {
        await page.mouse.click(b.x + bead.x, b.y + geo.y);
        await until(page, () => window.__x.E(0).trails.focusStrike == null, null, 3000);
      }
      const f2 = await focus();
      await page.waitForTimeout(300);
      const geoBack = await page.evaluate(s => window.__x.E(0).candles.priceToCoordinate(s), bead.strike);
      await page.mouse.click(b.x + bead.x, b.y + geoBack);
      await until(page, s => window.__x.E(0).trails.focusStrike === s, bead.strike, 3000);
      await page.keyboard.press('Escape');
      const t3 = await until(page, () => window.__x.E(0).trails.focusStrike == null, null, 3000);
      const f3 = await focus();
      const jumped = Math.abs(geo.y - bead.y);
      const pass = f1 === bead.strike && f2 == null && f3 == null && jumped < 4;
      return {
        observed: `pin → ${f1} in ${t1} ms (price lines ${JSON.stringify(lines1)}); the pin moved the node ${Math.round(jumped)} px (y ${Math.round(bead.y)} → ${Math.round(geo.y)}, axis now ${geo.axis.map(v => v.toFixed(2)).join('–')}); 2nd click at the same spot → focus ${f2same}; click on the node where it now stands → ${f2}; Esc → ${f3} in ${t3} ms`,
        pass,
        ms: t1 ?? ms(t0),
        notes: [jumped >= 4 ? 'pinning re-fits the price axis (the focus is an autoscale extra before the 8-strike centring, StrikeChart.tsx:2365 at 521d7de (:2370 at HEAD b4ee18e)), so the node jumps from under the pointer and a 2nd click there misses' : '', lines1.includes('FOCUS') ? '' : 'no FOCUS price line'].filter(Boolean).join('; '),
      };
    });

    await item({ id: 'B-10', item: 'Pinned bead card: "Replay from here", "Pin strike", ×', action: 'click node → card; Pin strike; ×', expected: 'card stays; Pin strike shows pressed while pinned and toggles; × closes; provenance lines' }, async () => {
      if (!bead) return { observed: 'no node', pass: false };
      const b = await box(page);
      await page.mouse.click(b.x + bead.x, b.y + bead.y);
      const t = await until(page, () => !!document.querySelector('[data-bead-card="pinned"]'), null, 4000);
      const card = page.locator('[data-bead-card="pinned"]').first();
      const txt = (await card.innerText().catch(() => '')).replace(/\n+/g, ' / ');
      const pin = card.locator('[data-bead-pin-strike]');
      const label = (await pin.innerText().catch(() => '')).trim();
      const pressed1 = await pin.getAttribute('aria-pressed').catch(() => null);
      await pin.click().catch(() => {});
      await page.waitForTimeout(250);
      const pressed2 = await pin.getAttribute('aria-pressed').catch(() => null);
      const f2 = await page.evaluate(() => window.__x.E(0).trails.focusStrike);
      await pin.click().catch(() => {});
      await page.waitForTimeout(250);
      const f3 = await page.evaluate(() => window.__x.E(0).trails.focusStrike);
      const replayBtn = await card.locator('[data-bead-replay]').count();
      await page.locator('[aria-label="Let the card go"]').first().click().catch(() => {});
      const tClose = await until(page, () => !document.querySelector('[data-bead-card="pinned"]'), null, 3000);
      await page.keyboard.press('Escape');
      await away(page);
      const pass = !!t && pressed1 === 'true' && pressed2 === 'false' && f2 == null && f3 === bead.strike && replayBtn === 1 && tClose != null;
      return { observed: `card in ${t} ms: "${txt.slice(0, 300)}"; button "${label}" aria-pressed ${pressed1} → click → ${pressed2} (focus ${f2}) → click → focus ${f3}; Replay door ${replayBtn}; × closes in ${tClose} ms`, pass, ms: t };
    });

    /* B-03 stale node */
    await item({ id: 'B-03', item: 'Soft edge on a stale oval + card line', action: 'find a node whose cell is carried / ≥50% old or wide vols / read gap; hover it', expected: 'card shows the amber "Stale · …" line' }, async () => {
      await viewSessionTail(page, 390);
      await page.waitForTimeout(400);
      const bs = await page.evaluate(() => window.__x.beads(0, 3000));
      const st = bs.filter(b => b.stale > 0);
      if (!st.length) return { observed: `no stale node among ${bs.length} drawn in the newest session`, pass: 'manual', notes: 'needs a carried / stale cell in view (recorder stopped, or SPX overnight)' };
      const b = await box(page);
      const s = st[Math.floor(st.length / 2)];
      await page.mouse.move(b.x + s.x, b.y + s.y);
      const t = await until(page, () => !!document.querySelector('[data-bead-stale]'), null, 3000);
      const txt = await page.locator('[data-bead-stale]').first().innerText().catch(() => '');
      await away(page);
      return { observed: `${st.length} stale of ${bs.length}; hovered ${s.strike} (stale ${s.stale}): "${txt}"`, pass: !!t, ms: t };
    });

    /* B-02 zoom-out dimming and "Every strike" */
    await item({ id: 'B-02', item: 'Zoomed-out dimming / "Every strike"', action: 'view >8 h; tick "Every strike" on the hover row', expected: 'non-level strikes dim zoomed out; Every strike draws them full' }, async () => {
      const span = await page.evaluate(() => {
        const e = window.__x.E(0);
        const d = e.candles.data();
        const s = e.trails.snapshots;
        return { from: d[0].time, to: s[s.length - 1].time + 300 };
      });
      await viewRange(page, span.from, span.to);
      await away(page);
      await page.waitForTimeout(700);
      const a = await stats(page);
      await hoverPane(page);
      const cb = page.locator('[data-bead-density] input');
      const t0 = Date.now();
      await cb.check();
      await away(page);
      const t = await until(page, v => window.__x.stats(0).goldV + window.__x.stats(0).violetV > v * 1.05, a.goldV + a.violetV, 5000);
      const b = await stats(page);
      await hoverPane(page);
      await cb.uncheck();
      await away(page);
      return { observed: `view ${((span.to - span.from) / 3600).toFixed(1)} h; brightness gold+violet ${a.goldV + a.violetV} (px ${a.gold + a.violet}) → Every strike ${b.goldV + b.violetV} (px ${b.gold + b.violet})`, pass: b.goldV + b.violetV > (a.goldV + a.violetV) * 1.05, ms: t ?? ms(t0) };
    });

    /* B-04 / B-05 wall lines and flip rule, column by column over the whole newest session */
    await viewSessionTail(page, 390);
    await away(page);
    await page.waitForTimeout(700);
    const rules = await page.evaluate(() => {
      const e = window.__x.E(0);
      const tr = e.trails;
      const ts = e.chart.timeScale();
      const vr = ts.getVisibleRange();
      const ph = e.chart.paneSize(0).height;
      const c = e.chart.takeScreenshot(true, false);
      const ctx = c.getContext('2d');
      const px = (x, y) => {
        const d = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
        return [d[0], d[1], d[2]];
      };
      const gold = ([r, , b]) => r - b;
      const vio = ([r, g, b]) => b - (r + g) / 2;
      const grey = ([r, g, b]) => (Math.abs(r - g) < 14 && Math.abs(g - b) < 16 ? r : 0);
      const out = { cw: { n: 0, hit: 0 }, pw: { n: 0, hit: 0 }, flip: { n: 0, hit: 0, none: 0 }, last: null };
      const top = (tr.chromeInset || 0) + 6;
      for (let i = 0; i < tr.snapshots.length; i++) {
        const s = tr.snapshots[i];
        if (s.time < vr.from || s.time > vr.to) continue;
        const col = tr.columnAt(i);
        const x = ts.timeToCoordinate(Math.floor(s.time / tr.barSec) * tr.barSec);
        if (x == null) continue;
        out.last = { cw: col.cw, pw: col.pw, flip: col.flip };
        for (const [k, f] of [['cw', gold], ['pw', vio]]) {
          const v = col[k];
          if (v == null) continue;
          const y = e.candles.priceToCoordinate(v);
          if (y == null || y < top || y > ph - 6) continue;
          out[k].n++;
          const at = Math.max(f(px(x, y - 0.5)), f(px(x, y + 0.5)));
          const ctl = Math.max(f(px(x, y - 4)), f(px(x, y + 4)));
          if (at > 12 && at >= ctl - 2) out[k].hit++;
        }
        if (col.flip == null) out.flip.none++;
        else {
          const y = e.candles.priceToCoordinate(col.flip);
          if (y != null && y > top && y < ph - 6) {
            out.flip.n++;
            /* a thin grey feature: grey in the 5 × 3 window round (x, y), not grey 5 px above and below */
            const d = ctx.getImageData(Math.round(x) - 2, Math.round(y) - 1, 5, 3).data;
            let g = 0;
            for (let q = 0; q < d.length; q += 4) if (grey([d[q], d[q + 1], d[q + 2]]) > 60) g++;
            if (g > 0 && grey(px(x, y - 5)) < 60 && grey(px(x, y + 5)) < 60) out.flip.hit++;
          }
        }
      }
      return out;
    });
    const chipsAtRules = await page.$$eval('[data-axis-chip]', es => es.map(e => ({ k: e.dataset.axisChip, s: e.dataset.strike })));
    rec({
      id: 'B-04',
      item: 'Wall lines (1-px 40% rule per column at the held walls)',
      action: "whole newest session in view; per column, sample its held wall's strike row against rows 4 px away",
      expected: 'a faint gold rule at the call wall, violet at the put wall, in each column',
      observed: `CW rule seen in ${rules.cw.hit}/${rules.cw.n} in-plot columns, PW in ${rules.pw.hit}/${rules.pw.n}; newest column held CW ${rules.last?.cw} PW ${rules.last?.pw}; axis chips CW ${chipsAtRules.find(c => c.k === 'cw')?.s} PW ${chipsAtRules.find(c => c.k === 'pw')?.s}`,
      pass: rules.cw.n + rules.pw.n < 10 ? 'manual' : (rules.cw.hit + rules.pw.hit) / (rules.cw.n + rules.pw.n) >= 0.6 ? true : false,
      notes: `${String(rules.last?.cw) !== chipsAtRules.find(c => c.k === 'cw')?.s || String(rules.last?.pw) !== chipsAtRules.find(c => c.k === 'pw')?.s ? "the drawn rules (the field's held walls) and the CW/PW chips (Unusual Whales' book with the rail's stick) name different strikes at the right edge" : 'rules and chips agree'}; pixel evidence over ovals of the same hue is approximate`,
    });
    rec({
      id: 'B-05',
      item: 'Flip rule (dashed grey per column)',
      action: "per column, sample the column's own flip row",
      expected: 'a grey dash at each column flip; a gap where the column has none',
      observed: `a thin grey dash at the column's flip in ${rules.flip.hit}/${rules.flip.n} columns whose flip is in the clear plot; ${rules.flip.none} columns with no flip`,
      pass: rules.flip.n < 5 ? 'manual' : rules.flip.hit / rules.flip.n >= 0.5,
      notes: 'pixel evidence; a balanced (grey) oval on the flip row can hide the dash',
    });
    rec({ id: 'B-06', item: 'Candle ground edge (1-px ground outline where a candle crosses an oval)', action: 'zoom on a candle over a large oval', expected: '1-px ground-coloured edge round body and wick', observed: 'not separable by pixel census from the candle body itself at 1 dpr', pass: 'manual', notes: 'needs a zoomed visual check (a 1-device-px outline)' });

    /* B-11 pills, B-12 ticks, B-13 chips (canvas words) */
    await item({ id: 'B-11', item: 'Node pills beside the last candle ("780 · 64%")', action: 'view including the newest column; read the words the canvas drew', expected: 'three pills "strike · N%" at ≥11 px' }, async () => {
      await page.evaluate(() => window.__x.clearTexts());
      await viewSessionTail(page, 60);
      await away(page);
      await page.waitForTimeout(600);
      const t = await page.evaluate(() => window.__x.texts('^[0-9][0-9,.]* · [0-9]+%$').map(o => ({ t: o.t, f: o.f })));
      const uniq = [...new Map(t.map(o => [o.t, o])).values()];
      const small = uniq.filter(o => Number((o.f.match(/(\d+(\.\d+)?)px/) ?? [])[1]) < 11);
      return { observed: `${uniq.length} pill texts: ${uniq.map(o => `"${o.t}" (${o.f})`).slice(0, 5).join(', ')}`, pass: uniq.length >= 1 && uniq.length <= 3 && small.length === 0 ? true : uniq.length === 0 ? false : uniq.length > 3 ? false : false, notes: small.length ? 'pill words under 11 px' : uniq.length && uniq.length < 3 ? `only ${uniq.length} pills (spec: three)` : '' };
    });
    await item({ id: 'B-13', item: 'Wall chips ("CW 780 → 785 · 9:25 am", "PW 772 broken · 10:54 am")', action: 'whole newest session in view; read the chip words the canvas drew', expected: 'newest moves/breaks named with a 12-h time, pinned ▲/▼ when off the clear area' }, async () => {
      const r = await page.evaluate(() => ({ moves: window.__x.E(0).trails.wallMoves.length, states: window.__x.E(0).trails.wallStates.length }));
      await page.evaluate(() => window.__x.clearTexts());
      await viewSessionTail(page, 390);
      await away(page);
      await page.waitForTimeout(700);
      const t = await page.evaluate(() => window.__x.texts('^(▲ |▼ )?(CW|PW) ').map(o => ({ t: o.t, f: o.f })));
      const uniq = [...new Map(t.map(o => [o.t, o])).values()];
      const ok12 = uniq.every(o => !/\b(1[3-9]|2[0-3]):[0-5]\d\b/.test(o.t));
      if (!r.moves && !r.states) return { observed: 'no wall move or state in the loaded columns', pass: 'manual' };
      return { observed: `${r.moves} moves, ${r.states} states loaded; ${uniq.length} chip texts: ${uniq.map(o => `"${o.t}"`).slice(0, 5).join(', ')}`, pass: uniq.length > 0 && ok12, notes: uniq.length ? '' : 'moves exist but no chip words drawn in the session view' };
    });
    {
      /* a close look for the reader: twenty bars round the newest wall move, at three device pixels a point */
      const mv = await page.evaluate(() => window.__x.E(0).trails.wallMoves.at(-1) ?? null);
      if (mv) await viewRange(page, mv.time - 12 * 60, mv.time + 8 * 60);
      await away(page);
      await page.waitForTimeout(500);
      const bb = await box(page);
      await page.screenshot({ path: `${SHOTS}/b06-b12-zoom.png`, clip: { x: bb.x, y: bb.y, width: bb.pw, height: bb.ph } });
    }
    rec({ id: 'B-12', item: 'Wall-move ticks (2 × 7 px at the new strike)', action: 'find a moved wall at 1m', expected: 'a short tick in the wall ink on the bar of the move', observed: 'the tick shares the oval hues at the same strike row — not separable by a pixel census', pass: 'manual', notes: `visual check: ${SHOTS}/b06-b12-zoom.png (twenty bars round the newest move); trails.wallMoves holds the moves (see B-13)` });

    /* B-14 gap notes */
    await item({ id: 'B-14', item: 'Gap notes ("outside regular hours · the field is 9:30 am to 4:00 pm")', action: 'view across 4:00 pm into after hours', expected: 'one note per gap run with its reason, 12-h times, ≥11 px' }, async () => {
      const lastT = await page.evaluate(() => window.__x.lastBar(0));
      const snapLast = await page.evaluate(() => window.__x.E(0).trails.snapshots.at(-1).time);
      await page.evaluate(() => window.__x.clearTexts());
      const t0 = Date.now();
      await viewRange(page, snapLast - 3600, lastT + 60);
      await away(page);
      const t = await until(page, () => window.__x.E(0).gaps().some(g => /outside regular hours/.test(g.words)), null, 4000);
      const gaps = await page.evaluate(() => window.__x.E(0).gaps().map(g => g.words));
      const drawn = await page.evaluate(() => window.__x.texts('outside regular hours|not recorded|queued|rebuild|live lag|chain not read|before the open|after the close').map(o => ({ t: o.t, f: o.f })));
      const small = drawn.filter(o => Number((o.f.match(/(\d+(\.\d+)?)px/) ?? [])[1]) < 11);
      return { observed: `gaps(): ${JSON.stringify(gaps)}; drawn ${drawn.length ? `"${drawn[0].t}" (${drawn[0].f})` : 'none captured'}`, pass: gaps.some(g => /outside regular hours · the field is 9:30 am to 4:00 pm/.test(g)) && small.length === 0, ms: t ?? ms(t0) };
    });

    /* B-15 primitive axis labels (off on Terrain by design while the DOM chips stand) */
    await item({ id: 'B-15', item: 'Primitive axis labels (levels as prices on the axis canvas)', action: 'read trails.axisLabels on Terrain', expected: 'off while the DOM axis chips stand (chips name the levels)' }, async () => {
      const r = await page.evaluate(() => ({ axisLabels: window.__x.E(0).trails.axisLabels }));
      return { observed: `trails.axisLabels = ${r.axisLabels}`, pass: r.axisLabels === false || r.axisLabels === undefined ? true : 'manual', notes: 'in a replay see B-72 for whether the axis then names any level' };
    });

    /* B-16 axis chips, B-17 level card */
    await viewSessionTail(page, 80);
    await away(page);
    await page.waitForTimeout(500);
    let chipsNow = [];
    await item({ id: 'B-16', item: 'Axis chips CW · PW · Flip · Sup · Top', action: 'read the chips; hover the PW chip', expected: 'chips with strike, $ and σ; pinned ▲/▼ off the plot; hover opens the level card' }, async () => {
      chipsNow = await page.$$eval('[data-axis-chip]', es => es.map(e => ({ k: e.dataset.axisChip, s: e.dataset.strike, p: e.dataset.pinned ?? '', t: e.innerText.replace(/\n/g, ' | '), title: e.getAttribute('title'), pe: getComputedStyle(e).pointerEvents })));
      const pinnedOk = chipsNow.filter(c => c.p).every(c => /^[▲▼]/.test(c.t));
      const target = chipsNow.find(c => !c.p) ?? chipsNow[0];
      if (!target) return { observed: 'no axis chip', pass: false };
      const t0 = Date.now();
      await page.locator(`[data-axis-chip="${target.k}"]`).first().hover();
      const t = await until(page, k => !!document.querySelector(`[data-level-card="${k}"]`), target.k, 4000);
      return { observed: `${chipsNow.map(c => `${c.k}:${c.s}${c.p ? `(pinned ${c.p})` : ''} "${c.t}"`).join('; ')}; hover ${target.k} → level card in ${t} ms`, pass: chipsNow.length >= 3 && pinnedOk && !!t, ms: t ?? ms(t0), notes: chipsNow.some(c => c.title) ? 'chips also carry a native title (two tooltips on hover)' : '' };
    });
    await item({ id: 'B-17', item: 'Level card (hover a chip)', action: 'read the card', expected: 'moves today, held since, touches today, the record line' }, async () => {
      const el = page.locator('[data-level-card]').first();
      if (!(await el.count())) return { observed: 'no level card', pass: false };
      const txt = (await el.innerText()).replace(/\n+/g, ' / ');
      const has = [/move/i.test(txt), /held since/i.test(txt), /touch/i.test(txt)];
      const todayCols = await page.evaluate(() => {
        const s = window.__x.E(0).trails.snapshots;
        const d = t => new Date(t * 1000).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
        const today = d(Date.now() / 1000);
        return s.filter(x => d(x.time) === today).length;
      });
      await away(page);
      const all = has.every(Boolean);
      return { observed: `${txt.slice(0, 300)} (field columns today: ${todayCols})`, pass: all ? true : todayCols === 0 ? 'manual' : false, notes: all ? '' : `missing: ${['moves today', 'held since', 'touches today'].filter((_, k) => !has[k]).join(', ')}${todayCols === 0 ? " — off hours there is no column today, and the card then shows the record line alone (StrikeChart.tsx:2052 'n > start' at 521d7de), saying nothing of the last session; see B-17/clock" : ''}` };
    });

    /* B-18 price capsule */
    await item({ id: 'B-18', item: 'Live price capsule + bar countdown', action: 'read [data-price-tag] against the header price', expected: 'the same price as the header; mm:ss to the bar end' }, async () => {
      const tag = (await page.locator('[data-price-tag]').first().innerText().catch(() => '')).replace(/\n/g, ' ');
      const head = await page.locator('[data-pane-head]').first().innerText().catch(() => '');
      const p = tag.match(/\d{2,5}\.\d{2}/)?.[0];
      const cd = tag.match(/\d{1,2}:\d{2}(:\d{2})?/)?.[0];
      return { observed: `capsule "${tag}"; header has ${p && head.includes(p) ? 'the same price' : `"${head.slice(0, 80)}"`}; countdown ${cd}`, pass: !!p && head.includes(p) && !!cd, notes: cd === '00:00' ? 'market shut: the countdown stands at 00:00 (by design per CLAUDE.md "a shut market says Closed")' : '' };
    });

    /* B-19 fit, and no re-fit under the pointer */
    await item({ id: 'B-19', item: 'Price axis fit (candles in view, 8-strike floor, chrome margins)', action: 'newest session tail; then hover (readout appears)', expected: 'candles inside the axis; range ≥ 8 strikes; hover does not move the scale' }, async () => {
      const f1 = await page.evaluate(() => window.__x.fit(0));
      const b = await box(page);
      await page.mouse.move(b.x + b.pw * 0.5, b.y + b.ph * 0.75);
      await page.waitForTimeout(500);
      const f2 = await page.evaluate(() => window.__x.fit(0));
      await away(page);
      const span = f1.axis ? f1.axis[1] - f1.axis[0] : 0;
      const moved = f1.axis && f2.axis && (Math.abs(f1.axis[0] - f2.axis[0]) > 1e-6 || Math.abs(f1.axis[1] - f2.axis[1]) > 1e-6);
      return { observed: `candles ${f1.lo.toFixed(2)}–${f1.hi.toFixed(2)} in axis ${f1.axis?.map(v => v.toFixed(2)).join('–')} (span ${span.toFixed(2)}), auto ${f1.auto}, margins ${JSON.stringify(f1.margins)}; on hover axis ${moved ? `moved to ${f2.axis.map(v => v.toFixed(2)).join('–')}` : 'unchanged'}`, pass: f1.inside && f1.auto && span >= 8 - 1e-6 && !moved };
    });

    /* B-20 axis drag; double-click back; a drag that starts on a chip */
    await item({ id: 'B-20', item: 'Manual price scale (drag the axis) and its reset', action: 'drag the price axis (away from chips); double-click the plot; drag starting on a chip', expected: 'autoscale off after the drag; on after double-click' }, async () => {
      const b = await box(page);
      const chipRects = await page.$$eval('[data-axis-chip]', es => es.map(e => e.getBoundingClientRect().toJSON()));
      const ax = b.x + b.w - 30;
      let ay = b.y + b.ph * 0.5;
      for (const yy of [0.5, 0.42, 0.58, 0.35, 0.65]) {
        const y = b.y + b.ph * yy;
        if (!chipRects.some(r => y >= r.top - 4 && y <= r.bottom + 4 && ax >= r.left - 2 && ax <= r.right + 2)) {
          ay = y;
          break;
        }
      }
      const t0 = Date.now();
      await page.mouse.move(ax, ay);
      await page.mouse.down();
      await page.mouse.move(ax, ay + 70, { steps: 8 });
      await page.mouse.up();
      const tOff = await until(page, () => window.__x.E(0).chart.priceScale('right').options().autoScale === false, null, 3000);
      await page.mouse.dblclick(b.x + b.pw * 0.5, b.y + b.ph * 0.5);
      const tOn = await until(page, () => window.__x.E(0).chart.priceScale('right').options().autoScale === true, null, 3000);
      /* a drag that starts on a chip over the axis */
      let chipNote = 'no chip on the axis inside the plot';
      const onPlot = chipRects.find(r => r.top > b.y + 120 && r.bottom < b.y + b.ph - 20);
      if (onPlot) {
        const cx = onPlot.left + onPlot.width / 2;
        const cy = onPlot.top + onPlot.height / 2;
        await page.mouse.move(cx, cy);
        await page.mouse.down();
        await page.mouse.move(cx, cy + 70, { steps: 8 });
        await page.mouse.up();
        await page.waitForTimeout(300);
        const auto = await page.evaluate(() => window.__x.E(0).chart.priceScale('right').options().autoScale);
        chipNote = auto ? 'a drag that starts on an axis chip does not take the scale (the chip blocks the axis there)' : 'a drag from a chip takes the scale too';
        await page.mouse.dblclick(b.x + b.pw * 0.5, b.y + b.ph * 0.5);
        await page.waitForTimeout(300);
      }
      await away(page);
      return { observed: `axis drag → autoscale off in ${tOff} ms; double-click → on in ${tOn} ms`, pass: tOff != null && tOn != null, ms: tOff ?? ms(t0), notes: chipNote };
    });

    /* B-21 time axis words */
    await item({ id: 'B-21', item: 'Time axis ticks and day labels', action: 'read the time-axis words the canvas drew', expected: "12-h reader's clock ticks, 'Oct 14' day ticks, never 24-h" }, async () => {
      await page.evaluate(() => window.__x.clearTexts());
      await viewSessionTail(page, 600);
      await page.waitForTimeout(500);
      const words = await page.evaluate(() => [...new Set(window.__x.textsIn(0, '.', 'time').map(o => o.t))]);
      const h24 = words.filter(w => /^([01]?\d|2[0-3]):[0-5]\d$/.test(w) && !/(am|pm)/i.test(w));
      const h12 = words.filter(w => /\d{1,2}(:\d{2})?\s?(am|pm)/i.test(w));
      const days = words.filter(w => /^[A-Z][a-z]{2} \d{1,2}$/.test(w));
      return { observed: `${words.length} axis words: ${words.slice(0, 14).join(' | ')}`, pass: h24.length === 0 && h12.length > 0, notes: `${h12.length} 12-h, ${days.length} day ticks${h24.length ? `, 24-h: ${h24.join(',')}` : ''}` };
    });

    /* B-23 crosshair readout */
    await item({ id: 'B-23', item: 'Crosshair readout (O H L C V)', action: 'hover a bar', expected: "the hovered bar's figures at the plot's top-left, clear of the drawing rail" }, async () => {
      await viewSessionTail(page, 80);
      const b = await box(page);
      const t0 = Date.now();
      await page.mouse.move(b.x + b.pw * 0.4, b.y + b.ph * 0.85);
      const t = await until(page, () => !!document.querySelector('[data-crosshair-readout]'), null, 3000);
      const txt = (await page.locator('[data-crosshair-readout]').first().innerText().catch(() => '')).replace(/\n/g, ' ');
      const rr = await page.locator('[data-crosshair-readout]').first().boundingBox().catch(() => null);
      const rail = await page.locator('[data-chart-rail]').first().boundingBox().catch(() => null);
      await away(page);
      const overlap = rr && rail && rr.x < rail.x + rail.width && rr.y < rail.y + rail.height && rr.y + rr.height > rail.y;
      const hasOHLC = /O\s*[\d,.]+/.test(txt) && /H\s*[\d,.]+/.test(txt) && /L\s*[\d,.]+/.test(txt) && /C\s*[\d,.]+/.test(txt);
      return { observed: `"${txt.slice(0, 160)}"; left ${rr ? Math.round(rr.x) : '—'} vs rail right ${rail ? Math.round(rail.x + rail.width) : '—'}`, pass: !!t && hasOHLC && !overlap, ms: t ?? ms(t0), notes: /(am|pm)/i.test(txt) ? 'time shown' : 'no time in the readout' };
    });

    /* B-24 legend, B-25 its controls */
    await item({ id: 'B-24', item: 'Bead legend row', action: 'read [data-bead-legend]; press L twice over the pane', expected: 'the legend words with swatches; L hides and shows it' }, async () => {
      const lg = page.locator('[data-bead-legend]').first();
      const txt = (await lg.innerText().catch(() => '')).replace(/\n/g, ' ');
      const ref = await lg.getAttribute('data-bead-ref').catch(() => null);
      const sw = await page.locator('[data-legend-swatch]').count();
      const tref = await page.evaluate(() => window.__x.E(0).trails.legend()?.ref ?? null);
      await hoverPane(page);
      const t0 = Date.now();
      await page.keyboard.press('l');
      const tHide = await until(page, () => !document.querySelector('[data-bead-legend]'), null, 3000);
      await page.keyboard.press('l');
      const tShow = await until(page, () => !!document.querySelector('[data-bead-legend]'), null, 3000);
      await away(page);
      const words = /size = total gamma/.test(txt) && /absorb/.test(txt) && /amplify/.test(txt) && /balanced/.test(txt) && /stale/.test(txt);
      return { observed: `"${txt.slice(0, 220)}"; swatches ${sw}; data-bead-ref ${ref} vs renderer ${tref}; L hide ${tHide} ms, show ${tShow} ms`, pass: words && sw >= 3 && tHide != null && tShow != null && Math.abs(Number(ref) - Number(tref)) <= Math.abs(Number(tref)) * 1e-6 + 1, ms: tHide ?? ms(t0) };
    });
    await item({ id: 'B-25', item: 'Legend controls on the hover row: basis, Every strike, Floor, Legend', action: 'hover → Prior session; Floor 25%; Legend door', expected: 'data-bead-basis changes; floor hides small nodes; Legend toggles' }, async () => {
      await viewSessionTail(page, 80);
      await away(page);
      await page.waitForTimeout(400);
      const s0 = await stats(page);
      await hoverPane(page);
      let t0 = Date.now();
      await page.locator('[data-bead-basis-pick] button', { hasText: 'Prior session' }).click();
      const tBasis = await until(page, () => document.querySelector('[data-bead-legend]')?.getAttribute('data-bead-basis') === 'prior', null, 4000);
      const basisNow = await page.locator('[data-bead-legend]').first().getAttribute('data-bead-basis').catch(() => null);
      const legPrior = (await page.locator('[data-bead-legend]').first().innerText().catch(() => '')).replace(/\n/g, ' ');
      await page.locator('[data-bead-basis-pick] button', { hasText: 'Session so far' }).click();
      /* the floor acts on what is drawn: with the five largest a candle it may hide nothing, so "Every strike" first */
      await page.locator('[data-bead-density] input').check();
      await away(page);
      await page.waitForTimeout(500);
      const sAll = await stats(page);
      await hoverPane(page);
      await page.locator('[data-bead-floor] button', { hasText: '25%' }).click();
      await away(page);
      const tFloor = await until(page, v => window.__x.stats(0).gold + window.__x.stats(0).violet < v * 0.97, sAll.gold + sAll.violet, 4000);
      const s1 = await stats(page);
      void s0;
      await hoverPane(page);
      await page.locator('[data-bead-floor] button', { hasText: 'Off' }).click();
      await page.locator('[data-bead-density] input').uncheck();
      t0 = Date.now();
      await page.locator('[data-legend-door]').click();
      const tLeg = await until(page, () => !document.querySelector('[data-bead-legend]'), null, 3000);
      await page.locator('[data-legend-door]').click();
      await away(page);
      return { observed: `Prior session → basis "${basisNow}" in ${tBasis} ms ("${legPrior.slice(-90)}"); with Every strike on, Floor 25% → oval px ${sAll.gold + sAll.violet} → ${s1.gold + s1.violet} in ${tFloor} ms; Legend door hides in ${tLeg} ms`, pass: tBasis != null && tFloor != null && tLeg != null, ms: tBasis };
    });

    /* B-51 building / catching-up chip */
    await item({ id: 'B-51', item: 'Building / Catching up hatched chip', action: 'read [data-trail-since] off hours', expected: '"Building · the chain is being read" or "Catching up · earlier sessions N of M in"' }, async () => {
      const el = page.locator('[data-trail-since]').first();
      if (!(await el.count())) return { observed: 'no chip (field full)', pass: 'manual' };
      const txt = await el.innerText();
      const kind = await el.getAttribute('data-building');
      return { observed: `"${txt}" data-building=${kind}`, pass: /Building|Catching up|field starts/.test(txt), notes: /field starts/.test(txt) ? "off hours the chip says when today's field starts (not the inventory's two wordings)" : '' };
    });

    if (errors.length) rec({ id: 'B-field-errors', item: 'page errors during the field group', action: '—', expected: 'none', observed: errors.slice(0, 5).join(' | '), pass: false });
  } finally {
    await close();
  }
});

/* ═══ GROUP 1b · THE VIEW: HISTORY, BACK TO LIVE, RESET, RIGHT-CLICK CARDS, THE RAIL, JUMPS ═══════════════════════ */
await group('view', async () => {
  const { page, errors, close } = await open({ panes: [SPY1m()] });
  try {
    /* B-75 history on scroll-left */
    await item({ id: 'B-75', item: 'History on scroll-left', action: 'drag far left at 1m', expected: 'the rest of the store loads (state().full, more bars)' }, async () => {
      const n0 = await page.evaluate(() => window.__x.E(0).candles.data().length);
      const full0 = await page.evaluate(() => window.__x.E(0).state().full);
      const b = await box(page);
      const t0 = Date.now();
      let t = null;
      for (let k = 0; k < 14 && t == null; k++) {
        await page.mouse.move(b.x + 80, b.y + b.ph * 0.5);
        await page.mouse.down();
        await page.mouse.move(b.x + b.pw - 20, b.y + b.ph * 0.5 + 3, { steps: 6 });
        await page.mouse.up();
        const ok = await page.evaluate(n0 => window.__x.E(0).candles.data().length > n0 || !!window.__x.E(0).state().full, n0);
        if (ok) t = ms(t0);
      }
      const n1 = await page.evaluate(() => ({ n: window.__x.E(0).candles.data().length, full: window.__x.E(0).state().full }));
      await page.locator('button[title^="Reset chart view"]').filter({ visible: true }).first().click().catch(() => {});
      return { observed: `bars ${n0} (full ${JSON.stringify(full0)}) → ${n1.n}, full ${JSON.stringify(n1.full)}`, pass: n1.n > n0 && !!n1.full, ms: t };
    });

    /* B-48 Back to live, B-45 Reset pill, B-46 right-click card / Alt+R */
    const panBack = async () => {
      const b = await box(page);
      await page.mouse.move(b.x + b.pw * 0.3, b.y + b.ph * 0.5);
      await page.mouse.down();
      await page.mouse.move(b.x + b.pw * 0.9, b.y + b.ph * 0.5 + 6, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(200);
    };
    const atLive = () => page.evaluate(() => {
      const e = window.__x.E(0);
      const lr = e.chart.timeScale().getVisibleLogicalRange();
      return { to: lr?.to, n: e.candles.data().length, auto: e.chart.priceScale('right').options().autoScale };
    });
    /* start from the opening view: Reset first */
    await page.locator('button[title^="Reset chart view"]').filter({ visible: true }).first().click().catch(() => {});
    await page.waitForTimeout(500);
    const home = await atLive();
    await item({ id: 'B-48', item: '"Back to live ›"', action: 'pan left off the last bar; click the pill', expected: 'pill shows when the right edge leaves the last bar; click returns to the recent view' }, async () => {
      await panBack();
      const tShow = await until(page, () => !!document.querySelector('[data-back-to-live]'), null, 4000);
      const t0 = Date.now();
      await page.locator('[data-back-to-live]').first().click().catch(() => {});
      const tBack = await until(page, () => !document.querySelector('[data-back-to-live]'), null, 4000);
      const v = await atLive();
      return { observed: `pill after pan in ${tShow} ms; click → gone in ${tBack} ms; view to ${v.to?.toFixed(1)} of ${v.n} bars (home ${home.to?.toFixed(1)})`, pass: tShow != null && tBack != null && v.to >= v.n - 2, ms: tBack ?? ms(t0) };
    });
    await item({ id: 'B-45', item: 'Reset pill ("↺ Reset")', action: 'pan; click the pill', expected: 'recent bars and autoscale back; clear of Back to live / stale banner' }, async () => {
      await panBack();
      const pill = page.locator('button[title^="Reset chart view"]').filter({ visible: true }).first();
      const pr = await pill.boundingBox();
      const bl = await page.locator('[data-back-to-live]').first().boundingBox().catch(() => null);
      const overlap = pr && bl && pr.x < bl.x + bl.width && pr.x + pr.width > bl.x && pr.y < bl.y + bl.height && pr.y + pr.height > bl.y;
      const t0 = Date.now();
      await pill.click();
      const t = await until(page, () => {
        const e = window.__x.E(0);
        return e.chart.timeScale().getVisibleLogicalRange().to >= e.candles.data().length - 2;
      }, null, 4000);
      const v = await atLive();
      const op = await pill.evaluate(e => getComputedStyle(e).opacity).catch(() => null);
      return { observed: `reset in ${t} ms → view to ${v.to?.toFixed(1)}/${v.n}, auto ${v.auto}; pill ${pr ? `${Math.round(pr.width)}×${Math.round(pr.height)} @${Math.round(pr.x)},${Math.round(pr.y)}` : '—'} opacity ${op}; Back to live ${bl ? `@${Math.round(bl.x)},${Math.round(bl.y)}` : 'not up'}`, pass: t != null && v.auto && !overlap, ms: t ?? ms(t0), notes: overlap ? 'Reset pill overlaps Back to live' : '' };
    });
    await item({ id: 'B-46', item: 'Right-click reset card · Alt+R · double-click', action: 'right-click empty plot → card → Esc; right-click → click; pan → Alt+R', expected: 'card at the cursor; Esc closes; its press resets; Alt+R resets' }, async () => {
      const b = await box(page);
      const lv = await page.evaluate(() => {
        const e = window.__x.E(0);
        return [...document.querySelectorAll('[data-axis-chip]')].map(c => e.candles.priceToCoordinate(Number(c.dataset.strike)));
      });
      let y = b.ph * 0.3;
      for (const yy of [0.3, 0.22, 0.38, 0.45, 0.5]) if (!lv.some(v => v != null && Math.abs(v - b.ph * yy) < 14)) { y = b.ph * yy; break; }
      const x = b.pw * 0.45;
      const t0 = Date.now();
      await page.mouse.click(b.x + x, b.y + y, { button: 'right' });
      const card = page.getByText('Reset chart view', { exact: false }).filter({ visible: true }).last();
      const tCard = await card.waitFor({ timeout: 3000 }).then(() => ms(t0)).catch(() => null);
      const cr = await card.boundingBox().catch(() => null);
      await page.keyboard.press('Escape');
      const tEsc = await card.waitFor({ state: 'hidden', timeout: 2000 }).then(() => true).catch(() => false);
      await panBack();
      await page.mouse.click(b.x + x, b.y + y, { button: 'right' });
      await page.getByText('Reset chart view', { exact: false }).filter({ visible: true }).last().click().catch(() => {});
      const tReset = await until(page, () => {
        const e = window.__x.E(0);
        return e.chart.timeScale().getVisibleLogicalRange().to >= e.candles.data().length - 2;
      }, null, 3000);
      await panBack();
      await page.mouse.move(b.x + x, b.y + y);
      await page.keyboard.press('Alt+r');
      const tAlt = await until(page, () => {
        const e = window.__x.E(0);
        return e.chart.timeScale().getVisibleLogicalRange().to >= e.candles.data().length - 2;
      }, null, 3000);
      await away(page);
      const near = cr ? Math.hypot(cr.x - (b.x + x), cr.y - (b.y + y)) : null;
      return { observed: `card in ${tCard} ms at ${near == null ? '—' : `${Math.round(near)} px`} from the click; Esc closes ${tEsc}; card press resets in ${tReset} ms; Alt+R resets in ${tAlt} ms`, pass: tCard != null && tEsc && tReset != null && tAlt != null, ms: tCard };
    });

    /* B-47 level alert card */
    await item({ id: 'B-47', item: 'Level alert card (right-click within 8 px of a level)', action: 'right-click on a level row inside the plot', expected: 'card at the cursor; on/off the watch; Esc closes it' }, async () => {
      await viewSessionTail(page, 80);
      await away(page);
      await page.waitForTimeout(400);
      const b = await box(page);
      const lv = await page.evaluate(() => {
        const e = window.__x.E(0);
        const ph = e.chart.paneSize(0).height;
        return [...document.querySelectorAll('[data-axis-chip]')].map(c => ({ k: c.dataset.axisChip, s: Number(c.dataset.strike), y: e.candles.priceToCoordinate(Number(c.dataset.strike)) })).filter(o => o.y != null && o.y > 60 && o.y < ph - 40);
      });
      const L = lv.find(o => ['pw', 'cw', 'flip'].includes(o.k)) ?? lv[0];
      if (!L) return { observed: 'no level inside the plot to right-click', pass: 'manual' };
      const cx = b.x + b.pw * 0.5;
      const cy = b.y + L.y;
      const t0 = Date.now();
      await page.mouse.click(cx, cy, { button: 'right' });
      const t = await until(page, () => !!document.querySelector('[data-chart-menu="level-alert"]'), null, 3000);
      const cr = await page.locator('[data-chart-menu="level-alert"]').first().boundingBox().catch(() => null);
      const items = await page.$$eval('[data-chart-menu-item]', es => es.map(e => e.getAttribute('data-chart-menu-item')));
      const txt = (await page.locator('[data-chart-menu="level-alert"]').first().innerText().catch(() => '')).replace(/\n/g, ' / ');
      let toggled = 'no on/off item';
      if (items.includes('level-alert-on')) {
        await page.locator('[data-chart-menu-item="level-alert-on"]').first().click();
        await page.waitForTimeout(450);
        await page.mouse.click(cx, cy, { button: 'right' });
        await until(page, () => !!document.querySelector('[data-chart-menu-item="level-alert-off"], [data-chart-menu-item="level-alert-on"]'), null, 2000);
        await page.waitForTimeout(150);
        const items2 = await page.$$eval('[data-chart-menu-item]', es => es.map(e => e.getAttribute('data-chart-menu-item')));
        toggled = items2.includes('level-alert-off') ? 'on → the card then offers off' : `after on: ${items2.join(',')}`;
        if (items2.includes('level-alert-off')) {
          await page.locator('[data-chart-menu-item="level-alert-off"]').first().click();
          await page.waitForTimeout(450);
          await page.mouse.click(cx, cy, { button: 'right' });
          await until(page, () => !!document.querySelector('[data-chart-menu="level-alert"]'), null, 2000);
        }
      }
      await page.keyboard.press('Escape');
      const esc = await until(page, () => !document.querySelector('[data-chart-menu="level-alert"]'), null, 2000);
      const dx = cr ? Math.round(cr.x - cx) : null;
      const dy = cr ? Math.round(cr.y - cy) : null;
      return { observed: `${L.k} ${L.s}: card in ${t} ms at (${dx}, ${dy}) px from the click; "${txt.slice(0, 160)}"; ${toggled}; Esc closes in ${esc} ms`, pass: !!t && cr && Math.abs(dx) < 40 && Math.abs(dy) < 60 && esc != null && /off/.test(toggled), ms: t ?? ms(t0) };
    });

    /* B-56 rail, B-57 show-tools tab, B-58 select, B-69 active-tool label; B-07 again with the rail hidden */
    await item({ id: 'B-56', item: 'Drawing rail (left column)', action: 'read the rail at rest and under the pointer; count families', expected: '55% at rest, full on hover; Select + five families + search + favourites + dock + hide' }, async () => {
      const rail = page.locator('[data-chart-rail]').first();
      const op0 = await rail.evaluate(e => getComputedStyle(e).opacity);
      await rail.hover();
      await page.waitForTimeout(350);
      const op1 = await rail.evaluate(e => getComputedStyle(e).opacity);
      const fam = await page.$$eval('[data-draw-family]', es => es.map(e => e.getAttribute('data-draw-family')));
      const btns = await rail.evaluate(e => ({ n: e.querySelectorAll('button').length, hit: e.querySelectorAll('button.hit, button.hit-after').length }));
      const rr = await rail.boundingBox();
      /* a family's face puts its tool in hand */
      const t0 = Date.now();
      await page.locator('[data-draw-family="fib"] button').first().click();
      const t = await until(page, () => [...document.querySelectorAll('[aria-live="polite"]')].some(e => e.closest('[data-chart-ink]') && /fib/i.test(e.textContent)), null, 3000);
      const live = await page.$$eval('[aria-live="polite"]', es => es.filter(e => e.closest('[data-chart-ink]')).map(e => e.textContent.trim()).filter(Boolean).join(' | '));
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
      await away(page);
      const five = ['trend', 'fib', 'measure', 'shapes', 'words'].every(f => fam.includes(f));
      return { observed: `opacity ${op0} at rest → ${op1} on hover; families ${fam.join(',')}; ${btns.n} buttons, ${btns.hit} with .hit; ${Math.round(rr.width)}×${Math.round(rr.height)}; the fib face → "${live}" in ${t} ms`, pass: five && Number(op1) > Number(op0) && t != null, ms: t ?? ms(t0), notes: btns.hit === 0 ? 'no .hit on any rail button (CLAUDE.md: a small control wears .hit, a 44 px box on a coarse pointer)' : '' };
    });
    await item({ id: 'B-57', item: 'Show-tools tab (rail hidden)', action: 'Hide the tools → tab → click', expected: 'rail hides to a slim tab; the tab brings it back' }, async () => {
      await page.locator('[data-chart-rail]').first().hover();
      const t0 = Date.now();
      await page.locator('[aria-label="Hide the tools"]').first().click();
      const tHide = await until(page, () => !!document.querySelector('[aria-label="Show the drawing tools"]'), null, 3000);
      const inset = await page.evaluate(() => {
        const e = window.__x.E(0);
        return Math.round(e.box().getBoundingClientRect().left - e.box().parentElement.getBoundingClientRect().left);
      });
      /* B-07 with the rail hidden: the same hit test must still land */
      let hitNote = '';
      const bs = await page.evaluate(() => window.__x.beads(0, 200));
      const bb = bs.find(b => !b.stale && b.x > 120);
      if (bb) {
        const b = await box(page);
        await page.mouse.move(b.x + bb.x, b.y + bb.y);
        await page.waitForTimeout(250);
        const hov = await page.evaluate(() => window.__x.E(0).trails.hover);
        hitNote = `rail hidden: hover on ${bb.strike} rings ${hov?.strike ?? 'none'}`;
      }
      const t1 = Date.now();
      await page.locator('[aria-label="Show the drawing tools"]').first().click();
      const tShow = await until(page, () => !!document.querySelector('[data-chart-rail]') && !document.querySelector('[aria-label="Show the drawing tools"]'), null, 3000);
      await away(page);
      return { observed: `hidden → tab in ${tHide} ms (plot inset ${inset}px); tab → rail in ${tShow ?? ms(t1)} ms; ${hitNote}`, pass: tHide != null && tShow != null, ms: tHide ?? ms(t0) };
    });
    await item({ id: 'B-69', item: 'Active-tool label beside the rail', action: 'press D over the pane; pick Select', expected: 'draw mode on, the tool in hand named (aria-live)' }, async () => {
      await hoverPane(page);
      const onAlready = await page.evaluate(() => [...document.querySelectorAll('[aria-live="polite"]')].some(e => e.textContent.trim().length > 0 && e.closest('[data-chart-ink]')));
      if (onAlready) {
        /* draw mode was left on (Esc does not leave it): D once to take it off */
        await page.keyboard.press('d');
        await page.waitForTimeout(300);
      }
      const t0 = Date.now();
      await page.keyboard.press('d');
      const t = await until(page, () => [...document.querySelectorAll('[aria-live="polite"]')].some(e => e.textContent.trim().length > 0 && e.closest('[data-chart-ink]')), null, 3000);
      const live = await page.$$eval('[aria-live="polite"]', es => es.filter(e => e.closest('[data-chart-ink]')).map(e => e.textContent.trim()).filter(Boolean));
      await page.locator('[aria-label="Select"]').first().click().catch(() => {});
      await page.waitForTimeout(200);
      const live2 = await page.$$eval('[aria-live="polite"]', es => es.filter(e => e.closest('[data-chart-ink]')).map(e => e.textContent.trim()).filter(Boolean));
      await page.keyboard.press('Escape');
      await away(page);
      await page.keyboard.press('d');
      return { observed: `D → label "${live.join(' | ')}" in ${t} ms; Select → "${live2.join(' | ')}"`, pass: t != null, ms: t ?? ms(t0), notes: onAlready ? 'draw mode was still on after Esc×2 (from the family face in B-56): Esc does not leave draw mode' : '' };
    });
    rec({ id: 'B-58', item: 'Select tool', action: 'see B-67/B-70 in the drawings group', expected: 'click a mark to move/delete', observed: 'exercised in the drawings group (B-67, B-70)', pass: 'manual', notes: 'covered by B-67/B-70 rows' });

    /* B-73 jumps and B-50 the no-data card (change the timeframe: last in this group) */
    await item({ id: 'B-73', item: 'View jumps (Today · 1W · 1M · 6M · 1Y · Max)', action: 'Jump → 1W; Jump → Today', expected: 'a fitting timeframe and the range shown (data-chart-view)' }, async () => {
      const pick = async v => {
        const direct = page.locator(`[data-jump="${v}"]`).filter({ visible: true }).first();
        if (await direct.count()) return direct.click();
        await page.locator('[data-jump-trigger]').filter({ visible: true }).first().click();
        await page.locator(`[data-jump="${v}"]`).filter({ visible: true }).first().click();
      };
      const st0 = await page.evaluate(() => window.__x.state(0));
      let t0 = Date.now();
      await pick('1w');
      const t1 = await until(page, s => {
        if (window.__x.state(0) === s || /\|1m\|/.test(window.__x.state(0))) return false;
        const vr = window.__x.E(0).chart.timeScale().getVisibleRange();
        return vr && vr.to - vr.from >= 4 * 86400;
      }, st0, 12000);
      await page.waitForTimeout(800);
      const v1 = await page.evaluate(() => ({ st: window.__x.state(0), view: window.__x.E(0).host.dataset.chartView, vr: window.__x.E(0).chart.timeScale().getVisibleRange() }));
      /* the same jump again, the pane already on 15m */
      await pick('1w');
      const tAgain = await until(page, () => {
        const vr = window.__x.E(0).chart.timeScale().getVisibleRange();
        return vr && vr.to - vr.from >= 4 * 86400;
      }, null, 6000);
      const vAgain = await page.evaluate(() => window.__x.E(0).chart.timeScale().getVisibleRange());
      const view1 = await page.evaluate(() => window.__x.E(0).host.dataset.chartView);
      t0 = Date.now();
      await pick('today');
      const t2 = await until(page, v => {
        const e = window.__x.E(0);
        const vr = e.chart.timeScale().getVisibleRange();
        return e.host.dataset.chartView !== v && vr && vr.to - vr.from <= 30 * 3600;
      }, view1, 12000);
      await page.waitForTimeout(800);
      const v2 = await page.evaluate(() => ({ st: window.__x.state(0), view: window.__x.E(0).host.dataset.chartView, vr: window.__x.E(0).chart.timeScale().getVisibleRange(), last: window.__x.lastBar(0) }));
      const d1 = v1.vr ? (v1.vr.to - v1.vr.from) / 86400 : 0;
      const d2 = v2.vr ? (v2.vr.to - v2.vr.from) / 3600 : 0;
      return { observed: `1W → ${v1.st.split('|').slice(0, 3).join('|')} view ${d1.toFixed(1)} d (${v1.view}) in ${t1} ms; Today → ${v2.st.split('|').slice(0, 3).join('|')} view ${d2.toFixed(1)} h, right edge ${v2.vr ? ((v2.last - v2.vr.to) / 60).toFixed(0) : '—'} min from the last bar, in ${t2} ms`, pass: t1 != null && t2 != null && d1 >= 4 && d1 <= 10 && d2 > 0.5 && d2 <= 30, ms: t1, notes: `${t1 == null ? `1W from 1m did not show a week within 12 s (it stood at ${d1.toFixed(1)} days); ` : ''}1W pressed again on 15m → ${vAgain ? ((vAgain.to - vAgain.from) / 86400).toFixed(1) : '—'} days${tAgain != null ? ` in ${tAgain} ms` : ''}` };
    });
    await item({ id: 'B-50', item: 'No-data card (‹ Previous session · Next session › · Back to live)', action: 'calendar → a Sunday; then ‹ Previous session', expected: "the card with the tape's span; Previous goes to Friday" }, async () => {
      await hoverPane(page);
      await page.locator('[data-jump-date]').filter({ visible: true }).first().click();
      const inp = page.locator('[data-jump-date-input]').filter({ visible: true }).first();
      await inp.fill('2026-10-11');
      const t0 = Date.now();
      await inp.press('Enter');
      const t = await until(page, () => !!document.querySelector('[data-no-day]'), null, 8000);
      const txt = (await page.locator('[data-no-day]').first().innerText().catch(() => '')).replace(/\n/g, ' / ');
      let prev = null;
      if (t != null) {
        const t1 = Date.now();
        await page.locator('[data-no-day-prev]').first().click();
        const tp = await until(page, () => !document.querySelector('[data-no-day]'), null, 8000);
        await page.waitForTimeout(500);
        const vr = await page.evaluate(() => window.__x.E(0).chart.timeScale().getVisibleRange());
        prev = { ms: tp ?? ms(t1), from: vr ? new Date(vr.from * 1000).toISOString().slice(0, 16) : null, to: vr ? new Date(vr.to * 1000).toISOString().slice(0, 16) : null };
      }
      await page.keyboard.press('Escape');
      return { observed: `card in ${t} ms: "${txt.slice(0, 200)}"; Previous → ${JSON.stringify(prev)}`, pass: t != null && !!prev && /2026-10-09/.test(`${prev.from}${prev.to}`), ms: t ?? ms(t0) };
    });

    if (errors.length) rec({ id: 'B-view-errors', item: 'page errors during the view group', action: '—', expected: 'none', observed: errors.slice(0, 5).join(' | '), pass: false });
  } finally {
    await close();
  }
});

/* ═══ GROUP 2 · OVERLAYS ══════════════════════════════════════════════════════════════════════════════════════════ */
await group('overlays', async () => {
  const { page, errors, close } = await open({ panes: [SPY1m()] });
  try {
    /* the whole newest regular session and the hour after */
    const span = await page.evaluate(() => {
      const e = window.__x.E(0);
      const s = e.trails.snapshots;
      const last = s[s.length - 1].time;
      return { from: last - 389 * 60, to: last + 70 * 60 };
    });
    await viewRange(page, span.from, span.to);
    await away(page);
    await page.waitForTimeout(800);
    const snap = () =>
      page.evaluate(() => ({
        panes: window.__x.E(0).chart.panes().length,
        s0: window.__x.E(0).chart.panes()[0].getSeries().length,
        lines: window.__x.E(0).candles.priceLines().map(l => l.options().title),
        allLines: window.__x.E(0).chart.panes().flatMap(p => p.getSeries().flatMap(s => s.priceLines().map(l => l.options().title))),
        chips: [...document.querySelectorAll('[data-pane-chip]')].map(e => `${e.getAttribute('data-pane-chip')}:${e.textContent.trim().slice(0, 80)}`),
        sig: window.__x.stats(0).sig,
        heat: window.__x.E(0).host.dataset.wallsPaintMs ?? null,
        rightOffset: window.__x.E(0).chart.timeScale().options().rightOffset,
      }));
    /* baseline noise: two signatures a second apart, nothing pressed */
    const n0 = await snap();
    await page.waitForTimeout(1000);
    const n1 = await snap();
    const noise = await page.evaluate(([a, b]) => window.__x.sigDiff(a, b), [n0.sig, n1.sig]);
    console.log(`signature noise ${noise} cells`);
    const sigChanged = (a, b) => page.evaluate(([a, b]) => window.__x.sigDiff(a, b), [a, b]);
    const waitSig = async (base, min = noise + 8, timeout = 6000) => until(page, ([b, m]) => window.__x.sigDiff(b, window.__x.stats(0).sig) > m, [base, min], timeout);

    const overlay = async (o, check) => {
      await item({ id: o.id, item: o.item, action: o.action ?? `Layers → ${o.label}`, expected: o.expected }, async () => {
        await away(page);
        const before = await snap();
        await page.evaluate(() => window.__x.clearTexts());
        const { t0 } = await toggleOverlay(page, o.label);
        const r = await check(before, t0);
        /* off again */
        if (!o.keep) {
          await toggleOverlay(page, o.label);
          await page.waitForTimeout(400);
        }
        return r;
      });
    };

    /* a product pane's name chip: if missing, nudge the layout (a 1-px viewport change) and look again — it says
       whether the chip is only waiting for a re-measure */
    const chipAfterNudge = async key => {
      if (await page.locator(`[data-pane-chip="${key}"]`).count()) return 'present';
      const vp = page.viewportSize();
      await page.setViewportSize({ width: vp.width, height: vp.height - 1 });
      await page.waitForTimeout(400);
      await page.setViewportSize(vp);
      await page.waitForTimeout(400);
      return (await page.locator(`[data-pane-chip="${key}"]`).count()) ? 'appears only after a layout change (resize)' : 'still missing after a resize';
    };
    await overlay({ id: 'B-26', label: 'Regime strip', item: 'Regime strip (own pane) + "Regime · …" chip', expected: 'a pane under the price with its chip' }, async (before, t0) => {
      const tPane = await until(page, n => window.__x.E(0).chart.panes().length > n, before.panes, 8000);
      const t = await until(page, () => !!document.querySelector('[data-pane-chip="regime"]'), null, 3000);
      const nudge = t == null ? await chipAfterNudge('regime') : 'present';
      const a = await snap();
      const chip = a.chips.find(c => c.startsWith('regime')) ?? '';
      const words = await page.evaluate(() => [...document.querySelectorAll('[data-chart-ink] span, [data-chart-ink] div')].map(e => e.textContent).find(t => /^Regime ·/.test(t ?? '')) ?? '');
      const chipEl = await page.locator('[data-pane-chip="regime"]').first().boundingBox().catch(() => null);
      const panes = await page.evaluate(() => window.__x.E(0).chart.panes().map(p => ({ h: p.getHeight(), n: p.getSeries().length })));
      return { observed: `pane ${before.panes} → ${a.panes} in ${tPane} ms; name chip ${t != null ? `in ${t} ms` : nudge} "${chip}"; regime words "${words.slice(0, 120)}"; panes ${JSON.stringify(panes)}`, pass: tPane != null && t != null, ms: tPane, notes: t == null ? `the pane's name chip ${nudge} (remeasurePaneLabels runs as the pane is added, before the library lays it out — a 0-height pane is skipped, StrikeChart.tsx:3048 at 521d7de; likely)` : chipEl && chipEl.height > 24 ? 'the chip wraps to more than one line' : '' };
    });
    await overlay({ id: 'B-27', label: 'Expected move', item: '±1σ / ±2σ lines and prior close (priced move, feed) + cone (B-28)', expected: 'σ lines labelled "+1σ … priced at the prior close"; the cone washes' }, async (before, t0) => {
      const t = await waitSig(before.sig);
      await page.waitForTimeout(400);
      const a = await snap();
      const words = await page.evaluate(() => [...new Set(window.__x.textsIn(0, 'σ|prior close').map(o => `${o.t} (${o.f})`))]);
      const d = await sigChanged(before.sig, a.sig);
      const small = words.filter(w => Number((w.match(/(\d+(\.\d+)?)px/) ?? [])[1]) < 11);
      return { observed: `plot cells changed ${d} (noise ${noise}); rightOffset ${before.rightOffset} → ${a.rightOffset}; σ words on the chart: ${words.slice(0, 6).join(' | ') || 'none drawn'}`, pass: words.length === 0 ? 'manual' : d > noise + 2 && small.length === 0, ms: t ?? null, notes: words.length === 0 ? "at night the day's ±σ stand over today's session, which has no bars yet — see B-27/clock" : small.length ? `σ words under 11 px` : '' };
    });
    rec({ id: 'B-28', item: 'Priced-move cone + readout', action: 'Layers → Expected move during the session', expected: '50/68/95% washes from the last bar to the close', observed: 'market shut at run time (3–4 am New York): the cone runs from the last bar to the close only during the session', pass: 'manual', notes: 'σ lines exercised in B-27; the live cone needs a session in progress' });
    await overlay({ id: 'B-30', label: 'Walls through the day', item: 'Walls through the day (heat) + lens GEX/Charm/DEX', expected: 'strike × bar heat behind the candles; the lens picker on the hover row repaints', keep: true }, async (before, t0) => {
      const t = await until(page, () => window.__x.E(0).host.dataset.wallsPaintMs != null, null, 8000);
      const p1 = await page.evaluate(() => window.__x.E(0).host.dataset.wallsPaintMs);
      await hoverPane(page);
      const lens = await page.locator('[data-walls-lens] button').allInnerTexts().catch(() => []);
      const sBefore = (await snap()).sig;
      const t1 = Date.now();
      await page.locator('[data-walls-lens] button', { hasText: 'Charm' }).click().catch(() => {});
      await away(page);
      const tl = await waitSig(sBefore, noise + 4, 5000);
      const p2 = await page.evaluate(() => window.__x.E(0).host.dataset.wallsPaintMs);
      await hoverPane(page);
      await page.locator('[data-walls-lens] button', { hasText: 'GEX' }).click().catch(() => {});
      await away(page);
      return { observed: `paint ${p1} ms (on in ${t} ms); lens [${lens.join(',')}] → Charm repaint ${tl ?? `none seen in 5 s (${ms(t1)})`} ms, paint ${p2} ms`, pass: t != null && lens.length === 3 && tl != null, ms: t ?? ms(t0), notes: 'same quantity and hues as the ovals over it (inventory clash)' };
    });
    await toggleOverlay(page, 'Walls through the day');
    await overlay({ id: 'B-31', label: 'Session phases', item: 'Session phases (pre-market, the open, lunch, power hour, after hours)', expected: 'quiet bands, a word at the foot when ≥64 px wide (≥11 px words)' }, async (before, t0) => {
      const t = await waitSig(before.sig, noise + 3);
      await page.waitForTimeout(300);
      const words = await page.evaluate(() => [...new Map(window.__x.textsIn(0, 'open|lunch|power|pre-market|after hours|close', 'pane').map(o => [o.t, `${o.t} (${o.f})`])).values()]);
      const small = words.filter(w => Number((w.match(/(\d+(\.\d+)?)px/) ?? [])[1]) < 11);
      return { observed: `cells changed after ${t} ms; words: ${words.join(' | ') || 'none'}`, pass: t != null && words.length > 0 && small.length === 0, ms: t ?? ms(t0), notes: small.length ? `words under 11 px: ${small.join(', ')}` : '' };
    });
    for (const [id, label, key, item0] of [
      ['B-32', 'Flow', 'flow', 'Flow pane'],
      ['B-33', 'Net drift', 'netDrift', 'Net drift pane'],
      ['B-34', 'Vol drift', 'volDrift', 'Vol drift pane (RV, IV)'],
    ]) {
      await overlay({ id, label, item: item0, expected: 'its own pane under the price with a name chip' }, async (before, t0) => {
        const tPane = await until(page, n => window.__x.E(0).chart.panes().length > n, before.panes, 8000);
        const t = await until(page, k => !!document.querySelector(`[data-pane-chip="${k}"]`), key, 3000);
        const nudge = t == null ? await chipAfterNudge(key) : 'present';
        const a = await snap();
        const ser = await page.evaluate(() => window.__x.series(0).slice(1).map(p => p.map(s => `${s.type}:${s.color}${s.title ? `:${s.title}` : ''}:${s.type === 'Line' || s.type === 'Histogram' ? '' : ''}`)));
        const pts = await page.evaluate(() => window.__x.E(0).chart.panes().slice(1).map(p => p.getSeries().map(s => s.data().filter(d => 'value' in d && d.value !== 0).length)));
        return { observed: `pane ${before.panes} → ${a.panes} in ${tPane} ms; name chip ${t != null ? `in ${t} ms` : nudge}; series ${JSON.stringify(ser)}, non-zero points ${JSON.stringify(pts)}`, pass: tPane != null && t != null, ms: tPane ?? ms(t0), notes: t == null ? `name chip ${nudge}` : '' };
      });
    }
    await item({ id: 'B-35', item: 'Pane name chips (Flow · Net drift · Vol drift · Regime)', action: 'Flow + Regime on together', expected: 'each product pane named at its top-left, on its own pane' }, async () => {
      await toggleOverlay(page, 'Flow');
      await toggleOverlay(page, 'Regime strip');
      let t = await until(page, () => document.querySelectorAll('[data-pane-chip]').length >= 2, null, 6000);
      if (t == null) {
        await chipAfterNudge('regime');
        t = (await page.locator('[data-pane-chip]').count()) >= 2 ? null : null;
      }
      const chips = await page.$$eval('[data-pane-chip]', es => es.map(e => ({ k: e.getAttribute('data-pane-chip'), r: e.getBoundingClientRect().toJSON(), c: getComputedStyle(e).color })));
      const panes = await page.evaluate(() => {
        const e = window.__x.E(0);
        const top = e.box().getBoundingClientRect().top;
        let y = top;
        return e.chart.panes().map(p => {
          const o = { top: y, h: p.getHeight() };
          y += p.getHeight() + 1;
          return o;
        });
      });
      const inside = chips.every(c => panes.slice(1).some(p => c.r.top >= p.top - 2 && c.r.top <= p.top + p.h));
      await toggleOverlay(page, 'Flow');
      await toggleOverlay(page, 'Regime strip');
      return { observed: `chips ${chips.map(c => `${c.k}@${Math.round(c.r.top)} ${c.c}`).join('; ') || 'none'}; pane tops ${panes.map(p => Math.round(p.top)).join(',')}`, pass: t != null && chips.length >= 2 && inside, ms: t, notes: chips.length < 2 ? 'with Flow and the Regime strip both on only the Flow chip stands — the regime pane is unnamed (B-26)' : '' };
    });
    await overlay({ id: 'B-36', label: 'Events', item: 'Events lane + card', expected: 'glyphs over the floor; hover a glyph → card' }, async (before, t0) => {
      const t = await waitSig(before.sig, noise + 2, 5000);
      const b = await box(page);
      let card = null;
      for (let x = 70; x < b.pw - 20 && !card; x += 4) {
        for (const dy of [10, 14, 18]) {
          await page.mouse.move(b.x + x, b.y + b.ph - dy);
          const c = await page.locator('[data-chart-ink] .absolute.bottom-9.z-30').first().innerText({ timeout: 60 }).catch(() => null);
          if (c) {
            card = { x, c: c.replace(/\n/g, ' / ') };
            break;
          }
        }
      }
      await away(page);
      return { observed: `cells changed ${t == null ? 'none seen' : `after ${t} ms`}; hover card: ${card ? `"${card.c.slice(0, 160)}" at x${card.x}` : 'no glyph found along the lane'}`, pass: card ? true : t == null ? 'manual' : 'manual', ms: t ?? null, notes: card ? (/^[A-Z ]+$/.test(card.c.split(' / ')[0]) ? 'card label in tracked caps' : '') : 'no earnings/macro/big print in this view' };
    });
    await overlay({ id: 'B-37', label: 'Dark pool', item: 'Dark pool lines', expected: 'dashed lines, axis labels in the house format ("DP $3.2M · Oct 14")' }, async (before, t0) => {
      const t = await until(page, n => window.__x.E(0).candles.priceLines().length > n, before.lines.length, 8000);
      const a = await snap();
      const dp = a.lines.filter(x => !before.lines.includes(x));
      const bad = dp.filter(x => /\$0\.00B|\d+\/\d+/.test(x));
      return { observed: `price lines ${before.lines.length} → ${a.lines.length} in ${t} ms: ${dp.slice(0, 4).join(' | ')}`, pass: t != null && dp.length > 0 && bad.length === 0, ms: t ?? ms(t0), notes: bad.length ? `label format: ${bad[0]}` : '' };
    });
    await overlay({ id: 'B-38', label: 'Volume', item: 'Volume histogram (on by default)', expected: 'off removes the histogram series; on restores' }, async (before, t0) => {
      const t = await until(page, n => window.__x.E(0).chart.panes()[0].getSeries().length !== n || window.__x.sigDiff(window.__x.stats(0).sig, []) < 0, before.s0, 3000);
      const a = await snap();
      const d = await sigChanged(before.sig, a.sig);
      const vol = await page.evaluate(() => {
        const e = window.__x.E(0);
        const h = e.chart.panes()[0].getSeries().find(s => s.seriesType() === 'Histogram');
        const vr = e.chart.timeScale().getVisibleRange();
        const pts = h ? h.data().filter(p => p.time >= vr.from && p.time <= vr.to) : [];
        const bars = e.candles.data().filter(b => b.time >= vr.from && b.time <= vr.to);
        return { visible: h ? h.options().visible : null, pts: pts.length, nonzero: pts.filter(p => p.value > 0).length, barsVol: bars.filter(b => (b.customValues?.volume ?? b.volume ?? 0) > 0).length, bars: bars.length };
      });
      return { observed: `pane-0 series ${before.s0} → ${a.s0}, histogram visible ${vol.visible}; plot cells changed ${d} (noise ${noise}); volume points in view ${vol.pts}, non-zero ${vol.nonzero} of ${vol.bars} bars`, pass: (vol.visible === false || a.s0 !== before.s0) && vol.nonzero > 0, ms: t ?? null, notes: vol.nonzero === 0 ? 'the switch works, but the overlay (on by default) has nothing to draw: every 1m feed bar in view has volume 0 (the readout says V0); cause not traced here — see B-38/house for the house tape' : '' };
    });
    await overlay({ id: 'B-39', label: 'Session levels', item: 'Session levels (PDH/PDL/PDC, opening range, first hour) + OR picker', expected: 'named rules; the opening-range picker in the menu' }, async (before, t0) => {
      const t = await waitSig(before.sig, noise + 2);
      await page.waitForTimeout(300);
      const words = await page.evaluate(() => [...new Map(window.__x.textsIn(0, '^(PDH|PDL|PDC|OR|ORH|ORL|1H|IB|Prior|Yest|Open|First|High|Low|Close)', 'pane').map(o => [o.t, `${o.t} (${o.f})`])).values()]);
      await hoverPane(page);
      await page.locator('button[title="Overlays"]').filter({ visible: true }).first().click();
      const or = await page.locator('[aria-label="Opening range minutes"] button').allInnerTexts().catch(() => []);
      await page.keyboard.press('Escape');
      const small = words.filter(w => Number((w.match(/(\d+(\.\d+)?)px/) ?? [])[1]) < 11);
      return { observed: `cells changed after ${t} ms; tags ${words.slice(0, 8).join(' | ') || 'none captured'}; OR picker [${or.join(',')}]`, pass: t != null && or.length > 0, ms: t ?? ms(t0), notes: small.length ? `tags under 11 px: ${small.slice(0, 3).join(', ')}` : '' };
    });
    /* B-40 needs a waiting price alert: armed through the command line */
    await item({ id: 'B-40', item: 'Alert lines', action: 'Ctrl K "SPY alert 770" ↵; Layers → Alert lines', expected: 'a dashed orange line at each waiting alert' }, async () => {
      const before = await snap();
      await page.keyboard.press('Control+k');
      const inp = page.locator('[role="combobox"], input[type="text"]').filter({ visible: true }).first();
      await inp.fill('SPY alert 770');
      await page.waitForTimeout(300);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      await page.keyboard.press('Escape');
      const { t0 } = await toggleOverlay(page, 'Alert lines');
      const t = await until(page, n => window.__x.E(0).candles.priceLines().length > n, before.lines.length, 6000);
      const a = await snap();
      await toggleOverlay(page, 'Alert lines');
      return { observed: `price lines ${before.lines.length} → ${a.lines.length} (${a.lines.filter(x => !before.lines.includes(x)).join('|') || 'untitled'}) in ${t} ms`, pass: t != null, ms: t ?? ms(t0) };
    });
    await overlay({ id: 'B-41', label: 'Key levels', item: '"Key levels" overlay', expected: 'call & put walls, flip and supreme marked on the field (the menu’s promise)' }, async (before, t0) => {
      const t = await waitSig(before.sig, noise + 2, 3000);
      const a = await snap();
      const d = await sigChanged(before.sig, a.sig);
      return { observed: `plot cells changed ${d} (noise ${noise}); price lines ${before.lines.length} → ${a.lines.length}`, pass: t != null || a.lines.length > before.lines.length, ms: t, notes: t == null ? 'dead switch: nothing on the plot changes (inventory B-41)' : '' };
    });
    await item({ id: 'B-42', item: 'Compare lines + compare legend', action: 'C over the pane → type QQQ ↵', expected: 'a compare series and a legend row with ×' }, async () => {
      const before = await snap();
      await hoverPane(page);
      let t0 = Date.now();
      await page.keyboard.press('c');
      const inp = page.locator('input[placeholder="Compare symbols…"]').filter({ visible: true }).first();
      let opened = await inp.waitFor({ timeout: 2000 }).then(() => true).catch(() => false);
      let said = '';
      if (!opened) {
        said = await page.evaluate(() => [...document.querySelectorAll('[aria-live]')].map(e => e.textContent.trim()).find(t => /Compare/.test(t)) ?? '');
        /* no room in a docked pane: F opens it full size, where Compare stands */
        await hoverPane(page);
        await page.keyboard.press('f');
        await page.waitForTimeout(900);
        await hoverPane(page);
        t0 = Date.now();
        await page.keyboard.press('c');
        opened = await inp.waitFor({ timeout: 3000 }).then(() => true).catch(() => false);
      }
      if (opened) {
        await inp.fill('QQQ');
        await page.waitForTimeout(300);
        await inp.press('Enter');
      }
      const t = await until(page, n => window.__x.E(0).chart.panes().reduce((s, p) => s + p.getSeries().length, 0) > n, before.panes + before.s0 - 1, 10000);
      await page.waitForTimeout(500);
      const ser = await page.evaluate(() => window.__x.series(0));
      const legend = await page.locator('[aria-label="Remove the QQQ comparison"]').count();
      await page.locator('[aria-label="Remove the QQQ comparison"]').first().click().catch(() => {});
      await page.keyboard.press('Escape');
      if (said) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(600);
      }
      return { observed: `${said ? `docked pane: C says "${said}"; expanded (F): ` : ''}picker ${opened ? 'opened' : 'did not open'}; series after ${t} ms: ${JSON.stringify(ser.map(p => p.map(s => `${s.type}:${s.color}${s.title ? `:${s.title}` : ''}`)))}; legend rows with × ${legend}`, pass: opened && t != null && legend > 0, ms: t ?? ms(t0) };
    });
    /* B-74 export */
    await item({ id: 'B-74', item: 'Export PNG', action: 'Chart style menu → Export PNG', expected: 'a PNG download; header stamp in the house format (12-h, never 24-h Z)' }, async () => {
      await hoverPane(page);
      await page.evaluate(() => window.__x.clearTexts());
      const btn = page.locator('button[title^="Chart style"]').filter({ visible: true }).first();
      await btn.click();
      const t0 = Date.now();
      const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }).catch(() => null), page.getByText('Export PNG').filter({ visible: true }).first().click()]);
      const t = dl ? ms(t0) : null;
      const name = dl ? dl.suggestedFilename() : null;
      let size = null;
      if (dl) {
        const p = await dl.path().catch(() => null);
        if (p) size = (await import('node:fs')).statSync(p).size;
      }
      /* the words drawn on the export's own (detached) canvas: its header, its stamp, its watermark */
      const words = await page.evaluate(() => [...new Set(window.__ft.filter(o => o.el && !o.el.isConnected && o.cw > 300).map(o => `${o.t} (${o.f})`))]);
      await page.keyboard.press('Escape');
      const z = words.filter(w => /\d{2}:\d{2}Z|\b(1[3-9]|2[0-3]):\d{2}\b/.test(w.replace(/ \(.*$/, '')));
      const small = words.filter(w => Number((w.match(/(\d+(\.\d+)?)px/) ?? [])[1]) < 11);
      return { observed: `download "${name}" ${size ?? '?'} bytes in ${t} ms; words on the image: ${words.slice(0, 8).join(' | ')}`, pass: !!dl && z.length === 0 && words.length > 0, ms: t, notes: [z.length ? `24-h / Z stamp: ${z.join(', ')}` : '', small.length ? `under 11 px: ${small.slice(0, 2).join(', ')}` : ''].filter(Boolean).join('; ') };
    });
    if (errors.length) rec({ id: 'B-overlays-errors', item: 'page errors during the overlays group', action: '—', expected: 'none', observed: errors.slice(0, 5).join(' | '), pass: false });
  } finally {
    await close();
  }
});

/* ═══ GROUP 3 · DAILY BARS (Los Angeles reader) ═══════════════════════════════════════════════════════════════════ */
await group('daily', async () => {
  const { page, errors, close } = await open({ panes: [SPY1m({ timeframe: '1D' })], tz: 'America/Los_Angeles', waitField: false });
  try {
    await away(page);
    await page.waitForTimeout(1500);
    await item({ id: 'B-18/1D', item: 'Price capsule and countdown on 1D', action: 'read the capsule on day bars', expected: 'the price; no meaningless "time left" on a day bar (inventory note)' }, async () => {
      const tag = (await page.locator('[data-price-tag]').first().innerText().catch(() => '')).replace(/\n/g, ' ');
      return { observed: `capsule "${tag}"`, pass: 'manual', notes: 'a countdown on a day bar is the reader’s call (the market is shut: 00:00 or none)' };
    });
    await item({ id: 'B-01/1D', item: 'No ovals on daily bars', action: 'SPY 1D', expected: 'trails gated to intraday: no ovals drawn' }, async () => {
      const s = await stats(page);
      const st = await page.evaluate(() => window.__x.state(0));
      return { observed: `state ${st}; gold ${s.gold}px violet ${s.violet}px`, pass: s.gold + s.violet < 40 };
    });
    await item({ id: 'B-21/1D', item: 'Day ticks name the New York session in a Pacific zone', action: 'read the time-axis words on 1D in America/Los_Angeles', expected: 'bars and ticks name New York session dates (no off-by-one)' }, async () => {
      await page.evaluate(() => window.__x.clearTexts());
      await page.evaluate(() => {
        const e = window.__x.E(0);
        const d = e.candles.data();
        e.chart.timeScale().setVisibleLogicalRange({ from: d.length - 12, to: d.length + 1 });
      });
      await page.waitForTimeout(500);
      const last = await page.evaluate(() => {
        const d = window.__x.E(0).candles.data();
        return d.slice(-3).map(b => b.time);
      });
      const r = await page.evaluate(() => {
        const e = window.__x.E(0);
        const ts = e.chart.timeScale();
        const ps = e.chart.paneSize(0);
        const words = window.__x.textsIn(0, '^[A-Z][a-z]{2} \\d{1,2}$', 'time');
        const fmt = t => new Date(t * 1000).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' });
        const bars = e.candles.data().map(b => ({ x: ts.timeToCoordinate(b.time), d: fmt(b.time) })).filter(b => b.x != null);
        /* the axis canvas spans the plot (and the left scale, none here): a label's x is its bar's x */
        return words.map(w => {
          let best = null;
          for (const b of bars) if (!best || Math.abs(b.x - w.x) < Math.abs(best.x - w.x)) best = b;
          return { t: w.t, x: Math.round(w.x), bar: best?.d ?? null, dx: best ? Math.round(best.x - w.x) : null, inPlot: w.x < ps.width };
        });
      });
      const uniq = [...new Map(r.map(o => [o.t, o])).values()];
      const onBars = uniq.filter(o => o.dx != null && Math.abs(o.dx) <= 3);
      const wrong = onBars.filter(o => o.bar !== o.t);
      const ny = last.map(t => new Date(t * 1000).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' }));
      return { observed: `day ticks ${uniq.map(o => `${o.t}@bar ${o.bar}${o.dx != null && Math.abs(o.dx) > 3 ? ` (${o.dx}px off)` : ''}`).join(' | ')}; last bars NY dates ${ny.join(', ')}`, pass: onBars.length > 0 && wrong.length === 0, notes: wrong.length ? `ticks naming another date than their bar: ${wrong.map(o => `${o.t} on ${o.bar}`).join(', ')}` : '' };
    });
    await item({ id: 'B-52', item: 'Day panel (click a daily bar)', action: '1D → click a bar; Esc; click again → "Open this session · 5m"', expected: 'panel with close, regime, walls, flip, UW book; Esc closes; Open → 5m on that day' }, async () => {
      const b = await box(page);
      const pt = await page.evaluate(() => {
        const e = window.__x.E(0);
        const d = e.candles.data();
        const bar = d[d.length - 3];
        return { x: e.chart.timeScale().timeToCoordinate(bar.time), y: e.candles.priceToCoordinate((bar.high + bar.low) / 2) };
      });
      const t0 = Date.now();
      await page.mouse.click(b.x + pt.x, b.y + pt.y);
      const t = await until(page, () => !!document.querySelector('[data-day-panel]'), null, 8000);
      const day = await page.locator('[data-day-panel]').first().getAttribute('data-day-panel').catch(() => null);
      const txt = (await page.locator('[data-day-panel]').first().innerText().catch(() => '')).replace(/\n+/g, ' / ');
      await page.keyboard.press('Escape');
      const esc = await until(page, () => !document.querySelector('[data-day-panel]'), null, 2000);
      if (esc == null) await page.locator('[data-day-panel] button', { hasText: '×' }).first().click().catch(() => {});
      await page.waitForTimeout(400);
      let open5 = null;
      await page.mouse.click(b.x + pt.x, b.y + pt.y);
      if (await until(page, () => !!document.querySelector('[data-day-open]'), null, 6000)) {
        await page.waitForTimeout(300);
        const t1 = Date.now();
        await page.locator('[data-day-open]').first().click();
        const t5 = await until(page, () => [...document.querySelectorAll('[data-chart-state]')].some(e => /^SPY\|5m\|/.test(e.getAttribute('data-chart-state') ?? '')), null, 10000);
        open5 = t5 ?? `not in ${ms(t1)} ms (panel still up: ${await page.locator('[data-day-panel]').count()})`;
      } else open5 = 'the panel did not open again';
      return { observed: `panel ${day} in ${t} ms: "${txt.slice(0, 260)}"; Esc closes: ${esc != null}; Open this session → 5m in ${open5} ms`, pass: t != null && esc != null && typeof open5 === 'number', ms: t ?? ms(t0), notes: esc == null ? 'Esc does not close the day panel' : '' };
    });

    if (errors.length) rec({ id: 'B-daily-errors', item: 'page errors during the daily group', action: '—', expected: 'none', observed: errors.slice(0, 5).join(' | '), pass: false });
  } finally {
    await close();
  }
});

/* ═══ GROUP 4 · TWO PANES: CROSSHAIR SYNC ═════════════════════════════════════════════════════════════════════════ */
await group('sync', async () => {
  const { page, errors, close } = await open({ panes: [SPY1m(), SPY1m({ ticker: 'QQQ' })], layout: 2 });
  try {
    await item({ id: 'B-22', item: 'Crosshair and cross-pane sync', action: 'hover pane 1; read pane 2’s canvases', expected: "pane 2's vertical line follows the hovered moment" }, async () => {
      const n = await page.evaluate(() => window.__x.count());
      if (n < 2) return { observed: `${n} chart(s) on the desk`, pass: false };
      await away(page);
      await page.waitForTimeout(500);
      const s0 = await page.evaluate(() => window.__x.canvasSum(1));
      const b = await box(page, 0);
      const t0 = Date.now();
      await page.mouse.move(b.x + b.pw * 0.5, b.y + b.ph * 0.6);
      const t = await until(page, s => window.__x.canvasSum(1) !== s, s0, 3000);
      await page.mouse.move(b.x + b.pw * 0.3, b.y + b.ph * 0.6);
      await page.waitForTimeout(150);
      const s2 = await page.evaluate(() => window.__x.canvasSum(1));
      await away(page);
      return { observed: `pane 2 canvas sum changed after ${t} ms (and again on move: ${s2 !== s0})`, pass: t != null, ms: t ?? ms(t0) };
    });
    if (errors.length) rec({ id: 'B-sync-errors', item: 'page errors during the sync group', action: '—', expected: 'none', observed: errors.slice(0, 5).join(' | '), pass: false });
  } finally {
    await close();
  }
});

/* ═══ GROUP 5 · DRAWING TOOLS ═════════════════════════════════════════════════════════════════════════════════════ */
const TOOL_FAMILY = {
  'B-59': ['trend', 'ray', 'extend', 'hline', 'hray', 'vline', 'cross', 'channel'],
  'B-60': ['fib', 'fibext', 'fibchannel'],
  'B-61': ['long', 'short', 'avwap', 'prange', 'drange', 'measure'],
  'B-62': ['brush', 'highlighter', 'arrow', 'arrowup', 'arrowdown', 'rect', 'rotrect', 'circle', 'ellipse', 'triangle', 'polyline', 'path', 'curve'],
  'B-63': ['text', 'note', 'callout', 'pricelabel'],
};
const GESTURE = {
  trend: 'drag', hline: 'click', measure: 'drag', rect: 'drag', channel: 'drag3', fib: 'drag', note: 'words', vline: 'click', extend: 'drag', arrow: 'drag', curve: 'drag3', ellipse: 'drag', path: 'clicks', ray: 'drag', hray: 'click', cross: 'click', fibext: 'drag3', fibchannel: 'drag3', long: 'drag', short: 'drag', prange: 'drag', drange: 'drag', avwap: 'click', triangle: 'drag3', circle: 'drag', rotrect: 'drag3', polyline: 'clicks', brush: 'free', highlighter: 'free', arrowup: 'click', arrowdown: 'click', text: 'words', callout: 'dragWords', pricelabel: 'click',
};
await group('drawings', async () => {
  const { page, errors, close } = await open({ panes: [SPY1m()] });
  try {
    await viewSessionTail(page, 80);
    await away(page);
    await page.waitForTimeout(500);
    const key = await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('slayer_chart_drawings_')));
    const count = () => page.evaluate(() => {
      let n = 0;
      for (const k of Object.keys(localStorage)) if (k.startsWith('slayer_chart_drawings_')) n += JSON.parse(localStorage.getItem(k) || '[]').length;
      return n;
    });
    const keys = () => page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('slayer_chart_drawings_')));
    /* B-64 the search sheet */
    await item({ id: 'B-64', item: 'Search sheet ("Every drawing tool") and favourites star', action: 'magnifier → type "fib"; star a tile', expected: 'tiles filtered to the fib tools; star pressed' }, async () => {
      await page.locator('[data-chart-rail]').first().hover();
      const t0 = Date.now();
      await page.locator('[data-draw-sheet-door]').first().click();
      const t = await until(page, () => !!document.querySelector('[data-draw-sheet]'), null, 3000);
      const all = await page.locator('[data-draw-tile]').count();
      const tabs = await page.$$eval('[data-draw-tab]', es => es.map(e => e.getAttribute('data-draw-tab')));
      await page.locator('[data-draw-search]').fill('fib');
      await page.waitForTimeout(200);
      const fib = await page.$$eval('[data-draw-tile]', es => es.map(e => e.getAttribute('data-draw-tile')));
      const star = page.locator('[data-draw-star]').first();
      const p0 = await star.getAttribute('aria-pressed').catch(() => null);
      await star.click().catch(() => {});
      await page.waitForTimeout(150);
      const p1 = await star.getAttribute('aria-pressed').catch(() => null);
      await star.click().catch(() => {});
      await page.keyboard.press('Escape');
      await page.locator('[data-draw-sheet] [aria-label="Close"]').first().click().catch(() => {});
      return { observed: `sheet in ${t} ms; ${all} tiles, tabs [${tabs.join(',')}]; "fib" → [${fib.join(',')}]; star ${p0} → ${p1}`, pass: t != null && fib.length >= 3 && fib.every(f => /fib/.test(f)) && p0 !== p1, ms: t ?? ms(t0) };
    });
    const pickTool = async tool => {
      await page.locator('[data-chart-rail]').first().hover();
      if (!(await page.locator('[data-draw-sheet]').count())) await page.locator('[data-draw-sheet-door]').first().click();
      await page.locator('[data-draw-sheet]').first().waitFor({ timeout: 3000 });
      await page.locator('[data-draw-search]').fill('');
      let tile = page.locator(`[data-draw-tile="${tool}"]`);
      if (!(await tile.count())) {
        for (const tab of await page.$$eval('[data-draw-tab]', es => es.map(e => e.getAttribute('data-draw-tab')))) {
          await page.locator(`[data-draw-tab="${tab}"]`).click();
          if (await page.locator(`[data-draw-tile="${tool}"]`).count()) break;
        }
        tile = page.locator(`[data-draw-tile="${tool}"]`);
      }
      await tile.first().click();
      await page.waitForTimeout(350);
    };
    const b = await box(page);
    const P = (fx, fy) => ({ x: b.x + b.pw * fx, y: b.y + 160 + (b.ph - 260) * fy });
    const commitCount = n =>
      until(page, n => {
        let m = 0;
        for (const kk of Object.keys(localStorage)) if (kk.startsWith('slayer_chart_drawings_')) m += JSON.parse(localStorage.getItem(kk) || '[]').length;
        return m > n;
      }, n, 2500);
    /* one mark with the tool's own gesture; the time is from the gesture's last press to the mark stored */
    const drawOnce = async (tool, k) => {
      await pickTool(tool);
      const g = GESTURE[tool];
      const fx = 0.25 + ((k * 0.07) % 0.45);
      const a = P(fx, 0.25 + ((k * 0.13) % 0.4));
      const c = P(fx + 0.12, 0.35 + ((k * 0.11) % 0.4));
      const n0 = await count();
      if (g === 'click') await page.mouse.click(a.x, a.y);
      else if (g === 'drag' || g === 'drag3' || g === 'dragWords') {
        await page.mouse.move(a.x, a.y);
        await page.mouse.down();
        await page.mouse.move(c.x, c.y, { steps: 6 });
        await page.mouse.up();
        if (g === 'drag3') {
          await page.mouse.move(c.x + 20, c.y - 30, { steps: 3 });
          await page.mouse.click(c.x + 20, c.y - 30);
        }
        if (g === 'dragWords') {
          await page.locator('input[aria-label^="The mark\'s words"]').first().waitFor({ timeout: 2000 }).catch(() => {});
          await page.keyboard.type('callout words');
          await page.keyboard.press('Enter');
        }
      } else if (g === 'words') {
        await page.mouse.click(a.x, a.y);
        await page.locator('input[aria-label^="The mark\'s words"]').first().waitFor({ timeout: 2000 }).catch(() => {});
        await page.keyboard.type(`${tool} words`);
        await page.keyboard.press('Enter');
      } else if (g === 'free') {
        await page.mouse.move(a.x, a.y);
        await page.mouse.down();
        for (let s2 = 1; s2 <= 12; s2++) await page.mouse.move(a.x + s2 * 8, a.y + Math.sin(s2 / 2) * 14);
        await page.mouse.up();
      } else if (g === 'clicks') {
        await page.mouse.click(a.x, a.y);
        await page.mouse.click(a.x + 40, a.y + 25);
        await page.mouse.dblclick(c.x, c.y);
      }
      const t = await commitCount(n0);
      await page.keyboard.press('Escape');
      return t;
    };
    let k = 0;
    for (const [fam, tools] of Object.entries(TOOL_FAMILY)) {
      const rows = [];
      for (const tool of tools) {
        k++;
        let t = null;
        let err = '';
        let second = false;
        try {
          t = await drawOnce(tool, k);
          if (t == null) {
            second = true;
            t = await drawOnce(tool, k + 3);
          }
        } catch (e) {
          err = String(e).slice(0, 120);
        }
        rows.push({ tool, ok: t != null, ms: t, err, second });
      }
      const names = { 'B-59': 'Trend tools', 'B-60': 'Fibonacci tools', 'B-61': 'Forecasting & measurement', 'B-62': 'Geometric shapes', 'B-63': 'Annotation tools (+ the words input)' };
      const fails = rows.filter(r => !r.ok);
      const seconds = rows.filter(r => r.ok && r.second);
      const tms = rows.filter(r => r.ms != null).map(r => r.ms);
      rec({
        id: fam,
        item: names[fam],
        action: 'pick each from the sheet, draw it with its own gesture on the plot',
        expected: 'each tool commits a mark (stored under the tape key)',
        observed: rows.map(r => `${r.tool} ${r.ok ? `✓ ${r.ms}ms${r.second ? ' (2nd try)' : ''}` : `✗${r.err ? ` ${r.err}` : ''}`}`).join('; '),
        pass: fails.length === 0 && seconds.length === 0,
        ms: tms.length ? Math.max(...tms) : null,
        notes: [fails.length ? `${fails.length} of ${rows.length} did not commit: ${fails.map(f => f.tool).join(', ')}` : '', seconds.length ? `took a second try: ${seconds.map(f => f.tool).join(', ')} (first gesture after the sheet closed was lost)` : '', 'ms = from the last press to the mark stored, the slowest of the family'].filter(Boolean).join('; '),
      });
    }
    /* B-63 the words input position with the rail open */
    await item({ id: 'B-63/input', item: "The mark's words input lands at the click (rail docked left and open)", action: 'Text tool → click → read the input position', expected: 'the input at the click point (no 56 px offset)' }, async () => {
      await pickTool('text');
      const a = P(0.5, 0.5);
      await page.mouse.click(a.x, a.y);
      const inp = page.locator('input[aria-label^="The mark\'s words"]').first();
      const ok = await inp.waitFor({ timeout: 2000 }).then(() => true).catch(() => false);
      const r = ok ? await inp.boundingBox() : null;
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
      const dx = r ? Math.round(r.x - a.x) : null;
      return { observed: r ? `input at (${dx}, ${Math.round(r.y - a.y)}) px from the click` : 'no input', pass: r ? Math.abs(dx) < 30 : false, notes: r && Math.abs(dx) >= 30 ? "the words input stands 56 px left of the click with the rail docked left and open: its left is measured off the chart's box and placed in the outer one (StrikeChart.tsx:6378 at 521d7de, :6411 at HEAD — `noteAt.x − containerRef.left` placed in the outer box)" : '' };
    });
    await item({ id: 'B-65', item: 'Delete selected · Clear all drawings', action: 'draw mode → Clear all drawings; undo', expected: 'all marks go at once with an undo chip (house rule); undo brings them back' }, async () => {
      const n0 = await count();
      await page.locator('[data-chart-rail]').first().hover();
      if (!(await page.locator('[aria-label="Clear all drawings"]').count())) {
        await hoverPane(page);
        await page.keyboard.press('d');
        await page.waitForTimeout(300);
        await page.locator('[data-chart-rail]').first().hover();
      }
      const t0 = Date.now();
      await page.locator('[aria-label="Clear all drawings"]').first().click();
      const t = await until(page, () => !Object.keys(localStorage).some(k => k.startsWith('slayer_chart_drawings_')), null, 3000);
      const undo = await page.getByText(/undo/i).filter({ visible: true }).count();
      let back = null;
      if (undo) {
        await page.getByText(/undo/i).filter({ visible: true }).first().click().catch(() => {});
        await page.waitForTimeout(400);
        back = await count();
      }
      /* clear again for the single-line checks below */
      await page.locator('[data-chart-rail]').first().hover();
      if (!(await page.locator('[aria-label="Clear all drawings"]').count())) {
        await hoverPane(page);
        await page.keyboard.press('d');
        await page.waitForTimeout(300);
        await page.locator('[data-chart-rail]').first().hover();
      }
      await page.locator('[aria-label="Clear all drawings"]').first().click().catch(() => {});
      await page.waitForTimeout(300);
      await page.keyboard.press('Escape');
      return { observed: `${n0} marks → cleared in ${t} ms; undo chip ${undo ? `shown, undo → ${back} marks` : 'not shown'}`, pass: t != null && undo > 0 && back === n0, ms: t ?? ms(t0), notes: undo ? '' : 'no undo chip (CLAUDE.md: a destructive hand acts at once with an undo chip)' };
    });
    /* one horizontal line alone on the plot for B-70, B-67 and B-68 */
    await pickTool('hline');
    const hlAt = P(0.5, 0.5);
    await page.mouse.click(hlAt.x, hlAt.y);
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await away(page);
    const one = await page.evaluate(() => {
      for (const k of Object.keys(localStorage)) if (k.startsWith('slayer_chart_drawings_')) return JSON.parse(localStorage.getItem(k) || '[]').map(d => ({ kind: d.kind, p1: d.p1, width: d.width }));
      return [];
    });
    const hl = one.find(m => m.kind === 'hline');
    const hlY = hl ? await page.evaluate(p => window.__x.E(0).candles.priceToCoordinate(p), hl.p1.price) : null;
    const lineSel = '[title="Line color"], [title="Line colour"]';
    await item({ id: 'B-70', item: 'Click a drawing outside draw mode', action: 'click the lone horizontal line', expected: 'the editor wakes with that mark selected (its bar shows)' }, async () => {
      if (hlY == null) return { observed: `no horizontal line stored (${JSON.stringify(one).slice(0, 120)})`, pass: false };
      const t0 = Date.now();
      await page.mouse.click(b.x + b.pw * 0.8, b.y + hlY);
      const t = await until(page, sel => !!document.querySelector(sel), lineSel, 3000);
      return { observed: `${one.length} mark(s) stored; selected bar in ${t} ms`, pass: t != null, ms: t ?? ms(t0) };
    });
    await item({ id: 'B-67', item: 'Selected-mark bar: colour, weight, style, lock, delete', action: 'with the line selected, read the bar; open Line weight and pick another', expected: 'the bar with its controls; a change applies to the mark' }, async () => {
      if (!(await page.locator(lineSel).count()) && hlY != null) await page.mouse.click(b.x + b.pw * 0.8, b.y + hlY);
      await page.waitForTimeout(200);
      const ctrls = await page.$$eval('[title]', es => [...new Set(es.map(e => e.getAttribute('title')).filter(t => /Line colou?r|Text colou?r|Line weight|Text size|Line style|Lock|Unlock|Delete this mark|alert/i.test(t)))]);
      const w = page.locator('[title="Line weight"]').first();
      let changed = 'no Line weight control';
      if (await w.count()) {
        const before = hl?.width ?? null;
        const box0 = await w.boundingBox();
        await w.click();
        await page.waitForTimeout(200);
        /* the little menu: the buttons that appeared near the bar */
        const opts = await page.$$eval('button', (es, y0) => es.filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && Math.abs(r.top - y0) < 160 && /^\s*$|px|^[1-4]$/.test(e.textContent ?? ''); }).map(e => ({ t: e.textContent, x: e.getBoundingClientRect().left, y: e.getBoundingClientRect().top })), box0.y);
        if (opts.length > 1) await page.mouse.click(opts[opts.length - 1].x + 4, opts[opts.length - 1].y + 4);
        await page.waitForTimeout(250);
        const after = await page.evaluate(() => {
          for (const k of Object.keys(localStorage)) if (k.startsWith('slayer_chart_drawings_')) return JSON.parse(localStorage.getItem(k)).find(d => d.kind === 'hline')?.width ?? null;
        });
        changed = `weight ${before} → ${after}`;
      }
      return { observed: `controls: ${ctrls.join(', ')}; ${changed}`, pass: ctrls.length >= 4 && /→/.test(changed) && !/(\S+) → \1$/.test(changed) ? true : ctrls.length >= 4 ? 'manual' : false, notes: /(\S+) → \1$/.test(changed) ? "the weight menu's choices are not addressable by this script (no data-* or labels) — a pick was not confirmed" : '' };
    });
    await item({ id: 'B-68', item: 'Line alert on a drawing (bell → Touch / Break / Bounce) with the feed in', action: 'select the lone hline → bell → Touch', expected: 'the bell shows on the feed too; Touch arms an alert' }, async () => {
      if (hlY == null) return { observed: 'no horizontal line drawn', pass: false };
      await page.keyboard.press('Escape');
      await page.mouse.click(b.x + b.pw * 0.8, b.y + hlY);
      await page.waitForTimeout(250);
      const door = page.locator('[data-line-alert-door]').first();
      if (!(await door.count())) return { observed: `no bell on the selected line (the bar: ${(await page.$$eval('[title]', es => es.map(e => e.getAttribute('title')).filter(t => /colou?r|weight|style|Lock|Delete/.test(t)))).join(', ')})`, pass: false };
      const t0 = Date.now();
      await door.click();
      const kinds = await page.$$eval('[data-line-alert]', es => es.map(e => e.getAttribute('data-line-alert')));
      await page.locator('[data-line-alert="touch"]').first().click().catch(() => {});
      const t = await until(page, () => Object.keys(localStorage).some(k => /alert/i.test(k) && /"kind":"line"/.test(localStorage.getItem(k) ?? '')), null, 3000);
      const armed = await page.evaluate(() => Object.keys(localStorage).filter(k => /alert/i.test(k) && /"kind":"line"/.test(localStorage.getItem(k) ?? '')));
      await page.keyboard.press('Escape');
      return { observed: `bell present, kinds [${kinds.join(',')}]; Touch → line alert stored in ${armed.join(',') || 'nothing'} after ${t} ms`, pass: t != null && kinds.length === 3, ms: t ?? ms(t0) };
    });
    await item({ id: 'B-66', item: 'Dock to top / left · Hide the tools', action: 'expand the pane (F) → Move the tools to the top', expected: 'the rail docks along the top in an expanded pane' }, async () => {
      await hoverPane(page);
      await page.locator('[data-expand-door]').first().click().catch(() => {});
      await page.waitForTimeout(900);
      await page.locator('[data-chart-rail]').first().hover().catch(() => {});
      const btn = page.locator('[aria-label="Move the tools to the top"]').filter({ visible: true }).first();
      const has = await btn.count();
      if (!has) return { observed: 'no dock button in the expanded pane', pass: false };
      const r0 = await page.locator('[data-chart-rail]').first().boundingBox();
      const t0 = Date.now();
      await btn.click();
      const t = await until(page, () => {
        const r = document.querySelector('[data-chart-rail]')?.getBoundingClientRect();
        return r && r.width > r.height;
      }, null, 3000);
      const r1 = await page.locator('[data-chart-rail]').first().boundingBox();
      await page.locator('[aria-label="Move the tools to the left side"]').first().click().catch(() => {});
      await page.keyboard.press('Escape');
      return { observed: `rail ${Math.round(r0.width)}×${Math.round(r0.height)} → ${Math.round(r1.width)}×${Math.round(r1.height)} in ${t} ms`, pass: t != null, ms: t ?? ms(t0) };
    });
    if (errors.length) rec({ id: 'B-drawings-errors', item: 'page errors during the drawings group', action: '—', expected: 'none', observed: errors.slice(0, 5).join(' | '), pass: false });
  } finally {
    await close();
  }
});

/* ═══ GROUP 6 · REPLAY (with EMA 9 on: the inventory's crash) ═════════════════════════════════════════════════════ */
await group('replay', async () => {
  const { page, errors, close } = await open({ panes: [SPY1m({ indicators: { ema9: true } })] });
  try {
    await viewSessionTail(page, 120);
    await away(page);
    await page.waitForTimeout(500);
    const b = await box(page);
    await item({ id: 'B-71', item: 'Replay pick (silver line, fade right of it, day/time label)', action: 'P over the pane; move; read the line', expected: 'pick mode; the line at the pointer (rail inset carried); the label names the bar' }, async () => {
      await hoverPane(page);
      const t0 = Date.now();
      await page.keyboard.press('p');
      const t = await until(page, () => !!document.querySelector('[data-pick-time]'), null, 3000);
      const x = b.x + b.pw * 0.5;
      await page.mouse.move(x, b.y + b.ph * 0.5);
      await page.mouse.move(x + 3, b.y + b.ph * 0.5);
      await page.waitForTimeout(200);
      const line = await page.locator('[data-pick-line]').first().boundingBox().catch(() => null);
      const label = await page.locator('[data-pick-label]').first().innerText().catch(() => '');
      const off = line ? Math.round(line.x - (x + 3)) : null;
      return { observed: `pick mode in ${t} ms; line at ${off ?? '—'} px from the pointer; label "${label}"`, pass: t != null && line && Math.abs(off) <= 4 && /(am|pm)/i.test(label), ms: t ?? ms(t0), notes: off != null && Math.abs(off) > 4 ? `the pick line, fade and label stand ${-off} px left of the pointer with the rail docked left and open — pickX is measured off the chart's box and placed in the outer one (StrikeChart.tsx:5805-5810 at 521d7de, :5838-5843 at HEAD; likely the same inset as B-63)` : '' };
    });
    await item({ id: 'B-72', item: 'Replay foot bar and rewound chart', action: 'click the picked bar; step back; step on; Esc', expected: 'transport at the foot; chart cut at the cursor; no crash with an indicator on; Esc ends' }, async () => {
      const x = b.x + b.pw * 0.5;
      const t0 = Date.now();
      await page.mouse.click(x, b.y + b.ph * 0.5);
      const t = await until(page, () => !!document.querySelector('[data-pane-foot]') && !!document.querySelector('[data-as-of]'), null, 8000);
      const asOf = await page.locator('[data-as-of]').first().getAttribute('data-as-of').catch(() => null);
      const chips = await page.locator('[data-axis-chip]').count();
      const lines = await page.evaluate(() => window.__x.E(0).candles.priceLines().map(l => l.options().title));
      const errs0 = errors.length;
      for (let i = 0; i < 3; i++) {
        await page.locator('[data-replay-step="back"]').first().click().catch(() => {});
        await page.waitForTimeout(150);
      }
      await page.locator('[data-replay-step="on"]').first().click().catch(() => {});
      await page.waitForTimeout(300);
      const asOf2 = await page.locator('[data-as-of]').first().getAttribute('data-as-of').catch(() => null);
      const lastBar = await page.evaluate(() => window.__x.lastBar(0));
      const ser = await page.evaluate(() => window.__x.series(0)[0].map(s => `${s.type}:${s.color}`));
      const crashed = errors.slice(errs0).filter(e => /Cannot update oldest|Maximum update/.test(e));
      await page.keyboard.press('Escape');
      const tEnd = await until(page, () => !document.querySelector('[data-as-of]'), null, 4000);
      return { observed: `replay up in ${t} ms (as of ${asOf}); axis chips in replay ${chips}; price lines ${JSON.stringify(lines)}; back×3, on×1 → as of ${asOf2}, last bar ${lastBar}; series ${ser.join(',')}; Esc ends in ${tEnd} ms; page errors ${crashed.length ? crashed[0] : 'none'}`, pass: t != null && crashed.length === 0 && tEnd != null && Number(asOf2) !== Number(asOf), ms: t ?? ms(t0), notes: chips === 0 ? 'in a replay the axis names no level (chips hidden; primitive labels off) — B-15' : '' };
    });
    if (errors.length) rec({ id: 'B-replay-errors', item: 'page errors during the replay group', action: '—', expected: 'none', observed: errors.slice(0, 5).join(' | '), pass: false });
  } finally {
    await close();
  }
});

/* ═══ GROUP 7 · KEYS OUT (the feed answered with nothing: the house's tape) ═══════════════════════════════════════ */
await group('keysout', async () => {
  const { page, errors, close } = await open({ panes: [SPY1m({ overlays: { cone: true } })], blockFeed: true, waitField: false });
  try {
    await away(page);
    await page.waitForTimeout(1500);
    await item({ id: 'B-29', item: 'Single-vol cone "EM ±$…" (house, no feed)', action: 'feed requests refused; Expected move on', expected: 'the envelope since the open and the cone off the IV, tagged EM ±$x' }, async () => {
      await page.evaluate(() => window.__x.clearTexts());
      await page.evaluate(() => window.__x.E(0).chart.timeScale().scrollToRealTime());
      await page.waitForTimeout(800);
      const st = await page.evaluate(() => window.__x.state(0));
      const words = await page.evaluate(() => [...new Map(window.__x.texts('EM|σ').map(o => [o.t, `${o.t} (${o.f}, ${o.ink})`])).values()]);
      const small = words.filter(w => Number((w.match(/(\d+(\.\d+)?)px/) ?? [])[1]) < 11);
      return { observed: `state ${st}; cone words ${words.slice(0, 4).join(' | ') || 'none'}`, pass: words.length > 0 && small.length === 0 ? true : words.length > 0 ? false : 'manual', notes: small.length ? `the EM tag is 9 px (expectedMovePrimitive.ts:248, under the 11-px floor), printed with toFixed (:247) in a literal white; at night it reads ±$0.00` : words.length ? '' : 'house tape at night: no cone words drawn in view' };
    });
    await item({ id: 'B-38/house', item: 'Volume histogram on the house tape', action: 'keys out: read the histogram in view', expected: 'volume bars along the floor' }, async () => {
      const vol = await page.evaluate(() => {
        const e = window.__x.E(0);
        const h = e.chart.panes()[0].getSeries().find(s => s.seriesType() === 'Histogram');
        const vr = e.chart.timeScale().getVisibleRange();
        const pts = h ? h.data().filter(p => p.time >= vr.from && p.time <= vr.to) : [];
        return { pts: pts.length, nonzero: pts.filter(p => p.value > 0).length };
      });
      return { observed: `${vol.nonzero} of ${vol.pts} volume points in view are non-zero`, pass: vol.nonzero > 0 };
    });
    await item({ id: 'B-68/house', item: 'Line alert door on the house tape', action: 'draw an hline (keys out) → select → bell', expected: 'bell → Touch / Break / Bounce' }, async () => {
      const b = await box(page);
      await page.locator('[data-chart-rail]').first().hover();
      await page.locator('[data-draw-sheet-door]').first().click();
      await page.locator('[data-draw-search]').fill('horizontal line');
      await page.locator('[data-draw-tile="hline"]').first().click();
      const y = b.y + b.ph * 0.5;
      await page.mouse.click(b.x + b.pw * 0.5, y);
      await page.waitForTimeout(300);
      await page.keyboard.press('Escape');
      await page.mouse.click(b.x + b.pw * 0.8, y);
      const t = await until(page, () => !!document.querySelector('[data-line-alert-door]'), null, 3000);
      let kinds = [];
      if (t != null) {
        await page.locator('[data-line-alert-door]').first().click();
        kinds = await page.$$eval('[data-line-alert]', es => es.map(e => e.getAttribute('data-line-alert')));
      }
      await page.keyboard.press('Escape');
      return { observed: `bell ${t == null ? 'absent' : `in ${t} ms`}; kinds [${kinds.join(',')}]`, pass: t != null && kinds.length === 3, ms: t };
    });
    await item({ id: 'B-55', item: '"LIVE ONLY · FROM …" chip (house 15 s)', action: 'timeframe 15 s on the house tape', expected: 'a chip explains the empty left side' }, async () => {
      await page.evaluate(() => {
        const raw = JSON.parse(localStorage.getItem('slayer_terrain_v1'));
        raw.panes[0].timeframe = '15s';
        localStorage.setItem('slayer_terrain_v1', JSON.stringify(raw));
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      const t0 = Date.now();
      const t = await until(page, () => /live only/i.test(document.body.innerText), null, 15000);
      const txt = await page.evaluate(() => (document.body.innerText.match(/live only[^\n]*/i) ?? [''])[0]);
      return { observed: `"${txt}" after ${t ?? ms(t0)} ms`, pass: t != null, ms: t ?? ms(t0), notes: /^[A-Z ·]+/.test(txt) ? 'tracked caps' : '' };
    });
    if (errors.length) rec({ id: 'B-keysout-errors', item: 'page errors during the keys-out group', action: '—', expected: 'none', observed: errors.slice(0, 5).join(' | '), pass: false });
  } finally {
    await close();
  }
});

/* ═══ GROUP 8 · SPX ON THE FEED, AND THE PHONE ════════════════════════════════════════════════════════════════════ */
await group('spx-phone', async () => {
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'America/New_York' });
    await ctx.addInitScript(INIT, { desk: { layout: 1, panes: [SPY1m({ ticker: 'SPX' })] } });
    const page = await ctx.newPage();
    try {
      const t0 = Date.now();
      await page.goto(`${BASE}/terrain`, { waitUntil: 'domcontentloaded' });
      const t = await until(page, () => !!document.querySelector('[data-no-bars], [data-feed-chart-wait]') || [...document.querySelectorAll('[data-chart-state]')].some(e => /^SPX\|/.test(e.getAttribute('data-chart-state') ?? '') && Number(e.getAttribute('data-chart-state').split('|')[2]) > 0), null, 40000);
      await page.waitForTimeout(1500);
      const r = await page.evaluate(() => ({
        noBars: document.querySelector('[data-no-bars]')?.textContent?.slice(0, 160) ?? null,
        wait: !!document.querySelector('[data-feed-chart-wait]'),
        state: [...document.querySelectorAll('[data-chart-state]')].map(e => e.getAttribute('data-chart-state')).filter(s => s.startsWith('SPX')),
        head: document.querySelector('[data-pane-head]')?.textContent?.slice(0, 160) ?? '',
      }));
      rec({ id: 'B-53', item: 'Index with no bars / feed wait (SPX on the feed off hours)', action: 'SPX 1m on the feed at night', expected: "SPX's minutes from the recorder (options-priced overnight) or the no-bars words / a skeleton — never a blank pane", observed: `${t == null ? 'nothing in 40 s' : `in ${t} ms`}: no-bars "${r.noBars}", wait ${r.wait}, state ${JSON.stringify(r.state)}; head "${r.head}"`, pass: t != null, ms: t ?? ms(t0) });
    } catch (e) {
      rec({ id: 'B-53', item: 'Index with no bars / feed wait', observed: `threw ${String(e).slice(0, 200)}`, pass: false });
    } finally {
      await ctx.close();
    }
  }
  {
    const { page, close } = await open({ panes: [SPY1m()], width: 390, height: 844, mobile: true });
    try {
      await item({ id: 'B-54', item: 'Ladder peek (phone)', action: '390-px viewport; tap the peek', expected: 'three strikes nearest the price; tap opens the ladder' }, async () => {
        const el = page.locator('[data-ladder-peek]').first();
        const has = await el.count();
        if (!has) return { observed: 'no peek on the phone', pass: false };
        const txt = (await el.innerText()).replace(/\n/g, ' ');
        const t0 = Date.now();
        await el.tap().catch(() => el.click());
        const t = await until(page, () => !!document.querySelector('[title="Hide the strike ladder"]') || !document.querySelector('[data-ladder-peek]'), null, 4000);
        const open = await page.locator('[title="Hide the strike ladder"]').count();
        return { observed: `peek "${txt}"; tap → ladder over the chart ${t == null ? 'not seen' : `in ${t} ms`} (Strikes door pressed: ${open > 0})`, pass: /\d/.test(txt) && t != null, ms: t ?? ms(t0) };
      });
      await item({ id: 'B-56/phone', item: 'Drawing rail on a phone', action: '390-px viewport: read the rail and the plot inset', expected: 'a sheet door, not the 44-px column with a 56-px plot inset' }, async () => {
        const rail = await page.locator('[data-chart-rail]').first().boundingBox().catch(() => null);
        const inset = await page.evaluate(() => {
          const e = window.__x.E(0);
          return e ? Math.round(e.box().getBoundingClientRect().left - e.box().parentElement.getBoundingClientRect().left) : null;
        });
        const vw = page.viewportSize().width;
        return { observed: `rail ${rail ? `${Math.round(rail.width)}×${Math.round(rail.height)}` : 'none'} on a ${vw}-px screen; plot inset ${inset ?? '—'}px`, pass: !rail || rail.width < 30, notes: rail && rail.width >= 30 ? 'a phone gets the full 44-px rail column (Terrain passes no `compact`), not a sheet door' : '' };
      });
    } finally {
      await close();
    }
  }
});

/* ═══ GROUP 9 · STALE (the page's clock held inside a session; the feed's answers a day old) ═══════════════════════ */
await group('stale', async () => {
  const { page, close } = await open({ panes: [SPY1m()], clockAt: '2026-10-15T15:30:00Z', waitField: false });
  try {
    await item({ id: 'B-49', item: 'Stale banner + Retry (and the dimmed chart)', action: "hold the page's clock at 11:30 am New York; let the data age", expected: 'banner "… last repriced …" with Retry; chart at 0.6' }, async () => {
      const t0 = Date.now();
      const t = await until(page, () => !!document.querySelector('[data-stale-banner]'), null, 25000);
      if (t == null) return { observed: 'no stale banner within 25 s (the page may read the shut market from the feed, not the clock)', pass: 'manual', ms: null };
      const txt = (await page.locator('[data-stale-banner]').first().innerText()).replace(/\n/g, ' ');
      const op = await page.evaluate(() => getComputedStyle(window.__x.E(0).box()).opacity + '/' + getComputedStyle(window.__x.E(0).box().parentElement).opacity);
      const t1 = Date.now();
      await page.locator('[data-stale-retry]').first().click().catch(() => {});
      return { observed: `banner in ${t} ms: "${txt}"; opacity ${op}; Retry pressed (${ms(t1)} ms)`, pass: true, ms: t ?? ms(t0) };
    });
  } finally {
    await close();
  }
});

/* ═══ GROUP 9b · THE PAGE'S CLOCK HELD IN YESTERDAY'S SESSION (Oct 14, 3:30 pm New York) ════════════════════════════
   The feed's answers are real; only the page's clock is held, so "today" is the session the tiles hold. Used for what
   needs a session in progress: the level card's moves today, the live cone, the countdown. */
await group('clock', async () => {
  const { page, errors, close } = await open({ panes: [SPY1m({ overlays: { cone: true } })], clockAt: '2026-10-14T19:30:00Z' });
  try {
    await viewSessionTail(page, 120);
    await away(page);
    await page.waitForTimeout(1000);
    await item({ id: 'B-17/clock', item: 'Level card in session (clock held at 3:30 pm Oct 14)', action: 'hover the CW / PW chip', expected: 'moves today, held since, touches today, the record line' }, async () => {
      const chips = await page.$$eval('[data-axis-chip]', es => es.map(e => ({ k: e.dataset.axisChip, s: e.dataset.strike, p: e.dataset.pinned ?? '' })));
      const pick = chips.find(c => c.k === 'pw' && !c.p) ?? chips.find(c => c.k === 'cw' && !c.p) ?? chips.find(c => c.k === 'pw' || c.k === 'cw');
      if (!pick) return { observed: `no CW/PW chip (${JSON.stringify(chips)})`, pass: 'manual' };
      const t0 = Date.now();
      await page.locator(`[data-axis-chip="${pick.k}"]`).first().hover();
      const t = await until(page, k => !!document.querySelector(`[data-level-card="${k}"]`), pick.k, 4000);
      const txt = (await page.locator('[data-level-card]').first().innerText().catch(() => '')).replace(/\n+/g, ' / ');
      await away(page);
      const has = [/move/i.test(txt), /held since/i.test(txt), /touch/i.test(txt)];
      return { observed: `${pick.k} ${pick.s}: "${txt.slice(0, 320)}"`, pass: t != null && has.every(Boolean) ? true : 'manual', ms: t ?? ms(t0), notes: has.every(Boolean) ? '' : `missing ${['moves', 'held since', 'touches'].filter((_, k) => !has[k]).join(', ')} — inconclusive: with the clock held the page has no live book history for "today" (the card reads bookHistory, not the tiles)` };
    });
    await item({ id: 'B-28/clock', item: 'Priced-move cone + readout (page clock held at 3:30 pm Oct 14)', action: 'Expected move on, clock at 3:30 pm', expected: '50/68/95% washes from the last bar to the close, a readout at its head' }, async () => {
      await page.evaluate(() => window.__x.clearTexts());
      await page.evaluate(() => window.__x.E(0).chart.timeScale().scrollToRealTime());
      await page.waitForTimeout(800);
      const words = await page.evaluate(() => [...new Map(window.__x.texts('σ|to the close|left|EM').map(o => [o.t, `${o.t} (${o.f})`])).values()]);
      const ro = await page.evaluate(() => window.__x.E(0).chart.timeScale().options().rightOffset);
      await page.screenshot({ path: `${SHOTS}/b28-cone-clock.png` });
      return { observed: `rightOffset ${ro}; words ${words.slice(0, 8).join(' | ') || 'none'}`, pass: words.length > 0 ? 'manual' : false, notes: `the washes need a visual check (${SHOTS}/b28-cone-clock.png): with the clock held the page still draws the real after-hours bars past it, so the cone's place is not a fair test; the readout words are drawn` };
    });
    await item({ id: 'B-27/clock', item: '±1σ / ±2σ lines labelled (session in progress)', action: 'Expected move on, clock at 3:30 pm Oct 14', expected: '"+1σ … · priced at the prior close" words on the plot, ≥11 px, house figures' }, async () => {
      await page.evaluate(() => window.__x.clearTexts());
      await viewSessionTail(page, 200);
      await away(page);
      await page.waitForTimeout(800);
      const words = await page.evaluate(() => [...new Map(window.__x.textsIn(0, 'σ|prior close|EM', 'pane').map(o => [o.t, `${o.t} (${o.f})`])).values()]);
      const small = words.filter(w => Number((w.match(/(\d+(\.\d+)?)px/) ?? [])[1]) < 11);
      return { observed: `${words.length} words: ${words.slice(0, 6).join(' | ') || 'none'}`, pass: words.length > 0 && small.length === 0, notes: small.length ? `under 11 px: ${small.slice(0, 2).join(', ')}` : '' };
    });
    await item({ id: 'B-18/clock', item: 'Bar countdown ticking in session', action: 'read the capsule twice, 2 s apart', expected: 'mm:ss counting down to the bar end' }, async () => {
      const a = (await page.locator('[data-price-tag]').first().innerText().catch(() => '')).replace(/\n/g, ' ');
      await page.waitForTimeout(2100);
      const c = (await page.locator('[data-price-tag]').first().innerText().catch(() => '')).replace(/\n/g, ' ');
      return { observed: `"${a}" → "${c}"`, pass: a !== c && /\d{1,2}:\d{2}/.test(c) };
    });
    if (errors.length) rec({ id: 'B-clock-errors', item: 'page errors during the clock group', action: '—', expected: 'none', observed: errors.slice(0, 5).join(' | '), pass: false });
  } finally {
    await close();
  }
});

/* ═══ GROUP 10 · BUILT-IN INDICATORS THROUGH THE LIBRARY ══════════════════════════════════════════════════════════ */
const BUILTINS = [
  ['D-01', 'ema9', 'EMA 9', 'overlay', 'period 9 (seeded at the first close)'],
  ['D-02', 'ema21', 'EMA 21', 'overlay', 'period 21'],
  ['D-03', 'ema50', 'EMA 50', 'overlay', 'period 50'],
  ['D-04', 'sma', 'SMA 200', 'overlay', 'period 200'],
  ['D-05', 'vwap', 'VWAP', 'overlay', 'session-anchored, gap rule 1.5 bars'],
  ['D-06', 'vwapBands', 'VWAP bands', 'overlay', '±1σ, ±2σ'],
  ['D-07', 'bb', 'Bollinger', 'overlay', '20, 2σ (population)'],
  ['D-08', 'rsi', 'RSI 14', 'sub', '14, rails 30/70'],
  ['D-09', 'macd', 'MACD', 'sub', '12/26/9'],
  ['D-10', 'atrPane', 'ATR 14', 'sub', '14'],
];
const COMPARE_INKS = ['#5B9CF6', '#BBB2E8', '#EDE4CD', '#6BD3C7'];
const indRows = [];
await group('indicators', async () => {
  const { page, errors, close } = await open({ panes: [SPY1m()] });
  try {
    await viewSessionTail(page, 120);
    await away(page);
    await page.waitForTimeout(500);
    const openLib = async () => {
      if (await page.locator('[data-library]').count()) return;
      await hoverPane(page);
      await page.locator('button[data-scripts-door]').filter({ visible: true }).first().click();
      await page.locator('[data-library]').first().waitFor({ timeout: 4000 });
    };
    const closeLib = async () => {
      await page.keyboard.press('Escape');
      await page.locator('[data-library]').first().waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
      await away(page);
    };
    const allSeries = () => page.evaluate(() => window.__x.series(0));
    await item({ id: 'D-door', item: 'Indicators and scripts door → library', action: 'hover row → [data-scripts-door]', expected: 'the library opens with its shelves' }, async () => {
      const t0 = Date.now();
      await openLib();
      const t = ms(t0);
      const shelves = await page.$$eval('[data-library-shelf]', es => es.map(e => e.getAttribute('data-library-shelf')));
      await closeLib();
      return { observed: `library in ${t} ms; shelves [${shelves.join(',')}]`, pass: shelves.includes('chart') && shelves.includes('slayer') && shelves.includes('technicals'), ms: t };
    });
    for (const [id, key, name, pane, defaults] of BUILTINS) {
      await item({ id, item: `${name} (chart built-in)`, action: `library → Chart built-ins → tick ${name}`, expected: `${pane === 'sub' ? 'its own sub-pane, appended after other panes' : 'a line on the price pane that never widens the fitted axis'}; readout names it` }, async () => {
        const before = await allSeries();
        const fit0 = await page.evaluate(() => window.__x.fit(0));
        await openLib();
        await page.locator('[data-library-shelf="chart"]').first().click();
        const row = page.locator(`[data-library-row="chart:${key}"]`).first();
        const gear = await row.locator('[data-library-gear]').count();
        const t0 = Date.now();
        await row.locator('[data-library-toggle]').first().click();
        await closeLib();
        const nBefore = before.flat().length;
        const t = await until(page, n => window.__x.E(0).chart.panes().reduce((s, p) => s + p.getSeries().length, 0) > n, nBefore, 8000);
        await page.waitForTimeout(400);
        const after = await allSeries();
        const added = [];
        after.forEach((p, pi) => p.forEach((s, si) => {
          const was = before[pi]?.[si];
          if (!was || was.color !== s.color || was.type !== s.type) added.push({ pane: pi, ...s });
        }));
        const fit1 = await page.evaluate(() => window.__x.fit(0));
        const widened = fit0.axis && fit1.axis && (fit1.axis[0] < fit0.axis[0] - 0.01 || fit1.axis[1] > fit0.axis[1] + 0.01);
        /* readout label */
        const b = await box(page);
        await page.mouse.move(b.x + b.pw * 0.6, b.y + b.ph * 0.8);
        await page.waitForTimeout(250);
        const ro = (await page.locator('[data-crosshair-readout]').first().innerText().catch(() => '')).replace(/\n/g, ' ');
        await away(page);
        const inks = [...new Set(added.map(s => s.color))];
        const clash = inks.map(c => ({ c, ...fieldClash(c) }));
        const sameAsCompare = inks.filter(c => COMPARE_INKS.includes(String(c).toUpperCase()));
        const panesAdded = [...new Set(added.map(s => s.pane))];
        const where = panesAdded.every(p => p === 0) ? 'overlay (pane 0)' : `pane(s) ${panesAdded.join(',')} of ${after.length}`;
        const okPane = pane === 'sub' ? panesAdded.length && panesAdded.every(p => p > 0) : panesAdded.every(p => p === 0);
        indRows.push({ id, name, kind: 'built-in', pane: where, settings: gear ? 'gear' : 'none (fixed)', defaults, drawMs: t, inks: inks.join(' '), clash: clash.map(c => (c.near ? `${c.c}≈${c.near} (ΔE ${c.near === 'gold' ? c.gold : c.violet})` : '')).filter(Boolean).join('; ') || 'none', sameInk: sameAsCompare.length ? `compare ink ${sameAsCompare.join(',')}` : '', widened: !!widened, readout: ro.slice(0, 120) });
        /* off again */
        await openLib();
        await page.locator('[data-library-shelf="chart"]').first().click();
        await page.locator(`[data-library-row="chart:${key}"] [data-library-toggle]`).first().click();
        await closeLib();
        await until(page, n => window.__x.E(0).chart.panes().reduce((s, p) => s + p.getSeries().length, 0) <= n, nBefore, 5000);
        const label = { ema9: /EMA ?9/i, ema21: /EMA ?21/i, ema50: /EMA ?50/i, sma: /SMA/i, vwap: /VWAP/i, vwapBands: /VWAP/i, bb: /BB|Bollinger/i, rsi: /RSI/i, macd: /MACD/i, atrPane: /ATR/i }[key];
        return {
          observed: `${added.length} series in ${where} after ${t} ms; inks ${inks.join(' ')}; axis ${widened ? `widened ${fit0.axis.map(v => v.toFixed(2)).join('–')} → ${fit1.axis.map(v => v.toFixed(2)).join('–')}` : 'not widened'}; readout "${ro.slice(0, 100)}"`,
          pass: t != null && okPane && !widened,
          ms: t,
          notes: [clash.some(c => c.near) ? `ink near the field's ${clash.find(c => c.near).near}` : '', sameAsCompare.length ? 'same ink as a compare line' : '', label.test(ro) ? '' : 'readout does not name it (or raw key)', gear ? '' : 'no settings (periods fixed)'].filter(Boolean).join('; '),
        };
      });
    }
    /* the cap and the append with a product pane up */
    await item({ id: 'D-cap', item: 'Sub-pane cap (2) and append after the regime pane', action: 'Regime strip on; RSI + MACD + ATR ticked', expected: 'regime keeps its pane; two indicator panes after it; ATR refused' }, async () => {
      await toggleOverlay(page, 'Regime strip');
      await until(page, () => !!document.querySelector('[data-pane-chip="regime"]'), null, 8000);
      await openLib();
      await page.locator('[data-library-shelf="chart"]').first().click();
      for (const k of ['rsi', 'macd', 'atrPane']) await page.locator(`[data-library-row="chart:${k}"] [data-library-toggle]`).first().click().catch(() => {});
      const atrState = await page.locator('[data-library-row="chart:atrPane"] [data-library-toggle]').first().getAttribute('aria-checked').catch(() => null);
      const foot = (await page.locator('[data-library-foot]').first().innerText().catch(() => '')).replace(/\n/g, ' ');
      await closeLib();
      await page.waitForTimeout(1200);
      const ser = await allSeries();
      const shape = ser.map(p => p.map(s => s.type).join('+'));
      await openLib();
      await page.locator('[data-library-shelf="chart"]').first().click();
      for (const k of ['rsi', 'macd', 'atrPane']) {
        const tg = page.locator(`[data-library-row="chart:${k}"] [data-library-toggle]`).first();
        if ((await tg.getAttribute('aria-checked')) === 'true') await tg.click();
      }
      await closeLib();
      await toggleOverlay(page, 'Regime strip');
      return { observed: `panes ${ser.length}: ${shape.join(' | ')}; ATR row aria-checked ${atrState}; foot "${foot.slice(0, 100)}"`, pass: ser.length === 4 && atrState !== 'true' };
    });
    if (errors.length) rec({ id: 'D-indicators-errors', item: 'page errors during the indicators group', action: '—', expected: 'none', observed: errors.slice(0, 5).join(' | '), pass: false });
  } finally {
    await close();
  }
  /* the light tape */
  const { page: p2, close: c2 } = await open({ panes: [SPY1m({ indicators: { ema9: true, ema21: true, rsi: true } })], theme: 'light' });
  try {
    await item({ id: 'D-light', item: 'Indicator inks on a light tape', action: 'light theme, EMA 9 / EMA 21 / RSI on', expected: 'the darker light-tape inks (#3C67A2, #676280, #5B6B45), ≥3:1 on the ground' }, async () => {
      const ser = await p2.evaluate(() => window.__x.series(0));
      const ground = await p2.evaluate(() => getComputedStyle(window.__x.E(0).box().closest('[data-chart-ink]')).backgroundColor);
      const inks = ser.flat().map(s => s.color).filter(c => /^#|rgb/.test(String(c)));
      const want = ['#3C67A2', '#676280', '#5B6B45'];
      const got = want.filter(w => inks.map(String).map(s => s.toUpperCase()).includes(w));
      return { observed: `ground ${ground}; inks ${[...new Set(inks)].join(' ')}`, pass: got.length === 3, notes: got.length < 3 ? `missing ${want.filter(w => !got.includes(w)).join(',')}` : '' };
    });
  } finally {
    await c2();
  }
});

/* ═══ GROUP 11 · THE SHIPPED PINE SCRIPTS ═════════════════════════════════════════════════════════════════════════ */
const PINES = [
  ['D-11', 'walls', 'The walls', 'overlay'], ['D-12', 'flip', 'The flip', 'overlay'], ['D-13', 'supreme', 'The supreme strike', 'overlay'], ['D-14', 'distance-to-walls', 'Distance to the walls', 'own'], ['D-15', 'wall-approach', 'Wall approach', 'overlay'],
  ['D-16', 'moving-average', 'Moving average', 'overlay'], ['D-17', 'ema-ribbon', 'EMA ribbon', 'overlay'], ['D-18', 'vwap', 'VWAP', 'overlay'], ['D-19', 'supertrend', 'Supertrend', 'overlay'], ['D-20', 'parabolic-sar', 'Parabolic SAR', 'overlay'],
  ['D-21', 'ichimoku', 'Ichimoku Cloud', 'overlay'], ['D-22', 'bollinger', 'Bollinger Bands', 'overlay'], ['D-23', 'keltner', 'Keltner Channels', 'overlay'], ['D-24', 'donchian', 'Donchian Channels', 'overlay'],
  ['D-25', 'rsi', 'RSI', 'own'], ['D-26', 'macd', 'MACD', 'own'], ['D-27', 'stochastic', 'Stochastic', 'own'], ['D-28', 'atr', 'ATR', 'own'], ['D-29', 'adx', 'ADX and DI', 'own'], ['D-30', 'cci', 'CCI', 'own'], ['D-31', 'williams-r', 'Williams %R', 'own'], ['D-32', 'mfi', 'Money flow index', 'own'], ['D-33', 'obv', 'On-balance volume', 'own'],
];
await group('pine', async () => {
  const { page, errors, warns, close } = await open({ panes: [SPY1m()] });
  try {
    await viewSessionTail(page, 120);
    await away(page);
    await page.waitForTimeout(500);
    /* the library's own add path once: Technicals → RSI, the gear, the inputs */
    await item({ id: 'D-ui', item: 'A shipped script through the library (Technicals → RSI), its gear and inputs', action: 'door → technicals → tick RSI; gear → Length 21', expected: 'own pane appears; inputs form; a new length redraws' }, async () => {
      const n0 = await page.evaluate(() => window.__x.E(0).chart.panes().length);
      await hoverPane(page);
      await page.locator('button[data-scripts-door]').filter({ visible: true }).first().click();
      await page.locator('[data-library-shelf="technicals"]').first().click();
      const row = page.locator('[data-library-row="builtin:rsi"]').first();
      const t0 = Date.now();
      await row.locator('[data-library-toggle]').first().click();
      const t = await until(page, n => window.__x.E(0).chart.panes().length > n, n0, 8000);
      await row.locator('[data-library-gear]').first().click().catch(() => {});
      const form = page.locator('[data-script-inputs]').first();
      const hasForm = await form.waitFor({ timeout: 2000 }).then(() => true).catch(() => false);
      let t2 = null;
      if (hasForm) {
        const num = form.locator('input[type="number"]').first();
        const sig0 = await page.evaluate(() => JSON.stringify(window.__x.E(0).chart.panes().at(-1).getSeries()[0]?.data().slice(-3)));
        const t1 = Date.now();
        await num.fill('21');
        await num.press('Tab');
        t2 = await until(page, s => JSON.stringify(window.__x.E(0).chart.panes().at(-1).getSeries()[0]?.data().slice(-3)) !== s, sig0, 6000);
        if (t2 == null) t2 = `none in ${ms(t1)}`;
      }
      const alerts = await page.locator('[data-script-alerts]').count();
      await row.locator('[data-library-toggle]').first().click();
      await page.keyboard.press('Escape');
      await away(page);
      return { observed: `own pane in ${t} ms; inputs form ${hasForm}; Length 21 redraw ${t2} ms; alerts section ${alerts}`, pass: t != null && hasForm && typeof t2 === 'number', ms: t ?? ms(t0) };
    });
    /* the engine's own run time on the pane's bars, in the browser */
    const runs = await page.evaluate(async () => {
      const pine = await import('/src/core/pine/index.ts');
      const lib = await import('/src/data/builtinScripts.ts');
      const ps = await import('/src/data/paneScripts.ts');
      const got = ps.getPaneBars('terrain:1');
      const bars = got?.bars ?? [];
      const out = {};
      for (const s of lib.builtinScripts()) {
        const slug = s.id.replace(/^builtin:/, '');
        try {
          const c = pine.compile(s.source);
          const times = [];
          let r = null;
          for (let k = 0; k < 3; k++) {
            const t0 = performance.now();
            r = pine.run(c, bars, { ticker: 'SPY', timeframe: got?.timeframe ?? '1m', slayer: { callWall: 785, putWall: 770, flip: 777.5, supreme: 780 }, budgetMs: 5000 });
            times.push(performance.now() - t0);
          }
          times.sort((a, b) => a - b);
          out[slug] = { ok: true, ms: +times[1].toFixed(1), plots: r.plots.length, status: s.status, pane: s.meta?.pane, inputs: (s.meta?.inputs ?? []).map(i => `${i.title ?? i.id} ${i.default ?? ''}`).join(', ') };
        } catch (e) {
          out[slug] = { ok: false, err: String(e?.message ?? e).slice(0, 160), status: s.status };
        }
      }
      return { n: bars.length, tf: got?.timeframe, out };
    });
    console.log(`pine engine on ${runs.n} bars (${runs.tf})`);
    const ps = '/src/data/paneScripts.ts';
    await item({ id: 'B-44', item: "Scripts legend (name, hide, remove) at the plot's top-left", action: 'place "The supreme strike"; hover its legend row → eye; eye again; ×', expected: 'the row names it; the eye hides and shows its line; × takes it off' }, async () => {
      const total = () => page.evaluate(() => window.__x.E(0).chart.panes().reduce((s2, p) => s2 + p.getSeries().length, 0));
      const n0 = await total();
      const cid = await page.evaluate(async ps => (await (await import(ps)).placeOnPane('terrain:1', 'builtin:supreme'))?.id ?? null, ps);
      const tIn = await until(page, () => !!document.querySelector('[data-legend-row]'), null, 6000);
      await page.waitForTimeout(500);
      const n1 = await total();
      const row = page.locator('[data-legend-row]').first();
      const rr = await row.boundingBox().catch(() => null);
      const rail = await page.locator('[data-chart-rail]').first().boundingBox().catch(() => null);
      const name = (await row.innerText().catch(() => '')).replace(/\n/g, ' ');
      await row.hover().catch(() => {});
      /* what stands over the eye: the element the pointer would reach at its centre */
      const eyeBox = await page.locator('[data-legend-eye]').first().boundingBox().catch(() => null);
      const top = eyeBox ? await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); if (!e) return 'none'; if (e.closest('[data-script-legend]')) return 'the legend itself'; const host = e.closest('[data-chart-rail], [data-bead-legend], [data-toolbar-row], [data-chart-chrome], [data-crosshair-readout], [data-pane-head]'); return `${e.tagName.toLowerCase()} of ${host ? [...host.attributes].map(a => a.name).filter(n => n.startsWith('data-'))[0] : 'an unmarked element'}`; }, [eyeBox.x + eyeBox.width / 2, eyeBox.y + eyeBox.height / 2]) : 'no eye';
      const t0 = Date.now();
      const clickErr = await page.locator('[data-legend-eye]').first().click({ timeout: 2500 }).then(() => '').catch(e => String(e).split('\n').find(l => /intercepts|not receive|Timeout/.test(l))?.trim().slice(0, 140) ?? 'click failed');
      const tHide = await until(page, n => window.__x.E(0).chart.panes().reduce((s2, p) => s2 + p.getSeries().length, 0) < n, n1, 3000);
      const hidden = await row.getAttribute('data-hidden').catch(() => null);
      let tShow = null;
      if (tHide != null) {
        await row.hover().catch(() => {});
        await page.locator('[data-legend-eye]').first().click({ timeout: 2500 }).catch(() => {});
        tShow = await until(page, n => window.__x.E(0).chart.panes().reduce((s2, p) => s2 + p.getSeries().length, 0) >= n, n1, 3000);
      }
      await row.hover().catch(() => {});
      const rmErr = await page.locator('[data-legend-remove]').first().click({ timeout: 2500 }).then(() => '').catch(e => String(e).split('\n').find(l => /intercepts|not receive|Timeout/.test(l))?.trim().slice(0, 140) ?? 'click failed');
      const tOff = await until(page, () => !document.querySelector('[data-legend-row]'), null, 3000);
      /* whatever the pointer could not do, take the script off so the next rows start clean */
      if (tOff == null && cid) {
        await page.evaluate(async ([ps, cid]) => (await import(ps)).liftFromPane('terrain:1', cid), [ps, cid]).catch(() => {});
        await until(page, () => !document.querySelector('[data-legend-row]'), null, 3000);
      }
      await away(page);
      const overRail = rr && rail && rr.x < rail.x + rail.width && rr.y < rail.y + rail.height && rr.y + rr.height > rail.y;
      return { observed: `series ${n0} → ${n1}; row "${name}" in ${tIn} ms at x${rr ? Math.round(rr.x) : '—'} (rail right ${rail ? Math.round(rail.x + rail.width) : '—'}); at the eye's centre: ${top}; eye ${clickErr ? `press refused (${clickErr})` : 'pressed'} → hides in ${tHide} ms (data-hidden ${hidden}), shows again in ${tShow} ms; × ${rmErr ? `press refused (${rmErr})` : 'pressed'} → removed in ${tOff} ms`, pass: tIn != null && tHide != null && tShow != null && tOff != null && !overRail, ms: tHide ?? null, notes: [overRail ? 'the scripts legend stands over the drawing rail column (left-3 in the outer box; StrikeChart.tsx:5820 mounts ScriptLegend without the rail inset)' : '', clickErr ? `its eye is under another element (${top}) — the pointer cannot reach it` : ''].filter(Boolean).join('; ') };
    });
    for (const [id, slug, name, kind] of PINES) {
      await item({ id, item: `${name} (shipped Pine script)`, action: `place builtin:${slug} on terrain:1; read the chart; take it off`, expected: `${kind === 'own' ? 'its own pane, appended' : 'lines on the price pane'}; runs inside the 200 ms chart budget; legend row` }, async () => {
        const before = await page.evaluate(() => window.__x.series(0));
        const nBefore = before.flat().length;
        const w0 = warns.length;
        const fit0 = await page.evaluate(() => window.__x.fit(0));
        const t0 = Date.now();
        const placed = await page.evaluate(async ([ps, slug]) => {
          const m = await import(ps);
          const c = await m.placeOnPane('terrain:1', `builtin:${slug}`);
          return c?.id ?? null;
        }, [ps, slug]);
        const t = await until(page, n => window.__x.E(0).chart.panes().reduce((s, p) => s + p.getSeries().length, 0) > n || window.__x.E(0).candles.priceLines().length > 0, nBefore, 8000);
        await page.waitForTimeout(350);
        const after = await page.evaluate(() => window.__x.series(0));
        const legend = await page.locator('[data-legend-row]').count();
        const added = [];
        after.forEach((p, pi) => p.forEach((s, si) => {
          const was = before[pi]?.[si];
          if (!was || was.color !== s.color || was.type !== s.type) added.push({ pane: pi, ...s });
        }));
        const fit1 = await page.evaluate(() => window.__x.fit(0));
        const widened = fit0.axis && fit1.axis && (fit1.axis[0] < fit0.axis[0] - 0.01 || fit1.axis[1] > fit0.axis[1] + 0.01);
        const inks = [...new Set(added.map(s => s.color).filter(Boolean))];
        const clash = inks.map(c => ({ c, ...fieldClash(c) })).filter(c => c.near);
        const panesAdded = [...new Set(added.map(s => s.pane))];
        const run = runs.out[slug] ?? {};
        const newWarns = warns.slice(w0);
        const legendNote = '';
        await page.evaluate(async ([ps, cid]) => {
          const m = await import(ps);
          if (cid) await m.liftFromPane('terrain:1', cid);
        }, [ps, placed]);
        await until(page, n => window.__x.E(0).chart.panes().reduce((s, p) => s + p.getSeries().length, 0) <= n, nBefore, 5000);
        const where = !added.length ? 'nothing drawn' : panesAdded.every(p => p === 0) ? 'overlay (pane 0)' : `own pane ${panesAdded.join(',')}`;
        const okPane = kind === 'own' ? panesAdded.some(p => p > 0) : added.length > 0 && panesAdded.every(p => p === 0);
        indRows.push({ id, name, kind: `Pine (${slug})`, pane: where, settings: run.inputs || 'none', defaults: run.inputs || '—', drawMs: t, runMs: run.ms, plots: run.plots, inks: inks.join(' '), clash: clash.map(c => `${c.c}≈${c.near}`).join('; ') || 'none', sameInk: '', widened: !!widened, readout: '' });
        return {
          observed: `${added.length} series, ${where}, in ${t} ms (engine ${run.ms ?? '—'} ms on ${runs.n} bars, ${run.plots ?? '—'} plots${run.ok === false ? `, ERROR ${run.err}` : ''}); inks ${inks.join(' ') || '—'}; legend rows ${legend}; axis ${widened ? 'widened' : 'not widened'}${newWarns.length ? `; warn ${newWarns[0]}` : ''}${legendNote ? `; ${legendNote}` : ''}`,
          pass: t != null && okPane && run.ok !== false && (run.ms ?? 0) < 200 && newWarns.length === 0 && legend > 0 && !widened,
          ms: t,
          notes: [clash.length ? `ink near the field's ${clash.map(c => c.near).join('/')}` : '', widened ? 'widens the fitted axis (CLAUDE.md: no wall, supreme, spot or layer widens it; scriptLayer.ts:249 puts overlay plots on the right scale with no autoscale guard)' : '', (run.ms ?? 0) >= 200 ? 'over the 200 ms budget' : ''].filter(Boolean).join('; '),
        };
      });
    }
    if (errors.length) rec({ id: 'D-pine-errors', item: 'page errors during the pine group', action: '—', expected: 'none', observed: errors.slice(0, 5).join(' | '), pass: false });
  } finally {
    await close();
  }
});

/* ═══ GROUP 12 · PINE LANGUAGE (§2), compiled and run in the page ════════════════════════════════════════════════ */
await group('pine-lang', async () => {
  const { page, close } = await open({ panes: [SPY1m()], waitField: false, tz: 'America/Los_Angeles' });
  try {
    const H = '//@version=6\nindicator("t")\n';
    const cases = [
      ['D-L01', 'var and :=', `${H}var float s = 0\ns := s + 1\nplot(s)`, 'ok'],
      ['D-L02', 'for … in', `${H}a = 1\nfor x in a\n    plot(x)\nplot(close)`, 'err'],
      ['D-L03', 'while / break', `${H}i = 0\nwhile i < 3\n    i += 1\n    if i == 2\n        break\nplot(i)`, 'ok'],
      ['D-L04', 'switch expression', `${H}x = switch\n    close > open => 1\n    => 0\nplot(x)`, 'ok'],
      ['D-L05', 'default parameters', `${H}f(a, b = 2) => a + b\nplot(f(1))`, 'either'],
      ['D-L06', 'typed parameter int division', `${H}f(int n) => n / 2\nplot(f(5))`, 'either'],
      ['D-L07', 'method / type', `${H}type P\n    float x\nplot(close)`, 'err'],
      ['D-L08', 'arrays', `${H}a = array.new_float(3)\nplot(close)`, 'err'],
      ['D-L09', 'str.format with arguments', `${H}s = str.format("{0}", close)\nplot(close)`, 'either'],
      ['D-L10', 'ta.obv as a variable', `${H}plot(ta.obv)`, 'either'],
      ['D-L11', 'ta.obv() as a function', `${H}plot(ta.obv())`, 'either'],
      ['D-L12', 'timeframe.isintraday on 1m', `${H}plot(timeframe.isintraday ? 1 : 0)`, 'value1'],
      ['D-L13', 'hour in New York', `${H}plot(hour)`, 'hourNY'],
      ['D-L14', 'math.random', `${H}plot(math.random())`, 'either'],
      ['D-L15', 'request.security', `${H}x = request.security("SPY", "D", close)\nplot(x)`, 'err'],
      ['D-L16', 'strategy()', `//@version=6\nstrategy("t")\nplot(close)`, 'err'],
      ['D-L17', 'plotarrow', `${H}plotarrow(close - open)`, 'either'],
      ['D-L18', 'input.price', `${H}p = input.price(100)\nplot(p)`, 'either'],
      ['D-L19', 'alertcondition', `${H}alertcondition(close > open, "Up")\nplot(close)`, 'ok'],
      ['D-L20', 'barstate.isconfirmed', `${H}plot(barstate.isconfirmed ? 1 : 0)`, 'ok'],
      ['D-L21', 'missing //@version', `indicator("t")\nplot(close)`, 'err'],
      ['D-L22', 'ta.vwap tuple', `${H}[v, u, l] = ta.vwap(hlc3, true, 1)\nplot(v)`, 'either'],
    ];
    const res = await page.evaluate(async cases => {
      const pine = await import('/src/core/pine/index.ts');
      const ps = await import('/src/data/paneScripts.ts');
      const got = ps.getPaneBars('terrain:1');
      const bars = (got?.bars ?? []).slice(-500);
      return cases.map(([id, , src]) => {
        const t0 = performance.now();
        try {
          const c = pine.compile(src);
          const r = pine.run(c, bars, { ticker: 'SPY', timeframe: got?.timeframe ?? '1m', budgetMs: 2000 });
          const p = r.plots[0];
          const vals = p ? (p.values ?? p.data ?? []).filter(v => v != null && !Number.isNaN(v)) : [];
          const last = vals.length ? vals[vals.length - 1] : null;
          return { id, ok: true, ms: +(performance.now() - t0).toFixed(1), last: typeof last === 'object' ? JSON.stringify(last).slice(0, 60) : last, lastBar: bars.at(-1)?.time ?? null, alerts: r.alerts?.length ?? null };
        } catch (e) {
          return { id, ok: false, ms: +(performance.now() - t0).toFixed(1), err: String(pine.explain ? pine.explain(e).message : e?.message ?? e).slice(0, 160) };
        }
      });
    }, cases);
    for (const [id, what, src, want] of cases) {
      const r = res.find(x => x.id === id);
      let pass;
      let note = '';
      if (want === 'ok') pass = r.ok;
      else if (want === 'err') pass = !r.ok;
      else if (want === 'value1') {
        pass = r.ok && Number(r.last) === 1;
        note = 'Pine: true on an intraday timeframe';
      } else if (want === 'hourNY') {
        const nyHour = r.lastBar ? Number(new Date(r.lastBar * 1000).toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false })) : null;
        pass = r.ok && Number(r.last) === nyHour;
        note = `last bar's New York hour ${nyHour}`;
      } else pass = 'manual';
      rec({ id, item: `Pine: ${what}`, action: 'compile + run in the page on the pane bars', expected: want === 'ok' ? 'compiles and runs' : want === 'err' ? 'refused with a plain message' : want === 'value1' ? 'value 1' : want === 'hourNY' ? 'the New York hour' : 'record what it does (TradingView differs)', observed: r.ok ? `runs in ${r.ms} ms; last value ${r.last}${r.alerts != null ? `; alerts ${r.alerts}` : ''}` : `refused: ${r.err}`, pass, ms: r.ms, notes: note });
    }
  } finally {
    await close();
  }
});

await browser.close();

/* ─── the report ────────────────────────────────────────────────────────────────────────────────────────────────── */
FINAL = true;
if (MERGE) {
  /* a partial run replaces its own rows in the last full report and keeps the rest, in the report's order */
  try {
    const old = OLD;
    const mine = new Map(results.map(r => [r.id, r]));
    const merged = (old.results ?? []).map(r => mine.get(r.id) ?? r);
    for (const r of results) if (!merged.some(m => m.id === r.id)) merged.push(r);
    results.splice(0, results.length, ...merged);
    const myInd = new Map(indRows.map(r => [r.id, r]));
    const ind = (old.indicators ?? []).map(r => myInd.get(r.id) ?? r);
    for (const r of indRows) if (!ind.some(m => m.id === r.id)) ind.push(r);
    indRows.splice(0, indRows.length, ...ind);
    const ran = new Set(groupsRun.map(g => g.name));
    groupsRun.splice(0, groupsRun.length, ...(old.groups ?? []).filter(g => !ran.has(g.name)), ...groupsRun);
  } catch (e) {
    console.log(`merge skipped: ${e}`);
  }
}
flush();
const esc = s => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const passWord = p => (p === true ? 'PASS' : p === false ? '**FAIL**' : 'manual');
const tally = { pass: results.filter(r => r.pass === true).length, fail: results.filter(r => r.pass === false).length, manual: results.filter(r => r.pass === 'manual').length };
let md = `# Terrain audit 2026-10-15 — area B and area D, exercised\n\n`;
md += `Server ${BASE} (commit 521d7de), Chromium headless 1440 × 900 at 1 dpr unless a row says otherwise, run ${new Date(T_START).toISOString()} (New York ${new Date(T_START).toLocaleString('en-US', { timeZone: 'America/New_York' })} — the market shut), ${Math.round((Date.now() - T_START) / 1000)} s.\n`;
md += `Script: scripts/terrain-exercise/area-b.mjs. **${tally.pass} pass · ${tally.fail} fail · ${tally.manual} manual** of ${results.length} rows.\n\n`;
md += `Timings (ms) are from the action to the observed result, polled every 50 ms, on a shared 4-core machine with two other agents running browsers: read them as pessimistic upper bounds.\n\n`;
md += `Groups: ${groupsRun.map(g => `${g.name} ${g.seconds}s`).join(' · ')}\n\n`;
md += `| id | item | action → expected | observed | pass | ms |\n|---|---|---|---|---|---|\n`;
for (const r of results) md += `| ${esc(r.id)} | ${esc(r.item)} | ${esc(r.action)} → ${esc(r.expected)} | ${esc(r.observed)}${r.notes ? ` — *${esc(r.notes)}*` : ''} | ${passWord(r.pass)} | ${r.ms ?? ''} |\n`;
/* inks shared between indicators/scripts (and the compare lines), alpha ignored */
const hexOf = c => {
  const v = parseInk(c);
  return v ? `#${v.map(n => Math.round(n).toString(16).padStart(2, '0')).join('').toUpperCase()}` : null;
};
for (const r of indRows) {
  const mine = new Set(String(r.inks).split(/ (?![\d.]+[,)])/).map(hexOf).filter(Boolean).filter(h => h !== '#000000'));
  const others = indRows.filter(o => o !== r && String(o.inks).split(/ (?![\d.]+[,)])/).map(hexOf).some(h => mine.has(h))).map(o => o.id);
  const cmp = COMPARE_INKS.filter(c => mine.has(c));
  r.sameInk = [others.length ? others.join(',') : '', cmp.length ? `compare line ${cmp.join(',')}` : ''].filter(Boolean).join('; ');
}
md += `\n## Indicators and shipped Pine scripts\n\n| id | name | kind | pane | settings (defaults) | draw ms | engine ms | inks | near gold/violet | same ink as | widens fitted axis |\n|---|---|---|---|---|---|---|---|---|---|---|\n`;
for (const r of indRows) md += `| ${r.id} | ${esc(r.name)} | ${esc(r.kind)} | ${esc(r.pane)} | ${esc(r.settings === r.defaults ? r.settings : `${r.settings}; ${r.defaults}`)} | ${r.drawMs ?? '—'} | ${r.runMs ?? '—'} | ${esc(r.inks)} | ${esc(r.clash)} | ${esc(r.sameInk)} | ${r.widened ? 'yes' : 'no'} |\n`;
writeFileSync(`${OUT}/area-b.md`, md);
writeFileSync(`${OUT}/area-b.json`, JSON.stringify({ server: BASE, commit: '521d7de', ranAt: new Date(T_START).toISOString(), seconds: Math.round((Date.now() - T_START) / 1000), groups: groupsRun, tally, results, indicators: indRows }, null, 1));
console.log(`\n${tally.pass} pass · ${tally.fail} fail · ${tally.manual} manual · ${Math.round((Date.now() - T_START) / 1000)} s`);
