/*
==================================================
  SLAYER TERMINAL - DARK POOL TYPES (darkpool.ts)
  Off-exchange prints with the read attached: not
  just "a block traded" but who is likely behind it
  and what to do about the level it printed at.
==================================================
*/

/** What the print is most likely doing — the read, not just the tape line. */
export type DarkPoolIntent = 'ACCUMULATION' | 'DISTRIBUTION' | 'HEDGE FLOW' | 'ROTATION';

export interface DarkPoolPrint {
  id: number;
  time: string;
  ticker: string;
  price: number;
  size: number;
  /** Dollars */
  notional: number;
  venue: string;
  /** Signed % distance of the print from current spot */
  vsSpotPct: number;
  /** Print landed on one of the session's tracked liquidity shelves */
  atLevel: boolean;
  intent: DarkPoolIntent;
  /** 0–100 — how confident the classifier is in the intent */
  conviction: number;
  /** One-line human read of the print */
  read: string;
}

export type LevelRole = 'SUPPORT' | 'RESISTANCE' | 'PIVOT';

export interface DarkPoolLevel {
  price: number;
  /** Aggregate off-exchange dollars transacted at this shelf */
  notional: number;
  prints: number;
  /** Share of session dark-pool notional, 0–100 */
  sharePct: number;
  role: LevelRole;
  /** Times intraday price reversed off this shelf */
  defended: number;
  /** Signed % distance from spot */
  distPct: number;
  /** How to actually trade against the shelf */
  usage: string;
}

export type Posture = 'ACCUMULATING' | 'DISTRIBUTING' | 'BALANCED';

// ---- sector leaders (the market-wide view) ----------------------------------

export interface DarkLeaderRow {
  ticker: string;
  price: number;
  /** Day direction — drives the tiny price arrow */
  dirUp: boolean;
  /** Dark notional today, dollars */
  notional: number;
  /** Dark volume as % of the name's average daily volume */
  pctAvgVol: number;
  /** Shares printed dark */
  size: number;
}

export interface DarkSector {
  sector: string;
  /** Sector identity color (categorical) */
  color: string;
  notional: number;
  /** Share of total dark notional, 0–100 */
  sharePct: number;
  prints: number;
  /** Top tickers by dark notional, descending */
  rows: DarkLeaderRow[];
}

export interface DarkLeadersView {
  totalNotional: number;
  totalPrints: number;
  updated: string;
  /** Sorted by notional, descending — the leaders */
  sectors: DarkSector[];
}

export interface DarkPoolView {
  ticker: string;
  spot: number;
  /** % of total session volume executed off-exchange */
  dpSharePct: number;
  /** −100…+100 — net accumulation vs distribution across sized prints */
  netPosturePct: number;
  posture: Posture;
  postureNote: string;
  totalNotional: number;
  levels: DarkPoolLevel[];
  prints: DarkPoolPrint[];
  largest: DarkPoolPrint | null;
}
