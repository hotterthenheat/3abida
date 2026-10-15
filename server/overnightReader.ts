/*
==================================================
  SLAYER TERMINAL - SPX OUTSIDE ITS INDEX'S HOURS (server/overnightReader.ts)

  2026-10-15 — the owner, "SPX OVERNIGHT FIELD": read SPX/SPXW in all three of Cboe's sessions; price the field off the
  forward its at-the-money options imply, never the last index print; mark the vols from wide quotes.

  UW serves none of it (checked live at 10:30 pm New York, 2026-10-14: its per-contract minutes stop at 4:14 pm, labelled
  `rth`; its flow carries the curb, labelled `curb`, with no underlying price; nothing overnight, two hours into Cboe's
  session). Theta's terminal does — on the owner's machine (one terminal a key; this file never starts one). The
  recorder (server/fieldRecorder.ts) calls it for SPX whenever the index is not printing inside a session: the
  overnight session, 4:00 to 4:15 pm and the curb.

  · THE FORWARD, every minute: the front SPXW expiry's quotes round the money (/v3/option/snapshot/quote, strike_range)
    → data/feed/forward.ts forwardOf — the median of the three nearest-parity strikes' K + e^{rT}(C − P).
  · THE CHAIN, every ten minutes: every SPXW and SPX expiry within 60 days (expiration=*, max_dte) within the band of the
    forward → each quote's mid solved for its vol at the forward on UW's clock and carry (solveQuote), with its width in
    vol — a ChainRow whose eighth figure marks it (trailModel: over WIDE_VOL the vol is `wide`). Open interest is the
    newest count the recorder holds (UW's chain read, else the seed's) — Theta's is not asked live.

  Pure parsing here; the calls go through the proxy's own client (its Theta gate, its scrubbing).
==================================================
*/
import { forwardOf, solveQuote, type Forward, type QuoteLeg } from '../src/data/feed/forward';
import { nyStampMs } from '../src/data/feed/theta';
import { lastTradeOf, uwYears, UW_VOL_CONVENTION } from '../src/data/feed/trailModel';
import type { FeedClient } from './feed';
import type { ChainRow } from './fieldRecorder';

/** Strikes asked each side of the money for the forward (SPXW lists 5-point strikes near it) */
export const FRONT_STRIKES = 12;
/** The chain's band round the forward, as the recorder's UW read keeps */
const BAND = 0.15;
const MAX_DTE = 60;

export interface ThetaQuote {
  root: string;
  expiry: string;
  strike: number;
  right: 'C' | 'P';
  bid: number;
  ask: number;
  /** the quote's own time, epoch ms (New York's wall clock as Theta stamps it) */
  at: number;
}

const num = (v: unknown): number => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);
/** Theta's expiration as an ISO date: "2026-10-15", "20261015" or 20261015 */
export function isoOfExpiration(v: unknown): string | null {
  const s = String(v ?? '').replace(/[^0-9]/g, '');
  return s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : null;
}
/** One row of Theta's quote answer, read defensively (v3 names; a strike in dollars, or in thousandths as v2 wrote it) */
export function quoteOfRow(row: Record<string, unknown>, rootFallback: string): ThetaQuote | null {
  const expiry = isoOfExpiration(row.expiration);
  const r = String(row.right ?? '').trim().toUpperCase()[0];
  let strike = num(row.strike);
  if (strike > 100_000) strike /= 1000;
  const bid = num(row.bid);
  const ask = num(row.ask);
  const stamp = row.timestamp ?? row.ms_of_day ?? row.time;
  const at = typeof stamp === 'string' ? nyStampMs(stamp) : NaN;
  if (!expiry || (r !== 'C' && r !== 'P') || !(strike > 0) || !Number.isFinite(bid) || !Number.isFinite(ask)) return null;
  return { root: String(row.symbol ?? rootFallback).toUpperCase(), expiry, strike, right: r, bid, ask, at };
}
/** The OCC symbol the field keys a contract by: SPXW261015C07720000 */
export const occOf = (q: Pick<ThetaQuote, 'root' | 'expiry' | 'right' | 'strike'>): string => `${q.root}${q.expiry.slice(2, 4)}${q.expiry.slice(5, 7)}${q.expiry.slice(8, 10)}${q.right}${String(Math.round(q.strike * 1000)).padStart(8, '0')}`;

/** Why the newest Theta call gave nothing: 'no-terminal' (none signed in on this machine), 'no-answer' (an empty or
    refused answer) — the page says it over SPX's empty minutes */
export let lastThetaWhy: 'no-terminal' | 'no-answer' | null = null;
async function quotes(client: FeedClient, path: string, root: string): Promise<ThetaQuote[] | null> {
  const a = await client.get('theta', path);
  if (a.status !== 200) {
    lastThetaWhy = /no-terminal/.test(a.body) ? 'no-terminal' : 'no-answer';
    return null;
  }
  try {
    const rows = (JSON.parse(a.body) as { rows?: Record<string, unknown>[] }).rows ?? [];
    lastThetaWhy = rows.length ? null : 'no-answer';
    return rows.map(r => quoteOfRow(r, root)).filter((q): q is ThetaQuote => !!q);
  } catch {
    lastThetaWhy = 'no-answer';
    return null;
  }
}
const compact = (iso: string) => iso.replace(/-/g, '');

/** The front expiry the forward is read off: the first listed SPXW expiry on or after the trading day */
export function frontExpiry(expiries: readonly string[], day: string): string | null {
  return [...expiries].filter(e => e >= day).sort()[0] ?? null;
}

/** THE FORWARD NOW: the front expiry's quotes round the money, solved by put-call parity — null when Theta answers none */
export async function readForward(client: FeedClient, day: string, front: string, now: number): Promise<(Forward & { expiry: string; at: number; quotes: number }) | null> {
  const got = await quotes(client, `/v3/option/snapshot/quote?symbol=SPXW&expiration=${compact(front)}&strike_range=${FRONT_STRIKES}`, 'SPXW');
  if (!got?.length) return null;
  const t = uwYears(now, lastTradeOf(front), front, day);
  const f = forwardOf(got as QuoteLeg[], t, UW_VOL_CONVENTION.r);
  if (!f) return null;
  let at = 0;
  for (const q of got) if (Number.isFinite(q.at) && q.at > at) at = q.at;
  return { ...f, expiry: front, at, quotes: got.length };
}

/** THE CHAIN NOW: every SPXW and SPX quote within 60 days and the band, each mid solved for its vol at the spot the
    forward implies (forward.ts Forward.spot) —
    ChainRows with the quote's width in vol as their eighth figure; `oi` the counts the recorder holds */
export async function readQuoteChain(client: FeedClient, day: string, spot: number, now: number, oi: ReadonlyMap<string, number>): Promise<{ rows: ChainRow[]; asked: number; solved: number; wide: number } | null> {
  const rows: ChainRow[] = [];
  let asked = 0;
  let solved = 0;
  let wide = 0;
  let any = false;
  for (const root of ['SPXW', 'SPX']) {
    const got = await quotes(client, `/v3/option/snapshot/quote?symbol=${root}&expiration=*&max_dte=${MAX_DTE}`, root);
    if (!got) continue;
    any = true;
    for (const q of got) {
      if (q.expiry < day || Math.abs(q.strike - spot) > spot * BAND) continue;
      asked++;
      const t = uwYears(now, lastTradeOf(q.expiry), q.expiry, day);
      if (!(t > 0)) continue;
      const s = solveQuote(q, spot, t, UW_VOL_CONVENTION.r);
      if (!s) continue;
      solved++;
      if (s.wide) wide++;
      const sym = occOf(q);
      rows.push([sym, oi.get(sym) ?? 0, Math.round(s.iv * 1e5) / 1e5, Number.isFinite(q.at) ? q.at : now, q.bid, q.ask, 0, Math.round(s.width * 1e5) / 1e5]);
    }
  }
  return any ? { rows, asked, solved, wide } : null;
}
