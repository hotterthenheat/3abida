/*
==================================================
  SLAYER TERMINAL - WHAT THE RECORD SAYS
  (core/paper/analytics.ts)

  A simulator that only prints P&L teaches you
  nothing you did not already feel. These are the
  figures that say HOW the number happened:

    PROFIT FACTOR   gross profit over gross loss.
                    Above 1 the winners pay for the
                    losers; at 2 they pay twice.
    EXPECTANCY      what an average trade is worth,
                    which is the only number that
                    survives being scaled.
    MAE             the heat: how far under water a
                    trade went before it worked.
                    A winner with a deep MAE was
                    nearly a loser.
    MFE             what it was worth at its best.
                    A small winner with a large MFE
                    is money left on the table, and
                    the gap between them is the
                    single most useful column in a
                    journal nobody reads.

  THE CALENDAR groups the same round trips by their
  local date so a month reads at a glance: the net,
  the count, the contracts, and whether the day was
  green.

  Pure reads over the engine's trades — nothing
  here writes anything.
==================================================
*/

import type { Trade } from './engine';

export interface Stats {
  trades: number;
  wins: number;
  losses: number;
  scratches: number;
  winRate: number;
  grossProfit: number;
  grossLoss: number;
  /** Gross profit ÷ gross loss; Infinity when nothing was lost */
  profitFactor: number;
  net: number;
  fees: number;
  slippage: number;
  /** Net ÷ trades */
  expectancy: number;
  avgWin: number;
  avgLoss: number;
  bestTrade: number;
  worstTrade: number;
  /** The deepest single-trade heat, dollars (≤ 0) */
  worstMae: number;
  /** The average heat taken on a WINNER — how close the good ones came */
  avgWinnerMae: number;
  /** The average high water on a LOSER — what was there and given back */
  avgLoserMfe: number;
  /** Realised net ÷ the best it ever was worth, across every trade */
  captureRate: number;
  /** The deepest drawdown of the running realised curve, dollars */
  maxDrawdown: number;
  volume: number;
  /** The longest run of winners and of losers */
  bestStreak: number;
  worstStreak: number;
}

const EMPTY: Stats = {
  trades: 0, wins: 0, losses: 0, scratches: 0, winRate: 0, grossProfit: 0, grossLoss: 0, profitFactor: 0,
  net: 0, fees: 0, slippage: 0, expectancy: 0, avgWin: 0, avgLoss: 0, bestTrade: 0, worstTrade: 0,
  worstMae: 0, avgWinnerMae: 0, avgLoserMfe: 0, captureRate: 0, maxDrawdown: 0, volume: 0, bestStreak: 0, worstStreak: 0,
};

export function statsOf(trades: Trade[]): Stats {
  if (trades.length === 0) return EMPTY;
  const byTime = [...trades].sort((a, b) => a.closedAt - b.closedAt);
  let grossProfit = 0;
  let grossLoss = 0;
  let fees = 0;
  let slippage = 0;
  let volume = 0;
  let wins = 0;
  let losses = 0;
  let scratches = 0;
  let worstMae = 0;
  let mfeTotal = 0;
  let winnerMaeTotal = 0;
  let loserMfeTotal = 0;
  let best = -Infinity;
  let worst = Infinity;
  let run = 0;
  let bestStreak = 0;
  let worstStreak = 0;
  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;

  for (const t of byTime) {
    const r = t.realized;
    fees += t.fees;
    slippage += t.slippage;
    volume += t.qty;
    if (r > 0) {
      grossProfit += r;
      wins++;
      winnerMaeTotal += t.mae;
      run = run > 0 ? run + 1 : 1;
    } else if (r < 0) {
      grossLoss += -r;
      losses++;
      loserMfeTotal += t.mfe;
      run = run < 0 ? run - 1 : -1;
    } else {
      scratches++;
      run = 0;
    }
    bestStreak = Math.max(bestStreak, run);
    worstStreak = Math.min(worstStreak, run);
    worstMae = Math.min(worstMae, t.mae);
    mfeTotal += Math.max(0, t.mfe);
    best = Math.max(best, r);
    worst = Math.min(worst, r);
    equity += r;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.min(maxDrawdown, equity - peak);
  }

  const net = grossProfit - grossLoss;
  return {
    trades: byTime.length,
    wins,
    losses,
    scratches,
    winRate: byTime.length ? (wins / byTime.length) * 100 : 0,
    grossProfit: round2(grossProfit),
    grossLoss: round2(grossLoss),
    profitFactor: grossLoss > 0 ? Number((grossProfit / grossLoss).toFixed(2)) : grossProfit > 0 ? Infinity : 0,
    net: round2(net),
    fees: round2(fees),
    slippage: round2(slippage),
    expectancy: round2(net / byTime.length),
    avgWin: wins ? round2(grossProfit / wins) : 0,
    avgLoss: losses ? round2(-grossLoss / losses) : 0,
    bestTrade: round2(best === -Infinity ? 0 : best),
    worstTrade: round2(worst === Infinity ? 0 : worst),
    worstMae: round2(worstMae),
    avgWinnerMae: wins ? round2(winnerMaeTotal / wins) : 0,
    avgLoserMfe: losses ? round2(loserMfeTotal / losses) : 0,
    captureRate: mfeTotal > 0 ? Number(((net / mfeTotal) * 100).toFixed(1)) : 0,
    maxDrawdown: round2(maxDrawdown),
    volume,
    bestStreak,
    worstStreak: Math.abs(worstStreak),
  };
}

const round2 = (v: number) => Number(v.toFixed(2));

/* ---- the calendar --------------------------------------------------------------------------- */

export interface DayCell {
  /** YYYY-MM-DD, local */
  key: string;
  date: Date;
  net: number;
  trades: number;
  volume: number;
  wins: number;
  losses: number;
  fees: number;
  /** The best and the worst single trade of the day */
  best: number;
  worst: number;
}

export const dayKeyOf = (at: number): string => {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Every day that has a trade on it, keyed */
export function byDay(trades: Trade[]): Map<string, DayCell> {
  const out = new Map<string, DayCell>();
  for (const t of trades) {
    const key = dayKeyOf(t.closedAt);
    const cur = out.get(key) ?? { key, date: new Date(t.closedAt), net: 0, trades: 0, volume: 0, wins: 0, losses: 0, fees: 0, best: -Infinity, worst: Infinity };
    cur.net += t.realized;
    cur.trades += 1;
    cur.volume += t.qty;
    cur.fees += t.fees;
    if (t.realized > 0) cur.wins += 1;
    else if (t.realized < 0) cur.losses += 1;
    cur.best = Math.max(cur.best, t.realized);
    cur.worst = Math.min(cur.worst, t.realized);
    out.set(key, cur);
  }
  for (const c of out.values()) {
    c.net = round2(c.net);
    c.fees = round2(c.fees);
    c.best = c.best === -Infinity ? 0 : round2(c.best);
    c.worst = c.worst === Infinity ? 0 : round2(c.worst);
  }
  return out;
}

/** The weeks of a month as a 7-wide grid, Sunday first, with the days that fall outside it as null */
export function monthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const days = new Date(year, month + 1, 0).getDate();
  const lead = first.getDay();
  const cells: (Date | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= days; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/** One trade's excursion as a share of what it made — for the MAE/MFE bars */
export interface Excursion {
  trade: Trade;
  /** How deep it went under, as a share of the worst on the board */
  maeShare: number;
  /** How high it got, as a share of the best on the board */
  mfeShare: number;
  /** Realised against the high water, 0..1 — what was actually taken */
  capture: number;
}

export function excursions(trades: Trade[]): Excursion[] {
  const worstMae = Math.min(...trades.map(t => t.mae), 0);
  const bestMfe = Math.max(...trades.map(t => t.mfe), 0);
  return trades.map(trade => ({
    trade,
    maeShare: worstMae < 0 ? trade.mae / worstMae : 0,
    mfeShare: bestMfe > 0 ? trade.mfe / bestMfe : 0,
    capture: trade.mfe > 0 ? Math.max(0, Math.min(1, trade.realized / trade.mfe)) : 0,
  }));
}
