/*
==================================================
  SLAYER TERMINAL - THE READS (data/reads.ts)

  "Read this" from templates (the ideas report's item
  12, 2026-10-10; the owner: "no LLMs tho please").
  Each builder takes figures a panel already holds and
  fills three fixed sentences:

    observed  what is there now — the room's own
              sentence where it writes one (the wall
              board's, the range's, the agenda's, the
              close odds', a setup's why), else a
              template on the figures
    assumes   what the model stands on, in the words
              the rest of the terminal uses for it
              (data/levelSureness.ts ASSUMPTION_WORDS,
              the pricing model's bell)
    changes   the figures that would turn the read,
              named with their values

  Pure: figures in, words out. A read, never an
  instruction — no sentence here tells a reader what
  to do, and the words check reads this file.
==================================================
*/

import { ASSUMPTION_WORDS } from './levelSureness';
import type { WallBoard } from './wall';
import type { Corridor, CloseOdds } from './ahead';
import type { Agenda } from './agenda';

export interface Reading {
  /** What is on the panel now, in its own figures */
  observed: string;
  /** What the model assumes — left out for a panel of observed figures */
  assumes?: string;
  /** What would change the read */
  changes: string;
}

/* ---- the words every read shares ---------------------------------------------------------------------------------- */

const fmt = (v: number) => (Math.abs(v % 1) < 1e-9 ? v.toFixed(0) : v.toFixed(2));
const pct = (v: number) => `${Math.round(v * 100)}%`;
const money = (v: number) => {
  const a = Math.abs(v);
  const s = a >= 1e9 ? `$${(a / 1e9).toFixed(1)}B` : a >= 1e6 ? `$${(a / 1e6).toFixed(1)}M` : a >= 1e3 ? `$${Math.round(a / 1e3)}K` : a >= 100 ? `$${Math.round(a)}` : `$${a.toFixed(2)}`;
  return v < 0 ? `−${s}` : s;
};
const real = (v: number | null | undefined): v is number => v != null && Number.isFinite(v) && v > 0;

/** The dealers' side, and when the open interest was counted */
export const DEALER_ASSUMES = `${ASSUMPTION_WORDS} Open interest is counted once a day, after the close; the hedging is priced at the live spot.`;
/** The pricing model's footing */
export const PRICING_ASSUMES = 'A pricing model fed the chain’s own implied volatility: moves follow the bell that volatility draws, with no jumps — a real move can be wider than the bell.';
/** What a fill is read as */
export const AGGRESSOR_ASSUMES = 'That a fill at the ask was a buyer and one at the bid a seller, so calls bought and puts sold read bullish. A fill does not say who started it, and a print can be one leg of a larger structure or a hedge.';

/* ---- the book: walls, flip, supreme ----------------------------------------------------------------------------- */

export interface BookFigures {
  ticker: string;
  spot: number;
  callWall: number | null;
  putWall: number | null;
  flip: number | null;
  supreme: number | null;
  /** The book's whole net, the house sign (negative call-heavy, absorbing) */
  netGex?: number | null;
}

/** Above the flip the hedging absorbs moves, below it amplifies them — the house sign (core/walls.ts) */
const sideWords = (spot: number, flip: number) => (spot >= flip ? 'above the flip, where hedging absorbs moves' : 'below the flip, where hedging amplifies moves');

export function bookReading(b: BookFigures): Reading {
  const { ticker } = b;
  /* the price as the rail prints it — to the cent */
  const spot = Math.round(b.spot * 100) / 100;
  const parts: string[] = [];
  if (real(b.callWall) && real(b.putWall)) {
    parts.push(
      spot > b.callWall
        ? `${ticker} at ${spot.toFixed(2)} is above the call wall at ${fmt(b.callWall)}; the put wall is ${fmt(b.putWall)}.`
        : spot < b.putWall
          ? `${ticker} at ${spot.toFixed(2)} is below the put wall at ${fmt(b.putWall)}; the call wall is ${fmt(b.callWall)}.`
          : `${ticker} at ${spot.toFixed(2)} sits between the put wall at ${fmt(b.putWall)} and the call wall at ${fmt(b.callWall)}.`
    );
  } else parts.push(`${ticker} is at ${spot.toFixed(2)}; the book names no wall on one side of it.`);
  if (real(b.flip) && Math.abs(spot - b.flip) < 0.005) parts.push(`Price is on the flip, ${fmt(b.flip)}, where hedging changes sides.`);
  else if (real(b.flip)) parts.push(`The flip is ${fmt(b.flip)}, ${Math.abs(spot - b.flip).toFixed(2)} ${spot >= b.flip ? 'below' : 'above'} price, so price is ${sideWords(spot, b.flip)}.`);
  else parts.push('There is no flip on the strikes read: every strike leans one way.');
  if (real(b.supreme)) {
    const also = b.supreme === b.callWall ? ' — the call wall itself' : b.supreme === b.putWall ? ' — the put wall itself' : '';
    parts.push(`The heaviest strike of the book, the supreme, is ${fmt(b.supreme)}${also}.`);
  }
  if (b.netGex != null && Number.isFinite(b.netGex) && b.netGex !== 0) parts.push(`Across the book the hedging nets to ${money(b.netGex)}, ${b.netGex < 0 ? 'call-heavy' : 'put-heavy'}.`);

  const turns: string[] = [];
  if (real(b.flip)) turns.push(`price crossing ${fmt(b.flip)} would put it ${spot >= b.flip ? 'below the flip, where hedging amplifies moves' : 'above the flip, where hedging absorbs moves'}`);
  if (real(b.callWall) && real(b.putWall)) turns.push(`a move past ${fmt(b.callWall)} or ${fmt(b.putWall)} would leave the range the two walls frame`);
  turns.push('and the walls can move to other strikes when open interest is counted again after the close');
  return {
    observed: parts.join(' '),
    assumes: DEALER_ASSUMES,
    changes: cap(`${turns.join('; ')}.`),
  };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/* ---- at the wall ------------------------------------------------------------------------------------------------ */

export function wallReading(board: WallBoard): Reading {
  const w = board.focus;
  const built = Math.abs(w.build) < 1 ? 'its size has not moved today' : `it has ${w.build > 0 ? 'grown' : 'shrunk'} by ${money(Math.abs(w.build))} today`;
  const pace = Number.isFinite(w.speed) && w.speed > 0 ? `the last half hour ran at ${w.speed.toFixed(1)}× the pace the options priced` : null;
  const expiring = w.expiresToday > 0.05 ? `${pct(w.expiresToday)} of it expires at 4:00, so it thins as the clock runs` : null;
  return {
    observed: `${w.sentence} ${board.sentence}`.trim(),
    assumes: `${DEALER_ASSUMES} The odds are the expected move for the ${board.minutesLeft} minutes left, bent by the strikes’ pull — model odds, not a forecast.`,
    changes: cap(`${[`the wall’s size — ${built}`, pace, expiring, 'and today’s prints, which hand dealers stock to trade toward or away from it'].filter(Boolean).join('; ')}.`),
  };
}

/* ---- Ahead: the range, where it closes, the agenda --------------------------------------------------------------- */

export function rangeReading(c: Corridor, minutesLeft: number): Reading {
  const lo = c.likely.low.price;
  const hi = c.likely.high.price;
  return {
    observed: c.sentence,
    assumes: `${PRICING_ASSUMES} The band is one expected move for the ${minutesLeft} minutes left, set round where the strikes pull the middle; ${DEALER_ASSUMES.charAt(0).toLowerCase()}${DEALER_ASSUMES.slice(1)}`,
    changes: cap(
      `${[
        `a close outside ${fmt(lo)}–${fmt(hi)} would be a move wider than the options priced`,
        real(c.flip) ? `price crossing the flip at ${fmt(c.flip)} would change which side moves run fastest on` : null,
        'and implied volatility moving widens or narrows the band with it',
      ]
        .filter(Boolean)
        .join('; ')}.`
    ),
  };
}

export function closeReading(o: CloseOdds, ticker: string): Reading {
  const top = o.top[0];
  const observed = o.reads ? `${ticker} — ${o.reads.likely}; ${o.reads.bands}. ${cap(o.reads.pull)}.` : o.sentence;
  return {
    observed,
    assumes: `${PRICING_ASSUMES} The strikes then bend the bell — absorbing strikes draw the close toward them, amplifying ones push it off — by ${pct(o.gravity)} of their full pull at this hour. ${ASSUMPTION_WORDS}`,
    changes: cap(
      `${[
        top ? `price moving away from ${fmt(top.strike)} moves the odds with it` : null,
        `the band of half the odds, ${fmt(o.half.low)}–${fmt(o.half.high)}, tightens as the close nears and the pull grows`,
        'and a wall that grows or drains changes how hard its strike pulls',
      ]
        .filter(Boolean)
        .join('; ')}.`
    ),
  };
}

export function agendaReading(a: Agenda): Reading {
  const first = a.first[0];
  return {
    observed: a.sentence,
    assumes: `${DEALER_ASSUMES} Reach and hold are model odds on the expected move for the time left; the order weighs how likely a strike is reached against how much hedging sits there.`,
    changes: cap(
      `${[
        first ? `price moving toward or away from ${fmt(first.strike)} changes its reach, and so the order` : null,
        a.weakestWall ? `the weakest wall in reach, ${fmt(a.weakestWall.strike)}, holds ${pct(a.weakestWall.hold)} of the time — a build there would raise it` : null,
        'and the order is read again every ten seconds',
      ]
        .filter(Boolean)
        .join('; ')}.`
    ),
  };
}

/* ---- the flow --------------------------------------------------------------------------------------------------- */

export interface NetFlowFigures {
  names: number;
  total: number;
  calls: number;
  puts: number;
  top: { ticker: string; net: number } | null;
  bottom: { ticker: string; net: number } | null;
  /** "Oct 17" when one expiry is cut, else null */
  expiry: string | null;
}

export function netFlowReading(f: NetFlowFigures): Reading {
  if (!f.top || !f.bottom) {
    return { observed: 'The book is still waking up — no name has net premium on it yet.', assumes: AGGRESSOR_ASSUMES, changes: 'The first prints of the session.' };
  }
  const on = f.expiry ? `On ${f.expiry}, the` : 'The';
  return {
    observed: `${on} board’s money leans ${f.total >= 0 ? 'bullish' : 'bearish'}: ${money(f.total)} net across ${f.names} names, net calls ${money(f.calls)} less net puts ${money(f.puts)}. ${f.top.ticker} leads bullish at ${money(f.top.net)}; ${f.bottom.ticker} leans hardest bearish at ${money(f.bottom.net)}.`,
    assumes: `${AGGRESSOR_ASSUMES} Net premium counts dollars, not contracts, so one large print can outweigh many small ones.`,
    changes: cap(
      `${[
        `${money(Math.abs(f.total))} of premium the other way would bring the board’s net to zero`,
        `${f.top.ticker} turns from the top with ${money(Math.abs(f.top.net))} of bearish premium`,
        'and the board is read again as each print lands',
      ].join('; ')}.`
    ),
  };
}

export interface TapeFigures {
  /** The tape's rows in view */
  prints: number;
  premium: number;
  bullish: number;
  bearish: number;
  /** Premium of the calls and of the puts in view */
  callPremium: number;
  putPremium: number;
  sweeps: number;
  /** The largest print in view */
  largest: { ticker: string; words: string; premium: number } | null;
  /** The cut's own words: "every name", "this cut" */
  cut: string;
  /** The tape's own sentence, as the page writes it — the read reuses it */
  said?: string;
}

export function tapeReading(t: TapeFigures): Reading {
  if (t.prints === 0) return { observed: `No print on the tape for ${t.cut} yet.`, assumes: AGGRESSOR_ASSUMES, changes: 'The next print that lands inside the cut.' };
  const lean = t.bullish + t.bearish > 0 ? `${pct(t.bullish / (t.bullish + t.bearish))} of the premium that took a side read bullish` : 'none of it took a side';
  const pc = t.callPremium > 0 ? `puts against calls ${(t.putPremium / t.callPremium).toFixed(2)} by premium` : 'no call premium';
  /* with the page's own sentence (it names the lean, the largest print and the sweeps) the count and the ratio go before it */
  const counted = t.said ? `${t.prints} prints for ${t.cut}, ${money(t.premium)} in premium, ${pc}.` : `${t.prints} prints for ${t.cut}, ${money(t.premium)} in premium; ${lean}, ${pc}, ${t.sweeps} sweep${t.sweeps === 1 ? '' : 's'}.`;
  return {
    observed: t.said ? `${counted} ${cap(t.said.replace(/\[\[|\]\]/g, '').trim().replace(/([^.])$/, '$1.'))}` : `${counted}${t.largest ? ` The largest is ${t.largest.ticker} ${t.largest.words}, ${money(t.largest.premium)}.` : ''}`,
    assumes: `${AGGRESSOR_ASSUMES} A sweep is an order that took several exchanges at once — the tape says how it filled, not why.`,
    changes: cap(`${['the next prints, which move every share here', 'a different cut — a name, a side, a size floor — reads a different tape', 'and prints older than the tape’s four hours drop off it'].join('; ')}.`),
  };
}

/* ---- a position on the Weigher ---------------------------------------------------------------------------------- */

export interface PositionFigures {
  /** The card's own sentence — where it sits against the book, what the hedging there does */
  said: string;
  spot: number;
  /** Dollars the contracts are marked at now, what they cost (or brought in, sold), and the return on that, signed by side */
  value: number;
  cost: number;
  pl: number;
  breakeven: number | null;
  /** Dollars per $1 in the stock, per day, per vol point — the position's, not a contract's */
  delta: number;
  theta: number;
  vega: number;
  maxLoss: number | null;
  maxGain: number | null;
  daysLeft: number;
}

export function positionReading(p: PositionFigures): Reading {
  const pl = p.pl;
  const be = real(p.breakeven) ? ` Its breakeven at expiry is ${fmt(p.breakeven)}, ${fmt(Math.abs(p.breakeven - p.spot))} ${p.breakeven >= p.spot ? 'above' : 'below'} the stock at ${fmt(p.spot)}.` : '';
  const ends = [p.maxLoss != null ? `the most it can lose is ${money(Math.abs(p.maxLoss))}` : 'its loss is not capped', p.maxGain != null ? `the most it can make ${money(p.maxGain)}` : 'its gain is not capped'].join(', ');
  return {
    observed: `${p.said} Worth ${money(p.value)} on the model against ${money(p.cost)} at its cost — ${pl >= 0 ? 'up' : 'down'} ${money(Math.abs(pl))}.${be} At expiry ${ends}.`,
    assumes: `${PRICING_ASSUMES} The mark is the model’s, between the bid and the ask; ${p.daysLeft} session${p.daysLeft === 1 ? ' is' : 's are'} left to run.`,
    changes: cap(
      `${[
        `the stock — each $1 up moves it about ${money(p.delta)}`,
        p.theta < 0 ? `time — a session costs it about ${money(Math.abs(p.theta))}` : `time — a session adds about ${money(p.theta)} to it`,
        `and implied volatility — a point moves it about ${money(p.vega)}`,
      ].join('; ')}.`
    ),
  };
}

/* ---- a Compass setup -------------------------------------------------------------------------------------------- */

export interface SetupFigures {
  /** "SPY 530C 0DTE" — the setup's own name for its contract */
  contract: string;
  /** The setup's own why, as Compass writes it */
  why: string;
  /** Its live state's word: active, watch, fading, retired */
  state: string;
  right: 'C' | 'P';
  /** Where the case ends, and what gives way there — Compass's own words */
  invalidation: number;
  invalidationReason: string;
  /** The first price milestone */
  target: number | null;
}

export function setupReading(s: SetupFigures): Reading {
  const through = s.right === 'C' ? 'below' : 'above';
  return {
    observed: `${s.contract} reads ${s.state}. ${s.why.trim().replace(/([^.])$/, '$1.')}`,
    assumes: `${DEALER_ASSUMES} The setup’s levels and targets were frozen when the sweep found it; its odds and greeks are the model’s, on the chain’s own implied volatility.`,
    changes: cap(
      `${[
        `a close ${through} ${fmt(s.invalidation)}, where the ${s.invalidationReason.charAt(0).toLowerCase()}${s.invalidationReason.slice(1).replace(/\.$/, '')} gives way, ends the case`,
        real(s.target) ? `price reaching ${fmt(s.target)} is its first milestone` : null,
        'and the walls it leans on can move to other strikes as the book is read again',
      ]
        .filter(Boolean)
        .join('; ')}.`
    ),
  };
}
