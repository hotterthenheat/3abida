/*
==================================================
  SLAYER TERMINAL - THE SESSION CLOCK
  (data/sessionClock.ts)

  Where the New York session is right now — before
  the open, open, the closing auction, after the
  close, or shut for a weekend or a holiday — and how
  long until the 16:00 cross. The rail's clock, the
  session chip and the book's read all ask it.

  (It lived in moc.ts beside a closing-auction engine
  nothing read; the engine went on 2026-09-30.)
==================================================
*/

import { MARKET_HOLIDAYS } from '../core/calendar';

export type SessionPhase = 'PREMARKET' | 'OPEN' | 'AUCTION' | 'AFTERHOURS' | 'CLOSED';

/** Whether the auction book is actually publishing right now. */
export type AuctionStatus = 'PUBLISHING' | 'PROJECTED' | 'CLOSED';

export interface SessionClock {
  /** Wall clock in New York, HH:MM:SS */
  etTime: string;
  phase: SessionPhase;
  /** Plain label for the phase */
  label: string;
  /** Seconds until the 16:00 cross — 0 when there is no cross left today */
  secondsToClose: number;
  /** H:MM:SS until the cross, or null when there isn't one coming */
  countdown: string | null;
  /** True from 15:50 — when the book actually starts publishing */
  auctionOpen: boolean;
  auctionStatus: AuctionStatus;
  /** True on weekends and market holidays */
  marketClosedToday: boolean;
}

/*
  US market holidays now live in core/calendar.ts — the weigher needed the same
  list to stop naming Saturday expiries, and two copies of a calendar is how
  they drift. Replace with the exchange calendar when the real feed lands.
*/

// One formatter, reused — this runs once a second.
const NY_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York',
  hour12: false,
  weekday: 'short',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/** Where the New York session is right now — timezone-correct for any viewer. */
export function readSessionClock(now: Date = new Date()): SessionClock {
  const parts = Object.fromEntries(NY_FMT.formatToParts(now).map(p => [p.type, p.value]));
  const weekday = String(parts.weekday ?? '');
  // Intl can hand back "24" at midnight
  const hour = Number(parts.hour) % 24;
  const minute = Number(parts.minute);
  const second = Number(parts.second);
  const isoDay = `${parts.year}-${parts.month}-${parts.day}`;

  const mins = hour * 60 + minute;
  const closeMins = 16 * 60;
  const isWeekend = weekday === 'Sat' || weekday === 'Sun';
  const isHoliday = MARKET_HOLIDAYS.has(isoDay);
  const marketClosedToday = isWeekend || isHoliday;
  const etTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;

  let phase: SessionPhase;
  if (marketClosedToday) phase = 'CLOSED';
  else if (mins < 9 * 60 + 30) phase = 'PREMARKET';
  else if (mins >= closeMins) phase = 'AFTERHOURS';
  else if (mins >= 15 * 60 + 50) phase = 'AUCTION';
  else phase = 'OPEN';

  // Only a live session has a cross still ahead of it.
  const tradingNow = phase === 'OPEN' || phase === 'AUCTION';
  const secondsToClose = tradingNow ? Math.max(0, (closeMins - mins) * 60 - second) : 0;
  const hh = Math.floor(secondsToClose / 3600);
  const mm = Math.floor((secondsToClose % 3600) / 60);
  const ss = secondsToClose % 60;

  const label = isHoliday
    ? 'Market closed — holiday'
    : isWeekend
      ? 'Market closed for the weekend'
      : phase === 'PREMARKET'
        ? 'Before the open'
        : phase === 'AFTERHOURS'
          ? weekday === 'Fri'
            ? 'Closed — next session Monday'
            : 'After the close'
          : phase === 'AUCTION'
            ? 'Closing auction — the book is publishing'
            : 'Market open';

  return {
    etTime,
    phase,
    label,
    secondsToClose,
    countdown: tradingNow ? `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : null,
    auctionOpen: phase === 'AUCTION',
    auctionStatus: phase === 'AUCTION' ? 'PUBLISHING' : phase === 'OPEN' ? 'PROJECTED' : 'CLOSED',
    marketClosedToday,
  };
}
