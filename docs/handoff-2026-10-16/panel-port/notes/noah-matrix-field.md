# Noah's matrix and field views at 1ebc5bb: the anatomy

Source: /home/user/revamp at 1ebc5bb ("The expected move: the field alone, and on the stage out of hours"). Read only.
Every path below is under /home/user/revamp. Line numbers are at 1ebc5bb. Everything here comes from reading the code;
nothing was run. Where I am unsure, I say so.

## 0. What matters most for the port

1. **The panel's View picker offers Calendar and Matrix, not Profile.** ExposureField picks its view list by host:
   `viewHost = toolbar === 'band' ? 'map' : 'tile'` (src/components/gex/ExposureField.tsx:356). Terrain's panel mounts
   it with `toolbar="panel"` (src/components/gex/ProfilePanel.tsx:1910), so the host is 'tile', and
   `VIEWS_FOR.tile = ['calendar', 'matrix']` (src/components/gex/ledgerView.ts:41). Profile is only on Pinpoint's Map
   band (`VIEWS_FOR.map`, same line). The panel opens on Calendar (`FIRST.tile`, ledgerView.ts:38), remembered under
   `slayer_ledger_view`. A saved 'profile' falls back to Calendar (ledgerView.ts:47, 51). The comment at
   ProfilePanel.tsx:426-430 lists "View · Greek · Legs · Expiries · Strikes · Show, the guide, fullscreen", but in panel mode
   Legs, Strikes, Show, the guide, fullscreen and the read are all hidden (ExposureField.tsx:1089, 1093, 1115, and the
   doors are only drawn on the band or desk heads, 1256-1278, 1325-1355). So the panel shows three cards: View, Greek
   and Expiries.
   **For the port:** the owner wants "Calendar and Profile" on the GEX tab. That means Profile has to be added to the
   panel's list and Matrix taken off it. Profile is not just "kept".
2. **Every figure comes from the simulator.** `Simulator.snapshotFor(ticker)` is re-read every 10 s while the GEX tab
   is up (ProfilePanel.tsx:432-438, 455-463). Every one of the 15 expiries is priced through `buildDeskChain`, which
   reads the simulator again (src/data/weigherDesk.ts:183, 188). The spot pill polls the simulator's price every 500 ms
   (src/pages/pinpoint/useRoomSpot.ts:24, 31-34). There is no time axis, no replay and no history: the panel never
   passes `fresh` or `snapshotFor`, so `live` is always true (ExposureField.tsx:1678-1682). All §6 lists every read and
   timer.
3. **Five greeks only: GEX, DEX, VEX, vanna and charm** (src/data/exposureSurface.ts:41-42). Speed, vomma, zomma,
   colour and veta exist in src/data/greekSurfaces.ts and src/core/higherGreeks.ts, but at 1ebc5bb **no file imports
   greekSurfaces.ts**. These views never read them (see §8).
4. **The sign runs the same way as ours; the colours do not.** Calls are negative and puts positive. A positive net
   means put-dominant, so dealers are short gamma and it amplifies (src/core/simulator.ts:839-840;
   src/components/gex/heatmap.ts:72, 80; src/data/exposure.ts:215-225). But Noah paints amplify in `--ember`, which is
   **gold** (245 197 66, src/theme/tokens.css:129), and absorb in `--glacier` blue (src/components/gex/paletteInk.ts:63-64).
   The default palette is **Thermal** (src/data/ledgerPalette.ts:20-25), which is red for amplify and blue for absorb
   (heatmap.ts:70-94). On paper, every mode draws Thermal's deep red and navy (heatmap.ts:496-504).
5. **The figures cannot be ported.** Each one is built on simulator stand-ins: the dealer weights 0.55 and 0.53, a ×40
   on VEX, a jittered put/call split, the same open interest at every expiry, far expiries scaled off the front by a
   ratio, one flat vol per ticker for the front, a fixed 0DTE clock, and a DEX whose "1σ" unit is not what is computed
   (§1). The port can keep the views' layout and interactions, but every number has to come from our field.
6. **Many lines break the house rules.** Sub-11 px type (the panel's fit note is 10.5 px; Noah's dropdown cards go down
   to 8 px). Tracked capitals. Walls in red and green. Red and green verdicts and since-open badges. Row opacity on a
   kept strike. Hex literals. Inter in the profile chart. A hyphen-minus in `fmtUsd`. Walls picked by price's side. The
   flip at the midpoint between strikes. All §7 and §9 list them.

## 1. The data every view reads: `buildExposureSurface` (src/data/exposureSurface.ts)

**How it is called.** `buildExposureSurface(snapshot, WHOLE_BOOK = 30, CALENDAR_DTES)` (ExposureField.tsx:212, 657).

**Shape** (exposureSurface.ts:83-106):
- `strikes` ascending: the front book's window, 61 strikes (±30).
- `expiries` nearest first.
- `put`, `call` and `net` as `[greek][expiry][strike]` in signed dollars.
- `oi[expiry][strike]`.
- `maxAbs[greek]`: the largest |net| anywhere on the surface.
- `king[greek]`: the heaviest single cell.
- `supreme[greek]`: the heaviest strike.
- `levels` and `front`: the 0DTE profile.

**Expiries.** `CALENDAR_DTES = [0,1,2,3,4,7,14,21,28,35,42,49,63,77,91]` calendar-day horizons (exposureSurface.ts:112).
Each is resolved by `expiryFor` to a weekday session (src/core/calendar.ts:146-168), and duplicates are dropped
(exposureSurface.ts:140-142). So every weekday is assumed to list an expiry for every name; this is not a listed
calendar. The `short` label is the asked horizon ("7d"), not the resolved date's distance: line 149 pushes the loop's
`dte`, not `chain.expiry.dte`. Each expiry's `iv` is the at-the-money desk row's two legs averaged
(exposureSurface.ts:147-148).

**Open interest.** Every expiry reads **the same simulator book**: `buildDeskChain` takes `node.callOI` and
`node.putOI` from the one chain whatever the dte (weigherDesk.ts:211-226, 320-323). Strikes outside the book get a
hashed `wingOI` (weigherDesk.ts:213-216). `surface.oi[e][s] = put.oi + call.oi` (exposureSurface.ts:185).

**The front row (e = 0) for GEX, DEX and VEX** is the 0DTE profile, `buildExposureProfile(snapshot, '0DTE', 30)`
(exposureSurface.ts:126; src/data/exposure.ts:101-142). It is built from the simulator chain
(src/core/simulator.ts:803-888):
- t = 0.003 years, fixed (simulator.ts:827).
- One vol, the ticker's `config.iv`, flat across strikes (simulator.ts:812, 829).
- Dealer directions are weights, not ±1: calls −0.55, puts −0.53 (simulator.ts:836-837).

| greek | per leg, as computed | sign of the leg | stated unit (GREEK_UNIT, exposureSurface.ts:47) |
|---|---|---|---|
| GEX | call: `callOI × 100 × Γ × S² × 0.01 × (−0.55)`; put: `putOI × 100 × Γ × S² × 0.01 × (−0.53) × (−1)` (simulator.ts:839-840) | call −, put + | $ per 1% move |
| DEX | call: `callOI × 100 × Δc × S × (−0.55)`; put: `putOI × 100 × Δp × S × (−0.53)` (simulator.ts:844-845) | call −, put + (Δp < 0) | "1σ move", but the front has **no σ in it**: it is dollar delta |
| VEX | `OI × 100 × vega × (−0.55 / −0.53)` (simulator.ts:848-849), then **× 40, "dollar-comparable"** (exposure.ts:130) | **both legs −**, so the VEX net is never positive | "1% vol" (vega is per vol point, src/core/greeks.ts:85-86) |

Each leg then passes through `scaleSplit(put, call, factor = 1, jitter)`
(exposure.ts:74-79, 127-133). It moves up to 0.18 × min(|P|, |C|) between the legs by a hashed jitter, keeping the net.
**So the put and call figures on the cards are not the computed legs.**

**Far expiries (e ≥ 1) for GEX, DEX and VEX** are anchored to the front row (exposureSurface.ts:207-245).
- The desk chain per expiry is priced with `t = max(sessions, 0.5)/252` and a smile IV per contract
  (weigherDesk.ts:187, 230-232).
- Magnitudes (exposureSurface.ts:175-177):
  - g = Γ × oi × 100 × S² × 0.01
  - dx = |Δ| × oi × 100 × S × (iv/100) × √(1/252)
  - v = vega × oi × 100
- value = sign(front leg) × k × desk magnitude at e, where k = |front leg| / desk magnitude at e = 0. That is per strike
  and side, and falls back to the whole-book ratio when the desk twin is near zero.
- So a far cell is the front's synthetic figure × (desk_e / desk_0), and **its sign is always the front leg's**.
- `gamma`, `delta` and `vega` on the desk contract are rounded with `toFixed(4)` (weigherDesk.ts:288-292). My guess,
  not checked: this would matter for high-priced names, where per-contract gamma is under 1e-4.

**Vanna and charm, every expiry including today** (DIRECT, exposureSurface.ts:120, 163, 178-184, 233-235). They are
computed directly from Black-Scholes at `years = max(0.5, sessions)/252` and each leg's own desk IV:

| greek | per leg | sign | unit |
|---|---|---|---|
| VANNA | `vanna_BS × 0.01 × OI × 100 × S × (−0.53 put / −0.55 call)`. vanna_BS = −e^{−qt}·φ(d1)·d2/σ, per 1.00 vol (greeks.ts:92-93) | call and put have the **same** BS vanna, so both legs share a sign at a strike. The sign follows strike against spot, not put against call | "1 vol pt" ($ delta per vol point) |
| CHARM | `charm_BS × OI × 100 × S × (−0.53 / −0.55) / 252`. charm_BS is per year (greeks.ts:95-101) | at q = 0 the two charms are equal (greeks.ts:23-33), so both legs share a sign | "1 day" ($ delta per session day) |

**Levels** come from the front book (exposure.ts:174-197):
- call wall = heaviest strike **above spot** with net < 0.
- put wall = heaviest strike **below spot** with net > 0. This is Noah's side-of-price rule (src/core/walls.ts:71-97),
  not our "walls from the book".
- flip = **midpoint** of the sign-change pair nearest spot (walls.ts:126-145). Ours is the linear zero crossing.
- supreme = argmax |put + call gex| over the full chain.
- pin = strike with the most total open interest in the window.

**Supreme per greek:** for GEX it is the profile's pick; for the others, argmax |net| of the front book; then the date
carrying most of it (exposureSurface.ts:262-288).

## 2. The Matrix (src/components/gex/ExposureMatrix.tsx, 634 lines)

**A row is one strike**, highest first (ExposureMatrix.tsx:177-183). There are `rings` rows each side of the price.
In the panel that is 20, the band's default `LEDGER_REST`, with no Strikes card (ExposureField.tsx:218, 514-516, 1093),
so 40 rows. The split between above and below is the count of strikes at or over **the simulator's price now**, read
through `useRoomSpotRead` (ExposureMatrix.tsx:176). A spot row sits between the halves, with `RoomSpotRule`'s pill
(ExposureMatrix.tsx:615-624).

**Cell value.** It is summed over the expiries drawn: for each greek, Σ over `shownIdx` of put, call and net
(ExposureMatrix.tsx:184-198). In the panel those are the Expiries card's window, by default `{from: 0, through: 2}`,
the three nearest (ExposureField.tsx:327). The window is capped by `EXPIRY_CEILING`, which by greek count is
{1:20, 2:15, 3:10, 4:8, 5:7} (ExposureField.tsx:221, 324, 426-436).

**Columns.**
- Strike: price. 11 px, semibold, flush right; the column is fixed at the widest strike's measured width
  (ExposureMatrix.tsx:409-422, 519-530).
- Then one group per greek picked. The panel's own pick defaults to `['gex']`, is not persisted and is not passed by
  the panel (ExposureField.tsx:308-318; ProfilePanel.tsx:1910 passes no `greeks`).
- In the panel each group is **the net only**: `legsDrawn = panel ? 'net' : …` (ExposureField.tsx:368). Elsewhere it
  can be put · call · net, one leg, or both (ExposureMatrix.tsx:86).
- Head: "GEX · net · 1% move" (ExposureMatrix.tsx:595-596), 11 px, semibold, uppercase, tracking-widest (line 114). The
  unit is in normal case. Under 96 px a column shows the greek alone, with the unit in its title (lines 425-427).
- The lead greek's head is silver when more than one greek is drawn (line 584).

**A cell** (ExposureMatrix.tsx:130-150):
- The figure: `fmtUsd` at 12 px, tabular, bold for the net (line 141). `fmtUsd` prints an ASCII "-" and one decimal of
  K, M or B (src/data/gex.ts:44-51).
- Under it, a 3 px bar on a faint track (track `ink/0.08` dark, `ink/0.1` paper; line 144).
- **Bar length** = |v| / cap, linear, where **cap = the column's heaviest |leg| among the rows shown**
  (ExposureMatrix.tsx:131, 203-207).
- **Bar ink** = `heatLadderColor(v, cap, mode, paper)` (heatmap.ts:658-664). |v|/cap goes through the ramp's gamma curve
  (0.6 house, 0.5 thermal; heatmap.ts:113, 93) into a window of the ramp:

  | mode | amplify window | absorb window |
  |---|---|---|
  | house | 0.6 → 1, fire → gold | 0.5 → 0.75, azure → sky |
  | thermal | 0.4 → 0.75, orange → red | 0.6 → 0.78, blue |

  On paper the window is the paper ink ramp 0.55 → 1, muted grey → the thermal deep pole (heatmap.ts:640-664).
- The ink is chosen by sign alone, for every greek. So a positive VANNA or CHARM wears the "amplify" ink, and VEX is
  always absorb-ink, because it is never positive (§1).
- **Heavy bars**: a column's three heaviest bars are drawn at full opacity, the rest at 0.72 (ExposureMatrix.tsx:145,
  212-217).
- **Row heights** share the box: ⌊(box height − head − spot row) / rows⌋, floor 24 px, no ceiling. The leftover pixels
  are spread down the rows (ExposureMatrix.tsx:94-100, 445-471). **The rows are not tied to any price scale**, so they
  do not line up with the chart's strike rows.
- No level words in the cells (lines 137-140). A level is the strike's ink (§9).

**Hover.**
- A row lights `bg-ink/0.04` and opens `PointerFollowCard`, 224 px wide (CARD_W, line 112), which tracks the pointer.
- It leaves 70 ms after the pointer does (ExposureMatrix.tsx:487-502).
- It calls the host's `onPointer`, but the panel passes no hover handler on to the chart (ProfilePanel.tsx:1910).

**Card** (ExposureMatrix.tsx:301-349):
- Title: the strike, then the level word in its ink (uppercase, tracking-widest, 11 px) and "you".
- Aside: "+0.42% · above spot".
- Rows (CardRow, 11 px, src/components/ui/PointerCard.tsx:66-72):
  - Put (ember ink) with % of the column's heaviest put.
  - Call (glacier ink).
  - "Net · GEX" with put-heavy or call-heavy.
  - Open interest (contracts, summed over the expiries drawn).
- Foot verdict:
  - GEX: net ≥ 0 gives "peak · hedging amplifies a move here" in AMPLIFY, otherwise "well · hedging absorbs a move
    here" in ABSORB.
  - Other greeks: "the put side wins here" or "the call side wins here".
  - **For VEX, vanna and charm that verdict is not what the sign means** (§1).
- The card reads `lead`, the first greek drawn (ExposureField.tsx:601, 1680).

**Click.**
- A click keeps the strike through the host's `onSelectStrike`. The panel wires that to Terrain's focus price, both
  ways (ProfilePanel.tsx:1910).
- The kept row gets `bg-ink/0.05` and an inset 2 px silver bar. **Every other row drops to opacity 0.6**
  (ExposureMatrix.tsx:508). That is row opacity, which our theme rules forbid.
- The kept card stands on its row only while the row is on screen (lines 263-300, 340-342).
- A click off the rows or Esc lets go (lines 233-253).
- Hover still reads other rows while a strike is kept (lines 350-354).

**Keys** (ExposureMatrix.tsx:356-400, 540-557):
- The table is one tab stop.
- ↑, ↓, j and k walk the rows; Home and End jump to the ends; Enter or Space keeps.
- `aria-activedescendant` is set; the walked row wears the 2 px silver ring.
- The walk starts on the kept strike, otherwise just over spot, and only on `:focus-visible`.
- The box scrolls once per ticker to centre the spot row (lines 435-443).

**No sort, no bar scale legend, no time.**

## 3. The Calendar (src/components/gex/ExposureLedger.tsx, 1133 lines; the host passes `leg='net'` in the panel, ExposureField.tsx:1682)

**Axes.**
- **Rows are strikes**, descending, `rings` (20) each side of the simulator's price, with a 28 px spot row
  (ExposureLedger.tsx:133, 373-402). While the pointer is in the grid or a cell is kept, **the strikes drawn are held**
  and only the spot rule moves (lines 361-401).
- **Columns are greek groups × expiry dates.** Within a group, one column per drawn expiry, nearest first
  (lines 987-1024). It is strike × expiry at one moment. **There is no time-of-day axis.**
- Columns are cut to what fits: CELL_MIN_W 48 px, `columnsThatFit = ⌊(paneW − 104)/48⌋`, shared by the greeks.
  The fit is reported up so the Expiries card says "N of M" and the fit note appears (lines 118-128, 340-357;
  ExposureField.tsx:337-345, 1011-1016).

**Head** (lines 978-1024): two 22 px rows (HEAD_H 44, line 134).
- Group head: "GEX · 1% move", 11 px, bold, uppercase, tracking-widest (lines 991-998). On a narrow column only the
  greek is shown (line 487).
- Date heads: "OCT 16 · today" or "· 2d", 11 px, uppercase, tracking-wider, centred (lines 1014-1020). Today's date is
  bold. "· 2d" is dropped when the column is narrow (lines 481-485).
- Strike head: "Strike", 11 px, semibold, uppercase (line 978).

**A cell is one strike × one expiry × one greek: a capsule (`HeatPill`)** (lines 232-272;
src/components/gex/HeatPill.tsx:111-155).
- Value: `surface[leg][g][e][s]`, the net in the panel, rounded to 3 significant figures (q3; lines 184, 1078).
- Fill: `heatCellStyle(v, maxAbs, mode, paper)`, the full ramp from a dark zero (42 42 42) to the pole on the ramp's
  gamma curve (heatmap.ts:553-563). The text ink is `#0a0a0a` or `#ededed` by measured contrast (heatmap.ts:436-439),
  with an rgba halo (HeatPill.tsx:107-108, 135).
- **Scale: `surface.maxAbs[g]`, the heaviest |net| over the whole surface**: all 15 expiries and all 61 strikes, not
  only those drawn (lines 278-290).
- Figure: full `fmtUsd` if the cell is ≥ 71 px; otherwise the short form "−272M", which uses the true minus
  (lines 150-157, 477, 823-827).
- Font size: clamp(min(rowH × 0.46, (cellW − 22)/(8 × 0.68)), 11, 13) px (line 471).
- Row height: max(18, (box h − 44 − 28) / rows) (lines 130, 441, 488-495). The rows fill the box and **are not tied to
  a price scale**.
- Marks:
  - The heaviest cell drawn wears ★ when the column is at least 96 px (lines 426-439, 885).
  - The supreme's cell wears a magenta 1.5 px ring (line 1076).
  - Hover or keep gives a silver ring, with a row and column wash of `silver/0.05` (lines 1032-1033, 1074-1076).
  - The strike label is in its level's ink (§9).

**Since-the-open badge** (lines 748-807, 221-230).
- The same surface is built off `snapshotAtOpen` (src/data/levelview.ts:120-132: the simulator's GEX history at the
  session's first bar, priced at the open's spot), once per name (ExposureField.tsx:808-822). It is matched by strike
  and date.
- The figure is `sinceOpenRead(was/now)` (levelview.ts:162-178).
- Only the 10 biggest moves get a badge, by |now − was| / maxAbs ≥ 0.05, and only building, bleeding, new or flipped.
- The badge is 11 px, in **green when building and red when bleeding** (`--bull` and `--bear`, line 223).
- It is on in the panel. The Biggest-moves focus door is not (ExposureField.tsx:1262, 1682).

**Card** (lines 829-860, 1115-1125).
- Title: the strike.
- Aside: "Oct 16 · today · +0.42%".
- Tags: call wall, put wall, pin, supreme and "★ heaviest cell", in uppercase tracking-widest, 11 px (line 846).
- Rows:
  - Put and Call, each with % of the larger leg.
  - "Net · GEX", inked `heatLaneColor`.
  - Open interest: **the same at every date** (§1).
  - "Since the open".
- Foot verdict: for GEX, inked `SHORT_GAMMA` or `LONG_GAMMA`, which are **red and green** (`--bear` and `--bull`,
  paletteInk.ts:30-31; ExposureLedger.tsx:745). For DEX, `netInk` gives green or red; for the others a literal
  `#EDEDED` (src/components/gex/ExposureReadout.tsx:31-32).

**Interactions.**
- Hover shows the follow card (lines 532-553).
- Clicking a cell keeps it. A second click on the same cell lets go; a click elsewhere on the same row moves the pin
  along the row (lines 560-576).
- Clicking a strike label selects the strike (line 1049).
- A click outside or Esc lets go (lines 624-645).
- Keys: ←, →, ↑, ↓, j and k walk the cells; Home and End go to a row's ends; Enter or Space keeps (lines 652-694).
- No legend in the panel: the legend is drawn on the band only (ExposureField.tsx:1711).

## 4. The Profile (src/components/gex/ExposureProfileView.tsx, 376 lines; src/data/exposureCurve.ts, 124 lines)

**Not offered in Terrain's panel at 1ebc5bb** (§0.1). What it is on the Map:

- **One line = dealer gamma (GEX only) as a function of a hypothetical spot.** It draws the total and one quiet line per
  drawn expiry (exposureCurve.ts:55-105; ExposureProfileView.tsx:121-139). It ignores the greek pick; the Greek card is
  hidden on it (ExposureField.tsx:1083).
- **Price range:** S0 × (1 ± span), where span = clamp(reach, 4%, 15%) and reach is the farther of the book's lowest
  and highest strike from S0, as a fraction. 81 evenly spaced spots (exposureCurve.ts:51-62, 95). S0 = `surface.spot`,
  the snapshot's price.
- **How it reprices:**
  - Each cell (expiry e, strike k) becomes "effective contracts": eff = net GEX figure / (Γ_BS(S0, k, t_e, iv_e) × S0² ×
    100 × 0.01), clamped to ±(put OI + call OI) at that strike (exposureCurve.ts:70-90).
  - At each S: Σ eff × Γ_BS(S, k, t_e, iv_e) × S² × 100 × 0.01 (lines 94-105).
  - **One flat vol per expiry** (the desk's at-the-money iv, the same at every strike and every S). That is neither
    sticky-strike nor sticky-delta.
  - **The clock is held**: t_e = max(0.5, sessions)/252, so 0DTE is 1/504 year all day. The front's figure was priced at
    0.003 years and the ticker's flat vol (§1), so for today's cells the curve's own Γ is a different one from the Γ
    that made the figure.
  - The open interest is held. The sign is the cell's own, so the 0.55 and 0.53 weights ride along.
- **Zero crossing:** the total's crossing nearest S0, linearly interpolated between two of the 81 points
  (exposureCurve.ts:107-120). It is drawn as "ZERO GAMMA 471.23", dashed, in the flip ink (ExposureProfileView.tsx:214).
- **Lines** (lightweight-charts 5.2 `createOptionsChart`, price on the foot; lines 101-139):
  - The total is a `BaselineSeries` at 0, 2 px. Above zero is AMPLIFY (ember, gold in Noah's) with a 0.26/0.03 fill
    (0.2 on paper); below is ABSORB (glacier) (lines 117-136).
  - A dotted zero price line (line 137).
  - Each expiry is a 1 px line in `--text-muted` at 0.55 (lines 138-139).
  - The y scale is symmetric, ±maxAbs (line 135). Scroll and scale are off (lines 114-115).
- **Rules over the plot** (lines 207-216, 308-333): PUT WALL (`--bear` red), CALL WALL (`--bull` green), SUPREME
  (magenta), ZERO GAMMA (flip grey, dashed), SPOT (silver, the simulator's price polled every 500 ms, line 75), and
  KEPT (silver, dashed).
  - Tags: 11 px, bold, upper-case words, stacked on rows so they do not overlap.
  - "amplifies" and "absorbs" are 11 px in their inks.
  - The two heaviest expiries are named at their right ends.
- **Hover card** (lines 336-365): 220 px, 11 px, `rgba(8,8,10,0.88)` glass, `data-theme="dark"`. It shows "at 471.20",
  ±% from spot, Total with amplifies or absorbs, each date's figure, and "click to keep 471".
- **Click** keeps the nearest strike.
- **Keys:** ← and → walk the 81 points, Home and End, Enter or Space keeps, Esc clears (lines 245-258).
- **Foot line**, 11 px: "Dealer gamma re-priced across spot · …" by width (lines 369-371).
- **Type:** the chart's ticks are **10 px Inter** (line 104). That is allowed by the approved scale's tick size, but the
  face must be ours.

## 5. The host in panel mode (ExposureField.tsx with `toolbar="panel"`, ProfilePanel.tsx:1906-1912)

- **Head:** View, Greek and Expiries, bare, portalled into ProfilePanel's head row (ExposureField.tsx:1078-1092,
  1301-1313; ProfilePanel.tsx:439-452, the slot at 442).
  - Greek is a multi pick: "All five", GEX, DEX, VEX, VANNA, CHARM (src/components/gex/exposureView.ts:24-31).
  - Expiries is `ExpiryRangeCard`: From and Through with shortcuts "Today only", "This week" and "Next N"; its trigger
    reads like "Today → Oct 19 · 4 of 7" (ExposureField.tsx:1004-1009, 1092).
  - The fit note "Only N of M expiries fit — widen the panel or pick fewer." is **10.5 px** (ExposureField.tsx:1309,
    1319).
- **Hidden in the panel:** Legs (net only), Strikes (fixed at 20), Show (after the close), the Supreme door, The read,
  the guide, fullscreen, ColumnFacts and the legend (ExposureField.tsx:1089, 1093, 1115, 1256-1278, 1662, 1711).
- **The panel passes** `selectedStrike = focusPrice` and `onSelectStrike = onSelect`. It passes no `hoverStrike`,
  `onHoverStrike`, `greeks`, `fresh` or `snapshotFor` (ProfilePanel.tsx:1910).
- **View changes are a cut**: SWAP_OUT_MS 0 (ExposureField.tsx:232, 517-544). Palette changes run HeatPill's 700 ms
  colour transition (HeatPill.tsx:136).

## 6. Every read of the simulator, and every timer

| where | what | cadence |
|---|---|---|
| ProfilePanel.tsx:432-438 | `setInterval(…, 10_000)` bumps `gexTick` while the GEX tab is up | 10 s |
| ProfilePanel.tsx:455-463 | `Simulator.snapshotFor(ticker)`, the whole snapshot for the field | on each tick and on a ticker change |
| ExposureField.tsx:651-660 | rebuilds the surface if spot moved ≥ 0.1% or ≥ 6 s passed, so in practice every 10 s tick | per snapshot |
| weigherDesk.ts:183, 188; called 15× per build from exposureSurface.ts:139 | `Simulator.snapshotFor(ticker)` again per expiry (`pricedOff 'live'`), and `Simulator.TICKERS[…].iv` | per build |
| src/data/gex.ts:406-409 | `spotChangePct` reads `Simulator.TICKERS` | per build |
| useRoomSpot.ts:24, 31-34, 52-55 | `setInterval(poll, 500)` reads `Simulator.TICKERS[t].currentPrice`, for the matrix's and calendar's row split, the spot pill, and the profile's SPOT rule | 500 ms |
| levelview.ts:120-132 via ExposureField.tsx:808-822 | `snapshotAtOpen`: `Simulator.getGexHistory`, `snapshotFor` and `chainWithBook`; builds the open's surface, cached per name | once per name per session |
| ExposureMatrix.tsx:497, ExposureLedger.tsx:542 | 70 ms leave timers for the hover card | per hover |
| weigherDesk.ts:215, 244 | `dayKey()`-hashed wing open interest and volumes | per build |

**Replay:** none. With no `fresh` passed, `live` is true, so the spot pill and row split read the live simulator even
while Terrain's chart replays (ExposureField.tsx:1678-1682; RoomSpotRule.tsx:17-20).

## 7. Type sizes (11 px is the floor; ticks may be 10)

| element | size | file:line | flag |
|---|---|---|---|
| matrix figure | 12 px | ExposureMatrix.tsx:141 | ok |
| matrix strike, head | 11 px, head upper-case tracking-widest | ExposureMatrix.tsx:114, 519 | **tracked caps** |
| matrix card | 11 px; tags upper-case tracking-widest | PointerCard.tsx:109-115; ExposureMatrix.tsx:314, 319, 341 | **tracked caps** |
| calendar capsule figure | 11–13 px (clamp) | ExposureLedger.tsx:471 | ok |
| calendar heads | 11 px upper-case tracking-widest/wider | ExposureLedger.tsx:978, 991, 1014 | **tracked caps** |
| since badge | 11 px | ExposureLedger.tsx:227 | ok |
| spot pill and ticker | 11 px; ticker upper-case tracking-wider | src/components/ui/SpotRule.tsx:28-29 | **tracked caps** |
| profile tags, words, card | 11 px; tags in capitals ("PUT WALL 470") | ExposureProfileView.tsx:211-216, 314, 321-338 | **capitals** |
| profile chart ticks | 10 px, Inter | ExposureProfileView.tsx:104 | tick size ok; face must be ours |
| panel fit note | **10.5 px** | ExposureField.tsx:1309, 1319 | **under 11** |
| Noah's DropdownSelect, DropdownMulti, ExpiryRangeCard labels and hints | **8–10 px**, upper-case tracking-widest | src/components/ui/ExpiryRangeCard.tsx:149, 161, 176, 200, 233, 247; src/components/ui/DropdownSelect.tsx:125, 137, 165; src/components/ui/DropdownMulti.tsx:91, 98, 105 | **under 11**: use our house components instead |
| "Waiting for the first tick", "No curve…" | 11 px upper-case tracking-widest | ExposureField.tsx:976; ExposureProfileView.tsx:366 | **tracked caps** |

No clock time is printed in any of the three views; dates only ("Oct 16", exposureSurface.ts:149). The "since the open"
words carry no time.

## 8. The five modules the brief named: not read by these views

My import walk (scratchpad tools/closure.mjs) followed the relative imports from ExposureField, ExposureMatrix,
ExposureLedger, ExposureProfileView, exposureSurface and exposureCurve. The data and core files it reaches are:
calendar, carry, clock, glide, greeks, journal, nyTime, rng, simulator, walls (core), and airPockets, compass,
deskPrefs, exposure, exposureCurve, exposureSurface, gex, levelview, universe, weigherDesk (data). **None of
greekSurfaces, gexSeries, exposureCompare, optionChain or higherGreeks is reached.**

- **src/data/greekSurfaces.ts:** colour, vomma, speed, veta and zomma by strike, through `exposureAt`
  (higherGreeks.ts:181-185, OI × 100 × greek × callSign). **No file imports it** (grep of src/ and scripts/).
- **src/core/higherGreeks.ts:** raw partials of zomma, speed, vomma, colour and veta, per 1.00 and per year
  (lines 106-144). Imported only by greekSurfaces.ts and src/data/stability.ts.
- **src/data/gexSeries.ts:** net GEX through time off `Simulator.getGexHistory`. Imported as a type only, by
  src/components/gex/vannacharm/NetGexDrift.tsx:6.
- **src/data/exposureCompare.ts** (two-ticker compare by % from spot) and **src/data/optionChain.ts** (a per-expiry BS
  chain): **imported by no file**.

## 9. Colours and conventions Noah uses that our rules replace

- **Strike ink** (src/components/gex/strikeRole.ts:28-50): supreme magenta, **call wall `--bull` green, put wall
  `--bear` red**, flip grey, pin dotted underline, owned silver underline. Ours: the walls wear the gamma pair, gold
  absorb and violet amplify, with bull and bear for direction only.
- **Amplify and absorb** (paletteInk.ts:63-64): amplify is ember, which is gold; absorb is glacier. Ours: gold absorbs,
  violet amplifies, or the colour-vision pair.
- **Thermal** (heatmap.ts:70-94): RdYlBu, with red for amplify.
- **Verdicts and badges in red and green:** the calendar's GEX verdict (`SHORT_GAMMA`/`LONG_GAMMA`), the since-open
  badge, and `netInk` for DEX (ExposureLedger.tsx:223, 745; ExposureReadout.tsx:31-32).
- **Hex and rgba literals:** capsule inks `#0a0a0a` and `#ededed` (heatmap.ts:436-437); the ramps' RGB stops; the halo
  rgba (HeatPill.tsx:107-108); the profile glass `rgba(8,8,10,0.88)` (ExposureProfileView.tsx:339); `#EDEDED`
  (ExposureReadout.tsx:32); the calendar scrim `rgba(10,10,10,0.66)` (ExposureLedger.tsx:926).
- **`fmtUsd`** prints a hyphen-minus (gex.ts:45). Strikes and spot use their own `toFixed` (ExposureMatrix.tsx:113;
  ExposureProfileView.tsx:43, 215). Ours: every figure goes through core/format.
- **Walls by price's side and the flip at a midpoint** (walls.ts:71-145). Ours: walls from the book, with broken and
  reclaimed states, and the flip at the linear zero crossing.
- **Row opacity on a kept strike** (ExposureMatrix.tsx:508). Our theme rules say quiet rows recede by text tier, never
  by row opacity.
- **The dealer weights 0.55 and 0.53, the VEX × 40 and the jittered leg split** are simulator stand-ins with no
  counterpart in the field. Ours: OI × greek × price², the house sign, no weights.

## 10. What each matrix greek needs, if computed honestly (inputs only; our model not checked here)

Per contract, at the minute, with our model's clock and carry (UW's convention), that contract's vol, and the count
of open interest as received:

| greek | per contract | summed |
|---|---|---|
| GEX | Γ | OI × 100 × Γ × S² × 0.01 ($ per 1% move). This is what the field already carries, net and gross per strike |
| DEX | Δ | OI × 100 × Δ × S ($ delta). Noah's "1σ" label is not computed, so either say "$ delta" or add σ explicitly |
| VEX | vega per vol point | OI × 100 × vega ($ per vol point). No × 40 |
| VANNA | ∂Δ/∂σ × 0.01 | OI × 100 × vanna × 0.01 × S ($ delta per vol point) |
| CHARM | −∂Δ/∂τ, per year ÷ 365 on UW's calendar clock (Noah ÷ 252) | OI × 100 × charm × S ($ delta per day) |

For the meaning words: amplify and absorb belong to gamma. For delta, vanna, charm and vega the net's sign is not "the
put side wins" (§2), so the port needs its own words or none.
