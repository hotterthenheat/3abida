import type { FlowPrint } from '../types/trace';
import { bucketFlow } from './flowBars';

/*
==================================================
  SLAYER TERMINAL - THE PREMIUM DRIFT
  (data/driftSeries.ts)

  Two running totals: every dollar of call premium
  that has printed today, and every dollar of put
  premium. Drawn against the tape they came from,
  the gap between the two lines IS the session's
  lean, and the SLOPE of each is where the money is
  arriving right now.

  WHY CUMULATIVE AND NOT PER-BAR. The flow band
  already draws per-bar premium, and per-bar answers
  "is this minute busy". It cannot answer "who has
  been buying all morning", because a steady bid
  looks identical to no bid at all once each bar is
  measured on its own. A running total keeps the
  morning in the picture at 3pm.

  THIS INVENTS NOTHING. It sums `bucketFlow`, which
  sums Trace's accumulated prints. Three surfaces —
  the tape desk, the flow band, this — now read one
  tape, so they cannot end up quoting different
  premium for the same session.

  THE LIMIT, STATED PLAINLY: the tape begins
  accumulating when the app opens. A running total
  that starts at 10:41 is a running total FROM 10:41,
  not from the bell, and it will read low against a
  vendor's figure until a real feed backfills the
  session. Nothing here pretends otherwise — the
  first point is the first print we actually saw.
==================================================
*/

/** One instant on the two running totals. */
export interface DriftPoint {
  /** Bar-aligned epoch SECONDS — lightweight-charts' unit. */
  time: number;
  /** Call premium since the first print, dollars. Non-decreasing. */
  calls: number;
  /** Put premium since the first print, dollars. Non-decreasing. */
  puts: number;
}

export interface DriftOptions {
  /** Bar width in seconds. Must match the chart's own interval. */
  barSec: number;
  /** Only prints on this symbol. Omit to take every print given. */
  ticker?: string;
  /** Drop prints before this epoch ms — the chart's left edge. */
  fromMs?: number;
}

/*
  A CEILING ON THE FILLED BARS.

  The gap fill below walks bar by bar from the first print to the last, so a
  tape holding two prints four hours apart on a 1m clock costs 240 points —
  nothing. But `barSec` arrives from a timeframe the caller chose and `at`
  arrives from a feed, and one absurd timestamp would otherwise ask this to
  materialise an unbounded array before anyone could notice.

  Above the ceiling the fill is skipped and the sparse buckets are returned as
  they are. The line then slopes across the gap instead of stepping, which is
  the wrong picture — but a wrong picture is recoverable and an out-of-memory
  page is not, and the ceiling is set far above any real session.
*/
const MAX_FILLED_POINTS = 5000;

/**
 * Running call/put premium totals, one point per bar.
 *
 * EVERY BAR BETWEEN THE FIRST AND LAST PRINT GETS A POINT, including the quiet
 * ones — and that is the opposite of what `bucketFlow` does, on purpose. An
 * absent bar in a histogram draws nothing, which is correct: nothing traded.
 * An absent bar in a LINE draws a straight segment from the last point to the
 * next one, which would show premium arriving smoothly through a lunch hour
 * when in fact none arrived at all. Holding the total flat across the gap is
 * the only shape that says what happened.
 *
 * Returns [] when nothing usable is in the tape — an empty pane, not a zero
 * line, because a zero line asserts a session in which nobody traded.
 */
export function cumulativeDrift(
  prints: readonly (FlowPrint & { at?: number })[],
  options: DriftOptions
): DriftPoint[] {
  const barSec = Math.max(1, Math.floor(options.barSec));
  const bars = bucketFlow(prints, { ...options, barSec });
  if (bars.length === 0) return [];

  const span = (bars[bars.length - 1].time - bars[0].time) / barSec + 1;
  const fill = span <= MAX_FILLED_POINTS;

  const out: DriftPoint[] = [];
  let calls = 0;
  let puts = 0;

  if (!fill) {
    for (const b of bars) {
      calls += b.callPrem;
      puts += b.putPrem;
      out.push({ time: b.time, calls, puts });
    }
    return out;
  }

  let next = 0;
  for (let t = bars[0].time; t <= bars[bars.length - 1].time; t += barSec) {
    /* `while`, not `if`: bucketFlow's times are always multiples of barSec, so
       one bucket per step is the rule — but if a caller ever hands this bars
       from a different clock, several could land in one step and the loop must
       consume all of them rather than silently dropping the rest. */
    while (next < bars.length && bars[next].time <= t) {
      calls += bars[next].callPrem;
      puts += bars[next].putPrem;
      next++;
    }
    out.push({ time: t, calls, puts });
  }
  /* Anything left over sat past the last step — only reachable through the
     off-clock case above, and dropping it would lose real premium. */
  if (next < bars.length) {
    for (; next < bars.length; next++) {
      calls += bars[next].callPrem;
      puts += bars[next].putPrem;
    }
    out[out.length - 1] = { time: out[out.length - 1].time, calls, puts };
  }
  return out;
}

/** The larger of the two closing totals — what the pane scales against. */
export function driftPeak(points: readonly DriftPoint[]): number {
  const last = points[points.length - 1];
  if (!last) return 0;
  return Math.max(last.calls, last.puts);
}
