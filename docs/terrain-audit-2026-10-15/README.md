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
| The pop-out (`/out/terrain`) | its keys and the `?` door do nothing (no desk key handler outside AppShell) | keep the pop-out; wire its keys or drop the key hints there |
| core/pine `runSource`, `RunResult.warnings`, `barcolors` (so `barcolor()` never shows), `forceOverlay`, `ChartScript.inks`/`version`, `SlayerFeed.netGex`, `setVisibility` and the community shelf, five unreachable "must sit at the top level" throws, `OPS3`, the `xloc`/`yloc`/`extend`/`barmerge` constants | no reader | delete, or wire `barcolor()` (it is a common Pine call) |
| PK "pure enough for npm test" and LY "the proof stages its own validator" headers | no proof imports either module | fix the headers or add the proofs |

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
