/*
==================================================
  SLAYER TERMINAL - PAPER · THE FUTURES IT TRADES
  (data/paper/products.ts)

  The rules page's table (docs/paper-rules.md,
  "Futures"), as data — apart from the feed so the
  engine and its proof can read a product without
  starting the simulator. The backtest's own rows where
  it has them (ES, MES, NQ, MNQ: the same point, tick,
  margin and fee), the Russell pair beside them. Each
  says what live price it is made from: a fund, the
  index's ratio to it, and a fixed carry.
==================================================
*/

import { FUT_PRODUCTS, frontContractOf, onTick, type FutProduct } from '../review/futuresTape';

export interface PaperFutProduct extends FutProduct {
  /** The fund it is priced off, the index's ratio to it, and the fixed carry in index points */
  fund: string;
  ratio: number;
  carry: number;
}
const of = (symbol: string): FutProduct => FUT_PRODUCTS.find(p => p.symbol === symbol)!;
export const PAPER_FUTURES: PaperFutProduct[] = [
  { ...of('ES'), fund: 'SPY', ratio: 10, carry: 12 },
  { ...of('MES'), fund: 'SPY', ratio: 10, carry: 12 },
  { ...of('NQ'), fund: 'QQQ', ratio: 41, carry: 45 },
  { ...of('MNQ'), fund: 'QQQ', ratio: 41, carry: 45 },
  { symbol: 'RTY', name: 'Russell 2000 futures', pointValue: 50, tick: 0.1, decimals: 2, margin: 1000, fee: 2, px: 2217, vol: 0.21, months: 'HMUZ', roll: { monthsBefore: 0, day: 10 }, fund: 'IWM', ratio: 10, carry: 6 },
  { symbol: 'M2K', name: 'Micro Russell 2000 futures', pointValue: 5, tick: 0.1, decimals: 2, margin: 100, fee: 0.5, px: 2217, vol: 0.21, months: 'HMUZ', roll: { monthsBefore: 0, day: 10 }, fund: 'IWM', ratio: 10, carry: 6 },
];
const BY_SYMBOL = new Map(PAPER_FUTURES.map(p => [p.symbol, p]));

/* THE INDEXES (2026-09-22 — Noah: "we will have index options so make our price feed carry that"). Each is made from its
   fund at the ratio its futures use and NO carry — a future trades over its index by its carry, so ES less SPX is ES's 12
   points, as it should be. Their options are listed the way the funds' are (dailies, weeklies, monthlies) on the index's
   own strike spacing, and settle in cash at the bell. */
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
export const isPaperFuture = (symbol: string): boolean => BY_SYMBOL.has(symbol.toUpperCase());
export const paperFut = (symbol: string): PaperFutProduct => BY_SYMBOL.get(symbol.toUpperCase()) ?? PAPER_FUTURES[0];
/** A micro is a tenth of its big contract — what an evaluation's contract count reads */
export const isMicro = (symbol: string): boolean => /^M(ES|NQ|2K)$/.test(symbol.toUpperCase());
/** Big contracts a position of this many is, for an evaluation's cap: ten micros are one */
export const bigOf = (symbol: string, qty: number): number => (isMicro(symbol) ? qty / 10 : qty);
/** The front month on a trading day ("ESZ6") */
export const frontOn = (symbol: string, day: string): string => frontContractOf(paperFut(symbol), day);
/** What a price of the fund is as a price of the future */
export const futOfFund = (p: PaperFutProduct, v: number): number => onTick(p, v * p.ratio + p.carry);
/** A price in the product's own print: "5,262.25" */
export const futWords = (symbol: string, v: number): string => {
  const p = paperFut(symbol);
  return v.toLocaleString('en-US', { minimumFractionDigits: p.decimals, maximumFractionDigits: p.decimals });
};
