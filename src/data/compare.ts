/*
==================================================
  SLAYER TERMINAL - COMPARE (data/compare.ts)

  Two names, the same reads, side by side (Noah,
  2026-09-08: "a compare page of 2 different
  stocks/tickers in multiple ways you see fit").
  Nothing here is a new model: for each name it is
  the Board's row — the flip gauge, the day's book,
  the bell's share, the agenda's first strike — plus
  Ahead's expected move and where the close lands,
  and the book's strikes with their distance from
  spot, so two books can sit on ONE ruler.

  THE RULER is the desk's (DistanceUnitPicker): a
  strike is placed by how far it is from its own
  name's spot — percent, ATR or expected-move
  units. Dollars do not compare across names, so
  the '$' choice reads as percent here and the head
  says so.
==================================================
*/

import Simulator from '../core/simulator';
import { SESSION_MIN, buildCloseOdds, type AheadClock } from './ahead';
import { sessionStarts } from './indicators';
import { impliedDaySigma, sessionAtr, type DistanceScales, type DistanceUnit } from './atr';
import { bellShareOf, watchOf, type BoardRow } from './board';
import { buildExposureProfile } from './exposure';
import { buildExposureSurface, CALENDAR_DTES, GREEKS, type ExposureSurface, type Greek } from './exposureSurface';
import { buildFlipGauge, type GammaRegime } from './flipGauge';
import { spotChangePct } from './gex';
import { sessionBars } from './levelview';
import type { ExposureExpiry, ExposureLevels } from '../types/gex';
import type { Candle, GexLevel, MarketSnapshot } from '../types/market';

/** Thirty strikes each side: the whole book */
const WINDOW = 30;

export type { Greek };

/* THE GREEK (Noah, 2026-09-09: "shouldn't we be able to compare the different
   gex, vex and dex of each ticker?… when I switch the map from gex to dex the
   supreme node changes"): the ruler, the reach sums and the Supreme row follow
   one Greek card; the walls stay gamma's, because a wall is a gamma idea. Each
   greek has its own two words for a strike's sign — gamma speaks push, delta
   speaks lean, vega speaks volatility — the ledger's own reading. */
export const GREEK_OPTIONS: { value: Greek; label: string; hint: string }[] = [
  { value: 'gex', label: 'GEX', hint: 'Gamma — how hard dealers must hedge a move' },
  { value: 'dex', label: 'DEX', hint: 'Delta — which way dealers are leaning' },
  { value: 'vex', label: 'VEX', hint: 'Vega — how a change in volatility moves them' },
  { value: 'vanna', label: 'VANNA', hint: 'How their hedges re-price when vol moves — the stock a vol drop makes them buy or sell' },
  { value: 'charm', label: 'CHARM', hint: "The clock's pull on their hedges — the stock the passing day makes them buy or sell" },
];
export interface GreekWords {
  pos: string;
  neg: string;
  /** The same, said of two names at once */
  posBoth: string;
  negBoth: string;
  posWhy: string;
  negWhy: string;
}
export const GREEK_WORDS: Record<Greek, GreekWords> = {
  gex: { pos: 'pushes along', neg: 'pushes back', posBoth: 'both push along', negBoth: 'both push back', posWhy: 'dealers chase a move there', negWhy: 'dealers lean against a move there' },
  dex: { pos: 'leans up', neg: 'leans down', posBoth: 'both lean up', negBoth: 'both lean down', posWhy: 'their hedging leans with a rise there', negWhy: 'their hedging leans with a fall there' },
  vex: { pos: 'gains if vol rises', neg: 'gains if vol falls', posBoth: 'both gain if vol rises', negBoth: 'both gain if vol falls', posWhy: 'dealers are long volatility there', negWhy: 'dealers are short volatility there' },
  vanna: { pos: 'buys on a vol drop', neg: 'sells on a vol drop', posBoth: 'both buy on a vol drop', negBoth: 'both sell on a vol drop', posWhy: 'a one-point vol drop makes dealers buy stock there', negWhy: 'a one-point vol drop makes dealers sell stock there' },
  charm: { pos: 'sells as the clock runs', neg: 'buys as the clock runs', posBoth: 'both sell as the clock runs', negBoth: 'both buy as the clock runs', posWhy: 'each passing day makes dealers sell stock there', negWhy: 'each passing day makes dealers buy stock there' },
};
export const GREEK_LABEL: Record<Greek, string> = { gex: 'GEX', dex: 'DEX', vex: 'VEX', vanna: 'VANNA', charm: 'CHARM' };

export interface CompareLevel {
  strike: number;
  /** Signed percent of spot */
  distPct: number;
  /** |net| parked there — gamma's for the walls, the chosen greek's for its supreme */
  weight: number;
}

export interface CompareSide {
  ticker: string;
  spot: number;
  changePct: number;
  regime: GammaRegime | null;
  flip: number | null;
  /** Signed percent, flip − spot */
  flipDistPct: number | null;
  /** One expected move for the minutes left, dollars — and as percent of spot */
  sigmaLeft: number;
  sigmaLeftPct: number;
  sigmaDay: number;
  scales: DistanceScales;
  levels: ExposureLevels;
  /** Every strike in the window, ascending, the day's net parked there — one list per greek */
  rows: Record<Greek, GexLevel[]>;
  heaviest: Record<Greek, number>;
  /** The walls are gamma's — a wall is a gamma idea */
  callWall: CompareLevel;
  putWall: CompareLevel;
  /** The heaviest strike, per greek — the one the Map's supreme follows when the greek changes */
  supreme: Record<Greek, CompareLevel>;
  /** The window's net: positive amplifies, negative absorbs */
  netGex: number;
  /** Share of the hedging that expires at the bell, percent */
  bellShare: number | null;
  watch: BoardRow['watch'];
  /** The most likely close, and its odds in percent */
  closes: { strike: number; odds: number } | null;
}

export interface Compare {
  a: CompareSide;
  b: CompareSide;
  inSession: boolean;
  /** Whose expected move is wider, and by how much */
  wider: { ticker: string; ratio: number };
  sentence: string;
}

const fmtStrike = (v: number) => (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2));

/** The name a comparison opens against: the index twin when there is one, else the next name on the list */
export function partnerFor(ticker: string): string {
  const twins: Record<string, string> = { SPY: 'QQQ', QQQ: 'SPY', IWM: 'SPY', DIA: 'SPY' };
  if (twins[ticker] && Simulator.TICKERS[twins[ticker]]) return twins[ticker];
  const list = Simulator.WATCHLIST.length ? Simulator.WATCHLIST : Object.keys(Simulator.TICKERS);
  return list.find(t => t !== ticker) ?? ticker;
}

/** A strike's distance from spot in the ruler's unit — null when the ruler has no scale yet */
export function distanceIn(delta: number, spot: number, unit: DistanceUnit, scales: DistanceScales): number | null {
  switch (unit) {
    case '$':
      return delta;
    case '%':
      return spot > 0 ? (delta / spot) * 100 : null;
    case 'ATR':
      return scales.atr !== null && scales.atr > 0 ? delta / scales.atr : null;
    default:
      return scales.sigma !== null && scales.sigma > 0 ? delta / scales.sigma : null;
  }
}

/** The ruler two names share: dollars do not compare across names, so '$' reads as percent */
export const sharedUnit = (unit: DistanceUnit): Exclude<DistanceUnit, '$'> => (unit === '$' ? '%' : unit);

/** "+0.59%" · "+0.42 ATR" · "+1.10σ" — a distance on the shared ruler */
export function fmtShared(v: number, unit: Exclude<DistanceUnit, '$'>): string {
  const sign = v < 0 ? '−' : '+';
  const a = Math.abs(v);
  if (unit === '%') return `${sign}${a.toFixed(2)}%`;
  if (unit === 'ATR') return `${sign}${a.toFixed(2)} ATR`;
  return `${sign}${a.toFixed(2)}σ`;
}

/** One book, on the contracts the reader picked — today's by default (Noah, 2026-09-10: the ruler's head gained an Expiry card like the Map's) */
export function buildCompareSide(snapshot: MarketSnapshot, clock: AheadClock, expiry: ExposureExpiry = '0DTE'): CompareSide | null {
  if (!snapshot.chain || snapshot.chain.length === 0) return null;
  const { ticker, spot } = snapshot;
  let profile;
  try {
    profile = buildExposureProfile(snapshot, expiry, WINDOW);
  } catch {
    return null;
  }
  const gauge = buildFlipGauge(snapshot);
  const iv = Simulator.TICKERS[ticker]?.iv ?? 0.2;
  const sigmaDay = impliedDaySigma(spot, iv) ?? spot * 0.01;
  const sigmaLeft = sigmaDay * Math.sqrt(clock.minutesLeft / SESSION_MIN);
  const scales: DistanceScales = { atr: sessionAtr(Simulator.getCandles(ticker) ?? []), sigma: sigmaDay };

  const rows: Record<Greek, GexLevel[]> = { gex: [], dex: [], vex: [], vanna: [], charm: [] };
  const heaviest: Record<Greek, number> = { gex: 1, dex: 1, vex: 1, vanna: 1, charm: 1 };
  const none = (): CompareLevel => ({ strike: spot, distPct: 0, weight: 0 });
  const supreme: Record<Greek, CompareLevel> = { gex: none(), dex: none(), vex: none(), vanna: none(), charm: none() };
  for (const s of [...profile.strikes].reverse()) {
    for (const g of GREEKS) {
      const value = s[g].net;
      rows[g].push({ strike: s.strike, value });
      heaviest[g] = Math.max(heaviest[g], Math.abs(value));
      if (Math.abs(value) > supreme[g].weight) supreme[g] = { strike: s.strike, distPct: ((s.strike - spot) / spot) * 100, weight: Math.abs(value) };
    }
  }
  /* The walls, weighed in gamma */
  const at = (k: number): CompareLevel => ({
    strike: k,
    distPct: ((k - spot) / spot) * 100,
    weight: Math.abs(rows.gex.find(r => Math.abs(r.strike - k) < 1e-9)?.value ?? 0),
  });

  let surface: ExposureSurface | null = null;
  let bellShare: number | null = null;
  try {
    surface = buildExposureSurface(snapshot, 20, CALENDAR_DTES);
    bellShare = bellShareOf(surface);
  } catch {
    /* no surface for this name yet */
  }
  const bars = sessionBars(ticker) ?? [];
  const watch = watchOf(snapshot, profile, surface, bars, clock);
  const close = buildCloseOdds(profile, spot, sigmaLeft, clock);
  const top = close.top[0];

  return {
    ticker,
    spot,
    changePct: spotChangePct(ticker),
    regime: gauge.regime,
    flip: gauge.flip,
    flipDistPct: gauge.distPct,
    sigmaLeft,
    sigmaLeftPct: (sigmaLeft / spot) * 100,
    sigmaDay,
    scales,
    levels: profile.levels,
    rows,
    heaviest,
    callWall: at(profile.levels.callWall),
    putWall: at(profile.levels.putWall),
    supreme,
    netGex: profile.netGex,
    bellShare,
    watch,
    closes: top ? { strike: top.strike, odds: top.odds } : null,
  };
}

/* ---- the ruler's reach ------------------------------------------------------------ */

/** How far the ruler shows each way, in the day's expected moves — 'all' is both whole books */
export type Reach = 'one' | 'two' | 'three' | 'all';
export const REACH_OPTIONS: { value: Reach; label: string; hint: string }[] = [
  { value: 'one', label: 'One expected move', hint: 'About two days in three end inside it' },
  { value: 'two', label: 'Two expected moves', hint: 'About what a day can reach — nineteen days in twenty' },
  { value: 'three', label: 'Three expected moves', hint: 'Almost every day ends inside it' },
  { value: 'all', label: 'Everything', hint: 'Every strike either name carries' },
];

/** A strike's distance in the day's expected moves */
export const movesAway = (s: CompareSide, strike: number) => (s.sigmaDay > 0 ? (strike - s.spot) / s.sigmaDay : 0);

export interface ReachBand {
  key: 'up1' | 'up2' | 'dn1' | 'dn2';
  label: string;
  /** Expected moves from spot, signed: the band runs from `from` to `to` */
  from: number;
  to: number;
}
export const REACH_BANDS: ReachBand[] = [
  { key: 'up1', label: 'Overhead · within one expected move', from: 0, to: 1 },
  { key: 'up2', label: 'Overhead · one to two moves out', from: 1, to: 2 },
  { key: 'dn1', label: 'Below · within one expected move', from: -1, to: 0 },
  { key: 'dn2', label: 'Below · one to two moves out', from: -2, to: -1 },
];

export interface BandSum {
  /** The greek's negative side, summed — gamma that pushes back, delta that leans down, vega that gains as vol falls */
  neg: number;
  /** Its positive side — gamma that pushes along, delta that leans up, vega that gains as vol rises */
  pos: number;
  total: number;
  strikes: number;
}

/** What sits in a band of the day's expected moves, for one name, in the chosen greek */
export function withinReach(s: CompareSide, band: ReachBand, greek: Greek): BandSum {
  let neg = 0;
  let pos = 0;
  let strikes = 0;
  for (const r of s.rows[greek]) {
    const m = movesAway(s, r.strike);
    const inside = band.from < 0 ? m >= band.from && m < band.to : m > band.from && m <= band.to;
    if (!inside) continue;
    strikes++;
    if (r.value < 0) neg += -r.value;
    else pos += r.value;
  }
  return { neg, pos, total: neg + pos, strikes };
}

/* ---- the pair ------------------------------------------------------------------ */

export interface PairPoint {
  /** The session's last bar, unix seconds */
  time: number;
  /** The first name's close over the second's */
  ratio: number;
}

export interface Pair {
  a: string;
  b: string;
  /** One point per completed session, oldest first */
  sessions: PairPoint[];
  /** Today's path, minute by minute, on the minutes both names printed */
  today: PairPoint[];
  now: number | null;
  mean: number | null;
  sd: number | null;
  /** How far today sits from the average, in standard deviations of the sessions */
  z: number | null;
  /** Sessions whose close sat outside the usual band */
  outside: number;
  sentence: string;
}

/** The ratio of the two names' closes, session by session and today minute by minute */
export function buildPair(a: string, b: string): Pair {
  const ba = Simulator.peekCandles(a) ?? [];
  const bb = Simulator.peekCandles(b) ?? [];
  const sessionsOf = (bars: readonly Candle[]) => {
    const starts = sessionStarts(bars, 1);
    return starts.map((s, i) => bars.slice(s, i + 1 < starts.length ? starts[i + 1] : bars.length));
  };
  const sa = sessionsOf(ba);
  const sb = sessionsOf(bb);
  /* Sessions pair by their day: the close of each against the close of the other on the same day */
  const dayOf = (t: number) => Math.floor((t - 4 * 3600) / 86400);
  const closeB = new Map<number, number>();
  for (const s of sb) if (s.length) closeB.set(dayOf(s[s.length - 1].time), s[s.length - 1].close);
  const sessions: PairPoint[] = [];
  for (const s of sa) {
    if (!s.length) continue;
    const last = s[s.length - 1];
    const cb = closeB.get(dayOf(last.time));
    if (cb) sessions.push({ time: last.time, ratio: last.close / cb });
  }
  /* The still-forming session is today's, off the average */
  const done = sessions.slice(0, -1);
  const todayA = sa[sa.length - 1] ?? [];
  const todayB = sb[sb.length - 1] ?? [];
  const bAt = new Map(todayB.map(x => [x.time, x.close]));
  const today: PairPoint[] = [];
  for (const x of todayA) {
    const cb = bAt.get(x.time);
    if (cb) today.push({ time: x.time, ratio: x.close / cb });
  }
  const now = today.length ? today[today.length - 1].ratio : sessions.length ? sessions[sessions.length - 1].ratio : null;
  let mean: number | null = null;
  let sd: number | null = null;
  if (done.length >= 5) {
    mean = done.reduce((s, p) => s + p.ratio, 0) / done.length;
    const m = mean;
    sd = Math.sqrt(done.reduce((s, p) => s + (p.ratio - m) * (p.ratio - m), 0) / Math.max(1, done.length - 1));
  }
  const z = now != null && mean != null && sd != null && sd > 0 ? (now - mean) / sd : null;
  const outside = mean != null && sd != null ? done.filter(p => Math.abs(p.ratio - mean!) > sd!).length : 0;
  const stretched = z != null && Math.abs(z) > 1;
  const level = z != null && Math.abs(z) < 0.25;
  const sentence =
    z == null || mean == null
      ? `Not enough sessions on the tape yet to say what is usual for ${a} against ${b}.`
      : level
        ? `${a} against ${b} sits where it usually does — on its ${done.length}-session average, well inside the usual band; ${outside} of those sessions closed outside it.`
        : `${a} against ${b} sits ${Math.abs(z).toFixed(1)} standard deviations ${z >= 0 ? 'above' : 'below'} its ${done.length}-session average${stretched ? ' — outside the usual band' : ' — inside the usual band'}; ${outside} of those sessions closed outside it. ${z >= 0 ? `${a} has run ahead` : `${b} has run ahead`}${stretched ? ', further than it usually does.' : '.'}`;
  return { a, b, sessions, today, now, mean, sd, z, outside, sentence };
}

const regimeWord = (s: CompareSide) => (s.regime === 'LONG' ? 'absorb' : s.regime === 'SHORT' ? 'amplify' : 'lean one way');

export function buildCompare(a: CompareSide, b: CompareSide, clock: AheadClock): Compare {
  const ratioRaw = b.sigmaLeftPct / Math.max(1e-9, a.sigmaLeftPct);
  const wider = ratioRaw >= 1 ? { ticker: b.ticker, ratio: ratioRaw } : { ticker: a.ticker, ratio: 1 / ratioRaw };
  const narrower = wider.ticker === a.ticker ? b.ticker : a.ticker;
  const nearerCall = Math.abs(a.callWall.distPct) <= Math.abs(b.callWall.distPct) ? a : b;
  const nearerPut = Math.abs(a.putWall.distPct) <= Math.abs(b.putWall.distPct) ? a : b;
  const regimes =
    a.regime && b.regime && a.regime === b.regime
      ? `dealers ${regimeWord(a)} moves on both`
      : `dealers ${regimeWord(a)} moves on ${a.ticker} and ${regimeWord(b)} them on ${b.ticker}`;
  const when = clock.inSession ? 'to the close' : 'next session';
  const sentence =
    `${wider.ticker} has the wider expected move ${when}, ${wider.ratio.toFixed(1)}× ${narrower}'s; ${regimes}. ` +
    `${nearerCall.ticker}'s call wall is the nearer overhead at ${fmtStrike(nearerCall.callWall.strike)}, ${nearerPut.ticker}'s put wall the nearer below at ${fmtStrike(nearerPut.putWall.strike)}.`;
  return { a, b, inSession: clock.inSession, wider, sentence };
}
