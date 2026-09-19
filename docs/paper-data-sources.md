# The paper desk against a real feed

Every panel on `/paper` runs on simulated data today — there is no provider
wired, no key, no `.env`. Before the desk grows another column, each one has
to answer the same question: **when the keys arrive, what actually fills it?**

This is that answer, checked against the vendors' own documentation rather
than assumed. It is written so a column that cannot be fed is either not
built, or built with its own honesty on the face of it.

## What the desk asks for today

`Quote` (core/paper/market.ts) carries `bid`, `ask`, `last`, `mark`,
`bidSize`, `askSize`, `volume`, `oi`, `greeks`. `Candle` carries OHLCV. That
is a **top-of-book + bars** contract, which is what a standard retail API
gives — the desk was designed to the common denominator, and that was right.

## Feature by feature

| What it shows | What it needs | Who has it |
|---|---|---|
| Chart order lines, brackets, the position line | nothing external — our own book | always |
| Bid / ask / last, size **at the touch** | NBBO, or MBP-1 | Polygon, Tradier, Alpaca, Databento |
| **Ladder depth, 10 levels a side** | L2 / MBP-10 | **not Polygon** — NBBO only, L2 is "planned". Databento `GLBX.MDP3` for CME; Rithmic, CQG, dxFeed |
| **Volume at price, per rung** | trades (tick), or bars as a fallback | Polygon trades (equities/options), Databento trades (futures) |
| **Queue position ("Q 24")** | MBO **plus the exchange's own acknowledgement of your order** | **nobody, for a paper order.** See below |
| Session high / low, VPOC | bars or trades | already have |
| Option greeks, IV, open interest | options snapshot / chain | Polygon options chain snapshot |
| Dealer walls, gamma flip | options chain across strikes | Polygon chain; the terminal already computes these |

## The three that need saying out loud

**Depth is a futures feed, not an equities one.** Polygon's own knowledge
base says it does not provide Level 2 market depth for stocks and plans to.
So the ladder's size columns can only ever be filled for futures, and only
with a depth feed (Databento MBP-10 over CME Globex MDP 3.0, or Rithmic /
CQG / dxFeed). Everything else — every equity, every option — is top of book
and always will be at this tier. **The ladder therefore has to degrade, and
say which it is showing.** It already shows size at the touch only and says
so at its foot; when a depth feed arrives that foot changes and the rows
fill. Nothing else about the panel moves.

**Queue position cannot be sourced at all.** MBP-10 gives aggregate size and
order count at a level, which supports an *estimate*; exact queue position
needs MBO, and identifying *your own* order inside that queue needs private
acknowledgements the exchange sends to an entitled participant. A paper order
never enters a real queue, so there is nothing to acknowledge. The desk's
`Q n` is therefore **an emulation and must be labelled one** — it is now, in
the order tag's tooltip and in the ladder's foot. It is a legitimate thing for
a paper desk to model; it is not a market reading and must never look like
one.

**Volume at price gets better, not different.** Today it is built from bar
volume spread across each bar's range in proportion to overlap
(`core/paper/ladder.ts`), at the ladder's own step. That is a real profile —
measured on a live NQ session, 18 of 22 rungs carry distinct volume at one
tick and up to 4.8x spread at wider groupings. With a trades feed it becomes
exact rather than apportioned. The column is the same column; only the
`Provenance` on it changes from `calculated` to `observed`, which is a word
the desk already speaks.

## The rule this leaves

A column ships when one of these is true:

1. it is fed by the top-of-book + bars contract the desk already has, or
2. it is fed by a tier we are actually buying, and it degrades to something
   honest when that tier is absent, or
3. it is the paper engine's own model, and it says so where it is read.

A column that needs data nobody sells, and that would read as a market fact,
does not ship.

## Sources

- <https://polygon.io/knowledge-base/article/does-polygon-offer-level-2-data>
- <https://polygon.io/docs/rest/stocks/trades-quotes/quotes>
- <https://databento.com/docs/schemas-and-data-formats/mbp-10>
- <https://databento.com/docs/schemas-and-data-formats/mbo>
- <https://databento.com/blog/getting-queue-position-from-l2-and-order-book-data>
- <https://databento.com/datasets/GLBX.MDP3>
- <https://ninjatrader.com/support/helpGuides/nt8/using_superdom_columns.htm>
