import type { OptionRight } from '../../types/compass';

/*
==================================================
  SLAYER TERMINAL - PAYOFF (core/paper/payoff.ts)

  What a strategy is worth at expiry, at every
  price — and therefore where it breaks even and
  what the worst case actually is.
==================================================

  THE SHAPE SWITCH WAS THE BUG WAITING TO HAPPEN. Max risk and max reward
  used to be read off the strategy's NAME — a vertical gets width minus the
  net, a condor the same, anything else gets nothing — which is right for
  the five shapes it knew and silently wrong the moment a reader drags a leg
  or builds their own. A butterfly named "custom" got no risk figure at all.

  So nothing here asks what the strategy is CALLED. It evaluates the legs.
  Breakevens, max profit and max loss all fall out of one curve, and the
  answer is correct for a shape nobody has named yet.

  AT EXPIRY there is no model and no vol: a call is worth max(0, S − K) and
  a put max(0, K − S), and the strategy is the ratio-weighted sum. That is
  the one place in this terminal where the arithmetic is exact rather than
  estimated, which is why the curve is drawn from it rather than from the
  Black-Scholes surface that prices the legs today.

  UNBOUNDED IS A REAL ANSWER and the sampled curve cannot see it — sample
  far enough and a naked call still looks finite. So the extremes are
  decided by the ratio sum at each tail, in closed form, and the curve is
  only asked about the interior. A max loss printed as a number when it is
  actually infinite is the single most dangerous thing this file could say.
*/

export interface PayoffLeg {
  strike: number;
  right: OptionRight;
  /** + buys the leg, − sells it, per one unit of the strategy */
  ratio: number;
}

export interface PayoffPoint {
  /** Underlying price, in the option's own units */
  s: number;
  /** Profit or loss in dollars at that price, for the whole position */
  pnl: number;
}

export interface PayoffProfile {
  points: PayoffPoint[];
  /** Underlying prices where the position crosses zero, ascending */
  breakevens: number[];
  /** Dollars. null means unbounded — the position keeps gaining */
  maxProfit: number | null;
  /** Dollars, as a POSITIVE magnitude. null means unbounded */
  maxLoss: number | null;
  /** The price where the position is worth least, when it is bounded */
  worstAt: number | null;
}

/** One unit of the strategy's intrinsic value at expiry, in option price units. */
export function intrinsicAt(legs: readonly PayoffLeg[], s: number): number {
  let v = 0;
  for (const l of legs) {
    v += l.ratio * (l.right === 'C' ? Math.max(0, s - l.strike) : Math.max(0, l.strike - s));
  }
  return v;
}

/**
 * Profit or loss at an underlying price.
 *
 * `net` is what one unit of the strategy costs — positive a debit, negative
 * a credit — in the same price units as the strikes. Buying pays it and
 * collects the intrinsic; selling collects it and owes the intrinsic.
 */
export function pnlAt(
  legs: readonly PayoffLeg[],
  s: number,
  net: number,
  side: 'buy' | 'sell',
  qty: number,
  multiplier: number
): number {
  const value = intrinsicAt(legs, s);
  const per = side === 'buy' ? value - net : net - value;
  return per * multiplier * qty;
}

/** The ratio-weighted slope far above every strike, and far below every one. */
function tails(legs: readonly PayoffLeg[]): { up: number; down: number } {
  let up = 0;
  let down = 0;
  for (const l of legs) {
    // Above every strike: calls are linear in S, puts are worthless.
    if (l.right === 'C') up += l.ratio;
    // Below every strike: puts fall with S (slope −1 in S), calls are worthless.
    else down -= l.ratio;
  }
  return { up, down };
}

export function payoffProfile(
  legs: readonly PayoffLeg[],
  net: number,
  side: 'buy' | 'sell',
  qty: number,
  multiplier: number,
  spot: number,
  samples = 161
): PayoffProfile {
  const strikes = legs.map(l => l.strike);
  const lo0 = Math.min(spot, ...strikes);
  const hi0 = Math.max(spot, ...strikes);
  const pad = Math.max((hi0 - lo0) * 0.6, spot * 0.12, 1);
  const lo = Math.max(0, lo0 - pad);
  const hi = hi0 + pad;

  /* EVERY STRIKE IS A SAMPLE, and so is spot. The payoff is piecewise linear
     with kinks ONLY at strikes, so its true maximum and minimum are always at
     a strike or in a tail — never between two of them. An evenly spaced grid
     that happens to straddle a kink reports an extreme that is slightly too
     kind, which is exactly the wrong direction to be wrong about a max loss:
     a long straddle sampled this way under-reported its worst case by a few
     hundred dollars. Adding the kinks makes the extremes exact rather than
     nearly right. */
  const grid = new Set<number>();
  for (let i = 0; i < samples; i++) grid.add(lo + ((hi - lo) * i) / (samples - 1));
  for (const k of strikes) if (k >= lo && k <= hi) grid.add(k);
  if (spot >= lo && spot <= hi) grid.add(spot);

  const points: PayoffPoint[] = [...grid]
    .sort((a, b) => a - b)
    .map(s => ({ s, pnl: pnlAt(legs, s, net, side, qty, multiplier) }));

  // ---- breakevens: exact, by solving each segment the curve crosses ----
  /* The payoff is piecewise linear with kinks only at strikes, so a crossing
     between two samples is a straight line and interpolating it is exact —
     no root-finder, no tolerance to tune. */
  const breakevens: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a.pnl === 0) breakevens.push(a.s);
    else if ((a.pnl < 0 && b.pnl > 0) || (a.pnl > 0 && b.pnl < 0)) {
      breakevens.push(a.s + ((0 - a.pnl) / (b.pnl - a.pnl)) * (b.s - a.s));
    }
  }
  if (points.length && points[points.length - 1].pnl === 0) breakevens.push(points[points.length - 1].s);

  // ---- extremes: the tails in closed form, the interior from the curve ----
  const t = tails(legs);
  const dir = side === 'buy' ? 1 : -1;
  const slopeUp = dir * t.up;
  const slopeDown = dir * t.down;

  let maxProfit: number | null = null;
  let maxLoss: number | null = null;

  const interiorMax = Math.max(...points.map(p => p.pnl));
  const interiorMin = Math.min(...points.map(p => p.pnl));

  // Up tail: slope in S. Positive means profit grows without bound.
  const upGains = slopeUp > 1e-9;
  const upLoses = slopeUp < -1e-9;
  // Down tail: `down` is already expressed as the slope in S below the strikes.
  const downGains = slopeDown < -1e-9;
  const downLoses = slopeDown > 1e-9;

  maxProfit = upGains || downGains ? null : interiorMax;
  maxLoss = upLoses || downLoses ? null : Math.abs(Math.min(0, interiorMin));

  const worstAt =
    maxLoss == null ? null : points.reduce((w, p) => (p.pnl < w.pnl ? p : w), points[0]).s;

  return { points, breakevens, maxProfit, maxLoss, worstAt };
}
