/*
==================================================
  SLAYER TERMINAL - THE LADDER (core/paper/ladder.ts)

  The price ladder every futures desk is traded
  from, read out of what this terminal ACTUALLY
  knows — and no further.

  WHAT A REAL DOM SHOWS THAT WE CANNOT: ten levels
  of resting size on each side. This desk's feed is
  a TOP OF BOOK (market.ts: bid, ask, and the size
  at each). Filling nine more rows with plausible
  numbers would be the one thing this whole desk
  refuses to do — it would be inventing market
  data — so the size columns carry a figure at the
  touch and nothing anywhere else, and the panel
  says why in as many words.

  WHAT IT SHOWS INSTEAD, all of it real:

    VOLUME AT PRICE   the session's own profile
                      (data/volumeProfile, built
                      from the bars this instrument
                      draws), which is the column a
                      ladder is actually read for
    THE TOUCH         bid and ask with their size
    MY BOOK           every working order of mine at
                      that price, its size, and — with
                      the queue on (core/paper/queue)
                      — how much is still in front
    P&L AT THIS PRICE what the open position is worth
                      if it ends here, through the
                      instrument's own multiplier
    THE LANDMARKS     the position's average, the
                      VPOC, and the dealer levels the
                      rest of the terminal draws

  Nothing here writes. The panel calls the engine
  for that, like every other hand on the desk.
==================================================
*/

import { sessionVolumeProfile } from '../../data/volumeProfile';
import { isLive, type Order, type Position } from './engine';
import { barsFor, levelsFor, type Quote } from './market';
import { roundToTick, type Instrument } from './instruments';
import { readQueue, type QueueRead } from './queue';

export type LadderMark = 'call' | 'put' | 'flip' | 'high' | 'low' | 'vpoc';

export const MARK_WORDS: Record<LadderMark, string> = {
  call: 'Call wall',
  put: 'Put wall',
  flip: 'Gamma flip',
  high: "The session's high",
  low: "The session's low",
  vpoc: 'The session\u2019s heaviest price',
};

export interface LadderRow {
  price: number;
  /** Resting at the touch — null everywhere else, because the touch is all this feed has */
  bidSize: number | null;
  askSize: number | null;
  /** Every landmark that lands on this rung */
  marks: LadderMark[];
  /** My working orders at this price */
  orders: Order[];
  /** My resting size here, by the side it would trade */
  mine: { buy: number; sell: number };
  /** Where my limit stands in the line here, when the queue is on */
  queue: QueueRead | null;
  /** What an open position is worth if it is closed at this price */
  pnl: number | null;
  isBid: boolean;
  isAsk: boolean;
  isLast: boolean;
  isAvg: boolean;
  isVpoc: boolean;
}

export interface LadderRead {
  rows: LadderRow[];
  /** The row step, in the instrument's own ticks */
  step: number;
  /** True while the feed can only speak for the touch — every ladder on this desk */
  topOfBookOnly: true;
  vpoc: number | null;
  spreadTicks: number;
  sessionHigh: number | null;
  sessionLow: number | null;
  /*
    THE LANDMARKS THE LADDER CANNOT REACH. Twenty-two rungs at a quarter point
    span five and a half points; a session runs a hundred and thirty. So for
    most of the day every landmark is off the panel and the lane would be an
    empty column — exactly the fault the volume column was cut for. The nearest
    ones each way ride the end rungs instead, with a caret and the distance.
  */
  above: LandmarkAway[];
  below: LandmarkAway[];
}

export interface LandmarkAway {
  mark: LadderMark;
  price: number;
  /** How far out of view it is, in the instrument's own ticks */
  ticks: number;
}

const EMPTY: LadderRead = { rows: [], step: 1, topOfBookOnly: true, vpoc: null, spreadTicks: 0, sessionHigh: null, sessionLow: null, above: [], below: [] };

/**
 * The ladder around the market.
 *
 * `rows` is how many prices to show (an even number reads best — the touch
 * lands in the middle), `group` how many of the instrument's ticks each row
 * covers, which is the "price grouping" every DOM carries: one tick of NQ is
 * a quarter point, and twenty of those is five points of screen.
 */
export function readLadder(
  inst: Instrument,
  quote: Quote | null,
  position: Position | null,
  orders: readonly Order[],
  opts: { rows?: number; group?: number; centre?: number | null } = {}
): LadderRead {
  if (!quote) return EMPTY;
  const rows = Math.max(4, Math.min(80, Math.round(opts.rows ?? 22)));
  const group = Math.max(1, Math.round(opts.group ?? 1));
  const step = inst.tickSize * group;
  const centre = opts.centre ?? quote.mark;
  if (!(step > 0) || !Number.isFinite(centre)) return EMPTY;

  /* the rows sit on the grid the step makes, so they do not shuffle under the
     reader as the market moves half a row */
  const top = Math.round(centre / step) * step + Math.floor(rows / 2) * step;
  const prices: number[] = [];
  for (let i = 0; i < rows; i++) prices.push(Number((top - i * step).toFixed(8)));

  /*
    THERE IS NO VOLUME COLUMN, AND THAT IS THE HONEST ANSWER.

    A ladder's volume-at-price column wants one number per rung. What this
    desk's tape publishes is a BAR's volume, which data/volumeProfile spreads
    across the range that bar covered — so at one tick every rung inside a
    minute's range carries the SAME slice by construction, and a session's
    bands come out about twenty points wide while a twenty-two rung ladder at
    a quarter point spans five and a half. The column could never show more
    than one band. Printing it anyway would be four rungs reading 299 as if
    they were four measurements.

    The session's profile is real and the terminal draws it where it means
    something — on the tape, behind the candles. Here the lane carries the
    LANDMARKS instead, every one of them a price this desk genuinely knows:
    the session's own high and low, the VPOC, and the dealer walls and flip.
  */
  const bars = barsFor(inst, '1m');
  const sessionHigh = bars.length ? Math.max(...bars.map(b => b.high)) : null;
  const sessionLow = bars.length ? Math.min(...bars.map(b => b.low)) : null;
  const profile = bars.length ? sessionVolumeProfile(bars) : null;

  const L = levelsFor(inst);
  const near = (a: number | undefined, b: number) => a != null && Math.abs(a - b) < step / 2;

  const live = orders.filter(o => isLive(o) && o.instrumentId === inst.id);
  const bid = roundToTick(inst, quote.bid);
  const ask = roundToTick(inst, quote.ask);
  const last = roundToTick(inst, quote.last);
  const avg = position && position.qty !== 0 ? position.avgPrice : null;

  const out: LadderRow[] = prices.map(price => {
    const mine = live.filter(o => {
      const p = o.type === 'limit' ? o.limitPrice : o.type === 'stop' ? o.stopPrice : null;
      return p != null && Math.abs(p - price) < step / 2;
    });
    let buy = 0;
    let sell = 0;
    for (const o of mine) {
      const left = o.qty - o.filledQty;
      if (o.side === 'buy') buy += left;
      else sell += left;
    }
    const q = mine.map(o => readQueue(o.id)).find(Boolean) ?? null;
    return {
      price,
      bidSize: Math.abs(price - bid) < step / 2 ? quote.bidSize : null,
      askSize: Math.abs(price - ask) < step / 2 ? quote.askSize : null,
      marks: (
        [
          near(L?.callWall, price) ? 'call' : null,
          near(L?.putWall, price) ? 'put' : null,
          near(L?.flip, price) ? 'flip' : null,
          profile?.vpoc != null && Math.abs(profile.vpoc - price) < step / 2 ? 'vpoc' : null,
          sessionHigh != null && Math.abs(sessionHigh - price) < step / 2 ? 'high' : null,
          sessionLow != null && Math.abs(sessionLow - price) < step / 2 ? 'low' : null,
        ] as (LadderMark | null)[]
      ).filter((m): m is LadderMark => m != null),
      orders: mine,
      mine: { buy, sell },
      queue: q,
      pnl: position && position.qty !== 0 ? (price - position.avgPrice) * position.qty * inst.multiplier : null,
      isBid: Math.abs(price - bid) < step / 2,
      isAsk: Math.abs(price - ask) < step / 2,
      isLast: Math.abs(price - last) < step / 2,
      isAvg: avg != null && Math.abs(price - avg) < step / 2,
      isVpoc: profile?.vpoc != null && Math.abs(profile.vpoc - price) < step / 2,
    };
  });

  /* which of them the ladder could not reach, and how far out they sit */
  const hi = prices[0];
  const lo = prices[prices.length - 1];
  const every: { mark: LadderMark; price: number | null | undefined }[] = [
    { mark: 'call', price: L?.callWall },
    { mark: 'put', price: L?.putWall },
    { mark: 'flip', price: L?.flip },
    { mark: 'vpoc', price: profile?.vpoc ?? null },
    { mark: 'high', price: sessionHigh },
    { mark: 'low', price: sessionLow },
  ];
  const away = (which: 'above' | 'below'): LandmarkAway[] =>
    every
      .filter((m): m is { mark: LadderMark; price: number } => m.price != null && Number.isFinite(m.price))
      .filter(m => (which === 'above' ? m.price > hi + step / 2 : m.price < lo - step / 2))
      .map(m => ({ mark: m.mark, price: m.price, ticks: Math.round(Math.abs(m.price - (which === 'above' ? hi : lo)) / inst.tickSize) }))
      .sort((a, b) => a.ticks - b.ticks)
      .slice(0, 2);

  return {
    rows: out,
    step,
    topOfBookOnly: true,
    vpoc: profile?.vpoc ?? null,
    spreadTicks: Math.max(0, Math.round((quote.ask - quote.bid) / inst.tickSize)),
    sessionHigh,
    sessionLow,
    above: away('above'),
    below: away('below'),
  };
}

/**
 * WHAT A CLICK AT THIS PRICE MEANS — the convention every ladder shares: on
 * the buy side, under the market is a limit and over it is a stop; on the
 * sell side, the other way about. The reader never picks an order type.
 */
export function orderAt(side: 'buy' | 'sell', price: number, mark: number): 'limit' | 'stop' {
  if (side === 'buy') return price <= mark ? 'limit' : 'stop';
  return price >= mark ? 'limit' : 'stop';
}
