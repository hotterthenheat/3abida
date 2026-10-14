# The Terrain UI pass (2026-10-14)

The owner's prompt: "a trader answers five questions in under 2 seconds without hovering: regime, nearest levels, how
much of the priced move is used, the level's track record, and data age." Read the code first, reuse it, every number
from what the app computes; a field with no source is left out and listed here.

## The owner's decisions (2026-10-14, after the code was read)

1. **σ_remaining = the store's live straddle** (the Oct 13 rule): the strip's distances, the axis chips, the ladder's
   σ column, the hover cards and the cone all read it. The formula σ_day × √(1 − used) is a fallback only where no
   straddle exists, labelled "budget". The Priced move box shows both as separate lines — "Market now ±$X to the
   close" and "Budget left ±$Y" — never one number made from both. The prompt's rule B is dropped.
2. **Colours**: no new hex values. Puts/calls wear the existing ember-gold / glacier-ice tokens everywhere gamma
   appears, the regime strip included (its bull/bear red/green replaced). Candles keep bull/bear; magenta stays the
   supreme's; the flip keeps its colour. Labels say the meaning, never the bare sign ("calls absorb −$2.1B").
3. **Keys**: the house map stays (P replay, R rail, 1–4 chart count, [ ] walk charts, G go-to, J/K rows). Added: T
   jump to date, W cycle the expiry window, one free key for the legend. ? and Esc stay; the ? sheet lists the real map.
4. Bead density: non-level strikes dim to about 25% when more than a session is visible; walls, flip and the heaviest
   strikes stay full at any zoom; the distance fade touches non-level strikes alone; every strike still draws.
5. The drawing toolbar shows on hover, on focus-within, and always on a coarse pointer.
6. The ladder gets a Net / Sides toggle, Net by default.
7. The phone keeps the shell's top strip — no bottom tabs.
8. The coverage bar, the blocked ranges and the year-long speed budgets wait for Phase 1 of the Theta task (the probe's
   report and the owner's "go"); the coverage bar's left edge will be the probe's first dates, never a docs date.
9. Speed budgets are a Playwright script, measured now on the 13 sessions this machine holds.
10. History on 1D keeps the rule: a bar's cell is its peak minute. The day panel shows the modeled close column, with
    UW's end-of-day book beside it as the measured reference.

## Check A — one sign everywhere (done in pass 1)

**Before**: the number was already one sign everywhere — the regime strip's bar is `netOf(snap.levels)`
(StrikeChart.tsx), the house's sign: puts +, calls −, the same as the ladder, the beads and the heaviest row; the
attribution check turns UW's sign to the house's before comparing (Terrain.tsx `regimeDir`). What disagreed was the
**colour and the word**: the strip painted a positive (puts) bar in `--bear` red and a negative (calls) bar in `--bull`
green while the ladder and beads paint puts ember-gold and calls glacier-ice; and the chip said "negative" /
"positive", which in the house's sign means *calls absorb* / *puts amplify* — the opposite of what "negative gamma"
means in every trader's mouth.

**After**: the strip's bars read `--ember` (puts) and `--glacier` (calls), and the chip says the meaning with the money:
"calls absorb −$2.1B, 37th pct of 12 sessions · attribution-robust". No bare sign anywhere gamma is said.

## Check B — the σ's (reported before any change, as the prompt asked)

| σ | What it is | Where it is computed | Who read it |
|---|---|---|---|
| σ_day | the prior close's 4:00 pm straddle on today's expiry, its vol solved, spot × iv × √τ | server/pricedMove.ts `budget` → `today.sigma`; trailModel `sigmaOf` | the ±1σ/±2σ lines, the alerts' ±σ levels, the readout's "+0.6σ" |
| σ_rem (live) | the store's newest straddle on today's expiry, solved the same way | levels.ts `PricedMoveFeed.rem.sigma` (the shown rows' `str0`); in a replay Terrain `rpMove` at the cursor | the cone (`coneOf`), the readout's "left to the close" |
| the quoted-vol cone | the feed's quoted IV, the Expected-move overlay's fallback when the priced move is not in | StrikeChart.tsx (the single-vol cone) | the overlay off the feed |
| indicator σ's | Bollinger and VWAP bands — statistical, named | StrikeChart.tsx | the indicators alone (left as they are) |
| σ_day × √(1 − used) | the budget's leftover | nowhere before this pass | — |

**After pass 1**: `pricedMove.ts sigmaRemOf` is the one σ_remaining — the straddle's where one stands, else the budget's
leftover (`budgetLeftOf`), labelled; `remLines` writes the Priced move box's two lines. The cone spreads `sigmaRemOf`'s
σ; its readout names which. How sure's "Priced move · σ to the close" prints the two lines, and the calibration under
them live (never in a replay). The strip, the axis chips, the ladder's σ column and the hover cards read the same
`sigmaRem` in pass 2.

## Check C — times

Every printed time is the reader's zone in 12-hour form since 2026-10-13 (core/nyTime.ts); nothing to change.

## Fields of the prompt with no existing source (left out, listed)

- The coverage bar "Built / Building / Pending / Blocked from Jun 1, 2012": no ledger exists until Phase 1 of the
  Theta task; the store holds 13 sessions.
- Blocked ranges and their reasons ("no rate", "no underlying"): Phase 1's ledger.
- Speed budgets over "a year of history": no year exists yet; measured on the 13 sessions.
- Bottom room tabs on the phone: the shell has a top strip; the owner kept it.

(The report's screenshots, the measured budgets and the pixels regained are added by the later passes.)
