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

## Pass 2 — the header, the strip, the chips, the readout, the ladder, the cards, the type

**The one header row** (components/terrain/PaneHead.tsx; shots/live-1pane-1440.png): identity · price · change ·
Live/data-age chip · timeframe · expiry window · Today 1W 1M 6M 1Y Max + calendar · Replay · Alerts · Layers · ? ·
doors. A measured budget in the Pane (`headPlan`, Terrain.tsx) takes each part in the order a reader gains most
while the column pays — width in, content out — so nothing prints over the price ticks. Measured at 1440 × 900:

| column (px, the chart's) | what the row holds |
|---|---|
| 255 (three panes, ladders open) | the symbol chip, the price, the timeframe trigger, the fullscreen door |
| 570 (one pane, the ladder at its 520) | + the age dot, the tabs (tight), the window and the jumps as triggers, the change |
| 850 (a three-pane column with its ladder closed) | + the age's words, the tabs' names, the badge, Replay · Alerts · Layers, ? |

What the row cannot pay for stands on the hover row (the three doors, the pop-out) or behind its key (?; T and W
come in pass 3). The hover toolbar row is OUT OF THE FLOW: under the strip, over the plot, only under the pointer or
the keys (and always on a coarse pointer), so a hover moves nothing and the chrome band the chart keeps clear of is
the header, the strip and the one-line legend. The OHLC row and the HEAVIEST band are gone: the hovered bar's figures
are a crosshair readout at the plot's top-left (CrosshairReadout.tsx), each pane its own; the walls' lens chips and
the bead scale's basis and floor ride the hover row, with the new "Every strike" switch.

**The decision strip** (DecisionStrip.tsx; shots/how-sure-at-regime.png): Regime · Nearest · Move · Record · Fresh,
each a door into How sure at its own section (HowSureBook `trigger` and `focus`, the section marked with a silver
rule). It sheds by the column — labelled, figures, short words, two lines of short words — never a figure cut. The
regime's reading is ONE function for the chip and the box (trailModel `regimeReadOf` / `regimeWordsOf`), read off
the newest column when the strip is off.

**The axis chips** (StrikeChart `axisChips`; shots/live-1pane-1440.png, shots/level-chip-hover.png): CW · Flip ·
Sup · Top · PW as two-line chips on the price axis — the strike, then its distance in dollars and in σ to the close —
set at their prices each frame, pinned ▲/▼ at the clear area's edges, stacked apart, the price tag's band kept
clear; never over the candles (the in-plot "772 · 9%" chips and the library's one-line labels stand down). The gutter
grew from 74 to 92 px for the two lines. A chip's hover: the wall's moves today, how long it has stood, its touches
today (trackRecord `touchCountOf` — the study's approach rule in miniature, within 0.05%), the track record's line.

**The bead card** (shots/bead-card-pinned.png): three lines under the pointer (strike and bar, the net with its share
and side, the change since the open, "Details › click"); a click pins it expanded — calls/puts for a bead on the
newest column (the live book), the rank at that bar, the price then and the strike's distance in $ and % (σ for the
newest column), the 30-minute change, the flip, the record's line, the OI count's date, the cell's minute, provenance,
vol age, UW's book, the model — with "Replay from here" (the pane's replay on, the bar picked) and "Pin strike".

**Bead density** (gexNodesPrimitive `density`): zoomed out past a session, a strike that is no level of its column
(its walls, its three heaviest, the supreme, the focus) draws at a quarter of its light, and a non-level strike more
than fifteen steps from the column's price at six tenths; every strike still draws. "Every strike" on the hover row
draws every bead whole (`beadDensity` on the pane).

**The ladder** (shots/ladder-net-sigma.png): Net is the default view (tabs Net | Sides); the strike column prints
Δ spot and σ to the close; the Net view is a diverging bar from the centre line (puts right in ember, calls left in
glacier) with the net figure at its tip; the read line adds the distance in $, % and σ.

**The type**: every figure on screen goes through core/format — the readout, the ladder's column and read line, the
price tag, the level menu, the priced move's readout and calibration, the primitive's chips. Tabular numerals on
every figure span.

**Pixels of plot regained** (at rest, 1440 × 900): the chrome band over the plot was the pane head, the HEAVIEST
band and the toolbar row (116 px measured by the audit of 2026-10-13) plus the two-line legend (36) — about 152 px;
it is now the header (32), the strip (20, 42 where it wraps) and the one-line legend (20): 93 px on a wide column,
114 on a narrow one — 38 to 59 px regained per pane. The gutter took 18 px of width for the two-line chips.

**Fields with no existing source, added in pass 2**: calls and puts for a bead on a past column (the field keeps the
net per strike; the split exists for the live book alone — the card says so); σ for a past bar (σ_remaining is now's
straddle — the card prints σ for the newest column alone); "touches today" are counted on the chart's own bars at
0.05% (the study's rule, not the scorecard's tolerances); the OI date of a past session's column is "the count dated
that session" (the backfill's), not a printed date.

**An open question for the owner**: the wall chips wear the walls' own inks (the call wall in `--bull`, the put wall
in `--bear`, as the axis labels did); the decision said the gamma pair goes everywhere gamma appears — a wall is a
level, not a gamma figure, so they were left. Say the word and they move to ember/glacier.

## Fields of the prompt with no existing source (left out, listed)

- The coverage bar "Built / Building / Pending / Blocked from Jun 1, 2012": no ledger exists until Phase 1 of the
  Theta task; the store holds 13 sessions.
- Blocked ranges and their reasons ("no rate", "no underlying"): Phase 1's ledger.
- Speed budgets over "a year of history": no year exists yet; measured on the 13 sessions.
- Bottom room tabs on the phone: the shell has a top strip; the owner kept it.
- The pass-2 list above (calls/puts and σ on a past bead, the touch rule, a past column's OI date).

(The states, the history panel, the keys, the phone, the speed script and the rest of the report are pass 3.)
