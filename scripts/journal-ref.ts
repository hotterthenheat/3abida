/*
  THE JOURNAL'S PARITY FIXTURE (2026-09-17). Writes engine/tests/fixtures/journal_ref.json
  for engine/tests/test_journal_parity.py:

    · the identities, built by src/core/journal.ts (OCC symbols, contract ids, source keys,
      decision ids) over inputs chosen to hit the padding and rounding edges;
    · the literal sets, enumerated through Record<Literal, true> objects so a literal added
      to types/journal.ts or types/compass.ts fails THIS file's type-check until it is
      listed here — and then fails the Python test until it is listed there;
    · one fully populated sample of every record shape, TYPED against types/journal.ts, so
      a renamed field fails the type-check here and the Python round-trip there.

  Type-check it, then run it:

    npx tsc --noEmit --ignoreConfig --strict --skipLibCheck --target ES2020 --module ESNext --moduleResolution bundler --types node,vite/client scripts/journal-ref.ts
    npx tsx scripts/journal-ref.ts

  (Measured 2026-09-17: renaming `decidedAt` in a sample fails the first command with TS2561
  on both the snapshot and the decision; the Python round-trip fails on the same rename.)
*/

import { mkdirSync, writeFileSync } from 'node:fs';
import {
  ENGINE_VERSION,
  decisionId,
  futureContractId,
  occSymbol,
  optionContractId,
  sourceKey,
  stockContractId,
} from '../src/core/journal';
import type {
  CloseRule,
  DecisionEvent,
  DecisionSource,
  EvaluationRun,
  ExitReason,
  FeatureProvenance,
  FeatureSnapshot,
  Instrument,
  OutcomeEvent,
  WeightsRevision,
} from '../src/types/journal';
import type { ScannerKey, SleeveKey, Verdict } from '../src/types/compass';
import type { Horizon } from '../src/core/contractScore';

/* the literal sets: a key missing from one of these objects is a compile error */
const INSTRUMENTS: Record<Instrument, true> = { OPTION: true, STOCK: true, SINGLE_NAME_FUTURE: true };
const RIGHTS: Record<NonNullable<DecisionEvent['contract']['right']>, true> = { C: true, P: true };
const SCANNERS: Record<ScannerKey, true> = { 'top-setups': true, 'quick-scalp': true, discounted: true, rebounds: true, 'whale-sweeps': true, all: true };
const SLEEVES: Record<SleeveKey, true> = { odte: true, weekly: true, swing: true, leaps: true };
const HORIZONS: Record<Horizon, true> = { SAMEDAY: true, WEEKLIES: true, SWINGS: true, LEAPS: true };
const VERDICTS: Record<Verdict, true> = { ENTER: true, EXIT: true, WATCH: true };
const CLOSE_RULES: Record<CloseRule, true> = { SESSION_CLOSE_THROUGH: true, TOUCH: true };
const SIDES: Record<DecisionEvent['invalidation']['side'], true> = { BELOW: true, ABOVE: true };
const EXIT_REASONS: Record<ExitReason, true> = { EXPIRY: true, INVALIDATED: true, ALL_TARGETS_HIT: true, ENGINE_EXIT: true };
const PROVENANCES: Record<FeatureProvenance, true> = { SIM: true, LIVE: true, REPLAY: true };
const keys = (o: object) => Object.keys(o);

/* the OCC symbol on the edges: short and six-letter roots, a lower-case root, half and
   eighth strikes, the float traps (7.005 x 1000, 2.0005 x 1000 rounds half up) */
const occInputs: [string, string, 'C' | 'P', number][] = [
  ['SPY', '2026-07-31', 'C', 500],
  ['AAPL', '2026-08-01', 'P', 183.5],
  ['spy', '2026-07-31', 'C', 500],
  ['GOOGL', '2027-01-15', 'C', 1234.125],
  ['NVDA', '2026-09-18', 'P', 0.5],
  ['X', '2026-12-18', 'C', 7.005],
  ['TSLA', '2026-09-18', 'C', 2.0005],
  ['ABCDEF', '2026-10-16', 'P', 10],
  ['QQQ', '2026-09-17', 'C', 440.25],
  ['META', '2028-02-29', 'P', 99999.999],
];
const occ = occInputs.map(([ticker, expiry, right, strike]) => ({ ticker, expiry, right, strike, occ: occSymbol(ticker, expiry, right, strike), contract: optionContractId(ticker, expiry, right, strike) }));
const ids = { stock: stockContractId('spy'), future: futureContractId('tsla', '2026-12-18') };

/* every source: each scanner alone and on each sleeve, each horizon */
const sources: DecisionSource[] = [
  ...keys(SCANNERS).flatMap(scanner => [
    { kind: 'scanner', scanner } as DecisionSource,
    ...keys(SLEEVES).map(sleeve => ({ kind: 'scanner', scanner, sleeve }) as DecisionSource),
  ]),
  ...keys(HORIZONS).map(horizon => ({ kind: 'weigher', horizon }) as DecisionSource),
];
const sourceKeys = sources.map(source => ({ source, key: sourceKey(source) }));
const decisionIds = [
  { contract: occ[0].contract, source: sources[2], decidedAt: '2026-07-29T15:00:00Z' },
  { contract: occ[0].contract, source: sources[0], decidedAt: '2026-07-29T15:00:00Z' },
  { contract: ids.stock, source: sources[sources.length - 4], decidedAt: '2026-07-29T15:00:00.000Z' },
  { contract: ids.future, source: sources[sources.length - 1], decidedAt: '2026-07-29T15:00:00.000Z' },
].map(x => ({ ...x, id: decisionId(x.contract, x.source, x.decidedAt) }));

/* the samples, typed: the names below are checked against types/journal.ts by tsc */
const contract = optionContractId('SPY', '2026-07-31', 'C', 500);
const source: DecisionSource = { kind: 'scanner', scanner: 'top-setups', sleeve: 'weekly' };
const decidedAt = '2026-07-29T15:00:00.000Z';

const snapshot: FeatureSnapshot = {
  id: 'fs|SPY|2026-07-29T15:00:00.000Z',
  decidedAt,
  ticker: 'SPY',
  provenance: 'REPLAY',
  dataVersion: 'tape@2026-09',
  spot: 500.12,
  ivRank: 37.5,
  baseIvPct: 15.2,
  rsi: 55.3,
  gex: { callWall: 505, putWall: 495, flip: 499.5, supreme: 505, netGex: -210000000 },
  darkPool: { posture: 12 },
  news: { lean: 0.25, volume: 14 },
  factors: [
    { key: 'gex', score: 72, weight: 0.3 },
    { key: 'flow', score: 41, weight: 0.2 },
  ],
};
const snapshotLive: FeatureSnapshot = { ...snapshot, id: 'fs|SPY|2026-07-29T15:05:00.000Z', decidedAt: '2026-07-29T15:05:00.000Z', provenance: 'LIVE', dataVersion: undefined };
const snapshotSim: FeatureSnapshot = { ...snapshot, id: 'fs|SPY|sim', provenance: 'SIM', dataVersion: undefined };

const decision: DecisionEvent = {
  id: decisionId(contract, source, decidedAt),
  engineVersion: ENGINE_VERSION,
  decidedAt,
  source,
  contract,
  marks: { bid: 3.1, ask: 3.2, mid: 3.15, spot: 500.12 },
  score: 68.4,
  verdict: 'ENTER',
  targets: [
    { level: 505, targetPremium: 5.4, expectedPct: 71.4 },
    { level: 510, targetPremium: 8.9, expectedPct: 182.5 },
  ],
  invalidation: { price: 494.6, side: 'BELOW', rule: 'SESSION_CLOSE_THROUGH' },
  sessionsToExpiry: 2,
  featureSnapshotId: snapshot.id,
};
const weigher: DecisionSource = { kind: 'weigher', horizon: 'WEEKLIES' };
const watch: DecisionEvent = { ...decision, id: decisionId(contract, weigher, decidedAt), source: weigher, verdict: 'WATCH', score: 31.9 };
const stockDecision: DecisionEvent = {
  ...decision,
  id: decisionId(ids.stock, { kind: 'weigher', horizon: 'SAMEDAY' }, decidedAt),
  source: { kind: 'weigher', horizon: 'SAMEDAY' },
  contract: ids.stock,
  marks: { bid: 500.11, ask: 500.13, mid: 500.12, spot: 500.12 },
  targets: [{ level: 505, targetPremium: 505, expectedPct: 0.98 }],
  invalidation: { price: 497.9, side: 'BELOW', rule: 'TOUCH' },
  sessionsToExpiry: 0,
};

const outcome: OutcomeEvent = {
  decisionId: decision.id,
  resolvedAt: '2026-07-31T20:00:00.000Z',
  exit: { reason: 'ALL_TARGETS_HIT', at: '2026-07-30T18:12:00.000Z', mark: 9.1 },
  targetsHit: [
    { level: 505, at: '2026-07-30T14:40:00.000Z', mark: 5.5 },
    { level: 510, at: '2026-07-30T18:12:00.000Z', mark: 9.1 },
  ],
  path: { highWater: 9.4, maxFavorablePct: 198.4, maxAdversePct: -12.7 },
  pnl: { atExitPct: 188.9, horizons: [{ sessions: 1, pct: 74.6 }, { sessions: 2, pct: 188.9 }] },
  sessionsHeld: 2,
};

const evaluation: EvaluationRun = {
  id: 'eval|scanner:top-setups@weekly|2026-08-31',
  ranAt: '2026-08-31T22:00:00.000Z',
  engineVersion: ENGINE_VERSION,
  source,
  window: { from: '2026-07-01', to: '2026-08-31' },
  samples: 214,
  targetHitRates: [0.61, 0.34],
  expectancyR: 0.42,
  calibration: [
    { scoreMin: 0, scoreMax: 50, samples: 90, tp1HitRate: 0.44, avgPnlPct: -3.1 },
    { scoreMin: 50, scoreMax: 100, samples: 124, tp1HitRate: 0.73, avgPnlPct: 21.6 },
  ],
  attribution: [{ factorKey: 'gex', missBias: 4.2, samples: 214 }],
};

const revision: WeightsRevision = {
  engineVersion: 'compass@0.3.0-sim',
  previousVersion: ENGINE_VERSION,
  horizon: 'WEEKLIES',
  weights: { gex: 0.35, flow: 0.15, trend: 0.5 },
  basedOnEvaluationId: evaluation.id,
  activatedAt: '2026-09-01T13:30:00.000Z',
  note: 'gex up 5 points: calibration held, the tail did not worsen',
};

const out = {
  generatedBy: 'scripts/journal-ref.ts',
  engineVersion: ENGINE_VERSION,
  literals: {
    instruments: keys(INSTRUMENTS),
    rights: keys(RIGHTS),
    scanners: keys(SCANNERS),
    sleeves: keys(SLEEVES),
    horizons: keys(HORIZONS),
    verdicts: keys(VERDICTS),
    closeRules: keys(CLOSE_RULES),
    sides: keys(SIDES),
    exitReasons: keys(EXIT_REASONS),
    provenances: keys(PROVENANCES),
  },
  occ,
  ids,
  sourceKeys,
  decisionIds,
  samples: { snapshot, snapshotLive, snapshotSim, decision, watch, stockDecision, outcome, evaluation, revision },
};
mkdirSync('engine/tests/fixtures', { recursive: true });
writeFileSync('engine/tests/fixtures/journal_ref.json', JSON.stringify(out));
console.log(`wrote ${occ.length} OCC symbols, ${sourceKeys.length} source keys, ${decisionIds.length} decision ids, ${Object.keys(out.samples).length} samples`);
