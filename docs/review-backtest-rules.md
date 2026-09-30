# Review › Backtest — the rules of the simulation

**Since 2026-09-26 the backtest is a page of ONE section, Practice** — Practice › Paper · Backtest (`/practice/backtest`) ·
Journal (`/practice/journal`, whose **Backtest** book is this journal, `?book=backtest`; the paper accounts have the other
book). The old `/review/*` addresses land where their pages went.

**The Order card is the paper desk's (2026-09-26 — Noah: "make the contract orders look the same on the backtesting section
for both options and futures").** The futures desk's Order is `components/paper/OrderPanel` `FutOrderPanel` — Market ·
Limit · Stop, the position line, the size row (− n + and 1 · 3 · 5 · 10 · 15), **Buy · Sell** in one press each, Join bid ·
Join ask · Close position · Reverse · Cancel orders · Flatten all · Cancel all, the brackets as **distances in points from
the fill** (kept between orders under `slayer_review_brackets_v1`), size to a share of the account at risk, the foot. The
options desk's Order is the paper chain's `ChainOrder` — the size row, **Buy @ Ask · Buy @ Lmt** (or, held, **Sell @ Bid ·
Sell @ Lmt**, All, Buy more), the limit box with Mid, the Spread pick, the folded Target / Stop on the contract's or the
name's price. What differs from the live desk is only where the prices and the refusals come from: the replayed minute
and this session's rules. A market future fills a tick against you here, so the brackets measure from that fill. The
older tickets (`OrderTicket`, `FuturesTicket`) are gone; a stop to close a held option is pulled off its chip on the chart.

Written 2026-09-20, before the code (Noah: "a genuine papertrading section where a user can backtest their edge… options
papertrading"). One page, plain words. `src/data/review/engine.ts` implements exactly this; when a rule changes, it
changes here first.

## What it is

A **session** replays a past stretch of one name's market, minute by minute, and lets the reader trade that name's
**option contracts** with pretend money. Nothing is sent to a broker. The point is to test an edge on prices that were
real, with the costs that are real for options: the spread, the fee, and the decay.

## The clock

- Time is New York market time. A day is 390 minutes, 09:30 to 16:00. There is no pre-market and no after-hours.
- The clock moves **forward**. It can be played, paused, stepped a minute at a time, jumped to the day's end, or moved to
  the next day. It can be pulled **back only as far as the reader's last order or fill** — an earlier moment would make
  that trade a trade on the future.
- **At 16:00 the market is shut** (added 2026-09-20). Contracts have no overnight session: with the clock on the bell a
  market order is refused, in words; a limit or a stop is taken and waits for the next open. The desk says so — a line
  over the tape for the last fifteen minutes (and that a held contract expiring today settles at the bell), and a card
  at the bell with what the bell did to the book.
- Moving the clock forward runs every minute in between: working orders are checked at each minute, and the bell is
  rung for each day that passes.

## The price of a contract

- A contract is quoted once a minute: a **bid**, an **ask**, and the **mark** half way between — the vendor's
  one-minute quote ("the last quote at the interval's timestamp"). There is no price inside a minute.
- **Decay is not charged. It is in the price.** The quote a minute later, or a morning later, is already lower by what
  the contract lost. The greeks on screen (delta, theta a day, implied vol) are worked out from that price by our own
  math, the same math the live terminal uses.
- On the simulator (today) the quote comes from `src/data/review/quotes.ts`: a Black-Scholes price on a seeded tape, with
  a spread that widens away from the money. When the real tape is wired in, **that one file is the seam** — nothing
  above it changes.

## Orders and fills

| Order | Fills when | At |
| --- | --- | --- |
| Market buy | the next minute's quote (or this one, if the clock is paused on it) | the **ask** |
| Market sell | the same | the **bid** |
| Limit buy at L | a minute's ask is at or under L | L (never better than the ask asked) |
| Limit sell at L | a minute's bid is at or over L | L |
| Stop sell at S | a minute's **bid** is at or under S | the bid of that minute |
| Target **on the name** at N | the name's minute closes at or past N, on the contract's good side (a call: at or over; a put: at or under) | the bid of that minute |
| Stop **on the name** at N | the name's minute closes at or past N, on the other side | the bid of that minute |

- A **dead quote gives no fill**: a bid of zero cannot be sold into, and a spread wider than 60% of the mark is not a
  market. The order waits.
- A **target and a stop** may ride a buy. They are a limit sell and a stop sell on the same contracts; when one fills,
  the other gives up the contracts it sold — all of them, where there is one of each. More than one of each is a
  LADDER (its own section, below).
- **A way out can wait on one of two things** (added 2026-09-20). On **the contract's price**, its dollars hold — and
  because the contract decays, the place the *name* has to reach for it moves every minute: on a same-day contract a
  stop walks up into a name that has not moved, and sells. On **the name's price**, the level holds and the dollars are
  whatever the contract bids when the name gets there. The engine sees the name once a minute, at the minute's end. A
  level the name already stands past is not taken. A working way out can be **turned from one into the other** without
  moving its line: to the name, at the level that gives its price this minute; to the contract, at what the contract
  would bid there this minute.
- Day orders that have not filled are cancelled at 16:00. Good-till-cancelled orders carry over.
- A target or a stop can be **put on a position that is already open** (on the chart: pull up or down off the
  position's own chip). The first pull of each kind speaks for every contract held; a **further pull adds another level**
  (see the ladder, below).
- A **working order's price can be moved** (on the chart, by dragging its line): it is the same order at a new price. A
  move that would not wait — a target at or under the bid, a stop at or over it — is not taken.
- **An order waiting to open a position is on the chart too** (added 2026-09-22 — Noah: "are buy stops and sell limits
  shown as such right now?"; they were not drawn): its chip says what it is — **Buy limit · Buy stop · Sell limit · Sell
  stop** — in its side's colour on an outline (a live position and its ways out are solid), with its contracts and a ×
  that cancels it, on a dotted line. It drags to a new price like any working order. An option's buy is drawn where the
  name would have to stand, this minute, for the contract's **ask** to come down to it, and its chip names the contract
  and the price.
- **Fee:** $0.65 a contract, each way, by default; the session can set its own. Expiry settles without a fee.
- One contract is 100 shares. Prices are in dollars a share, as a broker prints them; cost is price × 100 × contracts.

## A ladder of ways out (added 2026-09-20)

Noah: "some people have multiple tps and stop losses in place… how can we incorporate that". A position's ways out are
ONE GROUP — **up to three targets and up to two stops**, each for a whole number of its contracts.

- **Nothing is ever sold twice.** The targets together never speak for more contracts than are held, nor do the stops.
  Contracts no target covers simply run; contracts no stop covers are unprotected. The ticket shares the contracts out
  evenly to start (all at one · half and half · thirds, the nearer level taking the odd one) and **the count at each
  level can be typed** — one target for two of four contracts and the rest left to run is a trade — and the ticket says,
  before the press, how many contracts are left with no stop. With one contract there is nothing to split.
- **When a target fills, the stops give up that many contracts — the stop furthest from the price first. When a stop
  fills, the targets do — the furthest target first.** A level left with no contracts goes. When the position is flat,
  everything that was working on it goes.
- **A market sell by hand is never "spoken for":** the ladder gives way — the furthest target and the furthest stop give
  up the contracts sold. A sell that WAITS (a limit or a stop typed on the ticket) still has to find contracts nothing
  else speaks for.
- **On the chart** a further pull off the position's chip adds a level: it takes the contracts no level of that kind
  covers yet, or else HALF of the biggest level's. Where no level has two contracts to give, or the ladder is full
  (three targets, two stops), the pull is not taken.
- **Breakeven.** A switch: when the FIRST target fills, every stop of the group moves to **what was paid** — a price of
  the contract itself, so a stop that was pinned to the name is un-pinned. It moves only where it would still wait (the
  bid is above it), it moves once, and it never moves a stop DOWN.
- **Trailing.** A switch on a stop: it keeps a distance from the best the contract has bid since (for a stop pinned to
  the name: from the name's best, on the contract's good side) — and never moves back. **The distance is typed, or it is
  the distance the stop stands at when the switch is thrown**; on the chart, dragging a trailing stop's line sets its
  distance anew. A stop typed closer than its distance waits where it is until the price has risen enough; a stop
  typed further off is drawn in on the next minute. A trailing distance typed with no stop price puts the stop that far
  under the way in. Each minute the stop is CHECKED first, where it stood, and only then moved by that minute's price:
  the engine never assumes the good part of a minute came before the bad part.
- **1R is unchanged:** what the position cost. The record keeps every piece a trade left in — when, how many, at what,
  by which way out — and a trade that left in more than one piece ended **"scaled out"**.

## What can be traded (version 1)

- **Long calls and long puts, paid in cash.** Buy to open, sell to close. No short options on their own, no margin — a
  buy that the cash cannot pay for is refused.
- **Vertical spreads bought for a debit** (added 2026-09-20): a bull call spread (buy a call, sell a higher one) or a
  bear put spread (buy a put, sell a lower one), same expiry. A spread is ONE position with ONE price: to buy it, the
  bought leg's ask less the sold leg's bid; to sell it, the bought leg's bid less the sold leg's ask; never under
  nothing or over its width. The most it can lose is what it cost; the most it can make is its width less that. The
  fee is charged on both legs. It takes a target, a stop and the pin like any contract, and at the bell of its expiry
  it settles at what it is worth in the money. **Spreads sold for a credit are not in this version** — they need cash
  held against them, which is the next wave.
- **One name or two a session** (two since 2026-09-20), on one clock and one account: the cash, the book, the bell and
  the report are shared. Every expiry and strike each name's chain lists on that day. A contract of any other name is
  refused.

## The reader's own rules (added 2026-09-20)

Set when the session starts and **never after** — a rule that can be loosened in the middle of a losing day is not a
rule. They are **hard blocks on a way in**, said in words on the ticket; they never stop a way out.

| Rule | Blocks a buy when |
| --- | --- |
| Positions open at once | the buy would open a new position and that many are already open — counting, with them, the contracts a working buy would open, so a resting order cannot carry the book past the limit |
| The most one trade may cost | what is already paid into that contract plus this buy (premium + fees) is more than that share of what the account is worth now |
| The day's stop | the account is down that share since the day's open (the book as it stood at the open, marked at the open's first minute). Resting buys are cancelled rather than filled while it stands; it lifts at the next open |

Adding to a contract already held does not count as a new position. Ours, not the reader's: no more than ten positions
open at once — past that a tape cannot be read.

## The bell

At 16:00 on a contract's expiry day it **settles at what it is worth in the money**: a call at spot − strike, a put at
strike − spot, never under zero. The position closes at that price, the cash lands, and the trade is written to the
record as "expired". Exercise and assignment are not modelled: a long option is only ever cash.

## The record

- A **trade** is one round trip in one contract: from the first buy to the sell (or the bell) that brings it to zero.
  Buys at different prices average in. Partial sells close a share of it and the trade stays open until it is flat.
- A trade's **risk is what was paid for it** (premium + fees), so 1R = the cost. A doubled contract is +1R; one that
  expires worthless is −1R. If a stop rode the order, the record also keeps the planned risk (entry − stop).
- Frozen facts: a fill, once written, never changes — not when the tape is re-read, not when the rules change.

## The report (the reader's own numbers)

Net P&L · win rate · average win and loss · profit factor · expectancy (dollars and R) · the deepest drawdown · the
longest losing run · time in a trade — and the cuts that only options have: **by days to expiry at entry, by delta at
entry, calls against puts, held to the bell against closed early, and the decay paid per day held.** These are the
reader's figures about their own trades; none of them is a score of ours.

## Where the real prices will come from

The vendor is Massive (Noah, 2026-09-20), for every market the terminal reads. What matters to THIS page: a fill is the
bid or the ask as it stood, so the replay can reach back only as far as the vendor's historical QUOTES do — its business
plan lists 2.5 years of them (10+ of trades). Historical greeks are not sold and are not needed: decay is inside the
price. The figures and the licence lines to get in writing are `docs/launch-costs.md` chapter 13.

## What it is not

Not advice, not a promise that a past edge holds, and — while it runs on the simulator — not real prices. The page says
so wherever it shows a figure.
