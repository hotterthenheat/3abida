/*
==================================================
  SLAYER TERMINAL - DECISION JOURNAL CONTRACTS (journal.ts)

  The spine of the loop: choice → record → resolve → recalibrate.
  Compass-scoped: every record here describes a Compass decision (a scanner
  setup or a Weigher grade), what the engine SAW when it decided, what the
  market later DID about it, and how the weights were retuned in response.

  Frozen seam, same discipline as every file in types/ — the future backend
  implements these; the live journal writer and the historical replay harness
  both write the SAME shapes, distinguished only by FeatureSnapshot.provenance.

  Semantics that are load-bearing:
  · DecisionEvent and FeatureSnapshot are APPEND-ONLY and immutable — a
    decision is never edited after write, only resolved by an OutcomeEvent.
  · OutcomeEvent facts come from REAL market data only. A target "hit" means
    price actually crossed it after the decision, never an inference.
  · Every decision carries engineVersion, so eras stay comparable after any
    recalibration. Weights never change silently — a WeightsRevision row is
    the only door.
==================================================
*/

import type { ScannerKey, SleeveKey, Verdict } from './compass';
// Type-only import from core: Horizon is declared next to the weights it
// indexes. Journal rows must use the same literal type, not a copy that
// could drift.
import type { Horizon } from '../core/contractScore';

/** Engine build stamp, e.g. "compass@0.3.0". Bump on ANY change to scoring
    math, weights, thresholds, or candidate generation — replay comparability
    depends on it. Current value lives in core/journal.ts. */
export type EngineVersion = string;

/** Options today; delta-one instruments are first-class so single-name
    futures never force a schema migration — only a new instrument literal. */
export type Instrument = 'OPTION' | 'STOCK' | 'SINGLE_NAME_FUTURE';

/**
 * Canonical contract identity. The frontend's display ids are NOT stable
 * (Setup.id has no date; WeighedContract.id re-keys as DTE shrinks) — the
 * journal joins on `occ` instead, which names one real contract forever.
 */
export interface ContractId {
  instrument: Instrument;
  ticker: string;
  /** OPTION only */
  right?: 'C' | 'P';
  /** OPTION only */
  strike?: number;
  /** Real expiry session, YYYY-MM-DD (resolved through core/calendar — never
      a weekend or holiday). OPTION and SINGLE_NAME_FUTURE. */
  expiry?: string;
  /** The join key everywhere. OPTION: OCC 21-char symbol, e.g.
      "SPY   260731C00500000". STOCK: the ticker. SINGLE_NAME_FUTURE:
      "FUT:TICKER:YYYY-MM-DD". Built by core/journal.ts, never by hand. */
  occ: string;
}

/** Which Compass surface emitted the decision. `sleeve` arrived with the
    2026-08-04 two-axis redesign (scanner = thesis, sleeve = tenor); optional
    because pre-sleeve decisions don't carry one. Evolved while zero journal
    rows exist anywhere — the last cheap moment to touch this seam. */
export type DecisionSource =
  | { kind: 'scanner'; scanner: ScannerKey; sleeve?: SleeveKey }
  | { kind: 'weigher'; horizon: Horizon };

/** What the market showed at the decision instant. */
export interface Marks {
  bid: number;
  ask: number;
  mid: number;
  /** Underlying price */
  spot: number;
}

/** One rung of the plan, as PLANNED at decision time (premium space).
    Whether it was reached lives in OutcomeEvent.targetsHit — never here. */
export interface PlannedTarget {
  level: number;
  targetPremium: number;
  expectedPct: number;
}

/** How a level-based exit is judged. The UI promise is a session CLOSE
    through the level ("retires on a close through it") — TOUCH exists so
    intraday scanners can declare the stricter rule explicitly. */
export type CloseRule = 'SESSION_CLOSE_THROUGH' | 'TOUCH';

/** The choice, recorded the instant it was made. Append-only. */
export interface DecisionEvent {
  /** `${occ}|${sourceKey}|${decidedAt}` — see core/journal.ts */
  id: string;
  engineVersion: EngineVersion;
  /** ISO instant. Live writer stamps the wall clock; replay stamps the
      pinned engine clock. Same field, same meaning. */
  decidedAt: string;
  source: DecisionSource;
  contract: ContractId;
  marks: Marks;
  /** Composite score at decision time */
  score: number;
  /** Internal loop vocabulary (users see states, the journal sees verdicts) */
  verdict: Verdict;
  targets: PlannedTarget[];
  /** The level that kills the thesis, on the UNDERLYING, and its rule.
      side = which way through the level means dead. */
  invalidation: { price: number; side: 'BELOW' | 'ABOVE'; rule: CloseRule };
  /** Trading sessions of runway at decision time (calendar-aware) */
  sessionsToExpiry: number;
  featureSnapshotId: string;
}

/** Where a snapshot's inputs came from. SIM data must never be evaluated as
    if it were market truth — provenance is how the evaluation layer refuses. */
export type FeatureProvenance = 'SIM' | 'LIVE' | 'REPLAY';

/**
 * What the engine SAW when it decided — the photograph that makes "reflect
 * on why it was a bad choice" possible later. Referenced by DecisionEvent;
 * stored separately because outcomes join to decisions far more often than
 * anyone re-reads the full input state.
 */
export interface FeatureSnapshot {
  id: string;
  decidedAt: string;
  ticker: string;
  provenance: FeatureProvenance;
  /** Version of the data pipeline that produced the inputs (vendor feeds,
      GEX derivation constants, DP-intent heuristic) — inputs recalibrate too. */
  dataVersion?: string;
  spot: number;
  ivRank: number;
  /** Annualized base IV, percent (e.g. 15.2) */
  baseIvPct: number;
  rsi: number;
  /** The dealer-positioning levels the engine saw */
  gex: { callWall: number; putWall: number; flip: number; supreme: number; netGex: number };
  /** Dark-pool read: posture −100 (distributing) .. +100 (accumulating) */
  darkPool: { posture: number };
  /** News read: lean −1 (bearish) .. +1 (bullish), and how loud the tape was */
  news: { lean: number; volume: number };
  /** The Weigher's factor board as-scored: key, 0–100 score, weight applied */
  factors: { key: string; score: number; weight: number }[];
}

/** A real crossing of a planned target — timestamped market fact. */
export interface TargetCross {
  level: number;
  at: string;
  /** Premium at the crossing */
  mark: number;
}

export type ExitReason =
  | 'EXPIRY'
  | 'INVALIDATED' // the invalidation level broke per its CloseRule
  | 'ALL_TARGETS_HIT'
  | 'ENGINE_EXIT'; // verdict decayed to EXIT before any terminal event

/**
 * How it ended. ONE terminal OutcomeEvent per decision, written when the
 * campaign resolves. Every number here is derived from real market data
 * after decidedAt — nothing is copied forward from the decision's hopes.
 */
export interface OutcomeEvent {
  decisionId: string;
  resolvedAt: string;
  exit: { reason: ExitReason; at: string; mark: number };
  /** Real crossings only, in rung order — the journal's version of the
      ladder invariant (a level appears here iff price actually reached it) */
  targetsHit: TargetCross[];
  /** Path stats over the whole life, premium space:
      highWater = best mark reached; maxFavorablePct / maxAdversePct are the
      classic MFE/MAE, % of entry mid. */
  path: { highWater: number; maxFavorablePct: number; maxAdversePct: number };
  /** P&L as % of entry mid — at exit, plus fixed horizons for calibration */
  pnl: { atExitPct: number; horizons: { sessions: number; pct: number }[] };
  sessionsHeld: number;
}

// ---- evaluation → recalibration ------------------------------------------

/** One score band's real-world performance — the calibration curve's point. */
export interface CalibrationBucket {
  scoreMin: number;
  scoreMax: number;
  samples: number;
  /** Share of decisions in this band whose TP1 was actually crossed */
  tp1HitRate: number;
  avgPnlPct: number;
}

/** Which factor lied, tallied over misses — the "reflect why" made concrete. */
export interface FactorAttribution {
  factorKey: string;
  /** Mean factor score across LOSING decisions minus across winners; a large
      positive value means the factor was confidently wrong on losers. */
  missBias: number;
  samples: number;
}

/** One evaluation pass over a window of resolved decisions, per source. */
export interface EvaluationRun {
  id: string;
  ranAt: string;
  engineVersion: EngineVersion;
  source: DecisionSource;
  window: { from: string; to: string };
  samples: number;
  /** Hit rate per rung, rung order */
  targetHitRates: number[];
  /** Mean R multiple (risk = entry→invalidation distance) */
  expectancyR: number;
  calibration: CalibrationBucket[];
  attribution: FactorAttribution[];
}

/**
 * A deliberate weights change. The ONLY way scoring parameters move:
 * versioned, justified by an evaluation, activated at a known instant —
 * so any decision can be replayed under the exact weights that scored it.
 */
export interface WeightsRevision {
  engineVersion: EngineVersion;
  previousVersion: EngineVersion;
  /** Which sleeve's weights changed */
  horizon: Horizon;
  /** Factor key → new weight */
  weights: Record<string, number>;
  basedOnEvaluationId: string;
  activatedAt: string;
  note: string;
}
