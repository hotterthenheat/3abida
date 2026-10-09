# Onboarding, education, retention and plan packaging: ideas for Slayer terminal

Research pass of 2026-10-09. Scope: how trading and analytics products onboard, educate and retain users, and how they price plans. Each idea is turned into something Slayer could build.

Method note: about 16 web searches and fetches were run. Most direct page fetches were blocked by this environment's egress proxy: menthorq.com, support.spotgamma.com, tradervue.com, chartinglens.com and fca.org.uk. So most evidence below comes from search-result extracts of vendor pages and third-party reviews, not from reading the pages in full. Anything taken from prior knowledge and not verified in this pass is labelled "(unverified)" and listed under Gaps.

## What Slayer already has (from the repo, read 2026-10-09)

Read this first so that ideas are not proposed for things Slayer already does.

- **Journal (src/pages/review/JournalHome.tsx, JournalTrade.tsx; src/data/review/journal.ts)**
  - A calendar first. Period switch: today, week, month, year, all time. Account filter.
  - Four head figures, including "Won" (n of n with a %) and "Profit factor". A running-total curve and a per-day bar chart.
  - Six cuts: by hour entered, by weekday, by name, long or short, sizes of wins and losses, and by setup tag.
  - A trade grid with "Most against" and "Most for" columns, which are MAE and MFE in dollars.
  - On each trade page: a chart; "what was taken of the best" (per-trade exit efficiency); setup, mistakes and "plan followed yes/no" tags; and three prompts: why I took it, what I saw while in it, what I would do again.
  - Per-day plan and review notes. CSV export with all of the above.
  - Starter mistake tags: Chased it, No plan, Too big, Moved my stop, Cut it early, Held too long, Revenge trade, Broke my own rule.
- **Backtest Report (src/pages/review/Report.tsx; data/review/engine.ts cutsOf)**
  - Expectancy in $ and R, deepest fall, longest losing run and average time held.
  - Cuts that the Paper journal home does not have: days to expiry at entry, delta at entry, calls against puts, single contracts against spreads, how it ended, and four entry-hour buckets.
  - Session rules: max open, max risk per trade, daily stop.
- **Paper prop evaluations (src/data/paper/engine.ts)**
  - 50K, 100K and 150K plans with a target, max loss, day loss, contract cap, end-of-day trailing floor, 2 minimum days and a 50% best-day share.
  - Accounts pass, fail or are ended. Flat a minute before the bell.
  - A tilt manager exists (task #64 in the task list; not inspected).
- **Explainers**
  - src/data/terms.ts: a term dictionary behind dotted-underline Term tooltips, written in plain words, never the formula.
  - About 36 source files carry a "How to read" guide, for example the TraceGuide and ProfilePanel guides.
- **Targets agenda (src/data/agenda.ts)**
  - Answers "which levels do I watch today, in what order", ranked by reach × stake.
  - This is the natural seed for a pre-market brief.
- **Billing and plans (src/data/billing.ts)**
  - Pinpoint $75/month and Compass $180/month. Lifetime is "Custom" and appears only in Settings.
  - No trial: "an account is free and a plan is paid for" (the owner, 2026-10-01). No annual price is defined.
  - The landing's PLAN_ROWS put Pulse, Terrain, Pinpoint, Trace and Alerts in both plans. Compass, the Weigher, Dossier, Practice and Community ("soon") are Compass-only.
- **Community**: /community is "The traders' room. Coming soon." (PageMeta.tsx).
  - Per the task list, a Community room was once built: feed, following, setups, profiles, "market-graded setups". It was then taken out of the menu (#95).
- **Audit leftovers that touch this topic (docs/ux-audit-2026-10-09/WHAT-REMAINS.md)**
  - Guides and cards do not take or hold focus (X13).
  - The Community room behind "Coming soon" still takes focus (SH-16).
  - "Won %" and "The case: strong" are grade-like scales left to the owner (owner's call).
  - Wording such as "sample account" still leaks (X7).

---

## 1. How do TradingView, tastytrade, Option Alpha, Webull, Robinhood Legend, thinkorswim, SpotGamma and Unusual Whales onboard new users, and which patterns measurably improve activation?

### Takeaway
The leaders mostly do not run long coach-mark tours. They put a new user straight into a working, pre-built workspace (templates or sample layouts) or a risk-free practice account, and they link to a separate academy. The few published benchmarks put onboarding checklist completion low, around 10–25%. Finance software completes checklists more than other categories, so a short, task-shaped first session beats a feature tour. For Slayer, the strongest first session is "a desk that is already set up, a level named on it, and one thing to do with it", not a tour of eight rooms.

### Cited findings
- **Robinhood Legend**
  - On first entry the user picks "start from scratch" or "start from a layout template".
  - Robinhood says it built a range of templates "to help users get started". Any template can be changed by adding, removing, resizing or dragging widgets, and changes save automatically.
  - Layouts are capped: 9 in the US, 8 in the UK.
  - Source: [Robinhood: Layouts on Legend](https://robinhood.com/us/en/support/articles/layouts-on-legend/).
  - No guided walkthrough for Legend was found.
- **Option Alpha**
  - Onboards through pre-built bot templates that the user clones: "start with pre-built bot templates so you don't have to build strategies from scratch".
  - A 2026 review describes choosing and cloning a template and mentions a 30-day trial.
  - Sources: [Option Alpha toolbox](https://optionalpha.com/toolbox); [Strike.money review 2026](https://www.strike.money/reviews/option-alpha).
- **tastytrade**
  - New users are pointed to course "starter collections": basic options trades, opening and closing positions, and mobile trading.
  - The courses are reached by logging in with the tastytrade account. The free tastylive Learn Center covers options fundamentals and IV.
  - Benzinga says the library is mostly platform how-to and "assumes you already know what you're doing".
  - Sources: [tastytrade courses](https://courses.tastytrade.com/); [tastylive Learn Center](https://www.tastylive.com/learn); [Benzinga review](https://www.benzinga.com/money/tastyworks-review).
  - No step-by-step in-app onboarding sequence was found.
- **thinkorswim and Webull**
  - Both lead new users into a practice account: paperMoney (described as $100,000 in virtual funds) and paperTrade.
  - Webull pitches paperTrade as a way to learn "order execution, market analysis, portfolio management… before using real money".
  - Sources: [TradersPost on Schwab paperMoney](https://blog.traderspost.io/article/does-schwab-have-paper-trading); [Webull blog](https://www.webull.com/blog/206-How-to-Practice-Trading-with-a-Free-Paper-Trading-Stimulator).
- **MenthorQ**
  - Onboarding runs through an Academy with a "Getting started" track, including connecting your Discord account.
  - A free account gives "over 120 guides covering all products, live classes, and courses" on gamma levels, blind spots and trading plans.
  - Levels can be charted on TradingView through invite-only indicators.
  - Sources: [MenthorQ Onboarding lesson](https://menthorq.com/academy/getting-started/lessons/how-to-connect-your-discord-account/); [MenthorQ Academy](https://menthorq.com/academy/trading-with-menthorq/lessons/trade-with-menthorq/); [TrendSpider blog](https://trendspider.com/blog/menthorq-levels-indicators/).
- **SpotGamma** sells a free trial on Pro ("SpotGamma Pro (7-Day Free Trial)"). Its support centre documents the plans. Source: [SpotGamma Pro trial page](https://spotgamma.com/?p=2806).
- **Activation benchmarks**
  - Userpilot, 2024, 188 companies: average checklist completion 19.2%, median 10.1%. FinTech and Insurance had the highest average, 24.5%, about twice MarTech's 12.5%. Userpilot attributes this to the cost of mistakes in finance. Source: [Userpilot checklist benchmark](https://userpilot.com/blog/?p=197841).
  - Sources disagree on fintech activation: Userpilot's 2025 benchmark (547 SaaS companies) gives FinTech about 5% activation, against a 37.5% average. A 2026 Perspective AI report gives fintech a 44% median. Different definitions apply, and both are vendor reports. Sources: [Userpilot metrics](https://userpilot.com/saas-product-metrics/); [Perspective AI 2026 benchmark](https://getperspective.ai/blog/2026-customer-onboarding-benchmark-activation-rates-by-industry/markdown).

### Inferences (ideas for Slayer)
Each idea gives: what it is; who does it well; why it works; where it lives; whether it needs live data or a backend; and effort.

**1.1 "Start from a desk" chooser on first open (sample workspaces)**
- **What:** The first time Pulse opens, offer three or four named desks instead of an empty or default one: "The open, on SPY"; "0DTE afternoon"; "Earnings week"; "Flow first". Each is a Pulse preset plus a matching Terrain pane and Trace page. Each can be changed and saves itself.
- **Who:** Robinhood Legend's template-or-scratch choice; Option Alpha's clone-a-template.
- **Why:** It removes the blank-canvas cost. It is also the kind of short, task-shaped first step that completes far more often than a long checklist (10–25% completion above).
- **Where:** Pulse first run. Presets already exist (task #23), so this is mostly a chooser over existing presets.
- **Needs:** UI-only (localStorage flag for "seen").
- **Effort:** S.

**1.2 One-level first session ("find the wall")**
- **What:** A three-step, dismissible strip, not modal coach marks, on the first Pulse or Terrain visit:
  1. "This line is where dealer hedging is heaviest above price."
  2. "Hover it to read what sits there."
  3. "Set an alert on it."
- It ends when the alert exists, with a link: "See it on the Map."
- **Who:** This mirrors Slayer's own landing Session (three moments on SPY). No competitor was found doing this inside the product. That gap is an opening.
- **Why:** Activation should be defined as the first meaningful action (alert set on a level). Checklists of one or two items complete far better than long tours (Userpilot median 10.1%).
- **Where:** Terrain and Pulse, using the existing alerts.
- **Needs:** UI-only. A real "activation" count needs a backend later.
- **Effort:** S–M.

**1.3 Paper account opened for the reader**
- **What:** On first visit to Practice, open a paper account at a round size, with a one-line "Paper money: nothing here touches a broker", and offer the evaluation plans beside it.
- **Who:** thinkorswim paperMoney and Webull paperTrade.
- **Why:** Practice is the risk-free place where a first trade can happen on day one.
- **Where:** /paper.
- **Needs:** UI-only.
- **Effort:** S. It may already be close: the paper sample accounts exist, but X7 wording ("sample account") must go.

**1.4 "What am I looking at?" toggle per page**
- **What:** One keyboard shortcut and an icon that opens the page's existing "How to read" guide as an overlay pinned to the real elements, instead of a separate card.
- **Who:** Not found verified for any competitor (see Gaps).
- **Why:** On-demand help avoids tour fatigue.
- **Where:** All rooms. About 36 guides already exist. This also fixes the X13 focus issue if built as a proper dialog.
- **Needs:** UI-only.
- **Effort:** M.

**1.5 Define activation now, measure later**
- **What:** Write down Slayer's activation event, for example: an alert set on a level, plus one paper trade journaled with a setup tag, within 7 days.
- **Why:** The 5% vs 44% conflict above shows activation numbers are meaningless without a definition.
- **Where:** docs.
- **Needs:** backend for measurement.
- **Effort:** S (definition).

### Gaps
- No primary description was found of in-app guided tours in TradingView, Webull, thinkorswim, SpotGamma or Unusual Whales. Fetches to several of these were blocked, and searches returned marketing or support pages only.
- Prior knowledge, not verified in this pass:
  - TradingView runs feature-discovery tooltips and a large help centre.
  - Unusual Whales has an extensive in-app "?" and education section.
- No published A/B result specific to a trading product's onboarding was found. The activation benchmarks above are cross-SaaS vendor studies.

---

## 2. How do options-education leaders teach greeks, GEX and flow inside the product?

### Takeaway
The pattern is an academy next to the product, with lessons named after the product's own features ("How to use MenthorQ models", "Trading with MenthorQ"), plus levels pushed into the charting tool people already use. Teaching happens through the product's own levels (call resistance, put support, high-volatility level) rather than abstract greeks. Slayer can do this inside the terminal, where its "How to read" guides and Term dictionary already sit, without becoming a course site.

### Cited findings
- **MenthorQ**
  - Teaches through product-named lessons ("How to use MenthorQ Models: options screeners"; "Trading with MenthorQ"). Source: [MenthorQ Academy: screeners](https://menthorq.com/academy/how-to-use-menthor-q-models/lessons/how-to-use-menthorq-options-screeners/).
  - Defines its levels as "price zones derived from options positioning, showing where dealers may hedge aggressively". These are call resistance, put support and HVL, which "dictates the shift between positive and negative gamma".
  - Publishes a downloadable product-training PDF on gamma levels. Source: [MenthorQ Product Training: Gamma Levels (PDF)](https://menthorq.com/wp-content/uploads/2023/11/Product-Training-Gamma-Levels.pdf).
  - Has a guide titled "Building a trading routine with MenthorQ". The page could not be fetched. Source: [MenthorQ guide](https://menthorq.com/guide/building-a-trading-routine-with-menthorq/).
  - The Academy also spans basic technical analysis and options through to advanced strategies and futures (search extract).
- **tastytrade / tastylive**
  - Education is split: the brokerage's courses are platform how-to, and tastylive's free Learn Center covers concepts (options fundamentals, IV).
  - Content is labelled "for educational purposes only and is not investment advice".
  - Sources: [tastylive Learn Center](https://www.tastylive.com/learn); [tastytrade courses](https://tastytrade.com/courses).
- **SpotGamma**
  - Its top Alpha tier is where HIRO, the Volatility Dashboard, Tape and TRACE sit. Source: [SpotGamma promo/pricing page](https://spotgamma.com/?p=15598).
  - Education content (the SpotGamma Academy) is not described in what was retrievable.

### Inferences (ideas for Slayer)

**2.1 "Read it on today's chart" lessons**
- **What:** Five to eight short lessons. Each opens a real Slayer page at a frozen moment and asks one question:
  - "Where is the call wall?"
  - "Is price above or below the flip?"
  - "Which prints on this tape were sweeps?"
- The reader clicks the answer on the chart, and the lesson shows the page's own words for it. There is no quiz grade: the lesson says "That's it", or "Look a strike higher", and stays on the page.
- **Who:** MenthorQ's product-named lessons and levels training.
- **Why:**
  - Learning on the real surface transfers better than a separate course. This is a general learning-science principle and was not sourced in this pass.
  - The landing already uses frozen Session moments.
- **Where:**
  - A "Learn" tab in Practice, beside Paper, Backtest and Journal. The landing's session machinery (seeded clock, held moments) can be reused.
  - House rule: avoid "score"; say "Seen it", not "3/5 correct".
- **Needs:** UI-only. Simulated moments are fine because the UI never names them.
- **Effort:** M–L.

**2.2 A glossary page grown from terms.ts**
- **What:** A searchable glossary built from the existing TERMS dictionary: the call wall, the flip, GEX/DEX/VEX, charm, sweep, block, dark pool print, IV rank, expected move. Each entry links "See it in Pinpoint / Terrain / Trace".
- **Who:** tastylive Learn Center (concept library); MenthorQ's 120+ guides.
- **Why:** A glossary is cheap. It also gives the dotted-underline Terms a home a reader can browse.
- **Where:** /learn or Settings > Help. It reuses data/terms.ts.
- **Needs:** UI-only.
- **Effort:** S.

**2.3 Greeks felt, not defined**
- **What:** In the Weigher, a "what if" slider for price, time and IV that shows delta, theta and vega moving the payoff. A one-line caption names the greek that changed most: "Most of this came from time: theta."
- **Who:** Not verified for a specific competitor. Payoff "what-if" sliders are common in options analysers (prior knowledge).
- **Why:** It shows cause and effect instead of a definition.
- **Where:** The Weigher, which already has a payoff curve (task #75).
- **Needs:** UI-only. Wording must say "projected", per house rules.
- **Effort:** M.

**2.4 Levels into the reader's own chart (later)**
- **What:** Export of Slayer's levels to TradingView.
- **Who:** MenthorQ (invite-only TradingView indicators) and its TrendSpider integration.
- **Why:** Meets traders where they already chart.
- **Where:** Settings > Data / Integrations.
- **Needs:** live data and a backend (per-user entitlements). TradingView invite-only scripts need a publisher account.
- **Effort:** L.

### Gaps
- No verified description was found of SpotGamma Academy's structure, Unusual Whales' education pages, or tastytrade's in-platform greeks explainers. Fetches were blocked or search results were thin.
- No controlled evidence was found that in-product lessons raise retention for trading tools specifically.

---

## 3. Habit loops that are not gamified gambling: pre-market brief, end-of-day recap and weekly review

### Takeaway
The evidence favours goal-linked monitoring of one's own process, and cautions against engagement mechanics (points, prizes, streaks) that push trading frequency. Heavy trading is linked to lower net returns, and regulators have scrutinised "digital engagement practices". Slayer's habit loop should be read, plan, review: a calm pre-market brief built from the Targets agenda, a short end-of-day recap that asks the reader to compare the plan with what happened, and a weekly review. No streaks, confetti or leaderboards.

### Cited findings
- **Overtrading research**
  - Barber and Odean, 66,465 households, 1991–96: the most active traders earned about 11.4% a year against the market's 17.9%. The household average was 16.4%. Source: [Barber and Odean, "Trading Is Hazardous to Your Wealth"](https://faculty.haas.berkeley.edu/odean/Papers%20current%20versions/Individual_Investor_Performance_Final.pdf).
  - The most active fifth trailed the least active by about 5.5 points a year, attributed to overconfidence. Source: [Turtle Trader reprint](https://www.turtletrader.com/overconfident/).
  - Counterpoint: NBER w16022 argues frequent adjustment can be rational once adjustment costs are modelled. Source: [NBER w16022](https://www.nber.org/papers/w16022.pdf).
- **Planning vs monitoring experiment**
  - An FGV (Brazil) thesis randomly assigned day traders to planning, feedback, both, or control.
  - Only monitoring worked as a self-control mechanism, and only when tied to a goal.
  - Monitoring without a goal left traders loss-sensitive. Planning a daily gain target did not help. Forecasting from past returns raised overconfidence.
  - Source: [FGV repository: effects of planning and monitoring on day traders](https://repositorio.fgv.br/items/966012ba-28ca-499b-bbd9-2b3091e3aab8).
- **Self-control and the disposition effect:** a 2006 survey of 290 investors found that self-control lowered the disposition effect. Source: [JCIS-06 proceedings](https://download.atlantis-press.com/proceedings/jcis-06/96).
- **Regulatory scrutiny of engagement mechanics**
  - The SEC requested comment in 2021 on "digital engagement practices" including gamification. FINRA held a 2022 panel on gamification. Massachusetts filed a complaint against Robinhood over gamification.
  - Sources: [FINRA 2022 gamification panel (PDF)](https://finra.org/sites/default/files/2022-05/2022_AC_Gamification.pdf); [Southern California Law Review on Robinhood's DEPs](https://southerncalifornialawreview.com/2024/02/23/the-trading-game-an-analysis-of-robinhoods-use-of-digital-engagement-practices/); [BU Review of Banking & Financial Law](https://www.bu.edu/rbfl/?p=1553).
  - The UK FCA published an experiment on digital engagement practices in trading apps. Its findings could not be read; the fetch was blocked. Source: [FCA research note](https://www.fca.org.uk/publication/research-notes/research-note-digital-engagement-practices-trading-apps-experiment.pdf).
- **Routine as product:** MenthorQ publishes "Building a trading routine with MenthorQ", built around a routine rather than alerts to trade. Source: [MenthorQ guide](https://menthorq.com/guide/building-a-trading-routine-with-menthorq/). Content not fetched.

### Inferences (ideas for Slayer)

**3.1 Pre-market brief, "Before the open"**
- **What:** One page, readable in under two minutes, that opens before 09:30 New York:
  - the overnight move;
  - today's levels in order (agenda.ts: reach × stake);
  - where price sits against the flip;
  - the day's events (earnings and macro from Dossier);
  - the reader's own watchlist names with their nearest wall.
- It ends with a blank line for the reader's plan, saved as the day's Journal "plan" note.
- **Who:** MenthorQ's routine guide.
- **Why:**
  - The FGV result says monitoring works when it is goal-linked. Writing the plan sets the goal that the evening recap checks.
  - House rule kept: the brief reads levels and never says what to buy.
- **Where:** Pulse, as a desk or panel at the open, or a "Today" door in the rail. It writes to the existing per-day `plan` note (journal.ts DayNote).
- **Needs:** UI-only on the simulator. Email or push delivery needs a backend.
- **Effort:** M.

**3.2 End-of-day recap, "How the levels held"**
- **What:** After the bell:
  - which of the morning's levels were reached and which held or broke (Pinpoint's "How the levels held today" exists);
  - the reader's paper trades that day against their plan note, side by side;
  - one prompt: "Did you trade your plan?" (yes / partly / no).
- The answer writes to the day's `review` note.
- **Who:** Prop-firm dashboards (section 4) show day results. No retail options tool was found pairing levels-held with the reader's own plan. That gap is an opening.
- **Why:** It closes the loop the brief opened. This is goal-linked monitoring (FGV).
- **Where:** Journal day view plus Pinpoint Levels.
- **Needs:** UI-only.
- **Effort:** M.

**3.3 Weekly review, "The week, read back"**
- **What:** A Sunday page:
  - the week's paper result;
  - the three costliest mistake tags in $;
  - plan-followed days against not-followed days and their results;
  - the setups that paid and that cost;
  - one free-text "Next week I will…", shown back on Monday's brief.
- **Who:** Prior knowledge (unverified): TradesViz and TraderSync offer weekly and monthly reports, and Edgewonk centres a periodic "review" workflow. See section 4.
- **Why:** The weekly cadence fits trading's natural cycle and avoids daily-streak pressure.
- **Where:** Journal, as a "Week" period view with a review card.
- **Needs:** UI-only. An emailed version needs a backend.
- **Effort:** M.

**3.4 Explicit anti-patterns to write into the house rules**
- No streak counters, badges, confetti on a winning trade, leaderboards of P&L, or push notifications that nudge a trade.
- The Barber–Odean and regulatory evidence supports this. It matches the owner's partner's "too gamified" note.
- Effort: none.

**3.5 Calm "you've traded a lot today" read**
- **What:** When paper trades in a day exceed the reader's own 20-day median by a set multiple, show a neutral line in the Paper rail: "12 trades today; your usual is 4." No block and no colour alarm.
- It extends the existing tilt manager (task #64).
- **Why:** Barber and Odean on overtrading.
- **Needs:** UI-only.
- **Effort:** S.

### Gaps
- No controlled study was found showing pre-market briefs or recaps improve trader retention. The case rests on the goal-linked monitoring evidence and on product convention.
- The FCA experiment's effect sizes could not be read (blocked).
- FINRA and the SEC's 2025–2026 status on digital engagement rules was not established.

---

## 4. Journaling and analytics (TraderSync, Tradervue, Edgewonk, TradesViz) and prop-firm dashboards (Topstep, Apex, FTMO): what do the best journals show that Slayer's Journal does not?

### Takeaway
Slayer's Journal already covers much of what the paid journals sell:
- calendar P&L;
- setup and mistake tags;
- plan adherence;
- MAE and MFE per trade;
- hour, weekday and setup cuts;
- prompts;
- CSV export.

The gaps are mostly aggregation and options-specific context:
- the dollar cost of each mistake;
- playbooks with per-setup rules and stats;
- exit efficiency across trades;
- DTE, delta and IV cuts on the Paper journal (only the Backtest Report has them);
- where price stood against the dealer levels at entry, which is Slayer's unique angle;
- a rule-adherence trend;
- a prop-style progress panel on the Journal.

### Cited findings
- **MFE/MAE:** Tradervue lists MFE/MAE reporting, exit analysis and risk-exposure reports. TradesViz names MFE/MAE among its core metrics. No confirmation was found for Edgewonk or TraderSync. Sources: [Tradervue blog: best trading journals 2026](https://www.tradervue.com/blog/best-trading-journal); [TradesViz vs TraderSync](https://www.tradesviz.com/tradesviz-vs-tradersync/).
- **Pricing (2026, sources vary)**
  - Tradervue: Pro $29.95, Premium $49.95, Elite $79.95 a month (its own blog). Another page says $29–49.
  - TraderSync: $29.95–79.95 a month, with a 7-day trial and no real free tier.
  - TradesViz: a free tier (one source says 3,000 executions a month), paid from $14.99 a month billed annually, or $19.99–29.99.
  - Edgewonk: about $169–197 a year, desktop (Java), with a psychology "Tilt Meter" and a trade simulator.
  - Sources: [Traders' Second Brain comparison](https://traderssecondbrain.com/guides/best-trading-journal-comparison); [Tradervue alternatives](https://traderssecondbrain.com/guides/tradervue-alternative); [CrossTrade](https://crosstrade.io/alternatives/tradersync-alternative); [NYC Servers](https://newyorkcityservers.com/blog/best-trading-journal-apps).
  - Most of these are competitor-written.
- **AI features:** TraderSync's "Cypher" AI is top-tier only. TradesViz advertises "AI Query" and "AI Coach". Source: [TradesViz vs TraderSync](https://www.tradesviz.com/tradesviz-vs-tradersync/); [Traders' Second Brain](https://traderssecondbrain.com/guides/tradersync-alternative).
- **Topstep Combine**
  - Consistency rule: the best day may not exceed 50% of cycle profit. On a $50K account with a $3K target, that caps the biggest day at $1.5K.
  - A day counts toward minimum days only if it nets $150 or more.
  - Targets $3K/$6K/$9K and daily loss limits $1K/$2K/$3K for 50K/100K/150K. Max loss $2K/$3K/$4.5K.
  - Sources disagree on intraday against end-of-day trailing. Topstep changed rules and pricing in 2026.
  - Sources: [PropTradingVibes: Topstep consistency rule](https://proptradingvibes.com/blog/topstep-consistency-rule); [TradersPost](https://blog.traderspost.io/article/how-to-get-funded-with-topstep); [Curved Trading review 2026](https://curvedtrading.com/articles/en/reviews/topstep-review/); [Backtrex](https://backtrex.com/en/blog/topstep-futures-evaluation-rules).
  - Slayer's evaluation plans already mirror these numbers (engine.ts: the same targets, max losses and day losses, bestDayShare 0.5).
- **Journaling's evidence base:** goal-linked monitoring helped day traders in an RCT-style thesis. No controlled study shows journaling itself reduces the disposition effect. Source: [FGV thesis](https://repositorio.fgv.br/items/966012ba-28ca-499b-bbd9-2b3091e3aab8). The vendor claim that "average winner is 20–40% smaller than planned" is unverified. Source: [Day Trading Toolkit](https://daytradingtoolkit.com/psychology-and-risk/trading-journal-psychological-insights).

### Inferences: what Slayer's Journal lacks, as ideas

**4.1 Cost of each mistake**
- **What:** A "What your mistakes cost" lane: each mistake tag with its count and the sum of P&L on trades carrying it. Example: "Chased it · 7 trades · −$1,240".
- **Who:** Common across paid journals. The specific vendor implementation was not verified (prior knowledge: TraderSync and Edgewonk show mistake-tag stats).
- **Why:** It converts a tag into a number the reader feels. Goal-linked monitoring (FGV).
- **Where:** JournalHome lanes (beside "By setup"). The data exists (`mistakes` on JournalEntry).
- **Needs:** UI-only.
- **Effort:** S.

**4.2 Plan followed vs not**
- **What:** A two-row lane: trades with plan:yes against plan:no, with count, net and average.
- **Why:** This is the single strongest process feedback.
- **Where:** JournalHome. The data already exists (`plan: 'yes'|'no'`).
- **Needs:** UI-only.
- **Effort:** S.

**4.3 Options context cuts on the Paper journal**
- **What:** Bring the Backtest Report's cuts (days to expiry at entry, delta at entry, calls against puts, singles against spreads, how it ended) to the Paper JournalHome. Add an IV-at-entry bucket (ivIn exists on the trade).
- **Who:** Slayer's own Report does this. Generic journals are stock- and futures-centred (prior knowledge).
- **Why:** It is the options trader's real edge question ("my 0DTE trades lose; my 8–30 day trades pay").
- **Where:** JournalHome lanes. It reuses `cutsOf` in data/review/engine.ts.
- **Needs:** UI-only.
- **Effort:** S.

**4.4 "Where price stood at entry", Slayer's unique cut**
- **What:**
  - At fill, stamp each paper trade with its position against the dealer levels: above or below the flip, distance to the nearest call or put wall in % or in expected-move units, and positive or negative gamma regime.
  - Then add a cut: "Entered above the flip / below the flip / at a wall ±0.25%".
- **Who:** No journal found doing this. It is unique to a GEX terminal.
- **Why:** It ties the reader's own record to the terminal's read, which is the retention moat. It also stays a read, not an instruction.
- **Where:** Paper engine fill (data/paper/engine.ts) writes a context snapshot. JournalTrade shows it under "The trade". JournalHome adds a lane.
- **Needs:** UI-only on simulated levels. Real meaning needs live data.
- **Effort:** M.

**4.5 Exit efficiency across trades**
- **What:** Average "share of the best taken" (realised ÷ MFE) for winners, and "share of the worst taken" for losers, by setup.
- **Who:** Tradervue's "exit analysis" and MFE/MAE reports.
- **Why:** It shows whether exits or entries are the leak.
- **Where:** JournalHome lane or a Report-style row. The per-trade figure already exists (data/review/excursion).
- **Needs:** UI-only.
- **Effort:** S.

**4.6 Playbooks**
- **What:**
  - A setup tag becomes a playbook card: the reader's own written rules (entry, invalidation, target, size) and a checklist ticked at entry.
  - The card shows that playbook's count, net, average R, and "rules all ticked vs not".
  - The reader writes the rules. Slayer never ships rules, which keeps "a read, never an instruction".
- **Who:** Playbooks are a headline feature of TradeZella and TraderSync (prior knowledge, unverified in this pass).
- **Why:** It links planning to monitoring. The FGV result favours monitoring against a goal.
- **Where:** Practice > Journal > Playbooks. Paper's ticket offers "Playbook" as a dropdown that sets the setup tag.
- **Needs:** UI-only (localStorage).
- **Effort:** M.

**4.7 Mood or state tag (optional, one tap)**
- **What:** "Calm / rushed / tired / after a loss" on the trade page, with a cut.
- **Who:** Edgewonk's psychology focus and its "Tilt Meter".
- **Why:** Disposition and revenge trading are state-driven.
- **Where:** JournalTrade tags.
- **Needs:** UI-only.
- **Effort:** S.

**4.8 Rule-adherence trend**
- **What:** A small line across weeks: share of trades with plan:yes and no mistake tags.
- **Why:** It rewards process, not P&L, and is not a grade. Avoid the words "score" and "grade". Use: "Trades on plan: 14 of 18".
- **Where:** Journal week view.
- **Needs:** UI-only.
- **Effort:** S.

**4.9 Evaluation progress on the Journal (prop dashboard view)**
- **What:** For an evaluation account, a strip on JournalHome:
  - distance to target;
  - room to the max-loss floor (trailing);
  - today's room to the day loss;
  - days counted vs minimum;
  - best day as a share of profit vs the 50% cap.
- **Who:** Topstep, Apex and FTMO dashboards are built around exactly these rules (consistency 50%, minimum $150 days, daily loss, trailing max loss).
- **Why:** It makes the risk rules the reader's constant reference.
- **Where:** JournalHome head when the account filter is an evaluation. Paper desk rail if not already there.
- **Needs:** UI-only.
- **Effort:** S–M.
- **Note:** Slayer's minimum day counts any day traded. Topstep counts only days netting $150 or more. Consider a "qualifying day" threshold.

**4.10 Wording flags for the owner**
- JournalHome's "Won: n of n · %" and "Profit factor" sit close to the banned "win rate".
- Already listed as the owner's call in WHAT-REMAINS.

### Gaps
- Feature pages for TraderSync, Edgewonk and TradesViz could not be fetched. Tagging, playbook, replay and time-of-day details beyond the snippets above are from prior knowledge and marked unverified.
- Apex and FTMO 2026 rules were not retrieved. Only Topstep was covered, through third-party reviews.
- No Reddit review threads were retrieved in this pass.

---

## 5. Community features: which add value without becoming a signal room?

### Takeaway
The durable community value in trading products is (a) published reasoning attached to a chart, which TradingView requires and moderates, and (b) shared tools such as layouts, watchlists and scripts, rather than live trade calls. TradingView's house rules show the guard-rails that keep this from becoming a promotion or signal feed: reasoning required, no links or self-promotion, reputation cut for like-for-like schemes, hidden posts. Slayer's Community should start as "share a read or a desk", not a feed of calls, and needs a backend in any form.

### Cited findings
- **TradingView house rules**
  - All content bans advertising, links, company names, giveaways and solicitation. Premium, Expert and Ultimate subscribers may add links only in their signature.
  - Violating ideas are hidden, the reputation gained through them is lost, and warnings or bans may follow.
  - Source: [TradingView House Rules](https://www.tradingview.com/house-rules/); [Our House rules (support)](https://in.tradingview.com/support/solutions/43000591638).
- **Reasoning required:** "If the idea doesn't have any reasoning, then you probably shouldn't be posting it." Like-for-like and comment-for-comment schemes get a reputation cut. This comes from a community guide, not the official rules. Source: [TradingView community guide](https://kr.tradingview.com/chart/EURAUD/E7N2UEk4-Guide-How-to-post-awesome-ideas-and-get-lots-of-likes).
- **Publishing:** ideas can be published and updated through the publishing flow. Source: [Publishing and updating ideas](https://www.tradingview.com/support/solutions/43000591338-publishing-and-updating-ideas/).
- **Discord-integrated onboarding:** MenthorQ's "Getting started" includes connecting your Discord account. Source: [MenthorQ Onboarding](https://menthorq.com/academy/getting-started/lessons/how-to-connect-your-discord-account/).

### Inferences (ideas for Slayer)

**5.1 Share a read (a snapshot link)**
- **What:** A read-only link to a frozen Slayer view (a Terrain pane, Pinpoint map or Trace filter) with the reader's one-paragraph note. No price target or "buy" field, just "What I see".
- **Who:** TradingView ideas require reasoning attached to a chart.
- **Why:** Content tied to the product markets the product. Requiring reasoning keeps it a read.
- **Where:** A share button on page heads. Community later collects them.
- **Needs:** a backend to store and serve. A UI-only version can copy an address that rebuilds the view, since many pages already ride the address.
- **Effort:** S (address-only), L (hosted).

**5.2 Shared desks and watchlists**
- **What:** Export and import a Pulse desk or watchlist as a link or file. Later, a small curated gallery of desks by the owner.
- **Who:** Robinhood Legend layout templates; TradingView shared layouts (prior knowledge).
- **Why:** Tool-sharing carries no trade call.
- **Where:** Pulse presets; Settings.
- **Needs:** UI-only (JSON export; workspace JSON recall already exists, task #62). A gallery needs a backend.
- **Effort:** S / M.

**5.3 Shared Terrain scripts**
- **What:** A library where readers publish their own Terrain scripts, with a description required.
- **Who:** The TradingView Pine community (prior knowledge).
- **Needs:** backend.
- **Effort:** L.

**5.4 Community rules to write before launch**
These follow TradingView's model, adapted to Slayer's house rules:
- reasoning required;
- no entries, targets or "calls" fields;
- no P&L leaderboards;
- no links or self-promotion;
- no follower counts on the landing;
- moderation hides rather than deletes.

**5.5 Discord (later)**
- **What:** A role-gated Discord linked to plan status.
- **Who:** MenthorQ.
- **Why:** Discord is cheap to run but becomes a signal room by default, so it needs the same rules.
- **Needs:** backend (OAuth, role sync).
- **Effort:** M.

**5.6 Why the previously built Community idea was a risk**
- The past build's "market-graded setups" and an "R-based record" (tasks #47–48) drift toward a grade and track-record feed, close to banned words (grade) and to a signal room.
- If Community returns, prefer 5.1 and 5.2.

### Gaps
- Stocktwits, Unusual Whales' community and Discord-integrated flow tools were not researched with sources in this pass. There is no evidence here on which community features measurably lift retention.
- The full official TradingView house rules page sections on signals and paid groups were not read.

---

## 6. Pricing and packaging: how do competitors tier, and where does Slayer's $75 / $180 sit?

### Takeaway
Competitors mostly offer a free tier or a short trial, a 15–50% annual discount, and three or more tiers gated by capacity (charts, alerts, bots) or by flagship tools.

| Product | Price (2026, sources vary) | Annual or trial |
|---|---|---|
| Unusual Whales | about $50/mo | about $42/mo annually |
| SpotGamma | $89 / $129 / $249 a month on a promo page, or $99 / $299 on an older support page | annual discounts; 7-day Pro trial |
| TradingView | about $13 / $30 / $60 a month billed annually | prices raised April 2026 |
| Option Alpha | $99/mo annually or $149 monthly | free through some brokers |
| Journals | $15–80 a month | — |

Slayer's Pinpoint at $75 sits between Unusual Whales and SpotGamma's middle tier. Compass at $180 is below SpotGamma Alpha but bundles a journal, paper and prop evaluations that cost $15–80 a month on their own. Slayer has no annual price and no trial. Annual billing is the cheapest retention lever on the table.

### Cited findings
- **TradingView**
  - Annual prices: Essential about $12.95/mo ($155.40/yr), Plus about $29.95/mo ($359.40/yr), Premium about $59.95/mo ($719.40/yr).
  - Monthly list prices post-increase: Plus $34.95, Premium $69.95.
  - A reported increase on 10 April 2026 of about 17–20%.
  - Gating is by capacity: Essential 2 charts, 5 indicators, 20 alerts; Plus 4 charts, 10 indicators, 100 alerts; Premium 8 charts, 25 indicators, 400 alerts.
  - Sources conflict on annual totals (pre-increase Plus $299.40 and Premium $599.40).
  - Sources: [StockBrokers.com review](https://stockbrokers.com/review/tools/tradingview); [Liberated Stock Trader](https://www.liberatedstocktrader.com/tradingview-pricing-plans-costs-discounts/); [ChartingLens: price increase 2026](https://chartinglens.com/blog/tradingview-price-increase-2026); [Friend of the Trend plan comparison](https://friendofthetrend.com/tradingview/plan-comparison/).
- **SpotGamma**
  - A promo page lists Standard $89, Pro $129 and Alpha $249 a month, with Alpha at $2,241 a year. HIRO, the Volatility Dashboard, Tape and TRACE are Alpha-only. It is labelled a limited-time community offer.
  - The support centre lists Essential $99 and Alpha $299 a month with annual discounts.
  - Pro is offered with a 7-day free trial.
  - Sources: [SpotGamma pricing promo](https://spotgamma.com/?p=15598); [SpotGamma support: cost](https://support.spotgamma.com/hc/en-us/articles/1500002666102-What-is-the-cost-of-a-SpotGamma-Subscription); [Essentials vs Alpha](https://support.spotgamma.com/hc/en-us/articles/50272097356819-What-is-included-in-each-SpotGamma-subscription-plan-Essentials-vs-Alpha); [Pro trial](https://spotgamma.com/?p=2806).
  - A competitor's 2026 review lists the tiers. Source: [FlashAlpha review](https://flashalpha.com/articles/spotgamma-review-2026-pricing-features-alternatives).
- **Unusual Whales**
  - Base $50/month; annual about $42/month ("about 2 months free"; another page says about 15% off), which also locks the rate.
  - Pro and Max tiers exist; their prices were not found.
  - Limited free access with delayed data. No public lifetime plan.
  - Sources: [UW pricing](https://unusualwhales.com/lp/unusual-whales-pricing); [UW annual plan](https://unusualwhales.com/lp/unusual-whales-annual-plan-savings); [UW lifetime](https://unusualwhales.com/lp/unusual-whales-lifetime-deal).
  - These are vendor marketing pages.
- **Option Alpha**
  - Pro $99/mo on an annual plan or $149 monthly, 50 bots.
  - $0 through Tradier ($5K minimum), TradeStation ($10K minimum) and tastytrade, with an active integration required.
  - Seasonal 3-year Pro promos. A 30-day trial is mentioned by a review.
  - Sources: [Option Alpha pricing](https://optionalpha.com/pricing); [Labor Day 2026 3-year promo](https://optionalpha.com/s/upgrade-pro-3-year-labor-day-sale2026); [Strike.money review](https://www.strike.money/reviews/option-alpha).
- **Journals:** $15–80 a month; trials and free tiers vary. See section 4.

### Inferences (ideas for Slayer)

**6.1 Annual pricing**
- **What:** Show monthly and annual. Example: Pinpoint $75/mo or about $62/mo billed yearly; Compass $180/mo or about $150/mo billed yearly. That is roughly two months free, matching Unusual Whales' framing.
- **Who:** Every competitor above.
- **Why:** Annual prepay cuts monthly churn exposure and is the industry norm. It is also a price lock (UW says so explicitly).
- **Where:** Landing pricing (a monthly/yearly switch); data/billing.ts gets `yearly`; Settings > Billing.
- **Needs:** UI-only to show; Stripe for real.
- **Effort:** S.
- **Rule:** the currency line stays: "$62 USD / month, billed yearly".

**6.2 Keep "account free, plan paid", but give the free account something real**
- **What:** The owner chose no trial. Competitors use either a free tier (TradingView, TradesViz, UW's delayed data, MenthorQ's free academy) or a short trial (SpotGamma 7 days, TraderSync 7 days).
- Option within the owner's rule: the free account holds the Learn lessons (2.1), the glossary (2.2), Practice's Journal on CSV import, and one delayed Terrain pane. The paid plans unlock the live rooms.
- **Why:**
  - It gives a reason to sign up before paying.
  - The education-first funnel is MenthorQ's (free account with 120+ guides).
- **Where:** PLAN_ROWS gets a "Free account" column.
- **Needs:** backend for gating (later). UI-only for the column. Note that "delayed" wording must not imply the data is simulated.
- **Effort:** M.

**6.3 Price the gap between Pinpoint and Compass**
- **What:** $75 to $180 is a 2.4× step, with Practice (paper, backtest, journal), Compass, the Weigher and Dossier all held back.
- Options:
  - (a) Move the Journal and Paper into Pinpoint, since they are habit builders that retain, and keep Compass, the Weigher and Dossier as the upgrade.
  - (b) Sell "Practice" as a $15–25 add-on to Pinpoint. Comparable journals cost $15–80 alone.
- **Why:** Retention features belong in the entry plan. A habit loop that only the higher tier gets cannot hold the lower one.
- **Where:** PLAN_ROWS, billing.ts.
- **Needs:** UI-only for copy; Stripe add-on later.
- **Effort:** S.

**6.4 Capacity limits as the secondary gate, not features**
- **What:** If a tier ladder grows, gate by alert count, saved desks or Terrain panes (TradingView's model: 20, 100 or 400 alerts; 2, 4 or 8 charts) rather than by hiding rooms.
- **Why:** The reader sees every room, so there is less hidden value.
- **Where:** billing.ts.
- **Needs:** backend.
- **Effort:** M.

**6.5 Lifetime: keep it off the landing**
- UW explicitly offers no public lifetime plan.
- Lifetime caps revenue from a reader's most engaged years, and Slayer's data costs will be recurring once keys are in.
- Current state (off the landing, "Custom" in Settings) is consistent with this.

**6.6 Do not**
- No "most popular" badge (the owner's rule).
- No countdown promos. Option Alpha's seasonal promos exist, but they fit badly with Slayer's calm tone.

### Gaps
- Live pricing pages were not readable (blocked or not fetched), so every price above is from search extracts and may have changed. Confirm before quoting externally.
- Unusual Whales Pro and Max prices, MenthorQ prices, Webull and Robinhood Legend data add-on prices, and tastytrade's data and tool pricing were not found.
- No public churn or retention numbers for any of these products were found. The claim that annual plans reduce churn is industry convention here, not a sourced figure.
