# Dealer (market-maker) options positioning: what can and cannot be known, with a focus on intraday estimation

Scope note: these notes are about the evidence only, as of 2026-10-13. Every number below comes from the cited page. Where a page could not be opened or a claim could not be verified, it is listed under Gaps rather than stated. The labels used throughout are:
- **OBSERVED**: measured from exchange or clearing records that carry who traded (origin code) and/or open/close flags.
- **MODELED**: a number built from public open interest or the tape plus a sign assumption or classification rule.

---

## 1. What the key papers find and assume, and which ones use real dealer-position data

### Takeaway
The academic papers that make the strongest causal claims about hedging feedback (Ni-Pearson-Poteshman 2005; the Pearson-Poteshman-White working paper, later Ni-Pearson-Poteshman-White, RFS 2021; Garleanu-Pedersen-Poteshman 2009) measure dealer positions from CBOE records keyed to OCC origin codes. Those records are daily, end-of-day and not public in real time. The papers practitioners cite most for "GEX" effects use public open interest plus a fixed sign convention:
- Baltussen-Da-Lammers-Martens (JFE 2021) assumes dealers are long all calls and short all puts, and part of its sample is SqueezeMetrics data.
- Barbon-Buraschi uses a "proxy" whose construction could not be confirmed from its public page.

So the observed-data literature is daily and historical. The intraday "dealer gamma" estimates used in practice are models.

### Cited Findings

**Pearson, Poteshman and White working paper (2006), the precursor of Ni, Pearson, Poteshman and White (RFS 2021)**
- Data: OBSERVED, daily, historical.
  - The data come from CBOE: "several categories of daily open interest for every equity option series that trades at the CBOE from the beginning of 1990 through the end of 2001", covering all exchanges for CBOE-listed names. — [Pearson, Poteshman & White WP 2006 (ou.edu)](https://ou.edu/dam/price/Finance/CFS/paper/pdf/pearsonPoteshmanWhite.pdf)
  - The four categories are "purchased and written open interest by public customers and purchased and written open interest by firm proprietary traders". The categories follow the OCC classification: "the OCC assigns an origin code of public customer, firm proprietary trader, or market maker to each side of every transaction." — [same](https://ou.edu/dam/price/Finance/CFS/paper/pdf/pearsonPoteshmanWhite.pdf)
- Market-maker position is inferred by an accounting identity, not a model assumption:
  - "Although we do not have data on market maker open interest, we do have data on the purchased and written open interest of public customers and firm proprietary traders. We use the fact that the sum of the market maker, public customer, and firm proprietary trader open interest on any option series at any point of time must be zero." — [same](https://ou.edu/dam/price/Finance/CFS/paper/pdf/pearsonPoteshmanWhite.pdf)
- Who hedges: the paper assumes market makers, or market makers plus firm proprietary traders, are the delta-hedgers. It cites Cox and Rubinstein (1985) and Hull (2003) for this. — [same](https://ou.edu/dam/price/Finance/CFS/paper/pdf/pearsonPoteshmanWhite.pdf)
- Result (working-paper abstract): "a statistically and economically significant negative relationship between stock return volatility and net purchased option positions of investors who are likely to hedge". The result is robust to including firm proprietary traders among the hedgers and to excluding expiration week. — [same](https://ou.edu/dam/price/Finance/CFS/paper/pdf/pearsonPoteshmanWhite.pdf)
- Publication: the published version is in the Review of Financial Studies, vol. 34, issue 4, pp. 1952–1986 (2021). — [IDEAS/RePEc](https://ideas.repec.org/a/oup/rfinst/v34y2021i4p1952-1986..html)
  - A secondary summary says the published paper "documents a noninformational channel through which option market maker hedge rebalancing affects stock return volatility and the probability of large stock price moves". — [SUFE academic newsletter](https://academicnewsletter.sufe.edu.cn/info/352173)

**Ni, Pearson and Poteshman (2005), "Stock price clustering on option expiration dates", JFE 78(1):49–87**
- Closing prices of optionable stocks cluster at strike prices on expiration dates.
- Returns are shifted by at least 16.5 bp per expiration date, on the order of $9 billion of market capitalisation.
- The authors attribute the clustering to hedge rebalancing by option market makers and to manipulation by firm proprietary traders.
- The data include CBOE statistics that split open interest and volume into four investor categories, including market makers (OBSERVED, daily). — [CXO Advisory summary](https://www.cxoadvisory.com/equity-options/stock-price-pinning-at-options-expiration); [HKBU record](https://scholars.hkbu.edu.hk/en/publications/stock-price-clustering-on-option-expiration-dates-3/); [OptionMetrics research note](https://optionmetrics.com/?p=1084)

**Garleanu, Pedersen and Poteshman (2009), "Demand-Based Option Pricing", RFS**
- Data: OBSERVED, daily.
  - The sample runs from 1996 through 2001. The net demand data "were obtained directly from the Chicago Board Options Exchange (CBOE)… a daily record of closing short and long open interest". — [NBER WP 11843](https://www.nber.org/papers/w11843.pdf)
  - "The entire option market is comprised of public customers, firm proprietary traders, and market makers. Hence, our data cover all non-market-maker option open interest." — [same](https://www.nber.org/papers/w11843.pdf)
- How they define the groups: "dealers as market makers and end users as proprietary traders and customers of brokers". Results are robust to classifying proprietary traders as dealers instead. — [NBER WP 11843](https://www.nber.org/papers/w11843.pdf)
- Findings:
  - End users are net long index options, especially out-of-the-money puts.
  - In single-stock options, end users are net short and those options are not expensive on average.
  - Net demand helps explain index option expensiveness and the skew. — [NBER WP 11843](https://www.nber.org/papers/w11843.pdf); [AQR listing](https://www.aqr.com/library/journal-articles/demandbased-option-pricing)
- Implication for the GEX convention: on this evidence, dealers were net short index puts in 1996–2001. Single-stock dealer positions had the opposite sign (end users net short), so a single "dealers short puts, long calls" rule is not supported for single stocks. — [NBER WP 11843](https://www.nber.org/papers/w11843.pdf)

**Baltussen, Da, Lammers and Martens (2021), "Hedging demand and market intraday momentum", JFE 142:377–403**
- Finding: across more than 60 futures from 1974 to 2020, the last 30 minutes' return is predicted by the rest of the day's return, and the effect reverses over the following days. — [EUR repository](https://pure.eur.nl/en/publications/hedging-demand-and-market-intraday-momentum/); [paper PDF](https://www3.nd.edu/~zda/intramom.pdf)
- Gamma measure (MODELED). The authors assume:
  - "(i) all traded options are facilitated by delta-hedgers, (ii) call options are sold by investors, and bought by option market makers, (iii) put options are bought by investors and sold by option market makers, and (iv) option market makers hedge precisely their option deltas."
  - Net gamma exposure (NGE) is computed from "all the open interest in S&P 500 index options using OptionMetrics data". — [paper PDF, p. 388](https://www3.nd.edu/~zda/intramom.pdf)
- Data: OptionMetrics for 1996–2017, extended to May 2020 with SqueezeMetrics data. The authors "verified the computations of SqueezeMetrics using OptionMetrics data over the 2002 to 2017 period, yielding virtually identical results". — [paper PDF, fn. 7](https://www3.nd.edu/~zda/intramom.pdf)
- The authors' own caveats:
  - "we assume option market makers are short all puts and long all calls. We do not have data on, for example, OTC option positions and precise end-user option positions."
  - The proxy "misses many long puts and short calls typically done OTC by institutional investors."
  - NGE "is on average positive for most days": 2,930 negative days and 3,158 positive days from 1996 to May 2020. — [paper PDF, fn. 8](https://www3.nd.edu/~zda/intramom.pdf)
- Result: intraday momentum is "much more pronounced on negative NGE days"; on positive NGE days there is "no significant intraday momentum". This is a conditional association with a modeled proxy, not an observed dealer position. — [paper PDF](https://www3.nd.edu/~zda/intramom.pdf)
- They cite an industry estimate attributed to JPMorgan that "short puts are by far the most dominant positions of option market makers". The underlying JPM note is not reproduced. — [paper PDF](https://www3.nd.edu/~zda/intramom.pdf)

**Barbon and Buraschi, "Gamma Fragility" (working paper, last revised 2021-03-19)**
- Findings:
  - Large aggregate dealer gamma imbalances are linked to intraday momentum (negative imbalance × illiquidity) and to reversal (positive imbalance × illiquidity).
  - The effect is stronger in the least liquid underlyings.
  - Imbalance is related to the frequency and magnitude of flash crashes.
  - The authors compute "a proxy of stock-level gamma imbalance" from "a large panel of equity options". — [abarbon.com](https://abarbon.com/papers/gamma-fragility); [Univ. St. Gallen record](https://www.alexandria.unisg.ch/261487)
- Status: listed as a working paper with no journal named on the author's page. — [abarbon.com](https://abarbon.com/papers/gamma-fragility)

**SqueezeMetrics, "Gamma Exposure: Quantifying Hedging Pressure" (Dec 2017)**
- Secondary sources describe it as using the heuristic "dealers long calls, short puts": calls get +1 and puts −1 on open-interest-weighted gamma. — [LuxAlgo concept page](https://www.luxalgo.com/library/concept/gamma-exposure.md); [SpotGamma GEX explainer](https://spotgamma.com/gamma-exposure-gex/)
- The primary PDF was not retrieved (see Gaps).

**0DTE academic work**
- Dim, Eraker and Vilkov (2024), "0DTEs: Trading, Gamma Risk and Volatility Propagation" (SSRN 4692190): high 0DTE open-interest gamma does not propagate past volatility, and 0DTE volume shocks do not amplify recent index returns. Seen through secondary summaries and the abstract only. — [Harbourfront Quant summary](https://harbourfrontquant.substack.com/p/the-rise-of-0dte-options-cause-for); [Harbourfront Quant](https://harbourfrontquant.substack.com/p/impact-of-zero-dte-options-on-the)
- A Princeton senior thesis (student work, not peer-reviewed) finds that the canonical gamma-hedging feedback channel adds no meaningful predictive power for intraday variance. — [Princeton thesis record](https://theses-dissertations.princeton.edu/entities/publication/61115cd1-cb09-4a8b-9230-ff488fc2a386)

### Inferences
- Two families of evidence:
  - OBSERVED-position studies (NPP 2005, PPW/NPPW, GPP 2009) establish that dealer hedging can affect underlying prices: volatility and pinning in single stocks, pricing pressure in index options. They used daily, end-of-day, exchange-supplied, non-public positions.
  - MODELED-sign studies (Baltussen et al., likely Barbon-Buraschi, SqueezeMetrics) show that a sign-convention proxy correlates with intraday momentum or reversal. Because the proxy is not validated against actual dealer positions in those papers, the association could partly reflect what the proxy also captures: put/call open-interest mix, moneyness drift, the level of the index.
- Baltussen et al.'s own footnote 8 shows how the convention mechanically flips sign with market drift. That is a property of the model, not a measured change in dealer books.

### Gaps
- **Title of the RFS 2021 paper.** The brief names it "Does option trading have mechanical effects on underlying stock prices?" The pages fetched confirm only the citation (RFS 34(4):1952–1986) and the 2006 working-paper title "Does Option Trading Have a Pervasive Impact on Underlying Stock Prices?". The published title and whether it adds ISE open/close data could not be verified from the published text. The working paper's data are CBOE only, 1990–2001.
- **Anderegg et al. / Egebjerg.** No source found. Nothing is stated about them.
- **Barbon-Buraschi's sign construction.** The PDF was not accessed, so whether the proxy uses OI with a convention, signed volume, or participant data is unverified.
- **SqueezeMetrics.** The primary white paper was not retrieved; its sign convention is reported here only via secondary sources.
- **Adams, Fontaine and Ornthanalai, and other 0DTE papers using open-close data.** Searched; nothing retrieved.

---

## 2. Open interest: when it is published and what it does and does not reveal

### Takeaway
Open interest is computed once a day by the OCC from the day's cleared opening and closing transactions, plus exercises and assignments. It is available the next morning and is not updated intraday. Public OI is a single number per series: it carries no side (who is long or short), no participant type, and no information about changes during the current session.

### Cited Findings
- **How OI is computed and when it appears:**
  - The OCC consolidates the exchanges' trade reports, which flag opening vs closing, and adjusts for exercises and assignments. OI rises when "to open" exceeds "to close", and falls otherwise.
  - OI "is calculated once a day by the OCC after the close of the trading day, and made available at the start of the next trading day"; it "is not updated intraday". — [Options Industry Council: Open interest, why it matters](https://www.optionseducation.org/news/open-interest-why-it-matters); [Options Playbook](https://optionsplaybook.com/options-introduction/open-interest); [IBKR Campus](https://www.interactivebrokers.com/campus/podcasts/ibkr-podcasts/what-is-option-open-interest-and-how-to-analyze/)
- **Distribution lag differs by channel (practitioner forum, low-authority source):**
  - OI is shown on the OCC site the following morning, but "not distributed industry-wide until the next business day morning". Some vendors therefore show a two-day lag, and the poster advises checking the OI date field. — [Alpaca forum](https://forum.alpaca.markets/t/old-option-open-interest-dates/18346)
- **No side or participant in public OI:**
  - Public data do not identify the participant on each side, so the GEX sign is "an assumption". — [SpotGamma](https://spotgamma.com/gamma-exposure-gex/)
  - FlashAlpha lists the same limitation, noting that some OI is inter-dealer or institutional hedging. — [FlashAlpha Q&A](https://flashalpha.com/articles/options-flow-questions-answered-dealer-positioning-qa)
- **The non-public counterpart exists:**
  - The OCC assigns an origin code (customer / firm / market maker) to each side of every transaction. CBOE has supplied researchers with OI split by those codes into purchased and written. — [PPW WP 2006](https://ou.edu/dam/price/Finance/CFS/paper/pdf/pearsonPoteshmanWhite.pdf); [GPP, NBER WP 11843](https://www.nber.org/papers/w11843.pdf)

### Inferences
- An intraday "dealer gamma" built on OI starts from a figure that reflects positions as of the prior close (or earlier, depending on the vendor's distribution date).
- For 0DTE contracts listed that morning, prior-day OI is zero or describes a different contract set. A same-day expiry's positioning is therefore wholly invisible in OI during its only trading session.

### Gaps
- I did not retrieve an OCC primary document (e.g. OCC's own OI file specification or publication time). Timing is sourced to the Options Industry Council (OCC-affiliated) and practitioner sources.

---

## 3. Trade classification (Lee-Ready, quote rule, tick rule) in options: accuracy and limits

### Takeaway
On CBOE data with known trade direction, equity-style classification rules sign roughly 59–83% of classifiable option trades correctly. Accuracy is worst for trades outside or reversed relative to the quote, and for complex or large index trades. No rule can tell from the tape whether a trade opened or closed a position, or whether a market maker was a party.

### Cited Findings
- **Savickas and Wilson (2003), "On Inferring the Direction of Option Trades", JFQA 38(4):881–902:**
  - On a CBOE dataset that records trade direction, correct classification was about 83% (quote rule), 80% (Lee-Ready), 77% (Ellis-Michaely-O'Hara) and 59% (tick rule).
  - Each rate is on a different subsample, because each rule leaves some trades unclassifiable.
  - Outside-quote and reversed-quote trades are badly misclassified by all four rules.
  - Removing complex index trades not routed through the Retail Automated Execution System raised the quote rule above 87%. — [IDEAS/RePEc abstract](https://ideas.repec.org/a/cup/jfinqa/v38y2003i04p881-902_00.html); [Cambridge/JFQA](https://resolve.cambridge.org/core/journals/journal-of-financial-and-quantitative-analysis/article/on-inferring-the-direction-of-option-trades/FDA4541B57F78B2C8DCE129AFC25AAF0); [ResearchGate](https://www.researchgate.net/publication/227406378_On_Inferring_the_Direction_of_Option_Trades)
- **How Lee-Ready works:** it applies the quote test, then the tick test to midpoint trades. Option data usually do not record the initiator, so researchers borrow equity rules. — [ResearchGate (Savickas & Wilson)](https://www.researchgate.net/publication/227406378_On_Inferring_the_Direction_of_Option_Trades)
- **Tick tests in thinly traded options:**
  - For index LEAPS, tick tests are too infrequent to be accurate, so midpoint trades are discarded. — [MSU dissertation](https://d.lib.msu.edu/etd/28610/FULL_TEXT/view)
- **Electronic execution limits outside visibility:**
  - Cboe states that 98% of SPX 0DTE volume trades electronically, which limits outside visibility into the buy/sell balance. — [Cboe, Much Ado About 0DTEs (2023)](https://www.cboe.com/insights/posts/volatility-insights-evaluating-the-market-impact-of-spx-0-dte-options)
- **Multi-leg trades:**
  - Option trades' effect on the underlying concentrates in single-leg and limit-order-book trades. This implies multi-leg and complex prints behave differently. — [AEA 2026 program, Yunjiang Dong](https://benny.aeaweb.org/conference/2026/program/paper/27z3hKsB) (conference paper; via search summary)
  - Cboe reports "over 95% of all 0DTE trades are done in a limited risk format" (spreads and the like). In a multi-leg structure, the aggressor side of one leg says little about the net gamma of the package. — [Cboe, 0DTEs Decoded (2025)](https://www.cboe.com/insights/posts/0-dt-es-decoded-positioning-trends-and-market-impact)

### Inferences
- Even at the best-case ~80–83%, a signed-volume estimate of dealer flow carries a large error in aggregate. The errors are not random: they concentrate in large, complex, crossed or outside-quote prints, which are also the economically biggest trades.
- "Buyer-initiated" is not the same as "the customer bought and a dealer sold". Aggressor and counterparty type are separate facts. A customer can lift another customer's resting order, and market makers can take liquidity.

### Gaps
- **Grauer, Schuster and Uhrig-Homburg ("Option Trade Classification").** Three searches did not retrieve the paper, so its accuracy figures and proposed rules are not reported here. My recollection is that it evaluates classic rules on ISE/CBOE open-close data and proposes trade-size and depth rules. That recollection is unverified and must not be cited.
- **Easley-O'Hara(-Srinivas) option work** on signed volume and informed trading was not retrieved in this pass.

---

## 4. Why volume cannot simply be added to OI, what data would be needed, and which vendors sell it

### Takeaway
Current dealer positioning needs, for every trade, the counterparty type (customer / pro customer / broker-dealer / firm / market maker) and the open/close flag. The public tape carries neither. Prior-day OI plus signed volume therefore cannot give today's dealer book. Exchange-sold open-close data come closest, and they are:
- per exchange;
- delayed (intraday at best, 10-minute updates at Cboe);
- costly.

Even Cboe's own SPX analysis is limited to its exchange, the expiries it studies, and the hedges it can see.

### Cited Findings
- **Opening and closing trades move OI in opposite directions; the tape does not say which a trade is.**
  - A buy-to-open plus sell-to-open adds a contract to OI; closing trades remove one. The OCC nets these overnight. — [Options Industry Council](https://www.optionseducation.org/news/open-interest-why-it-matters); [Options Playbook](https://optionsplaybook.com/options-introduction/open-interest)
- **Gross volume vastly overstates net dealer change. Cboe's observed example (SPX 4440 put, Aug 15, 2023):**
  - more than 100k contracts traded, "52k buy vs. 55k sell";
  - market makers were left short only about 3k contracts, about 3% of gross volume. — [Cboe, Much Ado About 0DTEs](https://www.cboe.com/insights/posts/volatility-insights-evaluating-the-market-impact-of-spx-0-dte-options)
- **What Cboe can see that outsiders cannot:**
  - Cboe sees "for every transaction whether it's customer or market maker, buy or sell, opening or closing".
  - It tracks the market maker "net position (long minus short) at each strike" in 30-minute increments.
  - It states that outside estimates "are just estimates based on assumptions". — [Cboe 2023](https://www.cboe.com/insights/posts/volatility-insights-evaluating-the-market-impact-of-spx-0-dte-options)
- **Limits Cboe itself states:**
  - The analysis covers SPX 0DTE only.
  - Market makers may hold offsetting positions in other expiries, E-mini options or SPY 0DTE.
  - They may hedge with other options, which the analysis does not capture. — [Cboe 2023](https://www.cboe.com/insights/posts/volatility-insights-evaluating-the-market-impact-of-spx-0-dte-options)
- **Cboe Open-Close (DataShop):**
  - It classifies each trade by participant type (customer, professional customer, broker-dealer, market maker), action (buy/sell) and position (open/close), with customer activity split by contract size.
  - The DataShop page lists BZX, C1, C2 and EDGX. SEC filings describe each product as covering that exchange's "proprietary … trade data" only.
  - The end-of-day version is "a historical data product and not a real-time data feed"; the intraday version updates every 10 minutes.
  - A 2024 SEC filing lists $2,000 a month for the intraday subscription and $1,000 per request per month for ad-hoc history. — [Cboe DataShop](https://datashop.cboe.com/open-close-cboe-c2-exchange); [SEC filing 34-99326 (2024)](https://www.sec.gov/files/rules/sro/cboe/2024/34-99326.pdf); [SEC 34-94914](https://www.sec.gov/files/rules/sro/cboeedgx/2022/34-94914.pdf); [Federal Register 2024-00848](https://public-inspection.federalregister.gov/2024-00848.pdf)
- **Nasdaq ISE Open/Close Trade Profile:**
  - Covers opening and closing trade data of ISE-listed options for customers and firms, in End of Day and Intraday versions.
  - Origin codes: Customer, Professional Customer (more than 390 orders a day over a month), Firm, Market Maker.
  - A 2026 filing, SR-ISE-2026-17, would rename the product "ISE Trade Outline" and include Market Makers as an origin type. Its approval status was not found. — [GEMX filing 34-81632](https://www.sec.gov/files/rules/sro/gemx/2017/34-81632.pdf); [Federal Register 2017-10590](https://www.govinfo.gov/content/pkg/FR-2017-05-24/pdf/2017-10590.pdf); [SR-ISE-2026-17](https://listingcenter.nasdaq.com/assets/rulebook/ise/filings/SR-ISE-2026-17.pdf); [Federal Register 2026-08110](https://public-inspection.federalregister.gov/2026-08110.pdf)
- **Academic precedent for the identity method:**
  - With origin-coded OI for customers and firms, market-maker OI follows exactly from "the sum … must be zero". This is an identity on observed clearing data, not an assumption. — [PPW WP 2006](https://ou.edu/dam/price/Finance/CFS/paper/pdf/pearsonPoteshmanWhite.pdf)

### Inferences
Why "prior OI + today's volume" fails:
1. **Opening vs closing ambiguity.** A closing trade reduces a position and OI; an opening trade adds one. Volume alone cannot say which.
2. **Customer-to-customer and dealer-to-dealer trades.** These change no dealer–customer net, yet they appear on the tape.
3. **Gross vs net.** As in the 52k/55k example, both sides of a trade print as one volume number, so the net dealer change can be a few percent of volume.
4. **Classification error.** Even the side (aggressor) is wrong in roughly 17–41% of classifiable trades, depending on the rule (section 3).
5. **Exercise and assignment and cross-exchange activity.** OCC nets these overnight; no single exchange's data capture them.

The minimum data for an observed intraday dealer book:
- origin-coded, open/close-flagged trades from every exchange listing the class;
- plus the prior day's origin-coded OI;
- plus knowledge of off-exchange and cross-product hedges.

That last item is not available to anyone outside the dealer. Exchange open-close products cover only their own venue; for a single-listed product like SPX, Cboe's coverage is complete for that product.

### Gaps
- No vendor was found that sells consolidated, all-exchange, origin-coded intraday positions for multi-listed products. Individual exchanges sell their own (Cboe, ISE).
- Whether the OCC sells participant-type OI publicly could not be verified.
- The ISE Intraday update frequency is not stated in the sources reached.

---

## 5. How practitioners present estimates honestly, and critiques of GEX (including the 0DTE debate)

### Takeaway
The most-cited counter-evidence to "dealer gamma drives 0DTE intraday moves" comes from the one party that observes SPX positions directly. Cboe finds market-maker net 0DTE gamma small and two-sided: a typical 0.04–0.17% of S&P futures liquidity in 2023, and "at best" 0.2% in 2025. Cboe has a commercial interest in this finding, and its view does not cover cross-product hedging. Practitioners such as SpotGamma and FlashAlpha state that the sign of GEX is an assumption, yet continue to present dealer hedging as a strong intraday force. Academic tests using OI-based 0DTE gamma (Dim, Eraker and Vilkov) find no destabilising effect. Overall, the effect is established for daily observed positions (single stocks, pinning) and contested for intraday index 0DTE.

### Cited Findings
- **Cboe 2023 (Mandy Xu, Sept 8, 2023), OBSERVED by the exchange:**
  - Typical market-maker net 0DTE gamma ranged from $170mm to $670mm through the day, 0.04–0.17% of about $400bn daily S&P futures liquidity.
  - At 3:30pm the median was +$173mm, with an interquartile range of −$1.1bn to +$2.4bn.
  - The extremes were −$5bn to +$7.7bn, 1.3–1.9% of futures notional.
  - On Aug 15, 2023, market makers were about $2bn long gamma at 3pm and −$500mm at 3:30pm.
  - Flow was "remarkably balanced between buy vs. sell". — [Cboe](https://www.cboe.com/insights/posts/volatility-insights-evaluating-the-market-impact-of-spx-0-dte-options)
- **Cboe 2025 (Mandy Xu, May 2, 2025):**
  - "net market maker gamma hedging remains de minimis, representing at best, just 0.2% of the SPX daily liquidity".
  - "customer activity continues to be extremely balanced in 0DTE options".
  - SPX 0DTE volume is nearly 2M contracts a day; over 95% of trades are limited-risk and 4% are naked short options.
  - The retail share is an estimate of about 50–60%.
  - The web page does not detail the methodology. — [Cboe, 0DTEs Decoded](https://www.cboe.com/insights/posts/0-dt-es-decoded-positioning-trends-and-market-impact)
- **Critique of the source:** it is in Cboe's interest to present 0DTEs as benign. — [OptionStrat](https://optionstrat.com/blog/0dte-options-straight-talk)
- **Practitioners' own caveats on GEX:**
  - SpotGamma: public data do not identify each side's participant, so the sign is "an assumption" that "can be useful". — [SpotGamma](https://spotgamma.com/gamma-exposure-gex/)
  - FlashAlpha lists the dealer-sign convention as a limitation. — [FlashAlpha](https://flashalpha.com/articles/options-flow-questions-answered-dealer-positioning-qa)
  - Baltussen et al. state that their convention ignores OTC and true end-user positions. — [JFE paper](https://www3.nd.edu/~zda/intramom.pdf)
- **The contrary practitioner view:**
  - SpotGamma (June 2026) argues that 0DTE flow forces aggressive same-day hedging, "one of the strongest intraday forces in the S&P 500". — [SpotGamma 0DTE explainer](https://spotgamma.com/0dte-options-explained/)
  - FlashAlpha: in negative gamma, dealers "become liquidity takers - amplifying the move". — [FlashAlpha](https://flashalpha.com/articles/0dte-gamma-exposure-pin-risk-intraday-options-analytics)
- **A neutral vendor summary:** "empirical studies and exchange data suggest that thus far, the net market impact of 0DTE flows has been limited". — [Numerix white paper (2026)](https://www.numerix.com/sites/default/files/file/2026-01/Numerix_White_Paper_Gamma_Hedging_of_ODTE_Options.pdf)
- **Academic test:** Dim, Eraker and Vilkov find no evidence that 0DTE OI gamma propagates volatility. — [summary](https://harbourfrontquant.substack.com/p/the-rise-of-0dte-options-cause-for)

### Inferences
An honest presentation of a public-data "dealer gamma" estimate should:
- label it as modeled;
- state the sign convention;
- state the OI date (the prior close or earlier);
- state that today's trades are not reflected, or are reflected only through a classification rule with known error;
- state what is excluded (OTC, other venues, other products, dealers' own option hedges);
- report walls and flips as properties of the assumed book, not of an observed one.

Single-figure "dealer gamma" levels for 0DTE intraday sit furthest from observation: same-day contracts have no prior OI and their flow is largely two-sided. On Cboe's own observed numbers, net market-maker 0DTE gamma can change sign within 30 minutes, as on Aug 15, 2023.

Status of the main claims:
- **Established**, on observed daily data: hedging affects underlying volatility and pinning in single stocks; end-user demand pressure prices index options.
- **Supported but resting on a modeled proxy:** intraday momentum is stronger when the convention-based NGE is negative (Baltussen et al.); the gamma-imbalance and flash-crash link (Barbon-Buraschi, working paper).
- **Contested:** that 0DTE dealer hedging is a major intraday driver of the index. Cboe's observed data and Dim-Eraker-Vilkov say no; vendors say yes.

### Gaps
- **JPMorgan and Goldman Sachs notes on 0DTE and gamma** (e.g. JPM's 2023 warnings about "Volmageddon 2.0") could not be verified from primary text in this pass, so they are not cited. The only JPM reference found is the second-hand claim in Baltussen et al. that short puts dominate market-maker books.
- **Cboe's full PDF methodology** (how net gamma and "liquidity" are computed) was not retrieved; the 2025 web page gives no method.
- **Independent replication** of Cboe's 0DTE market-maker gamma figures by a party with origin-coded data was not found.
