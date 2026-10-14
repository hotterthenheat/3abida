/*
==================================================
  SLAYER TERMINAL - THE FIELD'S RECORDER (server/fieldRecorder.ts)

  THE FIELD'S INPUTS, RECORDED ON THIS MACHINE'S SERVER
  AS THEY BECOME KNOWABLE (2026-10-13 — the owner:
  "lets focus on the apis we have right now"; the
  research, reports/Dealer exposure reconstruction.md
  §5 and §8: "live capture is the only way to hold the
  vendor's number at t"). UW answers a name's chain and
  book as they stand now, never for an earlier minute,
  so what the field may use at a minute is what was
  read at or before it. The local server (the Vite
  dev/preview middleware, up as long as `npm run dev`
  is) reads it, tab or no tab, and keeps every read
  with the moment it was received:

    · THE BOOK, once a minute through New York's
      session (09:30–16:00, a weekday): /spot-exposures/
      strike round the price, every strike's own `time`
      and `price` kept (UW: strikes in one answer "can
      differ in time, possibly by hours") — the
      MEASURED REFERENCE the field is checked against,
      never blended into it.
    · THE WHOLE BOOK A MINUTE: /spot-exposures (UW's own
      per-minute series for the day) — the validation
      series, the latest answer kept.
    · THE CHAIN, every ten minutes through the session
      and once as a name is first watched: /option-
      contracts within 60 days — each contract's open
      interest (today's count) and the vol of its last
      trade with that trade's time. A read's vols are
      the field's from the moment it was received on.
    · THE SEED, once a day: the session before's close
      chain (/option-chains?date=&greeks=true, the
      expiries from today to 60 days) — each contract's
      vol at that close, the vol knowable at today's
      open.

  THE NAMES are the ones the terminal asked the field
  for: GET /feed/field/<NAME>[?since=<ms>] watches the
  name and answers what was recorded after `since`.
  Six names at most; a name nobody asked for in two
  hours is let go. Every call goes through the proxy's
  own client — its cache, its UW gate (three at once),
  its key handling; this file never sees a key.

  ON DISK, append-only, git-ignored:
  .feed-cache/field/<NAME>/<YYYY-MM-DD>/{books,books60,chain}.jsonl,
  total.json, seed.json (books60: UW's book on the
  expiries within 60 days, per strike, every five
  minutes — the field's like-for-like reference). A DAY IS NEVER DELETED (2026-10-13 — the research, reports/Dealer exposure
  reconstruction.md, and its review: every minute not recorded, or recorded and thrown away, is lost for good — UW
  never serves the book by strike for an earlier time): as the day turns, the days before are gzipped in place
  (<file>.gz) and kept, for the backfill and the validation runs to come.
==================================================
*/

import { PARTS, partOf, windowEnds } from '../src/data/feed/trailModel';
import { appendFileSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';
import type { FeedClient } from './feed';
import type { createFieldBackfill, MinuteBar, PastDay } from './fieldBackfill';
import type { Bar, FieldStore } from './fieldStore';

type FieldBackfill = ReturnType<typeof createFieldBackfill>;

const ROOT = join(process.cwd(), '.feed-cache', 'field');
const MAX_NAMES = 6;
const IDLE_MS = 2 * 60 * 60_000;
const EVERY_MS = 60_000;
const CHAIN_EVERY_MS = 10 * 60_000;
/* THE BOOK ON THE MODEL'S OWN UNIVERSE (the Terrain audit of 2026-10-13, row 41): UW's /spot-exposures/expiry-strike
   for the expiries within 60 days, every five minutes, summed per strike — the field is compared to THIS, like for like
   (its whole-book series spans every expiry and strike: within 15% of the price every expiry summed to −0.13 B while
   the 60-day book summed to −0.67 B, so the sum's sign disagreed most minutes; the expiries past 60 days are a third of
   the near-the-money book's cancelling mass). Pages of 500 rows: SPY is ~2,000 rows, five calls a read. */
const BOOK60_EVERY_MS = 5 * 60_000;
const BOOK60_BAND = 0.15;
const MAX_DTE = 60;
/** A chain row is kept within this share of the price (the field draws 30 strikes each side) */
const BAND = 0.15;
const MAX_PAGES = 30;
/** The row fields kept of a book — what data/feed/uw.ts strikeExposure reads, each strike's own time and price among them */
const KEEP = ['strike', 'price', 'time', 'call_gamma_oi', 'put_gamma_oi', 'call_delta_oi', 'put_delta_oi', 'call_charm_oi', 'put_charm_oi', 'call_vanna_oi', 'put_vanna_oi', 'call_gamma_vol', 'put_gamma_vol'] as const;

type Row = Record<string, unknown>;
export interface RecordedBook {
  /** When the server received it, epoch ms */
  receivedAt: number;
  rows: Row[];
}
/** One read of the chain: [OCC symbol, open interest, vol of the last trade or null, that trade's time (ms) or null,
    NBBO bid or null, NBBO ask or null, the day's volume] — the last three since 2026-10-13 (the store's straddles,
    server/fieldStore.ts; the owner: "keep the chain's nbbo_bid/nbbo_ask") */
export type ChainRow = [string, number, number | null, number | null, (number | null)?, (number | null)?, number?];
export interface RecordedChain {
  receivedAt: number;
  rows: ChainRow[];
}
/** The session before's close: [OCC symbol, vol at the close or null, its last trade's time (ms) or null, open interest
    dated that session — the count the pre-market stands on until today's is received (the owner, 2026-10-13)] */
export type SeedRow = [string, number | null, number | null, number];
export interface RecordedSeed {
  /** The session the vols closed */
  date: string;
  receivedAt: number;
  rows: SeedRow[];
}
/** UW's book on the expiries within 60 days, summed per strike: [strike, call gamma per 1% by OI, put gamma (UW's sign), the strike's newest row time (ms) or null] */
export type Book60Row = [number, number, number, number | null];
export interface RecordedBook60 {
  receivedAt: number;
  /** The price UW figured it at */
  price: number;
  expiries: string[];
  rows: Book60Row[];
  /** [strike, call gamma by partition ×4, put gamma by partition ×4] — UW's sign, the partitions trailModel partOf's
      (item 6); absent on reads before 2026-10-14 */
  parts?: number[][];
}
export interface RecordedTotal {
  receivedAt: number;
  /** [minute's start (ms), UW's price, the whole book's gamma per 1% by open interest, by volume, directionalized —
      UW's sign; the last two since 2026-10-13 (the owner: "keep … UW's _vol and _dir series", item 3's attribution)] */
  rows: [number, number | null, number, number?, number?][];
}
/** The day's open-interest switch: the first chain read whose count differed from the read (or seed) before it on a
    large share of the contracts — when UW's published count was received (the owner, 2026-10-13: "measure it from days
    the recorder runs from 4:00 am") */
export interface OiSwitch {
  receivedAt: number;
  /** The read before it (its receipt), 0 for the seed */
  previousAt: number;
  changed: number;
  of: number;
}
interface Day {
  name: string;
  day: string;
  books: RecordedBook[];
  books60: RecordedBook60[];
  chains: RecordedChain[];
  seed: RecordedSeed | null;
  total: RecordedTotal | null;
  oiSwitch: OiSwitch | null;
  /** The day's minute bars as read (UW's /ohlc/1m, the last dozen each minute), by the minute's start (seconds) */
  bars: Map<number, Bar>;
  /** Today's rebuild as it goes (fieldBackfill today()) — the store's final rows */
  today: ReturnType<FieldBackfill['today']> | null;
  finalBusy: boolean;
  /** The closing pass done: one more advance after 16:00, for the session's last minutes */
  closed: boolean;
}

const nyParts = (ms: number) => {
  const r: Record<string, string> = {};
  for (const x of new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: 'numeric', minute: 'numeric' }).formatToParts(new Date(ms)))
    if (x.type !== 'literal') r[x.type] = x.value;
  return { day: `${r.year}-${r.month}-${r.day}`, minute: (Number(r.hour) % 24) * 60 + Number(r.minute), weekday: r.weekday };
};
const isoAdd = (iso: string, days: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
};
const weekdayOf = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();
const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const occ = /^(.*?)(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/;
const occParts = (s: string) => {
  const m = occ.exec(s);
  return m ? { expiry: `20${m[2]}-${m[3]}-${m[4]}`, strike: Number(m[6]) / 1000 } : null;
};

const NAME_OK = /^[A-Z][A-Z0-9.]{0,9}$/;
/** A cash index: no bars on the plan, its minutes off its prints */
const INDEX_NAMES = new Set(['SPX', 'NDX', 'RUT', 'VIX']);
/** ONE RECORDER A MACHINE (2026-10-13 — two recorders wrote the same minutes 10 to 30 s apart: a dev server's
    in-process restart left the old one ticking, and the standalone recorder beside a dev server would do the same):
    the recorder holding .feed-cache/field/recorder.lock records; another reads the files and serves them. A lock not
    refreshed in this long, or whose process is gone, is taken. */
const LOCK_STALE_MS = 3 * 60_000;
/** The files gzipped in place as the day turns */
const PRUNED = new Set(['books.jsonl', 'books60.jsonl', 'chain.jsonl', 'total.json', 'seed.json', 'shown.jsonl', 'final.jsonl']);
/** Bars are read through the hours Terrain draws: 04:00 to 20:00 New York */
const barHoursAt = (minute: number) => minute >= 4 * 60 && minute <= 20 * 60;

export function createFieldRecorder(client: FeedClient, opts: { now?: () => number; always?: string[]; backfill?: FieldBackfill; store?: FieldStore; root?: string } = {}) {
  const root = opts.root ?? ROOT;
  /* the reads in flight — settle() awaits them (the proofs) */
  const inFlight = new Set<Promise<unknown>>();
  const track = <T>(p: Promise<T>): Promise<T> => {
    inFlight.add(p);
    void p.finally(() => inFlight.delete(p));
    return p;
  };
  /* THE NAMES RECORDED WHATEVER THE TABS (the standalone recorder, server/recorderMain.ts): watched from the start and
     never let go for idleness */
  const always = new Set((opts.always ?? []).map(n => n.toUpperCase()).filter(n => NAME_OK.test(n)));
  const clock = opts.now ?? Date.now;
  const watched = new Map<string, number>();
  const days = new Map<string, Day>();
  const known = new Map<string, number>();
  const busy = new Set<string>();
  let timer: ReturnType<typeof setInterval> | null = null;
  let stopped = false;
  const id = randomUUID();
  const lockFile = join(root, 'recorder.lock');
  const alive = (pid: number) => {
    try {
      process.kill(pid, 0);
      return true;
    } catch (e) {
      return (e as { code?: string }).code === 'EPERM';
    }
  };
  /** This recorder holds the lock (taking it when it is free, stale or its process gone), refreshing it */
  function holdLock(): boolean {
    if (stopped) return false;
    const now = clock();
    try {
      const had = JSON.parse(readFileSync(lockFile, 'utf8')) as { id: string; pid: number; at: number };
      if (had.id !== id && now - had.at < LOCK_STALE_MS && alive(had.pid)) return false;
    } catch {
      /* no lock yet, or one cut short */
    }
    try {
      mkdirSync(root, { recursive: true });
      writeFileSync(lockFile, JSON.stringify({ id, pid: process.pid, at: now }));
    } catch {
      return true;
    }
    return true;
  }
  function releaseLock() {
    try {
      const had = JSON.parse(readFileSync(lockFile, 'utf8')) as { id: string };
      if (had.id === id) rmSync(lockFile, { force: true });
    } catch {
      /* none */
    }
  }
  /** The day's files' sizes when this recorder last read them — a recorder that does not hold the lock reads them
      again when another has grown them */
  const sizesAt = new Map<string, string>();
  const sizesOf = (name: string, day: string) =>
    ['books.jsonl', 'books60.jsonl', 'chain.jsonl', 'seed.json', 'total.json', 'oi.json']
      .map(f => {
        try {
          return String(statSync(join(root, name, day, f)).size);
        } catch {
          return '0';
        }
      })
      .join('|');

  const dirOf = (name: string, day: string) => join(root, name, day);

  /** The days before today, kept and gzipped in place — never deleted (see the header) */
  function prune(today: string) {
    try {
      for (const name of readdirSync(root))
        for (const day of readdirSync(join(root, name))) {
          if (day >= today) continue;
          const dir = join(root, name, day);
          for (const f of readdirSync(dir)) {
            /* the recorder's and the store's own files alone — the backfill's sidecars stay as they are */
            if (!PRUNED.has(f)) continue;
            const file = join(dir, f);
            writeFileSync(`${file}.gz`, gzipSync(readFileSync(file)));
            rmSync(file, { force: true });
          }
        }
    } catch {
      /* no folder yet, or a file still being written — the next turn of the clock tries again */
    }
  }

  const readLines = <T>(file: string): T[] => {
    try {
      return readFileSync(file, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map(l => JSON.parse(l) as T);
    } catch {
      return [];
    }
  };
  const readJson = <T>(file: string): T | null => {
    try {
      return JSON.parse(readFileSync(file, 'utf8')) as T;
    } catch {
      return null;
    }
  };

  function dayOf(name: string, today: string, fresh = false): Day {
    let d = days.get(name);
    /* a reader (not the lock's holder) takes the files as the recorder wrote them */
    const sizes = fresh ? sizesOf(name, today) : '';
    if (fresh && d && d.day === today && sizesAt.get(name) !== sizes) d = undefined;
    if (fresh) sizesAt.set(name, sizes);
    if (!d || d.day !== today) {
      const dir = dirOf(name, today);
      d = {
        name,
        day: today,
        books: readLines<RecordedBook>(join(dir, 'books.jsonl')),
        books60: readLines<RecordedBook60>(join(dir, 'books60.jsonl')),
        chains: readLines<RecordedChain>(join(dir, 'chain.jsonl')),
        /* a seed written before 2026-10-13 carries no count: read again, so the pre-market stands on the prior count */
        seed: (x => (x && x.rows.length && x.rows[0].length >= 4 ? x : null))(readJson<RecordedSeed>(join(dir, 'seed.json'))),
        total: readJson<RecordedTotal>(join(dir, 'total.json')),
        oiSwitch: readJson<OiSwitch>(join(dir, 'oi.json')),
        bars: new Map(),
        today: null,
        finalBusy: false,
        closed: false,
      };
      days.set(name, d);
    }
    return d;
  }

  const write = (name: string, day: string, file: string, text: string, append: boolean) => {
    try {
      const dir = dirOf(name, day);
      mkdirSync(dir, { recursive: true });
      if (append) appendFileSync(join(dir, file), text + '\n');
      else writeFileSync(join(dir, file), text);
    } catch {
      /* a refused disk: the day lives in memory */
    }
  };

  const getRows = async (path: string): Promise<Row[] | null> => {
    const a = await client.get('uw', path);
    if (a.status !== 200) return null;
    try {
      return (JSON.parse(a.body) as { data?: Row[] }).data ?? [];
    } catch {
      return null;
    }
  };

  async function priceOf(name: string): Promise<number | null> {
    const had = known.get(name);
    if (had) return had;
    const first = await getRows(`/api/stock/${name}/spot-exposures/strike?limit=1`);
    const p = num(first?.[0]?.price);
    if (p && p > 0) known.set(name, p);
    return p && p > 0 ? p : null;
  }

  async function readBook(name: string, d: Day) {
    const price = await priceOf(name);
    if (price == null) return;
    const half = Math.max(32, price * 0.08);
    const rows = await getRows(`/api/stock/${name}/spot-exposures/strike?min_strike=${Math.floor(price - half)}&max_strike=${Math.ceil(price + half)}`);
    if (!rows?.length) return;
    const p = num(rows.find(r => r.price != null)?.price);
    if (p && p > 0) known.set(name, p);
    const book: RecordedBook = { receivedAt: clock(), rows: rows.map(r => Object.fromEntries(KEEP.map(k => [k, r[k]]))) };
    d.books.push(book);
    write(name, d.day, 'books.jsonl', JSON.stringify(book), true);
  }

  /** UW's book on the expiries within 60 days, per strike — the expiries off the newest chain read */
  async function readBook60(name: string, d: Day) {
    const chain = d.chains[d.chains.length - 1];
    if (!chain) return;
    const price = await priceOf(name);
    if (price == null) return;
    const last = isoAdd(d.day, MAX_DTE);
    const expiries = [...new Set(chain.rows.map(r => occParts(r[0])?.expiry ?? '').filter(e => e >= d.day && e <= last))].sort();
    if (!expiries.length) return;
    const half = price * BOOK60_BAND;
    const q = expiries.map(e => `expirations[]=${e}`).join('&');
    const by = new Map<number, { c: number; p: number; t: number | null; parts: number[] }>();
    /* each strike's call and put gamma by expiry partition too (item 6: the windows' measured reference and the ladder's
       window view, off this same answer — no call more) */
    const ends = windowEnds(d.day);
    for (let page = 0; page < MAX_PAGES; page++) {
      const got = await getRows(`/api/stock/${name}/spot-exposures/expiry-strike?${q}&min_strike=${Math.floor(price - half)}&max_strike=${Math.ceil(price + half)}&limit=500&page=${page}`);
      if (!got) return;
      for (const r of got) {
        const k = num(r.strike);
        if (k == null) continue;
        const cur = by.get(k) ?? { c: 0, p: 0, t: null, parts: new Array(2 * PARTS).fill(0) };
        const cg = num(r.call_gamma_oi) ?? 0;
        const pg = num(r.put_gamma_oi) ?? 0;
        cur.c += cg;
        cur.p += pg;
        const exp = String(r.expiry ?? '');
        if (/^\d{4}-\d{2}-\d{2}$/.test(exp)) {
          const q = partOf(exp, d.day, ends);
          cur.parts[q] += cg;
          cur.parts[PARTS + q] += pg;
        }
        const t = Date.parse(String(r.time ?? ''));
        if (Number.isFinite(t) && (cur.t == null || t > cur.t)) cur.t = t;
        by.set(k, cur);
      }
      if (got.length < 500) break;
    }
    if (!by.size) return;
    const read: RecordedBook60 = {
      receivedAt: clock(),
      price,
      expiries,
      rows: [...by].map(([k, v]) => [k, v.c, v.p, v.t] as Book60Row).sort((a, b) => a[0] - b[0]),
      parts: [...by].map(([k, v]) => [k, ...v.parts]).sort((a, b) => a[0] - b[0]),
    };
    d.books60.push(read);
    write(name, d.day, 'books60.jsonl', JSON.stringify(read), true);
  }

  async function readTotal(name: string, d: Day) {
    const rows = await getRows(`/api/stock/${name}/spot-exposures`);
    if (!rows) return;
    const total: RecordedTotal = {
      receivedAt: clock(),
      rows: rows
        .map(r => [Date.parse(String(r.start_time)), num(r.price), num(r.gamma_per_one_percent_move_oi) ?? 0, num(r.gamma_per_one_percent_move_vol) ?? 0, num(r.gamma_per_one_percent_move_dir) ?? 0] as [number, number | null, number, number, number])
        .filter(r => Number.isFinite(r[0])),
    };
    d.total = total;
    write(name, d.day, 'total.json', JSON.stringify(total), false);
  }

  async function readChain(name: string, d: Day) {
    const price = await priceOf(name);
    if (price == null) return;
    const rows: ChainRow[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const got = await getRows(`/api/stock/${name}/option-contracts?max_dte=${MAX_DTE}&exclude_zero_oi_chains=true&limit=500&page=${page}`);
      if (!got) return;
      for (const r of got) {
        const s = String(r.option_symbol ?? '');
        const p = occParts(s);
        if (!p || Math.abs(p.strike - price) > price * BAND) continue;
        const tape = Date.parse(String(r.last_tape_time ?? ''));
        rows.push([s, num(r.open_interest) ?? 0, num(r.implied_volatility), Number.isFinite(tape) ? tape : null, num(r.nbbo_bid), num(r.nbbo_ask), num(r.volume) ?? 0]);
      }
      if (got.length < 500) break;
    }
    const read: RecordedChain = { receivedAt: clock(), rows };
    /* the day's switch: the first read whose count differs from the one before it (or the seed's) on more than a
       quarter of the contracts both hold — UW's published count landing */
    if (!d.oiSwitch) {
      const before = d.chains.length ? new Map(d.chains[d.chains.length - 1].rows.map(r => [r[0], r[1]])) : d.seed ? new Map(d.seed.rows.map(r => [r[0], r[3]])) : null;
      if (before) {
        let changed = 0;
        let of = 0;
        for (const [sym, oi] of rows) {
          const b = before.get(sym);
          if (b === undefined) continue;
          of++;
          if (b !== oi) changed++;
        }
        if (of > 0 && changed > of / 4) {
          d.oiSwitch = { receivedAt: read.receivedAt, previousAt: d.chains.length ? d.chains[d.chains.length - 1].receivedAt : 0, changed, of };
          write(name, d.day, 'oi.json', JSON.stringify(d.oiSwitch), false);
        }
      }
    }
    d.chains.push(read);
    write(name, d.day, 'chain.jsonl', JSON.stringify(read), true);
  }

  async function readSeed(name: string, d: Day) {
    const price = await priceOf(name);
    if (price == null) return;
    const last = isoAdd(d.day, MAX_DTE);
    /* the session before today: weekdays back, a holiday (an empty answer) stepped over */
    let date = isoAdd(d.day, -1);
    for (let tries = 0; tries < 5; tries++) {
      while (weekdayOf(date) === 0 || weekdayOf(date) === 6) date = isoAdd(date, -1);
      const rows: SeedRow[] = [];
      let any = false;
      for (let page = 0; page < MAX_PAGES; page++) {
        const got = await getRows(`/api/stock/${name}/option-chains?date=${date}&greeks=true&limit=500&page=${page}`);
        if (!got) return;
        if (got.length) any = true;
        let past = false;
        for (const r of got) {
          const exp = String(r.expires ?? '');
          if (exp > last) {
            past = true;
            continue;
          }
          if (exp < d.day) continue;
          const strike = num(r.strike) ?? 0;
          if (Math.abs(strike - price) > price * BAND) continue;
          const tape = Date.parse(String(r.last_tape_time ?? ''));
          rows.push([String(r.option_symbol ?? ''), num(r.implied_volatility), Number.isFinite(tape) ? tape : null, num(r.open_interest) ?? 0]);
        }
        if (past || got.length < 500) break;
      }
      if (any) {
        d.seed = { date, receivedAt: clock(), rows };
        write(name, d.day, 'seed.json', JSON.stringify(d.seed), false);
        return;
      }
      date = isoAdd(date, -1);
    }
  }

  /** AN INDEX'S MINUTE OFF ITS PRINTS (2026-10-13 — the owner's check passed: the tape's per-print underlying against
      SPY's bar close within ±0.02% of the day's median in 99.2% to 100% of regular minutes): UW serves no index bars,
      so each minute's bar is the newest prints' underlying price — first, highest, lowest, last of the prints seen —
      read every minute (the last five hundred prints, SPXW's among SPX's), the close the newest print's. */
  async function readIndexBars(name: string, d: Day) {
    const rows = await getRows(`/api/option-trades?ticker_symbol=${name}&limit=500`);
    if (!rows) return;
    for (const r of rows) {
      const at = Date.parse(String(r.executed_at ?? ''));
      const up = num(r.underlying_price);
      if (!Number.isFinite(at) || up == null || !(up > 0)) continue;
      const p = nyParts(at);
      if (p.day !== d.day) continue;
      const minute = Math.floor(at / 60_000) * 60;
      const had = d.bars.get(minute);
      const session: Bar['session'] = p.minute >= 9 * 60 + 30 && p.minute < 16 * 60 ? 'r' : p.minute < 9 * 60 + 30 ? 'pre' : 'post';
      if (!had) d.bars.set(minute, { time: minute, close: up, open: up, high: up, low: up, session });
      else {
        had.high = Math.max(had.high ?? up, up);
        had.low = Math.min(had.low ?? up, up);
        /* the prints come newest first: the first seen of a minute is its newest */
      }
    }
  }

  /** The day's minute bars, the last dozen — the store's shown rows stand on each minute's close as Terrain draws it */
  async function readBars(name: string, d: Day) {
    if (INDEX_NAMES.has(name)) return readIndexBars(name, d);
    const rows = await getRows(`/api/stock/${name}/ohlc/1m?limit=12`);
    if (!rows) return;
    for (const r of rows) {
      const t = Date.parse(String(r.start_time));
      const close = num(r.close);
      if (!Number.isFinite(t) || close == null || nyParts(t).day !== d.day) continue;
      const mt = String(r.market_time ?? 'r');
      d.bars.set(t / 1000, { time: t / 1000, close, session: mt === 'r' ? 'r' : mt === 'pr' ? 'pre' : 'post', open: num(r.open) ?? undefined, high: num(r.high) ?? undefined, low: num(r.low) ?? undefined });
    }
  }

  /** THE STORE'S FINAL ROWS (server/fieldStore.ts): today rebuilt as it goes, once a chain read — detached from the
      minute's reads, one at a time a name */
  async function finalize(name: string, d: Day) {
    if (!opts.backfill || !opts.store || d.finalBusy) return;
    d.finalBusy = true;
    try {
      d.today ??= opts.backfill.today(name, d.day);
      /* the day's bars come with the advance (the rebuild's own call), so a recorder started mid-session still
         writes the final rows for every minute from the open */
      const past: (PastDay & { through: number; bars: MinuteBar[] }) | null = await d.today.advance(INDEX_NAMES.has(name) ? [...d.bars.values()] : undefined);
      if (past) opts.store.final(name, d.day, past, past.bars);
    } finally {
      d.finalBusy = false;
    }
  }

  /** The chain is read through the pre-market too (04:00 on), so the count UW publishes about 06:45 is received within
      ten minutes — a column before that read stands on the seed's count (data/feed/trailField.ts universeOf) */
  const chainHoursAt = (minute: number) => minute >= 4 * 60 && minute <= 16 * 60;
  async function serviceName(name: string, inSession: boolean, chainHours = inSession, barHours = inSession) {
    if (busy.has(name)) return;
    busy.add(name);
    try {
      const { day } = nyParts(clock());
      const d = dayOf(name, day);
      const lastChain = d.chains[d.chains.length - 1]?.receivedAt ?? 0;
      let readTheChain = false;
      if (!d.chains.length || (chainHours && clock() - lastChain >= CHAIN_EVERY_MS)) {
        await readChain(name, d);
        readTheChain = true;
      }
      if (inSession || !d.books.length) {
        await readBook(name, d);
        await readTotal(name, d);
      }
      const lastBook60 = d.books60[d.books60.length - 1]?.receivedAt ?? 0;
      /* …and once when the day's newest read predates the partitions (a recorder upgraded mid-day — item 6's windows) */
      if (!d.books60.length || !d.books60[d.books60.length - 1].parts || (inSession && clock() - lastBook60 >= BOOK60_EVERY_MS)) await readBook60(name, d);
      if (!d.seed) await readSeed(name, d);
      /* THE STORE (server/fieldStore.ts): the shown rows for the minutes ended, from what was received by each */
      if (opts.store && (barHours || inSession)) {
        await readBars(name, d);
        opts.store.shown(name, d.day, { chains: d.chains, seed: d.seed, total: d.total }, [...d.bars.values()], d.books);
      }
      if (readTheChain && inSession) void track(finalize(name, d).catch(() => undefined));
      /* the closing pass: the minutes before 16:00 that no read in the session reached */
      if (!inSession && d.today && !d.closed && nyParts(clock()).minute > 16 * 60) {
        d.closed = true;
        void track(finalize(name, d).catch(() => undefined));
      }
    } finally {
      busy.delete(name);
    }
  }

  async function tick() {
    const now = clock();
    for (const [n, at] of watched) if (!always.has(n) && now - at > IDLE_MS) watched.delete(n);
    if (!client.hasKey('uw') || !watched.size) return;
    /* one recorder a machine: another holds the lock, so this one only serves what it wrote */
    if (!holdLock()) return;
    const { day, minute, weekday } = nyParts(now);
    if (weekday === 'Sat' || weekday === 'Sun') return;
    prune(day);
    const inSession = minute >= 9 * 60 + 30 && minute <= 16 * 60;
    /* one name after another — the proxy's gate keeps UW at three at once with the pages' own polls */
    for (const name of watched.keys()) await track(serviceName(name, inSession, chainHoursAt(minute), barHoursAt(minute)).catch(() => undefined));
  }

  function watch(name: string) {
    const fresh = !watched.has(name);
    if (fresh && watched.size >= MAX_NAMES) {
      let oldest = '';
      let t = Infinity;
      for (const [n, at] of watched)
        if (!always.has(n) && at < t) {
          t = at;
          oldest = n;
        }
      if (oldest) watched.delete(oldest);
    }
    watched.set(name, clock());
    if (!timer) {
      prune(nyParts(clock()).day);
      timer = setInterval(() => void tick(), EVERY_MS);
      (timer as { unref?: () => void }).unref?.();
    }
    /* a name first watched is read at once — its chain, its seed, one book — whatever the hour — by the lock's holder */
    if (fresh && holdLock()) {
      const { minute, weekday } = nyParts(clock());
      if (weekday !== 'Sat' && weekday !== 'Sun') void track(serviceName(name, minute >= 9 * 60 + 30 && minute <= 16 * 60, chainHoursAt(minute), barHoursAt(minute)).catch(() => undefined));
    }
  }

  /** GET /feed/field/<NAME>?since=<ms>: watch the name, and what was recorded after `since` */
  function serve(rawName: string, since = 0): { status: number; body: string } {
    const name = rawName.toUpperCase();
    if (!NAME_OK.test(name)) return { status: 400, body: JSON.stringify({ error: 'bad-name' }) };
    if (!client.hasKey('uw')) return { status: 503, body: JSON.stringify({ error: 'no-key' }) };
    watch(name);
    const d = dayOf(name, nyParts(clock()).day, !holdLock());
    const newer = <T extends { receivedAt: number }>(x: T | null) => (x && x.receivedAt > since ? x : null);
    let latest = 0;
    for (const x of [...d.books, ...d.books60, ...d.chains, d.seed, d.total]) if (x) latest = Math.max(latest, x.receivedAt);
    return {
      status: 200,
      body: JSON.stringify({
        name,
        day: d.day,
        latest,
        books: d.books.filter(b => b.receivedAt > since),
        books60: d.books60.filter(b => b.receivedAt > since),
        chains: d.chains.filter(c => c.receivedAt > since),
        seed: newer(d.seed),
        total: newer(d.total),
        oiSwitch: d.oiSwitch,
      }),
    };
  }

  /* the always-on names start at once, whether or not a tab ever asks */
  if (always.size && client.hasKey('uw')) for (const n of always) watch(n);

  /** Every read in flight done, the detached final pass included */
  async function settle(): Promise<void> {
    while (inFlight.size) await Promise.all([...inFlight]);
  }

  /** Stop recording: the minute's timer cleared and the lock let go (a dev server's restart, the process's end) */
  function stop() {
    stopped = true;
    if (timer) clearInterval(timer);
    timer = null;
    releaseLock();
  }

  return { serve, tick, settle, stop, watched: () => [...watched.keys()], always: () => [...always] };
}
