/*
==================================================
  SLAYER TERMINAL - THE PRICED MOVE, SERVED (server/pricedMove.ts)

  THE DAY'S BUDGET, THE PROFILE AND THE CALIBRATION
  (2026-10-13 — the owner's item 4; the engine is
  src/data/feed/pricedMove.ts, the straddle's vol trailModel
  `straddleVol` / `sigmaOf`).

  THE BUDGET for session D, point in time (the plan: "(a)
  uses D−1 4:00 p.m. prices only"):
    · the session before D, its official close — UW's
      daily bar for the regular session (`market_time`
      'r'; 778.10 for Oct 12, the official close, not the
      3:59 bar's 778.06) — an index's the last regular
      minute of its tape's prices;
    · the dated chain of the session before (option-
      chains?date=D−1&greeks=true), its expiries through a
      week after D: the at-the-money straddle on the expiry
      settling D and on the weekly, priced at 4:00 pm —
      the recorder's last read 3:45 to 4:00 pm (its NBBO
      mids), else the legs' traded price in their last
      minute to 3:59 pm, else the dated chain's NBBO (late
      quotes, stamped to about 5:30 pm) — each solved for
      its vol at its strike on UW's clock and applied at
      the money: 1σ in dollars (an index reads its weekly
      root's rows);
    · THE CROSS-CHECK, logged, never shown: UW's term
      structure for D−1 (implied_move on D's expiry ÷ 0.85
      — UW's implied move is 85% of the straddle) and its
      interpolated one-day implied move. UW's SPX term
      structure lists the AM-settled expiries alone with no
      implied_move, so an index has no cross-check.
  Kept as .feed-cache/field/<NAME>/<D>/move.json, asked
  once (about five calls a day).

  THE PROFILE for D: the trailing 60 sessions before D,
  their minute bars on disk (the backfill's, an index's
  tape prices).

  THE CALIBRATION: every session on disk with a budget and
  bars — written by the nightly scorecard job as
  .feed-cache/field/<NAME>/move-calibration.json.

  THE CLOSE: once the session has closed, its official
  close (UW's daily bar; an index its tape's last regular
  minute) — the calibration's and the chart's, never the
  3:59 pm bar.

  Served by GET /feed/field/<NAME>/move?day=<D>.
==================================================
*/

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { lastTradeOf, parseOcc, sigmaOf, straddleExpiries, straddleFromChain, straddleVol, uwYears, type ChainRow, type StraddleRead } from '../src/data/feed/trailModel';
import { calibrate, calibrationLines, profileOf, UW_IMPLIED_SHARE, type Calibration, type CalibrationDay, type MoveBar } from '../src/data/feed/pricedMove';
import { nyMinuteOf } from '../src/data/feed/trackRecord';
import { nyWallTime } from '../src/core/nyTime';
import { INDEX_ROOTS } from './tapeBackfill';
import type { FeedClient } from './feed';
import type { createFieldBackfill, MinuteBar } from './fieldBackfill';

type FieldBackfill = ReturnType<typeof createFieldBackfill>;
const ROOT = join(process.cwd(), '.feed-cache', 'field');
const FILE = 'move.json';
const CALIBRATION = 'move-calibration.json';
/** The format of move.json — a change of what it holds is a new number (the file is asked again) */
export const MOVE_FORMAT = 2;
const PROFILE_SESSIONS = 60;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const INDICES = new Set(['SPX', 'NDX', 'RUT', 'VIX']);
const WEEKLY_ROOTS = new Set(Object.keys(INDEX_ROOTS));

export type StraddleFrom = 'live-read' | 'trades-4pm' | 'closing-quotes';
export interface Budget {
  format: number;
  name: string;
  day: string;
  prev: string;
  prevClose: number;
  /** Where the prior close came from */
  closeFrom: 'daily-bar' | 'tape' | 'store';
  /** Where the 4:00 pm straddle came from: the recorder's last chain read before 4:00 pm on the session before (its
      NBBO mids), the two legs' traded price in the 3:59 pm minute (UW's per-contract minutes), or the dated chain's
      closing quotes (stamped after 4:00 pm — 2026-10-13: 4.02 against 4.14 at the 3:55 pm read and UW's 4.12) */
  today: { read: StraddleRead; sigma: number; from: StraddleFrom } | null;
  weekly: { read: StraddleRead; sigma: number; from: StraddleFrom } | null;
  /** UW's own figures for the same expiry, logged beside ours (the plan's acceptance (ii)) */
  cross: { uwImplied: number | null; uwStraddle: number | null; ours: number | null; diff: number | null; uwOneDayPerc: number | null } | null;
  builtAt: number;
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

export function createPricedMove(client: FeedClient, backfill: FieldBackfill, opts: { root?: string; now?: () => number; log?: (line: string) => void } = {}) {
  const root = opts.root ?? ROOT;
  const clock = opts.now ?? Date.now;
  const getRows = async (path: string): Promise<Record<string, unknown>[] | null> => {
    const a = await client.get('uw', path);
    if (a.status !== 200) return null;
    try {
      return (JSON.parse(a.body) as { data?: Record<string, unknown>[] }).data ?? [];
    } catch {
      return null;
    }
  };

  /** The session before D's official close */
  async function priorClose(name: string, day: string, prev: string): Promise<{ close: number; from: Budget['closeFrom'] } | null> {
    if (INDICES.has(name)) {
      const bars = await backfill.minutes(name, prev);
      const last = bars?.filter(b => b.session === 'r').sort((a, b) => a.time - b.time).pop();
      return last ? { close: last.close, from: 'tape' } : null;
    }
    /* asked by the session before's own date first — a call naming D is made only when that answer lacks the row */
    for (const date of [prev, day]) {
      const rows = await getRows(`/api/stock/${name}/ohlc/1d?date=${date}&limit=12`);
      const r = rows?.find(x => String(x.date) === prev && x.market_time === 'r');
      const c = num(r?.close);
      if (c && c > 0) return { close: c, from: 'daily-bar' };
    }
    return null;
  }

  /** A session's OFFICIAL close once it has closed (UW's daily bar for the regular session — the 3:59 pm bar is not the
      close: 778.01 on Oct 13 against the bar's 778.06), kept as the day's close.json; an index's the last regular
      minute of its tape prices. Null while the session runs or before the vendor has it. */
  async function officialClose(name: string, day: string): Promise<{ close: number; from: Budget['closeFrom'] } | null> {
    const file = join(root, name, day, 'close.json');
    try {
      const had = JSON.parse(readFileSync(file, 'utf8')) as { close: number; from: Budget['closeFrom'] };
      if (had.close > 0) return had;
    } catch {
      /* not kept yet */
    }
    const [y, m, d] = day.split('-').map(Number);
    /* THE SESSION IS OVER AT 4:00 PM NEW YORK (2026-10-14 — the session recap at 4:05 pm, the owner's item 9; this waited
       for 21:00 UTC, 5:00 pm in daylight time): the regular session's daily bar is read from 4:01 pm and KEPT from 4:30
       pm, so a bar the vendor is still settling is read again rather than kept */
    if (clock() < nyWallTime(y, m, d, 16, 1)) return null;
    const keep = clock() >= nyWallTime(y, m, d, 16, 30);
    let got: { close: number; from: Budget['closeFrom'] } | null = null;
    if (INDICES.has(name)) {
      const bars = await backfill.minutes(name, day);
      const last = bars?.filter(b => b.session === 'r').sort((a, b) => a.time - b.time).pop();
      got = last ? { close: last.close, from: 'tape' } : null;
    } else {
      /* twelve rows: UW's answer for a date often leads with the next session's three (2026-10-12 asked with three rows
         answered Oct 13's alone) */
      const rows = await getRows(`/api/stock/${name}/ohlc/1d?date=${day}&limit=12`);
      const c = num(rows?.find(x => String(x.date) === day && x.market_time === 'r')?.close);
      got = c && c > 0 ? { close: c, from: 'daily-bar' } : null;
    }
    if (got && keep) {
      mkdirSync(join(root, name, day), { recursive: true });
      writeFileSync(file, JSON.stringify(got));
    }
    return got;
  }

  /** The recorder's last chain read on a day received 3:45 to 4:00 pm New York with quotes — the rows, or null */
  function lastReadBefore4(name: string, day: string): ChainRow[] | null {
    const [y, m, d] = day.split('-').map(Number);
    const from = Date.UTC(y, m - 1, d, 0, 0);
    const lines: string[] = [];
    for (const f of ['chain.jsonl', 'chain.jsonl.gz']) {
      const file = join(root, name, day, f);
      if (!existsSync(file)) continue;
      try {
        const text = f.endsWith('.gz') ? gunzipSync(readFileSync(file)).toString('utf8') : readFileSync(file, 'utf8');
        lines.push(...text.split('\n').filter(Boolean));
      } catch {
        /* a file cut short */
      }
    }
    let best: { at: number; rows: ChainRow[] } | null = null;
    for (const l of lines) {
      try {
        const r = JSON.parse(l) as { receivedAt: number; rows: ChainRow[] };
        const mi = nyMinuteOf(r.receivedAt);
        if (r.receivedAt < from || mi < 15 * 60 + 45 || mi >= 16 * 60 || !r.rows.length || r.rows[0].length < 6) continue;
        if (!best || r.receivedAt > best.at) best = { at: r.receivedAt, rows: r.rows };
      } catch {
        /* a line cut short */
      }
    }
    return best?.rows ?? null;
  }
  /** The two legs' traded price in the last regular minute at or before 3:59 pm New York that each traded in (the
      minute's volume-weighted average, UW's per-contract minutes) — null without both */
  async function tradedAt4(strike: number, expiry: string, day: string, chain: readonly ChainRow[]): Promise<{ c: number; p: number } | null> {
    const legs = chain.filter(r => {
      const o = parseOcc(r[0]);
      return o && o.expiry === expiry && o.strike === strike;
    });
    const call = legs.find(r => parseOcc(r[0])?.right === 'C');
    const put = legs.find(r => parseOcc(r[0])?.right === 'P');
    if (!call || !put) return null;
    const price = async (sym: string): Promise<number | null> => {
      const rows = await getRows(`/api/option-contract/${sym}/intraday?date=${day}`);
      let best: { m: number; p: number } | null = null;
      for (const r of rows ?? []) {
        const t = Date.parse(String(r.start_time));
        const mi = nyMinuteOf(t);
        const p = num(r.avg_price);
        if (!Number.isFinite(t) || mi < 15 * 60 + 30 || mi > 15 * 60 + 59 || p == null || !(p > 0)) continue;
        if (!best || mi > best.m) best = { m: mi, p };
      }
      return best?.p ?? null;
    };
    const c = await price(call[0]);
    const p = await price(put[0]);
    return c != null && p != null ? { c, p } : null;
  }

  /** THE BUDGET for session D (cached) — null where the session before has no chain or no close */
  async function budget(rawName: string, day: string): Promise<Budget | null> {
    const name = rawName.toUpperCase();
    if (!ISO.test(day)) return null;
    const file = join(root, name, day, FILE);
    try {
      const had = JSON.parse(readFileSync(file, 'utf8')) as Budget;
      if (had.format === MOVE_FORMAT) return had;
    } catch {
      /* not built yet */
    }
    /* the session before D: weekdays back, a holiday (an empty dated chain) stepped over */
    let prev = isoAdd(day, -1);
    let rows: Record<string, unknown>[] | null = null;
    for (let tries = 0; tries < 5; tries++) {
      while (weekdayOf(prev) === 0 || weekdayOf(prev) === 6) prev = isoAdd(prev, -1);
      const got = await backfill.chainOn(name, prev, isoAdd(day, 7));
      if (!got) return null;
      if (got.rows.length) {
        rows = got.rows;
        break;
      }
      prev = isoAdd(prev, -1);
    }
    if (!rows) return null;
    const pc = await priorClose(name, day, prev);
    if (!pc) return null;
    /* an index's PM weekly root where it lists the expiry (SPXW beside SPX's AM monthly on a third Friday) */
    const weeklyRooted = new Set(rows.filter(r => WEEKLY_ROOTS.has(String(r.option_symbol ?? '').replace(/\d.*$/, ''))).map(r => String(r.expires)));
    const chain: ChainRow[] = rows
      .filter(r => {
        const sym = String(r.option_symbol ?? '');
        const rootName = sym.replace(/\d.*$/, '');
        return !weeklyRooted.has(String(r.expires)) || WEEKLY_ROOTS.has(rootName);
      })
      .map(r => [String(r.option_symbol ?? ''), num(r.open_interest) ?? 0, num(r.implied_volatility), null, num(r.nbbo_bid), num(r.nbbo_ask), num(r.volume) ?? 0]);
    const exps = straddleExpiries(
      rows.map(r => String(r.expires ?? '')),
      day
    );
    /* the prior close's moment: 4:00 pm New York on the session before, UW's clock from it to each expiry */
    const at = (iso: string) => {
      const [y, m, d] = iso.split('-').map(Number);
      return Date.UTC(y, m - 1, d, 20, 0);
    };
    /* THE 4:00 PM STRADDLE (the plan: "priced at 4:00 p.m. ET on D−1"): the recorder's last read before 4:00 pm with
       quotes; else the legs' traded price in the 3:59 pm minute; else the dated chain's closing quotes */
    const liveRows = lastReadBefore4(name, prev);
    const read = async (expiry: string | null) => {
      if (!expiry) return null;
      const tau = uwYears(at(prev), lastTradeOf(expiry), expiry, prev);
      const close = straddleFromChain(chain, expiry, pc.close, tau);
      if (!close) return null;
      let r: StraddleRead | null = liveRows ? straddleFromChain(liveRows, expiry, pc.close, tau) : null;
      let from: StraddleFrom = 'live-read';
      if (!r) {
        const legs = await tradedAt4(close.strike, expiry, prev, chain);
        if (legs) {
          r = { expiry, strike: close.strike, value: legs.c + legs.p, src: 'nbbo', call: legs.c, put: legs.p, tau, spot: pc.close };
          r.iv = straddleVol(pc.close, close.strike, tau, r.value);
          from = 'trades-4pm';
        }
      }
      if (!r) {
        r = close;
        from = 'closing-quotes';
      }
      const sigma = sigmaOf(r);
      return sigma != null && sigma > 0 ? { read: r, sigma, from } : null;
    };
    const today = await read(exps.today);
    const weekly = await read(exps.weekly);
    /* THE CROSS-CHECK, logged: UW's implied move on D's expiry, read on D−1 */
    let cross: Budget['cross'] = null;
    if (today) {
      const term = await getRows(`/api/stock/${name}/volatility/term-structure?date=${prev}`);
      const iiv = await getRows(`/api/stock/${name}/interpolated-iv?date=${prev}`);
      const uwImplied = num(term?.find(r => String(r.expiry) === day)?.implied_move);
      const uwStraddle = uwImplied != null ? uwImplied / UW_IMPLIED_SHARE : null;
      cross = {
        uwImplied,
        uwStraddle,
        ours: today.read.value,
        diff: uwStraddle != null ? today.read.value / uwStraddle - 1 : null,
        uwOneDayPerc: num(iiv?.find(r => Number(r.days) === 1)?.implied_move_perc),
      };
      opts.log?.(`move ${name} ${day}: straddle ${today.read.value.toFixed(2)} at ${today.read.strike} (${today.from}; σ ${today.sigma.toFixed(2)}) against UW's implied ÷ 0.85 ${uwStraddle?.toFixed(2) ?? '—'} (${cross.diff != null ? `${(cross.diff * 100).toFixed(1)}%` : '—'})`);
    }
    const b: Budget = { format: MOVE_FORMAT, name, day, prev, prevClose: pc.close, closeFrom: pc.from, today, weekly, cross, builtAt: clock() };
    mkdirSync(join(root, name, day), { recursive: true });
    writeFileSync(file, JSON.stringify(b));
    return b;
  }

  /** The sessions on disk for a name, ascending (built sessions and store days alike) */
  const daysOn = (name: string): string[] => {
    try {
      return readdirSync(join(root, name))
        .filter(d => ISO.test(d))
        .sort();
    } catch {
      return [];
    }
  };
  const asMove = (bars: MinuteBar[]): MoveBar[] => bars.filter(b => b.session === 'r').map(b => ({ time: b.time, open: b.open ?? b.close, high: b.high ?? b.close, low: b.low ?? b.close, close: b.close }));

  /** THE PROFILE for D: the trailing sessions before D with minute bars on disk */
  async function profile(rawName: string, day: string): Promise<{ share: number[]; sessions: number }> {
    const name = rawName.toUpperCase();
    const before = daysOn(name).filter(d => d < day);
    const sessions: MoveBar[][] = [];
    for (let i = before.length - 1; i >= 0 && sessions.length < PROFILE_SESSIONS; i--) {
      const has = existsSync(join(root, name, before[i], 'bars.json.gz')) || existsSync(join(root, name, before[i], 'tape-price.json'));
      if (!has) continue;
      const b = await backfill.minutes(name, before[i]);
      if (b?.length) sessions.push(asMove(b));
    }
    return profileOf(sessions, nyMinuteOf);
  }

  /** THE PRICED MOVE'S ROW FOR ONE SESSION — what the calibration counts and the session recap (server/recap.ts)
      prints, so the two read one row: the budget, the regular minutes' high and low, the official close (the last
      regular minute's only while the official one is not in, said in `closeFrom`); `at10` off the session's rows */
  async function calibrationDay(rawName: string, day: string, at10: CalibrationDay['at10']): Promise<{ row: CalibrationDay; from: StraddleFrom } | { why: string }> {
    const name = rawName.toUpperCase();
    const has = existsSync(join(root, name, day, 'bars.json.gz')) || existsSync(join(root, name, day, 'tape-price.json'));
    if (!has) return { why: 'No minute bars for the session on this machine.' };
    const b = await budget(name, day);
    if (!b?.today) return { why: 'No budget for the session: the session before has no chain or no close, or no expiry settles on the day.' };
    const bars = await backfill.minutes(name, day);
    const reg = bars ? asMove(bars).sort((x, y) => x.time - y.time) : [];
    if (reg.length < 300) return { why: `Only ${reg.length} regular minutes for the session.` };
    /* the session's official close, never its 3:59 pm bar while the official one is in */
    const official = await officialClose(name, day);
    const close = official?.close ?? reg[reg.length - 1].close;
    return {
      row: { day, prevClose: b.prevClose, sigmaDay: b.today.sigma, close, high: Math.max(...reg.map(x => x.high)), low: Math.min(...reg.map(x => x.low)), at10: at10 ?? null, closeFrom: official ? 'official' : 'bar' },
      from: b.today.from,
    };
  }

  /** THE CALIBRATION over every session on disk with a budget and bars; `at10` handed in by the scorecard job (it has
      the session's rows) */
  async function calibration(rawName: string, at10: Map<string, CalibrationDay['at10']>): Promise<Calibration> {
    const name = rawName.toUpperCase();
    const days: CalibrationDay[] = [];
    for (const day of daysOn(name)) {
      const got = await calibrationDay(name, day, at10.get(day) ?? null);
      if ('row' in got) days.push(got.row);
    }
    const c = calibrate(days);
    mkdirSync(join(root, name), { recursive: true });
    writeFileSync(join(root, name, CALIBRATION), JSON.stringify({ name, builtAt: clock(), calibration: c, lines: calibrationLines(c), days }));
    return c;
  }

  /** GET /feed/field/<NAME>/move?day=<D>: the day's budget, its profile and the calibration */
  async function serve(rawName: string, day: string): Promise<{ status: number; body: string }> {
    const name = rawName.toUpperCase();
    if (!/^[A-Z][A-Z0-9.]{0,9}$/.test(name) || !ISO.test(day)) return { status: 400, body: JSON.stringify({ error: 'bad-request' }) };
    if (!client.hasKey('uw')) return { status: 503, body: JSON.stringify({ error: 'no-key' }) };
    const b = await budget(name, day);
    const p = await profile(name, day);
    let calib: unknown = null;
    try {
      calib = JSON.parse(readFileSync(join(root, name, CALIBRATION), 'utf8'));
    } catch {
      /* the nightly job has not run */
    }
    /* once the session has closed, its official close — the chart's readout measures the session to it */
    const close = b ? await officialClose(name, day) : null;
    return { status: 200, body: JSON.stringify({ budget: b, profile: p, calibration: calib, close: close?.close ?? null }) };
  }

  return { budget, profile, calibration, calibrationDay, officialClose, serve };
}
export type PricedMove = ReturnType<typeof createPricedMove>;
