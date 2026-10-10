/*
==================================================
  SLAYER TERMINAL - WHAT HAPPENED AFTER THE FLAG
  (data/followThrough.ts)

  A record that counts the misses (the ideas report,
  2026-10-09, idea 4): every print the desk's and
  the reader's watchers flagged today, not only the
  ones a reader kept, and whether the stock moved
  the print's way from the minute it was flagged to
  now (or to the close, once the session is done).

  Said as "N of M" and nothing else — never a rate,
  a score or a win. A flagged print's WAY is read
  off its side and right: a call at the ask or a
  put on the bid leans up, a put at the ask or a
  call on the bid leans down. A move under
  FLAT_PCT either way is "barely moved", and it is
  counted, not dropped.

  The stock's path: the name's own one-minute bars
  where the terminal has them, laid on the session's
  minutes end to end; else a path drawn for the day
  that ends on the name's quote. The figures say only
  what the path says.
==================================================
*/

import Simulator from '../core/simulator';
import { h01 } from '../core/rng';
import { SESSION_LENGTH_MIN, SESSION_OPEN_MIN } from '../core/nyTime';
import { bookSession, type Catch } from './flowBook';

/** A move smaller than this, either way, is "barely moved" */
export const FLAT_PCT = 0.05;

export type FollowWay = 'with' | 'against' | 'flat';

export interface Follow {
  c: Catch;
  /** The way the print leans: +1 up, −1 down */
  dir: 1 | -1;
  /** The stock when the print was flagged, and now (or at the close) */
  from: number;
  to: number;
  /** Signed move, % */
  movePct: number;
  way: FollowWay;
}

export interface FollowRecord {
  rows: Follow[];
  total: number;
  with: number;
  against: number;
  flat: number;
  /** The session is done: the moves run to the close */
  closed: boolean;
}

const paths = new Map<string, number[]>();

/** The name's price at each minute of the session, 0 = 09:30, ending at the book's minute on `last` */
function pathOf(ticker: string, last: number, nowIdx: number, day: string, iv: number): number[] {
  const key = `${day}-${ticker}-${nowIdx}-${last.toFixed(2)}`;
  const hit = paths.get(key);
  if (hit) return hit;
  const out = new Array<number>(SESSION_LENGTH_MIN + 1).fill(last);
  const bars = Simulator.peekCandles(ticker);
  if (bars && bars.length > 1) {
    const tail = bars.slice(-(nowIdx + 1));
    const lead = nowIdx + 1 - tail.length;
    for (let i = 0; i <= nowIdx; i++) out[i] = tail[Math.max(0, i - lead)]?.close ?? last;
  } else {
    /* walked back from the quote a minute at a time — the day's own draws, so it is the same path all day */
    const sigma = Math.max(0.05, iv) / Math.sqrt(252 * SESSION_LENGTH_MIN);
    let p = last;
    out[nowIdx] = p;
    for (let i = nowIdx - 1; i >= 0; i--) {
      p = p / (1 + (h01(`${day}-ft-${ticker}-${i}`) - 0.5) * 2 * sigma * 1.7);
      out[i] = p;
    }
  }
  if (paths.size > 400) paths.clear();
  paths.set(key, out);
  return out;
}

export function followThrough(catches: Catch[]): FollowRecord {
  const s = bookSession();
  const day = `${s.year}-${s.month}-${s.day}`;
  const nowIdx = Math.max(0, Math.min(SESSION_LENGTH_MIN, s.minute - SESSION_OPEN_MIN));
  const rows: Follow[] = [];
  for (const c of catches) {
    const dir: 1 | -1 = (c.row.right === 'C') === (c.side === 'ASK') ? 1 : -1;
    const iv = (Simulator.TICKERS[c.row.ticker]?.iv ?? c.row.iv / 100) || 0.3;
    const path = pathOf(c.row.ticker, c.row.spot, nowIdx, day, iv);
    const at = Math.max(0, Math.min(nowIdx, c.minute - SESSION_OPEN_MIN));
    const from = path[at];
    const to = path[nowIdx];
    const movePct = from > 0 ? ((to - from) / from) * 100 : 0;
    const way: FollowWay = Math.abs(movePct) < FLAT_PCT ? 'flat' : Math.sign(movePct) === dir ? 'with' : 'against';
    rows.push({ c, dir, from, to, movePct, way });
  }
  return {
    rows,
    total: rows.length,
    with: rows.filter(r => r.way === 'with').length,
    against: rows.filter(r => r.way === 'against').length,
    flat: rows.filter(r => r.way === 'flat').length,
    closed: !s.live,
  };
}
