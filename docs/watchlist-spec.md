# The Watchlist — paper positions under Review

*Scoped 2026-09-13, for the first update after launch. Noah's brief, with Robinhood's Options Watchlist screens: "a section for paper trading… in the Review section… under the name Watchlist."*

## 0. What it is

A watched contract is marked at the price the moment it is added, and tracked as a position from then on. The reader never places a trade: they watch a contract, and the record follows — the cost when added, the mark now, today's and total return, the breakeven, the expiry, and what happens to it at the bell. That is Robinhood's grammar, and it is the right one for a terminal that reads the market rather than trading it: no orders, no buying power, no broker. A watchlist that keeps score.

Everything on the page prices with the one estimator every Compass surface already uses (`data/compass.ts` `estimatePremium`) until live quotes land — one pricer, never two (the partner's two-pricer lesson).

## 1. Where it lives

- **The page:** `/watchlist`, in the sidebar's Review group beside Prove It (`components/layout/nav.ts`). Prove It itself is untouched.
- **The doors in — "Watch it" beside "Weigh it":** the Weigher's contract card (`StrikeCard`), the chain's rows, the Record's contract rows (Earnings' and the stock overview's busiest contracts), the Compass setup card. Each hands a `WatchRequest { ticker, strike, right, expiry }` — the same shape as `WeighRequest` — and the store marks the add at that tick's mark and spot.
- **The doors out:** every row opens the contract on the Weigher with the way back (`WayBack`), and on Terrain's chart with the strike kept.

## 2. The data

`types/watchlist.ts`

```ts
export interface WatchedContract {
  id: string;                      // `${ticker}-${strike}-${right}-${expiry}-${addedAt}`
  ticker: string;
  strike: number;
  right: 'C' | 'P';
  expiry: string;                  // ISO date, the chain's
  addedAt: number;                 // Date.now()
  addedMark: number;               // the mark at the add — the cost
  addedSpot: number;               // the underlying at the add — the breakeven's anchor
  size: number;                    // contracts; 1 unless the reader sets it
  status: 'open' | 'closed' | 'expired';
  closedAt?: number;
  closedMark?: number;             // the mark at the close, or intrinsic at expiry
  note?: string;                   // the reader's one line, optional
  marks: { day: string; close: number }[]; // one close per session, for the row's sparkline
}
```

`data/watchlist.ts` — the store on the Tracker's pattern (`data/tracker`): `watch(req)`, `close(id)`, `unwatch(id)`, `settleExpired(now)`, a subscription, `slayer_watchlist_v1` in localStorage until the account's storage carries it. Every tick, each open row reprices: `mark = estimatePremium(spot, strike, right, contractIvFor(ticker, strike, right), tYears)` with the Weigher's half-session floor on `tYears`; the bid/ask/greeks/odds come from the same `DeskContract` maker the chain uses.

**Returns.** Dollars: `(mark − addedMark) × 100 × size`. Today: against the last session's close mark. **And in R** — the house keeps its record in R: for a bought option the premium paid is the whole risk, so `R = (mark − addedMark) / addedMark`; a doubled contract is +1.0R, a contract gone to zero is −1.0R. Both figures on every row; R is the one the record counts.

**Settling.** At the expiry's close the contract settles at intrinsic (`max(spot − strike, 0)` for a call, the mirror for a put) — status `expired`, the return locked. "Close" on a row settles it at the mark now. The record: `settled · hit · R`, the Tracker's own line, where hit = closed above cost.

## 3. The page — the TraceBox grammar

- **Head:** "Watchlist" · "Every contract you watch, tracked as if you bought it when you added it" · the facts: **Watching** (open count) · **Open** (total $ and R, direction ink) · **Today** ($ and R) · **The record** (settled · hit · R).
- **The cards line:** `Show` Open / Settled / All · `Sort` Newest / Biggest move / Expiring soonest · `Name` every name / one (the ScopeChip, following the frame) · at the right, the ColumnChooser.
- **The sentence:** "Three contracts open, up +$412 (+0.6R) today; SPY 481C expires at the bell, 0.4 from its breakeven." — RichRead, the names as doors.
- **The grid (AG Grid, `TRACE_GRID_THEME`, autoHeight, the page scrolls):**

| Column | Cell |
|---|---|
| Contract | the logo · `ContractLabel` (SPY 481 C · Sep 14) |
| Expires | the date · DTE, `When`'s grammar; **today** in the warn ink |
| Added | `When` — "09/13 · 2d ago" — with the cost when added |
| Mark | the mark now, ticking; bid × ask on hover |
| Today | $ and R, direction ink |
| Total | $ and R, direction ink, **the row's lead figure** |
| Breakeven | `strike ± addedMark` vs spot — the distance in $ and % |
| Odds | `itmOdds` from the maker, as a percentage |
| Since added | a 90×18 sparkline of `marks` on the library's small chart (`SessionsChart`'s pattern) |
| — | doors: Weigh it · Chart · Close |

A click keeps the row the Pulse way (the scrim) and opens the contract below the grid: **the Weigher's `StrikeCard`** (bid, ask, mark, IV, previous close, high, low, volume, open interest, the five greeks — Robinhood's Stats and Greeks blocks are this card already) with a **Watchlist position** facts row above it: Contracts · Cost when added · Market value · Date added · Expiry · Breakeven · Spot now · Today's return · Total return.

- **What if (Robinhood's "Simulate my returns"):** under the card, the Weigher's estimator across spot and date — the contract's value against spot on three lines (today, halfway to expiry, at expiry — the payoff), on a lightweight-charts line chart with a crosshair and a hover card ("at 485 on Sep 14: $3.10, +$210, +0.7R"). Every chart uses the library; never a hand-drawn SVG.

## 4. Alerts

A watched contract's row carries the alert door the Weigher's card carries: a premium alert ("when it is up 50%", "when it is down to 1R") through `alertStore`, jingling like every other alert, listed in the drawer. Set in place, seen in one place, heard everywhere.

## 5. The phone

The phone pass's rules: the facts wrap and drop under the title, the cards line is a two-column grid, the grid keeps Contract · Mark · Total and scrolls the rest sideways inside the box, the card stacks its facts two by two, the what-if chart keeps its full width.

## 6. What launch must bring first

1. **The account and its storage** — a record that lives in one browser is a record nobody trusts. The store's seam is the Tracker's; it moves with it.
2. **Live quotes** — the add price must be the real mark; until then the estimator prices the add and every tick, said so on the surface ("marked by the model").
3. **The OPRA licence** for real-time marks on the row.

Until then the page can be built end to end on the simulator: the store, the page, the card, the what-if, the skeleton — with "preview · marked by the model" in the head's tag, the way Data's page says "preview · the feed is simulated".

## 7. Not in it

No orders, no buying power, no broker links, no margin, no multi-leg positions (a structure is watched as its legs), no social sharing — the room's business, after the room.

## 8. Effort

About two days of the walk: the types and the store with tests (half a day), the page and the grid on the TraceBox grammar (a day), the card's facts row and the what-if chart (half a day). Skeleton within 3px, the phone sweep re-run, probes deleted.
