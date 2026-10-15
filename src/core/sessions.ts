/*
==================================================
  SLAYER TERMINAL - THE FIELD'S SESSIONS (src/core/sessions.ts)

  2026-10-15 — the owner, "SPX OVERNIGHT FIELD": "'regular hours only' applies to SPY and QQQ. SPX/SPXW options trade
  nearly 24 hours on Cboe: regular 9:30 am–4:15 pm ET, curb 4:15–5:00 pm, Global Trading Hours 8:15 pm–9:25 am … SPY and
  QQQ: regular hours by default, with the gap outside them labelled."

  The minutes a name's field is modeled in, and the TRADING DAY each belongs to — read in New York, as every
  calculation is (core/nyTime.ts):
  · an equity or an ETF (SPY, QQQ, a stock): the regular session, 9:30 am to 4:00 pm (1:00 pm on a half day)
  · SPX (its weekly root SPXW folds under it): Cboe's three —
      gth   8:15 pm the evening before to 9:25 am, the trading day it opens into (Monday's from Sunday's 8:15 pm; none
            into a weekend or a holiday)
      rth   9:30 am to 4:15 pm (1:15 pm on a half day)
      curb  4:15 to 5:00 pm (none on a half day)
    The index itself prints from 9:30 am to 4:00 pm alone: outside those minutes SPX's price is the forward its own
    at-the-money options imply (data/feed/forward.ts — "price from options").

  One module so the recorder, the store, the tiles, the backfill, the rebuild and the page agree on every minute.
==================================================
*/
import { MARKET_HOLIDAYS } from './calendar';
import { nyIsoDate, nyMinutes, nyWallTime } from './nyTime';
import { EARLY_CLOSES } from '../data/marketState';

export type FieldSession = 'gth' | 'rth' | 'curb';

/** The names whose options trade in all three of Cboe's sessions (an index's weekly root reads as the index) */
const ALL_SESSIONS = new Set(['SPX', 'SPXW']);
export const tradesAllSessions = (name: string): boolean => ALL_SESSIONS.has(name.toUpperCase());

export const RTH_OPEN_MIN = 9 * 60 + 30;
/** An equity's close; SPX's options run fifteen minutes past it */
export const EQUITY_CLOSE_MIN = 16 * 60;
export const SPX_CLOSE_MIN = 16 * 60 + 15;
export const CURB_MINUTES = 45;
export const GTH_START_MIN = 20 * 60 + 15;
export const GTH_END_MIN = 9 * 60 + 25;
/** The index's own last value of the day (its cash close) — SPX prints no level after it */
export const INDEX_CLOSE_MIN = 16 * 60;

/** The half days (1:00 pm equities, 1:15 pm SPX, no curb) — the house's one list (data/marketState.ts EARLY_CLOSES) */
export const isHalfDay = (iso: string): boolean => EARLY_CLOSES.has(iso);

const isoAdd = (iso: string, days: number): string => {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
};
const weekdayOf = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};
/** A New York date the market trades (a weekday, not a holiday) */
export const isTradingIso = (iso: string): boolean => {
  const w = weekdayOf(iso);
  return w !== 0 && w !== 6 && !MARKET_HOLIDAYS.has(iso);
};

/** The minute (New York) a name's regular session ends on a day */
export const rthCloseOf = (name: string, iso: string): number =>
  tradesAllSessions(name) ? (isHalfDay(iso) ? 13 * 60 + 15 : SPX_CLOSE_MIN) : isHalfDay(iso) ? 13 * 60 : EQUITY_CLOSE_MIN;

/** The session a moment stands in for a name, and the trading day it belongs to — null outside every session */
export function fieldSessionAt(name: string, ms: number): { session: FieldSession; day: string } | null {
  const iso = nyIsoDate(ms);
  const m = nyMinutes(ms);
  if (tradesAllSessions(name)) {
    if (m >= GTH_START_MIN) {
      const next = isoAdd(iso, 1);
      return isTradingIso(next) ? { session: 'gth', day: next } : null;
    }
    if (m < GTH_END_MIN) return isTradingIso(iso) ? { session: 'gth', day: iso } : null;
  }
  if (!isTradingIso(iso)) return null;
  const close = rthCloseOf(name, iso);
  if (m >= RTH_OPEN_MIN && m < close) return { session: 'rth', day: iso };
  if (tradesAllSessions(name) && !isHalfDay(iso) && m >= close && m < close + CURB_MINUTES) return { session: 'curb', day: iso };
  return null;
}

/** The trading day a moment's field belongs to: its session's, else its New York date (between sessions) */
export const fieldDayOf = (name: string, ms: number): string => fieldSessionAt(name, ms)?.day ?? nyIsoDate(ms);

export interface SessionSpan {
  session: FieldSession;
  /** epoch ms, the span's first minute */
  from: number;
  /** epoch ms, the minute after its last (exclusive) */
  to: number;
}
/** A trading day's sessions for a name, oldest first — none for a day the market does not trade */
export function fieldSpansOf(name: string, day: string): SessionSpan[] {
  if (!isTradingIso(day)) return [];
  const [y, m, d] = day.split('-').map(Number);
  const at = (iso: string, minute: number) => {
    const [yy, mm, dd] = iso.split('-').map(Number);
    return nyWallTime(yy, mm, dd, Math.floor(minute / 60), minute % 60);
  };
  const close = rthCloseOf(name, day);
  const out: SessionSpan[] = [];
  if (tradesAllSessions(name)) out.push({ session: 'gth', from: at(isoAdd(day, -1), GTH_START_MIN), to: at(day, GTH_END_MIN) });
  out.push({ session: 'rth', from: nyWallTime(y, m, d, 9, 30), to: at(day, close) });
  if (tradesAllSessions(name) && !isHalfDay(day)) out.push({ session: 'curb', from: at(day, close), to: at(day, close + CURB_MINUTES) });
  return out;
}

/** Whether a name's index prints its own level at a moment (SPX from 9:30 am to its 4:00 pm cash close) — outside it the
    price is the options' forward */
export function indexPrintsAt(ms: number): boolean {
  const iso = nyIsoDate(ms);
  const m = nyMinutes(ms);
  return isTradingIso(iso) && m >= RTH_OPEN_MIN && m < (isHalfDay(iso) ? 13 * 60 : INDEX_CLOSE_MIN);
}

/** The words a session goes by on screen */
export const SESSION_WORDS: Record<FieldSession, string> = { gth: 'overnight', rth: 'regular hours', curb: 'curb' };

/** THE GAP'S SESSION KEY: a run of bars with no column never crosses a session's edge, so each run has one cause — the
    session and trading day where there is one, else the New York date and which side of the regular session it is */
export function gapSessionKey(name: string, ms: number): string {
  const s = fieldSessionAt(name, ms);
  if (s) return `${s.day}|${s.session}`;
  return `${nyIsoDate(ms)}|${nyMinutes(ms) < RTH_OPEN_MIN ? 'pre' : 'post'}`;
}
