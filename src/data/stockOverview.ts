/*
==================================================
  SLAYER TERMINAL - A NAME'S OVERVIEW (data/stockOverview.ts)

  The stock overview page's engine (the partner's
  review, 2026-09-13: a row on the Stocks board
  should open "the stock overview… like the compass
  analysis"). One name, read on the four pillars
  the board screens by — THE TREND, THE NUMBERS,
  THE MONEY, THE NEWS — each pillar a handful of
  FACTORS the terminal can actually compute, each
  factor a printed value and a lean between −1 and
  +1, the pillar's score the leans' weighted mean on
  a 0–100 scale, the composite the board's own four
  weights, the screen the board's own cuts.

  THE SECOND PASS (Noah, 2026-09-13, with the
  partner's own overview page: "i need all the
  information he has on there but formatted much
  better"): everything his page carried, computed
  from the same factor model rather than seeded —
  every factor's CONTRIBUTION in points (they sum
  to the score's distance from 50), the pillars'
  AGREEMENT with the read and the main risk, the
  trend's part SESSION BY SESSION, the TIMELINE of
  what happened on the sessions on hand, the
  METHOD (observed · derived · inferred), the
  tape's biggest BUYS and SELLS, the moves that
  would change the score with their deltas, and
  one paragraph from the raw data to the signal.

  WHAT IS REAL AND WHAT IS NOT, said on the page:
    the trend   the name's own sessions (the
                simulator keeps ~22) — the 20-day
                average, RSI, ADX, the ATR
                percentile, the structure; the 50-
                and 200-day averages need more
                sessions than are on hand (thin)
    the money   the book (GEX · DEX · VEX · vanna ·
                charm, the walls), the flow book's
                calls against puts, the ask side,
                sweeps, relative volume, the dark
                pool's posture (live)
    the news    the wire on the name (live)
    the numbers a SAMPLE — the simulator has no
                fundamentals; every figure is marked
                so, and the feed replaces the file
                (data/fundamentals.ts)

  States, not orders: the page says what it sees
  — the screen and the lean — never buy or sell.
  The board's own sleeves are hashed stand-ins
  (stocks.ts); this is the first real reading, so a
  name's row and its page can disagree until the
  board reads this engine for every name — 36 names
  seeded at ~0.6s each is why it cannot today.
==================================================
*/

import Simulator from '../core/simulator';
import { now } from '../core/clock';
import { readSessionClock } from './moc';
import { buildExposureProfile } from './exposure';
import { buildFlowBook } from './flowBook';
import { buildDarkPoolView, postureRead } from './darkpool';
import { buildEarningsCalendar, buildEarningsDossier } from './earnings';
import { buildGeoNews, type GeoNewsEvent } from './newsroom';
import { tickerSentiment } from './news';
import { sessionBlocks } from './aheadHistory';
import { lookup } from './universe';
import { tickerName } from './tickers';
import { sampleFundamentals, type Fundamentals } from './fundamentals';
import type { Candle, MarketSnapshot } from '../types/market';
import type { ExposureLevels } from '../types/gex';
import type { BookContract, FlowPrint } from '../types/trace';
import type { DarkPoolView } from '../types/darkpool';

export type PillarKey = 'trend' | 'numbers' | 'money' | 'news';
export type Screen = 'STRONG' | 'MIXED' | 'WEAK';
export type Lean = 'bullish' | 'neutral' | 'bearish';
export type SourceStatus = 'live' | 'sample' | 'thin';

export interface Factor {
  key: string;
  label: string;
  /** The figure, printed */
  value: string;
  /** −1 (against the name) … +1 (for it) */
  lean: number;
  /** Its share of the pillar */
  weight: number;
  /** One plain clause on what it says */
  note: string;
}

export interface Pillar {
  key: PillarKey;
  name: string;
  /** 0–100 */
  score: number;
  factors: Factor[];
  status: SourceStatus;
  /** Where the pillar's figures come from, in a clause */
  from: string;
}

export interface TrendRead {
  closes: number[];
  /** Each session's first bar, unix seconds — the chart's clock */
  times: number[];
  ema20: number | null;
  sma50: number | null;
  sma200: number | null;
  rsi14: number | null;
  adx14: number | null;
  /** Today's range against the sessions on hand, 0–100 */
  atrPercentile: number | null;
  /** Today's range in dollars */
  rangeToday: number | null;
  structure: string;
  /** The last five sessions' swings against the five before */
  flags: { hh: boolean; hl: boolean; lh: boolean; ll: boolean } | null;
  /** How many of the averages on hand the price sits above, and how many there are */
  above: { count: number; of: number };
  change5Pct: number | null;
  change20Pct: number | null;
  sessions: number;
}

export interface MoneyRead {
  netGex: number;
  netDex: number;
  netVex: number;
  netVanna: number;
  netCharm: number;
  levels: ExposureLevels;
  /** dealers 'absorbing' (long gamma) or 'amplifying' (short) at spot */
  regime: 'absorbing' | 'amplifying';
  callPremium: number;
  putPremium: number;
  callVolume: number;
  putVolume: number;
  askSharePct: number;
  sweepSharePct: number;
  rvol: number | null;
  volumeToday: number | null;
  volumeAvg: number | null;
  /** Where today's close sits in its own range, 0 (the low) to 1 (the high) */
  closeInRange: number | null;
  callOI: number;
  putOI: number;
  /** Contracts on the book trading at least twice their open interest */
  unusual: number;
  dark: DarkPoolView;
  /** Off-exchange prints of 50K shares or more */
  darkBlocks: number;
  /** Today's session minute by minute — the tape the prints are drawn on */
  today: { time: number; close: number }[];
  /** The busiest contracts on the name today, calls and puts */
  busiest: { calls: BookContract[]; puts: BookContract[] };
}

export interface NewsRead {
  stories: GeoNewsEvent[];
  sentiment: number;
  positive: number;
  negative: number;
  nextEarnings: { label: string; daysOut: number; impliedMovePct: number; confirmed: boolean } | null;
  /** The average absolute move the session after the last reports, and how many reports that is */
  reaction: { pct: number; reports: number } | null;
  /** The last reports, newest first: what it earned against the estimate and how the stock took it */
  reports: { label: string; epsActual: number; epsEst: number; beat: boolean; movePct: number }[];
}

export interface Source {
  key: string;
  label: string;
  status: SourceStatus;
  /** "live · 21:14" · "sample until the feed lands" · "22 sessions on hand" */
  stamp: string;
}

export interface ScoreHistory {
  /** The trend pillar as it stood N sessions ago (the other pillars held at today's) */
  trend5: number | null;
  trend20: number | null;
  composite5: number | null;
  composite20: number | null;
}

/** A factor's share of the score: the points it adds to or takes from 50 */
export interface Contribution {
  key: string;
  pillar: PillarKey;
  label: string;
  value: string;
  points: number;
}

/** A factor turned the other way, and where the score would land */
export interface Move {
  key: string;
  label: string;
  delta: number;
  to: number;
}

export interface Agreement {
  lean: Lean;
  pillars: { key: PillarKey; name: string; score: number; agrees: boolean }[];
  aligned: number;
  /** Where the read fails first if it fails */
  risk: string;
}

/** The trend's part as it stood `back` sessions ago, and the score with the rest held at today's */
export interface TrendPoint {
  back: number;
  /** The session's first bar, unix seconds */
  time: number;
  trend: number;
  composite: number;
}

export type TimelineKind = 'earnings' | 'news' | 'volume' | 'breakout' | 'breakdown' | 'session';
export interface TimelineEntry {
  key: string;
  when: string;
  kind: TimelineKind;
  text: string;
  /** The session's first bar, unix seconds — a mark on the sessions chart; the wire's and the report's carry none */
  time: number | null;
  /** The trend's part on that session, when it can be read */
  score: number | null;
}

export interface Method {
  observed: string[];
  derived: string[];
  inferred: string[];
}

export interface StockOverview {
  ticker: string;
  name: string;
  sector: string | null;
  price: number;
  changePct: number;
  marketWord: string;
  pillars: Pillar[];
  composite: number;
  screen: Screen;
  /** The read's side: bullish from 55 up, bearish from 45 down */
  lean: Lean;
  weights: Record<PillarKey, number>;
  /** The biggest current facts, one line */
  whyNow: string;
  /** What is for the name and what is against it */
  thesis: string;
  /** From the raw data to the signal, one paragraph */
  explanation: string;
  /** The two factors nearest a flip, and what each would do to the score */
  wouldMove: string[];
  /** The five moves that would change the score most */
  moves: Move[];
  contributions: Contribution[];
  agreement: Agreement;
  series: TrendPoint[];
  timeline: TimelineEntry[];
  method: Method;
  /** The tape's biggest prints on the name today, by side */
  prints: { buys: FlowPrint[]; sells: FlowPrint[] };
  trend: TrendRead;
  money: MoneyRead;
  news: NewsRead;
  numbers: Fundamentals;
  history: ScoreHistory;
  sources: Source[];
  /** How much of the page is live, 0–100 */
  completeness: number;
}

/* the board's own weights and cuts (stocks.ts) */
export const PILLAR_WEIGHTS: Record<PillarKey, number> = { trend: 0.32, numbers: 0.24, money: 0.26, news: 0.18 };
export const PILLAR_NAMES: Record<PillarKey, string> = { trend: 'The trend', numbers: 'The numbers', money: 'The money', news: 'The news' };
/* THE PUBLIC WORDS (Noah, 2026-09-19: "we do NOT grade or score any of our cons in public. thats for our own
   backtesting and backend information… i would rather have poor, caution, and good instead of actual numbers",
   then "and strong should be when its really great").
   The composite, the pillars' scores, the factors' points, the weights and the cuts all stay INSIDE the engine:
   they sort, they decide the word, they feed the journal. What reaches a screen, a sentence or a DOM attribute
   is one of four words. Nothing below this line may print a score, a weight, a point or a cut. */
export type Grade = 'strong' | 'good' | 'caution' | 'poor';
/** Low to high — the meter's order */
export const GRADES: Grade[] = ['poor', 'caution', 'good', 'strong'];
const screenOf = (composite: number): Screen => (composite >= 68 ? 'STRONG' : composite <= 46 ? 'WEAK' : 'MIXED');
/* THE FOUR WORDS' CUTS (Noah, 2026-09-19: "and strong should be when its really great"). STRONG is kept rare on
   purpose: across the 36 names on 2026-09-19 three reached it (3 strong · 10 good · 13 caution · 10 poor). The
   cuts are the engine's and are re-read against the live spread when real data lands; they never reach a screen. */
const STRONG_FROM = 72;
const GOOD_FROM = 60;
const POOR_TO = 46;
/** The word for any figure of ours, the whole read's or a pillar's: one vocabulary, one set of cuts */
export const gradeOfComposite = (composite: number): Grade => (composite >= STRONG_FROM ? 'strong' : composite >= GOOD_FROM ? 'good' : composite <= POOR_TO ? 'poor' : 'caution');
/** A pillar's word, on the SAME cuts as the whole read. With the figures hidden, two sets of cuts showed as a
    contradiction on the page (three pillars "good" under a read of "caution", measured on AAPL 2026-09-19): one
    vocabulary means one thing everywhere. The lean (bullish · neutral · bearish) keeps its own cuts; it is a
    direction, not a grade. */
export const gradeOf = (score: number): Grade => gradeOfComposite(score);
/** A fundamental's health as a word — the figure is the engine's */
export const healthWord = (healthScore: number): string => (healthScore >= 70 ? 'strong' : healthScore <= 40 ? 'stretched' : 'sound');
/** The side a score is on: 55 and up reads for the name, 45 and down against it */
export const leanOf = (score: number): Lean => (score >= 55 ? 'bullish' : score <= 45 ? 'bearish' : 'neutral');
const clamp = (v: number, lo = -1, hi = 1) => Math.max(lo, Math.min(hi, v));
/** "82nd" — a percentile said as one */
export const ordinal = (n: number): string => {
  const r = n % 100;
  const s = r >= 11 && r <= 13 ? 'th' : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th';
  return `${n}${s}`;
};
const pct = (v: number, d = 1) => `${v >= 0 ? '+' : ''}${v.toFixed(d)}%`;
export const fmtMoney = (v: number): string => {
  const a = Math.abs(v);
  const s = a >= 1e9 ? `$${(a / 1e9).toFixed(1)}B` : a >= 1e6 ? `$${(a / 1e6).toFixed(0)}M` : a >= 1e3 ? `$${(a / 1e3).toFixed(0)}K` : `$${a.toFixed(0)}`;
  return v < 0 ? `−${s}` : s;
};
const fmtCount = (v: number): string => (v >= 1e9 ? `${(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : `${Math.round(v)}`);
/** A pillar's score from its factors: 50 + 50 × the leans' weighted mean */
const scoreOf = (factors: Factor[]): number => {
  const w = factors.reduce((a, f) => a + f.weight, 0) || 1;
  return Math.round(50 + 50 * factors.reduce((a, f) => a + f.lean * f.weight, 0) / w);
};
const mmdd = (t: number): string => {
  const d = new Date(t * 1000);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
};

/* ---- the trend, from the name's sessions ------------------------------------------- */

const ema = (xs: number[], n: number): number | null => {
  if (xs.length < n) return null;
  const k = 2 / (n + 1);
  let e = xs.slice(0, n).reduce((a, b) => a + b, 0) / n;
  for (let i = n; i < xs.length; i++) e = xs[i] * k + e * (1 - k);
  return e;
};
const sma = (xs: number[], n: number): number | null => (xs.length < n ? null : xs.slice(-n).reduce((a, b) => a + b, 0) / n);
const rsi = (xs: number[], n = 14): number | null => {
  if (xs.length < n + 1) return null;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= n; i++) {
    const d = xs[i] - xs[i - 1];
    if (d > 0) gain += d;
    else loss -= d;
  }
  gain /= n;
  loss /= n;
  for (let i = n + 1; i < xs.length; i++) {
    const d = xs[i] - xs[i - 1];
    gain = (gain * (n - 1) + Math.max(0, d)) / n;
    loss = (loss * (n - 1) + Math.max(0, -d)) / n;
  }
  if (loss === 0) return 100;
  const rs = gain / loss;
  return 100 - 100 / (1 + rs);
};
/** Wilder's ADX over daily highs, lows and closes — the sessions on hand are few, so it is a rough one */
const adx = (hi: number[], lo: number[], cl: number[], n = 14): number | null => {
  if (cl.length < n + 2) return null;
  let tr = 0;
  let dmp = 0;
  let dmm = 0;
  const dx: number[] = [];
  for (let i = 1; i < cl.length; i++) {
    const up = hi[i] - hi[i - 1];
    const dn = lo[i - 1] - lo[i];
    const p = up > dn && up > 0 ? up : 0;
    const m = dn > up && dn > 0 ? dn : 0;
    const t = Math.max(hi[i] - lo[i], Math.abs(hi[i] - cl[i - 1]), Math.abs(lo[i] - cl[i - 1]));
    if (i <= n) {
      tr += t;
      dmp += p;
      dmm += m;
      if (i < n) continue;
    } else {
      tr = tr - tr / n + t;
      dmp = dmp - dmp / n + p;
      dmm = dmm - dmm / n + m;
    }
    const dip = tr > 0 ? (100 * dmp) / tr : 0;
    const dim = tr > 0 ? (100 * dmm) / tr : 0;
    dx.push(dip + dim > 0 ? (100 * Math.abs(dip - dim)) / (dip + dim) : 0);
  }
  if (!dx.length) return null;
  return dx.reduce((a, b) => a + b, 0) / dx.length;
};

/** The trend from the sessions on hand (blocks of at least 30 bars), as of `uptoSessions` sessions back */
const trendFor = (blocks: Candle[][], spot: number, uptoSessions?: number): { read: TrendRead; factors: Factor[] } => {
  const used = uptoSessions != null ? blocks.slice(0, Math.max(0, blocks.length - uptoSessions)) : blocks;
  const closes = used.map(b => b[b.length - 1].close);
  const times = used.map(b => b[0].time);
  const highs = used.map(b => Math.max(...b.map(c => c.high)));
  const lows = used.map(b => Math.min(...b.map(c => c.low)));
  const last = uptoSessions != null ? closes[closes.length - 1] ?? spot : spot;
  const sessions = closes.length;
  const ema20 = ema(closes, 20);
  const sma50 = sma(closes, 50);
  const sma200 = sma(closes, 200);
  const rsi14 = rsi(closes, 14);
  const adx14 = adx(highs, lows, closes, 14);
  /* today's range against the sessions on hand */
  const ranges = used.map((b, i) => highs[i] - lows[i]);
  const today = ranges[ranges.length - 1];
  const atrPercentile = ranges.length >= 5 ? Math.round((100 * ranges.filter(r => r <= today).length) / ranges.length) : null;
  /* the structure: the last five sessions' swing against the five before */
  let structure = 'too few sessions to say';
  let structLean = 0;
  let flags: TrendRead['flags'] = null;
  if (sessions >= 10) {
    const hh = Math.max(...highs.slice(-5)) > Math.max(...highs.slice(-10, -5));
    const hl = Math.min(...lows.slice(-5)) > Math.min(...lows.slice(-10, -5));
    structure = hh && hl ? 'higher highs and higher lows' : !hh && !hl ? 'lower highs and lower lows' : hh ? 'higher highs, lower lows' : 'lower highs, higher lows';
    structLean = hh && hl ? 1 : !hh && !hl ? -1 : 0;
    flags = { hh, hl, lh: !hh, ll: !hl };
  }
  const averages = [ema20, sma50, sma200].filter((a): a is number => a != null);
  const above = { count: averages.filter(a => last > a).length, of: averages.length };
  const change5Pct = sessions >= 6 ? ((last - closes[sessions - 6]) / closes[sessions - 6]) * 100 : null;
  const change20Pct = sessions >= 21 ? ((last - closes[sessions - 21]) / closes[sessions - 21]) * 100 : null;
  const read: TrendRead = { closes, times, ema20, sma50, sma200, rsi14, adx14, atrPercentile, rangeToday: today ?? null, structure, flags, above, change5Pct, change20Pct, sessions };
  const factors: Factor[] = [];
  if (ema20 != null) {
    const off = ((last - ema20) / ema20) * 100;
    factors.push({ key: 'ema20', label: 'Price against its 20-day average', value: `${pct(off)} · ${ema20.toFixed(2)}`, lean: clamp(off / 3), weight: 0.3, note: off >= 0 ? 'above its average — the trend holds' : 'under its average — the trend has slipped' });
  }
  if (rsi14 != null) factors.push({ key: 'rsi', label: 'RSI, 14 sessions', value: rsi14.toFixed(0), lean: clamp((rsi14 - 50) / 20), weight: 0.2, note: rsi14 >= 70 ? 'stretched — strong, but late' : rsi14 >= 55 ? 'firm' : rsi14 <= 30 ? 'washed out' : rsi14 <= 45 ? 'soft' : 'in the middle' });
  if (adx14 != null && change5Pct != null) {
    const dir = change5Pct >= 0 ? 1 : -1;
    factors.push({ key: 'adx', label: "ADX, the trend's strength", value: `${adx14.toFixed(0)} · ${change5Pct >= 0 ? 'up' : 'down'}`, lean: clamp(((adx14 - 20) / 20) * dir), weight: 0.2, note: adx14 >= 25 ? `a trend with force, ${change5Pct >= 0 ? 'upward' : 'downward'}` : 'no trend with force behind it' });
  }
  if (sessions >= 10) factors.push({ key: 'structure', label: 'The structure', value: structure, lean: structLean, weight: 0.2, note: structLean > 0 ? 'the swings step up' : structLean < 0 ? 'the swings step down' : 'the swings disagree' });
  if (change20Pct != null) factors.push({ key: 'chg20', label: 'The last 20 sessions', value: pct(change20Pct), lean: clamp(change20Pct / 8), weight: 0.1, note: change20Pct >= 0 ? 'up over the month' : 'down over the month' });
  return { read, factors };
};

/* ---- the money, from the book, the flow and the dark pool ------------------------------- */

const moneyFor = (ticker: string, snapshot: MarketSnapshot, blocks: Candle[][]): { read: MoneyRead; factors: Factor[] } => {
  const profile = buildExposureProfile(snapshot, '0DTE', 20);
  const netVanna = profile.strikes.reduce((a, s) => a + (s.vanna?.net ?? 0), 0);
  const netCharm = profile.strikes.reduce((a, s) => a + (s.charm?.net ?? 0), 0);
  const regime: MoneyRead['regime'] = snapshot.spot >= profile.levels.flip ? 'absorbing' : 'amplifying';
  const book = buildFlowBook(Simulator.universeQuotes(ticker)).filter(r => r.ticker === ticker);
  const calls = book.filter(r => r.right === 'C');
  const puts = book.filter(r => r.right === 'P');
  const sum = (rows: BookContract[], f: (r: BookContract) => number) => rows.reduce((a, r) => a + f(r), 0);
  const callPremium = sum(calls, r => r.premium);
  const putPremium = sum(puts, r => r.premium);
  const callVolume = sum(calls, r => r.volume);
  const putVolume = sum(puts, r => r.volume);
  const totalVol = callVolume + putVolume;
  const askSharePct = totalVol > 0 ? sum(book, r => r.askPct * r.volume) / totalVol : 50;
  const sweepSharePct = totalVol > 0 ? sum(book, r => r.sweepPct * r.volume) / totalVol : 0;
  const unusual = book.filter(r => r.volOverOI >= 2).length;
  /* relative volume: today's session against the sessions on hand */
  const vols = blocks.map(b => b.reduce((a, c) => a + (c.volume ?? 0), 0));
  const todayVol = vols[vols.length - 1] ?? 0;
  const past = vols.slice(0, -1);
  const avgVol = past.length ? past.reduce((a, b) => a + b, 0) / past.length : 0;
  const rvol = avgVol > 0 && todayVol > 0 ? todayVol / avgVol : null;
  const lastBlock = blocks[blocks.length - 1];
  let closeInRange: number | null = null;
  if (lastBlock) {
    const hi = Math.max(...lastBlock.map(c => c.high));
    const lo = Math.min(...lastBlock.map(c => c.low));
    closeInRange = hi > lo ? (lastBlock[lastBlock.length - 1].close - lo) / (hi - lo) : null;
  }
  const callOI = snapshot.chain.reduce((a, s) => a + (s.callOI ?? 0), 0);
  const putOI = snapshot.chain.reduce((a, s) => a + (s.putOI ?? 0), 0);
  const dark = buildDarkPoolView(snapshot);
  const darkBlocks = dark.prints.filter(p => p.size >= 50_000).length;
  const today = (lastBlock ?? []).map(c => ({ time: c.time, close: c.close }));
  const byVol = (a: BookContract, b: BookContract) => b.volume - a.volume;
  const read: MoneyRead = {
    netGex: profile.netGex,
    netDex: profile.netDex,
    netVex: profile.netVex,
    netVanna,
    netCharm,
    levels: profile.levels,
    regime,
    callPremium,
    putPremium,
    callVolume,
    putVolume,
    askSharePct,
    sweepSharePct,
    rvol,
    volumeToday: todayVol > 0 ? todayVol : null,
    volumeAvg: avgVol > 0 ? avgVol : null,
    closeInRange,
    callOI,
    putOI,
    unusual,
    dark,
    darkBlocks,
    today,
    busiest: { calls: [...calls].sort(byVol).slice(0, 3), puts: [...puts].sort(byVol).slice(0, 3) },
  };
  const factors: Factor[] = [];
  const prem = callPremium + putPremium;
  if (prem > 0) {
    const ratio = callPremium / Math.max(1, putPremium);
    factors.push({ key: 'premium', label: 'Call premium against put premium', value: `${fmtMoney(callPremium)} vs ${fmtMoney(putPremium)} · ${ratio.toFixed(1)}×`, lean: clamp((callPremium - putPremium) / prem), weight: 0.3, note: ratio >= 1.3 ? 'the money leans to calls' : ratio <= 0.77 ? 'the money leans to puts' : 'about even' });
  }
  factors.push({ key: 'ask', label: 'Traded on the ask', value: `${askSharePct.toFixed(0)}%`, lean: clamp((askSharePct - 50) / 25), weight: 0.2, note: askSharePct >= 58 ? 'buyers paying up' : askSharePct <= 42 ? 'sellers hitting bids' : 'balanced' });
  if (rvol != null) factors.push({ key: 'rvol', label: 'Relative volume', value: `${rvol.toFixed(2)}×`, lean: clamp((rvol - 1) * (snapshot.changePercent >= 0 ? 1 : -1)), weight: 0.2, note: rvol >= 1.3 ? `heavy for the name, ${snapshot.changePercent >= 0 ? 'on an up day' : 'on a down day'}` : rvol <= 0.7 ? 'quiet' : 'ordinary' });
  factors.push({ key: 'dark', label: 'Dark pool posture', value: postureRead(dark), lean: clamp(dark.netPosturePct / 60), weight: 0.2, note: dark.posture === 'ACCUMULATING' ? 'sized prints skew to buying' : dark.posture === 'DISTRIBUTING' ? 'sized prints skew to selling' : 'sized prints balanced' });
  factors.push({ key: 'sweeps', label: 'Swept', value: `${sweepSharePct.toFixed(0)}% of volume`, lean: clamp(((sweepSharePct - 12) / 20) * (callPremium >= putPremium ? 1 : -1)), weight: 0.1, note: sweepSharePct >= 20 ? 'urgent orders, mostly on the heavier side' : 'little urgency' });
  return { read, factors };
};

/* ---- the news, from the wire ----------------------------------------------------- */

const newsFor = (ticker: string): { read: NewsRead; factors: Factor[]; lastReport: { label: string; epsActual: number; epsEst: number; beat: boolean; movePct: number } | null } => {
  const stories = buildGeoNews()
    .filter(e => e.item.ticker === ticker)
    .sort((a, b) => a.item.minutesAgo - b.item.minutesAgo);
  const sentiment = tickerSentiment(ticker);
  const positive = stories.filter(s => s.grade === 'ALLY').length;
  const negative = stories.filter(s => s.grade === 'THREAT').length;
  const ev = buildEarningsCalendar().find(e => e.ticker === ticker);
  const nextEarnings = ev ? { label: ev.dateLabel, daysOut: ev.daysOut, impliedMovePct: ev.impliedMovePct, confirmed: ev.confirmed } : null;
  const dossier = buildEarningsDossier(ticker);
  const quarters = dossier?.quarters ?? [];
  const reaction = quarters.length ? { pct: quarters.reduce((a, q) => a + Math.abs(q.movePct), 0) / quarters.length, reports: quarters.length } : null;
  const lastQ = quarters[quarters.length - 1];
  const lastReport = lastQ ? { label: lastQ.label, epsActual: lastQ.epsActual, epsEst: lastQ.epsEst, beat: lastQ.epsBeat, movePct: lastQ.movePct } : null;
  const reports = [...quarters]
    .reverse()
    .slice(0, 6)
    .map(q => ({ label: q.label, epsActual: q.epsActual, epsEst: q.epsEst, beat: q.epsBeat, movePct: q.movePct }));
  const read: NewsRead = { stories: stories.slice(0, 6), sentiment, positive, negative, nextEarnings, reaction, reports };
  const factors: Factor[] = [
    { key: 'lean', label: "The wire's lean", value: `${sentiment >= 0 ? '+' : ''}${sentiment.toFixed(2)} · ${positive} positive · ${negative} negative`, lean: clamp(sentiment * 1.2), weight: 0.6, note: sentiment > 0.15 ? 'the stories read for the name' : sentiment < -0.15 ? 'the stories read against it' : 'no clear lean' },
    { key: 'fresh', label: 'Fresh stories', value: `${stories.filter(s => s.item.minutesAgo <= 180).length} in three hours`, lean: 0, weight: 0.1, note: 'how much is landing now' },
  ];
  const biggest = stories.reduce<GeoNewsEvent | null>((m, s) => (!m || Math.abs(s.item.prediction.expMove1dPct) > Math.abs(m.item.prediction.expMove1dPct) ? s : m), null);
  if (biggest) factors.push({ key: 'move', label: 'Biggest expected move on the wire', value: pct(biggest.item.prediction.expMove1dPct), lean: clamp(biggest.item.prediction.expMove1dPct / 4), weight: 0.3, note: biggest.item.headline });
  return { read, factors, lastReport };
};

/* ---- the numbers, a sample until the feed lands ------------------------------------- */

const numbersFor = (ticker: string, price: number, sector: string | null): { read: Fundamentals; factors: Factor[] } => {
  const f = sampleFundamentals(ticker, price, sector);
  const factors: Factor[] = [
    { key: 'beats', label: 'Beat the estimate', value: `${f.beats} of the last 8`, lean: clamp((f.beats - 4) / 3), weight: 0.2, note: f.beats >= 6 ? 'a habit of beating' : f.beats <= 3 ? 'misses more than it beats' : 'about half the time' },
    { key: 'growth', label: 'Revenue growth, a year on', value: pct(f.revenueGrowthPct), lean: clamp(f.revenueGrowthPct / 20), weight: 0.25, note: f.revenueGrowthPct >= 12 ? 'growing fast' : f.revenueGrowthPct <= 0 ? 'shrinking' : 'growing' },
    { key: 'margin', label: 'Operating margin', value: `${f.operatingMarginPct.toFixed(1)}%`, lean: clamp((f.operatingMarginPct - 15) / 20), weight: 0.2, note: f.operatingMarginPct >= 25 ? 'wide margins' : f.operatingMarginPct <= 5 ? 'thin margins' : 'ordinary margins' },
    { key: 'value', label: 'Price against fair value', value: `${pct(f.vsFairValuePct)} · ${f.valuation}`, lean: clamp(-f.vsFairValuePct / 25), weight: 0.2, note: f.valuation === 'undervalued' ? 'cheap against its own worth' : f.valuation === 'overvalued' ? 'rich against its own worth' : 'about fairly priced' },
    { key: 'health', label: 'Financial health', value: healthWord(f.healthScore), lean: clamp((f.healthScore - 55) / 30), weight: 0.15, note: f.healthScore >= 70 ? 'a strong balance sheet' : f.healthScore <= 40 ? 'a stretched balance sheet' : 'a sound balance sheet' },
  ];
  return { read: f, factors };
};

/* ---- the words and the sums ------------------------------------------------------ */

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const whyNowOf = (pillars: Pillar[]): string => {
  const all = pillars.flatMap(p => p.factors.map(f => ({ ...f, pull: Math.abs(f.lean) * f.weight * PILLAR_WEIGHTS[p.key] })));
  const top = all.filter(f => f.pull > 0).sort((a, b) => b.pull - a.pull).slice(0, 3);
  if (!top.length) return 'Nothing on the name stands out right now.';
  return top.map(f => `${cap(f.label)} ${f.value} — ${f.note}`).join(' · ') + '.';
};
const thesisOf = (pillars: Pillar[], screen: Screen): string => {
  const words: Record<PillarKey, { good: string; bad: string; name: string }> = {
    trend: { name: 'the trend', good: 'the trend is up', bad: 'the trend is broken' },
    numbers: { name: 'the numbers', good: 'the numbers are clean', bad: 'the numbers are slipping' },
    money: { name: 'the money', good: 'the money is buying', bad: 'the money is selling' },
    news: { name: 'the news', good: 'the news helps', bad: 'the news hurts' },
  };
  const ranked = [...pillars].sort((a, b) => b.score - a.score);
  const [best, second] = ranked;
  const worst = ranked[ranked.length - 1];
  const next = ranked[ranked.length - 2];
  if (screen === 'STRONG') return cap(`${words[best.key].good}, ${words[second.key].good}; ${worst.score < 45 ? `${words[worst.key].name} is the one soft spot` : 'nothing against it'}.`);
  if (screen === 'WEAK') return cap(`${words[worst.key].bad}, ${words[next.key].bad}; ${best.score > 65 ? `${words[best.key].name} alone cannot carry it` : 'nothing in its favour'}.`);
  return cap(`${words[best.key].good} but ${words[worst.key].bad} — a catalyst decides.`);
};
/** Every factor's points: its lean × its share of the pillar × 50 × the pillar's weight — they sum to the score's distance from 50 */
const contributionsOf = (pillars: Pillar[]): Contribution[] =>
  pillars
    .flatMap(p => {
      const w = p.factors.reduce((a, f) => a + f.weight, 0) || 1;
      return p.factors.map(f => ({ key: `${p.key}:${f.key}`, pillar: p.key, label: f.label, value: f.value, points: Math.round(f.lean * (f.weight / w) * 50 * PILLAR_WEIGHTS[p.key] * 10) / 10 }));
    })
    .sort((a, b) => Math.abs(b.points) - Math.abs(a.points));
/** The factors whose flip would move the composite most — and by how much */
const movesOf = (pillars: Pillar[], composite: number): Move[] => {
  const out: Move[] = [];
  for (const p of pillars) {
    const w = p.factors.reduce((a, f) => a + f.weight, 0) || 1;
    for (const f of p.factors) {
      if (Math.abs(f.lean) < 0.15) continue;
      /* the factor turned the other way, the rest held */
      const flipped = p.factors.map(x => (x === f ? { ...x, lean: -x.lean } : x));
      const pillarThen = Math.round(50 + 50 * flipped.reduce((a, x) => a + x.lean * x.weight, 0) / w);
      const delta = Math.round((pillarThen - p.score) * PILLAR_WEIGHTS[p.key]);
      if (delta === 0) continue;
      out.push({ key: `${p.key}:${f.key}`, label: f.label, delta, to: composite + delta });
    }
  }
  return out.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 5);
};
const agreementOf = (pillars: Pillar[], composite: number, news: NewsRead): Agreement => {
  const lean = leanOf(composite);
  const rows = pillars.map(p => ({ key: p.key, name: p.name, score: p.score, agrees: leanOf(p.score) === lean }));
  const against = pillars.filter(p => leanOf(p.score) !== lean && leanOf(p.score) !== 'neutral').sort((a, b) => Math.abs(b.score - 50) - Math.abs(a.score - 50));
  let risk: string;
  if (against.length) {
    const p = against[0];
    const f = [...p.factors].sort((a, b) => Math.abs(b.lean) * b.weight - Math.abs(a.lean) * a.weight)[0];
    risk = f ? `If ${p.name.toLowerCase()} is right — ${f.label.toLowerCase()} ${f.value}, ${f.note} — the ${lean} read fails there first.` : `If ${p.name.toLowerCase()} is right, the ${lean} read fails there first.`;
  } else if (news.nextEarnings) {
    risk = `Every pillar agrees; the risk is the print on ${news.nextEarnings.label}, ±${news.nextEarnings.impliedMovePct.toFixed(1)}% priced.`;
  } else {
    risk = 'Every pillar agrees; the risk is a headline the wire has not seen yet.';
  }
  return { lean, pillars: rows, aligned: rows.filter(r => r.agrees).length, risk };
};
const explanationOf = (name: string, screen: Screen, composite: number, pillars: Pillar[], numbers: Fundamentals, agreement: Agreement): string => {
  const ranked = [...pillars].sort((a, b) => Math.abs(b.score - 50) - Math.abs(a.score - 50));
  const top = ranked[0];
  const second = ranked[1];
  const tf = [...top.factors].sort((a, b) => Math.abs(b.lean) * b.weight - Math.abs(a.lean) * a.weight)[0];
  const secondMany = second.key === 'numbers';
  const secondWord = leanOf(second.score) === leanOf(top.score) ? (secondMany ? 'agree' : 'agrees') : leanOf(second.score) === 'neutral' ? (secondMany ? 'sit in the middle' : 'sits in the middle') : secondMany ? 'argue' : 'argues';
  /* "the numbers" is a plural: they carry it, they drag on it */
  const many = top.key === 'numbers';
  const carries = top.score >= 50 ? (many ? 'carry it' : 'carries it') : many ? 'drag on it' : 'drags on it';
  return `${name} reads ${gradeOfComposite(composite)}, leaning ${agreement.lean}: ${top.name.toLowerCase()} ${carries}${tf ? ` — ${tf.label.toLowerCase()} ${tf.value}, ${tf.note}` : ''}; ${second.name.toLowerCase()} ${secondWord}. The numbers put the price ${pct(numbers.vsFairValuePct)} from fair value, ${numbers.valuation} (a sample until the feed lands). ${agreement.risk}`;
};
const methodOf = (trend: TrendRead, money: MoneyRead, news: NewsRead, pillars: Pillar[], composite: number, lean: Lean): Method => ({
  observed: [
    `${trend.sessions} sessions of the name's own bars`,
    `${money.volumeToday != null ? `${fmtCount(money.volumeToday)} shares today` : 'no volume yet today'}${money.volumeAvg != null ? ` against ${fmtCount(money.volumeAvg)} usual` : ''}`,
    `the options book at every strike · ${fmtCount(money.callOI + money.putOI)} open interest`,
    `${fmtMoney(money.callPremium + money.putPremium)} of premium on the flow book · ${money.dark.prints.length} dark prints`,
    `${news.stories.length} ${news.stories.length === 1 ? 'story' : 'stories'} on the wire`,
  ],
  derived: [
    `the 20-day average${trend.sma50 != null ? ', the 50-' : ''}${trend.sma200 != null ? ' and 200-day' : ''} · RSI · ADX · the range percentile · the structure`,
    `GEX · DEX · VEX · vanna · charm, and the walls, the flip and the supreme from them`,
    `calls against puts by premium · the ask share · the sweep share · relative volume`,
    `the dark pool's posture from its sized prints`,
    `the wire's lean from the stories' reads and expected moves`,
  ],
  inferred: [
    `${pillars.reduce((a, p) => a + p.factors.length, 0)} factors, each leaning for the name or against it — a pillar is the balance of its factors`,
    `the four pillars together give the read: strong, good, caution or poor — today ${gradeOfComposite(composite)}`,
    `the lean — ${lean} — from the same balance`,
  ],
});

/* ---- the overview ------------------------------------------------------------- */

export function buildStockOverview(tickerRaw: string, tape: readonly FlowPrint[] = []): StockOverview | null {
  const ticker = tickerRaw.toUpperCase();
  if (!Simulator.isSeeded(ticker)) return null;
  const snapshot = Simulator.snapshotFor(ticker);
  const u = lookup(ticker);
  const name = u?.name ?? tickerName(ticker);
  const sector = u?.sector ?? null;
  const clock = readSessionClock();
  const marketWord = clock.phase === 'OPEN' ? 'market open' : clock.phase === 'AUCTION' ? 'the closing auction' : clock.phase === 'PREMARKET' ? 'pre-market' : clock.phase === 'AFTERHOURS' ? 'after hours' : 'market closed';
  const blocks = sessionBlocks(ticker).filter(b => b.length >= 30);

  const trend = trendFor(blocks, snapshot.spot);
  const money = moneyFor(ticker, snapshot, blocks);
  const news = newsFor(ticker);
  const numbers = numbersFor(ticker, snapshot.spot, sector);
  const pillars: Pillar[] = [
    { key: 'trend', name: PILLAR_NAMES.trend, score: scoreOf(trend.factors), factors: trend.factors, status: trend.read.sessions >= 20 ? 'live' : 'thin', from: `${trend.read.sessions} sessions on hand` },
    { key: 'numbers', name: PILLAR_NAMES.numbers, score: scoreOf(numbers.factors), factors: numbers.factors, status: 'sample', from: 'a sample until the feed lands' },
    { key: 'money', name: PILLAR_NAMES.money, score: scoreOf(money.factors), factors: money.factors, status: 'live', from: 'the book, the flow book and the dark pool' },
    { key: 'news', name: PILLAR_NAMES.news, score: scoreOf(news.factors), factors: news.factors, status: 'live', from: 'the wire' },
  ];
  const composite = Math.round(pillars.reduce((a, p) => a + p.score * PILLAR_WEIGHTS[p.key], 0));
  const screen = screenOf(composite);
  const lean = leanOf(composite);

  /* the trend as it stood N sessions ago — the other pillars have no history on hand and are held */
  const heldRest = pillars.filter(p => p.key !== 'trend').reduce((a, p) => a + p.score * PILLAR_WEIGHTS[p.key], 0);
  const trendAt = (back: number): number | null => {
    const t = trendFor(blocks, snapshot.spot, back);
    return t.factors.length ? scoreOf(t.factors) : null;
  };
  const sessions = trend.read.sessions;
  const trend5 = sessions > 5 ? trendAt(5) : null;
  const trend20 = sessions > 20 ? trendAt(20) : null;
  const history: ScoreHistory = {
    trend5,
    trend20,
    composite5: trend5 == null ? null : Math.round(heldRest + trend5 * PILLAR_WEIGHTS.trend),
    composite20: trend20 == null ? null : Math.round(heldRest + trend20 * PILLAR_WEIGHTS.trend),
  };
  /* session by session, as far back as the factors can still be read */
  const series: TrendPoint[] = [];
  for (let back = Math.min(20, Math.max(0, sessions - 1)); back >= 0; back--) {
    const t = back === 0 ? pillars[0].score : trendAt(back);
    const block = blocks[blocks.length - 1 - back];
    if (t == null || !block) continue;
    series.push({ back, time: block[0].time, trend: t, composite: Math.round(heldRest + t * PILLAR_WEIGHTS.trend) });
  }
  const scoreAt = (back: number): number | null => series.find(s => s.back === back)?.trend ?? null;

  /* THE TIMELINE — what happened on the sessions on hand, newest first */
  const timeline: TimelineEntry[] = [];
  news.read.stories.slice(0, 3).forEach(s => timeline.push({ key: `news:${s.id}`, when: s.item.time, kind: 'news', text: s.item.headline, time: null, score: pillars[0].score }));
  const n = blocks.length;
  for (let i = n - 1; i >= Math.max(1, n - 10); i--) {
    const b = blocks[i];
    const prev = blocks[i - 1];
    const back = n - 1 - i;
    const when = mmdd(b[0].time);
    const close = b[b.length - 1].close;
    const prevClose = prev[prev.length - 1].close;
    const vol = b.reduce((a, c) => a + (c.volume ?? 0), 0);
    const prevVol = prev.reduce((a, c) => a + (c.volume ?? 0), 0);
    const chg = prevClose > 0 ? ((close - prevClose) / prevClose) * 100 : 0;
    const priorHighs = blocks.slice(Math.max(0, i - 10), i).map(x => Math.max(...x.map(c => c.high)));
    const priorLows = blocks.slice(Math.max(0, i - 10), i).map(x => Math.min(...x.map(c => c.low)));
    const time = b[0].time;
    if (priorHighs.length >= 5 && close > Math.max(...priorHighs)) timeline.push({ key: `breakout:${when}`, when, kind: 'breakout', text: `closed above the prior sessions' highs, at ${close.toFixed(2)}`, time, score: scoreAt(back) });
    else if (priorLows.length >= 5 && close < Math.min(...priorLows)) timeline.push({ key: `breakdown:${when}`, when, kind: 'breakdown', text: `closed under the prior sessions' lows, at ${close.toFixed(2)}`, time, score: scoreAt(back) });
    if (prevVol > 0 && vol >= prevVol * 1.6) timeline.push({ key: `volume:${when}`, when, kind: 'volume', text: `volume ${(vol / prevVol).toFixed(1)}× the session before`, time, score: scoreAt(back) });
    if (Math.abs(chg) >= 2.5) timeline.push({ key: `session:${when}`, when, kind: 'session', text: `a ${pct(chg)} session`, time, score: scoreAt(back) });
  }
  if (news.lastReport) {
    const q = news.lastReport;
    timeline.push({ key: `earnings:${q.label}`, when: q.label, kind: 'earnings', text: `${q.beat ? 'beat' : 'missed'} on EPS — ${q.epsActual.toFixed(2)} against ${q.epsEst.toFixed(2)} · ${pct(q.movePct)} the session after`, time: null, score: null });
  }

  const contributions = contributionsOf(pillars);
  const moves = movesOf(pillars, composite);
  const agreement = agreementOf(pillars, composite, news.read);
  const own = tape.filter(p => p.ticker === ticker);
  const prints = {
    buys: [...own].filter(p => p.side === 'ASK').sort((a, b) => b.premium - a.premium).slice(0, 5),
    sells: [...own].filter(p => p.side === 'BID').sort((a, b) => b.premium - a.premium).slice(0, 5),
  };

  const at = now();
  const stamp = `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
  const sources: Source[] = [
    { key: 'price', label: 'Price', status: 'live', stamp: `live · ${stamp}` },
    { key: 'book', label: 'The options book', status: 'live', stamp: `live · ${stamp}` },
    { key: 'flow', label: 'The flow book', status: 'live', stamp: `live · ${stamp}` },
    { key: 'tape', label: 'The tape', status: own.length ? 'live' : 'thin', stamp: own.length ? `live · the newest print ${own[0].time}` : 'no rich prints on the name yet' },
    { key: 'dark', label: 'Dark pool', status: 'live', stamp: `live · ${stamp}` },
    { key: 'news', label: 'The wire', status: 'live', stamp: news.read.stories.length ? `live · the newest story ${news.read.stories[0].item.time}` : `live · ${stamp}` },
    { key: 'sessions', label: 'Sessions', status: sessions >= 20 ? 'live' : 'thin', stamp: `${sessions} on hand · the 50- and 200-day averages need more` },
    { key: 'fundamentals', label: 'Fundamentals', status: 'sample', stamp: 'sample until the feed lands' },
    { key: 'record', label: 'Insiders and Congress', status: 'sample', stamp: 'the shape is real, the people are invented until the feed lands' },
  ];
  const completeness = Math.round((100 * sources.filter(s => s.status === 'live').length) / sources.length);

  return {
    ticker,
    name,
    sector,
    price: snapshot.spot,
    changePct: snapshot.changePercent,
    marketWord,
    pillars,
    composite,
    screen,
    lean,
    weights: PILLAR_WEIGHTS,
    whyNow: whyNowOf(pillars),
    thesis: thesisOf(pillars, screen),
    explanation: explanationOf(name, screen, composite, pillars, numbers.read, agreement),
    wouldMove: moves.slice(0, 2).map(m => {
      const now = gradeOfComposite(composite);
      const then = gradeOfComposite(m.to);
      return then === now ? `${m.label} turning the other way would ${m.delta > 0 ? 'help' : 'hurt'} the read, which would still say ${now}` : `${m.label} turning the other way would take the read from ${now} to ${then}`;
    }),
    moves,
    contributions,
    agreement,
    series,
    timeline,
    method: methodOf(trend.read, money.read, news.read, pillars, composite, lean),
    prints,
    trend: trend.read,
    money: money.read,
    news: news.read,
    numbers: numbers.read,
    history,
    sources,
    completeness,
  };
}
