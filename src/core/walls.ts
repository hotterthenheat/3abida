/*
==================================================
  SLAYER TERMINAL - NAMING THE WALLS (core/walls.ts)

  Which strike is THE call wall, and which is THE
  put wall. One rule, in one place, because it was
  written twice and the two copies disagreed.
==================================================
*/

/** Anything carrying a strike. The exposure is read through an accessor
    because the two callers spell the SAME NUMBER differently: the GEX
    snapshot's levels call it `value`, the option chain's nodes call it
    `netGex`, and `computeGexSnapshot` is literally
    `chain.map(n => ({ strike: n.strike, value: n.netGex }))` (simulator.ts).
    An accessor makes that identity visible at each call site and costs no
    per-tick array to convert between the two spellings. */
export interface Struck {
  readonly strike: number;
}

/**
 * The heaviest CALL-dominant shelf above spot, and the heaviest PUT-dominant
 * shelf below it.
 *
 * ---------------------------------------------------------------------------
 * WHY THE SIGN IS CHECKED, AND WHY THIS FILE EXISTS AT ALL
 * ---------------------------------------------------------------------------
 * The original rule was |value| plus SIDE OF SPOT. Side of spot is only a
 * PROXY for option side. It holds for a fresh OI profile (simulator.ts seeds
 * calls above spot, puts below) and deliberately does NOT hold for the live
 * book, which is sticky by design (BOOK_BLEND, ~1h half-life: "walls persist,
 * get tested, and fade for real instead of shadowing price"). So a shelf keeps
 * its option side while price walks past it and its side of spot flips.
 *
 * Measured on SPY at spot 505.17: strike 505 carried -$436.8M — CALL-dominant
 * — and was named the PUT wall, so the strike rail printed a red PW tag on a
 * row sitting ABOVE its own flip rule at 504.50. A put wall on the call side
 * of the flip is not a thing that can exist.
 *
 * The sign IS the measured option side. `netGex = callGex + putGex` with
 * `dealerCallDirection = -0.55` and `dealerPutDirection = -0.53 * -1`
 * (simulator.ts), so NEGATIVE is call-dominant and POSITIVE is put-dominant.
 * Every other surface already reads it that way: the heat ramps, the strike
 * field's `put: l.value >= 0`, and the rail's own bar colour.
 *
 * ---------------------------------------------------------------------------
 * AND WHY IT IS SHARED RATHER THAN FIXED TWICE
 * ---------------------------------------------------------------------------
 * This rule existed in two places — `buildLevelsFor` (data/gex.ts) and
 * `generateTradePlan` (core/simulator.ts) — over the same numbers. Only the
 * first was fixed. The second kept feeding `plan.resistanceWall` /
 * `plan.supportWall` into three more surfaces: the GEX matrix's highlighted
 * wall rows, `readHeatPattern`'s prose, and the Pulse board. Terrain read the
 * corrected rule while the GEX page read the broken one, off one book.
 *
 * The FLIP had already been noticed and hand-synced across the same two
 * functions ("Matches data/gex.ts buildLevelsFor", simulator.ts) — a comment
 * asking the next reader to keep two copies in step. The walls are the case
 * where that did not survive. So the rule moved here instead.
 *
 * @param points  strikes to consider; order does not matter
 * @param spot    the price the sides are measured from
 * @param valueOf net dealer exposure at a strike — negative call-dominant,
 *                positive put-dominant
 * @returns each wall, or `null` where NOTHING on that side qualifies —
 *          "no call wall overhead" is a real state of the book, and callers
 *          disagree about how to render it, so the choice of fallback stays
 *          with them rather than being invented here.
 */
export function pickWalls<T extends Struck>(
  points: readonly T[],
  spot: number,
  valueOf: (p: T) => number
): { callWall: number | null; putWall: number | null } {
  let callWall: number | null = null;
  let cwAbs = 0;
  let putWall: number | null = null;
  let pwAbs = 0;

  for (const p of points) {
    const v = valueOf(p);
    const a = Math.abs(v);
    // Same magnitude comparison as before, restricted to the half of the book
    // the name actually claims. No new arithmetic.
    if (p.strike > spot && v < 0 && a > cwAbs) {
      cwAbs = a;
      callWall = p.strike;
    }
    if (p.strike < spot && v > 0 && a > pwAbs) {
      pwAbs = a;
      putWall = p.strike;
    }
  }

  return { callWall, putWall };
}

/**
 * The gamma flip: the sign-change midpoint NEAREST SPOT.
 *
 * ---------------------------------------------------------------------------
 * THE WALLS' STORY, A SECOND TIME — caught before it finished happening
 * ---------------------------------------------------------------------------
 * This rule was written four times: `buildExposureProfile` (data/exposure.ts),
 * `buildLevelsFor` (data/gex.ts), `generateTradePlan` (core/simulator.ts) —
 * all three nearest-to-spot, hand-synced by comments asking the next reader to
 * keep them in step — and `levelsFrom` (data/vannacharm.ts), which walked up
 * the chain and BROKE ON THE FIRST crossing it met.
 *
 * First-from-the-bottom is the exact bug the other three were unified to fix
 * (2026-08-18): a noisy book can carry a jitter crossing deep in the put tail,
 * and breaking on the first hit names THAT the regime border while the
 * structural flip sits at spot. Every migration map, level-shift row and wall
 * drift timeline read the divergent copy, so the flip the Vanna & Charm page
 * projected could disagree with the flip the Exposure page drew, off one book.
 *
 * The fourth copy was found when P-4 needed a FIFTH reader of the rule. Same
 * decision as the walls above: the rule moves here, every caller points at it,
 * and the next surface that needs a flip cannot write its own.
 *
 * @returns the crossing nearest spot, or `null` when the field never changes
 *          sign — a one-sided book has no flip, and "no flip" is a real state
 *          the caller has to render deliberately rather than inherit as spot.
 */
export function pickFlip<T extends Struck>(
  points: readonly T[],
  spot: number,
  valueOf: (p: T) => number
): number | null {
  const asc = [...points].sort((a, b) => a.strike - b.strike);
  let flip: number | null = null;
  let flipDist = Infinity;
  for (let i = 1; i < asc.length; i++) {
    if (Math.sign(valueOf(asc[i - 1])) !== Math.sign(valueOf(asc[i]))) {
      const mid = (asc[i - 1].strike + asc[i].strike) / 2;
      const d = Math.abs(mid - spot);
      if (d < flipDist) {
        flipDist = d;
        flip = mid;
      }
    }
  }
  return flip;
}
