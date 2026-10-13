/*
==================================================
  SLAYER TERMINAL - THE FIELD'S RECORDER (server/fieldRecorder.ts)

  THE BOOK, READ ONCE A MINUTE ON THIS MACHINE'S SERVER
  (2026-10-13 — the owner: "lets focus on the apis we
  have right now"). UW answers a name's book by strike
  as it stands now and never for an earlier minute, so
  Terrain's field is only as full as the books someone
  read. The browser read them while a tab was open;
  now the local server (the Vite dev/preview middleware,
  which runs as long as `npm run dev` does) reads them,
  tab or no tab:

    · THE NAMES are the ones the terminal asked the
      field for — GET /feed/field/<NAME> registers the
      name and answers the day recorded so far. Six at
      most; a name nobody asked for in two hours is
      let go.
    · ONCE A MINUTE during New York's session (09:30 to
      16:00 on a weekday) each name's
      /spot-exposures/strike is asked once — through
      the proxy's own client, so its cache, its UW gate
      (three at once) and its key handling are the
      proxy's. 61 strikes round the price.
    · ON DISK: .feed-cache/field/<NAME>-<YYYY-MM-DD>.json
      (git-ignored), every book read that day; a day
      before today is deleted as the recorder starts and
      as the day turns.

  The key never leaves the proxy's client; the file
  holds UW's figures only (the rows as UW answered
  them, the fields the terminal reads).
==================================================
*/

import { mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FeedClient } from './feed';

const DIR = join(process.cwd(), '.feed-cache', 'field');
const MAX_NAMES = 6;
const IDLE_MS = 2 * 60 * 60_000;
const EVERY_MS = 60_000;
const HALF = 32;
/** The row fields kept — what data/feed/uw.ts strikeExposure reads */
const KEEP = ['strike', 'price', 'time', 'call_gamma_oi', 'put_gamma_oi', 'call_delta_oi', 'put_delta_oi', 'call_charm_oi', 'put_charm_oi', 'call_vanna_oi', 'put_vanna_oi', 'call_gamma_vol', 'put_gamma_vol'] as const;

type Row = Record<string, unknown>;
export interface RecordedBook {
  /** UW's moment for the book, epoch ms */
  at: number;
  rows: Row[];
}
export interface RecordedDay {
  name: string;
  day: string;
  books: RecordedBook[];
}

const nyParts = (ms: number) => {
  const r: Record<string, string> = {};
  for (const x of new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: 'numeric', minute: 'numeric' }).formatToParts(new Date(ms)))
    if (x.type !== 'literal') r[x.type] = x.value;
  return { day: `${r.year}-${r.month}-${r.day}`, minute: (Number(r.hour) % 24) * 60 + Number(r.minute), weekday: r.weekday };
};

const NAME_OK = /^[A-Z][A-Z0-9.]{0,9}$/;

export function createFieldRecorder(client: FeedClient, opts: { now?: () => number } = {}) {
  const clock = opts.now ?? Date.now;
  const watched = new Map<string, number>(); // name → last asked
  const days = new Map<string, RecordedDay>(); // name → today's record
  const known = new Map<string, number>(); // name → price
  let timer: ReturnType<typeof setInterval> | null = null;

  const fileOf = (name: string, day: string) => join(DIR, `${name}-${day}.json`);

  function prune(today: string) {
    try {
      for (const f of readdirSync(DIR)) {
        const m = /-(\d{4}-\d{2}-\d{2})\.json$/.exec(f);
        if (m && m[1] !== today) unlinkSync(join(DIR, f));
      }
    } catch {
      /* no folder yet */
    }
  }

  function dayOf(name: string, today: string): RecordedDay {
    let d = days.get(name);
    if (!d || d.day !== today) {
      d = { name, day: today, books: [] };
      try {
        const kept = JSON.parse(readFileSync(fileOf(name, today), 'utf8')) as RecordedDay;
        if (kept.day === today && Array.isArray(kept.books)) d = kept;
      } catch {
        /* nothing recorded yet today */
      }
      days.set(name, d);
    }
    return d;
  }

  async function readOne(name: string, today: string) {
    const d = dayOf(name, today);
    let price = known.get(name);
    if (price == null) {
      const first = await client.get('uw', `/api/stock/${name}/spot-exposures/strike?limit=1`);
      if (first.status !== 200) return;
      try {
        const p = Number((JSON.parse(first.body) as { data?: Row[] }).data?.[0]?.price);
        if (!(p > 0)) return;
        price = p;
      } catch {
        return;
      }
    }
    /* a window as wide as 32 strikes each side at a dollar step, or ±8% — the client keeps the 30 each side round the price */
    const half = Math.max(HALF, price * 0.08);
    const lo = Math.floor(price - half);
    const hi = Math.ceil(price + half);
    const a = await client.get('uw', `/api/stock/${name}/spot-exposures/strike?min_strike=${lo}&max_strike=${hi}`);
    if (a.status !== 200) return;
    let rows: Row[];
    try {
      rows = (JSON.parse(a.body) as { data?: Row[] }).data ?? [];
    } catch {
      return;
    }
    if (!rows.length) return;
    const p = Number(rows.find(r => r.price != null)?.price);
    if (p > 0) known.set(name, p);
    const at = rows.reduce((m, r) => Math.max(m, Date.parse(String(r.time)) || 0), 0);
    if (!at || d.books.some(b => b.at === at)) return;
    const kept = rows.map(r => Object.fromEntries(KEEP.map(k => [k, r[k]])));
    d.books.push({ at, rows: kept });
    d.books.sort((x, y) => x.at - y.at);
    try {
      mkdirSync(DIR, { recursive: true });
      writeFileSync(fileOf(name, today), JSON.stringify(d));
    } catch {
      /* a refused disk: the day lives in memory */
    }
  }

  async function tick() {
    const now = clock();
    for (const [n, at] of watched) if (now - at > IDLE_MS) watched.delete(n);
    if (!client.hasKey('uw') || !watched.size) return;
    const { day, minute, weekday } = nyParts(now);
    if (weekday === 'Sat' || weekday === 'Sun') return;
    if (minute < 9 * 60 + 30 || minute > 16 * 60) return;
    prune(day);
    /* one name after another — the proxy's gate keeps UW at three at once with the pages' own polls */
    for (const name of watched.keys()) await readOne(name, day).catch(() => undefined);
  }

  function watch(name: string) {
    if (!watched.has(name) && watched.size >= MAX_NAMES) {
      /* the name asked longest ago makes room */
      let oldest = '';
      let t = Infinity;
      for (const [n, at] of watched)
        if (at < t) {
          t = at;
          oldest = n;
        }
      watched.delete(oldest);
    }
    watched.set(name, clock());
    if (!timer) {
      prune(nyParts(clock()).day);
      timer = setInterval(() => void tick(), EVERY_MS);
      (timer as { unref?: () => void }).unref?.();
      void tick();
    }
  }

  /** GET /feed/field/<NAME>: watch the name, and the day recorded so far */
  function serve(rawName: string): { status: number; body: string } {
    const name = rawName.toUpperCase();
    if (!NAME_OK.test(name)) return { status: 400, body: JSON.stringify({ error: 'bad-name' }) };
    if (!client.hasKey('uw')) return { status: 503, body: JSON.stringify({ error: 'no-key' }) };
    watch(name);
    const today = nyParts(clock()).day;
    return { status: 200, body: JSON.stringify(dayOf(name, today)) };
  }

  return { serve, tick, watched: () => [...watched.keys()] };
}
