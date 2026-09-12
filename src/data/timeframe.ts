/*
  Timeframe aggregation — rolls the simulator's 1-minute base bars (and the
  parallel GEX snapshots) up to the selected interval. Both keep bar-aligned,
  matching timestamps so the on-chart node overlay stays pinned to price/time.
*/

import type { Candle, GexSnapshot } from '../types/market';

export type Timeframe = '15s' | '1m' | '5m' | '15m' | '30m' | '1h' | '1D' | '1W';

/*
  T-14 — SUB-MINUTE, honestly. `minutes` goes FRACTIONAL below one minute
  (15s = 0.25) so every consumer that multiplies by 60 keeps working in
  seconds without a second unit system. The 15s row is served from the
  simulator's live-only seconds tape (one tick = one quarter-bar), never by
  resampling 1m history — a sub-minute label on resampled minutes would be
  a different instrument wearing the same name, the exact thing the
  directive rules out. The region before the app connected is EMPTY and the
  pane says so.

  1s AND 5s WAIT FOR THE FEED, deliberately: the seam's finest real
  observation is one tick per quarter-minute, so a 1s row today would be
  invention, and this desk does not ship pickers whose data cannot exist.
  When the per-second WebSocket lands they are one row each here.
*/
export const TIMEFRAMES: { value: Timeframe; label: string; minutes: number }[] = [
  { value: '15s', label: '15s', minutes: 0.25 },
  { value: '1m', label: '1m', minutes: 1 },
  { value: '5m', label: '5m', minutes: 5 },
  { value: '15m', label: '15m', minutes: 15 },
  { value: '30m', label: '30m', minutes: 30 },
  { value: '1h', label: '1h', minutes: 60 },
  { value: '1D', label: '1D', minutes: 1440 },
  { value: '1W', label: '1W', minutes: 10080 },
];

/** Node overlay is an intraday feature — hidden at daily/weekly. */
export const INTRADAY_MAX_MINUTES = 60;

export function tfMinutes(tf: Timeframe): number {
  return TIMEFRAMES.find(t => t.value === tf)?.minutes ?? 1;
}

/*
  INCREMENTAL, NOT FROM SCRATCH (2026-09-06, the perf sweep). Both folds ran
  over the whole store on every call — 8,580 bars, or 8,580 snapshots × 61
  strikes — and every chart called them on every tick and on every mount:
  250ms of the Terrain's open, 60ms on the Map's, and a slice of every idle
  frame. The store is APPEND-ONLY except for its last element (the forming
  bar, the live snapshot), so each base array keeps, per interval, the
  buckets already closed and how far into the base they reach; a call folds
  only what arrived since and rebuilds the one open bucket. A base whose
  front moved (the cap trimming old history) starts over.
*/
interface CandleFold {
  closed: Candle[];
  folded: number; // base entries whose bucket is closed
  firstRef: Candle | undefined;
  lastRef: Candle | undefined; // base[folded - 1] when the fold was taken
}
const candleFolds = new WeakMap<Candle[], Map<number, CandleFold>>();

/** Aggregate 1m OHLC bars into buckets of `minutes`. The base contract is
    ONE-MINUTE bars: sub-minute timeframes never come through here — they
    read the seconds tape directly (see the T-14 note above), so `<= 1`
    correctly means "already at or below the base grid". */
export function aggregateCandles(base: Candle[], minutes: number): Candle[] {
  if (minutes <= 1 || base.length === 0) return base;
  const bucketSec = minutes * 60;
  let byMin = candleFolds.get(base);
  if (!byMin) {
    byMin = new Map();
    candleFolds.set(base, byMin);
  }
  let fold = byMin.get(minutes);
  const stale = !fold || fold.folded > base.length || fold.firstRef !== base[0] || (fold.folded > 0 && fold.lastRef !== base[fold.folded - 1]);
  if (stale) fold = { closed: [], folded: 0, firstRef: base[0], lastRef: undefined };
  const f = fold!;
  /* Fold the closed buckets that arrived since; the open (last) bucket is
     rebuilt every call because its bars still move. */
  let cur: Candle | null = null;
  let curBucket = -1;
  let curStart = f.folded;
  for (let i = f.folded; i < base.length; i++) {
    const b = base[i];
    const bucket = Math.floor(b.time / bucketSec) * bucketSec;
    if (bucket !== curBucket) {
      if (cur) {
        f.closed.push(cur);
        f.folded = i;
        f.lastRef = base[i - 1];
      }
      cur = { time: bucket, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume };
      curBucket = bucket;
      curStart = i;
    } else if (cur) {
      cur.high = Math.max(cur.high, b.high);
      cur.low = Math.min(cur.low, b.low);
      cur.close = b.close;
      cur.volume += b.volume;
    }
  }
  void curStart;
  byMin.set(minutes, f);
  return cur ? [...f.closed, cur] : f.closed.slice();
}

interface SnapFold {
  closed: GexSnapshot[];
  closedMax: number;
  folded: number;
  firstRef: GexSnapshot | undefined;
  lastRef: GexSnapshot | undefined;
}
const snapFolds = new WeakMap<GexSnapshot[], Map<number, SnapFold>>();
/** The largest |value| of an aggregated array, remembered beside it */
const maxAbsOf = new WeakMap<GexSnapshot[], number>();

/*
  THE PEAK MERGE. A snapshot's levels come off the chain in strike order and
  neighbouring snapshots share almost the whole grid, so a bucket's peaks are
  kept as two parallel sorted arrays and each snapshot is MERGED in one
  linear pass — no hashing, no Map churn. The first fold of a 22-session
  store (8,580 snapshots × 61 strikes) went from ~210ms to a few tens.
*/
interface Peaks {
  strikes: number[];
  values: number[];
  abs: number[];
  /* Delta and vega exposure ride along (2026-09-06: the trails follow the
     head's Greek), each keeping ITS OWN peak per strike */
  dex: number[];
  vex: number[];
}
const newPeaks = (): Peaks => ({ strikes: [], values: [], abs: [], dex: [], vex: [] });
const mergePeaks = (p: Peaks, levels: readonly { strike: number; value: number; dex?: number; vex?: number }[]): void => {
  const ps = p.strikes;
  const pv = p.values;
  const pa = p.abs;
  const pd = p.dex;
  const px = p.vex;
  if (ps.length === 0) {
    for (let j = 0; j < levels.length; j++) {
      const l = levels[j];
      ps.push(l.strike);
      pv.push(l.value);
      pa.push(Math.abs(l.value));
      pd.push(l.dex ?? 0);
      px.push(l.vex ?? 0);
    }
    return;
  }
  /* Both sides sorted ascending, IN PLACE: a strike already here keeps the
     larger |value|; a strike the grid has drifted onto is spliced in — one
     or two a bar, never more, so the pass is linear and allocates nothing. */
  let i = 0;
  for (let j = 0; j < levels.length; j++) {
    const l = levels[j];
    const k = l.strike;
    while (i < ps.length && ps[i] < k) i++;
    if (i < ps.length && ps[i] === k) {
      const a = Math.abs(l.value);
      if (a > pa[i]) {
        pv[i] = l.value;
        pa[i] = a;
      }
      const d = l.dex ?? 0;
      if (Math.abs(d) > Math.abs(pd[i])) pd[i] = d;
      const v = l.vex ?? 0;
      if (Math.abs(v) > Math.abs(px[i])) px[i] = v;
    } else {
      ps.splice(i, 0, k);
      pv.splice(i, 0, l.value);
      pa.splice(i, 0, Math.abs(l.value));
      pd.splice(i, 0, l.dex ?? 0);
      px.splice(i, 0, l.vex ?? 0);
    }
    i++;
  }
};
const peakLevels = (p: Peaks) => {
  const out = new Array<{ strike: number; value: number; dex: number; vex: number }>(p.strikes.length);
  for (let k = 0; k < p.strikes.length; k++) out[k] = { strike: p.strikes[k], value: p.values[k], dex: p.dex[k], vex: p.vex[k] };
  return out;
};
const peaksMax = (p: Peaks) => {
  let m = 0;
  for (const a of p.abs) if (a > m) m = a;
  return m;
};

/** True when the store has already been folded to this interval — a cold
    fold is the one cost worth moving off a mount frame. */
export function isFolded(base: GexSnapshot[], minutes: number): boolean {
  if (base.length === 0 || minutes <= 1) return true;
  const f = snapFolds.get(base)?.get(minutes);
  return !!f && f.folded > base.length - minutes * 2;
}

/** The fold for (base, minutes) — fresh when the store's front moved or the fold ran past it */
function foldFor(base: GexSnapshot[], minutes: number): SnapFold {
  let byMin = snapFolds.get(base);
  if (!byMin) {
    byMin = new Map();
    snapFolds.set(base, byMin);
  }
  let fold = byMin.get(minutes);
  const stale = !fold || fold.folded > base.length || fold.firstRef !== base[0] || (fold.folded > 0 && fold.lastRef !== base[fold.folded - 1]);
  if (stale) {
    fold = { closed: [], closedMax: 0, folded: 0, firstRef: base[0], lastRef: undefined };
    byMin.set(minutes, fold);
  }
  return fold!;
}

/** Advance a cold fold by at most `maxSnaps` snapshots of closed buckets — a
    slice of the work, for a chart that would rather not pay for the whole
    store in one task. True when nothing but the open bucket remains. */
export function foldSnapshotsSlice(base: GexSnapshot[], minutes: number, maxSnaps: number): boolean {
  if (base.length === 0 || minutes <= 1) return true;
  const bucketSec = minutes * 60;
  const f = foldFor(base, minutes);
  const stop = Math.min(base.length, f.folded + maxSnaps);
  let curBucket = -1;
  let peaks = newPeaks();
  let start = f.folded;
  for (let i = f.folded; i < stop; i++) {
    const snap = base[i];
    const bucket = Math.floor(snap.time / bucketSec) * bucketSec;
    if (bucket !== curBucket) {
      if (curBucket >= 0) {
        f.closed.push({ time: curBucket, levels: peakLevels(peaks) });
        f.closedMax = Math.max(f.closedMax, peaksMax(peaks));
        f.folded = i;
        f.lastRef = base[i - 1];
      }
      curBucket = bucket;
      peaks = newPeaks();
      start = i;
    }
    mergePeaks(peaks, snap.levels);
  }
  void start;
  /* The last bucket seen in this slice may continue past `stop`; it is left
     for the next slice (or the final call) to fold from `f.folded`. */
  return f.folded >= base.length - minutes * 2;
}

/** One snapshot per bucket — the PEAK per strike inside it, re-stamped to the bucket start. */
export function aggregateSnapshots(base: GexSnapshot[], minutes: number): GexSnapshot[] {
  if (base.length === 0 || minutes <= 1) return base;
  const bucketSec = minutes * 60;
  const f = foldFor(base, minutes);
  /* The bucket's node is its PEAK minute, per strike — the way a candle
     keeps its high and low, not its average. A mean flattened the ribbon's
     envelope into a smooth band; the jagged amplitude IS the texture
     (Noah, 2026-08-22, against Sovereign's close-ups). Signed by the peak's
     own side. */
  let curBucket = -1;
  let peaks = newPeaks();
  for (let i = f.folded; i < base.length; i++) {
    const snap = base[i];
    const bucket = Math.floor(snap.time / bucketSec) * bucketSec;
    if (bucket !== curBucket) {
      if (curBucket >= 0) {
        f.closed.push({ time: curBucket, levels: peakLevels(peaks) });
        f.closedMax = Math.max(f.closedMax, peaksMax(peaks));
        f.folded = i;
        f.lastRef = base[i - 1];
      }
      curBucket = bucket;
      peaks = newPeaks();
    }
    mergePeaks(peaks, snap.levels);
  }
  const out = f.closed.slice();
  let max = f.closedMax;
  if (curBucket >= 0) {
    out.push({ time: curBucket, levels: peakLevels(peaks) });
    max = Math.max(max, peaksMax(peaks));
  }
  maxAbsOf.set(out, Math.max(1, max));
  return out;
}

/** Largest |value| across all snapshot levels, for normalizing node intensity.
    Free for an array aggregateSnapshots just built; a scan otherwise. */
export function snapshotsMaxAbs(snaps: GexSnapshot[]): number {
  const known = maxAbsOf.get(snaps);
  if (known !== undefined) return known;
  let max = 1;
  for (const s of snaps) {
    for (const l of s.levels) {
      const a = Math.abs(l.value);
      if (a > max) max = a;
    }
  }
  maxAbsOf.set(snaps, max);
  return max;
}
