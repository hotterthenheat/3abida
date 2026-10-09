# Trace room UX/UI audit (/trace and its 15 addresses)

Scope: `/trace` and live-tape, screener, net-flow, footprints, watchers, flow-alerts, windows, intervals, odte, multi-leg, compare, dark-pool, dark-feed, scanner and tracker. The app ran on http://localhost:5300 (dev build). It was driven by Playwright (Chromium) at 1440×900, 1280×720, 1920×1080 and 390×844, in dark and light. Every dropdown option on every page was picked. Every page was also tested for search, the expiry calendar, Live/Paused, the guide, the column chooser, a header sort, a row click (the card), the card's Next/↑↓/Esc, every champion, the bookmark, Link, Save and "Show all". The repo was only read; nothing in it was changed.

Paths below are relative to `/home/user/3abida/research_notes/Slayer full UX UI audit/shots-trace/`:
- `<page>-<vp>-<theme>.png`: viewport shots.
- `ix/`: interaction shots (open dropdown, expiry, search, guide, columns, card).
- `phone/`: 390 px scrolled shots.
- `full/`: full-page shots.

Raw logs (crawl JSON and interaction logs) are in `/tmp/claude-0/-home-user-3abida/3f13cba1-d81b-5e53-bbee-8bc889ed9a96/scratchpad/audit-trace/`.

Severity scale: **Broken** (wrong, or does nothing) · **Major** (misleads or blocks a common task) · **Minor** · **Polish**.

Caveat on timing: the machine ran at a load average of 50–70 on 4 cores during the audit, because other audits' browsers were running too. Times from page open to first content of 7–36 s, and "Show all" taking 2–13 s, were measured under that load. They are not counted as findings; re-measure on an idle machine.

---

## 1. Does every control on every sub-page work and give feedback?

### Takeaway
Most controls work: every dropdown re-cuts the grid, writes the address (Tape and Screener) and rewrites the sentence. Search, Live/Paused, Link, Save, the bookmark, "Show all" and all four old addresses work. Twelve things do not work:
- the Expiry calendar does nothing on Watchers and Windows;
- the Compare "Leans bullish" champion compares a name with itself;
- ↑/↓ promised on the card works only on Live Tape;
- Esc stops closing the card;
- the Net Flow search puts a made-up ticker on the chart;
- the Screener's expiry is left out of its link and saved screens;
- Footprints' spark column vanishes on paper;
- the card shows a 692% "spread + theta" figure;
- Windows and Watchers lay the session over a 24-hour clock.

### Cited Findings

**Room-wide (all grid pages)**
- **Broken: the card promises ↑/↓ but only Live Tape listens.** The card's buttons read "Previous print (↑)" / "Next print (↓)". ArrowDown changed the card on Live Tape and on no other page (Screener, Footprints, Watchers, Windows, Multi-Leg). The Next button itself works everywhere.
  - Evidence: drill.log, lines "after ArrowDown …" are unchanged. The key handler exists only in `src/pages/trace/LiveTape.tsx:568-578`; `src/components/trace/BookDrill.tsx` has none.
  - Fix: move the ↑/↓ listener into `PrintDrilldown`, or into `BookDrill` the same way LiveTape does it.
- **Broken: Esc does not reliably close the card.**
  - Watchers: the first Esc closed it. After pressing the card's "Next print", Esc no longer closed it.
  - Live Tape: Esc did not close the card even with no other click.
  - Evidence: esc.mjs output — `live-tape after Esc (no other click) 1`, `watchers after Next then Esc 1`. `src/components/ui/Modal.tsx:80` ignores any Escape whose `defaultPrevented` is set. A focused AG Grid, or a button inside the card, appears to set it.
  - Fix: listen in the capture phase at the Modal, or close on Escape whenever the event target is inside the dialog or the grid behind it; add a regression test.
- **Major: Esc does not close the "How to read" guide** on Screener, Net Flow, Footprints, Watchers, Multi-Leg, Compare, Dark Pool, Tracker or 0DTE ("guide after Esc open? 1" in ix-rest.log). It closed once on Live Tape, then not in esc.mjs. The guide also never takes focus (`focus in guide false`).
  - Fix: move focus into the guide when it opens, close it on Escape, and return focus to the "How to read" door.
- **Major: horizontal grid overflow, with its scrollbar at the very bottom of the grid.** Every grid grows to full height (autoHeight), so its horizontal scrollbar sits under row 80 — 1,341–4,645 px down the page (`hbarTop` in ix-rest.log). Columns off the right edge:

  | Page | 1440 | 1280 |
  |---|---|---|
  | Live Tape | ΔOI, Vol/OI, IV, Tag (264 px) | Day ratio, Sentiment, ΔOI, Vol/OI (424 px) |
  | Screener | Vol/OI, Sweep, Floor, Multi, Lean, Sector (614 px) | **Prem** and IV·Δ too (774 px) |
  | Footprints | Prev avg, Prev $, Streak, Prev day (358 px) | — |
  | Watchers | Earnings (56 px) | Vol/OI, OTM %, Earnings (216 px) |
  | Windows | Floor, Multi, Vol/OI… (694 px) | — |
  | Multi-Leg | IV, Delta, Theta (370 px) | **Max loss, Max profit** (530 px) |
  | Dark Pool prints | Conviction, What it says (100 px) | **Read**, Conviction (260 px) |
  | Tracker | Lean then → now | — |

  Evidence: crawl-d1440.log, crawl-dother.log; `dark-pool-d1280-light.png` ("DISTRIBUTI" cut); `live-tape-d1440-dark.png` ("+2,6" cut).
  - Fix: pin Ticker/Contract on the left (`pinned: 'left'`), and add a sticky horizontal scrollbar or a "fit columns" mode. Default-hide low-value columns below 1440 so that Prem, Read and Max loss/profit always show.
- **Major: rows cannot be opened from the keyboard.** `suppressCellFocus` (`src/components/trace/TraceBox.tsx:432`) means Tab reaches the column headers and the in-cell buttons (bookmark), never a row. The card opens on a mouse click only (`onRowClicked`).
  - Fix: allow cell/row focus and open the card on Enter or Space; or give each row a real button.
- **Minor: the card does not take focus and does not give it back.** After opening, focus stays on a DIV behind it (`focus in dialog false`). After Esc, focus lands on BODY (drill.log). `Modal.tsx` has no focus trap.
  - Fix: focus the card's heading or Close button on open, trap Tab inside, and return focus to the row on close.
- **Minor: Live Tape's card uses a 12-hour clock ("6:03:43 PM") while its column uses 24-hour ("18:03:43").** Book cards use 24-hour (drill.log). Fix: format the time with the tape's `to24h` (`LiveTape.tsx:186`) inside PrintDrilldown.
- **Minor: the card's figures contradict each other.**
  - "SUMMARY … printed as a single block" sits beside "×2 legs CUSTOM" (`ix/screener-dark-drill.png`).
  - "filled $0.36" is outside its own 0.37 × 0.39 market.
  - "THE PRINT $191.7K SOLD" is in bear red beside a green "BULLISH".
  - Fix: build the summary from the leg count, clamp the synthetic fill inside the bid/ask (`bookRowToPrint`), and stop inking SOLD/BOUGHT by bull/bear.
- **Major: the card shows "spread + a day of theta take 692.0%"** on CRM 262.5C 0DTE (`ix/watchers-dark-drill-15s.png`). The cause is `PrintDrilldown.tsx:375,596-597`: `spreadPct + thetaPerDayPct` is unbounded on near-expiry or cheap contracts.
  - Fix: cap the figure or label it ">100%", or use dollars for 0DTE.
- **Minor: Save uses the browser's native `window.prompt`** (`src/components/trace/SavedCuts.tsx:60`): an unstyled system dialog in the middle of a terminal page.
  - Fix: an inline name field in the cards line.
- **Polish: the "Link copied" / "Saved as" status line never clears** (`SavedCuts.tsx` sets it and never resets it).
- **Minor: ↑/↓ are not reachable for a book card from inside the grid either.** Covered by the first item.

**Live Tape (`/trace` redirects here; `/trace/live-tape`)**
- Works:
  - Order (Stream/Notable/Premium/Size), Kind, Lean, Premium and Expiry all re-cut the tape and write `?order=…&kind=…&lean=…&prem=…&exp=…`.
  - Search "NVDA" narrowed to 25 prints and wrote `?q=NVDA`.
  - "ZZZZ" showed "No prints on this cut — Loosen a card…".
  - Champions open the card. The bookmark flips to "Untrack this print". Link says "Link copied". Save prompts and adds "1 saved". "Show all" toggles 80/120.
  - Evidence: buea4kc6x output, `ix/live-tape-dark-*.png`.
- **Major: the P/C fact is a count ratio, labelled as a premium ratio.** The tooltip says "put premium against call premium" (`LiveTape.tsx:838`), but `pcRatio = putCount/callCount` (`src/data/tape.ts:231`). On screen: "4C $169.3K / 4P $464.5K · P/C 1.00" (`live-tape-d1440-dark.png`).
  - Fix: compute putPremium/callPremium, or relabel it "P/C (count)".
- **Major: every print that is not a sweep is counted and filtered as a "block".** `blocks: prints.length - sweeps` (`tape.ts:234`) and Kind=Blocks = `!r.sweep` (`LiveTape.tsx:440`). A 17-lot "Custom" or "Ratio" print becomes a "Negotiated size, one print" block (`live-tape-d1920-dark.png`: Tag "Custom", "Ratio", "—").
  - Fix: give blocks their own flag (size or premium threshold, single print). Name the remainder "Other" and add "Multi-leg" as a Kind.
- **Major: the sentence's claim does not match the money it cites.**
  - "Bullish tape — aggressive call buying leads by $156.6K" was shown while puts were $464.5K vs calls $169.3K.
  - With Lean=Bearish, "put premium leads by $4.9M" was shown while the largest bearish print was a call (QQQ 411C).
  - The net is bull minus bear by sentiment, which includes puts sold and calls sold (`LiveTape.tsx:209-211`).
  - Fix: say "bullish premium leads by $X (calls bought + puts sold)", or split the claim.
- **Minor: Lean has no "Neutral" option, but the address accepts `lean=neutral`** (`LiveTape.tsx:101` vs `:150-154`). The hint for "Both ways" says "Bullish and bearish prints", but the tape includes MID/neutral prints.
  - Fix: add "Neutral (mid)" and say "Every print" for the default.
- **Minor: Premium ≥$500K and ≥$1M often return 0 prints**; that was the case at both tests (largest print about $375–550K).
  - Fix: steps drawn from the session's distribution (for example $50K / $100K / $250K), or show the count beside each option.
- **Minor: the Flow bar is green/red by aggressor side**, which `LiveTape.tsx:236-240` says must not happen: "NO BULL/BEAR INK ON THE SIDE … makes a bought put look bullish". The FlowCell (`:282`) and the Day ratio cell (LeanCell, "BID 71%" red / "ASK 69%" green) do exactly that.
  - Fix: neutral ink for side-pressure bars; keep green/red for sentiment only.
- **Minor: about 120 px of empty table on open.** The tape opens with 8–15 prints (`live-tape-d1440-dark.png`) and fills over time. Fine for a live tape; consider seeding to the buffer cap.
- **Polish: the tape is the only Trace page without the Live/Paused hold.** The owner removed it on purpose (2026-09-12); this is noted for consistency only.

**Screener**
- Works: all 8 Screens, Side, Tenor (multi), Volume, Premium and Money re-cut the rows and the address. Hold freezes the sentence. Champions, bookmark, Link and Save work (ix-rest.log).
- **Major: Expiry is not in the address or in saved screens.** `filtersToParams` has no expiry (`src/data/screenerViews.ts:41-50`). After picking "Today · Oct 9" the address stayed `?tenors=…` (ix-rest.log). A shared or saved screen silently drops its expiry; Live Tape's link keeps `exp=`.
  - Fix: add `exp` to the params, the validation and the saved views.
- **Minor: two cuts that cannot both be true still end in "Nothing on this cut yet."** Tenor without 0DTE plus Expiry = Today gave 0 rows. "yet" suggests waiting (`OptionsScreener.tsx:203`). The calendar also offers dates that the other cards exclude.
  - Fix: say which cards conflict, drop "yet", and grey out expiries the other cards exclude.
- **Minor: half the cut persists, half does not.** Filters persist in localStorage (`FILTERS_KEY`) but Screen, search and Expiry do not. Reopening the page brought back a Tenor of "Weekly, Swing +1" with no visible reason.
  - Fix: persist the whole cut, or none of it; the address is already the source.
- **Minor: Tenor with all four selected reads "0DTE, Weekly +2", not "Any".**
- **Minor: the "Last" header means the time of the last print, but sits beside "Fill · Chg".** It reads as last price. Rename it "Time".
- **Minor: champion and card disagree.** The "Top call COIN 252.5C · $40.6M" champion opens a card headed "THE PRINT $1.7M". The champion is the day's total, the card one print. Label one of them.

**Net Flow (framed page)**
- Works: Expiry, Money, Clock, hold, board clicks and champions all put the name on the pane (ix-rest.log). On a phone the board stands over the pane, and each scrolls (`net-flow-m390-dark.png`).
- **Broken: the search puts whatever is typed on the pane, with a chart.** Typing "ZZZZ" (or any fragment, such as "N") sets `picked='ZZZZ'`. The pane shows "ZZZZ ZZZZ" letter logos, a fabricated ~$335 price line, "$0 / $0" and a flat orange line, with no message (`ix/net-flow-dark-search-empty.png`). Cause: `NetFlow.tsx:205` `onChange={v => setPicked(v ? v : null)}`.
  - Fix: pick only on a suggestion or Enter of a known name; while typing, keep the last real name; show "No contracts for ZZZZ today".
- **Minor: the ticker's logo shows twice in the pane head ("G G GOOGL", "SPY SPY").** Both `CompanyLogo` and `Name` (which carries its own mark) render when `onTicker` is absent (`src/components/trace/NetFlowPane.tsx:591-596`). Same on Compare (`compare-d1440-dark.png`).
  - Fix: drop the separate CompanyLogo, or render `Name` without its mark.
- **Minor: picking an Expiry silently swaps the pane's name** (GOOGL → COIN), because `sel` falls back to the leader of the new cut. Keep the name the reader was looking at if it is still on the cut.
- **Major: "of it" implies parts that sum to the whole; here they do not.** "+$113.6M net … +$104.5M of it in calls and -$9.1M in puts": 104.5 + (−9.1) ≠ 113.6, because puts are subtracted (net = calls − puts) (`net-flow-d1440-dark.png`).
  - Fix: "calls +$104.5M, puts sold −$9.1M" with "net = calls − puts" in the guide, or show put premium as bullish-signed.
- **Minor: the pane's first x-axis label is clipped (":15")**, and the axis runs to 18:00, past the 16:00 close (`net-flow-d1440-dark.png`, `ix/net-flow-dark-search-empty.png`). See time zones under question 2.
- **Polish: "Clock: All clocks" is odd wording for tenor.** Use "Tenor: Any", as the Screener does.

**Footprints**
- Works: all Cut options, Side, Expiry (165 → 31 rows), search, hold, chooser, champions, bookmark and Show all (ix-rest.log).
- **Major (light theme): the Prev-day spark is invisible on paper.** The fill is the literal `rgba(237,237,237,0.6)` (`src/pages/trace/Footprints.tsx:83`). Measured fill on a white `rgb(255,255,255)` background (spark.mjs). See `ix/footprints-light-scrolled-right.png`.
  - Fix: `rgb(var(--ink) / 0.6)` per the theme rules.
- **Minor: the "Fastest build" champion is a near-zero base, "COIN 242.5P · +46,175%"** (prev OI 77). Put a floor on prior OI (for example ≥500) for the % ranking.
- **Polish: "…120 shed 439,757" is hard to parse.** Write "120 contracts shed 439,757".
- **Minor: Footprints names its screen "Cut"; the Screener says "Screen" and Live Tape "Order".** No Link/Save and no address state here, while Screener and Tape have them.

**Watchers (`/trace/flow-alerts` redirects here)**
- **Broken: Expiry does nothing.** Picking 10/14 set `data-expiry=2026-10-14`, but rows stayed at 132 and still showed 10/11, 10/09 and 11/08 expiries (wexp.mjs). Cause: `buildCatches` caches on `${day}-${nowMin}-${reasons}` and ignores its input rows (`src/data/flowBook.ts:470-471`). Any change of input within the same minute returns the old catches.
  - Fix: include a signature of the input (expiry scope plus row count or keys) in the cache key, as `intervalWindows` does.
- **Major: the key column, Reason, is cut mid-word at 1440** ("The same cor", "One print carr", "Kept printing a") (`watchers-d1440-dark.png`).
  - Fix: give Reason flex with a minimum around 220 px, or wrap to two lines.
- **Major: catches are scheduled across 00:30–23:45 local time** (`flowBook.ts:481`, `minute = 30 + h*1395`). The "Top bid" card showed a 09:20 print, before the 09:30 open. See time zones under question 2.
- **Minor: the Side column paints ASK green and BID red** (`Watchers.tsx:342`; champions "Top ask" bull ink, "Top bid" bear ink). This is the same side-as-direction ink that Live Tape's own comment rejects.
- **Polish: the reason dots are literal pastel hex** (`Watchers.tsx:87-92`), not tokens; the pale yellow `#E0D080` dot is faint on paper.

**Windows (`/trace/intervals` redirects here)**
- **Broken: Expiry does nothing.** Rows stayed at 294 after picking 10/14 (wexp.mjs). Cause: `buildIntervalSlices` caches on `${day}-${nowMin}-${idx}` and ignores its rows (`flowBook.ts:597-598`). Fix as for Watchers.
- **Major: the day strip runs 00:00–20:00 with volume in every quarter hour**, labelled against 09:30/16:00 session marks. Examples: "00:00–00:15 · 67,481 contracts"; the window "17:45–18:00" after the 16:00 close (`windows-d1440-dark.png`; phone.log). `WINDOWS_PER_DAY = 1440/15` (`flowBook.ts:516`) uses the browser's local clock.
  - Fix: build windows only over 09:30–16:00 New York time and label them in ET.
- **Minor: the strip's hover and the facts disagree for the same window** ("65,623 contracts" vs "65,242", `windows-d1440-dark.png`).
- **Minor: the empty state says "try a wider window"**, but the window width is fixed at 15 minutes (`Windows.tsx:454`).
- **Minor (phone): "LATEST" overflows to x = 416 on a 390 px screen.** The day-strip slots are 4 × 44 px, impossible to tap (phone.log).
- **Polish: the "Burst" champion can be weak** ("PLTR 30C · 4% of its day"). Hide it below a threshold.

**0DTE (framed page)**
- Works:
  - Panes 1/2/3/4 re-lay the desk (`ix/odte-dark-*-pane*.png`).
  - Fullscreen opens, and Esc exits.
  - The pane search offers only SPY/QQQ/IWM plus a door "NVDA — on Net Flow's 0DTE clock", which navigates to Net Flow (special.mjs).
  - On a phone each pane is 420 px tall (`odte-m390-dark.png`).
- **Major (light theme): every chart pane is a hard-coded dark island on paper** (`NetFlowPane.tsx:585` `data-theme="dark"`, literal colours `:79-94`). See `odte-d1440-light.png`; the same on Net Flow and Compare. The owner's rule for Terrain is that charts follow the ground ("both the charts are either dark or white not dark and white").
  - Fix: read inks via `resolveInk`/`readToken` and drop `data-theme="dark"`.
- **Minor: the same number has two colours.** "Net puts +$38.5M" is red in the facts and green in the sentence (RichRead inks every "+$" green) (`odte-d1440-dark.png`).
- **Minor: the head facts and the "Everything" pane disagree on screen at the same moment** (net calls $32.5M vs $33.3M; puts $38.5M vs $39.1M, `odte-d1440-dark.png`). The head's `paneTimes('SPY')` is memoised on `[book]` only (`Odte.tsx:157`).
- **Minor: the page is named 0DTE but counts "contracts expiring today or tomorrow"** (dteMax 1).
- **Minor: Enter in a pane's search for a non-complex name leaves the page for Net Flow** without warning. Require a click on the door row.
- **Minor: the Fullscreen control is an icon with only `title`**: no aria-label, about a 20 px target. The overlay has no `role="dialog"` (special.mjs).
- **Polish: a pane's right-axis top label is clipped under the head** ("$50.0M"). The QQQ pane head wraps its fullscreen icon onto its own line.
- **Polish: a flat red "net puts $0" line on SPY reads as broken** (`odte-d1440-dark.png`, `odte-d1440-light.png`).

**Multi-Leg**
- Works: Shape and Money filters, Expiry (76 → 22), search, hold, chooser, champions and the structure card. The card's "Weigh it" goes to `/weigher` and "The board" to `/compass` (special.mjs).
- **Minor: a strike's tooltip says "Open this contract on the tape", but it opens a card in place** and the address stays `/trace/multi-leg`.
- **Minor: the subtitle says "their defined risk"**, but rows show "Max loss Uncapped" (ratios, straddles) (`multi-leg-d1440-dark.png`).
- **Polish: strategy dots are literal hex** (`MultiLeg.tsx:65-71`, `#93B87A` sage, `#E0D080` pale yellow) and faint on paper.

**Compare**
- **Broken: the "Leans bullish" champion makes A and B the same name.** Clicking it gave `a:"QQQ", b:"QQQ"` (and later `NVDA/NVDA`) (special.mjs, `ix/compare-dark-leans-bullish-click.png`). Code: `onOpen={() => (moreBullish.ticker === A ? setBQuery(A) : setAQuery(B))}` (`src/pages/trace/Compare.tsx:414`).
  - Fix: open that name's heaviest contract, or put the bullish name on the Net Flow pane; never write it into the other slot.
- **Major: A and B may be the same name** (typing SPY into B with A=SPY is accepted; special.mjs). Fix: block it, or offer "swap".
- **Minor: a typed fragment keeps showing while the page still compares the last real name** (B field "NV" while B = SPY). Fix: show "not on today's book" or revert the field on blur.
- **Minor: "Heavier book" and "Busier tape" open the same contract card** (SPY 475C). "Busier tape" opens a book contract, not a tape print.
- **Minor: one Money/Clock state is shared by both panes.** Changing pane A's Money silently changes B's (`Compare.tsx` single `mny`/`tenor`). That is the intent ("the same cut"), but nothing on screen says so; label it "Both panes".
- **Broken (phone): the ledger runs off the screen and its rows overlap.** The value columns end at x = 418–444 on a 390 px screen. The B column is cut, and two-line labels ("0DTE puts", "Calls · puts") overlap the next row because rows are a fixed `h-8` (`phone/compare-390-dark-s2.png`; `Compare.tsx:469,482` `grid-cols-[1fr_180px_180px]`).
  - Fix: on a phone use `grid-cols-[1fr_auto_auto]` with `min-h-8`, or stack A over B.
- **Minor (phone): the A / vs / B / swap controls are scattered by the 2-column cards grid** (`compare-m390-dark.png`).
- **Minor: the "carries the row" ◆ on negative rows is ambiguous.** For "Net puts −$2.4M vs −$3.8M" the diamond goes to SPY.
- **Minor: "+$0 puts" is shown in bear red** in the same-day strip.

**Dark Pool (`/trace/dark-feed` redirects here)**
- Works:
  - Read, Size, Where and Sector filters; the shell's ticker picker.
  - Shelf clicks cut the grid, and a removable chip appears.
  - A leader-grid row puts the name on the box above and scrolls up.
  - Champions toggle the shelf or change the name.
- **Major (1280): the Read and Conviction columns are off-screen** (see the overflow table). These columns are the reason the page exists.
- **Minor: "Posture: Distributing −100%" and "Building · leaving $0 · $4.2B" read as broken extremes.** "Defended 5×" appears on every shelf, which suggests a cap (`dark-pool-d1440-dark.png`).
- **Minor: the TIME header is truncated to "TI…"** beside its sort arrow.
- **Polish: a shelf's distance from spot is inked bull/bear** ("RESISTANCE $480.02 +0.46%" in green). It is a distance, not a change; use neutral ink.

**Tracker**
- Works: marks from Screener/Tape appear (3 marked → 3 rows); Expiry (5 → 2); a row opens the card.
- **Minor: the wrong empty state when a filter hides marks.** Search "NVDA" with 5 marks showed "Nothing under watch — Mark a print anywhere…" (ix-rest.log). Fix: "None of your 5 marks match NVDA".
- **Minor: the empty page says it twice** ("Nothing under watch yet." in the sentence and "Nothing is under watch. The mark…" in the body; `FlowTracker.tsx:413,496`). It also shows dead Live/Search/Expiry controls (`tracker-d1440-dark.png`).
- **Minor: the "Show all" noun is "prints" for a list of contracts, prints and structures** (`FlowTracker.tsx:499`).

**Old addresses**: flow-alerts → watchers, intervals → windows, dark-feed → dark-pool, scanner → screener, and `/trace` → live-tape all redirect correctly at every viewport (crawl-d1440.json, crawl-m390.json).

**What works well**
- One house grammar on every page: the box, the facts, champions, one line of cards, the sentence, the grid. Once learned it carries across all 11 pages.
- Strong empty and loading wording ("Loosen a card — …").
- Tape and Screener cuts live in the address and can be shared or saved.
- The search groups tickers then contracts, with counts (`ix/live-tape-dark-search.png`).
- The expiry calendar offers only real expiries (`ix/live-tape-dark-expiry.png`).
- The card is very rich, and it stays open through live updates for 15 s or more (drill.log).
- Guides with drawn examples (`ix/live-tape-dark-guide.png`).
- Live/Paused freezes the sentence and the grid together.
- The 80-row page plus "Show all" keeps first paint light.
- No console errors on load, no failed requests, and no page-level horizontal scroll at any viewport.

### Inferences
- The Watchers and Windows expiry failures share one root cause: minute-keyed module caches in `flowBook.ts` that ignore their input. Other functions in that file with the same pattern (`navCache`, `catchCache`, `sliceCache`) should be checked.
- The "side inked as direction" rule is broken in at least four places: Flow bar, Day ratio, Watchers Side, and the card's SOLD/BOUGHT. One shared neutral "side" ink would fix all of them.

### Gaps
- The bookmark on Tracker rows: clicking "Untrack" reported `aria-pressed=true` before and after. Whether the row is removed or only dimmed ("gone") was not confirmed.
- The double-click "reset view" on panes, and drag/zoom inside charts, were not exercised.
- The card's lower panels (Dealer map, Monitor strike, Weigh it, Track print doors; 1D–1M and 1m–30m toggles) were listed but not each clicked.

---

## 2. Console errors, failed requests, loading states, clipping, illegible text and contrast at 1440/1280/1920/390 in dark and light

### Takeaway
The room is clean at runtime: no failed requests, no page errors, one React DOM-nesting error. The real problems are four:
- tiny type (9 px grid headers and many 8–9 px cells and labels);
- columns and long lines clipped below 1920;
- hard-coded dark chart islands and a white spark on the light theme;
- a clock mismatch: Trace runs on the browser's local clock but marks a New York session.

### Cited Findings
- **Console:** one error on Live Tape and Screener — `Warning: validateDOMNesting: <p> cannot appear as a descendant of <p>` (ix logs). Cause: TraceBox renders the sentence as `<p>` (`TraceBox.tsx:132`), and the pages put a `<p role="status">` inside it (`LiveTape.tsx:899`, `OptionsScreener.tsx:393`). **Minor.** Fix: make the sentence a `<div>`.
- No failed requests (`fails 0`) and no React Router or AG Grid warnings, and no AG Grid development panel, on any route (crawl JSON). Grids are never 0 px tall on a phone: 501–3,153 px, with 12–80 rows (crawl-m390.log).
- **Loading:** no loading state that never resolves. One skeleton was still shown after 7–9 s while the machine was overloaded (`windows-d1440-light.png`, `net-flow-d1440-light.png` with the rail quote "SPY —"). Not attributable; see the caveat at the top.
- **Major: time zone.**
  - The status bar said "Market open" at 17:41–18:15 on the browser's clock, which was UTC.
  - Tape times, windows (00:00–20:00), catch times (09:20) and pane x-axes (to 18:00) all use the local clock.
  - The day strip marks 09:30/16:00 as the session.
  - Evidence: `windows-d1440-dark.png`, `net-flow-d1440-dark.png`, `live-tape-d1440-dark.png`. The project notes set films to New York time ("AT, New York's zone").
  - Fix: one session clock in America/New_York for every Trace time, labelled "ET".
- **Truncated text at 1440:**
  - The box sub-lines are `whitespace-nowrap truncate` (`TraceBox.tsx:109`; shell `TraceLayout.tsx` subtitle). They cut the instruction "a row opens the print's card, the mark at its left keeps it…" on Live Tape, Screener, Footprints, 0DTE and Compare (`*-d1440-dark.png`), and nearly the whole sub-line on a phone.
  - Watchers Reason column (above); the Dark Pool "TI…" header; Footprints "PREV D…"; the card chart's "THIS PRIN".
  - Fix: let the sub-line wrap to two lines, or move the "a row opens …" hint into the guide.
- **Major: very small type (dark, 1440; font-size counts from the crawl).**

  | Page | 9 px | 8 px |
  |---|---|---|
  | Live Tape | 151 | — |
  | Net Flow | 114 | 2 |
  | Windows | 81 | 8 |
  | Footprints | 81 | — |
  | 0DTE | 9 | 8 |
  | Compare | 28 | 4 |

  - Grid headers are 9 px uppercase (`houseGrid.ts` `headerFontSize: 9`).
  - The tape's bid/ask, "vol · oi", side word, legs and tag are 9 px (`LiveTape.tsx:246-270,612,788`).
  - Pane head labels and the SegPick group label are 8 px (`NetFlowPane.tsx:163,621,625`).
  - Fix: raise the floor to 10–11 px (headers 10, sub-figures 10). The landing's own rule is 11 px minimum; apply a 10 px floor in the terminal.
- **Contrast (WCAG ratios computed in the crawl):**
  - Dark: the Screener's ΔOI%/chg sub-figures `text-[10px] opacity-80` red measure 3.86:1 at 10 px (`OptionsScreener.tsx:277`). **Minor**: drop the opacity.
  - "Live" breathes 0.3 → 1 every 1.4 s (`index.css:992-997`). At the trough it measures 2.0–4.2:1, and the whole control looks disabled (`net-flow-m390-light.png`). The owner accepts Trace's breathing Live as low-contrast by design. Suggestion: breathe a dot inside the button, not the button.
  - Light: bull and warn inks measure 4.27–4.37:1 at 9–12 px. This is accepted by the owner's rules (pure hues, about 4.3:1); not a finding.
  - Reset 1.55:1 is by design.
- **Light theme:**
  - Chart panes on 0DTE, Net Flow and Compare stay black on paper (**Major**, question 1).
  - Footprints' spark is invisible on paper (**Major**, question 1).
  - Literal hex for Watchers dots, structure dots, DayStrip (`DayStrip.tsx:62-63`) and the card chart (`ContractFlowChart.tsx:59-64,451-452,751-809`, forced dark via `data-theme="dark"` `:378,690`) all break "every colour is a token".
- **Phone (390×844):**
  - Every grid shows about 2.5 columns (Time, Ticker, part of Contract). Hidden widths are 854–1,492 px (crawl-m390.log), so the reader must swipe sideways for premium, side or anything else (`live-tape-m390-dark.png`, `phone/windows-390-dark-s1.png`). **Major.** Fix: a phone row layout with 2–3 stacked lines, or pinned ticker/contract plus the 3 key figures.
  - The back-to-top button covers the last column (`phone/windows-390-dark-s1.png`). Polish.
  - The search placeholder "TICKER / CON…" and "Sweeps and …" are truncated in the 2-column cards grid (`live-tape-m390-dark.png`).
  - The framed pages behave as the owner specified: on a phone they scroll like any page. Net Flow puts the board (max 306 px) over the pane (460 px); 0DTE gives each pane 420 px. Measured: the scroll container is MAIN 2,202 px on Net Flow (phone.log).
- **Desktop framed pages:** Net Flow and 0DTE fill the viewport at 1440 and 1920 (`net-flow-d1440-dark.png`, `odte-d1440-dark.png`) with the footer one scroll below, as specified.
- **1920:** all Live Tape columns fit; the Screener hides only Sector. Polish: the footer's text column starts at x≈495 while the page starts at x≈268 (`live-tape-d1920-dark.png`).
- **Colour rules:** no lime anywhere (a hue scan of every element in main found 0 lime, crawl JSON). Silver is the accent (selection, search border, Live). Bull/bear are used for data, plus the side inks noted above.

### Inferences
- Most "illegible" complaints trace back to two shared settings: the house grid's 9 px header and TraceBox's single-line sub. Fixing those two files improves all 11 pages at once.
- The dark-island pattern (`data-theme="dark"` plus literal hex) is a workaround that avoided porting the charts to tokens. It is the largest remaining light-theme debt in Trace.

### Gaps
- Real load timing (time to first rows) could not be measured cleanly under the shared load. Re-run `crawl2.mjs` on an idle machine.
- Contrast was computed on text nodes only. Inks drawn on canvas or SVG in charts were judged by eye.

---

## 3. Is the room coherent? Naming, overlap of the 15 addresses, density, number formats, colour

### Takeaway
Fifteen addresses collapse to 11 real pages (four redirect), and the sidebar lists 11. Several pages are different views of the same day's book with the same columns and the same card: Screener, Footprints, Watchers and Windows; Net Flow, 0DTE and Compare. Names drift between page, box, control and noun. The "bookmark" alone has five words.

### Cited Findings
- **The 15 addresses:** flow-alerts, intervals, dark-feed and scanner are redirects only (`src/App.tsx:260-272`), so "screener vs scanner" is not a live overlap. 11 pages remain (`src/pages/trace/subnav.ts`). The shell comment still says "One head over nine pages" (`TraceLayout.tsx:6`). Polish.
- **Overlap: four pages over one data set.** Screener, Footprints, Watchers and Windows all read `buildFlowBook(...)`, show the same contract columns and open the same BookDrill card. They differ only by a preset "screen":
  - Screener's "New positioning" ≈ Footprints' "Fresh positions"; both rank volume or OI change.
  - Watchers' reasons and Windows' time slice are further cuts of the same rows.
  - Suggestion (Major, IA): fold them into one "Book" page with the screens grouped (Activity / Positioning / Watchers / Time window), or keep the pages but add a "related screens" strip linking them.
- **Overlap: three pages over one chart.** Net Flow, 0DTE and Compare are all `NetFlowPane`. 0DTE's own header admits "it was: same generator, Net Flow's 0DTE clock" (`Odte.tsx:21-28`). Compare repeats Net Flow's pane twice plus a ledger.
  - Suggestion: make 0DTE a preset of Net Flow (Clock = 0DTE) with the multi-pane desk as a layout option, and make Compare a "+ compare" mode of Net Flow.
- **Two heads per page.** The shell h1 "Live Tape" plus its subtitle sits over a box h3 "The tape" plus another sub-line. That is about 100 px of two titles and two sentences on every page (`live-tape-d1440-dark.png`). The heading levels also skip h2 (`TraceLayout.tsx` h1 → `TraceBox.tsx:106` h3).
  - Fix: one head (the page name), with the box carrying facts only; or make the box title an h2.
- **The same control under different names:**
  - The question asked of the data: "Order" (Tape), "Screen" (Screener), "Cut" (Footprints, Windows), "Shape" (Multi-Leg), "Reason" (Watchers), "Read" (Dark Pool).
  - "Money" means moneyness on the Screener and pane, but debit/credit on Multi-Leg.
  - "Clock" means tenor on panes; "Tenor" on the Screener.
  - Fix: standardise on Screen / Side / Tenor / Moneyness / Expiry.
- **Five words for one bookmark:**
  - subtitle "Bookmarked prints & contracts" (`subnav.ts:82`);
  - box "Under watch";
  - copy "the mark at the left";
  - aria "Track this print / Untrack";
  - the card's "TRACK PRINT".
  - Fix: pick one ("Track" / "Tracked").
- **Hold coverage is uneven:** every page has Live/Paused except Live Tape. **Link/Save** exist only on Tape and Screener. **Address state** likewise. Footprints, Watchers, Windows and Multi-Leg cannot be shared or saved. Minor.
- **Number formats** are mostly consistent: `$X.XK/M/B` premiums, comma sizes, "Nd" DTE, whole-number IV %, MM/DD/YYYY dates. Exceptions:
  - 12-hour time in the Live Tape card;
  - "Fastest build +46,175%" (no cap);
  - "692.0%" friction;
  - P/C labelled premium but computed from counts;
  - Day ratio as "ASK 63%" vs Screener "Lean" (same cell, two names: Live Tape "Day ratio", others "Lean"). Fix: one name.
- **Density:** at 1440 a page holds about 16 rows above the fold under about 230 px of head (`screener-d1440-dark.png`). Tight but legible. On a phone the head (facts, champions, 7 controls) takes about 470 px before the first row (`live-tape-m390-dark.png`). Suggestion: collapse champions and facts behind a "Summary" disclosure on a phone.
- **Colour:** silver accent and no lime (crawl lime scan: 0). Magenta "supreme" is one per column. Orange warn is used for champion labels ("Busiest name", "Busier tape") and for "SWEEP", so it carries both "worth a look" and "sweep".

### Inferences
- Merging the duplicate pages (four book views into one, three pane views into one) would cut the sub-nav from 11 to about 6 entries without losing a feature. That directly answers "15 sub-pages are too many".

### Gaps
- Whether the owner wants the merge is an IA decision; it is presented as a suggestion, not a defect.

---

## 4. Accessibility (keyboard in grids, focus rings, aria labels, 44 px targets on a phone)

### Takeaway
Focus rings are visible on every stop reached (0 "NO RING" in Tab walks). But the grids cannot be operated from the keyboard, cards and guides do not manage focus, the search is not an ARIA combobox, and almost every control on a phone is under 44 px.

### Cited Findings
- **Major: rows unreachable by keyboard** (`suppressCellFocus`, `TraceBox.tsx:432`). Tab walks reach column headers (`div[columnheader]`), not rows (ix-rest.log TAB lines).
- **Major: Tab is trapped in search suggestions.** Focusing the search opens its list. Tab then walks every suggestion button (10+ on Screener) before reaching the next card (ix-rest.log TAB: "input → COIN 24 contracts… → GOOGL… → C COIN 252.5C…").
  - Fix: a proper combobox (`role=combobox`, `aria-expanded`, `aria-controls`, `role=listbox`/`option`, `aria-activedescendant`) whose options are not tab stops. Today it has none of these: the crawl found `listbox: null` (`FlowSearch.tsx:280-330`).
- **Major: the search's clear "×" works only on `onMouseDown`** (`FlowSearch.tsx:303`), so keyboard Enter or Space on it does nothing. It is also 12 × 12 px (phone.log "12x12 Clear search").
- **Major: the card and guide do not manage focus** (question 1). No focus moves in, no trap, focus returns to BODY, and Esc is unreliable.
- **Minor: 0DTE's fullscreen icon and NetFlowPane's SegPick menu** have no `aria-label` / `aria-haspopup` / `aria-expanded`, and the menu has no arrow-key navigation (`NetFlowPane.tsx:144-180,630-636`). The fullscreen overlay has no `role="dialog"`.
- **Phone targets under 44 px** (phone.log, crawl-m390.json `smallTargets`):

  | Page | Controls under 44 px |
  |---|---|
  | Multi-Leg | 282 |
  | Windows | 189 |
  | Screener | 118 |
  | Watchers | 114 |
  | Footprints | 113 |
  | Live Tape | 47 |
  | 0DTE | 45 |
  | Net Flow | 34 |

  Examples:
  - champions 18 px tall;
  - dropdown cards 28 px;
  - "How to read" 24 px;
  - bookmark and clear "×" 12 × 12 px;
  - Multi-Leg strike buttons 20 × 20 px;
  - Windows day-strip slots 4 × 44 px;
  - Compare swap 28 × 28 px.

  The owner's 44 px rule is written for the landing; the terminal has none. **Major on a phone.** Fix: the same invisible `before:` hit-area technique the landing uses.
- Positive: every dropdown has an `aria-label` ("Order: Stream"); Prev/Next window buttons have labels; WatchStar has `aria-pressed` plus a label; LiveHold has `aria-pressed`; and no unlabelled buttons were found in main (crawl `unlabeled: 0`).

### Inferences
- With TraceGrid, Modal and FlowSearch shared across the room, three component-level fixes cover almost all keyboard issues on all 11 pages.

### Gaps
- No screen-reader pass (NVDA or VoiceOver) was done. Announcements of live tape updates (`aria-live`) were not assessed.

---

## 5. Copy: banned words and typos

### Takeaway
No banned word appears anywhere visible. The crawl scanned main text, aria-label, title and placeholder on every page, viewport and theme for grade, score, win rate, signal, guaranteed, confluence, market intelligence, simulated/simulation, demo, fake, preview, pretend, at launch, placeholder, undefined, NaN, null and "[object", and found 0 hits. The copy problems are claims that contradict the numbers, and a few borderline words.

### Cited Findings
- Banned-word scan: `banned: []` for all routes, viewports and themes (crawl-d1440.json, crawl-m390.json).
- **Borderline (Minor):**
  - The card's "ON THE COMPASS SCALE" shows a verdict badge (ENTER/EXIT/WATCH → shown as "FADING", "WATCH") with a bare "5%" / "67%" confidence and no label (`PrintDrilldown.tsx:570-597`). Without a label, "5%" reads like a score. Label it "confidence".
  - The Dark Pool guide says "Rotation is routine and no signal on its own" (`TraceGuide.tsx:863`). This is not a trade call, but "no read on its own" avoids the banned word.
- **Copy that contradicts the data** (detailed in question 1):
  - "aggressive call buying leads" and "put premium leads";
  - "of it in calls … in puts";
  - "printed as a single block" next to "×2 legs";
  - "their defined risk" next to "Uncapped";
  - "Open this contract on the tape" when it opens a card;
  - "try a wider window" when the width is fixed;
  - "Nothing under watch" when marks are only filtered out;
  - "Nothing on this cut yet." when the cuts conflict;
  - "0DTE" when tomorrow is included.
- **Grammar and typos:**
  - Footprints: "120 shed 439,757".
  - Compare: "and SPY the busier tape" (missing verb; `Compare.tsx:339`).
  - Screener: "1 contracts trading past their open interest" (no singular; ix-rest.log, Conviction puts).
  - Watchers: "… · 50 hammering" (a lower-cased reason name used as a noun).
  - No misspellings were found in the strings read.
- **Polish: tracked uppercase micro-labels everywhere** (ORDER, KIND, COLUMNS, A / VS / B, "STILL FILLING"). The landing bans tracked caps; the terminal does not, so this is a style note only.

### Inferences
- Bringing copy and numbers into line means computing the sentence from the same split the facts show (bull/bear sides vs call/put premium). Writing a single `describeLean()` used by Tape, Net Flow, 0DTE and Compare would remove four contradictions at once.

### Gaps
- The full guide texts (`TraceGuide.tsx`, 931 lines) were sampled, not proof-read line by line.
