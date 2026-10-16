# Panel port: the rules and the look, mapped (Noah's 1ebc5bb to Terrain at caebf7e)

Read-only notes. Nothing in /home/user/3abida was changed.

**Sources.** Noah's panel is /home/user/revamp at 1ebc5bb: `src/components/gex/ProfilePanel.tsx`, `ExposureMatrix.tsx`
and `ExposureField.tsx`. Because the GEX tab keeps Calendar and Profile, these files were read too: `ExposureLedger.tsx`
(the Calendar), `ExposureProfileView.tsx` (the Profile), `HeatPill.tsx`, `RoomSpotRule.tsx`, `strikeRole.ts`,
`ledgerView.ts`, `paletteInk.ts`, `palette.ts`, `heatmap.ts` and `ui/FilterTabs.tsx`, `ui/SpotRule.tsx` and
`ui/PointerCard.tsx`.

The owner's code is /home/user/3abida at HEAD caebf7e. Paths below are repo-relative. A path with no prefix is the
owner's. "revamp " in front of a path means Noah's.

**Line numbers.** The owner's line numbers are those at HEAD. Another workflow is editing Terrain.tsx: within minutes,
the Colours card read at 4511 in the working tree and 4508 at HEAD. Re-grep before you edit.

---

## Four facts that drive the whole mapping

1. **Both codebases use the same sign.** In both, a positive net means the puts lead and hedging amplifies a move. A
   negative net means the calls lead and hedging absorbs one. Evidence:
   - Noah: revamp heatmap.ts:71, :111 and :152 ("positive = put-dominant … AMPLIFY"); revamp ProfilePanel.tsx:1187
     ("positive is put-dominant").
   - The owner: heatmap.ts:61–64 and :106; gexNodesPrimitive.ts:127, where `side > 0` takes the put ink.

   So the port keeps every sign test as it is and changes only the inks. **Port by meaning, never by ink name.**

2. **Noah's gold means the opposite of the owner's gold.**
   - Noah's house ramp is `ember-glacier` (revamp heatmap.ts:37, stops at :106–136). The puts climb through oxblood and
     rust to honey gold `#F5C542`. The calls run from navy to ice.
   - His `AMPLIFY = EMBER` and `ABSORB = GLACIER` (revamp paletteInk.ts). His walls are green `#30D158` and red
     `#FF3B30` (revamp palette.ts).
   - The owner's `HEAT_MODE` is `gold-violet` (heatmap.ts:41, stops at :65–90). Violet (`--amplify`) is the puts'
     side and gold (`--absorb`) is the calls' side (tokens.css:143–144).
   - **Trap:** the owner's paletteInk.ts still exports `EMBER` and `GLACIER` (lines 44–45). `--ember` is the gold
     245 197 66 (tokens.css:134). If any line of Noah's that imports `EMBER` for the puts (ExposureMatrix.tsx:92,
     ExposureLedger.tsx:115) compiles unchanged against the owner's modules, it paints the puts gold. That is the
     opposite of the ovals. The port imports `AMPLIFY` and `ABSORB` only. It never imports `EMBER` or `GLACIER`.

3. **The chart's ovals take one set of inks, whatever Terrain's Colours card says.**
   - The ovals call `darkMarkInks()` (gexNodesPrimitive.ts:120–126) on a dark tape and `trailPaperFrom(el)` (:251) on
     a light tape. Both read `HEAT_MODE` gold-violet.
   - Both follow the colour-vision choice in Settings › Appearance through `cvdGoldViolet` (heatmap.ts:517).
   - The desk's Colours card (Terrain.tsx:4508, House or Thermal) reaches only the ladder (Terrain.tsx:3492) and the
     guide (Terrain.tsx:3551). The ovals never read it.

   "A strike reads the same on the panel and the chart" therefore means: **the panel reads the same function the ovals
   read.** It does not read a fresh lookup of the tokens. One case shows why. Under `high-contrast`, `--text-muted`
   becomes 180 (tokens.css:384), but the ovals' balanced grey stays the literal 125 (`NEUTRAL_RGB`,
   gexNodesPrimitive.ts:41).

4. **Approval 2's type tokens do not exist yet.** `--fs-tick`, `--fs-label`, `--fs-body`, `--fs-strong`, `--fs-head`
   and `--fs-display` have 0 hits in src/, tailwind.config.ts and scripts/ at caebf7e. The scale is written only in
   docs/terrain-audit-2026-10-15/README.md §6f.
   - The port lands them as part of applying approval 2 to the new panel.
   - A canvas cannot read a CSS size, so it needs a TS mirror of the six tokens. theme/fonts.ts is the precedent: it
     mirrors `--font-sans` for canvases.

---

## (a) Colour mapping

How to read the table:
- **"inks"** means the oval renderer's own object: `darkMarkInks()` on a dark ground and `trailPaperFrom(box)` on
  paper, giving `{ put, call, neutral }`.
- **"markInk"** is gexNodesPrimitive.ts:127. It returns the side's ink, or `neutral` where |net| ÷ gross is under
  `BALANCED_BELOW` (0.2, gexNodesPrimitive.ts:111).
- On paper, every ink is read off the panel's own box. The pane carries `data-chart-frame`.

| # | Noah's ink (where) | What it means in Noah's | The owner's ink / reader | Note |
|---|---|---|---|---|
| A1 | Ramp `ember-glacier` (revamp heatmap.ts:37, :106–136), chosen by `modeOf('house')` (revamp ProfilePanel.tsx:129), ExposureMatrix.tsx:153 and ExposureLedger.tsx:275 | Puts climb red to gold; calls climb navy to ice | `HEAT_MODE` `gold-violet` (heatmap.ts:41, :65–90). Puts get violet `--amplify`, calls get gold `--absorb`. Colour vision through `cvdGoldViolet` (heatmap.ts:517) | The sign carries over unchanged (fact 1). Never import Noah's heatmap.ts. |
| A2 | Thermal `thermal-yellow`: `PALETTE_OPTIONS` and `modeOf` (revamp ProfilePanel.tsx:125–129); the `palette` prop on ExposureMatrix and ExposureLedger; `THERMAL_WARM` and `THERMAL_COOL` in the band legend (ExposureField.tsx:1714, :1718); `useLedgerPalette` (ExposureField.tsx:354, data/ledgerPalette.ts, default "thermal") | Pale yellow at balance, deep red where hedging amplifies, deep blue where it absorbs | **Not ported.** The panel has no `palette` prop and no ColoursSwitch, and does not use ledgerPalette | The deep reds `#A50026` and `#D73027` are what the owner ruled out. See Q1 for the desk's own card. |
| A3 | Put side: `PUT_INK = EMBER` (ExposureMatrix.tsx:92), `'rgb(var(--ember))'` (ExposureLedger.tsx:115), `PUT_SIDE` (revamp palette.ts) | The puts' leg | DOM: `AMPLIFY` = `rgb(var(--amplify))` (paletteInk.ts:50). Canvas: `inks.put` | The `EMBER` trap (fact 2). |
| A4 | Call side: `CALL_INK = GLACIER` (ExposureMatrix.tsx:93), `'rgb(var(--glacier))'` (ExposureLedger.tsx:116) | The calls' leg | DOM: `ABSORB` = `rgb(var(--absorb))` (paletteInk.ts:49). Canvas: `inks.call` | `--glacier` is blue in the owner's code (tokens.css:135). Never import it. |
| A5 | `AMPLIFY` and `ABSORB` by name: matrix verdict (ExposureMatrix.tsx:330); Profile baseline (ExposureProfileView.tsx:117–118); side words (:321, :325); card total (:353) | Amplify and absorb | `AMPLIFY` and `ABSORB` by the same names (paletteInk.ts:49–50). The canvas or chart option resolves them with `resolveInk(…, host)` | Safe by name: the meaning is kept and the inks become violet and gold. |
| A6 | Walls in green and red: `CALL_WALL` and `PUT_WALL` in `DARK_INKS` (revamp ProfilePanel.tsx:264–265); light set `t('--bull')` and `t('--bear')` (:299–300); `readRole` (:1555–1564); strikeRole (revamp strikeRole.ts:38–42); `tagFor` (ExposureMatrix.tsx:220); Profile rules (ExposureProfileView.tsx:211–212); band legend `bg-bull` "call wall" and `bg-bear` "put wall" (ExposureField.tsx:1726–1730) | The call wall and the put wall | `CALL_WALL` `#E8B94A` or `rgb(var(--absorb))`; `PUT_WALL` `#8064F7` or `rgb(var(--amplify))` (palette.ts:28–29, paletteInk.ts:29–30). Dark canvas under colour vision: `darkInksFor` (ProfilePanel.tsx:294–301). Paper: `t('--absorb')` and `t('--amplify')` (ProfilePanel.tsx:313–314) | A wall is never green or red. Bull and bear mean direction only. |
| A7 | Supreme magenta `#EA00FF` or `--supreme` (both repos). Used for the row wash at 0.13 dark and 0.09 paper (revamp ProfilePanel.tsx:267), the key swatch (:855–857), the strike label, the calendar's supreme cell ring (ExposureLedger.tsx:1076) and the Profile rule (ExposureProfileView.tsx:213) | The supreme | Same token (palette.ts:39, paletteInk.ts:32, tokens.css:166) | Only on the supreme's own row, cell or rule. Never on a leg, a bar or a capsule fill. |
| A8 | Flip `#9CA3AF` (revamp ProfilePanel.tsx:268–269) | The flip | `--flip` (tokens.css:164, the same value). Paper caption in `--text-muted` (Noah's own light rule) | Same value. |
| A9 | Silver `#C7D3E8` literal (revamp ProfilePanel.tsx:134); `rgba(199,211,232,0.7)` (ExposureLedger.tsx:1051) | Focus and kept strike | `--silver` (tokens.css:182; paper 58 79 122). The kept and walked rings already use the token (ExposureMatrix.tsx:509) | |
| A10 | Words `#ededed`, `#a3a3a3` and `#7d7d7d` (revamp ProfilePanel.tsx:135–137) | Three text tiers | `--text-primary`, `--text-secondary` and `--text-muted` (tokens.css:75–77, equal on dark) | Reading the tokens on dark too picks up high-contrast's tiers (tokens.css:382–387). The owner's `DARK_INKS` has the same gap today. |
| A11 | White washes `rgba(255,255,255,a)` for hoverWash, headRule, colGround, divider, edge, grid, silFill and silStroke (revamp ProfilePanel.tsx:270–281) | Hairlines and washes | `rgb(var(--ink) / a)` through `readToken('--ink', a, box)` (tokens.css:95) | Theme rule: a white wash is `--ink` at an alpha. Noah's own light set already does this, with its own alphas. |
| A12 | `rgba(237,237,237,a)` for spotRule, spine, ghost and keyGhost (:276–279) | Neutral lines | `--text-primary` at the same alpha | |
| A13 | Vol underlay `rgba(226,234,244,a)` and volText (:282–283) | Traded volume, which carries no dealer meaning | `--silver` at the alpha, as Noah's light set does (:327–330) | The dark steel moves from 226 234 244 to 199 211 232; no token holds the first. |
| A14 | `'#0a0a0a'` for chipGround and spotChipText; `markFill` `'#0e0e0f'` (:284–287) | Chip grounds | `--panel` (tokens.css:61). The spot chip is filled with `--text-primary` and takes `--panel` for its words (theme rule) | |
| A15 | Ladder legs as a per-side gradient from the ramp's neutral 42 42 42 to the strength `s` (`leg()`, revamp ProfilePanel.tsx:1209–1226). On paper Noah uses `heatPaperLeg` (revamp heatmap.ts:517), which the owner's code does not have | Amount by colour and length | **One solid fill per side:** the put leg in `inks.put`, the call leg in `inks.call`. Length carries the amount | The orbs rule: "TWO STATES, NO GRADIENT". A leg is one side alone, so it is never grey. |
| A16 | Net figure and dash ink `sideInk` = `ramp(sign, 0.8)` (revamp ProfilePanel.tsx:1090–1093) | The side | `markInk(sign, \|net\| ÷ gross, inks)`. Gross is \|put\| + \|call\| of the same greek, window and minute | The ovals' exact rule, so the row and the oval at that strike, in the same column, wear one ink. |
| A17 | Matrix bar `heatLadderColor(value, cap, mode, paper)` (ExposureMatrix.tsx:132). The three heaviest bars at opacity 1 and the rest at 0.72 (:145, `heavyBy` at :212) | Side and amount | `markInk` per greek, using that greek's put and call as gross, at full opacity | Unmeasured but likely: the paper gold (158 114 0, about 4.3:1 on white by calculation) at 0.72 falls under 3:1 for a graphic. See Q4. |
| A18 | Calendar capsule fill `heatCellStyle(v, max, mode, paper)` (HeatPill; mode at ExposureLedger.tsx:275). Ink by contrast, plus text halos (revamp HeatPill.tsx:130; the owner has the same halos at HeatPill.tsx:95–96) | Amount by colour | The owner's `heatCellStyle(v, max, HEAT_MODE, paper)` (heatmap.ts:573), ink by `inkFor` (heatmap.ts:488) | **Decision (Q2).** The ramp's dark-grey low end reads like the ovals' "balanced" grey but means "small". |
| A19 | Flow lane capsules `heat(±mag, onMax)` (revamp ProfilePanel.tsx:1316), plus the named capsules' fill and figure ink | Speeds a move or slows it | The side's pole: speeds it is `inks.put` (violet), slows it is `inks.call` (gold). Figure ink by `inkFor`. Silhouette as in A11 | Not certain the flow lane must be two-state. The pole is recommended so the panel stays consistent. |
| A20 | Read line and card swatch dots `thermal(value, max).fill` (revamp ProfilePanel.tsx:1643, :1708) | The net's side | `markInk`, as in A16. The flow dot as in A19 | |
| A21 | The key under the head: gradient swatches `legRamp` from 0.15 to 0.9 (revamp ProfilePanel.tsx:810–818) | What the colours mean | Solid swatches in the renderer's own inks: `beadLegend.inks` from gexNodesPrimitive.ts:1468–1477, drawn the way `LegendSwatch` is (Terrain.tsx:59–61). The house legend words: "gold = absorb · violet = amplify · grey = balanced" (Terrain.tsx:3366–3368) | The same swatches as the chart's legend. |
| A22 | Mirror: a leg leaving the view drawn in `rgba(legRamp(sign, 0.5), 0.6)` (revamp ProfilePanel.tsx:1473–1505) | A strike leaving | The side's pole at 0.6 alpha | |
| A23 | The palette glide (revamp ProfilePanel.tsx:582–614, :675–702) | Thermal and House blending | **Removed** with the switch | |
| A24 | Δ from spot: canvas `'rgb(var(--bull))'` and `'rgb(var(--bear))'` (revamp ProfilePanel.tsx:1411). A canvas does not resolve `var()`, so Noah's never drew the direction ink. Card and read line use `text-bull` and `text-bear` (:1611, :1684) | Direction | Resolved direction inks: `ink.bull` and `ink.bear` (ProfilePanel.tsx:227–228, through `darkInksFor` and `lightInks`). DOM figures carry `data-dir`. On canvas, ▲ or ▼ is drawn before the figure under any `data-cvd` | The owner's canvas Δ draws no ▲ or ▼ today (ProfilePanel.tsx:1468–1481). See Q3 for tokens against candle inks. |
| A25 | Since-the-open ink `sinceInk` in bull and bear (ExposureLedger.tsx:224); card since (revamp ProfilePanel.tsx:1655) | Direction of a change | As A24 | |
| A26 | Bespoke card: `bg-card/95` with a `rgba(0,0,0,0.5)` shadow (revamp ProfilePanel.tsx:1603). Profile glass `rgba(8,8,10,0.88)` with `data-theme="dark"` (ExposureProfileView.tsx:339) | Hover cards | The house `PointerCard` (ui/PointerCard.tsx) and the house dark glass `[data-chart-glass]` (index.css:1202–1209) | |
| A27 | Holo foil on the active tab: `holo-bg` or `galaxy-bg` with `text-[#0a0a0a]` (revamp ui/FilterTabs.tsx:48–54). The spot pill in holo (revamp ui/SpotRule.tsx:29) | The selected tab and the price | The owner's `FilterTabs`: a `bg-textPrimary` pill with `text-panel` (FilterTabs.tsx:38, :43). The owner's `SpotRule`: `bg-textPrimary` with `text-panel` (SpotRule.tsx:17) | Brand rule: the moving silver is only in the S, the live dot and "Launch terminal". |
| A28 | Pin in `--text-secondary` (revamp ProfilePanel.tsx:1563; `levelOf` pin at :1065) | Gamma pin | **Dropped.** The owner's pin paths were deleted under approval 3 (audit README §6i; §6k #3, commit 40b297e) | |
| A29 | `opacity-60` on every other row while one is kept (ExposureMatrix.tsx:508) | Focus on the kept row | Drop a text tier instead | Theme rule: "Quiet rows recede by dropping a text tier, never by row opacity". |

**What replaces Noah's House/Thermal switch.**
- Nothing on the panel. The panel takes the oval renderer's inks: `darkMarkInks()` or `trailPaperFrom()`, and the
  legend's `beadLegend.inks`, so its swatches are the chart legend's swatches.
- Those inks already follow Settings › Appearance › colour vision. That covers `blue-orange`, where `--absorb` is
  250 222 110 and `--amplify` 150 78 230 on dark (tokens.css:362–363), and 100 110 10 and 136 52 224 on paper (:371–372).
- Noah's `PALETTE_OPTIONS` (revamp ProfilePanel.tsx:125), his band's ColoursSwitch and his `useLedgerPalette` are not
  ported.
- The owner's own desk card "Colours" (Terrain.tsx:4508, options `PALETTE_OPTIONS` at ProfilePanel.tsx:124) is
  question Q1.

---

## (b) Type mapping

**The approved scale** (audit README §6f, approval 2; not yet in tokens.css):

| Token | Size / line | For |
|---|---|---|
| `--fs-tick` | 10 / 12 | Chart axis ticks only |
| `--fs-label` | 11 / 16 | Every label, chip, menu row, table figure and canvas word. This is the floor. |
| `--fs-body` | 12 / 16 | Card body text |
| `--fs-strong` | 13 / 20 | The price; a card's lead figure |
| `--fs-head` | 15 / 20 | Card and panel heads |
| `--fs-display` | 20 / 24 | The expanded pane's price |

The rest of the approved scale:
- **Weights:** 400 regular, 500 for a role word, 600 for heads and the active state. 700 goes.
- **Case:** sentence case, no tracking.
- **Spacing:** a 4 px grid.
- **Control heights:** 16, 20, 24 and 32.
- **Icons:** 12 px in a row; 16 px in a menu or a 32 px button.

| Noah's site | Now | Maps to |
|---|---|---|
| Key words (revamp ProfilePanel.tsx:823) | 500 8.5 px | `label` 11, 400 ("supreme" stays 500, a role word) |
| Column heads `NET GAMMA`, `◂ PUTS · CALLS ▸`, `STRIKE`, `Δ SPOT`, `A MOVE FORCES` (:864, :874; words at :870–888) | 600 7.5 px caps | `label` 11, 600, sentence case |
| `'puts · calls'` (:872) | 400 7.5 px | `label` 11, 400 |
| VPOC (:962) | 7 px | `label` 11, 400 |
| Flip caption (:1001) | 9 px | `label` 11, 400 |
| Figure inside a capsule (:1048); falls to 8 px under 13 px rows (:1050) | 600 9 to 8 px | `label` 11, 600 on a filled capsule (the HeatPill legibility precedent), never under 11. Where the row cannot hold 11 px, the card carries the figure. |
| Level chips (:1075, :1439) | 500 10 px | `label` 11, 500 |
| `NAME_FONT` level names (:1079) | 500 9 px | `label` 11, 500 |
| Flow figures (:1081, :1349) | 600 9 px | `label` 11, 400 (600 on a filled capsule) |
| Net figure (:1108, :1152) | 700 9 or 10 px | `label` 11, 600, the row's lead figure |
| Leg figures past the tips (:1241) | 500 9 px | `label` 11, 400 |
| Strike (:1394) | 700 10 px wide, 400 10 px thin | `label` 11, 600 wide and 400 thin |
| Net role tags `CW`, `PW`, `SUP ★` (:1404) | 700 7.5 px | `label` 11, 500 |
| Δ from spot (:1410) | 9 px | `label` 11, 400 |
| ▲ and ▼ culled counts (:1418) | 9 px | `label` 11, 400 |
| Spot chip (:1468) | 700 10 px | `label` 11, 600. It is an inline chip 16 px tall, and `strong` (13 on a 20 line) does not sit in it. |
| Card title (:1607) | 12 bold | `strong` 13, 600 |
| Card figures (:1611, :1634, :1642, :1650, :1655) | 10 px | `label` 11, 400 |
| Card role word (:1616, :1679) | 10 medium | `label` 11, 500 |
| Card heads `Puts`, `Calls`, `Net`, `Open int`, `Since open` (:1630, :1641, :1649, :1653) | 8 px caps, tracked widest | `label` 11, 400, sentence case, no tracking |
| Card subs and the kept line (:1646, :1658, :1662) | 9 px | `label` 11 |
| Read line (:1672); its strike (:1677) | 10.5; 11 bold | `label` 11; the strike `label` 11, 600 |
| Guide door (:1761) | 10 px | `label` 11, through `GuideDoor` |
| Vol switch (:1782) | 9 bold caps, tracked widest | `label` 11, 400, and 600 when on (`Chip`'s active weight) |
| Lane heads (:1876, :1884) | 10 px | `label` 11 |
| View tabs, `FilterTabs` `text-xs` (FilterTabs.tsx:33) | 12, 500 or 600 | `body` 12 is on the scale. Keep the house tab as it is. |
| Matrix heads (ExposureMatrix.tsx:114, the `head` constant; :570) | 11, 600, caps, tracked widest | `label` 11, 600, sentence case |
| Matrix cell figure (ExposureMatrix.tsx:140) | 12 bold for net, 12 medium for legs | `label` 11 (a table figure); 600 for net, 400 for legs |
| Matrix card tags (ExposureMatrix.tsx:314, :319) | 11 caps, tracked widest | `label` 11, 500, sentence case |
| Matrix kept line (ExposureMatrix.tsx:341) | 11 caps, tracked wider | `label` 11, 400 |
| Matrix strike (ExposureMatrix.tsx:519); unit (:596) | 11 600; 11 500 | `label` 11 600; `label` 11 400 |
| Waiting and reading states (ExposureField.tsx:976, :1545) | 11 caps, tracked widest | `label` 11, sentence case |
| Fit note (ExposureField.tsx:1309, :1319) | 10.5 px | `label` 11 |
| Calendar capsule figure (ExposureLedger.tsx:471, `clamp(…, 11, 13)`, bold) | 11 to 13, 700 | 11, 12 or 13 snapped to the scale's steps, 600 |
| Calendar heads, tags and dates (ExposureLedger.tsx:846, :858, :978, :991, :1014) | 11 caps, tracked wider or widest | `label` 11, sentence case ("Oct 16 · today"). The greek head (:991) also loses `truncate` (never cut). |
| Profile chart axis (ExposureProfileView.tsx:104) | 10 px, `'Inter'` | `tick` 10 (the one allowed 10) in `FONT_SANS`. Inter is only for the landing's display words. |
| Profile rule tags (ExposureProfileView.tsx:314) | 11 bold caps | `label` 11, 600, sentence case |
| Profile words, card and caption (ExposureProfileView.tsx:321–370) | 11 | `label` 11 |
| The owner's `Term` tooltip head (Term.tsx:100) | 11 caps, tracked wider | `label` 11, sentence case. Approval 2 sweeps the components Terrain draws. |

**Spacing constants that move with the 11 px floor:**

| Constant | Noah's | New |
|---|---|---|
| `HEAD_TOP` (revamp ProfilePanel.tsx:140) | 30 | 32, the header row |
| `HEAD_TOP_2` (:150) | 56 | 56 (32 + 24). With approval 17, measure the head; never use a constant. |
| `KEY_BAND` (:153) | 16 | 16, unchanged |
| `COL_HEAD` (:156) | 13 | 16. The owner's is 15. |
| `FOOT_BAND` (:158) | 14 | 16 |
| The owner's `COUNT_BAND` | 13 | 16 |
| `LABEL_PITCH` (:164) | 12 | 16. An 11 px word needs its 16 px line. |

Figure thresholds:
- Legs print figures at `laneW ≥ 180 && barH ≥ 10` (revamp ProfilePanel.tsx:1177). The Net view prints at
  `barH ≥ 8` (:1102). Both were set for 9 px type.
- At 11 px, a figure on its row needs a pitch of about 18–20 px. The audit's own estimate is about 20 (§6f); the 18 is a
  calculation, not a measurement. Below that, the card carries the figure, as approvals 1 and 2 require.

Other values:
- Off the 4 px grid: `gap-1.5` (6 px) becomes 4 or 8; `px-2.5` (10 px) becomes 8 or 12; `py-[3px]` and `mt-[5px]`
  (ExposureMatrix.tsx:144) become 4.
- Already on the scale: control heights `h-6` (24) and `w-5 h-5` (20); icons `w-3` (12).

---

## (c) House components for Noah's bespoke controls

| Noah's control (where) | House component | What it needs |
|---|---|---|
| View tabs: his `FilterTabs` with the holo pill (revamp ProfilePanel.tsx:1808–1812; revamp FilterTabs.tsx:48–54) | ui/FilterTabs (the plain ink pill, `.hit` at FilterTabs.tsx:33) | Noah's `layoutDependency={value}` (revamp FilterTabs.tsx:41–48) stops the pill trailing its button while the panel is dragged. It is a house-component change, so see Q9. Keep the `data-profile-view` hook: terrain-ui-proof.mjs reads it 5 times. |
| Lanes card | ui/DropdownSelect `size="sm"` | Already the same in both. |
| The host's Expiry card | ui/ExpiryCard (Terrain.tsx:3475) | Unchanged. |
| Vol switch: a bespoke button in tracked caps (revamp ProfilePanel.tsx:1776–1790) | ui/Chip (Chip.tsx: `aria-pressed`, 11 px) | Chip has no `.hit`. Add it or wrap the chip, for the 44 px box on a coarse pointer. |
| "How to read" door: bespoke (:1754–1768) | `GuideDoor` (GuideFocus.tsx:46). The dialog is GuideFocus, already hosted at Terrain.tsx:3550 | Keep the `data-profile-guide` hook (proof ×2). |
| The × close: bespoke 20 px (:1793–1803) | No house door exists. Keep it and add `.hit` | Focus goes to `[data-strikes-toggle]` after closing (Terrain's `onClose`). The close hint stays "Hide this rail — R" (Terrain.tsx:3533). |
| Width grip and lane sash: `role=separator` spans (:1830–1855) | Keep them | The keys cannot move either today, in Noah's or the owner's. Keep the `data-profile-grip` and `data-profile-split-grip` hooks (proof). |
| Ladder hover card: a bespoke absolute card `w-[236px]` (:1600–1667) | ui/PointerCard with `CardRow`, anchored at the panel's left edge and the row's y | The owner's PointerCard lacks Noah's `foot`, `still` and `dense` props and `letGoWords` (the owner's PointerCard.tsx:41–53 against revamp PointerCard.tsx:51–63). Extend the house card. Keep the `data-profile-card` hook. |
| Matrix card: `PointerCard` and `PointerFollowCard` with `still`, `dense` and `foot` (ExposureMatrix.tsx:341) | The same house card, extended as in the row above | |
| Lane names (:1876–1886) | ui/Term (focusable, Term.tsx:54–55) | Remove `truncate` (approval 17). Term's tooltip head goes to sentence case. |
| How sure: the owner's `HowSureBook` (ProfilePanel.tsx:1860). Noah has none | components/levels/HowSure | Keep it. It is the home of the comparison with UW. |
| GEX tab view picker, a `DropdownSelect` (ExposureField.tsx:1080) | ui/DropdownSelect | Options: Calendar and Profile only. Noah's panel offered Calendar and Matrix: the panel uses the host "tile" (ExposureField.tsx:356), and `VIEWS_FOR.tile` is `['calendar','matrix']` (revamp ledgerView.ts:41). Profile was not reachable in his panel at 1ebc5bb. Remember the view under a Terrain-only key; Noah's "tile" key `slayer_ledger_view` is Pulse's. |
| Greek: `DropdownMulti` with `clearWord` (ExposureField.tsx:1085) | ui/DropdownMulti | The owner's version has no `clearWord` (DropdownMulti.tsx:71). Add it or drop it. |
| Expiries: `ExpiryRangeCard` with `cut` (ExposureField.tsx:1092) | ui/ExpiryRangeCard | The owner's version has no `cut` (ExpiryRangeCard.tsx:80). Add it, or say the cut in `note`. |
| Matrix row keys: a bespoke walker (ExposureMatrix.tsx:362–401) | ui/rowKeys `rowProps` (rowKeys.ts:48); j and k through components/layout/rowStepKeys `ROW_STEPS` | |
| Esc to let a kept strike go: document-level `keydown` listeners (ExposureMatrix.tsx:242–251, ExposureLedger.tsx:634–643) | ui/layers `useEscapeLayer` (layers.ts:87) | One Esc contract (646b2ff). A layer's own handler acts only while it is on top. |
| The kept strike | Terrain's own `focus` (`onSelect` toggles it, Terrain.tsx:3534) | One kept strike for the chart, the ladder, the matrix and the calendar. |
| Matrix spot row: `RoomSpotRule` (ExposureMatrix.tsx:622), which reads Pinpoint's room price through `useRoomSpot` | ui/SpotRule (SpotRule.tsx) fed Terrain's one price, or the replay cursor's price | Terrain's rule: one price on the page. |
| `StrikeNum` and `strikeRole` (revamp; the owner has neither) | Port them as they are | They import the wall inks from paletteInk by name, so the walls come out gold and violet. |
| Number formatting: `toFixed` and `toLocaleString` (revamp ProfilePanel.tsx:1413, 1470, 1613, 1650, 1686, 1702; ExposureMatrix.tsx:325, 336; ExposureLedger.tsx:153–156, 829, 850; ExposureProfileView.tsx:214–215, 345, 348) | core/format: `num`, `pct`, `pctSigned`, `usd` (format.ts:50–110), with the true minus; `fmtUsd`, which is `usdCompact` (data/gex.ts:46–48) | Never format a figure by hand. |
| Matrix, Ledger and Field: the owner's code already has older versions in use (ExposureField is imported by pages/pinpoint/MapDesk.tsx:41 and pages/workspace/registry.tsx:33) | — | Porting Noah's files over the owner's would change Pinpoint's Map and Pulse. Port them as the panel's own, or prove that MapDesk and registry draw the same before and after. |

---

## (d) Strings that fail the words check or the house rules

**The words check found no hits.** The owner's `scripts/check-words.mjs` was run on copies of 13 of Noah's files under
the scratchpad (tools/words-noah/src/…): ProfilePanel, ExposureMatrix, ExposureField, ExposureLedger,
ExposureProfileView, RoomSpotRule, strikeRole, StrikeNum, ledgerView, exposureView, LedgerGuide, BookRead and
ui/PointerCard. Result: "words:check — clean (0 allowed)". A planted "Buy the dip" in a test file was
caught, so the scan does read the copies.

**No times are printed.** None of the six panel files prints a clock time; a grep for `clock(`, `nyClock`,
`toLocaleTimeString` and `ET` found nothing. So nothing fails the 12-hour rule today. Approval 1's "for the minute"
adds one time, covered by the last rows below.

These fail the house rules:

| Where (revamp) | Now | Rule | Replacement |
|---|---|---|---|
| ProfilePanel.tsx:870 | `NET GAMMA` | Sentence case | `Net gamma` |
| :877 | `◂ PUTS · CALLS ▸` | Sentence case | `◂ puts · calls ▸` |
| :881 | `STRIKE` | Sentence case | `Strike` |
| :884 | `Δ SPOT` (the owner's version reads `Δ SPOT · σ`) | Sentence case | `Δ spot` / `Δ spot · σ` |
| :888 | `A MOVE FORCES` | Sentence case | `A move forces` |
| :1401 | `SUP ★` (and `CW`, `PW`) | Decoration; the house names | `Sup`, `CW`, `PW`, the axis chips' own names. The tags lived on the Net view, which becomes the matrix. |
| :1413, :1613, :1686 | `+1.23%` and `+1.23% from spot` built with `toFixed` | core/format; the true minus | `pctSigned(d)` and `` `${pctSigned(d)} from spot` `` |
| :1470 | `spot.toFixed(2)` | core/format | `num(spot, 2)` |
| :1630, :1641 | `Puts` and `Calls` in tracked caps | Sentence case | `Puts` and `Calls`, no transform |
| :1649 | `Open int` | Say what a figure is | `Open interest` |
| :1653 | `Since open` | "The card says what a figure is", e.g. "Change since the open (6:30 am)" | `` `Change since the open (${marketClock(9, 30)})` `` (nyTime.ts:156, the reader's clock). The owner's ladder has the same fault at ProfilePanel.tsx:1720. |
| :1664, :1732 | `Kept · click to let go` and `click to keep` | The house let-go words, which differ on a phone | `` `Kept · ${letGoWords()}` `` (revamp PointerCard.tsx:63, "tap to let go" on a phone) |
| :1782–1787 | `Vol` in tracked caps | Sentence case | `Vol`, no transform |
| :1809 title | "Ladder: … · Net: each strike's net · GEX: the book by strike and expiry" | Net is now the matrix; GEX has no Matrix view | "Ladder: the put and call legs at each strike · Net: each greek's net at each strike · GEX: the book by strike and expiry, or across prices" |
| :1797 | `Hide this panel` | The owner's name for it | Keep the owner's "Hide this rail — R" (Terrain.tsx:3533). |
| ExposureMatrix.tsx:87 | `VANNA` and `CHARM` | Sentence case. GEX, DEX and VEX are acronyms. | `Vanna` and `Charm`. The owner's data/compare.ts:58 has the same caps. |
| ExposureMatrix.tsx:114, :314, :319, :341 | Heads, card tags (`supreme`, `call wall`, `you`) and `kept · …` in tracked caps | Sentence case, no tracking | The same words, no transform. Drop `you`: Terrain has no positions on this panel. |
| ExposureMatrix.tsx:329 | `peak · hedging amplifies a move here` and `well · hedging absorbs a move here` | Jargon nowhere taught in Terrain; a label says what it means | `hedging amplifies a move here` and `hedging absorbs a move here` |
| ExposureMatrix.tsx:325 | `±1.23% · above/below spot` built with `toFixed` | core/format | `` `${pctSigned(d)} · ${d >= 0 ? 'above' : 'below'} spot` `` |
| ExposureMatrix.tsx:336 | `Math.round(oi).toLocaleString()` | core/format | `num(oi)` |
| ExposureField.tsx:300 | Profile hint "Dealer gamma across spot — the curve the flip is read off…" | The flip is the zero crossing of the strike book (`pickFlip`), never the profile curve's; and the house wording is "estimated dealer gamma (assumed sign)" | "Estimated dealer gamma (assumed sign) re-priced across prices — a line per expiry and the total; zero gamma is where it crosses" |
| ExposureField.tsx:976–977 | `Waiting for the first tick` in tracked caps | Sentence case. Terrain reads minutes. | `Waiting for the first minute` |
| ExposureField.tsx:1545 | `Reading the book…` in tracked caps | Sentence case | Same words, no transform |
| ExposureLedger.tsx:1014–1020 | Dates as `OCT 16 · TODAY` (uppercase, tracked) | Sentence case | `Oct 16 · today` |
| ExposureLedger.tsx:991–998 | `GEX · 1% MOVE` and so on, uppercase with `truncate` | Sentence case; never cut | `GEX · 1% move`, wrapped rather than cut |
| ExposureProfileView.tsx:211–216 | `PUT WALL 470`, `CALL WALL 475`, `SUPREME …`, `ZERO GAMMA 470.23`, `SPOT 470.29`, `KEPT 470` | Sentence case; core/format | `Put wall 470`, `Call wall 475`, `Supreme 470`, `Zero gamma 470.23`, `Spot 470.29`, `Kept 470` |
| ExposureProfileView.tsx:366 | `No curve for this book yet` in tracked caps | Sentence case | Same words, no transform |
| ExposureProfileView.tsx:370 | "Dealer gamma re-priced across spot · …" | House wording | "Estimated dealer gamma (assumed sign), re-priced across prices · above zero hedging amplifies a move, below it absorbs · zero gamma is where it crosses" |
| ExposureProfileView.tsx:345, :348 | `at 470.29` and `−1.23%` built with `toFixed` | core/format | `num` and `pctSigned` |
| New (approval 1), proposed | The panel's figure beside UW's | The labels name the universe and the minute; reader's clock, 12-hour, no "ET" | Card: "Modeled · 10:42 am" against "Unusual Whales' book (60 days)". Row, where it fits: the figure, then UW's in `--text-muted` as "UW 60d $918M" with a Term tooltip. The short form "UW 60d" needs the owner's OK. |
| New (approval 1): the minute's time | — | `clock(at)` (nyTime.ts:137) live; `minuteLabel(min)` (nyTime.ts:208) for a replay or history minute | Never 24-hour; never " ET". |

Two words were checked and are not failures:
- The flow lane's `buy $118M` and `sell $118M` (revamp ProfilePanel.tsx:1350, :1720) describe what dealers are forced to
  trade. The owner's ladder prints the same words (ProfilePanel.tsx:1420, :1788), and the words check does not flag
  them. Kept as they stand.
- "dealers chase / lean against a move here" matches the owner's own words (ProfilePanel.tsx:1797; data/compare.ts:52).

---

## (e) Acceptance checks: the width cap and row alignment

**Run on:**
- Desks at 1280 × 800, 1440 × 900 and 1920 × 1080, at 1, 2, 3 and 4 panes, plus an expanded pane.
- A phone at 390 × 844.
- Every tab: Ladder, Net and GEX (Calendar and Profile).
- Live, replay and a past session.

Computed widths at 1440 × 900 (pane widths from the audit, not re-measured):
- One pane: the audit measured a ladder of 476 px (area C after-run), which is the 40% cap on a pane of about 1,190 px.
- Two and four panes: about 590 px each (audit §6f), so the cap is about 236 px.
- Three panes: lay out as two columns below 2xl (Terrain.tsx:700).

So 1440 gives the full tier at one pane and the thin tier at four. On the phone, the overlay is min(340, 0.82 × pane),
about 294 px: the thin tier.

**Width.**
- **W1.** On lg and up, the panel's width is at most round(0.4 × its parent's width) + 1 at every layout above. This
  holds at rest, after the grip is dragged to its maximum, and after a pane is expanded and then collapsed.
  - Noah's 60% is hard-coded at revamp ProfilePanel.tsx:500 and :511. It becomes `maxShare`, which Terrain passes as
    0.4 (Terrain.tsx:3480; applied at the owner's ProfilePanel.tsx:498 and :513).
- **W2.** The chart frame stays at least 60% of the pane's width (`[data-chart-ink]` against the pane).
- **W3.** Below a 450 px pane, 0.4 × the pane is under `PROFILE_MIN_W` (180, ProfilePanel.tsx:89), and the floor wins
  (`Math.max`, ProfilePanel.tsx:498). Report where this happens. See Q7.
- **W4.** The tier equals `profileTier(width)`: full from 440, mid from 300, thin below (ProfilePanel.tsx:101). Expose
  it as `data-tier` and assert it.
- **W5.** The grip's double-click returns to `restWidth`, clamped by W1. Noah rests one pane at 580 (revamp
  ProfilePanel.tsx:96); the owner rests it at 520 (ProfilePanel.tsx:95). See Q6.
- **W6.** Below lg, the panel lays over the chart: absolute, `right-0`, its own `bg-panel` ground, z above the chart
  (Terrain.tsx:3539). Width is min(340, 0.82 × the pane). The R key and the Strikes or peek doors open and close it.
  Esc closes it (Terrain.tsx:2269). How to read opens from it. These are the existing phone checks (terrain-ui-proof
  "phone: the ladder lays over the chart…") and they still pass on all three tabs.
- **W7.** At the cap:
  - The GEX Calendar never draws an empty or clipped capsule. When it cuts expiries, its note says "Only N of M
    expiries fit — widen the panel or pick fewer." (ExposureField.tsx:1014).
  - The matrix never clips a figure: every cell's scrollWidth is at most its clientWidth.
  - Greeks that do not fit are named in the same kind of note, never squeezed. A greek column needs about 80 px
    (`LEG_MIN`, ExposureMatrix.tsx:108). Computed: a 236 px panel holds the strike column and two greek columns at most.

**Row alignment.** Each check applies to every tab that draws strike rows: Ladder, Net matrix and Calendar.
- **R1.** Every drawn row's centre is within 1 CSS px of the chart's y for that strike. The chart's y is the chart
  box's top plus `candles.priceToCoordinate(strike)`. Expose the rows (DOM `data-strike` boxes, or a canvas hook such
  as `canvas[data-key]`) and compare for at least 10 strikes across the plot.
- **R2.** The panel's top equals the chart box's top within 2 px. Otherwise StrikeChart ignores the panel's inset
  (StrikeChart.tsx:2501).
- **R3.** A pointer at the chart's y for a strike, and at ±40% of a row from it, names that strike in 60 of 60 hovers
  (`data-read-strike` or `data-profile-card`), at 1, 2 and 4 panes. The audit measured 57 of 60; the 3 misses were the
  lowest drawn row, at one pane (§6f).
- **R4.** No drawn row overlaps the head band (row top ≥ the `data-plot-inset` height) or the foot band. Rows outside the
  plot are counted (▲ n / ▼ n), never squeezed.
- **R5.** After a pan, a wheel, an autoscale, a drag of the price axis, a resize or a replay cursor step, the rows match
  R1 again within one frame. The panel polls the chart's projection every frame.
- **R6.** Noah's matrix is a table with its own scroll, whose rows share the box, at least 24 px each (`ROW_MIN`,
  ExposureMatrix.tsx:100), with the spot row centred. The calendar is the same (ExposureLedger, "the rows share the
  box"). **Neither meets R1 as written.**
  - The Net and Calendar tabs place each strike's row at the chart's y, with row height equal to the chart's pitch.
  - Where the pitch cannot hold an 11 px figure over a 3 px bar (about 20 px; 16 px with the figure beside the bar),
    the row draws the bar alone and the card carries the figures (approval 1).
- **R7.** Profile draws price on its x axis (ExposureProfileView), so it has no strike rows to align. See Q5.

**Approval 17 (lane names) and the head.**
- **H1.** Widths: 180, 236, 294, 340, 440, 476, 520 and 580 px. At each, every lane name (`[data-lane-head]`, and the
  matrix's greek heads):
  - is fully visible, with getBoundingClientRect().width ≥ scrollWidth;
  - has no `truncate` and no ellipsis;
  - is reachable with Tab; its Term tooltip opens on focus;
  - sits on head row 1 where it fits, otherwise on a row of its own.
- **H2.** The `data-plot-inset` height equals the measured bottom of the head (`data-profile-head`, from the DOM, not
  from constants, ProfilePanel.tsx:1949). The chart's fit top margin is (inset + 6) ÷ the pane's height
  (StrikeChart.tsx:2466, `FIT_GAP_PX` at :1084). The highest strike in the fitted candle range is drawn below the
  inset. Check this after the head grows a row.

**Type and colour scans.** Both run at every tab and width above.
- **T1.** A capture of DOM computed styles, plus a spy on `fillText` recording `ctx.font`, finds:
  - no size under 11 px, except 10 px ticks on the Profile chart's axis;
  - weights only 400, 500 and 600;
  - no `text-transform: uppercase`, and letter-spacing of 0.
- **C1.**
  - For one strike, the oval's ink on the column in view (`markInk` with the renderer's inks) equals, in exact RGB:
    the panel's net bar ink at that strike (Ladder Net and the matrix GEX column), and the read-line dot.
  - The put leg is `inks.put` and the call leg `inks.call`.
  - Run on dark and paper grounds, under each colour vision: standard, blue-orange and high-contrast.
- **C2.**
  - No panel pixel is within OKLab 0.05 of the thermal reds (`#A50026`, `#D73027`), Noah's ember stops (`#751D14`,
    `#9A2715`) or the up and down pair, except on figures marked as direction.
  - Magenta appears only on the supreme's row, cell or rule.
  - No moving foil appears on the panel.

---

## (f) Other conflicts found while mapping

These are not strings, but they break house rules in the ported lines:
- **The GEX tab reads the simulator.** It calls `Simulator.snapshotFor(ticker)` on a 10 s interval (revamp
  ProfilePanel.tsx:432–461). The Vol underlay reads `Simulator.getCandles` (revamp ProfilePanel.tsx:557–559); the
  owner's version reads `volBars` from the feed or the replay cut (Terrain.tsx:3483).
  - Every tab must read the field's column for the minute being viewed: live, the replay cursor, or history. Never a
    minute past the cursor.
  - The data step is separate from this note, but no ported line may keep these calls.
- **The panel opens on GEX** (revamp ProfilePanel.tsx:432). The owner's opens on Net (ProfilePanel.tsx:461, the UI
  pass: "default Net"). See Q8.
- **Noah's head grows without telling the chart.** On GEX the head row wraps and is measured (revamp
  ProfilePanel.tsx:444–455), but Noah has no `data-plot-inset`. The port keeps the owner's inset element and feeds it
  the measured height (H2).
- **Data hooks the owner's checks read.** Keep `data-profile-panel`, `data-profile-view` (the name, not Noah's
  `data-profile-view-now`), `data-profile-guide`, `data-profile-grip`, `data-profile-split-grip`, `data-profile-card`,
  `data-lane-head`, `data-lane` and `canvas[data-key]`. All are read by scripts/terrain-ui-proof.mjs; the others are
  read by scripts/terrain-exercise.

---

## Questions for the owner

1. **Q1: the desk's Colours card.**
   - Situation: Terrain's desk card offers House or Thermal (Terrain.tsx:4508, ProfilePanel.tsx:124). Thermal is red
     and blue on the ladder, while the ovals never follow it. Today a Thermal desk already shows a ladder that disagrees
     with its chart.
   - The conflict: "Nothing the current ladder does may be lost" against "his Thermal ramp uses red… so a strike reads
     the same on the panel and the chart".
   - **Recommendation:** retire Thermal, and with it the card. The panel then wears only the ovals' inks and the colour
     vision from Settings. data/terms.ts:71 ("the House colours — Thermal draws them cool and warm") changes with it.
   - The other way: keep Thermal as a ladder-only choice and accept the mismatch.
2. **Q2: the calendar capsules (A18).**
   - (a) Keep the gold-violet ramp, so colour shows the amount.
   - (b) Use the ladder window (heatmap.ts:660–680), so a small one-sided cell is still clearly gold or violet, plus
     the ovals' balanced grey where |net| ÷ gross < 0.2.
   - **Recommendation:** (b).
3. **Q3: the ink for Δ from spot and for since-the-open.**
   - The `--bull`/`--bear` tokens: the owner's ladder uses them today; they follow colour vision.
   - Or the candles' up and down (`candleDirInks`, candleTheme.ts:299). This is the colour rule's single source on the
     chart, but Glacier's "blue up, slate down" sits near the violet and the balanced grey.
   - **Recommendation:** the tokens.
4. **Q4: the matrix's "three heaviest at full ink, the rest at 0.72"** (ExposureMatrix.tsx:145, :212).
   - Keep it, after measuring paper contrast; or drop it and let the bar's length carry the amount.
   - **Recommendation:** drop it.
5. **Q5: Profile and row alignment.** Profile draws price across the x axis, so it cannot align with the chart's
   strike rows unless it is turned upright (price down the side, gamma across). Turn it, or exempt Profile from the
   alignment rule?
6. **Q6: the rest width for one pane.**
   - Noah's 580 (revamp ProfilePanel.tsx:96), sized for the Calendar's three expiries, or the owner's 520.
   - Both are clamped by the 40% cap. At 1440 both land at about 476. At 1920 one pane allows about 664, so the rest
     width stands.
7. **Q7: the 180 px floor against the 40% cap** on panes narrower than 450 px. Which wins?
8. **Q8: the tab the panel opens on.** Noah's GEX, or the owner's Net (now the matrix)?
9. **Q9: Noah's FilterTabs fix.** Take `layoutDependency={value}` (revamp FilterTabs.tsx:41–48) into the house
   FilterTabs, without the foil? It changes every room's tabs.
