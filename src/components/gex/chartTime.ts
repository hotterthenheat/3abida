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

  EVERY CHART PRINTS THE READER'S CLOCK, 12-HOUR
  (2026-10-13 — the owner: every time on screen in
  the viewer's own timezone, "3:35 pm", never
  24-hour; display only). The 'ny' clock below and
  Settings' New York choice no longer move what is
  printed — the market's own day is still READ in
  New York's time wherever it is computed
  (core/nyTime.ts).
==================================================
*/

import { TickMarkType, defaultHorzScaleBehavior, type IHorzScaleBehavior, type Time, type TickMarkFormatter, type TimeChartOptions } from 'lightweight-charts';
import { readDeskPrefs } from '../../data/deskPrefs';
import { clock as readerClock } from '../../core/nyTime';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const two = (n: number) => String(n).padStart(2, '0');

/* THE CLOCK IS THE READER'S CHOICE (Settings › The desk, 2026-09-12): the
   machine's own zone, or New York's — the market's. An instant asked for in
   New York comes back as a Date whose fields READ as New York's wall clock
   (built from Intl's parts), so every formatter below keeps its getters;
   only these labels use it, never any arithmetic. */

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

export function chartDate(t: Time, _clock: ChartClock = 'reader'): Date {
  /* the reader's own clock always (2026-10-13) — a Date's getters read the machine's zone, the browser's own */
  if (typeof t === 'number') return new Date(t * 1000);
  if (typeof t === 'string') {
    const [y, m, d] = t.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  }
  return new Date(t.year, t.month - 1, t.day);
}

/** `2:50 pm` — the clock the cards, the wire and the tape all speak, the reader's own */
export const fmtClockLocal = (t: Time, clock?: ChartClock): string => readerClock(chartDate(t, clock).getTime());

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
      return readerClock(d.getTime(), { seconds: true });
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

/*
  DAY, MONTH AND YEAR TICKS ON THE VIEWER'S CALENDAR (the Terrain audit of 2026-10-13, item 5). The library weighs
  each bar by what changed since the bar before — the year, the month, the day, else the hour or minute it crossed —
  and picks the heaviest marks to label; it reads the calendar in UTC, so a "day" tick stood on the first bar after
  00:00 UTC: 8:00 pm New York, the LAST after-hours bar of a day, labelled with the day that was ending. This
  behaviour weighs the calendar on the viewer's own clock (a Date's getters are the browser's zone), so a day tick
  stands on the first bar after the viewer's midnight and the label (tickMarks, above) names the day beginning.
  The intraday weights are the library's own (one second to twelve hours).
*/
const INTRADAY: [number, number][] = [
  [12 * 3600, 33],
  [6 * 3600, 32],
  [3 * 3600, 31],
  [3600, 30],
  [30 * 60, 22],
  [5 * 60, 21],
  [60, 20],
  [1, 10],
];
const intradayWeight = (cur: number, prev: number): number => {
  for (const [div, w] of INTRADAY) if (Math.floor(prev / div) !== Math.floor(cur / div)) return w;
  return 0;
};
const calendarWeight = (cur: Date, prev: Date): number =>
  cur.getFullYear() !== prev.getFullYear() ? 70 : cur.getMonth() !== prev.getMonth() ? 60 : cur.getDate() !== prev.getDate() ? 50 : 0;
const secondsOf = (t: unknown): number | null => (typeof t === 'number' && Number.isFinite(t) ? t : null);

/** The time behaviour as the library types it for createChart: its options are a time chart's (tickMarkFormatter among them) */
export type TimeBehavior = IHorzScaleBehavior<Time> & { options(): TimeChartOptions };

/** The library's time scale, its calendar ticks on the viewer's clock — `createChartEx<Time, TimeBehavior>(el, new (localCalendarBehavior())(), opts)` */
export function localCalendarBehavior(): new () => TimeBehavior {
  const Base = defaultHorzScaleBehavior() as new () => TimeBehavior;
  return class LocalCalendar extends Base {
    fillWeightsForPoints(points: Parameters<IHorzScaleBehavior<Time>['fillWeightsForPoints']>[0], startIndex = 0): void {
      super.fillWeightsForPoints(points, startIndex);
      if (!points.length) return;
      /* the weights again, on the viewer's calendar — a business day (a daily chart) keeps the library's own */
      let prev = startIndex > 0 ? secondsOf(points[startIndex - 1].originalTime) : null;
      if (prev === null && startIndex === 0 && points.length > 1) {
        const first = secondsOf(points[0].originalTime);
        const last = secondsOf(points[points.length - 1].originalTime);
        if (first !== null && last !== null) prev = first - Math.ceil((last - first) / (points.length - 1));
      }
      for (let i = startIndex; i < points.length; i++) {
        const cur = secondsOf(points[i].originalTime);
        if (cur === null) {
          prev = null;
          continue;
        }
        if (prev !== null) {
          const w = calendarWeight(new Date(cur * 1000), new Date(prev * 1000)) || intradayWeight(cur, prev);
          (points[i] as { timeWeight: number }).timeWeight = w;
        }
        prev = cur;
      }
    }
  };
}
