import { pickFlip, pickWalls } from '../core/walls';
import { sessionStarts } from './indicators';
import type { Candle, GexSnapshot } from '../types/market';

/*
==================================================
  SLAYER TERMINAL - THE TIME MACHINE (data/timeMachine.ts)

  GEX history, actually built — P-20.
==================================================

  THE PAGE HAS CARRIED THREE "MODULE SCHEDULED" PLACEHOLDERS SINCE LAUNCH.
  Everything they need has been in the buffer the whole time: the snapshot
  history holds per-strike gamma at every bar, and the bars hold the session
  cut. This is those three modules.

    HIST_01  LEVEL MIGRATION — the walls, the flip and the supreme through a
             session. Not "roughly where the levels were": each point is
             re-picked from that snapshot with the SAME pickWalls and
             pickFlip the live map uses, so a historical wall means exactly
             what today's wall means.

    HIST_02  STRIKE × TIME — gamma LEVEL per strike per time bucket, so a
             reader watches a wall build and decay. Deliberately the level
             and not the change: P-8's ΔOI grid already answers "what moved",
             and two surfaces answering the same question in different units
             is how a desk starts disagreeing with itself.

    HIST_03  THE SESSION INDEX — which days are in the buffer and where each
             one starts and ends, so a scrubber has something real to scrub
             over. Sessions come from the bars' own gap cut, the same one
             every session feature on this desk uses.

  ONE RULE THROUGHOUT: NOTHING IS INTERPOLATED. A session with no snapshots
  reports none rather than a smooth line through nothing, and a scrub to a
  moment between snapshots lands on the nearest RECORDED one rather than an
  invented reading. A time machine that makes up the past is a worse tool
  than one that admits its gaps.
*/

export interface MigrationPoint {
  time: number;
  /** The spot each level was picked against — emitted so HIST_01 can ride
      Wall Drift's own chart, which draws spot alongside the levels. */
  spot: number;
  callWall: number | null;
  putWall: number | null;
  flip: number | null;
  supreme: number | null;
}

export interface SessionSpan {
  /** Index in the returned session list, 0 = oldest in the buffer. */
  index: number;
  /** First and last bar times of the session. */
  from: number;
  to: number;
  /** Snapshots recorded inside it. */
  snapshots: number;
}

/** The sessions the buffer actually holds, oldest first. */
export function sessionSpans(bars: readonly Candle[], snaps: readonly GexSnapshot[]): SessionSpan[] {
  const starts = sessionStarts(bars, 1);
  if (starts.length === 0 || bars.length === 0) return [];
  return starts.map((s, i) => {
    const from = bars[s].time;
    const to = i + 1 < starts.length ? bars[starts[i + 1] - 1].time : bars[bars.length - 1].time;
    return {
      index: i,
      from,
      to,
      snapshots: snaps.filter(sn => sn.time >= from && sn.time <= to).length,
    };
  });
}

/**
 * HIST_01 — the levels through one session.
 *
 * Spot is needed because walls and the flip are side-of-spot reads. It is
 * taken from the bar closest to each snapshot rather than from today's
 * price: a historical level picked against the CURRENT spot would be a
 * level that never existed.
 */
export function levelMigration(
  snaps: readonly GexSnapshot[],
  bars: readonly Candle[],
  span?: SessionSpan
): MigrationPoint[] {
  const inSpan = span ? snaps.filter(s => s.time >= span.from && s.time <= span.to) : [...snaps];
  if (inSpan.length === 0 || bars.length === 0) return [];

  /* Bars are time-ordered, so the spot at a moment is a binary search. */
  const spotAt = (t: number): number => {
    let lo = 0;
    let hi = bars.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (bars[mid].time < t) lo = mid + 1;
      else hi = mid;
    }
    if (lo > 0 && Math.abs(bars[lo - 1].time - t) < Math.abs(bars[lo].time - t)) lo -= 1;
    return bars[lo].close;
  };

  return inSpan.map(s => {
    const spot = spotAt(s.time);
    const book = s.levels.map(l => ({ strike: l.strike, netGex: l.value }));
    const w = pickWalls(book, spot, n => n.netGex);
    let supreme: number | null = null;
    let mag = 0;
    for (const l of book) {
      if (Math.abs(l.netGex) > mag) {
        mag = Math.abs(l.netGex);
        supreme = l.strike;
      }
    }
    return {
      time: s.time,
      spot,
      callWall: w.callWall ?? null,
      putWall: w.putWall ?? null,
      flip: pickFlip(book, spot, n => n.netGex),
      supreme,
    };
  });
}

export interface HeatCell {
  time: number;
  netGex: number;
}
export interface HeatRow {
  strike: number;
  cells: HeatCell[];
}
export interface StrikeTimeHeat {
  rows: HeatRow[];
  columns: number[];
  maxAbs: number;
}

/**
 * HIST_02 — gamma LEVEL per strike per bucket.
 *
 * A bucket takes the LAST snapshot inside it, not an average: these are
 * point-in-time readings of a book, and averaging two states of a book
 * produces a book that never existed. The last reading is a real one.
 */
export function strikeTimeHeat(
  snaps: readonly GexSnapshot[],
  span: SessionSpan | undefined,
  buckets = 10
): StrikeTimeHeat {
  const empty: StrikeTimeHeat = { rows: [], columns: [], maxAbs: 0 };
  const inSpan = span ? snaps.filter(s => s.time >= span.from && s.time <= span.to) : [...snaps];
  if (inSpan.length === 0 || buckets < 1) return empty;

  const first = inSpan[0].time;
  const last = inSpan[inSpan.length - 1].time;
  const width = Math.max(1, last - first) / buckets;
  const columns = Array.from({ length: buckets }, (_, i) => Math.round(first + i * width));

  const strikes = new Set<number>();
  for (const s of inSpan) for (const l of s.levels) strikes.add(l.strike);

  let maxAbs = 0;
  const rows: HeatRow[] = [...strikes]
    .sort((a, b) => b - a)
    .map(strike => ({
      strike,
      cells: columns.map((colStart, i) => {
        const colEnd = i + 1 < columns.length ? columns[i + 1] : last + 1;
        const within = inSpan.filter(s => s.time >= colStart && s.time < colEnd);
        const chosen = within.length > 0 ? within[within.length - 1] : null;
        const v = chosen ? (chosen.levels.find(l => l.strike === strike)?.value ?? 0) : 0;
        if (Math.abs(v) > maxAbs) maxAbs = Math.abs(v);
        return { time: colStart, netGex: v };
      }),
    }));

  return { rows, columns, maxAbs };
}

/**
 * HIST_03 — the snapshot nearest a moment, or null.
 *
 * NEAREST RECORDED, never interpolated: a scrubber landing between two
 * snapshots must show one that happened, not an average of two that did.
 */
export function snapshotAt(snaps: readonly GexSnapshot[], time: number): GexSnapshot | null {
  if (snaps.length === 0) return null;
  let best: GexSnapshot | null = null;
  let bestD = Infinity;
  for (const s of snaps) {
    const d = Math.abs(s.time - time);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

/** What a session's migration says, in a line. */
export function migrationWords(points: readonly MigrationPoint[]): string {
  if (points.length === 0) return 'No snapshots recorded for this session';
  const firstFlip = points.find(p => p.flip !== null)?.flip ?? null;
  const lastFlip = [...points].reverse().find(p => p.flip !== null)?.flip ?? null;
  if (firstFlip === null || lastFlip === null) return `${points.length} snapshots — the book was one-sided, so there was no flip to track`;
  const moved = lastFlip - firstFlip;
  if (Math.abs(moved) < 1e-9) return `The flip held at ${firstFlip.toFixed(2)} for the whole session.`;
  return `The flip migrated ${Math.abs(moved).toFixed(2)} ${moved > 0 ? 'up' : 'down'}, from ${firstFlip.toFixed(2)} to ${lastFlip.toFixed(2)} — the level a reader anchored to at the open was not the level at the close.`;
}
