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

## A table cell inherits a line height, and it clips

The single worst layout trap in this codebase, hit three times in one day.

An `.ag-cell` hands its children a **36px line height**. An inline-flex child
inherits it, so:

- one line of a 39px row measures **42px** and the bottom of it — usually a
  door's white underline, the whole click affordance — is cut off;
- two stacked lines measure **75px**, and the second one lands under the
  clip and is *silently not there*. The text is in the DOM, `innerText`
  finds it, a snapshot test passes, and nobody can see it.

Any multi-line or underlined cell wants `leading-none` **and**
`align-middle`. `leading-none` stops the inheritance; `align-middle` stops
the box hanging off the line's baseline, which is the other half of the
same bug.

## An overflowing cell paints a clipped ellipsis, and it reads as a fault

`.ag-cell` is `overflow:hidden; text-overflow:ellipsis`. A child four pixels
wider than the content box paints the ellipsis **clipped to those four
pixels** — one stray white dot at the cell's edge. It looks exactly like a
rendering bug, and it is caused by a column width, which is the last place
anyone looks.

The grid's flex `minWidth` was 84 while the house's widest standard cell
(the Lean bar) is 64px inside 24px of padding — an 88px need against an 84px
floor, i.e. every flex column carrying one was guaranteed to do this. A floor
below what the house's own cells need is not a floor.

Measure it; do not reason about it. `scratchpad/clipprobe.mjs` walks every
`.ag-cell`, computes the real content box from **computed padding** and
reports the overflow per column. An earlier version guessed 24px of padding,
which over-reported the chain (8px padding) by six pixels on every cell and
hid the columns that were actually wrong. A measuring instrument that is
wrong is worse than none.

## Prices are rounded, and rounding is a direction

Two bugs, same shape, found one after the other.

The chain rounded bid and ask to the **nearest** cent off an already-rounded
mark, so on a sub-dollar contract a bid could land a hair above the model's
own fair value — and its implied vol then read *higher* than the contract's,
which is the one thing a Bid IV column exists to rule out.

The tape built a print's quote by walking a mid **out** from the fill and
spreading half a width each way, which puts the bid and ask on the wrong
side of the print: every ask-side print above its own ask.

Both fixed the same way: build the quote **from the fill (or the fair value)
outward**, floor the bid, ceil the ask. `bid < fair < ask` then holds by
construction, and every ordering that depends on it holds with it. And read
any derived position back off the **rounded** numbers, so the dot on a rail
sits where the printed figures say it does.

Cent arithmetic needs the nudge: `0.19 * 100` is `18.999999999999996` and
floors to 18.

## Compounding cells is how you find data bugs

The tape's fill, its side and its NBBO lived in three columns for months
with the fill outside its own quote on every single row. Putting the three
numbers in one cell made it unmissable in one glance. **Facts that are read
together belong together**, and not only because it is easier to read —
because a contradiction between them becomes visible.

## A redirect that drops the query breaks every link into the page

React Router's `<Navigate to="/path">` keeps the path and throws `search`
and `hash` away. Harmless while page state lived in localStorage; silently
destructive the moment a filter lives in the address.
`/trace/tape?order=premium&kind=sweep` landed on `/trace/live-tape` with a
bare URL and the reader's own default tape, and nothing said so. Every hop
goes through a `Keep` wrapper that carries them.

## The URL/state handshake needs a beat

Reading a cut in from the query and writing it back out are two effects in
the same pass, and on the pass that *reads* a link the state has not caught
up. The writer looks at a still-default cut, decides the address is wrong,
and **erases the link it was just handed**. The reader has to hand the
writer a beat — applied, not yet settled, sit this one out.

## A design-system component nobody imports is not a design system

`ui/DataState` defined the four non-answers — loading, empty, unavailable,
error — with a careful note on why conflating empty and unavailable is the
failure it exists to prevent. **Zero files imported it.** Meanwhile the two
tables had two different empty renderings and `DataTable`'s default empty
string was literally `"No data"`.

The fix is never "write the component". It is to put it behind the thing
everyone already uses — here, the grids' own no-rows overlay — so adopting
it costs nothing and *not* adopting it takes effort.

The same shape, three more times in one pass: the disabled treatment existed
at 25%, 30%, 35%, 40% and 50% opacity with two different cursors; the
screener's saved-views UI was sixty lines of one-off buttons the tape could
not reuse, so the tape simply had no saved views; and the house `Modal` —
portal, Escape, scroll lock — had four users while a page hand-rolled its
own with none of that, and no focus trap anywhere.

**A one-off pattern does not just cost consistency; it makes the second
surface worse.**

## A day key is not a date, and an unbounded weekday walk is a hang

`dayKey()` returns `2026-9-21` — a hash seed, unpadded. `isoDate()` returns
`2026-09-21` — a date. They look alike and only one of them parses:
`new Date('2026-9-21T12:00:00')` is an **Invalid Date**.

That alone is a bug. What made it a *hang* is the second half:

```js
while (d.getDay() !== 5) d.setDate(d.getDate() + 1);   // first Friday
```

`getDay()` on an Invalid Date is `NaN`, `NaN !== 5` is true forever, and the
tab stops responding — not an error, not a blank screen, a pinned CPU and a
browser that will not even evaluate `document.body.children.length`. The
route sweep could not report it because the sweep itself never got an answer
back.

Two rules out of it:

- Take today from `core/calendar`'s `today()`/`isoDate()`, never from
  `dayKey()`. The day key is for seeding noise.
- **Every walk is bounded.** `core/calendar`'s own `walkToSession` carries
  the note "bounded — never spins" and the macro schedule's two weekday
  walks had missed it. A month has at most seven days before its first
  Friday, so seven iterations is the entire search and an eighth means the
  input was not a date.

And when a page hangs the browser rather than throwing, no console probe
will tell you: read the code along the render path for a `while` whose
condition compares against something that can be `NaN`.
