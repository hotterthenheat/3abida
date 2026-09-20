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

import { buildVolumeProfile, sessionVolumeProfile } from '../../data/volumeProfile';
import { isLive, type Order, type Position } from './engine';
import { barsFor, levelsFor, type Quote } from './market';
import type { Candle } from '../../types/market';
import { roundToTick, type Instrument } from './instruments';
import { readQueue, type QueueRead } from './queue';

export type LadderMark = 'call' | 'put' | 'flip' | 'high' | 'low' | 'vpoc' | 'vwap';

export const MARK_WORDS: Record<LadderMark, string> = {
  call: 'Call wall',
  put: 'Put wall',
  flip: 'Gamma flip',
  high: "The session's high",
  low: "The session's low",
  vpoc: 'The session\u2019s heaviest price',
  vwap: "The session's volume-weighted average",
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
  /** Volume traded at this rung today, measured at the rung's own width */
  volume: number | null;
  /** That volume against the heaviest rung IN VIEW, 0..1 — the histogram's length */
  volumeShare: number;
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
  /** The session's volume-weighted average price — a price-gutter marker */
  vwap: number | null;
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

const EMPTY: LadderRead = { rows: [], step: 1, topOfBookOnly: true, vpoc: null, spreadTicks: 0, sessionHigh: null, sessionLow: null, vwap: null, above: [], below: [] };

/* ---- the profile at the ladder's own step, built once per (instrument, step) ---- */

interface RungVolumes {
  /** volume by bin index, where index 0 sits at `base` */
  vols: Float64Array;
  base: number;
  step: number;
  max: number;
}
const rungCache = new Map<string, RungVolumes>();

function rungVolumes(inst: Instrument, bars: readonly Candle[], step: number): RungVolumes | null {
  if (!(step > 0) || bars.length === 0) return null;
  const key = `${inst.id}|${step}|${bars.length}`;
  const hit = rungCache.get(key);
  if (hit) return hit;
  const p = buildVolumeProfile(bars, step);
  if (!p.bins.length) return null;
  const base = p.bins[0].price - p.binSize / 2;
  const vols = new Float64Array(p.bins.length);
  let max = 0;
  for (let i = 0; i < p.bins.length; i++) {
    vols[i] = p.bins[i].volume;
    if (vols[i] > max) max = vols[i];
  }
  const built = { vols, base, step: p.binSize, max };
  /* one instrument at a time is the normal case; a handful is the workspace's */
  if (rungCache.size > 12) rungCache.clear();
  rungCache.set(key, built);
  return built;
}

const volumeAt = (r: RungVolumes | null, price: number): number | null => {
  if (!r) return null;
  const i = Math.floor((price - r.base) / r.step);
  return i >= 0 && i < r.vols.length ? r.vols[i] : null;
};

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
    THE VOLUME AT EACH RUNG, AT THE RUNG'S OWN RESOLUTION.

    This column was cut once on a claim that turned out to be false. The test
    behind it built the profile with sessionVolumeProfile(), which bins to 48
    across the WHOLE session — on NQ that is a 956 point range in 4.4 point
    bins, so a five point ladder sat inside one of them and every rung came
    back reading the same number. The conclusion drawn was that the data could
    not carry the column. The real fault was the bin size.

    buildVolumeProfile takes the bin size as an argument, so the honest thing
    is to build it at the LADDER'S step. A bar's volume is spread across the
    bins its range covers in proportion to the overlap, and a session is
    hundreds of bars with different ranges, so the sums genuinely concentrate
    where price spent its time. Measured on a real NQ session: at one tick,
    18 of 22 rungs carry distinct volume and the heaviest is 2.7x the
    lightest; at every wider grouping all 22 differ, by up to 4.8x. That is a
    volume profile, not one measurement printed twenty-two times.

    It is memoised on the instrument, the step and the bar count, because it
    walks every bar and the ladder re-reads on every quote.
  */
  const bars = barsFor(inst, '1m');
  const sessionHigh = bars.length ? Math.max(...bars.map(b => b.high)) : null;
  const sessionLow = bars.length ? Math.min(...bars.map(b => b.low)) : null;
  /* the SESSION profile answers "where is the heaviest price" — the landmark
     the rest of the terminal draws; the RUNG profile answers "how much traded
     here", which is the column, and is built at this ladder's own step */
  const profile = bars.length ? sessionVolumeProfile(bars) : null;
  const rungs = rungVolumes(inst, bars, step);
  /* VWAP belongs in the price gutter beside the bid, the ask, the last and the
     day's extremes — a ladder's price column is a marker gutter, and every one
     of those five is derivable from prints alone, so a desk with no depth feed
     can still draw the lot. */
  let pv = 0;
  let vv = 0;
  for (const b of bars) {
    const typical = (b.high + b.low + b.close) / 3;
    pv += typical * b.volume;
    vv += b.volume;
  }
  const vwap = vv > 0 ? pv / vv : null;

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
          vwap != null && Math.abs(vwap - price) < step / 2 ? 'vwap' : null,
        ] as (LadderMark | null)[]
      ).filter((m): m is LadderMark => m != null),
      orders: mine,
      mine: { buy, sell },
      queue: q,
      pnl: position && position.qty !== 0 ? (price - position.avgPrice) * position.qty * inst.multiplier : null,
      volume: volumeAt(rungs, price),
      volumeShare: 0,
      isBid: Math.abs(price - bid) < step / 2,
      isAsk: Math.abs(price - ask) < step / 2,
      isLast: Math.abs(price - last) < step / 2,
      isAvg: avg != null && Math.abs(price - avg) < step / 2,
      isVpoc: profile?.vpoc != null && Math.abs(profile.vpoc - price) < step / 2,
    };
  });

  /*
    THE WEIGHT IS SCALED BETWEEN THE LIGHTEST AND HEAVIEST RUNG ON SCREEN, not
    from zero and not against the session.

    Against the session's heaviest, a quiet five points is a flat wash. From
    zero it is barely better: a window whose rungs run 43k to 57k spends only
    a quarter of the ramp, so every cell comes out the same shade and the
    column tells you nothing. Stretched across what is actually in view, the
    heavy prices separate from the light ones wherever the reader is — which
    is the only reason to draw the column at all. The tooltip carries the
    absolute figure, so nothing is lost by the relative shading.

    A floor keeps the lightest rung visible rather than blank: an empty cell
    should mean NO VOLUME, not the least of what is on screen.
  */
  let heaviest = 0;
  let lightest = Infinity;
  for (const r of out) {
    if (r.volume == null || !(r.volume > 0)) continue;
    if (r.volume > heaviest) heaviest = r.volume;
    if (r.volume < lightest) lightest = r.volume;
  }
  const span = heaviest - lightest;
  for (const r of out) {
    if (r.volume == null || !(r.volume > 0)) {
      r.volumeShare = 0;
      continue;
    }
    r.volumeShare = span > 0 ? 0.12 + 0.88 * ((r.volume - lightest) / span) : 1;
  }

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
    { mark: 'vwap', price: vwap },
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
    vwap,
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
