/*
==================================================
  SLAYER TERMINAL - WHEN THE MARKET ISN'T OPEN (data/marketState.ts)

  The Logo System's four market states (Web and App · Market states, 2026-09-30) — pre-market, closed, early close and
  a holiday — as one plain line each, for the band over every page of the demo and the status page:

    Pre-market     "The market opens at 9:30 ET."
    Closed         "The market is closed. It opens at 9:30 ET." (or Monday, or the day after a holiday)
    Early close    "Early close today at 1:00 ET."
    Holiday        "Closed for Thanksgiving. The market opens Friday at 9:30 ET and closes early at 1:00 ET."

  The New York clock is data/sessionClock.ts's; the holidays are core/calendar.ts's. The early closes are the
  exchange's published ones (the day after Thanksgiving, Christmas Eve, the day before Independence Day when it falls
  on a weekday) — written out, as the holidays are.
==================================================
*/

import { MARKET_HOLIDAYS, isTradingDay, isoDate } from '../core/calendar';
import { readSessionClock } from './sessionClock';
import { nyParts } from '../core/nyTime';

export const EARLY_CLOSES = new Set(['2025-07-03', '2025-11-28', '2025-12-24', '2026-11-27', '2026-12-24', '2027-11-26']);

export type MarketStateKind = 'open' | 'pre-market' | 'closed' | 'early-close' | 'holiday';

export interface MarketState {
  kind: MarketStateKind;
  /** the state word the brand prints beside a product's name */
  word: 'live' | 'closed';
  /** one plain sentence */
  line: string;
}

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** New York's calendar date as a local Date at midnight */
const nyDate = (now: Date): Date => {
  const p = nyParts(now);
  return new Date(p.year, p.month - 1, p.day);
};

const nextTradingDay = (from: Date): Date => {
  const d = new Date(from);
  do d.setDate(d.getDate() + 1);
  while (!isTradingDay(d));
  return d;
};

/** The holiday's name, by where it falls — enough for the line, not a calendar of its own */
export function holidayName(d: Date): string {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  if (m === 1 && day <= 2) return 'New Year’s Day';
  if (m === 1) return day === 9 ? 'a national day of mourning' : 'Martin Luther King Jr. Day';
  if (m === 2) return 'Presidents’ Day';
  if (m === 3 || m === 4) return 'Good Friday';
  if (m === 5) return 'Memorial Day';
  if (m === 6) return 'Juneteenth';
  if (m === 7) return 'Independence Day';
  if (m === 9) return 'Labor Day';
  if (m === 11) return 'Thanksgiving';
  if (m === 12 && day <= 6) return 'a national day of mourning';
  return 'Christmas';
}

const opensWhen = (today: Date, next: Date): string => {
  const days = Math.round((next.getTime() - today.getTime()) / 86_400_000);
  const when = days <= 1 ? '' : `${WEEKDAY[next.getDay()]} `;
  const early = EARLY_CLOSES.has(isoDate(next)) ? ' and closes early at 1:00 ET' : '';
  return `It opens ${when}at 9:30 ET${early}.`;
};

/** Where the market is right now, as the brand says it */
export function readMarketState(now: Date = new Date()): MarketState {
  const clock = readSessionClock(now);
  const today = nyDate(now);
  const key = isoDate(today);
  if (MARKET_HOLIDAYS.has(key)) {
    const next = nextTradingDay(today);
    return { kind: 'holiday', word: 'closed', line: `Closed for ${holidayName(today)}. ${opensWhen(today, next).replace('It opens', 'The market opens')}` };
  }
  if (clock.phase === 'PREMARKET') {
    const early = EARLY_CLOSES.has(key) ? ' Early close today at 1:00 ET.' : '';
    return { kind: 'pre-market', word: 'closed', line: `Pre-market. The market opens at 9:30 ET.${early}` };
  }
  if (clock.phase === 'OPEN' || clock.phase === 'AUCTION') {
    if (EARLY_CLOSES.has(key)) {
      /* the session clock runs to 16:00; an early close stops at 13:00 */
      if (Number(clock.etTime.slice(0, 2)) >= 13) return { kind: 'closed', word: 'closed', line: `The market closed early at 1:00 ET. ${opensWhen(today, nextTradingDay(today))}` };
      return { kind: 'early-close', word: 'live', line: 'Early close today at 1:00 ET.' };
    }
    return { kind: 'open', word: 'live', line: 'The market is open.' };
  }
  /* after the close, a weekend */
  const next = nextTradingDay(today);
  return { kind: 'closed', word: 'closed', line: `The market is closed. ${opensWhen(today, next)}` };
}
