/*
==================================================
  SLAYER TERMINAL - THE DAY AHEAD (data/ahead.ts)

  The Map says where the hedging sits now. This
  file says what the rest of the day looks like
  from here, in three answers a day trader lives
  on, each derived from engines the desk already
  runs (nothing here reads a new feed):

    THE CORRIDOR    the range price is likely to
                    hold until the bell — the
                    expected move for the time
                    left, bent by the walls; the
                    flip splits it into a fast
                    side and a slow side

    WHERE IT CLOSES the odds for the 4:00 print,
                    strike by strike — a bell
                    curve on the expected move,
                    pulled toward the strikes that
                    absorb moves and pushed off
                    the ones that amplify them,
                    tightening as time runs out

    THE SCHEDULE    what dealers must trade in each
                    remaining half hour at today's
                    prices — the delta hedge that
                    unwinds as today's options lose
                    their delta, loudest into the
                    close — and what expires at 4:00

  EVERY FIGURE IS A MODEL WITH ITS ASSUMPTIONS
  STATED (the guide says them in plain words). The
  expected move is implied volatility scaled to
  the minutes left; the odds are that curve times
  a pull from the book; the schedule is the 0DTE
  delta exposure spread over the remaining blocks
  on the shape charm takes. Not a prediction of
  what price WILL do — the arithmetic of what the
  book makes likely.
==================================================
*/

import { impliedDaySigma } from './atr';
import { sessionBars } from './levelview';
import { buildExposureSurface, CALENDAR_DTES, type ExposureSurface } from './exposureSurface';
import { buildVannaCharm } from './vannacharm';
import type { SessionClock } from './moc';
import type { ExposureProfileData, IvShift, LevelShift } from '../types/gex';
import type { MarketSnapshot } from '../types/market';

export const OPEN_MIN = 9 * 60 + 30;
export const CLOSE_MIN = 16 * 60;
export const SESSION_MIN = CLOSE_MIN - OPEN_MIN; // 390

export const fmtStrike = (v: number) => (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2));
export const fmtPrice = (v: number) => v.toFixed(2);
export const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
/** "$48M" / "$1.2B" — the schedule's dollars */
export const fmtDollars = (v: number): string => {
  const a = Math.abs(v);
  if (a >= 1e9) return `$${(a / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `$${(a / 1e6).toFixed(0)}M`;
  if (a >= 1e3) return `$${(a / 1e3).toFixed(0)}K`;
  return `$${a.toFixed(0)}`;
};

// ---- the clock, as minutes -----------------------------------------------------

export interface AheadClock {
  /** New York minutes from midnight — null outside the session */
  nowMin: number | null;
  inSession: boolean;
  /** Trading minutes still to run: the rest of today, or a whole day when the market is shut */
  minutesLeft: number;
  label: string;
}

export function aheadClock(clock: SessionClock): AheadClock {
  const [h, m] = clock.etTime.split(':').map(Number);
  const mins = h * 60 + m;
  const inSession = clock.phase === 'OPEN' || clock.phase === 'AUCTION';
  return {
    nowMin: inSession ? mins : null,
    inSession,
    minutesLeft: inSession ? Math.max(1, CLOSE_MIN - mins) : SESSION_MIN,
    label: clock.label,
  };
}

// ---- the corridor --------------------------------------------------------------

export type EdgeWhy = 'the expected move' | 'the call wall' | 'the put wall';

export interface CorridorEdge {
  price: number;
  why: EdgeWhy;
}

export interface ConePoint {
  min: number;
  lo1: number;
  hi1: number;
  lo2: number;
  hi2: number;
  /** The middle of the likely band — where the strikes have pulled the range's centre to by then */
  mid: number;
}

export interface Corridor {
  spot: number;
  /** One standard deviation, in dollars, for the minutes left */
  sigma: number;
  /** One day's standard deviation in dollars — the ruler the cone is drawn in */
  sigmaDay: number;
  likely: { low: CorridorEdge; high: CorridorEdge };
  outer: { low: number; high: number };
  flip: number | null;
  /** Which side of the flip moves run on (dealers amplify there) */
  fastSide: 'above' | 'below' | null;
  /** The cone from now to the bell, one point per five minutes */
  cone: ConePoint[];
  /** Today's closes so far, placed on the session's minutes */
  path: { min: number; price: number }[];
  sentence: string;
}

/** A wall bends the corridor when it sits inside the expected move's reach, with a little give */
const WALL_REACH = 1.35;

/** How strongly the strikes pull the close right now, 0..1 — at the open the whole
    range is in play and they barely matter; in the last hour they are most of the story */
export const gravityFor = (minutesLeft: number) => 0.35 + 0.65 * (1 - minutesLeft / SESSION_MIN);

/* THE PULLED CENTRE. The odds curve's centre of mass at a moment: where the
   strikes, pulling and pushing on the bell curve, drag the middle of the
   range to. The corridor's band is the expected move's width set around THIS
   centre, so the corridor bends toward the same strike the odds peak on and
   the two bands are one model (Noah, 2026-09-06: the corridor centred on
   spot while the odds peaked on a wall read as two answers). */
function pulledCentre(profile: ExposureProfileData, spot: number, sigma: number, gravity: number): number {
  if (sigma <= 1e-6) return spot;
  const curve = oddsCurve(profile, spot, sigma, gravity, 12);
  let sum = 0;
  let mass = 0;
  for (const c of curve) {
    sum += c.strike * c.w;
    mass += c.w;
  }
  return mass > 0 ? sum / mass : spot;
}

export function buildCorridor(snapshot: MarketSnapshot, profile: ExposureProfileData, iv: number, clock: AheadClock): Corridor {
  const spot = snapshot.spot;
  const sigmaDay = impliedDaySigma(spot, iv) ?? spot * 0.01;
  const sigma = sigmaDay * Math.sqrt(clock.minutesLeft / SESSION_MIN);
  const { callWall, putWall, flip } = profile.levels;
  const gravityEnd = gravityFor(clock.minutesLeft);
  const start = clock.nowMin ?? OPEN_MIN;
  const span = Math.max(1, CLOSE_MIN - start);

  /* The band at the close: the expected move around the pulled centre, then
     a wall inside reach becomes the edge */
  const centreEnd = pulledCentre(profile, spot, sigma, gravityEnd);
  const highWall = callWall > spot && callWall - spot <= sigma * WALL_REACH;
  const lowWall = putWall < spot && spot - putWall <= sigma * WALL_REACH;
  const high: CorridorEdge = highWall ? { price: Math.min(callWall, Math.max(centreEnd + sigma, spot)), why: 'the call wall' } : { price: centreEnd + sigma, why: 'the expected move' };
  const low: CorridorEdge = lowWall ? { price: Math.max(putWall, Math.min(centreEnd - sigma, spot)), why: 'the put wall' } : { price: centreEnd - sigma, why: 'the expected move' };
  const outer = { low: spot - 2 * sigma, high: spot + 2 * sigma };

  /* The flip inside the corridor splits it: spot above the flip = dealers absorb
     (moves slow), so the fast side is below it; and the other way round */
  const flipInside = flip > outer.low && flip < outer.high ? flip : null;
  const fastSide: Corridor['fastSide'] = flipInside == null ? null : spot >= flipInside ? 'below' : 'above';

  /* The cone, five minutes at a time, from now (or the open) to the close:
     the expected move for the minutes elapsed, around the centre the strikes
     have pulled it to by then (their pull grows toward the close), clipped
     by the walls that bend the band */
  const cone: ConePoint[] = [];
  const at = (t: number): ConePoint => {
    const s = sigmaDay * Math.sqrt(Math.max(0, t - start) / SESSION_MIN);
    const g = gravityEnd * ((t - start) / span);
    const c = pulledCentre(profile, spot, s, g);
    const hi1 = highWall ? Math.min(c + s, callWall) : c + s;
    const lo1 = lowWall ? Math.max(c - s, putWall) : c - s;
    const lo = Math.min(lo1, hi1);
    const hi = Math.max(lo1, hi1);
    return { min: t, lo1: lo, hi1: hi, lo2: spot - 2 * s, hi2: spot + 2 * s, mid: Math.min(hi, Math.max(lo, c)) };
  };
  for (let t = start; t <= CLOSE_MIN; t += 5) cone.push(at(t));
  if (cone[cone.length - 1]?.min !== CLOSE_MIN) cone.push(at(CLOSE_MIN));

  /* Today's path so far: the session's one-minute closes, the newest at now.
     Outside the session the whole last session is laid over the day. */
  const all = sessionBars(snapshot.ticker) ?? [];
  const path: Corridor['path'] = [];
  if (all.length) {
    if (clock.nowMin == null) {
      /* Shut: the whole last session laid over the day */
      const step = all.length > 1 ? (CLOSE_MIN - OPEN_MIN) / (all.length - 1) : 1;
      for (let i = 0; i < all.length; i++) path.push({ min: OPEN_MIN + i * step, price: all[i].close });
    } else {
      /* Open: only the minutes that have happened — the simulator's session
         holds a whole day of bars whatever the wall clock says, so the tail
         that fits between the open and now is the path, ending AT now */
      const keep = Math.min(all.length, clock.nowMin - OPEN_MIN + 1);
      const bars = all.slice(all.length - keep);
      const first = clock.nowMin - (keep - 1);
      for (let i = 0; i < bars.length; i++) path.push({ min: first + i, price: bars[i].close });
    }
  }

  const splitWords =
    flipInside == null
      ? ''
      : fastSide === 'below'
        ? ` Below ${fmtStrike(flipInside)} moves run; above it they slow.`
        : ` Above ${fmtStrike(flipInside)} moves run; below it they slow.`;
  const lid = high.why === 'the call wall' ? ` The call wall at ${fmtStrike(callWall)} is the lid.` : '';
  const floor = low.why === 'the put wall' ? ` The put wall at ${fmtStrike(putWall)} is the floor.` : '';
  const sentence = `${clock.inSession ? 'Likely to hold' : 'When it opens, likely to hold'} between ${fmtPrice(low.price)} and ${fmtPrice(high.price)}.${lid}${floor}${splitWords}`;

  return { spot, sigma, sigmaDay, likely: { low, high }, outer, flip: flipInside, fastSide, cone, path, sentence };
}

// ---- where it closes -----------------------------------------------------------

export type CloseRole = 'call wall' | 'put wall' | 'supreme' | 'pin' | null;

export interface CloseOdd {
  strike: number;
  /** Percent, rounded to one decimal; the rows sum to ~100 */
  odds: number;
  /** The bell curve alone, before the book pulls on it — percent */
  plain: number;
  /** How the book changes this strike's odds: >1 pulls, <1 pushes */
  pull: number;
  role: CloseRole;
}

/** A run of neighbouring strikes around the likeliest, and the odds they hold between them */
export interface CloseBand {
  low: number;
  high: number;
  /** Percent of the odds inside it */
  mass: number;
  strikes: number;
}

export interface CloseOdds {
  rows: CloseOdd[];
  /** The three most likely, best first */
  top: CloseOdd[];
  /** The rows with a strike above spot come first; this is the index of the first row at or below spot */
  spotAfter: number;
  sigma: number;
  /** How strongly the book pulls right now, 0..1 — grows into the close */
  gravity: number;
  /** The tightest runs around the likeliest strike holding 50% of the odds, and 80% (2026-09-09) */
  half: CloseBand;
  most: CloseBand;
  /** The words under the drawing, one read per line (Noah, 2026-09-09: the one
      paragraph was "not intuitive at all in terms of readability") */
  reads: CloseReads | null;
  /** The same as one paragraph, for the guide */
  sentence: string;
}

export interface CloseReads {
  /** "345 at 17%, then 344 at 13% and 346 at 11%" */
  likely: string;
  /** "a 50% chance it closes between 343 and 346 · an 80% chance between 340 and 348" */
  bands: string;
  /** "the supreme at 345 draws the close toward it · the odds tighten as the close nears" */
  pull: string;
}

/** Grow a run of strikes outward from the likeliest, taking the heavier neighbour each step, until it holds `target` percent */
function bandOf(rows: CloseOdd[], top: CloseOdd | undefined, target: number): CloseBand {
  if (!top || !rows.length) return { low: 0, high: 0, mass: 0, strikes: 0 };
  const asc = [...rows].sort((a, b) => a.strike - b.strike);
  let lo = asc.findIndex(r => r.strike === top.strike);
  if (lo < 0) lo = 0;
  let hi = lo;
  let mass = asc[lo].odds;
  while (mass < target && (lo > 0 || hi < asc.length - 1)) {
    const below = lo > 0 ? asc[lo - 1].odds : -1;
    const above = hi < asc.length - 1 ? asc[hi + 1].odds : -1;
    if (above >= below) {
      hi++;
      mass += asc[hi].odds;
    } else {
      lo--;
      mass += asc[lo].odds;
    }
  }
  return { low: asc[lo].strike, high: asc[hi].strike, mass: Math.round(mass), strikes: hi - lo + 1 };
}

const pdf = (z: number) => Math.exp(-0.5 * z * z);

interface OddsPoint {
  strike: number;
  plain: number;
  w: number;
  pull: number;
  role: CloseRole;
}

/** The odds curve at one moment: a bell curve `sigma` wide on spot, each strike
    pulling (absorbs, the pin) or pushing (amplifies) on it with `gravity` */
function oddsCurve(profile: ExposureProfileData, spot: number, sigma: number, gravity: number, maxHalf: number): OddsPoint[] {
  const { callWall, putWall, supreme, pin } = profile.levels;
  const maxAbs = Math.max(1, profile.maxAbs.gex);
  const desc = [...profile.strikes].sort((a, b) => b.strike - a.strike);
  const spotIdx = Math.max(0, desc.findIndex(s => s.strike <= spot));
  /* Only the strikes the close can plausibly reach: the rarer band (two
     standard deviations) plus one, never fewer than four each side — a row
     of 0.0% strikes says nothing and buries the ones that matter */
  const step = desc.length > 1 ? Math.abs(desc[0].strike - desc[1].strike) || 1 : 1;
  const half = Math.max(4, Math.min(maxHalf, Math.ceil((2.2 * sigma) / step) + 1));
  const from = Math.max(0, spotIdx - half);
  const window = desc.slice(from, from + half * 2 + 1);
  return window.map(s => {
    const z = (s.strike - spot) / Math.max(sigma, 1e-6);
    const plain = pdf(z);
    const net = s.gex.net / maxAbs; // + amplifies (pushes the close off it), − absorbs (pulls it in)
    const absorb = Math.max(0, -net);
    const amplify = Math.max(0, net);
    const pinPull = s.pin ? 0.5 : 0;
    const pull = (1 + gravity * 1.6 * (absorb + pinPull)) * (1 - 0.6 * gravity * amplify);
    const role: CloseRole = s.strike === supreme ? 'supreme' : s.strike === callWall ? 'call wall' : s.strike === putWall ? 'put wall' : s.strike === pin ? 'pin' : null;
    return { strike: s.strike, plain, w: plain * pull, pull, role };
  });
}

export function buildCloseOdds(profile: ExposureProfileData, spot: number, sigma: number, clock: AheadClock, maxHalf = 12): CloseOdds {
  const gravity = gravityFor(clock.minutesLeft);
  const raw = oddsCurve(profile, spot, sigma, gravity, maxHalf);
  let plainSum = 0;
  let sum = 0;
  for (const r of raw) {
    plainSum += r.plain;
    sum += r.w;
  }
  const rows: CloseOdd[] = raw.map(r => ({
    strike: r.strike,
    odds: sum > 0 ? Math.round((1000 * r.w) / sum) / 10 : 0,
    plain: plainSum > 0 ? Math.round((1000 * r.plain) / plainSum) / 10 : 0,
    pull: r.pull,
    role: r.role,
  }));
  const top = [...rows].sort((a, b) => b.odds - a.odds).slice(0, 3);
  const spotAfter = rows.findIndex(r => r.strike <= spot);
  const lead = top[0];
  const half = bandOf(rows, lead, 50);
  const most = bandOf(rows, lead, 80);
  /* THE READS, one per line — the likeliest strikes, the two bands as odds,
     then who is pulling and what the clock does (2026-09-09: "half the time"
     and "four times in five" read as riddles — the bands are 50% and 80%) */
  let reads: CloseReads | null = null;
  if (lead) {
    const at = (r: CloseOdd) => `${fmtStrike(r.strike)} at ${r.odds.toFixed(0)}%`;
    const likely = `${at(lead)}${top[1] ? `, then ${at(top[1])}` : ''}${top[2] ? ` and ${at(top[2])}` : ''}`;
    const bands = `a 50% chance it closes between ${fmtStrike(half.low)} and ${fmtStrike(half.high)} · an 80% chance between ${fmtStrike(most.low)} and ${fmtStrike(most.high)}`;
    const who = lead.role
      ? `the ${lead.role} at ${fmtStrike(lead.strike)} draws the close toward it`
      : lead.pull > 1.02
        ? `the strikes around ${fmtStrike(lead.strike)} draw the close toward it`
        : `the expected move alone puts it at ${fmtStrike(lead.strike)} — no strike is pulling`;
    const when = clock.inSession ? 'the odds tighten as the close nears' : "a whole day's range is in play until the open";
    reads = { likely, bands, pull: `${who} · ${when}` };
  }
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const sentence = reads ? `Most likely ${reads.likely}. There is ${reads.bands.replace(' · ', ', and ')}. ${cap(reads.pull.replace(' · ', '; '))}.` : 'No strikes near enough to spot to say.';
  return { rows, top, spotAfter: spotAfter < 0 ? rows.length : spotAfter, sigma, gravity, half, most, reads, sentence };
}

// ---- the schedule ---------------------------------------------------------------

export interface ScheduleBlock {
  from: number;
  to: number;
  /** Signed dollars dealers must trade in this block — + buying, − selling; 0 when the block has passed */
  flow: number;
  past: boolean;
  current: boolean;
  /** The clock's phase name for the block, for the words */
  phase: string;
}

/** A vol move as a scenario: points of implied vol, or 0 for none */
export type VolPoints = IvShift | 0;
export const VOL_OPTIONS: { value: VolPoints; label: string; hint: string }[] = [
  { value: -2, label: 'Drops two points', hint: 'A hard vol crush into the close' },
  { value: -1, label: 'Drops a point', hint: 'The usual crush as the day ends' },
  { value: 0, label: 'Stays put', hint: 'No vol move — the clock alone' },
  { value: 1, label: 'Rises a point', hint: 'A wobble that lifts vol' },
  { value: 2, label: 'Rises two points', hint: 'A shock that lifts vol hard' },
];

/** What a vol move forces — VANNA spoken (2026-09-09) */
export interface VolMove {
  points: VolPoints;
  /** Signed dollars of stock dealers must trade on the move: positive = buying */
  flow: number;
  /** Where the levels go under it */
  shifts: LevelShift[];
  sentence: string;
}

export interface Schedule {
  blocks: ScheduleBlock[];
  /** Signed dollars still to trade before the bell — CHARM's story, the delta the clock takes */
  toClose: number;
  biggest: ScheduleBlock | null;
  /** Percent of the calendar's hedging that expires at 4:00 */
  bellShare: number | null;
  /** The vol scenario in hand — null when it stays put */
  vol: VolMove | null;
  sentence: string;
}

/** The calendar's net vanna, every expiry and strike — dollars of dealer delta per point of vol */
export function wholeBookVanna(surface: ExposureSurface): number {
  let v = 0;
  for (let e = 0; e < surface.expiries.length; e++) for (let s = 0; s < surface.strikes.length; s++) v += surface.net.vanna[e]?.[s] ?? 0;
  return v;
}

export const volWords = (p: VolPoints) => (p === -2 ? 'drops two points' : p === -1 ? 'drops a point' : p === 1 ? 'rises a point' : p === 2 ? 'rises two points' : 'stays put');

const BLOCK = 30;
const phaseName = (min: number) =>
  min < 10 * 60 ? 'the open' : min < 11 * 60 + 30 ? 'the morning' : min < 14 * 60 ? 'lunch' : min < 15 * 60 + 30 ? 'the charm window' : min < 15 * 60 + 50 ? 'the turn' : 'the close';

export function buildSchedule(snapshot: MarketSnapshot, profile: ExposureProfileData, clock: AheadClock, volPoints: VolPoints = -1): Schedule {
  /* THE HEDGE THAT MUST COME OFF: today's options carry a delta the dealers
     hedge in stock; by 4:00 that delta is gone (out-of-the-money to nothing,
     in-the-money to a share), and the hedge against it is closed. The net
     delta exposure of the day's book is the size of that trade; its sign is
     the direction — dealers long delta through options hold short stock, so
     they BUY it back as the delta bleeds. */
  const toClose = profile.netDex;
  const start = clock.nowMin ?? OPEN_MIN;
  const blocks: ScheduleBlock[] = [];
  const weights: number[] = [];
  for (let t = OPEN_MIN; t < CLOSE_MIN; t += BLOCK) {
    const to = Math.min(CLOSE_MIN, t + BLOCK);
    const past = clock.inSession && to <= start;
    const current = clock.inSession && t <= start && start < to;
    /* Charm's shape: the delta bleeds faster the closer the bell is —
       ∝ 1/√(time left) at the block's middle, the last block the loudest */
    const mid = (Math.max(t, start) + to) / 2;
    const left = Math.max(5, CLOSE_MIN - mid) / 60;
    const w = past ? 0 : (to - Math.max(t, start)) * (1 / Math.sqrt(left + 0.25));
    weights.push(w);
    blocks.push({ from: t, to, flow: 0, past, current, phase: phaseName(t) });
  }
  const wSum = weights.reduce((a, b) => a + b, 0) || 1;
  blocks.forEach((b, i) => {
    b.flow = weights[i] > 0 ? (toClose * weights[i]) / wSum : 0;
  });
  const remaining = blocks.filter(b => !b.past);
  const biggest = remaining.length ? remaining.reduce((a, b) => (Math.abs(b.flow) > Math.abs(a.flow) ? b : a)) : null;

  let bellShare: number | null = null;
  let surface: ExposureSurface | null = null;
  try {
    surface = buildExposureSurface(snapshot, 20, CALENDAR_DTES);
    const today = surface.expiries.findIndex(e => e.dte === 0);
    if (today >= 0) {
      let dies = 0;
      let total = 0;
      for (let e = 0; e < surface.expiries.length; e++)
        for (let s = 0; s < surface.strikes.length; s++) {
          const v = Math.abs(surface.net.gex[e][s] ?? 0);
          total += v;
          if (e === today) dies += v;
        }
      bellShare = total > 0 ? Math.round((100 * dies) / total) : null;
    }
  } catch {
    /* no surface yet */
  }

  /* THE VOL MOVE — VANNA: net vanna is dollars of dealer delta per point of
     vol, so a move of p points changes their delta by vanna·p and they trade
     the opposite in stock to stay flat; a one-point DROP with positive vanna
     is dealer buying. Read across EVERY expiry on the calendar — today's
     contracts carry almost no vanna, the further dates carry it, and a vol
     crush re-prices all of them at once. The levels' shifts are the
     migration model's (data/vannacharm.ts). */
  let vol: VolMove | null = null;
  if (volPoints !== 0) {
    const netVanna = surface ? wholeBookVanna(surface) : profile.strikes.reduce((a, s) => a + (s.vanna?.net ?? 0), 0);
    const flow = -netVanna * volPoints;
    let shifts: LevelShift[] = [];
    try {
      shifts = buildVannaCharm(snapshot, 'VANNA', volPoints).shifts.filter(s => Math.abs(s.projected - s.current) > 1e-9);
    } catch {
      /* no chain yet */
    }
    const moves = shifts.map(s => `the ${s.label.toLowerCase().replace(/\s*node\b/, '')} moves ${fmtStrike(s.current)} → ${fmtStrike(s.projected)}`);
    const sentence = `If vol ${volWords(volPoints)}, dealers must ${flow >= 0 ? 'buy' : 'sell'} about ${fmtDollars(flow)} of stock to stay hedged${moves.length ? `, and ${moves.join(', ')}` : ', and the levels stay where they are'}.`;
    vol = { points: volPoints, flow, shifts, sentence };
  }

  /* WHY THEY TRADE AT ALL, in the sentence (Noah, 2026-09-06: "sell $35M in
     order to do what though?"): to stay neutral. The stock they hold against
     today's options is too much once those options lose their delta, so it
     has to go — forced, not a view, and it leans on price. */
  const verb = toClose >= 0 ? 'buy' : 'sell';
  const lean = toClose >= 0 ? 'A tailwind for any rally into the close.' : 'A headwind for any rally into the close.';
  const sentence = `${clock.inSession ? 'Into the close' : 'Over the next session'} dealers must ${verb} about ${fmtDollars(toClose)} of stock to stay hedged${biggest ? `, most of it ${hhmm(biggest.from)} to ${hhmm(biggest.to)}` : ''}. ${lean}${bellShare != null ? ` ${bellShare}% of the hedging expires at 4:00.` : ''}`;

  return { blocks, toClose, biggest, bellShare, vol, sentence };
}
