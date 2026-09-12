import Simulator from '../core/simulator';
import type { GexSnapshot } from '../types/market';

/*
==================================================
  SLAYER TERMINAL - NET GEX THROUGH TIME (data/gexSeries.ts)

  The total, as a series and as a rank — P-3 and P-7.
==================================================

  ONE ENGINE FOR BOTH, because they are two readings of the same number.
  P-3 asks how today's total net dealer gamma MOVED — Wall Drift shows where
  the levels went; this shows whether the gamma behind them grew or drained,
  which is what decides whether the day is pinned or trending. P-7 asks how
  today's total COMPARES — "-$1.4B" means nothing to a reader who has not
  seen a thousand of these, and "the 8th percentile of this book's history"
  means everything, immediately.

  THE DEPTH IS PART OF THE ANSWER, not a footnote. The simulator seeds 22
  sessions, so the percentile is against 22 sessions and SAYS so — the
  directive's sketch says "2yr" because UW's history goes back that far, and
  when the seam is swapped the label follows the data. Printing "2yr" over a
  22-session distribution would be a number the app cannot source, which is
  the one thing no surface here is allowed to do.

  THE SIGN CONVENTION RIDES ALONG UNTOUCHED: positive = put-dominant =
  dealers short gamma = amplify, as everywhere else. The zero crossing of
  this series is the WHOLE BOOK changing sign — rarer and heavier than spot
  crossing the flip, and marked for exactly that reason.
*/

export interface NetGexPoint {
  time: number;
  /** Total net dealer gamma across the book at that bar, in dollars. */
  netGex: number;
  /** Spot at the same bar, for the second axis. */
  spot: number;
}

export interface NetGexSeries {
  points: NetGexPoint[];
  /** Where the total crossed zero today — indexes into `points`, the bar the
      sign changed ON. The whole book changing sign, not spot vs the flip. */
  zeroCrossings: number[];
  min: number;
  max: number;
}

export interface GexPercentile {
  /** 0..100 — the share of history at or below today's total. */
  pctile: number;
  /** How much history that rank is against, in sessions — the label's depth.
      A rank against a week means less than one against two years, and the
      reader is told which they are getting. */
  sessions: number;
  samples: number;
}

/* One RTH session of 1-minute bars — the simulator's session shape. */
const SESSION_BARS = 390;

/* Sampled every 3rd bar, the same stride Wall Drift reads its timeline at
   (data/vannacharm.ts DRIFT_STEP): the two panels sit side by side and answer
   per-moment questions about the same session, so they sample it alike. */
const STEP = 3;

/* Below this many samples a percentile is a coin toss wearing a number —
   reported as null and rendered as absent rather than as a rank. */
const MIN_SAMPLES = 60;

const totalOf = (snap: GexSnapshot): number => {
  let t = 0;
  for (const l of snap.levels) t += l.value;
  return t;
};

/** Today's total net GEX, per sampled bar, with spot alongside — P-3. */
export function buildNetGexSeries(ticker: string): NetGexSeries {
  const candles = Simulator.getCandles(ticker);
  const snaps = Simulator.getGexHistory(ticker);
  const empty: NetGexSeries = { points: [], zeroCrossings: [], min: 0, max: 0 };
  if (!candles?.length || !snaps?.length) return empty;

  const n = Math.min(SESSION_BARS, candles.length, snaps.length);
  const candleTail = candles.slice(candles.length - n);
  const snapTail = snaps.slice(snaps.length - n);

  const points: NetGexPoint[] = [];
  for (let i = 0; i < n; i += STEP) {
    /* Aligned tails, verified per bar — same guard as the flip gauge: a
       mismatched minute contributes nothing rather than a wrong pair. */
    if (candleTail[i].time !== snapTail[i].time) continue;
    points.push({ time: snapTail[i].time, netGex: totalOf(snapTail[i]), spot: candleTail[i].close });
  }
  if (points.length === 0) return empty;

  const zeroCrossings: number[] = [];
  let min = points[0].netGex;
  let max = points[0].netGex;
  for (let i = 0; i < points.length; i++) {
    min = Math.min(min, points[i].netGex);
    max = Math.max(max, points[i].netGex);
    if (i > 0 && Math.sign(points[i].netGex) !== Math.sign(points[i - 1].netGex) && points[i - 1].netGex !== 0) {
      zeroCrossings.push(i);
    }
  }
  return { points, zeroCrossings, min, max };
}

/**
 * Today's total against the WHOLE history the store holds — P-7.
 *
 * Percentile of `current` among every sampled bar's total, all sessions. The
 * definition is "share at or below", so a deeply negative (call-dominant,
 * absorbing) day ranks LOW and a put-heavy one ranks HIGH — the same axis the
 * sign convention already gives every other surface.
 */
export function buildGexPercentile(ticker: string, current: number): GexPercentile | null {
  const snaps = Simulator.getGexHistory(ticker);
  if (!snaps?.length) return null;

  let atOrBelow = 0;
  let samples = 0;
  for (let i = 0; i < snaps.length; i += STEP) {
    const t = totalOf(snaps[i]);
    samples++;
    if (t <= current) atOrBelow++;
  }
  if (samples < MIN_SAMPLES) return null;

  return {
    pctile: (atOrBelow / samples) * 100,
    sessions: Math.max(1, Math.round(snaps.length / SESSION_BARS)),
    samples,
  };
}

/** `8th` · `43rd` · `91st` — the suffix a rank wears. */
export function ordinal(pct: number): string {
  const p = Math.round(pct);
  const mod100 = p % 100;
  const mod10 = p % 10;
  const suffix = mod100 >= 11 && mod100 <= 13 ? 'th' : mod10 === 1 ? 'st' : mod10 === 2 ? 'nd' : mod10 === 3 ? 'rd' : 'th';
  return `${p}${suffix}`;
}
