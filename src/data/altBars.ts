import type { Candle } from '../types/market';

/*
==================================================
  SLAYER TERMINAL - NON-TIME BARS (data/altBars.ts)

  Range and volume bars, built from the live
  seconds tape — T-15.
==================================================

  A time bar closes because a clock said so; these close because the MARKET
  did something — moved a dollar, traded ten thousand shares. In a 0DTE
  session the interesting information arrives in bursts and time bars smear
  it; a burst here is simply more bars.

  BUILT FROM THE 15-SECOND QUARTERS, AND THEREFORE LIVE-ONLY. The seconds
  tape starts at connect (T-14's rule: no backfill, resampled minutes are a
  different instrument wearing the same label), so these inherit that
  honesty and the pane wears the same `live only · from HH:MM` chip. The
  quarter is also the CUT GRANULARITY: a bar closes on the first quarter
  that satisfies its rule, so a violent quarter can overshoot the range or
  the volume floor. That is what building from aggregates means, and it is
  said here rather than smoothed over.

  WHERE ARE TICK BARS? A tick is a trade, and nothing upstream carries
  trades — the simulator walks aggregates, and the real feed's history is
  aggregates too. Inventing a tick count per quarter would be a number the
  app cannot source, so tick bars are deliberately absent until a per-trade
  feed exists — the same decision that kept 1s/5s off the timeframe picker.

  A BAR NEVER SPANS THE OVERNIGHT GAP. Range and volume rules do not care
  about the clock, but letting one bar absorb a session roll would hand it
  the overnight price gap as "range" and print a bar that never traded.
  The forming bar is finalized at the gap, undersized, and says nothing
  false by existing — it is simply where the session ended.

  THE LAST BAR IS STILL FORMING, exactly like the minute tape's newest bar.
  It has not met its rule yet; a chart shows it growing and the next quarter
  may complete it.
*/

export type AltBarKind = 'range' | 'volume';

export interface AltBarSpec {
  kind: AltBarKind;
  /** Dollars of range, or shares of volume. */
  size: number;
}

/** The gap that means "the session rolled" — far above any quarter spacing,
    far below the overnight jump (the seconds-tape proof draws the same
    line). */
const SESSION_GAP_SECONDS = 3600;

/**
 * The pane's bar-clock choices, keyed for persistence. One table, so the
 * pane validator, the menu and the chart can never disagree about what a
 * stored key means (the T-0 lesson: a list copied inline drops entries).
 * `'time'` is the absence of a spec — the ordinary timeframe clock.
 */
export const BAR_CLOCKS: readonly {
  key: string;
  spec: AltBarSpec | null;
  label: string;
  blurb: string;
}[] = [
  { key: 'time', spec: null, label: 'Time', blurb: 'Bars close on the clock — the timeframe strip decides.' },
  { key: 'r50', spec: { kind: 'range', size: 0.5 }, label: 'Range $0.50', blurb: 'A bar closes when it spans half a dollar.' },
  { key: 'r200', spec: { kind: 'range', size: 2 }, label: 'Range $2', blurb: 'A bar closes when it spans two dollars.' },
  { key: 'v10k', spec: { kind: 'volume', size: 10_000 }, label: 'Volume 10k', blurb: 'A bar closes when 10,000 shares have traded.' },
  { key: 'v50k', spec: { kind: 'volume', size: 50_000 }, label: 'Volume 50k', blurb: 'A bar closes when 50,000 shares have traded.' },
];

export const isBarClock = (v: unknown): v is string =>
  typeof v === 'string' && BAR_CLOCKS.some(c => c.key === v);

export const barClockSpec = (key: string): AltBarSpec | null =>
  BAR_CLOCKS.find(c => c.key === key)?.spec ?? null;

/**
 * Fold the quarter tape into bars that close by rule. Every quarter is
 * consumed — the total volume of the output equals the input's — and the
 * final bar is the still-forming one.
 */
export function buildAltBars(quarters: readonly Candle[], spec: AltBarSpec): Candle[] {
  const out: Candle[] = [];
  let cur: Candle | null = null;
  let prevTime = 0;
  for (const q of quarters) {
    if (cur && q.time - prevTime > SESSION_GAP_SECONDS) {
      /* The session rolled under the forming bar — close it where the tape
         ended rather than handing it the overnight gap as movement. */
      out.push(cur);
      cur = null;
    }
    if (!cur) {
      cur = { time: q.time, open: q.open, high: q.high, low: q.low, close: q.close, volume: q.volume };
    } else {
      cur.high = Math.max(cur.high, q.high);
      cur.low = Math.min(cur.low, q.low);
      cur.close = q.close;
      cur.volume += q.volume;
    }
    prevTime = q.time;
    const done =
      spec.kind === 'range' ? cur.high - cur.low >= spec.size - 1e-9 : cur.volume >= spec.size;
    if (done) {
      out.push(cur);
      cur = null;
    }
  }
  if (cur) out.push(cur);
  return out;
}
