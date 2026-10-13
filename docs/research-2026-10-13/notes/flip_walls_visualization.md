# Gamma flip, walls, and strike-by-time exposure visualization (as of October 2026)

Scope: (1) how the zero-gamma level, call wall, put wall and exposure concentrations are computed by providers and open-source code, with edge cases and honest tracking of level changes; (2) how strike-by-time exposure is drawn and which practices avoid misleading readings. Vendor wording is quoted or paraphrased from each vendor's own pages. Most vendors' positioning models are proprietary and cannot be checked from outside.

## Zero gamma (gamma flip): profile sweep vs per-strike sign change

### Takeaway
There are three methods in use, and they give different numbers. (a) The **profile sweep**: reprice every contract's gamma at hypothetical spot prices, sum, and find where the total crosses zero. This is the root of a function of spot. (b) The **cumulative or per-strike crossing**: find where per-strike net GEX, or its running sum across strikes, changes sign at today's spot, interpolated between two strikes. (c) **Proprietary "regime" levels** such as SpotGamma's Volatility Trigger and MenthorQ's HVL, which their vendors say are not the plain crossing. A well-behaved implementation states its search band, returns null when there is no crossing, and shows the other crossings instead of hiding them. Unusual Whales now does this in its own API, and FlashAlpha says it does.

### Cited Findings
- **Origin of the GEX convention.** SqueezeMetrics' white paper "Gamma Exposure" (March 2016, revised December 2017) sets out four assumptions. Every option is facilitated by delta-hedgers. Calls are sold by investors and bought by market makers. Puts are bought by investors and sold by market makers. Market makers hedge exactly to the option's delta. Per strike, calls are GEX = Γ·OI·100 and puts are Γ·OI·(−100). "The GEX of a stock (or index) is the summation of GEX at every strike price in every available contract." The paper calls the dealers-long-calls/short-puts sign an assumption, supported by "an analysis of skew, open interest at strike, and (circularly) the effects of GEX." — [SqueezeMetrics white paper (PDF)](https://squeezemetrics.com/download/white_paper.pdf)
- **Unusual Whales' unit and assumption (API docs).** "GEX is the assumed $ value of the given greek (ie. gamma) exposure that market makers need to hedge per 1% change of the underlying." "GEX assumes that market makers are part of every transaction and that the bulk of their transactions are buying calls and selling puts." Per contract: gamma × 100 × 0.01 × price × price, summed over OI or directionalized volume. — [UW API: GEX exposures by strike](https://api.unusualwhales.com/docs/api/gexgreeks/gex-exposures-by-strike.md)
- **Open-source profile sweep, with file and lines.** `jensolson/SPX-Gamma-Exposure`, file `GEX.py`, function `CBOE_GEX`:
  - Grid (lines 233–238): 20 points, step 10 index points for SPX/NDX and 1 for others, centred on spot (roughly ±100 SPX points).
  - Repricing (lines 240–246): Black gamma is recomputed at each grid price. GEX at each point = 100·F·Γ·OI for calls minus the same for puts, in $mm.
  - Root (line 259): `zeroGEX = int(np.interp(x=0, xp=s.values, fp=s.index))`, a linear interpolation of the grid point where the profile equals 0.
  - Filters applied before any of this (lines 218–230): OI > 10, bid > 0.05, **business days to expiry ≥ 1** (this drops 0DTE), 1% < IV < 200%, |delta| < 0.95.
  - [GEX.py raw](https://raw.githubusercontent.com/jensolson/SPX-Gamma-Exposure/master/GEX.py); [repo](https://github.com/jensolson/SPX-Gamma-Exposure)
- **Perfiliev's article "How to calculate gamma exposure and zero gamma level"** is the reference most often cited for the open-source sweep. Its live page returned HTTP 503 on every attempt, and the Wayback copy (snapshot 2024-06-13) could not be fetched from this environment. Its code could not be quoted. — [perfiliev.co.uk (unreachable)](https://perfiliev.co.uk/market-commentary/how-to-calculate-gamma-exposure-and-zero-gamma-level/)
- **SpotGamma's definition:** "Zero Gamma, also called the Gamma Flip, is the spot price where aggregate dealer gamma crosses zero." SpotGamma separately calls the Volatility Trigger "a proprietary SpotGamma level derived from the distribution of gamma" and says it is not the single flip point. Published key levels are "set … daily, and they hold for the trading session," based on the "Total Open Interest model." — [SpotGamma: options key levels explained](https://spotgamma.com/options-key-levels-explained/). The SpotGamma glossary article "Zero Gamma" returned 403. — [support.spotgamma.com](https://support.spotgamma.com/hc/en-us/articles/15297958613907-Zero-Gamma)
- **Unusual Whales `/api/stock/{ticker}/gex-levels`, the per-strike crossing method:**
  - `gamma_flip` is the "interpolated price where net dealer gamma crosses zero (between the two strikes)." It "can be `null` or far from spot, so do not use it for regime detection." Use the sign of total net gamma instead.
  - `nearby_flips` "lists every zero-gamma crossing near spot, ordered by distance from it and capped at five … On chains with many strikes the crossings often cluster within a dollar or two, which means no single level is decisive."
  - `gamma_flip` is null "when net gamma does not change sign across the strike range."
  - Since 2026-08-22 the levels are built by default from **directionalized volume** (the day's ask- or bid-side flow) rather than "a cumulative total over the static open-interest snapshot". `source=oi` restores OI. The response now echoes `source`, `date` and `time`.
  - [UW API: GEX Levels](https://api.unusualwhales.com/docs/api/gexgreeks/gex-levels.md)
- **UW per-strike timestamps.** Each strike carries the `time` and `price` of its last recalculation. "A price move alone does not recalculate a strike. Strikes within one response can differ in `time`, possibly by hours." A past date is rebuilt from end-of-day data. — [UW API: GEX exposures by strike](https://api.unusualwhales.com/docs/api/gexgreeks/gex-exposures-by-strike.md)
- **FlashAlpha's critique of the shortcut** (vendor article, partly marketing):
  - The common shortcut "scans today's per-strike GEX for sign changes" and can jump when spot barely moves.
  - Its method: "we reprice every contract's gamma across candidate underlying prices and solve for the price where aggregate dealer gamma crosses zero." The output is a continuous price rather than the nearest listed strike.
  - Null with status `no_boundary` when "aggregate gamma keeps one sign across the whole search band."
  - Zero-gamma, zero-IV legs (one-sided markets, the last minute before expiry) are excluded.
  - Same-day contracts pass a quote-quality gate: the mid's time value must exceed the bid-ask spread for ≥75% of OI.
  - A stress test scales each strike's gamma by 0.75 and 1.25, with a tolerance of 0.1% of spot (retried at 0.25%).
  - "Publication involves no temporal smoothing and never carries an earlier level forward," because "averaging a bistable quantity gives you a number that sits between two attractors."
  - Self-reported example: a level computed without the gates "crossed from below spot to above spot and back five times in thirteen minutes, on an underlying that moved 0.03%."
  - Self-reported results: of 4,575 historical captures, 2,213 certified, 1,273 unverified, 1,089 with no boundary.
  - [FlashAlpha: The gamma flip problem](https://flashalpha.com/articles/gamma-flip-methodology-stable-zero-gamma-level)
- **Two different cumulative-crossing rules are in circulation.** One is "where cumulative gex crosses zero, nearest to spot." The other is "lowest-strike first-crossing of cumulative GEX." These can disagree. The source is a search summary of third-party pages, low confidence. — [FlashAlpha concepts](https://flashalpha.com/docs/concepts.md); [sslip.io methodology page](https://13.140.148.217.sslip.io/methodology)
- **MenthorQ's HVL is not the plain crossing.** MenthorQ says the HVL is "derived from the inflection point in the slope of the cumulative gamma exposure curve" and marks the regime change between positive and negative gamma. — [MenthorQ Product Training: Gamma Levels (PDF)](https://menthorq.com/wp-content/uploads/2023/11/Product-Training-Gamma-Levels.pdf); [MenthorQ academy: trade the high vol level](https://menthorq.com/academy/gamma-levels/lessons/trade-the-high-vol-level/)
- **0DTE is handled differently by each source:**
  - MenthorQ computes "gamma exposure across all strikes and 0DTEs" and publishes separate 0DTE levels (Call Resistance 0DTE, Put Support 0DTE, HVL 0DTE, Gamma Wall 0DTE) "to filter out long-dated noise." — [MenthorQ PDF](https://menthorq.com/wp-content/uploads/2023/11/Product-Training-Gamma-Levels.pdf)
  - SpotGamma TRACE's strike plot has a toggle to "see ONLY 0DTE positions." — [TRACE User Manual (PDF)](https://spotgamma.com/wp-content/uploads/2025/07/TRACE-User-Manual-Final-Version.pdf)
  - The jensolson code drops expiries with <1 business day. — [GEX.py L218–220](https://raw.githubusercontent.com/jensolson/SPX-Gamma-Exposure/master/GEX.py)

### Inferences
- **Why the two methods differ.** The per-strike crossing answers "where, along the strike axis, does today's book change sign at today's spot?" The sweep answers "at what spot would the whole book's gamma be zero?" These are different questions. They can differ by several strikes, especially when large OI sits away from spot, because gamma re-weights toward strikes near each hypothetical spot. The sweep is the one that matches SpotGamma's and SqueezeMetrics-style wording ("the spot price where aggregate dealer gamma crosses zero").
- **Edge cases an honest implementation should handle:**
  - No crossing in the band: return null or "no boundary". Do not clamp to the band's edge.
  - Several crossings: report the one nearest spot and list the others, as UW's `nearby_flips` does. Never pick silently.
  - A crossing far from spot: show the distance and treat it as weak.
  - Interpolation: use linear between the two bracketing grid points or strikes, and say that the level is interpolated.
- **A likely fragility in the jensolson root (L259).** `np.interp` assumes `xp` is increasing. With `xp` set to the GEX values, a non-monotonic profile (several crossings) would give an unreliable root. A bracketing sign-change search on the grid is safer. This is my reading of the code, not a documented bug.
- **Expiry inclusion changes the answer.** Including 0DTE makes the profile steep near spot late in the day. Excluding it (jensolson) or splitting it out (MenthorQ) gives a slower-moving level. A display should say which expiries are in the level.

### Gaps
- Perfiliev's original code (grid range, step, "ex-next-expiry" profiles) could not be retrieved: the site returned 503 and the archive was blocked.
- SpotGamma's exact Zero Gamma computation (sweep range, expiries, use of its inventory model vs OI) is not public. The glossary page returned 403.
- I found no published head-to-head numerical comparison of sweep vs per-strike flip on the same chain beyond FlashAlpha's self-reported figures.

## Call wall, put wall and other concentration levels: definitions by provider

### Takeaway
"Largest net call gamma strike" and "largest net put gamma strike" form the common core (SpotGamma, MenthorQ). Providers diverge on details:
- whether the wall must sit above or below spot (UW requires it);
- whether the call and put sides are netted per strike or kept apart (SpotGamma, MenthorQ keep them apart; UW uses net gamma);
- OI vs modeled inventory vs directionalized volume;
- daily-fixed vs intraday levels.

Everything beyond the plain argmax is vendor-specific and mostly proprietary: Volatility Trigger, HVL, Gamma Wall 0DTE, TRACE lenses, Skylit nodes.

### Cited Findings
- **SpotGamma:**
  - Put Wall: "the strike with the largest net put gamma." The Call Wall is the call-side equivalent, "the strike with the largest concentration of call gamma."
  - Put-wall support is "conditional": deep in negative gamma, hedging amplifies and a put wall "can give way quickly."
  - Walls are derived from "the strikes with the largest open interest or largest gamma" under "a fixed assumption about who holds the contracts." Migration is "the wall rolling to a higher or lower strike as positioning shifts."
  - [SpotGamma: call wall / put wall explained](https://spotgamma.com/call-wall-put-wall-explained/); [SpotGamma Put Wall glossary](https://support.spotgamma.com/hc/en-us/articles/15297856056979-Put-Wall)
- **SpotGamma level definitions:** Absolute Gamma Strike is "the strike holding the largest total gamma." Call Wall is "the strike with the most significant overhead call concentration." Put Wall is "the strike with the most significant downside put concentration." Levels are fixed for the session. — [SpotGamma key levels](https://spotgamma.com/options-key-levels-explained/)
- **MenthorQ:**
  - Call Resistance is "the strike price with the highest net call gamma exposure." Put Support is "the strike price with the highest net put gamma exposure."
  - "The widest bars point to the strikes where dealers are most exposed—these become our Call Resistance and Put Support Zones."
  - Secondary levels are labelled GEX 1–10, plus 1D Min/Max and 0DTE variants.
  - [MenthorQ training PDF](https://menthorq.com/wp-content/uploads/2023/11/Product-Training-Gamma-Levels.pdf)
- **Unusual Whales:**
  - `call_wall` is the "strike above spot with the largest positive net gamma." `put_wall` is the "strike below spot with the largest positive net gamma." `gamma_magnet` is the "strike with the largest-magnitude net gamma (the strongest pin)."
  - Note that UW's put wall is the largest **positive net** gamma below spot. This is a different quantity from SpotGamma's and MenthorQ's "largest net put gamma."
  - [UW API: GEX Levels](https://api.unusualwhales.com/docs/api/gexgreeks/gex-levels.md)
- **UW directionalized volume:** "When a trade is made closer to the ask, the Market Maker would be selling the contract and when a trade is closer to the bid then the Market Maker would be buying." — [UW API: GEX by strike](https://api.unusualwhales.com/docs/api/gexgreeks/gex-exposures-by-strike.md)
- **SpotGamma's modeled inventory.** TRACE "is built off of SpotGamma's proprietary Options Inventory Model." Its colour scale shows "notional value of delta … or gamma … based on current market makers' position." — [TRACE User Manual](https://spotgamma.com/wp-content/uploads/2025/07/TRACE-User-Manual-Final-Version.pdf). SpotGamma's marketing says SGOI "estimates actual market-maker and buyside positioning per strike." This is unverifiable. — [SpotGamma call/put wall](https://spotgamma.com/call-wall-put-wall-explained/)
- **Volland (vanna/charm levels):** no primary methodology page was found. Third-party (Benzinga) write-ups using Volland define vanna as delta's change per 1 point of IV and offer sign heuristics from one author. — [Benzinga](https://benzinga.com/z/33837719). Treat these as unverified.
- **Skylit (Heatseeker "nodes", "king node"):** no primary definition was found. It is mentioned only as a strike-by-time gamma heatmap product. — [FlashAlpha 0DTE heatmap article](https://flashalpha.com/articles/0dte-gamma-heatmap-api-strike-time-gex-hiro-heatseeker-alternative)
- **Tier1Alpha:** no methodology page was retrieved. See Gaps.
- **The dealer sign is an assumption.** OI does not reveal who is long, and "dealers long calls, short puts" is a heuristic. — [SqueezeMetrics white paper](https://squeezemetrics.com/download/white_paper.pdf); [FlashAlpha on signing OI](https://flashalpha.com/articles/why-gex-isnt-enough-vanna-charm-exposure-predict-market-moves)

### Inferences
- **The established definition** is argmax over strikes of call-side gamma exposure (call wall) and of put-side gamma exposure (put wall), with the expiry set stated.
- **Vendor variants:**
  - restricting walls to the correct side of spot (UW);
  - using net gamma rather than one side;
  - modeled inventory;
  - volume-based intraday books;
  - "high vol level" and "volatility trigger" constructs.
- **Two separate ways a wall moves:**
  - *OI change (overnight)*: the argmax on the OI book moves to another strike.
  - *Spot, IV or time change*: per-strike gamma re-weights. Γ peaks near the money and narrows as expiry approaches, so the argmax can hop between neighbouring strikes of similar OI with no positioning change at all.
- **Thresholds.** A wall whose top strike beats the runner-up by only a few percent is fragile. Showing the runner-up and the margin is more honest than one line.

### Gaps
- No primary methodology was found for Tier1Alpha, Volland or Skylit level definitions. Their exact rules are vendor-specific and appear proprietary.
- SpotGamma's "Hedge Wall" was not defined on the pages retrieved.

## Tracking level changes over time without false attribution to dealer activity

### Takeaway
A published level moves for at least five reasons:
1. spot moved (gamma re-weights across strikes);
2. IV changed;
3. time passed (gamma sharpens near expiry, and expiries roll off);
4. OI or positioning changed (overnight with OI, intraday only with a volume or inventory model);
5. the method changed (sign convention, source, expiry set).

No vendor publishes a decomposition. Honest tracking stamps each reading with its inputs and timestamps, and labels which factor moved.

### Cited Findings
- **OI is a once-a-day input.** SpotGamma levels "hold for the trading session" and are recalculated for the next session as new positioning data arrives. — [SpotGamma key levels](https://spotgamma.com/options-key-levels-explained/)
- **UW strike recalculation.** A strike recalculates "when one of its contracts gets new greeks or a new trade, or when the daily open interest loads … A price move alone does not recalculate a strike." Strikes can differ in `time` by hours. — [UW API: GEX by strike](https://api.unusualwhales.com/docs/api/gexgreeks/gex-exposures-by-strike.md)
- **UW changed its default method on 2026-08-22** from cumulative OI to directionalized volume. Levels can therefore differ before and after that date for method reasons alone. — [UW API changelog in GEX Levels doc](https://api.unusualwhales.com/docs/api/gexgreeks/gex-levels.md)
- **SpotGamma TRACE's history and replay:**
  - "Strike Bar Dots" show the GEX/OI/Net OI reading "from previous timeframes - 10, 30, and 60-minutes prior."
  - A Timeline Slider "allows users to replay how market maker and dealer positioning has changed … (updated every 10 minutes)." It shows "the estimated position for the selected time."
  - [TRACE User Manual](https://spotgamma.com/wp-content/uploads/2025/07/TRACE-User-Manual-Final-Version.pdf)
- **Against smoothing.** FlashAlpha publishes with "no temporal smoothing" and never carries an earlier level forward. It reports appear/vanish transitions and "max certified jump between minutes 0.32% of spot." All self-reported. — [FlashAlpha](https://flashalpha.com/articles/gamma-flip-methodology-stable-zero-gamma-level)
- **What the sources support on drivers.** GEX depends on spot (S² in dollar terms), IV and time. OI is a prior-night snapshot, and the dealer sign is assumed. — [SpotGamma: gamma exposure](https://spotgamma.com/gamma-exposure); [LuxAlgo GEX concept](https://www.luxalgo.com/library/concept/gamma-exposure.md). I found no source that formally decomposes level changes.

### Inferences
- **A practical sequential attribution** (my construction, unsourced). From reading t0 to t1, recompute the level:
  1. at the new spot, with old IV, old time and old book: the spot effect;
  2. then with the new IV: the vol effect;
  3. then with the new time to expiry or expiry set: the time and roll-off effect;
  4. then with the new book (OI or volume): the positioning effect.
  
  Only step 4 may be described as "positioning changed." The order matters (path dependence), so it should be fixed and disclosed.
- **Session rules for an OI-based book.** Within a session, any level move on an OI-only book is by construction spot, IV or time, never "dealers did X." It should be labelled that way.
- **Record each reading with:** the book's timestamp (and per-strike staleness), the spot it was evaluated at, the source (OI vs volume), the expiry set, and the method version.
- **Show existence changes explicitly.** When a flip appears or vanishes (no crossing in the band), draw a gap. Never carry the last value forward or interpolate across the gap.

### Gaps
- No vendor documentation or academic source was found that decomposes level changes into spot, IV, time and OI. The method above is a proposal.

## Visualizing exposure across strikes and time alongside price

### Takeaway
The dominant design is a strike (y) × time (x) heatmap behind candlesticks: SpotGamma TRACE, plus FlashAlpha, QuantWheel and Glassnode clones. It uses a signed diverging colour (blue positive, red negative in TRACE), a strike-plot profile at the side, a hover readout, contours, history dots and a replay slider. The scaling knobs that make or break honesty are percentile cut-offs (Bookmap) and scale presets (TRACE's auto/low/medium/high). They should be disclosed, because relative scaling makes the same colour mean different magnitudes at different times.

### Cited Findings
- **SpotGamma TRACE layout** (vendor manual, last update July 16, 2024):
  - x-axis 9:30–16:00 ET, "updates every 10 minutes"; left y-axis strikes; right y-axis the HIRO flow signal.
  - The colour scale is "the notional value of delta (for Delta Pressure, Charm Pressure lenses) or gamma (for Gamma lens)."
  - Blue = market makers positive gamma; red = negative.
  - "Scale Range … auto, low, medium, or high"; contour lines "help you visualize where the heatmap color is changing."
  - Hover shows "exact timestamps, SPX Index levels, and Greek values (in $ notional terms)"; candles at 1, 5 or 15 min; a 0DTE-only toggle on the strike plot; a light/dark chart toggle.
  - [TRACE User Manual (PDF)](https://spotgamma.com/wp-content/uploads/2025/07/TRACE-User-Manual-Final-Version.pdf); [SpotGamma: what is TRACE](https://support.spotgamma.com/hc/en-us/articles/33607907909011-What-is-SpotGamma-TRACE)
- **TRACE's interpretive claims are vendor claims, not established fact.** For example, price "tends to move towards zones where positive and negative Market Maker charm meet at EOD," and blue = "lower expected volatility." — [SpotGamma Charm Pressure Heatmap](https://support.spotgamma.com/hc/en-us/articles/33608198289043-What-is-the-Charm-Pressure-Heatmap)
- **Other strike-by-time heatmaps:**
  - The common layout is strikes on one axis, time on the other, metric as colour.
  - QuantWheel offers GEX, VEX and DEX on one grid.
  - FlashAlpha says its heatmap is "built on FlashAlpha's flow model — effective open interest plus aggressor-classified trades — not a dealer's actual book," an explicit modeled-data disclosure.
  - [FlashAlpha 0DTE heatmap](https://flashalpha.com/articles/0dte-gamma-heatmap-api-strike-time-gex-hiro-heatseeker-alternative); [QuantWheel GEX heatmap](https://quantwheel.com/products/gex-heatmap); [Glassnode GEX strike heatmap](https://insights.glassnode.com/gamma-exposure-heatmap)
- **Bookmap's liquidity heatmap (the model for heatmap-over-price):**
  - Colour uses upper and lower cut-offs, set either as percentiles of the current book or as exact sizes.
  - Percentile example: at a 95% upper cut-off "Bookmap will assign a white colour to the top 5% order sizes in the order book." Because these are relative values, the absolute size behind a colour shifts as the book changes.
  - Exact-size mode gives "a solid colour to any price level with an equal or greater … number of pending contracts."
  - [Bookmap KB: Heatmap settings](https://bookmap.com/knowledgebase/docs/KB-SettingUpAndOperating-HeatmapSettings); [thinkorswim Bookmap Heat Map](https://toslc.thinkorswim.com/center/howToTos/thinkManual/Bookmap/Heat-Map)
- **Why a fixed upper cut-off.** Volfix describes it as keeping scaling stable "so that short-term extraordinary sizes do not distort the whole display." — [Volfix help](https://help.volfix.net/hc/en-us/articles/35575448049565)
- **UW dashboard limitation** (third-party summary of a UW video): the GEX-by-strike graph "does not account for expiration dates," so per-strike activity can look more important than it is. — [videohighlight summary](https://videohighlight.com/v/abGy4dbRywI) (secondary, low confidence)
- **Interpolation in image rendering.** Matplotlib documents `'none'` / `'nearest'` (no resampling between cells) against a family of smoothing kernels (bilinear, bicubic, gaussian, …). It notes the default is `'auto'` (resampling). — [Matplotlib interpolation methods](https://matplotlib.org/stable/gallery/images_contours_and_fields/interpolation_methods.html). The page itself makes no claim about invented structure.

### Inferences
- **Practices that avoid misleading readings** (synthesized from the cited designs and the colour research below):
  - **Signed values:** use a diverging map centred on true zero. Sequential maps are for |exposure| or OI.
  - **Normalization:**
    - A global or fixed scale (Bookmap "exact size") keeps colour comparable across time.
    - Per-column normalization (Bookmap percentiles, TRACE "auto") makes every minute look equally intense, which hides build-up and decay. If used, say so in the legend.
  - **Heavy tails:** clip at a disclosed percentile, or use a symmetric log or asinh scale with labelled ticks. Show clipped cells as saturated, never as wrapped colours.
  - **Cell rendering:** draw cells as discrete blocks (nearest or no interpolation), one row per listed strike and one column per actual snapshot. Bilinear or Gaussian smoothing invents gradients between strikes that have no OI. Contour lines (TRACE) are a derived layer and should be optional.
  - **Missing columns:** leave a gap or hatch where no snapshot exists (data outage, a strike not recalculated, before the first read). Never forward-fill silently.
  - **Measured vs modeled:** label which. For example, OI counted at the prior close, directionalized volume estimated from aggressor side, dealer sign assumed. FlashAlpha's disclaimer and UW's per-strike `time` are examples.
  - **Interaction:** a hover readout with the exact value, timestamp, spot at evaluation and input staleness (TRACE hover); focus or highlight one strike row; replay with a slider (TRACE); and history markers, e.g. TRACE's 10/30/60-min dots, as a lightweight "trail" for the strike profile.
- **Alternatives to the full heatmap:**
  - tracked concentrations: the wall and flip drawn as step lines over time, with gaps where undefined;
  - ridgelines: a stacked per-snapshot profile, good for showing a profile reshaping;
  - beads: a marker sized by exposure at each strike-time.
  
  These trade density for precision. Lines suit a few named levels; heatmaps suit the whole field.

### Gaps
- Bookmap's own document on heatmap colour (the KB-Indicators-Heatmap page) returned 404. Only the settings page and summaries were used.
- No primary documentation was found for Skylit, Volland or Unusual Whales chart rendering choices (scale, interpolation, normalization).
- No academic study was found specifically on strike × time options-exposure heatmaps.

## Perceptual and visual-analytics guidance relevant to heatmaps over time

### Takeaway
The colour research is consistent:
- use perceptually uniform maps (sequential with monotonic lightness, or diverging with a neutral midpoint for signed data);
- avoid rainbow, jet and red-green pairs at equal luminosity;
- always show a colour bar.

Colour encodings help readers judge averages over a span of time, which suits a time-axis heatmap. Exact values still need a readout.

### Cited Findings
- **Crameri, Shephard & Heron (2020), "The misuse of colour in science communication"**, *Nature Communications* 11:5444:
  - "A perceptually uniform colour map weights the same data variation equally all across the dataspace."
  - Lightness and brightness "should increase linearly to avoid the perception of artificial gradients."
  - "The colour map should not contain red and green at a similar luminosity."
  - Rainbow maps "add artificial boundaries to some parts of the data range, hiding small-scale variations elsewhere."
  - "The common rainbow colour map should not be used in data visualisation."
  - Colour-induced misreading "can diverge from an objective representation by more than seven percent of the displayed data variation."
  - For data centred on a value such as zero, "a divergent or a multi-sequential colour map should be chosen."
  - Always include a colour bar.
  - [PMC full text](https://pmc.ncbi.nlm.nih.gov/articles/PMC7595127); maps at [fabiocrameri.ch/colourmaps](https://www.fabiocrameri.ch/colourmaps)
- **Moreland (2009), "Diverging Color Maps for Scientific Visualization"** (ISVC, LNCS, DOI 10.1007/978-3-642-10520-3_9): argues against the rainbow map and supplies a cool–warm diverging map (blue → neutral grey → red) with an algorithm for custom diverging maps. — [Academia.edu abstract](https://www.academia.edu/87341313/Diverging_Color_Maps_for_Scientific_Visualization)
- **Borland & Taylor (2007), "Rainbow Color Map (Still) Considered Harmful"** (IEEE CG&A 27(2):14–17): the rainbow obscures data and introduces artefacts. A 2023 rebuttal by Ware, Stone & Szafir ("Rainbow Colormaps Are Not All Bad") argues the avoidance has become dogma. This is a nuance for categorical lookup tasks, not for signed magnitude. — [Utah SCI library](https://www.sci.utah.edu/~kpotter/Library/Papers/borland:2007:RCCH/index.html); [UNH: Rainbow Colormaps Are Not All Bad](https://ccom.unh.edu/publications/rainbow-colormaps-are-not-all-bad)
- **Correll, Albers, Franconeri & Gleicher (2012), "Comparing Averages in Time Series Data":** a colour encoding "significantly outperforms" the line graph for finding the region of maximum average. — [paper PDF](https://visualcognition.psych.northwestern.edu/publications/CorrellAlbersFranconeriGleicher2012.pdf)
- **Albers, Correll & Gleicher (CHI 2014), "Task-Driven Evaluation of Aggregation in Time Series Visualization":** the best design depends on the task. Colour supports summary comparisons; positional encodings support point reading. — [UW Graphics](https://graphics.cs.wisc.edu/Papers/2014/ACG14/)

### Inferences
- **For signed exposure**, a cool–warm or Crameri diverging map (e.g. *vik*, *berlin*) centred exactly at 0 meets the research. Asymmetric ranges should stay centred on 0 and not stretch each side independently, or equal colours will not mean equal magnitudes.
- **Blue and red** match TRACE's convention and avoid the red-green confusion Crameri warns about. The neutral middle should be the background ink, so that "no exposure" recedes.
- **Pairing the heatmap with a strike-profile bar chart and a hover value** follows Albers et al.: the heatmap carries trends, and precise reading needs position or text.
- **Tufte:** no primary Tufte source was retrieved in this session. Any data-ink or "chartjunk" claims should be sourced separately.

### Gaps
- Moreland's full paper and Tufte's texts were not fetched. Only the abstract and summaries are cited.
- No perceptual study was found on per-column vs global normalization in time-series heatmaps. The recommendation above is reasoned, not measured.
