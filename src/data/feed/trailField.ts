/*
==================================================
  SLAYER TERMINAL - THE STRIKE FIELD, REBUILT
  (data/feed/trailField.ts)

  TERRAIN'S TRAIL ON THE FEED, FULL (2026-10-13 — the
  owner: "whats wrong with the exposure trails on
  terrian, why doesnt it look like the UI mockup?").
  The house's field is the book a minute across every
  session the chart shows (core/simulator.ts keeps one
  a bar). UW answers the book as it stands now and no
  route gives it strike by strike for an earlier
  minute, so the field read only what was read: a few
  columns, or one after hours.

  THIS FILE IS THE ONE PLACE THE FIELD'S MODEL LIVES —
  every choice below is named in TRAIL_MODEL (its
  version travels with the field: trailMeta), so a
  change to the method is a change here alone.

  MEASURED OVER REBUILT. A book UW answered (read by
  the local server once a minute through the session —
  server/fieldRecorder.ts — or by a page) stands in its
  own minute as it was read: MEASURED. Every other
  minute is REBUILT from real inputs with the house's
  own math, and draws a step quieter (gexNodesPrimitive).

  TODAY (every minute bar of New York's day — the
  pre-market and the evening too). Every contract of
  the name listed within 60 days with open interest
  (UW /option-contracts — nine pages for SPY; the
  proxy keeps them ten minutes): its strike, expiry,
  open interest and implied vol.
    · OPEN INTEREST: the count UW publishes for today —
      the positions at the session before's close —
      never one dated later.
    · VOL, STICKY-STRIKE: each contract keeps its own
      vol as read, across the day. A minute is priced
      once, with the chain in hand when it is priced; a
      later read of the chain (every half hour while the
      session is open) prices the minutes after it and
      never re-prices the ones before. The one input not
      point in time: a minute before the first read of
      the chain takes the vol as first read (no route
      carries a contract's vol earlier in the day). A
      contract with no vol (about one in nine near the
      money, seen) takes its expiry's nearest strike's,
      the same side first; a vol read in its expiry's
      last hour is not used (UW figures it on the
      minutes left: a far strike reads 500% and more
      after the close) — the next expiry's stands in.
    · THE PRICER: core/greeks.ts blackScholesGreeks,
      the simulator's own, at the minute's real close
      and the minute's own clock (its middle) to each
      expiry's 16:00 New York; a contract past its
      expiry holds nothing, so the day's own expiry
      leaves the field at the close.
    · THE UNITS AND THE SIGN: a strike's leg is open
      interest × greek × price² (× 100 shares × 1% of
      the price) — UW's own units: summed over UW's own
      per-contract gamma it reproduces /spot-exposures/
      strike to the dollar (checked 2026-10-12). The
      house's sign: the calls' gamma negative, the puts'
      positive, every delta turned over (levels.ts
      feedStrike). 30 strikes each side of the minute's
      price, as the house's book.

  CALIBRATED POINT IN TIME, never ahead: a rebuilt
  minute is measured only against the newest book
  read AT OR BEFORE it. The rebuild is priced at that
  book's own moment and price, and each strike's four
  legs (calls' and puts' gamma and delta) take the
  ratio UW's figure bears to the rebuild's — clamped
  to a quarter and four times the whole book's ratio
  for the leg, and the whole book's ratio where the
  rebuild's leg is under 2% of its largest. Before the
  day's first measured book a minute is rebuilt and
  uncalibrated (its units are UW's already). A book
  figured after the close still carries the day's
  expired contracts at their last minutes' greeks (a
  spike at the money): against one, only the whole
  book's ratio is taken, off the strikes past 1% of
  the price. Each column keeps the moment of the book
  it was measured against (trailMeta).

  AN EXPIRY CUT (the pane's expiry card on one listed
  date): the same rebuild on that date's contracts
  alone, uncalibrated — no book of one date is kept
  through the day — and nothing for the sessions
  before (no route carries a past date's book by
  expiry).

  THE SESSIONS BEFORE: today's open interest is not
  theirs, and the contracts that expired at their
  close are no longer listed, so they are never
  rebuilt from today's chain. Each is UW's own book
  for that date (/greek-exposure/strike?date= — every
  expiry the date listed, on that date's own count,
  figured once that day), held from that day's
  pre-market to its close: each minute takes the 30
  strikes round its price, per 1% at its price
  (× price² / 100, that route's ratio to /spot-
  exposures/strike, checked 2026-10-12). Drawn as
  rebuilt — it is not that minute's book. The ten
  sessions before today the bars reach, one at a
  time, newest first; kept on this machine (IndexedDB
  slayer_trail — a past date never changes).

  DISCRETE: a bead is one strike at one minute — no
  smoothing between strikes or minutes; a minute with
  no bar is a gap. THE INTENSITY SCALE is the house's
  (gexNodesPrimitive): a bead's strength against the
  85th percentile of the moments' maxima among the
  columns handed in — while the chart replays, only
  the columns up to the replayed bar.

  OFF THE MAIN FRAME: minutes are priced in slices of
  8 ms, one task apart, each minute once (kept per
  name for the day), and nothing runs while the tab is
  hidden. An index has no bars on these plans: nothing
  is asked, the pane says so as before.
==================================================
*/

import { useEffect, useSyncExternalStore } from 'react';
import { blackScholesGreeks } from '../../core/greeks';
import { nyIsoDate, nySessionPhase, nyWallTime } from '../../core/nyTime';
import type { Candle, GexLevel, GexSnapshot } from '../../types/market';
import type { FeedResult } from './client';
import { uwChainContracts, uwGreekExposureByStrike, type UwChainContract, type UwOpenExposure } from './uw';
import type { FeedBook } from './levels';

/* ---- the pure part: a chain, a column, a calibration ---------------------------------------------------------- */

/** Strikes kept each side of the price — the house's book (pinpointBook BOOK_WINDOW, levels.ts FEED_HALF) */
export const TRAIL_HALF = 30;
/** Days of expiries rebuilt — what lies past them is carried at UW's level by the calibration */
export const CHAIN_MAX_DTE = 60;
/** Sessions before today drawn from UW's own book for the date */
export const PAST_SESSIONS = 10;
const YEAR_MS = 365 * 24 * 3600 * 1000;
const OPEN_MIN = 9 * 60 + 30;
const CLOSE_MIN = 16 * 60;

/** An OCC symbol's parts — "SPY261012P00777000" → SPY, 2026-10-12, P, 777 */
export function parseOcc(sym: string): { root: string; expiry: string; right: 'C' | 'P'; strike: number } | null {
  const m = /^(.*?)(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/.exec(sym);
  if (!m) return null;
  return { root: m[1], expiry: `20${m[2]}-${m[3]}-${m[4]}`, right: m[5] as 'C' | 'P', strike: Number(m[6]) / 1000 };
}

/** A name's chain ready to price: the strikes ascending, and each strike's contracts in one packed run */
export interface PreparedChain {
  /** The New York date the open interest is counted for */
  day: string;
  strikes: number[];
  /** Contracts [start[i], start[i+1]) belong to strikes[i] */
  start: Int32Array;
  call: Uint8Array;
  oi: Float64Array;
  iv: Float64Array;
  /** Epoch ms of the expiry's 16:00 New York */
  expires: Float64Array;
  /** Contracts the route answered, kept, and left out for want of a vol */
  counts: { rows: number; kept: number; noVol: number };
}

const expiryClose = new Map<string, number>();
function closeOf(iso: string): number {
  let t = expiryClose.get(iso);
  if (t === undefined) {
    const [y, m, d] = iso.split('-').map(Number);
    t = nyWallTime(y, m, d, 16, 0);
    expiryClose.set(iso, t);
  }
  return t;
}

/** The chain of a name from UW's rows: its own root only (an adjusted root is another deliverable), expiries from
    `day` on, open interest above nought, a missing vol taken from the expiry's nearest strike that has one */
export function prepareChain(ticker: string, rows: readonly UwChainContract[], day: string, readAt = Date.now()): PreparedChain {
  const t = ticker.toUpperCase();
  type C = { strike: number; expiry: string; call: boolean; oi: number; iv: number | null };
  const byExp = new Map<string, C[]>();
  for (const r of rows) {
    const p = parseOcc(r.symbol);
    if (!p || p.root !== t || p.expiry < day || !(r.openInterest > 0) || !(p.strike > 0)) continue;
    const list = byExp.get(p.expiry) ?? [];
    /* A VOL READ IN ITS EXPIRY'S LAST HOUR IS NOT USED: UW figures it on minutes left, and a far strike's runs to 500%
       and more (seen 2026-10-12, 16:15 ET: today's 762 put at 1,029%) — the next expiry's vol at the strike stands in */
    const late = closeOf(p.expiry) - readAt < 3600_000;
    list.push({ strike: p.strike, expiry: p.expiry, call: p.right === 'C', oi: r.openInterest, iv: !late && r.iv != null && r.iv > 0 ? r.iv : null });
    byExp.set(p.expiry, list);
  }
  const expiries = [...byExp.keys()].sort();
  const kept: C[] = [];
  let noVol = 0;
  for (let e = 0; e < expiries.length; e++) {
    const list = byExp.get(expiries[e]) ?? [];
    let withVol = list.filter(c => c.iv != null);
    /* an expiry with no vol of its own (its last hour) borrows the next expiry's */
    if (!withVol.length) withVol = (byExp.get(expiries[e + 1] ?? '') ?? []).filter(c => c.iv != null);
    for (const c of list) {
      if (c.iv == null) {
        let best: C | null = null;
        let bestD = Infinity;
        for (const o of withVol) {
          /* the same side wins a tie, and a strike's other side counts a hair farther */
          const d = Math.abs(o.strike - c.strike) + (o.call === c.call ? 0 : 1e-6);
          if (d < bestD) {
            bestD = d;
            best = o;
          }
        }
        if (!best) {
          noVol++;
          continue;
        }
        c.iv = best.iv;
      }
      kept.push(c);
    }
  }
  kept.sort((a, b) => a.strike - b.strike);
  const strikes: number[] = [];
  const start: number[] = [];
  for (let i = 0; i < kept.length; i++) {
    if (!strikes.length || kept[i].strike !== strikes[strikes.length - 1]) {
      strikes.push(kept[i].strike);
      start.push(i);
    }
  }
  start.push(kept.length);
  return {
    day,
    strikes,
    start: Int32Array.from(start),
    call: Uint8Array.from(kept.map(c => (c.call ? 1 : 0))),
    oi: Float64Array.from(kept.map(c => c.oi)),
    iv: Float64Array.from(kept.map(c => c.iv as number)),
    expires: Float64Array.from(kept.map(c => closeOf(c.expiry))),
    counts: { rows: rows.length, kept: kept.length, noVol },
  };
}

/** The index of the first of `half` strikes each side of a price — levels.ts aroundPrice's window */
function windowAt(strikes: readonly number[], price: number, half: number): [number, number] {
  let lo = 0;
  let hi = strikes.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (strikes[mid] > price) hi = mid;
    else lo = mid + 1;
  }
  return [Math.max(0, lo - half), Math.min(strikes.length, lo + half)];
}

/** One minute's rebuilt legs, in the house's sign, before calibration */
export interface RawColumn {
  /** The bar's time, seconds */
  time: number;
  spot: number;
  strikes: number[];
  gexCall: Float64Array;
  gexPut: Float64Array;
  dexCall: Float64Array;
  dexPut: Float64Array;
}

/** The book of a minute: each strike round the price, every contract priced at the price and the minute's clock */
export function rebuildColumn(chain: PreparedChain, spot: number, atMs: number, time: number, half = TRAIL_HALF): RawColumn {
  const [a, b] = windowAt(chain.strikes, spot, half);
  const n = Math.max(0, b - a);
  const out: RawColumn = { time, spot, strikes: chain.strikes.slice(a, b), gexCall: new Float64Array(n), gexPut: new Float64Array(n), dexCall: new Float64Array(n), dexPut: new Float64Array(n) };
  const s2 = spot * spot;
  for (let i = a; i < b; i++) {
    const k = chain.strikes[i];
    let gc = 0;
    let gp = 0;
    let dc = 0;
    let dp = 0;
    for (let j = chain.start[i]; j < chain.start[i + 1]; j++) {
      /* a contract past its expiry holds nothing; inside its last minutes the house's pricer keeps its own floor */
      if (chain.expires[j] <= atMs) continue;
      const g = blackScholesGreeks(spot, k, (chain.expires[j] - atMs) / YEAR_MS, chain.iv[j]);
      const w = chain.oi[j] * s2;
      if (chain.call[j]) {
        gc += w * g.gamma;
        dc += w * g.deltaCall;
      } else {
        gp += w * g.gamma;
        dp += w * g.deltaPut;
      }
    }
    /* the house's sign (levels.ts feedStrike): the calls' gamma and every delta turned over, the puts' gamma as is */
    out.gexCall[i - a] = -gc;
    out.gexPut[i - a] = gp;
    out.dexCall[i - a] = -dc;
    out.dexPut[i - a] = -dp;
  }
  return out;
}

type Leg = 'gexCall' | 'gexPut' | 'dexCall' | 'dexPut';
const LEGS: Leg[] = ['gexCall', 'gexPut', 'dexCall', 'dexPut'];

/** Each strike's ratio of UW's figure to the rebuild's, per leg, and the whole book's ratio per leg */
export interface Calibration {
  /** UW's book's moment, epoch ms */
  at: number;
  byStrike: Map<number, Record<Leg, number>>;
  whole: Record<Leg, number>;
}

const bookLeg = (r: FeedBook['rows'][number], leg: Leg): number =>
  leg === 'gexCall' ? r.gex.call : leg === 'gexPut' ? r.gex.put : leg === 'dexCall' ? r.dex.call : r.dex.put;

/** Clamp of a strike's ratio about the whole book's */
const CLAMP = 4;
/** A leg under this share of its largest takes the whole book's ratio */
const FLOOR_SHARE = 0.02;

/** The rebuild priced at UW's book's own moment and price, measured against it strike by strike */
export function calibrate(chain: PreparedChain, book: FeedBook, opts: { afterClose?: boolean } = {}): Calibration {
  const ref = rebuildColumn(chain, book.spot, book.at, Math.floor(book.at / 1000), Math.max(TRAIL_HALF, book.rows.length));
  const at = new Map<number, number>();
  ref.strikes.forEach((k, i) => at.set(k, i));
  const whole = {} as Record<Leg, number>;
  const big = {} as Record<Leg, number>;
  for (const leg of LEGS) {
    let uw = 0;
    let rb = 0;
    let max = 0;
    for (const r of book.rows) {
      const i = at.get(r.strike);
      if (i === undefined) continue;
      /* AFTER THE CLOSE UW's book still carries the day's expired contracts at their last minutes' greeks — a spike at
         the money; the whole book's ratio is read from the strikes past 1% of the price, where it does not reach */
      if (opts.afterClose && Math.abs(r.strike - book.spot) < book.spot * 0.01) continue;
      uw += bookLeg(r, leg);
      rb += ref[leg][i];
      max = Math.max(max, Math.abs(ref[leg][i]));
    }
    const ratio = uw / rb;
    whole[leg] = Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
    big[leg] = max;
  }
  const byStrike = new Map<number, Record<Leg, number>>();
  /* after the close, the whole book's ratio alone (the strike by strike one would carry the spike through the day) */
  if (opts.afterClose) return { at: book.at, byStrike, whole };
  for (const r of book.rows) {
    const i = at.get(r.strike);
    if (i === undefined) continue;
    const one = {} as Record<Leg, number>;
    for (const leg of LEGS) {
      const rb = ref[leg][i];
      const uw = bookLeg(r, leg);
      const W = whole[leg];
      const ratio = uw / rb;
      one[leg] = Math.abs(rb) < big[leg] * FLOOR_SHARE || !Number.isFinite(ratio) || ratio <= 0 ? W : Math.min(W * CLAMP, Math.max(W / CLAMP, ratio));
    }
    byStrike.set(r.strike, one);
  }
  return { at: book.at, byStrike, whole };
}

/** A rebuilt minute on UW's level — the house's snapshot shape (net gamma and net delta per strike) */
export function calibratedSnapshot(col: RawColumn, cal: Calibration): GexSnapshot {
  const levels: GexLevel[] = new Array(col.strikes.length);
  for (let i = 0; i < col.strikes.length; i++) {
    const k = col.strikes[i];
    const r = cal.byStrike.get(k) ?? cal.whole;
    levels[i] = {
      strike: k,
      value: col.gexCall[i] * r.gexCall + col.gexPut[i] * r.gexPut,
      dex: col.dexCall[i] * r.dexCall + col.dexPut[i] * r.dexPut,
    };
  }
  return { time: col.time, levels };
}

/** A session before today's book, by strike ascending: gamma and delta of every expiry together, the house's sign,
    still in the route's own units (× price² / 100 makes them per 1% at a price) */
export interface PastBook {
  date: string;
  strikes: number[];
  gex: Float64Array;
  dex: Float64Array;
}

/** UW's book for a date (/greek-exposure/strike), round the session's range — the calls' gamma positive and the puts'
    negative as UW states them, so both turned over to the house's sign (levels.ts feedStrike) */
export function pastBookOf(date: string, rows: readonly UwOpenExposure[], lo: number, hi: number): PastBook {
  const keep = rows.filter(r => r.strike >= lo && r.strike <= hi).sort((a, b) => a.strike - b.strike);
  return {
    date,
    strikes: keep.map(r => r.strike),
    gex: Float64Array.from(keep.map(r => -(r.callGamma + r.putGamma))),
    dex: Float64Array.from(keep.map(r => -(r.callDelta + r.putDelta))),
  };
}

/** A minute of a session before today: the 30 strikes round the minute's price, per 1% at the price */
export function pastSnapshot(book: PastBook, spot: number, time: number, half = TRAIL_HALF): GexSnapshot {
  const [a, b] = windowAt(book.strikes, spot, half);
  const f = (spot * spot) / 100;
  const levels: GexLevel[] = [];
  for (let i = a; i < b; i++) levels.push({ strike: book.strikes[i], value: book.gex[i] * f, dex: book.dex[i] * f });
  return { time, levels };
}

/* ---- New York's day of a bar, fast ---------------------------------------------------------------------------- */

/* New York's offset never changes inside an hour: a bar's date and minute come off its hour's, read once */
const hourParts = new Map<number, { date: string; minute: number }>();
export function barNy(timeSec: number): { date: string; minute: number } {
  const h = Math.floor(timeSec / 3600);
  let p = hourParts.get(h);
  if (!p) {
    const ms = h * 3600 * 1000;
    const d = new Date(ms);
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', hour: 'numeric', minute: 'numeric' }).formatToParts(d);
    const hh = Number(parts.find(x => x.type === 'hour')?.value ?? 0) % 24;
    const mm = Number(parts.find(x => x.type === 'minute')?.value ?? 0);
    p = { date: nyIsoDate(ms), minute: hh * 60 + mm };
    if (hourParts.size > 20000) hourParts.clear();
    hourParts.set(h, p);
  }
  return { date: p.date, minute: p.minute + Math.floor((timeSec - h * 3600) / 60) };
}

/** Every bar of one New York date — today's field runs from the first pre-market minute to the last after-hours one */
export function dayBars(bars: readonly Candle[], day: string): Candle[] {
  const out: Candle[] = [];
  for (let i = bars.length - 1; i >= 0; i--) {
    const d = barNy(bars[i].time).date;
    if (d === day) out.push(bars[i]);
    else if (d < day) break;
  }
  return out.reverse();
}

/** Each New York date's bars up to its close (the pre-market and the session — after the close the date's own expiry
    has gone, so its book no longer stands), oldest date first; `regular` keeps the session alone */
export function sessionsOf(bars: readonly Candle[], regular = false): Map<string, Candle[]> {
  const out = new Map<string, Candle[]>();
  for (const b of bars) {
    const { date, minute } = barNy(b.time);
    if (minute >= CLOSE_MIN || (regular && minute < OPEN_MIN)) continue;
    const list = out.get(date);
    if (list) list.push(b);
    else out.set(date, [b]);
  }
  return out;
}

/** The field's model, named — its version is kept with every column (trailMeta) */
export const TRAIL_MODEL = {
  version: 'trail-2026-10-13.1',
  openInterest: "today's count (the positions at the session before's close); a session before: its own date's book",
  vol: "sticky-strike: each contract keeps its own vol as read; a minute is priced with the chain in hand; a vol read in its expiry's last hour gives way to the next expiry's",
  pricer: 'core/greeks.ts blackScholesGreeks at the minute close and the minute middle; carry from core/carry.ts',
  expiries: `listed within ${CHAIN_MAX_DTE} days; past them carried by the calibration`,
  units: 'open interest × greek × price² (UW /spot-exposures/strike units)',
  sign: "the house's: the calls' gamma negative, the puts' positive, delta turned over",
  calibration: 'per strike and leg, against the newest measured book at or before the minute; none before the first; after the close the whole book off the strikes past 1%',
  scale: "the house's: the 85th percentile of the moments' maxima among the columns handed in",
} as const;

/** A rebuilt minute's moment before calibration — UW's units already */
export function uncalibratedSnapshot(col: RawColumn): GexSnapshot {
  const levels: GexLevel[] = new Array(col.strikes.length);
  for (let i = 0; i < col.strikes.length; i++) levels[i] = { strike: col.strikes[i], value: col.gexCall[i] + col.gexPut[i], dex: col.dexCall[i] + col.dexPut[i] };
  return { time: col.time, levels };
}

/** Which way a column of the field was made, and against what */
export interface TrailMeta {
  kind: 'measured' | 'rebuilt' | 'held';
  /** A rebuilt minute: the moment (epoch ms) of the measured book it was scaled to — absent when uncalibrated */
  calAt?: number;
  model: string;
}
const metas = new WeakMap<GexSnapshot, TrailMeta>();
/** How a column of the field was made — null for the house's own field */
export const trailMeta = (snap: GexSnapshot): TrailMeta | null => metas.get(snap) ?? null;
const mark = (snap: GexSnapshot, meta: TrailMeta): GexSnapshot => {
  metas.set(snap, meta);
  return snap;
};

/* ---- the store: a name's field, built in slices -------------------------------------------------------------- */

/** A name's chain, shared by every cut */
interface ChainState {
  chain: PreparedChain | null;
  /** By listed date — a cut's chain, made once a chain */
  byDate: Map<string, PreparedChain>;
  at: number;
  state: 'idle' | 'loading' | 'ok' | 'failed';
  calls: number;
}
const chains = new Map<string, ChainState>();
const chainOf = (t: string, day: string): ChainState => {
  const key = `${t}|${day}`;
  let c = chains.get(key);
  if (!c) chains.set(key, (c = { chain: null, byDate: new Map(), at: 0, state: 'idle', calls: 0 }));
  return c;
};
/** A chain cut to one listed date */
function cutChain(c: PreparedChain, date: string): PreparedChain {
  const close = closeOf(date);
  const keep: number[] = [];
  for (let j = 0; j < c.expires.length; j++) if (c.expires[j] === close) keep.push(j);
  const strikeOf: number[] = [];
  for (let i = 0; i < c.strikes.length; i++) for (let j = c.start[i]; j < c.start[i + 1]; j++) strikeOf[j] = c.strikes[i];
  const strikes: number[] = [];
  const start: number[] = [];
  keep.forEach((j, n) => {
    if (!strikes.length || strikeOf[j] !== strikes[strikes.length - 1]) {
      strikes.push(strikeOf[j]);
      start.push(n);
    }
  });
  start.push(keep.length);
  return {
    day: c.day,
    strikes,
    start: Int32Array.from(start),
    call: Uint8Array.from(keep.map(j => c.call[j])),
    oi: Float64Array.from(keep.map(j => c.oi[j])),
    iv: Float64Array.from(keep.map(j => c.iv[j])),
    expires: Float64Array.from(keep.map(j => c.expires[j])),
    counts: { rows: c.counts.rows, kept: keep.length, noVol: 0 },
  };
}

/** A name's sessions before today, shared by every pane of it */
const pastBooks = new Map<string, Map<string, PastBook | 'loading' | 'failed'>>();
const pastOf = (t: string) => {
  let m = pastBooks.get(t);
  if (!m) pastBooks.set(t, (m = new Map()));
  return m;
};

interface NameTrail {
  key: string;
  t: string;
  day: string;
  /** null: every expiry; else one listed date */
  cut: string | null;
  bars: readonly Candle[];
  /** The books read (measured), as snapshots */
  reads: readonly GexSnapshot[];
  /** Today's minutes priced, by bar time */
  raw: Map<number, RawColumn>;
  /** A calibration per measured book, by its moment */
  cals: Map<number, Calibration>;
  /** The made snapshots, by `${time}|${calAt}` */
  made: Map<string, GexSnapshot>;
  pastSnaps: Map<string, { n: number; snaps: GexSnapshot[] }>;
  out: GexSnapshot[];
  full: boolean;
  /** Main-thread work spent, ms, and calls made — read by the checks */
  cost: { ms: number; calls: number; minutes: number };
}

const trails = new Map<string, NameTrail>();
const subs = new Map<string, Set<() => void>>();
const ring = (key: string) => subs.get(key)?.forEach(f => f());
const ringName = (t: string) => {
  for (const s of trails.values()) if (s.t === t) ring(s.key);
};

const hidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';

/* ---- the past books on this machine ---- */
const TRAIL_DB = 'slayer_trail';
let trailDb: Promise<IDBDatabase | null> | null = null;
function openTrailDb(): Promise<IDBDatabase | null> {
  if (trailDb) return trailDb;
  trailDb = new Promise(resolve => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(TRAIL_DB, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains('past')) req.result.createObjectStore('past', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return trailDb;
}
async function diskPast(id: string): Promise<PastBook | null> {
  const db = await openTrailDb();
  if (!db) return null;
  return new Promise(resolve => {
    try {
      const req = db.transaction('past', 'readonly').objectStore('past').get(id);
      req.onsuccess = () => {
        const r = req.result as { date: string; strikes: number[]; gex: number[]; dex: number[] } | undefined;
        resolve(r ? { date: r.date, strikes: r.strikes, gex: Float64Array.from(r.gex), dex: Float64Array.from(r.dex) } : null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}
function savePast(id: string, b: PastBook) {
  void openTrailDb().then(db => {
    if (!db) return;
    try {
      db.transaction('past', 'readwrite').objectStore('past').put({ id, date: b.date, strikes: b.strikes, gex: Array.from(b.gex), dex: Array.from(b.dex) });
    } catch {
      /* a full or refused disk: the book lives for the visit */
    }
  });
}

/* ---- the loaders: one call at a time per name, polite to UW Basic's three at once ---- */

const CHAIN_REFRESH_MS = 30 * 60_000;
const MAX_PAGES = 20;
const pause = (ms: number) => new Promise(res => setTimeout(res, ms));

async function loadChain(t: string, c: ChainState, day: string) {
  c.state = 'loading';
  const rows: UwChainContract[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    let r: FeedResult<UwChainContract[]> = await uwChainContracts(t, { maxDte: CHAIN_MAX_DTE, page });
    c.calls++;
    if (!r.ok && r.reason === 'rate') {
      await pause(2000);
      r = await uwChainContracts(t, { maxDte: CHAIN_MAX_DTE, page });
      c.calls++;
    }
    if (!r.ok) {
      c.state = c.chain ? 'ok' : 'failed';
      c.at = Date.now();
      ringName(t);
      return;
    }
    rows.push(...r.data);
    if (r.data.length < 500) break;
  }
  c.chain = prepareChain(t, rows, day);
  c.byDate = new Map();
  c.at = Date.now();
  c.state = 'ok';
  /* sticky-strike: the minutes already priced keep their pricing; the next ones take this chain */
  schedule();
}

async function loadPast(t: string, date: string, lo: number, hi: number) {
  const id = `${t}:${date}`;
  const past = pastOf(t);
  past.set(date, 'loading');
  const kept = await diskPast(id);
  if (kept && kept.strikes.length) past.set(date, kept);
  else {
    let r = await uwGreekExposureByStrike(t, date);
    if (!r.ok && r.reason === 'rate') {
      await pause(2000);
      r = await uwGreekExposureByStrike(t, date);
    }
    for (const s of trails.values()) if (s.t === t) s.cost.calls++;
    if (r.ok && r.data.length) {
      /* a generous band round the session's range, so a minute anywhere in it finds its 30 strikes each side */
      const b = pastBookOf(date, r.data, lo, hi);
      past.set(date, b);
      savePast(id, b);
    } else past.set(date, 'failed');
  }
  for (const s of trails.values()) if (s.t === t) rebuildOut(s);
  const any = [...trails.values()].find(s => s.t === t && !s.cut);
  if (any) pumpPast(any);
}

/** Ask for the next session before today that is not in yet — one at a time, newest first */
function pumpPast(s: NameTrail) {
  if (hidden() || s.cut) return;
  const past = pastOf(s.t);
  if ([...past.values()].some(v => v === 'loading')) return;
  const sessions = sessionsOf(s.bars, true);
  const dates = [...sessions.keys()].filter(d => d < s.day).sort().reverse().slice(0, PAST_SESSIONS);
  for (const d of dates) {
    if (past.has(d)) continue;
    const list = sessions.get(d) ?? [];
    let lo = Infinity;
    let hi = -Infinity;
    for (const b of list) {
      lo = Math.min(lo, b.low);
      hi = Math.max(hi, b.high);
    }
    const pad = Math.max(hi * 0.12, 1);
    void loadPast(s.t, d, lo - pad, hi + pad);
    return;
  }
}

/* ---- the slices ---- */

let timer: ReturnType<typeof setTimeout> | null = null;
const SLICE_MS = 8;
function schedule() {
  if (timer != null || typeof window === 'undefined') return;
  timer = setTimeout(work, 0);
}
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => !hidden() && schedule());

/** The chain a trail prices with — the whole chain, or its cut */
function chainFor(s: NameTrail): PreparedChain | null {
  const c = chainOf(s.t, s.day);
  if (!c.chain) return null;
  if (!s.cut) return c.chain;
  let cut = c.byDate.get(s.cut);
  if (!cut) c.byDate.set(s.cut, (cut = cutChain(c.chain, s.cut)));
  return cut;
}

/** The measured books a trail calibrates against — the whole book's, never a cut's (none is kept through the day) */
let booksOf: (t: string) => readonly FeedBook[] = () => [];
/** levels.ts hands in its measured books (kept apart so this module never imports the page's poll machinery) */
export function setMeasuredSource(fn: (t: string) => readonly FeedBook[]): void {
  booksOf = fn;
}

function work() {
  timer = null;
  if (hidden()) return;
  const t0 = performance.now();
  let more = false;
  for (const s of trails.values()) {
    if (!subs.get(s.key)?.size) continue;
    const chain = chainFor(s);
    if (!chain) continue;
    let did = false;
    for (const b of dayBars(s.bars, s.day)) {
      const have = s.raw.get(b.time);
      /* a minute is priced once; only the forming bar, whose close still moves, is priced again */
      if (have && have.spot === b.close) continue;
      const tS = performance.now();
      /* the minute's middle is its clock: the 15:59 bar still holds the day's own expiry */
      s.raw.set(b.time, rebuildColumn(chain, b.close, b.time * 1000 + 30_000, b.time));
      s.cost.minutes++;
      s.cost.ms += performance.now() - tS;
      did = true;
      if (performance.now() - t0 > SLICE_MS) {
        more = true;
        break;
      }
    }
    if (did) rebuildOut(s);
    if (more) break;
  }
  if (more) schedule();
}

/** The calibration a rebuilt minute takes: the newest measured book at or before it (none before the first) */
function calFor(s: NameTrail, chain: PreparedChain, books: readonly FeedBook[], clockMs: number): Calibration | null {
  let book: FeedBook | null = null;
  for (const b of books) {
    if (b.at <= clockMs) book = b;
    else break;
  }
  if (!book) return null;
  let cal = s.cals.get(book.at);
  if (!cal) {
    const tS = performance.now();
    cal = calibrate(chain, book, { afterClose: book.at >= closeOf(s.day) });
    s.cals.set(book.at, cal);
    s.cost.ms += performance.now() - tS;
  }
  return cal;
}

/** The field for the chart: the sessions before, today's rebuilt minutes, and the books read in their own minutes */
function rebuildOut(s: NameTrail) {
  const t0 = performance.now();
  const out: GexSnapshot[] = [];
  /* the sessions before: UW's book for the date, held through its minutes (the whole book only) */
  if (!s.cut) {
    const past = pastOf(s.t);
    for (const [date, list] of sessionsOf(s.bars)) {
      if (date >= s.day) continue;
      const b = past.get(date);
      if (!b || typeof b === 'string') continue;
      let made = s.pastSnaps.get(date);
      if (!made || made.n !== list.length) {
        made = {
          n: list.length,
          snaps: list.map(bar => {
            const snap = pastSnapshot(b, bar.close, bar.time);
            snap.spot = bar.close;
            snap.rebuilt = true;
            return mark(snap, { kind: 'held', model: TRAIL_MODEL.version });
          }),
        };
        s.pastSnaps.set(date, made);
      }
      out.push(...made.snaps);
    }
  }
  /* today: a minute read stands as read; every other is rebuilt, scaled to the newest book read at or before it */
  const reads = s.cut ? [] : s.reads;
  const readMin = new Set<number>();
  for (const r of reads) readMin.add(Math.floor(r.time / 60));
  const chain = chainFor(s);
  const books = s.cut ? [] : booksOf(s.t);
  if (chain) {
    for (const col of s.raw.values()) {
      if (readMin.has(Math.floor(col.time / 60))) continue;
      const cal = calFor(s, chain, books, col.time * 1000 + 30_000);
      const id = `${col.time}|${col.spot}|${cal?.at ?? 0}`;
      let snap = s.made.get(id);
      if (!snap) {
        snap = cal ? calibratedSnapshot(col, cal) : uncalibratedSnapshot(col);
        snap.spot = col.spot;
        snap.rebuilt = true;
        mark(snap, { kind: 'rebuilt', calAt: cal?.at, model: TRAIL_MODEL.version });
        s.made.set(id, snap);
      }
      out.push(snap);
    }
  }
  for (const r of reads) out.push(metas.has(r) ? r : mark(r, { kind: 'measured', model: TRAIL_MODEL.version }));
  out.sort((a, b) => a.time - b.time);
  s.out = out;
  s.full = s.raw.size > 0 || out.some(x => metas.get(x)?.kind === 'held');
  s.cost.ms += performance.now() - t0;
  ring(s.key);
}

function stateOf(t: string, cut: string | null): NameTrail {
  const day = nyIsoDate();
  const key = `${t}|${cut ?? 'all'}`;
  let s = trails.get(key);
  if (!s || s.day !== day) {
    s = { key, t, day, cut, bars: [], reads: [], raw: new Map(), cals: new Map(), made: new Map(), pastSnaps: new Map(), out: [], full: false, cost: { ms: 0, calls: 0, minutes: 0 } };
    trails.set(key, s);
  }
  return s;
}

/** Hand a name's inputs to its field: the bars and the books read */
function feed(t: string, cut: string | null, bars: readonly Candle[], reads: readonly GexSnapshot[]) {
  const s = stateOf(t, cut);
  let changed = false;
  if (s.bars !== bars) {
    s.bars = bars;
    changed = true;
  }
  if (s.reads !== reads) {
    s.reads = reads;
    changed = true;
  }
  if (hidden()) return;
  const c = chainOf(t, s.day);
  const hasToday = dayBars(s.bars, s.day).length > 0;
  const due =
    c.state === 'idle' ||
    (c.state === 'ok' && nySessionPhase() === 'open' && Date.now() - c.at > CHAIN_REFRESH_MS) ||
    (c.state === 'failed' && Date.now() - c.at > 5 * 60_000);
  if (hasToday && due) {
    const before = c.calls;
    void loadChain(t, c, s.day).then(() => (s.cost.calls += c.calls - before));
  }
  pumpPast(s);
  if (changed) {
    rebuildOut(s);
    schedule();
  }
}

const EMPTY: GexSnapshot[] = [];

export interface TrailField {
  snaps: GexSnapshot[];
  /** Today's minutes are rebuilt, or the sessions before are in */
  full: boolean;
  /** The chain could not be read — the field is the books read, and the sessions before */
  chainFailed: boolean;
}

/**
 * Terrain's strike field on the feed: the sessions before (UW's book for each date, held), today's minutes rebuilt from
 * the chain and scaled to the newest book read at or before each, and the books read in their own minutes — oldest
 * first. `cut` is one listed date, or null for every expiry. `on` false (the house's market, an index) asks nothing
 * and hands back the books read as they are.
 */
export function useFeedTrailField(on: boolean, ticker: string, bars: readonly Candle[] | null, reads: readonly GexSnapshot[], cut: string | null = null): TrailField {
  const t = ticker.toUpperCase();
  const live = on && !!t && !!bars;
  const key = `${t}|${cut ?? 'all'}`;
  useEffect(() => {
    if (!live || !bars) return;
    feed(t, cut, bars, reads);
  }, [live, t, cut, bars, reads]);
  const snaps = useSyncExternalStore(
    fn => {
      const set = subs.get(key) ?? new Set();
      set.add(fn);
      subs.set(key, set);
      if (live) schedule();
      return () => set.delete(fn);
    },
    () => (live ? trails.get(key)?.out ?? EMPTY : EMPTY)
  );
  if (!live) return { snaps: reads as GexSnapshot[], full: false, chainFailed: false };
  const s = trails.get(key);
  const c = chains.get(`${t}|${nyIsoDate()}`);
  return { snaps: snaps.length || cut ? snaps : (reads as GexSnapshot[]), full: !!s?.full, chainFailed: c?.state === 'failed' };
}

/** What a name's field has cost so far (the checks read it off window.__slayerTrail) */
export function trailCost(ticker: string, cut: string | null = null): NameTrail['cost'] | null {
  return trails.get(`${ticker.toUpperCase()}|${cut ?? 'all'}`)?.cost ?? null;
}
if (typeof window !== 'undefined')
  (window as unknown as { __slayerTrail?: unknown }).__slayerTrail = {
    cost: trailCost,
    size: (t: string) => trails.get(`${t.toUpperCase()}|all`)?.out.length ?? 0,
    kinds: (t: string) => {
      const out = trails.get(`${t.toUpperCase()}|all`)?.out ?? [];
      const n: Record<string, number> = {};
      for (const x of out) {
        const k = metas.get(x)?.kind ?? 'house';
        n[k] = (n[k] ?? 0) + 1;
      }
      return n;
    },
    model: TRAIL_MODEL,
  };
