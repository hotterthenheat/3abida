/*
==================================================
  SLAYER TERMINAL - THE RECORD'S SHAPES (types/record.ts)

  What is on the record about a name that never
  appears on the tape: who inside a company traded
  its shares (SEC Form 4) and what members of
  Congress reported trading (the STOCK Act). These
  are THE SEAM: the simulator fills them today
  (data/insiders.ts, data/congress.ts), the live
  feed fills them later, and nothing above them
  changes. The two engines were the partner's
  (2026-09-09, ported into the house's words); the
  shapes are the real feeds' — brackets not figures,
  a three-state plan flag, the owner on every row.
==================================================
*/

/* ---- Congress ------------------------------------------------------------------ */

/** 'Executive' rides the same filings route on the feed (2026-10-12: the executive branch's periodic reports) */
export type Chamber = 'House' | 'Senate' | 'Executive';
export type Party = 'D' | 'R' | 'I';
/** The Senate keeps the partial/full split; the House feed collapses it */
export type ReportType = 'Purchase' | 'Sale (Full)' | 'Sale (Partial)' | 'Exchange';
/** Whose holding the report covers — the member, their spouse, a joint account, a dependent */
/** 'Undisclosed' when the filing named no owner (the feed's "undisclosed") */
export type ReportOwner = 'Self' | 'Spouse' | 'Joint' | 'Dependent' | 'Undisclosed';
export type AssetKind = 'Stock' | 'Stock Option' | 'Corporate Bond' | 'Municipal Security' | 'Government Security' | 'Fund' | 'Crypto' | 'Other';

/** One of the ten statutory amount rungs, in the form's checkbox order A–J */
export interface AmountBracket {
  column: string;
  /** Lower bound in dollars, inclusive */
  low: number;
  /** Upper bound, or null for the open-ended top rung */
  high: number | null;
  label: string;
}

export interface Member {
  id: string;
  name: string;
  chamber: Chamber;
  /** Null where the source carries no party (the feed's filings name the member alone) */
  party: Party | null;
  /** Empty where the source carries no state */
  state: string;
  /** House members only */
  district?: string;
  /** Committee seats — the join that carries the signal */
  committees: string[];
}

export interface CongressTrade {
  id: string;
  member: Member;
  ticker: string;
  /** What the filing wrote in the asset field */
  assetDescription: string;
  assetKind: AssetKind;
  type: ReportType;
  owner: ReportOwner;
  /** Index into AMOUNT_BRACKETS, or null when the filing was unparsed */
  bracket: number | null;
  /** Days between the trade and the filing — can be negative on a real feed */
  lagDays: number;
  tradedDaysAgo: number;
  filedDaysAgo: number;
  /** Past the STOCK Act's 45-day outer bound */
  late: boolean;
  /** The committee of the member's with jurisdiction over this sector, if any */
  committeeOverlap: string | null;
  /** The calendar days as filed, "2026-10-05" — set by the feed, so a date reads as written rather than counted back */
  filedOn?: string;
  tradedOn?: string;
}

export interface CongressFeed {
  trades: CongressTrade[];
  /** The disclosed value as a RANGE: the bracket floors summed, and the ceilings */
  totalLow: number;
  /** Null when an open-ended top rung makes the ceiling unknowable */
  totalHigh: number | null;
  unknownAmounts: number;
  purchases: number;
  sales: number;
  lateFilings: number;
  overlaps: number;
  medianLag: number;
  windowDays: number;
}

/* ---- Insiders ------------------------------------------------------------------ */

/** 'Officer' is any other officer a filing names (the feed's titles are free text; the title rides on the row) */
export type InsiderRole = 'CEO' | 'CFO' | 'COO' | 'Director' | 'EVP' | 'Chief Legal Officer' | '10% owner' | 'Officer';
export type InsiderKind = 'BUY' | 'SELL';
/** The Form 4 transaction codes this desk models — the row's identity, not metadata */
/** The Form 4 transaction codes this desk models — the row's identity, not metadata. The feed adds J (other), W (will
    or inheritance), C (conversion), X (exercise) and N — the house's key for a Form 144, a NOTICE of a proposed sale,
    which is not a Form 4 code and not a trade */
export type TxCode = 'P' | 'S' | 'A' | 'M' | 'F' | 'G' | 'D' | 'J' | 'W' | 'C' | 'X' | 'N';
/** Under a 10b5-1 plan, chosen, or from a filing that never carried the box */
export type PlanState = 'plan' | 'discretionary' | 'unknown';
export type InsiderSignal = 'accumulating' | 'distributing' | 'scheduled selling' | 'quiet';

export interface TxCodeMeta {
  code: TxCode;
  label: string;
  /** Did the filer choose the trade — does its price and timing carry a view? */
  discretionary: boolean;
  /** Did shares change hands in the market? */
  openMarket: boolean;
  /** Does the row add shares to the holding, or take them out? */
  acquires: boolean;
  note: string;
}

export interface InsiderTrade {
  id: string;
  ticker: string;
  role: InsiderRole;
  person: string;
  code: TxCode;
  kind: InsiderKind;
  shares: number;
  /** The filed price per share */
  price: number;
  value: number;
  daysAgo: number;
  plan: PlanState;
  /** Distinct filers acting the same way in this name inside 30 days */
  clusterCount: number;
  /** Shares still held afterwards */
  heldAfter: number;
  /** Percent of the holding this trade was */
  stakePct: number;
  /** Percent the name has moved since, signed */
  sincePct: number;
  /* FROM THE FEED (2026-10-12): a figure the filing did not carry is NaN, drawn "—" with "not in the feed" */
  /** The title as filed ("EVP, Head of R&D") */
  title?: string;
  /** The trade's and the filing's calendar days as filed */
  tradedOn?: string;
  filedOn?: string;
  /** The form: "4", or "144" for a notice */
  form?: string;
}

export interface InsiderFlow {
  ticker: string;
  trades: InsiderTrade[];
  /** Dollars bought and sold on the market in the window */
  bought: number;
  sold: number;
  net: number;
  /** Dollars of selling that ran off a schedule rather than a decision */
  plannedValue: number;
  /** Dollars of compensation plumbing — grants, conversions, withholdings — kept apart */
  compValue: number;
  /** Distinct filers who bought on the market inside 30 days */
  buyerCluster: number;
  /** Dollars of discretionary buying — the informative subset */
  openMarketBuys: number;
  signal: InsiderSignal;
  windowDays: number;
}
