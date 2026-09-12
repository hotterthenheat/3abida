import { sessionStarts } from './indicators';
import type { Candle } from '../types/market';

/*
==================================================
  SLAYER TERMINAL - SESSION LEVELS (data/sessionLevels.ts)

  The reference prices every intraday reader draws
  by hand before the open — T-6.
==================================================

  WHAT IS HERE, AND WHAT IS DELIBERATELY NOT.

    prior day high · low · close      the day that just finished
    opening range high · low          the first 5, 15 or 30 minutes
    initial balance high · low        the first hour

  OVERNIGHT HIGH AND LOW ARE NOT HERE, and their absence is a decision rather
  than an omission. They need the Globex session, and `core/calendar.ts` has
  no concept of an intraday session at all — it knows trading DAYS, holidays
  and expiries. Inventing an overnight range out of a series that holds only
  RTH bars would be a level with nothing behind it, on a page whose rule is
  that no number appears the app cannot source. They arrive with T-16.

  BY TIME, NOT BY BAR COUNT. "The first fifteen minutes" is a clock statement;
  counting fifteen bars gives the same answer only while every minute has a
  bar in it. A halt, a late open or a thin name breaks that, and the version
  that counts bars would quietly report a thirty-minute range as a fifteen.

  A FORMING RANGE IS SAID TO BE FORMING. At 09:33 the fifteen-minute opening
  range exists but is not finished, and a reader acting on a level that can
  still move needs to know which it is. `orComplete` is that, and the caller
  is expected to show it — the levels are still returned, because the running
  range is the useful thing during the range.

  THE SESSION BOUNDARY comes from `sessionStarts` in ./indicators, the same
  rule the VWAP re-anchors on. Two copies would eventually cut the prior day
  at a different bar than the VWAP was anchored to, and the two lines would
  disagree on the same chart.

  AND THAT RULE HAS A KNOWN LIMIT, inherited rather than introduced here. It
  is "a step of more than 1.5× the bar's own length", so on 1-minute bars any
  missing minute — a halt, a thin name, a feed hiccup — reads as a new
  session. It cannot be fixed with a bigger number: the threshold has to be
  scale-relative or a DAILY series would re-anchor its VWAP on every bar, and
  no scale-relative threshold separates a two-hour halt from a seventeen-hour
  night. What separates them is a calendar that knows when the market was
  open, which `core/calendar.ts` does not have — that is T-16.

  Nothing on screen is wrong today: the simulator's sessions are contiguous
  390-bar runs with no holes in them. `session-levels-proof.ts` pins the
  behaviour so the day it changes, it changes on purpose.
*/

/** The three opening ranges the desk offers. Minutes from the open. */
export type OpeningRange = 5 | 15 | 30;
export const OPENING_RANGES: readonly OpeningRange[] = [5, 15, 30];

/** The initial balance is the first hour. It is not configurable — the noun
    means the first hour, and a 40-minute "initial balance" is a different
    thing wearing a borrowed name. */
export const INITIAL_BALANCE_MIN = 60;

export type SessionLevelKey = 'prevHigh' | 'prevLow' | 'prevClose' | 'orHigh' | 'orLow' | 'ibHigh' | 'ibLow';

export interface SessionLevel {
  key: SessionLevelKey;
  /** The shorthand a chart is labelled with — PDH, ORL, IBH. */
  tag: string;
  price: number;
}

export interface SessionLevels {
  levels: SessionLevel[];
  /** The opening range asked for, echoed so a caller can label it `OR15`. */
  orMinutes: OpeningRange;
  /** Minutes of it elapsed so far, capped at `orMinutes`. */
  orElapsed: number;
  orComplete: boolean;
  ibElapsed: number;
  ibComplete: boolean;
  /** First bar time of the session these were cut from; null with no data. */
  sessionStart: number | null;
  /** Whether a prior session existed to take PDH/PDL/PDC from. */
  hasPrior: boolean;
}

const TAGS: Record<SessionLevelKey, string> = {
  prevHigh: 'PDH',
  prevLow: 'PDL',
  prevClose: 'PDC',
  orHigh: 'ORH',
  orLow: 'ORL',
  ibHigh: 'IBH',
  ibLow: 'IBL',
};

const empty = (orMinutes: OpeningRange): SessionLevels => ({
  levels: [],
  orMinutes,
  orElapsed: 0,
  orComplete: false,
  ibElapsed: 0,
  ibComplete: false,
  sessionStart: null,
  hasPrior: false,
});

/** High and low of a slice, or null on an empty one. */
function extent(bars: readonly Candle[]): { high: number; low: number } | null {
  if (bars.length === 0) return null;
  let high = bars[0].high;
  let low = bars[0].low;
  for (const b of bars) {
    if (b.high > high) high = b.high;
    if (b.low < low) low = b.low;
  }
  return { high, low };
}

/**
 * The session's reference levels, from a symbol's 1-minute base bars.
 *
 * `base` is the RAW 1-minute series, never an aggregated one: a 15-minute bar
 * cannot answer what the first five minutes did, and handing this an
 * aggregated series would silently round every level to that interval.
 */
export function buildSessionLevels(base: readonly Candle[], orMinutes: OpeningRange): SessionLevels {
  if (base.length === 0) return empty(orMinutes);
  const starts = sessionStarts(base, 1);
  const cur = starts[starts.length - 1];
  const prior = starts.length >= 2 ? starts[starts.length - 2] : null;

  const curBars = base.slice(cur);
  const openTime = curBars[0].time;
  const lastTime = curBars[curBars.length - 1].time;
  /* Elapsed INCLUDES the opening bar, so a session one bar old has one minute
     on the clock rather than zero — the difference between "nothing has
     happened" and "the first minute has". */
  const elapsed = Math.floor((lastTime - openTime) / 60) + 1;

  const levels: SessionLevel[] = [];
  const put = (key: SessionLevelKey, price: number | null | undefined) => {
    if (typeof price === 'number' && Number.isFinite(price)) levels.push({ key, tag: TAGS[key], price });
  };

  if (prior !== null) {
    const priorBars = base.slice(prior, cur);
    const e = extent(priorBars);
    put('prevHigh', e?.high);
    put('prevLow', e?.low);
    put('prevClose', priorBars[priorBars.length - 1]?.close);
  }

  const within = (minutes: number) => curBars.filter(b => b.time - openTime < minutes * 60);
  const or = extent(within(orMinutes));
  put('orHigh', or?.high);
  put('orLow', or?.low);
  const ib = extent(within(INITIAL_BALANCE_MIN));
  put('ibHigh', ib?.high);
  put('ibLow', ib?.low);

  return {
    levels,
    orMinutes,
    orElapsed: Math.min(orMinutes, elapsed),
    orComplete: elapsed >= orMinutes,
    ibElapsed: Math.min(INITIAL_BALANCE_MIN, elapsed),
    ibComplete: elapsed >= INITIAL_BALANCE_MIN,
    sessionStart: openTime,
    hasPrior: prior !== null,
  };
}
