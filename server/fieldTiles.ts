/*
==================================================
  SLAYER TERMINAL - THE TILES ON DISK, AND BY RANGE (server/fieldTiles.ts)

  2026-10-15 — the owner's Section I: "Load by visible range plus a buffer; never load a whole history into the page.
  Precompute every timeframe (1m, 5m, 15m, 1h, 1D) at rebuild time, so a zoomed-out view never aggregates minute rows
  on the fly."

  A session's tiles (src/data/feed/tiles.ts buildDayTiles — the model the page draws, folded once to each timeframe
  through each expiry window, each column carrying its references and its held walls) are written beside the session:
  .feed-cache/field/<NAME>/<D>/tiles/<window>-<tf>.json.gz, the bars once a timeframe (bars-<tf>.json.gz), and
  tiles.json (the format, the model version, when, the minutes). A session is tiled when it is built (the backfill's
  save, the Theta rebuild), on a sweep of every session on disk without tiles of this format and model, and on a range
  that asks for one — one session at a time, a breath between, so the recorder's reads never wait on it.

  GET /feed/field/<NAME>/tiles?tf=5&w=all&from=<D>&to=<D> answers the sessions in the range with tiles — each its
  columns, bars and the window's per-minute peaks, the files' own text, never parsed and written again — and says which
  are being built, which are queued and which have nothing to build from. GET /feed/field/<NAME>/tiles/days answers
  every tiled session's day bar (a year at 1D is one answer, fourteen years too: 3,528 small bars) and the sessions it can
  tile and has not yet (`pending`) — asking a range with them builds them, newest first.
==================================================
*/
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { buildDayTiles, TILE_TFS, TILE_WINDOWS, TILES_FORMAT, type TileMinuteBar, type TileTf } from '../src/data/feed/tiles';
import { TRAIL_MODEL, type ExpiryWindow, type PastInputsLike } from '../src/data/feed/trailModel';
import type { createFieldBackfill } from './fieldBackfill';

type FieldBackfill = ReturnType<typeof createFieldBackfill>;

const ROOT = join(process.cwd(), '.feed-cache', 'field');
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const NAME_OK = /^[A-Z][A-Z0-9.]{0,9}$/;
/** A range asks for at most this many sessions (a 1h view over a year is 252; the page asks the visible span and a buffer) */
export const TILE_RANGE_MAX = 400;

export interface TilesMeta {
  f: number;
  model: string;
  builtAt: number;
  minutes: number;
  bytes: number;
}

export function createFieldTiles(backfill: Pick<FieldBackfill, 'minutes'> | null, opts: { root?: string; now?: () => number; log?: (line: string) => void } = {}) {
  const root = opts.root ?? ROOT;
  const clock = opts.now ?? Date.now;
  const log = opts.log ?? (() => undefined);
  const dirOf = (name: string, day: string) => join(root, name, day, 'tiles');
  const fileOf = (name: string, day: string, w: ExpiryWindow, tf: TileTf) => join(dirOf(name, day), `${w}-${tf}.json.gz`);
  const barsOf = (name: string, day: string, tf: TileTf) => join(dirOf(name, day), `bars-${tf}.json.gz`);
  const metaOf = (name: string, day: string) => join(dirOf(name, day), 'tiles.json');

  /** This format and this model's tiles stand for the day */
  function has(name: string, day: string): boolean {
    try {
      const m = JSON.parse(readFileSync(metaOf(name, day), 'utf8')) as TilesMeta;
      return m.f === TILES_FORMAT && m.model === TRAIL_MODEL.version;
    } catch {
      return false;
    }
  }
  /** A session there is something to tile from: its rebuilt inputs */
  const buildable = (name: string, day: string) => existsSync(join(root, name, day, 'past.json.gz'));

  /** Write one session's tiles from its inputs and bars (the backfill's save and the Theta rebuild hand them in) */
  function buildFrom(name: string, day: string, past: PastInputsLike, bars: readonly TileMinuteBar[], close: number | null): TilesMeta {
    const t0 = clock();
    const { tiles, bars: barTiles } = buildDayTiles({ name, day, past, bars, close });
    const dir = dirOf(name, day);
    mkdirSync(dir, { recursive: true });
    let bytes = 0;
    const put = (file: string, body: unknown) => {
      const z = gzipSync(Buffer.from(JSON.stringify(body)));
      bytes += z.length;
      writeFileSync(`${file}.part`, z);
      renameSync(`${file}.part`, file);
    };
    for (const b of barTiles) put(barsOf(name, day, b.tf), b);
    for (const t of tiles) put(fileOf(name, day, t.window, t.tf), t);
    const meta: TilesMeta = { f: TILES_FORMAT, model: TRAIL_MODEL.version, builtAt: clock(), minutes: tiles.find(t => t.window === 'all' && t.tf === 1)?.cols.length ?? 0, bytes };
    writeFileSync(metaOf(name, day), JSON.stringify(meta));
    dailyCache.delete(name);
    log(`tiles ${name} ${day}: ${meta.minutes} minutes, ${(bytes / 1024).toFixed(0)} KB, ${clock() - t0} ms`);
    return meta;
  }

  /** One session from what is on disk: its rebuilt inputs, its minute bars (the backfill's file, else one call), the official close */
  async function build(name: string, day: string): Promise<TilesMeta> {
    const past = JSON.parse(gunzipSync(readFileSync(join(root, name, day, 'past.json.gz'))).toString('utf8')) as PastInputsLike;
    const bars = (await backfill?.minutes(name, day)) ?? [];
    if (!bars.length) throw new Error('no minute bars for the session');
    let close: number | null = null;
    try {
      close = (JSON.parse(readFileSync(join(root, name, day, 'close.json'), 'utf8')) as { close?: number }).close ?? null;
    } catch {
      /* no official close kept: the day's bar closes at its last regular minute */
    }
    return buildFrom(name, day, past, bars, close);
  }

  /* ---- the queue: one session at a time, a breath between ---------------------------------------------------- */
  const queue: string[] = [];
  const queued = new Set<string>();
  let working: string | null = null;
  const failed = new Map<string, { why: string; at: number }>();
  const RETRY_MS = 30 * 60_000;
  let running = false;
  async function drain() {
    if (running) return;
    running = true;
    try {
      while (queue.length) {
        const key = queue.shift()!;
        queued.delete(key);
        const [name, day] = key.split('|');
        if (has(name, day)) continue;
        working = key;
        try {
          await build(name, day);
          failed.delete(key);
        } catch (e) {
          failed.set(key, { why: e instanceof Error ? e.message : 'refused', at: clock() });
          log(`tiles ${name} ${day} failed: ${e instanceof Error ? e.message : String(e)}`);
        }
        working = null;
        await new Promise(r => setTimeout(r, 20));
      }
    } finally {
      running = false;
      working = null;
    }
  }
  /** Queue the sessions without tiles that have inputs to tile from — the newest first */
  function ensure(name: string, days: readonly string[], front = false): void {
    const t = name.toUpperCase();
    dailyCache.delete(t);
    const want = [...days].filter(d => ISO.test(d)).sort().reverse();
    const add: string[] = [];
    for (const d of want) {
      const key = `${t}|${d}`;
      if (queued.has(key) || working === key || has(t, d) || !buildable(t, d)) continue;
      const f = failed.get(key);
      if (f && clock() - f.at < RETRY_MS) continue;
      queued.add(key);
      add.push(key);
    }
    if (front) queue.unshift(...add);
    else queue.push(...add);
    if (add.length) void drain();
  }
  /** Every session on disk for a name, ascending */
  function sessions(name: string): string[] {
    try {
      return readdirSync(join(root, name.toUpperCase())).filter(d => ISO.test(d)).sort();
    } catch {
      return [];
    }
  }
  /** The sweep: every name's sessions with inputs but no tiles of this format and model */
  function sweep(names?: readonly string[]): number {
    let n = 0;
    let list = names;
    if (!list) {
      try {
        list = readdirSync(root).filter(x => NAME_OK.test(x));
      } catch {
        list = [];
      }
    }
    for (const name of list) {
      const before = queue.length;
      ensure(name, sessions(name));
      n += queue.length - before;
    }
    return n;
  }

  /* ---- the answers ------------------------------------------------------------------------------------------- */
  const readText = (file: string): string | null => {
    try {
      return gunzipSync(readFileSync(file)).toString('utf8');
    } catch {
      return null;
    }
  };

  /** GET /feed/field/<NAME>/tiles?tf=&w=&from=&to= */
  function serve(rawName: string, tfRaw: string, wRaw: string, from: string, to: string): { status: number; body: string } {
    const name = rawName.toUpperCase();
    const tf = Number(tfRaw) as TileTf;
    const w = (wRaw || 'all') as ExpiryWindow;
    if (!NAME_OK.test(name) || !TILE_TFS.includes(tf) || !TILE_WINDOWS.includes(w) || !ISO.test(from) || !ISO.test(to) || from > to) return { status: 400, body: JSON.stringify({ error: 'bad-request' }) };
    const days = sessions(name).filter(d => d >= from && d <= to);
    const picked = days.slice(-TILE_RANGE_MAX);
    const parts: string[] = [];
    const building: string[] = [];
    const none: string[] = [];
    const need: string[] = [];
    for (const d of picked) {
      if (has(name, d)) {
        const cols = readText(fileOf(name, d, w, tf));
        const bars = readText(barsOf(name, d, tf));
        if (cols && bars) {
          parts.push(`{"day":"${d}","tile":${cols},"bars":${bars}}`);
          continue;
        }
      }
      if (buildable(name, d)) {
        need.push(d);
        building.push(d);
      } else none.push(d);
    }
    if (need.length) ensure(name, need, true);
    const queuedDays = building.filter(d => queued.has(`${name}|${d}`));
    const failedWhy: Record<string, string> = {};
    for (const d of building) {
      const f = failed.get(`${name}|${d}`);
      if (f) failedWhy[d] = f.why;
    }
    return {
      status: 200,
      body: `{"name":"${name}","tf":${tf},"window":"${w}","model":"${TRAIL_MODEL.version}","days":[${parts.join(',')}],"building":${JSON.stringify(building)},"queued":${JSON.stringify(queuedDays)},"working":${JSON.stringify(working?.startsWith(`${name}|`) ? working.slice(name.length + 1) : null)},"failed":${JSON.stringify(failedWhy)},"none":${JSON.stringify(none)},"cut":${days.length > picked.length}}`,
    };
  }

  /* every tiled session's day bar, kept in memory a name until a session is tiled */
  const dailyCache = new Map<string, string>();
  /** GET /feed/field/<NAME>/tiles/days */
  function daily(rawName: string): { status: number; body: string } {
    const name = rawName.toUpperCase();
    if (!NAME_OK.test(name)) return { status: 400, body: JSON.stringify({ error: 'bad-name' }) };
    let body = dailyCache.get(name);
    if (!body) {
      const bars: unknown[] = [];
      const days: string[] = [];
      const pending: string[] = [];
      for (const d of sessions(name)) {
        if (!has(name, d)) {
          /* a session the server can tile and has not: said, so the page can ask for it (and the ask builds it) */
          if (buildable(name, d)) pending.push(d);
          continue;
        }
        const t = readText(barsOf(name, d, 1440));
        if (!t) continue;
        const b = (JSON.parse(t) as { bars: unknown[] }).bars;
        if (b.length) {
          bars.push(b[0]);
          days.push(d);
        }
      }
      body = JSON.stringify({ name, model: TRAIL_MODEL.version, days, bars, pending });
      dailyCache.set(name, body);
    }
    return { status: 200, body };
  }

  /** What is tiled a name: sessions, bytes, first and last */
  function coverage(rawName: string): { sessions: number; bytes: number; first: string | null; last: string | null } {
    const name = rawName.toUpperCase();
    let n = 0;
    let bytes = 0;
    let first: string | null = null;
    let last: string | null = null;
    for (const d of sessions(name)) {
      if (!has(name, d)) continue;
      n++;
      first ??= d;
      last = d;
      try {
        bytes += (JSON.parse(readFileSync(metaOf(name, d), 'utf8')) as TilesMeta).bytes;
      } catch {
        try {
          bytes += statSync(metaOf(name, d)).size;
        } catch {
          /* gone */
        }
      }
    }
    return { sessions: n, bytes, first, last };
  }

  return { has, build, buildFrom, ensure, sweep, serve, daily, coverage, state: () => ({ queued: queue.length, working, failed: failed.size }) };
}
export type FieldTiles = ReturnType<typeof createFieldTiles>;
