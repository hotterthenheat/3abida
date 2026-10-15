/*
  THE DOWNLOADER'S TOOLS (scripts/theta-history, the owner's section C, 2026-10-14): the Theta Terminal read as a stream
  with BACKPRESSURE (a chain-day is never held whole — each row is handed to an async sink that may wait on the disk),
  a gate whose width follows the clock (the recorder keeps its share of Theta's concurrent requests in market hours,
  the downloader takes the rest outside them), gzipped NDJSON writers, and the terminal's hard rules kept here: the
  host is 127.0.0.1, never localhost (Theta's 476); no terminal is ever started or signed into; format=ndjson on every
  data call; nothing is asked in Theta's own gap (00:00–01:45 New York).
*/
import { createWriteStream, mkdirSync, renameSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import { createGzip, type Gzip } from 'node:zlib';
import { THETA_BASE, THETA_STATUS, inSession, inThetaGap, nyNow, type Row } from '../theta-probe/lib';

export { THETA_BASE, compact, isoAdd, isoOf, num, occOf, quoteOf, rightOf, stampMinute, weekdayOf, nyNow, inSession, inThetaGap, daysBetween, type Row } from '../theta-probe/lib';

/* ---- the gate: as wide as the clock allows --------------------------------------------------------------------- */

/** A gate whose limit is asked each time a call waits — three in market hours (the recorder's reads keep the rest of
    Theta's eight), eight outside them; a call never starts inside Theta's gap */
export class ClockGate {
  private running = 0;
  private waiting: (() => void)[] = [];
  constructor(public readonly limitOf: () => number) {}
  get active(): number {
    return this.running;
  }
  async run<T>(fn: () => Promise<T>): Promise<T> {
    for (;;) {
      const limit = this.limitOf();
      if (this.running < limit) break;
      /* a limit of 0 (Theta's gap) is waited out on the clock; a full gate on the next call's end */
      if (limit <= 0) await new Promise<void>(r => setTimeout(r, 30_000));
      else await new Promise<void>(r => this.waiting.push(r));
    }
    this.running++;
    try {
      return await fn();
    } finally {
      this.running--;
      /* wake every waiter: the limit may have widened */
      const w = this.waiting.splice(0);
      for (const r of w) r();
    }
  }
}
/* THE RECORDER'S HOURS (the owner, 2026-10-14: "The downloader's 8 in flight outside market hours is Theta's whole
   account limit, so the recorder's pre-market reads (the 7:00 am ET OI switch) get starved. Cap it at 7 outside market
   hours, and treat 6:00 am–4:30 pm ET as recorder hours (3 in flight)"): a weekday from 06:00 to 16:30 New York — the
   recorder's chain reads from before the open's count is published to past the close's last reads. The probe keeps its
   own heavy-probe window (theta-probe/lib inSession, 09:25–16:15). */
export const RECORDER_FROM_MIN = 6 * 60;
export const RECORDER_TO_MIN = 16 * 60 + 30;
export const inRecorderHours = (minute: number, weekday: number): boolean => weekday >= 1 && weekday <= 5 && minute >= RECORDER_FROM_MIN && minute < RECORDER_TO_MIN;
export const inSessionNow = (): boolean => {
  const n = nyNow();
  return inRecorderHours(n.minute, n.weekday);
};
/** The limit by the clock: SESSION_LIMIT in the recorder's hours, FULL_LIMIT outside (7 — one of Theta's eight always
    left to the recorder); 0 inside Theta's gap (nothing starts). `at` is the New York clock to read (the proof's) */
export const limitByClock = (session: number, full: number, at: () => { minute: number; weekday: number } = nyNow) => (): number => {
  const n = at();
  if (inThetaGap(n.minute)) return 0;
  return inRecorderHours(n.minute, n.weekday) ? session : full;
};

/* ---- the stream --------------------------------------------------------------------------------------------------- */

export interface StreamAnswer {
  url: string;
  status: number | string;
  /** Theta's own name for the status (OS_LIMIT, NO_DATA, …) */
  name: string;
  /** The body of a refusal (its first 300 characters), or the stream's failure */
  error: string;
  rows: number;
  bytes: number;
  seconds: number;
  /** The first row's keys */
  keys: string[];
}

/** The exact URL — format=ndjson on every data path, none on the terminal's own */
export function thetaUrl(path: string, params: Record<string, string | number | undefined> = {}): string {
  const url = new URL(THETA_BASE + (path.startsWith('/') ? path : `/${path}`));
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
  if (!path.startsWith('/terminal/')) url.searchParams.set('format', 'ndjson');
  return url.toString();
}

/**
 * GET a Theta path, each row handed to `sink` as it arrives — the reader waits on the sink, so a row is in memory only
 * until the disk takes it. A refusal is answered with its status and text; the stream's own failure is said.
 */
export async function thetaStream(path: string, params: Record<string, string | number | undefined>, sink: (r: Row) => Promise<void> | void, opts: { timeoutMs?: number; signal?: AbortSignal } = {}): Promise<StreamAnswer> {
  const url = thetaUrl(path, params);
  const t0 = Date.now();
  const out: StreamAnswer = { url, status: 0, name: '', error: '', rows: 0, bytes: 0, seconds: 0, keys: [] };
  let res: Response;
  try {
    res = await fetch(url, { signal: opts.signal ?? AbortSignal.timeout(opts.timeoutMs ?? 60 * 60_000) });
  } catch (e) {
    const err = e as { name?: string; message?: string; cause?: { code?: string } };
    out.status = err.name === 'TimeoutError' ? 'timeout' : `no-terminal (${err.cause?.code ?? err.message ?? 'refused'})`;
    out.error = String(out.status);
    out.seconds = (Date.now() - t0) / 1000;
    return out;
  }
  out.status = res.status;
  out.name = THETA_STATUS[res.status] ?? '';
  if (res.status !== 200) {
    const text = await res.text().catch(() => '');
    out.bytes = Buffer.byteLength(text);
    out.error = `${out.name}${out.name ? ': ' : ''}${text.trim().slice(0, 300)}`;
    out.seconds = (Date.now() - t0) / 1000;
    return out;
  }
  if (!res.body) {
    out.seconds = (Date.now() - t0) / 1000;
    return out;
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  const take = async (line: string) => {
    const l = line.trim();
    if (!l) return;
    let r: Row;
    try {
      r = JSON.parse(l) as Row;
    } catch {
      if (!out.error) out.error = `a line was not JSON: ${l.slice(0, 80)}`;
      return;
    }
    if (out.rows === 0) out.keys = Object.keys(r);
    out.rows++;
    await sink(r);
  };
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      out.bytes += value.byteLength;
      buf += dec.decode(value, { stream: true });
      let i: number;
      while ((i = buf.indexOf('\n')) >= 0) {
        await take(buf.slice(0, i));
        buf = buf.slice(i + 1);
      }
    }
    await take(buf + dec.decode());
  } catch (e) {
    out.error = `the stream ended early: ${e instanceof Error ? e.message : String(e)}`;
  }
  out.seconds = (Date.now() - t0) / 1000;
  return out;
}

/** The text of a terminal path (no format) — /terminal/mdds/status */
export async function thetaText(path: string): Promise<{ url: string; status: number | string; text: string }> {
  const url = thetaUrl(path);
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    const text = await res.text().catch(() => '');
    return { url, status: res.status, text: text.trim().slice(0, 300) };
  } catch (e) {
    const err = e as { message?: string; cause?: { code?: string } };
    return { url, status: 'no-terminal', text: err.cause?.code ?? err.message ?? 'refused' };
  }
}

/* ---- gzipped NDJSON, written as the rows arrive ------------------------------------------------------------------ */

/** A gzipped NDJSON file written row by row, with backpressure; written to `<path>.part` and renamed whole at the end,
    so a run cut short never leaves a file that looks finished */
export class GzWriter {
  private gz: Gzip;
  private done: Promise<void>;
  private failed: Error | null = null;
  rows = 0;
  bytes = 0;
  constructor(private readonly path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.gz = createGzip({ level: 6 });
    const out = createWriteStream(`${path}.part`);
    this.gz.pipe(out);
    this.done = new Promise<void>((resolve, reject) => {
      out.on('finish', resolve);
      out.on('error', e => {
        this.failed = e;
        reject(e);
      });
      this.gz.on('error', e => {
        this.failed = e;
        reject(e);
      });
    });
  }
  async write(row: Row): Promise<void> {
    if (this.failed) throw this.failed;
    const line = JSON.stringify(row) + '\n';
    this.rows++;
    this.bytes += line.length;
    if (!this.gz.write(line)) await new Promise<void>(r => this.gz.once('drain', r));
  }
  /** Finish and rename into place; `keep` false removes the part (a refused call writes nothing) */
  async close(keep = true): Promise<void> {
    this.gz.end();
    await this.done.catch(() => undefined);
    if (keep && !this.failed) renameSync(`${this.path}.part`, this.path);
    else rmSync(`${this.path}.part`, { force: true });
  }
}

/** Bytes as the report prints them */
export const fmtBytes = (b: number): string => (b >= 1e9 ? `${(b / 1e9).toFixed(2)} GB` : b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : b >= 1e3 ? `${(b / 1e3).toFixed(0)} KB` : `${b} B`);
