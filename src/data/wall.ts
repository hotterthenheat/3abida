/*
==================================================
  SLAYER TERMINAL - AT THE WALL (data/wall.ts)

  The sixth page of Pinpoint (2026-09-08). The Map
  names the walls. This answers the question a
  trader asks when price gets to one: DOES IT HOLD
  OR BREAK, and what happens either way.

  A wall is a tug-of-war. What pushes back is the
  dealer hedging sitting at the strike and its close
  neighbours — dollars of stock dealers must sell
  into a rise or buy into a drop per 1% move. What
  pushes in is the market: how many dollars it
  takes to move this name 1% today (today's dollar
  volume over today's travel), the speed price is
  running at against the pace its options priced,
  and the stock dealers must buy or sell because of
  today's option prints. Around that, what today
  has already shown — how the level behaved when
  touched, whether it is being built or drained —
  and the clock, since the part of a wall that
  expires at 4:00 stops counting at 4:00.

  THE ODDS ARE A MODEL WITH ITS INPUTS STATED, not
  a calibrated probability: each factor below is a
  measured fact and a push, the pushes add on a
  logistic scale, and the constants are the desk's
  own until real history calibrates them
  (data-providers-decision: ThetaData). The page
  says "model odds" on the surface. Separately, the
  odds price REACHES the wall by the close come
  from the expected move for the minutes left, the
  way a barrier is priced: twice the tail.

  If it breaks: the next shelf beyond it and the
  empty stretch between (the air-pocket engine),
  with the dollars of dealer flow forced along the
  path (the hedge-flow ladder). If it holds: where
  price is sent back toward, with the same flow
  arithmetic.
==================================================
*/

import Simulator from '../core/simulator';
import { impliedDaySigma } from './atr';
import { findAirPockets, SHELF_SHARE, type AirPocket } from './airPockets';
import { buildHedgeFlowLadder, type FlowLadder } from './hedgeFlow';
import { SESSION_MIN, fmtDollars, fmtStrike, wholeBookVanna, type AheadClock } from './ahead';
import type { Building } from './building';
import type { ExposureSurface } from './exposureSurface';
import type { ExposureProfileData, StrikeExposure } from '../types/gex';
import type { Candle, MarketSnapshot } from '../types/market';

/* ---- the constants, named so they can be calibrated ------------------------------ */

/** The ratio of a wall's hedging to the market's dollars-per-1% at which it is a coin flip */
export const PAR_RATIO = 1;
/** Logits per doubling of that ratio */
const A_WEIGHT = 1.0;
/** Logits for a perfect record of holds today (and against for breaks) */
const A_TESTS = 1.2;
/** Logits for a wall that grew by half its size today (and against for draining) */
const A_BUILD = 0.8;
/** Logits against, per unit of speed over the priced pace */
const A_SPEED = 0.8;
/** Logits against, for prints handing dealers a wall's worth of stock to push through it */
const A_PRINTS = 0.6;
/** Logits against, for a one-point vol drop forcing a wall's worth of dealer stock through it — VANNA (2026-09-09) */
const A_VOL = 0.6;
/** How much of a wall's expiring-today part still counts at the close */
const CHARM_FLOOR = 0.35;
/** The neighbours that count as part of a wall, as a share of spot */
const NEIGHBOUR_PCT = 0.0025;
/** Odds never print as certainties */
const ODDS_LO = 0.08;
const ODDS_HI = 0.92;

/* ---- types ------------------------------------------------------------------------ */

export type WallSide = 'call' | 'put';
export type WallRole = 'call wall' | 'put wall' | 'supreme' | 'flip' | null;

export interface WallFactor {
  key: 'weight' | 'tests' | 'build' | 'expiry' | 'speed' | 'prints' | 'vol';
  label: string;
  /** The measured fact, printed in mono */
  fact: string;
  /** −1..+1: positive pushes toward holding, negative toward breaking */
  push: number;
  /** One short clause */
  words: string;
}

export interface WallPath {
  /** The strike it heads to — null when nothing bounds it in the window */
  to: number | null;
  /** The empty stretch it crosses first, if any */
  pocket: AirPocket | null;
  /** Signed dollars of dealer stock flow forced along the way: positive = buying */
  flow: number;
  words: string;
}

export interface WallOdds {
  strike: number;
  side: WallSide;
  role: WallRole;
  /** The absorbing hedging at the wall, dollars per 1% move — negative when the strike pushes moves along instead */
  weight: number;
  /** The same after the expiring-today part is discounted for the clock */
  weightEff: number;
  /** Share of the wall that expires at 4:00 */
  expiresToday: number;
  touches: number;
  breaks: number;
  /** Today's change in the wall's size, dollars */
  build: number;
  /** Realized pace over the last half hour against the pace the options priced */
  speed: number;
  /** Dollars of stock today's prints hand dealers to trade TOWARD the wall (positive pushes through it) */
  prints: number;
  /** Distance from spot in expected-move units for the minutes left */
  distanceSigma: number;
  /** Odds price reaches it by the close, 0..1 */
  reach: number;
  /** Odds it holds when reached, 0..1 */
  hold: number;
  factors: WallFactor[];
  breakPath: WallPath;
  holdPath: WallPath;
  sentence: string;
}

export interface WallBoard {
  ticker: string;
  spot: number;
  /** Dollars of stock it took to move this name 1% today */
  marketPer1Pct: number;
  /** One expected move for the minutes left, dollars */
  sigmaLeft: number;
  minutesLeft: number;
  inSession: boolean;
  /** Every wall on the book, nearest first */
  walls: WallOdds[];
  /** The one in focus — the shared strike when set, else the nearest wall */
  focus: WallOdds;
  weakest: number | null;
  strongest: number | null;
  sentence: string;
}

/* ---- helpers --------------------------------------------------------------------- */

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));
/** Φ via the Abramowitz–Stegun approximation — good to 1e-7 */
const phi = (x: number) => {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804 * Math.exp((-x * x) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x >= 0 ? 1 - p : p;
};
const pct = (v: number) => `${Math.round(v * 100)}%`;
const signedDollars = (v: number) => `${v >= 0 ? '+' : '−'}${fmtDollars(v)}`;

/** Tests of a level as VISITS, not bars: a test begins when a bar's range
    first reaches the strike, and ends held when price leaves it back on its
    own side without a close beyond, or broke on the first close beyond it.
    (The report card's rule counts every touching bar; a strike inside an
    hour of chop would read "tested 35×", which is noise, not tests.) */
export function testEvents(bars: readonly Candle[], strike: number, side: WallSide): { tests: number; held: number; broke: number } {
  let held = 0;
  let broke = 0;
  let at = false;
  let beyond = false;
  for (const b of bars) {
    const touched = b.low <= strike && b.high >= strike;
    const closedBeyond = side === 'call' ? b.close > strike : b.close < strike;
    if (beyond) {
      if (!closedBeyond) beyond = false; // back on the original side: the next visit is new
      continue;
    }
    if (touched) {
      at = true;
      if (closedBeyond) {
        broke++;
        at = false;
        beyond = true;
      }
    } else if (at) {
      held++;
      at = false;
    }
  }
  if (at) held++; // still at the level as the tape ends — it has held so far
  return { tests: held + broke, held, broke };
}

/** Dollars of stock it took to move price 1% today — today's dollar volume over today's travel */
export function dollarsPer1Pct(bars: readonly Candle[]): number | null {
  if (bars.length < 5) return null;
  let dollars = 0;
  let travel = 0;
  for (let i = 1; i < bars.length; i++) {
    dollars += bars[i].volume * bars[i].close;
    travel += (Math.abs(bars[i].close - bars[i - 1].close) / bars[i - 1].close) * 100;
  }
  return travel > 0 ? dollars / travel : null;
}

/** Realized pace over the last `n` bars against the pace the options priced for the same span */
export function speedRatio(bars: readonly Candle[], iv: number, n = 30): number | null {
  if (bars.length < n + 1 || !(iv > 0)) return null;
  const tail = bars.slice(-n - 1);
  const rets = tail.slice(1).map((b, i) => Math.log(b.close / tail[i].close));
  const mean = rets.reduce((a, r) => a + r, 0) / rets.length;
  const varr = rets.reduce((a, r) => a + (r - mean) ** 2, 0) / Math.max(1, rets.length - 1);
  const realized = Math.sqrt(varr) * Math.sqrt(n);
  const implied = iv * Math.sqrt(n / (SESSION_MIN * 252));
  return implied > 0 ? realized / implied : null;
}

/** Dollars of stock today's option prints hand dealers to buy (positive) or sell — this name's prints only */
export function printsDemand(snapshot: MarketSnapshot, iv: number): number {
  let up = 0;
  for (const o of snapshot.tape) {
    if (o.ticker !== snapshot.ticker) continue;
    const strike = Number(o.strike);
    if (!(strike > 0)) continue;
    const g = Simulator.getGreeks(snapshot.spot, strike, 1 / 252, iv);
    const delta = o.type === 'C' ? g.deltaCall : g.deltaPut; // put delta is negative
    const shares = o.size * 100 * delta;
    /* A customer BUYING (at the ask) leaves the dealer short the option, so the
       dealer buys stock for a call's delta and sells for a put's; selling to the
       dealer (at the bid) is the mirror. Dollars, in the direction dealers trade. */
    const dealerBuys = o.side === 'ASK' ? shares : -shares;
    up += dealerBuys * snapshot.spot;
  }
  return up;
}

/* ---- the model ------------------------------------------------------------------- */

interface Ctx {
  spot: number;
  strikes: StrikeExposure[]; // descending
  heaviest: number;
  levels: ExposureProfileData['levels'];
  pockets: AirPocket[];
  ladder: FlowLadder;
  building: Building;
  surface: ExposureSurface | null;
  todayIdx: number;
  bars: Candle[];
  clock: AheadClock;
  marketPer1Pct: number;
  sigmaLeft: number;
  speed: number | null;
  printsUp: number;
  /** Dollars of stock dealers must BUY if vol drops a point — the window's net vanna */
  volDrop: number;
}

function roleOf(K: number, levels: ExposureProfileData['levels']): WallRole {
  if (K === levels.callWall) return 'call wall';
  if (K === levels.putWall) return 'put wall';
  if (K === levels.supreme) return 'supreme';
  return null;
}

function wallOdds(K: number, ctx: Ctx): WallOdds {
  const { spot, strikes, levels, clock } = ctx;
  const side: WallSide = K >= spot ? 'call' : 'put';
  const role = roleOf(K, levels);

  /* THE WEIGHT: the strike and its close neighbours, absorbing counted for, amplifying against */
  const absorbsSign = side === 'call' ? -1 : 1; // call-dominant above spot pushes back on a rise; put-dominant below on a drop
  let weight = 0;
  for (const s of strikes) {
    if (Math.abs(s.strike - K) > spot * NEIGHBOUR_PCT) continue;
    const near = s.strike === K ? 1 : 0.5;
    weight += Math.sign(s.gex.net) === absorbsSign ? Math.abs(s.gex.net) * near : -Math.abs(s.gex.net) * near;
  }

  /* THE CLOCK: the expiring-today part fades toward CHARM_FLOOR by the close, and is gone after it */
  let expiresToday = 0;
  if (ctx.surface && ctx.todayIdx >= 0) {
    const si = ctx.surface.strikes.indexOf(K);
    if (si >= 0) {
      let total = 0;
      for (let e = 0; e < ctx.surface.expiries.length; e++) total += Math.abs(ctx.surface.net.gex[e][si] ?? 0);
      const today = Math.abs(ctx.surface.net.gex[ctx.todayIdx][si] ?? 0);
      expiresToday = total > 0 ? clamp(today / total, 0, 1) : 0;
    }
  }
  const fade = clock.inSession ? CHARM_FLOOR + (1 - CHARM_FLOOR) * (clock.minutesLeft / SESSION_MIN) : 0;
  const weightEff = weight * (1 - expiresToday * (1 - fade));

  /* THE TESTS today — visits, held or broke */
  const { tests: touches, held, broke: breaks } = testEvents(ctx.bars, K, side);
  const testsScore = touches === 0 ? 0 : clamp((held - 2 * breaks) / (touches + 2), -1, 1);

  /* BEING BUILT OR DRAINED today */
  const brow = ctx.building.rows.find(r => r.strike === K);
  const build = brow?.sizeChange ?? 0;
  const buildScore = weight > 0 ? clamp(build / weight, -0.5, 0.5) * 2 : 0;

  /* THE SPEED and THE PRINTS */
  const speed = ctx.speed ?? 1;
  const speedExcess = clamp(speed - 1, -0.6, 1.5);
  const prints = side === 'call' ? ctx.printsUp : -ctx.printsUp;
  const printsScore = weightEff > 0 ? clamp(prints / weightEff, -1, 1) : 0;
  /* A VOL DROP — VANNA: the stock a one-point drop makes dealers trade, read
     toward the wall like the prints: buying leans through a call wall, selling
     through a put wall */
  const volToward = side === 'call' ? ctx.volDrop : -ctx.volDrop;
  const volScore = weightEff > 0 ? clamp(volToward / weightEff, -1, 1) : 0;

  /* THE ODDS */
  const ratio = weightEff > 0 ? weightEff / ctx.marketPer1Pct : 0;
  const zWeight = weightEff > 0 ? A_WEIGHT * (Math.log2(ratio) - Math.log2(PAR_RATIO)) : -4;
  const zTests = A_TESTS * testsScore;
  const zBuild = A_BUILD * buildScore;
  const zSpeed = -A_SPEED * speedExcess;
  const zPrints = -A_PRINTS * printsScore;
  const zVol = -A_VOL * volScore;
  const hold = weight <= 0 ? ODDS_LO : clamp(sigmoid(zWeight + zTests + zBuild + zSpeed + zPrints + zVol), ODDS_LO, ODDS_HI);

  const distance = Math.abs(K - spot);
  const distanceSigma = ctx.sigmaLeft > 0 ? distance / ctx.sigmaLeft : 99;
  const reach = clamp(2 * (1 - phi(distanceSigma)), 0.02, 0.98);

  /* THE PATHS */
  const beyond = side === 'call' ? strikes.filter(s => s.strike > K).sort((a, b) => a.strike - b.strike) : strikes.filter(s => s.strike < K).sort((a, b) => b.strike - a.strike);
  const nextShelf = beyond.find(s => Math.abs(s.gex.net) >= SHELF_SHARE * ctx.heaviest && s.strike !== K) ?? null;
  const pocket = ctx.pockets.find(p => (side === 'call' ? p.floor === K : p.ceiling === K)) ?? null;
  const rungAt = (k: number | null) => (k == null ? null : (ctx.ladder.rungs.find(r => Math.abs(r.strike - k) < 1e-9) ?? null));
  const breakTo = nextShelf?.strike ?? (pocket ? (side === 'call' ? pocket.ceiling : pocket.floor) : null);
  const breakRung = rungAt(breakTo);
  const breakFlow = breakRung?.flow ?? 0;
  const breakPath: WallPath = {
    to: breakTo,
    pocket,
    flow: breakFlow,
    words:
      breakTo == null
        ? `a break ${side === 'call' ? 'above' : 'below'} ${fmtStrike(K)} has no shelf behind it on the strikes shown`
        : `a break ${side === 'call' ? 'above' : 'below'} ${fmtStrike(K)} runs to ${fmtStrike(breakTo)}${pocket ? ' with almost nothing in between' : ''}${breakFlow !== 0 ? `, ${fmtDollars(breakFlow)} of forced dealer ${breakFlow > 0 ? 'buying' : 'selling'} on the way` : ''}`,
  };
  const flipOnSpotSide = side === 'call' ? levels.flip < K : levels.flip > K;
  const holdTo = flipOnSpotSide && Math.abs(levels.flip - spot) > 1e-9 ? levels.flip : side === 'call' ? levels.putWall : levels.callWall;
  const holdRung = rungAt(holdTo);
  const holdFlow = holdRung?.flow ?? 0;
  const holdPath: WallPath = {
    to: holdTo,
    pocket: null,
    flow: holdFlow,
    words: `a hold sends price back toward ${fmtStrike(holdTo)}${holdFlow !== 0 ? `, ${fmtDollars(holdFlow)} of forced dealer ${holdFlow > 0 ? 'buying' : 'selling'} on the way` : ''}`,
  };

  /* THE FACTORS, each a fact and a push */
  const factors: WallFactor[] = [
    {
      key: 'weight',
      label: 'What it is made of',
      fact: weight > 0 ? `${fmtDollars(weightEff)} per 1% · ${ratio.toFixed(1)}× the market` : `${fmtDollars(Math.abs(weight))} the wrong way`,
      push: weight > 0 ? clamp(zWeight / 3, -1, 1) : -1,
      words:
        weight > 0
          ? ratio >= 2
            ? 'pushes back much harder than the market pushes'
            : ratio >= 1
              ? 'pushes back harder than the market pushes'
              : ratio >= 0.5
                ? 'pushes back, but the market pushes harder'
                : 'thin against what moves this name'
          : 'pushes moves along rather than back — a trapdoor, not a wall',
    },
    {
      key: 'tests',
      label: 'Tested today',
      fact: touches === 0 ? 'not yet' : `${touches}× · held ${held} · broke ${breaks}`,
      push: clamp(zTests / A_TESTS, -1, 1),
      words: touches === 0 ? 'price has not reached it today' : breaks === 0 ? `every touch held` : `broke ${breaks} time${breaks === 1 ? '' : 's'} on ${touches} touch${touches === 1 ? '' : 'es'}`,
    },
    {
      key: 'build',
      label: clock.inSession ? 'Built or drained today' : 'Built or drained last session',
      fact: `${signedDollars(build)}${weight > 0 ? ` · ${Math.round((build / weight) * 100)}% of it` : ''}`,
      push: clamp(zBuild / A_BUILD, -1, 1),
      words: build > 0 ? 'the wall is being added to' : build < 0 ? 'the wall is draining' : 'unchanged',
    },
    {
      key: 'expiry',
      label: clock.inSession ? 'Expires at 4:00 · charm' : 'Expired at 4:00 · charm',
      fact: `${pct(expiresToday)} of it${clock.inSession ? ` · ${Math.floor(clock.minutesLeft / 60)}h ${String(clock.minutesLeft % 60).padStart(2, '0')}m left` : ''}`,
      push: -clamp(expiresToday * (1 - fade) * 2, 0, 1),
      words: clock.inSession
        ? expiresToday > 0.5
          ? 'most of this wall is gone at the close'
          : expiresToday > 0.2
            ? 'a real share of it thins into the close'
            : 'nearly all of it stays past today'
        : expiresToday > 0.5
          ? 'most of this wall left at the close'
          : expiresToday > 0.2
            ? 'a real share of it left at the close'
            : 'nearly all of it is still there',
    },
    {
      key: 'speed',
      label: 'The market’s speed',
      fact: ctx.speed == null ? '—' : `${speed.toFixed(2)}× the pace priced`,
      push: clamp(zSpeed / A_SPEED, -1, 1),
      words: speed > 1.3 ? 'running faster than its options priced — walls break more' : speed < 0.7 ? 'a quiet market — walls hold more' : 'about the pace the options priced',
    },
    {
      key: 'prints',
      label: 'Today’s prints',
      fact: `${fmtDollars(prints)} of forced dealer ${prints >= 0 ? (side === 'call' ? 'buying' : 'selling') : side === 'call' ? 'selling' : 'buying'}`,
      push: clamp(zPrints / A_PRINTS, -1, 1),
      words: prints > 0 ? 'today’s prints lean through this wall' : prints < 0 ? 'today’s prints lean away from it' : 'no lean from today’s prints',
    },
    {
      key: 'vol',
      label: 'A one-point vol drop · vanna',
      fact: `${fmtDollars(ctx.volDrop)} of forced dealer ${ctx.volDrop >= 0 ? 'buying' : 'selling'}`,
      push: clamp(zVol / A_VOL, -1, 1),
      words: volToward > 0 ? 'a vol drop leans through this wall' : volToward < 0 ? 'a vol drop leans away from it' : 'no lean from a vol drop',
    },
  ];

  const who = role ? `The ${role} at ${fmtStrike(K)}` : weight > 0 ? `The shelf at ${fmtStrike(K)}` : `${fmtStrike(K)}`;
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const sentence =
    weight > 0
      ? `${who} is reached by ${clock.inSession ? 'the close' : 'the next close'} ${pct(reach)} of the time and holds ${pct(hold)} of the time when it is. ${cap(breakPath.words)}. ${cap(holdPath.words)}.`
      : `${who} is not a wall: the hedging there pushes moves along rather than back. ${cap(breakPath.words)}.`;

  return { strike: K, side, role, weight, weightEff, expiresToday, touches, breaks, build, speed, prints, distanceSigma, reach, hold, factors, breakPath, holdPath, sentence };
}

/* ---- the board ------------------------------------------------------------------- */

/** Everything the odds need for one name, built once — the Targets page reads
    every strike through it, the wall board only the walls */
export type WallContext = Ctx;

export function buildWallContext(
  snapshot: MarketSnapshot,
  profile: ExposureProfileData,
  building: Building,
  surface: ExposureSurface | null,
  bars: readonly Candle[],
  clock: AheadClock,
  iv: number
): WallContext {
  const { spot } = snapshot;
  const strikes = profile.strikes; // descending
  const heaviest = Math.max(1, ...strikes.map(s => Math.abs(s.gex.net)));
  const todayBars = bars as Candle[];
  const marketPer1Pct = dollarsPer1Pct(todayBars) ?? 1;
  const sigmaDay = impliedDaySigma(spot, iv) ?? spot * 0.01;
  const sigmaLeft = sigmaDay * Math.sqrt(clock.minutesLeft / SESSION_MIN);
  return {
    spot,
    strikes,
    heaviest,
    levels: profile.levels,
    pockets: findAirPockets(strikes),
    ladder: buildHedgeFlowLadder(profile),
    building,
    surface,
    todayIdx: surface ? surface.expiries.findIndex(e => e.dte === 0) : -1,
    bars: todayBars,
    clock,
    marketPer1Pct,
    sigmaLeft,
    speed: speedRatio(todayBars, iv),
    printsUp: printsDemand(snapshot, iv),
    /* Across every expiry when the calendar is here — today's contracts carry
       almost no vanna; the further dates do, and a vol crush moves all of them */
    volDrop: surface ? wholeBookVanna(surface) : strikes.reduce((a, s) => a + (s.vanna?.net ?? 0), 0),
  };
}

/** The odds at one strike, walls and trapdoors alike */
export const oddsAt = (strike: number, ctx: WallContext): WallOdds => wallOdds(strike, ctx);

export function buildWallBoard(
  snapshot: MarketSnapshot,
  profile: ExposureProfileData,
  building: Building,
  surface: ExposureSurface | null,
  bars: readonly Candle[],
  clock: AheadClock,
  iv: number,
  focusStrike?: number | null
): WallBoard {
  const { ticker, spot } = snapshot;
  const strikes = profile.strikes; // descending
  const ctx = buildWallContext(snapshot, profile, building, surface, bars, clock, iv);
  const { heaviest, marketPer1Pct, sigmaLeft } = ctx;

  /* Every shelf on the book that PUSHES BACK (a shelf whose hedging pushes
     moves along is a trapdoor, not a wall — it never makes the list, though
     a strike the reader focuses is still read), plus the named levels,
     nearest first */
  const set = new Set<number>();
  for (const s of strikes) if (Math.abs(s.gex.net) >= SHELF_SHARE * heaviest) set.add(s.strike);
  for (const k of [profile.levels.callWall, profile.levels.putWall, profile.levels.supreme]) if (strikes.some(s => s.strike === k)) set.add(k);
  const walls = [...set]
    .filter(k => Math.abs(k - spot) > 1e-9)
    .map(k => wallOdds(k, ctx))
    .filter(w => w.weight > 0)
    .sort((a, b) => Math.abs(a.strike - spot) - Math.abs(b.strike - spot));

  const focusK = focusStrike != null && strikes.some(s => s.strike === focusStrike) ? focusStrike : null;
  const focus = focusK != null ? (walls.find(w => w.strike === focusK) ?? wallOdds(focusK, ctx)) : (walls[0] ?? wallOdds(profile.levels.callWall, ctx));

  const reachable = walls.filter(w => w.reach >= 0.15 && w.weight > 0);
  const weakest = reachable.length ? reachable.reduce((a, b) => (b.hold < a.hold ? b : a)).strike : null;
  const strongest = reachable.length ? reachable.reduce((a, b) => (b.hold > a.hold ? b : a)).strike : null;
  const w = walls.find(x => x.strike === weakest);
  const s = walls.find(x => x.strike === strongest);
  const sentence =
    w && s && w.strike !== s.strike
      ? `The weakest wall in reach is ${fmtStrike(w.strike)}${w.role ? `, the ${w.role}` : ''}, holding ${pct(w.hold)} of the time; the strongest is ${fmtStrike(s.strike)}${s.role ? `, the ${s.role}` : ''} at ${pct(s.hold)}.`
      : walls.length
        ? `${walls.length} wall${walls.length === 1 ? '' : 's'} on the strikes shown, the nearest at ${fmtStrike(walls[0].strike)}.`
        : 'No wall on the strikes shown.';

  return { ticker, spot, marketPer1Pct, sigmaLeft, minutesLeft: clock.minutesLeft, inSession: clock.inSession, walls, focus, weakest, strongest, sentence };
}

