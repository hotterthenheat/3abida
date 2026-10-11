# Compass setups — the board's filters (2026-10-11)

The owner's spec for the Compass board's filter row, written down as the reference. The owner, 2026-10-11:
"build this in compass UI NO MATH OR BACKEND THIS IS ALL UI". The board's line of cards reads
**Expiry · Kind · Option type · Name · Layout**. Every description on the board is a read — what the setup is,
never what to do.

The three filters live in the board's address, so a link keeps them:
`/compass?exp=swing&kind=bounces&type=big` (`exp` is a category key or a date, `YYYY-MM-DD`; a field at its
default — All, Top Setups, Calls & Puts — stays out of the address). A setup's Back lands on the cut the board
last had.

## Kind

Two sections in the Kind menu, each row a name, its count and one line. A kind's count is the board it opens on.
Picking a kind turns the option type to the kind's own: Main's open on Calls & Puts (single legs by default),
Premium Selling on Premium Selling, Volatility and Events on Volatility, Flow & Positioning on Calls & Puts.

**Main**

1. **Top Setups** — the strongest few across every kind. The order is meant to weigh what a trade is expected to
   keep after its costs against the deepest drop it is expected to see on the way: the most kept for the least
   drawn down first. The How-to-read guide says so in plain words. It is never called a grade or a mark of any
   kind. On the board: a contract once, at most two a name, eight in all.
2. **Quick Scalps** — fast same-day trades on indexes and liquid index ETFs only (SPX, XSP, SPY, QQQ, IWM…); on
   single stocks they do not hold up, and the line says so. (The kind once called "Fast movers"; its engine key
   stays `quick-scalp`. The name is allowlisted in scripts/check-words.allow.json: "the owner's kind name,
   2026-10-11".)
3. **Trend Plays** — a pullback inside a trend, then the trend carrying on.
4. **Breakouts** — a break out of a range, or to a new high or low.
5. **Bounces** — a key level holding: support or resistance turned away, or a rebound after an unusually sharp move.
6. **Earnings & Events** — options pricing a smaller event move than the name has made before. The buying side
   only (options cheap against history); its line says that rich event premium is under Advanced, Events and
   Premium Selling.
7. **Cheap Options** — options priced low against the move expected.
8. **All Setups** — every setup that qualifies.

**Advanced**

1. **Premium Selling** — options priced rich, and the structures that collect premium, put spreads among them.
2. **Volatility** — cheap against expensive options, volatility expanding, IV crush.
3. **Flow & Positioning** — unusual options activity, dealer gamma and dark-pool prints, shown as context.
4. **Events** — the implied move against the actual move: earnings, and Fed days broken down.

## Option type

The card beside Kind, "Option type". Each card says which structure it is, with its legs built from the setup's
strike ("Debit call spread 475/480", "Credit put spread 465/460", "Long strangle 465/475") — a label, not a price.

1. **Calls & Puts** (where the board opens) — long calls and long puts, with two halves:
   - **Steady** — deep in the money, a higher delta.
   - **Big Payoff** — at the money, larger percentage moves possible.
2. **Spreads** — debit call spreads and debit put spreads.
3. **Premium Selling** — credit put spreads (SPX and XSP listed first) and cash-secured puts.
4. **Volatility** — long straddles and long strangles.
5. **Coming later, after testing** — calendars, diagonals, iron condors, iron flies: shown in the menu, never
   picked.

## Tags

Small chips on each card and on a setup's page head, each with its line under the pointer:

- **Unusual Activity** — significant options flow agrees with the setup.
- **Penny Precision** — helps identify potential short-strike levels.

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
  the kinds, structures and tags read off the lens, the side, the strike and a stable hash. Nothing in it prices or
  ranks.
- `src/pages/compass/Board.tsx` — the filters, their counts and the address; `components/compass/SetupFiling.tsx` —
  the chips the card, the table and the setup's head share.
- A setup the board moved onto a listed date carries it in its address:
  `TICKER-strike-R-kind-tenor-YYYY-MM-DD[am]` (data/compass.ts `setupIdOf`, `parseSetupId`); its page and the
  Tracker price that date.

## Awaiting the engine

- **The order of Top Setups** — expected profit kept after costs against expected drawdown — is the intent, written
  in the guide. Until the engine computes it, the board orders by the engine's existing ranking.
- **The tags** — Unusual Activity and Penny Precision are assigned by the stand-in mapping, not by flow or strike
  data.
- **Kinds and structures** — which setup is a Trend Play or a Breakout, a debit spread or a straddle, is the
  stand-in mapping's, not a read of the chart or the chain.
- **The listings** — the real expiry list per name replaces the schedule in compassStandIn.ts.
- The universe the board sweeps today holds SPY and QQQ among the index products (IWM when it is the desk's name);
  SPX and XSP appear once the roster or the feed carries them.
