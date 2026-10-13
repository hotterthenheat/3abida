# Rebuild Exposure Trails from point-in-time inputs

The most defensible Exposure Trails chart is a **modeled** field, recomputed minute by minute by one pricer from inputs that could each have been known at that minute: the open interest OCC counted at the prior close, the underlying's minute price, and each contract's implied volatility as last observed at or before that minute. Every cell should carry its provenance, and the field should be checked against, not blended with, the vendor readings that were actually captured. No public data source observes dealer inventory. Every "dealer gamma" figure from SqueezeMetrics, SpotGamma, Unusual Whales (UW) or the academic proxies rests on an assumed position sign: dealers long calls and short puts. Cboe, the one party that sees market-maker positions in SPX, calls outside estimates "just estimates based on assumptions" ([Cboe](https://www.cboe.com/insights/posts/volatility-insights-evaluating-the-market-impact-of-spx-0-dte-options)). On the current plans the per-contract inputs exist for the last 730 trading days on UW API Basic — except an index level: for SPX, NDX and RUT no plan carries the index's own minute price, which is the field's main driver (see "Review corrections"). UW does not serve per-strike exposure for an earlier time of day on any endpoint, though, so the strike × time field has to be built, not downloaded ([UW OpenAPI](https://api.unusualwhales.com/api/openapi)). For Slayer, the minute-by-minute rebuild should replace captured UW strike books as the field Terrain draws. When this report was first written, the rebuild took today's IV from `/option-contracts` for every minute of the day — look-ahead — and rescaled the field to UW's readings. Both were changed in the build merged on 2026-10-13 (each minute uses the vol knowable at or before it; no rescaling). The per-column flip with gaps, the discrete beads and the server-side recorder stay. The "OI + today's flow" lens should be dropped as a positioning lens. Of the endpoints named in the brief, the per-minute `/spot-exposures`, the historical `/spot-exposures/strike` close books and `greeks?date=&expiry=` are the validation series. The full tape and `option-chains?date=&greeks=true` are backfill inputs. `/gex-levels` is a cross-check, never a drawn level.

Three tags mark claims throughout. **Established** means textbook option math, exchange or clearing facts, or practice that several independent sources share. **Vendor** means one provider's stated convention or a behaviour of these plans seen in a live call. **Inference** means reasoning from cited material, including every Slayer recommendation. Live calls made with the project's own keys are cited by the endpoint called; every "live probe 2026-10-13" below is a UTC date — the calls ran on the evening of 2026-10-12, New York time, after that session's close.

## Every public "dealer gamma" field is a model with an assumed sign

### The terms of the trade, and which ones Slayer can honestly use

The quantity Terrain draws has an origin and a name. SqueezeMetrics' white paper (March 2016, revised December 2017) defines per-strike **gamma exposure (GEX)** as Γ·OI·100 for calls and Γ·OI·(−100) for puts, "summation of GEX at every strike price in every available contract". It rests on four stated assumptions:

1. Every option is facilitated by a delta-hedger.
2. Investors sell calls to market makers.
3. Investors buy puts from market makers.
4. Market makers hedge exactly to delta.

The paper calls the sign an assumption and concedes that SPX trade direction is hard to determine because "a vast majority will trade at the midpoint" ([SqueezeMetrics](https://squeezemetrics.com/download/white_paper.pdf)). **Established:** this "naive" or OI-based convention is the de facto standard, and UW adopts it verbatim ("market makers are part of every transaction and … the bulk of their transactions are buying calls and selling puts") ([UW OpenAPI](https://api.unusualwhales.com/api/openapi)). Its critics are its own users. Perfiliev calls it "a crude approximation" that is "more debatable" for single stocks ([Perfiliev](https://perfiliev.com/blog/how-to-calculate-gamma-exposure-and-zero-gamma-level/)). SpotGamma calls it "a simplifying inventory convention" ([SpotGamma](https://spotgamma.com/gamma-exposure)).

Four different things travel under the name GEX, and a label should say which one it shows:

- **Naive or OI GEX:** OI-weighted, calls positive, puts negative.
- **Gross GEX:** the sum of absolute values, a measure of hedging mass with no sign.
- **Directionalized GEX:** each trade signed by its bid or ask side. UW's `_dir`, `_ask` and `_bid` fields work this way.
- **Modeled-position GEX:** a proprietary inventory model such as SpotGamma's Options Inventory Model, whose internals are not public ([SpotGamma](https://spotgamma.com/gamma-exposure); [UW OpenAPI](https://api.unusualwhales.com/api/openapi)).

The academic literature calls the aggregate of the first kind **net gamma exposure (NGE)**. Baltussen, Da, Lammers and Martens build it from OptionMetrics OI under the same four assumptions. They write that "we assume option market makers are short all puts and long all calls. We do not have data on … precise end-user option positions" ([Baltussen et al., JFE 2021](https://www3.nd.edu/~zda/intramom.pdf)).

| Slayer concept | Industry term(s) | Status |
|---|---|---|
| Exposure Trails (strike × time field over candles) | Strike-by-time GEX heatmap. SpotGamma TRACE "Gamma lens" and "Charm Pressure", FlashAlpha "0DTE gamma heatmap", QuantWheel "GEX heatmap" ([TRACE manual](https://spotgamma.com/wp-content/uploads/2025/07/TRACE-User-Manual-Final-Version.pdf); [FlashAlpha](https://flashalpha.com/articles/0dte-gamma-heatmap-api-strike-time-gex-hiro-heatseeker-alternative); [QuantWheel](https://quantwheel.com/products/gex-heatmap)) | Layout is common practice; every vendor's colour is modeled |
| GEX lens | Gamma exposure; dealer gamma; NGE (academic) | Established formula, assumed sign |
| DEX lens | Delta exposure | Textbook; the sign convention varies by vendor |
| Vanna lens | Vanna exposure (VEX) | Textbook; UW's scaling undocumented |
| Charm lens | Charm exposure (CEX at UW) | Textbook; UW's ×365 is ambiguous |
| Flip | Zero gamma, gamma flip. SpotGamma's Volatility Trigger and MenthorQ's HVL are proprietary and are *not* the plain flip ([SpotGamma](https://spotgamma.com/options-key-levels-explained/); [MenthorQ](https://menthorq.com/wp-content/uploads/2023/11/Product-Training-Gamma-Levels.pdf)) | Definition established; method varies |
| Call wall / put wall | Call wall, put wall (SpotGamma); Call Resistance and Put Support (MenthorQ); call_wall and put_wall (UW, side-of-spot rule) | Core is the argmax; the details are vendor-specific |
| Heaviest strike | Absolute Gamma Strike (SpotGamma); gamma magnet (UW) | Vendor names for the same argmax |

**Inference, recommended wording:** the field should be named "estimated dealer gamma" or "exposure (assumed dealer sign)", never "dealer positioning". Hover copy should say "OI counted at the prior close; today's trades not reflected". FlashAlpha's own heatmap disclosure shows the honest form: "built on FlashAlpha's flow model … not a dealer's actual book" ([FlashAlpha](https://flashalpha.com/articles/0dte-gamma-heatmap-api-strike-time-gex-hiro-heatseeker-alternative)).

### What is observed, what is modeled, and where the evidence is contested

**Established:** observed dealer positions exist, but only daily, historically and non-publicly. Pearson, Poteshman and White derived market-maker open interest from CBOE origin-coded data (customer, firm and market maker) by an accounting identity: the three categories "must be zero" in sum. They found "a statistically and economically significant negative relationship between stock return volatility and net purchased option positions of investors who are likely to hedge" ([PPW working paper](https://ou.edu/dam/price/Finance/CFS/paper/pdf/pearsonPoteshmanWhite.pdf); published as RFS 34(4) 2021, [RePEc](https://ideas.repec.org/a/oup/rfinst/v34y2021i4p1952-1986..html)).

The same kind of data undercuts the naive sign for single names. Gârleanu, Pedersen and Poteshman find end users net long index options, especially out-of-the-money puts, but **net short single-stock options** ([NBER WP 11843](https://www.nber.org/papers/w11843.pdf)). A "dealers short puts, long calls" rule therefore has observed support for the index and contrary evidence for single stocks.

Intraday, the observer is Cboe, and its numbers are small and two-sided. Typical net market-maker 0DTE gamma was **$170m–$670m, 0.04–0.17% of S&P futures liquidity**. On 15 August 2023 more than 100k contracts traded in one put while market makers ended about 3k short, roughly 3% of gross volume ([Cboe 2023](https://www.cboe.com/insights/posts/volatility-insights-evaluating-the-market-impact-of-spx-0-dte-options)). In 2025 Cboe put it "at best, just 0.2% of the SPX daily liquidity" ([Cboe 2025](https://www.cboe.com/insights/posts/0-dt-es-decoded-positioning-trends-and-market-impact)). Cboe has a commercial interest in presenting 0DTE as benign ([OptionStrat](https://optionstrat.com/blog/0dte-options-straight-talk)), and SpotGamma argues the opposite ([SpotGamma](https://spotgamma.com/0dte-options-explained/)).

The fair summary is this. Hedging effects are **established** on observed daily data: volatility and pinning in single stocks ([Ni, Pearson & Poteshman via CXO](https://www.cxoadvisory.com/equity-options/stock-price-pinning-at-options-expiration)). They are **supported only through a modeled proxy** for intraday momentum on negative-NGE days ([Baltussen et al.](https://www3.nd.edu/~zda/intramom.pdf)). They are **contested** for intraday 0DTE ([Dim, Eraker & Vilkov summary](https://harbourfrontquant.substack.com/p/the-rise-of-0dte-options-cause-for)). Terrain's copy should describe a level as a property of the assumed book, not as something price will respect.

## One quantity, three scales: GEX, DEX, VEX and charm in units

### The formulas, and why published figures differ by 50×

**Established:** the same Γ × OI × 100 is reported at three scales:

| Scale | Formula | Who uses it |
|---|---|---|
| Shares per $1 move | Γ·OI·100 | SqueezeMetrics |
| Dollars per $1 move | Γ·OI·100·S | jensolson's code, in $mm per index point |
| Dollars per 1% move | Γ·OI·100·S²·0.01 | The public standard: Perfiliev, SpotGamma, gex-tracker, UW |

Sources: [SqueezeMetrics](https://squeezemetrics.com/download/white_paper.pdf); [jensolson GEX.py](https://github.com/jensolson/SPX-Gamma-Exposure/blob/master/GEX.py); [Perfiliev](https://perfiliev.com/blog/how-to-calculate-gamma-exposure-and-zero-gamma-level/); [SpotGamma](https://spotgamma.com/gamma-exposure); [gex-tracker main.py](https://github.com/Matteo-Ferrara/gex-tracker/blob/master/main.py).

UW writes the per-1% figure as "gamma × open interest × price × price". That is numerically identical to the standard form, because the 100-share multiplier and the 0.01 cancel. For SPX at 5,000 a per-1% figure is 50× a per-point figure, which alone explains many order-of-magnitude disagreements. SpotGamma's warning is the rule: "Always check the units before comparing values from two sources" ([SpotGamma](https://spotgamma.com/gamma-exposure)).

The other lenses follow textbook Black-Scholes-Merton greeks with dividend yield q ([Wikipedia, Greeks](https://en.wikipedia.org/wiki/Greeks_(finance))):

- **Delta exposure:** Δ·OI·100 in shares, ×S for dollars.
- **Vanna exposure:** vanna·OI·100, with vanna = ∂Δ/∂σ per 1.00 of σ. Multiply by 0.01 for per vol point, ×S for dollars.
- **Charm exposure:** charm·OI·100, with charm = ∂Δ/∂t per **year**. Divide by 365 for per calendar day.
- **Vega exposure:** vega·OI·100·0.01, in dollars per vol point. This is plain position vega; no vendor standardizes it as a dealer metric.

"Per 1% move" is a first-order figure that ignores how gamma itself changes over the move.

### Worked example, recomputed and finite-difference checked

**Inputs:** an SPX-like index at S = 5,000, r = 4%, q = 1.5%, τ = 30/365, multiplier 100. A 5,100 call (IV 15%, OI 10,000) and a 4,900 put (IV 20%, OI 15,000).

The research notes computed the greeks from the closed forms and checked them by central differences to 8+ significant figures. This report recomputed them independently and matched every figure below.

| | 5,100 call | 4,900 put |
|---|---|---|
| Δ | 0.347395 | −0.337978 |
| Γ (per $1) | 0.00171659 | 0.00127417 |
| Vanna (per 1.00 σ, per long contract) | +1.068435 | −0.656634 |
| Charm (∂Δ/∂t, per year, per long contract) | −1.184310 | +0.634564 |
| GEX, shares per $1 (Γ·OI·100, naive dealer sign: calls +, puts −) | +1,716.59 | −1,911.26 |
| GEX, $ per $1 move (×S, naive dealer sign) | +$8.58m | −$9.56m |
| **GEX, $ per 1% move (Γ·OI·100·S²·0.01 = UW's Γ·OI·S², naive dealer sign)** | **+$429.15m** | **−$477.81m** |
| DEX, shares (holder sign) | +347,395 | −506,967 |
| VEX, shares per vol point (holder sign) | +10,684 | −9,850 |
| Charm exposure, shares per calendar day (÷365, holder sign) | −3,244.7 | +2,607.8 |
| Vega exposure, $ per vol point (holder sign) | $5.29m | $7.85m |

Under the naive sign the book nets **−$48.67m per 1% move** (−194.67 shares per $1). Read literally, the assumed dealer is short gamma: a 1% rise lowers its delta by about 9,733 shares (−$48.7m), so to stay hedged it would **buy** about $48.7m into a 1% rise and sell about as much into a 1% fall — buying rallies and selling dips, the destabilising case. That reading is **Inference**, first-order, and rests entirely on the assumed sign. (Corrected 2026-10-13: an earlier version said "sell into a rise", which is backwards.)

Three facts follow from the table. First, the put's larger OI and higher IV outweigh the call, but only through the *assumed* sign. Under the opposite single-stock evidence of Gârleanu et al., the net would flip. Second, the ATM sensitivity tables in the notes show Γ ∝ 1/σ and ∝ 1/√τ: 0DTE ATM gamma at 15% IV (r = q = 0, S = 5,000, τ in calendar hours / 8,760) rises from 0.0195 with 6.5 hours left to 0.0996 with 15 minutes left. Third, OTM short-dated gamma *rises* with IV, so an IV spike can move the field with no change in positions (**Inference**, from the computed tables).

**Inference, about Slayer's sign:** Slayer's book uses the opposite sign to UW's. In `src/core/walls.ts`, `pickWalls` reads negative as call-dominant and positive as put-dominant, and the feed negates UW's gamma, delta and the calls' vanna and charm. In the house sign the same example reads −$429.15m at the call, +$477.81m at the put, and **+$48.67m net**. A reconstruction must emit the house sign, and every comparison with UW must flip UW's figures first.

### UW's fields, read in those units

UW's per-minute `/spot-exposures` fields are as follows ([UW OpenAPI](https://api.unusualwhales.com/api/openapi)):

- `gamma_per_one_percent_move_oi` is Γ·OI·S², the standard dollars per 1%.
- `vanna_per_one_percent_move_oi` is "vanna × open interest", with no stated vol-point or price scaling.
- `charm_per_one_percent_move_oi` is "charm × open interest × 365". The screener variant adds "the underlying price".

The "per one percent move" label on charm is inherited and meaningless, because charm is a sensitivity to time. Whether UW's per-contract charm is already annual, in which case ×365 double-annualizes, is undocumented. The repository treats the result as annual and divides by 365, after a live proportion check against gamma (`src/data/feed/uw.ts`, lines 341–344). That is a sound empirical choice, but it is a check of proportion, not of absolute scale.

The `gex_daily_*` and `/greek-exposure` families are in **shares** (greek × OI × 100, with no price scaling). They "update once per day at market open" and must not be mixed with `/spot-exposures` without rescaling. For an index, UW's `price` is "the current ATM strike", not the printed level ([UW OpenAPI](https://api.unusualwhales.com/api/openapi)).

## Four reconstruction methods, none of which observes the dealer book

### How the methods compare

| Method | What it gives | Failure modes | Fit for Terrain |
|---|---|---|---|
| **(a) Live capture of vendor snapshots** | The vendor's own number at the instants recorded | Gaps whenever nothing is recording. Inherits the vendor's sign, OI date, greeks and per-strike staleness. No cold-start history | The *measured* reference layer, not the field |
| **(b) Recompute from OI at the open × IV × minute spot path** | Every minute; reproducible if the inputs are versioned | Positions held fixed all day, so intraday opens and closes (notably 0DTE) never enter. Depends on the assumed IV dynamics and the τ convention | **The field**, with IV taken point-in-time |
| **(c) IV inverted from minute quotes** | Removes the fixed-IV assumption | Needs a minute quote archive. Wide or absent quotes, American early exercise, licence-gated index level | Not obtainable on these plans; per-print IV from the UW tape is the substitute |
| **(d) Vendor end-of-day history** | Cheap and consistent | One snapshot a day; revised in place; method partly undisclosed | Validation of the last column, and the seed IV |

**Established:** the standard tooling for the shape of the book against spot is method (b) across hypothetical prices. Each contract's gamma is repriced at a grid of spot levels with OI and usually IV held fixed (sticky-strike), and the flip is where the dealer-signed sum crosses zero. Perfiliev uses 0.8× to 1.2× spot over 60 points; jensolson uses 20 points 10 SPX points apart ([Perfiliev](https://perfiliev.com/blog/how-to-calculate-gamma-exposure-and-zero-gamma-level/); [jensolson GEX.py](https://github.com/jensolson/SPX-Gamma-Exposure/blob/master/GEX.py)).

**Vendor (OptionMetrics); Inference for UW:** vendor history can be revised. OptionMetrics IvyDB's revision log records "historic patching" (v4.0) and a "historic recalculation of Implied volatilities" (v5.0), so the same date pulled in 2019 and in 2021 can differ ([IvyDB manual v5.0](https://lib.tsinghua.edu.cn/PDF/OptionMetricsshiyongzhinan.pdf)). The same document is the best template for reproducibility. It records exactly which quote time (15:59 ET since July 2009), rate curve, dividend model and exercise model sit behind each stored IV.

**Inference:** the pragmatic hybrid is method (b), with per-print IV from the UW tape standing in for (c), anchored against (a) and (d) at the instants they exist. Every cell is tagged measured or modeled, and the two are never silently blended ([reconstruction notes, after IvyDB and Cboe DataShop](https://datashop.cboe.com/options-intervals)).

### Why "OI plus today's flow" cannot rebuild the dealer book

Adding signed intraday volume to the morning's OI is the obvious way to cure method (b)'s fixed positions. The evidence says it cannot work:

- **The tape carries neither the counterparty type nor the open/close flag** that decide whether a trade changes the dealer's book. Cboe can see "for every transaction whether it's customer or market maker, buy or sell, opening or closing"; outsiders cannot ([Cboe 2023](https://www.cboe.com/insights/posts/volatility-insights-evaluating-the-market-impact-of-spx-0-dte-options)).
- **Gross volume overstates the net change by an order of magnitude:** 52k buys against 55k sells left market makers about 3k short (same source).
- **Even the side is unreliable.** On CBOE data with known direction, the quote rule classifies about 83% of classifiable trades correctly, Lee-Ready 80% and the tick rule 59%, with the worst errors on outside-quote and complex trades ([Savickas & Wilson, JFQA 2003](https://ideas.repec.org/a/cup/jfinqa/v38y2003i04p881-902_00.html)).
- **Most 0DTE trades are multi-leg:** over 95% are done in a limited-risk format, so one leg's aggressor says little about the package's gamma ([Cboe 2025](https://www.cboe.com/insights/posts/0-dt-es-decoded-positioning-trends-and-market-impact)).

**Established:** the only data that would fix this is origin-coded open/close data, and it is sold **per exchange**: complete for SPX (which trades only on Cboe) but only partial for multi-listed products such as SPY, whose volume is spread across many exchanges. Cboe sells its own at about $2,000 a month for intraday updates every 10 minutes ([SEC 34-99326](https://www.sec.gov/files/rules/sro/cboe/2024/34-99326.pdf); [Cboe DataShop](https://datashop.cboe.com/open-close-cboe-c2-exchange)), and it is not on either plan.

### Flip and walls: three flip methods, one honest rule set

The three flip methods answer different questions:

- **Profile sweep:** the spot at which the whole book's gamma would be zero. This matches SqueezeMetrics' and SpotGamma's wording ([SpotGamma](https://spotgamma.com/options-key-levels-explained/)).
- **Per-strike or cumulative crossing at today's spot:** where along the strike axis today's book changes sign. UW's `gex-levels` interpolates `gamma_flip` "between the two strikes", warns that it "can be `null` or far from spot, so do not use it for regime detection", and lists up to five `nearby_flips` because "no single level is decisive" ([UW GEX Levels](https://api.unusualwhales.com/docs/api/gexgreeks/gex-levels.md)).
- **Proprietary regime levels:** HVL, Volatility Trigger.

FlashAlpha reports that an ungated flip "crossed from below spot to above spot and back five times in thirteen minutes, on an underlying that moved 0.03%". It publishes with "no temporal smoothing" and never carries a level forward ([FlashAlpha](https://flashalpha.com/articles/gamma-flip-methodology-stable-zero-gamma-level)); these are self-reported figures.

The walls agree only at the core: the argmax of call-side and put-side gamma. Two departures matter:

- UW's `put_wall` is the strike below spot with the largest **positive net** gamma, a different quantity from SpotGamma's "largest net put gamma" ([UW GEX Levels](https://api.unusualwhales.com/docs/api/gexgreeks/gex-levels.md); [SpotGamma](https://spotgamma.com/call-wall-put-wall-explained/)).
- Slayer's `pickWalls` is closest to UW's side-of-spot net rule.

**Inference:** within a session, any move of a level on an OI-only book comes from spot, IV or time, never from positioning, and should be labelled that way. Gamma re-weights toward strikes near spot, so a wall can hop between neighbours with no change in positions.

## A bitemporal data model: every cell knows when it could have been known

**Established:** point-in-time storage keeps two times on every value: the event time, and the knowledge time at which it became knowable. Queries filter knowledge time ≤ t, and revisions are new rows, never edits ([ere](https://pypi.org/project/ere/); [Tradevo on restatements](https://dev.to/tradevodata/as-reported-vs-restated-financial-data-why-the-difference-matters-for-backtesting-1big)). The join primitive is the as-of join. kdb+ `aj` takes the most recent right-hand row by time for each left row, and `aj0` returns the matched row's own time, which is how staleness gets measured ([KX aj](https://code.kx.com/q/ref/aj/)).

**Established:** OI is a known-lag input. OCC computes it overnight from the day's opening and closing trades and exercises, it is shown the next morning, and it stays static all day ([OIC](https://www.optionseducation.org/news/open-interest-why-it-matters); [Options Playbook](https://optionsplaybook.com/options-introduction/open-interest)). UW stamps it so that **the row dated D holds the count after D−1's close**. This was verified live on newly listed contracts: SPY261030C00790000 showed OI 0 on 2026-04-27 with volume 5, and OI 5 on 2026-04-28 ([UW historic](https://api.unusualwhales.com/api/option-contract/SPY261030C00790000/historic), live probe 2026-10-13).

The model below is a proposal (**Inference**) built on those principles and on IvyDB's separation of raw, parameter and derived files.

| Record | Key | Value fields | Event time | Knowledge time | Notes |
|---|---|---|---|---|---|
| `contract` | OCC symbol | root (SPX/SPXW…), underlying, expiry, type, strike, multiplier/deliverable, settlement AM/PM, `last_trade_at` (exact instant) | listing date | first seen (`option-chains?date=`) | AM-settled SPX stops trading the business day before ([Cboe](https://www.cboe.com/tradable_products/sp_500/spx_options/specifications/)) |
| `oi_count` | contract, `count_date` | oi, flex_oi_transfer | close of `count_date` | ~06:45 ET next session ([UW spec](https://api.unusualwhales.com/api/openapi)) | Valid for minutes of session `count_date`+1 only |
| `spot_bar` | underlying, minute | o, h, l, c, volume, `market_time` | bar start | bar end | UW `ohlc/1m`; Massive as cross-check |
| `iv_obs` | contract, `observed_at` | iv, underlying_at_obs, kind ∈ {tape print, minute high/low, chain snapshot, prior-close EOD} | `observed_at` | `knowable_at` = when the market could have known it (a print's `executed_at`, a minute bar's end, a live read's receipt, the prior close's 16:00 ET; OI: the morning it is published) — **never** the pull time; `pulled_at` is stored separately, for revision audit only | Tape prints carry per-print IV and underlying price ([UW data lake](https://unusualwhales.com/skills/uw-options-data-lake-skill.md)) |
| `vendor_book` | ticker, `received_at` | per-strike raw fields **plus each strike's own `time` and `price`** | per strike `time` | `received_at` | Strikes "can differ in `time`, possibly by hours" |
| `vendor_total` | ticker, minute | gamma/vanna/charm × oi/vol/dir, price | `time` | `received_at` | `/spot-exposures` |
| `params` | vintage | r curve, q, day-count, τ rule, sign rule, `model_version` | effective date | the date it was set | IvyDB precedent |
| `cell` (derived) | session, lens, minute, strike | value, coverage (share of the strike's gamma priced from fresh IV), `stale_since`, provenance ∈ {measured, modeled, carried, missing} | minute | max `knowable_at` of its inputs (must be ≤ minute end; `pulled_at` plays no part in this rule) | `inputs_hash`, `model_version` |

Three conventions turn this into correct numbers.

**The τ convention.** τ must run to each contract's exact last-trading instant, in fractions of a year: 16:00 ET for PM contracts, 13:00 on half days, and the prior session for AM-settled SPX. The whole-day floor in common code (Perfiliev's 1/262; jensolson simply drops 0DTE) understates late-session 0DTE ATM gamma by an order of magnitude: with 15 minutes left the exact-τ gamma is 0.0996, while the 1/262-year floor gives 0.0086 — about 11.6× lower — at the same 15% IV (**Established** arithmetic, recomputed; corrected 2026-10-13 — an earlier version compared 0.0996 with 0.0195, which is the exact-τ value at 6.5 hours, not the floor). Slayer's `data/expiryClass.ts` already encodes AM settlement and half days and should be the single source. **A contract on a later day is priced on whole calendar days.** That is the τ UW's vols are inverted under, measured 2026-10-13, and a vol must be priced on its own τ (Review corrections, below). The exact instant governs today's contracts.

**The minute's spot.** It is the bar's close, so a column's knowledge time is the bar's end. The column should be drawn at the candle it describes, and the hover should say so.

**Missing data.** A contract with no IV observation stays out of the sum, and the strike's `coverage` drops. It is not zero-filled. **Inference:** IV carried forward between observations *is* the sticky-strike assumption, which Derman calls "a poor man's attempt to preserve the Black-Scholes model". It suits a range-bound day "without a significant change in current realized volatility" and is biased in trends and jumps ([Derman 1999](https://hpirotte.ulb.be/INGESTriskmgt/readings/Derman%20(1999)%20-%20Volatility%20regimes.pdf)). A carried cell is therefore modeled and must keep its `stale_since`.

## Architecture: raw log on the server, a pure function to the grid, beads in the browser

**Inference** (assembled from the IvyDB and kdb+ practice cited above; no single source prescribes it): the pattern has three parts:

1. Immutable raw inputs are stored append-only in time-sorted, columnar form.
2. Exposure is derived as a pure function `f(inputs as-of t, model_version)`.
3. The derived grid is cached by `(underlying, session, lens, model_version, inputs_hash)` and replayed through as-of joins.

IvyDB's separate raw, parameter and derived files are a working precedent ([IvyDB manual](https://lib.tsinghua.edu.cn/PDF/OptionMetricsshiyongzhinan.pdf)). Parquet's per-column-chunk min/max statistics reward data sorted by the filter column ([Apache Parquet](https://parquet.apache.org/docs/file-format/_print)).

The browser is the wrong place for the raw log. Under storage pressure browsers evict the least recently used origin, and "all of its data, not parts of it, is deleted at the same time" unless `navigator.storage.persist()` was granted ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)).

```
 UW / Massive ──► server/feed.ts proxy (keys) ──► RECORDER (server process, append-only, git-ignored)
                                                    raw/<NAME>/<session>/{oi,iv_obs,spot,vendor_book,vendor_total}.jsonl
 nightly BACKFILL (full tape, chains, close books) ─┘
                                                    │ as-of join at each minute (knowledge ≤ t)
                                                    ▼
                         ENGINE f(inputs≤t, model_version) → Float32Array[strikes × minutes] per lens
                                                    + provenance bitmask + stale_since + coverage
                                                    │ served by the proxy as one file per (name, session, lens, version)
                                                    ▼
             browser: IndexedDB cache (persist() requested) → gexNodesPrimitive beads, one column patched per minute
```

**Inference, on size and speed.** A name-day of about 400 strikes × 390 minutes is about 156k cells, roughly 0.6 MB per lens as Float32 before compression. That is trivial on disk and in the browser. OI is static intraday, so appending a column means repricing each contract once at the new spot and τ, which costs O(contracts). A sweep flip over a 40-point grid multiplies that by 40, which is still small. The heavy item is the raw tape: about 12.85M rows a normal day, about 2 GB zipped on a heavy day ([UW data lake](https://unusualwhales.com/skills/uw-options-data-lake-skill.md)). It belongs on the server, filtered to the names Terrain shows and reduced to the last IV and underlying price per contract-minute, then discarded.

**Inference, on rendering:** one name-day needs no WebGL. A cached bitmap, or Slayer's existing bead primitive, with one column redrawn per update is enough. Cells should be discrete, with no bilinear or Gaussian smoothing, because smoothing invents gradients between strikes that hold no OI ([Matplotlib](https://matplotlib.org/stable/gallery/images_contours_and_fields/interpolation_methods.html), and the visualization notes).

A signed field takes a diverging colour scale centred on true zero, with a colour bar. Rainbow maps "add artificial boundaries", and colour-induced misreading can exceed "seven percent of the displayed data variation" ([Crameri et al. 2020](https://pmc.ncbi.nlm.nih.gov/articles/PMC7595127)). The reference for size or colour must not be fitted over the whole day when the field is presented as what was visible at t. That is a visual form of look-ahead (**Inference**). Bookmap's percentile cut-offs show how relative scaling shifts meaning as the book changes ([Bookmap](https://bookmap.com/knowledgebase/docs/KB-SettingUpAndOperating-HeatmapSettings)).

## What the two Basic plans actually deliver

**Vendor, verified by live calls on 2026-10-13:** UW API Basic ($150 a month) answers every endpoint below for **730 trading days**. Earlier dates get 403 `historic_data_access_missing` with "earliest date … 2023-11-10" ([UW spot-exposures probe](https://api.unusualwhales.com/api/stock/SPY/spot-exposures?date=2023-10-16)). Basic excludes websockets and "1-minute SPX Market Maker Exposure" ([UW pricing](https://unusualwhales.com/pricing?product=api)), and allows three concurrent requests; the fourth gets 429 (`docs/data-feed.md`).

Massive Basic is free, 5 calls a minute, end-of-day, 2 years. It excludes snapshots, greeks, IV, open interest, trades, quotes and flat files on every route, and its docs list no historical OI or greeks endpoint on any plan ([Massive pricing](https://massive.com/pricing?product=options); [Massive docs index](https://massive.com/docs/llms.txt)). `I:SPX` answered 403.

| Input | Source on these plans | Time resolution and stamp | Usable as |
|---|---|---|---|
| OI per contract | UW `option-chains?date=&greeks=true`; `option-contract/{id}/historic`; `oi-per-strike?date=` (strike totals) | Daily; row D = count after D−1 close (verified on `historic`) | Position input |
| Today's chain: OI, IV, greeks, NBBO | UW `/option-contracts` (no `date`; IV "for the last transaction"; no charm or vanna) | Current only; `last_tape_time` per contract | Point-in-time **only if recorded when read** |
| Past chain IV and greeks per contract | UW `option-chains?date=&greeks=true` | End of day (`last_tape_time` after the close); some null rows ([probe](https://api.unusualwhales.com/api/stock/SPY/option-chains?date=2024-10-15&greeks=true&limit=2)) | Prior-close IV seed |
| Per strike × expiry greeks incl. charm, vanna, IV | UW `greeks?date=&expiry=` (no OI) | Date only; 205 strikes returned for one past expiry | Pricer and unit validation |
| Per-print IV, greeks, theo, OI, underlying price, NBBO | UW `option-trades/full-tape/{date}` (302 to a signed zip on Basic) | `executed_at`, microseconds | Point-in-time IV for past sessions |
| Per-contract minute IV high/low | UW `option-contract/{id}/intraday?date=` (369 rows for one contract-day) | 1 minute; no OI, NBBO or greeks | Today's minute IV backfill |
| Underlying minute bars | UW `ohlc/1m?date=` (≤2,500 rows); Massive Stocks Basic (end-of-day; stops at the session before) | 1 minute | Spot path |
| Index level (SPX, NDX, RUT) | **Not available** (UW 422 or null; Massive 403); UW's index `price` is the ATM strike | — | Proxy only |
| Whole-ticker exposure by minute | UW `/spot-exposures?date=` (~06:30–16:00 ET; 534 rows for SPY 2025-10-14) | ~1 minute | **Validation series** |
| Per-strike exposure | UW `/spot-exposures/strike?date=`; `/expiry-strike` since 2025-01-16 | **One snapshot per date**; a past date is the close | Measured layer (live); close validation (past) |
| Daily greek exposure by strike | UW `/greek-exposure/strike?date=` | Once a day at the open; shares | Open-column cross-check |
| Levels | UW `/gex-levels` (default `source=vol` since 2026-08-22; `source=oi` restores OI) | Echoes `date` and `time` | Cross-check only |
| Option quotes over time, intraday OI, vega exposure, origin-coded positions | **Not available** | — | — |

Sources for the table: [UW OpenAPI](https://api.unusualwhales.com/api/openapi), [UW GEX Levels](https://api.unusualwhales.com/docs/api/gexgreeks/gex-levels.md), [UW data lake](https://unusualwhales.com/skills/uw-options-data-lake-skill.md), [Massive custom bars](https://massive.com/docs/rest/options/aggregates/custom-bars.md), [Massive chain snapshot](https://massive.com/docs/rest/options/snapshots/option-chain-snapshot.md), and the live probes.

The table makes the decisive point plain. **No endpoint on either plan returns per-strike exposure for a time of day.** "There is no time-of-day parameter: the endpoint takes a `date`, never a time" ([UW OpenAPI](https://api.unusualwhales.com/api/openapi)). For any minute the terminal did not record, the strike profile can only be computed.

Massive Basic adds little here. Its option minute bars are trade-derived OHLCV with no quotes, and its stock bars duplicate UW's at end-of-day latency (**Inference**).

## Eleven ways the field can mislead

1. **The sign is the largest error and cannot be measured.** It is supported for index puts by observed 1996–2001 data and contradicted for single stocks ([GPP](https://www.nber.org/papers/w11843.pdf)). Customer put selling, speculative call buying and the short legs of spreads all mis-sign under it. Netting calls against puts at one strike can show zero where gross exposure is large (**Inference**).
2. **OI is a prior-close count.** Everything opened and closed today is invisible. SPX 0DTE averaged about half of SPX volume in August 2023 ([Cboe](https://www.cboe.com/insights/posts/volatility-insights-evaluating-the-market-impact-of-spx-0-dte-options)), so a same-day expiry's real positioning is largely absent from an OI book during its only session.
3. **IV dynamics are assumed between observations.** Sticky-strike and sticky-delta give different deltas and so different flows ([Derman](https://hpirotte.ulb.be/INGESTriskmgt/readings/Derman%20(1999)%20-%20Volatility%20regimes.pdf)). Nothing found quantifies the difference for intraday SPY in 2024–2026.
4. **τ dominates late-session 0DTE.** A day-count floor understates ATM gamma about 11.6× with 15 minutes left (exact τ 0.0996 against 0.0086 under a 1/262-year floor, at 15% IV), and an AM-settled monthly loses a session that a PM weekly of the same date keeps ([Cboe](https://www.cboe.com/tradable_products/sp_500/spx_weekly_options/specifications/)).
5. **UW's own books are stale per strike.** "A price move alone does not recalculate a strike", and strikes in one response can be hours apart ([UW OpenAPI](https://api.unusualwhales.com/api/openapi)). A captured book after a fast move is a mixture of times, not a snapshot.
6. **Index spot is a proxy.** UW's index `price` is the ATM strike, and neither plan carries the SPX level, so SPX, NDX and RUT fields rest on a stand-in for S. With S² in the per-1% form, a 0.1% error in S is about a 0.2% error in scale. The bigger effect is on which strikes sit near the money (**Inference**).
7. **Early rows predate the OI load.** UW's minute series starts near 06:30 ET while its OI change lands about 06:45 ET, and the first `_oi` values on 2025-10-14 were orders of magnitude smaller (live probe). Rows before 07:00 ET are suspect.
8. **Vendor methods move.** UW switched `/gex-levels` to directionalized volume by default on 2026-08-22 ([UW GEX Levels](https://api.unusualwhales.com/docs/api/gexgreeks/gex-levels.md)). IvyDB recalculated history in place ([IvyDB](https://lib.tsinghua.edu.cn/PDF/OptionMetricsshiyongzhinan.pdf)). Without a stored `pulled_at`, history drifts silently.
9. **Look-ahead hides in small places:** tomorrow's OI on today, the close's IV on the morning, a flip drawn back from the closing book, a scale fitted on the whole day, columns rescaled to a later vendor total ([reconstruction notes, after AnalystPrep](https://analystprep.com/study-notes/cfa-level-2/problems-in-backtesting/)).
10. **Levels are bistable.** Flips can oscillate on a 0.03% move ([FlashAlpha](https://flashalpha.com/articles/gamma-flip-methodology-stable-zero-gamma-level)), and walls hop between neighbouring strikes of similar size with no positioning change.
11. **The window rolls.** UW's 730-trading-day limit means a session that falls out of the window is gone for good unless the recorder archived its inputs. The S² scaling also makes per-1% figures incomparable across names without normalization ([formulas notes, after Perfiliev](https://perfiliev.com/blog/how-to-calculate-gamma-exposure-and-zero-gamma-level/)).

## Recommendations for Slayer: keep, change, drop

### The verdicts on the current choices

| Current choice | Verdict | What to do | Evidence |
|---|---|---|---|
| Field built from UW `/spot-exposures/strike` books captured while the browser was open | **Change** | Keep capturing, in the server recorder. Store each strike's own `time` and `price`, not only the receipt time. Draw the books as a *measured reference* (hover readout, optional dots like TRACE's 10/30/60-minute history marks), not as the field | Per-strike staleness of hours; gaps whenever no tab is open; whole-origin eviction ([UW OpenAPI](https://api.unusualwhales.com/api/openapi); [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria); [TRACE manual](https://spotgamma.com/wp-content/uploads/2025/07/TRACE-User-Manual-Final-Version.pdf)) |
| Rebuild from `/option-contracts` (current OI + IV) × UW 1-minute bars | **Keep the structure, change the IV** | OI from `/option-contracts` is correct for today's minutes (prior-close count, static intraday). Its IV is the latest trade's, so applying it to earlier minutes is look-ahead. Use IV known at or before each minute. In order of preference: the recorder's own reads of `/option-contracts`, then `option-contract/{id}/intraday` minute IV for minutes before recording began, then the prior close's IV from `option-chains?date=D−1`, carried sticky-strike with `stale_since` | OI timing ([OIC](https://www.optionseducation.org/news/open-interest-why-it-matters)); "a later IV snapshot applied to earlier minutes" is look-ahead ([reconstruction notes](https://pypi.org/project/ere/)) |
| Calibration restricted to readings at or before each minute | **Keep the causal rule; change what is calibrated** | Take τ as the vols' own: the clock UW inverted them under, measured directly (the τ section — today's expiry on calendar time to its exact last-trading instant with no floor, a later one on whole calendar days), never a free parameter fitted to UW's books, since a fit could select the day floor that understates late 0DTE gamma ~11.6×. Fit *only* what cannot be derived — UW's charm and vanna scale and its sign mapping — offline against captured UW books, and freeze them in `model_version`. Do not rescale modeled magnitudes to UW's readings minute by minute. One scalar total cannot correct a 400-strike profile, and it imports UW's stale-strike artefacts and undisclosed model into every cell. Show the residual against `/spot-exposures` instead | Hybrids must not blend silently. Comparisons need matched conventions or "the errors measure conventions, not reconstruction quality" (reconstruction notes, after [IvyDB](https://lib.tsinghua.edu.cn/PDF/OptionMetricsshiyongzhinan.pdf)) |
| Per-column flip with gaps | **Keep** | Keep `pickFlip` (the sign-change midpoint nearest spot, or `null`) per column, so Terrain and Pinpoint read one rule. Draw a gap on `null`, never a carried value. Add the other crossings near spot to the hover, as UW's `nearby_flips` does. If a profile-sweep zero-gamma is wanted, add it to `core/walls.ts` for every room at once, with a stated band, a bracketing root search and `null` outside it | [UW GEX Levels](https://api.unusualwhales.com/docs/api/gexgreeks/gex-levels.md); [FlashAlpha](https://flashalpha.com/articles/gamma-flip-methodology-stable-zero-gamma-level); sweep practice ([Perfiliev](https://perfiliev.com/blog/how-to-calculate-gamma-exposure-and-zero-gamma-level/)) |
| Discrete beads | **Keep, fix the scale** | One bead per listed strike per actual column, no interpolation. `gexNodesPrimitive.ts` sizes beads against the 85th percentile of per-moment maxima over **the whole loaded field** (lines 649–669). A later column therefore resizes earlier ones, so in replay compute that reference from columns at or before the clock, or from the prior session. State the scale in the legend | [Matplotlib](https://matplotlib.org/stable/gallery/images_contours_and_fields/interpolation_methods.html); fixed or as-of-t scaling ([Bookmap](https://bookmap.com/knowledgebase/docs/KB-SettingUpAndOperating-HeatmapSettings); [Volfix](https://help.volfix.net/hc/en-us/articles/35575448049565)) |
| Planned server-side recorder | **Keep and build first** | The recorder sits in the proxy's process beside `server/feed.ts`'s `Gate` and writes append-only files per name-session. Every minute it records `/spot-exposures/strike`, `/spot-exposures` and `/gex-levels?source=oi`. Every few minutes it records `/option-contracts`, which makes today's IV point-in-time. Each row carries `received_at`. Live capture is the only way to hold the vendor's number at t, and archiving beats the 730-day roll-off | Method (a) (reconstruction notes); live probe of the 2023-11-10 limit |
| "OI + today's flow" lens (on hold) | **Drop as a positioning lens** | Do not add volume to OI. If a flow view is wanted, show UW's own `_dir` or `_ask`+`_bid` figures as a separate lens named for what they are (aggressor-side flow, UW's classification). Never sum them into the OI book | Opening/closing and counterparty unknown; 3% net of gross; 17–41% classification error; over 95% multi-leg ([Cboe](https://www.cboe.com/insights/posts/volatility-insights-evaluating-the-market-impact-of-spx-0-dte-options); [Savickas & Wilson](https://ideas.repec.org/a/cup/jfinqa/v38y2003i04p881-902_00.html); [Cboe 2025](https://www.cboe.com/insights/posts/0-dt-es-decoded-positioning-trends-and-market-impact)) |

### The UW endpoints named in the brief, one by one

**`option-chains?date=&greeks=true`: use it as the universe and the seed, and verify its OI date.** For session D it supplies the contract universe "present at the given day". `date=D−1` gives the prior close's IV, the latest IV knowable at D's open. Its OI dating has not been verified row by row, unlike `option-contract/{id}/historic`. The recommendation is to sample twenty contracts, compare against `historic`, and record the rule before trusting it. Null greeks and IV rows stay null. Paging at ≤500 rows behind a 3-request gate is a nightly backfill job, not a page-load call ([UW OpenAPI](https://api.unusualwhales.com/api/openapi); live probe).

**`greeks?date=&expiry=`: use it as the pricer's referee.** It returns per-strike delta, gamma, vega, charm, vanna and IV for one expiry with no OI. That makes it the cleanest way to settle the charm question: price the same strike with the house pricer and UW's IV, and read whether UW's per-contract charm is per day or per year. The same test applies to vanna's scale. It should not be a minute input: it carries a date and no time.

**`option-trades/full-tape/{date}`: use it, server-side only, as the point-in-time IV source for past sessions.** Each print carries `implied_volatility`, `delta`, `gamma`, `underlying_price`, `open_interest`, NBBO and `executed_at`, and it is reachable on Basic ([UW data lake](https://unusualwhales.com/skills/uw-options-data-lake-skill.md); live probe: a 302 to a signed zip). The pipeline is: download once after the session, filter `underlying_symbol` to Terrain's names, keep the last IV and underlying price per contract-minute, and delete the zip.

Greeks should be recomputed with the house pricer from that IV at each minute's spot and τ, not taken from the print. UW's model is undocumented, and a print's greeks belong to the print's instant and price. The prints' own greeks can serve as a spot check. Two facts remain unverified: when the day's zip becomes available, and whether its per-print `open_interest` is that morning's count.

**`/spot-exposures` per minute (whole ticker): use it as the validation series, never as a calibration target.** It is the only intraday exposure series UW serves, and it reaches back the full 730 days (SPY 2024-10-15: 538 rows; live probe). The comparison runs on `gamma_per_one_percent_move_oi` after flipping it into the house sign. The tracked statistics are three: the sign agreement of net GEX, the rank correlation through the day, and the ratio band. The house's charm is compared after the ÷365.

UW's totals inherit stale strikes ("approximately" the sum of strike rows), an ATM-strike price for indices, and suspicious pre-07:00 ET rows. A residual is therefore evidence to investigate, not proof the rebuild is wrong.

**`/spot-exposures/strike?date=` for past dates: the per-strike check, for every past session.** A past date returns the close book with one shared `time` (SPY 2025-10-14: 20:00Z, price 662.23; live probe). That is the only per-strike vendor profile for history, and it pairs with the rebuild's **last column**. The metrics are those from the reconstruction notes:

- MAE normalized by the book's total absolute exposure
- Spearman rank correlation of the strike profile
- flip error in strikes
- exact hits on the call and put walls

This check is available for all 730 trading days, which makes it the strongest validation set on the plan (**Inference**).

**`/gex-levels`: record it, compare against it, do not draw it.** Call it with `source=oi`, because the default is directionalized volume since 2026-08-22. Store `date`, `time` and `source`, and use it to cross-check flips and walls. Its `put_wall` is a different quantity from `pickWalls`' put wall, and its `gamma_flip` interpolates where `pickFlip` takes the midpoint. Drawing it beside the house's levels would put two definitions on one chart ([UW GEX Levels](https://api.unusualwhales.com/docs/api/gexgreeks/gex-levels.md)).

**Smaller roles for the rest.** `/greek-exposure/strike?date=` (shares, once a day at the open) checks the first column after unit conversion. Massive Basic supplies underlying minute bars as a cross-check for UW's `ohlc/1m` on past sessions and is not used for IV. For SPX, NDX and RUT the field should carry a lower-confidence flag until a defensible index level exists. Slayer already uses "an index is its book's price"; two candidates for a better level are an implied forward from SPXW put-call parity on the tape, and SPY scaled. Both are speculation, untested here.

### The validation suite that should gate each `model_version`

**Inference**, drawing on established numerical practice, gives the layers ([reconstruction notes](https://pypi.org/project/vollib/)):

1. Price, delta, gamma, vega and charm against a reference implementation such as `vollib`'s pure-Python reference or QuantLib, to a relative error near 1e-10.
2. Finite-difference greeks against analytic greeks. The worked example above passes to 8 significant figures.
3. Put-call parity residuals on European pairs, as a check on r and q.
4. IV round-trips. Jäckel's method makes machine precision a fair target ([lets_be_rational](https://pypi.org/project/lets_be_rational/)).
5. Golden files: a pinned input set must produce a byte-identical grid, and any change requires a version bump.
6. A **look-ahead test**: perturb any input whose knowledge time is after t, and assert that cell t is unchanged.

The reconstruction checks then run against captured books at matching instants, against the close books for history, and against the per-minute totals. None of them is "truth". **Established:** no independent benchmark of true per-strike GEX exists, because vendor numbers are themselves modeled.

### Build order

**Inference:** the order follows from what is irreversible.

1. **The recorder.** Every unrecorded live minute and every session that ages past 730 days is lost.
2. **The point-in-time rebuild for today:** OI × repriced greeks × minute spot, with recorded or minute IV, provenance on every cell, and the scale reference fixed as of t.
3. **The nightly backfill:** tape IV for past sessions, chains for the seed, and close books as validation.
4. **The validation dashboard in development:** residuals per session, so that a `model_version` is promoted on evidence.
5. **Only then optional additions:** a sweep flip in `core/walls.ts` for every room, and a labelled `_dir` flow lens.

## Review corrections and added analysis (2026-10-13)

An independent review re-derived the math and checked this report against itself. Every point below was re-checked here before it was accepted; the corrections are applied in place above and listed here.

**Errors corrected.** (1) The hedging direction in the worked example was backwards: a short-gamma book's delta falls as price rises, so re-hedging means **buying** into a rise (about 9,733 shares, ≈$48.7m, for +1% in the example) and selling into a fall. (2) The τ-floor comparison quoted the wrong figure: at 15% IV with 15 minutes left the exact-τ ATM gamma is 0.0996 and the 1/262-year floor gives 0.0086, an understatement of about **11.6×** (not ~5×; 0.0195 is the exact value at 6.5 hours). Both recomputed here. (3) The data model merged two times: a cell's look-ahead rule uses `knowable_at` (a print's execution time, a bar's end, a live read's receipt, the prior close for a carried close vol, the publication morning for OI), never `pulled_at`, which is kept only to audit vendor revisions. (4) τ was listed among the conventions to fit against UW; it is not a fitted parameter. It must be the τ the vols were inverted under, measured directly (below). For today's contracts that is exact calendar time with no floor, so the late-0DTE understatement a fitted day floor would cause does not arise.

**The τ basis must match the IV's — measured.** Only total variance σ²τ is pinned by an option's price, so an IV is meaningful only with the τ it was inverted under. Calendar and trading-time τ differ by ~5.4× with 6.5 hours left (≈2.3× in gamma).

An earlier version of this section called an after-hours repricing "consistent with calendar time". A second review pointed out that the check could not tell the conventions apart, and that claim is withdrawn.

The discriminating test is in `docs/research-2026-10-13/uw-vol-convention.md`. UW's `theo` equals each print's price, so UW solved its vol from that price. Re-inverting the same price under each candidate clock and carry gives UW's vol back only under UW's own. On 8,096 in-session prints of six names on 2026-10-12, UW's convention is:

- European Black–Scholes at r 4.15% and no dividend;
- **today's expiry on calendar time to its 16:00 close;**
- **a later expiry on whole calendar days ÷ 365, held all session.** The next day's contract implies 24.00 hours both at 09:59 and at 15:44.

Under UW's convention, UW's vol comes back within a median 0.001–0.006 vol points, and UW's gamma within 0.001–0.03%, through 60 days. Under the alternatives, a 1-day contract misses:

- calendar time to the close: by 0.53 vol points and 2.7% in gamma (1.3 points and 4.7% at the open);
- trading time: by 2.9 points and 18% (today's contracts by 5.5 points and 53%).

The field now prices each contract on UW's clock and carry (`trailField.ts` `UW_VOL_CONVENTION`, model `trail-2026-10-13.3`). There is no floor on today's contracts. **Established** for the 2026-10-12 prints of these six names. A half day's 13:00 close and a second session are checked live (Tuesday 2026-10-13, 11:30 New York).

**A European pricer on American contracts — measured.** SPY and single-name options are American. UW's vols and gammas are European Black–Scholes (above), and so is the field's pricer, at UW's carry: r 4.15%, q 0. The house's greeks elsewhere use r 4.2% and q 1.2% (`core/carry.ts`).

An earlier version cited the τ check as evidence that the gap is small. That check did not measure it, and the claim is withdrawn.

Measured on 48 near-the-money SPY prints, with each style's vol inverted from the same price on the same CRR tree (`docs/research-2026-10-13/uw-vol-convention.md`):

- calls: no gap, since no dividend falls before expiry;
- puts at 1–11 days: 0.6% median;
- puts at 12–60 days: 5.4% median, 7.6% max, the American gamma higher.

Weighted by where SPY's 2026-10-12 book holds its gamma, the gap moves a near-money strike's gamma by an estimated 0.1–1.3%. Not measured: single names with an ex-dividend date inside 60 days (an American call's early exercise), and deep in-the-money puts. The gap is disclosed. An American pricer would need every vol re-inverted under it each minute. Put–call parity (validation layer 3) applies to European SPX only.

**SPX and the other indices.** For SPX the minute spot path does not exist on these plans, and UW's "price" for an index is the at-the-money strike. With 15 minutes left, 1σ of SPX's remaining move is about 4 points while the ATM-strike proxy can be off by up to 2.5 points (half the 5-point spacing) — about 0.6σ, enough to put spot on the wrong side of the heaviest strike. A "lower-confidence flag" undersells this: **a late-session SPX 0DTE field is not usable without a real index level.** Slayer therefore draws no field for an index until a defensible level exists (candidates: an implied forward from SPXW put–call parity on the tape; SPY scaled — both untested).

**What the field actually is.** With open interest fixed all day, the trail is the morning's positions re-priced minute by minute:

- spot and time move it every minute;
- each chain read, every ten minutes, replaces the vols of the contracts that traded;
- between reads, each contract keeps its last vol (sticky-strike).

An earlier label, "today's opening book re-evaluated along the price path", fitted only a field whose vols never change, and it is replaced. The bead card now reads **"Today's opening positions re-priced along the price path, each contract on its latest traded vol"**. The level moves come from spot, vol or time, never from positioning.

**The Cboe evidence cuts both ways.** Cboe's finding that net market-maker 0DTE gamma is small argues against the flow lens, and also means stale OI costs less than it seems — and that intraday hedging pressure is itself small. The field shows where exposure would sit under the assumed sign, not that it moves the market.

**Request volume and storage, measured on the recorder as built.** An earlier version described "three endpoints a minute"; the recorder reads two a minute and the chain every ten. Per watched name and 390-minute session:

| Read | SPY calls | AAPL calls |
|---|---|---|
| Strike book and UW's whole-book series, once a minute each (2 × 390) | 780 | 780 |
| Chain every ten minutes: 39 reads a session plus one on first watch (SPY 9 pages of 500, AAPL 3) | ≈ 360 | ≈ 120 |
| The session before's close chain, once (SPY 13 pages, AAPL 4) | 13 | 4 |
| One price read | 1 | 1 |
| **Total a session** | **≈ 1,155** | **≈ 905** |

Six SPY-sized names come to ≈ 6,900 calls a session. SPX's chain is several times SPY's, so its pages would dominate.

**UW Basic's limits, as observed:**

- requests a day are unlimited (UW's pricing page);
- the per-minute header reads 1,000,000;
- **three requests at once** is the limit that binds: the fourth of a burst is refused with a 429.

Six names add ≈ 12 calls a minute, plus 54 chain pages every ten minutes, through the proxy's gate of three. The gate is shared with the terminal's own pages, and it queues rather than fails.

Intraday IV backfill through `/option-contract/{id}/intraday` is one call per contract, so it is practical only near the money. The full tape is ≈ 1–2 GB zipped a day; × 730 sessions is ~1 TB, so it must be reduced server-side and discarded.

**The recorder's own archive**, measured on 2026-10-12's reads:

| One read | SPY raw | SPY gzipped | AAPL raw | AAPL gzipped |
|---|---|---|---|---|
| Book | 46 KB | 10 KB | 10 KB | 2 KB |
| Chain | 188 KB | 46 KB | 33 KB | 9 KB |

The close chain is 0.2 MB.

- **While the day is live:** a session's raw files come to ≈ 26 MB for SPY.
- **Gzipped as the day turns:** at most ≈ 6 MB for SPY and ≈ 1.3 MB for AAPL. These bounds gzip each read alone; a day's file compresses better, and the real figure is measured after a whole session.
- **Six SPY-sized names:** at most ≈ 36 MB a session, ≈ 9 GB a year.

**The recorder keeps its history**, gzipped, and never deletes earlier days. Every minute not recorded, or recorded and deleted, is lost for good.

**Tags.** Three design choices were tagged Established and are Inference by this report's own definitions (the three-part architecture, the validation layers, "vendor history is revised" beyond IvyDB); they are re-tagged above. The worked table now states the sign convention of every row.

### The second review (2026-10-13)

A second independent review checked the corrections above. Each point, and what was done:

1. **Accuracy figures that contradicted each other.** One basis now holds throughout: median |IV re-inverted − UW's IV| and median |gamma ÷ UW's gamma − 1|, per expiry, under every convention side by side, at UW's measured carry (`uw-vol-convention.md`).
2. **The calendar-time conclusion was not established.** It was not, and it was wrong for every expiry after today. The discriminating test the review proposed was run (above), and the code was changed to match.
3. **"Confirmed" was premature.** Withdrawn. What is established is stated as established for the 2026-10-12 prints; the rest is open until the live check.
4. **The American-exercise claim cited the wrong evidence.** Withdrawn and measured (above).
5. **The cost figure did not match the design.** It is recounted from the recorder as built, with UW Basic's actual limits named (above).
6. **The two look-ahead bugs.** Both are fixed, in `bd21ad8`:
   - each minute's vol is the newest received at or before the minute's end;
   - the bead scale runs forward (`gexNodesPrimitive.ts`, the running 85th percentile).

   `scripts/trail-field-proof.ts` checks both and runs in `npm test`: "a later read never moves an earlier minute", "a read received after a bar ends is not that bar's" and "columns added on the right never rescale those on the left" (17 of 17 pass with the checks added today).
7. **The label held only with the vol fixed.** Rewritten (above).
8. **The archive size was not estimated.** Measured per read and bounded per session (above).
9. **"11:30 ET today".** That is Tuesday, October 13, 2026, 11:30 New York (15:30 UTC). It is a scheduled live check, not yet run.

Evidence for the points the review could not verify from the report:

- an index draws no field: `trailField.ts`, "An index has no bars on these plans: nothing is asked" (`bd21ad8`);
- the recorder keeps every day, gzipped: `server/fieldRecorder.ts` `prune` (`accf460`);
- the label: `StrikeChart.tsx`, the bead card (`accf460`, rewritten today).

## Unresolved questions

The units of UW's per-contract charm and vanna are undocumented. The spec's "charm × OI × 365" could annualize a daily figure or double-annualize an annual one. The repository's proportion check fixes the ratio to gamma, not the absolute scale, and `greeks?date=&expiry=` can settle it. Whether `option-chains?date=D` stamps OI the same way as `option-contract/{id}/historic` (count after D−1) is unverified, and so is whether the full tape's per-print `open_interest` is the morning's count. When a session's full-tape zip becomes available, and whether UW revises past answers in place, are unknown. Storing `pulled_at` on every raw row is the only defence.

UW's pricing model, rate, dividend and IV source are not published, so a rebuild cannot be expected to match UW exactly; the realistic goal is a stable, explained residual. Nothing found measures whether sticky-strike or sticky-delta better describes intraday SPY or SPX moves in 2024–2026, or how far the flip moves between them. Whether `/gex-levels` takes a past `date` or a time of day was not tested. Which index tickers Massive's Indices Basic covers is not stated. A defensible SPX level on these plans remains open.

Above all, no one outside Cboe and the dealers can measure how wrong the assumed sign is on a given day for a given name. The single-stock evidence of Gârleanu, Pedersen and Poteshman suggests it is often wrong there.

## Conclusion

The research shifts the question from "how do we get the historical field?" to "which uncertainty do we choose to show?". There is no historical strike × time field to download on any plan, and the vendor's own strike books are neither complete in time nor current per strike. A rebuild is therefore not a fallback for missing vendor data. It is the only way to get a field whose every cell has a known model, known inputs and a known knowledge time. Its main error, the assumed dealer sign, is shared by every competitor and every vendor figure, which makes disclosing it a matter of honesty rather than a competitive weakness.

Two current choices quietly let later information into earlier cells. One is the day's latest IV in the rebuild. The other is a bead scale fitted on the whole loaded field. Both are cheap to fix, and both matter more than any refinement of formulas, because Slayer's other rooms judge how a level "held". A level drawn with information from after the fact will look prescient, and that is the one error the reader cannot detect.
