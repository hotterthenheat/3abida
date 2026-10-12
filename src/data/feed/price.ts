/*
==================================================
  SLAYER TERMINAL - A NAME'S PRICE ON THE FEED
  (data/feed/price.ts)

  ONE POLL A NAME (2026-10-12): the rail and every page
  of a room that reads the feed ask UW's stock-state for
  the active name under one key, `uw:state:<NAME>`, every
  ten seconds — one timer however many read it, nothing
  while the tab is hidden (poll.ts).

  THE LAST GOOD ANSWER STANDS THROUGH A REFUSAL: UW Basic
  answers three calls at once and other sessions share
  the key, so a 429 (or a timeout, the network, a 5xx)
  keeps the price it had for up to five minutes rather
  than blanking it. A name UW does not price — the
  indices answer 422 ("Stock state data is not available
  for index ticker SPX", seen 2026-10-12), an unknown
  ticker 200 { data: null } — is no price: "—", never the
  house's figure on a page that reads the vendor.
==================================================
*/

import { useMemo } from 'react';
import type { FeedResult } from './client';
import { useFeedPoll } from './poll';
import { uwStockState, type UwStockState } from './uw';

/** The words a "—" carries when the feed's answer has no such figure */
export const NOT_IN_FEED = 'not in the feed';

export interface FeedPrice {
  spot: number;
  changePct: number;
}

const PERIOD_MS = 10_000;
/** How long a good answer stands through a refused or failed call */
const HOLD_MS = 5 * 60_000;

const lastGood = new Map<string, { r: FeedResult<UwStockState> & { ok: true }; at: number }>();

/** A failure that says nothing about the name — the plan's concurrency, a slow or dropped call, the vendor's own error */
const passing = (r: FeedResult<UwStockState> & { ok: false }): boolean =>
  r.reason === 'rate' || r.reason === 'timeout' || r.reason === 'network' || (r.reason === 'upstream' && r.status >= 500);

async function loadState(t: string): Promise<FeedResult<UwStockState>> {
  const r = await uwStockState(t);
  if (r.ok) {
    if (r.data.close !== null) lastGood.set(t, { r, at: Date.now() });
    return r;
  }
  const had = lastGood.get(t);
  if (had && passing(r) && Date.now() - had.at < HOLD_MS) return had.r;
  return r;
}

/** The poll's key for a name's price — the rail and the room's pages share it */
export const priceKey = (ticker: string): string => `uw:state:${ticker.toUpperCase()}`;

/**
 * The name's price on the feed: UW's day state (its latest trade, and the change from the close before). `on` false asks
 * nothing. `answered` is true once a call came back — with no price then, the name is not in the feed.
 */
export function useFeedPrice(on: boolean, ticker: string): { price: FeedPrice | null; answered: boolean } {
  const t = ticker.toUpperCase();
  const r = useFeedPoll(on && t ? priceKey(t) : null, () => loadState(t), PERIOD_MS);
  return useMemo(() => {
    if (!r) return { price: null, answered: false };
    if (!r.ok || r.data.close === null) return { price: null, answered: true };
    const prev = r.data.prevClose;
    return { price: { spot: r.data.close, changePct: prev ? ((r.data.close - prev) / prev) * 100 : 0 }, answered: true };
  }, [r]);
}
