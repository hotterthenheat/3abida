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
==================================================
*/

import { TickMarkType, type Time, type TickMarkFormatter } from 'lightweight-charts';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const two = (n: number) => String(n).padStart(2, '0');

/**
 * Every `Time` shape the library accepts, resolved to a LOCAL Date.
 *
 * Epoch seconds are an instant — `new Date(ms)` renders them in the reader's
 * zone, which is the whole point. A BusinessDay (or 'YYYY-MM-DD') is a calendar
 * date with no instant behind it, so it is built field-by-field: passing that
 * string to `new Date()` would parse it as UTC midnight and hand back the
 * PREVIOUS day to anyone west of Greenwich.
 */
export function chartDate(t: Time): Date {
  if (typeof t === 'number') return new Date(t * 1000);
  if (typeof t === 'string') {
    const [y, m, d] = t.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  }
  return new Date(t.year, t.month - 1, t.day);
}

/** `14:50` — the clock the cards, the wire and the tape all speak. */
export const fmtClockLocal = (t: Time): string => {
  const d = chartDate(t);
  return `${two(d.getHours())}:${two(d.getMinutes())}`;
};

/** `Aug 30` */
export const fmtDayLocal = (t: Time): string => {
  const d = chartDate(t);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
};

/**
 * `Aug 30, 14:50` — the crosshair label for any chart that spans more than one
 * session, where a bare clock would leave you asking "which day's 14:50?".
 */
export const fmtStampLocal = (t: Time): string => `${fmtDayLocal(t)}, ${fmtClockLocal(t)}`;

/**
 * Axis tick marks, in the reader's timezone.
 *
 * Day ticks stay bare numbers and month ticks carry the name — the library
 * emits a Month tick whenever the visible range crosses a boundary, so the
 * context arrives without every tick paying for it in width. These panes run
 * at 9-10px; a column of "Aug 30"s would crowd out the tape.
 */
export const localTickMarks: TickMarkFormatter = (time, type) => {
  const d = chartDate(time);
  switch (type) {
    case TickMarkType.Year:
      return String(d.getFullYear());
    case TickMarkType.Month:
      return MONTHS[d.getMonth()];
    case TickMarkType.DayOfMonth:
      return String(d.getDate());
    case TickMarkType.TimeWithSeconds:
      return `${fmtClockLocal(time)}:${two(d.getSeconds())}`;
    default:
      return fmtClockLocal(time);
  }
};

/**
 * Drop into `createChart` for a chart that spans days: `localization: LOCAL_TIME`.
 * Single-session panes pass `{ timeFormatter: fmtClockLocal }` instead — the
 * date is already in their header.
 */
export const LOCAL_TIME = { timeFormatter: fmtStampLocal };
