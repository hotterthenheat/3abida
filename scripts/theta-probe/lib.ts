/*
  THE PROBE'S TOOLS (scripts/theta-probe — the owner's Phase 0, 2026-10-14): the Theta Terminal's and Unusual Whales'
  answers read as streams and measured — status, error text, rows, bytes, seconds, the first and last date in them — a
  gate of six calls in flight (the owner's rule 3: "Backfill semaphore max 6 in flight; never queue beyond 16"), New
  York's clock, the house's pricer inverted, and the report's rows.

  Hard rules kept here: every data call carries format=ndjson (rule 7); the host is 127.0.0.1, never localhost (rule 2);
  no terminal is ever started (rule 1); a key never reaches the report (UW's token is scrubbed from every text).
*/
import { existsSync, readFileSync } from 'node:fs';
import { blackScholesPrice } from '../../src/core/greeks';
import { nyParts, nyWallTime } from '../../src/core/nyTime';
import { UW_VOL_CONVENTION } from '../../src/data/feed/trailModel';

/* ---- the environment --------------------------------------------------------------------------------------------- */

export function parseEnv(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || line.trim().startsWith('#')) continue;
    out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}
export const env: Record<string, string | undefined> = { ...parseEnv('.env'), ...process.env };

/** The terminal, this machine alone — 127.0.0.1, never localhost (Theta's 476 WRONG_IP) */
export const THETA_BASE = (env.THETA_PROBE_BASE ?? 'http://127.0.0.1:25503/v3').replace(/\/+$/, '').replace('localhost', '127.0.0.1');
export const UW_BASE = 'https://api.unusualwhales.com';
export const UW_TOKEN = env.UW_API_TOKEN || '';

/** A text with the key taken out — the report never carries one */
export const scrub = (text: string): string => (UW_TOKEN && UW_TOKEN.length >= 4 ? text.split(UW_TOKEN).join('[key]') : text);

/* ---- the gate: six in flight ------------------------------------------------------------------------------------- */

export class Gate {
  private running = 0;
  private waiting: (() => void)[] = [];
  constructor(private readonly limit: number) {}
  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.running >= this.limit) await new Promise<void>(r => this.waiting.push(r));
    this.running++;
    try {
      return await fn();
    } finally {
      this.running--;
      this.waiting.shift()?.();
    }
  }
}
export const gate = new Gate(6);

/* ---- the report's rows ------------------------------------------------------------------------------------------- */

export interface ProbeRow {
  id: string;
  url: string;
  status: number | string;
  error: string;
  rows: number | string;
  bytes: number | string;
  seconds: number | string;
  first: string;
  last: string;
  conclusion: string;
}
export const report: ProbeRow[] = [];
export const notes: { id: string; text: string }[] = [];
export const findings: Record<string, string> = {};
export const log: string[] = [];

export function say(line: string): void {
  const stamp = new Date().toISOString().slice(11, 19);
  log.push(`${stamp} ${line}`);
  console.log(`${stamp} ${scrub(line)}`);
}
export function note(id: string, text: string): void {
  notes.push({ id, text: scrub(text) });
  say(`${id}: ${text}`);
}
export function row(r: ProbeRow): void {
  report.push({ ...r, url: scrub(r.url), error: scrub(r.error), conclusion: scrub(r.conclusion) });
  say(`${r.id} ${r.status} ${typeof r.rows === 'number' ? `${r.rows} rows` : r.rows} ${typeof r.bytes === 'number' ? fmtBytes(r.bytes) : r.bytes} ${typeof r.seconds === 'number' ? `${r.seconds.toFixed(1)} s` : r.seconds} — ${r.conclusion}`);
}
export const fmtBytes = (b: number): string => (b >= 1e9 ? `${(b / 1e9).toFixed(2)} GB` : b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : b >= 1e3 ? `${(b / 1e3).toFixed(0)} KB` : `${b} B`);

/* ---- Theta, read as a stream ------------------------------------------------------------------------------------- */

export type Row = Record<string, unknown>;
export interface ThetaAnswer {
  url: string;
  status: number | string;
  /** The body of a refusal (its first 300 characters), or the stream's failure */
  error: string;
  /** Rows the stream carried (every row counted, kept only while `keep`) */
  count: number;
  rows: Row[];
  bytes: number;
  seconds: number;
  /** The first row's keys */
  keys: string[];
  first: string;
  last: string;
  /** Read to the end, or cut at maxRows/maxBytes */
  cut: boolean;
  /** Theta's status names */
  name: string;
}
export const THETA_STATUS: Record<number, string> = { 200: 'OK', 404: 'NO_IMPL', 429: 'OS_LIMIT', 470: 'GENERAL', 471: 'PERMISSION', 472: 'NO_DATA', 473: 'INVALID_PARAMS', 474: 'DISCONNECTED', 475: 'TERMINAL_PARSE', 476: 'WRONG_IP', 477: 'NO_PAGE_FOUND', 478: 'INVALID_SESSION_ID', 570: 'LARGE_REQUEST', 571: 'SERVER_STARTING', 572: 'UNCAUGHT_ERROR' };

const DATE_KEYS = ['timestamp', 'created', 'date', 'expiration', 'last_trade'];
/** A row's date or stamp, for the report's first/last */
export function stampOf(r: Row): string | null {
  for (const k of DATE_KEYS) {
    const v = r[k];
    if (typeof v === 'string' && v.length >= 8) return v;
    if (typeof v === 'number' && v > 19000000 && v < 21000000) return String(v);
  }
  return null;
}

/** The exact URL a probe asks — format=ndjson on every data path (rule 7), none on the terminal's own paths */
export function thetaUrl(path: string, params: Record<string, string | number | undefined> = {}): string {
  const url = new URL(THETA_BASE + (path.startsWith('/') ? path : `/${path}`));
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
  if (!path.startsWith('/terminal/')) url.searchParams.set('format', 'ndjson');
  return url.toString();
}

export interface ThetaOpts {
  /** Called a row at a time while the body streams (a chain-day is never kept whole) */
  onRow?: (r: Row) => void;
  /** Keep the rows (default true up to `keepMax`) */
  keep?: boolean;
  keepMax?: number;
  /** Stop reading at this many rows (an entitlement or shape check needs no more) */
  maxRows?: number;
  maxBytes?: number;
  timeoutMs?: number;
  /** Outside the gate (T10's bursts are the owner's test of the limit) */
  ungated?: boolean;
}

/** GET a Theta path: the stream read line by line, each line a JSON row */
export async function theta(path: string, params: Record<string, string | number | undefined> = {}, opts: ThetaOpts = {}): Promise<ThetaAnswer> {
  const url = thetaUrl(path, params);
  const t0 = Date.now();
  const out: ThetaAnswer = { url, status: 0, error: '', count: 0, rows: [], bytes: 0, seconds: 0, keys: [], first: '', last: '', cut: false, name: '' };
  const keep = opts.keep ?? true;
  const keepMax = opts.keepMax ?? 500_000;
  const go = async () => {
    let res: Response;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(opts.timeoutMs ?? 30 * 60_000) });
    } catch (e) {
      const err = e as { name?: string; message?: string; cause?: { code?: string } };
      out.status = err.name === 'TimeoutError' ? 'timeout' : `no-terminal (${err.cause?.code ?? err.message ?? 'refused'})`;
      out.error = out.status as string;
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
    const take = (line: string) => {
      const l = line.trim();
      if (!l) return;
      let r: Row;
      try {
        r = JSON.parse(l) as Row;
      } catch {
        if (!out.error) out.error = `a line was not JSON: ${l.slice(0, 80)}`;
        return;
      }
      if (out.count === 0) out.keys = Object.keys(r);
      out.count++;
      const st = stampOf(r);
      if (st) {
        if (!out.first || st < out.first) out.first = st;
        if (!out.last || st > out.last) out.last = st;
      }
      opts.onRow?.(r);
      if (keep && out.rows.length < keepMax) out.rows.push(r);
    };
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        out.bytes += value.byteLength;
        buf += dec.decode(value, { stream: true });
        let i: number;
        while ((i = buf.indexOf('\n')) >= 0) {
          take(buf.slice(0, i));
          buf = buf.slice(i + 1);
        }
        if ((opts.maxRows && out.count >= opts.maxRows) || (opts.maxBytes && out.bytes >= opts.maxBytes)) {
          out.cut = true;
          await reader.cancel().catch(() => undefined);
          break;
        }
      }
      if (!out.cut) take(buf + dec.decode());
    } catch (e) {
      out.error = `the stream ended early: ${e instanceof Error ? e.message : String(e)}`;
    }
    out.seconds = (Date.now() - t0) / 1000;
    return out;
  };
  return opts.ungated ? go() : gate.run(go);
}

/** The text of a terminal path (no format) — /terminal/mdds/status */
export async function thetaText(path: string): Promise<{ url: string; status: number | string; text: string; seconds: number }> {
  const url = thetaUrl(path);
  const t0 = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    const text = await res.text().catch(() => '');
    return { url, status: res.status, text: text.trim().slice(0, 300), seconds: (Date.now() - t0) / 1000 };
  } catch (e) {
    const err = e as { message?: string; cause?: { code?: string } };
    return { url, status: 'no-terminal', text: err.cause?.code ?? err.message ?? 'refused', seconds: (Date.now() - t0) / 1000 };
  }
}

/* ---- Unusual Whales, with its headers ---------------------------------------------------------------------------- */

export interface UwAnswer {
  url: string;
  status: number | string;
  headers: Record<string, string>;
  /** The JSON body, or null */
  json: unknown;
  /** The body as text, scrubbed, its first 600 characters */
  text: string;
  bytes: number;
  seconds: number;
}
/** GET a UW path with the Bearer header; every x-uw-* header, x-request-id and retry-after kept (the owner asked) */
export async function uw(path: string, opts: { accept?: string; timeoutMs?: number } = {}): Promise<UwAnswer> {
  const url = UW_BASE + path;
  const t0 = Date.now();
  const headers: Record<string, string> = { Authorization: `Bearer ${UW_TOKEN}` };
  if (opts.accept) headers.Accept = opts.accept;
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(opts.timeoutMs ?? 60_000) });
    const kept: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      const lk = k.toLowerCase();
      if (lk.startsWith('x-uw') || lk === 'x-request-id' || lk === 'retry-after' || lk === 'content-type') kept[lk] = v;
    });
    const text = await res.text().catch(() => '');
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    return { url, status: res.status, headers: kept, json, text: scrub(text.slice(0, 600)), bytes: Buffer.byteLength(text), seconds: (Date.now() - t0) / 1000 };
  } catch (e) {
    const err = e as { name?: string; message?: string };
    return { url, status: err.name === 'TimeoutError' ? 'timeout' : `network (${err.message ?? '?'})`, headers: {}, json: null, text: '', bytes: 0, seconds: (Date.now() - t0) / 1000 };
  }
}

/* ---- dates and the clock ----------------------------------------------------------------------------------------- */

/** "2026-10-13" → "20261013" */
export const compact = (iso: string): string => iso.replace(/-/g, '');
/** "20261013" → "2026-10-13" (an ISO date passes through) */
export const isoOf = (d: string): string => (/^\d{8}$/.test(d) ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : d.slice(0, 10));
export const isoAdd = (iso: string, days: number): string => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};
export const weekdayOf = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};
/** Calendar days from a to b (ISO) */
export const daysBetween = (a: string, b: string): number => Math.round((Date.UTC(Number(b.slice(0, 4)), Number(b.slice(5, 7)) - 1, Number(b.slice(8, 10))) - Date.UTC(Number(a.slice(0, 4)), Number(a.slice(5, 7)) - 1, Number(a.slice(8, 10)))) / 86_400_000);

/** New York now: the date, the minute of the day, the weekday */
export function nyNow(): { iso: string; minute: number; weekday: number; text: string } {
  const p = nyParts(Date.now());
  const iso = `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
  return { iso, minute: p.hour * 60 + p.minute, weekday: p.weekday, text: `${iso} ${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')} New York` };
}
/** Theta's own gap: "Data from the previous day isn't available from 00:00 ET to 01:45 ET" (rule 6) */
export const inThetaGap = (minute: number): boolean => minute < 60 + 45;
/** A weekday between 09:25 and 16:15 New York — no heavy probe then (rule 8) */
export const inSession = (minute: number, weekday: number): boolean => weekday >= 1 && weekday <= 5 && minute >= 9 * 60 + 25 && minute <= 16 * 60 + 15;
/** The cash session itself, for the real-time check */
export const inCash = (minute: number, weekday: number): boolean => weekday >= 1 && weekday <= 5 && minute >= 9 * 60 + 30 && minute < 16 * 60;

/* New York's wall clock to an instant (data/feed/theta.ts nyStampMs, kept here so the probe imports no browser code):
   the offset a date has at noon holds from 04:00 to 20:00 */
const noonOffset = new Map<string, number>();
export function nyStampMs(stamp: string): number {
  const d = stamp.slice(0, 10);
  let off = noonOffset.get(d);
  const [y, m, da] = d.split('-').map(Number);
  if (off === undefined) {
    off = nyWallTime(y, m, da, 12, 0) - Date.UTC(y, m - 1, da, 12, 0);
    noonOffset.set(d, off);
  }
  const h = Number(stamp.slice(11, 13)) || 0;
  const mi = Number(stamp.slice(14, 16)) || 0;
  const s = Number(stamp.slice(17, 23)) || 0;
  return Date.UTC(y, m - 1, da, h, mi) + Math.round(s * 1000) + off;
}
/** The minute of New York's day a stamp names ("2026-10-13T09:31:00.000" → 571) */
export const stampMinute = (stamp: string): number => (Number(stamp.slice(11, 13)) || 0) * 60 + (Number(stamp.slice(14, 16)) || 0);
export const hhmm = (minute: number): string => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;

/* ---- numbers ----------------------------------------------------------------------------------------------------- */

export const num = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};
export const med = (a: readonly number[]): number => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? s[Math.floor(s.length / 2)] : NaN;
};
export const pct = (a: readonly number[], p: number): number => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : NaN;
};
export const f = (x: number, d = 2): string => (Number.isFinite(x) ? x.toFixed(d) : 'n/a');

/** The vol that prices `price` for the leg at spot S, strike K, `tau` years, under the house's UW convention (r 4.15%,
    q 0 — the clock and carry UW's vols are solved on, trailModel UW_VOL_CONVENTION); NaN under intrinsic or above 500% */
export function impliedVolOf(price: number, S: number, K: number, tau: number, right: 'C' | 'P'): number {
  if (!(price > 0) || !(S > 0) || !(K > 0) || !(tau > 0)) return NaN;
  const px = (v: number) => blackScholesPrice(S, K, tau, v, right, UW_VOL_CONVENTION.r, UW_VOL_CONVENTION.q);
  let lo = 0.001;
  let hi = 5;
  if (px(lo) > price || px(hi) < price) return NaN;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (px(mid) < price) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** An OCC symbol from Theta's contract fields: root, "2026-10-17", CALL|PUT|C|P|call|put, 660 → SPY261017C00660000 */
export function occOf(root: string, expiration: string, right: string, strike: number): string {
  const e = isoOf(expiration);
  const r = right.toUpperCase().startsWith('C') ? 'C' : 'P';
  return `${root}${e.slice(2, 4)}${e.slice(5, 7)}${e.slice(8, 10)}${r}${String(Math.round(strike * 1000)).padStart(8, '0')}`;
}
/** A Theta row's bid and ask, by the keys it carries (bid/ask, or bid_price/ask_price) */
export function quoteOf(r: Row): { bid: number | null; ask: number | null } {
  return { bid: num(r.bid ?? r.bid_price), ask: num(r.ask ?? r.ask_price) };
}
export const midOf = (r: Row): number | null => {
  const { bid, ask } = quoteOf(r);
  return bid != null && ask != null && bid > 0 && ask > 0 && ask >= bid ? (bid + ask) / 2 : null;
};
/** A Theta row's right as C or P */
export const rightOf = (r: Row): 'C' | 'P' | null => (typeof r.right === 'string' ? (r.right.toUpperCase().startsWith('C') ? 'C' : r.right.toUpperCase().startsWith('P') ? 'P' : null) : null);
