# Terrain audit — 2026-10-13

The owner (2026-10-13): "Screenshot Terrain (Oct 12 session and the current after-hours state). List every number,
price, percentage, time, date, label and legend item on the page … Table: element | value shown | source (code path +
data) | what it should be | pass/fail … Fix every fail, re-screenshot, redo the whole table."

Taken as a Los Angeles viewer (Playwright `timezoneId: America/Los_Angeles`, 1600 × 1000, dark), SPY, 5m, one pane,
with the keys in. Every time on the page is the viewer's clock (PDT); the market's hours are New York's. By the time
the audit ran the market had opened (6:51 am PDT = 9:51 am ET), so "the current state" below is the live session, not
the after-hours state of the owner's screenshot; the after-hours findings are reconstructed from the sources and
from the owner's figures (778.10 / 777.29).

`before/` — the page before the fixes; `after/` — after them.

| Shot | What |
|---|---|
| `01-now.png` | the live session, 6:51 am PDT |
| `02-hover-oct12.png` | the Oct 12 bead at 778 · 12:35 pm PDT (3:35 pm ET), its card |
| `03-hover-today.png` | today's bead at 779 · 6:55 am PDT, its card |
| `04-plot-2x.png`, `05-ladder-2x.png` | the plot and the ladder at two device pixels a point |
| `06-howsure.png` | the ladder's How sure door |
| `07-oct12-session.png`, `-hover.png` | the Oct 12 session whole (the chart panned back), the 778 bead |

## Step 1 — every element on the page

**The rail (left).** `SPY` · `$778.20` · `+0.01%` · `Ctrl K` · Pulse, Alerts, Watchlist · Market: Terrain, Trace,
Dossier · The book: Pinpoint · Trade: Compass, Weigher · Practice: Paper, Backtest, Journal · Settings · Trader @trader
· `slayer:~ $ ● live` · `The open · morning in 9m` · `6:51:41 am PDT`.

**The pane head.** `SPY ⌄` · screenshot · `+` · `$778.29` · `+0.01%` · `1m ▲ 5m ▲ 15m ▲ 1h ▲ 1D ▬` · pop-out ·
expand. The strip under it: `Heaviest 780 −$1.9B · 785 −$1.9B · 772 $1.1B` · `+ amplifies · − absorbs` · `Bead light:
√(size ÷ this session's 85th-percentile peak so far)`. On hover: `O 777.72 H 777.92 L 777.66 C 777.78 V 285.2K`, the
toolbar `5m ⌄ · indicators · alerts · volume · ⧉ 2 ⌄ · theme ⌄`.

**The plot.** Candles (UW's 1-minute bars folded to 5m, extended hours), the volume lane, the drawing rail (8 tools),
the TradingView mark, `Reset`. Price axis `776.00 … 780.20` by 0.20. Time axis `8:00 am · 11:00 am · 2:00 pm · 13 ·
3:00 am · 5:00 am · 8:00 am`; panned back: `12 · 3:00 am · 5:00 am · 8:00 am · 11:00 am · 2:00 pm`. The last-price
capsule `778.29` over `00:00`. Crosshair labels `Oct 12, 12:35 pm` / `777.78`. The trail: bead rails at 777, 778, 779,
780 (and 785 on Oct 12), each column's flip tick (dashed), the strength chip `780 · 10%` (`780 · 9%` on Oct 12), the
wall-move chips `CW 785 → 780 · 8:45 am` (Oct 12) and `CW 785 → 780 · 1:00 am` (overnight), the level lines.

**The bead card, Oct 12 (778 · 12:35 pm PDT).** `778 · 12:35 pm PDT` · `Estimated dealer gamma (assumed sign)` ·
`Oct 12's opening positions re-priced along the price path, each contract on its latest traded vol` · `−$1.3B · 7.4%
of the book · since 6:30 am −$957M` · `Flip 777.50 · crossings near 776.50, 774.50` · `Modeled · vols as traded on
Oct 12` · `Stale since 7:17 am` · `Unusual Whales serves no book by strike for a past minute` · `Model
trail-2026-10-13.3`.

**The bead card, today (779 · 6:55 am PDT).** `−$1.0B · 4.8% of the book · since 6:30 am +$50.4M` · `Flip 777.50 ·
crossings near 775.50, 774.50` · `Modeled · vols read today` · `Oldest vol from a print at or before 1:15 pm Oct 12` ·
`Unusual Whales' book, 6:55 am: −$912M` · `Model trail-2026-10-13.3`.

**The ladder.** `Ladder | Net` · `Expiry All expiries ⌄` · `Lanes Size ⌄` · `VOL` · `ⓘ How sure` · `ⓘ` (How to read).
The key: `puts amplify` · `calls absorb` · `— the spine now` · `-- at the open` · `■ supreme`. Heads: `STRIKE · Δ SPOT
· ◂ PUTS · CALLS ▸ · NET`. `▲ 29` / `▼ 28`. Rows: `779 +0.09% $885M ▮ $1.8B −$941M`, `778 −0.04% $1.4B ▮ $1.9B
−$469M`, `777 −0.17% $1.6B ▮ $1.0B $569M`. The spot band `778.29`. `flip 777.50` (dashed rule). The spine (solid)
and its ghost at the open (dashed). `hover a strike · click to keep it`.

**How sure (the door).** `What they assume — Assumes customers sold the calls and bought the puts, so dealers hold the
other side — open interest does not say who did.` · `How fresh — Open interest as of Oct 12's close — Unusual Whales'
count dated Oct 13; it is counted once a day · the hedging is figured by Unusual Whales at 777.88, 6:58 am PDT` ·
`The field on the chart — The field is modeled, never rescaled to the vendor: strike by strike it differs from Unusual
Whales' book by 9.1% of the book's size (median of 12 books read today); against their whole-book figure, priced on
every strike within 15% and 60 days, it has the same sign 13% of 8 sampled minutes, at −1.99× its size at the median.`
· `If the side were the other way — Call wall 780 · … no wall above spot. Put wall 772 · … would sit at 775 …`.

**The desk bar (foot).** `1 2 3 4` · `STRIKES` · `Colours Thermal ⌄` · `$ % ATR σ` · `LAYOUTS` · `RTH`.

## Step 2 — the table, before the fixes

Sources are `file:line` at commit `33b15f7`; "the book" is UW `/stock/SPY/spot-exposures/strike` (per strike,
`price` and `time` per row); "the state" is UW `/stock/SPY/stock-state`; "the bars" UW `/stock/SPY/ohlc/1m`.

| # | Element | Value shown | Source (code + data) | What it should be | |
|---|---|---|---|---|---|
| 1 | Rail name, price, change | `SPY $778.20 +0.01%` | SideNav `useRailQuote` → `useFeedPrice` (price.ts, the state, 10 s) · close 778.20, prev_close 778.10 | the latest trade; +0.013% | pass |
| 2 | Rail session strip | `The open · morning in 9m` | SessionStrip phases on New York's minutes | 9:30–10:00 ET is "The open" | pass |
| 3 | Rail clock | `6:51:41 am PDT` | SessionStrip `railClock` → `clock()` | the viewer's clock with its zone | pass |
| 4 | Signature | `slayer:~ $ ● live` | data/marketState.ts | live while the market is open | pass |
| 5 | Pane head price | `$778.29` (at 6:53 am: `$778.21` beside the rail's `$778.30`; after hours `$778.10` beside the rail's `$777.29`) | Terrain.tsx:1903 `SpotPrice value={levels.spot}` ← `feedRail` (Terrain.tsx:409) `book.spot` ← levels.ts:287 the book's `price` — the price UW figured the book at, up to a minute old in session, the regular close after hours | one current price with the rail and the capsule | **FAIL — item 1** |
| 6 | Pane head change | `+0.01%` | `useFeedDayState` (levels.ts:642) — a SECOND poll of the state, key `trace:state:SPY`, beside the rail's `uw:state:SPY` | the rail's own figure, one poll | fail (same source twice; skew) |
| 7 | Timeframe tabs and trends | `1m ▲ 5m ▲ 15m ▲ 1h ▲ 1D ▬` | Terrain.tsx:864 the strip — each timeframe's close against its EMA21 and VWAP (the title names them) | — | pass |
| 8 | Heaviest | `780 −$1.9B · 785 −$1.9B · 772 $1.1B` | Terrain.tsx:1283 `heaviest(rail.core, 3)` on the feed rail — the book in the house's sign, net = −(call_gamma_oi + put_gamma_oi) | the book at 13:54Z: 780 −$1.8B, 785 −$1.8B, 772 +$1.2B (it moved between polls) | pass |
| 9 | Amplifies/absorbs key | `+ amplifies · − absorbs` | Terrain.tsx:2117 | — | pass |
| 10 | Bead scale | `Bead light: √(size ÷ this session's 85th-percentile peak so far)` | gexNodesPrimitive `BEAD_SCALE` | states the scale | pass |
| 11 | Overlays badge | `⧉ 2` | ChartToolbar — overlays on (trails, levels) | — | pass |
| 12 | Candles, volume | — | levels.ts `uwOhlc` 1m → folded to 5m; extended hours | — | pass |
| 13 | Price axis | `776.00 … 780.20` | StrikeChart autoscale, `fitCandles` (the candles 776.6–779.1 + 8% pad + the library's margins) | fits the candles | pass as asked — but see 31 |
| 14 | Last-price capsule | `778.29` (at 6:53 am `778.24` beside the head's `778.21` and the rail's `778.30`) | StrikeChart:3084 `lastCloseRef` = the last bar's close (the bars, 15 s) | the same current price as the rail and the head | **FAIL — item 1** |
| 15 | Capsule countdown | `00:00` (all bar long, four samples 15 s apart) | StrikeChart:3493 measures the gap between the last two bar ARRIVALS as the bar's period; on the feed the arrival gap is the poll (15 s), so the count reaches 0 and stays | time to the bar's end: 5m bars end on the clock's grid | **FAIL** |
| 16 | Time axis | `8:00 am · 11:00 am · 2:00 pm · 13 · 3:00 am · 5:00 am · 8:00 am` | chartTime.ts `tickMarks` prints the reader's clock; the library (`fillWeightsForPoints`, UTC) decides WHICH bars are day ticks | — | see 17 |
| 17 | The day tick `13` | `13` between 2:00 pm and 3:00 am | the library's day tick at the first bar whose UTC date is Oct 13 — here the 4:00 am ET pre-market bar after the overnight gap, whose date is Oct 13 in every zone; the label is right. But a day tick is placed at 00:00 UTC = 8:00 pm ET, so after 8 pm the last after-hours bar wears a day tick labelled with the day that is ENDING (the owner's `12` at the right end) | day ticks at the viewer's midnight, labelled with the day beginning | **FAIL — item 5** |
| 18 | Wall-move chips | `CW 785 → 780 · 8:45 am` (Oct 12), `CW 785 → 780 · 1:00 am` (overnight) | gexNodesPrimitive:505 — the column's call wall (`pickWalls`) moved and held three columns | the 1:00 am one is the model re-pricing today's positions on the pre-market price with carried vols — a modeled move, not a change in positions; by design | pass (note) |
| 19 | Wall-move chip placement | `→ 780 · 8:45 am` drawn under `1D ▬`, over the tabs (07-oct12-session.png; the live shot too, `· 1:00 am` touching the tabs) | gexNodesPrimitive:520 — the chip stands at its wall's price; the strength chips clamp under the chrome band, the wall chips do not | clear of the head's chrome | **FAIL** |
| 20 | Strength chip | `780 · 10%` | gexNodesPrimitive:584 — the newest column's heaviest strike and its share of the column | the Heaviest row's 780 | pass |
| 21 | Beads | rails at 777–780 (785 on Oct 12) | trailField.ts `modelColumn`; 2,376 columns in (Oct 8 … today) | — | pass |
| 22 | Column flip ticks | dashed ticks per column | gexNodesPrimitive:882 `pickFlip` — the MIDPOINT of the two strikes where the sign changes | the price where the net crosses zero | **FAIL — item 2** |
| 23 | Card: strike and time | `778 · 12:35 pm PDT` | StrikeChart:5294 `nyClockOf(time, {zone})` | — | pass |
| 24 | Card: what it is | `Estimated dealer gamma (assumed sign)` / `Oct 12's opening positions re-priced …` | StrikeChart:5287–5290 | — | pass |
| 25 | Card: value and share | `−$1.3B · 7.4% of the book` | gexNodesPrimitive `beadAt`: the cell's value; Σ\|value\| of the column | — | pass |
| 26 | Card: since the open | `since 6:30 am −$957M` | StrikeChart:5299 `value − open`, open = the 9:30 ET column's value (gexNodesPrimitive:926) | say it is a CHANGE since the open | **FAIL — item 6** |
| 27 | Card: flip and crossings | `Flip 777.50 · crossings near 776.50, 774.50` | `col.flip` (midpoints), crossings midpoints (gexNodesPrimitive:937) | the interpolated crossings | **FAIL — item 2** |
| 28 | Card: provenance | `Modeled · vols as traded on Oct 12` | StrikeChart:5270 — ≥ half the cell's gamma on vols observed that session | — | pass |
| 29 | Card: staleness | `Stale since 7:17 am` on the at-the-money strike | `staleSince` = the OLDEST trade any vol at the strike came from (trailField.ts:395). At 778 on Oct 12 that is the Nov 27 778 call — 4 contracts of open interest, last traded 10:17 am ET; the same-day 778 contracts (18,665 OI) were priced on 3:35 pm vols. The fresh vols ARE applied; the line names the least informative fact | say the newest vol in use and how much of the strike stands on an old one | **FAIL — item 3** |
| 30 | Card: the measured reference | `Unusual Whales serves no book by strike for a past minute` (Oct 12); `Unusual Whales' book, 6:55 am: −$912M` (today, the model −$1.0B) | StrikeChart:5309 `measuredAt` | — | pass |
| 31 | Ladder rows on screen | 3 of 60 (`▲ 29 / ▼ 28`) | ProfilePanel rows at `p.yFor(strike)` on the chart's price scale, which now fits a $4 candle range | enough strikes to read — the house's own pane shows about eleven | **FAIL** (a consequence of 13) |
| 32 | Ladder key | `puts amplify · calls absorb · — the spine now · -- at the open · ■ supreme` | ProfilePanel:807 — `at the open` is drawn whatever the data; the ghost itself only when `openRatio` has today's 9:30 column (levels.ts:1187 `feedOpenRatio`). Before today's first 9:30 column (the owner's after-hours screenshot) there is no ghost and the key still names it | the key names what is drawn | **FAIL — item 4** |
| 33 | Column heads | `STRIKE · Δ SPOT · ◂ PUTS · CALLS ▸ · NET` | ProfilePanel | — | pass |
| 34 | Rows: strike, Δ spot | `779 +0.09%`, `778 −0.04%`, `777 −0.17%` | Δ = (strike − levels.spot) / levels.spot, levels.spot = the book's price | Δ from the one current price | **FAIL — item 1** (figures right against the book's price) |
| 35 | Rows: legs and net | `$885M ▮ $1.8B −$941M` etc. | `feedRail` legs = the book's put/call gamma in the house's sign; net their sum | the book at 13:54Z: 779 puts +$883M, calls −$1.8B, net −$917M; 778 +$1.4B/−$1.9B/−$493M; 777 +$1.7B/−$1.1B/+$626M — within the poll | pass |
| 36 | Spot band | `778.29` | ProfilePanel:611 `levels.spot` (the book's price) | the one current price | **FAIL — item 1** |
| 37 | Flip rule | `flip 777.50` | Terrain.tsx:285 `pickFlip(rows, spot)` — the midpoint between 777 (+) and 778 (−) | where the spine crosses zero: 777.56 on this book (777.12 on the owner's) | **FAIL — item 2** |
| 38 | The spine and its ghost | solid; dashed (today) | ProfilePanel:1223 — a spline through each row's net; the ghost the 9:30 column's ratio | — | pass |
| 39 | Ladder foot | `hover a strike · click to keep it` | ProfilePanel:1702 | — | pass |
| 40 | How sure: assumption, freshness | `… figured by Unusual Whales at 777.88, 6:58 am PDT` | levels.ts:431 `feedFreshness` — the book's own price and time | — | pass (this is where the book's price belongs) |
| 41 | How sure: the field | `… differs from Unusual Whales' book by 9.1% of the book's size (median of 12 books read today); against their whole-book figure … same sign 13% of 8 sampled minutes, at −1.99× its size` | trailField.ts `fieldResidual`: the first against the per-strike books read (like for like); the second against UW `/spot-exposures` — UW's WHOLE book, every expiry and strike (at 14:00Z +$0.74B in UW's sign), while the model sums 60 days within 15% (−$4.4B house sign over 745–812 alone): different books, so the sign test reads as the model being wrong | a comparison on the same strikes | **FAIL** |
| 42 | Desk bar | `1 2 3 4 · STRIKES · Colours Thermal · $ % ATR σ · LAYOUTS · RTH` | Terrain.tsx; `RTH` from calendar.ts `futuresPhaseAt` | — | pass |
| 43 | Hover readout | `O 777.72 H 777.92 L 777.66 C 777.78 V 285.2K` | StrikeChart T-8 on the 12:35 pm Oct 12 bar | — | pass |
| 44 | Crosshair labels | `Oct 12, 12:35 pm` · `777.78` | chartTime `fmtStampLocal`; the library | — | pass |

**The disk question.** Between 05:33 and 06:02 UTC on 2026-10-13 (1:33–2:02 am ET; the pushes `55a0055` → `33b15f7`)
the producers of a print's `time` wrote the reader's text ("2:50 pm") instead of New York's "14:50". What writes to
disk: the server's recorder (`.feed-cache/field/*/books.jsonl, chain.jsonl, seed.json, total.json`) and the backfill
(`past.json.gz`) keep epoch milliseconds only — no clock text; grepped, no `am`/`pm` text in any of them. The
backtest's real days, Paper's fills and the alert log keep epoch numbers. The one store that keeps a print's `time`
text is the browser's tracked prints (`localStorage slayer_trace_watch`, WatchContext `watchPrint`). On this machine
the browsers were throwaway Playwright contexts — nothing kept. On the owner's machine a print tracked in that window
on a build from those commits would hold "2:50:12 pm"; the market was shut and the window was in the small hours, so
it is unlikely any was. A load-time repair is added anyway (below).

## Step 4 — the fixes

Every fail above is fixed in the same push; the page was shot again live at 7:53 am PDT (10:53 New York) on the same
desk (`after/01-now.png`, the hovers, the 2× plot and ladder, How sure, the Oct 12 session). The after-hours shot, for
item 1, is `after-close/` (taken after 4:00 pm New York; the row below is filled from it).

**What changed, by item.**

- **Item 1 — one price.** The pane head, the ladder's Δ spot and spot band and the chart's last-price capsule now print
  the rail's own price: the stock-state's `close`, ONE poll a name (price.ts `useFeedPrice`; Terrain `fQuote` →
  `feedRail(…, liveSpot)`; StrikeChart `quote`). The book's price — the one UW figured the hedging at, frozen at the close
  after hours — stands only in How sure ("figured by Unusual Whales at 776.95, 7:55 am PDT"), where it belongs. The second
  state poll (row 6) is gone: `useFeedDayState` reads price.ts's key.
- **Item 2 — the flip.** `pickFlip` (core/walls.ts) is the linear zero crossing between the two strikes of opposite sign
  (`zeroCrossings`, to the cent), never their midpoint, and the ladder's spine passes through it (ProfilePanel adds the
  flip as a point of the spline); the columns' flip ticks and the card's "crossings near" are the same crossings.
- **Item 3 — staleness.** A cell carries `freshAt` (the newest vol in use) and `staleShare` (the share of the strike's
  gamma on a vol older than an hour); the card says "Vols as traded to 7:40 am · every vol within the hour", or "… ·
  17.6% of the strike's gamma on a vol older than an hour (oldest 8:28 am)". A carried cell keeps "from prints at or
  before 16:15".
- **Item 4 — the key.** "at the open" is drawn only with the ghost (ProfilePanel `hasGhost`).
- **Item 5 — the day ticks.** `localCalendarBehavior` (chartTime.ts) re-weights the library's tick marks by the viewer's
  calendar, so a day tick is the first bar of the viewer's day: "13" stands at the 1:00 am PDT bar (the first after the
  overnight gap), and after 8 pm New York no bar wears the ending day's number.
- **Item 6 — the card.** "Change since the open (6:30 am): −$647K".
- **Row 15 — the countdown** counts to the bar's end on the 5m grid (`barCountdown 'grid'` on the feed): 01:18 → 01:03 →
  00:48 → 00:33 at 15 s apart.
- **Row 19 — the chips** clamp under the chrome band and stack when they would overlap: "CW 780 → 785 · 9:25 am" (its wall
  under the band, so it stands at the top of the plot), "CW 785 → 780 · 8:45 am" and "· 1:00 am" one above the other.
- **Row 31 — the ladder** shows eleven strikes (773–783; the axis 772.00–785.00): the candle fit never narrower than
  eight strike steps (StrikeChart `fitCandles={8 * step}`), the owner's floor.
- **Row 41 — the residual, like for like.** The recorder reads UW's book on the model's own universe every five minutes
  (`/spot-exposures/expiry-strike`, the chain's 16 expiries within 60 days — Oct 13 to Nov 30 — the strikes within 15%,
  summed per strike; `books60.jsonl`, levels.ts `FeedBook60`), and `fieldResidual` measures the field against it over
  the strikes both hold, strike by strike and summed. The whole-book series is no longer measured against anything.
  **The sign-flip check**: UW's whole-book `gamma_per_one_percent_move_oi` equals the sum of its per-strike book
  (−0.730 B both, UW's sign, 2026-10-13 14:00Z), and the house negates both — no flip was missing; the old line
  compared the model's 60 days within 15% with UW's every expiry and every strike. The corrected figures, from the live
  page (`__slayerTrail.figures('SPY')`):

  | UW's 60-day book read at | strikes both hold | model, summed | UW, summed | Σ\|UW\| | per-strike gap | sign | model ÷ UW |
  |---|---|---|---|---|---|---|---|
  | 10:40:28 New York | 60 | −$4.05B | −$1.86B | $19.4B | 11.4% | same | 2.18× |
  | 10:46:25 | 60 | −$3.54B | −$2.45B | $19.5B | 6.3% | same | 1.44× |
  | 10:51:28 | 60 | −$3.02B | −$1.80B | $19.4B | 6.7% | same | 1.68× |

  The line now reads: "Against Unusual Whales' book on the same strikes and expiries (within 60 days, 3 books read
  today): strike by strike it differs by 6.7% of the book's size at the median; summed over those strikes it has the
  same sign in 3 of 3, at 1.68× the book's size at the median." The per-strike gap is 6–11% of the book's absolute
  size; the summed net is the model's being more negative than UW's across the 60 strikes (a residual of the model,
  stated, never calibrated away). The hover's measured line names its universe: "Unusual Whales' book (60 days), 7:40
  am: −$1.5B" against the model's −$1.8B at 780, or "(every expiry)" when no 60-day book was read within ten minutes.
- **The disk question's repair.** A tracked print whose `time` is a printed 12-hour text is put back to New York's text
  on load (WatchContext `nyTextFromPrinted`), its key rebuilt.
- **Also found while re-shooting:** the trail chip said nothing while the page was still taking the earlier sessions in
  (the server had them built; the page was fetching and modeling them), so a first shot stood without Oct 12's beads.
  The chip now counts the sessions the page has taken in (levels.ts `useServerPastSessions`).

### The table, after the fixes (live, 7:53 am PDT)

| # | Element | Value shown | Source | What it should be | Pass/fail |
|---|---|---|---|---|---|
| 1 | Rail name, price, change | `SPY $777.00 −0.14%` | `useFeedPrice` (price.ts), the state's `close`, 10 s | the latest trade | pass |
| 2 | Rail session strip | `Morning · lunch in 37m` | SessionStrip | — | pass |
| 3 | Rail clock | `7:53:41 am PDT` | `clock()` | the viewer's clock with its zone | pass |
| 4 | Signature | `slayer:~ $ ● live` | marketState.ts | — | pass |
| 5 | Pane head price | `$777.00` | Terrain `fQuote` → `feedRail(…, liveSpot)` — the rail's price | the same current price as the rail and the capsule | **pass** (was fail, item 1) |
| 6 | Pane head change | `−0.14%` | the same poll as the rail (`useFeedDayState` → price.ts) | one poll | **pass** (was fail) |
| 7 | Timeframe tabs and trends | `1m ▼ 5m ▼ 15m ▼ 1h ▼ 1D ▬` | the strip | — | pass |
| 8 | Heaviest | `785 −$1.6B · 780 −$1.5B · 772 $1.2B` | `heaviest(rail.core, 3)` | the book at 14:51Z: 785 −$1.6B, 780 −$1.5B, 772 +$1.2B | pass |
| 9 | Amplifies/absorbs key | `+ amplifies · − absorbs` | Terrain.tsx | — | pass |
| 10 | Bead scale | `Bead light: √(size ÷ this session's 85th-percentile peak so far)` | `BEAD_SCALE` | — | pass |
| 11 | Overlays badge | `⧉ 2` | ChartToolbar | — | pass |
| 12 | Candles, volume | — | `uwOhlc` 1m → 5m | — | pass |
| 13 | Price axis | `772.00 … 785.00` | `fitCandles={8 * step}`: the candles 776.5–779.1 widened to eight strikes, then the library's margins | fits the candles, never under eight strikes | pass |
| 14 | Last-price capsule | `777.00` | StrikeChart `quote` (the rail's price) | the same price as the rail and the head | **pass** (was fail, item 1) |
| 15 | Capsule countdown | `01:18 → 01:03 → 00:48 → 00:33` (15 s apart) | `barCountdown 'grid'`: the bar's end on the 5m grid | time to the bar's end | **pass** (was fail) |
| 16 | Time axis | `11:00 am · 2:00 pm · 13 · 3:00 am · 5:00 am · 8:00 am` | chartTime `tickMarks` + `localCalendarBehavior` | the reader's clock | pass |
| 17 | The day tick `13` | at the 1:00 am PDT bar — the first bar of the viewer's Oct 13 (the overnight gap holds midnight) | `localCalendarBehavior` re-weights day ticks by the viewer's calendar | a day tick at the viewer's midnight, labelled with the day beginning | **pass** (was fail, item 5); the 8 pm case is checked in `after-close/` |
| 18 | Wall-move chips | `CW 780 → 785 · 9:25 am`, `CW 785 → 780 · 8:45 am`, `CW 785 → 780 · 1:00 am` | gexNodesPrimitive, the column's call wall held three columns | — | pass (the 1:00 am one is a modeled re-pricing on the pre-market price; by design) |
| 19 | Wall-move chip placement | clear of the tabs: the 785 chip at the top of the plot under the band, the two 780 chips one above the other | the chips clamp under the chrome and stack | clear of the head's chrome | **pass** (was fail) |
| 20 | Strength chip | `785 · 8%` | the newest column's heaviest strike | the Heaviest row's 785 | pass |
| 21 | Beads | Oct 12's session and today's, 4,223 columns | trailField `modelColumn`; the earlier sessions from the server | — | pass |
| 22 | Column flip ticks | dashed ticks at the crossing | `pickFlip` = the linear zero crossing | the price where the net crosses zero | **pass** (was fail, item 2) |
| 23 | Card: strike and time | `780 · 7:40 am PDT` | `nyClockOf(time, {zone})` | — | pass |
| 24 | Card: what it is | `Estimated dealer gamma (assumed sign)` / `Today's opening positions re-priced …` | StrikeChart | — | pass |
| 25 | Card: value and share | `−$1.8B · 8.8% of the book` | `beadAt` | — | pass |
| 26 | Card: since the open | `Change since the open (6:30 am): −$647K` | `value − open`, said as a change | a change, named | **pass** (was fail, item 6) |
| 27 | Card: flip and crossings | `Flip 777.47 · crossings near 775.52, 774.84` | `zeroCrossings` on the column | the interpolated crossings | **pass** (was fail, item 2) |
| 28 | Card: provenance | `Modeled · vols read today` | `prov` | — | pass |
| 29 | Card: staleness | `Vols as traded to 7:40 am · every vol within the hour`; Oct 12's 780 at 12:00 pm: `Vols as traded to 12:01 pm · 17.6% of the strike's gamma on a vol older than an hour (oldest 8:28 am)` | `freshAt`, `staleShare`, `staleSince` | the newest vol in use and how much stands on an old one | **pass** (was fail, item 3) |
| 30 | Card: the measured reference | `Unusual Whales' book (60 days), 7:40 am: −$1.5B` (the model −$1.8B); `(every expiry)` when no 60-day book is within ten minutes; `serves no book by strike for a past minute` (Oct 12) | `measuredAt` with its universe | named by universe | pass |
| 31 | Ladder rows on screen | 11 of 60 (773–783; `▲ 24 / ▼ 25`) | the rows on the chart's scale, now eight strikes at least | enough strikes to read | **pass** (was fail) |
| 32 | Ladder key | `puts amplify · calls absorb · — the spine now · -- at the open · ■ supreme`, the ghost drawn | `hasGhost` | the key names what is drawn | **pass** (was fail, item 4) |
| 33 | Column heads | `STRIKE · Δ SPOT · ◂ PUTS · CALLS ▸ · NET` | ProfilePanel | — | pass |
| 34 | Rows: strike, Δ spot | `780 +0.39%`, `778 +0.13%`, `777 0.00%` | Δ from the rail's price (777.00) | Δ from the one current price | **pass** (was fail, item 1) |
| 35 | Rows: legs and net | `780 $1.0B ▮ $2.5B −$1.5B`, `778 $1.6B ▮ $2.2B −$550M`, `777 $2.2B ▮ $1.4B $829M` | the book's legs in the house's sign | the book at 14:51Z | pass |
| 36 | Spot band | `777.00` | `levels.spot` = the rail's price | the one current price | **pass** (was fail, item 1) |
| 37 | Flip rule | `flip 777.60` | `pickFlip(rows, spot)` — the linear crossing between 778 (−$550M) and 777 (+$829M): 777 + 829/(829+550) = 777.60 | where the spine crosses zero | **pass** (was fail, item 2) |
| 38 | The spine and its ghost | solid through the flip; the ghost dashed | ProfilePanel | — | pass |
| 39 | Ladder foot | `hover a strike · click to keep it` | ProfilePanel | — | pass |
| 40 | How sure: assumption, freshness | `… figured by Unusual Whales at 776.95, 7:55 am PDT` | `feedFreshness` — the book's own price and time | — | pass |
| 41 | How sure: the field | `Against Unusual Whales' book on the same strikes and expiries (within 60 days, 3 books read today): strike by strike it differs by 6.7% of the book's size at the median; summed over those strikes it has the same sign in 3 of 3, at 1.68× the book's size at the median.` | `fieldResidual` on the 60-day books (the table above) | a comparison on the same strikes and expiries | **pass** (was fail) |
| 42 | Desk bar | `1 2 3 4 · STRIKES · Colours Thermal · $ % ATR σ · LAYOUTS · RTH` | Terrain.tsx | — | pass |
| 43 | Hover readout | `O 778.19 H 778.44 L 778.19 C 778.44 V 2.3K` | StrikeChart T-8 | — | pass |
| 44 | Crosshair labels | `Oct 13, 1:25 am` · `778.44` | chartTime `fmtStampLocal` | — | pass |

**The structural check** (keys in against keys blanked, `terrain-struct.mjs`, SPY and SPX, one and two panes, every
menu): the same buttons, menus, canvases and marks on both, but for what the rule allows — the 15 s bar listed and
disabled with the keys in (no plan carries seconds), the SPX pane's "bars not in the feed" mark, and the trend
labels' words (above / below / between its EMA21 and VWAP — the data, not the page). No panel hidden, no control
dropped.

### After hours

Taken after 4:00 pm New York the same day (the market shut, the book's price frozen at the close): `after-close/` — the
row is written there once taken.
