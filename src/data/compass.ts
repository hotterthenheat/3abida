/*
==================================================
  SLAYER TERMINAL - COMPASS ENGINE (compass.ts)
  Placeholder advisory model. Deterministic per contract
  so rows stay stable across ticks. Swap this whole file
  for the real quant engine / ThetaData feed later.
==================================================
*/

import { blackScholesGreeks } from '../core/greeks';
import { expiryFor } from '../core/calendar';
import { isoDay } from '../core/journal';
import type { MarketSnapshot, StrikeNode } from '../types/market';
import { SLEEVE_BY_KEY, isScannerEligible } from '../types/compass';
import type {
  ChainAction,
  ChainRow,
  ContractChain,
  DriverRole,
  DriverRow,
  ImpactRow,
  Momentum,
  OptionRight,
  ScannerKey,
  Setup,
  SetupGroup,
  SleeveKey,
  UniverseQuote,
  CompassView,
  TakeProfit,
  TakeProfitStatus,
  Verdict,
} from '../types/compass';

// ---- deterministic RNG ----------------------------------------------------
function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry(seedNum: number): () => number {
  let a = seedNum;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// ---- scanner tuning -------------------------------------------------------
/*
  Scanner = thesis lens; tenor now lives on the SLEEVE (types/compass SLEEVES,
  resolved to a real session through core/calendar). Floors are Heuristic
  constants calibrated against this sim field — the evaluation loop owns them
  once the journal runs (docs/compass-backtest-spec.md).
*/
interface ScannerProfile {
  swingMul: number; // swing target aggressiveness
  scalpMul: number; // scalp exit tightness
  moveBias: number; // expected-move scaling
  scoreFloor: number; // min score to surface a setup
}

const PROFILES: Record<ScannerKey, ScannerProfile> = {
  'top-setups': { swingMul: 0.38, scalpMul: 0.18, moveBias: 1.0, scoreFloor: 90 },
  'quick-scalp': { swingMul: 0.22, scalpMul: 0.1, moveBias: 0.7, scoreFloor: 88 },
  discounted: { swingMul: 0.6, scalpMul: 0.28, moveBias: 1.35, scoreFloor: 86 },
  rebounds: { swingMul: 0.45, scalpMul: 0.22, moveBias: 1.15, scoreFloor: 85 },
  'whale-sweeps': { swingMul: 0.42, scalpMul: 0.2, moveBias: 1.1, scoreFloor: 89 },
  all: { swingMul: 0.38, scalpMul: 0.18, moveBias: 1.0, scoreFloor: 80 },
};

/** The score floor a scanner surfaces at — internal only since 2026-08-16
    prints this, so it must come from the same table the gate reads. */
export function scannerFloor(scanner: ScannerKey): number {
  return (PROFILES[scanner] ?? PROFILES['top-setups']).scoreFloor;
}

/** Target/expected-move scaling per tenor — a swing's runway earns wider
    targets than a same-day ticket regardless of which lens found it. */
const SLEEVE_MOVE_MUL: Record<SleeveKey, number> = {
  odte: 1.0,
  weekly: 1.6,
  swing: 2.3,
  leaps: 3.2,
};

const WHY_LIBRARY: Record<ScannerKey, { chips: string[]; text: (t: string, k: number) => string }> = {
  'top-setups': {
    chips: ['TREND ALIGNED', 'DEALER SUPPORT', 'RSI CONFIRM'],
    text: (t, k) =>
      `Solid institutional buy walls are supporting price at ${k}. Market makers are heavily short this strike and must buy ${t} to stay hedged, forming an automatic protective floor under our entry.`,
  },
  'quick-scalp': {
    chips: ['HIGH GAMMA', 'FAST DECAY', 'TIGHT STOP'],
    text: (t) =>
      `Concentrated gamma at this strike makes ${t} whippy — dealer re-hedging amplifies small moves. Scalp the pop and take profit fast before theta bleeds the premium.`,
  },
  discounted: {
    chips: ['CHEAP PREMIUM', 'ASYMMETRIC', 'VALUE'],
    text: (t) =>
      `Premium is mispriced relative to the projected move. Implied vol is underpricing the expected ${t} range, giving an asymmetric payout if the move materializes.`,
  },
  rebounds: {
    chips: ['OVERSOLD', 'STRUCTURE SUPPORT', 'MEAN REVERSION'],
    text: (t, k) =>
      `${t} is oversold near key support at ${k}. Price has compressed into a structure floor where dealer hedging creates a natural bounce zone. Reversal probability is elevated.`,
  },
  'whale-sweeps': {
    chips: ['BLOCK PRINTS', 'SMART MONEY', 'ACCUMULATION'],
    text: (t, k) =>
      `Repeated large sweep orders are accumulating ${t} exposure near ${k}. Following the institutional footprint — size and persistence of prints suggest informed positioning.`,
  },
  all: {
    chips: ['MULTI-SIGNAL', 'COMPOSITE', 'BROAD SCAN'],
    text: (t, k) =>
      `${t} at ${k} qualifies across multiple scanner criteria — trend alignment, premium value and flow signals all pulling the same way.`,
  },
};

// ---- premium / greeks model ----------------------------------------------
/** The setup pricer's floor — what "the flat tail" bottoms out at. */
export const PREMIUM_FLOOR = 0.05;

/**
 * TIME-AWARE premium (2026-08-08, engine 0.2.0): intrinsic + normal-shaped
 * time value whose width is iv·√t — the old fixed-width version priced a
 * 0DTE and a LEAPS identically, which the sleeve axis made a visible lie.
 * EXPORTED because the monitor's track chart must reprice with THE model
 * that minted the mid — a second pricer is a chart that contradicts the
 * number printed beside it (the partner's two-pricer lesson).
 */
export function estimatePremium(
  spot: number,
  strike: number,
  right: OptionRight,
  iv: number,
  tYears: number
): number {
  /* NO time floor in the core — the partner's build documents exactly this
     trap ("both engines floor at half a session, so neither can express
     intraday decay — a forward curve is a horizontal line on every 0DTE").
     Quote call-sites floor their INPUT (a listed contract has at least half
     a session); the decay curve needs the raw limit, where t→0 collapses
     time value to zero and intrinsic is all that remains. */
  const width = iv * Math.sqrt(Math.max(tYears, 0));
  const m = Math.log(strike / spot) / (width || 1e-6);
  const timeValue = spot * width * 0.4 * Math.exp(-(m * m) / 2);
  const intrinsic = right === 'C' ? Math.max(spot - strike, 0) : Math.max(strike - spot, 0);
  return Math.max(PREMIUM_FLOOR, intrinsic + timeValue);
}

function healthFor(spot: number, strike: number, right: OptionRight): number {
  // Calls: healthier ITM (low strike). Puts: healthier ITM (high strike).
  const moneyness = (strike - spot) / spot; // + above spot
  const base = right === 'C' ? 50 - moneyness * 900 : 50 + moneyness * 900;
  return Math.round(clamp(base, 22, 78));
}

function momentumFromHealth(health: number): Momentum {
  if (health >= 56) return 'STRENGTHENING';
  if (health >= 45) return 'NEUTRAL';
  return 'WEAKENING';
}

function actionFromHealth(health: number): ChainAction {
  if (health >= 56) return 'HOLD';
  if (health >= 45) return 'REDUCE';
  return 'SELL';
}

// ---- setup builder --------------------------------------------------------
function buildTakeProfits(mid: number, moveBias: number, rng: () => number, verdict: Verdict, count: number): TakeProfit[] {
  const ladders = [0.3, 0.8, 1.5]
    .slice(0, count)
    .map(p => p * (0.8 + moveBias * 0.3));
  const progress = rng();
  // Progress only exists on active recommendations — a WATCH/EXIT setup was
  // never entered, so nothing can be HIT or IN PROGRESS.
  const active = verdict === 'ENTER';
  /* The ladder is a FRONTIER: every rung below it is HIT, the frontier rung is
     the one IN PROGRESS, everything past it is PENDING. Exactly one rung works
     at a time — a ladder climbs one rung at a time by definition.

     The old branch logic (`i === 0 || (i === 1 && progress > 0.4)`) violated
     this in the 0.4–0.66 window: TP1 hadn't banked (that takes 0.66) but TP2's
     gate was already open, so BOTH showed IN PROGRESS — two beams orbiting on
     the monitor. Noah caught it in review. Encoding the frontier structurally
     means no pair of thresholds can ever disagree again. */
  const banked = active && progress > 0.66 ? 1 : 0; // sim: at most rung 1 banks
  return ladders.map((pct, i): TakeProfit => {
    const status: TakeProfitStatus = i < banked ? 'HIT' : active && i === banked ? 'IN PROGRESS' : 'PENDING';
    return {
      level: i + 1,
      status,
      expectedPct: Math.round(pct * 100),
      target: Number((mid * (1 + pct)).toFixed(2)),
    };
  });
}

/** The tenor a bare DTE falls in — the Weigher and the print drilldown
    grade user-named contracts on the sleeve their expiry belongs to, so
    every surface asks the SAME engine the same question. */
export function sleeveForDte(dte: number): SleeveKey {
  return dte <= 0 ? 'odte' : dte <= 6 ? 'weekly' : dte <= 90 ? 'swing' : 'leaps';
}

/* THE SETUP'S ID IS ITS ADDRESS (the Compass walk, 2026-09-11): a setup's
   page lives at /compass/<id>, so the id round-trips — built here, read back
   here. Same shape `makeSetup` stamps: TICKER-strike-R-kind-tenor. */
const ID_RE = /^([A-Z][A-Z0-9.]{0,6})-(\d+(?:\.\d+)?)-([CP])-(top-setups|quick-scalp|discounted|rebounds|whale-sweeps|all)-(odte|weekly|swing|leaps)$/;

export interface SetupAddress {
  ticker: string;
  strike: number;
  right: OptionRight;
  scanner: ScannerKey;
  sleeve: SleeveKey;
}

export function setupIdOf(a: SetupAddress): string {
  const strikeLabel = a.strike % 1 === 0 ? a.strike.toFixed(0) : a.strike.toFixed(2);
  return `${a.ticker.toUpperCase()}-${strikeLabel}-${a.right}-${a.scanner}-${a.sleeve}`;
}

export function parseSetupId(id: string): SetupAddress | null {
  const m = id.match(ID_RE);
  if (!m) return null;
  return { ticker: m[1], strike: Number(m[2]), right: m[3] as OptionRight, scanner: m[4] as ScannerKey, sleeve: m[5] as SleeveKey };
}

export function makeSetup(
  ticker: string,
  spot: number,
  strike: number,
  right: OptionRight,
  scanner: ScannerKey,
  iv: number,
  sleeve: SleeveKey = 'weekly',
  /** Exact DTE for user-named contracts (the Weigher's chain/search) — the
      sleeve keeps flavoring targets and copy, but the expiry, sessions and
      pricing follow the CONTRACT the user actually named, not the sleeve's
      canonical tenor. Scanner-driven callers omit it; nothing changes. */
  dteOverride?: number
): Setup {
  // Callers can hand us persisted scanner keys from older builds ('weeklies',
  // 'swings' were scanner keys before the sleeve axis) — an unknown key must
  // degrade to the default profile, never crash the page.
  const profile = PROFILES[scanner] ?? PROFILES['top-setups'];
  const sleeveDef = SLEEVE_BY_KEY[sleeve] ?? SLEEVE_BY_KEY.weekly;
  // The RNG seed EXCLUDES the sleeve on purpose: the same contract found by
  // the same lens should keep its identity noise across tenors; tenor-driven
  // differences must come from real math (time, sigma, targets), not reseeds.
  const rng = mulberry(hash(`${ticker}-${strike}-${right}-${scanner}`));
  const strikeLabel = strike % 1 === 0 ? strike.toFixed(0) : strike.toFixed(2);
  const contract = `${ticker} ${strikeLabel}${right}`;

  // The REAL expiry session, through the clock-aware calendar — a replay pins
  // the engine clock and this date follows it.
  const exp = expiryFor(dteOverride ?? sleeveDef.dte);
  const sessionsLeft = Math.max(exp.sessions, 0.5);
  const sigmaMovePct = Number((iv * Math.sqrt(sessionsLeft / 252) * 100).toFixed(1));
  const moveMul = SLEEVE_MOVE_MUL[sleeve] ?? 1;

  const mid = Number(estimatePremium(spot, strike, right, iv, sessionsLeft / 252).toFixed(2));
  const spread = Math.max(0.02, mid * 0.03);
  const bid = Number((mid - spread / 2).toFixed(2));
  const ask = Number((mid + spread / 2).toFixed(2));
  const liveMid = Number((mid * (0.9 + rng() * 0.2)).toFixed(2));

  const health = clamp(healthFor(spot, strike, right) + Math.round((rng() - 0.5) * 12), 5, 99);
  const momentum = momentumFromHealth(health);

  // Opportunity score: near-the-money + aligned with the ticker's lean scores highest;
  // far-OTM or opposed contracts score low, so verdict spans ENTER / WATCH / EXIT.
  const bullish = tickerLean(ticker, scanner);
  const aligned = bullish ? right === 'C' : right === 'P';
  const proximity = 1 - Math.min(1, Math.abs(strike - spot) / (spot * 0.03));
  const score = Math.round(
    clamp(96 * (0.4 + 0.6 * proximity) * (aligned ? 1 : 0.55) + (rng() - 0.5) * 8, 8, 99)
  );
  const expectedMovePct = Number((profile.moveBias * moveMul * (24 + rng() * 22)).toFixed(1));

  // Real time input — a LEAPS delta and a 0DTE delta are different animals.
  const greeks = blackScholesGreeks(spot, strike, sessionsLeft / 252, iv);
  const delta = right === 'C' ? greeks.deltaCall : greeks.deltaPut;
  const verdict: Verdict = score >= 88 ? 'ENTER' : score >= 72 ? 'WATCH' : 'EXIT';

  /* TPs ARE EARNED (Noah, 2026-08-30: "some cons only require 1 tp whilst
     others the math ... can push to 3"). The ladder is as long as the math
     supports — three rungs for the strongest, one for marginal, and NONE
     for a fading thesis: a dead setup gets no trade furniture, so the
     chart shows no TP and no floor either (the floor gates on rung count
     downstream — one fact, every surface). */
  const tpCount = score >= 94 ? 3 : score >= 80 ? 2 : score >= 72 ? 1 : 0;

  const why = WHY_LIBRARY[scanner];
  // States, not orders — the engine's ENTER/EXIT call stays internal.
  const headline =
    verdict === 'ENTER'
      ? `ACTIVE — STRONG ${right === 'C' ? 'CALL' : 'PUT'} STRUCTURE`
      : verdict === 'WATCH'
        ? 'WATCH — BUILDING, NOT PROVEN'
        : 'FADING — THESIS DEGRADING';

  // Liquidity: derive from bid/ask spread
  const spreadPct = mid > 0 ? ((ask - bid) / mid) * 100 : 0;
  const liquidityLabel: 'Tight' | 'Normal' | 'Wide' = spreadPct <= 2 ? 'Tight' : spreadPct <= 5 ? 'Normal' : 'Wide';
  const liquiditySpread = `${spreadPct.toFixed(1)}% spread`;

  // Invalidation: nearest support/resistance based on direction
  const invalidationOffset = spot * (0.008 + rng() * 0.012); // 0.8–2% away
  const invalidationPrice = right === 'C'
    ? Number((spot - invalidationOffset).toFixed(2))     // calls invalidate below
    : Number((spot + invalidationOffset).toFixed(2));     // puts invalidate above
  // The reason has to point the same way the price does — a call dies when a
  // level BELOW it gives way (support), a put when a level ABOVE it holds
  // (resistance). One rng() draw either way keeps the seed stream identical.
  const invalidationReasons =
    right === 'C'
      ? ['Dealer buy-wall support', 'Gamma concentration floor', 'Dark-pool accumulation level', 'Key open-interest cluster']
      : ['Dealer sell-wall resistance', 'Gamma concentration ceiling', 'Dark-pool distribution level', 'Key open-interest cluster'];
  const invalidationReason = invalidationReasons[Math.floor(rng() * invalidationReasons.length)];

  // Underlying milestones matching TP1–TP4 — fractions of the scanner's
  // expected underlying move, direction-signed, for the campaign chart.
  const dir = right === 'C' ? 1 : -1;
  /* One story, three numbers. Noah caught the contradiction on a dossier
     card: TP1 wore a HIT chip while the rail's NOW marker sat below entry.
     liveMid is drawn from ±10% of entry, but TP1 lives at +~38% — the premium
     could never have reached the target the chip claimed. Statuses and
     position were two unrelated rolls.

     highWater makes it one narrative: the highest premium the campaign has
     printed. It sits just past the highest banked rung (that is HOW the rung
     banked), or at today's high when nothing has. liveMid stays the current
     position — allowed to fade under entry AFTER banking, which is a real
     shape ("hit, then faded") the rail can now draw instead of contradict. */
  const takeProfits = buildTakeProfits(mid, profile.moveBias * moveMul, rng, verdict, tpCount);
  const lastHit = [...takeProfits].reverse().find(tp => tp.status === 'HIT');
  const highWater = Number(
    (lastHit ? lastHit.target * (1.01 + rng() * 0.07) : Math.max(liveMid, mid * (1 + rng() * 0.08))).toFixed(2)
  );

  const priceTargets = [0.8, 1.6, 2.6].slice(0, tpCount).map(step =>
    Number((spot * (1 + dir * profile.moveBias * moveMul * step * 0.005)).toFixed(2))
  );

  return {
    id: `${ticker}-${strikeLabel}-${right}-${scanner}-${sleeve}${dteOverride != null ? `-${dteOverride}d` : ''}`,
    ticker,
    contract,
    right,
    strike,
    expiry: exp.dte === 0 ? '0DTE' : `${exp.dte}DTE`,
    expiryDate: isoDay(exp.date),
    sessionsLeft,
    sigmaMovePct,
    sleeve,
    score,
    verdict,
    topRated: score >= 93,
    topOpportunity: score >= 90,
    expectedMovePct,
    swingTarget: { price: Number((mid * (1 + profile.swingMul)).toFixed(2)), pct: Math.round(profile.swingMul * 100) },
    scalpExit: { price: Number((mid * (1 + profile.scalpMul)).toFixed(2)), pct: Math.round(profile.scalpMul * 100) },
    headline,
    whyChips: why.chips,
    whyText: why.text(ticker, strike),
    greeks: {
      delta: Number(delta.toFixed(2)),
      gamma: Number(greeks.gamma.toFixed(4)),
      theta: Number((-Math.abs(greeks.vega) * 0.4 - rng() * 4).toFixed(2)),
      vega: Number(greeks.vega.toFixed(2)),
      iv: Number((iv * 100).toFixed(1)),
    },
    bid,
    ask,
    mid,
    liveMid,
    confidence: Math.round(clamp((score - 55) * 2.1, 5, 98)),
    health,
    momentum,
    takeProfits,
    highWater,
    priceTargets,
    liquidityLabel,
    liquiditySpread,
    invalidationPrice,
    invalidationReason,
  };
}

// ---- feed / groups --------------------------------------------------------
function buildSparkline(ticker: string, spot: number): number[] {
  const rng = mulberry(hash(`${ticker}-spark`));
  const out: number[] = [];
  let p = spot * 0.994;
  for (let i = 0; i < 24; i++) {
    p += (rng() - 0.47) * spot * 0.002;
    out.push(Number(p.toFixed(2)));
  }
  out.push(spot);
  return out;
}

/** Deterministic directional lean per ticker+scanner. Shared by feed and monitor. */
function tickerLean(ticker: string, scanner: ScannerKey): boolean {
  return mulberry(hash(`${ticker}-${scanner}-group`))() > 0.42;
}

/** Strike rungs as a PERCENT of spot, snapped to the name's own grid and
    never finer than it — a $1,000 name and a $20 name get comparable ladders,
    and longer sleeves physically widen them (SleeveDef.rungPct). */
function strikeLadder(spot: number, step: number, rungPct: number, rungs: number, up: boolean): number[] {
  const rung = Math.max(step, Math.round((spot * rungPct) / step) * step);
  const out: number[] = [];
  for (let i = 0; i <= rungs; i++) {
    const strike = Math.round((spot + (up ? i : -i) * rung) / step) * step;
    if (!out.includes(strike)) out.push(strike);
  }
  return out;
}

function buildGroup(
  ticker: string,
  spot: number,
  iv: number,
  step: number,
  scanner: ScannerKey,
  sleeve: SleeveKey
): SetupGroup | null {
  const bullish = tickerLean(ticker, scanner);
  const candidates: Setup[] = [];

  const rungPct = (SLEEVE_BY_KEY[sleeve] ?? SLEEVE_BY_KEY.weekly).rungPct;
  const right: OptionRight = bullish ? 'C' : 'P';
  for (const strike of strikeLadder(spot, step, rungPct, 3, bullish)) {
    const setup = makeSetup(ticker, spot, strike, right, scanner, iv, sleeve);
    if (setup.score >= PROFILES[scanner].scoreFloor) candidates.push(setup);
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  const setups = candidates.slice(0, 2);
  const sparkline = buildSparkline(ticker, spot);
  const changePct = ((sparkline[sparkline.length - 1] - sparkline[0]) / sparkline[0]) * 100;

  return { ticker, spot, sparkline, changePct: Number(changePct.toFixed(2)), found: setups.length, setups };
}

// ---- contract chain -------------------------------------------------------
/** Exported for the Weigher's expiry-railed chain — same builder the scanner
    view uses, priced at whatever tenor the rail names. */
export function buildChain(snapshot: MarketSnapshot, iv: number, tYears: number): ContractChain {
  const { ticker, spot, chain } = snapshot;
  const sorted = [...chain].sort((a, b) => a.strike - b.strike);
  const spotIdx = sorted.findIndex(n => n.strike >= spot);
  const start = Math.max(0, spotIdx - 6);
  const window = sorted.slice(start, start + 12);

  const rows: ChainRow[] = window.map(node => {
    const callHealth = healthFor(spot, node.strike, 'C');
    const putHealth = healthFor(spot, node.strike, 'P');
    const callRng = mulberry(hash(`${ticker}-${node.strike}-C-chain`));
    const putRng = mulberry(hash(`${ticker}-${node.strike}-P-chain`));
    return {
      strike: node.strike,
      call: {
        premium: Number(estimatePremium(spot, node.strike, 'C', iv, tYears).toFixed(2)),
        // Centered noise so OTM strikes can print red — a change column that
        // can never go negative reads fake.
        changePct: Math.round(clamp((spot - node.strike) / spot * 800 + (callRng() - 0.35) * 30, -60, 130)),
        health: callHealth,
        momentum: momentumFromHealth(callHealth),
        action: actionFromHealth(callHealth),
      },
      put: {
        premium: Number(estimatePremium(spot, node.strike, 'P', iv, tYears).toFixed(2)),
        changePct: Math.round(clamp((node.strike - spot) / spot * 800 + (putRng() - 0.35) * 30, -60, 130)),
        health: putHealth,
        momentum: momentumFromHealth(putHealth),
        action: actionFromHealth(putHealth),
      },
    };
  });

  return { ticker, spot, rows };
}

// ---- contract facts: the book, one row per contract ------------------------
/**
 * Every contract on a name's book with WHY it carries weight (Mo,
 * 2026-08-19): its share of the book's gamma, today's volume against open
 * interest, its distance from spot, and the signed dealer exposure it alone
 * carries. Rows identify themselves by strike and side so a click can open
 * the contract's own analysis page; the expiry bucket follows the board's
 * sleeve, because that is the expiry the analysis will price.
 */
function buildContractFacts(snapshot: MarketSnapshot, sleeve: SleeveKey): Omit<ImpactRow, 'rank'>[] {
  const { ticker, spot, chain } = snapshot;
  const exp = expiryFor((SLEEVE_BY_KEY[sleeve] ?? SLEEVE_BY_KEY.weekly).dte);
  const expiry = exp.dte === 0 ? '0DTE' : `${exp.dte}DTE`;
  const totalGamma = chain.reduce((a, n) => a + Math.abs(n.callGex) + Math.abs(n.putGex), 0) || 1;
  return chain.flatMap(node => {
    const mk = (right: OptionRight, oi: number, exposureUsd: number): Omit<ImpactRow, 'rank'> => {
      // Deterministic per contract so the rail holds still between sweeps
      const volume = Math.round(oi * (0.2 + (hash(`${node.strike}${right}`) % 140) / 100));
      return {
        contract: `${ticker} ${node.strike % 1 === 0 ? node.strike.toFixed(0) : node.strike.toFixed(2)}${right}`,
        strike: node.strike,
        right,
        expiry,
        openInterest: oi,
        volume,
        volOi: oi > 0 ? Number((volume / oi).toFixed(2)) : 0,
        distPct: Number((((node.strike - spot) / spot) * 100).toFixed(2)),
        exposureUsd: Math.round(exposureUsd),
        gamma: Number(((Math.abs(exposureUsd) / totalGamma) * 100).toFixed(1)),
      };
    };
    // Sim side-coding: callGex negative (dealers absorb), putGex positive (amplify)
    return [mk('C', node.callOI, node.callGex), mk('P', node.putOI, node.putGex)];
  });
}

// ---- heaviest contracts (the board rail) ----------------------------------
/**
 * The heaviest contracts on ONE name's book, by gamma share. The PAGE decides
 * which book — the name the desk is on, or the one the board is filtered to
 * (Noah, 2026-08-19: a single name's rail beside a cross-ticker board has to
 * say whose book it is). 24 deep (Noah, 2026-08-17: 8 left the rail half
 * empty beside the board) — the rail fills its column and scrolls for the tail.
 */
export function buildImpact(snapshot: MarketSnapshot, sleeve: SleeveKey): ImpactRow[] {
  return buildContractFacts(snapshot, sleeve)
    .sort((a, b) => b.gamma - a.gamma)
    .slice(0, 24)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

// ---- contracts driving ONE setup ------------------------------------------
/**
 * "Top contracts driving the setup" (Mo, 2026-08-19) — true of ONE setup on
 * ONE name, so it lives on the analysis page. Each row is a contract with the
 * PART it plays in the book this campaign trades through:
 *   This contract — the setup's own strike and side
 *   Call wall / Put wall — the heaviest call gamma above spot, put gamma below
 *   Supreme — the largest net gamma strike on the book (its dominant side)
 *   Pin — the max-open-interest strike (its dominant side)
 *   In the path — the heaviest exposure between spot and the final target,
 *                 the hedging the move has to get through
 * Structural roles first, deduplicated; the path fills to the limit.
 */
export function buildSetupDrivers(
  snapshot: MarketSnapshot,
  target: { strike: number; right: OptionRight; priceTargets?: number[] },
  sleeve: SleeveKey,
  limit = 8
): DriverRow[] {
  const { spot, chain } = snapshot;
  if (!chain.length) return [];
  const facts = buildContractFacts(snapshot, sleeve);
  const byKey = new Map(facts.map(f => [`${f.strike}${f.right}`, f]));
  const pick = (strike: number, right: OptionRight) => byKey.get(`${strike}${right}`);

  const out: DriverRow[] = [];
  const used = new Set<string>();
  const add = (row: Omit<ImpactRow, 'rank'> | undefined, role: DriverRole) => {
    if (!row || out.length >= limit) return;
    const key = `${row.strike}${row.right}`;
    if (used.has(key)) return;
    used.add(key);
    out.push({ ...row, role, rank: out.length + 1 });
  };

  add(pick(target.strike, target.right), 'This contract');

  let callWall: StrikeNode | null = null;
  let putWall: StrikeNode | null = null;
  for (const n of chain) {
    if (n.strike > spot && (!callWall || Math.abs(n.callGex) > Math.abs(callWall.callGex))) callWall = n;
    if (n.strike < spot && (!putWall || Math.abs(n.putGex) > Math.abs(putWall.putGex))) putWall = n;
  }
  if (callWall) add(pick(callWall.strike, 'C'), 'Call wall');
  if (putWall) add(pick(putWall.strike, 'P'), 'Put wall');

  const supreme = chain.reduce((a, n) => (Math.abs(n.netGex) > Math.abs(a.netGex) ? n : a), chain[0]);
  add(pick(supreme.strike, Math.abs(supreme.callGex) >= Math.abs(supreme.putGex) ? 'C' : 'P'), 'Supreme');

  const pin = chain.reduce((a, n) => (n.callOI + n.putOI > a.callOI + a.putOI ? n : a), chain[0]);
  add(pick(pin.strike, pin.callOI >= pin.putOI ? 'C' : 'P'), 'Pin');

  const far = target.priceTargets?.length ? target.priceTargets[target.priceTargets.length - 1] : null;
  if (far != null) {
    const lo = Math.min(spot, far);
    const hi = Math.max(spot, far);
    const path = facts
      .filter(f => f.strike >= lo && f.strike <= hi)
      .sort((a, b) => Math.abs(b.exposureUsd) - Math.abs(a.exposureUsd));
    for (const f of path) add(f, 'In the path');
  }
  return out;
}

// ---- top-level assembly ---------------------------------------------------
/**
 * The full Compass scan. `universe` is the market state of every name on the
 * board — REQUIRED, never defaulted, and this module deliberately does not
 * import the simulator: whoever calls decides what "the market" is. Live
 * pages pass Simulator.universeQuotes(); a replay harness passes historical
 * quotes; both run byte-identical scoring. An engine that quietly read live
 * state here is exactly how a backtest lies.
 */
export function buildCompassView(
  snapshot: MarketSnapshot,
  scanner: ScannerKey,
  universe: UniverseQuote[],
  sleeve: SleeveKey = 'weekly'
): CompassView {
  // The eligibility gate lives in the ENGINE, not just the tabs: an
  // ineligible lens×tenor combination yields an EMPTY scan, honestly — the
  // same gate the backtest harness will read, so it can never evaluate a
  // combination the product doesn't sell. The chain still builds: it is a
  // fact about the ticker, not about the lens.
  const activeIvGuard = universe.find(q => q.ticker === snapshot.ticker)?.iv ?? 0.2;
  // The sleeve's remaining life, in years — the chain prices at the TENOR the
  // board is showing, same clock-aware resolution the setups use.
  const sleeveT =
    Math.max(expiryFor((SLEEVE_BY_KEY[sleeve] ?? SLEEVE_BY_KEY.weekly).dte).sessions, 0.5) / 252;
  if (!isScannerEligible(scanner, sleeve)) {
    return {
      scanner,
      groups: [],
      totalFound: 0,
      shown: 0,
      chain: buildChain(snapshot, activeIvGuard, sleeveT),
    };
  }

  // The active name leads; the rest of the universe follows in given order
  const seen = new Set<string>();
  const feed = [
    ...universe.filter(q => q.ticker === snapshot.ticker),
    ...universe.filter(q => q.ticker !== snapshot.ticker),
  ].filter(q => (seen.has(q.ticker) ? false : (seen.add(q.ticker), true)));

  const groups: SetupGroup[] = [];
  for (const q of feed) {
    const group = buildGroup(q.ticker, q.price, q.iv, q.step, scanner, sleeve);
    if (group) groups.push(group);
  }
  groups.sort((a, b) => (b.setups[0]?.score ?? 0) - (a.setups[0]?.score ?? 0));

  const totalFound = groups.reduce((a, g) => a + g.found, 0);
  // The live harness always includes the active name; the fallback only
  // exists so a malformed universe degrades instead of throwing mid-render.
  const activeIv = universe.find(q => q.ticker === snapshot.ticker)?.iv ?? 0.2;

  return {
    scanner,
    groups,
    totalFound,
    shown: totalFound,
    chain: buildChain(snapshot, activeIv, sleeveT),
  };
}
