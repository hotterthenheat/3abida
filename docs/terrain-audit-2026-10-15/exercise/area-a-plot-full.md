# Terrain audit · Area A, exercised

Run 2026-10-15T07:51:28.755Z against http://127.0.0.1:5181 (commit 521d7de), Chromium headless, 1440 × 900 unless the row says otherwise, America/Los_Angeles. 80 s.

**17 pass · 5 fail · 0 manual** of 22.

Wall-clock timings on a machine shared with two other browser agents — pessimistic. ms runs from the action to the observed result.

| id | item | action → expected | observed | pass | ms |
|---|---|---|---|---|---|
| A-165 | Day panel (1D: click a day bar) | on 1D, click a day bar → the panel opens: the day, close, regime, walls, flip, nearest strikes, UW's end-of-day book | 2026-10-09: "Oct 9close 778.57×At the day's last modeled column (12:59 pm)Regime: calls absorb −$6.3B, no reference yet · attribution uncheckedCW 785 · PW 755 · flip 774.19Nearest the close: 779 −$221M · 778 −$284M · 780 −$1.2BUnusua" | pass | 143 |
| A-166 | Day panel close "×" (and Esc) | press Esc; reopen; click × → Esc closes it (its title says "Close — Esc"); × closes it | Esc closed it; × closed it _(Esc took 91 ms)_ | pass | 157 |
| A-167 | "Open this session · 5m" | open the panel, click it → the pane goes to 5m on that day | day 2026-10-08; timeframe 5m; view 2026-10-07T19:55 → 2026-10-09T11:55Z | pass | 328 |
| A-168 | "Replay this day" | on 1D, open the panel, click it → the replay starts at 9:30 New York that day (6:30 am on this Los Angeles clock) | day 2026-10-09; badge "Replay· Oct 9 · 4:59 pm" | **FAIL** | 298 |
| A-193 | Level card header (right-click on a level) | right-click on Flip 777.54+$10.39 → the card names the level within 8 px, placed at the cursor | "The flip · 777.54"; card at +0,-1 px from the cursor (+4,+4 is the design); focus stays outside the card | pass | 474 |
| A-194 | "Alert on this level (follows it)" | click it → the level watch for SPY includes this level | watch {"ids":["flip"],"confirmBars":3} | pass | 839 |
| A-195 | "Stop the alert on the flip" | right-click the watched level, click Stop → the id leaves the watch | "Stop the alert on the flipSPY's watch lets the flip go"; watch after null; no undo offered | pass | 720 |
| A-196 | Flip confirmation "1" | right-click the watched flip, click 1 → confirmBars === 1 | offered 1 2 3; confirmBars 1 _(only 1, 2, 3 offered; the store and CLAUDE.md allow 1 to 5)_ | pass | 773 |
| A-197 | Flip confirmation "2" | right-click the watched flip, click 2 → confirmBars === 2 | offered 1 2 3; confirmBars 2 _(only 1, 2, 3 offered; the store and CLAUDE.md allow 1 to 5)_ | pass | 815 |
| A-198 | Flip confirmation "3" | right-click the watched flip, click 3 → confirmBars === 3 | offered 1 2 3; confirmBars 3 _(only 1, 2, 3 offered; the store and CLAUDE.md allow 1 to 5)_ | pass | 698 |
| A-199 | "Reset chart view · Alt+R" (in the level card) | pan the view back, right-click the level, click Reset → the view returns to the opening view | view to 10-15T02:50 → panned 10-13T14:20 → reset 10-15T02:50Z | pass | 873 |
| A-200 | Expanded top strip | press F, look at the strip at rest → the strip stands at rest with identity, toolbar and Collapse | strip visible: Reads SPY — pick anoth · Link this pane to a gr · Compare symbol · 1m — 1m: between its E · 5m, on this pane — 5m: · 15m — 15m: below its E · 1h — 1h: below its EMA · 1D — 1D: not enough hi · No seconds on the feed · 1m · 5m · 15m · 30m · 1h · 1D · 1W · Replay session history · Indicators and scripts · Alerts · Chart style & price sc · Overlays · Candle theme · Glacier · Collapse SPY _(not in fullscreen: age chip, window control, jumps, calendar, ? door, pop-out, walls lens, bead basis, floor, Every strike, Legend door)_ | pass |  |
| A-201 | "REPLAY" button (expanded) | click it, then click it again → the replay badge comes up; the button says it is pressed; then off | "Replay"; on → badge (aria-pressed true); off → gone; still expanded true | pass | 373 |
| A-202 | Collapse (minimize icon) | press F, click Collapse → the pane returns to the grid | collapsed; .hit no | pass | 292 |
| A-203 | Second line "SPY · 5m · $… · %" | read it → ticker · timeframe · price · change | "SPY·5m·$767.15−0.32%" | pass |  |
| A-204 | Desk bar (floating in fullscreen) | look at it at rest, then hover it → floating at 40% until hovered, then 100% | docked, opacity 1 at rest → 1 under the pointer | **FAIL** | 132 |
| A-225 | "PINE" (fullscreen only) | click it → the script editor docks at the right for this pane | no Pine door | **FAIL** |  |
| A-227 | "× ESC" chip (fullscreen only) | click it → the pane collapses | exercise error: locator.evaluate: Timeout 8000ms exceeded. _(the step itself threw; see observed)_ | **FAIL** |  |
| A-234 | `F` | press f, then f again → "SPY expanded", then collapsed | expand: "SPY expanded"; again: collapsed ("SPY collapsed") | pass | 201 |
| A-246 | Esc (fullscreen) | press F, then Esc → the pane collapses | collapsed | pass | 15 |
| A-248 | Esc closes the open menu, not the pane | in fullscreen open Overlays, press Esc → the menu closes; the pane stays expanded | Overlays: menu closed, pane still expanded; layouts shelf (focus on its button): Esc left the shelf open and collapsed the pane | **FAIL** | 65 |
| A-249 | Alt+R | pan the view back, hover the chart, press Alt+R → the view under the pointer resets | view reset to the opening view | pass | 60 |
