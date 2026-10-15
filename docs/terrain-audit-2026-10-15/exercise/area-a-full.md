# Terrain audit · Area A, exercised

Run 2026-10-15T07:54:19.430Z against http://127.0.0.1:5181 (commit 521d7de), Chromium headless, 1440 × 900 unless the row says otherwise, America/Los_Angeles. 51 s.

**8 pass · 2 fail · 0 manual** of 10.

Wall-clock timings on a machine shared with two other browser agents — pessimistic. ms runs from the action to the observed result.

| id | item | action → expected | observed | pass | ms |
|---|---|---|---|---|---|
| A-200 | Expanded top strip | press F, look at the strip at rest → the strip stands at rest with identity, toolbar and Collapse | strip visible: Reads SPY — pick anoth · Link this pane to a gr · Compare symbol · 1m — 1m: between its E · 5m, on this pane — 5m: · 15m — 15m: below its E · 1h — 1h: below its EMA · 1D — 1D: not enough hi · No seconds on the feed · 1m · 5m · 15m · 30m · 1h · 1D · 1W · Replay session history · Indicators and scripts · Alerts · Chart style & price sc · Overlays · Candle theme · Glacier · Collapse SPY _(not in fullscreen: age chip, window control, jumps, calendar, ? door, pop-out, walls lens, bead basis, floor, Every strike, Legend door)_ | pass |  |
| A-201 | "REPLAY" button (expanded) | click it, then click it again → the replay badge comes up; the button says it is pressed; then off | "Replay"; on → badge (aria-pressed true); off → gone; still expanded true | pass | 346 |
| A-202 | Collapse (minimize icon) | press F, click Collapse → the pane returns to the grid | collapsed; .hit no | pass | 407 |
| A-203 | Second line "SPY · 5m · $… · %" | read it → ticker · timeframe · price · change | "SPY·5m·$767.15−0.32%" | pass |  |
| A-204 | Desk bar (floating in fullscreen) | look at it at rest, then hover it → floating at 40% until hovered, then 100% | floating, opacity 0.4 at rest → 1 under the pointer | pass | 1339 |
| A-225 | "PINE" (fullscreen only) | click it → the script editor docks at the right for this pane | no editor — dock none (expanded true, pine door true) | **FAIL** | 16772 |
| A-227 | "× ESC" chip (fullscreen only) | click it → the pane collapses | collapsed; accessible name "Esc" | pass | 350 |
| A-234 | `F` | press f, then f again → "SPY expanded", then collapsed | expand: "SPY expanded"; again: collapsed ("SPY collapsed") | pass | 261 |
| A-246 | Esc (fullscreen) | press F, then Esc → the pane collapses | collapsed | pass | 22 |
| A-248 | Esc closes the open menu, not the pane | in fullscreen open Overlays, press Esc → the menu closes; the pane stays expanded | Overlays: menu closed, pane still expanded; layouts shelf (focus on its button): Esc left the shelf open and collapsed the pane | **FAIL** | 34 |
