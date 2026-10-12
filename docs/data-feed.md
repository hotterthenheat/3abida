# The data feed (2026-10-12)

Slayer reads two vendors: **Unusual Whales API Basic** and **Massive (Polygon) Basic** (Stocks, Options, Indices,
Currencies). Neither plan has a socket, so the terminal asks on a timer. Until a room is moved onto them, every room
reads exactly what it read before.

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
- **`/feed/status`** reports, per vendor, whether a key is set (yes or no, never the key) and how a cheap probe went;
  it runs the probe at most once a minute.

## The client (src/data/feed/)

| File | What it holds |
|---|---|
| `client.ts` | `feedGet` / `feedFetch` (never throw; `{ ok, data }` or `{ ok: false, reason }`), `viaProxy` for Massive's `next_url`, `num()` for UW's numeric strings |
| `status.ts` | the feed-status store (`useFeedStatus`, `probeFeeds`, `startFeedProbe` — run by the shell as the terminal opens, never on the landing) |
| `poll.ts` | `useFeedPoll(key, load, periodMs)`: one timer per key at the shortest period asked, a hidden tab asks nothing, answers land once a frame |
| `uw.ts`, `massive.ts` | the typed fetchers below |
| `rooms.ts` | the per-room switch: what each room needs, and one seam a room |
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
| `uwSpotGexByStrike` | `GET /api/stock/{ticker}/spot-exposures/strike` (`min_strike`, `max_strike`) |
| `uwSpotExposures` | `GET /api/stock/{ticker}/spot-exposures` |
| `uwDarkpool` | `GET /api/darkpool/recent`, `GET /api/darkpool/{ticker}` |
| `uwCongressTrades` | `GET /api/congress/recent-trades` |
| `uwInsiderTrades` | `GET /api/insider/transactions` (`ticker_symbol`) |
| `uwEarningsDay` | `GET /api/earnings/premarket`, `/afterhours` (`date`) |
| `uwEarningsFor` | `GET /api/earnings/{ticker}` |
| `uwExpiryBreakdown` | `GET /api/stock/{ticker}/expiry-breakdown` |
| `uwNewsHeadlines` | `GET /api/news/headlines` (`ticker`, `limit`) — in UW's catalog; answered 200 on the Basic plan, 2026-10-12 |
| `massiveMarketStatus` | `GET /v1/marketstatus/now` (the probe) |
| `massiveContracts`, `massiveExpirations` | `GET /v3/reference/options/contracts` (paged on `next_url`; one round `strike_price` lists every expiry in one call) |
| `massiveBars` | `GET /v2/aggs/ticker/{ticker}/range/{n}/{span}/{from}/{to}` (stocks and `O:` contracts; the session before is the latest) |
| `massiveTickers`, `massiveTickerDetails` | `GET /v3/reference/tickers`, `GET /v3/reference/tickers/{ticker}` |
| `massiveIndices` | `GET /v3/snapshot/indices` — **403 on these plans** (as are `I:` bars) |

## The rooms: all or nothing

`src/data/feed/rooms.ts` names what each room would read (`needs`) and gives each room one seam — `pulseSource`,
`terrainSource`, `traceSource`, `dossierSource`, `pinpointSource`, `compassSource`, `weigherSource`, and
`useRoomSource(room)`. A room reads the feed only when **every** vendor it needs is up, never one vendor beside the
house's own figures on one screen. The Dossier is wired (below); every other room's `wired` is `false`, so its seam returns `'stand-in'`
and its pages read what they read before. Moving a room: rewire its pages to read the fetchers when its seam says `'feed'`,
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
