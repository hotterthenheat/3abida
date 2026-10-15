/*
  THE SERIES FILL'S RULES (server/seriesBackfill.ts — the owner's B5, 2026-10-14 and 2026-10-15) against a stand-in
  client, in a temp folder:
    - the window is UW's own word, read off its refusal of a date before any window ("The earliest date currently
      available to this token is …"); with no answer, its last word carried on a trading day a session; with none ever,
      the estimate;
    - every trading day from that floor to the last session, oldest first, every name a date before the next date; a
      weekend or a market holiday (Thanksgiving) is never asked, nor a date before the floor; the last session is
      today's only from 5:00 pm New York;
    - a day is held by this job's own file alone (series.json.gz, or the plain series.json it first wrote), read whole —
      a file cut short is asked again; the recorder's total.json and a rebuilt past.json.gz never count;
    - an empty day before a name's first rows is UW's series not yet begun, never asked again; one after is a gap,
      asked again on later runs, three times in all;
    - a name UW does not serve — a 4xx, or no rows on its last whole session where SPY has rows (UW answers an unknown
      ticker 200 with no rows) — is skipped and named; a window refusal on a name's first day never blames the name;
    - the live pull first: never in the live hours (4:00 am to 5:00 pm New York on a trading day), stopping if a run
      reaches them; no call while the UW gate is busy or a call of the process met a 429 in the last minute; the job's
      calls skip the cache and the client's quick retry; a 429 backs off 30 s, doubling;
    - a 5xx is not written and is asked again; one fill at a time (series.lock, created exclusively);
    - the names: the recorder's, the series' extras, a tab's, the ones on disk;
    - the recorder's prune walks past a file in the field's root (recorder.lock) instead of stopping at it.

    tsx scripts/series-backfill-proof.ts     (in `npm test`)
*/
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import {
  carriedFloor,
  createSeriesBackfill,
  estimatedFloor,
  firstDayOf,
  floorFromRefusal,
  inLiveHours,
  isWindowRefusal,
  LOCK_FILE,
  namesToFill,
  rangesOf,
  readSeries,
  readState,
  recordedNamesOf,
  seriesNamesOf,
  storedOf,
  tradingDayBefore,
  tradingDays,
  weekdayBefore,
  type SeriesFile,
} from '../server/seriesBackfill';
import { createFieldRecorder } from '../server/fieldRecorder';
import type { FeedClient } from '../server/feed';

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (ok) pass++;
  else fail++;
};

const base = join(tmpdir(), `slayer-series-proof-${process.pid}`);
rmSync(base, { recursive: true, force: true });
mkdirSync(base, { recursive: true });

/* no real waits: every pause passes at once, its length noted */
const waits: number[] = [];
const realTimeout = global.setTimeout;
(global as unknown as { setTimeout: unknown }).setTimeout = ((fn: () => void, ms?: number) => {
  waits.push(ms ?? 0);
  return realTimeout(fn, 0);
}) as unknown as typeof setTimeout;

const NY = (y: number, mo: number, d: number, h: number, mi = 0) => Date.UTC(y, mo - 1, d, h + 4, mi); // EDT (Oct)
const NYst = (y: number, mo: number, d: number, h: number, mi = 0) => Date.UTC(y, mo - 1, d, h + 5, mi); // EST (late Nov, Dec)
const ans = (status: number, body: unknown) => ({ status, body: typeof body === 'string' ? body : JSON.stringify(body), contentType: 'application/json', from: 'upstream' as const });
const rowsOf = (d: string) => ({ data: [{ start_time: `${d}T13:30:00Z`, price: '777.5', gamma_per_one_percent_move_oi: '1.2e9', gamma_per_one_percent_move_vol: '3e8', gamma_per_one_percent_move_dir: '-2e8', charm_per_one_percent_move_oi: '5' }] });
const keyOf = (path: string) => `${/stock\/([^/]+)\//.exec(path)?.[1]} ${/date=(\S+)/.exec(path)?.[1]}`;
const heldFileOf = (name: string, date: string): SeriesFile => ({ format: 1, name, date, receivedAt: 1, url: `/api/stock/${name}/spot-exposures?date=${date}`, rows: [{ price: 1 }] });

/* UW's own words (2026-10-15) */
const REFUSAL = JSON.stringify({ code: 'historic_data_access_missing', message: 'The earliest date currently available to this token is 2023-11-15 (730 trading days), so 2000-01-03 in query param date will not return historical data.\n\nAPI Basic and API Advanced subscriptions include up to 730 trading days of historical data.' });
const refusal = (floor: string) => REFUSAL.replace('2023-11-15', floor);
check('the floor is read off the refusal: 2023-11-15', floorFromRefusal(REFUSAL) === '2023-11-15' && isWindowRefusal(403, REFUSAL) && !isWindowRefusal(404, '{"code":"not_found"}'));
const est = estimatedFloor(NY(2026, 10, 15, 18, 30));
check(`the estimate where UW never named a date lands on UW's own word that day (${est})`, est === '2023-11-15');

/* ============ 1. a window of three weeks: the clock Wednesday 2026-10-14, 3:00 am New York (outside the live hours) ============ */
{
  const root = join(base, 'one');
  const stateRoot = join(root, '_series');
  const now = NY(2026, 10, 14, 3);
  const FLOOR = '2026-09-28';
  const START_SPY = '2026-09-30'; // UW's series for SPY begins here; the two days before answer no rows
  const asked: string[] = [];
  const callOpts: unknown[] = [];
  let busyReads = 0;
  let callsWhileBusy = 0;
  let gateBusy = 3; // the gate reads busy for its first three looks
  let recent429 = 2; // the process met a 429 a moment ago, for two looks
  let callsWhileThrottled = 0;
  const throttle = new Map<string, number>([['SPY 2026-10-02', 3]]);
  const gate = {
    get active() {
      busyReads++;
      return gateBusy > 0 ? (gateBusy--, 2) : 0;
    },
    get waiting() {
      return 0;
    },
  };
  let gapAnswers = 0;
  const client = {
    uwGate: gate,
    uw429At: () => (recent429 > 0 ? (recent429--, now - 10_000) : 0),
    get: async (_p: string, path: string, o?: unknown) => {
      if (gateBusy > 0) callsWhileBusy++;
      if (recent429 > 0) callsWhileThrottled++;
      asked.push(path);
      callOpts.push(o);
      const [name, d] = keyOf(path).split(' ');
      if (d < FLOOR) return ans(403, refusal(FLOOR));
      if (name === 'ZZZZ') return ans(404, { code: 'ticker_not_found', message: 'No such ticker ZZZZ' });
      if (name === 'ZZZQ') return ans(200, { data: [] }); // UW's way with a ticker it does not know
      const k = `${name} ${d}`;
      if ((throttle.get(k) ?? 0) > 0) {
        throttle.set(k, (throttle.get(k) ?? 0) - 1);
        return ans(429, { message: 'You have exceeded 3 concurrent requests' });
      }
      if (k === 'SPY 2026-10-07') return ans(503, { error: 'network' });
      if (k === 'QQQ 2026-10-08') return ans(403, refusal('2026-10-09')); // the window moved past it mid-run
      if (name === 'SPY' && d < START_SPY) return ans(200, { data: [] });
      if (k === 'SPY 2026-10-06') {
        gapAnswers++;
        return ans(200, { data: [] }); // a gap: no rows on a session after the series began
      }
      return ans(200, rowsOf(d));
    },
  } as unknown as FeedClient;

  /* NOT held: the recorder's total.json (Oct 13) and a rebuilt past.json.gz (Oct 9). Held: the plain series.json the job
     first wrote (QQQ Oct 5). Cut short: a plain file (QQQ Oct 6) and a gzip (QQQ Oct 7) — asked again. */
  mkdirSync(join(root, 'SPY', '2026-10-13'), { recursive: true });
  writeFileSync(join(root, 'SPY', '2026-10-13', 'total.json'), '{"receivedAt":1,"rows":[[1,2,3]]}');
  mkdirSync(join(root, 'SPY', '2026-10-09'), { recursive: true });
  writeFileSync(join(root, 'SPY', '2026-10-09', 'past.json.gz'), gzipSync(JSON.stringify({ total: { receivedAt: 1, rows: [[1, 2, 3]] } })));
  mkdirSync(join(root, 'QQQ', '2026-10-05'), { recursive: true });
  const heldFile: SeriesFile = { format: 1, name: 'QQQ', date: '2026-10-05', receivedAt: 1, url: '/api/stock/QQQ/spot-exposures?date=2026-10-05', rows: [{ price: 1 }] };
  writeFileSync(join(root, 'QQQ', '2026-10-05', 'series.json'), JSON.stringify(heldFile));
  mkdirSync(join(root, 'QQQ', '2026-10-06'), { recursive: true });
  writeFileSync(join(root, 'QQQ', '2026-10-06', 'series.json'), JSON.stringify(heldFile).slice(0, 60));
  mkdirSync(join(root, 'QQQ', '2026-10-07'), { recursive: true });
  writeFileSync(join(root, 'QQQ', '2026-10-07', 'series.json.gz'), gzipSync(JSON.stringify(heldFile)).subarray(0, 20));
  /* a large gzip is trusted by its size (the job writes it whole through a .part and a rename): not unzipped to look */
  mkdirSync(join(root, 'QQQ', '2026-10-01'), { recursive: true });
  writeFileSync(join(root, 'QQQ', '2026-10-01', 'series.json.gz'), Buffer.alloc(4096, 7));

  const lines: string[] = [];
  const job = createSeriesBackfill(client, { root, stateRoot, now: () => now, pauseMs: 0, log: l => lines.push(l) });
  const s = await job.run(['SPY', 'QQQ', 'ZZZZ', 'ZZZQ'], 'the proof');
  const dated = asked.map(keyOf);
  const CHECK = '2026-10-12'; // the last whole session before the walk's last (Oct 13)
  const walk = dated.slice(1 + 3); // the probe, then the check day of each name holding no rows yet (QQQ holds Oct 5)
  const days = walk.map(x => x.split(' ')[1]);

  check(`the window is UW's word (${s.window?.floor}, ${s.window?.source}) and the first call asks for it`, s.window?.floor === FLOOR && s.window.source === 'uw' && dated[0] === 'SPY 2000-01-03');
  check(`a name holding no rows has its last whole session asked first, to see that UW serves it; one holding rows is not asked (${dated.slice(1, 4).join(', ')})`, dated.slice(1, 4).join(',') === `SPY ${CHECK},ZZZZ ${CHECK},ZZZQ ${CHECK}`);
  check(`a name UW refuses (404) is skipped and named (${s.refusedNames.ZZZZ?.code})`, dated.filter(x => x.startsWith('ZZZZ')).length === 1 && s.refusedNames.ZZZZ?.status === 404 && readState(stateRoot).refused.ZZZZ?.code === 'ticker_not_found' && lines.some(l => l.includes('ZZZZ') && l.includes('refused')));
  check(
    `a name UW answers with no rows where SPY has rows is skipped and named, its empty file and folder gone ("${s.refusedNames.ZZZQ?.message}")`,
    dated.filter(x => x.startsWith('ZZZQ')).length === 1 && s.refusedNames.ZZZQ?.code === 'no-rows' && readState(stateRoot).refused.ZZZQ?.code === 'no-rows' && !existsSync(join(root, 'ZZZQ'))
  );
  check('no call before the floor, on a weekend or a market holiday', days.every(d => d >= FLOOR && tradingDays(d, d).length === 1));
  check(`oldest first, every name a date before the next (${walk.slice(0, 4).join(', ')} …)`, walk[0] === 'SPY 2026-09-28' && walk[1] === 'QQQ 2026-09-28' && walk[2] === 'SPY 2026-09-29' && days.every((d, i) => i === 0 || d >= days[i - 1]));
  check('the last session asked is the one before today (3:00 am): 2026-10-13', days[days.length - 1] === '2026-10-13' && !days.includes('2026-10-14'));
  check('a day held by the plain series.json is not asked; total.json and past.json.gz never count', !dated.includes('QQQ 2026-10-05') && dated.includes('SPY 2026-10-13') && dated.includes(`SPY ${CHECK}`));
  check('a file cut short — a plain one, a small gzip — is asked again and kept whole', dated.includes('QQQ 2026-10-06') && dated.includes('QQQ 2026-10-07') && readSeries(root, 'QQQ', '2026-10-06')?.rows.length === 1 && readSeries(root, 'QQQ', '2026-10-07')?.rows.length === 1);
  check('a large gzip counts as held by its size, never unzipped to look (the cost of a full window)', !dated.includes('QQQ 2026-10-01'));
  const backoff = waits.filter(w => w >= 30_000);
  check(`a 429 backs off 30 s, doubling (${backoff.map(w => w / 1000).join(', ')} s), then the day is kept`, backoff.length === 3 && backoff[0] === 30_000 && backoff[1] === 60_000 && backoff[2] === 120_000 && s.throttled === 3 && !!readSeries(root, 'SPY', '2026-10-02')?.rows.length);
  check(`the live pull first: no call while the gate was busy or a 429 was fresh (${callsWhileBusy} and ${callsWhileThrottled} calls; the gate read ${busyReads} times)`, callsWhileBusy === 0 && callsWhileThrottled === 0 && busyReads > 3 && waits.filter(w => w === 5_000).length >= 1);
  check("the job's calls skip the cache and the client's quick retry", callOpts.length > 0 && callOpts.every(o => JSON.stringify(o) === '{"noCache":true,"noRetry":true}'));
  check('a 5xx is not written', !readSeries(root, 'SPY', '2026-10-07') && s.refused >= 1);
  check('a day the window moved past is left unwritten, the name not blamed', !readSeries(root, 'QQQ', '2026-10-08') && !s.refusedNames.QQQ);
  const kept = readSeries(root, 'SPY', '2026-10-01');
  check("the rows are kept as answered, every field (UW's strings included), gzipped", !!kept && kept.rows[0].gamma_per_one_percent_move_dir === '-2e8' && kept.rows[0].charm_per_one_percent_move_oi === '5' && kept.format === 2 && existsSync(join(root, 'SPY', '2026-10-01', 'series.json.gz')) && !existsSync(join(root, 'SPY', '2026-10-01', 'series.json')));
  check('the days before the series began are written empty', readSeries(root, 'SPY', '2026-09-28')?.empty === true && readSeries(root, 'SPY', '2026-09-29')?.empty === true);
  check('the lock is let go when the run ends', !existsSync(join(stateRoot, LOCK_FILE)));

  /* the second run: only what is still missing — the 5xx day, the day the window moved past, the gap (its second time),
     and the refused names' check days, asked again (a name UW starts to serve is walked) */
  const before = asked.length;
  gapAnswers = 0;
  const s2 = await job.run(['SPY', 'QQQ'], 'again');
  const again = asked.slice(before + 1).map(keyOf);
  check(`a second run asks only what is missing (${again.join(', ')})`, again.length === 3 && again.includes('SPY 2026-10-07') && again.includes('QQQ 2026-10-08') && again.includes('SPY 2026-10-06') && s2.written === 0 && s2.empty === 1);
  check("an empty day before a name's first rows is never asked again; a gap after them is", !again.includes('SPY 2026-09-28') && gapAnswers === 1);
  await job.run(['SPY', 'QQQ'], 'a third time');
  const before4 = asked.length;
  await job.run(['SPY', 'QQQ'], 'a fourth time');
  check(`a gap is asked three times in all, then left (${readSeries(root, 'SPY', '2026-10-06')?.tries} tries)`, readSeries(root, 'SPY', '2026-10-06')?.tries === 3 && !asked.slice(before4).some(a => a.includes('SPY/spot-exposures?date=2026-10-06')));

  const st = storedOf(['SPY', 'QQQ'], root, { floor: FLOOR }, now);
  check(
    `what is stored is read back with its gaps (SPY ${JSON.stringify({ days: st.SPY.days, oldest: st.SPY.oldest, newest: st.SPY.newest, gaps: st.SPY.gaps, beforeStart: st.SPY.beforeStart })})`,
    st.SPY.oldest === START_SPY && st.SPY.newest === '2026-10-13' && st.SPY.beforeStart === 2 && JSON.stringify(st.SPY.gaps) === '["2026-10-06","2026-10-07"]' && JSON.stringify(st.SPY.missing) === '["2026-10-06","2026-10-07"]' && st.SPY.notAsked === 1 && JSON.stringify(st.QQQ.gaps) === '["2026-10-08"]' && st.QQQ.notAsked === 1 && st.QQQ.beforeStart === 0
  );
  check('runs of trading days print short', JSON.stringify(rangesOf(['2026-10-01', '2026-10-02', '2026-10-05', '2026-10-07'])) === JSON.stringify([{ from: '2026-10-01', to: '2026-10-05', n: 3 }, { from: '2026-10-07', to: '2026-10-07', n: 1 }]));

  /* one fill at a time: a lock held by another live process stops a run before any call */
  writeFileSync(join(stateRoot, LOCK_FILE), JSON.stringify({ pid: process.ppid, at: now }));
  const before5 = asked.length;
  const locked = await job.run(['SPY'], 'locked');
  check(`a second fill does not start while another holds the lock (${locked.stopped})`, asked.length === before5 && !!locked.stopped?.startsWith('held by') && !locked.startedAt);
  /* a lock left by a process that is gone is taken over */
  writeFileSync(join(stateRoot, LOCK_FILE), JSON.stringify({ pid: 2 ** 22 + 12345, at: now }));
  const taken = await job.run(['SPY'], 'stale lock');
  check('a lock left by a process that is gone is taken over', !!taken.startedAt && !taken.stopped?.startsWith('held by'));
}

/* ============ 2. the live hours ============ */
{
  const root = join(base, 'two');
  const stateRoot = join(root, '_series');
  let clock = NY(2026, 10, 14, 10); // Wednesday 10:00 am New York
  const asked: string[] = [];
  const client = {
    get: async (_p: string, path: string) => {
      asked.push(path);
      clock += 60_000; // each call a minute on
      const d = keyOf(path).split(' ')[1];
      if (d < '2026-10-05') return ans(403, refusal('2026-10-05'));
      return ans(200, rowsOf(d));
    },
  } as unknown as FeedClient;
  const job = createSeriesBackfill(client, { root, stateRoot, now: () => clock, pauseMs: 0 });
  const r1 = await job.run(['SPY'], 'in the session');
  check(`never in the live hours: a run at 10:00 am New York does not start (${r1.stopped})`, asked.length === 0 && !r1.startedAt && !!r1.stopped?.includes('live hours'));
  clock = NY(2026, 10, 14, 3, 56); // 3:56 am — a few calls before 4:00 am
  const r2 = await job.run(['SPY'], 'before dawn');
  check(`a run that reaches the live hours stops where it stands (${asked.length} calls; ${r2.stopped})`, asked.length > 1 && asked.length < 8 && !!r2.stopped?.includes('live hours'));
  check(
    'the live hours are 4:00 am to 5:00 pm New York on a trading day only',
    inLiveHours(NY(2026, 10, 14, 4)) && inLiveHours(NY(2026, 10, 14, 16, 59)) && !inLiveHours(NY(2026, 10, 14, 17)) && !inLiveHours(NY(2026, 10, 14, 3, 59)) && !inLiveHours(NY(2026, 10, 17, 12)) && !inLiveHours(NYst(2026, 11, 26, 12))
  );
}

/* ============ 3. across Thanksgiving, a window refusal on a name's first day, and the carried floor ============ */
{
  const root = join(base, 'three');
  const stateRoot = join(root, '_series');
  const now = NYst(2026, 11, 30, 3); // Monday 3:00 am — the last session is Friday Nov 27 (a half day)
  const asked: string[] = [];
  let probeDown = false;
  const client = {
    get: async (_p: string, path: string) => {
      asked.push(path);
      const [name, d] = keyOf(path).split(' ');
      if (d === '2000-01-03') return probeDown ? ans(503, { error: 'network' }) : ans(403, refusal('2026-11-23'));
      if (name === 'AAA' && d === '2026-11-23') return ans(403, refusal('2026-11-24')); // the window moves under AAA's first day
      return ans(200, rowsOf(d));
    },
  } as unknown as FeedClient;
  const job = createSeriesBackfill(client, { root, stateRoot, now: () => now, pauseMs: 0 });
  const s = await job.run(['SPY', 'AAA'], 'Thanksgiving');
  const days = asked.slice(1).map(a => keyOf(a).split(' ')[1]);
  check(`Thanksgiving and the weekend are never asked; the half day is (${[...new Set(days)].sort().join(', ')})`, !days.includes('2026-11-26') && !days.includes('2026-11-28') && days.includes('2026-11-27') && JSON.stringify([...new Set(days)].sort()) === '["2026-11-23","2026-11-24","2026-11-25","2026-11-27"]');
  check("a window refusal on a name's first day does not blame the name", !s.refusedNames.AAA && !!readSeries(root, 'AAA', '2026-11-24')?.rows.length);
  /* the probe gets no answer the next Wednesday: the floor is UW's last word (Nov 23, read Monday) carried on two sessions */
  probeDown = true;
  const later = NYst(2026, 12, 2, 18);
  const job2 = createSeriesBackfill(client, { root, stateRoot, now: () => later, pauseMs: 0 });
  const s2 = await job2.run(['SPY'], 'probe down');
  check(`with no answer the floor is UW's last word carried on a trading day a session (${s2.window?.floor}, ${s2.window?.source})`, s2.window?.source === 'carried' && s2.window.floor === '2026-11-25' && readState(stateRoot).window?.floor === '2026-11-23' && readState(stateRoot).window?.source === 'uw');
  check('carried on: Monday to Wednesday is two sessions', carriedFloor({ floor: '2026-11-23', source: 'uw', at: now }, later) === '2026-11-25');
  /* and with no word ever: the estimate */
  const fresh = createSeriesBackfill(client, { root: join(base, 'four'), stateRoot: join(base, 'four', '_series'), now: () => later, pauseMs: 0 });
  const s3 = await fresh.run(['SPY'], 'no word ever');
  check(`with no word ever the floor is the estimate (${s3.window?.floor}, ${s3.window?.source})`, s3.window?.source === 'estimate' && s3.window.floor === estimatedFloor(later));
}

/* ============ 4. the names, the calendar ============ */
{
  check(
    `the configured names are the recorder's and the extras (${seriesNamesOf({ RECORD_NAMES: 'SPY,QQQ,IWM,NVDA' }).join(',')})`,
    seriesNamesOf({ RECORD_NAMES: 'SPY,QQQ,IWM,NVDA' }).join(',') === 'SPY,QQQ,IWM,NVDA,SPX' && seriesNamesOf({}).join(',') === 'SPY,QQQ,IWM,SPX' && seriesNamesOf({ SERIES_NAMES: 'off' }).length === 0
  );
  const root = join(base, 'names');
  for (const [n, f] of [['AAPL', 'books.jsonl.gz'], ['NVDA', 'total.json'], ['TSLA', 'series.json.gz']] as const) {
    mkdirSync(join(root, n, '2026-10-13'), { recursive: true });
    writeFileSync(join(root, n, '2026-10-13', f), 'x');
  }
  writeFileSync(join(root, 'recorder.lock'), '{}');
  const all = namesToFill({ RECORD_NAMES: 'SPY' }, ['meta'], root);
  check(`every name the recorder records: configured, a tab's, on disk (${all.join(',')}; on disk ${recordedNamesOf(root).join(',')})`, all.join(',') === 'SPY,QQQ,SPX,META,AAPL,NVDA' && namesToFill({ SERIES_NAMES: 'off' }, ['META'], root).length === 0);
  check(`the trading day before a Monday is the Friday (${tradingDayBefore('2026-10-12')}); before the day after Thanksgiving, the Wednesday (${tradingDayBefore('2026-11-27')})`, tradingDayBefore('2026-10-12') === '2026-10-09' && tradingDayBefore('2026-11-27') === '2026-11-25' && weekdayBefore('2026-10-12') === '2026-10-09');
  check(
    `the walk ends at the session before at 4:30 pm (${firstDayOf(NY(2026, 10, 14, 16, 30))}), today's at 5:00 pm (${firstDayOf(NY(2026, 10, 14, 17))}), Friday's on a Saturday (${firstDayOf(NY(2026, 10, 17, 18))}), the Wednesday on Thanksgiving evening (${firstDayOf(NYst(2026, 11, 26, 18))})`,
    firstDayOf(NY(2026, 10, 14, 16, 30)) === '2026-10-13' && firstDayOf(NY(2026, 10, 14, 16, 59)) === '2026-10-13' && firstDayOf(NY(2026, 10, 14, 17)) === '2026-10-14' && firstDayOf(NY(2026, 10, 17, 18)) === '2026-10-16' && firstDayOf(NYst(2026, 11, 26, 18)) === '2026-11-25'
  );
}

/* ============ 6. the name check's edges, a wait into the live hours, a gap on the check day ============ */
{
  /* SPY empty on the check day: UW's day not in yet — nobody refused */
  const root = join(base, 'six');
  const stateRoot = join(root, '_series');
  const now = NY(2026, 10, 14, 3);
  let served = false; // ZZZQ: not served on the first run, served on the next
  const client = {
    get: async (_p: string, path: string) => {
      const [name, d] = keyOf(path).split(' ');
      if (d === '2000-01-03') return ans(403, refusal('2026-10-08'));
      if (d === '2026-10-12' && (name === 'SPY' || name === 'QQQ')) return ans(200, { data: [] });
      if (name === 'ZZZQ' && !served) return ans(200, { data: [] });
      return ans(200, rowsOf(d));
    },
  } as unknown as FeedClient;
  const job = createSeriesBackfill(client, { root, stateRoot, now: () => now, pauseMs: 0 });
  const s1 = await job.run(['QQQ', 'SPY'], 'SPY empty on the check day');
  check(`SPY empty on the check day refuses nobody (${JSON.stringify(Object.keys(s1.refusedNames))})`, Object.keys(s1.refusedNames).length === 0 && !!readSeries(root, 'QQQ', '2026-10-09')?.rows.length);
  /* a name refused one run (no rows where SPY has rows) and served the next: its refusal cleared, its days walked */
  const root2 = join(base, 'seven');
  const stateRoot2 = join(root2, '_series');
  const client2 = {
    get: async (_p: string, path: string) => {
      const [name, d] = keyOf(path).split(' ');
      if (d === '2000-01-03') return ans(403, refusal('2026-10-08'));
      if (name === 'ZZZQ' && !served) return ans(200, { data: [] });
      return ans(200, rowsOf(d));
    },
  } as unknown as FeedClient;
  const job2 = createSeriesBackfill(client2, { root: root2, stateRoot: stateRoot2, now: () => now, pauseMs: 0 });
  await job2.run(['SPY', 'ZZZQ'], 'not served');
  const refusedOnce = readState(stateRoot2).refused.ZZZQ?.code === 'no-rows';
  served = true;
  const s2 = await job2.run(['SPY', 'ZZZQ'], 'served now');
  check(`a name refused one run and served the next: its refusal cleared, its days walked (${s2.written} written)`, refusedOnce && !readState(stateRoot2).refused.ZZZQ && !!readSeries(root2, 'ZZZQ', '2026-10-08')?.rows.length);
  /* a name no longer filled leaves the list of names not served */
  served = false;
  await job2.run(['SPY', 'ZZZQ'], 'refused again');
  await job2.run(['SPY'], 'ZZZQ dropped');
  check('a name no longer filled leaves the list of names not served', !readState(stateRoot2).refused.ZZZQ);

  /* the live hours begin during the name check: the run stops there */
  const root3 = join(base, 'eight');
  let clock3 = NY(2026, 10, 14, 3, 59);
  const asked3: string[] = [];
  const client3 = {
    get: async (_p: string, path: string) => {
      asked3.push(path);
      clock3 += 30_000;
      return keyOf(path).endsWith('2000-01-03') ? ans(403, refusal('2026-10-08')) : ans(200, rowsOf(keyOf(path).split(' ')[1]));
    },
  } as unknown as FeedClient;
  const job3 = createSeriesBackfill(client3, { root: root3, stateRoot: join(root3, '_series'), now: () => clock3, pauseMs: 0 });
  const s3 = await job3.run(['SPY', 'QQQ', 'IWM', 'DIA'], 'the name check runs into 4:00 am');
  check(`the live hours beginning during the name check stop the run there (${asked3.length} calls; ${s3.stopped})`, asked3.length === 2 && !!s3.stopped?.includes('live hours'));

  /* a wait for a 429 that runs into the live hours makes no call in them */
  const root4 = join(base, 'nine');
  let clock4 = NY(2026, 10, 14, 3, 58);
  const at4: number[] = [];
  let first429 = true;
  const client4 = {
    get: async (_p: string, path: string) => {
      at4.push(clock4);
      if (keyOf(path).endsWith('2000-01-03')) return ans(403, refusal('2026-10-08'));
      if (first429) {
        first429 = false;
        clock4 += 5 * 60_000; // the back-off's wait carries the clock past 4:00 am
        return ans(429, { message: 'too many' });
      }
      return ans(200, rowsOf(keyOf(path).split(' ')[1]));
    },
  } as unknown as FeedClient;
  const job4 = createSeriesBackfill(client4, { root: root4, stateRoot: join(root4, '_series'), now: () => clock4, pauseMs: 0 });
  const s4 = await job4.run(['SPY'], 'a 429 into the live hours');
  check(`a 429's wait that runs into the live hours makes no call in them (${at4.length} calls; ${s4.stopped})`, at4.every(t => !inLiveHours(t)) && !!s4.stopped?.includes('live hours'));

  /* a gap on the check day is asked once a run, and its tries run out */
  const root5 = join(base, 'ten');
  const asked5: string[] = [];
  const client5 = {
    get: async (_p: string, path: string) => {
      asked5.push(keyOf(path));
      const [name, d] = keyOf(path).split(' ');
      if (d === '2000-01-03') return ans(403, refusal('2026-10-08'));
      if (name === 'QQQ' && d === '2026-10-12') return ans(200, { data: [] }); // a gap on the check day, SPY has rows
      return ans(200, rowsOf(d));
    },
  } as unknown as FeedClient;
  const job5 = createSeriesBackfill(client5, { root: root5, stateRoot: join(root5, '_series'), now: () => now, pauseMs: 0 });
  /* QQQ's series begins before the check day: Oct 8 held with rows */
  mkdirSync(join(root5, 'QQQ', '2026-10-08'), { recursive: true });
  writeFileSync(join(root5, 'QQQ', '2026-10-08', 'series.json'), JSON.stringify({ ...heldFileOf('QQQ', '2026-10-08') }));
  const per: number[] = [];
  for (let k = 0; k < 4; k++) {
    const b = asked5.length;
    await job5.run(['SPY', 'QQQ'], `run ${k + 1}`);
    per.push(asked5.slice(b).filter(x => x === 'QQQ 2026-10-12').length);
  }
  check(`a gap on the check day is asked once a run and its tries run out (${per.join(', ')} a run; tries ${readSeries(root5, 'QQQ', '2026-10-12')?.tries})`, JSON.stringify(per) === '[1,1,1,0]' && readSeries(root5, 'QQQ', '2026-10-12')?.tries === 3);
}

/* ============ 5. the recorder's prune walks past a file in the root ============ */
{
  const root = join(base, 'prune');
  mkdirSync(join(root, 'SPY', '2026-10-14'), { recursive: true });
  writeFileSync(join(root, 'SPY', '2026-10-14', 'books.jsonl'), '{"a":1}\n');
  writeFileSync(join(root, 'AAA.note'), 'a file in the root, listed among the names');
  const t = NY(2026, 10, 17, 12); // a Saturday: no session, the prune alone
  const client = { hasKey: () => true, get: async () => ans(503, { error: 'network' }) } as unknown as FeedClient;
  const rec = createFieldRecorder(client, { now: () => t, root, always: ['SPY'] });
  await rec.tick();
  await rec.settle();
  rec.stop();
  const files = readdirSync(join(root, 'SPY', '2026-10-14'));
  check(`the recorder's prune gzips a past day though a file stands in the root (${files.join(', ')})`, files.includes('books.jsonl.gz') && !files.includes('books.jsonl'));
}

rmSync(base, { recursive: true, force: true });
(global as unknown as { setTimeout: unknown }).setTimeout = realTimeout;
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
