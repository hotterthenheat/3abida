# The audit, triaged — what remains to fix (2026-10-09)

The owner, on the full audit (`Slayer full UX UI audit.md`, beside this file): "if data is correct it doesn't matter
because this is all simulated until i plug in my api keys, so fake data is fine". So findings that are only about the
stand-in numbers being wrong are OUT. Everything below stays. Each item's file:line, evidence and fix are in the full
report under the ID given.

## Out — the stand-in data itself (ignore)
- Dossier's list price vs the stock's own page, Earnings' spot (static `px` in data/universe.ts) — X1
- Compass board premiums frozen for roster names (day-stable quotes) — X1, CO
- Dossier inventing a page for any ticker (ZZZZ) — DO-1
- The Weigher's odd projected-loss figures on stand-in quotes — WE-1

## Looks like data, but is code — stays after the keys
- ~~Compass computes "target hit" three ways (card, page head, premium view) — CO-1~~ fixed 2026-10-10 (one record per
  setup, components/compass/campaignStore.ts `statusOf(recordOf(id))`, read by card, table, head, charts and Tracker)
- ~~Pinpoint pages build their books on different strike windows (15 vs 20): call wall 480 vs 481 — X1, PP~~ fixed
  2026-10-10 (one book per name on the whole chain, data/pinpointBook.ts; the window only chooses the rows drawn)
- ~~Pinpoint Board Net GEX tooltip has the sign backwards — PP-3~~ fixed 2026-10-10 (pages/pinpoint/Board.tsx: the house
  sign said once, and why Hedging today can differ)
- ~~Trace: P/C labelled premium but counts prints (TR-25); every non-sweep print is a "block" (TR-26); the tape
  sentence contradicts its totals (TR-27); Net Flow's net ≠ calls − puts (TR-38); "spread + theta 692%" (TR-6)~~ fixed
  2026-10-10 (data/tape.ts premium ratio and real kinds, LiveTape's sentence off its own numbers, NetFlow's parts add
  up, PrintDrilldown bounded)
- ~~Clocks mix New York and the browser's zone (Trace windows from 00:00, Paper's chart axis, Pinpoint "since the
  open" at 07:55, the rail clock) — X2~~ fixed 2026-10-10: Trace's book is New York's session (flowBook
  `bookSession`), Pinpoint cuts at 09:30 New York (levelview `sessionCut`), the rail clock reads Settings and names its
  zone (SessionStrip `railClock`), and every StrikeChart draws on New York (`nyClock`) — Terrain, the Weigher, Pulse's
  chart, the four charts, Paper's and the Backtest's charts (components/review/DeskShell.tsx) and the Journal's trade
  tape.
- ~~Pulse panels refresh every 10 s while the rail and chart are live: several prices for one name — X1, Pulse.tsx:131~~
  fixed 2026-10-10 (Pulse hands every panel the live price, `ctx.liveSpot`)
- ~~Compass "All kinds 99" vs 30 found (double count, CO-3); "found at" is page-open time (CO-5)~~ fixed 2026-10-10 (All
  kinds counts its own sweep; found at is the sweep's moment, campaignStore)
- ~~Dossier labels the current, unreported quarter as reported (DO-2); NVDA put listed twice, duplicate key (DO-3)~~
  fixed 2026-10-10 (data/earnings.ts: quarters end at the last reported, on the app's clock; one row a strike)

## Broken
- ~~`/signin/`, `/SIGNUP` etc. show "You're in." — OU-A1~~ fixed 2026-10-10 (each route tells Auth its form, App.tsx)
- ~~Trace: Expiry does nothing on Watchers and Windows (TR-46, TR-49); Net Flow search plots any text (TR-37); Compare's
  "Leans bullish" sets A = B (TR-59); Compare table off a phone (TR-61); ↑/↓ only on Live Tape (TR-1); Esc fails to
  close the card (TR-2)~~ fixed 2026-10-10 (flowBook caches keyed on their rows; NetFlow takes known names only;
  Compare opens the champion's contract and stacks on a phone; the card's keys in PrintDrilldown; Modal closes the top
  layer, ui/layers.ts)
- ~~Pinpoint Targets' "Chart" opens the Map — PP-1~~ fixed 2026-10-10 (it opens the strike on Pulse's chart)
- ~~Compass Table view: cut names, clipped columns, rows vanishing on refresh — CO-2~~ fixed 2026-10-10 (SetupScanBoard:
  fits its box, stable columns, a sweep re-ranks in place)
- ~~Landing session window blank on a desk under reduced motion — L-1~~ fixed 2026-10-10 (the beat's still stands in it)

## Lost work and safety
- ~~Reloading Paper closes open positions — PR-1~~ fixed 2026-10-10 (data/paper/store.ts keeps positions and orders through
  a reload and a tab hand-over; docs/paper-rules.md)
- ~~No confirm or undo: Flatten, new account, "Take them here", delete session, delete desk — X5~~ fixed 2026-10-10 (each
  acts at once with an undo chip, ui/undo.tsx)
- ~~Backtest: look ahead, then rewind and trade — PR-2~~ fixed 2026-10-10 (the clock only moves forward, review/engine.ts
  `floorOf`)
- ~~Limit 99999 accepted then cancelled with the wrong reason (PR-3); "1.2.3" shows "NAN LMT" (PR-4)~~ fixed 2026-10-10 (a
  buy limit is paid at its limit and refused up front; one decimal point, components/paper/OrderPieces.tsx)

## Dead or misleading controls
- ~~12 inert Settings buttons (Sign out, Delete account, Manage billing, invoices, billing notices) — SE-1~~ fixed
  2026-10-10 (every door acts, pages/settings)
- ~~Terrain's 1m/5m/15m strip looks clickable, is inert — TE-1~~ fixed 2026-10-10 (it is the pane's timeframe tabs)
- ~~Pinpoint Map's "How to read" describes a view that does not exist — PP-2~~ fixed 2026-10-10 (LedgerGuide reads the
  Matrix)
- ~~Way-back pill "Back to back" (WayBack.tsx:32 still matches /record/) — SH-3~~ fixed 2026-10-10
- ~~Screener drops the expiry from shared and saved links — TR-32~~ fixed 2026-10-10 (data/screenerViews.ts)

## Layout
- ~~Pulse at 1280: the toolbar wraps onto the chart ("SPY THEME $477.85") — PU-1~~ fixed 2026-10-10 (the legend stands
  under the bar however it wraps)
- ~~Settings falls out of the rail with no scroll cue — SH-2~~ fixed 2026-10-10 (Settings pinned, the list fades at its
  edges)
- ~~Terrain: strike chips stack (TE-3), ▲ counters on the strike labels (TE-4), "Expiry" cut in pane heads (TE-2),
  ladder squeezes the chart in 3–4 panes (TE-5)~~ fixed 2026-10-10
- ~~Pinpoint Board does not fit at 1440 or 1920 — PP-4~~ fixed 2026-10-10
- ~~Trace grids: key columns off screen, the sideways scrollbar thousands of px down (autoHeight) — TR-3~~ fixed 2026-10-10
  (pinned key columns, a sticky sideways scroller, TraceBox)
- ~~Charts leave a third to half of their width empty on the right — X11~~ fixed 2026-10-10 (StrikeChart
  `historyShare`: 0.88 on Terrain, Pulse's chart, the four charts, Paper and the Backtest, 0.9 on the Weigher; Net Flow
  runs near its right edge)
- ~~Pulse keeps the old breadcrumb head; the four-chart board a third style — PU-2~~ fixed 2026-10-10 (both wear ShellHead)

## Keyboard and accessibility
- ~~Rows open by mouse only (Trace, Pinpoint, Compass Tracker) — X6~~ fixed 2026-10-10 (houseGrid `openRowOnEnter`, keyed
  rows on Building, Targets, the walls and the Matrix; the Tracker's rows open)
- ~~The search box's highlight scrolls out of view — SH-1~~ fixed 2026-10-10 (the command line keeps its row in view)
- ~~Search box, alerts drawer, cards and guides do not take or hold focus — X13~~ fixed 2026-10-10: the command line,
  the alerts drawer, the print card, 0DTE's full screen and the "How to read" guides are dialogs that take, hold and
  give back the keys (ui/GuideFocus.tsx through ui/layers.ts `useOverlay`, focus back to the door)
- ~~Invisible wall doors (L-2) and the Community room behind "Coming soon" (SH-16) take focus~~ fixed 2026-10-10
- ~~1 px focus ring, no skip link, no `<main>`, missing h1s — X4~~ fixed 2026-10-10: a 2 px ring, SkipLink to `<main>`
  in the shell, the outside pages and the landing; Pulse and the four charts have their h1 (ShellHead), Terrain its own
  (pages/terrain/Terrain.tsx, sr-only)

## Phone
- ~~Most terminal controls under 44 px — X3~~ fixed 2026-10-10: the rooms' own controls and every shared house control
  (ui/DropdownSelect, DropdownMulti, FilterTabs, CardTabs, GuideDoor, ScopeChip, ExpiryCalendar) carry `.hit`, a 44 px
  box on a coarse pointer (index.css). The footer's links (X3.1) are the footer's (never touched) — the owner's rule.
- ~~Terrain has no ladder below 1024 px (TE-6); the Weigher's watch column off screen (WE-2); the Journal calendar
  loses Thu–Sat (PR-6); Trace grids show about 2½ columns (TR-7); Pinpoint's head takes 65% of the first screen (PP-8);
  Pinpoint clock labels overlap (PP-6), Compare cuts values (PP-7); News map covered (DO-4); Backtest rules "N…" (PR-5)~~
  fixed 2026-10-10

## Text
- ~~Small type: 45–76% of Pinpoint's text under 11 px; the Weigher's 7.5 px tags — X9~~ fixed 2026-10-10: no word under 11
  px on any page the routes open (chart ticks stay 10) — the house grid heads 11 px in sentence case (houseGrid,
  index.css), every text-[8–10.5px] class in the terminal at 11, the Weigher's ruler and Pinpoint's drawings set their
  words in pixels off their own width (ui/svgFloor.ts), News's map words at 11 on any screen. Left (below, Still
  open): the "How to read" guides' drawings and two pieces the check does not walk.
- ~~Formats: four date formats, theta with no units (CO-7), "15M" reading as months, mixed decimals and signs~~ fixed
  2026-10-10: one rule, core/format.ts — the true minus, a sign on a change, prices to the cent, big dollars to three
  figures, percent to one decimal (two under 1%), greeks, IV, "Oct 9" and "14:03 ET" — the rooms' formatters on it.

## Outside pages
- ~~About, Legal, even the 404 open behind "Entering terminal" — OU-O1~~ fixed 2026-10-10 (the gate only on terminal
  paths, LaunchTransition `isTerminalPath`)
- ~~A light-machine visitor gets a dark sign-up — OU-T1~~ fixed 2026-10-10 (outside pages on the landing's ground)
- ~~Sign-in: no link to sign up (OU-A2), no password show/hide (OU-A3)~~ fixed 2026-10-10
- ~~Status legend's grey backwards on dark — OU-S1~~ fixed 2026-10-10 (filled an open day, outlined a closed one)

## Wording, by the owner's own rule (the UI never says the data is not real)
- ~~"the people are invented until the feed lands", "SAMPLE", "the market starts fresh on every load", "sample plan",
  "the sample account" — X7~~ fixed 2026-10-10 (none left on screen; the starter accounts are named as such)
- ~~`/legal/data` claims a "licensed feed" — X7~~ fixed 2026-10-10
- ~~Trade calls: News "buy the first pullback", Compass "Scalp the pop", puts described as "buy walls … protective
  floor" — X8, CO-6~~ fixed 2026-10-10 (reads, never instructions: data/news.ts, data/compass.ts; "Quick scalp" is
  "Fast movers")
- ~~Dark Pool copy gives trade calls: "Trade the break", "Don't chase it", "Level becomes support", "Rallies… should
  struggle", and calls a print "bought"/"sold" from its place against spot alone — src/data/darkpool.ts:155–215
  (found by the ideas research, 2026-10-09)~~ fixed 2026-10-10 (the reads say where a cross printed, never who or what
  to do)

## The owner's call (not bugs)
Whole-page landing windows vs the 11 px rule; "Won %", "The case: strong" and other grade-like scales; merging Trace's
11 pages into about 6; Pinpoint's shape and the Map's name; plan names matching room names.

## Still open (2026-10-10)
After the ten streams of 2026-10-09/10 (checked in `src` after the shared, speed, ideas and polish merges), what is
left, and why:
- The "How to read" guides' drawings set their words at 6–9 units on a fixed viewBox (components/trace/TraceGuide.tsx,
  gex/WallGuide.tsx, BuildingGuide, TargetsGuide, AheadGuide, weigher/WeigherGuide.tsx, compass/CompassGuide.tsx,
  SetupGuide, record/*Guide.tsx) — X9, not done: they open on a press, so the floor's check does not walk them; the fix
  is ui/svgFloor.ts `useSvgFloor`, as the Weigher's ruler has.
- Two drawn charts under the floor that the check does not reach: the print card's flow chart prints "LARGEST PRINT" in
  9 px capitals and "THIS PRINT" / "THIS CONTRACT" in 10 px capitals (components/trace/ContractFlowChart.tsx, opened on
  a press); Pulse's exposure band (components/gex/StrikeExposureBand.tsx, under the chart when its Overlays menu asks)
  draws its figures at 8–9 px and its spot tag on a literal dark fill and white hairline, not tokens — X9 and the
  theme rule, not done.
- The footer's links under 44 px on a phone (X3.1) — the footer is never touched (the owner's rule).
- The stand-in data items at the top — needs real data (the keys).
- The owner's call, above — owner's call.
