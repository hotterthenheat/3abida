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

The pricer is `core/greeks.ts` `blackScholesGreeks` on the clock and carry UW solved its vols under, measured 2026-10-13
(`research-2026-10-13/uw-vol-convention.md`): European, r 4.15%, no dividend; today's expiry on calendar time to its
last-trading instant (16:00 New York, 13:00 on a half day), a later one on whole calendar days ÷ 365, held all session —
priced so, a contract's gamma at UW's vol is UW's own (median ≤ 0.03% through 60 days). The chain's vol is the contract's
last print's; its `last_tape_time` after the close is a batch stamp, so a vol stamped after 16:15 is kept as "from a print
at or before 16:15" (`staleBound`). A leg is OI × greek × price² (UW's per-1% units — summed over UW's own per-contract gamma it reproduces
`/spot-exposures/strike` to the dollar, checked 2026-10-12); the house's sign. A vol read in its expiry's last hour is not
used (UW figures far strikes at 500% and more after the close). A contract with no vol stays out and its strike's
coverage drops; a strike with none is a gap. No magnitude is rescaled to UW: the residual against UW's books (per
strike, at the captured times: the gap summed over the strikes both hold, against the book's size) and UW's whole-book
series (the model summed over every strike within 15% and 60 days, a minute every quarter hour: sign agreement and the
median ratio) is one line in the ladder's "How sure". Seen on SPY, 2026-10-12, read after the close: 35.6% per strike
against UW's one after-close book (which still carries the day's expired contracts at the money), the same sign 94% of
32 minutes at 2.29× UW's whole-book figure — every vol that day carried from Oct 9's close, as nothing was read in the
session.
Each cell keeps `prov` (`modeled` when half its gamma or more stands on today's vols, `carried` otherwise), `staleSince`
and `coverage`; the hover card shows them with UW's own figure for the strike. The bead scale runs forward (each column
against the columns at or before it). The sessions before today are drawn, rebuilt by the server on the same model (below).

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

**The field's recorder (server/fieldRecorder.ts).** Mounted by the proxy: `GET /feed/field/<NAME>?since=<ms>` watches the
name (six at most; two idle hours let it go) and answers what was received after `since` — the books, the chain reads,
the seed, UW's whole-book series. Through the session (09:30–16:00 New York, a weekday) it reads, through the proxy's
own client, cache and UW gate (three at once): each name's book and whole-book series once a minute, its chain every ten
minutes (and once on first watch, whatever the hour), the session before's close chain once a day. Append-only files in
`.feed-cache/field/<NAME>/<YYYY-MM-DD>/` (`books.jsonl`, `chain.jsonl`, `seed.json`, `total.json`; git-ignored; the days
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

