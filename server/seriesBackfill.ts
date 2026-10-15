/*
==================================================
  SLAYER TERMINAL - UW'S PER-MINUTE SPOT EXPOSURES, BACK TO THE FIRST DAY UW ALLOWS
  (server/seriesBackfill.ts)

  2026-10-14 — the owner (B5): "Start pulling UW
  per-minute spot exposures (_oi, _vol, _dir) for SPY,
  QQQ, SPX now. Its ~730-day window loses a day each
  session."
  2026-10-15 — the owner: "Make the recorder fill every
  missing day … back to the earliest date UW allows
  (its 403 names it), not only record live … Cover
  every ticker the recorder records, all fields. Skip
  any ticker UW refuses, and say which. Back off on
  429; the live pull keeps priority."

  GET /api/stock/{T}/spot-exposures?date=D answers a
  name's whole-book gamma per 1% a minute for a
  session — by open interest, by volume and
  directionalized (UW's _oi, _vol, _dir), its price,
  and the other greeks' series.

  THE WINDOW IS UW'S OWN WORD, NOT A COUNT OF OURS. The
  job used to walk back 730 CALENDAR days; UW's window
  is 730 TRADING days (its 403, 2026-10-15: "The
  earliest date currently available to this token is
  2023-11-15 (730 trading days)") — about ten months
  further back, which the old walk never asked. Each
  run asks a date far before any window once and reads
  the earliest date from the refusal. Where the answer
  names none (a 5xx, the network), the last date UW
  named is carried forward a trading day a session;
  with none ever named, 730 trading days back on the
  house's calendar, said as an estimate.

  OLDEST FIRST, EVERY NAME A DAY. The day at the
  window's floor is the one that drops out next, so the
  walk goes from the floor forward — every name for a
  date before the next date — to the session just over
  (today's from 5:00 pm New York on a trading day, UW's
  rows for the date standing whole by then). Only
  trading days are asked.

  THE NAMES: every one the recorder records — the
  configured ones (RECORD_NAMES), the series' extras
  (SERIES_NAMES), the names a tab is watching and every
  name with the recorder's files on disk.

  A NAME UW DOES NOT SERVE IS NAMED. UW answers an
  unknown ticker 200 with no rows (checked 2026-10-15:
  ZZZZQ), never a 4xx — so before a name is walked its
  last whole session is asked: no rows there while SPY
  has rows that day, or a 4xx, and the name is skipped
  for the run and said — in the log, in the state file
  and in `npm run uw:series -- --status`.

  A DAY IS HELD by this job's own file and nothing else
  (series.json.gz; series.json as the job first wrote
  it), read whole — one cut short is asked again. The
  recorder's total.json and a rebuilt day's past.json.gz
  keep only the figures the trail reads, so they never
  stand in. A day UW answers with no rows is written
  `empty`; one before the name's first day with rows is
  UW's series not yet begun and is never asked again;
  one after it is a GAP, asked again on later runs,
  three times in all. Rows are kept AS ANSWERED.

  THE LIVE PULL KEEPS PRIORITY. Unusual Whales answers
  three calls at once for the token, whichever process
  asks, and the dev server has its own client — so the
  bulk fill never runs in the live hours (4:00 am to
  5:00 pm New York on a trading day: the chain reads
  from 4:00 am, the session's books, the closing reads),
  stopping where it stands if it reaches them; outside
  them it makes one call at a time, only while this
  process's UW gate has two slots free and nothing
  queued and no call of the process has met a 429 in
  the last minute; its own calls skip the client's
  cache and its quick retry, and a 429 backs off 30 s,
  doubling to 15 minutes. One fill on a machine at a
  time (.feed-cache/series/series.lock). Runs on the
  always-on recorder (server/recorderMain.ts: at start
  — deferred to the evening if it starts in the live
  hours — and each evening after the close) and from
  `npm run uw:series -- --fill`; nothing of it in the
  browser.
==================================================
*/
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, readSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import type { FeedClient } from './feed';
import { nyIsoDate, nyMinutes, nyParts } from '../src/core/nyTime';
import { isTradingIso } from '../src/core/sessions';

/** Where the days live — beside the recorder's own files, where the Theta rebuild reads them */
const ROOT = join(process.cwd(), '.feed-cache', 'field');
/** The job's own state and lock — a folder of their own (a file in the field's root once ended the recorder's prune) */
const STATE_ROOT = join(process.cwd(), '.feed-cache', 'series');
/** The first files the job wrote, plain — still read */
export const SERIES_FILE = 'series.json';
/** What the job writes now: the same object, gzipped (28–45 KB a session where the plain file was ~300 KB) */
export const SERIES_GZ = 'series.json.gz';
export const SERIES_FORMAT = 2;
export const STATE_FILE = 'series-state.json';
export const LOCK_FILE = 'series.lock';
/** UW's window, in its own unit — the estimate where its refusal never named a date */
export const UW_WINDOW_TRADING_DAYS = 730;
/** A date before any window: its refusal names the earliest date the token may ask */
export const PROBE_DATE = '2000-01-03';
/** The name the window is read with, and a name's rows are judged against — one UW serves on every plan */
export const PROBE_NAME = 'SPY';
/** A gap (no rows on a trading day after the name's first day with rows) is asked this many times in all */
export const GAP_TRIES = 3;
/** The 429 back-off: from 30 s, doubling, to 15 minutes */
export const BACKOFF_FROM_MS = 30_000;
export const BACKOFF_MAX_MS = 15 * 60_000;
/** A 429 met by any call of the process this recently keeps the fill waiting */
export const RECENT_429_MS = 60_000;
/** A lock not refreshed in this long is a fill that died (a running fill refreshes it every minute) */
export const LOCK_STALE_MS = 5 * 60_000;
/** The live hours, New York, on a trading day — the bulk fill never runs in them */
export const LIVE_FROM_MIN = 4 * 60;
export const LIVE_TO_MIN = 17 * 60;
/** A gzipped day this large holds rows (an empty day's file is a few hundred bytes) */
const ROWS_GZ_BYTES = 2048;

export interface SeriesFile {
  format: number;
  name: string;
  date: string;
  receivedAt: number;
  url: string;
  /** UW's rows as answered — every field */
  rows: Record<string, unknown>[];
  /** UW answered no rows for the date */
  empty?: boolean;
  /** how many times an empty day has been asked */
  tries?: number;
}

export interface SeriesWindow {
  /** the earliest date the token may ask */
  floor: string;
  /** 'uw' — read off UW's refusal; 'carried' — the last date UW named, moved on a trading day a session since it was
      read (the probe got no answer); 'estimate' — 730 trading days on the house's calendar, UW never having named one */
  source: 'uw' | 'carried' | 'estimate';
  /** when UW named it (for 'uw' and 'carried'), else when the estimate was made */
  at: number;
}

export interface SeriesRefusal {
  status: number;
  code: string | null;
  message: string;
  at: number;
}

export interface SeriesState {
  window: SeriesWindow | null;
  /** names UW refused on the last run that asked them */
  refused: Record<string, SeriesRefusal>;
  lastRun: { startedAt: number; finishedAt: number | null; written: number; empty: number; gaps: number; refused: number; failed: number; why: string; stopped: string | null } | null;
}

export interface SeriesStatus {
  running: boolean;
  names: string[];
  window: SeriesWindow | null;
  /** the name and day in hand */
  current: string | null;
  /** calls this run still has to make */
  todo: number;
  written: number;
  empty: number;
  skipped: number;
  /** a call that did not come back with an answer (a 5xx, the network) — asked again next run */
  refused: number;
  /** a day UW refused with a 4xx — kept here with its status */
  failed: Record<string, number>;
  /** names UW does not serve this run, with what it said */
  refusedNames: Record<string, SeriesRefusal>;
  /** 429s met this run, and the back-off now */
  throttled: number;
  backoffMs: number;
  /** the oldest date each name answered rows for in this run */
  oldest: Record<string, string>;
  why: string;
  /** why a run ended before its list did (the live hours, the network, a trial's limit), or did not start */
  stopped: string | null;
  startedAt: number;
  finishedAt: number | null;
}

/* ---- dates ------------------------------------------------------------------------------------------------------ */

const shift = (iso: string, days: number): string => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12) + days * 86_400_000).toISOString().slice(0, 10);
};

/** The session before a New York date: the weekday before (kept for callers that walk weekdays) */
export function weekdayBefore(iso: string): string {
  for (let k = 1; k <= 7; k++) {
    const x = shift(iso, -k);
    const wd = new Date(`${x}T12:00:00Z`).getUTCDay();
    if (wd !== 0 && wd !== 6) return x;
  }
  return iso;
}

/** The trading day before a date (a weekend and a market holiday passed over) */
export function tradingDayBefore(iso: string): string {
  let x = iso;
  for (let k = 0; k < 15; k++) {
    x = shift(x, -1);
    if (isTradingIso(x)) return x;
  }
  return x;
}

/** The trading day after a date */
export function tradingDayAfter(iso: string): string {
  let x = iso;
  for (let k = 0; k < 15; k++) {
    x = shift(x, 1);
    if (isTradingIso(x)) return x;
  }
  return x;
}

/** Where a walk ends: today's session once its rows stand whole (5:00 pm New York on a trading day), else the one before */
export const SERIES_TODAY_FROM_MIN = 17 * 60;
export function firstDayOf(at: number): string {
  const today = nyIsoDate(at);
  const wd = nyParts(at).weekday;
  if (wd !== 0 && wd !== 6 && isTradingIso(today) && nyMinutes(at) >= SERIES_TODAY_FROM_MIN) return today;
  return tradingDayBefore(today);
}

/** Every trading day from `from` to `to`, both ends kept */
export function tradingDays(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = shift(d, 1)) if (isTradingIso(d)) out.push(d);
  return out;
}

/** The live hours: 4:00 am to 5:00 pm New York on a trading day */
export function inLiveHours(at: number): boolean {
  const m = nyMinutes(at);
  return isTradingIso(nyIsoDate(at)) && m >= LIVE_FROM_MIN && m < LIVE_TO_MIN;
}

/** The estimate where UW never named a date: 730 trading days before today's New York date (UW's own word on
    2026-10-15 at 6:30 pm New York was 2023-11-15 — the 730th trading day before Oct 15 on the house's calendar) */
export function estimatedFloor(at: number): string {
  let d = nyIsoDate(at);
  for (let k = 0; k < UW_WINDOW_TRADING_DAYS; k++) d = tradingDayBefore(d);
  return d;
}

/** The last date UW named, moved on a trading day for every session since the day it was named */
export function carriedFloor(w: SeriesWindow, at: number): string {
  const named = nyIsoDate(w.at);
  const today = nyIsoDate(at);
  let floor = w.floor;
  if (today <= named) return floor;
  for (const _d of tradingDays(shift(named, 1), today)) floor = tradingDayAfter(floor);
  return floor;
}

/** The earliest date a refusal names ("The earliest date currently available to this token is 2023-11-15 …") */
export function floorFromRefusal(body: string): string | null {
  let text = body;
  try {
    const j = JSON.parse(body) as { message?: unknown };
    if (typeof j.message === 'string') text = j.message;
  } catch {
    /* a body that is not JSON is read as it is */
  }
  return /earliest date[^0-9]*(\d{4}-\d{2}-\d{2})/i.exec(text)?.[1] ?? null;
}

const codeOf = (body: string): string | null => {
  try {
    const j = JSON.parse(body) as { code?: unknown; error?: unknown };
    return typeof j.code === 'string' ? j.code : typeof j.error === 'string' ? j.error : null;
  } catch {
    return null;
  }
};
const messageOf = (body: string): string => {
  try {
    const j = JSON.parse(body) as { message?: unknown; error?: unknown; detail?: unknown };
    const m = j.message ?? j.detail ?? j.error;
    if (typeof m === 'string') return m.split('\n')[0].slice(0, 240);
  } catch {
    /* fall through */
  }
  return body.slice(0, 240);
};
/** UW's refusal for a date outside the token's window — a fact about the date, never about the name */
export const isWindowRefusal = (status: number, body: string): boolean => status === 403 && (codeOf(body) === 'historic_data_access_missing' || floorFromRefusal(body) != null);

/* ---- the files -------------------------------------------------------------------------------------------------- */

/** The day's file, gzipped or as first written — null where the job holds none */
export function seriesPathOf(root: string, name: string, day: string): string | null {
  const gz = join(root, name, day, SERIES_GZ);
  if (existsSync(gz)) return gz;
  const plain = join(root, name, day, SERIES_FILE);
  return existsSync(plain) ? plain : null;
}

export function readSeriesFile(path: string): SeriesFile | null {
  try {
    const raw = readFileSync(path);
    return JSON.parse((path.endsWith('.gz') ? gunzipSync(raw) : raw).toString('utf8')) as SeriesFile;
  } catch {
    return null;
  }
}

/** UW's rows for a day where the job kept them (the Theta rebuild's residual reads them) */
export function readSeries(root: string, name: string, day: string): SeriesFile | null {
  const p = seriesPathOf(root, name, day);
  return p ? readSeriesFile(p) : null;
}

/** A plain file's first and last bytes — nothing parsed (the first files are ~300 KB) */
function plainEnds(path: string): { head: string; tail: string } {
  const size = statSync(path).size;
  const n = Math.min(size, 32);
  const head = Buffer.alloc(n);
  const tail = Buffer.alloc(n);
  const fd = openSync(path, 'r');
  try {
    readSync(fd, head, 0, n, 0);
    readSync(fd, tail, 0, n, size - n);
  } finally {
    closeSync(fd);
  }
  return { head: head.toString('utf8'), tail: tail.toString('utf8') };
}

/** What a held day is: rows, empty (with how many times it was asked), or broken — a file cut short or unreadable,
    which counts as not held and is asked again */
export function heldKind(path: string): { empty: boolean; tries: number; broken: boolean } {
  try {
    if (!path.endsWith('.gz')) {
      const { head, tail } = plainEnds(path);
      /* the writer's own shape: an object from its first byte to its last, and an empty day ends with this */
      if (!head.startsWith('{') || !tail.endsWith('}')) return { empty: true, tries: 0, broken: true };
      return { empty: tail.endsWith('"rows":[],"empty":true}'), tries: 1, broken: false };
    }
    /* a large gzip holds rows: the job writes it whole through a .part and a rename, so it is trusted by its size —
       unzipping every day held (2,900 of them, 123 MB) cost the recorder ~3 s a look (the review, 2026-10-15) */
    if (statSync(path).size > ROWS_GZ_BYTES) return { empty: false, tries: 1, broken: false };
    const f = readSeriesFile(path);
    if (!f || !Array.isArray(f.rows)) return { empty: true, tries: 0, broken: true };
    return { empty: !f.rows.length, tries: f.tries ?? 1, broken: false };
  } catch {
    return { empty: true, tries: 0, broken: true };
  }
}

function writeSeries(root: string, file: SeriesFile): void {
  const dir = join(root, file.name, file.date);
  mkdirSync(dir, { recursive: true });
  const to = join(dir, SERIES_GZ);
  const part = `${to}.part`;
  writeFileSync(part, gzipSync(JSON.stringify(file)));
  renameSync(part, to);
  /* the plain file the job first wrote for the day goes once the gzipped one stands */
  const plain = join(dir, SERIES_FILE);
  if (existsSync(plain)) rmSync(plain, { force: true });
}

export function readState(stateRoot = STATE_ROOT): SeriesState {
  try {
    const s = JSON.parse(readFileSync(join(stateRoot, STATE_FILE), 'utf8')) as SeriesState;
    return { window: s.window ?? null, refused: s.refused ?? {}, lastRun: s.lastRun ?? null };
  } catch {
    return { window: null, refused: {}, lastRun: null };
  }
}

function writeState(stateRoot: string, s: SeriesState): void {
  mkdirSync(stateRoot, { recursive: true });
  const to = join(stateRoot, STATE_FILE);
  writeFileSync(`${to}.part`, JSON.stringify(s, null, 1));
  renameSync(`${to}.part`, to);
}

/** The window as it stands now: UW's word where one was read (carried on for the sessions since), else the estimate */
export function windowNow(state: SeriesState, at: number): SeriesWindow {
  const w = state.window;
  if (w && w.source !== 'estimate') {
    const floor = carriedFloor(w, at);
    return floor === w.floor && w.source === 'uw' ? w : { floor, source: 'carried', at: w.at };
  }
  return { floor: estimatedFloor(at), source: 'estimate', at };
}

/* ---- what is stored -------------------------------------------------------------------------------------------- */

export interface SeriesStored {
  /** sessions held with rows */
  days: number;
  /** trading days UW answered with no rows — before its series began for the name, and gaps after */
  empty: number;
  oldest: string | null;
  newest: string | null;
  /** trading days in the window not stored with rows — every one still to get (the days UW answered empty before its
      series began for the name are left out: there is nothing to get) */
  missing: string[];
  /** of those, the ones between the oldest and the newest day stored — holes inside what is held */
  gaps: string[];
  /** trading days between the window's floor and the name's first day with rows, held empty (UW's series not begun) */
  beforeStart: number;
  /** trading days in the window not yet asked at all (a file cut short counts here) */
  notAsked: number;
}

/** What is held on this machine, a name at a time, against the window and the last session that may be asked */
export function storedOf(names: string[], root = ROOT, window: { floor: string } | null = null, at = Date.now()): Record<string, SeriesStored> {
  const out: Record<string, SeriesStored> = {};
  const last = firstDayOf(at);
  for (const name of names) {
    const s: SeriesStored = { days: 0, empty: 0, oldest: null, newest: null, missing: [], gaps: [], beforeStart: 0, notAsked: 0 };
    const held = new Map<string, boolean>(); // day → has rows
    const dir = join(root, name);
    if (existsSync(dir))
      for (const d of readdirSync(dir).sort()) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
        const p = seriesPathOf(root, name, d);
        if (!p) continue;
        const k = heldKind(p);
        if (k.broken) continue;
        held.set(d, !k.empty);
        if (!k.empty) {
          s.days++;
          s.oldest ??= d;
          s.newest = d;
        } else s.empty++;
      }
    const from = window?.floor ?? s.oldest;
    if (from) {
      for (const d of tradingDays(from, last)) {
        const h = held.get(d);
        if (h === true) continue;
        if (h === undefined) s.notAsked++;
        /* asked, no rows, and no day with rows before it: UW's series had not begun for the name */
        if (h === false && (!s.oldest || d < s.oldest)) {
          s.beforeStart++;
          continue;
        }
        s.missing.push(d);
        if (s.oldest && s.newest && d > s.oldest && d < s.newest) s.gaps.push(d);
      }
    }
    out[name] = s;
  }
  return out;
}

/** Runs of consecutive trading days, for a short print: "2024-03-04 – 2024-03-08 (5)" */
export function rangesOf(days: string[]): { from: string; to: string; n: number }[] {
  const out: { from: string; to: string; n: number }[] = [];
  for (const d of days) {
    const r = out[out.length - 1];
    if (r && tradingDayBefore(d) === r.to) {
      r.to = d;
      r.n++;
    } else out.push({ from: d, to: d, n: 1 });
  }
  return out;
}

/* ---- the names ------------------------------------------------------------------------------------------------- */

const listOf = (v: string | undefined, fallback: string) =>
  (v ?? fallback)
    .split(',')
    .map(s => s.trim().toUpperCase())
    .filter(Boolean);

/** The configured names: the recorder's (RECORD_NAMES) and the series' own extras (SERIES_NAMES, SPY,QQQ,SPX by
    default); SERIES_NAMES=off turns the fill off (an empty list) */
export function seriesNamesOf(env: Record<string, string | undefined>): string[] {
  const extra = listOf(env.SERIES_NAMES, 'SPY,QQQ,SPX');
  if (extra.includes('OFF')) return [];
  return [...new Set([...listOf(env.RECORD_NAMES, 'SPY,QQQ,IWM'), ...extra])];
}

/** The recorder's own files — a name with any of them on a day was recorded */
const RECORDED = /^(books|books60|chain|shown|total)\.json(l)?(\.gz)?$/;
/** Every name the recorder has recorded on this machine, read off its folders */
export function recordedNamesOf(root = ROOT): string[] {
  const out: string[] = [];
  try {
    for (const n of readdirSync(root, { withFileTypes: true })) {
      if (!n.isDirectory() || !/^[A-Z][A-Z0-9.]*$/.test(n.name)) continue;
      let found = false;
      try {
        for (const d of readdirSync(join(root, n.name), { withFileTypes: true })) {
          if (!d.isDirectory() || !/^\d{4}-\d{2}-\d{2}$/.test(d.name)) continue;
          if (readdirSync(join(root, n.name, d.name)).some(f => RECORDED.test(f))) {
            found = true;
            break;
          }
        }
      } catch {
        continue;
      }
      if (found) out.push(n.name);
    }
  } catch {
    /* no folder yet */
  }
  return out.sort();
}

/** Every name the recorder records: the configured ones, the ones a tab is watching, the ones on disk */
export function namesToFill(env: Record<string, string | undefined>, watched: string[] = [], root = ROOT): string[] {
  const configured = seriesNamesOf(env);
  if (!configured.length) return [];
  return [...new Set([...configured, ...watched.map(n => n.toUpperCase()), ...recordedNamesOf(root)])];
}

/* ---- one fill on a machine at a time ---------------------------------------------------------------------------- */

const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as { code?: string }).code === 'EPERM';
  }
};

/** Who holds the lock, where a live fill does */
export function lockHolder(stateRoot: string, now: number): { pid: number; at: number } | null {
  try {
    const l = JSON.parse(readFileSync(join(stateRoot, LOCK_FILE), 'utf8')) as { pid: number; at: number };
    if (l.pid !== process.pid && now - l.at < LOCK_STALE_MS && alive(l.pid)) return l;
  } catch {
    /* none, or one that cannot be read */
  }
  return null;
}

/** Takes the lock, or says who holds it — created exclusively, so two fills starting together cannot both take it */
export function takeLock(stateRoot: string, now: number): { ok: true } | { ok: false; pid: number; at: number } {
  mkdirSync(stateRoot, { recursive: true });
  const p = join(stateRoot, LOCK_FILE);
  const mine = JSON.stringify({ pid: process.pid, at: now });
  for (let k = 0; k < 2; k++) {
    try {
      writeFileSync(p, mine, { flag: 'wx' });
      return { ok: true };
    } catch {
      const h = lockHolder(stateRoot, now);
      if (h) return { ok: false, pid: h.pid, at: h.at };
      /* stale, its process gone, or our own: moved aside — only one taker's rename succeeds — and taken */
      const aside = `${p}.stale-${process.pid}`;
      try {
        renameSync(p, aside);
        rmSync(aside, { force: true });
      } catch {
        /* another taker moved it first: the 'wx' below settles who holds it */
      }
    }
  }
  const h = lockHolder(stateRoot, now);
  return { ok: false, pid: h?.pid ?? -1, at: h?.at ?? now };
}
const touchLock = (stateRoot: string, now: number) => {
  try {
    const p = join(stateRoot, LOCK_FILE);
    writeFileSync(`${p}.part-${process.pid}`, JSON.stringify({ pid: process.pid, at: now }));
    renameSync(`${p}.part-${process.pid}`, p);
  } catch {
    /* the next touch tries again */
  }
};
const dropLock = (stateRoot: string) => {
  try {
    const p = join(stateRoot, LOCK_FILE);
    const l = JSON.parse(readFileSync(p, 'utf8')) as { pid: number };
    if (l.pid === process.pid) rmSync(p, { force: true });
  } catch {
    /* gone already */
  }
};

/* ---- the fill --------------------------------------------------------------------------------------------------- */

export interface SeriesOptions {
  root?: string;
  /** where the state and the lock live */
  stateRoot?: string;
  now?: () => number;
  /** a breath between calls */
  pauseMs?: number;
  log?: (line: string) => void;
  /** stop after this many calls (a trial) */
  maxCalls?: number;
  /** run in the live hours too (by hand, said so) */
  anyHour?: boolean;
}

type Client = Pick<FeedClient, 'get'> & Partial<Pick<FeedClient, 'uwGate' | 'uw429At'>>;

export function createSeriesBackfill(client: FeedClient | Client, opts: SeriesOptions = {}) {
  const root = opts.root ?? ROOT;
  const stateRoot = opts.stateRoot ?? STATE_ROOT;
  const clock = opts.now ?? Date.now;
  const pauseMs = opts.pauseMs ?? 750;
  const log = opts.log ?? (() => undefined);
  const status: SeriesStatus = { running: false, names: [], window: null, current: null, todo: 0, written: 0, empty: 0, skipped: 0, refused: 0, failed: {}, refusedNames: {}, throttled: 0, backoffMs: 0, oldest: {}, why: '', stopped: null, startedAt: 0, finishedAt: null };
  const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
  const c = client as Client;

  /** The live pull first: wait while this process's UW gate has fewer than two slots free or anything queued, or any of
      its calls met a 429 in the last minute */
  async function yieldToLive(): Promise<void> {
    for (;;) {
      const busy = !!c.uwGate && (c.uwGate.waiting > 0 || c.uwGate.active > 1);
      const throttled = !!c.uw429At && clock() - c.uw429At() < RECENT_429_MS;
      if (!busy && !throttled) return;
      await sleep(throttled ? 5_000 : 250);
    }
  }

  /** One call: the answer, after waiting out 429s on the back-off — never from the cache, never the client's quick retry;
      status 0 where the live hours began while it waited (no call made) */
  async function ask(url: string): Promise<{ status: number; body: string }> {
    for (;;) {
      if (status.backoffMs) await sleep(status.backoffMs);
      await yieldToLive();
      if (!opts.anyHour && inLiveHours(clock())) return { status: 0, body: 'live-hours' };
      const a = await c.get('uw', url, { noCache: true, noRetry: true });
      touchLock(stateRoot, clock());
      if (a.status !== 429) {
        status.backoffMs = 0;
        return { status: a.status, body: a.body };
      }
      status.throttled++;
      status.backoffMs = Math.min(BACKOFF_MAX_MS, status.backoffMs ? status.backoffMs * 2 : BACKOFF_FROM_MS);
      log(`series: 429 from Unusual Whales — waiting ${Math.round(status.backoffMs / 1000)} s before ${url.split('?')[0]}`);
    }
  }

  /** The window: UW's own word where its refusal names the earliest date; else the last word carried on; else the estimate */
  async function windowOf(state: SeriesState): Promise<SeriesWindow> {
    const a = await ask(`/api/stock/${PROBE_NAME}/spot-exposures?date=${PROBE_DATE}`);
    const floor = a.status === 403 ? floorFromRefusal(a.body) : null;
    if (floor) return { floor, source: 'uw', at: clock() };
    const w = windowNow(state, clock());
    log(`series: Unusual Whales named no earliest date (${a.status} ${messageOf(a.body).slice(0, 120)}) — the floor is ${w.floor}, ${w.source === 'estimate' ? `an estimate (${UW_WINDOW_TRADING_DAYS} trading days)` : 'its last word carried on a trading day a session'}`);
    return w;
  }

  /** Whether a day is asked: never when held with rows, or empty before the name's first rows, or a gap asked GAP_TRIES times */
  function wants(name: string, day: string, firstRows: string | null): { ask: boolean; tries: number } {
    const p = seriesPathOf(root, name, day);
    if (!p) return { ask: true, tries: 0 };
    const k = heldKind(p);
    if (k.broken) return { ask: true, tries: 0 };
    if (!k.empty) return { ask: false, tries: k.tries };
    if (!firstRows || day < firstRows) return { ask: false, tries: k.tries };
    return { ask: k.tries < GAP_TRIES, tries: k.tries };
  }

  /** A day's answer, written: 'rows' | 'empty' | 'window' (beyond the window) | 'refused' (a 4xx, with its words) |
      'none' (no answer: a 5xx, the network) */
  async function fetchDay(name: string, d: string, tries: number): Promise<{ kind: 'rows' | 'empty' | 'window' | 'refused' | 'none' | 'live'; n: number; status: number; body: string }> {
    const url = `/api/stock/${name}/spot-exposures?date=${d}`;
    const a = await ask(url);
    if (a.status === 0) return { kind: 'live', n: 0, ...a };
    if (a.status === 200) {
      let rows: Record<string, unknown>[];
      try {
        rows = (JSON.parse(a.body) as { data?: Record<string, unknown>[] }).data ?? [];
      } catch {
        return { kind: 'none', n: 0, ...a };
      }
      try {
        writeSeries(root, { format: SERIES_FORMAT, name, date: d, receivedAt: clock(), url, rows, ...(rows.length ? {} : { empty: true, tries: tries + 1 }) });
      } catch (e) {
        log(`series ${name} ${d}: could not be written (${e instanceof Error ? e.message : String(e)})`);
        return { kind: 'none', n: rows.length, ...a };
      }
      return { kind: rows.length ? 'rows' : 'empty', n: rows.length, ...a };
    }
    if (isWindowRefusal(a.status, a.body)) return { kind: 'window', n: 0, ...a };
    if (a.status >= 400 && a.status < 500 && a.status !== 408) return { kind: 'refused', n: 0, ...a };
    return { kind: 'none', n: 0, ...a };
  }

  /** Rows a held day has, or null where it is not held whole */
  const heldRows = (name: string, d: string): number | null => {
    const p = seriesPathOf(root, name, d);
    if (!p) return null;
    const k = heldKind(p);
    return k.broken ? null : k.empty ? 0 : 1;
  };

  /** Every name, every trading day from the window's floor to the last session that may be asked, oldest first */
  async function run(names: string[], why = 'asked'): Promise<SeriesStatus> {
    /* a run that does not start says why, with no start of its own */
    const notStarted = (stopped: string): SeriesStatus => ({ ...status, running: false, why, stopped, startedAt: 0, finishedAt: null });
    if (status.running) return notStarted('a run is going');
    if (!opts.anyHour && inLiveHours(clock())) return notStarted('the live hours (4:00 am to 5:00 pm New York on a trading day)');
    const lock = takeLock(stateRoot, clock());
    if (!lock.ok) {
      log(`series: another fill holds ${LOCK_FILE} (pid ${lock.pid}) — not started`);
      return notStarted(`held by pid ${lock.pid}`);
    }
    Object.assign(status, { running: true, names, window: null, current: null, todo: 0, written: 0, empty: 0, skipped: 0, refused: 0, failed: {}, refusedNames: {}, throttled: 0, backoffMs: 0, oldest: {}, why, stopped: null, startedAt: clock(), finishedAt: null });
    const state = readState(stateRoot);
    const beat = setInterval(() => touchLock(stateRoot, clock()), 60_000);
    (beat as { unref?: () => void }).unref?.();
    let calls = 0;
    let gaps = 0;
    let networkInARow = 0;
    const out = (stopped: string) => {
      status.stopped = stopped;
      log(`series: stopped — ${stopped}`);
    };
    try {
      if (!names.length) return status;
      const window = await windowOf(state);
      calls++;
      status.window = window;
      /* UW's word is kept as read (its date and when); a carried floor is figured afresh from it each time */
      if (window.source === 'uw' || !state.window) state.window = window;
      const last = firstDayOf(clock());
      const days = tradingDays(window.floor, last);

      /* WHICH NAMES UW SERVES: a name holding no rows yet has its last whole session (the day before the walk's last)
         asked — no rows there while SPY has rows that day, or a 4xx, and the name is skipped and said. SPY's own is asked
         (or read) once. */
      const checkDay = tradingDayBefore(last);
      let probeRows: number | null = heldRows(PROBE_NAME, checkDay);
      const serving: string[] = [];
      /* a day asked once this run is not asked again in the walk (a gap on the check day kept its tries) */
      const askedNow = new Set<string>();
      const triesOf = (name: string, d: string) => {
        const p = seriesPathOf(root, name, d);
        const k = p ? heldKind(p) : null;
        return k && !k.broken && k.empty ? k.tries : 0;
      };
      for (const name of names) {
        if (!opts.anyHour && inLiveHours(clock())) {
          out('the live hours began');
          return status;
        }
        /* a name that holds rows already is served — no call; a day without rows in its series is a gap the walk asks */
        if (heldRows(name, checkDay) || storedOf([name], root, null, clock())[name].days > 0) {
          serving.push(name);
          delete state.refused[name];
          continue;
        }
        const r = await fetchDay(name, checkDay, triesOf(name, checkDay));
        calls++;
        askedNow.add(`${name} ${checkDay}`);
        if (r.kind === 'live') {
          out('the live hours began');
          return status;
        }
        if (name === PROBE_NAME && (r.kind === 'rows' || r.kind === 'empty')) probeRows = r.n;
        if (r.kind === 'rows') {
          status.written++;
          serving.push(name);
          delete state.refused[name];
          continue;
        }
        if (r.kind === 'empty' && name !== PROBE_NAME) {
          if (probeRows == null) {
            const p = await fetchDay(PROBE_NAME, checkDay, triesOf(PROBE_NAME, checkDay));
            calls++;
            askedNow.add(`${PROBE_NAME} ${checkDay}`);
            if (p.kind === 'live') {
              out('the live hours began');
              return status;
            }
            probeRows = p.kind === 'rows' || p.kind === 'empty' ? p.n : null;
          }
          if (probeRows) {
            /* no rows where SPY has them: UW does not serve the name to this token (an unknown ticker answers this way) —
               the empty file this job just wrote goes (and the folders, only where nothing else is in them: the
               recorder may keep its own files for the name there) */
            rmSync(join(root, name, checkDay, SERIES_GZ), { force: true });
            for (const dir of [join(root, name, checkDay), join(root, name)])
              try {
                if (!readdirSync(dir).length) rmSync(dir, { recursive: true, force: true });
              } catch {
                /* gone already */
              }
            const ref: SeriesRefusal = { status: 200, code: 'no-rows', message: `no rows on ${checkDay}, where ${PROBE_NAME} has rows`, at: clock() };
            status.refusedNames[name] = ref;
            state.refused[name] = ref;
            log(`series ${name}: Unusual Whales serves no rows for it (${ref.message}) — skipped`);
            continue;
          }
          /* SPY empty too: UW's day is not in yet, nothing said about the name */
          serving.push(name);
          continue;
        }
        if (r.kind === 'refused') {
          const ref: SeriesRefusal = { status: r.status, code: codeOf(r.body), message: messageOf(r.body), at: clock() };
          status.refusedNames[name] = ref;
          state.refused[name] = ref;
          log(`series ${name}: refused by Unusual Whales (${r.status}${ref.code ? ` ${ref.code}` : ''}: ${ref.message}) — skipped`);
          continue;
        }
        /* no answer, or SPY's own day empty: walked, judged again next run */
        serving.push(name);
      }

      /* the first day with rows a name holds — empty days before it are UW's series not yet begun */
      const firstRows = new Map<string, string | null>();
      for (const n of serving) firstRows.set(n, storedOf([n], root, null, clock())[n].oldest);
      const todo: [string, string, number][] = [];
      for (const d of days)
        for (const n of serving) {
          if (askedNow.has(`${n} ${d}`)) continue;
          const w = wants(n, d, firstRows.get(n) ?? null);
          if (w.ask) todo.push([n, d, w.tries]);
          else status.skipped++;
        }
      status.todo = todo.length;
      log(`series ${serving.join(', ')} (${why}): the window from ${window.floor} (${window.source === 'uw' ? "Unusual Whales' word" : window.source === 'carried' ? "Unusual Whales' last word, carried on" : 'an estimate'}) to ${last} — ${days.length} sessions a name, ${todo.length} calls to make, ${status.skipped} held${Object.keys(status.refusedNames).length ? `; not served: ${Object.keys(status.refusedNames).join(', ')}` : ''}`);
      for (const [name, d, tries] of todo) {
        if (opts.maxCalls != null && calls >= opts.maxCalls) {
          out(`the trial's limit, ${calls} calls`);
          break;
        }
        if (!opts.anyHour && inLiveHours(clock())) {
          out('the live hours began — the evening run picks up here');
          break;
        }
        status.current = `${name} ${d}`;
        const r = await fetchDay(name, d, tries);
        if (r.kind === 'live') {
          out('the live hours began — the evening run picks up here');
          break;
        }
        calls++;
        status.todo--;
        if (r.kind === 'rows') {
          networkInARow = 0;
          status.written++;
          status.oldest[name] ??= d;
          if (!firstRows.get(name) || d < (firstRows.get(name) as string)) firstRows.set(name, d);
        } else if (r.kind === 'empty') {
          networkInARow = 0;
          status.empty++;
          if (firstRows.get(name) && d > (firstRows.get(name) as string)) gaps++;
        } else if (r.kind === 'window') {
          /* the window moved past the day while the run went on — nothing to keep, nothing wrong with the name */
          networkInARow = 0;
          status.skipped++;
        } else if (r.kind === 'refused') {
          networkInARow = 0;
          status.failed[`${name} ${d}`] = r.status;
        } else {
          /* a 5xx, a timeout, the network: not written, asked again on the next run */
          status.refused++;
          if (++networkInARow >= 20) {
            out(`20 calls in a row came back without an answer (last ${r.status} ${messageOf(r.body).slice(0, 80)}); the next run picks up here`);
            break;
          }
        }
        if (calls % 100 === 0) log(`series: ${calls} calls, at ${name} ${d} — written ${status.written}, empty ${status.empty}, no answer ${status.refused}, ${status.todo} to go`);
        await sleep(pauseMs);
      }
      for (const n of serving) if (status.oldest[n]) log(`series ${n}: oldest day with rows this run ${status.oldest[n]}`);
    } finally {
      /* a name no longer filled leaves the list of names not served */
      for (const n of Object.keys(state.refused)) if (!names.includes(n)) delete state.refused[n];
      clearInterval(beat);
      status.running = false;
      status.current = null;
      status.finishedAt = clock();
      state.lastRun = { startedAt: status.startedAt, finishedAt: status.finishedAt, written: status.written, empty: status.empty, gaps, refused: status.refused, failed: Object.keys(status.failed).length, why, stopped: status.stopped };
      try {
        writeState(stateRoot, state);
      } catch {
        /* the state is a convenience: the files are the record */
      }
      dropLock(stateRoot);
    }
    return status;
  }

  return {
    run,
    status: () => status,
    held: (name: string, day: string) => heldRows(name, day) != null,
    stored: (names: string[]) => storedOf(names, root, windowNow(readState(stateRoot), clock()), clock()),
    state: () => readState(stateRoot),
    lockHolder: () => lockHolder(stateRoot, clock()),
  };
}
