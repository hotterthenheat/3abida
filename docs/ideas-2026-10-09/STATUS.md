# The ideas report — where each idea stands (2026-10-10)

The report is `Ideas to strengthen Slayer terminal.md`, beside this file. The owner read it with one rule: "no LLMs tho
please" (2026-10-09). An idea that needs a language model is struck below, whatever its merit. Every "built" was checked
in `src` on 2026-10-10, after the ten streams of 2026-10-09/10 were merged (the last four: shared, speed, ideas,
polish).

**Built** — it is in the terminal, at the place named. **Partly built** — what is there and what is not. **Not built** —
why. **Struck** — it uses an LLM.

## Batch zero: the copy that gave orders

| Idea | Status | Where |
| --- | --- | --- |
| Rewrite Compass's why-texts, Dark Pool's reads and News's playbook as reads, never instructions | Built | `data/compass.ts` (the why as a read; "Quick scalp" is "Fast movers"), `data/darkpool.ts` (where a cross printed, never who or what to do), `data/news.ts` (what stories like this tended to do) |
| A banned-word lint over every visible string | Built | `npm run words:check`, `scripts/check-words.mjs` with `scripts/check-words.allow.json`. It catches "take profit", "should struggle", "buy the", "scalp"; "should", "must buy", "entry" and "our" on their own are not rules (too common in plain reads) |
| The contradicting numbers under items 3 and 4 (X1 480 vs 481, PP-3, TR-25, TR-26, TR-38, CO-1, X2) | Built | See `docs/ux-audit-2026-10-09/WHAT-REMAINS.md`. All struck, Paper's chart clock (X2.4) with them: every StrikeChart draws on New York (`nyClock`) |

## The fifteen

| # | Idea | Status | Where, or why not |
| --- | --- | --- | --- |
| 1 | Command line that acts | Built | `components/layout/CommandPalette.tsx`, `commands.ts`: "NVDA flow", page codes, "SPY alert 480", Actions, Recents, a combobox in a dialog. Not in it: saved Pulse desks and Terrain layouts by name with codes the reader chooses |
| 2 | Walls through the day | Built | Terrain: strike × time heat behind the candles in the GEX, Charm or DEX lens (`components/terrain/wallsHeatPrimitive.ts`, the pane's Overlays menu, off by default). The dealer-positioning timeline: Pinpoint › Building's fourth box, net GEX and price's distance from the flip minute by minute (`components/levels/DealerTimeline.tsx`, `data/dealerTimeline.ts`). Not built: net DEX on the timeline and a Pulse panel of it — not taken up by the polish stream, which built the timeline |
| 3 | "How sure is this" | Partly built | `components/levels/HowSure.tsx` on `data/levelSureness.ts` (what a level assumes, how fresh its open interest is, where it would sit were the side the other way): Pinpoint's walls and Targets, Pulse's At the wall (`components/gex/AtTheWall.tsx`), Terrain's ladder head (`HowSureBook`, `components/gex/ProfilePanel.tsx` `sure`). Trace's print card: "could also be" and what "unusual" is measured against (`components/trace/PrintDrilldown.tsx`). Not built: a wall's bar split into settled OI and today's build (the open interest is one daily count until the keys), and the sign-flip ghost drawn on the chart (the card says it in words) — not taken up by the streams |
| 4 | Records that count the misses | Built | Levels: `data/levelRecord.ts`, shown in `components/gex/WallReportCard.tsx` (held N of M beside a strike as far away). Flow: `data/followThrough.ts` on Watchers (every flagged print, "N of M"), to now or the close; the +30 min and +1 day marks are not there. The records carry weight only once real history flows |
| 5 | Before the open, how it went | Built | The Journal's `?view=today` (`pages/practice/TodayBrief.tsx`) and `?view=week` (`pages/practice/WeekReview.tsx`); the plan writes the day's plan note, "Did you trade your plan?" the review |
| 6 | Journal cuts | Built | `pages/review/JournalHome.tsx`: what each mistake cost, plan followed or not, mood, days to expiry and delta (`data/review/engine.ts` DTE_CUTS, DELTA_CUTS), where the trade stood against the flip and the walls (paper fills stamped `lv`) |
| 6 | Weigher shading, smile and term | Built | The bell under the payoff and the chance above or below on hover (`components/weigher/PositionDeskCard.tsx`); the Vol view (`components/weigher/VolCurves.tsx`). Note: the chain's columns still say "Chance of profit (long/short)" (`ChainGrid.tsx`, older than this pass) — the report asked for "chance price is above"; the owner's call, with "Won %" |
| 6 | OI change and max pain | Built | `components/levels/OiChange.tsx` on Building; `data/maxPain.ts`, one plain marked line on the Map's Matrix |
| 7 | Alert lifecycle and log | Built | `components/gex/alertStore.ts`: repeat, expiry, snooze; the log kept as `slayer_alert_log` |
| 7 | Browser notifications, spoken alerts | Built | `components/layout/shellPrefs.ts` (both off by default), Settings |
| 7 | Alerts on drawn lines, AND across conditions | Built | `components/gex/alertStore.ts`: `kind: 'line'` on a drawn line (touch, break or bounce; the drawing keeps its id once alerted and `saveDrawings` moves its alert with it) and `kind: 'all'`, two or three conditions together (`ALL_MAX`); `scripts/alerts-proof.ts` in `npm test` |
| 8 | Undo instead of confirm | Built | `components/ui/undo.tsx`: Flatten, Close, a new account, "Take them here", delete session, delete desk, untrack, clear the log, forget a saved cut |
| 9 | Keyboard-first grids and layers | Built | Enter opens a row (`houseGrid.ts` `openRowOnEnter`, `ui/rowKeys.ts`), Esc closes the top layer (`ui/layers.ts`), `/` the page's search and `?` the keys sheet (`AppShell.tsx`, `ShortcutSheet.tsx`); j and k step rows wherever the arrows do and g then a room's letter goes to the room (`components/layout/rowStepKeys.ts` `ROW_STEPS`, `ROOM_KEYS`, listed in `keys.ts`); the "How to read" guides take, hold and give back the keys (`ui/GuideFocus.tsx` through `useOverlay`) |
| 10 | Link groups A–D across the shell | Built | `context/marketStore.ts` (`setLinkGroup`, `useLinkGroups`, `useLinkedName`), `components/link/LinkGroupChip.tsx` (letters only, None by default): Terrain's panes, Pulse's panels, the Weigher's desk, the watchlist and the pop-outs |
| 11 | The session in every room | Built | The session strip under the rail's signature, pre-market to after hours (`components/layout/SessionStrip.tsx`); Terrain's session phases (`sessionPhasesPrimitive.ts`, Overlays); Paper's chart, the same bands in its Overlays menu, off by default (`components/review/DeskShell.tsx`) |
| 12 | "Read this" from templates | Built | `components/read/ReadThis.tsx`: on the panel now, what it assumes, what would change it — templates only (`data/reads.ts`, the rooms' own sentences), on Trace's boxes (`TraceBox` `read`), Pulse's panels (`pages/workspace/registry.tsx` `read`), the Weigher's position, Compass's setup and Pinpoint's Map and At the wall |
| 12 | …"a model can smooth the phrasing later" | Struck | Uses an LLM |
| 13 | Colour-vision setting | Built | Settings › Appearance: standard, blue–orange or high contrast, with ▲/▼ under either choice (`theme/theme.ts`, `data-cvd` in `theme/tokens.css`, set before the first paint by index.html); under either, a down-side key dot is a ring (`cvd-hollow`) and the puts' lines are dashed (Net Flow, the Weigher's smile). Hollow candles under the setting: the shared stream's blue–orange candles |
| 14 | Speed: a store per key, a worker, batched grids | Partly built | The store per key is built: `context/marketStore.ts` (useQuote, useSnapshot, useScanSnapshot, useFlowTape, useNow…), one publish a frame, the heavy reads as one transition; Pulse renders on its 10 s scan with each tile reading the tick. Measured: Pulse's script 621 → 414 ms in 20 s, Compass 413 → 228, the Map 371 → 196. Not built: the Worker and `applyTransactionAsync` — paint and compositing, not script, are the cost now, so a Worker would buy little until a real feed's parsing lands |
| 15 | Annual pricing | Built | `data/billing.ts` `priceLine` (yearly at ten months' price, "Two months free"); the landing's Monthly / Yearly switch |

## Strong ideas outside the shortlist

| Idea | Status | Why |
| --- | --- | --- |
| Copy today's levels (Pine, price-line paste, CSV) | Built | Pinpoint's Map and Targets (`components/levels/CopyLevels.tsx` in `pages/pinpoint/PinpointLayout.tsx`, `data/levelExport.ts`): a Pine v5 script, a price list or CSV |
| One watchlist of names | Built | The rail's Watchlist door: sections, flags, price, change and the nearest wall or flip; a press sets the name or a link group; links to the contract lists (`components/layout/WatchlistDrawer.tsx`, `data/nameWatch.ts`). "watch NVDA" in the command line (`components/layout/watchCommand.ts`, called by `CommandPalette.tsx`) |
| Pop-out windows (BroadcastChannel) | Built | `pages/popout/` (`/out/pulse/:key` a Pulse panel, `/out/terrain` a Terrain pane, in `PopOutFrame`); `components/layout/deskChannel.ts` keeps the name, the link groups and the theme in step within one desk. Each window runs its own simulator, so prices differ until a feed |
| "Start from a desk" chooser | Built | `pages/workspace/DeskChooser.tsx`: Pulse's first open offers the four presets, one line each (`slayer_desk_chooser`) |
| A glossary page from `data/terms.ts` | Built | `/glossary`, `pages/glossary/Glossary.tsx` on `data/glossary.ts`: every word the terminal defines, its group, Observed / Calculated / Modeled and what it stands on; the rooms' guides keep their own `components/levels/Glossary.tsx` |
| Projected levels ahead | Not built | Needs history worth projecting from (the keys) |

## Pricing recommendations

| Idea | Status |
| --- | --- |
| Annual billing | Built (item 15) |
| A visible research layer for Compass's step | The owner's call |
| Journal and Paper in Pinpoint, or Practice as an add-on | The owner's call |
| Something real in the free account | The owner's call |
| Keep the rules: no data add-ons, no "most popular", no countdowns, Lifetime off the landing | Kept |

## When the keys arrive

The proxy, the SharedWorker and the data rules wait for the keys and a backend. Not built, by design.

## Struck: they use an LLM

- **An LLM assistant** ("Ideas to avoid", MenthorQ's QUIN, UW's MCP endpoint) — struck.
- **A model smoothing "Read this"** (item 12) — struck; the templates stand alone.
- From the notes: the "Ask the terminal" panel over MCP (`notes/api_powered_features.md` U24) and the competitors'
  AI explainers (`notes/competitor_features.md`) — struck. The owner's rule (.claude/CLAUDE.md, "No LLMs in the
  product") also rules out AI summaries, natural-language screening and a journal reflection by a model.
