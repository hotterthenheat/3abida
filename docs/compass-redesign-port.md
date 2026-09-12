# Compass Redesign Port — slayersfinal Recon & Extraction Plan

Recon date 2026-08-04, against partner repo @ ddc0174 (merged that morning —
same build as Noah's screenshots). Rule of the port, unchanged since July:
**his information architecture, our grammar, our engine seams.** Nothing
below imports his code verbatim; everything is rebuilt inside our doctrine.

---

## 1. Verdict in one paragraph

His Compass is the best surface he's shipped: a real two-axis board (contract
tenor × scanner lens), an honest score-floor line, a genuinely excellent
derived-premium chart, and a Lotto desk whose risk language matches the math
spec. It is also, under the hood, still sim theater on the exact axes ours
isn't: a 194-name cosine-walk universe, a hand-tuned geometric scorer whose
floors mean nothing off that field, no clock injection, no universe injection,
and two pricers that disagree by 16–77% on the same contract. We take the
skin and the handful of genuinely portable primitives; we keep our engine,
seams, and ink.

## 2. What we adopt (the IA)

1. **Tenor axis as a first-class board dimension.** Sleeves 0DTE / Weekly /
   Swing / LEAPS (+ Structures later) across the top with REAL dates from the
   calendar ("0DTE · 08/04/26"), scanner tabs as the second lens with live
   counts. This makes the Weigher horizons visible on the scan board and maps
   1:1 onto the backtest spec's sleeves — UI and math finally speak the same
   axis.
2. **The honesty line:** "Showing 240 of 275 scoring 84+" — display cap,
   total found, and score floor stated in one breath. Floors become OURS to
   set (his 84/82/78/76/72 are calibrated to his synthetic field; ours get
   calibrated by evaluation once the journal runs — until then they're
   Heuristic-labeled constants).
3. **Card anatomy:** rank · contract pill · real-date expiry chip · coverage
   badge · TOP PICK (rank 1 only — matches our magenta-scarcity rule) ·
   state pill · four-stat grid (Score / Health / 1σ Move / Mid) · why-chips ·
   "Breaks below $X" invalidation line · Analysis. Cards/Table toggle,
   24/page pager.
4. **State machine (portable as-is):** WAITING / ARMED / TRIGGERED /
   INVALIDATED, derived per render from verdict + |delta| ≥ 0.50 (the taken
   line). Observational, no stored transitions. Process states never wear
   bull/bear ink — his rule, identical to ours, keep.
5. **SetupCompare right rail:** WHAT IT COSTS (cost · book "1.9% wide · $12
   to cross" · 1σ · health) / WHAT IT PAYS (two rungs, horizon-named:
   Session Target / Momentum Exit on 0DTE) / WHAT KILLS IT (level + distance
   from the sweep's spot) / NEAREST RANKED (7 peers, same-name first).
   Plain-English block headers are exactly our RichRead register.
6. **ContractTrack — the crown jewel.** Contract premium as a DERIVED series:
   past = repriced on real 1-min underlying bars, forward = spot held, only
   time runs (theta made visible), NOW pinned to the printed mid, premium
   targets inverted to watchable underlying levels via bisection, out-of-scale
   rungs docked as carets, "not a traded tape" enforced in the model note,
   relative time only. **Port with ONE pricer — our core/greeks BS —
   everywhere.** His hardest problem (two pricers disagreeing 16–77%, solved
   with byte-copied cores pinned by tests) evaporates when the terminal has a
   single pricing authority. This chart is the UI face of the backtest spec's
   scenario-repricing stage; when ThetaData lands, the past half becomes a
   real tape with zero redesign.
7. **Lotto desk upgrades:** per-name auction-read strip (actionable first),
   PLAYBOOK sentence (direction read off the CLASSIFICATION, not the raw
   imbalance side — two of four classifications argue the opposite side),
   honesty disclaimers gated on the MOC clock, **the total-loss acknowledgment
   gate** ("I accept a total loss, show the board" — remembers WHICH DTE
   product was accepted), "AUCTION COVERS 2.6x" badge (auction-implied move ÷
   this strike's breakeven need), at-the-pin flag, evidence panel. The ack
   gate + "size for a total loss" language is the math spec's Lotto mandate
   (§21.8) already realized — adopt.
8. **HELD-from-sweep state:** a row the newest sweep no longer ranks keeps
   the grade it was opened with, visibly dated ("Held from the 21:23 sweep").
   Same bug class we fixed in the drilldown (never re-derive an open row);
   this is the scan-board version. Adopt.
9. **`?view=` URL param** for pane + scanner presets (replace, not push).
   Bookmarkable boards. Adopt.
10. **mocClock:** session/half-day-aware MOC window (last 15 min of the real
    session, ET-resolved, holiday/half-day proof, pinned by a strong test
    file). Adopt over any hardcoded 15:45 logic.

**Sleeve ink concept: adopt, one change.** His tenor tabs are colored by the
clock, hot→cool (0DTE amber → LEAPS sky), from existing tokens only, never
directional — good doctrine. But he inks Structures with KING magenta, which
our rules reserve for engine standout (TOP PICK). Ours picks a different
token for Structures when it lands.

## 3. What we do NOT port (theater + things ours does better)

- **The scan engine.** `rankOf` geometric preference, cosine-walk universe,
  `nameEdge01` (whose "depth" term reads the simulator's own registration
  state), floors tuned to a 194-name synthetic field. Ours keeps
  `buildCompassView(snapshot, scanner, universe)` — the injected-universe
  seam his build lacks — and grows toward the spec pipeline (EV → Utility →
  percentile) per docs/compass-backtest-spec.md.
- **healthFor** (moneyness ±900/pct + noise, clamped 22–78) — we adopt the
  Health SLOT with the honest subtitle ("50 is at the money…") but compute it
  from moneyness cleanly, noise-free, and keep the door open to the spec's
  real quality inputs later.
- **spreadPctModel / TIGHT BOOK** — a distance model wearing a book's label.
  Ours renders book chips only from actual bid/ask once real quotes exist;
  sim keeps them clearly modeled.
- **estimatePremium** — normal-shaped approximation, disagrees with BS by
  16–77%. Dead on arrival; one pricer.
- **statereplay.ts / edgeledger.ts** — outcomes sampled from their own
  predicted probabilities; a ledger generated from a hardcoded win-rate
  table. NOT records of anything. **But port the test PATTERN:** his
  anti-fabrication copy suite (banned regexes: \bbacktest\b, \bobserved\b,
  \bout-of-sample\b… applied to every rendered string AND the JSX source) is
  the cheapest honesty enforcement we've seen — our journal/backtest UI
  should ship with the same suite.
- **His replay gaps stay his:** no asOf injection (expiryFor called with
  wall-clock today in scoring), dayKey on LOCAL time vs an ET session clock,
  universe imported at module init. All three are the seams we already built
  (core/clock.ts, calendar through the clock, injected universe) — validated
  independently by this recon.

## 4. Defects found in his build (hand to the partner)

1. **Lotto badge vs number mismatch:** displayed grade = composite + auction
   adjust (±18), but the QUALIFIED/WATCH/FADED badge and the "n of 6 qualify"
   count read the UN-adjusted composite. A row can print "62 → 78" and badge
   WATCH.
2. **"AUCTION COVERS" is unsigned:** it uses |displacementZ|, and the row
   component is reused for the "Against the auction" list — a counter-auction
   ticket shows the same "covers 2.6x" badge though the displacement points
   against it. Reads as directional edge; is a magnitude ratio.
3. **dayKey is viewer-local, the MOC clock is ET:** west of ET the whole
   auction read re-rolls 3h after the ET date turns; east of it, part of
   every session is seeded on tomorrow's key.
4. **normalizedZ isn't normalized:** the liquidity term algebraically
   cancels (imbalance = biasDir·liq·k; z = imbalance/liq = biasDir·k), so
   it's bounded ±[0.30, 1.70) by construction, the "σ" label overstates it,
   and the BALANCED branch is unreachable (dead code).
5. **core/fracture.ts has zero tests** — the whole MOC read is unpinned
   (notable in a repo that pins nearly everything else).
6. **"Showing" numerator vs its own tooltip** disagree when the ticker
   filter is active (rankedSetups.length vs data.shown).
7. **Imbalance magnitude is seeded ticker-only** (no day term) — a name's
   auction imbalance dollar size never changes across sessions; only sign,
   growth, absorption re-roll.

## 5. Decisions for Noah before the build starts

- **D1 — Dossiers vs uniform board.** His board is uniform across all
  sleeves; our Weeklies/Swings render as campaign dossiers (a layout Noah has
  rejected twice). Proposal: go uniform board + ContractTrack analysis
  everywhere, retire the dossier layout, keep the dossier's *fields* (TP
  ladder, floor rule) inside the Analysis view. Confirm.
- **D2 — MOC model source.** We have data/moc.ts (with a publications strip);
  he has fracture.buildMoc (deleted his synthesized publications strip on
  honesty grounds — one growth term, no fake print history). Both are
  synthetic. Proposal: keep OUR moc.ts read but adopt his single-growth-term
  honesty (drop any fabricated 3:50→3:58 bar detail until a real imbalance
  feed exists) and his classification cascade shape. Confirm.
- **D3 — Structures sleeve.** His 5th sleeve (defined-risk multi-leg,
  core/structures.ts — real math, 8 shapes, sampled payoff curves) is a NEW
  product surface for us. Not in this port's scope; queue as its own arc?
  (Journal note: multi-leg eventually wants a STRUCTURE instrument or the
  spec's StrategyLeg[] — additive, not now.)
- **D4 — Weigher layout choice** — explicitly deferred by Noah; compare his
  ContractWeigher (free-text contract query parser is genuinely nice) vs ours
  after the Setups/Lotto port lands.

## 6. Build order (once decisions land)

1. Sleeve/tenor axis on our Compass (types + calendar already carry it).
2. Setups board v2: SetupScanBoard/Card IA + honesty line + state machine,
   fed by OUR buildCompassView; our ink (direction on contract pills and
   1σ/expected-move; magnitude on score; achievement color only for real
   states; feature chips stay quiet).
3. SetupCompare right rail (absorbs the current review panel).
4. ContractTrack, one-pricer edition.
5. Lotto desk v2 (ack gate, covers badge with SIGN, auction strip), his
   defects fixed on arrival.
6. Anti-fabrication copy test suite over the new surfaces.
