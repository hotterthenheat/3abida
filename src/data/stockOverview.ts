/*
==================================================
  SLAYER TERMINAL - THE STOCK OVERVIEW
  (data/stockOverview.ts)

  Everything the terminal knows about one name on
  one page (Noah, 2026-09-13, the Stocks page: "when
  I click on it stop sending me to the pinpoint
  page, I need a thing like the compass analysis
  where it tells me all about the stock…" — then
  the list, the whole of it). One builder, one
  object, every section of the page a field of it:

    the verdict      good buy / bad buy, buy · hold
                     · sell, bullish · neutral ·
                     bearish, the overall score
    the four sleeves Trend, Numbers, Money, News —
                     a score, a status and the
                     figures behind each
    valuation, options positioning, dark pool, the
    headlines and catalysts, how the score is put
    together and how it has moved, what would
    change it, the timeline, the timestamps, Why
    now, the insiders, Congress, the option flow

  A COMPOSITION: the price and the candles are the
  simulator's, the levels the Map's book, the
  sleeves the Stocks screen's, the dark pool the
  Dark Pool page's engine, the news the wire's, the
  earnings the dossier's, the insiders and Congress
  the Record's own feeds. What no engine carries —
  the income statement, the multiples — is seeded
  per name so it reads the same every time.
==================================================
*/

import Simulator from '../core/simulator';
import { h01, hRange } from '../core/rng';
import { now } from '../core/clock';
import { lookup } from './universe';
import { buildStockBoard, type StockPick, type StockVerdict } from './stocks';
import { buildExposureProfile } from './exposure';
import { buildDarkPoolView } from './darkpool';
import { buildNewsFeed, tickerSentiment, type NewsItem } from './news';
import { buildEarningsCalendar, buildEarningsDossier, type EarningsEvent } from './earnings';
import { insiderFlow } from './insiders';
import { buildCongress, overlapFor } from './congress';
import { readSessionClock } from './moc';
import { fmtDollars } from './ahead';
import type { FlowPrint } from '../types/trace';
import type { Candle, MarketSnapshot } from '../types/market';
import type { InsiderTrade, CongressTrade } from '../types/record';
import type { DarkPoolView } from '../types/darkpool';

export type Tone = 'bull' | 'bear' | 'warn' | 'plain' | 'silver';
export interface Fact {
  k: string;
  v: string;
  tone?: Tone;
  /** One line under the figure — what it means */
  note?: string;
}
export type SleeveStatus = 'Strong' | 'Neutral' | 'Weak';
export interface Sleeve {
  key: 'trend' | 'numbers' | 'money' | 'news';
  label: string;
  score: number;
  status: SleeveStatus;
  /** What the sleeve says in one line */
  read: string;
  facts: Fact[];
}
export interface ScoreInput {
  label: string;
  raw: string;
  weight: number;
  /** Signed contribution to the score, points */
  contribution: number;
}
export interface TimelineEntry {
  when: string;
  kind: 'earnings' | 'news' | 'volume' | 'breakout' | 'options';
  text: string;
  score: number;
}
export interface Sensitivity {
  label: string;
  weight: number;
  /** "if RSI crossed 70 → −4" */
  hypothetical: string;
  delta: number;
}
export interface StockOverview {
  ticker: string;
  name: string;
  sector: string;
  price: number;
  changePct: number;
  marketStatus: string;
  verdict: { quality: 'Good buy' | 'Fair buy' | 'Bad buy'; action: 'Buy' | 'Hold' | 'Sell'; stance: 'Bullish' | 'Neutral' | 'Bearish'; score: number; base: StockVerdict };
  sleeves: Sleeve[];
  valuation: Fact[];
  options: Fact[];
  darkPool: { facts: Fact[]; view: DarkPoolView };
  headlines: NewsItem[];
  catalysts: Fact[];
  composition: {
    inputs: ScoreInput[];
    positives: string[];
    negatives: string[];
    previous: number;
    current: number;
    confidence: number;
    completeness: number;
    wouldChange: string[];
  };
  history: Fact[];
  method: { observed: string[]; derived: string[]; inference: string[]; crossFactor: string };
  confirmation: { statuses: { label: string; status: SleeveStatus }[]; aligned: number; confirming: string[]; contradictions: string[]; conflicting: string[]; primaryDisagreement: string; mainRisk: string };
  timeline: TimelineEntry[];
  sensitivity: { drivers: Sensitivity[]; weights: { label: string; weight: number }[] };
  timestamps: Fact[];
  whyNow: { changes: string[]; driving: string; explanation: string };
  insiders: { trades: InsiderTrade[]; bought: number; sold: number; net: number; buyers: number; read: string };
  congress: { trades: (CongressTrade & { overlap: string | null })[]; read: string };
  flow: { buys: FlowPrint[]; sells: FlowPrint[]; callPremium: number; putPremium: number };
}

/* ---- helpers ---------------------------------------------------------------------- */

const pct = (v: number, d = 1) => `${v >= 0 ? '+' : ''}${v.toFixed(d)}%`;
const num = (v: number, d = 0) => v.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
const money = (v: number) => (Math.abs(v) >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : Math.abs(v) >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${num(v)}`);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const toneOf = (v: number, flat = 0): Tone => (v > flat ? 'bull' : v < -flat ? 'bear' : 'plain');
const statusOf = (score: number): SleeveStatus => (score >= 62 ? 'Strong' : score >= 42 ? 'Neutral' : 'Weak');
const hhmm = (d: Date) => d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
const mdy = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;

/** The candles folded into sessions: one bar per day */
function dailyBars(bars: readonly Candle[]): Candle[] {
  const out: Candle[] = [];
  let cur: Candle | null = null;
  let curDay = '';
  for (const b of bars) {
    const d = new Date(b.time * 1000);
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
    if (key !== curDay) {
      if (cur) out.push(cur);
      cur = { ...b };
      curDay = key;
    } else if (cur) {
      cur.high = Math.max(cur.high, b.high);
      cur.low = Math.min(cur.low, b.low);
      cur.close = b.close;
      cur.volume += b.volume;
    }
  }
  if (cur) out.push(cur);
  return out;
}

/** A year of daily closes: the sessions on hand, and a seeded walk before them */
function yearOfCloses(ticker: string, days: Candle[]): number[] {
  const have = days.map(d => d.close);
  const need = 260 - have.length;
  if (need <= 0) return have.slice(-260);
  const first = have[0] ?? Simulator.TICKERS[ticker]?.currentPrice ?? 100;
  const back: number[] = [];
  let p = first;
  const iv = Simulator.TICKERS[ticker]?.iv ?? 0.25;
  const drift = (h01(`${ticker}-year-drift`) - 0.45) * 0.0012;
  for (let i = 0; i < need; i++) {
    const z = (h01(`${ticker}-year-${i}`) - 0.5) * 2;
    p = p / (1 + drift + (z * iv) / Math.sqrt(252));
    back.push(p);
  }
  return [...back.reverse(), ...have];
}

const sma = (xs: number[], n: number) => (xs.length >= n ? xs.slice(-n).reduce((a, b) => a + b, 0) / n : xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length));
const emaOf = (xs: number[], n: number) => {
  const k = 2 / (n + 1);
  let e = xs[0] ?? 0;
  for (const x of xs) e = x * k + e * (1 - k);
  return e;
};
const rsiOf = (xs: number[], n = 14) => {
  if (xs.length < n + 1) return 50;
  let g = 0;
  let l = 0;
  for (let i = xs.length - n; i < xs.length; i++) {
    const d = xs[i] - xs[i - 1];
    if (d >= 0) g += d;
    else l -= d;
  }
  if (l === 0) return 100;
  const rs = g / n / (l / n);
  return 100 - 100 / (1 + rs);
};
/** A plain ADX on the daily bars */
const adxOf = (days: Candle[], n = 14) => {
  if (days.length < n + 2) return 20;
  let plus = 0;
  let minus = 0;
  let tr = 0;
  for (let i = days.length - n; i < days.length; i++) {
    const a = days[i];
    const b = days[i - 1];
    const up = a.high - b.high;
    const dn = b.low - a.low;
    plus += up > dn && up > 0 ? up : 0;
    minus += dn > up && dn > 0 ? dn : 0;
    tr += Math.max(a.high - a.low, Math.abs(a.high - b.close), Math.abs(a.low - b.close));
  }
  if (tr === 0) return 20;
  const pdi = (plus / tr) * 100;
  const mdi = (minus / tr) * 100;
  return pdi + mdi === 0 ? 0 : (Math.abs(pdi - mdi) / (pdi + mdi)) * 100;
};

/* ---- the builder --------------------------------------------------------------------- */

export function buildStockOverview(ticker: string, tape: readonly FlowPrint[] = []): StockOverview | null {
  const sym = ticker.toUpperCase();
  const u = lookup(sym);
  let snapshot: MarketSnapshot;
  try {
    Simulator.ensureTicker(sym);
    snapshot = Simulator.snapshotFor(sym);
  } catch {
    return null;
  }
  const name = u?.name ?? sym;
  const sector = u?.sector ?? 'Index';
  const price = snapshot.spot;
  const changePct = snapshot.changePercent;
  const clock = readSessionClock();
  const marketStatus = clock.label;
  const seed = (tag: string) => `${sym}-overview-${tag}`;
  const t0 = now();

  /* THE SLEEVES — the Stocks screen's own scores for the name, or a seeded stand-in for a name off the screen */
  const pick: StockPick | undefined = buildStockBoard().find(p => p.ticker === sym);
  const sleevesRaw = pick?.sleeves ?? { momentum: Math.round(hRange(seed('mom'), 30, 75)), quality: Math.round(hRange(seed('qual'), 30, 75)), flow: Math.round(hRange(seed('flow'), 30, 75)), news: Math.round(hRange(seed('news'), 30, 75)) };
  const composite = pick?.composite ?? Math.round((sleevesRaw.momentum + sleevesRaw.quality + sleevesRaw.flow + sleevesRaw.news) / 4);
  const base: StockVerdict = pick?.verdict ?? (composite >= 62 ? 'ACCUMULATE' : composite >= 42 ? 'HOLD' : 'AVOID');

  /* THE TAPE — the candles, the sessions, the year */
  const bars = Simulator.getCandles(sym) ?? [];
  const days = dailyBars(bars);
  const closes = yearOfCloses(sym, days);
  const ema20 = emaOf(closes.slice(-60), 20);
  const sma50 = sma(closes, 50);
  const sma200 = sma(closes, 200);
  const rsi = rsiOf(closes);
  const adx = adxOf(days.length >= 16 ? days : days);
  const trs = days.map((d, i) => (i === 0 ? d.high - d.low : Math.max(d.high - d.low, Math.abs(d.high - days[i - 1].close), Math.abs(d.low - days[i - 1].close))));
  const atr = trs.length ? trs.slice(-14).reduce((a, b) => a + b, 0) / Math.min(14, trs.length) : price * 0.01;
  const atrPctl = trs.length > 5 ? Math.round((trs.filter(t => t <= atr).length / trs.length) * 100) : 50;
  const recent = days.slice(-10);
  const highs = recent.map(d => d.high);
  const lows = recent.map(d => d.low);
  const hh = highs.length > 2 && highs[highs.length - 1] > Math.max(...highs.slice(0, -1));
  const ll = lows.length > 2 && lows[lows.length - 1] < Math.min(...lows.slice(0, -1));
  const hl = lows.length > 4 && lows[lows.length - 1] > lows[Math.floor(lows.length / 2)] && !ll;
  const lh = highs.length > 4 && highs[highs.length - 1] < highs[Math.floor(highs.length / 2)] && !hh;
  const aligned = price > ema20 && ema20 > sma50 && sma50 > sma200 ? 'bullish' : price < ema20 && ema20 < sma50 && sma50 < sma200 ? 'bearish' : 'mixed';
  const momentumScore = clamp(Math.round(50 + (rsi - 50) * 0.8 + (price > sma50 ? 8 : -8) + (aligned === 'bullish' ? 10 : aligned === 'bearish' ? -10 : 0)), 0, 100);
  const structureScore = clamp(Math.round(50 + (hh ? 15 : 0) + (hl ? 10 : 0) - (ll ? 15 : 0) - (lh ? 10 : 0) + (adx - 20) * 0.5), 0, 100);

  /* THE BOOK — the Map's levels */
  let profile: ReturnType<typeof buildExposureProfile> | null = null;
  try {
    profile = buildExposureProfile(snapshot, '0DTE', 30);
  } catch {
    profile = null;
  }
  const levels = profile?.levels;
  const support = levels?.putWall ?? price * 0.98;
  const resistance = levels?.callWall ?? price * 1.02;

  /* THE INCOME STATEMENT — seeded per name, the sector's own ranges */
  const dossier = buildEarningsDossier(sym);
  const lastQ = dossier?.quarters[dossier.quarters.length - 1];
  const eps = lastQ?.epsActual ?? hRange(seed('eps'), 0.4, 6.5);
  const epsEst = lastQ?.epsEst ?? eps * (1 - (h01(seed('epsest')) - 0.5) * 0.12);
  const epsSurprise = ((eps - epsEst) / Math.abs(epsEst || 1)) * 100;
  const revB = lastQ?.revActualB ?? hRange(seed('rev'), 2, 90);
  const revEstB = lastQ?.revEstB ?? revB * (1 - (h01(seed('revest')) - 0.5) * 0.06);
  const revSurprise = ((revB - revEstB) / Math.abs(revEstB || 1)) * 100;
  const revGrowth = hRange(seed('revg'), -6, 34);
  const epsGrowth = revGrowth + hRange(seed('epsg'), -8, 14);
  const opMargin = hRange(seed('opm'), 6, 42);
  const fcfB = revB * 4 * (opMargin / 100) * hRange(seed('fcf'), 0.5, 0.95);
  const pe = hRange(seed('pe'), 11, 48);
  const evSales = hRange(seed('evs'), 1.2, 14);
  const peg = pe / Math.max(4, epsGrowth);
  const sectorMedianPe = hRange(`${sector}-median-pe`, 14, 30);
  const sectorPctl = clamp(Math.round(50 + (sleevesRaw.quality - 50) * 0.9), 2, 98);
  const guidance = h01(seed('guide')) > 0.55 ? 'raised' : h01(seed('guide')) > 0.3 ? 'held' : 'cut';
  const trajectory = epsGrowth > 12 ? 'accelerating' : epsGrowth > 3 ? 'steady' : 'slowing';
  const healthScore = clamp(Math.round(sleevesRaw.quality * 0.7 + (opMargin > 20 ? 15 : 5) + (fcfB > 0 ? 10 : 0)), 0, 100);
  const fairValue = price * (1 + ((sleevesRaw.quality - 50) / 50) * 0.18 + (h01(seed('fair')) - 0.5) * 0.06);
  const intrinsic = fairValue * (1 + (h01(seed('intr')) - 0.5) * 0.08);
  const vsFair = ((price - fairValue) / fairValue) * 100;
  const valuationWord = vsFair > 8 ? 'Overvalued' : vsFair < -8 ? 'Undervalued' : 'Fairly valued';

  /* THE MONEY — volume, the tape's prints, the book, the dark pool */
  const todayVol = days.length ? days[days.length - 1].volume : 0;
  const avgVol = days.length > 1 ? days.slice(0, -1).reduce((a, d) => a + d.volume, 0) / (days.length - 1) : todayVol || 1;
  const rvol = avgVol > 0 ? todayVol / avgVol : 1;
  const adLine = days.reduce((a, d) => a + (d.high === d.low ? 0 : (((d.close - d.low) - (d.high - d.close)) / (d.high - d.low)) * d.volume), 0);
  const own = tape.filter(p => p.ticker === sym);
  const callPrem = own.filter(p => p.right === 'C').reduce((a, p) => a + p.premium, 0);
  const putPrem = own.filter(p => p.right === 'P').reduce((a, p) => a + p.premium, 0);
  const callVol = own.filter(p => p.right === 'C').reduce((a, p) => a + p.size, 0);
  const putVol = own.filter(p => p.right === 'P').reduce((a, p) => a + p.size, 0);
  const sweeps = own.filter(p => p.sweep).length;
  const unusual = own.filter(p => p.volOverOI >= 2).length;
  const chain = snapshot.chain;
  const gex = chain.reduce((a, s) => a + s.netGex, 0);
  const dex = chain.reduce((a, s) => a + s.netDex, 0);
  const vex = chain.reduce((a, s) => a + s.netVex, 0);
  const vanna = chain.reduce((a, s) => a + s.netVanna, 0);
  const charm = chain.reduce((a, s) => a + s.netCharm, 0);
  const callOI = chain.reduce((a, s) => a + s.callOI, 0);
  const putOI = chain.reduce((a, s) => a + s.putOI, 0);
  const dp = buildDarkPoolView(snapshot);
  const blocks = dp.prints.filter(p => p.size >= 50_000).length;
  const buys = [...own].filter(p => p.side === 'ASK').sort((a, b) => b.premium - a.premium).slice(0, 5);
  const sells = [...own].filter(p => p.side === 'BID').sort((a, b) => b.premium - a.premium).slice(0, 5);

  /* THE NEWS — the wire's stories on the name */
  const feed = buildNewsFeed();
  const headlines = feed.filter(n => n.ticker === sym).sort((a, b) => a.minutesAgo - b.minutesAgo);
  const sentiment = tickerSentiment(sym);
  const sentimentWord = sentiment > 0.15 ? 'Positive' : sentiment < -0.15 ? 'Negative' : 'Neutral';
  const sentimentTrend = headlines.length >= 2 ? (headlines[0].sentiment > headlines[headlines.length - 1].sentiment ? 'improving' : 'softening') : 'steady';
  const events: EarningsEvent[] = buildEarningsCalendar();
  const nextEr = events.find(e => e.ticker === sym) ?? null;
  const histReaction = dossier ? dossier.quarters.reduce((a, q) => a + Math.abs(q.movePct), 0) / Math.max(1, dossier.quarters.length) : hRange(seed('react'), 2, 9);

  /* THE SLEEVES, WRITTEN */
  const sleeves: Sleeve[] = [
    {
      key: 'trend',
      label: 'Trend',
      score: sleevesRaw.momentum,
      status: statusOf(sleevesRaw.momentum),
      read: `${aligned === 'bullish' ? 'The averages stack bullish' : aligned === 'bearish' ? 'The averages stack bearish' : 'The averages are mixed'} · RSI ${rsi.toFixed(0)} · ADX ${adx.toFixed(0)} ${adx >= 25 ? '(trending)' : '(ranging)'}`,
      facts: [
        { k: '20 EMA', v: `$${ema20.toFixed(2)}`, tone: toneOf(price - ema20), note: price > ema20 ? 'price above' : 'price below' },
        { k: '50 SMA', v: `$${sma50.toFixed(2)}`, tone: toneOf(price - sma50), note: price > sma50 ? 'price above' : 'price below' },
        { k: '200 SMA', v: `$${sma200.toFixed(2)}`, tone: toneOf(price - sma200), note: price > sma200 ? 'price above' : 'price below' },
        { k: 'Price vs moving averages', v: aligned === 'bullish' ? 'above all three' : aligned === 'bearish' ? 'below all three' : `${[price > ema20, price > sma50, price > sma200].filter(Boolean).length} of 3 above`, tone: aligned === 'bullish' ? 'bull' : aligned === 'bearish' ? 'bear' : 'plain' },
        { k: 'RSI (14)', v: rsi.toFixed(1), tone: rsi > 70 ? 'warn' : rsi < 30 ? 'warn' : 'plain', note: rsi > 70 ? 'overbought' : rsi < 30 ? 'oversold' : 'in range' },
        { k: 'ADX (14)', v: adx.toFixed(1), tone: adx >= 25 ? 'silver' : 'plain', note: adx >= 25 ? 'a trend is on' : 'no trend to speak of' },
        { k: 'ATR percentile', v: `${atrPctl}th`, note: `ATR $${atr.toFixed(2)} · ${atrPctl >= 70 ? 'a wide-range regime' : atrPctl <= 30 ? 'a quiet regime' : 'usual ranges'}` },
        { k: 'Higher highs', v: hh ? 'yes' : 'no', tone: hh ? 'bull' : 'plain' },
        { k: 'Lower lows', v: ll ? 'yes' : 'no', tone: ll ? 'bear' : 'plain' },
        { k: 'Higher lows', v: hl ? 'yes' : 'no', tone: hl ? 'bull' : 'plain' },
        { k: 'Lower highs', v: lh ? 'yes' : 'no', tone: lh ? 'bear' : 'plain' },
        { k: 'Support', v: `$${support.toFixed(2)}`, tone: 'bull', note: 'the put wall — dealer hedging bids there' },
        { k: 'Resistance', v: `$${resistance.toFixed(2)}`, tone: 'bear', note: 'the call wall — dealer hedging supplies stock there' },
        { k: 'MA alignment', v: aligned, tone: aligned === 'bullish' ? 'bull' : aligned === 'bearish' ? 'bear' : 'plain' },
        { k: 'Momentum score', v: `${momentumScore}`, tone: toneOf(momentumScore - 50, 10) },
        { k: 'Structure score', v: `${structureScore}`, tone: toneOf(structureScore - 50, 10) },
        { k: 'Volatility contribution', v: `${Math.round((atrPctl - 50) / 5)} pts`, note: 'what the range regime adds to or takes from the trend score' },
      ],
    },
    {
      key: 'numbers',
      label: 'Numbers',
      score: sleevesRaw.quality,
      status: statusOf(sleevesRaw.quality),
      read: `EPS ${epsSurprise >= 0 ? 'beat' : 'missed'} by ${Math.abs(epsSurprise).toFixed(1)}% · revenue growing ${revGrowth.toFixed(0)}% · guidance ${guidance} · ${valuationWord.toLowerCase()} against fair value`,
      facts: [
        { k: 'EPS', v: `$${eps.toFixed(2)}`, note: `estimate $${epsEst.toFixed(2)}` },
        { k: 'EPS surprise', v: pct(epsSurprise), tone: toneOf(epsSurprise) },
        { k: 'Revenue', v: `$${revB.toFixed(2)}B`, note: `estimate $${revEstB.toFixed(2)}B` },
        { k: 'Revenue surprise', v: pct(revSurprise), tone: toneOf(revSurprise) },
        { k: 'Guidance revisions', v: guidance, tone: guidance === 'raised' ? 'bull' : guidance === 'cut' ? 'bear' : 'plain' },
        { k: 'Revenue growth', v: pct(revGrowth), tone: toneOf(revGrowth) },
        { k: 'EPS growth', v: pct(epsGrowth), tone: toneOf(epsGrowth) },
        { k: 'Operating margin', v: `${opMargin.toFixed(1)}%`, tone: opMargin >= 20 ? 'bull' : 'plain' },
        { k: 'Free cash flow', v: `$${fcfB.toFixed(2)}B`, tone: fcfB > 0 ? 'bull' : 'bear', note: 'trailing twelve months' },
        { k: 'P/E', v: pe.toFixed(1), tone: pe < sectorMedianPe ? 'bull' : 'plain', note: `sector median ${sectorMedianPe.toFixed(1)}` },
        { k: 'EV / Sales', v: `${evSales.toFixed(1)}×` },
        { k: 'PEG', v: peg.toFixed(2), tone: peg < 1.2 ? 'bull' : peg > 2.5 ? 'bear' : 'plain' },
        { k: 'Sector median', v: `P/E ${sectorMedianPe.toFixed(1)}` },
        { k: 'Sector percentile', v: `${sectorPctl}th`, note: 'quality against the sector' },
        { k: 'Earnings trajectory', v: trajectory, tone: trajectory === 'accelerating' ? 'bull' : trajectory === 'slowing' ? 'bear' : 'plain' },
        { k: 'Financial health score', v: `${healthScore}`, tone: toneOf(healthScore - 50, 10) },
      ],
    },
    {
      key: 'money',
      label: 'Money',
      score: sleevesRaw.flow,
      status: statusOf(sleevesRaw.flow),
      read: `${rvol.toFixed(1)}× the usual volume · ${dp.posture.toLowerCase()} off-exchange (${dp.dpSharePct.toFixed(0)}% dark) · calls ${money(callPrem)} vs puts ${money(putPrem)} on the tape`,
      facts: [
        { k: 'Volume', v: num(todayVol), note: `average ${num(avgVol)}` },
        { k: 'RVOL', v: `${rvol.toFixed(2)}×`, tone: rvol >= 1.5 ? 'silver' : 'plain' },
        { k: 'Volume profile', v: `${(days.length ? (days[days.length - 1].close > (days[days.length - 1].high + days[days.length - 1].low) / 2 ? 'closing strong' : 'closing weak') : '—')}`, note: 'where today closed in its own range' },
        { k: 'Accumulation / distribution', v: adLine >= 0 ? 'accumulation' : 'distribution', tone: adLine >= 0 ? 'bull' : 'bear', note: `A/D line ${adLine >= 0 ? '+' : '−'}${num(Math.abs(adLine))}` },
        { k: 'Institutional accumulation / distribution', v: dp.posture.toLowerCase(), tone: dp.posture === 'ACCUMULATING' ? 'bull' : dp.posture === 'DISTRIBUTING' ? 'bear' : 'plain', note: `${dp.netPosturePct >= 0 ? '+' : ''}${dp.netPosturePct.toFixed(0)}% net posture off-exchange` },
        { k: 'Call volume', v: num(callVol), note: 'rich prints on the tape today' },
        { k: 'Put volume', v: num(putVol) },
        { k: 'Call premium', v: money(callPrem), tone: 'bull' },
        { k: 'Put premium', v: money(putPrem), tone: 'bear' },
        { k: 'Call / put imbalance', v: callPrem + putPrem > 0 ? `${Math.round((callPrem / (callPrem + putPrem)) * 100)}% calls` : '—', tone: callPrem > putPrem ? 'bull' : callPrem < putPrem ? 'bear' : 'plain' },
        { k: 'Options sweeps', v: `${sweeps}`, tone: sweeps > 0 ? 'warn' : 'plain' },
        { k: 'Unusual options activity', v: `${unusual} prints`, note: 'volume at least twice the open interest' },
        { k: 'Blocks', v: `${blocks}`, note: 'off-exchange prints of 50K shares or more' },
        { k: 'Dark pool activity', v: `${dp.dpSharePct.toFixed(0)}% of volume`, note: `${money(dp.totalNotional)} printed dark` },
        { k: 'Net institutional buying / selling', v: dp.netPosturePct >= 0 ? `buying ${dp.netPosturePct.toFixed(0)}%` : `selling ${Math.abs(dp.netPosturePct).toFixed(0)}%`, tone: toneOf(dp.netPosturePct) },
        { k: 'Positioning changes', v: `${callOI > putOI ? 'call' : 'put'} open interest leads ${(Math.max(callOI, putOI) / Math.max(1, Math.min(callOI, putOI))).toFixed(2)}×` },
      ],
    },
    {
      key: 'news',
      label: 'News',
      score: sleevesRaw.news,
      status: statusOf(sleevesRaw.news),
      read: `${headlines.length} ${headlines.length === 1 ? 'story' : 'stories'} on the wire · sentiment ${sentimentWord.toLowerCase()} and ${sentimentTrend}${nextEr ? ` · reports in ${nextEr.daysOut} ${nextEr.daysOut === 1 ? 'session' : 'sessions'}` : ''}`,
      facts: [
        { k: 'Headlines', v: `${headlines.length} today` },
        { k: 'Sentiment', v: sentimentWord, tone: sentiment > 0.15 ? 'bull' : sentiment < -0.15 ? 'bear' : 'plain', note: `${sentiment >= 0 ? '+' : ''}${sentiment.toFixed(2)} on −1…+1` },
        { k: 'Sentiment trend', v: sentimentTrend },
        { k: 'Catalyst', v: headlines[0]?.category ?? 'none on the wire', note: headlines[0]?.headline },
        { k: 'Upcoming earnings', v: nextEr ? `${nextEr.dateLabel} · ${nextEr.slot}` : 'none in the next two weeks', tone: nextEr ? 'warn' : 'plain', note: nextEr ? `±${nextEr.impliedMovePct.toFixed(1)}% priced` : undefined },
        { k: 'Historical reaction to similar catalysts', v: `±${histReaction.toFixed(1)}%`, note: 'the average absolute move the session after' },
      ],
    },
  ];

  /* THE VERDICT */
  const verdict = {
    base,
    score: composite,
    quality: (base === 'ACCUMULATE' ? 'Good buy' : base === 'HOLD' ? 'Fair buy' : 'Bad buy') as 'Good buy' | 'Fair buy' | 'Bad buy',
    action: (base === 'ACCUMULATE' ? 'Buy' : base === 'HOLD' ? 'Hold' : 'Sell') as 'Buy' | 'Hold' | 'Sell',
    stance: (base === 'ACCUMULATE' ? 'Bullish' : base === 'HOLD' ? 'Neutral' : 'Bearish') as 'Bullish' | 'Neutral' | 'Bearish',
  };

  /* VALUATION */
  const valuation: Fact[] = [
    { k: 'Fair value', v: `$${fairValue.toFixed(2)}` },
    { k: 'Estimated intrinsic value', v: `$${intrinsic.toFixed(2)}` },
    { k: 'Current price vs fair value', v: pct(vsFair), tone: toneOf(-vsFair, 8) },
    { k: 'Verdict', v: valuationWord, tone: valuationWord === 'Undervalued' ? 'bull' : valuationWord === 'Overvalued' ? 'bear' : 'plain' },
    { k: 'Valuation upside / downside', v: pct(((fairValue - price) / price) * 100), tone: toneOf(fairValue - price) },
  ];

  /* OPTIONS POSITIONING */
  const options: Fact[] = [
    { k: 'GEX', v: fmtDollars(gex), tone: gex >= 0 ? 'bull' : 'bear', note: gex >= 0 ? 'dealers absorb moves' : 'dealers amplify moves' },
    { k: 'Dealer gamma', v: gex >= 0 ? 'long' : 'short', tone: gex >= 0 ? 'bull' : 'bear' },
    { k: 'DEX', v: fmtDollars(dex), tone: toneOf(dex) },
    { k: 'VEX', v: fmtDollars(vex), tone: toneOf(vex) },
    { k: 'Vega', v: fmtDollars(vex), note: 'per one point of vol' },
    { k: 'Vanna', v: fmtDollars(vanna), tone: toneOf(vanna), note: vanna >= 0 ? 'a vol drop makes dealers buy' : 'a vol drop makes dealers sell' },
    { k: 'Charm', v: fmtDollars(charm), tone: toneOf(-charm), note: charm < 0 ? 'the clock makes dealers buy' : 'the clock makes dealers sell' },
    { k: 'Call open interest', v: num(callOI) },
    { k: 'Put open interest', v: num(putOI) },
    { k: 'Flip', v: levels ? `$${levels.flip.toFixed(2)}` : '—', note: levels ? (price > levels.flip ? 'price above — moves absorbed' : 'price below — moves amplified') : undefined },
    { k: 'Supreme', v: levels ? `$${levels.supreme.toFixed(2)}` : '—', tone: 'silver', note: 'the heaviest strike on the book' },
  ];

  /* THE DARK POOL */
  const darkPool = {
    view: dp,
    facts: [
      { k: 'Dark share', v: `${dp.dpSharePct.toFixed(0)}%`, note: 'of the session printed off-exchange' },
      { k: 'Posture', v: dp.posture.toLowerCase(), tone: dp.posture === 'ACCUMULATING' ? 'bull' : dp.posture === 'DISTRIBUTING' ? 'bear' : 'plain' },
      { k: 'Largest print', v: dp.largest ? `${num(dp.largest.size)} @ $${dp.largest.price.toFixed(2)}` : '—', note: dp.largest ? `${money(dp.largest.notional)} · ${dp.largest.venue}` : undefined },
      { k: 'Shelves', v: `${dp.levels.length}`, note: dp.levels.map(l => `${l.role.toLowerCase()} ${l.price.toFixed(2)}`).join(' · ') },
    ] as Fact[],
  };

  /* CATALYSTS */
  const catalysts: Fact[] = [
    { k: 'Upcoming earnings', v: nextEr ? `${nextEr.dateLabel} · ${nextEr.slot === 'BMO' ? 'before the open' : 'after the close'}` : 'not in the next two weeks', tone: nextEr ? 'warn' : 'plain', note: nextEr ? `±${nextEr.impliedMovePct.toFixed(1)}% priced · ${nextEr.confirmed ? 'confirmed' : 'estimated'}` : undefined },
    { k: 'FDA events', v: /health/i.test(sector) ? (h01(seed('fda')) > 0.5 ? 'PDUFA date inside 60 days' : 'none scheduled') : 'not applicable', note: /health/i.test(sector) ? 'from the FDA calendar' : 'no drug pipeline' },
    { k: 'Product events', v: h01(seed('product')) > 0.6 ? 'a launch inside 30 days' : 'none announced' },
    { k: 'Major catalysts', v: headlines.some(h => h.magnitude >= 0.7) ? 'a market-moving story is live' : 'the calendar and the wire are quiet', tone: headlines.some(h => h.magnitude >= 0.7) ? 'warn' : 'plain' },
    { k: 'Historical reaction to similar catalysts', v: `±${histReaction.toFixed(1)}%` },
  ];

  /* THE SCORE — how it is put together */
  const weights = [
    { label: 'Trend', weight: 0.3 },
    { label: 'Numbers', weight: 0.25 },
    { label: 'Money', weight: 0.25 },
    { label: 'News', weight: 0.2 },
  ];
  const inputs: ScoreInput[] = sleeves.map((s, i) => ({ label: s.label, raw: `${s.score} / 100`, weight: weights[i].weight, contribution: Math.round((s.score - 50) * weights[i].weight) }));
  const previous = clamp(composite - Math.round((h01(seed('prev')) - 0.5) * 14), 0, 100);
  const positives = sleeves.filter(s => s.score >= 55).map(s => `${s.label} at ${s.score}`);
  const negatives = sleeves.filter(s => s.score < 45).map(s => `${s.label} at ${s.score}`);
  const composition = {
    inputs,
    positives: positives.length ? positives : ['nothing above 55 — no sleeve carries the name'],
    negatives: negatives.length ? negatives : ['nothing below 45 — no sleeve drags on it'],
    previous,
    current: composite,
    confidence: clamp(Math.round(55 + (headlines.length ? 10 : 0) + (own.length ? 10 : 0) + (dossier ? 10 : 0) + Math.abs(composite - 50) * 0.3), 0, 98),
    completeness: Math.round(((1 + (headlines.length ? 1 : 0) + (own.length ? 1 : 0) + (dossier ? 1 : 0) + (dp.prints.length ? 1 : 0)) / 5) * 100),
    wouldChange: [
      `Trend: a close ${price > sma50 ? 'below' : 'above'} the 50 SMA ($${sma50.toFixed(2)})`,
      `Numbers: guidance ${guidance === 'raised' ? 'cut' : 'raised'} at the next print`,
      `Money: the tape's premium ${callPrem >= putPrem ? 'turning to puts' : 'turning to calls'}`,
      `News: a headline with the opposite lean landing ${sentimentWord === 'Positive' ? 'negative' : 'positive'}`,
    ],
  };

  /* THE SCORE'S HISTORY — seeded around the current reading */
  const hist = Array.from({ length: 252 }, (_, i) => clamp(composite + Math.round((h01(seed(`hist-${i}`)) - 0.5) * 30 + Math.sin(i / 17) * 6), 0, 100));
  const pctlIn = (n: number) => Math.round((hist.slice(-n).filter(v => v <= composite).length / n) * 100);
  const avg = hist.reduce((a, b) => a + b, 0) / hist.length;
  const d5 = composite - hist[hist.length - 6];
  const d20 = composite - hist[hist.length - 21];
  const history: Fact[] = [
    { k: '20D percentile', v: `${pctlIn(20)}th` },
    { k: '60D percentile', v: `${pctlIn(60)}th` },
    { k: '252D percentile', v: `${pctlIn(252)}th` },
    { k: 'Historical average', v: avg.toFixed(0) },
    { k: 'Historical high / low', v: `${Math.max(...hist)} / ${Math.min(...hist)}` },
    { k: 'Previous reading', v: `${previous}` },
    { k: 'Current reading', v: `${composite}`, tone: toneOf(composite - previous) },
    { k: 'Current vs previous', v: `${composite - previous >= 0 ? '+' : ''}${composite - previous}`, tone: toneOf(composite - previous) },
    { k: '5D change', v: `${d5 >= 0 ? '+' : ''}${d5}`, tone: toneOf(d5) },
    { k: '20D change', v: `${d20 >= 0 ? '+' : ''}${d20}`, tone: toneOf(d20) },
    { k: 'Direction', v: d5 > 1 ? 'rising' : d5 < -1 ? 'falling' : 'flat', tone: toneOf(d5, 1) },
    { k: 'Acceleration / deceleration', v: Math.abs(d5) > Math.abs(d20) / 4 ? 'accelerating' : 'decelerating' },
    { k: 'Reason for change', v: (() => {
        const moved = [...sleeves].sort((a, b) => Math.abs(b.score - 50) - Math.abs(a.score - 50))[0];
        return `${moved.label} moved most — ${moved.read.split(' · ')[0].toLowerCase()}`;
      })() },
  ];

  const method = {
    observed: [`price $${price.toFixed(2)} (${pct(changePct)})`, `volume ${num(todayVol)} · RVOL ${rvol.toFixed(2)}×`, `${own.length} rich prints on the tape · ${dp.prints.length} dark prints`, `${headlines.length} headlines on the wire`],
    derived: [`EMA 20 / SMA 50 / SMA 200 · RSI ${rsi.toFixed(0)} · ADX ${adx.toFixed(0)}`, `GEX ${fmtDollars(gex)} · DEX ${fmtDollars(dex)} · the walls and the flip`, `A/D line and the dark posture (${dp.netPosturePct.toFixed(0)}%)`, `the four sleeve scores and their weights`],
    inference: [`${verdict.stance.toLowerCase()} — ${verdict.quality.toLowerCase()} · ${verdict.action.toLowerCase()}`, `fair value $${fairValue.toFixed(2)} → ${valuationWord.toLowerCase()}`],
    crossFactor: sleeves.filter(s => s.status === 'Strong').length >= 3 ? 'three or more sleeves agree — the read is confirmed across factors' : sleeves.filter(s => s.status === 'Weak').length >= 3 ? 'three or more sleeves are weak — the read is confirmed to the downside' : 'the sleeves disagree — the read leans on the strongest of them',
  };

  const statuses = sleeves.map(s => ({ label: s.label, status: s.status }));
  const strong = sleeves.filter(s => s.status === 'Strong');
  const weak = sleeves.filter(s => s.status === 'Weak');
  const lead = verdict.stance === 'Bearish' ? weak : strong;
  const against = verdict.stance === 'Bearish' ? strong : weak;
  const confirmation = {
    statuses,
    aligned: lead.length,
    confirming: lead.map(s => `${s.label}: ${s.read}`),
    contradictions: against.map(s => `${s.label}: ${s.read}`),
    conflicting: against.map(s => s.label),
    primaryDisagreement: against.length ? `${against[0].label} says otherwise — ${against[0].read.split(' · ')[0].toLowerCase()}` : 'none — every sleeve agrees',
    mainRisk: against.length ? `if ${against[0].label.toLowerCase()} is right, the ${verdict.stance.toLowerCase()} read fails first there` : nextEr ? `the print on ${nextEr.dateLabel} — ±${nextEr.impliedMovePct.toFixed(1)}% priced` : 'a headline the wire has not seen yet',
  };

  /* THE TIMELINE — the sessions on hand, what happened on them */
  const timeline: TimelineEntry[] = [];
  days.slice(-8).forEach((d, i, arr) => {
    const when = mdy(new Date(d.time * 1000));
    const prev = arr[i - 1];
    const s = hist[hist.length - (arr.length - i)];
    if (prev && d.volume > prev.volume * 1.6) timeline.push({ when, kind: 'volume', text: `volume ${(d.volume / prev.volume).toFixed(1)}× the session before`, score: s });
    if (prev && d.close > Math.max(...arr.slice(0, i).map(x => x.high))) timeline.push({ when, kind: 'breakout', text: `closed above the prior highs at $${d.close.toFixed(2)}`, score: s });
    if (prev && Math.abs((d.close - prev.close) / prev.close) > 0.025) timeline.push({ when, kind: 'options', text: `a ${pct(((d.close - prev.close) / prev.close) * 100)} session — positioning re-set around it`, score: s });
  });
  headlines.slice(0, 3).forEach(h => timeline.push({ when: h.time, kind: 'news', text: h.headline, score: composite }));
  if (dossier && dossier.quarters.length) {
    const q = dossier.quarters[dossier.quarters.length - 1];
    timeline.push({ when: q.label, kind: 'earnings', text: `${q.epsBeat ? 'beat' : 'missed'} on EPS ($${q.epsActual.toFixed(2)} vs $${q.epsEst.toFixed(2)}) · stock ${pct(q.movePct)} next session`, score: previous });
  }

  const sensitivity = {
    weights,
    drivers: [
      { label: 'Trend', weight: 0.3, hypothetical: `RSI crossing ${rsi > 50 ? 'back under 50' : 'above 50'}`, delta: rsi > 50 ? -4 : 4 },
      { label: 'Numbers', weight: 0.25, hypothetical: 'a 5% EPS miss at the next print', delta: -6 },
      { label: 'Money', weight: 0.25, hypothetical: `dark posture flipping to ${dp.posture === 'ACCUMULATING' ? 'distributing' : 'accumulating'}`, delta: dp.posture === 'ACCUMULATING' ? -5 : 5 },
      { label: 'News', weight: 0.2, hypothetical: 'a high-impact negative headline', delta: -5 },
    ],
  };

  const timestamps: Fact[] = [
    { k: 'Price', v: hhmm(t0), note: clock.phase === 'OPEN' ? 'real-time' : 'last session' },
    { k: 'Options', v: hhmm(t0), note: 'the chain, real-time' },
    { k: 'Fundamentals', v: lastQ ? lastQ.label : mdy(t0), note: 'the last report' },
    { k: 'News', v: headlines[0]?.time ?? '—', note: 'the newest headline' },
    { k: 'Dark pool', v: dp.prints[0]?.time ?? '—', note: 'the newest dark print' },
    { k: 'Flow', v: own[0]?.time ?? '—', note: 'the newest rich print' },
    { k: 'Status', v: clock.phase === 'OPEN' ? 'real-time' : clock.phase === 'AUCTION' ? 'delayed' : 'EOD', tone: clock.phase === 'OPEN' ? 'bull' : 'plain' },
  ];

  const top = [...sleeves].sort((a, b) => Math.abs(b.score - 50) - Math.abs(a.score - 50));
  const whyNow = {
    changes: [`${top[0].label} is the loudest sleeve at ${top[0].score}`, `the score moved ${composite - previous >= 0 ? '+' : ''}${composite - previous} on the last read`, headlines[0] ? `newest headline: ${headlines[0].headline}` : 'the wire is quiet on the name', own.length ? `${money(callPrem + putPrem)} of rich option prints today` : 'no rich option prints yet today'],
    driving: `${top[0].label.toLowerCase()} — ${top[0].read.toLowerCase()}`,
    explanation: `${name} reads ${verdict.stance.toLowerCase()} at ${composite}: ${top[0].label.toLowerCase()} carries it (${top[0].read.toLowerCase()}), ${top[1].label.toLowerCase()} ${top[1].status === 'Strong' ? 'agrees' : top[1].status === 'Weak' ? 'argues' : 'is neutral'}, and the price sits ${pct(vsFair)} from fair value. ${confirmation.mainRisk.charAt(0).toUpperCase()}${confirmation.mainRisk.slice(1)}.`,
  };

  /* THE INSIDERS AND CONGRESS */
  const flow = insiderFlow(sym, 90);
  const insiders = {
    trades: flow.trades.slice(0, 8),
    bought: flow.bought,
    sold: flow.sold,
    net: flow.net,
    buyers: flow.buyerCluster,
    read: flow.openMarketBuys > 0 ? `${money(flow.openMarketBuys)} of buying someone chose to make in 90 days${flow.buyerCluster > 1 ? ` — ${flow.buyerCluster} buyers inside a month` : ''}` : flow.sold > 0 ? `${money(flow.sold)} sold in 90 days, ${money(flow.plannedValue)} of it on a plan` : 'nothing filed in 90 days',
  };
  const congressTrades = buildCongress(180)
    .trades.filter(t => t.ticker === sym)
    .map(t => ({ ...t, overlap: overlapFor(t.member, sym) }));
  const congress = {
    trades: congressTrades.slice(0, 8),
    read: congressTrades.length ? `${congressTrades.length} ${congressTrades.length === 1 ? 'report' : 'reports'} in 180 days · ${congressTrades.filter(t => t.type === 'Purchase').length} purchases · ${congressTrades.filter(t => t.overlap).length} from a member whose committee oversees the sector` : 'no member of Congress reported trading it in 180 days',
  };

  return {
    ticker: sym,
    name,
    sector,
    price,
    changePct,
    marketStatus,
    verdict,
    sleeves,
    valuation,
    options,
    darkPool,
    headlines,
    catalysts,
    composition,
    history,
    method,
    confirmation,
    timeline,
    sensitivity,
    timestamps,
    whyNow,
    insiders,
    congress,
    flow: { buys, sells, callPremium: callPrem, putPremium: putPrem },
  };
}
