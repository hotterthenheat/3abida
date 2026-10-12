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
  createdAt: ms(r.created_at),
  startTime: ms(r.start_time),
  endTime: ms(r.end_time),
});

/**
 * The flow alerts, newest first, the whole market or one name. GET /api/option-trades/flow-alerts (ticker_symbol,
 * limit, min_premium …). The per-name route /api/stock/{ticker}/flow-alerts answers without `id` or the times, so the
 * market route with `ticker_symbol` is the one read.
 */
export const uwFlowAlerts = (opts: { ticker?: string; limit?: number; minPremium?: number } = {}): Promise<FeedResult<UwFlowAlert[]>> =>
  feedGet('uw', '/api/option-trades/flow-alerts', { ticker_symbol: opts.ticker, limit: opts.limit ?? 50, min_premium: opts.minPremium }, body => rowsOf(body).map(flowAlert));

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
  executedAt: ms(r.executed_at),
  canceled: bool(r.canceled),
});

/** The option tape, newest first, the whole market or one name. GET /api/option-trades (ticker_symbol, limit …) */
export const uwOptionTrades = (opts: { ticker?: string; limit?: number; minPremium?: number } = {}): Promise<FeedResult<UwOptionTrade[]>> =>
  feedGet('uw', '/api/option-trades', { ticker_symbol: opts.ticker, limit: opts.limit ?? 100, min_premium: opts.minPremium }, body => rowsOf(body).map(optionTrade));

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
export const uwMarketTide = (opts: { date?: string; otmOnly?: boolean } = {}): Promise<FeedResult<UwTidePoint[]>> =>
  feedGet('uw', '/api/market/market-tide', { date: opts.date, otm_only: opts.otmOnly }, body =>
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

/**
 * Spot GEX across every strike, the latest (491 rows for SPY, strikes from 50 up, seen). GET
 * /api/stock/{ticker}/spot-exposures/strike (min_strike, max_strike, limit, page, date). Ask for a window round spot.
 */
export const uwSpotGexByStrike = (ticker: string, opts: { minStrike?: number; maxStrike?: number; date?: string } = {}): Promise<FeedResult<UwStrikeExposure[]>> =>
  feedGet('uw', `/api/stock/${encodeURIComponent(ticker)}/spot-exposures/strike`, { min_strike: opts.minStrike, max_strike: opts.maxStrike, date: opts.date }, body =>
    rowsOf(body).map(r => ({
      strike: num0(r.strike),
      price: num(r.price),
      time: ms(r.time),
      callGammaOi: num0(r.call_gamma_oi),
      putGammaOi: num0(r.put_gamma_oi),
      callDeltaOi: num0(r.call_delta_oi),
      putDeltaOi: num0(r.put_delta_oi),
      callCharmOi: num0(r.call_charm_oi),
      putCharmOi: num0(r.put_charm_oi),
      callVannaOi: num0(r.call_vanna_oi),
      putVannaOi: num0(r.put_vanna_oi),
      callGammaVol: num0(r.call_gamma_vol),
      putGammaVol: num0(r.put_gamma_vol),
      callGammaAsk: num0(r.call_gamma_ask),
      callGammaBid: num0(r.call_gamma_bid),
      putGammaAsk: num0(r.put_gamma_ask),
      putGammaBid: num0(r.put_gamma_bid),
    }))
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
      charmOi: num0(r.charm_per_one_percent_move_oi),
      vannaOi: num0(r.vanna_per_one_percent_move_oi),
    }))
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
export const uwDarkpool = (opts: { ticker?: string; limit?: number; minPremium?: number; date?: string } = {}): Promise<FeedResult<UwDarkPrint[]>> =>
  feedGet('uw', opts.ticker ? `/api/darkpool/${encodeURIComponent(opts.ticker)}` : '/api/darkpool/recent', { limit: opts.limit ?? 100, min_premium: opts.minPremium, date: opts.date }, body => rowsOf(body).map(darkPrint));

/* ---- filings: congress, insiders --------------------------------------------------------------------------- */

export interface UwCongressTrade {
  name: string;
  reporter: string;
  /** "house" or "senate" */
  memberType: string;
  ticker: string;
  issuer: string;
  /** "Buy", "Sell" … as filed */
  txnType: string;
  /** The filed range, as words: "$1,001 - $15,000" */
  amounts: string;
  transactionDate: string;
  filedAt: string;
  notes: string;
}

/** Congress's filed trades, newest first. GET /api/congress/recent-trades (ticker, date, limit) */
export const uwCongressTrades = (opts: { ticker?: string; limit?: number; date?: string } = {}): Promise<FeedResult<UwCongressTrade[]>> =>
  feedGet('uw', '/api/congress/recent-trades', { ticker: opts.ticker, limit: opts.limit ?? 50, date: opts.date }, body =>
    rowsOf(body).map(r => ({
      name: str(r.name),
      reporter: str(r.reporter),
      memberType: str(r.member_type),
      ticker: str(r.ticker),
      issuer: str(r.issuer),
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
}

/** Insider filings, newest first. GET /api/insider/transactions (ticker_symbol, limit, page …) */
export const uwInsiderTrades = (opts: { ticker?: string; limit?: number } = {}): Promise<FeedResult<UwInsiderTrade[]>> =>
  feedGet('uw', '/api/insider/transactions', { ticker_symbol: opts.ticker, limit: opts.limit ?? 50 }, body =>
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
