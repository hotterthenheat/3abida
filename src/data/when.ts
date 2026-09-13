/*
==================================================
  SLAYER TERMINAL - HOW LONG AGO (data/when.ts)

  One clock for the room and the feedback board.
  There were three copies of this, in two formats
  (2026-09-13): the room said "1h", the board said
  "1h ago", and the same reply read differently
  depending on which page you found it on.

  Two readings, one implementation:

    timeShort   "now · 4m · 3h · 2d"   a feed, where
                the age rides beside a handle and
                every character is in the way
    timeAgo     "just now · 4m ago …"  a thread or a
                row, where it is read as a sentence

  Both floor to the unit — an age is a whisper, and
  "3h" that is really 3h51m is not a number anyone
  acts on. The seconds are never shown: a post is
  never that fresh by the time it is read.
==================================================
*/

const MINUTE = 60_000;

/** Whole minutes since `iso`, never negative — a clock skew reads as "now". */
const minutesSince = (iso: string): number => {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / MINUTE));
};

/** "now · 4m · 3h · 2d" — the feed's reading, beside a handle */
export const timeShort = (iso: string): string => {
  const m = minutesSince(iso);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
};

/** "just now · 4m ago · 3h ago · 2d ago" — a thread's reading, as a sentence */
export const timeAgo = (iso: string): string => {
  const m = minutesSince(iso);
  if (m < 1) return 'just now';
  return `${timeShort(iso)} ago`;
};

/** "in 12m · in 3h · in 2d" — the other direction, for something still to come */
export const timeUntil = (iso: string): string => {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const m = Math.max(0, Math.floor((t - Date.now()) / MINUTE));
  if (m < 1) return 'any moment';
  if (m < 60) return `in ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `in ${h}h`;
  return `in ${Math.floor(h / 24)}d`;
};
