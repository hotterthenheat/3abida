# Build trust and speed before the keys

Slayer's best next moves are not new data. They are a keyboard that reaches everything, reads that say what they stand on, and records that count the misses. All of that can be built today, UI-only, on the stand-in data. Six research passes, run on 2026-10-09, covered competitors, trader complaints, pro-terminal workflow, onboarding and retention, visualisation and speed, and the two vendors' APIs. They agree on one point. **The market does not lack data. It lacks meaning and trust.** Reviewers say flow feeds give "a massive amount of information" but are "noisy rather than predictive" ([Traders Agency](https://tradersagency.com/blog/unusual-whales-review)). They say GEX levels are "day-old" or hit "by chance" ([Trustpilot DK](https://dk.trustpilot.com/review/menthorq.com)). They say no vendor shows "the unseen denominator" ([ClaudeQuantAlgo](https://www.claudequantalgo.com/learn/unusual-options-activity/)). The research supports the ranked shortlist the owner already has. It keeps the first batch: the ⌘K command line, the "how sure is this" line, undo toasts and keyboard-first grids, then walls through the day, records with the misses counted, and the before-the-open brief.

It makes three changes, explained below:
- A "batch zero" comes first: rewrite the trade-call copy in Compass, Dark Pool and News. It is already on the audit list and costs days.
- The first step of item 14 (speed) moves up: measure a production build. Walls through the day adds drawing to a Pinpoint Map that the audit already found slow.
- Item 3 widens to cover the Trace print card: what else a print could be, and how unusual it is against the contract's own history.

Everything that needs the owner's Polygon/Massive and Unusual Whales keys waits for one more piece of work. That is a small proxy that holds the keys, plus a browser data worker. The provider layer that once pointed at those vendors was removed on 2026-09-30, and its "direct" mode would have shipped the keys to the browser.

## Batch zero: three files of copy break the house's first rule

Before any new idea, three strings in the source issue instructions, and they will survive the switch to live data because they are code, not data.

**Compass.** Its "why" text (`src/data/compass.ts:96`, `:101`) tells the reader dealers "must buy … forming an automatic protective floor under our entry". It also says to "Scalp the pop and take profit fast before theta bleeds the premium."

**Dark Pool.** Its reads (`src/data/darkpool.ts:158`, `:201`, `:208`) say "Trade the break", "Don't chase it", "Level becomes support" and "Rallies into the print price should struggle". They call a print "bought" or "sold" only from where it printed against spot and which way the session was going. There is no aggressor flag behind it.

**News.** A News playbook (`src/data/news.ts:235`) says "buy the first pullback".

The audit already lists all three (X8, CO-6 and the Dark Pool line in WHAT-REMAINS). They matter more than any new feature, for two reasons.

The first is regulatory. Slayer's safest US position is the "bona fide publication" exclusion upheld in *Lowe v. SEC* (1985): impersonal, regular, disinterested commentary ([Lowe v. SEC](https://chanrobles.com/usa/us_supremecourt/472/181/)). FINRA has acted against content that was not "fair and balanced" and "contained promissory language" ([FINRA Unscripted](https://www.finra.org/media-center/finra-unscripted/finfluencer-social-media-targeted-review)).

The second is that the fix is the house voice. Replace each order with:
- what was observed: "printed below spot in a rising session";
- what the model assumes: "under the usual dealer assumption, dealers would be short gamma here";
- what would change the read: "a close above 475 moves the call wall to 480".

The research also suggests a lint rule. Add "should", "must buy", "take profit", "entry" and "our" to the banned list (grade, score, win rate, signal as a trade call, guaranteed, confluence, market intelligence) and check every visible string against it. Two internal names, Dark Pool's `Grade` type and Compass's `score >= 88 ? 'ENTER'` with the Tracker's `scoreAtTrack`, are fine as code but must never reach a label. Effort: **S**. Closes **X8, CO-6** and the Dark Pool item.

A second set of fixes protects items 3 and 4 below. Both put Slayer's honesty on display, so the numbers under them must not contradict each other first:
- Pinpoint pages build books on different strike windows, so the call wall reads 480 on one page and 481 on another (X1).
- The Net GEX tooltip has its sign backwards (PP-3).
- Trace's P/C counts prints while its label says premium (TR-25).
- Every non-sweep print is a "block" (TR-26).
- Net Flow's net does not equal calls minus puts (TR-38).
- Compass computes "target hit" three ways (CO-1).
- New York and browser clocks are mixed (X2).

A "how sure is this" line sitting on a contradicted wall would undercut itself.

## Fifteen ideas to build now, in the order already given

The table keeps the owner's ranking. The recommended first batch is still 1, 3, 8 and 9, then 2, 4 and 5. Within that batch, the production-build measurement from item 14 (one day) now runs alongside item 2, for the reason given under item 2.

| # | Idea | Room | Effort | Audit items it closes or depends on |
|---|---|---|---|---|
| 0 | Rewrite trade-call copy; banned-word lint | Compass, Trace Dark Pool, Dossier News | S | Closes X8, CO-6, Dark Pool copy |
| 1 | ⌘K command line | Shell | M | Closes SH-1, the palette part of X13 |
| 2 | Walls through the day | Terrain (Pulse widget, Pinpoint) | M | Watch PP-5 |
| 3 | "How sure is this" line (plus the print card's "could also be") | Pinpoint, Terrain, Pulse, Trace | S–M | Needs X1, PP-3; uses the orphaned "Model error" term |
| 4 | Records with the misses counted | Pinpoint Levels, Trace Footprints | M (M–L for the flow ledger) | Offers the "N of M" answer to the owner's "Won %" call |
| 5 | Before-the-open brief, how-it-went recap | Pulse or Pinpoint Ahead, Journal | M | Needs X2, PR-1 |
| 6 | Journal cuts; Weigher shading, smile and term; OI change and max pain | Practice, Weigher, Pinpoint | S each; M for stamping and smile | Touches X9 and WE-2 in the Weigher |
| 7 | Alert lifecycle, notifications, spoken alerts, alerts on drawn lines | Alerts, Terrain, Settings | M (S, S, M–L) | Closes the drawer part of X13 |
| 8 | Undo toasts | Shell toast column, Pulse, Practice | S | Closes X5 (with PR-1) |
| 9 | Keyboard-first grids and layers | Every grid and overlay | M | Closes X6, TR-1, TR-2, X13, part of X4, L-2, SH-16 |
| 10 | Link groups A–D across the shell | Shell, Terrain, Pulse | M | None directly |
| 11 | Session strip and chart shading | Shell, Terrain, Paper | S–M | Builds on the X2 fix |
| 12 | "Read this" from templates | Terrain, Pinpoint, Compass | S | Continues the X8 voice |
| 13 | Colour-vision setting | Settings › Appearance | S | None |
| 14 | Speed: a store per key, a worker, batched grids | Global | M | Closes X1 (Pulse's 10 s panels), PP-5 |
| 15 | Annual pricing and plan contents | Landing, Settings | S | None; SE-1's billing buttons wait for a backend |

### 1. A command line that acts, not a launcher that navigates

**What it is.** Today's ⌘K palette (`src/components/layout/CommandPalette.tsx`) has three groups: Navigate, Ticker and Draw. The idea gives it Bloomberg's grammar:
- `NVDA FLOW`, `SPY LVL`, `QQQ CHAIN` and `AAPL ERN` open that room's page on that name;
- every page gets a two- or three-letter code shown beside it;
- saved Pulse desks and Terrain layouts appear by name, with codes the user chooses;
- an Actions group (theme, sounds, arm a price alert at a typed level, open the alerts inbox, export) and Recents.

**Why.** Bloomberg reaches every function by typing a mnemonic and `<GO>`. Its Autocomplete makes the terminal "entirely discoverable from the command line" ([Northwestern Bloomberg guide](https://files.library.northwestern.edu/ej/unrestricted/bloomberg_terminal/bloomberg_terminal_getting_started.pdf)). Koyfin gives every feature a two- or three-letter code behind `/`, and lets users code their own dashboards ([Koyfin help](https://www.koyfin.com/help/hotkeys-and-custom-shortcuts/)). One grammar reaches all eight rooms, which makes this the largest keyboard speed-up available.

**Room, effort and audit.** The shell; **M**. It closes **SH-1**: the highlight never scrolls, and after 25 presses the selected row is 920 px out of view. It also closes the palette's part of **X13**, which needs `role="dialog"`, a listbox, a focus trap and focus returned to the opener.

### 2. Walls through the day, drawn behind the price

**What it is.** A strike × minute heatmap of dealer gamma, with a lens switch for charm and DEX, painted as a lightweight-charts pane primitive behind Terrain's candles. A small dealer-positioning timeline (net GEX, net DEX and the flip through the session) reads the same snapshot buffer.

**Why.** This is the core idea of SpotGamma TRACE: gamma, delta-pressure and charm-pressure lenses, updated every minute ([TRACE user guide](https://spotgamma.com/trace-user-guide)). Quant Data sells the neighbouring "exposure over time", showing how greeks "build, shift, and decay throughout the trading day" ([Quant Data](https://quantdata.us/)). Slayer already has the strike axis, the per-expiry book and a 5-second replay (`src/data/replay.ts`). The ladder shows only "now", and this adds the day's time axis. Lightweight-charts v5 added pane primitives, so no second chart library is needed ([TradingView v5](https://www.tradingview.com/blog/en/tradingview-lightweight-charts-version-5-50837)).

**How to build it.** Draw it as one bitmap per minute column, never as DOM cells and never as a looping animation. Take colours from `heatmap.ts`'s token ramps, not bull/bear.

**Why measurement comes first.** The audit measured the Pinpoint Map, in a dev build, at **53 long tasks and 8.0 s of main thread in 20 idle seconds**, the longest 703 ms (PP-5). The cause is not yet known, so profile a production build before adding a per-minute buffer and a new paint layer. That measurement is item 14's first step, takes about a day, and is the one ordering change this report makes.

**Room and effort.** Terrain, with an optional Pulse widget; **M**. It works on the stand-in data today; with the keys it reads per-minute exposure from the measured chain.

### 3. Every dealer number says what it stands on, and every print says what else it could be

**What it is, on the dealer panels.** Pinpoint's, Terrain's and Pulse's dealer panels each get one plain assumption line: "Assumes customers sold the calls and bought the puts; dealers hold the other side." Each also gets a freshness stamp, such as "Open interest: last night's close · Volume: live, 2 s". Each wall's bar is split into settled OI and today's estimated build. An optional "if the sign is wrong" ghost marks where the walls and the flip would sit if the heaviest strikes were the other way.

**Why.** The sign assumption cannot be checked from public data. Exact dealer inventory "cannot be recovered" from public OI ([SpotGamma](https://spotgamma.com/what-is-gex-gamma-exposure/)). Cboe, which can see the positions, says outside estimates of dealer SPX gamma have ranged from "record short" to "long $50bn" and "are just estimates based on assumptions" ([Cboe](https://www.cboe.com/insights/posts/volatility-insights-evaluating-the-market-impact-of-spx-0-dte-options)). A 2026 comparison says MenthorQ does not disclose its refresh cadence or how fresh its OI is, "which makes intraday evaluation hard" ([TradeEcho](https://tradeecho.com/best-gex-tools)). Optionomics labels its own GEX "an estimate" ([Optionomics](https://docs.optionomics.ai/analytics/gamma-exposure/)). No rival found shows these things on the panel itself. The raw material is already in `data/terms.ts`, in the "Model error", "Hedge-flow" and "Provenance" entries. "Model error" has no use in any component.

**What it is, on the Trace print card.** The research adds the flow-side counterpart. A "could also be" line lists the alternative readings of a print (leg of a spread, hedge against stock, roll, closing), with evidence for and against each, and names no winner. A yardstick says what "unusual" is measured against: "3.1× this contract's 20-day volume; 1 of 214 prints today this far above its own norm".

**Why.** "A large call purchase can reflect a directional bet, a hedge, or part of a multi-leg trade" ([TradeAlgo](https://www.tradealgo.com/trading-guides/options/options-alert-services-which-ones-are-actually-worth-the-subscription-in-2026)). Vendors publish "scored" feeds without saying what the number means ([dxFeed](https://dxfeed.com/what-is-unusual-options-trading/)). `PrintDrilldown.tsx` already computes the usual-volume multiple and the spread position.

**Room, effort and audit.** Pinpoint, Terrain, Pulse and Trace. **S** for the lines and stamps, **M** for the sign-flip ghost and the print card. It depends on fixing **X1** (480 vs 481) and **PP-3** first. Every line is a disclosure of method, not a "simulated" disclaimer, so it fits the owner's wording rule.

### 4. Records that count the misses

**What it is.** Two records:
- "How the levels held today" (`WallReportCard.tsx`) extends to 20 sessions. Beside each level it shows how often an arbitrary strike the same distance from spot "held" under the same test: "held 14 of 20 tests; a strike as far away held 9 of 20".
- Footprints grows a follow-through ledger covering every print that cleared a filter, not only the ones the user marked. For each, it shows the underlying's move at +30 minutes, the close and +1 day, losers included, worded "moved the print's way by the close in 41 of 112". The full list is a click away.

**Why.** A MenthorQ reviewer put the objection in one line: with six levels, price will hit one by chance, so a hit proves nothing ([Trustpilot DK](https://dk.trustpilot.com/review/menthorq.com)). Flow services "surface a single hit and bury the rest" ([TradeIntelligent](https://tradeintelligent.substack.com/p/anyone-else-sick-and-tired-of-all)). These records are the most distinctive idea in the research and the hardest for incumbents to copy, because they expose the incumbents' marketing. The "N of M" wording is also a ready answer to the "Won %" question the audit left as the owner's call.

**Room and effort.** Pinpoint Levels and Trace Footprints. **M** for levels and **M–L** for the ledger.

**Two cautions.** First, the stand-in simulator keeps about 22 sessions (`data/aheadHistory.ts`). The records can be built and read now, but they carry weight only once real history flows (see "When the keys arrive"). Second, never use them in marketing. A promoted hit record is exactly the "performance-driven" content that weakens the publisher exclusion ([Sedric](https://www.sedric.ai/blog/influencer-compliance)).

### 5. A morning brief and an evening recap: read, plan, review

**What it is.** "Before the open" is a page readable in two minutes. It holds:
- the overnight move;
- the day's levels in order (`data/agenda.ts` already ranks them by reach × stake);
- price against the flip;
- the day's events;
- the reader's names with their nearest wall;
- a blank plan line that writes to the Journal's existing day `plan` note.

After the bell, the recap shows which levels were reached, held or broke, sets the day's paper trades beside the morning plan, and asks one question: "Did you trade your plan?" The answer writes to the `review` note.

**Why.** In a randomised study of day traders run at FGV in Brazil, **only monitoring tied to a goal worked as self-control**. Monitoring without a goal left traders loss-sensitive, and forecasting from past returns raised overconfidence ([FGV thesis](https://repositorio.fgv.br/items/966012ba-28ca-499b-bbd9-2b3091e3aab8)). Barber and Odean's 66,465 households show the cost of the alternative: the most active traders earned about 11.4% a year against the market's 17.9% ([Barber & Odean](https://faculty.haas.berkeley.edu/odean/Papers%20current%20versions/Individual_Investor_Performance_Final.pdf)). Reviewers call SpotGamma's daily written commentary "the benchmark" ([Trade Echo](https://tradeecho.com/best-gex-tools)). The brief is Slayer's own engine written down, not an analyst's opinion. No retail options tool was found pairing levels-held with the reader's own plan.

**Room, effort and audit.** Pulse or Pinpoint Ahead for the brief and the Journal for the recap; **M** each. Two audit fixes must land first. The brief is a New York document, so **X2** comes first. A recap that loses positions on reload is no recap, so **PR-1** comes first too.

### 6. The analytics bundle: Journal, Weigher, OI change and max pain

This rank holds three groups of small analytics. Each is cheap because the data already exists.

**Journal.** Four additions:
- a "what your mistakes cost" lane: "Chased it · 7 trades · −$1,240", from `mistakes` on each entry;
- plan-followed against not-followed, with count, net and average;
- the Backtest Report's options cuts (days to expiry, delta, calls vs puts, singles vs spreads) brought to the Paper journal, from `cutsOf` in `data/review/engine.ts`;
- the one cut no journal has: each paper fill stamped with where price stood against the flip and the walls, so "entered above the flip" becomes a lane.

The first three are **S** each and the stamping is **M**. Tradervue sells MFE/MAE and exit analysis at $29.95–79.95 a month ([Tradervue](https://www.tradervue.com/blog/best-trading-journal)). The level stamp is unique to a GEX terminal, and it ties the reader's own record to the terminal's read. That is the retention case.

**Weigher.** Three additions:
- shading the IV-implied price distribution under the payoff curve, with "chance price is above here" on hover. This is OptionStrat's builder pattern ([OptionStrat](https://optionstrat.com/tutorials/options-builder)). **S**.
- an IV smile for the chosen expiry beside an ATM-IV term line with event dates marked. Market Chameleon sells this in its earnings pack ([TradingToolsHub](https://tradingtoolshub.com/blog/market-chameleon-setup-guide-2026/)), and no Slayer room has it. **M**.

**Pinpoint.** Two additions:
- mirrored overnight OI change by strike on Building, after SpotGamma's Strike Plot of GEX, OI and Net OI ([SpotGamma](https://support.spotgamma.com/hc/en-us/articles/33607907909011-What-is-SpotGamma-TRACE)). **S**.
- max pain as a dashed line labelled for what it is, never a magnet. Its precedent at rivals was not verified. **S**.

**Wording.** Say "projected" and "chance price is above", never "probability of profit" in a way that reads as a win rate. Touching the Weigher is a chance to fix its 7.5 px tags (**X9**) and the off-screen watch column (**WE-2**).

### 7. Alerts that live past one firing and reach the reader

**What it is.** Four parts:
- **Lifecycle.** Alerts fire once and are re-armed by hand (`alertStore.ts`). Each gets a frequency (only once, every time, once per bar close, once per minute), an expiry (end of session, a date, never) and a snooze. The "Alerted" shelf becomes a stored, filterable log.
- **Browser notifications.** An off-by-default OS Notification when the tab is hidden. The drawer's foot, "Nothing is sent anywhere", stays true.
- **Spoken alerts.** The alert's own sentence read aloud through the browser's speech synthesis.
- **Alerts on drawn lines.** Touch, break or bounce on a Terrain trendline, plus AND across up to five conditions.

**Why.** TradingView's model is frequency, expiry, AND across five conditions and an Alert log ([TradingView](https://www.tradingview.com/support/solutions/43000474415-differences-between-alert-frequencies/); [multi-condition](https://www.tradingview.com/support/solutions/43000761492-multi-condition-alerts/)). TrendSpider alerts sit on drawn objects that move with the chart ([TrendSpider](https://help.trendspider.com/kb/alerts/types-of-alerts)). FlowAlgo's text-to-speech alerts were the one unique alert feature among the flow tools checked ([FlowAlgo](https://flowalgo.com/select-a-plan/)).

Slayer's alert conditions are already richer than any charting product's for options structure. There are nine kinds, including gexflip, wallmove, newsupreme, flow and script. An AND across them ("price above the call wall AND the flip turns") is something no rival offers. One note says Slayer has no flow alert. That is wrong: a `flow` kind with a premium floor exists. What is missing is the reason an alert fired and the collapsing of repeats ("+4 more").

**Room, effort and audit.** Alerts, Terrain and Settings. **M** for the lifecycle, **S** for notifications, **S** for speech, **M–L** for drawn-line and AND alerts. It closes the drawer's part of **X13**.

### 8. Undo instead of confirm

**What it is.** Delete desk, remove alert, clear the log, remove a watch, Flatten, New account and "Take them here" act at once, with "Undo" for about six seconds in the existing toast column.

**Why.** Response-time guidance holds that about 0.1 s feels instant and about 1 s keeps the train of thought ([Kent Beck on Nielsen](https://newsletter.kentbeck.com/p/the-precious-eyeblink)). A confirm dialog breaks a keyboard flow, and an undo does not.

**Room, effort and audit.** The shell, Pulse and Practice; **S**. It closes **X5**. Pair it with the **PR-1** fix: persist open paper positions and re-mark them on load, so a reload never closes a position or counts as an evaluation day.

### 9. Keyboard-first grids and layers

**What it is.** ↑/↓ and j/k walk the rows of every grid, Enter opens, Esc closes the top layer every time, `/` focuses the page's filter, and `?` shows the keys for this page.

**Why.** Hotkeys are the main reason day traders choose DAS, Lightspeed and Sierra ([finwiz](https://finwiz.io/day-trading/hotkeys-trading)). The audit found rows that open only by mouse in Trace, Pinpoint and the Compass Tracker. The house already has `ui/useFocusTrap.ts`, `focusBackForKeys` and a Modal, so one pass wires them in.

**Room, effort and audit.** Every grid (TraceGrid, DataTable, the AG Grid wrappers) and every overlay; **M**. It closes **X6, TR-1, TR-2, X13**, the focus-ring part of **X4**, and the stray focus stops **L-2** and **SH-16**. With items 1 and 8, it makes the terminal fast in the way pros feel, which the evidence says is input latency rather than render speed.

### 10. One linking model across the shell

**What it is.** Every panel that reads a name gets a link chip, ∅ or A–D. The global name becomes group A. Terrain already uses letters but links only the symbol, so it gains interval, date-range and drawing sync.

**Why.** Bloomberg Launchpad marks linked components with a group letter ([Launchpad guide](https://my.lerner.udel.edu/wp-content/uploads/BB-Getting-Started-in-Launchpad.pdf)). TradingView syncs symbol, interval, crosshair, time and drawings per layout ([TradingView](https://www.tradingview.com/support/solutions/43000629992-how-to-sync-the-charts-of-my-layout/)). Letters keep within the token-and-silver rule, with no new hues.

**Room and effort.** The shell, with Terrain and Pulse migrating; **M**. No audit item.

### 11. The session in every room

**What it is.** The Trader's Clock's phases (pre-market, open, lunch, power hour, close) are built but live only on Pinpoint's Map. Promote them to a thin strip beside the shell's clock. Add the after-hours state that `data/marketState.ts` lacks. Give Terrain and Paper charts optional shading for extended hours and lunch.

**Why.** thinkorswim builds in extended-hours highlighting. On TradingView, a popular community script shades the sessions, lunch included, and its author says it "should be built into TradingView" ([TradingView script](https://tradingview.com/script/7qMP6NVY-Daily-Session-Windows-background-highlight-indicator)).

**Room, effort and audit.** The shell, Terrain and Paper; **S–M**. Build it on the **X2** fix so every phase is New York time.

### 12. "Read this" from templates

**What it is.** A small control on a wall, the flip, a heatmap cell or a Compass card returns two to four sentences built from the terminal's own numbers: "475 has carried the largest call gamma since 11:20; it grew 18% in the last hour; price is 0.4% below it." Each figure links to its panel.

**Why.** Robinhood's Cortex Digests explain "why a stock is moving" ([Robinhood](https://robinhood.com/us/en/newsroom/digests-by-robinhood-cortex-uk)). Bloomberg's earnings summaries link each point to its transcript line ([Bloomberg](https://www.bloomberg.com/company/press/bloomberg-launches-ai-powered-earnings-call-summaries)). Slayer already writes such sentences in the landing session's `readings` and in BookRead.

**Room and effort.** Terrain, Pinpoint and Compass; **S** as templates now. A model can smooth the phrasing later, once a backend exists. It continues the X8 voice.

### 13. A colour-vision setting that changes shape, not only hue

**What it is.** Settings › Appearance offers "Standard / Blue–orange / High contrast", swapping the `--bull`/`--bear` tokens and adding a non-colour cue: hollow vs filled candles, ▲/▼ on figures, outlined vs filled bubbles.

**Why.** Futu pairs a pink-green scheme with hollow and solid candles so that direction never rests on colour alone ([Android Developers](https://developer.android.com/stories/apps/futu)). Red-green deficiency is the most common kind ([NCEAS](https://nceas.ucsb.edu/sites/default/files/2022-06/Colorblind%20Safe%20Color%20Schemes.pdf)).

**Room and effort.** Global; **S**. Each new pair must be re-checked against the paper theme's 4.3:1 direction-ink rule.

### 14. Speed: stop the fan-out, then move the maths

**What it is.** Four steps, in order:
1. Measure a production build. This step moves forward to sit with item 2.
2. Replace the single `marketData` context, which re-renders every consumer on each 1.5 s tick (`setInterval(processTick, 1500)`), with an external store read through `useSyncExternalStore` and per-key selectors, flushed once per animation frame and paused when the tab is hidden.
3. Move the exposure surface, the 10 s scans and seeded-history unpacking into a Web Worker.
4. Stream Trace's tapes with AG Grid's `applyTransactionAsync`, which batches updates in a 50 ms window and is built for "tens, hundreds or thousands of updates a second" ([AG Grid](https://www.ag-grid.com/react-data-grid/data-update-high-frequency/)).

**Why.** Yielding with `scheduler.yield()` keeps input responsive, but it "does not move work off the main thread". CPU-heavy work belongs in a Worker ([web.dev](https://web.dev/case-studies/pubconsent-inp)).

**Room, effort and audit.** Global; **M**. It closes **PP-5** and the Pulse part of **X1**, where panels refresh every 10 s while the rail ticks live, so one name shows several prices. It stays fourteenth for the UI work because the owner, as the only user, feels the keyboard items more. It becomes the first job once keys approach, because the live architecture below is this store and this worker.

### 15. Annual pricing and plan contents

Covered under "Pricing" below. **S** to show; Stripe later.

### Strong ideas outside the shortlist

The notes surfaced six more ideas worth naming. Each depends on a shortlisted item or returns less.
- **Copy today's levels** as a Pine script, a TradingView price-line paste or a CSV (**S**). MenthorQ distributes through TrendSpider and ATAS ([TrendSpider](https://trendspider.com/blog/menthorq-levels-indicators/)).
- **One watchlist of names**, with sections, flags and column views (**M–L**). It absorbs today's three separate "keep an eye on it" stores. TradingView sections ([TradingView](https://www.tradingview.com/support/solutions/43000615520-how-to-add-a-section-to-the-watchlist/)).
- **Pop-out windows** kept in step through `BroadcastChannel` (**M**). thinkorswim's Detach ([HaiKhuu](https://haikhuu.com/education/thinkorswim-multiple-monitors)).
- **A "start from a desk" chooser** on first open (**S**). Robinhood Legend's template-or-scratch choice ([Robinhood](https://robinhood.com/us/en/support/articles/layouts-on-legend/)). It beats tours: the median onboarding checklist completes at 10.1% ([Userpilot](https://userpilot.com/blog/?p=197841)).
- **A glossary page** grown from `data/terms.ts` (**S**).
- **Projected levels ahead**: where the walls stand at later opens as 0DTE rolls off (**M**). After TRACE's 5-day projections ([TRACE](https://spotgamma.com/trace-user-guide)).

## When the keys arrive: rebuild the boundary as a proxy, not a browser client

**The provider layer is gone.** It was built in commit `3642aaa` on 2026-09-21: a 46-group capability map, Massive and UW configuration and a Data sources page. It was dropped when the repo was replaced in `4acfed4` on **2026-09-30**. Today's tree has no `src/providers/`, no fetch or WebSocket client and no `.env.example`. Even at its peak it was a catalog plus a reachability check that fetched no market data.

**Its DIRECT mode cannot come back.** Its own config warned that Vite "INLINES every `VITE_`-prefixed variable into the shipped bundle". UW's socket also authenticates with `?token=` in the URL ([UW OpenAPI copy](https://github.com/DigiBugCat/unusual-whales-api-docs/blob/main/openapi-spec.yaml)), and Massive's socket authenticates with a message carrying the key ([client-python](https://github.com/massive-com/client-python/blob/master/massive/websocket/__init__.py)). A browser client would therefore expose both keys, against the house rule. The safe design keeps only the PROXIED route contract the old layer already defined (`<proxy>/polygon/<path>`, `<proxy>/unusualwhales/<path>`, `<proxy>/<provider>/socket`).

**What the proxy does.** It is a localhost Node or Bun server of roughly 50 lines to start, reading un-prefixed keys from `.env`.
- It opens one upstream socket per Massive cluster and one to UW, and ref-counts browser subscriptions.
- It filters UW's `option_trades` firehose, which runs to **6–10 million records a day**, down to the names in view.
- It reassembles UW's periscope stream. That stream arrives every 60 s, about 71 s behind its own timestamp, in 1,024-row chunks: 17 messages per SPX snapshot ([UW api-examples](https://github.com/unusual-whales/api-examples/blob/main/examples/ws-stream-periscope-greek-exposure/README.md)).
- It pages Massive's chain snapshot. Its `limit` defaults to 10 and caps at 250, so an unpaged SPY call silently returns ten contracts ([Massive OpenAPI](https://raw.githubusercontent.com/massive-com/client-js/master/src/openapi.json)).
- It respects the cap of 1,000 option contracts per quote connection ([Massive docs](https://massive.com/docs/websocket/options/quotes.md)).
- It caches, rate-limits with backoff on 429, and writes the NOI imbalance feed, periscope and GEX history to DuckDB or Parquet. NOI has no REST and no history, so capture is the only way to keep it.

**What the browser does.** A SharedWorker, falling back to a dedicated Worker, owns the one socket to the proxy, so tabs share a connection ([Pusher](https://pusher.com/blog/reduce-websocket-connections-with-shared-workers)). It decodes off the main thread, keeps the latest value per key and holds tape rows in a capped ring. It hands batches to item 14's per-key store, which flushes once per frame ([lilting.ch](https://lilting.ch/en/articles/us-stock-tick-websocket-feed)).

**Data rules.**
- Snapshot first, then deltas newer than the snapshot.
- Re-snapshot on reconnect, because replayed deltas double-count.
- Cache closed days in IndexedDB, which `scriptStore.ts` already uses.
- Never drop tape prints silently: mark "n prints skipped".
- Provenance needs a third state between "live" (a socket) and "measured" (a poll), an "as of 09:41" stamp for minute-behind feeds like periscope.
- The old Data sources page used the word "simulated". If it returns, it must be reworded to measured, live, projected and model.

**The order after the plumbing.**

First, the core product on measured inputs. Dealer exposure computed from Massive's chain, with IV, greeks and OI per contract. UW's live `gex_strike` streams. Then "exposure two ways": Slayer's own figure and UW's spot exposure on one ladder, with a band where they disagree. That is the Observed / Calculated / Modeled split made visible, and it answers the vendor-disagreement complaint directly.

Second, the tape on real prints, each with a spread bar (bid, the print, ask). UW's `flow-alerts` rail shows sides and evidence. It does not show UW's own `bullish`/`bearish` tags.

Third, the new surfaces, which then fill item 6:
- the volatility pack: IV rank, term structure, realised vol, risk-reversal skew;
- max pain and OI change;
- Market Tide;
- the economic calendar, which also feeds the morning brief;
- a VIX term strip.

Last, item 4's records become meaningful. A historical levels study replays past days from Massive's OPRA flat files (back to 2014, about 55–90 MB a day: an offline job, never a browser download) plus UW's date-parameterised exposure history.

Slayer already has screens for the tape, Net Flow, Dark Pool, Multi-Leg, Pinpoint and Dossier, so much of the work is plumbing plus provenance, not design.

**Open questions to test against the key.** Whether the owner's plans reach `/fed/v1/*`, short interest, filings and Benzinga. Which VIX indices the Indices plan carries. UW's published rate limits.

## Pricing: annual billing is the cheapest lever, and Compass needs a visible research layer

**Where the two plans sit.** Pinpoint at **$75** sits with flow-only tools, which run about $50–$100: Unusual Whales from about $50, Cheddar Flow at $85–99 ([Cheddar Flow](https://www.cheddarflow.com/pricing/)). Yet it holds dealer levels that rivals price at $99–$299. Compass at **$180** sits between SpotGamma's mid tier and Alpha at $299 ([SpotGamma support](https://support.spotgamma.com/hc/en-us/articles/1500002666102-What-is-the-cost-of-a-SpotGamma-Subscription)), and below MenthorQ Pro at $349 ([MenthorQ](https://menthorq.com/pricing/)). SpotGamma's prices conflict across sources ($89/$129/$299 on 2026 review pages, $99/$299 on its support page), so treat them as indicative.

**Recommendations.**
- **Add annual billing.** Every rival offers it at 12–25% off; Unusual Whales frames its annual plan as "about 2 months free" ([UW](https://unusualwhales.com/lp/unusual-whales-annual-plan-savings)). For Slayer that is about **$62 and $150 a month billed yearly**. Keep the currency line: "$62 USD / month, billed yearly". `data/billing.ts` has no yearly field today.
- **Give Compass's $105 step a visible research layer.** Compass already holds Compass, the Weigher, Dossier and Practice. Rivals charge $129–$349 for a written or modelled layer, and items 4 and 5 and projected levels are exactly that.
- **Move the habit builders into Pinpoint.** Put Journal and Paper in Pinpoint, or sell Practice as a $15–25 add-on. Stand-alone journals cost $15–80 a month, and a habit loop only the upper plan gets cannot hold the lower one.
- **Give the free account something real, without a trial.** Keep the owner's "account free, plan paid", but the free account should hold the glossary, the lessons and SPY levels, the way MenthorQ's free account carries 120+ guides ([MenthorQ Academy](https://menthorq.com/academy/trading-with-menthorq/lessons/trade-with-menthorq/)). Any "delayed" wording must never imply the data is not real.
- **Keep the existing rules.** No data add-on fees: MenthorQ reviewers complain about paying extra for real-time ([Trustpilot](https://www.trustpilot.com/review/menthorq.com)). No "most popular". No countdown promos. Lifetime stays off the landing.

## Ideas to avoid or handle with care

**An LLM assistant.** MenthorQ's QUIN ([MenthorQ](https://menthorq.com/guide/ai-driven-trading-with-menthorqs-quin/)) and UW's MCP endpoint make one tempting, but it needs a backend. Robinhood's Cortex explicitly includes "trade suggestions" ([Tech.eu](https://tech.eu/2025/08/19/robinhood-launches-stock-picking-ai-summaries/)), the counter-example to avoid. Build the template version (item 12) now. When a model arrives, give it only computed facts, put a source chip on every sentence, and reject imperative verbs and banned words.

**A strategy optimiser.** It slides easily into "best" ([OptionStrat](https://optionstrat.com/tutorials/options-builder)). Sort by projected return at a target the reader chose, never rank.

**Community, Discord and shared ideas.** Without rules these become a signal room. The earlier "market-graded setups" and "R-based record" build already drifted toward a grade. If Community returns, start with "share a read" (a reasoning-required snapshot) and shared desks, under TradingView-style rules ([TradingView House Rules](https://www.tradingview.com/house-rules/)). Both need a backend.

**Streaks, badges, confetti and P&L leaderboards.** The SEC sought comment on "digital engagement practices", FINRA ran a gamification panel ([FINRA](https://finra.org/sites/default/files/2022-05/2022_AC_Gamification.pdf)), and Massachusetts filed a complaint against Robinhood over them ([SCLR](https://southerncalifornialawreview.com/2024/02/23/the-trading-game-an-analysis-of-robinhoods-use-of-digital-engagement-practices/)). A calm "12 trades today; your usual is 4" line is the most the evidence supports.

**Marketing on records, and "for you" tuning.** Promoted records are promissory. Tuning reads to a user's account moves Slayer from publication toward advice, and the Weiss Research case shows the risk of wiring a read to execution ([Cahill memo](https://www.cahill.com/publications/firm-memoranda/0000001/_res/id=Attachments/index=0/CGR%20Firm%20Memo%20-%20In%20the%20Matter%20of%20Weiss%20Research%20Financial%20Newsletter%20Publisher%20Sanctioned%20as%20an%20Unregistered%20Investment%20Adviser.pdf)). Paper stays paper.

**Smaller traps.**
- Vendor words like "heat-score", "end-of-day flow prediction" and "chance of profit" need renaming to "weight", "projected" and "chance price is above".
- A 0DTE "squeeze" story is disputed by research. Dim, Eraker and Vilkov find 0DTE volume shocks do not amplify returns ([WFA](https://westernfinance-portal.org/viewpaper?n=950096)).
- Max pain must never be drawn as a magnet.
- A Sankey suits time-sensitive flow poorly.
- Commercial GPU chart libraries and canvas grids are overkill. Slayer's heatmaps are about 10⁵ cells, and AG Grid already virtualises.
- Futures-option gamma is out of scope, since futures were removed on 2026-09-30. A display-only overnight futures strip is the limit.

## Where Slayer already leads, and should lean in

**Hedge-flow per path.** "A push to 462 forces about $180M of dealer selling" (`data/hedgeFlow.ts`) is a "what a move would force" read no rival surfaced. SpotGamma's HIRO measures hedging impact as it happens ([SpotGamma](https://spotgamma.com/hiro-indicator/)), not ahead of a move. Scenario sliders and projected levels extend it.

**Read to practice in one terminal.** Slayer joins what rivals sell apart: flow (UW, Cheddar), levels (SpotGamma, MenthorQ), strategy (OptionStrat) and journals (Tradervue). No rival checked bundles prop-style evaluations, and Slayer's already mirror Topstep's targets, loss limits and 50% best-day rule ([PropTradingVibes](https://proptradingvibes.com/blog/topstep-consistency-rule)).

**A replayable book.** Its 5-second replay is ahead of levels set daily that "hold for the session" ([SpotGamma](https://spotgamma.com/options-key-levels-explained/)).

**Evidence on the print card.** It shows the fill against the spread, a plain-words vol/OI read ("new positioning rather than someone closing out"), reconstructed multi-leg trades, Footprints follow-through and "How the levels held today". Together these already answer more of the "data without meaning" complaint than most rivals.

**Openness.** The landing's Observed / Calculated / Modeled split matches a direction the field is moving in. SpotGamma and GEXBot sell model choice as a tier ([GEXBot](https://docs.gexbot.com/glossary/)).

**Native scripts and options-aware alerts.** Script alerts run in the terminal itself, and the alert conditions cover walls, the flip and the supreme strike, with no charting-platform integration.

Items 3 and 4 and "exposure two ways" are the lean-in. They turn openness from a landing line into something on every panel.

## Gaps and source limits

**Blocked sources.** The network proxy blocked direct reads of unusualwhales.com and its API docs, massive.com, tradingview.com, reddit.com, x.com, trustpilot.com (snippets only), sec.gov, flashalpha.com, menthorq.com, SpotGamma's support centre, tradervue.com and fca.org.uk. Consequences:
- There are no verbatim Reddit or X quotes. Trader sentiment comes from reviews, many of them affiliate or competitor pages.
- Vendor API facts come from the vendors' official GitHub catalogs (Massive's client-js OpenAPI spec synced 2026-09-23; UW's uw-mcp "verified in CI" endpoints of 2026-08-19).

**Prices.** Several prices conflict or are unconfirmed:
- UW's Pro and Max tiers;
- GEXBot (no official dollar prices found);
- SpotGamma, Market Chameleon, BlackBoxStocks and Tradytics, which differ by source;
- Cboe's Open-Close data fees, from a 2023 filing summary.

**Unverified claims.**
- The max-pain precedent at rivals.
- Cboe's 2025–2026 0DTE share figures.
- Snooze, notification inboxes and density settings: no trading-platform source was found, so they rest on general UX practice.
- Plan entitlements for Massive's Fed, short-interest, filings and Benzinga routes.
- UW's rate limits and history depth.

**Judgement, not data.**
- No vendor publishes usage data, so "valued" rests on reviewers' emphasis and tier gating, and every ranking here is judgement.
- Slayer's own capabilities were checked by reading the code, not by running the app.

**Corrections to the notes.**
- One note said Slayer has no flow alerts. `alertStore.ts` has a `flow` kind with a premium floor.
- Another counted ten alert kinds. There are nine.

**Not researched.** The regulatory reading is not legal advice. Non-US regimes and the SEC Marketing Rule's reach over a non-adviser's "levels held" record were not researched.

## Conclusion

The research points to a different first moat from the one the keys suggest. Every rival will plug into the same OPRA tape. Almost none will show how its levels did against chance, what its exposure assumes, or how fresh its inputs are, because doing so exposes their own marketing. Slayer can build that honesty now on stand-in data, so that the day the keys go in, the first real numbers arrive already wearing their assumption, their timestamp and their record.

The order follows from that. First, the copy that gives orders and the code that contradicts itself. Then the keyboard and undo work that makes one owner fast. Then the reads that state what they stand on. The live layer comes last, built as a proxy and a worker so that no key ever reaches the page and no tick re-renders the whole terminal.
