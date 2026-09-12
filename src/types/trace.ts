/*
==================================================
  SLAYER TERMINAL - TRACE TYPES (trace.ts)
  Rich options-flow prints for the live tape.
==================================================
*/

export type StratTag = '—' | 'Vertical' | 'Butterfly' | 'Ratio' | 'Custom';

export interface FlowPrint {
  id: number;
  time: string;
  ticker: string;
  /** 1 = single leg; >1 renders the ×N multi-leg marker */
  legs: number;
  strike: number;
  right: 'C' | 'P';
  /** Signed % distance of strike from spot */
  otmPct: number;
  /** MM/DD/YYYY */
  expiry: string;
  dte: number;
  fill: number;
  bid: number;
  ask: number;
  /** Where the fill landed in the spread: 0 = at bid, 1 = at ask */
  fillPos: number;
  side: 'BID' | 'ASK' | 'MID';
  /** −100…+100 aggressor conviction */
  flowScore: number;
  /** e.g. "ASK 61%" / "MID" — dominant execution side for the contract today */
  ratioLabel: string;
  /** Bid-side share of the contract's day, 0–100 */
  ratioBidPct: number;
  size: number;
  /** Total premium of the print, dollars */
  premium: number;
  volume: number;
  oi: number;
  /** vs prior session; 0 = unchanged/unknown */
  deltaOI: number;
  spot: number;
  /** % */
  iv: number;
  volOverOI: number;
  strat: StratTag;
  sweep: boolean;
}

// ---- the day book (data/flowBook.ts) ----------------------------------------

/** One contract's whole day rolled up — the shared row every flow surface
    (screener, net flow, OI explorer, 0DTE, interval, multi-leg) reads. */
export interface BookContract {
  /** TICKER-STRIKE-RIGHT-DTE — stable across the day */
  key: string;
  ticker: string;
  sector: string | null;
  sectorColor: string | null;
  strike: number;
  right: 'C' | 'P';
  /** MM/DD/YYYY */
  expiry: string;
  dte: number;
  spot: number;
  /** Signed % distance of strike from spot — FlowPrint's convention */
  otmPct: number;
  /** Latest fill on the contract */
  last: number;
  /** Latest fill vs the day's opening fill, % */
  chgPct: number;
  /** HH:MM of the contract's most recent print */
  lastAt: string;
  /** Minute-of-day of that print — the recency sort key */
  lastAtMin: number;
  /** Day-cumulative contracts traded */
  volume: number;
  oi: number;
  /** vs prior session close */
  deltaOI: number;
  deltaOIPct: number;
  /** Day-cumulative premium, dollars */
  premium: number;
  /** % */
  iv: number;
  /** Signed IV points vs prior close */
  ivChg: number;
  volOverOI: number;
  /** Share of day volume that arrived in sweeps, 0-100 */
  sweepPct: number;
  /** Share tied to multi-leg structures, 0-100 */
  multiPct: number;
  /** Share executed on the floor — institutional crosses, 0-100 */
  floorPct: number;
  /** Ask-side share of the day's volume, 0-100 — bid side is the remainder */
  askPct: number;

  // -- the overnight ledger (Footprints reads these; day-stable) --
  /** Prior session's OI — deltaOI's base */
  prevOI: number;
  /** Prior session's volume — the day the position was built or unwound */
  prevVolume: number;
  /** Prior session's average fill, dollars */
  prevAvgFill: number;
  /** Prior session's premium total, dollars */
  prevPremium: number;
  /** Ask-side share of the PRIOR session's volume — which side built it */
  prevAskPct: number;
  /** Consecutive sessions OI has climbed; 0 = fell or flat yesterday */
  oiStreak: number;
  /** Consecutive sessions volume ran past standing OI */
  volGtOiStreak: number;
  /** Sessions until earnings, null = not reporting in the calendar window */
  earnDays: number | null;
  /** Prior session's volume by 15-min bucket, 26 values normalized 0-1 —
      the shape of the build, not a second volume fact */
  prevSpark: number[];
}

export type PrintSentiment = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

export interface LargestPrint {
  ticker: string;
  strike: number;
  right: 'C' | 'P';
  premium: number;
}

export interface TapeSummary {
  /** All premium on the tape, dollars */
  totalPremium: number;
  /** Bullish-premium minus bearish-premium, dollars */
  netPremium: number;
  bullish: boolean;
  bullPremium: number;
  bearPremium: number;
  callCount: number;
  callPremium: number;
  putCount: number;
  putPremium: number;
  pcRatio: number;
  rvol: number;
  sweeps: number;
  blocks: number;
  largest: LargestPrint | null;
}
