# Review › Backtest — futures: the rules of the simulation

Written 2026-09-20, **before the code** (Noah: "i also want to have backtesting/paper trading for regular futures ndx,
spx, oil, gold silver etc"). It sits beside `review-backtest-rules.md` (options) and follows the same promise: the engine
implements exactly this page, and when a rule changes it changes here first. Built the same night on Noah's word
("build it"): `src/data/review/futuresEngine.ts` is this page in code, `futuresTape.ts` is its seam, and
`scripts/review-futures-proof.ts` checks one against the other (`npm run review:proof`).

## What it is

A session replays a past stretch of one or two **futures contracts**, minute by minute, and lets the reader trade them
with pretend money — **long or short** — with the costs that are real for futures: the tick, the fee, and margin.
A session is one kind or the other: options (the chain, decay, the 16:00 bell) or futures (this page). The desk, the
chart and its tools, the replay bar, targets and stops on the chart, the reader's own rules, the report and the journal
are the same.

## What can be traded (version 1)

| Product | What it is | A point is worth | Tick | A tick is worth |
| --- | --- | --- | --- | --- |
| ES | S&P 500 (what "SPX futures" means) | $50 | 0.25 | $12.50 |
| MES | the micro of it | $5 | 0.25 | $1.25 |
| NQ | Nasdaq 100 ("NDX futures") | $20 | 0.25 | $5.00 |
| MNQ | the micro of it | $2 | 0.25 | $0.50 |
| CL | crude oil | $1,000 | 0.01 | $10.00 |
| GC | gold | $100 | 0.10 | $10.00 |
| SI | silver | $5,000 | 0.005 | $25.00 |

More products are a row in this table each (MCL, MGC, RTY, YM, ZN…). The contract traded is **the front month of that
day**, named as it was (ESM6), rolling on the product's usual roll day.

## The clock

- Futures trade **nearly round the clock**: Sunday 18:00 to Friday 17:00 New York, with an hour's break each day from
  17:00 to 18:00. A trading day runs 18:00 (the evening before) to 17:00.
- The clock still only moves **forward**, and can be pulled back only as far as the last order or fill.
- There is **no bell at 16:00** — that is an options idea. The replay bar gains two jumps most day traders want:
  to 09:30 (the stock market's open) and to 18:00 (the next trading day's open).
- The daily break is a gap on the tape, not minutes to play through.

## Prices and fills

A future has **one price**, no bid and ask on the tape: a minute is an open, a high, a low and a close. So the rules
say how an order meets a bar, and they lean against the reader wherever a bar cannot say what happened inside it.

| Order | Fills when | At |
| --- | --- | --- |
| Market | the minute the clock stands on | that minute's close, **one tick against you** |
| Limit buy at L (sell: the mirror) | a later minute trades **through** L — its low is under L by at least a tick; a touch is not a fill | L |
| Stop at S | a later minute touches S | S, **one tick against you** — or that minute's open, if it opened past S (a gap) |
| Stop at S, as a way IN (added 2026-09-21) | the same — a buy stop waits ABOVE the price and buys the break, a sell stop waits UNDER it | the same |

- **A target and a stop inside the same minute: the stop is taken.** A bar cannot say which came first; the record
  assumes the worse.
- A target and a stop may ride an entry, be pulled off the position on the chart, dragged, and taken off — as now.
  They are prices of the future itself, so their lines do not drift and there is nothing to pin. More than one of each
  is a LADDER (its own section, below).
- **Fee:** by default $2.00 a contract each way ($0.50 for a micro); the session can set its own.

## A ladder of ways out (added 2026-09-20)

The same ladder an option's position has (`review-backtest-rules.md`), in points: **up to three targets and up to two
stops**, each for a whole number of contracts, as one group. When a target fills, the stops give up that many contracts —
the furthest stop first; when a stop fills, the furthest target does; flat, everything goes. A market order that takes
the position out by hand is never "spoken for" — the ladder gives way. **Breakeven:** when the first target fills, every
stop moves to the average entry — never further from the price than it was. **Trailing:** a stop keeps a distance — typed in
points, or the distance it stands at when the switch is thrown; dragging its line on the chart sets it anew — measured
from the best price since — the bar's HIGH for a long, its LOW for a short — and never moves back; each minute the stop
is checked FIRST, where it stood, against the bar, and only then moved. The count at each level can be typed (the
options page says how). Inside one minute the
stops are still taken before the targets.

**The planned risk** of an entry is the sum of its stops: each one's contracts × its distance × the point's worth. The
risk rule needs the stops to cover EVERY contract of the order. An entry some of whose contracts no stop covers has no R.

## Long, short, and margin

- **Buy to open or sell to open.** A position is long or short; closing is the other side. Adding to a position
  averages in. **An order past flat REVERSES** (added 2026-09-21): it is two orders — one that closes what is held,
  then one that opens the rest the other way — placed together, at the same price and kind, the close first. A target
  or a stop typed with it rides the NEW position. A reversal at the market is never "spoken for" (the ladder gives way);
  one that waits needs every contract of the position free. The new side's margin is asked with the old side's given
  back, and the reader's rules (the day's stop, the risk on the new position) are asked of the new position.
- **A stop can be a way in** (added 2026-09-21): a buy stop above the price buys the break, a sell stop under it sells
  the breakdown — filled as any stop is, a tick against you, or the open on a gap. It may carry a target and a stop;
  its margin and the day's stop are asked again on the minute it fills.
- **Margin, not cash.** Opening a contract sets aside its day margin from the account (a stand-in figure per product,
  shown on the ticket and on the contract's card). An order the free money cannot margin is refused, in words.
- The position is marked every minute: points × the point's worth × contracts. The account is worth its cash plus
  what is open, up or down. There is **no margin call in version 1**: an account that falls under the margin it is
  holding shows it (its free money goes under nothing), and its new entries are refused until it is not.
- Holding through the daily break is allowed at the same margin (real brokers ask more overnight — not modelled yet).
- **A position cannot be carried through its contract's roll.** On the roll day it is closed at the last minute of the
  old contract, and says so.

## The reader's own rules

The same three, hard blocks on a way in and never on a way out, set when the session starts:

| Rule | Blocks an entry when |
| --- | --- |
| Positions open at once | that many are already open, counting resting entries |
| The most one trade may risk | the entry has no stop, or entry-to-stop × the point's worth × contracts is more than that share of the account |
| The day's stop | the account is down that share since the day's open (18:00) |

For a future **1R is the planned risk** (entry to stop), not the cost — a future has no cost. A trade entered without a
stop has no R, and the report says so rather than inventing one.

## The report

The same figures — net, win rate, average win and loss, profit factor, expectancy, drawdown, the losing run, time in a
trade — and the cuts that matter for futures: **by product, long against short, by the hour (overnight against the day
session), by how it ended (target, stop, by hand, the roll).**

## Not modelled in version 1

Delivery and settlement (positions are closed at the roll), exchange halts and price limits, overnight margin, partial
fills, and the order book — a fill is one price for the whole order.

## The seam, and the data

Like the options tape, the stand-in is a seeded tape behind two files; the real one replaces only those. It needs
**one-minute bars per contract month** with the roll dates — and, as with OPRA for options, **the right to show the
exchange's data to subscribers in writing** (CME, which owns ES · NQ · CL · GC · SI, licenses that separately from the
vendor's fee).

**The vendor is Massive (Noah, 2026-09-20: "our data vendor for stocks, futures, options and indices will be
polygon/massive").** Its individual futures plans ($29 to $199 a month) are marked "individual use only"; the business
page, read the same day, sells futures BY EXCHANGE at $999 a month each — 7+ years, minute bars, trades, top-of-book
quotes, "Exchange Assistance", business use. The seven products here sit on three of them: CME (ES · MES · NQ · MNQ),
NYMEX (CL) and COMEX (GC · SI). The figures, and what to get from their sales desk in writing, are
`docs/launch-costs.md` chapter 13. (Databento's page, read before the decision: 16+ years of one-minute bars on CME
Globex, $199 a month or by the gigabyte.)
