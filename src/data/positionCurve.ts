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
  typed one; otherwise today's theoretical value at
  spot, so the sketch reads "if you bought it now".
  The card says which. Dollars are per contract ×
  100 × contracts, signed by side (sold = the
  mirror image).

  The price range is the Map's window, so the walls
  and the flip the card draws on it land where the
  rail has them.
==================================================
*/

import { blackScholesPrice } from '../core/greeks';
import { sessionsBetween, today } from '../core/calendar';
import { contractIvFor } from './weigherDesk';
import type { Position } from './positions';

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
  /** True when `ref` is what the reader paid, false when it is today's value */
  refIsEntry: boolean;
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

export function buildPositionCurve(p: Position, spot: number, lo: number, hi: number): PositionCurve {
  const [y, m, d] = p.expiry.split('-').map(Number);
  const sessions = Math.max(0, sessionsBetween(today(), new Date(y, m - 1, d)));
  /* Half a session at the least — a contract that expires today still has the
     day's hours in it; the "today" line is a curve, not a corner */
  const t = Math.max(sessions, 0.5) / 252;
  const iv = contractIvFor(p.ticker, p.strike, p.right);
  const valueNow = blackScholesPrice(spot, p.strike, t, iv, p.right);
  const ref = p.entry ?? valueNow;
  const sign = (p.side === 'long' ? 1 : -1) * 100 * p.contracts;

  const points: CurvePoint[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const price = lo + ((hi - lo) * i) / SAMPLES;
    const exp = (intrinsic(price, p.strike, p.right) - ref) * sign;
    const now = (blackScholesPrice(price, p.strike, t, iv, p.right) - ref) * sign;
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
  return { points, lo, hi, ref, refIsEntry: p.entry != null, valueNow, breakeven, atSpot, worst: Math.min(0, worst), best, sessions };
}

/** "+$1.2K" · "−$340" · "$0" */
export function fmtPnl(v: number): string {
  if (Math.abs(v) < 0.5) return '$0';
  const a = Math.abs(v);
  const body = a >= 1e6 ? `$${(a / 1e6).toFixed(1)}M` : a >= 1e3 ? `$${(a / 1e3).toFixed(1)}K` : `$${a.toFixed(0)}`;
  return `${v < 0 ? '−' : '+'}${body}`;
}
