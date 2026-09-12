import { sessionStarts } from './indicators';
import type { Candle } from '../types/market';

/*
==================================================
  SLAYER TERMINAL - DISTANCE SCALES (data/atr.ts)

  ATR and the one-day implied move — T-19's
  engine, the two rulers behind the unit toggle.
==================================================

  "The call wall is 14 points away" means nothing across tickers; "0.4 ATR
  away" means the same thing on SPY and on NVDA. And σ-DISTANCE — how many
  implied moves — is the version that matters for options: it is the same
  yardstick the expected-move cone draws, folded to one day.

  ATR IS WILDER'S, ON SESSIONS. True range per session against the prior
  session's close (the overnight gap counts — that is the whole reason TR
  exists over plain high−low), seeded with the arithmetic mean of the first
  period, then smoothed atr = (atr·(p−1) + tr) / p. Sessions come from the
  same gap cut every session feature uses (sessionStarts), and the CURRENT,
  still-forming session is excluded — a half-day's range read as a day's
  would understate the ruler exactly when the reader leans on it.

  σ IS ONE SESSION OF THE FEED'S QUOTED VOL: spot · iv · √(1/252) — the
  same annualized figure every options surface quotes, divided down to a
  single trading day of the same 252-session year T-1's annualization and
  T-9's cone already use. Three engines, one definition of a year.

  Both report NULL when they cannot be measured — too few sessions, no vol
  — and every caller renders absence, never a guess.
*/

export const ATR_PERIOD = 14;
export const TRADING_DAYS = 252;

/** One session's OHLC, folded from base bars. */
interface SessionBar {
  high: number;
  low: number;
  close: number;
}

function foldSessions(bars1m: readonly Candle[]): SessionBar[] {
  if (bars1m.length === 0) return [];
  const starts = sessionStarts(bars1m, 1);
  const out: SessionBar[] = [];
  for (let s = 0; s < starts.length; s++) {
    const from = starts[s];
    const to = s + 1 < starts.length ? starts[s + 1] : bars1m.length;
    let high = -Infinity;
    let low = Infinity;
    for (let i = from; i < to; i++) {
      if (bars1m[i].high > high) high = bars1m[i].high;
      if (bars1m[i].low < low) low = bars1m[i].low;
    }
    out.push({ high, low, close: bars1m[to - 1].close });
  }
  return out;
}

/**
 * Wilder's ATR over completed sessions, in dollars.
 *
 * Needs `period + 1` COMPLETED sessions (the first true range consumes one
 * as its prior close); the still-forming last session is dropped before
 * anything is measured. Null until the tape can afford that.
 */
export function sessionAtr(bars1m: readonly Candle[], period = ATR_PERIOD): number | null {
  const sessions = foldSessions(bars1m);
  /* The last session is the one still printing — off the ruler. */
  const done = sessions.slice(0, -1);
  if (period < 1 || done.length < period + 1) return null;

  const tr = (cur: SessionBar, prevClose: number): number =>
    Math.max(cur.high - cur.low, Math.abs(cur.high - prevClose), Math.abs(cur.low - prevClose));

  let atr = 0;
  for (let i = 1; i <= period; i++) atr += tr(done[i], done[i - 1].close);
  atr /= period;
  for (let i = period + 1; i < done.length; i++) {
    atr = (atr * (period - 1) + tr(done[i], done[i - 1].close)) / period;
  }
  return atr;
}

/** One trading day of the quoted annualized vol, in dollars. */
export function impliedDaySigma(spot: number, iv: number): number | null {
  if (!(spot > 0) || !(iv > 0)) return null;
  return spot * iv * Math.sqrt(1 / TRADING_DAYS);
}

export type DistanceUnit = '$' | '%' | 'ATR' | 'σ';
export const DISTANCE_UNITS: DistanceUnit[] = ['$', '%', 'ATR', 'σ'];

export interface DistanceScales {
  /** Wilder ATR of completed sessions, $ — null under warmup. */
  atr: number | null;
  /** One-day implied 1σ move, $ — null without a quoted vol. */
  sigma: number | null;
}

/**
 * A signed distance, worded in the chosen unit.
 *
 * ATR and σ render to two decimals — 0.4 ATR and 0.38 ATR are different
 * readings — and fall back to an em-dash when their ruler is null: absence,
 * never a number the app cannot source.
 */
export function fmtDistance(deltaAbs: number, spot: number, unit: DistanceUnit, scales: DistanceScales): string {
  const sign = deltaAbs < 0 ? '−' : '+';
  const a = Math.abs(deltaAbs);
  if (unit === '$') return `${sign}$${a.toFixed(2)}`;
  if (unit === '%') return spot > 0 ? `${sign}${((a / spot) * 100).toFixed(2)}%` : '—';
  if (unit === 'ATR') return scales.atr !== null && scales.atr > 0 ? `${sign}${(a / scales.atr).toFixed(2)} ATR` : '— ATR';
  return scales.sigma !== null && scales.sigma > 0 ? `${sign}${(a / scales.sigma).toFixed(2)}σ` : '— σ';
}
