# The ideas report — where each idea stands (2026-10-10)

The report is `Ideas to strengthen Slayer terminal.md`, beside this file. The owner read it with one rule: "no LLMs tho
please" (2026-10-09). An idea that needs a language model is struck below, whatever its merit. Every "built" was checked
in `src` on 2026-10-10, after the six streams of 2026-10-09/10 were merged.

**Built** — it is in the terminal, at the place named. **Partly built** — what is there and what is not. **Not built** —
why. **Struck** — it uses an LLM.

## Batch zero: the copy that gave orders

| Idea | Status | Where |
| --- | --- | --- |
| Rewrite Compass's why-texts, Dark Pool's reads and News's playbook as reads, never instructions | Built | `data/compass.ts` (the why as a read; "Quick scalp" is "Fast movers"), `data/darkpool.ts` (where a cross printed, never who or what to do), `data/news.ts` (what stories like this tended to do) |
| A banned-word lint over every visible string | Built | `npm run words:check`, `scripts/check-words.mjs` with `scripts/check-words.allow.json`. It catches "take profit", "should struggle", "buy the", "scalp"; "should", "must buy", "entry" and "our" on their own are not rules (too common in plain reads) |
| The contradicting numbers under items 3 and 4 (X1 480 vs 481, PP-3, TR-25, TR-26, TR-38, CO-1, X2) | Built | See `docs/ux-audit-2026-10-09/WHAT-REMAINS.md`. All struck except Paper's chart clock (X2.4) |

## The fifteen

| # | Idea | Status | Where, or why not |
| --- | --- | --- | --- |
| 1 | Command line that acts | Built | `components/layout/CommandPalette.tsx`, `commands.ts`: "NVDA flow", page codes, "SPY alert 480", Actions, Recents, a combobox in a dialog. Not in it: saved Pulse desks and Terrain layouts by name with codes the reader chooses |
| 2 | Walls through the day | Partly built | Terrain: strike × time heat behind the candles in the GEX, Charm or DEX lens (`components/terrain/wallsHeatPrimitive.ts`, the pane's Overlays menu, off by default). Not built: the dealer-positioning timeline (net GEX, net DEX, the flip through the session) and the Pulse widget |
| 3 | "How sure is this" | Partly built | Pinpoint: `components/levels/HowSure.tsx` on `data/levelSureness.ts` (what a level assumes, how fresh its open interest is, where it would sit were the side the other way). Trace's print card: "could also be" and what "unusual" is measured against (`components/trace/PrintDrilldown.tsx`). Not built: the line on Terrain and Pulse, a wall's bar split into settled OI and today's build, and the sign-flip ghost drawn on the chart (the card says it in words) |
| 4 | Records that count the misses | Built | Levels: `data/levelRecord.ts`, shown in `components/gex/WallReportCard.tsx` (held N of M beside a strike as far away). Flow: `data/followThrough.ts` on Watchers (every flagged print, "N of M"), to now or the close; the +30 min and +1 day marks are not there. The records carry weight only once real history flows |
| 5 | Before the open, how it went | Built | The Journal's `?view=today` (`pages/practice/TodayBrief.tsx`) and `?view=week` (`pages/practice/WeekReview.tsx`); the plan writes the day's plan note, "Did you trade your plan?" the review |
| 6 | Journal cuts | Built | `pages/review/JournalHome.tsx`: what each mistake cost, plan followed or not, mood, days to expiry and delta (`data/review/engine.ts` DTE_CUTS, DELTA_CUTS), where the trade stood against the flip and the walls (paper fills stamped `lv`) |
| 6 | Weigher shading, smile and term | Built | The bell under the payoff and the chance above or below on hover (`components/weigher/PositionDeskCard.tsx`); the Vol view (`components/weigher/VolCurves.tsx`). Note: the chain's columns still say "Chance of profit (long/short)" (`ChainGrid.tsx`, older than this pass) — the report asked for "chance price is above"; the owner's call, with "Won %" |
| 6 | OI change and max pain | Built | `components/levels/OiChange.tsx` on Building; `data/maxPain.ts`, one plain marked line on the Map's Matrix |
| 7 | Alert lifecycle and log | Built | `components/gex/alertStore.ts`: repeat, expiry, snooze; the log kept as `slayer_alert_log` |
| 7 | Browser notifications, spoken alerts | Built | `components/layout/shellPrefs.ts` (both off by default), Settings |
| 7 | Alerts on drawn lines, AND across conditions | Not built | M–L; left for a later pass |
| 8 | Undo instead of confirm | Built | `components/ui/undo.tsx`: Flatten, Close, a new account, "Take them here", delete session, delete desk, untrack, clear the log, forget a saved cut |
| 9 | Keyboard-first grids and layers | Partly built | Enter opens a row (`houseGrid.ts` `openRowOnEnter`, `ui/rowKeys.ts`), Esc closes the top layer (`ui/layers.ts`), `/` the page's search and `?` the keys sheet (`AppShell.tsx`, `ShortcutSheet.tsx`). Not built: j/k; the "How to read" guides still take no focus |
| 10 | Link groups A–D across the shell | Not built | Terrain keeps its own link letters; the shell-wide model was not taken up |
| 11 | The session in every room | Partly built | The session strip under the rail's signature, pre-market to after hours (`components/layout/SessionStrip.tsx`); Terrain's session phases (`sessionPhasesPrimitive.ts`, Overlays). Not built: shading on Paper's chart |
| 12 | "Read this" from templates | Not built | Not taken up by the streams. Templates only, when it is built — see the struck part below |
| 12 | …"a model can smooth the phrasing later" | Struck | Uses an LLM |
| 13 | Colour-vision setting | Partly built | Settings › Appearance: standard or blue–orange with ▲/▼ (`theme/theme.ts`, `data-cvd` in `theme/tokens.css`, `data-dir`). Not built: "High contrast", hollow candles under the setting, outlined bubbles; `data-dir` is on few figures yet, and index.html does not set `data-cvd` before the first paint |
| 14 | Speed: a store per key, a worker, batched grids | Not built | `context/MarketDataContext.tsx` still ticks one context every 1.5 s; no Worker, no `applyTransactionAsync`. Pinpoint's one book per name made the Map's idle cost fall (827 ms to 57 ms), and Pulse's one price came from `ctx.liveSpot`, not a store |
| 15 | Annual pricing | Built | `data/billing.ts` `priceLine` (yearly at ten months' price, "Two months free"); the landing's Monthly / Yearly switch |

## Strong ideas outside the shortlist

| Idea | Status | Why |
| --- | --- | --- |
| Copy today's levels (Pine, price-line paste, CSV) | Not built | Not on the shortlist |
| One watchlist of names | Not built | M–L; not on the shortlist |
| Pop-out windows (BroadcastChannel) | Not built | Not on the shortlist |
| "Start from a desk" chooser | Not built | Not on the shortlist |
| A glossary page from `data/terms.ts` | Not built as a page | Pinpoint's words are defined at the foot of its guides (`components/levels/Glossary.tsx`) |
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
