/*
==================================================
  SLAYER TERMINAL - THETA DATA (data/feed/theta.ts)

  The owner's key, 2026-10-14 ("i have a new api key for
  you to use, you can disable the massive ones and use
  this one"). Theta Data answers through the Theta
  Terminal running on this machine (server/feed.ts, the
  proxy at /feed/theta/v3/* — the terminal holds the
  key; it never leaves the server); the proxy hands
  every answer back as JSON { rows }, one row a line of
  the terminal's own, its field names as they are.

  WHAT IT CARRIES HERE (each seen live, 2026-10-14; the
  account reads Professional for stocks, options and
  indices):
    · a name's one-minute bars, 04:00 to 20:00 New York,
      the consolidated tape (venue utp_cta) — a month at
      most a call (its own limit: "Bulk history requests
      are limited to no more than 1 month")
    · a name's day bars — Theta's end-of-day report (a
      year at most a call); its close equalled the
      official close on 251 of 252 sessions to Oct 13 (Oct
      13: 778.05 against 778.01), so UW's rows stand over
      it wherever both carry a date
    · the contracts that quoted on a date
    · a contract's minutes on a date, folded by the proxy
      from its own trades (/feed/theta-minutes/option) —
      the minute's own VWAP, never the session's running
      one the terminal's bars carry
  Timestamps come as New York's wall clock with no
  offset ("2026-10-13T09:30:00.000"); a bar's stamp is
  its opening minute.
==================================================
*/

import { nyWallTime } from '../../core/nyTime';
import { feedFetch, feedGet, type FeedResult } from './client';

/** A bar as the rooms read it: the minute's (or the day's) start, epoch ms, and its prices — Massive's minute bars'
    shape, so a room moved from Massive reads it unchanged; `vw` the bar's own volume-weighted average, `n` its prints */
export interface ThetaBar {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  vw?: number;
  n?: number;
}

const rowsOf = (body: unknown): Record<string, unknown>[] => {
  const rows = (body as { rows?: unknown }).rows;
  if (!Array.isArray(rows)) throw new Error('shape');
  return rows as Record<string, unknown>[];
};
const fin = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/* New York's wall clock to an instant: the offset a date has at noon holds from 04:00 to 20:00 (a clock change is at
   02:00) — read once a date */
const noonOffset = new Map<string, number>();
export function nyStampMs(stamp: string): number {
  const d = stamp.slice(0, 10);
  let off = noonOffset.get(d);
  const [y, m, da] = d.split('-').map(Number);
  if (off === undefined) {
    off = nyWallTime(y, m, da, 12, 0) - Date.UTC(y, m - 1, da, 12, 0);
    if (noonOffset.size > 5000) noonOffset.clear();
    noonOffset.set(d, off);
  }
  const h = Number(stamp.slice(11, 13)) || 0;
  const mi = Number(stamp.slice(14, 16)) || 0;
  const s = Number(stamp.slice(17, 23)) || 0;
  return Date.UTC(y, m - 1, da, h, mi) + Math.round(s * 1000) + off;
}

/** "2026-10-13" → "20261013" */
const compact = (iso: string) => iso.replace(/-/g, '');
/** The days from `from` to `to` (ISO, inclusive) in spans of at most `days` */
export function spans(from: string, to: string, days: number): [string, string][] {
  const out: [string, string][] = [];
  const day = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
  const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  let a = day(from);
  const end = day(to);
  while (a <= end) {
    const b = Math.min(end, a + (days - 1) * 86_400_000);
    out.push([iso(a), iso(b)]);
    a = b + 86_400_000;
  }
  return out;
}

/** Many spans' answers as one: every row in order, or the first failure */
async function joined<T>(calls: Promise<FeedResult<T[]>>[]): Promise<FeedResult<T[]>> {
  const all = await Promise.all(calls);
  const bad = all.find(r => !r.ok);
  if (bad) return bad;
  return { ok: true, data: all.flatMap(r => (r.ok ? r.data : [])), at: Math.max(...all.map(r => (r.ok ? r.at : 0))) };
}

const barOf = (r: Record<string, unknown>): ThetaBar | null => {
  const o = fin(r.open);
  const h = fin(r.high);
  const l = fin(r.low);
  const c = fin(r.close);
  const stamp = typeof r.timestamp === 'string' ? r.timestamp : null;
  /* a minute with no print has no prices (0): it is not a bar */
  if (!stamp || !(o! > 0 && h! > 0 && l! > 0 && c! > 0)) return null;
  return { t: nyStampMs(stamp), o: o!, h: h!, l: l!, c: c!, v: fin(r.volume) ?? 0, n: fin(r.count) ?? undefined };
};

/**
 * A NAME'S ONE-MINUTE BARS, 04:00 to 20:00 New York (09:30 to 16:00 with `regular`), from `from` to `to` (ISO dates): the
 * consolidated tape (venue utp_cta), a call a month at most. GET /v3/stock/history/ohlc?symbol&start_date&end_date&interval=1m.
 */
export const thetaStockMinutes = (symbol: string, from: string, to: string, opts: { regular?: boolean } = {}): Promise<FeedResult<ThetaBar[]>> =>
  joined(
    spans(from, to, 28).map(([a, b]) =>
      feedGet('theta', '/v3/stock/history/ohlc', { symbol, start_date: compact(a), end_date: compact(b), interval: '1m', venue: 'utp_cta', start_time: opts.regular ? '09:30:00' : '04:00:00', end_time: opts.regular ? '16:00:00' : '20:00:00' }, body =>
        rowsOf(body)
          .map(barOf)
          .filter((x): x is ThetaBar => !!x)
      )
    )
  );

/**
 * A NAME'S DAY BARS from `from` to `to`: Theta's end-of-day report (generated at 17:15 New York), a year at most a call,
 * each stamped at noon of its New York date. GET /v3/stock/history/eod?symbol&start_date&end_date.
 */
export const thetaStockDays = (symbol: string, from: string, to: string): Promise<FeedResult<ThetaBar[]>> =>
  joined(
    spans(from, to, 365).map(([a, b]) =>
      feedGet('theta', '/v3/stock/history/eod', { symbol, start_date: compact(a), end_date: compact(b) }, body =>
        rowsOf(body)
          .map(r => {
            const created = typeof r.created === 'string' ? r.created.slice(0, 10) : null;
            const o = fin(r.open);
            const h = fin(r.high);
            const l = fin(r.low);
            const c = fin(r.close);
            if (!created || !(o! > 0 && h! > 0 && l! > 0 && c! > 0)) return null;
            return { t: nyStampMs(`${created}T12:00:00.000`), o: o!, h: h!, l: l!, c: c!, v: fin(r.volume) ?? 0 } as ThetaBar;
          })
          .filter((x): x is ThetaBar => !!x)
      )
    )
  );

/** A contract that quoted on a date */
export interface ThetaContract {
  symbol: string;
  expiration: string;
  strike: number;
  right: 'C' | 'P';
}
/** THE CONTRACTS THAT QUOTED ON A DATE for an underlying (the closest Theta has to a listing as of a date — every listed
    contract quotes). GET /v3/option/list/contracts/quote?symbol&date */
export const thetaContractsOn = (symbol: string, date: string, maxDte?: number): Promise<FeedResult<ThetaContract[]>> =>
  feedGet('theta', '/v3/option/list/contracts/quote', { symbol, date: compact(date), max_dte: maxDte }, body =>
    rowsOf(body)
      .map(r => {
        const strike = fin(r.strike);
        const right = r.right === 'CALL' ? 'C' : r.right === 'PUT' ? 'P' : null;
        if (typeof r.symbol !== 'string' || typeof r.expiration !== 'string' || strike == null || !right) return null;
        return { symbol: r.symbol, expiration: r.expiration.slice(0, 10), strike, right } as ThetaContract;
      })
      .filter((x): x is ThetaContract => !!x)
  );

/**
 * A CONTRACT'S MINUTES ON A DATE, folded by the proxy from the contract's own trades — the minute's own
 * volume-weighted average (`vw`), its prints (`n`); a minute with no trade has no row.
 */
export async function thetaContractMinutes(c: { underlying: string; expiry: string; strike: number; right: 'C' | 'P' }, date: string): Promise<FeedResult<ThetaBar[]>> {
  const q = new URLSearchParams({ symbol: c.underlying, expiration: compact(c.expiry), strike: String(c.strike), right: c.right === 'C' ? 'call' : 'put', date: compact(date) });
  const r = await feedFetch(`/feed/theta-minutes/option?${q.toString()}`);
  if (!r.ok) return r;
  try {
    const rows = rowsOf(r.data) as unknown as ThetaBar[];
    return { ok: true, data: rows.filter(b => Number.isFinite(b.t) && b.v > 0), at: r.at };
  } catch {
    return { ok: false, reason: 'shape', status: 200 };
  }
}

/** The day the market keeps today: open, early close, full close or weekend, with its hours (New York) */
export const thetaCalendarToday = (): Promise<FeedResult<{ type: string; open: string | null; close: string | null }>> =>
  feedGet('theta', '/v3/calendar/today', undefined, body => {
    const r = rowsOf(body)[0] ?? {};
    return { type: String(r.type ?? ''), open: typeof r.open === 'string' ? r.open : null, close: typeof r.close === 'string' ? r.close : null };
  });
