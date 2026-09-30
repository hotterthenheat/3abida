/*
==================================================
  SLAYER TERMINAL - THE POSITION CURVE
  (data/positionCurve.ts)

  The payoff sketch on a position card (the
  TradingView strategy-builder grammar Noah picked,
  2026-09-05): profit or loss across price for one
  contract, two lines —

    AT EXPIRY  the hard line: intrinsic value minus
               what it cost
    TODAY      the soft line: Black-Scholes value
               at each price with the sessions left,
               on the same smile the chain prices
               with, minus what it cost

  WHAT IT COST is the entry premium if the reader
  typed one; else the contract's mark the moment it
  was added (2026-09-16 — a day of decay must show
  on a position added yesterday); else, for a
  position stored before the mark was pinned,
  today's theoretical value at spot, so the sketch
  reads "if you bought it now". The card says
  which. Dollars are per contract × 100 ×
  contracts, signed by side (sold = the mirror
  image).

  The price range is the Map's window, so the walls
  and the flip the card draws on it land where the
  rail has them.
==================================================
*/

import { blackScholesPrice } from '../core/greeks';
import { sessionsBetween, today } from '../core/calendar';
import { contractIvFor } from './weigherDesk';
import type { Position } from './positions';

/** Where a position's cost comes from: typed by the reader, or the mark when it was added */
export type CostKind = 'entry' | 'added';

/** THE COST THE RETURN IS MEASURED FROM (2026-09-16): what the reader typed, else the contract's
    mark the moment it was added — null only for a position stored before the mark was pinned.
    Every reader of a position's profit goes through here (the curve, the list's rows). */
export function costOf(p: Pick<Position, 'entry' | 'addedMark'>): { value: number; kind: CostKind } | null {
  if (p.entry != null) return { value: p.entry, kind: 'entry' };
  if (p.addedMark != null) return { value: p.addedMark, kind: 'added' };
  return null;
}

export interface CurvePoint {
  price: number;
  /** Profit or loss at expiry, dollars */
  expiry: number;
  /** Profit or loss today, dollars */
  now: number;
}

export interface PositionCurve {
  points: CurvePoint[];
  lo: number;
  hi: number;
  /** Premium per contract the profit is measured from */
  ref: number;
  /** What `ref` is: what the reader paid · the mark when it was added · today's value */
  refKind: CostKind | 'now';
  /** Today's theoretical value per contract, premium points */
  valueNow: number;
  /** The price where the expiry line crosses zero */
  breakeven: number;
  /** Profit or loss if it expired at today's spot, dollars */
  atSpot: number;
  /** The most it can lose in the window, dollars (negative or zero) */
  worst: number;
  /** The most it can make in the window, dollars */
  best: number;
  /** Trading sessions left; 0 = expires today */
  sessions: number;
}

const SAMPLES = 72;

const intrinsic = (price: number, K: number, right: Position['right']) => (right === 'C' ? Math.max(0, price - K) : Math.max(0, K - price));

/** The contract's value per share at a price, `ahead` sessions from today (a fraction walks
    into a session) — the soft line's pricer, exported for the Weigher's simulated returns
    (2026-09-14); at the bell it is intrinsic. `exact` drops the half-session floor so a curve
    sampled through the last hours runs down to the bell instead of stepping to it. */
export function valueOn(p: Pick<Position, 'ticker' | 'strike' | 'right' | 'expiry'>, price: number, ahead = 0, exact = false): number {
  const [y, m, d] = p.expiry.split('-').map(Number);
  const sessions = Math.max(0, sessionsBetween(today(), new Date(y, m - 1, d)));
  if (ahead >= sessions && sessions > 0) return intrinsic(price, p.strike, p.right);
  const t = Math.max(sessions - ahead, exact ? 0.004 : 0.5) / 252;
  return blackScholesPrice(price, p.strike, t, contractIvFor(p.ticker, p.strike, p.right), p.right);
}

/**
 * @param ahead  the soft line's day, in sessions from today (Robinhood's Simulated Returns
 *               scrubber, 2026-09-14): 0 = today, `sessions` = the expiry's own day, where the
 *               soft line lies on the hard one
 */
export function buildPositionCurve(p: Position, spot: number, lo: number, hi: number, ahead = 0): PositionCurve {
  const [y, m, d] = p.expiry.split('-').map(Number);
  const sessions = Math.max(0, sessionsBetween(today(), new Date(y, m - 1, d)));
  /* Half a session at the least — a contract that expires today still has the
     day's hours in it; the "today" line is a curve, not a corner */
  const t = Math.max(sessions, 0.5) / 252;
  const iv = contractIvFor(p.ticker, p.strike, p.right);
  const valueNow = blackScholesPrice(spot, p.strike, t, iv, p.right);
  const cost = costOf(p);
  const ref = cost?.value ?? valueNow;
  const sign = (p.side === 'long' ? 1 : -1) * 100 * p.contracts;
  const onDay = ahead >= sessions && sessions > 0 ? (price: number) => intrinsic(price, p.strike, p.right) : (price: number) => blackScholesPrice(price, p.strike, Math.max(sessions - ahead, 0.5) / 252, iv, p.right);

  const points: CurvePoint[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const price = lo + ((hi - lo) * i) / SAMPLES;
    const exp = (intrinsic(price, p.strike, p.right) - ref) * sign;
    const now = (onDay(price) - ref) * sign;
    points.push({ price, expiry: exp, now });
  }
  const breakeven = p.right === 'C' ? p.strike + ref : p.strike - ref;
  const atSpot = (intrinsic(spot, p.strike, p.right) - ref) * sign;
  let worst = Infinity;
  let best = -Infinity;
  for (const pt of points) {
    worst = Math.min(worst, pt.expiry);
    best = Math.max(best, pt.expiry);
  }
  return { points, lo, hi, ref, refKind: cost?.kind ?? 'now', valueNow, breakeven, atSpot, worst: Math.min(0, worst), best, sessions };
}

/** "+$1.2K" · "−$340" · "$0" */
export function fmtPnl(v: number): string {
  if (Math.abs(v) < 0.5) return '$0';
  const a = Math.abs(v);
  const body = a >= 1e6 ? `$${(a / 1e6).toFixed(1)}M` : a >= 1e3 ? `$${(a / 1e3).toFixed(1)}K` : `$${a.toFixed(0)}`;
  return `${v < 0 ? '−' : '+'}${body}`;
}
