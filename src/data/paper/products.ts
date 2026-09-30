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

==================================================
*/

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
