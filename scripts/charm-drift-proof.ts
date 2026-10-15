/*
  Acceptance test for the charm-to-close drift (data/feed/trailModel.ts driftToClose — the owner's item 10, 2026-10-14):
  "Acceptance: equals model delta at (spot_t, IV_t, 3:50 p.m.) minus model delta at t, by full repricing."
  - on a built universe and on this machine's rebuilt sessions, the column's drift equals the dealers' delta of EVERY
    contract in the universe — every expiry, every strike, not only today's — priced again here, independently, at the
    drift's end minus at the minute, the price and each contract's vol knowable at the minute's end held: to the dollar;
  - a later expiry moves nothing inside a session on UW's clock (whole days), so every window reads the same;
  - the drift ends ten minutes before the day's expiry (3:50 pm; 12:50 pm on a half day) and is absent from then on;
  - a vol received after the minute's end changes nothing (point in time);
  - a window's drift is its partitions summed (driftOf), and a window view carries the drift through.
*/
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { blackScholesGreeks } from '../src/core/greeks';
import { nyWallTime } from '../src/core/nyTime';
import { driftEndOf, driftOf, modelColumn, partOf, universeOf, uwYears, UW_VOL_CONVENTION, windowView, type Universe } from '../src/data/feed/trailModel';
import { createFieldStore } from '../server/fieldStore';
import type { PastDay } from '../server/fieldBackfill';

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (ok) pass++;
  else fail++;
};
const YEAR_MS = 365 * 864e5;

/** THE INDEPENDENT REPRICING: every contract of the universe, the dealers' delta in dollars of the underlying (the
    house's sign — each contract's delta turned over) at `clock`, at the bar's close and each vol knowable at its end;
    by partition. Nothing shared with the model but the pricer and the universe's own fields. */
function dealerDelta(u: Universe, bar: { time: number; close: number }, clock: number): number[] {
  const knowBy = (bar.time + 60) * 1000;
  const out = [0, 0, 0, 0];
  for (let i = 0; i < u.strikes.length; i++)
    for (let j = u.start[i]; j < u.start[i + 1]; j++) {
      if (u.expires[j] <= clock) continue;
      const obs = u.obs[j].filter(o => o.at <= knowBy);
      const ois = u.oiObs[j].filter(o => o.at <= knowBy);
      if (!obs.length || !ois.length || !(ois[ois.length - 1].oi > 0)) continue;
      const iv = obs[obs.length - 1].iv;
      const oi = ois[ois.length - 1].oi;
      /* UW's clock, from the contract's own expiry: today's on the time left, a later one on whole days */
      const tau = u.expiry[j] > u.day ? uwYears(clock, u.expires[j], u.expiry[j], u.day) : (u.expires[j] - clock) / YEAR_MS;
      const g = blackScholesGreeks(bar.close, u.strikes[i], tau, iv, UW_VOL_CONVENTION.r, UW_VOL_CONVENTION.q);
      out[u.part[j]] += -oi * 100 * bar.close * (u.call[j] ? g.deltaCall : g.deltaPut);
    }
  return out;
}
const close = (a: number, b: number) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b));

/* ---- a built universe: today's expiry, its Friday, the monthly, a later one — on a $5 grid round 778 ---------------- */
function built(day: string): Universe {
  const [y, m, d] = day.split('-').map(Number);
  const expiries = [day, '2026-10-16', '2026-10-30', '2026-11-20'];
  const strikes = [760, 765, 770, 775, 780, 785, 790, 795];
  const call: number[] = [];
  const exp: string[] = [];
  const obs: Universe['obs'] = [];
  const oiObs: Universe['oiObs'] = [];
  const start: number[] = [0];
  const open = nyWallTime(y, m, d, 9, 30);
  for (const k of strikes) {
    for (const e of expiries)
      for (const c of [1, 0]) {
        call.push(c);
        exp.push(e);
        const iv = 0.12 + Math.abs(k - 778) / 400 + (e === day ? 0.04 : 0);
        /* a vol at the open, another at 1:00 pm — and one received at 3:55 pm that no minute before it may read */
        obs.push([
          { at: open - 60_000, iv, trade: open - 60_000, bound: false, carried: true },
          { at: nyWallTime(y, m, d, 13, 0), iv: iv * 1.1, trade: nyWallTime(y, m, d, 13, 0), bound: false, carried: false },
          { at: nyWallTime(y, m, d, 15, 55), iv: iv * 3, trade: nyWallTime(y, m, d, 15, 55), bound: false, carried: false },
        ]);
        oiObs.push([{ at: open - 3 * 3600_000, oi: 1000 + 37 * Math.abs(k - 770) + (c ? 400 : 0) }]);
      }
    start.push(call.length);
  }
  const expiresOf = (e: string) => {
    const [yy, mm, dd] = e.split('-').map(Number);
    return nyWallTime(yy, mm, dd, 16, 0);
  };
  return {
    day,
    strikes,
    start: Int32Array.from(start),
    call: Uint8Array.from(call),
    oiObs,
    oiTodayFrom: 0,
    expires: Float64Array.from(exp.map(expiresOf)),
    years: Float64Array.from(exp.map(e => (e > day ? uwYears(0, 0, e, day) : 0))),
    expiry: exp,
    part: Uint8Array.from(exp.map(e => partOf(e, day))),
    obs,
    reads: [],
    volReads: [],
    seedDate: null,
  };
}
{
  const day = '2026-10-13';
  const u = built(day);
  const [y, m, d] = day.split('-').map(Number);
  const end = driftEndOf(day);
  check(`the drift ends ten minutes before the day's expiry: 3:50 pm New York (${new Date(end).toISOString()}), 12:50 pm on a half day`, end === nyWallTime(y, m, d, 15, 50) && driftEndOf('2026-11-27') === nyWallTime(2026, 11, 27, 12, 50));
  let worst = 0;
  let laterZero = true;
  let ok = true;
  const seen: string[] = [];
  for (const [h, mi] of [[9, 45], [11, 0], [13, 30], [15, 0], [15, 48]] as const) {
    const bar = { time: nyWallTime(y, m, d, h, mi) / 1000, close: 778.37 + (h - 12) * 0.4 };
    const col = modelColumn(u, bar);
    const clock = bar.time * 1000 + 30_000;
    const a = dealerDelta(u, bar, clock);
    const b = dealerDelta(u, bar, end);
    const want = b.map((x, q) => x - a[q]);
    if (!col.drift) {
      ok = false;
      continue;
    }
    for (let q = 0; q < 4; q++) {
      if (!close(col.drift[q], want[q])) ok = false;
      worst = Math.max(worst, Math.abs(col.drift[q] - want[q]));
    }
    if (want[1] !== 0 || want[2] !== 0 || want[3] !== 0) laterZero = false;
    seen.push(`${h}:${String(mi).padStart(2, '0')} ${(col.drift[0] / 1e6).toFixed(2)}M`);
  }
  check(`the column's drift equals every contract repriced here at 3:50 pm minus at the minute, by partition (largest gap $${worst.toExponential(1)}): ${seen.join(' · ')}`, ok && seen.length === 5);
  check("a later expiry moves nothing inside the session on UW's clock (whole days): its partitions' drift is exactly 0", laterZero);
  const bar = { time: nyWallTime(y, m, d, 11, 0) / 1000, close: 778.37 };
  const col = modelColumn(u, bar);
  const windows = (['0dte', 'fri', 'opex', 'all'] as const).map(w => driftOf(col, w));
  check(`every window reads the same drift (${windows.map(v => ((v ?? NaN) / 1e6).toFixed(2)).join(', ')} million), and a window view carries it through`, windows.every(v => v === windows[0]) && driftOf(windowView(col, 'fri'), 'fri') === windows[1]);
  check('at and past the drift’s end there is none: 3:50 pm and 3:55 pm columns carry no drift', !modelColumn(u, { time: nyWallTime(y, m, d, 15, 50) / 1000, close: 778 }).drift && !modelColumn(u, { time: nyWallTime(y, m, d, 15, 55) / 1000, close: 778 }).drift);
  /* point in time: the 3:55 pm vol (three times the others) never reaches a minute before it */
  const u2 = built(day);
  for (const list of u2.obs) list.pop();
  const c1 = modelColumn(u, { time: nyWallTime(y, m, d, 15, 30) / 1000, close: 779 });
  const c2 = modelColumn(u2, { time: nyWallTime(y, m, d, 15, 30) / 1000, close: 779 });
  check('a vol received after the minute’s end changes nothing: the 3:30 pm drift with and without the 3:55 pm vols is the same', !!c1.drift && !!c2.drift && c1.drift.every((v, q) => v === c2.drift![q]));
  /* constant spot and vol: the drift is the delta's clock alone — the same minute at another price is another drift */
  const atOther = modelColumn(u, { time: bar.time, close: 790 });
  check('the price is held, not moved: the same minute priced at 790 gives its own drift, priced at 790 at both ends', !!atOther.drift && atOther.drift[0] !== col.drift![0] && close(atOther.drift[0], dealerDelta(u, { time: bar.time, close: 790 }, driftEndOf(day))[0] - dealerDelta(u, { time: bar.time, close: 790 }, bar.time * 1000 + 30_000)[0]));
  /* the sign: an out-of-the-money call's delta melts toward 0 by 3:50 pm, so the dealers' (turned-over) delta rises */
  const one: Universe = { ...u, strikes: [790], start: Int32Array.from([0, 1]), call: Uint8Array.from([1]), oiObs: [[{ at: 0, oi: 1000 }]], expires: Float64Array.from([u.expires[0]]), years: Float64Array.from([0]), expiry: [day], part: Uint8Array.from([0]), obs: [[{ at: 0, iv: 0.15, trade: 0, bound: false, carried: true }]] };
  const oc = modelColumn(one, { time: nyWallTime(y, m, d, 11, 0) / 1000, close: 778 });
  check(`the sign: one out-of-the-money call melting toward zero delta turns the dealers' (turned-over) delta up: ${((oc.drift?.[0] ?? NaN) / 1e3).toFixed(1)}K`, (oc.drift?.[0] ?? 0) > 0);
}

/* ---- this machine's rebuilt sessions, through the store's own inputs ------------------------------------------------ */
{
  const root = join(process.cwd(), '.feed-cache', 'field');
  const store = createFieldStore();
  let sessions = 0;
  let minutes = 0;
  let bad = 0;
  let worst = 0;
  const lines: string[] = [];
  for (const name of existsSync(root) ? readdirSync(root).filter(n => /^[A-Z]+$/.test(n)) : [])
    for (const day of readdirSync(join(root, name)).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).slice(-3)) {
      const pf = join(root, name, day, 'past.json.gz');
      const bf = join(root, name, day, 'bars.json.gz');
      if (!existsSync(pf) || !existsSync(bf)) continue;
      const past = JSON.parse(gunzipSync(readFileSync(pf)).toString('utf8')) as PastDay;
      const bars = (JSON.parse(gunzipSync(readFileSync(bf)).toString('utf8')) as { time: number; close: number; session: string }[]).filter(b => b.session === 'r');
      const u = universeOf(past.name, past.day, store.inputsOf(past));
      const end = driftEndOf(day);
      sessions++;
      const said: string[] = [];
      for (const [h, mi] of [[10, 0], [12, 0], [14, 0], [15, 30]] as const) {
        const [y, m, d] = day.split('-').map(Number);
        const t = nyWallTime(y, m, d, h, mi) / 1000;
        const bar = bars.find(b => b.time === t);
        if (!bar) continue;
        const col = modelColumn(u, bar);
        const a = dealerDelta(u, bar, bar.time * 1000 + 30_000);
        const b = dealerDelta(u, bar, end);
        const want = b.map((x, q) => x - a[q]);
        minutes++;
        const got = col.drift ? [...col.drift] : null;
        const none = want.every(v => v === 0);
        if (got ? !got.every((v, q) => close(v, want[q])) : !none) bad++;
        if (got) worst = Math.max(worst, ...got.map((v, q) => Math.abs(v - want[q])));
        said.push(`${h > 12 ? h - 12 : h}:${String(mi).padStart(2, '0')} ${got ? `${got[0] >= 0 ? '+' : '−'}$${(Math.abs(got[0]) / 1e9).toFixed(2)}B` : 'none'}`);
      }
      lines.push(`  ${name} ${day}  ${said.join(' · ')}`);
    }
  if (!sessions) console.log('SKIP  the drift on rebuilt sessions: none on this machine');
  else {
    for (const l of lines) console.log(l);
    check(`on ${sessions} rebuilt sessions, ${minutes} minutes: the column's drift is every contract repriced here, 3:50 pm minus the minute (largest gap $${worst.toExponential(1)}; ${bad} off)`, bad === 0 && minutes > 0);
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
