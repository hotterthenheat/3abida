/*
==================================================
  SLAYER TERMINAL - TRACKER TYPES (tracker.ts)
  Bookmarked setups for live monitoring on the
  dedicated Tracker page.
==================================================
*/

import type { OptionRight, ScannerKey, SleeveKey, Verdict } from './compass';
import type { CampaignRecord } from '../components/compass/campaignStore';

/** A setup the user has bookmarked for ongoing tracking. */
export interface TrackedSetup {
  id: string;                // reuse Setup.id
  contract: string;          // e.g. "SPY 515C"
  ticker: string;
  strike: number;
  right: OptionRight;
  scanner: ScannerKey;       // which scanner found it (the thesis lens)
  /** Which tenor it was found on. Optional: rows tracked before the sleeve
      axis (2026-08-04) don't carry one — treat as 'odte'. */
  sleeve?: SleeveKey;
  trackedAt: number;         // Date.now() timestamp
  scoreAtTrack: number;      // score when user clicked "Track"
  verdictAtTrack: Verdict;   // verdict when tracked
  /** The contract's REAL expiry session, YYYY-MM-DD (the audit's CO-18: a weekly was "tracked + 5 days" and a 0DTE "the
      next midnight", whatever the contract). Rows tracked before 2026-10-09 carry none. */
  expiryDate?: string;
  /** The campaign as it stood when tracked — the sweep's moment, the entry premium, the frozen targets and floor — so the
      Tracker's targets are the board's and the page's (campaignStore). Absent on older rows. */
  campaign?: CampaignRecord;
}
