/*
==================================================
  SLAYER TERMINAL - HOW SURE IS THIS PRINT
  (components/trace/printDoubt.ts)

  The print card's three lines of method (the ideas
  report, 2026-10-09, idea 3 — "every print says
  what else it could be"):

    · COULD ALSO BE — the other things a print may
      be (one leg of a spread, a hedge against
      stock, a roll, a close), each with what in
      the print's own fields speaks for it and what
      against. It names no winner: the tape cannot.
    · MEASURED AGAINST — what made it unusual: its
      size and premium against this contract's own
      prints today, and how many of them reached it.
    · the open interest's age — "as of the last
      close" (the card says it beside the figure).

  Built from the print and the tape the reader was
  watching; a read of method, never a call.
==================================================
*/

import { printKind } from '../../data/tape';
import type { FlowPrint } from '../../types/trace';

export interface Alternative {
  /** "One leg of a spread" */
  name: string;
  /** What in the print fits it */
  for: string;
  /** What in the print argues against it */
  against: string;
}

const INDEX_FUNDS = new Set(['SPY', 'QQQ', 'IWM', 'DIA', 'SPX', 'NDX', 'RUT']);
const secs = (t: string) => {
  const [h, m, s] = t.split(':').map(Number);
  return (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
};
const sameContract = (a: FlowPrint, b: FlowPrint) => a.ticker === b.ticker && a.strike === b.strike && a.right === b.right && a.expiry === b.expiry;

/**
 * The other readings a print allows, from its own fields and the tape around it. Up to four, in a fixed order — the
 * order is not a ranking.
 */
export function couldAlsoBe(p: FlowPrint, tape: FlowPrint[] = []): Alternative[] {
  const out: Alternative[] = [];
  const t = secs(p.time);
  const near = tape.filter(o => o.id !== p.id && o.ticker === p.ticker && !sameContract(o, p) && Math.abs(secs(o.time) - t) <= 2);
  const kind = printKind(p);
  const itm = p.right === 'C' ? p.otmPct < 0 : p.otmPct > 0;
  /* deep enough in the money to move with the stock — a hair in is an at-the-money option */
  const deep = itm && Math.abs(p.otmPct) >= 3;

  /* ONE LEG OF A SPREAD */
  const legsBeside = near.filter(o => o.size === p.size);
  out.push({
    name: 'One leg of a spread',
    for:
      kind === 'MULTI'
        ? `it printed with ${p.legs > 1 ? `${p.legs} legs` : 'a structure tag'}${p.strat !== '—' ? ` (${p.strat.toLowerCase()})` : ''}`
        : legsBeside.length
          ? `${legsBeside.length} other ${p.ticker} contract${legsBeside.length === 1 ? '' : 's'} printed the same size within two seconds`
          : 'any single print can be a leg worked on its own',
    against: kind === 'MULTI' ? 'its other legs are not on the tape you were watching' : legsBeside.length ? 'the sizes may match by chance' : 'it printed alone, one leg, with nothing the same size beside it',
  });

  /* A HEDGE AGAINST STOCK OR A BOOK */
  const hedgeFor = INDEX_FUNDS.has(p.ticker) && p.right === 'P' && p.side === 'ASK'
    ? 'a put bought on an index fund is the commonest cover for a book of stock'
    : deep
      ? `it sits ${Math.abs(p.otmPct).toFixed(1)}% in the money, where an option trades much like the stock it may be paired with`
      : 'a desk can pair any option with shares',
  hedgeAgainst = p.sweep && !itm ? 'it swept out of the money across venues — urgency more often seen in a position on direction' : 'the tape here carries no share prints to pair it with';
  out.push({ name: 'A hedge', for: hedgeFor, against: hedgeAgainst });

  /* A ROLL */
  const roll = near.filter(o => o.right === p.right && (o.expiry !== p.expiry || o.strike !== p.strike) && o.side !== p.side && o.side !== 'MID');
  out.push({
    name: 'A roll',
    for: roll.length
      ? `${p.ticker} ${roll[0].strike}${roll[0].right} ${roll[0].expiry.slice(0, 5)} printed the other way within two seconds`
      : p.dte <= 2
        ? `it expires in ${p.dte === 0 ? 'hours' : `${p.dte} day${p.dte === 1 ? '' : 's'}`} — near expiries are where positions get moved out`
        : 'positions get moved to new strikes and dates all session',
    against: roll.length ? 'the two may be separate orders' : 'no print the other way on the same side of the book stood beside it',
  });

  /* A CLOSE */
  const closeFor =
    p.deltaOI < 0
      ? `open interest is ${Math.abs(p.deltaOI).toLocaleString('en-US')} lower than the close before`
      : p.volOverOI < 1
        ? 'the day\'s volume still fits inside the open interest that stood this morning'
        : 'a holder can close at any time';
  const closeAgainst =
    p.volume > p.oi
      ? `the day's volume (${p.volume.toLocaleString('en-US')}) is past the open interest (${p.oi.toLocaleString('en-US')}), so not all of today's trading can be closing`
      : p.deltaOI > 0
        ? 'open interest grew since the close before'
        : 'open interest is counted once a day, so today\'s closes are not known until tomorrow';
  out.push({ name: 'A close', for: closeFor, against: closeAgainst });

  return out;
}

export interface Yardstick {
  /** The contract's prints today */
  count: number;
  medianSize: number;
  medianPremium: number;
  /** This print against the median, × */
  sizeX: number;
  premiumX: number;
  /** Prints today this size or larger, this one included */
  atLeast: number;
}

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** The print against this contract's own prints today — what "unusual" is measured against */
export function measuredAgainst(p: FlowPrint, today: { size: number; premium: number }[]): Yardstick | null {
  if (today.length < 3) return null;
  const medianSize = median(today.map(o => o.size));
  const medianPremium = median(today.map(o => o.premium));
  return {
    count: today.length,
    medianSize,
    medianPremium,
    sizeX: medianSize > 0 ? p.size / medianSize : 0,
    premiumX: medianPremium > 0 ? p.premium / medianPremium : 0,
    atLeast: today.filter(o => o.size >= p.size).length,
  };
}
