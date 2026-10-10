/*
==================================================
  SLAYER TERMINAL - MAX PAIN (data/maxPain.ts)

  The ideas' rank 6, 2026-10-09: the strike at which
  today's contracts would be worth the least to the
  people holding them, if price closed there — the
  calls in the money below it and the puts in the
  money above it, counted contract by contract.

  It is arithmetic on open interest and nothing
  more. It is drawn as one plain marked line, never
  as a pull: the research found no evidence that
  price is drawn toward it, and the page says so.
==================================================
*/

import type { StrikeNode } from '../types/market';

export interface MaxPain {
  strike: number;
  /** What every contract would pay its holder at that close, dollars */
  payout: number;
}

/** The close at which today's calls and puts pay their holders least — null without open interest */
export function maxPainOf(chain: readonly Pick<StrikeNode, 'strike' | 'callOI' | 'putOI'>[]): MaxPain | null {
  if (!chain.length || !chain.some(n => n.callOI > 0 || n.putOI > 0)) return null;
  let best: MaxPain | null = null;
  for (const at of chain) {
    let pay = 0;
    for (const n of chain) {
      if (at.strike > n.strike) pay += n.callOI * (at.strike - n.strike);
      else if (at.strike < n.strike) pay += n.putOI * (n.strike - at.strike);
    }
    pay *= 100;
    if (!best || pay < best.payout) best = { strike: at.strike, payout: pay };
  }
  return best;
}

/** The one sentence every surface that marks it uses */
export const MAX_PAIN_WORDS =
  'Max pain is the close at which today’s contracts would pay their holders the least — arithmetic on open interest. It is marked, not a target: nothing says price is drawn to it.';
