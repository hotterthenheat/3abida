import type { FlowPrint } from '../types/trace';

/*
==================================================
  SLAYER TERMINAL - THE TAPE, BUCKETED INTO BARS
  (data/flowBars.ts)

  Trace's option prints, summed into the same time
  buckets the candles use, so the chart can draw the
  flow underneath the tape it belongs to.

  ONE TAPE, TWO READERS. This does not generate
  anything. Trace's desk and the chart's flow pane
  read the SAME accumulated prints; this module only
  decides which bar each print falls in and adds up
  the premium already on it. A second source of
  "what traded" is how two surfaces end up quoting
  different numbers for the same session.

  CALLS UP, PUTS DOWN — and they are two series, not
  one net bar. A single signed bar answers "which way
  did the money lean", which is a smaller question
  than "how much came in on each side": a quiet bucket
  and a bucket where a billion dollars hit both sides
  net out to the same nothing. The reference draws
  both legs around a zero line and so do we.

  PREMIUM, NOT CONTRACTS. Volume already carries
  contract count on the pane below. Premium is what
  separates a thousand lottery tickets from one real
  position, and it is the number the desk's own tape
  summary leads with.
==================================================
*/

/** One bucket of the option tape, aligned to a chart bar. */
export interface FlowBar {
  /** Bar-aligned epoch SECONDS — the same unit lightweight-charts takes. */
  time: number;
  /** Call premium in the bucket, dollars. Always >= 0. */
  callPrem: number;
  /** Put premium in the bucket, dollars. Always >= 0 — the CALLER negates it
      to hang the leg below the axis, so this stays a magnitude. */
  putPrem: number;
  /** Prints that landed in the bucket, both sides. */
  count: number;
}

export interface BucketOptions {
  /** Bar width in seconds. Must match the chart's own interval. */
  barSec: number;
  /** Only prints on this symbol. Omit to take every print given. */
  ticker?: string;
  /** Drop prints before this epoch ms — the chart's left edge. */
  fromMs?: number;
}

/**
 * Sum prints into bar-aligned buckets.
 *
 * `at` is epoch MILLISECONDS. It is not on `FlowPrint` as shipped — the print
 * carries `time`, a `toLocaleTimeString()` string with no date, which cannot be
 * placed on an axis and sorts wrongly across midnight. The accumulator stamps
 * arrival time instead, and that is honest rather than a stand-in: this tape is
 * generated live, one tick at a time, so the moment a print arrives IS the
 * moment it printed. Nothing here invents a time for a print that lacks one —
 * a print with no usable `at` is DROPPED, because placing it at zero would
 * park the whole session's flow at the epoch.
 *
 * Buckets are emitted ASCENDING and only where something traded. A bar with no
 * prints is absent rather than zero: a zero bar asserts "the tape was quiet
 * here", and on a tape that only began accumulating when the app opened, most
 * empty bars mean "we were not listening yet".
 */
export function bucketFlow(
  prints: readonly (FlowPrint & { at?: number })[],
  options: BucketOptions
): FlowBar[] {
  const barSec = Math.max(1, Math.floor(options.barSec));
  const wanted = options.ticker?.toUpperCase();
  const fromMs = Number.isFinite(options.fromMs) ? (options.fromMs as number) : -Infinity;

  const byBucket = new Map<number, FlowBar>();

  for (const p of prints) {
    const at = p.at;
    // A print with no usable instant is dropped, never defaulted — see above.
    if (typeof at !== 'number' || !Number.isFinite(at) || at <= 0) continue;
    if (at < fromMs) continue;
    if (wanted && p.ticker?.toUpperCase() !== wanted) continue;

    const prem = p.premium;
    if (typeof prem !== 'number' || !Number.isFinite(prem) || prem <= 0) continue;

    /* THE RIGHT IS CHECKED BEFORE THE BUCKET EXISTS, and that ordering is the
       fix for a real defect rather than a style preference. The first cut
       created the bucket, then rejected an unknown right with `continue` — and
       left the empty bucket behind. The histogram never showed it (both legs
       were zero, so it drew nothing), but the bar was in the output claiming
       the tape was QUIET in that minute when in truth a print had been
       discarded there. A cumulative reader of the same buckets renders that
       claim as a visible point at zero. Reject first, allocate second. */
    const call = p.right === 'C';
    if (!call && p.right !== 'P') continue; // an unknown right counts as neither

    // Floor to the bucket. Flooring, not rounding: rounding would put a print
    // in the bar AFTER the one it happened in for the back half of every bar.
    const sec = Math.floor(at / 1000);
    const time = Math.floor(sec / barSec) * barSec;

    let bar = byBucket.get(time);
    if (!bar) {
      bar = { time, callPrem: 0, putPrem: 0, count: 0 };
      byBucket.set(time, bar);
    }
    if (call) bar.callPrem += prem;
    else bar.putPrem += prem;
    bar.count += 1;
  }

  return [...byBucket.values()].sort((a, b) => a.time - b.time);
}

/**
 * The heaviest single leg across the buckets — what the pane scales against.
 *
 * Taken over BOTH legs together rather than per leg, so the two sides stay
 * comparable: scaling calls and puts independently would draw a $10k call
 * bucket the same height as a $10M put bucket, which is the one thing a
 * two-sided histogram must never do.
 */
export function flowMaxLeg(bars: readonly FlowBar[]): number {
  let max = 0;
  for (const b of bars) {
    if (b.callPrem > max) max = b.callPrem;
    if (b.putPrem > max) max = b.putPrem;
  }
  return max;
}
