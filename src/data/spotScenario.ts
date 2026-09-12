import { pickFlip, pickWalls } from '../core/walls';
import type { StrikeNode } from '../types/market';

/*
==================================================
  SLAYER TERMINAL - THE SPOT SCENARIO (data/spotScenario.ts)

  "If we get to 5,880, what does the book look
  like?" — P-17, and the dollars it forces — P-18.
==================================================

  VANNA & CHARM ALREADY DO TIME AND VOL. Nobody does SPOT, and it is the
  scenario traders actually run in their heads all day. The pipeline is the
  same shape as the other two: hold the book, move one input, re-read the
  levels that fall out.

  WHAT MOVES AND WHAT DOES NOT, because this is where a scenario engine
  either earns trust or quietly lies:

    THE BOOK IS HELD FIXED. Open interest, strikes, per-contract gamma —
    all as they are now. This is a "where would the LEVELS be if price were
    there" question, not a forecast of how the book would have re-formed on
    the way. Any pretence otherwise would be modelling dealer behaviour we
    have no data for, and the panel says so in as many words.

    THE LEVELS ARE RE-PICKED, not re-scaled. The walls and the flip are
    side-of-spot reads, so moving spot moves them by CHANGING WHICH STRIKE
    WINS — exactly the thing a reader cannot do in their head. Same
    pickWalls and pickFlip every other surface uses: a scenario that
    disagreed with the live map about what a wall is would be worse than no
    scenario at all.

  P-18 — THE DOLLARS, AND THE ASSUMPTION UNDER THEM.

  Net GEX at a strike is dollars of dealer gamma per 1% move. Walking spot
  from here to there, the hedging flow is the gamma crossed along the way:

      flow = Σ_K netGex(K) · (ΔS / S) · 100        [K between here and there]

  — dollars of stock dealers must trade to stay hedged. The SIGN is the
  house convention (positive net = put-dominant = dealers short gamma = they
  chase the move), and the whole figure rests on one load-bearing
  assumption: CONTINUOUS delta hedging at that modelled sign. Real desks
  hedge in bands, on their own schedule, and some do not hedge at all. The
  panel states it, because a figure this legible is exactly the one a reader
  will over-trust if it is not labelled.

  GEX IS AN ABSTRACTION; DOLLARS OF FORCED FLOW IS NOT. That is P-18's whole
  point — the translation layer that makes the page legible to someone who
  does not speak greek.
*/

export interface SpotScenario {
  /** The hypothetical spot. */
  at: number;
  /** Where it moved from. */
  from: number;
  callWall: number | null;
  putWall: number | null;
  flip: number | null;
  supreme: number | null;
  /** Signed dealer flow the move forces, in dollars. Positive = buying. */
  hedgingFlow: number;
  /** The whole book's net — the regime the scenario spot would sit in. */
  netGex: number;
  regime: 'SHORT' | 'LONG';
}

/** The strikes the walk crosses, both ends inclusive. */
function crossed(chain: readonly StrikeNode[], from: number, to: number): StrikeNode[] {
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  return chain.filter(n => n.strike >= lo && n.strike <= hi);
}

/**
 * The book, read at a hypothetical spot.
 *
 * @param chain the CURRENT book — held fixed, see the header
 * @param from  today's spot
 * @param to    the hypothetical
 */
export function buildSpotScenario(chain: readonly StrikeNode[], from: number, to: number): SpotScenario | null {
  if (chain.length === 0 || !(from > 0) || !(to > 0)) return null;

  const picked = pickWalls(chain, to, n => n.netGex);
  const flip = pickFlip(chain, to, n => n.netGex);

  /* The supreme is the whole book's argmax |gamma| — spot-independent, so it is
     reported rather than recomputed against `to`. A scenario that "moved"
     the supreme would be inventing a book change. */
  let supreme: number | null = null;
  let supremeMag = 0;
  for (const n of chain) {
    const m = Math.abs(n.netGex);
    if (m > supremeMag) {
      supremeMag = m;
      supreme = n.strike;
    }
  }

  /* Gamma crossed × the fractional move, signed so POSITIVE means dealers
     must BUY: a put-dominant (positive) book is short gamma and chases, so
     an up move forces buying and a down move selling; a call-dominant
     (negative) book leans the other way. The product of the book's sign and
     the move's direction carries that with no special-casing. */
  const movePct = (to - from) / from;
  let gammaCrossed = 0;
  for (const n of crossed(chain, from, to)) gammaCrossed += n.netGex;
  const hedgingFlow = gammaCrossed * movePct * 100;

  const netGex = chain.reduce((a, n) => a + n.netGex, 0);

  return {
    at: to,
    from,
    callWall: picked.callWall ?? null,
    putWall: picked.putWall ?? null,
    flip,
    supreme,
    hedgingFlow,
    netGex,
    regime: flip !== null && to >= flip ? 'LONG' : 'SHORT',
  };
}

/** The sentence P-18 exists to print. */
export function flowWords(s: SpotScenario): string {
  if (s.at === s.from) return 'No move, no forced flow';
  const dir = s.at > s.from ? 'up' : 'down';
  const side = s.hedgingFlow >= 0 ? 'buying' : 'selling';
  const mag = Math.abs(s.hedgingFlow);
  const dollars =
    mag >= 1e9 ? `$${(mag / 1e9).toFixed(1)}B` : mag >= 1e6 ? `$${(mag / 1e6).toFixed(0)}M` : `$${(mag / 1e3).toFixed(0)}K`;
  return `A move ${dir} to ${s.at.toFixed(2)} forces roughly ${dollars} of dealer ${side}`;
}

/** The assumption the panel must carry — load-bearing, so it is words. */
export const HEDGING_ASSUMPTION =
  'Assumes dealers hedge continuously, at the modelled sign, on today’s open interest as it stands. Real dealers hedge in steps and on their own schedule.';
