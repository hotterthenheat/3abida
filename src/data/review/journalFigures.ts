/*
==================================================
  SLAYER TERMINAL - THE JOURNAL'S FIGURES
  (data/review/journalFigures.ts)

  What the journal's front page draws (Noah, 2026-09-25,
  on the partner's journal: "i love the calendar view as
  the first thing that greets you … i want cool but not
  over the top charts or graphs or any visual thing that
  can showcase the users pnl in many formats, alltime,
  this month, etc. when clicking on a certain calendar
  date you should be able to see all of the trades you
  took with accounts etc."):

    the period         today · this week · this month ·
                       this year · all time — the trading
                       days a trade's close must fall in
    the month          Sunday to Saturday, week by week — a
                       day is THE CALENDAR DAY the trade
                       closed on, New York's (the desk's
                       RP&L counts a trading day that turns
                       at the 16:00 bell; a journal's
                       calendar is a calendar: a trade closed
                       after Friday's bell is Friday's here,
                       Monday's there — the
                       redesign of 2026-09-26, after the
                       first cut called Sep 28 "today" on a
                       Friday night)
    each day           what it made, how many closed, how
                       many won
    the running total  a point a trade in the order they
                       closed, and how far it stood under
                       the best it had reached
    five cuts          the hour it was opened (New York) ·
                       the weekday · the name · long or
                       short · the size of the result

  Pure: rows in, figures out — the page and the proof
  read the same functions. THESE ARE THE READER'S NUMBERS
  about their own trades (the no-public-grades ruling is
  about OUR reads of the market).
==================================================
*/

import { directionOf, entryOf, instantOf, nameOf, type JournalRow } from './journal';
import { nyAt } from '../paper/clock';

/** THE CALENDAR DAY a trade closed on, New York's — what the journal's calendar files it under (see the head note) */
export const calendarDayOf = (r: JournalRow): string => nyAt(instantOf(r, r.t.closed) * 1000).date;

const cents = (v: number) => Math.round(v * 100) / 100;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const noon = (day: string) => new Date(`${day}T12:00:00`);
/** A date `n` days on (or back, below nothing) */
export function shiftDay(day: string, n: number): string {
  const d = noon(day);
  d.setDate(d.getDate() + n);
  return iso(d);
}

/* ---- the period ---- */
export type Period = 'today' | 'week' | 'month' | 'year' | 'all';
export const PERIODS: readonly { value: Period; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'year', label: 'This year' },
  { value: 'all', label: 'All time' },
];
export const isPeriod = (v: unknown): v is Period => PERIODS.some(p => p.value === v);
export interface Span {
  from: string;
  to: string;
}
/** The calendar days a period takes in as of `today` — both ends in; null is every day there is. A week runs Sunday to
    Saturday, as the calendar lays it out. */
export function spanOf(period: Period, today: string): Span | null {
  if (period === 'all') return null;
  if (period === 'today') return { from: today, to: today };
  if (period === 'month') return { from: `${today.slice(0, 7)}-01`, to: `${today.slice(0, 7)}-31` };
  if (period === 'year') return { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` };
  const sunday = shiftDay(today, -noon(today).getDay());
  return { from: sunday, to: shiftDay(sunday, 6) };
}
/** Dates compare as written (ISO), so a month's "-31" is its end whatever its length */
export const inSpan = (day: string, span: Span | null): boolean => !span || (day >= span.from && day <= span.to);
/** What a page shows: the trades closed in the span, on one account (or every one) */
export const rowsIn = (rows: JournalRow[], span: Span | null, account: string | null = null): JournalRow[] => rows.filter(r => inSpan(calendarDayOf(r), span) && (!account || r.s.id === account));

/* ---- the month ---- */
export const monthOf = (day: string): string => day.slice(0, 7);
export const monthWords = (month: string): string => `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
export function shiftMonth(month: string, n: number): string {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7)) - 1 + n;
  const d = new Date(y, m, 1, 12);
  return iso(d).slice(0, 7);
}
/** A month as the calendar lays it out: its weeks, Sunday to Saturday — a cell empty where the month has no such day */
export function monthWeeks(month: string): (string | null)[][] {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7)) - 1;
  const last = new Date(y, m + 1, 0).getDate();
  const out: (string | null)[][] = [];
  let week: (string | null)[] = [];
  for (let d = 1; d <= last; d++) {
    const wd = new Date(y, m, d, 12).getDay(); // 0 Sunday … 6 Saturday
    if (wd === 0 && week.length) {
      out.push(week);
      week = [];
    }
    if (!week.length) for (let i = 0; i < wd; i++) week.push(null);
    week.push(iso(new Date(y, m, d, 12)));
  }
  if (week.length) {
    while (week.length < 7) week.push(null);
    out.push(week);
  }
  return out;
}

/* ---- the days ---- */
export interface DayTotal {
  day: string;
  net: number;
  n: number;
  wins: number;
  /** In the order they closed */
  rows: JournalRow[];
}
/** What each calendar day made, how many closed on it and how many won */
export function dayTotals(rows: JournalRow[]): Map<string, DayTotal> {
  const out = new Map<string, DayTotal>();
  for (const r of [...rows].sort((a, b) => instantOf(a, a.t.closed) - instantOf(b, b.t.closed))) {
    const day = calendarDayOf(r);
    const d = out.get(day) ?? { day, net: 0, n: 0, wins: 0, rows: [] };
    d.net = cents(d.net + r.t.pnl);
    d.n += 1;
    if (r.t.pnl > 0) d.wins += 1;
    d.rows.push(r);
    out.set(d.day, d);
  }
  return out;
}
/** A calendar day as a moment on a day-clock chart: its noon in New York, in seconds (16:00 UTC is noon or 11:00 there — the
    same date either way) */
export const dayTime = (day: string): number => Math.floor(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)), 16) / 1000);
/** WHAT EACH DAY MADE — a bar a day that closed anything, oldest first */
export const dailyOf = (days: Map<string, DayTotal>): { time: number; value: number; day: string }[] =>
  [...days.values()].sort((a, b) => (a.day < b.day ? -1 : 1)).map(d => ({ time: dayTime(d.day), value: d.net, day: d.day }));

/* ---- the running total ---- */
export interface RunPoint {
  /** Seconds — never two the same (two closes in one second keep their order) */
  time: number;
  value: number;
  /** How far the total stood under the best it had reached — nothing at a new best, never above it */
  drop: number;
  row: JournalRow | null;
}
/** THE RUNNING TOTAL: a point a trade in the order they closed, starting from nothing a minute before the first */
export function runningOf(rows: JournalRow[]): RunPoint[] {
  let total = 0;
  let best = 0;
  let last = 0;
  const points = [...rows]
    .sort((a, b) => instantOf(a, a.t.closed) - instantOf(b, b.t.closed))
    .map<RunPoint>(r => {
      total = cents(total + r.t.pnl);
      best = Math.max(best, total);
      last = Math.max(last + 1, instantOf(r, r.t.closed));
      return { time: last, value: total, drop: cents(total - best), row: r };
    });
  return points.length ? [{ time: points[0].time - 60, value: 0, drop: 0, row: null }, ...points] : points;
}
/** THE RUNS: the longest run of wins and of losses, and the run the trades stand in now (a trade that made nothing runs
    with the losses, as the stats count it) */
export function runsOf(rows: JournalRow[]): { wins: number; losses: number; now: { won: boolean; n: number } | null } {
  let wins = 0;
  let losses = 0;
  let cur = 0;
  let won: boolean | null = null;
  for (const r of [...rows].sort((a, b) => instantOf(a, a.t.closed) - instantOf(b, b.t.closed))) {
    const w = r.t.pnl > 0;
    cur = won === w ? cur + 1 : 1;
    won = w;
    if (w) wins = Math.max(wins, cur);
    else losses = Math.max(losses, cur);
  }
  return { wins, losses, now: won == null ? null : { won, n: cur } };
}
/** What the winners made and what the losers lost, added up */
export const grossOf = (rows: JournalRow[]): { made: number; lost: number } => ({ made: cents(rows.filter(r => r.t.pnl > 0).reduce((x, r) => x + r.t.pnl, 0)), lost: cents(rows.filter(r => r.t.pnl <= 0).reduce((x, r) => x + r.t.pnl, 0)) });

/* ---- five cuts ---- */
export interface Lane {
  key: string;
  label: string;
  /** Said at the card's foot when the pointer is on it */
  hint: string;
  net: number;
  n: number;
  wins: number;
  /** The ink of a count bar — the side of nothing its trades are on (the sizes' lanes) */
  tone?: 'bull' | 'bear';
}
const laneOf = (key: string, label: string, hint: string, rows: JournalRow[], tone?: Lane['tone']): Lane => ({
  key,
  label,
  hint,
  net: cents(rows.reduce((x, r) => x + r.t.pnl, 0)),
  n: rows.length,
  wins: rows.filter(r => r.t.pnl > 0).length,
  tone,
});
const groupBy = (rows: JournalRow[], keyOf: (r: JournalRow) => string): Map<string, JournalRow[]> => {
  const m = new Map<string, JournalRow[]>();
  for (const r of rows) m.set(keyOf(r), [...(m.get(keyOf(r)) ?? []), r]);
  return m;
};
const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;
/** BY THE HOUR IT WAS OPENED, on New York's clock — the hours that have a trade, in the order of the day */
export function byHour(rows: JournalRow[]): Lane[] {
  const by = groupBy(rows, r => String(Math.floor(nyAt(instantOf(r, r.t.opened) * 1000).minutes / 60)));
  return [...by.entries()].map(([h, list]) => laneOf(h, hh(Number(h)), `Opened ${hh(Number(h))}–${hh((Number(h) + 1) % 24)} New York`, list)).sort((a, b) => Number(a.key) - Number(b.key));
}
const WEEKDAYS: [number, string, string][] = [
  [1, 'Mon', 'Mondays'],
  [2, 'Tue', 'Tuesdays'],
  [3, 'Wed', 'Wednesdays'],
  [4, 'Thu', 'Thursdays'],
  [5, 'Fri', 'Fridays'],
  [6, 'Sat', 'Saturdays'],
  [0, 'Sun', 'Sundays'],
];
/** BY WEEKDAY of the calendar day it closed on — every weekday, so an empty one says so; a weekend day only when it has one */
export function byWeekday(rows: JournalRow[]): Lane[] {
  const by = groupBy(rows, r => String(noon(calendarDayOf(r)).getDay()));
  return WEEKDAYS.filter(([d]) => d >= 1 && d <= 5 || (by.get(String(d))?.length ?? 0) > 0).map(([d, label, many]) => laneOf(String(d), label, `Closed on ${many}`, by.get(String(d)) ?? []));
}
/** BY NAME — the most traded first */
export function byName(rows: JournalRow[]): Lane[] {
  const by = groupBy(rows, nameOf);
  return [...by.entries()].map(([name, list]) => laneOf(name, name, `Traded in ${name}`, list)).sort((a, b) => b.n - a.n || Math.abs(b.net) - Math.abs(a.net) || (a.key < b.key ? -1 : 1));
}
/** CALLS OR PUTS — a call is a way up and a put a way down, as the journal's cut reads them (journal.ts directionOf) */
export function bySide(rows: JournalRow[]): Lane[] {
  const by = groupBy(rows, directionOf);
  return [laneOf('up', 'Calls', 'Needed it to go up — a call', by.get('up') ?? []), laneOf('down', 'Puts', 'Needed it to go down — a put', by.get('down') ?? [])];
}
/** BY SETUP — the reader's own tag on each trade, the most used first; the untagged last, as one lane */
export function bySetup(rows: JournalRow[]): Lane[] {
  const by = groupBy(rows, r => entryOf(r).setup ?? '');
  const tagged = [...by.entries()].filter(([k]) => k).map(([k, list]) => laneOf(k, k, `Written down as “${k}”`, list)).sort((a, b) => b.n - a.n || (a.key < b.key ? -1 : 1));
  const none = by.get('');
  return none ? [...tagged, laneOf('none', 'No setup', 'No setup written down', none)] : tagged;
}
/** A round step near a third of `x`: 1, 2 or 5 of a power of ten, never under a dollar */
export function roundStep(x: number): number {
  const v = Math.max(1, x / 3);
  const p = 10 ** Math.floor(Math.log10(v));
  const m = v / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}
const dollars = (v: number) => `$${Math.round(v).toLocaleString('en-US')}`;
/** THE SIZE OF THE RESULT — six buckets cut at a round step near a third of the biggest result: how often a trade is a big one,
    each way. Wins on top, as a ladder reads. A trade that made nothing counts with the losses, as the stats count it. */
export function bySize(rows: JournalRow[]): { lanes: Lane[]; step: number } {
  const step = roundStep(Math.max(0, ...rows.map(r => Math.abs(r.t.pnl))));
  const s = step;
  const pick = (lo: number, hi: number, loIn: boolean, hiIn: boolean) => rows.filter(r => (loIn ? r.t.pnl >= lo : r.t.pnl > lo) && (hiIn ? r.t.pnl <= hi : r.t.pnl < hi));
  const lanes = [
    laneOf('won-big', `Made ${dollars(2 * s)}+`, `Made ${dollars(2 * s)} or more`, pick(2 * s, Infinity, true, false), 'bull'),
    laneOf('won-mid', `Made ${dollars(s)}–${dollars(2 * s)}`, `Made from ${dollars(s)} to under ${dollars(2 * s)}`, pick(s, 2 * s, true, false), 'bull'),
    laneOf('won-small', `Made under ${dollars(s)}`, `Made something under ${dollars(s)}`, pick(0, s, false, false), 'bull'),
    laneOf('lost-small', `Lost up to ${dollars(s)}`, `Lost ${dollars(s)} or less, or made nothing`, pick(-s, 0, true, true), 'bear'),
    laneOf('lost-mid', `Lost ${dollars(s)}–${dollars(2 * s)}`, `Lost more than ${dollars(s)}, up to ${dollars(2 * s)}`, pick(-2 * s, -s, true, false), 'bear'),
    laneOf('lost-big', `Lost over ${dollars(2 * s)}`, `Lost more than ${dollars(2 * s)}`, pick(-Infinity, -2 * s, false, false), 'bear'),
  ];
  return { lanes, step };
}
