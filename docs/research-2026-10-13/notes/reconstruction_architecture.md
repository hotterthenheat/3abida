# Reconstructing a historical strike × time options exposure series, and the data architecture behind it

Scope: methods and practice for building a minute-by-minute (or coarser) exposure-per-strike history (GEX, and by
extension DEX/vanna/charm) from point-in-time inputs; preventing look-ahead; versioning; validation; storage; and
rendering. Research done 2026-10-13. Primary documents read in full text where noted (IvyDB US Reference Manual v5.0,
Derman 1999 "Regimes of Volatility", the SqueezeMetrics "Gamma Exposure" paper, MDN storage quotas, KX `aj` reference).
Where a point comes from this repository's own feed notes (docs/data-feed.md), it is cited by file path, not URL.

## 1. Reconstruction methods compared (live capture, recompute from OI + IV + spot path, IV from quotes/trades, vendor history)

### Takeaway
No method gives a true intraday strike × time exposure history for free. Live capture of vendor snapshots is the only
way to get the vendor's own number at time t, and it only covers the times you recorded. Recomputation from
open-interest-at-the-open plus a spot path is reproducible and fills every minute, but it is a model: it holds the
position fixed through the day (OI is counted once a day) and has to assume how IV moves. Deriving IV per minute from
quotes is the most faithful modelled input, but it needs a minute-level quote archive. Vendor history comes in at
end-of-day or a fixed snapshot time, and the vendor may recalculate it later.

### Cited Findings
- **The canonical GEX definition is a model with explicit assumptions.** SqueezeMetrics' paper (Dec 2017 revision) defines per-strike GEX for calls as `Γ · OI · 100` and for puts as `Γ · OI · (−100)`, summed "at every strike price in every available contract". It rests on four stated assumptions: all options are facilitated by delta-hedgers, calls are sold by investors and bought by market-makers, puts are bought by investors and sold by market-makers, and market-makers hedge precisely to the option delta (it acknowledges that real hedgers use "hedging bands"). SPX GEX is denominated in dollars. — [SqueezeMetrics, "Gamma Exposure" (copy hosted at slopeofhope.com)](https://slopeofhope.com/wp-content/uploads/2020/11/GEX-white_paper.pdf)
- **Inputs to a GEX number:** gamma, which depends on spot, strike, time to expiry, IV, rate and dividend; open interest; and a dealer-side sign. So any historical series must fix all of these at time t. — [SqueezeMetrics paper](https://slopeofhope.com/wp-content/uploads/2020/11/GEX-white_paper.pdf); [IvyDB US Reference Manual v5.0, "Calculations"](https://lib.tsinghua.edu.cn/PDF/OptionMetricsshiyongzhinan.pdf)
- **(d) Vendor history is usually one snapshot a day, not intraday.**
  - OptionMetrics IvyDB computes IV and greeks from the midpoint of the best closing bid and offer. Bid/offer are "end-of-day quotes" until Mar 5 2008, 16:00 ET quotes until Jul 29 2009, and **15:59 ET quotes from Jul 30 2009 onward**.
  - European options are priced with Black-Scholes, inverted numerically. American options use a proprietary CRR binomial tree with discrete dividends.
  - IV is "not calculated for options with non-standard settlement".
  
  — [IvyDB US Reference Manual v5.0](https://lib.tsinghua.edu.cn/PDF/OptionMetricsshiyongzhinan.pdf)
- **Vendor history is revised.**
  - The IvyDB revision log records that v3.1.0 (Jul 2016) removed a "vega cutoff": vega values below 0.5 had previously been written as −99.99.
  - v4.0 (Oct 2019) "Enabled historic patching".
  - v5.0 (Dec 2020) did a "Distribution data cleanup and historic recalculation of Implied volatilities".
  
  A history pulled in 2019 and one pulled in 2021 for the same date can therefore differ. — [IvyDB US Reference Manual v5.0, Revision Summary](https://lib.tsinghua.edu.cn/PDF/OptionMetricsshiyongzhinan.pdf)
- **Cboe DataShop's daily file:**
  - The Option EOD Summary carries two NBBO snapshots, 15:45 ET and end-of-day.
  - IV and greeks ("Implied Volatility 1545, Delta 1545, Gamma 1545 …", with "Active Underlying Price 1545") are computed only at the 15:45 snapshot, as an add-on.
  - History runs from January 2012.
  
  — [Cboe DataShop, Option Quotes End of Day with Calcs](https://datashop.cboe.com/option-quotes-end-of-day-with-calcs); [Cboe DataShop, End of Day Options Summary](https://datashop.cboe.com/end-of-day-options-summary)
- **(c) Minute-level quotes with calcs exist as a purchasable history.**
  - Cboe DataShop "Option Quote Intervals" gives 1-minute (or N-minute) NBBO plus OHLC and volume per series from OPRA.
  - An optional "With Calcs" layer adds Active Underlying Price, IV, Delta, Gamma, Theta, Vega and Rho "at each interval time", and Open Interest is optional. History runs from January 2012.
  - Intraday files are delayed 15 minutes. Index underlying prices are included only for ^SPX and ^OEX, and only with a Cboe index feed licence.
  - The page does not state the calcs' model, rate or dividend inputs.
  
  — [Cboe DataShop, Options Intervals](https://datashop.cboe.com/options-intervals)
- **(b) Recompute across spot is the standard way practitioners build a "gamma profile" and zero-gamma/flip level.** Each option's gamma is re-priced with Black-Scholes at hypothetical spot levels, holding OI (and usually IV) fixed. The dealer-signed sum is taken, and the flip is the spot where the sum crosses zero. These sources are practitioner/secondary, not peer-reviewed. — [Perfiliev thread outline (Rattibha mirror)](https://en.rattibha.com/thread/1489373524066279430); [GitHub topic: gamma-exposure](https://github.com/topics/gamma-exposure)
- **(a) Live capture and the limits of one vendor's API (this project's own findings, 2026-10-12):**
  - UW's `/spot-exposures/strike` "takes a `date`, never a time". The per-minute `/spot-exposures` carries the whole book's totals, not strikes.
  - `/greek-exposure/strike?date=` is "the book at that session's open", figured "once a day".
  - So a strike × time field for earlier in the day can only come from books the client itself recorded. The project stores them in IndexedDB (`slayer_field`).
  - UW's charm is reported as "charm * open interest * 365", which the client divides by 365.
  
  — /home/user/3abida/docs/data-feed.md (lines ~81–104, 248–278, 330–343) and /home/user/3abida/CLAUDE.md ("TERRAIN'S TRAIL ON THE FEED", "UW'S CHARM IS A YEAR'S")

### Inferences
- **Strengths and failure modes by method:**
  - **(a) Live capture** is exact for the vendor's number at the recorded instants, and it is the only way to match a vendor exactly. It fails on gaps (tab closed, rate limits, 429s), on a vendor that silently changes its method, and on cold starts (no history before the recorder ran). It also inherits every vendor assumption: dealer sign, OI date, and the vendor's own IV and greeks.
  - **(b) Recompute from OI + IV + spot path** fills every minute and is fully reproducible if inputs are versioned. It is biased because the intraday position change is invisible: OI is counted once a day, so contracts opened and closed intraday (notably 0DTE) never enter. It also depends on the IV-dynamics assumption (Section 2) and on stale greeks near expiry, where gamma is extremely sensitive to the time-to-expiry convention.
  - **(c) IV from minute quotes** removes the fixed-IV assumption. It costs a large archive and IV inversion per series per minute. It also needs to handle wide or absent quotes in illiquid strikes, crossed or locked quotes, the American-exercise early-exercise premium, and the index underlying price, which is licence-gated at Cboe.
  - **(d) Vendor history** is cheap and consistent, but it is usually one snapshot per day (15:45 or 15:59 ET), it is revised in place, and its methodology may be partially undisclosed.
- **A pragmatic hybrid:** use (b) or (c) to fill minutes, anchor to (a) at the minutes actually captured, and tag every cell with provenance (measured versus modeled). Do not blend them silently.

### Gaps
- Cboe DataShop's calcs methodology (model, rate curve, dividend treatment for the 1-minute "With Calcs" product) was not on the public product pages. It would need the file specification.
- No primary, peer-reviewed source was found that quantifies the error of method (b) against true intraday exposure, mainly because true intraday dealer positioning is not public.
- The original SqueezeMetrics PDF was read from a third-party host (slopeofhope.com). Its text matches the paper's Dec 2017 revision footer, but it was not verified against sqzme.co directly.

## 2. Point-in-time accuracy: which inputs must be preserved, and how to handle missing or changing inputs

### Takeaway
To reproduce a past exposure cell you need, as of that minute, all of the following:
- the contract universe and its terms (root, multiplier, settlement, exercise style, AM/PM)
- open interest as it was known that morning (the prior session's count)
- the underlying price at t
- IV per contract at t, or the surface plus the assumed dynamics
- the rate curve and dividend assumption
- the time-to-expiry convention
- the dealer-sign convention
- the code and model version

IvyDB's manual is a good template: it documents exactly which quote time, rate curve, dividend model and exercise model sit behind each stored IV.

### Cited Findings
- **OI is lagged by one day.**
  - IvyDB: "Open interest is lagged by one day after November 28, 2000. Prior to this date, the open interest is not lagged."
  - A separate Open_Interest file of "the previous day's open interest" is posted "each morning by 9:00 a.m. ET".
  - So a historical OI field needs a stated convention, and that convention itself changed over the data's history.
  
  — [IvyDB US Reference Manual v5.0, Option_Price and Open_Interest files](https://lib.tsinghua.edu.cn/PDF/OptionMetricsshiyongzhinan.pdf)
- **OI originates at OCC as an end-of-day count.**
  - Cboe's CFE feed sends open interest "usually for the prior trading date", upon receipt from OCC, at about 10:00 p.m. CT. Friday's OI is not disseminated until Sunday.
  - OCC Rule 401 has clearing members submit position adjustments "to identify actual open interest at the end of each trading day".
  - These are futures and CFE documents. For US equity options, the same OCC end-of-day/next-morning pattern is described only in a lower-reliability user forum.
  
  — [Cboe Futures Exchange OI message spec](https://www.cboe.com/document/tech-spec/content/technical-specifications/cboe-futures-exchange-multicast-top-specification/protocol/open-interest-message-fields); [CFE notice, earlier OI dissemination (2021)](https://cdn.cboe.com/resources/release_notes/2021/CFE-Announces-Earlier-Time-for-Open-Interest-Dissemination-Notice.pdf); [Alpaca forum (user report)](https://forum.alpaca.markets/t/old-option-open-interest-dates/18346)
- **Rates and dividends are part of the reproducible input set.**
  - Rates: IvyDB uses a zero-coupon curve (historically from ICE LIBOR plus CME Eurodollar futures), linearly interpolated to each option's expiry.
  - Equity options: a constant dividend yield (last announced dividend ÷ last close), paid on projected ex-dates.
  - Indices: an implied dividend yield regressed from put-call parity (`C − P = b0 + b1S + b2ST + b3K + b4KT + b5DBA`).
  
  — [IvyDB US Reference Manual v5.0, "Interest Rates", "Dividends"](https://lib.tsinghua.edu.cn/PDF/OptionMetricsshiyongzhinan.pdf)
- **Corporate actions and adjusted contracts.**
  - IvyDB flags "Special Settlement = 1" for non-standard deliverables (the deliverable may differ from 100 shares, and multipliers may differ), and does not compute IV for them.
  - Flag "E" marks a non-standard expiration "usually due to an error in the historical data".
  - It carries a cumulative Adjustment Factor for splits and distributions.
  - Its standardized surface is only produced "if there exists enough option price data on that date".
  
  — [IvyDB US Reference Manual v5.0](https://lib.tsinghua.edu.cn/PDF/OptionMetricsshiyongzhinan.pdf)
- **IV dynamics when holding IV across a day (Derman, Goldman Sachs QS note, Jan 1999):**
  - **Sticky-strike:** "as the index moves, the volatility of an option with a particular strike remains unchanged". Derman calls it "a poor man's attempt to preserve the Black-Scholes model", and under it delta equals the BS delta.
  - **Sticky-delta / sticky-moneyness:** volatility "depends only on its moneyness K/S", so ATM vol stays fixed as the index moves.
  - **Sticky-implied-tree:** vols are adjusted "up as the market declines".
  - Derman's guidance: sticky-strike in a range-bound regime "without a significant change in current realized volatility"; sticky-delta in a trending regime; implied-tree when jumps (especially down) are likely.
  
  — [Derman (1999), Regimes of Volatility](https://hpirotte.ulb.be/INGESTriskmgt/readings/Derman%20(1999)%20-%20Volatility%20regimes.pdf)
- **Sticky-delta deltas differ from sticky-strike deltas** (the call delta is larger under sticky-delta), so the regime choice changes hedge ratios and therefore modelled dealer flows. — [Sepp, slides (Bayes Business School)](https://www.bayes.city.ac.uk/__data/assets/pdf_file/0019/151093/Sepp.pdf) (secondary summary via search snippet)
- **Surface smoothing is a modelling choice that should be recorded.** IvyDB's volatility surface uses a vega-weighted Gaussian kernel smoother over log-days-to-expiry and "call-equivalent delta". Its standardized ATM-forward options are linearly interpolated from that surface at fixed 10–730-day tenors. — [IvyDB US Reference Manual v5.0, "Volatility Surface", "Standardized Option Prices"](https://lib.tsinghua.edu.cn/PDF/OptionMetricsshiyongzhinan.pdf)

### Inferences
- **Minimal reproducible input record per (underlying, minute):**
  - `spot_t` and its source (trade, mid, or index calc)
  - per contract: `iv_t` or the surface parameters, with the source quote time
  - `oi_asof` (with `oi_count_date` = previous session)
  - contract terms (multiplier, deliverable, settlement and exercise, AM/PM, last trading time)
  - the `r(T)` curve and `q`/dividends as of that date
  - the time-to-expiry convention (calendar versus trading time, the exact expiry instant)
  - the dealer-sign rule
  - `model_version`
- **Default IV assumption:** if IV is held from a morning snapshot, the conventional choice is sticky-strike, because it is the simplest and needs no re-mapping. Its bias is regime-dependent per Derman. Disclose the assumption, and ideally store the alternative (sticky-delta) as a sensitivity band rather than one number.
- **Listings and expiries within the window:** a contract enters only on its first OI count, normally the session after listing. On expiry day, gamma of near-ATM 0DTE contracts explodes as T→0, so the exact expiry timestamp (16:00 ET PM, or the AM settlement session before) dominates the late-day numbers.
- **Missing observations** (no quote, no IV): prefer an explicit null (rendered "—") over forward-filling. If forward-filled, carry a `stale_since` timestamp so staleness is visible and testable.

### Gaps
- No primary OCC document was found that states the publication time for US equity option OI. The "next morning" claim rests on IvyDB's 9:00 a.m. file and a forum post.
- Empirical evidence on which IV regime best describes intraday SPX/SPY moves in 2024–2026 was not found in this pass.

## 3. Look-ahead bias: using later OI/IV for earlier minutes, calibrating past columns to a later snapshot

### Takeaway
Any value in a cell for minute t must be computable from information whose knowledge time is ≤ t. The established fix
is bitemporal / point-in-time storage: keep the event time and the knowledge (as-of) time, query "as of" t, and keep
first-reported values alongside revisions. Scaling earlier columns so they agree with a later vendor reading uses
information from after t, so it is look-ahead by construction. It should not be done for a history that claims to be point-in-time; if it is
done for display, label it as a revision.

### Cited Findings
- **Restatements overwrite history.** When a value is restated, a naïve store "silently overwrite[s]" the original, and a backtest then "reads the corrected number stamped with the original filing date". The remedy is "vintage data or point-in-time data" that keeps both first-reported and current values. — [dev.to (Tradevo data, vendor blog)](https://dev.to/tradevodata/as-reported-vs-restated-financial-data-why-the-difference-matters-for-backtesting-1big); [Permutable.ai on point-in-time macro datasets (vendor)](https://permutable.ai/point-in-time-datasets-for-macro-backtesting/)
- **Bitemporal pattern:** keep a `ref_date` (event time) and a `knowledge_date`, and filter so that `knowledge_date <= query_date` after an `as_of()` call (the `ere` Polars library). — [PyPI: ere](https://pypi.org/project/ere/)
- **Reporting lag is a distinct look-ahead source** (data not yet public at the decision time). — [AnalystPrep, CFA L2 "Problems in Backtesting"](https://analystprep.com/study-notes/cfa-level-2/problems-in-backtesting/)
- **The as-of join is the standard primitive for this.** kdb+ `aj` matches the leading key columns exactly and takes the most recent row by time for each left-hand row. `aj` keeps the left table's (boundary) time, while `aj0` returns the matched row's time, which is useful for measuring staleness. — [KX, aj reference](https://code.kx.com/q/ref/aj/); [TimeStored, as-of joins guide](https://timestored.com/kdb-guides/asof-time-joins-aj-wj)
- **OI is a known-lag input** (prior day, published next morning). Using the end-of-day OI of day D for minutes on day D is therefore look-ahead. — [IvyDB US Reference Manual v5.0](https://lib.tsinghua.edu.cn/PDF/OptionMetricsshiyongzhinan.pdf)
- **López de Prado's backtesting treatment.** *Advances in Financial Machine Learning* (2018) Ch. 11 "The Dangers of Backtesting" argues that a flawless backtest is "Mission Impossible" and that "Backtesting is not a research tool". His 2017 "7 Reasons Most ML Funds Fail" list includes cross-validation leakage and backtest overfitting. The "Seven Sins of Quantitative Investing", which includes survivorship and look-ahead, is a separate Deutsche Bank study (Luo et al., 2014), not his book. — [O'Reilly, AFML table of contents](https://oreilly.com/library/view/advances-in-financial/9781119482086); [Opalesque, "The 7 Reasons Most ML Funds Fail"](https://www.opalesque.com/666166/Presentation_The_7_Reasons_Most_Machine_Learning_Funds616.html)
- **Vendor recalculation makes "history" itself non-point-in-time** unless the pull date is stored (IvyDB "historic recalculation of Implied volatilities", v5.0). — [IvyDB US Reference Manual v5.0](https://lib.tsinghua.edu.cn/PDF/OptionMetricsshiyongzhinan.pdf)

### Inferences
- **Concrete look-ahead traps in an exposure history:**
  - today's OI applied to today's minutes, or tomorrow's OI to today
  - a later IV snapshot applied to earlier minutes
  - the day's eventual listing set used at 09:30
  - a flip or wall recomputed from the closing book and drawn back across the morning
  - any normalisation or colour scale fit on the whole day, if the grid is presented as what was visible live
  - rescaling earlier columns to match the latest vendor total
- **Mitigation:**
  1. Every derived cell carries `(event_time, knowledge_time, inputs_hash, model_version, provenance ∈ {measured, modeled, revised})`.
  2. A replay engine only ever reads inputs through an as-of join at the replay clock.
  3. Revisions are new rows, never in-place edits.
  4. If a display reconciles to a later reading, show it as a distinct "revised" layer, or disclose it in the UI and tooltip.
- **For this project specifically:** the IndexedDB "field" of books the terminal itself read is measured, point-in-time data. A minute filled by re-pricing between two recorded books is modeled. Rescaling either one to the latest UW reading would be revised, i.e. look-ahead.

### Gaps
- No primary academic source was found that treats look-ahead specifically in options-exposure (GEX) histories. The guidance here is transferred from general point-in-time and backtesting practice.
- The López de Prado book text itself was not read. Its chapter contents are cited from the publisher's table of contents only.

## 4. Data model and architecture: raw inputs vs derived snapshots, versioning, provenance, caching, replay, client-side storage

### Takeaway
The established pattern is:
- store immutable raw inputs (quotes, OI counts, spot ticks, rate/dividend vintages) append-only, in columnar time-sorted form
- derive exposure snapshots as a pure function `f(inputs as-of t, model_version)`
- cache the derived grid keyed by `(underlying, date, model_version, inputs_hash)`
- replay with as-of joins

On the server side, columnar engines (Parquet/Arrow files, ClickHouse MergeTree, TimescaleDB compressed hypertables, kdb+) all reward sorting by entity then time. In the browser, IndexedDB is usable at that scale but is evictable unless persistence is granted.

### Cited Findings
- **Parquet.**
  - The format stores per-column-chunk statistics (min/max/null count) and optional dictionaries and page indexes, which readers use for predicate pushdown.
  - A high-cardinality column may skip dictionary encoding, leaving wide min/max ranges and no pushdown. Bloom filters are the remedy, and they have no false negatives.
  - Writing data sorted on the filter column keeps each row group's range narrow so most groups are skipped (secondary source).
  
  — [Apache Parquet, File Format docs](https://parquet.apache.org/docs/file-format/_print); [chat2db, Parquet explained (secondary)](https://chat2db.ai/resources/blog/apache-parquet-format-explained)
- **ClickHouse.**
  - The common pattern is a domain codec followed by a general compressor: `DoubleDelta` for evenly spaced timestamps, `Gorilla` for slowly changing floats, `Delta` for monotonic integers, then ZSTD or LZ4.
  - Partition by time for lifecycle and TTL, not for speed, and keep total partitions under about 1,000.
  - These are secondary or community sources, so verify against the ClickHouse docs.
  
  — [pulse.support, ClickHouse CREATE TABLE](https://pulse.support/kb/clickhouse-create-table); [openskillindex, clickhouse-architect](https://openskillindex.com/skills/terrylica-cc-skills-clickhouse-architect)
- **TimescaleDB.** Compression `segmentby` groups each entity's rows into batches (so filters skip other entities), and `orderby` sets the sort within a batch. On a continuous aggregate, by default the GROUP BY columns become `segment_by` and the `time_bucket` becomes `order_by`. Before 2.11.0, compressed regions could not be refreshed, so `compress_after` should exceed the refresh `start_offset`. — [Timescale docs, compression on continuous aggregates](https://docs.timescale.com/use-timescale/latest/continuous-aggregates/compression-on-continuous-aggregates)
- **kdb+.** `aj` performance depends on column order (`sym`time). In memory, use `g#` on the first column with time sorted within it; on disk, use `p#` (`g#` does not help on disk). — [KX, aj reference](https://code.kx.com/q/ref/aj/)
- **Vendor-side versioning precedent.** IvyDB versions its manual and data with a dated revision log and "rollover dates", and separates raw files (Option_Price), early-delivery files (Open_Interest), parameter files (Zero_Curve, Index_Dividend, Distribution_Projection) and derived files (Volatility_Surface, Std_Option_Price). This is a working example of keeping inputs, parameters and derivations separable. — [IvyDB US Reference Manual v5.0](https://lib.tsinghua.edu.cn/PDF/OptionMetricsshiyongzhinan.pdf)
- **Browser storage (MDN, current).**
  - **Quota:** Chromium allows an origin "up to 60% of the total disk size in both persistent and best-effort modes". Firefox best-effort allows the smaller of 10% of the disk or a 10 GiB group limit, and persistent storage up to 50% of the disk, capped at 8 TiB. Safari or WebKit browser apps allow about 60% of the disk per origin, with an overall cap of 80%.
  - **Eviction:** under pressure, browsers evict the least recently used origin, and "all of its data, not parts of it, is deleted at the same time". Origins granted `navigator.storage.persist()` are skipped and only deleted by the user. Chromium and Safari approve persistence silently based on engagement, while Firefox prompts.
  - **Measuring use:** `navigator.storage.estimate()` returns an estimate of usage and quota.
  
  — [MDN, Storage quotas and eviction criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)

### Inferences
- **Layering (established practice; specific names are a proposal):**
  1. **raw layer:** append-only event log. Spot ticks or minute bars, quote snapshots, OI counts keyed by `count_date`, vendor book snapshots keyed by `received_at`, and rate/dividend vintages.
  2. **derived layer:** an exposure grid per `(underlying, session, lens, model_version)`, as a dense `Float32Array[strikes × minutes]` plus a strike axis, a time axis and a provenance bitmask.
  3. **cache:** keyed on `inputs_hash`, so a changed input or a new model version invalidates only what it touches.
  
  This is event sourcing in practice: the grid is a projection that can be rebuilt from the log.
- **Incremental recalculation.** Because OI is fixed intraday, a new minute requires only re-pricing gamma at the new spot and time to expiry, about strikes × expiries Black-Scholes evaluations. Appending one column is O(contracts), so there is no need to recompute the day.
- **Size estimate for one name-day.** About 400 strikes × 390 minutes ≈ 156k cells. As Float32 that is about 0.6 MB per lens, per day, before compression. Even several lenses × a year of sessions × a handful of names fits comfortably inside browser quotas. The risk is eviction (whole-origin, LRU), not quota, so request `persist()`, keep a server or file export for anything that must survive, and treat IndexedDB as a cache.
- **Raw-input record sizes.** Raw minute-quote archives (method c) are orders of magnitude larger (every series × minute). They belong server-side in Parquet or ClickHouse, sorted by (underlying, expiry, strike, time) or (underlying, time), not in the browser.

### Gaps
- No primary benchmark was found comparing Parquet, ClickHouse, Timescale and kdb+ specifically on options-chain minute data.
- The ClickHouse codec guidance came from secondary sources. The official ClickHouse codec documentation was not fetched.

## 5. Validation: independent test cases and error metrics

### Takeaway
Validate in layers:
1. **Pricing and greeks against reference implementations:** pure-Python reference vollib, QuantLib, and published textbook values.
2. **Internal consistency:** put-call parity for European options, numerical greeks against analytic greeks, and gamma symmetry between call and put at the same strike for European BS.
3. **IV inversion round-trip:** price → IV → price.
4. **Reconstruction against measured:** compare the modeled grid to vendor snapshots at the timestamps actually captured, with per-strike and aggregate error metrics, and with a test that fails on look-ahead (Section 3).

### Cited Findings
- **Reference implementation for greeks.** `vollib`'s `ref_python` package is "a pure python version of vollib without any dependence on LetsBeRational … provided purely as a reference implementation for sanity checking", covering Black, Black-Scholes and Black-Scholes-Merton. — [PyPI: vollib](https://pypi.org/project/vollib/); [GitHub: vollib/vollib](https://github.com/vollib/vollib)
- **IV inversion accuracy.** Jäckel's "Let's Be Rational" (Wilmott 2015) reaches maximum attainable (double) precision in at most two higher-order iterations from a rational initial guess. That makes a round-trip test tolerance near machine precision a reasonable target for European-style IV. — [PyPI: lets_be_rational](https://pypi.org/project/lets_be_rational/); [NAG s30acc documentation](https://www.nag.com/numeric/nl/nagdoc_28.4/clhtml/s/s30acc.html)
- **Put-call parity as a check.** IvyDB uses put-call parity regression on index options to back out an implied dividend yield. The same identity, `C − P = S·e^{−qT} − K·e^{−rT}`, serves as an independent consistency check on any priced chain and on the rate and dividend inputs. — [IvyDB US Reference Manual v5.0, "Dividends"](https://lib.tsinghua.edu.cn/PDF/OptionMetricsshiyongzhinan.pdf)
- **Vendor field definitions and units vary.** IvyDB vega is "in cents, for one percentage point change in volatility", and theta is "in terms of dollars per year". UW charm comes ×365. A validation suite must pin units before comparing. — [IvyDB US Reference Manual v5.0](https://lib.tsinghua.edu.cn/PDF/OptionMetricsshiyongzhinan.pdf); /home/user/3abida/docs/data-feed.md and /home/user/3abida/CLAUDE.md ("UW'S CHARM IS A YEAR'S")

### Inferences
- **Recommended test set.** Most of these items are established practice; tolerances are suggestions.
  - (i) A fixed table of BS price, delta, gamma, vega, theta for a grid of (S, K, T, σ, r, q) from `vollib.ref_python` or QuantLib, asserting relative error below 1e-10 for the house pricer.
  - (ii) Finite-difference gamma against analytic gamma.
  - (iii) Parity residuals on every priced European pair, with the threshold in ticks.
  - (iv) IV round-trip error.
  - (v) Golden-file regression: a pinned input snapshot produces a byte-identical grid per `model_version`, and any diff requires a version bump.
  - (vi) Reconstruction against captured vendor books at matching timestamps. Measure per-strike MAE or RMSE normalised by the total absolute book, a rank correlation of the strike profile, absolute error in the flip level (in points or strikes), whether the call and put walls hit exactly, and the sign agreement of net GEX.
  - (vii) A look-ahead test: perturb any input with knowledge time > t, and assert that cell t is unchanged.
- **Comparing to a vendor needs matched conventions.** Before comparing, align the dealer-sign convention (the SqueezeMetrics long-calls/short-puts rule versus others), the OI date, the multiplier, the spot used, and units (per 1% versus per 1 point, ×365). Otherwise the errors measure conventions, not reconstruction quality.

### Gaps
- No published, independent benchmark dataset of "true" per-strike GEX exists to validate against. Vendor numbers are themselves modeled.
- The vollib test-suite contents and QuantLib reference-test values were not fetched in this pass.

## 6. Rendering performance for large strike × time grids

### Takeaway
At the scale of one name-day (about 10⁵ cells per lens), a 2D canvas drawing an `ImageData` or a cached bitmap (one pixel or cell per strike × minute, scaled with smoothing off) is sufficient. Redraw only the new column on each update, and composite the cached bitmap under the live chart.

WebGL (a data texture plus a colour-map shader) becomes worthwhile for multi-day or pan/zoom-heavy views: upload a typed array, and update it incrementally with `texSubImage2D`. Pre-aggregation or level-of-detail (bucketing minutes and strikes to the screen's pixel resolution) bounds the cost regardless of data size.

### Cited Findings
- **Large uploads can jank.** On slow devices with a large canvas, `texImage2D` can take longer than a frame. The suggested mitigation is to upload in chunks with `texSubImage2D`, scheduled across frames (for example with `requestIdleCallback`). — [Khronos public_webgl mailing list](https://www.khronos.org/webgl/public-mailing-list/public_webgl/1511/msg00008.php)
- **Readbacks are costly.** Reading GPU memory back (for example `getImageData` on a WebGL-backed canvas) may stall the GPU, so avoid round-trips in a per-frame pipeline. — [WebGL2 Fundamentals, loading images without jank](https://webgl2fundamentals.org/webgl/lessons/webgl-qna-how-to-load-images-in-the-background-with-no-jank.html)
- **WebGL resources do not cross contexts.** Textures, programs and buffers cannot be shared across contexts, so a worker cannot upload a texture for the main thread's context. The whole render must move to the worker via OffscreenCanvas, or stay on the main thread. — [three.js forum](https://discourse.threejs.org/t/performance-ideas-loading-objects-in-workers-faster-texture-uploads-etc/25328/9); [Evil Martians, OffscreenCanvas + workers](https://evilmartians.com/chronicles/faster-webgl-three-js-3d-graphics-with-offscreencanvas-and-web-workers)
- **Canvas-sourced texture uploads vary by browser.** They have historically been slow in some browsers: a Chromium change sped `texSubImage2D(Canvas)` up about 12×. Uploading typed arrays avoids that path. — [Chromium code review 735623003](https://codereview.chromium.org/735623003)
- **Project precedent.** Terrain's "walls through the day" heat is drawn as "one cached bitmap an update" behind the candles. — /home/user/3abida/CLAUDE.md ("TERRAIN'S OVERLAYS")

### Inferences
- **Level of detail.** Never draw more cells than device pixels. Pre-aggregate time (1m → 5m → 30m) and strikes (bucket to the visible strike step) into a mip-like pyramid. Pick the level whose cell count is at most the pixel count of the viewport.
- **Fixed colour scale.** Keep the colour scale fixed over the session, or as-of t. A colour scale fitted to the whole day shifts earlier columns' colours as new data arrives, which is a visual form of the look-ahead in Section 3.
- **Tiling.** Tile only when panning across many sessions. For one session, a single bitmap per lens plus a one-column patch per update is simpler and cheaper.

### Gaps
- No current (2025–2026) benchmark was found comparing Canvas2D `putImageData`, `drawImage` of a cached bitmap, and WebGL data textures for heatmaps of this size. Measure on target hardware.
- The browser-specific notes from 2015–2022 sources (OffscreenCanvas support, upload paths) may be outdated. Current OffscreenCanvas support across browsers was not re-verified here.
