/*
==================================================
  SLAYER TERMINAL - REPLAY (data/replay.ts)

  The Map rewinds (2026-09-08). One position on the
  session — seconds from the open — and every surface
  on the page reads the book as it stood then: the
  chart's bars, the levels, the ladder, the calendar,
  the clock. The simulator keeps one snapshot of the
  book per minute bar (net gamma, delta and vega and
  the open interest at every strike); between two
  minutes the book is read on a FIVE-SECOND grid by
  interpolating them, so a replay at speed shows the
  colours turning through the day rather than
  stepping (Noah: "i should be able to see the
  smoothness in transition of colors").

  What is read at a position:
    the bars      every minute bar up to it, the last
                  one folded to the interpolated close
    spot          between the two bars' closes
    the chain     every strike the book knew at that
                  minute: net gamma, delta, vega and
                  both legs' open interest, the gamma
                  split between the legs by the same
                  weights the simulator uses (dealers
                  net short calls −0.55, short puts
                  −0.53), the live chain's greeks as
                  the template where they are not in
                  the snapshot
  Nothing here is a forecast — it is the day so far,
  at the moment you point at.
==================================================
*/

import Simulator from '../core/simulator';
import { OPEN_MIN, hhmm } from './ahead';
import { sessionBars } from './levelview';
import type { Candle, GexLevel, GexSnapshot, MarketSnapshot, StrikeNode } from '../types/market';

/** The book is read every five seconds of session time */
export const FRAME_SEC = 5;
const BAR_SEC = 60;
/** The simulator's dealer weights — the split of net gamma between the legs */
const W_CALL = -0.55;
const W_PUT = 0.53;

export interface ReplayRange {
  ticker: string;
  /** Today's session bars, oldest first */
  bars: Candle[];
  /** The book at each bar, by bar time */
  snaps: Map<number, GexSnapshot>;
  /** Seconds the session covers, from its first bar to its last */
  length: number;
}

/** Bars this far apart are one session; farther is the overnight */
const SESSION_GAP_S = 90;

function rangeOf(ticker: string, bars: Candle[]): ReplayRange | null {
  if (bars.length < 2) return null;
  const first = bars[0].time;
  const last = bars[bars.length - 1].time;
  /*
    THE BOOK IS A STEP FUNCTION, NOT A READING PER BAR (2026-09-13).

    This used to key the map on exact bar times, so a bar with no snapshot at
    precisely its second had no book at all and `levelsAt` returned an empty
    chain — the exposure overlay blanking out mid-scrub. That was invisible
    only because the seed happened to record one snapshot per bar; the moment
    history is sampled at any other rate it breaks, and a real feed is never
    one book per minute.

    Each bar now carries the LAST book recorded at or before it, which is what
    a book is: it stands until the next reading replaces it.
  */
  const all = Simulator.getGexHistory(ticker) ?? [];
  const snaps = new Map<number, GexSnapshot>();
  let j = 0;
  let carried: GexSnapshot | undefined;
  for (const bar of bars) {
    while (j < all.length && all[j].time <= bar.time) carried = all[j++];
    if (carried) snaps.set(bar.time, carried);
  }
  void first;
  /* No book kept for that day — nothing to rewind to */
  if (snaps.size === 0) return null;
  return { ticker, bars, snaps, length: (bars.length - 1) * BAR_SEC };
}

/** Today's session for a name — null until it has two bars to scrub between */
export function replayRange(ticker: string): ReplayRange | null {
  const bars = sessionBars(ticker);
  return bars ? rangeOf(ticker, bars) : null;
}

/** THE SESSION A BAR BELONGS TO, and where the bar sits in it (the
    TradingView way in: click a bar on the chart, the replay starts there —
    Noah, 2026-09-08). The bar is the last one at or before `time`; the
    session is the contiguous run of minute bars around it. */
export function replayRangeAt(ticker: string, time: number): { range: ReplayRange; pos: number } | null {
  const all = Simulator.peekCandles(ticker);
  if (!all || all.length < 2) return null;
  let i = all.length - 1;
  while (i > 0 && all[i].time > time) i--;
  let start = i;
  while (start > 0 && all[start].time - all[start - 1].time <= SESSION_GAP_S) start--;
  let end = i;
  while (end < all.length - 1 && all[end + 1].time - all[end].time <= SESSION_GAP_S) end++;
  const range = rangeOf(ticker, all.slice(start, end + 1));
  return range ? { range, pos: (i - start) * BAR_SEC } : null;
}

/** The clock at a position: minutes from midnight ET, as if the session opened at 09:30 */
export const replayMinute = (pos: number) => OPEN_MIN + Math.floor(pos / BAR_SEC);
export const replayLabel = (pos: number) => hhmm(replayMinute(pos));
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** The day the session is — from its first bar */
export const replayDay = (range: ReplayRange) => {
  const d = new Date(range.bars[0].time * 1000);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
};
/** A position snapped to the frame grid */
export const snapPos = (pos: number, length: number) => Math.max(0, Math.min(length, Math.floor(pos / FRAME_SEC) * FRAME_SEC));

const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

/** Where a position sits: the bar it is in and how far through it */
function place(range: ReplayRange, pos: number): { k: number; u: number } {
  const k = Math.max(0, Math.min(range.bars.length - 1, Math.floor(pos / BAR_SEC)));
  const u = k >= range.bars.length - 1 ? 0 : Math.max(0, Math.min(1, (pos - k * BAR_SEC) / BAR_SEC));
  return { k, u };
}

/** The bars up to a position, the last one folded to where price was */
export function barsAt(range: ReplayRange, pos: number): Candle[] {
  const { k, u } = place(range, pos);
  const out = range.bars.slice(0, k + 1);
  if (u > 0 && k + 1 < range.bars.length) {
    const a = range.bars[k];
    const b = range.bars[k + 1];
    const close = lerp(a.close, b.close, u);
    out[k] = { ...a, close, high: Math.max(a.high, close), low: Math.min(a.low, close) };
  }
  return out;
}

export function spotAt(range: ReplayRange, pos: number): number {
  const { k, u } = place(range, pos);
  const a = range.bars[k];
  const b = range.bars[k + 1];
  return b ? lerp(a.close, b.close, u) : a.close;
}

/** The bar a position is in — the chart's own replay clock reads its time */
export const barTimeAt = (range: ReplayRange, pos: number) => range.bars[place(range, pos).k].time;

/** The book between two minutes, strike by strike */
function levelsAt(range: ReplayRange, pos: number): GexLevel[] {
  const { k, u } = place(range, pos);
  const a = range.snaps.get(range.bars[k].time);
  const b = k + 1 < range.bars.length ? range.snaps.get(range.bars[k + 1].time) : undefined;
  if (!a && !b) return [];
  if (!a || !b || u === 0) return (a ?? b)!.levels;
  const byStrike = new Map<number, GexLevel>();
  for (const l of a.levels) byStrike.set(l.strike, { ...l, value: l.value * (1 - u), dex: (l.dex ?? 0) * (1 - u), vex: (l.vex ?? 0) * (1 - u), callOI: (l.callOI ?? 0) * (1 - u), putOI: (l.putOI ?? 0) * (1 - u) });
  for (const l of b.levels) {
    const cur = byStrike.get(l.strike);
    if (cur) {
      cur.value += l.value * u;
      cur.dex = (cur.dex ?? 0) + (l.dex ?? 0) * u;
      cur.vex = (cur.vex ?? 0) + (l.vex ?? 0) * u;
      if (l.vanna !== undefined) cur.vanna = (cur.vanna ?? 0) + l.vanna * u;
      if (l.charm !== undefined) cur.charm = (cur.charm ?? 0) + l.charm * u;
      cur.callOI = (cur.callOI ?? 0) + (l.callOI ?? 0) * u;
      cur.putOI = (cur.putOI ?? 0) + (l.putOI ?? 0) * u;
    } else byStrike.set(l.strike, { ...l, value: l.value * u, dex: (l.dex ?? 0) * u, vex: (l.vex ?? 0) * u, vanna: l.vanna === undefined ? undefined : l.vanna * u, charm: l.charm === undefined ? undefined : l.charm * u, callOI: (l.callOI ?? 0) * u, putOI: (l.putOI ?? 0) * u });
  }
  return [...byStrike.values()].sort((x, y) => x.strike - y.strike);
}

/* Vanna and charm joined the per-minute history on 2026-09-13; a fold from
   before that carries neither, and then a rewound node keeps the live node's
   legs for them (the template below) rather than speaking zeros. */
const EMPTY_NODE: Omit<StrikeNode, 'strike'> = { callOI: 0, putOI: 0, gamma: 0, callGex: 0, putGex: 0, netGex: 0, callDex: 0, putDex: 0, netDex: 0, callVex: 0, putVex: 0, netVex: 0, vanna: 0, charm: 0, callVanna: 0, putVanna: 0, netVanna: 0, callCharm: 0, putCharm: 0, netCharm: 0 };

/** The market as it stood at a position — the live snapshot's shape, the book of that moment */
export function snapshotAt(live: MarketSnapshot, range: ReplayRange, pos: number): MarketSnapshot {
  const bars = barsAt(range, pos);
  const spot = spotAt(range, pos);
  const template = new Map(live.chain.map(n => [n.strike, n]));
  const chain: StrikeNode[] = levelsAt(range, pos).map(l => {
    const t = template.get(l.strike);
    const callOI = l.callOI ?? t?.callOI ?? 0;
    const putOI = l.putOI ?? t?.putOI ?? 0;
    /* both legs share the strike's gamma, so net gamma splits by the legs' weighted open interest */
    const wc = callOI * W_CALL;
    const wp = putOI * W_PUT;
    const denom = wc + wp;
    const callGex = denom !== 0 ? (l.value * wc) / denom : t?.callGex ?? 0;
    const putGex = denom !== 0 ? (l.value * wp) / denom : t?.putGex ?? 0;
    const dex = l.dex ?? t?.netDex ?? 0;
    const vex = l.vex ?? t?.netVex ?? 0;
    const dexShare = t && t.netDex !== 0 ? t.callDex / t.netDex : 0.5;
    const vexShare = t && t.netVex !== 0 ? t.callVex / t.netVex : 0.5;
    const vanna = l.vanna ?? t?.netVanna ?? 0;
    const charm = l.charm ?? t?.netCharm ?? 0;
    const vannaShare = t && t.netVanna !== 0 ? t.callVanna / t.netVanna : 0.5;
    const charmShare = t && t.netCharm !== 0 ? t.callCharm / t.netCharm : 0.5;
    return {
      ...(t ?? { strike: l.strike, ...EMPTY_NODE }),
      strike: l.strike,
      callOI,
      putOI,
      callGex,
      putGex,
      netGex: l.value,
      callDex: dex * dexShare,
      putDex: dex * (1 - dexShare),
      netDex: dex,
      callVex: vex * vexShare,
      putVex: vex * (1 - vexShare),
      netVex: vex,
      callVanna: vanna * vannaShare,
      putVanna: vanna * (1 - vannaShare),
      netVanna: vanna,
      callCharm: charm * charmShare,
      putCharm: charm * (1 - charmShare),
      netCharm: charm,
    };
  });
  const open = range.bars[0].open;
  return {
    ...live,
    spot,
    changePercent: open > 0 ? ((spot - open) / open) * 100 : 0,
    priceHistory: bars.map(b => b.close),
    chain: chain.length ? chain : live.chain,
    tape: [],
  };
}
