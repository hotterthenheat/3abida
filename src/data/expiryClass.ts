/*
==================================================
  SLAYER TERMINAL - WHICH EXPIRY A CONTRACT IS
  (data/expiryClass.ts)

  The Compass board's expiration categories and the
  0DTE rule (the owner, 2026-10-11 — docs/compass-
  setups-2026-10-11.md). Date logic, not pricing: it
  stays when the engine and the feed arrive; only the
  listings it is handed change.

    · A contract is 0DTE only when TODAY IS ITS LAST
      TRADING DAY — not its expiration date. An
      AM-settled contract (SPX's standard monthlies,
      the third Friday) lists Friday as its expiration
      but stopped trading Thursday, so on Friday it is
      not today's 0DTE.
    · 0DTE is read off each name's own listed dates —
      never a Monday/Wednesday/Friday rule, never "every
      day". A name with nothing whose last trading day
      is today has no 0DTE, and still has every other
      category.
    · A half day ends at 1:00 pm New York (SPXW
      included); weekends and the market's holidays come
      from core/calendar.ts, the early closes from
      data/marketState.ts.
    · After the close today's 0DTE is gone. On a night,
      a weekend or a holiday the 0DTE list is the NEXT
      session's, and says so.
    · DTE counts calendar days to the last trading day;
      the categories are cut on it.
    · A 1DTE contract carries a note: one night of risk
      is a big share of its life.
==================================================
*/

import { isTradingDay, isoDate } from '../core/calendar';
import { nyParts, type At } from '../core/nyTime';
import { EARLY_CLOSES } from './marketState';
import { EXPIRY_CATS, type ExpiryCat } from '../types/compass';

/** One listed expiration on one name */
export interface Listing {
  /** The expiration date the contract is listed under (local midnight) */
  expires: Date;
  /** Its last trading day — the session before `expires` when it is AM-settled */
  last: Date;
  /** AM-settled: settles on the next morning's open, so trading stopped the session before */
  am: boolean;
  /** Which series it belongs to — words for the calendar's day, nothing more */
  series: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'long';
}

const DAY = 86_400_000;
const atMidnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const daysBetween = (a: Date, b: Date): number => Math.round((atMidnight(b).getTime() - atMidnight(a).getTime()) / DAY);

/** The session a trading day's 0DTE ends at, in New York minutes — 13:00 on a half day, else 16:00 */
export const closeMinuteOn = (d: Date): number => (EARLY_CLOSES.has(isoDate(d)) ? 13 * 60 : 16 * 60);

/** The session before `d` (bounded walk) */
export function sessionBefore(d: Date): Date {
  const x = atMidnight(d);
  for (let i = 0; i < 10; i++) {
    x.setDate(x.getDate() - 1);
    if (isTradingDay(x)) break;
  }
  return x;
}

/** The session after `d` (bounded walk) */
export function sessionAfter(d: Date): Date {
  const x = atMidnight(d);
  for (let i = 0; i < 10; i++) {
    x.setDate(x.getDate() + 1);
    if (isTradingDay(x)) break;
  }
  return x;
}

/** Where the board stands in the market's week: New York's date, and the session whose contracts are its 0DTE */
export interface BoardDay {
  /** New York's calendar date, as a local midnight */
  today: Date;
  /** The session the 0DTE list belongs to — today while its session runs (or before it opens), else the next one */
  session: Date;
  /** The 0DTE list is a later session's — after the close, on a weekend or a holiday */
  next: boolean;
  /** Before today's open */
  before: boolean;
}

export function boardDay(at?: At): BoardDay {
  const p = nyParts(at);
  const today = new Date(p.year, p.month - 1, p.day);
  const mins = p.hour * 60 + p.minute;
  if (isTradingDay(today) && mins < closeMinuteOn(today)) return { today, session: today, next: false, before: mins < 9 * 60 + 30 };
  return { today, session: sessionAfter(today), next: true, before: false };
}

/** A listing as the board reads it */
export interface ExpiryRead {
  cat: ExpiryCat;
  /** Calendar days from New York's today to the last trading day */
  dte: number;
  /** The 0DTE is the next session's */
  next: boolean;
  /** One night of risk is a big share of its life */
  overnight: boolean;
  /** A long-dated contract with more than about nine months left */
  leaps: boolean;
}

/** About nine months, in calendar days — past it a long-dated contract is a LEAPS */
export const LEAPS_DAYS = 270;

/** Which category a listing falls in today — null once its last trading day has passed */
export function readExpiry(l: Listing, day: BoardDay): ExpiryRead | null {
  if (atMidnight(l.last) < day.session) return null;
  const dte = daysBetween(day.today, l.last);
  if (daysBetween(day.session, l.last) === 0) return { cat: '0dte', dte, next: day.next, overnight: false, leaps: false };
  const cat = EXPIRY_CATS.find(c => c.key !== '0dte' && dte >= c.min && dte <= c.max)?.key ?? 'long';
  return { cat, dte, next: false, overnight: dte === 1, leaps: cat === 'long' && dte > LEAPS_DAYS };
}
