# The data feed (2026-10-12)

Slayer reads two vendors: **Unusual Whales API Basic** and **Massive (Polygon) Basic** (Stocks, Options, Indices,
Currencies). Neither plan has a socket, so the terminal asks on a timer. Until a room is moved onto them, a room
reads exactly what it read before; the Dossier, Trace, Pinpoint and Terrain are moved (2026-10-12, at the foot of this
page).

## Keys

1. Copy `.env.example` to `.env` at the repo root. `.env` is git-ignored; never commit it.
2. Fill in `UW_API_TOKEN` and `MASSIVE_API_KEY`. **No `VITE_` prefix**: Vite writes a `VITE_` variable into the
   browser bundle, and this repo is public.
3. Restart `npm run dev` (or `npm run preview`).
4. `npm run feed:check` calls one cheap route per vendor and prints `OK` or what went wrong, with the status:

   ```
   OK      Unusual Whales  UW_API_TOKEN     GET /api/stock/SPY/stock-state  → 200
   OK      Massive         MASSIVE_API_KEY  GET /v1/marketstatus/now  → 200
   ```

   `the key was refused` is a 401 (a bad key), `the plan does not reach this` a 403, `the network refused the host` a
   connection the network stopped before the vendor saw it. Behind an HTTPS proxy, run it (and the dev server) with
   `NODE_USE_ENV_PROXY=1` so Node's fetch uses the proxy (Node 22.21 or later).

Settings › Data sources shows each vendor's standing, what the plan carries, and which rooms read it.

## How a call travels

```
browser ──GET /feed/uw/api/…──────────▶ dev server (server/feed.ts) ──Bearer key──▶ api.unusualwhales.com
browser ──GET /feed/massive/v2/…──────▶ dev server                   ──?apiKey=…──▶ api.massive.com
```

- **The keys live on the server alone.** `vite.config.ts` reads them with `loadEnv(mode, cwd, '')` and hands them to the
  proxy middleware (dev and `vite preview`). Nothing in `src` reads a key; the bundle holds none.
- **No key**: the route answers `503 { "error": "no-key" }`. **Network refused**: `502 { "error": "network" }`.
  Otherwise the vendor's own status and body come back, any key scrubbed out of the text.
- **The proxy answers this machine only** (loopback). `FEED_ALLOW_LAN=1` lets another device on the network in.
- **Cache per URL**: a few seconds for the tape and quotes, 30 s for exposure, 10 min for filings, 30 min for Massive's
  bars, hours for reference lists. One request in flight per URL.
- **Massive's five calls a minute**: a token bucket queues the calls and lets them out as tokens come back (five at
  once, then one every 12 s); a 429 empties the bucket. A cached answer costs no token.
- **Unusual Whales' three calls at once** (seen 2026-10-12: the fourth of a burst came back 429 "You have exceeded 3
  concurrent requests, the maximum allowed for your current plan"; the per-minute header read 1,000,000): the proxy lets
  three out and queues the rest (`Gate`), and asks a 429 once more after a breath. A cached answer never waits.
- **`/feed/status`** reports, per vendor, whether a key is set (yes or no, never the key) and how a cheap probe went;
  it runs the probe at most once a minute.

## The client (src/data/feed/)

| File | What it holds |
|---|---|
| `price.ts` | `useFeedPrice`: a name's price off `stock-state`, one poll a name (`uw:state:<NAME>`, 10 s) for the rail and the rooms' pages, the last good answer standing through a 429 |
| `stockDay.ts` | `useFeedStockDays`: many names' day off the stock screener, fifty a call |
| `news.ts`, `stocks.ts`, `stockName.ts` | the Dossier's News, Stocks and a name's page on the house's engines |
| `alertFeed.ts` | the alerts' market while UW answers (below) |
| `listings.ts` | `useListedDates`: each name's listed expiries for Compass's calendar, asked two at a time, kept for New York's day |
| `client.ts` | `feedGet` / `feedFetch` (never throw; `{ ok, data }` or `{ ok: false, reason }`), `viaProxy` for Massive's `next_url`, `num()` for UW's numeric strings |
| `status.ts` | the feed-status store (`useFeedStatus`, `probeFeeds`, `startFeedProbe` — run by the shell as the terminal opens, never on the landing) |
| `poll.ts` | `useFeedPoll(key, load, periodMs)`: one timer per key at the shortest period asked, a hidden tab asks nothing, answers land once a frame |
| `uw.ts`, `massive.ts` | the typed fetchers below |
| `levels.ts` | Pinpoint's and Terrain's book on the feed: the exposure in the house's sign, the levels, open interest, max pain, the implied moves, the bars, the field (below) |
| `rooms.ts` | the per-room switch: what each room needs, one seam a room, and which room an address is in (`roomOfPath`, `pageSource`) |
| `providers.ts` | each plan's notes, for Settings |

## Endpoints (all answered 200 on 2026-10-12 unless marked)

Routes come from the vendors' own catalogs: Unusual Whales' `uw-mcp` `docs/endpoints.json` and Massive's OpenAPI
(`client-js` `src/openapi.json`), as cited in `docs/ideas-2026-10-09/notes/api_powered_features.md`. Fields come from
the live answers, kept in `docs/data-feed-samples.md`.

| Fetcher | Route |
|---|---|
| `uwStockState` | `GET /api/stock/{ticker}/stock-state` (the probe) |
| `uwQuote` | `GET /api/stock/{ticker}/quote` |
| `uwFlowAlerts` | `GET /api/option-trades/flow-alerts` (`ticker_symbol`, `limit`, `min_premium`) |
| `uwOptionTrades` | `GET /api/option-trades` (`ticker_symbol`, `limit`, `min_premium`) |
| `uwFlowRecent` | `GET /api/stock/{ticker}/flow-recent` (a bare array) |
| `uwNetPremTicks` | `GET /api/stock/{ticker}/net-prem-ticks` |
| `uwMarketTide` | `GET /api/market/market-tide` |
| `uwSpotGexByStrike` | `GET /api/stock/{ticker}/spot-exposures/strike` (`min_strike`, `max_strike`, `limit` — `1` reads the price the book is figured at) |
| `uwSpotGexByExpiryStrike` | `GET /api/stock/{ticker}/spot-exposures/expiry-strike` (`expirations[]`, `min_strike`, `max_strike`, `limit` ≤ 500 — it pages at 50 otherwise) |
| `uwSpotExposures` | `GET /api/stock/{ticker}/spot-exposures` |
| `uwOiPerStrike` | `GET /api/stock/{ticker}/oi-per-strike` (`date` — the day the count is published, after the session before closed) |
| `uwMaxPain` | `GET /api/stock/{ticker}/max-pain` (every listed date) |
| `uwInterpolatedIv` | `GET /api/stock/{ticker}/interpolated-iv` (implied vol and the move it prices in at 1, 5, 7, 14, 30, 60 … days) |
| `uwDarkpool` | `GET /api/darkpool/recent`, `GET /api/darkpool/{ticker}` |
| `uwCongressTrades` | `GET /api/congress/recent-trades` |
| `uwInsiderTrades` | `GET /api/insider/transactions` (`ticker_symbol`) |
| `uwEarningsDay` | `GET /api/earnings/premarket`, `/afterhours` (`date`) |
| `uwEarningsFor` | `GET /api/earnings/{ticker}` |
| `uwExpiryBreakdown` | `GET /api/stock/{ticker}/expiry-breakdown` |
| `uwNewsHeadlines` | `GET /api/news/headlines` (`ticker`, `limit`) — in UW's catalog; answered 200 on the Basic plan, 2026-10-12 |
| `uwStockScreener` | `GET /api/screener/stocks` (`ticker`: a comma list — 43 names in one answer) |
| `uwFinancials` | `GET /api/stock/{ticker}/financials` (earnings, income statements, cash flows, balance sheets) |
| `uwPoliticians` | `GET /api/congress/politicians` (party, chamber, district) |
| `uwEconomicCalendar` | `GET /api/market/economic-calendar` (event, time, previous, forecast) |

| `uwContractScreener` | `GET /api/screener/option-contracts` (`limit` ≤ 500, `ticker_symbol`, `date`) — the day per contract |
| `uwContractFlow`, `uwContractIntraday`, `uwContractHistoric` | `GET /api/option-contract/{id}/flow`, `/intraday`, `/historic` |
| `uwMultiLeg`, `uwMultiLegLegs` | `GET /api/option-trades/multi-leg` (`limit` ≤ 200, `min_premium`, `older_than`), `…/multi-leg/{id}/legs` |
| `uwOhlc` | `GET /api/stock/{ticker}/ohlc/{1m,5m,1d}` (`date` — a past day's whole tape; `1d` stamps the day in `date`) |
| `uwDailyBars` | `GET /api/stock/{ticker}/ohlc/1d` (three rows a date — `pr`, `r`, `po` — about a year; an index 422) |
| `uwGreekExposureByStrike` | `GET /api/stock/{ticker}/greek-exposure/strike` (`date` — the book at that session's open, every listed strike; its own units) |
| `uwTermStructure` | `GET /api/stock/{ticker}/volatility/term-structure` (each listed date's vol and move) |
| `uwNetFlowExpiry` | `GET /api/net-flow/expiry` (`expiration`: `zero_dte` or `weekly`; `moneyness`; `tide_type`) |
| `uwTopNetImpact` | `GET /api/market/top-net-impact` |
| `uwVolumeAtPrice` | `GET /api/stock/{ticker}/stock-volume-price-levels` (lit and off-exchange volume by price) |
| `uwFlowPerStrike`, `uwFlowPerExpiry` | `GET /api/stock/{ticker}/flow-per-strike`, `/flow-per-expiry` |
| `massiveMarketStatus` | `GET /v1/marketstatus/now` (the probe) |
| `massiveContracts`, `massiveExpirations` | `GET /v3/reference/options/contracts` (paged on `next_url`; one round `strike_price` lists every expiry in one call; `as_of` lists what was listed on a past day, expired contracts among them) |
| `massiveBars` | `GET /v2/aggs/ticker/{ticker}/range/{n}/{span}/{from}/{to}` (stocks and `O:` contracts — `occTicker` writes one — two years back, expired contracts too; the session before is the latest) |
| `massiveTickers`, `massiveTickerDetails` | `GET /v3/reference/tickers`, `GET /v3/reference/tickers/{ticker}` |
| `massiveIndices` | `GET /v3/snapshot/indices` — **403 on these plans** (as are `I:` bars) |

## Theta Data in Massive's place (2026-10-14)

The owner: "i have a new api key for you to use, you can disable the massive ones and use this one". **Massive is off**:
its key is handed to nothing (vite.config.ts, server/recorderMain.ts) and its lines in .env are commented, kept.
data/feed/massive.ts stays in the tree for the record; nothing calls it.

**How Theta Data is reached.** Theta Data has no cloud REST API: its REST interface is the **Theta Terminal v3**, a Java
21 program that runs on the owner's machine and serves `http://127.0.0.1:25503/v3/…`
(https://thetadata.net/docs/Articles/Getting-Started/Getting-Started.html). The key goes to the terminal when it starts,
never in a request. `npm run theta:terminal` (scripts/theta-terminal.mjs) starts it with THETADATA_API_KEY from .env,
downloading the program into .theta/ (git-ignored) on the first run, and writes its config to listen on 127.0.0.1
alone — its own default is every interface. scripts/theta-terminal.cmd keeps it running (register it with Task
Scheduler at startup, beside scripts/recorder.cmd). **One terminal a key**: a second terminal anywhere signs the first
out (Theta's error 478) — the proxy then says the terminal is not running, and the rooms that need it fall back.

**The proxy** (server/feed.ts, provider `theta`): `/feed/theta/v3/…` → the terminal, always asked as NDJSON and handed
back as JSON `{ rows }` with the terminal's own field names; 472 (no data) is an answer with no rows; 471 is the plan
(403); a terminal not running, signed out or taken over (474, 476, 478, 571, a refused connection) is 503
`{ error: 'no-terminal' }`. Four calls at once (the plan allows eight). A past day's answer is kept six hours, a
question naming today half a minute. `/feed/theta-minutes/option?symbol&expiration&strike&right&date` folds a
contract's trades into minutes (below).

**Seen live, 2026-10-14** (the terminal signed in here, before another terminal took the key's session):
- The account: **Professional** for stocks, options and indices; eight requests at once.
- `/v3/stock/history/ohlc` (1m, `venue=utp_cta`, 04:00–20:00): SPY's Oct 13 from 04:00. A month of minutes at most a
  call ("Bulk history requests are limited to no more than 1 month") — Sep 15 to Oct 13 was 20,181 rows in 21 s.
- `/v3/stock/history/eod`: a year at most a call ("max 365 days allowed"). **Its close is Theta's own 17:15 report**:
  over the 252 sessions to Oct 13 it equalled UW's regular-session close (the official close) on 251; Oct 13 it reads
  778.05 against the official 778.01. UW's rows stand over it wherever both carry a date.
- `/v3/index/history/price` (1m): SPX's minutes for Oct 13 (its 09:30 row 0.0 — no print yet); `/v3/index/history/eod`.
- `/v3/option/list/contracts/quote?symbol&date`: SPY's 13,172 contracts that quoted Oct 13 (Theta has no listing "as of"
  a date; a listed contract quotes). `/v3/option/list/expirations` lists every expiry ever (from 2012).
- `/v3/option/history/ohlc` (1m): a bar every minute (no trade: volume 0) — **its `vwap` is the session's running
  VWAP, not the minute's** (its field's own description and its documented example).
- `/v3/option/history/trade`: every print — SPY's 778 call expiring Oct 13 printed 147,237 times that day (40 MB).
  **Their sizes summed a minute equal the minute bar's volume on 391 of 391 minutes**, so the minute's own VWAP is
  folded from them by the proxy and only the minutes come back.
- `/v3/calendar/today`: the day's type and hours.
- Timestamps are New York's wall clock with no offset ("2026-10-13T09:30:00.000"); a bar's stamp is its opening minute
  (data/feed/theta.ts `nyStampMs`).

**Who reads it** (data/feed/theta.ts):
- **Terrain**: the five weeks of minutes before UW's four sessions (two calls a name) and two years of day bars (two
  calls) under UW's rows, as Massive's were; compare lines read the same two years.
- **The Backtest's real days** (`backtest` needs Theta Data alone): a name's sessions (two years of day bars), each
  session's minutes 09:30–16:00, the contracts that quoted on its first day (its expiries and each expiry's strikes read
  off them), and each opened contract's minutes, a call a day, folded from its trades — the fill rule unchanged (a
  contract fills only in a minute it traded, at that minute's VWAP).
- **The Dossier needs UW alone**: the company's name is UW's `/api/stock/{T}/info` (live: NVDA "NVIDIA").

**Not yet read** (the plan carries them): index prices for Terrain's SPX pane (Theta answers SPX's minutes), the
greeks, implied volatility and open interest by contract, seconds bars, real-time Nasdaq Basic. Each is a build of its
own.

**Not verified in the browser here**: Terrain's history and a Backtest real day drawn on Theta's answers — another
terminal signed in with the key about a minute after this one started, and Theta keeps one session a key, so this
session's terminal was stopped rather than fight it. The proxy's rules, the conversions and the minutes' fold are
checked (scripts/feed-proof.ts, against stand-in answers shaped as the live ones were); `npm run feed:check` on the
owner's machine says whether the terminal answers.

## The rooms: all or nothing

`src/data/feed/rooms.ts` names what each room would read (`needs`) and gives each room one seam — `pulseSource`,
`terrainSource`, `traceSource`, `dossierSource`, `pinpointSource`, `compassSource`, `weigherSource`, and
`useRoomSource(room)`. A room reads the feed only when **every** vendor it needs is up, never one vendor beside the
house's own figures on one screen. The Dossier, Trace, Pinpoint and Terrain are wired (below); every other room's `wired`
is `false`, so its seam returns `'stand-in'` and its pages read what they read before. Moving a room: rewire its pages to read the fetchers when its seam says `'feed'`,
then set `wired: true`.

## The Dossier, the first room moved (2026-10-12)

`dossier` is `wired: true`. With both vendors up **every Dossier page is the house's page on the vendors' answers** — the
same boxes, cards, menus, tabs and doors as with the keys out (the owner: "but i build the UI that the real data goes
into"); the feed variants `NewsFeed.tsx` and `StockNameFeed.tsx` are gone. While the shell's first probe is out a page
waits on its skeleton; with a vendor down every page reads the house's book exactly as before.

| Page | Reads | Asked |
|---|---|---|
| News | `uwNewsHeadlines` (the latest 100) as the house's stories (`data/feed/news.ts`: the kind of story in the house's seven words read off the headline, UW's sentiment, the house's read — `news.ts` `predict` — run on those inputs, the map's place by `newsroom.ts` `geoOf`); `uwEconomicCalendar` (`GET /api/market/economic-calendar`) for the day ahead and the month; the Earnings board's own reports in the month | wire 1 min, calendar 10 min |
| Earnings | `uwEarningsDay` for each weekday the board shows; each of its 80 largest names' own record (`uwEarningsFor`: the usual move after its reports, its beats); the IV rank and the move priced in to each report off the stock screener (`movePricedTo`, the square root of time between UW's horizons) | 10 / 30 min |
| Earnings › a name | `uwEarningsFor`, `uwStockState`; the record filled (`fillDossier`): the priced move, the IV rank, the odds the record gives (how many of the last reports closed inside today's priced move, how many moved up), the busiest calls and puts still open after the report off the name's contracts today | 10 min |
| Insiders | `uwInsiderTrades`, 3 pages of 200 | 10 min |
| Congress | `uwCongressTrades` paged back by trade date; each member's party and seat off `uwPoliticians` (`GET /api/congress/politicians`, once a visit) | 10 min |
| Stocks | `uwStockScreener` (`GET /api/screener/stocks?ticker=…`, one call for the list — `stockDay.ts`); the four sleeves read off its figures (`data/feed/stocks.ts`: the trend off the price against its 50- and 200-day averages, RSI and the month; the numbers off earnings growth a year on; the money off bullish against bearish premium; the news off the wire) and rolled up by the board's own composite, verdict and read (`stocks.ts` `pickOf`); the thirty days off `uwOhlc` `1d` against SPY's; the rotation off the sectors' returns against SPY's | 1 / 30 min |
| Stocks › a name | the house's overview (`stockOverview.ts` `overviewFrom`) on `data/feed/stockName.ts`: UW's daily bars (up to 250 sessions) and today's minutes, its book (`levels.ts`), open interest, the name's contracts, its dark crosses, the wire, its reports, its filed numbers (`uwFinancials`, `GET /api/stock/{ticker}/financials`), its recent prints; insiders and Congress as filed | 15 s – 6 h |

Massive is asked for the open name's company record only. What no answer on the plans carries is "—" in its own place,
or a control disabled saying why: a member's committee seats (Congress's Own committee), fair value and guidance (a
name's numbers), the house's overnight IV deflation and the estimates' drift (a report), the busiest contracts' moves
before the report. A filing says what was filed (a Form 144 is a notice, not a sale).

Screenshots on the vendors' answers, 2026-10-12 around 11:45 New York: `docs/data-feed/dossier-2026-10-12-*.png`; the
same pages filled, the evening of 2026-10-12: `docs/data-feed/fill-2026-10-12-*.png`.

## Trace reads Unusual Whales (2026-10-12)

`ROOM_FEEDS.trace.wired` is `true`: with UW up, **every Trace page is the house's page on the vendor's answers** — every
view, card, menu option, column, chart and the print card whole (`src/data/feed/trace.ts`, `traceCard.ts`,
`traceDark.ts`); with UW down every page reads its own book exactly as before. Nothing on one screen comes from both.

| Page | Reads | Poll |
|---|---|---|
| Live Tape | `option-trades`, prints of $25K and up, the newest 500, kept for the session | 5 s |
| Screener, Footprints, Tracker | `screener/option-contracts`: the market's 500 heaviest contracts and the name's own 500; the session before for the overnight ledger | 60 s / 30 s / 15 min |
| Watchers | `flow-alerts` of $100K and up (the vendor's three rules in the desk's words) and the desk's own six rules (`flowBook` `rulesFor`) and the reader's reasons read on the vendor's book | 15 s |
| Windows | `option-trades` of $250K and up, back to the open once, cut into quarter hours | 20 s |
| Multi-Leg | `option-trades/multi-leg` of $50K and up; a structure's legs when it opens; the search by contract off the order's strikes and its side | 15 s |
| Net Flow | the board: every expiry, `top-net-impact`'s names each read whole off the stock screener (net calls, net puts, volume); one expiry, the house's board on the vendor's contracts on it. The pane (`useFeedPaneLine`) | 60 s |
| 0DTE | the head: `net-flow/expiry` `zero_dte`; each pane its own cut (below) | 30 s |
| Compare | each name's contracts, flow by expiry (net, the sides — cut by the calendar), quote; the session's structures and tape | 30–60 s |
| Dark Pool | `darkpool/{ticker}` (the newest 200), `stock-volume-price-levels`, `ohlc/1m`, `oi-per-strike` (the options shelves: a cross not sized on one reads Hedge flow); the leaders: the day's crosses of $1M and up, heaviest first (`order_by=premium`, walked down by `max_premium` — `/darkpool/recent` takes no `older_than`), each leader's direction and average volume off the stock screener | 15 s / 2 min |
| The print card | over its own window — the range ladder (1D to 1M), the session it ends on, Single-leg only — every session's `flow`, `intraday`, the name's ticks and bars by `date` (a past session asked once), `historic`; flow by strike and by expiry of the window's last session | 15 s – 10 min |

**A pane's money by its cut** (`useFeedPaneLine`, Net Flow, 0DTE, Compare): a minute line where UW answers one for
exactly that cut — a name across every expiry and strike (`net-prem-ticks`), the market's same-day money by moneyness,
whole or its stocks alone (`net-flow/expiry`); every other cut (a name's moneyness or tenor or one expiry, the index
funds, a sector) the day's net calls, net puts and volume off the book's own contracts (each contract's premium times its
side, the house's rule), the line itself not on the plan (`flow-per-strike-intraday` answers the top strikes only).

A figure the answers do not carry is `NaN` in the row and "—" on the page, titled "not in the feed" — the session before
quarter hour by quarter hour (Footprints' sparkline), a print's overnight change in open interest, the name's premium a
minute (the card's dollar bars), a catch off the book's clip size. A floor a call needs is named on the page's line.

## The prior close is the official close (2026-10-13)

The rail's change stands on UW's stock-state `prev_close` — 778.10 for SPY on 2026-10-13. Checked against the other
figures for Oct 12: Massive's daily bar closes at 778.10 (the SIP's official closing price, the closing auction);
UW's and Massive's 15:59 minute bars close at 778.055 and 778.07; the 16:00 minute (after hours) at 777.99. So
778.10 is the official close and 778.06 is the last regular minute's trade before the auction, not the close — the
rail is right and keeps `prev_close`. A source showing −1.80 from 778.06 is measuring from the 3:59 bar.

## The rail's price follows the page's room (2026-10-12)

The shell's subject — the name, its price and change on the rail and on the phone's strip — reads the price of the
market the page under it reads (`rooms.ts` `pageSource` by the address; `SideNav` `useRailQuote`):

| The page | The rail's price |
|---|---|
| a room that reads the feed (Trace, the Dossier, Pinpoint, Terrain — and any room the day its `wired` turns true) | UW's `stock-state`: `close`, and the change from `prev_close` — `useFeedPrice`, every 10 s, one poll with the room's own pages |
| a room that reads its own book (Pulse, Compass, the Weigher), or a wired room with a vendor down | the house's, as before |
| no room's: Practice (Paper, the Backtest, the Journal), Settings, the Glossary, Community, Alerts | the house's: Paper and the Journal mark on the house's book and a Backtest session on its own market (the house's tape or a real day's record); the alerts drawer opens over any page with the house's figures |
| a wired room while the shell's first probe is out | nothing ("—"), as the room's pages show nothing |

A 429 (UW Basic answers three calls at once, and other sessions share the key), a timeout, the network or a 5xx keeps
the last good price for five minutes. **The indices have no price on the Basic plan** (`stock-state` answers 422 for SPX,
NDX, RUT, VIX and XSP): on every page that reads the feed the rail shows the price the index's book was figured at
(`levels.ts`), its change left off — never the house's figure beside the vendor's prints; "—" only when the book too has
answered with nothing. A name answered 422 is not asked again that visit. On every other page the house's figure stays.

The watchlist drawer follows the same rule (`WatchlistDrawer` by `pageSource`): over a page whose room reads the feed each
row is UW's day state and the nearest wall or flip of UW's book (`levels.ts`), an index its book's price; over any
other page the house's.

## Alerts watch the real price (2026-10-12)

While UW answers, the shell's watcher (`components/alerts/AlertWatcher.tsx`) judges every alert on the market's own
figures and never on the house's simulator (`data/feed/alertFeed.ts`): the price off UW's day state every 10 s (the
rail's own loader, `price.ts` `loadState`; an index the price its book was figured at), the book (walls, flip, supreme,
net GEX, the strike step) every 30 s for a level alert, UW's minute bars every minute for an average, an RSI, a script or
a drawn line (a seconds timeframe has none and waits), the name's recent prints for a flow alert, its headlines for a
news alert. One call at a time; a hidden tab keeps asking (an alert rings with the tab hidden). A chart that judges
alerts on its own tape (`StrikeChart`) stands aside meanwhile. An alert armed while the alerts watch the feed — Pinpoint's
Targets, Terrain's menu, the command line, a drawn line — takes its side from the real price (`gex/alertMarket.ts`
`spotForArm`). The fired log keeps the price it fired at and the market it was read off (`mark`, `market`), and the
drawer says it. With UW down, the house's price, as before.

Checked on 2026-10-12 after the close: an alert on SPY "above 700", left from earlier, fired on the keys-in server at
UW's 777.71 (`stock-state` read 777.71) and stayed quiet on the keys-blank server (the house's SPY at 509.98); "SPY alert
600" from the command line armed "at or below" off the real price, and "at or above" off the house's.

## Compass's calendar on the real listed expiries (2026-10-12)

Compass stays `wired: false` — its setups, prices and figures are the house's. **Its calendar is the exchange's**: with
UW up, the board's expiry calendar and categories read each name's listed dates off
`GET /api/stock/{ticker}/expiry-breakdown` (`listings.ts`), the dates alone — never its open interest, volume or chain
count. A listed date is a calendar fact, the same in any market (as the holidays in `core/calendar.ts` are), so it stands
under the house's setups without making two markets on one screen; the stand-in mapping (`compassStandIn.ts`) moves a
setup onto one of those dates instead of the schedule's.

- **Roots**: an index lists its AM-settled monthlies under a root of its own — SPX and SPXW, NDX and NDXP, RUT and
  RUTW; VIX and VIXW are both AM (the Wednesday settlement); XSP is one PM root. An AM date's last trading day is the
  session before (`expiryClass.ts`); half days and holidays are the house's calendar as before.
- **Asked lazily**: the board's names only (23 or so), two calls at a time, once a name a New York day, kept on this
  machine for the day (`slayer_listed_dates`); the proxy keeps an answer 30 minutes. The board shows its skeleton until
  every name has answered (a few seconds, once a day), so no setup is filed on the schedule and moved a moment later. A
  name refused twice keeps the schedule (asked again every half minute); a name UW lists nothing for (`{ "data": [] }`)
  keeps it too.
- **Why not Massive**: it refuses the indices (403) and answers five calls a minute, five minutes for the board's names.
  UW's breakdown is read off open interest, so a date first listed today joins the calendar the session after (Massive
  carried 2026-10-26 for SPY, AAPL and NVDA on the 12th; UW did not). Every other date agreed.
- UW down: the schedule, exactly as before.

## Pinpoint and Terrain read Unusual Whales (2026-10-12)

`ROOM_FEEDS.pinpoint` and `ROOM_FEEDS.terrain` are `wired: true`, and both **need UW alone**: every figure either room
draws is a UW route (Massive's minute bars stop at the session before, which UW's reach, and it refuses the indices;
UW's own daily bars, 600 sessions, serve the ATR). With UW down (no key, the network, a refused key) both read the
house's book exactly as before; while the shell's first probe is out they stand as their skeletons. Nothing on one
screen comes from both: the rail's price, the head's facts and the watchlist drawer read the feed on those pages.

**The book.** `/spot-exposures/strike` round the price (±10%, narrowed to about 34 strikes each side once the chain's
step is known, rounded so the address holds still), 30 strikes kept each side — the house's `BOOK_WINDOW`. UW's signs
are mapped onto the house's (core/walls.ts: negative call-dominant): gamma, delta and the calls' vanna and charm
negated, the puts' vanna and charm as they come. The walls, the flip and the supreme are `pickWalls` / `pickFlip` on
those rows; checked against a curl of the same answers on 2026-10-12 after the close (SPY 785 / 755 / 777.50 / 778,
QQQ 760 / 745 / 749.50 / 745, NVDA 240 / 205 / 226.50 / 240, SPX 7900 / 7700 / 7807.50 / 7900 — the pages printed the
same). "How sure" says what a feed level stands on: the close the count stands for (UW's count dated Oct 12 is Oct 9's
close) and the price and minute UW figured the hedging at.

### Pinpoint: the owner's pages, the vendor's figures (2026-10-12, rewired the same evening)

**A past session's open book (2026-10-13).** Pinpoint's history read `/greek-exposure/strike?date=D` as "the session at
its open". Measured against the recorder's books it is the day's END state (today's dated answer sits nearer the newest
book than the prior close; a past date's is its close), so the records stood on a look-ahead. Now a past session's open
is the rebuilt field's column on its opening bar (trailModel `openColumn` through `pastInputs`, one mapping with the
server's store and Terrain's trail): the day's published count, the session before's close vols, the first minute's
prints, nothing knowable later; the server builds the session once when asked (`/feed/field/<NAME>/past`), and a
session not built yet is asked again in a minute. scripts/field-store-proof.ts holds the look-ahead test: every vol
stamped after 9:31 changed leaves the open column the same; the first minute's own vols move it.

THE UI IS THE OWNER'S; THE FEED FILLS IT. Pinpoint has one set of pages. The feed variants of the afternoon
(`pages/pinpoint/feed`, a list of strikes in place of each page) are gone: with the room on the feed every page, panel,
tab, menu, guide and row action (the alert, the Chart door) is the house's, and every engine under it reads the market
through one seam, `src/data/bookMarket.ts` — the bars, the book through time, the build's open interest, the name (its
price, implied vol and strike step), its day's change, its snapshot. The seam answers with the house's simulator, or
with `src/data/feed/pinpointMarket.ts` on a Pinpoint address while the room reads the feed (read at the call: another
room's page never reads the vendor's book). The same engines then run on UW's answers:

| Read | Engine (unchanged unless said) | Its inputs on the feed |
|---|---|---|
| The book, its walls, flip, pin, supreme, zones | `buildExposureProfile` — no leg texture, the day's own volume, a level the book does not hold is NaN ("—"), never spot | `/spot-exposures/strike` (every listed date together), `/oi-per-strike`, `/flow-per-strike` |
| A dated lens (Compare's Expiry card, today's contracts) | the same, on one listed date's rows | `/spot-exposures/expiry-strike` |
| The calendar (the Map's ledger, the bell's share) | the vendor's own columns (`levels.ts feedSurface`); an index's dailies under its second root (SPXW, NDXP, RUTW, VIXW) | `/spot-exposures/expiry-strike` 7 dates a call, `/max-pain` for the listed dates, `/volatility/term-structure` for each date's vol |
| The range, where it closes, the odds a level is reached or holds, the agenda's order, the wall board | `buildCorridor`, `buildCloseOdds`, `buildWallContext` / `oddsAt`, `buildAgenda`, `buildWallBoard` | the book; the 1-day implied vol (`/interpolated-iv`); today's minute bars (`/ohlc/1m`, the regular session); the name's prints (`/flow-recent`, at the ask or the bid) |
| The range's record, how the levels held over past sessions | `recentSessions`, `levelRecords` | six sessions of minute bars by date (`/ohlc/1m?date=`); each session's book at its open (`/greek-exposure/strike?date=` — UW figures it once a day, back past a year on Basic) |
| The half-hour schedule | `buildSchedule`; the hedge that comes off at the bell is the session's own listed date's delta | the dated rows; the whole book's vanna |
| The Trader's Clock, the levels' projections | `buildVannaCharm` — every strike at the model's middle rate (no per-strike texture), the vanna tilt on UW's own vanna exposure | the book |
| What was built, where the walls are heading | `buildBuilding` on the last COUNTED session, read whole (`buildClockOf`): open interest is counted once a day, so the count before it against the count after it — the day's traded contracts are not open interest | two `/oi-per-strike` counts |
| Open interest overnight | `oiChangeByStrike` on the two counts (the market's `oiCounts`) | the same |
| Dealers through the session | `dealerTimeline` — net GEX a minute from UW's whole book a minute; the flip each minute off the book by strike as this terminal read it (the field), where it was read | `/spot-exposures` (today's, or the session's by `date`), the field |
| The head's flip and crossings, the Board's crossings, the drift | `buildFlipGauge`, `buildDrift` — bars and books paired by time (the house keeps one a bar, in lockstep, so the same reads) | the bars; the field carried to every minute bar after each read |
| Max pain | UW's own for the nearest listed date (`bookMaxPain`) | `/max-pain` |
| The ATR (the ruler, Building's distances, Compare) | `sessionAtr`, on daily bars | `/ohlc/1d` |
| "Since the open", Replay | `buildLevelRead`, `netSinceOpenRatio`, `replayRange` | today's books as this terminal read them (the field) — before the first read of the day there is none, and the report card prints "—" with why |
| Compare's pair | `buildPair` | both names' six sessions of bars |

**Still "—", in its own place:** vega by strike (UW's exposure carries no vega: the VEX pane, the matrix's VEX column
and Compare's VEX figures); open interest by listed date (the ledger's read line); "since the open" and the flip each
minute before this terminal's first read of the day's book (UW gives the book by strike as it stands, never for an
earlier minute); for an index (SPX, NDX, RUT …) everything that stands on bars — UW has no day state and no bars for an
index on this plan (422): its price is the price its book was figured at, its change "—", its range record, crossings,
replay and pair "—". A part that has not come yet leaves its page on its skeleton.

**Calls.** Asked on demand: an engine reading a name asks for the parts it reads; a part nobody asked for in a minute
is not asked again; a hidden tab asks nothing; at most three calls in flight from here; a 429 waited out 15 s and every
part keeps its last good answer. The sessions before today (bars by date, the books at the open and at the last three
closes) are asked only by the reads that need them (the range's record, the levels' record, the overnight change, the
pair). Periods: the book 30 s (one read shared with the shell's field recorder and Terrain), the day state 15 s, today's
bars 30 s, volume, prints, by date and the book a minute 60 s, open interest, implied vol, term structure and max pain
10 min, a past day once. A board of twelve names fills in about a minute.

**Terrain** reads `src/data/feed/levels.ts` directly, a pane at a time:

| Page | Reads | What it draws |
|---|---|---|
| Terrain, a pane | the book or one listed date (the expiry card lists UW's dates); open interest; the implied move; the bars; the name's prints, dark pool and report | every control the house's pane carries — see "Terrain: the house's pane, filled" below |

**Terrain: the house's pane, filled (2026-10-12 — the owner: "but i build the UI that the real data goes into").** With
the keys in, a pane draws the same toolbar, timeframes, Overlays menu, candle menu, bar clock, compares, alerts menu,
ladder (its lanes, Vol switch, How sure, the open's ghost) and expiry card as with them out; only the figures change.
What each reads on the feed (`pages/terrain/Terrain.tsx`, `data/feed/levels.ts`):

| Control | Reads |
|---|---|
| 1m–1h | UW's one-minute bars (`/ohlc/1m`, 2,500 — four sessions with the extended hours, the newest 30 every 15 s) over Massive's minutes for the five weeks before (`/v2/aggs/…/1/minute`, one call a name, kept 30 min) — a minute UW answered keeps UW's bar |
| 1D, 1W | UW's day bars (`/ohlc/1d`, the regular-session row of each date, about a year, every 5 min) over Massive's two years of day bars (asked once while Massive is up); a bar a New York date at noon UTC; 1W folds them Monday to Friday |
| 15 s | **held** — no plan carries seconds; the button stays, disabled, its title saying so (a pane kept on 15 s draws 1m) |
| Range and volume bars | the same rule as the house (`data/altBars.ts`) folding the one-minute bars — a minute is the cut's grain, as a quarter is on the house's seconds |
| Exposure trails, walls through the day | today's minutes MODELED point in time (`data/feed/trailField.ts` — see "Terrain's field, modeled point in time" below); the walls' charm lens scales today's charm by each minute's share of the strike's gamma, the house's rule, off the newest book |
| The events lane's macro dates | UW's economic calendar (`/api/market/economic-calendar`, `news.ts econMacro`): the high-impact releases, one mark a New York date, the day's releases with their times and figures in the detail — the calendar carries the weeks round today only |
| Key levels | the book's walls, flip and supreme |
| Dark pool | the name's three largest off-exchange crosses of the session, $1M and up (`/darkpool/{t}`) |
| Flow, Net drift, the events lane's prints | the name's prints of $25K and up (`/option-trades?ticker_symbol=`, walked back to the open once, then the newest every 20 s — data/feed/trace.ts `useFeedNamePrints`), through the house's `bucketFlow` and `cumulativeDrift` |
| Vol drift, Expected move | realised off the bars; implied off UW's 30-day implied vol (`/interpolated-iv`) |
| Events | the name's next report off UW's record (`/earnings/{t}`: the slot, whether the company set the date, the move the options price in, the mean of the last eight next-session moves — "—" where the record has none), the house's macro calendar (calendar facts), the session's largest prints |
| Session levels, Session phases, Volume | off the bars |
| Alert lines, the Alerts menu | the house's alert store, as the house's pane passes it (the alert engine is the shell's) |
| Compares | each crossed name's UW minutes (and day bars on 1D/1W); its legend prints its own last bar, "—" for an index |
| The ladder's Vol switch | the session's volume by price folded off the minute bars (`sessionVolumeProfile`) |
| The open's ghost and the card's "Since open" | the first book this terminal read after 09:30 New York against the newest (`feedOpenRatio`, the house's rule) — "—" in place when none was read after the open |
| The trend strip | the house's `buildConfluence` on the minutes |

The walls through the day stand where the terminal read a book: UW's `/spot-exposures` carries the whole book's gamma a
minute, never the strikes, so it cannot fill the strike × time cells before the first read, and nothing is drawn there.
Calls stay few: day bars, history and the report are asked only while a pane draws them (1D/1W; the Events, Dark pool,
Flow and Net drift switches).

Checked 2026-10-12 after the close (17:40–18:20 ET): the keys-in server against the keys-blanked one, 1 to 4 panes on
SPY, SPX, NVDA and QQQ, both themes, every pane's menus opened (timeframes, Overlays, the candle menu, indicators,
alerts, the expiry card, the ladder's switches) — the same items in the same order, but for 15 s held, the trail's
line ("Trail from …") and the index's bars line; the expiry calendar's enabled days are UW's listed dates; no console
errors. Screenshots: `docs/data-feed/terrain-filled-2026-10-12-*.png`.

**Terrain's field, modeled point in time (2026-10-13).** No route on either plan gives the book by strike for a time of
day (`/spot-exposures/strike` takes a `date`; a past date is that day's close), and UW's own strikes in one answer can be
hours apart. So the field is MODELED for every minute of today — estimated dealer gamma under an assumed sign — from what
was knowable at that minute, after the research (`reports/Dealer exposure reconstruction.md` §5 and §8). One module holds
the model, `src/data/feed/trailField.ts` (`TRAIL_MODEL`, its version on every column):

| Input | Source | Knowable from |
|---|---|---|
| The universe and open interest | `/api/stock/{t}/option-contracts?max_dte=60&exclude_zero_oi_chains=true` (500 a page; `open_interest` is today's count — the positions at the session before's close) | the day's first read; static all day |
| Each contract's vol | the same reads' `implied_volatility` (the vol of its last trade, `last_tape_time`), read by the server every ten minutes through the session | the moment the server received the read |
| The vol before the first read | `/api/stock/{t}/option-chains?date=<session before>&greeks=true` (sorted by expiry; read to 60 days out) — carried, fixed-strike | that session's close |
| The price | UW's 1-minute bars, each bar's close | the bar's end |
| The measured reference | `/spot-exposures/strike` once a minute (each strike's own `time` and `price` kept) and `/spot-exposures` (the whole book a minute) | as received — never blended into the field |

**The positions, from their publication (model trail-2026-10-13.5; the owner, 2026-10-13: "a column's open
interest must switch to today's count based on when UW publishes it, not when our server happened to read it").**
Every column from 07:00 New York stands on the day's published count — UW's count dated today, the positions at the
session before's close — carried by any chain read received at or after 07:00, WHATEVER the hour it was received (a
server that came up at 09:51 still gives the 09:30 column the day's count; the first such read is `oiTodayFrom`, and
a late one moves every column from 07:00). A column before 07:00 stands on the prior count: the seed's
(`/option-chains?date=<the session before>`, whose count is dated that session, the fourth element of a seed row;
a seed written without it is read again) or a chain read received before 07:00. A count read before the publication
never reaches a column after it. 07:00 is a fixed conservative time (UW's count lands about 06:45 — measured
2026-10-13: the 00:27 read equalled the seed on 3,094 of 3,094 contracts both held, the 09:51 read changed 2,186);
the recorder reads the chain every ten minutes from 04:00 and notes the day's switch — the first read whose count
differs from the one before it on more than a quarter of the contracts — in `oi.json` (`oiSwitch` in the field's
answer), so the publication time is measured from the days it runs from 04:00 and `OI_PUBLISH_NY_MIN` can be set
from them. So a live day and one rebuilt from history stand on the same positions, and at the minutes of the live
chain reads on the same vols: `scripts/trail-field-proof.ts` sections 10 and 12 (the second models one session from a
live recording whose first read came at 09:51 and from the dated count with the minutes' vols, and finds the same
cells).

The pricer is `core/greeks.ts` `blackScholesGreeks` on the clock and carry UW solved its vols under, measured 2026-10-13
(`research-2026-10-13/uw-vol-convention.md`): European, r 4.15%, no dividend; today's expiry on calendar time to its
last-trading instant (16:00 New York, 13:00 on a half day), a later one on whole calendar days ÷ 365, held all session —
priced so, a contract's gamma at UW's vol is UW's own (median ≤ 0.03% through 60 days). The chain's vol is the contract's
last print's; its `last_tape_time` after the close is a batch stamp, so a vol stamped after 16:15 is kept as "from a print
at or before 16:15" (`staleBound`). A leg is OI × greek × price² (UW's per-1% units — summed over UW's own per-contract gamma it reproduces
`/spot-exposures/strike` to the dollar, checked 2026-10-12); the house's sign. A vol read in its expiry's last hour is not
used (UW figures far strikes at 500% and more after the close). A contract with no vol stays out and its strike's
coverage drops; a strike with none is a gap. No magnitude is rescaled to UW: the residual is one line in the ladder's
"How sure", measured LIKE FOR LIKE (the Terrain audit of 2026-10-13, row 41) against UW's book on the model's own
universe — `/spot-exposures/expiry-strike` for the chain's expiries within 60 days, summed per strike within 15% of the
price, read every five minutes by the recorder (`books60.jsonl`; `levels.ts` FeedBook60) — over the strikes both hold:
strike by strike (the gap summed, against the book's size, the median over the books read today) and summed (the sign,
and the model's sum over the book's at the median). UW's whole-book series (`/spot-exposures`, every expiry and every
strike) and its per-strike book (`/spot-exposures/strike`, every expiry) are a different universe: the audit's "same
sign 13% of the time at −1.99×" was the model's 60 days against UW's whole book, not a sign flip (UW's series equals the
sum of its per-strike book, −0.730 B both in UW's sign on 2026-10-13; the house negates both). Those two are kept and
shown (the hover's "every expiry" line; `total.json`), never measured against. On SPY, 2026-10-13, 10:40 New York: see
`docs/terrain-audit-2026-10-13/README.md`, Step 4.
Each cell keeps `prov` (`modeled` when half its gamma or more stands on today's vols, `carried` otherwise), `staleSince`
and `coverage`, and since the audit `freshAt` (the newest vol in use) and `staleShare` (the share of the strike's gamma on a
vol older than an hour) — the hover card says "vols as traded to 10:38 am · 3.1% of the strike's gamma on a vol older than
an hour (oldest 7:17 am)", never "stale since" the least informative contract; beside it UW's own figure for the strike,
named by its universe ("Unusual Whales' book (60 days), 10:35 am" when a 60-day book was read within ten minutes, else
"(every expiry)"). The bead scale runs forward, per session, on a square root (each column's beads
are √(size ÷ the 85th percentile of the column peaks at or before it in its own session), stated in Terrain's legend). The sessions before today are drawn, rebuilt by the server on the same model (below).

**The sessions before today (server/fieldBackfill.ts, 2026-10-13).** UW answers no book by strike for a past minute, but
for a past date it answers every input the model takes, so a past session is modeled as today is:

| Input | Route | Note |
|---|---|---|
| The positions | `/stock/{t}/option-chains?date=D&greeks=true` | open interest dated D (the session before's close), within 60 days and 15% of the open |
| The vols at the open | the same, dated the session before | carried, as today's seed |
| The vols through the session | `/option-contract/{id}/intraday?date=D` | per contract, per minute, UW's `iv_low`–`iv_high` of its prints; the middle is the minute's vol, knowable at the minute's end, kept when it moved 0.001; only contracts that traded (the dated chain's `volume`) within 35 strikes of the session's range |
| The range | `/stock/{t}/ohlc/1m?date=D` | the regular minutes; the field is priced on the chart's own minutes |
| The validation series | `/stock/{t}/spot-exposures?date=D` | UW's whole book a minute |

A SPY session is about 1,700 calls (1,741 contracts asked for 2026-10-12, none refused) and three minutes, two calls in
flight so the pages keep a slot of the gate; it is written once, `.feed-cache/field/<NAME>/<D>/past.json.gz` (about
200 KB), and never asked again. More than 2% of a session's calls refused and it is not written (tried again in half an
hour). `GET /feed/field/<NAME>/past?days=D1,D2…` asks (the weekdays before today, thirty at most) and answers
`{ ready, working, queued, failed }`; `GET /feed/field/<NAME>/day/<D>` serves a built one. Terrain asks for the newest
ten sessions its minutes hold and draws each one's regular session; the trail chip says "earlier sessions N of M in"
while they come. How far back (measured 2026-10-13, Basic): the per-contract minutes from about 2025-04-01; the dated
chains, minute bars and whole-book series about two years. A session before the minutes is modeled on the session
before's close vols alone, every cell `carried`. `scripts/field-backfill-proof.ts` runs in `npm test`.

**The recorder's home (2026-10-13 — the owner: "The recorder must run on an always-on machine, not in a container
that restarts. Today only 98 minutes were recorded, and missed live minutes can't be recovered. Tell me where it will
run and how it restarts itself").** It runs as its own process, `npm run feed:recorder` (server/recorderMain.ts): the
same proxy and recorder as the dev server's, no Vite, on RECORDER_PORT (5190), recording RECORD_NAMES (.env; SPY,
QQQ, IWM by default) from the moment it starts and never letting them go, the keys read from .env itself. It exits on
an error it cannot handle, and the supervisor round it starts it again. **It runs independently of the app and the dev
server (confirmed 2026-10-14):** the dev server reads the field's routes from the recorder at `http://127.0.0.1:5190`
by default (FEED_RECORDER_URL blank; `off` makes the dev server record on its own) and records nothing itself while one
answers there — the recorder holds the lock all along, so a restart of the app or the dev server cuts no session; a
port that refuses (no recorder on the machine) falls back to the dev server's own recorder and is not asked again for
half a minute. The supervisor:

- **On the owner's Windows machine** (where the terminal runs): `scripts\recorder.cmd` is a loop — it starts the
  recorder, and ten seconds after the recorder stops for any reason starts it again, logging to
  `.feed-cache\recorder.log`. Register the loop once with Task Scheduler so it runs at startup, logged on or not:
  `schtasks /Create /TN "Slayer recorder" /TR "C:\path\to\3abida\scripts\recorder.cmd" /SC ONSTART /RU "%USERNAME%"`,
  then in Task Scheduler's properties tick "Run whether user is logged on or not" and, under Settings, "If the task
  fails, restart every 1 minute". A reboot starts the loop; the loop restarts the recorder; the files are append-only
  and are read back on each start, so nothing recorded is lost. The machine must stay on and awake through 04:00–16:15
  New York (Power & sleep: never sleep on mains power).
- **On a Linux box that is always on** (a small VPS): `scripts/recorder.service`, a systemd unit with
  `Restart=always`, `RestartSec=10`, started at boot — `systemctl enable --now slayer-recorder`.

The dev server then reads THAT recorder: with `FEED_RECORDER_URL=http://127.0.0.1:5190` in .env, every `/feed/field/*`
route is answered by it (server/feed.ts `fieldUpstream`), so the tabs and the always-on process agree and a dev server
that comes and goes records nothing on its own. Without it, the dev server records as before. A day with holes is
still a day with holes: a minute nobody recorded is not recovered — the backfill rebuilds a PAST session from UW's
dated history (below), which is the same model on the same positions but the vols as traded, minute by minute.

**The field's recorder (server/fieldRecorder.ts).** Mounted by the proxy: `GET /feed/field/<NAME>?since=<ms>` watches the
name (six at most; two idle hours let it go) and answers what was received after `since` — the books, the chain reads,
the seed, UW's whole-book series. Through the session (09:30–16:00 New York, a weekday) it reads, through the proxy's
own client, cache and UW gate (three at once): each name's book and whole-book series once a minute, its chain every ten
minutes from 04:00 to 16:00 New York (and once on first watch, whatever the hour), its 60-day book (`/spot-exposures/expiry-strike`, the chain's
expiries within 60 days, the strikes within 15%, two to five pages) every five minutes and once on first watch, the
session before's close chain once a day. Append-only files in
`.feed-cache/field/<NAME>/<YYYY-MM-DD>/` (`books.jsonl`, `books60.jsonl`, `chain.jsonl`, `seed.json`, `total.json`; git-ignored; the days
before are kept, gzipped in place, never deleted — an unrecorded or discarded minute is lost for good). The shell's `FieldRecorder` and each Terrain pane ask it every 15 s (a local call). Measured on SPY,
2026-10-12 after the close: a first watch costs about 4 s and ~21 UW calls (one book, the series, nine chain pages, ten
seed pages); the first answer is ~460 KB, a `since` answer a few hundred bytes; modeling 755 minutes costs ~320 ms of
main-thread work in 8 ms slices.

The fallback was checked with the keys blanked (`env UW_API_TOKEN= MASSIVE_API_KEY= node node_modules/vite/bin/vite.js`
— an empty variable in the process wins over `.env` in `loadEnv`; `npx` drops empty variables, so call Vite directly):
every Pinpoint page, Terrain and Pulse drew the same boxes as the commit before this wiring, and no console errors.
Pinpoint's rewiring was checked the same way, keys in against keys blanked: a structural diff of every page's heads,
tabs, buttons, menus, facts, charts and boxes (a control labelled by a figure counts as a row of the data) — the same
on all seven pages, SPY and SPX, dark and light.

Screenshots on the vendor's answers, 2026-10-12 around 14:15 New York: `docs/data-feed/levels-2026-10-12-*.png` (the Map,
Building, Ahead and Terrain dark; At the wall and Terrain light; the Map on a phone).

## The point-in-time store and the backfill (2026-10-13)

The owner's plan ("TERRAIN — NEXT BUILDS", item 1) with the decisions taken after the data was read:

- **The D−1 split.** Open interest is the day's count from 7:00 am New York (`option-chains?date=D` carries the count
  published the morning of D — the count after D−1's close) and D−1's before it. Books, greeks and vols are D−1 in
  replay and backfill: `spot-exposures/strike?date=D` is D's 4:00 pm state (127 of 127 strikes within 1% of the
  recorder's 4:15 pm capture), `greek-exposure/strike?date=D` follows the day and ends at its close, a dated chain's
  vols are D's close (the seed for D+1). "Use D−1, never D" for OI would have made every column a day stale.
- **Two rows a minute** (server/fieldStore.ts, `.feed-cache/field/<NAME>/<day>/shown.jsonl` and `final.jsonl`,
  append-only, gzipped in place as the day turns). A SHOWN row is the column Terrain drew: written by the recorder
  from the inputs it had received by the minute's end, through the model Terrain runs (data/feed/trailModel.ts —
  the pure part of trailField.ts, split out so the server and the browser share one code path), within three minutes
  of its minute or not at all (a minute missed is a gap, never filled in). A FINAL row is the rebuild path's column
  (server/fieldBackfill.ts `today()`: the dated chain's count, the session before's close vols, each traded
  contract's minute vols asked again when its volume grew), written at each chain read for the regular minutes that
  ended a minute before the inputs were asked, and once more after the close. A row holds spot, the flip, the walls,
  the five heaviest strikes, the net (the regime — every strike summed, NOT the flip's side: the two agreed in 46% of
  330 live columns), the bead scale's reference (data/feed/beadScale.ts, the renderer's own count), every strike
  drawn, the share carried, the at-the-money straddles for the expiry settling today and the weekly (the NBBO mids
  in a chain read's minute, the model's price between — `src` says which) and the data's age. The scorecard (item 2)
  reads final rows only. Served by `GET /feed/field/<NAME>/store?day=&kind=&since=`.
- **Live against rebuilt is a tolerance, not an identity** (measured 2026-10-13 on 250 SPY columns): live holds a
  contract's last print vol between ten-minute reads, the rebuild takes each minute's midpoint — never identical; at
  a read 0.3% median and 2.0% p90, between reads 0.7% and 3.8%, where the recorder had gaps 1.8% and 12.6%; walls
  equal in 240 of 250, the flip in 250 of 250. `npm run field:agree -- SPY <day>` judges shown against final to the
  owner's tolerance (median ≤ 1%, p90 ≤ 5%, walls and flip equal in ≥ 95% of columns) on a gap-free day, and with
  `--rebuild` checks the final rows against the session's full rebuild to the cell (the same code path, so exact).
  scripts/field-store-proof.ts runs the recorder, the store and the rebuild on a fake vendor and clock (`npm test`).
- **The recorder keeps more** (server/fieldRecorder.ts): each chain row carries `nbbo_bid`, `nbbo_ask` and the
  day's volume; the whole-book series carries UW's `_vol` and `_dir` beside `_oi` (populated from 9:30 am for SPY,
  SPX and QQQ — item 3's attribution check is possible on Basic, SPX included); the day's minute bars are read each
  minute (the shown rows' spot).
- **The backfill job** (`npm run feed:backfill -- SPY,QQQ 2025-04-01`, or `BACKFILL_FROM=2025-04-01` on the
  always-on recorder, server/recorderMain.ts): every session from the date to the session before today, oldest
  first, a session built skipped, a day without a session noted once (`none.json`) and never asked again. Measured:
  a SPY session is about 1,650 calls in 81 s at two in flight; SPX's dated chain is three times SPY's. A session's
  vols are named (`PastDay.vols`: 'minute' from about 2025-04-01, 'tape' before it once the tape backfill lands,
  'close' where neither answers) and the coverage line in Terrain's How sure says what is built ("Earlier sessions
  rebuilt from the vendor's dated history: Sep 29 to Oct 12, 10 sessions"; `GET /feed/field/<NAME>/coverage`).
- **How far the plan reaches** (probed 2026-10-13): dated chains, books, 1-minute bars and the whole-book series
  answer back to at least 2024-09-04; the tape archive (`/option-trades/full-tape/{date}`, a 302 to a signed link
  that lives 120 s; 0.7 to 1.9 GB a day) from 2024-01-03, refused for 2023-10-02; per-contract minute vols from
  2025-04 (empty on 2025-03-04, full on 2025-04-02) — about 386 sessions; the expiry-strike book from 2025-01-16.
- **The tape** (one day streamed, 9.2 M prints, nothing written to disk): every print carries `implied_volatility`,
  `underlying_price`, `nbbo_bid`/`nbbo_ask` and `canceled`. SPY's last print's underlying each minute equals the
  1-minute bar's close (median 0.000, p90 0.005, max 0.09 over 390 minutes). SPX's and SPXW's underlying price is the
  index level with cents, in every regular minute, SPX and SPXW agreeing to 0.03 at the median; UW's own SPX series
  price is rounded to 5 points. The minute's midpoint of print vols equals the per-contract `intraday` midpoint to
  0.00001, so a tape-built session uses the one definition the minute-vol path uses.
- **SPX** has no price on this plan (stock-state, ohlc/1m and ohlc/1d answer 422, Massive 403), so it is out of
  items 2 and 4 until a price source exists; the tape's per-minute underlying is the candidate.
- **The tape backfill** (server/tapeBackfill.ts, wired behind the job for every day before `TAPE_UNTIL`, 2025-04-01):
  a day's archive is asked for its signed link (`client.redirectOf`, never cached, the key never in the answer) and
  streamed once for every name still to build — the zip's local header skipped, the deflate stream inflated as it
  comes, each line parsed (the tags field is quoted and holds commas), nothing written to disk. Per contract and
  minute the lowest and highest print vol, in `/intraday`'s own shape, so `compressTicks` (one function for both
  paths) gives the minute's midpoint exactly as it does for a minute-vol session; a canceled print is dropped. The
  session built from it says `vols: 'tape'` and the coverage line counts it as "tape vols". Per index (SPX with
  SPXW's prints, NDX with NDXP's …) the underlying price a minute — first, highest, lowest, last, how many prints —
  is kept as `.feed-cache/field/<INDEX>/<day>/tape-price.json`: the one per-minute index level on this plan. A 429
  on the archive's link (it has a tight limit of its own — met on 2026-10-13 after a handful of probes) leaves the
  day for the next run. scripts/field-backfill-proof.ts streams a zip from a local server through the reader.
  Checked on 2026-10-12 against the minute-vol rebuild of the same day: 1.5 GB streamed in 60 s, 9.2 M prints, SPY
  built from the tape in 71 s on 27 calls (the minute path: 1,655 calls); at the kept minutes both hold, the vols
  differ by 0.00002 at the median and 0.00005 at most; over the 390 columns the cells differ by 0.03% at the median
  and 0.18% at the 90th percentile, the walls agree in 389 of 390 and the flip in 390 of 390.

## One recorder a machine (2026-10-13)

Today's shown file held 29 minutes written twice, 10 to 30 seconds apart. Vite re-reads its config when a server
file changes and builds a new feed middleware in the same process, and the old recorder's minute timer kept running
beside the new one's. The standalone recorder beside a dev server without FEED_RECORDER_URL would do the same. Three
guards now: the middleware stops its recorder when its server closes and when a newer one is built in the process
(server/feed.ts `close`, vite.config.ts); the recorder holding `.feed-cache/field/recorder.lock` records and any
other reads the files and serves them (a lock not refreshed in three minutes, or whose process is gone, is taken;
the standalone recorder lets go on SIGINT and SIGTERM); and the store reads a file again before writing when
another writer has grown it. A minute already written twice reads as its first row, the one shown first. Proved in
field-store-proof: two recorders on one folder write each minute once, and the second records on once the first
stops.

## The track record (2026-10-13, the owner's item 2)

The levels and the regime scored against baselines, on the store's FINAL rows alone (a rebuilt session's rows are the
same code's, server/fieldStore.ts `rowsOf`): data/feed/trackRecord.ts is the pure engine, server/scorecard.ts the
nightly job (after 4:05 pm New York on the always-on recorder, `npm run field:scorecard -- SPY` by hand), served by
`GET /feed/field/<NAME>/scorecard` and printed in Terrain's How sure ("Track record") and in the hover card when the
cursor is on the column's call wall, put wall or one of its three heaviest strikes.

- **A level counts only once it has stood a minute** (the row before the bar), **a touch** is a bar whose low–high
  reaches within `tol` (0.02% of price; 0.01% and 0.05% declared variants) of it, counted once per approach and
  numbered within the session; **a bounce** at 15 and 30 minutes is the close on the side price came from; **MFE and
  MAE** over 5, 15 and 30 minutes in points. Each touch carries the level's age, sign and size, the regime tercile
  (the net over the trailing 60 sessions' rows, point in time), the time bucket and the touch number.
- **Baselines on the same days, by the same rules**: B1 random (twenty levels above and twenty below the open,
  uniform within the prior month's largest open-to-high or open-to-low distance, seeded — Osler), B2 strike-matched
  (FIXED AT THE OPEN since 2026-10-14, below: for each real level of the open's column, the listed strikes in the same
  distance band from the open's price — within a step of the level's distance, either side — whose |gamma| is under
  that column's median, never a real level then, nor in a minute it is that minute's real level), B3 distance-matched (the mirror: the real level's
  distance from spot when it formed, on the other side, kept until the level changes). The real rate minus B2's
  carries a 95% interval from a day-block bootstrap (1,000 reps, seeded) and the months won as k of n with a
  two-sided binomial p. Median MFE and MAE beside.
- **Regime tests**: the realized range over the next 30 and 60 minutes by regime tercile, raw and over the straddle's
  implied move; the last half hour (Baltussen et al. 2021): the 3:30 to 4:00 return on the prior-close to 3:30
  return, by the regime's sign at 3:30, for the house's net and for UW's `_dir` series.
- **Multiple testing**: every parameter is in server/scorecard.config.json (`record-2026-10-14.1` — `.13.1` until B2
  was corrected, below); the variants
  tried (96: three tolerances, two horizons, ten splits, four level types, the tolerance variants on the whole
  alone) stand beside every line; the most recent six months are a hold-out evaluated ONCE per config version and
  kept in the file with the moment and the version — a run under a new version evaluates it again and says so.
  A cell under 500 touches or 12 months says "insufficient data (N touches, M months)" and carries no rate.
- **Acceptance** (scripts/track-record-proof.ts, `npm test`): on a synthetic random walk with arbitrary levels the
  real levels show no edge over the random and strike-matched baselines (the interval covers zero, thousands of
  touches a type); a level planted to turn the price back seven of every ten touches reads 71.8% on 156 touches
  and the engine finds 156 of the generator's 158; a rerun is byte-identical; twelve sessions say insufficient; a
  level that changes every minute never counts; a strike-matched level is a listed strike and never a real level.
- **On screen** (2026-10-13, SPY on 12 rebuilt sessions): every line reads "insufficient data", as it must until the
  backfill at home has run — the job scored 2 main sessions and a 10-session hold-out.

### The strike-matched baseline, corrected (2026-10-14)

Found while building the session recap (item 9), which prints the strike-matched counts beside the real touches: **B2
almost never had a touch.** It was re-picked every minute from that minute's column — the strike at the real level's
distance from the price, which is the level's own neighbour, and which changes as the price moves — so it seldom stood
the minute a touch needs. Over SPY's 12 sessions on this machine B2 had 9 touches with a 15-minute outcome against 293
real (call wall 0, put wall 0, flip 8, heaviest strikes 1); QQQ's 24 against 320. The owner's spec says "Baseline
levels use only information available at the open", so B2 is now **fixed at the open** (trackRecord
`strikeMatchedOf`): the open's column picks it, and it stands all session (a minute in which it is one of that minute's
real levels is not counted for it). The config is `record-2026-10-14.1`, so the hold-out was evaluated again and says
so.

**What the data said about it, plainly:** fixed at the open under the COLUMN's median, B2 was still thin near the
money, and that was the data, not the code. Within a few dollars of SPY's price every listed strike carries more than
the column's median |gamma| — gamma peaks at the money — so the only strikes under the median at a wall's distance were
ten to thirty dollars out, often on the far side of the price (SPY Oct 12: the open's B2 strikes sat at 773 for the
call wall at 785 and the put wall at 772, while the session ranged 777.05 to 779.40). Under that rule SPY's 12
sessions had 23 B2 touches (flip 21, heaviest strikes 2, either wall 0), QQQ's 57. A cell whose baseline has no touch
says "insufficient data (…, no strike-matched touch)" and prints no rate — a real rate with nothing beside it would be
the bare rate the owner ruled out.

**The owner's second rule (2026-10-14):** "strikes in the same distance band from price at the open whose |gamma| is
below the median |gamma| of that band (not the session median), held for the session, excluding the real level." Built
the same day (trackRecord `bandOf`, `strikeMatchedAtOpen`; config `record-2026-10-14.2` — `.3` since 2026-10-15, the
walls from the book — so the hold-out is evaluated again and says so): a level's band is the listed strikes within a step of the level's distance from the open's price,
either side, the open's real levels left out; the band's own median |gamma| is taken over those strikes, and the ones
under it are the baseline, standing all session (a minute in which one is a real level of that minute is not counted).
A band of one strike has nothing under its median. **The counts after it, this machine's 13 sessions** (the recount
is the recap's own `recapTouchesOf`, every touch, not only those with a 15-minute outcome):

| | Real touches | B2 touches | B2 strikes picked at the open |
|---|---|---|---|
| SPY call wall | 42 | **0** | 22 |
| SPY put wall | 47 | **0** | 20 |
| SPY flip | 56 | 68 | 19 |
| SPY heaviest strikes | 198 | 52 | 59 |
| QQQ call wall | 46 | 28 | 20 |
| QQQ put wall | 72 | 2 | 20 |
| QQQ flip | 45 | 64 | 18 |
| QQQ heaviest strikes | 204 | 93 | 62 |

So the flip and the heaviest strikes now have a baseline of their own size (SPY 120 B2 touches against 343 real, was
23; QQQ 187 against 367, was 57), and SPY's walls still have none: a wall touched here stood a few dollars from the
price (Oct 5's put wall at 767 under 770), and its band's strikes — the same distance on the other side, or a step
beyond — were not reached that session (Oct 5 ranged 769.65 to 776.61). That is the data on 13 sessions; the cell
says "no strike-matched touch" and prints no rate until the baseline has touches. The proof (track-record-proof)
checks that B2 comes from the open's column alone, that rewriting every column after the open leaves it as it was,
that multiplying every strike outside the bands fifty-fold (which moves the column's median) changes nothing, that
each B2 touch is one of the open's strikes and never the real level of its minute, and the empty-baseline line.

### SPX's price, checked (2026-10-13 — the owner: "per minute, compute SPX_tape / SPY_bar_close over 5 past sessions
and today. Pass if the ratio stays within ±0.02% of that day's median in ≥99% of regular minutes")

The tape's last SPX or SPXW print each regular minute against SPY's 1-minute bar close of the same minute, through
the production tape reader:

| Day | Minutes | Median ratio | Within ±0.02% | p99 \|dev\| | Max \|dev\| (minute) |
|---|---|---|---|---|---|
| 2026-10-06 | 390 of 390 | 10.03631 | 99.74% | 0.014% | 0.024% (9:30 am) |
| 2026-10-07 | 390 of 390 | 10.03581 | 99.74% | 0.014% | 0.021% (9:30 am) |
| 2026-10-08 | 390 of 390 | 10.03552 | 99.74% | 0.018% | 0.023% (12:57 pm) |
| 2026-10-09 | 390 of 390 | 10.03448 | 99.23% | 0.015% | 0.049% (11:02 am) |
| 2026-10-12 | 390 of 390 | 10.03442 | 100.00% | 0.014% | 0.019% (9:31 am) |
| 2026-10-13 | 390 of 390 | 10.03428 | 99.23% | 0.016% | 0.045% (2:05 pm) |

Every day passes; the worst minutes are the open's first and a few single minutes mid-day. So SPX enters items 2
and 4 on the tape path for its backfill, and live its price is the newest SPX or SPXW print's underlying price
from the flow endpoint (`/api/option-trades?ticker_symbol=SPX` answers SPXW's prints too), labelled with its print
time and shown stale once the newest print is older than two minutes. After the close the prints carry no
underlying price (`null`, seen at 4:50 pm), so the last priced print stands, stale.

**Built on the pass (the same day):**
- **Live** (src/data/feed/price.ts `loadIndexPrint`, `useFeedPrice` for a cash index): the newest print carrying an
  underlying price, asked every ten seconds; the rail and Terrain's pane head print the price with "3:59 pm print",
  and "· stale" in the warning ink once the print is older than two minutes (`data-subject-print`, `data-pane-print`).
  The alerts' watcher judges an index on the same price while a print within two minutes carries one, the book's
  price only otherwise. On a fresh load after the close no recent print carries a price, so the rail shows the
  book's price with no print label.
- **The recorder** (server/fieldRecorder.ts `readIndexBars`): an index's minute bars are its prints' underlying
  price — the newest five hundred prints read each minute, a bar's close the minute's newest print, high and low the
  prints seen — so the store's shown rows and the final rows (fieldBackfill `today().advance(bars)`) stand for SPX
  as they do for SPY. The index is recorded and scored with the rest (RECORD_NAMES may name it).
- **The backfill** (server/fieldBackfill.ts `build(name, day, tape)`): an index's day is built from the tape alone —
  its minutes the tape's per-print underlying (regular session), its vols the tape's, the dated chain's count — on
  every day, not only before 2025-04-01; the tape reader keeps the index's contracts (SPXW's under SPX) with its
  price series. The job routes an index through the tape whatever the day.
- **Proofs**: field-backfill-proof builds an index's day on the tape's prices and asks no bar of the vendor;
  field-store-proof records SPX from its prints and writes shown and final rows for it.

## The regime strip (2026-10-13, the owner's item 3)

A thin pane under the candles (StrikeChart, the "Regime strip" overlay, off by default): a bar's value is the
column's net at the bar's last minute — every strike summed, estimated dealer gamma on an assumed sign — the calls'
ink below zero, the puts' above, each bar's light the PERCENTILE of the same half-hour bucket (thirteen from 9:30 am)
over the trailing 250 sessions. The reference is built nightly with the scorecard (server/scorecard.ts →
`regime.json`, `GET /feed/field/<NAME>/regime`) from sessions BEFORE the day: the file holds the quantiles through
its newest session and a second set leaving that session out, and a page read on the newest session's own day takes
the second (trailModel `regimeBucketsFor`), so a session at or after the day never moves its light. The chip says
the sign, the percentile and the attribution: "attribution-robust" when the house's sign and UW's `_dir` series
(the recorder's whole-book rows, in the house's sign) agree at the newest minute, else "attribution-dependent"; past
the scorecard's gate (2,600 minutes in the tercile) it adds "next-60-min range in this tercile: X× median". The
flip keeps its name on the ladder — the net's sign is not the flip's side, and nothing says it is. Proved: the
buckets, the quantiles, the percentile, and the point-in-time rule (track-record-proof).

## The priced move (2026-10-13, the owner's item 4)

What the options priced for the session, drawn on Terrain's chart, and how often it held. The engine is pure
(src/data/feed/pricedMove.ts, the straddle's vol in trailModel `straddleVol` / `sigmaOf`); the server keeps the day's
budget and the calibration (server/pricedMove.ts, `GET /feed/field/<NAME>/move?day=<D>`); the chart draws it
(StrikeChart `pricedMove`, expectedMovePrimitive `drawPriced`) when the Cone overlay or the trails are on.

- **The day's budget, fixed at the prior close, D−1 prices only.** The prior close is the official close (UW's daily
  bar for the regular session, asked by D−1's own date; an index: the last regular minute of its tape prices). The
  straddle is the at-the-money one on the expiry settling D (and the weekly), priced AT 4:00 PM on D−1 — the
  recorder's last chain read 3:45 to 4:00 pm (NBBO mids), else the two legs' traded price in their last minute to
  3:59 pm (UW's per-contract minutes), else the dated chain's NBBO. Its vol is solved at its strike on UW's clock and
  applied at the money: 1σ_day in dollars, straddle ÷ 0.798 when the close sits on a strike. ±1σ (solid) and ±2σ
  (dashed) stand from the prior close all session, labelled "+1σ 781.71 · priced at the prior close". Kept as
  `move.json` in the day's folder, about five calls a day.
- **The remaining move** is the live straddle on today's expiry — the NBBO mids at a chain read, the model's price
  between, labelled "(quotes)" or "(model)" — t to the close, read off the store's shown rows (`str0`); it goes to 0
  at 4:00 pm. It is never mixed with the day's budget in one number.
- **The cone** from the last candle to 4:00 pm spreads the remaining variance over the minutes left by a time-of-day
  profile — the mean squared 1-minute return a minute of the session over the trailing 60 sessions before D,
  rescaled to the total — in three washes (50%, 68%, 95%), never one hard edge. The chart keeps room on the right
  for it (`rightOffset` to the close's bar, at most a third of the view).
- **The readout**: the move since the prior close in σ_day, the share of the day's variance the profile says has
  passed, the pace (|σ used| ÷ that share) and, while the session runs, the remaining 1σ — in the form "+0.6σ · 41% of
  the day's variance used · pace 1.5× · left to the close ±1.92 (quotes)". It stands at the cone's head where the cone has room,
  otherwise ending at the last bar over (or under) the candles it spans, on the pane's ground — never at the right
  edge, where the pinned strike chips stand. After the close the lines end at the 4:00 pm bar and the readout measures
  the session to its OFFICIAL close (UW's daily bar, `close.json`, served with the budget), never the 3:59 pm bar or
  the evening's last trade; a move that rounds to nothing reads "0.0σ". The official close is read from 4:01 pm New
  York and kept from 4:30 pm (2026-10-14, for the 4:05 pm recap: it waited for 21:00 UTC, 5:00 pm in daylight time,
  so the 4:05 pm calibration stood on the 3:59 pm bar); a read before 4:30 pm is asked again rather than kept.
- **The calibration** (How sure, "Expected move · calibration"; written nightly with the scorecard as
  `move-calibration.json`, every close the session's official one): the close inside ±1σ and ±2σ of the prior close's budget and of the 10:00 am straddle
  (against the 10:00 spot), the touch of ±1σ and ±2σ (bar highs and lows), the median |close − prior close| ÷ σ,
  each beside theory (68.3% / 95.4%; a touch about twice the finish outside, 63.5% / 9.1%; 0.67), and the plan's
  sanity check: Wednesdays' close inside ±1σ of the 10:00 am straddle beside a published study of 193 Wednesday
  sessions (FlashAlpha, July 2022 to April 2026: 71.0%, the same measure), judged against 60–80% from 30 sessions.
  Under 60 sessions every line says "provisional".

**What the data said while it was built:**
- **UW's implied move is 85% of the straddle.** `/volatility/term-structure`'s `implied_move` ÷ (S·σ·√(dte/365)) is
  0.679 to 0.682 across six names and every expiry: 0.85 × 0.798. So the cross-check (logged, never shown) sets our
  4:00 pm straddle against `implied_move ÷ 0.85`.
- **The dated chain's quotes are not 4:00 pm's.** `option-chains?date=D` carries NBBO stamped to about 5:30 pm, after
  the close (Oct 12: 4.02 against 4.14 at the recorder's 3:55 pm read and UW's 4.12). Read on those, 10 of 13 days
  were within 5% of UW, all on one side. On the 4:00 pm order above, 13 of 13 SPY sessions are within 5%, median gap
  0.4%, the largest −4.3% (Oct 1) and +3.4% (Oct 9):

| Day | Prior close | Straddle (strike) | σ_day | UW ÷ 0.85 | Gap |
|---|---|---|---|---|---|
| 2025-04-02 | 560.97 | 6.76 (561) | 8.47 | 6.81 | −0.9% |
| 2025-04-03 | 564.52 | 8.67 (565) | 10.86 | 8.68 | −0.1% |
| 2026-09-29 | 765.61 | 4.20 (766) | 5.25 | 4.21 | −0.2% |
| 2026-09-30 | 764.20 | 4.46 (764) | 5.58 | 4.43 | +0.7% |
| 2026-10-01 | 762.63 | 4.62 (763) | 5.78 | 4.83 | −4.3% |
| 2026-10-02 | 763.99 | 5.16 (764) | 6.47 | 5.15 | +0.2% |
| 2026-10-05 | 769.64 | 4.13 (770) | 5.17 | 4.08 | +1.3% |
| 2026-10-06 | 774.83 | 3.41 (775) | 4.27 | 3.40 | +0.4% |
| 2026-10-07 | 779.09 | 3.18 (779) | 3.98 | 3.16 | +0.6% |
| 2026-10-08 | 777.22 | 3.39 (777) | 4.24 | 3.40 | −0.3% |
| 2026-10-09 | 773.93 | 3.73 (774) | 4.67 | 3.61 | +3.4% |
| 2026-10-12 | 778.57 | 3.19 (779) | 3.99 | 3.20 | −0.3% |
| 2026-10-13 | 778.10 | 2.88 (778) | 3.61 | 2.89 | −0.3% |

  Every one priced off the legs' 3:59 pm trades (the recorder here was not reading at 3:45 to 4:00 pm on those days).
- **SPX**: the budget builds off its tape prices and SPXW's straddle (Oct 12: close 7,810.43, 31.34 at 7,810, σ
  39.16; Oct 13: 7,808.16, 27.35, σ 34.26), but UW's SPX term structure lists the AM-settled expiries alone with no
  `implied_move`, so an index has no cross-check; and Terrain's SPX pane draws no candles yet, so it draws no σ lines.
- **The calibration on 13 SPY sessions (provisional)**: close inside ±1σ / ±2σ of the prior close's budget 85% / 92%;
  of the 10:00 am straddle 67% / 83% on 12; touched 54% / 8%; the median ratio 0.47 against 0.67; Wednesdays 1 of 3.
  Too few sessions to read anything into — the backfill at home fills it.
- **Two faults found in the browser check, fixed before the push**: the candle series holds only the recent window of
  the bars (StrikeChart `windowOf`), so a bar's place in the array is not its place on the time scale — the session's
  first bar mapped 2,900 bars past the right edge and the σ lines drew nothing while their labels did; both cones now
  ask the scale (`scaleIndex`, `timeToIndex`). And UW's daily bars asked with three rows for a date often lead with the
  NEXT session's three (Oct 12 asked answered Oct 13's alone), so the close is asked with twelve; every calibration
  close now equals the next session's official prior close (13 of 13).
- **Shots**: docs/next-builds-2026-10-13/priced-move-dark.png and priced-move-light.png (SPY, 5m, after the close).
- **Departures, stated**: σ is the straddle's solved vol applied at the money rather than the raw mid ÷ 0.798, so the
  remaining move reaches 0 at the close whatever the strike grid (acceptance (i), proved) and equals mid ÷ 0.798 on a
  strike; the 4:00 pm straddle comes from the recorder's read or the 3:59 pm trades because the dated chain's
  quotes are later than 4:00 pm. Proved by scripts/priced-move-proof.ts (`npm test`): the remaining move at the close,
  the budget asking no call that names D, the 4:00 pm order, the profile, the cone, the readout's words, and the
  calibration of 20,000 simulated driftless days landing on theory.

## The bead scale, its legend and disclosure (2026-10-14, the owner's item 5)

What a bead's brightness means, printed where it is read, and the marks that say how much to trust it.

- **The reference counts minutes.** Each minute's peak |value| goes into its session's log-binned count
  (data/feed/beadScale.ts `minuteRefs` — the renderer's `baseFrom` and the store's rows run the same count), and a
  column wider than a minute (the 5-minute texture) stands against the reference as of its last minute. Before this
  the renderer counted its own columns, so a 5-minute chart's reference was a p85 of 5-minute peaks while the store's
  was of minutes.
- **(a) The legend**, a row under Heaviest that stays in view while the field draws, prints the renderer's own hand-off
  (`legend()`: the newest column's reference, the number its beads were drawn against; StrikeChart hands it to Terrain
  after every change, and in development the renderer checks its newest column against it): "Full brightness = $2.1B
  gamma per 1% (session p85 of per-minute peaks, as of 4:58 pm)" over "Net per strike · clipped above full · ring
  above p95, $2.2B" (the full sentence in its title). On the delta field the unit is delta.
- **(b) The basis**, the pane's choice beside the legend: **Session so far** (the default; its title: brightness at
  10:00 am and 3:00 pm is not comparable), **Fixed** (the p85 of every minute's peak over the 60 sessions before the
  day, frozen for it — server/scaleRef.ts builds `scale.json` nightly with the scorecard and on first ask, from each
  finished session's per-minute peaks kept as `scale-bins.json`; where the server has none, the sessions the page
  holds, the count said) and **Prior session** (the session before's p85). A basis with nothing to stand on falls back
  to the session so far and says so. On SPY, Oct 13: session $2.1B, fixed $3.7B over 12 sessions, prior (Oct 12) $2.2B.
- **(c) The ring**: a hairline round a bead above the basis's p95 — clipped at full with the rest of the top step, and
  told apart. The bins are a 32nd of a decade, so the p95 is a bin's upper edge.
- **(d) Ten steps a side** (`stepOf`, each drawn at its top, so the top step is full brightness): one Path2D an ink,
  step, staleness and dimming, filled once; hairline beads at one strike and step in touching columns merge into one
  rect (they overlap by design, so the pixels are the same).
- **(e) The floor**, off by default (Off, 5%, 10%, 25% of the reference — never of the largest bead): every strike above
  zero draws until the reader sets one.
- **(f) The pair**: the field's ember (amplifies) and glacier (absorbs) ramps, lightness rising with the step on black
  and falling on paper. Checked (scripts/bead-scale-proof.ts): every step's drawn ink over the ground is lighter on
  black and darker on paper than the step below it, both sides, all three staleness steps; and the two sides stay apart
  from the third step up under protanopia, deuteranopia and tritanopia (Machado 2009, severity 1): smallest OKLab
  distance 0.084, 0.074 and 0.114 (0.02 is just noticeable). The shot docs/next-builds-2026-10-13/
  scale-dark-greyscale.png is the dark page in greyscale.
- **(g) Staleness in the mark**: 0 a cell on today's vols; 1 a modeled cell with half or more of its gamma on vols older
  than an hour; 2 a carried cell (mostly the session before's close vol). Core and halo at 1, 0.8 and 0.6 of their
  alpha, the stale steps filled with a dotted pattern of their ink (two device pixels on and one off; one on, one off),
  so a hairline reads as a dotted line, and a swelling bead also outlined dotted. Never desaturated.
- **(h) The axis** (Terrain): the book's call wall, put wall and flip — whatever the Key levels switch says — then the
  supreme and the field's heaviest strike now, pinned on the price axis as their prices in the axis's own format on
  their inks (bull, bear, flip, supreme, the side's), never a name (the house keeps names off the axis); a level beyond
  the clear area stands at its edge with ▲ or ▼, and the library moves overlapping labels apart.
- **(i) How sure**: the residual is "Model agreement with Unusual Whales (both naive-sign estimates)", with "How close
  two estimates on the same assumed side come — not accuracy against real dealer positions, which neither can see."

**Acceptance:**
- (i) The legend equals the reference the renderer used: proved column by column on a 1-minute and a 5-minute texture
  (every column drawn against its last minute's reference, the legend the newest column's), and asserted in
  development at every draw.
- (ii) Greyscale keeps the order: proved on the drawn inks and alphas (above), and the greyscale shot.
- (iii) Replay equals live: on the recorder's session on this machine, 20 random minutes, 1,200 beads, the step
  recomputed as of each minute equals the step drawn live — 0 differ. The comparison reads Oct 13's capture only up to
  3:52 pm ET (11 minutes): from there two recorders in one dev server wrote the same minutes twice (fixed by the
  one-recorder lock, above), and the live count held those minutes twice — 23 of the later references differ for that
  reason alone.
- (iv) Frame time at full zoom-out, a browser harness drawing 60 strikes × 390 minutes and nudging the zoom every frame
  so the field rebuilds each time (headless Chromium, three alternating runs each): on the real SPY session of Oct 12,
  the old renderer 8.4–9.1 ms a frame at the median (p95 11.5–14.1), the new 7.9–8.3 ms (p95 10.5–11.8) — no worse,
  with 613 rects against 2,388. On a field that changes step at every strike every minute (random noise, unlike any
  session) the merge has nothing to merge: 28–30 ms against 18–19. Before the merge and the dotted fill, a dashed
  outline round every stale bead cost 8 ms a frame and dots drawn as squares 25,000 extra rects.

## The expiry windows (2026-10-14, the owner's item 6)

**0DTE · To Friday · To monthly OPEX · All 60 days**, at the foot of Terrain's Expiry card on the feed (the house rule:
every expiry choice is the calendar card; the trigger names the window). "All 60 days" is the default — the field's
every expiry within 60 days, the ladder Unusual Whales' book on every expiry, as before.

- **One pass prices every window.** The model already prices each contract a minute; it now also sums each strike by
  the contract's expiry PARTITION against the session's day (trailModel `partOf`): 0 the day itself, 1 to the Friday of
  its week (a holiday Friday's Thursday expiry is inside it), 2 to the monthly OPEX (the third Friday on or after the
  day), 3 the rest of the 60 days. Every column carries those sums (`GexSnapshot.parts`, five quantities × four
  partitions a strike: gamma, delta, the gamma priced, priced on today's vols, on a vol older than an hour, as 32-bit
  floats), and a window is their running sum (`windowView`, cached per column) — so the field, each column's flip and
  walls, the bead scale's reference (its own p85 per window), the regime strip and the residual all follow the window,
  and a switch computes nothing new and asks nothing. A window view leaves out the vols' newest and oldest trade times
  (they are the strike's over every expiry); its provenance and stale share are the window's own.
- **The ladder through the window**: the recorder's five-minute read of UW's 60-day book (`/spot-exposures/
  expiry-strike`) now keeps each strike's call and put gamma by the same partitions (`parts` on books60.jsonl — the
  same call, nothing more asked), and a window's ladder is the newest read's sums to the window (`book60Window`): the
  walls, flip and supreme on the axis, the Heaviest row and How sure follow it. A day whose reads predate the partitions
  takes one read at the recorder's next tick; until a read carries them the ladder shows every expiry and How sure says
  so. Only gamma is in that book, so the ladder's other lanes print "—" in a window.
- **The regime strip** reads the window's own reference (`regime.json` `windows`, nightly, from the rows' `netP` — the
  net by partition every store row now carries); UW's directional series and the scorecard's ranges stand on every
  expiry, so a window's chip names neither. Until the nightly job has rows with partitions the chip says "no reference
  yet".
- **How sure's header** wears "repriced every minute · all windows", and a window adds what the field and the ladder
  read in it ("To Friday: … the ladder reads Unusual Whales' 60-day book through the same window (4 expiries, figured
  1:14 pm)").

**Acceptance** (scripts/expiry-window-proof.ts, `npm test`, and the browser):
- (i) The partition: on a synthetic day with contracts in every partition, the four parts sum to the whole per strike
  per minute — worst relative gap 3.3e-8 for gamma and delta (the parts are 32-bit floats).
- (iii) Each window's view equals the column modeled on that window's contracts alone (an independent run): 44 cells a
  window, the same strikes and provenance, worst gap ≤ 5.6e-8. The store's final rows equal the rebuild in every window
  (their `netP`, field-store-proof).
- (ii) Zero network on a switch: with the page's feed calls cut off after load (every `/feed/` request aborted), each
  switch still changed the field's reference ($2.1B all, $1.8B to Friday, $1.2B 0DTE) and the ladder's Heaviest row
  (778 −$2.0B · 785 −$1.7B · 780 −$1.5B on all; 778 −$1.9B · 779 −$1.4B · 780 −$546M on 0DTE); the only calls attempted
  in those seconds were the page's standing polls (the field every 15 s, the minutes, the price), none new. On Oct 13
  To Friday and To monthly OPEX are the same window: Friday Oct 16 is October's third Friday.
- The recorder's first read with partitions (after hours, Oct 13): 16 expiries, 187 strikes, every strike's partitions
  summing to its row.
- Shots: docs/next-builds-2026-10-13/window-to-friday.png, window-0dte.png, window-howsure.png.
- Seen while checking: the strip's one bar far below the rest is 3:59 pm New York (net −19.4B in the store's row) —
  the day's own expiry with a minute left, where at-the-money gamma blows up; the model's behaviour at the close, not a
  fault. And the ladder's head ran past the pane's edge at a 504 px panel ("How to read" clipped — before this change
  too, out of sight): ProfilePanel now measures the head's first row and, while it overflows, the door drops its words,
  then How sure becomes its icon (measured at 1280, 1600 and 1920 wide, one pane and two: the row's content equals its
  width).

## Tiered level alerts (2026-10-14, the owner's item 7 — the in-app tiers; web push held)

A name's WATCH follows levels by their identity — the flip, the call wall, the put wall, the three heaviest strikes,
the ±1σ and ±2σ levels — set on Terrain's chart by a right-click within a few pixels of the level ("Alert on this level
(follows it)", components/terrain/LevelAlertMenu.tsx; anywhere else the chart's own card opens as before) and listed
in the alerts drawer's **Levels** shelf, where a level is let go and the flip's confirmation minutes (1, 2 or 3) are
set. The engine is pure (data/levelAlerts.ts `LevelAlertEngine`) and steps a minute at a time; the shell's watcher
(components/alerts/LevelAlertWatcher.tsx) feeds it on every page from what the alerts' watcher already reads (the
book's walls, flip and heaviest strikes, the minutes, the price — the same shared calls), the day's ±σ off the priced
move, and, for the alert's line, the regime's percentile (the recorder's newest shown row against regime.json) and the
level type's track record.

- **Tier 1** (the chime, the voice when Settings' switch is on, and the machine's own notification while the tab is
  hidden, under a tag stable per level — "SPY-callwall", "SPY-putwall" — so a repeat replaces the last): a touch of a
  wall that has stood 15 minutes — **a wall touch alone** since the owner's second rule of 2026-10-14 ("Tier 1 = wall
  touches only").
- **Tier 2** (a chip in the notices' column): **a flip cross** — N minutes in a row closed beyond the flip, **3 by
  default** (1 to 5, the reader's pick in the drawer's Levels shelf or the chart's right-click; a watch that never
  picked follows the default). It was Tier 1 at one closed minute until 2026-10-14, when the replay below showed the
  flip as the loudest trigger by far and the owner moved it: "make a flip cross Tier 2 with 3 closed-minute
  confirmation (default)". Also a wall moving two strikes or more (once the new strike has held three minutes — the
  field's wall-chip rule — and the watch follows it), and a touch of ±1σ or ±2σ.
- **Tier 3** (the log alone): a strike entering the three heaviest and holding three minutes — **the log since the
  owner's third rule of 2026-10-14** ("Tier 2 is too noisy: 371 in 10 sessions (up to 109/day), 178 of them 'new
  top-3 strike'. Move 'new top-3' to Tier 3 (log only). Keep wall moves and flip crosses at Tier 2") — and a wall
  moving under two strikes.
- **Cooldown**: a level fires at most once a minute, and again only after price, in a later minute, has moved half a
  strike step away from where it stood. **The cap is global**: three Tier-1 alerts in 15 minutes across every name; a
  fourth drops to Tier 2, said "capped". **Stale**: inputs older than two minutes at the trigger drop Tier 1 to Tier 2,
  said "stale". A touch is the minute's range within 0.02% of price (the track record's tolerance).
- **The payload**: the level, its price, the price then, the time, the data's age, the regime's percentile and the
  level type's track-record line — in the drawer's row and its title.
- **The bell** counts what was not looked at: Tier 1 in the red square with the alerts that fired, Tier 2 in silver
  beside it ("Alerts, 2 new (level alerts: 1 tier 1, 1 tier 2)"); opening the drawer marks them seen.
- **How sure** lists today's level alerts with their +15 and +30 minute outcomes on the track record's rules (a touch
  held when the close is back on the side it came from, a cross when it stays beyond; a wall's move or a new heavy
  strike, the move since).
- **Replay** (item 8) steps the same engine on the minutes to its cursor into its own log
  (`noteLevelEvents(…, 'replay')`, slayer_level_alert_replay_log), never the live one.
- Kept on this machine: slayer_level_watch, slayer_level_alert_log (100 a name, 400 in all), slayer_level_alert_seen.

**Acceptance** (scripts/level-alerts-proof.ts, `npm test`): the rules on built minutes (the cross a Tier-2 notice
after N closed minutes, three by default; a whipsaw inside the re-arm distance noticed once; a forming minute confirming
nothing; the 15-minute wall the one Tier-1 alert; the identity followed; the stale guard and the global cap on a wall
touch, a flip cross never rung, capped or said stale; the outcomes), and on the 10 rebuilt sessions with the most flip
crossings on this machine (the second run, 2026-10-14, after the owner's rule — SPY Apr 2 2025 with 88 down to AAPL
Oct 5 with 10; the first run's ten, before AAPL's sessions were rebuilt, ran down to SPY Oct 2 with 2):
- (i) 379 alerts; at most 3 Tier-1 alerts in any 15 minutes; no two alerts with one tag inside one cooldown.
- (ii) every Tier-1 alert replayed after a three-minute gap dropped to Tier 2, said stale: 3 of 3.
- (iii) every alert with half an hour of its session after it joined its +15 and +30 outcomes: 321 of 321.

**The ten sessions by tier** (the owner, 2026-10-14: "Re-run the 10-session replay and report alerts per session by
tier", twice — after the flip moved to Tier 2, and again after the new heavy strike moved to Tier 3; flip crosses at
the default three closed minutes, Tier 1 a wall touch alone; "crossings" is the raw count of minutes the price changed
sides of the flip, before any confirmation):

| Session | Crossings | Alerts | Tier 1 (wall touches) | Tier 2 | of which flip crosses · wall moves | Tier 3 | of which new top-3 · wall re-keys |
|---|---|---|---|---|---|---|---|
| SPY Apr 2 2025 | 88 | 104 | 5 | 57 | 30 · 27 | 42 | 42 · 0 |
| QQQ Apr 2 2025 | 69 | 109 | 0 | 51 | 19 · 32 | 58 | 58 · 0 |
| QQQ Oct 1 2026 | 31 | 31 | 0 | 18 | 5 · 13 | 13 | 13 · 0 |
| QQQ Sep 29 2026 | 30 | 26 | 0 | 12 | 5 · 7 | 14 | 14 · 0 |
| AAPL Sep 29 2026 | 25 | 11 | 1 | 6 | 6 · 0 | 4 | 3 · 1 |
| SPY Oct 13 2026 | 23 | 29 | 0 | 15 | 4 · 11 | 14 | 14 · 0 |
| SPY Oct 1 2026 | 20 | 29 | 0 | 3 | 3 · 0 | 26 | 26 · 0 |
| QQQ Oct 7 2026 | 13 | 12 | 0 | 9 | 4 · 5 | 3 | 3 · 0 |
| SPY Oct 12 2026 | 12 | 12 | 0 | 10 | 1 · 9 | 2 | 2 · 0 |
| AAPL Oct 5 2026 | 10 | 16 | 0 | 12 | 1 · 11 | 4 | 3 · 1 |
| **All ten** | 321 | 379 | 6 | 193 | 78 · 115 | 180 | 178 · 2 |

None capped, none stale: the cap and the stale guard act on Tier 1, which is now six wall touches in ten of the
busiest sessions. Before the heavy strikes moved down, Tier 2 held 371 of the 379 (up to 109 a session), 178 of them a
new heavy strike — the owner's reason: "Tier 2 is too noisy". Flip crosses on the same sessions by confirmation
minutes: 237 (23.7 a session) at one, 116 (11.6) at two, 78 (7.8) at three, the default. The first run (the earlier
ten, one closed minute, the flip at Tier 1) had rung 145 Tier-1 alerts and capped 83 more — nearly all of them flip
crosses; the replay is why the flip moved down.

**Shots** (the two events in them were written into the log by the check, to show the delivery):
docs/next-builds-2026-10-13/level-alert-card.png (the right-click on +1σ), level-alert-chips.png, level-alert-drawer.png.

## The replay (2026-10-14, the owner's item 8)

A Terrain pane's replay is a CURSOR — one minute of the tape, the start of the newest one-minute bar the frame holds,
knowable at its end — and the pane reads everything at it (components/terrain/useTerrainReplay.ts, data/replayFrame.ts).
`P` (or the toolbar's Replay) starts it; a bar picked on the chart, a session and a time (Go to), or a random start puts
the cursor down.

- **A frame is the live page on a tape cut at the cursor.** The chart takes the same kind of tape it draws live — the
  minutes, the field's columns, the day bars (the sessions before whole, the cursor's day folded from its minutes so far),
  the compares — cut at the cursor and grown in place as the cursor moves on (`GrowingCut`, so the chart's folds keep
  their work), and draws it through the code that draws it live, with a rewound clock (StrikeChart `asOf`: its "now" for
  the regime's day and the priced move, no bar countdown, no calendar markers, no alert lines). The bead reference, the
  regime strip, the walls through the day and the open's ghost read only the cut. The levels, the ladder and the axis
  labels are the field's column at the cursor by the store's own summary (`frameAt` — what a shown row records); the
  ladder draws its net per strike (the model keeps the net: no put and call legs); a minute the field has no column for
  draws no level ("—"), never the price.
- **The priced move at the cursor**: the cursor's day's budget and profile (/feed/field/<NAME>/move?day=, asked once a
  session) and the 1σ left to the close off the straddle at the cursor's minute — the store's one rule
  (trailModel `straddleOfMinute`: the NBBO mids of a chain read inside the minute, else the model's price; a rebuilt
  session by the model alone). Never its calibration or its official close: both are known only after the moment.
- **Left out of a replay**: the track record and the move's calibration (they stand on sessions after the cursor), the
  regime's attribution chip and scorecard ranges, the dark-pool lines and the prints' band, the right-click alert (a live
  watch); How sure says so, names the moment, and says how the session is drawn.
- **The sessions**: today's from the recorder's reads as they came; a session before today that the recorder KEPT WHOLE
  — its seed with counts and chain reads from the open's first ten minutes to the close's last 25, no gap over 25
  minutes (`recordingComplete`; GET /feed/field/<NAME>/recorded/<D>) — as the recorder showed it live (the field's replay
  twin, trailField `useFeedTrailField(…, recorded)`); every other session from the rebuild, as the live chart draws it.
  On the house's market, its tape and field as they stood when the replay began (its sessions keep their own hours).
- **The transport** at the foot of the price pane (ReplayStrip, the house's bar): play and pause; a bar on or back — to
  the end of the bar the cursor stands in, on the chart's own timeframe (`stepCursor`); 1×, 5×, 20× and 60× the
  market's own time (1× a minute of tape a minute, 60× a minute a second), the words saying it in the chart's candles;
  the track over the session's regular hours; **Go to** — a session the tape holds and a time typed on the reader's own
  clock ("10:42 am", "1042"; without am or pm the reading inside the session — `minuteFromText`; never a 24-hour time
  printed); **a random start** — a session the replay can draw whole and a time in it with half an hour left
  (`readinessOf`, `randomStart`); **hide the future** — on by default; off, the rest of the session stands faded right
  of the cursor (StrikeChart `futureBars`, out of the price scale's fit, read by nothing). A jump lands the reader on
  the cursor with the price scale following the candles again. **Keys** (TradingView's): Shift ↓ plays and pauses,
  Shift → steps a bar; Esc ends the replay (the top layer). The badge in the pane's head: "Replay · Oct 13 · 10:42 am",
  never shed at any width.
- **The ghost dots** (the ladder's spine, item 8's "each strike's value 10, 30 and 60 min before"): a filled dot 10
  minutes before, a fainter 30, a ring 60, on the spine's own scale (ProfilePanel `lagged`, the key says so) — in a
  replay off the field's columns at the cursor; live off the books the ladder itself reads (Unusual Whales' book read
  every minute, its 60-day book through a window every five; the house's own minutes), never a column beside a book; a
  listed date has no history of its book, so no dots.
- **The level alerts** watched on the name are judged on each minute the cursor moves on by one, on the frame's levels
  and the cursor's knowable instant, into the replay's own log (item 7's clause); a jump starts the engine again.

**Acceptance** (scripts/replay-cursor-proof.ts, `npm test`):
- (i) **Zero reads past the cursor.** Every frame of a whole session, each read through a guard stamped with the
  moment the thing read became knowable — every bar, every column, each column's own observations (the model's probe,
  trailModel `setPitProbe`: each vol, count of open interest and chain read it priced on), the frame, the ghost dots,
  the day bars, the straddle under the priced move: a synthetic session (390 frames, chain reads every ten minutes from
  04:00, the count published at 07:00) 899,106 reads, 0 past the cursor; QQQ's rebuilt Oct 12 (390 frames) 384,246
  reads, 0. Three planted look-aheads are caught (a cut a minute long, a column priced on observations twenty minutes
  on; a day bar of the cursor's own day is not one — it is folded from the minutes).
- (ii) **The replay frame equals the live frame** on the recorder's own sessions (shown.jsonl — what Terrain drew live):
  the column priced the way the page prices it from the recorder's own reads, at random minutes, against the shown row
  of the minute — every cell, the walls, the flip, the five heaviest strikes, the net, the price, the straddle under the
  priced move and the bead reference's step: all equal. **On this machine 11 minutes of 1 session** (SPY Oct 13, read to
  3:52 pm New York, where two recorders wrote the same minutes before the lock) — fewer than the 20 asked, because no
  more clean recorder minutes exist here; on the always-on recorder's days it runs 20 a session.
- (iii) **The random start never lands on a session with an input missing**: 10,000 draws over sessions missing one
  minute's bar, one minute's column, the priced move, or still open — none landed on one; every ready session was
  reached (a half day among them); every start leaves half an hour to play.

**Seen in the browser** (Los Angeles, SPY on the feed): the pick, a step (1:09 → 1:10 pm), 60× for 4.2 s (four
minutes), Go to 7:00 am, a random start (Oct 1, Oct 2, Oct 8), the future faded, How sure in a replay, Esc back to live;
an hour of Oct 13 at 60× wrote seven events to the replay log (a Tier-1 flip cross, Tier-2 top-3 and wall-move notices)
and none to the live log. Its call wall at the cursor flapped 780 → 785 → 780 → 785 within 30 minutes — the modeled
field's own walls, written as they moved. Shots: docs/next-builds-2026-10-13/replay-*.png.

## The session recap (2026-10-14, the owner's item 9)

"At 4:05 p.m. ET, generate flip crossings, wall moves, alerts fired with +15/+30 min outcomes, close vs ±1 and ±2
sigma, max sigma used, the regime path, and a chart image via takeScreenshot({ addTopLayer: true }) … Post it to the
Journal room. Data: snapshot store, alert log. Acceptance: the recap's numbers equal the item-2 and item-4 rows for that
session." Built from what the track record and the priced move already read, through their own functions — the recap
is pure (src/data/feed/sessionRecap.ts), the server builds and keeps it (server/recap.ts), the shell posts it
(components/review/RecapWatcher.tsx) and the Journal's day shows it (components/review/SessionRecap.tsx).

- **When**: a session is over at 4:05 pm New York on its day. The always-on recorder builds every recorded name's recap
  at 4:05 pm, ahead of the scorecard (which can take a while over two years of sessions), and again at 5:05 pm, once the
  official close is kept; a dev server builds one on its first ask. Kept as `.feed-cache/field/<NAME>/<D>/recap.json`
  and built again when something it read changed (the store's final rows grown, the session rebuilt, the close kept,
  the config) — a version a figure, so the Journal's entry moves only when a figure did. `GET /feed/field/<NAME>/recap?
  day=<D>` (`&field=1` adds the rows' columns and the day's budget for the picture), `GET /feed/field/recaps?days=<N>`
  (the recorded names' sessions — a name the recorder wrote rows for; a name Terrain only opened has rebuilt sessions
  and no recap).
- **The rows**: the scorecard's own loader (server/scorecard.ts `loadSession`, shared): the store's final rows where
  the recorder wrote 90% of the session, else the session rebuilt; neither, and the recap says why and still carries
  the close.
- **Flip crossings**: each minute's close against the column's flip that minute, against the side the last close stood
  on, the side carried over a minute with no flip — the level alerts' rule at one confirmation minute, every crossing,
  no cooldown. **Wall moves**: the field's chips' rule, one function for both (trailModel `wallMovesOf`, a new strike
  held three minutes), each in strikes of its column's grid.
- **Levels touched**: the track record's own rows for the session (trackRecord `touchesOf` at the scorecard's
  tolerance — `sessionTouches` is what the record counts) — each real level's touches with their +15 and +30 minutes,
  every field but the tercile, and the strike-matched levels' counts the same session beside them; counts, never a
  rate ("One session is not a record").
- **The close against ±σ, and max σ used**: the priced move's row for the day (server/pricedMove.ts `calibrationDay`,
  the calibration's own) through its verdict (pricedMove `dayVerdict`, which `calibrate` now counts): the close in σ,
  inside ±1σ and ±2σ, touched ±1σ and ±2σ, the farthest the session went in σ and the minute it did, and from 10:00 am
  against the straddle then; the official close, or the 3:59 pm minute's while it was not in (said so, and posted
  again when it is).
- **The regime path**: the net at each half-hour's last minute and its percentile against the same half-hour over the
  sessions before (regimeBucketsFor — the quantiles kept in the recap, since the reference moves past the day), and the
  minutes its sign turned. Estimated dealer gamma on an assumed sign, never the flip's side.
- **The alerts** (the browser's — the logs are on the machine): every level alert of the session (data/levelAlerts.ts,
  not a replay's) with its +15 and +30 minutes by `outcomesOf` on the recap's own bars — held or through, the points —
  and the house's alerts read off the feed's figures with the move since; a horizon past the session is said so.
- **The picture**: the house's chart drawn off-screen (1280 × 720, five-minute bars) on the session's minutes and its
  rows' columns as the field, the priced move's ±1σ held in view with its lines and readout, the regime strip, the
  wall chips, then `takeScreenshot(true, false)` — lightweight-charts 5.2's positional form of
  `takeScreenshot({ addTopLayer: true })`, the top layer and its primitives in, no crosshair — laid on the panel's
  ground (the chart is frameless; a picture with no ground reads wrong on any other). The levels handed to it name no
  wall, so a wall twenty strikes off never widens the axis. Kept in IndexedDB (`slayer_recaps`), the figures in
  `slayer_journal_recaps` (the newest sixty sessions); taken again only when what it draws changed.
- **Posted**: the paper Journal's day opens with "The session" under it (a tab a name), the month marks the day with
  the candles glyph, and a quiet chip in the notices' column says "SPY's session recap is in the Journal" (a press
  opens the day). The first look on a machine posts the newest session alone; after that every session since, so a
  Friday the terminal was shut through is posted on Monday's first look.

**Acceptance** (scripts/session-recap-proof.ts, `npm test`): on thirty built sessions the recap's touches ARE the
track record's rows for each session (610 rows) and its strike-matched counts the baseline's own; the wall moves the
chips' one for one; the calibration counts the days' verdicts; the version keys. **On this machine, through the
server's own build on a copy of each session's files (no vendor asked): SPY 13 of 13 and QQQ 12 of 12 recaps' touches
equal the scorecard's rows for the session, and 13 of 13 and 12 of 12 closes equal move-calibration.json's row for the
day.** The times: no recap at 4:04 pm, one at 4:05 pm; the official close read at 4:10 pm and not kept, kept at 4:40
pm; a session's minute bars handed back at 2:00 pm and not kept (a scorecard run by hand mid-session kept the morning's
for good before), kept at 4:10 pm.

**What the sessions here say** (SPY, the last twelve rebuilt plus Oct 13 from its close alone): the close inside ±1σ on
11 of 13 (Apr 3, 2025 at −2.56σ and Oct 5 at +1.00σ outside); ±1σ touched on 7 of 13; flip crossings from 0 to 88 a
session (Apr 2, 2025: 88; Oct 12: 12, whipsaws round 777.37 in the afternoon); Oct 13 has no level rows here (the store
holds 10 of its 390 minutes as final rows and it is not rebuilt yet). Seen in the browser (Los Angeles, dark): both
posted in 4.1 s with their pictures, the chips, the month's marks, the day's card, no errors. Shots:
docs/next-builds-2026-10-13/recap-*.png.

## The charm-to-close drift (2026-10-14, the owner's item 10)

"Per minute, the projected change in aggregate dealer delta (naive sign) from t to 3:50 p.m. ET (avoids the expiry
discontinuity) at constant spot and IV, for the selected window, as $ delta notional. Data: existing repricing.
Acceptance: equals model delta at (spot_t, IV_t, 3:50 p.m.) minus model delta at t, by full repricing. On screen: one
number in How sure, labelled 'mechanical drift, unvalidated'."

- **The number** (data/feed/trailModel.ts `driftToClose`, on every modeled column as `drift` by expiry partition;
  `driftOf` sums a window): the dealers' delta in dollars of the underlying — open interest × 100 × delta × price, the
  field's delta sign (each contract's delta turned over, as the delta lens and `feedStrike` on the vendor's book) —
  priced again at the drift's end minus at the minute, the minute's price and each contract's vol knowable at its end
  held, by the model's own pricer and clock. **The end is 3:50 pm New York**, ten minutes before the day's expiry
  (`driftEndOf`; ten minutes before 1:00 pm on a half day); from then on a column carries none.
- **What the clock does to it**: the model prices on Unusual Whales' clock — today's expiry on the time left, a later
  one on whole calendar days, the same all session (the convention its vols were solved on; measured 2026-10-13). So
  inside a session only today's expiry's delta moves, a later expiry's repricing returns the same delta, and every
  expiry window reads the same drift — said in How sure, not hidden. The model reprices today's contracts alone; the
  proof reprices every contract of every expiry and finds the same figure to the dollar.
- **On screen**: How sure, "Delta to 12:50 pm · mechanical drift, unvalidated" (the end on the reader's clock), one line
  — "−$180M of dealer delta by 12:50 pm at 778.65, the vols as traded by 7:01 am" — and what it holds; live off the
  newest column, in a replay off the column at the cursor (point in time). Past the end: "nothing left to drift"; no
  contract of the day in the field: said so.
- **Acceptance** (scripts/charm-drift-proof.ts, `npm test`): on a built universe (today's expiry, its Friday, the
  monthly, a later one; vols at the open, at 1:00 pm and one received at 3:55 pm) the column's drift equals every
  contract repriced independently at 3:50 pm minus at the minute, by partition, to the dollar (gap 0); a later expiry's
  partitions are exactly 0; every window reads the same and a window view carries it; none at 3:50 or 3:55 pm; a vol
  received after the minute changes nothing; the price is held, not moved; one out-of-the-money call melting toward
  zero delta turns the dealers' (turned-over) delta up. **On this machine's rebuilt sessions, 20 minutes, every column's
  drift equals the independent full repricing (gap 0)** — SPY Oct 12: −$0.18B at 10:00 am New York, +$0.09B at noon,
  +$0.14B at 2:00 pm, +$0.03B at 3:30 pm; QQQ Oct 9 at 2:00 pm −$0.36B.
- **Seen in the browser** (Los Angeles): live after the close "Past 12:50 pm on Oct 13: nothing left to drift."; a
  replay of SPY Oct 12 at 7:00 am (10:00 New York) "−$180M of dealer delta by 12:50 pm at 778.65". Shot:
  docs/next-builds-2026-10-13/drift-howsure-replay.png.
- **Why it earns no more space** (the owner's own words): charm-type hedge decay is part of the documented pinning
  mechanism (Golez-Jackwerth 2012), but no study measures index charm flows, and Cboe puts all 0DTE hedging at
  0.04–0.17% of S&P futures liquidity — it earns more only through the track record.

## The map's marks, the store's format 2 and the series job (2026-10-14, the owner's section B)

**One solid mark per strike per candle** (gexNodesPrimitive.ts): the field's ribbon — translucent haloed ellipses, a
bead per field minute even on a wider bar — read as soft slivers and is gone. A mark is a rect on the device-pixel
grid, the bar's slot less a hairline wide; its height the strike's gross gamma (|calls| + |puts|, `GexLevel.gross`)
√-scaled against the size reference (the session's p85 of per-minute peak gross, the same running count as the
net's — the primitive keeps both, `refG` beside `ref`); its hue the net's side (ember puts, glacier calls); its colour
strength |net| ÷ gross, grey when balanced (`markInk`, ten steps); a soft one-pixel edge for a stale or carried cell
and nothing else. No identity ink on a mark: the axis chips and the wall-move chips name the walls and the supreme. A
strike entering the three heaviest by size wears a hollow ring on that bar, one leaving them a grey outline, a wall
move a two-pixel tick at the new strike. Every run of bars with no column says why on the chart (Terrain
`gapCause` → the primitive's `findGaps`): before the open / after the close (the book is read 9:30 to 4:00 New York),
a past session queued / being rebuilt / failed and why / beyond the ten the page asks, today's chain not read yet,
not recorded, or the live lag in minutes.

**Store format 2** (server/fieldStore.ts `STORE_FORMAT`): a row's cells are `[strike, net, gross]`, and the row carries
`maxG` (the column's largest gross) and `refG` (the size reference). Every reader takes the first two figures (the
track record, the recap, the agree check, the replay); rows of format 1 read as before, and the map sizes them by
|net| with the legend saying so. The model's version is unchanged: the figures are the same, a field is added.

**The series job** (server/seriesBackfill.ts, on the always-on recorder — SERIES_NAMES=SPY,QQQ,SPX, SERIES_DAYS=730,
`off` to stop it): thirty seconds after the recorder starts, and at 5:15 pm New York for the session just over, it
walks back over weekdays, newest first — from today's session once it is 5:00 pm New York (UW's rows for the date end
at 4:00 pm), else from the session before — and writes each day's
`/api/stock/{T}/spot-exposures?date=D` rows as answered — every field, the `_oi`, `_vol` and `_dir` gamma series, the
price, the other greeks' series — to `.feed-cache/field/<NAME>/<D>/series.json`. A day is held ONLY by this file
(2026-10-15: the recorder's `total.json` and a rebuilt day's `past.json.gz` keep the figures the trail reads, and
before 2026-10-13 only the `_oi` series — three figures a row on SPY's Oct 12, QQQ's Oct 12 and 13 and every rebuilt
day — so counting them as held skipped exactly the `_vol` and `_dir` the job is for); a day UW answers empty is
written empty and never asked again; a 429 waits a minute and asks again; a 5xx or the network is left for the next
pass; one call at a time with a pause, behind the recorder's reads. The recorder's log reports each name's walk
("series SPY: done to <date> — written N, empty N, skipped N, refused N, oldest with rows <date>"), and
`curl http://127.0.0.1:5190/feed/series` on that machine answers the job's standing and what is stored a name (sessions
with rows, empty dates, oldest, newest). A live walk from the workspace on 2026-10-15 (SPY and QQQ ten calendar days,
SPX six): 18 sessions written in 9.5 s, 14 fields a row, 493–557 rows a session from about 6:35 am to 4:00 pm New York.
scripts/series-backfill-proof.ts runs the rules against a stand-in client in `npm test`.

## The walls from the book (2026-10-15 — the owner: "no hold time fixes it, because the flip comes from the definition (the put wall must be below price). Choose walls from the book, not from price's side")

**The rule** (core/walls.ts `pickWalls`, everywhere a wall is named — Terrain, Pinpoint, Pulse, the Weigher, Compass's
drivers, the scorecard, the level alerts, the recap, the replay): the call wall is the heaviest calls-absorb strike in
the book's window (the heaviest negative net in the house's sign), the put wall the heaviest puts-amplify strike
(the heaviest positive net), wherever the price stands. A price crossing a wall no longer moves it: the wall stays and
its STATE says where the price is — `broken` once three closed minutes stand beyond it (a call wall closed over, a put
wall closed under), `reclaimed` once three stand back (trailModel `WallStick`, `wallStateOn`). The 10% / three-minute
rule stays for real size changes: a new strike becomes the wall only when it has been the raw pick AND beaten the held
wall's |gamma| by 10% in every observation of three closed minutes; a held wall whose strike leaves the window or turns
side is replaced by the raw pick once that has stood its three minutes (no 10% asked of it then). The stick starts afresh each New York day. The chip on Terrain's chart says a
state as it does a move ("PW 772 broken · 10:54 am", "PW 772 reclaimed · 10:57 am"); the axis chip carries the state
under its figures; the wall's card says "the heaviest … in the book's window, wherever the price stands".

**The owner's 358-minute count again** (SPY 2026-10-14, the final rows 9:30 am to 3:27 pm New York, 60 strikes a row):

| | put wall changes | call wall changes |
|---|---|---|
| the store's per-minute picks (the old rule, price's side) | 13 | 0 |
| the book's raw pick each minute, no hold | 15 | 0 |
| the book's pick held (10% in three closed minutes) | **0** | **0** |

The walls stood at 780 / 772 all session. The raw book pick still changes 15 times — 772 and 765 within 2–5% of each
other from 1:56 pm, a near-equal size swap the 10% rule holds back. The states: put wall 772 broken 10:54 am (price
771.98), reclaimed 10:57 (772.46), broken 11:06 (771.75), reclaimed 11:19 (772.08), broken 11:26 (771.73) and broken
from there to the last row. Five state chips in 32 minutes where the price chopped within 30 cents of the strike — the
rule as written; a wider band or a longer confirmation is section D's to register, not a change made here.

**On every session on this machine** (14 a name, 2025-04-02 to 2026-10-14, 5,414 minute steps): wall changes, call and
put together, 489 → 61 on SPY and 630 → 115 on QQQ (the old rule raw per minute against the new rule held). Touches at
the 15-minute horizon, real (B2, B3): SPY call wall 36 → 41 (5 → 5, 44 → 26), put wall 52 → 21 (0 → 0, 46 → 15); QQQ
call wall 41 → 52 (28 → 63, 63 → 46), put wall 74 → 64 (2 → 10, 58 → 73); the flip and the heaviest strikes are
unchanged. Every cell is under 500 touches and 12 months: insufficient data, no rate. The scorecard's config is
`record-2026-10-14.3`, so its hold-out was evaluated again and says so; the level alerts' wall touches and moves, the
recap's walls and the replay's frame all read the held book walls (scripts/orbs-proof.ts section 1, level-alerts-,
session-recap- and replay-cursor-proof).

## The Theta probe, Phase 0 (2026-10-14 — the owner's TASK: "Terrain history backfill for Slayer Terminal. Phase 0 = probes only. Report results, then STOP and wait for my 'go'")

`npm run theta:probe` (scripts/theta-probe/, `index.ts` the runner) is Phase 0 as ONE SCRIPT THE OWNER RUNS ON THE
ALWAYS-ON MACHINE against its own terminal — Theta allows one sign-in a key, so the script starts no terminal and this
container never ran one beside the owner's. It writes the report to `docs/theta-probe/<date_time>/report.md` (the
table: probe id, exact URL, HTTP status, error text, rows, bytes, seconds, first/last date found, one line of
conclusion; the notes; the short list — start dates per ticker and piece, the rate entitlement, chain-day sizing, the
clock mapping, T12's result; the log) and `results.json`, after every probe, so a run cut short keeps what came in.

- **The rules it keeps**: no terminal started (1); `http://127.0.0.1:25503/v3`, never localhost (2); six calls in
  flight through its own gate (3; T10's bursts of 8, 24 and 30 are the owner's test of the limit and go outside it);
  no date from the docs — the probes' own lists give the recent, the busiest and the 2013 days (4); no missing input
  filled: T12 prices under the house's UW convention and says so, SOFR reported beside T11 (5); it refuses to run
  between 12:00 and 1:45 am New York (6); `format=ndjson` on every data call, stamps read as New York wall time (7);
  the heavy probes — T7, T10, T11, T12 and X1 — are not run inside market hours (8). The UW key is read from .env
  for U1–U4, X2 and the tape and written nowhere; the report scrubs it.
- **The probes**: T1 entitlement (the terminal's startup lines from .theta/logs, MDDS status, second-order greeks, the
  stock and index flat files), T2 the rate series (SOFR 2023, TREASURY_M3 2012 — padded or not), T3/T4 SPY and QQQ
  trade and quote dates and 1m days (2017, 2019, 2020; QQQ 2012; nqb against utp_cta), T5 SPX's dates and minutes,
  T6 each root's earliest expiration and first quote date, the contracts of 2012-06-01 by root, SPXW on a 2019
  Tuesday, T7 four chain-days of 1m quotes streamed and measured (rows a contract, zero bid/ask, strike units, SPXW
  under SPX), T8 open interest (stamps, rows against contracts), T9 IV history on the owner's dates and `expiration=*`,
  T10 the bursts, a 1m range over a month, a multi-year EOD; T11 put-call parity fits (F against the underlying, the
  implied rate against SOFR); T12 the bead field from Theta's inputs on this machine's rebuilt sessions through the
  store's own `rowsOf`, under two stamp mappings, against the UW rebuild (median cell gap, p90, walls equal, flip
  within $0.25); U1 UW's limit headers, U2 the earliest tape date and the chains round it, U3 one tape day streamed
  (the SPX labels and their null underlying prices) and SPX's option_symbol prefixes, U4 the clock mapping on three
  SPY contracts (Theta's 1m quote row against its ticks round 10:00, UW's intraday minutes, Terrain's stored labels,
  an OHLC bar against its trades).
- **Items 4a and 4b ride in it**: X1 Theta's SPX index minutes against the tape's SPX underlying a minute on five
  past sessions (median and p99 gap, two alignments), X2 the real-time check inside the cash session (`PROBES=X2`:
  the snapshot's and the newest 1m row's lag against the wall clock, the price against UW's newest SPX print), X3
  the 10:00 am ATM straddle off Theta's 1m quotes beside the store's own on five sessions. The switch of the live SPX
  price to Theta (4a) and the 10:00 straddle off Theta's quotes (4b) are built only once X1/X2 and U4/T7 say how —
  nothing before the results.
- `PROBES=T1,T2` runs a few; `THETA_PROBE_OUT`, `THETA_PROBE_TAPES` (tape days X1 may download, 2) and
  `THETA_PROBE_BASE` are the knobs. Phase 1 (the ledger, the field from Theta, candles for every ticker, the nightly
  forward, the Terrain screen) is NOT built: it waits for the report and the owner's "go".

## The Theta history: the downloader and the rebuild (2026-10-14, the owner's section C)

The owner: "The 13 sessions in your workspace are not my data. My data is 14 years at Theta. Build it." Two scripts for
the always-on machine, neither run against Theta from the workspace (no terminal there; one terminal a key):

- **`npm run theta:history`** (scripts/theta-history; `scripts/theta-history.cmd` keeps it running under Task
  Scheduler). 127.0.0.1 only; it stops unless /terminal/mdds/status answers CONNECTED and never starts or signs into a
  terminal. A clock gate keeps 3 requests in flight in the recorder's hours (06:00–16:30 New York, weekdays — the
  7:00 am open-interest switch and the session's reads), 7 outside (Theta's eight is the whole account; one is left
  for the recorder's pre-market reads — the owner, 2026-10-15), none in Theta's gap (00:00–01:45); the environment's
  HISTORY_IN_SESSION_CONCURRENCY and HISTORY_CONCURRENCY can lower these, never raise them. Resumable per ticker per day
  (`<root>/<T>/manifest.json`; a file written to `.part` and renamed whole; a day held never asked again). Newest
  first, back to the first date each feed serves (the terminal's date lists). Raw rows only, gzipped NDJSON. Scope:
  daily and minute candles with volume for every ticker in the app (eod a year a call, ohlc a month a call split a file
  a day); SPY and QQQ minute NBBO; SPX, NDX, RUT and VIX a minute; the SPY, QQQ, SPX and SPXW chains a day — contracts,
  per-contract open interest and one-minute quotes an expiration at a time, the expirations within 60 calendar days
  and the strikes within ±15% of the day's range (HISTORY_WINDOW_DAYS, HISTORY_MONEYNESS); the rates (Theta's
  TREASURY_M3 where entitled, else FRED's DTB3 raw). `log.ndjson` keeps each feed's first served date and every
  empty (472), denied (471) or failed answer with its URL. After the first five sessions `report.md`: bytes and
  minutes a session per feed, the projection to each feed's first date, the free disk — PAUSED (exit 3) when the
  projection exceeds it (HISTORY_FORCE=1 goes on). The env is in .env.example (HISTORY_*).
- **`npm run theta:rebuild -- SPY QQQ SPX [--days N] [--again]`** (server/thetaRebuild.ts, scripts/theta-rebuild.ts).
  Newest first over the history's sessions, the SAME model as the live field (trailModel through the store's
  `rowsOf`): the day's open interest from `chain-oi` (SPXW under SPX), each contract's quote a minute inverted to a vol
  (`solveVol`) on the day's rate and the model's clock (`tauAt`), the underlying from the stock's bars or the index's
  series (or the tape's per-print price, `spxSource: 'tape'`), the seed from the session before, UW's `series.json` as
  the total where kept, the rate from RATES (r = −ln(1 − d·91/360) × 365/91; it rides on the PastDay and prices the
  day — `Universe.rate`, `rateOf`; UW's days keep 4.15%). Written beside the field, never over UW's final rows:
  `theta-final.jsonl`, `theta-extras.jsonl` (a minute's spread, top-of-book sizes, volume, VIX, ATM vol),
  `theta-build.json`; `finalRowsOf` serves UW's rows first, else these. THE TRUST GATE: where `shown.jsonl` exists the
  rebuilt day is judged to the store's tolerance (server/agree.ts) into `<NAME>/theta-trust.json`; a FAIL stops the
  name's walk (exit 3) — older days are not trusted until it is understood. The probe's choices (4b `quoteClock`, 4a
  `spxSource`, the rate) are `THETA_REBUILD`; set them from the probe's report and bump the version.
- Proofs in `npm test`: scripts/theta-history-proof.ts (13, a stub terminal) and scripts/theta-rebuild-proof.ts (24, a
  synthetic history priced by the model's own pricer). The report: docs/terrain-build-2026-10-14/README.md, section C.

## The Backtest reads real days (2026-10-12)

`ROOM_FEEDS.backtest` (`needs: ['massive']`) is `wired: true`: with Massive up, Practice › Backtest offers a **Days** card —
**Real sessions** or **The house's tape** — and a real session replays the market's own record, start to end. With
Massive down the card is not there and the page is what it was; a real session saved earlier waits, saying why
(`components/review/RealDayDoor.tsx`), and never falls back on the house's tape. One market a session is
`src/data/review/market.ts` (`marketOf`); the record's market is `realTape.ts`; the calls are `src/data/feed/backtest.ts`.

| What | Call | When |
| --- | --- | --- |
| The picker's days | `massiveBars(name, 1, 'day', two years back, yesterday)` — one a name | the Days card on Real sessions |
| A session's minutes | `massiveBars(name, 1, 'minute', two sessions before, last day)` — one a name, every day it holds (about 1 MB for SPY's ten) | the desk opens |
| What was listed | `massiveContracts(name, { type: 'call', strike: a round strike near the first open, as_of: first day })` — one a name | the desk opens |
| The strikes on show | `massiveContracts(name, { expiry, type: 'call', as_of: first day })` | an expiry is shown |
| A contract's own trades | `massiveBars('O:…', 1, 'minute', first day, last day)` — one a contract (each leg of a spread) | the reader opens it; as the desk opens, every contract the book holds or works |

Every answer is kept for the visit (and by the proxy, 30 minutes for bars, 6 hours for listings), so a real day opens in
two calls and a contract in one: SPY on 2026-09-14 opened its desk about a second after the press, and a contract's
trades came in under a second when the bucket had a token (16 s when it was queued behind earlier calls). A 429 (the key
is shared) is waited out 15 s at a time, up to four times, the step saying "waiting its turn"; any other failure is said
in words with **Ask again**. The plan carries no index (403), so SPX, NDX and RUT have no real days — the picker says the
funds that track them do.

**How a real day is priced and filled** — the Basic plans carry trades, not quotes: a contract's price in a minute it
traded is that minute's volume-weighted average, and it fills there; in a minute it did not trade the price is the
house's estimate on the name's real price (≈) and nothing fills. In full: `docs/review-backtest-rules.md` "Real days" and
`docs/paper-rules.md` "The Backtest on real days". A closed trade writes down its walk and candles into the session
(`realKeep.ts`), so the journal and the report never ask the record again; the journal marks its trades "Real days".
The Desk's half sessions are left out (`EARLY_CLOSES`, and a day whose record stops before 15:30).

