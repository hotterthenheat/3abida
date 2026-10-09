# Trader pain points and unmet wishes in flow, GEX and options-analytics tools, and the Slayer response to each

Research date: 2026-10-09.

Access note for the report writer: this session's network blocked direct reads of reddit.com, x.com, trustpilot.com, sec.gov, the Unusual Whales Substack, and most review blogs. Search returned snippets of those pages but the full text could not be read. Evidence from r/options, r/thetagang, r/Daytrading, r/wallstreetbets, r/algotrading, X and Elite Trader therefore comes only through secondary pages, and verbatim Reddit/X quotes could not be collected (see Gaps). Trustpilot material comes from search snippets of the Trustpilot pages. Facts about Slayer come from reading the local repo (/home/user/3abida/src), cited by file path.

---

## 1. What do traders dislike about Unusual Whales, Cheddar Flow, SpotGamma, FlowAlgo, BlackBoxStocks, MenthorQ, GEXBot and similar tools?

### Takeaway
Across reviews, the same complaints recur:
- the flow feed is loud, and it does not say what a print means;
- a print cannot reveal opening vs closing, or a hedge vs a bet;
- levels go stale or hit by chance;
- dark-pool data is delayed;
- the cost is high, with paid add-ons;
- the UIs feel dense or overwhelming.

The most damaging complaint is about interpretation: users receive data without reliable meaning, and beginners misread it. Complaints about raw latency are fewer than marketing implies, but they exist (late alerts, delayed dark pool, delayed free tiers, day-old levels).

### Cited Findings
**Noise, and data without meaning (Unusual Whales and flow in general)**
- Unusual Whales reviewers "frequently complain that the platform provides a massive amount of information but does not reliably tell users what to trade or when… the feed can feel noisy rather than predictive" — [Traders Agency review](https://tradersagency.com/blog/unusual-whales-review) (an SEO/affiliate-style page; treat as a paraphrase of user sentiment).
- The same review says "beginners may easily misinterpret the data, chasing misleading flow and making poor trading decisions" — [Traders Agency](https://tradersagency.com/blog/unusual-whales-review).
- A 2026 review describes UW as "a data and analytics layer, not a signal service — there are no automated recommendations, no scoring of which flow is actionable". It calls the free tier a "product preview" and says academic evidence on unusual-options-activity returns is mixed: the edge, if any, is "modest and requires skillful interpretation" — [DayTradingToolkit, UW Review 2026](https://daytradingtoolkit.com/reviews/unusual-whales-review) (affiliate-style).
- Other reviewers call UW's toolset "detailed yet complex… may feel overwhelming for users who prefer a simpler interface". Others call it clean, rate ease of use 7/10, and say it "could benefit from more color-coded highlighting" — [DayTradeReview](https://daytradereview.com/unusual-whales-review/); [PurePowerPicks 2026](https://purepowerpicks.com/unusual-whales-review/); [QuantVPS](https://www.quantvps.com/blog/cheddarflow-review). The sources are mixed.

**Reliability and latency**
- On an aggregator, UW scores 3.0 from 25 reviews. Two January 2026 reviews cite freezing, late alerts, failed logins and hanging pages — [Worthepenny UW reviews](https://unusualwhales.worthepenny.com/). The aggregator is low-quality, and it lists a self-reported 4.8/247 rating that conflicts with the 3.0.
- FlowAlgo's equity block/dark-pool prints are "delayed up to 20 minutes" per its own site. FlowAlgo costs about $99–149/month, and the review calls it raw data that needs interpretation — [TraderHQ FlowAlgo review](https://traderhq.com/flowalgo-review-best-options-flow-service/).
- UW's free flow is delayed. Flow-tool plans run from about $39/month to about $200/month, with dark pool often on higher tiers — [TradeEcho, Best Options Flow Tools 2026](https://tradeecho.com/best-options-flow-tools).

**Opening vs closing, buy vs sell, and hedges vs bets**
- UW's own Substack shows the ambiguity. Heavy bid-side volume in a TSLA put looked like an exit. Only the next day's open interest showed ask-side fills the day before, making the pair "almost certainly" an entry and an exit. Confirmation therefore waits for the OI update — [Unusual Whales Substack, "Understanding options flow during chaos"](https://unusualwhales.substack.com/p/understanding-options-flow-during) (read via search snippet).
- One flow app's own listing says privately negotiated block trades "don't reveal the trader's intent". Its "unusual" flag fires when volume exceeds open interest — [Flow Greeks, App Store listing](https://apps.apple.com/us/app/-/id6451004733).
- A vendor states plainly that a filter match "does not establish who owns a trade, whether it opened or closed, or where the market goes next" — [Realtime Options, Features](https://realtimeoption.com/features).
- "A large call purchase can reflect a directional bet, a hedge, or part of a multi-leg trade" — [TradeAlgo, Options alert services 2026](https://www.tradealgo.com/trading-guides/options/options-alert-services-which-ones-are-actually-worth-the-subscription-in-2026).
- TipRanks labels its own bullish/bearish tags on unusual activity as "only an indication, not a certainty" — [TipRanks](https://tipranks.com/news/labs/level-up-your-options-game-with-tipranks-unusual-options-activity-feature).
- The standard "unusual" test is volume over open interest — [Barchart](https://www.barchart.com/options/unusual-activity).

**Cherry-picked winners and the missing denominator**
- Flow services "surface a single hit and bury the rest"; the full P&L and hit record are never shown — [TradeIntelligent Substack, "Anyone else sick and tired of all the flow services?"](https://tradeintelligent.substack.com/p/anyone-else-sick-and-tired-of-all) (vendor-adjacent).
- Flagging many long-shot options will yield some big winners by luck, and "the unseen denominator is the real missing data" — [ClaudeQuantAlgo, "Unusual Options Activity: Signal or Noise?"](https://www.claudequantalgo.com/learn/unusual-options-activity/) (vendor blog).
- Some alert providers launch several alert styles, market the best performer and quietly shut down the rest — [TradeAlgo 2026](https://www.tradealgo.com/trading-guides/options/options-alert-services-which-ones-are-actually-worth-the-subscription-in-2026) (a competitor's claim).

**GEX tools: MenthorQ, SpotGamma, GEXBot**
- MenthorQ scores 3.4/5 from 68 reviews on Trustpilot — [Trustpilot, Menthor Q](https://www.trustpilot.com/review/menthorq.com).
  - A 1-star reviewer said the levels "did more damage to their trading than good". They "lined up well with the previous day's market but real-time levels were wrong on more than one occasion" (same page).
  - Another complained about add-on fees for real-time data and a high monthly cost (same page).
- A Danish MenthorQ reviewer argued two things (paraphrased). First, GEX is unreliable because it is computed from the options chain while spot and futures are far larger. Second, "with six levels, price will hit one of them by chance, so a hit doesn't prove the method works" — [Trustpilot DK, Menthor Q](https://dk.trustpilot.com/review/menthorq.com).
- A 2026 comparison says MenthorQ does not disclose its refresh cadence or how fresh its open interest is, "which makes intraday evaluation hard". It also lists SpotGamma Alpha at $299/month for the real-time tier — [TradeEcho, Best GEX Tools 2026](https://tradeecho.com/best-gex-tools) (read via search snippet).
- A Trustpilot commenter (surfaced by search on the MenthorQ/GEX review pages) contrasted the tools. SpotGamma suits longer holds, while GEXBot suits scalping because it updates in real time "rather than using day-old levels" — [Trustpilot, Menthor Q](https://www.trustpilot.com/review/menthorq.com) (attribution to this exact page is uncertain).
- GEXBot shows 4.8 from 22 reviews, praised for per-strike real-time data. These reviews sit on a reseller site and are unverifiable — [GroupBuyTrading](https://groupbuytrading.com/product/gexbot-state/) (low-quality source).

**BlackBoxStocks and Cheddar Flow**
- BlackBoxStocks Trustpilot reviews are mostly harsh: "heavily marketed, but severely underdelivers on performance"; analysts called "a group of gamblers"; one canceled because "their ui is terrible" — [Trustpilot, Blackboxstocks](https://www.trustpilot.com/review/blackboxstocks.com).
- Cheddar Flow scores 4.0 from 15 Trustpilot reviews. The main negative is a 2-star email-delivery dispute. Positives praise its UI and filtering — [Trustpilot UK, Cheddar Flow](https://uk.trustpilot.com/review/www.cheddarflow.com). One blog claims the review timing "reads like a review campaign" — [AIStockPickerApp](https://aistockpickerapp.com/reviews/cheddar-flow/deep-dive) (unverified, and from a competitor-style site).
- Sources disagree on whether Cheddar Flow has a native app: "CheddarFlow: no app" (2025) vs a "Good" mobile rating (2026) — [ImpliedOptions comparison, 2025-10-16](https://impliedoptions.com/blog/option-flow-platforms-comparison-2025-10-16); [OptionsTrading.org 2026](https://www.optionstrading.org/blog/cheddar-flow-review/).

**Billing and cancellation (Unusual Whales)**
- All UW plans auto-renew and must be cancelled 24 hours before renewal. Cancellation is "two clicks", but an app-store subscription must be cancelled through Apple or Google — [UW Terms](https://unusualwhales.com/terms); [UW Pricing](https://unusualwhales.com/pricing).

### Inferences
- How common each pain is, judged from the coverage found. This is a judgement, not a count.
  - **Very common:** flow is loud and unexplained, and hedges or legs are read as bets. Nearly every review and every vendor caveat raises it.
  - **Common:** open vs close and buy vs sell cannot be told apart; cost and add-on tiers.
  - **Moderate:** latency, stale levels and late alerts; cluttered UI.
  - **Less evidenced but sharp:** GEX levels "hit by chance", undisclosed refresh cadence, mobile gaps.
- Interpretation is the market gap, not raw data. Most vendors sell the same OPRA tape, and the reviews say the problem is meaning and trust.
- That gap is also a regulatory trap (see Q4): the tempting fix is to say "buy this", which Slayer must not do.

### Gaps
- No verbatim Reddit (r/options, r/thetagang, r/Daytrading, r/wallstreetbets, r/algotrading), X or Elite Trader quotes. Those domains were blocked to this session's search and fetch tools.
- No direct App Store or Google Play review text for UW, Cheddar Flow or GEXBot (their store pages did not surface).
- No YouTube comment threads were reachable.
- No independent, quantified measure exists of how often flagged flow is a hedge, nor of any vendor's level accuracy. The sources say this explicitly.
- No Volland-specific user complaints were found (the search returned unrelated results).

---

## 2. What do traders wish existed?

### Takeaway
The wishes mirror the pains:
- context on why a print matters, and what else it could be;
- follow-through of past flow, with the losers included;
- an honest record of how levels behaved;
- a plain-language explanation of dealer positioning, with its assumption shown;
- flow tied to the levels it builds;
- alerts that say why they fired and do not repeat.

Vendors are moving toward "intent", "opening bias" and hedging-impact layers, which shows where demand is.

### Cited Findings
- Vendors now sell explicit "intent" and "opening bias" scoring of unusual activity, which suggests demand for open/close and intent context — [FlashAlpha, Flow Signals API](https://flashalpha.com/articles/flow-signals-api-scoring-unusual-options-activity).
- SpotGamma markets HIRO as the step past flow. Flow tools show what traded; HIRO estimates "what dealers will be forced to do in response" by summing each trade's delta-notional hedge, paired with Call/Put/Hedge Wall levels and a Tape of the trades behind it — [SpotGamma, HIRO Indicator](https://spotgamma.com/hiro-indicator/); [HIRO User Guide (Oct 2025)](https://spotgamma.com/wp-content/uploads/2025/10/SpotGamma-HIRO-User-Guide-2.pdf). This is the "combine flow with levels" wish, productised.
- Several guides argue that the right baseline for "unusual" is "the contract's own history… the deviation from the norm", not a raw vol/OI threshold. They warn that vendors publish "scored" feeds without saying what the number means, so thresholds and false-positive rates cannot be checked — [dxFeed](https://dxfeed.com/what-is-unusual-options-trading/); [Intrinio](https://intrinio.com/blog/unusual-options-activity-what-institutional-investors-should-watch) (from search snippets; which of the two said which is not certain).
- Analysts ask whether an unusual print is a single leg or part of a spread or collar — [Nasdaq, Understanding Unusual Options Activity](https://www.nasdaq.com/articles/understanding-unusual-options-activity).
- The denominator (all flagged prints, not just the winners) is named as the missing data — [ClaudeQuantAlgo](https://www.claudequantalgo.com/learn/unusual-options-activity/).
- For GEX, users want refresh cadence and OI freshness disclosed — [TradeEcho Best GEX Tools](https://tradeecho.com/best-gex-tools). They also want proof that a level that "held" did better than chance — [Trustpilot DK, Menthor Q](https://dk.trustpilot.com/review/menthorq.com).
- Exchange-sourced open/close and customer/market-maker breakdowns exist, which would directly answer the opening-vs-closing wish. Cboe's Open-Close data splits volume by origin (customer, pro customer, broker-dealer, market maker), side (buy/sell) and opening/closing.
  - It comes as 10-minute (and 1-minute) intraday snapshots delivered about 5 minutes after each interval, or end-of-day.
  - Each exchange's file covers only that exchange (BZX, C1, C2, EDGX), so the data is partial.
  - It is licensed for internal use only, and redistributing derived data costs extra — [Cboe DataShop, Open-Close](https://datashop.cboe.com/open-close-cboe-c2-exchange).
  - A secondary write-up of a 2023 C2 filing lists $400/month (EOD), $500 (10-minute) and $1,500 (1-minute) per exchange. These figures are dated — [summary of 2023 C2 fee filing](https://worktraining.com/knowledge/cboe-c2-exchange-introduces-free-trial-for-historical-open-close-data-in-fee-schedule-amendment).

### Inferences
- The wishes with the most leverage for Slayer, because they suit a "read, never an instruction" product:
  - **"What else could this be?"** Alternative readings of a print, each with the evidence for and against it.
  - **"What happened next?"** Follow-through for every print that cleared a filter, losers included, at fixed horizons.
  - **"How did the levels do vs chance?"** A multi-session record with a null baseline.
  - **"What is this number standing on?"** Its assumption, freshness and source.
  - **"Why did this alert fire, and is it new?"** An alert that carries its reason and does not repeat itself.
- None of these needs Slayer to say what to trade. Each answers the "data without meaning" complaint with evidence rather than a call.

### Gaps
- No survey data quantifies these wishes. They are inferred from complaint patterns and from vendor feature direction.
- Whether UW currently ships its own hedge/roll detection or open/close estimate was not verified (its docs could not be read).

---

## 3. What do experienced traders, quants and academics say about the limits of GEX and flow? How can a UI be honest about uncertainty?

### Takeaway
GEX rests on an unverifiable sign assumption: customers are assumed net short calls and long puts, so dealers hold the opposite side. It also assumes continuous hedging and uses lagged open interest. Vendors disagree for exactly these reasons, and the exchange that can see positions says outside estimates have ranged from "record short" to "long $50bn".

On flow, the academic predictive evidence (Pan & Poteshman) relies on open-buy information that public tapes do not carry, and finds no informed trading in index options. Recent 0DTE research disputes the "dealer gamma amplifies moves" story.

An honest UI should therefore:
- show the assumption;
- show how the read changes if the assumption is wrong;
- date-stamp its inputs;
- say what a reading does not tell you.

It can do all of this without the word "simulated" and without a call.

### Cited Findings
**The GEX sign assumption and hedging model**
- Public chain data gives OI and greeks but not whether dealers are long or short each contract. Exact dealer inventory "cannot be recovered" from public OI, so every GEX figure rests on a sign convention — [SpotGamma, What is GEX](https://spotgamma.com/what-is-gex-gamma-exposure/); [TradeEcho GEX methodology](https://tradeecho.com/methodology/gamma-exposure); [Alphanume](https://www.alphanume.com/blog/what-is-dealer-gamma-exposure-gex).
- The convention breaks when customer flow inverts, for example heavy call buying in a squeeze. Vendors disagree because of different sign assumptions, expiries included and IV fits. Hedging is assumed "continuous and complete". GEX is described as structure and volatility sensitivity, "not the market's next direction" — [SpotGamma GEX playbook](https://spotgamma.com/gex/); [Moomoo Learn](https://www.moomoo.com/us/learn/detail-gamma-exposure-gex-understanding-dealer-hedging-flows-and-key-levels-107906-260473079) (a search-result synthesis of several pages).
- The original SqueezeMetrics GEX white paper:
  - assumes investors buy puts and market makers sell them;
  - assumes market makers hedge "precisely to option delta" while noting that in practice they hedge in bands;
  - a third-party summary calls this the "naive dealer assumption" and notes that some providers infer dealer direction from trade data instead.
  - Sources: [SqueezeMetrics GEX white paper (mirror)](https://slopeofhope.com/wp-content/uploads/2020/11/GEX-white_paper.pdf) (an older paper, c. 2017; mirror posted 2020); [LuxAlgo GEX concept](https://www.luxalgo.com/library/concept/gamma-exposure/).
- A December 2025 arXiv paper notes that practitioner GEX assumes customers are net short calls and net long puts, "an assumption that generally holds for index options" — [arXiv 2512.17923](https://arxiv.org/pdf/2512.17923).
- A TradingView GEX script's own description calls treating all open contracts as sold by market makers "a simplification that may not hold" — [TradingView, Gamma Exposure script](https://de.tradingview.com/script/HnTCmgMC-Gamma-Exposure).
- Cboe can see customer vs market maker, buy vs sell and open vs close for each SPX trade. It says flow is "remarkably balanced". It says outside estimates of dealer SPX gamma have ranged from "record short" to long $50bn and "are just estimates based on assumptions" — [Cboe, Volatility Insights: Evaluating the Market Impact of SPX 0DTE Options](https://www.cboe.com/insights/posts/volatility-insights-evaluating-the-market-impact-of-spx-0-dte-options) (2023, older).

**0DTE research**
- Dim, Eraker & Vilkov ("0DTEs: Trading, Gamma Risk and Volatility Propagation", May 2024) find that intraday 0DTE volume shocks do not amplify recent index returns, and that the results may be consistent with 0DTE dampening volatility — [Western Finance Association portal](https://westernfinance-portal.org/viewpaper?n=950096).
- A Cboe-hosted study estimates the maximum impact of market-maker gamma on index volatility and finds the effects conditional and often small relative to normal volatility changes — [Cboe research PDF](https://cdn.cboe.com/resources/education/research_publications/gammasqueezes.pdf).

**Order-flow informativeness**
- Pan & Poteshman (RFS 2006; NBER w10925) build put-call ratios from volume that buyers initiated to OPEN positions. Low-ratio stocks beat high-ratio stocks by more than 40 bp next day and more than 1% over the next week.
  - The predictability comes from the non-publicly observable component.
  - Full-service-broker customers are the most informative, while firm proprietary trading is not.
  - There is no evidence of informed trading in index options.
  - The sample runs 1990–2001 (older).
  - Source: [NBER w10925](https://www.nber.org/papers/w10925).

**Hedges and spreads**
- "It's tricky to tell a hedge from a speculative play, since outside observers can't see a trader's stock position alongside the options" — [Nasdaq, Understanding Unusual Options Activity](https://www.nasdaq.com/articles/understanding-unusual-options-activity) (search snippet).

### Inferences
**What follows from the research**
- The public tape cannot say "opened" or "customer bought". Pan & Poteshman's edge needed open/close and origin flags that OPRA does not carry. A flow product that shows "bullish" from tape side alone claims more than the evidence supports, and the honest unit is "evidence for / evidence against". The index-options null result matters especially for SPY/SPX flow, which is Slayer's default name.
- GEX "levels" should be presented as conditional zones under a stated assumption, with a sensitivity view. The flip level especially moves a lot if a large strike's sign is wrong.

**Patterns for being honest in the UI without saying "simulated" and without making a call**
1. **Assumption line.** A line under every dealer number in plain words: "Assumes customers sold the calls and bought the puts; dealers hold the other side." Slayer's terms already have the raw material (data/terms.ts "Model error", "Hedge-flow" text: "It assumes continuous hedging at the modelled dealer sign — real desks hedge in bands").
2. **Sign-flip sensitivity.** "If the 475 calls were bought, not sold, the call wall would sit at 480 and the flip at 468." A toggle or a ghost line on the ladder.
3. **Freshness stamps.** "Open interest as of last night's close" vs "today's volume, estimated". The time of the last quote behind a print's side. This answers the "day-old levels" and "undisclosed refresh cadence" complaints.
4. **Ranges, not points.** A flip shown as a band (for example 466–471) with the point inside. Wall strength shown with how much of it is today's volume vs settled OI.
5. **"What this does not tell you".** A short line per panel. "Does not tell you whether the print opened or closed until tomorrow's open interest." "Does not tell you direction; it tells you how hedging changes if price moves."
6. **Provenance tag on each figure.** Measured / derived / modelled. Slayer already defines this (data/terms.ts:164, "Provenance") but uses it only in components/compass/CampaignAnalysis.tsx.
7. **A null baseline next to any record of levels.** Compare against how often an arbitrary strike at the same distance would have "held".

### Gaps
- Cboe's May 2025 "0DTEs Decoded" figure (net market-maker gamma hedging ≈ 0.2% of daily SPX liquidity) was not verified against the primary. It appeared only via search summaries and secondary blogs.
- Neither was the claim that 0DTE reached about 63% of SPX volume in February 2026 verified.
- Chordia, Kurov, Muravyev & Subrahmanyam (index put order flow on ISE predicts weekly S&P returns) surfaced only in a search summary. The paper was not read, but it partly conflicts with Pan & Poteshman's index null result.
- Lipson, Tomio & Zhang (2023), on retail single-name options raising volatility via short-gamma market makers, was likewise seen only secondarily.
- SEC DERA's 2025 paper "Hope at a Reasonable Price: Customer Use of Limit Orders in the 0DTE Market" exists ([SEC](https://www.sec.gov/files/dera-hope-reasonable-prc-2503.pdf)) but could not be read.
- No peer-reviewed test of GEX levels' predictive power was found.

---

## 4. What regulatory and ethical framing applies to tools that show "signals", and how should Slayer word things to stay "a read, never an instruction"?

### Takeaway
In the US, Slayer stays outside investment-adviser regulation most safely if it behaves like a bona fide, impersonal publication. Under Lowe v. SEC (1985), that means:
- general and regular circulation;
- not tailored to a person;
- disinterested commentary, not touting;
- no execution on the user's behalf.

FINRA and SEC finfluencer actions show that the wording regulators object to is promissory, unbalanced and unsupervised. Slayer's copy should describe what happened and what a model assumes, in conditionals, with no imperatives. Several current strings in the repo break that rule (see Q5).

### Cited Findings
- **Lowe v. SEC.** The US Supreme Court (472 U.S. 181, 1985) held that newsletters fell within the Advisers Act exclusion for "the publisher of any bona fide newspaper, news magazine or business or financial publication of general and regular circulation". It reasoned that Congress targeted personalised, person-to-person advice, not impersonal publishing — [Lowe v. SEC (Chanrobles)](https://chanrobles.com/usa/us_supremecourt/472/181/); [Casemine commentary](https://www.casemine.com/commentary/us/exclusion-of-bona-fide-investment-publications-from-the-investment-advisers-act%3A-lowe-v.-sec/view).
- **Paid content.** Commentary argues the exclusion "weakens" once content becomes "paid, promotional, or performance-driven" — [Sedric, Influencer Compliance Guide 2026](https://www.sedric.ai/blog/influencer-compliance) (a vendor blog).
- **SEC IAC.** The SEC Investor Advisory Committee's November 2024 recommendation addresses finfluencers "who do not qualify for the publisher's exclusion" — [SEC IAC finfluencer recommendation, 2024-11-22](https://www.sec.gov/files/sec-iac-finfluencer-recommendation-11222024.pdf).
- **Weiss Research.** The SEC sanctioned a newsletter publisher (Weiss Research) as an unregistered investment adviser — [Cahill memo](https://www.cahill.com/publications/firm-memoranda/0000001/_res/id=Attachments/index=0/CGR%20Firm%20Memo%20-%20In%20the%20Matter%20of%20Weiss%20Research%20Financial%20Newsletter%20Publisher%20Sanctioned%20as%20an%20Unregistered%20Investment%20Adviser.pdf). From background knowledge, to be verified against the memo: the issue was an "auto-trading" arrangement that executed the newsletter's recommendations in subscribers' accounts.
- **FINRA enforcement.** FINRA found a firm's finfluencer posts "weren't fair and balanced and contained promissory language", with no supervision and no record-keeping. Robinhood was fined for failing to monitor influencer content — [AWISEE summary](https://awisee.com/blog/regulation-of-financial-influencers/); [Carlton Fields 2024](https://www.carltonfields.com/insights/expect-focus/2024/finra-and-sec-float-concerns-over-social-media-finfluencers); [FINRA Unscripted](https://www.finra.org/media-center/finra-unscripted/finfluencer-social-media-targeted-review).
- **FINRA Rule 2210.** A paid creator's post about a firm is the firm's own communication, to be reviewed, approved and retained — [AdClear](https://www.adclear.ai/blog/finfluencer-marketing-sec-finra-compliance).
- **FINRA report, December 2025.** FINRA's report on social-media-influenced investing warns such content "may contain inaccurate, misleading, harmful or intentionally false information" and discusses sentiment-analysis tools — [Free Writings & Perspectives, Dec 2025](https://www.freewritings.law/2025/12/finra-publishes-report-on-social-media%E2%80%91influenced-investing/).
- **Vendor practice.** Vendors already position themselves as "data, not a signal service" (UW, per [DayTradingToolkit](https://daytradingtoolkit.com/reviews/unusual-whales-review)) and label directional tags as "only an indication" ([TipRanks](https://tipranks.com/news/labs/level-up-your-options-game-with-tipranks-unusual-options-activity-feature)).

### Inferences
These are not legal advice; Slayer should get counsel before launch. FINRA rules bind broker-dealers, not Slayer directly, but they are the clearest public statement of what regulators find misleading.

**Product rules that keep Slayer on the publication side**
- **Impersonal.** The same read for every reader of a name. Compass "contracts that fit the levels" is fine as a filter. It becomes riskier if it is ever tuned to a user's account size, holdings or P&L ("for you").
- **No execution link.** Never wire a read to an order in a real account; Paper stays paper. This is the Weiss lesson.
- **No promissory or outcome language.** Do not show results of following reads as marketing (survivorship), and do not show "this flow ran 400%" screenshots.
- **Fair and balanced.** Every read that names a lean also names what argues against it.

**Wording rules: replace imperatives and certainties with what was observed, what the model assumes, and conditionals**
- "Market makers are heavily short this strike and must buy" → "Under the usual dealer assumption, dealers would be short gamma here; if price falls toward 470, their hedge is to buy."
- "Trade the break" / "Don't chase it" / "Scalp the pop and take profit fast" → delete. State what would change the read: "A close above 475 moves the call wall to 480."
- "Level becomes support" → "Price held this level 3 of 4 times today."
- "Bought" / "sold" on a print → "Filled at the ask" / "filled at the bid" (observed); "likely opened" (inferred) with its evidence.
- "Bullish" / "bearish" → "Leans call-buying" plus the confidence words.
- **Use the house's own banned-word list as a lint rule in code review:** grade, score, win rate, signal (as a trade call), guaranteed, confluence, market intelligence. Add should, must buy, take profit, entry and our. Slayer already avoids most of these in visible copy (see Q5 for exceptions).
- **One standing line in the footer or About, not on every panel:** "Slayer shows what the market did and what its models assume. It does not tell you what to trade." This is a disclosure of method, not a "simulated" disclaimer, so it fits the owner's rule.

### Gaps
- The full SEC IAC document, FINRA's December 2025 report and SEC enforcement on trading-signal software could not be read (sec.gov was blocked).
- No 2025–2026 change to the publisher exclusion was found.
- Non-US regimes (for example the UK FCA's finfluencer rules) were not researched.
- Whether the SEC Marketing Rule's limits on hypothetical performance could apply to a non-adviser tool's "levels held" record was not researched. It likely does not apply to a non-adviser, but this is unverified.

---

## 5. Which of these pains does Slayer already address, and which does it not? The pain → Slayer idea map

### Takeaway
Slayer already answers more of the interpretation complaints than most competitors:
- NBBO evidence for every print;
- a plain-words read of vol/OI ("new positioning" vs "likely closing");
- reconstructed multi-leg structures;
- "how the levels held today";
- a Footprints follow-through for prints the user marks;
- an OI-change page;
- a hedge-flow ladder that states its assumption;
- reading guides on each page.

The biggest open gaps:
- no follow-through or null baseline across ALL flagged prints and across sessions;
- no visible GEX sign assumption or sensitivity on the main surfaces;
- no data-freshness stamps;
- no flow alerts at all.

The other open problem is visible copy in Compass and Dark Pool that issues instructions and states inference as fact. Those strings break Slayer's own "a read, never an instruction" rule, and they are code, so they survive the switch to live data.

### Cited Findings (Slayer repo, read 2026-10-09)
**Already addressed**
- **NBBO evidence and side inference.**
  - Trace prints carry bid, ask, a 0–1 position in the spread and a BID/ASK/MID side, plus a day-level ask-side share (src/types/trace.ts:24–33, 95–107).
  - The print card draws where the fill sat between bid and ask ("the clearest aggressor tell") and words it as "paid the offer" / "hit the bid" / "traded at the mid" (src/components/trace/PrintDrilldown.tsx:128, 522–533).
  - It sets the fill against the contract's usual volume and typical sweep share ("…× its usual volume · swept N% vs N% typical", PrintDrilldown.tsx:102).
- **Open vs close, read from vol/OI in plain words.** "Volume is Nx the open interest, so this is new positioning rather than someone closing out" / "Open interest did not grow much, so some of this is likely closing existing risk" (PrintDrilldown.tsx:133–136). TraceGuide teaches it: "Volume over open interest above one and a half means positions were opened today" (src/components/trace/TraceGuide.tsx:221). It also has an OI-change view: "open interest is what stayed overnight, and this page ranks what was built and unwound" (TraceGuide.tsx:290).
- **Hedges and spreads vs bets.** Multi-Leg reconstructs the tape into spreads with their legs (TraceGuide.tsx:498; src/pages/trace/MultiLeg.tsx). Dark Pool's "Read" column (src/pages/trace/DarkPool.tsx:234) includes a "Hedge flow" read for prints on an options shelf (src/data/darkpool.ts).
- **Follow-through of a print the user marks.** Footprints: "What it has done since you marked it — the fill, the volume, the open interest and the lean, then against now" (TraceGuide.tsx:773; src/pages/trace/FlowTracker.tsx, Footprints.tsx).
- **Honest levels for today.** Pinpoint "How the levels held today" counts tests, holds and breaks per level, worded "held every test" / "broke N of M" / "untested" (src/components/gex/WallReportCard.tsx:181, 208), with a reading guide (src/components/gex/ReportGuide.tsx).
- **Assumptions stated in definitions.** The hedge-flow term says "It assumes continuous hedging at the modelled dealer sign — real desks hedge in bands" (src/data/terms.ts:126). A "Model error" term describes the textbook "open interest × a sign assumption, the one every vendor uses" (terms.ts:110). A "Provenance" term defines measured / derived / modelled (terms.ts:164).
- **Combining flow and levels.** Pinpoint Ahead turns scenarios into dealer-hedging sentences ("If vol …, dealers must buy about $X of stock to stay hedged…", src/data/ahead.ts:560–581). An "Attribution" term exists: "the prints that built the exposure at a strike today… one institution's single order or four hundred small ones" (terms.ts). No UI use of Attribution was found by grep.
- **Clutter and explanation.** Each room has a "How to read" guide (TraceGuide, ReportGuide, WeigherGuide), and pages lead with a sentence.
- **Mobile.** Phone layouts follow the 44 px finger rule and framed pages scroll on phones (per .claude/CLAUDE.md "Phones (2026-10-01 audit)").
- **Alerts.** Price alerts fire once and are re-armed by hand from the drawer (src/components/alerts/AlertsDrawer.tsx:243, 334; src/components/gex/alertStore.ts). This is not spam-prone, but it covers price only.

**Copy that breaks "a read, never an instruction"**
- **Compass's "why" text** is shown as `whyText` (src/data/compass.ts:92–110, 374):
  - "Market makers are heavily short this strike and must buy {t} to stay hedged, forming an automatic protective floor under our entry." This is an overclaim of dealer inventory, it is promissory ("automatic protective floor"), and it speaks in the first person about an entry.
  - "Scalp the pop and take profit fast before theta bleeds the premium." This is an instruction.
  - "Premium is mispriced relative to the projected move." This is a certainty claim.
- **Dark Pool reads** (src/data/darkpool.ts:155–215):
  - "Trade the break: direction follows whichever side absorbs."
  - "likely dealer/desk hedge, not a directional bet. Don't chase it."
  - "Size bought below market… institution building a position on weakness. Level becomes support."
  - "Rallies into the print price should struggle."
  - All of these are instructions or predictions. "Bought" and "sold" are asserted for prints whose side the read infers only from where they sit vs spot and the session's direction (classify(): vsSpotPct, sessionUp), not from an aggressor flag.
- **"Conviction" tiers.** Dark Pool's conviction is expressed as four words (strong/good/caution/poor) through a type named `Grade` (darkpool.ts:171; src/components/ui/GradeMeter.tsx). The visible words are fine. The internal name echoes a banned word, which is only a risk if it ever reaches a label.
- **Compass's internal verdict** is ENTER/EXIT/WATCH, shown to users as ACTIVE/WATCH/FADING (src/types/compass.ts:93–100). The user-facing words are states, not orders, which is good. But the trigger is `score >= 88 ? 'ENTER'…` (compass.ts:292), and the Tracker stores `scoreAtTrack` (src/types/tracker.ts). Keep "score" out of every label.

**Missing**
- **No freshness or as-of stamp on OI or GEX inputs** was found.
- **No visible sign-assumption line or sign-flip sensitivity** on Pinpoint or Terrain. "Model error" is defined in terms.ts, but no grep hit in a component or page uses it. Its text ("a desk holding the actualized reference can audit the whole category") implies an actual dealer-position source, which Slayer will not have unless it licenses Cboe Open-Close data.
- **No flow alerts.** No digest, cooldown or "why this fired".
- **"Levels held" is today-only, with no null baseline.**
- **No automatic follow-through across all prints that cleared a filter.** Footprints covers only user-marked prints.
- The 2026-10-09 triage (docs/ux-audit-2026-10-09/WHAT-REMAINS.md) also lists trust-damaging logic bugs that would feed the same "can't trust it" complaint:
  - P/C labelled premium but counting prints (TR-25);
  - every non-sweep print is a "block" (TR-26);
  - the tape sentence contradicting its totals (TR-27);
  - Net Flow net ≠ calls − puts (TR-38);
  - the Pinpoint Net GEX tooltip sign backwards (PP-3);
  - Pinpoint pages disagreeing on the call wall (480 vs 481) through different strike windows;
  - Compass computing "target hit" three ways (CO-1);
  - New York vs browser clocks (X2).

### Inferences — the pain → Slayer response map

Columns:
- **How common:** a judgement from Q1's evidence density.
- **Now / Live:** whether it can be built UI-only on the current stand-in data, or only means something with live keys (Polygon/Massive, Unusual Whales).
- **Effort:** S = days, M = 1–2 weeks, L = more. These are rough estimates.

| # | Pain (evidence) | How common | Slayer response | Room | Now / Live | Effort |
|---|---|---|---|---|---|---|
| 1 | Flow is loud and "doesn't tell you what it means"; beginners misread it ([Traders Agency](https://tradersagency.com/blog/unusual-whales-review); [DTT](https://daytradingtoolkit.com/reviews/unusual-whales-review)) | Very common | **"Could also be" line on every print card.** Two or three alternative readings (leg of a spread, hedge against stock, roll, closing), each with the evidence for and against from data Slayer has (Multi-Leg match, same-second stock block, OI next day). The page names no winner. | Trace (print card) | Now | M |
| 2 | Hedges and legs read as bets ([TradeAlgo](https://www.tradealgo.com/trading-guides/options/options-alert-services-which-ones-are-actually-worth-the-subscription-in-2026); [Nasdaq](https://www.nasdaq.com/articles/understanding-unusual-options-activity)) | Very common | **Tags for "paired" prints.** "With stock" (delta-sized stock print within seconds), "Roll" (same size closes one expiry and opens another), "Leg" (already in Multi-Leg). Live Tape gets a filter to hide paired prints. | Trace | Now (logic); real meaning needs Live | M |
| 3 | Opening vs closing is unknowable until next-day OI ([UW Substack](https://unusualwhales.substack.com/p/understanding-options-flow-during); [Realtime Options](https://realtimeoption.com/features)) | Common | **The overnight verdict.** A print's open/close read is marked "unconfirmed" until the next OI file, then turns into "built (OI +N)" or "unwound (OI −N)". A Footprints-style list "yesterday's large prints, confirmed this morning". Optional later: Cboe Open-Close (licensed, partial-exchange, 10-minute) as a "seen at the exchange" tier ([Cboe DataShop](https://datashop.cboe.com/open-close-cboe-c2-exchange)). | Trace, Pulse morning view | UI Now; truth Live | M (L with Cboe data) |
| 4 | Buy vs sell from side is shaky (mid fills, stale quotes) ([Flow Greeks](https://apps.apple.com/us/app/-/id6451004733)) | Common | **Keep the NBBO evidence (already strong); add quote age and an "unclear" state.** "Filled at 1.24 into a 1.20 × 1.28 quote seen 40 ms before." A mid fill or a moving quote reads "side unclear" rather than being forced into ask/bid. | Trace | Live (quote age); "unclear" state Now | S |
| 5 | The missing denominator; cherry-picked winners ([TradeIntelligent](https://tradeintelligent.substack.com/p/anyone-else-sick-and-tired-of-all); [ClaudeQuantAlgo](https://www.claudequantalgo.com/learn/unusual-options-activity/)) | Common (marketing critique) | **A follow-through ledger for every print that cleared a filter, not only marked ones.** It shows the underlying's move at +30 min / close / +1 day, in the print's lean, losers included, always as "N of M" with the full list a click away. No "win rate" wording; say "moved the print's way by the close in 41 of 112". Never used in marketing. | Trace (Footprints) | Now on stand-in history; meaningful Live | M–L |
| 6 | "Unusual" is a raw vol/OI threshold; scored feeds are unexplained ([dxFeed](https://dxfeed.com/what-is-unusual-options-trading/); [Barchart](https://www.barchart.com/options/unusual-activity)) | Common | **Show the yardstick.** Unusual against what: "3.1× this contract's 20-day volume; 1 of 214 prints today this far above its own norm". PrintDrilldown already has the usual-volume multiple; surface it in the grid's Read and say how rare it is. | Trace | Now | S |
| 7 | GEX vendors disagree; the sign assumption is hidden ([SpotGamma](https://spotgamma.com/what-is-gex-gamma-exposure/); [Cboe 2023](https://www.cboe.com/insights/posts/volatility-insights-evaluating-the-market-impact-of-spx-0-dte-options)) | Common among experienced traders | **An assumption line plus "if the sign is wrong".** One plain line on Pinpoint and Terrain ladders: "Assumes customers sold calls and bought puts." A toggle or ghost marks show where the walls and the flip would sit if the heaviest strikes were the other way. Either wire up the orphaned "Model error" term honestly or delete it. | Pinpoint, Terrain | Now | M |
| 8 | Levels hit by chance; six levels, one always "works" ([Trustpilot DK](https://dk.trustpilot.com/review/menthorq.com)) | Moderate, but sharp | **A record of how levels held, across sessions, with a chance line.** Extend "How the levels held today" to 20 sessions. Beside each level kind, show how often an arbitrary strike the same distance from spot "held" under the same test. Word it "held 14 of 20 tests; a strike as far away held 9 of 20". | Pinpoint | Now on stand-in history; real Live | M |
| 9 | Day-old or stale levels; refresh cadence undisclosed ([Trustpilot MenthorQ](https://www.trustpilot.com/review/menthorq.com); [TradeEcho](https://tradeecho.com/best-gex-tools)) | Moderate | **Freshness stamps.** "Open interest: last night's close · Volume: live, 2 s". Split each wall's bar into settled OI vs today's estimated build. Show the time of the last recompute on every dealer panel. | Pinpoint, Terrain, Pulse | Now | S |
| 10 | GEX misread as direction ([SpotGamma GEX playbook](https://spotgamma.com/gex/)) | Common | **A "what this does not tell you" line per dealer panel.** "Tells you how hedging changes if price moves; not which way price moves." Ahead's conditional sentences are the right voice; keep every dealer read in "if X, then dealers would…" form. | Pinpoint (Ahead), Terrain | Now | S |
| 11 | 0DTE "gamma squeeze" folklore vs research ([Dim–Eraker–Vilkov](https://westernfinance-portal.org/viewpaper?n=950096); [Cboe study](https://cdn.cboe.com/resources/education/research_publications/gammasqueezes.pdf)) | Moderate (X/finfluencer narrative) | **On the 0DTE page:** show how much of the dealer book expires today. The guide notes that research disagrees on whether 0DTE hedging amplifies moves. No "squeeze" language. | Trace (0DTE), Pinpoint | Now | S |
| 12 | Alerts that spam or arrive late (UW Jan 2026 reviews, [Worthepenny](https://unusualwhales.worthepenny.com/)) | Moderate | **Flow alerts built calm.** Each alert says why it fired (the rule and the evidence). Repeats on the same contract collapse into one ("+4 more"). A per-name quiet period, an end-of-hour digest option, and the delay from print to alert shown on the alert. Price alerts already fire once (good). | Pulse (Alerts drawer), Trace | Now (UI); timing Live | M |
| 13 | Dense or overwhelming UI ([DayTradeReview](https://daytradereview.com/unusual-whales-review/); BlackBoxStocks "ui is terrible", [Trustpilot](https://www.trustpilot.com/review/blackboxstocks.com)) | Moderate | **Already a strength** (sentence heads, guides). Next: a "first read" strip per room. Three facts only (where the walls are, the largest print and what it could be, what changed since the open), the grid below. | All rooms | Now | S–M |
| 14 | Data without explanation of dealer positioning ([Traders Agency](https://tradersagency.com/blog/unusual-whales-review)) | Common | **"Who's on the other side" card.** Explains, for the strike under the pointer, in two sentences, who is assumed to hold it and what they do as price moves, using the Attribution idea (one big order vs many small ones). The Attribution term exists; give it a surface. | Pinpoint, Terrain ladder | Now | M |
| 15 | Flow and levels sit in separate tools ([SpotGamma HIRO](https://spotgamma.com/hiro-indicator/)) | Moderate (a wish) | **"Built today by".** On a Pinpoint or Terrain strike, show the prints that added to it today (from Trace), split by likely-opened vs likely-closed, linking to the print cards. | Pinpoint ↔ Trace | Now | M |
| 16 | Cost and paid add-ons ([TradeEcho flow tools](https://tradeecho.com/best-options-flow-tools); MenthorQ add-on complaint) | Common | **Pricing design:** real-time is in both plans with no data add-ons (check data/billing.ts for the actual plan prices). Plain cancellation once a backend exists (UW's 24-hour/app-store rules are a known friction, [UW Terms](https://unusualwhales.com/terms)). Stay off "most popular"; already a house rule. | Landing / Settings | Now (copy) | S |
| 17 | Poor or uncertain mobile ([ImpliedOptions](https://impliedoptions.com/blog/option-flow-platforms-comparison-2025-10-16)) | Moderate | **Already a strength** (44 px targets, phone layouts). Next: a phone "read" view that stacks the first-read strip, the levels and five prints, built for a glance between trades. | Pulse | Now | M |
| 18 | Survivorship in *your own* trading | Inferred | **Practice ties reads to outcomes.** When a Paper trade is placed, the Journal saves the read at that moment (levels, the print that prompted it). Later it shows "trades placed near a call wall: 7, of which…", the user's own record, never a recommendation. | Practice (Paper, Journal) | Now | M |
| 19 | Instruction or overclaim copy (regulatory and trust risk; Q4) | Slayer-specific | **Rewrite Compass whyText and the Dark Pool reads** into observed + assumed + conditional voice (see Q4 rewrites). Stop asserting "bought"/"sold" for dark-pool prints; say "printed below spot in a rising session". Add banned-word linting (should, must buy, take profit, entry, our) to the house list. | Compass, Trace (Dark Pool) | Now | S |
| 20 | Trust-breaking inconsistencies (audit TR-25/26/27/38, PP-3, CO-1, X2) | Slayer-specific | **Fix before the keys go in.** Each one is exactly the "numbers don't add up" complaint traders level at competitors. | Trace, Pinpoint, Compass | Now | S–M each |

**Priorities, if only a few can be built.** Ranked by differentiation per effort, all "read, never an instruction":
- #19 and #20 first: cheap, and they protect the core promise.
- Then #7 and #9: assumption and freshness on dealer panels. No competitor found discloses these prominently.
- Then #1 and #6: "could also be" and showing the yardstick.
- Then #8 and #5: records with a chance line and a denominator. These are the most distinctive and the hardest for incumbents to copy, because they expose the incumbents' marketing.

### Gaps
- Slayer coverage was checked by grep and partial reads, not by running the app. "No UI use found" (Attribution, Model error) means no grep hit in components/pages, not a full audit.
- Whether Slayer's planned Unusual Whales API exposes open/close, origin or hedge tags was not checked. That decides whether #2 and #3 can be more than inference.
- Effort estimates are rough judgements without a design review.
