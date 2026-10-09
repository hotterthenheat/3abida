# Dossier and Practice rooms: UX/UI audit

Scope: Dossier (/dossier and news, earnings, earnings/:ticker, insiders, congress, stocks, stocks/:ticker, plus the legacy /stocks, /news, /newsroom, /earnings, /earnings/:ticker and /record/*). Practice (/practice and paper, backtest, backtest/:id, backtest/:id/report, journal, journal/:sessionId/:tradeId, plus /paper/*, /review/* and /record).

Method: The running app at http://localhost:5300 (dev server), driven by Playwright Chromium. Scripts are in the scratchpad `audit-practice/`: sweep.mjs, dossier.mjs, paper1-4.mjs, backtest.mjs, bt2.mjs, journal.mjs, j2.mjs, contrast.mjs, kb.mjs, prices*.mjs, ins*.mjs and paperphone.mjs.
- **Route sweep:** 16 content routes × 4 viewports (1440×900, 1280×720, 1920×1080, 390×844) × 2 themes = 128 loads. A further 47 legacy and redirect routes ran at 1440 dark.
- **Interaction scripts:** they pressed every dropdown option, sort header, tab, order button and door, and checked inputs with bad values.
- **Source reading:** each finding is tied back to its file and line.

The repo was read-only throughout. Screenshot paths below are relative to this file's folder (`shots-practice/...`). Code paths are relative to the repo root.

Caveat on timings: the host ran at a load average of about 30 on 4 cores, with other audit agents' browsers on the same machine. Load times are therefore indicative only, and they come from the Vite dev server, not a production build.

Severity scale: **Broken** (wrong or impossible result), **Major** (a real user would be misled, lose work or money, or be blocked), **Minor** (friction, inconsistency, small a11y gap), **Polish**.

---

## 1. Does every control work, give feedback, validate input and undo correctly? (dead buttons, no-ops, redirects, cross-page data, empty states)

### Takeaway
Almost every control does something, and the legacy redirects all land correctly. The serious problems are elsewhere:
- **Prices disagree:** the same name is priced differently on the Stocks list, its own Stocks page, Earnings and Paper.
- **Invented pages:** any ticker typed into /dossier/stocks/:ticker gets a made-up page.
- **Earnings data errors:** the current quarter is listed as a past print, and one contract is listed twice.
- **No safety nets:** the Practice room has no confirmation or undo on any destructive action, and reloading the page silently closes open paper positions.
- **Backtest look-ahead:** the backtest clock can peek into the future and rewind.
- **Bad order input:** a malformed limit price shows "NAN".

### Cited Findings

**Dossier — data that disagrees between pages**
- **[Broken] The same stock shows two prices one click apart (Stocks list vs the stock's page vs Paper).**
  - Where: /dossier/stocks grid → /dossier/stocks/:ticker.
  - What: the grid shows `AAPL $229.90 −1.08%` and `NVDA $138.66 +0.04%`. Clicking AAPL opens a page that says `$190.00 −0.20%`, and NVDA's page says `$120.00 +1.43%`. Paper's chart shows `AAPL 190.00 −0.20%` and `NVDA 119.95 +1.39%`.
  - Cause: the screener and Earnings price from the static `px` in `src/data/universe.ts:34-36` (AAPL 232.4, NVDA 138.6). The simulator uses AAPL 190 and NVDA 120 (`src/core/simulator.ts:25`).
  - Owner rule broken: CLAUDE.md says "Prices agree across desks … never from the config's base price".
  - Evidence: `src/data/stocks.ts:125` (`price: u.px * …`); prices2/prices3 script output; [shots-practice/d-stocks-dark.png](shots-practice/d-stocks-dark.png); [shots-practice/sweep/dossier_stocks_AAPL-1440x900-dark.png](shots-practice/sweep/dossier_stocks_AAPL-1440x900-dark.png).
  - Fix: price every Dossier row from `Simulator`/`spotOf(ticker)` with the day change from the last session's close. Drop `u.px` as a price source.
- **[Major] Earnings prices the move off the wrong stock price.**
  - Where: /dossier/earnings/NVDA, the "After the print" box.
  - What: "The stock $138.60" while Stocks and Paper show about $120. The straddle ($4.69), the busiest strikes (137.5/140/142.5) and the "% from spot" figures are all built on the wrong spot.
  - Evidence: `src/data/earnings.ts:409` (`price: u.px`); prices.mjs output "NVDA earnings page: The stock $138.60 … stock page: $120.00 +1.43%".
  - Fix: same as above. Build `buildEarningsDossier` from the live spot.
- **[Broken] Any ticker typed into the URL gets a fully invented stock page.**
  - Where: /dossier/stocks/ZZZZ.
  - What: a full page renders for the non-existent "ZZZZ": $322.81 −4.28%, GEX walls, dark pool, a "Why now" story and "6 of 9 sources live".
  - Contrast: /dossier/earnings/ZZZZ correctly says "No report on the next two weeks' calendar".
  - Evidence: [shots-practice/sweep/dossier_stocks_ZZZZ-1440x900-dark.png](shots-practice/sweep/dossier_stocks_ZZZZ-1440x900-dark.png); `src/pages/record/StockName.tsx:457-464` (`useSeeded(T)` seeds any string).
  - Fix: check `lookup(T)` from `src/data/universe.ts` first. For an unknown ticker show "No name called ZZZZ", a search box and a link back to the board.
- **[Major] The current quarter is shown as a past print.**
  - Where: /dossier/earnings/:ticker, "Beats and misses", "Past moves" and "Today's price, replayed".
  - What: the last eight quarters run Q1'25…Q4'26. Today (2026-10-09) is in Q4'26, so a quarter that has not been reported is shown with a beat/miss and a move.
  - Evidence: [shots-practice/d-earnings-name-dark.png](shots-practice/d-earnings-name-dark.png); `src/data/earnings.ts:105-118`. `quarterLabels()` starts from `new Date()`'s quarter and also uses the wall clock instead of `core/clock`.
  - Fix: start one quarter back (the last reported quarter), and read the app clock.
- **[Major] The same contract is listed twice with two different prices.**
  - Where: /dossier/earnings/NVDA, "Busiest puts".
  - What: "NVDA $137.5 put · exp 10/16" appears twice, at ~$2.51 / vol 8,261 and ~$1.31 / vol 4,150. React also logs "Encountered two children with the same key, PUT-137.5" nine times.
  - Cause: `mkActive` rounds the ATM and the −0.5×IM offsets to the same strike for a ~$140 name with $2.50 steps. The id is `${right}-${strike}` (`src/data/earnings.ts:331-370`).
  - Evidence: [shots-practice/d-earnings-nvda-busiest-dup.png](shots-practice/d-earnings-nvda-busiest-dup.png); console log from crash.mjs.
  - Fix: deduplicate strikes after rounding (step out to the next strike), or key and merge by strike.
- **[Minor] A report from this morning is still listed as upcoming.**
  - Where: /dossier/earnings/BYDDY.
  - What: "Reports Fri 10/09 · before the open · today" at 13:50 New York. The report has already happened, yet the page prices an upcoming move and calls the option "exp 10/09".
  - Evidence: [shots-practice/d-earnings-name-dark.png](shots-practice/d-earnings-name-dark.png).
  - Fix: after the open on a BMO day (or after 16:00 on an AMC day), switch the card to "Reported this morning" and show the actual move.

**Dossier — controls**
- **[Works] Filters, sorts and tabs**
  - Every dropdown option on News, Earnings, Insiders, Congress and Stocks changes the content, and the multi-select Filter narrows correctly. Counts: Congress window 30/90/180 days → 15/45/90 rows. Owner Self/Spouse/Joint/Dependent → 4/5/2/4. Earnings Show Rich/Fair/Cheap → 3/10/1. Stocks Screen Strong/Good/Caution → 2/12/14.
  - Every Insiders and Congress column header sorts. News kind tabs change the story count: Regulatory 0, M&A 1, Earnings 5, and so on.
  - Evidence: dossier-dark2.log; ins.mjs output.
- **[Minor] The earnings list ignores the "Week" filter.**
  - Where: /dossier/earnings, Week dropdown.
  - What: "This week / Next week / Both weeks" changes the board, but the "Every report" grid always says "Both weeks · every report" and keeps 14 rows. The facts read "Reports 14 · two weeks" while Week = This week.
  - Evidence: [shots-practice/sweep/dossier_earnings-390x844-dark.png](shots-practice/sweep/dossier_earnings-390x844-dark.png); dossier-dark2.log (rows 14 for all three).
  - Fix: scope the grid and the facts to the chosen week, or label the dropdown "Board shows".
- **[Minor] Clicking a row takes you out of the Dossier without warning.**
  - Where: /dossier/insiders and /dossier/congress rows.
  - What: a click calls `changeTicker()` and navigates to /pinpoint/map. Nothing on the row says so: no chevron, no hint, and the box subtitle says "click a name to keep the grid to it" about the cards, not the rows.
  - Evidence: `src/pages/record/Insiders.tsx:286-291`, `src/pages/record/Congress.tsx:290`; dossier-dark2.log `"rowClickChangesPage":true,"url":"…/pinpoint/map"`.
  - Fix: open the name's Dossier page (`/dossier/stocks/:ticker`), which keeps the reader in the room. Alternatively add a visible "Open on the Map ↗" affordance.
- **[Works] News**
  - The tape's back and on arrows work, and "How to read" opens and closes on Esc (no dialog left after Esc).
  - A story on a Stocks page opens News filtered to that name ("Stories 1 · 1 positive").
  - The Stocks page section jumps scroll to their sections.
  - Evidence: dossier-dark2.log.
- **[Minor] News takes 6 to 17 seconds to show anything but a skeleton** (on the loaded host). It rendered at 17.5 s in one run, 5.6–7 s in others. The page builds the wire, map and deep reads in one pass.
  - Evidence: newsload.mjs output; [shots-practice/d-news-dark.png](shots-practice/d-news-dark.png) (skeleton at settle).
  - Fix: profile `buildGeoNews`/`buildNewsDeepRead`. Render the list first and the map/deep read after idle, or memoise across visits.

**Legacy routes and redirects**
- **[Works] Every legacy route resolves, keeping its parameters:**
  - `/dossier`, `/news` and `/newsroom` → /dossier/news.
  - `/stocks` → /dossier/stocks; `/earnings` → /dossier/earnings; `/earnings/NVDA` → /dossier/earnings/NVDA.
  - `/record` → /dossier/news; `/record/insiders` → /dossier/insiders; `/record/stocks/AAPL` → /dossier/stocks/AAPL.
  - `/practice`, `/paper`, `/paper/live-chart`, `/paper/desk` and `/paper/evaluation` → /practice/paper.
  - `/paper/journal` → /practice/journal; `/paper/journal/x/y` → /practice/journal/x/y.
  - `/review`, `/review/backtest` and `/review/futures` → /practice/backtest.
  - `/review/backtest/abc` → /practice/backtest/abc; `/review/backtest/abc/report` → /practice/backtest/abc/report.
  - `/review/journal` → /practice/journal?book=backtest; `/review/journal/x/y` → /practice/journal/x/y?book=backtest.
  - Evidence: sweep-redirects.json, sweep-redirects2.json.
- **[Minor] `/stocks/AAPL` is a 404 ("Page not found")** although `/earnings/:ticker` and `/record/*` keep the ticker.
  - Evidence: sweep-redirects2.json; `src/App.tsx:216` only maps `/stocks`.
  - Fix: add `<Route path="/stocks/:ticker">` → `/dossier/stocks/:ticker`.
- **[Polish] Two different 404 headings:** `/dossier/nonsense` says "Nothing at this address" and `/stocks/AAPL` says "Page not found". Use one.

**Practice — Paper**
- **[Major] Reloading or closing the tab silently closes every open paper position.**
  - Where: /practice/paper.
  - What: a reload turned an open AAPL 194C into a closed trade, "Ended: Closed with the page −$5.30". On a 50K evaluation the reload also counted toward "Days traded 1 of 2".
  - Warnings: nothing before unload. The only notices are a 10 px footnote and a tooltip.
  - Evidence: paper4-dark.txt ("after reload trades … AAPL 194C … Closed with the page −$5.30"); [shots-practice/p-paper-reloaded-dark.png](shots-practice/p-paper-reloaded-dark.png); `src/pages/paper/Desk.tsx:495`; `src/pages/practice/PracticeLayout.tsx:81`.
  - Fix: add a `beforeunload` prompt while positions or working orders are open ("Leaving closes N open positions at the last price"). Better still, persist positions and re-mark them on load. At minimum, don't let a reload-close count as an evaluation trading day.
- **[Major] Flatten closes everything at once with no confirmation or undo.**
  - Where: /practice/paper, account card "Flatten".
  - What: a single click closes every open position at market and cancels every working order.
  - Evidence: paper3-dark.txt ("after flatten (no confirm?)" → 0 open, 2 closed, −$29); `src/components/paper/AccountCard.tsx:177`.
  - Fix: a two-step confirm ("Close 2 positions and cancel 1 order? — Flatten / Keep"), or press-and-hold.
- **[Major] Starting a new practice account silently ends the current one, positions included.**
  - Where: /practice/paper, New → $10K/$25K/….
  - What: the account was closed with its open AAPL position and marked "closed — Started over". The only warning is a sentence inside the card.
  - Evidence: paper4-dark.txt (accounts after: "Practice · from Oct 9 · open", "Practice · from Oct 9 · closed — Started over"); `src/data/paper/store.ts:395-399`; [shots-practice/p-paper-newcard-dark.png](shots-practice/p-paper-newcard-dark.png).
  - Fix: confirm whenever the current account holds positions or orders. Name new accounts uniquely (see section 3).
- **[Major] "Take them here" closes the other tab's positions without confirmation.**
  - Where: /practice/paper in a second tab.
  - What: one click closes "whatever is open there, at the last price that tab saw".
  - Evidence: [shots-practice/p-paper-tab2-dark.png](shots-practice/p-paper-tab2-dark.png); `src/pages/paper/Desk.tsx:586-596`.
  - Fix: confirm, naming how many positions will close.
- **[Major] A limit buy the account can never pay for is accepted, then auto-cancelled with a misleading reason.**
  - Where: Paper order ticket, limit price.
  - What: a buy limit at 99999 was enabled and placed. It was immediately "Cancelled — the free money was gone by then", although the free money had never been enough.
  - Evidence: paper4-dark.txt; `src/data/paper/engine.ts:991`.
  - Fix: refuse at the ticket using the limit price ("This needs $9,999,900; $24,766 is free"). Also warn when a buy limit is far above the ask ("fills at the ask, 2.31").
- **[Major] A malformed limit price shows "NAN" on the button.**
  - Where: Paper and Backtest order ticket.
  - What: the field accepts "1.2.3" because the filter `[^0-9.]` allows any number of dots (`src/components/paper/OrderPieces.tsx:55`). The button then reads "BUY +1 @ NAN LMT" (disabled, no reason given).
  - Evidence: [shots-practice/p-paper-nan-dark.png](shots-practice/p-paper-nan-dark.png); `num()` at `src/components/paper/OptionsChain.tsx:56`.
  - Fix: allow one dot and two decimals, and show "Enter a price" when the value is not a number.
- **[Minor] The limit field silently accepts 0.**
  - What: "0" stays in the field while the button reads "@ 0.01 LMT". The same clamp shows in the stepper (`OptionsChain.tsx:264`).
  - Fix: snap the field to 0.01 on blur, and say "lowest is 0.01".
- **[Minor] The contracts field shows a different number from the order size.**
  - Where: order ticket, contracts field.
  - What: typing "0" shows 0 while the order size stays 1 (`data-order-size=1`), until the field loses focus. Select-all and "5000" leaves "500" with the size at 500, with no "max 999" message.
  - Evidence: paper1-dark.txt; `src/components/paper/OrderPieces.tsx:63-77`.
  - Fix: show the clamped value or an inline "1–999" hint.
- **[Works] Refusals are clear.** They appear both in the button's title and in the status line under the buttons:
  - "Not enough free money — this needs $116,533.35, and $24,761.35 is free".
  - On the evaluation: "No more than 5 contracts open at once in this evaluation — this would be 6".
  - In the bracket: "The target has to be above what you pay".
  - Evidence: paper3/paper4 logs; [shots-practice/p-paper-refused-dark.png](shots-practice/p-paper-refused-dark.png).
- **[Works] Placing, cancelling and closing.**
  - A market buy fills and shows in Positions, on a chart tag, in the account card and in the chain's "HELD" mark.
  - A working order cancels: "Cancelled — cancelled by you".
  - Close sells at the bid and moves the trade to Trades.
  - The layout doors (1, 2h, 3, 4) change the number of panes.
  - Desk menu → New desk creates "Desk 2". The ticker picker searches by name ("nvidia" → NVDA) and shows a no-match message.
  - Evidence: paper3-dark.txt; [shots-practice/p-paper-bought-dark.png](shots-practice/p-paper-bought-dark.png); [shots-practice/p-paper-layout4-dark.png](shots-practice/p-paper-layout4-dark.png); [shots-practice/p-paper-picker-dark.png](shots-practice/p-paper-picker-dark.png).
- **[Minor] A fill gets no message of its own.** After Buy, the only feedback is the counts changing and a chart tag. There is no "Filled 1 × SPY 480C at 2.34" line or aria-live announcement.
  - Also: the button promised "@ ASK 2.33" and the fill was at 2.34, with no notice of the slippage.
  - Evidence: paper1-dark.txt (button 2.33, fill "paid 2.34"); [shots-practice/p-paper-bought-dark.png](shots-practice/p-paper-bought-dark.png).
  - Fix: a short status line or toast with `role=status` after every fill or refusal, naming the fill price.
- **[Minor] The "Two, one over the other" layout disappears at 1440 wide.** It is hidden whenever the toolbar is compact (`src/components/paper/DeskDoors.tsx:40`), so it vanishes at common laptop widths with no explanation.
- **[Minor] Delete-desk is invisible until hovered.** The button is `opacity-0 group-hover:opacity-100` (`DeskDoors.tsx:123`), so touch and keyboard users cannot see it. It deletes with no confirmation.
- **[Gap] The End-evaluation button was not tested.** No `[data-paper-end-eval-button]` was on screen for a fresh 50K evaluation, and I could not reach a pass or fail state.

**Practice — Backtest**
- **[Major] The backtest clock can be run forward to look ahead, then rewound before the first trade.**
  - Where: /practice/backtest/:id, replay scrubber.
  - What: on a fresh session I clicked the track at 90% (to 15:21), saw the day, clicked back to 5% (09:50), then bought. The trade made +$56.70. Copy on the Sessions page says "the clock only moves forward".
  - Cause: rewinding is only clamped at the last order or fill (`floorOf`, `src/data/review/engine.ts:747-752, 816-817`).
  - Evidence: bt2-dark.txt ("peeked to 2026-07-13 350 / rewound to 2026-07-13 19"); `src/pages/review/Sessions.tsx:179`.
  - Fix: either make the floor the furthest minute ever reached (true forward-only), or keep the rewind but mark the session "looked ahead" and say so in the report and journal. Change the copy to match.
- **[Minor] At the floor, rewinding does nothing and says nothing.** After a trade, clicking the start of the track or "One step back" leaves the clock at the fill minute. The step-back button stays enabled, with no message.
  - Evidence: bt2-dark.txt ("step back at floor: disabled false").
  - Fix: disable it with a title ("The clock can't go back past your last fill at 09:50").
- **[Major] Deleting a session is immediate and permanent.**
  - Where: /practice/backtest, the trash icon on each session row.
  - What: one click removes the session and its trades. The list went from 2 to 1, with no confirmation and no undo.
  - Evidence: backtest-dark.txt; `src/pages/review/Sessions.tsx:165`.
  - Fix: confirm, or show an undo toast for about 5 seconds.
- **[Works] Sessions and the backtest desk.**
  - Start creates the session and opens its desk.
  - The rule "1 position" refuses a second buy ("Your session's rule: no more than 1 position open at once").
  - "To the end" shows the bell card ("THE BELL · 16:00 …"), and "Next day" moves to 2026-07-14.
  - Fullscreen opens and closes on Esc. The Go-to calendar opens.
  - Report, Run again and Rename open the right things (the Report button lands on /report; row clicks ignore the inner buttons, `TraceBox.tsx:368`). An empty rename keeps the old name.
  - A missing session (`/practice/backtest/nope`) says "That session is not on this machine" with a link back to the sessions.
  - Evidence: backtest-dark.txt, bt2-dark.txt; [shots-practice/b-bell-dark.png](shots-practice/b-bell-dark.png); [shots-practice/b-report-trade-dark.png](shots-practice/b-report-trade-dark.png).
- **[Minor] A missing session or trade puts the bogus id in the browser tab.** Titles read "NOPE · Backtest · Practice", "ABC · Backtest …" and "X · Journal …".
  - Evidence: sweep-main.json titles.
  - Fix: use "Session not found · Backtest".

**Practice — Journal**
- **[Works] The Journal's controls.**
  - Period pills: Today / This week / This year / All time each change the facts and the address.
  - Month arrows; a day opens its panel (`?day=2026-09-24`).
  - The account filter lists "Every account 43 closed · Sample · practice 32 · Sample · 50K evaluation 11".
  - "Hide the sample" toggles both ways.
  - CSV downloads `slayer-paper-journal-all-2026-10-09.csv` (44 lines, BOM, 21 columns including the notes).
  - On a trade page, → and ← walk older and newer, and Esc returns to the same day.
  - The three note fields save across a reload. The tag-lists door opens.
  - A backtest trade lands in `?book=backtest` on its replayed day (Jul 13).
  - Evidence: journal-dark.txt, j2-dark.txt; [shots-practice/j-trade-dark.png](shots-practice/j-trade-dark.png); [shots-practice/j-backtest-trade-dark.png](shots-practice/j-backtest-trade-dark.png).
- **[Minor] The Journal opens on an empty month.** It defaults to "This month" (October), which reads "Nothing closed this month" although 43 trades sit in September.
  - Evidence: [shots-practice/j-paper-dark.png](shots-practice/j-paper-dark.png).
  - Fix: open on the latest month with trades, or on "All time" when the current month is empty.
- **[Minor] Tag inputs could not be found.** No `[data-tag-add]` field was on the trade page, only the lists door, so how to add a setup or mistake tag isn't obvious.
  - Evidence: j2-dark.txt ("tag inputs 0", "tag door 1").

### Inferences
- The Dossier's data builders read two price sources (`universe.px` and the Simulator). A single `priceOf(ticker)` would remove the whole class of disagreement.
- The Practice room handles refusals (rules) well but has no safety layer for irreversible actions: flatten, a new account, take-over, delete session, delete desk and reload. One shared confirm or undo primitive would cover them all.
- The backtest's value as practice depends on not knowing the future. The current floor rule allows look-ahead before the first trade of every day.

### Gaps
- Not exercised:
  - dragging order and position tags on the chart, and the right-click chart menu;
  - the long/short drawing tool's MarkCard ("Place it");
  - the trailing-stop and breakeven editors;
  - debit spreads end to end;
  - evaluation pass and fail states; the News bell (alerts) button; the News economic calendar;
  - the Stocks sector buttons; and the day-note textarea on the day panel.
- The global ⌘K palette did not open as a `role=dialog` under Ctrl+K in headless Chromium. It is not room-specific, so I did not pursue it.

---

## 2. Console errors, failed requests, loading states, AG Grid warnings, 0-px grids, clipped or overlapping text, light vs dark contrast — at 1440×900, 1280×720, 1920×1080 and 390×844

### Takeaway
The pages are technically clean:
- **Console and network:** no runtime errors, no failed requests, no AG Grid warnings.
- **Layout:** no horizontal page overflow at any size, and no 0-px grids. On a phone the chain is 560 px and Positions 184 px.

The problems are layout at phone width (truncated values, a covered map, an overflowing calendar, clipped buttons), very small type (down to 6.5 px), and a few contrast shortfalls in light mode.

### Cited Findings
- **[Works] Console and network.** Over 128 content loads and 47 redirect loads, the only messages were:
  - React Router's two v7 future-flag warnings (every page, dev only);
  - the duplicate-key error on /dossier/earnings/NVDA (section 1).
  - There were no `pageerror`s, no HTTP ≥ 400 responses and no AG Grid console output. The only failed requests were navigation aborts.
  - Evidence: sweep-main.json, sweep-redirects*.json, dossier-dark2.log.
- **[Works] Grid heights and overflow.** All grids have a height at every size: Insiders 5,443, Congress 2,011, Stocks 1,615, Earnings 647, Sessions and Journal 183. On a phone the Paper chain is 560 and Positions 184. `scrollWidth − innerWidth = 0` at all four sizes in both themes.
  - Evidence: sweep-main.json; paperphone.mjs output.
- **[Minor] Insiders draws every row (about 5,400 px tall).** It uses raw AG Grid, so it doesn't get TraceGrid's 80-row rest the house rule describes (CLAUDE.md "Long Trace grids rest at 80 rows").
  - Evidence: sweep-main.json grids [5443].
  - Fix: route it through `TraceGrid` or add the same "show the rest" foot.
- **[Major] Backtest rule values are unreadable on a phone (390).** The dropdowns truncate to "No …", "N" and "N…", so the reader cannot see which rule is set. The sentence also says "set them in the three cards at the right", which is wrong in the stacked layout.
  - Evidence: [shots-practice/sweep/practice_backtest-390x844-dark.png](shots-practice/sweep/practice_backtest-390x844-dark.png); sweep clipped "No limit 40>7"; `src/pages/review/Sessions.tsx:238`.
  - Fix: full-width controls at phone width (label above the value), and copy that doesn't depend on position ("in the rule cards").
- **[Major] The Journal calendar overflows its card on a phone (390).** Only Sun–Wed show; Thu, Fri, Sat and the Week column are cut off. The period pills also run off the edge ("All time" hidden), and the account value is truncated to "Every ac…".
  - Evidence: [shots-practice/sweep/practice_journal-390x844-light.png](shots-practice/sweep/practice_journal-390x844-light.png).
  - Fix: on a phone, a 7-column grid at 100%/7 with smaller cells, or a list of trading days. Wrap the pills or make the row scroll with a visible fade.
- **[Major] On a phone the News map is almost entirely covered by the story-kind bar.** The map is about 160 px tall and the two-row pill bar sits over it.
  - Evidence: [shots-practice/sweep/dossier_news-390x844-dark.png](shots-practice/sweep/dossier_news-390x844-dark.png); `src/pages/record/News.tsx:629` (`max-lg:` rules).
  - Fix: below lg, put the kind pills above or below the map, not over it, and give the map at least 240 px.
- **[Minor] Paper on a phone (390) clips two controls.**
  - The account card's "NEW" button is cut at the right edge ("+ NE").
  - The chart's position bar is clipped ("× Cl" for Close).
  - The positions grid needs horizontal scroll to reach "Now" and "Up or down".
  - Evidence: [shots-practice/p-paper-phone-390-dark-0.png](shots-practice/p-paper-phone-390-dark-0.png); [shots-practice/p-paper-phone-390-dark-1600.png](shots-practice/p-paper-phone-390-dark-1600.png).
  - Fix: let the account card's head wrap, and put the position bar's Close on its own line below sm.
- **[Minor] Clipped headers and cells at desktop sizes.**
  - Paper and Backtest grids: "DECAY/D…", "UP OR DO…", "MADE OR …", "Closed wit…", and the contract chip "AAPL 194(" at 1440.
  - Congress "Reports to know" cards: "$250,001 – $500,…", "$1,001 – $…", and members' names.
  - News economic calendar: event names cut at 67 px ("Initial jobless claims 92>67").
  - Stocks grid: "Why" text and sector chips cut to 44 px.
  - Evidence: [shots-practice/p-paper-order-dark.png](shots-practice/p-paper-order-dark.png); [shots-practice/p-paper-reloaded-dark.png](shots-practice/p-paper-reloaded-dark.png); [shots-practice/d-congress-dark.png](shots-practice/d-congress-dark.png); sweep-main.json `clipped` lists (News 25 at 1440, 42 at 1280; Stocks 44 and 47).
  - Fix: widen or shorten the headers ("Decay/day", "P&L"), give the amount bracket its own line, and add tooltips for truncated text.
- **[Minor] The page subtitle is cut off on phones.** The Dossier and Practice heads use `whitespace-nowrap truncate` on the subtitle, so at 390 each page's one-line description is cut at about 40 characters.
  - Evidence: `src/pages/record/RecordLayout.tsx:47`, `src/pages/practice/PracticeLayout.tsx:76`; phone sweep shots.
  - Fix: allow two lines below md.
- **[Minor] Overlapping chart labels.**
  - Paper: the fill labels "Bought 1 · 480C" and "Sold 1 · 480C" stack on top of each other after a buy, sell and buy.
  - The position tag overlaps the price-axis labels.
  - On the earnings header, "· today" wraps under the "Options price" column.
  - Evidence: [shots-practice/p-paper-picker-dark.png](shots-practice/p-paper-picker-dark.png); [shots-practice/p-paper-bought-dark.png](shots-practice/p-paper-bought-dark.png); [shots-practice/d-earnings-name-dark.png](shots-practice/d-earnings-name-dark.png).
- **[Minor] Type as small as 6.5 px.** The smallest text found: News 6.5 px; Insiders and Congress 7 px ("planned", "unstated" at 8 px, `src/pages/record/Insiders.tsx:138-139`); StockName 7.5 px; Earnings and Stocks 8 px.
  - Counts under 10 px: News 334, StockName 146, Insiders 114.
  - Evidence: contrast-dark.json and contrast-light.json (minSize, smallN).
  - Fix: a 10 px floor for any word a reader needs; 9 px only for axis ticks.
- **[Minor] Contrast in light mode.**
  - The R multiple next to P&L ("+0.09R") is at `opacity-80`, giving 3.21:1 in light (`src/pages/paper/Desk.tsx:407,470`). This also breaks the house rule "recede by dropping a text tier, never by … opacity".
  - Journal calendar P&L on its red and green tinted cells: 3.49–3.69:1 (dark) and 3.58:1 (light) at 14 px. That is below even the owner's deliberate ~4.3:1 for direction inks.
  - On light News, "good" in `text-bull` measures 3.98:1 at 10 px and `text-warn` 4.27:1. The economic-calendar rows are 3.28–3.77:1 at 9.5 px, and other-month calendar days 3.07:1.
  - No text measured below 3:1 except two false positives (silver pill fills read by the script).
  - Evidence: contrast-light.json, contrast-dark.json; [shots-practice/j-paper-sept-dark.png](shots-practice/j-paper-sept-dark.png).
  - Fix: drop the opacity for `text-textSecondary`, and draw P&L on the tinted cells in `text-textPrimary` with a coloured sign or bar.
- **[Polish] Light-mode Paper.** The chart, chain and blotter follow the paper theme. The position tag, the MarkCard (`data-theme="dark"`, `src/pages/paper/Desk.tsx:556`) and the drawing rail stay dark islands, which is allowed.
  - Several buttons hard-code `color: '#0a0a0a'` in inline styles: `src/pages/paper/Desk.tsx:573,592`, `src/components/paper/OrderPieces.tsx:40,99,117`, `src/pages/review/Sessions.tsx:223`, `src/components/review/BellNotice.tsx:120`. CLAUDE.md requires "every colour is a token".
  - Evidence: [shots-practice/p-paper-full-1440-light.png](shots-practice/p-paper-full-1440-light.png).
- **[Major] Paper's chart uses the reader's own time zone while the page says New York.**
  - What: with the browser in America/Los_Angeles at 14:28 New York, the Paper chart's axis showed 10:00–12:00 and the crosshair "Oct 9, 10:42". The page head says "Clock: Today · New York", the blotter's times are New York ("Oct 9 · 14:03") and the evaluation says "flat by 15:59 New York". Under UTC the axis read 16:30–19:00. The sidebar clock also shows local time (11:28) beside "Market open".
  - Evidence: [shots-practice/tz-la-paper.png](shots-practice/tz-la-paper.png); [shots-practice/p-paper-order-dark.png](shots-practice/p-paper-order-dark.png) (UTC); a New York formatter already exists in `src/components/gex/chartTime.ts:31-34`.
  - Fix: run the Paper desk's StrikeChart through the New York formatter, as the backtest strip does ("09:31 · NEW YORK"), and label the sidebar clock's zone.
- **[Minor] Loading.** Skeletons resolved on every page. News is the slow one (section 1). Earnings/:ticker sometimes still showed only the head after a 4.5 s settle under load (contrast run n=10 elements).

### Inferences
- Phone layouts were handled for the big grids (the 0-px bug of 2026-10-01 holds) but not for the control rows and calendars. A 390 pass on Backtest's rule row, the Journal calendar and the News map would close the Major phone issues.

### Gaps
- Only the 1440 light shots of Paper and the Journal and the phone light shots were reviewed visually. All 156 sweep screenshots are saved in `shots-practice/sweep/` for the remaining light/dark pairs.
- I did not check reduced-motion behaviour.

---

## 3. Is each room coherent? (tab names, layouts, forms, number formatting, P&L colouring, confirming risky actions)

### Takeaway
Each room has a consistent shell: head, Source/Prices facts, boxes with "How to read", and the house dropdowns. Paper and Backtest share one order ticket. But:
- **No confirmations** anywhere in Practice (section 1).
- **Look-alike account names** make the account switcher ambiguous.
- **Minus signs and tab counts** are inconsistent.
- **Copy contradicts itself** across Paper, Backtest and the evaluation.

### Cited Findings
- **[Works] Shared design across the rooms.**
  - One order card on both desks: the same sizes row, buy and sell buttons, limit box and brackets (`OptionsChain.tsx` `ChainOrder`, used by `src/pages/review/Desk.tsx:441`).
  - P&L is consistently green or red with a sign: "+$56.70", "−$18.30".
  - R multiples sit next to dollars throughout.
  - Evidence: [shots-practice/b-trade-dark.png](shots-practice/b-trade-dark.png); [shots-practice/p-paper-trades-dark.png](shots-practice/p-paper-trades-dark.png).
- **[Minor] Two accounts can carry the same name.** After starting a second practice account, the switcher lists "Practice · from Oct 9 · open" and "Practice · from Oct 9 · closed — Started over".
  - Evidence: paper4-dark.txt; [shots-practice/p-paper-accounts-dark.png](shots-practice/p-paper-accounts-dark.png).
  - Fix: include the size and time ("Practice $10K · Oct 9 14:05"), or number them.
- **[Minor] The Orders tab count disagrees with its rows.** It reads "ORDERS · 0" while it lists cancelled and filled orders. The count is working orders only.
  - Evidence: [shots-practice/p-paper-nan-dark.png](shots-practice/p-paper-nan-dark.png).
  - Fix: "Orders · 0 working", or count every row.
- **[Polish] "Cancelled — cancelled by you"** repeats itself (paper3-dark.txt). Use "Cancelled by you".
- **[Polish] Mixed minus signs.** Some figures use a true minus, others an ASCII hyphen:
  - "−$18.30", "−1.8%" and "−0.10R" use U+2212;
  - "-0.8% from spot" (Earnings busiest), "-0.3%" (News 1-day expected), "-0.50" (Journal delta), "-0.20%" (Stocks head) and "-0.5439" (chain theta) use a hyphen.
  - Evidence: busy.mjs output; [shots-practice/d-news-loaded-dark.png](shots-practice/d-news-loaded-dark.png); j2-dark.txt.
  - Fix: route every signed figure through the `usdSigned`/`signed` helpers with U+2212.
- **[Minor] Copy disagrees about what can be traded and when.**
  - Paper: "calls, puts and debit spreads".
  - The Backtest sentence: "long calls and puts, paid in cash" — yet the backtest ticket offers SPREAD ([shots-practice/b-trade-dark.png](shots-practice/b-trade-dark.png); `Sessions.tsx:235`).
  - Paper's "Prices" tooltip: "It trades round the clock" (`PracticeLayout.tsx:81`). The evaluation says "flat by 15:59 New York" and the backtest bell says "Contracts trade 09:30 to 16:00".
  - Fix: one capability sentence shared by both desks, and the same session hours.
- **[Minor] The Journal's "Today" means two different days.** In the backtest book it marks the replayed day ("Jul 13 TODAY") while the period pill "Today" refers to the clock's day. "Kept of the best 100%" in the stats panel is cryptic.
  - Evidence: bt2-dark.txt; [shots-practice/j-paper-sept-dark.png](shots-practice/j-paper-sept-dark.png).
  - Fix: "Clock's day" in the backtest book; rename the stat "Kept of the best run-up".
- **[Minor] Tab and label names don't match.** The Paper blotter says Positions / Orders / Trades. The section heading calls Paper "Paper", but the account card and docs say "Live Chart" in comments, and the fill-reason map still has "Closed with the page". Columns differ across tabs: "Up or down" vs "Made or lost" vs "P&L" in the Journal CSV.
  - Fix: choose "P&L" or "Made or lost" everywhere.
- **[Polish] The CSV prints prices to inconsistent precision** ("3.3" next to "2.61"). Format to 2 dp.
- **[Major] No confirmation before any destructive action** in Practice: Flatten, Start over, Take them here, Delete session, Delete desk, and Close (sell all at the bid). See section 1.
- **[Minor] The Earnings board starts on past days.** It opens on Mon–Wed of the current week. On Friday the first three columns read "NO REPORTS", and on a phone the only report (Friday) is off screen.
  - Evidence: [shots-practice/sweep/dossier_earnings-390x844-dark.png](shots-practice/sweep/dossier_earnings-390x844-dark.png).
  - Fix: start the board on today, or hide past days.

### Inferences
- Coherence within each room is good. Most inconsistencies come from Paper being built from the Backtest's parts, so the shared words were never reconciled.

### Gaps
- I did not compare these rooms' shells with the other rooms (Compass, Trace); other researchers cover those.

---

## 4. Accessibility: labels, keyboard, focus rings, ARIA, 44 px targets on a phone

### Takeaway
Keyboard use and focus rings work: every control tabbed to showed a visible ring, the dropdowns work from the keyboard, and the Journal arrow and Esc keys work. But nearly every control is under 44 px on a phone (24–28 px typical; News story rows 17 px), some actions are hover-only, and refusal reasons sit in `title` attributes.

### Cited Findings
- **[Works] Focus rings and keyboard paths.**
  - Tab order is sensible on /practice/backtest (Name → second name → cash → day → fee → three rules → Start → grid headers), /dossier/insiders (How to read → five filters → name cards → headers) and /practice/journal (books → periods → account → sample → months → days).
  - Every focused element showed an outline (1 px solid; 2 px on calendar days).
  - Evidence: kb.mjs output; [shots-practice/kb-focus-backtest.png](shots-practice/kb-focus-backtest.png).
- **[Polish] Focus rings are only 1 px.** CLAUDE.md describes the landing bar's ring as 2 px silver; 1 px is faint at 1440 on the dark ground. Consider 2 px across the terminal.
- **[Polish] A keyboard-opened dropdown doesn't start on the current value.** Opening "Start with" by keyboard and pressing ↓ Enter picked $5,000 (the first option), not the option after $25,000.
  - Evidence: kb.mjs ("keyboard pick cash -> $5,000").
  - Fix: focus the checked item when the menu opens (Radix `DropdownMenu.RadioGroup` with the checked item focused on open).
- **[Major] Phone tap targets are under 44 px (390×844).** Controls below 44 px per page: News 167, StockName 62, Journal 37, Backtest 34, Paper 32, Insiders/Congress 31, Earnings 29.
  - Examples: filter dropdowns 28 px tall; "How to read" 24; Journal period pills 24; Stock page section jumps 24; Stocks sector chips 18; News story rows 17; tape arrows 24×24; Paper interval chips 23; CALLS/PUTS 22; Flatten/New 24; ± steppers 26.
  - Evidence: sweep-main.json `small` lists; paperphone.mjs ("small targets 40").
  - Fix: the landing's `before:` hit-area pattern (CLAUDE.md "ON A PHONE NOTHING TAKES LESS THAN A FINGER") applied to terminal controls below md.
- **[Minor] Hover-only and title-only information.**
  - Delete-desk is invisible without hover (`DeskDoors.tsx:123`).
  - Insiders and Congress column meanings live only in `headerTooltip`.
  - The disabled Buy's reason is in `title` (though the status line repeats it — good).
  - The Journal day-note textareas have only a placeholder (aria-label null in j2-dark.txt). The trade page's three textareas are properly labelled.
  - Fix: show delete on focus-within, and add `aria-label` or a visible label to the day notes.
- **[Minor] Fills and refusals are never announced to screen readers.** Only the backtest bell has `role=status aria-live` (`BellNotice.tsx:88`).
- **[Works] Labels.** The Paper qty field, the steppers ("One contract fewer/more", "A tick lower/higher"), the cancel buttons ("Cancel this order"), session row actions ("Run … again", "Delete …") and the layout doors carry aria-labels. No unlabelled buttons or inputs were found by the sweep (`unlN` = 0 on every route).

### Inferences
- The desktop keyboard story is solid. The phone touch story is the gap.

### Gaps
- No screen-reader run (NVDA/VoiceOver), so the AG Grid announcements and chart canvases weren't checked.

---

## 5. Copy: banned words, words that reveal invented data, "paper money" / "projected", typos

### Takeaway
None of the literal banned words (simulated, demo, fake, preview, pretend, at launch, grade, score, win rate, guaranteed, confluence, market intelligence) appears anywhere in visible text, titles or aria labels on the 16 routes × 8 viewport and theme combinations. But several lines plainly tell the reader the data is invented or not live, which breaks the owner's 2026-10-01 rule in substance. The News "Playbook" also gives explicit trade calls.

### Cited Findings
- **[Works] No literal banned word was found.** Searched: visible text in `main`, `title`, `aria-label`, `placeholder`, `alt` and `document.title` on every swept route.
  - Evidence: sweep-main.json `hits` = [] on all 128 loads.
  - "Paper money" is used correctly (Paper subtitle; Backtest "Start with … The paper money the session starts with"; "Money: Paper — nothing reaches a broker").
- **[Major] Visible lines say the people are invented or the figures are a sample** (owner rule: the UI never reveals simulation).
  - Congress box subtitle: "Every report in the window, newest filing first · **the people are invented until the feed lands, the shape is the real one**" (`src/pages/record/Congress.tsx:305`; [shots-practice/d-congress-dark.png](shots-practice/d-congress-dark.png)).
  - Congress lag tooltip: "Filed before the trade date — **a filing artefact real feeds carry**" (`Congress.tsx:147`).
  - Insiders box subtitle: "… **the people are invented until the feed lands**" (`src/pages/record/Insiders.tsx:306`). Insiders column tooltip: "**invented names until the feed lands**" (`Insiders.tsx:268`).
  - Stocks page: a "**SAMPLE**" badge on "The numbers", and the footer "**sample until the feed lands**" (`src/pages/record/StockName.tsx:1026-1027`). The Why-now text reads "overvalued (**a sample until the feed lands**)" (`src/data/stockOverview.ts:643`). Source stamps: "**the shape is real, the people are invented until the feed lands**" (`stockOverview.ts:686, 765-766`), with the "**6 of 9 sources live**" count. Evidence: [shots-practice/sweep/dossier_stocks_ZZZZ-1440x900-dark.png](shots-practice/sweep/dossier_stocks_ZZZZ-1440x900-dark.png).
  - Stock guide: "The numbers are a sample until the fundamentals feed lands, and say so" (`src/components/record/StockGuide.tsx:223`).
  - Paper desk footer: "Practice, not advice. What is open is closed when the page closes: **the market starts fresh on every load**." (`src/pages/paper/Desk.tsx:495`; [shots-practice/p-paper-phone-390-dark-1600.png](shots-practice/p-paper-phone-390-dark-1600.png)).
  - Paper "Prices: Streaming" tooltip: "It trades round the clock and **starts fresh every time the page loads**" (`src/pages/practice/PracticeLayout.tsx:81`).
  - Paper second tab: "**each tab runs its own market**" (`src/pages/paper/Desk.tsx:590`; [shots-practice/p-paper-tab2-dark.png](shots-practice/p-paper-tab2-dark.png)).
  - Backtest sentence: "trade it at its **real** bid and ask" and Earnings "the last eight **real** prints". These are claims of realness on invented data, the other side of the same rule.
  - Fix: delete the "invented / sample / until the feed lands / starts fresh / runs its own market" clauses. Keep the owner-approved neutral labels; source stamps can show times only. If a status is needed, use "Delayed", never "sample".
- **[Major] The News "Playbook" makes trade calls, and the News card states odds.**
  - What: depending on the story, the playbook reads "buy the first pullback rather than the open print", "sell into the pop if it overshoots the expected move", "fade bounces while the 5-day expected move stays negative", or "Stack it with flow and positioning before acting".
  - Alongside: "ODDS NEXT SESSION down 73% / up 27%" and "Confidence: good".
  - This contradicts the landing's promise ("A read, never an instruction") and the ban on "signal (as a trade call)".
  - Evidence: `src/data/news.ts:231-240`; `src/pages/record/News.tsx:363`; [shots-practice/d-news-loaded-dark.png](shots-practice/d-news-loaded-dark.png).
  - Fix: rewrite the Playbook as a description ("Stories like this have kept moving for several sessions"). Rename "Odds next session" to "How similar stories closed next session".
- **[Minor] Rating words come close to the banned "grade" and "score".**
  - Stocks reads every name and pillar on a four-step scale: "poor / caution / good / strong" ("Reads poor", "The trend poor", "SCREEN … CAUTION").
  - A section jump's internal id is "score" (`data-stock-jump="score"`, not visible).
  - "Won 37%" (Journal), "Won 100%" (Report) and "· 33% won" (calendar cells) are a win rate in all but name (`src/pages/review/Report.tsx:99`, `src/pages/review/JournalHome.tsx:329`).
  - Evidence: [shots-practice/sweep/dossier_stocks_AAPL-390x844-light.png](shots-practice/sweep/dossier_stocks_AAPL-390x844-light.png); [shots-practice/j-paper-sept-dark.png](shots-practice/j-paper-sept-dark.png).
  - Fix: owner's call. If "win rate" is banned in spirit, show "16 of 43 closed up" without the percentage.
- **[Polish] Duplicated tag on News.** The selected story shows "MACRO · NEGATIVE · MACRO". The tape's first headline is cut mid-word at the left edge ("raffic through Hormuz").
  - Evidence: [shots-practice/d-news-loaded-dark.png](shots-practice/d-news-loaded-dark.png).
- **[Polish] Stale code comments.** The subnav says "Four pages under one head" but there are five (`src/pages/record/subnav.ts:7-10`). PracticeLayout's header comment still says the page shows "Simulated feed" (`src/pages/practice/PracticeLayout.tsx:16-19`). These are comments only, not visible.
- **No typos found** in the visible strings sampled. The only redundancy is "Cancelled — cancelled by you".

### Inferences
- The literal word ban was fully enforced, but explanatory clauses written for the developer ("until the feed lands") leaked into the UI. A grep for `feed lands|invented|sample|real feed|starts fresh|own market` over `src/pages` and `src/data` finds every one.

### Gaps
- The scan ran on the default state of each route. Text that appears only in states not reached (evaluation passed or failed, spreads, every News story's playbook variant) was checked only through source greps, not on screen.

---

## What works well (summary)
- **Redirects:** every legacy Dossier and Practice route redirects correctly, keeps its parameters, and maps Review journal links to `?book=backtest`.
- **Technically clean:** no runtime console errors, failed requests or AG Grid warnings; no page-level horizontal overflow; no 0-px grids at any size.
- **Filters and sorts:** all Dossier filters and sorts work, with sensible empty states ("No report on the next two weeks' calendar", "Nothing closed in this period").
- **Order ticket:** refusals are explicit and in plain words, a big strength. The bracket validation explains itself. The backtest's own rules block correctly and say so.
- **Backtest:** the bell card, next-day flow, "Run again", rename, report and journal integration all work, and missing sessions or trades get a clear page with a way back.
- **Journal:** calendar, day panel, trade page with ← → Esc, persistent notes, tag lists and CSV export are complete and keyboard-friendly.
- **Keyboard:** focus is visible everywhere tested, and the house dropdowns work from the keyboard.
