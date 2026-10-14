/*
  THE SESSION DATE UNDER A DAY BAR, IN EVERY ZONE (2026-10-14 — the owner: "Daily bars: label each bar with its New York
  session date in every viewer zone. Test with a Pacific and an Asia zone"). A day bar's stamp is the session's noon UTC
  (data/feed/levels.ts dayTime), the house's UTC midnight, a week's its Monday's; chartTime.ts sessionTickMarks and
  SESSION_TIME read the session's date in New York twelve hours on from the stamp. This proof runs them with the
  process's zone switched (Node re-reads TZ at runtime) — the Pacific, Tokyo, Sydney and Honolulu — on every stamp
  shape, and the behaviour's weights across a month's edge, and prints each zone's answer.

    tsx scripts/session-date-proof.ts     (in `npm test`)
*/
import { TickMarkType } from 'lightweight-charts';
import { SESSION_TIME, fmtDayLocal, localCalendarBehavior, sessionDateOf, sessionTickMarks } from '../src/components/gex/chartTime';
import { nyWallTime } from '../src/core/nyTime';

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (ok) pass++;
  else fail++;
};

/* the stamps a day bar for 2026-10-13 (a Tuesday) can carry, each in epoch seconds */
const SESSION = { y: 2026, m: 10, d: 13 };
const stamps: Record<string, number> = {
  'noon UTC (the feed, levels.ts dayTime)': Date.UTC(2026, 9, 13, 12) / 1000,
  'UTC midnight (the house tape)': Date.UTC(2026, 9, 13, 0) / 1000,
  'New York midnight': nyWallTime(2026, 10, 13, 0, 0) / 1000,
  "New York's open, 09:30": nyWallTime(2026, 10, 13, 9, 30) / 1000,
};
const ZONES = ['America/Los_Angeles', 'Asia/Tokyo', 'Australia/Sydney', 'Pacific/Honolulu', 'America/New_York', 'UTC'];
const dayOf = (t: number): string => sessionTickMarks(t as never, TickMarkType.DayOfMonth, 0 as never) as string;
const monthOf = (t: number): string => sessionTickMarks(t as never, TickMarkType.Month, 0 as never) as string;

for (const zone of ZONES) {
  process.env.TZ = zone;
  for (const [how, t] of Object.entries(stamps)) {
    const s = sessionDateOf(t as never);
    const viewer = fmtDayLocal(t as never);
    const ok = s.y === SESSION.y && s.m === SESSION.m && s.d === SESSION.d && dayOf(t) === '13' && monthOf(t) === 'Oct' && SESSION_TIME.timeFormatter(t as never) === 'Oct 13';
    check(`${zone} · ${how}: the session reads Oct 13 (tick "${dayOf(t)}", stamp "${SESSION_TIME.timeFormatter(t as never)}"; the viewer's own calendar says "${viewer}")`, ok);
  }
}

/* the weights across a month's edge, on the session dates: Sep 30 and Oct 1 2026 as noon-UTC day bars — the month tick
   stands on Oct 1's bar in every zone (on the viewer's calendar a Sydney reader had it a bar late) */
{
  const Behaviour = localCalendarBehavior();
  const bars = [Date.UTC(2026, 8, 29, 12), Date.UTC(2026, 8, 30, 12), Date.UTC(2026, 9, 1, 12), Date.UTC(2026, 9, 2, 12)].map(ms => ms / 1000);
  for (const zone of ['America/Los_Angeles', 'Australia/Sydney']) {
    process.env.TZ = zone;
    const b = new Behaviour();
    b.sessionDates = true;
    const points = bars.map(t => ({ time: t as never, originalTime: t as never, timeWeight: 0 }));
    b.fillWeightsForPoints(points as never, 0);
    const weights = points.map(p => p.timeWeight);
    check(`${zone} · the month tick stands on Oct 1's bar (weights ${weights.join(', ')})`, weights[2] === 60 && weights[1] === 50 && weights[3] === 50);
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
