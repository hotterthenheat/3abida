# Terrain audit · Area A, exercised

Run 2026-10-15T07:33:25.898Z against http://127.0.0.1:5181 (commit 521d7de), Chromium headless, 1440 × 900 unless the row says otherwise, America/Los_Angeles. 92 s.

**61 pass · 12 fail · 0 manual** of 73.

Wall-clock timings on a machine shared with two other browser agents — pessimistic. ms runs from the action to the observed result.

| id | item | action → expected | observed | pass | ms |
|---|---|---|---|---|---|
| A-03 | Symbol chip "[logo] SPY ▾" | click the chip → the "Change symbol" dialog opens | dialog open: "Change symbol — currently SPY" | pass | 963 |
| A-04 | Symbol picker dialog (search and list) | type "QQQ", press Enter → the pane changes to QQQ (config and chart) and the dialog closes | config QQQ, chart QQQ, dialog closed _(ms = Enter to the QQQ chart drawn with bars)_ | pass | 1103 |
| A-11 | Compare "+" | click the + → the compare panel opens with the "Compare symbols…" input (not clipped) | panel open; panel box [367,46,747,334] in pane [242,6,1434,858] (whole) | pass | 430 |
| A-12 | Compare search "Compare symbols…" | type "QQQ", then Esc → listbox rows appear; Esc closes the panel | 4 option row(s); Esc closed the panel | pass | 81 |
| A-13 | Compare mode "Same % scale" | type QQQ, hover the row, click "Same % scale" → compares gains {QQQ, percent}; the legend row "QQQ … ×" appears | compares [{"ticker":"QQQ","mode":"percent","ink":"#5B9CF6"}]; legend row shown | pass | 355 |
| A-14 | Compare mode "New price scale" | add IWM with "New price scale" → mode `scale`; the header strip takes a left padding | exercise error: locator.hover: Timeout 8000ms exceeded. _(the step itself threw; see observed)_ | **FAIL** |  |
| A-15 | Compare mode "New pane" | add NVDA with "New pane" → mode `pane` | exercise error: locator.hover: Timeout 8000ms exceeded. _(the step itself threw; see observed)_ | **FAIL** |  |
| A-16 | "Added symbols" list, remove × | open the panel, click "Remove IWM comparison" → IWM leaves `compares` | exercise error: locator.click: Timeout 8000ms exceeded. _(the step itself threw; see observed)_ | **FAIL** |  |
| A-17 | Compare legend row "QQQ $… ×" | click the legend row × → the row disappears and `compares` shrinks | exercise error: locator.click: Timeout 8000ms exceeded. _(the step itself threw; see observed)_ | **FAIL** |  |
| A-22 | Change "+0.42%" | read the header change against the rail → a signed percent in the direction ink with data-dir; agrees with the rail | header −0.32% (data-dir down, bear ink); rail -0.32% | **FAIL** |  |
| A-24 | Timeframe tab "1m" | click the 1m tab → config and chart on 1m; the tab aria-pressed | config 1m, chart 1m, aria-pressed true _(ms = click to the chart drawn on the new timeframe)_ | pass | 523 |
| A-25 | Timeframe tab "5m" | click the 5m tab → config and chart on 5m; the tab aria-pressed | config 5m, chart 5m, aria-pressed true _(ms = click to the chart drawn on the new timeframe)_ | pass | 288 |
| A-26 | Timeframe tab "15m" | click the 15m tab → config and chart on 15m; the tab aria-pressed | config 15m, chart 15m, aria-pressed true _(ms = click to the chart drawn on the new timeframe)_ | pass | 237 |
| A-27 | Timeframe tab "1h" | click the 1h tab → config and chart on 1h; the tab aria-pressed | config 1h, chart 1h, aria-pressed true _(ms = click to the chart drawn on the new timeframe)_ | pass | 435 |
| A-28 | Timeframe tab "1D" | click the 1D tab → config and chart on 1D; the tab aria-pressed | config 1D, chart 1D, aria-pressed true _(ms = click to the chart drawn on the new timeframe)_ | pass | 487 |
| A-29 | Current timeframe label "30m" beside the tabs | set 30m from the hover row → the label "30m" appears beside the tabs | label "30m" | pass | 298 |
| A-44 | Jump trigger "Jump ▾" | click it → the jump list opens with 6 rows with hints | 6 rows: TodayThe session f \| 1WThe last week —  \| 1MThe last month — \| 6MSix months of da \| 1YA year of day ba \| MaxEverything the  | pass | 81 |
| A-45 | Jump "Today" | on 1h, Jump ▾ → Today → the pane goes to 5m and the view spans the session | timeframe 5m; view 1.3 days wide, ending at the newest bar _(ms = click to the chart drawn on the jump's timeframe)_ | pass | 472 |
| A-46 | Jump "1W" | on 5m, Jump ▾ → 1W → the pane goes to 15m and the view spans 1W | timeframe 15m; view 2.5 days wide, ending at the newest bar _(ms = click to the chart drawn on the jump's timeframe)_ | **FAIL** | 381 |
| A-47 | Jump "1M" | on 5m, Jump ▾ → 1M → the pane goes to 1h and the view spans 1M | timeframe 1h; view 8.7 days wide, ending at the newest bar _(ms = click to the chart drawn on the jump's timeframe)_ | **FAIL** | 388 |
| A-48 | Jump "6M" | on 5m, Jump ▾ → 6M → the pane goes to 1D and the view spans 6M | timeframe 1D; view 124.0 days wide, ending at the newest bar _(ms = click to the chart drawn on the jump's timeframe)_ | **FAIL** | 515 |
| A-49 | Jump "1Y" | on 5m, Jump ▾ → 1Y → the pane goes to 1D and the view spans 1Y | timeframe 1D; view 124.0 days wide, ending at the newest bar _(ms = click to the chart drawn on the jump's timeframe)_ | **FAIL** | 631 |
| A-50 | Jump "Max" | on 5m, Jump ▾ → Max → the pane goes to 1D and the view spans Max | timeframe 1D; view 124.0 days wide, ending at the newest bar _(ms = click to the chart drawn on the jump's timeframe)_ | **FAIL** | 550 |
| A-51 | Calendar door | click the calendar icon → "Jump to a day" opens with a date field and Go | card open with the date field | pass | 134 |
| A-52 | Date field "Jump to a day" | set 2026-10-09 → the field holds the day; min = first bar, max = today (New York) | value 2026-10-09, min 2025-04-02, max 2026-10-15 | pass |  |
| A-53 | "Go" | click Go → the card closes and the view jumps to Oct 9 | view 2026-10-08T19:50 → 2026-10-12T12:05Z on 5m; card closed | pass | 355 |
| A-54 | Header Alerts door (bell) | click it → the alerts menu opens for this name | menu open ("Alert price for SPY") | pass | 137 |
| A-55 | Header Overlays door (layers + count) | click it → the 14 overlay switches open | 14 switches; the door's accessible name "2" | pass | 146 |
| A-56 | Replay door in the header | find the Replay door in a docked pane and click it twice → it renders, puts the replay badge up, then takes it down | door renders (title "Replay session history — P"); on → badge up (aria-pressed true); off → badge gone | pass | 360 |
| A-57 | "?" door | click it → the keys sheet opens, listing Terrain's keys | sheet open; Terrain \| Terrain · the desk \| Terrain · the active chart; Esc closed it | pass | 400 |
| A-58 | Pop-out door | click it → a window opens on /out/terrain with the same name and timeframe | popup /out/terrain?pane=%7B%22ticker%22%3A%22SPY%22%2C%22timeframe%22%3A%221D%22%2C%22overlays%22%3A%7B%22trails%22%3Atrue%2C%22levels%22%3Afalse%2C%22darkpool%22%3Afalse%2C%22volume%22%3Atrue%2C%22flow%22%3Afalse%2C%22netDrift%22%3Afalse%2C%22volDrift%22%3Afalse%2C%22dexStrike%22%3Afalse%2C%22session%22%3Afalse%2C%22cone%22%3Afalse%2C%22events%22%3Afalse%2C%22regime%22%3Afalse%2C%22alerts%22%3Afalse%2C%22walls%22%3Afalse%2C%22phases%22%3Afalse%7D%2C%22indicators%22%3A%7B%22ema9%22%3Afalse%2C%22ema21%22%3Afalse%2C%22ema50%22%3Afalse%2C%22vwap%22%3Afalse%2C%22bb%22%3Afalse%2C%22vwapBands%22%3Afalse%2C%22sma%22%3Afalse%2C%22rsi%22%3Afalse%2C%22macd%22%3Afalse%2C%22atrPane%22%3Afalse%7D%2C%22chartStyle%22%3A%22candles%22%2C%22clock%22%3A%22time%22%2C%22compares%22%3A%5B%7B%22ticker%22%3A%22QQQ%22%2C%22mode%22%3A%22percent%22%2C%22ink%22%3A%22%235B9CF6%22%7D%5D%2C%22priceScale%22%3A%22normal%22%2C%22sessionOr%22%3A30%2C%22ladder%22%3Afalse%2C%22lane%22%3A%22size%22%2C%22link%22%3Anull%2C%22seen%22%3A1792049517319%7D&rail=%7B%22palette%22%3A%22house%22%2C%22rails%22%3A%22house%22%2C%22railCut%22%3A%22book%22%7D (1100×700), chart SPY 1D; its ? door opens nothing (no shell there); F in it did nothing _(ms = click to the pop-out's chart drawn)_ | **FAIL** | 5239 |
| A-59 | Expand door | click it → the pane becomes role=dialog "SPY expanded"; the desk bar floats | not expanded | **FAIL** | 9413 |
| A-60 | Price box (placeholder = spot) | type 780, press Enter → a price alert at 780 is armed for SPY | placeholder "767.15"; 1 alert(s) stored, one at 780 | pass | 180 |
| A-61 | "Set" | type 781, click Set → the alert is armed and the refusal clears | armed true; refusal after cleared; the same price again → "There is already an alert there" | pass | 106 |
| A-62 | Refusal line | type "abc", click Set → "That is not a price" | "That is not a price" | pass | 286 |
| A-63 | Alerts chip "Call wall" | click it, then click it again → aria-pressed true (an alert armed), then false | on: pressed true (alerts 2→3); off: released (→2) | pass | 128 |
| A-64 | Alerts chip "Put wall" | click it, then click it again → aria-pressed true (an alert armed), then false | on: pressed true (alerts 2→3); off: released (→2) | pass | 104 |
| A-65 | Alerts chip "Flip" | click it, then click it again → aria-pressed true (an alert armed), then false | on: pressed true (alerts 2→3); off: released (→2) | pass | 134 |
| A-66 | Alerts chip "Supreme" | click it, then click it again → aria-pressed true (an alert armed), then false | on: pressed true (alerts 2→3); off: released (→2) | pass | 121 |
| A-67 | Alerts chip "VWAP" | click it, then click it again → aria-pressed true (an alert armed), then false | on: pressed true (alerts 2→3); off: released (→2) | pass | 103 |
| A-68 | Alerts chip "EMA 9" | click it, then click it again → aria-pressed true (an alert armed), then false | on: pressed true (alerts 2→3); off: released (→2) | pass | 109 |
| A-69 | Alerts chip "EMA 21" | click it, then click it again → aria-pressed true (an alert armed), then false | on: pressed true (alerts 2→3); off: released (→2) | pass | 208 |
| A-70 | Alerts chip "EMA 50" | click it, then click it again → aria-pressed true (an alert armed), then false | on: pressed true (alerts 2→3); off: released (→2) | pass | 102 |
| A-71 | Alerts chip "RSI 70" | click it, then click it again → aria-pressed true (an alert armed), then false | on: pressed true (alerts 2→3); off: released (→2) | pass | 97 |
| A-72 | Alerts chip "RSI 30" | click it, then click it again → aria-pressed true (an alert armed), then false | on: pressed true (alerts 2→3); off: released (→2) | pass | 111 |
| A-73 | Alerts chip "GEX flips sign" | click it, then click it again → aria-pressed true (an alert armed), then false | on: pressed true (alerts 2→3); off: released (→2) | pass | 104 |
| A-74 | Alerts chip "New supreme" | click it, then click it again → aria-pressed true (an alert armed), then false | on: pressed true (alerts 2→3); off: released (→2) | pass | 112 |
| A-75 | Alerts chip "News lands" | click it, then click it again → aria-pressed true (an alert armed), then false | on: pressed true (alerts 2→3); off: released (→2) | pass | 139 |
| A-76 | Alerts chip "Wall ±2" | click it, then click it again → aria-pressed true (an alert armed), then false | on: pressed true (alerts 2→3); off: released (→2) | pass | 154 |
| A-77 | Alerts chip "Wall ±4" | click it, then click it again → aria-pressed true (an alert armed), then false | on: pressed true (alerts 2→3); off: released (→2) | pass | 93 |
| A-78 | Alerts chip "$250K" | click it, then click it again → aria-pressed true (an alert armed), then false | on: pressed true (alerts 2→3); off: released (→2) | pass | 99 |
| A-79 | Alerts chip "$1M" | click it, then click it again → aria-pressed true (an alert armed), then false | on: pressed true (alerts 2→3); off: released (→2) | pass | 91 |
| A-80 | Alerts chip "$5M" | click it, then click it again → aria-pressed true (an alert armed), then false | on: pressed true (alerts 2→3); off: released (→2) | pass | 77 |
| A-81 | Overlay "Exposure trails" | click the row, then click it again → overlays.trails flips, aria-checked follows, then flips back | on → off (aria-checked false) → back ok; hint "An oval a strike a candle — size the gamma, colour the side "; the legend gone | pass | 364 |
| A-82 | Overlay "Key levels" | click the row, then click it again → overlays.levels flips, aria-checked follows, then flips back | off → on (aria-checked true) → back ok; hint "Call & put walls, flip and supreme, marked on the field" | pass | 117 |
| A-83 | Overlay "Dark pool" | click the row, then click it again → overlays.darkpool flips, aria-checked follows, then flips back | off → on (aria-checked true) → back ok; hint "Off-exchange print lines" | pass | 140 |
| A-84 | Overlay "Volume" | click the row, then click it again → overlays.volume flips, aria-checked follows, then flips back | on → off (aria-checked false) → back ok; hint "Session bars along the floor" | pass | 95 |
| A-85 | Overlay "Flow" | click the row, then click it again → overlays.flow flips, aria-checked follows, then flips back | off → on (aria-checked true) → back ok; hint "Option premium from the tape — calls up, puts down" | pass | 165 |
| A-86 | Overlay "Net drift" | click the row, then click it again → overlays.netDrift flips, aria-checked follows, then flips back | off → on (aria-checked true) → back ok; hint "Running call & put premium totals — the session's lean" | pass | 171 |
| A-87 | Overlay "Vol drift" | click the row, then click it again → overlays.volDrift flips, aria-checked follows, then flips back | off → on (aria-checked true) → back ok; hint "Realised vol off these bars against the implied the feed rep" | pass | 156 |
| A-88 | Overlay "Session levels" | click the row, then click it again → overlays.session flips, aria-checked follows, then flips back | off → on (aria-checked true) → back ok; hint "Yesterday's high, low & close, the opening range and the fir"; opening-range row shown | pass | 139 |
| A-89 | Overlay "Expected move" | click the row, then click it again → overlays.cone flips, aria-checked follows, then flips back | off → on (aria-checked true) → back ok; hint "The ±1σ/±2σ band the options priced for today, and what's le" | pass | 96 |
| A-90 | Overlay "Events" | click the row, then click it again → overlays.events flips, aria-checked follows, then flips back | off → on (aria-checked true) → back ok; hint "Earnings, FOMC/CPI/NFP and the biggest option prints, marked" | pass | 92 |
| A-91 | Overlay "Alert lines" | click the row, then click it again → overlays.alerts flips, aria-checked follows, then flips back | off → on (aria-checked true) → back ok; hint "A dotted line where each price alert waits — the bell tells " | pass | 98 |
| A-92 | Overlay "Walls through the day" | click the row, then click it again → overlays.walls flips, aria-checked follows, then flips back | off → on (aria-checked true) → back ok; hint "Each strike's exposure through the session, drawn behind the" | pass | 92 |
| A-93 | Overlay "Regime strip" | click the row, then click it again → overlays.regime flips, aria-checked follows, then flips back | off → on (aria-checked true) → back ok; hint "The column's net a minute, estimated dealer gamma on an assu" | pass | 216 |
| A-94 | Overlay "Session phases" | click the row, then click it again → overlays.phases flips, aria-checked follows, then flips back | off → on (aria-checked true) → back ok; hint "The open, lunch and power hour as quiet bands on the tape, a" | pass | 118 |
| A-95 | Opening range "5m" | with Session levels on, click 5m → sessionOr === 5 | sessionOr 5; pressed "5m" | pass | 95 |
| A-96 | Opening range "15m" | with Session levels on, click 15m → sessionOr === 15 | sessionOr 15; pressed "15m" | pass | 135 |
| A-97 | Opening range "30m" | with Session levels on, click 30m → sessionOr === 30 | sessionOr 30; pressed "30m" | pass | 107 |
| A-161 | No-data card "No data for Oct 10" · "‹ Previous session" | jump to Saturday 2026-10-10, click Previous session → the card shows; Previous moves the view to Friday Oct 9 | card "No data for Oct 10The tape holds Oct 1 to Oct 14 on this timeframe.‹ Previous sessionNext session ›Back to live"; Previous → view on Oct 9, card gone _(the card came up in 635 ms)_ | pass | 135 |
| A-162 | "Next session ›" | jump to Saturday Oct 10, click Next session → the view moves to Monday Oct 12 | view on Oct 12, card gone _(Next from Sat Sep 5 landed on another no-data card: "No data for Sep 7The tape holds Apr 2 to Oct 14 on this timeframe.‹ Previous sessionNext session ›Back to live" (not holiday-aware))_ | pass | 177 |
| A-163 | "Back to live" (in the no-data card) | jump to a Saturday, click Back to live → the card goes and the view is at the newest bar | card gone, view at the newest bar | pass | 94 |
