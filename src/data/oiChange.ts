/*
==================================================
  SLAYER TERMINAL - OPEN INTEREST CHANGE BY STRIKE
  (data/oiChange.ts)

  The ideas' rank 6, 2026-10-09 (after SpotGamma's
  strike plot of open interest and its change): open
  interest is counted once a day, after the close.
  What changed between the last two counts says
  where positions were opened and closed overnight —
  the walls a day before the hedging is read off
  them. Per strike, calls and puts apart: contracts
  at the last close, and the change from the close
  before.

  Read off the book's own history: the last snapshot
  of each session on the tape carries both legs'
  open interest at every strike (core/simulator.ts).
  With a feed it is the vendor's two daily counts.
==================================================
*/

import Simulator from '../core/simulator';
import { sessionStarts } from './indicators';
import { nyDay } from '../core/nyTime';
import type { GexSnapshot } from '../types/market';

export interface OiChangeRow {
  strike: number;
  /** Contracts at the last close */
  calls: number;
  puts: number;
  /** Contracts added since the close before (negative = closed out) */
  dCalls: number;
  dPuts: number;
}

export interface OiChange {
  ticker: string;
  spot: number;
  /** "Oct 8" — the session whose close is counted */
  last: string;
  /** "Oct 7" — the one it is measured against */
  before: string;
  /** Ascending */
  rows: OiChangeRow[];
  /** The largest |change| of either leg, for the bars' scale */
  maxAbs: number;
  addedCalls: number;
  addedPuts: number;
  /** The strike that gained the most of either leg */
  most: { strike: number; side: 'calls' | 'puts'; contracts: number } | null;
  sentence: string;
}

const fmtK = (n: number) => {
  const a = Math.abs(n);
  const s = a >= 10_000 ? `${(a / 1000).toFixed(0)}K` : a >= 1000 ? `${(a / 1000).toFixed(1)}K` : `${Math.round(a)}`;
  return `${n < 0 ? '−' : '+'}${s}`;
};
const fmtStrike = (v: number) => (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2));

/** The last snapshot at or before a bar time */
function snapAt(snaps: readonly GexSnapshot[], t: number): GexSnapshot | null {
  let lo = 0;
  let hi = snaps.length - 1;
  let best: GexSnapshot | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (snaps[mid].time <= t) {
      best = snaps[mid];
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return best;
}

/**
 * Open interest at the last close against the close before, strike by strike. Null until the tape holds three
 * sessions (today and two closes behind it) or the history carries no open interest.
 */
export function oiChangeByStrike(ticker: string, spot: number): OiChange | null {
  const bars = Simulator.peekCandles(ticker);
  const snaps = Simulator.getGexHistory(ticker) ?? [];
  if (!bars || bars.length < 3 || !snaps.length) return null;
  const starts = sessionStarts(bars, 1);
  /* the trailing run is today's; the two runs before it closed the last two counts */
  if (starts.length < 3) return null;
  const lastEnd = bars[starts[starts.length - 1] - 1].time;
  const beforeEnd = bars[starts[starts.length - 2] - 1].time;
  const a = snapAt(snaps, lastEnd);
  const b = snapAt(snaps, beforeEnd);
  if (!a || !b || a === b) return null;
  if (!a.levels.some(l => l.callOI !== undefined)) return null;
  const prev = new Map(b.levels.map(l => [l.strike, l]));
  const rows: OiChangeRow[] = [];
  let maxAbs = 1;
  let addedCalls = 0;
  let addedPuts = 0;
  let most: OiChange['most'] = null;
  for (const l of [...a.levels].sort((x, y) => x.strike - y.strike)) {
    const p = prev.get(l.strike);
    const calls = l.callOI ?? 0;
    const puts = l.putOI ?? 0;
    const dCalls = calls - (p?.callOI ?? 0);
    const dPuts = puts - (p?.putOI ?? 0);
    rows.push({ strike: l.strike, calls, puts, dCalls, dPuts });
    maxAbs = Math.max(maxAbs, Math.abs(dCalls), Math.abs(dPuts));
    addedCalls += dCalls;
    addedPuts += dPuts;
    if (dCalls > 0 && (!most || dCalls > most.contracts)) most = { strike: l.strike, side: 'calls', contracts: dCalls };
    if (dPuts > 0 && (!most || dPuts > most.contracts)) most = { strike: l.strike, side: 'puts', contracts: dPuts };
  }
  const last = nyDay(lastEnd * 1000);
  const before = nyDay(beforeEnd * 1000);
  const sentence = `Between ${before}'s close and ${last}'s, ${fmtK(addedCalls)} call contracts and ${fmtK(addedPuts)} put contracts were added across these strikes${
    most ? `; the most went into the ${fmtStrike(most.strike)} ${most.side === 'calls' ? 'calls' : 'puts'}, ${fmtK(most.contracts)}` : ''
  }. Open interest is counted once a day, after the close — a strike that gained it overnight is where a wall can stand before the day's hedging shows it.`;
  return { ticker, spot, last, before, rows, maxAbs, addedCalls, addedPuts, most, sentence };
}
