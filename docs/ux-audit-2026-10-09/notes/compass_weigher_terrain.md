# Compass, The Weigher and Terrain — UX/UI audit (2026-10-09)

Method. I drove the running app at http://localhost:5300 with Playwright Node scripts (the scripts are in the scratchpad, `audit-compass/`). Viewports were 1440×900, 1280×720, 1920×1080 and 390×844 (phone emulation with touch), each in dark and in light (`slayer_theme`). On every route I pressed every control I could reach and ran in-page checks:
- a font-size census (text under 11 px);
- WCAG contrast of text against its nearest solid ancestor;
- clipped text (scrollWidth > clientWidth);
- overlapping text boxes;
- controls with no accessible name;
- hit boxes under 44 px on the phone;
- console errors, page errors and failed requests;
- a scan of visible text, titles, aria-labels and placeholders for the banned words.

All screenshots are in `shots-compass/`; names start with c (Compass), w (Weigher), t (Terrain) or x (cross-checks). Code references are to the current tree (HEAD db27023). The repo was not changed.

Caveat on timing. While these runs went on, the machine's load average was 50–62 on 4 cores, because other agents were running too. Load and paint times measured here (10–30 s to the first board, chain or ladder on a cold load) cannot be blamed on the app; they are listed under Gaps.

Severity scale: **Broken** (wrong or contradictory on screen, or unusable) · **Major** (misleads a trader or blocks a task) · **Minor** (friction, clipping, a rule deviation) · **Polish**.

---

## Q1 — Does every control work, give feedback and reset correctly?

### Takeaway
Most controls work, give feedback and undo cleanly: dropdowns, guides, Esc, layouts, drawing, compare, fullscreen, expiry calendars, the ruler and the deep links. The serious problems are about **truth across surfaces** rather than dead buttons:
- Compass says a target is hit on the board, says it is not on the setup's page, and says it is hit again on the premium chart.
- Board premiums for most names never move and disagree with their own pages.
- The "All kinds" count is inflated.
- The board re-ranks under the pointer, with a select-then-second-click model.
- The Weigher shows an instant projected loss the moment a contract is watched.
- Terrain's visible "1m 5m 15m 1h 1D" strip looks like timeframe tabs but does nothing.

### Cited Findings

#### Compass — the board (/compass)
- **[Broken] Target-hit status contradicts itself across three surfaces.**
  - Where: board card chip `TP1 HIT` → setup page head `Targets 0 of 3 hit` → premium chart `TARGET 1 $1.02 · hit`.
  - Evidence: NVDA 120P shows TP1 HIT on the board ([shot](shots-compass/x-board-before-open.png), [shot](shots-compass/c-dd-compass-expiry-dark.png)), "0 of 3 hit" in its page head ([shot](shots-compass/c3-setup-light.png); log: `NVDA 120P MOVING … Targets 0 of 3 hit`) and "TARGET 1 $1.02 · hit" on the premium view of the same page ([shot](shots-compass/c3-setup-light-premium.png)).
  - Why: there are three derivations:
    - the card uses `hitLevel(setup)` (the simulator's flags) — [SetupScanCard.tsx:45,75](../../src/components/compass/SetupScanCard.tsx);
    - the page scans the tape only from the bar at which the page opened — [CampaignAnalysis.tsx:643-683](../../src/components/compass/CampaignAnalysis.tsx);
    - the premium chart labels its own status — [ContractTrack.tsx:142](../../src/components/compass/ContractTrack.tsx).
  - Fix: one stored source of target and floor status per setup id, read by the card, the table, the page head, both charts and the Tracker.
- **[Broken] Board premiums and break levels for every name except the active one never move all session, and they disagree with the setup page.**
  - Evidence:
    - NVDA 120P is $0.75 on the card at 17:41, 17:57 and 18:30, while its page reads $0.77, $0.80 and $0.91 ([shot](shots-compass/compass-dark-1440.png) vs [shot](shots-compass/x-page-NVDA-120-P-top-setups-odte.png); log `PAGE NVDA… Premium $0.91`).
    - AAPL 190C ($0.68), GOOGL 172.50P ($0.80), JPM 207.50C ($0.74) and ORCL 142C ($0.68) are also identical across 50 minutes.
    - Cause: roster names get a "day-stable lightweight quote" — [simulator.ts:69-75, 1120-1133](../../src/core/simulator.ts).
  - This breaks the owner's rule "Prices agree across desks" (.claude/CLAUDE.md).
  - Fix: price board cards from the same quote the page uses (seed roster names cheaply, or reprice the card on the sweep). At minimum, label card figures "at sweep HH:MM:SS" and make the page start from the same number.
- **[Major] "All kinds" count is inflated.**
  - Where: the Kind menu reads `All kinds · 99` (100 and 101 on other sweeps) while the board under it says `Found 30` (log `KIND All kinds => Found 30`; [shot](shots-compass/c-kind-All_kinds-dark.png)).
  - Why: `scannerCounts.all` sums the per-kind counts, so a setup found by two kinds is counted twice — [Board.tsx:204-217](../../src/pages/compass/Board.tsx).
  - Fix: count distinct ids from `buildCompassView(…, 'all', …)`.
- **[Major] The board re-ranks under the pointer every 10 s.**
  - Evidence: card order changed twice in 25 s (log `ORDER CHANGED at 3 / at 7`); `SCAN_INTERVAL_MS = 10_000` — [Board.tsx:116,172-185,227](../../src/pages/compass/Board.tsx).
  - Interaction with selection: one click selects and a second click opens ([Board.tsx:276-280](../../src/pages/compass/Board.tsx)), so a second click can land on a different card than the one selected.
  - Keyboard: the tab order shifts mid-traversal; the run listed `#7 QQQ 440P`, `#8 BA 180P`, then `#7 SPY 478C`, `#8 MSFT 430C` at the same positions.
  - Fix: hold the order while the pointer is over the board or a card has focus or selection; offer "New order — show"; keep the selected card pinned.
- **[Broken] Table layout is unreadable.**
  - Contract chips are cut: "NVDA 120…", "GOOGL 17", "MSFT 430(".
  - The OPEN column is cut at the box's right edge, and the "Top pick" badge sits under the Expiry column (overlap probe: `"Top pick" x "0DTE"`).
  - During a sweep, rows go missing and the table shows gaps and a grey band (rows 4 and 8 blank in [shot](shots-compass/c-table-dark.png)).
  - Widths: `WIDTHS` gives Expiry 150 px but Contract no width — [SetupScanBoard.tsx:55](../../src/components/compass/SetupScanBoard.tsx).
  - Fix: give Contract at least 170 px; drop the Expiry column (it is the same on every row — say it once in the head); pin Open at the right; turn off row animation or use stable row ids during the 10 s refresh.
- **[Minor] Table sorting stacks.**
  - Clicking headers adds multi-sort indices, so the header reads "2 ·" on # and "CO… 1 ↑" on Contract ([shot](shots-compass/c-table-sorted-dark.png)).
  - Sorting by 1σ, Premium or State left the same first row (log `SORT … first row "4 | NVDA 120P"`).
  - Fix: a plain click replaces the sort; shift adds a key.
- **[Minor] Selecting works, but the feedback is faint.**
  - The selected card gets a hairline white border, and the rail heading changes to "on SPY · the #2 card, SPY 477C".
  - Nothing tells the reader that a second click will open the card; the hint lives only in the truncated sub-line ("a card selects, a se…").
  - Fix: an "Open ↗" affordance or label on the selected card, and an untruncated hint.
- **[Minor] Rail sorting works, but rows animate between contracts.**
  - Column heads GAMMA, VOL/OI, FROM SPOT and EXPOSURE re-rank the rail ([shots](shots-compass/c-rail-sort-VOLOI-dark.png)).
  - Each row's figures roll (AnimatedNumber) and its ink eases over 500 ms from the previous contract's value. A call row was caught in red and a put row in green mid-transition ([shot](shots-compass/c-dd-compass-expiry-dark.png), rows #4 and #5); code [ImpactLeaderboard.tsx:48-54, 202-205](../../src/components/compass/ImpactLeaderboard.tsx).
  - Fix: key rows by contract, and roll only when the same contract's value changes.
- **[Minor] The sentence's "carries the most" reads wrongly when every name has one setup.**
  - Weekly board: "NVDA carries the most, 1 of 15 names" — [Board.tsx:361-368](../../src/pages/compass/Board.tsx).
  - Fix: when the maximum is 1, write "one each across 15 names".
- **[Minor] "Active 16" while the cards say MOVING.**
  - The Active fact counts ACTIVE + MOVING ([Board.tsx:296-300](../../src/pages/compass/Board.tsx)), so the head's figures don't match the chips the reader sees.
  - Fix: add a Moving fact, or caption it "Active · incl. moving".

#### Compass — a setup's page (/compass/:id). Opened: QQQ 409P, NVDA 120P, AAPL 190C, GOOGL 172.50P, JPM 207.50C, SPY 477C, and a driver row QQQ 410C
- **[Major] "found at" is the moment the reader opened the page, not when the sweep found the setup.**
  - The entry and the tape scan restart on every visit.
  - Evidence: `gradedAt = useMemo(() => new Date()…, [id])` — [SetupPage.tsx:558-560](../../src/pages/compass/SetupPage.tsx). Four pages opened at 18:30:11, :18, :25 and :31 each said "found at" that second (log).
  - Effect: a target hit before the visit vanishes from the page, which feeds the contradiction above.
  - Fix: carry the sweep's found time and entry inside the setup or the view store; if the page keeps its own clock, call it "opened at".
- **[Major] Why-text ignores the side.**
  - Every Top-ranked **put** reads "Solid institutional buy walls are supporting price at 409. Market makers … must buy QQQ … forming an automatic protective floor under our entry". Two rows lower the same page says "a put, bearish — dealers must sell the stock" ([shot](shots-compass/c2-setup-why-dark.png), [shot](shots-compass/c3-setup-light.png)).
  - Code: the text is chosen by kind only — [data/compass.ts:92-97](../../src/data/compass.ts).
  - Fix: a side-aware text library (call and put variants for each kind).
- **[Major] Three different premiums for one contract at the same moment.**
  - AAPL 190C: head `Premium $0.76`, Contract tab `PREMIUM $0.82 · FAIR VALUE $0.80`, In dollars `COST $0.73 mid × 100` (log `SETUP head` / `SETUP contract tab`; [shot](shots-compass/c3-setup-contract-tab.png)).
  - Tracker for the same id at the same time: `$0.70` ([shot](shots-compass/c3-tracker-card.png)).
  - Fix: label entry figures (frozen at found) and live figures ("Entry $0.76 · Now $0.82"), and use one rule for which one each block shows.
- **[Minor] Retired-on-arrival is possible.**
  - SPY 477C opened with a red "FLOOR BROKEN — SETUP RETIRED" banner while the board still listed it as ACTIVE or MOVING with TP1 HIT ([shot](shots-compass/x-setup-guide.png), background).
  - Fix: the board must drop or mark retired setups using the same tape test the page uses.
- **[Minor] Impossible addresses render as real setups.**
  - `/compass/SPY-9999-P-rebounds-leaps` renders a full page: "Premium $9337.14 · The case poor · FADING" ([shot](shots-compass/c3-addr_compass_SPY_9999_P_rebounds_leaps.png)).
  - Fix: reject strikes outside the name's chain reach, and show "no setup at this address".
- **Works:**
  - The tabs Why we chose this / Setup / Contract cross-fade, and exactly one pane is visible (log `panes visibility visible,hidden,hidden`).
  - Stock/Premium switches; the contract capsule lists the same strike across 0DTE/Weekly/Swing/LEAPS.
  - Wheel zoom and drag pan work; the crosshair shows the time.
  - Track becomes Untrack and the "Open in Tracker" door slides in; that door lands on the Tracker with the card highlighted.
  - A driver row opens QQQ 410C with Back labelled "QQQ 409P" plus "The board", and Back returns to 409P.
- **[Minor] Stock view scale.**
  - The y-range is stretched to include the targets and the floor, so the candles sit in a thin band (402–419 range, candles at 407–411; [shot](shots-compass/c2-setup-why-dark.png)).
  - The target ticks "1 —, 2 —, 3 —" show no price.
  - Fix: fit to the candles and show off-scale arrows, as the premium view already does ("Off scale ↑ Target 2 $1.45").
- **[Polish]** The dashed "now" line runs through the THEME label of the chart strip ([shot](shots-compass/c2-setup-why-dark.png)).

#### Compass — the Tracker (/compass/tracker)
- **[Major] The Table view has no actions.**
  - Rows don't open, and there is no Review or Untrack; clicking a row did nothing (log `after tracker table row click …/compass/tracker`). See [Tracker.tsx:177-228, 333-338](../../src/pages/Tracker.tsx) and [shot](shots-compass/c2-tracker-table-dark.png).
  - Fix: `onRowClick` → the setup page, plus Review and Untrack cells.
- **[Minor] Review takes a detour.**
  - It navigates to `/compass` with state, and the board then redirects to `/compass/<id>` ([Tracker.tsx handleReview](../../src/pages/Tracker.tsx); [Board.tsx:153-161](../../src/pages/compass/Board.tsx)). The board loads first.
  - Fix: navigate straight to `/compass/${setupIdOf(...)}`.
- **[Minor] Untrack is instant, with no undo** ([shot](shots-compass/c2-tracker-untracked-dark.png)). Fix: a toast with Undo.
- **[Minor] Expiry is guessed.**
  - Weekly = trackedAt + 5 days and 0DTE = the next midnight, whatever the real expiry was — [Tracker.tsx:33-50](../../src/pages/Tracker.tsx). EXPIRED can therefore fire on the wrong day.
  - Fix: store the real expiry date when tracking.
- **Works:** the empty state; Track → "Open in Tracker" lands with the card highlighted; the Cards/Table switch.

#### The Weigher (/weigher)
- **[Broken] A just-watched contract shows an instant projected loss "at the market, now".**
  - 491C: marked `$0.05`, then `PROJECTED RETURN −$5 · $0.00 estimated contract price · Now · 1 DTE · at the market` ([shot](shots-compass/w-watched-dark.png)).
  - 477C: marked `4.77`, then `−$25 · $4.52 estimated`, while `Today's return −$7` is on the same card ([shot](shots-compass/w2-position-card-light.png)).
  - Why: the projection pricer has no tick floor and disagrees with the chain's mark.
  - Fix: at "now, at the market" the projection must equal the mark. Use one pricer, with the $0.05 floor.
- **[Minor] Adding a position silently re-points the desk.**
  - The form defaults to expiry `Fri, Oct 9` (today) while the chain is on Oct 12. After Add, the chain switched from AAPL Puts · Oct 12 to `Calls · Today · Oct 9` (log `POS LIST`).
  - An invalid strike ("abc") disables Add with no message ([shot](shots-compass/w-add-form-bad-dark.png)).
  - Fix: default to the chain's expiry, show an inline error, and announce the re-point ("Desk now on AAPL 190C · Oct 9").
- **[Minor] The ruler works by drag** ("at 475.92, −0.37% from now", return −$114; [shot](shots-compass/w2-ruler-dragged-light.png)) **but a drag doesn't focus it**, so arrow keys don't follow a drag. The slider itself is keyboard-operable (role=slider, [PriceRuler.tsx:163-177](../../src/components/weigher/PriceRuler.tsx)).
- **Works:**
  - Strike chevron drill (Stats, Greeks, The book at 492).
  - Strike click / Premium lens: "SPY 491 Call $0.05 ▼ $0.54" ([shot](shots-compass/w-premium-dark.png)).
  - Watch toggles to a check.
  - By date / By price ([shot](shots-compass/w-by-price-dark.png)).
  - Size + (2 × SPY 491 calls).
  - Side, Reach and Columns menus.
  - Expiry calendar: weekends and past days disabled; Oct 16 picked; header "±2.1% · Oct 16 · Fri" ([shot](shots-compass/w2-expiry-cal-light.png)).
  - Fullscreen chain and chart, Esc exits.
  - Ticker capsule → AAPL.
  - List → Gainers / Losers / Busiest.
  - Guide opens, Esc closes.
  - Resize handle drags; double-click resets.

#### Terrain (/terrain)
- **[Major] The "1m ▼ 5m ▼ 15m ▼ 1h ▼ 1D ▼" strip in every pane head looks like timeframe tabs and is inert.**
  - It is a `<span>` trend read with a hover title ([Terrain.tsx:775-792](../../src/pages/terrain/Terrain.tsx)); clicking "5m" timed out (log `TF GLYPH 5m element SPAN … cursor=auto`).
  - The real timeframe control ("15M ▾") only appears while the pointer is over the chart ([shot](shots-compass/t-one-dark.png) at rest vs [shot](shots-compass/t-crosshair-dark.png)).
  - Fix: either make the strip switch timeframes, or label it as a read ("Trend: 1m ▲ …") in a non-tab style. Keep the active timeframe visible at rest.
- **Works:**
  - Layouts 1–4 ([shots](shots-compass/t-layout4-dark.png)) and keys 1–4.
  - F expands and Esc collapses; Shift+R toggles strikes ([shots](shots-compass/t-key-f-dark.png)).
  - Wheel zoom, drag pan, Reset pill, Alt+R; right-click resets ([shots](shots-compass/t-zoomed-dark.png), [shot](shots-compass/t-reset-dark.png)).
  - Crosshair with an OHLC+V legend and a time label ("Oct 9, 17:30").
  - Hovering the ladder, and clicking to keep a strike: FOCUS 481.00 on the chart plus a foot read ([shot](shots-compass/t-ladder-kept-dark.png)).
  - Ladder/Net; Lanes (Both/Size/Flow); Expiry calendar ("The lit days are the expiries this desk prices"); VOL profile.
  - The How-to-read guide, which closes on Esc.
  - Ticker switch → TSLA; Compare → QQQ (% axis); the Link menu.
  - Drawing: a trendline drawn, selected (floating toolbar) and deleted ([shots](shots-compass/t2-drawn.png), [shot](shots-compass/t2-drawing-selected.png)); the 34-tool sheet with search and tabs ([shot](shots-compass/t-draw-sheet-dark.png)).
  - Rail collapse; STRIKES toggle; Colours Thermal/House; units $ % ATR σ.
  - Named layouts (saved "Audit test 1× TSLA"; Esc closes; [shot](shots-compass/t-layouts-saved-dark.png)).
  - Expanded mode adds PINE and ESC to the desk bar.
- **[Minor] Compare mode.** The axis turns into % for both series, yet the main price box still shows dollars (478.84) on the % axis ([shot](shots-compass/t2-panel-hidden.png)). Fix: show the main series in % too, or label the box "SPY $".

### Inferences
- What works well:
  - Every dropdown and dialog in the three rooms closes on Esc and hands focus back with a visible ring.
  - Not-found handling is excellent: `/compass/XYZ-1-Q-nope` shows "no setup at this address", `/compass/trakcer` offers "Did you mean Tracker?", and the tab title becomes "Page not found" ([shot](shots-compass/c3-addr_compass_trakcer.png)).
  - Name search matches company names ("apple" → AAPL) and has an empty message ("Nothing on the board matches").
  - Deep links and Back are coherent.
  - Terrain's keyboard model is rich and announced: an aria-live region at [Terrain.tsx](../../src/pages/terrain/Terrain.tsx) `sr-only aria-live`.
- The biggest risk is not a dead control but *contradiction*. A trader who sees TP1 HIT, then "0 of 3 hit", then "Target 1 · hit" stops trusting all three. The same goes for a $0.75 card that opens at $0.91. These should be fixed before any polish.

### Gaps
- Not exercised:
  - Pine editor contents; the chart's Alerts, Indicators and Chart-style menus beyond opening.
  - Every one of the 34 drawing tools (only the trendline was drawn).
  - Replay mode ("This pane is replaying history").
  - Link-letter syncing across panes.
  - The Weigher position card's Change and Remove; closing a watched row; Premium-lens timeframes.
  - Compass ContractPick switching tenor.
  - Reduced motion; screen-reader output.
- The Tracker's EXPIRED state could not be produced (it needs a tracked setup from an earlier day).

---

## Q2 — Console errors, failed requests, empty or stuck states, clipped or overlapping text, chart glitches, small text, contrast and light vs dark (1440/1280/1920/390)

### Takeaway
- No failed requests, page errors or console errors on Compass or Terrain. The Weigher logs a repeated React `flushSync` error.
- There is no horizontal page scroll at any width.
- The main visual defects:
  - Terrain's clipped "EXPIRY Every expir…" head and its colliding ladder, counter and chip labels.
  - The Compass Table layout.
  - 7.5–10 px text in the Weigher chain and Terrain legends.
  - Overlaps around the Weigher's floating pills.
- Light mode follows the owner's rules in Terrain: the chart and the ladder share one ground. The drawing rail is grey on paper, not black.

### Cited Findings

#### Errors and loading
- **[Minor] Weigher console:** `Warning: flushSync was called from inside a lifecycle method`, five times, from `FullRow` ([ChainGrid.tsx:158](../../src/components/weigher/ChainGrid.tsx)) and `AgGridReactUi`, after strike clicks and drills (weigher1 log).
- Elsewhere: no page errors and no failed requests. The only warnings were the React Router v7 future-flag warnings, on every route (crawl log).
- **[Minor] Long empty waits on first load (unverified, see the caveat).**
  - Phone Compass was still a skeleton (dark) or "WAITING FOR THE FEED…" (light) after 6 s ([shot](shots-compass/compass-dark-390.png), [shot](shots-compass/compass-light-390.png)).
  - The Weigher on the phone was still a skeleton after 6 s ([shot](shots-compass/weigher-dark-390.png)); phone Terrain was a blank black pane after 6 s ([shot](shots-compass/terrain-dark-390.png)) and painted at 5–6 s on a later run.
  - Fix: if this reproduces on an idle machine, give "Waiting for the feed…" a progress cue and keep the skeleton, not a blank pane.

#### Clipping
- Compass at 1440:
  - board sub-line "…a card selects, a se…" (293/401 px);
  - rail note "…a column head ranks by it · …" (333/432 px);
  - the setup's "The trade" sub-line "0 of 3 targets hit · a put, bea…";
  - the head's "found at 18:03:33, read live since" (dangling).
  - The page line under "Compass" is cut on the phone (358/534 px). Fix: let the lines wrap to two lines at most. See [CompassLayout.tsx:40](../../src/pages/compass/CompassLayout.tsx), [Board.tsx:413](../../src/pages/compass/Board.tsx).
- Compass on the phone: the Expiry and Kind cards show "0DTE · …" and "Top ranke…", so the key choice is hidden ([shot](shots-compass/c3-phone-board-dark.png)).
- **[Major] Terrain pane head "EXPIRY Every expir…"** is clipped in every pane at 1440 (3 panes) and 1280 ([shot](shots-compass/terrain-dark-1440.png), [shot](shots-compass/t2-1280.png)). Fix: shorten to "All expiries", or drop the "EXPIRY" label when the panel is narrow.
- Terrain: the kept-strike foot "…A move here forces ● sell $158M ke…" runs off the panel ([shot](shots-compass/t-ladder-kept-dark.png)).
- Weigher:
  - "YOUR POSITIONS" column "TOTAL" is cut to "TO" at 1440 ([shot](shots-compass/weigher-dark-1440.png)), and "HEDGI…" at 1920 ([shot](shots-compass/w2-1920.png)).
  - Chain headers Mark/Delta/IV/ITM odds/Vol/OI are 3 px short at every width, and the resize bars read as stray "|" characters.
- Compass Table: contract chips and the OPEN column are cut (see Q1).

#### Overlaps and chart glitches
- **[Major] Terrain GEX strike-field chips stack on each other.**
  - QQQ "408 · 10% / 407 · 10% / 406 · 9% / 405 · 19%" sit in about 30 px ([shot](shots-compass/terrain-light-1440.png), [shot](shots-compass/t-layout4-dark.png), [shot](shots-compass/t2-1280.png)). AAPL "195 · 10%" sits over "194 · 10%".
  - Fix: collision layout in `gexNodesPrimitive.ts` (nudge or merge neighbours, or show the top N by weight).
- **[Major] Terrain ladder counters overlap the first strike.**
  - "▲ 21 / ▲ 10 / ▲ 19 / ▲ 26" sit on top of "486/487", "426/428", "195.50" and "485" ([shot](shots-compass/terrain-dark-1440.png), [shot](shots-compass/t2-1280.png)).
  - Dense ladders (QQQ in 3 or 4 panes) put rows about 9 px apart, so the figures touch ([shot](shots-compass/t-layout4-dark.png)).
  - Fix: give the counter its own row, and thin the labels (every 2nd or 5th strike) when the row pitch is under 12 px.
- **[Minor] Terrain:** "flip 478.50" collides with the 479 row's "$256.6M" at 1280 ([shot](shots-compass/t2-1280.png)). The spine curve is drawn through the dollar figures in every ladder.
- **[Minor] Terrain pane head price runs under the expand icon** in 4 panes: "$120.10⤢", "$408.36⤢", "$190.04⤢" ([shot](shots-compass/t-layout4-dark.png)).
- **[Minor] Terrain chart axis and ladder spot disagree for a tick:** 477.80 vs 477.76 (SPY) and 408.20 vs 408.15 (QQQ) ([shot](shots-compass/terrain-dark-1440.png)). Fix: drive both from one tick.
- **[Major] Terrain in 4 panes (and 3 at 1280): the ladder takes about 60% of each pane** and the chart shrinks to about 175 px wide ([shot](shots-compass/t-layout4-dark.png)). The code's own rule says a chart that narrow "stops being a chart". Fix: cap the ladder at about 40% of a pane in multi-pane layouts.
- **[Minor] Terrain and Weigher charts leave the right 25–40% empty.**
  - The time axis runs into the next day ("10", "03:00", "06:00"), squeezing the candles into the left 60% ([shot](shots-compass/t-one-dark.png), [shot](shots-compass/terrain-dark-1440.png); Weigher axis to 19:30 in [shot](shots-compass/w2-1920.png)).
  - Fix: a right offset of about 10–20 bars, or end at the session close.
- **[Minor] Weigher:** the floating "↓ $476.76" jump-to-spot pill sits on the drill's "A MOVE THROUGH IT" text ([shot](shots-compass/w-watched-dark.png), [shot](shots-compass/w-premium-dark.png)). The chart's RESET pill is under the "474 · 9%" chip (light [shot](shots-compass/weigher-light-1440.png), dark [shot](shots-compass/w-watched-dark.png)). Fix: keep the pills out of content, or hide them while a drill is open.
- **[Minor] Drawing rail sits on the candles.**
  - It covers the first ~45 px of every Terrain chart and about 12% of the phone chart ([shot](shots-compass/t2-phone-dark.png)).
  - In light it is a translucent grey slab ([shot](shots-compass/t2-light-one.png)), while the owner's rule says the rail "stays black on either ground".
  - Fix: a solid black rail in light, plus a left gutter or auto-collapse.

#### Small text (census, visible elements)
- **[Major] Weigher chain.**
  - 20 tags at **7.5 px** (WALL/VOID/SHELF/CLIFF) and 164 elements at 10 px (every chain figure); headers are 9 px.
  - The position card's doors and instructions are 9 px (`DOOR_CLS` text-[9px], [PositionDeskCard.tsx](../../src/components/weigher/PositionDeskCard.tsx)).
  - Fix: chain figures at 11–12 px; tags at 10 px or more (or an icon with a tooltip).
- Compass setup page:
  - 8 px chips "TREND ALIGNED / DEALER SUPPORT / RSI CONFIRM" ([CampaignAnalysis.tsx `text-[8px]`](../../src/components/compass/CampaignAnalysis.tsx));
  - 15 labels at 9 px (all "THE NUMBERS BEHIND IT" row keys).
- Compass board: 24 at 9 px and 43 at 10 px (fact labels, card labels, the rail's column heads).
- The Compass guide's sample card renders at about 5–6 px ([shot](shots-compass/c-guide-dark.png)).
- Terrain: 18 under 11 px. The legend "puts amplify / calls absorb / the spine now / at the open / supreme", the "Δ SPOT" and "◂PUTS · CALLS▸" heads, and the trend strip are 8–9 px.

#### Contrast and light vs dark
- The checker found no text under 4.5:1 on Compass (dark), Weigher (dark) or Terrain (both themes).
- **Compass light:**
  - `TP` chips are 3.62:1 at 10 px.
  - Side-inked contract chips are 3.9–4.3:1 at 12 px, and "Breaks …" is 4.0–4.1:1 (log `LIGHT BOARD LOWC`).
  - The owner keeps the direction and warn inks at about 4.3:1 on purpose, so only the **TP1 HIT chip** (smaller and weaker) is flagged as **[Minor]**: make it 11–12 px semibold.
- The Weigher's chart chrome in light read as 1.08:1 in the checker. This is a false positive: the strip sits on a `data-theme="dark"` island drawn on a light chart ground, and it is legible in the screenshot ([shot](shots-compass/w2-light.png)).
- **Terrain light follows the owner's rule:** the chart frame and the ladder both sit on `rgb(232,231,226)` (log `LIGHT GROUNDS {"chartGround":"light",…}`); the ladder uses the paper ramps (maroon/navy) ([shot](shots-compass/t2-light-one.png)).
- The Compass setup chart is a light chart ground inside a `data-theme="dark"` island in light mode; it reads well ([shot](shots-compass/c3-setup-light.png)).

#### Phone (390×844)
- **[Major] Terrain has no strike ladder on phones or tablets.** The rails are `hidden lg:block` ([Terrain.tsx:1925, 2592](../../src/pages/terrain/Terrain.tsx)), so the room's defining panel is missing below 1024 px ([shot](shots-compass/t2-phone-dark.png)). Fix: a Chart|Ladder toggle, or a bottom-sheet ladder.
- **[Major] Weigher chain on the phone** is 556 px wide inside a 358 px card. ITM odds, Vol, OI and the **+ watch** column are off-screen with no scroll cue ([shot](shots-compass/w2-phone-scrolled-light.png)). Fix: a phone column set of Strike / Mark / Delta / +, with the rest in the drill.
- Compass phone cards mostly show no sparkline (only #7 SPY had one; [shot](shots-compass/c3-phone-board-scrolled-dark.png)). Desktop cards all had one.

### Inferences
- The colliding labels in Terrain (chips, counters, flip label, spine) come from one root cause: no label-collision pass. One shared "place labels, drop the weaker one on collision" helper would fix chips, counters and flip tags together.
- The 7.5–10 px chain is the single biggest readability cost in the three rooms. The owner's landing rule (smallest product text ≥ 11 px at 1440) would fail inside the product itself.

### Gaps
- The contrast checker measures against the nearest solid ancestor. Text over canvases and absolutely positioned pills can be mismeasured, and canvas-drawn text (axes, chips, ladder figures) was not measured at all.
- The overlap checker cannot see clipping: the 1920 Weigher "overlaps" were virtualised rows scrolled out of view.
- Timings are unreliable under the machine's load.

---

## Q3 — Information hierarchy, number formatting, colour and tooltips for a trader

### Takeaway
The rooms are dense and mostly well ordered:
- the board's facts → controls → sentence → cards;
- the setup page's head facts → chart → "The trade";
- Terrain's ladder lined up with the price axis.

Formatting is inconsistent, though. There are four date styles, mixed decimals, unsigned percentages and Greek units without labels. Colour is used for data as the owner wants, but some sign and colour pairings mislead. A four-step "case" meter is a public grade in all but name.

### Cited Findings
- **[Minor] Dates have four formats across one workflow:**
  - "0DTE · Oct 9" (Expiry card);
  - "0DTE · 10/09/26" (card chips);
  - "TRACKED 10/9/2026" (Tracker, `toLocaleDateString()`, [Tracker.tsx:107,132,225](../../src/pages/Tracker.tsx));
  - "Oct 12 · Mon" (Weigher).
  - Times are 24 h en-GB ("17:41:51"). Fix: one formatter, e.g. "Oct 9" or "Fri Oct 9".
- **[Minor] Decimals:**
  - The Compass table shows "±1%" and "±2%" beside "±1.6%" (sigma unformatted; [shot](shots-compass/c-table-dark.png)).
  - Contract tab Greeks: "GAMMA 0.2343" (4 dp) next to "DELTA 0.54".
  - Weigher IV is shown as an integer "15%" on every strike, which hides the smile.
  - Fix: fixed precision per field (σ 1 dp, gamma 3 dp, IV 1 dp).
- **[Major] Greek units are unclear.**
  - AAPL 190C Contract tab: `THETA -3.42` on a $0.82 premium.
  - Elsewhere: `DECAY $47/session` and, on QQQ, `theta -1.32/day`.
  - Without units, "-3.42" reads as losing four times the premium in a day ([shot](shots-compass/c3-setup-contract-tab.png)). Fix: "θ −$0.47/day per share ($47 per contract)".
- **[Minor] Unsigned change.** The Weigher contract capsule reads "▼ $0.54 (91.53%)": the arrow carries the sign and the % does not (`Math.abs`, [WeigherDesk.tsx:764-766](../../src/pages/weigher/WeigherDesk.tsx)). The Compass premium view shows "(−26.8%)". Fix: signed figures everywhere.
- **[Minor] Units mixed in one row:** "Market value $470.00" (per contract) beside "Cost when added $4.77" (per share) ([shot](shots-compass/w2-position-card-light.png)). Fix: "$477 (4.77 × 100)".
- **[Minor] Timeframe labels** "1M" (Weigher strip) and "15M" (Terrain) read as months; the setup page uses "1m". Fix: lower-case "m".
- **[Minor] Exposure colours.** In the Compass rail and in Terrain's NET, a **negative** dollar figure is green or blue and a positive one red ("-$79.7M" in green; [shot](shots-compass/compass-dark-1440.png)), with no legend on Compass. Code comment: "negative = dealers absorb (bull)", [ImpactLeaderboard.tsx:51-53](../../src/components/compass/ImpactLeaderboard.tsx). Fix: a one-line legend ("− absorbs · + amplifies"), or Terrain's own words in a column caption.
- **[Minor] Price ink beside the day change.**
  - Weigher "AAPL $189.89" in green next to "▼ −0.25%" ([shot](shots-compass/w-add-form-bad-dark.png)).
  - Terrain light "SPY $477.98" in green next to "−0.39%" ([shot](shots-compass/t2-light-one.png)).
  - In dark 3-pane, SPY's price is green while its day is red ([shot](shots-compass/terrain-dark-1440.png)).
  - The price is inked by the last tick, so it reads as the day's direction. Fix: neutral price ink with a short flash, or ink by the day.
- **[Minor] Rule tension — "The case" is a public grade.**
  - The setup head "The case ●●●● strong" and "a strong case" with a four-step meter.
  - The guide says "how sure the engine is, said in one word: strong, good, caution or poor" ([shot](shots-compass/x-setup-guide.png)).
  - The Tracker's "CONFIDENCE … good".
  - The owner: "we do not say we grade, anywhere a reader can see" ([CompassLayout.tsx:23](../../src/pages/compass/CompassLayout.tsx)). This is for the owner to decide; it also spends green, orange and red on a non-market judgement.
- **[Minor] Owner colour-rule deviations in code.**
  - The setup page's "Track setup" door wears the foil (`holo-bg`) with a literal `text-[#0a0a0a]` ([CampaignAnalysis.tsx:1308](../../src/components/compass/CampaignAnalysis.tsx)). The Weigher's Add-position Save and its selected pills use `color: '#0a0a0a'` ([PositionForm.tsx:65,148](../../src/components/gex/PositionForm.tsx)).
  - Rules: "every colour is a token", and the moving foil belongs to the mark, the live dot and "Launch terminal" ("every other door in the terminal is the plain ink pill").
  - Fix: `rgb(var(--panel))` or an ink token, and the plain ink pill (or the owner's ruling on primary doors).
- **[Minor] Expired Tracker cards fade with `opacity-50`** ([Tracker.tsx:113](../../src/pages/Tracker.tsx)). The owner's rule is that quiet rows recede by dropping a text tier, never by opacity.
- **[Minor] Hidden hierarchy in Terrain.** At rest the pane chrome recedes (owner, by design), but this also hides the only timeframe control (Q1). Since the 1-pane head shows a "HEAVIEST 475 $358.3M · 476 $160.4M · 477 $148.9M" read only on hover ([shot](shots-compass/t2-drawn.png)), the most decision-relevant line is invisible at rest.
- **[Polish] Stale guide examples** dated or priced from another day:
  - Compass board guide "0DTE · 09/11/26" ([shot](shots-compass/c-guide-dark.png));
  - Weigher guide "SPY 507C · Sep 16", spot 515.94 ([shot](shots-compass/w-guide-dark.png));
  - Terrain ladder guide strikes 493–497 with the market at 492.40 ([shot](shots-compass/t-ladder-guide-dark.png)).
  - Fix: build the guide samples from the live name, or use neutral numbers.
- **[Minor] Empty-state placement.** The Weigher's "NOTHING PICKED YET" sits at the bottom of an empty 400–500 px panel, with a 9 px instruction ([shot](shots-compass/weigher-dark-1440.png), [shot](shots-compass/w2-1920.png)). Fix: centre it, at 12 px, with the action ("Press + on a strike").
- Tooltips:
  - Terrain's trend strip uses a long `title` ("1m: between its EMA21 and its VWAP · …") on a non-focusable span, so keyboard and touch users never see it.
  - Compass table header tooltips exist ([SetupScanBoard.tsx TOOLTIPS](../../src/components/compass/SetupScanBoard.tsx)).
  - Weigher chain headers have dotted-underline terms.

### Inferences
- What works well:
  - Terrain's ladder rows line up with the chart's price axis in 1-pane, so the strikes read straight across into the chart.
  - The ladder guide's "what a move forces" lane is a strong, clear teaching block.
  - The Weigher drill's "THE BOOK AT 492" (void, dealer gamma, "a move through it — dealers push back") turns exposure into plain language.
  - Tabular figures are used throughout (`tnum`).
- The highest-value formatting fix is labelling **entry vs live** and **per-share vs per-contract**. Every contradiction a trader will notice traces back to an unlabelled frame of reference.

### Gaps
- Not compared against a reference terminal's formatting conventions; findings are internal-consistency only.

---

## Q4 — Accessibility: keyboard, focus rings, aria labels, 44 px targets

### Takeaway
The keyboard basics are good: rings show on all 40 tab stops on the board, dropdowns hand focus back, dialogs close on Esc, and no control is unnamed in any of the three rooms. The issues are:
- nested interactive controls on the Compass cards;
- focus order that moves with the re-rank;
- AG Grid's blue focus ring instead of the house silver;
- small targets everywhere on the phone (Compass 11, Weigher 34 and Terrain 30 controls under 44 px).

### Cited Findings
- No controls without an accessible name on /compass, the setup page, the Tracker, /weigher or /terrain (checker `UNLABELED` empty on every run).
- Focus rings were present on all 40 tab stops through the Compass board (log `ring=true`). After Esc, a dropdown trigger keeps a solid ring (`after Esc focus -> compass-expiry ring:solid`).
- **[Minor] Nested interactive controls.** Each Compass card is a `<button>` containing a `span role="button" tabIndex=0` "OPEN" ([SetupScanCard.tsx:49, 108-123](../../src/components/compass/SetupScanCard.tsx)). The tab order alternates card, OPEN, card, OPEN (log `span[OPEN]`). Fix: make the card a `div` with one button for the title (select) and a real Open button, or drop the inner door and let Enter on a selected card open it.
- **[Major] Focus target moves.** The 10 s re-rank reorders the cards under the keyboard focus (Q1).
- **[Minor] Weigher chain focus ring is AG Grid blue** (`outline rgb(58,79,122)`, log `CHAIN FOCUS`), not the house silver `--ring` ([shot](shots-compass/w2-chain-keys-light.png)). Fix: theme `--ag-range-selection-border-color` and the focus colour from the tokens.
- **[Minor] Small desktop targets:**
  - Weigher size −/+ are 12×16 px ([PositionDeskCard.tsx:327,331](../../src/components/weigher/PositionDeskCard.tsx));
  - Terrain drawing-rail family carets are 10×26 px and the link button is 20×20 (terrain2 log).
- **[Minor] Phone targets under 44 px** (the owner's 44 px rule is written for the landing; it is good practice in the terminal too):
  - Compass: 11, including the header buttons at 28 px, the dropdown cards at 28 px, "Open" at 19–25 px and "How to read" at 24 px.
  - Weigher: 34, including chart toolbar buttons at 20–23 px, chain rows at 30 px and "Fullscreen chain" at 20×20.
  - Terrain: 30, including the rail at 24×26 and 10×26, Link at 20×20 and the toolbar at 20–23 px.
  - Fix: invisible `before:` hit areas, as the landing does.
- Works:
  - Terrain's pane keys (F, Esc, 1–4, Shift+R; `[`/`]` per the code) and the aria-live announcement.
  - The trend strip has `role="img"` with an aria-label.
  - The Weigher ruler is a proper `role="slider"` with value text.
  - The Weigher expiry calendar's day buttons have full aria-labels ("Monday, October 12th, 2026, selected").
  - The chain supports arrow keys and Enter.

### Inferences
- A keyboard user on Compass is currently fighting the 10 s re-rank. Freezing the order while focus is inside the board fixes the keyboard and the mouse problems together.

### Gaps
- No screen-reader pass (NVDA or VoiceOver), no reduced-motion pass, no 200% zoom pass.

---

## Q5 — Copy: banned words and typos

### Takeaway
No banned word appears anywhere a reader can see or hear in these rooms. Visible text, page titles, `title`, `aria-label`, `placeholder` and `alt` were scanned on the board, the board guide, a setup page with its guide, the Tracker, the Weigher, Terrain and the ladder guide. The copy problems are instead:
- trade instructions in the why-texts;
- a side-blind why-text;
- one future-feature promise;
- a few mismatches and dangling phrases.

### Cited Findings
- Banned-word scan (grade/score/win rate/signal/guaranteed/confluence/market intelligence/simulated/demo/fake/preview/pretend/at launch/placeholder, plus undefined/NaN/null): **0 hits** on all nine states (words.mjs log, `WORDS … []`). "graded" appears only in code comments ([CompassLayout.tsx:23](../../src/pages/compass/CompassLayout.tsx), [Board.tsx:60](../../src/pages/compass/Board.tsx)) and `buildConfluence` only as an identifier ([Terrain.tsx:48](../../src/pages/terrain/Terrain.tsx)). None of it is visible.
- **[Major] Trade instructions in Compass why-texts.** Quick scalp: "Scalp the pop and take profit fast before theta bleeds the premium" ([data/compass.ts:99-102](../../src/data/compass.ts)). This contradicts the footer, "Nothing here tells you what to buy or sell", and the brand's "a read, never an instruction". Other kinds say "our entry" and "under our entry". Fix: rewrite as reads ("Concentrated gamma makes small moves fast; premium decays quickly").
- **[Major] Side-blind why-text** (Q1): puts are described with "buy walls … protective floor".
- **[Minor] Future-feature promise.** The Terrain RTH tooltip: "Session shading over the tape arrives with the futures feed" ([Terrain.tsx:2869](../../src/pages/terrain/Terrain.tsx)). It is akin to the banned "at launch", and the futures work was removed on 2026-09-30. Fix: "The cash session — the hours every tape on this desk draws."
- **[Minor] Mismatch:** the Tracker's empty state says "click **Track Setup +**", but the button reads "Track setup" ([Tracker.tsx:312](../../src/pages/Tracker.tsx) vs [CampaignAnalysis.tsx:1316](../../src/components/compass/CampaignAnalysis.tsx)).
- **[Minor] Dangling phrase:** the setup head ends "found at 18:03:33, read live since" ([CampaignAnalysis.tsx:903](../../src/components/compass/CampaignAnalysis.tsx)). Fix: "found at 18:03:33 · live since".
- **[Polish] Awkward or inconsistent wording:**
  - "3 targets were earned by the math; 0 have been hit" ([CampaignAnalysis.tsx:1279](../../src/components/compass/CampaignAnalysis.tsx));
  - Tracker headers "Verdict" (showing a state word, ACTIVE) and "Exp. Move", vs "State" and "Expected move" elsewhere;
  - the read word "good" in lower case under upper-case labels ([shot](shots-compass/c3-tracker-card.png));
  - "1Σ MOVE" upper-cased from "1σ move" (capital sigma Σ means "sum").
  - Fix the sigma by not upper-casing that label (`normal-case` on the σ).
- No typos found in the copy read.

### Inferences
- The why-text library ([data/compass.ts:92-120](../../src/data/compass.ts)) is the single place where tone, side and instruction problems meet. One rewrite pass, with call and put variants and no imperatives, fixes three findings.

### Gaps
- Copy inside canvases (chart chips, axis tags) was read from screenshots only.
- Dropdown hints were read only for the menus that were opened.
