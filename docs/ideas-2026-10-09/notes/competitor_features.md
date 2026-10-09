# Competitor features: options analytics, flow and GEX products (October 2026), and what Slayer could learn from them

Method note: researched 2026-10-09. The network proxy blocked direct fetches of most vendor sites (unusualwhales.com, flashalpha.com, tradealgo.com returned EGRESS_BLOCKED), so the facts below come from search-result summaries of vendor pages, help centres and 2025–2026 reviews. The URLs are the pages those summaries came from. Many review sites are affiliate pages or competitors (FlashAlpha, TradeAlgo, GEX Levels, Trade Echo, Unusual Whales' own "vs" pages), so treat their prices as indicative. Where sources disagree, both figures are given. Slayer's own capabilities were checked by grepping `/home/user/3abida/src`, and file paths are given as the source.

## Q1. What does each competitor offer (flagship views, alerting, education, community, AI)?

### Takeaway
The field splits into three groups. **Flow-first** products are Unusual Whales, Cheddar Flow, FlowAlgo, BlackBoxStocks, InsiderFinance and Tradytics. **Dealer-positioning or GEX-first** products are SpotGamma, MenthorQ, GEXBot and Quant Data's exposure side. **Strategy and volatility analytics** products are OptionStrat and Market Chameleon. Optionomics straddles all three. The products that stand out each add a layer the others lack:
- SpotGamma: expert commentary and a modelled options inventory (TRACE, HIRO).
- MenthorQ: futures-option gamma, platform integrations and an AI explainer (QUIN).
- Quant Data: exposure-over-time and a heat map with a time slider.
- GEXBot: a "classified volume" model.
- FlowAlgo: voice alerts.
- BlackBoxStocks: live voice rooms.
- Tradytics: Discord bots.

### Cited Findings

**Unusual Whales**
- Entry plan from about $50/mo with real-time options flow, dark pool data and congressional trading. Annual billing is about $42/mo. Higher tiers add API access, advanced scanners and priority support. There is a free account with delayed data. — [UW pricing landing page](https://unusualwhales.com/lp/unusual-whales-pricing); [UW annual plan page](https://unusualwhales.com/lp/unusual-whales-annual-plan-savings)
- Market Tide shows market-wide net call vs net put premium in 1- or 5-minute intervals. — [Apify UW API listing](https://apify.com/nabeelbaghoor/options-flow-dark-pool-api); [UW quick guide](https://unusualwhales.com/information/-a-quick-guide-to-core-features)
- Periscope shows SPX market-maker net gamma strike by strike. Sources disagree on refresh: an FAQ says every 10 minutes, and newer pages say every minute on the top tier. — [UW Periscope](https://unusualwhales.com/periscope/market-exposure); [UW SPY greek exposure](https://unusualwhales.com/stock/SPY/greek-exposure)
- Per-ticker GEX, DEX, vanna and charm exposure pages. — [UW SPY greek exposure](https://unusualwhales.com/stock/SPY/greek-exposure)
- GEX alerts on web and mobile fire "when GEX changes over any time frame and in any direction". They can be combined with Market Tide and net-premium-cross alerts. (Announced 2024; older.) — [UW on X](https://x.com/unusual_whales/status/1817651490850508879)
- 2026 reviews list Flow Alerts and Interval Flow among the features, plus a "Mr. Whale AI Assistant". The assistant's function could not be confirmed. — [PurePowerPicks UW review 2026](https://purepowerpicks.com/unusual-whales-review/); [Marlvel UW intel](https://marlvel.ai/intel-report/finance/com-unusualwhales)
- A public API and MCP server exist. — [UW public API](https://unusualwhales.com/public-api)
- Education is weak. One review scores it 4/10 and calls it sparse. — [DayTradingToolkit UW review](https://daytradingtoolkit.com/reviews/unusual-whales-review)
- The mobile app is described as a lighter version of the web app with frequent crashes, and reviews are mixed. — [Marlvel](https://marlvel.ai/intel-report/finance/com-unusualwhales); [Apple App Store](https://apps.apple.com/us/app/unusual-whales/id1514447510?see-all=reviews&platform=ipad)

**Cheddar Flow**
- Standard: $85/mo with a 7-day trial. Includes real-time order flow, advanced filters, unusual volume, flow-overview insights, on-demand historical data and "Cheddar AI".
- Professional: $99/mo. Adds gamma exposure, a custom watchlist builder, dark pool orders and levels, and "AI power alerts". No trial on this tier.
- Pro Annual: about $75/mo. — [Cheddar Flow pricing](https://www.cheddarflow.com/pricing/); [OptionsTrading.org review](https://www.optionstrading.org/blog/cheddar-flow-review/)
- Reviewers describe AI-assisted alert classification and a clean real-time feed. One older review says there is no congress tracking. — [TradeAlgo flow tools 2026](https://www.tradealgo.com/trading-guides/options/best-options-flow-tools-and-scanners-in-2026-a-complete-comparison) (TradeAlgo is a competitor)

**FlowAlgo**
- About $149/mo, or from $99/mo billed annually, with a two-week trial at $37. Positioned on speed. — [FindMyMoat FlowAlgo](https://www.findmymoat.com/tools/flowalgo); [TradeAlgo vs FlowAlgo](https://www.tradealgo.com/trading-guides/comparisons/tradealgo-vs-flowalgo)
- Voice alerts by text-to-speech, filterable by ticker, premium and expiration. Sources disagree on whether it is web-only or offers mobile notifications. — [FlowAlgo plan page](https://flowalgo.com/select-a-plan/); [TraderHQ review](https://traderhq.com/flowalgo-review-best-options-flow-service/)

**SpotGamma**
- Plans and prices:
  - The official support page lists Essential at $99/mo and Alpha at $299/mo, or $891/yr and $2,691/yr.
  - Reviews of the July 2026 sales page cite Standard $89, Pro $129 and Alpha $299 (or $224/mo annually), plus Institutional from $1,999/mo.
  - — [SpotGamma support: cost](https://support.spotgamma.com/hc/en-us/articles/1500002666102-What-is-the-cost-of-a-SpotGamma-Subscription); [FindMyMoat](https://www.findmymoat.com/tools/spotgamma); [FlashAlpha review](https://flashalpha.com/articles/spotgamma-review-2026-pricing-features-alternatives) (FlashAlpha is a competitor)
- The Essential tier is a "research desk": Founder's Note commentary, FlowPatrol flow reports, index key levels, weekly webinars and Discord. Sources disagree on whether Equity Hub (about 3,500 stocks and ETFs) sits in Essential/Pro or Alpha. — [GEX Levels: SpotGamma alternatives](https://gex-levels.com/blog/spotgamma-alternatives); [SpotGamma Options Key Levels Explained](https://spotgamma.com/options-key-levels-explained/)
- TRACE:
  - A real-time S&P 500 strike plot and heatmap built on an "Options Inventory Model" with three lenses: Gamma, Delta Pressure and Charm Pressure.
  - Updates every minute and offers 5-day forward projections.
  - A 0DTE filter shows only 0DTE positions.
  - — [TRACE user guide (updated 2026-03-30)](https://spotgamma.com/trace-user-guide); [TRACE landing](https://spotgamma.com/trace-lp/)
- HIRO ("Hedging Impact Real-Time Options") is an intraday hedging-impact indicator first launched in 2021 with Bookmap. "HIRO Charts and Canvas" was announced on 2026-06-29, but details were login-gated. — [FlashAlpha API guide](https://flashalpha.com/articles/spotgamma-data-via-api-migration-guide); [SpotGamma](https://spotgamma.com/?p=20101)
- Equity Hub offers two models:
  - Total OI: assumes market makers sold all options.
  - Synthetic OI: built from customer order flow, the same logic as TRACE.
  - — [SpotGamma support: Equity Hub](https://support.spotgamma.com/hc/en-us/articles/1500003037862-What-is-Equity-Hub)
- Levels are set daily and hold for the session, while TRACE shows price meeting them live. SpotGamma "Compass" covers volatility and directional expectations. — [SpotGamma key levels](https://spotgamma.com/options-key-levels-explained/)
- Reviewers call SpotGamma's analyst commentary "the benchmark for daily positioning interpretation". — [Trade Echo best GEX tools](https://tradeecho.com/best-gex-tools)

**MenthorQ**
- Pricing page: Premium $129/mo and Pro $349/mo. Pro adds about 9 live trading sessions a week with professional traders. Older and promo figures ($69, $99, $499/yr) also circulate. — [MenthorQ pricing](https://menthorq.com/pricing/); [GEX Levels: MenthorQ alternatives](https://gex-levels.com/blog/menthorq-alternatives); [MenthorQ on X](https://x.com/MenthorQpro/status/1859952609588625549)
- Gamma Levels come as an end-of-day update plus intraday refreshes. They are sold as overlays inside TrendSpider and ATAS. — [TrendSpider blog](https://trendspider.com/blog/menthorq-levels-indicators/); [ATAS marketplace](https://marketplace.atas.net/product/menthor-q-market-data-services)
- Coverage extends to futures options: index futures, commodities, metals, fixed income, FX, softs and crypto. — [MenthorQ academy](https://menthorq.com/academy/trading-with-menthorq/lessons/trade-with-menthorq/)
- QUIN is a conversational AI layer that "can explain indicators, retrieve live ticker data, and run scenario analysis on gamma exposure". — [MenthorQ QUIN guide](https://menthorq.com/guide/ai-driven-trading-with-menthorqs-quin/)
- MenthorQ runs an academy with lessons and webinars. — [MenthorQ academy webinars](https://menthorq.com/academy/menthor-q-webinars/lessons/intraday-gamma-models-presentation/)
- A Trustpilot reviewer called the levels unreliable (one user's opinion). — [Trustpilot](https://dk.trustpilot.com/review/menthorq.com)

**Quant Data**
- Pro tier is about $74.99/mo with a 7-day trial (third-party listing). It includes live flow, 21 months of historical flow, dark pool prints and an options heat map. — [NexusFi listing](https://nexusfi.com/d/data-providers/quantdata/)
- GEX, DEX, VEX and CHEX by strike and expiration. — [Quant Data App Store](https://apps.apple.com/us/app/quant-data/id1602108613)
- Net Drift is a real-time chart of cumulative net call/put premium for any ticker or contract. Clicking a spike shows the trades behind it. — [Quant Data v3 changelog](https://help.quantdata.us/en/articles/9808529-quant-data-v3-changelog); [Quant Data on X](https://x.com/QuantData/status/1933687560363995590)
- Net Flow ranks tickers by bullish and bearish premium. — [Quant Data help: Net Flow](https://help.quantdata.us/en/articles/6711382-what-is-net-flow)
- The heat map covers 30+ metrics (GEX, DEX, VEX, CHEX) across strikes and expirations. It has a time slider, and clicking a cell shows its trades and its history. — [Quant Data v3 changelog](https://help.quantdata.us/en/articles/9808529-quant-data-v3-changelog)
- An exposure-over-time view shows how delta, gamma, vanna and charm "build, shift, and decay throughout the trading day". — [Quant Data](https://quantdata.us/)
- Quant Data also offers a futures product (footprint charts, depth map, DOM) and an API with Net Drift and Net Flow endpoints. — [Quant Data Futures](https://quantdata.us/futures); [Quant Data API](https://quantdata.us/api)

**GEXBot**
- Four stacked packages: Classic (naive GEX, EOD report, pivot levels, zero gamma), State (adds a state package), Orderflow (adds classified volume) and Quant (all packages plus 90-day history downloads, option expiries and WebSocket). Research is an add-on. — [GEXBot API docs](https://docs.gexbot.com/apidocs/); [GEXBot glossary](https://docs.gexbot.com/glossary/)
- "Classified volume" is derived from each trade's effect on the volatility surface rather than exchange tags. It measures how the whole chain shifts each second. — [GEXBot glossary](https://docs.gexbot.com/glossary/)
- No official dollar prices were found. A reseller lists State at about $19/mo and Orderflow at $30/mo (unverified). The official page showed only a 50% first-month code. — [GEXBot pricing](https://www.gexbot.com/pricing); [GroupBuyTrading](https://groupbuytrading.com/product/gexbot-state/)

**Tradytics**
- Free tier with delayed data and a daily scanner. Individual Pro is $69/mo (about $37/mo yearly). Discord Server Owners is $199/mo (about $125/mo yearly) for 10+ auto-posting and query bots in your own server. The bot plan does not include individual access. One directory lists conflicting tiers ($30/$50/$80). — [PurePowerPicks Tradytics 2026](https://purepowerpicks.com/tradytics-review/); [OpenTools](https://opentools.ai/tools/tradytics)
- Features include live flow, AI trade ideas, premium scanners, market net flow, GEX/DEX tools, dark pool and insider trades. Bots in 2023 included Trady Flow, Bullseye and Scalps (older). — [AIChief](https://aichief.com/ai-business-tools/tradytics-ai/); [OptionDrops 2023](https://optiondrops.com/2023/09/tradytics/)

**OptionStrat**
- Free: strategy builder, optimizer and flow, with 15-minute delayed data.
- Live Tools ($39.99/mo): real-time builder and optimizer, chance-of-profit, net Greeks and saved-strategy tracking.
- Live Flow ($99.99/mo): unusual-flow scanner with filters and alerts, plus congressional and insider trades.
- About 12% off annually and a 7-day trial (checked 2026-08-05 per one source). Older pages show $14.99/$49.99, which is stale. — [RealtimeOption compare](https://realtimeoption.com/compare/realtime-options-vs-optionstrat); [DaysToExpiry review](https://www.daystoexpiry.com/blog/optionstrat)

**Market Chameleon**
- Tiers: Starter (free), Stock Trader, Options Trader, Earnings Trader and Total Access. Prices are quoted as $39, $69 or $99/mo depending on source. Data is delayed 15 minutes, and free users see only large trades (200+ contracts) for the day. — [ScreenerMatch](https://screenermatch.com/market-chameleon-review); [TradesFunded 2026](https://tradesfunded.com/market-chameleon-review/)
- Earnings tools: implied move from the ATM straddle, straddle performance, expected-vs-actual moves across past quarters, IV rank and percentile, IV term structure, and screeners (iron condors, straddles, conversions/reversals). — [OptionsTrading.org MC review 2026](https://www.optionstrading.org/blog/market-chameleon-review/); [TradingToolsHub MC guide](https://tradingtoolshub.com/blog/market-chameleon-setup-guide-2026/)

**BlackBoxStocks**
- Pricing conflicts: about $99.97/mo or $959/yr (one source updated 2026-01-16), or tiers at $59, $79, $89 and $149. Dark pool and full flow are in the top tier. — [BullishBears 2026](https://bullishbears.com/black-box-stocks-review/); [DayTradingz](https://daytradingz.com/black-box-stocks-review/)
- The flow scanner has about 17 filters and colour-coding. Every tier includes Discord with live voice rooms and a "Team Traders" group broadcasting in market hours. A cancelling reviewer called the data "laggy, overly noisy". — [DayTradingToolkit](https://daytradingtoolkit.com/reviews/black-box-stocks-review); [TheStockDork](https://www.thestockdork.com/blackboxstocks-review/)

**InsiderFinance**
- $75/mo, $195/quarter or $55/mo annually (September 2026). Older figures were $99/mo. The free feed shows the 15 most recent trades, 30 minutes delayed. — [DayTradingz InsiderFinance](https://daytradingz.com/insider-finance-review/); [InsiderFinance](https://www.insiderfinance.io/)
- The flow dashboard covers sweeps, blocks, above-ask fills, and dark pool blocks with a "heat-score" ranking. The ticker table sorts by put flow, OTM %, average expiration and unusual OTM flow. Alerts are mostly email. — [DayTradeReview](https://daytradereview.com/insiderfinance-review/); [Trade Echo best flow tools](https://tradeecho.com/best-options-flow-tools)

**Optionomics**
- Delta $39, Gamma $59, Theta $79 and Vega $99/mo. All tiers include 15+ years of history. Gamma and up adds live flow with pause/play, sweep, block and ISO classification, and dark pool dashboards. Higher tiers add AI, backtesting and API. The homepage shows discounted rates. — [Optionomics plans](https://docs.optionomics.ai/getting-started/plans/); [Optionomics](https://optionomics.ai/)
- The daily analytics dashboard (7–11 charts) includes a GEX view with walls, zero gamma and peak call/put gamma. It also includes delta exposure, a flow chart of aggressive call/put premium, and historical analytics. The docs say GEX is an estimate. — [Optionomics GEX docs](https://docs.optionomics.ai/analytics/gamma-exposure/); [Options flow chart docs](https://docs.optionomics.ai/features/options-flow-chart/)

### Inferences
- The "serious" products put a model or an interpretation on top of the same raw data. SpotGamma's commentary and inventory model, GEXBot's classified volume and Quant Data's time-slider heat map are examples. Plain flow feeds compete on price and speed.
- AI features (Cheddar AI, Mr. Whale, QUIN, Tradytics "AI trade ideas", Optionomics AI) are now common marketing items, but the evidence on what they do is thin. QUIN's "explain indicators / scenario analysis" is the one most compatible with Slayer's "a read, never an instruction" rule.

### Gaps
- Unusual Whales' 2026 Pro and Max prices could not be confirmed, because unusualwhales.com/pricing was blocked.
- GEXBot's official prices were not found.
- No Reddit threads came back from search, so first-hand user sentiment is limited to Trustpilot, App Store and reviews.
- Market Chameleon's and BlackBoxStocks' current prices conflict across sources.

## Q2. Which features recur (table stakes) and which are unique and loved (differentiators)?

### Takeaway
**Table stakes in 2026:**
- A real-time flow tape with sweep and block classification and filters.
- Dark pool prints.
- Per-strike GEX (usually with DEX, vanna and charm).
- Congress and insider trades.
- Alerts.
- A free or delayed tier and a 7-day trial.

**Differentiators that reviewers single out:**
- Expert daily commentary (SpotGamma).
- Model choice: Total OI vs Synthetic OI, naive vs classified (SpotGamma, GEXBot).
- Exposure through time with drill to trades (Quant Data).
- Voice alerts (FlowAlgo).
- Live voice and community rooms (BlackBoxStocks, SpotGamma Discord, MenthorQ live sessions).
- Platform integrations and Discord bots (MenthorQ, Tradytics).
- Futures-option gamma (MenthorQ).
- Earnings implied-vs-actual history (Market Chameleon).
- An optimizer with chance-of-profit (OptionStrat).

### Cited Findings
- Dark pool overlays are offered by TradeAlgo, FlowAlgo, InsiderFinance and Cheddar Flow. FlowAlgo and Cheddar Flow are "preferred for speed and institutional-grade filtering". — [TradeAlgo 2026](https://www.tradealgo.com/trading-guides/options/best-options-flow-tools-and-scanners-in-2026-a-complete-comparison)
- Per-strike GEX/DEX/VEX/CHEX is offered by:
  - Unusual Whales: [UW SPY](https://unusualwhales.com/stock/SPY/greek-exposure)
  - Quant Data: [App Store](https://apps.apple.com/us/app/quant-data/id1602108613)
  - Cheddar Flow Professional: [pricing](https://www.cheddarflow.com/pricing/)
  - Tradytics: [AIChief](https://aichief.com/ai-business-tools/tradytics-ai/)
  - Optionomics: [docs](https://docs.optionomics.ai/analytics/gamma-exposure/)
- Congress and insider trades are offered by Unusual Whales ([UW](https://unusualwhales.com/lp/unusual-whales-pricing)), OptionStrat Live Flow ([RealtimeOption](https://realtimeoption.com/compare/realtime-options-vs-optionstrat)) and Tradytics ([AIChief](https://aichief.com/ai-business-tools/tradytics-ai/)).
- Free or delayed tiers are offered by Unusual Whales, OptionStrat (15-minute delay), InsiderFinance (30-minute delay, 15 trades), Tradytics and Market Chameleon. — sources as in Q1.
- Reviewers call SpotGamma's commentary "the benchmark". Unusual Whales suits "flow-focused traders on a budget", and SpotGamma suits those who want "expert interpretation". — [Trade Echo](https://tradeecho.com/best-gex-tools)
- Model choice as a feature:
  - SpotGamma Total OI vs Synthetic OI: [SpotGamma Equity Hub](https://support.spotgamma.com/hc/en-us/articles/1500003037862-What-is-Equity-Hub)
  - GEXBot naive vs classified volume: [GEXBot glossary](https://docs.gexbot.com/glossary/)
  - Optionomics stresses that GEX is an estimate: [Optionomics](https://docs.optionomics.ai/analytics/gamma-exposure/)
- Time-slider heat map and click-through to trades. — [Quant Data v3 changelog](https://help.quantdata.us/en/articles/9808529-quant-data-v3-changelog)
- Voice alerts are FlowAlgo-only among those checked. InsiderFinance alerts are email-based. — [FlowAlgo](https://flowalgo.com/select-a-plan/); [Trade Echo](https://tradeecho.com/best-options-flow-tools)
- Community as a product:
  - BlackBoxStocks voice rooms: [BullishBears](https://bullishbears.com/black-box-stocks-review/)
  - MenthorQ Pro live sessions: [GEX Levels](https://gex-levels.com/blog/menthorq-alternatives)
  - SpotGamma Discord and webinars: [GEX Levels](https://gex-levels.com/blog/spotgamma-alternatives)
  - Tradytics bots: [PurePowerPicks](https://purepowerpicks.com/tradytics-review/)
- Noise is the common complaint about flow feeds: BlackBoxStocks "laggy, overly noisy" ([DayTradingToolkit](https://daytradingtoolkit.com/reviews/black-box-stocks-review)). The reliability of gamma levels is questioned for MenthorQ ([Trustpilot](https://dk.trustpilot.com/review/menthorq.com)).

### Inferences
- A raw flow tape is a commodity. Users pay for help with noise: filters, classification and something that ties a print to a level. Slayer's thesis of flow read against dealer levels in one terminal is the gap between flow-first and GEX-first products.
- Being open about the model is a differentiator. SpotGamma and GEXBot sell the choice of model as a feature, and Optionomics labels GEX an estimate. Slayer's Observed / Calculated / Modeled split on the landing already matches this.

### Gaps
- No quantitative survey (for example, user counts or feature-usage stats) was found for any vendor.

## Q3. What does each charge, and how do they package tiers? (Relevant to Pinpoint $75 / Compass $180)

### Takeaway
**Monthly price bands:**
- Flow-only: $50–$100.
- GEX/positioning with a research layer: $99–$349, with SpotGamma Alpha at $299 and MenthorQ Pro at $349.
- Strategy tools: $20–$100.

**Common packaging:**
- Tiers stack, each adding to the one below (GEXBot, Optionomics, OptionStrat).
- Dark pool, GEX and AI alerts sit in the upper tier (Cheddar Flow, BlackBoxStocks).
- API and history depth sit at the top (Unusual Whales, GEXBot Quant, SpotGamma Alpha).
- Annual discounts are 12–25%.
- A free or delayed tier or a 7-day trial is common.

Pinpoint at $75 sits with flow-only tools but holds dealer-level content that rivals charge $99–$299 for. Compass at $180 sits between SpotGamma Pro ($129) and Alpha ($299).

### Cited Findings
| Product | Tiers (monthly) | Gated to upper tier | Source |
|---|---|---|---|
| Unusual Whales | from ~$50 (annual ~$42); Pro/Max unconfirmed | API, advanced scanners, 1-min Periscope | [UW](https://unusualwhales.com/lp/unusual-whales-pricing) |
| Cheddar Flow | Standard $85 · Professional $99 · Pro annual ~$75 | GEX, dark pool levels, AI power alerts | [Cheddar Flow](https://www.cheddarflow.com/pricing/) |
| FlowAlgo | ~$149 (from $99 annual) | — | [FindMyMoat](https://www.findmymoat.com/tools/flowalgo) |
| SpotGamma | Essential $99 / Alpha $299 (support page); Standard $89 · Pro $129 · Alpha $299 · Inst. $1,999+ (2026 reviews) | TRACE, HIRO, Synthetic OI, API | [SpotGamma support](https://support.spotgamma.com/hc/en-us/articles/1500002666102-What-is-the-cost-of-a-SpotGamma-Subscription); [FindMyMoat](https://www.findmymoat.com/tools/spotgamma) |
| MenthorQ | Premium $129 · Pro $349 | live trading sessions (~9/week) | [MenthorQ](https://menthorq.com/pricing/); [GEX Levels](https://gex-levels.com/blog/menthorq-alternatives) |
| Quant Data | Pro ~$74.99 | — | [NexusFi](https://nexusfi.com/d/data-providers/quantdata/) |
| GEXBot | Classic < State < Orderflow < Quant (prices not found) | classified volume, history, WebSocket | [GEXBot docs](https://docs.gexbot.com/apidocs/) |
| Tradytics | Free · Pro $69 · Discord server $199 | bots for your own server | [PurePowerPicks](https://purepowerpicks.com/tradytics-review/) |
| OptionStrat | Free · Live Tools $39.99 · Live Flow $99.99 | real-time, chance of profit, flow, congress | [RealtimeOption](https://realtimeoption.com/compare/realtime-options-vs-optionstrat) |
| Market Chameleon | Free · $39–$99 across 4 paid packs (conflicting) | earnings pack, full access | [ScreenerMatch](https://screenermatch.com/market-chameleon-review) |
| BlackBoxStocks | ~$99.97 single, or $59–$149 tiers (conflicting) | dark pool + full flow at $149 | [BullishBears](https://bullishbears.com/black-box-stocks-review/) |
| InsiderFinance | $75 · $65 quarterly · $55 annual; free delayed feed | — | [DayTradingz](https://daytradingz.com/insider-finance-review/) |
| Optionomics | Delta $39 · Gamma $59 · Theta $79 · Vega $99 | flow (Gamma+), AI/backtest/API (top) | [Optionomics](https://docs.optionomics.ai/getting-started/plans/) |

- Slayer's plans: Pinpoint is $75/mo ("Where dealer hedging holds and pushes price."), Compass is $180/mo ("Contracts that fit the levels right now."), and Lifetime is kept only in Settings. There is no trial: the account is free and a plan is paid. — [/home/user/3abida/src/data/billing.ts](file:///home/user/3abida/src/data/billing.ts)

### Inferences
- A "free account" in Slayer could mirror rivals' delayed or limited tiers. For example, a free account could see one room, or the Pinpoint levels for SPY only. Nearly every rival uses this as the way in.
- Compass at $180 needs a visible "research layer" or model depth to justify sitting above SpotGamma Pro and MenthorQ Premium ($129). The candidates are the Ahead read, Targets agenda and Compass board, plus replay and history.
- No rival charges for "contracts that fit the levels". Compass's core is not a priced category elsewhere, which is a pricing advantage but needs explaining.
- An annual option (12–25% off, the norm) is absent from data/billing.ts PLANS. This was observed in code; whether it is planned is unknown.

### Gaps
- The prices of Tradytics, Market Chameleon, BlackBoxStocks and SpotGamma conflict across sources, so all of them should be checked on the vendors' sites.

## Q4. What does Slayer already have, what is missing, and where is it distinctive? (with feature ideas)

### Takeaway
Slayer already covers almost every table-stakes analytic, and several rivals' paid differentiators, on simulated data:
- GEX, DEX, vanna and charm.
- A strike × expiry exposure surface.
- An intraday book replay.
- An expected-move cone.
- IV vs realised drift.
- Earnings implied vs past moves with IV rank.
- Insiders and Congress.
- Net flow, footprints, 0DTE, multi-leg and dark pool.
- Ten alert kinds, including GEX-flip and wall-move.
- Pine scripts.
- Paper trading with prop-firm evaluations, backtest replay and a journal with MAE/MFE.

The gaps are mostly delivery and "layer" features, not analytics:
- Alerts that leave the browser: voice, push, webhook/Discord.
- An explainer assistant.
- A daily written read.
- Platform export of levels.
- Model choice and openness.
- A market-wide tide.
- IV skew and term-structure views.
- Click-through from aggregates to the prints behind them.
- Community.

Slayer's distinctive edge is joining things rivals sell apart: flow and levels and contracts and practice in one terminal, a "what it forces" hedge-flow read, and a replayable book.

### Cited Findings

**What Slayer has (verified in code):**
- GEX/DEX/vanna/charm exposures and ladder. — [/home/user/3abida/src/types/gex.ts](file:///home/user/3abida/src/types/gex.ts); [/home/user/3abida/src/components/gex/ExposureLadder.tsx](file:///home/user/3abida/src/components/gex/ExposureLadder.tsx); [/home/user/3abida/src/data/vannacharm.ts](file:///home/user/3abida/src/data/vannacharm.ts)
- Strike × expiry × greek exposure surface (five greeks; "Skylit's heatmap" cited as inspiration). — [/home/user/3abida/src/data/exposureSurface.ts](file:///home/user/3abida/src/data/exposureSurface.ts)
- Intraday replay of the book on a 5-second grid (bars, levels, ladder, chain) with a replay strip on the Map. — [/home/user/3abida/src/data/replay.ts](file:///home/user/3abida/src/data/replay.ts); [/home/user/3abida/src/components/gex/ReplayStrip.tsx](file:///home/user/3abida/src/components/gex/ReplayStrip.tsx)
- "What today added" per strike (Building page), which is close to Quant Data's exposure-over-time. — [/home/user/3abida/src/pages/pinpoint/Building.tsx](file:///home/user/3abida/src/pages/pinpoint/Building.tsx)
- Hedge-flow forecast: the dollars dealers must trade if price walks to each strike. This is a HIRO-adjacent read with no direct rival equivalent found. — [/home/user/3abida/src/data/hedgeFlow.ts](file:///home/user/3abida/src/data/hedgeFlow.ts)
- Targets agenda (reach odds × stake per strike) and Ahead (today vs the last ~22 sessions). — [/home/user/3abida/src/data/agenda.ts](file:///home/user/3abida/src/data/agenda.ts); [/home/user/3abida/src/data/aheadHistory.ts](file:///home/user/3abida/src/data/aheadHistory.ts)
- Expected-move cone on the chart, IV vs realised drift, and earnings/event markers on the tape. — [/home/user/3abida/src/data/expectedMove.ts](file:///home/user/3abida/src/data/expectedMove.ts); [/home/user/3abida/src/data/volDrift.ts](file:///home/user/3abida/src/data/volDrift.ts); [/home/user/3abida/src/data/events.ts](file:///home/user/3abida/src/data/events.ts)
- Earnings: impliedMovePct, pastMoves, ivRank and an IV-crush estimate. — [/home/user/3abida/src/data/earnings.ts](file:///home/user/3abida/src/data/earnings.ts)
- Trace pages: Live Tape, Screener, Net Flow (cumulative net), Footprints (ΔOI), Watchers, Windows, 0DTE, Multi-leg, Dark Pool, Compare and Flow Tracker. A print drilldown shows OI change and a contract flow chart. — [/home/user/3abida/src/pages/trace/](file:///home/user/3abida/src/pages/trace/); [/home/user/3abida/src/components/trace/PrintDrilldown.tsx](file:///home/user/3abida/src/components/trace/PrintDrilldown.tsx)
- Dossier: News, Earnings, Insiders, Congress and Stocks. — [/home/user/3abida/src/pages/record/](file:///home/user/3abida/src/pages/record/)
- Alert kinds: price, level, indicator, gexflip, newsupreme, wallmove, flow, news and script. A chime sound plays on fire. There is no speech synthesis, webhook, Discord, Telegram or push. — [/home/user/3abida/src/components/gex/alertStore.ts](file:///home/user/3abida/src/components/gex/alertStore.ts); [/home/user/3abida/src/components/alerts/AlertToasts.tsx](file:///home/user/3abida/src/components/alerts/AlertToasts.tsx) (grep for `speechSynthesis|webhook|telegram` returned nothing)
- The Weigher chain shows probability columns. A strategy builder with a payoff curve exists. — [/home/user/3abida/src/components/weigher/ChainGrid.tsx](file:///home/user/3abida/src/components/weigher/ChainGrid.tsx)
- Community is fully drawn but behind "Coming soon" and off the menu. — [/home/user/3abida/src/pages/community/Room.tsx](file:///home/user/3abida/src/pages/community/Room.tsx); [/home/user/3abida/src/components/ui/ComingSoonWall.tsx](file:///home/user/3abida/src/components/ui/ComingSoonWall.tsx)
- In-page guides exist (TraceGuide, LedgerGuide, NewsGuide, WeigherGuide), along with a glossary file (data/terms.ts, which mentions max pain only as a definition). — [/home/user/3abida/src/data/terms.ts](file:///home/user/3abida/src/data/terms.ts)

**What Slayer lacks (grep returned nothing or only incidental matches):**
- No AI assistant (`assistant|ask ai|AI chat`: 0 files).
- No seasonality.
- No short interest.
- No volatility cone.
- No dedicated IV skew or smile chart: "skew" appears only in Palette and data files, and "term structure" only in data/expectedMove.ts and data/exposureSurface.ts, with no chart component found.
- No webhook, Telegram or push notifications.
- No "max pain" view.

### Inferences — feature ideas (each framed as a read, never a call; words avoid grade/score/signal/confluence)

| # | Idea: what it is | Who does it, and how | Why traders value it (evidence) | Slayer room | UI-only now or live data | Effort |
|---|---|---|---|---|---|---|
| 1 | **Spoken alerts**: an alert's own sentence read aloud via the browser's speech synthesis ("SPY through the call wall 475"), with a per-alert voice toggle | FlowAlgo voice alerts by text-to-speech, filterable by ticker, premium and expiry ([FlowAlgo](https://flowalgo.com/select-a-plan/); [TraderHQ](https://traderhq.com/flowalgo-review-best-options-flow-service/)) | It is FlowAlgo's one unique alert feature among those checked, and a tape-watcher can look away from the screen. Slayer already chimes ([AlertToasts.tsx](file:///home/user/3abida/src/components/alerts/AlertToasts.tsx)) | Settings + alerts drawer | UI-only now (Web Speech API) | S |
| 2 | **Alerts that leave the terminal**: browser push, email, webhook and Discord channel posting | UW mobile and web GEX alerts ([UW on X](https://x.com/unusual_whales/status/1817651490850508879)); Tradytics Discord bots, a $199 plan of its own ([PurePowerPicks](https://purepowerpicks.com/tradytics-review/)); InsiderFinance email ([Trade Echo](https://tradeecho.com/best-options-flow-tools)) | Every flow rival sells alert delivery. Tradytics prices bots above its individual plan | Alerts | Push or a Notification API while the tab is open: UI-only S. Webhook, Discord or email: needs backend, M | S–M |
| 3 | **GEX-change alert over a window**: "net gamma moved ±X over N minutes", in either direction | UW "GEX changes over any time frame and in any direction" ([UW on X](https://x.com/unusual_whales/status/1817651490850508879)) | Combines with tide and net-premium alerts. Slayer has gexflip and wallmove but no rate-of-change kind | Alerts (Pinpoint) | UI-only now (simulated book) | S |
| 4 | **Market tide**: one market-wide line of net call minus put premium, in 1- or 5-minute steps, with the index price overlaid | UW Market Tide ([Apify UW API](https://apify.com/nabeelbaghoor/options-flow-dark-pool-api)) | A flagship UW view. Net Flow ranks names and sectors, but no single whole-market line was found in Slayer (NetFlowPane has a sector view) | Pulse widget; Trace Net Flow header | UI-only now | S–M |
| 5 | **Click a spike, see its prints**: on Net Flow's cumulative line, and on every aggregate chart, a click opens the prints behind that minute | Quant Data Net Drift: "clicking a spike shows the trades behind it" ([QD changelog](https://help.quantdata.us/en/articles/9808529-quant-data-v3-changelog)) | Ties an aggregate to evidence. Slayer goes the other way (print → contract chart in PrintDrilldown) | Trace (Net Flow, 0DTE, Compare) | UI-only now | M |
| 6 | **Time slider on the exposure surface, with cell history**: run Pinpoint's replay through the strike × expiry surface; a cell click shows that cell's gamma through the day and its prints | Quant Data heat map: time slider, click a cell for trades and history over time ([QD changelog](https://help.quantdata.us/en/articles/9808529-quant-data-v3-changelog)); exposure "builds, shifts, decays" ([Quant Data](https://quantdata.us/)) | Slayer already has both halves ([exposureSurface.ts](file:///home/user/3abida/src/data/exposureSurface.ts), [replay.ts](file:///home/user/3abida/src/data/replay.ts)). Joining them leans into a strength | Pinpoint Map | UI-only now | M |
| 7 | **0DTE-only lens on the strike plot and ladder** (a toggle: all expiries / 0DTE / next week) | SpotGamma TRACE 0DTE filter ([TRACE guide](https://spotgamma.com/trace-user-guide)) | SpotGamma positions it as an "SPX 0DTE indicator" ([SpotGamma](https://spotgamma.com/best-spx-0dte-indicators/)). Slayer's exposureSurface already holds per-expiry rows | Terrain ladder, Pinpoint | UI-only now | S |
| 8 | **Projected levels ahead**: where the walls and the flip stand at tomorrow's and later opens as today's 0DTE rolls off and charm decays, labelled "projected" | TRACE 5-day forward projections ([TRACE guide](https://spotgamma.com/trace-user-guide)) | Lets a swing reader see the book after expiry. Slayer's Ahead covers only to today's close | Pinpoint Ahead | UI-only now | M |
| 9 | **Model choice, stated openly**: a switch between "every open contract, dealers short" and "as the flow classifies it", each with one line on what it assumes | SpotGamma Total OI vs Synthetic OI ([Equity Hub](https://support.spotgamma.com/hc/en-us/articles/1500003037862-What-is-Equity-Hub)); GEXBot naive vs classified volume ([glossary](https://docs.gexbot.com/glossary/)) | Both sell the choice as a tier. Optionomics says GEX "is an estimate" ([docs](https://docs.optionomics.ai/analytics/gamma-exposure/)). Fits Slayer's Observed/Calculated/Modeled split. Recipe stays private: name the assumption, not the weights | Pinpoint (all pages) | Toggle UI-only S. A real classified model needs live NBBO and trades: L | S → L |
| 10 | **The day's read, written**: a pre-open sheet generated from the engine (walls, flip, expected move, what built overnight, events), printable or copyable, plus an end-of-day "how the levels held" | SpotGamma Founder's Note and key levels set daily ([GEX Levels](https://gex-levels.com/blog/spotgamma-alternatives); [key levels](https://spotgamma.com/options-key-levels-explained/)) | Reviewers call SpotGamma's commentary "the benchmark" ([Trade Echo](https://tradeecho.com/best-gex-tools)). Slayer's Ahead and Targets already produce the numbers | Pinpoint Ahead (or a "Morning" page) | UI-only now (templated from the numbers; must describe, never instruct) | M |
| 11 | **Levels out to other charts**: copy today's levels as a Pine script, a TradingView "price lines" paste or CSV | MenthorQ levels sold inside TrendSpider and ATAS ([TrendSpider](https://trendspider.com/blog/menthorq-levels-indicators/); [ATAS](https://marketplace.atas.net/product/menthor-q-market-data-services)); GEXBot API ([docs](https://docs.gexbot.com/apidocs/)) | Traders execute on their own platform. Integrations are MenthorQ's distribution | Pinpoint, Terrain | UI-only now (clipboard or file) | S |
| 12 | **Explain-this assistant**: ask "why is 475 a wall?" from the command palette; it answers from the terminal's own numbers and the glossary, and declines trade calls | MenthorQ QUIN explains indicators, fetches data and runs gamma scenarios ([MenthorQ](https://menthorq.com/guide/ai-driven-trading-with-menthorqs-quin/)); UW "Mr. Whale" ([PurePowerPicks](https://purepowerpicks.com/unusual-whales-review/)); Cheddar AI ([pricing](https://www.cheddarflow.com/pricing/)) | AI is now a standard line item. QUIN's explain-and-scenario shape fits "a read". UW's education is rated weak (4/10, [DayTradingToolkit](https://daytradingtoolkit.com/reviews/unusual-whales-review)), so explanation is an opening | Command palette (global) | Needs an LLM backend: L. A static "explain" card from terms.ts is UI-only: S | S / L |
| 13 | **Scenario sliders on the book**: "if price is at X at 15:00 with IV −2 pts, where do the walls and the flip sit, and what must dealers trade" | QUIN's "scenario analysis on gamma exposure" ([MenthorQ](https://menthorq.com/guide/ai-driven-trading-with-menthorqs-quin/)) | Builds on Slayer's hedge-flow read ([hedgeFlow.ts](file:///home/user/3abida/src/data/hedgeFlow.ts)), which is distinctive. Gives a what-if without an instruction | Pinpoint Ahead / Map | UI-only now | M |
| 14 | **Earnings: straddle history**: per past report, the implied move vs the actual move, and what an ATM straddle bought before the report would have returned (labelled "projected" or "past") | Market Chameleon straddle performance and expected-vs-actual across quarters ([OptionsTrading.org](https://www.optionstrading.org/blog/market-chameleon-review/)) | Earnings Trader is a paid pack of its own at MC. Slayer already has impliedMovePct, pastMoves and ivRank ([earnings.ts](file:///home/user/3abida/src/data/earnings.ts)) | Dossier Earnings | UI-only now | S |
| 15 | **Volatility views per name**: IV rank and percentile, the term structure across expiries, and the 25-delta skew (put vs call IV) as a smile chart | Market Chameleon IV rank/percentile and term structure ([TradingToolsHub](https://tradingtoolshub.com/blog/market-chameleon-setup-guide-2026/)) | A basic for premium sellers and earnings traders. Slayer has the numbers in data files but no skew or term chart component was found | Weigher (contract/name panel); Dossier Stocks | UI-only now (simulated chain via weigherDesk) | M |
| 16 | **Target-to-strategy optimizer**: the reader sets a price and a date; the Weigher lists structures sorted by projected return or chance of profit at that target, without recommending any | OptionStrat Optimizer with chance of profit ([RealtimeOption](https://realtimeoption.com/compare/realtime-options-vs-optionstrat)) | OptionStrat's free hook. Slayer has the payoff builder and probability columns ([ChainGrid.tsx](file:///home/user/3abida/src/components/weigher/ChainGrid.tsx)). Compass's "contracts that fit the levels" is the level-driven twin. Wording must stay "projected", never "best" | Weigher | UI-only now | M–L |
| 17 | **Sortable flow table by name**: put share of premium, OTM share, average days to expiry, unusual OTM premium, and dark-pool block weight | InsiderFinance ticker table sorts and dark-pool "heat" ranking ([DayTradeReview](https://daytradereview.com/insiderfinance-review/)) | Cuts noise, the top complaint about flow feeds ([DayTradingToolkit](https://daytradingtoolkit.com/reviews/black-box-stocks-review)). Name the dark-pool column "weight" or "size", never "score" | Trace Screener / Dark Pool | UI-only now | S |
| 18 | **Deeper history and lookback** for flow and the book (months, not ~22 sessions) | Quant Data 21 months ([NexusFi](https://nexusfi.com/d/data-providers/quantdata/)); Optionomics 15+ years ([Optionomics](https://docs.optionomics.ai/getting-started/plans/)); GEXBot Quant 90-day downloads ([docs](https://docs.gexbot.com/apidocs/)) | Rivals tier on history depth. Slayer's simulator keeps ~22 sessions ([aheadHistory.ts](file:///home/user/3abida/src/data/aheadHistory.ts)) | Trace, Pinpoint, Practice Backtest | Needs live and stored data plus a backend | L |
| 19 | **Community room with a live session**: open the drawn Room; later, a scheduled "live read" in voice or text | BlackBoxStocks voice rooms in every tier ([BullishBears](https://bullishbears.com/black-box-stocks-review/)); MenthorQ Pro live sessions ([GEX Levels](https://gex-levels.com/blog/menthorq-alternatives)); SpotGamma Discord and webinars ([GEX Levels](https://gex-levels.com/blog/spotgamma-alternatives)) | Community is the main reason rivals give for upper tiers (MenthorQ Pro +$220/mo) | Community (exists, [Room.tsx](file:///home/user/3abida/src/pages/community/Room.tsx)) | Needs backend and moderation | L |
| 20 | **A learning path**: the existing per-page guides and terms.ts gathered into one "how to read the book" path with short replays of real moments (the landing's Session is the model) | MenthorQ academy and webinars ([MenthorQ](https://menthorq.com/academy/menthor-q-webinars/lessons/intraday-gamma-models-presentation/)); SpotGamma weekly webinars ([GEX Levels](https://gex-levels.com/blog/spotgamma-alternatives)) | UW's education is rated weak ([DayTradingToolkit](https://daytradingtoolkit.com/reviews/unusual-whales-review)). Gamma products need teaching to retain users | Settings/Help or a Practice tab | UI-only now | M |
| 21 | **Free account that sees something**: SPY-only Pinpoint levels, or a delayed tape | UW free features ([UW](https://unusualwhales.com/lp/unusual-whales-pricing)); OptionStrat 15-minute delay; InsiderFinance 30-minute/15 trades ([DayTradingz](https://daytradingz.com/insider-finance-review/)); Tradytics free scanner | Nearly every rival uses it as the way in. Slayer's account is already free ([billing.ts](file:///home/user/3abida/src/data/billing.ts)) | Plans / Settings | Gating UI now: S. Enforcement needs backend | S–M |
| 22 | **Annual billing** (12–25% off) on both plans | Cheddar Flow ~25%, OptionStrat ~12%, UW ~15%, InsiderFinance $55 vs $75 (sources in Q3) | The norm across rivals; absent from Slayer's PLANS | Landing pricing, Settings billing | UI-only now (copy and display); Stripe later | S |
| 23 | **API/MCP as a top add-on**, once data exists | UW public API and MCP ([UW](https://unusualwhales.com/public-api)); GEXBot Quant; SpotGamma Alpha API ([FlashAlpha](https://flashalpha.com/articles/spotgamma-data-via-api-migration-guide)); Quant Data API ([QD](https://quantdata.us/api)) | Always placed in the top tier, which makes it a pricing lever | Settings → Data | Needs backend | L |

**Where Slayer is distinctive and should lean in:**
- **Hedge-flow per path.** "A push to 462 forces about $180M of dealer selling" ([hedgeFlow.ts](file:///home/user/3abida/src/data/hedgeFlow.ts)). No rival surfaced a per-path dollar read. SpotGamma's HIRO measures hedging impact in real time, not "what a move would force". Ideas 13 and 8 extend this.
- **One terminal from read to practice.** Flow, levels, contract fit (Compass), payoff (Weigher), and paper money with prop-firm evaluations, backtest replay and a journal with MAE/MFE. No rival checked bundles prop-style evaluations. Rivals split flow (UW, Cheddar), levels (SpotGamma, MenthorQ) and strategy (OptionStrat).
- **A replayable book.** A 5-second-grid replay of levels, ladder and chain ([replay.ts](file:///home/user/3abida/src/data/replay.ts)). This matches Quant Data's slider and is ahead of daily-set levels (SpotGamma's levels "hold for the session").
- **Openness as voice.** Observed / Calculated / Modeled on the landing, plus idea 9. Rivals hide models (InsiderFinance "less transparency about its methodology", [Trade Echo](https://tradeecho.com/best-options-flow-tools)) or sell them as tiers.
- **Pine scripts with script alerts.** Most flow rivals rely on TradingView or TrendSpider integration instead (MenthorQ). Slayer runs scripts natively ([alertStore.ts](file:///home/user/3abida/src/components/gex/alertStore.ts) `script` kind).

**Plan mapping (inference):**
- **Pinpoint ($75)** competes with flow-only tools at $75–$99 while offering dealer levels. It could carry ideas 3, 7, 11 and 14 cheaply.
- **Compass ($180)** needs the "research layer" rivals charge $129–$349 for. Ideas 8, 10, 13, 16 and later 18 and 19 fit there.

**House-rule cautions:**
- Rivals' copy uses "signal", "AI trade ideas", "score" (InsiderFinance heat-score) and "market intelligence". Slayer must not.
- The assistant (12) and the optimizer (16) are the ideas most at risk of becoming instructions. Each must answer "what is", never "what to do".
- Futures-option gamma (MenthorQ's niche) is out of scope: Slayer removed futures on 2026-09-30.

### Gaps
- It could not be confirmed whether Slayer's Net Flow already has a whole-market aggregate line. The grep for "tide" matched only incidental words, so idea 4 needs a look at NetFlowPane.
- HIRO's 2026 "Charts and Canvas" release could not be read (login-gated), so the overlap with Slayer's hedge-flow and dealer-pressure views is unverified.
- No usage data shows which rival features are used most. "Valued" here rests on reviewers' emphasis and vendors' tier gating, not on surveys.
