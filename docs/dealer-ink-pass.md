# The dealer-ink pass — scope

Scoped 2026-08-22, after the chart's trails went back to the house steel-gold
and the question came up: should everything else follow?

## The problem being solved

Red and green currently carry **two meanings** on the terminal:

1. **Price direction** — candles, up/down, bull/bear verdicts, P&L, change %.
2. **Dealer side** — which side owns a strike's gamma and what dealer hedging
   does there: put-dominant / dealers short gamma / *amplify* vs
   call-dominant / dealers long gamma / *absorb*.

On most surfaces that is survivable because only one meaning is present. On
the live chart both are present at once (candles + the field), which is why
the field already moved to gold/steel. This pass makes the split the rule:

> **Gold / steel = dealer side, everywhere. Red / green = price direction, only.**

Gold = put-dominant, amplifying. Steel = call-dominant, absorbing. Magenta
stays the king, blue the flip, lime the selection, white the spot.

A side benefit: gold vs steel separates by *luminance* as well as hue, so the
dealer-side split survives red/green colour-blindness — the current pair does
not.

## Tokens (one source, two consumers)

`src/components/gex/palette.ts` (JS consumers) and `tailwind.config.ts`
(class consumers) — change together, never one alone.

| Token | Value | Role |
|---|---|---|
| `DEALER_PUT` / `gold` | `#F5C542` | put-dominant, amplify — bars, bands, lines |
| `DEALER_CALL` / `steel` | `#E2EAF4` | call-dominant, absorb — bars, bands, lines |
| `DEALER_PUT_INK` / `gold-ink` | `#F5C542` | figures and labels (gold reads on dark) |
| `DEALER_CALL_INK` / `steel-ink` | `#AAB6C6` | figures and labels — **not** `#E2EAF4`, which is indistinguishable from `textPrimary` at 11px |

`SHORT_GAMMA` / `LONG_GAMMA` become aliases of `DEALER_PUT` / `DEALER_CALL`
for one release, then go. `BULL` / `bear` stay exactly as they are for
direction.

## What migrates (dealer side → gold/steel)

| Surface | File | What changes |
|---|---|---|
| Strike Pressure Ladder | `components/gex/StrikePressureLadder.tsx` | put/call bars (`PUT_RGB`/`CALL_RGB`), net figure tone, legend swatches, hover-card legs |
| Dealer Positioning Map | `components/gex/PositioningMap.tsx` | bands (`SHORT_GAMMA`/`LONG_GAMMA`), net figure, cumulative figure, regime wash, legend |
| Exposure Matrix | `components/gex/ExposureMatrix.tsx` | put/call leg bars (`legBar`); NET stays magenta |
| Exposure Profile facts | `pages/pinpoint/ExposureProfile.tsx` | Net GEX fact tone |
| Ranked Targets (page + widget) | `pages/pinpoint/RankedTargets.tsx`, `pages/workspace/RankedTargetsWidget.tsx` | Net GEX column/podium figure tone |
| Compass contract rails | `components/compass/ImpactLeaderboard.tsx`, `SetupDrivers.tsx` | exposure figure tone |
| Chart level lines + chips | `components/gex/StrikeChart.tsx`, `palette.ts` (`CALL_WALL`, `PUT_WALL`) | call wall → steel, put wall → gold, on the chart and in the CW/PW chips |
| Key Levels widget / rail | `pages/workspace/KeyLevelsWidget.tsx`, `components/gex/KeyLevelsRail.tsx` | wall colours |
| Positioning map zones | `components/gex/positioningMapModel.ts`, `PositioningMap.tsx` | call-wall / put-wall bands |
| Vanna/Charm surfaces | `components/gex/vannacharm/MigrationMap.tsx`, `WallDrift.tsx`, `LevelShiftList.tsx` | wall lines and shift tints where they encode side |
| Campaign chart levels | `components/compass/CampaignAnalysis.tsx` | wall lines (overlay `levels`) |
| Ladder role tags | `StrikePressureLadder.tsx` (`rolesOf`) | CALL WALL / PUT WALL tag inks |
| Term dictionary | `data/terms.ts` | `Net GEX`, `Call wall`, `Put wall`, `Exposure`, `Puts`, `Calls` — mention the inks where the definition names a colour |

Roughly 16 files. The heatmap ramp module already speaks steel-gold; the
trails already do.

## What stays red/green (price direction)

- Candles and volume, sparklines, change %, `SpotPrice` ticks.
- Verdicts and states that describe **what price is expected to do**:
  dealer bias `BULLISH / BEARISH`, pressure `SUPPORT / RESISTANCE`, hedging
  class `DOWNSIDE CUSHION / UPSIDE RESISTANCE`, the heat pattern chip, the
  "moves amplified / dips absorbed" *words* (words are not ink).
- Compass: setup direction, TP hits, floor, P&L, premium change.
- Trace / tape: bullish / bearish flow, buy / sell side.
- Earnings, News, Stocks: every up/down figure.
- `RichRead`'s tone tokens (prose sentiment).

Rule of thumb when a case is ambiguous: *if the number is dollars of dealer
gamma or the identity of a side, it is gold/steel; if it is a read on price,
it is red/green.*

## Open decisions (yours)

1. **Walls.** CW green / PW red is the most-learned pair on the product. Under
   the rule they are side identities and should go steel/gold — which also
   fixes the green wall line sitting among green candles. Recommend migrating;
   flagging because it is the most visible change.
2. **Ladder put/call header captions** — gold "Puts", steel "Calls" — or keep
   them neutral and let the bars carry the ink. Recommend inked.
3. **Steel text tone.** `#AAB6C6` proposed; tune on screen.

## Order of work

1. Tokens: palette + tailwind, aliases in place. Build green.
2. The Exposure Profile trio (ladder, map, matrix) together — they sit on one
   page and must agree on the same day.
3. Net figures everywhere (profile facts, Ranked Targets page + widget,
   Compass rails).
4. Walls: chart lines, chips, key levels, zones, vanna/charm, campaign chart.
5. Legends and term dictionary.
6. Remove the aliases.

Each step ships separately; nothing is half-migrated on a given surface.

## Verification

- Grep gate: no `SHORT_GAMMA`, `LONG_GAMMA`, `text-bull`, `text-bear`,
  `bg-bull`, `bg-bear` in files listed under *migrates* except for items
  listed under *stays* (the pressure / class / bias words).
- Per surface: computed colours read from the DOM for one put-side and one
  call-side figure; legend text present.
- Contrast: gold-ink and steel-ink against `#0a0a0a` ≥ 4.5:1 at 11px.

## Estimate

About a session: ~16 files, mostly one-line ink swaps, with the map and the
ladder legends as the only real design work. Risk is low and local; the cost
is the re-teach for anyone who already reads CW as green.
