/*
==================================================
  SLAYER TERMINAL - EQUITY UNIVERSE (universe.ts)
  The shared large-cap universe every research module
  reads from — Stocks, News, Earnings, Compass and
  Trace all key off the same names so cross-module
  stories line up (a headline moves the same ticker
  the sector board ranks).
==================================================
*/

export type Sector =
  | 'Technology'
  | 'Communication'
  | 'Consumer Discretionary'
  | 'Financials'
  | 'Energy'
  | 'Health Care'
  | 'Industrials'
  | 'Consumer Staples'
  | 'Utilities'
  | 'Materials';

export interface UniverseName {
  ticker: string;
  name: string;
  sector: Sector;
  /** Reference price the deterministic feeds oscillate around */
  px: number;
  beta: number;
}

export const UNIVERSE: UniverseName[] = [
  { ticker: 'AAPL', name: 'Apple', sector: 'Technology', px: 232.4, beta: 1.1 },
  { ticker: 'MSFT', name: 'Microsoft', sector: 'Technology', px: 448.1, beta: 0.95 },
  { ticker: 'NVDA', name: 'NVIDIA', sector: 'Technology', px: 138.6, beta: 1.7 },
  { ticker: 'AMD', name: 'Advanced Micro Devices', sector: 'Technology', px: 164.2, beta: 1.6 },
  { ticker: 'AVGO', name: 'Broadcom', sector: 'Technology', px: 172.8, beta: 1.2 },
  { ticker: 'TSM', name: 'TSMC', sector: 'Technology', px: 191.3, beta: 1.3 },
  { ticker: 'ASML', name: 'ASML', sector: 'Technology', px: 742.6, beta: 1.35 },
  { ticker: 'CRM', name: 'Salesforce', sector: 'Technology', px: 268.3, beta: 1.25 },
  { ticker: 'GOOGL', name: 'Alphabet', sector: 'Communication', px: 186.9, beta: 1.05 },
  { ticker: 'META', name: 'Meta Platforms', sector: 'Communication', px: 542.7, beta: 1.3 },
  { ticker: 'NFLX', name: 'Netflix', sector: 'Communication', px: 689.5, beta: 1.35 },
  { ticker: 'AMZN', name: 'Amazon', sector: 'Consumer Discretionary', px: 198.2, beta: 1.2 },
  { ticker: 'TSLA', name: 'Tesla', sector: 'Consumer Discretionary', px: 254.8, beta: 2.0 },
  /* The Chinese EV complex, as their US listings — the wire's China stories need names to land on */
  { ticker: 'BYDDY', name: 'BYD', sector: 'Consumer Discretionary', px: 68.4, beta: 1.4 },
  { ticker: 'NIO', name: 'NIO', sector: 'Consumer Discretionary', px: 5.2, beta: 2.1 },
  { ticker: 'XPEV', name: 'XPeng', sector: 'Consumer Discretionary', px: 12.8, beta: 2.0 },
  { ticker: 'LI', name: 'Li Auto', sector: 'Consumer Discretionary', px: 24.6, beta: 1.6 },
  { ticker: 'HD', name: 'Home Depot', sector: 'Consumer Discretionary', px: 362.1, beta: 0.95 },
  { ticker: 'JPM', name: 'JPMorgan Chase', sector: 'Financials', px: 214.6, beta: 1.05 },
  { ticker: 'GS', name: 'Goldman Sachs', sector: 'Financials', px: 486.3, beta: 1.25 },
  { ticker: 'BAC', name: 'Bank of America', sector: 'Financials', px: 41.7, beta: 1.15 },
  { ticker: 'XOM', name: 'Exxon Mobil', sector: 'Energy', px: 116.4, beta: 0.85 },
  { ticker: 'CVX', name: 'Chevron', sector: 'Energy', px: 154.2, beta: 0.9 },
  { ticker: 'COP', name: 'ConocoPhillips', sector: 'Energy', px: 108.7, beta: 1.0 },
  { ticker: 'OXY', name: 'Occidental', sector: 'Energy', px: 52.3, beta: 1.15 },
  { ticker: 'UNH', name: 'UnitedHealth', sector: 'Health Care', px: 512.3, beta: 0.7 },
  { ticker: 'LLY', name: 'Eli Lilly', sector: 'Health Care', px: 824.6, beta: 0.8 },
  { ticker: 'JNJ', name: 'Johnson & Johnson', sector: 'Health Care', px: 152.9, beta: 0.55 },
  { ticker: 'CAT', name: 'Caterpillar', sector: 'Industrials', px: 348.5, beta: 1.1 },
  { ticker: 'BA', name: 'Boeing', sector: 'Industrials', px: 182.4, beta: 1.4 },
  { ticker: 'GE', name: 'GE Aerospace', sector: 'Industrials', px: 168.7, beta: 1.15 },
  { ticker: 'WMT', name: 'Walmart', sector: 'Consumer Staples', px: 78.6, beta: 0.55 },
  { ticker: 'COST', name: 'Costco', sector: 'Consumer Staples', px: 872.4, beta: 0.8 },
  { ticker: 'PG', name: 'Procter & Gamble', sector: 'Consumer Staples', px: 168.2, beta: 0.45 },
  { ticker: 'NEE', name: 'NextEra Energy', sector: 'Utilities', px: 74.8, beta: 0.6 },
  { ticker: 'LIN', name: 'Linde', sector: 'Materials', px: 452.6, beta: 0.85 },
];

export const SECTORS: Sector[] = [
  'Technology',
  'Communication',
  'Consumer Discretionary',
  'Financials',
  'Energy',
  'Health Care',
  'Industrials',
  'Consumer Staples',
  'Utilities',
  'Materials',
];

export function bySector(sector: Sector): UniverseName[] {
  return UNIVERSE.filter(u => u.sector === sector);
}

export function lookup(ticker: string): UniverseName | undefined {
  return UNIVERSE.find(u => u.ticker === ticker);
}
