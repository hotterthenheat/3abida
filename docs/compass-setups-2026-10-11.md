# Compass setups — the board's filters (2026-10-11)

The owner's spec for the Compass board's filter row, written down as the reference. The owner, 2026-10-11:
"build this in compass UI NO MATH OR BACKEND THIS IS ALL UI". The board's line of cards reads
**Expiry · Kind · Option type · Name · Layout**. Every description on the board is a read — what the setup is,
never what to do.

**The owner's review, the same day** (fixed in the commit after the first build): a card filed as a spread still
wore "SPY 475C"; the filters overlapped; Penny Precision sat on long legs; straddles came from directional setups; the
guide promised an order the board did not keep; and SPX and XSP were sorted first. The rules below are the fixed
ones. **No name is ever sorted ahead of another for being that name** (the owner: "never put any tickers first").

The three filters live in the board's address, so a link keeps them:
`/compass?exp=swing&kind=bounces&type=big` (`exp` is a category key or a date, `YYYY-MM-DD`; a field at its
default — All, Top Setups, All types (`all`) — stays out of the address). A setup's Back lands on the cut the board
last had.

## Kind

Two sections in the Kind menu, each row a name, its count and one line. **A kind lists its setups whatever their
structure; the Option type narrows them.** Every kind opens on All types. Picking a kind keeps the option type,
unless the type has nothing in the new kind — then it falls back to All types. A kind's count is the board picking it
would show.

**Main**

1. **Top Setups** — the strongest few across every kind and every option type: the strongest single leg, spread,
   put sale and straddle or strangle the sweep found, then the strongest of the rest — a contract once, at most two a
   name, eight in all, shown in the sweep's own order. Once the engine gives each setup what it is expected to keep
   after its costs and the deepest drop it is expected to see on the way, Top Setups will put the most kept for the
   least drawn down first; until then it follows the sweep's own order. The How-to-read guide says so in plain words.
   It is never called a grade or a mark of any kind.
2. **Quick Scalps** — fast same-day trades on indexes and liquid index ETFs only; on single stocks they do not hold
   up, and the line says so. When it holds few or none (under four), a line over the cards says Quick Scalps lists
   same-day contracts on index products only. (The kind once called "Fast movers"; its engine key
   stays `quick-scalp`. The name is allowlisted in scripts/check-words.allow.json: "the owner's kind name,
   2026-10-11".)
3. **Trend Plays** — a pullback inside a trend, then the trend carrying on.
4. **Breakouts** — a break out of a range, or to a new high or low.
5. **Bounces** — a key level holding: support or resistance turned away, or a rebound after an unusually sharp move.
6. **Earnings & Events** — options pricing a smaller event move than the name has made before. The buying side
   only (options cheap against history); its line says the selling side is under Premium Selling.
7. **Cheap Options** — options priced low against the move expected.
8. **All Setups** — every setup that qualifies.

**Advanced**

1. **Premium Selling** — options priced rich, and the structures that collect premium: credit put spreads and
   cash-secured puts.
2. **Volatility** — options cheap or rich against their own history, and long straddles and strangles for
   expansion. On the board: the long straddles and strangles (cheap, for a move either way) and the put sales (rich).
   No short-volatility structure is shown: iron condors and iron flies come later, after testing.
3. **Flow & Positioning** — unusual options activity, dealer gamma and dark-pool prints, shown as context.
4. **Events** — the implied move against what followed, around earnings and Fed days. **The selling side of event
   premium is under Premium Selling** (credit put spreads, cash-secured puts) until more structures pass testing.

## Option type

The card beside Kind, "Option type" — **a narrower filter within the Kind**, by structure.

1. **All types** (where every kind opens) — every structure in the kind.
2. **Calls & Puts** — long calls and long puts, with two halves:
   - **Steady** — the higher-delta legs on the board, nearest the money; deep in-the-money legs when the chain lists
     them. (Checked 2026-10-11: the engine lists strikes from the money outward, so no setup today is deep in the
     money — Steady is the leg nearest the money, delta 0.50 or more.)
   - **Big Payoff** — out of the money, a lower delta, larger percentage moves possible.
3. **Spreads** — debit call spreads and debit put spreads.
4. **Premium Selling** — credit put spreads and cash-secured puts.
5. **Volatility** — long straddles and long strangles.
6. **Coming later, after testing** — calendars, diagonals, iron condors, iron flies: shown in the menu, never
   picked.

A type with nothing in the current kind stays listed with its 0, greyed, and the keys pass over it as they pass the
structures to come (unless it is the type on show).

### A structure follows its setup's direction

- A setup found as a **call** (bullish) may be shown as a long call, a debit call spread, a credit put spread or a
  cash-secured put.
- A setup found as a **put** (bearish) may be shown as a long put or a debit put spread.
- A **long straddle or strangle** comes only from the Volatility kind's own setups (a share of the cheap options, for
  a move either way) — never from a directional setup (Trend Plays, Breakouts, Bounces, Quick Scalps, Flow).
- Quick Scalps stay single legs. Which one is a hash of the setup's address — the same every sweep.

### The card speaks its structure

The chip names the structure on its name, in the ink of its lean — the logo kept:

| Structure | Chip | Ink | Figures (per share; cash per contract) | Bottom line |
|---|---|---|---|---|
| Long call / long put | `SPY 475C` | bull / bear | 1σ move, the session's line, premium now | Breaks below / above (the retire line) |
| Debit call / put spread | `SPY 475/480 call spread` | bull / bear | net debit, max loss = debit, max gain = width − debit | Breakeven |
| Credit put spread | `SPY 470/465 put spread` | bull | credit, max loss = width − credit | Breakeven = short strike − credit |
| Cash-secured put | `AVGO 167.50 put` | bull | credit, cash set aside = strike × 100 | Breakeven = strike − credit |
| Long straddle / strangle | `SPY 475 straddle`, `SPY 465/485 strangle` | plain | total cost | Breakevens = put strike − cost, call strike + cost |

Each leg is priced by the engine's own per-contract premium (data/compass `estimatePremium`, the pricer that mints
every setup's mid, on the same spot, IV and time left; the setup's own leg is its mid). The figures are plain
arithmetic of the legs — no model of their own. A spread is one rung of the engine's strike ladder for its tenor wide
(half a percent on a same-day contract, six on a LEAPS). A structure whose legs net no premium shows its legs without
figures. The table (Premium, Structure figures, Breakeven, Breaks at) and a setup's page head follow the same rule.

## Tags

Small chips on each card and on a setup's page head, each with its line under the pointer:

- **Unusual Activity** — significant options flow agrees with the setup.
- **Penny Precision** — helps identify potential short-strike levels. Only on put sales (credit put spreads and
  cash-secured puts) — the structures with a short strike to place.

## Expiry

The Expiry card is the house calendar (Trace's, components/ui/ExpiryCalendar.tsx) with the categories over the
month. A category filters to it; a date on the calendar filters to that date and the card names the date's
category; the two never stand together, and "All expiries" clears both. The lit days are the dates the board's
names list; every other day looks like the house's non-expiry days.

1. **0DTE** — the contract's last trading day is today.
2. **Weekly** — 1 to 7 days.
3. **Swing** — 8 to 45 days.
4. **Position** — 46 to 90 days.
5. **Long-Dated** — 91 days or more. **LEAPS is not a bucket**: it is a tag inside Long-Dated, worn by a contract
   with more than about nine months (270 days) left. Names list June, December and quarterly long-dated series as
   well as January.

Days are counted in calendar days to the contract's **last trading day**, and the buckets are cut on that count.

### The 0DTE rule

- 0DTE is read off each name's own listed expiration dates — never a Monday/Wednesday/Friday rule, never an
  assumption of daily expiries.
- A contract is 0DTE only when today is its **last trading day**, not its expiration date. An AM-settled contract
  (SPX's standard monthlies, the third Friday; SPXO) lists Friday as its expiration but stopped trading Thursday, so
  on Friday it is not today's 0DTE — and on Thursday it is.
- A half day ends early: 1:00 pm New York (SPXW included).
- Weekends, market holidays and adjusted schedules come from the market calendar (core/calendar.ts holidays,
  data/marketState.ts early closes; a Friday holiday moves the expiration to Thursday).
- A name with nothing whose last trading day is today has no 0DTE, and still has every other category.
- After the close, today's 0DTE is gone. On a night, a weekend or a holiday the 0DTE list is the **next session's**,
  labelled "Next session", never an empty tab. Before the open, the list is today's.
- A 1DTE contract carries a small **Overnight** note: a single night of risk is a big share of its life.

## Where it lives

- `src/types/compass.ts` — the words: KINDS, STRATEGIES, STRATEGIES_LATER, TAGS, EXPIRY_CATS.
- `src/data/expiryClass.ts` — the 0DTE rule and the categories: date logic that stays when the feed arrives.
- `src/data/compassStandIn.ts` — **the stand-in mapping, to be replaced by the engine**: each name's listed dates (a
  schedule by kind of name — index products every session for three weeks, NVDA and TSLA Monday/Wednesday/Friday,
  most stocks Fridays, a quarter of them monthlies only, SPX's third-Friday monthlies AM-settled), the five engine
  lenses' setups moved onto one of their name's listed dates and made again by the engine's own `makeSetup`, and
  the kinds, structures and tags read off the lens, the side, the strike and a stable hash, and each structure's legs
  priced by the engine's own premium. Nothing in it ranks, and no name is sorted first.
- `src/pages/compass/Board.tsx` — the filters, their counts and the address; `components/compass/SetupFiling.tsx` —
  the chips the card, the table and the setup's head share.
- A setup the board moved onto a listed date carries it in its address:
  `TICKER-strike-R-kind-tenor-YYYY-MM-DD[am]` (data/compass.ts `setupIdOf`, `parseSetupId`); its page and the
  Tracker price that date.

## Awaiting the engine

- **The order of Top Setups** — expected profit kept after costs against expected drawdown — is the order it will
  use once the engine gives those figures. Until then it follows the sweep's own order, holding the strongest of each
  option type. The guide says both in plain words.
- **The tags** — Unusual Activity and Penny Precision are assigned by the stand-in mapping, not by flow or strike
  data.
- **Kinds and structures** — which setup is a Trend Play or a Breakout, a debit spread or a straddle, is the
  stand-in mapping's, not a read of the chart or the chain.
- **The listings** — the real expiry list per name replaces the schedule in compassStandIn.ts.
- The universe the board sweeps today holds SPY and QQQ among the index products (IWM when it is the desk's name).
  No name is added to the board for this spec, and none is ever sorted ahead of another.
- **More selling structures** — iron condors and iron flies (short volatility) come after testing; until then the
  selling side of event and volatility premium is the put sales under Premium Selling.
