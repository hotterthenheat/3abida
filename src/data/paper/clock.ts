/*
==================================================
  SLAYER TERMINAL - PAPER · THE REAL CLOCK
  (data/paper/clock.ts)

  A paper account lives on TODAY'S clock (docs/paper-
  rules.md, "The day"), read in New York whatever the
  machine's own zone is. Everything here is a pure
  function of an instant, so the engine and its proof
  can hand it any moment they like:

    New York's wall clock at an instant, and the
    instant of a New York wall-clock time
    THE TRADING DAY a moment belongs to — 17:00 to
      17:00, the futures day every prop firm counts
      by: 20:00 Tuesday is Wednesday's, the weekend is
      Monday's, a market holiday the next session's
    the time an option has left — the sessions after
      today up to its expiry, and what is left of
      today's 09:30–16:00 (the backtest's own
      `yearsLeft`, on the real clock)
==================================================
*/

import { isTradingDay, isoDate, sessionsBetween } from '../../core/calendar';

/** The minutes after midnight New York's clock names: the open, the bell, the flat-by and the roll */
export const OPEN_MIN = 9 * 60 + 30;
export const BELL_MIN = 16 * 60;
export const FLAT_MIN = 16 * 60 + 59;
export const ROLL_MIN = 17 * 60;
export const SESSION_MIN = BELL_MIN - OPEN_MIN;

export interface NyTime {
  /** New York's date, YYYY-MM-DD */
  date: string;
  /** Minutes after New York's midnight */
  minutes: number;
  /** Seconds into that minute */
  seconds: number;
  /** 0 Sunday … 6 Saturday */
  weekday: number;
}

let fmt: Intl.DateTimeFormat | null = null;
const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
/** New York's wall clock at an instant (ms) */
export function nyAt(ms: number): NyTime {
  fmt ??= new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const p: Record<string, string> = {};
  for (const x of fmt.formatToParts(new Date(ms))) p[x.type] = x.value;
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: (Number(p.hour) % 24) * 60 + Number(p.minute), seconds: Number(p.second), weekday: WEEKDAYS[p.weekday] ?? 0 };
}

/** A date as the calendar's Date (local noon — isTradingDay and isoDate read its local fields) */
export const dateAt = (iso: string): Date => new Date(`${iso}T12:00:00`);
/** The date `n` days after an ISO date */
export function addDays(iso: string, n: number): string {
  const d = dateAt(iso);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}
/** The first trading day at or after a date */
export function sessionFrom(iso: string): string {
  let d = iso;
  for (let i = 0; i < 12 && !isTradingDay(dateAt(d)); i++) d = addDays(d, 1);
  return d;
}

/** The instant (ms) New York's clock reads `minutes` after midnight on `date` — guessed as winter's (UTC−5) and set right
    by what New York reads then. Daylight saving changes at 02:00 on a Sunday: every time asked of here is clear of it. */
export function nyInstant(date: string, minutes: number): number {
  const [y, m, d] = date.split('-').map(Number);
  let at = Date.UTC(y, m - 1, d, 0, minutes) + 5 * 3600_000;
  for (let i = 0; i < 2; i++) {
    const got = nyAt(at);
    const drift = (got.date === date ? got.minutes : got.date > date ? got.minutes + 1440 : got.minutes - 1440) - minutes;
    if (drift === 0) break;
    at -= drift * 60_000;
  }
  return at;
}

/** THE TRADING DAY a moment belongs to: the one that ends after it (17:00 New York is the edge) */
export function tradingDayOf(ms: number): string {
  const t = nyAt(ms);
  return sessionFrom(t.minutes >= ROLL_MIN ? addDays(t.date, 1) : t.date);
}
/** When a trading day ends: 17:00 New York on its date */
export const dayEndsAt = (day: string): number => nyInstant(day, ROLL_MIN);
/** When it began: 17:00 on the session before it */
export function dayBeginsAt(day: string): number {
  let d = addDays(day, -1);
  for (let i = 0; i < 12 && !isTradingDay(dateAt(d)); i++) d = addDays(d, -1);
  return nyInstant(d, ROLL_MIN);
}
/** 16:00 New York on a date — when a contract expiring that day settles */
export const bellOf = (date: string): number => nyInstant(date, BELL_MIN);
/** 16:59 New York on a trading day — an evaluation's flat-by */
export const flatByOf = (day: string): number => nyInstant(day, FLAT_MIN);

/** Years of trading time an option has left at an instant: the sessions after today up to its expiry, and the share of
    today's 09:30–16:00 still to come (all of it before the open, none after the bell, none on a day with no session) */
export function yearsToExpiry(expiry: string, ms: number): number {
  const t = nyAt(ms);
  if (expiry < t.date) return 0;
  const session = isTradingDay(dateAt(t.date));
  const today = !session ? 0 : t.minutes < OPEN_MIN ? 1 : t.minutes >= BELL_MIN ? 0 : (BELL_MIN - t.minutes - t.seconds / 60) / SESSION_MIN;
  if (expiry === t.date) return today / 252;
  return (sessionsBetween(dateAt(t.date), dateAt(expiry)) + today) / 252;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** "14:03" in New York */
export const nyClockWords = (ms: number): string => {
  const t = nyAt(ms);
  return `${String(Math.floor(t.minutes / 60)).padStart(2, '0')}:${String(t.minutes % 60).padStart(2, '0')}`;
};
/** "Sep 22 · 14:03" in New York */
export const nyMomentWords = (ms: number): string => {
  const t = nyAt(ms);
  return `${MONTHS[Number(t.date.slice(5, 7)) - 1]} ${Number(t.date.slice(8))} · ${nyClockWords(ms)}`;
};
/** A trading day in words: "Tue, Sep 22" */
export const dayWords = (day: string): string => {
  const d = dateAt(day);
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
};
