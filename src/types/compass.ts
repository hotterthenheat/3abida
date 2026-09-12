/*
==================================================
  SLAYER TERMINAL - COMPASS TYPES (compass.ts)
  Advisory signal engine — ENTER/EXIT guidance only.
  Four scanners, grouped setup feed, contract chain,
  signal monitor & impact leaderboard.
==================================================
*/

/*
  TWO AXES, one board (redesign 2026-08-04, docs/compass-redesign-port.md):
  the SLEEVE is the contract tenor (how long the trade lives), the SCANNER is
  the thesis lens (why the trade exists). Weeklies/Swings used to be scanner
  keys — they were always tenors wearing a scanner's hat, and the backtest
  spec's sleeves (Weekly/Swing/LEAPS/Lotto) confirm the split. Every scanner
  runs on every sleeve.
*/

export type SleeveKey = 'odte' | 'weekly' | 'swing' | 'leaps';

export interface SleeveDef {
  key: SleeveKey;
  label: string;
  /** Calendar days out, resolved to a real session through core/calendar. */
  dte: number;
  /** Strike-ladder rung width as a fraction of spot (snapped to the grid). */
  rungPct: number;
  blurb: string;
}

export const SLEEVES: SleeveDef[] = [
  { key: 'odte', label: '0DTE', dte: 0, rungPct: 0.005, blurb: 'Same session — expires at today’s bell' },
  { key: 'weekly', label: 'Weekly', dte: 5, rungPct: 0.012, blurb: 'This week — a few sessions to run, theta still light' },
  { key: 'swing', label: 'Swing', dte: 45, rungPct: 0.025, blurb: 'Six weeks — held for as long as the levels hold' },
  { key: 'leaps', label: 'LEAPS', dte: 365, rungPct: 0.06, blurb: 'A year out — direction over days, not minutes' },
];

export const SLEEVE_BY_KEY: Record<SleeveKey, SleeveDef> = Object.fromEntries(
  SLEEVES.map(s => [s.key, s])
) as Record<SleeveKey, SleeveDef>;

export type ScannerKey =
  | 'top-setups'
  | 'quick-scalp'
  | 'discounted'
  | 'rebounds'
  | 'whale-sweeps'
  | 'all';

export interface ScannerDef {
  key: ScannerKey;
  label: string;
  blurb: string;
}

/* THE KINDS, in plain words (the Compass walk, 2026-09-11): the reader picks
   one on the board's Kind card. The keys are the engine's and the journal's —
   they never change; only the words did ("Whale Sweeps" echoed the
   reference's brand word, banned on Trace the same way). */
export const SCANNERS: ScannerDef[] = [
  { key: 'top-setups', label: 'Top ranked', blurb: 'The strongest by trend and hedging' },
  { key: 'quick-scalp', label: 'Quick scalp', blurb: 'Fast intraday moves, held for minutes' },
  { key: 'discounted', label: 'Discounted', blurb: 'Priced under the move expected' },
  { key: 'rebounds', label: 'Rebounds', blurb: 'A turn off a level that held' },
  { key: 'whale-sweeps', label: 'Big orders', blurb: 'Large orders swept across the exchanges' },
  { key: 'all', label: 'All kinds', blurb: 'Every setup, whatever found it' },
];

/*
  WHICH LENS RUNS ON WHICH TENOR (Noah, 2026-08-07). A fully-crossed grid
  sells nonsense trades: a scalp's whole thesis is an intraday hold (no
  business on tenors DEFINED by holding overnight — though the math spec's
  own ruling keeps it on weeklies), and Rebounds' math is a days-to-weeks
  bounce (a year-long instrument for a two-week thesis is twelve months of
  premium for a fortnight of idea). Discounted and Whale Sweeps are genuinely
  tenor-agnostic. This map IS the backtest spec's candidate-eligibility gate —
  the journal and the harness inherit it, so we never evaluate a combination
  the product doesn't sell.
*/
export const ELIGIBLE_SCANNERS: Record<SleeveKey, ScannerKey[]> = {
  odte: ['top-setups', 'quick-scalp', 'discounted', 'rebounds', 'whale-sweeps', 'all'],
  weekly: ['top-setups', 'quick-scalp', 'discounted', 'rebounds', 'whale-sweeps', 'all'],
  swing: ['top-setups', 'discounted', 'rebounds', 'whale-sweeps', 'all'],
  leaps: ['top-setups', 'discounted', 'whale-sweeps', 'all'],
};

export function isScannerEligible(scanner: ScannerKey, sleeve: SleeveKey): boolean {
  return ELIGIBLE_SCANNERS[sleeve]?.includes(scanner) ?? false;
}

/** The engine's internal read on a contract. Kept to ourselves for loop
    scoring — users never see a command, only a state (see VERDICT_LABEL). */
export type Verdict = 'ENTER' | 'EXIT' | 'WATCH';

/** User-facing labels: the engine grades itself with ENTER/EXIT internally,
    but the terminal shows states, not orders. */
export const VERDICT_LABEL: Record<Verdict, string> = {
  ENTER: 'ACTIVE',
  WATCH: 'WATCH',
  EXIT: 'FADING',
};

export type Momentum = 'STRENGTHENING' | 'NEUTRAL' | 'WEAKENING';

/** Per-strike engine recommendation shown in the contract chain. */
export type ChainAction = 'HOLD' | 'REDUCE' | 'SELL';

/** LADDER INVARIANT (any provider of this field must hold it): statuses run
    HIT* → at most ONE 'IN PROGRESS' → PENDING*, in rung order. The frontier
    rung is the only one working; the UI draws exactly one live marker from
    it. On real data, HIT additionally means price actually crossed the target
    since the setup triggered — never infer it from anything else. */
export type TakeProfitStatus = 'PENDING' | 'IN PROGRESS' | 'HIT';

export type OptionRight = 'C' | 'P';

export interface SetupGreeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  iv: number;
}

export interface TargetLevel {
  price: number;
  pct: number;
}

export interface TakeProfit {
  level: number;
  status: TakeProfitStatus;
  expectedPct: number;
  target: number;
}

export interface Setup {
  id: string;
  ticker: string;
  contract: string;
  right: OptionRight;
  strike: number;
  /** Display bucket, e.g. "0DTE" / "5DTE" — the sleeve's voice. */
  expiry: string;
  /** The REAL expiry session, YYYY-MM-DD, resolved through core/calendar —
      never a weekend or holiday. This is what the journal writer records. */
  expiryDate: string;
  /** Trading sessions of runway at scan time (calendar-aware). */
  sessionsLeft: number;
  /** Underlying 1σ move to expiry, percent — iv·√(sessions/252)·100. Real
      math, unlike expectedMovePct which speaks premium-target language. */
  sigmaMovePct: number;
  sleeve: SleeveKey;
  score: number;
  verdict: Verdict;
  topRated: boolean;
  topOpportunity: boolean;
  expectedMovePct: number;
  swingTarget: TargetLevel;
  scalpExit: TargetLevel;
  headline: string;
  whyChips: string[];
  whyText: string;
  greeks: SetupGreeks;
  bid: number;
  ask: number;
  mid: number;
  liveMid: number;
  /** Highest premium reached since entry. INVARIANT with the ladder: a rung is
      HIT if and only if its target ≤ highWater — the rail draws this as the
      campaign's memory, so "banked, then faded" reads instead of contradicting
      the chips. Real data must supply the true running max. */
  highWater: number;
  confidence: number;
  health: number;
  momentum: Momentum;
  takeProfits: TakeProfit[];
  /** Underlying price milestones matching TP1–TP4 — drawn on campaign charts */
  priceTargets: number[];
  liquidityLabel: 'Tight' | 'Normal' | 'Wide';
  liquiditySpread: string;
  invalidationPrice: number;
  invalidationReason: string;
}

/** One name's market state as the scan sees it. The Compass engine takes the
    whole universe as an ARGUMENT — live pages pass the simulator's quotes, a
    replay harness passes historical ones, and the engine can't tell which. */
export interface UniverseQuote {
  ticker: string;
  price: number;
  /** Annualized IV, e.g. 0.15 */
  iv: number;
  /** Strike grid increment */
  step: number;
}

export interface SetupGroup {
  ticker: string;
  spot: number;
  sparkline: number[];
  changePct: number;
  found: number;
  setups: Setup[];
}

export interface ChainSide {
  premium: number;
  changePct: number;
  health: number;
  momentum: Momentum;
  action: ChainAction;
}

export interface ChainRow {
  strike: number;
  call: ChainSide;
  put: ChainSide;
}

export interface ContractChain {
  ticker: string;
  spot: number;
  rows: ChainRow[];
}

/** The four reasons a contract carries weight (Mo, 2026-08-19: "show why
    each one matters: Gamma, Volume/OI, Distance from spot, Net exposure"). */
export type ImpactMetric = 'gamma' | 'voloi' | 'distance' | 'exposure';

export interface ImpactRow {
  rank: number;
  contract: string;
  strike: number;
  right: OptionRight;
  /** Display bucket matching the board's sleeve — the expiry the analysis page opens. */
  expiry: string;
  openInterest: number;
  volume: number;
  /** Today's volume against open interest — above 1×, more traded today than existed this morning. */
  volOi: number;
  /** Strike distance from spot, signed percent: + above, − below. */
  distPct: number;
  /** This contract's dealer gamma, signed dollars — negative absorbs moves, positive amplifies. */
  exposureUsd: number;
  /** Share of the whole book's gamma, percent. */
  gamma: number;
}

/** Why a contract is on a setup's driver list — the part it plays in the
    book the campaign trades through. */
export type DriverRole = 'This contract' | 'Call wall' | 'Put wall' | 'Supreme' | 'Pin' | 'In the path';

export interface DriverRow extends ImpactRow {
  role: DriverRole;
}

export interface CompassView {
  scanner: ScannerKey;
  groups: SetupGroup[];
  totalFound: number;
  shown: number;
  chain: ContractChain;
}
