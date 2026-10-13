/*
  THE BACKFILL JOB, RUN BY HAND (2026-10-13 — the owner's item 1b; the always-on recorder runs the same job with
  BACKFILL_FROM, server/recorderMain.ts):

    npm run feed:backfill -- SPY,QQQ 2025-04-01 [2026-10-12]

  Every session from the first date to the second (the session before today by default), oldest first, each name —
  a session built before is skipped, a day with no session is noted once and never asked again, a failure is left for
  the next run. The UW key is read from .env the way the recorder reads it, never printed. About 1,650 calls and a
  minute or two a SPY session at two in flight.
*/
import { existsSync, readFileSync } from 'node:fs';
import { createFeedClient } from '../server/feed';
import { createFieldBackfill } from '../server/fieldBackfill';
import { tapeReader } from '../server/tapeBackfill';

const [rawNames = 'SPY,QQQ', from = '', to] = process.argv.slice(2);
if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || (to && !/^\d{4}-\d{2}-\d{2}$/.test(to))) {
  console.error('usage: npm run feed:backfill -- <NAMES> <YYYY-MM-DD from> [<YYYY-MM-DD to>]');
  process.exit(2);
}
const env: Record<string, string> = {};
if (existsSync('.env'))
  for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !line.trim().startsWith('#')) env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
const key = process.env.UW_API_TOKEN || env.UW_API_TOKEN;
if (!key) {
  console.error('no UW key in .env');
  process.exit(1);
}
const names = rawNames
  .split(',')
  .map(s => s.trim().toUpperCase())
  .filter(Boolean);
const stamp = () => new Date().toISOString().slice(11, 19);
const client = createFeedClient({ keys: { uw: key, massive: undefined } as never });
const bf = createFieldBackfill(client, { tape: tapeReader(client, { log: l => console.log(`${stamp()} ${l}`) }) });
console.log(`${stamp()} backfill ${names.join(', ')} from ${from}${to ? ` to ${to}` : ''}, oldest first (a day before UW's minute vols from its tape)`);
let seen = '';
const progress = setInterval(() => {
  const j = bf.job();
  const line = `${j.current ?? '…'} built ${j.built} skipped ${j.skipped} failed ${j.failed} of ${j.days}`;
  if (line !== seen) console.log(`${stamp()} ${line}`);
  seen = line;
}, 15_000);
bf.runRange(names, from, to)
  .then(j => {
    clearInterval(progress);
    console.log(`${stamp()} done: built ${j.built}, skipped ${j.skipped}, failed ${j.failed} of ${j.days}`);
    for (const n of names) {
      const c = JSON.parse(bf.coverage(n).body) as { first: string | null; last: string | null; days: string[]; byVols: Record<string, number>; none: number };
      console.log(`  ${n}: rebuilt ${c.first ?? '—'} to ${c.last ?? '—'}, ${c.days.length} sessions (minute vols ${c.byVols.minute}, tape ${c.byVols.tape}, close ${c.byVols.close}); ${c.none} days without a session`);
    }
    process.exit(0);
  })
  .catch(e => {
    clearInterval(progress);
    console.error(`${stamp()} FAILED: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  });
