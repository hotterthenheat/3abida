/*
  THE PARITY FIXTURE FOR THE PYTHON PORT (2026-09-17).

  Runs the TypeScript greeks engine — the one every surface on the site prices
  with today — over a grid of inputs and writes the outputs to
  engine/tests/fixtures/greeks_ref.json. The Python engine's parity test reads
  that file and must reproduce every number to 1e-12 relative. When the
  TypeScript engine changes, run this again and the Python test says whether
  the port kept up:

    npx tsx scripts/greeks-ref.ts
    cd engine && .venv/Scripts/python -m pytest

  The rule this enforces is the partner spec's: one implementation of the
  math. Until the port is total, this file is the leash between the two.
*/

import { mkdirSync, writeFileSync } from 'node:fs';
import { blackScholesGreeks, blackScholesPrice, impliedVolFromPrice } from '../src/core/greeks';
import { DEFAULT_Q, DEFAULT_R } from '../src/core/carry';

const spots = [50, 100, 250, 480.25, 4300];
const moneyness = [0.8, 0.95, 1, 1.02, 1.25];
const years = [0.5 / 252, 1 / 252, 5 / 252, 21 / 252, 0.5, 2];
const vols = [0.08, 0.2, 0.45, 1.2];

const cases: unknown[] = [];
for (const S of spots)
  for (const m of moneyness)
    for (const t of years)
      for (const v of vols) {
        const K = Math.round(S * m * 100) / 100;
        const g = blackScholesGreeks(S, K, t, v);
        const call = blackScholesPrice(S, K, t, v, 'C');
        const put = blackScholesPrice(S, K, t, v, 'P');
        cases.push({
          S, K, t, v,
          greeks: g,
          call, put,
          /* the inversion must land back on v (or null where the price is outside the model) */
          ivFromCall: impliedVolFromPrice(call, S, K, t, 'C'),
          ivFromPut: impliedVolFromPrice(put, S, K, t, 'P'),
        });
      }

/* the guards: t and v at or below zero take the engine's floors — and the inversion is asked
   the engine's own answer, never written by hand (the first cut wrote null here and the
   Python port, matching the engine, rightly disagreed) */
for (const [t, v] of [[0, 0.2], [0.1, 0]] as const) {
  const call = blackScholesPrice(100, 100, t, v, 'C');
  const put = blackScholesPrice(100, 100, t, v, 'P');
  cases.push({ S: 100, K: 100, t, v, greeks: blackScholesGreeks(100, 100, t, v), call, put, ivFromCall: impliedVolFromPrice(call, 100, 100, t, 'C'), ivFromPut: impliedVolFromPrice(put, 100, 100, t, 'P') });
}

const out = { carry: { r: DEFAULT_R, q: DEFAULT_Q }, generatedBy: 'scripts/greeks-ref.ts', cases };
mkdirSync('engine/tests/fixtures', { recursive: true });
writeFileSync('engine/tests/fixtures/greeks_ref.json', JSON.stringify(out));
console.log(`wrote ${cases.length} cases to engine/tests/fixtures/greeks_ref.json`);
