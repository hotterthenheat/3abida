# Terrain audit · Area A, exercised

Run 2026-10-15T07:38:21.419Z against http://127.0.0.1:5181 (commit 521d7de), Chromium headless, 1440 × 900 unless the row says otherwise, America/Los_Angeles. 51 s.

**60 pass · 1 fail · 0 manual** of 61.

Wall-clock timings on a machine shared with two other browser agents — pessimistic. ms runs from the action to the observed result.

| id | item | action → expected | observed | pass | ms |
|---|---|---|---|---|---|
| A-98 | The hover row itself | move the pointer off the pane, onto it, off again, then Tab into the pane → hidden at rest; display flex on hover and on focus-within | at rest none; on hover flex; on focus flex; holds: No seconds on the feed h · 1m · 5m · 15m · 30m · 1h · 1D · 1W · Indicators and scripts · Chart style & price scal · Candle theme · Glacier · The reference grows thro · One reference for the wh · One reference for the wh · Off · 5% · 10% · 25% · The bead legend's line — | pass | 321 |
| A-99 | Hover-row timeframe (trigger or strip) | hover the pane, open the timeframe control → a list of the 8 timeframes | strip form: 15s 1m 5m 15m 30m 1h 1D 1W _(the header shows the same timeframe as tabs: two controls for one state in one pane)_ | pass |  |
| A-100 | Hover-row option "15s" | pick 15s from the hover row → disabled on the feed, with its reason | disabled true; title "No seconds on the feed here yet — the panes draw bars of a minute and up" | pass |  |
| A-101 | Hover-row option "1m" | pick 1m from the hover row → the pane on 1m | config 1m, chart 1m | pass | 478 |
| A-102 | Hover-row option "5m" | pick 5m from the hover row → the pane on 5m | config 5m, chart 5m | pass | 446 |
| A-103 | Hover-row option "15m" | pick 15m from the hover row → the pane on 15m | config 15m, chart 15m | pass | 439 |
| A-104 | Hover-row option "30m" | pick 30m from the hover row → the pane on 30m | config 30m, chart 30m | pass | 625 |
| A-105 | Hover-row option "1h" | pick 1h from the hover row → the pane on 1h | config 1h, chart 1h | pass | 629 |
| A-106 | Hover-row option "1D" | pick 1D from the hover row → the pane on 1D | config 1D, chart 1D | pass | 395 |
| A-107 | Hover-row option "1W" | pick 1W from the hover row → the pane on 1W | config 1W, chart 1W | pass | 249 |
| A-108 | "Indicators" door (with count) | open it, search EMA, turn on "EMA 21", then off → the library opens; the count chip goes up by one | library open; "pineEMA ribbonThe 9, 21 and 50 exponenti" on → count 0→1; off → back | pass | 149 |
| A-109 | "Candles" door (chart style & price scale) | click it → the style, scale, bar clock and Export PNG menu opens | menu: CandlesHollow candlesBarsLineStep lineAreaBaselinePrice scaleLINLOG%100Bar clockTime$0.50$210k50kExport PNG | pass | 116 |
| A-110 | Style "Candles" | pick Candles → chartStyle === candles; the menu closes | chartStyle candles; menu closed | pass | 227 |
| A-111 | Style "Hollow candles" | pick Hollow candles → chartStyle === hollow; the menu closes | chartStyle hollow; menu closed | pass | 480 |
| A-112 | Style "Bars" | pick Bars → chartStyle === bars; the menu closes | chartStyle bars; menu closed | pass | 394 |
| A-113 | Style "Line" | pick Line → chartStyle === line; the menu closes | chartStyle line; menu closed | pass | 445 |
| A-114 | Style "Step line" | pick Step line → chartStyle === step; the menu closes | chartStyle step; menu closed | pass | 164 |
| A-115 | Style "Area" | pick Area → chartStyle === area; the menu closes | chartStyle area; menu closed | pass | 392 |
| A-116 | Style "Baseline" | pick Baseline → chartStyle === baseline; the menu closes | chartStyle baseline; menu closed | pass | 419 |
| A-117 | "Price scale" label | open the menu, read the section → a "Price scale" head over four chips | head present; chips LIN LOG % 100 | pass |  |
| A-118 | Scale "LIN" | pick LIN → priceScale === normal | priceScale normal; the chart's right scale mode 0 | pass | 398 |
| A-119 | Scale "LOG" | pick LOG → priceScale === log | priceScale log; the chart's right scale mode 1 | pass | 466 |
| A-120 | Scale "%" | pick % → priceScale === percent | priceScale percent; the chart's right scale mode 2 | pass | 464 |
| A-121 | Scale "100" | pick 100 → priceScale === indexed | priceScale indexed; the chart's right scale mode 3 | pass | 395 |
| A-122 | Bar clock "Time" | pick Time → clock === time | clock time; chart SPY\|5m\|1000 | pass | 386 |
| A-123 | Bar clock "$0.50" | pick $0.50 → clock === r50; the held overlays dim | clock r50; chart SPY\|5m\|1000 | pass | 456 |
| A-124 | Bar clock "$2" | pick $2 → clock === r200; the held overlays dim | clock r200; chart SPY\|5m\|1000; 10 overlay rows held | pass | 415 |
| A-125 | Bar clock "10k" | pick 10k → clock === v10k; the held overlays dim | clock v10k; chart SPY\|5m\|1000 | pass | 458 |
| A-126 | Bar clock "50k" | pick 50k → clock === v50k; the held overlays dim | clock v50k; chart SPY\|5m\|1000 | pass | 407 |
| A-127 | Rule-bar note | with $2 picked, read the note in the menu → the note says what the feed folds (its one-minute bars) | "Rule bars fold the one-minute bars, their history included — the interval-based overlays sit out." | pass |  |
| A-128 | "Export PNG" | click it → a PNG downloads | downloaded "SPY-5m-202610150737.png" (131924 bytes) | pass | 493 |
| A-129 | "Theme" door | click it → the candle theme list with a live preview | 13 themes; preview canvas drawn | pass | 186 |
| A-130 | Theme "Glacier" | pick Glacier → theme === glacier; the pane's ground follows | theme glacier; ground light → dark | pass | 333 |
| A-131 | Theme "Foil" | pick Foil → theme === foil; the pane's ground follows | theme foil; ground dark → dark | pass | 361 |
| A-132 | Theme "Chrome" | pick Chrome → theme === chrome; the pane's ground follows | theme chrome; ground dark → dark | pass | 386 |
| A-133 | Theme "Velvet" | pick Velvet → theme === velvet; the pane's ground follows | theme velvet; ground dark → dark | pass | 443 |
| A-134 | Theme "Mono" | pick Mono → theme === mono; the pane's ground follows | theme mono; ground dark → dark | pass | 377 |
| A-135 | Theme "Neon" | pick Neon → theme === classic; the pane's ground follows | theme classic; ground dark → dark | pass | 454 |
| A-136 | Theme "Market" | pick Market → theme === market; the pane's ground follows | theme market; ground dark → dark | pass | 467 |
| A-137 | Theme "Tide" | pick Tide → theme === tide; the pane's ground follows | theme tide; ground dark → dark | pass | 393 |
| A-138 | Theme "Harbor" | pick Harbor → theme === harbor; the pane's ground follows | theme harbor; ground dark → dark | pass | 280 |
| A-139 | Theme "Whipsaw" | pick Whipsaw → theme === whipsaw; the pane's ground follows | theme whipsaw; ground dark → dark | pass | 438 |
| A-140 | Theme "Contrast" | pick Contrast → theme === contrast; the pane's ground follows | theme contrast; ground dark → dark | pass | 484 |
| A-141 | Theme "Wire" | pick Wire → theme === wire; the pane's ground follows | theme wire; ground dark → dark | pass | 398 |
| A-142 | Theme "Stone" | pick Stone → theme === stone; the pane's ground follows | theme stone; ground dark → light | pass | 466 |
| A-143 | Preview and "Use Tide" | hover Tide in the list, then click Use → the preview redraws for Tide; Use applies it | preview button "Use Tide" (after moving onto it "Use Tide"); Use → theme tide | pass | 152 |
| A-144 | Walls lens "GEX" | with the walls overlay on, click GEX → wallsLens === gex | wallsLens gex; pressed true | pass | 155 |
| A-145 | Walls lens "Charm" | with the walls overlay on, click Charm → wallsLens === charm | wallsLens charm; pressed true | pass | 449 |
| A-146 | Walls lens "DEX" | with the walls overlay on, click DEX → wallsLens === dex | wallsLens dex; pressed true | pass | 226 |
| A-147 | Bead basis "Session so far" | click Session so far → beadBasis unset; the legend's basis follows (or says it fell back) | beadBasis (unset); legend basis session — "…y ·grey = balanced ·soft edge = stale ·Full size = $5.7B per 1% · the session's largest so far, as of 12:59 pm" | pass | 228 |
| A-148 | Bead basis "Fixed" | click Fixed → beadBasis === fixed; the legend's basis follows (or says it fell back) | beadBasis fixed; legend basis fixed — "…ft edge = stale ·Full size = $62.8B per 1% · the largest over the 13 sessions before Oct 14, fixed for the day" | pass | 186 |
| A-149 | Bead basis "Prior session" | click Prior session → beadBasis === prior; the legend's basis follows (or says it fell back) | beadBasis prior; legend basis prior — "…= amplify ·grey = balanced ·soft edge = stale ·Full size = $62.8B per 1% · the prior session's largest, Oct 13" | pass | 190 |
| A-150 | "Every strike" checkbox | check it, then uncheck it → beadDensity === false, then unset | checked → beadDensity false: true; unchecked → unset: true | pass | 148 |
| A-151 | Floor "Off" | click Off → beadFloor unset | beadFloor (unset); legend names it | pass | 374 |
| A-152 | Floor "5%" | click 5% → beadFloor === 0.05; the legend says what is hidden | beadFloor 0.05; legend names it | pass | 260 |
| A-153 | Floor "10%" | click 10% → beadFloor === 0.1; the legend says what is hidden | beadFloor 0.1; legend names it | pass | 330 |
| A-154 | Floor "25%" | click 25% → beadFloor === 0.25; the legend says what is hidden | beadFloor 0.25; legend names it | pass | 331 |
| A-155 | "Legend" door | click it twice → legend === false and the legend goes; then it comes back | off: legend gone; on: back | pass | 355 |
| A-156 | Bead legend (full form) | read the legend on a wide pane → the full words: size, gold, violet, grey, soft edge, the scale | form full; "size = total gamma at the strike ·gold = absorb ·violet = amplify ·grey = balanced ·soft edge = stale ·Full size = $5.7B per 1% · the session's largest so far, as of 12:59 pm" | pass |  |
| A-157 | Decision strip | look for it under the header → present (its boxes are another area's) | "—▲PW 770 +$2.85 0.5σ · ▼ —±$5.97 to close · budget · −0.4σ day2 sessions · 153 touches · thinOI dated Oct 14 · book figured 1:15 pm" _(presence only — the boxes belong to another area)_ | pass |  |
| A-158 | Crosshair readout | hover a bar → the readout shows the bar's figures | exercise error: Cannot read properties of null (reading 'x') _(the step itself threw; see observed)_ | **FAIL** |  |
