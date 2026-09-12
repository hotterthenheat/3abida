import { pickFlip, pickWalls } from '../core/walls';
import type { MarketSnapshot } from '../types/market';

/*
==================================================
  SLAYER TERMINAL - TWO-TICKER COMPARE
  (data/exposureCompare.ts) — P-22
==================================================

  SPX AGAINST SPY, OR SPY AGAINST QQQ. Structural divergence between an
  index and its ETF, or between two correlated indices, is a real signal and
  nothing in the product surfaces it: the two maps are drawn on different
  price axes and different dollar scales, so a reader flipping between tabs
  is comparing shapes by memory.

  ── THE NORMALIZATION, WHICH IS THE ENTIRE PROBLEM ───────────────────────

  Two things are incomparable here and both have to be fixed before a
  divergence read means anything:

  THE PRICE AXIS. A strike at 5,880 on SPX and one at 588 on SPY are the
  same level; a strike at 588 on QQQ is not. So strikes are placed in
  PERCENT FROM SPOT rather than in dollars — the one axis on which every
  instrument is the same instrument, and the one the twin lens already uses
  to relate a family's members.

  THE DOLLAR SCALE. SPX carries far more notional gamma than SPY, so an
  absolute comparison would say "SPX has more gamma" every time and mean
  nothing. Each book is normalized to a SHARE of its own total |gamma|, so
  what is compared is the SHAPE of the positioning rather than its size.

  DIVERGENCE IS THEN A REAL SUBTRACTION, bucket by bucket: two books that
  agree net to zero everywhere, and a bucket where one is call-heavy while
  the other is put-heavy shows up as a large signed difference. That is the
  signal — not "these numbers differ", which any two books would.

  BUCKETS, NOT RAW STRIKES, because the two names do not share a strike
  grid: SPX steps in 5s and SPY in 1s, so a strike-by-strike join would
  align almost nothing. A percent bucket is a band both books can land in.
*/

/** Half-width of a bucket, in percent from spot. */
export const BUCKET_PCT = 0.25;
/** How far either side of spot the comparison reaches. */
export const REACH_PCT = 5;

export interface CompareBucket {
  /** Bucket centre, percent from spot (negative = below). */
  pct: number;
  /** Each book's share of its own total |gamma| in this bucket, signed. */
  a: number;
  b: number;
  /** a − b. Large magnitude = the books disagree here. */
  divergence: number;
}

export interface ExposureCompare {
  tickerA: string;
  tickerB: string;
  buckets: CompareBucket[];
  /** Where the two books disagree most, and by how much. */
  widest: CompareBucket | null;
  /** Levels, in percent from each book's own spot — comparable at last. */
  levels: {
    a: { callWall: number | null; putWall: number | null; flip: number | null };
    b: { callWall: number | null; putWall: number | null; flip: number | null };
  };
  /** Total absolute divergence — one number for "how differently are these
      two books positioned", 0 = identical shapes. */
  totalDivergence: number;
}

const pctFromSpot = (strike: number, spot: number) => ((strike - spot) / spot) * 100;

/** A book's signed share-of-own-total per bucket. */
function shareBuckets(snap: MarketSnapshot, centres: number[]): number[] {
  const total = snap.chain.reduce((a, n) => a + Math.abs(n.netGex), 0);
  const out = new Array(centres.length).fill(0);
  if (total === 0) return out;
  for (const n of snap.chain) {
    const p = pctFromSpot(n.strike, snap.spot);
    /*
      Nearest bucket, and only if the strike genuinely LANDS in it: a strike
      30% away must not pile onto the edge bucket and invent a shelf there.

      The `bestD <= BUCKET_PCT` test below is the whole gate. An explicit
      reach check sat here first and was removed as dead code — for every
      possible input it agreed with the bucket test, which a mutation
      demonstrated by surviving its deletion. One gate, doing the work.
    */
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < centres.length; i++) {
      const d = Math.abs(centres[i] - p);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (bestD <= BUCKET_PCT) out[best] += n.netGex / total;
  }
  return out;
}

const levelsPct = (snap: MarketSnapshot) => {
  const w = pickWalls(snap.chain, snap.spot, n => n.netGex);
  const flip = pickFlip(snap.chain, snap.spot, n => n.netGex);
  return {
    callWall: w.callWall != null ? pctFromSpot(w.callWall, snap.spot) : null,
    putWall: w.putWall != null ? pctFromSpot(w.putWall, snap.spot) : null,
    flip: flip !== null ? pctFromSpot(flip, snap.spot) : null,
  };
};

export function buildExposureCompare(a: MarketSnapshot, b: MarketSnapshot): ExposureCompare | null {
  if (a.chain.length === 0 || b.chain.length === 0 || !(a.spot > 0) || !(b.spot > 0)) return null;

  const centres: number[] = [];
  for (let p = -REACH_PCT; p <= REACH_PCT + 1e-9; p += BUCKET_PCT * 2) centres.push(Number(p.toFixed(4)));

  const sa = shareBuckets(a, centres);
  const sb = shareBuckets(b, centres);

  let widest: CompareBucket | null = null;
  let totalDivergence = 0;
  const buckets: CompareBucket[] = centres.map((pct, i) => {
    const bucket = { pct, a: sa[i], b: sb[i], divergence: sa[i] - sb[i] };
    totalDivergence += Math.abs(bucket.divergence);
    if (!widest || Math.abs(bucket.divergence) > Math.abs(widest.divergence)) widest = bucket;
    return bucket;
  });

  return {
    tickerA: a.ticker,
    tickerB: b.ticker,
    buckets,
    widest,
    levels: { a: levelsPct(a), b: levelsPct(b) },
    totalDivergence,
  };
}

/** The divergence read, in words. */
export function compareWords(c: ExposureCompare): string {
  if (!c.widest || Math.abs(c.widest.divergence) < 0.02) {
    return `${c.tickerA} and ${c.tickerB} are positioned the same shape — no structural divergence worth trading.`;
  }
  const w = c.widest;
  const where = w.pct === 0 ? 'at spot' : `${Math.abs(w.pct).toFixed(2)}% ${w.pct > 0 ? 'above' : 'below'} spot`;
  const heavier = w.divergence > 0 ? c.tickerA : c.tickerB;
  const lighter = w.divergence > 0 ? c.tickerB : c.tickerA;
  return `${heavier} carries materially more of its gamma ${where} than ${lighter} does — the books disagree about where the level is.`;
}
