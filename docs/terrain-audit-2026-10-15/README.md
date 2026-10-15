# Round 3 — 2026-10-15

Your message of 2026-10-15: items 1–5, then the full Terrain audit (item 6), then Section I. This file is the report.
Every figure says its sample. Times are New York's unless said.

## 1 · The price axis after a drag back

**Cause.** The chart switched autoscale off on the first press or wheel anywhere on the plot (a rule from 2026-08-30 for
"this thing thats fighting my cursor"), so a drag back a day carried today's range over a day whose candles stood
elsewhere.

**Fix** (0740780). A pan and a wheel move time alone; the scale fits whatever candles they bring into view, as
TradingView's does. The price is yours only when you take it: a drag on the price axis (the chart library's own rule),
kept through every tick until a double-click, the Reset pill or a new name/timeframe. StrikeChart draws every room's
chart, so Pulse, the four charts, Paper, the Backtest and the Weigher behave the same.

| SPY, 1 minute, Oct 14 | candles in view | price axis | autoscale |
|---|---|---|---|
| before: dragged back a day | 777.54–779.87 | 764.86–772.86 | off |
| after: dragged back a day | 777.54–779.87 | 774.71–782.71 | on |
| after: then a wheel out | 777.28–779.95 | 774.62–782.62 | on |
| after: then a drag on the price axis | 777.28–779.95 | 774.09–783.14, held 3 s through ticks | off (yours) |
| after: double-click | today's 766.71–769.60 | 764.15–772.15 | on |

Test: `npm run terrain:check` (scripts/terrain-ui-proof.mjs, "axis"): fails on the old code (axis 764.84–772.84, off),
passes on the fix. Shots: shots/item1-before-drag-back-1m.png, shots/item1-after-drag-back-1m.png.

**For your approval:** three other charts keep the old rule on purpose (set on an earlier explicit request, "only on
first open/load... after that its on the user"): Trace's Net Flow pane, Compass's campaign chart and the Weigher's
contract premium pane (NetFlowPane.tsx, CampaignAnalysis.tsx, ContractPremiumPane.tsx). Say if they should follow
TradingView too.

## 2 · SPXW was being dropped — what used that filter, and what changed

**The filter** was one line in the field's universe (data/feed/trailModel.ts `universeOf`): a contract was kept only
when its root was the name's own, so SPX's field held its AM monthlies and no SPXW contract. It was fixed in 0b9877e,
but the model's version was not bumped, so work written before and after carried the same stamp. Tracing every reader
found two more errors in the same universe, both only visible now that SPX is drawn:

- every contract was taken to settle at 4:00 pm, so on a third Friday SPX's AM monthly (settled at the open) stayed in
  the field all day;
- a straddle at an expiry both roots list took whichever contract came last;
- and the Theta rebuild keyed SPXW's contracts under SPX's symbol (to pass the filter), which on a third Friday made the
  AM monthly and the PM weekly of one strike a single contract.

**What stored data went through it** (a8c84c4):

| stored | through the filter? | here | on your machine |
|---|---|---|---|
| store final rows (final.jsonl) | yes, for an index | none for SPX | only if RECORD_NAMES or BACKFILL_NAMES had SPX, or a pane asked — before 0b9877e the page never asked the server for an index's field (`!isCashIndex`) |
| store shown rows | yes, for an index | none for SPX | same; kept as the record of what was drawn, never rewritten |
| backfill inputs (past.json.gz) | no — raw inputs keep every root | — | — |
| tiles | yes, built by the model | none for SPX | rebuilt automatically (version) |
| Theta rebuild (theta-final.jsonl) | folded, not dropped — the third-Friday merge | none | rebuilt on the next `npm run theta:rebuild -- SPX` (version) |
| residual vs UW (How sure) | computed live, nothing stored | — | — |
| scorecard and its hold-out | read the final rows | SPX has none | the loader now rebuilds an index's pre-.6 session from its inputs; the hold-out is evaluated again and says so |
| scale.json, regime.json, recaps | built from the rows | SPX's scale.json (empty) | rebuilt on the next read / nightly |
| level alerts | live off the field the page drew | — | the page drew no SPX field before 0b9877e |
| UW's own series (series.json) | never filtered | SPY 7, QQQ 7, SPX 4 days | — |

**The fix.** Model .6: the weekly root under its index; AM-settled roots (SPX, NDX, RUT, VIX, VIXW) end at the expiry
date's 9:30 am; a straddle reads the PM root; a Saturday-dated monthly (OCC before February 2015) is its Friday. Theta
rebuild .2: each contract under its own root. Anything an older model wrote for an index (or for any day to 2017-01-21)
is not read; SPY's and QQQ's work stands as it was, so nothing of theirs is rebuilt. **On your machine**: `npm run
field:reindex` lists what an older model wrote wrong; `npm run field:reindex -- --rebuild` rewrites the final rows (the
old file kept beside).

**What changed, on real data** (SPX's chain as the recorder read it at 11:11 pm Oct 14, a column at UW's book price 7,715):

| | contracts | flip | net | heaviest strike | walls |
|---|---|---|---|---|---|
| old filter (SPX root alone) | 1,240 | 7,724.56 | 7.58B | 7,700 at 3.30B | 7,800 / 7,700 |
| fixed (SPX with SPXW) | 8,728 | 7,776.34 | 47.68B | 7,700 at 7.72B | 7,800 / 7,700 |
| third Friday at 2:00 pm, AM ending at 4:00 pm (.5's rule) | 638 settled AM still in | 7,776.71 | 46.47B | 7,700 at 11.06B | put wall 7,700 |
| third Friday at 2:00 pm, fixed | settled AM out | 7,776.72 | 37.73B | 7,725 at 5.59B | put wall 7,725 |

Tests: scripts/index-roots-proof.ts (20 checks, in `npm test`); the Theta rebuild proof now asserts the two roots stay
two contracts.

## 3 · The downloader's concurrency

3 in flight 6:00 am–5:00 pm New York (weekdays), 7 at all other times (0f43370); Theta's nightly gap (00:00–01:45) still
starts nothing. Edges checked: 5:59 am 7 · 6:00 am 3 · 4:59 pm 3 · 5:00 pm 7 · 1:00 am 0 · a Saturday 7. **Found on the
way**: the downloader's proof drove the real clock, so between midnight and 1:45 am it waited for the gap to end (it hung
the suite tonight); it now holds its own clock.

## 4 · The four answers

**Where they were answered.** A3, B1 and B5 are in docs/terrain-build-2026-10-14/README.md, section "The owner's three
points", part "3 · the four answers" (committed 2026-10-15 with 0f43370's round). In short, with what this round adds:

**A3 — the phone's "Maximum update depth exceeded": not reproduced, and not closed.** 14 runs then (390 × 844, 375 × 667,
430 × 932, 360 × 780, the CPU slowed 4×), and this round three more on commit 521d7de (scripts/_tmp/phone-stress.mjs:
390 × 844, 375 × 667 and 430 × 932 on a touch screen, the CPU slowed 4×, two minutes each — the ladder's peek and its
close, the decision boxes, the window and jump menus, Back to live, the viewport turned and back, drags on the chart;
280 steps): 0 page errors, 0 "Maximum update depth", the trap empty. The development trap writes what it
catches to .feed-cache/depth-trap.ndjson on the machine serving the page and puts a banner at the page's foot, because a
phone has no console. If it comes back on your phone, that file names the component and the pane's state.

**B1 — the cause of each blank in your three panes:** the table in that section (SPY and QQQ before "14": the server's
rebuild queue, ten sessions a name, one at a time; QQQ's newest candles: the live minute has no column yet; AAPL: not in
RECORD_NAMES, so its minutes before the first page asked were never recorded). Each now says so on the chart.

**B5 — UW's per-minute spot exposures: it runs only inside the always-on recorder** (`npm run feed:recorder`, since
121ecef, 2026-10-14 7:32 pm UTC), thirty seconds after it starts and at 5:15 pm New York. Stored in this workspace (the
recorder here is not the always-on one): SPY 7 sessions (Oct 5 to Oct 13), QQQ 7 (Oct 5 to Oct 13), SPX 4 (Oct 8 to
Oct 13). Your machine's count: `curl http://127.0.0.1:5190/feed/series` (sessions with rows, empty dates, oldest,
newest, where the walk is). A full pass is about 520 sessions a name, about an hour for the three.

**"rebuilt · no column at these minutes" — which minutes, and why.** Seen once, on QQQ at 15 minutes over the regular
sessions of Oct 12 to 14, while the server was writing QQQ's tiles again after the tile format changed (the tiles were
rewritten 4:42:46 to 4:44:52 am UTC): the page held a day the server listed as tiled whose new tile had not landed, so
it said "rebuilt" over minutes that were mid-rewrite. On disk afterwards, 0 regular-hours tile bars lack a column (SPY,
QQQ, AAPL, every timeframe). **The sweep after** (scripts/_tmp/gap-sweep.mjs, kept beside this report as
gaps-2026-10-15.json): SPY, QQQ and AAPL × 1m, 5m, 15m, 1h × all four windows, zoomed out over every session loaded —
852 labelled gaps, every one "outside regular hours · the field is 6:30 am to 1:00 pm" (your clock), and **0 "rebuilt ·
no column"**. **Found by the sweep, and fixed** (2bb97d5): AAPL lists no contract settling on a Tuesday or a Thursday,
so its 0DTE window's columns those days held no strike — 78 of 78 columns empty on Oct 6, 8 and 13 — and the chart was
blank with no words. Now: "no AAPL expiry settles this day · the 0DTE window is empty". Check: `npm run terrain:check
-- --only=gaps` (fails on the old code: 78 empty bars unlabelled).

## 5 · SPX's first recorded night: wide quotes

Built: `npm run spx:widths` (793c0b5), run on the always-on machine after a night the recorder read through Theta. It
reads only the recorder's files and writes docs/spx-overnight/<D>/widths.md: every overnight quote's width in vol within
5% of the forward (γ×OI weighted and plain; p50/p90/p95/p99; the share over 1, 2, 3, 5 points; by hour) and the share of
the field's overnight cells the 2-point cutoff marks stale (by count and by gross gamma, by hour, and were the cutoff 1,
3 or 5 points), beside the after-curb snapshot the cutoff came from. **No numbers here yet**: this workspace has no
Theta terminal, so it has recorded no night. **Found on the way**: with no seed file the overnight minutes from 8:15 pm to
midnight had no open interest (the prior count was dated from the trading day's midnight); fixed and tested.

## 6a–6b · The inventory and the table

Four read-only inventories (area A the header, toolbar, desk bar and keys; B the chart surface; C the panels and states;
D the indicators and Pine) listed every control, menu option, setting, key, chip, label, card, panel, state and layout
from the source. Three recorded browser runs then exercised every item that a browser can (Playwright, Chromium, at
1440 × 900 unless a row says otherwise, commit 521d7de, 3–4 am New York with the market shut, a shared 4-core machine —
every time is an upper bound): **area A 257 items, 236 pass, 17 fail, 4 manual; area B 144 rows, 107 pass, 16 fail, 21
manual; area C 90 items, 74 pass, 14 fail, 2 manual.** Every fail that was a bug is fixed (da5b42f, 9115af0, 646b2ff)
and each fix has a check in `npm run terrain:check` (scripts/terrain-ui-proof.mjs — 47 checks, 47 of 47 passing in one full run at this commit) or a
unit proof in `npm test`.
**The full table, one row per item, is [TABLE.md](TABLE.md)**; the runs' own rows, observations and timings are in
[exercise/](exercise/) (area-a.md, area-b.md, area-c.md) with their scripts in scripts/terrain-exercise/.

**The after-run** — the same three scripts run again on the fixed code, bcdb2f0, on this machine
([BEFORE-AFTER.md](BEFORE-AFTER.md), every row that changed and 38 pairs of pictures; the rows in
[exercise-after/](exercise-after/)):

| area | before, 521d7de: pass / fail / manual | after, bcdb2f0: pass / fail / manual |
|---|---|---|
| A · header, toolbar, desk bar, keys (257) | 236 / 17 / 4 | 251 / 2 / 4 |
| B · the chart, indicators, Pine (144) | 107 / 16 / 21 | 122 / 1 / 21 |
| C · panels, states, layouts (90) | 74 / 14 / 2 | 86 / 2 / 2 |

The five fails left: A-47 (data: this machine's hourly tiles stop short of a month), A-168 (by design: "Replay this day"
is disabled, with its reason, for a day whose minutes the chart does not hold — proposal 16), B-41 (yours: the Key levels
switch, 6j item 6), and 6c-1m and 6c-5m (yours: the ladder's source, 6j item 1). The after-run also found five things
the first runs had not, all fixed in bcdb2f0 or this commit, each with a check that fails on the old code: the level
card never took the keys (the house focus trap's one try), the house popover card's dialog had no name, the priced
move's readout ran off the plot's edge in a session, a layout's delete × did not show on every focus, and the phone's
ladder, laid over the chart, had no ground of its own (the candles showed through).

## 6c · The Strikes tab against the chart — they do not match, and why

**The Strikes tab is the ladder.** The desk bar's Strikes button shows or hides the ladder beside every chart; there is
no separate table, so there are no columns to sort or filter. Its controls — the Expiry card (desk-wide), Lanes, Net |
Sides, Vol, the Colours menu, the width grip and the lane sash — are all exercised (TABLE.md, area C); the grip and the
sash no longer pin a strike after a drag (9115af0).

**The numbers do not match.** SPY, the ten strikes round the price, read at night (area C's run): the ladder against the
chart's newest field column agree on the **sign at 10 of 10** strikes and on the **size within 1% at 0 of 10** (1m) and
**1 of 10** (5m). Split by cause on the recorder's stored reads of Oct 14, all at 3:34 pm where both exist:

| strike | UW every expiry | UW 60 days | universe | field | model (UW 60d ÷ field) | field 3:59 pm | ladder now (UW, 4:15 pm) | ladder ÷ field 3:59 |
|---|---|---|---|---|---|---|---|---|
| 771 | $917M | $918M | 1.00× | $1.03B | 0.89× | $193M | $885M | 4.58× |
| 770 | $2.13B | $2.13B | 1.00× | $2.42B | 0.88× | $2.67B | $2.29B | 0.86× |
| 769 | $1.15B | $1.15B | 1.00× | $1.27B | 0.90× | $377M | $1.43B | 3.80× |
| 768 | $1.12B | $1.11B | 1.00× | $1.00B | 1.11× | $502M | $1.23B | 2.44× |
| 767 | $566M | $560M | 1.01× | $419M | 1.34× | $335M | $547M | 1.63× |
| 765 | $1.46B | $1.42B | 1.03× | $1.24B | 1.14× | $1.24B | $1.46B | 1.18× |
| 763 | $301M | $295M | 1.02× | $259M | 1.14× | $258M | $301M | 1.17× |

1. **Time — most of the gap near the money.** The ladder holds Unusual Whales' book as UW last figured it (4:15 pm,
   after the bell); the field's newest column is the 3:59 pm minute. The field reprices today's expiring contracts on the
   minute's clock, so in the last half hour their gamma leaves the strikes beside the money (771: $1.03B at 3:34 pm,
   $193M at 3:59 pm), while UW's figure barely moved ($917M → $885M).
2. **Model — −12% to +44% a strike** at the same minute: UW sums its own per-contract gamma; the field prices each
   contract at one spot and clock (How sure's "Model agreement" states this residual).
3. **Universe — 3% or less.** The ladder reads UW's every-expiry book under an Expiry card that says "All 60 days"; the
   expiries past 60 days carry almost no gamma near the money. It makes the label untrue, not the figures different.
4. On 5m and longer the field's cell is the bar's **peak** minute (769 reads $4.4B at 5m, $377M at 1m).

**What I recommend — your decision, since it changes what the ladder shows.** The ladder reads the field's column at the
minute the chart shows (the newest, the cursor's in a replay), so one strike reads one number on both surfaces, and Unusual
Whales' figure stands beside it — in the read line, the hover card and How sure — as the measured reference. That also
makes "All 60 days" true for both. The other way (the field moved onto UW's figures) would be a calibration, which the
model's rules forbid. Until you choose, the ladder stays UW's book; it is item 1 on the approval list (6j).

## 6d · Indicators

**Built-ins** (the Indicators menu; no settings — the periods are fixed): EMA 9, EMA 21, EMA 50, SMA 200, VWAP and VWAP
bands and Bollinger draw on the price pane; RSI 14, MACD and ATR 14 in a pane of their own. Draw time after a toggle
(area B, 1,000 bars): 3–25 ms. Since 521d7de an overlay never widens the fitted axis, a sub-pane is added after the
regime and flow panes (two own panes at most; a third is refused with words), and on a paper tape each ink is its light
pair. **Shipped Pine scripts** (23; the library's): draw 7–113 ms, engine 1.5–80 ms (Ichimoku the slowest); their
overlays no longer widen the fitted axis either (9115af0, check "scripts: an overlay script far off the candles…").

**Clashes, for you** (area B measured the hue distance to the field's pair): EMA 9, SMA 200, RSI, MACD, Moving average,
EMA ribbon, Ichimoku, Keltner, RSI (Pine), MACD (Pine), Stochastic, ATR and Williams %R wear a hue within ΔE 0.15 of the
ovals' gold or violet; "The walls" and "Distance to the walls" use the gold and violet themselves (they name the walls,
which wear that pair — consistent, not a clash). Several share an ink with each other and with the compare lines (EMA 9
with the Pine averages, VWAP with the Pine VWAP, Donchian, MFI). The six Pine scripts that repeat a built-in draw the same
line twice with a different seed (6i). Proposed: the indicator inks off the gold–violet axis and one ink each — item 4
on the approval list.

## 6f · Spacing and proportions — the proposal, waiting for your OK

**There is no spacing or type scale in the global tokens.** src/theme/tokens.css holds colours only (its one size token
is `--tab-rule`); tailwind.config.ts adds two font sizes (`xxs` 11.2 px, `xxxs` 9.6 px) that Terrain never uses — every
size in Terrain is an arbitrary `text-[Npx]`. So, as you asked, here is a scale. **Nothing below is applied yet.**

**What Terrain uses today** (measured over Terrain.tsx, components/terrain/*, ProfilePanel, ChartToolbar, StrikeChart and
the canvas primitives they draw; the full lists with file:line are in the working notes and go in with the fix):

| | in use today | count |
|---|---|---|
| font sizes | 7, 8, 9, 10, 11, 11.5, 12, 13, 13.5, 14, 15, 16, 16.5 px | 13 distinct |
| under the 11 px floor (the house rule since 2026-10-10) | 7, 8, 9, 10 px at 31 sites — 29 of them words (20 on the ladder's canvas, 5 on other canvases, the chart library's labels, the export, 2 inline), 2 allowed as ticks | 29 breaks |
| font weights | 400, 500, 600, 700 (700 in ten places playing 600's role) | 4 |
| spacing values off a 4 px grid | 1, 3, 5, 6, 7, 9, 10, 14, 18, 22, 26, 34, 54, 210, 230 px in classes (307 uses: 6 px ×128, 14 px ×76, 10 px ×56) and 11 more in inline styles and canvas (11, 13, 15, 17, 19.5, 30, 38, 58, 74, 94, 102) | 26 distinct |
| control heights in the one 32 px header row | 16, 18, 20, 22, 24, 24.5 px | 6 |
| icon sizes | 10, 12, 14 px (lucide), header mixes 12 and 14 | 3 |
| tracked capitals | 30 sites (`uppercase tracking-wider/widest`) beside a sentence-case majority | 30 |
| line heights | the preflight 1.5 under every `text-[Npx]`: an 11 px word in a 16.5 px box, so padded controls land on half pixels (24.5, 28.5, 20.5) | — |

**The proposal** (tokens in tokens.css, names in tailwind.config.ts, one sweep of Terrain and the components it draws):

| token | value | for |
|---|---|---|
| `--fs-tick` / `text-tick` | 10 px, line 12 | chart axis ticks only (the house's one exception) |
| `--fs-label` / `text-label` | 11 px, line 16 | every label, chip, menu row, table figure, canvas word (the floor) |
| `--fs-body` / `text-body` | 12 px, line 16 | card body text |
| `--fs-strong` / `text-strong` | 13 px, line 20 | the price, a card's lead figure |
| `--fs-head` / `text-head` | 15 px, line 20 | card and panel heads |
| `--fs-display` / `text-display` | 20 px, line 24 | the expanded pane's price (none today; kept for one) |
| weights | 400 regular, 500 for a role word, 600 for heads and the active state; 700 goes | 3 |
| spacing | 4 px grid: 0, 4, 8, 12, 16, 24, 32; 2 px only inside a control under 20 px; 1 px hairlines | — |
| control heights | 16 (inline chip in a row), 20 (dense control), 24 (button, pill, tab), 32 (the header row, menu rows); every one a whole pixel; a coarse pointer gets its 44 px `.hit` box as today | 4 |
| icons | 12 px in a row, 16 px in a menu or a 32 px button | 2 |
| capitals | sentence case everywhere in Terrain, no tracking (the shell head and the grid heads already are) | — |

**What changes on screen.** The 29 sub-11 px words go to 11 (the ladder's 9 px figures are the most of them: the thin
ladder on three and four panes then prints figures only from a ~20 px row pitch, the hover card carrying them below
that); 6 px gaps become 4 or 8, 10 px paddings 8 or 12, 14 px icons 12 or 16; the header row's six heights become two
(20 and 24). I fix the floor breaks in the same sweep rather than twice. **Say OK (or change any row) and I apply it with
before-and-after shots at the same sizes.**

**Proportions, stated and now kept the same in every layout** (these are measurements, not the scale):

| piece | rule | where it was not kept | now |
|---|---|---|---|
| chart vs ladder | the chart keeps at least 60% of a pane; the ladder rests at 520 (one pane, expanded), 340 (two and four), 240 (three) and never passes 40% | two panes: the ladder took 58% of a 590 px pane, the chart ~250 px | fixed (521d7de) |
| Strikes tab | it is the ladder (the desk bar's Strikes shows or hides it), so the same rule | — | — |
| price axis | 92 px when the axis chips stand (`AXIS_CHIPS_SCALE_MIN_WIDTH`), the library's own width otherwise | — | unchanged |
| oval vs row | an oval's height is at most 85% of the strike row pitch (3 px minimum) | — | unchanged; measured in the orbs proof |
| ladder rows vs the chart's strike rows | the ladder draws each row at the chart's own `priceToCoordinate` | — | measured: a pointer on the ladder at the chart's own y for a strike (centre, and ±40% of a row) names that strike in 57 of 60 hovers at 1, 2 and 4 panes; the 3 misses are one strike (766, one pane) on the ladder's lowest drawn row, which named 767 |
| the foot row | the reasons on the left, the way back on the right, Reset a row above | overlapped in 2–4 panes at 1280 and 1440 and on the phone (measured) | fixed, 0 overlaps measured |

## 6g · Load time and memory

**How it is measured.** `npm run terrain:load` (scripts/terrain-load.mjs), one script for this workspace and your machine.
It opens Terrain in Chromium and times, inside the page from the navigation's start, the first frame whose chart says it
holds bars (**candles**) and the first frame whose chart says the field's columns are handed (**ovals** — drawn the next
frame, so at most one frame short). On a desk of several panes every pane's own times are kept; the slowest is the
desk's. **Cold** is a fresh browser profile (nothing cached in the browser; the server's caches as they stand); **warm**
the next opens in the same profile. Memory is Chrome's own counters (JS heap in use, DOM nodes, event listeners) at the
open and every minute for ten minutes, the page live and in view.

**Here** (2026-10-15 09:57 UTC, the built page under `vite preview`, 1 m panes SPY, QQQ, IWM — SPX draws no candles on
this plan — on this container's 4 shared CPUs and 16 GB; [the report](load/terrain-load-202610150934.md)):

| desk | open | candles | ovals | target (1 s / 2 s) |
|---|---|---|---|---|
| 1 pane | cold | 2,238 ms | 2,238 ms | **both over** |
| 1 pane | warm (2 opens) | 744 · 795 ms | 1,228 · 1,224 ms | both met |
| 4 panes | cold | 2,768–3,779 ms | 4,259 ms | **both over** |
| 4 panes | warm (2 opens) | 1,576–3,535 ms | 2,269–3,535 ms | **both over** |

| desk | JS heap, open → minutes 1–10 | DOM nodes | listeners |
|---|---|---|---|
| 1 pane | 93 MB → 125–151 MB (minute 10: 127 MB) | 2,005 at the open, then 1,186–1,209 | 452–547 |
| 4 panes | 226 MB → 222–248 MB (minute 10: 248 MB) | 2,150–2,168 | 625–741 |

**What it says.** One pane opened a second time meets both targets. A first open, and any desk of four, does not: four
panes ask for four names' minutes, books and tiles at once, and the slowest pane is 2–4 s. Memory does not climb over ten
minutes on either desk (the heap moves with the garbage collector, the DOM is flat), so no leak shows in this window; a
longer watch is `--minutes=60`. These are this container's figures — a shared machine — and an upper bound for yours.
**The misses are Section I's work** (I-3: the next panes' data asked ahead, a name swapped without a remount, finished
columns kept as a bitmap), measured again by this script when it lands.

**On your machine** (the dev server on 5173; Playwright's own Chromium on Windows — `npx playwright install chromium`
once):

    npm run terrain:load                                        1 and 4 panes, 3 opens, 10 minutes of memory
    npm run terrain:load -- --url=http://127.0.0.1:4173         the built page (npm run build, then npx vite preview)
    npm run terrain:load -- --minutes=2 --runs=5 --layouts=1    shorter, more opens, one desk

It writes docs/terrain-audit-2026-10-15/load/terrain-load-<time>.md and .json with the machine it ran on.

## 6h · The fixes, each with its check

Every fail that was a bug, by commit. A check is a named check in `npm run terrain:check` (scripts/terrain-ui-proof.mjs,
the browser) or a unit proof in `npm test`.

| commit | fixed | checks |
|---|---|---|
| 2bb97d5 | a replay with an indicator on threw "Cannot update oldest data"; the hover named the wrong node with the rail docked left; the level card opened 56 px off; empty windows (AAPL 0DTE) drew blank columns unlabelled; the Replay door in four panes; the desk's keys (Caps Lock, C with no room, Shift before a pick) | "replay: an indicator on…", "hover:…", "level card:…", "gaps:…", "replay door:…", "keys:…" |
| 521d7de | colour vision (the ovals and the ladder kept the standard pair under blue-orange); the ladder's key named marks it did not draw, the Δ figures wore no direction ink, the card printed "++"; the foot row (Building, stale, Back to live, the peek) overlapped in 2–4 panes and on the phone; indicator panes landed inside the regime pane and widened the fitted axis; a day jump past the minutes held; line alerts were off on the feed | "colour vision:…", "ladder:…", "indicators:…", "jump: a day a week back…"; the looks sweep (0 overlaps) |
| da5b42f | full screen lost the age chip, window, jumps, T and the legend; a script that fails at run left its last lines drawn; a replay before a pick showed two "Back to live"; narrow panes | "full screen:…", "scripts: a script that fails…", "replay: before a bar is picked…" |
| 9115af0 | range jumps (1W, 1M, 6M) and the 1D opening view; Replay this day; the layouts shelf (Esc, delete, undo); the phone ladder, its focus, its guide, the drawing sheet; the hover row over the readout and legends; a pin re-fitting the axis; the regime at night; T on a narrow pane; the rail's minus; − into a held 15 s; the pane chips; the field's words under the candles; the cone tag; the phase words and VPOC under 11 px; script overlays widening the axis; the pick line and note input 56 px off; minute volume missing on tiled sessions; Next session onto a holiday; the Move box's σ with no price; the Net view's sides; a grip drag pinning; the guide's orange and blue | "jump: 1W and 6M…", "1D view:…", "day panel:…", "layouts:…", "phone:…", "hover row:…", "pin:…", "regime at night:…", "T key:…", "rail:…", "pane chips:…", "canvas words:…", "Net view:…", "ladder: a drag of the width grip…", "Move box:…", "scripts: an overlay script far off…", "replay pick:…", "field words:…", "volume:…", "guide:…", "pop-out:…"; terrain-setups-proof (held timeframes), sessions-proof (holidays), alerts-proof (a stopped watch's undo) |
| 646b2ff | **the first trend line after a pick from the drawing sheet was lost (B-59)**: the sheet stands inside the chart's box, so a tap on a tab or tile bubbled to the chart's own click and pinned the oval under it, and that card took the next drag — the chart's click, hover and double-click now act only on the plot itself; **one-off Escape handlers onto the house's layer stack and focus contract** (ui/layers `useOverlay` / `useEscapeLayer`): the toolbar's menus (Overlays, Alerts, Indicators, Candles, Style, Timeframe), the compare and symbol pickers, the drawing sheet and the rail's family lists, the level-alert card and the chart's right-click card — a menu's Esc no longer lets a pinned strike go, the keys go in and come back, and Esc from the alerts' price field closes its menu; the pin's Esc a mode on the stack; the flip's confirmation offers 1 to 5 in both pickers (A-196…A-198: they offered 1–3); the flow lane's figures and the pane's index price on core/format (it printed "$7715.00"); an index on the feed with no quote says it shows the book's price and when; `.hit` on the Vol switch, the ladder's close and the Reset pill; a race that built a session's tiles without volume (two asks for one session's bars at once; tiles format 5) | "drawings: a press in the sheet pins no node, and the first drag after a pick draws", "menus: Esc closes the drawing sheet, the right-click card and the alerts field's menu…", level-alerts-proof (1 to 5, both pickers); and the checks 9115af0's fixes waited for: "ladder: a drag of the lanes' sash pins no strike; the Net view heads its Δ column; a lane name stands only where it fits", "note: the words field opens at the click…", "day panel: no "No modeled column" flash…", orbs-proof (the ladder's terms speak gold and violet) |
| bcdb2f0 | found by running the three exercise areas again: **the house focus trap** (ui/useFocusTrap) tried focus once, so a box placed after its first frame — the right-click level card, hidden until measured — never took the keys; it tries again a frame later, up to ten; **the house popover card** names its dialog (the layouts shelf was an unnamed dialog); **the priced move's readout** ("−1.6σ · 100% of the day's variance used …") was right-aligned to the newest bar, which can stand past the plot's edge — with the clock in a session it ran 22 px off the plot, cut; a named layout's delete × shows on any focus; the exercise scripts' own faults (a Playwright locator click scrolls the page when its first hit test misses, and the next raw-coordinate click then missed; a menu pressed again while it was still closing; stale expectations from 9115af0's deliberate changes) | "level card: the keys go into it; on, then a second right-click on the level offers Stop", "cone readout: in a session (the clock held at 3:30 pm) the words stay inside the plot" (each fails on the old code) |
| this commit | the phone's ladder over the chart stands on the pane's own ground (`bg-panel`) — the after-run's picture showed the candles, ovals and their words through its rows | "phone: the ladder lays over the chart on its own ground, …" (fails on the old code: "ground rgba(0, 0, 0, 0) — see-through") |

**Not bugs.** A-59, A-204, A-227 (that run's expand failed under load; the expand is exercised by "layouts:" and "full
screen:"); A-225 (the Pine door: two dev servers shared one node_modules/.vite cache, CodeMirror loaded twice — it opens
on a clean server); the readout naming only the single-line overlays (by design: a band or a sub-pane's value is in its
own units — D-06…D-10; each pane naming its own value under the crosshair is a proposal on the approval list); 1M
showing four sessions (this machine's hourly tiles hold four). **From the after-run, also not bugs:** A-47 — 1M at one
hour lands right on what the tape holds, and this machine's hourly tiles stop short of a month (a few old sessions, then
nothing before Oct 9 in one probe, Sep 29 in another); "Replay this day" is offered only for a day whose minutes this
chart holds (Oct 14 and Oct 12 of nine days probed) and says why otherwise — proposal 16 below; the dark pool's three
lines labelled "DP $385M · Oct 14" are three crosses of $385M a cent apart (769.2401, 769.2317, 769.2301), not one drawn
three times. **Seen, not fixed:** a click on a day bar at the same instant as Esc (0 ms apart) was lost in 2 of 4 tries; at
50, 150, 300, 500 and 900 ms apart, 4 of 4 each opened the panel; one early probe lost every other click 300 ms after
Esc while the page was still loading its tiles, which a settled page did not repeat.

## 6i · Redundancies and dead code — for your approval (nothing removed)

Each found by reading the code and confirmed with a search; file:line at commit 521d7de's parent unless said. **Keep**
= it earns its place; **merge** = two ways to the same thing become one; **delete** = no reader or no effect.

**Controls that do the same thing**

| what | the same as | proposal | why |
|---|---|---|---|
| Reset pill · double-click · Alt+R · the right-click card's Reset | each other | keep all four | a pill for the mouse, a key, a gesture; one function (`resetView`) behind them |
| "Back to live ›" · the header's "Today" jump | both bring the last bar into view | keep both | "Today" also picks a timeframe and frames the session; "Back to live" keeps the reader's zoom |
| "Key levels" switch (Layers menu) | nothing — it changes no pixel since 121ecef | **delete the row**, or make it hide the wall lines, the flip rule and the axis chips | `setWalls`/`setSupreme` write fields the renderer no longer reads (gexNodesPrimitive.ts `cwStrike`, `pwStrike`, `flipPrice`, `supremeStrike`); `LINE_LEVELS = []` |
| Two level-alert systems: the toolbar's level chips (Call wall, Put wall, Flip, Wall ±2/±4 — gex/alertStore) and the right-click level watches (data/levelAlerts.ts, tiered) | both alert on the same levels | **merge** into the tiered watches, the toolbar's chips arming a watch | two lists, two logs, two cooldown rules for one question |
| The expiry window: the header's chips and the rail's Expiry card | both set the desk's `railCut` | keep both | the header is the quick switch, the card also lists dates; they now agree (a picked date shows in the header) |
| `WINDOW_CHOICES` (Terrain.tsx) and `WINDOW_OPTS` (PaneHead.tsx) | the same three windows with the same words | **merge** into one list | the hints already drifted ("reads" vs "keeps") |
| `REPLAY_PACES` (Terrain.tsx) and `REPLAY_SPEEDS` (data/replayFrame.ts) | the same speeds | **merge** | one list |
| The Strikes button and R / Shift R | show or hide the ladder | keep | button and keys |
| Built-in EMA/VWAP/BB/RSI/MACD/ATR and the shipped Pine "EMA ribbon", "VWAP", "Bollinger Bands", "RSI", "MACD", "ATR" | the same indicators twice, in the same inks, with different seeding (the built-in EMA starts at the first close, Pine's `ta.ema` at an SMA) | **merge**: keep the built-ins as the fast path and drop the duplicate Pine scripts from the shelf, or the reverse | two lines that disagree on the left edge, side by side |
| Three definitions of "heaviest": by gross (Top chip, pills), by |net| (bead card rank, right-click top-3), raw walls (level card, day panel) | each other | **merge** on gross (the size the ovals encode) | one word, three answers on one screen |

**Code with no reader or no effect**

| where | what | proposal |
|---|---|---|
| Terrain.tsx `rowDoorPx`, `ROW_DOOR_PX`; `toolbarInline = false` and the branch it guards; `toolbarCompactShown` alias; `paneOverlays` alias | computed, never read / constant / aliases | delete |
| Terrain.tsx unused imports `fmtUsd`, `nyClock as nyClockAt`, `nyParts` | imported, unused | delete |
| Terrain.tsx the under-lg "Strikes" door `[data-narrow-ladder]` | its condition can never hold (the peek always exists when it would) | delete |
| Terrain.tsx `HEAD_PARTS.fullscreen: false` | Terrain never passes `onToggleFullscreen` | delete the key |
| ChartToolbar `vertical` mode (14 branches) and `MENU_SIDE_CARET` left/right | no host passes `vertical` | delete |
| ChartToolbar's built-in Indicators `Dropdown` (`onIndicators && !paneId`) | every host passes `paneId` | delete |
| ChartToolbar's comment about a draw pencil gated on `onToggleDrawing` | no such prop | delete the comment |
| ProfilePanel's `pin` paths (`levels.pin`, the Pin chip and ink) | the Map no longer hosts the panel | delete |
| ProfilePanel's unsized-host path (`flex-1 min-w-0`, `sized === false`, `!onLane`) | Terrain always passes `width` and `onLane` | delete |
| ProfilePanel flip caption's `if (showFlow)` / `else` | identical branches | merge |
| gexNodesPrimitive `focusInk`, `maxAbs`, `labelPx` (always floored to 11), the AxisLabel views (off on Terrain, rebuilt every frame), `CHIP_LEFT`/`CHIP_RIGHT` | never read / no effect | delete (the AxisLabel views cost a rebuild a frame) |
| StrikeChart `LEVEL_SPEC`/`LINE_LEVELS = []`, their price lines and tween | the list is empty | delete |
| StrikeChart's own ReplayStrip props (`replay`, `replayTime`, `onExitReplay`) | used by LiveChartWidget only | keep (another room) |
| StrikeChart `nyClock` prop / `NY_TIME` / `nyTickMarks` | `chartDate(t, _clock)` ignores the clock | delete |
| StrikeChart the regime chip's `title` | the chip is `aria-hidden` and `pointer-events-none` | delete or make it hoverable |
| StrikeChart `usd` import; Terrain's `onBarClick` double guard | unused / redundant | delete |
| setups.ts / ChartToolbar `dexStrike` | stored and listed, excluded from Terrain's menu, never drawn | delete |
| PaneHead `className` prop | never passed | delete |
| The pop-out (`/out/terrain`) | its keys and the `?` door did nothing (no desk key handler outside AppShell) | keep the pop-out; the `?` door is gone from it (9115af0); its keys stay unwired |
| core/pine `runSource`, `RunResult.warnings`, `barcolors` (so `barcolor()` never shows), `forceOverlay`, `ChartScript.inks`/`version`, `SlayerFeed.netGex`, `setVisibility` and the community shelf, five unreachable "must sit at the top level" throws, `OPS3`, the `xloc`/`yloc`/`extend`/`barmerge` constants | no reader | delete, or wire `barcolor()` (it is a common Pine call) |
| LY "the proof stages its own validator" header | no proof imports the module | fix the header or add the proof (PK's is now true: terrain-setups-proof imports `stepTf`, 9115af0) |

## 6e · Pine Script — what works, what does not, the shipped scripts

The engine is src/core/pine/ (an interpreter, not TradingView's). **Fixed this round** (3947ba4, each with a check in
scripts/pine-proof.ts that failed before — 92 of 92 pass, and the proof now runs in `npm test`): `str.format` with
arguments; `timeframe.*` on the chart's own forms (5m, 1h, 1D …) as well as Pine's; `hour`/`minute`/`dayofweek` … in New
York time (they read the machine's zone) and their function forms; `ta.vwap` restarting at New York's midnight (it turned
at 1 am all summer), with `anchor` and `stdev_mult`; `alertcondition` ids (an `alert()` written first moved every
switch); `ta.obv`, `ta.tr`, `ta.vwap` as variables; arrays, matrices and maps refused where the script is read, in plain
words (they failed as "Unexpected array"); `location.absolute` marks at their price; the shipped walls in the gamma pair;
the editor's chords through `modKey`; and the speed: the Ichimoku over 5,000 bars went from ~270 ms (over the 200 ms
budget) to ~75–120 ms, bit-identical output on every other script. **And on the chart** (this round): a run that fails
draws nothing and its legend says "does not run" with the reason (it left the last good lines drawn, frozen, behind a
normal row); an own-pane script past the cap says "no pane free"; a script's own pane is appended after the regime and
flow panes (it landed inside them).

**Language support, as it stands**

| works | partly | not yet |
|---|---|---|
| `//@version=5/6`; typed declarations; `var` (and `varip`, which is `var` with no intrabar ticks); `:=`, `+=`…; if/else and if-expressions; `for … to … by`; while, break, continue; switch (with or without a subject); `?:`; and/or/not; integer division; user functions, one line or a block, each call site with its own streams; tuples; history `x[n]`; `na`, `nz`, `fixnan`; `input.int/float/bool/string/color/source`; `plot` (styles, `offset`, `display.none`); `hline`; `bgcolor`; `fill` plot–plot and hline–hline; `alertcondition` and `alert()`; 51 `ta.*` functions (sma … supertrend, dmi, pivots, sar, linreg, correlation); `math.*`; `color.*` and `#RRGGBB[AA]`; `str.*` (tostring, format, tonumber, length, upper, lower, contains, startswith, endswith, replace); `timeframe.*`; time variables and their functions (New York or UTC); `syminfo.*`; the house's `slayer.callWall/putWall/flip/supreme` | `plotshape`/`plotchar` (shapes collapse to circle, square or arrow; `textcolor` ignored); `input.timeframe/session/symbol/text_area` (read as text boxes); typed parameters (`f(int n) => n / 2` gives 2.5, Pine 2); recursion (allowed here, refused in Pine); `barstate.isconfirmed`/`isrealtime` (no live bar is handed, so always confirmed); `syminfo.type` (always "stock"); `slayer.*` (today's levels drawn flat across history); `math.random()` (always 0.5) | default parameters; `method`, `type`, `enum`, `import`, `export`; `for … in`; arrays, matrices, maps; `str.split/substring/pos/trim/repeat/match/format_time`; `input.price/time/enum`; `plotarrow`, `plotcandle`, `plotbar`; `barcolor` (runs, never drawn); fill plot–hline (dropped silently); drawings (`line`, `label`, `box`, `table`, `linefill`, `polyline`); `request.*`; `strategy()`; sessions (`session.*`, `time(tf, "0930-1600")`); `ta.kc`, `kcw`, `cmo`, `tsi`, `range`, `mode`, `accdist`, `pvt` and the rest |

**The 23 shipped scripts** (src/data/builtinScripts.ts): all compile and run, and every one draws over 5,000 one-minute
bars inside the 200 ms chart budget (the proof's §18). Run time a script, 5,000 bars, after a warm-up, this container
(a shared machine, ±30%): The walls 62 ms · The flip 37 · The supreme strike 9 · Distance to the walls 30 · Wall approach
38 · Moving average 52 · EMA ribbon 54 · VWAP 23 · Supertrend 46 · Parabolic SAR 24 · Ichimoku 119 · Bollinger 41 ·
Keltner 26 · Donchian 56 · RSI 36 · MACD 25 · Stochastic 27 · ATR 7 · ADX and DI 24 · CCI 28 · Williams %R 27 · Money
flow index 28 · On-balance volume 11. How each draws: the three wall scripts and the averages, VWAP, Supertrend, SAR,
Ichimoku and the three channels on the price pane; RSI, MACD, Stochastic, ATR, ADX, CCI, %R, MFI, OBV and Distance to the
walls in their own pane. **Open for you**: "The flip" washes the pane red under the flip (a direction ink used as a
region, over the ovals); six shipped scripts repeat the built-in indicators in the same inks (see 6i).

## 6j · For your approval — nothing here is changed until you say

Each is a change to what a reader sees, a removal, or a feature beyond the fix, so it waits for you. My recommendation is first; the other way is
named.

| # | what | where it was found | I recommend | the other way |
|---|---|---|---|---|
| 1 | **The ladder's source.** The ladder shows Unusual Whales' book by strike; the ovals beside it are the modeled field. For one strike at one minute they differ by −12% to +44% (the model), more near the close (UW's book is figured after the bell) | 6c | the ladder reads the field's column at the minute the chart shows; UW's figure stands beside it as the measured reference (read line, hover card, How sure) — one strike, one number | keep UW's book on the ladder, and say on the ladder's head that it is UW's, figured at its time |
| 2 | **A spacing and type scale** (none exists in the tokens): a 4 px grid and six sizes, the casing in sentence case (the desk bar's and chips' tracked capitals), the ladder's 9–10 px heads and figures to 11 | 6f | apply the proposal as written in 6f | keep the sizes as they are and fix only the words under 11 px |
| 3 | **Deletions and merges** — every row of 6i | 6i | each row as proposed there (delete the dead code; merge the duplicate lists) | row by row: tell me which to keep |
| 4 | **Indicator inks** on the field's gold–violet axis (EMA 9, SMA 200, RSI, MACD, ATR and nine Pine scripts within ΔE 0.15), and inks shared between indicators and compare lines | 6d, area D | move every indicator ink off the gold–violet axis, one ink each, none shared with a compare line | keep the inks; the ovals and the lines differ by form |
| 5 | **The six Pine scripts that repeat a built-in** (EMA ribbon, VWAP, Bollinger, RSI, MACD, ATR) in the same inks, seeded differently, so two lines disagree on the left edge | 6d, 6i | keep the built-ins and take the six off the shelf | keep the Pine ones and drop the built-ins |
| 6 | **"Key levels"** in the Layers menu changes nothing on the plot (B-41) | B-41 | make it hide and show the wall lines, the flip's rule and the axis chips — the menu's own promise | delete the row |
| 7 | **Two level-alert systems** — the toolbar's level chips (gex/alertStore) and the right-click tiered watches (data/levelAlerts) — on the same levels, with two lists, two logs and two cooldowns | 6i | one: the tiered watches, the toolbar's chips arming a watch | keep both and say in each which one fires |
| 8 | **One "heaviest"**: the Top chip and pills by gross, the bead card's rank and the right-click top-3 by \|net\|, the level card and day panel by the raw walls | 6i | gross everywhere (the size the ovals draw) | \|net\| everywhere |
| 9 | **The session chip** on the desk bar names the CME futures week ("GLOBEX · EUROPE") on an options desk, and is not reachable by the keys | A-226 | show the options session (pre-market, regular, after hours) and make it a focusable chip with its title | remove it (the strip's phase already says it) |
| 10 | **Toasts** stand over the ladder's head and, in full screen, over Overlays, Theme and Collapse for 5 s | A-200 | toasts at the foot of the screen, clear of every pane's chrome | leave them; they go in 5 s |
| 11 | **"The flip"** Pine script washes the pane red under the flip: a direction ink used as a region, over the ovals | 6e | a quiet neutral band, or the flip's own line alone | keep the wash |
| 12 | **Drawings are kept per tape**: a line drawn on SPY with the keys in is not on SPY's house tape, and back | area B | one set of drawings per name, whichever tape draws it | keep them apart (a price on one tape is not the other's) |
| 13 | **`barcolor()`** runs in Pine but never colours a candle | 6e, 6i | wire it (a common Pine call) | delete it from the engine and refuse it with words |
| 14 | **The pop-out's keys** (/out/terrain): none of the desk's keys work there | 6i | wire the pane's own keys (P, R, T, W, L, timeframes) in the pop-out | leave the pop-out mouse-only |
| 15 | **The crosshair readout** names the price pane's single lines only; RSI, MACD, ATR, the bands and Bollinger say nothing under the crosshair | D-06…D-10 | each pane's legend prints its own value at the crosshair (TradingView's way) | leave the readout as it is |

| 16 | **"Replay this day" for any day on the tape**: today it is offered only where the chart already holds the day's minutes (two of the last nine days on this machine), disabled with its reason elsewhere | the after-run, A-168 | the button loads that day's minutes on demand (the tiles hold them) and then starts the replay at 9:30 am | keep it to the days already held |
| 17 | **The ladder's lane names** stand only from a 640 px ladder (since 9115af0 — at the rest widths they were laid out 0–28 px wide); below it the column heads name the lanes and the definitions are in How to read, so the lane's own tooltip is not there | the after-run, C-09 | a second head row for the names when the first is full | keep the rule |

**Outside Terrain, found on the way, not changed:** Pinpoint's Compare (CompareAxis) and the exposure field on Pinpoint's
Map and Pulse (ExposureField) still keep a capture-phase Escape of their own — the pattern 646b2ff took off Terrain; they
belong to those rooms' audits.

## 6k · The approvals, applied (2026-10-15, from your answers)

Each approval is built with a browser or unit check that fails on the code before it, then reviewed by a separate agent
that tries to break it; what the review finds is fixed and reviewed again.

| # | your answer | state | commits |
|---|---|---|---|
| 3 | approved for dead code and exact duplicates; then "keep all five items, as you advised. All four resets must land on the identical view" | **done**: the dead rows of 6i deleted (each proven unread), the window and pace lists merged into one each; the five visible items kept. The four resets: queued next | 40b297e |
| 4 | indicator colours off gold/violet: approved | **done** (scripts/indicator-inks-proof.ts): every indicator and shipped-script line 0.15 or more (OKLab) from the ovals' gold and violet on dark and paper (0.08 from the pair under blue–orange), no two sharing an ink, 0.08 from the compare lines, 30° of hue or more from the up/down pair, 3:1 or better on every tape; on a light tape a script's inks are read off the tape's own tokens; the reader's colour vision reaches the chart's chrome. Your colour rule (below) supersedes part of it and is queued next | 03ca5ad, dbbdfab, 59d97da |
| 5 | drop the six Pine scripts that duplicate built-ins: approved | **done**: retired from the shelf; a placed copy is kept as the reader's own | 03ca5ad |
| 11 | "The flip" script's red wash: removed | **done** | 03ca5ad |
| 13 | barcolor(): implement it | **done**: `barcolor()` colours the candles it names, in replay only the bars up to the cursor; Pulse's own chart replay draws none (it runs scripts on the whole tape, so it could only colour from bars past the cursor) | 98bdc58 |

**Queued, in this order** (the owner's order of 2026-10-15): your colour rule under every Colours option (only the ovals
wear their two colours; up/down in the candles' up and down colours; everything else the indicator palette clear of the
ovals; Ichimoku's cloud a faint fill in the candles' colours; compare lines and uncoloured Pine plots off the violet;
shipped scripts' up/down follow every Colours option, a reader's own script keeps its colours; the distinctness check
under every option and colour-vision simulation — a clash of the candles' blue with the ovals' blue under blue–orange is
brought to you with a proposal, not changed); the four resets on one view; then 15 and 17; 6 and 8; 1; 7; 9, 10 and 14;
12 and the Trace/Compass autoscale; 16; 2 (the DOM, then the canvas).
