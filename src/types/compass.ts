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
   reference's brand word, banned on Trace the same way). THE LENSES WEAR THE
   OWNER'S KIND NAMES (2026-10-11, docs/compass-setups-2026-10-11.md): each
   engine lens is the main source of one of the board's kinds (KINDS below),
   so the Tracker, Pulse's tile and a setup's page say the same name. */
export const SCANNERS: ScannerDef[] = [
  { key: 'top-setups', label: 'Top Setups', blurb: 'The strongest by trend and hedging' },
  /* "Quick Scalps", the owner's chosen name (2026-10-11 — it was "Fast movers" from the audit's X8.2): what the kind
     finds — fast same-day index trades, where concentrated gamma makes small moves fast. The key stays the engine's. */
  { key: 'quick-scalp', label: 'Quick Scalps', blurb: 'Where concentrated gamma makes small moves fast' },
  { key: 'discounted', label: 'Cheap Options', blurb: 'Priced under the move expected' },
  { key: 'rebounds', label: 'Bounces', blurb: 'A turn off a level that held' },
  { key: 'whale-sweeps', label: 'Flow & Positioning', blurb: 'Large orders swept across the exchanges' },
  { key: 'all', label: 'All Setups', blurb: 'Every setup, whatever found it' },
];

/*
  THE BOARD'S FILTERS (the owner, 2026-10-11: "build this in compass UI NO MATH
  OR BACKEND THIS IS ALL UI" — docs/compass-setups-2026-10-11.md). Four cards on
  the board's line: Expiry (a category, or a date on the calendar), Kind (two
  sections, Main and Advanced), Option type (the structure a card is), Name.
  These are the WORDS; which stand-in setup falls where is
  data/compassStandIn.ts, and the 0DTE rule is data/expiryClass.ts.
*/

export type KindKey =
  | 'top'
  | 'quick-scalps'
  | 'trend'
  | 'breakouts'
  | 'bounces'
  | 'earnings'
  | 'cheap'
  | 'all'
  | 'premium-selling'
  | 'volatility'
  | 'flow'
  | 'events';

export type KindTier = 'main' | 'advanced';

/** The option type a kind opens on — Main's kinds are single legs by default */
export type StrategyKey = 'single' | 'steady' | 'big' | 'spreads' | 'premium' | 'vol';

export interface KindDef {
  key: KindKey;
  label: string;
  /** One line: what the setup is, never what to do */
  line: string;
  tier: KindTier;
  /** The option type the board turns to when this kind is picked */
  opens: StrategyKey;
}

export const KINDS: KindDef[] = [
  { key: 'top', label: 'Top Setups', line: 'The strongest few, across every kind', tier: 'main', opens: 'single' },
  { key: 'quick-scalps', label: 'Quick Scalps', line: 'Fast same-day trades on indexes and index ETFs only — on single stocks they do not hold up', tier: 'main', opens: 'single' },
  { key: 'trend', label: 'Trend Plays', line: 'A pullback inside a trend, then the trend carrying on', tier: 'main', opens: 'single' },
  { key: 'breakouts', label: 'Breakouts', line: 'A break out of a range, or to a new high or low', tier: 'main', opens: 'single' },
  { key: 'bounces', label: 'Bounces', line: 'A key level holding — support or resistance turned away, or a rebound after an unusually sharp move', tier: 'main', opens: 'single' },
  {
    key: 'earnings',
    label: 'Earnings & Events',
    line: 'Options pricing a smaller event move than the name has made before — the buying side; rich event premium is under Advanced, Events and Premium Selling',
    tier: 'main',
    opens: 'single',
  },
  { key: 'cheap', label: 'Cheap Options', line: 'Options priced low against the move expected', tier: 'main', opens: 'single' },
  { key: 'all', label: 'All Setups', line: 'Every setup that qualifies', tier: 'main', opens: 'single' },
  { key: 'premium-selling', label: 'Premium Selling', line: 'Options priced rich, and the structures that collect premium — put spreads among them', tier: 'advanced', opens: 'premium' },
  { key: 'volatility', label: 'Volatility', line: 'Cheap against expensive options, volatility expanding, and IV crush', tier: 'advanced', opens: 'vol' },
  { key: 'flow', label: 'Flow & Positioning', line: 'Unusual options activity, dealer gamma and dark-pool prints, as context', tier: 'advanced', opens: 'single' },
  { key: 'events', label: 'Events', line: 'The implied move against the actual move — earnings, and Fed days broken down', tier: 'advanced', opens: 'vol' },
];

export const KIND_BY_KEY: Record<KindKey, KindDef> = Object.fromEntries(KINDS.map(k => [k.key, k])) as Record<KindKey, KindDef>;

export interface StrategyDef {
  key: StrategyKey;
  label: string;
  line: string;
  /** Steady and Big Payoff are the two halves of Calls & Puts */
  parent?: StrategyKey;
}

/** The option types the board lists; Calls & Puts is where it opens */
export const STRATEGIES: StrategyDef[] = [
  { key: 'single', label: 'Calls & Puts', line: 'Long calls and long puts' },
  { key: 'steady', label: 'Steady', line: 'Deep in the money, a higher delta', parent: 'single' },
  { key: 'big', label: 'Big Payoff', line: 'At the money, larger percentage moves possible', parent: 'single' },
  { key: 'spreads', label: 'Spreads', line: 'Debit call spreads and debit put spreads' },
  { key: 'premium', label: 'Premium Selling', line: 'Credit put spreads, SPX and XSP first, and cash-secured puts' },
  { key: 'vol', label: 'Volatility', line: 'Long straddles and long strangles' },
];

export const STRATEGY_BY_KEY: Record<StrategyKey, StrategyDef> = Object.fromEntries(STRATEGIES.map(s => [s.key, s])) as Record<StrategyKey, StrategyDef>;

/** Shown, never picked: the structures that come after testing */
export const STRATEGIES_LATER = ['Calendars', 'Diagonals', 'Iron condors', 'Iron flies'] as const;

/** The structure a card is — what its legs are */
export type StructureKey = 'long-call' | 'long-put' | 'debit-call-spread' | 'debit-put-spread' | 'credit-put-spread' | 'cash-secured-put' | 'long-straddle' | 'long-strangle';

/** Which option type each structure belongs to (Steady and Big Payoff are read off the single legs) */
export const STRUCTURE_TYPE: Record<StructureKey, Exclude<StrategyKey, 'steady' | 'big'>> = {
  'long-call': 'single',
  'long-put': 'single',
  'debit-call-spread': 'spreads',
  'debit-put-spread': 'spreads',
  'credit-put-spread': 'premium',
  'cash-secured-put': 'premium',
  'long-straddle': 'vol',
  'long-strangle': 'vol',
};

export type TagKey = 'unusual' | 'penny';

export const TAGS: Record<TagKey, { label: string; line: string }> = {
  unusual: { label: 'Unusual Activity', line: 'Significant options flow agrees with the setup' },
  penny: { label: 'Penny Precision', line: 'Helps identify potential short-strike levels' },
};

/** The expiration categories, by calendar days to the contract's last trading day */
export type ExpiryCat = '0dte' | 'weekly' | 'swing' | 'position' | 'long';

export interface ExpiryCatDef {
  key: ExpiryCat;
  label: string;
  line: string;
  /** Calendar days to the last trading day, inclusive — 0DTE is read off the day itself, not the count */
  min: number;
  max: number;
}

export const EXPIRY_CATS: ExpiryCatDef[] = [
  { key: '0dte', label: '0DTE', line: 'Its last trading day is today', min: 0, max: 0 },
  { key: 'weekly', label: 'Weekly', line: '1 to 7 days', min: 1, max: 7 },
  { key: 'swing', label: 'Swing', line: '8 to 45 days', min: 8, max: 45 },
  { key: 'position', label: 'Position', line: '46 to 90 days', min: 46, max: 90 },
  { key: 'long', label: 'Long-Dated', line: '91 days or more — LEAPS past about nine months', min: 91, max: Number.POSITIVE_INFINITY },
];

export const EXPIRY_CAT_BY_KEY: Record<ExpiryCat, ExpiryCatDef> = Object.fromEntries(EXPIRY_CATS.map(c => [c.key, c])) as Record<ExpiryCat, ExpiryCatDef>;

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
