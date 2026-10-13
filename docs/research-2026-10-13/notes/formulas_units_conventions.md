# Dealer exposure metrics: formulas, units and sign conventions (GEX, DEX, VEX, charm, vega)

Researched 2026-10-13. Status tags used throughout:
- **[Textbook]**: standard Black-Scholes-Merton greek math.
- **[Vendor]**: one provider's stated convention.
- **[Code]**: read in open-source code (file and line cited).
- **[Computed]**: computed here from the textbook formulas, with a finite-difference check.
- **[Inference]**: my reasoning from cited material.
- **[Contested]**: sources disagree, or the evidence is mixed.

Every OI-based "dealer" exposure is an **estimate built on an assumed position sign**. No public source cited here observes dealer inventory directly, apart from Cboe's internal trade-level SPX data.

## 1. GEX formulas and units, and which provider uses which

### Takeaway
The same quantity, Γ × OI × 100, is reported at three scales:
- **shares per $1 move**: Γ·OI·100
- **dollars per $1 move**: Γ·OI·100·S
- **dollars per 1% move**: Γ·OI·100·S²·0.01

The 1% version is the de facto public standard (Perfiliev, SpotGamma's stated formula, Unusual Whales, the gex-tracker repo). The original SqueezeMetrics paper defines GEX in **shares**, and in **dollars** for SPX. Figures from different sources cannot be compared until their units are reconciled.

### Cited Findings
- **[Vendor/origin] SqueezeMetrics' original definition, per strike, in shares.**
  - Calls: "GEX = Γ · OI · 100". Puts: "GEX = Γ · OI · (-100)", with the remark "The share adjustment is negative here because for market-makers, where calls represent long gamma, puts represent short gamma."
  - A side note says "When computing for SPX, we denominate GEX in dollars."
  - "The GEX of a stock (or index) is the summation of GEX at every strike price in every available contract."
  - Paper dated March 2016, revised December 2017.
  - [SqueezeMetrics, "Gamma Exposure (GEX)" white paper](https://squeezemetrics.com/download/white_paper.pdf)
- **[Vendor/origin] SqueezeMetrics' worked logic.** "if the gamma of a single 50-delta call option is 10 [delta points], … a market-maker will re-hedge that option to either 40 or 60 delta in the event of any ±1 point move … the market-maker will need to trade 10 shares." In other words, gamma is defined per 1-point move. — [SqueezeMetrics white paper](https://squeezemetrics.com/download/white_paper.pdf)
- **[Code] Perfiliev (blog post dated 3 Feb 2022, data from 1 Feb 2022): dollars per 1% move.**
  - Per option, in words: "Option's Gamma * Contract Size * Open Interest * Spot Price ^ 2 * 0.01".
  - In code:
    ```
    df['CallGEX'] = df['CallGamma'] * df['CallOpenInt'] * 100 * spotPrice * spotPrice * 0.01
    df['PutGEX'] = ... * -1
    ```
  - Total: `(df.CallGEX + df.PutGEX) / 10**9`, in $bn. He reports about −$19bn for SPX on 1 Feb 2022.
  - He explains that S² arises from converting a 1-point delta change into a 1% move (1% × spot).
  - [Perfiliev, "How to Calculate Gamma Exposure and Zero Gamma Level"](https://perfiliev.com/blog/how-to-calculate-gamma-exposure-and-zero-gamma-level/)
- **[Code] Matteo-Ferrara/gex-tracker, `main.py` (HEAD 068584c, branch master).**
  - Line 17: `contract_size = 100`.
  - Line 75: `data["GEX"] = spot * data.gamma * data.open_interest * contract_size * spot * 0.01`.
  - Line 78: `data["GEX"] = data.apply(lambda x: -x.GEX if x.type == "P" else x.GEX, axis=1)`, under the comment "For put option we assume negative gamma, i.e. dealers sell puts and buy calls".
  - Lines 85 and 101: by-strike sums divided by 1e9, axis labelled "Gamma Exposure (Bn$ / %)".
  - Gamma is taken from CBOE's delayed-quote JSON (line 38, `cdn.cboe.com/api/global/delayed_quotes/options/_{ticker}.json`) and not recomputed.
  - [github.com/Matteo-Ferrara/gex-tracker/blob/master/main.py](https://github.com/Matteo-Ferrara/gex-tracker/blob/master/main.py)
- **[Code] jensolson/SPX-Gamma-Exposure, `GEX.py` (HEAD 7c06df7, 2025-07-30): dollars per 1 index point, in $mm.**
  - Lines 100–101: `df['GEX'] = 10**-6*(-100*(df['Flag'] == 'p')*df['Open Interest']*df['Gamma']*df['F'] +100*(df['Flag'] == 'c')*df['Open Interest']*df['Gamma']*df['F'])`. This is Γ·OI·100·F, with puts negative.
  - Line 103: SPY, GLD and TLT are divided by 10, so SPY is expressed per SPX-equivalent point.
  - Line 248 scales non-SPX/NDX tickers by 0.1.
  - The plot title (around line 255) reads "Dealer Gamma Exposure per Index Point (=0.1 ETF pt)"; the y-axis label is "Dealer Gamma in $mm".
  - [github.com/jensolson/SPX-Gamma-Exposure/blob/master/GEX.py](https://github.com/jensolson/SPX-Gamma-Exposure/blob/master/GEX.py)
- **[Vendor] SpotGamma's GEX page (last updated 18 Aug 2026).**
  - Formula: "Dollar GEX per 1% move = Γ × modeled dealer position × contract multiplier × spot² × 0.01".
  - On units: "Some charts report delta change for a $1 underlying move; others convert it to dollar notional for a 1% move … Always check the units before comparing values from two sources."
  - Their illustration: a modeled long-gamma position implies selling about 4,000 shares on a 1% rise.
  - SpotGamma substitutes "modeled dealer position" from its proprietary Options Inventory Model for raw OI. The model's internals are not public.
  - [SpotGamma, Gamma Exposure](https://spotgamma.com/gamma-exposure)
- **[Vendor] Unusual Whales, from the OpenAPI spec downloaded 2026-10-13 at https://api.unusualwhales.com/api/openapi.**
  - Schema "Gex Gamma Per One Percent Move OI": "This is calculated as gamma * open interest * price * price". The volume variant is "gamma * volume * price * price".
  - The `/api/stock/{ticker}/spot-exposures` description: "GEX is the assumed $ value of the given greek (ie. gamma) exposure that market makers need to hedge per 1% change of the underlying stock's price movement … $[0.05 * 100 shares * 0.01 * stock price * underlying parameter of the greek variable (for gamma this variable is the stock price)]".
  - [Unusual Whales API OpenAPI spec](https://api.unusualwhales.com/api/openapi)
- **[Vendor] Unusual Whales' other GEX field families, from the same spec.**
  - `gex_daily_*` fields (the screener schema): "Includes open interest and the contract multiplier of 100, without underlying-price scaling. Put gamma is negated; other Greeks retain their source signs." These are therefore in **shares**, not dollars.
  - The "Gex Call Gamma" schema: "sum of the gamma values … multiplied by the open interest and the number of shares per contract (typically 100 shares per contract)".
  - The `/greek-exposure` endpoint "updates once per day at market open". The `/spot-exposures` endpoints update about once a minute.
  - [UW OpenAPI](https://api.unusualwhales.com/api/openapi)
- **[Vendor] FlashAlpha's explainer.** It uses the same per-1% formula (calls +, puts −) and notes that dropping the 0.01 and one S gives the per-$1 figure. — [FlashAlpha, How to Calculate GEX](https://flashalpha.com/articles/how-to-calculate-gamma-exposure-gex-formula-worked-example)

### Inferences
- **UW's two formulas agree.** UW's "gamma × OI × price × price" (no 100, no 0.01) is numerically identical to Γ·OI·100·S²·0.01, because 100 × 0.01 = 1. The worked example below confirms this to the cent. The 100 is the share multiplier; the 0.01 is the 1% move.
- **Unit relationships.**
  - Per 1% = per $1 × (0.01·S).
  - Per $1 (dollars) = shares per $1 × S.
  - For SPX at 5,000, a "per 1%" figure is 50× the "dollars per point" figure. Confusing the two is a common source of order-of-magnitude disagreement.
- **"Per 1% move" is a first-order (linear) approximation.** It ignores how gamma itself changes over the move (speed, ∂Γ/∂S), which is material for short-dated near-the-money options.
- **"Notional GEX" has no single meaning.** It is used loosely for the per-1% dollar figure (gex-tracker prints "Total notional GEX: $… Bn" for the 1% formula). Treat it as unit-ambiguous unless the source defines it.

### Gaps
- I could not access SqueezeMetrics' current methodology page. Whether today's GEX/DIX dashboard still uses the 2017 naive sign or a revised positioning estimate is unverified.
- SpotGamma does not publish the Options Inventory Model, so its signs and positions cannot be reproduced.

## 2. DEX, VEX (vanna), charm exposure and vega exposure: formulas and units

### Takeaway
- **Textbook definitions:**
  - DEX = Δ·OI·100 (shares), ×S for dollars.
  - VEX = vanna·OI·100, where vanna = ∂Δ/∂σ per **1.00** of σ. Divide by 100 for per 1 vol point; ×S for dollars.
  - Charm exposure = charm·OI·100, where charm = ∂Δ/∂t per **year**. Divide by 365 (calendar days) or 252 (trading days) for per day; ×S for dollars.
  - Vega exposure = vega·OI·100·0.01 dollars per vol point.
- **Vendors differ.** UW's spec multiplies charm by 365 and gives vanna exposure as just "vanna × OI". Its annualisation and scaling therefore have to be checked empirically before use.

### Cited Findings
- **[Textbook] Black-Scholes-Merton greeks with dividend yield q and rate r** ([Wikipedia, Greeks (finance)](https://en.wikipedia.org/wiki/Greeks_(finance)); consistent with Hull, *Options, Futures and Other Derivatives*):
  - d1 = [ln(S/K) + (r − q + σ²/2)τ] / (σ√τ); d2 = d1 − σ√τ
  - Δ_call = e^{−qτ}Φ(d1); Δ_put = −e^{−qτ}Φ(−d1)
  - Γ = e^{−qτ}φ(d1) / (Sσ√τ), the same for calls and puts
  - Vega = S·e^{−qτ}φ(d1)√τ, per 1.00 of σ
  - Vanna = −e^{−qτ}φ(d1)·d2/σ, the same for calls and puts
  - Charm_call = q·e^{−qτ}Φ(d1) − e^{−qτ}φ(d1)·[2(r−q)τ − d2σ√τ] / (2τσ√τ)
  - Charm_put = −q·e^{−qτ}Φ(−d1) − e^{−qτ}φ(d1)·[same bracket] / (2τσ√τ)
- **[Textbook] Units for charm.** Wikipedia says charm "is expressed in delta/year", and dividing by days per year gives "the delta decay per day". Practitioners divide theta by 365 or 252, by choice. Vanna is given unscaled, as the derivative with respect to σ. — [Wikipedia, Greeks (finance)](https://en.wikipedia.org/wiki/Greeks_(finance))
- **[Computed] Sign of the charm formula above.** My finite-difference check shows it equals +∂Δ/∂t, the change in delta as calendar time passes, which is the opposite sign to ∂Δ/∂τ. It matches to 8+ significant figures (worked example below).
- **[Vendor] UW charm exposure.**
  - "CEX Per One Percent Move OI … This is calculated as charm * open interest * 365"; the volume variant is "charm * volume * 365".
  - The screener field `gex_charm_per_one_percent_move_oi`: "Sum of charm weighted by open interest. Put charm is negated. Multiplied by the underlying price and 365."
  - The name says "per one percent move" even though charm is a time sensitivity, so the label is inherited and not meaningful.
  - [UW OpenAPI](https://api.unusualwhales.com/api/openapi)
- **[Vendor] UW vanna exposure.** "VEX Per One Percent Move OI … This is calculated as vanna * open interest"; the volume variant is "vanna * volume". The spec states neither the vol-point scaling nor a price multiplier. — [UW OpenAPI](https://api.unusualwhales.com/api/openapi)
- **[Vendor] UW delta exposure.**
  - "Gex Call Delta: The sum of the delta values of all call transactions … multiplied by the open interest and the number of shares per contract", i.e. shares.
  - `gex_daily_*`: "Put gamma is negated; other Greeks retain their source signs", so put DEX stays negative, as the holder's own delta.
  - [UW OpenAPI](https://api.unusualwhales.com/api/openapi)
- **[Vendor] UW trade-signed exposures.**
  - Delta: "Trade-level sum of floor(sign * abs(delta * contracts * 100)). Call ask and put bid trades are positive. Call bid and put ask trades are negative."
  - Gamma: "Ask-side trades are positive, bid-side trades are negative". The directional OI-free variant, by contrast, says "Ask-side volume is negative and bid-side volume is positive", which is the dealer perspective.
  - Sign flips between UW field families, so each family has to be read separately.
  - [UW OpenAPI](https://api.unusualwhales.com/api/openapi)
- **[Local, observed 2026-10-12] UW's charm magnitude, as checked in this repository.**
  - `src/data/feed/uw.ts` lines 341–344 divide `call_charm_oi` and `put_charm_oi` by 365, with the comment that UW's charm exposure "is a year's (its spec: 'charm * open interest * 365', the per-strike rows in the same proportion to the book's as gamma — checked live)".
  - This is the repository's own empirical note, not a vendor statement. Source: `/home/user/3abida/src/data/feed/uw.ts`.
- **[Vendor] SpotGamma's TRACE** shows "Gamma, Delta, and Charm Pressure models". Its FAQ: "Vanna measures delta sensitivity to implied volatility, and charm measures delta change as time passes"; DEX "summarizes directional delta exposure". — [SpotGamma, Gamma Exposure](https://spotgamma.com/gamma-exposure)

### Inferences
- **Two readings of UW's "charm × OI × 365".**
  - (a) UW's per-contract charm is per day, and ×365 annualises it.
  - (b) It is already per year, and ×365 double-annualises it.
  - The spec does not say which. The repository's live check treats the result as annual and divides by 365 to get a per-day figure. Any reconstruction should calibrate against one strike computed independently.
- **Hedge-flow conversions.**
  - For a dealer, the share hedge flow implied by charm over one day ≈ −(dealer charm exposure per day in shares). The hedge offsets the delta drift.
  - For a 1-vol-point IV change, the flow ≈ −(dealer VEX per vol point in shares).
  - These are first-order approximations [Inference/Textbook].

### Gaps
- Neither UW's VEX scaling (per 1.00 σ or per vol point; shares or dollars) nor the units of its raw per-contract charm is documented. The examples in the spec (e.g. VEX OI '-54622844772.90') cannot be reverse-engineered without the inputs.
- I found no vendor or open-source documentation of a standard "vega exposure" metric for dealer positioning. Vega exposure (vega·OI·100·0.01, dollars per vol point) is textbook position vega, not a branded vendor metric.

## 3. Sign conventions: the naive "dealers long calls, short puts" rule, its origin, critics and alternatives

### Takeaway
- **Origin of the naive rule.** The standard OI-based GEX signs calls + and puts − (dealers long calls, short puts). It comes from SqueezeMetrics' 2016/2017 paper, which states it as an explicit *assumption*.
- **Critics.** Practitioners and Cboe call it crude or an approximation:
  - Perfiliev calls it "a crude approximation".
  - SpotGamma calls it "a simplifying inventory convention".
  - Cboe says outside dealer-gamma estimates "are just estimates based on assumptions".
- **Alternatives:**
  - trade-classified ("directionalized") volume (UW `_dir`, SpotGamma's model)
  - true customer/market-maker open-close data (Cboe's internal SPX analysis; the academic literature)
- None of the public products observes actual dealer inventory.

### Cited Findings
- **[Vendor/origin] SqueezeMetrics' four assumptions, verbatim:**
  1. "All traded options are facilitated by delta-hedgers."
  2. "Call options are sold by investors; bought by market-makers … the practice of call overwriting (and stock collaring) drives the market for calls."
  3. "Put options are bought by investors; sold by market-makers … The 'protective put' commands a premium."
  4. "Market-makers hedge precisely to the option delta" (the paper acknowledges that real dealers use "hedging bands").

  The paper also concedes that "It is difficult to determine the 'direction' of a trade in an ultra-liquid market, as in the case of SPX options. A vast majority will trade at the midpoint." — [SqueezeMetrics white paper](https://squeezemetrics.com/download/white_paper.pdf)
- **[Vendor/origin] SqueezeMetrics' interpretation.** "a GEX figure that is positive implies that option market-makers will hedge … in a fashion that stifles volatility (buying into lows, selling into highs). A GEX figure that is negative implies the opposite … magnifying market volatility." — [SqueezeMetrics white paper](https://squeezemetrics.com/download/white_paper.pdf)
- **[Practitioner critique] Perfiliev.** The rule is "a crude approximation" that holds "to some extent" for the index and is "more debatable" for single stocks. "Frequently the gamma exposure is an overstatement", because investors also sell puts for yield, buy calls, and trade spreads and combos. Accurate positioning would need trade-reporting data. OI updates about once a day and is usually a day old. — [Perfiliev blog](https://perfiliev.com/blog/how-to-calculate-gamma-exposure-and-zero-gamma-level/)
- **[Vendor critique] SpotGamma.** "Long calls _and_ long puts have positive gamma; short calls _and_ short puts have negative gamma." "A call-positive/put-negative public-data formula is a simplifying inventory convention." Basic OI models "assign position signs using a convention because public OI does not identify dealer versus customer ownership." — [SpotGamma](https://spotgamma.com/gamma-exposure)
- **[Vendor] UW adopts the naive rule explicitly.** "GEX assumes that market makers are part of every transaction and that the bulk of their transactions are buying calls and selling puts to investors hedging their portfolios." It offers three bases:
  - OI
  - total volume
  - "directionalized volume", described as "When a trade is made closer to the ask, the Market Maker would be selling the contract and when a trade is closer to the bid then the Market Maker would be buying the contract … the gamma exposure for directional volume is call_gamma_ask, and the value will be negative."

  Its GEX-levels endpoint defaults to `vol` (directionalized volume): "the exposure dealers took on from the day's ask/bid sided flow". `oi` is the alternative. The per-strike sums discard "a strike recalculation with a negative call gamma or a positive put gamma", which shows calls are stored positive and puts negative. — [UW OpenAPI](https://api.unusualwhales.com/api/openapi)
- **[Local, observed 2026-10-12] Live UW signs.**
  - A live `GET /api/stock/SPY/spot-exposures/expiry-strike` answer recorded in this repository shows `call_gamma_oi` +10,795,646.95, `put_gamma_oi` −44,789,966.34, `put_charm_oi` −25,939,570,407.81, `put_vanna_oi` +465,428.37 and `call_delta_oi` +351,318,436.56.
  - Put gamma is negated. The put charm and vanna signs are the opposite of a long OTM put's raw greeks: in the worked example below, raw put charm is + and raw put vanna is −. This is consistent with puts being negated across greeks in that endpoint.
  - Source: `/home/user/3abida/docs/data-feed-samples.md` lines 607–645. The strike-level moneyness behind these rows is not recorded, so the sign reading is **[Inference]**.
- **[Primary data, Cboe] Trade-level estimate of market-maker gamma (Cboe Volatility Insights, Mandy Xu, 8 Sep 2023).**
  - Method: "we can see for every transaction whether it's customer or market maker, buy or sell, opening or closing." Cboe tracks net market-maker positions by strike, aggregated to net gamma per 1% SPX move.
  - Results:
    - Average intraday net MM 0DTE gamma: $170m–$670m, 0.04–0.17% of about $400bn of daily S&P futures liquidity.
    - At 3:30 pm: median +$173m, interquartile range −$1.1bn to +$2.4bn.
    - On Aug 15, more than 100k contracts traded in the 4440 put, and MMs ended about 3k short (about 3% of gross volume).
  - Estimates elsewhere ranged "from 'record short' to long $50bn gamma in SPX alone".
  - Cboe on outside estimates: "it's important to point out those are just estimates based on assumptions."
  - Cboe on what matters: "What matters is the _balance_ of the volume between buys vs. sells, not the total size of the volume."
  - [Cboe, Much Ado About 0DTEs](https://www.cboe.com/insights/posts/volatility-insights-evaluating-the-market-impact-of-spx-0-dte-options)
- **[Academic] Pearson, Poteshman and White (2006 draft; the published version adds Ni).** They use investor net purchased option positions (not OI) to find a negative relationship between stock volatility and the net purchased option positions of likely hedgers. Theory: hedger rebalancing increases volatility when hedgers are net written and decreases it when they are net purchased. — [Pearson, Poteshman & White draft (ou.edu)](https://ou.edu/dam/price/Finance/CFS/paper/pdf/pearsonPoteshmanWhite.pdf); [HKBU listing](https://scholars.hkbu.edu.hk/en/publications/does-option-trading-have-a-pervasive-impact-on-underlying-stock-p/fingerprints/)
- **[Academic] Baltussen, Da, Lammers and Martens, JFE 142 (2021) 377–403.**
  - Hedging short gamma requires trading in the direction of the price move, which creates intraday momentum.
  - Momentum is concentrated on negative net-gamma-exposure (NGE) days, with no significant momentum on positive-NGE days (per a secondary summary).
  - [EUR repository](https://pure.eur.nl/en/publications/hedging-demand-and-market-intraday-momentum/); [Harbourfront summary](https://harbourfrontquant.substack.com/p/market-intraday-momentum-and-hedging)
- **[Contested]** A Princeton senior thesis (April 2026) reports that several studies find MM net gamma tends to be positive, but its own test finds the hedging-feedback channel adds little to intraday variance forecasts. — [Princeton thesis listing](https://theses-dissertations.princeton.edu/entities/publication/61115cd1-cb09-4a8b-9230-ff488fc2a386). This is secondary; I did not read the full text.

### Inferences
- **Four distinct things share the name "GEX":**
  1. **Naive/OI GEX**: calls +, puts −, weighted by OI.
  2. **Gross / absolute GEX**: Σ|Γ·OI·…|, no sign, a measure of hedging "mass".
  3. **Directional / signed GEX**: sign per trade by bid/ask aggressor (UW `_dir`; volume-based, intraday, with no information about opening or closing).
  4. **Modeled-position GEX**: a vendor inventory model such as SpotGamma's.

  Only Cboe's internal open/close data, and academic datasets built on CBOE/ISE open-close files, approach observed MM positions.
- **The naive rule mis-signs systematically in some cases:**
  - customer put selling
  - customer call buying (meme or speculative calls on single names)
  - the short legs of spreads
  - It also nets calls against puts at the same strike, so a large call and a large put can cancel to zero GEX while gross exposure is large.
- **DEX under the naive rule is not usually re-signed.** UW keeps holder signs for delta ("other Greeks retain their source signs"). A dealer-consistent DEX under "long calls, short puts" would be +Δ_call·OI − Δ_put·OI, with put deltas negative, so puts add positive delta. Check each source's DEX sign separately from its GEX sign.

### Gaps
- I could not confirm Baltussen et al.'s exact NGE construction (the PDF fetch failed and the summary site returned 403). Whether they assume end users are net long both calls and puts, or use the SqueezeMetrics signs, is unverified.
- I did not obtain the Dim, Eraker and Vilkov 0DTE gamma paper text. Search returned only secondary mentions.

## 4. How exposure responds to spot, IV, time to expiry and OI (with the worked example)

### Takeaway
- **OI and the multiplier:** exposure is linear in both.
- **Spot:**
  - Dollar scaling is quadratic in spot (the S² in the per-1% form).
  - Γ itself peaks near the strike, so the GEX "profile" has to be recomputed with greeks re-evaluated at each hypothetical spot. Zero gamma (the flip) is where the re-evaluated sum crosses 0.
- **IV, at the money:** higher IV *lowers* ATM gamma (Γ_ATM ∝ 1/σ) and spreads it across strikes.
- **IV, far out of the money:** for short-dated far-OTM strikes, higher IV *raises* gamma.
- **Time:** ATM gamma scales roughly as 1/√τ, so it explodes into expiry and on 0DTE, while OTM gamma collapses toward zero.

### Cited Findings
- **[Code/Vendor] Profile across hypothetical spot.**
  - Perfiliev recomputes BS gamma on `np.linspace(fromStrike, toStrike, 60)` from 0.8× to 1.2× spot. He finds the flip with `np.where(np.diff(np.sign(totalGamma)))` and linear interpolation `zeroGamma = posStrike - ((posStrike - negStrike) * posGamma/(posGamma-negGamma))`, taking the first crossing. He read about 4,575 on 1 Feb 2022.
  - jensolson `GEX.py` lines 233–259 recompute Black gamma at 20 forward levels in 10-point steps for SPX and interpolate zero GEX with `np.interp`.
  - SpotGamma: "Zero Gamma is the modeled spot price where aggregate GEX crosses zero."
  - UW's "Gamma Flip" field: "Price where net dealer gamma crosses zero, nearest to spot". UW's "Gamma Magnet": "Strike with the largest-magnitude net gamma".
  - Sources: [Perfiliev](https://perfiliev.com/blog/how-to-calculate-gamma-exposure-and-zero-gamma-level/); [jensolson GEX.py](https://github.com/jensolson/SPX-Gamma-Exposure/blob/master/GEX.py); [SpotGamma](https://spotgamma.com/gamma-exposure); [UW OpenAPI](https://api.unusualwhales.com/api/openapi)
- **[Code] Handling time to expiry.**
  - Perfiliev uses business days / 262 and sets 0DTE to 1/262 so those options are not dropped.
  - jensolson uses `BDTE/252` and drops BDTE < 1, i.e. it drops 0DTE (`GEX.py` line 80: `df = df[df['BDTE'] >= 1]`).
  - [Perfiliev](https://perfiliev.com/blog/how-to-calculate-gamma-exposure-and-zero-gamma-level/); [jensolson GEX.py](https://github.com/jensolson/SPX-Gamma-Exposure/blob/master/GEX.py)
- **[Vendor] OI staleness.**
  - UW `/greek-exposure` "updates once per day at market open". Its per-strike rows are recalculated "when one of its contracts gets new greeks or a new trade, or when the daily open interest loads … A price move alone does not recalculate a strike". Strikes in one response can be hours apart.
  - Perfiliev: OI is "usually a day old".
  - [UW OpenAPI](https://api.unusualwhales.com/api/openapi); [Perfiliev](https://perfiliev.com/blog/how-to-calculate-gamma-exposure-and-zero-gamma-level/)
- **[Computed] Sensitivity tables, BS with r = q = 0, S = 5,000, per-contract Γ.**
  - ATM Γ against IV and DTE:

    | DTE | IV 10% | 15% | 20% | 30% |
    |---|---|---|---|---|
    | 1 | 0.015244 | 0.010162 | 0.007622 | 0.005081 |
    | 7 | 0.005761 | 0.003841 | 0.002880 | 0.001920 |
    | 30 | 0.002783 | 0.001855 | 0.001391 | 0.000927 |
    | 90 | 0.001606 | 0.001070 | 0.000802 | 0.000534 |

    Γ is ∝ 1/σ and ∝ 1/√τ.
  - 2%-OTM call (K = 5,100) Γ:

    | DTE | IV 10% | 15% | 20% | 30% |
    |---|---|---|---|---|
    | 1 | 0.000012 | 0.000427 | 0.001286 | 0.002317 |
    | 7 | 0.002093 | 0.002463 | 0.002253 | 0.001731 |
    | 30 | 0.002214 | 0.001685 | 0.001323 | 0.000912 |

    At short dated, OTM gamma rises with IV and collapses as τ → 0.
  - 0DTE ATM Γ at IV 15% by hours left: 6.5 h 0.0195; 3 h 0.0287; 1 h 0.0498; 15 min 0.0996.
  - Script: `/tmp/claude-0/-home-user-3abida/3f13cba1-d81b-5e53-bbee-8bc889ed9a96/scratchpad/ex.py` (session scratch file).

#### Worked example [Computed; textbook BSM; finite-difference verified]

**Inputs:** S = 5,000 (an SPX-like index), r = 4%, q = 1.5%, τ = 30/365, multiplier 100.

| | Call: K 5,100, IV 15%, OI 10,000 | Put: K 4,900, IV 20%, OI 15,000 |
|---|---|---|
| d1 / d2 | −0.391203 / −0.434207 | 0.416848 / 0.359510 |
| Δ | 0.347395 | −0.337978 |
| Γ (per $1) | 0.00171659 | 0.00127417 |
| Vanna (∂Δ/∂σ per 1.00 σ) | +1.068435 | −0.656634 |
| Charm (∂Δ/∂t per year) | −1.184310 | +0.634564 |
| Vega (per 1.00 σ) | 529.086 | 523.633 |
| **GEX, shares per $1** (Γ·OI·100) | +1,716.59 | −1,911.26 (naive put sign) |
| **GEX, $ per $1 move** (×S) | +$8,582,957 | −$9,556,297 |
| **GEX, $ per 1% move** (Γ·OI·100·S²·0.01 = UW's Γ·OI·S²) | +$429,147,874 | −$477,814,871 |
| DEX, shares (Δ·OI·100, holder sign) | +347,395 | −506,967 |
| DEX, $ (×S) | +$1.737bn | −$2.535bn |
| VEX, shares per 1 vol pt (vanna·OI·100·0.01) | +10,684 | −9,850 |
| VEX, $ per vol pt (×S) | +$53.42m | −$49.25m |
| Charm exposure, shares per year (charm·OI·100) | −1,184,310 | +951,846 |
| Charm exposure, shares per calendar day (/365) | −3,244.7 | +2,607.8 |
| Charm exposure, $ per day (×S) | −$16.22m | +$13.04m |
| Vega exposure, $ per vol pt (vega·OI·100·0.01) | $5.29m | $7.85m |

**Net under the naive rule (calls +, puts −), GEX only:**
- −194.67 shares per $1
- −$973,340 per $1
- −$48.67m per 1% move

So the dealer would be net short gamma here, and the flow implied by a +1% move would be selling about $48.7m.

**Other sums (holder signs, not dealer-signed):**
- DEX −159,572 shares
- VEX +834.8 shares per vol point
- Charm −636.9 shares per day

**Finite-difference checks (central difference):**
- Γ: call 0.0017165915, put 0.0012741730
- Vanna: 1.0684346, −0.6566344
- Charm, as −∂Δ/∂τ: −1.1843096, +0.6345639

All match the closed forms to at least 8 significant figures.

### Inferences
- **The flip is model-dependent.** Recomputing the profile across hypothetical spot holds IV fixed per contract (sticky-strike) in both open-source codes. With sticky-delta or skew dynamics, Γ at a hypothetical spot changes, so the flip's location depends on the vol model.
- **Short-dated exposure can swing on IV alone.** Because OTM short-dated Γ rises with IV while ATM Γ falls, a vol spike can move GEX mass away from spot. 0DTE/1DTE strikes can dominate the per-1% sum near expiry even on small OI.
- **Per-1% scaling inflates high-priced underlyings.** The S² in the per-1% form means the same Γ·OI gives 4× the dollar GEX at twice the price. Cross-name comparisons should normalise, e.g. by market cap or average dollar volume.

### Gaps
- I found no source quantifying the empirical difference between sticky-strike and sticky-delta flip estimates.

## 5. Index specifics: SPX multiplier, cash settlement, AM/PM, SPX vs SPXW, SPY

### Takeaway
- SPX options have a $100 multiplier and are European and cash-settled.
- SPX standard monthlies are AM-settled: trading stops the business day before and settlement comes off the next morning's opening calculation.
- SPXW (weeklies and dailies) are PM-settled at the expiration-day close.
- SPY is about 1/10 of SPX, physically settled, American, with the same 100-share multiplier. Its GEX is often rescaled to SPX-equivalent points.

### Cited Findings
- **[Exchange] Cboe SPX product specifications (page dated 19 Mar 2024).**
  - Multiplier: 100. Symbols: SPX/SPXW.
  - SPX: "Trading in SPX options will ordinarily cease on the business day (usually a Thursday)" before settlement, and settles off the following day's calculation.
  - SPXW: "Trading in SPXW options will ordinarily cease on the day of expiration", at 4:00 p.m. ET, or 1:00 p.m. ET on half days.
  - Regular hours are 9:30–16:15 ET; curb 16:15–17:00.
  - The exercise-style and settlement-value fields did not load in the fetch.
  - [Cboe SPX specifications](https://www.cboe.com/tradable_products/sp_500/spx_options/specifications/)
- **[Origin] SqueezeMetrics** describes SPX as "a large and deeply liquid market for cash-settled options". — [SqueezeMetrics white paper](https://squeezemetrics.com/download/white_paper.pdf)
- **[Code] Rescaling SPY.** jensolson `GEX.py` treats `.SPX`/`SPXW` strikes with divisor 10 (line 47), prices SPX options with Black-76 on the index level/forward `F`, and divides SPY GEX by 10 (line 103) to express it per SPX point. — [jensolson GEX.py](https://github.com/jensolson/SPX-Gamma-Exposure/blob/master/GEX.py)
- **[Vendor] UW's index price.** "Gex Underlying Price … NOTE: For any index ticker this will be the current ATM strike." For past dates rebuilt from end-of-day data, an index's `price` is "the last at-the-money price estimate recorded that day". The S in UW's index GEX is therefore an ATM-strike proxy, not the printed index level. — [UW OpenAPI](https://api.unusualwhales.com/api/openapi)
- **[Exchange] 0DTE's growing share of SPX volume (Cboe).** About 5% in 2016, over 40% after the Tue/Thu expiries were added, and an average of about 50% in Aug 2023 (about 1.23m contracts and about $500bn notional a day in 2023). — [Cboe 0DTE insight](https://www.cboe.com/insights/posts/volatility-insights-evaluating-the-market-impact-of-spx-0-dte-options)

### Inferences
- **Aggregating across products.** A full S&P picture sums SPX + SPXW + SPY (×0.1 to SPX points, or each in dollars per 1%) + ES futures options (multiplier $50 on the future) + XSP. Single-product GEX omits offsets elsewhere, which Cboe also flags for its own SPX-only analysis.
- **AM-settled monthlies have one less session.** Because they stop trading the day before expiration, an AM-settled monthly's gamma is effectively gone after that session, a day earlier than the PM weeklies with the same date. The DTE count has to reflect that.

### Gaps
- I did not get Cboe's text on the exercise style and the SOQ settlement value, because the page's fields did not render. European style and cash settlement are standard knowledge and corroborated by SqueezeMetrics' "cash-settled", but not verbatim from Cboe here.

## 6. Which Black-Scholes variant, and how the IV source changes results

### Takeaway
- **Equities and ETFs:** open-source codes use Black-Scholes-Merton with r and q (often set to 0).
- **SPX:** Black-76 on the forward is common.
- **Choices that move GEX:** the IV source and the day-count/filter choices move results more than r and q do:
  - vendor IV vs IV implied from the mid
  - business vs calendar days
  - dropping 0DTE
  - delta and IV filters

### Cited Findings
- **[Code] Perfiliev.**
  - `dp = (np.log(S/K) + (r - q + 0.5*vol**2)*T) / (vol*np.sqrt(T))`
  - `gamma = np.exp(-q*T) * norm.pdf(dp) / (S * vol * np.sqrt(T))`
  - r = q = 0 in the script. He says rates and dividends "don't really impact the final figures that much" (1.5–2% would be closer for SPX).
  - IV comes from CBOE's per-option column. He recomputes gammas because CBOE's own after-close values were hard to replicate.
  - [Perfiliev](https://perfiliev.com/blog/how-to-calculate-gamma-exposure-and-zero-gamma-level/)
- **[Code] jensolson `pyVolLib.py`.**
  - It imports `py_vollib.black.greeks.numerical` (Black-76: delta, gamma, theta, vega) and `py_vollib.black_scholes_merton.greeks.numerical` (BSM gamma).
  - `blackGamma` uses `t=df['BDTE']/252`, `r` defaulting to `.02`, and the forward `F`.
  - In `GEX.py`, IV is solved from the mid (`blackIV` for SPX, `blackScholesIV` otherwise).
  - Filters: OI > 10, bid > 0.05, 1% < IV < 200%, |Δ| < 0.95, BDTE ≥ 1.
  - [jensolson pyVolLib.py](https://github.com/jensolson/SPX-Gamma-Exposure/blob/master/pyVolLib.py); [GEX.py](https://github.com/jensolson/SPX-Gamma-Exposure/blob/master/GEX.py)
- **[Code] gex-tracker** uses the gamma CBOE publishes and recomputes nothing (`main.py` line 75 reads `data.gamma`). — [gex-tracker main.py](https://github.com/Matteo-Ferrara/gex-tracker/blob/master/main.py)
- **[Vendor] UW** recalculates per-strike rows "when one of its contracts gets new greeks". The model and the IV source are not stated in the spec. — [UW OpenAPI](https://api.unusualwhales.com/api/openapi)

### Inferences
- **Black-76 vs BSM.** Black-76 on the forward F = S·e^{(r−q)τ} gives the same Γ with respect to F as BSM with respect to S, up to the e^{−rτ} and F/S factors. For short-dated SPX the difference is a fraction of a percent. Differences of a few percent come from IV (bid/ask/mid/vendor smoothing) and τ conventions (calendar /365, business /252 or /262, intraday fractions for 0DTE).
- **Intraday 0DTE τ.** Using whole days (Perfiliev's 1/262 floor) understates 0DTE ATM Γ late in the session by several times compared with hours-remaining τ. The computed table shows 0.0195 at the open against 0.0996 with 15 minutes left at the same IV.

### Gaps
- No vendor (SpotGamma, UW, SqueezeMetrics) publicly documents its pricing model, IV surface source, or day-count. Cross-vendor reconciliation can only be done empirically.
