/*
  THE SERIES JOB'S RULES (server/seriesBackfill.ts, the owner's B5, 2026-10-14) against a stand-in client, in a temp
  folder: a day held is skipped (this job's file, the recorder's total.json, a rebuilt day carrying the series); a day
  UW answers empty is written as empty and never asked again; a refused call (429 then 5xx) is not written and is asked
  again on the next run; the walk goes newest first over weekdays only; the rows are kept as answered, every field.

    tsx scripts/series-backfill-proof.ts     (in `npm test`)
*/
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { createSeriesBackfill, weekdayBefore, type SeriesFile } from '../server/seriesBackfill';
import type { FeedClient } from '../server/feed';

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (ok) pass++;
  else fail++;
};

const root = join(tmpdir(), `slayer-series-proof-${process.pid}`);
rmSync(root, { recursive: true, force: true });
mkdirSync(root, { recursive: true });

/* the clock: a Wednesday, 2026-10-14 15:00 New York */
const now = Date.UTC(2026, 9, 14, 19, 0);
const asked: string[] = [];
let refuse = 0;
const client = {
  get: async (p: string, path: string) => {
    asked.push(path);
    const d = /date=(\d{4}-\d{2}-\d{2})/.exec(path)?.[1] ?? '';
    if (d === '2026-10-08') return { status: 429, body: '', contentType: 'application/json', from: 'proxy' };
    if (d === '2026-10-07') {
      refuse++;
      return { status: 503, body: '{"error":"network"}', contentType: 'application/json', from: 'proxy' };
    }
    if (d === '2026-10-12') return { status: 200, body: JSON.stringify({ data: [] }), contentType: 'application/json', from: 'proxy' };
    return { status: 200, body: JSON.stringify({ data: [{ start_time: `${d}T09:30:00-04:00`, price: 777.5, gamma_per_one_percent_move_oi: '1.2e9', gamma_per_one_percent_move_vol: '3e8', gamma_per_one_percent_move_dir: '-2e8', charm_per_one_percent_move_oi: '5' }] }), contentType: 'application/json', from: 'proxy' };
  },
} as unknown as FeedClient;

/* held already: the recorder's total.json for Oct 13, a rebuilt Oct 9 carrying the series */
mkdirSync(join(root, 'SPY', '2026-10-13'), { recursive: true });
writeFileSync(join(root, 'SPY', '2026-10-13', 'total.json'), '{"receivedAt":1,"rows":[[1,2,3]]}');
mkdirSync(join(root, 'SPY', '2026-10-09'), { recursive: true });
writeFileSync(join(root, 'SPY', '2026-10-09', 'past.json.gz'), gzipSync(JSON.stringify({ total: { receivedAt: 1, rows: [[1, 2, 3]] } })));

const sleepBefore = global.setTimeout;
/* no real waits: a 429's minute and the pause between calls pass at once */
(global as unknown as { setTimeout: unknown }).setTimeout = ((fn: () => void) => sleepBefore(fn, 0)) as unknown as typeof setTimeout;

const job = createSeriesBackfill(client, { root, now: () => now, pauseMs: 0 });
check(`the weekday before: ${weekdayBefore('2026-10-14')} (a Tuesday), ${weekdayBefore('2026-10-12')} (the Friday before a Monday)`, weekdayBefore('2026-10-14') === '2026-10-13' && weekdayBefore('2026-10-12') === '2026-10-09');
const s = await job.run(['SPY'], 10);
const file = (d: string): SeriesFile | null => (existsSync(join(root, 'SPY', d, 'series.json')) ? (JSON.parse(readFileSync(join(root, 'SPY', d, 'series.json'), 'utf8')) as SeriesFile) : null);
check(`the walk is newest first over weekdays (${asked.map(a => /date=(\S+)/.exec(a)?.[1]).join(', ')})`, asked[0].includes('2026-10-12') && !asked.some(a => /date=2026-10-1[01]\b/.test(a)) && !asked.some(a => a.includes('2026-10-13')) && !asked.some(a => a.includes('2026-10-09')));
check('a day held (the recorder\'s total.json, a rebuilt day carrying the series) is skipped', s.skipped === 2 && !file('2026-10-13') && !file('2026-10-09'));
check('a day UW answers empty is written as empty', file('2026-10-12')?.empty === true && file('2026-10-12')?.rows.length === 0);
check('a 429 waits and asks again; a 5xx is not written (asked again next run)', s.refused >= 1 && !file('2026-10-07') && asked.filter(a => a.includes('2026-10-08')).length >= 2);
const kept = file('2026-10-06');
check('the rows are kept as answered, every field (UW\'s strings included)', !!kept && kept.rows.length === 1 && kept.rows[0].gamma_per_one_percent_move_dir === '-2e8' && kept.rows[0].charm_per_one_percent_move_oi === '5' && kept.format === 1 && kept.url.endsWith('date=2026-10-06'));
const before = asked.length;
const s2 = await job.run(['SPY'], 10);
check(`a second run skips every day written and asks the refused ones again (${s2.skipped} skipped, ${asked.length - before} asked)`, s2.written === 0 && s2.skipped >= 5 && asked.slice(before).every(a => a.includes('2026-10-07') || a.includes('2026-10-08')));

rmSync(root, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
