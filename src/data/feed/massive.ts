/*
==================================================
  SLAYER TERMINAL - MASSIVE, READ (data/feed/massive.ts)

  The routes Slayer reads first, on Massive's free Basic
  plans (Stocks, Options; end-of-day; about five calls a
  minute, which the proxy's bucket keeps — so these are
  asked for rarely and cached for hours).
  ROUTES AND FIELDS: Massive's OpenAPI (client-js
  src/openapi.json, the note's source:
  docs/ideas-2026-10-09/notes/api_powered_features.md §1),
  every field below seen in a live answer on 2026-10-12
  (docs/data-feed-samples.md).

  NOT ON THESE PLANS (403 NOT_AUTHORIZED, "You are not
  entitled to this data", 2026-10-12): the indices — both
  /v3/snapshot/indices and the I:SPX bars. Their fetcher
  stays for the day the plan reaches them.
==================================================
*/

import { feedFetch, feedGet, feedUrl, num, num0, objOf, rowsOf, str, viaProxy, type FeedResult } from './client';

/* ---- the market's clock ---------------------------------------------------------------------------------------- */

export interface MassiveMarketStatus {
  /** "open", "closed", "extended-hours" … as Massive says it (seen: "open") */
  market: string;
  serverTime: string;
  earlyHours: boolean;
  afterHours: boolean;
  nyse: string;
  nasdaq: string;
}

/** Whether the market is open now — the probe's own call. GET /v1/marketstatus/now */
export const massiveMarketStatus = (): Promise<FeedResult<MassiveMarketStatus>> =>
  feedGet('massive', '/v1/marketstatus/now', undefined, body => {
    const b = body as Record<string, unknown>;
    const ex = (b.exchanges ?? {}) as Record<string, unknown>;
    if (typeof b.market !== 'string') throw new Error('shape');
    return { market: b.market, serverTime: str(b.serverTime), earlyHours: b.earlyHours === true, afterHours: b.afterHours === true, nyse: str(ex.nyse), nasdaq: str(ex.nasdaq) };
  });

/* ---- the listed contracts ------------------------------------------------------------------------------------- */

export interface MassiveContract {
  /** O:SPY261012C00550000 */
  ticker: string;
  underlying: string;
  type: 'call' | 'put';
  strike: number;
  expiry: string;
  style: string;
  sharesPerContract: number;
}

const contract = (r: Record<string, unknown>): MassiveContract => ({
  ticker: str(r.ticker),
  underlying: str(r.underlying_ticker),
  type: r.contract_type === 'put' ? 'put' : 'call',
  strike: num0(r.strike_price),
  expiry: str(r.expiration_date),
  style: str(r.exercise_style),
  sharesPerContract: num(r.shares_per_contract) ?? 100,
});

/**
 * A name's listed contracts, paged along `next_url` through the proxy. GET /v3/reference/options/contracts
 * (underlying_ticker, expiration_date.gte/.lte, contract_type, limit ≤ 1000, sort, order). Every page is a call of
 * the five a minute, so `maxPages` caps it. `asOf` (`as_of`) lists what was listed ON A PAST DAY, the contracts that
 * have since expired among them — seen live 2026-10-12: SPY's 760 call as of 2026-09-14 answered 34 expiries,
 * 2026-09-14 to 2029-01-19, and the 2026-09-18 calls as of that day 321 strikes (the Backtest's real days).
 */
export async function massiveContracts(
  underlying: string,
  opts: { expiryFrom?: string; expiryTo?: string; type?: 'call' | 'put'; strike?: number; asOf?: string; maxPages?: number } = {}
): Promise<FeedResult<MassiveContract[]>> {
  const first = feedUrl('massive', '/v3/reference/options/contracts', {
    underlying_ticker: underlying.toUpperCase(),
    'expiration_date.gte': opts.expiryFrom,
    'expiration_date.lte': opts.expiryTo,
    contract_type: opts.type,
    strike_price: opts.strike,
    as_of: opts.asOf,
    sort: 'expiration_date',
    order: 'asc',
    limit: 1000,
  });
  const out: MassiveContract[] = [];
  let url: string | null = first;
  let at = Date.now();
  for (let page = 0; url && page < (opts.maxPages ?? 3); page++) {
    const r = await feedFetch(url);
    if (!r.ok) return page === 0 ? r : { ok: true, data: out, at };
    at = r.at;
    try {
      out.push(...rowsOf(r.data, 'results').map(contract));
    } catch {
      return { ok: false, reason: 'shape', status: 200 };
    }
    const next = (r.data as { next_url?: unknown }).next_url;
    url = typeof next === 'string' ? viaProxy(next) : null;
  }
  return { ok: true, data: out, at };
}

/**
 * The listed expiry dates, earliest first, read off the contracts. ONE CALL, NOT TWENTY: asked for the calls at one
 * round strike near spot, every expiry answers on one page (SPY at the 700 call: 32 expiries, 2026-10-12 to
 * 2029-01-19, the same 32 UW's expiry-breakdown lists — seen 2026-10-12); without a strike the whole chain pages
 * through at five calls a minute. A strike some far expiry does not list leaves that expiry out.
 */
export async function massiveExpirations(underlying: string, opts: { strike?: number; from?: string; to?: string; asOf?: string; maxPages?: number } = {}): Promise<FeedResult<string[]>> {
  const r = await massiveContracts(underlying, { expiryFrom: opts.from, expiryTo: opts.to, type: 'call', strike: opts.strike, asOf: opts.asOf, maxPages: opts.maxPages ?? (opts.strike !== undefined ? 1 : 3) });
  if (!r.ok) return r;
  return { ok: true, data: Array.from(new Set(r.data.map(c => c.expiry))).sort(), at: r.at };
}

/* ---- bars ------------------------------------------------------------------------------------------------------- */

export interface MassiveBar {
  /** The bar's start, epoch ms */
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  vw: number | null;
  /** Trades in the bar */
  n: number;
}

export type MassiveTimespan = 'minute' | 'hour' | 'day' | 'week' | 'month';

/** A contract's own ticker, the OCC way Massive writes it: O:SPY261012C00550000 (strike × 1000, eight figures) */
export const occTicker = (c: { ticker: string; expiry: string; right: 'C' | 'P'; strike: number }): string =>
  `O:${c.ticker.toUpperCase()}${c.expiry.slice(2, 4)}${c.expiry.slice(5, 7)}${c.expiry.slice(8, 10)}${c.right}${String(Math.round(c.strike * 1000)).padStart(8, '0')}`;

/**
 * Bars for a stock or an option contract (O:…). GET /v2/aggs/ticker/{ticker}/range/{multiplier}/{timespan}/{from}/{to}
 * (adjusted, sort, limit ≤ 50000). On the Basic plans the day before's minutes are there (2026-10-09's, seen on the
 * 12th); today's are not. Two years back answer (SPY's days from 2024-10-14; AAPL's minutes that day; an expired
 * contract's own minutes, O:AAPL241115C00225000 in November 2024 and O:SPY260918C00762000 — seen 2026-10-12), a
 * contract's minutes running to 16:15 on the funds. A minute nothing traded has no bar.
 */
export const massiveBars = (ticker: string, multiplier: number, timespan: MassiveTimespan, from: string, to: string, opts: { limit?: number } = {}): Promise<FeedResult<MassiveBar[]>> =>
  feedGet('massive', `/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/${multiplier}/${timespan}/${from}/${to}`, { adjusted: true, sort: 'asc', limit: opts.limit ?? 50000 }, body => {
    /* a range with no bars answers without `results` */
    const rows = (body as { results?: unknown }).results === undefined ? [] : rowsOf(body, 'results');
    return rows.map(r => ({ t: num0(r.t), o: num0(r.o), h: num0(r.h), l: num0(r.l), c: num0(r.c), v: num0(r.v), vw: num(r.vw), n: num0(r.n) }));
  });

/* ---- indices (not on these plans) ------------------------------------------------------------------------------- */

export interface MassiveIndex {
  ticker: string;
  name: string;
  value: number | null;
  change: number | null;
  changePct: number | null;
  previousClose: number | null;
}

/** Index values, I:-prefixed (I:SPX, I:VIX). GET /v3/snapshot/indices (ticker.any_of). 403 on the owner's plans (2026-10-12) — fields from the spec alone */
export const massiveIndices = (tickers: string[]): Promise<FeedResult<MassiveIndex[]>> =>
  feedGet('massive', '/v3/snapshot/indices', { 'ticker.any_of': tickers.join(',') }, body =>
    rowsOf(body, 'results').map(r => {
      const s = (r.session ?? {}) as Record<string, unknown>;
      return { ticker: str(r.ticker), name: str(r.name), value: num(r.value), change: num(s.change), changePct: num(s.change_percent), previousClose: num(s.previous_close) };
    })
  );

/* ---- reference ------------------------------------------------------------------------------------------------- */

export interface MassiveTickerRow {
  ticker: string;
  name: string;
  market: string;
  /** "CS" common stock, "ETF" … */
  type: string;
  primaryExchange: string;
  active: boolean;
}

/** Tickers by search or exact name. GET /v3/reference/tickers (ticker, search, market, active, limit ≤ 1000) */
export const massiveTickers = (opts: { ticker?: string; search?: string; market?: 'stocks' | 'options' | 'indices'; limit?: number } = {}): Promise<FeedResult<MassiveTickerRow[]>> =>
  feedGet('massive', '/v3/reference/tickers', { ticker: opts.ticker, search: opts.search, market: opts.market, active: true, limit: opts.limit ?? 50 }, body =>
    rowsOf(body, 'results').map(r => ({ ticker: str(r.ticker), name: str(r.name), market: str(r.market), type: str(r.type), primaryExchange: str(r.primary_exchange), active: r.active === true }))
  );

export interface MassiveTickerDetails extends MassiveTickerRow {
  marketCap: number | null;
  description: string;
  homepage: string;
  listDate: string;
  sicDescription: string;
  totalEmployees: number | null;
  sharesOutstanding: number | null;
}

/** One name's company record. GET /v3/reference/tickers/{ticker} */
export const massiveTickerDetails = (ticker: string): Promise<FeedResult<MassiveTickerDetails>> =>
  feedGet('massive', `/v3/reference/tickers/${encodeURIComponent(ticker)}`, undefined, body => {
    const r = objOf(body, 'results');
    return {
      ticker: str(r.ticker),
      name: str(r.name),
      market: str(r.market),
      type: str(r.type),
      primaryExchange: str(r.primary_exchange),
      active: r.active === true,
      marketCap: num(r.market_cap),
      description: str(r.description),
      homepage: str(r.homepage_url),
      listDate: str(r.list_date),
      sicDescription: str(r.sic_description),
      totalEmployees: num(r.total_employees),
      sharesOutstanding: num(r.share_class_shares_outstanding),
    };
  });
