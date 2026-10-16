# Our current strike ladder in Terrain — the full inventory (so nothing is lost in the port)

Read-only survey of the owner's repo at /home/user/3abida, HEAD `caebf7e`, working tree as of 2026-10-16 05:32 UTC
(the other workflow had `scripts/terrain-ui-proof.mjs` modified and `docs/colour-rule-2026-10-16/` untracked; line numbers
for the proof file are from a copy taken then: `…/panel-port/tools/snap/scripts/terrain-ui-proof.mjs`). Nothing in the
repo was edited. No browser was run for this note: figures marked **measured** come from the audit's own recorded runs
(docs/terrain-audit-2026-10-15/exercise-after/area-c.md); everything else is read from the code, and I say so where a
behaviour is only computed from code.

Abbreviations (all repo-relative to /home/user/3abida):

| short | file |
|---|---|
| PP | src/components/gex/ProfilePanel.tsx (1,993 lines — the ladder) |
| TR | src/pages/terrain/Terrain.tsx (4,818 lines — mounts and feeds it) |
| SC | src/components/gex/StrikeChart.tsx |
| PG | src/components/gex/ProfileGuide.tsx (its "How to read") |
| HS | src/components/levels/HowSure.tsx |
| LV | src/data/feed/levels.ts |
| TF | src/data/feed/trailField.ts |
| HM | src/components/gex/heatmap.ts |
| CM | .claude/CLAUDE.md |
| AU | docs/terrain-audit-2026-10-15/README.md |
| AT | docs/terrain-audit-2026-10-15/TABLE.md |
| PR | scripts/terrain-ui-proof.mjs (`npm run terrain:check`) |

Short names used bare: `keys.ts` = src/components/layout/keys.ts; `levelview.ts` = src/data/levelview.ts;
`useTerrainReplay.ts` = src/components/terrain/useTerrainReplay.ts; `DecisionStrip.tsx` = src/components/terrain/DecisionStrip.tsx;
`area-c.md` = docs/terrain-audit-2026-10-15/exercise-after/area-c.md; `trailModel.ts` = src/data/feed/trailModel.ts.

---

## 0. The ten facts the port most needs

1. **Live, the ladder is Unusual Whales' book, not the field.** On the feed the rows are UW's `/spot-exposures/strike`
   (every expiry, 30 strikes each side of UW's price, polled every 30 s — LV:16-23, LV:313-319, TR:1393-1394); in a
   window (0DTE/Fri/OPEX) UW's 60-day book by partition (TR:1374-1390); on a listed date UW's expiry-strike rows
   (TR:1391-1394). Only **in a replay** is it the field's column at the cursor (TR:509-521, TR:1460, TR:1468). This is
   the audit's 6c finding and approval 1 (AU:163-198, AU:423).
2. **It is not history-aware.** Panning back, "Back to live" showing, or a 1D bar: the ladder still shows the newest
   book (`railData = rp.active && rpRail ? rpRail : liveRail`, TR:1468; `atLive` only drives the foot row, TR:1762-1763,
   TR:2443). The day panel (TR:1879-1918) is the only per-day read, and it is a separate card.
3. **"All 60 days" is untrue for the ladder today**: the label stands on the Expiry card (TR:484) while the ladder reads
   UW's every-expiry book (TR:1393-1394; the card's own hint says so, TR:484; AU:190-191).
4. **The legs (Sides view) exist only where a book carries them**: house chain (TR:389), UW book (TR:496), UW 60-day
   book (TR:1388). **In a replay there are no legs** (`legs: new Map()`, TR:518) — Sides draws each net on one side
   (PP:1228-1233) and the hover card shows no Puts/Calls rows (PP:1688).
5. **The spine's ghost at the open mixes sources live on the feed**: the ratio is the FIELD's open/now
   (`feedOpenRatio(fField)`, TR:2398, LV:1494-1510) applied to UW's rows (PP:1320-1326).
6. **Broken / reclaimed walls are not on the ladder.** `railWallState` goes to the chart only (TR:1472-1490, TR:2962);
   ProfilePanel takes no wall state (PP:346-419).
7. **Colours: two palettes, desk-wide.** House = `gold-violet` (gold absorb/calls, violet amplify/puts — HM:39-41),
   Thermal = `thermal-yellow` (red/blue — HM:105, HM:541). Only the ladder and its guide read it (TR:3492, TR:3551); the
   ovals stay gold/violet whatever is picked (audit row C-03 **measured**: AT:394). So under Thermal a strike reads
   differently on the ladder and the chart today.
8. **Most canvas words are under 11 px**: 9 and 10 px heads, figures, captions, counts (list in §8). DOM words are 11 px
   or more, but the hover card's heads are tracked capitals (PP:1697, 1708, 1716, 1720) and the Vol switch too (PP:1852).
9. **Rows align with the chart through one projection** handed by StrikeChart (`projectionRef`, SC:568-575,
   SC:2775-2780; polled each frame, PP:661-677, PP:787-799); the head's height is published as `data-plot-inset`
   (PP:1946-1949) and read by StrikeChart's fit (SC:2430-2504). **Measured**: 57 of 60 hovers named the chart's strike
   (AU:267).
10. **At rest in two to four panes the ladder is the thin tier** (**measured** 236 px at 1440×900, 204 px at 1280×720;
    area-c.md:88-95): no key band, no Δ/σ column, a two-row head, and the read line is "tiny" (<240 px, PP:1643) so it
    drops the Δ from spot too. Computed from code, not measured: in the **Net** view at 236 px with a row pitch giving
    bars ≥ 8 px the figures print (PP:1174) so the hover card does not open (PP:1650) — **Δ from spot is then shown
    nowhere** on the ladder. In Sides at 236 px the card opens and carries it (PP:1680).

---

## 1. How Terrain mounts and feeds it

The mount: TR:3464-3540. Condition: `(belowLg ? narrowLadder : ladder) && rail.rows.length > 0 && !(offHouse && !chartTape)`
(TR:3464) — so no rows (feed not answered yet, a replay minute with no column, the source still 'pending') means **no
ladder at all**, not an empty one (the audit saw it vanish 1.9 s after a replay pick: AT:434).

| prop | value Terrain passes | where | source of the value |
|---|---|---|---|
| `width` | phone 340; desk `cfg.ladderW ?? profileRestWidth(paneCount, expanded)` | TR:3468 | PaneCfg.ladderW (TR:254-255, validated ≥180 and <4000 at TR:617-618) |
| `restWidth` | `profileRestWidth(paneCount, expanded)` | TR:3469 | PP:95: 520 one pane or expanded, 240 three panes, 340 two or four |
| `onWidth` | `w => onCfg({ ladderW: w })` | TR:3470 | stored per pane slot |
| `headCard` | `<ExpiryCard label="Expiry" … testId="terrain-expiry">` (bare beside other panes) | TR:3475 | desk-wide `railCut`; feed choices `feedCutChoices(fListed)` TR:474-486, house `railCutChoices()` TR:327-340 |
| `maxShare` | phone 0.82, desk 0.4 | TR:3476-3480 | the 40% cap (the audit's TE-5) |
| `ticker` | pane's name | TR:3482 | — |
| `volBars` | replay `rp.cut.bars`; feed `fBars.bars`; house undefined (PP falls back to `Simulator.getCandles`) | TR:3483, PP:562 | cut at the cursor in a replay |
| `rows` | `rail.rows` (descending) | TR:3484 | see §2 |
| `sure` | `railSure` | TR:3486, TR:2067-2075 | How sure, the same object the decision strip opens (TR:3281, TR:3339) |
| `sigmaRem` | `sigmaRem?.sigma ?? null` | TR:3487 | TR:1699-1709 — live straddle's 1σ to the close (the cursor's in a replay) |
| `maxAbs` | `rail.maxAbs` | TR:3488 | `railShape` core ±10 strikes (TR:365-377) |
| `legs` | `railData.legs` | TR:3489, TR:2396 | see §2 (empty in a replay) |
| `openRatio` | replay `feedOpenRatio(rp.cut.cols, rp.asOf)`; feed `feedOpenRatio(fField)`; house `netSinceOpenRatio(ticker)` | TR:3490, TR:2397-2401 | the spine's ghost and the card's "Since open" |
| `lagged` | replay `rp.lagged`; live `liveLagged` | TR:3491, TR:2080-2095 | ghost dots 10/30/60 min |
| `palette` | desk `cfg.palette` ('house' default) | TR:3492, TR:567 | the desk's Colours card (TR:4505-4510) |
| `step` | `rail.step` | TR:3493 | smallest strike gap (TR:370-375) |
| `levels` | `railData.levels` (held walls) | TR:3494, TR:1491 | the same object the chart, axis chips and decision strip read (TR:2910) |
| `flow` | `buildFlowFromRows(rail.rows, levels.spot)` | TR:3495, TR:2392 | data/hedgeFlow.ts:81-102, off the ladder's own rows |
| `lane` / `onLane` | `cfg.lane` / `onCfg({ lane })` | TR:3496-3497 | per pane slot, default 'size' (TR:554), validated TR:619 |
| `greek` | `"GEX"` | TR:3498 | fixed — the ladder never shows another greek in Terrain |
| `onGuide` / `guideOpen` | toggles `guideOpen` | TR:3499-3500, TR:2403 | GuideFocus TR:3548-3553 |
| `focusPrice` | `focus` | TR:3501, TR:2251-2254 | the same strike the chart pins (TR:2941) |
| `projection` | `projectionRef` (or `bookProjection` for an index with no bars) | TR:3502, TR:2225-2237 | SC:2775-2780 |
| `onClose` | desk: `ladder:false`, focus to `[data-strikes-toggle]`; phone: close the overlay | TR:3503-3532 | — |
| `closeHint` | "Hide this rail — R" | TR:3533 | — |
| `onSelect` | toggles `focus` | TR:3534 | — |
| `ground` | `chartGround(theme)` | TR:3536, TR:2486 | the pane's candle theme |
| `className` | phone `absolute right-0 inset-y-0 z-[25] bg-panel shadow-2xl shadow-black/50`; desk `hidden lg:block` | TR:3539 | — |

Never passed by Terrain: `words` (defaults to gamma's "amplifies/absorbs", PP:435).

---

## 2. What the ladder reads, mode by mode

| mode | rows (net a strike) | legs (Sides) | levels | ghost at open | ghost dots | flow lane | spot (Δ) | cadence |
|---|---|---|---|---|---|---|---|---|
| **House** (stand-in), whole book or a window | `buildLadderFor(ticker)` (TR:386) | Simulator chain `putGex`/`callGex` (TR:389) | `buildLevelsFor` (TR:396) → held by WallStick (TR:1403-1419) | `netSinceOpenRatio` (TR:2398; levelview.ts:94) | Simulator gex history (TR:2083) | off the rows | the simulator's | every tick (`revision`, TR:1370) |
| **House**, a calendar date | one expiry off `buildExposureSurface` (TR:407-425) | surface put/call (TR:415-421) | `levelsOf` (TR:345-358) | same as above (whole book) | same as above (**whole book's history, not the date's**) | off the rows | simulator | every tick |
| **Feed live, "All 60 days"** (`railCut 'book'`) | UW `/spot-exposures/strike`, **every expiry**, 30 each side (LV:16-23, LV:282-310, TR:1393-1394) | UW put/call gamma (TR:496) | `levelsOf` on UW rows (TR:503) → WallStick | **the field's** open/now ratio (TR:2398) | UW books read today, every expiry (TR:2092) | off UW rows | UW stock-state close `fDay.price` (TR:1281-1282, TR:493) | UW poll 30 s (LV:316) |
| **Feed, a window** (0DTE/Fri/OPEX) | UW 60-day book by partition (`measuredBooks60` + `book60Window`, TR:1374-1390); none read yet → falls back to every expiry and How sure says so (TR:2024) | from the 60-day book (TR:1388) | same | field ratio (window view) | 60-day books windowed (TR:2085-2090) | off rows | same | recorder's 5-min read (`fFieldRead` dep, TR:1383) |
| **Feed, a listed date** | UW expiry-strike for the date, filtered to the book's strikes (TR:1391-1394; `useFeedByExpiry` TR:1366) | UW put/call | `levelsOf` | field ratio (the field follows the date, TR:1293-1295) | **none** (TR:2084) | off rows | same | poll |
| **Replay** (feed or house) | the field's column at the cursor, `frameRail` (TR:509-521) | **none** (TR:518) | the column's held CW/PW, flip, `top[0]` as supreme (TR:517); no column → empty, levels NaN (TR:511) | `feedOpenRatio(rp.cut.cols, rp.asOf)` (TR:2398) | `rp.lagged` (useTerrainReplay.ts:127) | off the column | the cursor's `f.spot` (TR:510) | each cursor move |
| **History** (panned back, 1D bar) | **unchanged — the newest live book** (TR:1468) | live | live | live | live | live | live | — |
| **Index with no bars on the feed** | UW book; rows stand on `bookProjection`, the core ±1 step over the box (TR:456-466, TR:2226-2237) | UW | UW | field | none/UW | rows | book price | poll |
| **Source 'pending'** | nothing (`emptyRail`, TR:1396, TR:505) → the ladder does not mount (TR:3464) | — | — | — | — | — | — | — |

**The field the chart draws** (what approval 1 wants on the ladder) is `fTrail.snaps` (TR:1295-1356; per-minute
modeled columns, `GexLevel` fields: `value` net, `gross`, `prov`, `staleSince`, `staleBound`, `freshAt`, `staleShare`,
`readGap`, `wideShare`, `coverage`, `at`, optional `dex`, `vex`, `callOI`, `putOI` — src/types/market.ts:41-86). The
column keeps **the net per strike, not put/call legs** (CM:1021-1022: "calls/puts and σ stand for the newest column
alone (the field keeps the net per strike)"). Past sessions come as tiles (TR:1296-1340) at the pane's timeframe and
window.

**UW's figure beside it** (approval 1: the 60-day book, never every expiry): today `measuredAt` (TF:231-250) reads the
60-day book within 10 min (TF:226) **and falls back to the every-expiry book** (TF:243-249) — the bead card uses it
(SC:6681). The ladder itself carries no UW-beside-field figure today.

---

## 3. Feature inventory

Columns: what the reader sees · where · what it reads · live / replay / history.

### 3a. Frame, width and tiers

| feature | what the reader sees | where | reads | L / R / H |
|---|---|---|---|---|
| Rest width by pane count | 520 one pane or expanded, 340 two or four, 240 three | PP:90-95; TR:3468-3469 | pane count | — |
| The 40% cap | the ladder never takes more than 40% of its pane on a desk (82% on a phone) | PP:402-404, PP:486-499; TR:3476-3480; AU:263 | host's width (ResizeObserver) | — |
| Floor | never under 180 px | PP:86-89; TR:618 | — | — |
| **Measured widths** | 1440×900: 1 pane 476 (full), 2/3/4 panes 236 (thin), expanded 520; 1280×720: 412 / 204; phone overlay 308 of 378 (81%) | exercise-after/area-c.md:83, 87-95 | — | — |
| Tiers | full ≥440 px (one-row head, key band, wide strike column with Δ and σ, dollars at tips); mid ≥300 (two-row head, key, wide column); thin <300 (two-row head, no key, 60 px column, figures only where they fit, the card otherwise) | PP:96-101, PP:612-616, PP:682-689 | width | — |
| Width grip | invisible 2 px sash on the left edge; drag stores `ladderW`; double-click → rest width | PP:477-527, PP:1913-1926 (`data-profile-grip`, role separator, **not focusable**) | — | — |
| A drag is not a click | a click within 400 ms of a drag, or on a separator, keeps nothing | PP:500-503, PP:1609-1613 | — | — |
| Head never overflows | measured; the guide door loses its words, then How sure becomes its icon | PP:617-645, PP:1834, PP:1860 | — | — |

### 3b. The head

| feature | what the reader sees | where | reads | L / R / H |
|---|---|---|---|---|
| Head band | 30 px (full) or 56 px in two rows (mid, thin) | PP:138-142, PP:1950-1986 (`data-profile-head`, `data-head-rows`) | — | — |
| View tabs **Net · Sides** | two chips in the Expiry card's clothes; **Net by default**; local state (not stored — a remount goes back to Net) | PP:454-461, PP:1876-1897 (`data-profile-views`, `data-profile-view="net"/"ladder"`) | — | — |
| Expiry card | the desk's one cut: listed dates (≤91 days) + 0DTE · To Friday · To monthly OPEX + "All 60 days" (feed); calendar dates + "All expiries" (house) | TR:3475, TR:474-486, TR:327-340 | UW listed dates (`useFeedMaxPain` → `listedDates`, TR:1284-1285) | desk-wide; the header chips (TR:3186, TR:3296) and W (TR:4177-4188) set the same cut |
| Lane names with Term | "Net · GEX · puts − calls" or "Size · GEX · puts ◂ ▸ calls", "What a move forces · from gamma" — **only from 640 px on the full tier** (never at a rest width) | PP:1958-1975 (`data-lane-head`); terms src/data/terms.ts:71-77 | — | approval 17's subject |
| Lanes menu | Both / Size / Flow (`DropdownSelect`, testId `lanes`) — shown when the panel is ≥250 px or on the two-row head | PP:78-83, PP:1845 | — | per pane, stored |
| Vol switch | toggles the volume profile underlay (`data-profile-vol`, tracked caps) | PP:1846-1859 | — | off by default, local state |
| How sure door | "How sure" (icon only under 250 px or when squeezed) | PP:1860; HS:104-133 | `railSure` (TR:2067-2075) | live / replay sections; see 3k |
| How to read door | ⓘ "How to read" (icon only under 320 px) | PP:1817-1836 (`data-profile-guide`) | — | — |
| × close | hides this pane's ladder (desk) or the overlay (phone); keys go to the Strikes button | PP:1864-1875 (`data-profile-close`); TR:3503-3532 | — | — |

### 3c. The key band and column heads (canvas)

| feature | what the reader sees | where | reads | L / R / H |
|---|---|---|---|---|
| Key band (full, mid; size lane) | swatches + "puts amplify · calls absorb" (short "puts · calls"), in Sides "the spine now", "at the open" only while a ghost is drawn, "10 · 30 · 60 min before" only while dots are drawn, "supreme" only while its row is on screen; also written to `canvas[data-key]` | PP:143-145, PP:824-925 (10 px words, PP:872) | the palette, `openRatio`, `lagged`, levels | follows replay through its props |
| Column heads | Net: "NET GAMMA ◂ puts · calls ▸"; Sides: "◂ PUTS · CALLS ▸", "NET" when the lane ≥300; "STRIKE"; "Δ SPOT" / "Δ SPOT · σ" on the wide column; "A MOVE FORCES" on the flow lane — **9 px capitals** | PP:146-148, PP:926-969 | σ present? | — |
| ▲ / ▼ counts | rows culled above / below the plot | PP:149-152, PP:784-799, PP:1487-1492 (9 px) | projection | — |

### 3d. Rows and the strike column

| feature | what the reader sees | where | reads | L / R / H |
|---|---|---|---|---|
| Rows on the chart's price rows | every strike drawn at `projection.yFor(strike)`, read each frame (pan, zoom, autoscale, resize) | PP:29-41, PP:647-680, PP:787-800; SC:568-575, SC:2775-2780 | the chart's candle series | follows the chart's view, **but the values are the live book** (fact 2) |
| Row height | bar 4–22 px off the pitch (62%) | PP:779 | pitch | — |
| Label stride | a strike label every ⌈12 px ÷ pitch⌉ rows, plus walls, supreme, focus, hover | PP:157-158, PP:801-805 | — | — |
| Gridlines | at the labelled rows | PP:1046-1061 | — | — |
| Strike | bold in the wide column; in the call wall / put wall / supreme ink; silver when kept | PP:1451-1466 (10 px) | levels | — |
| **Δ from spot** | `pctSigned((k − spot)/spot)` in the direction ink (bull above, bear below) — **wide column only (mid, full)** | PP:1467-1485 (9 px); TR:493 one price | `levels.spot` = UW quote live, cursor price in replay | at thin tier only in the read line (≥240 px) and the card |
| **σ to the close** | " 1.4σ" after the Δ, muted, when σ_rem exists | PP:1471-1483; TR:1705-1709 | `sigmaRem` (live straddle; cursor's in replay; none after the close) | — |
| Spot chip | solid chip with the price to the cent in the column | PP:1529-1540 (10 px) | `levels.spot` | — |
| Spot rule | hairline across the panel at the price | PP:1083-1092 | — | — |

### 3e. The Net view (default)

| feature | what the reader sees | where | reads | L / R / H |
|---|---|---|---|---|
| Diverging bar | from the lane's centre line: **left = puts lead (amplify, violet), right = calls lead (absorb, gold)**, length \|net\| ÷ the largest on screen | PP:1165-1199 | `rows[].value` (house sign: positive put-dominant) | live / replay |
| Net figure at the tip | signed "+$1.2B" / "−$957M" in the side's ink, when the lane ≥110 px and bar ≥8 px | PP:1174-1207 (9–10 px, weight 700) | — | — |
| Kept/hover ring | silver ring round the bar | PP:1208-1215, PP:1127 | focus, hover | — |

### 3f. The Sides view (the old "Ladder")

| feature | what the reader sees | where | reads | L / R / H |
|---|---|---|---|---|
| Put leg left, call leg right | a gradient along the ramp from the centre's quiet to the leg's strength | PP:1217-1283 | `legs` (none in a replay → the net on one side, PP:1228-1233) | replay: degraded |
| Leg figures | dollars past each tip when the lane ≥180 px and bar ≥10 px | PP:1221, PP:1284-1296 (9 px) | legs | — |
| NET column | the net at the lane's right edge when the lane ≥300 px | PP:776, PP:1297-1305 (9 px, 700) | rows | — |
| **The spine** | one curve leaning to the side that wins each strike (positive → left), ≤44% of half the lane | PP:129-130, PP:1307-1337 | rows | — |
| Spine through the flip | the curve takes the flip's linear crossing as a point | PP:1312-1318; CM:759-760 | `levels.flip` | — |
| Ghost at the open | dashed curve: the spine × the open/now ratio | PP:1320-1334 | `openRatio` (feed: **field's ratio on UW rows**) | live / replay |
| Ghost dots | 10 min filled, 30 smaller, 60 a ring, on the spine's scale | PP:356-359, PP:833-845, PP:1338-1348 | `lagged` (live: UW books read today / 60-day books; replay: columns) | CM:957-958 "never mixed" |
| Mark on the spine | the strike in hand marked | PP:1349-1359 | focus / hover | — |

### 3g. The Flow lane ("What a move forces")

| feature | what the reader sees | where | reads | L / R / H |
|---|---|---|---|---|
| Lane | off by default (lane 'size', TR:554); Lanes → Flow or Both | PP:78-83, PP:605-607 | `cfg.lane` | — |
| Silhouette | the running total as a quiet grey wedge, pinched at spot | PP:1363-1406 | `flow` = Σ crossed nets × move % (data/hedgeFlow.ts:81-102) — off the ladder's own rows | live / replay (rows) |
| Named capsules | only at the walls, supreme, kept and hovered strikes: "buy $118M" / "sell $…" inside or beside | PP:1407-1449 (9 px) | flow rungs | — |
| Level chips | "Call wall" / "Put wall" / "Supreme" pills at the flow lane's right edge | PP:1494-1527 (10 px) | levels | — |
| Sash between lanes | only with Both; drag to re-split, double-click 50/50; stored module-wide `slayer_profile_split` (25–75%) | PP:160-195, PP:528-550, PP:1927-1941 (`data-profile-split-grip`, not focusable) | — | — |

### 3h. The Vol underlay (volume profile)

| feature | what the reader sees | where | reads | L / R / H |
|---|---|---|---|---|
| Traded volume by price | steel bars under the size lane, value area dashed, VPOC solid with the word "VPOC" (11 px) | PP:552-567, PP:992-1044 | `sessionVolumeProfile` (data/volumeProfile.ts:138) on: replay `rp.cut.bars`, feed UW/Theta minutes, house candles | replay: cut at the cursor. History: **always the last session in the bars** (not the viewed day) |

### 3i. Levels on the ladder

| feature | what the reader sees | where | reads | L / R / H |
|---|---|---|---|---|
| Wall stripes | a 2 px stripe on the row's left edge in the level's ink (call wall gold, put wall violet, supreme magenta) | PP:1499-1507 | levels (held by WallStick live, TR:1397-1419; the column's held walls in replay) | — |
| Strike label ink | wall/supreme strikes printed in their inks | PP:1464 | levels | — |
| Supreme wash | the supreme's row washed magenta across the panel | PP:815-822 | `levels.supreme` (live: heaviest \|net\| of UW's book, TR:345-354; replay: `top[0]`) | note: the chart's "Top" is the field's largest node (CM:1128-1129) — a different strike can be named |
| Flip rule + caption | dashed rule across the panel, "flip 772.35" at the right end (9 px) | PP:1063-1081 | `levels.flip` (linear crossing, core/walls.ts) | — |
| Broken / reclaimed | **not on the ladder** (chart chips and axis only) | TR:1469-1490, TR:2962 | — | gap |

### 3j. Hover, keep, read line, card

| feature | what the reader sees | where | reads | L / R / H |
|---|---|---|---|---|
| Hover | the nearest row by height anywhere below the head: a wash on the row, silver-soft ring | PP:1585-1608, PP:807-814 | placed rows | — |
| Click to keep | toggles Terrain's `focus` — the same strike the chart pins (chain bright, rest at 40%); Esc lets go through the chart's layer mode; a new name clears it | PP:1609-1613; TR:3534, TR:2251-2261, TR:2941, TR:2968; SC:1453-1465; CM:1112-1114 | — | shared with the chart |
| **Read line** | one fixed line in the time-axis band under the lanes: strike · role · Δ "$ · % · σ from spot" · (Net: Put $ · Call $ · Share %) or (Sides: Size $ · amplifies/absorbs) · "A move here forces buy/sell $" · words · "kept · click to let go" / "click to keep"; at <430 px words go, at <240 px only strike, role and size | PP:1615-1643, PP:1735-1807 (`data-profile-read`, 11 px) | rows, legs, flow, σ | — |
| **Hover card** | 236 px card **over the chart** to the ladder's left, only when the rows cannot print their figures: ticker + strike, "±x% from spot" (direction ink, `data-dir`), role, PUTS/CALLS bars with $, NET with its word, OPEN INT (whole book only), SINCE OPEN, "Kept · click to let go" / "Click to keep" | PP:1644-1734 (`data-profile-card`, 11–12 px; heads tracked caps) | legs, `callOI` (TR:497-498 feed whole book; house date `callOI`), `openRatio` → `sinceOpenRead` (levelview.ts:139) | replay: no legs, no OI |

### 3k. How sure (the door in the ladder head)

One card, the same `railSure` the decision strip opens at its sections (TR:2067-2075; HS:104-300; DecisionStrip.tsx:97).
Sections and their sources:

| section | where it is built | live / replay |
|---|---|---|
| badge "repriced every minute · all windows" + the window line (UW's 60-day book through the window, or "every expiry" until read) | TR:2017-2026; HS:137-158 | live |
| Replay: "Replay · Oct 13 · 10:42 am", "the ladder and the levels are the field's column at …", "Unusual Whales serves no book by strike for a past minute", how the session is drawn | TR:2051-2066; HS:144-152 | replay only |
| The regime | `regimeSure` (TR:1750); HS:160-166 | both |
| What they assume | `bookSureness` (data/levelSureness.ts) via `sureOf`/`feedRail` (TR:360-363, TR:502-503) | both |
| How fresh | `feedFreshness` — "Open interest as of … · the hedging is figured by Unusual Whales at 777.88, 6:58 am PDT" (LV:446-450) | live (replay: the session's source line) |
| **Model agreement with Unusual Whales (both naive-sign estimates)** — the field's residual + coverage | TR:1660-1661; HS:176-182 | live |
| Delta to 3:50 pm · mechanical drift, unvalidated | TR:2027-2050; HS:184-190 | both (cursor's column) |
| Level alerts today with +15/+30 | TR:2000-2015; HS:192-203 | live |
| Track record | TR:1688-1698; HS:205-217 | live only |
| Priced move · σ to the close (market and budget lines, calibration) | TR:1710-1718; HS:219-235 | both (no calibration in replay) |
| If the side were the other way | HS:236-252 | both |

### 3l. How to read (the guide)

GuideFocus over the pane, a dark card (TR:3542-3553; `testId="profile-guide"`; title "How to read this panel"). Content
PG:219-297: "Size · what sits at each strike" (describes **the Sides view**: legs, the leaning line, dashed at the open —
not the Net view that is the default), a size figure (PG:105-167), "What a move forces" with its figure (PG:180-215),
"Today, read both ways" for the call and put wall (PG:240-258), the field's one line about ovals (PG:289-291), "Hover any
strike…" (PG:292). The Glossary link is GuideFocus's (src/components/ui/GuideFocus.tsx:129). Reads the ladder's rows,
levels, flow and palette.

### 3m. Colours, ground and colour vision

| feature | what it does | where |
|---|---|---|
| Palette | `'house'` → HEAT_MODE `gold-violet`; `'thermal'` → `thermal-yellow` (red amplify, blue absorb) | PP:123-128; HM:39-41, HM:105, HM:541 |
| Desk Colours card | "Colours: House / Thermal", one desk-wide choice stored as `rails` | TR:4505-4510, TR:293-299, TR:661; pop-out TR:4761-4762 |
| Side ink | House: the pole itself (the ovals' value); other palettes 0.8 of the ramp | PP:1156-1164 |
| Palette glide | a change of palette crossfades ~330 ms | PP:580-600, PP:694-721 |
| Ground | dark inks on a dark tape; on a light tape the tokens read off the panel's box and the paper ramps | PP:211-344, PP:439-450; CM:46-49 |
| Colour vision | dark set: walls and bull/bear off `--absorb`/`--amplify`/`--bull`/`--bear` (`groundRgb`); the ramp itself via `cvdGoldViolet` | PP:292-301; HM:516-532 |
| Literals still in the dark set | `#ededed`, `#a3a3a3`, `#7d7d7d`, `#C7D3E8`, `rgb(48,209,88)`, `rgb(255,59,48)`, `#0a0a0a`, `#0e0e0f`, white washes | PP:133-136, PP:258-291 |

### 3n. Motion

| feature | where |
|---|---|
| Tween: every length and colour eases (τ 110 ms, ~400 ms to settle) | PP:568-579, PP:722-747 |
| Mirror: a leg whose strike left the view shrinks into the centre line | PP:1542-1578 |
| Frame loop redraws only when the mapping, size or data moved | PP:647-681 |

### 3o. Desk controls, keys, phone

| feature | what the reader sees | where | notes |
|---|---|---|---|
| Per-pane flag | `ladder` per slot, default on | TR:249-253, TR:553, TR:616 | — |
| **Strikes** button (desk bar) | toggles every pane's ladder, title "… — Shift R", `data-strikes-toggle`; not rendered below lg | TR:4484-4500, TR:3873 | tracked caps (`uppercase tracking-wider`, TR:4494) |
| **Colours** card | House / Thermal, only while a ladder is up, not below lg | TR:4505-4510 | — |
| **R** | the active pane's ladder on/off, announced "SPY strike rail shown/hidden" | TR:4136-4140; keys.ts:100 | unbound below lg (TR:4125-4135) |
| **Shift R** | every pane's ladder | TR:4141-4147; keys.ts:83 | — |
| W | cycles the expiry window (the ladder's cut too) | TR:4177-4188; keys.ts:84 | — |
| Esc | closes the phone overlay (a mode on the layer stack) | TR:2269; keys.ts:68 | — |
| The ladder's own keys | **none**: rows are canvas (aria-hidden, PP:1942), not reachable by keys; grip and sash are not focusable | PP:1913-1941 | gap vs the house rule "a row a click opens also opens from the keys" (CM:426-427) |
| **Phone peek** | at the plot's foot: the three strikes nearest the price, signed net in amplify/absorb ink, "Strikes ›" (`data-ladder-peek`) | TR:1923-1924, TR:3068-3077 | reads `rail.rows` (live book / replay column) |
| **Phone overlay** | the ladder laid over the chart's right side, 340 px up to 82%, its own `bg-panel` ground; keys go in to its first button and back to the peek; × or Esc closes | TR:2262-2296, TR:3464-3540 | **measured** 308 of 378 px (area-c.md:83) → mid tier |
| Guide on the phone | opens with the overlay whatever the stored flag | TR:3543-3553 | — |
| Expanded pane | the ladder at 520 (full tier); the desk bar clears it | TR:4388 | — |
| Pop-out | the same Pane with the desk's palette and cut; its keys unwired (approval 14) | TR:4748-4810; AU:381 | — |

### 3p. What the chart reads off the ladder's data (coupling the port must keep)

| what | where |
|---|---|
| `levels` (held walls, flip, supreme, spot) → the chart's levels, axis chips, decision strip "Nearest", level alerts | TR:2910, TR:1926-1929, TR:1936-1964 |
| `legsNow={legs}` → the bead card's calls/puts on the newest column | TR:2964; SC:6693 |
| `fitCandles={8 * railData.step}` → the 8-strike floor of the price axis | TR:2984 |
| `step` → the replay's step | TR:1457 |
| `data-plot-inset` (head + key + column heads + ▲ line) → StrikeChart's fit margins so no strike row hides under the head | PP:1946-1949; SC:2430-2504; CM:779-786 |
| `projectionRef` ← the chart (the ladder only reads it) | TR:2947; SC:2775-2780 |
| `focus` both ways | TR:2941, TR:3501, TR:2257-2261 |
| `rail.sure` → the decision strip's Fresh title | TR:1995-1996 |
| `peek`, `top3` off `rail.rows` | TR:1924, TR:1930 |

---

## 4. The owner's "nothing may be lost" list, mapped

| item | where it lives today | port note |
|---|---|---|
| Flow lane | PP:1363-1449 (+ chips PP:1494-1527, sash PP:528-550), lane menu PP:1845, per-pane `lane` TR:256-259 | Noah's panel has no flow lane (to be checked against the revamp's own inventory) |
| Δ from spot | PP:1467-1485 (wide column), read line PP:1750-1756, card PP:1678-1681 | at thin tier only in the card (and the read line from 240 px) |
| Phone overlay | TR:2262-2296, TR:3068-3077, TR:3464-3540 | keep the peek, the ground, focus in/out, Esc, × |
| R key and Strikes button | TR:4136-4147, TR:4484-4500; keys.ts:83, 100 | also Shift R, the × handing focus to the Strikes button |
| UW comparison | today: the ladder **is** UW live; How sure "Model agreement" (TR:1661, HS:176-182), "How fresh" (LV:446-450), window line (TR:2017-2026), bead card `measuredAt` (TF:231-250, SC:6681), day panel UW end-of-day book (TR:1879-1918) | approval 1: the field's figure on the row, UW's 60-day figure beside it, labelled (the card where a row cannot hold it) — `measuredAt`'s every-expiry fallback breaks that definition |
| Also on the current ladder | σ column, spot chip, flip rule, wall stripes, supreme wash, ▲/▼ counts, ghost at open, ghost dots, spine through the flip, Vol underlay with VPOC, How sure, How to read, Expiry card, Net/Sides, the sash, the grip, the 40% cap, rest widths, tiers, the read line, the hover card, click-to-keep shared with the chart, paper/dark ground, colour vision, tween/mirror | each needs a home in the new panel or an explicit "drop, ask the owner" |

---

## 5. Tests and proofs that touch the ladder

### 5a. scripts/terrain-ui-proof.mjs (`npm run terrain:check`) — checks that read or drive the ladder itself

Almost every check sets `ladder: true` on its pane (so the ladder stands beside the chart and its head feeds
`data-plot-inset`); the ones below **read or drive the ladder's own elements**:

| line | check name | what of the ladder it reads |
|---|---|---|
| PR:524 | `colour vision: the ovals and the ladder follow the blue-orange pair, on black and on paper` | the ladder canvas's pixels of the chosen pair vs the standard pair (`[data-profile-panel] canvas`) |
| PR:576 | `ladder: the key names what is drawn, the Δ wears its direction, the card prints one sign` | `canvas[data-key]` in Net and Sides; Δ green/red pixels; the 3-pane Sides hover card `[data-profile-card]` with no "++" |
| PR:978 | `phone: the ladder lays over the chart on its own ground, the keys go in and back, How to read opens, the tools are a sheet` | `[data-ladder-peek]` (or `[data-narrow-ladder]`), the overlay's position/ground/width, focus in and back, `[data-profile-guide]` → `[data-popover-card="profile-guide"]` |
| PR:1136 | `canvas words: the cone tag, the session phases and the VPOC at 11 px, the tag through the house formatter` | the Vol switch (`button[title^="Volume profile"]`) and the VPOC word's size |
| PR:1156 | `Net view: the puts lean left of the centre line, as the Sides view and the spine keep them` | violet left of gold on the Net canvas |
| PR:1183 | `ladder: a drag of the width grip pins no strike` | `[data-profile-grip]` drag, the chart's `focusStrike` |
| PR:1416 | `guide: How to read speaks gold and violet, never orange and blue` | `[data-profile-guide]` → the guide's words |
| PR:1632 | `ladder: a drag of the lanes' sash pins no strike; the Net view heads its Δ column; a lane name stands only where it fits` | `[data-profile-split-grip]`, `[data-lane-head]` widths ≥40 px, the canvas word `^Δ SPOT` in Net |
| PR:1897 | `lists: the expiry windows and the replay paces offered on screen are the ones they were, from one list each` | the Expiry card in the ladder's head (`[data-dropdown="terrain-expiry"]`) and its words, including "All 60 days … The ladder keeps Unusual Whales' book on every expiry." (PR:1844-1850) |
| PR:2320 | `inks: the reader's colour vision reaches the chart's chrome — blue and orange on a dark tape, high contrast on a light one` | the box's tokens the ladder reads its words off (stated in its comment, PR:2316-2318, PR:2338) |

Checks that keep `ladder: true` only as part of the desk (the ladder's head height feeds the fit and the hover offsets):
axis (PR:81), hover (PR:201), level card (PR:240, PR:1750), replay (PR:280, PR:322, PR:799, PR:1339), gaps (PR:357),
replay door (PR:404), keys (PR:439), jump (PR:649, PR:677), indicators (PR:723), scripts (PR:773, PR:1211, PR:1296,
PR:1323), full screen (PR:829, PR:1856), day panel (PR:863, PR:1705), 1D view (PR:907), layouts (PR:941), pane chips
(PR:1006), pin (PR:1021), regime at night (PR:1055), hover row (PR:1072), T key (PR:1093), Move box (PR:1201 — blocks
`/spot-exposures/strike`, so no book), replay pick (PR:1366), field words (PR:1386), volume (PR:1399), pop-out
(PR:1430), menus (PR:1445, PR:1563), drawings (PR:1487), note (PR:1681), cone readout (PR:1795), inks (PR:1967,
PR:2186, PR:2382, PR:2466, PR:2528, PR:2586, PR:2677), reset (`RESET_PANE`, PR:2748). Not touching it: `rail: the change
wears the true minus` (PR:1109).

### 5b. Other proofs and scripts

| file | what |
|---|---|
| scripts/orbs-proof.ts:209-214 | §5 "the ladder's terms teach its colours as gold and violet, never orange and blue" (terms 'Size at a strike', 'Net at a strike', 'What a move forces') |
| scripts/landing-acts/terrain.mjs:8-29 | the landing's Terrain film presses `[data-profile-view="net"]`, `[data-profile-view="ladder"]` and points in `[data-profile-panel]` — re-film if the selectors change |
| scripts/terrain-exercise/area-a.mjs, area-c.mjs, area-b.mjs | the audit's recorded runs (area C is the ladder: rows C-01…C-61, AT:391-461) |
| scripts/perf-sweep-proof.mjs:227 | waits for `[data-profile-panel] canvas` on `/pinpoint` (map) — **stale**: ProfilePanel is mounted only by Terrain now (grep finds `data-profile-panel` produced only at PP:1909) |
| scripts/_tmp/*.mjs | scratch scripts (align.mjs, looks.mjs, phone-stress.mjs …) reading the ladder; not part of `npm test` |

---

## 6. House rules in .claude/CLAUDE.md that bear on the ladder (quoted)

- **Ground** — CM:46-49: "A Terrain pane is a dark island whose chart AND ladder follow the pane's own ground … on a
  light ground ProfilePanel (`ground`) reads its inks as tokens and uses the paper ramps, and [data-chart-frame] joins the
  light chart-chrome rules; its How-to-read guide stays a dark card."
- **Tokens** — CM:39-42: "every colour is a token … a canvas or a chart option reads resolveInk/readToken. White
  hairlines, bands and washes are rgb(var(--ink) / a) — a literal white only inside a data-theme="dark" island."
- **The type floor** — CM:434-437: "no word under 11 px in the terminal; a chart's ticks may be 10. The house grid heads
  are 11 px in sentence case, no tracking … The "How to read" guides' drawings set their words through `ui/GuideSvg.tsx`".
- **One way to say a figure** — CM:438-440: "every figure goes through it … Never a toFixed of your own on screen."
- **How sure** — CM:518-521: "HowSure … on … Terrain's ladder head as HowSureBook, ProfilePanel `sure`".
- **Overlays / phone** — CM:573-574: "below lg a Strikes door lays the ladder over the chart" (**stale**: that door was
  deleted with approval 3, commit 40b297e; the peek is the door now — CM:1039-1040).
- **One price** — CM:755-760: "ONE PRICE ON TERRAIN — the pane head, the ladder's Δ spot and spot band, the chart's
  last-price capsule and the rail print the same current price … THE FLIP IS THE LINEAR ZERO CROSSING … the ladder's
  spine passes through it".
- **The fit** — CM:779-786: "on a fit the right scale's margins are the measured chrome band's height — the pane head,
  the HEAVIEST row and the toolbar row, and the ladder's head beside it (ProfilePanel's `data-plot-inset`, the same
  frame) — over the pane's height, plus 6 px (StrikeChart `applyFitMargins`, FIT_GAP_PX)".
- **Windows** — CM:927-928: "The ladder in a window is UW's 60-day book by partition (the recorder's books60 `parts`,
  `book60Window`), every expiry with How sure saying so until a read carries them".
- **Replay** — CM:948-950: "the levels, the ladder and the axis labels are the field's column at the cursor (`frameAt`,
  the store's own summary), no column → "—", never the price. NEVER A READ PAST THE CURSOR"; CM:957-958: "The ladder's
  ghost dots (10 filled, 30 fainter, 60 a ring, on the spine's scale) come off the same source the ladder reads — columns
  in a replay, the books read live — never mixed."
- **THE TERRAIN UI PASS** — CM:987-998: "ONE σ_remaining: THE LIVE STRADDLE's 1σ to the close (… the strip's distances,
  the axis chips, the ladder's σ column, the hover cards and the cone all read it) … A LABEL SAYS THE MEANING, never the
  bare sign ("calls absorb −$2.1B", never "negative" — in the house's sign a negative net is the calls'). THE KEYS stay the
  house's (P replay, R rail, …) … The ladder has a Net / Sides toggle, Net by default." (Its "THE GAMMA PAIR IS
  EMBER/GLACIER EVERYWHERE" at CM:991-992 is superseded by the orbs, below.)
- **PASS 2** — CM:1023-1025: "THE LADDER: Net by default (tabs Net | Sides), Δ spot and σ in the strike column, the Net
  view a diverging bar with the figure at its tip, the read line's distance in $, % and σ (ProfilePanel `sigmaRem`).
  EVERY FIGURE ON SCREEN goes through core/format."
- **PASS 3** — CM:1039-1040: "THE PHONE: … the ladder's PEEK at the plot's foot (the three strikes nearest the price)
  opens the ladder".
- **Section A** — CM:1045-1047: "THE WALLS WEAR THE GAMMA PAIR everywhere a wall is named — the call wall glacier, the
  put wall ember (… ProfilePanel's inks); BULL/BEAR IS DIRECTION ONLY" — **the hues superseded** by the orbs (CM:1100-1104:
  call wall gold, put wall violet; PP:311-314 already follows the orbs).
- **The orbs' colour** — CM:1100-1108: "THE COLOUR IS ONE MEANING EVERYWHERE — the ovals, the ladder's bars (heatmap.ts
  HEAT_MODE 'gold-violet'), the legend, the wall chips, the axis labels and the regime strip: GOLD = ABSORB (the calls'
  side, --absorb 232 185 74 / paper 158 114 0) and VIOLET = AMPLIFY (the puts', --amplify 128 100 247 / paper 91 60 230 …)
  … the rails' Colours default to House (… Thermal stays a pick) … under data-cvd="blue-orange" a paler gold and a redder
  violet stand off the blue and orange candles". CM:1112-1114: "A CLICK on a node or on the ladder's strike PINS it
  (Terrain's focus, `onPinStrike`)".
- **Walls from the book** — CM:1141-1143: "A PRICE CROSSING A WALL NEVER MOVES IT: the wall's STATE says it — `broken`
  … `reclaimed` … (… the plot's chips …, the axis chip's third line, the card)" — the ladder is not on that list today.
- **The data feed rule** — CM:593 onward (THE UI IS THE OWNER'S; THE FEED FILLS IT): "a page draws THE SAME BOXES … with the keys in … as
  with them out … Only where no input exists on the plans does a figure show "—" — in its own place, its panel standing."

---

## 7. The audit's open items about the ladder (docs/terrain-audit-2026-10-15/README.md)

- **§6c (AU:163-198)** — the ladder and the chart disagree: sign agrees 10 of 10, size within 1% at 0 of 10 (1m) and 1 of
  10 (5m). Causes: time (UW figured after the bell vs the field's 3:59 pm minute), model (−12% to +44% a strike), universe
  (≤3%; the "All 60 days" label is untrue for the ladder), 5m+ cells are the bar's peak minute. Recommendation: the ladder
  reads the field's column at the minute the chart shows, UW's figure beside it (read line, hover card, How sure). Still
  open as audit rows **6c-1m and 6c-5m** (AT:460-461, AT:609).
- **§6f (AU:217-268)** — the type scale proposal (approval 2). Ladder specifics: "The 29 sub-11 px words go to 11 (the
  ladder's 9 px figures are the most of them: the thin ladder on three and four panes then prints figures only from a ~20
  px row pitch, the hover card carrying them below that)" (AU:253-256); "20 on the ladder's canvas" (AU:229); tracked
  capitals (AU:234); proportions table — ladder rests 520/340/240, never past 40% (AU:263); "ladder rows vs the chart's
  strike rows … measured … 57 of 60 hovers … the 3 misses are one strike (766, one pane) on the ladder's lowest drawn row,
  which named 767" (AU:267).
- **§6j item 1 (AU:423)** — the ladder's source → approved.
- **§6j item 2 (AU:424)** — "the ladder's 9–10 px heads and figures to 11" → approved.
- **§6j item 17 (AU:440)** — "The ladder's lane names stand only from a 640 px ladder … below it the column heads name the
  lanes … so the lane's own tooltip is not there" → recommended "a second head row for the names when the first is full"
  → approved.
- **§6i (AU:370-372)** — ProfilePanel's dead paths (pin, unsized host, flip caption branches): deleted in 40b297e.
- **§6k (AU:459-465)** — the queue order: "… then 15 and 17; 6 and 8; 1; 7; 9, 10 and 14; 12 …; 16; 2 (the DOM, then the
  canvas)". The owner's new order (this task) puts the port after the colour rule and the node look, then 1, 2 and 17 on
  the new panel.
- TABLE rows still worth carrying into the port's checks: C-01…C-61 (AT:391-461), especially C-04 rows follow the chart,
  C-07 Net/Sides sides, C-15 key names only what is drawn, C-16 Δ head, C-23 Δ/σ inks, C-29/C-29b keep vs drag, C-32
  card, C-33 peek, C-35 phone overlay, C-38/C-38b How sure in a replay (the ladder is absent at a cursor minute with no
  column), C-48 How sure's walls equal the ladder's.

---

## 8. Defects and rule breaks in the current ladder (do not port them)

| what | where |
|---|---|
| Canvas words under 11 px: key 10 px (PP:872); column heads 9 px (PP:931, 939, 942); flip caption 9 px (PP:1075); figure-in-capsule 9/8 px (PP:1117-1119); chip width font 10 px (PP:1143); level-name font 9 px (PP:1147); figure width font 9 px (PP:1149); Net figures 9–10 px (PP:1176, 1201); leg figures 9 px (PP:1285); NET column 9 px (PP:1300); strike 10 px (PP:1463); Δ/σ 9 px (PP:1473); ▲/▼ counts 9 px (PP:1488); level chip 10 px (PP:1509); spot chip 10 px (PP:1537) | approval 2 |
| Capitals on the canvas heads ("NET GAMMA", "◂ PUTS · CALLS ▸", "STRIKE", "Δ SPOT", "A MOVE FORCES") | PP:937-961 |
| Tracked capitals in the DOM: the card's PUTS/CALLS/NET/OPEN INT/SINCE OPEN | PP:1697, 1708, 1716, 1720 |
| Tracked capitals on the Vol switch; the desk's Strikes button | PP:1852; TR:4494 |
| Weight 700 in many canvas fonts and the card's strike | PP:931, 1176, 1201, 1300, 1463, 1537, 1674 |
| Colour literals outside tokens in the dark set and the card's shadow | PP:133-136, 258-291; PP:1670 |
| `book.spot.toFixed(2)` printed in How fresh | LV:449 |
| `measuredAt` falls back to UW's every-expiry book (approval 1 says the 60-day book) | TF:243-249 |
| "All 60 days" labels a ladder that reads every expiry | TR:484 vs TR:1393-1394 |
| The ghost ratio is the field's, applied to UW's rows | TR:2398 + PP:1320-1326 |
| Replay: no legs; Sides falls back to one-sided nets | TR:518; PP:1228-1233 |
| History: the ladder ignores the viewed minute | TR:1468 |
| Volume profile always the latest session | PP:562; data/volumeProfile.ts:138-141 |
| House date cut: ghost dots from the whole book's history | TR:2083 |
| Broken/reclaimed absent from the ladder | TR:1469-1490 |
| Thermal: red/blue on the ladder while the ovals stay gold/violet | PP:124-128; HM:541; AT:394 |
| Rows not reachable by keys; grip/sash not focusable; view tabs and the guide door without `.hit` | PP:1942, 1915-1941, 1888, 1830 |
| At thin tier in Net with bars ≥8 px, Δ from spot appears nowhere (computed, not measured) | PP:616, 1174, 1643, 1650 |
| The guide describes the Sides view though Net is the default | PG:265-266 |
| CLAUDE.md line about an under-lg Strikes door (deleted) | CM:573-574 |
| perf-sweep-proof waits for the ladder on /pinpoint | scripts/perf-sweep-proof.mjs:227 |

---

## 9. Related components already in our repo (worth knowing before porting Noah's)

- `src/components/gex/ExposureMatrix.tsx` (357 lines) — our copy of Noah's matrix from 2026-09-28: one row a strike,
  PUT · CALL · NET per greek with a figure and a bar (its header, lines 1-31). Hosted by
  `src/components/gex/ExposureField.tsx` (Calendar · Matrix views, ExposureField.tsx:231-232, mounted at :1061), which
  Pinpoint's Map (src/pages/pinpoint/MapDesk.tsx:289) and Pulse's registry (src/pages/workspace/registry.tsx:193) use, and
  which reads `Simulator.snapshotFor` / `market.snapshotFor` (ExposureField.tsx:574, 589, 610). It is not on Terrain.
- `src/components/gex/ExposureLadder.tsx`, `ExposureLedger.tsx` — other rooms' ladders; they exclude
  `[data-profile-panel]` from their outside-click handlers (ExposureLadder.tsx:424, ExposureLedger.tsx:416,
  ExposureMatrix.tsx:161).
- What the field's model computes per strike per minute today (src/data/feed/trailModel.ts:589-640): each contract
  priced by `blackScholesGreeks` on UW's vol convention, then summed per strike as call gamma `gc`, put gamma `gp`, call
  delta `dc`, put delta `dp`; it STORES `value` = −gc + gp (net gamma, house sign), `gross` = gc + gp, `dex` = −dc − dp
  (trailModel.ts:640; the window view the same, :669). So **the put and call gamma legs are recoverable exactly** from a
  column as gp = (gross + value) ÷ 2 and gc = (gross − value) ÷ 2 wherever `gross` is kept (store format 2 onward,
  CM:1069) — the replay's missing legs (fact 4) need no new data. The pricer also returns vega, vanna, charm, theta
  and rho (src/core/greeks.ts:84-105) but the model neither sums nor stores them, so a matrix column for vega, vanna or
  charm would need the model extended (same inputs, same sign) or computed on the page from the same universe — not
  available off a stored column today. `vex` exists on the type (src/types/market.ts:76-77) but the model does not fill
  it (trailModel.ts:640). Charm-to-close drift is stored per partition (`drift`, CM driftToClose; trailModel.ts:642).
