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

| `uwContractScreener` | `GET /api/screener/option-contracts` (`limit` ≤ 500, `ticker_symbol`, `date`) — the day per contract |
| `uwContractFlow`, `uwContractIntraday`, `uwContractHistoric` | `GET /api/option-contract/{id}/flow`, `/intraday`, `/historic` |
| `uwMultiLeg`, `uwMultiLegLegs` | `GET /api/option-trades/multi-leg` (`limit` ≤ 200, `min_premium`, `older_than`), `…/multi-leg/{id}/legs` |
| `uwOhlc` | `GET /api/stock/{ticker}/ohlc/{1m,5m,1d}` (`date` — a past day's whole tape; `1d` stamps the day in `date`) |
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

`dossier` is `wired: true`. Its pages read `src/data/feed/dossier.ts` when both vendors are up (and wait on their
skeleton while the shell's first probe is out); otherwise every page reads the house's book exactly as before.

| Page | Reads | Asked |
|---|---|---|
| Congress | `uwCongressTrades`, 200 rows a page, paged back by trade date (`date` = the day before the oldest) — 2, 4 or 6 pages for the 30, 90 or 180-day window | every 10 min |
| Insiders | `uwInsiderTrades`, `transaction_codes[]=P,S` (open market) or every code, 3 pages of 200 (one day's filings fill about one); the names to know from one page of `P` | every 10 min |
| Earnings | `uwEarningsDay` premarket and afterhours for each weekday the board shows (up to 20 calls) | every 10 min |
| Earnings › a name | `uwEarningsFor` and `uwStockState`; the company's name from `massiveTickerDetails` | every 10 min |
| Stocks | `uwStockState` for each of the list's 36 names | every minute |
| Stocks › a name | `uwStockState` first (a ticker UW has no state for is not a name), then `massiveTickerDetails`; `uwQuote` + `uwStockState`; `massiveBars` daily, sixty days; `uwEarningsFor`; the name's insider and Congress rows | quote 15 s, bars 30 min, record 6 h (the proxy keeps it a day) |
| News | `uwNewsHeadlines`, the latest 100 | every minute |

Massive is asked for the OPEN name only — two calls a name (the record, the bars), both cached by the proxy — never for
a list. A field a page shows that no answer carries is drawn "—" with the title "not in the feed": the member's party,
seat and committees; a filing's missing price or holding; revenue, the odds, the overnight deflation and the busiest
contracts on a report; the usual move, pricing, beat count, estimates' drift and IV rank on the calendar (a name's own
page works the usual move, the pricing and the beat count from its own reported rows); the house's screens, sleeves,
thirty-day line and rotation on Stocks; the map, a story's read and the day ahead on News.

Screenshots on the vendors' answers, 2026-10-12 around 11:45 New York: `docs/data-feed/dossier-2026-10-12-*.png`.

## Trace reads Unusual Whales (2026-10-12)

`ROOM_FEEDS.trace.wired` is `true`: with UW up, every Trace page reads the vendor (`src/data/feed/trace.ts`,
`traceCard.ts`, `traceDark.ts`), and with UW down (no key, the network, a refused key) every page reads its own book
exactly as before. Nothing on one screen comes from both. While the shell's first probe is out, a page shows nothing
rather than a flash of its own book.

| Page | Reads | Poll |
|---|---|---|
| Live Tape | `option-trades`, prints of $25K and up, the newest 500, kept for the session | 5 s |
| Screener, Footprints, Tracker | `screener/option-contracts`: the market's 500 heaviest contracts and the name's own 500; the session before for the overnight ledger | 60 s / 30 s / 15 min |
| Watchers | `flow-alerts` of $100K and up, back to the open once (≤ 12 pages), then the newest | 15 s |
| Windows | `option-trades` of $250K and up, back to the open once (≤ 24 pages), cut into quarter hours | 20 s |
| Multi-Leg | `option-trades/multi-leg` of $50K and up, back to the open once; a structure's legs when it opens | 15 s |
| Net Flow | `top-net-impact` (the board), `net-prem-ticks` and `ohlc/1m` (the pane), Market Tide (the market's own line) | 60 s / 30 s |
| 0DTE | `net-flow/expiry` `zero_dte` by cut and moneyness; a name's pane its `net-prem-ticks` (every expiry, said so) | 30 s |
| Compare | each name's book, ticks, flow by expiry and quote; the session's structures and tape | 30–60 s |
| Dark Pool | `darkpool/{ticker}` (the newest 200), `stock-volume-price-levels` (the shelves and the off-exchange share), `ohlc/1m`; `darkpool/recent` of $1M and up for the leaders | 15 s / 60 s / 30 s |
| The print card | the contract's `flow` (newest 500), `intraday`, `historic`; the name's ticks, flow by strike and by expiry | 15 s – 10 min |
| The rail's price, on a Trace page | `stock-state` | 10 s |

A figure the vendor's answer does not carry is `NaN` in the row and "—" on the page, titled "not in the feed" — the
session before quarter hour by quarter hour (Footprints' sparkline), a print's overnight change in open interest, a dark
cross's average-day share, the floor share of a print that does not say. A view the answers cannot draw is not offered:
the card's other sessions and its dollar bars, a sector or the index funds alone on 0DTE, a name's lines by moneyness,
tenor or expiry. Words say what the feed holds: a floor is named where a page reads prints above it.

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
NDX, RUT, VIX and XSP): on a page that reads the feed the rail shows "—", titled "not in the feed" — never the house's
figure beside the vendor's prints; a name answered 422 is not asked again that visit. On every other page the house's
figure stays.

The watchlist drawer follows the same rule (`WatchlistDrawer` by `pageSource`): over a page whose room reads the feed each
row is UW's day state and the nearest wall or flip of UW's book (`levels.ts`), an index its book's price; over any
other page the house's.

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
| Terrain, a pane | the book or one listed date (the expiry card lists UW's dates); open interest; the implied move; the bars | the ladder (size and the flow lane), the walls and the flip on the chart, the strike field (the books this terminal read today — it fills from the first read), the candles (1m to 1h) |

On Terrain these are not in the feed and not drawn: the seconds, daily and weekly timeframes (four sessions of minute
bars), range and volume bars, dark pool, the option tape, the drifts, events, the alerts' lines, the walls through the
day, comparisons, the open's ghost on the ladder, and its volume-by-price switch; a pane on an index says its bars are
not in the feed and draws no ladder. Pulse is not wired, so its Targets, At the wall, Range and Close panels read the
house's book as before.

**Terrain's trail (the strike field) on the feed.** UW gives the book as it stands; no route gives it strike by strike
for earlier in the day (`/spot-exposures/strike` takes a `date`, never a time — UW's spec, checked 2026-10-12; the
per-minute `/spot-exposures` carries the whole book, not strikes). So the field is the books this terminal read today:
written to IndexedDB (`slayer_field`, one record a name a day, earlier days dropped) and read back as a name is first
drawn, so a reload keeps it; and the shell reads the open name's book every half minute on every page while UW is up
(`components/layout/FieldRecorder.tsx` — the same poll key Terrain and Pinpoint use, never a second call), so it fills
while the terminal is open anywhere. A pane says where its trail starts. A hidden tab asks nothing, so a closed or
hidden terminal leaves a gap.

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

