# Noah's strike panel at revamp 1ebc5bb — anatomy for the port

Source: /home/user/revamp at 1ebc5bb ("The expected move: the field alone, and on the stage out of hours"), read only.
Every `PP:` line is `src/components/gex/ProfilePanel.tsx`; `T:` is `src/pages/terrain/Terrain.tsx`; `EF:` is
`src/components/gex/ExposureField.tsx`; `HM:` is `src/components/gex/heatmap.ts`. Pictures are in
`/tmp/claude-0/-home-user-3abida/3f13cba1-d81b-5e53-bbee-8bc889ed9a96/scratchpad/panel-port/noah/` (index at the end).

How the pictures were made: Noah's app served on 127.0.0.1:5196 through Vite's API with revamp's own config inline
and the dep cache in the scratchpad (`tools/serve-revamp.mjs`), not `npx vite`, because `npx vite` would rewrite
/home/user/revamp/node_modules/.vite and the revamp is read only. Desk seeded through `slayer_terrain_v1` (T:109),
dark theme, 1920×1080 at 1 dpr, phone 390×844 at 2 dpr, America/Los_Angeles. Scripts: `tools/shoot-noah-panel.mjs`,
`tools/shoot-noah-extra.mjs`, `tools/shoot-noah-guide.mjs`. Server stopped by PID (32148; its shell 32147); port
5196 answers nothing now. `git status` in the revamp is clean.

## 0. What matters most for the port (each detailed below)

1. **The GEX tab offers Calendar and Matrix only — no Profile.** The panel mounts ExposureField with
   `toolbar="panel"` (PP:1910), which picks the `'tile'` host (EF:356), whose views are `['calendar','matrix']`
   (`src/components/gex/ledgerView.ts:41`); the View card lists `VIEWS_FOR[viewHost]` (EF:1080). Measured: the card
   offers "Calendar, Matrix" at 1 and 4 panes (shoot-log-desk1.txt, shoot-log-desk4-phone.txt). The Profile view
   exists (`ExposureProfileView.tsx`, mounted only for the Map host, EF:1677-1678) and draws **price along the foot**
   (its header comment, lines 1-30), so it cannot line up with the chart's strike rows as it stands.
2. **Every figure is the simulator's.** Ladder and Net read `railForCut` (T:291-330: `buildLadderFor`,
   `buildLevelsFor`, `Simulator.snapshotFor(ticker).chain`) re-run on every market tick (`revision`, T:1964-1966,
   1028-1032). The GEX tab reads `Simulator.snapshotFor(ticker)` re-read every 10 s (PP:433-438, 455-463). The Vol
   underlay reads `Simulator.getCandles` (PP:557-561); the spine's ghost reads `Simulator.getGexHistory`
   (`src/data/levelview.ts:96-111`). No minute, no replay cursor, no UW figure anywhere.
3. **Two palette switches.** Ladder/Net/Flow wear Terrain's desk-wide Colours card (`cfg.palette`, T:197-203,
   2780-2785 → `palette` prop, T:1899). The GEX tab ignores it and wears Settings › Appearance
   (`useLedgerPalette`, EF:354; `src/data/ledgerPalette.ts`, key `slayer_ledger_palette`, thermal by default). The
   "How to read" guide hard-codes the thermal stops (`ProfileGuide.tsx:39-44, 77`).
4. **His House palette is gold = amplify** (`ember-glacier`, HM:106-137: "positive = put-dominant … AMPLIFY (ember)"
   climbing to honey gold #F5C542; "negative = call-dominant … ABSORB (glacier)" to ice #D6EDF8). Ours is gold =
   absorb, violet = amplify (3abida `src/components/gex/heatmap.ts:39-41, 60-65`). **The sign convention is the same
   in both** (positive net = put-dominant = amplify), so the port swaps the ramp, never the sign.
5. **His Thermal uses red** (HM:70-91: #FFFFBF → #A50026 for amplify, → #313695 for absorb). On paper both palettes
   are forced to thermal's deep red and navy (HM:492-504, `paperPole`).
6. **Walls are green and red** (`palette.ts:21-22`: CALL_WALL = BULL #30D158, PUT_WALL #FF3B30; light set
   `--bull`/`--bear`, PP:299-300); supreme magenta #EA00FF (palette.ts:32).
7. **Width cap is 60 %** of the pane (PP:500, 511) — Terrain's rule is 40 %.
8. **Type**: almost every canvas word is 7–10 px (full list in §12); weight 700 in five places; tracked caps on the
   column heads, the card's labels and the Vol switch.
9. **Rows align with the chart on Ladder and Net** (drawn at the chart's own `priceToCoordinate`, PP:629-657;
   StrikeChart.tsx:2051-2056), **not on GEX** (its own row grid, scrolling — `hover-gex-matrix.png`: the chart's
   489.24 stands at y≈372, the matrix's 489 row at y≈565).
10. **No phone panel at all**: `className="hidden lg:block"` (T:1938; T:1871-1881 "NOT ON A PHONE"); the r/R keys
    and the Strikes button are unbound / not rendered below lg (T:2434-2453, 2757). `phone-1pane.png`: no panel.
11. **No keys on the panel itself**: no `onKeyDown` in ProfilePanel; the canvas is `aria-hidden` (PP:1855); the grip
    and the sash are `role="separator"` with no `tabIndex` (PP:1828-1854). Only the tab buttons and the head's cards
    take focus. (The GEX tab's matrix/calendar have their own arrows/j/k/Home/End/Enter: `ExposureMatrix.tsx:381-399`,
    `ExposureLedger.tsx:680-681`.)
12. **The view is not remembered**: `useState('gex')` (PP:432) — every mount opens on GEX.
13. Bugs seen: (a) lane `'flow'` hides the tabs (PP:1808 `showSize &&`) while the view starts on GEX, so the panel is
    stuck on the calendar with no way back to the flow lane (`extra-lane-flow-first-load.png`); (b) the Δ-spot
    figures are painted with `'rgb(var(--bull))'` on a canvas (PP:1411), which a canvas rejects, so they keep the
    strike's ink (visible: plain rows grey-white, the call-wall row green, the put-wall row red —
    `desk-1pane-1-ladder-panel.png`); (c) at the mid tier the ▲ count overlaps the first row (`grip-mid-360-panel.png`:
    "▲ 11" over "492 +3.98%"); (d) with both lanes and the sash at 0.75 the flow lane's "sell $3…" runs under the
    "Call wall" chip (`sash-both-size-widest-panel.png`); (e) at 180 px on GEX the × sits on the GEX tab
    (`extra-thin-gex.png`); (f) once, clicking the Net tab after a hover kept the hovered strike — the tabs are inside
    the root whose `onClick` keeps `hoverRef.current` (PP:1541-1544, 1821); seen in one run (shoot-log: "kept · click
    to let go"), not reproduced on purpose.

## 1. How Terrain mounts and feeds it

Mount: T:1882-1939, `{ladder && rail.rows.length > 0 && (<ProfilePanel … className="hidden lg:block" />)}`; the
guide at T:1943-1947 (`GuideFocus` over the pane, `ProfileGuide rows levels flow`).

| Prop (PP:330-387) | Value at T: | Where the value comes from |
|---|---|---|
| `width` | 1886 `cfg.ladderW ?? profileRestWidth(paneCount, expanded)` | per-pane `ladderW` in `slayer_terrain_v1` (T:170-171, validated ≥ 180 and < 4000 at T:418) |
| `restWidth` | 1887 `profileRestWidth(paneCount, expanded)` | PP:96: 580 for one pane or the expanded pane, 240 three across, 340 otherwise |
| `onWidth` | 1888 `w => onCfg({ ladderW: w })` | written once on the grip's release (PP:517-521) |
| `headCard` | 1891 `<ExpiryCard label="Expiry" size="sm" value={railCut} choices={railCutChoices()} onChange={onRailCut}>` | desk-wide `railCut` (T:204-210), choices from `CALENDAR_DTES` + "Every expiry" (T:218-231), set at T:2984 |
| `ground` | 1893 | `chartGround(theme)` (T:1141), the pane's own candle theme |
| `ticker` | 1894 | the pane's name |
| `rows` | 1895 `rail.rows` | `railForCut(ticker, railCut)` (T:1028-1032): book → `buildLadderFor(ticker)` (T:293); a date → `buildExposureSurface(Simulator.snapshotFor(ticker), 30, [0, cut])` net column (T:312-329); DESCENDING strikes (T:328) |
| `maxAbs` | 1896 | `railShape` (T:273-289): largest |value| in the ±10 strikes round spot |
| `legs` | 1897 | book: `Simulator.snapshotFor(ticker).chain` → `{put: n.putGex, call: n.callGex}` (T:294-299); a date: the surface's put/call gex (T:319-324) |
| `openRatio` | 1898 | `netSinceOpenRatio(ticker)` (T:1109-1113 → levelview.ts:96-111: first GEX snapshot of the session over the last, per strike) |
| `palette` | 1899 | desk-wide `cfg.palette` ('thermal' by default, T:368, 456), the Colours card T:2780-2785 |
| `step` | 1900 | `railShape` smallest strike gap (T:281-287) |
| `levels` | 1901 | book: `buildLevelsFor(ticker)` (T:300); a date: `levelsOf` (T:235-271: heaviest each side of spot, supreme, sign change nearest spot at the MIDPOINT of two strikes) |
| `flow` | 1902 | `buildFlowFromRows(rail.rows, levels.spot)` (T:1104; `src/data/hedgeFlow.ts:86-108`) |
| `lane` / `onLane` | 1903-1904 | per-pane `lane` ('size' by default, T:359; validated T:419) |
| `greek` | 1905 | the literal "GEX" |
| `onGuide` / `guideOpen` | 1906-1907 | pane state T:1115 |
| `focusPrice` / `onSelect` | 1908, 1937 | pane state `focus` (T:1092-1099, reset on a name change); click toggles it; the chart flashes it (`focusPrice={focus}`, T:1463) |
| `projection` | 1909 | `projectionRef` (T:1081) filled by the chart (`projectionRef={projectionRef}` T:1470; StrikeChart.tsx:2051-2056: `yFor = candleSeries.priceToCoordinate`, `plotHeight = paneSize(0).height`) |
| `onClose` / `closeHint` | 1910-1936 | sets `ladder: false`, then focuses `[data-strikes-toggle]` next frame; title "Hide this rail — R" |
| `className` | 1938 | `hidden lg:block` |

Not passed: `words` (defaults "amplifies"/"absorbs", PP:403). The expanded pane's top bar leaves room for the panel
(T:2661).

## 2. The tab rail — Ladder · Net · GEX

- `VIEW_TABS` (PP:143-147); drawn with the house `FilterTabs` (PP:1808-1812; `src/components/ui/FilterTabs.tsx`):
  a `role="group"` of `aria-pressed` buttons, `text-xs` (12 px) 500, the active one 600 on the moving holo pill
  (FilterTabs.tsx:38, 46-54; dark word `#0a0a0a` on the foil, paper's galaxy ink with `text-panel`).
- State: `useState<'ladder'|'net'|'gex'>('gex')` (PP:432) — opens on GEX every mount, not stored, one per panel.
- Shown only while the size lane draws (`showSize &&`, PP:1808) — see bug 13a.
- Keys: Tab/Enter/Space on the buttons only; no arrow keys, no shortcut.
- Switching repaints through `dataRev` (PP:597-599) and the frame-loop deps (PP:1514); GEX clears the canvas
  (PP:631-638) and gates the pointer handlers off (PP:1518, 1542).

## 3. The head

- Root head `[data-profile-head]` (PP:1859-1900), pointer-events off except its controls; height 30 on the full
  tier (`HEAD_TOP`, PP:140), 56 below it (`HEAD_TOP_2`, PP:150, `twoRowHead = tier !== 'full'`, PP:1772). Measured:
  30 at 580 px, 56 at 340 px (shoot-log).
- Row 1 (PP:1867-1894): the tabs; on GEX the field's cards portal in beside them (`stripSlot`, PP:442, 1869; EF:1433-
  1445) and the row wraps (measured 34 px at 580, 66 at 340); otherwise the host's Expiry card (PP:1870-1874); on the
  full tier the lane names as glossary Terms — "Size · GEX · puts ◂ ▸ calls" / "Net · GEX · puts − calls"
  (`Term k='Size at a strike'|'Net at a strike'`, PP:1875-1882) and "What a move forces · from gamma" (PP:1883-1889);
  the tools at the end (PP:1890-1893).
- Tools (`laneTools`, PP:1773-1792): Lanes card (DropdownSelect sm, `LANE_OPTIONS` Both/Size/Flow, PP:78-82), shown
  when `panelW ≥ 250` or on two rows (PP:1753, 1775); the Vol switch (PP:1776-1789); "How to read" door, icon alone
  under 320 px (PP:1752, 1754-1767); the × (PP:1793-1804). Below the full tier the tools take row 2 (PP:1895-1899).
- The KEY under the head, on the canvas (PP:805-858): only the size lane, above the thin tier (`keyOn`, PP:664),
  16 px band (`KEY_BAND`, PP:153): ramp swatches "puts amplify" / "calls absorb", "the spine now", "at the open",
  magenta "supreme" (short words "puts"/"calls"/"now"/"open" on the mid tier).
- COLUMN HEADS on the canvas, 13 px band (`COL_HEAD`, PP:156; PP:859-896): "◂ PUTS · CALLS ▸" centred over the lane
  (or "NET GAMMA" + "puts · calls" on Net), "STRIKE", "Δ SPOT" (wide column, Ladder only, PP:882-885), "A MOVE
  FORCES" over the flow lane; a hairline under (PP:890-895).
- The rows start under `HEAD_BAND = headTop + (keyOn ? 16 : 0) + 13` (PP:665-667): 59 px full, 85 mid, 69 thin
  (43 / 69 with the flow lane alone). Rows whose capsule would cross it are culled and counted (PP:768-781).

## 4. The Ladder view (puts left, calls right, the spine)

Lane geometry (PP:743-755): with only the size lane the strike column comes FIRST (left) and the lane after
(`colFirst`); with both lanes the column stands between them (size | column | flow) at the sash's split.
Column width 60 on thin, 96 on mid and full (PP:161-162, 612, 663).

Per frame (PP:1174-1291):
- Capsule height `barH = clamp(round(pitch × 0.62), 4, 14)` (PP:763), pitch = the chart's px per strike step.
- Leg height `legH = clamp(round(barH × 0.55), 3, 9)` (PP:1180).
- Centre line at the lane's middle (PP:1197-1203).
- Figures print only if `laneW ≥ 180 && barH ≥ 10` (PP:1177); reach = `laneW/2 − (figures ? 40 : 6) − 4` (PP:1179).
- Each leg's length = `max(2, |leg| / legMax × reach)`, legMax = the largest leg ON SCREEN (PP:1184-1196, 1236-1237);
  eased (110 ms time constant, PP:706-729).
- Put leg grows LEFT, sign +1 (amplify ramp); call leg grows RIGHT, sign −1 (absorb ramp) (PP:1209-1231); a 4-stop
  linear gradient from the ramp's quiet end (t = 0) at the centre to t = its strength at the tip; radius 2; a silver
  ring on the kept/hovered row (PP:1058).
- Figures: `fmtUsd(put)` right-aligned 4 px past the put tip, `fmtUsd(call)` 4 px past the call tip, 500 9 px, ink
  `#ededed` (PP:1240-1252).
- THE SPINE (PP:1256-1290): one Catmull-Rom spline (`splinePath`, `StrikePressureLadder.tsx:36-53`, controls clamped
  to the lane) through `x = mid − (net / netMax) × laneW/2 × 0.44` (`MAX_LEAN`, PP:131) — positive (put-dominant) net
  leans left; 1.5 px in `ink.spine` (rgba 237 237 237 0.85). Dashed [3,3] ghost at the open: each point scaled by
  `openRatio` clamped ±1.6 (PP:1260-1275). A 3 px dot on the spine at the kept/hovered strike (PP:1280-1289).
- Leaving legs shrink back into the centre line before they go (PP:1480-1509).
- No net figure on the ladder (removed 2026-10-15, PP:756-758).

Marks shared by Ladder and Net:
- Strike column (PP:1385-1416): strike 10 px (700 in the wide column), inked by role: focus silver, call wall green,
  put wall red, supreme magenta, else ink; Δ from spot `±x.xx%` right-aligned 9 px (Ladder) — bug 13b; Net swaps the Δ
  for a role tag "CW" / "PW" / "SUP ★" 700 7.5 px (PP:1399-1407).
- Labelled rows every `ceil(12 / pitch)` plus every level, the focus and the hover (PP:782-786); gridlines at them
  (PP:972-987).
- Spot: a full-width rule (PP:1014-1023) and a solid chip in the column, 700 10 px, `toFixed(2)` (PP:1461-1471); a
  strike label within 9 px of spot is skipped (PP:1390).
- Flip: dashed [3,3] rule across the panel and "flip 494.50" 9 px at the right (PP:989-1012).
- Walls, supreme, pin: a 2 px stripe on the panel's left edge in the level's ink (PP:1432-1437); the supreme's row
  washed magenta across the panel (PP:796-803); with the flow lane, chips "Call wall"/"Put wall"/"Supreme" at the flow
  lane's right edge, 500 10 px, 16 px tall (PP:1438-1458).
- Culled counts "▲ 23" / "▼ 22" 9 px in the column (PP:1418-1422).
- Hover wash across the row (PP:788-795).

## 5. The Net view — "the net dashes" (the owner replaces this with the matrix)

PP:1094-1173. Per strike: the net as a figure, 700 9 px (10 px when pitch ≥ 30), in the side's ink (the ramp at
0.8, PP:1090-1093), "−" for call-dominant; under it (two lines when pitch ≥ 24, else beside) a row of 5 × 3 px dashes
3 px apart, at most 14 a row: the put's share first in the put ink, then the call's — the row's length the strike's
|put| + |call| against the largest total on screen. Figures only if `laneW ≥ 90 && barH ≥ 8` (PP:1102). Column heads
"NET GAMMA · puts · calls" (PP:868-874); role tags in the strike column (PP:1399-1407); read line "Put · Call · Share"
(PP:1689-1704). Pictures: `desk-1pane-2-net-panel.png`, `desk-4pane-2-net-panel.png`, `extra-house-net.png`,
`extra-thin-net.png`.

## 6. The flow lane ("A move forces")

PP:1293-1380, shown with `lane` 'flow' or 'both'. `buildFlowFromRows` (hedgeFlow.ts:86-108): for each strike K, the
sum of the net of every strike between spot and K × the % move to K; `amplifies` when the flow points the move's way.
Drawn as a quiet silhouette wedge (`silFill`/`silStroke`, PP:1318-1336) with named capsules only at the walls, the
supreme, the pin, the kept and the hovered strike (PP:1337-1379): "sell $118M" inside (600 9 px), or beside when it
does not fit; a level name inside the capsule when it reaches the chip. Its colour is `heat()` — the palette's cell
style on its gamma curve (PP:697-703, 1316). Pictures: `sash-both-*.png`, `extra-lane-flow-first-load.png` (stuck on
GEX, bug 13a).

## 7. The GEX tab

PP:1903-1912: `<ExposureField snapshot={gexSnap} toolbar="panel" selectedStrike={focusPrice ?? null}
onSelectStrike={onSelect} fullMode="portal" narrowHint="widen the panel or pick fewer" headSlot={stripSlot} />`
inside an `overflow-y-auto` box starting under the measured head (`headH`, PP:444-454).
- Snapshot: `Simulator.snapshotFor(ticker)` (PP:455-463), re-read by a 10 s `setInterval` while GEX is up
  (PP:433-438). The field builds `buildExposureSurface(snapshot, WHOLE_BOOK, CALENDAR_DTES)`, reused for 6 s unless
  spot moves 0.1 % (EF:652-660). Greeks: gex, dex, vex, vanna, charm (`src/data/exposureSurface.ts:41-47`; units
  "1% move", "1σ move", "1% vol", "1 vol pt", "1 day"; charm ÷ 252, line 184).
- Panel mode (EF:356-368): View card (Calendar, Matrix — no Profile, §0.1), Greek multi-pick (own state
  `['gex']`, EF:308, not stored), Expiries (`ExpiryRangeCard`, by rest Today and the next two, EF:327); no Legs,
  Strikes or Show cards (EF:1089, 1092, 1112); the net alone in every cell (EF:368). View stored in
  `slayer_ledger_view` (`ledgerView.ts:37`), first view Calendar (`ledgerView.ts:38`).
- Not passed: `greeks`/`onGreeks` (so the chart's lens and the field are not synced), `openRatio`, `hoverStrike`,
  `half`, `fresh`, `snapshotFor`.
- Colours: `useLedgerPalette` (EF:354) — Settings › Appearance, NOT Terrain's Colours.
- Rows: the field's own grid (matrix `ROW_H = 30`, `ExposureMatrix.tsx:94`; calendar rows share the box), its own
  "SPY 496.17" divider, scrolls; not on the chart's price rows.
- Matrix (net legs): one row a strike, one column a greek, a figure and a bar under it; the put and call legs on
  its pointer card (`ExposureMatrix.tsx:30-36, 82-86`); card seen in `hover-gex-matrix.png`: "491 +0.35% · above
  spot · Put $320.7M 18% · Call −$636.6M 47% · Net · GEX −$315.9M call-heavy · Open interest 115,743 contracts · well ·
  hedging absorbs a move here".
- At 180 px: "Only 1 of 3 expiries fit — widen the panel or pick fewer." (`extra-thin-gex.png`, EF:1014-1015).

## 8. The grip (panel width) and the sash (lane split)

GRIP — the panel's left edge (PP:1828-1839), an 8 px `role="separator"` (`-ml-1 w-2`), invisible until hovered
(`hover:bg-ink/[0.10]`):
- Drag (PP:502-524): width follows the pointer locally (`dragW`), floor 180 (`PROFILE_MIN_W`, PP:88), ceiling 60 % of
  the parent (PP:511); one `onWidth` on release → `ladderW` stored per pane. The 60 % ceiling is re-applied every
  render (PP:500-501).
- Double-click: `onWidth(restWidth ?? 180)` (PP:1831) — it STORES the rest width as `ladderW` rather than clearing it.
- Measured: narrowest 180 (`grip-narrowest-*.png`), widest 1002 at 1920 one pane (60 % of the host; stored
  `ladderW` 1002), double-click → 580.
- No keys, no `tabIndex`.

SASH — between the size and flow lanes, only with lane 'both' (PP:1840-1854), at
`left: calc((100% − colW) × split)`:
- Split 0.25…0.75, 0.5 by default (PP:172-175); dragged live (`dragSplit`, PP:526-546), stored on release in
  `localStorage['slayer_profile_split']`, module-wide — one split for every panel (PP:176-201); double-click → 0.5
  (PP:1845). Measured: 0.25, 0.75, 0.5 after double-click (`sash-both-*.png`).
- No keys, no `tabIndex`.

## 9. The width tiers

| Breakpoint (panel px) | What changes | Line |
|---|---|---|
| < 180 | never: the grip's floor | PP:88 |
| thin < 300 | 60 px column (strike centred, no Δ); no key; two-row head; leg figures need lane ≥ 180 so they go → the hover card | PP:102, 612, 664, 1177, 1583 |
| mid 300–439 | 96 px column (strike + Δ); short key; two-row head | PP:102, 830 |
| full ≥ 440 | one-row head with the lane names; full key words | PP:102, 665, 1772, 1875 |
| < 250 | the Lanes card leaves a ONE-row head (never happens: below full the head is two rows) | PP:1753, 1775 |
| < 320 | "How to read" door is its icon | PP:1752 |
| < 430 (`tight`) | read line drops its words | PP:1575 |
| < 240 (`tiny`) | read line: strike and size alone | PP:1576 |
| rests | 580 (one pane / expanded), 340 (two or four panes), 240 (three) | PP:96 |
| ceiling | 60 % of the pane | PP:500, 511 |

Pictures: thin `grip-narrowest-thin-panel.png`, mid `grip-mid-360-panel.png`, `desk-4pane-1-ladder-panel.png` (340),
full `desk-1pane-1-ladder-panel.png` (580), `grip-widest-full-panel.png` (1002).

## 10. Hover: the read line, the card, the pin

- Pointer (PP:1516-1544): the nearest placed row by height anywhere in the lanes; nothing over the head; click →
  `onSelect(strike)` → the host toggles `focus` (T:1937).
- READ LINE (PP:1668-1738): one fixed line in the chart's time-axis band under the lanes (`foot.top = plotHeight`),
  10.5 px; the hovered strike, else the kept one: strike 11 px bold, role, "±x.xx% from spot", "Size $179.6M ·
  amplifies" (Net: "Put · Call · Share"), "A move here forces sell $119M", the dealers' sentence, "click to keep";
  empty: "hover a strike · click to keep it". Measured strings in shoot-log-grip-hover-sash.txt.
- CARD (PP:1577-1667): only while hovering AND the rows cannot print their figures (`cardOn = hover && showSize &&
  !figuresRef.current`, PP:1583) — so at 580 and 340 it never shows (measured: card count 0 at 580); at 180 it does.
  236 px wide, `bg-card/95` blur, shadow `rgba(0,0,0,0.5)` (PP:1603); it stands OUTSIDE the panel over the chart,
  `right: calc(100% + 10px)` (PP:1604), its top `clamp(row.y − 44, headBand, foot.top − 132)` (PP:1594) — it follows
  the pointer's ROW, not the pointer; x fixed. Contents: "SPY 490" 12 px bold, "+1.01% from spot" 10 px, role;
  Puts/Calls bars (5 px, the ramp) with `fmtUsd` (PP:1621-1638); Net with a dot and "amplifies/absorbs", Open int
  (callOI + putOI), Since open (`sinceOpenRead`, levelview.ts:162-178: "5.9× building", "+12% building", "new
  today", "flipped sides") (PP:1639-1660); "Click to keep" / "Kept · click to let go" (PP:1661-1665). Measured box
  x 1487 y 76 236 × 151 with the panel at x 1733 (`hover-card-thin.png`, `hover-card-thin-kept.png`).
- PIN: the kept strike wears a silver ring on its legs/dashes (PP:1058, 1165-1172, 1224-1230) and a dot on the spine;
  the chart flashes it (T:1463). Click again to let go.

## 11. Palettes — exact colours and meanings

`ProfilePalette = 'thermal' | 'house'` (PP:124-128), `modeOf` → 'thermal-yellow' or `HEAT_MODE` = 'ember-glacier'
(PP:129; HM:37). Hints: Thermal "Yellow in the middle, red where hedging amplifies a move, blue where it absorbs
one"; House "Gold where hedging amplifies, ice where it absorbs".

- Thermal (HM:70-91, gamma 0.5): amplify (puts, +) #FFFFBF → #FEE090 → #FDAE61 → #F46D43 → #D73027 → #A50026;
  absorb (calls, −) #FFFFBF → #E0F3F8 → #ABD9E9 → #74ADD1 → #4575B4 → #313695.
- House = ember-glacier (HM:106-138, gamma 0.6 at HM:110): amplify (+) #2A2A2A → #521D19 → #751D14 → #9A2715 → #B84119 →
  #D45E1D → #E67F27 → #EFA334 → #F5C542 (honey gold); absorb (−) #2A2A2A → #173856 → #175177 → #196C95 → #2589AE →
  #44A5C5 → #7ABDD7 → #A9D5E7 → #D6EDF8 (ice).
- Paper (HM:490-519): both palettes → thermal deep poles amplify [165,0,38], absorb [49,54,149]; legs from the inset
  [245,244,240] at 35 % → the pole (`heatPaperLeg`); figures/bars from the muted ink [75,78,86] → the pole.
- Legs read the ramp at raw t (`heatRampColorFor`, no gamma, PP:681-690, 1204-1207); flow capsules and the read
  line's dots read `heatCellStyle` on the gamma curve (PP:110-113, 697-703).
- Switching glides ~330 ms, every colour a mix of the two ramps (PP:576-596, 672-703).
- The Colours card: desk-wide, in the desk cluster, hidden below lg, hidden with no rail, hidden when every pane is on
  a light tape (T:2780-2785).
- Against ours: same sign; ours gold = absorb (calls, −), violet = amplify (puts, +) (3abida heatmap.ts:39-41,
  60-65). His key words "puts amplify" / "calls absorb" carry over; only the inks change.

## 12. Type — every size and weight (✗ = under 11 px)

Canvas (font `FONT_SANS`, PP:204-205):
| Line | Font | What | |
|---|---|---|---|
| 823 | 500 8.5 px | key words | ✗ |
| 864, 874 | 600 7.5 px, caps | column heads STRIKE / Δ SPOT / ◂ PUTS · CALLS ▸ / NET GAMMA / A MOVE FORCES | ✗ |
| 872 | 400 7.5 px | "puts · calls" | ✗ |
| 962 | 400 7 px | VPOC | ✗ |
| 1001 | 400 9 px | flip caption | ✗ |
| 1048-1050 | 600 9 px (8 px when barH < 13) | flow capsule figures | ✗ |
| 1075, 1439 | 500 10 px | level chips | ✗ |
| 1079 | 500 9 px | level name inside a capsule | ✗ |
| 1108, 1152 | **700** 9/10 px | Net figures | ✗ |
| 1241 | 500 9 px | leg figures | ✗ |
| 1349 | 600 9 px | flow figures | ✗ |
| 1394 | **700** (wide) / 400 10 px | strike | ✗ |
| 1404 | **700** 7.5 px | CW / PW / SUP ★ | ✗ |
| 1410 | 400 9 px | Δ spot | ✗ |
| 1418 | 400 9 px | ▲/▼ counts | ✗ |
| 1468 | **700** 10 px | spot chip | ✗ |

DOM: card 1607 12 px bold; 1611, 1616, 1634, 1642, 1650, 1655 10 px ✗; 1630, 1641, 1649, 1653 8 px caps
tracking-widest ✗; 1646, 1658, 1662 9 px ✗. Read line 1672 10.5 px ✗; 1677 11 px bold; 1679 10 px ✗. Guide door
1761 10 px ✗; Vol 1782 9 px bold caps tracked ✗; lane heads 1876, 1884 10 px ✗. House pieces in the head:
FilterTabs 12 px 500/600 (FilterTabs.tsx:38, 54); DropdownSelect sm label 9 px caps tracked ✗ and value 11 px 600
(DropdownSelect.tsx:125, 128); ExpiryCard label 9 px caps tracked ✗, value 11 px 600 (ExpiryCard.tsx:114-115).
ProfileGuide: SVG words 9 / 9.5 px ✗ in `ui-monospace` and "Inter" stacks (ProfileGuide.tsx:45-46, 56, 62, 70, 154,
157, 194), body 11.5 px, heads 12 px, notes 10 px ✗ (236-275).

## 13. Colour literals

ProfilePanel: `#FFFFBF`, `#0a0a0a` (112); SILVER `#C7D3E8`, INK `#ededed`, INK_2 `#a3a3a3`, INK_3 `#7d7d7d`
(134-137); DARK_INKS rgba whites at 0.025–0.14, `rgba(237,237,237,0.3/0.85/0.35/0.4)`, `rgba(226,234,244,a)`,
`#0a0a0a`, `#0e0e0f` (258-289); fallback [255,255,191] (695, 708); `#0a0a0a`/`#ffffff` ink by luminance (728);
`'rgb(var(--bull))'`/`'rgb(var(--bear))'` on a canvas (1411, invalid there); `rgba(r,g,b,0.6)` leaving legs (1505);
`'rgb(var(--text-secondary))'` (1563); shadow `rgba(0,0,0,0.5)` (1603). Through palette.ts: `#30D158`, `#FF3B30`,
`#9CA3AF`, `#EA00FF` (palette.ts:10, 21-32). The light set reads tokens (PP:291-328). ProfileGuide: `rgba(255,255,255,
0.07)` (37), thermal stops `#ABD9E9 #74ADD1 #4575B4 #FDAE61 #F46D43 #D73027 #FFFFBF` (39-44, 77), `#0a0a0a`,
`#ffffff`, `rgba(237,237,237,0.35/0.85)`, `rgb(var(--bull))`/`(--bear)` (SVG, valid there).

## 14. Data reads and timers

- PP:58 imports Simulator; PP:455-463 `Simulator.snapshotFor(ticker)` (GEX); PP:433-438 `setInterval` 10 s;
  PP:557-561 `Simulator.getCandles(ticker)` → `sessionVolumeProfile` (Vol, off by default, `src/data/volumeProfile.ts:
  138-156`: today's session, ~48 bins, 70 % value area).
- PP:615-1514 a `requestAnimationFrame` loop for the panel's life: polls the projection every frame, redraws when
  the key (width, heights, the anchor row's y, pitch, spot y, hover, `dataRev`) changes or a tween is unsettled
  (PP:657-658).
- ResizeObservers: head height on GEX (PP:447-453), the parent's width for the cap (PP:489-499).
- Host: `revision` on every `marketData` change (T:1964-1966) re-runs `railForCut` (T:1028-1032) and `openRatio`
  (T:1109-1113); `Simulator.snapshotFor` in `railForCut` (T:296, 313); `Simulator.TICKERS[…].currentPrice` (T:302).

## 15. Rows and the chart

Ladder and Net place every strike at `projection.yFor(strike)` = the candle series' `priceToCoordinate`
(StrikeChart.tsx:2051-2056), read in the frame loop (PP:629-657), so a pan, a zoom, an autoscale or a resize moves
the rows with the chart without a React render. Seen: 500 stands at y = 250 on both the chart axis and the ladder
(`desk-1pane-1-ladder.png`). Rows under the head band are culled (PP:771-774) — the chart's top 59–85 px of strikes
have no row (the "▲ 23"); the chart does not know the panel's head (approval 17's point). Below the plot the read line
takes the time-axis band (PP:642-646, 1673). GEX: not aligned (§7).

## 16. Phone

None. `hidden lg:block` (T:1938) with the reasoning at T:1871-1881; the r/R keys return early below lg
(T:2434-2453); the Strikes button and the Colours card are not rendered below lg (T:2757, 2780). On a 390 px phone
the panes stack and no panel or strikes control exists (`phone-1pane.png`, `phone-4pane-full.png`).

## 17. Keys

- Panel: none (no `onKeyDown`; canvas `aria-hidden`; separators unfocusable). Tabs: Tab/Enter/Space.
- Host: `r` toggles the active pane's rail, `R` every pane's (T:2442-2453; announced); the × hands focus to the
  Strikes button (T:1926-1934); the Strikes button (T:2757-2776, `data-strikes-toggle`, title "… — Shift R").
- GEX tab: the matrix/calendar's own arrows, j/k, Home/End, Enter/Space keeps (ExposureMatrix.tsx:381-399,
  ExposureLedger.tsx:680-681).

## 18. The owner's must-keep list against his panel

| Must keep | His panel | Where |
|---|---|---|
| Flow lane | HAS (Lanes: Both/Size/Flow; "A move forces") — but lane Flow hides the tabs and strands the panel on GEX | PP:77-82, 1293-1380, 1808, 432 |
| Δ from spot | HAS on the Ladder in the 96 px column (mid/full), in the card and the read line; NOT on the thin tier; Net shows a role tag instead; drawn in the wrong ink (13b) | PP:1408-1414, 1611-1614, 1683-1688 |
| Phone overlay | LACKS | T:1938 |
| R key and Strikes button | HOST'S (Terrain), not the panel's; gone below lg | T:2442-2453, 2757-2776 |
| UW comparison | LACKS — no second figure anywhere | — |
| Real minute / replay cursor | LACKS — live simulator only, 10 s poll on GEX | PP:433-463; T:1964-1966 |
| Terrain's Colours on every tab | PARTLY — GEX wears Settings' palette | EF:354 |
| 40 % cap | 60 % | PP:500, 511 |
| Rows on the chart's rows | Ladder/Net yes; GEX no | PP:629-657 |
| Type ≥ 11 px, 400/500/600 | No (§12) | — |
| 12-hour times | the panel prints no time; the GEX calendar's heads are dates ("OCT 15 · TODAY", caps) | `desk-1pane-3-gex-calendar-panel.png` |

## 19. Pictures (`…/scratchpad/panel-port/noah/`)

Desk 1920×1080, one pane (580 px panel): `desk-1pane-0-first-load` (opens on GEX › Calendar), `-1-ladder`,
`-2-net`, `-3-gex-calendar`, `-4-gex-matrix` (each with a `-panel` crop). No `-5-gex-profile`: not offered.
Desk four panes (340 px panels): `desk-4pane-0…4` the same. Phone 390×844: `phone-1pane`, `phone-1pane-scrolled`,
`phone-4pane`, `phone-4pane-full` (no panel). Hover: `hover-card-thin` (close-up), `hover-card-thin-full`,
`hover-card-thin-kept`, `hover-rest-readline`, `hover-net-readline`, `hover-gex-calendar`, `hover-gex-matrix`.
Grip: `grip-narrowest-held`, `grip-narrowest-thin` (180), `grip-mid-360`, `grip-widest-held`, `grip-widest-full`
(1002), `grip-widest-net`, `grip-widest-gex`. Sash (lane Both): `sash-both-rest`, `sash-both-size-narrowest` (0.25),
`sash-both-size-widest` (0.75). Extras: `extra-house-ladder`, `extra-house-net`, `extra-house-gex-calendar`,
`extra-lane-flow-first-load`, `extra-vol-underlay`, `extra-thin-net`, `extra-thin-gex`, `guide-how-to-read`.
Logs: `shoot-log-desk1.txt`, `shoot-log-desk4-phone.txt`, `shoot-log-grip-hover-sash.txt`, `shoot-log-extra.txt`.

Unsure: whether the tab-click-keeps-a-strike race (13f) is reliable — seen once. The light-ground (paper) look was
not shot.
