import { aggregateCandles, tfMinutes, type Timeframe } from './timeframe';
import { emaSeries, emaWarmup, vwapSeries } from './indicators';
import type { Candle } from '../types/market';

/*
==================================================
  SLAYER TERMINAL - MULTI-TIMEFRAME CONFLUENCE (data/confluence.ts)

  Whether the timeframes agree, in one line — T-12.
==================================================

  WHAT IT ANSWERS. A four-pane desk exists to hold four views at once, and the
  most common thing a reader spends it on is one symbol at four intervals, to
  find out whether the timeframes agree. That is a whole desk spent on a
  question that fits in a strip.

  THE RULE IS FIXED, AND IT IS THE WHOLE RULE.

      above its EMA21 AND above its VWAP   → up
      below its EMA21 AND below its VWAP   → down
      one of each                          → flat

  FLAT IS A DISAGREEMENT, not a small move. The two references are a trend one
  and a value one, and price between them is exactly the state where the
  timeframe has nothing to say — which is the honest reading and the useful
  one. No threshold, no band, nothing tunable: a strip whose meaning depends on
  a constant somebody picked is a strip nobody can rely on, and there is
  nothing here for a later reader to "improve" into a different indicator.

  NOT ENOUGH HISTORY IS ITS OWN STATE, and that matters more here than
  anywhere else on the desk. A weekly row on a name the simulator has held for
  two days would otherwise report `flat` — a measurement — when the truth is
  that nothing was measured. `null` renders as a dash, not as a bar.

  THE CURVES COME FROM data/indicators.ts, the same two functions the tape
  draws its EMA21 and VWAP lines from. Re-deriving them here would let this
  strip say "above VWAP" while the chart beside it draws price below the line.
*/

export type TrendState = 'up' | 'flat' | 'down';

/*
  FIVE, and these five: a decade, a session, and a day.

  1m and 5m are what a 0DTE reader is actually trading, 15m and 1h are where
  the day's structure shows, and 1D is the context all of it sits in. 30m adds
  a row that almost never disagrees with the two either side of it, and 1W on
  an intraday desk is a row that changes about as often as the strip is looked
  at. Both are still reachable as a PANE — this is a summary, not the
  timeframe list.
*/
export const CONFLUENCE_TFS: readonly Timeframe[] = ['1m', '5m', '15m', '1h', '1D'];

export interface ConfluenceRow {
  tf: Timeframe;
  /** null when this timeframe has too little history to have an opinion. */
  state: TrendState | null;
  /** How many bars this timeframe actually had — what `null` is explained by. */
  bars: number;
}

/** The period the rule names. Exported so the proof and the tooltip agree. */
export const CONFLUENCE_EMA = 21;

/**
 * One row per timeframe, from a symbol's 1-minute base bars.
 *
 * `base` is the raw 1m series — this aggregates it per timeframe itself,
 * because the caller would otherwise have to do it five times and could pass
 * the wrong `barMinutes` to the VWAP (see data/indicators.ts on why that
 * silently turns every bar into a new session).
 */
export function buildConfluence(base: readonly Candle[]): ConfluenceRow[] {
  return CONFLUENCE_TFS.map(tf => {
    const mins = tfMinutes(tf);
    const bars = aggregateCandles(base as Candle[], mins);
    /* An EMA21 seeded at the first close is still shedding that seed for its
       first `period` bars, so a row with fewer than that has an EMA in name
       only. Reporting `null` there is the difference between "the 1h has no
       view" and "the 1h is flat". */
    if (bars.length < emaWarmup(CONFLUENCE_EMA)) return { tf, state: null, bars: bars.length };
    const ema = emaSeries(bars, CONFLUENCE_EMA);
    const vwap = vwapSeries(bars, mins);
    const i = bars.length - 1;
    const close = bars[i].close;
    const e = ema[i];
    const v = vwap[i];
    if (!Number.isFinite(e) || !Number.isFinite(v)) return { tf, state: null, bars: bars.length };
    const state: TrendState = close > e && close > v ? 'up' : close < e && close < v ? 'down' : 'flat';
    return { tf, state, bars: bars.length };
  });
}

/** ▲ / ▬ / ▼ — and a dash where there is no view. */
export const TREND_GLYPH: Record<TrendState, string> = { up: '▲', flat: '▬', down: '▼' };

/** What a row means, in words, for the hover title and a screen reader. */
export const trendWords = (row: ConfluenceRow): string =>
  row.state === null
    ? `${row.tf}: not enough history — ${row.bars} bar${row.bars === 1 ? '' : 's'}`
    : row.state === 'up'
      ? `${row.tf}: above its EMA${CONFLUENCE_EMA} and its VWAP`
      : row.state === 'down'
        ? `${row.tf}: below its EMA${CONFLUENCE_EMA} and its VWAP`
        : `${row.tf}: between its EMA${CONFLUENCE_EMA} and its VWAP`;
