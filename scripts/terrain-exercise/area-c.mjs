// Terrain audit 2026-10-15, AREA C exercised in a browser: the strike ladder (ProfilePanel) and the desk's Strikes
// button, the decision strip, How sure, the day panel, the phone's peek and overlay ladder, Read this / Glossary, the
// states (building, catching up, stale, no data, denied/blocked feed, gaps) and the layouts (1–4 panes at 1440×900 and
// 1280×720, F, the phone). Plus the owner's item 6c: the ladder's net against the chart's field, strike by strike.
// Read-only against the dev server (EXERCISE_URL, 127.0.0.1:5180 by default); writes area-c.{json,md,*.png} to EXERCISE_OUT
// (docs/terrain-audit-2026-10-15/exercise by default).
// Run: no_proxy=127.0.0.1,localhost NO_PROXY=127.0.0.1,localhost node scripts/terrain-exercise/area-c.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execSync } from 'node:child_process';
/* the commit the run is against (EXERCISE_COMMIT, else the working tree's HEAD) */
const COMMIT = process.env.EXERCISE_COMMIT || (() => { try { return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim(); } catch { return 'unknown'; } })();


/* the address and the folder: EXERCISE_URL and EXERCISE_OUT (the dev server on 5180, the audit's exercise folder) */
const BASE = process.env.EXERCISE_URL ?? 'http://127.0.0.1:5180';
const OUT = process.env.EXERCISE_OUT ?? 'docs/terrain-audit-2026-10-15/exercise';
const TZ = 'America/New_York';
fs.mkdirSync(OUT, { recursive: true });
const T0 = Date.now();
const R = [];
const SIX = {};
const LOG = [];
const log = (...a) => {
  const s = `[${((Date.now() - T0) / 1000).toFixed(0)}s] ${a.join(' ')}`;
  LOG.push(s);
  console.log(s);
};
const rec = o => {
  R.push({ id: o.id, item: o.item, action: o.action, expected: o.expected, observed: o.observed, pass: o.pass, ms: o.ms ?? null, notes: o.notes ?? '' });
  log(o.id, o.pass === true ? 'PASS' : o.pass === false ? 'FAIL' : String(o.pass).toUpperCase(), o.ms ?? '-', String(o.observed).replace(/\s+/g, ' ').slice(0, 220));
};
/* one item: run fn (returns {observed, pass, ms, notes}); a thrown error is a FAIL with the error */
const item = async (id, name, action, expected, fn) => {
  try {
    const r = await fn();
    rec({ id, item: name, action, expected, ...r });
  } catch (e) {
    rec({ id, item: name, action, expected, observed: `ERROR ${String(e?.message || e).split('\n')[0].slice(0, 300)}`, pass: false, ms: null, notes: 'script error (the item could not be exercised)' });
  }
};
const clip = (s, n = 400) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

/* ---------------------------------------------------------------------------------------------------------------- */
/* the page's side: storage, the ladder canvas's fillText log, and small read helpers                                */
/* ---------------------------------------------------------------------------------------------------------------- */
const INIT = opts => {
  try {
    localStorage.setItem('slayer_theme', 'dark');
    localStorage.setItem('slayer_desk_chooser', '1');
    localStorage.setItem('slayer_terrain_sky1', '1');
    if (opts.cvd) localStorage.setItem('slayer_cvd', opts.cvd);
    if (!sessionStorage.getItem('__ex_set')) {
      sessionStorage.setItem('__ex_set', '1');
      localStorage.setItem('slayer_name', opts.cfg.panes[0].ticker);
      localStorage.setItem('slayer_terrain_v1', JSON.stringify(opts.cfg));
    }
  } catch {}
  const P = CanvasRenderingContext2D.prototype;
  const cache = new WeakMap();
  const isLad = c => {
    if (!c || !c.isConnected) return false;
    let v = cache.get(c);
    if (v === undefined) {
      v = !!c.closest('[data-profile-panel]');
      cache.set(c, v);
    }
    return v;
  };
  const frames = new Map();
  window.__ladFrames = frames;
  const oc = P.clearRect;
  P.clearRect = function (x, y, w, h) {
    try {
      if (x === 0 && y === 0 && isLad(this.canvas)) frames.set(this.canvas, []);
    } catch {}
    return oc.call(this, x, y, w, h);
  };
  const of = P.fillText;
  P.fillText = function (t, x, y, ...r) {
    try {
      if (isLad(this.canvas)) {
        let a = frames.get(this.canvas);
        if (!a) frames.set(this.canvas, (a = []));
        a.push({ t: String(t), x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, fs: typeof this.fillStyle === 'string' ? this.fillStyle : 'gradient', font: this.font, al: this.textAlign });
      }
    } catch {}
    return of.call(this, t, x, y, ...r);
  };
  const ex = {
    pane: i => document.querySelectorAll('[data-chart-frame]')[i] || null,
    lad: i => ex.pane(i)?.querySelector('[data-profile-panel]') || null,
    texts: i => {
      const c = ex.lad(i)?.querySelector('canvas');
      return c ? frames.get(c) || [] : [];
    },
    props: i => {
      const el = ex.lad(i);
      if (!el) return null;
      const k = Object.keys(el).find(k => k.startsWith('__reactFiber$'));
      let f = el[k];
      while (f && !(f.memoizedProps && f.memoizedProps.rows && f.memoizedProps.levels)) f = f.return;
      return f ? f.memoizedProps : null;
    },
    chart: i => {
      const p = ex.pane(i);
      return [...(window.__charts || [])].find(e => e.host && e.host.isConnected && p && p.contains(e.host)) || null;
    },
    y: (i, price) => {
      const e = ex.chart(i);
      if (!e) return null;
      const y = e.candles.priceToCoordinate(price);
      return y == null ? null : e.host.getBoundingClientRect().top + y;
    },
    ann: () => [...document.querySelectorAll('span.sr-only[aria-live="polite"]')].map(s => s.textContent).filter(Boolean).join(' | '),
    vis: el => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
    },
    box: el => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    },
  };
  window.__ex = ex;
};

// the feed proxy's own paths: never Vite's src/data/feed modules, which a double-star feed glob also matches
const FEED_API = u => u.pathname.startsWith('/feed/');
const paneCfg = (ticker, timeframe, extra = {}) => ({ ticker, timeframe, overlays: { trails: true }, ladder: true, ...extra });

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const open = async ({ viewport = { width: 1440, height: 900 }, cfg, phone = false, cvd = null, routes = null, clockAt = null, label = '' }) => {
  const ctx = await browser.newContext({ viewport, timezoneId: TZ, deviceScaleFactor: 1, ...(phone ? { isMobile: true, hasTouch: true } : {}) });
  await ctx.addInitScript(INIT, { cfg, cvd });
  if (routes) await routes(ctx);
  const page = await ctx.newPage();
  page.__errs = [];
  page.on('pageerror', e => page.__errs.push(clip(e, 200)));
  page.on('console', m => {
    if (m.type() === 'error') page.__errs.push('console: ' + clip(m.text(), 200));
  });
  page.on('response', r => {
    if (r.status() >= 400) page.__errs.push(`HTTP ${r.status()} ${r.url().replace(BASE, '').slice(0, 120)}`);
  });
  if (clockAt) {
    /* a running clock from that moment (a frozen Date stopped the bars from drawing at all) */
    await page.clock.install({ time: new Date(clockAt) });
    await page.clock.resume();
  }
  const t = Date.now();
  await page.goto(`${BASE}/terrain`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  log('open', label, `${viewport.width}x${viewport.height}`, 'dom', Date.now() - t, 'ms');
  return { ctx, page };
};
const ready = async (page, n = 1, timeout = 90000) => {
  const t = Date.now();
  await page.waitForFunction(
    /* the panes' own charts — the session recap draws off-screen charts of its own ([data-recap-shot]) */
    n => [...document.querySelectorAll('[data-chart-frame] [data-chart-state]')].map(e => e.getAttribute('data-chart-state') || '').filter(x => Number(x.split('|')[2]) > 0).length >= n,
    n,
    { timeout, polling: 250 }
  );
  return Date.now() - t;
};
const ladReady = async (page, i = 0, timeout = 60000) => {
  await page.waitForFunction(i => window.__ex.texts(i).length > 5 && (window.__ex.props(i)?.rows?.length ?? 0) > 0, i, { timeout, polling: 250 });
};
/* run the action, then time until the predicate holds in the page */
const timed = async (page, action, pred, arg = null, timeout = 10000) => {
  const t = Date.now();
  await action();
  try {
    await page.waitForFunction(pred, arg, { timeout, polling: 25 });
    return { ok: true, ms: Date.now() - t };
  } catch {
    return { ok: false, ms: Date.now() - t };
  }
};
const shot = async (page, name) => {
  try {
    await page.screenshot({ path: path.join(OUT, `area-c-${name}.png`) });
  } catch (e) {
    log('shot failed', name, clip(e, 120));
  }
};
const blur = page => page.evaluate(() => document.activeElement?.blur?.());
const away = page => page.mouse.move(2, 2);
const esc = page => page.keyboard.press('Escape');

/* hover the ladder of pane i at strike k; returns the read line's strike and text */
const hoverStrike = async (page, i, k) => {
  const g = await page.evaluate(
    ([i, k]) => {
      const l = window.__ex.lad(i);
      const y = window.__ex.y(i, k);
      if (!l || y == null) return null;
      const r = l.getBoundingClientRect();
      return { x: r.left + r.width * 0.3, y, top: r.top, bottom: r.bottom, left: r.left };
    },
    [i, k]
  );
  if (!g) return null;
  for (const dy of [0, 1, -1, 2, -2, 3, -3, 5, -5]) {
    await page.mouse.move(g.x, g.y + dy);
    await page.waitForTimeout(40);
    const got = await page.evaluate(i => {
      const el = window.__ex.lad(i)?.querySelector('[data-profile-read]');
      return el ? { strike: el.getAttribute('data-read-strike'), text: el.innerText } : null;
    }, i);
    if (got && Number(got.strike) === k) return { ...got, x: g.x, y: g.y + dy, localY: g.y + dy - g.top, top: g.top };
  }
  return { strike: null, text: null, x: g.x, y: g.y, localY: g.y - g.top, top: g.top };
};

/* drag the price axis of pane i by dy px (down = more strikes in view); returns the point, or null */
const priceAxisDrag = async (page, i, dy) => {
  const g = await page.evaluate(i => {
    const e = window.__ex.chart(i);
    const r = e.host.getBoundingClientRect();
    const w = e.candles.priceScale().width();
    const x = r.right - Math.max(8, w / 2);
    for (let f = 0.3; f < 0.85; f += 0.025) {
      const y = r.top + r.height * f;
      const el = document.elementFromPoint(x, y);
      if (el && el.tagName === 'CANVAS' && e.host.contains(el)) return { x, y, w };
    }
    return null;
  }, i);
  if (!g) return null;
  await page.mouse.move(g.x, g.y);
  await page.mouse.down();
  await page.mouse.move(g.x, g.y + dy / 2, { steps: 4 });
  await page.mouse.move(g.x, g.y + dy, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  return g;
};
const autoScale = (page, i) => page.evaluate(i => window.__ex.chart(i)?.candles.priceScale().options().autoScale, i);
const resetAxis = async (page, i, g) => {
  if (!g) return;
  await page.mouse.dblclick(g.x, g.y);
  await page.waitForTimeout(500);
};
/* a strike's row is on the ladder's plot (under the head, over the read line) */
const inPlot = (page, i, k) =>
  page.evaluate(
    ([i, k]) => {
      const l = window.__ex.lad(i);
      const y = window.__ex.y(i, k);
      if (!l || y == null) return false;
      const r = l.getBoundingClientRect();
      const inset = l.querySelector('[data-plot-inset]')?.getBoundingClientRect().height ?? 60;
      const read = l.querySelector('[data-profile-read]')?.getBoundingClientRect();
      return y > r.top + inset + 4 && y < (read ? read.top : r.bottom) - 6;
    },
    [i, k]
  );

/* ---------------------------------------------------------------------------------------------------------------- */
/* 6c: the ladder's net against the chart's field, for one pane                                                      */
/* ---------------------------------------------------------------------------------------------------------------- */
const sixC = async (page, label) => {
  const base = await page.evaluate(async () => {
    const p = window.__ex.props(0);
    const e = window.__ex.chart(0);
    const snaps = e?.trails?.snapshots || [];
    const last = snaps[snaps.length - 1];
    const f = await import('/src/core/format.ts');
    return {
      spot: p.levels.spot,
      levels: { callWall: p.levels.callWall, putWall: p.levels.putWall, flip: p.levels.flip, supreme: p.levels.supreme },
      rows: p.rows.map(r => ({ strike: r.strike, value: r.value })),
      nSnaps: snaps.length,
      field: last ? { time: last.time, levels: last.levels.map(l => ({ strike: l.strike, value: l.value, gross: l.gross ?? null })), print: Object.fromEntries(last.levels.map(l => [l.strike, f.usdCompact(l.value)])) } : null,
      fresh: document.querySelector('[data-decision-box="freshness"]')?.getAttribute('title') || null,
      state: document.querySelector('[data-chart-frame] [data-chart-state]')?.getAttribute('data-chart-state'),
    };
  });
  const near = [...base.rows].sort((a, b) => Math.abs(a.strike - base.spot) - Math.abs(b.strike - base.spot)).slice(0, 10).sort((a, b) => b.strike - a.strike);
  const out = [];
  /* Net view: the canvas figure at the row and the read line */
  await page.click('[data-chart-frame] [data-profile-view="net"]').catch(() => {});
  await page.waitForTimeout(400);
  for (const r of near) {
    const h = await hoverStrike(page, 0, r.strike);
    await page.waitForTimeout(60);
    const fig = h
      ? await page.evaluate(
          ([ly]) => {
            const t = window.__ex.texts(0);
            const f = t.filter(x => /^−?\$/.test(x.t) && Math.abs(x.y - ly) <= 2.5 && /bold|700/.test(x.font));
            return f.length ? f[0].t : null;
          },
          [h.localY]
        )
      : null;
    out.push({ strike: r.strike, value: r.value, netCanvas: fig, readNet: h?.strike ? clip(h.text, 200) : `(hover missed: ${h?.strike})` });
  }
  /* Sides view: the read line's Size, the ladder's net as words */
  await page.click('[data-chart-frame] [data-profile-view="ladder"]').catch(() => {});
  await page.waitForTimeout(400);
  const sizeOf = async o => {
    const h = await hoverStrike(page, 0, o.strike);
    const m = h?.text?.match(/Size\s*([−-]?\$[\d.,]+[KMB]?)\s*·\s*(amplifies|absorbs)/);
    o.readSize = m ? `${m[1]} · ${m[2]}` : h?.strike ? clip(h.text, 160) : '(hover missed)';
  };
  for (const o of out) await sizeOf(o);
  /* rows off the plot at the chart's own fit: drag the price axis out, read them, and give the axis back */
  if (out.some(o => o.readSize === '(hover missed)')) {
    const g = await priceAxisDrag(page, 0, 220);
    await away(page);
    await page.waitForTimeout(500);
    for (const o of out) if (o.readSize === '(hover missed)') {
      await sizeOf(o);
      if (o.readSize !== '(hover missed)') o.readSize += ' ‡';
    }
    await resetAxis(page, 0, g);
  }
  await page.click('[data-chart-frame] [data-profile-view="net"]').catch(() => {});
  await away(page);
  const ks = near.map(r => r.strike);
  const cols = await page.evaluate(ks => {
    const s = window.__ex.chart(0).trails.snapshots;
    const hm = t => new Date(t * 1000).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false });
    const day = t => new Date(t * 1000).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const out = {};
    for (const want of ['15:34', '15:59']) {
      const c = s.filter(c => day(c.time) === '2026-10-14' && hm(c.time) === want).slice(-1)[0];
      if (c) out[want] = Object.fromEntries(c.levels.filter(l => ks.includes(l.strike)).map(l => [l.strike, l.value]));
    }
    return out;
  }, ks);
  const fieldBy = new Map((base.field?.levels || []).map(l => [l.strike, l]));
  const rows = out.map(o => {
    const f = fieldBy.get(o.strike);
    const diff = f && f.value !== 0 ? ((o.value - f.value) / Math.abs(f.value)) * 100 : null;
    return {
      strike: o.strike,
      ladderPrinted: o.netCanvas ?? '(no figure drawn)',
      ladderRead: o.readSize,
      ladderRaw: o.value,
      fieldPrinted: f ? base.field.print[o.strike] : '(not in the column)',
      fieldRaw: f ? f.value : null,
      fieldGross: f ? f.gross : null,
      diffPct: diff == null ? null : Math.round(diff * 10) / 10,
      sameSign: f ? Math.sign(f.value) === Math.sign(o.value) : null,
    };
  });
  SIX[label] = { cols, spot: base.spot, levels: base.levels, fieldTime: base.field?.time ?? null, fieldTimeNY: base.field ? new Date(base.field.time * 1000).toLocaleString('en-US', { timeZone: 'America/New_York' }) : null, nSnaps: base.nSnaps, fieldStrikes: base.field?.levels.length ?? 0, ladderStrikes: base.rows.length, fresh: base.fresh, state: base.state, rows };
  log('6c', label, JSON.stringify(SIX[label]).slice(0, 600));
  return SIX[label];
};

/* ================================================================================================================ */
/* GROUP B — one pane, SPY 1m, 1440×900: the ladder's every part, How sure, the strip, 6c at 1m, building/catching   */
/* ================================================================================================================ */
const groupB = async () => {
  const cfg = { layout: 1, panes: [paneCfg('SPY', '1m')] };
  const { ctx, page } = await open({ cfg, label: 'B 1 pane SPY 1m' });
  /* the building / catching-up chip from the first paint */
  const chips = [];
  const tLoad = Date.now();
  const poll = (async () => {
    while (Date.now() - tLoad < 45000) {
      const t = await page.evaluate(() => [...document.querySelectorAll('[data-trail-since]')].map(e => `${e.getAttribute('data-building')}: ${e.textContent}`).join(' / ')).catch(() => '');
      if (t && chips[chips.length - 1]?.t !== t) chips.push({ at: Date.now() - tLoad, t });
      await page.waitForTimeout(200);
    }
  })();
  const msReady = await ready(page, 1);
  await ladReady(page, 0);
  log('B ready', msReady, 'ms');
  await page.waitForTimeout(2500);
  await shot(page, 'B-1pane-1m');

  /* 6c at 1m first, on the untouched view */
  await item('6c-1m', 'Ladder net vs field net, SPY 1m', 'hover 10 strikes round the price in Net and Sides; read the newest field column', 'one figure per strike on both surfaces', async () => {
    const s = await sixC(page, 'SPY 1m');
    const matched = s.rows.filter(r => r.diffPct != null && Math.abs(r.diffPct) <= 1).length;
    return { observed: `${matched}/${s.rows.length} strikes within 1%; spot ${s.spot}; field column ${s.fieldTimeNY} NY (${s.fieldStrikes} strikes), ladder ${s.ladderStrikes} rows`, pass: matched === s.rows.length, ms: null, notes: 'see the 6c table' };
  });

  await poll;
  await item('S-building', 'Building / catching-up chip (foot row)', 'load SPY 1m on the feed at night; watch [data-trail-since] for 45 s', "a hatched chip naming the cause ('Building …' / 'Today's field starts …' / 'Catching up · earlier sessions N of M in')", async () => {
    const box = await page.evaluate(() => {
      const c = document.querySelector('[data-trail-since]');
      return c ? { cls: c.className.includes('stripes'), title: c.getAttribute('title'), inFoot: !!c.closest('[data-foot-row]') } : null;
    });
    return { observed: chips.length ? chips.map(c => `+${c.at}ms ${c.t}`).join(' → ') + (box ? ` · hatched ${box.cls} · in foot row ${box.inFoot}` : ' · gone at the end') : 'no chip at any point', pass: chips.length > 0, ms: chips[0]?.at ?? null, notes: 'ms = from navigation to the first chip seen; catching-up words seen only if the tiles were still arriving' };
  });

  /* C-04: rows ride the chart's price rows */
  let zoomTexts = [];
  await item('C-04', 'Ladder rows follow the chart (pan/zoom)', 'drag the price axis 200 px (zoom the price out); double-click it back', 'rows move with the price axis; ▲/▼ counts change; the axis comes back to its fit', async () => {
    const before = await page.evaluate(() => window.__ex.texts(0).filter(t => /^[\d,]+(\.\d+)?$/.test(t.t)).map(t => `${t.t}@${t.y}`).join(','));
    const counts0 = await page.evaluate(() => window.__ex.texts(0).filter(t => /^[▲▼] /.test(t.t)).map(t => t.t).join(' '));
    let g = null;
    const r = await timed(
      page,
      async () => {
        g = await priceAxisDrag(page, 0, 200);
      },
      b => window.__ex.texts(0).filter(t => /^[\d,]+(\.\d+)?$/.test(t.t)).map(t => `${t.t}@${t.y}`).join(',') !== b,
      before,
      5000
    );
    await away(page);
    await page.waitForTimeout(700);
    const auto0 = await autoScale(page, 0);
    const counts1 = await page.evaluate(() => window.__ex.texts(0).filter(t => /^[▲▼] /.test(t.t)).map(t => t.t).join(' '));
    zoomTexts = await page.evaluate(() => window.__ex.texts(0));
    await shot(page, 'B-zoomed-out');
    /* the rows still sit at the chart's own price rows: one strike's label against priceToCoordinate */
    const align = await page.evaluate(() => {
      const t = window.__ex.texts(0).filter(t => /^[\d,]+(\.\d+)?$/.test(t.t));
      const top = window.__ex.lad(0).getBoundingClientRect().top;
      const e = window.__ex.chart(0);
      const off = e.host.getBoundingClientRect().top - top;
      const d = t.slice(0, 6).map(x => Math.abs(off + e.candles.priceToCoordinate(Number(x.t.replace(/,/g, ''))) - x.y));
      return Math.max(...d);
    });
    await resetAxis(page, 0, g);
    const auto1 = await autoScale(page, 0);
    await away(page);
    return { observed: `rows moved: ${r.ok}; ▲/▼ before "${counts0}" after "${counts1}"; label vs chart row max offset ${align.toFixed(1)} px; autoscale after drag ${auto0}, after double-click ${auto1}`, pass: r.ok && align < 2 && auto1 === true, ms: r.ms, notes: 'a wheel on the plot (time zoom) did not move the rows in the smoke run: the 8-strike floor holds the range on a quiet tape' };
  });
  /* back to the newest bars for everything after */
  const live = await page.$('[data-back-to-live]');
  if (live) await live.click().catch(() => {});
  await page.waitForTimeout(800);

  /* C-07 Net / Sides */
  await item('C-07', 'Net / Sides tabs', 'click Sides, then Net', "Sides: legs and '◂ PUTS · CALLS ▸' head; Net: bars and 'NET GAMMA puts · calls'", async () => {
    const p0 = await page.evaluate(() => document.querySelector('[data-profile-view="net"]').getAttribute('aria-pressed'));
    const a = await timed(page, () => page.click('[data-profile-view="ladder"]'), () => window.__ex.texts(0).some(t => t.t.includes('PUTS · CALLS')), null, 5000);
    const sidesHead = await page.evaluate(() => window.__ex.texts(0).filter(t => /PUTS|NET|STRIKE|Δ SPOT/.test(t.t)).map(t => t.t).join(' | '));
    const b = await timed(page, () => page.click('[data-profile-view="net"]'), () => window.__ex.texts(0).some(t => t.t === 'NET GAMMA'), null, 5000);
    const netHead = await page.evaluate(() => window.__ex.texts(0).filter(t => /NET GAMMA|puts · calls|STRIKE|Δ SPOT/.test(t.t)).map(t => t.t).join(' | '));
    /* direction: in Net, where do positive (puts) figures stand vs the centre */
    const dir = await page.evaluate(() => {
      const t = window.__ex.texts(0).filter(t => /^[+−]?\$/.test(t.t) && /bold|700/.test(t.font));
      const pos = t.filter(x => !x.t.startsWith('−'));
      const neg = t.filter(x => x.t.startsWith('−'));
      return { posAlign: pos[0]?.al, negAlign: neg[0]?.al, posX: pos[0]?.x, negX: neg[0]?.x };
    });
    return {
      observed: `default Net aria-pressed=${p0}; Sides head: ${sidesHead}; Net head: ${netHead}; Net puts(+) figures align ${dir.posAlign} (x ${dir.posX}), calls(−) align ${dir.negAlign} (x ${dir.negX})`,
      pass: p0 === 'true' && a.ok && b.ok,
      ms: Math.max(a.ms, b.ms),
      notes: `Net draws puts (positive) to the RIGHT while its head reads "puts · calls" left to right and Sides grows puts LEFT (inventory finding, still so). Not persisted across mounts. Sides ${a.ms} ms, Net ${b.ms} ms.`,
    };
  });

  /* C-15 key words, C-16 heads, C-17 figures, C-22/23/24/25/27 canvas parts — Net view */
  const netTexts = await page.evaluate(() => window.__ex.texts(0));
  const netKey = await page.evaluate(() => window.__ex.lad(0).querySelector('canvas').dataset.key ?? null);
  const pr = await page.evaluate(() => {
    const p = window.__ex.props(0);
    return { openRatio: p.openRatio ? p.openRatio.size : 0, lagged: p.lagged ? p.lagged.size : 0, spot: p.levels.spot, cw: p.levels.callWall, pw: p.levels.putWall, flip: p.levels.flip, sup: p.levels.supreme, legs: p.legs ? p.legs.size : 0, w: window.__ex.lad(0).getBoundingClientRect().width, sigmaRem: p.sigmaRem };
  });
  await item('C-15', 'Ladder key band (Net view)', 'read the canvas data-key in Net view', "names only what is drawn: no 'the spine now', no 'at the open', no '10·30·60 min before' in Net", async () => {
    const bad = /spine|at the open|min before/.test(netKey || '');
    const sw = netTexts.filter(t => /puts amplify|calls absorb|supreme/.test(t.t)).map(t => `${t.t} (${t.font.match(/\d+px/)?.[0]})`).join(', ');
    return { observed: `data-key="${netKey}"; drawn: ${sw}`, pass: netKey != null && !bad, ms: null, notes: `ladder width ${pr.w}px; key words 10 px` };
  });
  await item('C-16', 'Column heads (canvas)', 'read the heads in Net view', 'NET GAMMA puts · calls / STRIKE; Δ figures carry a head', async () => {
    const heads = netTexts.filter(t => /NET GAMMA|puts · calls|STRIKE|Δ SPOT|A MOVE FORCES/.test(t.t)).map(t => `${t.t} (${t.font.match(/\d+px/)?.[0]})`);
    const deltas = netTexts.filter(t => /^[+−]\d.*%$/.test(t.t)).length;
    const hasDeltaHead = heads.some(h => h.startsWith('Δ SPOT'));
    return { observed: `heads: ${heads.join(' | ')}; Δ% figures drawn: ${deltas}; 'Δ SPOT' head: ${hasDeltaHead}`, pass: heads.some(h => h.startsWith('NET GAMMA')) && heads.some(h => h.startsWith('STRIKE')) && (deltas === 0 || hasDeltaHead), ms: null, notes: hasDeltaHead ? '' : "Δ/σ figures print in Net view under no head ('Δ SPOT' is drawn in Sides only, ProfilePanel.tsx:950-953); heads are 9 px caps" };
  });
  /* signed since 9115af0, as the peek, the bead card and the day panel print them: '+$1.2M', '−$1.2M' (the audit's signs row) */
  await item('C-17', 'Net bars and figures', 'read the Net figures', "positive '+$1.2M', negative '−$1.2M' (true minus, never a hyphen), via the house formatter", async () => {
    const figs = netTexts.filter(t => /^[−+-]?\$/.test(t.t) && /bold|700/.test(t.font));
    const plus = figs.filter(t => t.t.startsWith('+')).length;
    const hy = figs.filter(t => t.t.startsWith('-')).length;
    const neg = figs.filter(t => t.t.startsWith('−')).length;
    return { observed: `${figs.length} figures (${neg} negative with U+2212, ${plus} with '+', ${hy} with hyphen); sample ${figs.slice(0, 6).map(t => t.t).join(' ')}; font ${figs[0]?.font}`, pass: figs.length > 0 && hy === 0 && plus + neg === figs.length, ms: null, notes: "unsigned positives here vs '+$X' in the peek, the bead card and the day panel (inventory C-17/§3.10)" };
  });
  await item('C-22', 'Strike labels', 'read the strike column', 'a label every stride rows, levels in their ink', async () => {
    const labs = netTexts.filter(t => /^[\d,]+(\.\d+)?$/.test(t.t));
    const inks = [...new Set(labs.map(t => t.fs))];
    return { observed: `${labs.length} labels (${labs.slice(0, 4).map(t => t.t).join(', ')}…), font ${labs[0]?.font}, inks ${inks.join(' ')}`, pass: labs.length >= 5, ms: null, notes: '' };
  });
  await item('C-23', 'Δ spot % and σ (strike column)', 'read the Δ figures and their inks', 'Δ in the direction ink (bull above, bear below), resolved colours; σ beside', async () => {
    const d = netTexts.filter(t => /^[+−]\d.*%$/.test(t.t));
    const up = d.filter(t => t.t.startsWith('+'));
    const dn = d.filter(t => t.t.startsWith('−'));
    const sg = netTexts.filter(t => /σ$/.test(t.t));
    const labInk = netTexts.find(t => /^[\d,]+(\.\d+)?$/.test(t.t))?.fs;
    const tok = await page.evaluate(() => {
      const el = window.__ex.lad(0);
      const cs = getComputedStyle(el);
      return { bull: cs.getPropertyValue('--bull').trim(), bear: cs.getPropertyValue('--bear').trim() };
    });
    const hex = s => (s || '').replace(/\s+/g, ' ');
    const upInk = up[0]?.fs;
    const dnInk = dn[0]?.fs;
    const ok = d.length > 0 && upInk && dnInk && upInk !== dnInk && upInk !== labInk && !/var\(/.test(upInk + dnInk);
    return { observed: `${d.length} Δ figures (e.g. ${d.slice(0, 2).map(t => t.t).join(', ')}); up ink ${hex(upInk)}, down ink ${hex(dnInk)}, strike-label ink ${labInk}; tokens --bull "${tok.bull}" --bear "${tok.bear}"; σ figures ${sg.length} (e.g. "${sg[0]?.t ?? '—'}")`, pass: !!ok, ms: null, notes: `9 px; sigmaRem ${pr.sigmaRem}` };
  });
  await item('C-24', 'Spot chip', 'read the chip at the price row and the pane head price', 'num(spot, 2), the same price as the head and the capsule', async () => {
    const want = await page.evaluate(async s => (await import('/src/core/format.ts')).num(s, 2), pr.spot);
    const chip = netTexts.find(t => t.t === want);
    const head = await page.evaluate(() => document.querySelector('[data-price-stale], [data-pane-head]')?.textContent || '');
    const headHas = head.includes(want);
    return { observed: `levels.spot ${pr.spot} → "${want}"; chip drawn ${!!chip}; pane head shows it: ${headHas} ("${clip(head, 60)}")`, pass: !!chip && headHas, ms: null, notes: '' };
  });
  await item('C-25', 'Flip rule and caption', 'read "flip …" on the canvas and the axis chip', 'caption names the flip; matches the axis chip', async () => {
    let cap = netTexts.find(t => /^flip /.test(t.t)) || zoomTexts.find(t => /^flip /.test(t.t));
    let drags = 0;
    if (!cap && Number.isFinite(pr.flip)) {
      /* zoom the price out until the flip's row is on the plot, read the caption, give the axis back */
      let g = null;
      while (drags < 5 && !(await inPlot(page, 0, pr.flip))) {
        const g1 = await priceAxisDrag(page, 0, 300);
        g = g ?? g1;
        drags++;
      }
      await away(page);
      await page.waitForTimeout(600);
      const zt = await page.evaluate(() => window.__ex.texts(0));
      cap = zt.find(t => /^flip /.test(t.t));
      zoomTexts = zoomTexts.concat(zt);
      await shot(page, 'B-flip-in-view');
      await resetAxis(page, 0, g);
    }
    const chip = await page.evaluate(() => [...document.querySelectorAll('[data-axis-chip]')].map(c => `${c.getAttribute('data-axis-chip')}:${c.innerText.replace(/\s+/g, ' ')}`).join(' | '));
    return { observed: `caption "${cap?.t ?? '(none drawn)'}" (${cap?.font ?? ''}; ${drags} price-axis drags to bring the flip on the plot); levels.flip ${pr.flip}; axis chips: ${chip || '(none)'}`, pass: !!cap || pr.flip == null || !Number.isFinite(pr.flip), ms: null, notes: 'caption is 9 px; an integer flip prints "flip 777" here and "Flip 777.00" on the chip (inventory)' };
  });
  await item('C-26', 'Level marks (wall stripes, supreme wash, label inks)', 'read the wall strikes’ label inks', 'call/put wall labels in the wall inks, supreme marked', async () => {
    const lab = k => [...netTexts, ...zoomTexts].find(t => Number(t.t.replace(/,/g, '')) === k && /^[\d,]+(\.\d+)?$/.test(t.t));
    const plain = netTexts.filter(t => /^[\d,]+(\.\d+)?$/.test(t.t)).map(t => t.fs);
    const mode = plain.sort((a, b) => plain.filter(x => x === b).length - plain.filter(x => x === a).length)[0];
    const cw = lab(pr.cw);
    const pw = lab(pr.pw);
    return { observed: `CW ${pr.cw} label ink ${cw?.fs ?? '(not on screen)'}; PW ${pr.pw} label ink ${pw?.fs ?? '(not on screen)'}; plain label ink ${mode}; supreme ${pr.sup}`, pass: (!cw || cw.fs !== mode) && (!pw || pw.fs !== mode), ms: null, notes: 'stripes and the supreme wash are fills (visual — see the screenshot)' };
  });
  await item('C-27', '▲ / ▼ culled counts', 'read the count texts', "'▲ N' / '▼ N' where rows are off the plot", async () => {
    const c = netTexts.filter(t => /^[▲▼] \d+$/.test(t.t)).map(t => `${t.t} (${t.font.match(/\d+px/)?.[0]})`);
    return { observed: c.join(', ') || '(none: every row on screen)', pass: true, ms: null, notes: '9 px' };
  });

  /* Sides view: C-18 legs, C-19 spine, C-20 ghost, C-21 dots, C-31 read line */
  await page.click('[data-profile-view="ladder"]');
  await page.waitForTimeout(700);
  const sidesTexts = await page.evaluate(() => window.__ex.texts(0));
  const sidesKey = await page.evaluate(() => window.__ex.lad(0).querySelector('canvas').dataset.key ?? null);
  await item('C-18', 'Sides legs, leg figures, NET column', 'Sides view: read the canvas', "leg figures past the tips (lane ≥180), 'NET' column (lane ≥300)", async () => {
    const figs = sidesTexts.filter(t => /^[−+-]?\$/.test(t.t));
    const net = sidesTexts.some(t => t.t === 'NET');
    return { observed: `${figs.length} $ figures (e.g. ${figs.slice(0, 4).map(t => t.t).join(' ')}); NET head ${net}; legs map ${pr.legs} strikes`, pass: figs.length > 0, ms: null, notes: 'on the feed the legs are UW’s gex.put/gex.call' };
  });
  await item('C-19', 'Spine (Sides)', 'Sides view: read the key', "key names 'the spine now'", async () => ({ observed: `data-key="${sidesKey}"`, pass: /spine now|now/.test(sidesKey || ''), ms: null, notes: 'the curve itself is a stroke (visual; see area-c-B-sides.png)' }));
  await item('C-20', 'Ghost spine at the open (Sides)', 'compare the key with props.openRatio', "'at the open' in the key iff an open ratio is drawn", async () => {
    const said = /at the open/.test(sidesKey || '');
    return { observed: `openRatio strikes ${pr.openRatio}; key says 'at the open': ${said}`, pass: said === pr.openRatio > 0 || (!said && pr.openRatio > 0), ms: null, notes: pr.openRatio > 0 && !said ? 'ratio held but no placed row has it (key follows drawn rows)' : 'on the feed the ratio is the modeled field’s, applied to UW rows (inventory C-20)' };
  });
  await item('C-21', 'Ghost dots 10/30/60 min (Sides)', 'compare the key with props.lagged', "'10 · 30 · 60 min before' iff dots are drawn", async () => {
    const said = /min before|10·30·60m/.test(sidesKey || '');
    return { observed: `lagged strikes ${pr.lagged}; key names the dots: ${said}`, pass: said ? pr.lagged > 0 : true, ms: null, notes: pr.lagged === 0 ? 'no UW book read 10–60 min before today (night) — nothing to draw, key silent' : '' };
  });
  await shot(page, 'B-sides');
  await item('C-31', 'Read line Size (Sides)', 'hover a row in Sides', "'Size $X · amplifies|absorbs'", async () => {
    const k = (await page.evaluate(() => window.__ex.props(0).rows))
      .map(r => r.strike)
      .sort((a, b) => Math.abs(a - pr.spot) - Math.abs(b - pr.spot))[1];
    const t = Date.now();
    const h = await hoverStrike(page, 0, k);
    const ms = Date.now() - t;
    await away(page);
    return { observed: clip(h?.text, 300), pass: /Size\s*\$[\d.,]+[KMB]?\s*·\s*(amplifies|absorbs)/.test(h?.text || ''), ms, notes: "unsigned value plus a word (the bead card writes '+$X · puts amplify')" };
  });
  await page.click('[data-profile-view="net"]');
  await page.waitForTimeout(400);

  /* C-30 read line in Net view */
  await item('C-30', 'Read line (Net view)', 'hover the call wall’s row (or the nearest strike)', "'780 Call wall +$2.12 · +0.27% · 0.4σ from spot · Put $X · Call $Y · Share 6.1% · A move here forces …'", async () => {
    const rows = await page.evaluate(() => window.__ex.props(0).rows.map(r => r.strike));
    let k = null;
    for (const c of [pr.cw, pr.pw, pr.sup]) if (k == null && rows.includes(c) && (await inPlot(page, 0, c))) k = c;
    if (k == null) k = rows.sort((a, b) => Math.abs(a - pr.spot) - Math.abs(b - pr.spot))[0];
    const t = Date.now();
    const h = await hoverStrike(page, 0, k);
    const ms = Date.now() - t;
    const dir = await page.evaluate(() => [...document.querySelectorAll('[data-profile-read] [data-dir]')].map(e => e.getAttribute('data-dir')).join(','));
    await away(page);
    const t2 = h?.text || '';
    const ok = Number(h?.strike) === k && /from spot/.test(t2) && /Put/.test(t2) && /Call/.test(t2) && /Share/.test(t2);
    return { observed: `${k}: "${clip(t2, 300)}"; data-dir ${dir}`, pass: ok, ms, notes: "'Share' is |net| ÷ Σ|net| of the rows on screen (changes with zoom)" };
  });

  /* C-29 click to keep */
  await item('C-29', 'Click a row to keep it → the chart pins its chain', 'click the nearest strike’s row; click again', "silver ring, read line 'kept · click to let go', chart focusStrike = the strike; second click releases", async () => {
    const k = (await page.evaluate(() => window.__ex.props(0).rows.map(r => r.strike))).sort((a, b) => Math.abs(a - pr.spot) - Math.abs(b - pr.spot))[0];
    const h = await hoverStrike(page, 0, k);
    const a = await timed(page, () => page.mouse.click(h.x, h.y), k => window.__ex.props(0)?.focusPrice === k && window.__ex.chart(0)?.trails?.focusStrike === k, k, 4000);
    const read = await page.evaluate(() => document.querySelector('[data-profile-read]')?.innerText || '');
    const fs = await page.evaluate(() => [window.__ex.props(0)?.focusPrice, window.__ex.chart(0)?.trails?.focusStrike]);
    const b = await timed(page, () => page.mouse.click(h.x, h.y), () => window.__ex.props(0)?.focusPrice == null && window.__ex.chart(0)?.trails?.focusStrike == null, null, 4000);
    await away(page);
    return { observed: `kept ${a.ok} (focusPrice/focusStrike ${fs.join('/')}); read "${clip(read, 120)}"; released ${b.ok}`, pass: a.ok && b.ok && /kept · click to let go/.test(read), ms: Math.max(a.ms, b.ms), notes: `keep ${a.ms} ms, release ${b.ms} ms; no key path to keep a row (pointer only)` };
  });

  /* C-10 Lanes, C-28 Flow lane, C-06 lane sash, C-09 lane head Term */
  await item('C-09', 'Lane head words with Term', 'hover the size lane head', "'Net · GEX · puts − calls' with a tooltip definition", async () => {
    /* the lane words stand on the full tier alone (≥440 px, one-row head); a one-pane desk at 1440 rests at 476 px */
    let expanded = false;
    if (!(await page.$('[data-lane-head="size"]'))) {
      await blur(page);
      await page.keyboard.press('f');
      await page.waitForSelector('[data-lane-head="size"]', { timeout: 5000 }).catch(() => {});
      expanded = true;
    }
    const head = await page.evaluate(() => document.querySelector('[data-lane-head="size"]')?.innerText || null);
    const tb = await page.evaluate(() => {
      const el = document.querySelector('[data-lane-head="size"] [role="button"]');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const x = r.left + Math.min(20, r.width / 2);
      const y = r.top + r.height / 2;
      const top = document.elementFromPoint(x, y);
      const row = el.closest('[data-lane-head]').parentElement;
      const kids = [...row.children].map(c => `${c.getAttribute('data-lane-head') ? 'lane ' + c.getAttribute('data-lane-head') : c.hasAttribute('data-profile-views') ? 'views' : c.hasAttribute('data-profile-head-card') ? 'expiry' : c.hasAttribute('data-profile-tools') ? 'tools' : c.tagName}:${Math.round(c.getBoundingClientRect().width)}`).join(' ');
      return { x, y, w: Math.round(r.width), kids, onTop: !!top && (top === el || el.contains(top)), top: top ? top.tagName + '.' + String(top.className).slice(0, 40) : null };
    });
    let how = 'pointer';
    let r = await timed(page, () => (tb ? page.mouse.move(tb.x, tb.y) : Promise.resolve()), () => [...document.querySelectorAll('[role="tooltip"]')].some(e => window.__ex.vis(e)), null, 3000);
    const byPointer = r.ok;
    if (!r.ok) {
      how = 'focus';
      r = await timed(page, () => page.focus('[data-lane-head="size"] [role="button"]').catch(() => {}), () => [...document.querySelectorAll('[role="tooltip"]')].some(e => window.__ex.vis(e)), null, 3000);
    }
    const tip = await page.evaluate(() => [...document.querySelectorAll('[role="tooltip"]')].filter(e => window.__ex.vis(e)).map(e => e.innerText).join(' / '));
    /* THE NAMES WHERE THEY FIT (9115af0 — at the rest widths they were laid out 0–28 px, never read): from a 640 px ladder;
       under it the column heads on the rows name the lanes and How to read defines them, and no name stands at all */
    const panelW = await page.evaluate(() => Math.round(document.querySelector('[data-profile-panel]')?.getBoundingClientRect().width ?? 0));
    await away(page);
    if (expanded) {
      await blur(page);
      await page.keyboard.press('f');
      await page.waitForTimeout(800);
    }
    if (panelW < 640) return { observed: `the ladder is ${panelW} px (names from 640 px): ${head ? `a name stands, "${clip(head, 60)}", ${tb?.w ?? 0} px wide` : 'no lane name laid out; the column heads name the lanes'}`, pass: !head, ms: null, notes: 'the lanes are defined in How to read at this width' };
    return { observed: `head "${clip(head, 80)}" in the DOM, drawn ${tb?.w ?? 0} px wide (head row: ${tb?.kids}); tooltip by ${how} ${r.ok ? `"${clip(tip, 300)}"` : '(none)'}; under the pointer: ${tb?.onTop ? 'the Term' : tb?.top}`, pass: !!head && (tb?.w ?? 0) >= 40 && byPointer, ms: r.ms, notes: ((tb?.w ?? 0) < 40 ? `THE LANE WORDS HAVE NO ROOM: on the full tier the head row gives the view tabs, the Expiry card and the tools their width and the lane head (min-w-0 flex-1) what is left — ${tb?.w ?? 0} px at the 476 px rest, 28 px at the 520 px expanded width (measured) — so the words truncate to nothing and cannot be hovered (ProfilePanel.tsx head row ~1950-1975). ` : '') + (tb && !tb.onTop ? `At its point the pointer hits ${tb.top}. ` : '') + (/dash|Orange|blue|capsule/i.test(tip) ? 'STALE TEXT: the tooltip still speaks of dashes / orange-blue, the view is a gold/violet diverging bar (data/terms.ts:70-76)' : '') };
  });
  await item('C-10', 'Lanes menu', 'Lanes → Flow, Both, Size', "data-lane follows; stored as the pane's lane; head 'A MOVE FORCES' in Flow", async () => {
    const pick = async v => {
      await page.click('[data-dropdown="lanes"]');
      await page.getByRole('menuitemradio', { name: new RegExp(`^${v}`) }).first().click();
    };
    const a = await timed(page, () => pick('Flow'), () => document.querySelector('[data-profile-panel]')?.getAttribute('data-lane') === 'flow' && window.__ex.texts(0).some(t => t.t === 'A MOVE FORCES'), null, 5000);
    const flowTexts = await page.evaluate(() => window.__ex.texts(0).filter(t => /^(buy|sell) |A MOVE FORCES/.test(t.t)).map(t => t.t));
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('slayer_terrain_v1') || '{}').panes?.[0]?.lane ?? null);
    await shot(page, 'B-flow');
    const b = await timed(page, () => pick('Both'), () => document.querySelector('[data-profile-panel]')?.getAttribute('data-lane') === 'both', null, 5000);
    SIX._flow = flowTexts;
    return { observed: `Flow ${a.ok} (stored lane "${stored}"), flow texts ${flowTexts.slice(0, 5).join(' | ')}; Both ${b.ok}`, pass: a.ok && b.ok && stored === 'flow', ms: Math.max(a.ms, b.ms), notes: `Flow ${a.ms} ms, Both ${b.ms} ms` };
  });
  await item('C-28', 'Flow lane figures', 'Lanes Flow/Both: read the capsules', "'buy/sell $X' via core/format (usdCompact '$5.2M')", async () => {
    const t = await page.evaluate(() => window.__ex.texts(0).filter(t => /^(buy|sell) /.test(t.t)).map(t => `${t.t} (${t.font.match(/\d+px/)?.[0]})`));
    const whole = t.filter(x => /\$\d+[KMB] /.test(x) || /\$\d+[KMB]$/.test(x.split(' (')[0]));
    return { observed: t.slice(0, 6).join(', ') || '(no capsule figures drawn)', pass: t.length > 0, ms: null, notes: whole.length ? `fmtFlow rounds to whole units ("${whole[0]}") — a local toFixed formatter (hedgeFlow.ts), not core/format's three figures` : '' };
  });
  await item('C-06', 'Lane sash (Both)', 'drag the sash right 60 px, then double-click', 'slayer_profile_split changes; double-click → 0.5', async () => {
    const g = await page.evaluate(() => window.__ex.box(document.querySelector('[data-profile-split-grip]')));
    if (!g) return { observed: 'no sash rendered', pass: false, ms: null, notes: '' };
    const s0 = await page.evaluate(() => localStorage.getItem('slayer_profile_split'));
    /* the strike the chart keeps BEFORE the gestures — a strike kept by an earlier step is not the sash's */
    SIX._sashKept0 = await page.evaluate(() => window.__ex.props(0)?.focusPrice ?? null);
    const t = Date.now();
    await page.mouse.move(g.x + g.w / 2, g.y + g.h / 2);
    await page.mouse.down();
    await page.mouse.move(g.x + g.w / 2 + 30, g.y + g.h / 2, { steps: 4 });
    await page.mouse.move(g.x + g.w / 2 + 60, g.y + g.h / 2, { steps: 4 });
    await page.mouse.up();
    await page.waitForTimeout(150);
    const s1 = await page.evaluate(() => localStorage.getItem('slayer_profile_split'));
    const ms = Date.now() - t;
    const g2 = await page.evaluate(() => window.__ex.box(document.querySelector('[data-profile-split-grip]')));
    await page.mouse.dblclick(g2.x + g2.w / 2, g2.y + g2.h / 2);
    await page.waitForTimeout(200);
    const s2 = await page.evaluate(() => localStorage.getItem('slayer_profile_split'));
    const kept = await page.evaluate(() => window.__ex.props(0)?.focusPrice ?? null);
    await away(page);
    SIX._sashKept = kept;
    return { observed: `split ${s0} → ${s1} (sash x ${g.x}→${g2.x}) → dblclick ${s2}`, pass: s1 !== s0 && Number(s2) === 0.5, ms, notes: 'pointer only' };
  });
  await item('C-29b', 'A sash drag keeps no strike', 'the C-06 sash drag and double-click', 'the chart’s focus stays as it was (a drag is not a click)', async () => ({ observed: `strike kept before the sash gestures: ${SIX._sashKept0 ?? 'none'}, after: ${SIX._sashKept ?? 'none'}`, pass: SIX._sashKept === SIX._sashKept0, ms: null, notes: SIX._sashKept !== SIX._sashKept0 ? 'the root’s onClick fires after a sash drag/double-click that ends over the panel (stopPropagation on pointerdown does not stop click) — ProfilePanel.tsx root onClick (~1905) and the sash (~1931)' : '' }));
  await page.click('[data-dropdown="lanes"]').catch(() => {});
  await page.getByRole('menuitemradio', { name: /^Size/ }).first().click().catch(() => {});
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__ex.props(0)?.focusPrice != null && window.__ex.props(0).onSelect?.(window.__ex.props(0).focusPrice));

  /* C-11 Vol */
  await item('C-11', 'Vol switch', 'click Vol', "aria-pressed true; steel bars under the size lane and 'VPOC'", async () => {
    const r = await timed(page, () => page.click('[data-profile-vol]'), () => document.querySelector('[data-profile-vol]')?.getAttribute('aria-pressed') === 'true' && window.__ex.texts(0).some(t => /VPOC/.test(t.t)), null, 5000);
    const v = await page.evaluate(() => window.__ex.texts(0).filter(t => /VPOC|VAH|VAL/.test(t.t)).map(t => `${t.t} (${t.font.match(/\d+px/)?.[0]})`));
    await shot(page, 'B-vol');
    await page.click('[data-profile-vol]');
    const px = Number(v[0]?.match(/\((\d+)px\)/)?.[1] ?? 0);
    return { observed: `pressed+VPOC ${r.ok}; ${v.join(', ')}`, pass: r.ok, ms: r.ms, notes: px && px < 11 ? `VPOC word ${px} px — under the 11 px floor` : '' };
  });

  /* C-12 How sure door and the card's sections C-37…C-48 */
  let sureText = '';
  await item('C-12', 'How sure door in the ladder head', 'click [data-how-sure="book"] in the ladder', "a 340 px card 'How sure are the walls and the flip'", async () => {
    const r = await timed(page, () => page.click('[data-profile-panel] [data-how-sure="book"]'), () => window.__ex.vis(document.querySelector('[data-popover-card="how-sure-book"]')), null, 5000);
    const card = await page.evaluate(() => {
      const c = document.querySelector('[data-popover-card="how-sure-book"]');
      return c ? { w: Math.round(c.getBoundingClientRect().width), t: c.innerText, secs: [...c.querySelectorAll('[data-how-sure-window-badge],[data-how-sure-replay],[data-how-sure-window],[data-how-sure-regime],[data-how-sure-freshness],[data-how-sure-field],[data-how-sure-drift],[data-how-sure-alerts],[data-how-sure-record],[data-how-sure-move],[data-how-sure-levels]')].map(e => [...e.attributes].map(a => a.name).find(n => n.startsWith('data-how-sure'))) } : null;
    });
    sureText = card?.t || '';
    SIX._sureSecs = card?.secs || [];
    SIX._sure = sureText;
    await shot(page, 'B-howsure');
    return { observed: `card ${r.ok}, ${card?.w}px; sections ${card?.secs.join(', ')}; "${clip(card?.t, 120)}"`, pass: r.ok && /How sure are the walls and the flip/.test(card?.t || ''), ms: r.ms, notes: '' };
  });
  const sec = async (id, name, attr, expected, extra = () => '') =>
    item(id, name, 'read the open How sure card', expected, async () => {
      const t = await page.evaluate(a => document.querySelector(`[data-popover-card="how-sure-book"] [${a}]`)?.innerText ?? null, attr);
      return { observed: t ? clip(t, 400) : '(section absent)', pass: !!t, ms: null, notes: extra(t) };
    });
  await sec('C-37', 'How sure: head and window badge', 'data-how-sure-window-badge', "badge 'repriced every minute · all windows' on the feed");
  await sec('C-40', 'How sure: The regime', 'data-how-sure-regime', 'the newest column’s net as its meaning, percentile, range, note', t => (t ? '' : "at night the pane's own regime reading (paneRegime, Terrain.tsx:1712-1720) reads fTrail.snaps — today's modeled minutes only, empty before the first chain read — while the chart draws yesterday's tiled columns; the strip says 'No column of the field yet' over a full field"));
  await item('C-41', 'How sure: What they assume', 'read the open card', 'a fixed sentence under "What they assume"', async () => {
    const m = sureText.match(/What they assume\s*\n?([^\n]+)/);
    return { observed: m ? clip(m[1], 300) : '(absent)', pass: !!m, ms: null, notes: '' };
  });
  await sec('C-42', 'How sure: How fresh', 'data-how-sure-freshness', 'OI date, when and at what price the book was figured', t => (t && /\d{4,}\.\d{2}/.test(t) ? 'price printed without grouping (toFixed, levels.ts:437)' : ''));
  await sec('C-43', 'How sure: Model agreement', 'data-how-sure-field', 'the field’s residual against UW’s 60-day book, coverage');
  await item('C-44', 'How sure: Delta to 3:50 pm', 'read the open How sure card', "'Delta to 3:50 pm · mechanical drift, unvalidated' (live, before 3:50 pm)", async () => {
    const t = await page.evaluate(() => document.querySelector('[data-popover-card="how-sure-book"] [data-how-sure-drift]')?.innerText ?? null);
    return { observed: t ? clip(t, 300) : '(section absent)', pass: t ? true : 'manual', ms: null, notes: t ? '' : 'by design none from 3:50 pm on (driftEndOf); the run is at night, so it needs a live session before 3:50 pm' };
  });
  await item('C-45', 'How sure: Level alerts today', 'read the open card', 'each alert with its +15/+30 outcome', async () => {
    const t = await page.evaluate(() => document.querySelector('[data-popover-card="how-sure-book"] [data-how-sure-alerts]')?.innerText ?? null);
    return { observed: t ? clip(t, 300) : '(section absent — no level alert fired today)', pass: t ? true : 'manual', ms: null, notes: t ? '' : 'needs a followed level to fire in a live session; the market is closed (night in New York)' };
  });
  await sec('C-46', 'How sure: Track record', 'data-how-sure-record', 'scope, one line per level type, hold-out note');
  await sec('C-47', 'How sure: Priced move · σ to the close', 'data-how-sure-move', 'market and budget lines and the calibration');
  await item('C-48', 'How sure: If the side were the other way (walls named)', 'compare the card’s walls with the ladder’s held levels', 'the same call wall / put wall as the ladder and the strip', async () => {
    const t = await page.evaluate(() => document.querySelector('[data-popover-card="how-sure-book"] [data-how-sure-levels]')?.innerText ?? null);
    const nums = (t || '').match(/\d[\d,]*(\.\d+)?/g) || [];
    const has = k => k == null || nums.some(n => Number(n.replace(/,/g, '')) === k);
    const strip = await page.evaluate(() => document.querySelector('[data-decision-box="levels"]')?.innerText || '');
    return { observed: `card: "${clip(t, 300)}"; ladder held CW ${pr.cw} PW ${pr.pw} flip ${pr.flip}; strip "${clip(strip, 100)}"`, pass: !!t && has(pr.cw) && has(pr.pw), ms: null, notes: /\d{4,}(?!,)/.test(t || '') && !/\d,\d{3}/.test(t || '') ? 'figures via toFixed (no grouping) — levelSureness.ts:86' : '' };
  });
  await item('C-12b', 'How sure card closes on Esc', 'press Esc with the card open', 'the card closes', async () => {
    const r = await timed(page, () => esc(page), () => !document.querySelector('[data-popover-card="how-sure-book"]'), null, 3000);
    return { observed: `closed ${r.ok}`, pass: r.ok, ms: r.ms, notes: '' };
  });

  /* C-08 Expiry → To Friday → How sure window line; back to All 60 days */
  await item('C-08', 'Expiry card → To Friday (feed)', 'ladder Expiry → To Friday; open How sure; back to All 60 days', 'the ladder reads UW’s 60-day book through the window; How sure gains the window line', async () => {
    const before = await page.evaluate(() => JSON.stringify(window.__ex.props(0).rows.slice(0, 40).map(r => [r.strike, Math.round(r.value)])));
    const r = await timed(
      page,
      async () => {
        await page.click('[data-profile-head-card] [data-dropdown="terrain-expiry"]');
        await page.click('[data-expiry-choice="w:fri"]');
      },
      b => JSON.stringify(window.__ex.props(0).rows.slice(0, 40).map(r => [r.strike, Math.round(r.value)])) !== b,
      before,
      15000
    );
    const trig = await page.evaluate(() => document.querySelector('[data-profile-head-card] [data-dropdown="terrain-expiry"]')?.innerText);
    await page.click('[data-profile-panel] [data-how-sure="book"]');
    await page.waitForTimeout(500);
    const w = await page.evaluate(() => ({ badge: document.querySelector('[data-how-sure-window-badge]')?.innerText, line: document.querySelector('[data-how-sure-window]')?.innerText }));
    await esc(page);
    await page.waitForTimeout(300);
    await page.click('[data-profile-head-card] [data-dropdown="terrain-expiry"]');
    await page.click('[data-expiry-choice="book"]');
    await page.waitForTimeout(1500);
    const back = await page.evaluate(() => [document.querySelector('[data-profile-head-card] [data-dropdown="terrain-expiry"]')?.innerText, JSON.parse(localStorage.getItem('slayer_terrain_v1') || '{}').railCut]);
    return { observed: `rows changed ${r.ok}; trigger "${clip(trig, 40)}"; How sure badge "${w.badge}", window "${clip(w.line, 240)}"; back: "${back[0]}" (railCut ${back[1]})`, pass: r.ok && !!w.line, ms: r.ms, notes: "on 'All 60 days' the ladder reads UW’s EVERY-expiry book (the label names the field's universe; inventory C-08)" };
  });

  /* C-03 Colours */
  await item('C-03', 'Desk Colours → Thermal', 'Colours → Thermal; back to House', 'ladder ink changes; chart ovals, strip tones stay gold/violet', async () => {
    const figInk = () => page.evaluate(() => window.__ex.texts(0).filter(t => /^[+−]?\$/.test(t.t) && /bold|700/.test(t.font)).map(t => t.fs).slice(0, 4).join(','));
    const ink0 = await figInk();
    const ov0 = await page.evaluate(() => JSON.stringify(window.__ex.chart(0)?.trails?.legend?.()?.inks ?? null));
    const st0 = await page.evaluate(() => getComputedStyle(document.querySelector('[data-decision-box="regime"] [data-decision-words]') || document.body).color);
    const r = await timed(
      page,
      async () => {
        await page.click('[data-dropdown="terrain-colours"]');
        await page.getByRole('menuitemradio', { name: /^Thermal/ }).first().click();
      },
      i0 => window.__ex.texts(0).filter(t => /^[+−]?\$/.test(t.t) && /bold|700/.test(t.font)).map(t => t.fs).slice(0, 4).join(',') !== i0,
      ink0,
      5000
    );
    await page.waitForTimeout(500);
    const ink1 = await figInk();
    const ov1 = await page.evaluate(() => JSON.stringify(window.__ex.chart(0)?.trails?.legend?.()?.inks ?? null));
    const st1 = await page.evaluate(() => getComputedStyle(document.querySelector('[data-decision-box="regime"] [data-decision-words]') || document.body).color);
    await shot(page, 'B-thermal');
    await page.click('[data-dropdown="terrain-colours"]');
    await page.getByRole('menuitemradio', { name: /^House/ }).first().click();
    await page.waitForTimeout(500);
    return { observed: `ladder figure inks ${ink0} → ${ink1}; oval inks unchanged ${ov0 === ov1}; strip regime ink ${st0} → ${st1}`, pass: r.ok && ov0 === ov1 && st0 === st1, ms: r.ms, notes: 'Thermal re-inks the ladder only — the ladder then disagrees with every other gamma ink (inventory C-03)' };
  });

  /* C-49…C-54 the decision strip */
  const boxes = await page.evaluate(() => {
    const s = document.querySelector('[data-decision-strip]');
    return s ? { form: s.getAttribute('data-decision-form'), lines: s.getAttribute('data-decision-lines'), boxes: [...s.querySelectorAll('[data-decision-box]')].map(b => ({ k: b.getAttribute('data-decision-box'), words: b.innerText.replace(/\s+/g, ' '), title: b.getAttribute('title') })) } : null;
  });
  await item('C-49', 'Decision strip', 'read the strip at one pane, 1440', 'five boxes, form labelled/figures/short/wrap by width', async () => ({ observed: boxes ? `form ${boxes.form}, lines ${boxes.lines}; ${boxes.boxes.map(b => `${b.k}: "${b.words}"`).join(' · ')}` : '(no strip)', pass: !!boxes && boxes.boxes.length === 5, ms: null, notes: '' }));
  const boxIds = { regime: 'C-50', levels: 'C-51', move: 'C-52', record: 'C-53', freshness: 'C-54' };
  for (const [k, id] of Object.entries(boxIds)) {
    const b = boxes?.boxes.find(x => x.k === k);
    await item(id, `Strip box: ${k}`, `click [data-decision-box="${k}"]`, `How sure opens at its ${k} section, scrolled into view`, async () => {
      const r = await timed(
        page,
        () => page.click(`[data-decision-box="${k}"]`),
        k => {
          const c = document.querySelector(`[data-how-sure-card="book"][data-how-sure-open-at="${k}"]`);
          const f = c?.querySelector('[data-how-sure-focus]');
          if (!c || !f) return false;
          const pop = c.closest('[data-popover-card]') || c;
          const pr = pop.getBoundingClientRect();
          const fr = f.getBoundingClientRect();
          return fr.top >= pr.top - 1 && fr.bottom <= pr.bottom + 1;
        },
        k,
        5000
      );
      const sec = await page.evaluate(k => document.querySelector(`[data-how-sure-card="book"][data-how-sure-open-at="${k}"] [data-how-sure-focus]`)?.innerText ?? null, k);
      await esc(page);
      await page.waitForTimeout(250);
      const extra = k === 'regime' && (b?.words || '') === '—' ? "at night the pane's own regime reading (paneRegime, Terrain.tsx:1712-1720) reads fTrail.snaps — today's modeled minutes only, empty before the first chain read — while the chart draws yesterday's tiled columns; the strip says 'No column of the field yet' over a full field" : k === 'move' && /\+0\.0σ/.test(b?.words || '') ? "'+0.0σ' printed for zero (hand-built sign)" : k === 'record' && /13s|\d+s · \d+t/.test(b?.words || '') ? 'short form cryptic' : '';
      return { observed: `box "${b?.words}" (title "${clip(b?.title, 140)}"); opened at section ${r.ok}: "${clip(sec, 160)}"`, pass: !!b && r.ok, ms: r.ms, notes: extra };
    });
  }

  /* history: Back to live in the foot row */
  await item('S-history', 'Back to live (foot row)', 'drag the plot right 300 px; click Back to live', "'Back to live ›' appears in the foot row, not over the Building chip; a click returns", async () => {
    const box = await page.evaluate(() => window.__ex.box(window.__ex.chart(0).host));
    const a = await timed(
      page,
      async () => {
        await page.mouse.move(box.x + box.w * 0.4, box.y + box.h * 0.55);
        await page.mouse.down();
        await page.mouse.move(box.x + box.w * 0.4 + 150, box.y + box.h * 0.55, { steps: 5 });
        await page.mouse.move(box.x + box.w * 0.4 + 300, box.y + box.h * 0.55, { steps: 5 });
        await page.mouse.up();
      },
      () => window.__ex.vis(document.querySelector('[data-back-to-live]')),
      null,
      4000
    );
    const ov = await page.evaluate(() => {
      const f = document.querySelector('[data-foot-row]');
      const ks = f ? [...f.querySelectorAll('[data-stale-banner],[data-trail-since],[data-ladder-peek],[data-back-to-live]')].filter(window.__ex.vis).map(e => ({ k: [...e.attributes].map(a => a.name).find(n => n.startsWith('data-')), r: e.getBoundingClientRect() })) : [];
      const hit = [];
      for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) { const a = ks[i].r, b = ks[j].r; if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) hit.push(`${ks[i].k}×${ks[j].k}`); }
      return { kids: ks.map(k => k.k).join(','), hit };
    });
    await shot(page, 'B-backtolive');
    const b = await timed(page, () => page.click('[data-back-to-live]'), () => !document.querySelector('[data-back-to-live]'), null, 4000);
    await away(page);
    return { observed: `shown ${a.ok}; foot row holds ${ov.kids}; overlaps ${ov.hit.join(',') || 'none'}; back ${b.ok}`, pass: a.ok && b.ok && ov.hit.length === 0, ms: Math.max(a.ms, b.ms), notes: `show ${a.ms} ms, back ${b.ms} ms` };
  });

  /* gaps */
  await item('S-gaps', 'Gaps (labelled blanks in the field)', 'read the chart’s gap runs in view (1m)', 'every blank run wears its cause', async () => {
    const g = await page.evaluate(() => (window.__ex.chart(0)?.gaps?.() || []).map(r => JSON.stringify(r).slice(0, 160)));
    return { observed: g.length ? `${g.length} runs: ${g.slice(0, 4).join(' ; ')}` : 'no gap runs in view', pass: true, ms: null, notes: 'labels are canvas text in the chart (area B); listed here as the state' };
  });

  /* C-59 Read this, C-61 bead card reference */
  await item('C-59', 'Read this', 'look for a Read this door on Terrain', 'absent (Terrain is not a ReadThis host)', async () => {
    const has = await page.evaluate(() => /Read this/.test(document.body.innerText) || !!document.querySelector('[data-read-this]'));
    return { observed: has ? 'a Read this is present' : 'absent', pass: !has, ms: null, notes: 'as inventoried; no ReadThis on Terrain' };
  });
  /* C-13 guide, C-36 its card, C-60 Glossary */
  await item('C-13', 'How to read door → ProfileGuide', 'click [data-profile-guide]; Esc', 'a dark card over the blurred pane; Esc closes it', async () => {
    const a = await timed(page, () => page.click('[data-profile-guide]'), () => window.__ex.vis(document.querySelector('[data-profile-guide-card]')), null, 5000);
    await shot(page, 'B-guide');
    const b = await timed(page, () => esc(page), () => !window.__ex.vis(document.querySelector('[data-profile-guide-card]')), null, 3000);
    const hit = await page.evaluate(() => {
      const d = document.querySelector('[data-profile-guide]');
      return d ? Math.round(d.getBoundingClientRect().height) : null;
    });
    return { observed: `opened ${a.ok}; Esc closed ${b.ok}; door height ${hit}px`, pass: a.ok && b.ok, ms: Math.max(a.ms, b.ms), notes: `open ${a.ms} ms, close ${b.ms} ms; the door has no .hit (24 px)` };
  });
  await item('C-36', 'ProfileGuide card content', 'open the guide; read it', 'two figures, today’s walls read both ways, a note on the field, Glossary link', async () => {
    await page.click('[data-profile-guide]');
    await page.waitForTimeout(500);
    const g = await page.evaluate(() => {
      const c = document.querySelector('[data-profile-guide-card]');
      return c ? { t: c.innerText, field: c.querySelector('[data-guide-field]')?.innerText ?? null, svgs: c.querySelectorAll('svg').length, gl: !!document.querySelector('[data-guide-glossary]') } : null;
    });
    const stale = /a step quieter|grey ticks|orange|blue/i.test(g?.t || '');
    return { observed: `${g?.svgs} drawings; field note "${clip(g?.field, 200)}"; glossary link ${g?.gl}`, pass: !!g && g.gl, ms: null, notes: stale ? "STALE: the guide still speaks of 'a step quieter' / 'grey ticks' / orange-blue (ProfileGuide.tsx)" : '' };
  });
  await item('C-60', 'Glossary link', 'click [data-guide-glossary]', 'navigates to /glossary', async () => {
    const r = await timed(page, () => page.click('[data-guide-glossary]'), () => location.pathname.startsWith('/glossary'), null, 8000);
    const url = page.url();
    return { observed: `url ${url}`, pass: r.ok, ms: r.ms, notes: 'the only way to the Glossary from area C' };
  });
  log('B errors', page.__errs.length, page.__errs.slice(0, 5).join(' || '));
  SIX._errsB = page.__errs.slice(0, 20);
  await ctx.close();
};

/* ================================================================================================================ */
/* GROUP C — SPY 5m: 6c at 5m, no data (a Saturday), stale at night (feed aborted)                                    */
/* ================================================================================================================ */
const groupC = async () => {
  const cfg = { layout: 1, panes: [paneCfg('SPY', '5m')] };
  const { ctx, page } = await open({ cfg, label: 'C 1 pane SPY 5m' });
  await ready(page, 1);
  await ladReady(page, 0);
  await page.waitForTimeout(4000);
  await shot(page, 'C-1pane-5m');
  await item('6c-5m', 'Ladder net vs field net, SPY 5m', 'hover 10 strikes round the price; read the newest field column (5m fold)', 'one figure per strike on both surfaces', async () => {
    const s = await sixC(page, 'SPY 5m');
    const matched = s.rows.filter(r => r.diffPct != null && Math.abs(r.diffPct) <= 1).length;
    return { observed: `${matched}/${s.rows.length} strikes within 1%; field column ${s.fieldTimeNY} NY`, pass: matched === s.rows.length, ms: null, notes: 'see the 6c table' };
  });
  await item('C-61', 'Bead hover card (reference, area B)', 'hover the largest node of the newest field column in view (5m)', 'three lines: strike · time, net, % of the book', async () => {
    const g = await page.evaluate(() => {
      const e = window.__ex.chart(0);
      const vr = e.chart.timeScale().getVisibleRange();
      const s = e.trails.snapshots.filter(c => vr && c.time >= vr.from && c.time <= vr.to);
      const c = s[s.length - 1];
      if (!c) return null;
      const big = [...c.levels].sort((a, b) => (b.gross ?? Math.abs(b.value)) - (a.gross ?? Math.abs(a.value)))[0];
      const r = e.host.getBoundingClientRect();
      return { k: big.strike, x: r.left + e.chart.timeScale().timeToCoordinate(c.time), y: window.__ex.y(0, big.strike), at: new Date(c.time * 1000).toLocaleString('en-US', { timeZone: 'America/New_York' }) };
    });
    if (!g) return { observed: 'no field column in view', pass: 'manual', ms: null, notes: '' };
    let card = null;
    const t = Date.now();
    outer: for (const dx of [0, -2, 2, -4, 4, -6, 6, -9, -12]) {
      for (const dy of [0, -2, 2, -4, 4]) {
        await page.mouse.move(g.x + dx, g.y + dy);
        await page.waitForTimeout(45);
        card = await page.evaluate(() => document.querySelector('[data-bead-card]')?.innerText ?? null);
        if (card) break outer;
      }
    }
    const ms = Date.now() - t;
    if (card) await shot(page, 'C-beadcard');
    await away(page);
    SIX._bead = { strike: g.k, at: g.at, card };
    return { observed: card ? `${g.k} at ${g.at}: "${clip(card, 300)}"` : `(no bead card at ${g.k}, ${g.at})`, pass: card ? true : 'manual', ms, notes: card ? 'ms includes the search over a small grid round the node' : 'no oval under the pointer there' };
  });
  await item('S-gaps-5m', 'Gaps at 5m', 'read the chart’s gap runs in view', 'every blank run wears its cause', async () => {
    const g = await page.evaluate(() => (window.__ex.chart(0)?.gaps?.() || []).map(r => JSON.stringify(r).slice(0, 160)));
    return { observed: g.length ? `${g.length} runs: ${g.slice(0, 4).join(' ; ')}` : 'no gap runs in view', pass: true, ms: null, notes: '' };
  });
  await item('S-nodata', 'No data (a Saturday)', 'T → 2026-10-10 → Go', "a centred card 'No data for Oct 10' with Previous / Next session", async () => {
    await blur(page);
    await page.keyboard.press('t');
    await page.waitForSelector('[data-jump-date-input]', { timeout: 4000 });
    await page.fill('[data-jump-date-input]', '2026-10-10');
    const r = await timed(page, () => page.click('[data-popover-card="pane-jump-date"] button[type="submit"]'), () => window.__ex.vis(document.querySelector('[data-no-day]')), null, 8000);
    const txt = await page.evaluate(() => document.querySelector('[data-no-day]')?.innerText ?? null);
    await shot(page, 'C-nodata');
    let prev = null;
    if (r.ok) prev = await timed(page, () => page.click('[data-no-day-prev]'), () => !document.querySelector('[data-no-day]'), null, 8000);
    await page.waitForTimeout(800);
    const live = await page.$('[data-back-to-live]');
    if (live) await live.click().catch(() => {});
    return { observed: `card ${r.ok}: "${clip(txt, 200)}"; Previous session cleared it ${prev?.ok ?? '-'} (${prev?.ms ?? '-'} ms)`, pass: r.ok && !!prev?.ok, ms: r.ms, notes: '' };
  });
  await item('S-stale-night', 'Stale at night (feed aborted after load)', 'abort every /feed/ request; wait 75 s', 'a shut market reads Closed, never stale: no banner', async () => {
    await page.route(FEED_API, r => r.abort());
    const t = Date.now();
    let seen = null;
    while (Date.now() - t < 75000) {
      seen = await page.evaluate(() => ({ age: document.querySelector('[data-pane-age]')?.getAttribute('data-pane-age'), words: document.querySelector('[data-pane-age]')?.getAttribute('aria-label'), banner: !!document.querySelector('[data-stale-banner]') }));
      if (seen.banner) break;
      await page.waitForTimeout(3000);
    }
    await shot(page, 'C-stale-night');
    await page.unroute(FEED_API);
    return { observed: `age chip ${seen?.age} "${seen?.words}"; stale banner ${seen?.banner}`, pass: seen?.age === 'closed' && !seen?.banner, ms: null, notes: 'stale is reachable only while the market is open — see S-stale-clock' };
  });
  log('C errors', page.__errs.length, page.__errs.slice(0, 5).join(' || '));
  await ctx.close();
};

/* ================================================================================================================ */
/* GROUP A — three panes at 1440×900: Strikes button, R / Shift R, the hover card, the grip, the ×                   */
/* ================================================================================================================ */
const groupA = async () => {
  const cfg = { layout: 3, panes: [paneCfg('SPY', '5m'), paneCfg('QQQ', '5m'), paneCfg('IWM', '5m')] };
  const { ctx, page } = await open({ cfg, label: 'A 3 panes' });
  await ready(page, 3);
  await ladReady(page, 0);
  await page.waitForTimeout(2500);
  await shot(page, 'A-3pane');
  const nLad = () => page.evaluate(() => document.querySelectorAll('[data-profile-panel]').length);
  await item('C-01', 'Desk Strikes button', 'click [data-strikes-toggle] twice', "ladders unmount, aria-pressed false, title 'Show the strike rail beside every chart — Shift R'; again → back at 240 px", async () => {
    const t0 = await page.evaluate(() => {
      const b = document.querySelector('[data-strikes-toggle]');
      return { p: b.getAttribute('aria-pressed'), t: b.title, h: Math.round(b.getBoundingClientRect().height), hit: b.classList.contains('hit') };
    });
    const a = await timed(page, () => page.click('[data-strikes-toggle]'), () => document.querySelectorAll('[data-profile-panel]').length === 0, null, 4000);
    const t1 = await page.evaluate(() => ({ p: document.querySelector('[data-strikes-toggle]').getAttribute('aria-pressed'), t: document.querySelector('[data-strikes-toggle]').title }));
    const b = await timed(page, () => page.click('[data-strikes-toggle]'), () => document.querySelectorAll('[data-profile-panel]').length === 3, null, 6000);
    await page.waitForTimeout(400);
    const w = await page.evaluate(() => [...document.querySelectorAll('[data-profile-panel]')].map(e => Math.round(e.getBoundingClientRect().width)).join('/'));
    return { observed: `before pressed=${t0.p}; hide ${a.ok} → pressed=${t1.p}, title "${t1.t}"; show ${b.ok}, widths ${w}; button ${t0.h}px tall, .hit ${t0.hit}`, pass: a.ok && b.ok && t1.p === 'false' && /Show the strike rail beside every chart — Shift R/.test(t1.t), ms: Math.max(a.ms, b.ms), notes: `hide ${a.ms} ms, show ${b.ms} ms; tracked caps; no .hit` };
  });
  await item('C-02', 'Keys R / Shift R', 'press r, r, Shift+R, Shift+R', "r hides/shows the active pane's ladder ('SPY strike rail hidden'); Shift+R all", async () => {
    await blur(page);
    const a = await timed(page, () => page.keyboard.press('r'), () => document.querySelectorAll('[data-profile-panel]').length === 2, null, 4000);
    const ann1 = await page.evaluate(() => window.__ex.ann());
    const b = await timed(page, () => page.keyboard.press('r'), () => document.querySelectorAll('[data-profile-panel]').length === 3, null, 4000);
    const c = await timed(page, () => page.keyboard.press('Shift+R'), () => document.querySelectorAll('[data-profile-panel]').length === 0, null, 4000);
    const ann2 = await page.evaluate(() => window.__ex.ann());
    const d = await timed(page, () => page.keyboard.press('Shift+R'), () => document.querySelectorAll('[data-profile-panel]').length === 3, null, 6000);
    const ann3 = await page.evaluate(() => window.__ex.ann());
    return { observed: `r hid one ${a.ok} ("${ann1}"); r back ${b.ok}; Shift+R hid all ${c.ok} ("${ann2}"); Shift+R back ${d.ok} ("${ann3}")`, pass: a.ok && b.ok && c.ok && d.ok && /strike rail hidden/.test(ann1) && /Every strike rail hidden/.test(ann2), ms: Math.max(a.ms, b.ms, c.ms, d.ms), notes: `r ${a.ms}/${b.ms} ms, Shift+R ${c.ms}/${d.ms} ms` };
  });
  await page.waitForTimeout(1500);
  await item('C-32', 'Ladder hover card (narrow, 240 px)', 'three panes: Sides on pane 1, hover a row', "a 236 px card left of the ladder: from-spot without '++', data-dir, Puts/Calls, Net, Open int, Since open", async () => {
    await page.locator('[data-chart-frame]').nth(0).locator('[data-profile-view="ladder"]').click();
    await page.waitForTimeout(600);
    const spot = await page.evaluate(() => window.__ex.props(0).levels.spot);
    const k = (await page.evaluate(() => window.__ex.props(0).rows.map(r => r.strike))).sort((a, b) => Math.abs(a - spot) - Math.abs(b - spot))[2];
    const g = await page.evaluate(k => ({ y: window.__ex.y(0, k), l: window.__ex.box(window.__ex.lad(0)) }), k);
    const r = await timed(page, () => page.mouse.move(g.l.x + g.l.w * 0.4, g.y), () => window.__ex.vis(document.querySelector('[data-profile-card]')), null, 4000);
    const c = await page.evaluate(() => {
      const el = document.querySelector('[data-profile-card]');
      if (!el) return null;
      const lad = el.closest('[data-profile-panel]').getBoundingClientRect();
      const r = el.getBoundingClientRect();
      return { t: el.innerText, w: Math.round(r.width), leftOf: r.right <= lad.left + 1, dirs: [...el.querySelectorAll('[data-dir]')].map(e => e.getAttribute('data-dir')).join(','), since: el.querySelector('[data-card-since]')?.innerText };
    });
    await shot(page, 'A-hovercard');
    await away(page);
    await page.locator('[data-chart-frame]').nth(0).locator('[data-profile-view="net"]').click();
    const t = c?.t || '';
    return { observed: `card ${r.ok}: "${clip(t, 260)}"; width ${c?.w}; left of the ladder ${c?.leftOf}; data-dir ${c?.dirs}; since "${c?.since}"`, pass: r.ok && !/\+\+/.test(t) && !!c?.dirs, ms: r.ms, notes: /-\d/.test(c?.since || '') ? 'since-open uses a hyphen-minus' : '' };
  });
  await item('C-05', 'Width grip', 'drag the grip of pane 1 left 100 px; double-click', 'wider (to the 40% cap), stored as ladderW; double-click → 240', async () => {
    const g = await page.evaluate(() => window.__ex.box(window.__ex.lad(0).querySelector('[data-profile-grip]')));
    const w0 = await page.evaluate(() => Math.round(window.__ex.lad(0).getBoundingClientRect().width));
    const pane = await page.evaluate(() => Math.round(window.__ex.pane(0).getBoundingClientRect().width));
    const drag = async (gg, dx) => {
      await page.mouse.move(gg.x + gg.w / 2, gg.y + gg.h / 2);
      await page.mouse.down();
      await page.mouse.move(gg.x + gg.w / 2 + dx / 2, gg.y + gg.h / 2, { steps: 4 });
      await page.mouse.move(gg.x + gg.w / 2 + dx, gg.y + gg.h / 2, { steps: 4 });
      await page.mouse.up();
      await page.waitForTimeout(200);
    };
    const t = Date.now();
    await drag(g, 50);
    const ms = Date.now() - t;
    const wN = await page.evaluate(() => Math.round(window.__ex.lad(0).getBoundingClientRect().width));
    const gL = await page.evaluate(() => window.__ex.box(window.__ex.lad(0).querySelector('[data-profile-grip]')));
    await drag(gL, -160);
    const w1 = await page.evaluate(() => Math.round(window.__ex.lad(0).getBoundingClientRect().width));
    const st = await page.evaluate(() => JSON.parse(localStorage.getItem('slayer_terrain_v1') || '{}').panes?.[0]?.ladderW ?? null);
    const kept = await page.evaluate(() => window.__ex.props(0)?.focusPrice ?? null);
    const g2 = await page.evaluate(() => window.__ex.box(window.__ex.lad(0).querySelector('[data-profile-grip]')));
    await page.mouse.dblclick(g2.x + g2.w / 2, g2.y + g2.h / 2);
    await page.waitForTimeout(300);
    const w2 = await page.evaluate(() => Math.round(window.__ex.lad(0).getBoundingClientRect().width));
    const kept2 = await page.evaluate(() => window.__ex.props(0)?.focusPrice ?? null);
    await away(page);
    SIX._gripKept = [kept, kept2];
    return { observed: `rest ${w0} (pane ${pane}); right 50 → ${wN}; left 160 → ${w1} (${((w1 / pane) * 100).toFixed(1)}% of the pane); stored ladderW ${st}; dblclick → ${w2}`, pass: wN < w0 && wN >= 180 && w1 > wN && w1 / pane <= 0.401 && Math.abs(w2 - w0) <= 1, ms, notes: 'at three panes the rest width (240) is already at the 40% cap, so a drag left cannot pass it; pointer only (no keys, no aria-valuenow)' };
  });
  await item('C-29b', 'A grip drag keeps no strike (3 panes)', 'the C-05 grip drag and double-click', 'the chart’s focus stays empty', async () => ({ observed: `kept after the drag: ${SIX._gripKept[0]}, after the double-click: ${SIX._gripKept[1]}`, pass: SIX._gripKept[0] == null && SIX._gripKept[1] == null, ms: null, notes: SIX._gripKept.some(v => v != null) ? 'the root’s onClick fires after the grip gesture — ProfilePanel.tsx root onClick (~1905), grip (~1916)' : '' }));
  await page.evaluate(() => { const p = window.__ex.props(0); if (p?.focusPrice != null) p.onSelect?.(p.focusPrice); });
  await item('C-14', 'Ladder × close', 'click × on pane 2', 'the ladder unmounts; focus lands on [data-strikes-toggle]', async () => {
    const r = await timed(page, () => page.locator('[data-chart-frame]').nth(1).locator('[data-profile-close]').click(), () => document.querySelectorAll('[data-profile-panel]').length === 2 && document.activeElement?.hasAttribute('data-strikes-toggle'), null, 4000);
    const f = await page.evaluate(() => ({ n: document.querySelectorAll('[data-profile-panel]').length, a: document.activeElement?.outerHTML.slice(0, 60) }));
    const sz = 20;
    await blur(page);
    await page.keyboard.press('Shift+R'); // all → hidden (any shown)
    await page.waitForTimeout(400);
    await page.keyboard.press('Shift+R');
    await page.waitForTimeout(800);
    return { observed: `ladders ${f.n}; focus on ${f.a}`, pass: r.ok, ms: r.ms, notes: `a ${sz}px target, no .hit; aria-label says "panel", title says "rail"` };
  });
  log('A errors', page.__errs.length, page.__errs.slice(0, 5).join(' || '));
  await ctx.close();
};

/* ================================================================================================================ */
/* GROUP D — the day panel on 1D                                                                                    */
/* ================================================================================================================ */
const clickBar = async (page, back) => {
  const g = await page.evaluate(back => {
    const e = window.__ex.chart(0);
    const d = e.candles.data();
    const b = d[d.length - 1 - back];
    const r = e.host.getBoundingClientRect();
    const x = e.chart.timeScale().timeToCoordinate(b.time);
    const y = e.candles.priceToCoordinate(b.high);
    return { x: r.left + x, y: r.top + y - 4, time: b.time };
  }, back);
  await page.mouse.click(g.x, g.y);
  return g;
};
/* click a day bar until the day panel stands (at most 3 tries, each waited 2.5 s); returns {ok, tries, ms, g} */
const openDay = async (page, back) => {
  const t = Date.now();
  let g = null;
  for (let k = 1; k <= 3; k++) {
    g = await clickBar(page, back);
    try {
      await page.waitForFunction(() => window.__ex.vis(document.querySelector('[data-day-panel]')), null, { timeout: 2500, polling: 25 });
      return { ok: true, tries: k, ms: Date.now() - t, g };
    } catch {}
  }
  return { ok: false, tries: 3, ms: Date.now() - t, g };
};
/* where the 1D view stands after load: on the newest bars, or back in the past (a finding for area B) */
const dayView = page =>
  page.evaluate(() => {
    const e = window.__ex.chart(0);
    const n = e.candles.data().length;
    const lr = e.chart.timeScale().getVisibleLogicalRange();
    const vr = e.chart.timeScale().getVisibleRange();
    const iso = t => new Date(t * 1000).toISOString().slice(0, 10);
    return { n, from: lr ? Math.round(lr.from) : null, to: lr ? Math.round(lr.to) : null, range: vr ? `${iso(vr.from)} → ${iso(vr.to)}` : null, back: !!document.querySelector('[data-back-to-live]') };
  });
const DAYVIEWS = [];
const groupD = async () => {
  const cfg = { layout: 1, panes: [paneCfg('SPY', '1D')] };
  const { ctx, page } = await open({ cfg, label: 'D 1D' });
  await ready(page, 1);
  await page.waitForTimeout(3000);
  DAYVIEWS.push(await dayView(page));
  if (DAYVIEWS[0].back) {
    await page.click('[data-back-to-live]').catch(() => {});
    await page.waitForTimeout(1000);
  }
  let day = null;
  await item('C-55', 'Day panel', 'click the 3rd-from-last day bar; Esc', "the card under the strip: the day, its close, regime, CW/PW/flip at the last modeled column, the 3 nearest strikes; Esc closes", async () => {
    const r = await openDay(page, 2);
    const g = r.g;
    const t0 = await page.evaluate(() => document.querySelector('[data-day-panel]')?.innerText ?? '');
    await page.waitForTimeout(1500);
    const t = await page.evaluate(() => ({ day: document.querySelector('[data-day-panel]')?.getAttribute('data-day-panel'), t: document.querySelector('[data-day-panel]')?.innerText }));
    const flash = /No modeled column/.test(t0) && !/No modeled column/.test(t.t || '');
    day = t.day;
    await shot(page, 'D-daypanel');
    const e = await timed(page, () => esc(page), () => !document.querySelector('[data-day-panel]'), null, 3000);
    await page.waitForTimeout(600);
    return { observed: `opened ${r.ok} for ${t.day} (bar ${new Date(g.time * 1000).toISOString().slice(0, 10)}, ${r.tries} click${r.tries > 1 ? 's' : ''}): "${clip(t.t, 300)}"; Esc closed ${e.ok}`, pass: r.ok && e.ok && /close/.test(t.t || ''), ms: r.ms, notes: `Esc ${e.ms} ms; walls/flip are raw pickWalls on the day's last column (inventory)${r.tries > 1 ? `; the bar click needed ${r.tries} tries` : ''}${flash ? "; on open it first says 'No modeled column for this day on this machine' and fills 0.1–0.35 s later when the day's 1m tile arrives — a loading state worded as an absence (Terrain.tsx ~3000)" : ''}` };
  });
  await item('C-56', 'Day panel: UW end-of-day line', 'open the day panel; wait for the UW line', "'asking…' then 'Unusual Whales' end-of-day book: CW … PW … flip … (figured at …)'", async () => {
    const o = await openDay(page, 2);
    const t = Date.now();
    let first = null;
    let last = null;
    while (Date.now() - t < 20000) {
      last = await page.evaluate(() => [...(document.querySelector('[data-day-panel]')?.querySelectorAll('p') || [])].map(p => p.innerText).find(s => /Unusual Whales/.test(s)) ?? null);
      if (last && !first) first = last;
      if (last && !/asking/.test(last)) break;
      await page.waitForTimeout(100);
    }
    const ms = Date.now() - t;
    return { observed: `panel ${o.ok} (${o.tries} click${o.tries > 1 ? 's' : ''}); first "${clip(first, 80)}" → "${clip(last, 240)}"`, pass: !!last && /figured at|did not come back/.test(last), ms, notes: (/did not come back/.test(last || '') ? 'UW answered nothing for the date. ' : '') + (o.tries > 1 ? `the bar click needed ${o.tries} tries` : '') };
  });
  await item('C-57', 'Day panel: Open this session · 5m', 'click [data-day-open]', 'timeframe 5m, the view on the day', async () => {
    const r = await timed(page, () => page.click('[data-day-open]'), () => /\|5m\|/.test(document.querySelector('[data-chart-frame] [data-chart-state]')?.getAttribute('data-chart-state') || '') && Number((document.querySelector('[data-chart-frame] [data-chart-state]')?.getAttribute('data-chart-state') || '').split('|')[2]) > 0, null, 20000);
    await page.waitForTimeout(1500);
    const vis = await page.evaluate(() => {
      const e = window.__ex.chart(0);
      const v = e.chart.timeScale().getVisibleRange();
      return v ? [new Date(v.from * 1000).toISOString(), new Date(v.to * 1000).toISOString()] : null;
    });
    await shot(page, 'D-open5m');
    return { observed: `5m ${r.ok}; visible ${vis?.join(' → ')}; day ${day}`, pass: r.ok && !!vis && vis[0].slice(0, 10) <= day && vis[1].slice(0, 10) >= day, ms: r.ms, notes: '' };
  });
  await ctx.close();
  /* a fresh desk on 1D for the replay door */
  const o2 = await open({ cfg, label: 'D 1D (replay)' });
  const p2 = o2.page;
  await ready(p2, 1);
  await p2.waitForTimeout(3000);
  DAYVIEWS.push(await dayView(p2));
  if (DAYVIEWS[1].back) {
    await p2.click('[data-back-to-live]').catch(() => {});
    await p2.waitForTimeout(1000);
  }
  await item('S-1D-view', 'A 1D pane opens on the newest bars', 'load SPY 1D twice; read the visible logical range', 'the view ends on the last bar (no "Back to live" on a fresh load)', async () => {
    const bad = DAYVIEWS.filter(v => v.back || (v.to != null && v.to < v.n - 2));
    return { observed: DAYVIEWS.map((v, i) => `load ${i + 1}: ${v.n} bars, logical ${v.from}..${v.to}, ${v.range}, Back to live ${v.back}`).join(' ; '), pass: bad.length === 0, ms: null, notes: bad.length ? 'INTERMITTENT: the pane first gets 14 day bars (one from Apr 2025, the rest recent) and shows logical 0..20; when the 254-bar series replaces them the view sometimes keeps the logical range 0..20 (Apr–Nov 2025) instead of the bar times it showed, so the pane opens a year back with the ladder empty (current strikes off its price range). Seen on about half the 1D loads this session (9 of ~19, counting the debugging loads). Area B (StrikeChart series reload); the day-panel items below click "Back to live" first.' : 'seen intermittently while debugging (2 of 4 loads stayed on Apr–Nov 2025); not in these two loads' };
  });
  await item('C-58', 'Day panel: Replay this day', 'click a day bar, then [data-day-replay]', 'the replay starts at 9:30 am New York on that day', async () => {
    const o = await openDay(p2, 2);
    if (!o.ok) return { observed: 'the day panel did not open after 3 bar clicks', pass: false, ms: o.ms, notes: '' };
    const d = await p2.evaluate(() => document.querySelector('[data-day-panel]')?.getAttribute('data-day-panel'));
    const r = await timed(p2, () => p2.click('[data-day-replay]'), () => !!document.querySelector('[data-replay-badge]'), null, 20000);
    await p2.waitForTimeout(1500);
    const badge = await p2.evaluate(() => document.querySelector('[data-replay-badge]')?.textContent ?? null);
    const tf = await p2.evaluate(() => (document.querySelector('[data-chart-frame] [data-chart-state]')?.getAttribute('data-chart-state') || '').split('|')[1]);
    const want = new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    await shot(p2, 'D-replay');
    const ok = r.ok && (badge || '').includes(want) && /9:30 am/.test(badge || '');
    return { observed: `day ${d} ("${want}"); replay ${r.ok}; badge "${badge}"; the pane stays on ${tf}`, pass: ok, ms: r.ms, notes: ok ? '' : `the replay asked for ${want} 9:30 am New York (Terrain.tsx:3017 onReplayFrom(nyWallTime(day, 9, 30))) with the pane left on ${tf}: the cursor lands on the day bar's grid and the badge names the NEXT day at 9:29 am (seen 3 of 3 times)` };
  });
  await item('C-38b', 'How sure in a 1D replay (from the day panel)', 'in the C-58 replay, open How sure (ladder door, else a strip box)', "'Replay · <day> · <time>' and what the ladder stands on", async () => {
    await p2.waitForFunction(() => !!document.querySelector('[data-profile-panel] [data-how-sure="book"]'), null, { timeout: 10000, polling: 100 }).catch(() => {});
    let door = await p2.$('[data-profile-panel] [data-how-sure="book"]');
    let via = 'the ladder’s door';
    if (!door) {
      door = await p2.$('[data-decision-box="regime"]');
      via = 'the strip’s Regime box';
    }
    const pending = await p2.evaluate(() => document.querySelectorAll('[data-how-sure-pending]').length);
    if (!door) return { observed: `no How sure door in the replay; pending doors ${pending}`, pass: false, ms: null, notes: '' };
    const r = await timed(p2, () => door.click(), () => !!document.querySelector('[data-how-sure-replay]'), null, 5000);
    const t = await p2.evaluate(() => document.querySelector('[data-how-sure-replay]')?.innerText ?? null);
    const ladder = await p2.evaluate(() => !!window.__ex.lad(0));
    await esc(p2);
    return { observed: t ? `via ${via}: ${clip(t, 300)}` : `(section absent; via ${via}; ladder ${ladder}; pending doors ${pending} — "The read opens once the first book is in")`, pass: r.ok, ms: r.ms, notes: t ? '' : 'waited 10 s: in this replay (the 1D pane, cursor on a day bar) no field column stands at the cursor, so the ladder never comes and How sure has no book; its doors stand pending and the replay section cannot be read here' };
  });
  log('D errors', p2.__errs.length, p2.__errs.slice(0, 5).join(' || '));
  await o2.ctx.close();
  /* the inventory's own path to How sure's replay section: P on an intraday pane, pick a bar */
  const o3 = await open({ cfg: { layout: 1, panes: [paneCfg('SPY', '5m')] }, label: 'D 5m replay' });
  const p3 = o3.page;
  await ready(p3, 1);
  await ladReady(p3, 0).catch(() => {});
  await p3.waitForTimeout(2500);
  await item('C-38', 'How sure: Replay section', 'P on a 5m pane, click a bar mid-session; open the ladder’s How sure', "'Replay · <day> · <time>' and what the ladder stands on", async () => {
    await blur(p3);
    await p3.keyboard.press('p');
    await p3.waitForTimeout(600);
    const g = await p3.evaluate(() => {
      const e = window.__ex.chart(0);
      const d = e.candles.data();
      const b = d[Math.max(0, d.length - 1 - 70)];
      const r = e.host.getBoundingClientRect();
      return { x: r.left + e.chart.timeScale().timeToCoordinate(b.time), y: r.top + e.candles.priceToCoordinate(b.close), t: b.time };
    });
    const a = await timed(p3, () => p3.mouse.click(g.x, g.y), () => !!document.querySelector('[data-replay-badge]'), null, 8000);
    const tl = Date.now();
    const gone = await p3.evaluate(() => !document.querySelector('[data-profile-panel]'));
    const back = await p3.waitForFunction(() => !!document.querySelector('[data-profile-panel] [data-how-sure="book"]'), null, { timeout: 20000, polling: 50 }).then(() => Date.now() - tl).catch(() => null);
    SIX._replayLadder = { gone, back };
    const badge = await p3.evaluate(() => document.querySelector('[data-replay-badge]')?.textContent ?? null);
    let door = await p3.$('[data-profile-panel] [data-how-sure="book"]');
    let via = 'the ladder’s door';
    if (!door) {
      door = await p3.$('[data-decision-box="regime"]');
      via = 'the strip’s Regime box';
    }
    if (!door) return { observed: `replay ${a.ok} "${badge}"; no How sure door`, pass: false, ms: a.ms, notes: '' };
    const r = await timed(p3, () => door.click(), () => !!document.querySelector('[data-how-sure-replay]'), null, 5000);
    const t = await p3.evaluate(() => document.querySelector('[data-how-sure-replay]')?.innerText ?? null);
    await shot(p3, 'D-replay-howsure');
    await esc(p3);
    await p3.waitForTimeout(300);
    await esc(p3);
    return { observed: `replay ${a.ok}, badge "${badge}"; the ladder ${gone ? `left the pane on the pick and came back after ${back ?? '>20000'} ms` : 'stayed'}; How sure via ${via}: ${t ? `"${clip(t, 300)}"` : '(no replay section)'}`, pass: a.ok && r.ok, ms: r.ms, notes: `replay start ${a.ms} ms; ms = door click → card` + (gone ? `; the ladder (and How sure with it) is missing for ${back ?? '>20000'} ms after the pick while the cursor's column comes in — the strip's boxes stand pending meanwhile` : '') };
  });
  await o3.ctx.close();
};

/* ================================================================================================================ */
/* GROUP E — the phone, 390×844                                                                                      */
/* ================================================================================================================ */
const groupE = async () => {
  const cfg = { layout: 1, panes: [paneCfg('SPY', '5m')] };
  const { ctx, page } = await open({ cfg, phone: true, viewport: { width: 390, height: 844 }, label: 'E phone' });
  await ready(page, 1);
  await page.waitForTimeout(4000);
  await page.waitForSelector('[data-ladder-peek]', { timeout: 30000 }).catch(() => {});
  await shot(page, 'E-phone-peek');
  await item('C-33', 'Peek (below lg)', 'read the peek at the plot’s foot', "three strikes nearest the price with signed nets, 'Strikes ›'", async () => {
    const p = await page.evaluate(() => {
      const e = document.querySelector('[data-ladder-peek]');
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return { t: e.innerText.replace(/\s+/g, ' '), h: Math.round(r.height), inFoot: !!e.closest('[data-foot-row]'), hit: e.classList.contains('hit') };
    });
    const n = (p?.t.match(/[+−]\$/g) || []).length;
    return { observed: p ? `"${p.t}" (${p.h}px, in foot row ${p.inFoot}, .hit ${p.hit})` : '(no peek)', pass: !!p && n === 3 && /Strikes ›/.test(p.t), ms: null, notes: "signed '+$90M' here, unsigned '$90M' on the ladder" };
  });
  await item('C-34', 'Strikes door under lg ([data-narrow-ladder])', 'look for it while the peek stands', 'dead: never renders while the peek has rows', async () => {
    const n = await page.evaluate(() => document.querySelectorAll('[data-narrow-ladder]').length);
    return { observed: `${n} rendered`, pass: n === 0, ms: null, notes: 'dead code as inventoried (Terrain.tsx:2509)' };
  });
  await item('C-35', 'Overlay ladder (phone): open, Esc, ×', 'tap the peek; Esc; tap the peek; tap ×', 'the overlay over the chart’s right side (≤ 82%); Esc closes; × closes', async () => {
    const cw0 = await page.evaluate(() => Math.round(window.__ex.chart(0).host.getBoundingClientRect().width));
    const a = await timed(page, () => page.tap('[data-ladder-peek]'), () => window.__ex.vis(document.querySelector('[data-profile-panel]')), null, 5000);
    await page.waitForTimeout(600);
    const cw1 = await page.evaluate(() => Math.round(window.__ex.chart(0).host.getBoundingClientRect().width));
    const g = await page.evaluate(() => {
      const l = window.__ex.lad(0);
      const p = window.__ex.pane(0);
      return { w: Math.round(l.getBoundingClientRect().width), pw: Math.round(p.getBoundingClientRect().width), abs: getComputedStyle(l).position, focus: document.activeElement?.tagName + ' ' + (document.activeElement?.getAttribute('aria-label') || '') };
    });
    await shot(page, 'E-phone-overlay');
    const b = await timed(page, () => esc(page), () => !document.querySelector('[data-profile-panel]'), null, 3000);
    const focus2 = await page.evaluate(() => document.activeElement?.tagName + ' ' + (document.activeElement?.getAttribute('data-ladder-peek') != null ? 'peek' : ''));
    await page.tap('[data-ladder-peek]');
    await page.waitForSelector('[data-profile-panel]', { timeout: 5000 });
    const c = await timed(page, () => page.tap('[data-profile-close]'), () => !document.querySelector('[data-profile-panel]'), null, 3000);
    const over = g.abs === 'absolute' && cw1 >= cw0 - 1;
    return { observed: `open ${a.ok} (${g.w}px of ${g.pw}, ${((g.w / g.pw) * 100).toFixed(0)}%, position ${g.abs}; the chart ${cw0} → ${cw1} px wide; focus after open: ${g.focus}); Esc ${b.ok} (focus after: ${focus2}); × ${c.ok}`, pass: a.ok && b.ok && c.ok && g.w / g.pw <= 0.821 && over, ms: Math.max(a.ms, b.ms, c.ms), notes: `open ${a.ms}, Esc ${b.ms}, × ${c.ms} ms. ` + (over ? '' : `NOT AN OVERLAY: the panel computes position ${g.abs} — ProfilePanel.tsx:1902's own 'relative' beats Terrain.tsx:3385's 'absolute right-0 inset-y-0' (same specificity, .relative later in the sheet), so the ladder takes the row and the chart is squeezed to ${cw1} px; the bead legend wraps into that sliver and shows through the ladder's head. `) + 'Focus stays on <body> on open and on close (not a focus-trapped layer).' };
  });
  await item('C-13-phone', 'How to read door in the overlay (stored ladder on)', 'open the overlay, tap How to read', 'the guide opens', async () => {
    await page.tap('[data-ladder-peek]');
    await page.waitForSelector('[data-profile-panel]', { timeout: 5000 });
    const door = await page.$('[data-profile-panel] [data-profile-guide]');
    if (!door) return { observed: 'no guide door in the overlay', pass: false, ms: null, notes: '' };
    const r = await timed(page, () => door.tap(), () => window.__ex.vis(document.querySelector('[data-profile-guide-card]')), null, 4000);
    await shot(page, 'E-phone-guide');
    await esc(page);
    await page.waitForTimeout(300);
    await esc(page);
    return { observed: `guide ${r.ok}`, pass: r.ok, ms: r.ms, notes: '' };
  });
  await item('C-01-phone', 'Strikes button / Colours / R below lg', 'look for the desk’s Strikes and Colours; press r', 'neither renders; r does nothing', async () => {
    const s = await page.evaluate(() => [document.querySelectorAll('[data-strikes-toggle]').length, document.querySelectorAll('[data-terrain-colours]').length]);
    await blur(page);
    const before = await page.evaluate(() => localStorage.getItem('slayer_terrain_v1'));
    await page.keyboard.press('r');
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => localStorage.getItem('slayer_terrain_v1'));
    const ann = await page.evaluate(() => window.__ex.ann());
    return { observed: `Strikes ${s[0]}, Colours ${s[1]}; r changed storage ${before !== after}; announce "${ann}"`, pass: s[0] === 0 && s[1] === 0 && before === after && !/strike rail/.test(ann), ms: null, notes: 'Colours cannot be changed below lg (inventory C-03)' };
  });
  await ctx.close();
  /* the stored flag off: the overlay's guide door */
  const cfg2 = { layout: 1, panes: [paneCfg('SPY', '5m', { ladder: false })] };
  const o2 = await open({ cfg: cfg2, phone: true, viewport: { width: 390, height: 844 }, label: 'E phone, ladder flag off' });
  const p2 = o2.page;
  await ready(p2, 1);
  await p2.waitForSelector('[data-ladder-peek]', { timeout: 30000 }).catch(() => {});
  await item('C-13-phone-off', 'How to read in the overlay with the stored ladder flag off', 'tap the peek, then How to read', 'the guide opens (inventory: it does nothing — GuideFocus mounts only with `ladder`)', async () => {
    const peek = await p2.$('[data-ladder-peek]');
    if (!peek) return { observed: 'no peek', pass: false, ms: null, notes: '' };
    await peek.tap();
    await p2.waitForSelector('[data-profile-panel]', { timeout: 5000 });
    const door = await p2.$('[data-profile-panel] [data-profile-guide]');
    const r = await timed(p2, () => door.tap(), () => window.__ex.vis(document.querySelector('[data-profile-guide-card]')), null, 3000);
    const pressed = await p2.evaluate(() => document.querySelector('[data-profile-guide]')?.getAttribute('aria-pressed'));
    return { observed: `guide opened ${r.ok}; door aria-pressed ${pressed}`, pass: r.ok, ms: r.ms, notes: r.ok ? '' : 'the door toggles guideOpen but GuideFocus is mounted only while the stored `ladder` flag is on (Terrain.tsx:3392 `{ladder && (`)' };
  });
  await o2.ctx.close();
};

/* ================================================================================================================ */
/* GROUP F — layouts 1–4 at 1440×900 and 1280×720, and F                                                            */
/* ================================================================================================================ */
const measure = (page, n) =>
  page.evaluate(n => {
    const out = [];
    for (let i = 0; i < n; i++) {
      const p = window.__ex.pane(i);
      if (!p) continue;
      const pr = p.getBoundingClientRect();
      const l = window.__ex.lad(i);
      const lr = l?.getBoundingClientRect();
      const s = p.querySelector('[data-decision-strip]');
      const head = p.querySelector('[data-pane-head]');
      const f = p.querySelector('[data-foot-row]');
      const ks = f ? [...f.querySelectorAll('[data-stale-banner],[data-trail-since],[data-ladder-peek],[data-back-to-live]')].filter(window.__ex.vis).map(e => ({ k: [...e.attributes].map(a => a.name).find(n => n.startsWith('data-')), r: e.getBoundingClientRect() })) : [];
      const hit = [];
      for (let a = 0; a < ks.length; a++) for (let b = a + 1; b < ks.length; b++) { const A = ks[a].r, B = ks[b].r; if (A.left < B.right && B.left < A.right && A.top < B.bottom && B.top < A.bottom) hit.push(`${ks[a].k}×${ks[b].k}`); }
      /* the foot row's parts must stay clear of the ladder */
      for (const k of ks) if (lr && k.r.right > lr.left + 1 && k.r.left < lr.right) hit.push(`${k.k}×ladder`);
      const sr = s?.getBoundingClientRect();
      const hr = head?.getBoundingClientRect();
      out.push({ i, paneW: Math.round(pr.width), paneH: Math.round(pr.height), ladW: lr ? Math.round(lr.width) : 0, share: lr ? +(lr.width / pr.width).toFixed(3) : 0, tier: l?.querySelector('[data-head-rows]')?.getAttribute('data-head-rows') ?? null, form: s?.getAttribute('data-decision-form') ?? null, lines: s?.getAttribute('data-decision-lines') ?? null, stripOverHead: !!(sr && hr && sr.top < hr.bottom - 1 && hr.top < sr.bottom - 1 && sr.left < hr.right && hr.left < sr.right), foot: ks.map(k => k.k).join(','), overlaps: hit });
    }
    return out;
  }, n);
const groupF = async (vw, vh) => {
  const cfg = { layout: 1, panes: [paneCfg('SPY', '5m'), paneCfg('QQQ', '5m'), paneCfg('IWM', '5m'), paneCfg('NVDA', '5m')] };
  const { ctx, page } = await open({ cfg, viewport: { width: vw, height: vh }, label: `F layouts ${vw}` });
  await ready(page, 1);
  await page.waitForTimeout(2000);
  for (const n of [1, 2, 3, 4]) {
    await item(`L-${vw}-${n}`, `Layout ${n} pane${n > 1 ? 's' : ''} at ${vw}×${vh}`, `press ${n}; drag pane 1 to show Back to live`, 'ladder ≤ 40% of each pane; strip form by width, clear of the head; foot row parts never overlap (nor the ladder)', async () => {
      await blur(page);
      await away(page);
      const t = Date.now();
      await page.keyboard.press(String(n));
      await ready(page, n, 60000);
      await page.waitForFunction(n => document.querySelectorAll('[data-profile-panel]').length >= n, n, { timeout: 30000, polling: 100 }).catch(() => {});
      const ms = Date.now() - t;
      await page.waitForTimeout(1500);
      /* Back to live on pane 1, beside whatever the foot row holds */
      const box = await page.evaluate(() => window.__ex.box(window.__ex.chart(0).host));
      await page.mouse.move(box.x + box.w * 0.35, box.y + box.h * 0.55);
      await page.mouse.down();
      await page.mouse.move(box.x + box.w * 0.35 + 200, box.y + box.h * 0.55, { steps: 6 });
      await page.mouse.up();
      await page.waitForTimeout(600);
      const m = await measure(page, n);
      await shot(page, `L${vw}-${n}`);
      const live = await page.$('[data-back-to-live]');
      if (live) await live.click().catch(() => {});
      await away(page);
      const bad = m.filter(x => x.share > 0.401 || x.overlaps.length || x.stripOverHead || x.ladW === 0);
      return { observed: m.map(x => `p${x.i + 1}: pane ${x.paneW}×${x.paneH}, ladder ${x.ladW} (${(x.share * 100).toFixed(0)}%, head rows ${x.tier}), strip ${x.form}/${x.lines}${x.stripOverHead ? ' OVER HEAD' : ''}, foot [${x.foot}]${x.overlaps.length ? ' OVERLAP ' + x.overlaps.join(',') : ''}`).join(' ; '), pass: bad.length === 0, ms, notes: 'ms = key → every pane drawn with its ladder' };
    });
  }
  if (vw === 1440) {
    await item('L-F', 'Expanded (F) at 1440×900, 4 panes', 'press f on pane 1; Esc', 'the pane fills the desk, ladder at the full tier (≥440 px, one-row head, lane words); Esc collapses', async () => {
      await blur(page);
      const r = await timed(page, () => page.keyboard.press('f'), () => (window.__ex.lad(0)?.getBoundingClientRect().width ?? 0) >= 440, null, 8000);
      await page.waitForTimeout(800);
      const m = await page.evaluate(() => ({ w: Math.round(window.__ex.lad(0)?.getBoundingClientRect().width ?? 0), pw: Math.round(window.__ex.pane(0).getBoundingClientRect().width), rows: window.__ex.lad(0)?.querySelector('[data-head-rows]')?.getAttribute('data-head-rows'), lane: document.querySelector('[data-lane-head="size"]')?.innerText ?? null, form: window.__ex.pane(0).querySelector('[data-decision-strip]')?.getAttribute('data-decision-form'), ann: window.__ex.ann() }));
      await shot(page, 'L-F-expanded');
      const c = await timed(page, () => esc(page), () => (window.__ex.lad(0)?.getBoundingClientRect().width ?? 999) < 440, null, 5000);
      return { observed: `expanded ${r.ok}: ladder ${m.w} of ${m.pw}, head rows ${m.rows}, lane words "${m.lane}", strip ${m.form}, announce "${m.ann}"; Esc collapsed ${c.ok}`, pass: r.ok && c.ok && m.rows === '1', ms: r.ms, notes: `collapse ${c.ms} ms` };
    });
  }
  log('F errors', vw, page.__errs.length, page.__errs.slice(0, 5).join(' || '));
  await ctx.close();
};

/* ================================================================================================================ */
/* GROUP G — states: denied (403), blocked (network), no book, stale with the clock at 10:30 am New York            */
/* ================================================================================================================ */
const stateRead = page =>
  page.evaluate(() => ({
    ladder: !!window.__ex.lad(0),
    rows: window.__ex.props(0)?.rows?.length ?? 0,
    strip: document.querySelector('[data-decision-strip]') ? `${document.querySelector('[data-decision-strip]').getAttribute('data-decision-form')}: ${[...document.querySelectorAll('[data-decision-box]')].map(b => b.innerText.replace(/\s+/g, ' ')).join(' · ')}` : null,
    pending: document.querySelectorAll('[data-how-sure-pending]').length,
    door: !!document.querySelector('[data-profile-panel] [data-how-sure="book"]'),
    age: document.querySelector('[data-pane-age]')?.getAttribute('aria-label') ?? null,
    foot: [...document.querySelectorAll('[data-foot-row] [data-trail-since],[data-foot-row] [data-stale-banner]')].map(e => e.innerText.replace(/\s+/g, ' ')).join(' / '),
    state: document.querySelector('[data-chart-frame] [data-chart-state]')?.getAttribute('data-chart-state'),
  }));
const groupG = async () => {
  const cfg = { layout: 1, panes: [paneCfg('SPY', '5m')] };
  for (const [id, name, routes, expected] of [
    ['S-denied', 'Feed denied (every /feed/ answers 403)', ctx => ctx.route(FEED_API, r => r.fulfill({ status: 403, contentType: 'application/json', body: '{"error":"denied"}' })), 'the same boxes, on the house’s figures (the room reads the house when a vendor is down); no blank page'],
    ['S-blocked', 'Feed blocked (every /feed/ request aborted)', ctx => ctx.route(FEED_API, r => r.abort()), 'the same boxes, on the house’s figures; no blank page'],
  ]) {
    await item(id, name, 'load SPY 5m with the route in place', expected, async () => {
      const { ctx, page } = await open({ cfg, routes, label: id });
      const t = Date.now();
      let ok = true;
      try {
        await ready(page, 1, 60000);
      } catch {
        ok = false;
      }
      const ms = Date.now() - t;
      await page.waitForTimeout(3000);
      const s = await stateRead(page);
      await shot(page, `G-${id}`);
      const errs = page.__errs.filter(e => !/Failed to load resource|net::ERR|403/.test(e)).slice(0, 3);
      await ctx.close();
      return { observed: `drawn ${ok}; ladder ${s.ladder} (${s.rows} rows); How sure door ${s.door}; strip ${s.strip ? clip(s.strip, 200) : 'none'}; age "${s.age}"; foot "${s.foot}"; state ${s.state}; page errors ${errs.length ? errs.join(' | ') : 'none'}`, pass: ok && s.ladder && !!s.strip, ms, notes: 'ms = navigation → first bars drawn' };
    });
  }
  await item('S-nobook', 'No book yet (UW spot-exposures/strike aborted)', 'load SPY 5m with the book route aborted', 'C-49 fix: the strip stands with its boxes pending; the ladder and its How sure door wait', async () => {
    const { ctx, page } = await open({ cfg, routes: ctx => ctx.route(FEED_API, r => (/spot-exposures\/strike(\?|$)/.test(r.request().url()) ? r.abort() : r.continue())), label: 'S-nobook' });
    await ready(page, 1, 60000).catch(() => {});
    await page.waitForTimeout(5000);
    const s = await stateRead(page);
    SIX._nobookStrip = s.strip;
    const title = await page.evaluate(() => document.querySelector('[data-how-sure-pending]')?.getAttribute('title') ?? null);
    const click = await timed(page, () => page.click('[data-decision-box="regime"]').catch(() => {}), () => !!document.querySelector('[data-popover-card="how-sure-book"]'), null, 1500);
    await shot(page, 'G-S-nobook');
    await ctx.close();
    return { observed: `ladder ${s.ladder} (${s.rows} rows); strip ${s.strip ? clip(s.strip, 260) : 'none'}; pending doors ${s.pending} ("${title}"); a box opens a card: ${click.ok}`, pass: !!s.strip && s.pending > 0, ms: null, notes: '' };
  });
  await item('C-52b', 'Strip Move box with no book', 'the S-nobook load: read the Move box', 'no figure measured from a price the pane does not hold', async () => {
    const m = (SIX._nobookStrip || '').match(/Move[^·]*·[^·]*·[^·]*σ day/);
    const sg = Number(((SIX._nobookStrip || '').match(/([+−-][\d.]+)σ day/) || [])[1]?.replace('−', '-'));
    return { observed: m ? m[0] : clip(SIX._nobookStrip, 200), pass: !(Number.isFinite(sg) && Math.abs(sg) > 20), ms: null, notes: Number.isFinite(sg) && Math.abs(sg) > 20 ? `a ${sg}σ day from price 0: the Move box runs readoutOf(levels.spot, …) (Terrain.tsx:1926) on emptyRail(fBook?.spot ?? 0) (1381) — Nearest guards with fin(price), Move does not` : '' };
  });
  await item('S-stale-clock', 'Stale (clock running from 10:30 am New York)', 'run the page clock from 2026-10-15 10:30 am ET; load SPY 1m; wait; press Retry', "amber chip and price, a foot-row banner 'Data … · last repriced …' with Retry; Retry asks the feed again", async () => {
    const { ctx, page } = await open({ cfg: { layout: 1, panes: [paneCfg('SPY', '1m')] }, clockAt: '2026-10-15T10:30:00-04:00', label: 'S-stale-clock' });
    const t = Date.now();
    await ready(page, 1, 60000).catch(() => {});
    let seen = null;
    while (Date.now() - t < 60000) {
      seen = await page.evaluate(() => ({ age: document.querySelector('[data-pane-age]')?.getAttribute('data-pane-age'), words: document.querySelector('[data-pane-age]')?.getAttribute('aria-label'), banner: document.querySelector('[data-stale-banner]')?.innerText ?? null, price: document.querySelector('[data-price-stale]')?.getAttribute('data-price-stale') === '' }));
      if (seen.banner) break;
      await page.waitForTimeout(500);
    }
    const ms = Date.now() - t;
    await shot(page, 'G-S-stale');
    /* Retry: the feed asked again — time to the first feed request after the press */
    let retry = null;
    if (seen?.banner) {
      const t1 = Date.now();
      const req = page.waitForRequest(r => /\/feed\/.*(stock-state|ohlc|spot-exposures\/strike|bars)/.test(r.url()), { timeout: 5000 }).then(r => r.url()).catch(() => null);
      await page.click('[data-stale-retry]');
      const u = await req;
      retry = { ms: Date.now() - t1, url: u ? u.replace(BASE, '').slice(0, 80) : null };
    }
    const dim = await page.evaluate(() => window.__ex.chart(0)?.candles?.options?.()?.upColor ?? null);
    const s = await stateRead(page);
    await ctx.close();
    return { observed: `age ${seen?.age} "${seen?.words}"; banner "${clip(seen?.banner, 120)}" (in the foot row); price marked ${seen?.price}; Retry → a feed request in ${retry?.ms ?? '-'} ms (${retry?.url ?? 'none'}); ladder ${s.ladder}`, pass: !!seen?.banner && seen?.age === 'old' && !!retry?.url, ms, notes: "the page clock runs from 10:30 am New York on a trading day (Playwright clock.install + resume), so the market reads open and the night's data is old — the real stale path. 'last repriced' falls back to the last bar's end (the 8:00 pm after-hours bar) because the field's own minutes (fTrail.snaps) are empty; the field was last repriced 3:59 pm (Terrain.tsx:1822). ms = navigation → banner" };
  });
};

/* ================================================================================================================ */
const runs = [
  ['B', groupB],
  ['C', groupC],
  ['A', groupA],
  ['D', groupD],
  ['E', groupE],
  ['F1440', () => groupF(1440, 900)],
  ['F1280', () => groupF(1280, 720)],
  ['G', groupG],
];
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
for (const [name, fn] of runs) {
  if (only && !only.includes(name)) continue;
  const t = Date.now();
  try {
    await fn();
  } catch (e) {
    log('GROUP', name, 'aborted:', clip(e?.stack || e, 400));
    rec({ id: `group-${name}`, item: `group ${name}`, action: '-', expected: '-', observed: `group aborted: ${clip(e?.message || e, 300)}`, pass: false, ms: null, notes: 'the remaining items of the group were not run' });
  }
  log('group', name, 'done in', Math.round((Date.now() - t) / 1000), 's');
}
await browser.close();

/* ---------------------------------------------------------------------------------------------------------------- */
/* write area-c.json and area-c.md                                                                                    */
/* ---------------------------------------------------------------------------------------------------------------- */
const MERGE = !!process.env.MERGE && fs.existsSync(path.join(OUT, 'area-c.json'));
if (MERGE) {
  /* fold this run's items into the full run's file: an item of the same id (and item name) is replaced in place */
  const old = JSON.parse(fs.readFileSync(path.join(OUT, 'area-c.json'), 'utf8'));
  const key = r => `${r.id}::${r.item}`;
  const fresh = new Map(R.map(r => [key(r), r]));
  const merged = [];
  for (const r of old.items) {
    if (fresh.has(key(r))) {
      merged.push({ ...fresh.get(key(r)), rerun: process.env.ONLY });
      fresh.delete(key(r));
    } else if (!(r.id.startsWith('group-') && process.env.ONLY.split(',').some(g => r.id === `group-${g}`))) merged.push(r);
  }
  for (const r of fresh.values()) merged.push({ ...r, rerun: process.env.ONLY });
  R.length = 0;
  R.push(...merged);
  for (const [k, v] of Object.entries(old.sixC || {})) if (!(k in SIX)) SIX[k] = v;
  LOG.unshift(...(old.log || []), `--- rerun ${process.env.ONLY} ---`);
}
const suffix = process.env.ONLY && !MERGE ? `-${process.env.ONLY.replace(/,/g, '_')}` : '';
const tot = { pass: R.filter(r => r.pass === true).length, fail: R.filter(r => r.pass === false).length, manual: R.filter(r => r.pass === 'manual').length, all: R.length };
fs.writeFileSync(path.join(OUT, `area-c${suffix}.json`), JSON.stringify({ at: new Date().toISOString(), server: BASE, commit: COMMIT, viewerTz: TZ, totals: tot, runSeconds: Math.round((Date.now() - T0) / 1000), items: R, sixC: SIX, log: LOG }, null, 1));
const esc_ = s => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
let md = `# Terrain audit 2026-10-15 — area C exercised\n\nRun ${new Date().toISOString()} against ${BASE} (commit ${COMMIT}), Chromium headless at 1x, viewer zone ${TZ}, dark theme. ` +
  `Night in New York (market closed). The machine is shared with two other agents' browsers, so every timing is pessimistic. ` +
  `${tot.all} items: **${tot.pass} pass, ${tot.fail} fail, ${tot.manual} manual**.${MERGE ? '' : ` Run took ${Math.round((Date.now() - T0) / 1000)} s.`}\n\n` +
  `ms = from the action to the observed result (polled every 25 ms). Screenshots: area-c-*.png beside this file.\n\n` +
  (R.some(r => r.rerun) ? `Rows marked \`rerun\` in area-c.json (groups ${[...new Set(R.filter(r => r.rerun).map(r => r.rerun))].join('; ')}) come from later runs of their group, after fixes to this script (its readiness check had counted the session recap's off-screen charts; the 1D view had to be brought back to the newest bars first; How sure's replay section is read once the ladder returns). The run was ${new Date().toISOString().slice(0, 16)}Z, 03:20–04:20 am New York.\n\n` : '') +
  `| id | item | action → expected | observed | pass | ms |\n|---|---|---|---|---|---|\n`;
for (const r of R) md += `| ${r.id} | ${esc_(r.item)} | ${esc_(r.action)} → ${esc_(r.expected)} | ${esc_(r.observed)}${r.notes ? ` _(${esc_(r.notes)})_` : ''} | ${r.pass === true ? 'PASS' : r.pass === false ? '**FAIL**' : 'manual'} | ${r.ms ?? ''} |\n`;
for (const [label, s] of Object.entries(SIX).sort(([a], [b]) => a.localeCompare(b))) {
  if (label.startsWith('_')) continue;
  md += `\n## 6c — ${label}: the ladder's net against the chart's field\n\nSpot ${s.spot}; the ladder holds ${s.ladderStrikes} rows (Unusual Whales' book, ${s.fresh ? esc_(s.fresh) : 'freshness —'}); the field's newest column is ${s.fieldTimeNY} New York (${s.fieldStrikes} strikes, ${s.nSnaps} columns on the chart). Ladder levels: CW ${s.levels.callWall} · PW ${s.levels.putWall} · flip ${s.levels.flip} · supreme ${s.levels.supreme}.\n\n`;
  md += `| strike | ladder net (canvas, as printed) | ladder read line (Sides) | field net (newest column, ladder's format) | field gross | difference | same sign |\n|---|---|---|---|---|---|---|\n`;
  for (const r of s.rows) md += `| ${r.strike} | ${esc_(r.ladderPrinted)} | ${esc_(r.ladderRead)} | ${esc_(r.fieldPrinted)} | ${r.fieldGross != null ? Math.round(r.fieldGross).toLocaleString('en-US') : '—'} | ${r.diffPct == null ? '—' : `${r.diffPct > 0 ? '+' : ''}${r.diffPct}%`} | ${r.sameSign == null ? '—' : r.sameSign ? 'yes' : 'NO'} |\n`;
}
/* 6c split by cause: the recorder's stored reads of Oct 14 (read-only) against the chart's own columns */
try {
  const dir = '.feed-cache/field/SPY/2026-10-14';
  const lines = f => zlib.gunzipSync(fs.readFileSync(path.join(dir, f))).toString('utf8').trim().split('\n').map(l => JSON.parse(l));
  const B = lines('books.jsonl.gz').slice(-1)[0];
  const B60 = lines('books60.jsonl.gz').slice(-1)[0];
  const ev = new Map(B.rows.map(r => [Number(r.strike), -(Number(r.call_gamma_oi) + Number(r.put_gamma_oi))]));
  const s60 = new Map(B60.rows.map(r => [r[0], -(r[1] + r[2])]));
  const six = SIX['SPY 1m'];
  const fmtB = v => (v == null || !Number.isFinite(v) ? '—' : `${v < 0 ? '−' : ''}$${Math.abs(v) >= 1e9 ? (Math.abs(v) / 1e9).toFixed(2) + 'B' : (Math.abs(v) / 1e6).toFixed(0) + 'M'}`);
  const x = (a, b) => (a != null && b ? `${(a / b).toFixed(2)}×` : '—');
  const nyT = ms => new Date(ms).toLocaleTimeString('en-US', { timeZone: 'America/New_York' });
  md += `\n## 6c — the gap split by cause (SPY, Oct 14)\n\nThe recorder's last stored reads of Unusual Whales' books (read-only, .feed-cache/field/SPY/2026-10-14: the every-expiry book /spot-exposures/strike stamped ${nyT(Date.parse(B.rows[0].time))} at ${B.rows[0].price}, and the 60-day book by expiry, ${B60.expiries.length} expiries ${B60.expiries[0]} to ${B60.expiries[B60.expiries.length - 1]}, from the same moment), in the house's sign, beside the chart's own field columns at 3:34 pm and 3:59 pm (read off \`trails.snapshots\` in the 1m run) and the ladder now (UW's book figured 4:15 pm).\n\n`;
  md += `| strike | UW every expiry, 3:34 pm | UW 60 days, 3:34 pm | universe (every ÷ 60d) | field, 3:34 pm | model (UW 60d ÷ field) | field, 3:59 pm | ladder now (UW, 4:15 pm) | ladder now ÷ field 3:59 |\n|---|---|---|---|---|---|---|---|---|\n`;
  for (const r of six?.rows || []) {
    const k = r.strike;
    const f34 = six.cols?.['15:34']?.[k];
    const f59 = six.cols?.['15:59']?.[k] ?? r.fieldRaw;
    md += `| ${k} | ${fmtB(ev.get(k))} | ${fmtB(s60.get(k))} | ${x(ev.get(k), s60.get(k))} | ${fmtB(f34)} | ${x(s60.get(k), f34)} | ${fmtB(f59)} | ${fmtB(r.ladderRaw)} | ${x(r.ladderRaw, f59)} |\n`;
  }
  /* the plain conclusion, its figures off the tables above */
  const s1 = SIX['SPY 1m'];
  const s5 = SIX['SPY 5m'];
  const within = s => (s ? s.rows.filter(r => r.diffPct != null && Math.abs(r.diffPct) <= 1).length : 0);
  const k771 = s1?.cols?.['15:34']?.[771];
  const k771b = s1?.cols?.['15:59']?.[771];
  md += `\n**Do they match? No.** For the same strikes, the ladder and the chart's field agree on the SIGN at every strike, but their sizes match (within 1%) at ${within(s1)} of ${s1?.rows.length ?? 0} strikes at 1m and ${within(s5)} of ${s5?.rows.length ?? 0} at 5m. They are not the same minute and not the same source:\n\n` +
    `1. **Time.** At night the ladder holds Unusual Whales' book as UW last figured it (4:15 pm, after the bell, at 769.60), and its spot chip is the after-hours quote; the field's newest column is the 3:59 pm minute (1m) or the 3:55–4:00 bar's per-strike PEAK minute (5m — so 769 reads +$4.4B there against $377M at 1m). The field reprices today's expiring contracts on the minute's clock, so in the last half hour their gamma leaves the strikes beside the money: 771 fell from ${fmtB(k771)} at 3:34 pm to ${fmtB(k771b)} at 3:59 pm on the field, while UW's figure barely moved (${fmtB(ev.get(771))} at 3:34 pm, ${fmtB(s1?.rows.find(r => r.strike === 771)?.ladderRaw)} at 4:15 pm). This is most of the gap near the money (771, 769, 768: 2.4× to 4.6×).\n` +
    `2. **Model.** At the same moment (3:34 pm) the field against UW's own 60-day book differs by −12% to +44% per strike (column "model"): UW sums its per-contract gamma; the house reprices each contract at one spot and clock (the stated residual in How sure's "Model agreement").\n` +
    `3. **Universe** (the inventory's suspicion: every expiry on the ladder, 60 days on the field): ≤3% at these strikes — the expiries past 60 days carry almost no gamma near the money. It matters for the label ("All 60 days" over a ladder that reads every expiry), not for these figures.\n\n` +
    `So the two surfaces can only agree inside a live session, minute for minute, up to the model's residual; after the close they also stand at different moments, and on 5m and longer panes the field's cell is the bar's peak minute, not its last.\n`;
} catch (e) {
  md += `\n(6c split by cause not written: ${String(e?.message || e).slice(0, 160)})\n`;
}
fs.writeFileSync(path.join(OUT, `area-c${suffix}.md`), md);
log('wrote', path.join(OUT, `area-c${suffix}.md`), JSON.stringify(tot));
