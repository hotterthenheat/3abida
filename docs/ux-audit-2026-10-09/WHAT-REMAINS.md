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
- Compass computes "target hit" three ways (card, page head, premium view) — CO-1
- Pinpoint pages build their books on different strike windows (15 vs 20): call wall 480 vs 481 — X1, PP
- Pinpoint Board Net GEX tooltip has the sign backwards — PP-3
- Trace: P/C labelled premium but counts prints (TR-25); every non-sweep print is a "block" (TR-26); the tape
  sentence contradicts its totals (TR-27); Net Flow's net ≠ calls − puts (TR-38); "spread + theta 692%" (TR-6)
- Clocks mix New York and the browser's zone (Trace windows from 00:00, Paper's chart axis, Pinpoint "since the open"
  at 07:55, the rail clock) — X2
- Pulse panels refresh every 10 s while the rail and chart are live: several prices for one name — X1, Pulse.tsx:131
- Compass "All kinds 99" vs 30 found (double count, CO-3); "found at" is page-open time (CO-5)
- Dossier labels the current, unreported quarter as reported (DO-2); NVDA put listed twice, duplicate key (DO-3)

## Broken
- `/signin/`, `/SIGNUP` etc. show "You're in." — OU-A1
- Trace: Expiry does nothing on Watchers and Windows (TR-46, TR-49); Net Flow search plots any text (TR-37); Compare's
  "Leans bullish" sets A = B (TR-59); Compare table off a phone (TR-61); ↑/↓ only on Live Tape (TR-1); Esc fails to
  close the card (TR-2)
- Pinpoint Targets' "Chart" opens the Map — PP-1
- Compass Table view: cut names, clipped columns, rows vanishing on refresh — CO-2
- Landing session window blank on a desk under reduced motion — L-1

## Lost work and safety
- Reloading Paper closes open positions — PR-1
- No confirm or undo: Flatten, new account, "Take them here", delete session, delete desk — X5
- Backtest: look ahead, then rewind and trade — PR-2
- Limit 99999 accepted then cancelled with the wrong reason (PR-3); "1.2.3" shows "NAN LMT" (PR-4)

## Dead or misleading controls
- 12 inert Settings buttons (Sign out, Delete account, Manage billing, invoices, billing notices) — SE-1
- Terrain's 1m/5m/15m strip looks clickable, is inert — TE-1
- Pinpoint Map's "How to read" describes a view that does not exist — PP-2
- Way-back pill "Back to back" (WayBack.tsx:32 still matches /record/) — SH-3
- Screener drops the expiry from shared and saved links — TR-32

## Layout
- Pulse at 1280: the toolbar wraps onto the chart ("SPY THEME $477.85") — PU-1
- Settings falls out of the rail with no scroll cue — SH-2
- Terrain: strike chips stack (TE-3), ▲ counters on the strike labels (TE-4), "Expiry" cut in pane heads (TE-2),
  ladder squeezes the chart in 3–4 panes (TE-5)
- Pinpoint Board does not fit at 1440 or 1920 — PP-4
- Trace grids: key columns off screen, the sideways scrollbar thousands of px down (autoHeight) — TR-3
- Charts leave a third to half of their width empty on the right — X11
- Pulse keeps the old breadcrumb head; the four-chart board a third style — PU-2

## Keyboard and accessibility
- Rows open by mouse only (Trace, Pinpoint, Compass Tracker) — X6
- The search box's highlight scrolls out of view — SH-1
- Search box, alerts drawer, cards and guides do not take or hold focus — X13
- Invisible wall doors (L-2) and the Community room behind "Coming soon" (SH-16) take focus
- 1 px focus ring, no skip link, no `<main>`, missing h1s — X4

## Phone
- Most terminal controls under 44 px — X3
- Terrain has no ladder below 1024 px (TE-6); the Weigher's watch column off screen (WE-2); the Journal calendar
  loses Thu–Sat (PR-6); Trace grids show about 2½ columns (TR-7); Pinpoint's head takes 65% of the first screen (PP-8);
  Pinpoint clock labels overlap (PP-6), Compare cuts values (PP-7); News map covered (DO-4); Backtest rules "N…" (PR-5)

## Text
- Small type: 45–76% of Pinpoint's text under 11 px; the Weigher's 7.5 px tags — X9
- Formats: four date formats, theta with no units (CO-7), "15M" reading as months, mixed decimals and signs

## Outside pages
- About, Legal, even the 404 open behind "Entering terminal" — OU-O1
- A light-machine visitor gets a dark sign-up — OU-T1
- Sign-in: no link to sign up (OU-A2), no password show/hide (OU-A3)
- Status legend's grey backwards on dark — OU-S1

## Wording, by the owner's own rule (the UI never says the data is not real)
- "the people are invented until the feed lands", "SAMPLE", "the market starts fresh on every load", "sample plan",
  "the sample account" — X7
- `/legal/data` claims a "licensed feed" — X7
- Trade calls: News "buy the first pullback", Compass "Scalp the pop", puts described as "buy walls … protective
  floor" — X8, CO-6
- Dark Pool copy gives trade calls: "Trade the break", "Don't chase it", "Level becomes support", "Rallies… should
  struggle", and calls a print "bought"/"sold" from its place against spot alone — src/data/darkpool.ts:155–215
  (found by the ideas research, 2026-10-09)

## The owner's call (not bugs)
Whole-page landing windows vs the 11 px rule; "Won %", "The case: strong" and other grade-like scales; merging Trace's
11 pages into about 6; Pinpoint's shape and the Map's name; plan names matching room names.
