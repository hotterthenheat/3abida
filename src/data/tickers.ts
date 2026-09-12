/*
  The searchable ticker universe: NASDAQ listings + common index ETFs bundled
  from nasdaqTickers.json (6,300+ symbols), completed with the NYSE-listed
  half of the S&P 500 from sp500.ts — the json alone couldn't find JPM, XOM,
  UNH or V (Noah, 2026-08-18). Used by every ticker search menu.
*/

import raw from './nasdaqTickers.json';
import { SP500_NYSE } from './sp500';

export interface TickerListing {
  symbol: string;
  name: string;
}

export const NASDAQ_TICKERS = raw as TickerListing[];

const bySymbol = new Map(NASDAQ_TICKERS.map(t => [t.symbol, t]));
// NYSE S&P members fill the json's gap; the json wins where both know a name.
for (const t of SP500_NYSE) if (!bySymbol.has(t.symbol)) bySymbol.set(t.symbol, t);

/** Household names pinned to the top of the dropdown and ranked first in
    search — ordered by prominence, not alphabet. Everything else follows
    alphabetically, so the resting list is never a wall of "A" names. */
const FEATURED = [
  'SPY', 'QQQ', 'IWM', 'NVDA', 'TSLA', 'AAPL', 'MSFT', 'AMZN', 'META', 'GOOGL',
  'AMD', 'NFLX', 'AVGO', 'PLTR', 'COIN', 'MSTR', 'SMCI', 'HOOD', 'MU', 'TSM',
  'INTC', 'ORCL', 'CRM', 'COST', 'ADBE', 'QCOM', 'SOFI',
];

// The bundled json predates a few of these listings — name them ourselves.
const FALLBACK_NAMES: Record<string, string> = {
  META: 'Meta Platforms, Inc.',
  PLTR: 'Palantir Technologies Inc.',
  COIN: 'Coinbase Global, Inc.',
  SMCI: 'Super Micro Computer, Inc.',
  HOOD: 'Robinhood Markets, Inc.',
  SOFI: 'SoFi Technologies, Inc.',
};

const featuredRank = new Map(FEATURED.map((s, i) => [s, i]));
const FEATURED_LISTINGS: TickerListing[] = FEATURED.map(
  s => bySymbol.get(s) ?? { symbol: s, name: FALLBACK_NAMES[s] ?? s }
);

/** Iteration order for the menu and for search: famous first, then the rest
    alphabetically (the NYSE merge would otherwise append after the Z's). */
const UNIVERSE: TickerListing[] = [
  ...FEATURED_LISTINGS,
  ...[...bySymbol.values()]
    .filter(t => !featuredRank.has(t.symbol))
    .sort((a, b) => a.symbol.localeCompare(b.symbol)),
];

export function tickerName(symbol: string): string {
  const sym = symbol.toUpperCase();
  return bySymbol.get(sym)?.name ?? FALLBACK_NAMES[sym] ?? sym;
}

/** Prefix matches first (by symbol), then symbol/name substring matches.
    Featured names outrank the alphabet inside each tier. */
export function searchTickers(query: string, limit = 60): TickerListing[] {
  const q = query.trim().toUpperCase();
  if (!q) return UNIVERSE.slice(0, limit);

  const prefix: TickerListing[] = [];
  const contains: TickerListing[] = [];
  for (const t of UNIVERSE) {
    if (t.symbol.startsWith(q)) prefix.push(t);
    else if (t.symbol.includes(q) || t.name.toUpperCase().includes(q)) contains.push(t);
    if (prefix.length >= limit) break;
  }
  return [...prefix, ...contains].slice(0, limit);
}
