/*
==================================================
  SLAYER TERMINAL - WHERE THE DAY STANDS (components/layout/SessionStrip.tsx)

  The session strip (2026-10-09, the ideas' "session
  in every room"): under the rail's signature, a thin
  track of New York's trading day — pre-market, the
  open, the morning, lunch, the afternoon, power hour,
  the close, after hours — with a mark where the
  clock stands, and one line under it: the phase, and
  how long to the next. Quiet by design: hairline
  tokens, nothing that loops, a step once a second
  with the rail's clock. Settings › The desk turns it
  off; the rail's old line comes back then.

  Every phase is New York's (core/nyTime.ts), whatever
  the machine's zone; a weekend or a holiday says so
  and names the next open.
==================================================
*/

import { nyParts, minuteLabel } from '../../core/nyTime';
import { MARKET_HOLIDAYS } from '../../core/calendar';

export interface Phase {
  /** minutes since New York's midnight */
  from: number;
  to: number;
  name: string;
  /** inside the cash session (09:30–16:00) */
  cash: boolean;
}

/** The trading day, in New York minutes — the track draws 04:00 to 20:00 */
export const PHASES: Phase[] = [
  { from: 240, to: 570, name: 'Pre-market', cash: false },
  { from: 570, to: 600, name: 'The open', cash: true },
  { from: 600, to: 690, name: 'Morning', cash: true },
  { from: 690, to: 810, name: 'Lunch', cash: true },
  { from: 810, to: 900, name: 'Afternoon', cash: true },
  { from: 900, to: 950, name: 'Power hour', cash: true },
  { from: 950, to: 960, name: 'The close', cash: true },
  { from: 960, to: 1200, name: 'After hours', cash: false },
];
const DAY_FROM = 240;
const DAY_TO = 1200;

const isTradingDay = (y: number, m: number, d: number, weekday: number): boolean =>
  weekday !== 0 && weekday !== 6 && !MARKET_HOLIDAYS.has(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);

/** "1:12" or "12m" — the time to the next phase */
const span = (mins: number): string => {
  const m = Math.max(0, Math.ceil(mins));
  return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}` : `${m}m`;
};

export interface DayRead {
  /** the phase now, or null outside the day (overnight, a weekend, a holiday) */
  phase: Phase | null;
  /** "Lunch" / "Overnight" / "Closed for the weekend" */
  name: string;
  /** "Afternoon in 0:42" — what comes next and when */
  next: string;
  /** where the clock stands on the track, 0–1, or null when it is not a trading day */
  at: number | null;
}

/** Where New York's day stands at `now` */
export function readDay(now: number = Date.now()): DayRead {
  const p = nyParts(now);
  const mins = p.hour * 60 + p.minute + p.second / 60;
  const trading = isTradingDay(p.year, p.month, p.day, p.weekday);
  if (!trading) {
    /* the next trading day's pre-market */
    let label = '';
    for (let i = 1; i <= 7; i++) {
      const q = nyParts(now + i * 86_400_000);
      if (isTradingDay(q.year, q.month, q.day, q.weekday)) {
        label = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][q.weekday];
        break;
      }
    }
    const weekend = p.weekday === 0 || p.weekday === 6;
    return { phase: null, name: weekend ? 'Closed for the weekend' : 'Closed for the holiday', next: label ? `opens ${label} 09:30` : '', at: null };
  }
  const phase = PHASES.find(ph => mins >= ph.from && mins < ph.to) ?? null;
  const at = Math.min(1, Math.max(0, (mins - DAY_FROM) / (DAY_TO - DAY_FROM)));
  if (phase) {
    const i = PHASES.indexOf(phase);
    const after = PHASES[i + 1];
    return { phase, name: phase.name, next: after ? `${after.name.toLowerCase()} in ${span(phase.to - mins)}` : `ends in ${span(phase.to - mins)}`, at };
  }
  /* overnight: before 04:00 the pre-market is today's; after 20:00 it is the next trading day's */
  if (mins < DAY_FROM) return { phase: null, name: 'Overnight', next: `pre-market in ${span(DAY_FROM - mins)}`, at: 0 };
  return { phase: null, name: 'Overnight', next: `pre-market ${minuteLabel(DAY_FROM)}`, at: 1 };
}

const pct = (m: number) => `${((m - DAY_FROM) / (DAY_TO - DAY_FROM)) * 100}%`;

/** The track and its line — drawn by the rail (open) and the phone's menu */
const SessionStrip = ({ read, time, className = '' }: { read: DayRead; time: string; className?: string }) => (
  <div className={className} data-session-strip>
    <div
      className="relative h-[5px] mt-2 rounded-full bg-ink/[0.06] overflow-hidden"
      role="img"
      aria-label={`New York's trading day: ${read.name}${read.next ? `, ${read.next}` : ''}`}
    >
      {PHASES.map(ph => (
        <span
          key={ph.name}
          className={`absolute inset-y-0 ${ph.cash ? 'bg-ink/[0.14]' : 'bg-ink/[0.05]'} ${read.phase === ph ? '!bg-silver/60' : ''}`}
          style={{ left: pct(ph.from), width: `calc(${pct(ph.to)} - ${pct(ph.from)} - 1px)` }}
          title={`${ph.name} · ${minuteLabel(ph.from)}–${minuteLabel(ph.to)} ET`}
          aria-hidden
        />
      ))}
      {read.at != null && <span className="absolute inset-y-0 w-[2px] -ml-px bg-textPrimary" style={{ left: `${read.at * 100}%` }} aria-hidden data-session-now />}
    </div>
    <span className="mt-1.5 flex items-center gap-2 text-[10px] tnum">
      <span className="min-w-0 truncate text-textSecondary" data-session-line>
        {read.name}
        {read.next && <span className="text-textMuted"> · {read.next}</span>}
      </span>
      <span className="ml-auto shrink-0 text-textMuted select-none" data-session-time>
        {time}
      </span>
    </span>
  </div>
);

export default SessionStrip;

/** The rail's clock in the reader's choice (Settings › The desk › Clock — the audit's X2.6: it was always the
    machine's, with no zone, beside New York's "Market open"): "14:03:42 ET", or the machine's own with its zone */
export function railClock(zone: 'ny' | 'local', now: number = Date.now()): string {
  if (zone === 'ny') {
    const p = nyParts(now);
    return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}:${String(p.second).padStart(2, '0')} ET`;
  }
  try {
    const parts = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZoneName: 'short' }).formatToParts(new Date(now));
    const get = (t: string) => parts.find(x => x.type === t)?.value ?? '';
    return `${get('hour')}:${get('minute')}:${get('second')} ${get('timeZoneName')}`.trim();
  } catch {
    return new Date(now).toLocaleTimeString('en-GB', { hour12: false });
  }
}
