# Build plan: Noah's strike panel in Terrain, on the real field

Written 2026-10-16. This is a plan only: nothing under /home/user/3abida or /home/user/revamp was changed.

**Sources.**
- The owner's tree: /home/user/3abida at HEAD caebf7e. Another workflow is editing Terrain.tsx, StrikeChart.tsx and
  useTerrainReplay.ts right now (`git diff --stat` shows 4 files changed). Every line number for the owner's tree is
  HEAD's, read with `git show HEAD:<path>`. Re-grep before any edit.
- Noah's tree: /home/user/revamp at 1ebc5bb.
- The five scratchpad notes this plan stands on are in
  /tmp/claude-0/-home-user-3abida/3f13cba1-d81b-5e53-bbee-8bc889ed9a96/scratchpad/panel-port/notes/. Where a note was
  corrected by its check, the plan uses the corrected figure.

**Abbreviations.**

| Short | File |
|---|---|
| PP | src/components/gex/ProfilePanel.tsx (the owner's) |
| TR | src/pages/terrain/Terrain.tsx |
| SC | src/components/gex/StrikeChart.tsx |
| TM | src/data/feed/trailModel.ts |
| TF | src/data/feed/trailField.ts |
| LV | src/data/feed/levels.ts |
| RF | src/data/replayFrame.ts |
| GN | src/components/gex/gexNodesPrimitive.ts |
| FR | server/fieldRecorder.ts |
| N-PP | revamp src/components/gex/ProfilePanel.tsx |
| N-EF | revamp src/components/gex/ExposureField.tsx |
| N-EM | revamp src/components/gex/ExposureMatrix.tsx |
| N-EL | revamp src/components/gex/ExposureLedger.tsx |
| N-PV | revamp src/components/gex/ExposureProfileView.tsx |

**Where this sits in the order.**
- **The colour rule is in HEAD:** d968aa2, 8367930 and 20d4204.
- **The node look is not in HEAD.** It is task #70: "build the owner's pick (Today / A / B / C) … fix the ladder's 9 px
  words".
- The port starts once #70 lands.
- **Recommendation:** drop the "fix the ladder's 9 px words" part of #70. The owner's own words were "so the old
  ladder isn't fixed and then thrown away", and unit U8 below fixes the type on the new panel.
- The panel reads its inks through the oval renderer's own functions (§3). So whatever look #70 picks, the panel
  follows it, and check C1 holds it there.

---

## 0 · In short

- **The panel is a merge, not a transplant.** The owner's ProfilePanel and Noah's descend from one file:
  - `diff` between them leaves 321 lines that only Noah's has and 397 that only the owner's has, out of 1,917 and
    1,993 lines.
  - The owner's file already holds every feature the owner listed as must-keep: the Flow lane, Δ from spot and σ, the
    phone overlay, How sure, the drag guard and `data-plot-inset`.
  - So the build keeps the owner's PP and brings in what Noah's adds: the three-tab rail, the Ladder look, the GEX head
    slot and the one-line head.
  - The Net and GEX tabs are new views written on the chart's own rows. Noah's ExposureMatrix, ExposureLedger and
    ExposureProfileView are the model for how they look and behave; their data code is not used.
- **One data pass for every tab.**
  - Add a pure `greekColumn` beside the field's `modelColumn` (TM:571-644). It uses the same universe, `obsAt`,
    `oiAt`, clock, carry, 30-strike window and house sign.
  - From each contract's `blackScholesGreeks` call (src/core/greeks.ts:66-108) it keeps both legs of gamma, delta,
    vega, vanna and charm, by strike and by (strike, expiry).
  - Its gamma IS the field's number, so the Ladder, the matrix's GEX column, the Calendar's sums and the chart's ovals
    show one figure for one strike at one minute.
  - Measured 3–7 ms a minute on this container: about 3 ms for a past session, about 7 ms live, rising through the
    day.
- **The minute viewed:**

  | Mode | The minute the panel reads |
  |---|---|
  | Live | The newest column of the trail the chart draws |
  | Replay | The cursor's column, and nothing knowable after it |
  | History | The newest 1-minute column at or before the view's right edge (Q2). The session's inputs come over the route that already serves them (`/feed/field/<NAME>/day/<D>`, server/feed.ts:690) |
  | House's tape | The house's column at that minute; never `snapshotFor` "now" |

- **The matrix's greeks:**
  - Computed: GEX, DEX, VEX (vega) and vanna. Charm can be computed too, but the owner decides whether it may stand
    (Q4, under item 10's one-number rule).
  - Left out: theta (no formula in the house's pricer), rho, speed, zomma, color, vomma and veta (not Noah's columns,
    no UW figure), and gamma-by-volume (UW only; the model weights by open interest).
  - UW's figure stands beside **gamma** today. Delta, vanna and charm need the recorder to keep three more fields from
    the answer it already fetches; that is no extra call. Vega has no UW figure in any book.
- **Colours: one source.** The panel reads the ovals' inks (`darkMarkInks` / `trailPaperFrom` / `markInk`,
  GN:117-127, :251):
  - gold absorbs, violet amplifies, and grey means balanced;
  - under colour vision they become the blue-orange or high-contrast pairs.
  - Thermal, Noah's House ramp, his palette glide and his Settings-wide ledger palette are not ported. There is no
    second switch (Q11).
- **Type:** the approved scale from the first ported line, and nothing under 11 px except the Profile's 10 px axis
  ticks.
- **Order of work:** ten units, each a commit pushed to claude/trusting-planck-o77m11 with its checks.
  - Until U6 the new panel sits behind a development-only switch, so every commit leaves the owner's Terrain whole.
  - U7, U8 and U9 apply approvals 1, 2 and 17 to the new panel.
  - U10 takes the screenshot set.
- **Thirteen questions for the owner** (§7). Each has a recommended answer, and the build can proceed on the
  recommendations.

---

## 1 · What gets built

### 1.1 Files

**Noah's files (revamp 1ebc5bb), and what becomes of each:**

| File | Fate | Why |
|---|---|---|
| N-PP (1,917 lines) | **Merged into the owner's PP.** <br>**Taken:** the `VIEW_TABS` rail Ladder · Net · GEX (N-PP:143-147, :1810); the one-line head with the active view's cards beside the tabs (Noah's b90c2fe; head slot N-PP:442, :1869); the Ladder geometry (bar height clamped 4–14, legs at 0.55 of a bar, N-PP:763, :1180; the owner's clamps at 22); the pill held still under a drag (ce179a6, see FilterTabs below). <br>**Not taken:** the holo pill, the palette glide (N-PP:576-596), the thermal and ember-glacier ramps, the 60 % cap (N-PP:500, :511), the Net dashes (N-PP:1094-1173), every Simulator read (N-PP:433-463, :558), every `toFixed`, every word under 11 px | The two files share about 1,600 lines. The owner's half carries every must-keep (§4) |
| N-EM (634) | **Rewritten** as src/components/gex/StrikeMatrix.tsx, the Net tab. <br>**Kept:** the look (strike column, then a column per greek with its head "GEX · net · 1% move", a figure over a thin bar); the card's content; the keys ↑ ↓ j k, Home, End and Enter. <br>**Changed:** each row sits at the chart's y for its strike; Noah's own scrolling grid (ROW_H 30, N-EM:94) does not | Rows must align with the chart's strike rows; Noah's matrix sits at y≈565 where the chart has 489 at y≈372 (noah/hover-gex-matrix.png) |
| N-EL (1,133) | **Rewritten** as StrikeCalendar.tsx, GEX › Calendar. <br>**Kept:** a capsule per (strike, expiry); date heads "Oct 16 · today"; ★ on the heaviest cell; the supreme's ring; since-the-open badges. <br>**Changed:** rows on the chart's rows; figures from the greek pass (§2) | The same alignment rule |
| N-PV (376) and revamp src/data/exposureCurve.ts (124) | **Rewritten** as StrikeProfile.tsx on `profileAt` (§2.3), which reprices each contract | Noah's curve rescales each cell by one flat ATM vol per expiry (exposureCurve.ts:55-124): an approximation. The field reprices per contract. Upright or not is Q6 |
| N-EF (1,798) | **Not ported.** The GEX tab's own control is the View menu (Calendar · Profile). The desk's Expiry card stays the one expiry control, and gamma is the tab's one greek, as its name says; the other greeks live on Net. Noah's Greek and Expiries cards on this tab are not taken | Its panel mode reads the simulator every 10 s, keeps its own palette (N-EF:354) and its own Greek and Expiries cards (N-EF:308, :327). Two expiry controls in one head would contradict each other |
| revamp ledgerView.ts | **Not ported.** The GEX tab's view is kept per pane in `PaneCfg` | `slayer_ledger_view` is Pulse's key (the owner's ledgerView.ts:42) |
| revamp heatmap.ts, paletteInk.ts, palette.ts, ledgerPalette.ts | **Not ported** | Gold means amplify in Noah's (heatmap.ts:106-137); his walls are green and red (palette.ts:21-22) |
| revamp ui/FilterTabs.tsx | **The one idea taken:** `layoutDependency` (N FilterTabs:41-48). It goes into the house FilterTabs as an *optional* prop, so other rooms are unchanged. Not the foil | The pill otherwise trails its button while the panel is dragged |
| revamp ui/PointerCard.tsx | **Taken additively:** `foot`, `still`, `dense` and `letGoWords` (N PointerCard:51-63) go into the house card; existing callers unchanged | One house card for every tab's hover card |
| revamp strikeRole.ts, StrikeNum.tsx, RoomSpotRule.tsx, exposureSurface.ts, weigherDesk.ts | **Not ported** | Canvas rows draw roles themselves. The spot rule is Terrain's one price. The surface is the simulator's |

**The owner's files:**

| File | Fate |
|---|---|
| PP (1,993) | **Kept and evolved.** The exports Terrain imports stay (TR:68): `ProfilePanel`, `PROFILE_MIN_W`, `profileRestWidth`, `profileTier`, `ProfileLane`. `PALETTE_OPTIONS`, `ProfilePalette`, `heatOn` and `modeOf` (PP:104-128) go with Thermal (Q11). The Net diverging view (PP:1165-1216) is retired; the Sides drawing (PP:1217-1337) becomes the Ladder tab. The row geometry (PP:647-680, 784-805) moves to a shared module |
| src/components/gex/ProfileGuide.tsx | **Kept, rewritten** for three tabs. It speaks the ovals' inks (today it reads `palette`, TR:3551). The Glossary link stays |
| src/components/gex/ExposureField.tsx, ExposureMatrix.tsx, ExposureLedger.tsx | **Untouched.** Pinpoint's Map (MapDesk.tsx:41, :289) and Pulse (registry.tsx:33, :193) host them. Terrain never did |
| components/levels/HowSure.tsx | **Kept.** Its book lines are re-pointed in U7 (§2.6) |

**New files:**

| File | What |
|---|---|
| src/data/feed/greekModel.ts (pure, importable by the server) | `GREEK_MODEL` (version, units and sign per greek, separate from `TRAIL_MODEL` so no tile or cache goes stale); `greekColumn`; `calendarAt`; `profileAt`. TM exports what is private today: `obsAt` (TM:458), `windowAt` (TM:436), `YEAR_MS`, and the `Obs`/`OiObs` types |
| src/data/houseGreeks.ts | The same shape off a house bar (§2.5) |
| src/components/terrain/useViewedMinute.ts | The pane's minute, its column and its universe, per mode (§2.1) |
| src/components/gex/panelRows.ts | One row placement for every row tab: projection to y, pitch, culling, ▲/▼ counts, label stride, hit test. Lifted from PP:647-680 and 784-805 |
| src/components/gex/PanelRowKeys.tsx | The key layer (§1.3) |
| src/components/gex/StrikeMatrix.tsx, StrikeCalendar.tsx, StrikeProfile.tsx | The Net tab, GEX › Calendar, GEX › Profile |
| src/theme/type.ts (U8) | A TS mirror of the six type tokens, for canvases (theme/fonts.ts is the precedent) |

### 1.2 The panel

**Frame (the owner's PP, unchanged in behaviour unless noted):**

- **Rest widths:** 520 for one pane or the expanded pane, 340 for two or four, 240 for three (PP:95).
  - The owner approved these in the audit's proportions table (docs/terrain-audit-2026-10-15/README.md §6f).
  - Noah's 580 is not taken. At 1440 both land at 476 under the cap.
- **Width limits:** the floor is 180 (PP:89). The cap is `maxShare`: 0.4 on a desk and 0.82 on a phone (TR:3480; the
  default at PP:436 is 0.6, which Terrain overrides).
- **Grip:** the grip (PP:1913-1926) and the 400 ms drag guard (PP:500-503, :1609-1613) are kept.
- **Sash:** the sash between Size and Flow (PP:160-195, 528-550, 1927-1941; module-wide `slayer_profile_split`, 25–75 %,
  double-click resets) is kept.
- **New:** the grip and the sash take keys (←/→ in 8 px or 5 % steps, Home resets). Neither repo has this today.

**Tiers** (`profileTier`, PP:101, the same thresholds as Noah's):

| Tier | Head | Strike column | Ladder | Net (matrix) | GEX › Calendar | GEX › Profile |
|---|---|---|---|---|---|---|
| thin < 300 | two rows (approval 17 may add a row for the lane names) | 60 px, strike only; Δ in the read line from 240 px and in the card | legs; figures only when the lane is ≥ 180 px and the pitch ≥ 18 px; otherwise the card carries them | as many greek columns as fit at about 80 px: 2 at 236 px (computed, not measured); the rest named in a note | expiries at ≥ 48 px: about 3 at 236 px; a note says "Only N of M expiries fit" | the total and up to two expiries |
| mid 300–439 | two rows | 96 px: strike, Δ · σ | legs, with figures where they fit | 2–3 greeks | 4–5 expiries | total + 3 |
| full ≥ 440 | one row; lane names where they fit (U9) | 96 px | legs, figures, the NET column from a 300 px lane (PP:776, :1297-1305) | 4–5 greeks | 6+ | total + every expiry in the window |

**Head row 1, left to right:**

1. The three tabs, as the house FilterTabs (`.hit`; FilterTabs.tsx:33).
2. The active tab's own control:
   - Ladder: the Lanes menu (PP:78-83);
   - Net: the Greeks menu (house DropdownMulti);
   - GEX: the View menu (Calendar · Profile).
3. The desk's Expiry card (TR:3475, unchanged; bare beside other panes).
4. The Vol switch, on Ladder only (PP:1846-1859, as a house Chip with `.hit`).
5. How sure (PP:1860).
6. How to read.
7. The × ("Hide this rail — R", TR:3533).

The squeeze measures overflow and shrinks How to read, then How sure (PP:617-645).

**Below the head:**
- The key band, drawn on canvas and copied to `canvas[data-key]` (PP:824-925). It names only what is drawn.
- The column heads, moved to the DOM so they can carry Terms and keys (approval 17).
- The ▲ count line (`COUNT_BAND`, PP:152).

**The tabs:**

**Ladder** (Noah's look; the owner's Sides with its features):
- The put leg grows left and the call leg grows right from a centre line. Each leg is one solid ink: the put leg in
  `inks.put` and the call leg in `inks.call`.
  - Noah's legs are gradients along a ramp.
  - The house rule "TWO STATES, NO GRADIENT" covers "the ladder's bars" (.claude/CLAUDE.md, THE ORBS), so the legs are
    solid. The leg's length carries the amount.
- The figures past each tip.
- **The spine:**
  - A Catmull-Rom curve through the nets that passes through the flip's linear crossing (PP:1307-1337).
  - Its ghost at the open.
  - The ghost dots 10, 30 and 60 minutes back (PP:1338-1348).
  - The mark on the spine.
- The NET column.
- The Flow lane (PP:1363-1449, 1494-1527) on the minute's rows.
- The Vol underlay (PP:992-1044) on the viewed session's bars.
- **The legs come from the minute's column:** puts = (value + gross) ÷ 2 and calls = (value − gross) ÷ 2 (TM:640). So
  a replay finally has legs; it has none today (`legs: new Map()`, TR:518).

**Net:** the matrix (§2.3 for each greek's figure).
- One row per strike, at the chart's y.
- One column per greek picked (default GEX + DEX, kept per pane).
- Each cell is the net as an 11 px figure plus a bar. The bar's length is |v| ÷ the column's largest among the drawn
  rows, diverging from the column's centre: negative to the left, positive to the right.
- **Row height:**
  - at a pitch of 20 px or more, the figure sits over the bar;
  - from 16 px, the figure sits beside the bar;
  - under 16 px, only the bar is drawn, with a figure on every n-th row and on the levels, focus and hover rows, and
    the card carries the rest.
- The strike column carries Δ and σ at mid and full, plus the role (CW, PW, Flip, Sup, Top, the axis chips' own names).
- No row opacity (Noah's 0.72 and 0.6, N-EM:145, :508). A quiet row drops a text tier, the theme rule.

**GEX:**
- **View: Calendar · Profile**, kept per pane. Matrix is not offered; it lives on Net.
- **Calendar:**
  - Rows are strikes, at the chart's y.
  - Columns are the cut's listed dates within 60 days, as many as fit, with the fit note.
  - Each capsule is a cell of gamma (inks: Q7). The capsule's 11 px figure prints when the pitch is 18 px or more;
    otherwise the card carries it.
  - ★ marks the heaviest cell. The magenta ring marks the supreme's cell, and only that cell.
  - Since-the-open badges go on the 10 largest moves, against the field's open column (`openColumn`, TM:701), in the
    direction tokens with ▲/▼.
- **Profile:** estimated dealer gamma (assumed sign) repriced across prices (§2.3).
  - One quiet line per listed date in the window, and the total.
  - The flip drawn as the flip (`pickFlip`).
  - The curve's zero crossing labelled "Curve crosses zero", never "flip" and never "zero gamma". Measured, the two
    stand 0.3 to 8.3 points apart (data design §3: 771.66 against 771.94, 776.39 against 777.52, 737.23 against
    728.93).
  - Spot, the walls and the kept strike drawn as rules.

**Hover and keep:**
- **Hover** washes and rings the nearest row below the head (PP:1586-1608), on every row tab. In Profile it reads the
  price under the pointer.
- **A click keeps the strike.** This is Terrain's one `focus`, shared with the chart's pinned chain (TR:3534,
  TR:2251-2261; SC:1452-1462). Esc lets go through the house layer (ui/layers `useEscapeLayer`).
- **The read line** sits in the time-axis band (PP:1615-1643, 1735-1807) and says the minute.
- **The hover card** is the house PointerCard, extended with Noah's `foot` and `still`.
  - It sits beside the panel over the chart, at the row's y (N-PP:1594, 1603-1604).
  - It stands **whenever the row cannot print every figure it owes**: the minute's figure and, after U7, UW's.
    Noah's card stood only below the figure threshold (N-PP:1583).
  - Each tab's card is listed in §4.1.
- **Times** use `clock()` live and `minuteLabel()` for a replay or history minute (src/core/nyTime.ts:137, :208).
  Since-the-open uses `marketClock(9, 30)` (:156), on the reader's clock. Always 12-hour.

**Keys.** Today neither repo reaches a row by keys; the owner's rule is that rows a click opens also open from the keys
(.claude/CLAUDE.md, THE HOUSE PIECES).
- A key layer (PanelRowKeys) puts one roving row button in the Tab order, `[data-row-step]`, so it is in
  `rowStepKeys` ROW_STEPS (rowStepKeys.ts:27-36). It sits over the canvas at the walked strike's y.
- ↑/↓/j/k walk the strikes; Home and End jump; Enter or Space keeps; Esc lets go.
- The row's aria-label speaks the card's first line.
- The grip and the sash become focusable separators.
- **Empty states, never an unmount.** Today the panel unmounts when `rail.rows` is empty (TR:3464; AT:434 measured
  1.9 s blank after a replay pick). The panel now stands with its boxes and says why: "Waiting for the first minute",
  "No column at 10:42 am — the chain was not read yet", "This session's inputs are not kept". This is the house rule
  "never a blank without a reason".

### 1.3 Mounting

**One mount site serves all three places.** Terrain's `Pane` (TR:1084) mounts the panel at TR:3464-3540. That one
`Pane` is:
- the desk pane;
- the phone overlay (the `className` at TR:3539; `narrowLadder`, TR:2265-2296; the peek, TR:3068-3077);
- the pop-out (`TerrainSoloPane` renders `<Pane>` at TR:4788).

So replacing the mount replaces all three. What changes at the mount:

- **Condition:**
  - Today: `(belowLg ? narrowLadder : ladder) && rail.rows.length > 0 && !(offHouse && !chartTape)`.
  - New: `(belowLg ? narrowLadder : ladder) && !(offHouse && !chartTape)`. The panel shows its own empty state.
- **Props:**
  - Drop: `rows`, `maxAbs`, `legs`, `palette`, `openRatio`, `lagged`.
  - Add: `minute` (from `useViewedMinute`), `onTab` and `tab` (PaneCfg `panelTab`), `gexView`, `greeks`.
  - Keep: `ticker`, `volBars`, `sure`, `sigmaRem`, `levels`, `flow`, `lane`, `focusPrice`, `projection`, `onClose`,
    `ground`, `maxShare`, `headCard`, `width` and `restWidth`.
- **PaneCfg** gains `panelTab` ('ladder' | 'net' | 'gex'), `gexView` ('calendar' | 'profile') and `greeks`
  (MatrixGreek[]). Each is validated in `readPane` (TR:587) and carried by the pop-out's own copy (TR:4748-4760).
- **The guide's mount** (TR:3548-3553) drops `palette`.
- **The Colours card** (TR:4508) goes with Thermal (Q11). The pop-out's `rails` parameter (TR:4762) is read and
  ignored, so old links still open.
- **The expanded pane's right inset** (TR:4388) still reads `profileRestWidth`.
- **Unchanged:** R and Shift R (TR:4136-4147; keys.ts:83, :100), the Strikes button (TR:4484-4500), the peek and the
  overlay's focus in and out.

---

## 2 · The data

### 2.1 The minute viewed

`useViewedMinute(pane)` returns `{ mode, minute (epoch s), column, universe | null, spot, why }` and stamps
`data-panel-minute` on the panel for the checks.

| Mode | The minute | The column (the chart's gamma) | The universe (the other greeks, Calendar, Profile) | Updates |
|---|---|---|---|---|
| Live, feed | The newest column the chart draws: `fTrail.snaps` last (TR:1295) | That column | `NameTrail.us` (TF:261) through a new accessor, the same pattern as `straddlesAtMinute` (TF:506-522) | When the last column's time or its `readAt` changes (the trail publishes each bar, TF:362-411) |
| Replay | The column at the cursor: `columnAt` with its 2-minute slack (RF:201-206) | `rp.frame.column` | The twin's universe (`takeRecordedSession`, TF:195) or the rebuilt one (`takePastSession`, TF:181), the rule `straddlesAtMinute` uses | Each cursor step. The pass runs at **the column's own time and spot**, never `frame.bar`, so every tab shares one minute (the data check). Profile at most every 250 ms while playing. No column: every tab says why |
| History, feed (view off live; Q2) | The newest 1-minute column at or before the view's right edge. On 1D, the day panel's day at its last regular minute | Computed from that session's inputs (below): one source for gamma and the rest | The viewed session's kept inputs over `/feed/field/<NAME>/day/<D>` (server/feed.ts:690-694; `loadPastDay` LV:1044; `pastInputs` TM:693). The universe is built once a session, then about 3 ms a minute | When the view moves (StrikeChart hands the right edge, §2.4). Static otherwise |
| House's tape | The house's newest column, or the house replay's cursor column (`houseReplay.cols`, TR:1436-1439) | `Simulator.getGexHistory` at that minute (TR:2083) | The bar's own `callOI`, `putOI` and spot (§2.5) | Each scan (the market store's `revision`) |

**On 5m and up (Q3).** A chart cell keeps each strike's peak minute (`at`, src/data/timeframe.ts:194-212).
- Recommended: the panel reads one minute, the bar's last closed minute.
- The row's card then adds the chart's own figure: "On the chart this 5-minute bar draws its heaviest minute: $4.4B at
  12:39 pm".

**The one current price.**
- Δ from spot keeps Terrain's one live price while live (`feedRail(…, liveSpot)`, TR:489-493).
- In replay and history, the price is the minute's close.

**Ghost dots and since-the-open** follow the source the rows read:
- `laggedAt` (RF:259-282) on the field's columns at the viewed minute, live and in history.
- Today `liveLagged` reads UW's books live (TR:2080-2095). That mixes sources against the house rule "ghost dots …
  never mixed".
- The ghost at the open reads `feedOpenRatio` on the same columns (TR:2397-2401).

### 2.2 Every tab, every mode

| Tab | Live, feed | Replay | History, feed | House's tape |
|---|---|---|---|---|
| Ladder: legs, net, spine, Flow | The minute's column: legs from value and gross; flow `buildFlowFromRows` on its rows (hedgeFlow.ts:81-102) | The cursor's column | The viewed minute's column from inputs | The house column; legs exact from value and gross (simulator.ts:540-541) |
| Ladder: Vol underlay | Today's minutes cut at the minute | `rp.cut.bars` (TR:3483) | That session's minutes, cut at the minute | House candles |
| Net: GEX, DEX, VEX, vanna, (charm) | `greekColumn` on today's universe | The same, at the column's time | The same, on the session's universe | `houseGreeks` on the bar |
| GEX › Calendar | `calendarAt` (same pass, keyed by expiry) | Same | Same | **"—"** in every column: "the house's tape keeps no book by expiry". The desk-chain surface reads "now" even when handed a snapshot (revamp weigherDesk.ts:185, :192, :215), so it cannot be point-in-time |
| GEX › Profile | `profileAt` on today's universe | Same | Same | Repriced from the bar's strikes through the house's unit (`unitAt`, simulator.ts:486-499), so the curve at spot equals the house column |
| UW beside (after U7) | The newest 60-day read **received** at or before the minute's end, within 10 minutes | The same rule on the recorder's day (needs `/recorded/<D>` to serve books60) | The same on recorder-kept days; "—" elsewhere: "Unusual Whales serves no book by strike for a past minute" (TR:2059) | "—" |

**Never past the cursor.**
- `greekColumn` reads only through `obsAt` and `oiAt` at the bar's end (TM:458-479), exactly as `modelColumn` does.
- So the panel reads nothing after the cursor's knowable instant (`knowableAt`, RF:53), by construction. U2 proves it
  with the probe (`setPitProbe`, TM:453).
- **Said plainly:** open interest is "as published", not "as received".
  - `universeOf` stamps today's count from any chain read received from 07:00 New York with 07:00, whatever hour it
    arrived (TM:353-361).
  - So a replay of today at 8:00 am reads a count the recorder received at 9:51 am.
  - This is the field's own rule (the owner, 2026-10-13, "THE DAY'S COUNT FROM ITS PUBLICATION"), so it meets "same
    inputs as the field". The probe sees 07:00 and passes. The proof prints this as a NOTE rather than hiding it.

### 2.3 The greek pass and the matrix's columns

`greekColumn(u, bar, { half = TRAIL_HALF, only? })` is `modelColumn`'s loop (TM:571-644):
- The same `knowBy`, clock (the bar's middle), window (`windowAt`, recentred on the bar's close), `obsAt`, `oiAt`,
  rate and q, and the same "a contract past its end holds nothing" (TM:601).
- Per strike it keeps, for each leg (calls, puts): Σ OI·Γ·S², Σ OI·Δ·S², Σ OI·vega, Σ OI·vanna, Σ OI·charm, and Σ OI.
- It keeps the same per expiry (`u.expiry[j]`, `u.part[j]`), and the field's provenance (`prov`, `staleShare`,
  `readGap`, `wideShare`, `coverage`), weighted as the field weights them.
- `calendarAt` reads its per-expiry sums.
- `profileAt(u, bar, spots, window)` reprices the same contracts at each S′. Each contract keeps its own vol (sticky
  strike). The clock and open interest are the minute's. The 30-strike window is recentred at each S′.
  - Recentring makes the curve step where S′ crosses a strike. Zero crossings are found within one window, and the
    curve is drawn as steps where it steps (the data check).
  - Cost: 81 points over ±4 % took 38–62 ms a minute; 41 points about 23 ms (data design §3).
  - It runs only while Profile is open, once a minute, in idle slices on a phone.

**The columns.**

| Greek | Per strike, the house sign | Unit printed | UW beside | Verdict |
|---|---|---|---|---|
| **GEX** | −Σ calls OI·Γ·S² + Σ puts OI·Γ·S² (TM:608-620, 640) | $ per 1 % move (`TRAIL_MODEL.units`, TM:103) | **Yes, from U7.** The 60-day book (FR:489-536; LV:934-944), never the every-expiry book that `measuredAt` falls back to (TF:243-249). Measured: UW's 60-day ÷ OI·Γ·S² = 1.005 calls and −1.013 puts (SPY 2026-10-15, 2:00 pm) | **Compute.** It is the field |
| **DEX** | −Σ OI·100·Δ·S on both legs = the field's `dex` × 100 ÷ S (TM:640) | $ of the underlying. Not Noah's "1σ move" (revamp exposureSurface.ts:47, :176), which is unsigned and stands on an assumed σ | After S1. The recorder keeps `call/put_delta_oi` and each row's own price from the expiry-strike answer it already fetches (FR:503-519 drops them). Converted −UW × 100 ÷ the row's price. Before that: "—" "not kept yet" | **Compute.** Warning: `GexLevel.dex` is OI·Δ·S² on the feed and OI·100·Δ·S × weights on the house (simulator.ts:540, :588). Convert by source, never by field name |
| **VEX (vega)** | −Σ OI·100·vega, both legs; vega per vol point (greeks.ts:91; the "scaling trap" header, greeks.ts:35-42) | $ per vol point | **None.** No UW book carries vega (uw.ts:308-330; `KEEP`, FR:90). Shows "—", "not in Unusual Whales' book" | **Compute** |
| **Vanna** | −Σ OI·100·vanna·0.01·S, both legs; vanna per 1.00 σ (greeks.ts:98) | $ of delta per vol point | After S1 **and** a like-for-like unit proof on 60-day rows. The factor of 100 is measured only against the every-expiry book (SPY calls 101, puts −115; QQQ 146 / −156) and is unproven | **Compute** |
| **Charm** | −Σ OI·100·S·charm ÷ 365 (greeks.ts:100-105; the calendar clock, `uwYears` TM:68-72) | $ of delta per calendar day | After S1 and the same proof. UW's spec says "charm * open interest * 365" × price (docs/research-2026-10-13/notes/formulas_units_conventions.md:106-107) | **The owner decides (Q4).** Computable, but today's expiry's charm is a rate over a day the contract will not live, and item 10 holds the charm read to one number |

**Left out, as the owner asked to be told:**
- **Theta:** the house's pricer has none (greeks.ts:66-108).
- **Rho** (greeks.ts:94-95): not Noah's column, and no UW figure.
- **Speed, zomma, color, vomma, veta:** not in the pricer, not in Noah's matrix (revamp exposureSurface.ts:41-47), and
  no UW figure.
- **Gamma by volume:** UW's alone (LV:235). The model weights by open interest, so it would be a second model on one
  screen.

**The sign, said on the card.**
- Gamma assumes dealers long puts and short calls (TM:640; `TRAIL_MODEL.sign`, TM:104).
- Delta, vega, vanna and charm assume dealers short both legs: the field's `dex` (TM:640), the feed's mapping
  (`feedStrike`, LV:229-234) and the simulator's (simulator.ts:857-875).
- So one matrix row carries two put assumptions. `GREEK_MODEL.sign` names each, and the Net card states it.

**Words.** "Absorb" and "amplify" are gamma's words only. Each other greek has its own words on the card:
- DEX: "dealers hold $X of SPY against this strike";
- vega: "dealers lose $X a vol point up";
- vanna: "a vol point up moves dealers' delta by $X".

The ink is Q5.

### 2.4 History route and server work (no new vendor call anywhere)

| # | Change | Where | Cost |
|---|---|---|---|
| H1 | StrikeChart hands the view's right-edge time (`onViewTo`), beside `onViewEdge` (SC:862, :2673-2690, where `vr.to` is already read) | SC; TR:1763 | — |
| H2 | The panel loads the **viewed** session's inputs through the existing `/day/<D>` route. One universe is held per session (an LRU of 2), built in 8 ms slices on a phone (`SLICE_MS`, TF:274) | useViewedMinute; LV `loadPastDay` | 200–345 KB gzipped a session (SPY past.json.gz, 2026-10-12 to 10-15); universe 110–130 ms once; about 3 ms a minute |
| H3 | Gamma in history also comes from those inputs, not the 1-minute tile. Tiles hold money to 1/20,000 of the largest figure (tiles.ts:99-101) and no open interest, and 1-minute tiles are fetched only on 1m and as 5m's neighbour (TR:452-454) | — | Saves a second 317 KB download on 15m and up |
| S1 | `readBook60` keeps `call/put_delta_oi`, `call/put_vanna_oi`, `call/put_charm_oi`, their partitions and each row's own `price` | FR:489-533 | Disk, estimated 1.1 MB gzipped a day a name (today 326 KB) |
| S2 | `recorded()` serves books60 | FR:814-857 | — |
| S3 | `FeedBook60` keeps `receivedAt`; `measured60At` selects by it, returns null with a reason past 10 minutes, and has no every-expiry fallback | TM:17-27; LV:934-944; TF:226-250 | — |
| S4 | The Theta rebuild keeps its inputs (`b.past` as theta-past.json.gz), each tile set records its inputs' source (fieldTiles.ts:82), and `/day/<D>` serves the inputs the chart's columns were built from | server/thetaRebuild.ts:648; server/fieldTiles.ts | Size not measured; measure on the owner's machine |
| S5 | (Q12) UW's per-expiry rows, for the Calendar card's UW figure | FR:489-533 | Estimated 2–3 MB gzipped a day a name, trimmed to ±30 strikes |

S1, S2 and S4 reach the always-on recorder only when the owner restarts it (`npm run feed:recorder`, under
scripts/recorder.cmd).

**Until S4, SPX history** shows Ladder and Net gamma from the 1-minute tile, and "—" with "this session's inputs are
not kept" for the rest. SPX's tiles are Theta-built and its `/day` inputs are UW's (thetaRebuild.ts:648, the data
check), and two builds are never mixed on one panel.

### 2.5 The house's tape

Each simulator bar carries per strike `value`, `gross`, `dex`, `vex`, `callOI` and `putOI` (simulator.ts:530-546,
565-593).
- Gamma's legs are exact from value and gross.
- `dex` is already the panel's DEX unit; `vex` is its vega unit.
- Vanna and charm are priced for the viewed bar from its own `callOI`, `putOI` and spot, the name's iv and the
  simulator's τ, by the arithmetic at simulator.ts:865-875, with charm ÷ 365 (not ÷ 252) so the unit is the feed's.
- UW beside: "—".
- The same boxes stand with the keys in and out (the house rule "keys in and blanked draw the same boxes").

### 2.6 Names with no field, and what else reads the ladder's data

**Names with no field.**
- NDX, RUT, VIX, XSP, OEX and the other cash indices have no field: `fieldName` is false for them (TR:1247;
  CASH_INDICES, LV:118; only SPX/SPXW trade all sessions, core/sessions.ts:30).
- Today their ladder is UW's book. Q9 decides what the panel shows there.

**What else reads the ladder's data.** These read `railData` today:
- the axis chips, the decision strip and the level alerts (`levels`, TR:3494, :2910);
- the bead card's legs (`legsNow`, SC:886, :6632);
- the fit (`fitCandles = 8 × step`, TR:2984);
- the peek and top3 (TR:1924, :1930);
- How sure's book lines (`feedFreshness`, LV:446-450).

Live, `railData` is UW's book (`liveRail`, TR:1403; `feedRail`, TR:489-504). Once the panel reads the field, a CW chip
on UW's book beside a panel on the field shows two call walls on one screen. U7 moves `liveRail` to the field's column
with WallStick's held walls, as the replay already does (`frameRail`, TR:509-521). That is Q1. How sure's "figured by
Unusual Whales at …" lines are re-pointed to describe UW as the measured reference.

---

## 3 · Colours and type

### 3.1 Colours: one source, Terrain's

**The sign is the same in both repos, so the port changes inks only.**
- In both, a positive net means the puts lead and hedging amplifies (revamp heatmap.ts:71; the owner's heatmap.ts:61-64,
  GN:127).
- **The one trap:** the owner's paletteInk.ts still exports `EMBER` and `GLACIER` (paletteInk.ts:44-45), and `--ember`
  is gold (tokens.css:134). Any line of Noah's that imports `EMBER` for the puts (N-EM:92, N-EL:115) would paint the
  puts gold if it compiled unchanged.
- The port imports `AMPLIFY` / `ABSORB` (paletteInk.ts:49-50) and the renderer's `inks`. It never imports
  `EMBER`/`GLACIER`, and a lint line in the type check fails on them under the panel's files.

**Where each ink comes from:**

| What | Ink |
|---|---|
| Gamma bars, net figures, read-line dots, Calendar capsules, the Profile's total | `markInk(side, \|net\| ÷ gross, inks)` (GN:127). `inks` = `darkMarkInks()` (GN:120) on a dark tape, `trailPaperFrom(box)` (GN:251) on paper. These follow colour vision through `cvdGoldViolet` (heatmap.ts:517). The panel reads the same function the ovals read, not a fresh token lookup: under high-contrast the ovals' grey stays 125 (GN:41) while `--text-muted` moves |
| Ladder legs | `inks.put` / `inks.call`, solid; a leg is one side, so never grey |
| Key-band swatches | The chart legend's own `beadLegend.inks` (GN:1468-1477), drawn as Terrain's `LegendSwatch` (TR:59-61) |
| Walls, flip, supreme | `CALL_WALL` = `--absorb`, `PUT_WALL` = `--amplify` (paletteInk.ts:29-30); `--flip`; `--supreme` only on the supreme's row, cell or rule |
| Δ from spot, since-the-open | `--bull` / `--bear` with `data-dir` on DOM figures. On canvas, ▲/▼ is drawn before the figure under any `data-cvd`. The commit message of 20d4204 keeps Terrain's direction words on the house pair, because the candles' inks fall under 4.5:1 as 11 px words on 21 of 84 option sides |
| Non-gamma greek bars | Q5 |
| Hairlines and washes | `rgb(var(--ink) / a)`; chips on `--panel`; silver `--silver` (tokens.css:61, :95, :182) |
| Card | The house PointerCard; the guide's dark glass `[data-chart-glass]` (index.css:1202-1209) |

**Not ported:**
- Thermal: its red is the owner's "no" (heatmap.ts:70-91 in revamp; the owner's `thermal-yellow`, heatmap.ts:105).
- Noah's House ramp, the palette glide, `useLedgerPalette`, the Settings-wide ledger palette, Noah's ColoursSwitch.
- The holo pill: the brand rule keeps the foil to the S, the live dot and "Launch terminal".
- The desk's Colours card goes (Q11). There is no second switch. Colour vision stays in Settings › Appearance, where
  it already reaches the ovals.

### 3.2 Type (approval 2's scale; tokens land in U8, sizes honoured from U3)

| Token | Size / line | On the panel |
|---|---|---|
| `--fs-tick` | 10 / 12 | The Profile's price and gamma axis ticks only |
| `--fs-label` | 11 / 16 | Every canvas word: strike, Δ, σ, figures, key, flip caption, chips, ▲/▼, VPOC, capsule figures. Also column heads, card rows, read line, menus |
| `--fs-body` | 12 / 16 | The tabs (FilterTabs `text-xs`, FilterTabs.tsx:33), card body |
| `--fs-strong` | 13 / 20 | The card's title (ticker and strike) |
| `--fs-head` | 15 / 20 | — |
| `--fs-display` | 20 / 24 | — |

Rules applied to the panel:
- **Weights:** 400 for figures and words, 500 for a role word, 600 for heads, the active state, the strike in the
  wide column and the spot chip. 700 goes; it appears at PP:1176, :1201, :1300 and elsewhere.
- **Case:** sentence case, no tracking.
  - Column heads: "Net gamma", "◂ puts · calls ▸", "Strike", "Δ spot · σ", "A move forces".
  - Card heads: "Puts", "Calls", "Open interest", "Change since the open (6:30 am)".
  - Greek heads: "GEX", "DEX", "VEX", "Vanna", "Charm".
  - Dates: "Oct 16 · today".
- **Spacing:** the 4 px grid. `HEAD_TOP` 32; `COL_HEAD`, `COUNT_BAND` and `FOOT_BAND` 16; `LABEL_PITCH` 16, since an
  11 px word needs its 16 px line.
- **Controls and icons:** control heights 16, 20, 24 and 32; icons 12 in a row and 16 in a menu.
- **Figures** go through core/format: `pctSigned`, `num`, `usdCompact`, the true minus. Never a `toFixed` (Noah's at
  N-PP:1412, :1470, :1613, :1686; N-EM:325, :336).
- **Times** are 12-hour on the reader's clock (§1.2).
- **Words check:** Noah's 13 files pass `npm run words:check` as copied (rules mapping (d)). The new strings are checked
  in each unit.

### 3.3 House components

| Need | Component |
|---|---|
| Tabs | ui/FilterTabs, plus the optional `layoutDependency` |
| Lanes, View | ui/DropdownSelect |
| Greeks | ui/DropdownMulti, with disabled rows that carry their reason (Charm under Q4) |
| Expiry | ui/ExpiryCard (TR:3475) |
| Vol | ui/Chip, given `.hit` |
| How to read | GuideDoor + GuideFocus |
| How sure | HowSureBook |
| Cards | ui/PointerCard, extended |
| Lane names | ui/Term, with no `truncate` |
| Esc | ui/layers `useEscapeLayer` |
| Rows | ui/rowKeys and ROW_STEPS |
| Spot rule | ui/SpotRule, fed Terrain's one price |

---

## 4 · Nothing lost

### 4.1 Every feature of the owner's ladder, and where it lands

| Feature (where today) | In the new panel |
|---|---|
| Flow lane, capsules, level chips (PP:1363-1449, 1494-1527) | Ladder tab, Lanes menu, unchanged arithmetic on the minute's rows. Fix Noah's bug (a): the tabs always show, whatever the lane |
| Sash (PP:528-550, 1927-1941) | Unchanged, plus keys |
| Δ from spot, with `data-dir` (PP:1467-1485, :1750-1756, :1678-1681) | Strike column (mid, full) on Ladder and Net; read line; every card. **New:** on the thin tier it is in the read line and every card. Today thin-tier Net can show it nowhere (computed from PP:1174, PP:1650) |
| σ to the close (PP:1471-1483; TR:1699-1709) | Beside Δ, as today |
| Spot chip and rule (PP:1083-1092, 1529-1540) | Every row tab; in Profile, a horizontal rule at spot's y |
| NET column (PP:1297-1305) | Ladder, from a 300 px lane |
| Spine, ghost at the open, ghost dots, the mark (PP:1307-1348) | Ladder; the ghosts from the field's columns (§2.1) |
| Vol underlay, VPOC, value area (PP:552-567, 992-1044) | Ladder; the viewed session, not always the newest (a fix) |
| Wall stripes, supreme wash, flip rule (PP:815-822, 1063-1081, 1499-1507) | Every row tab. **New:** broken and reclaimed on the wall's row ("PW 772 broken · 10:54 am", from `railWallState`, TR:1472-1490, which today reaches only the chart) |
| ▲/▼ culled counts (PP:784-799) | Every row tab, on their own band (fixes Noah's bug (c)) |
| Key band with `data-key`, gated on what is drawn (PP:824-925) | Every tab's own key |
| Hover, keep, Esc (PP:1586-1613) | Every tab, plus rows by keys |
| Read line (PP:1615-1643, 1735-1807) | Every tab, with the minute |
| Hover card (PP:1644-1734) | Every tab (§1.2), as the house card |
| How sure door, eleven sections (PP:1860; HS:137-252) | Head; book lines re-pointed in U7 |
| How to read, Glossary link (PG:219-297) | Rewritten for three tabs; ovals' inks |
| Expiry card, desk-wide, bare beside other panes (TR:3475) | Head, unchanged. After U7, "All 60 days" becomes true: every tab reads the 60-day universe (TM:51) |
| Grip, 400 ms drag guard, rest widths, 40 % cap, 180 floor (PP:477-527) | Unchanged; floor against cap is Q10 |
| Tiers and head squeeze (PP:617-645) | Unchanged; fixes Noah's bug (e) |
| `data-plot-inset` and the fit (PP:1949; SC:2470-2479) | Kept; measured from the DOM in U9 |
| Projection, rows on the chart's rows (PP:647-680; SC:568-575; `bookProjection` TR:456-466) | Every row tab, through panelRows |
| Phone peek, overlay, focus in and back, Esc (TR:2262-2296, 3068-3077) | Unchanged mount; every tab |
| R, Shift R, the Strikes button, × to Strikes (TR:4136-4147, 4484-4500, 3503-3533) | Unchanged |
| Pop-out (TR:4748-4810) | Same `Pane`, same panel |
| Expanded pane (TR:4388) | Unchanged |
| Colour vision and paper ground (PP:211-344, 439-450) | Via the ovals' inks (§3.1) |
| Motion: tween 110 ms, the mirror, redraw on change (PP:568-603, 722-747, 1542-1578) | Kept; the palette glide goes with Thermal |
| UW comparison: How sure's model agreement (HS:176-182), the bead card's measured figure (SC:6620), the day panel's end-of-day book (TR:1879-1918) | All kept, and UW's 60-day figure now stands beside the panel's own (U7) |
| What the chart reads off the ladder's data (§2.6) | Kept; their source decided in Q1 |
| The tests and the landing film that read `data-profile-*`, `data-lane-head` and `canvas[data-key]` (terrain-ui-proof checks at PR:524, 576, 978, 1136, 1156, 1183, 1416, 1632, 1897, 2320; landing-acts/terrain.mjs:8-29; orbs-proof.ts:209-214) | Hooks kept. `data-profile-view` takes `ladder` / `net` / `gex` (`ladder` already meant Sides, PP:1887). The ten checks are updated in U6 |

### 4.2 What Noah's panel lacks

Each item is ported from the owner's file unless marked new.

| Lacks | Port, and how |
|---|---|
| Real data, replay, history (N-PP:433-463, 558; N-T:291-330) | New: §2 |
| UW comparison | New: U7 |
| How sure (no `sure` in N-PP) | Port the owner's door |
| σ to the close | Port |
| Ghost dots (no `lagged`) | Port, from the field |
| NET column | Port |
| `data-plot-inset` | Port, then measured (U9) |
| Drag guard (N-PP:1541-1544 has none: audit C-29b) | Port |
| `COUNT_BAND`, so ▲ never sits on row 1 (N-PP:1421) | Port |
| Head squeeze (N-PP has none; × over the GEX tab at 180) | Port |
| Key gating and `data-key` (N-PP:832-858 names what is not drawn) | Port |
| Phone (`hidden lg:block`, N-T:1938) | Port the owner's mount |
| Colour vision (0 matches in N-PP and revamp heatmap.ts) | Via the ovals' inks |
| Direction ink on the canvas Δ (N-PP:1411 writes `var()` into a canvas) | Resolved inks plus ▲/▼ |
| `data-dir` on DOM figures | Port |
| Glossary link in the guide | Port |
| Real volume (`Simulator.getCandles`, N-PP:558) | Port `volBars` |
| 40 % cap (60 % fixed, N-PP:500, 511) | `maxShare` |
| Remembered tab (`useState('gex')`, N-PP:432) | PaneCfg `panelTab` (Q8) |
| Profile in the panel (`VIEWS_FOR.tile` = calendar, matrix, revamp ledgerView.ts:41) | New: GEX › Profile |
| Rows by keys, focusable grip and sash | New in both repos |
| Broken and reclaimed walls | New in both repos |
| Empty states instead of an unmount | New in both repos |

**Noah's bugs, not carried, each with a check in U3–U5:**
- (a) lane Flow hides the tabs;
- (b) Δ ink;
- (c) ▲ overlaps row 1;
- (d) the flow text runs under the wall chip at a 0.75 split (fixed by settling the boxes);
- (e) × over the GEX tab at 180 px;
- (f) a hover kept after a tab click. The hover is cleared on a view change; this was seen once, so the check asserts
  the rule rather than the reproduction.

**Asks in this section:** none beyond Q8 (which tab opens) and Q11 (Thermal). Everything else ports.

---

## 5 · Units of work

**Every unit:**
- Lands as one commit pushed to claude/trusting-planck-o77m11. No branch, no PR (.claude/CLAUDE.md, "How work lands").
- Is run before its push with: `npm run typecheck`, `npm test`, `npm run words:check`, `npm run terrain:check --
  --url=<own port>` (never 5180 or 5190), and the unit's own checks.
- Ends with `graphify update .`.
- Every new browser check is shown to FAIL on the commit before it, with the fail line quoted in the commit message
  (the house's practice since 6k).

### U0 · Groundwork (no product change)
- Confirm #70 (the node look) has landed, and rebase the line numbers here.
- Shoot the current ladder at the U10 set as the "before" sheet (docs/strike-panel-<date>/before/).
- Add the development switch: `?panel=next`, read under `import.meta.env.DEV` only. It mounts the new panel in place of
  the old in the same `Pane`. It is removed in U6.

### U1 · The greek pass (pure; no UI)
- **Files:** src/data/feed/greekModel.ts (`GREEK_MODEL`, `greekColumn`, `calendarAt`, `profileAt`); TM exports
  (`obsAt`, `windowAt`, `YEAR_MS`, types); src/data/houseGreeks.ts.
- **Proof:** scripts/strike-greeks-proof.ts, added to `npm test`. It runs on a synthetic day plus every recorder day on
  disk, and prints a NOTE where there are none.
  - (a) The gamma net and gross equal `modelColumn`'s value and gross, and DEX equals `dex`, to 1e-12 relative, for
    every strike of 50 sampled minutes in each mode (live inputs, past inputs, carried vols).
  - (b) The legs equal (value ± gross) ÷ 2.
  - (c) A strike's Calendar cells summed over each window's expiries equal `windowView(column, w)` at that strike, for
    all, 0dte, fri and opex (TM:651).
  - (d) Profile at S′ = spot equals `netOf(column)` (TM:709) to 1e-9. The zero crossing is reported beside `pickFlip`,
    and they are not asserted equal.
  - (e) One call and one put of known greeks give the signs in the §2.3 table.
  - (f) Units: vega is never scaled twice (the greeks.ts:35-42 trap); vanna × 0.01 × S; charm ÷ 365; DEX = dex × 100 ÷ S.
  - (g) The house bar: exact legs, and `dex`/`vex` in the panel's units.
  - (h) Timing printed: live and past ms a minute, and Profile ms for 41 and 81 points.
- **Fails on the old code:** the module does not exist.

### U2 · The minute viewed
- **Files:** useViewedMinute.ts; SC `onViewTo` (H1); the history input loader (H2/H3); TR wiring (no visible change).
- **Proof:** replay-cursor-proof gains section (iv). At 50 random cursors on the synthetic day and the recorder's days,
  the panel's minute equals the frame column's time, and every read in the greek pass and the Profile is ≤
  `knowableAt(cursor)` through `setPitProbe`. A NOTE prints the 07:00 open-interest stamp (§2.2).
- **Browser check:** "panel: the minute it reads is the chart's — live the newest column, in a replay the cursor's, off
  live the view's right edge".
  - It reads `data-panel-minute` against the newest column, the replay badge and `data-chart-view` after a pan.
  - It fails on old code: there is no attribute, and the old ladder keeps the newest book after a pan (TR:1468).

### U3 · The panel frame and the Ladder tab (behind the switch)
- **Files:** PP merged (§1.1); panelRows.ts; PanelRowKeys.tsx; FilterTabs `layoutDependency`; PointerCard extensions;
  Chip `.hit`.
- **Browser checks** (each on 1440 × 900 and 1920 × 1080 at 1, 2, 3 and 4 panes, and on the phone):

| Check | What it asserts | Why the old code fails |
|---|---|---|
| "panel: three tabs, the pick kept per pane over a reload" | — | No GEX tab |
| "Ladder: the put leg in the ovals' put ink, the call leg in the call ink, exact RGB at one strike, dark and paper, under standard, blue-orange and high-contrast" (C1) | — | Today's Sides legs are a ramp gradient |
| "Ladder: legs in a replay" | — | `legs: new Map()`, TR:518 |
| "rows on the chart's rows" (R1, R3) | 60 of 60 hovers name the chart's strike at 1, 2 and 4 panes | 57 of 60 measured today (AU:267) |
| W1–W4 | Width ≤ round(0.4 × parent) + 1 at rest, after the grip's widest drag, and after expand and collapse; the chart keeps ≥ 60 %; `data-tier` equals `profileTier(width)` | — |
| Noah's (a)–(f), one check each | — | — |
| "rows by keys: Tab reaches one row, ↓ and j step, Enter keeps and the chart pins the same strike, Esc lets go" | — | Nothing focusable |
| "the panel stands with its reason when the minute has no column" | — | Unmount, AT:434 |

### U4 · The Net tab (matrix)
- **Files:** StrikeMatrix.tsx; the Greeks menu.
- **Checks:**

| Check | Why the old code fails |
|---|---|
| "Net: one row per strike at the chart's y, each picked greek a figure and a bar; the GEX bar's ink equals the oval's `markInk` at that strike in the same column" | Old Net has one diverging bar and no greeks |
| "Net: a greek that does not fit is named in the note, never squeezed — no cell's scrollWidth over its clientWidth, at 180 to 580 px" | — |
| "Net: the GEX figure at a strike equals the bead card's figure for the minute" | Old Net shows UW's book live |
| "Net: no row opacity; a quiet row drops a text tier" | — |

### U5 · The GEX tab (Calendar, Profile)
- **Files:** StrikeCalendar.tsx; StrikeProfile.tsx; the View menu.
- **Checks:**

| Check | Why the old code fails |
|---|---|
| "GEX: the View menu offers Calendar and Profile, never Matrix" | No GEX tab |
| "Calendar: rows on the chart's rows; a strike's capsules summed equal the Ladder's net (in page)" | — |
| "Calendar: the fit note names the expiries left out" | — |
| "Profile: the flip rule at `pickFlip`'s price; 'Curve crosses zero' labelled apart from it; the curve at spot equals the column's net" (and, if Q6 is upright, "price runs down the side on the chart's own scale") | — |
| "Calendar on the house's tape: every column '—' with its reason, the boxes standing" | — |

### U6 · The swap: the new panel replaces the ladder
- Remove the switch. Mount the new panel at the one `Pane` site (§1.3). Retire the Net diverging view, Thermal and the
  Colours card (Q11), and the `palette` and `rows`/`legs` plumbing.
- Rewrite the guide. Update the ten terrain-ui-proof checks that read the ladder (§4.1) and the landing act's selectors.
- Update the stale line in .claude/CLAUDE.md about the under-lg Strikes door (deleted in 40b297e), and add the panel's
  rule paragraph ("THE STRIKE PANEL").
- **Checks:**

| Check | Why the old code fails |
|---|---|
| "phone: the panel lays over the chart on its ground on every tab; the keys go in and back to the peek; Esc closes; How to read opens" (PR:978 extended to three tabs) | No tabs |
| "pop-out: the panel stands with its three tabs" | — |
| "guide: speaks gold and violet on every tab" | — |
| orbs-proof's term section | Updated, not new |

### U7 · Approval 1: the chart's number, with UW's figure beside it
- **Files:** S1–S3 on the server; `measured60At`; the panel's UW slots; `liveRail` to the field (Q1); How sure's book
  lines; the Expiry card's label made true.
- **The labels** (wording in Q13):
  - **Row**, where it fits: the figure, then "UW $918M" in `--text-muted` with a Term ("Unusual Whales' book,
    expiries within 60 days, figured 10:41 am").
  - **Card:** "Modeled · 10:42 am" against "Unusual Whales' book (60 days) · figured 10:41 am".
- **Checks:**

| Check | Why the old code fails |
|---|---|
| "approval 1: at five strikes the panel's GEX equals the chart's bead for the minute, and UW's 60-day figure stands beside it with its time; never the every-expiry book" | The old ladder is UW's every-expiry book |
| Unit, in trail-field-proof: `measured60At` selects by `receivedAt`, null with a reason past 10 minutes, no fallback | — |
| Unit, in field-store-proof: books60 rows keep delta, vanna, charm and the row price; `/recorded/<D>` serves books60 | — |
| Unit: like-for-like vanna and charm units on 60-day rows before their UW slot is switched on. Until then "—" with the reason | — |
| "one call wall on screen: the CW chip, the decision strip's Nearest and the panel's wall row name one strike" (Q1) | Today the chip is UW's |

### U8 · Approval 2: the scale as tokens, on the panel
- **Files:** the six tokens in src/theme/tokens.css and tailwind.config.ts; src/theme/type.ts mirroring them; the panel
  and its views on the tokens; weights, grid, control heights and icons.
- The rest of Terrain stays in approval 2's own queue (6k, "2 (the DOM, then the canvas)").
- **Checks:**

| Check | Why the old code fails |
|---|---|
| "type: on every tab and tier, every `fillText` font and every computed DOM font under the panel is 10 (Profile ticks only), 11, 12, 13, 15 or 20 px; weights 400, 500, 600; no uppercase; letter-spacing 0" (T1) | 20 sub-11 canvas words on today's ladder, AU:229 |
| Unit: type.ts equals the CSS tokens | — |
| A lint of the panel's class names for off-grid spacing | — |

### U9 · Approval 17: lane names whole at every width
- **Files:** the head lays the lane names and the matrix's greek heads on row 1 where they fit, else on a row of their
  own. No `truncate`. Terms are focusable. `data-plot-inset` is measured from the head's DOM bottom, not from constants
  (today PP:1949).
- **Checks:**

| Check | Why the old code fails |
|---|---|
| H1 at 180, 236, 294, 340, 440, 476, 520, 580 px: every name's width ≥ its scrollWidth, reachable by Tab, its Term opens on focus | Names show only from 640 px, PP:1842 |
| H2: the inset equals the head's measured bottom, and the highest fitted strike's row sits below it | — |

### U10 · The screenshot set and the report

| Set | Contents | Count |
|---|---|---|
| Main, dark | Ladder, Net, GEX › Calendar, GEX › Profile × 1 and 4 panes × desk 1920 × 1080 and phone 390 × 844. On the phone, the overlay is open on the first pane | 16 |
| Paper | The four views at 1 pane on desk and phone | 8 |
| Replay | Each tab once at 1 pane, the badge and the panel's minute in view | — |
| History | Panned back, the panel's minute label | — |
| Hover card | At the thin tier, with UW's figure | — |
| Approval 17 sheet | The eight widths on one sheet | — |
| Before and after | U0's sheet beside the new one; Noah's matching shots from the scratchpad beside them | — |

- Everything goes in docs/strike-panel-<date>/ with a README.
- The audit's 6k table marks 1, 2 (the panel's part) and 17.
- The report lists every left-out greek and every "—" with its reason.

---

## 6 · Risks and the honest cost

**Lines (estimate).**

| Part | Lines added |
|---|---|
| greekModel and houseGreeks | ~450 |
| useViewedMinute, the history loader and SC | ~300 |
| PP merge | ~+500 / −600 |
| panelRows and the key layer | ~350 |
| StrikeMatrix | ~600 |
| StrikeCalendar | ~650 |
| StrikeProfile | ~500 |
| Terrain mount and PaneCfg | ~200 |
| Server S1–S4 | ~150 |
| Tokens | ~120 |
| Checks: about 25 browser checks and 3 proof sections | ~1,300 |

About 5,000 lines added and 1,000 removed in all.

**Time (estimate).** 8 to 10 working sessions of the size of the audit's fix batches: U1 1, U2 1, U3 1.5, U4 1,
U5 1.5, U6 1, U7 1, U8 0.5–1, U9 0.5, U10 0.5.

**Page CPU, measured on this container under another workflow's load, so unsure:**
- The greek pass: about 3 ms a minute for a past session and about 7 ms live, rising as chain reads pile up on each
  contract (`obsAt` scans linearly, TM:458).
- Four panes live: about 28 ms a minute.
- Profile: 38–62 ms per new minute, only while open.
- History: 110–130 ms once per viewed session.
- Assume 3–5× on a phone. Slice it.

**Server.** No new CPU in steady state; the pass runs in the page. The recorder writes more (S1 about 1.1 MB/day/name
gzipped, estimated; S5 2–3 MB if Q12). theta-past.json.gz's size is not measured.

**Risks:**
1. **Concurrent edits.** Another workflow is editing Terrain.tsx and StrikeChart.tsx now. Keep units small and re-grep
   every anchor.
2. **Two put assumptions in one matrix row** (§2.3). Said on the card; not hidden.
3. **UW's vanna and charm units are hypotheses.** UW's slots for them wait for the like-for-like proof.
4. **Outside this port:** uw.ts:343-344's ÷ 365 makes the feed's charm 3.65× a dollar delta per day on SPY's two
   measured minutes. That touches Pinpoint on the feed and the walls-heat Charm lens (wallsHeatPrimitive.ts:180-197).
   Report it and fix it as its own task after the like-for-like check.
5. **Today's-expiry charm** dominates near-money rows late in the session (Q4).
6. **The 07:00 open-interest stamp** in a replay of today (§2.2). This is the field's rule, said in the proof's NOTE.
7. **Canvas rows with one roving DOM row** for screen readers. Verify with the browser's accessibility tree in U3.
8. **Stale landing films.** The landing's Terrain films (scripts/landing-acts/terrain.mjs) show the old ladder.
   Re-filming is its own run with ffmpeg, not in this port, as with Compass's films.
9. **The always-on recorder** gets S1, S2 and S4 only when the owner restarts it.
10. **The walls-heat lens** paints DEX and Charm in gold and violet by sign (wallsHeatPrimitive.ts:229). If Q5 is
    answered "neutral", the chart's lens disagrees with the matrix until the lens follows. That is outside the port;
    flag it.
11. **A stale check:** scripts/perf-sweep-proof.mjs:227 waits for the ladder on /pinpoint, where it is not mounted.
    Outside the port; flag it.

---

## 7 · Questions for the owner

Each question has a recommended answer. The build proceeds on the recommendation unless the owner says otherwise.

**Q1 · Live, where do the walls, flip and supreme come from?** These sit behind the axis chips, the decision strip,
the level alerts and How sure (§2.6). Blocks U7.
- **Recommended: the field's column at the minute, with the held walls, as the replay already does (TR:509-521).**
  - Gain: one call wall on the screen, the panel's and the chip's.
  - Lose: the chips no longer show UW's walls. Those stand in How sure as the measured reference.
- Other way: keep UW's book for them. Then the panel and the chips can name different walls.

**Q2 · "The minute being viewed" off live.** Blocks U2.
- **Recommended: the newest 1-minute column at the view's right edge; on 1D the day panel's day.**
  - Gain: the panel follows the chart without a click.
  - Lose: a pan that moves the right edge moves the panel.
- Other ways:
  - only a click on a bar: steadier, but nothing changes until a click;
  - the crosshair: too fast for a whole panel.

**Q3 · On 5m and up, which minute?** Blocks U2.
- **Recommended: one minute for every tab (the bar's last closed minute), with the chart's heaviest-minute figure on
  the row's card.**
  - Gain: Ladder, Net, Calendar and Profile agree.
  - Lose: on 5m a row can differ from the bead beside it.
- Other way: Ladder and Net at each strike's peak minute.
  - Gain: they match the bead.
  - Lose: mixed minutes on one panel, and Profile cannot follow.

**Q4 · Charm in the matrix.** Blocks U4.
- **Recommended: listed in the Greeks menu, disabled, with the reason: "held to one number in How sure until the track
  record earns it" (item 10).**
  - Gain: the owner's rule kept, nothing misleading.
  - Lose: no per-strike charm.
- Other ways:
  - (b) charm as a per-day rate, including today's expiry, labelled as a rate. Lose: late in the day it swamps the
    near-money rows with a rate over a day the contract will not live.
  - (c) charm on later expiries only. Lose: a 0DTE window shows an empty column.

**Q5 · Ink for DEX, VEX, vanna (and charm).** Blocks U4.
- **Recommended: a neutral ink (the text tiers), the bar diverging left or right by sign, the card's own words.**
  - Gain: gold and violet keep the one meaning, absorb and amplify (the owner's ORBS rule).
  - Lose: those columns carry no hue.
- Other way: the ovals' pair by sign, as the chart's DEX and Charm lens already paints (wallsHeatPrimitive.ts:229).
  For vanna, charm and vega the sign follows moneyness, not puts against calls, so gold would not mean the calls there.

**Q6 · Profile: upright?** Blocks U5.
- **Recommended: turned upright. Price runs down the side on the chart's own scale, gamma across.**
  - Gain: the flip, walls and spot sit on the chart's own rows, as the rule "rows aligned with the chart's strike rows"
    asks.
  - Lose: Noah's look (price across, N-PV) changes.
- Other way: keep it across and exempt Profile from the alignment rule.

**Q7 · Calendar capsules.** Blocks U5.
- **Recommended: two states.** The side's ink, or grey where |net| ÷ gross < 0.2, with a bar inside the capsule whose
  length is the amount.
  - Gain: one colour rule on the panel and the chart.
  - Lose: Noah's heat look.
- Other way: the gold-violet ramp by amount (`heatCellStyle`, heatmap.ts:573). It breaks "two states, no gradient", and
  its dark low end reads like "balanced".

**Q8 · Which tab opens first?** Blocks U3.
- **Recommended: Ladder, then each pane remembers its pick.**
  - Gain: the view the owner named first, with the chart's own picture.
  - Lose: the standing "Net by default" (.claude/CLAUDE.md, the UI pass).
- Other way: Net, the matrix. At 2–4 panes that is two greeks at 236 px.

**Q9 · Names with no field** (NDX, RUT, VIX, XSP, OEX and the other cash indices). Blocks U6.
- **Recommended: Ladder and Net show UW's book for the name, labelled "Unusual Whales' book — no modeled field for this
  index"; Calendar and Profile "—" with the reason.**
  - Gain: those panes keep a strike book, as today.
  - Lose: a vendor figure where the rule says the field, but labelled, and only where no field exists.
- Other way: "—" everywhere. Those panes lose their only book.

**Q10 · A desk pane narrower than 450 px**, where the 180 px floor beats the 40 % cap (PP:498). Blocks U3.
- **Recommended: the panel lays over the chart there, as on the phone, opened by R, Strikes or the peek.**
  - Gain: the chart keeps its 60 %, and the panel stays usable.
  - Lose: it is not side by side there.
- Other ways:
  - the floor wins: the chart drops under 60 %;
  - the cap wins: a panel of 160 px prints nothing.

**Q11 · The desk's Colours card.** Blocks U6.
- **Recommended: retire Thermal and, with it, the card.** The panel wears the ovals' inks; colour vision stays in
  Settings › Appearance.
  - Gain: a strike reads the same on panel and chart; no red; no second switch.
  - Lose: a reader who picked Thermal loses it. data/terms.ts:71 changes with it.
- Other way: keep Thermal as a ladder-only pick and accept the mismatch, which exists today (AT:394).

**Q12 · UW's figure for the Calendar's cells.** Blocks U7, in part.
- **Recommended: keep UW's per-expiry rows, trimmed to ±30 strikes (S5).**
  - Gain: the Calendar's card shows UW beside each cell.
  - Lose: about 2–3 MB/day/name of disk (estimated).
- Other way: the Calendar card shows UW's per-strike total only, and "—" per expiry.

**Q13 · The row's short label for UW's figure.** Blocks U7.
- **Recommended: "UW $918M" in the muted tier, with a Term naming it in full and its time; the card always spells out
  "Unusual Whales' book (60 days)".**
  - Gain: it fits a 236 px row.
  - Lose: the abbreviation "UW" on screen.
- Other way: the full name on the card only. The row then never carries UW's figure; the card does, as approval 1
  allows.
