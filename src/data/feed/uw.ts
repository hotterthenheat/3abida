/*
==================================================
  SLAYER TERMINAL - UNUSUAL WHALES, READ (data/feed/uw.ts)

  The routes Slayer reads first, on the API Basic plan
  (REST only, no socket — a room polls; data/feed/poll.ts).
  ROUTES: uw-mcp docs/endpoints.json (the vendor's own
  catalog, "verified in CI"; read 2026-10-12), as cited in
  docs/ideas-2026-10-09/notes/api_powered_features.md §2.
  FIELDS: every field read below was seen in a live answer
  on 2026-10-12 (docs/data-feed-samples.md keeps the
  shapes). Figures arrive as numeric strings ("777.9405")
  and are read with num(); times are ISO strings or epoch
  ms, read with ms().

  The words a room shows stay the house's: UW's tags
  (bullish, bearish) are evidence of where a print sat in
  the quote, never a call.
==================================================
*/

import { bool, feedGet, ms, num, num0, objOf, rowsOf, str, type FeedResult } from './client';
import { nyWallTime } from '../../core/nyTime';

/* ---- a name's price --------------------------------------------------------------------------------------------- */

export interface UwStockState {
  ticker: string;
  close: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  prevClose: number | null;
  volume: number;
  totalVolume: number;
  /** "regular", "pre", "post" … as UW names the session (seen: "regular") */
  marketTime: string;
  tapeTime: number;
}

/** The day's state of a name — the cheapest UW call, the probe's own. GET /api/stock/{ticker}/stock-state */
export const uwStockState = (ticker: string): Promise<FeedResult<UwStockState>> =>
  feedGet('uw', `/api/stock/${encodeURIComponent(ticker)}/stock-state`, undefined, body => {
    const d = objOf(body);
    return {
      ticker: ticker.toUpperCase(),
      close: num(d.close),
      open: num(d.open),
      high: num(d.high),
      low: num(d.low),
      prevClose: num(d.prev_close),
      volume: num0(d.volume),
      totalVolume: num0(d.total_volume),
      marketTime: str(d.market_time),
      tapeTime: ms(d.tape_time),
    };
  });

export interface UwQuote {
  ticker: string;
  last: number | null;
  lastTime: number;
  bid: number | null;
  bidSize: number;
  ask: number | null;
  askSize: number;
  quoteTime: number;
  mid: number | null;
  spread: number | null;
  marketTime: string;
}

/** The name's last trade and NBBO (Nasdaq real-time on the Basic plan). GET /api/stock/{ticker}/quote */
export const uwQuote = (ticker: string): Promise<FeedResult<UwQuote>> =>
  feedGet('uw', `/api/stock/${encodeURIComponent(ticker)}/quote`, undefined, body => {
    const d = objOf(body);
    const last = (d.last_trade ?? {}) as Record<string, unknown>;
    const q = (d.quote ?? {}) as Record<string, unknown>;
    const bid = (q.bid ?? {}) as Record<string, unknown>;
    const ask = (q.ask ?? {}) as Record<string, unknown>;
    const v = (d.quote_values ?? {}) as Record<string, unknown>;
    return {
      ticker: ticker.toUpperCase(),
      last: num(last.price),
      lastTime: ms(last.time),
      bid: num(bid.price),
      bidSize: num0(bid.size),
      ask: num(ask.price),
      askSize: num0(ask.size),
      quoteTime: ms(q.time),
      mid: num(v.midpoint),
      spread: num(v.spread),
      marketTime: str(d.market_time),
    };
  });

/* ---- flow ------------------------------------------------------------------------------------------------------- */

export interface UwFlowAlert {
  id: string;
  ticker: string;
  /** The contract, OCC style without the prefix: QQQ261012P00746000 */
  chain: string;
  type: 'call' | 'put';
  strike: number;
  expiry: string;
  price: number | null;
  underlyingPrice: number | null;
  totalPremium: number;
  askSidePremium: number;
  bidSidePremium: number;
  totalSize: number;
  tradeCount: number;
  volume: number;
  openInterest: number;
  volumeOiRatio: number | null;
  iv: number | null;
  delta: number | null;
  /** UW's rule name (seen: "RepeatedHits") */
  rule: string;
  sweep: boolean;
  floor: boolean;
  multileg: boolean;
  allOpening: boolean;
  sector: string;
  issueType: string;
  nextEarnings: string;
  createdAt: number;
  startTime: number;
  endTime: number;
}

const flowAlert = (r: Record<string, unknown>): UwFlowAlert => ({
  id: str(r.id),
  ticker: str(r.ticker),
  chain: str(r.option_chain),
  type: r.type === 'put' ? 'put' : 'call',
  strike: num0(r.strike),
  expiry: str(r.expiry),
  price: num(r.price),
  underlyingPrice: num(r.underlying_price),
  totalPremium: num0(r.total_premium),
  askSidePremium: num0(r.total_ask_side_prem),
  bidSidePremium: num0(r.total_bid_side_prem),
  totalSize: num0(r.total_size),
  tradeCount: num0(r.trade_count),
  volume: num0(r.volume),
  openInterest: num0(r.open_interest),
  volumeOiRatio: num(r.volume_oi_ratio),
  iv: num(r.iv),
  delta: num(r.delta),
  rule: str(r.alert_rule),
  sweep: bool(r.has_sweep),
  floor: bool(r.has_floor),
  multileg: bool(r.has_multileg),
  allOpening: bool(r.all_opening_trades),
  sector: str(r.sector),
  issueType: str(r.issue_type),
  nextEarnings: str(r.next_earnings_date),
  createdAt: ms(r.created_at),
  startTime: ms(r.start_time),
  endTime: ms(r.end_time),
});

/**
 * The flow alerts, newest first, the whole market or one name. GET /api/option-trades/flow-alerts (ticker_symbol,
 * limit, min_premium …). The per-name route /api/stock/{ticker}/flow-alerts answers without `id` or the times, so the
 * market route with `ticker_symbol` is the one read.
 */
export const uwFlowAlerts = (opts: { ticker?: string; limit?: number; minPremium?: number; olderThan?: string } = {}): Promise<FeedResult<UwFlowAlert[]>> =>
  feedGet('uw', '/api/option-trades/flow-alerts', { ticker_symbol: opts.ticker, limit: opts.limit ?? 50, min_premium: opts.minPremium, older_than: opts.olderThan }, body => rowsOf(body).map(flowAlert));

export interface UwOptionTrade {
  id: string;
  ticker: string;
  chain: string;
  type: 'call' | 'put';
  strike: number;
  expiry: string;
  price: number;
  size: number;
  premium: number;
  nbboBid: number | null;
  nbboAsk: number | null;
  underlyingPrice: number | null;
  iv: number | null;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  openInterest: number;
  volume: number;
  askVol: number;
  bidVol: number;
  midVol: number;
  noSideVol: number;
  multiVol: number;
  exchange: string;
  /** UW's tags (seen: "bid_side", "ask_side") — where the print sat, never shown as a call */
  tags: string[];
  /** The exchange's condition (seen: "auto", "slan", "mlet", "mlat", "isoi", "tlet" …) — "ml…" a multi-leg order */
  condition: string;
  /** UW's report flags (seen: "intermarket_sweep", "cross_trade", "futures_floor") */
  flags: string[];
  issueType: string;
  sector: string;
  nextEarnings: string;
  executedAt: number;
  canceled: boolean;
}

const optionTrade = (r: Record<string, unknown>): UwOptionTrade => ({
  id: str(r.id),
  ticker: str(r.underlying_symbol),
  chain: str(r.option_chain_id),
  type: r.option_type === 'put' ? 'put' : 'call',
  strike: num0(r.strike),
  expiry: str(r.expiry),
  price: num0(r.price),
  size: num0(r.size),
  premium: num0(r.premium),
  nbboBid: num(r.nbbo_bid),
  nbboAsk: num(r.nbbo_ask),
  underlyingPrice: num(r.underlying_price),
  iv: num(r.implied_volatility),
  delta: num(r.delta),
  gamma: num(r.gamma),
  theta: num(r.theta),
  vega: num(r.vega),
  openInterest: num0(r.open_interest),
  volume: num0(r.volume),
  askVol: num0(r.ask_vol),
  bidVol: num0(r.bid_vol),
  midVol: num0(r.mid_vol),
  noSideVol: num0(r.no_side_vol),
  multiVol: num0(r.multi_vol),
  exchange: str(r.exchange),
  tags: Array.isArray(r.tags) ? r.tags.map(str) : [],
  condition: str(r.upstream_condition_detail),
  flags: Array.isArray(r.report_flags) ? r.report_flags.map(str) : [],
  issueType: str(r.issue_type),
  sector: str(r.sector),
  nextEarnings: str(r.next_earnings_date),
  executedAt: ms(r.executed_at),
  canceled: bool(r.canceled),
});

/** The option tape, newest first, the whole market or one name. GET /api/option-trades (ticker_symbol, limit …) */
export const uwOptionTrades = (opts: { ticker?: string; limit?: number; minPremium?: number; olderThan?: string } = {}): Promise<FeedResult<UwOptionTrade[]>> =>
  feedGet('uw', '/api/option-trades', { ticker_symbol: opts.ticker, limit: opts.limit ?? 100, min_premium: opts.minPremium, older_than: opts.olderThan }, body => rowsOf(body).map(optionTrade));

/** A name's latest prints (50 seen) — the same rows as the tape, answered as a BARE ARRAY. GET /api/stock/{ticker}/flow-recent */
export const uwFlowRecent = (ticker: string, opts: { minPremium?: number } = {}): Promise<FeedResult<UwOptionTrade[]>> =>
  feedGet('uw', `/api/stock/${encodeURIComponent(ticker)}/flow-recent`, { min_premium: opts.minPremium }, body => rowsOf(body).map(optionTrade));

/* ---- net premium and the market's tide ---------------------------------------------------------------------- */

export interface UwNetPremTick {
  /** The minute this tick closes over (UW: one tick a minute; a day's chart sums them) */
  at: number;
  netCallPremium: number;
  netPutPremium: number;
  netCallVolume: number;
  netPutVolume: number;
  callVolume: number;
  putVolume: number;
  callVolumeAsk: number;
  callVolumeBid: number;
  putVolumeAsk: number;
  putVolumeBid: number;
  netDelta: number;
}

/** A name's net premium, a tick a minute from the open (81 by 10:50 ET, seen). GET /api/stock/{ticker}/net-prem-ticks (date) */
export const uwNetPremTicks = (ticker: string, date?: string): Promise<FeedResult<UwNetPremTick[]>> =>
  feedGet('uw', `/api/stock/${encodeURIComponent(ticker)}/net-prem-ticks`, { date }, body =>
    rowsOf(body).map(r => ({
      at: ms(r.tape_time),
      netCallPremium: num0(r.net_call_premium),
      netPutPremium: num0(r.net_put_premium),
      netCallVolume: num0(r.net_call_volume),
      netPutVolume: num0(r.net_put_volume),
      callVolume: num0(r.call_volume),
      putVolume: num0(r.put_volume),
      callVolumeAsk: num0(r.call_volume_ask_side),
      callVolumeBid: num0(r.call_volume_bid_side),
      putVolumeAsk: num0(r.put_volume_ask_side),
      putVolumeBid: num0(r.put_volume_bid_side),
      netDelta: num0(r.net_delta),
    }))
  );

export interface UwTidePoint {
  at: number;
  netCallPremium: number;
  netPutPremium: number;
  netVolume: number;
}

/** Market Tide: net call and put premium across the market through the day (5-minute points seen). GET /api/market/market-tide (date, otm_only, interval_5m) */
export const uwMarketTide = (opts: { date?: string; otmOnly?: boolean; interval5m?: boolean } = {}): Promise<FeedResult<UwTidePoint[]>> =>
  feedGet('uw', '/api/market/market-tide', { date: opts.date, otm_only: opts.otmOnly, interval_5m: opts.interval5m }, body =>
    rowsOf(body).map(r => ({ at: ms(r.timestamp), netCallPremium: num0(r.net_call_premium), netPutPremium: num0(r.net_put_premium), netVolume: num0(r.net_volume) }))
  );

/* ---- dealer exposure -------------------------------------------------------------------------------------------- */

export interface UwStrikeExposure {
  strike: number;
  /** The price the row was figured at */
  price: number | null;
  time: number;
  /** By open interest */
  callGammaOi: number;
  putGammaOi: number;
  callDeltaOi: number;
  putDeltaOi: number;
  callCharmOi: number;
  putCharmOi: number;
  callVannaOi: number;
  putVannaOi: number;
  /** By today's volume */
  callGammaVol: number;
  putGammaVol: number;
  /** By today's volume at the ask and at the bid */
  callGammaAsk: number;
  callGammaBid: number;
  putGammaAsk: number;
  putGammaBid: number;
}

/** One row of a name's exposure by strike — the same row for the whole book and for one expiry */
const strikeExposure = (r: Record<string, unknown>): UwStrikeExposure => ({
  strike: num0(r.strike),
  price: num(r.price),
  time: ms(r.time),
  callGammaOi: num0(r.call_gamma_oi),
  putGammaOi: num0(r.put_gamma_oi),
  callDeltaOi: num0(r.call_delta_oi),
  putDeltaOi: num0(r.put_delta_oi),
  /* CHARM A DAY (2026-10-12): UW's charm exposure is a year's (its spec: "charm * open interest * 365", the per-strike
     rows in the same proportion to the book's as gamma — checked live), and the house prints charm over one day */
  callCharmOi: num0(r.call_charm_oi) / 365,
  putCharmOi: num0(r.put_charm_oi) / 365,
  callVannaOi: num0(r.call_vanna_oi),
  putVannaOi: num0(r.put_vanna_oi),
  callGammaVol: num0(r.call_gamma_vol),
  putGammaVol: num0(r.put_gamma_vol),
  callGammaAsk: num0(r.call_gamma_ask),
  callGammaBid: num0(r.call_gamma_bid),
  putGammaAsk: num0(r.put_gamma_ask),
  putGammaBid: num0(r.put_gamma_bid),
});

/**
 * Spot GEX across every strike, the latest (491 rows for SPY, strikes from 50 up, seen). GET
 * /api/stock/{ticker}/spot-exposures/strike (min_strike, max_strike, limit, page, date). Ask for a window round spot;
 * `limit: 1` is the cheap way to read the price the book is figured at (every row carries it — an index too).
 */
export const uwSpotGexByStrike = (ticker: string, opts: { minStrike?: number; maxStrike?: number; date?: string; limit?: number } = {}): Promise<FeedResult<UwStrikeExposure[]>> =>
  feedGet('uw', `/api/stock/${encodeURIComponent(ticker)}/spot-exposures/strike`, { min_strike: opts.minStrike, max_strike: opts.maxStrike, date: opts.date, limit: opts.limit }, body => rowsOf(body).map(strikeExposure));

/** A UW exposure row for one expiry — the strike row and the date it belongs to */
export interface UwExpiryStrikeExposure extends UwStrikeExposure {
  expiry: string;
}

/**
 * The same exposure by strike, cut by expiry: one call for several dates (`expirations[]`), each row a strike on one
 * date (61 strikes × 7 dates = 419 rows, seen 2026-10-12). Its default page is 50 rows, so `limit` up to 500 is asked.
 * GET /api/stock/{ticker}/spot-exposures/expiry-strike (expirations[], min_strike, max_strike, limit)
 */
export const uwSpotGexByExpiryStrike = (ticker: string, expiries: string[], opts: { minStrike?: number; maxStrike?: number } = {}): Promise<FeedResult<UwExpiryStrikeExposure[]>> =>
  feedGet('uw', `/api/stock/${encodeURIComponent(ticker)}/spot-exposures/expiry-strike`, { 'expirations[]': expiries, min_strike: opts.minStrike, max_strike: opts.maxStrike, limit: 500 }, body =>
    rowsOf(body).map(r => ({ ...strikeExposure(r), expiry: str(r.expiry) }))
  );

export interface UwSpotExposure {
  at: number;
  price: number | null;
  gammaOi: number;
  gammaVol: number;
  gammaDir: number;
  charmOi: number;
  vannaOi: number;
}

/** A name's total exposure per one-percent move, minute by minute (206 rows by 10:50 ET, from pre-market). GET /api/stock/{ticker}/spot-exposures (date) */
export const uwSpotExposures = (ticker: string, date?: string): Promise<FeedResult<UwSpotExposure[]>> =>
  feedGet('uw', `/api/stock/${encodeURIComponent(ticker)}/spot-exposures`, { date }, body =>
    rowsOf(body).map(r => ({
      at: ms(r.start_time),
      price: num(r.price),
      gammaOi: num0(r.gamma_per_one_percent_move_oi),
      gammaVol: num0(r.gamma_per_one_percent_move_vol),
      gammaDir: num0(r.gamma_per_one_percent_move_dir),
      charmOi: num0(r.charm_per_one_percent_move_oi) / 365, // a year's in UW's answer — a day's here
      vannaOi: num0(r.vanna_per_one_percent_move_oi),
    }))
  );

/** A name's book by strike as it stood at a session's open — UW figures it once a day, at the open, on that day's open
    interest; every expiry together (491 rows for SPY, every listed strike; seen back to 2025-10-10 on Basic). Its units
    are its own (not /spot-exposures/strike's): read within one day's rows, never against another route's. */
export interface UwOpenExposure {
  strike: number;
  /** "2026-10-09" */
  date: string;
  callGamma: number;
  putGamma: number;
  callDelta: number;
  putDelta: number;
  callCharm: number;
  putCharm: number;
  callVanna: number;
  putVanna: number;
}

/** GET /api/stock/{ticker}/greek-exposure/strike (date) — the calls' gamma positive, the puts' negative, as UW states it */
export const uwGreekExposureByStrike = (ticker: string, date?: string): Promise<FeedResult<UwOpenExposure[]>> =>
  feedGet('uw', `/api/stock/${encodeURIComponent(ticker)}/greek-exposure/strike`, { date }, body =>
    rowsOf(body).map(r => ({
      strike: num0(r.strike),
      date: str(r.date),
      callGamma: num0(r.call_gex),
      putGamma: num0(r.put_gex),
      callDelta: num0(r.call_delta),
      putDelta: num0(r.put_delta),
      callCharm: num0(r.call_charm),
      putCharm: num0(r.put_charm),
      callVanna: num0(r.call_vanna),
      putVanna: num0(r.put_vanna),
    }))
  );

/** Implied vol by listed date — the at-the-money vol each expiry carries and the move it prices (34 dates for SPY, seen;
    an index's rows carry no dollar move). GET /api/stock/{ticker}/volatility/term-structure */
export interface UwTermPoint {
  expiry: string;
  /** Calendar days to it */
  dte: number;
  /** A fraction (0.088 = 8.8%) */
  volatility: number | null;
  /** The move it prices, a fraction of price */
  movePct: number | null;
}

export const uwTermStructure = (ticker: string): Promise<FeedResult<UwTermPoint[]>> =>
  feedGet('uw', `/api/stock/${encodeURIComponent(ticker)}/volatility/term-structure`, undefined, body =>
    rowsOf(body).map(r => ({ expiry: str(r.expiry), dte: num0(r.dte), volatility: num(r.volatility), movePct: num(r.implied_move_perc) }))
  );

/* ---- open interest, max pain and implied moves (Pinpoint and Terrain, 2026-10-12) -------------------------------- */

export interface UwStrikeOi {
  strike: number;
  callOi: number;
  putOi: number;
  /** The count's date as UW stamps it — today's is the count published after the session before closed */
  date: string;
}

/** Open interest by strike, every expiry together (491 rows for SPY, seen). GET /api/stock/{ticker}/oi-per-strike (date) */
export const uwOiPerStrike = (ticker: string, date?: string): Promise<FeedResult<UwStrikeOi[]>> =>
  feedGet('uw', `/api/stock/${encodeURIComponent(ticker)}/oi-per-strike`, { date }, body =>
    rowsOf(body).map(r => ({ strike: num0(r.strike), callOi: num0(r.call_oi), putOi: num0(r.put_oi), date: str(r.date) }))
  );

export interface UwMaxPain {
  expiry: string;
  /** The strike where the open interest pays least at expiry */
  strike: number | null;
}

/** Max pain for each listed expiry, earliest first (32 for SPY, seen; an index's rows carry no close). GET /api/stock/{ticker}/max-pain */
export const uwMaxPain = (ticker: string): Promise<FeedResult<UwMaxPain[]>> =>
  feedGet('uw', `/api/stock/${encodeURIComponent(ticker)}/max-pain`, undefined, body => rowsOf(body).map(r => ({ expiry: str(r.expiry), strike: num(r.max_pain) })));

export interface UwImpliedMove {
  /** Days out the volatility is read at — 1, 5, 7, 14, 30, 60 … */
  days: number;
  /** Implied volatility at that horizon, a fraction (0.125 = 12.5%) */
  volatility: number | null;
  /** The move the options price in over that horizon, a fraction of price */
  movePct: number | null;
  /** Where that volatility stands against its own year, a fraction */
  percentile: number | null;
}

/** Implied volatility and the move it prices in, interpolated to fixed horizons. GET /api/stock/{ticker}/interpolated-iv */
export const uwInterpolatedIv = (ticker: string): Promise<FeedResult<UwImpliedMove[]>> =>
  feedGet('uw', `/api/stock/${encodeURIComponent(ticker)}/interpolated-iv`, undefined, body =>
    rowsOf(body).map(r => ({ days: num0(r.days), volatility: num(r.volatility), movePct: num(r.implied_move_perc), percentile: num(r.percentile) }))
  );

/* ---- dark pool -------------------------------------------------------------------------------------------------- */

export interface UwDarkPrint {
  ticker: string;
  price: number;
  size: number;
  premium: number;
  /** The name's day volume when it printed */
  volume: number;
  nbboBid: number | null;
  nbboAsk: number | null;
  /** The reporting centre (seen: "L") */
  marketCenter: string;
  settlement: string;
  executedAt: number;
  canceled: boolean;
  trackingId: number;
}

const darkPrint = (r: Record<string, unknown>): UwDarkPrint => ({
  ticker: str(r.ticker),
  price: num0(r.price),
  size: num0(r.size),
  premium: num0(r.premium),
  volume: num0(r.volume),
  nbboBid: num(r.nbbo_bid),
  nbboAsk: num(r.nbbo_ask),
  marketCenter: str(r.market_center),
  settlement: str(r.trade_settlement),
  executedAt: ms(r.executed_at),
  canceled: bool(r.canceled),
  trackingId: num0(r.tracking_id),
});

/** Off-exchange prints, newest first: the market's (GET /api/darkpool/recent) or one name's (GET /api/darkpool/{ticker}) */
export const uwDarkpool = (opts: { ticker?: string; limit?: number; minPremium?: number; date?: string; olderThan?: string } = {}): Promise<FeedResult<UwDarkPrint[]>> =>
  feedGet('uw', opts.ticker ? `/api/darkpool/${encodeURIComponent(opts.ticker)}` : '/api/darkpool/recent', { limit: opts.limit ?? 100, min_premium: opts.minPremium, date: opts.date, older_than: opts.olderThan }, body => rowsOf(body).map(darkPrint));

/* ---- filings: congress, insiders --------------------------------------------------------------------------- */

export interface UwCongressTrade {
  /** UW's id for the member (seen live 2026-10-12) */
  politicianId: string;
  name: string;
  reporter: string;
  /** "house", "senate" or "executive" (seen live 2026-10-12: the executive branch's filings ride the same route) */
  memberType: string;
  ticker: string;
  issuer: string;
  /** "Buy", "Sell" … as filed */
  txnType: string;
  /** Whose holding, as filed: "self", "spouse", "joint", "child" or "undisclosed" (seen live 2026-10-12) — `issuer` on the wire */
  owner: string;
  /** The filed range, as words: "$1,001 - $15,000" */
  amounts: string;
  transactionDate: string;
  filedAt: string;
  notes: string;
}

/**
 * Congress's filed trades, the latest trade date first. GET /api/congress/recent-trades (ticker, date, limit ≤ 200).
 * `date` keeps the trades made on or before that day (seen live 2026-10-12) — how the next page back is asked for.
 */
export const uwCongressTrades = (opts: { ticker?: string; limit?: number; date?: string } = {}): Promise<FeedResult<UwCongressTrade[]>> =>
  feedGet('uw', '/api/congress/recent-trades', { ticker: opts.ticker, limit: opts.limit ?? 50, date: opts.date }, body =>
    rowsOf(body).map(r => ({
      politicianId: str(r.politician_id),
      name: str(r.name),
      reporter: str(r.reporter),
      memberType: str(r.member_type),
      ticker: str(r.ticker),
      issuer: str(r.issuer),
      owner: str(r.issuer),
      txnType: str(r.txn_type),
      amounts: str(r.amounts),
      transactionDate: str(r.transaction_date),
      filedAt: str(r.filed_at_date),
      notes: str(r.notes),
    }))
  );

export interface UwInsiderTrade {
  id: string;
  ticker: string;
  owner: string;
  officerTitle: string;
  isOfficer: boolean;
  isDirector: boolean;
  isTenPercentOwner: boolean;
  /** The SEC code as filed (seen: "S") */
  code: string;
  /** Signed shares: negative a sale */
  amount: number;
  price: number | null;
  stockPrice: number | null;
  transactionDate: string;
  filingDate: string;
  /** The form (seen: "144") */
  form: string;
  is10b51: boolean;
  sharesOwnedAfter: number | null;
  sharesOwnedBefore: number | null;
  /** The sector as UW files it ("Technology") */
  sector: string;
}

/**
 * Insider filings, newest first. GET /api/insider/transactions (ticker_symbol, limit ≤ 200, page from 0,
 * transaction_codes[] — seen live 2026-10-12: one day's filings fill 200 rows, so a page is a day or less)
 */
export const uwInsiderTrades = (opts: { ticker?: string; limit?: number; page?: number; codes?: string[] } = {}): Promise<FeedResult<UwInsiderTrade[]>> =>
  feedGet('uw', '/api/insider/transactions', { ticker_symbol: opts.ticker, limit: opts.limit ?? 50, page: opts.page, 'transaction_codes[]': opts.codes }, body =>
    rowsOf(body).map(r => ({
      id: str(r.id),
      ticker: str(r.ticker),
      owner: str(r.owner_name),
      officerTitle: str(r.officer_title),
      isOfficer: bool(r.is_officer),
      isDirector: bool(r.is_director),
      isTenPercentOwner: bool(r.is_ten_percent_owner),
      code: str(r.transaction_code),
      amount: num0(r.amount),
      price: num(r.price),
      stockPrice: num(r.stock_price),
      transactionDate: str(r.transaction_date),
      filingDate: str(r.filing_date),
      form: str(r.formtype),
      is10b51: bool(r.is_10b5_1),
      sharesOwnedAfter: num(r.shares_owned_after),
      sharesOwnedBefore: num(r.shares_owned_before),
      sector: str(r.sector),
    }))
  );

/* ---- earnings --------------------------------------------------------------------------------------------------- */

export interface UwEarning {
  symbol: string;
  name: string;
  reportDate: string;
  /** "premarket" or "postmarket" */
  reportTime: string;
  expectedMove: number | null;
  /** A fraction: 0.049 is 4.9% */
  expectedMovePct: number | null;
  streetMeanEst: number | null;
  actualEps: number | null;
  sector: string;
  hasOptions: boolean;
  /** Where the date came from (seen: "company", on every row 2026-10-12) */
  dateSource: string;
  /** The quarter the report covers, its last day: "2026-09-30" */
  endingFiscalQuarter: string;
  /** The close before the report (the day routes; null on a name's own list) */
  preEarningsClose: number | null;
  /** The stock's move the session after the report, a fraction: -0.0735 is −7.35% (null until it is out) */
  postMove1d: number | null;
}

const earning = (symbol: string) => (r: Record<string, unknown>): UwEarning => ({
  symbol: str(r.symbol) || symbol,
  name: str(r.full_name),
  reportDate: str(r.report_date),
  reportTime: str(r.report_time),
  expectedMove: num(r.expected_move),
  expectedMovePct: num(r.expected_move_perc),
  streetMeanEst: num(r.street_mean_est),
  actualEps: num(r.actual_eps),
  sector: str(r.sector),
  hasOptions: bool(r.has_options),
  dateSource: str(r.source),
  endingFiscalQuarter: str(r.ending_fiscal_quarter),
  preEarningsClose: num(r.pre_earnings_close),
  postMove1d: num(r.post_earnings_move_1d),
});

/** A day's reports before the open or after the close. GET /api/earnings/premarket | /api/earnings/afterhours (date, limit, page) — empty for a day with none */
export const uwEarningsDay = (when: 'premarket' | 'afterhours', opts: { date?: string; limit?: number } = {}): Promise<FeedResult<UwEarning[]>> =>
  feedGet('uw', `/api/earnings/${when}`, { date: opts.date, limit: opts.limit ?? 100 }, body => rowsOf(body).map(earning('')));

/** One name's reports, the next one first (125 rows for AAPL, seen; no `symbol` in the rows). GET /api/earnings/{ticker} */
export const uwEarningsFor = (ticker: string): Promise<FeedResult<UwEarning[]>> =>
  feedGet('uw', `/api/earnings/${encodeURIComponent(ticker)}`, undefined, body => rowsOf(body).map(earning(ticker.toUpperCase())));

/* ---- the listed expiries ----------------------------------------------------------------------------------------- */

export interface UwExpiry {
  expiry: string;
  openInterest: number;
  volume: number;
  /** Contracts listed on the date */
  chains: number;
}

/** Every listed expiry with its open interest and volume, earliest first (32 for SPY, seen). GET /api/stock/{ticker}/expiry-breakdown (date) */
export const uwExpiryBreakdown = (ticker: string, date?: string): Promise<FeedResult<UwExpiry[]>> =>
  feedGet('uw', `/api/stock/${encodeURIComponent(ticker)}/expiry-breakdown`, { date }, body =>
    rowsOf(body).map(r => ({ expiry: str(r.expires), openInterest: num0(r.open_interest), volume: num0(r.volume), chains: num0(r.chains) }))
  );

/* ---- the wire --------------------------------------------------------------------------------------------------- */

export interface UwHeadline {
  headline: string;
  /** The wire it came over (seen: "Tradex", "PR NewsWire", "Business Wire") */
  source: string;
  createdAt: number;
  /** The names it carries — empty for most macro lines */
  tickers: string[];
  tags: string[];
  /** UW's flag for a headline it counts as major */
  isMajor: boolean;
  /** UW's own tag: "positive", "negative", "neutral" (every one neutral, 2026-10-12) */
  sentiment: string;
  /** Each named ticker's close today and the session before, as UW attaches them */
  prices: Record<string, { close: number | null; prevClose: number | null }>;
}

/**
 * The news wire, newest first. GET /api/news/headlines (ticker, limit, page) — UW's catalog lists it (uw-mcp
 * docs/endpoints.json, as cited in docs/ideas-2026-10-09/notes/api_powered_features.md), and it answered 200 on the
 * Basic plan, checked live 2026-10-12 (100 headlines across 80 minutes of the morning).
 */
export const uwNewsHeadlines = (opts: { ticker?: string; limit?: number } = {}): Promise<FeedResult<UwHeadline[]>> =>
  feedGet('uw', '/api/news/headlines', { ticker: opts.ticker, limit: opts.limit ?? 100 }, body =>
    rowsOf(body).map(r => {
      const meta = (r.meta ?? {}) as Record<string, unknown>;
      const prices: UwHeadline['prices'] = {};
      for (const [t, v] of Object.entries(meta)) {
        const o = (v ?? {}) as Record<string, unknown>;
        const curr = (o.curr ?? {}) as Record<string, unknown>;
        const prev = (o.prev ?? {}) as Record<string, unknown>;
        prices[t] = { close: num(curr.c), prevClose: num(prev.c) };
      }
      return {
        headline: str(r.headline),
        source: str(r.source),
        createdAt: ms(r.created_at),
        tickers: Array.isArray(r.tickers) ? r.tickers.map(str).filter(Boolean) : [],
        tags: Array.isArray(r.tags) ? r.tags.map(str) : [],
        isMajor: bool(r.is_major),
        sentiment: str(r.sentiment),
        prices,
      };
    })
  );

/* ---- TRACE'S READS (2026-10-12): the day per contract, a contract's own day, multi-leg orders, minute bars --------- */

export interface UwContractDay {
  /** OCC style without the prefix: NVDA270115P00150000 */
  symbol: string;
  ticker: string;
  type: 'call' | 'put';
  strike: number;
  expiry: string;
  /** UW's sector, empty for a fund */
  sector: string;
  issueType: string;
  stockPrice: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  /** The last fill */
  close: number | null;
  /** The contract's close the session before */
  prevClose: number | null;
  avgPrice: number | null;
  volume: number;
  openInterest: number;
  prevOi: number;
  premium: number;
  askVolume: number;
  bidVolume: number;
  midVolume: number;
  noSideVolume: number;
  sweepVolume: number;
  floorVolume: number;
  multilegVolume: number;
  /** IV at the close before, and its change since — fractions */
  prevIv: number | null;
  ivChange: number | null;
  daysOfOiIncreases: number;
  daysOfVolOverOi: number;
  nextEarnings: string;
  lastFill: number;
  /** The name's whole option volume today */
  tickerVolume: number;
  trades: number;
}

const contractDay = (r: Record<string, unknown>): UwContractDay => ({
  symbol: str(r.option_symbol),
  ticker: str(r.ticker_symbol),
  type: r.option_type === 'put' ? 'put' : 'call',
  strike: num0(r.strike),
  expiry: str(r.expiry),
  sector: str(r.sector),
  issueType: str(r.issue_type),
  stockPrice: num(r.stock_price),
  open: num(r.open),
  high: num(r.high),
  low: num(r.low),
  close: num(r.close),
  prevClose: num(r.chain_prev_close),
  avgPrice: num(r.avg_price),
  volume: num0(r.volume),
  openInterest: num0(r.open_interest),
  prevOi: num0(r.prev_oi),
  premium: num0(r.premium),
  askVolume: num0(r.ask_side_volume),
  bidVolume: num0(r.bid_side_volume),
  midVolume: num0(r.mid_volume),
  noSideVolume: num0(r.no_side_volume),
  sweepVolume: num0(r.sweep_volume),
  floorVolume: num0(r.floor_volume),
  multilegVolume: num0(r.multileg_volume),
  prevIv: num(r.prev_iv),
  ivChange: num(r.iv_change),
  daysOfOiIncreases: num0(r.days_of_oi_increases),
  daysOfVolOverOi: num0(r.days_of_vol_greater_than_oi),
  nextEarnings: str(r.next_earnings_date),
  lastFill: ms(r.last_fill),
  tickerVolume: num0(r.ticker_vol),
  trades: num0(r.trades),
});

/**
 * The day per contract, heaviest volume first — the whole market, or one name (500 rows a call at most, seen; a
 * past session with `date`). GET /api/screener/option-contracts (limit, ticker_symbol, date). Seen live 2026-10-12.
 */
export const uwContractScreener = (opts: { ticker?: string; limit?: number; date?: string } = {}): Promise<FeedResult<UwContractDay[]>> =>
  feedGet('uw', '/api/screener/option-contracts', { ticker_symbol: opts.ticker, limit: opts.limit ?? 500, date: opts.date }, body => rowsOf(body).map(contractDay));

/** One contract's prints, newest first (500 a call at most). GET /api/option-contract/{id}/flow (limit, date) */
export const uwContractFlow = (symbol: string, opts: { limit?: number; date?: string } = {}): Promise<FeedResult<UwOptionTrade[]>> =>
  feedGet('uw', `/api/option-contract/${encodeURIComponent(symbol)}/flow`, { limit: opts.limit ?? 500, date: opts.date }, body => rowsOf(body).map(optionTrade));

export interface UwContractMinute {
  at: number;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  avgPrice: number | null;
  ivLow: number | null;
  ivHigh: number | null;
  volumeAsk: number;
  volumeBid: number;
  volumeMid: number;
  volumeNoSide: number;
  volumeMulti: number;
  premiumAsk: number;
  premiumBid: number;
  premiumMid: number;
  premiumNoSide: number;
}

/** One contract's day, a bar a minute (rth and outside it). GET /api/option-contract/{id}/intraday (date) */
export const uwContractIntraday = (symbol: string, date?: string): Promise<FeedResult<UwContractMinute[]>> =>
  feedGet('uw', `/api/option-contract/${encodeURIComponent(symbol)}/intraday`, { date }, body =>
    rowsOf(body)
      .filter(r => r.trading_hours === undefined || r.trading_hours === 'rth')
      .map(r => ({
        at: ms(r.start_time),
        open: num(r.open),
        high: num(r.high),
        low: num(r.low),
        close: num(r.close),
        avgPrice: num(r.avg_price),
        ivLow: num(r.iv_low),
        ivHigh: num(r.iv_high),
        volumeAsk: num0(r.volume_ask_side),
        volumeBid: num0(r.volume_bid_side),
        volumeMid: num0(r.volume_mid_side),
        volumeNoSide: num0(r.volume_no_side),
        volumeMulti: num0(r.volume_multi),
        premiumAsk: num0(r.premium_ask_side),
        premiumBid: num0(r.premium_bid_side),
        premiumMid: num0(r.premium_mid_side),
        premiumNoSide: num0(r.premium_no_side),
      }))
  );

export interface UwContractSession {
  date: string;
  volume: number;
  openInterest: number;
  lastPrice: number | null;
  avgPrice: number | null;
  iv: number | null;
  askVolume: number;
  bidVolume: number;
  sweepVolume: number;
  multilegVolume: number;
  premium: number;
}

/** One contract's sessions, newest first (10 seen). GET /api/option-contract/{id}/historic — the rows under `chains` */
export const uwContractHistoric = (symbol: string): Promise<FeedResult<UwContractSession[]>> =>
  feedGet('uw', `/api/option-contract/${encodeURIComponent(symbol)}/historic`, undefined, body => {
    const rows = (body as { chains?: unknown } | null)?.chains;
    if (!Array.isArray(rows)) throw new Error('no chains');
    return (rows as Record<string, unknown>[]).map(r => ({
      date: str(r.date),
      volume: num0(r.volume),
      openInterest: num0(r.open_interest),
      lastPrice: num(r.last_price),
      avgPrice: num(r.avg_price),
      iv: num(r.implied_volatility),
      askVolume: num0(r.ask_volume),
      bidVolume: num0(r.bid_volume),
      sweepVolume: num0(r.sweep_volume),
      multilegVolume: num0(r.multi_leg_volume),
      premium: num0(r.total_premium),
    }));
  });

export interface UwMultiLeg {
  id: string;
  ticker: string;
  /** UW's name for the shape (seen: "call_vertical_spread", "iron_condor", "put_calendar", "straddle", "other" …) */
  strategy: string;
  legCount: number;
  strikes: number[];
  size: number;
  /** Per structure: a debit positive, a credit negative */
  netPrice: number | null;
  netPremium: number | null;
  totalPremium: number;
  maxProfit: number | null;
  maxLoss: number | null;
  avgIv: number | null;
  netDelta: number | null;
  netTheta: number | null;
  minDte: number;
  maxDte: number;
  underlyingPrice: number | null;
  executedAt: number;
}

/** Multi-leg orders as one structure each, newest first (200 a call at most). GET /api/option-trades/multi-leg (limit, min_premium, older_than) */
export const uwMultiLeg = (opts: { limit?: number; minPremium?: number; olderThan?: string } = {}): Promise<FeedResult<UwMultiLeg[]>> =>
  feedGet('uw', '/api/option-trades/multi-leg', { limit: opts.limit ?? 200, min_premium: opts.minPremium, older_than: opts.olderThan }, body =>
    rowsOf(body).map(r => ({
      id: str(r.id),
      ticker: str(r.ticker),
      strategy: str(r.strategy),
      legCount: num0(r.leg_count),
      strikes: Array.isArray(r.strikes) ? r.strikes.map(num0) : [],
      size: num0(r.size),
      netPrice: num(r.net_price),
      netPremium: num(r.net_premium),
      totalPremium: num0(r.total_premium),
      maxProfit: num(r.max_profit),
      maxLoss: num(r.max_loss),
      avgIv: num(r.avg_iv),
      netDelta: num(r.net_delta),
      netTheta: num(r.net_theta),
      minDte: num0(r.min_dte),
      maxDte: num0(r.max_dte),
      underlyingPrice: num(r.underlying_price),
      executedAt: ms(r.executed_at),
    }))
  );

export interface UwMultiLegLeg {
  symbol: string;
  type: 'call' | 'put';
  strike: number;
  expiry: string;
  size: number;
  price: number | null;
  /** Where the leg printed: "ask", "bid", "mid" */
  side: string;
  iv: number | null;
  volume: number;
  openInterest: number;
}

/** One multi-leg order's legs. GET /api/option-trades/multi-leg/{id}/legs — strike read off the OCC symbol (the field is ×1000) */
export const uwMultiLegLegs = (id: string): Promise<FeedResult<UwMultiLegLeg[]>> =>
  feedGet('uw', `/api/option-trades/multi-leg/${encodeURIComponent(id)}/legs`, undefined, body =>
    rowsOf(body).map(r => {
      const sym = str(r.option_symbol);
      const m = /(\d{6})([CP])(\d{8})$/.exec(sym);
      return {
        symbol: sym,
        type: r.type === 'put' ? 'put' : 'call',
        strike: m ? Number(m[3]) / 1000 : num0(r.strike) / 1000,
        expiry: str(r.expiry),
        size: num0(r.size),
        price: num(r.price),
        side: str(r.side),
        iv: num(r.implied_volatility),
        volume: num0(r.volume),
        openInterest: num0(r.open_interest),
      };
    })
  );

/** A daily bar's day ("2026-10-12") as New York's 09:30 that day, epoch ms — the session it stands for */
const dayAt = (iso: string): number => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? nyWallTime(+m[1], +m[2], +m[3], 9, 30) : NaN;
};

export interface UwBar {
  at: number;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number;
  /** "r" the regular session, "pr" / "po" outside it */
  marketTime: string;
}

/** A name's bars, newest first (2,500 one-minute bars seen; a past day's whole tape with `date`, 768 for SPY on 2026-09-15,
    pre-market to after hours; `1d` a bar a session, 600 seen back to 2024, the day stamped in `date`, not `start_time`).
    GET /api/stock/{ticker}/ohlc/{candle_size} (limit, date) — an index answers 422 on this plan (cboe_index_access_missing) */
export const uwOhlc = (ticker: string, opts: { size?: '1m' | '5m' | '1d'; limit?: number; date?: string } = {}): Promise<FeedResult<UwBar[]>> =>
  feedGet('uw', `/api/stock/${encodeURIComponent(ticker)}/ohlc/${opts.size ?? '1m'}`, { limit: opts.limit, date: opts.date }, body =>
    rowsOf(body).map(r => ({ at: r.start_time != null ? ms(r.start_time) : dayAt(str(r.date)), open: num(r.open), high: num(r.high), low: num(r.low), close: num(r.close), volume: num0(r.volume), marketTime: str(r.market_time) }))
  );

export interface UwDailyBar {
  /** The session's date, New York's: "2026-10-12" */
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number;
  /** "r" the regular session, "pr" / "po" outside it — a date answers a row for each */
  marketTime: string;
}

/**
 * A name's day bars, newest first: three rows a date (pre-market, the regular session, after hours), about a year of
 * dates (753 rows, 251 regular, seen 2026-10-12 for SPY with limit 2500). GET /api/stock/{ticker}/ohlc/1d. An index
 * answers 422 (cboe_index_access_missing), as its minute bars do.
 */
export const uwDailyBars = (ticker: string, opts: { limit?: number } = {}): Promise<FeedResult<UwDailyBar[]>> =>
  feedGet('uw', `/api/stock/${encodeURIComponent(ticker)}/ohlc/1d`, { limit: opts.limit }, body =>
    rowsOf(body).map(r => ({ date: str(r.date), open: num(r.open), high: num(r.high), low: num(r.low), close: num(r.close), volume: num0(r.volume), marketTime: str(r.market_time) }))
  );

export interface UwNetFlowPoint {
  at: number;
  /** Cumulative through the session */
  netCallPremium: number | null;
  netPutPremium: number | null;
  netVolume: number | null;
  underlyingPrice: number | null;
}

/**
 * The market's same-day (or weekly) net premium, a point a minute, cumulative; points ahead of now come back empty.
 * GET /api/net-flow/expiry (expiration: zero_dte | weekly; moneyness: all | itm | otm | atm; tide_type: all |
 * equity_only | etf_only | index_only; date). Its underlying price is SPY's (seen).
 */
export const uwNetFlowExpiry = (opts: { expiration?: 'zero_dte' | 'weekly'; moneyness?: 'all' | 'itm' | 'otm' | 'atm'; tideType?: 'all' | 'equity_only' | 'etf_only' | 'index_only'; date?: string } = {}): Promise<FeedResult<UwNetFlowPoint[]>> =>
  feedGet('uw', '/api/net-flow/expiry', { expiration: opts.expiration ?? 'zero_dte', moneyness: opts.moneyness, tide_type: opts.tideType, date: opts.date }, body => {
    const outer = rowsOf(body)[0] as Record<string, unknown> | undefined;
    const pts = outer && Array.isArray(outer.data) ? (outer.data as Record<string, unknown>[]) : [];
    return pts
      .map(r => ({ at: ms(r.timestamp), netCallPremium: num(r.net_call_premium), netPutPremium: num(r.net_put_premium), netVolume: num(r.net_volume), underlyingPrice: num(r.underlying_price) }))
      .filter(p => p.netCallPremium !== null || p.netPutPremium !== null);
  });

/** The names with the most net premium either way today, signed (50 each way seen). GET /api/market/top-net-impact (limit, date) */
export const uwTopNetImpact = (opts: { limit?: number; date?: string } = {}): Promise<FeedResult<{ ticker: string; netPremium: number }[]>> =>
  feedGet('uw', '/api/market/top-net-impact', { limit: opts.limit ?? 100, date: opts.date }, body => rowsOf(body).map(r => ({ ticker: str(r.ticker), netPremium: num0(r.net_premium) })));

/** The day's volume by price, on exchange and off it (9,280 levels for SPY, seen). GET /api/stock/{ticker}/stock-volume-price-levels (date) */
export const uwVolumeAtPrice = (ticker: string, date?: string): Promise<FeedResult<{ price: number; lit: number; off: number }[]>> =>
  feedGet('uw', `/api/stock/${encodeURIComponent(ticker)}/stock-volume-price-levels`, { date }, body => rowsOf(body).map(r => ({ price: num0(r.price), lit: num0(r.lit_vol), off: num0(r.off_vol) })));

export interface UwStrikeFlow {
  strike: number;
  callVolume: number;
  putVolume: number;
  callPremium: number;
  putPremium: number;
}

/** The day's option volume and premium by strike, for one name (332 strikes for SPY, seen). GET /api/stock/{ticker}/flow-per-strike (date) */
export const uwFlowPerStrike = (ticker: string, date?: string): Promise<FeedResult<UwStrikeFlow[]>> =>
  feedGet('uw', `/api/stock/${encodeURIComponent(ticker)}/flow-per-strike`, { date }, body =>
    rowsOf(body).map(r => ({ strike: num0(r.strike), callVolume: num0(r.call_volume), putVolume: num0(r.put_volume), callPremium: num0(r.call_premium), putPremium: num0(r.put_premium) }))
  );

export interface UwExpiryFlow {
  expiry: string;
  callVolume: number;
  putVolume: number;
  callPremium: number;
  putPremium: number;
  callPremiumAsk: number;
  callPremiumBid: number;
  putPremiumAsk: number;
  putPremiumBid: number;
  callVolumeAsk: number;
  callVolumeBid: number;
  putVolumeAsk: number;
  putVolumeBid: number;
}

/** The day's option flow by expiry, for one name — the premium at the ask and on the bid. GET /api/stock/{ticker}/flow-per-expiry (date) — a bare array or under `data` */
export const uwFlowPerExpiry = (ticker: string, date?: string): Promise<FeedResult<UwExpiryFlow[]>> =>
  feedGet('uw', `/api/stock/${encodeURIComponent(ticker)}/flow-per-expiry`, { date }, body =>
    rowsOf(body).map(r => ({
      expiry: str(r.expiry),
      callVolume: num0(r.call_volume),
      putVolume: num0(r.put_volume),
      callPremium: num0(r.call_premium),
      putPremium: num0(r.put_premium),
      callPremiumAsk: num0(r.call_premium_ask_side),
      callPremiumBid: num0(r.call_premium_bid_side),
      putPremiumAsk: num0(r.put_premium_ask_side),
      putPremiumBid: num0(r.put_premium_bid_side),
      callVolumeAsk: num0(r.call_volume_ask_side),
      callVolumeBid: num0(r.call_volume_bid_side),
      putVolumeAsk: num0(r.put_volume_ask_side),
      putVolumeBid: num0(r.put_volume_bid_side),
    }))
  );
