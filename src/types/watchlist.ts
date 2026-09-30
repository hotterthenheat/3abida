/*
==================================================
  SLAYER TERMINAL - WATCHLIST TYPES (types/watchlist.ts)

  A watched contract (2026-09-13, docs/watchlist-spec.md):
  marked at the price the moment it is added and
  tracked as a position from then on — the cost when
  added, the mark now, today's and total return, the
  breakeven, the expiry — until the reader closes it
  or the bell settles it. No orders, no sides, no
  broker: a watchlist that keeps score.
==================================================
*/

import type { OptionRight } from './compass';

export type WatchStatus = 'open' | 'closed' | 'expired';

/** One session's close of the contract's mark — the row's line since it was added */
export interface WatchMark {
  /** ISO date */
  day: string;
  close: number;
}

export interface WatchedContract {
  /** `${ticker}-${strike}-${right}-${expiry}-${addedAt}` */
  id: string;
  ticker: string;
  strike: number;
  right: OptionRight;
  /** The real expiry date, ISO — the chain's */
  expiry: string;
  /** Date.now() at the add */
  addedAt: number;
  /** The mark at the add — the cost, the risk, 1R */
  addedMark: number;
  /** The underlying at the add — the breakeven's anchor on the card */
  addedSpot: number;
  /** Contracts; 1 unless the reader sets it */
  size: number;
  status: WatchStatus;
  closedAt?: number;
  /** The mark at the close, or intrinsic at the bell */
  closedMark?: number;
  /** The reader's one line, optional */
  note?: string;
  /** One close per session since the add */
  marks: WatchMark[];
}

/** What a door hands the store — the same shape as the Weigher's deep link */
export interface WatchRequest {
  ticker: string;
  strike: number;
  right: OptionRight;
  /** ISO date */
  expiry: string;
  size?: number;
}
