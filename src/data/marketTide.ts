/*
==================================================
  SLAYER TERMINAL - THE MARKET'S OWN READ
  (data/marketTide.ts)

  What matters right now, across the whole tape.
==================================================

  THE DESK HAD FIFTEEN PANELS AND EVERY ONE OF THEM WAS ABOUT ONE NAME. A
  trader opening a terminal does not start at NVDA; they start at "what kind
  of day is this", and nothing on this desk could answer it. The indices, the
  sectors, the breadth and the movers are the four facts that do, and this is
  where they come from.

  WHERE THE NUMBERS COME FROM, honestly. The simulator tracks a handful of
  names for real — whatever has been opened this session — and steps them
  tick by tick. It does NOT track a hundred and ten sector constituents, and
  asking it to would seed a hundred and ten price histories to draw one bar
  chart. So this file does what the dark pool's leader board already does:
  the sim's own move when the sim has the name, a day-stable derived move
  otherwise, and it says which it is on every row. A reader is never told a
  derived number is a measured one.

  THE INDEX SET IS THE FOUR AND THE FEAR GAUGE. SPY, QQQ, IWM and DIA are the
  four an American equity desk actually watches, and VIX is not one of them —
  it is the price of insurance on the first. It is derived FROM the S&P's own
  move rather than rolled independently, because a VIX that drifts up on a
  green tape is not a market, it is noise wearing a ticker.
*/

import Simulator from '../core/simulator';
import { dayKey, h01, hGauss } from '../core/rng';
import { SECTOR_UNIVERSE } from './darkpool';

// ---- one name's session move ------------------------------------------------

export interface TideMove {
  ticker: string;
  last: number;
  changePct: number;
  /** True when the simulator actually tracks this name and this is its move */
  live: boolean;
}

/**
 * A name's move, without registering it.
 *
 * Deliberately NOT `Simulator.ensureTicker`: that registers the symbol AND
 * seeds a full price history for it, and a sector bar chart asking for a
 * hundred and ten of those would stall the desk to draw one panel. The names
 * the session has actually opened read live; the rest read day-stable, and
 * `live` says which.
 */
export function moveOf(ticker: string): TideMove {
  const cfg = Simulator.TICKERS[ticker];
  if (cfg) {
    return {
      ticker,
      last: cfg.currentPrice,
      changePct: cfg.basePrice > 0 ? ((cfg.currentPrice - cfg.basePrice) / cfg.basePrice) * 100 : 0,
      live: true,
    };
  }
  const day = dayKey();
  /* A gaussian, not a uniform: a day's moves cluster near flat with thin
     tails, and a flat distribution would put as many names at +4% as at
     +0.1%, which is not a market anyone has seen. */
  const changePct = Number((hGauss(`${day}-tide-${ticker}`) * 1.35).toFixed(2));
  const base = 15 + Math.pow(h01(`${day}-tidepx-${ticker}`), 1.6) * 640;
  return {
    ticker,
    last: Number((base * (1 + changePct / 100)).toFixed(2)),
    changePct,
    live: false,
  };
}

// ---- the indices ------------------------------------------------------------

export interface TideIndex extends TideMove {
  label: string;
  /** What it stands for, one line */
  what: string;
  /** VIX reads the other way round — green when it falls */
  inverse?: boolean;
}

/** SPY's beta against each of the others, so a green tape is green across the
    board rather than four independent coin flips pretending to be a market. */
const INDEX_BETA: Record<string, number> = { SPY: 1, QQQ: 1.22, IWM: 1.14, DIA: 0.86 };

const INDEX_WHAT: Record<string, string> = {
  SPY: 'The S&P 500 — the tape everything else is measured against',
  QQQ: 'The Nasdaq 100 — where the weight sits',
  IWM: 'The Russell 2000 — small caps, and the risk appetite behind them',
  DIA: 'The Dow 30 — the old-economy read',
  VIX: 'What insurance on the S&P costs — the fear gauge',
};

/**
 * The four indices and the fear gauge.
 *
 * Every index is anchored to SPY's own move through a beta rather than
 * rolled on its own hash. A day where the S&P is up 1% and the Nasdaq is
 * down 2% happens, but not on most days, and four independent random walks
 * would show it on half of them — which would make the strip a decoration
 * rather than a reading.
 */
export function buildIndices(): TideIndex[] {
  const spy = moveOf('SPY');
  const day = dayKey();
  const out: TideIndex[] = ['SPY', 'QQQ', 'IWM', 'DIA'].map(t => {
    const own = moveOf(t);
    /* A tracked name keeps its OWN move — it is the real one. An untracked
       one takes the S&P's, scaled by its beta plus a little of its own. */
    const changePct = own.live
      ? own.changePct
      : Number((spy.changePct * INDEX_BETA[t] + hGauss(`${day}-idx-${t}`) * 0.28).toFixed(2));
    return { ...own, changePct, label: t, what: INDEX_WHAT[t] };
  });

  /* VIX from the S&P's move, and MULTIPLICATIVELY, which is the shape the
     relationship actually has. A linear "minus 3.4 points per percent" is
     roughly right for a quiet day and absurd at the edges: it put the index
     at its floor on a +3% tape and past 40 on a −6% one. An exponential in
     the daily move holds at both ends — −1% takes it up a tenth, −6% takes
     it up about ninety percent, +3% takes it down about a quarter, which is
     what those days have done. Floored and capped at the range the index
     trades in outside a crisis week. */
  const vixBase = 14 + h01(`${day}-vixbase`) * 5;
  const vix = Math.max(9, Math.min(80, vixBase * Math.exp(-0.11 * spy.changePct)));
  out.push({
    ticker: 'VIX',
    label: 'VIX',
    what: INDEX_WHAT.VIX,
    last: Number(vix.toFixed(2)),
    changePct: Number((((vix - vixBase) / vixBase) * 100).toFixed(2)),
    live: false,
    inverse: true,
  });
  return out;
}

// ---- the sectors ------------------------------------------------------------

export interface TideSector {
  sector: string;
  color: string;
  /** Equal-weighted average of its names' moves, percent */
  changePct: number;
  up: number;
  down: number;
  total: number;
  leader: TideMove;
  laggard: TideMove;
  /** True when every name in it read live from the simulator */
  live: boolean;
}

/**
 * Every sector, ranked by today's move.
 *
 * EQUAL-WEIGHTED, not cap-weighted, and that is the honest choice for this
 * panel: a cap-weighted "Technology" is three names and a rounding error,
 * which tells you what NVDA did, not what technology did. The question this
 * panel answers is whether a sector is moving together, and the advancer
 * count beside the average is what says so.
 */
export function buildSectors(): TideSector[] {
  const out = SECTOR_UNIVERSE.map(cfg => {
    const moves = cfg.tickers.map(moveOf);
    const sorted = [...moves].sort((a, b) => b.changePct - a.changePct);
    const sum = moves.reduce((m, x) => m + x.changePct, 0);
    return {
      sector: cfg.sector,
      color: cfg.color,
      changePct: Number((sum / moves.length).toFixed(2)),
      up: moves.filter(m => m.changePct > 0).length,
      down: moves.filter(m => m.changePct < 0).length,
      total: moves.length,
      leader: sorted[0],
      laggard: sorted[sorted.length - 1],
      live: moves.every(m => m.live),
    };
  });
  return out.sort((a, b) => b.changePct - a.changePct);
}

// ---- the breadth ------------------------------------------------------------

export type TideTilt = 'broad advance' | 'advancing' | 'mixed' | 'declining' | 'broad decline';

export interface TideBreadth {
  up: number;
  down: number;
  flat: number;
  total: number;
  /** Advancers as a share of the names that moved, 0–100 */
  upPct: number;
  /** Advancers over decliners — the classic A/D line's ratio */
  ratio: number;
  tilt: TideTilt;
  /** Names more than 2% from flat, either way — the day's extremes */
  strongUp: number;
  strongDown: number;
  /** The widest mover each way */
  best: TideMove;
  worst: TideMove;
  /** The day's moves in buckets, deep red to deep green — the SHAPE of the
      day, which a count of advancers cannot show. 55 up against 44 down is
      the same number whether the tape is a narrow grind or a violent split,
      and those are not the same day. */
  spread: { label: string; from: number; to: number; n: number; tone: 'bull' | 'bear' | 'flat' }[];
}

const BUCKETS: { label: string; from: number; to: number; tone: 'bull' | 'bear' | 'flat' }[] = [
  { label: '≤ −3%', from: -Infinity, to: -3, tone: 'bear' },
  { label: '−3 to −2', from: -3, to: -2, tone: 'bear' },
  { label: '−2 to −1', from: -2, to: -1, tone: 'bear' },
  { label: '−1 to 0', from: -1, to: -0.05, tone: 'bear' },
  { label: 'flat', from: -0.05, to: 0.05, tone: 'flat' },
  { label: '0 to +1', from: 0.05, to: 1, tone: 'bull' },
  { label: '+1 to +2', from: 1, to: 2, tone: 'bull' },
  { label: '+2 to +3', from: 2, to: 3, tone: 'bull' },
  { label: '≥ +3%', from: 3, to: Infinity, tone: 'bull' },
];

const UNIVERSE = SECTOR_UNIVERSE.flatMap(s => s.tickers);

/**
 * How much of the market is participating.
 *
 * BREADTH IS THE FACT AN INDEX HIDES. The S&P can close up half a percent on
 * four names while three hundred fall, and the index strip says "green" both
 * ways. The advance/decline count is what tells them apart, so it gets a
 * panel rather than a line in one.
 */
export function buildBreadth(): TideBreadth {
  const moves = UNIVERSE.map(moveOf);
  const up = moves.filter(m => m.changePct > 0.05).length;
  const down = moves.filter(m => m.changePct < -0.05).length;
  const flat = moves.length - up - down;
  const moved = up + down;
  const upPct = moved > 0 ? Number(((up / moved) * 100).toFixed(1)) : 50;
  const sorted = [...moves].sort((a, b) => b.changePct - a.changePct);
  return {
    up,
    down,
    flat,
    total: moves.length,
    upPct,
    /* NO DECLINERS IS NOT A RATIO. This used to fall back to the COUNT of
       advancers, so a tape with 180 names up and none down printed "180.00"
       in the slot a reader reads as roughly two-to-one. Infinity renders as
       ∞ beside it, which is the true shape of that day. */
    ratio: down > 0 ? Number((up / down).toFixed(2)) : up > 0 ? Infinity : 0,
    tilt: upPct >= 70 ? 'broad advance' : upPct >= 56 ? 'advancing' : upPct > 44 ? 'mixed' : upPct > 30 ? 'declining' : 'broad decline',
    strongUp: moves.filter(m => m.changePct >= 2).length,
    strongDown: moves.filter(m => m.changePct <= -2).length,
    best: sorted[0],
    worst: sorted[sorted.length - 1],
    spread: BUCKETS.map(b => ({ ...b, n: moves.filter(m => m.changePct >= b.from && m.changePct < b.to).length })),
  };
}

// ---- the movers -------------------------------------------------------------

export interface TideMovers {
  gainers: TideMove[];
  losers: TideMove[];
}

/** The widest movers each way, across the same universe the breadth counts. */
export function buildMovers(n = 8): TideMovers {
  const moves = UNIVERSE.map(moveOf).sort((a, b) => b.changePct - a.changePct);
  return { gainers: moves.slice(0, n), losers: moves.slice(-n).reverse() };
}

// ---- the sentence -----------------------------------------------------------

/**
 * The market in one line, in the house's voice.
 *
 * Built from the three readings together rather than from the index alone,
 * because the interesting days are the ones where they disagree — an index
 * up with breadth against it is the sentence worth printing.
 */
export function tideRead(indices: TideIndex[], breadth: TideBreadth, sectors: TideSector[]): string {
  const spy = indices.find(i => i.ticker === 'SPY');
  const vix = indices.find(i => i.ticker === 'VIX');
  const dir = (spy?.changePct ?? 0) >= 0 ? 'up' : 'down';
  const agrees = (spy?.changePct ?? 0) >= 0 === breadth.upPct >= 50;
  const lead = sectors[0];
  const lag = sectors[sectors.length - 1];
  const head = `The S&P is ${dir} [[${Math.abs(spy?.changePct ?? 0).toFixed(2)}%]] on ${breadth.tilt}`;
  const split = agrees
    ? `${breadth.up} names up against ${breadth.down} down`
    : `but the tape disagrees — ${breadth.up} up against ${breadth.down} down`;
  const rotation = `${lead.sector} leads at [[${lead.changePct >= 0 ? '+' : ''}${lead.changePct.toFixed(2)}%]], ${lag.sector} lags at [[${lag.changePct >= 0 ? '+' : ''}${lag.changePct.toFixed(2)}%]]`;
  const fear = vix ? ` · insurance at [[${vix.last.toFixed(2)}]]` : '';
  return `${head} — ${split}. ${rotation}${fear}.`;
}
