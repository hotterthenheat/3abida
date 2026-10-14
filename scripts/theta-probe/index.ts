/*
  THE THETA PROBE — Phase 0 of the Terrain history backfill (the owner, 2026-10-14: "Phase 0 = probes only. Report
  results, then STOP and wait for my 'go'").

    npm run theta:probe                     every probe the hour allows, the report into docs/theta-probe/<date_time>/
    npm run theta:probe -- T1,T2            a few by id (T1–T12, U1–U4, X1–X3); PROBES=T1,T2 in the environment does the same
    npm run theta:probe -- X2               the real-time check, inside the cash session
    npm run theta:probe -- --out=<dir>      where the report goes (THETA_PROBE_OUT)
    npm run theta:probe -- --tapes=<n>      full-tape days X1 may download for SPX's minutes (2 by default; THETA_PROBE_TAPES)
    THETA_PROBE_BASE=http://127.0.0.1:25503/v3

  RUN ON THE ALWAYS-ON MACHINE, AGAINST ITS TERMINAL. The script starts no terminal (rule 1: a second sign-in takes the
  session — 478 / MDDS UNVERIFIED), speaks to 127.0.0.1 alone (rule 2), holds six calls in flight (rule 3), takes its
  dates from what the terminal lists (rule 4), fills no missing input (rule 5), refuses to run between 12:00 and 1:45 am
  New York (rule 6, Theta's own gap), passes format=ndjson on every data call and reads stamps as New York wall time
  (rule 7), and runs the heavy probes (T7, T10, T11, T12, X1) outside market hours alone (rule 8). The UW key is read
  from .env for U1–U4, X2 and the tape, and never written anywhere.

  The report (report.md, results.json) is written after every probe, so a run cut short keeps what came in.
*/
import { join } from 'node:path';
import { env, hhmm, inCash, inSession, inThetaGap, nyNow, row, say, THETA_BASE } from './lib';
import { datesOf, makeCtx, type Ctx } from './ctx';
import { writeReport } from './report';
import { T1, T2, T3, T4, T5, T6, T7, T8, T9, T10 } from './theta-probes';
import { T11, T12 } from './analysis';
import { U1, U2, U3, U4 } from './uw-probes';
import { X1, X2, X3 } from './spx-probes';

const HEAVY = new Set(['T7', 'T10', 'T11', 'T12', 'X1']);

async function main(): Promise<void> {
  const now = nyNow();
  if (inThetaGap(now.minute)) {
    console.error(`It is ${now.text}: Theta says the previous day's data is unavailable from 12:00 to 1:45 am New York (rule 6). Run after 1:45 am.`);
    process.exit(2);
  }
  /* the command line first (Windows' shell sets no variable before a command), the environment after */
  const args = process.argv.slice(2);
  const flag = (name: string) => args.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const list = args.find(a => !a.startsWith('--')) ?? env.PROBES ?? '';
  const only = new Set(list.split(',').map(s => s.trim().toUpperCase()).filter(Boolean));
  const ctx: Ctx = makeCtx(now.iso, only);
  ctx.tapeDownloads = Math.max(0, Number(flag('tapes') ?? env.THETA_PROBE_TAPES ?? 2) || 0);
  ctx.heavyOk = !inSession(now.minute, now.weekday);
  ctx.liveOk = inCash(now.minute, now.weekday);
  const outDir = flag('out') ?? env.THETA_PROBE_OUT ?? join('docs', 'theta-probe', `${now.iso}_${hhmm(now.minute).replace(':', '')}`);
  const meta = { startedAt: now.text, probes: only.size ? [...only].join(', ') : 'all', base: THETA_BASE, done: false };
  say(`Theta probe, Phase 0 — ${now.text}; terminal ${THETA_BASE}; report → ${outDir}`);
  if (!ctx.heavyOk) say(`inside market hours: the heavy probes (${[...HEAVY].join(', ')}) are not run now (rule 8) — run again after the close`);

  const want = (id: string) => !only.size || only.has(id);
  const steps: [string, (c: Ctx) => Promise<void>][] = [
    ['T3', T3],
    ['T4', T4],
    ['T5', T5],
    ['T6', T6],
    ['T1', T1],
    ['T2', T2],
    ['T8', T8],
    ['T9', T9],
    ['U1', () => U1()],
    ['U2', () => U2()],
    ['U3', U3],
    ['U4', U4],
    ['X3', X3],
    ['T10', T10],
    ['T7', T7],
    ['X1', X1],
    ['T11', T11],
    ['T12', T12],
    ['X2', X2],
  ];
  /* the calendar every later probe reads: the dates SPY and QQQ traded, newest first (asked once, in T3 and T4) */
  const calendar = async () => {
    const a = await datesOf(ctx, 'stock', 'QQQ', 'trade');
    const b = await datesOf(ctx, 'stock', 'SPY', 'trade');
    ctx.calendar = [...new Set([...a.dates, ...b.dates])].filter(d => d < ctx.today).sort().reverse();
    if (ctx.recent == null) ctx.recent = ctx.calendar[0] ?? null;
  };
  let calendarDone = false;
  for (const [id, fn] of steps) {
    if (!want(id)) continue;
    if (HEAVY.has(id) && !ctx.heavyOk) {
      ctx.skipped.push(`${id}: heavy, not run inside market hours (${now.text}) — run after the close`);
      say(`${id}: skipped (market hours)`);
      continue;
    }
    if (id === 'X2' && !ctx.liveOk) {
      ctx.skipped.push(`X2: the real-time check runs inside the cash session alone — PROBES=X2 npm run theta:probe between 9:30 am and 4:00 pm New York`);
      say('X2: skipped (outside the cash session)');
      continue;
    }
    if (!calendarDone && !['T3', 'T4'].includes(id)) {
      calendarDone = true;
      try {
        await calendar();
      } catch (e) {
        say(`the calendar could not be read: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    say(`— ${id} —`);
    try {
      await fn(ctx);
    } catch (e) {
      const msg = e instanceof Error ? `${e.message}${e.stack ? `\n${e.stack.split('\n').slice(1, 3).join('\n')}` : ''}` : String(e);
      row({ id, url: '', status: 'error', error: msg.slice(0, 400), rows: '', bytes: '', seconds: '', first: '', last: '', conclusion: `${id} threw — see the error` });
    }
    if (id === 'T4' && !calendarDone) {
      calendarDone = true;
      await calendar().catch(() => undefined);
    }
    writeReport(outDir, ctx, meta);
  }
  meta.done = true;
  writeReport(outDir, ctx, meta);
  say(`done — ${join(outDir, 'report.md')}`);
}

main().catch(e => {
  console.error(e instanceof Error ? e.stack ?? e.message : String(e));
  process.exit(1);
});
