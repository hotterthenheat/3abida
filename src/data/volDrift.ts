import type { Candle } from '../types/market';

/*
==================================================
  SLAYER TERMINAL - THE VOLATILITY DRIFT
  (data/volDrift.ts)

  Two volatility lines under the tape: what the
  underlying is ACTUALLY doing (realised), and what
  the option market says it expects (implied). The
  distance between them is the whole trade — implied
  above realised is a premium seller's session,
  realised catching up to implied is where short
  gamma starts to hurt.

  ----------------------------------------------
  WHERE EACH NUMBER COMES FROM. Read this before
  trusting either line.

  REALISED is MEASURED, here, from the same
  aggregated bars the tape draws. Rolling standard
  deviation of log returns, annualised. It moves
  because the price moved, and it agrees with the
  candles above it because it is computed from them.

  IMPLIED is REPORTED by the feed. This module does
  not model it, smile it, or interpolate it — it
  takes the number handed to it and puts it on the
  axis. In the current simulator that number is a
  per-ticker CONSTANT, so the implied line draws
  FLAT. That is not a bug in this module and it is
  not a placeholder pretending to be live: it is the
  feed's honest answer, and it will start moving the
  day a real implied series is wired to the same
  seam. Nothing here fabricates movement to make the
  pane look busier than the data behind it.
  ----------------------------------------------

  THE ANNUALISATION AND THE WINDOW ARE ASSUMPTIONS,
  and they are gathered into RV_MODEL below so the
  real math file can replace them in one place
  rather than hunting them through a chart effect.
==================================================
*/

/**
 * The realised-vol convention this module ships with.
 *
 * Close-to-close over a rolling window, annualised on TRADING time — 252
 * sessions of 6.5 hours, not 365 days of 24. Annualising intraday returns on
 * calendar time counts the overnight hours as periods in which the price could
 * have moved, and it could not, which quietly halves the number.
 *
 * Replaceable wholesale. Everything downstream reads these three fields.
 */
export const RV_MODEL = {
  /** Bars in the rolling sample. 30 on a 1m clock is half an hour. */
  window: 30,
  /** Trading sessions per year. */
  sessionsPerYear: 252,
  /** Seconds in a regular US equity session — 09:30 to 16:00. */
  sessionSeconds: 6.5 * 3600,
} as const;

/** One instant on a volatility line. */
export interface VolPoint {
  /** Bar-aligned epoch SECONDS — lightweight-charts' unit. */
  time: number;
  /** Volatility as a PERCENT (7.68 means 7.68%), the axis's unit. */
  value: number;
}

/**
 * How many sample periods a year holds at this bar width.
 *
 * Two regimes, because `barSec` means two different things either side of the
 * session length. An intraday bar is a slice OF a session, so a session holds
 * `sessionSeconds / barSec` of them. A daily or weekly bar is a whole number of
 * SESSIONS wearing a calendar span — and the calendar span is the trap: a daily
 * bar covers 86,400 seconds of clock but one session of trading, and a weekly
 * bar covers 604,800 seconds of clock but five. Scaling a daily bar by its
 * calendar seconds annualises it at 68 periods a year instead of 252 and quotes
 * realised vol at roughly half its true value.
 *
 * The 5/7 turns calendar days into sessions. `Math.max(1, …)` holds the daily
 * bar at exactly one session, which is what it is.
 */
export function periodsPerYear(barSec: number): number {
  const sec = Math.max(1, barSec);
  if (sec < RV_MODEL.sessionSeconds) {
    return RV_MODEL.sessionsPerYear * (RV_MODEL.sessionSeconds / sec);
  }
  const sessionsPerBar = Math.max(1, (sec / 86_400) * (5 / 7));
  return RV_MODEL.sessionsPerYear / sessionsPerBar;
}

/**
 * Rolling annualised realised volatility, in percent, one point per bar.
 *
 * The first `window` bars produce NO points. A shorter window would let the
 * line start at bar two on a sample of one return, where the standard
 * deviation is zero by construction — a confident 0% that is an artifact of
 * having no data, drawn at the exact left edge a reader anchors on.
 *
 * Overnight gaps are dropped from the sample rather than counted as returns.
 * A 1m realised-vol reading that includes the gap between 16:00 and 09:30 is
 * measuring the gap, not the minute, and one of those in the window dominates
 * every other return in it.
 */
export function realizedVol(bars: readonly Candle[], barSec: number): VolPoint[] {
  const window = Math.max(2, Math.floor(RV_MODEL.window));
  if (bars.length <= window) return [];

  const scale = Math.sqrt(periodsPerYear(barSec)) * 100;
  /*
    THE OVERNIGHT TEST IS INTRADAY-ONLY.

    A gap wider than 1.5 bars is a session break on an intraday clock — the same
    test the VWAP anchor uses, so the two agree on where a session starts. On a
    DAILY clock the same test would throw away every Friday-to-Monday step,
    which is 20% of the sample and a perfectly ordinary daily return; on a
    weekly clock it would throw away every holiday week. At or above the session
    length, consecutive bars ARE consecutive sessions — `aggregateCandles` only
    emits buckets that hold data — so there is no break to find.
  */
  const gapSec = barSec < RV_MODEL.sessionSeconds ? barSec * 1.5 : Infinity;

  /* returns[i] belongs to bars[i + 1]; null where the step crossed a break. */
  const returns: (number | null)[] = [];
  for (let i = 1; i < bars.length; i++) {
    const prev = bars[i - 1];
    const cur = bars[i];
    if (cur.time - prev.time > gapSec) {
      returns.push(null);
      continue;
    }
    if (!(prev.close > 0) || !(cur.close > 0)) {
      returns.push(null);
      continue;
    }
    returns.push(Math.log(cur.close / prev.close));
  }

  const out: VolPoint[] = [];
  for (let end = window; end <= returns.length; end++) {
    const sample: number[] = [];
    for (let i = end - window; i < end; i++) {
      const r = returns[i];
      if (r !== null && Number.isFinite(r)) sample.push(r);
    }
    /* A window that lost most of itself to a session break is not reported.
       Two surviving returns would produce a number, and it would be a number
       about two minutes wearing the label of a thirty-minute window. */
    if (sample.length < Math.ceil(window / 2)) continue;

    let mean = 0;
    for (const r of sample) mean += r;
    mean /= sample.length;
    let sq = 0;
    for (const r of sample) sq += (r - mean) * (r - mean);
    /* Sample variance, n-1: the mean was estimated from the same sample, and
       dividing by n understates the spread. */
    const variance = sq / (sample.length - 1);
    const value = Math.sqrt(variance) * scale;
    if (!Number.isFinite(value)) continue;
    out.push({ time: bars[end].time, value });
  }
  return out;
}

/**
 * The implied line, as REPORTED — one flat-held reading carried across the
 * bars the realised line covers.
 *
 * `iv` arrives as a fraction (0.15) and leaves as a percent (15), because that
 * is the axis both lines share. A feed that reports nothing draws nothing.
 *
 * When a real implied SERIES lands, this function is what it replaces: the
 * chart asks for points over a span and does not care whether they came from
 * one constant or ten thousand quotes.
 */
export function impliedVolLine(iv: number | null | undefined, over: readonly VolPoint[]): VolPoint[] {
  if (typeof iv !== 'number' || !Number.isFinite(iv) || iv <= 0) return [];
  const pct = iv * 100;
  return over.map(p => ({ time: p.time, value: pct }));
}

/** The top of the shared axis, with a little air. Zero when there is nothing. */
export function volCeiling(...series: readonly VolPoint[][]): number {
  let max = 0;
  for (const s of series) for (const p of s) if (p.value > max) max = p.value;
  return max > 0 ? max * 1.1 : 0;
}
