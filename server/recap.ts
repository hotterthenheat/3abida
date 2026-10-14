/*
==================================================
  SLAYER TERMINAL - THE SESSION RECAP, BUILT (server/recap.ts)

  THE OWNER'S ITEM 9 (2026-10-14; the recap itself is
  src/data/feed/sessionRecap.ts). Once a session is over —
  4:05 pm New York on its day — its recap is built from
  what the track record and the priced move read, by their
  own functions:
    · the session's rows: scorecard.ts loadSession (the
      store's final rows, else the session rebuilt);
    · the priced move's row: pricedMove.ts calibrationDay;
    · the regime's quantiles a page on the day may read:
      regime.json through trailModel regimeBucketsFor —
      kept in the recap, since the reference moves on;
  kept as .feed-cache/field/<NAME>/<D>/recap.json and
  built again when something it read has changed since
  (the official close kept, the session rebuilt, the
  store's rows grown) — a version a figure, so the
  Journal's entry follows a figure that changed and
  nothing else.

  THE ALWAYS-ON RECORDER builds every recorded name's
  recap at 4:05 pm and again at 5:05 pm (recorderMain.ts);
  a dev server builds one on its first ask. Served by
    GET /feed/field/<NAME>/recap?day=<D>[&field=1]
      field=1 adds what the Journal's picture draws: the
      rows' columns and the day's budget and profile;
    GET /feed/field/recaps?days=<N>
      the sessions of the last N days a recap can be built
      for — the recorded names' (a name the recorder wrote
      rows for in the window), each session recorded or
      rebuilt, over — each with its recap's version, or
      null before it is built.
==================================================
*/

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { nyIsoDate, nyWallTime } from '../src/core/nyTime';
import { nyMinuteOf, type TrackConfig } from '../src/data/feed/trackRecord';
import { buildRecap, RECAP_FORMAT, type SessionRecap } from '../src/data/feed/sessionRecap';
import { regimeBucketsFor, regimeReachFor, type RegimeReference } from '../src/data/feed/trailModel';
import { isLoaded, loadConfig, loadSession } from './scorecard';
import type { createFieldBackfill } from './fieldBackfill';
import type { FieldStore } from './fieldStore';
import type { PricedMove } from './pricedMove';

type FieldBackfill = ReturnType<typeof createFieldBackfill>;
const ROOT = join(process.cwd(), '.feed-cache', 'field');
const CONFIG = join(process.cwd(), 'server', 'scorecard.config.json');
const FILE = 'recap.json';
const NAME_OK = /^[A-Z][A-Z0-9.]{0,9}$/;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
/** What a recap reads in its day's folder — one of them newer than the recap, and it is built again */
const INPUTS = ['final.jsonl', 'final.jsonl.gz', 'past.json.gz', 'bars.json.gz', 'tape-price.json', 'move.json', 'close.json'];

/** The recap as kept: the quantiles its regime path was read against (the reference moves past the day) and when it
    was last checked against its inputs */
export interface KeptRecap extends SessionRecap {
  quantiles: (number[] | null)[] | null;
  checkedAt: number;
}

const isoAdd = (iso: string, days: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};
const mtime = (file: string): number => {
  try {
    return statSync(file).mtimeMs;
  } catch {
    return 0;
  }
};

export function createRecap(backfill: FieldBackfill, store: FieldStore, move: PricedMove, opts: { root?: string; now?: () => number; log?: (line: string) => void; config?: TrackConfig } = {}) {
  const root = opts.root ?? ROOT;
  const clock = opts.now ?? Date.now;
  const fileOf = (name: string, day: string) => join(root, name, day, FILE);

  /** The session is over: a day before today, or today from 4:05 pm New York */
  const over = (day: string): boolean => {
    const today = nyIsoDate(clock());
    if (day !== today) return day < today;
    const [y, m, d] = day.split('-').map(Number);
    return clock() >= nyWallTime(y, m, d, 16, 5);
  };

  function read(name: string, day: string): KeptRecap | null {
    try {
      const r = JSON.parse(readFileSync(fileOf(name, day), 'utf8')) as KeptRecap;
      return r.format === RECAP_FORMAT ? r : null;
    } catch {
      return null;
    }
  }
  const regimeOf = (name: string): RegimeReference | null => {
    try {
      return JSON.parse(readFileSync(join(root, name, 'regime.json'), 'utf8')) as RegimeReference;
    } catch {
      return null;
    }
  };
  /** Something the kept recap read has changed since it was checked */
  const stale = (name: string, day: string, kept: KeptRecap): boolean =>
    INPUTS.some(f => mtime(join(root, name, day, f)) > kept.checkedAt) || mtime(opts.config ? '' : CONFIG) > kept.checkedAt || (!kept.quantiles && mtime(join(root, name, 'regime.json')) > kept.checkedAt);

  /** THE RECAP for a session: built, kept, and the kept one handed back while nothing it read has changed */
  async function build(rawName: string, day: string, force = false): Promise<{ recap: KeptRecap } | { why: string; status: number }> {
    const name = rawName.toUpperCase();
    if (!NAME_OK.test(name) || !ISO.test(day)) return { why: 'bad-request', status: 400 };
    if (!over(day)) return { why: 'session-open', status: 409 };
    const had = read(name, day);
    if (had && !force && !stale(name, day, had)) return { recap: had };
    const cfg = opts.config ?? loadConfig();
    const got = await loadSession(backfill, store, root, name, day, null);
    const bars = isLoaded(got) ? got.session.bars : got.bars;
    if (!bars.length) return { why: isLoaded(got) ? 'no-bars' : got.why, status: 404 };
    const cal = await move.calibrationDay(name, day, isLoaded(got) ? got.at10 : null);
    /* the regime's quantiles for the day — the reference's own while it can answer for the day, else the ones kept */
    const ref = regimeOf(name);
    const fresh = ref ? regimeBucketsFor(ref, day) : null;
    const quantiles = fresh ?? had?.quantiles ?? null;
    /* what the quantiles in hand reach over: the reference's own choice for the day, else what the kept recap said */
    const reach = fresh && ref ? regimeReachFor(ref, day) : had?.quantiles ? { through: had.regime.through ?? '', sessions: had.regime.sessions } : null;
    const now = clock();
    const recap = buildRecap({
      name,
      day,
      builtAt: now,
      session: isLoaded(got) ? got.session : null,
      source: isLoaded(got) ? got.source : null,
      why: isLoaded(got) ? null : got.why,
      bars,
      cfg,
      calib: 'row' in cal ? cal.row : null,
      calibFrom: 'row' in cal ? cal.from : null,
      moveWhy: 'row' in cal ? null : cal.why,
      quantiles,
      ref: reach,
      minuteOf: nyMinuteOf,
    });
    /* the same figures keep the moment they first stood: a check that changed nothing is not a new version */
    const kept: KeptRecap = had && had.version === recap.version ? { ...had, checkedAt: now } : { ...recap, quantiles: quantiles ? quantiles.map(q => (q ? [...q] : null)) : null, checkedAt: now };
    mkdirSync(join(root, name, day), { recursive: true });
    writeFileSync(fileOf(name, day), JSON.stringify(kept));
    if (kept.version !== had?.version)
      opts.log?.(
        `recap ${name} ${day}: ${recap.source ?? 'no rows'}, ${recap.flips.length} flip crossings, ${recap.walls.length} wall moves, ${recap.touches.length} touches${recap.move ? `, close ${recap.move.verdict.sigmas.toFixed(2)}σ (${recap.move.closeFrom})` : ''}`
      );
    return { recap: kept };
  }

  /** What the Journal's picture draws beside the recap: the rows' columns, the day's budget and profile */
  async function fieldOf(name: string, day: string): Promise<{ cols: [number, number, [number, number][]][]; move: { prevClose: number; sigma: number; from: string; profile: number[]; close: number | null } | null }> {
    const got = await loadSession(backfill, store, root, name, day, null);
    const cols: [number, number, [number, number][]][] = isLoaded(got) ? got.session.rows.map(r => [r.m, r.spot, r.cells]) : [];
    const b = await move.budget(name, day);
    if (!b?.today) return { cols, move: null };
    const p = await move.profile(name, day);
    const close = await move.officialClose(name, day);
    return { cols, move: { prevClose: b.prevClose, sigma: b.today.sigma, from: b.today.from, profile: p.share, close: close?.close ?? null } };
  }

  /** GET /feed/field/<NAME>/recap?day=<D>[&field=1] */
  async function serve(rawName: string, day: string, field: boolean): Promise<{ status: number; body: string }> {
    const got = await build(rawName, day);
    if (!('recap' in got)) return { status: got.status, body: JSON.stringify({ error: got.why }) };
    if (!field) return { status: 200, body: JSON.stringify(got.recap) };
    return { status: 200, body: JSON.stringify({ ...got.recap, field: await fieldOf(got.recap.name, day) }) };
  }

  /** GET /feed/field/recaps?days=<N>: the sessions of the last N calendar days a recap can be built for, newest first */
  function index(rawDays: string): { status: number; body: string } {
    const days = Math.max(1, Math.min(30, Number(rawDays) || 7));
    const from = isoAdd(nyIsoDate(clock()), -days);
    const out: { name: string; day: string; version: string | null; builtAt: number | null }[] = [];
    let names: string[] = [];
    try {
      names = readdirSync(root).filter(n => NAME_OK.test(n));
    } catch {
      /* nothing recorded yet */
    }
    const STORED = ['final.jsonl', 'final.jsonl.gz', 'shown.jsonl', 'shown.jsonl.gz'];
    for (const name of names) {
      let dirs: string[] = [];
      try {
        dirs = readdirSync(join(root, name)).filter(d => ISO.test(d) && d >= from && over(d));
      } catch {
        continue;
      }
      /* THE RECORDED NAMES: a name the recorder wrote rows for in the window — its sessions recorded or rebuilt. A name
         Terrain only opened has rebuilt sessions (useServerPastSessions) and no recap */
      if (!dirs.some(day => STORED.some(f => existsSync(join(root, name, day, f))))) continue;
      for (const day of dirs) {
        const dir = join(root, name, day);
        if (![...STORED, 'past.json.gz'].some(f => existsSync(join(dir, f)))) continue;
        const r = read(name, day);
        out.push({ name, day, version: r?.version ?? null, builtAt: r?.builtAt ?? null });
      }
    }
    out.sort((a, b) => b.day.localeCompare(a.day) || a.name.localeCompare(b.name));
    return { status: 200, body: JSON.stringify({ sessions: out }) };
  }

  return { build, read, serve, index, over };
}
export type RecapJob = ReturnType<typeof createRecap>;
