/*
==================================================
  SLAYER TERMINAL - THE REPLAY'S CLOCK AND FRAME
  (data/replayFrame.ts)

  The owner's item 8 (2026-10-14): "play/pause, step
  one bar, speed 1x/5x/20x/60x, jump to time, random
  start (random session and time) … Ladder ghost dots:
  each strike's value 10, 30 and 60 min before the
  cursor. Hide-the-future cutoff on by default …
  Point-in-time: the data layer asserts every read <=
  cursor".

  THE CURSOR is one minute: the start (epoch s) of the
  newest one-minute bar a frame holds. That minute is
  knowable at its end, so every read a frame makes must
  stand at or before cursor + 60 s (`knowableAt`).

  A FRAME IS THE LIVE PAGE ON A TAPE CUT AT THE CURSOR.
  Terrain hands its chart the same tape it draws live —
  the minutes, the field's columns, the day bars, the
  compares — cut here, so every overlay the chart draws
  reads only what stood at the cursor, through the code
  that drew it live: the replay's frame is the live
  frame by construction. The levels, the ladder and its
  ghost dots are read off the column at the cursor
  (frameAt, laggedAt) by the store's own summary.

  THE GUARD: every cut and read here names the moment it
  stands on; a guard handed in counts each one and keeps
  any past the cursor (scripts/replay-proof.ts runs whole
  sessions through it, with the model's own reads
  probed — trailModel setPitProbe).
==================================================
*/

import type { Candle, GexSnapshot } from '../types/market';
import { nyIsoDate, nyWallTime } from '../core/nyTime';
import { EARLY_CLOSES } from './marketState';
import { columnSummary } from './feed/trailModel';
import { minuteRefs, columnMax } from './feed/beadScale';

/** The speeds, as multiples of the market's own time: 1× a minute of tape a minute, 60× a minute a second */
export const REPLAY_SPEEDS = [1, 5, 20, 60] as const;
export type ReplaySpeed = (typeof REPLAY_SPEEDS)[number];
/** Real milliseconds between two minutes of tape at a speed */
export const msPerMinute = (speed: ReplaySpeed): number => 60_000 / speed;
/** The ladder's ghost dots: each strike's value this many minutes before the cursor */
export const GHOST_LAGS = [10, 30, 60] as const;
/** The instant a cursor's minute is knowable — its end (epoch ms) */
export const knowableAt = (cursor: number): number => (cursor + 60) * 1000;

/* ---- the guard ------------------------------------------------------------------------------------------------- */

export interface PitGuard {
  cursor: number;
  /** Every read counted */
  reads: number;
  /** The reads past the cursor's minute, with what they were */
  late: { what: string; at: number }[];
}
export const pitGuard = (cursor: number): PitGuard => ({ cursor, reads: 0, late: [] });
/** One read at `stampMs` — the moment the thing read became knowable */
export function pitRead(g: PitGuard | null | undefined, what: string, stampMs: number): void {
  if (!g) return;
  g.reads++;
  if (stampMs > knowableAt(g.cursor)) g.late.push({ what, at: stampMs });
}

/* ---- lists in time --------------------------------------------------------------------------------------------- */

/** How many of an ascending list stand at or before `t` (epoch s) */
export function countAtOrBefore<T>(list: readonly T[], t: number, timeOf: (x: T) => number): number {
  let lo = 0;
  let hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (timeOf(list[mid]) <= t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
/** The index of the newest item at or before `t`, −1 for none */
export const lastAtOrBefore = <T>(list: readonly T[], t: number, timeOf: (x: T) => number): number => countAtOrBefore(list, t, timeOf) - 1;

/** THE CUT: the items of an ascending list at or before the cursor's minute — a bar or a column names its minute's start
    and is knowable at its end; each kept item is read through the guard when one is given */
export function cutAt<T>(list: readonly T[], cursor: number, timeOf: (x: T) => number, what: string, guard?: PitGuard | null): T[] {
  const out = list.slice(0, countAtOrBefore(list, cursor, timeOf));
  if (guard) for (const x of out) pitRead(guard, what, (timeOf(x) + 60) * 1000);
  return out;
}

/**
 * A list cut at a moving cursor, GROWN IN PLACE as the cursor moves on — a chart's folds (timeframe.ts) keep their work on
 * an array that only grows — and cut afresh when the cursor moves back or the source's history changes. `version` moves
 * on every change, for a host to key its tape on.
 */
export class GrowingCut<T> {
  private src: readonly T[] | null = null;
  private out: T[] = [];
  private at = -Infinity;
  version = 0;
  constructor(private readonly timeOf: (x: T) => number, private readonly same: (a: T, b: T) => boolean = (a, b) => a === b) {}
  cut(src: readonly T[], cursor: number): T[] {
    const n = countAtOrBefore(src, cursor, this.timeOf);
    /* a source replaced by the feed's next poll whose past is the same: the cut stands, no reload */
    const samePast = src !== this.src && this.src !== null && cursor === this.at && n === this.out.length && (n === 0 || this.same(src[n - 1], this.out[n - 1]));
    if (samePast) {
      this.src = src;
      return this.out;
    }
    if (src !== this.src || cursor < this.at) {
      this.src = src;
      this.out = src.slice(0, n);
      this.at = cursor;
      this.version++;
      return this.out;
    }
    if (n !== this.out.length) {
      for (let k = this.out.length; k < n; k++) this.out.push(src[k]);
      this.version++;
    }
    this.at = cursor;
    return this.out;
  }
}

/* ---- the session ----------------------------------------------------------------------------------------------- */

/** A session's regular minutes, as bar starts (epoch s): the open's minute to the last before the close (13:00 on a half
    day); `close` the close's instant (epoch s) */
export function sessionSpan(day: string): { first: number; last: number; close: number; minutes: number } {
  const [y, m, d] = day.split('-').map(Number);
  const first = nyWallTime(y, m, d, 9, 30) / 1000;
  const closeMin = EARLY_CLOSES.has(day) ? 13 * 60 : 16 * 60;
  const close = nyWallTime(y, m, d, Math.floor(closeMin / 60), closeMin % 60) / 1000;
  return { first, last: close - 60, close, minutes: Math.round((close - first) / 60) };
}

/** The day bars at a cursor: the sessions before its New York date whole (each knowable at its own close), its own day
    folded from its regular minutes so far, stamped at noon UTC of the date (the feed's day bars' stamp) */
export function dailyAt(daily: readonly Candle[], minutes: readonly Candle[], cursor: number, guard?: PitGuard | null): Candle[] {
  const day = nyIsoDate(cursor * 1000);
  const out: Candle[] = [];
  for (const b of daily) {
    const d = nyIsoDate(b.time * 1000);
    if (d >= day) break;
    if (guard) pitRead(guard, 'day bar', sessionSpan(d).close * 1000);
    out.push(b);
  }
  const span = sessionSpan(day);
  let bar: Candle | null = null;
  for (let i = countAtOrBefore(minutes, span.first - 1, b => b.time); i < minutes.length; i++) {
    const m = minutes[i];
    if (m.time > Math.min(cursor, span.last)) break;
    pitRead(guard, 'minute', (m.time + 60) * 1000);
    if (!bar) {
      const [y, mo, d] = day.split('-').map(Number);
      bar = { time: Date.UTC(y, mo - 1, d, 12) / 1000, open: m.open, high: m.high, low: m.low, close: m.close, volume: m.volume ?? 0 };
    } else {
      bar.high = Math.max(bar.high, m.high);
      bar.low = Math.min(bar.low, m.low);
      bar.close = m.close;
      bar.volume = (bar.volume ?? 0) + (m.volume ?? 0);
    }
  }
  if (bar) out.push(bar);
  return out;
}

/* ---- the frame ------------------------------------------------------------------------------------------------- */

export interface ReplayFrame {
  cursor: number;
  /** New York's date of the cursor */
  day: string;
  /** The minute at the cursor (null: the tape holds none at or before it) */
  bar: Candle | null;
  /** The field's column at the cursor — null where the field has none for its minute (a gap, or before the field) */
  column: GexSnapshot | null;
  spot: number;
  flip: number | null;
  cw: number | null;
  pw: number | null;
  /** The heaviest strikes, [strike, net], heaviest first */
  top: [number, number][];
  net: number;
  /** The bead scale's reference at the cursor: the session's running p85 of its minutes' peaks (beadScale.ts) */
  ref: number;
}

/** The newest column of the cursor's own session at or before it, standing within `slackMin` of it — a column further back
    is the field's gap, said as none */
export function columnAt(cols: readonly GexSnapshot[], t: number, slackMin = 2): GexSnapshot | null {
  const i = lastAtOrBefore(cols, t, c => c.time);
  if (i < 0) return null;
  const c = cols[i];
  return t - c.time <= slackMin * 60 && nyIsoDate(c.time * 1000) === nyIsoDate(t * 1000) ? c : null;
}

/**
 * THE FRAME AT THE CURSOR off the tape cut there: the minute at it, the field's column at it and its levels by the
 * store's own summary (trailModel columnSummary — what a shown row records), and the bead reference as of it.
 */
export function frameAt(bars: readonly Candle[], cols: readonly GexSnapshot[], cursor: number, guard?: PitGuard | null): ReplayFrame {
  const bi = lastAtOrBefore(bars, cursor, b => b.time);
  const bar = bi >= 0 ? bars[bi] : null;
  if (bar) pitRead(guard, 'bar', (bar.time + 60) * 1000);
  const day = nyIsoDate(cursor * 1000);
  const column = columnAt(cols, cursor);
  if (column) pitRead(guard, 'column', (column.time + 60) * 1000);
  const spot = bar?.close ?? NaN;
  const sum = column ? columnSummary(column, spot) : null;
  /* the reference: the session's minutes so far, the one count the beads draw by */
  let ref = 0;
  if (column) {
    const from = countAtOrBefore(cols, sessionDayStart(day) - 1, c => c.time);
    const to = countAtOrBefore(cols, cursor, c => c.time);
    const times: number[] = [];
    const maxima: number[] = [];
    for (let i = from; i < to; i++) {
      pitRead(guard, 'column (reference)', (cols[i].time + 60) * 1000);
      times.push(cols[i].time);
      maxima.push(columnMax(cols[i].levels));
    }
    const r = minuteRefs(times, maxima, t => nyIsoDate(t * 1000)).ref;
    ref = r.length ? r[r.length - 1] : 0;
  }
  return { cursor, day, bar, column, spot, flip: sum?.flip ?? null, cw: sum?.cw ?? null, pw: sum?.pw ?? null, top: sum?.top ?? [], net: sum?.net ?? 0, ref };
}
/** New York's midnight of a date, epoch s */
const sessionDayStart = (day: string): number => {
  const [y, m, d] = day.split('-').map(Number);
  return nyWallTime(y, m, d, 0, 0) / 1000;
};

/**
 * THE GHOST DOTS: each strike's value `lags` minutes before the cursor — the newest column (or book) of the cursor's own
 * session at or before that moment, standing within `slackMin` of it, else none for that lag.
 */
export function laggedAt(
  cols: readonly { time: number; levels: readonly { strike: number; value: number }[] }[],
  cursor: number,
  lags: readonly number[] = GHOST_LAGS,
  slackMin = 2,
  guard?: PitGuard | null
): Map<number, (number | null)[]> {
  const out = new Map<number, (number | null)[]>();
  const day = nyIsoDate(cursor * 1000);
  lags.forEach((lag, k) => {
    const t = cursor - lag * 60;
    const i = lastAtOrBefore(cols, t, c => c.time);
    if (i < 0) return;
    const c = cols[i];
    if (t - c.time > slackMin * 60 || nyIsoDate(c.time * 1000) !== day) return;
    pitRead(guard, `column ${lag} min before`, (c.time + 60) * 1000);
    for (const l of c.levels) {
      let row = out.get(l.strike);
      if (!row) out.set(l.strike, (row = lags.map(() => null)));
      row[k] = l.value;
    }
  });
  return out;
}

/* ---- moving the cursor ----------------------------------------------------------------------------------------- */

/** The cursor one bar of `mins` minutes on (dir 1: to the end of the bar the cursor stands in, or the next one's when it
    stands at its end) or back (dir −1: to the end of the bar before) — always a minute the tape holds. On 1D and up a
    bar is a New York day. */
export function stepCursor(bars: readonly Candle[], cursor: number, mins: number, dir: 1 | -1): number {
  const i = lastAtOrBefore(bars, cursor, b => b.time);
  if (i < 0) return bars.length ? bars[0].time : cursor;
  const daily = mins >= 1440;
  const bucketOf = (t: number) => (daily ? sessionDayStart(nyIsoDate(t * 1000)) : Math.floor(t / (mins * 60)) * mins * 60);
  const sameBucket = (a: number, b: number) => (daily ? nyIsoDate(a * 1000) === nyIsoDate(b * 1000) : bucketOf(a) === bucketOf(b));
  if (dir > 0) {
    if (i + 1 >= bars.length) return cursor;
    /* at its bar's end already: the next bar's end; else this bar's end */
    const atEnd = !sameBucket(bars[i + 1].time, cursor);
    const from = atEnd ? i + 1 : i;
    let j = from;
    while (j + 1 < bars.length && sameBucket(bars[j + 1].time, bars[from].time)) j++;
    return bars[j].time;
  }
  /* back: the last minute before the cursor's bar began */
  let j = i;
  while (j >= 0 && sameBucket(bars[j].time, cursor)) j--;
  return j >= 0 ? bars[j].time : bars[0].time;
}

/** The tape's minutes of one New York date (bar starts, ascending) */
export function dayMinutes(bars: readonly Candle[], day: string): number[] {
  const [y, m, d] = day.split('-').map(Number);
  const from = nyWallTime(y, m, d, 0, 0) / 1000;
  const to = from + 86_400 + 3600;
  const out: number[] = [];
  for (let i = countAtOrBefore(bars, from - 1, b => b.time); i < bars.length && bars[i].time < to; i++) if (nyIsoDate(bars[i].time * 1000) === day) out.push(bars[i].time);
  return out;
}

/** The New York dates the tape holds, oldest first */
export function tapeDays(bars: readonly Candle[]): string[] {
  const out: string[] = [];
  let hour = NaN;
  for (const b of bars) {
    const h = Math.floor(b.time / 3600);
    if (h === hour) continue;
    hour = h;
    const d = nyIsoDate(b.time * 1000);
    if (out[out.length - 1] !== d) out.push(d);
  }
  return out;
}

/**
 * JUMP TO A TIME: the minute a typed time names among a session's minutes, read on the reader's clock (`print` — the
 * house's clock(), "10:42 am") — "10:42 am", "10:42am", "10:42", "1042". Without am or pm the one reading the session
 * holds is taken (a session is shorter than twelve hours, so there is one). Null when it names none of them.
 */
export function minuteFromText(text: string, minutes: readonly number[], print: (ms: number) => string): number | null {
  const norm = text.trim().toLowerCase().replace(/\s+/g, '').replace('.', ':');
  const m = /^(\d{1,2}):?(\d{2})(am|pm|a|p)?$/.exec(norm);
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  const ap = m[3] ? m[3][0] : null;
  if (mm > 59 || h > 23) return null;
  /* a 24-hour reading typed in is taken as the 12-hour time it is (13:05 is 1:05 pm) — the page never prints one */
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const want = h > 12 ? 'p' : h === 0 ? 'a' : ap;
  for (const t of minutes) {
    const p = /^(\d{1,2}):(\d{2})\s*(am|pm)/.exec(print(t * 1000));
    if (!p) continue;
    if (Number(p[1]) === h12 && Number(p[2]) === mm && (!want || p[3][0] === want)) return t;
  }
  return null;
}

/* ---- the random start ------------------------------------------------------------------------------------------ */

export interface SessionReadiness {
  day: string;
  /** The session's minutes (bar starts, epoch s) a start may land between */
  first: number;
  last: number;
  ready: boolean;
  /** Why it cannot be replayed whole, in the page's words — null when it can */
  why: string | null;
  bars: number;
  columns: number;
  expected: number;
}

/**
 * WHETHER A SESSION CAN BE REPLAYED WHOLE — the random start draws only from these (the owner's acceptance (iii):
 * "random start never lands on a session with missing inputs"): over, every regular minute's bar on the tape, the field's
 * column at every regular minute, and its priced move (`budget`: true in, false not, null where the market has none —
 * the house's).
 */
export function readinessOf(day: string, bars: readonly Candle[], cols: readonly GexSnapshot[], budget: boolean | null, now: number, own?: { first: number; last: number }): SessionReadiness {
  /* a session's regular hours — or, where a market keeps its own hours (the house's, whose sessions run to the moment
     it opened), the span its own minutes cover */
  const span = own ? { first: own.first, last: own.last, close: own.last + 60, minutes: Math.round((own.last - own.first) / 60) + 1 } : sessionSpan(day);
  const inSpan = <T>(list: readonly T[], timeOf: (x: T) => number) => {
    const seen = new Set<number>();
    for (let i = countAtOrBefore(list, span.first - 1, timeOf); i < list.length; i++) {
      const t = timeOf(list[i]);
      if (t > span.last) break;
      if ((t - span.first) % 60 === 0) seen.add(t);
    }
    return seen.size;
  };
  const nb = inSpan(bars, b => b.time);
  const nc = inSpan(cols, c => c.time);
  const base = { day, first: span.first, last: span.last, bars: nb, columns: nc, expected: span.minutes };
  if (span.close * 1000 > now) return { ...base, ready: false, why: 'the session has not closed' };
  if (nb < span.minutes) return { ...base, ready: false, why: `${span.minutes - nb} of its ${span.minutes} minutes have no bar` };
  if (nc < span.minutes) return { ...base, ready: false, why: `${span.minutes - nc} of its ${span.minutes} minutes have no column of the field` };
  if (budget === false) return { ...base, ready: false, why: "its priced move (the prior close's straddle) is not in" };
  return { ...base, ready: true, why: null };
}

/** A RANDOM START: a ready session, and a minute in it with half an hour of it left to play — null with none ready */
export function randomStart(sessions: readonly SessionReadiness[], rng: () => number, leaveMin = 30): { day: string; cursor: number } | null {
  const ready = sessions.filter(s => s.ready);
  if (!ready.length) return null;
  const s = ready[Math.min(ready.length - 1, Math.floor(rng() * ready.length))];
  const minutes = Math.round((s.last - s.first) / 60) + 1;
  const room = Math.max(1, minutes - leaveMin);
  return { day: s.day, cursor: s.first + 60 * Math.min(room - 1, Math.floor(rng() * room)) };
}

/* ---- the recorder's own sessions --------------------------------------------------------------------------------- */

/** The longest gap a kept session's chain reads may leave, minutes — the recorder reads every ten, one refused read is
    twenty */
export const RECORDED_GAP_MIN = 25;
/**
 * WHETHER THE RECORDER KEPT A SESSION WHOLE (server/fieldRecorder.ts recorded): the seed (the session before's close, with
 * its count) and chain reads from the open's first ten minutes to the close's last twenty-five, never more than
 * RECORDED_GAP_MIN apart. A replay of such a session draws what was on screen that day; any other is drawn from the
 * rebuild (server/fieldBackfill.ts).
 */
export function recordingComplete(day: string, readTimes: readonly number[], hasSeed: boolean): { complete: boolean; why: string | null } {
  if (!hasSeed) return { complete: false, why: "no seed (the session before's close)" };
  const span = sessionSpan(day);
  const open = span.first * 1000;
  const close = span.close * 1000;
  const reads = [...readTimes].filter(t => t <= close).sort((a, b) => a - b);
  const first = reads.findIndex(t => t >= open - RECORDED_GAP_MIN * 60_000);
  if (first < 0 || reads[first] > open + 10 * 60_000) return { complete: false, why: 'no chain read by the open' };
  if (reads[reads.length - 1] < close - RECORDED_GAP_MIN * 60_000) return { complete: false, why: 'no chain read near the close' };
  for (let i = first + 1; i < reads.length; i++)
    if (reads[i] - reads[i - 1] > RECORDED_GAP_MIN * 60_000) return { complete: false, why: `a gap of ${Math.round((reads[i] - reads[i - 1]) / 60_000)} minutes between chain reads` };
  return { complete: true, why: null };
}
