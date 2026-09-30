# The engine — `slayer_core`

The one implementation of Slayer's math. The live loop imports it; the replay
harness imports it; nothing else computes a Greek, a wall or a score. Ported
from the TypeScript engines function by function, each held to the
TypeScript output by a parity test until the port is total and the
TypeScript copy is retired (the rule in `docs/compass-backtest-spec.md`: one
source of truth, exercised two ways).

## Run it

```bash
# once: the engine's own environment (already created on 2026-09-17)
python -m venv engine/.venv
engine/.venv/Scripts/python -m pip install numpy pytest tzdata pyarrow

# whenever the TypeScript engines change: regenerate the references
npx tsx scripts/greeks-ref.ts      # src/core/greeks.ts
npx tsx scripts/calendar-ref.ts    # src/core/calendar.ts
npx tsx scripts/exposure-ref.ts    # the chain builder, data/exposure.ts, data/exposureSurface.ts, core/walls.ts, data/airPockets.ts
npx tsx scripts/journal-ref.ts     # types/journal.ts + core/journal.ts — type-check it first (the command is in its header):
npx tsc --noEmit --ignoreConfig --strict --skipLibCheck --target ES2020 --module ESNext --moduleResolution bundler --types node,vite/client scripts/journal-ref.ts
npx tsx scripts/indicators-ref.ts  # the simulator's getIndicators

# the tests: the partner's seven fixture numbers, then parity with TypeScript
cd engine && .venv/Scripts/python -m pytest -q
```

## What is here

| Module | Ported from | Held to |
|---|---|---|
| `slayer_core/carry.py` | `src/core/carry.ts` | the same defaults (r 4.2%, q 1.2%), asserted by the parity test |
| `slayer_core/greeks.py` | `src/core/greeks.ts` | `tests/fixtures/greeks_ref.json`, 1e-12 relative; the vectorised forms held to the scalar forms |
| `slayer_core/clock.py` | `src/core/clock.ts` | the engine clock: wall clock live, pinned by the replay (`engine_clock(at)`) |
| `slayer_core/calendar.py` | `src/core/calendar.ts` | `tests/fixtures/calendar_ref.json`, exact: every day 2016–2027, 1,008 session spans, 1,311 expiries, the futures clock over a week; the holiday table is the same list in both copies, extended back to 2016 on 2026-09-17 |
| `slayer_core/walls.py` | `src/core/walls.ts`, `src/data/airPockets.ts` | `tests/fixtures/exposure_ref.json`, exact: the wall and flip rules on eleven books drawn to their edges (one-sided books answer None, never spot), the air pockets on nine windows |
| `slayer_core/exposure.py` | the chain builder in `src/core/simulator.ts`, `src/data/exposure.ts`, `src/data/exposureSurface.ts` | the same fixture, 1e-12 relative: five seeded books into exposures (the dealer prior −0.55 / −0.53), 17 profiles (three lenses, the levels, the zones, the bias), 7 strike × expiry surfaces (the desk's calendar and the ledger's) |
| `slayer_core/journal.py` | `src/types/journal.ts`, `src/core/journal.ts` | `tests/fixtures/journal_ref.json`, exact: the OCC symbol and the contract, source and decision identities; the literal sets enumerated through the TypeScript types; one typed sample of every record shape, round-tripped through the wire (camelCase, the seam's own names) unchanged |
| `slayer_core/indicators.py` | `getIndicators` in `src/core/simulator.ts` | `tests/fixtures/indicators_ref.json`, 1e-12: the seeded histories and series drawn to hit every branch (no losses reads 100, no gains reads 50, under 50 points is neutral) |
| `slayer_core/tape.py` | new (2026-09-17) | `tests/test_tape.py`: Parquet written once and refused twice, a frame read as a filter (the last interval at or before the instant, the session's open interest, the last bar), the expiry grouping with sides aligned, the manifest, the append-only daily series |
| `slayer_core/theta.py` | ThetaData v3's pages, read 2026-09-17 | the request URLs held to the documented example URLs; the parsers tried on rows in the documented column order; `pull_day` with an injected fetch, NO_DATA on open interest tolerated |
| `slayer_core/snapshot.py` | new (2026-09-17) | `tests/test_snapshot.py`: a frame drawn from Black-Scholes at a known vol gives that vol back; an unquoted contract takes the expiry's ATM vol and is counted; a dead expiry is dropped; the 30-day constant-maturity vol and the IV rank against hand-computed values; the vectorised inversion held to the scalar |
| `tests/test_fixture.py` | `scripts/fixture-proof.ts` | the spec's §46 numbers: DEX −43,840, GEX −1,764 per 1%, EV $74.00, POP 30%, v1 utility +$7.43 |

The tape is Parquet on R2, one directory per symbol per session day (quotes,
open interest, the underlying's 1-minute bars with vwap), written once by one
writer (`theta.pull_day` for history, the same code as the live poller) and
read as a filter. The photograph (`snapshot.build_photograph`) prices every
contract's implied vol by the engine's own bisection over the mid (ThetaData's
Greeks are not used), builds the exposure book per expiry, the front profile
and the surface, the 30-day constant-maturity base vol, the IV rank against
the tape's daily series, and the indicators; it answers the market half of
FeatureSnapshot and the top layer adds the rest. Two facts to verify against a
running terminal before the first pull are named in `theta.py`'s header and in
`docs/launch-costs.md` chapter 12, the pull plan.

The journal's records are frozen dataclasses that check what the TypeScript
states in comments: an identity must be what the builders build, a literal must
be in its set, an instant must carry a zone, SIM is refused by
`assert_evaluable`, a weights revision must move the engine version.
`to_wire` / `from_wire` are the only doors; an unknown or missing key is an
error at the door. The additive fields the spec's gap-check names (ev / pop /
utility, no-trade records, availability timestamps, assignment, the raw level
and buffer) land in both copies at once, never here first.

What the exposure port takes as INPUT rather than reproducing: the simulator's
leg jitter and volume hash (arrays the fixture supplies; the live book passes
none), and each expiry's contracts (`DeskExpiry`: the desk's modelled chain in
the fixture, ThetaData's rows in the loop). The rules are what is ported. With
one source for the front and the calendar, the surface's anchor reduces to the
dealer prior on each leg, and a test says so.

## The order the port lands

1. the floor — Greeks, pricing, implied vol, the calendar and sessions, the exposure book and its levels, the journal's records (all here)
2. the tape and the photograph — ThetaData rows onto the tape, a frame into what the engine can know (here; the first real pull waits on the Pro subscriptions and the two verifications)
3. the top layer — the four kinds' features, labels and scoring, from the partner's newest math files, straight into Python

Two things kept on purpose for parity: the normal CDF is the TypeScript
engine's polynomial (Abramowitz–Stegun 26.2.17), not `math.erf`; vega and rho
are per one point of their input. Both move to exact forms only when the
TypeScript copy is retired, in one commit, with the fixture regenerated.
