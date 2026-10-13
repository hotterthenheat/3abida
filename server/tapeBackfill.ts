/*
==================================================
  SLAYER TERMINAL - THE TAPE'S DAY (server/tapeBackfill.ts)

  ONE DAY'S FULL OPTION TAPE, STREAMED ONCE FOR EVERY
  NAME (2026-10-13 — the owner: "Backfill 2024-01-03 →
  2025-03-31 for SPY and QQQ from the tape (per contract-
  minute: last print's IV and underlying price, knowable
  at the print's time), and label those sessions 'tape
  vols'"). UW's per-contract minute vols reach back to
  about 2025-04-01; before that the day's tape is the
  only per-print record on the plan: GET /api/option-
  trades/full-tape/{date} answers a 302 to a signed link
  (120 s), a zip of one CSV — 0.7 to 1.9 GB a day, nine
  million prints — with, on every print, the contract,
  the moment, the vol, the underlying's price and a
  `canceled` flag.

  THE STREAM IS NEVER WRITTEN TO DISK: the zip's local
  header is skipped, the deflate stream inflated as it
  comes, each line parsed (the tags field is quoted and
  holds commas) and only the wanted names kept — a
  canceled print dropped. What is kept, per name:
    · per contract and minute, the lowest and highest
      print vol — the SAME shape UW's /intraday answers
      (iv_low, iv_high), so server/fieldBackfill.ts
      compresses the minute's midpoint exactly as it
      does the minute-vol sessions (the tape's midpoint
      equals /intraday's to 0.00001 — measured on
      2026-10-12, three busy SPY contracts, 405 minutes
      each). The session built from it says `vols:
      'tape'`.
    · for an index (SPX with SPXW's prints, NDX with
      NDXP's …), the underlying price a minute off the
      prints — first, highest, lowest, last, how many —
      the one per-minute index level on this plan (UW's
      own series rounds SPX to 5 points; the tape's
      matches SPY's bar closes to the cent). Kept as
      .feed-cache/field/<INDEX>/<day>/tape-price.json.
==================================================
*/

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Readable, Transform, pipeline } from 'node:stream';
import { createInflateRaw } from 'node:zlib';
import { createInterface } from 'node:readline';
import type { FeedClient } from './feed';

const ROOT = join(process.cwd(), '.feed-cache', 'field');
/** The archive's link lives 120 s; a day streams in about a minute here */
const STREAM_TIMEOUT_MS = 30 * 60_000;

/** A minute of a contract's prints, in /intraday's shape */
export interface TapeRow {
  start_time: string;
  iv_low: string;
  iv_high: string;
}
/** [minute's start (ms), first, highest, lowest, last underlying price, prints] */
export type TapePriceBar = [number, number, number, number, number, number];
export interface TapeDay {
  day: string;
  /** Per name, per contract (OCC symbol), its minutes */
  contracts: Record<string, Record<string, TapeRow[]>>;
  /** Per index, the underlying price a minute off its prints */
  prices: Record<string, TapePriceBar[]>;
  prints: number;
  kept: number;
  canceled: number;
  bytes: number;
  seconds: number;
}
export type TapeReader = (day: string, names: string[]) => Promise<TapeDay | null>;

/** An index's weekly root reads as the index */
export const INDEX_ROOTS: Record<string, string> = { SPXW: 'SPX', NDXP: 'NDX', RUTW: 'RUT', VIXW: 'VIX' };
const INDICES = new Set(['SPX', 'NDX', 'RUT', 'VIX']);

/** One CSV line into fields — a quoted field may hold commas (the tags: "{bid_side,bullish}") */
export function csvFields(line: string): string[] {
  if (!line.includes('"')) return line.split(',');
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out;
}

/** The zip's first entry, raw: the local file header skipped, the deflate stream passed on */
function entryBody(): Transform {
  let head: Buffer | null = Buffer.alloc(0);
  return new Transform({
    transform(chunk: Buffer, _enc, cb) {
      if (head === null) return cb(null, chunk);
      head = Buffer.concat([head, chunk]);
      if (head.length < 30) return cb();
      if (head.readUInt32LE(0) !== 0x04034b50) return cb(new Error('not a zip'));
      const method = head.readUInt16LE(8);
      if (method !== 8 && method !== 0) return cb(new Error(`zip method ${method}`));
      const skip = 30 + head.readUInt16LE(26) + head.readUInt16LE(28);
      if (head.length < skip) return cb();
      const rest = head.subarray(skip);
      head = null;
      cb(null, rest);
    },
  });
}

/** The minute a print's `executed_at` ("2026-10-12 13:30:00.003702+00", UTC) falls in, epoch ms */
const minuteOf = (executedAt: string): number => Date.parse(`${executedAt.slice(0, 10)}T${executedAt.slice(11, 16)}:00Z`);

export function tapeReader(client: FeedClient, opts: { root?: string; log?: (line: string) => void } = {}): TapeReader {
  const root = opts.root ?? ROOT;
  return async function readTape(day: string, names: string[]): Promise<TapeDay | null> {
    const t0 = Date.now();
    const r = await client.redirectOf('uw', `/api/option-trades/full-tape/${day}`);
    if (!r.location) {
      opts.log?.(`tape ${day}: no archive (${r.status})`);
      return null;
    }
    let res: Response;
    try {
      res = await fetch(r.location, { signal: AbortSignal.timeout(STREAM_TIMEOUT_MS) });
    } catch {
      return null;
    }
    if (!res.ok || !res.body) return null;
    const wanted = new Set(names.map(n => n.toUpperCase()));
    /* every index root the tape may carry for a wanted index */
    for (const [weekly, index] of Object.entries(INDEX_ROOTS)) if (wanted.has(index)) wanted.add(weekly);
    const byMinute: Record<string, Map<string, { lo: number; hi: number }>> = {};
    const prices: Record<string, Map<number, TapePriceBar>> = {};
    let ix: Record<string, number> | null = null;
    let prints = 0;
    let kept = 0;
    let canceled = 0;
    let bytes = 0;
    const counting = new Transform({
      transform(chunk: Buffer, _enc, cb) {
        bytes += chunk.length;
        cb(null, chunk);
      },
    });
    /* one pipeline, so a download cut short (a reset socket, a timeout) ends the lines with an error caught below
       and never an unhandled one — the always-on recorder must outlive a dropped stream */
    const inflated = createInflateRaw();
    let streamError: Error | null = null;
    pipeline(Readable.fromWeb(res.body as unknown as import('node:stream/web').ReadableStream), counting, entryBody(), inflated, err => {
      if (err) streamError = err instanceof Error ? err : new Error(String(err));
    });
    const lines = createInterface({ input: inflated, crlfDelay: Infinity });
    try {
      for await (const line of lines) {
        if (!ix) {
          const cols = line.split(',');
          ix = Object.fromEntries(cols.map((c, i) => [c, i]));
          for (const need of ['underlying_symbol', 'executed_at', 'option_chain_id', 'implied_volatility', 'underlying_price', 'canceled']) if (!(need in ix)) throw new Error(`tape without ${need}`);
          continue;
        }
        prints++;
        /* the name is the second field: a cheap look before the full parse */
        const c1 = line.indexOf(',');
        const c2 = line.indexOf(',', c1 + 1);
        if (c1 < 0 || c2 < 0) continue;
        const name = line.slice(c1 + 1, c2);
        if (!wanted.has(name)) continue;
        const f = csvFields(line);
        if (f[ix.canceled] === 't') {
          canceled++;
          continue;
        }
        const m = minuteOf(f[ix.executed_at]);
        if (!Number.isFinite(m)) continue;
        kept++;
        const index = INDEX_ROOTS[name] ?? (INDICES.has(name) ? name : null);
        const up = Number(f[ix.underlying_price]);
        if (index && Number.isFinite(up) && up > 0) {
          const bars = (prices[index] ??= new Map());
          const bar = bars.get(m);
          if (!bar) bars.set(m, [m, up, up, up, up, 1]);
          else {
            if (up > bar[2]) bar[2] = up;
            if (up < bar[3]) bar[3] = up;
            bar[4] = up;
            bar[5]++;
          }
        }
        if (index) continue;
        const iv = Number(f[ix.implied_volatility]);
        if (!Number.isFinite(iv) || !(iv > 0)) continue;
        const sym = f[ix.option_chain_id];
        const key = `${sym}|${m}`;
        const mm = (byMinute[name] ??= new Map());
        const cur = mm.get(key);
        if (!cur) mm.set(key, { lo: iv, hi: iv });
        else {
          if (iv < cur.lo) cur.lo = iv;
          if (iv > cur.hi) cur.hi = iv;
        }
      }
    } catch (e) {
      /* a stream cut short: the day is not built from a part of its tape */
      opts.log?.(`tape ${day}: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    }
    if (streamError) {
      opts.log?.(`tape ${day}: the stream ended early (${(streamError as Error).message})`);
      return null;
    }
    /* the minutes into /intraday's shape, a contract at a time */
    const out: TapeDay = { day, contracts: {}, prices: {}, prints, kept, canceled, bytes, seconds: (Date.now() - t0) / 1000 };
    for (const [name, mm] of Object.entries(byMinute)) {
      const per: Record<string, TapeRow[]> = {};
      for (const [key, v] of mm) {
        const i = key.lastIndexOf('|');
        (per[key.slice(0, i)] ??= []).push({ start_time: new Date(Number(key.slice(i + 1))).toISOString(), iv_low: String(v.lo), iv_high: String(v.hi) });
      }
      for (const rows of Object.values(per)) rows.sort((a, b) => a.start_time.localeCompare(b.start_time));
      out.contracts[name] = per;
    }
    for (const [index, bars] of Object.entries(prices)) {
      const list = [...bars.values()].sort((a, b) => a[0] - b[0]);
      out.prices[index] = list;
      try {
        mkdirSync(join(root, index, day), { recursive: true });
        writeFileSync(join(root, index, day, 'tape-price.json'), JSON.stringify({ day, index, source: 'the full tape, each print’s underlying price', bars: list }));
      } catch {
        /* a refused disk: the series rides in the answer alone */
      }
    }
    opts.log?.(`tape ${day}: ${(bytes / 1e6).toFixed(0)} MB, ${prints} prints, ${kept} kept, ${canceled} canceled, ${out.seconds.toFixed(0)} s`);
    return out;
  };
}
