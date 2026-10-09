/*
==================================================
  SLAYER TERMINAL - ONE CLOCK FOR EVERY CHART

  lightweight-charts stamps every epoch axis in UTC
  and offers no timezone option. Left alone, a bar
  the drilldown card calls 14:50 wears 19:50 on the
  axis underneath it (Noah, 2026-08-30) — the same
  instant reading in two clocks, three inches apart.

  The library decides WHICH grain each tick wears
  (year / month / day / time); this module decides
  what it SAYS, and it says it in the reader's own
  timezone. Import these into every createChart —
  a chart that formats its own time is a chart that
  will drift from the rest of the site.

  A chart of the MARKET'S day (a session, a tape)
  speaks New York's clock whatever the reader chose:
  core/nyTime.ts — nyTickMarks, nyTimeFormatter,
  NY_CHART_TIME — is the one module for that.
==================================================
*/

import { TickMarkType, type Time, type TickMarkFormatter } from 'lightweight-charts';
import { readDeskPrefs } from '../../data/deskPrefs';
import { nyParts } from '../../core/nyTime';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const two = (n: number) => String(n).padStart(2, '0');

/* THE CLOCK IS THE READER'S CHOICE (Settings › The desk, 2026-09-12): the
   machine's own zone, or New York's — the market's. An instant asked for in
   New York comes back as a Date whose fields READ as New York's wall clock
   (built from Intl's parts), so every formatter below keeps its getters;
   only these labels use it, never any arithmetic. */
function inNewYork(d: Date): Date {
  /* New York's wall clock off core/nyTime.ts, the one place the terminal reads it */
  const p = nyParts(d);
  return new Date(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
}

/**
 * Every `Time` shape the library accepts, resolved to a Date in the reader's
 * chosen clock.
 *
 * Epoch seconds are an instant — `new Date(ms)` renders them in the reader's
 * zone, which is the whole point (shifted to New York's wall clock when that
 * is the choice). A BusinessDay (or 'YYYY-MM-DD') is a calendar date with no
 * instant behind it, so it is built field-by-field: passing that string to
 * `new Date()` would parse it as UTC midnight and hand back the PREVIOUS day
 * to anyone west of Greenwich.
 */
/* WHOSE CLOCK. 'reader' is the choice in Settings (their own zone, or New York). 'ny' is New York WHATEVER they chose — for
   a chart whose tape is the market's own day (Review's backtest; Noah, 2026-09-20: "make the backtest speak new york
   everywhere… option cons only open at new york am session and close new york pm session"): a contract lists at 09:30 and
   settles at 16:00 New York, and a replay whose axis says 08:30 beside a bar that says 09:30 is two clocks for one minute. */
export type ChartClock = 'reader' | 'ny';

export function chartDate(t: Time, clock: ChartClock = 'reader'): Date {
  if (typeof t === 'number') {
    const d = new Date(t * 1000);
    return clock === 'ny' || readDeskPrefs().clock === 'ny' ? inNewYork(d) : d;
  }
  if (typeof t === 'string') {
    const [y, m, d] = t.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  }
  return new Date(t.year, t.month - 1, t.day);
}

/** `14:50` — the clock the cards, the wire and the tape all speak. */
export const fmtClockLocal = (t: Time, clock?: ChartClock): string => {
  const d = chartDate(t, clock);
  return `${two(d.getHours())}:${two(d.getMinutes())}`;
};

/** `Aug 30` */
export const fmtDayLocal = (t: Time, clock?: ChartClock): string => {
  const d = chartDate(t, clock);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
};

/**
 * `Aug 30, 14:50` — the crosshair label for any chart that spans more than one
 * session, where a bare clock would leave you asking "which day's 14:50?".
 */
export const fmtStampLocal = (t: Time, clock?: ChartClock): string => `${fmtDayLocal(t, clock)}, ${fmtClockLocal(t, clock)}`;

/**
 * Axis tick marks, in the reader's timezone.
 *
 * Day ticks stay bare numbers and month ticks carry the name — the library
 * emits a Month tick whenever the visible range crosses a boundary, so the
 * context arrives without every tick paying for it in width. These panes run
 * at 9-10px; a column of "Aug 30"s would crowd out the tape.
 */
const tickMarks = (time: Time, type: TickMarkType, clock: ChartClock): string => {
  const d = chartDate(time, clock);
  switch (type) {
    case TickMarkType.Year:
      return String(d.getFullYear());
    case TickMarkType.Month:
      return MONTHS[d.getMonth()];
    case TickMarkType.DayOfMonth:
      return String(d.getDate());
    case TickMarkType.TimeWithSeconds:
      return `${fmtClockLocal(time, clock)}:${two(d.getSeconds())}`;
    default:
      return fmtClockLocal(time, clock);
  }
};
export const localTickMarks: TickMarkFormatter = (time, type) => tickMarks(time, type, 'reader');
/** The same ticks on New York's clock, whatever the reader chose (see ChartClock) */
export const nyTickMarks: TickMarkFormatter = (time, type) => tickMarks(time, type, 'ny');

/**
 * Drop into `createChart` for a chart that spans days: `localization: LOCAL_TIME`.
 * Single-session panes pass `{ timeFormatter: fmtClockLocal }` instead — the
 * date is already in their header.
 */
export const LOCAL_TIME = { timeFormatter: (t: Time) => fmtStampLocal(t) };
/** The crosshair's stamp on New York's clock, whatever the reader chose (see ChartClock) */
export const NY_TIME = { timeFormatter: (t: Time) => fmtStampLocal(t, 'ny') };
