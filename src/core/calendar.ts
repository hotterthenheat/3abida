/*
==================================================
  SLAYER TERMINAL - MARKET CALENDAR
  One source of truth for "is the market open on
  this date", and for turning a horizon in days
  into a REAL expiry.

  Born because the weigher was doing
  `Date.now() + dte * 86400000` and happily listing
  contracts that expire on a Saturday. Options
  expire on trading days; anything that names an
  expiry has to come through here.
==================================================
*/

import { now } from './clock';

/** US equity market holidays. Same list moc.ts used privately — now shared. */
export const MARKET_HOLIDAYS = new Set([
  // 2026
  '2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03', '2026-05-25',
  '2026-06-19', '2026-07-03', '2026-09-07', '2026-11-26', '2026-12-25',
  // 2027
  '2027-01-01', '2027-01-18', '2027-02-15', '2027-03-26', '2027-05-31',
  '2027-06-18', '2027-07-05', '2027-09-06', '2027-11-25', '2027-12-24',
]);

/** Local-date ISO key (NOT toISOString — that shifts across the UTC boundary). */
export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function isTradingDay(d: Date): boolean {
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return false;
  return !MARKET_HOLIDAYS.has(isoDate(d));
}

/** Midnight local — dates used as calendar keys must not carry a time. */
function atMidnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** "Today" as the ENGINE sees it — wall clock live, pinned date in a replay.
    Every default `from` in this module flows through here, which is what
    stops a backtest from resolving 2024's expiries against 2026's calendar. */
export function today(): Date {
  return atMidnight(now());
}

/** Walk in `step` days until a session is found (bounded — never spins). */
function walkToSession(from: Date, step: 1 | -1): Date {
  const d = new Date(from);
  for (let i = 0; i < 10 && !isTradingDay(d); i++) d.setDate(d.getDate() + step);
  return d;
}

/** The next date the market is open, today included if it is a session. */
export function nextSession(from: Date = today()): Date {
  return walkToSession(atMidnight(from), 1);
}

/** Trading days between two dates (exclusive of `from`, inclusive of `to`). */
export function sessionsBetween(from: Date, to: Date): number {
  const a = atMidnight(from);
  const b = atMidnight(to);
  if (b <= a) return 0;
  let n = 0;
  const cur = new Date(a);
  while (cur < b) {
    cur.setDate(cur.getDate() + 1);
    if (isTradingDay(cur)) n++;
  }
  return n;
}

export interface Expiry {
  /** The real expiry date — always a trading day */
  date: Date;
  /** MM/DD/YY */
  label: string;
  /** Weekday name, e.g. "Fri" — the tell that makes a bad date obvious */
  weekday: string;
  /** CALENDAR days from today to that date (what pricing uses) */
  dte: number;
  /** TRADING sessions left — the number that actually decays the contract */
  sessions: number;
}

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function fmtExpiry(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`;
}

/**
 * Resolve a requested horizon (in calendar days) to a REAL expiry.
 *
 * Prefer walking BACK off a weekend — a "7 day" weekly is that Friday, not the
 * Saturday after it. But backward alone has a hole: two days out from a Friday
 * is Sunday, and stepping back from there lands on the Friday you are standing
 * on, turning a 2-day request into a same-day contract. So if the backward walk
 * reaches today or earlier, go FORWARD from the target instead.
 *
 * dte 0 is its own case: it means today when the market is open, and the next
 * session when it is not (asking for a same-day contract on a Saturday).
 */
export function expiryFor(dte: number, from: Date = today()): Expiry {
  const base = atMidnight(from);
  const want = Math.max(0, Math.round(dte));

  const target = new Date(base);
  target.setDate(target.getDate() + want);

  let date: Date;
  if (want === 0) {
    date = nextSession(base);
  } else {
    date = walkToSession(target, -1);
    if (date <= base) date = walkToSession(target, 1);
  }

  return {
    date,
    label: fmtExpiry(date),
    weekday: WEEKDAY[date.getDay()],
    dte: Math.round((date.getTime() - base.getTime()) / 86400000),
    sessions: sessionsBetween(base, date),
  };
}

/*
  HOW LONG A REGULAR SESSION IS, in one place.

  09:30 to 16:00 New York — 6.5 hours, 390 minutes. It was written as a bare
  6.5 in the vol modules and as the derived 390 in the simulator, so the
  session length was several facts that happened to agree. It lives in the
  calendar because that is the module that already owns when the market is
  open. (Ported from the partner tree, 2026-08-27, with the session-levels
  and expected-move work that reads it.)
*/
export const RTH_HOURS = 6.5;
export const RTH_MINUTES = RTH_HOURS * 60;

/*
  ══ T-16 — THE FUTURES CLOCK ══════════════════════════════════════════════

  The equity tape this desk draws stops at 16:00; the futures market that
  decides the next open barely stops at all. This model knows WHERE IN THE
  GLOBEX WEEK a wall-clock instant sits — the first piece of T-16, and the
  piece that is pure calendar. The overnight TAPE (session shading down the
  pane, the overnight high/low carried into the open) waits on MKT Futures:
  there is no honest way to shade an Asia session over bars that do not
  exist, so the chip ships now and the shading ships with the feed.

  THE WEEK, in New York wall time (DST rides free — every read goes through
  America/New_York, never a fixed UTC offset):

    Sunday 18:00 the week opens · Mon–Thu 17:00→18:00 daily maintenance ·
    Friday 17:00 the week closes. Inside a trading day:
      18:00 → 03:00  GLOBEX · ASIA
      03:00 → 09:30  GLOBEX · EUROPE   (London at the desk's 03:00)
      09:30 → 16:00  RTH               (the cash session this desk draws)
      16:00 → 17:00  GLOBEX · POST     (the hour after the cash close)

  HOLIDAYS ARE AN APPROXIMATION, and say so here: CME trades shortened
  hours on most equity holidays, but the desk's holiday table is the cash
  market's — a holiday reads CLOSED until the futures feed carries the real
  product calendar. Early closes (day-after-Thanksgiving et al.) are out of
  scope for the same reason.
*/
export type FuturesPhase = 'GLOBEX_ASIA' | 'GLOBEX_EUROPE' | 'RTH' | 'GLOBEX_POST' | 'MAINTENANCE' | 'CLOSED';

export const FUTURES_PHASE_WORDS: Record<FuturesPhase, { label: string; blurb: string }> = {
  GLOBEX_ASIA: { label: 'GLOBEX · ASIA', blurb: 'The overnight session, Asia hours — the open is being decided out here' },
  GLOBEX_EUROPE: { label: 'GLOBEX · EUROPE', blurb: 'The overnight session, European hours — London is trading the same book' },
  RTH: { label: 'RTH', blurb: 'The cash session — the hours every tape on this desk draws' },
  GLOBEX_POST: { label: 'GLOBEX · POST', blurb: 'Futures still trading in the hour after the cash close' },
  MAINTENANCE: { label: 'MAINTENANCE', blurb: 'The daily 17:00–18:00 ET Globex break — no futures trade in it' },
  CLOSED: { label: 'CLOSED', blurb: 'The futures week runs Sunday 18:00 to Friday 17:00 ET — this is outside it' },
};

const ET_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** Where a wall-clock instant sits in the Globex week. */
export function futuresPhaseAt(now: Date): FuturesPhase {
  const parts = Object.fromEntries(ET_FMT.formatToParts(now).map(pt => [pt.type, pt.value]));
  const weekday = String(parts.weekday ?? '');
  const mins = (Number(parts.hour) % 24) * 60 + Number(parts.minute);

  if (MARKET_HOLIDAYS.has(isoDate(new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))))) return 'CLOSED';
  if (weekday === 'Sat') return 'CLOSED';
  if (weekday === 'Sun') return mins >= 18 * 60 ? 'GLOBEX_ASIA' : 'CLOSED';
  if (weekday === 'Fri' && mins >= 17 * 60) return 'CLOSED';
  if (mins >= 18 * 60) return 'GLOBEX_ASIA';
  if (mins >= 17 * 60) return 'MAINTENANCE';
  if (mins >= 16 * 60) return 'GLOBEX_POST';
  if (mins >= 9 * 60 + 30) return 'RTH';
  if (mins >= 3 * 60) return 'GLOBEX_EUROPE';
  return 'GLOBEX_ASIA';
}
