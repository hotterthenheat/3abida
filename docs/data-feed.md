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
| `uwOhlc` | `GET /api/stock/{ticker}/ohlc/{1m,5m}` |
| `uwDailyBars` | `GET /api/stock/{ticker}/ohlc/1d` (three rows a date — `pr`, `r`, `po` — about a year; an index 422) |
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
draws — exposure by strike and by date, open interest, max pain, the implied move, the book through the day, a name's
minute bars — is a UW route, and Massive adds nothing they draw (its minute bars stop at the session before, which UW's
reach, and it refuses the indices). With UW up, every Pinpoint page and every Terrain pane reads
`src/data/feed/levels.ts`; with UW down (no key, the network, a refused key) they read the house's book exactly as
before; while the shell's first probe is out they stand as their skeletons. Nothing on one screen comes from both: the
rail's price on a Pinpoint or Terrain page, the head's facts and the watchlist drawer read the feed too.

**The book.** `/spot-exposures/strike` round the price (±10%, narrowed to about 34 strikes each side once the chain's
step is known, rounded so the address holds still), 30 strikes kept each side — the house's `BOOK_WINDOW`. UW's signs
are mapped onto the house's (core/walls.ts: negative call-dominant): gamma, delta and the calls' vanna and charm
negated, the puts' vanna and charm as they come. The call wall, the put wall, the flip and the supreme are
`pickWalls` / `pickFlip` on those rows; checked by hand against a curl of the same answer (SPY, 13:44 ET: 785, 772,
777.50, 785). "How sure" says what a feed level stands on: the open interest as of the close the count stands for
(UW's count dated Oct 12 is Oct 9's close) and the price and minute UW figured the hedging at.

**Polling.** The book every 30 s (the proxy keeps exposure 30 s); by date every 60 s; the contracts traded by strike
60 s; open interest, max pain and the implied moves every 10 min (the proxy keeps them 10 min); the book through the
day 60 s; bars: 2,500 one-minute bars every 5 min and the newest 30 every 15 s, folded into one tape; a name's day
state 10 s. A hidden tab asks nothing. A failed answer — a 429 while other sessions share the key — keeps the last good
one: a page never falls back to the house's book mid-session, and its stamp says it is waiting on the next answer.

| Page | Reads | What it draws |
|---|---|---|
| Map | the book; by date (the first seven listed dates); open interest; max pain | the levels with "How sure"; the heatmap a column a date and the ladder on the whole book (GEX, DEX, vanna, charm — vega is not in the feed and not offered); Read this |
| Ahead | the implied moves; max pain | the move priced in at each horizon and which walls stand inside it; max pain on each listed date |
| Building | the book (gamma from today's volume); contracts traded by strike; two counts of open interest; the book through the day | what today's trading built, strike by strike; open interest overnight (`OiChange`); dealers through the session (`DealerTimeline`, its flip half not in the feed) |
| At the wall | the book; open interest; contracts traded; max pain | each named level, what stands at it, how sure |
| Targets | the book | every strike in order of the hedging parked there |
| Board | each board name's book (every 30 s) | the price, which side of the flip, the walls, the supreme, net GEX |
| Compare | both names' books | the levels and the ladder side by side |
| The head | the book; the implied moves | which side of the flip, the flip and how far (σ is the one-day implied move); Copy levels off the feed's book |
| Terrain, a pane | the book or one listed date (the expiry card lists UW's dates); open interest; the implied move; the bars; the name's prints, dark pool and report | every control the house's pane carries — see "Terrain: the house's pane, filled" below |

**What is not in the feed, and so not drawn** (each page names them in one quiet line, "not in the feed"): the house's
modelled reads that stand on its own session history — the odds a level is reached or holds, the range to the close,
where it closes, the half-hour schedule, the Trader's Clock, how the levels held, where they are heading, the
agenda's order, the Board's sparkline and crossings, Compare's head-to-head, ruler, tapes and pair; the flip's
crossings today; the flip minute by minute on the dealers' timeline (the answer carries the whole book a minute, not
the strikes); open interest by date (the heatmap's read line says "—"); vega by strike. On Terrain only the seconds
(below). An index (SPX, NDX, RUT …) has exposure, open interest and max pain on UW but no day state and no bars on this
plan (422, a CBOE grant): Pinpoint reads it at the price its book was figured at, the change left off; a Terrain pane on
it keeps its chart and every control and says in the chart's place that its bars are not on these plans, the ladder
standing on the book. Pulse is not wired, so its Targets, At the wall, Range and Close panels read the house's book as
before.

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
| Exposure trails, walls through the day | the books this terminal read today (`useFeedField`); the walls' charm lens scales today's charm by each minute's share of the strike's gamma, the house's rule, off the newest book |
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

