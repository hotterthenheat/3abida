/*
  THE CALENDAR'S PARITY FIXTURE (2026-09-17). Runs src/core/calendar.ts over
  every day from 2016 to 2027 and over grids of horizons and instants, and
  writes the answers to engine/tests/fixtures/calendar_ref.json for
  engine/tests/test_calendar_parity.py.

    npx tsx scripts/calendar-ref.ts
*/

import { mkdirSync, writeFileSync } from 'node:fs';
import { expiryFor, futuresPhaseAt, isTradingDay, isoDate, sessionsBetween } from '../src/core/calendar';

const local = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/* every day, is it a session */
const days: { date: string; trading: boolean }[] = [];
for (let d = local('2016-01-01'); d <= local('2027-12-31'); d = addDays(d, 1)) days.push({ date: isoDate(d), trading: isTradingDay(d) });

/* sessions between: from the first of every month, five reaches */
const between: { from: string; to: string; sessions: number }[] = [];
for (let y = 2016; y <= 2027; y++)
  for (let m = 1; m <= 12; m++) {
    const from = new Date(y, m - 1, 1);
    for (const reach of [0, 1, 5, 21, 63, 252, -3]) {
      const to = addDays(from, reach);
      between.push({ from: isoDate(from), to: isoDate(to), sessions: sessionsBetween(from, to) });
    }
  }

/* expiries: from every day of four telling weeks (Good Friday 2019, the 2024→25 turn, a
   September 2026 month, the Bush mourning week), every horizon the desk asks for */
const fromDays: string[] = [];
const weeks: [string, string][] = [
  ['2019-04-15', '2019-04-26'],
  ['2024-12-20', '2025-01-10'],
  ['2026-09-01', '2026-09-30'],
  ['2018-12-03', '2018-12-07'],
];
for (const [a, b] of weeks) for (let d = local(a); d <= local(b); d = addDays(d, 1)) fromDays.push(isoDate(d));
const DTES = [0, 1, 2, 3, 4, 7, 14, 21, 28, 35, 42, 49, 63, 77, 91, 180, 365, 2.5, 0.4];
const expiries: { from: string; dte: number; date: string; label: string; weekday: string; dteOut: number; sessions: number }[] = [];
for (const f of fromDays)
  for (const dte of DTES) {
    const e = expiryFor(dte, local(f));
    expiries.push({ from: f, dte, date: isoDate(e.date), label: e.label, weekday: e.weekday, dteOut: e.dte, sessions: e.sessions });
  }

/* the futures clock: every half hour of one week (UTC instants), plus a holiday */
const phases: { epochMs: number; phase: string }[] = [];
const start = Date.UTC(2026, 8, 13, 0, 0); // Sunday 2026-09-13 00:00 UTC
for (let i = 0; i < 7 * 48; i++) {
  const ms = start + i * 30 * 60 * 1000;
  phases.push({ epochMs: ms, phase: futuresPhaseAt(new Date(ms)) });
}
for (let h = 0; h < 24; h++) {
  const ms = Date.UTC(2026, 10, 26, h, 15); // Thanksgiving 2026, every hour at :15
  phases.push({ epochMs: ms, phase: futuresPhaseAt(new Date(ms)) });
}

const out = { generatedBy: 'scripts/calendar-ref.ts', days, between, expiries, phases };
mkdirSync('engine/tests/fixtures', { recursive: true });
writeFileSync('engine/tests/fixtures/calendar_ref.json', JSON.stringify(out));
console.log(`wrote ${days.length} days, ${between.length} spans, ${expiries.length} expiries, ${phases.length} instants`);
