/*
==================================================
  SLAYER TERMINAL - THE HISTORY DOWNLOADER (scripts/theta-history)

  2026-10-14 — the owner, section C: "The 13 sessions
  in your workspace are not my data. My data is 14
  years at Theta. Build it." A script for the
  always-on machine:

    npm run theta:history

  · 127.0.0.1 only; it never starts or signs into a
    terminal — the terminal must already be CONNECTED
    (npm run theta:terminal, as ever), else it stops.
  · In the recorder's hours (06:00–17:00 New York,
    weekdays — the 7:00 am open-interest switch, the
    session's reads and SPX's curb inside them) it keeps
    THREE requests in flight; outside them SEVEN, so one
    of Theta's eight is always the recorder's (SPX's
    overnight reads among them). Nothing is asked in
    Theta's own gap (00:00–01:45 New York).
  · Resumable, checkpointed PER TICKER PER DAY
    (<root>/<T>/manifest.json): a day held is never
    asked again; a file is written whole and renamed
    into place, so a run cut short leaves no half
    file and a re-run never duplicates a row.
  · Newest first, back to the first date each feed
    serves (the terminal's own date lists — never a
    date from the docs).
  · RAW ROWS ONLY, as answered (gzipped NDJSON): the
    minute-quote clock (4b) and the SPX source (4a)
    are applied at rebuild (server/thetaRebuild.ts).
  · Scope: SPY, QQQ, SPX and SPXW option chains (the
    expirations within 60 calendar days, the strikes
    within ±15% of the day's range) with each day's
    contract list, per-contract open interest and
    one-minute quotes (SPX and SPXW to the curb's end,
    5:00 pm, and their overnight session — the evening
    before from 8:15 pm and the morning to 9:25 am, the
    front expiry a minute, the rest every five — the
    first date each serves overnight rows logged); SPY and QQQ one-minute NBBO
    (bid, ask and the top-of-book sizes); VIX, SPX,
    NDX and RUT a minute (the price series) and their
    candles; daily and one-minute candles with volume
    for every ticker in the app; the rate series —
    Theta's TREASURY_M3 where entitled, else FRED's
    DTB3 (raw; r = −ln(1 − d·91/360) × 365/91 with
    d = DTB3 ÷ 100 is the rebuild's).
  · Every empty or denied answer is logged with its
    URL (<root>/log.ndjson); each feed's first served
    date is logged and kept in the manifest.
  · After the first five sessions it writes a report:
    GB and minutes a session per feed, the projected
    disk and time per ticker to its first date, and
    this machine's free disk — and PAUSES when the
    projection exceeds the free space (HISTORY_FORCE=1
    goes on).

  Env (.env or the environment): HISTORY_ROOT
  (.feed-cache/history), HISTORY_TICKERS (every
  name in the app), HISTORY_CHAIN_ROOTS
  (SPY,QQQ,SPX,SPXW), HISTORY_NBBO (SPY,QQQ),
  HISTORY_INDICES (SPX,NDX,RUT,VIX), HISTORY_SESSIONS
  (a cap, for a test), HISTORY_FROM (a floor date),
  HISTORY_RETRY_DENIED=1, HISTORY_FORCE=1,
  HISTORY_CONCURRENCY (7, never more), HISTORY_IN_SESSION_CONCURRENCY
  (3), THETA_PROBE_BASE (the terminal).
==================================================
*/
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { statfs } from 'node:fs/promises';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { UNIVERSE } from '../../src/data/universe';
import { tradesAllSessions } from '../../src/core/sessions';
import { parseEnv } from '../theta-probe/lib';
import { ClockGate, GzWriter, compact, daysBetween, fmtBytes, isoAdd, isoOf, limitByClock, num, nyNow, thetaStream, thetaText, weekdayOf, type Row } from './stream';

/* ---- the options ------------------------------------------------------------------------------------------------- */

export interface HistoryOptions {
  root: string;
  stocks: string[];
  chainRoots: string[];
  nbbo: string[];
  indices: string[];
  windowDays: number;
  moneyness: number;
  /** A cap on the sessions walked (a test) */
  maxSessions: number;
  /** A floor date (ISO) — nothing older is asked */
  from: string | null;
  retryDenied: boolean;
  force: boolean;
  sessionLimit: number;
  fullLimit: number;
  /** Report after this many sessions (5) */
  reportAfter: number;
  /** The rates: 'theta' first, 'fred' where Theta refuses; 'none' in a test */
  rates: 'auto' | 'none';
  log: (line: string) => void;
  /** The clock (a test moves it) */
  now?: () => number;
  /** The New York clock the in-flight gate reads (a test holds it outside Theta's gap; the real one by default) */
  gateAt?: () => { minute: number; weekday: number };
}

const DEFAULT_STOCKS = [...new Set([...UNIVERSE.map(u => u.ticker), 'SPY', 'QQQ', 'IWM', 'DIA'])];
const list = (v: string | undefined, dflt: string[]): string[] => (v == null || v === '' ? dflt : v === 'none' ? [] : v.split(',').map(s => s.trim().toUpperCase()).filter(Boolean));

export function optionsFromEnv(env: Record<string, string | undefined>, log: (line: string) => void): HistoryOptions {
  return {
    root: env.HISTORY_ROOT || join(process.cwd(), '.feed-cache', 'history'),
    stocks: list(env.HISTORY_TICKERS, DEFAULT_STOCKS),
    chainRoots: list(env.HISTORY_CHAIN_ROOTS, ['SPY', 'QQQ', 'SPX', 'SPXW']),
    nbbo: list(env.HISTORY_NBBO, ['SPY', 'QQQ']),
    indices: list(env.HISTORY_INDICES, ['SPX', 'NDX', 'RUT', 'VIX']),
    windowDays: Number(env.HISTORY_WINDOW_DAYS ?? 60) || 60,
    moneyness: Number(env.HISTORY_MONEYNESS ?? 0.15) || 0.15,
    maxSessions: Number(env.HISTORY_SESSIONS ?? 0) || 0,
    from: env.HISTORY_FROM && /^\d{4}-\d{2}-\d{2}$/.test(env.HISTORY_FROM) ? env.HISTORY_FROM : null,
    retryDenied: env.HISTORY_RETRY_DENIED === '1',
    force: env.HISTORY_FORCE === '1',
    sessionLimit: Math.min(3, Number(env.HISTORY_IN_SESSION_CONCURRENCY ?? 3) || 3),
    /* never past 7: one of Theta's eight concurrent requests is always the recorder's (the owner, 2026-10-14) */
    fullLimit: Math.min(7, Number(env.HISTORY_CONCURRENCY ?? 7) || 7),
    reportAfter: Number(env.HISTORY_REPORT_AFTER ?? 5) || 5,
    rates: env.HISTORY_RATES === 'none' ? 'none' : 'auto',
    log,
  };
}

/* ---- the manifest: a ticker's checkpoint, a day and a feed at a time ------------------------------------------------ */

export type Status = 'ok' | 'empty' | 'denied' | 'error';
export interface Entry {
  s: Status;
  code?: number | string;
  rows?: number;
  /** Compressed bytes on disk */
  bytes?: number;
  seconds?: number;
  at: number;
}
export interface Manifest {
  ticker: string;
  /** Each feed's first served date (the terminal's own lists), null where none */
  first: Record<string, string | null>;
  /** Per day, per feed; a chain-day's quotes per expiration under `quotes:<E>` */
  days: Record<string, Record<string, Entry>>;
  /** Per month (stock minutes) and per year (eod), the bulk calls */
  months: Record<string, Entry>;
  years: Record<string, Entry>;
}

function manifestOf(root: string, ticker: string): Manifest {
  const file = join(root, ticker, 'manifest.json');
  if (existsSync(file)) {
    try {
      const m = JSON.parse(readFileSync(file, 'utf8')) as Manifest;
      m.first ??= {};
      m.days ??= {};
      m.months ??= {};
      m.years ??= {};
      return m;
    } catch {
      /* a manifest cut short: begun again from the files that stand */
    }
  }
  return { ticker, first: {}, days: {}, months: {}, years: {} };
}
function saveManifest(root: string, m: Manifest): void {
  mkdirSync(join(root, m.ticker), { recursive: true });
  const file = join(root, m.ticker, 'manifest.json');
  writeFileSync(`${file}.part`, JSON.stringify(m));
  renameSync(`${file}.part`, file);
}
/** Held: 'ok' and 'empty' are never asked again; 'denied' only when asked to retry; 'error' always again */
const held = (e: Entry | undefined, retryDenied: boolean): boolean => !!e && (e.s === 'ok' || e.s === 'empty' || (e.s === 'denied' && !retryDenied));

/* ---- the run ------------------------------------------------------------------------------------------------------- */

interface Tally {
  bytes: number;
  seconds: number;
  calls: number;
  sessions: number;
}

export async function runHistory(opts: HistoryOptions): Promise<{ sessions: string[]; paused: boolean; report: string; tallies: Record<string, Tally> }> {
  const { root, log } = opts;
  mkdirSync(root, { recursive: true });
  const clock = opts.now ?? Date.now;
  const gate = new ClockGate(limitByClock(opts.sessionLimit, opts.fullLimit, opts.gateAt));
  const logFile = join(root, 'log.ndjson');
  const note = (o: Record<string, unknown>) => appendFileSync(logFile, JSON.stringify({ at: new Date(clock()).toISOString(), ...o }) + '\n');
  const tallies: Record<string, Tally> = {};
  const tally = (group: string, bytes: number, seconds: number) => {
    const t = (tallies[group] ??= { bytes: 0, seconds: 0, calls: 0, sessions: 0 });
    t.bytes += bytes;
    t.seconds += seconds;
    t.calls++;
  };

  /* the terminal must be signed in — this script never starts one */
  const st = await thetaText('/terminal/mdds/status');
  if (!(st.status === 200 && st.text === 'CONNECTED')) {
    const why = `the Theta Terminal is not signed in on this machine (${st.status} ${st.text}) — start it as you always do (npm run theta:terminal); this script never starts one`;
    log(why);
    note({ kind: 'stop', why, url: st.url });
    return { sessions: [], paused: false, report: why, tallies };
  }

  /* ---- one call, streamed to a gzipped file, its outcome kept in the manifest ------------------------------------ */
  const call = async (m: Manifest, slot: Record<string, Entry>, feed: string, path: string, params: Record<string, string | number | undefined>, file: string, keep: (r: Row) => boolean, group: string, sinks?: (r: Row) => Promise<void> | void): Promise<Entry> => {
    if (held(slot[feed], opts.retryDenied)) return slot[feed];
    const writer = sinks ? null : new GzWriter(file);
    const a = await gate.run(() => thetaStream(path, params, async r => {
      if (!keep(r)) return;
      if (writer) await writer.write(r);
      else await sinks!(r);
    }));
    let e: Entry;
    if (a.status === 200 && !a.error) {
      if (writer) await writer.close(writer.rows > 0);
      const bytes = writer && writer.rows > 0 && existsSync(file) ? statSync(file).size : 0;
      e = { s: writer ? (writer.rows > 0 ? 'ok' : 'empty') : a.rows > 0 ? 'ok' : 'empty', rows: writer ? writer.rows : a.rows, bytes, seconds: a.seconds, at: clock() };
      if (e.s === 'empty') note({ kind: 'empty', ticker: m.ticker, feed, url: a.url, status: a.status, rows: a.rows });
      tally(group, bytes, a.seconds);
    } else if (a.status === 472) {
      if (writer) await writer.close(false);
      e = { s: 'empty', code: 472, seconds: a.seconds, at: clock() };
      note({ kind: 'empty', ticker: m.ticker, feed, url: a.url, status: 472, text: a.error });
      tally(group, 0, a.seconds);
    } else if (a.status === 471 || a.status === 404 || a.status === 473 || a.status === 477) {
      if (writer) await writer.close(false);
      e = { s: 'denied', code: a.status, seconds: a.seconds, at: clock() };
      note({ kind: 'denied', ticker: m.ticker, feed, url: a.url, status: a.status, text: a.error });
      log(`denied ${a.status} ${a.name}: ${a.url}`);
    } else {
      if (writer) await writer.close(false);
      e = { s: 'error', code: a.status, seconds: a.seconds, at: clock() };
      note({ kind: 'error', ticker: m.ticker, feed, url: a.url, status: a.status, text: a.error });
      log(`error ${a.status} ${a.name}: ${a.url} — ${a.error.slice(0, 120)}`);
    }
    slot[feed] = e;
    saveManifest(root, m);
    return e;
  };

  /* ---- THE FIRST DATE THETA SERVES OVERNIGHT ROWS (the owner, 2026-10-15: "Theta's docs say overnight quotes and trades
     exist for SPX, VIX, DJI and RUT options after January 2022, and 2015–2018, but not 2019–2022. Log the first date Theta
     actually serves overnight rows"): walking newest first, a root's oldest trading day with any overnight row is kept
     as `first.gth` and logged each time it moves older; a day with none is logged once (log.ndjson, kind 'gth') ------- */
  const noteOvernight = (m: Manifest, d: string, rows: number) => {
    const key = `gth-seen:${d}`;
    const slot = (m.days[d] ??= {});
    if (slot[key]) return;
    slot[key] = { s: rows > 0 ? 'ok' : 'empty', rows, at: clock() };
    if (rows > 0 && (!m.first.gth || d < m.first.gth)) {
      m.first.gth = d;
      log(`overnight rows: ${m.ticker} served on ${d} (${rows} rows) — the oldest so far`);
    }
    note({ kind: 'gth', ticker: m.ticker, day: d, rows, oldestServed: m.first.gth ?? null });
    saveManifest(root, m);
  };

  /* ---- the calendar and each feed's first date ------------------------------------------------------------------ */
  const dateOf = (r: Row): string | null => {
    for (const k of ['date', 'created', 'timestamp']) {
      const v = r[k];
      if (typeof v === 'string' && v.length >= 8) return isoOf(v);
      if (typeof v === 'number' && v > 19000000) return isoOf(String(v));
    }
    return null;
  };
  const datesOf = async (path: string, params: Record<string, string>, pick: (r: Row) => string | null = dateOf): Promise<string[]> => {
    const dates = new Set<string>();
    const a = await gate.run(() => thetaStream(path, params, r => {
      const d = pick(r);
      if (d) dates.add(d);
    }));
    if (a.status !== 200) note({ kind: a.status === 472 ? 'empty' : 'denied', feed: 'dates', url: a.url, status: a.status, text: a.error });
    return [...dates].sort();
  };
  const spyDates = await datesOf('/stock/list/dates/trade', { symbol: 'SPY' });
  const today = nyNow().iso;
  let sessions = spyDates.filter(d => d < today && (!opts.from || d >= opts.from)).sort().reverse();
  if (opts.maxSessions > 0) sessions = sessions.slice(0, opts.maxSessions);
  log(`the calendar: ${spyDates.length} SPY trade dates${spyDates.length ? `, ${spyDates[0]} to ${spyDates[spyDates.length - 1]}` : ''}; ${sessions.length} sessions to walk, newest first${opts.maxSessions ? ` (capped at ${opts.maxSessions})` : ''}`);
  if (!spyDates.length) return { sessions: [], paused: false, report: 'no trade dates from the terminal', tallies };

  const manifests = new Map<string, Manifest>();
  const mf = (t: string) => {
    let m = manifests.get(t);
    if (!m) manifests.set(t, (m = manifestOf(root, t)));
    return m;
  };
  const firstOf = async (t: string, feed: string, path: string, params: Record<string, string>): Promise<string | null> => {
    const m = mf(t);
    if (feed in m.first) return m.first[feed];
    const dates = await datesOf(path, params);
    m.first[feed] = dates[0] ?? null;
    saveManifest(root, m);
    log(`${t} ${feed}: first served date ${dates[0] ?? 'none'}${dates.length ? ` (${dates.length} dates to ${dates[dates.length - 1]})` : ''}`);
    note({ kind: 'first', ticker: t, feed, first: dates[0] ?? null, dates: dates.length });
    return dates[0] ?? null;
  };
  for (const t of opts.stocks) await firstOf(t, 'stock', '/stock/list/dates/trade', { symbol: t });
  for (const t of opts.indices) await firstOf(t, 'index', '/index/list/dates', { symbol: t });
  for (const r of opts.chainRoots) {
    const m = mf(r);
    if (!('chain' in m.first)) {
      const exps = await datesOf('/option/list/expirations', { symbol: r }, row => (typeof row.expiration === 'string' ? isoOf(row.expiration) : typeof row.expiration === 'number' ? isoOf(String(row.expiration)) : null));
      const first = exps[0] ?? null;
      m.first.chain = first ? (await datesOf('/option/list/dates/quote', { symbol: r, expiration: compact(first) }))[0] ?? null : null;
      saveManifest(root, m);
      log(`${r} chain: first served date ${m.first.chain ?? 'none'} (the earliest expiration ${first ?? 'none'})`);
      note({ kind: 'first', ticker: r, feed: 'chain', first: m.first.chain, expirations: exps.length });
    }
  }

  /* ---- the rates, once: Theta's TREASURY_M3 a year a call, else FRED's DTB3 raw -------------------------------- */
  if (opts.rates === 'auto') {
    const m = mf('RATES');
    const y0 = Number((spyDates[0] ?? today).slice(0, 4));
    const y1 = Number(today.slice(0, 4));
    let denied = false;
    for (let y = y1; y >= y0 && !denied; y--) {
      const e = await call(m, m.years, `treasury_m3:${y}`, '/interest_rate/history/eod', { symbol: 'TREASURY_M3', start_date: `${y}0101`, end_date: `${y}1231` }, join(root, 'RATES', `theta-treasury_m3-${y}.ndjson.gz`), () => true, 'rates');
      if (e.s === 'denied') denied = true;
    }
    if (denied && !held(m.years['fred:dtb3'], opts.retryDenied)) {
      const url = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=DTB3';
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
        const text = await res.text();
        if (res.status === 200 && /^DATE|^observation_date/i.test(text)) {
          mkdirSync(join(root, 'RATES'), { recursive: true });
          writeFileSync(join(root, 'RATES', 'fred-dtb3.csv'), text);
          m.years['fred:dtb3'] = { s: 'ok', rows: text.split('\n').length - 1, bytes: Buffer.byteLength(text), at: clock() };
          log(`rates: Theta refused TREASURY_M3; FRED DTB3 kept raw (${m.years['fred:dtb3'].rows} rows) — the rebuild applies r = −ln(1 − d·91/360) × 365/91, d = DTB3 ÷ 100`);
        } else {
          m.years['fred:dtb3'] = { s: 'error', code: res.status, at: clock() };
          note({ kind: 'error', feed: 'fred', url, status: res.status, text: text.slice(0, 200) });
        }
      } catch (e) {
        m.years['fred:dtb3'] = { s: 'error', code: 'network', at: clock() };
        note({ kind: 'error', feed: 'fred', url, status: 'network', text: String(e).slice(0, 200) });
      }
      saveManifest(root, m);
    }
  }

  /* ---- the helpers a session needs --------------------------------------------------------------------------------- */
  const monthOf = (d: string) => d.slice(0, 7);
  const lastOfMonth = (ym: string): string => {
    const [y, mo] = ym.split('-').map(Number);
    return new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10);
  };
  /** The day's range from its eod row (the year file is read once a year a ticker); null without one */
  const eodCache = new Map<string, Map<string, { high: number; low: number }>>();
  const rangeOf = (t: string, d: string): { high: number; low: number } | null => {
    const y = d.slice(0, 4);
    const key = `${t}:${y}`;
    let byDay = eodCache.get(key);
    if (!byDay) {
      byDay = new Map();
      const isIndex = opts.indices.includes(t) && !opts.stocks.includes(t);
      const file = join(root, t, `${isIndex ? 'index-eod' : 'eod'}-${y}.ndjson.gz`);
      if (existsSync(file)) {
        for (const line of gunzipSync(readFileSync(file)).toString('utf8').split('\n')) {
          if (!line) continue;
          try {
            const r = JSON.parse(line) as Row;
            const dd = dateOf(r);
            const h = num(r.high);
            const l = num(r.low);
            if (dd && h != null && l != null) byDay.set(dd, { high: h, low: l });
          } catch {
            /* a bad line */
          }
        }
      }
      eodCache.set(key, byDay);
    }
    return byDay.get(d) ?? null;
  };
  const strikeOf = (r: Row): number | null => {
    const k = num(r.strike);
    if (k == null) return null;
    return k > 50_000 ? k / 1000 : k;
  };
  const expOf = (r: Row): string | null => (typeof r.expiration === 'string' ? isoOf(r.expiration) : typeof r.expiration === 'number' ? isoOf(String(r.expiration)) : null);

  /* ---- a session, every feed ---------------------------------------------------------------------------------------- */
  const sessionBytesBefore = () => Object.values(tallies).reduce((s, t) => s + t.bytes, 0);
  const done: string[] = [];
  let paused = false;
  let report = '';
  const t0 = clock();
  for (const [si, d] of sessions.entries()) {
    const sb = sessionBytesBefore();
    const s0 = clock();
    const jobs: Promise<unknown>[] = [];
    const chainRoots = opts.chainRoots;
    /* the stocks: eod a year, minutes a month (split into days), the NBBO a day */
    for (const t of opts.stocks) {
      const m = mf(t);
      if (m.first.stock && d < m.first.stock) continue;
      jobs.push(
        (async () => {
          const y = d.slice(0, 4);
          await call(m, m.years, `eod:${y}`, '/stock/history/eod', { symbol: t, start_date: `${y}0101`, end_date: `${y}1231` }, join(root, t, `eod-${y}.ndjson.gz`), () => true, 'stock');
          const ym = monthOf(d);
          if (!held(m.months[`1m:${ym}`], opts.retryDenied)) {
            /* the month's bars into a file a day — each written whole, so a month asked again never doubles a day */
            const writers = new Map<string, GzWriter>();
            const e = await call(m, m.months, `1m:${ym}`, '/stock/history/ohlc', { symbol: t, start_date: `${ym.replace('-', '')}01`, end_date: compact(lastOfMonth(ym)), interval: '1m', venue: 'utp_cta' }, '', () => true, 'stock', async r => {
              const dd = typeof r.timestamp === 'string' ? r.timestamp.slice(0, 10) : null;
              if (!dd) return;
              let w = writers.get(dd);
              if (!w) writers.set(dd, (w = new GzWriter(join(root, t, dd, 'stock-1m.ndjson.gz'))));
              await w.write(r);
            });
            let bytes = 0;
            for (const [dd, w] of writers) {
              await w.close(w.rows > 0);
              const f = join(root, t, dd, 'stock-1m.ndjson.gz');
              const b = existsSync(f) ? statSync(f).size : 0;
              bytes += b;
              (m.days[dd] ??= {})['stock-1m'] = { s: w.rows > 0 ? 'ok' : 'empty', rows: w.rows, bytes: b, at: clock() };
            }
            if (e.s === 'ok' || e.s === 'empty') {
              e.bytes = bytes;
              tally('stock', bytes, 0);
            }
            saveManifest(root, m);
          }
          if (opts.nbbo.includes(t)) await call(m, (m.days[d] ??= {}), 'stock-quote-1m', '/stock/history/quote', { symbol: t, date: compact(d), interval: '1m', start_time: '09:30:00', end_time: '16:00:00' }, join(root, t, d, 'stock-quote-1m.ndjson.gz'), () => true, 'nbbo');
        })()
      );
    }
    /* the indices: the price a minute (the series), the candles a month, eod a year */
    for (const t of opts.indices) {
      const m = mf(t);
      if (m.first.index && d < m.first.index) continue;
      jobs.push(
        (async () => {
          const y = d.slice(0, 4);
          await call(m, m.years, `index-eod:${y}`, '/index/history/eod', { symbol: t, start_date: `${y}0101`, end_date: `${y}1231` }, join(root, t, `index-eod-${y}.ndjson.gz`), () => true, 'index');
          await call(m, (m.days[d] ??= {}), 'index-price-1m', '/index/history/price', { symbol: t, date: compact(d), interval: '1m', start_time: '09:30:00', end_time: '16:15:00' }, join(root, t, d, 'index-price-1m.ndjson.gz'), () => true, 'index');
          const ym = monthOf(d);
          if (!held(m.months[`1m:${ym}`], opts.retryDenied)) {
            const writers = new Map<string, GzWriter>();
            const e = await call(m, m.months, `1m:${ym}`, '/index/history/ohlc', { symbol: t, start_date: `${ym.replace('-', '')}01`, end_date: compact(lastOfMonth(ym)), interval: '1m' }, '', () => true, 'index', async r => {
              const dd = typeof r.timestamp === 'string' ? r.timestamp.slice(0, 10) : null;
              if (!dd) return;
              let w = writers.get(dd);
              if (!w) writers.set(dd, (w = new GzWriter(join(root, t, dd, 'index-1m.ndjson.gz'))));
              await w.write(r);
            });
            let bytes = 0;
            for (const [dd, w] of writers) {
              await w.close(w.rows > 0);
              const f = join(root, t, dd, 'index-1m.ndjson.gz');
              const b = existsSync(f) ? statSync(f).size : 0;
              bytes += b;
              (m.days[dd] ??= {})['index-1m'] = { s: w.rows > 0 ? 'ok' : 'empty', rows: w.rows, bytes: b, at: clock() };
            }
            if (e.s === 'ok' || e.s === 'empty') {
              e.bytes = bytes;
              tally('index', bytes, 0);
            }
            saveManifest(root, m);
          }
        })()
      );
    }
    await Promise.all(jobs);

    /* the chains, after the bars (the day's range comes off the eod row): the contracts quoting that day, their open
       interest, and the one-minute quotes an expiration at a time — the window's expirations and the band's strikes */
    const chainJobs: Promise<unknown>[] = [];
    for (const r of chainRoots) {
      const m = mf(r);
      if (m.first.chain && d < m.first.chain) continue;
      chainJobs.push(
        (async () => {
          const under = r === 'SPXW' ? 'SPX' : r;
          const range = rangeOf(under, d);
          const band = range ? { lo: range.low * (1 - opts.moneyness), hi: range.high * (1 + opts.moneyness) } : null;
          const last = isoAdd(d, opts.windowDays);
          const inWindow = (row: Row): boolean => {
            const e = expOf(row);
            if (!e || e < d || e > last) return false;
            if (!band) return true;
            const k = strikeOf(row);
            return k != null && k >= band.lo && k <= band.hi;
          };
          const slot = (m.days[d] ??= {});
          const exps = new Set<string>();
          const contractsFile = join(root, r, d, 'chain-contracts.ndjson.gz');
          const c = await call(m, slot, 'chain-contracts', '/option/list/contracts/quote', { symbol: r, date: compact(d) }, contractsFile, row => {
            const ok = inWindow(row);
            if (ok) exps.add(expOf(row)!);
            return ok;
          }, 'chain');
          if (c.s === 'ok' && exps.size === 0 && existsSync(contractsFile)) {
            /* a day held from an earlier run: its expirations are read back off the file */
            for (const line of gunzipSync(readFileSync(contractsFile)).toString('utf8').split('\n')) {
              if (!line) continue;
              try {
                const e = expOf(JSON.parse(line) as Row);
                if (e) exps.add(e);
              } catch {
                /* a bad line */
              }
            }
          }
          if (!band) note({ kind: 'note', ticker: r, day: d, text: 'no eod row for the day: the strikes were not banded' });
          await call(m, slot, 'chain-oi', '/option/history/open_interest', { symbol: r, expiration: '*', date: compact(d) }, join(root, r, d, 'chain-oi.ndjson.gz'), inWindow, 'chain');
          const inBand = (row: Row) => {
            if (!band) return true;
            const k = strikeOf(row);
            return k != null && k >= band.lo && k <= band.hi;
          };
          /* SPX'S THREE SESSIONS (core/sessions.ts — the owner's SPX overnight field, 2026-10-15): its roots read to the
             curb's end (5:00 pm), and its overnight session into the day — the evening before from 8:15 pm (asked on that
             calendar date) and the morning to 9:25 am — kept under the trading day; the front expiry a minute (the
             forward), the others every five */
          const allSessions = tradesAllSessions(r);
          const front = [...exps].sort()[0] ?? null;
          for (const e of [...exps].sort()) {
            await call(m, slot, `quotes:${e}`, '/option/history/quote', { symbol: r, expiration: compact(e), date: compact(d), interval: '1m', start_time: '09:30:00', end_time: allSessions ? '17:00:00' : '16:15:00' }, join(root, r, d, `chain-quotes-${e}.ndjson.gz`), inBand, 'chain');
            if (!allSessions) continue;
            const interval = e === front ? '1m' : '5m';
            const evening = isoAdd(d, -1);
            const g1 = await call(m, slot, `quotes-gth1:${e}`, '/option/history/quote', { symbol: r, expiration: compact(e), date: compact(evening), interval, start_time: '20:15:00', end_time: '23:59:59' }, join(root, r, d, `chain-quotes-gth1-${e}.ndjson.gz`), inBand, 'chain');
            const g2 = await call(m, slot, `quotes-gth2:${e}`, '/option/history/quote', { symbol: r, expiration: compact(e), date: compact(d), interval, start_time: '00:00:00', end_time: '09:25:00' }, join(root, r, d, `chain-quotes-gth2-${e}.ndjson.gz`), inBand, 'chain');
            noteOvernight(m, d, (g1.rows ?? 0) + (g2.rows ?? 0));
          }
        })()
      );
    }
    await Promise.all(chainJobs);

    for (const t of Object.values(tallies)) t.sessions++;
    done.push(d);
    const secs = (clock() - s0) / 1000;
    const bytes = sessionBytesBefore() - sb;
    log(`session ${d} (${si + 1} of ${sessions.length}): ${fmtBytes(bytes)} in ${(secs / 60).toFixed(1)} min`);

    /* THE REPORT after the first sessions (C2), and at the end: GB and minutes a session, the projection to each
       feed's first date, this machine's free disk — paused when the projection exceeds the free space */
    if (done.length === opts.reportAfter || si === sessions.length - 1) {
      const free = await statfs(root).then(s => s.bavail * s.bsize).catch(() => NaN);
      const oldest = done[done.length - 1];
      const remaining = (first: string | null): number => (first ? spyDates.filter(x => x >= first && x < oldest).length : 0);
      const lines: string[] = [];
      lines.push(`# The history download — ${done.length} session${done.length === 1 ? '' : 's'} walked, ${done[0]} back to ${oldest} (${((clock() - t0) / 60_000).toFixed(1)} min)`, '');
      lines.push('| feed | sessions | bytes a session | minutes a session | sessions to its first date | projected disk | projected time |', '|---|---|---|---|---|---|---|');
      let projBytes = 0;
      let projSecs = 0;
      const groupFirst: Record<string, string | null> = {
        stock: opts.stocks.map(t => mf(t).first.stock ?? null).filter((x): x is string => !!x).sort()[0] ?? null,
        nbbo: opts.nbbo.map(t => mf(t).first.stock ?? null).filter((x): x is string => !!x).sort()[0] ?? null,
        index: opts.indices.map(t => mf(t).first.index ?? null).filter((x): x is string => !!x).sort()[0] ?? null,
        chain: chainRoots.map(t => mf(t).first.chain ?? null).filter((x): x is string => !!x).sort()[0] ?? null,
        rates: null,
      };
      for (const [g, t] of Object.entries(tallies)) {
        const perS = t.sessions ? t.bytes / t.sessions : 0;
        const secPerS = t.sessions ? t.seconds / t.sessions : 0;
        const rem = remaining(groupFirst[g] ?? null);
        projBytes += t.bytes + perS * rem;
        projSecs += secPerS * rem;
        lines.push(`| ${g} | ${t.sessions} | ${fmtBytes(perS)} | ${(secPerS / 60).toFixed(1)} | ${rem} (to ${groupFirst[g] ?? '—'}) | ${fmtBytes(t.bytes + perS * rem)} | ${(secPerS * rem) / 3600 < 1 ? `${((secPerS * rem) / 60).toFixed(0)} min` : `${((secPerS * rem) / 3600).toFixed(1)} h`} |`);
      }
      lines.push('', `Projected total: ${fmtBytes(projBytes)} and ${(projSecs / 3600).toFixed(1)} h of calls (the gate's width by the clock not counted); free disk here: ${Number.isFinite(free) ? fmtBytes(free) : 'unknown'}.`);
      lines.push(`Per ticker, a chain root costs what the chain row says ÷ ${chainRoots.length || 1}; a stock what the stock row says ÷ ${opts.stocks.length || 1}.`);
      /* the overnight session: the oldest day each SPX root has served overnight rows on, and its days walked with and without */
      for (const r of chainRoots.filter(x => tradesAllSessions(x))) {
        const mm = mf(r);
        const seen = Object.entries(mm.days).filter(([, sl]) => Object.keys(sl).some(k => k.startsWith('gth-seen:')));
        const withRows = seen.filter(([, sl]) => Object.entries(sl).some(([k, e]) => k.startsWith('gth-seen:') && (e.rows ?? 0) > 0)).map(([day]) => day).sort();
        lines.push(`Overnight rows (${r}): ${withRows.length} of ${seen.length} sessions walked hold them; the oldest served ${mm.first.gth ?? '—'}${withRows.length ? `, the newest ${withRows[withRows.length - 1]}` : ''}.`);
      }
      if (Number.isFinite(free) && projBytes > free && !opts.force) {
        paused = true;
        lines.push('', `**PAUSED**: the projection (${fmtBytes(projBytes)}) exceeds the free disk (${fmtBytes(free)}). Free space or narrow the scope (HISTORY_TICKERS, HISTORY_FROM), then run again; HISTORY_FORCE=1 goes on regardless.`);
      }
      report = lines.join('\n');
      const runDir = join(root, 'runs');
      mkdirSync(runDir, { recursive: true });
      writeFileSync(join(runDir, `report-${new Date(clock()).toISOString().replace(/[:T]/g, '-').slice(0, 19)}.md`), report);
      writeFileSync(join(root, 'report.md'), report);
      log(report);
      if (paused) break;
    }
  }
  return { sessions: done, paused, report, tallies };
}

/* ---- the command line ----------------------------------------------------------------------------------------------- */
if (process.argv[1]?.replace(/\\/g, '/').endsWith('theta-history/index.ts')) {
  const env = { ...parseEnv('.env'), ...process.env } as Record<string, string | undefined>;
  const stamp = () => new Date().toISOString().slice(11, 19);
  const opts = optionsFromEnv(env, l => console.log(`${stamp()} ${l}`));
  void runHistory(opts).then(r => {
    console.log(`${stamp()} done: ${r.sessions.length} sessions${r.paused ? ' — PAUSED (see report.md)' : ''}`);
    process.exit(r.paused ? 3 : 0);
  });
}
