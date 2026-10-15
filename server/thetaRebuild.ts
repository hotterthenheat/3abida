/*
==================================================
  SLAYER TERMINAL - THE REBUILD FROM THETA'S HISTORY
  (server/thetaRebuild.ts)

  2026-10-14 — the owner, section C3: "Rebuild newest
  first, using the probe's answers on 4a and 4b.
  Store per minute beside the field: spread,
  top-of-book size, minute volume, VIX, ATM IV. Where
  a live-recorded day exists, the rebuild must match
  it (same tolerance as before) before older days
  are trusted."

  The downloader (scripts/theta-history) keeps raw
  rows; this module turns one session's rows into the
  model's inputs — THE SAME MODEL as the live field
  and UW's rebuild (data/feed/trailModel.ts) — and
  the store's final rows (server/fieldStore.ts
  rowsOf):
    · open interest: the day's per-contract count
      (chain-oi), under the index for an index's
      weekly root (SPXW → SPX);
    · vols: each contract's quote a minute (the
      chain's quote files, an expiration at a time),
      its mid inverted to a vol on the day's own rate
      and the model's clock — the quote clock (4b) a
      parameter: a row stamped T holds the interval's
      last quote, knowable at T + 1 m (the default),
      or the quote standing at T;
    · the underlying a minute: the stock's bars; an
      index's Theta price series, or the tape's
      per-print underlying (4a, a parameter);
    · the seed: the session before's close, its last
      minute's quotes inverted the same way;
    · UW's whole-book series where the series job
      kept it (series.json), so the residual stands;
    · the rate: the day's DTB3-derived r (RATES files,
      r = −ln(1 − d·91/360) × 365/91, d = DTB3 ÷ 100),
      Theta's TREASURY_M3 where that was served;
      'uw' keeps UW's fitted 4.15%.
  Beside the rows (theta-extras.jsonl): a minute's
  spread and top-of-book sizes (the underlying's NBBO),
  its volume, VIX, and the ATM straddle's vol.

  THE TRUST GATE: days are walked newest first; where
  the recorder kept the day (shown.jsonl), the rebuilt
  rows are checked against it to the store's
  tolerance (server/agree.ts) and the verdict kept in
  theta-trust.json; a day that FAILS stops the walk
  for the name until it is understood. Rows go to
  theta-final.jsonl — never over UW's final.jsonl.
==================================================
*/
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { tolerance } from './agree';
import { PAST_FORMAT, compressTicks, type PastDay } from './fieldBackfill';
import { createFieldStore, type Bar, type StoreRow } from './fieldStore';

import { blackScholesPrice } from '../src/core/greeks';
import { nyIsoDate, nyWallTime } from '../src/core/nyTime';
import { lastTradeOf, straddleExpiries, uwYears, UW_VOL_CONVENTION } from '../src/data/feed/trailModel';

/** A minute bar from the history: the store's bar with its whole OHLC and the minute's volume (0 where the feed keeps none) */
export type HistoryBar = Bar & { open: number; high: number; low: number; volume: number };

type Row = Record<string, unknown>;
const YEAR_MS = 365 * 864e5;
const num = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

/* ---- the choices the probe decides (4a, 4b) and the rate -------------------------------------------------------- */

export interface ThetaRebuildConfig {
  version: string;
  /** 4b — a row stamped T on a one-minute quote interval: 'last-in-interval' holds the interval's last quote, knowable
      at T + 1 m (the model's minute T); 'at-stamp' the quote standing at T, knowable at T (the minute before's end) */
  quoteClock: 'last-in-interval' | 'at-stamp';
  /** 4a — an index's underlying a minute: Theta's price series, or the tape's per-print underlying the field keeps */
  spxSource: 'theta' | 'tape';
  /** The rate the session is priced on: the day's DTB3-derived r, or UW's fitted convention */
  rate: 'dtb3' | 'uw';
  /** Strikes this far each side of the day's range enter the universe (the downloader's band is ±15%) */
  moneyness: number;
}
/** The defaults, pending the probe's report (docs/theta-probe): set them when it lands */
export const THETA_REBUILD: ThetaRebuildConfig = { version: 'theta-rebuild-2026-10-14.1', quoteClock: 'last-in-interval', spxSource: 'theta', rate: 'dtb3', moneyness: 0.15 };

/** r from a discount yield d (DTB3 ÷ 100): the owner's formula */
export const rateFromDtb3 = (d: number): number => (-Math.log(1 - (d * 91) / 360) * 365) / 91;

/* ---- the raw files ----------------------------------------------------------------------------------------------- */

export const INDEX_OF: Record<string, string> = { SPXW: 'SPX', NDXP: 'NDX', RUTW: 'RUT', VIXW: 'VIX' };
const INDICES = new Set(['SPX', 'NDX', 'RUT', 'VIX']);
const isIndex = (name: string) => INDICES.has(name);
/** The chain roots a name reads: an index its own and its weekly root (SPX, SPXW) */
export const rootsOf = (name: string): string[] => [name, ...Object.entries(INDEX_OF).filter(([, idx]) => idx === name).map(([w]) => w)];

function readGz(path: string): Row[] | null {
  if (!existsSync(path)) return null;
  const out: Row[] = [];
  for (const line of gunzipSync(readFileSync(path)).toString('utf8').split('\n')) {
    if (!line) continue;
    try {
      out.push(JSON.parse(line) as Row);
    } catch {
      /* a bad line */
    }
  }
  return out;
}
/** Theta's stamp ("2026-10-13T09:30:00.000", New York's wall clock) to an instant */
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
const isoOf = (d: string): string => (/^\d{8}$/.test(d) ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : d.slice(0, 10));
const expOf = (r: Row): string | null => (typeof r.expiration === 'string' ? isoOf(r.expiration) : typeof r.expiration === 'number' ? isoOf(String(r.expiration)) : null);
const strikeOf = (r: Row): number | null => {
  const k = num(r.strike);
  if (k == null) return null;
  return k > 50_000 ? k / 1000 : k;
};
const rightOf = (r: Row): 'C' | 'P' | null => (typeof r.right === 'string' ? (r.right.toUpperCase().startsWith('C') ? 'C' : r.right.toUpperCase().startsWith('P') ? 'P' : null) : null);
/** The OCC symbol under the NAME (an index's weekly root folded under the index, so the model keeps it) */
export function occUnder(name: string, expiration: string, right: 'C' | 'P', strike: number): string {
  const e = expiration;
  return `${name}${e.slice(2, 4)}${e.slice(5, 7)}${e.slice(8, 10)}${right}${String(Math.round(strike * 1000)).padStart(8, '0')}`;
}

/** The underlying's bars for a day — a stock's one-minute bars, an index's Theta series or ohlc, or the tape's bars */
export function underlyingBars(histRoot: string, fieldRoot: string, name: string, day: string, cfg: ThetaRebuildConfig): HistoryBar[] {
  const dir = join(histRoot, name, day);
  const [y, m, d] = day.split('-').map(Number);
  const open = nyWallTime(y, m, d, 9, 30);
  const close = nyWallTime(y, m, d, 16, 0);
  const inSession = (ms: number) => ms >= open && ms < close;
  if (!isIndex(name)) {
    const rows = readGz(join(dir, 'stock-1m.ndjson.gz')) ?? [];
    const bars: HistoryBar[] = [];
    for (const r of rows) {
      if (typeof r.timestamp !== 'string') continue;
      const t = nyStampMs(r.timestamp);
      const o = num(r.open);
      const h = num(r.high);
      const l = num(r.low);
      const c = num(r.close);
      if (!(o! > 0 && h! > 0 && l! > 0 && c! > 0)) continue;
      bars.push({ time: t / 1000, open: o!, high: h!, low: l!, close: c!, volume: num(r.volume) ?? 0, session: inSession(t) ? 'r' : t < open ? 'pre' : 'post' });
    }
    return bars.sort((a, b) => a.time - b.time);
  }
  if (cfg.spxSource === 'tape') {
    const file = join(fieldRoot, name, day, 'tape-price.json');
    if (existsSync(file)) {
      try {
        const j = JSON.parse(readFileSync(file, 'utf8')) as { bars: [number, number, number, number, number, number][] };
        return j.bars.map(b => ({ time: b[0] / 1000, open: b[1], high: b[2], low: b[3], close: b[4], volume: b[5], session: inSession(b[0]) ? 'r' : b[0] < open ? 'pre' : 'post' }) as HistoryBar).sort((a, b) => a.time - b.time);
      } catch {
        /* falls to the series */
      }
    }
  }
  /* the index's ohlc where the month was kept, else the price series carried a minute */
  const ohlc = readGz(join(dir, 'index-1m.ndjson.gz'));
  if (ohlc && ohlc.length) {
    const bars: HistoryBar[] = [];
    for (const r of ohlc) {
      if (typeof r.timestamp !== 'string') continue;
      const t = nyStampMs(r.timestamp);
      const o = num(r.open);
      const h = num(r.high);
      const l = num(r.low);
      const c = num(r.close);
      if (!(o! > 0 && h! > 0 && l! > 0 && c! > 0)) continue;
      bars.push({ time: t / 1000, open: o!, high: h!, low: l!, close: c!, volume: 0, session: inSession(t) ? 'r' : t < open ? 'pre' : 'post' });
    }
    if (bars.length) return bars.sort((a, b) => a.time - b.time);
  }
  const series = readGz(join(dir, 'index-price-1m.ndjson.gz')) ?? [];
  const at = new Map<number, number>();
  for (const r of series) {
    const p = num(r.price);
    if (typeof r.timestamp !== 'string' || p == null || !(p > 0)) continue;
    at.set(Math.floor(nyStampMs(r.timestamp) / 60_000) * 60_000, p);
  }
  const bars: HistoryBar[] = [];
  let last: number | null = null;
  for (let t = open; t < close; t += 60_000) {
    const p = at.get(t);
    if (p != null) last = p;
    if (last != null) bars.push({ time: t / 1000, open: last, high: last, low: last, close: last, volume: 0, session: 'r' });
  }
  return bars;
}

/** A series carried a minute: minute start (ms) → the price standing at it */
function carried(rows: Row[], key: string, from: number, to: number): Map<number, number> {
  const at = new Map<number, number>();
  for (const r of rows) {
    const p = num(r[key]);
    if (typeof r.timestamp !== 'string' || p == null || !(p > 0)) continue;
    at.set(Math.floor(nyStampMs(r.timestamp) / 60_000) * 60_000, p);
  }
  const out = new Map<number, number>();
  let last: number | null = null;
  for (let t = from; t < to; t += 60_000) {
    const p = at.get(t);
    if (p != null) last = p;
    if (last != null) out.set(t, last);
  }
  return out;
}

/** The day's rate: the RATES files (Theta's TREASURY_M3 for the year, else FRED's DTB3 carried to the day); null with none */
export function rateOnDay(histRoot: string, day: string): { r: number; source: string } | null {
  const y = day.slice(0, 4);
  const theta = readGz(join(histRoot, 'RATES', `theta-treasury_m3-${y}.ndjson.gz`));
  if (theta && theta.length) {
    /* the value key: the first numeric field that is not a date */
    let best: { d: string; v: number } | null = null;
    for (const r of theta) {
      const d = ['date', 'created', 'timestamp'].map(k => r[k]).find(v => typeof v === 'string' || typeof v === 'number');
      if (d == null) continue;
      const iso = isoOf(String(d));
      if (iso > day) continue;
      const key = Object.keys(r).find(k => !/date|time|created|symbol/i.test(k) && num(r[k]) != null);
      const v = key ? num(r[key]) : null;
      if (v == null) continue;
      if (!best || iso > best.d) best = { d: iso, v };
    }
    if (best) {
      /* a percent yield (4.2) or a rate (0.042): over 1 is read as percent */
      const d = best.v > 1 ? best.v / 100 : best.v;
      return { r: rateFromDtb3(d), source: `Theta TREASURY_M3 ${best.d} (${best.v})` };
    }
  }
  const fred = join(histRoot, 'RATES', 'fred-dtb3.csv');
  if (existsSync(fred)) {
    let best: { d: string; v: number } | null = null;
    for (const line of readFileSync(fred, 'utf8').split('\n').slice(1)) {
      const [d, v] = line.trim().split(',');
      if (!d || d > day) continue;
      const n = Number(v);
      if (!Number.isFinite(n)) continue;
      if (!best || d > best.d) best = { d, v: n };
    }
    if (best) return { r: rateFromDtb3(best.v / 100), source: `FRED DTB3 ${best.d} (${best.v})` };
  }
  return null;
}

/** The vol that prices `price` for the leg at spot S, strike K, `tau` years on rate r; NaN under intrinsic or above 500% */
export function solveVol(price: number, S: number, K: number, tau: number, right: 'C' | 'P', r: number): number {
  if (!(price > 0) || !(S > 0) || !(K > 0) || !(tau > 0)) return NaN;
  const px = (v: number) => blackScholesPrice(S, K, tau, v, right, r, UW_VOL_CONVENTION.q);
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

interface QuoteMinute {
  /** the model's minute (start, ms) the quote stands for, and its mid */
  m: number;
  mid: number;
}
/** A chain's quote rows for a day, folded per contract to a mid a minute on the quote clock (4b) */
function quotesOf(histRoot: string, name: string, day: string, cfg: ThetaRebuildConfig): { byOcc: Map<string, { expiry: string; strike: number; right: 'C' | 'P'; minutes: QuoteMinute[] }>; files: number } {
  const byOcc = new Map<string, { expiry: string; strike: number; right: 'C' | 'P'; minutes: QuoteMinute[] }>();
  let files = 0;
  for (const root of rootsOf(name)) {
    const dir = join(histRoot, root, day);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      if (!/^chain-quotes-\d{4}-\d{2}-\d{2}\.ndjson\.gz$/.test(f)) continue;
      const rows = readGz(join(dir, f)) ?? [];
      files++;
      for (const r of rows) {
        const e = expOf(r);
        const k = strikeOf(r);
        const right = rightOf(r);
        if (!e || k == null || !right || typeof r.timestamp !== 'string') continue;
        const bid = num(r.bid ?? r.bid_price);
        const ask = num(r.ask ?? r.ask_price);
        if (bid == null || ask == null || !(bid > 0) || !(ask > 0) || ask < bid) continue;
        const stamp = Math.floor(nyStampMs(r.timestamp) / 60_000) * 60_000;
        /* the quote clock (4b): the interval's last quote stands for its own minute; a quote at the stamp for the minute before */
        const m = cfg.quoteClock === 'last-in-interval' ? stamp : stamp - 60_000;
        const occ = occUnder(name, e, right, k);
        let c = byOcc.get(occ);
        if (!c) byOcc.set(occ, (c = { expiry: e, strike: k, right, minutes: [] }));
        c.minutes.push({ m, mid: (bid + ask) / 2 });
      }
    }
  }
  for (const c of byOcc.values()) c.minutes.sort((a, b) => a.m - b.m);
  return { byOcc, files };
}

/** The day's open interest per contract under the name (chain-oi), [OCC, count] */
function oiOf(histRoot: string, name: string, day: string): [string, number][] {
  const out = new Map<string, number>();
  for (const root of rootsOf(name)) {
    const rows = readGz(join(histRoot, root, day, 'chain-oi.ndjson.gz')) ?? [];
    for (const r of rows) {
      const e = expOf(r);
      const k = strikeOf(r);
      const right = rightOf(r);
      const oi = num(r.open_interest ?? r.oi);
      if (!e || k == null || !right || oi == null) continue;
      out.set(occUnder(name, e, right, k), oi);
    }
  }
  return [...out.entries()];
}

/** The sessions the history holds for a name (its chain roots' days with a contracts file), ascending */
export function historyDays(histRoot: string, name: string): string[] {
  const days = new Set<string>();
  for (const root of rootsOf(name)) {
    const dir = join(histRoot, root);
    if (!existsSync(dir)) continue;
    for (const d of readdirSync(dir)) if (/^\d{4}-\d{2}-\d{2}$/.test(d) && existsSync(join(dir, d, 'chain-contracts.ndjson.gz'))) days.add(d);
  }
  return [...days].sort();
}

/** τ for a contract at a minute, the model's own clock: today's expiry on the calendar time from the minute's middle to
    its last-trading instant; a later one on whole days */
export const tauAt = (m: number, expiry: string, day: string): number => (expiry === day ? Math.max(0, (lastTradeOf(expiry) - (m + 30_000)) / YEAR_MS) : uwYears(m + 30_000, lastTradeOf(expiry), expiry, day));

export interface ThetaDay {
  past: PastDay;
  bars: HistoryBar[];
  extras: Extra[];
  rate: { r: number; source: string } | null;
  counts: { contracts: number; quoted: number; minutes: number; files: number };
}
export interface Extra {
  m: number;
  spread: number | null;
  bidSize: number | null;
  askSize: number | null;
  volume: number | null;
  vix: number | null;
  atmIv: number | null;
}

/**
 * One session from the history's rows: the model's inputs (a PastDay), the underlying's bars, and the extras a minute.
 * null with no chain for the day.
 */
export function buildThetaDay(histRoot: string, fieldRoot: string, name: string, day: string, cfg: ThetaRebuildConfig = THETA_REBUILD, now: () => number = Date.now): ThetaDay | { why: string } {
  const bars = underlyingBars(histRoot, fieldRoot, name, day, cfg);
  if (!bars.length) return { why: `no underlying bars for ${name} ${day} in the history` };
  const oi = oiOf(histRoot, name, day);
  if (!oi.length) return { why: `no open interest for ${name} ${day} in the history` };
  const rate = cfg.rate === 'dtb3' ? rateOnDay(histRoot, day) : null;
  const r = rate?.r ?? UW_VOL_CONVENTION.r;
  const closeOf = new Map<number, number>();
  for (const b of bars) closeOf.set(b.time * 1000, b.close);
  const [y, mo, d] = day.split('-').map(Number);
  const open = nyWallTime(y, mo, d, 9, 30);
  const close = nyWallTime(y, mo, d, 16, 0);
  /* the band: the day's range widened by the moneyness */
  const lows = bars.filter(b => b.session === 'r').map(b => b.low);
  const highs = bars.filter(b => b.session === 'r').map(b => b.high);
  const band = lows.length ? { lo: Math.min(...lows) * (1 - cfg.moneyness), hi: Math.max(...highs) * (1 + cfg.moneyness) } : null;

  /* the vols: each contract's quote a minute inverted on the day's rate and the model's clock */
  const q = quotesOf(histRoot, name, day, cfg);
  const ticks: Record<string, number[]> = {};
  let quoted = 0;
  /* the ATM straddle's vol on the day's own expiry: for each minute, the call and the put at the strike nearest the price */
  const atmByMinute = new Map<number, { call?: { d: number; iv: number }; put?: { d: number; iv: number } }>();
  const exps = straddleExpiries(new Set([...q.byOcc.values()].map(c => c.expiry)), day);
  for (const [occ, c] of q.byOcc) {
    if (band && (c.strike < band.lo || c.strike > band.hi)) continue;
    const rows: { start_time: string; iv_low: string; iv_high: string }[] = [];
    for (const { m, mid } of c.minutes) {
      if (m < open || m >= close) continue;
      const S = closeOf.get(m);
      if (S == null) continue;
      const iv = solveVol(mid, S, c.strike, tauAt(m, c.expiry, day), c.right, r);
      if (!Number.isFinite(iv)) continue;
      rows.push({ start_time: new Date(m).toISOString(), iv_low: String(iv), iv_high: String(iv) });
      if (exps.today && c.expiry === exps.today) {
        const d = Math.abs(c.strike - S);
        const a = atmByMinute.get(m) ?? {};
        const had = c.right === 'C' ? a.call : a.put;
        if (!had || d < had.d) {
          if (c.right === 'C') a.call = { d, iv };
          else a.put = { d, iv };
          atmByMinute.set(m, a);
        }
      }
    }
    if (rows.length) {
      ticks[occ] = compressTicks(rows, day);
      quoted++;
    }
  }

  /* the seed: the session before's last minute, inverted the same way, and its count */
  let seed: PastDay['seed'] = null;
  const before = historyDays(histRoot, name).filter(x => x < day);
  const prev = before.length ? before[before.length - 1] : null;
  if (prev) {
    const pq = quotesOf(histRoot, name, prev, cfg);
    const pbars = underlyingBars(histRoot, fieldRoot, name, prev, cfg);
    const pClose = pbars.length ? pbars[pbars.length - 1].close : null;
    const poi = new Map(oiOf(histRoot, name, prev));
    const [py, pm, pd] = prev.split('-').map(Number);
    const pEnd = nyWallTime(py, pm, pd, 16, 0) - 60_000;
    const pr = cfg.rate === 'dtb3' ? rateOnDay(histRoot, prev)?.r ?? UW_VOL_CONVENTION.r : UW_VOL_CONVENTION.r;
    const rows: [string, number | null, number | null, number][] = [];
    for (const [occ, c] of pq.byOcc) {
      const last = [...c.minutes].reverse().find(x => x.m <= pEnd);
      const iv = last && pClose != null ? solveVol(last.mid, pClose, c.strike, tauAt(pEnd, c.expiry, prev), c.right, pr) : NaN;
      rows.push([occ, Number.isFinite(iv) ? iv : null, last ? last.m : null, poi.get(occ) ?? 0]);
    }
    if (rows.length) seed = { date: prev, receivedAt: now(), rows };
  }

  /* UW's whole-book series where the series job kept it (the residual's reference) */
  let total: PastDay['total'] = null;
  const seriesFile = join(fieldRoot, name, day, 'series.json');
  if (existsSync(seriesFile)) {
    try {
      const s = JSON.parse(readFileSync(seriesFile, 'utf8')) as { receivedAt: number; rows: Row[] };
      total = {
        receivedAt: s.receivedAt,
        rows: s.rows
          .map(x => [Date.parse(String(x.start_time)), num(x.price), num(x.gamma_per_one_percent_move_oi) ?? 0, num(x.gamma_per_one_percent_move_vol) ?? 0, num(x.gamma_per_one_percent_move_dir) ?? 0] as [number, number | null, number, number, number])
          .filter(x => Number.isFinite(x[0])),
      };
    } catch {
      total = null;
    }
  }

  /* the extras a minute: the underlying's NBBO, its volume, VIX carried, the ATM vol */
  const nbbo = new Map<number, { spread: number; bidSize: number | null; askSize: number | null }>();
  for (const r of readGz(join(histRoot, name, day, 'stock-quote-1m.ndjson.gz')) ?? []) {
    if (typeof r.timestamp !== 'string') continue;
    const bid = num(r.bid ?? r.bid_price);
    const ask = num(r.ask ?? r.ask_price);
    if (bid == null || ask == null || !(bid > 0) || !(ask > 0)) continue;
    nbbo.set(Math.floor(nyStampMs(r.timestamp) / 60_000) * 60_000, { spread: ask - bid, bidSize: num(r.bid_size), askSize: num(r.ask_size) });
  }
  const vix = carried(readGz(join(histRoot, 'VIX', day, 'index-price-1m.ndjson.gz')) ?? [], 'price', open, close);
  const extras: Extra[] = [];
  for (const b of bars) {
    if (b.session !== 'r') continue;
    const m = b.time * 1000;
    const n = nbbo.get(m);
    const a = atmByMinute.get(m);
    const atm = a && a.call && a.put ? (a.call.iv + a.put.iv) / 2 : a?.call?.iv ?? a?.put?.iv ?? null;
    extras.push({ m, spread: n?.spread ?? null, bidSize: n?.bidSize ?? null, askSize: n?.askSize ?? null, volume: b.volume ?? null, vix: vix.get(m) ?? null, atmIv: atm });
  }

  const past: PastDay = { format: PAST_FORMAT, name, day, builtAt: now(), oi, seed, ticks, total, calls: 0, asked: q.byOcc.size, refused: 0, vols: 'theta', ...(rate ? { rate: rate.r } : {}) };
  return { past, bars, extras, rate, counts: { contracts: oi.length, quoted, minutes: bars.filter(b => b.session === 'r').length, files: q.files } };
}

/* ---- the walk: newest first, trusted against the recorder's days -------------------------------------------------- */

export interface TrustFile {
  version: string;
  checked: { day: string; pass: boolean; judged: boolean; lines: string[]; at: number }[];
  /** The oldest day the walk reached, and whether the name stands trusted (every judged day passed) */
  reached: string | null;
  trusted: boolean;
  stoppedAt?: { day: string; why: string };
}

export interface RebuildOptions {
  histRoot: string;
  fieldRoot: string;
  names: string[];
  /** A cap on the days a name walks (0: all the history holds) */
  maxDays: number;
  cfg: ThetaRebuildConfig;
  log: (line: string) => void;
  now?: () => number;
  /** Build again a day already built (a config change) */
  again?: boolean;
  /** Each day built, its inputs and bars (Section I: the CLI tiles it — server/fieldTiles.ts) */
  onDay?: (name: string, day: string, past: PastDay, bars: HistoryBar[]) => void;
}

/** The version a day's build note names (null with none) */
function builtVersion(file: string): string | null {
  try {
    return existsSync(file) ? ((JSON.parse(readFileSync(file, 'utf8')) as { version?: string }).version ?? null) : null;
  } catch {
    return null;
  }
}

export async function rebuildTheta(opts: RebuildOptions): Promise<Record<string, TrustFile>> {
  const { histRoot, fieldRoot, cfg, log } = opts;
  const now = opts.now ?? Date.now;
  const store = createFieldStore({ root: fieldRoot, now });
  const out: Record<string, TrustFile> = {};
  for (const name of opts.names) {
    const trustFile = join(fieldRoot, name, 'theta-trust.json');
    let trust: TrustFile = { version: cfg.version, checked: [], reached: null, trusted: true };
    if (existsSync(trustFile)) {
      try {
        const had = JSON.parse(readFileSync(trustFile, 'utf8')) as TrustFile;
        if (had.version === cfg.version) trust = had;
      } catch {
        /* begun again */
      }
    }
    const days = historyDays(histRoot, name).reverse();
    const walk = opts.maxDays > 0 ? days.slice(0, opts.maxDays) : days;
    log(`${name}: ${days.length} sessions in the history${walk.length < days.length ? `, walking ${walk.length}` : ''}, newest first`);
    let built = 0;
    for (const day of walk) {
      const dir = join(fieldRoot, name, day);
      const rowsFile = join(dir, 'theta-final.jsonl');
      /* a day built on THIS version stands (a run resumes); a changed version or `again` builds it afresh */
      if (existsSync(rowsFile) && !opts.again && builtVersion(join(dir, 'theta-build.json')) === cfg.version) {
        trust.reached = day;
        continue;
      }
      const t0 = now();
      const b = buildThetaDay(histRoot, fieldRoot, name, day, cfg, now);
      if ('why' in b) {
        log(`${name} ${day}: not built — ${b.why}`);
        continue;
      }
      const rows = store.rowsOf(b.past, b.bars);
      mkdirSync(dir, { recursive: true });
      writeFileSync(`${rowsFile}.part`, rows.map(r => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : ''));
      renameSync(`${rowsFile}.part`, rowsFile);
      writeFileSync(join(dir, 'theta-extras.jsonl'), b.extras.map(e => JSON.stringify(e)).join('\n') + (b.extras.length ? '\n' : ''));
      writeFileSync(join(dir, 'theta-build.json'), JSON.stringify({ version: cfg.version, config: cfg, builtAt: now(), rate: b.rate, counts: b.counts, rows: rows.length, seed: b.past.seed?.date ?? null, total: !!b.past.total }));
      built++;
      trust.reached = day;
      /* the day's tiles — where UW's own rebuild of the day is not there (finalRowsOf's rule: UW's stand over the history's) */
      if (!existsSync(join(dir, 'past.json.gz'))) opts.onDay?.(name, day, b.past, b.bars);
      const secs = (now() - t0) / 1000;
      log(`${name} ${day}: ${rows.length} rows from ${b.counts.quoted} quoted contracts of ${b.counts.contracts} (${b.counts.files} quote files)${b.rate ? `, r ${(b.rate.r * 100).toFixed(2)}% (${b.rate.source})` : ', UW\'s rate'}${b.past.seed ? `, seed ${b.past.seed.date}` : ', no seed'} — ${secs.toFixed(1)} s`);
      /* THE TRUST GATE: a day the recorder kept is the rebuild's check; a FAIL stops the walk for the name */
      const shown = store.readRows(name, day, 'shown');
      if (shown.length) {
        const t = tolerance(shown, rows);
        trust.checked.push({ day, pass: t.judged && t.pass, judged: t.judged, lines: t.lines, at: now() });
        log(`${name} ${day}: against the recorder's day — ${t.judged ? (t.pass ? 'PASS' : 'FAIL') : 'not judged'}: ${t.lines.join(' · ')}`);
        if (t.judged && !t.pass) {
          trust.trusted = false;
          trust.stoppedAt = { day, why: t.lines.join(' · ') };
          writeFileSync(trustFile, JSON.stringify(trust));
          log(`${name}: STOPPED at ${day} — the rebuild does not match the recorder's day within the tolerance; older days are not trusted until this is understood`);
          break;
        }
      }
      writeFileSync(trustFile, JSON.stringify(trust));
    }
    if (!trust.checked.length) log(`${name}: no recorder day among the sessions walked — the rebuilt days stand unchecked (theta-trust.json says so)`);
    writeFileSync(trustFile, JSON.stringify(trust));
    out[name] = trust;
    log(`${name}: ${built} built this run, reached ${trust.reached ?? '—'}, ${trust.checked.filter(c => c.pass).length} of ${trust.checked.length} checked days pass`);
  }
  return out;
}

/** The rows a day stands on: UW's final rows where the backfill built them, else the Theta rebuild's (the proof engine reads this) */
export function finalRowsOf(fieldRoot: string, name: string, day: string): { rows: StoreRow[]; source: 'uw' | 'theta' | null } {
  const store = createFieldStore({ root: fieldRoot });
  const uw = store.readRows(name, day, 'final');
  if (uw.length) return { rows: uw, source: 'uw' };
  const file = join(fieldRoot, name, day, 'theta-final.jsonl');
  if (!existsSync(file)) return { rows: [], source: null };
  const rows: StoreRow[] = [];
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line) continue;
    try {
      rows.push(JSON.parse(line) as StoreRow);
    } catch {
      /* a bad line */
    }
  }
  return { rows, source: 'theta' };
}

/** Today's New York date, for the CLI's defaults */
export const todayNy = (): string => nyIsoDate();
