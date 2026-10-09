/*
==================================================
  SLAYER TERMINAL - HOW SURE IS THIS
  (data/levelSureness.ts)

  The ideas' rank 3, 2026-10-09: every dealer level
  says what it stands on. Three things, each a
  disclosure of method — never a disclaimer:

    the assumption  which side dealers are on. Open
                    interest says how many contracts
                    are open at a strike, not who
                    bought them; every exposure model
                    assumes it. This one assumes the
                    street's usual: customers sold
                    the calls and bought the puts,
                    dealers hold the other side.
    the freshness   open interest is counted once a
                    day, after the close; the price
                    the hedging is read at is live.
    the other side  where the level would sit if that
                    assumption were wrong — the book
                    read with every strike's side
                    turned over. The walls move to the
                    strikes that are heaviest the
                    other way; the flip keeps its
                    price and swaps its meaning; the
                    supreme keeps its strike and
                    pushes the other way.

  Pure: a chain and a spot in, the words out, so any
  room reads it (Terrain next). The house sign is
  core/walls.ts's — negative call-dominant,
  positive put-dominant.
==================================================
*/

import Simulator from '../core/simulator';
import { pickFlip, pickWalls } from '../core/walls';
import { sessionStarts } from './indicators';
import { nyDay } from '../core/nyTime';
import type { StrikeNode } from '../types/market';

export type SureLevel = 'call wall' | 'put wall' | 'flip' | 'supreme';

export interface Sureness {
  level: SureLevel;
  /** The level as the book reads it now */
  strike: number | null;
  /** One plain line: which side dealers are assumed to be on */
  assumption: string;
  /** How fresh the open interest is, and the price */
  freshness: string;
  /** Where the level would sit with the side turned over — null when there would be none */
  other: number | null;
  /** That, in one sentence */
  otherWords: string;
}

/** The line every surface prints first */
export const ASSUMPTION_WORDS = 'Assumes customers sold the calls and bought the puts, so dealers hold the other side — open interest does not say who did.';

const fmt = (v: number) => (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2));

/** "Open interest as of Oct 8's close · priced at the live spot" — the date when the tape holds a closed session */
export function freshnessOf(ticker?: string): string {
  let when = 'the last close';
  if (ticker) {
    const bars = Simulator.peekCandles(ticker);
    if (bars && bars.length > 2) {
      const starts = sessionStarts(bars, 1);
      if (starts.length >= 2) when = `${nyDay(bars[starts[starts.length - 1] - 1].time * 1000)}'s close`;
    }
  }
  return `Open interest as of ${when} — it is counted once a day · the hedging is priced at the live spot`;
}

type Node = Pick<StrikeNode, 'strike' | 'netGex'>;

/** Every named level of a chain, with the side turned over beside it */
export function bookSureness(chain: readonly Node[], spot: number, ticker?: string): Record<SureLevel, Sureness> {
  const freshness = freshnessOf(ticker);
  const now = pickWalls(chain, spot, n => n.netGex);
  const flipped = pickWalls(chain, spot, n => -n.netGex);
  const flip = pickFlip(chain, spot, n => n.netGex);
  let supreme: number | null = null;
  let supremeNet = 0;
  for (const n of chain)
    if (Math.abs(n.netGex) > Math.abs(supremeNet)) {
      supremeNet = n.netGex;
      supreme = n.strike;
    }
  const wallWords = (side: 'above' | 'below', at: number | null, was: number | null) =>
    at == null
      ? `With the side turned over there would be no wall ${side} spot.`
      : was != null && Math.abs(at - was) < 1e-9
        ? `With the side turned over the wall ${side} spot would still be ${fmt(at)}.`
        : `With the side turned over the wall ${side} spot would sit at ${fmt(at)}${was != null ? `, not ${fmt(was)}` : ''}.`;
  const make = (level: SureLevel, strike: number | null, other: number | null, otherWords: string): Sureness => ({ level, strike, assumption: ASSUMPTION_WORDS, freshness, other, otherWords });
  return {
    'call wall': make('call wall', now.callWall, flipped.callWall, wallWords('above', flipped.callWall, now.callWall)),
    'put wall': make('put wall', now.putWall, flipped.putWall, wallWords('below', flipped.putWall, now.putWall)),
    flip: make(
      'flip',
      flip,
      flip,
      flip == null
        ? 'With the side turned over there would still be no flip — every strike leans one way.'
        : `With the side turned over the flip stays at ${fmt(flip)}, but its sides swap: above it hedging would amplify moves, below it absorb them.`
    ),
    supreme: make('supreme', supreme, supreme, supreme == null ? '' : `With the side turned over the supreme stays ${fmt(supreme)}, but its hedging would push moves ${supremeNet < 0 ? 'along rather than back' : 'back rather than along'}.`),
  };
}

/** One level's read */
export const levelSureness = (chain: readonly Node[], spot: number, level: SureLevel, ticker?: string): Sureness => bookSureness(chain, spot, ticker)[level];
