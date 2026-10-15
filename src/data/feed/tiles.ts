/*
==================================================
  SLAYER TERMINAL - A SESSION FOLDED TO EVERY TIMEFRAME, ONCE (src/data/feed/tiles.ts)

  2026-10-15 — the owner's Section I: "Precompute every timeframe (1m, 5m, 15m, 1h, 1D) at rebuild time, so a
  zoomed-out view never aggregates minute rows on the fly … Load by visible range plus a buffer; never load a whole
  history into the page."

  A past session's TILES: the field the same model draws (trailModel universeOf and modelColumn on the session's
  inputs, every regular minute), seen through each expiry window (windowView), folded to each timeframe by the page's
  own fold (timeframe.ts aggregateSnapshots — a bar's cell is its peak minute) and the bars beside it
  (aggregateCandles; the day's bar closes at the official close where it is known). Each folded column carries what
  the renderer would otherwise read off the per-minute store (GexSnapshot `pre`): the session's bead references as of
  the column's last minute — the net's p85 and p95, the size reference (the session's largest node so far, the gross's
  and the delta's), the delta's p85 and p95, the minutes counted —
  and the walls the one stick (trailModel WallStick) held then, with their states. And each window's per-minute peaks
  (`maxima`), so the prior and fixed bases pool them as they pool the store's.

  Pure: no file, no fetch, no DOM. server/fieldTiles.ts builds and serves them; the page decodes them
  (decodeTile) into the GexSnapshot and Candle shapes the chart already takes.

  A cell is eleven numbers: strike, net, gross, delta, provenance (1 modeled, 2 carried, 0 none), stale share and
  coverage in thousandths, the peak minute, the vols' newest and oldest trade and the oldest's bound (1 when the
  trade time is a batch time) — the times as whole seconds from the column's own time (null none), so they stay short.
  Money to four significant figures: a hundredth of a percent of a strike's gamma at most, under a pixel on any mark
  the renderer draws and below the card's three figures. The bars are kept once a timeframe, not once a window.
==================================================
*/
import type { Candle, GexLevel, GexSnapshot, TileColumnPre } from '../../types/market';
import { aggregateCandles, aggregateSnapshots } from '../timeframe';
import { RunningScale, columnGross, columnMax } from './beadScale';
import { modelColumn, netOf, pastInputs, universeOf, wallObsOf, WallStick, windowView, TRAIL_MODEL, type ExpiryWindow, type PastInputsLike } from './trailModel';
import { nyWallTime } from '../../core/nyTime';
import { fieldSpansOf } from '../../core/sessions';

/** 2 (2026-10-15, the orbs' second round): the size reference is the session's largest node so far, not a p85.
    3 (the same day, the SPX overnight field): a cell carries the missed chain read (12th) and the wide-quote share (13th),
    and an SPX session its three sessions (overnight, regular to 4:15 pm, the curb).
    4 (the same day, the Terrain audit's B-38): the bars carry each minute's volume — the sessions kept before it carried
    none, so the volume pane of every tiled session stood empty.
    5 (the same day): built again — a session's bars read by two readers at once handed the tiles the kept bars before
    their volume came (server/fieldBackfill.ts `bars`, one ask a session now) */
export const TILES_FORMAT = 5;
export const TILE_TFS = [1, 5, 15, 30, 60, 1440] as const;
export type TileTf = (typeof TILE_TFS)[number];
export const TILE_WINDOWS: readonly ExpiryWindow[] = ['all', '0dte', 'fri', 'opex'];
/** Numbers a cell holds */
export const CELL_W = 13;

/** [time (epoch s), open, high, low, close, volume] */
export type TileBar = [number, number, number, number, number, number];
/** [time, spot, flags (1 rebuilt), pre: [ref, ring, refG, refD, ringD, minutes, at, net, maxD], walls: [cw, pw, cwState, pwState],
    cells, scale: [the net's and gross's power of ten, the delta's]] — a cell's money is a whole number of its scale */
export type TileCol = [number, number, number, number[], (number | null)[], (number | null)[], [number, number]];
export interface Tile {
  f: number;
  model: string;
  name: string;
  day: string;
  window: ExpiryWindow;
  tf: TileTf;
  cols: TileCol[];
  /** the window's per-minute peaks through the session: the net's, the gross's, the delta's (the prior and fixed bases) */
  maxima: { m: number[]; g: number[]; d: number[] };
  /** the held walls' moves and states at the minute they happened: [0 call wall | 1 put wall, the strike, the strike
      before (a move) or null (a state), the state (2 broken, 3 reclaimed; 0 on a move), epoch s] */
  events: [number, number, number | null, number, number][];
}

export interface TileMinuteBar {
  /** the minute's start, epoch s */
  time: number;
  open?: number;
  high?: number;
  low?: number;
  close: number;
  volume?: number;
  session?: 'pre' | 'r' | 'post' | 'gth' | 'curb';
  src?: 'options';
}

const sig = (x: number | undefined): number => (x == null || !Number.isFinite(x) || x === 0 ? 0 : Number(x.toPrecision(4)));
/** a share in thousandths */
const permil = (x: number | undefined): number => (x == null || !Number.isFinite(x) ? 0 : Math.round(x * 1000));
/** a moment as whole seconds from the column's time (epoch s), either side of it — a bar's peak minute stands after the
    bar's start, the vols' trades before it — null when there is none */
const offsetOf = (colTime: number, atSec: number | undefined): number | null => (atSec == null || !(atSec > 0) ? null : Math.round(atSec - colTime));
const fromOffset = (colTime: number, off: number | null | undefined): number | undefined => (off == null ? undefined : colTime + off);
const STATES = [null, 'holding', 'broken', 'reclaimed'] as const;
const stateCode = (s: TileColumnPre['cwState']): number => Math.max(0, STATES.indexOf(s));
/** A day's bar is stamped at noon UTC, as the feed's day bars are (data/feed/levels.ts dayTime) */
export const dayNoon = (day: string): number => {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y, m - 1, d, 12) / 1000;
};

/* ---- the codec ------------------------------------------------------------------------------------------------- */

/** A column's money as whole numbers of a power of ten: its largest figure keeps five digits, so every figure is within
    a twenty-thousandth of the largest — a quarter of a step of the finest mark the renderer draws */
const scaleOf = (largest: number): number => (largest > 0 ? Math.floor(Math.log10(largest)) - 4 : 0);
function encodeCells(levels: readonly GexLevel[], t: number, sc: [number, number]): (number | null)[] {
  const out: (number | null)[] = new Array(levels.length * CELL_W);
  const kV = 10 ** sc[0];
  const kD = 10 ** sc[1];
  const q = (x: number | undefined, k: number) => (x == null || !Number.isFinite(x) ? 0 : Math.round(x / k));
  let o = 0;
  for (const l of levels) {
    out[o++] = l.strike;
    out[o++] = q(l.value, kV);
    out[o++] = q(l.gross, kV);
    out[o++] = q(l.dex, kD);
    out[o++] = l.prov === 'modeled' ? 1 : l.prov === 'carried' ? 2 : 0;
    out[o++] = permil(l.staleShare);
    out[o++] = permil(l.coverage);
    out[o++] = offsetOf(t, l.at);
    out[o++] = offsetOf(t, l.freshAt != null ? l.freshAt / 1000 : undefined);
    out[o++] = offsetOf(t, l.staleSince != null ? l.staleSince / 1000 : undefined);
    out[o++] = l.staleBound ? 1 : 0;
    out[o++] = offsetOf(t, l.readGap != null ? l.readGap / 1000 : undefined);
    out[o++] = l.wideShare ? permil(l.wideShare) : 0;
  }
  return out;
}

function decodeCells(cells: readonly (number | null)[], t: number, sc: [number, number]): GexLevel[] {
  const n = Math.floor(cells.length / CELL_W);
  const out: GexLevel[] = new Array(n);
  const kV = 10 ** sc[0];
  const kD = 10 ** sc[1];
  /* the first seven are always numbers; the times may be null */
  const num = (x: number | null) => x ?? 0;
  for (let i = 0, o = 0; i < n; i++, o += CELL_W) {
    const l: GexLevel = { strike: num(cells[o]), value: num(cells[o + 1]) * kV, dex: num(cells[o + 3]) * kD };
    if (num(cells[o + 2]) > 0) l.gross = num(cells[o + 2]) * kV;
    const prov = cells[o + 4];
    if (prov) {
      l.prov = prov === 1 ? 'modeled' : 'carried';
      l.staleShare = num(cells[o + 5]) / 1000;
      l.coverage = num(cells[o + 6]) / 1000;
    }
    const at = fromOffset(t, cells[o + 7]);
    if (at != null) l.at = at;
    const fresh = fromOffset(t, cells[o + 8]);
    if (fresh != null) l.freshAt = fresh * 1000;
    const stale = fromOffset(t, cells[o + 9]);
    if (stale != null) l.staleSince = stale * 1000;
    if (num(cells[o + 10])) l.staleBound = true;
    const gap = fromOffset(t, cells[o + 11]);
    if (gap != null) l.readGap = gap * 1000;
    if (num(cells[o + 12])) l.wideShare = num(cells[o + 12]) / 1000;
    out[i] = l;
  }
  return out;
}

export function encodeColumn(snap: GexSnapshot, pre: TileColumnPre): TileCol {
  let mV = 0;
  let mD = 0;
  for (const l of snap.levels) {
    mV = Math.max(mV, Math.abs(l.value), Math.abs(l.gross ?? 0));
    mD = Math.max(mD, Math.abs(l.dex ?? 0));
  }
  const sc: [number, number] = [scaleOf(mV), scaleOf(mD)];
  return [
    snap.time,
    snap.spot ?? 0,
    snap.rebuilt ? 1 : 0,
    [sig(pre.ref), sig(pre.ring), sig(pre.refG), sig(pre.refD), sig(pre.ringD), pre.minutes, pre.at, sig(pre.net), sig(pre.maxD)],
    [pre.cw, pre.pw, stateCode(pre.cwState), stateCode(pre.pwState)],
    encodeCells(snap.levels, snap.time, sc),
    sc,
  ];
}

export function decodeColumn(c: TileCol): GexSnapshot {
  const [time, spot, flags, p, w, cells, sc] = c;
  const snap: GexSnapshot = {
    time,
    levels: decodeCells(cells, time, sc ?? [0, 0]),
    pre: { ref: p[0], ring: p[1], refG: p[2], refD: p[3], ringD: p[4], minutes: p[5], at: p[6], net: p[7] ?? 0, maxD: p[8] ?? p[3], cw: w[0] ?? null, pw: w[1] ?? null, cwState: STATES[(w[2] as number) ?? 0] ?? null, pwState: STATES[(w[3] as number) ?? 0] ?? null },
  };
  if (spot) snap.spot = spot;
  if (flags & 1) snap.rebuilt = true;
  return snap;
}

export const decodeBar = (b: TileBar): Candle => ({ time: b[0], open: b[1], high: b[2], low: b[3], close: b[4], volume: b[5] });
export const encodeBar = (c: Candle): TileBar => [c.time, c.open, c.high, c.low, c.close, c.volume];

/** A day's bars at one timeframe — the same through every window, so kept once */
export interface TileBars {
  f: number;
  name: string;
  day: string;
  tf: TileTf;
  bars: TileBar[];
}

/* ---- the builder ----------------------------------------------------------------------------------------------- */

export interface DayTileInputs {
  name: string;
  day: string;
  past: PastInputsLike;
  /** the day's minute bars, every session (the chart draws 04:00 to 20:00); the field is modeled on the regular ones */
  bars: readonly TileMinuteBar[];
  /** the official close, where it is known (the day's bar closes there — never the 3:59 pm bar) */
  close?: number | null;
}

/** The day's per-minute columns, modeled as the page models a rebuilt session: every minute of the name's sessions
    (core/sessions.ts — an equity's regular hours, 9:30 to 4:00; SPX's overnight session, regular hours to 4:15 pm and
    the curb, its price outside the index's own hours the options' forward) */
export function modelDay(inp: Pick<DayTileInputs, 'name' | 'day' | 'past' | 'bars'>): GexSnapshot[] {
  const spans = fieldSpansOf(inp.name, inp.day).map(sp => [sp.from / 1000, sp.to / 1000] as const);
  const inSpans = (t: number) => spans.some(([a, b]) => t >= a && t < b);
  const u = universeOf(inp.name, inp.day, pastInputs(inp.past));
  const out: GexSnapshot[] = [];
  for (const b of [...inp.bars].sort((a, c) => a.time - c.time)) {
    if (!inSpans(b.time) || !Number.isFinite(b.close)) continue;
    const snap = modelColumn(u, { time: b.time, close: b.close });
    if (snap.levels.length) out.push(snap);
  }
  return out;
}

const candleOf = (b: TileMinuteBar): Candle => {
  const open = b.open ?? b.close;
  return { time: b.time, open, high: b.high ?? Math.max(open, b.close), low: b.low ?? Math.min(open, b.close), close: b.close, volume: b.volume ?? 0 };
};

/** The day's bar off its regular minutes, closing at the official close where it is known */
export function dayBarOf(day: string, bars: readonly TileMinuteBar[], close?: number | null): Candle | null {
  const [y, mo, d] = day.split('-').map(Number);
  const from = nyWallTime(y, mo, d, 9, 30) / 1000;
  const to = nyWallTime(y, mo, d, 16, 0) / 1000;
  const reg = [...bars].filter(b => b.time >= from && b.time < to && Number.isFinite(b.close)).sort((a, b) => a.time - b.time);
  if (!reg.length) return null;
  const c = reg.map(candleOf);
  const last = close != null && Number.isFinite(close) && close > 0 ? close : c[c.length - 1].close;
  let high = -Infinity;
  let low = Infinity;
  let volume = 0;
  for (const b of c) {
    high = Math.max(high, b.high);
    low = Math.min(low, b.low);
    volume += b.volume;
  }
  return { time: dayNoon(day), open: c[0].open, high: Math.max(high, last), low: Math.min(low, last), close: last, volume };
}

/** The last index whose time is at or before t (binary search over ascending times), −1 when none */
function lastAtOrBefore(times: readonly number[], t: number): number {
  let lo = 0;
  let hi = times.length;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (times[m] <= t) lo = m + 1;
    else hi = m;
  }
  return lo - 1;
}

/**
 * Every tile of a session: each window × each timeframe. `minutes` may be handed in when the caller modeled the day
 * already (the store's final rows, the Theta rebuild), else the day is modeled here.
 */
export function buildDayTiles(inp: DayTileInputs, minutes?: readonly GexSnapshot[]): { tiles: Tile[]; bars: TileBars[] } {
  const snaps = minutes ?? modelDay(inp);
  const candles = [...inp.bars].filter(b => Number.isFinite(b.close)).sort((a, b) => a.time - b.time).map(candleOf);
  const dayBar = dayBarOf(inp.day, inp.bars, inp.close);
  const out: Tile[] = [];
  const barsOut: TileBars[] = TILE_TFS.map(tf => ({
    f: TILES_FORMAT,
    name: inp.name.toUpperCase(),
    day: inp.day,
    tf,
    bars: (tf === 1440 ? (dayBar ? [dayBar] : []) : tf === 1 ? candles : aggregateCandles(candles, tf)).map(encodeBar),
  }));
  for (const w of TILE_WINDOWS) {
    const ws = w === 'all' ? [...snaps] : snaps.map(s => windowView(s, w));
    /* the per-minute references and the held walls — the renderer's own counts, run once here */
    const run = new RunningScale();
    const runD = new RunningScale();
    /* the size references: the session's largest node so far (the renderer's own rule since the orbs' second round) */
    let maxG = 0;
    let maxD = 0;
    const stick = new WallStick();
    const times: number[] = [];
    const pres: TileColumnPre[] = [];
    const maxima = { m: [] as number[], g: [] as number[], d: [] as number[] };
    const events: Tile['events'] = [];
    let prev: TileColumnPre | null = null;
    for (let i = 0; i < ws.length; i++) {
      const s = ws[i];
      const m = columnMax(s.levels);
      const g = columnGross(s.levels);
      let dm = 0;
      for (const l of s.levels) dm = Math.max(dm, Math.abs(l.dex ?? 0));
      const ref = run.push(m);
      maxG = Math.max(maxG, g);
      maxD = Math.max(maxD, dm);
      const refG = maxG;
      const refD = runD.push(dm);
      const held = stick.next(wallObsOf(s.time, s.spot ?? NaN, s.levels));
      times.push(s.time);
      const pre: TileColumnPre = { ref, ring: run.ring(), refG, refD, ringD: runD.ring(), maxD, minutes: i + 1, at: s.time, net: netOf(s.levels), cw: held.cw, pw: held.pw, cwState: held.cwState, pwState: held.pwState };
      pres.push(pre);
      /* the plot's chips: a held wall's move (trailModel stickyWallMoves' rule) and a state that is not a move (wallStateEventsOf's) */
      if (prev)
        for (const [k, kind] of [[0, 'cw'], [1, 'pw']] as const) {
          const a = prev[kind];
          const b = pre[kind];
          const sa = kind === 'cw' ? prev.cwState : prev.pwState;
          const sb = kind === 'cw' ? pre.cwState : pre.pwState;
          if (a != null && b != null && a !== b) events.push([k, b, a, 0, s.time]);
          else if (b != null && a === b && sa !== sb && (sb === 'broken' || sb === 'reclaimed')) events.push([k, b, null, stateCode(sb), s.time]);
        }
      prev = pre;
      maxima.m.push(sig(m));
      maxima.g.push(sig(g));
      maxima.d.push(sig(dm));
    }
    for (const tf of TILE_TFS) {
      /* 1D: one column, the session's peak per strike, stamped at the day's noon as its bar is */
      const cols: GexSnapshot[] = tf === 1440 ? (ws.length ? aggregateSnapshots(ws, 1440).map(c => ({ ...c, time: dayNoon(inp.day) })) : []) : tf === 1 ? ws : aggregateSnapshots(ws, tf);
      const enc: TileCol[] = [];
      for (const c of cols) {
        const end = tf === 1440 ? Infinity : c.time + tf * 60 - 1;
        const j = lastAtOrBefore(times, end);
        if (j < 0) continue;
        enc.push(encodeColumn(c, pres[j]));
      }
      out.push({ f: TILES_FORMAT, model: TRAIL_MODEL.version, name: inp.name.toUpperCase(), day: inp.day, window: w, tf, cols: enc, maxima, events });
    }
  }
  return { tiles: out, bars: barsOut };
}

/* THE TILED SESSIONS BESIDE THE PAGE'S OWN (Section I): two time-ordered lists made one, a time both hold kept from the
   first (the server's fold) — remembered by both lists' identity, so a tick that leaves them as they were costs nothing */
const mergeMemo = new WeakMap<object, { other: object; out: unknown[] }>();
export function mergeByTime<T extends { time: number }>(pre: T[], live: T[]): T[] {
  if (!pre.length) return live;
  if (!live.length) return pre;
  const had = mergeMemo.get(pre);
  if (had && had.other === live) return had.out as T[];
  const out: T[] = [];
  let i = 0;
  let j = 0;
  while (i < pre.length || j < live.length) {
    if (j >= live.length || (i < pre.length && pre[i].time <= live[j].time)) {
      if (j < live.length && live[j].time === pre[i].time) j++;
      out.push(pre[i++]);
    } else out.push(live[j++]);
  }
  mergeMemo.set(pre, { other: live, out });
  return out;
}
