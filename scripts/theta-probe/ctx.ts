/*
  THE PROBE'S CONTEXT: what one probe learns and the next reads — the dates the terminal lists (rule 4: "Never
  hard-code start dates from docs. Use only dates the probes return"), the expirations and contracts a root has, the
  SOFR series T2 read, the tape's SPX minutes a UW pass harvested — each list asked once.
*/
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { compact, isoOf, nyStampMs, num, rightOf, say, stampMinute, theta, type Row, type ThetaAnswer } from './lib';

export interface Contract {
  symbol: string;
  expiration: string;
  strike: number;
  right: 'C' | 'P';
}
export interface Ctx {
  today: string;
  /** .feed-cache/field */
  root: string;
  /** The newest SPY trading date before today, and the busiest of the last ten by Theta's EOD volume */
  recent: string | null;
  recentBusy: string | null;
  /** The newest session dates before today, newest first (the calendar: QQQ's trade dates, else SPY's) */
  calendar: string[];
  /** Per root, the first trading date in 2013 its list holds, or null */
  day2013: Record<string, string | null>;
  /** SOFR by date (T2), when the plan answers it */
  sofr: Map<string, number> | null;
  /** The tape's SPX underlying a minute, by day: minute start (ms) → the last print's underlying price */
  tapeSpx: Record<string, Map<number, number>>;
  /** Heavy probes not run, and why */
  skipped: string[];
  heavyOk: boolean;
  liveOk: boolean;
  /** How many full-tape days X1 may still download */
  tapeDownloads: number;
  /** The probes asked for (empty: all) */
  only: Set<string>;
  caches: {
    dates: Map<string, Promise<{ dates: string[]; answer: ThetaAnswer }>>;
    expirations: Map<string, Promise<{ expirations: string[]; answer: ThetaAnswer }>>;
    contracts: Map<string, Promise<{ contracts: Contract[]; answer: ThetaAnswer }>>;
  };
}

export function makeCtx(today: string, only: Set<string>): Ctx {
  return { today, root: join(process.cwd(), '.feed-cache', 'field'), recent: null, recentBusy: null, calendar: [], day2013: {}, sofr: null, tapeSpx: {}, skipped: [], heavyOk: true, liveOk: false, tapeDownloads: 2, only, caches: { dates: new Map(), expirations: new Map(), contracts: new Map() } };
}

/** A row's date field as ISO */
const dateOf = (r: Row): string | null => {
  for (const k of ['date', 'created', 'timestamp']) {
    const v = r[k];
    if (typeof v === 'string' && v.length >= 8) return isoOf(v);
    if (typeof v === 'number' && v > 19000000) return isoOf(String(v));
  }
  for (const v of Object.values(r)) if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  return null;
};

/** The dates a symbol has data: GET /stock/list/dates/{trade|quote}?symbol= or /index/list/dates?symbol= — asked once */
export function datesOf(ctx: Ctx, kind: 'stock' | 'index', symbol: string, type: 'trade' | 'quote' = 'trade'): Promise<{ dates: string[]; answer: ThetaAnswer }> {
  const key = `${kind}:${symbol}:${type}`;
  let p = ctx.caches.dates.get(key);
  if (!p) {
    p = (async () => {
      const answer = await theta(kind === 'stock' ? `/stock/list/dates/${type}` : '/index/list/dates', { symbol }, { keepMax: 20_000 });
      const dates = [...new Set(answer.rows.map(dateOf).filter((d): d is string => !!d))].sort();
      return { dates, answer };
    })();
    ctx.caches.dates.set(key, p);
  }
  return p;
}

/** Every expiration a root ever listed: GET /option/list/expirations?symbol= — asked once */
export function expirationsOf(ctx: Ctx, root: string): Promise<{ expirations: string[]; answer: ThetaAnswer }> {
  let p = ctx.caches.expirations.get(root);
  if (!p) {
    p = (async () => {
      const answer = await theta('/option/list/expirations', { symbol: root }, { keepMax: 20_000 });
      const expirations = [...new Set(answer.rows.map(r => (typeof r.expiration === 'string' ? isoOf(r.expiration) : typeof r.expiration === 'number' ? isoOf(String(r.expiration)) : null)).filter((d): d is string => !!d))].sort();
      return { expirations, answer };
    })();
    ctx.caches.expirations.set(root, p);
  }
  return p;
}
/** The smallest expiration at or after a date, else null */
export async function nextExpiration(ctx: Ctx, root: string, dateIso: string): Promise<string | null> {
  const { expirations } = await expirationsOf(ctx, root);
  return expirations.find(e => e >= dateIso) ?? null;
}

/** The contracts that quoted on a date: GET /option/list/contracts/quote?date&symbol — asked once a (symbols, date) */
export function contractsOn(ctx: Ctx, symbols: string, dateIso: string): Promise<{ contracts: Contract[]; answer: ThetaAnswer }> {
  const key = `${symbols}:${dateIso}`;
  let p = ctx.caches.contracts.get(key);
  if (!p) {
    p = (async () => {
      const answer = await theta('/option/list/contracts/quote', { date: compact(dateIso), symbol: symbols }, { keepMax: 400_000 });
      const contracts: Contract[] = [];
      for (const r of answer.rows) {
        const strike = num(r.strike);
        const right = rightOf(r);
        if (typeof r.symbol !== 'string' || strike == null || !right) continue;
        const exp = typeof r.expiration === 'string' ? isoOf(r.expiration) : typeof r.expiration === 'number' ? isoOf(String(r.expiration)) : null;
        if (!exp) continue;
        contracts.push({ symbol: r.symbol, expiration: exp, strike, right });
      }
      return { contracts, answer };
    })();
    ctx.caches.contracts.set(key, p);
  }
  return p;
}

/** A stock's one-minute bars on a date, the consolidated tape: minute of New York's day → the bar */
export async function stockMinutes(symbol: string, dateIso: string, venue: 'utp_cta' | 'nqb' = 'utp_cta'): Promise<{ bars: Map<number, { open: number; high: number; low: number; close: number; volume: number }>; answer: ThetaAnswer }> {
  const answer = await theta('/stock/history/ohlc', { symbol, date: compact(dateIso), interval: '1m', venue, start_time: '09:30:00', end_time: '16:00:00' }, { keepMax: 2000 });
  const bars = new Map<number, { open: number; high: number; low: number; close: number; volume: number }>();
  for (const r of answer.rows) {
    const o = num(r.open);
    const h = num(r.high);
    const l = num(r.low);
    const c = num(r.close);
    if (typeof r.timestamp !== 'string' || !(o! > 0 && h! > 0 && l! > 0 && c! > 0)) continue;
    bars.set(stampMinute(r.timestamp), { open: o!, high: h!, low: l!, close: c!, volume: num(r.volume) ?? 0 });
  }
  return { bars, answer };
}

/** An index's price a minute on a date (/index/history/price, 1m): Theta omits an unchanged price, so the minutes
    between rows are carried forward — minute of New York's day → the price standing at that minute's start */
export async function indexMinutes(symbol: string, dateIso: string, from = 9 * 60 + 30, to = 16 * 60): Promise<{ prices: Map<number, number>; raw: number; answer: ThetaAnswer }> {
  const answer = await theta('/index/history/price', { symbol, date: compact(dateIso), interval: '1m', start_time: '09:30:00', end_time: '16:00:00' }, { keepMax: 2000 });
  const at = new Map<number, number>();
  for (const r of answer.rows) {
    const p = num(r.price);
    if (typeof r.timestamp !== 'string' || p == null || !(p > 0)) continue;
    at.set(stampMinute(r.timestamp), p);
  }
  const prices = new Map<number, number>();
  let last: number | null = null;
  for (let m = from; m <= to; m++) {
    const p = at.get(m);
    if (p != null) last = p;
    if (last != null) prices.set(m, last);
  }
  return { prices, raw: at.size, answer };
}

/* ---- what this machine already holds (the UW rebuild, the store, the tape's SPX minutes) --------------------------- */

export function rebuiltSessions(root: string, name: string): string[] {
  const dir = join(root, name);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d) && existsSync(join(dir, d, 'past.json.gz')) && existsSync(join(dir, d, 'bars.json.gz')))
    .sort();
}
export function readGz<T>(path: string): T {
  return JSON.parse(gunzipSync(readFileSync(path)).toString('utf8')) as T;
}
/** The tape's SPX minutes kept by the backfill (tape-price.json): minute start (ms) → the last print's underlying */
export function tapePriceFile(root: string, index: string, day: string): Map<number, number> | null {
  const file = join(root, index, day, 'tape-price.json');
  if (!existsSync(file)) return null;
  try {
    const j = JSON.parse(readFileSync(file, 'utf8')) as { bars: [number, number, number, number, number, number][] };
    return new Map(j.bars.map(b => [b[0], b[4]]));
  } catch {
    return null;
  }
}
/** The minute (ms) of a Theta stamp on a date */
export const stampMs = (stamp: string): number => nyStampMs(stamp);

export const sayDates = (label: string, dates: string[]) => say(`${label}: ${dates.length} dates${dates.length ? `, ${dates[0]} to ${dates[dates.length - 1]}` : ''}`);
