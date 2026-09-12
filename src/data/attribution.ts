import type { FlowPrint } from '../types/trace';

/*
==================================================
  SLAYER TERMINAL - EXPOSURE ATTRIBUTION (data/attribution.ts)

  Click a strike, see the trades that built it —
  P-19.
==================================================

  THIS CLOSES A LOOP THE PRODUCT LEAVES OPEN. Trace shows prints with no
  structural context; Pinpoint shows structure with no prints. Nobody joins
  them, so a wall stays a number when it is really a list of trades — and
  the list is what tells a reader whether the level was built by one
  institution at 09:47 or by four hundred small orders all day.

  THE JOIN IS THE STRIKE, and it is looser than it looks. A print carries an
  exact contract; a map row carries a strike on the profile's own grid. So
  the match is BY TOLERANCE against half the grid step — otherwise a
  half-dollar-step name silently attributes nothing, and an empty list would
  read as "no trades here" when it means "we did not look properly".

  WHAT IS RANKED, and why not by size. Premium, not contracts: a thousand
  cheap far-dated contracts and forty expensive near-dated ones are not the
  same event, and premium is what the desk on the other side had to fund.
  Ties go to the LATER print, so a reader scanning the top of the list is
  reading the most recent of equals rather than an arbitrary one.

  BOTH RIGHTS, AND THE SPLIT NAMED. A strike's exposure is built by call AND
  put activity, and which one built it changes the read entirely — so the
  summary carries both premiums separately rather than a single total that
  hides the composition.
*/

export interface StrikeAttribution {
  strike: number;
  /** The prints that hit this strike today, largest premium first. */
  prints: FlowPrint[];
  /** Total premium, and the split that built it. */
  totalPremium: number;
  callPremium: number;
  putPremium: number;
  /** Contracts, both sides. */
  contracts: number;
  /** The single largest print — the one that would have moved the level. */
  largest: FlowPrint | null;
}

/** Half a grid step: the tolerance a strike match is allowed. */
export function matchTolerance(step: number): number {
  return step > 0 ? step / 2 : 0.005;
}

/**
 * The prints behind one strike.
 *
 * @param prints today's option prints for this name
 * @param strike the map row's strike
 * @param step   the chain's strike step — sets the match tolerance
 */
export function buildStrikeAttribution(prints: readonly FlowPrint[], strike: number, step: number): StrikeAttribution {
  const tol = matchTolerance(step);
  const hits = prints.filter(p => Math.abs(p.strike - strike) <= tol);
  /* Premium first, later print on ties — see the header. */
  const sorted = [...hits].sort((a, b) => b.premium - a.premium || b.id - a.id);

  let callPremium = 0;
  let putPremium = 0;
  let contracts = 0;
  for (const p of hits) {
    if (p.right === 'C') callPremium += p.premium;
    else putPremium += p.premium;
    contracts += p.size;
  }

  return {
    strike,
    prints: sorted,
    totalPremium: callPremium + putPremium,
    callPremium,
    putPremium,
    contracts,
    largest: sorted[0] ?? null,
  };
}

/**
 * What the list says about HOW the level was built.
 *
 * The threshold is a share of the strike's own premium, not a dollar figure:
 * "one print built this" means something different on a $2M strike than on a
 * $200M one, and only the share travels between them.
 */
export const CONCENTRATION_BAR = 0.4;

export function attributionWords(a: StrikeAttribution): string {
  if (a.prints.length === 0) return 'No prints hit this strike today — the exposure here is carry-over positioning';
  const share = a.totalPremium > 0 && a.largest ? a.largest.premium / a.totalPremium : 0;
  const side = a.callPremium >= a.putPremium ? 'call' : 'put';
  const many = `${a.prints.length} print${a.prints.length === 1 ? '' : 's'}`;
  if (share >= CONCENTRATION_BAR) {
    return `${many}, but ${Math.round(share * 100)}% of the premium is ONE ${a.largest?.right === 'C' ? 'call' : 'put'} order — this level is one participant's`;
  }
  return `${many}, ${side}-led and spread across them — this level was built by the crowd`;
}
