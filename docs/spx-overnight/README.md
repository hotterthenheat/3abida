# SPX overnight field — 2026-10-15

The owner's message: "SPX/SPXW options trade nearly 24 hours on Cboe: regular 9:30 am–4:15 pm ET, curb 4:15–5:00 pm,
Global Trading Hours 8:15 pm–9:25 am … Screenshot SPX overnight next to SPY over the same night."

## What each source carries — checked live, 2026-10-14 at 10:30–10:50 pm New York (two hours into Cboe's overnight session)

| source | regular, to 4:15 pm | curb, 4:15–5:00 pm | overnight, 8:15 pm–9:25 am |
|---|---|---|---|
| UW per-contract minutes (`/option-contract/SPXW261015C07750000/intraday`) | 9:31 am to 4:14 pm, 382 minutes, every one `trading_hours: "rth"` | none | none |
| UW flow (`/stock/SPXW/flow-recent`) | yes | yes — the newest 50 prints all `curb`, the last at 4:59:58 pm, `underlying_price` null | none (newest print 4:59:58 pm) |
| UW chain snapshot (`/stock/SPX/option-contracts`, 10,816 contracts within 60 days) | — | its NBBO stands as of the curb's end; every contract stamped 5:45 pm | none |
| Theta | yes | yes | its own pages: 2015–2018 and from 2022 (they give both January and December 2022) |

So the overnight session can only come from Theta's terminal, which runs on the always-on machine. This workspace has
none (one terminal a key); everything below that needs one is built and proved on fixtures here, and runs on your
machine.

## The five items

| # | asked | built | proved here | on your machine |
|---|---|---|---|---|
| 1 | read SPX/SPXW in all three sessions, live and in history; log the first date Theta serves overnight rows | one session schedule (src/core/sessions.ts); the recorder asks Theta for SPX whenever it is in a session and its index does not print (server/overnightReader.ts); the downloader fetches SPX's roots to 5:00 pm and both halves of the overnight session and logs the oldest day served (`first.gth`); `npm run theta:gth` finds the first date directly | scripts/sessions-proof.ts (18 checks): the sessions at 17 moments (Sunday's 8:15 pm into Monday, none into Saturday, Thanksgiving, the half day), a recorder at 9:00 pm Wednesday on Thursday's trading day, Theta asked 5 times in 3 minutes | `npm run theta:gth` → docs/theta-probe/<date>/gth/gth-report.md: the first date, every run of days served, and how Theta dates the evening session |
| 2 | price the overnight field off the forward from at-the-money SPX options, labelled "price from options (overnight)" | data/feed/forward.ts: the three strikes nearest put-call parity, F = K + e^{rT}(C − P), the median; the field stands on F·e^{−rT} (the spot that forward implies on UW's carry — under 0.01% apart overnight, so every vol is solved at one price); the pane head says "price from options (overnight)" / "(after the close)", the rail "price from options" | exact on quotes priced at a forward; one strike quoted at twice its price does not move it; on UW's own SPX quotes after the curb (Oct 15 expiry, 7715/7720/7725) it gives 7718.10 | the forward a minute from 8:15 pm |
| 3 | wide quotes overnight → stale edge, one threshold | **2 vol points** of width ((ask − bid) ÷ vega); a vol solved from a wider quote is `wide`, a cell with half its gamma on wide vols wears the soft edge, and its card says "Stale · N% of the strike's gamma on vols from wide quotes (over 2 vol points)" | the threshold's basis (below); a strike on wide vols carries share 1.00, one on narrow 0.00; a quote 1.5 points wide is not wide, 2.5 is | the overnight share of wide quotes, measured |
| 4 | SPX's regular session to 4:15 pm, then the curb to 5:00 pm | the recorder reads SPX's book and chain to 4:15 pm and Theta's quotes from 4:00 pm (the index's last value) to 5:00 pm; the store, the tiles and the page model SPX's 4:00–4:15 pm and curb minutes; UW's per-contract minutes already reach 4:14 pm | SPX's day modeled: 790 overnight columns, 405 regular (9:30–4:15), 45 curb, none between | — |
| 5 | SPY and QQQ: regular hours by default, the gap outside them labelled | the field of every equity is 9:30 am–4:00 pm (1:00 pm on a half day), today as every day; the recorder writes no row outside them; the words "outside regular hours · the field is 9:30 am to 4:00 pm" (on the reader's clock) | SPY's modeled day: 390 columns; the recorder at 9:00 pm writes none; shots/workspace-spy-1m-after-close.png | — |

**The wide-quote threshold's basis** (measured 2026-10-14, within 5% of the money, weighted by gamma × open interest):

| quotes | count | p50 | p90 | p95 | p99 | share of gamma over 2 points |
|---|---|---|---|---|---|---|
| SPY, regular session, the recorder's 15 reads | 26,932 | 0.08 | 0.48 | 0.85 | 4.08 | — |
| SPX, after the curb, UW's snapshot | 4,440 | 0.29 | 1.06 | 2.06 | 5.90 | 5.3% (11.7% over 1, 3.0% over 3) |

Two points sits at SPX's 95th percentile at the curb's end: a quote wider than 19 in 20 of the curb's is called wide. The
overnight quotes have not been measured (no terminal here); your first night tells how much of the field the rule marks.

## Found and fixed on the way

- **SPX's field held its AM monthlies alone.** The field's universe kept a contract only when its root was the name's
  own, so under SPX every SPXW contract (the weeklies, 0DTE among them) was dropped. SPXW now reads as SPX (as NDXP for
  NDX, RUTW for RUT, VIXW for VIX). It never showed because the page drew no SPX field until today.
- **A view that is all gap had no words.** The renderer returned before drawing anything when no column was on screen,
  so SPY's minutes after the close at one minute a bar were a blank. The gap's words now stand there too.
- **The track record stays pre-registered**: the scorecard reads 9:30 am–4:00 pm rows alone; SPX's new minutes (4:00–4:15,
  the curb, overnight) are the field's. A variant that reads them is Section D's to register.

## The shots

- **shots/workspace-spx-vs-spy.png** — this workspace, 8:14 pm Pacific (11:14 pm New York, SPX's overnight session for
  Thursday). SPX's pane says why it is empty: "SPX's overnight session: no S&P 500 value prints, and its options' quotes come
  through Theta's terminal — none runs on this server's machine"; its ladder reads UW's book ("book 1:15 pm" — 4:15 pm New
  York, SPX's close, UW's last figure of it). SPY's ovals stop at its 1:00 pm Pacific close.
- **shots/workspace-spy-1m-after-close.png** — SPY at one minute, 2:00–5:00 pm Pacific: no ovals after the close, the
  gap's words "outside regular hours · the field is 6:30 am to 1:00 pm".
- **SPX overnight beside SPY over the same night — from your machine**: `npm run spx:night` between 6:00 and 9:25 am New
  York (the recorder running, the terminal signed in) writes docs/spx-overnight/<date_time>/spx-vs-spy.png with a crop of
  each plot and notes.json (each pane's price chip, bars and the words over its gaps). It puts your desk back as it was.

## Open

- How Theta dates the evening session (under the calendar evening or under the trading day) is asked by `npm run
  theta:gth` — the downloader asks it under the calendar evening; if the probe says otherwise, the two calls change before
  the history is trusted.
- After a drag back a day at one minute, SPY's price axis kept today's range (the candles at 779 stood off it) — seen in a
  shot here, not yet traced.
