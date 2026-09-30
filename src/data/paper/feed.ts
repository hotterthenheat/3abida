/*
==================================================
  SLAYER TERMINAL - PAPER · THE LIVE FEED'S SEAM
  (data/paper/feed.ts)

  Everything the paper account knows about the live
  market comes through this file — the way tape.ts +
  quotes.ts are the backtest's. TODAY IT READS THE
  SIMULATOR; when the real feed is wired in, this file
  changes and nothing above it does (docs/paper-
  rules.md, "The prices").

    a name's price         the simulator's last tick
    an option's quote      the BACKTEST'S OWN PRICER
                           (quotes.ts `priceWith`) on the
                           real clock (clock.ts) and the
                           name's live vol — the same bid,
                           ask and greeks a backtest gets
    what is listed         the backtest's expiry list,
                           from today; today's leaves at
                           16:00
    an index               SPX · NDX · RUT (2026-09-22): the
                           fund × the same ratio, no carry —
                           its level, its candles, its vol and
                           its strike spacing; its options are
                           a name's, on the same pricer; its
                           candles are its fund's, turned
    the chart's moment     the instant of the newest bar —
                           where a fill's arrow is drawn

  NO FUTURE IS PRICED HERE (2026-09-30): Paper trades
  options, and only options (products.ts).

  THE SIMULATOR IS A NEW MARKET ON EVERY PAGE LOAD
  (core/simulator.ts: Math.random, a month seeded per
  load). SIM_FEED says so to everything above, and
  LIFE names this page load, so what was opened in
  another one can be told apart (the rules page, "When
  the page closes"). With the real feed SIM_FEED goes
  false and that section of the rules goes away.
==================================================
*/

import Simulator from '../../core/simulator';
import type { Candle } from '../../types/market';
import type { DeskChain, DeskContract } from '../weigherDesk';
import type { Expiry } from '../../core/calendar';
import { dteAt, expiriesAt, priceWith, type ContractId, type ListedExpiry, type Quote } from '../review/quotes';
import { bellOf, nyAt, sessionFrom, yearsToExpiry } from './clock';
import { indexOfFund, paperIndex } from './products';

/** The feed is the simulator: a new market every page load, trading round the clock */
export const SIM_FEED = true;
/** This page load's name — what a position opened here carries, so the next load knows it is not its own */
export const LIFE = `${Date.now().toString(36)}${Math.floor(Math.random() * 46656).toString(36)}`;

/* ---- a name ---- */
/** The name as the simulator keys it — seeded the first time it is asked for */
const sym = (ticker: string): string => Simulator.ensureTicker(ticker);
/* AN INDEX IS NEVER ASKED OF THE SIMULATOR BY ITS OWN NAME — that would start a second, unrelated walk for it; it is its
   fund's, turned (products.ts) */
/** Where the name trades now — an index at its fund × the ratio */
export const spotOf = (ticker: string): number => {
  const x = paperIndex(ticker);
  return x ? indexOfFund(x, Simulator.TICKERS[sym(x.fund)].currentPrice) : Simulator.TICKERS[sym(ticker)].currentPrice;
};
/** The name's own vol — what its chain is priced off (an index: its fund's) */
export const baseIvOf = (ticker: string): number => Simulator.TICKERS[sym(paperIndex(ticker)?.fund ?? ticker)].iv;
/** The distance between the name's listed strikes (an index: its own — SPX 5, NDX 25, RUT 5) */
export const stepOf = (ticker: string): number => paperIndex(ticker)?.step ?? Simulator.TICKERS[sym(ticker)].step;
/** The name's candles (one minute a bar, oldest first) — the simulator's own array, read-only; an index's, its fund's
    turned into its level */
export const candlesOf = (ticker: string): Candle[] => (paperIndex(ticker) ? indexCandles(ticker) : (Simulator.getCandles(ticker) ?? []));
/** THE CHART'S MOMENT: the instant (seconds) of the newest bar of what the chart draws — a fill's arrow lands there. On the
    simulator this is ITS clock, which runs faster than the wall's; with the real feed it is the wall's. */
export const barNowOf = (ticker: string): number => {
  const bars = Simulator.peekCandles(paperIndex(ticker)?.fund ?? ticker);
  return bars?.length ? bars[bars.length - 1].time : Math.floor(Date.now() / 1000);
};

/* ---- an option ---- */
/** The quote now — the backtest's pricer on the real clock */
export const optionQuote = (c: ContractId, ms: number, spot = spotOf(c.ticker)): Quote => priceWith(c, spot, yearsToExpiry(c.expiry, ms), baseIvOf(c.ticker));
/** The same contract with the name somewhere else, now — where a way out on the contract's price is drawn on the chart */
export const optionQuoteAt = (c: ContractId, ms: number, spot: number): Quote => optionQuote(c, ms, spot);
/** Where the name would have to stand NOW for the contract to bid `bid` — the nearest such place (quotes.ts spotForBid's
    walk, on the live quote) */
export const spotForBidNow = (c: ContractId, ms: number, bid: number): number | null => spotForQuoteNow(c, ms, bid, 'bid');
/** …and to ASK `ask` — where a resting buy limit is drawn on the chart: it fills when the ask comes down to it */
export const spotForAskNow = (c: ContractId, ms: number, ask: number): number | null => spotForQuoteNow(c, ms, ask, 'ask');
function spotForQuoteNow(c: ContractId, ms: number, bid: number, which: 'bid' | 'ask'): number | null {
  const here = spotOf(c.ticker);
  const at = (s: number) => optionQuote(c, ms, s)[which];
  const now = at(here);
  if (Math.abs(now - bid) < 0.005) return Math.round(here * 100) / 100;
  const up = (bid > now) === (c.right === 'C');
  const end = up ? here * 1.8 : here * 0.4;
  const STEPS = 90;
  let a = here;
  let fa = now - bid;
  for (let i = 1; i <= STEPS; i++) {
    const b = here + (end - here) * Math.pow(i / STEPS, 2);
    const fb = at(b) - bid;
    if (fa === 0 || fa * fb <= 0) {
      let lo = a;
      let hi = b;
      let flo = fa;
      for (let k = 0; k < 40; k++) {
        const mid = (lo + hi) / 2;
        const fm = at(mid) - bid;
        if (flo * fm <= 0) hi = mid;
        else {
          lo = mid;
          flo = fm;
        }
      }
      return Math.round(((lo + hi) / 2) * 100) / 100;
    }
    a = b;
    fa = fb;
  }
  return null;
}
/** The expiries listed now: the backtest's list from today — today's own is gone once 16:00 has rung */
export function listedNow(ticker: string, ms: number): ListedExpiry[] {
  const t = nyAt(ms);
  const from = sessionFrom(t.date);
  return expiriesAt(ticker.toUpperCase(), from).filter(e => bellOf(e.iso) > ms);
}
export interface LiveChainRow {
  strike: number;
  call: Quote;
  put: Quote;
}
/** The strikes round the money, `each` a side, highest first. `centre` holds the ladder on a price that stays put. */
export function liveChain(ticker: string, expiry: string, ms: number, each = 12, centre?: number): { spot: number; rows: LiveChainRow[] } {
  const spot = spotOf(ticker);
  const step = stepOf(ticker);
  const mid = Math.round((centre ?? spot) / step) * step;
  const rows: LiveChainRow[] = [];
  for (let i = each; i >= -each; i--) {
    const strike = Math.round((mid + i * step) * 100) / 100;
    if (strike <= 0) continue;
    rows.push({ strike, call: optionQuote({ ticker, strike, right: 'C', expiry }, ms, spot), put: optionQuote({ ticker, strike, right: 'P', expiry }, ms, spot) });
  }
  return { spot, rows };
}
/* ---- THE CHAIN AS THE WEIGHER DRAWS IT (the Live Chart's options, 2026-09-22 — Noah: "you would need the actual
   options chain to see the vol, decay etc like we have for the dropdown of the weigher options chain"). The rows the paper
   account trades, priced by the same pricer, dressed in every fact the Weigher's chain shows — so the price in the chain
   is the price a press gets. The session's high, low and open are read ONCE for the whole chain. ---- */
/** Abramowitz–Stegun N(x) — the same approximation the Weigher's chain uses */
function normalCdf(x: number): number {
  const k = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804 * Math.exp((-x * x) / 2);
  const p = k * (0.31938153 + k * (-0.356563782 + k * (1.781477937 + k * (-1.821255978 + k * 1.330274429))));
  return x >= 0 ? 1 - d * p : d * p;
}
/** A seeded 0..1 — the day's sizes and interest hold still between ticks */
function seeded(k: string): number {
  let h = 2166136261;
  for (let i = 0; i < k.length; i++) {
    h ^= k.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export function liveDeskChain(ticker: string, expiry: string, ms: number, each = 20, centre?: number): DeskChain {
  const { spot, rows } = liveChain(ticker, expiry, ms, each, centre);
  const bars = candlesOf(ticker).slice(-390);
  const hi = bars.length ? Math.max(...bars.map(b => b.high)) : spot;
  const lo = bars.length ? Math.min(...bars.map(b => b.low)) : spot;
  const open = bars[0]?.open ?? spot;
  const t = yearsToExpiry(expiry, ms);
  const base = baseIvOf(ticker);
  const today = nyAt(ms).date;
  const big = ['SPY', 'QQQ', 'IWM'].includes(ticker) || !!paperIndex(ticker);
  const dress = (c: ContractId, q: Quote): DeskContract => {
    const at = (s: number, years = t) => priceWith(c, s, years, base).mark;
    const a = at(hi);
    const b = at(lo);
    const prevClose = bars.length ? at(open, t + 1 / 252) : q.mark;
    const sigma = Math.max(0.01, q.iv || base);
    const sd = sigma * Math.sqrt(Math.max(t, 1 / (252 * 390)));
    /* the odds the name finishes past a level at the expiry — N(d2), no drift */
    const past = (level: number) => {
      const d2 = (Math.log(spot / Math.max(0.01, level)) - (sigma * sigma * Math.max(t, 1 / (252 * 390))) / 2) / sd;
      return c.right === 'C' ? normalCdf(d2) : normalCdf(-d2);
    };
    const key = `${ticker}|${expiry}|${c.strike}|${c.right}|${today}`;
    const x = Math.log(c.strike / spot) / Math.max(0.01, sigma * Math.sqrt(Math.max(t, 1 / 252)));
    const size = (big ? 9000 : 2400) * Math.exp(-(x * x) / 1.6);
    const breakeven = c.right === 'C' ? c.strike + q.ask : c.strike - q.ask;
    const itm = past(c.strike) * 100;
    const profit = past(breakeven) * 100;
    const netChange = q.mark - prevClose;
    return {
      strike: c.strike,
      right: c.right,
      mark: q.mark,
      delta: q.delta,
      gamma: q.gamma,
      theta: q.theta,
      vega: q.vega,
      iv: sigma * 100,
      itmOdds: itm,
      rho: q.rho,
      bid: q.bid,
      ask: q.ask,
      high: Math.max(a, b, q.mark),
      low: Math.min(a, b, q.mark),
      prevClose,
      last: q.mark,
      volume: Math.round(size * (0.6 + 0.8 * seeded(`${key}|v`))),
      oi: Math.round(size * (2.2 + 4 * seeded(`${key}|oi`))),
      breakeven: Math.round(breakeven * 100) / 100,
      fromSpotPct: ((c.strike - spot) / spot) * 100,
      bidSize: Math.round(10 + 190 * seeded(`${key}|bs`)),
      askSize: Math.round(10 + 190 * seeded(`${key}|as`)),
      netChange,
      netChangePct: prevClose > 0 ? (netChange / prevClose) * 100 : 0,
      toBreakevenPct: ((breakeven - spot) / spot) * 100,
      intrinsic: q.intrinsic,
      extrinsic: Math.max(0, q.mark - q.intrinsic),
      touchOdds: Math.min(100, itm * 2),
      profitOddsLong: profit,
      profitOddsShort: 100 - profit,
    };
  };
  const date = new Date(`${expiry}T12:00:00`);
  const dte = dteAt(today, expiry);
  const expiryFact: Expiry = { date, label: `${expiry.slice(5, 7)}/${expiry.slice(8, 10)}/${expiry.slice(2, 4)}`, weekday: WEEKDAYS[date.getDay()], dte, sessions: Math.max(0, Math.round(t * 252)) };
  return {
    ticker,
    spot,
    step: stepOf(ticker),
    /* LOWEST STRIKE FIRST, the Weigher's order — its grid turns them over to put the high strikes on top and slots the
       market's line between the two that bracket it (liveChain hands them highest first) */
    rows: [...rows].sort((x, y) => x.strike - y.strike).map(r => ({ strike: r.strike, call: dress({ ticker, strike: r.strike, right: 'C', expiry }, r.call), put: dress({ ticker, strike: r.strike, right: 'P', expiry }, r.put) })),
    expiry: expiryFact,
    /* the move the chain charges for by the expiry, ± percent of the name */
    expectedMovePct: base * Math.sqrt(Math.max(t, 1 / 252)) * 100,
  };
}

/* ---- the indexes (data/paper/products.ts) ---- */
export { PAPER_INDEXES, isPaperIndex, paperIndex } from './products';

/* CANDLES MADE FROM A FUND'S (an index's), kept up a bar at a time: the simulator appends a bar and rewrites
   the last one in place, so only the tail is turned again; a shifted buffer (its oldest bar dropped) is turned whole. A
   fresh array each time — the chart compares what it is handed. */
const turnedCache = new Map<string, { first: number; bars: Candle[] }>();
function turned(key: string, fund: string, turn: (b: Candle) => Candle): Candle[] {
  const src = Simulator.getCandles(fund) ?? [];
  if (!src.length) return [];
  const hit = turnedCache.get(key);
  if (!hit || hit.first !== src[0].time || hit.bars.length > src.length) {
    const bars = src.map(turn);
    turnedCache.set(key, { first: src[0].time, bars });
    return bars;
  }
  const bars = hit.bars.slice(0, Math.max(0, hit.bars.length - 1));
  for (let i = bars.length; i < src.length; i++) bars.push(turn(src[i]));
  turnedCache.set(key, { first: src[0].time, bars });
  return bars;
}
/** AN INDEX'S CANDLES: its fund's, at the index's level — an index trades nothing itself, so the fund's volume stands in */
export function indexCandles(symbol: string): Candle[] {
  const x = paperIndex(symbol);
  if (!x) return [];
  return turned(`idx:${x.symbol}`, x.fund, b => ({ time: b.time, open: indexOfFund(x, b.open), high: indexOfFund(x, b.high), low: indexOfFund(x, b.low), close: indexOfFund(x, b.close), volume: b.volume }));
}
