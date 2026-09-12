/*
==================================================
  SLAYER TERMINAL - SHARED DOMAIN TYPES (market.ts)
  Options chain, dealer exposure, trade plan & ledger models
==================================================
*/

/** Any listed symbol. Core sim tickers are seeded; others are synthesized on demand. */
export type TickerSymbol = string;

export interface TickerConfig {
  basePrice: number;
  currentPrice: number;
  iv: number;
  step: number;
}

export interface Greeks {
  deltaCall: number;
  deltaPut: number;
  gamma: number;
  vega: number;
  vanna: number;
  charmCall: number;
  charmPut: number;
  /** Per one POINT of rate, like vega is per one point of vol — P-24A. */
  rhoCall: number;
  rhoPut: number;
}

export interface Candle {
  /** Unix seconds, strictly increasing, bar-aligned */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface GexLevel {
  strike: number;
  /** Net GEX at this strike (summed across expiries), signed dollars */
  value: number;
  /** Net delta exposure at the same instant, signed dollars — the trails
      follow the head's Greek (2026-09-06); optional so older folds still read */
  dex?: number;
  /** Net vega exposure at the same instant, signed dollars */
  vex?: number;
  /*
    OPEN INTEREST AT THE SAME INSTANT — the ΔOI heat's raw material. Carried
    on the GEX snapshot rather than in a store of its own so the two can
    never drift apart. Optional: a consumer must render absence rather than
    treat it as zero change.
  */
  callOI?: number;
  putOI?: number;
}

/** Net GEX across strikes captured at one bar-aligned moment. */
export interface GexSnapshot {
  time: number;
  levels: GexLevel[];
}

export interface Indicators {
  rsi: number;
  ema9: number;
  ema21: number;
  ema50: number;
  squeeze: boolean;
}

export interface StrikeNode {
  strike: number;
  callOI: number;
  putOI: number;
  gamma: number;
  callGex: number;
  putGex: number;
  netGex: number;
  callDex: number;
  putDex: number;
  netDex: number;
  callVex: number;
  putVex: number;
  netVex: number;
  /** The unit greeks at the strike — per contract, not exposures */
  vanna: number;
  charm: number;
  /** VANNA as an exposure: dollars of dealer delta per ONE POINT of vol, by leg —
      positive means a vol drop makes dealers buy stock there (2026-09-09) */
  callVanna: number;
  putVanna: number;
  netVanna: number;
  /** CHARM as an exposure: dollars of dealer delta the clock takes per DAY, by leg —
      negative means dealers buy stock there as the clock runs */
  callCharm: number;
  putCharm: number;
  netCharm: number;
}

export type TradeDirection = 'BULLISH' | 'BEARISH';

export interface TradePlan {
  ticker: TickerSymbol;
  direction: TradeDirection;
  score: number;
  confidence: number;
  entry: number;
  stopLoss: number;
  target1: number;
  target2: number;
  flipZone: number;
  supportWall: number;
  resistanceWall: number;
}

export interface TapeOrder {
  time: string;
  ticker: TickerSymbol;
  strike: string;
  type: 'C' | 'P';
  size: number;
  orderType: 'SWEEP' | 'BLOCK';
  side: 'ASK' | 'BID';
}

export interface MarketSnapshot {
  ticker: TickerSymbol;
  spot: number;
  changePercent: number;
  priceHistory: number[];
  chain: StrikeNode[];
  indicators: Indicators;
  plan: TradePlan;
  tape: TapeOrder[];
}

export type TradeStatus = 'OPEN' | 'WIN' | 'LOSS';

export interface TradeRecord {
  id: string;
  ticker: string;
  direction: TradeDirection;
  entryPrice: number;
  stopLoss: number;
  target: number;
  exitPrice?: number;
  status: TradeStatus;
  pnl: number;
  accuracy: number;
  time: string;
}

export interface LedgerStats {
  winRate: number;
  profitFactor: number;
  avgAccuracy: number;
  totalPnL: number;
  count: number;
}

export interface ExecuteResult {
  success: boolean;
  message?: string;
  trade?: TradeRecord;
}
