/*
==================================================
  SLAYER TERMINAL - SPX'S PRICE FROM ITS OPTIONS (src/data/feed/forward.ts)

  2026-10-15 — the owner, "SPX OVERNIGHT FIELD": "There's no S&P 500 index value overnight. Price the overnight field
  off the forward implied by at-the-money SPX options (put-call parity), not the last index print. Label it 'price from
  options (overnight)'. … Overnight quotes are wider. Mark cells whose IV comes from wide quotes as stale (soft edge),
  using one spread threshold you report."

  THE FORWARD: on the front expiry, each strike with a two-sided call and put quote gives F = K + e^{rT}(C − P) on the
  quotes' mids; the PARITY_PAIRS strikes where |C − P| is smallest (the money's own) are taken and their median is the
  forward. The field stands on the spot it implies on the model's carry, F·e^{−rT} (UW's convention, no dividend — every
  vol is solved at it, so the quotes priced at it give F back exactly); overnight the two differ by under 0.01%. Checked on UW's SPX snapshot after the curb of 2026-10-14: Oct 15's three nearest-parity strikes gave 7718.10,
  7718.15 and 7718.10.

  A WIDE QUOTE: its width in vol, (ask − bid) ÷ vega (vega per 1.00 of vol), over WIDE_VOL. One threshold, 2 vol
  points, from what was measured on 2026-10-14 (gamma × open interest weighted, within 5% of the money): SPY's
  regular-session NBBO read by the recorder had its 95th percentile at 0.85 vol points; SPX's NBBO after the curb at
  2.06 — 5.3% of that gamma stood on quotes wider than 2. A vol solved from a wide quote's mid is marked `wide`, and a
  cell with half its gamma on wide vols wears the stale edge (gexNodesPrimitive staleOf).

  Pure: the recorder (server/fieldRecorder.ts) and the rebuild (server/thetaRebuild.ts) call it; the proof is
  scripts/sessions-proof.ts.
==================================================
*/
import { blackScholesGreeks, blackScholesPrice } from '../../core/greeks';

export const PARITY_PAIRS = 3;
/** A quote wider than this in vol ((ask − bid) ÷ vega, vega per 1.00 of vol) is wide: 2 vol points */
export const WIDE_VOL = 0.02;

export interface QuoteLeg {
  strike: number;
  right: 'C' | 'P';
  bid: number;
  ask: number;
}
export interface Forward {
  forward: number;
  /** THE SPOT IT IMPLIES on the model's carry (UW's convention, no dividend): forward × e^{−rT} of the front — the price
      the field stands on, its vols solved at, and the minute's bar. Priced at it, the quotes give the forward back by
      parity exactly; overnight the two differ by under 0.01% */
  spot: number;
  /** the strikes whose parity gave it, nearest the money first */
  strikes: number[];
  /** the pairs it could read */
  pairs: number;
  /** the widest of the chosen pairs' call-plus-put quote widths, dollars */
  width: number;
}

const twoSided = (q: QuoteLeg | undefined): q is QuoteLeg => !!q && q.bid > 0 && q.ask > q.bid && Number.isFinite(q.ask);
const mid = (q: QuoteLeg) => (q.bid + q.ask) / 2;

/** The forward the front expiry's quotes imply, t in years to its expiry, r the carry — null under one two-sided pair */
export function forwardOf(quotes: readonly QuoteLeg[], t: number, r: number): Forward | null {
  const by = new Map<number, { C?: QuoteLeg; P?: QuoteLeg }>();
  for (const q of quotes) {
    if (!(q.strike > 0)) continue;
    const k = by.get(q.strike) ?? {};
    k[q.right] = q;
    by.set(q.strike, k);
  }
  const grow = Math.exp(r * Math.max(0, t));
  const pairs: { k: number; f: number; d: number; w: number }[] = [];
  for (const [k, v] of by) {
    if (!twoSided(v.C) || !twoSided(v.P)) continue;
    const c = mid(v.C);
    const p = mid(v.P);
    pairs.push({ k, f: k + grow * (c - p), d: Math.abs(c - p), w: v.C.ask - v.C.bid + (v.P.ask - v.P.bid) });
  }
  if (!pairs.length) return null;
  pairs.sort((a, b) => a.d - b.d || a.k - b.k);
  const best = pairs.slice(0, PARITY_PAIRS);
  const fs = best.map(b => b.f).sort((a, b) => a - b);
  const forward = fs[Math.floor(fs.length / 2)];
  return { forward: Math.round(forward * 100) / 100, spot: Math.round((forward / grow) * 100) / 100, strikes: best.map(b => b.k), pairs: pairs.length, width: Math.max(...best.map(b => b.w)) };
}

/** The vol a quote's mid implies at a forward (Black-Scholes on the carry, bisected) — NaN where no vol gives it */
export function volOfMid(price: number, spot: number, strike: number, t: number, right: 'C' | 'P', r: number): number {
  if (!(t > 0) || !(price > 0) || !(spot > 0)) return NaN;
  const at = (v: number) => blackScholesPrice(spot, strike, t, v, right, r, 0);
  let lo = 0.005;
  let hi = 5;
  if (price <= at(lo) || price >= at(hi)) return NaN;
  for (let i = 0; i < 60; i++) {
    const m = (lo + hi) / 2;
    if (at(m) > price) hi = m;
    else lo = m;
  }
  return (lo + hi) / 2;
}

/** A quote's width in vol: (ask − bid) ÷ vega, vega per 1.00 of vol — Infinity where the vega is nil */
export function volWidth(q: QuoteLeg, spot: number, t: number, iv: number, r: number): number {
  const vega = blackScholesGreeks(spot, q.strike, t, iv, r, 0).vega * 100;
  return vega > 1e-9 ? (q.ask - q.bid) / vega : Infinity;
}

/** A quote solved: its mid's vol at the forward, and whether it is wide — null when the quote is one-sided or its mid
    gives no vol */
export function solveQuote(q: QuoteLeg, spot: number, t: number, r: number): { iv: number; width: number; wide: boolean } | null {
  if (!twoSided(q)) return null;
  const iv = volOfMid(mid(q), spot, q.strike, t, q.right, r);
  if (!Number.isFinite(iv)) return null;
  const width = volWidth(q, spot, t, iv, r);
  return { iv, width, wide: width > WIDE_VOL };
}
