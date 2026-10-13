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
  house's figure on a page that reads the vendor; a name
  answered 422 is not asked again this visit.
==================================================
*/

import { isCashIndex } from './levels';
import { useMemo } from 'react';
import type { FeedResult } from './client';
import { useFeedPoll } from './poll';
import { uwStockState, type UwStockState, uwOptionTrades } from './uw';
import { noteRealPrice } from '../../components/gex/alertMarket';

/** The words a "—" carries when the feed's answer has no such figure */
export const NOT_IN_FEED = 'not in the feed';

export interface FeedPrice {
  spot: number;
  changePct: number;
  /** The trade's or print's moment, epoch ms — a print's for an index */
  at?: number;
  /** 'trade': UW's day state (the latest trade); 'print': an index, priced off the newest option print's underlying
      price (the owner, 2026-10-13: "label the SPX price with its print time; if the newest print is older than 2
      minutes, show it as stale") */
  source?: 'trade' | 'print';
  /** A print older than PRINT_STALE_MS at the poll */
  stale?: boolean;
}
/** An index's print price is stale this long after the print */
export const PRINT_STALE_MS = 2 * 60_000;

const PERIOD_MS = 10_000;
/** How long a good answer stands through a refused or failed call */
const HOLD_MS = 5 * 60_000;

/** Names UW will not price (an index's 422) — not asked again this visit, so the console stays quiet */
const unpriced = new Set<string>();
/** UW said it will not price this name (an index) */
export const isUnpriced = (ticker: string): boolean => unpriced.has(ticker.toUpperCase());

const lastGood = new Map<string, { r: FeedResult<UwStockState> & { ok: true }; at: number }>();

/** A failure that says nothing about the name — the plan's concurrency, a slow or dropped call, the vendor's own error */
const passing = (r: FeedResult<UwStockState> & { ok: false }): boolean =>
  r.reason === 'rate' || r.reason === 'timeout' || r.reason === 'network' || (r.reason === 'upstream' && r.status >= 500);

/** A name's day state once — the shared poll's loader, and the alerts' watcher's (its price noted for the alerts) */
export async function loadState(ticker: string): Promise<FeedResult<UwStockState>> {
  const t = ticker.toUpperCase();
  if (unpriced.has(t)) return { ok: false, reason: 'upstream', status: 422 };
  const r = await uwStockState(t);
  if (r.ok) {
    if (r.data.close !== null) {
      lastGood.set(t, { r, at: Date.now() });
      noteRealPrice(t, r.data.close);
    }
    return r;
  }
  if (r.status === 422) unpriced.add(t);
  const had = lastGood.get(t);
  if (had && passing(r) && Date.now() - had.at < HOLD_MS) return had.r;
  return r;
}

/** THE INDEX'S PRICE OFF THE PRINTS (2026-10-13 — UW Basic serves no index price; the owner's check: the tape's
    per-print underlying against SPY's bar close stays within ±0.02% of the day's median in 99.2% to 100% of regular
    minutes on six days): the newest SPX or SPXW print carrying an underlying price (`/api/option-trades?ticker_symbol=
    SPX` answers both roots), its moment the print's own. After the close the prints carry none, so the last priced
    print stands, stale. */
const lastPrint = new Map<string, { spot: number; at: number }>();
export async function loadIndexPrint(ticker: string): Promise<FeedResult<{ spot: number; at: number }>> {
  const t = ticker.toUpperCase();
  const r = await uwOptionTrades({ ticker: t, limit: 40 });
  if (r.ok) {
    const priced = r.data.filter(p => p.underlyingPrice != null && p.underlyingPrice > 0 && Number.isFinite(p.executedAt)).sort((a, b) => b.executedAt - a.executedAt);
    if (priced.length) {
      const p = { spot: priced[0].underlyingPrice as number, at: priced[0].executedAt };
      lastPrint.set(t, p);
      noteRealPrice(t, p.spot);
      return { ok: true, data: p, at: Date.now() };
    }
  }
  const had = lastPrint.get(t);
  if (had) return { ok: true, data: had, at: Date.now() };
  return r.ok ? { ok: false, reason: 'shape', status: 0 } : r;
}
/** An index's print price, or null — the alerts' watcher and the rail outside a render */
export const indexPrintOf = (ticker: string): { spot: number; at: number } | null => lastPrint.get(ticker.toUpperCase()) ?? null;

/** The poll's key for a name's price — the rail and the room's pages share it */
export const priceKey = (ticker: string): string => `uw:state:${ticker.toUpperCase()}`;

/**
 * The name's price on the feed: UW's day state (its latest trade, and the change from the close before). `on` false asks
 * nothing. `answered` is true once a call came back — with no price then, the name is not in the feed.
 */
export function useFeedPrice(on: boolean, ticker: string): { price: FeedPrice | null; answered: boolean } {
  const t = ticker.toUpperCase();
  const index = isCashIndex(t);
  const refused = !index && unpriced.has(t);
  const r = useFeedPoll(on && t && !refused && !index ? priceKey(t) : null, () => loadState(t), PERIOD_MS);
  /* an index: the newest print's underlying price, asked on the same cadence, its staleness read at each poll */
  const p = useFeedPoll(on && t && index ? `uw:print:${t}` : null, () => loadIndexPrint(t), PERIOD_MS);
  return useMemo(() => {
    if (index) {
      if (!p) return { price: null, answered: false };
      if (!p.ok) return { price: null, answered: true };
      return { price: { spot: p.data.spot, changePct: NaN, at: p.data.at, source: 'print', stale: Date.now() - p.data.at > PRINT_STALE_MS }, answered: true };
    }
    if (refused) return { price: null, answered: true };
    if (!r) return { price: null, answered: false };
    if (!r.ok || r.data.close === null) return { price: null, answered: true };
    const prev = r.data.prevClose;
    return { price: { spot: r.data.close, changePct: prev ? ((r.data.close - prev) / prev) * 100 : 0, source: 'trade' }, answered: true };
  }, [r, p, refused, index]);
}
