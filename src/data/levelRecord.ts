/*
==================================================
  SLAYER TERMINAL - RECORDS THAT COUNT THE MISSES
  (data/levelRecord.ts)

  The ideas' rank 4, 2026-10-09. "How the levels held
  today" is one session; a hit on one day proves
  nothing ("with six levels, price will hit one by
  chance"). So each named level gets its record over
  every past session the tape holds, misses counted:

    the level   the call wall, the put wall and the
                flip as the book stood at each
                session's open, tested with At the
                wall's own rule (a visit; held if no
                close went beyond it before it left)
                — "held in N of the M sessions it was
                tested"
    the chance  the same test on a strike the same
                distance from the open, on the same
                side, in every OTHER session — what
                an arbitrary level as far away does
                on this tape — "a strike as far away
                held n of m"

  Counts, never a rate or a score. They carry weight
  once real history flows; until then they say what
  the tape on hand says.
==================================================
*/

import Simulator from '../core/simulator';
import { pickFlip, pickWalls } from '../core/walls';
import { sessionStarts } from './indicators';
import { testEvents, type WallSide } from './wall';
import { nyDay } from '../core/nyTime';
import type { Candle, GexSnapshot } from '../types/market';

export type RecordKey = 'call' | 'put' | 'flip';

export interface Tally {
  /** Sessions the strike was reached in */
  tested: number;
  /** Of those, the sessions it held through */
  held: number;
}

export interface LevelRecord {
  key: RecordKey;
  /** The level, session by session */
  level: Tally;
  /** A strike as far from the open, same side, in the other sessions */
  chance: Tally;
}

export interface LevelRecords {
  ticker: string;
  /** Past sessions read */
  sessions: number;
  /** "Sep 9" – "Oct 8" */
  from: string;
  to: string;
  call: LevelRecord;
  put: LevelRecord;
  flip: LevelRecord;
}

interface Past {
  bars: Candle[];
  open: number;
  levels: { call: number | null; put: number | null; flip: number | null };
}

const snapAtOrAfter = (snaps: readonly GexSnapshot[], t: number): GexSnapshot | null => {
  let lo = 0;
  let hi = snaps.length - 1;
  let best: GexSnapshot | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (snaps[mid].time >= t) {
      best = snaps[mid];
      hi = mid - 1;
    } else lo = mid + 1;
  }
  return best;
};

/** A session's outcome at one strike: reached, and held through every visit */
const outcome = (bars: readonly Candle[], strike: number, side: WallSide): { tested: boolean; held: boolean } => {
  const e = testEvents(bars, strike, side);
  return { tested: e.tests > 0, held: e.tests > 0 && e.broke === 0 };
};

const cache = new Map<string, LevelRecords | null>();

/**
 * Every past session on the tape, its levels at the open, and how each held — beside a strike as far away. Null until
 * the tape holds two closed sessions.
 */
export function levelRecords(ticker: string): LevelRecords | null {
  const t = ticker.toUpperCase();
  const bars = Simulator.peekCandles(t);
  const snaps = Simulator.getGexHistory(t) ?? [];
  if (!bars || bars.length < 10 || !snaps.length) return null;
  const starts = sessionStarts(bars, 1);
  /* the trailing run is today's — the record is the sessions that closed */
  const closed = starts.length - 1;
  if (closed < 2) return null;
  const key = `${t}|${closed}|${bars[starts[starts.length - 1] - 1].time}`;
  if (cache.has(key)) return cache.get(key) ?? null;

  const step = Simulator.TICKERS[t]?.step ?? 1;
  const past: Past[] = [];
  for (let s = 0; s < closed; s++) {
    const a = starts[s];
    const b = starts[s + 1];
    const run = bars.slice(a, b);
    if (run.length < 10) continue;
    const snap = snapAtOrAfter(snaps, run[0].time);
    if (!snap || snap.time > run[run.length - 1].time) continue;
    const open = run[0].open;
    const pts = snap.levels;
    const w = pickWalls(pts, open, p => p.value);
    past.push({ bars: run, open, levels: { call: w.callWall, put: w.putWall, flip: pickFlip(pts, open, p => p.value) } });
  }
  if (past.length < 2) {
    cache.set(key, null);
    return null;
  }

  const sideOf = (k: RecordKey, level: number, open: number): WallSide => (k === 'call' ? 'call' : k === 'put' ? 'put' : level >= open ? 'call' : 'put');
  const recordOf = (k: RecordKey): LevelRecord => {
    const level: Tally = { tested: 0, held: 0 };
    const chance: Tally = { tested: 0, held: 0 };
    past.forEach((p, i) => {
      const L = p.levels[k];
      if (L == null) return;
      const side = sideOf(k, L, p.open);
      const o = outcome(p.bars, L, side);
      if (o.tested) {
        level.tested++;
        if (o.held) level.held++;
      }
      /* the same distance from every other session's open, on the strike grid */
      const d = L - p.open;
      past.forEach((q, j) => {
        if (j === i) return;
        const K = Math.round((q.open + d) / step) * step;
        const c = outcome(q.bars, K, side);
        if (c.tested) {
          chance.tested++;
          if (c.held) chance.held++;
        }
      });
    });
    return { key: k, level, chance };
  };

  const out: LevelRecords = {
    ticker: t,
    sessions: past.length,
    from: nyDay(past[0].bars[0].time * 1000),
    to: nyDay(past[past.length - 1].bars[0].time * 1000),
    call: recordOf('call'),
    put: recordOf('put'),
    flip: recordOf('flip'),
  };
  if (cache.size > 40) cache.clear();
  cache.set(key, out);
  return out;
}

/** "held in 9 of the 14 sessions it was reached" — counts, never a rate */
export const tallyWords = (x: Tally, what = 'sessions'): string => (x.tested === 0 ? `not reached in any of the ${what}` : `held ${x.held} of ${x.tested}`);
