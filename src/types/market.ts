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
  /* THE FIELD'S PROVENANCE (data/feed/trailField.ts, 2026-10-13) — a modeled cell on the feed: 'modeled' when at least
     half its gamma was priced on a vol read today, 'carried' when most of it stood on the session before's close vol;
     `staleSince` the oldest trade (epoch ms) a vol it used came from — `staleBound` when that trade's own time is not
     known and `staleSince` is the latest it can be (UW stamps a contract after the close with a batch time, not its
     print's); `coverage` the share priced on today's vols. Absent on the house's own field and on a book read as it
     stood. */
  prov?: 'modeled' | 'carried';
  staleSince?: number;
  staleBound?: boolean;
  /** The newest trade (epoch ms) a vol it used came from — the vols are "as traded to" this moment */
  freshAt?: number;
  /** The share of the strike's gamma priced on a vol older than an hour at the column's clock (carried vols included) */
  staleShare?: number;
  coverage?: number;
  /** When the cell is a bar's peak minute (timeframe.ts aggregateSnapshots), that minute's own time (epoch s) */
  at?: number;
  /** Net GEX at this strike (summed across expiries), signed dollars */
  value: number;
  /** THE GROSS GAMMA AT THE STRIKE (the owner's B3, 2026-10-14): |calls| + |puts|, sign-agnostic, the units of `value`
      — a mark's SIZE on the map, the net's share of it the mark's colour strength. Absent where a tape keeps the net
      alone (store rows written before 2026-10-14): the map then sizes by |net| and its legend says so. */
  gross?: number;
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
  /** The price the moment was figured at — each column's own flip and walls are read against it (optional: an older
      snapshot reads its window's middle) */
  spot?: number;
  /** A moment rebuilt from the chain or held from a date's book, not a book read as it stood (data/feed/trailField.ts):
      its beads draw a step quieter. Absent on a measured book and on the house's own field. */
  rebuilt?: boolean;
  /** THE EXPIRY WINDOWS' PARTS (data/feed/trailModel.ts PART_STRIDE, the owner's item 6): each level's sums by expiry
      partition, in the levels' order — the window views add them up. Absent off the model. */
  parts?: Float32Array;
  /** THE CHARM-TO-CLOSE DRIFT (the owner's item 10, trailModel driftToClose): the dealers' delta in dollars of the
      underlying, house's sign, repriced at 3:50 pm New York at this moment's price and vols, minus now's — by expiry
      partition (driftOf sums a window). Absent off the model, at or past 3:50 pm, and with none of today's contracts. */
  drift?: Float64Array;
  /** A PRECOMPUTED COLUMN (Section I, src/data/feed/tiles.ts — the server folds a past session to every timeframe at
      rebuild time, so a zoomed-out view never folds minute rows on the fly): what the renderer would otherwise read off
      the per-minute store — the session's bead references as of the column's last minute (the net's p85 and p95, the
      gross's p85, the delta's p85 and p95; the minutes counted and the last one) and the walls the one stick held then,
      with their states. Absent on a column folded in the page. */
  pre?: TileColumnPre;
}

export interface TileColumnPre {
  ref: number;
  ring: number;
  refG: number;
  refD: number;
  ringD: number;
  minutes: number;
  /** the last minute counted, epoch s */
  at: number;
  /** the column's net at that last minute — the regime as it stood when the bar closed (the regime strip's reading) */
  net: number;
  cw: number | null;
  pw: number | null;
  cwState: 'holding' | 'broken' | 'reclaimed' | null;
  pwState: 'holding' | 'broken' | 'reclaimed' | null;
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
  /** Contracts traded today at the strike, calls and puts — on a feed snapshot, the vendor's count (NaN until it lands) */
  volume?: number;
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
  /** 'feed' when built from the vendor's answers (data/feed/pinpointMarket.ts) — the engines read its figures as they
      come: no leg texture, the day's own volume */
  src?: 'feed';
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
