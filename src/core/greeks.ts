/*
==================================================
  SLAYER TERMINAL - BLACK-SCHOLES GREEKS (greeks.ts)
  Pure math, no state, no clock. Extracted from the
  simulator so the SCORING engine can price greeks
  without importing the simulator at all — a replay
  process that pulls in core/simulator boots the
  whole synthetic market (seeded history, timers,
  Math.random), which is exactly what a backtest
  must never do.

  The simulator now imports THIS, so live and replay
  price greeks with byte-identical code.
==================================================

  P-24A — THE CARRY, AND WHAT CHANGED WITH IT.

  This file priced everything at a hardcoded `r = 0.05` with NO dividend
  yield. Both now come from `core/carry.ts`, which is a seam rather than a
  constant: today it serves named assumptions and says so, and when the
  rates add-on lands nothing here changes. Every formula below is the
  generalized (continuous-yield) Black-Scholes, so q = 0 reproduces the old
  arithmetic exactly wherever the old arithmetic was right.

  ONE PLACE IT WAS NOT RIGHT, and it is worth naming because the numbers on
  screen move: the put charm was `charmCall + r·e^{−rt}`. In this model
  Δput = e^{−qt}(N(d1) − 1), so ∂Δput/∂t and ∂Δcall/∂t differ by exactly
  q·e^{−qt} — a DIVIDEND term, not a rate one. At the old q = 0 the two
  charms must be EQUAL, and the old code had them differing by ~5% of the
  discount factor. The generalized formulas below make the pair consistent
  with the deltas they are the time-derivative of, and the proof pins that
  relationship rather than the literal number, so a future refactor cannot
  quietly reintroduce it.

  THE VEGA SCALING TRAP (P-24D). `vega` and `rho` here are PER ONE POINT of
  their input — per 1% of vol, per 1% of rate — because that is what a
  reader means by "vega". The raw partials are per 1.00, so both are divided
  by 100 INSIDE this file. A feed that quotes per-1.00 vega therefore needs
  dividing by 100 ONCE, on ingest — never again here. Ingesting and
  rescaling double-scales by 100× and produces plausible wrong numbers
  rather than an error, which is why the proof asserts the convention
  directly.
*/

import { getCarry } from './carry';
import type { Greeks } from '../types/market';

function normalCDF(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804 * Math.exp((-x * x) / 2);
  const p = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - d * p : d * p;
}

function normalPDF(x: number): number {
  return Math.exp((-x * x) / 2) / Math.sqrt(2 * Math.PI);
}

/**
 * Black-Scholes greeks with a continuous dividend yield.
 *
 * @param S spot · @param K strike · @param t years to expiry · @param v IV
 * @param r risk-free rate — defaults to the carry seam, NOT to a constant
 * @param q dividend yield — same seam
 */
export function blackScholesGreeks(S: number, K: number, t: number, v: number, r?: number, q?: number): Greeks {
  const carry = getCarry();
  const rate = r ?? carry.r;
  const yld = q ?? carry.q;
  if (t <= 0) t = 0.0001; // Avoid division by zero
  if (v <= 0) v = 0.01;

  const sqT = Math.sqrt(t);
  const dfQ = Math.exp(-yld * t);
  const dfR = Math.exp(-rate * t);
  const d1 = (Math.log(S / K) + (rate - yld + (v * v) / 2) * t) / (v * sqT);
  const d2 = d1 - v * sqT;

  const Nd1 = normalCDF(d1);
  const Nd2 = normalCDF(d2);
  const Np_d1 = normalPDF(d1);

  // Delta — the yield discount is why an index call is not simply N(d1)
  const deltaCall = dfQ * Nd1;
  const deltaPut = dfQ * (Nd1 - 1);

  // Gamma (same for call/put)
  const gamma = (dfQ * Np_d1) / (S * v * sqT);

  // Vega (same for call/put) — per 1 POINT of vol; see the header
  const vega = (S * dfQ * sqT * Np_d1) / 100;

  // Rho — per 1 POINT of rate, same convention as vega
  const rhoCall = (K * t * dfR * Nd2) / 100;
  const rhoPut = (-K * t * dfR * normalCDF(-d2)) / 100;

  // Vanna — ∂²V/∂S∂σ
  const vanna = (-dfQ * Np_d1 * d2) / v;

  /* Charm = −∂Δ/∂τ, the delta the clock takes per year. The shared term is
     the pure time-decay of the moneyness; the leading q-terms are what make
     the pair consistent with the deltas above (see the header). */
  const shared = (dfQ * Np_d1 * (2 * (rate - yld) * t - d2 * v * sqT)) / (2 * t * v * sqT);
  const charmCall = yld * dfQ * Nd1 - shared;
  const charmPut = -yld * dfQ * normalCDF(-d1) - shared;

  return { deltaCall, deltaPut, gamma, vega, vanna, charmCall, charmPut, rhoCall, rhoPut };
}

/** Black-Scholes price, the inversion below solves against. */
export function blackScholesPrice(
  S: number,
  K: number,
  t: number,
  v: number,
  right: 'C' | 'P',
  r?: number,
  q?: number
): number {
  const carry = getCarry();
  const rate = r ?? carry.r;
  const yld = q ?? carry.q;
  if (t <= 0) t = 0.0001;
  if (v <= 0) v = 0.0001;
  const sqT = Math.sqrt(t);
  const d1 = (Math.log(S / K) + (rate - yld + (v * v) / 2) * t) / (v * sqT);
  const d2 = d1 - v * sqT;
  const dfQ = Math.exp(-yld * t);
  const dfR = Math.exp(-rate * t);
  return right === 'C'
    ? S * dfQ * normalCDF(d1) - K * dfR * normalCDF(d2)
    : K * dfR * normalCDF(-d2) - S * dfQ * normalCDF(-d1);
}

/**
 * Implied vol from a price — the inversion P-24A asks for.
 *
 * BISECTION, not Newton, and the choice is deliberate: vega collapses toward
 * zero for deep wings and near expiry, and Newton divides by it — one bad
 * step there returns a confident absurdity. Bisection cannot diverge; it
 * either brackets the answer or reports that it could not, and "could not"
 * is a state every caller here already knows how to render.
 *
 * Returns null when the price is outside what the model can produce at ANY
 * vol — below intrinsic, or above the ceiling — because that is a quote
 * problem, not a vol.
 */
export function impliedVolFromPrice(
  price: number,
  S: number,
  K: number,
  t: number,
  right: 'C' | 'P',
  r?: number,
  q?: number
): number | null {
  if (!(price > 0) || !(S > 0) || !(K > 0) || !(t > 0)) return null;
  let lo = 0.0001;
  let hi = 5;
  const at = (v: number) => blackScholesPrice(S, K, t, v, right, r, q);
  /* Outside the model's own range at the bracket's ends: no vol explains it. */
  if (price < at(lo) - 1e-9 || price > at(hi) + 1e-9) return null;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (at(mid) < price) lo = mid;
    else hi = mid;
    if (hi - lo < 1e-8) break;
  }
  return (lo + hi) / 2;
}
