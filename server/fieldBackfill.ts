/*
==================================================
  SLAYER TERMINAL - THE FIELD'S PAST SESSIONS (server/fieldBackfill.ts)
  THE SESSIONS BEFORE TODAY, REBUILT FROM UW'S DATED
  HISTORY ON THE SAME MODEL (2026-10-13 — the owner:
  "but why cant we see the exposure nodes on yesterdays
  data or the day befores that, how far of data do we
  even have? we need to plug it in").

  UW never answers the book by strike for an earlier
  minute, but it answers, for a past date, every input
  the field's model takes — so a past session is
  modeled exactly as today is (data/feed/trailField.ts),
  each minute from what was knowable at it:
    · THE POSITIONS: the open interest dated the session
      (/option-chains?date=D — a count dated D is the
      session before's close, the positions at D's open),
      the name's contracts within 60 days and 15% of the
      open.
    · THE VOL AT THE OPEN: the session before's close
      (/option-chains?date=<the session before>) —
      carried, as today's seed is.
    · THE VOL THROUGH THE SESSION: every contract that
      traded, minute by minute (/option-contract/{id}/
      intraday?date=D — UW's per-minute range of its own
      print vols, iv_low and iv_high; the middle is the
      minute's vol, knowable at the minute's end). A
      minute is kept when its vol moved a tenth of a vol
      point from the last kept — the rest say nothing new.
      Asked for the contracts that traded within 35
      strikes of the session's range (the field draws 30
      each side of the price).
    · THE VALIDATION SERIES: UW's whole book a minute for
      D (/spot-exposures?date=D), as today's.
  The price path is the chart's own minute bars (the
  client's), so the field sits on the candles it draws.

  HOW FAR BACK, measured 2026-10-13 on the Basic plan:
  the per-contract minutes from about 2025-04-01 (a
  date before answers none — such a session is modeled
  on the session before's close vols alone, every cell
  'carried'); the dated chains, the minute bars and the
  whole-book series about two years (UW's window; past
  it, "historic_data_access_missing").

  ONE SESSION A NAME AT A TIME, two calls in flight (the
  gate holds UW at three, so the pages keep one), the
  name asked most lately first, its newest session first.
  A session takes about 1,500 calls for SPY — a few
  minutes — and is kept for good in .feed-cache/field/
  <NAME>/<D>/past.json.gz (git-ignored, never deleted),
  so it is asked once. A session with too many calls
  refused is not written; it is tried again later.
==================================================
*/

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { join } from 'node:path';
import type { FeedClient } from './feed';

const ROOT = join(process.cwd(), '.feed-cache', 'field');
const FILE = 'past.json.gz';
/** The file's own format — a change of what is stored is a new number */
export const PAST_FORMAT = 1;
const MAX_DTE = 60;
const BAND = 0.15;
const MAX_PAGES = 40;
/** Strikes asked each side of the session's range: the field's 30 and a margin */
const STRIKES_EACH_SIDE = 35;
/** A minute's vol is kept when it moved this much (a tenth of a vol point) from the last kept */
const VOL_STEP = 0.001;
const IN_FLIGHT = 2;
/** More of a session's calls refused than this and it is not written */
const MAX_REFUSED = 0.02;
/** A session nobody asked for in this long is dropped from the queue */
const STALE_ASK_MS = 5 * 60_000;
const RETRY_MS = 30 * 60_000;
/** Sessions kept a name asked in one breath — the chart's minutes reach about five weeks */
const MAX_ASK = 30;

type Row = Record<string, unknown>;

/** A past session's inputs, as stored and served */
export interface PastDay {
  format: number;
  name: string;
  day: string;
  builtAt: number;
  /** [OCC symbol, open interest dated the session] */
  oi: [string, number][];
  /** The session before's close: [OCC symbol, vol or null, its stamp (ms) or null] */
  seed: { date: string; receivedAt: number; rows: [string, number | null, number | null][] } | null;
  /** Each traded contract's vols through the session, flattened [minute start (ms), vol, …] */
  ticks: Record<string, number[]>;
  /** UW's whole book a minute: [minute start (ms), price, gamma per 1% by open interest (UW's sign)] */
  total: { receivedAt: number; rows: [number, number | null, number][] } | null;
  /** What it cost and covered */
  calls: number;
  asked: number;
  refused: number;
}

export interface PastState {
  ready: string[];
  working: string | null;
  queued: string[];
  /** A session that could not be built, and why */
  failed: Record<string, string>;
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const isoAdd = (iso: string, days: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};
const weekdayOf = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const NAME_OK = /^[A-Z][A-Z0-9.]{0,9}$/;
const nyMinute = (ms: number) => {
  const p: Record<string, string> = {};
  for (const x of new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', hour: 'numeric', minute: 'numeric', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(ms)))
    if (x.type !== 'literal') p[x.type] = x.value;
  return { day: `${p.year}-${p.month}-${p.day}`, minute: (Number(p.hour) % 24) * 60 + Number(p.minute) };
};
const occ = /^(.*?)(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/;
const strikeOf = (s: string) => {
  const m = occ.exec(s);
  return m ? Number(m[6]) / 1000 : NaN;
};

export function createFieldBackfill(client: FeedClient, opts: { now?: () => number; root?: string } = {}) {
  const clock = opts.now ?? Date.now;
  const root = opts.root ?? ROOT;
  const fileOf = (name: string, day: string) => join(root, name, day, FILE);
  /** Asked (name|day → when) */
  const asks = new Map<string, number>();
  const failed = new Map<string, { why: string; at: number }>();
  let working: string | null = null;
  let running = false;

  const has = (name: string, day: string) => existsSync(fileOf(name, day));

  const getRows = async (path: string): Promise<{ ok: boolean; rows: Row[]; status: number; body: string }> => {
    const a = await client.get('uw', path);
    if (a.status !== 200) return { ok: false, rows: [], status: a.status, body: a.body };
    try {
      return { ok: true, rows: (JSON.parse(a.body) as { data?: Row[] }).data ?? [], status: 200, body: '' };
    } catch {
      return { ok: false, rows: [], status: 502, body: '' };
    }
  };

  /** Every row of a dated chain from `first` to `last` expiry, page by page (rows come by expiry, then strike) */
  async function chainOn(name: string, date: string, last: string): Promise<{ rows: Row[]; calls: number } | null> {
    const out: Row[] = [];
    let calls = 0;
    for (let page = 0; page < MAX_PAGES; page++) {
      const r = await getRows(`/api/stock/${name}/option-chains?date=${date}&greeks=true&limit=500&page=${page}`);
      calls++;
      if (!r.ok) return null;
      let past = false;
      for (const x of r.rows) {
        if (String(x.expires ?? '') > last) past = true;
        else out.push(x);
      }
      if (past || r.rows.length < 500) break;
    }
    return { rows: out, calls };
  }

  async function build(name: string, day: string): Promise<PastDay> {
    let calls = 0;
    /* the session's own minutes: its range, and whether it was a session at all */
    const bars = await getRows(`/api/stock/${name}/ohlc/1m?date=${day}&limit=2500`);
    calls++;
    if (!bars.ok) throw new Error(bars.body.includes('historic_data_access_missing') ? 'before the plan’s window' : `bars refused (${bars.status})`);
    const regular = bars.rows.filter(r => r.market_time === 'r');
    if (!regular.length) throw new Error('no session that day');
    const open = num(regular.reduce((a, r) => (String(r.start_time) < String(a.start_time) ? r : a)).open) ?? NaN;
    let lo = Infinity;
    let hi = -Infinity;
    for (const r of regular) {
      lo = Math.min(lo, num(r.low) ?? Infinity);
      hi = Math.max(hi, num(r.high) ?? -Infinity);
    }
    if (!Number.isFinite(open) || !Number.isFinite(lo)) throw new Error('no prices that day');

    /* the positions at the open: open interest dated the session */
    const last = isoAdd(day, MAX_DTE);
    const chain = await chainOn(name, day, last);
    if (!chain) throw new Error('the dated chain was refused');
    calls += chain.calls;
    const kept = chain.rows.filter(r => {
      const exp = String(r.expires ?? '');
      const k = num(r.strike) ?? NaN;
      return exp >= day && Math.abs(k - open) <= open * BAND && (num(r.open_interest) ?? 0) > 0;
    });
    if (!kept.length) throw new Error('no open interest dated that day');
    const oi: [string, number][] = kept.map(r => [String(r.option_symbol), num(r.open_interest) ?? 0]);

    /* the session before's close: the vols knowable at the open */
    let seed: PastDay['seed'] = null;
    const inUniverse = new Set(oi.map(o => o[0]));
    let prev = isoAdd(day, -1);
    for (let tries = 0; tries < 5 && !seed; tries++) {
      while (weekdayOf(prev) === 0 || weekdayOf(prev) === 6) prev = isoAdd(prev, -1);
      const c = await chainOn(name, prev, last);
      if (!c) break;
      calls += c.calls;
      if (c.rows.length) {
        const rows: [string, number | null, number | null][] = [];
        for (const r of c.rows) {
          const s = String(r.option_symbol ?? '');
          if (!inUniverse.has(s)) continue;
          const tape = Date.parse(String(r.last_tape_time ?? ''));
          rows.push([s, num(r.implied_volatility), Number.isFinite(tape) ? tape : null]);
        }
        seed = { date: prev, receivedAt: clock(), rows };
      } else prev = isoAdd(prev, -1);
    }

    /* the validation series */
    const tot = await getRows(`/api/stock/${name}/spot-exposures?date=${day}`);
    calls++;
    const total: PastDay['total'] = tot.ok
      ? {
          receivedAt: clock(),
          rows: tot.rows.map(r => [Date.parse(String(r.start_time)), num(r.price), num(r.gamma_per_one_percent_move_oi) ?? 0] as [number, number | null, number]).filter(r => Number.isFinite(r[0])),
        }
      : null;

    /* the vols through the session: the contracts that traded within the strikes the field can draw */
    const strikes = [...new Set(kept.map(r => num(r.strike) ?? NaN))].filter(Number.isFinite).sort((a, b) => a - b);
    const idx = (p: number) => {
      let i = 0;
      while (i < strikes.length && strikes[i] < p) i++;
      return i;
    };
    const kLo = strikes[Math.max(0, idx(lo) - STRIKES_EACH_SIDE)];
    const kHi = strikes[Math.min(strikes.length - 1, idx(hi) + STRIKES_EACH_SIDE)];
    const ask = kept.filter(r => (num(r.volume) ?? 0) > 0 && (num(r.strike) ?? NaN) >= kLo && (num(r.strike) ?? NaN) <= kHi).map(r => String(r.option_symbol));
    const ticks: Record<string, number[]> = {};
    let refused = 0;
    let next = 0;
    const worker = async () => {
      while (next < ask.length) {
        const sym = ask[next++];
        const r = await getRows(`/api/option-contract/${sym}/intraday?date=${day}`);
        calls++;
        if (!r.ok) {
          refused++;
          continue;
        }
        const out: number[] = [];
        let lastIv = NaN;
        for (const x of [...r.rows].sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)))) {
          const t = Date.parse(String(x.start_time));
          const a = num(x.iv_low);
          const b = num(x.iv_high);
          if (!Number.isFinite(t) || a == null || b == null || !(a > 0) || !(b > 0)) continue;
          const at = nyMinute(t);
          /* the regular session's prints: 09:30 to the 16:15 close of index and fund options */
          if (at.day !== day || at.minute < 9 * 60 + 30 || at.minute > 16 * 60 + 15) continue;
          const iv = (a + b) / 2;
          if (Number.isFinite(lastIv) && Math.abs(iv - lastIv) < VOL_STEP) continue;
          lastIv = iv;
          out.push(t, Math.round(iv * 1e5) / 1e5);
        }
        if (out.length) ticks[sym] = out;
      }
    };
    await Promise.all(Array.from({ length: IN_FLIGHT }, worker));
    if (ask.length && refused / ask.length > MAX_REFUSED) throw new Error(`${refused} of ${ask.length} contracts refused — tried again later`);

    return { format: PAST_FORMAT, name, day, builtAt: clock(), oi, seed, ticks, total, calls, asked: ask.length, refused };
  }

  function save(p: PastDay) {
    const file = fileOf(p.name, p.day);
    mkdirSync(join(root, p.name, p.day), { recursive: true });
    const tmp = `${file}.tmp`;
    writeFileSync(tmp, gzipSync(Buffer.from(JSON.stringify(p))));
    renameSync(tmp, file);
  }

  /** The next session to build: the name asked most lately, its newest session first */
  function pick(): [string, string] | null {
    const now = clock();
    let best: [string, string] | null = null;
    let bestAt = -1;
    for (const [key, at] of asks) {
      const [name, day] = key.split('|');
      if (now - at > STALE_ASK_MS || has(name, day)) {
        asks.delete(key);
        continue;
      }
      const f = failed.get(key);
      if (f && now - f.at < RETRY_MS) continue;
      /* a name's newest ask wins; among its sessions, the newest day */
      const score = Math.floor(at / 1000) * 1e9 + Number(day.replace(/-/g, ''));
      if (score > bestAt) {
        bestAt = score;
        best = [name, day];
      }
    }
    return best;
  }

  async function run() {
    if (running) return;
    running = true;
    try {
      for (let p = pick(); p; p = pick()) {
        const [name, day] = p;
        const key = `${name}|${day}`;
        working = key;
        try {
          save(await build(name, day));
          failed.delete(key);
        } catch (e) {
          failed.set(key, { why: e instanceof Error ? e.message : 'refused', at: clock() });
        }
        asks.delete(key);
        working = null;
      }
    } finally {
      running = false;
      working = null;
    }
  }

  /** GET /feed/field/<NAME>/past?days=a,b,…: ask for these sessions; which are ready, which is being built */
  function ask(rawName: string, rawDays: string): { status: number; body: string } {
    const name = rawName.toUpperCase();
    if (!NAME_OK.test(name)) return { status: 400, body: JSON.stringify({ error: 'bad-name' }) };
    if (!client.hasKey('uw')) return { status: 503, body: JSON.stringify({ error: 'no-key' }) };
    const today = nyMinute(clock()).day;
    const days = [...new Set(rawDays.split(',').filter(d => ISO.test(d) && d < today && weekdayOf(d) !== 0 && weekdayOf(d) !== 6))]
      .sort()
      .reverse()
      .slice(0, MAX_ASK);
    const now = clock();
    const state: PastState = { ready: [], working: null, queued: [], failed: {} };
    for (const d of days) {
      const key = `${name}|${d}`;
      if (has(name, d)) {
        state.ready.push(d);
        continue;
      }
      asks.set(key, now);
      const f = failed.get(key);
      if (working === key) state.working = d;
      else if (f) state.failed[d] = f.why;
      else state.queued.push(d);
    }
    void run();
    return { status: 200, body: JSON.stringify(state) };
  }

  /** GET /feed/field/<NAME>/day/<D>: a built session's inputs, or 404 */
  function day(rawName: string, d: string): { status: number; body: string } {
    const name = rawName.toUpperCase();
    if (!NAME_OK.test(name) || !ISO.test(d)) return { status: 400, body: JSON.stringify({ error: 'bad-request' }) };
    try {
      return { status: 200, body: gunzipSync(readFileSync(fileOf(name, d))).toString('utf8') };
    } catch {
      return { status: 404, body: JSON.stringify({ error: 'not-built' }) };
    }
  }

  return { ask, day, build, idle: () => !running };
}
