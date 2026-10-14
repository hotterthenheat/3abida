/*
==================================================
  SLAYER TERMINAL - THE SCORECARD'S NIGHTLY JOB (server/scorecard.ts)

  THE TRACK RECORD RUN AFTER THE CLOSE (2026-10-13 —
  the owner's item 2: "nightly event study over the
  snapshot store (runs after 4:00 p.m. ET)", "The
  scorecard (item 2) reads final rows only", "Hold out
  the most recent 6 months and evaluate it once, after
  parameters are frozen. Print the number of variants
  tried beside every result").

  THE SESSIONS: every day the store holds final rows
  for (server/fieldStore.ts) and every session the
  backfill rebuilt (server/fieldBackfill.ts — its rows
  through the store's rowsOf, the same code path, so a
  rebuilt session's rows ARE final rows), each with its
  minute bars (kept beside the session) and the session
  before's official close (the first bar's day before,
  off the bars kept). UW's directionalized whole-book
  series rides along for the attribution test where a
  session carries it.

  THE HOLD-OUT: the most recent `holdoutMonths` months
  are set aside; the main record is the sessions before
  them. The hold-out is evaluated ONCE per config
  version and kept in the file with the moment and the
  version it was evaluated under; a later run with the
  same version keeps it unchanged, and a run under a
  new version evaluates it again and says so — never
  silently.

  ON DISK: .feed-cache/field/<NAME>/scorecard.json.
  Served by GET /feed/field/<NAME>/scorecard. Run by
  the always-on recorder after 4:05 pm New York, once a
  day, and by hand: npm run field:scorecard -- SPY.
==================================================
*/

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { LEVEL_KINDS, recordLine, trackRecord, nyMinuteOf, type LevelKind, type TrackConfig, type TrackRecord, type TrackSession } from '../src/data/feed/trackRecord';
import { buildRegimeReference, type RegimeReference } from '../src/data/feed/trailModel';
import type { createFieldBackfill, PastDay } from './fieldBackfill';
import type { FieldStore, StoreRow } from './fieldStore';
import type { PricedMove } from './pricedMove';
import type { ScaleRefs } from './scaleRef';
import { sigmaOf } from '../src/data/feed/trailModel';
import type { CalibrationDay } from '../src/data/feed/pricedMove';

type FieldBackfill = ReturnType<typeof createFieldBackfill>;
const ROOT = join(process.cwd(), '.feed-cache', 'field');
const CONFIG = join(process.cwd(), 'server', 'scorecard.config.json');
const FILE = 'scorecard.json';
const REGIME = 'regime.json';
/** The sessions the regime's percentile reaches back over (the owner's item 3) */
const REGIME_TRAILING = 250;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export interface Scorecard {
  name: string;
  builtAt: number;
  configVersion: string;
  /** The sessions before the hold-out */
  main: TrackRecord;
  /** The most recent months, evaluated once per config version */
  holdout: { from: string; to: string; evaluatedAt: number; configVersion: string; record: TrackRecord } | null;
  /** How the hold-out stands: kept from an earlier run, evaluated now, or evaluated again under a new version */
  holdoutNote: string;
  /** One line a level type, as How sure prints it: the main record's, the hold-out's after it */
  lines: Record<LevelKind, string>;
  /** Sessions read: from the store's final rows, and rebuilt */
  sources: { final: number; rebuilt: number; skipped: number };
}

export function loadConfig(path = CONFIG): TrackConfig {
  return JSON.parse(readFileSync(path, 'utf8')) as TrackConfig;
}

export interface LoadedSession {
  session: TrackSession;
  source: 'final' | 'rebuilt';
  at10: CalibrationDay['at10'];
}
/** A session the track record cannot read: why, and the regular bars it has (the session recap still reads them) */
export interface NoSession {
  why: string;
  bars: TrackSession['bars'];
}
/**
 * A SESSION'S ROWS AND BARS as the track record reads them — the store's final rows where the recorder wrote 90% of the
 * session's minutes, else the session rebuilt (its past.json.gz through the store's rowsOf, the same code path) — and its
 * 10:00 am straddle. One function for the scorecard and the session recap (server/recap.ts).
 */
export async function loadSession(backfill: FieldBackfill, store: FieldStore, root: string, name: string, day: string, prevClose: number | null): Promise<LoadedSession | NoSession> {
  const bars = await backfill.minutes(name, day);
  if (!bars?.length) return { why: 'No minute bars for the session on this machine.', bars: [] };
  const trackBars = bars
    .filter(b => b.session === 'r' && b.open != null && b.high != null && b.low != null)
    .map(b => ({ time: b.time, open: b.open!, high: b.high!, low: b.low!, close: b.close }));
  if (trackBars.length < 30) return { why: `Only ${trackBars.length} regular minute bars for the session.`, bars: trackBars };
  const final = store.readRows(name, day, 'final');
  let rows: StoreRow[] = final;
  let source: 'final' | 'rebuilt' = 'final';
  let dir: [number, number][] | undefined;
  if (rows.length < trackBars.length * 0.9) {
    const file = join(root, name, day, 'past.json.gz');
    if (!existsSync(file))
      return { why: `The store holds ${final.length} of the session's ${trackBars.length} minutes as final rows and the session has not been rebuilt — the track record reads a session from 90%.`, bars: trackBars };
    const past = JSON.parse(gunzipSync(readFileSync(file)).toString('utf8')) as PastDay;
    rows = store.rowsOf(past, bars);
    source = 'rebuilt';
    if (past.total?.rows.some(r => r.length >= 5)) dir = past.total.rows.filter(r => r[4] != null).map(r => [r[0], r[4] as number]);
  }
  if (!rows.length) return { why: 'The rebuilt session holds no columns.', bars: trackBars };
  /* the 10:00 am straddle (the calibration's second budget): the row of 10:00 New York, its σ to the close */
  const r10 = rows.find(r => nyMinuteOf(r.m) === 10 * 60);
  const s10 = r10 ? sigmaOf(r10.str0) : null;
  const at10: CalibrationDay['at10'] = r10 && s10 != null && s10 > 0 ? { spot: r10.spot, sigma: s10, src: r10.str0?.src ?? 'model' } : null;
  return { session: { day, rows: rows.map(r => ({ m: r.m, spot: r.spot, flip: r.flip, cw: r.cw, pw: r.pw, top: r.top, net: r.net, netP: r.netP, cells: r.cells.map(c => [c[0], c[1]] as [number, number]), str0: r.str0 })), bars: trackBars, prevClose, dir }, source, at10 };
}
export const isLoaded = (x: LoadedSession | NoSession): x is LoadedSession => 'session' in x;

const isoAdd = (iso: string, days: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};
/** "Sep 29" from a New York date, as the house prints one (core/format isoDayLabel, kept out of the server's imports) */
const dayLabel = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const monthsBack = (iso: string, months: number) => {
  const [y, m] = iso.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 - months, 1));
  return d.toISOString().slice(0, 10);
};

export function createScorecard(backfill: FieldBackfill, store: FieldStore, opts: { root?: string; config?: TrackConfig; now?: () => number; log?: (line: string) => void; move?: PricedMove; scale?: ScaleRefs } = {}) {
  const root = opts.root ?? ROOT;
  const clock = opts.now ?? Date.now;
  const fileOf = (name: string) => join(root, name, FILE);

  function read(name: string): Scorecard | null {
    try {
      return JSON.parse(readFileSync(fileOf(name.toUpperCase()), 'utf8')) as Scorecard;
    } catch {
      return null;
    }
  }

  /** A session's rows and bars: the store's final rows where the recorder wrote them, else the rebuilt session's */
  async function sessionOf(name: string, day: string, prevClose: number | null): Promise<LoadedSession | null> {
    const got = await loadSession(backfill, store, root, name, day, prevClose);
    return isLoaded(got) ? got : null;
  }

  /** The job for one name: every session on disk, the main record and the hold-out, written as scorecard.json */
  async function run(name: string): Promise<Scorecard | null> {
    const t = name.toUpperCase();
    const cfg = opts.config ?? loadConfig();
    const days = [...new Set([...store.days(t), ...(JSON.parse(backfill.coverage(t).body) as { days: string[] }).days])].filter(d => ISO.test(d)).sort();
    if (!days.length) return null;
    const sessions: TrackSession[] = [];
    let finals = 0;
    let rebuilt = 0;
    let skipped = 0;
    let prevClose: number | null = null;
    const at10 = new Map<string, CalibrationDay['at10']>();
    for (const day of days) {
      const got = await sessionOf(t, day, prevClose);
      if (!got) {
        skipped++;
        continue;
      }
      sessions.push(got.session);
      at10.set(day, got.at10);
      if (got.source === 'final') finals++;
      else rebuilt++;
      prevClose = got.session.bars[got.session.bars.length - 1].close;
    }
    if (!sessions.length) return null;
    const last = sessions[sessions.length - 1].day;
    const holdFrom = monthsBack(last, cfg.holdoutMonths);
    const mainSessions = sessions.filter(s => s.day < holdFrom);
    const holdSessions = sessions.filter(s => s.day >= holdFrom);
    const main = trackRecord(mainSessions.length ? mainSessions : sessions, cfg);
    const before = read(t);
    let holdout: Scorecard['holdout'] = null;
    let holdoutNote = 'No hold-out yet: fewer sessions than the hold-out window.';
    if (mainSessions.length && holdSessions.length) {
      if (before?.holdout && before.holdout.configVersion === cfg.version) {
        holdout = before.holdout;
        holdoutNote = `The hold-out (${dayLabel(holdout.from)} to ${dayLabel(holdout.to)}) was evaluated once, on ${dayLabel(new Date(holdout.evaluatedAt).toISOString().slice(0, 10))}, under ${holdout.configVersion}; kept unchanged.`;
      } else {
        holdout = { from: holdSessions[0].day, to: holdSessions[holdSessions.length - 1].day, evaluatedAt: clock(), configVersion: cfg.version, record: trackRecord(holdSessions, cfg) };
        holdoutNote = before?.holdout
          ? `The parameters changed (${before.holdout.configVersion} to ${cfg.version}), so the hold-out was evaluated again — a second look, said as one.`
          : `The hold-out (${dayLabel(holdout.from)} to ${dayLabel(holdout.to)}) evaluated once, now, under ${cfg.version}.`;
      }
    }
    const lines = {} as Record<LevelKind, string>;
    for (const kind of LEVEL_KINDS) {
      const cell = main.cells.find(c => c.kind === kind && c.split === 'all' && c.horizon === cfg.horizons[0] && c.tol === cfg.tol.default);
      const held = holdout?.record.cells.find(c => c.kind === kind && c.split === 'all' && c.horizon === cfg.horizons[0] && c.tol === cfg.tol.default);
      lines[kind] = cell ? `${recordLine(cell)} · held-out: ${held ? (held.insufficient ? `insufficient (${held.insufficient.touches} touches)` : `${(held.real.rate * 100).toFixed(0)}% vs ${(held.B2.rate * 100).toFixed(0)}%`) : 'none yet'} · ${main.variantsTried} variants tried` : `${kind}: no record`;
    }
    const card: Scorecard = { name: t, builtAt: clock(), configVersion: cfg.version, main, holdout, holdoutNote, lines, sources: { final: finals, rebuilt, skipped } };
    mkdirSync(join(root, t), { recursive: true });
    writeFileSync(fileOf(t), JSON.stringify(card));
    /* THE REGIME'S REFERENCE (item 3): the nets by half-hour over the trailing sessions, the newest left out of
       `before` so a page read on that day stands on sessions before it alone */
    writeFileSync(join(root, t, REGIME), JSON.stringify(buildRegimeReference(t, sessions, REGIME_TRAILING, nyMinuteOf)));
    /* THE PRICED MOVE'S CALIBRATION (item 4): every session with a budget and bars */
    if (opts.move) {
      try {
        const c = await opts.move.calibration(t, at10);
        opts.log?.(`move calibration ${t}: ${c.sessions} sessions${c.provisional ? ' (provisional)' : ''}`);
      } catch (e) {
        opts.log?.(`move calibration ${t} failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    /* THE BEAD SCALE'S REFERENCES (item 5): the fixed and prior p85 a day, off the sessions' per-minute peaks */
    if (opts.scale) {
      try {
        await opts.scale.build(t);
      } catch (e) {
        opts.log?.(`scale ${t} failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    opts.log?.(`scorecard ${t}: ${sessions.length} sessions (${finals} from the store, ${rebuilt} rebuilt, ${skipped} without rows), ${main.touches} touches, ${main.variantsTried} variants; ${holdoutNote}`);
    return card;
  }

  /** GET /feed/field/<NAME>/regime: the percentile reference, or 404 */
  function serveRegime(rawName: string): { status: number; body: string } {
    const name = rawName.toUpperCase();
    if (!/^[A-Z][A-Z0-9.]{0,9}$/.test(name)) return { status: 400, body: JSON.stringify({ error: 'bad-name' }) };
    try {
      const ref = JSON.parse(readFileSync(join(root, name, REGIME), 'utf8')) as RegimeReference;
      return { status: 200, body: JSON.stringify(ref) };
    } catch {
      return { status: 404, body: JSON.stringify({ error: 'no-reference' }) };
    }
  }

  /** GET /feed/field/<NAME>/scorecard */
  function serve(rawName: string): { status: number; body: string } {
    const name = rawName.toUpperCase();
    if (!/^[A-Z][A-Z0-9.]{0,9}$/.test(name)) return { status: 400, body: JSON.stringify({ error: 'bad-name' }) };
    const card = read(name);
    return card ? { status: 200, body: JSON.stringify(card) } : { status: 404, body: JSON.stringify({ error: 'no-scorecard' }) };
  }

  return { run, serve, serveRegime, read };
}
export type ScorecardJob = ReturnType<typeof createScorecard>;
