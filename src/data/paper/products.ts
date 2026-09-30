/*
==================================================
  SLAYER TERMINAL - PAPER · WHAT IT TRADES ON
  (data/paper/products.ts)

  PAPER TRADES OPTIONS, AND ONLY OPTIONS (2026-09-30:
  "on the paper trading remove all the futures and make
  it strictly Options trading"). What the Live Chart
  offers is a NAME — a stock, a fund, or one of the
  three indexes below — and the thing bought on it is
  one of its contracts, off its chain. Nothing here is
  a thing to be bought by itself.

  THE INDEXES (2026-09-22 — Noah: "we will have index
  options so make our price feed carry that"). Each is
  made from its fund at the index's own ratio to it, no
  carry. Their options are listed the way the funds'
  are (dailies, weeklies, monthlies) on the index's own
  strike spacing, and settle in cash at the bell.

  THE FUTURES THAT WERE (to 2026-09-30). ES, MES, NQ,
  MNQ, RTY and M2K were traded on Paper, long or short,
  on margin. They are not offered any more — not on the
  chart, not in the picker, not in an evaluation — but a
  paper account is its fills, and its cash is added up
  from them (engine.ts viewOf), so an account that
  traded one before still carries those fills. The
  table below is kept to READ that history (the
  journal's point value and print), and for nothing
  else: no function here makes a future's price, and
  nothing in the paper engine can place one. The
  backtest's own futures (review/futuresTape.ts) are a
  different desk and are untouched.
==================================================
*/

import { FUT_PRODUCTS, type FutProduct } from '../review/futuresTape';

/* ---- the indexes, whose options Paper trades beside the stocks' ---- */
export interface PaperIndex {
  symbol: string;
  name: string;
  /** The fund it is made from, and the index's ratio to it */
  fund: string;
  ratio: number;
  /** The distance between listed strikes near the money */
  step: number;
}
export const PAPER_INDEXES: PaperIndex[] = [
  { symbol: 'SPX', name: 'S&P 500 index', fund: 'SPY', ratio: 10, step: 5 },
  { symbol: 'NDX', name: 'Nasdaq-100 index', fund: 'QQQ', ratio: 41, step: 25 },
  { symbol: 'RUT', name: 'Russell 2000 index', fund: 'IWM', ratio: 10, step: 5 },
];
const INDEX_BY_SYMBOL = new Map(PAPER_INDEXES.map(x => [x.symbol, x]));
export const isPaperIndex = (symbol: string): boolean => INDEX_BY_SYMBOL.has(symbol.toUpperCase());
export const paperIndex = (symbol: string): PaperIndex | null => INDEX_BY_SYMBOL.get(symbol.toUpperCase()) ?? null;
/** An index's level from its fund's price */
export const indexOfFund = (x: PaperIndex, fund: number): number => Math.round(fund * x.ratio * 100) / 100;

/* ---- the futures that were: READ-ONLY history (see the head) ---- */
export interface PaperFutProduct extends FutProduct {
  /** The fund it was priced off, the index's ratio to it, and the carry it was priced with */
  fund: string;
  ratio: number;
  carry: number;
}
const of = (symbol: string): FutProduct => FUT_PRODUCTS.find(p => p.symbol === symbol)!;
const RETIRED_FUTURES: PaperFutProduct[] = [
  { ...of('ES'), fund: 'SPY', ratio: 10, carry: 12 },
  { ...of('MES'), fund: 'SPY', ratio: 10, carry: 12 },
  { ...of('NQ'), fund: 'QQQ', ratio: 41, carry: 45 },
  { ...of('MNQ'), fund: 'QQQ', ratio: 41, carry: 45 },
  { symbol: 'RTY', name: 'Russell 2000 futures', pointValue: 50, tick: 0.1, decimals: 2, margin: 1000, fee: 2, px: 2217, vol: 0.21, months: 'HMUZ', roll: { monthsBefore: 0, day: 10 }, fund: 'IWM', ratio: 10, carry: 6 },
  { symbol: 'M2K', name: 'Micro Russell 2000 futures', pointValue: 5, tick: 0.1, decimals: 2, margin: 100, fee: 0.5, px: 2217, vol: 0.21, months: 'HMUZ', roll: { monthsBefore: 0, day: 10 }, fund: 'IWM', ratio: 10, carry: 6 },
];
const RETIRED_BY_SYMBOL = new Map(RETIRED_FUTURES.map(p => [p.symbol, p]));
/** A symbol Paper used to trade as a future — what a stored desk pane or an old fill may still name */
export const isRetiredFuture = (symbol: string): boolean => RETIRED_BY_SYMBOL.has(symbol.toUpperCase());
/** The index a retired future followed — where a desk pane that showed ES now shows SPX */
export const indexForRetired = (symbol: string): string | null => {
  const p = RETIRED_BY_SYMBOL.get(symbol.toUpperCase());
  return p ? (PAPER_INDEXES.find(x => x.fund === p.fund)?.symbol ?? p.fund) : null;
};
/** A retired future's contract terms — its point value and its print, for the history that names one */
export const paperFut = (symbol: string): PaperFutProduct => RETIRED_BY_SYMBOL.get(symbol.toUpperCase()) ?? RETIRED_FUTURES[0];
/** A price in the retired product's own print: "5,262.25" */
export const futWords = (symbol: string, v: number): string => {
  const p = paperFut(symbol);
  return v.toLocaleString('en-US', { minimumFractionDigits: p.decimals, maximumFractionDigits: p.decimals });
};
