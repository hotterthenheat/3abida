/*
==================================================
  SLAYER TERMINAL - NEW YORK'S CLOCK (core/nyTime.ts)

  The market keeps New York's time, so every session
  time the terminal prints is New York's — whatever
  zone the reader's machine is in (the audit's X2,
  2026-10-09: a Los Angeles or UTC machine put trades
  before the open, windows after the close and a
  "today" that began at 07:55). Read and print every
  session time through here; never format a session
  time with a bare toLocaleTimeString() or getHours().

    nyClock(at)               "14:03"     (seconds: true → "14:03:42"; zone: true → "14:03 ET")
    nyDay(at)                 "Oct 9"     (weekday: true → "Fri Oct 9")
    nyStamp(at)               "Oct 9, 14:03"
    nyIsoDate(at)             "2026-10-09"
    nyMinutes(at)             843         minutes since New York's midnight
    nyParts(at)               { year, month, day, hour, minute, second, weekday }
    nyWallTime(y, m, d, h, mi) the instant (ms) of a New York wall-clock time
    nySession(at)             { open, close } — that New York day's 09:30 and 16:00, as instants (ms)
    minuteLabel(570)          "09:30"     a minute-of-the-day index, labelled
    nyTickMarks / nyTimeFormatter / NY_CHART_TIME   lightweight-charts on New York's clock

  `at` is a Date or epoch milliseconds, and defaults to the engine clock (core/clock.ts), so a replay that pins the
  clock reads its own moment. Only the reader's choice in Settings › The desk (components/gex/chartTime.ts, 'reader')
  prints the machine's own zone; everything that is the market's day is New York's.
==================================================
*/

import type { Time, TickMarkFormatter } from 'lightweight-charts';
import { now } from './clock';

export const NY_TZ = 'America/New_York';
/** The cash session, in minutes since New York's midnight */
export const SESSION_OPEN_MIN = 9 * 60 + 30;
export const SESSION_CLOSE_MIN = 16 * 60;
export const SESSION_LENGTH_MIN = SESSION_CLOSE_MIN - SESSION_OPEN_MIN;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const two = (n: number) => String(n).padStart(2, '0');

export type At = Date | number;
const ms = (at: At | undefined): number => (at === undefined ? now().getTime() : typeof at === 'number' ? at : at.getTime());

export interface NyParts {
  year: number;
  /** 1–12 */
  month: number;
  day: number;
  /** 0–23 */
  hour: number;
  minute: number;
  second: number;
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
}

/* ONE FORMATTER, AND A CACHE BY THE MINUTE: a tape formats thousands of stamps a second, and formatToParts is the slow
   part. New York's offset never changes inside a minute, so a minute's parts are reused with the seconds added on. */
let fmt: Intl.DateTimeFormat | null = null;
const byMinute = new Map<number, NyParts>();
export function nyParts(at?: At): NyParts {
  const t = ms(at);
  const minute = Math.floor(t / 60_000);
  let p = byMinute.get(minute);
  if (!p) {
    fmt ??= new Intl.DateTimeFormat('en-US', { timeZone: NY_TZ, hourCycle: 'h23', weekday: 'short', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' });
    const r: Record<string, string> = {};
    for (const x of fmt.formatToParts(new Date(minute * 60_000))) if (x.type !== 'literal') r[x.type] = x.value;
    p = { year: Number(r.year), month: Number(r.month), day: Number(r.day), hour: Number(r.hour) % 24, minute: Number(r.minute), second: 0, weekday: WEEKDAYS.indexOf(r.weekday) };
    if (byMinute.size > 5000) byMinute.clear();
    byMinute.set(minute, p);
  }
  const second = Math.floor((t - minute * 60_000) / 1000);
  return second === 0 ? p : { ...p, second };
}

/** Minutes since New York's midnight (0–1439) — 570 is the open, 960 the close */
export const nyMinutes = (at?: At): number => {
  const p = nyParts(at);
  return p.hour * 60 + p.minute;
};

/** "14:03", "14:03:42" with seconds, "14:03 ET" with the zone — 24-hour, as the tape and the cards speak */
export function nyClock(at?: At, opts: { seconds?: boolean; zone?: boolean } = {}): string {
  const p = nyParts(at);
  const s = `${two(p.hour)}:${two(p.minute)}${opts.seconds ? `:${two(p.second)}` : ''}`;
  return opts.zone ? `${s} ET` : s;
}

/** "Oct 9", or "Fri Oct 9" with the weekday — the one date style (the audit's X2.9) */
export function nyDay(at?: At, opts: { weekday?: boolean } = {}): string {
  const p = nyParts(at);
  const s = `${MONTHS[p.month - 1]} ${p.day}`;
  return opts.weekday ? `${WEEKDAYS[p.weekday]} ${s}` : s;
}

/** "Oct 9, 14:03" — where a bare clock would leave the reader asking "which day's 14:03?" */
export const nyStamp = (at?: At, opts: { seconds?: boolean; zone?: boolean } = {}): string => `${nyDay(at)}, ${nyClock(at, opts)}`;

/** "2026-10-09" — New York's calendar date, the key a day is stored under */
export function nyIsoDate(at?: At): string {
  const p = nyParts(at);
  return `${p.year}-${two(p.month)}-${two(p.day)}`;
}

/** "09:30" for 570 — a minute-of-the-day index (Trace's windows, a session's minute bars), labelled */
export const minuteLabel = (minuteOfDay: number): string => {
  const m = ((Math.round(minuteOfDay) % 1440) + 1440) % 1440;
  return `${two(Math.floor(m / 60))}:${two(m % 60)}`;
};

/** The instant (epoch ms) at which New York's wall clock reads y-m-d h:mi — DST included */
export function nyWallTime(year: number, month: number, day: number, hour = 0, minute = 0): number {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  /* New York is 4 or 5 hours behind UTC: read what the guess says there and move by the difference, twice, so a guess
     that lands across a DST change settles */
  let t = guess;
  for (let i = 0; i < 2; i++) {
    const p = nyParts(t);
    const reads = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    t += guess - reads;
  }
  return t;
}

/** That New York day's cash session, as instants (epoch ms): 09:30 and 16:00 New York */
export function nySession(at?: At): { open: number; close: number } {
  const p = nyParts(at);
  return {
    open: nyWallTime(p.year, p.month, p.day, 9, 30),
    close: nyWallTime(p.year, p.month, p.day, 16, 0),
  };
}

/** Where New York's clock stands against the session: before the open, in it, or after the close */
export const nySessionPhase = (at?: At): 'before' | 'open' | 'after' => {
  const m = nyMinutes(at);
  return m < SESSION_OPEN_MIN ? 'before' : m < SESSION_CLOSE_MIN ? 'open' : 'after';
};

/* ── lightweight-charts on New York's clock ──────────────────────────────────────────────────────────────────────────
   The library stamps an epoch axis in UTC and has no zone option. These say each tick in New York's time. A business
   day ({ year, month, day } or 'YYYY-MM-DD') is a calendar date with no instant behind it and is printed as it is.
   TickMarkType is the library's enum: 0 year, 1 month, 2 day of the month, 3 time, 4 time with seconds (written as
   numbers so this module does not pull the chart library into every page that reads the clock). */
const timeParts = (t: Time): NyParts => {
  if (typeof t === 'number') return nyParts(t * 1000);
  const [y, m, d] = typeof t === 'string' ? t.split('-').map(Number) : [t.year, t.month, t.day];
  return { year: y, month: m || 1, day: d || 1, hour: 0, minute: 0, second: 0, weekday: new Date(Date.UTC(y, (m || 1) - 1, d || 1)).getUTCDay() };
};

export const nyTickMarks: TickMarkFormatter = (time, type) => {
  const p = timeParts(time);
  switch (type as number) {
    case 0:
      return String(p.year);
    case 1:
      return MONTHS[p.month - 1];
    case 2:
      return String(p.day);
    case 4:
      return `${two(p.hour)}:${two(p.minute)}:${two(p.second)}`;
    default:
      return `${two(p.hour)}:${two(p.minute)}`;
  }
};

/** The crosshair's label: "Oct 9, 14:03" for an instant, "Oct 9" for a business day */
export const nyTimeFormatter = (time: Time): string => {
  const p = timeParts(time);
  const day = `${MONTHS[p.month - 1]} ${p.day}`;
  return typeof time === 'number' ? `${day}, ${two(p.hour)}:${two(p.minute)}` : day;
};

/** Spread into createChart's options (or applyOptions): `createChart(el, { ...NY_CHART_TIME, ... })`. A chart that sets
    its own `localization` or `timeScale` merges these into them instead. */
export const NY_CHART_TIME = {
  localization: { timeFormatter: nyTimeFormatter },
  timeScale: { tickMarkFormatter: nyTickMarks },
} as const;
