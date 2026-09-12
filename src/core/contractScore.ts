/*
==================================================
  SLAYER TERMINAL - CONTRACT WEIGHER (contractScore.ts)
  Compass's scale. Across every sleeve — same-day,
  weeklies, swings and LEAPS — it prices real
  candidates (Black-Scholes), then weighs
  the math (breakeven vs expected move, theta burden),
  the tape (flow + dark-pool posture), and the story
  (news lean) into one composite: what's worth buying
  and what isn't — with the reason attached.

  ONE scorer, two callers: weighContracts() grades the
  auto sleeve; weighContract() grades any single strike
  the user names. Both route through scoreCandidate() so
  the number can never drift between them.

  DEMOTED FROM STATE AUTHORITY (2026-08-30). Noah caught
  the contradiction: this composite said "ACTIVE" on the
  Weigher while the Compass board — graded by makeSetup's
  opportunity score — never surfaced the same contract.
  Two engines, one vocabulary. The ruling: the STATE a
  user sees (ACTIVE/WATCH/FADING + confidence) comes from
  data/compass makeSetup everywhere; this file's verdict
  is engine-internal, and its factors render as what they
  truly are — the CONTRACT's build quality (spread, decay,
  vol pricing, liquidity), meters and prose, no state.
==================================================
*/

import { expiryFor } from './calendar';
import { dayKey, hRange } from './rng';
import { buildDarkPoolView } from '../data/darkpool';
import { tickerSentiment } from '../data/news';
import type { MarketSnapshot, StrikeNode } from '../types/market';

export type Horizon = 'SAMEDAY' | 'WEEKLIES' | 'SWINGS' | 'LEAPS';

export interface FactorScore {
  key: string;
  label: string;
  /** 0–100 */
  score: number;
  /** Horizon weight, sums to 1 across factors */
  weight: number;
  detail: string;
}

export type ContractVerdict = 'BUY' | 'WATCH' | 'FADE';

export interface WeighedContract {
  id: string;
  ticker: string;
  right: 'C' | 'P';
  strike: number;
  /** CALENDAR days to the real expiry (what the pricing math uses) */
  dte: number;
  expiryLabel: string;
  /** Weekday of the expiry — "Fri". Printed so a bad date can never hide. */
  expiryWeekday: string;
  /** TRADING sessions left — the count that actually decays the contract, and
      the honest answer to "how long do I have" over a weekend or a holiday. */
  sessionsLeft: number;
  mid: number;
  delta: number;
  ivPct: number;
  ivRank: number;
  /** Daily decay as % of premium (negative burden expressed positive) */
  thetaPerDayPct: number;
  spreadPct: number;
  oi: number;
  /** Move needed at expiry to break even, % of spot (signed toward the trade) */
  breakevenMovePct: number;
  /** One-sigma move to expiry, % */
  expectedMovePct: number;
  factors: FactorScore[];
  composite: number;
  verdict: ContractVerdict;
  edge: string;
  risk: string;
}

export const HORIZONS: { key: Horizon; label: string; blurb: string }[] = [
  {
    key: 'SAMEDAY',
    label: 'Same-day',
    blurb: 'Hours, not days — the arithmetic is close to a coin flip, so the tape does most of the voting.',
  },
  {
    key: 'WEEKLIES',
    label: 'Weeklies',
    blurb: 'Days, not weeks — theta is the landlord. Only tapes with flow behind them are worth renting.',
  },
  {
    key: 'SWINGS',
    label: 'Swings',
    blurb: '2–6 week holds — the balanced sleeve: math, flow and news all get a vote.',
  },
  {
    key: 'LEAPS',
    label: 'LEAPS',
    blurb: '12+ months out — buy volatility cheap and the story right; decay barely votes.',
  },
];

/** 100 shares per contract — turns a premium into a dollar outlay. */
export const CONTRACT_MULTIPLIER = 100;

// ---- Black-Scholes ------------------------------------------------------------

function normCdf(x: number): number {
  // Abramowitz–Stegun 7.1.26 via erf
  const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
  const erf =
    1 -
    (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-(x * x) / 2);
  return 0.5 * (1 + Math.sign(x) * erf);
}

interface BsOut {
  price: number;
  delta: number;
  /** Per-day theta, absolute dollars */
  thetaDay: number;
}

/** Effective years to expiry — floored at half a day so a 0DTE still carries a
    real move/price instead of collapsing to zero. Shared by pricing AND the
    expected-move line so the two can't disagree. */
function timeYears(dte: number): number {
  return Math.max(dte, 0.5) / 365;
}

function blackScholes(spot: number, strike: number, ivAnnual: number, dte: number, right: 'C' | 'P'): BsOut {
  const T = timeYears(dte);
  const r = 0.045;
  const sq = ivAnnual * Math.sqrt(T);
  const d1 = (Math.log(spot / strike) + (r + (ivAnnual * ivAnnual) / 2) * T) / sq;
  const d2 = d1 - sq;
  const pdf = Math.exp(-(d1 * d1) / 2) / Math.sqrt(2 * Math.PI);
  const disc = Math.exp(-r * T);

  if (right === 'C') {
    const price = spot * normCdf(d1) - strike * disc * normCdf(d2);
    const theta = (-(spot * pdf * ivAnnual) / (2 * Math.sqrt(T)) - r * strike * disc * normCdf(d2)) / 365;
    return { price: Math.max(price, 0.02), delta: normCdf(d1), thetaDay: theta };
  }
  const price = strike * disc * normCdf(-d2) - spot * normCdf(-d1);
  const theta = (-(spot * pdf * ivAnnual) / (2 * Math.sqrt(T)) + r * strike * disc * normCdf(-d2)) / 365;
  return { price: Math.max(price, 0.02), delta: normCdf(d1) - 1, thetaDay: theta };
}

// ---- candidate generation --------------------------------------------------------

const HORIZON_SHAPE: Record<Horizon, { dtes: number[]; otm: number[] }> = {
  // % OTM offsets per horizon — same-day hugs spot (there is no time for a big
  // move), weeklies sit close, LEAPS reach for cheap deltas
  SAMEDAY: { dtes: [0, 1], otm: [0, 0.003, 0.006, 0.011] },
  WEEKLIES: { dtes: [2, 5, 7], otm: [0, 0.01, 0.02, 0.035] },
  SWINGS: { dtes: [21, 30, 45], otm: [0, 0.02, 0.045, 0.07] },
  LEAPS: { dtes: [365, 480], otm: [0, 0.05, 0.1, 0.18] },
};

// Same-day deliberately leans on FLOW over arithmetic: inside a session the
// breakeven math is close to a coin flip, so who is actually pushing the tape
// decides more than the numbers do. Tuned against our own factor scales.
const WEIGHTS: Record<Horizon, Record<string, number>> = {
  SAMEDAY: { math: 0.12, decay: 0.2, vol: 0.06, flow: 0.38, news: 0.14, liq: 0.1 },
  WEEKLIES: { math: 0.24, decay: 0.26, vol: 0.08, flow: 0.22, news: 0.08, liq: 0.12 },
  SWINGS: { math: 0.22, decay: 0.14, vol: 0.14, flow: 0.2, news: 0.16, liq: 0.14 },
  LEAPS: { math: 0.18, decay: 0.04, vol: 0.28, flow: 0.12, news: 0.22, liq: 0.16 },
};

// expiryLabel() used to be Date.now() + dte*86400000 with no calendar at all,
// which listed contracts expiring on Saturdays. Every expiry now resolves
// through core/calendar.ts — see expiryFor().

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Which sleeve a raw DTE falls in — so a user-named contract is graded on the
    same weights the auto sleeve would use. */
export function horizonForDte(dte: number): Horizon {
  if (dte <= 1) return 'SAMEDAY';
  if (dte <= 10) return 'WEEKLIES';
  if (dte <= 120) return 'SWINGS';
  return 'LEAPS';
}

/** Everything read once per snapshot and shared by every candidate — the tape,
    the news lean, the IV regime, the strike grid. Built once by both callers. */
export interface ScoreCtx {
  ticker: string;
  spot: number;
  chain: StrikeNode[];
  dp: ReturnType<typeof buildDarkPoolView>;
  news: number;
  ivRank: number;
  baseIv: number;
  trendUp: boolean;
  rsi: number;
  /** Strike increment from the chain grid */
  step: number;
}

function buildScoreCtx(snapshot: MarketSnapshot): ScoreCtx {
  const { ticker, spot, chain, indicators } = snapshot;
  const day = dayKey();
  const dp = buildDarkPoolView(snapshot);
  const news = tickerSentiment(ticker);
  const ivRank = Math.round(hRange(`${ticker}-${day}-ivr`, 12, 92));
  const baseIv = Math.max(
    0.12,
    chain.length > 0 ? 0.18 + (indicators.squeeze ? -0.03 : 0.02) + hRange(`${ticker}-${day}-iv`, 0, 0.25) : 0.25
  );
  const trendUp = indicators.ema9 >= indicators.ema21;
  const rsi = indicators.rsi;
  const sorted = [...chain].sort((a, b) => a.strike - b.strike);
  const step = sorted.length > 1 ? Math.abs(sorted[1].strike - sorted[0].strike) : Math.max(spot * 0.005, 0.5);
  return { ticker, spot, chain, dp, news, ivRank, baseIv, trendUp, rsi, step };
}

/** Score ONE contract on the shared 6-factor scale. strike + dte + right are
    already chosen; horizon picks the weights. The batch weigher and the
    weigh-your-own path both call this — one number, no drift. */
export function scoreCandidate(
  ctx: ScoreCtx,
  right: 'C' | 'P',
  strike: number,
  requestedDte: number,
  horizon: Horizon
): WeighedContract {
  const { ticker, spot, chain, dp, news, ivRank, baseIv, trendUp, rsi } = ctx;
  const weights = WEIGHTS[horizon];

  // Resolve the requested horizon to a REAL expiry first, then price against
  // THAT. Asking for 7 days on a Friday used to price and label a Saturday
  // contract; it now prices the Friday weekly it actually resolves to, and
  // every downstream `dte` below is the resolved one.
  const expiry = expiryFor(requestedDte);
  const dte = expiry.dte;

  const node = chain.reduce(
    (best, n) => (Math.abs(n.strike - strike) < Math.abs(best.strike - strike) ? n : best),
    chain[0]
  );
  const moneyness = (strike - spot) / spot;

  // Skew: wings pay up
  const iv = baseIv * (1 + Math.abs(moneyness) * 1.6);
  const bs = blackScholes(spot, strike, iv, dte, right);
  const mid = Number(bs.price.toFixed(2));
  const thetaPerDayPct = (Math.abs(bs.thetaDay) / mid) * 100;
  // OI thins out the further the strike sits past the chain window
  const baseOi = node ? (right === 'C' ? node.callOI : node.putOI) : 500;
  const oiCount = Math.max(50, Math.round(baseOi * Math.exp((-Math.abs(strike - (node?.strike ?? strike)) / spot) * 24)));
  const spreadPct = clamp(6 - Math.log10(Math.max(oiCount, 10)) * 1.4, 0.4, 6) * (dte > 180 ? 1.5 : 1);

  const expectedMovePct = iv * Math.sqrt(timeYears(dte)) * 100;
  const beMove = right === 'C' ? (strike + mid) / spot - 1 : 1 - (strike - mid) / spot;
  const breakevenMovePct = beMove * 100;

  // ---- factor scores ------------------------------------------------------
  const coverage = expectedMovePct / Math.max(breakevenMovePct, 0.05);
  const mathScore = Math.round(clamp(coverage * 62, 4, 98));
  const mathDetail =
    coverage >= 1
      ? `1σ move (${expectedMovePct.toFixed(1)}%) clears the ${breakevenMovePct.toFixed(1)}% breakeven — the math works without a miracle.`
      : `Needs ${breakevenMovePct.toFixed(1)}% by expiry but 1σ is only ${expectedMovePct.toFixed(1)}% — you're paying for a tail.`;

  // Same-day needs a far higher ceiling: measured 0DTE candidates burn 50–200%
  // of premium per day, so grading them against the weeklies ceiling pinned every
  // one of them at the clamp floor — an inert factor that told the reader nothing.
  // 250 spreads the observed range across a usable 20–80 band.
  const decayCeiling = horizon === 'SAMEDAY' ? 250 : horizon === 'WEEKLIES' ? 9 : horizon === 'SWINGS' ? 3.5 : 0.8;
  const decayScore = Math.round(clamp(100 - (thetaPerDayPct / decayCeiling) * 100, 2, 98));
  // Inside a session, "per day" is the wrong unit — the contract dies today.
  const thetaPerHourPct = thetaPerDayPct / 6.5;
  const decayDetail =
    horizon === 'SAMEDAY'
      ? `Theta is about ${thetaPerHourPct.toFixed(1)}% of the premium every hour — ${
          dte === 0 ? 'this one settles at zero if it has not worked by the close' : 'it has one session and an overnight left'
        }.`
      : decayScore >= 55
        ? `Theta ${thetaPerDayPct.toFixed(1)}%/day is carryable for the holding window.`
        : `Theta ${thetaPerDayPct.toFixed(1)}%/day — the clock beats you unless the move comes fast.`;

  const volScore = Math.round(clamp(100 - ivRank + (horizon === 'LEAPS' ? 0 : 18), 4, 96));
  const volDetail =
    ivRank >= 65
      ? `IV rank ${ivRank} — premium is expensive; vol crush works against longs.`
      : `IV rank ${ivRank} — you're not overpaying for volatility here.`;

  const dirSign = right === 'C' ? 1 : -1;
  const flowAlign = dp.netPosturePct * dirSign;
  const tapeAlign = (trendUp ? 1 : -1) * dirSign;
  const flowScore = Math.round(clamp(50 + flowAlign * 0.45 + tapeAlign * 12, 4, 96));
  const flowDetail =
    flowScore >= 60
      ? `Dark pool ${dp.posture.toLowerCase()} and the tape lean the same way as this contract.`
      : flowScore <= 40
        ? `Smart-money flow leans against ${right === 'C' ? 'calls' : 'puts'} here — you'd be fading the desks.`
        : 'Flow is mixed — no institutional wind either way.';

  const newsScore = Math.round(clamp(50 + news * 48 * dirSign, 4, 96));
  const newsDetail =
    Math.abs(news) < 0.12
      ? 'Quiet tape on the name — news is a non-factor.'
      : newsScore >= 55
        ? 'The headline tape supports the direction.'
        : 'Headline risk points the other way.';

  const liqScore = Math.round(clamp(100 - spreadPct * 13 + Math.log10(Math.max(oiCount, 10)) * 6, 4, 98));
  const liqDetail =
    liqScore >= 55
      ? `${spreadPct.toFixed(1)}% spread on ${oiCount.toLocaleString()} OI — in and out without paying a toll.`
      : `${spreadPct.toFixed(1)}% spread — the market maker wins twice on this one.`;

  // RSI sanity nudges the math sleeve at extremes (chasing into 80 RSI weeklies etc.)
  const rsiPenalty = (right === 'C' && rsi > 74) || (right === 'P' && rsi < 26) ? 8 : 0;

  const factors: FactorScore[] = [
    { key: 'math', label: 'The math', score: Math.max(2, mathScore - rsiPenalty), weight: weights.math, detail: mathDetail },
    { key: 'decay', label: 'Theta burden', score: decayScore, weight: weights.decay, detail: decayDetail },
    { key: 'vol', label: 'Vol pricing', score: volScore, weight: weights.vol, detail: volDetail },
    { key: 'flow', label: 'Flow & dark pool', score: flowScore, weight: weights.flow, detail: flowDetail },
    { key: 'news', label: 'News lean', score: newsScore, weight: weights.news, detail: newsDetail },
    { key: 'liq', label: 'Liquidity', score: liqScore, weight: weights.liq, detail: liqDetail },
  ];

  const composite = Math.round(factors.reduce((a, f) => a + f.score * f.weight, 0));
  const verdict: ContractVerdict = composite >= 70 ? 'BUY' : composite >= 52 ? 'WATCH' : 'FADE';
  const ranked = [...factors].sort((a, b) => b.score - a.score);

  return {
    id: `${ticker}-${right}-${strike}-${dte}`,
    ticker,
    right,
    strike,
    dte,
    expiryLabel: expiry.label,
    expiryWeekday: expiry.weekday,
    sessionsLeft: expiry.sessions,
    mid,
    delta: Number(bs.delta.toFixed(2)),
    ivPct: Number((iv * 100).toFixed(1)),
    ivRank,
    thetaPerDayPct: Number(thetaPerDayPct.toFixed(2)),
    spreadPct: Number(spreadPct.toFixed(1)),
    oi: oiCount,
    breakevenMovePct: Number(breakevenMovePct.toFixed(2)),
    expectedMovePct: Number(expectedMovePct.toFixed(2)),
    factors,
    composite,
    verdict,
    edge: ranked[0].detail,
    risk: ranked[ranked.length - 1].detail,
  };
}

/** Result of weighing a single user-named contract — the graded contract plus
    how far its strike was snapped onto the listed grid (for an honest note). */
export interface WeighYourOwn {
  contract: WeighedContract;
  requestedStrike: number;
  snappedStrike: number;
  snapped: boolean;
  horizon: Horizon;
}

/** Weigh any contract the user names — snaps the strike to the nearest LISTED
    strike and grades it on the sleeve its DTE falls in. Same scorer as the
    auto scale, so the two never disagree. */
export function weighContract(snapshot: MarketSnapshot, right: 'C' | 'P', strike: number, dte: number): WeighYourOwn {
  const ctx = buildScoreCtx(snapshot);
  const snappedStrike = ctx.chain.length
    ? ctx.chain.reduce((b, n) => (Math.abs(n.strike - strike) < Math.abs(b.strike - strike) ? n : b), ctx.chain[0]).strike
    : Math.round(strike / ctx.step) * ctx.step;
  const horizon = horizonForDte(dte);
  const contract = scoreCandidate(ctx, right, snappedStrike, dte, horizon);
  return { contract, requestedStrike: strike, snappedStrike, snapped: Math.abs(snappedStrike - strike) > 1e-6, horizon };
}

/** The strictly-stronger expression in the SAME direction, or null. Two gates:
    a real composite margin (+5) AND better 1σ-over-breakeven headroom — so it
    only ever redirects toward a genuinely better contract, never a lateral one. */
export function betterAlternative(contracts: WeighedContract[], target: WeighedContract): WeighedContract | null {
  const coverage = (c: WeighedContract) => c.expectedMovePct / Math.max(c.breakevenMovePct, 0.05);
  // Apply BOTH gates as a filter over the whole pool first, THEN take the best
  // survivor — checking only the argmax-composite contract would miss a
  // slightly-lower-composite one that clears both gates.
  const qualified = contracts.filter(
    c =>
      c.right === target.right &&
      c.id !== target.id &&
      c.composite - target.composite >= 5 &&
      coverage(c) > coverage(target)
  );
  if (qualified.length === 0) return null;
  return qualified.reduce((best, c) => (c.composite > best.composite ? c : best), qualified[0]);
}

export function weighContracts(snapshot: MarketSnapshot, horizon: Horizon): WeighedContract[] {
  const ctx = buildScoreCtx(snapshot);
  const shape = HORIZON_SHAPE[horizon];
  const out: WeighedContract[] = [];

  // Candidates stay on listed strikes (snapped to the grid step) even past the
  // chain window's edge — LEAPS reach further OTM than the chain holds.
  // On low-priced names the tight OTM offsets can round onto the SAME strike
  // (a 0.3% offset on a $40 stock is less than one increment), which used to
  // collapse the sleeve to a handful of duplicates — so each collision walks one
  // more step out in its own direction.
  const taken = new Set<string>();
  (['C', 'P'] as const).forEach(right => {
    shape.otm.forEach((otm, oi) => {
      const dte = shape.dtes[(oi + (right === 'P' ? 1 : 0)) % shape.dtes.length];
      const rawStrike = right === 'C' ? ctx.spot * (1 + otm) : ctx.spot * (1 - otm);
      let strike = Math.round(rawStrike / ctx.step) * ctx.step;
      const away = right === 'C' ? ctx.step : -ctx.step;
      let guard = 0;
      while (taken.has(`${right}|${dte}|${strike}`) && guard++ < 12) strike += away;
      taken.add(`${right}|${dte}|${strike}`);
      out.push(scoreCandidate(ctx, right, strike, dte, horizon));
    });
  });

  // Two offsets can land on the same listed contract — keep one of each
  const seen = new Set<string>();
  return out
    .filter(c => (seen.has(c.id) ? false : (seen.add(c.id), true)))
    .sort((a, b) => b.composite - a.composite);
}
