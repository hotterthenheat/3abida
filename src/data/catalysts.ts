/*
==================================================
  SLAYER TERMINAL - THE CATALYST STREAM
  (data/catalysts.ts)

  Everything on the calendar, in one order.
==================================================

  THE CALENDAR EXISTED AND HAD NOWHERE TO BE READ. The macro schedule
  (data/events) and the earnings engine (data/earnings) both shipped months
  ago, and both were drawn only as marks along the bottom of a chart — which
  answers "is anything near this bar" and never answers "what is coming".
  A reader who wanted the week ahead had to open a name's dossier, one name
  at a time, and hold the Fed's dates in their head alongside.

  One stream, sorted by when. Macro releases carry the whole tape; a report
  carries one name. Sorting them together is the point: the useful fact is
  usually not that NVDA reports on Wednesday, it is that NVDA reports the
  morning after a CPI print.

  WHAT IS NOT IN HERE. Dividends, splits, product events and guidance dates
  are on the directive's list and are not modelled anywhere in this build —
  inventing them would be exactly the fake functionality the house rule
  keeps out. They join when their feeds do, and until then the page says
  what it carries rather than pretending to a completeness it has not got.
*/

import { isoDate, today as engineToday } from '../core/calendar';
import { buildEarningsCalendar, type EarningsEvent } from './earnings';
import { macroWindow, tradingDaysSigned } from './events';

export type CatalystKind = 'macro' | 'earnings';

export interface Catalyst {
  id: string;
  kind: CatalystKind;
  /** YYYY-MM-DD, the real calendar */
  iso: string;
  /** Sessions from today — 0 is today, negative is behind us */
  sessionsOut: number;
  /** The headline: "FOMC decision", "NVDA reports" */
  label: string;
  /** One line under it — the basis, the caveat, the numbers */
  detail: string;
  /** The name it lands on; null when it lands on everything */
  ticker: string | null;
  /** Earnings only — before the open or after the close, in words */
  slot?: string;
  /** Earnings only — the part of the market the report lands on */
  sector?: string;
  /** Earnings only — the move the options are charging, percent */
  impliedMovePct?: number;
  /** Earnings only — what the name typically does, percent */
  histAvgMovePct?: number;
  /** Earnings only — false when the date is still an analyst's estimate */
  confirmed?: boolean;
  /** The underlying earnings row, for the pages that want the rest of it */
  earnings?: EarningsEvent;
}

/** A session count as a phrase — "today", "tomorrow", "in 4 sessions". */
export function whenWords(sessionsOut: number): string {
  if (sessionsOut === 0) return 'today';
  if (sessionsOut === 1) return 'tomorrow';
  if (sessionsOut < 0) return `${Math.abs(sessionsOut)} session${Math.abs(sessionsOut) === 1 ? '' : 's'} ago`;
  return `in ${sessionsOut} sessions`;
}

/**
 * Today, from the ENGINE clock — a replay pinned to a past date builds that
 * date's calendar, not this machine's.
 *
 * NOT `dayKey()`, which is where this first went wrong. A day KEY is a hash
 * seed (`2026-9-21`, unpadded) and an ISO DATE is a date (`2026-09-21`); the
 * two look alike and only one of them parses. `new Date('2026-9-21T12:00:00')`
 * is an Invalid Date, every arithmetic on it returns NaN, and NaN !== 5 is
 * true forever — which spun the macro schedule's first-Friday walk in a
 * loop that pinned the tab. `isoDate` is the padded one.
 */
const todayIso = (): string => isoDate(engineToday());

/**
 * Every catalyst inside the window, soonest first.
 *
 * `daysAhead` is calendar days, not sessions, because that is what the
 * sources speak; the session count each row carries is derived after.
 */
export function buildCatalysts({ daysAhead = 45, daysBack = 3 }: { daysAhead?: number; daysBack?: number } = {}): Catalyst[] {
  /* FORTY-FIVE DAYS, not three weeks. The earnings engine only prices two
     weeks out, so a short window makes the page look like an earnings list
     with one stray release in it — and the macro schedule is precisely the
     part a reader cannot hold in their head. Past day fourteen the list
     thins to the releases, which is the honest picture of what is known. */
  const today = todayIso();
  const out: Catalyst[] = [];

  for (const m of macroWindow(new Date(`${today}T12:00:00`), daysBack, daysAhead)) {
    out.push({
      id: `macro-${m.iso}-${m.label}`,
      kind: 'macro',
      iso: m.iso,
      sessionsOut: tradingDaysSigned(today, m.iso),
      label: m.label,
      detail: m.detail,
      ticker: null,
    });
  }

  for (const e of buildEarningsCalendar()) {
    if (e.daysOut > daysAhead || e.daysOut < -daysBack) continue;
    out.push({
      id: `earn-${e.ticker}`,
      kind: 'earnings',
      /* The earnings engine speaks in SESSIONS from today, which is the
         bridge the chart's markers use too — the ISO is derived back from it
         so both surfaces cannot disagree about which day a report lands on. */
      iso: isoAfterSessions(today, e.daysOut),
      sessionsOut: e.daysOut,
      label: `${e.ticker} reports`,
      /* WORDS, NOT THE DESK'S ABBREVIATIONS. "BMO" is a thing a reader has
         to be taught; "before the open" is a thing they already know. */
      detail: `${e.name} · ${e.slot === 'BMO' ? 'before the open' : 'after the close'} · ${
        e.confirmed ? 'date confirmed' : 'analyst estimate, not yet confirmed'
      }`,
      ticker: e.ticker,
      slot: e.slot === 'BMO' ? 'before the open' : 'after the close',
      sector: e.sector,
      impliedMovePct: e.impliedMovePct,
      histAvgMovePct: e.histAvgMovePct,
      confirmed: e.confirmed,
      earnings: e,
    });
  }

  /* Sorted by session, then macro before earnings on the same day: a release
     that moves the whole tape is the context a single name's report is read
     inside, so it reads first. */
  return out.sort((a, b) => a.sessionsOut - b.sessionsOut || (a.kind === b.kind ? a.label.localeCompare(b.label) : a.kind === 'macro' ? -1 : 1));
}

/** The calendar date `n` trading sessions from an ISO date. */
function isoAfterSessions(fromIso: string, sessions: number): string {
  const d = new Date(`${fromIso}T12:00:00`);
  /* Refuse rather than walk: every step off an Invalid Date is another NaN,
     and the row would print one. */
  if (Number.isNaN(d.getTime())) return fromIso;
  let left = Math.abs(sessions);
  const step = sessions >= 0 ? 1 : -1;
  while (left > 0) {
    d.setDate(d.getDate() + step);
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) left -= 1;
  }
  return isoDate(d);
}

// ---- the days the stream falls into -----------------------------------------

export interface CatalystDay {
  iso: string;
  sessionsOut: number;
  /** Mon, Tue… */
  weekday: string;
  /** 18 Sep */
  dayLabel: string;
  macro: Catalyst[];
  earnings: Catalyst[];
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * The stream folded into days — the strip along the top.
 *
 * Only days that CARRY something, and only from today forward. A calendar
 * strip padded with empty Tuesdays is mostly empty boxes, and the reader's
 * question is "when is the next thing", which empty boxes answer slowly.
 */
export function catalystDays(rows: Catalyst[]): CatalystDay[] {
  const by = new Map<string, Catalyst[]>();
  for (const r of rows) {
    if (r.sessionsOut < 0) continue;
    const list = by.get(r.iso);
    if (list) list.push(r);
    else by.set(r.iso, [r]);
  }
  return [...by.entries()]
    .map(([iso, list]) => {
      const d = new Date(`${iso}T12:00:00`);
      return {
        iso,
        sessionsOut: list[0].sessionsOut,
        weekday: WEEKDAYS[d.getDay()],
        dayLabel: `${d.getDate()} ${MONTHS[d.getMonth()]}`,
        macro: list.filter(x => x.kind === 'macro'),
        earnings: list.filter(x => x.kind === 'earnings'),
      };
    })
    .sort((a, b) => a.sessionsOut - b.sessionsOut);
}

// ---- the read ---------------------------------------------------------------

/**
 * The week ahead in one line.
 *
 * Built around the NEXT thing rather than a count, because "four catalysts
 * this week" is a number and "CPI tomorrow, then NVDA the morning after" is
 * a plan.
 */
export function catalystRead(rows: Catalyst[], activeTicker: string): string {
  const ahead = rows.filter(r => r.sessionsOut >= 0);
  if (ahead.length === 0) return 'Nothing on the calendar inside the window.';
  const next = ahead[0];
  const mine = ahead.filter(r => r.ticker === activeTicker);
  const macroCount = ahead.filter(r => r.kind === 'macro').length;
  const earnCount = ahead.length - macroCount;

  const first = `Next up: [[${next.label}]] ${whenWords(next.sessionsOut)}`;
  const body = `${macroCount} macro release${macroCount === 1 ? '' : 's'} and ${earnCount} report${earnCount === 1 ? '' : 's'} inside the window`;
  const own = mine.length
    ? ` · [[${activeTicker}]] reports ${whenWords(mine[0].sessionsOut)}${
        mine[0].impliedMovePct ? `, priced for ±${mine[0].impliedMovePct.toFixed(1)}%` : ''
      }`
    : ` · nothing scheduled for [[${activeTicker}]]`;
  return `${first}. ${body}${own}.`;
}
