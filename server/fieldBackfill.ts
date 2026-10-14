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

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { join } from 'node:path';
import type { FeedClient } from './feed';
import { INDEX_ROOTS, type TapeDay, type TapePriceBar, type TapeReader, type TapeRow } from './tapeBackfill';

/** A cash index (no bars on the plan): its days are built from the tape, its minutes the prints' underlying price */
const INDICES = new Set(['SPX', 'NDX', 'RUT', 'VIX', ...Object.keys(INDEX_ROOTS)]);
export const isIndexName = (name: string) => INDICES.has(name.toUpperCase());
/** The tape's per-minute underlying price as minute bars — the regular session alone */
export function barsFromTape(prices: readonly TapePriceBar[]): MinuteBar[] {
  return prices
    .map(b => ({ time: b[0] / 1000, open: b[1], high: b[2], low: b[3], close: b[4], session: 'r' as const }))
    .filter(b => {
      const at = nyMinute(b.time * 1000);
      return at.minute >= 9 * 60 + 30 && at.minute < 16 * 60;
    });
}

const ROOT = join(process.cwd(), '.feed-cache', 'field');
const FILE = 'past.json.gz';
const META = 'past.meta.json';
/** The session's minute bars as read when it was built (the scorecard's touches stand on their highs and lows) */
const BARS = 'bars.json.gz';
/** The file's own format — a change of what is stored is a new number */
export const PAST_FORMAT = 2;
const MAX_DTE = 60;
const BAND = 0.15;
const MAX_PAGES = 80;
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
  seed: { date: string; receivedAt: number; rows: [string, number | null, number | null, number][] } | null;
  /** Each traded contract's vols through the session, flattened [minute start (ms), vol, …] */
  ticks: Record<string, number[]>;
  /** UW's whole book a minute: [minute start (ms), price, gamma per 1% by open interest (UW's sign)] */
  /** [minute start (ms), price, gamma per 1% by open interest, by volume, directionalized — UW's sign; the last two since format 2] */
  total: { receivedAt: number; rows: [number, number | null, number, number?, number?][] } | null;
  /** What it cost and covered */
  calls: number;
  asked: number;
  refused: number;
  /** Where the session's vols came from: 'minute' UW's per-contract minutes (from about 2025-04-01), 'tape' the day's
      full tape (server/tapeBackfill.ts, 2024-01-03 to 2025-03-31 — "tape vols"), 'close' the session before's close
      alone (every cell carried). Format 2 (2026-10-13); a format-1 file is read as 'minute' with ticks, else 'close'. */
  vols: 'minute' | 'tape' | 'close';
}
/** The sidecar the coverage line reads (past.meta.json) */
export interface PastMeta {
  vols: PastDay['vols'];
  builtAt: number;
  asked: number;
  refused: number;
  calls: number;
}
export interface Coverage {
  name: string;
  /** Sessions built, New York dates ascending */
  days: string[];
  first: string | null;
  last: string | null;
  byVols: Record<PastDay['vols'], number>;
  /** Days asked and found to hold no session (or before the plan's window) */
  none: number;
  job: JobState;
}
export interface JobState {
  running: boolean;
  names: string[];
  from: string;
  to: string;
  /** Name-days in the range, built in this run, skipped (built before or no session), failed */
  days: number;
  built: number;
  skipped: number;
  failed: number;
  current: string | null;
}

/** A minute bar as the store reads it: the minute's start (seconds), its close, its session */
export interface MinuteBar {
  time: number;
  close: number;
  session: 'pre' | 'r' | 'post';
  open?: number;
  high?: number;
  low?: number;
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
/** UW's per-contract minute vols begin about here (measured 2026-10-13: none on 2025-03-04, full on 2025-04-02); a
    session before it is built from the day's tape where a tape reader is given (server/tapeBackfill.ts) */
export const TAPE_UNTIL = '2025-04-01';
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

/** A contract's minute vols, compressed: [minute start (ms), vol, …] — the middle of UW's iv_low and iv_high (the
    tape's own minute midpoint to 0.00001, measured 2026-10-13), the regular session's prints alone, a minute kept
    when its vol moved VOL_STEP from the last kept. Empty with nothing to keep. */
export function compressTicks(rows: readonly Pick<TapeRow, 'start_time' | 'iv_low' | 'iv_high'>[] | Row[], day: string): number[] {
  const out: number[] = [];
  let lastIv = NaN;
  for (const x of [...rows].sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)))) {
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
  return out;
}

export function createFieldBackfill(client: FeedClient, opts: { now?: () => number; root?: string; tape?: TapeReader } = {}) {
  const clock = opts.now ?? Date.now;
  let tapeOf: TapeReader | undefined = opts.tape;
  /** The tape reader the job uses for days before TAPE_UNTIL (server/tapeBackfill.ts) */
  const useTape = (reader: TapeReader | undefined) => {
    tapeOf = reader;
  };
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

  /** The session's own minutes: its range, and whether it was a session at all */
  async function barsOf(name: string, day: string): Promise<{ open: number; lo: number; hi: number; calls: number; bars: MinuteBar[] }> {
    const bars = await getRows(`/api/stock/${name}/ohlc/1m?date=${day}&limit=2500`);
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
    const minutes: MinuteBar[] = bars.rows
      .map(r => ({ time: Date.parse(String(r.start_time)) / 1000, close: num(r.close) ?? NaN, session: (r.market_time === 'r' ? 'r' : r.market_time === 'pr' ? 'pre' : 'post') as MinuteBar['session'], open: num(r.open) ?? undefined, high: num(r.high) ?? undefined, low: num(r.low) ?? undefined }))
      .filter(b => Number.isFinite(b.time) && Number.isFinite(b.close))
      .sort((a, b) => a.time - b.time);
    return { open, lo, hi, calls: 1, bars: minutes };
  }

  /** The positions at the open: the contracts with open interest dated the session, within 60 days and 15% of the open */
  const keptOf = (rows: Row[], day: string, open: number): Row[] =>
    rows.filter(r => {
      const exp = String(r.expires ?? '');
      const k = num(r.strike) ?? NaN;
      return exp >= day && Math.abs(k - open) <= open * BAND && (num(r.open_interest) ?? 0) > 0;
    });

  /** The session before's close: the vols knowable at the open, for the contracts in the universe (a holiday stepped over) */
  async function seedOf(name: string, day: string, last: string, inUniverse: Set<string>): Promise<{ seed: PastDay['seed']; calls: number }> {
    let calls = 0;
    let prev = isoAdd(day, -1);
    for (let tries = 0; tries < 5; tries++) {
      while (weekdayOf(prev) === 0 || weekdayOf(prev) === 6) prev = isoAdd(prev, -1);
      const c = await chainOn(name, prev, last);
      if (!c) break;
      calls += c.calls;
      if (c.rows.length) {
        const rows: [string, number | null, number | null, number][] = [];
        for (const r of c.rows) {
          const sym = String(r.option_symbol ?? '');
          if (!inUniverse.has(sym)) continue;
          const tape = Date.parse(String(r.last_tape_time ?? ''));
          rows.push([sym, num(r.implied_volatility), Number.isFinite(tape) ? tape : null, num(r.open_interest) ?? 0]);
        }
        return { seed: { date: prev, receivedAt: clock(), rows }, calls };
      }
      prev = isoAdd(prev, -1);
    }
    return { seed: null, calls };
  }

  /** The contracts whose vols are asked: those that traded within 35 strikes of the session's range */
  function askOf(kept: Row[], lo: number, hi: number): string[] {
    const strikes = [...new Set(kept.map(r => num(r.strike) ?? NaN))].filter(Number.isFinite).sort((a, b) => a - b);
    const idx = (p: number) => {
      let i = 0;
      while (i < strikes.length && strikes[i] < p) i++;
      return i;
    };
    const kLo = strikes[Math.max(0, idx(lo) - STRIKES_EACH_SIDE)];
    const kHi = strikes[Math.min(strikes.length - 1, idx(hi) + STRIKES_EACH_SIDE)];
    return kept.filter(r => (num(r.volume) ?? 0) > 0 && (num(r.strike) ?? NaN) >= kLo && (num(r.strike) ?? NaN) <= kHi).map(r => String(r.option_symbol));
  }

  /** The vols through the session for these contracts, two in flight, into `ticks` (a contract asked again is replaced) */
  async function ticksFor(name: string, day: string, syms: string[], ticks: Record<string, number[]>): Promise<{ calls: number; refused: number }> {
    let calls = 0;
    let refused = 0;
    let next = 0;
    const worker = async () => {
      while (next < syms.length) {
        const sym = syms[next++];
        const r = await getRows(`/api/option-contract/${sym}/intraday?date=${day}`);
        calls++;
        if (!r.ok) {
          refused++;
          continue;
        }
        const out = compressTicks(r.rows, day);
        if (out.length) ticks[sym] = out;
      }
    };
    await Promise.all(Array.from({ length: IN_FLIGHT }, worker));
    return { calls, refused };
  }

  /** The session's range off bars given (an index's, from the tape) */
  const rangeOf = (bars: MinuteBar[]) => {
    const regular = [...bars].filter(b => b.session === 'r').sort((a, b) => a.time - b.time);
    if (!regular.length) throw new Error('no session that day');
    const open = regular[0].open ?? regular[0].close;
    let lo = Infinity;
    let hi = -Infinity;
    for (const r of regular) {
      lo = Math.min(lo, r.low ?? r.close);
      hi = Math.max(hi, r.high ?? r.close);
    }
    return { open, lo, hi, calls: 0, bars: regular };
  };

  async function build(name: string, day: string, tape?: TapeDay, givenBars?: MinuteBar[]): Promise<PastDay & { bars: MinuteBar[] }> {
    let calls = 0;
    /* the minutes: UW's bars, or an index's off the tape's prints (the plan serves no index bars) */
    const fromTape = tape?.prices[name]?.length ? barsFromTape(tape.prices[name]) : null;
    const b = givenBars?.length ? rangeOf(givenBars) : fromTape?.length ? rangeOf(fromTape) : await barsOf(name, day);
    calls += b.calls;

    /* the positions at the open: open interest dated the session */
    const last = isoAdd(day, MAX_DTE);
    const chain = await chainOn(name, day, last);
    if (!chain) throw new Error('the dated chain was refused');
    calls += chain.calls;
    const kept = keptOf(chain.rows, day, b.open);
    if (!kept.length) throw new Error('no open interest dated that day');
    const oi: [string, number][] = kept.map(r => [String(r.option_symbol), num(r.open_interest) ?? 0]);

    /* the session before's close: the vols knowable at the open */
    const s = await seedOf(name, day, last, new Set(oi.map(o => o[0])));
    calls += s.calls;

    /* the validation series */
    const tot = await getRows(`/api/stock/${name}/spot-exposures?date=${day}`);
    calls++;
    const total: PastDay['total'] = tot.ok
      ? {
          receivedAt: clock(),
          rows: tot.rows
            .map(r => [Date.parse(String(r.start_time)), num(r.price), num(r.gamma_per_one_percent_move_oi) ?? 0, num(r.gamma_per_one_percent_move_vol) ?? 0, num(r.gamma_per_one_percent_move_dir) ?? 0] as [number, number | null, number, number, number])
            .filter(r => Number.isFinite(r[0])),
        }
      : null;

    /* the vols through the session: the contracts that traded within the strikes the field can draw — UW's minutes,
       or the day's tape where it is given (the same compression, the same shape) */
    const ticks: Record<string, number[]> = {};
    if (tape) {
      const rowsOf = tape.contracts[name] ?? {};
      let asked = 0;
      for (const r of kept) {
        const rows = rowsOf[String(r.option_symbol)];
        if (!rows?.length) continue;
        asked++;
        const out = compressTicks(rows, day);
        if (out.length) ticks[String(r.option_symbol)] = out;
      }
      return { format: PAST_FORMAT, name, day, builtAt: clock(), oi, seed: s.seed, ticks, total, calls, asked, refused: 0, vols: Object.keys(ticks).length ? 'tape' : 'close', bars: b.bars };
    }
    const ask = askOf(kept, b.lo, b.hi);
    const t = await ticksFor(name, day, ask, ticks);
    calls += t.calls;
    if (ask.length && t.refused / ask.length > MAX_REFUSED) throw new Error(`${t.refused} of ${ask.length} contracts refused — tried again later`);

    return { format: PAST_FORMAT, name, day, builtAt: clock(), oi, seed: s.seed, ticks, total, calls, asked: ask.length, refused: t.refused, vols: Object.keys(ticks).length ? 'minute' : 'close', bars: b.bars };
  }

  /** TODAY, REBUILT AS IT GOES — the store's final rows (server/fieldStore.ts; the owner, 2026-10-13: "written by the
      rebuild path once inputs with event time ≤ that minute have arrived (at the next chain read). Final rows must equal
      the rebuild exactly (same code path)"): the same dated chain, the same seed and the same per-minute vols as build(),
      the vols asked again for every contract whose volume grew since the last advance, so no band of the day's range
      (not known yet) chooses them — a contract past the field's strikes draws nothing either way. advance() answers the
      day so far and `through`, the moment its inputs were asked: a minute that ended before it holds every print it
      will, bar one reported late. */
  function today(name: string, day: string) {
    let base: { oi: [string, number][]; seed: PastDay['seed']; kept: Set<string> } | null = null;
    let bars: MinuteBar[] = [];
    const ticks: Record<string, number[]> = {};
    const volume = new Map<string, number>();
    let calls = 0;
    let asked = 0;
    let refused = 0;
    async function advance(givenBars?: MinuteBar[]): Promise<(PastDay & { through: number; bars: MinuteBar[] }) | null> {
      const through = clock();
      const last = isoAdd(day, MAX_DTE);
      const chain = await chainOn(name, day, last);
      if (!chain) return null;
      calls += chain.calls;
      /* the day's bars so far — the same call the rebuild makes, so the final rows stand on the same closes; an
         index's are given by the recorder (its prints' underlying, UW serving none) */
      const b = givenBars?.length ? (() => { try { return rangeOf(givenBars); } catch { return null; } })() : await barsOf(name, day).catch(() => null);
      if (!b) return null;
      calls += b.calls;
      bars = b.bars;
      if (!base) {
        const kept = keptOf(chain.rows, day, b.open);
        if (!kept.length) return null;
        const oi: [string, number][] = kept.map(r => [String(r.option_symbol), num(r.open_interest) ?? 0]);
        const s = await seedOf(name, day, last, new Set(oi.map(o => o[0])));
        calls += s.calls;
        base = { oi, seed: s.seed, kept: new Set(oi.map(o => o[0])) };
      }
      const grew: string[] = [];
      for (const r of chain.rows) {
        const sym = String(r.option_symbol ?? '');
        if (!base.kept.has(sym)) continue;
        const v = num(r.volume) ?? 0;
        if (v > (volume.get(sym) ?? 0)) {
          grew.push(sym);
          volume.set(sym, v);
        }
      }
      const t = await ticksFor(name, day, grew, ticks);
      calls += t.calls;
      asked += grew.length;
      refused += t.refused;
      return { format: PAST_FORMAT, name, day, builtAt: clock(), oi: base.oi, seed: base.seed, ticks: { ...ticks }, total: null, calls, asked, refused, vols: 'minute', through, bars };
    }
    return { advance, calls: () => calls };
  }

  function save(p: PastDay & { bars?: MinuteBar[] }) {
    const file = fileOf(p.name, p.day);
    mkdirSync(join(root, p.name, p.day), { recursive: true });
    const { bars: minutes, ...session } = p;
    const tmp = `${file}.tmp`;
    writeFileSync(tmp, gzipSync(Buffer.from(JSON.stringify(session))));
    renameSync(tmp, file);
    if (minutes?.length) writeFileSync(join(root, p.name, p.day, BARS), gzipSync(Buffer.from(JSON.stringify(minutes))));
    /* the coverage line reads these alone — never the sessions themselves */
    writeFileSync(join(root, p.name, p.day, META), JSON.stringify({ vols: p.vols, builtAt: p.builtAt, asked: p.asked, refused: p.refused, calls: p.calls } satisfies PastMeta));
  }
  const noneFile = (name: string, day: string) => join(root, name, day, 'none.json');
  const noneOf = (name: string, day: string) => existsSync(noneFile(name, day));

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

  /** A session's minute bars: the file kept beside it, else one call (kept then) — null where the vendor has none */
  async function bars(name: string, day: string): Promise<MinuteBar[] | null> {
    const file = join(root, name, day, BARS);
    try {
      if (existsSync(file)) return JSON.parse(gunzipSync(readFileSync(file)).toString('utf8')) as MinuteBar[];
    } catch {
      /* a file cut short: read again */
    }
    try {
      const b = await barsOf(name, day);
      mkdirSync(join(root, name, day), { recursive: true });
      writeFileSync(file, gzipSync(Buffer.from(JSON.stringify(b.bars))));
      return b.bars;
    } catch {
      return null;
    }
  }

  /** GET /feed/field/<NAME>/day/<D>: a built session's inputs, or 404 */
  function day(rawName: string, d: string): { status: number; body: string } {
    const name = rawName.toUpperCase();
    if (!NAME_OK.test(name) || !ISO.test(d)) return { status: 400, body: JSON.stringify({ error: 'bad-request' }) };
    try {
      const text = gunzipSync(readFileSync(fileOf(name, d))).toString('utf8');
      if (text.includes('"vols":')) return { status: 200, body: text };
      /* a format-1 file: its vols named on the way out */
      const p = JSON.parse(text) as PastDay;
      p.vols = Object.keys(p.ticks ?? {}).length ? 'minute' : 'close';
      return { status: 200, body: JSON.stringify(p) };
    } catch {
      return { status: 404, body: JSON.stringify({ error: 'not-built' }) };
    }
  }

  /* ---- THE BACKFILL JOB (the owner, 2026-10-13, item 1b: "Extend the existing no-look-ahead rebuild backward across
     the full window, oldest first. Each day not pulled drops out of the window permanently") ------------------------ */
  const job: JobState = { running: false, names: [], from: '', to: '', days: 0, built: 0, skipped: 0, failed: 0, current: null };
  /** Every session from `from` to `to` (the session before today by default), oldest first, each name — a session
      built is skipped, a day with no session (or before the plan's window) is noted once (none.json) and never asked
      again, a failure is tried again after RETRY_MS on the next run. A page's own ask is served first between sessions. */
  async function runRange(names: string[], from: string, to = isoAdd(nyMinute(clock()).day, -1)): Promise<JobState> {
    if (job.running) return job;
    const list = names.map(n => n.toUpperCase()).filter(n => NAME_OK.test(n));
    if (!list.length || !ISO.test(from) || !ISO.test(to)) return job;
    Object.assign(job, { running: true, names: list, from, to, days: 0, built: 0, skipped: 0, failed: 0, current: null });
    const days: string[] = [];
    for (let d = from; d <= to; d = isoAdd(d, 1)) if (weekdayOf(d) !== 0 && weekdayOf(d) !== 6) days.push(d);
    job.days = days.length * list.length;
    try {
      for (const d of days) {
        /* THE TAPE (server/tapeBackfill.ts): a day before UW's minute vols is streamed once for every name still to
           build, and each is built from its own prints — "tape vols" */
        let tape: TapeDay | null | undefined;
        const todo = list.filter(name => !has(name, d) && !noneOf(name, d));
        if (tapeOf && todo.length && (d < TAPE_UNTIL || todo.some(isIndexName))) {
          job.current = `${todo.join(',')}|${d} (the tape)`;
          tape = await tapeOf(d, todo);
        }
        for (const name of list) {
          if (has(name, d) || noneOf(name, d)) {
            job.skipped++;
            continue;
          }
          const key = `${name}|${d}`;
          const f = failed.get(key);
          if (f && clock() - f.at < RETRY_MS) {
            job.failed++;
            continue;
          }
          await run();
          job.current = key;
          try {
            if (tape === null) throw new Error('the tape was refused');
            /* an index's day stands on the tape alone; a stock's before the minute vols too */
            if (isIndexName(name) && !tape) throw new Error('an index needs the tape');
            save(await build(name, d, tape && (isIndexName(name) || d < TAPE_UNTIL) ? tape : undefined));
            failed.delete(key);
            job.built++;
          } catch (e) {
            const why = e instanceof Error ? e.message : 'refused';
            if (why === 'no session that day' || why === 'before the plan’s window') {
              mkdirSync(join(root, name, d), { recursive: true });
              writeFileSync(noneFile(name, d), JSON.stringify({ why, at: clock() }));
              job.skipped++;
            } else {
              failed.set(key, { why, at: clock() });
              job.failed++;
            }
          }
          job.current = null;
        }
      }
    } finally {
      job.running = false;
      job.current = null;
    }
    return job;
  }

  /** GET /feed/field/<NAME>/coverage: the sessions built for a name — "rebuilt <first> to <last>, N sessions" */
  function coverage(rawName: string): { status: number; body: string } {
    const name = rawName.toUpperCase();
    if (!NAME_OK.test(name)) return { status: 400, body: JSON.stringify({ error: 'bad-name' }) };
    const out: Coverage = { name, days: [], first: null, last: null, byVols: { minute: 0, tape: 0, close: 0 }, none: 0, job: { ...job } };
    try {
      for (const d of readdirSync(join(root, name)).sort()) {
        if (!ISO.test(d)) continue;
        if (has(name, d)) {
          out.days.push(d);
          let vols: PastDay['vols'] = 'minute';
          try {
            vols = (JSON.parse(readFileSync(join(root, name, d, META), 'utf8')) as PastMeta).vols ?? 'minute';
          } catch {
            /* a session built before the sidecar: its vols are UW's minutes or the close — counted as minutes */
          }
          out.byVols[vols]++;
        } else if (noneOf(name, d)) out.none++;
      }
    } catch {
      /* no folder yet */
    }
    out.first = out.days[0] ?? null;
    out.last = out.days[out.days.length - 1] ?? null;
    return { status: 200, body: JSON.stringify(out) };
  }

  /** A session's minute bars for any name: an index's off its tape's prices (tape-price.json), a stock's as bars() */
  async function minutes(name: string, day: string): Promise<MinuteBar[] | null> {
    if (isIndexName(name)) {
      try {
        const t = JSON.parse(readFileSync(join(root, name.toUpperCase(), day, 'tape-price.json'), 'utf8')) as { bars: TapePriceBar[] };
        const b = barsFromTape(t.bars);
        return b.length ? b : null;
      } catch {
        return null;
      }
    }
    return bars(name, day);
  }

  return { ask, day, build, bars, minutes, chainOn, today, runRange, coverage, save, has, useTape, idle: () => !running && !job.running, job: () => ({ ...job }) };
}
