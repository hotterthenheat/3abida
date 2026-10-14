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
  from the session before today, newest first, for
  SERIES_DAYS calendar days (730) and writes each
  session's rows AS ANSWERED (every field, never one
  dropped) to .feed-cache/field/<NAME>/<D>/series.json.
  A day already held — a series.json, the recorder's
  own total.json for that day, or a rebuilt day whose
  past.json.gz carries the series — is skipped, so a
  run resumes where it stopped. A day UW answers
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
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import type { FeedClient } from './feed';
import { nyIsoDate } from '../src/core/nyTime';

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
  const pastHasTotal = new Map<string, boolean>();

  /** The day is held already: this job's file, the recorder's total.json, or a rebuilt day carrying the series */
  function held(name: string, day: string): boolean {
    const dir = join(root, name, day);
    if (existsSync(join(dir, SERIES_FILE))) return true;
    if (existsSync(join(dir, 'total.json')) || existsSync(join(dir, 'total.json.gz'))) return true;
    const past = join(dir, 'past.json.gz');
    if (!existsSync(past)) return false;
    const key = `${name}|${day}`;
    let has = pastHasTotal.get(key);
    if (has === undefined) {
      try {
        const p = JSON.parse(gunzipSync(readFileSync(past)).toString('utf8')) as { total?: { rows?: unknown[] } | null };
        has = !!p.total && Array.isArray(p.total.rows) && p.total.rows.length > 0;
      } catch {
        has = false;
      }
      pastHasTotal.set(key, has);
    }
    return has;
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

  /** Every name, newest session first, back `days` calendar days from the session before today */
  async function run(names: string[], days: number): Promise<SeriesStatus> {
    if (status.running) return status;
    Object.assign(status, { running: true, names, days, current: null, written: 0, empty: 0, skipped: 0, refused: 0, failed: {}, oldest: {}, startedAt: clock(), finishedAt: null });
    const today = nyIsoDate(clock());
    const floor = new Date(Date.UTC(...(today.split('-').map(Number) as [number, number, number]).map((v, i) => (i === 1 ? v - 1 : v)) as [number, number, number], 12) - days * 86_400_000).toISOString().slice(0, 10);
    try {
      for (const name of names) {
        let d = weekdayBefore(today);
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

  return { run, status: () => status, held };
}
