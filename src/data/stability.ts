import { blackScholesGreeks } from '../core/greeks';
import { higherGreeks } from '../core/higherGreeks';
import { pickFlip, pickWalls } from '../core/walls';
import type { StrikeNode } from '../types/market';

/*
==================================================
  SLAYER TERMINAL - MAP STABILITY (data/stability.ts)

  Does the gamma map HOLD? — P-11.
==================================================

  EVERY GEX PRODUCT ON THE MARKET PRESENTS ITS LEVELS AS FIXED. They are
  not: they are a function of vol, and a two-point move in IV can relocate
  the flip and swap the first and second call walls. A reader leaning on a
  wall that a vol tick would dissolve is leaning on nothing, and no surface
  anywhere tells them which kind of wall they have.

  THE METHOD IS REPRICE-AND-COMPARE, not a formula for "stability". Zomma
  (∂gamma/∂σ, core/higherGreeks.ts) says how each strike's gamma responds to
  vol; this walks the whole book to a bumped vol through that response, then
  RE-PICKS the levels there with the same pickWalls and pickFlip the live
  map uses, and reports what actually changed. A scalar "stability score"
  would be easier and would answer nothing — the question is WHICH level
  moves and HOW FAR, because that is what a reader acts on.

  WHY A LINEAR STEP IN ZOMMA IS HONEST HERE. Gamma at a bumped vol is
  approximated as gamma + zomma·Δσ — a first-order step. Over the ±2 points
  this surface reports that is a good approximation and a transparent one;
  over ±20 it would not be, which is precisely why the bump is bounded and
  named on the panel rather than left as a free parameter. The alternative —
  rebuilding a whole synthetic chain at a new vol — would import the
  simulator's own assumptions into what is meant to be a sensitivity read.

  THE VERDICT IS A SENTENCE, not a colour. "A ±2 vol move relocates the flip
  by 14 points and swaps the #1 and #2 call walls" is the read; a green dot
  saying STABLE would be the same information with the actionable half
  removed.
*/

/** The vol bump the gauge reports, in POINTS. Bounded — see the header. */
export const VOL_BUMP = 0.02;

export interface StabilityRead {
  /** Levels as they stand. */
  base: { callWall: number | null; putWall: number | null; flip: number | null };
  /** Levels at vol + bump, and at vol − bump. */
  up: { callWall: number | null; putWall: number | null; flip: number | null };
  down: { callWall: number | null; putWall: number | null; flip: number | null };
  /** Largest absolute move of the flip across the two bumps, in price. */
  flipTravel: number | null;
  /** Largest absolute move of either wall. */
  wallTravel: number | null;
  /** True when a wall lands on a DIFFERENT strike under either bump. */
  wallsSwap: boolean;
  /** True when nothing moved at all. */
  holds: boolean;
}

interface Bumped {
  strike: number;
  netGex: number;
}

/**
 * Walk the book to a bumped vol through each strike's own zomma.
 *
 * Gamma and net GEX are proportional at a strike (exposure is gamma × OI ×
 * multiplier × sign), so the RATIO gamma'/gamma carries straight over to
 * netGex without needing the OI back out of it — which is what lets this
 * work off the same chain every other surface reads.
 */
function bumpBook(chain: readonly StrikeNode[], spot: number, iv: number, t: number, dVol: number): Bumped[] {
  return chain.map(n => {
    const gammaNow = blackScholesGreeks(spot, n.strike, t, iv).gamma;
    const { zomma } = higherGreeks(spot, n.strike, t, iv);
    const gammaThen = gammaNow + zomma * dVol;
    /* A strike whose gamma the bump would drive through zero has left the
       first-order regime entirely; clamping at zero is the honest floor —
       negative gamma from a linear step is an artifact of the step, not a
       book. */
    const ratio = gammaNow > 0 ? Math.max(0, gammaThen) / gammaNow : 1;
    return { strike: n.strike, netGex: n.netGex * ratio };
  });
}

const levelsOf = (book: readonly Bumped[], spot: number) => {
  const w = pickWalls(book, spot, n => n.netGex);
  return { callWall: w.callWall ?? null, putWall: w.putWall ?? null, flip: pickFlip(book, spot, n => n.netGex) };
};

/**
 * How far the map moves under a vol bump.
 *
 * @param t years to the expiry the book is read at
 */
export function buildStability(
  chain: readonly StrikeNode[],
  spot: number,
  iv: number,
  t = 1 / 12,
  bump = VOL_BUMP
): StabilityRead | null {
  if (chain.length === 0 || !(spot > 0) || !(iv > 0)) return null;

  const base = levelsOf(chain.map(n => ({ strike: n.strike, netGex: n.netGex })), spot);
  const up = levelsOf(bumpBook(chain, spot, iv, t, bump), spot);
  const down = levelsOf(bumpBook(chain, spot, iv, t, -bump), spot);

  const travel = (a: number | null, b: number | null) => (a === null || b === null ? null : Math.abs(a - b));
  const maxOf = (xs: (number | null)[]) => {
    const real = xs.filter((x): x is number => x !== null);
    return real.length > 0 ? Math.max(...real) : null;
  };

  const flipTravel = maxOf([travel(base.flip, up.flip), travel(base.flip, down.flip)]);
  const wallTravel = maxOf([
    travel(base.callWall, up.callWall),
    travel(base.callWall, down.callWall),
    travel(base.putWall, up.putWall),
    travel(base.putWall, down.putWall),
  ]);
  const wallsSwap =
    base.callWall !== up.callWall ||
    base.callWall !== down.callWall ||
    base.putWall !== up.putWall ||
    base.putWall !== down.putWall;

  return {
    base,
    up,
    down,
    flipTravel,
    wallTravel,
    wallsSwap,
    holds: !wallsSwap && (flipTravel ?? 0) === 0,
  };
}

/** The sentence at the head of the page. */
export function stabilityWords(s: StabilityRead, bump = VOL_BUMP): string {
  const pts = `±${(bump * 100).toFixed(0)} vol`;
  if (s.holds) return `Your gamma map holds at current vol — a ${pts} move leaves every level where it is.`;
  const parts: string[] = [];
  if (s.flipTravel !== null && s.flipTravel > 0) parts.push(`relocates the flip by ${s.flipTravel.toFixed(2)}`);
  if (s.wallsSwap) parts.push('changes which strike is the wall');
  else if (s.wallTravel !== null && s.wallTravel > 0) parts.push(`moves a wall by ${s.wallTravel.toFixed(2)}`);
  return `A ${pts} move ${parts.join(' and ')} — these levels are a function of vol, not fixtures.`;
}
