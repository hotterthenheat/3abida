import { blackScholesPrice } from '../core/greeks';
import type { FlowPrint } from '../types/trace';

/*
==================================================
  SLAYER TERMINAL - STRIKE COST BASIS (data/costBasis.ts)

  Where the holders of this strike actually got in —
  P-16's pain map.
==================================================

  A STRIKE'S GAMMA SAYS WHAT DEALERS MUST DO. ITS COST BASIS SAYS WHAT THE
  HOLDERS WILL DO. Those are different forces and only one of them is on
  this desk today. When price crosses the volume-weighted basis of the open
  calls, every holder above it flips from red to green at once — a
  mechanical supply event that can be watched approaching, and nothing in
  the product surfaces it.

  ── THE ASSUMPTION, STATED FIRST BECAUSE IT IS LOAD-BEARING ──────────────

  A print is a trade between two parties; calling one of them "the holder"
  is a choice. The choice made here, and the only one the tape supports:

    A print that lifted the ASK is an opening LONG. Its buyer paid the fill
    and is the holder whose basis this tracks.

    A print that hit the BID is the mirror of that, and is EXCLUDED rather
    than counted as a short. A basis mixing longs and shorts is not a basis
    — the two sides are underwater at opposite times, and averaging them
    produces a number that describes nobody.

    MID prints are excluded too. Their direction is genuinely unknown, and a
    guess here would silently move the band the whole surface is about.

  So this is the basis of the AGGRESSIVE LONGS, which is both the honest
  read of what the tape shows and the population whose flip actually
  produces supply. `coverage` reports what share of the strike's premium
  that population represents, so a reader can see when the answer rests on
  a thin slice of the day.

  ── WHAT "UNDERWATER" MEANS HERE ─────────────────────────────────────────

  Marked against the model price at the current spot, through the same
  carry seam every other greek on this desk reads. Not against the last
  fill: a contract that has not printed in an hour would otherwise report a
  stale P&L that moves only when someone happens to trade it, which is
  exactly the wrong behaviour for a band a reader is watching price
  approach.
*/

export interface StrikeBasis {
  strike: number;
  right: 'C' | 'P';
  /** Volume-weighted average fill of the aggressive longs. Null with none. */
  basis: number | null;
  /** Contracts behind that basis. */
  contracts: number;
  /** Premium behind it. */
  premium: number;
  /** Share of the strike's whole premium this population represents, 0–1. */
  coverage: number;
  /** Model mark at the current spot. */
  mark: number | null;
  /** Unrealized P&L for those holders, in dollars. */
  unrealized: number | null;
  /** True when the mark sits below the basis — holders underwater. */
  underwater: boolean | null;
}

export const CONTRACT_MULTIPLIER = 100;

/** A print the tape shows as an opening aggressive long. */
const isAggressiveLong = (p: FlowPrint) => p.side === 'ASK';

/**
 * One contract's basis and pain.
 *
 * @param dteYears years to expiry for the mark
 * @param iv       implied vol for the mark
 */
export function buildStrikeBasis(
  prints: readonly FlowPrint[],
  strike: number,
  right: 'C' | 'P',
  spot: number,
  dteYears: number,
  iv: number,
  tolerance = 0.005
): StrikeBasis {
  const atStrike = prints.filter(p => p.right === right && Math.abs(p.strike - strike) <= tolerance);
  const longs = atStrike.filter(isAggressiveLong);

  let weighted = 0;
  let contracts = 0;
  let premium = 0;
  for (const p of longs) {
    weighted += p.fill * p.size;
    contracts += p.size;
    premium += p.premium;
  }
  const wholePremium = atStrike.reduce((a, p) => a + p.premium, 0);
  const basis = contracts > 0 ? weighted / contracts : null;

  const mark =
    spot > 0 && dteYears > 0 && iv > 0 ? blackScholesPrice(spot, strike, dteYears, iv, right) : null;
  const unrealized =
    basis !== null && mark !== null ? (mark - basis) * contracts * CONTRACT_MULTIPLIER : null;

  return {
    strike,
    right,
    basis,
    contracts,
    premium,
    coverage: wholePremium > 0 ? premium / wholePremium : 0,
    mark,
    unrealized,
    underwater: basis !== null && mark !== null ? mark < basis : null,
  };
}

export interface BasisBand {
  right: 'C' | 'P';
  /** Volume-weighted basis across every contract of this right. */
  basis: number | null;
  contracts: number;
  /** The SPOT at which those holders break even, found by inversion. */
  breakevenSpot: number | null;
}

/**
 * The band drawn on the chart: where all open calls, and all open puts,
 * collectively got in — and the SPOT that would flip them.
 *
 * The band is a price on the CHART's axis, so a basis in option premium has
 * to be turned back into a spot. That is a one-dimensional monotone problem
 * (a call is worth more as spot rises), so it is bisected rather than
 * approximated: the same reasoning as impliedVolFromPrice, and the same
 * refusal to return a number when the target lies outside what the model can
 * produce.
 */
export function buildBasisBand(
  prints: readonly FlowPrint[],
  right: 'C' | 'P',
  spot: number,
  dteYears: number,
  iv: number
): BasisBand {
  const longs = prints.filter(p => p.right === right && isAggressiveLong(p));
  let weighted = 0;
  let contracts = 0;
  let strikeWeighted = 0;
  for (const p of longs) {
    weighted += p.fill * p.size;
    strikeWeighted += p.strike * p.size;
    contracts += p.size;
  }
  if (contracts === 0 || !(spot > 0) || !(dteYears > 0) || !(iv > 0)) {
    return { right, basis: null, contracts: 0, breakevenSpot: null };
  }
  const basis = weighted / contracts;
  const strike = strikeWeighted / contracts;

  /* Bisect spot for the price at which the model marks this contract at the
     holders' basis. Bracketed wide but finite; outside it, null. */
  let lo = spot * 0.5;
  let hi = spot * 1.5;
  const at = (s: number) => blackScholesPrice(s, strike, dteYears, iv, right);
  const rising = right === 'C';
  const loV = at(lo);
  const hiV = at(hi);
  const within = rising ? basis >= loV && basis <= hiV : basis <= loV && basis >= hiV;
  if (!within) return { right, basis, contracts, breakevenSpot: null };
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    const v = at(mid);
    if (rising ? v < basis : v > basis) lo = mid;
    else hi = mid;
    if (hi - lo < 1e-6) break;
  }
  return { right, basis, contracts, breakevenSpot: (lo + hi) / 2 };
}

/** What a band is worth saying. */
export function bandWords(band: BasisBand, spot: number): string {
  if (band.breakevenSpot === null || band.basis === null) {
    return band.contracts === 0
      ? `No aggressive ${band.right === 'C' ? 'call' : 'put'} buying to read a basis from today`
      : `${band.right === 'C' ? 'Call' : 'Put'} holders' basis is outside what the model can mark at any spot in range`;
  }
  const side = band.right === 'C' ? 'call' : 'put';
  const above = band.breakevenSpot > spot;
  const dist = Math.abs(band.breakevenSpot - spot);
  return above
    ? `Today's ${side} buyers turn green at ${band.breakevenSpot.toFixed(2)} — ${dist.toFixed(2)} away, and every one of them flips at once when price gets there`
    : `Today's ${side} buyers are already green above ${band.breakevenSpot.toFixed(2)} — ${dist.toFixed(2)} below spot`;
}
