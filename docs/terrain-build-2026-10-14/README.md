# Terrain — the build of 2026-10-14 (the owner's directive after the UI pass)

The owner's message of 2026-10-14, after the UI pass: sections A (follow-ups), B (the map now), C (the 14-year
history), D (the proof engine), E (map changes from the results), F (combined greeks), G (do not build), H (reporting),
I (speed, in place of A7). This file is the report the owner asked for in H — a section at a time, each with its
screenshots (shots/) and tables, every number with its sample. Every change is on the default branch.

## Section A — follow-ups from the UI pass

### A1 · the wall chips wear the gamma pair

Every surface that named a wall by the direction pair (green/red) now wears the gamma pair: the call wall glacier,
the put wall ember. Bull/bear stays on the candles, a change's sign, a flow leg and an outcome (held/broke) — direction,
never a wall.

| surface | before | now | where |
|---|---|---|---|
| the axis chips CW / PW (Terrain) | --bull / --bear | --glacier / --ember | gexNodesPrimitive `axisInksFrom` |
| the wall-move chips on the chart ("CW 780 → 800 · 8:55 am") | green / red | glacier / ember | gexNodesPrimitive `CW_RGB` / `PW_RGB`, `trailPaperFrom` on paper |
| the library's axis labels and the beads a wall's strike wore | green / red | glacier / ember | the same inks |
| the ladder's wall rows and tags (ProfilePanel) | --bull / --bear | --glacier / --ember | ProfilePanel inks, both grounds |
| the chart's wall price lines (every room's StrikeChart), the Compass chart's CW/PW chips, the Ahead corridor's and the Wall report's level rows, Pinpoint's ladder legs | `CALL_WALL` = bull green, `PUT_WALL` = bear red | `CALL_WALL` #7ABDD7 (glacier), `PUT_WALL` #F5C542 (ember); the token set `rgb(var(--glacier))` / `rgb(var(--ember))` | gex/palette.ts, gex/paletteInk.ts |
| kept on bull/bear: the flow band's and the drift lines' legs (direction), the OI-change bars (opened/closed), the Ahead corridor's up/down bars and flow volume, the Wall report's held/broke ticks | — | `BEAR` added beside `BULL` for them | palette.ts, paletteInk.ts |

Shot: shots/a1-walls-ladder-live.png (SPY, 15m, 1440 × 900, 2026-10-14 11:51 am PDT — the CW 780 chip and the "CW 780
→ 800" chip in glacier, the PW 765 chip and "PW 770 → 765" in ember, the ladder's 780 row glacier, 765 ember; the
ladder's Net | Sides tabs at its head, Net selected). Measured off the DOM in that run: the CW chip's background
rgb(122, 189, 215), the PW chip's rgb(245, 197, 66), the flip's rgb(156, 163, 175), the supreme's rgb(234, 0, 255).

### A2 · a day bar names its New York session, in every zone

A day bar is stamped at its session's noon UTC by the feed (levels.ts `dayTime`), at UTC midnight by the house's fold
of minutes, at its Monday's stamp by the weekly fold. Read on the viewer's own clock a stamp can name the day before —
a Pacific viewer saw "11" and "13" under Oct 12 and Oct 14 in the UI pass's 6M shot. Now a daily or weekly chart's
ticks, their weights and the crosshair's stamp read each bar's session date IN NEW YORK, twelve hours on from the
stamp (chartTime.ts `sessionDateOf`, `sessionTickMarks`, `SESSION_TIME`, the behaviour's `sessionDates`; StrikeChart
flips them with the timeframe). Intraday charts keep the reader's calendar as before.

The proof, scripts/session-date-proof.ts (in `npm test`), runs the formatters with the process's zone switched:

| viewer zone | noon-UTC stamp (the feed) | UTC-midnight stamp (the house) | New York midnight | New York 09:30 |
|---|---|---|---|---|
| America/Los_Angeles | Oct 13 (the viewer's calendar said Oct 13) | Oct 13 (said Oct 12) | Oct 13 (said Oct 12) | Oct 13 |
| Asia/Tokyo | Oct 13 | Oct 13 | Oct 13 | Oct 13 |
| Australia/Sydney | Oct 13 | Oct 13 | Oct 13 | Oct 13 (said Oct 14) |
| Pacific/Honolulu | Oct 13 | Oct 13 (said Oct 12) | Oct 13 (said Oct 12) | Oct 13 |
| America/New_York, UTC | Oct 13 | Oct 13 | Oct 13 | Oct 13 |

26 of 26 pass (every stamp shape for the 2026-10-13 session, six zones, and the month tick standing on Oct 1's bar in
Los Angeles and Sydney). In the browser (shots/a2-daily-los-angeles.png, shots/a2-daily-tokyo.png; the axis strips
shots/a2-axis-*.png): the same axis in both zones — "13" under the Oct 13 bar, "15", "17", "Oct 19", "21" on the
whitespace ahead, the crosshair's stamp "Oct 19" with no clock. Checked bar by bar through the readout and the day
panel (SPY, 1D, the feed on this machine): Oct 9 close 778.57, Oct 12 close 778.10, Oct 13 close 778.01, Oct 14 the
live session.

**Found and fixed on the way:** today stood TWICE on the 1D chart — the minutes folded by UTC day (the bar the chart
draws until the feed's day rows land) and then UW's day row for today at its noon-UTC stamp, appended by `update()`
as a second bar for the same session. The bars effect now reloads the series when the new last bar does not continue
the one the series holds, or stands before it (StrikeChart `reshaped`). The check above (one bar a session, the
closes UW's) is after the fix.

### A3 · the phone's "Maximum update depth exceeded"

Not reproduced. Seven runs on this machine against the dev server, each with a hook on `console.error` capturing the
warning's component stack: four plain runs at 390 × 844 (tap the ladder peek, the timeframe, window and jump menus,
the decision strip, scroll), then three CPU-throttled runs (4×, 6×, 2×) turning the viewport through 360 × 740,
844 × 390, 412 × 915 while the page loaded, with the ladder open, stepping the timeframe six times. Hits: 0 (the only
warnings were React Router's two future-flag notices).

The static audit of every measure-then-set effect on the phone path: the pane's strip observer sets `stripW`/`stripH`
from the column's width, which no content change moves (width in, content out — the header's plan and the strip's
form read it, never their own rendered width); the ladder's head squeeze (ProfilePanel `measureHead`) steps 0→2 on
overflow and back only after the head grew 140 px, so it cannot oscillate at one width; the decision strip packs from
`room` (a prop), measuring nothing; the axis chips write transforms, no state; the crosshair readout sets state only
when its signature changes. No store's `getSnapshot` returns a fresh value.

So the cause is not found. What stands until it fires again: **a development-only trap** (src/dev/depthTrap.ts,
installed by main.tsx in dev) — when React prints "Maximum update depth exceeded" or "Too many re-renders" it keeps
the component stack React hands the console, the moment, and every registered state snapshot (Terrain's panes
register their name, timeframe, measured strip width and height, phone, ladder, "at live", day panel and the header's
plan), prints them as one block and keeps them at `window.__slayerDepth`. The next sighting names the component and
the state it was in; please copy the block from the console when it does.

### A4 · the bead-scale proof names what it skips

scripts/bead-scale-proof.ts (iii), replay against live: every session under five minutes is printed as
`SKIP  <name> <day>: N minutes on this machine — under the five the check needs` (and whether two recorders had
written the same minute), the pass line says how many sessions were read of how many, and **a run that read no
session fails** — a machine with no recorder session, or none five minutes long, no longer passes by skipping. On this
machine today: SPY 111 minutes, QQQ 102, AAPL 102 recorded (2026-10-14, the dev server's recorder), all three read.

### A5 · the recorder runs on its own

Confirmed, and made so for the dev server. The recorder is its own Node process (`npm run feed:recorder`,
server/recorderMain.ts — no Vite) under scripts/recorder.cmd, registered with Task Scheduler at startup, with the
backfill, the scorecard, the recap and the scale references on its own timers; the Theta Terminal is a third process
(scripts/theta-terminal.cmd). What was NOT so: a dev server with FEED_RECORDER_URL blank ran its own recorder beside
it — the lock let only one write, but whichever held it (the dev server, if its tab asked first) lost the session
on a restart. Now the dev server reads the field's routes from the recorder at http://127.0.0.1:5190 by default
(FEED_RECORDER_URL blank; `off` makes it record on its own) and records nothing itself while one answers there, so the
recorder holds the lock all along and a restart of the app or the dev server cuts no session; a port that refuses (no
recorder on the machine) falls back to the dev server's own recorder and is not asked again for half a minute
(server/feed.ts, vite.config.ts, .env.example, docs/data-feed.md "The recorder's home"). To check on your machine:
`curl -i http://127.0.0.1:5180/feed/field/SPY` while the recorder runs answers with `X-Feed-From: proxy` and the
recorder's log shows the read; stop the dev server and the recorder's `shown.jsonl` keeps growing a row a minute.

### A6 · the ladder's Net / Sides toggle

It exists: ProfilePanel's head tabs, Net selected by default (`view` state 'net'), Sides the legs with the spine
(shots/a1-walls-ladder-live.png, top right of the ladder).

### Scope note

"Bull/bear is for candles only" was applied to every wall identity in the app through the two palettes, so Pulse's,
the Weigher's, Pinpoint's and Compass's walls changed with Terrain's. Direction figures (a change, an outcome, a flow
leg) keep the pair; say if any of those should move too.

## Section B — the map, now

### B1 · every blank has its reason on the chart

Your 3-pane screenshot did not reach this session (it was in a message this one replaced), so the four blanks are
answered by what the store can say about each — and the chart now says it ITSELF: every run of bars with no column of
the field wears a quiet label with its cause (gexNodesPrimitive `findGaps`, the words from the pane — Terrain
`gapCause` — never a bare blank). A run never crosses the open, the close or a day, so each has one cause:

| the blank | cause the store names | label on the chart | fixed or expected |
|---|---|---|---|
| SPY before "14", QQQ before "14" | the sessions before today are drawn only once the server has rebuilt them (`/feed/field/<NAME>/past?days=`): queued, being rebuilt, failed with why, or beyond the ten sessions the page asks | "queued to rebuild" · "rebuilding on the server" · "not rebuilt · <why>" · "not rebuilt · beyond the ten sessions asked" | expected until the rebuild lands; a failure now says why |
| the pre-market and after-hours bars of any day | the book is read 9:30 to 4:00 New York; no column stands outside it | "no field before the open · the book is read 6:30 am to 1:00 pm" (your clock) · "no field after the close" | expected, by design |
| QQQ's latest candles | the newest column lags the forming bar: a minute's column is knowable at its end and the recorder reads the book once a minute | "live lag · N min" | expected at one to two minutes; more is a recorder that has stopped reading (the stale banner says so) |
| all of AAPL | AAPL is not in RECORD_NAMES (SPY, QQQ, IWM): the recorder starts watching a name when a Terrain tab first asks, reads its chain then, and the field fills from that minute | "chain not read yet · building" before the first read; "not recorded · before the first read" for the minutes before it | expected on a name first opened; to have AAPL from 4:00 am every day add it to RECORD_NAMES |
| today's minutes while the recorder was down | no shown row for them | "not recorded" | real; the rebuild path's final rows fill them after the fact (the agree check) |

A rebuilt day with a hole inside the session says "rebuilt · no column at these minutes". The wall-move chips keep clear of the labels. Shot: shots/b-marks-15m.png (the label over Oct 13's
after-hours run, top left).

### B2 · why the beads were soft slivers, and the mark now

From the code (gexNodesPrimitive.ts before this change): a bead was a RIBBON piece — as wide as its slot so neighbours
touched, its thickness the strength (0.45 px to 60% of a bar's width, so a hairline most of the time), drawn as an
ellipse on fractional coordinates (anti-aliased on both edges), translucent (the core at 0.16–0.66 alpha) over a
wider and fainter halo (1.9× taller, 0.04–0.18 alpha) "so candles show through it", one bead per field minute even on
a 15-minute bar (a slot a fifteenth of the bar). Thin, translucent, blurred-edged, sub-bar: slivers.

Now a mark is a rect on the device-pixel grid — one per strike per candle, the candle's column the bar's peak minute
(timeframe.ts, unchanged) — as wide as the bar's slot less a hairline, its height the strike's size from one pixel to
the strike row's share (capped by the slot's width and 14 px), filled whole, no halo, no pattern, no shadow. The flip
stays a dashed rule of per-column ticks (pixel-aligned now too).

### B3 · what a mark encodes

| channel | reads | source |
|---|---|---|
| size (height) | the GROSS gamma at the strike, calls + puts without sign, √-scaled against the size reference (the session's p85 of per-minute peak gross, the same running count as before, over gross) in ten steps | `GexLevel.gross` — trailModel adds it to every modeled column (the parts already carried it per expiry), the simulator to the house's, the peak-minute fold carries it; store rows of format 2 carry `[strike, net, gross]`, `maxG` and `refG` |
| hue | which side wins: ember puts, glacier calls | the net's sign |
| colour strength | \|net\| ÷ gross — grey when balanced, the ink whole when one-sided (ten steps) | the cell |
| soft edge | stale (half or more of the strike's gamma on vols older than an hour, or carried) — nothing else | the cell's provenance |
| "heaviest" in the zoom-out rule | the three heaviest BY SIZE (gross) | the column's top set |

Gone: the supreme's magenta on a mark, the walls' inks on a mark, the p95 ring, the dotted stale fill, the halo. The
axis chips and the wall-move chips still name the walls and the supreme. Where a tape keeps no gross (store rows
written before today), the mark sizes by \|net\| and the legend says "this tape keeps the net alone".

The legend: "Full size = $4.2B total gamma at a strike per 1% (session p85 of per-minute peaks, as of 12:18 pm) · size
= total gamma at the strike · colour = which side wins · grey = balanced · soft edge = stale · clipped above full"
(SPY, 2026-10-14). The hover card's expanded lines say the two figures: "Total $1.0B at the strike (its size) · 46.6%
one-sided (its colour)" (SPY 780 at 10:40–10:55 am PDT that day).

The proof, scripts/bead-scale-proof.ts, now checks the size step against the gross and the size reference, the
strength against \|net\| ÷ gross, the top set by size, that the colour walks from the grey to the side's ink without
turning back (OKLab), and that the two sides stay apart from half strength up under protan, deutan and tritan
simulation (smallest OKLab distance 0.115, 0.131, 0.119 — a just-noticeable difference is 0.02), and that a replayed
session's size steps equal the live capture's (3,120 marks at 60 random minutes of this machine's 3 sessions, 0
differ). 20 of 20.

### B4 · the change marks

A strike entering the three heaviest (by size) wears a hollow ring on the bar it entered, one device pixel outside
the mark, in its side's ink; one that left them a grey outline where it stood (the slot wide, the tallest mark's
height); a wall move a short vertical tick at the new strike on the bar it moved, two pixels wide, in the wall's ink
(the chips still name the newest three). Shots: shots/b-marks-1m.png (the ticks at "PW 765 → 770 · 9:58 am"),
shots/b-marks-closeup.png.

### B5 · UW's per-minute spot exposures, pulled back through its window

server/seriesBackfill.ts runs on the always-on recorder (server/recorderMain.ts; SERIES_NAMES=SPY,QQQ,SPX,
SERIES_DAYS=730, `off` to stop it): thirty seconds after the recorder starts, and once a day at 5:15 pm New York for
the session just over, it walks back from the session before today, newest first, over weekdays, and writes each
day's `/api/stock/{T}/spot-exposures?date=D` rows AS ANSWERED — every field, UW's `_oi`, `_vol`, `_dir` and the other
greeks' series — to `.feed-cache/field/<NAME>/<D>/series.json`. A day already held (this file, the recorder's own
`total.json`, a rebuilt day carrying the series) is skipped, so a run resumes; a day UW answers empty (a holiday, a day
past its window) is written empty and not asked again; a 429 waits a minute and asks again, a 5xx is left for the next
pass; one call at a time with a pause between, behind the recorder's own reads. ~730 calls a name. scripts/
series-backfill-proof.ts (in `npm test`) runs the rules against a stand-in client: 7 of 7. It has not run against UW
from this machine (no recorder here); the first pass on your machine reports in the recorder's log ("series SPY: done
to <date> — written N, empty N, skipped N, refused N, oldest with rows <date>").

### Store format 2

Rows written from today carry `f: 2`, `maxG`, `refG` and three-figure cells; every reader takes the first two figures
(the track record, the recap, the agree check, the replay), the scorecard's loader hands pairs on. Rows of format 1
read as before. `npm run field:agree` still compares shown against final on the net.
