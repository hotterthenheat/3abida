/*
==================================================
  SLAYER TERMINAL - WHERE THE DAY STANDS (components/layout/SessionStrip.tsx)

  The session strip (2026-10-09, the ideas' "session
  in every room"): under the rail's signature, a thin
  track of New York's trading day — pre-market, the
  open, the morning, lunch, the afternoon, power hour,
  the closing auction, after hours — with a mark where
  the clock stands, and one line under it: the phase,
  and how long to the close (in the session) or to the
  next phase (outside it). Quiet by design: hairline
  tokens, nothing that loops, a step once a second
  with the rail's clock. Settings › The desk turns it
  off; the rail's old line comes back then.

  Every phase is New York's (core/nyTime.ts), whatever
  the machine's zone; a weekend or a holiday says so
  and names the next open.
==================================================
*/

import { nyParts, minuteLabel, marketClock, clock, viewerZone } from '../../core/nyTime';
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
  /* 3:50 is the closing auction's cutoff (MOC and LOC orders in by then), not the close: named so since 2026-10-14 — the
     owner, of "the close in 32m" at 3:19 pm: "the close is 41 minutes away … count to 4:00 pm ET, or label it as the
     closing-auction cutoff" */
  { from: 950, to: 960, name: 'Closing auction', cash: true },
  { from: 960, to: 1200, name: 'After hours', cash: false },
];
const DAY_FROM = 240;
const DAY_TO = 1200;
/** The cash close, 4:00 pm New York */
const CASH_TO = 960;

const isTradingDay = (y: number, m: number, d: number, weekday: number): boolean =>
  weekday !== 0 && weekday !== 6 && !MARKET_HOLIDAYS.has(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);

/** "1h 12m" or "12m" — the time to the next phase (a span, never written like a clock) */
const span = (mins: number): string => {
  const m = Math.max(0, Math.ceil(mins));
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
};

export interface DayRead {
  /** the phase now, or null outside the day (overnight, a weekend, a holiday) */
  phase: Phase | null;
  /** "Lunch" / "Overnight" / "Closed for the weekend" */
  name: string;
  /** "afternoon in 42m" — what comes next and when */
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
      const on = now + i * 86_400_000;
      const q = nyParts(on);
      if (isTradingDay(q.year, q.month, q.day, q.weekday)) {
        /* New York's 09:30 on that day, on the reader's clock */
        label = `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][q.weekday]} ${marketClock(9, 30, { on })}`;
        break;
      }
    }
    const weekend = p.weekday === 0 || p.weekday === 6;
    return { phase: null, name: weekend ? 'Closed for the weekend' : 'Closed for the holiday', next: label ? `opens ${label}` : '', at: null };
  }
  const phase = PHASES.find(ph => mins >= ph.from && mins < ph.to) ?? null;
  const at = Math.min(1, Math.max(0, (mins - DAY_FROM) / (DAY_TO - DAY_FROM)));
  if (phase) {
    const i = PHASES.indexOf(phase);
    const after = PHASES[i + 1];
    /* THE COUNT IS TO THE CLOSE (2026-10-14): in the cash session the line counts to 4:00 pm New York, whatever phase the
       clock is in — "the close in 41m" — never to the next phase's edge (at 3:19 pm it said "the close in 32m": the 3:50
       cutoff). Outside the session it counts to the next phase as before (the open, the pre-market, the end of after
       hours). */
    if (phase.cash) return { phase, name: phase.name, next: `the close in ${span(CASH_TO - mins)}`, at };
    return { phase, name: phase.name, next: after ? `${after.name.toLowerCase()} in ${span(phase.to - mins)}` : `ends in ${span(phase.to - mins)}`, at };
  }
  /* overnight: before 04:00 the pre-market is today's; after 20:00 it is the next trading day's */
  if (mins < DAY_FROM) return { phase: null, name: 'Overnight', next: `pre-market in ${span(DAY_FROM - mins)}`, at: 0 };
  return { phase: null, name: 'Overnight', next: `pre-market ${minuteLabel(DAY_FROM, now + 86_400_000)}`, at: 1 };
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
          title={`${ph.name} · ${minuteLabel(ph.from)}–${minuteLabel(ph.to)} ${viewerZone()}${ph.from === 950 ? ' · market-on-close and limit-on-close orders are in by its start; the close is at its end' : ''}`}
          aria-hidden
        />
      ))}
      {read.at != null && <span className="absolute inset-y-0 w-[2px] -ml-px bg-textPrimary" style={{ left: `${read.at * 100}%` }} aria-hidden data-session-now />}
    </div>
    {/* at the 11 px floor the phase and the clock share the rail's width on one line when they fit, two when not —
        never a cut "pre-market …" */}
    <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] tnum">
      <span className="min-w-0 text-textSecondary" data-session-line>
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

/** The rail's clock — THE READER'S, always (2026-10-13 — the owner: every time on screen in the viewer's own zone, 12-hour
    with am/pm): "3:35:42 pm EDT". `zone` is Settings › The desk's old pick, kept by the callers' signature and no longer
    read — the phases above stay New York's, the clock is printed on the reader's. */
export function railClock(_zone: 'ny' | 'local', now: number = Date.now()): string {
  return clock(now, { seconds: true, zone: true });
}
