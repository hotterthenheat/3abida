/*
==================================================
  SLAYER TERMINAL - UW'S PER-MINUTE SPOT EXPOSURES, BACK THROUGH ITS WINDOW
  (server/seriesBackfill.ts)

  2026-10-14 — the owner (B5): "Start pulling UW
  per-minute spot exposures (_oi, _vol, _dir) for SPY,
  QQQ, SPX now. Its ~730-day window loses a day each
  session."

  GET /api/stock/{T}/spot-exposures?date=D answers a
  name's whole-book gamma per 1% a minute for a
  session — by open interest, by volume and
  directionalized (UW's _oi, _vol, _dir), its price,
  and the other greeks' series. This job walks back
  from the session before today — today's own once it
  is 5:00 pm New York on a weekday, UW's rows for the
  date standing whole by then (its last row 4:00 pm) —
  newest first, for
  SERIES_DAYS calendar days (730) and writes each
  session's rows AS ANSWERED (every field, never one
  dropped) to .feed-cache/field/<NAME>/<D>/series.json.
  A day already held — this job's own series.json,
  and nothing else — is skipped, so a run resumes
  where it stopped. The recorder's total.json and a
  rebuilt day's past.json.gz never count: they keep
  only the figures the trail reads, and on the days
  before 2026-10-13 only the open-interest series
  (three figures a row — measured 2026-10-15: SPY's
  Oct 12, QQQ's Oct 12 and 13, every rebuilt day of
  Sep 29 to Oct 9), so they would have stood in for
  UW's _vol and _dir that were never kept. A day UW answers
  empty (a holiday, a day beyond its window) is
  written with `empty: true` so it is not asked again;
  a refused call (429, a 5xx, the network) is not
  written and is asked again on the next pass. One
  call at a time behind the recorder's own reads (the
  proxy's gate), a pause between calls, so the
  recorder is never starved. Runs on the always-on
  recorder (server/recorderMain.ts); nothing of it
  in the browser.
==================================================
*/
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, readSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FeedClient } from './feed';
import { nyIsoDate, nyMinutes, nyParts } from '../src/core/nyTime';

const ROOT = join(process.cwd(), '.feed-cache', 'field');
export const SERIES_FILE = 'series.json';
export const SERIES_FORMAT = 1;

export interface SeriesFile {
  format: number;
  name: string;
  date: string;
  receivedAt: number;
  url: string;
  /** UW's rows as answered — every field */
  rows: Record<string, unknown>[];
  /** UW answered no rows for the date (a holiday, a day beyond its window) */
  empty?: boolean;
}

export interface SeriesStatus {
  running: boolean;
  names: string[];
  days: number;
  /** the name and day in hand */
  current: string | null;
  written: number;
  empty: number;
  skipped: number;
  refused: number;
  failed: Record<string, number>;
  /** the oldest date each name answered rows for in this run */
  oldest: Record<string, string>;
  startedAt: number;
  finishedAt: number | null;
}

/** Where a walk starts: today's session once its rows stand whole (5:00 pm New York on a weekday), else the one before */
export const SERIES_TODAY_FROM_MIN = 17 * 60;
export function firstDayOf(at: number): string {
  const today = nyIsoDate(at);
  const wd = nyParts(at).weekday;
  return wd !== 0 && wd !== 6 && nyMinutes(at) >= SERIES_TODAY_FROM_MIN ? today : weekdayBefore(today);
}

export interface SeriesStored {
  /** sessions held with rows */
  days: number;
  /** dates UW answered empty (a holiday, beyond its window) */
  empty: number;
  oldest: string | null;
  newest: string | null;
}

/** An empty day's file ends `"rows":[],"empty":true}` (the writer's own order) — its last bytes say so, nothing parsed */
function emptyFile(path: string): boolean {
  const tail = '"rows":[],"empty":true}';
  const size = statSync(path).size;
  const buf = Buffer.alloc(Math.min(size, tail.length));
  const fd = openSync(path, 'r');
  try {
    readSync(fd, buf, 0, buf.length, size - buf.length);
  } finally {
    closeSync(fd);
  }
  return buf.toString('utf8') === tail;
}

/** What is held on this machine, a name at a time — read off the files' ends */
export function storedOf(names: string[], root = ROOT): Record<string, SeriesStored> {
  const out: Record<string, SeriesStored> = {};
  for (const name of names) {
    const s: SeriesStored = { days: 0, empty: 0, oldest: null, newest: null };
    const dir = join(root, name);
    if (existsSync(dir))
      for (const d of readdirSync(dir).sort()) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
        const f = join(dir, d, SERIES_FILE);
        if (!existsSync(f)) continue;
        if (emptyFile(f)) {
          s.empty++;
          continue;
        }
        s.days++;
        s.oldest ??= d;
        s.newest = d;
      }
    out[name] = s;
  }
  return out;
}

/** The session before a New York date: the weekday before (holidays answer empty and are kept as such) */
export function weekdayBefore(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d, 12);
  for (let k = 1; k <= 7; k++) {
    const x = new Date(t - k * 86_400_000);
    const wd = x.getUTCDay();
    if (wd !== 0 && wd !== 6) return x.toISOString().slice(0, 10);
  }
  return iso;
}

export function createSeriesBackfill(client: FeedClient, opts: { root?: string; now?: () => number; pauseMs?: number; log?: (line: string) => void } = {}) {
  const root = opts.root ?? ROOT;
  const clock = opts.now ?? Date.now;
  const pauseMs = opts.pauseMs ?? 1500;
  const log = opts.log ?? (() => undefined);
  const status: SeriesStatus = { running: false, names: [], days: 0, current: null, written: 0, empty: 0, skipped: 0, refused: 0, failed: {}, oldest: {}, startedAt: 0, finishedAt: null };
  /** The day is held already: this job's own file, written whole as UW answered it — never another file's subset */
  function held(name: string, day: string): boolean {
    return existsSync(join(root, name, day, SERIES_FILE));
  }

  const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

  /** One day: written, empty, skipped, or refused (asked again next run) */
  async function day(name: string, d: string): Promise<'written' | 'empty' | 'skipped' | 'refused' | 'failed'> {
    if (held(name, d)) return 'skipped';
    const url = `/api/stock/${name}/spot-exposures?date=${d}`;
    for (let attempt = 0; attempt < 3; attempt++) {
      const a = await client.get('uw', url);
      if (a.status === 429) {
        await sleep(60_000);
        continue;
      }
      if (a.status !== 200) {
        if (a.status >= 500 || a.status === 502 || a.status === 503) return 'refused';
        status.failed[`${name} ${d}`] = a.status;
        return 'failed';
      }
      let rows: Record<string, unknown>[] = [];
      try {
        rows = (JSON.parse(a.body) as { data?: Record<string, unknown>[] }).data ?? [];
      } catch {
        return 'refused';
      }
      const file: SeriesFile = { format: SERIES_FORMAT, name, date: d, receivedAt: clock(), url, rows, ...(rows.length ? {} : { empty: true }) };
      try {
        mkdirSync(join(root, name, d), { recursive: true });
        writeFileSync(join(root, name, d, SERIES_FILE), JSON.stringify(file));
      } catch {
        return 'refused';
      }
      return rows.length ? 'written' : 'empty';
    }
    return 'refused';
  }

  /** Every name, newest session first, back `days` calendar days from the session before today (today's after 5:00 pm) */
  async function run(names: string[], days: number): Promise<SeriesStatus> {
    if (status.running) return status;
    Object.assign(status, { running: true, names, days, current: null, written: 0, empty: 0, skipped: 0, refused: 0, failed: {}, oldest: {}, startedAt: clock(), finishedAt: null });
    const today = nyIsoDate(clock());
    const floor = new Date(Date.UTC(...(today.split('-').map(Number) as [number, number, number]).map((v, i) => (i === 1 ? v - 1 : v)) as [number, number, number], 12) - days * 86_400_000).toISOString().slice(0, 10);
    try {
      for (const name of names) {
        let d = firstDayOf(clock());
        let n = 0;
        while (d >= floor) {
          status.current = `${name} ${d}`;
          const r = await day(name, d);
          if (r === 'written') {
            status.written++;
            status.oldest[name] = d;
          } else if (r === 'empty') status.empty++;
          else if (r === 'skipped') status.skipped++;
          else if (r === 'refused') status.refused++;
          if (r !== 'skipped') await sleep(pauseMs);
          n++;
          if (n % 50 === 0) log(`series ${name}: ${n} days walked, at ${d} — written ${status.written}, empty ${status.empty}, skipped ${status.skipped}, refused ${status.refused}`);
          d = weekdayBefore(d);
        }
        log(`series ${name}: done to ${floor} — written ${status.written}, empty ${status.empty}, skipped ${status.skipped}, refused ${status.refused}${status.oldest[name] ? `, oldest with rows ${status.oldest[name]}` : ''}`);
      }
    } finally {
      status.running = false;
      status.current = null;
      status.finishedAt = clock();
    }
    return status;
  }

  return { run, status: () => status, held, stored: (names: string[]) => storedOf(names, root) };
}
