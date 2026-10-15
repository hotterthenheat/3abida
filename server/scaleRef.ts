/*
==================================================
  SLAYER TERMINAL - THE BEAD SCALE'S REFERENCES (server/scaleRef.ts)

  THE FIXED AND PRIOR BASES (2026-10-14 — the owner's
  item 5 (b): "Scale basis selector: Session so far
  (current default) / Fixed (absolute $ thresholds =
  trailing 60-session p85, frozen for the day) / Prior
  session p85").

  Each session on disk keeps its per-minute peaks as a
  sparse log-binned count (data/feed/beadScale.ts
  `binsOf` — the same bins the renderer and the store
  count in), for gamma and for delta, as the day's
  scale-bins.json: off its final rows where the store
  holds the whole session, else off the rows the backfill
  rebuilds (the store's rowsOf — the same code path). A
  session still running is never kept.

  For each day D: the FIXED reference — the p85 (and the
  ring's p95) of every minute's peak over the 60 sessions
  before D, so it is fixed for the day and nothing on or
  after D moves it — and the PRIOR reference, the session
  before D's own. Written as .feed-cache/field/<NAME>/
  scale.json by the nightly job (server/scorecard.ts) and
  built on first ask; served by GET /feed/field/<NAME>/
  scale.
==================================================
*/

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { FIXED_SESSIONS, binsOf, refOfBins, type ScaleRef } from '../src/data/feed/beadScale';
import { modelStands, staleBeforeIndexRoots, TRAIL_MODEL } from '../src/data/feed/trailModel';
import { nyIsoDate } from '../src/core/nyTime';
import type { createFieldBackfill, PastDay } from './fieldBackfill';
import type { FieldStore, StoreRow } from './fieldStore';

type FieldBackfill = ReturnType<typeof createFieldBackfill>;
const ROOT = join(process.cwd(), '.feed-cache', 'field');
const FILE = 'scale.json';
const BINS = 'scale-bins.json';
const ISO = /^\d{4}-\d{2}-\d{2}$/;
/** The days a build writes references for: the newest this many sessions and today */
const DAYS_KEPT = 40;

export type ScaleGreek = 'gex' | 'dex';
export interface DayScale {
  fixed: ScaleRef | null;
  prior: ScaleRef | null;
  priorDay: string | null;
}
export interface ScaleFile {
  name: string;
  built: number;
  model: string;
  days: Record<string, Record<ScaleGreek, DayScale>>;
}
interface SessionBins {
  model: string;
  minutes: number;
  gex: Record<number, number>;
  dex: Record<number, number> | null;
}

export function createScaleRef(backfill: FieldBackfill, store: FieldStore, opts: { root?: string; now?: () => number; log?: (line: string) => void } = {}) {
  const root = opts.root ?? ROOT;
  const clock = opts.now ?? Date.now;
  const building = new Map<string, Promise<ScaleFile | null>>();

  /** A finished session's per-minute peaks, kept — null where it has no rows */
  async function binsFor(name: string, day: string): Promise<SessionBins | null> {
    const file = join(root, name, day, BINS);
    try {
      const had = JSON.parse(readFileSync(file, 'utf8')) as SessionBins;
      if (modelStands(had.model, name, day)) return had;
    } catch {
      /* not kept yet */
    }
    const bars = await backfill.minutes(name, day);
    const regular = bars?.filter(b => b.session === 'r').length ?? 0;
    /* final rows .6 knows to be wrong (an index's before it — trailModel staleBeforeIndexRoots) are rebuilt below */
    const kept = store.readRows(name, day, 'final');
    let rows: StoreRow[] = kept.some(r => staleBeforeIndexRoots(r.model, name, day)) ? [] : kept;
    if (rows.length < regular * 0.9 || rows.some(r => r.maxD == null)) {
      const past = join(root, name, day, 'past.json.gz');
      if (existsSync(past) && bars?.length) rows = store.rowsOf(JSON.parse(gunzipSync(readFileSync(past)).toString('utf8')) as PastDay, bars);
    }
    if (!rows.length) return null;
    const out: SessionBins = {
      model: TRAIL_MODEL.version,
      minutes: rows.length,
      gex: binsOf(rows.map(r => r.max)),
      dex: rows.every(r => r.maxD != null) ? binsOf(rows.map(r => r.maxD as number)) : null,
    };
    /* kept only once the session is over — today's is still growing */
    if (day < nyIsoDate(clock())) {
      mkdirSync(join(root, name, day), { recursive: true });
      writeFileSync(file, JSON.stringify(out));
    }
    return out;
  }

  /** The sessions on disk, ascending */
  const sessionsOf = (name: string): string[] => {
    let rebuilt: string[] = [];
    try {
      rebuilt = (JSON.parse(backfill.coverage(name).body) as { days: string[] }).days ?? [];
    } catch {
      rebuilt = [];
    }
    return [...new Set([...store.days(name), ...rebuilt])].filter(d => ISO.test(d)).sort();
  };

  /** Builds scale.json for a name: the newest sessions' and today's references */
  async function build(rawName: string): Promise<ScaleFile | null> {
    const name = rawName.toUpperCase();
    const today = nyIsoDate(clock());
    const sessions = sessionsOf(name).filter(d => d < today);
    const bins = new Map<string, SessionBins>();
    for (const d of sessions.slice(-(DAYS_KEPT + FIXED_SESSIONS))) {
      const b = await binsFor(name, d);
      if (b) bins.set(d, b);
    }
    const have = [...bins.keys()].sort();
    const targets = [...have.slice(-DAYS_KEPT), today];
    const days: ScaleFile['days'] = {};
    for (const day of targets) {
      const before = have.filter(d => d < day);
      const pool = before.slice(-FIXED_SESSIONS);
      const priorDay = before.length ? before[before.length - 1] : null;
      const of = (g: ScaleGreek): DayScale => {
        const counts = (ds: string[]) => ds.map(d => (g === 'gex' ? bins.get(d)!.gex : bins.get(d)!.dex)).filter((c): c is Record<number, number> => !!c);
        return { fixed: refOfBins(counts(pool)), prior: priorDay ? refOfBins(counts([priorDay])) : null, priorDay };
      };
      days[day] = { gex: of('gex'), dex: of('dex') };
    }
    const file: ScaleFile = { name, built: clock(), model: TRAIL_MODEL.version, days };
    mkdirSync(join(root, name), { recursive: true });
    writeFileSync(join(root, name, FILE), JSON.stringify(file));
    opts.log?.(`scale ${name}: ${have.length} sessions counted, references for ${targets.length} days (fixed over up to ${FIXED_SESSIONS})`);
    return file;
  }

  /** GET /feed/field/<NAME>/scale — the file, built on first ask (and again when it has no entry for today) */
  async function serve(rawName: string): Promise<{ status: number; body: string }> {
    const name = rawName.toUpperCase();
    if (!/^[A-Z][A-Z0-9.]{0,9}$/.test(name)) return { status: 400, body: JSON.stringify({ error: 'bad-request' }) };
    let file: ScaleFile | null = null;
    try {
      file = JSON.parse(readFileSync(join(root, name, FILE), 'utf8')) as ScaleFile;
    } catch {
      file = null;
    }
    const today = nyIsoDate(clock());
    if (!file || !file.days[today] || !modelStands(file.model, name)) {
      let job = building.get(name);
      if (!job) {
        job = build(name).finally(() => building.delete(name));
        building.set(name, job);
      }
      /* answered while it builds: what is on disk, said to be building */
      if (!file) return { status: 200, body: JSON.stringify({ name, building: true, days: {} }) };
      return { status: 200, body: JSON.stringify({ ...file, building: true }) };
    }
    return { status: 200, body: JSON.stringify(file) };
  }

  return { build, serve, binsFor };
}
export type ScaleRefs = ReturnType<typeof createScaleRef>;
