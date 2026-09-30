/*
==================================================
  SLAYER TERMINAL - WHEN, ON THE RECORD
  (components/record/when.tsx)

  A date on the record is a DATE, with the distance
  beside it (the partner's review, 2026-09-13: "the
  WHEN should not be '9d ago' cause who is naming
  what 9 days ago was — have specific dates, or
  '9/19 · 2 days ago'"). The engines carry days-ago
  offsets; this turns one into the calendar day it
  names on the terminal's own clock, and the words
  that say how far back that is: "09/11 · 2d ago",
  the date in the primary ink, the distance muted,
  the weekday in the title.
==================================================
*/

import { now } from '../../core/clock';

export interface WhenParts {
  /** "09/11" */
  date: string;
  /** "today" · "yesterday" · "2d ago" */
  ago: string;
  /** "Thu 09/11" — for a sentence or a title */
  long: string;
}

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const two = (n: number) => String(n).padStart(2, '0');

/** The calendar day `daysAgo` days before today, on the terminal's clock */
export const dayBefore = (daysAgo: number, from: Date = now()): Date => {
  const d = new Date(from);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - Math.max(0, Math.round(daysAgo)));
  return d;
};

export const agoWords = (daysAgo: number): string => (daysAgo <= 0 ? 'today' : daysAgo === 1 ? 'yesterday' : `${daysAgo}d ago`);

export const whenParts = (daysAgo: number, from: Date = now()): WhenParts => {
  const d = dayBefore(daysAgo, from);
  const date = `${two(d.getMonth() + 1)}/${two(d.getDate())}`;
  return { date, ago: agoWords(daysAgo), long: `${WEEKDAY[d.getDay()]} ${date}` };
};

/** The date and its distance, as one cell: "09/11 · 2d ago" */
export const When = ({ days, size = 11 }: { days: number; size?: 10 | 11 }) => {
  const w = whenParts(days);
  return (
    <span className={`font-mono tnum whitespace-nowrap ${size === 11 ? 'text-[11px]' : 'text-[10px]'}`} title={w.long} data-when={w.date} data-when-ago={days}>
      <span className="text-textPrimary">{w.date}</span>
      <span className="text-textMuted"> · {w.ago}</span>
    </span>
  );
};
