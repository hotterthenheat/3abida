# Compass Backtest Spec — Partner Math, Deciphered

Source documents:
- **Spec A** — "Corrected Mathematical Specification" v1.0 (Aug 2026)
- **Spec B** — "10 of 10 Research Engineering Standard" v3.1 (Aug 2026)

Read order: **Spec B is canonical.** It states it "consolidates and corrects the
user-provided Slayer drafts and the prior two generated editions" — Spec A is an
earlier layer of the same project. Everything in A appears in B, usually sharper.
Cite B's section numbers below (§).

Scope guard: per project decision, **only Compass is being backtested.** Pulse /
Pinpoint / Trace math in the docs matters to us only as *inputs* to the
FeatureSnapshot. The backtest protocol itself lives under the doc's "Prove It"
chapter (§10, §22) — the protocol applies to any harness; the Prove It page
itself stays untouched.

---

## 0. Honest verdict (read this first)

**What these documents are:** a measurement and honesty standard, written to a
professional level. Internally consistent, correct conventions, real citations
(Black-Scholes, Breeden-Litzenberger, López de Prado, conformal prediction).
The "prohibited shortcuts" table (§49) alone is worth the read.

**What they are not:** a strategy. There is not a single entry rule, threshold,
or coefficient anywhere in ~6,000 lines. Every model is specified as "estimate
these coefficients against this label on timestamp-correct data" — the
coefficients don't exist until we have data and outcomes. So "the math" is
really **the method**. Nobody can implement this and start printing signals;
you implement it and start *learning*.

**Scale mismatch, stated plainly:** the full standard specifies 15 production
services, particle filters, champion/challenger MLOps, SLO tables, and chaos
drills. That is a multi-year, multi-person quant build. It would be a mistake
to treat the whole document as a to-do list. It would be an equal mistake to
dismiss it: the doc contains its own minimum path (§48 implementation
sequence) and its four status labels (**Identity / Heuristic / Estimated /
Calibrated**, §"Document status") explicitly permit shipping honest heuristics
while data accumulates. That's the door we walk through.

**Trust note:** the doc corrected its own arithmetic between versions (GEX
fixture −1,977 → −1,764 shares; EV fixture $74.25 → $74.00, §60) and mandates
that "all published arithmetic is generated or verified by code, never typed
from memory" (§57). We follow that rule against the doc itself: every fixture
number gets recomputed in our own test file before anything depends on it.

---

## 1. The shared judging pipeline (the load-bearing 20%)

All Compass math in the spec reduces to **one pipeline** that judges any
candidate contract, regardless of which scanner surfaced it. Sleeves (Weekly /
Swing / LEAPS / Lotto) only change the penalty terms at step 6. This is the
thing to build.

| # | Stage | Plain English | Spec | Computable from |
|---|-------|--------------|------|-----------------|
| 1 | Feature snapshot | Photograph what the engine can legally know *right now*. Every feature carries an availability time; backtests may only use features whose availability time ≤ decision time. | §1.4, §41 | our `FeatureSnapshot` + vendor timestamps |
| 2 | Physical distribution **f_P** | A real-world probability forecast of where the underlying lands by the exit horizon. Kept strictly separate from the option-implied distribution f_Q (which is a *pricing* measure, not a forecast). Never blend them. | §9.1, §21.1, §51.13 | v1: regime-conditioned historical simulation (bootstrap past returns that looked like today) |
| 3 | Candidate generation | Freeze the full list of eligible contracts *before* scoring. No hindsight additions. | §52.3 | chain snapshot + eligibility filters |
| 4 | Scenario repricing | For each f_P scenario, reprice the option at the planned exit time with that scenario's spot AND its future IV. PnL per scenario = (repriced value − fill) × qty − costs. Theta and vega are *inside* the repricing — subtracting them again is double-counting (prohibited, §49). | §9.2, §21.2 | our Black-Scholes (`core/greeks.ts`) + an IV-change assumption per scenario |
| 5 | Execution costs | Buy at mid + κ·spread/2 + impact; sell at mid − κ·spread/2 − impact. Impact grows with order size vs displayed size. Midpoint-only fills are prohibited in backtests (§22.3). | §9.3, §21.4 | historical bid/ask (purchasable) |
| 6 | EV, POP, ES → **Utility** | EV = probability-weighted scenario PnL. POP = probability of any profit (shown separately — the doc's worked fixture §46 is a trade with +$74 EV and only 30% POP). ES = average of the worst-α tail. **Utility = EV − λ·ES − λ·ModelUncertainty − λ·ExecutionRisk − λ·Concentration.** Confidence is displayed beside utility, never multiplied into it (prohibited, §49). | §9.4, §21.3 | steps 2–5 |
| 7 | **SetupScore** | The 0–100 score is the *historical percentile* of Utility within (strategy, horizon, regime) — "better than X% of comparable setups we've ever scored." Min-max normalizing the current list is prohibited (§49): it always crowns a winner even on a day when everything is garbage. | §9.6 | running store of past Utilities |
| 8 | No-trade gate | Mandatory pass: EV ≤ 0, Utility ≤ 0, weak data quality, high model uncertainty, or capacity failure → no trade. "Do nothing" is a first-class output. | §9.7, §45 | steps 6–7 |
| 9 | Journal | Record the decision, the snapshot, and (ideally) every scored candidate — then wait. Outcomes are real crossings only, written after label maturity. | §25, §37 | our `types/journal.ts` (already aligned — see §5 below) |
| 10 | Evaluation → reweighting | Proper scores (Brier / CRPS / calibration error), walk-forward with purged + embargoed folds, and weights move only through a versioned revision after gates pass. | §10.4, §29, §31 | our `EvaluationRun` + `WeightsRevision` |

**The dealer-sign question (biggest input caveat).** Every exposure number
(GEX/DEX/VEX/CEX) is conditional on the dealer's side of each position, which
is *not observable*. The spec's full treatment is a Bayesian latent-inventory
filter per option series (§5.1, §51.2) — a serious build. The spec's own
implementation sequence sanctions the interim: *"build dealer-sign posterior
with sensitivity scenarios **before** marketing precise exposures"* (§48.3).
Our sim's fixed prior (−0.55 calls / −0.53 puts) is exactly such an interim —
v1 keeps a fixed prior and **publishes sensitivity bands** (recompute exposures
at prior ± band) instead of pretending precision.

---

## 2. Formula translations by engine (what feeds the snapshot)

Only what Compass consumes. Status = the doc's own label for how real the
number is before training.

### Exposure engine (Pinpoint math → `FeatureSnapshot.gex`)
| Metric | Plain English | Formula (per series i, sign sᵢ, OIᵢ, multiplier M) | Status |
|---|---|---|---|
| GEX per 1% | Shares dealers must trade if spot moves 1%. Positive = stabilizing. | γᵢ·sᵢ·OIᵢ·M·(0.01·S); dollars = ×S again | Identity *given sᵢ* |
| DEX | Dealer delta inventory in share-equivalents. The **hedge** is the negative of it — the doc bans labeling both with one name (§5.2). | δᵢ·sᵢ·OIᵢ·M | Identity given sᵢ |
| VEX | Delta change per +1 vol point → hedge flow when IV moves. | Vannaᵢ·sᵢ·OIᵢ·M·0.01 | Identity given sᵢ |
| CEX | Delta bleed per calendar day (charm), defined operationally as Δ(t−1d) − Δ(t) to dodge sign-convention fights. | §4.2 eq. 32 | Identity given sᵢ |
| Gamma flip | A real root: sign change bracketed on a spot grid. No sign change → report "nearest-to-zero," **not** a flip (§5.6). Our `flip` field must respect this. | §5.6 | Identity |
| King / walls | A wall is NOT max OI (§6.4). Influence(K) = weighted blend of \|GEX\|, \|DEX\|, \|VEX\|, OI, flow, minus distance penalty (§18.6). | §18.6 | Heuristic until weighted vs outcomes |

### Trace math (→ whale-sweeps input, `darkPool.posture`)
- **Live vs confirmed is the iron rule** (§8.3): the live score may only use
  what existed at detection (size anomaly, premium, side probability, sweep,
  clustering). Price/IV follow-through goes in a *separate* confirmed score,
  never backfilled. Our TAPE sim already displays this shape.
- **Side probability**: where the print sat in the spread + sweep + quote
  behavior → calibrated logistic (§8.1). **Opening**: probabilistic until
  next-day OI revises it (§51.7). **Institutional**: a *likelihood index*, not
  a probability — real labels don't exist (§8.4).
- **Dark pool**: prints support only *association* labels (support-associated /
  resistance-associated / neutral / uncertain). "Accumulation confirmed" is
  prohibited language (§20.5). Our −100..+100 posture is a Heuristic and stays
  one.

### Physical distribution detail (step 2 above, §51.13)
The production ensemble is five model families (historical simulation, quantile
regression, mixture density, stochastic vol with jumps, f_Q-features model).
**v1 uses family #1 only**: filtered historical simulation — sample past
H-session returns from days matching today's regime (vol bucket, trend state),
apply to spot. Honest, assumption-light, upgradeable.

---

## 3. Scanner map — which of our 7 does the math power?

Our judging pipeline (§1) covers **all seven** scanners — that's its point.
What differs is (a) candidate generation, (b) sleeve penalties, (c) whether the
doc specifies the scanner's *thesis* math.

| Scanner | Doc sleeve / section | Coverage |
|---|---|---|
| `weeklies` | Weekly sleeve §9.8, §21.5 | **COVERED** — ThetaPerHour, GammaPerDollar, RequiredMove, PinProbability, pin/no-fill/close-auction penalties |
| `swings` | Swing sleeve §9.9, §21.6 | **COVERED** — overnight GapES, trend-survival ∏(1−hazard), event risk, separate overnight vs intraday distributions |
| `top-setups` | §9.6 SetupScore | **COVERED — it IS the ranking.** Top Setups = highest utility-percentile across sleeves. No separate math needed. |
| `discounted` | §9.5 mispricing edge + §7.2 VolEdge | **MAPPED BY US** — "discounted" = positive Edge = E_P[exit value] − entry − costs, typically driven by IV below the physical forecast. The doc never names a "discounted" product; partner must confirm this reading (Q3). |
| `whale-sweeps` | §8.2–8.4, §51.8 (Trace) | **COVERED AS INPUT** — detection math is Trace's. The follow-the-whale *trade* label is §51.8's target-before-stop after cluster detection; the judging is our shared pipeline. |
| `quick-scalp` | — | **NOT SPECIFIED.** No scalp sleeve exists. Closest: Weekly sleeve with an hours horizon + §18.4's 0DTE time-grid charm note. Needs partner definition (Q1). |
| `rebounds` | — | **NOT SPECIFIED.** No mean-reversion/oversold model anywhere in either doc. Raw materials exist (regime classifier's "mean-reverting" state §51.5, RSI as an f_P feature) but the thesis math is absent (Q2). |
| `all` | — | Union view, not a scanner. No sheet. |

**Eligibility matrix (Noah, 2026-08-07 — now CODE: `ELIGIBLE_SCANNERS` in
types/compass.ts, enforced in `buildCompassView` which returns an EMPTY scan
for ineligible lens×tenor combos):** Quick Scalp runs on 0DTE + Weekly only
(the hold time is the thesis; the math spec's own ruling names those tenors);
Rebounds on 0DTE/Weekly/Swing (its label is a days-to-weeks bounce — no
year-long instruments for two-week theses); Top Setups, Discounted, Whale
Sweeps, All on every sleeve. The backtest harness reads the same map — no
combination the product doesn't sell ever gets evaluated. Pinned in
scripts/replay-proof.ts.

Weigher horizons map cleanly: `WEEKLIES`→Weekly, `SWINGS`→Swing, `LEAPS`→LEAPS
sleeve (§9.10, §21.7 — American lattice when dividends matter,
StockReplacementEfficiency, ThetaCarry, early-exercise flag when PV(dividend) >
extrinsic + buffer), and `SAMEDAY`→**Lotto sleeve** (§9.11, §21.8).

**PRODUCT RULING (Noah + partner, 2026-08-09): the Lotto Board surface is
REMOVED.** The dedicated same-day board read as gamified — wrong posture for
an institutional tool — and no Compass mode sells it anymore. The SAMEDAY
sleeve MATH stays fully specified and reachable: the Weigher judges any
same-day contract a user names through the same §21.8 pipeline (total-loss
probability primary, EV second, position cap). What died is the surface, not
the sleeve.

---

## 4. Input classification

**[P]** purchasable · **[D]** derivable from purchasable · **[S]** needs its own sourcing · **[X]** unobtainable (doc agrees, §58)

| Input | Class | Notes |
|---|---|---|
| Historical option chains: bid/ask, IV, greeks, OI, volume | **[P]** | ThetaData standard/pro ($80–160/mo, per recon). The doc's realism list (§10.4.4) — zero bids, expired series, quote age — is exactly what raw vendor chains give us if we DON'T clean them away. |
| Option trades w/ conditions + NBBO at trade time | **[P]** | ThetaData has tick trades + quotes. Needed only for whale-sweeps fidelity and a future dealer-sign filter. |
| Underlying OHLCV (+ intraday bars) | **[P]** | trivial, several vendors |
| Exposures (GEX/DEX/VEX/CEX), flip, walls, expected move | **[D]** | our math over [P] chains, given the sign prior + bands |
| Realized vol, RSI/EMAs, robust z-scores, regime bucket | **[D]** | from OHLCV |
| Scenario repricing, EV/POP/ES/Utility, SetupScore percentile | **[D]** | our `core/greeks.ts` + this spec |
| Risk-neutral density f_Q | **[D]** with care | Breeden-Litzenberger ∂²C/∂K² needs arbitrage-clean smoothing (§51.1) — v2, not v1; only a diagnostic for us |
| American pricing (LEAPS) | **[D]** | binomial lattice §51.1 — small, well-understood build |
| Earnings calendar + surprises | **[S]** | cheap vendors exist; needed for Swing event risk |
| News with first-publication timestamps | **[S]** | vendor ($); v1 can run without (news lean stays SIM/heuristic, provenance-marked) |
| L2 depth / order-flow imbalance | **[S]** | order-book feeds, real money. **Not needed for Compass v1** — depth terms only sharpen Pulse liquidity, which isn't in our journal's snapshot. |
| Dark-pool / TRF venue detail | **[S]** | partial via consolidated tape; full venue detail limited |
| Closing-auction (MOC) imbalance feed | **[S]** | NYSE/Nasdaq imbalance data, separate vendor product; not in ThetaData. Its only consumer was the Lotto Board's auction read — surface removed 2026-08-09, so **not needed** unless a SAMEDAY surface ever returns |
| Dealer sign, true inventory | **[X]** | posterior forever (§58) — fixed prior + bands for v1 |
| Institutional identity, parent orders, completion % | **[X]** | doc itself: likelihood index / interval only |

**Bottom line for the pilot data buy:** nothing in the partner's math changes
the recon verdict — ThetaData covers every v1-required input. The one real
decision is EOD vs intraday history (Q8).

---

## 5. Gap-check vs frozen `types/journal.ts`

Verdict up front: **the frozen journal survives — zero breaking changes.**
Seven findings, all additive or procedural:

1. **Score vs Utility.** Journal stores `score: number`; the spec wants that
   number to *be* the utility percentile, with EV/POP kept separately. No
   schema break — the discipline of computing `score` changes (ENGINE_VERSION
   bump). Optional additive fields later: `ev`, `pop`, `utility`.
2. **All-candidate shadow recording (§26) — the real gap.** We journal only
   setups above `scoreFloor`; the spec prohibits learning only from
   recommendations (selection bias). Fix is writer behavior, not schema: write
   a DecisionEvent (verdict `WATCH`) for *every scored candidate*, including
   below-floor ones. Storage is trivial at our scale. Recommend: do it.
3. **No-trade records.** A scan that emits nothing writes nothing, so "was
   staying flat correct?" is unanswerable. Spec stores no-trade + reason
   (§37 `DecisionRecord.noTradeReason`). Additive: a per-scan record, later.
4. **Availability timestamps.** Spec wants four timestamps per feature (§1.4);
   our snapshot has `decidedAt` + `provenance`. For SIM/REPLAY-from-snapshots
   they coincide, so we're honest today. When live vendor feeds land, add an
   optional availability field. Flagged, not urgent.
5. **Assignment/early exercise.** `OutcomeEvent` has no assignment concept;
   LEAPS sleeve requires American treatment (§54.3). Additive when LEAPS
   backtests start; irrelevant for weeklies/swings v1.
6. **CloseRule vs excursion labels.** Spec break-labels carry hold-time and
   excursion thresholds (§51.3); ours is `SESSION_CLOSE_THROUGH | TOUCH`. Ours
   matches the product promise and stays. Partner should confirm (Q6).
7. **WeightsRevision = champion/challenger in miniature.** The spec's promotion
   gates (§29: calibration non-degradation, tail-risk, min samples) become the
   *procedure* before we write a WeightsRevision. `EvaluationRun` already
   carries the needed evidence (calibration buckets, expectancyR). Procedural,
   no schema change. The spec's safe-learning boundary (§52.12 — auto-update
   only calibration/weights, never policy) is exactly our "only door" rule.
8. **Invalidation buffer (from partner ruling #5, 2026-08-02).** The journal
   must preserve the exact level AND buffer fixed at entry. No schema break:
   `invalidation.price` is defined as the *buffered threshold* (level −
   δ_close for support, + δ_close for resistance), computed point-in-time at
   entry and immutable after. If evaluation later wants the raw level and
   buffer separately, add optional `level`/`buffer` fields — additive, like
   everything else on this list.

---

## 6. Questions for the partner — RULINGS IN (answers received 2026-08-02)

The partner answered every question that reached him ("Answers to questions"
PDF). Two items never made his list — see the OPEN box at the end.

1. **Quick-scalp sleeve — RULED: separate sleeve, NOT a Weekly variant.**
   "Weekly" is tenor; "Quick Scalp" is holding period + exit logic. Horizons
   H ∈ {5, 15, 30, 60, 120} minutes; primary quantity = first-passage
   target-before-stop P(τ_target < τ_stop); EV at the intraday exit
   τ = min(τ_target, τ_stop, H, session close). Hard rule: nothing survives
   the session cutoff unless explicitly converted to another sleeve. Feature
   set named: live dealer pressure, live flow pressure, distance to nearest
   level, spread + displayed depth, quote stability, expected slippage,
   gamma efficiency, theta/hour, intraday RV, P_TBS, time left in session.
2. **Rebounds — RULED: its own sleeve with explicit math** (the big spec's
   gap is now closed). Entry trigger = touch of qualified support
   (|S − L| ≤ δ_L). Features: displacement z-score, VWAP deviation scaled by
   RV, flow reversal, absorption (aggressive sell volume × muted price
   response), level quality, dealer support, vol regime, liquidity, trend,
   time of day. Label: Y = 1(touch ∧ τ_target < τ_invalidation ∧ τ_target ≤ H)
   with target = S + α·ATR and invalidation = support − β·ATR. Explicitly NOT
   a generic oversold indicator.
3. **Discounted — CONFIRMED with a correction:** Edge = E_P[exit value] −
   executable entry − expected costs, and the card qualifies when Edge > 0
   (preferably lower-confidence-bound > 0). Cheap IV is ONE route to the edge,
   not the definition — mispriced skew/term, underestimated drift or jumps,
   convexity, and liquidity discounts all count. Update the sheet's filter
   language: positive model-based mispricing after costs, not "cheap premium."
4. **Utility λ weights — RULED, partially per our proposal:**
   `Utility = EV − 1.0·ES₉₅`, both in DOLLARS, λ frozen until walk-forward
   evidence. Corrections to our proposal: execution costs are NOT a λ term —
   they subtract inside EV itself (EV = gross − spread − slippage − fees);
   uncertainty is a hard eligibility gate (DQ ≥ θ, model confidence ≥ θ),
   not a penalty; concentration is a hard portfolio limit (per-trade risk,
   per-ticker, per-sector caps), not a penalty. v1 shape: one soft penalty
   (ES), everything else gates.
5. **Invalidation — RULED: keep SESSION_CLOSE_THROUGH.** Three distinct
   concepts, never conflated: intraday break EVENT (excursion + hold time,
   for live probabilities), risk STOP (protects the position), and journal
   thesis invalidation = close through the level ± a buffer
   δ_close = max(0.10·ATR, min tick buffer), fixed point-in-time at entry.
   An intraday excursion raises break probability WITHOUT invalidating the
   journal thesis. The journal must store the exact level and buffer used at
   entry (see gap-check #8 below).
6. **Dealer-sign prior — ACCEPTED for v1 as a labelled assumption:** central
   priors −0.55 calls / −0.53 puts, band ±0.20. Every dealer-dependent metric
   computes under ≥3 scenarios (low/base/high) PLUS a q = 0 neutral stress —
   his catch: the ±0.20 band never crosses zero, so the neutral case must be
   run separately. Report Y_base, [Y_min, Y_max], and Sensitivity =
   (Y_max − Y_min)/|Y_base|. If flip/dominant level/pressure/regime changes
   materially across scenarios → mark "dealer-sign sensitive / low
   confidence." Never present the prior as observed inventory.
7. **SetupScore cold start — AGREED:** expanding-window percentile using only
   outcomes known before t; score displays "—" until effective sample
   N_eff ≥ 200 (completed, point-in-time-eligible observations — not
   recommendations shown). During cold start the card shows raw EV, expected
   return, ES, POP, utility, DQ, model status — everything except the
   fabricated 0–100. Reference population pooled by (sleeve, horizon,
   direction, liquidity class, event/non-event); ticker/regime specialization
   later via hierarchical shrinkage. Day-one rule: rank by raw utility.
8. **Fixture verification — DONE:** `npx tsx scripts/fixture-proof.ts`
   reproduces every §46 number (DEX −43,840 sh; hedge +43,840; GEX −1,764
   sh/1%; EV $74.00; POP 30%) — 7/7. Side finding worth keeping: under the
   agreed v1 utility, the fixture trade grades +$7.43, not +$74 — the tail
   penalty is doing real work.

**STILL OPEN (never reached the partner):**
- **SAMEDAY upgrade path** (old Q4): adopt his §21.8 trio (P_touch,
  total-loss probability primary, hard position cap) when real data lands.
  Default-adopt unless Noah objects — it's the partner's own spec. Applies to
  Weigher SAMEDAY judgments; the Lotto Board surface itself was removed
  2026-08-09.
- **Data granularity — DECIDED (Noah, 2026-08-02): intraday from day one.**
  All sleeves replayable from the start, including Quick-Scalp's
  5–120 min horizons and SAMEDAY weighs. Noah performs the subscription
  himself; the snapshot builder targets intraday snapshot assembly from its
  first line.

  **Exact plans (verified live on thetadata.net + docs Subscriptions page,
  2026-08-02):**
  - **Options Standard — $80/mo.** Tick-level history to 2016-01-01,
    2 server threads. Historical endpoints: EOD, Quote (every OPRA NBBO),
    OHLC, Trade, Trade Quote, **Implied Volatility, Greeks 1st order, Open
    Interest**, plus ALL bulk-historical endpoints (Bulk Quote/OI/Trade/
    Trade Quote/EOD Greeks — the chain-assembly workhorses). This is every
    input the math requires. Gamma/vanna/charm are 2nd-order and gated to
    Pro as *endpoints*, but we derive them ourselves from Standard's IV via
    core/greeks.ts — the spec mandates our own greeks with declared
    conventions + finite-difference checks anyway (§4.2–4.3; the operational
    one-day charm is ours to compute, no vendor ships it).
  - **Stocks Standard — $80/mo.** 1-minute bars to 2016-01-01 (UTP; CTA
    names like SPY to 2017), real-time access, and the **Splits endpoint** —
    corporate actions are a spec hard requirement (T3) and NVDA's 2024 10:1
    split sits inside our backtest window. (Stocks Value at $30 lacks
    splits + is 15-min delayed with only 2021+ history — the $50 saving
    buys a data-integrity hole; rejected.)
  - **Total $160/mo. NOT buying:** Options Pro ($160 — adds full live trade
    stream, 2nd/3rd-order greek endpoints, pre-2016 history, root
    snapshots; upgrade candidate when the LIVE shadow journal wants the
    whale-sweeps trade stream). Ruled out for backtesting on the merits
    (Noah asked, 2026-08-02): streaming is live-only by definition —
    Standard's historical Trade/Trade Quote endpoints ARE the past trades;
    and Pro's 2012–2015 options can't form complete snapshots anyway
    because CTA-tape underlyings (incl. SPY) start 2017-01-01 at EVERY
    tier — plus pre-0DTE, pre-GEX-era microstructure is regime noise for
    an engine modeling today's dealer flow. 2016–2026 spans five regimes;
    sample gates clear many times over. Indices package (SPX/VIX regime features —
    later). MOC imbalance feed (separate vendor entirely).
  - **License note:** retail plans are single-terminal, individual use.
    Fine for backtesting and development; the day Slayer redistributes
    vendor-derived data to paying users is a commercial-license
    conversation with ThetaData — a future cost, flagged now.

  **WHOLE-MARKET RULING (Noah, 2026-08-02): scanners are whole-market, not
  watchlist.** Boards surface the best contracts in the entire market; users
  narrow (e.g. "top setups, NVDA only") by filtering OUR board — client-side,
  no data implication. Architecture consequences, recorded as doctrine:
  - **Streams detect events, snapshots score state.** Scanner boards run on
    bulk-snapshot ROTATION (unlimited requests; Standard 2 threads / Pro 4;
    Pro adds exp=0 root snapshots), not on streams — even Pro caps quote
    streams at 15k contracts vs ~1.5M listed. Whole-market boards are a
    Standard-tier capability; Pro rotates ~2× faster.
  - **Live whale detection is the one true full-stream job** — Options Pro's
    full trade stream, REQUIRED at the live phase (confirmed, no longer a
    maybe). Monthly toggle when the shadow journal goes live.
  - **Backtest universe must be wide**: point-in-time liquid universe
    (~top-1000 optionable names + index ETFs; spec §41 point-in-time
    membership). Eligibility gates make whole-market ≈ liquid-market — the
    spec's quote-validity/capacity rules reject illiquid chains anyway.
    Storage per recon: ~0.4–1.1 TB/yr Parquet. Real cost is backfill
    wall-clock on 2 threads — if week-one throughput pinches, flip Options
    Standard→Pro for ONE month (4 threads + root snapshots) for the big
    pull, then drop back until the live phase.

---

## 7. Per-scanner spec sheets (harness contract)

Shared preamble for every sheet: candidates frozen per §52.3 → judged by the
§1 pipeline → journaled per `types/journal.ts` → labels mature per §27 →
evaluated per §10.4 (walk-forward, purge, embargo, latency on fills). Sleeve
sheets add only what differs.

### `weeklies` — Weekly sleeve
- **Thesis:** directional move to a wall/level before this week's expiry, theta still light.
- **Candidates:** current-week expiries, delta band ~0.25–0.55, valid quotes, spread ≤ smax.
- **Judge:** shared pipeline; f_P horizon = sessions to expiry; sleeve penalties: pin loss (P_P(\|S_T − K_pin\| ≤ ε) near king/walls), no-fill cost, close-auction risk.
- **Record per decision:** ThetaPerHour (direct repricing over 1h, §21.5), GammaPerDollar = γMS²/premium, RequiredMove = (K + debit − S)/S, PinProbability, one-overnight GapES.
- **Primary label:** TP1 crossed before invalidation close-through, within sessionsToExpiry. Secondary: pnl at fixed horizons (already in `OutcomeEvent.pnl.horizons`).
- **Inputs:** [P] chains+quotes, [D] everything else. **Status: COVERED.** Open: Q8 (intraday history).

### `swings` — Swing sleeve
- **Thesis:** multi-day trend continuation while levels hold; no clock.
- **Candidates:** 2–8 week expiries, delta ~0.35–0.65.
- **Judge:** shared pipeline with overnight/intraday distributions modeled separately (§21.6); penalties: GapES(95%) × nights held, event risk (earnings inside hold window), state-migration risk.
- **Record:** trend-survival ∏(1−hazard) once a hazard model exists (v1: sessions-since-trend-start heuristic, labeled Heuristic), GapES, event flags.
- **Primary label:** TP ladder crossings before invalidation; exit at ENGINE_EXIT when verdict decays.
- **Inputs:** [P] chains, [S] earnings calendar. **Status: COVERED.** Open: Q6.

### `top-setups` — the ranking itself
- **Thesis:** none of its own — the cross-sleeve utility-percentile leaderboard (§9.6).
- **Judge:** SetupScore percentile within (sleeve, regime); magenta TOP PICK = argmax. No-trade gate can leave it empty — that is a valid, displayable state (§45).
- **Record:** nothing extra; it consumes other sheets' records.
- **Status: COVERED** (definitionally). Open: Q9 (cold start).

### `discounted` — mispricing edge
- **Thesis:** premium cheap vs the physical forecast: Edge = E_P[exit value] − entry − costs > 0, and VolEdge = σ_P − σ_imp > 0 (§9.5, §7.2).
- **Candidates:** any sleeve's universe; filter = positive Edge with Edge > cost uncertainty (else mandatory no-trade, §21.4).
- **Judge:** shared pipeline; the *filter* is the thesis. Report Edge and VolEdge on the card with uncertainty (§7.2: "forecast uncertainty shown explicitly").
- **Primary label:** same TP/invalidation ladder; evaluation additionally buckets by Edge decile — if Edge deciles don't order outcomes, the scanner is a placebo and the evaluation will say so.
- **Status: MAPPED BY US** — needs partner confirmation (Q3).

### `whale-sweeps` — flow-following
- **Thesis:** confirmed institutional-likelihood clusters continue (Trace math as input).
- **Candidates:** contracts named by detected clusters (live score ≥ threshold); side from the cluster's direction posterior.
- **Judge:** shared pipeline; snapshot must carry the cluster's LIVE-time features only (no confirmed-score leakage into the decision, §8.3 — the doc's hardest rule and an easy one to break accidentally).
- **Primary label:** §51.8 target-before-stop, volatility-scaled, direction-specific.
- **Inputs:** [P] tick trades + NBBO (fidelity), [X] institutional identity (likelihood index only). **Status: COVERED as input + judged generically.**

### SAMEDAY horizon (Weigher-only) — Lotto sleeve math, no dedicated surface
- **Surface REMOVED 2026-08-09** (product ruling: institutional posture, no gamified boards). The sleeve remains judged when a user weighs a 0–1 DTE contract.
- **Judge:** shared pipeline with the sleeve's inversion of emphasis (§21.8): **total-loss probability is the primary risk output**, EV second. A negative-EV ticket can never grade QUALIFIES on payout multiple alone (prohibited, §21.8). Position cap: contracts ≤ portfolio × max-loss-% / (premium × M + fees).
- **Current vs spec:** today's grades come from the SAMEDAY factor composite (1σ move vs breakeven, theta/day, spread toll) — honest as a Heuristic. Upgrade: P_touch by first-passage over intraday paths, total-loss probability, cap enforcement (Q4).
- **Journal:** decisions write as `{kind:'weigher', horizon:'SAMEDAY'}` — the frozen seam already covers it, no schema change. With the board gone, every SAMEDAY row is user-weighed by construction; the old board-vs-user ambiguity note is moot.
- **Inputs:** [P] intraday chains (hard requirement — EOD replay of same-day tickets is dishonest by construction, Q8). The [S] closing-auction imbalance feed is no longer required (its consumer was the board's auction read). **Status: COVERED** — sleeve fully specified in partner math.

### `quick-scalp` — Scalp sleeve (partner ruling #1, 2026-08-02)
- **Thesis:** intraday pop harvested inside a fixed clock — holding period IS the sleeve, tenor (0DTE or weekly contract) is incidental.
- **Horizons:** H ∈ {5, 15, 30, 60, 120} minutes. Exit τ = min(τ_target, τ_stop, H, session close). **Hard rule: no position survives the session cutoff** unless explicitly converted to another sleeve.
- **Judge:** shared pipeline with intraday f_P (intraday bars, intraday RV); primary quantity = first-passage P(τ_target < τ_stop); EV computed by repricing at the intraday exit.
- **Features (his list, verbatim scope):** live dealer pressure, live flow pressure, distance to nearest structural level, spread + displayed depth, quote stability, expected slippage, gamma efficiency, theta per hour, intraday realized vol, target-before-stop probability, time remaining in session.
- **Primary label:** target-before-stop within H, volatility-scaled thresholds.
- **Inputs:** [P] **intraday** chains + quotes (hard requirement — EOD replay is dishonest by construction). **Status: COVERED — partner supplied the sleeve math.**

### `rebounds` — Rebound/Mean-Reversion sleeve (partner ruling #2, 2026-08-02)
- **Thesis:** oversold reversal off a *qualified* support level — explicitly not a generic oversold indicator.
- **Entry trigger:** Touch = 1(|S − L_support| ≤ δ_L).
- **Features:** displacement z = (S − μ_h)/(σ_h), VWAP deviation / RV, flow reversal (ΔFlowPressure over k), absorption = aggressive sell volume × (1 − |price response|/expected response), level quality, dealer support, vol regime, liquidity, market trend, time of day.
- **Primary label:** Y = 1(Touch ∧ τ_target < τ_invalidation ∧ τ_target ≤ H), target = S + α·ATR, invalidation = L_support − β·ATR. Model estimates P(successful rebound | X).
- **Judge:** shared pipeline; the trigger + label are the sleeve's identity. α, β, δ_L, H are model-versioned constants — pick v1 values, freeze, and let evaluation move them through WeightsRevision discipline.
- **Inputs:** [P] chains + underlying bars; [D] ATR/VWAP/displacement from bars; dealer support from our exposure math. **Status: COVERED — partner supplied the sleeve math.**

---

## 8. Roadmap state (updated 2026-08-02, answers in)

All seven sleeves now have partner-ruled math; the fixture proof is committed
(`scripts/fixture-proof.ts`, 7/7). Order stands: **pilot data buy → snapshot
builder (vendor rows → `MarketSnapshot`s + `FeatureSnapshot`s) → Weeklies as
first real scanner → live shadow journal.** The buy is unblocked: Noah chose
**intraday from day one** (2026-08-02) and performs the subscription on his
side; the snapshot builder is the next coding arc. Carried-forward code items for the
harness writer: below-floor candidates journal as WATCH (gap #2), no-trade
records (gap #3), buffered invalidation threshold (gap #8), dealer-sign
low/base/high + q=0 scenario plumbing (ruling #6).
