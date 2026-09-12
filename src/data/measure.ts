import { RTH_MINUTES } from '../core/calendar';

/*
==================================================
  SLAYER TERMINAL - THE MEASURE (data/measure.ts)

  What a drag across the tape actually says — T-1.
==================================================

  Δ$ · Δ% · bars · elapsed · annualized, from two points and the interval they
  were taken on. No React, no chart, no clock: everything comes from the two
  bar times handed in, so a proof and a replay measure the same span the
  pointer does.

  WHY THE ANNUALIZED FIGURE IS THE POINT OF THE TOOL. A 0DTE reader sizing a
  move is asking one question — is this move already the whole move the
  options were charging for? Implied volatility is quoted annualized, so the
  only way to answer it is to put the realised move on the same footing. Δ%
  alone cannot: two percent in ten minutes and two percent in a week are the
  same number and nothing like the same event.

  IT IS TRADING TIME, NOT WALL-CLOCK TIME, and that is the decision this file
  exists to hold. A span from Friday's close to Monday's open is three bars
  and about sixty-five hours; annualizing on the sixty-five would divide the
  move by the weekend and report a fifth of the volatility that actually
  happened. Bars only exist while the market is open, so bars × the interval
  IS the trading time, and the wall clock is reported separately as the
  human-readable elapsed rather than fed into the maths.

  A YEAR IS 252 SESSIONS OF `RTH_MINUTES`, and the session length comes from
  the calendar rather than from a 6.5 typed here — the same constant the charm
  clock reads, for the same reason: the Globex work (T-16) makes a hardcoded
  6.5 wrong everywhere at once, and one constant means one edit.
*/

/** Sessions in a year. The market's own count, not 365 and not 260. */
export const TRADING_DAYS = 252;

/** Trading minutes in a year — the denominator the annualization divides by. */
export const YEAR_MINUTES = TRADING_DAYS * RTH_MINUTES;

export interface MeasureSpan {
  /** Signed, in price. */
  deltaAbs: number;
  /** Signed, in percent of the FROM price. */
  deltaPct: number;
  /** Bars crossed. A drag inside one bar is 0, not 1. */
  bars: number;
  /** Wall-clock seconds between the two bar times, for the human reading. */
  elapsedSec: number;
  /** Trading minutes — bars × the interval. What the annualization uses. */
  tradingMin: number;
  /**
   * The move at an annual rate, in percent, or null when it cannot be stated.
   *
   * Null rather than Infinity or a large number on a zero-length span: a drag
   * that has not left its bar has no elapsed time to divide by, and "the
   * annualized move is 400,000%" is a worse answer than "not yet".
   */
  annualizedPct: number | null;
}

/**
 * The span between two points on a chart of `barMinutes` bars.
 *
 * `fromTime`/`toTime` are bar times in epoch seconds; they may arrive in
 * either order, because a reader drags both ways and neither direction is
 * backwards. The SIGN of the move follows time, never the drag: dragging
 * right-to-left across a rally still reports a rise.
 */
export function measureSpan(
  fromTime: number,
  fromPrice: number,
  toTime: number,
  toPrice: number,
  barMinutes: number
): MeasureSpan {
  /* Ordered by TIME so the sign is the market's, not the pointer's. */
  const backwards = toTime < fromTime;
  const t0 = backwards ? toTime : fromTime;
  const t1 = backwards ? fromTime : toTime;
  const p0 = backwards ? toPrice : fromPrice;
  const p1 = backwards ? fromPrice : toPrice;

  const deltaAbs = p1 - p0;
  const deltaPct = p0 !== 0 ? (deltaAbs / Math.abs(p0)) * 100 : 0;
  const elapsedSec = Math.max(0, t1 - t0);
  /* barMinutes is taken AS GIVEN, fractions included — 0.25 is the 15s
     tape, and clamping it up to 1 counted four of its bars as one. Zero
     means the host has NO bar clock (T-15's rule bars): no step to count,
     so the elapsed stamps carry the time directly. */
  const step = barMinutes > 0 ? barMinutes * 60 : 0;
  /* FLOOR, not round: this counts bar steps COMPLETED, and half a bar is
     none of them. Rounding read a thirty-second drag on 1-minute bars as a
     whole bar and gave it an annualized rate off time that had not passed.
     Bar-snapped endpoints — which is every drag the chart actually produces —
     land on exact multiples either way, so this only ever decides the
     sub-bar case, and 0 is the honest answer there. */
  const bars = step > 0 ? Math.floor(elapsedSec / step) : 0;
  const tradingMin = step > 0 ? bars * barMinutes : elapsedSec / 60;

  const years = tradingMin / YEAR_MINUTES;
  const annualizedPct = years > 0 && Number.isFinite(deltaPct) ? Math.abs(deltaPct) / Math.sqrt(years) : null;

  return { deltaAbs, deltaPct, bars, elapsedSec, tradingMin, annualizedPct };
}

/**
 * Elapsed, for a person: `3h 24m`, `12m`, `2d 1h`.
 *
 * DAYS ARE SESSIONS here, not 24-hour days — the span is trading time and a
 * reader counting "two days" on a chart means two sessions. Reported off
 * `tradingMin` for that reason, so it agrees with the bar count beside it
 * rather than with a wall clock that spent the night closed.
 */
export function fmtElapsed(tradingMin: number): string {
  if (tradingMin <= 0) return '0m';
  const perDay = RTH_MINUTES;
  const days = Math.floor(tradingMin / perDay);
  const rest = tradingMin - days * perDay;
  const hours = Math.floor(rest / 60);
  const mins = Math.round(rest - hours * 60);
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  return `${mins}m`;
}
