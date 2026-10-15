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
  clock reads its own moment.

  READ IN NEW YORK, PRINTED ON THE READER'S CLOCK (2026-10-13 — the owner: "show every time on screen (axis, hover
  cards, labels, wall-move times like "12:25") in the viewer's own timezone, detected from their browser, in 12-hour
  format with am/pm. Never use 24-hour format anywhere in the UI. Change display only: all calculations (session
  open/close, expiry times, UW's time-to-expiry rule) must stay in New York time internally, or the pricing breaks").
  Two halves, never mixed:
    · THE MARKET'S CLOCK, for every calculation — nyParts, nyMinutes, nyIsoDate, nyWallTime, nySession,
      nySessionPhase, SESSION_*: New York's, whatever the machine's zone.
    · THE READER'S CLOCK, for every time a reader sees — clock(), viewerDay(), marketClock(); nyClock, nyStamp,
      minuteLabel, nyTickMarks and nyTimeFormatter print through it (their names are older than the rule — they READ
      New York's instant and PRINT it on the reader's clock). 12-hour, "3:35 pm", never 24-hour. A printed time is never
      parsed, compared or used as a key.
    nyDay(at) stays New York's date: it names a market day (a session, an expiry), not a moment.
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

/* ── THE READER'S CLOCK — display only ──────────────────────────────────────────────────────────────────────────── */

/** The zone the reader's browser keeps — every printed time is in it */
export const VIEWER_TZ: string = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || NY_TZ;
  } catch {
    return NY_TZ;
  }
})();

interface ViewerParts {
  year: number;
  month: number;
  day: number;
  /** 1–12 */
  h12: number;
  minute: number;
  pm: boolean;
  /** "EDT", "PDT", "GMT+1" … */
  zone: string;
}
let vfmt: Intl.DateTimeFormat | null = null;
const vByMinute = new Map<number, ViewerParts>();
function viewerParts(t: number): ViewerParts {
  const minute = Math.floor(t / 60_000);
  let p = vByMinute.get(minute);
  if (!p) {
    vfmt ??= new Intl.DateTimeFormat('en-US', { timeZone: VIEWER_TZ, hour12: true, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', timeZoneName: 'short' });
    const r: Record<string, string> = {};
    for (const x of vfmt.formatToParts(new Date(minute * 60_000))) if (x.type !== 'literal') r[x.type] = x.value;
    p = { year: Number(r.year), month: Number(r.month), day: Number(r.day), h12: Number(r.hour) % 12 || 12, minute: Number(r.minute), pm: /p/i.test(r.dayPeriod ?? ''), zone: r.timeZoneName ?? '' };
    if (vByMinute.size > 5000) vByMinute.clear();
    vByMinute.set(minute, p);
  }
  return p;
}

/** "3:35 pm", "3:35:42 pm" with seconds, "3:35 pm EDT" with the reader's zone — the one way a time is printed */
export function clock(at?: At, opts: { seconds?: boolean; zone?: boolean } = {}): string {
  const t = ms(at);
  const p = viewerParts(t);
  const sec = opts.seconds ? `:${two(Math.floor((t - Math.floor(t / 60_000) * 60_000) / 1000))}` : '';
  const s = `${p.h12}:${two(p.minute)}${sec} ${p.pm ? 'pm' : 'am'}`;
  return opts.zone && p.zone ? `${s} ${p.zone}` : s;
}

/** "Oct 12" — the reader's calendar date of a moment (beside its printed time, so the two agree) */
export function viewerDay(at?: At): string {
  const p = viewerParts(ms(at));
  return `${MONTHS[p.month - 1]} ${p.day}`;
}

/** The reader's zone, short — "EDT", "PDT" */
export const viewerZone = (at?: At): string => viewerParts(ms(at)).zone;

/** THE MARKET'S h:mm ON THE READER'S CLOCK — marketClock(16, 0) is today's New York close as the reader's clock shows it
    ("4:00 pm" in New York, "1:00 pm" in Los Angeles); `on` picks the New York date (today's by default) */
export function marketClock(hour: number, minute = 0, opts: { zone?: boolean; on?: At } = {}): string {
  const p = nyParts(opts.on);
  return clock(nyWallTime(p.year, p.month, p.day, hour, minute), { zone: opts.zone });
}

/** A DATA FIELD'S CLOCK TEXT, NEVER PRINTED AS IS: New York's "14:03" ("14:03:42" with seconds) — what a field that
    other code parses or sorts keeps (a print's `time`); nyTextClock prints it */
export function nyText(at?: At, opts: { seconds?: boolean } = {}): string {
  const p = nyParts(at);
  return `${two(p.hour)}:${two(p.minute)}${opts.seconds ? `:${two(p.second)}` : ''}`;
}
/** A New York minute of the day as a data field's clock text — "09:30" for 570 (never printed as is; see nyText) */
export const nyMinuteText = (minuteOfDay: number): string => {
  const m = ((Math.round(minuteOfDay) % 1440) + 1440) % 1440;
  return `${two(Math.floor(m / 60))}:${two(m % 60)}`;
};

/** A NEW YORK WALL-CLOCK TEXT — a data field kept in the market's clock ("14:03", "14:03:42"; a print's `time`, a tape
    row's) — PRINTED on the reader's clock: "2:03 pm", "2:03:42 pm" (seconds kept when the text has them). `on` is the New
    York date it belongs to (today's by default). The field itself stays as it is — other code reads it in New York's
    time; only what is printed changes. A text that is not a clock comes back as it is. */
export function nyTextClock(text: string, on?: At, opts: { zone?: boolean } = {}): string {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(text.trim());
  if (!m) return text;
  const p = nyParts(on);
  const t = nyWallTime(p.year, p.month, p.day, Number(m[1]), Number(m[2])) + (m[3] ? Number(m[3]) * 1000 : 0);
  return clock(t, { seconds: m[3] !== undefined, zone: opts.zone });
}

/** PRINTS an instant on the reader's clock — "3:35 pm" (see clock; the name is older than the rule) */
export function nyClock(at?: At, opts: { seconds?: boolean; zone?: boolean } = {}): string {
  return clock(at, opts);
}

/** "Oct 9", or "Fri Oct 9" with the weekday — the one date style (the audit's X2.9) */
export function nyDay(at?: At, opts: { weekday?: boolean } = {}): string {
  const p = nyParts(at);
  const s = `${MONTHS[p.month - 1]} ${p.day}`;
  return opts.weekday ? `${WEEKDAYS[p.weekday]} ${s}` : s;
}

/** "Oct 9, 2:03 pm" on the reader's clock and calendar — where a bare clock would leave the reader asking "which day's?" */
export const nyStamp = (at?: At, opts: { seconds?: boolean; zone?: boolean } = {}): string => `${viewerDay(at)}, ${clock(at, opts)}`;

/** "2026-10-09" — New York's calendar date, the key a day is stored under */
export function nyIsoDate(at?: At): string {
  const p = nyParts(at);
  return `${p.year}-${two(p.month)}-${two(p.day)}`;
}

/** A minute of New York's day (570 is the open) PRINTED on the reader's clock — "9:30 am" in New York, "6:30 am" in Los
    Angeles (Trace's windows, a session's minute bars); `on` picks the New York date (today's by default) */
export const minuteLabel = (minuteOfDay: number, on?: At): string => {
  const m = ((Math.round(minuteOfDay) % 1440) + 1440) % 1440;
  return marketClock(Math.floor(m / 60), m % 60, { on });
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

/* ── lightweight-charts: the market's instants, PRINTED on the reader's clock ────────────────────────────────────────
   The library stamps an epoch axis in UTC and has no zone option. These say each tick on the reader's clock, 12-hour.
   A business day ({ year, month, day } or 'YYYY-MM-DD') is a calendar date with no instant behind it and is printed as
   it is. TickMarkType is the library's enum: 0 year, 1 month, 2 day of the month, 3 time, 4 time with seconds (written as
   numbers so this module does not pull the chart library into every page that reads the clock). */
const dayOfTime = (t: Time): { year: number; month: number; day: number } => {
  if (typeof t === 'number') {
    const p = viewerParts(t * 1000);
    return { year: p.year, month: p.month, day: p.day };
  }
  const [y, m, d] = typeof t === 'string' ? t.split('-').map(Number) : [t.year, t.month, t.day];
  return { year: y, month: m || 1, day: d || 1 };
};

export const nyTickMarks: TickMarkFormatter = (time, type) => {
  const p = dayOfTime(time);
  switch (type as number) {
    case 0:
      return String(p.year);
    case 1:
      return MONTHS[p.month - 1];
    case 2:
      /* a day tick names its date, "Oct 2" — never a bare "2" between the times (the owner's orbs round 2, item 7) */
      return `${MONTHS[p.month - 1]} ${p.day}`;
    case 4:
      return typeof time === 'number' ? clock(time * 1000, { seconds: true }) : `${MONTHS[p.month - 1]} ${p.day}`;
    default:
      return typeof time === 'number' ? clock(time * 1000) : `${MONTHS[p.month - 1]} ${p.day}`;
  }
};

/** The crosshair's label: "Oct 9, 2:03 pm" for an instant, "Oct 9" for a business day */
export const nyTimeFormatter = (time: Time): string => {
  if (typeof time === 'number') return nyStamp(time * 1000);
  const p = dayOfTime(time);
  return `${MONTHS[p.month - 1]} ${p.day}`;
};

export const NY_CHART_TIME = {
  localization: { timeFormatter: nyTimeFormatter },
  timeScale: { tickMarkFormatter: nyTickMarks },
} as const;
