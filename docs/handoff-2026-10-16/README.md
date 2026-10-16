# Where the work stands — 2026-10-16

Written when the owner paused the work (weekly usage at 99%) to run the site with the live keys. A new session starts
here: read this file whole, then `.claude/CLAUDE.md`. Everything below is the state at commit time; re-check with
`git log` before acting.

## 1. Pushed with this note

- The colour rule under every Colours option (d968aa2, 8367930, 20d4204, 150b8e2, 23be8fb, 4623936):
  up and down are the candles' colours everywhere (the drawing tools included), the ovals keep gold and violet, every
  other line takes the indicator palette, kept clear of the ovals and of every candle theme as seen and under
  protanopia, deuteranopia and tritanopia. The indicator palette moved to teals and aquas, pinks and magentas, an olive
  and greys (the blue EMA ribbon is gone).
- The four resets land on the identical view (caebf7e, a2ea3e9, 8f47e93, 161eb2c, 55dda0d), the Backtest's and Paper's
  Reset pill included.
- Screenshots: docs/colour-rule-2026-10-16/.
- Checked before the push: both typechecks, `npm test`, `npm run words:check`, `npm run build`, the key scan. Each
  commit's own review re-ran its terrain:check groups; the full browser suite was NOT re-run as one pass at this push.

## 2. Unfinished: the colour rule's last fix round (stopped mid-build)

Its partial diff is saved as `in-progress-F18b.diff` (the tree was put back). Its spec is in
`workflows/colour-final-fixes.js` (F18b). Still to do:
1. The highlighter draws in the ovals' gold when no ink is picked — give it a family default.
2. The uncoloured-plot default, OBV and RV sit within 3° of the gold's hue: measure proof 9a against an oval drawn at
   OVAL_ALPHA_MIN 0.8 and move them off the gold.
3. The MACD signal #F35697 is 30.4° from Market's red fall — give it a margin (≥ 40°).
4. A Long/Short position's and a price range's labels: 10 px → 11 px, figures through core/format.
5. Glacier's slate fall makes a position's risk side 1.7:1 — add the drawings to the proof's "leaves open" list.

## 3. The owner's decisions of 2026-10-16 (apply them; do not ask again)

1. **Node look: B, beads, keep the 1 px gaps.** Height = 2 px + (Hmax − 2 px) × r, Hmax = min(30% of a strike row,
   12 px), r = total gamma ÷ the session's largest so far (linear, no square root); width = the slot less 1 px for every
   node (bars under 6 px still merge); opacity, colours, grey-when-balanced, the stale soft edge, the outline from 6 px
   and the count (5 a bar + walls + flip) unchanged. The prototype is `nodes/variant-prototype.diff` (variant B behind a
   localStorage switch — build it properly, not the switch). Rewrite the orbs rule in .claude/CLAUDE.md in the same
   change. Pictures and the measured comparison: `nodes/`.
2. **Colours: the recommendations stand wherever they follow the colour rule.** Specific calls:
   - The gold on a light chart: darken it, same hue, until marks reach 3:1 and gold words 4.5:1 against the chart
     (this replaces the olive the colour-vision pair wore on paper, and fixes the unreadable gold words on Stone).
   - The indicator palette stays clear of EVERY meaning colour, magenta (the supreme's) included — move the seven
     price-pane lines near the supreme (VWAP, its bands, Bollinger, Ichimoku's conversion, the SMA, Donchian, compare 4).
   - A reader's own copy of a script keeps its code as written (undo the "unedited copy draws as the house's"
     remapping for copies; shipped and kept scripts follow the house).
   - The earlier recommendations 1–9 (Contrast's down → steel #8A93A6; Tide and Harbor's blues toward cyan;
     blue-orange applies to Contrast; Wire's down drawn dashed; faint theme inks lifted to 3:1; MACD bars in the
     candles' up/down; walls keep gold/violet; up/down outside the chart stays on the Settings pair; no tritan floor)
     are approved where they follow the rule.
   - SEND THE OWNER ONLY (each with a screenshot, in America/Chicago time): Velvet, Stone, Whipsaw, and anything where
     a recommendation breaks the rule or there is none.
3. **Noah's panel port: the plan's recommendations, except where one conflicts with the port rules** (real data only,
   Terrain's colours, the matrix only in Net, nothing lost from the current ladder). Plan: `panel-port/PLAN.md` (its
   §7 questions Q1–Q13 → take each recommendation, re-checked against those four rules), notes in `panel-port/notes/`,
   Noah's panel as it looks in `panel-port/noah/`. Source: github.com/Nuh00/revamp at 1ebc5bb (attach it with add_repo).
4. **Parallel approvals: yes**, for ones that touch separate files. Each gets its own review and checks; merge them one
   at a time, with the full check after each merge.

## 4. The order now

1. **Charm, first.** Our charm on the feed may be 3.65× too large (uw.ts ÷ 365 — 365/100 suggests a per-day vs
   per-year slip). It is a wrong number on screen in shipped work: confirm against a hand calculation, fix, and add a
   check against that hand calculation. It touches Pinpoint on the feed and the walls-heat Charm lens.
2. The colour rule's last round (§2), with the owner's colour calls (§3.2).
3. The node look, B beads (§3.1).
4. Noah's panel (plan units U0–U10), then approvals 1, 2 and 17 on the new panel (U7–U9).
5. In parallel where files are separate (§3.4): approvals 6 (key levels switch), 7 (one alert system), 8 (one meaning of
   "heaviest"), 9 (session chip), 10 (toasts never cover controls), 12 (drawings per ticker), 14 (pop-out keys),
   15 (indicator values in the readout), 16 (replay any day), and the Trace/Compass autoscale fix. Their specs are in
   `workflows/terrain-approvals-grouped.js` (UNITS).
6. The faults below (§5).
7. The full measured Terrain audit; Section I (I-2's remainder, I-3, I-4); Sections D, E, F.
8. Items 4a and 4b wait on the owner's `npm run theta:probe` report.
9. **Landing films: leave until the UI is finished.**

## 5. Faults to fix (from the SPY 5m shots and the owner's list)

- The pre-market note gives the wrong reason ("first chain read, 1:00 am", yet nothing draws until 6:30 am). For SPY
  the reason is that its options trade only in the day session.
- The after-hours stretch has no note.
- The Reset pill sits on the PW 765 row.
- AAPL: check whether Cboe's single-stock 7:30–9:25 am and 4:00–4:15 pm New York sessions are live and in our data; if
  so, AAPL's field covers them (core/sessions.ts).
- The price axis's top label sits under the pane head (reads "2776.00").
- The gold words on the light Stone chart are unreadable (fixed by §3.2's darker light-theme gold).
- The invisible Esc layer that eats the first Esc in full screen.
- The hover card landing two bars off the pointer (seen intermittently: same strike, two bars over).
- The replay crash: fix the ordering, not just the guard.
- A check for barcolor re-dressing the candles on a theme change.
- The browser suite run at fixed clock times instead of the wall clock.
- The stale Pinpoint speed check (scripts/perf-sweep-proof.mjs:227 waits for a ladder Pinpoint no longer mounts).
- The last two items of the resets review (nits): words pushed off the Reset pill can settle under a replay strip;
  with a compare's left scale the pill's keep-out stands 56 px right.

The status of the five the owner added (Esc layer, hover two bars off, replay crash ordering, barcolor check, fixed
clock) was not re-checked before this note — check each first; none is known fixed.

## 6. How the work runs (keep)

- Every change lands on claude/trusting-planck-o77m11, pushed after typecheck, `npm test`, words:check, the build, the
  related terrain:check groups and the key scan. No branches, no PRs.
- Each unit: build → an independent adversarial review (it re-runs the checks and proves each new check fails on the old
  code) → fixes, up to three rounds. The workflow scripts in `workflows/` hold the shared ENV text and specs.
- Screenshots sent to the owner are taken in America/Chicago time.
- The dev server for checks runs on 5180; never two dev servers on one node_modules/.vite; never start a Theta Terminal
  in a workspace.
