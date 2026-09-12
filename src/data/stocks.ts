/*
==================================================
  SLAYER TERMINAL - COMMON STOCKS ENGINE (stocks.ts)
  Ranks the shared universe on four sleeves —
  momentum, quality, flow and news — then rolls the
  same sleeves up into a sector rotation board, so
  "what to buy" and "which sectors are worth being
  in" come from one composite, not two opinions.
==================================================
*/

import { dayKey, hGauss, hRange } from '../core/rng';
import { tickerSentiment } from './news';
import { SECTORS, UNIVERSE, type Sector } from './universe';

export type StockVerdict = 'ACCUMULATE' | 'HOLD' | 'AVOID';
export type SectorVerdict = 'OVERWEIGHT' | 'NEUTRAL' | 'UNDERWEIGHT';
export type RotationPhase = 'LEADING' | 'IMPROVING' | 'WEAKENING' | 'LAGGING';

export interface StockSleeves {
  /** All 0–100 */
  momentum: number;
  quality: number;
  flow: number;
  news: number;
}

export interface StockPick {
  ticker: string;
  name: string;
  sector: Sector;
  price: number;
  changePct: number;
  sleeves: StockSleeves;
  composite: number;
  verdict: StockVerdict;
  /** The read in plain words — what is for the name, what is against it */
  thesis: string;
  /** 30 points of relative-strength history for the sparkline */
  trend: number[];
}

export interface SectorRow {
  sector: Sector;
  /** Composite of member stocks, 0–100 */
  score: number;
  /** 1-week relative strength vs the tape, signed % */
  rs1w: number;
  /** 1-month relative strength, signed % */
  rs1m: number;
  /** % of members above their trend */
  breadthPct: number;
  phase: RotationPhase;
  verdict: SectorVerdict;
  note: string;
  leaders: string[];
}

// ---- sleeves ------------------------------------------------------------------

const SLEEVE_WEIGHTS = { momentum: 0.32, quality: 0.24, flow: 0.26, news: 0.18 } as const;

function sleevesFor(ticker: string, day: string): StockSleeves {
  const s = (tag: string) => `${ticker}-${day}-stk-${tag}`;
  return {
    momentum: Math.round(hRange(s('mom'), 18, 96)),
    quality: Math.round(hRange(s('qual'), 25, 94)),
    flow: Math.round(hRange(s('flow'), 15, 95)),
    news: Math.round(50 + tickerSentiment(ticker) * 48),
  };
}

function composite(sl: StockSleeves): number {
  return Math.round(
    sl.momentum * SLEEVE_WEIGHTS.momentum +
      sl.quality * SLEEVE_WEIGHTS.quality +
      sl.flow * SLEEVE_WEIGHTS.flow +
      sl.news * SLEEVE_WEIGHTS.news
  );
}

/** The four sleeves in plain words (the Record walk, 2026-09-10): the trend,
    the numbers, the money, the news — what each says when it is for a name
    and when it is against it. The figures stay inside the engine. */
const SLEEVE_WORDS: Record<keyof StockSleeves, { name: string; good: string; bad: string }> = {
  momentum: { name: 'the trend', good: 'the trend is up', bad: 'the trend is broken' },
  quality: { name: 'the numbers', good: 'the numbers are clean', bad: 'the numbers are slipping' },
  flow: { name: 'the money', good: 'the money is buying', bad: 'the money is selling' },
  news: { name: 'the news', good: 'the news helps', bad: 'the news hurts' },
};

/** The read: what is for the name, what is against it, the soft spot — short
    enough for a grid cell. States, not orders: it says what the screen SAYS,
    never what to do about it (the Compass doctrine). */
function thesisFor(sl: StockSleeves, verdict: StockVerdict): string {
  const ranked = (Object.keys(SLEEVE_WORDS) as (keyof StockSleeves)[]).map(k => ({ v: sl[k], ...SLEEVE_WORDS[k] })).sort((a, b) => b.v - a.v);
  const [best, second] = ranked;
  const worst = ranked[ranked.length - 1];
  const next = ranked[ranked.length - 2];
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  if (verdict === 'ACCUMULATE') return cap(`${best.good}, ${second.good}; ${worst.v < 45 ? `${worst.name} is the one soft spot` : 'nothing against it'}.`);
  if (verdict === 'AVOID') return cap(`${worst.bad}, ${next.bad}; ${best.v > 65 ? `${best.name} alone cannot carry it` : 'nothing in its favour'}.`);
  return cap(`${best.good} but ${worst.bad} — a catalyst decides.`);
}

// ---- public API ------------------------------------------------------------------

export function buildStockBoard(): StockPick[] {
  const day = dayKey();
  return UNIVERSE.map(u => {
    const sl = sleevesFor(u.ticker, day);
    const comp = composite(sl);
    const verdict: StockVerdict = comp >= 68 ? 'ACCUMULATE' : comp <= 46 ? 'AVOID' : 'HOLD';
    const changePct = hGauss(`${u.ticker}-${day}-chg`) * 1.4 * u.beta + (comp - 55) * 0.02;
    const trend: number[] = [];
    let level = 50;
    for (let i = 0; i < 30; i++) {
      level += hGauss(`${u.ticker}-${day}-tr-${i}`) * 3 + (comp - 55) * 0.06;
      trend.push(level);
    }
    return {
      ticker: u.ticker,
      name: u.name,
      sector: u.sector,
      price: Number((u.px * (1 + changePct / 100)).toFixed(2)),
      changePct,
      sleeves: sl,
      composite: comp,
      verdict,
      thesis: thesisFor(sl, verdict),
      trend,
    };
  }).sort((a, b) => b.composite - a.composite);
}

export function buildSectorBoard(picks: StockPick[]): SectorRow[] {
  const day = dayKey();
  return SECTORS.map(sector => {
    const members = picks.filter(p => p.sector === sector);
    const score = Math.round(members.reduce((a, p) => a + p.composite, 0) / Math.max(members.length, 1));
    const rs1w = hGauss(`${sector}-${day}-rs1w`) * 1.2 + (score - 55) * 0.05;
    const rs1m = hGauss(`${sector}-${day}-rs1m`) * 2.2 + (score - 55) * 0.09;
    const breadthPct = Math.round(
      (members.filter(p => p.sleeves.momentum > 50).length / Math.max(members.length, 1)) * 100
    );
    const phase: RotationPhase =
      rs1m >= 0 && rs1w >= 0 ? 'LEADING' : rs1m < 0 && rs1w >= 0 ? 'IMPROVING' : rs1m >= 0 && rs1w < 0 ? 'WEAKENING' : 'LAGGING';
    const verdict: SectorVerdict = score >= 64 && phase !== 'LAGGING' ? 'OVERWEIGHT' : score <= 48 || phase === 'LAGGING' ? 'UNDERWEIGHT' : 'NEUTRAL';
    const leaders = members.slice(0, 2).map(m => m.ticker);
    const note =
      verdict === 'OVERWEIGHT'
        ? `${phase === 'LEADING' ? 'Leadership intact' : 'Turning up'} — money is rotating in; ${leaders.join(' & ')} carry the group.`
        : verdict === 'UNDERWEIGHT'
          ? `${phase === 'LAGGING' ? 'Lagging on both windows' : 'Rolling over'} — relative strength argues against fresh exposure.`
          : 'Middle of the pack — own the single names that screen well, not the group.';
    return { sector, score, rs1w, rs1m, breadthPct, phase, verdict, note, leaders };
  }).sort((a, b) => b.score - a.score || phaseRank(b.phase) - phaseRank(a.phase));
}

function phaseRank(p: RotationPhase): number {
  return p === 'LEADING' ? 3 : p === 'IMPROVING' ? 2 : p === 'WEAKENING' ? 1 : 0;
}
