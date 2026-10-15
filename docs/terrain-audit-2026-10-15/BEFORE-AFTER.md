# Terrain audit — before and after

The same three exercise scripts (scripts/terrain-exercise/area-a.mjs, area-b.mjs, area-c.mjs), the same machine (this
4-core container), the same dev server, run twice: **before** at 521d7de, the morning of Oct 15 New York, and **after** at
bcdb2f0 — area C's phone group again at this commit, after the phone ladder's ground was fixed. Between the two runs the
scripts changed only where the page changed on purpose or where the script itself was at fault, each said in bcdb2f0's
commit message (a raw-coordinate click made after a locator click had scrolled the page; a menu pressed again while it
was closing; a fade read before it ended; the figures signed since 9115af0; the lane names' 640 px rule; the house card's
"2 of 12"). Rows are matched by id and item; a "manual" row is one a script could not decide (the reason is in its row in
exercise/ and exercise-after/).

| area | before (commit · rows · pass / fail / manual) | after (commit · rows · pass / fail / manual) |
|---|---|---|
| A · header, toolbar, desk bar, keys | 521d7de · 257 · 236 / 17 / 4 | bcdb2f0 · 257 · 251 / 2 / 4 |
| B · the chart, indicators, Pine | 521d7de · 144 · 107 / 16 / 21 | bcdb2f0 · 144 · 122 / 1 / 21 |
| C · panels, states, layouts | 521d7de · 90 · 74 / 14 / 2 | bcdb2f0 · 90 · 86 / 2 / 2 |

### A · header, toolbar, desk bar, keys

**Failed before, pass now (15):** A-17, A-28, A-37, A-46, A-48, A-49, A-50, A-106, A-162, A-164, A-220, A-238, A-244, A-248, A-255

**Failed before, fail now (2):**

| id | item | after | why |
|---|---|---|---|
| A-47 | Jump "1M" | timeframe 1h; the candles in view 2026-09-29 → 2026-10-14 (15.6 days; 32 bars before, -6 after, of 224), reaching the newest bar | data, not a fault: 1M at one hour lands on what the tape holds, and this machine's hourly tiles stop short of a month (README 6h, Not bugs) |
| A-168 | "Replay this day" | exercise error: locator.click: Timeout 8000ms exceeded. —       - element is not enabled | by design: the button is disabled for a day whose minutes this chart does not hold, and says so ("element is not enabled"); replaying any day is proposal 16 (README 6j) |

### B · the chart, indicators, Pine

**Failed before, pass now (15):** B-08, B-73, B-26, B-31, B-34, B-35, B-38, B-59, B-63/input, B-71, B-29, B-56/phone, B-44, D-11, D-12

**Failed before, fail now (1):**

| id | item | after | why |
|---|---|---|---|
| B-41 | "Key levels" overlay | plot cells changed 0 (noise 0); price lines 0 → 0 | for your decision: the Key levels switch changes nothing on the plot (README 6j, item 6) |

### C · panels, states, layouts

**Failed before, pass now (12):** C-16, C-09, C-29b, C-40, C-50, C-29b, C-58, C-35, C-13-phone-off, C-52b, S-1D-view, C-38b

**Failed before, fail now (2):**

| id | item | after | why |
|---|---|---|---|
| 6c-1m | Ladder net vs field net, SPY 1m | 0/10 strikes within 1%; spot 767.91; field column 10/14/2026, 3:59:00 PM NY (60 strikes), ladder 60 rows | by design until you decide: the ladder is Unusual Whales' book, the ovals the modeled field (README 6c; 6j item 1) |
| 6c-5m | Ladder net vs field net, SPY 5m | 1/10 strikes within 1%; field column 10/14/2026, 3:55:00 PM NY | as 6c-1m, and on 5 m the field's cell is the bar's peak minute (README 6c) |

**Seen across the runs, not in the tables:** A-211 (Colours → Thermal) failed inside two of the three full area A runs at
the after commits, with the click timing out, and passed in the third and in four runs of its own group; the script now
keeps the line of Playwright's log that says what stood in the way, so the next failing run names the cause.

## The pictures

Each pair is the same scene from the same script: the before at 521d7de (exercise/), the after at bcdb2f0
(exercise-after/). Where a pair changed for a fix, the caption says what to look for; the rest are the same scene after
every fix, for a look of your own.

| scene | before (521d7de) | after (bcdb2f0) |
|---|---|---|
| **E-phone-overlay**<br>the phone's ladder: before, it took the row and squeezed the chart to a strip, its legend crammed into 70 px; after, it lies over the chart on the pane's own ground (the ground was missing in the first after-run, fixed in this commit) | ![before](exercise/area-c-E-phone-overlay.png) | ![after](exercise-after/area-c-E-phone-overlay.png) |
| **C-stale-night**<br>the night view: the regime chip now reads the last session at night (it was a dash), the strip's words are whole ("budget", "2 sessions"), the wall-move chips paint over the candles, and the Net view leans the puts left with signed figures under a Δ head | ![before](exercise/area-c-C-stale-night.png) | ![after](exercise-after/area-c-C-stale-night.png) |
| **B-1pane-1m**<br>one pane at one minute, at rest | ![before](exercise/area-c-B-1pane-1m.png) | ![after](exercise-after/area-c-B-1pane-1m.png) |
| **B-sides**<br>the Sides view | ![before](exercise/area-c-B-sides.png) | ![after](exercise-after/area-c-B-sides.png) |
| **B-guide**<br>How to read: gold and violet in the reader's palette, the words match what is drawn (it spoke of orange and blue and grey ticks) | ![before](exercise/area-c-B-guide.png) | ![after](exercise-after/area-c-B-guide.png) |
| **B-flow**<br>the flow lane's figures through the house formatter | ![before](exercise/area-c-B-flow.png) | ![after](exercise-after/area-c-B-flow.png) |
| **B-thermal**<br>Colours → Thermal: the ladder re-inked, the ovals and the strip unchanged | ![before](exercise/area-c-B-thermal.png) | ![after](exercise-after/area-c-B-thermal.png) |
| **D-daypanel**<br>the day panel on a daily chart | ![before](exercise/area-c-D-daypanel.png) | ![after](exercise-after/area-c-D-daypanel.png) |
| **D-replay**<br>a replay from the day panel | ![before](exercise/area-c-D-replay.png) | ![after](exercise-after/area-c-D-replay.png) |
| **L-F-expanded**<br>a pane expanded to full screen: the age, the window, the jumps, T and the legend stand there too | ![before](exercise/area-c-L-F-expanded.png) | ![after](exercise-after/area-c-L-F-expanded.png) |
| **E-phone-peek**<br>the phone's peek at the foot (the three strikes nearest the price) | ![before](exercise/area-c-E-phone-peek.png) | ![after](exercise-after/area-c-E-phone-peek.png) |
| **E-phone-guide**<br>How to read on the phone | ![before](exercise/area-c-E-phone-guide.png) | ![after](exercise-after/area-c-E-phone-guide.png) |
| **A-3pane** | ![before](exercise/area-c-A-3pane.png) | ![after](exercise-after/area-c-A-3pane.png) |
| **A-hovercard** | ![before](exercise/area-c-A-hovercard.png) | ![after](exercise-after/area-c-A-hovercard.png) |
| **B-backtolive** | ![before](exercise/area-c-B-backtolive.png) | ![after](exercise-after/area-c-B-backtolive.png) |
| **B-flip-in-view** | ![before](exercise/area-c-B-flip-in-view.png) | ![after](exercise-after/area-c-B-flip-in-view.png) |
| **B-howsure** | ![before](exercise/area-c-B-howsure.png) | ![after](exercise-after/area-c-B-howsure.png) |
| **B-vol** | ![before](exercise/area-c-B-vol.png) | ![after](exercise-after/area-c-B-vol.png) |
| **B-zoomed-out** | ![before](exercise/area-c-B-zoomed-out.png) | ![after](exercise-after/area-c-B-zoomed-out.png) |
| **C-1pane-5m** | ![before](exercise/area-c-C-1pane-5m.png) | ![after](exercise-after/area-c-C-1pane-5m.png) |
| **C-beadcard** | ![before](exercise/area-c-C-beadcard.png) | ![after](exercise-after/area-c-C-beadcard.png) |
| **C-nodata** | ![before](exercise/area-c-C-nodata.png) | ![after](exercise-after/area-c-C-nodata.png) |
| **D-open5m** | ![before](exercise/area-c-D-open5m.png) | ![after](exercise-after/area-c-D-open5m.png) |
| **D-replay-howsure** | ![before](exercise/area-c-D-replay-howsure.png) | ![after](exercise-after/area-c-D-replay-howsure.png) |
| **G-S-blocked** | ![before](exercise/area-c-G-S-blocked.png) | ![after](exercise-after/area-c-G-S-blocked.png) |
| **G-S-denied** | ![before](exercise/area-c-G-S-denied.png) | ![after](exercise-after/area-c-G-S-denied.png) |
| **G-S-nobook** | ![before](exercise/area-c-G-S-nobook.png) | ![after](exercise-after/area-c-G-S-nobook.png) |
| **G-S-stale** | ![before](exercise/area-c-G-S-stale.png) | ![after](exercise-after/area-c-G-S-stale.png) |
| **L1280-1** | ![before](exercise/area-c-L1280-1.png) | ![after](exercise-after/area-c-L1280-1.png) |
| **L1280-2** | ![before](exercise/area-c-L1280-2.png) | ![after](exercise-after/area-c-L1280-2.png) |
| **L1280-3** | ![before](exercise/area-c-L1280-3.png) | ![after](exercise-after/area-c-L1280-3.png) |
| **L1280-4** | ![before](exercise/area-c-L1280-4.png) | ![after](exercise-after/area-c-L1280-4.png) |
| **L1440-1** | ![before](exercise/area-c-L1440-1.png) | ![after](exercise-after/area-c-L1440-1.png) |
| **L1440-2** | ![before](exercise/area-c-L1440-2.png) | ![after](exercise-after/area-c-L1440-2.png) |
| **L1440-3** | ![before](exercise/area-c-L1440-3.png) | ![after](exercise-after/area-c-L1440-3.png) |
| **L1440-4** | ![before](exercise/area-c-L1440-4.png) | ![after](exercise-after/area-c-L1440-4.png) |
| **b28-cone-clock** (area B, the clock held at 3:30 pm)<br>the Net view's sides and signs, the regime chip at night; the readout's clipping at the plot's edge was found in this pair and fixed in bcdb2f0 | ![before](before-after/b28-cone-clock-before.png) | ![after](before-after/b28-cone-clock-after.png) |
| **b06-b12-zoom** (area B)<br>the field's words (wall-move chips, pills) painted over the candles | ![before](before-after/b06-b12-zoom-before.png) | ![after](before-after/b06-b12-zoom-after.png) |
