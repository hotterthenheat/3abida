# API-powered features for Slayer: what Polygon/Massive and Unusual Whales make possible, and how a browser terminal should take in live data

Research date: 2026-10-09. Scope: features the owner's plans make possible (Massive: Stocks Advanced, Options Advanced, Indices Advanced, Currencies Starter, plus NYSE Order Imbalances per the old `.env.example`; Unusual Whales: API Advanced). Licensing, redistribution and pricing are left out on purpose.

**How the sources were read.** massive.com, api.unusualwhales.com, unusualwhales.com and tradingview.com are all blocked by this environment's egress proxy (WebFetch returned EGRESS_BLOCKED for each). So endpoint names come from the vendors' own machine-readable catalogs on GitHub:
- **Massive:** the official `client-js` OpenAPI spec, which a bot re-syncs from api.massive.com (the newest sync branch is dated 2026-09-23). WebSocket channel codes come from the official `client-python` enums, last commit 2026-07-09.
- **Unusual Whales:** the official `uw-mcp` repo's `docs/endpoints.json`, which the repo calls "verified in CI" against the live API (last commit 2026-08-19). Socket channels come from the same repo's `registry.ts`. Socket payloads come from UW's official `api-examples` repo (2026-08-20) and a community copy of UW's OpenAPI spec (2025-10-22).
- **Search snippets:** a few Massive doc pages were confirmed only through search-result snippets. Those are marked "(snippet)".

**Effort scale** (assumes the thin proxy below exists):
- **S:** one panel on one endpoint, about 1–2 days.
- **M:** several endpoints, buffering or a new chart, about 3–7 days.
- **L:** new pipeline or storage, more than 2 weeks.

---

## 1. Polygon/Massive: which endpoints or streams enable features Slayer lacks?

### Takeaway
Massive's current spec goes well beyond bars and trades. Four things Slayer does not have:
- **Measured option chains for whole underlyings.** These carry IV, greeks, OI, FMV and break-even, and a terminal can build a real IV surface and real dealer exposure from them.
- **Index values over WebSocket.** These give a VIX term-structure strip.
- **Fed macro tables and FX/crypto.** These give a macro strip.
- **Two kinds of feed with no REST equivalent.** Auction-imbalance (NOI) and LULD sockets.

Beyond those, short interest, short volume and float; Form 4 and 13-F filings; and OPRA flat files back to 2014 for deep backtests. Slayer today simulates everything (src/core/simulator.ts) and has no IV surface, VIX curve, macro strip, short-interest panel, imbalance panel or LULD overlay (repo grep: 0 files for "imbalance", "short interest", "ETF flow", "fmv").

### Cited Findings

**Options chain snapshot**
- Endpoint: `GET /v3/snapshot/options/{underlyingAsset}`, "Get the snapshot of all options contracts for an underlying ticker." — [Massive OpenAPI (client-js)](https://raw.githubusercontent.com/massive-com/client-js/master/src/openapi.json)
- Filters: `strike_price`, `expiration_date`, `contract_type`, with `.gte/.gt/.lte/.lt` range variants.
- `limit` defaults to 10 and maxes at 250, so a full chain must follow `next_url`.
- Each result carries `break_even_price`, `day{open,high,low,close,volume,vwap,change_percent…}`, `details{contract_type, exercise_style, expiration_date, strike_price, ticker}`, `fmv`, `fmv_last_updated`, `greeks{delta, gamma, theta, vega}`, `implied_volatility`, `last_quote{bid, ask, midpoint, bid_size, ask_size…}`, `last_trade{price, size, conditions, exchange, sip_timestamp}`, `open_interest` and `underlying_asset{price, change_to_break_even}`.
- A single contract: `GET /v3/snapshot/options/{underlyingAsset}/{optionContract}`.

**Universal snapshot and summaries**
- `GET /v3/snapshot` ("Universal Snapshot") takes `type` ∈ {stocks, options, crypto, fx, indices} and `ticker.any_of` with "up to a maximum of 250" tickers. — [Massive OpenAPI](https://raw.githubusercontent.com/massive-com/client-js/master/src/openapi.json)
- It returns `session{…early_trading_change, late_trading_change, regular_trading_change…}`, `last_minute`, `last_quote`, `last_trade`, `market_status` and, for options, greeks, IV and OI.
- `GET /v1/summaries` (`ticker.any_of`) is described as "everything needed to visualize the tick-by-tick movement of a list of tickers" and includes `branding{icon_url, logo_url}`.

**Indices**
- `GET /v3/snapshot/indices` (`ticker.any_of`) returns `value` and `session{change, change_percent, open, high, low, close, previous_close}`. — [Massive OpenAPI](https://raw.githubusercontent.com/massive-com/client-js/master/src/openapi.json)
- Bars: `/v2/aggs/ticker/{indicesTicker}/range/{multiplier}/{timespan}/{from}/{to}`, `/v1/open-close/{indicesTicker}/{date}`, and SMA/EMA/RSI/MACD under `/v1/indicators/*/{indicesTicker}`.
- Index tickers use the `I:` prefix (examples in the spec: `I:NDX`, `I:SPX`, `I:DJI`). `/v3/reference/tickers` accepts `market=indices` to list them.
- Index WebSocket event types: `V` (Value), `A`, `AM`. The cluster is `indices` on `socket.massive.com`. — [client-python websocket enums](https://github.com/massive-com/client-python/blob/master/massive/websocket/models/common.py)

**WebSocket channels by cluster**
- Stocks/options: `T` (trade), `Q` (quote), `A` (per-second aggregate), `AM` (per-minute aggregate).
- Stocks only: `NOI` (Imbalances) and `LULD` (Limit Up Limit Down).
- Forex: `C` (quote), `CA`, `CAS` (aggregates).
- Crypto: `XT`, `XQ`, `XA`, `XAS`.
- Real-time host: `socket.massive.com`. Clusters: `stocks`, `options`, `forex`, `crypto`, `indices`, `futures`.
- Source for all of the above: [client-python websocket enums](https://github.com/massive-com/client-python/blob/master/massive/websocket/models/common.py)

**Options WebSocket**
- Options quotes: "Due to the high bandwidth and message rates associated with options quotes, users can subscribe to a maximum of 1,000 option contracts per connection." — [Massive docs: WS options quotes (snippet)](https://massive.com/docs/websocket/options/quotes.md)
- Options per-minute aggregates are `WS /options/AM`, real-time on the Advanced options plan. — [Massive docs: WS options AM (snippet)](https://massive.com/docs/websocket/options/aggregates-per-minute.md)

**Second-level aggregates**
- `timespan` on `/v2/aggs/ticker/{optionsTicker}/range/...` (and the stock and index variants) accepts `second, minute, hour, day, week, month, quarter, year`. — [Massive OpenAPI](https://raw.githubusercontent.com/massive-com/client-js/master/src/openapi.json)

**Trades and quotes history**
- Options: `/v3/trades/{optionsTicker}` and `/v3/quotes/{optionsTicker}`.
- Stocks: `/v3/trades/{stockTicker}` and `/v3/quotes/{stockTicker}` (NBBO).
- Latest prints: `/v2/last/trade/{optionsTicker}`, `/v2/last/nbbo/{stocksTicker}`.
- Trade-condition dictionary: `/v3/reference/conditions`. Exchange dictionary: `/v3/reference/exchanges`.
- Source: [Massive OpenAPI](https://raw.githubusercontent.com/massive-com/client-js/master/src/openapi.json)

**Fed and macro tables** (all from [Massive OpenAPI](https://raw.githubusercontent.com/massive-com/client-js/master/src/openapi.json))
- `GET /fed/v1/treasury-yields` returns `yield_1_month … yield_30_year` by date.
- `GET /fed/v1/inflation-expectations` returns `market_5_year`, `market_10_year`, `forward_years_5_to_10` and model horizons.
- Also present: `/fed/v1/inflation`, `/fed/v1/labor-market` and `/fed/v1/funding-conditions`.

**Short interest, short volume, float** (all from [Massive OpenAPI](https://raw.githubusercontent.com/massive-com/client-js/master/src/openapi.json))
- `GET /stocks/v1/short-interest`: FINRA data with `short_interest`, `days_to_cover`, `avg_daily_volume`, `settlement_date`.
- `GET /stocks/v1/short-volume`: `short_volume`, `short_volume_ratio`, and per-venue short volume (NYSE, Nasdaq Carteret/Chicago, ADF).
- `GET /stocks/vX/float`: `free_float`, `free_float_percent`.

**Filings and fundamentals** (all from [Massive OpenAPI](https://raw.githubusercontent.com/massive-com/client-js/master/src/openapi.json))
- `GET /stocks/filings/vX/form-4`: insider transactions straight from SEC Form 4, including `transaction_code`, `transaction_shares`, `transaction_price_per_share`, `shares_owned_following_transaction`, `is_officer`/`is_director`/`is_ten_percent_owner` and `aff_10b5_one`.
- Other filings: `/stocks/filings/vX/13-F`, `/stocks/filings/vX/form-3`, `/stocks/filings/10-K/vX/sections`, `/stocks/filings/vX/risk-factors`, `/stocks/filings/8-K/vX/text`.
- Financials: `/stocks/financials/v1/{income-statements|balance-sheets|cash-flow-statements|ratios}`. Ratios are "calculated on a daily basis" (P/E, EV/EBITDA, FCF, ROE …).

**Corporate actions and events** (all from [Massive OpenAPI](https://raw.githubusercontent.com/massive-com/client-js/master/src/openapi.json))
- `/stocks/v1/dividends`, `/stocks/v1/splits`, `/v3/reference/dividends`, `/v3/reference/splits`.
- `/vX/reference/tickers/{id}/events` (timeline).
- `/tmx/v1/corporate-events` (earnings releases, conferences, dividends — sourced from TMX).
- `/v1/reference/ipos`, `/v1/related-companies/{ticker}`.
- Market clock: `/v1/marketstatus/now` and `/v1/marketstatus/upcoming` (holidays).

**Partner datasets in the same spec** (all from [Massive OpenAPI](https://raw.githubusercontent.com/massive-com/client-js/master/src/openapi.json))
- Benzinga: `/benzinga/v2/news`, `/benzinga/v1/earnings` (with `eps_surprise_percent`, `revenue_surprise`), `/benzinga/v1/guidance`, `/benzinga/v1/ratings`, `/benzinga/v1/analyst-insights`, `/benzinga/v1/consensus-ratings/{ticker}`.
- ETF Global: `/etf-global/v1/fund-flows`, `/constituents`, `/profiles`, `/analytics`.
- Futures: `/futures/v1/*`, which is outside the owner's listed plans.

**Flat files**
- `us_options_opra/trades_v1`: "Tick-level trades with nanosecond timestamps from all U.S. options markets … made available as a daily downloadable S3 file." Files are `YYYY-MM-DD.csv.gz`, about 55–90 MB a day in 2025-10, refreshed around 11 a.m. ET for the prior day. History runs back to 2014-06-02. — [Massive flat files: options trades (snippet)](https://massive.com/docs/flat-files/options/trades/2025/10)
- Options day and minute aggregates also ship as flat files. — [Massive flat files: options day aggregates (snippet)](https://massive.com/docs/flat-files/options/day-aggregates.md); [options minute aggregates (snippet)](https://massive.com/docs/flat-files/options/minute-aggregates.md)
- Access is S3-compatible at `https://files.massive.com`, bucket `flatfiles`, prefixes like `us_stocks_sip/day_aggs_v1/YYYY/MM/`. — [client-python example: hunting-anomalies](https://github.com/massive-com/client-python/blob/master/examples/tools/hunting-anomalies/README.md)

**Technical indicators**
- `/v1/indicators/{sma|ema|rsi|macd}/{ticker}` exists for stocks, options, indices, fx and crypto. That includes a single option contract (`{optionsTicker}`). — [Massive OpenAPI](https://raw.githubusercontent.com/massive-com/client-js/master/src/openapi.json)

### Feature map (Massive)

| # | Feature | Endpoint(s) / stream(s) | UI | Room | Effort |
|---|---|---|---|---|---|
| P1 | **IV surface, smile and term line** | `GET /v3/snapshot/options/{underlyingAsset}` (paged, `limit=250`, `expiration_date.gte/lte`); fields `implied_volatility`, `greeks`, `open_interest`, `last_quote.midpoint` | Strike × expiry heatmap of IV (WebGL/canvas). Click an expiry for its smile. An ATM-IV-by-expiry line. A toggle between "IV" and "OI". Slayer's current `exposureSurface.ts` is a greek-exposure surface from its own estimator, not implied vol. | Weigher (new "Vol" tab); a pane in Terrain | M |
| P2 | **Dealer exposure from the measured chain** | Same snapshot: per-contract `gamma` × `open_interest` × 100 × spot (Slayer's own formula, kept private) | The same Pinpoint Map, ladder and walls, now built on measured OI and greeks instead of the simulator. The provenance chip flips from model to measured. | Pinpoint, Terrain ladder | M |
| P3 | **VIX term-structure strip** | `GET /v3/snapshot/indices?ticker.any_of=…`, WS `indices` `V.<I:…>` and `AM.<I:…>`, history `/v2/aggs/ticker/I:…/range/1/minute/…` | A curve across the CBOE vol indices the key reaches (confirm the list with `/v3/reference/tickers?market=indices`). The front-to-back slope is shaded, with an intraday sparkline per tenor. | Pulse widget; Terrain overlay | S |
| P4 | **Macro strip** | `/fed/v1/treasury-yields`, `/fed/v1/inflation-expectations`, `/fed/v1/labor-market`; FX `/v2/snapshot/locale/global/markets/forex/tickers` + WS `forex` `C`/`CA`; crypto `/v2/snapshot/locale/global/markets/crypto/tickers` + WS `crypto` `XA` | A thin strip above Pulse with the yield curve (2s10s spread), 5y/10y breakevens, EURUSD, USDJPY and BTC. Click for a curve-history drawer. | Pulse | S–M |
| P5 | **Deep options backtest on real ticks** | Flat files `us_options_opra/trades_v1` (and quotes/minute/day aggregates) from `files.massive.com` | A local ingest job (DuckDB/Parquet, as UW's own examples do for its sockets). The Backtest then replays real contract prices. Not something a browser downloads. | Practice → Backtest | L |
| P6 | **Real second-bar charts and session replay** | `/v2/aggs/ticker/{ticker}/range/1/second/…`; WS `stocks` `A.<sym>` (per-second), `options` `A.<O:…>` | Terrain gets a 1s/5s/15s timeframe. Replay steps through real second bars. Slayer's `replay.ts` replays only the simulator today. | Terrain, Practice | M |
| P7 | **Open/close auction imbalance board** | WS `stocks` `NOI.*` (no REST, no history, so capture it live server-side) | From 15:50 ET, a sorted board of imbalance side, size, paired quantity and clearing price vs last. It feeds Pulse at the close. | Pulse (closing panel); Trace | M |
| P8 | **LULD bands on the chart** | WS `stocks` `LULD.<sym>` | Upper and lower band lines on the Terrain chart. A band-hit chip in the alert drawer. | Terrain; alerts | S |
| P9 | **Short interest, short volume, float panel** | `/stocks/v1/short-interest`, `/stocks/v1/short-volume`, `/stocks/vX/float` | A stock-overview card: SI, days to cover, float %, a 30-day short-volume-ratio bar and a per-venue split. | Dossier → Stocks | S |
| P10 | **Filings-sourced insiders and 13F** | `/stocks/filings/vX/form-4`, `/stocks/filings/vX/13-F`, `/stocks/filings/8-K/vX/text`, `/stocks/filings/vX/risk-factors` | Insider rows straight from Form 4, with a 10b5-1 flag (`aff_10b5_one`) and ownership after the trade. 8-K text in the news reader. | Dossier | M |
| P11 | **Corporate-actions and events calendar** | `/stocks/v1/dividends`, `/stocks/v1/splits`, `/vX/reference/tickers/{id}/events`, `/tmx/v1/corporate-events`, `/v1/reference/ipos`, `/v1/marketstatus/upcoming` | Calendar rows in Dossier. The Weigher marks ex-dividend dates on the chain, which matter for early exercise and pricing. The market mark reads holidays. | Dossier; Weigher; shell mark | S |
| P12 | **Quote-true paper fills** | WS `options` `Q.<O:…>` (≤1,000 contracts per connection); snapshot `last_quote`, `fmv` | Paper fills against the live bid/ask and midpoint. The ticket shows the spread at fill. | Practice → Paper | M |
| P13 | **Inside-the-contract chart** | `/v2/aggs/ticker/{optionsTicker}/range/…`, WS `options` `AM`/`A`, `/v1/indicators/ema/{optionsTicker}` | The contract's own premium candles and VWAP inside Compass's "inside the contract". | Compass | S |
| P14 | **Cross-asset watchlist** | `GET /v3/snapshot` (`ticker.any_of` ≤250, mixed `type`), `/v1/summaries` | One watchlist mixing stocks, indices, FX, crypto and option contracts, with pre/post-market change (`early_trading_change`, `late_trading_change`). | Pulse; Watchlist | S |
| P15 | **Partner news, earnings surprise, guidance** | `/benzinga/v2/news`, `/benzinga/v1/earnings`, `/benzinga/v1/guidance`, `/benzinga/v1/ratings` | Dossier earnings rows with EPS and revenue surprise %. Guidance changes inline. | Dossier | S (if the key reaches them) |

### Inferences
- P1 and P2 come from the same paged snapshot call. Fetch it once per underlying per refresh on the proxy, and fan it out to Weigher, Pinpoint and Terrain.
- The default `limit=10` is a trap: SPY has thousands of contracts, so a single unpaged call silently returns 10.
- For exposure, Slayer's own calculation on Massive's chain and UW's ready-made spot exposures can be shown side by side (see §5). That fits the house's "Observed / Calculated / Modeled" vocabulary.
- NOI has no REST and no history. An imbalance panel therefore needs an always-on server-side capture, even for one user on localhost.
- Flat files are a server or offline job. A browser should never pull 55–90 MB gzipped CSVs per day.

### Gaps
- I could not open the live Massive docs to confirm whether `/fed/v1/*`, `/stocks/v1/short-*`, `/stocks/filings/*` and the Benzinga and ETF Global routes are reached by the owner's specific plans. The spec does not state entitlement for most of them. The old Slayer capability map flagged the same uncertainty for `/stocks/financials/v1/*`. Test each against the key.
- Which CBOE vol indices (VIX9D, VIX3M, VIX6M, VVIX and so on) the Indices plan carries is not in the spec. Only `I:SPX`, `I:NDX` and `I:DJI` appear as examples.
- Whether Currencies Starter streams in real time or delayed was not confirmed.
- The WebSocket connection limit per cluster was not confirmed from an official page. An aggregator ([apis.io](https://apis.io/rate-limits/polygon/polygon-rate-limits/)) claims one connection per asset class on lower tiers and no cap on higher tiers. Treat that as unverified.

---

## 2. Unusual Whales API Advanced: which documented endpoints and streams are untapped by Slayer?

### Takeaway
Every UW dataset Slayer depicts today is simulated: flow, dark pool, GEX, congress, insiders, earnings and news. So all of UW is untapped in the strict sense. These would add surfaces Slayer has no version of at all:
- Market/sector/ETF Tide
- NOPE
- the SPX/XSP/VIX market-maker "periscope" stream (gamma, charm and vanna by strike × expiry every 60 s)
- the volatility pack: IV rank, term structure, realized vol, risk-reversal skew, variance risk premium, VIX term structure
- max pain and OI change
- economic and FDA calendars
- ETF in/outflows
- shorts and FTDs
- CME futures
- custom-alert, interval-flow and trading-halt sockets
- a hosted MCP endpoint

### Cited Findings

**Catalog and transports**
- UW's official MCP README describes "200+ market data endpoints covering options flow, dark pool, congressional trading, Greek exposure, volatility, futures, and more". The hosted MCP endpoint is `https://api.unusualwhales.com/api/mcp` with `Authorization: Bearer`. — [uw-mcp README](https://github.com/unusual-whales/uw-mcp/blob/master/README.md)
- UW's product page lists access "via REST, WebSocket, Kafka, or MCP" and advertises a 1-minute SPX Market Maker Exposure item. — [UW public API page (snippet)](https://unusualwhales.com/public-api)

**Socket channels (official list, 2026)**
- `/api/socket/contract_screener`, `custom_alerts`, `flow_alerts`, `gex`, `interval_flow`, `lit_trades`, `market_tide`, `net_flow`, `news`, `off_lit_trades`, `option_trades`, `periscope`, `price`, `trading_halts`. — [uw-mcp registry.ts](https://github.com/unusual-whales/uw-mcp/blob/master/src/catalog/registry.ts)
- "WebSocket channels (`/api/socket/*`) are intentionally not exposed: MCP is request/response." — [uw-mcp README](https://github.com/unusual-whales/uw-mcp/blob/master/README.md)

**Socket mechanics and documented channels**
- Connect to `wss://api.unusualwhales.com/socket?token=<YOUR_API_TOKEN>`, then `join` a channel. Personal-use socket access requires the Advanced plan. — [UW OpenAPI copy](https://github.com/DigiBugCat/unusual-whales-api-docs/blob/main/openapi-spec.yaml); [UW docs: flow alerts socket](https://api.unusualwhales.com/docs/operations/PublicApi.SocketController.flow_alerts)
- Channels documented in the 2025 copy of UW's spec: `option_trades` ("6-10M records per day"), `option_trades:TICKER`, `flow-alerts`, `price:TICKER`, `news`, `lit_trades`, `off_lit_trades`, `gex:TICKER`, `gex_strike:TICKER`, `gex_strike_expiry:TICKER`. — [UW OpenAPI copy](https://github.com/DigiBugCat/unusual-whales-api-docs/blob/main/openapi-spec.yaml)

**`option_trades` payload**
- Fields: `nbbo_bid`, `nbbo_ask`, `ewma_nbbo_bid/ask`, `price`, `size`, `premium`, `open_interest`, `volume`, `implied_volatility`, `delta/gamma/theta/vega/rho`, `theo`, `exchange`, `trade_code`, `ask_vol/bid_vol/mid_vol/no_side_vol/multi_vol`, `underlying_price`, and `tags` (e.g. `"bid_side","bearish","etf"`). — [UW OpenAPI copy](https://github.com/DigiBugCat/unusual-whales-api-docs/blob/main/openapi-spec.yaml)

**`flow-alerts` payload**
- Fields: `rule_name` (e.g. `RepeatedHitsDescendingFill`), `total_premium`, `total_ask_side_prem`, `total_bid_side_prem`, `has_sweep`, `has_floor`, `has_multileg`, `all_opening_trades`, `volume_oi_ratio`, `trade_ids`, `exchanges`, `bid`, `ask`. — [UW OpenAPI copy](https://github.com/DigiBugCat/unusual-whales-api-docs/blob/main/openapi-spec.yaml)

**`gex` channels**
- `gex:TICKER` carries `gamma/charm/vanna_per_one_percent_move_{oi|vol|dir}` plus `price`.
- `gex_strike:TICKER` carries per-strike `call_/put_{gamma|charm|vanna}_{oi|vol}` and `call_gamma_ask_vol/bid_vol`.
- Source: [UW OpenAPI copy](https://github.com/DigiBugCat/unusual-whales-api-docs/blob/main/openapi-spec.yaml)
- Volume note: streaming `gex_strike_expiry` for 4 tickers for 25 minutes produced 295,219 records (199 MB in DuckDB). — [UW api-examples: spot greeks by strike by expiry](https://github.com/unusual-whales/api-examples/blob/main/examples/ws-stream-spot-greeks-by-strike-by-expiry/README.md)

**`periscope` (market-maker exposure)**
- It takes no ticker suffix. Tickers observed on 2026-08-20 were `SPX`, `XSP`, `VIX`, `NANOS`.
- Rows are `{strike, expiry, gamma, charm, vanna}`.
- Snapshots come "every 60 seconds", each delivered "about 71 seconds after the timestamp it carries".
- Chunks are 1,024 rows with `has_more` until the last one; one SPX snapshot is 17 messages. Buffer on `(ticker, timestamp)`.
- Source: [UW api-examples: periscope](https://github.com/unusual-whales/api-examples/blob/main/examples/ws-stream-periscope-greek-exposure/README.md)

**REST routes by group** (all named exactly as in [uw-mcp endpoints.json](https://github.com/unusual-whales/uw-mcp/blob/master/docs/endpoints.json))
- **Stock, exposure:** `/api/stock/{ticker}/greek-exposure`, `/greek-exposure/expiry`, `/greek-exposure/strike`, `/greek-exposure/strike-expiry`, `/gex-levels`, `/spot-exposures`, `/spot-exposures/strike`, `/spot-exposures/expiry-strike`, `/spot-exposures/{expiry}/strike`, `/greek-flow`, `/greek-flow/{expiry}`.
- **Stock, flow:** `/net-prem-ticks`, `/nope`, `/flow-per-strike`, `/flow-per-strike-intraday`, `/flow-per-expiry`, `/flow-recent`, `/flow-alerts`, `/option-stance`, `/options-pulse`.
- **Stock, OI and chain:** `/max-pain`, `/oi-change`, `/oi-per-strike`, `/oi-per-expiry`, `/option/volume-oi-expiry`, `/atm-chains`, `/expiry-breakdown`.
- **Stock, volatility:** `/iv-rank`, `/interpolated-iv`, `/volatility/term-structure`, `/volatility/realized`, `/volatility/stats`, `/volatility/anomaly`, `/volatility/character`, `/volatility/variance-risk-premium`, `/historical-risk-reversal-skew`.
- **Stock, price levels:** `/option/stock-price-levels`, `/stock-volume-price-levels`.
- **Option contract:** `/api/option-contract/{id}/flow`, `/historic`, `/intraday`, `/volume-profile`.
- **Flow:** `/api/option-trades/flow-alerts`, `/api/option-trades/full-tape/{date}` (marked premium), `/api/net-flow/expiry`, `/api/group-flow/{flow_group}/greek-flow`, `/api/lit-flow/recent`, `/api/lit-flow/{ticker}`, `/api/option-trades/multi-leg`, `/api/option-trades/multi-leg/{id}/legs`, `/api/option-trades/exchange-breakdown/{date}`.
- **Market:** `/api/market/market-tide`, `/api/market/{sector}/sector-tide`, `/api/market/{ticker}/etf-tide`, `/api/market/economic-calendar`, `/api/market/fda-calendar`, `/api/market/correlations`, `/api/market/oi-change`, `/api/market/top-net-impact`, `/api/market/total-options-volume`, `/api/options-pulse/{sectors|top|total}`, `/api/volatility/vix-term-structure`, `/api/volatility/anomaly/top`, `/api/volatility/character/top`.
- **Dark pool:** `/api/darkpool/recent`, `/api/darkpool/{ticker}`, `/api/darkpool/{ticker}/price-levels`.
- **Congress and politicians:** `/api/congress/recent-trades`, `/late-reports`, `/congress-trader`, `/politicians`, plus `/api/politician-portfolios/*`.
- **Insiders:** `/api/insider/transactions`, `/api/insider/{sector}/sector-flow`, `/api/insider/{ticker}/ticker-flow`.
- **Earnings:** `/api/earnings/premarket`, `/afterhours`, `/{ticker}`.
- **Companies:** `/api/companies/{ticker}/earnings-estimates`, `/transcripts/{quarter}`, `/dividends`, `/splits`.
- **ETFs:** `/api/etfs/{ticker}/in-outflow`, `/holdings`, `/exposure`, `/weights`.
- **Screeners:** `/api/screener/option-contracts`, `/api/screener/stocks`, `/api/screener/analysts`, `/api/option-activity/unusual`.
- **Shorts:** `/api/shorts/{ticker}/data`, `/ftds`, `/interest-float`, `/volume-and-ratio`, `/volumes-by-exchange`.
- **Seasonality:** `/api/seasonality/market`, `/monthly`, `/year-month`.
- **Alerts:** `/api/alerts`, `/api/alerts/configuration`.
- **Futures** (catalog marked premium): `/api/futures/contracts`, `/api/futures/flow`, `/api/futures/{contract}/trades`, `/candles`, `/stats`.
- **News:** `/api/news/headlines`.

**What the docs say about specific routes**
- `/api/stock/{ticker}/spot-exposures/strike` returns "the most recent spot GEX exposures across all strikes … Calculated either with open interest or with volume." — [UW OpenAPI copy](https://github.com/DigiBugCat/unusual-whales-api-docs/blob/main/openapi-spec.yaml)
- `/net-prem-ticks`: each tick is one minute, and clients cumulate the ticks for a daily chart.
- `/nope` is per-minute NOPE (Net Options Pricing Effect).
- `/stock-volume-price-levels` is lit and off-lit volume per price level. Its volume "does NOT represent the full market daily volume" (Nasdaq-operated exchanges and FINRA off-lit only).
- `/volatility/term-structure` is "the average of the latest volatilities for the at the money call and put contracts for every expiry date".

### Feature map (Unusual Whales)

| # | Feature | Endpoint(s) / stream(s) | UI | Room | Effort |
|---|---|---|---|---|---|
| U1 | **Live flow-alert rail** | socket `flow-alerts`; REST `/api/option-trades/flow-alerts`, `/api/option-trades/flow-alerts/{id}` | Trace alert rail showing the rule name, ask/bid premium split bar, sweep, floor and multi-leg flags, and vol/OI. A click opens the contract. Show sides, not UW's `bullish/bearish` tags (house rule: no trade calls). | Trace | M |
| U2 | **Per-name live option tape** | socket `option_trades:TICKER` (the full `option_trades` firehose is 6–10M a day: filter server-side) | Trace Live Tape on real prints, each with its NBBO at execution, IV, delta and an aggressor split. | Trace | M |
| U3 | **Streaming spot GEX by strike / strike × expiry** | sockets `gex:TICKER`, `gex_strike:TICKER`, `gex_strike_expiry:TICKER`; REST `/spot-exposures/strike`, `/spot-exposures/expiry-strike`, `/gex-levels` | Pinpoint ladder and Terrain strike beads update live. A three-way toggle: "by open interest / by today's volume / directional" (`_oi`, `_vol`, `_dir`). | Pinpoint, Terrain | M |
| U4 | **SPX market-maker map (periscope)** | socket `periscope` (SPX, XSP, VIX, NANOS; 60 s cadence; about 71 s behind; reassemble on `has_more`) | Strike × expiry heatmap of gamma, charm and vanna for SPX with a minute scrubber. The "as of" time is shown honestly (about 1 min behind). | Pinpoint (SPX), Terrain | M |
| U5 | **Market / sector / ETF Tide** | `/api/market/market-tide`, `/api/market/{sector}/sector-tide`, `/api/market/{ticker}/etf-tide`; socket `market_tide` | A Pulse widget with net call premium vs net put premium across the market through the session, plus sector small-multiples. | Pulse | S |
| U6 | **Net premium ticks and net flow** | `/api/stock/{ticker}/net-prem-ticks`, `/api/net-flow/expiry`; socket `net_flow` | Trace Net Flow on real minute ticks, cumulated client-side, with a per-expiry split. | Trace → Net Flow | S |
| U7 | **NOPE subpane** | `/api/stock/{ticker}/nope` | A per-minute NOPE line under the Terrain chart. Labelled as a read of hedging pressure, not a call. | Terrain; Pinpoint | S |
| U8 | **Volatility pack** | `/iv-rank`, `/interpolated-iv`, `/volatility/term-structure`, `/volatility/realized`, `/volatility/stats`, `/historical-risk-reversal-skew`, `/volatility/variance-risk-premium`, `/volatility/anomaly`; market `/api/volatility/vix-term-structure`, `/api/volatility/anomaly/top` | Weigher "Vol" tab: IV rank gauge, implied vs realized, skew history, VRP. Pulse gets a "vol anomalies" list. | Weigher; Pulse; Compass context | M |
| U9 | **Max pain and OI change** | `/api/stock/{ticker}/max-pain`, `/oi-change`, `/oi-per-strike`, `/oi-per-expiry`; `/api/market/oi-change` | A max-pain marker per expiry on the Pinpoint ladder, and an overnight OI-change bar per strike (opening vs closing interest). | Pinpoint; Weigher | S |
| U10 | **Dark pool, real prints and price levels** | socket `off_lit_trades`; `/api/darkpool/recent`, `/api/darkpool/{ticker}`, `/api/darkpool/{ticker}/price-levels`; `/api/stock/{ticker}/stock-volume-price-levels` | Trace Dark Pool on real prints. A lit vs off-lit volume profile on the Terrain price axis. | Trace → Dark Pool; Terrain | M |
| U11 | **Congress, politicians, insiders** | `/api/congress/recent-trades`, `/late-reports`, `/congress-trader`; `/api/politician-portfolios/*`; `/api/insider/transactions`, `/api/insider/{ticker}/ticker-flow`, `/api/insider/{sector}/sector-flow` | Dossier rows on real filings. A late-report flag. A sector insider-flow bar. | Dossier | S |
| U12 | **Earnings: real calendar, estimates and transcripts** | `/api/earnings/premarket`, `/afterhours`, `/{ticker}`; `/api/companies/{ticker}/earnings-estimates`, `/transcripts/{quarter}` | Dossier earnings day with each name's history of moves vs implied move (from U8 IV) and the transcript reader. | Dossier | S–M |
| U13 | **Economic and FDA calendars** | `/api/market/economic-calendar`, `/api/market/fda-calendar` | A Dossier calendar plus a Pulse "today" strip (CPI, FOMC and so on) with the clock to each release. | Dossier; Pulse | S |
| U14 | **ETF flows** | `/api/etfs/{ticker}/in-outflow`, `/holdings`, `/exposure`, `/weights` | A sector-ETF flow bar chart. Holdings sorted by weight, linking to each name. | Dossier; Pulse | S |
| U15 | **Contract screener feed** | `/api/screener/option-contracts`, `/api/option-activity/unusual`; socket `contract_screener` | Compass candidate pool sourced from a server-side screener rather than the simulator. Trace Screener on real data. | Compass; Trace → Screener | M |
| U16 | **Multi-leg prints** | `/api/option-trades/multi-leg`, `/api/option-trades/multi-leg/{id}/legs` | Trace multi-leg page on real spreads, legs drawn as a payoff (reusing the Weigher payoff). | Trace | S |
| U17 | **Contract volume profile** | `/api/option-contract/{id}/volume-profile`, `/intraday`, `/historic` | Inside-the-contract: premium-level volume profile and OI/volume history. | Compass | S |
| U18 | **Overnight futures strip (display only)** | `/api/futures/contracts`, `/api/futures/{contract}/candles`, `/stats`, `/api/futures/flow` | ES/NQ/CL/GC overnight strip on Pulse before the open. No futures trading or backtest, which were removed 2026-09-30. | Pulse | M |
| U19 | **Shorts and FTDs** | `/api/shorts/{ticker}/data`, `/ftds`, `/interest-float`, `/volume-and-ratio`, `/volumes-by-exchange` | Dossier stock card (complements P9). | Dossier | S |
| U20 | **Halts and news push** | sockets `trading_halts`, `news`; `/api/news/headlines` | Halt and resume toasts in the alert drawer. Headlines arrive live in Dossier. | Alerts; Dossier | S |
| U21 | **Server-side custom alerts** | `/api/alerts`, `/api/alerts/configuration`; socket `custom_alerts` | The alerts drawer shows alerts the owner configured on UW, pushed live. | Alerts | M |
| U22 | **Interval flow** | socket `interval_flow` (UW example: "custom interval flow options alerts") | Flow re-aggregated by name over N minutes for a Trace heat strip. | Trace | M |
| U23 | **Seasonality and correlations** | `/api/seasonality/market`, `/monthly`, `/year-month`; `/api/market/correlations` | Small calendar-heatmap card; a correlation matrix on Pulse. | Dossier; Pulse | S |
| U24 | **"Ask the terminal" panel via MCP** | `https://api.unusualwhales.com/api/mcp` (request/response only, no sockets) | A side panel where the owner asks questions in plain words, answered by an LLM calling UW tools through the proxy. Answers are reads, never trade calls. | Shell (any room) | L |

### Inferences
- Slayer already has screens for U1, U2, U3, U6, U10, U11 and U16 (Trace Live Tape, Net Flow, Dark Pool, multi-leg; Pinpoint; Dossier). For those, the work is plumbing plus provenance, not design.
- U4, U5, U7, U8, U9, U13, U14, U18 and U21 are new surfaces.
- UW's `option_trades` already carries `nbbo_bid/ask`, `ask_vol/bid_vol` and `tags` like `bid_side`. Side inference is partly done upstream. Slayer should show the evidence (where the price sat in the spread), not UW's `bullish/bearish` words, under the no-trade-calls rule.
- Periscope's roughly 71 s lag means the SPX map should carry an "as of 09:41" stamp rather than wearing the live dot. That matches the old provider layer's rule that only a socket is "live" and a poll is "measured". The lag argues for a third state such as "minute".

### Gaps
- The exact payload schemas for `market_tide`, `net_flow`, `interval_flow`, `contract_screener`, `custom_alerts` and `trading_halts` were not readable: api.unusualwhales.com/docs is blocked here, and the 2025 community spec predates these channels.
- UW's official per-minute and daily rate limits were not found. The MCP server's own throttle defaults to 120 requests per minute and its gateway reports 429s as "Approaching daily quota", but that is the client's setting, not UW's published limit. — [uw-mcp README](https://github.com/unusual-whales/uw-mcp/blob/master/README.md)
- Whether futures and `full-tape` are reached by API Advanced was not confirmed. The catalog only marks them "premium", and the MCP code says premium tools need "API Advanced, Enterprise Startup … or Enterprise tier". — [uw-mcp src/catalog](https://github.com/unusual-whales/uw-mcp/tree/master/src/catalog)

---

## 3. What exists in Slayer's provider layer today, and what are its gaps?

### Takeaway
The provider layer ("Provider layer: typed capability map + Polygon/UW clients", plus "Settings → Data sources") was built in commit `3642aaa` on 2026-09-21. It was then dropped when the repo was replaced with revamp-1_15 in commit `4acfed4` on 2026-09-30.

**Today's tree has none of it:**
- no `src/providers/`
- no `pages/settings/DataSources.tsx`
- no `data/provenance.ts`
- no `.env.example`
- no fetch or WebSocket client anywhere in `src`

The old layer survives only in git history. Even then it was a catalog plus a reachability check, not clients that fetch or stream data.

### Cited Findings
- **What 3642aaa added:** `src/providers/{types.ts, config.ts, index.ts, capabilities.ts}`, `src/pages/settings/DataSources.tsx` and `.env.example` (1,156 lines). Its message: "THE TERMINAL HAD NO DATA LAYER … no fetch, no WebSocket, no client, no key, no .env." — [Slayer git 3642aaa](local: /home/user/3abida, `git show --stat 3642aaa`)
- **Capability map:** 46 groups (16 Polygon, 30 UW). Each names `plan`, `transport` ('rest' | 'ws'), `market`, `endpoint`, `feeds` (provenance families `chain | exposure | tape | prints | candles | carry | earnings | macro`), `surfaces` (routes) and a `caveat`. — [Slayer git 3642aaa: src/providers/types.ts, capabilities.ts, data/provenance.ts](local: `git show 3642aaa:src/providers/capabilities.ts`)
- **Caveats it recorded:**
  - Polygon option snapshot greeks and IV are not required fields, there is no rho, and `limit` defaults to 10 with a max of 250.
  - Forex spells pairs `C:EURUSD` on REST and differently on the socket.
  - Every Polygon WS frame is an array with status frames interleaved.
  - The index `V` channel keys its symbol as `T`.
  - UW arrays take a `[]` suffix.
  - UW periscope must be buffered on `has_more`. — (same source)
- **config.ts, two modes:**
  - DIRECT: `VITE_POLYGON_KEY` / `VITE_UW_KEY` sent as a Bearer header from the browser. The file warns that "Vite INLINES every `VITE_`-prefixed variable into the shipped bundle".
  - PROXIED: `VITE_DATA_PROXY` with routes `<proxy>/polygon/<path>`, `<proxy>/unusualwhales/<path>`, `<proxy>/<provider>/socket`. Proxied wins when both are set.
  - Bases: REST `https://api.massive.com`, `https://api.unusualwhales.com`; WS `wss://socket.massive.com`, `wss://api.unusualwhales.com/socket`. — [Slayer git 3642aaa: src/providers/config.ts](local: `git show 3642aaa:src/providers/config.ts`)
- **index.ts:** `providerStatus`, `checkProvider` (described in code as "Deliberately NOT a data fetch: this is a reachability and entitlement" check), `feedsFor`, `applyProvenance` (REST → `measured`, socket → `live`) and `liveFeeds`. No function fetches market data or opens a socket. — [Slayer git 3642aaa: src/providers/index.ts](local)
- **Removal:** commit 4acfed4, "Replace the repo with revamp-1_15 … Everything this branch held before stays in its history (4fde6ef and down), so any of it can be brought back." — [Slayer git 4acfed4](local)
- **Current tree:** `ls src/providers` fails. A grep of `src` finds no `WebSocket`, `SharedWorker` or `new Worker`. IndexedDB is used only by `src/data/scriptStore.ts` for user scripts. — [Slayer src](local: /home/user/3abida/src)

### Gaps and improvements (inferences from the code above, checked against vendor sources in §1–2)
- **Bring it back first.** `git show 3642aaa:<path>` restores the map, the config and the Data sources page. data/provenance.ts must come back too, or be re-pointed to the current tree's equivalent.
  - The UI wording rule (2026-10-01) bans "simulated" anywhere visible. The old page and the provenance chips used that word, so their labels need rewording ("measured", "live", "projected", "model").
- **No real clients.** Missing pieces:
  - a REST client with paging (`next_url`)
  - retry with backoff on 429
  - a socket client with auth, subscribe/unsubscribe diffing, heartbeat and reconnect
  - UW `[channel, payload]` frame routing
  - periscope reassembly
  - Massive array-frame splitting
- **The catalog is now stale or thin.**
  - UW sockets: the old map listed 10 channels. The official 2026 list adds `contract_screener`, `custom_alerts`, `interval_flow`, `market_tide`, `net_flow` and `trading_halts`.
  - UW REST: groups were summarised as "N routes · one example". A per-route map would let Data sources say exactly which page each route feeds.
  - Massive: missing `/fed/v1/*`, `/stocks/v1/short-interest`, `/stocks/v1/short-volume`, `/stocks/vX/float`, `/stocks/filings/vX/*`, `/v3/snapshot` (universal), `/v1/summaries`, `/v1/marketstatus/*` and flat files.
  - The futures cluster and Benzinga are present in the spec but unaccounted for. Mark them as outside the plans rather than leaving them silent.
- **Direct mode leaks the key.** UW socket auth puts the token in the URL query string (`?token=`), and Massive's socket authenticates with a message carrying the key. A browser in DIRECT mode therefore exposes both keys. That conflicts with the owner's rule "Do not hardcode secrets into client-side code". The safe design drops DIRECT and keeps only the proxy, even on localhost: a 50-line Node/Bun server reading `.env` without the `VITE_` prefix. — [UW OpenAPI copy](https://github.com/DigiBugCat/unusual-whales-api-docs/blob/main/openapi-spec.yaml); [client-python websocket](https://github.com/massive-com/client-python/blob/master/massive/websocket/__init__.py)
- **No "minute" or "as of" provenance state.** Periscope (~71 s behind) and UW REST polls need an honest timestamp, not the live dot.
- **No server-side capture.** NOI has no history and periscope arrives every 60 s. A replay of "how the walls moved" needs the proxy to write them (Parquet/DuckDB, as UW's own examples do).
- **Market clock.** `data/marketState.ts` drives the mark's live/closed state from local reckoning. `/v1/marketstatus/now` and `/upcoming` (holidays, early closes) would make it exact.

---

## 4. Best practice for a browser terminal consuming many real-time streams

### Takeaway
The pattern the sources agree on has seven parts:
- **One connection per upstream, held by a server proxy that keeps the keys.** The browser holds one socket to that proxy.
- **The browser's socket lives in a SharedWorker** (or a dedicated Worker, as a fallback), so tabs share it.
- **The worker decodes, conflates and keeps the latest value per key.**
- **The main thread pulls once per animation frame.** Never one React render per message.
- **Snapshot plus delta.** Load REST state first, then apply stream deltas with sequence and timestamp checks.
- **Cache immutable history in IndexedDB.**
- **Rate-limit and page on the proxy.**

TradingView's documented datafeed follows this model: history through `getBars`, one shared socket for `subscribeBars` with a per-subscriber callback that updates the last bar. Bookmap-style heatmaps redraw at a fixed 25–40 FPS rather than per event.

### Cited Findings

**SharedWorker**
- Pusher's walkthrough puts the client inside a SharedWorker so a second tab opens "without a new connection appearing". — [Pusher blog](https://pusher.com/blog/reduce-websocket-connections-with-shared-workers)
- Teleportal pools connections "by URL and auth token" so all tabs share one WebSocket, and keeps the connection alive across reloads with a grace period. — [Teleportal guide](https://teleportal.tools/guides/shared-worker/)
- Messages are copied, not shared, between worker and tabs, so per-tick serialisation costs grow with rate. — [Pusher blog](https://pusher.com/blog/reduce-websocket-connections-with-shared-workers); [innei.in](https://innei.in/en/posts/tech/using-sharedworker-singleton-websocket-in-nextjs)
- Browser support: Can I Use lists SharedWorker on Safari and iOS from 16.0, and on Chrome for Android only in very recent versions. The version numbers shown should be checked against live MDN. — [Can I Use: SharedWorker](https://caniuse.com/mdn-api_sharedworker)

**Render batching**
- "Render only the latest state inside requestAnimationFrame." At 100 executions per second, updating the DOM for each "blows through the 16.6 ms budget". — [lilting.ch](https://lilting.ch/en/articles/us-stock-tick-websocket-feed)
- React "reconciles on every state update". Use a ref buffer flushed per rAF. — [SitePoint](https://www.sitepoint.com/streaming-backends-react-controlling-re-render-chaos/)
- Offload raw feeds to a Web Worker that passes only the latest data, and update top-of-book only when it changes. — [Finage blog](https://finage.co.uk/blog/how-to-handle-data-bursts-with-websocketbased-market-feeds--684afe9435110bd9c6a9ad6e)
- One open-source trading app reports separate cadences: about 16 ms (rAF) for prices, 50 ms for deltas and 100 ms for snapshots, cutting re-renders from 100+ to about 10 a second. That is the project's own unbenchmarked claim. — [SimplyTrading docs](https://gitea.com/infrastructure_SC/SimplyTrading/src/branch/main/frontend-app/docs/WEBSOCKET_BATCHING.md)

**TradingView datafeed**
- The streaming tutorial opens one WebSocket in a separate module, keeps a channel → subscription map with a handler list, and updates the last bar or starts a new one from each tick. — [TradingView: Streaming Implementation](https://www.tradingview.com/charting-library-docs/latest/tutorials/implement_datafeed_tutorial/Streaming-Implementation) (read via search summary; tradingview.com is blocked here)
- TradingView rejects bars that arrive out of order, so sorting matters. — [struct.to guide](https://www.struct.to/blog/streaming-polymarket-tradingview-charts)
- Reconnection, bar alignment and partial candles are the main production issues. — [Codex blog](https://www.codex.io/blog/stream-realtime-crypto-tradingview)

**Bookmap**
- The heatmap updates "video-like 25-40 FPS". — [Bookmap CEO interview](https://bookmap.com/bookmap-ceo-explains-the-key-feature-of-the-trading-platform/)
- It has been in the browser through Tradovate since 2017. — [Tradovate press release](https://www.tradovate.com/press-releases/bookmap-xray-now-available-on-tradovate/)
- A competitor (ATAS) claims Bookmap's browser rendering is "limited by WebGL". That is unverified and comes from a competitor. — [ATAS blog](https://atas.net/blog/best-heatmap-trading-software-2026/)

**Vendor constraints that shape the design**
- Massive options quotes: at most 1,000 contracts per connection. — [Massive docs (snippet)](https://massive.com/docs/websocket/options/quotes.md)
- UW `option_trades`: 6–10M records a day. — [UW OpenAPI copy](https://github.com/DigiBugCat/unusual-whales-api-docs/blob/main/openapi-spec.yaml)
- UW `gex_strike_expiry` on 4 tickers: about 295k records in 25 minutes. — [UW api-examples](https://github.com/unusual-whales/api-examples/blob/main/examples/ws-stream-spot-greeks-by-strike-by-expiry/README.md)
- UW's own Node socket example: exponential backoff from 5 s to 60 s, 5 attempts, and a ping timeout of 10 s. — [UW api-examples: Node multi-channel](https://github.com/unusual-whales/api-examples/tree/main/examples/ws-multi-channel-multi-output-nodejs)
- The UW periscope example buffers chunks in memory and writes only once `has_more` is false, de-duplicating snapshots replayed after a reconnect. — [UW api-examples: periscope](https://github.com/unusual-whales/api-examples/blob/main/examples/ws-stream-periscope-greek-exposure/README.md)
- The UW MCP client throttles with a sliding window (default 120 a minute) and backs off on 429. — [uw-mcp README](https://github.com/unusual-whales/uw-mcp/blob/master/README.md)

### Inferences: a recommended architecture for Slayer
1. **Thin proxy (Node or Bun, localhost).**
   - It holds `POLYGON_KEY` and `UW_KEY` (no `VITE_` prefix).
   - It opens one upstream socket per Massive cluster (stocks, options, indices, forex/crypto) and one UW socket.
   - It aggregates browser subscriptions (ref-counted), so ten panels wanting `T.SPY` cost one upstream subscription.
   - It filters the UW `option_trades` firehose down to the names in view.
   - It reassembles periscope and splits Massive array frames.
   - It caches REST (chain snapshots for about 5–15 s, fed and filings for hours) and enforces per-vendor token buckets with 429 backoff.
   - It writes NOI, periscope and GEX history to Parquet/DuckDB for replay.
   - The provider layer's old `<proxy>/<provider>/<path>` and `/socket` contract already fits this.
2. **Browser data worker.**
   - Use a SharedWorker where available, falling back to a dedicated Worker on platforms without it.
   - It owns the one socket to the proxy, decodes JSON off the main thread, and keeps a `Map<key, latest>` per stream.
   - Ticks are conflated to the latest value. Tape rows go into a capped ring buffer, for example the last 5,000 prints a name.
   - It posts compact batches (typed arrays or transferables for chart series) on a cadence the page asks for.
3. **Main thread.**
   - One external store, `useSyncExternalStore`, with per-key selectors, so a ladder row re-renders only when its strike changes.
   - Flush once per rAF.
   - Canvas or WebGL for the dense surfaces: heatmaps, surfaces, tape. React for chrome.
   - Pause flushes for hidden tabs or panels (`document.visibilityState`, IntersectionObserver). This keeps the house's existing "no endless animation" speed rules intact.
4. **Snapshot plus delta.**
   - On subscribe, take the REST snapshot (chain, spot exposures, net-prem ticks), stamp it with its timestamp, then apply deltas newer than the stamp.
   - On reconnect, re-snapshot and do not trust replayed deltas. UW's periscope example warns about double counting replayed snapshots.
   - Chart bars only append or update the last bar, in timestamp order (the TradingView rule).
5. **IndexedDB.**
   - Cache closed sessions' bars by `(symbol, timespan, day)`, since a closed day is immutable.
   - Cache reference data such as tickers, contracts and conditions with a TTL.
   - Never cache the live day without a version stamp.
   - Slayer already opens IndexedDB in scriptStore.ts, so the pattern is in-house.
6. **Backpressure.**
   - If the worker's outbound queue to a tab grows (a tab busy rendering), drop intermediate quote and greek updates and keep the latest per key.
   - Never drop tape prints silently. Mark a gap instead ("n prints skipped") so the tape stays honest.

### Gaps
- No primary engineering write-up from TradingView, Bookmap, Thinkorswim Web or similar on their internal worker or conflation design was reachable. tradingview.com is blocked here. The Bookmap WebGL claim comes only from a competitor.
- No authoritative benchmark for SharedWorker vs dedicated Worker cost at options-tape rates was found.

---

## 5. Features possible only by combining the two providers

### Takeaway
The distinctive features need both vendors:
- UW's derived reads: flow alerts, dealer exposure, dark-pool prints, tide.
- Massive's raw market record: second bars, NBBO and quotes, full chains with greeks/IV/OI, indices, OPRA history.

Joined, they let Slayer show evidence for every read. A print and where it sat in the quote. A level and how price behaved at it. An exposure figure computed two ways.

### Feature map (combined)

| # | Feature | Endpoint(s) / stream(s) | UI | Room | Effort |
|---|---|---|---|---|---|
| C1 | **Print-in-the-spread evidence** | UW socket `option_trades:TICKER` (`price`, `nbbo_bid/ask`, `ewma_nbbo_*`, `exchange`, `trade_code`) + Massive `/v3/quotes/{optionsTicker}` around `executed_at` and WS `options` `Q` (≤1,000 contracts) + stocks `Q` for the underlying NBBO + `/v3/reference/conditions` | Each tape row gets a small spread bar: bid, the print, ask. The underlying's bid/ask at that millisecond and the condition code in words. "At ask / above ask / mid" is shown as evidence, never as a call. | Trace → Live Tape; PrintDrilldown | M |
| C2 | **Live exposure levels on a real chart** | UW `gex_strike:TICKER` / `periscope` (SPX) + Massive WS `stocks` `A.<sym>` (second bars) or `indices` `V.I:SPX` | Terrain's strike field (walls, flip, beads) over real second candles. The Pinpoint "how the levels held" study on measured touches. | Terrain; Pinpoint → Levels | M |
| C3 | **Dark pool on the volume profile** | UW socket `off_lit_trades`, `/api/darkpool/{ticker}/price-levels`, `/api/stock/{ticker}/stock-volume-price-levels` + Massive `/v3/trades/{stockTicker}` / WS `T` with `/v3/reference/exchanges` (off-exchange reporting venue) | A volume profile on the Terrain price axis, split lit vs off-exchange, with large dark prints as ticks on the profile. | Terrain; Trace → Dark Pool | M |
| C4 | **Exposure two ways (Observed vs Calculated)** | Massive `/v3/snapshot/options/{underlyingAsset}` (Slayer computes) vs UW `/api/stock/{ticker}/spot-exposures/strike` | One ladder with both figures per strike and a shaded band where they disagree. The Data page says which is which (fits "Observed / Calculated / Modeled"). | Pinpoint | M |
| C5 | **Flow on the vol surface** | Massive chain snapshot (IV per strike/expiry) + UW `/api/stock/{ticker}/flow-per-strike`, `/flow-per-expiry`, socket `flow-alerts` | The IV heatmap (P1) with today's premium dots sized at the strikes and expiries where flow landed. | Weigher → Vol | M |
| C6 | **Contract story** | Massive `/v2/aggs/ticker/{optionsTicker}/range/1/minute/…`, `/v1/indicators/ema/{optionsTicker}` + UW `/api/option-contract/{id}/flow`, `/volume-profile`, `/historic` | Inside-the-contract: premium candles with every large print and alert pinned at its minute. OI by day underneath. | Compass | S–M |
| C7 | **Event-reaction viewer** | UW `/api/market/economic-calendar`, `/api/earnings/{ticker}` + Massive second bars, `/v3/snapshot/indices`, `/fed/v1/treasury-yields` | Pick a release (CPI, FOMC, an earnings date) to see SPY, VIX, 2y and 10y yields around it, and the implied move (UW `/volatility/term-structure`) vs the realized move. | Dossier; Pulse | M |
| C8 | **Paper desk with the tape beside it** | Massive WS `options` `Q` (fills at bid/ask) + UW `option_trades:TICKER` | Paper fills at the real quote. The Journal records the tape and exposure context at each fill, so a later review shows what the terminal showed at that minute. | Practice → Paper, Journal | M |
| C9 | **Historical "levels and outcomes" study** | Massive flat files (OPRA trades/quotes, stock minute aggregates) + UW `/api/stock/{ticker}/greek-exposure/strike?date=…`, `/spot-exposures/strike?date=…`, `/api/darkpool/{ticker}?date=…` + UW periscope/GEX history captured by the proxy | A Backtest that replays a past day with its real walls and flow, then tabulates what price did at the levels (counts and distances only, no success percentage). | Practice → Backtest | L |
| C10 | **Halts with LULD context** | UW socket `trading_halts` + Massive WS `LULD`, `NOI` | Alert-drawer cards: halt reason and time, the LULD band that was hit, and the reopening imbalance. | Alerts; Trace | S |
| C11 | **Macro and Tide together** | Massive `/fed/v1/treasury-yields`, FX/crypto snapshots, `indices` `V` + UW `/api/market/market-tide`, `/api/volatility/vix-term-structure` | A single Pulse macro row: yields, dollar pairs, VIX curve and market tide on one time axis. | Pulse | S |

### Inferences
- C1, C2, C4 and C9 make Slayer's "read, never an instruction" stance visible. Each read carries the raw evidence beside it. That is a stronger differentiator than any single feed.
- UW's history endpoints accept a `date` param (per endpoints.json schemas), so its exposure history plus Massive's flat files make C9 possible without capturing everything live. That is an inference from the parameter schemas; how many days back UW serves was not confirmed.
- Every combined feature needs timestamp alignment. UW gives epoch ms (`executed_at`); Massive gives SIP nanosecond timestamps (`sip_timestamp`). The proxy should normalise both to one clock.

### Gaps
- How far back UW's `date`-parameterised exposure and dark-pool endpoints go was not found in the reachable sources.
- The Massive exchange ID for FINRA/TRF off-exchange prints (needed for C3's lit vs off split on Massive's side) was not checked against `/v3/reference/exchanges`. Confirm it from that endpoint with the key.
