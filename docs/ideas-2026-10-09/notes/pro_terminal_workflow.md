# Pro terminal workflow and interaction patterns Slayer could adopt

Scope: how TradingView, thinkorswim, Bloomberg (Launchpad), Koyfin, TrendSpider, Bookmap, Sierra Chart, DAS/Lightspeed and
tastytrade handle workspaces, linking, keys, pop-outs, sync, alerts, watchlists, notifications, session awareness, speed
and phones. Each is set against Slayer's code as of 2026-10-09. Slayer evidence is cited by repo path (read-only; nothing was
edited). Web sources are a mix of vendor help centres (preferred) and third-party guides (flagged). Several vendor pages
are 1–3 years old, so menu paths may have moved. Each idea in the last section is written in the house's words: no trade
calls, none of the banned words, nothing that says the data is simulated, and every colour a token.

## 1. Workspaces, symbol linking, hotkeys and command lines, pop-outs, layout sync: how do the platforms do it?

### Takeaway
Every serious platform lets you save a whole multi-window arrangement under a name and link panels into GROUPS that follow
one symbol. thinkorswim uses colours, Bloomberg and Slayer's Terrain use letters, and TradingView uses emoji. Each also
offers a typed command path to any function: Bloomberg's `TICKER <type> FUNCTION <GO>`, and Koyfin's `/` plus a 2–3 letter
code, with user-assigned codes for saved dashboards and templates. Pop-out windows for a second monitor are standard on
desktop apps (thinkorswim Detach, Bookmap detached tabs). Hotkeys run from fixed lists (tastytrade, Bookmap) up to fully
remappable, scriptable systems (Sierra Chart, DAS).

### Cited Findings
**Workspaces and layouts**
- TradingView: you can sync symbol, crosshair, interval, time and date range across the charts of one layout. — [TradingView support: How to sync the charts of my layout](https://www.tradingview.com/support/solutions/43000629992-how-to-sync-the-charts-of-my-layout/)
- TradingView's Trading Platform library shows up to 8 charts in one layout and lists the same sync set. — [TradingView charting-library docs: Multiple-chart layout](https://www.tradingview.com/charting-library-docs/latest/trading_terminal/multiple-chart-layout/)
- TradingView's recipe for "same symbol, different timeframes": keep Symbol sync on and turn Interval sync off. — [TradingView support: same symbol at different time frames](https://www.tradingview.com/support/solutions/43000762821-how-to-display-the-same-symbol-at-different-time-frames/)
- TradingView: drawings sync only between charts showing the same symbol. — [TradingView support: sync layout](https://www.tradingview.com/support/solutions/43000629992-how-to-sync-the-charts-of-my-layout/)
- Bookmap: a workspace stores your subscribed symbols with their settings, and the app reopens the most recent workspace by default. Heatmap settings can be saved globally or per workspace. — [Bookmap KB: Open the main window](https://bookmap.com/knowledgebase/docs/KB-GettingStarted-OpenMainWindow); [Bookmap: heatmap settings](https://bookmap.com/learning-center/getting-started/liquidity-heatmap/heatmap-settings)
- Koyfin: dashboards can be named and given a custom shortcut (example "DBOLL"), then loaded by typing `/` twice and the code. Chart templates can carry shortcuts too (example "fcsp"). — [Koyfin help: Hotkeys and custom shortcuts](https://www.koyfin.com/help/hotkeys-and-custom-shortcuts/)
- Koyfin "My Views": a saved column set and table settings, reusable across watchlists and dashboard widgets. Each watchlist can link to its own view. — [Koyfin release v3.12: My Views](https://www.koyfin.com/help/release-notes/release-v3-12/)
- Koyfin dashboards can be organised into groups. — [Koyfin help: My Dashboards groups](https://www.koyfin.com/help/my-dashboards-groups/)

**Symbol linking**
- thinkorswim: a colour-coded "clipboard" icon on each component opens a colour-and-number menu. Components sharing a colour follow one symbol. The manual suggests linking the watchlist to the chart and Dashboard, so a click on a watchlist row drives them. — [thinkorswim manual: Watchlists](https://toslc.thinkorswim.com/center/howToTos/thinkManual/Left-Sidebar/Watch-Lists); [thinkorswim manual: Interactive elements](https://toslc.thinkorswim.com/center/howToTos/thinkManual/Getting-Started/Interactive-Elements)
- thinkorswim flexible grid: set several chart cells to the same colour (for example red), and a ticker change in one updates all of them. Picking a different colour breaks the link. — [toshelper: Flexible grid](https://www.toshelper.com/thinkorswim-setting-flexible-grid/) (third party)
- Bloomberg Launchpad: components are grouped in the Group Manager, and changing the security in one updates the others. Each linked component wears a group LETTER (A, B, C). There are Security groups (one item) and Monitor groups (a watch list; these link only to a News panel). — [Lerner/UDel: Bloomberg Launchpad Getting Started](https://my.lerner.udel.edu/wp-content/uploads/BB-Getting-Started-in-Launchpad.pdf); [IIMA Launchpad guide](https://library.iima.ac.in/public/download/bloomberg/launchpad.pdf) (university guides, about 2013–2018)
- TradingView: symbol and interval sync can be split into separate groups, and charts marked with the same emoji sync together. — [TradingView support: sync layout](https://www.tradingview.com/support/solutions/43000629992-how-to-sync-the-charts-of-my-layout/)
- Koyfin: widgets in a dashboard group are linked, so changing the selection in one changes it in the others. Widgets set to "My Watchlists" are the exception. — [Koyfin: custom dashboards](https://www.koyfin.com/features/custom-dashboards/); [Koyfin help: MyWatchlists](https://www.koyfin.com/help/mywatchlists/)

**Hotkeys and command lines**
- Bloomberg: every function is reached by typing its mnemonic then `<GO>` (for example `WEI <GO>`). Security functions take the security first: `IBM US <EQUITY> GP <GO>`. — [Bloomberg Terminal primer (SAFE Frankfurt)](https://datacenter.safe-frankfurt.de/documents/Bloomberg_Terminal_primer.pdf); [Univ. Ljubljana: security functions](https://vodici.cek.ef.uni-lj.si/bbg-eng/navigating-database/security-functions)
- Bloomberg Autocomplete: type a keyword on the command line and it lists matching functions, which makes the terminal "entirely discoverable from the command line". The command line sits at the top of every panel and runs on the active panel. — [Northwestern: Bloomberg Terminal getting started](https://files.library.northwestern.edu/ej/unrestricted/bloomberg_terminal/bloomberg_terminal_getting_started.pdf); [Kent: Bloomberg Terminal Guide](https://blogs.kent.ac.uk/kbs-news-events/files/2017/10/Bloomberg-Terminal-Guide.pdf)
- Koyfin: every left-nav feature has a 2–3 letter code (MYW = My Watchlists, MP = Model Portfolios). `/` opens the box where you type the code. — [Koyfin help: Hotkeys and custom shortcuts](https://www.koyfin.com/help/hotkeys-and-custom-shortcuts/)
- Sierra Chart: per a user forum, you can make a hotkey for nearly every feature and setting (Global Settings, custom trading shortcuts). — [Optimus Futures community](https://community.optimusfutures.com/t/how-do-i-trade-using-hotkeys-with-sierracharts/2965) (forum, about 7 years old)
- DAS Trader Pro: hotkeys become scripts once "Hotkey Advanced Script" is on. Scripts address windows by unique names, and can size from price, a preset risk amount and a stop offset. — [Guardian Trading: DAS advanced hotkey scripting](https://www.guardiantrading.com/how-to-prepare-your-das-trader-pro-for-advanced-hotkeys-scripting/); [Bear Bull Traders forum: most used hotkeys](https://forums.bearbulltraders.com/topic/1607-most-frequently-used-hotkeys/)
- Lightspeed: sources disagree on whether its hotkeys match DAS's scripting. One comparison says it lacks advanced scripting, another says it supports advanced configurations with variable sizing. — [finwiz: hotkeys](https://finwiz.io/day-trading/hotkeys-trading); contradicted by [TradeAlgo: hot keys guide](https://www.tradealgo.com/trading-guides/day-trading/hot-keys-for-day-trading-speed-execution-setup-guide-for-every-platform)
- tastytrade (web platform) hotkeys open order tickets, change quantity and price, move between fields and submit. — [tastytrade: platform hotkeys](https://support.tastytrade.com/support/s/solutions/articles/43000460772)
- tastytrade has a one-step "Quick Roll" alongside the full Roll ticket for options positions. — [tastytrade: Quick roll vs roll](https://support.tastytrade.com/support/s/solutions/articles/43000435416)
- Bookmap: shortcuts are listed in Settings and edited by double- or right-clicking a row. 7.6 added shortcuts to toggle the heatmap and set keys per time slice. — [Bookmap release notes](https://bookmap.com/knowledgebase/docs/KB-ReleaseNotes)

**Pop-out and multi-monitor**
- thinkorswim: each grid's menu has "Detach", which opens the grid as its own window to move to another monitor. — [HaiKhuu: thinkorswim multiple monitors](https://haikhuu.com/education/thinkorswim-multiple-monitors) (third party)
- Bookmap: instrument tabs can be detached into separate windows. — [Bookmap release notes](https://bookmap.com/knowledgebase/docs/KB-ReleaseNotes)
- Bloomberg's command line `LLP` opens the Launchpad version of a function, so it can sit as a component in a Launchpad view. — [Lerner/UDel Launchpad guide](https://my.lerner.udel.edu/wp-content/uploads/BB-Getting-Started-in-Launchpad.pdf)

**Layout and preference sync across devices**
- thinkorswim: watchlists, scans and preferences from desktop or web appear on the phone. The platforms "dynamically sync up with each other". — [Schwab: thinkorswim mobile](https://www.schwab.com/trading/thinkorswim/mobile-app)
- thinkorswim App Store notes: account-sorting choices sync with other devices, Desktop and Web. — [App Store: thinkorswim](https://apps.apple.com/us/app/thinkorswim-trade-invest/id299366785)

**Slayer today (code)**
- Pulse desks: named saved layouts, three presets (Market Structure, Flow, 0DTE), autosave, and reset to template. Each widget is either linked to the terminal's one global name or pinned to its own. — [src/pages/workspace/desks.ts](../../src/pages/workspace/desks.ts)
- Terrain: up to 4 panes, link groups by LETTER (∅ → A → B), symbol only, with crosshair sync between live panes. Up to 12 named layouts, which refuse rather than evict at the cap. — [src/pages/terrain/Terrain.tsx](../../src/pages/terrain/Terrain.tsx) (lines ~135–138, 1247–1257, 2476–2510); [src/pages/terrain/layouts.ts](../../src/pages/terrain/layouts.ts)
- Command palette (Ctrl/⌘K): three groups only, Navigate (rooms and sub-pages), Ticker ("Set ticker → X") and Draw (arm a drawing tool). No actions, recents or saved-layout entries. — [src/components/layout/CommandPalette.tsx](../../src/components/layout/CommandPalette.tsx)
- Keyboard map in Settings › Keyboard. Global: Ctrl K, ↑/↓, Enter, Esc. Terrain: 1–4, [ ], Shift R, F, S, C, ↑/↓, −/=, P, D, R, Alt R. Desk/Paper: Space, ←/→, End, N, T. Journal: ←/→, Esc. Script editor: Ctrl S, Ctrl Enter. Not remappable. — [src/pages/settings/Settings.tsx](../../src/pages/settings/Settings.tsx) (lines ~122–181)
- No pop-out: no `window.open` or `BroadcastChannel` outside the landing. — grep of `src/`
- Cross-device: Settings › Data offers Export/Import of what is kept on this machine (a file). — [src/pages/settings/Settings.tsx](../../src/pages/settings/Settings.tsx) (~709–740)

### Inferences
- Slayer has the parts but in two dialects. Terrain has letter groups but they carry symbol only. Pulse has a single global link. The other rooms (Weigher, Pinpoint, Compass, Trace, Dossier) follow the one global name. Best in class is ONE linking model across the shell: Bloomberg's letters fit the house rule (Terrain's comment already says "Letters, not colours").
- TradingView's sync matrix (symbol, interval, crosshair, time range, drawings) is the clearest model for Terrain. Slayer is missing interval sync, date-range sync and drawing sync.
- The palette is a launcher, not a command line. The Bloomberg and Koyfin pattern is "TICKER + function", plus short codes and user-named codes for saved things. That is the biggest keyboard gap.
- Pop-outs are cheap in a browser (a second window on the same origin, kept in step with `BroadcastChannel`), and they give one user with two monitors a lot.

### Gaps
- I found no official documentation of TradingView's colour or emoji group count, or of how TradingView layouts sync between web, desktop and mobile.
- Bloomberg's current (2025–2026) Launchpad UI and its linking colours were not confirmed. The sources are older university guides.
- Lightspeed's current scripting abilities are disputed (see above).
- I found no primary source on Sierra Chart Chartbooks (its workspace unit).

## 2. Alerts, watchlists, notification centres and session-time awareness: how do the best platforms design them?

### Takeaway
Best-in-class alerts share three traits. They have a trigger-frequency model (only once, every time, once per bar close,
once per minute), an expiry, and AND across conditions (TradingView: up to five). They can be attached to drawn objects
that move with the chart (TrendSpider: touch, break-through or bounce on trendlines and moving averages). They write to an
alert LOG as well as a toast, and on the brokers' platforms they reach the phone by push. Watchlists have sections, colour
flags, custom columns and saved column views. Session awareness is mostly chart shading of extended hours: built into
thinkorswim, and done by community scripts on TradingView, which shows real demand.

### Cited Findings
**Alerts: conditions, frequency, expiry, delivery, history**
- TradingView frequencies: Only once, Once per bar, Once per bar close, Once per minute for interval-dependent alerts (drawings, indicators). Plain price alerts get Only once or Every time. — [TradingView: alert frequencies](https://www.tradingview.com/support/solutions/43000474415-differences-between-alert-frequencies/); [TradingView: once-per-bar missing](https://www.tradingview.com/support/solutions/43000690908-why-is-the-once-per-bar-option-missing/)
- TradingView: the alert's name is the title shown in the Alert manager, the toast notification and the Alert log when it fires. — [TradingView: configure alerts](https://www.tradingview.com/support/solutions/43000763312-learn-how-to-configure-alerts/)
- TradingView: standard alerts run for at most two months, and Premium/Ultimate can be open-ended. Alerts over a year old that neither fired nor were edited are switched off. — [TradingView: Introduction to alerts](https://www.tradingview.com/support/solutions/43000520149-introduction-to-tradingview-alerts/). A ClearEdge guide's claim that server-side alerts never expire conflicts with this. — [ClearEdge: alert limits](https://www.clearedge.trading/post/tradingview-alert-limits-plan-restrictions)
- TradingView multi-condition alerts: up to five conditions, firing only when all are true at once (Plus and up). — [TradingView: Multi-condition alerts](https://www.tradingview.com/support/solutions/43000761492-multi-condition-alerts/)
- TradingView webhook deliveries have no retry, so a failed endpoint loses the alert. — [Ontology: webhook guide 2026](https://blog.ontologytrading.com/tradingview-webhook-setup-guide-from-alert-to-live-broker-order-2026/) (third party)
- TrendSpider Dynamic Alerts sit on trendlines, moving averages, Bollinger Bands and levels, and adjust as price moves. Triggers are Break-through, Touch or Bounce. Multi-Factor alerts fire when all conditions across timeframes are met. You set them by right-clicking the level and choosing trigger, buffer zone, sensitivity and time period. — [TrendSpider help: Alerts](https://help.trendspider.com/kb/alerts); [TrendSpider: alert types](https://help.trendspider.com/kb/alerts/types-of-alerts); [TrendSpider: Alerts product page](https://www.trendspider.com/product/alerts.php)
- TrendSpider delivery is reported as push, email, SMS and in-app, running in the cloud with no browser open. Reviews differ on the exact channels. — [optionstrading.org review 2026](https://www.optionstrading.org/reviews/trendspider/); [Medium review](https://medium.com/the-investors-handbook/trendspider-review-advanced-technical-analysis-made-easy-50aca4e0d005) (third party)
- thinkorswim alerts can be tracked and changed on mobile. Push to phone is switched on in desktop Application Settings › Notifications. — [App Store: thinkorswim](https://apps.apple.com/us/app/thinkorswim-trade-invest/id299366785); [useThinkScript: phone alerts](https://usethinkscript.com/threads/how-to-receive-thinkorswim-alert-notifications-via-phone.5430/) (forum)
- Bloomberg's mobile app lists alert pages among its featured functions (MLRT, NLRT, ALRT). — [Google Play: Bloomberg Professional](https://play.google.com/store/apps/details?id=com.bloomberg.android.anywhere&hl=en_US)

**Watchlists**
- TradingView sections: add one by right-clicking a symbol. Sections can be named, moved and deleted, sorting happens within a section, and symbols drag between sections. — [TradingView: add a section](https://www.tradingview.com/support/solutions/43000615520-how-to-add-a-section-to-the-watchlist/); [TradingView blog: new watchlist features](https://www.tradingview.com/blog/en/new-watchlist-features-21389)
- TradingView: table or rows view, a choice of symbol elements (logo, ticker, description), column widths and click-to-sort. Flag colours: one source says 7 and TradingView's plan table says 5. — [TradingView: Mastering watchlists](https://www.tradingview.com/support/solutions/43000745825-mastering-the-tradingview-watchlists/); [chartwisehub guide 2026](https://chartwisehub.com/tradingview-watchlist-tutorial/) (third party; flag count conflicts)
- TradingView watchlist alerts: one alert condition over a whole list. — [financialtechwiz: alerts 2026](https://www.financialtechwiz.com/post/how-to-set-alerts-on-tradingview/) (third party)
- Koyfin: columns are picked from a Columns icon and saved automatically. Right-clicking a header renames, sorts or removes it. Custom formula columns are supported, and Shift selects many rows. — [Koyfin: watchlists](https://www.koyfin.com/features/watchlists/); [Koyfin help: MyWatchlists](https://www.koyfin.com/help/mywatchlists/)
- thinkorswim: custom watchlist columns built on desktop show up in the mobile app. — [Hahn-Tech: thinkorswim mobile watch list](https://www.hahn-tech.com/thinkorswim-mobile-watch-list/) (third party)

**Session-time awareness**
- thinkorswim has a built-in "Highlight Extended-Hours Trading session" (a fixed grey, per forum users) and "Show Extended-Hours Trading session" on intraday charts. Users report gaps on tick and range charts. — [NexusFi thread](https://nexusfi.com/showthread.php?p=500811); [useThinkScript: extended-hours highlighter](https://usethinkscript.com/goto/post?id=127354) (forums)
- TradingView: a popular community script shades premarket, core session, LUNCH HOUR and extended session separately, with a US preset and per-weekday toggles. Its author says this "should be built into TradingView". — [TradingView script: Daily Session Windows](https://tradingview.com/script/7qMP6NVY-Daily-Session-Windows-background-highlight-indicator)
- Schwab gives the pre-market, after-hours and overnight session windows thinkorswim trades in. — [Schwab: after-hours and overnight trading on thinkorswim](https://www.schwab.com/learn/story/after-hours-and-overnight-trading-on-thinkorswim)

**Slayer today (code)**
- Alerts: 9 kinds (price, level, indicator, gexflip, newsupreme, wallmove, flow, news, script). Each fires once (`firedAt`) and is re-armed by hand from the fired record. A script alert never fires twice on one bar. — [src/components/gex/alertStore.ts](../../src/components/gex/alertStore.ts) (lines ~73–238)
- The Alerts drawer is translucent and covers any page, with an "Alerted" shelf and Clear. Its empty state reads "Nothing has alerted … while this tab has been open", and its foot says "Runs while this tab is open. Nothing is sent anywhere." — [src/components/alerts/AlertsDrawer.tsx](../../src/components/alerts/AlertsDrawer.tsx) (~316–352)
- Toasts: one chip at the top right for five seconds, and a click opens the drawer. Paper fills share the column. — [src/components/alerts/AlertToasts.tsx](../../src/components/alerts/AlertToasts.tsx)
- No browser `Notification` API, no snooze or expiry field, no AND across kinds (from a grep of alertStore and the alerts components).
- Watchlists come in two kinds. Weigher's watched contracts are marked at add-time and tracked like positions ([src/types/watchlist.ts](../../src/types/watchlist.ts), [src/data/watchlist.ts](../../src/data/watchlist.ts)). Trace bookmarks cover print, contract and structure ([src/context/WatchContext.tsx](../../src/context/WatchContext.tsx)), and Compass has its own Tracker ([src/pages/Tracker.tsx](../../src/pages/Tracker.tsx)). I saw no sections or flags.
- Session: the market state kinds are open, pre-market, closed, early-close and holiday. There is no after-hours kind ([src/data/marketState.ts](../../src/data/marketState.ts) line 24). The Trader's Clock (78 five-minute blocks with named hedging phases, lunch and the close among them) lives only on Pinpoint's Map ([src/components/gex/TraderClock.tsx](../../src/components/gex/TraderClock.tsx), used in [src/pages/pinpoint/MapDesk.tsx](../../src/pages/pinpoint/MapDesk.tsx)). The shell has a running session clock and an open/close bell ([src/components/ui/SessionClock.tsx](../../src/components/ui/SessionClock.tsx), [src/components/layout/MarketBell.tsx](../../src/components/layout/MarketBell.tsx)).

### Inferences
- Slayer's alert CONDITIONS are richer than TradingView's for options structure: walls, flip, supreme strike, flow and scripts. Its alert LIFECYCLE is thinner: once only, no frequency or expiry, no AND, no snooze, a log scoped to the tab, and no OS-level notification when the tab is hidden. The lifecycle can all be built UI-only now.
- The Trader's Clock is a unique, already-built session model, but it is stuck on one page. Promoting it to the shell (a thin strip) and to Terrain (session shading) would spread session awareness across every room. TradingView users had to script this themselves.
- Three separate "keep an eye on it" stores (Weigher watch, Trace bookmarks, Compass Tracker), and no name-level list with sections or flags, is the clearest coherence gap against TradingView and Koyfin.

### Gaps
- I found no vendor documentation of a "snooze" control on TradingView, thinkorswim or TrendSpider alerts. Snooze is a common notification pattern, but I could not cite a trading platform for it.
- I found no source describing a unified notification CENTRE (inbox) on these platforms beyond TradingView's Alert log and Bloomberg's ALRT/NLRT pages.
- Watchlist heatmaps (colouring rows or tiles by change) were not covered by any source I found.
- I found no primary source for thinkorswim's session-shading menu path (forums only).

## 3. What makes a terminal feel fast?

### Takeaway
Perceived speed comes from a few things. Feedback lands within about 100 ms of every input. Work stays under about 1 s so
thought is not broken, and longer work shows progress. Local actions are optimistic. Keyboard flows skip the pointer
entirely: hotkeys are the main reason day traders choose DAS, Lightspeed and Sierra. Slayer already does skeletons,
pagination and repaint discipline. Its gaps are keyboard row navigation and the palette's reach.

### Cited Findings
- Nielsen (1993, building on 1968 work): about 0.1 s feels instant, about 1 s keeps the train of thought, and about 10 s loses attention, so longer waits need progress feedback. — [Kent Beck: The precious eyeblink](https://newsletter.kentbeck.com/p/the-precious-eyeblink); [jmduke: response times](https://www.jmduke.com/posts/response-times.md) (secondary accounts of Nielsen)
- Doherty threshold, about 400 ms (Doherty and Thadani, IBM, 1982). Better read as a historical heuristic than a hard law. Recommended methods: optimistic UI, skeleton screens, progressive loading, and a visual cue within 100 ms. — [atticusli glossary: Doherty threshold](https://atticusli.com/behavioral-science-glossary/doherty-threshold/); [dev.to: Doherty's threshold](https://dev.to/rjzauner/ux-toolbox-doherty-s-threshold-3bo)
- Hotkeys cut order entry time. A common set is buy, sell/flatten, set stop, cancel all, plus scale-out scripts (sell half, move the stop). One guide's "150–200 ms vs 2–3 s" figure is unverified. — [finwiz: hotkeys](https://finwiz.io/day-trading/hotkeys-trading); [TradeAlgo: hot keys](https://www.tradealgo.com/trading-guides/day-trading/hot-keys-for-day-trading-speed-execution-setup-guide-for-every-platform) (third party)
- Koyfin and Bloomberg make every function reachable by typing (see section 1). Bloomberg's Autocomplete makes the command line the discovery surface. — [Koyfin hotkeys](https://www.koyfin.com/help/hotkeys-and-custom-shortcuts/); [Northwestern Bloomberg guide](https://files.library.northwestern.edu/ej/unrestricted/bloomberg_terminal/bloomberg_terminal_getting_started.pdf)
- Slayer's existing speed rules: no endless background, shadow or SVG animation; seeded history packed and built on read; long Trace grids paged at 80 rows; AG Grid modules trimmed. — [/home/user/3abida/.claude/CLAUDE.md](../../.claude/CLAUDE.md) ("Speed rules (2026-09-30 perf pass)")
- Slayer's audit lists the keyboard gaps: rows open by mouse only (Trace, Pinpoint, Compass Tracker, X6), ↑/↓ only on Live Tape (TR-1), Esc fails to close the card (TR-2), the search box's highlight scrolls out of view (SH-1), and the search box, alerts drawer, cards and guides do not take or hold focus (X13). — [docs/ux-audit-2026-10-09/WHAT-REMAINS.md](../../docs/ux-audit-2026-10-09/WHAT-REMAINS.md)
- Slayer's audit also flags Pulse panels refreshing every 10 s while the rail and chart are live, so one name shows several prices (X1). That reads as lag or inconsistency rather than speed. — [WHAT-REMAINS.md](../../docs/ux-audit-2026-10-09/WHAT-REMAINS.md)
- Slayer's audit also lists confirm/undo gaps (Flatten, delete desk and others, X5). — [WHAT-REMAINS.md](../../docs/ux-audit-2026-10-09/WHAT-REMAINS.md)

### Inferences
- For Slayer the "fast" wins are keyboard and consistency, not raw render. They are: j/k or ↑/↓ plus Enter on every grid, Esc closing the top layer every time, the palette doing actions, and one price per name per moment.
- Undo beats confirm for speed. An undo toast for destructive desk actions (delete desk, clear alerts, Flatten in Paper) keeps a keyboard flow unbroken and still addresses audit X5. This is the optimistic-UI pattern applied to local state.
- Density: Slayer's audit flags tiny type on desk (X9) and controls under 44 px on phone (X3). A compact/comfortable density token set, compact by default on a desk and comfortable under touch, would fix both with one switch. This is my inference; I found no vendor source (see Gaps).

### Gaps
- I found no vendor documentation of a compact/comfortable density setting on these platforms. Searches on density returned nothing citable.
- I found no source on Linear-style local-first or optimistic architectures (the search returned nothing on it).
- I found no measured latency budgets published by the platforms themselves.

## 4. What do phone companion apps do well, and which subset of the desktop belongs on a phone?

### Takeaway
Phone companions are for MONITORING and RESPONDING, not building. That means watchlists (with the desktop's custom columns),
alerts and their pages, news, positions and orders, and portfolios or worksheets. Their strength is that the desktop's setup
follows the user there. For Slayer, the phone subset is: the watchlist, the alerts inbox, the day's levels for the active
name (Pinpoint), the Compass Tracker, Dossier news and earnings, and Paper positions. Terrain's four panes, script editing,
the Backtest and desk building stay on the desktop.

### Cited Findings
- Bloomberg Professional app: news, Instant Bloomberg, messages, markets, security data, portfolios, worksheets, alert pages (MLRT, NLRT, ALRT), customisable alerts, and the ASKB assistant. Bloomberg Anywhere subscribers only. — [Google Play: Bloomberg Professional](https://play.google.com/store/apps/details?id=com.bloomberg.android.anywhere&hl=en_US); [Bloomberg: Professional app](https://professional.bloomberg.com/products/bloomberg-terminal/access/bloomberg-professional-app)
- A single Play Store reviewer says converted monitors stopped working as widgets (anecdotal). — [Google Play: Bloomberg Professional](https://play.google.com/store/apps/details?id=com.bloomberg.android.anywhere&hl=en_US)
- thinkorswim mobile: watchlists, scans and preferences sync from desktop and web. You can track and change watchlists, orders and alerts (including saved orders), and custom desktop columns appear on the phone. — [Schwab: thinkorswim mobile](https://www.schwab.com/trading/thinkorswim/mobile-app); [App Store: thinkorswim](https://apps.apple.com/us/app/thinkorswim-trade-invest/id299366785); [Hahn-Tech](https://www.hahn-tech.com/thinkorswim-mobile-watch-list/)
- Slayer's phone state (audit): most controls are under 44 px (X3). Terrain has no ladder below 1024 px (TE-6). The Weigher's watch column is off screen (WE-2). Trace grids show about 2½ columns (TR-7). Pinpoint's head takes 65% of the first screen (PP-8). — [WHAT-REMAINS.md](../../docs/ux-audit-2026-10-09/WHAT-REMAINS.md)
- Slayer already frames Trace's Net Flow and 0DTE to the screen from md up only, and lets them scroll on a phone. — [/home/user/3abida/.claude/CLAUDE.md](../../.claude/CLAUDE.md) ("Phones (2026-10-01 audit)")

### Inferences
- Slayer's phone experience today is "the desk, squeezed". The companions show that a deliberately smaller phone HOME works better: a stacked feed made of the watchlist, the alerts inbox, the active name's levels card, Tracker rows and news. It would sit under the existing rail sheet ([src/components/layout/MobileMenu.tsx](../../src/components/layout/MobileMenu.tsx)) and would fix several audit phone items by not trying to fit desk grids.
- "Setup follows you" (thinkorswim) needs an account backend. Until then, Settings' Export/Import file is the honest stand-in.

### Gaps
- I found no source on TradingView's or tastytrade's mobile app feature sets, or on layout sync between their devices.
- I found no usage data on what share of trader sessions happen on phones.

## 5. Which of these does Slayer already have, and where is it weaker than best in class?

### Takeaway
Slayer already has the core parts: named Pulse desks with presets, Terrain's four panes with letter link groups, crosshair
sync and 12 named layouts, a ⌘K palette, an alerts drawer with nine options-aware kinds and toasts, watch stores, a session
clock, a bell and the Trader's Clock. It is weaker in four places. Linking and layouts are room-local. The palette navigates
but does not act. The alert lifecycle and history are thin. Watchlists are split, with no sections or flags.

### Cited Findings
| Area | Slayer has | Best in class | Gap |
|---|---|---|---|
| Layouts | Pulse named desks with 3 presets and autosave ([desks.ts](../../src/pages/workspace/desks.ts)); Terrain 12 named layouts ([layouts.ts](../../src/pages/terrain/layouts.ts)) | Bookmap reopens the last workspace ([Bookmap KB](https://bookmap.com/knowledgebase/docs/KB-GettingStarted-OpenMainWindow)); Koyfin dashboards get typed shortcut codes ([Koyfin](https://www.koyfin.com/help/hotkeys-and-custom-shortcuts/)) | Two separate layout systems; none reachable from ⌘K or by a code |
| Linking | Terrain A/B letters, symbol only ([Terrain.tsx](../../src/pages/terrain/Terrain.tsx)); Pulse linked/pinned to one global name | thinkorswim colour groups incl. watchlist → chart ([tos manual](https://toslc.thinkorswim.com/center/howToTos/thinkManual/Left-Sidebar/Watch-Lists)); Bloomberg letter groups across components ([Launchpad guide](https://my.lerner.udel.edu/wp-content/uploads/BB-Getting-Started-in-Launchpad.pdf)) | No shell-wide groups; Terrain lacks interval, range and drawing sync ([TradingView](https://www.tradingview.com/support/solutions/43000629992-how-to-sync-the-charts-of-my-layout/)) |
| Command line | ⌘K: Navigate, Ticker, Draw ([CommandPalette.tsx](../../src/components/layout/CommandPalette.tsx)) | Bloomberg ticker+function+GO and Autocomplete; Koyfin `/` + 2–3 letter codes | No "NVDA FLOW"-style grammar, no actions, no recents |
| Hotkeys | Fixed list per room ([Settings.tsx](../../src/pages/settings/Settings.tsx) ~122–181) | Sierra/Bookmap/DAS remappable, scripted | Not remappable; rows not keyboard-openable (audit X6) |
| Pop-out | None | thinkorswim Detach, Bookmap detached tabs | No second-monitor path |
| Alerts | 9 kinds, once-only, re-arm by hand, tab-scoped log, 5 s toast ([alertStore.ts](../../src/components/gex/alertStore.ts), [AlertsDrawer.tsx](../../src/components/alerts/AlertsDrawer.tsx)) | TradingView frequency, expiry, AND ×5, Alert log ([TV](https://www.tradingview.com/support/solutions/43000474415-differences-between-alert-frequencies/)); TrendSpider drawn-object alerts ([TS](https://help.trendspider.com/kb/alerts/types-of-alerts)) | Lifecycle, AND, alerts on drawings, OS notifications |
| Watchlists | Weigher contract watch, Trace bookmarks, Compass Tracker | TradingView sections and flags ([TV](https://www.tradingview.com/support/solutions/43000615520-how-to-add-a-section-to-the-watchlist/)); Koyfin columns and views ([Koyfin](https://www.koyfin.com/help/release-notes/release-v3-12/)) | Three stores; no name-level list with sections, flags or column views |
| Session | Shell clock, bell, Trader's Clock on Pinpoint Map only | tos extended-hours shading; TV community session shading incl. lunch | Phases not shell-wide; no after-hours state; no chart session shading |
| Phone | Rail sheet; desk pages squeezed (audit X3, TE-6, TR-7, PP-8) | Monitoring subset with synced lists and alerts | No phone home |

### Inferences
- The biggest return for a single user is coherence across rooms: one link model, one watchlist, one inbox, one command line. Every room already reads the global name, so this is mostly shell work.

### Gaps
- I did not test the running app (no edits or launches allowed). The judgements on Slayer are from code and the 2026-10-09 audit.

## 6. Idea catalogue: what Slayer should adopt

### Takeaway
Fifteen ideas, ranked by return for a one-user, UI-only terminal. The first six are shell-level coherence and keyboard
work that need no live data. Alerts on drawings and watchlist-wide alerts will matter more once the feed is live, but they
can be built now on the stand-in data.

### Cited Findings
- See sections 1–5 for every source behind each idea. Each idea names its sources inline.

### Inferences
Format: what it is · where it comes from · why it helps · where it belongs · UI-only now or needs live data · effort (S/M/L).

1. **Shell-wide link groups (A–D letters).**
   - What: every panel that reads a name (Pulse widgets, Terrain panes, Weigher, Pinpoint, Compass, Trace, Dossier pages) gets a link chip, either ∅ or A–D. The global name becomes group A. A pane in B follows only B.
   - Source: Bloomberg Launchpad letter groups; thinkorswim colour clipboard; TradingView emoji groups; Koyfin grouped widgets (§1).
   - Why: watch SPY and NVDA side by side across rooms without fighting the single global name. It extends Terrain's existing A/B rather than adding a new idea. Letters keep it within the token and silver rule (no new hues).
   - Where: shell (context/MarketDataContext.tsx plus a link chip component); Terrain and Pulse migrate.
   - Data: UI-only. Effort: M.
2. **A command line in ⌘K: ticker + function, codes and actions.**
   - What: type `NVDA FLOW`, `SPY LVL`, `QQQ CHAIN` or `AAPL ERN` to open that room's page on that name. Every page gets a 2–3 letter code shown beside it in the palette. Saved Pulse desks and Terrain layouts appear under their names and can take a user-chosen code. Add an Actions group (theme, sounds, arm a price alert at a typed level, open the alerts inbox, export) and Recents.
   - Source: Bloomberg `<GO>` grammar and Autocomplete; Koyfin `/` codes and custom shortcuts (§1).
   - Why: one learned grammar reaches all eight rooms. It is the single largest keyboard speed-up and closes the "palette is only a launcher" gap.
   - Where: shell (components/layout/CommandPalette.tsx).
   - Data: UI-only. Effort: M.
3. **Terrain sync matrix.**
   - What: per layout, toggle symbol, interval, crosshair, date range and drawings (drawings only where the symbol matches).
   - Source: TradingView layout sync (§1).
   - Why: the "same name, three timeframes" desk and the "four names, same window" desk become one click each.
   - Where: Terrain.
   - Data: UI-only. Effort: S–M.
4. **Keyboard-first grids and layers.**
   - What: ↑/↓ (and j/k) walk rows, Enter opens, Esc closes the top layer, `/` focuses the page's filter, and `?` shows the keys for THIS page (taken from Settings' list). Fixes audit X6, TR-1, TR-2, SH-1 and X13.
   - Source: DAS, Sierra and tastytrade hotkey culture; Bloomberg panel focus (§1, §3).
   - Why: the most-used flows run without the mouse, and grids are the bulk of Trace, Pinpoint and Compass.
   - Where: shell plus every grid (TraceGrid, DataTable, AG Grid wrappers).
   - Data: UI-only. Effort: M.
5. **Undo toasts in place of confirms for local actions.**
   - What: delete desk, remove alert, clear the log, remove a watch and Flatten (Paper) act at once, with "Undo" for about 6 s in the toast column.
   - Source: optimistic-UI and Doherty-threshold guidance (§3).
   - Why: fast and safe at once; addresses audit X5.
   - Where: shell toast column (components/alerts/AlertToasts.tsx), Pulse, Practice.
   - Data: UI-only. Effort: S.
6. **Alert lifecycle: frequency, expiry, snooze, a lasting log.**
   - What: each alert gets Only once / Every time / Once per bar close / Once per minute, an expiry (end of session, a date, never) and a snooze (15 m, 1 h, until the open). The "Alerted" shelf becomes a stored, filterable log (name, kind, time, what it read).
   - Source: TradingView frequencies, expiry and Alert log; snooze from general notification practice (no trading source found) (§2).
   - Why: today an alert dies after one firing and the history ends with the tab. Pros re-use alerts all session.
   - Where: alerts (components/gex/alertStore.ts, components/alerts/AlertsDrawer.tsx).
   - Data: UI-only. Effort: M.
7. **Browser notifications when the tab is hidden.**
   - What: optional OS notification for fired alerts and paper fills while the terminal is in the background. Off by default, switched in Settings › Sounds (rename it "Sounds and notices").
   - Source: phone push on thinkorswim and Bloomberg alert pages (§2, §4).
   - Why: Slayer runs on one machine. A traded alert behind another window is a missed alert. Fits "nothing is sent anywhere", because the notice is local.
   - Where: alerts and Settings.
   - Data: UI-only. Effort: S.
8. **Alerts on drawn objects, and AND-alerts.**
   - What: right-click a Terrain trendline, ray or level and choose "Alert on touch / break / bounce", with a buffer. Combine up to five conditions with AND, for example "price above the call wall AND the flip turns".
   - Source: TrendSpider dynamic and multi-factor alerts; TradingView multi-condition (§2).
   - Why: puts Slayer's options-aware kinds (walls, flip, supreme strike) into one compound condition. No charting product offers that, and it stays descriptive (no trade call).
   - Where: Terrain and alerts.
   - Data: UI-only to build. Fully meaningful with live data. Effort: M–L.
9. **One watchlist of names, with sections, flags and column views.**
   - What: a shell-level list of NAMES with draggable sections and 5 flags drawn as token inks, not new hues. Saved column views (Koyfin) choose columns such as price, change, distance to call wall or put wall, flip, next earnings and today's flow. Terrain's ↑/↓ flip-through reads it. Weigher contract watches, Trace bookmarks and the Compass Tracker stay as kinds under it rather than three islands.
   - Source: TradingView sections and flags; Koyfin columns and My Views; thinkorswim watchlist → chart link (§2).
   - Why: one place to keep the names you care about. It drives link group A.
   - Where: shell rail panel plus Weigher.
   - Data: UI-only. Effort: M–L.
10. **Watchlist-wide alerts.**
    - What: one condition (for example "crosses its flip" or "new supreme strike") armed over a whole section.
    - Source: TradingView watchlist alerts (§2).
    - Why: fewer alerts to manage, and it suits a levels-first product.
    - Where: alerts plus watchlist.
    - Data: UI-only to build; needs live data to matter at scale. Effort: M.
11. **Session strip in the shell, and session shading on charts.**
    - What: promote the Trader's Clock phases (pre-market, open, lunch, power hour, close) to a thin shell strip beside the session clock. Add an after-hours market state. Give Terrain and Paper charts optional shading for pre-market and after-hours (and lunch).
    - Source: thinkorswim extended-hours highlight; TradingView community session-window script (§2).
    - Why: session context in every room, using a model Slayer already built. It is descriptive, not a call.
    - Where: shell (SessionClock, data/marketState.ts), Terrain, Practice.
    - Data: UI-only. Effort: S–M.
12. **Pop-out windows for a second monitor.**
    - What: "Pop out" on a Terrain pane, a Pulse widget or the alerts inbox opens it in its own browser window. Windows stay in step (name, link groups, alerts) through `BroadcastChannel`.
    - Source: thinkorswim Detach; Bookmap detached tabs; Bloomberg LLP (§1).
    - Why: a one-user localhost terminal on a multi-monitor desk gains a lot of room.
    - Where: shell, Terrain, Pulse.
    - Data: UI-only. Effort: M (one pane kind) to L (all).
13. **Workspaces that span rooms, reopened on launch.**
    - What: a Workspace = current room + Pulse desk + Terrain layout + link groups + watchlist section. Switch with Alt+1…9 or a palette code. Reopen the last one on load.
    - Source: Bookmap workspaces reopen last; Koyfin dashboard codes; Bloomberg Launchpad views (§1).
    - Why: "morning 0DTE" and "evening review" become one keystroke each.
    - Where: shell; builds on desks.ts and layouts.ts.
    - Data: UI-only now. Device sync needs the future backend. Effort: M.
14. **Density setting: compact or comfortable.**
    - What: one token set (row height, cell padding, minimum type size). Compact by default on a desktop pointer and comfortable under touch. Phone controls reach 44 px via hit areas.
    - Source: my inference from audit X9 and X3; no vendor source found (§3 Gaps).
    - Why: reconciles the dense pro feel with readability and touch targets in one switch.
    - Where: theme (tokens.css) and Settings › Appearance.
    - Data: UI-only. Effort: M.
15. **A phone home for monitoring.**
    - What: on a phone the terminal opens to a stacked feed: watchlist rows, the alerts inbox, the active name's levels card (call wall, put wall, flip), Compass Tracker rows, Dossier headlines and earnings, and Paper positions. Desk pages stay reachable but are not the default.
    - Source: Bloomberg Professional app; thinkorswim mobile (§4).
    - Why: companions win by showing the subset you respond to. This avoids squeezing desk grids (audit X3, TR-7, PP-8).
    - Where: shell (phone route) using existing widgets.
    - Data: UI-only. Effort: M.

Lower-priority, Practice-specific:
- **Quick roll for paper options positions.** One step rolls to the next expiry at the same strike, with the full ticket still available. Source: tastytrade Quick Roll vs Roll (§1). Practice › Paper. UI-only. Effort: M.
- **Sizing helper on the paper ticket.** Size from a set risk amount and a stop distance, as DAS scripts do (§1). This is a sizing calculation, not a call. Practice › Paper. UI-only. Effort: S.

Ranking for the report writer, by return on effort for a one-user UI-only build: 2, 4, 5, 6, 1, 3, 11, 7, 9, 13, 12, 8, 14, 15, 10.

### Gaps
- The ranking is my judgement. It is not drawn from usage data.
- I did not verify current (2026) screens of Bloomberg Launchpad, tastytrade's desktop app or TradingView mobile. Some cited vendor pages are 1–3 years old.
- I found no trading-platform source for snooze, notification-centre inboxes or density settings. Those ideas rest on general UX practice and Slayer's own audit.
