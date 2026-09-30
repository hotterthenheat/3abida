/*
  THE INDICATORS' PARITY FIXTURE (2026-09-17). Runs the simulator's getIndicators — the
  function every snapshot's RSI, EMAs and squeeze come from — over the seeded histories and
  over series drawn to hit its branches, and writes engine/tests/fixtures/indicators_ref.json
  for engine/tests/test_snapshot.py. The inputs are chosen; every answer is the engine's.

    npx tsx scripts/indicators-ref.ts
*/

import { mkdirSync, writeFileSync } from 'node:fs';
import Simulator from '../src/core/simulator';

const drawn: { name: string; prices: number[] }[] = [
  { name: 'up only: no losses in the window', prices: Array.from({ length: 80 }, (_, i) => 100 + i * 0.5) },
  { name: 'down only: no gains in the window', prices: Array.from({ length: 80 }, (_, i) => 100 - i * 0.5) },
  { name: 'flat', prices: Array.from({ length: 80 }, () => 100) },
  { name: 'saw', prices: Array.from({ length: 120 }, (_, i) => 100 + ((i % 7) - 3) * 0.8 + i * 0.01) },
  { name: 'tight then wide', prices: Array.from({ length: 90 }, (_, i) => 100 + (i < 70 ? Math.sin(i) * 0.02 : Math.sin(i) * 3)) },
  { name: 'exactly fifty', prices: Array.from({ length: 50 }, (_, i) => 50 + Math.cos(i / 3) * 2) },
  { name: 'forty-nine: neutral', prices: Array.from({ length: 49 }, (_, i) => 50 + Math.cos(i / 3) * 2) },
  { name: 'three', prices: [100, 101, 102] },
  { name: 'one', prices: [100] },
];
const seeded = ['SPY', 'QQQ', 'AAPL', 'NVDA'].map(name => ({ name: `${name} history`, prices: Simulator.snapshotFor(name).priceHistory }));

const cases = [...seeded, ...drawn].map(c => ({ ...c, out: Simulator.getIndicators(c.prices) }));
const out = { generatedBy: 'scripts/indicators-ref.ts', cases };
mkdirSync('engine/tests/fixtures', { recursive: true });
writeFileSync('engine/tests/fixtures/indicators_ref.json', JSON.stringify(out));
console.log(`wrote ${cases.length} series (${cases.map(c => c.prices.length).join(', ')} points)`);
