# Build lessons

What this build learned the hard way, so it is not learned twice. Not a
changelog and not a tour of the codebase — only the things that were
surprising, that cost a debugging session, or that a future change could
quietly undo.

---

## Provenance is the spine, and the transport decides the word

`src/data/provenance.ts` calls `setProvenance` "the swap's one call" and it
means it: every chip in the terminal reads one registry, so a feed landing
changes what the whole app says about itself in one place.

The rule that is easy to get wrong: **a REST capability makes a family
`measured`, only a socket makes it `live`.** A five-second poll described as
"live" is exactly the dishonesty that file exists to prevent. `providers/`
enforces this by reading the capability's transport rather than trusting the
caller.

A provider going live is **not a boolean**. It confirms a set of
capabilities, each feeding named families. A reader with a Polygon key and
no Unusual Whales key should see the chain go measured and dealer exposure
stay simulated, because that is what is true.

## Vendor specs live in their client libraries, not on their docs sites

Both vendors' own domains are unreachable from this environment. Both
publish machine-readable catalogs on GitHub, which are a better source
anyway because the vendor generates them:

- **Unusual Whales** — `unusual-whales/unusual-whales-official-mcp`,
  `docs/endpoints.json`. Their own catalog, CI-verified against the live
  API. 194 routes, 29 groups.
- **Polygon / Massive** — `polygon-io/client-js`, `src/openapi.json`, which
  a bot re-syncs from `api.massive.com` daily. Plus
  `polygon-io/client-python`, `.massive/websocket.json` for the channels.

`src/providers/capabilities.ts` was **generated from those**, not
transcribed. Regenerate rather than hand-edit when a vendor adds something.

Facts worth not rediscovering:

- Polygon's option snapshot carries `greeks` and `implied_volatility` and
  **neither is in the schema's required set** — assume them and the first
  deep-ITM contract crashes the client. There is no `rho`: delta, gamma,
  theta, vega only.
- The options chain's `limit` **defaults to 10** and maxes at 250.
- Forex spells a pair `C:EURUSD` on REST and `USD/EUR` on the socket; crypto
  `X:BTCUSD` versus `BTC-USD`. Normalise or get silent empties.
- Indices have **no trades and no quotes** — value and aggregates only.
- NYSE order imbalances are **socket-only**. No REST, no history: anything
  you want to keep must be captured live.
- UW array params take a `[]` suffix on the wire. Miss it and the filter
  silently returns everything.
- UW's periscope splits ONE SPX snapshot across about seventeen messages of
  1,024 rows. Buffer on `(ticker, timestamp)` and flush when `has_more`
  turns false, or you persist a third of a picture.

## Greeks are in the option's own units, and the ratio is the trap

From `market.ts`'s `optionQuote`, per contract: delta is per one point of the
option's **own** underlying, gamma is `g.gamma / ratio`, vega is
`g.vega * ratio` per vol point, theta is `(θ/252) * ratio` per session day.

So a position's exposure multiplies by `qty × multiplier` and **nothing
else**. Scaling by the ETF spot double-scales an SPXW position by about ten
times and produces a number that looks plausible and is wrong. `core/greeks.ts`
warns about this at its own layer; `core/paper/risk.ts` re-states it because
that is where it actually bites.

Related: **delta dollars are not summed blind across names.** Adding an SPX
delta dollar to an NVDA delta dollar without a beta is a number with no
referent. Report gross and net, and put the signed figures in a per-name
table. The terminal has no betas it measured, so it prints no beta-weighted
total.

## Never read risk off a strategy's name

`core/paper/payoff.ts` exists because max risk and max reward used to be
read off the strategy's **name** — a vertical gets width minus net, anything
else gets nothing. Right for five shapes, silently wrong the moment a leg
moves, and blank for a butterfly.

Two things that file refuses to get wrong, both of which a rewrite could
undo:

- **Unbounded is an answer.** A sampled curve cannot see it — sample far
  enough and a naked call still looks finite. The tails are decided in
  closed form from the ratio sum at each end; the curve is only asked about
  the interior. A max loss printed as a number when it is infinite is the
  most dangerous sentence in the file.
- **The kinks are samples.** A piecewise-linear payoff has its true extremes
  at a strike or in a tail, never between two of them, so an evenly spaced
  grid that straddles a kink reports an extreme that is too kind — wrong in
  exactly the wrong direction for a max loss. Every strike and spot are
  forced into the grid.

Twenty numeric proofs cover this. Re-run them after any edit.

## Memoised state that seeds from a fallback poisons itself

`futuresBasis` memoises per family for the app's life and used to seed from
`spotOf(etf) ?? basePrice`. On any page that marked futures **before** the
simulator seeded, it pinned the session's basis to a price the market never
had — marking NQ 219 points light against the same book on another desk.

The rule: **only a real value earns the memo.** An unseeded read computes,
returns, and does not remember.

## One book, one set of marks

The risk desk originally re-derived its own quotes and disagreed with the
paper desk. The engine already publishes marks in `state.quotes`; every
surface reads those and falls back only when absent. Two derivations of the
same number will diverge, and the one the reader is not looking at will be
the wrong one.

## React traps that froze live surfaces

Two separate bugs, same shape — something that looks live and is not:

- **`const [, bump] = useState(0)` binds the SETTER.** Putting that in a
  memo's dependency array is a dependency that can never change. The
  watchlist's rows were computed once and never again: every row read
  `resting` forever while the names seeded perfectly well behind them.
  Depend on the tick **value**.
- **A one-pixel IntersectionObserver sentinel can miss itself.** IO only
  calls back when the ratio CROSSES a threshold, so an anchor jump, a
  restored scroll position or a fast flick carries a 1px element from below
  the fold to far above it between two frames — the ratio never leaves zero
  and the callback never comes. The landing page's live panels were dead for
  this reason, under a headline promising they were not. Check
  `getBoundingClientRect()` directly, from several triggers, and wake on a
  timer regardless.

## Seeding is a queue, not a call

`Simulator.seedAsync` walks a **slice** per invocation and answers
`'pending'` until the name is whole. Calling it once leaves the name
half-built and permanently unseeded. `data/seedPump.ts` drives it across
idle slots, and **one pump serves every caller** — two surfaces each
starting their own would compete for the same slots.

Anything that names a ticker the reader has not been looking at needs this:
watchlist rows, and the landing page, which is the first thing in the app to
ask for a name nothing else has requested.

## Context travels, but not everywhere, and that is a product decision

The active name is now persisted (`slayer_active_ticker`) and reaches Pulse,
Compass, Pinpoint, Trace and the Weigher.

The Weigher is **two-way**: its job is one name, so picking there names the
terminal and the terminal naming itself moves the desk.

Terrain is **not** told to follow, deliberately. A four-pane grid is a
comparison the reader BUILT, and repointing a pane of it because they looked
at a name elsewhere would destroy that. A fresh Terrain seeds from the
active name and their watchlist; a saved arrangement always wins.

## Tailwind and layout

- **JIT cannot see runtime-built class strings.** Anything computed goes in
  an inline `style`, not a template-literal class.
- `grid-flow-col auto-cols-max` **cannot wrap**. It laid the header's fact
  strip in one row at natural width and ran past the viewport; on a 390px
  screen the journal's sixth fact was simply absent, not truncated. A flex
  row wraps when it must and is identical when it does not.

## Testing this app

- The static server must be its own background task. Started inside a
  compound backgrounded command it dies when that task is reaped.
- `page.goto` is a **full reload** and re-seeds the simulator, so it cannot
  test anything about state travelling between desks. Click the nav.
- Radix dropdown options are `role="menuitemradio"`, not `role="option"`.
- Test the **claim**, not the markup. The landing bug was found by sampling
  a section twice and asking whether anything had printed — a route sweep
  that counts nodes and checks the console passes straight over four empty
  boxes under a headline promising live panels.
