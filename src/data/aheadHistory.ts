/*
==================================================
  SLAYER TERMINAL - WHAT THE LAST SESSIONS DID
  (data/aheadHistory.ts)

  The Ahead page's sentences used to restate the
  numbers on its charts ("the call wall at 468 is
  the lid") — the partner's review called them
  generic. A sentence should say what the chart
  cannot: how today's range, clock and odds compare
  with what price actually did in the sessions on
  hand. The simulator keeps ~22 sessions of minute
  bars and a couple of sessions of the book, and
  these are the reads off them — session by
  session, in the session's own minutes (bar i of a
  session is the open's minute + i; the simulator's
  clock is its own, not the wall's).
==================================================
*/

import Simulator from '../core/simulator';
import type { Candle } from '../types/market';

/** Bars this far apart are one session; farther is the overnight (data/replay.ts) */
const SESSION_GAP_S = 90;
const OPEN_MIN = 9 * 60 + 30;

export interface SessionStat {
  open: number;
  close: number;
  high: number;
  low: number;
  bars: Candle[];
}

const statOf = (bars: Candle[]): SessionStat => ({
  open: bars[0].open,
  close: bars[bars.length - 1].close,
  high: Math.max(...bars.map(b => b.high)),
  low: Math.min(...bars.map(b => b.low)),
  bars,
});

/** Every session on hand, oldest first */
export function sessionBlocks(ticker: string): Candle[][] {
  const all = Simulator.peekCandles(ticker);
  if (!all || all.length < 2) return [];
  const out: Candle[][] = [];
  let start = 0;
  for (let i = 1; i <= all.length; i++) {
    if (i === all.length || all[i].time - all[i - 1].time > SESSION_GAP_S) {
      out.push(all.slice(start, i));
      start = i;
    }
  }
  return out;
}

/** The last `n` COMPLETE sessions, newest first — the one under way (in session) left out */
export function recentSessions(ticker: string, n: number, inSession: boolean): SessionStat[] {
  const blocks = sessionBlocks(ticker);
  const done = inSession ? blocks.slice(0, -1) : blocks;
  return done
    .filter(b => b.length >= 60)
    .slice(-n)
    .reverse()
    .map(statOf);
}

/** A session's range from a minute of the day to its close — null when the session had not reached that minute */
export function rangeFrom(s: SessionStat, minuteOfDay: number): number | null {
  const i = Math.max(0, minuteOfDay - OPEN_MIN);
  if (i >= s.bars.length) return null;
  const tail = s.bars.slice(i);
  return Math.max(...tail.map(b => b.high)) - Math.min(...tail.map(b => b.low));
}

/** A session's move over its last `minutes` — signed, close against the bar `minutes` before it */
export function moveIntoClose(s: SessionStat, minutes: number): number | null {
  if (s.bars.length <= minutes) return null;
  return s.close - s.bars[s.bars.length - 1 - minutes].close;
}

/** The session under way — its bars so far — or null when the market is shut */
export function sessionSoFar(ticker: string, inSession: boolean): SessionStat | null {
  if (!inSession) return null;
  const blocks = sessionBlocks(ticker);
  const last = blocks[blocks.length - 1];
  return last && last.length >= 2 ? statOf(last) : null;
}

/** The heaviest strike of the book at the last complete session's end, and how far that session closed from it */
export function lastSessionSupreme(ticker: string, inSession: boolean): { strike: number; close: number; away: number } | null {
  const blocks = sessionBlocks(ticker);
  const done = inSession ? blocks.slice(0, -1) : blocks;
  const last = done[done.length - 1];
  if (!last) return null;
  const endTime = last[last.length - 1].time;
  const history = Simulator.getGexHistory(ticker) ?? [];
  let snap = null as (typeof history)[number] | null;
  for (const s of history) if (s.time <= endTime) snap = s;
  if (!snap || snap.time < last[0].time || !snap.levels.length) return null;
  const heaviest = snap.levels.reduce((a, l) => (Math.abs(l.value) > Math.abs(a.value) ? l : a));
  const close = last[last.length - 1].close;
  return { strike: heaviest.strike, close, away: Math.abs(close - heaviest.strike) };
}

/** "3 of the last 5 sessions" — "none of" and "all of" at the ends, "the last session" when there is one */
export const ofLast = (count: number, n: number) => (n === 1 ? (count === 1 ? 'the last session' : 'not the last session') : `${count === 0 ? 'none' : count === n ? 'all' : count} of the last ${n} sessions`);
