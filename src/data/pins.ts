import type { StrikeNode } from '../types/market';

/*
==================================================
  SLAYER TERMINAL - BOTH PINS (data/pins.ts)

  Max pain and the gamma-weighted pin, side by
  side, with the gap — P-10.
==================================================

  THE PROBLEM WITH ONE PIN. The terminal's `pin` is the max-total-OI strike —
  a defensible magnet read, silently standing in for two OTHER defensible
  definitions that routinely disagree with it and with each other. Showing
  both named definitions, and the gap, is more honest than picking one — and
  the gap itself is information: a book whose OI mass and gamma mass sit on
  different strikes is a book where "the pin" is not one place.

  MAX PAIN is the OI-weighted definition, computed the way the street means
  it: the candidate settlement price that minimises the total intrinsic value
  paid out across every open contract. For settlement S:

      pain(S) = Σ_K callOI(K)·max(0, S−K)·100 + Σ_K putOI(K)·max(0, K−S)·100

  evaluated at each listed strike, argmin wins. Ties go to the candidate
  NEAREST SPOT — a flat pain valley means the book does not care, and naming
  the far end of a plateau would manufacture a distant magnet out of
  indifference.

  THE GAMMA PIN is the |gamma-dollar|-weighted centroid of the book:

      gammaPin = Σ_K K·|netGex(K)| / Σ_K |netGex(K)|

  — where the book's hedging mass CENTERS, which is what actually pulls
  price under dealer hedging. |netGex| rather than signed, because both a
  call-dominant and a put-dominant shelf anchor hedging flow at their strike;
  signing the weights would let the two sides cancel and put the "pin" in
  empty space between them. A centroid rather than an argmax, because the
  argmax is already on screen with its own name — the SUPREME — and a second
  surface for the same number wearing a different name is how vocabularies
  rot.

  BOTH ARE MODELLED off the same simulator chain as everything else, behind
  the same seam. Swap the chain and both follow.
*/

export interface PinPair {
  /** Argmin of total intrinsic payout — the OI-weighted pin. Null on an
      empty chain or one with no open interest at all. */
  maxPain: number | null;
  /** |Gamma-dollar|-weighted centroid of the strikes. Null when the book
      carries no gamma. */
  gammaPin: number | null;
  /** gammaPin − maxPain: positive = the gamma mass sits above the OI mass.
      Null unless both exist. */
  gap: number | null;
}

/**
 * Both pins, from a chain.
 *
 * O(n²) over the strikes for max pain — a chain here is ~40 strikes and the
 * exact quadratic beats a clever linear pass nobody can verify at a glance.
 */
export function buildPins(chain: readonly StrikeNode[], spot: number): PinPair {
  const strikes = [...chain].sort((a, b) => a.strike - b.strike);

  let maxPain: number | null = null;
  if (strikes.length > 0 && strikes.some(n => n.callOI > 0 || n.putOI > 0)) {
    let best = Infinity;
    let bestDist = Infinity;
    for (const cand of strikes) {
      const S = cand.strike;
      let pain = 0;
      for (const n of strikes) {
        if (S > n.strike) pain += n.callOI * (S - n.strike) * 100;
        if (n.strike > S) pain += n.putOI * (n.strike - S) * 100;
      }
      const dist = Math.abs(S - spot);
      /* Strictly-less on pain, nearest-to-spot on ties — see the header. */
      if (pain < best || (pain === best && dist < bestDist)) {
        best = pain;
        bestDist = dist;
        maxPain = S;
      }
    }
  }

  let gammaPin: number | null = null;
  {
    let mass = 0;
    let moment = 0;
    for (const n of strikes) {
      const w = Math.abs(n.netGex);
      mass += w;
      moment += n.strike * w;
    }
    if (mass > 0) gammaPin = moment / mass;
  }

  return {
    maxPain,
    gammaPin,
    gap: maxPain !== null && gammaPin !== null ? gammaPin - maxPain : null,
  };
}
