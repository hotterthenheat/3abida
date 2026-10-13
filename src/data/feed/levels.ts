/*
==================================================
  SLAYER TERMINAL - THE LEVELS ON THE FEED
  (data/feed/levels.ts)

  PINPOINT AND TERRAIN READ UNUSUAL WHALES
  (2026-10-12). When a room's seam says 'feed'
  (rooms.ts: UW up and the room wired), its pages
  read the book built here, and nothing of the
  house's: one market on one screen. When it says
  'stand-in' they read data/pinpointBook.ts exactly
  as before, and nothing here asks the vendor
  anything (every poll's key is null).

  WHAT READS WHAT
    · THE BOOK: GET /api/stock/{t}/spot-exposures/
      strike — gamma, delta, vanna and charm by
      strike from open interest, gamma from today's
      volume, every expiry together, and the price
      UW figured them at (every row carries it, an
      index too). A window round that price, 30
      strikes kept each side of it, as the house's
      book keeps (pinpointBook BOOK_WINDOW).
    · BY EXPIRY: …/spot-exposures/expiry-strike —
      the same rows cut by date, the first listed
      dates, for the Map's calendar and Terrain's
      expiry card.
    · OPEN INTEREST: …/oi-per-strike, today's count
      and the session before's (Building's overnight
      change); MAX PAIN: …/max-pain, a row a listed
      date; THE IMPLIED MOVE: …/interpolated-iv;
      TODAY'S VOLUME: …/flow-per-strike; THE BOOK
      THROUGH THE DAY: …/spot-exposures (the whole
      book's gamma a minute, with the price); BARS:
      …/ohlc/1m.

  THE HOUSE SIGN (core/walls.ts): negative is
  call-dominant, positive put-dominant. UW states
  gamma, vanna and charm with the calls positive and
  the puts turned negative, and delta as the
  contracts' own (calls positive, puts negative) —
  read live 2026-10-12 against the strikes either
  side of spot. Mapped: gamma, delta and the calls'
  vanna and charm are UW's negated; the puts' vanna
  and charm are UW's as they come. So the walls,
  the flip and the supreme are core/walls.ts's own
  pick on the vendor's own figures.

  NEVER INVENTED: a figure no answer carries is NaN
  here and "—" on the page, titled "not in the feed".
  A failed poll (a 429 while other sessions share the
  key, the network) keeps the last good answer — a
  page never flashes back to the house's book
  mid-session.
==================================================
*/

import { useMemo, useSyncExternalStore } from 'react';
import { pickFlip, pickWalls } from '../../core/walls';
import { nyDay, nyIsoDate, nyMinutes } from '../../core/nyTime';
import { isTradingDay } from '../../core/calendar';
import { useFeedPoll } from './poll';
import { useRoomSource, type FeedRoom } from './rooms';
import { useFeedStatus } from './status';
import type { FeedFail, FeedResult } from './client';
import {
  uwInterpolatedIv,
  uwMaxPain,
  uwOhlc,
  uwOiPerStrike,
  uwSpotExposures,
  uwSpotGexByExpiryStrike,
  uwSpotGexByStrike,
  uwFlowPerStrike,
  uwStockState,
  uwDailyBars,
  uwDarkpool,
  uwEarningsFor,
  type UwEarning,
  type UwImpliedMove,
  type UwMaxPain,
  type UwStrikeExposure,
} from './uw';
import type { ExposureLevels, ExposureProfileData, GreekSplit, StrikeExposure } from '../../types/gex';
import type { Candle, GexLevel, GexSnapshot } from '../../types/market';
import type { ExposureSurface, Greek, SurfaceExpiry } from '../exposureSurface';
import type { Sureness } from '../levelSureness';
import { massiveBars } from './massive';
import type { DarkPoolPrint } from '../../types/gex';
import type { TapeEarnings } from '../events';
import { bookSureness } from '../levelSureness';

/* ---- the switch ------------------------------------------------------------------------------------------------ */

export type LevelsSource = 'feed' | 'stand-in' | 'pending';

/** What a levels room reads now — 'pending' while it is wired and the shell's first probe is out (a page shows nothing
    rather than a flash of the house's book the feed then replaces) */
function useLevelsSource(room: FeedRoom): LevelsSource {
  const src = useRoomSource(room);
  const status = useFeedStatus();
  if (src === 'feed') return 'feed';
  return status.uw.state === 'unknown' ? 'pending' : 'stand-in';
}
export const usePinpointSource = (): LevelsSource => useLevelsSource('pinpoint');
export const useTerrainSource = (): LevelsSource => useLevelsSource('terrain');

/** Cash indices — UW gives them exposure, open interest and max pain, but no day state and no price bars on this plan
    (a CBOE grant; "Stock state data is not available for index ticker SPX", 422, seen 2026-10-12), so neither is asked */
const CASH_INDICES = new Set(['SPX', 'SPXW', 'NDX', 'NDXP', 'RUT', 'RUTW', 'VIX', 'VIXW', 'XSP', 'DJX', 'OEX', 'XND', 'XEO', 'MRUT']);
export const isCashIndex = (ticker: string): boolean => CASH_INDICES.has(ticker.toUpperCase());

/** The words a "—" carries */
export const NOT_IN_FEED = 'not in the feed';
const NAN_SPLIT: GreekSplit = { put: NaN, call: NaN, net: NaN };

/* ---- keeping the last good answer ------------------------------------------------------------------------------- */

const kept = new Map<string, { data: unknown; at: number }>();
/** The answer, or the last good one for the key when this one failed (a 429, the network) — null before any */
function keep<T>(key: string | null, r: FeedResult<T> | null): { data: T; at: number } | null {
  if (!key) return null;
  if (r?.ok) {
    const prev = kept.get(key);
    if (!prev || prev.data !== r.data) kept.set(key, { data: r.data, at: r.at });
    return kept.get(key) as { data: T; at: number };
  }
  return (kept.get(key) as { data: T; at: number } | undefined) ?? null;
}
const failOf = (r: FeedResult<unknown> | null): FeedFail | null => (r && !r.ok ? r.reason : null);

/* ---- the window round the price --------------------------------------------------------------------------------- */

/** Strikes kept each side of the price — the house's book (data/pinpointBook.ts BOOK_WINDOW) */
export const FEED_HALF = 30;
const known = new Map<string, { price: number; step: number }>();
/** The price a name's book was last figured at, if any */
export const knownPrice = (ticker: string): number | null => known.get(ticker.toUpperCase())?.price ?? null;

/** The strikes asked for: ±10% of the price, narrowed to about 32 strikes each side once the chain's step is known —
    rounded so the address (the proxy's cache key) holds still while the price wanders */
function windowOf(t: string, price: number): { lo: number; hi: number } {
  const step = known.get(t)?.step ?? 0;
  const half = step > 0 ? Math.min(price * 0.1, step * 34) : price * 0.1;
  const q = Math.pow(10, Math.max(0, Math.floor(Math.log10(Math.max(1, half))) - 0));
  const lo = Math.max(0, Math.floor((price - half) / q) * q);
  const hi = Math.ceil((price + half) / q) * q;
  return { lo, hi };
}

/** The chain's step near the price — the smallest gap among the strikes either side */
function stepNear(strikes: number[], price: number): number {
  const asc = [...strikes].sort((a, b) => a - b);
  let at = asc.findIndex(k => k >= price);
  if (at < 0) at = asc.length - 1;
  let step = Infinity;
  for (let i = Math.max(1, at - 6); i < Math.min(asc.length, at + 6); i++) {
    const d = asc[i] - asc[i - 1];
    if (d > 1e-9) step = Math.min(step, d);
  }
  return Number.isFinite(step) ? step : 1;
}

/** The exposure rows of a name round its price — the price read first (one row) when none is known */
/* ONE READ OF A NAME'S BOOK AT A TIME (2026-10-12): the shell's field recorder, Terrain's pane and Pinpoint's market
   (data/feed/pinpointMarket.ts) each ask for the open name's book on their own timers — a read already flying, or one
   that landed in the last twenty seconds, is handed to the next asker rather than asked again */
const bookReads = new Map<string, { at: number; p: Promise<FeedResult<UwStrikeExposure[]>> }>();
const BOOK_REUSE_MS = 20_000;
export function loadExposure(t: string): Promise<FeedResult<UwStrikeExposure[]>> {
  const had = bookReads.get(t);
  if (had && Date.now() - had.at < BOOK_REUSE_MS) return had.p;
  const p = readExposure(t);
  bookReads.set(t, { at: Date.now(), p });
  void p.then(r => {
    /* a failed read is not handed on */
    if (!r.ok && bookReads.get(t)?.p === p) bookReads.delete(t);
  });
  return p;
}

async function readExposure(t: string): Promise<FeedResult<UwStrikeExposure[]>> {
  let price = known.get(t)?.price ?? null;
  if (price == null) {
    const first = await uwSpotGexByStrike(t, { limit: 1 });
    if (!first.ok) return first;
    price = first.data[0]?.price ?? null;
    if (price == null || !(price > 0)) return { ok: false, reason: 'shape', status: 200 };
  }
  const w = windowOf(t, price);
  const r = await uwSpotGexByStrike(t, { minStrike: w.lo, maxStrike: w.hi });
  if (r.ok && r.data.length) {
    const p = r.data.find(x => x.price != null)?.price ?? price;
    known.set(t, { price: p, step: stepNear(r.data.map(x => x.strike), p) });
    /* the field keeps every book read (outside a render) */
    const book = bookFrom(t, r.data);
    if (book) noteField(book);
  }
  return r;
}

/* ---- the book ------------------------------------------------------------------------------------------------------ */

/** One strike on the feed, in the house's sign */
export interface FeedStrike {
  strike: number;
  gex: GreekSplit;
  dex: GreekSplit;
  vanna: GreekSplit;
  charm: GreekSplit;
  /** Gamma from today's volume — what today's trading put at the strike */
  gexVol: GreekSplit;
}

const split = (put: number, call: number): GreekSplit => ({ put, call, net: put + call });

/** A UW row as the house's strike — the sign mapping in the header */
export function feedStrike(r: UwStrikeExposure): FeedStrike {
  return {
    strike: r.strike,
    gex: split(-r.putGammaOi, -r.callGammaOi),
    dex: split(-r.putDeltaOi, -r.callDeltaOi),
    vanna: split(r.putVannaOi, -r.callVannaOi),
    charm: split(r.putCharmOi, -r.callCharmOi),
    gexVol: split(-r.putGammaVol, -r.callGammaVol),
  };
}

export interface FeedBook {
  ticker: string;
  /** The price UW figured the book at */
  spot: number;
  /** When it was figured, epoch ms */
  at: number;
  /** Ascending — 30 strikes each side of the price */
  rows: FeedStrike[];
  /** The chain's strike step near the price */
  step: number;
  /** The walls, the flip and the supreme, core/walls.ts's pick on the rows — NaN where the book names none; the pin
      waits on open interest (NaN until it lands) */
  levels: ExposureLevels;
  netGex: number;
  netDex: number;
}

/** The strikes `half` each side of a price, ascending */
export function aroundPrice<T extends { strike: number }>(rows: readonly T[], price: number, half: number): T[] {
  const asc = [...rows].sort((a, b) => a.strike - b.strike);
  let at = asc.findIndex(r => r.strike > price);
  if (at < 0) at = asc.length;
  return asc.slice(Math.max(0, at - half), Math.min(asc.length, at + half));
}

/** The book's named levels off rows in the house's sign */
export function levelsOfRows(rows: readonly { strike: number; net: number }[], spot: number): Omit<ExposureLevels, 'pin'> {
  const w = pickWalls(rows, spot, r => r.net);
  const flip = pickFlip(rows, spot, r => r.net);
  let supreme = NaN;
  let best = 0;
  for (const r of rows) {
    const a = Math.abs(r.net);
    if (a > best) {
      best = a;
      supreme = r.strike;
    }
  }
  return { spot, callWall: w.callWall ?? NaN, putWall: w.putWall ?? NaN, flip: flip ?? NaN, supreme };
}

const books = new WeakMap<UwStrikeExposure[], FeedBook | null>();
/** The book of an answer to /spot-exposures/strike — kept per answer */
export function bookFrom(ticker: string, data: UwStrikeExposure[]): FeedBook | null {
  if (books.has(data)) return books.get(data) ?? null;
  const price = data.find(r => r.price != null)?.price ?? null;
  let out: FeedBook | null = null;
  if (price != null && price > 0 && data.length) {
    const rows = aroundPrice(data.map(feedStrike), price, FEED_HALF);
    const at = data.reduce((m, r) => (Number.isFinite(r.time) ? Math.max(m, r.time) : m), 0) || Date.now();
    const lv = levelsOfRows(rows.map(r => ({ strike: r.strike, net: r.gex.net })), price);
    out = {
      ticker,
      spot: price,
      at,
      rows,
      step: stepNear(rows.map(r => r.strike), price),
      levels: { ...lv, pin: NaN },
      netGex: rows.reduce((s, r) => s + r.gex.net, 0),
      netDex: rows.reduce((s, r) => s + r.dex.net, 0),
    };
  }
  books.set(data, out);
  return out;
}

export interface FeedBookRead {
  book: FeedBook | null;
  /** The last poll failed — the book is the last good one (or none) */
  failed: FeedFail | null;
}

/** A name's book on the feed, every 30 s while on screen; null `on` asks nothing */
export function useFeedBook(on: boolean, ticker: string): FeedBookRead {
  const t = ticker.toUpperCase();
  const key = on && t ? `levels:book:${t}` : null;
  const r = useFeedPoll(key, () => loadExposure(t), 30_000);
  const k = keep(key, r);
  const book = useMemo(() => (k ? bookFrom(t, k.data) : null), [k?.data, t]); // eslint-disable-line react-hooks/exhaustive-deps
  return { book, failed: failOf(r) };
}

/* ---- open interest ------------------------------------------------------------------------------------------------- */

export interface FeedOi {
  /** The count's date as UW stamps it ("2026-10-12" — published after the session before closed) */
  date: string;
  byStrike: Map<number, { call: number; put: number }>;
}

const ois = new WeakMap<object, FeedOi>();
function oiFrom(data: { strike: number; callOi: number; putOi: number; date: string }[]): FeedOi {
  const had = ois.get(data);
  if (had) return had;
  const m = new Map<number, { call: number; put: number }>();
  for (const r of data) m.set(r.strike, { call: r.callOi, put: r.putOi });
  const out = { date: data[0]?.date ?? '', byStrike: m };
  ois.set(data, out);
  return out;
}

/** The session before a New York date (YYYY-MM-DD) */
export function sessionBefore(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const p = new Date(y, m - 1, d);
  for (let i = 0; i < 10; i++) {
    p.setDate(p.getDate() - 1);
    if (isTradingDay(p)) break;
  }
  return `${p.getFullYear()}-${String(p.getMonth() + 1).padStart(2, '0')}-${String(p.getDate()).padStart(2, '0')}`;
}

/** Open interest by strike — today's count, and the session before's when `prev` is asked (every 10 min) */
export function useFeedOi(on: boolean, ticker: string, prev = false): { today: FeedOi | null; before: FeedOi | null } {
  const t = ticker.toUpperCase();
  const k1 = on && t ? `levels:oi:${t}` : null;
  const r1 = useFeedPoll(k1, () => uwOiPerStrike(t), 10 * 60_000);
  const today = keep(k1, r1);
  const prevDate = today?.data[0]?.date ? sessionBefore(today.data[0].date) : null;
  const k2 = on && prev && t && prevDate ? `levels:oi:${t}:${prevDate}` : null;
  const r2 = useFeedPoll(k2, () => uwOiPerStrike(t, prevDate ?? undefined), 10 * 60_000);
  const before = keep(k2, r2);
  return useMemo(() => ({ today: today ? oiFrom(today.data) : null, before: before ? oiFrom(before.data) : null }), [today?.data, before?.data]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** "Oct 12" from "2026-10-12" */
export const shortDay = (isoDate: string): string => {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-').map(Number);
  return nyDay(new Date(y, m - 1, d, 12));
};

/** The pin — the strike with the most open interest among the book's rows — NaN until the count lands */
export function pinOf(book: FeedBook, oi: FeedOi | null): number {
  if (!oi) return NaN;
  let pin = NaN;
  let most = 0;
  for (const r of book.rows) {
    const o = oi.byStrike.get(r.strike);
    const n = o ? o.call + o.put : 0;
    if (n > most) {
      most = n;
      pin = r.strike;
    }
  }
  return pin;
}

/* ---- today's volume by strike ----------------------------------------------------------------------------------- */

/** Contracts traded today at each strike, calls and puts (every 60 s) */
export function useFeedVolume(on: boolean, ticker: string): Map<number, { call: number; put: number }> | null {
  const t = ticker.toUpperCase();
  const key = on && t ? `levels:vol:${t}` : null;
  const r = useFeedPoll(key, () => uwFlowPerStrike(t), 60_000);
  const k = keep(key, r);
  return useMemo(() => {
    if (!k) return null;
    const m = new Map<number, { call: number; put: number }>();
    for (const x of k.data) m.set(x.strike, { call: x.callVolume, put: x.putVolume });
    return m;
  }, [k?.data]); // eslint-disable-line react-hooks/exhaustive-deps
}

/* ---- max pain and the implied move ---------------------------------------------------------------------------- */

/** Max pain per listed date, earliest first (every 10 min) */
export function useFeedMaxPain(on: boolean, ticker: string): UwMaxPain[] | null {
  const t = ticker.toUpperCase();
  const key = on && t ? `levels:maxpain:${t}` : null;
  const r = useFeedPoll(key, () => uwMaxPain(t), 10 * 60_000);
  return keep(key, r)?.data ?? null;
}

/** The nearest listed date's max pain, today's or later */
export function nearMaxPain(rows: UwMaxPain[] | null, today = nyIsoDate()): UwMaxPain | null {
  return rows?.find(r => r.expiry >= today && r.strike != null) ?? null;
}

/** Implied volatility and the move it prices in, by horizon (every 10 min) */
export function useFeedMoves(on: boolean, ticker: string): UwImpliedMove[] | null {
  const t = ticker.toUpperCase();
  const key = on && t ? `levels:iv:${t}` : null;
  const r = useFeedPoll(key, () => uwInterpolatedIv(t), 10 * 60_000);
  return keep(key, r)?.data ?? null;
}

/* ---- how sure: the feed's own words ---------------------------------------------------------------------------- */

/** The close a count stands for: UW dates a count by the day it is published, after the session before closed — the
    count dated Oct 12 is the positions at Oct 9's close (its oi-change rows pair it with Oct 9's trading) */
export const countClose = (oi: FeedOi | null): string => (oi?.date ? shortDay(sessionBefore(oi.date)) : '');

/** What a feed level stands on: UW's open interest count (once a day) and the price UW figured the hedging at */
export function feedFreshness(book: FeedBook, oi: FeedOi | null): string {
  const count = oi?.date ? `${countClose(oi)}'s close — Unusual Whales' count dated ${shortDay(oi.date)}` : 'the last close';
  const clock = new Date(book.at).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false });
  return `Open interest as of ${count}; it is counted once a day · the hedging is figured by Unusual Whales at ${book.spot.toFixed(2)}, ${clock} ET`;
}

/** Every named level of the feed's book, with the side turned over beside it (data/levelSureness.ts) */
export function feedSureness(book: FeedBook, oi: FeedOi | null): Record<'call wall' | 'put wall' | 'flip' | 'supreme', Sureness> {
  const all = bookSureness(
    book.rows.map(r => ({ strike: r.strike, netGex: r.gex.net })),
    book.spot
  );
  const freshness = feedFreshness(book, oi);
  for (const k of Object.keys(all) as (keyof typeof all)[]) all[k] = { ...all[k], freshness };
  return all;
}

/* ---- the profile: the book as the house's ladder reads it ----------------------------------------------------- */

/** The feed's book as an ExposureProfileData — vega is not in the feed (NaN), the open interest and today's volume
    are UW's when they have landed (NaN until then) */
export function feedProfile(book: FeedBook, oi: FeedOi | null, vol: Map<number, { call: number; put: number }> | null): ExposureProfileData {
  const pin = pinOf(book, oi);
  const desc = [...book.rows].sort((a, b) => b.strike - a.strike);
  const maxAbs = { gex: 1, dex: 1, vex: NaN, vanna: 1, charm: 1 };
  const strikes: StrikeExposure[] = desc.map(r => {
    for (const g of ['gex', 'dex', 'vanna', 'charm'] as const) maxAbs[g] = Math.max(maxAbs[g], Math.abs(r[g].put), Math.abs(r[g].call), Math.abs(r[g].net));
    const o = oi?.byStrike.get(r.strike);
    const v = vol?.get(r.strike);
    return { strike: r.strike, pin: r.strike === pin, gex: r.gex, dex: r.dex, vex: NAN_SPLIT, vanna: r.vanna, charm: r.charm, oi: o ? o.call + o.put : NaN, volume: v ? v.call + v.put : NaN };
  });
  let spotAfterIndex = strikes.findIndex((row, i) => row.strike >= book.spot && (strikes[i + 1]?.strike ?? -Infinity) < book.spot);
  if (spotAfterIndex === -1) spotAfterIndex = book.spot > (strikes[0]?.strike ?? 0) ? -0.5 : strikes.length - 1;
  return {
    ticker: book.ticker,
    expiry: 'ALL',
    strikes,
    maxAbs,
    netGex: book.netGex,
    netDex: book.netDex,
    netVex: NaN,
    levels: { ...book.levels, pin },
    zones: [],
    bias: book.netGex > 0 ? 'BEARISH' : book.netGex < 0 ? 'BULLISH' : 'NEUTRAL',
    biasNote: book.netGex > 0 ? 'Net short gamma — moves amplified' : 'Net long gamma — dips absorbed',
    insights: [],
    spotAfterIndex,
  };
}

/* ---- by expiry: the calendar ---------------------------------------------------------------------------------- */

/** The greeks the feed carries by strike — vega is not among them, so its lens is never offered on the feed */
export const FEED_GREEKS: Greek[] = ['gex', 'dex', 'vanna', 'charm'];
/** How many listed dates the calendar asks for at once (seven dates × 61 strikes stays under UW's 500-row page) */
export const FEED_DATES = 7;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayOf = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};
/** Trading sessions after `from` up to and including `to` — 0 on the day itself */
const sessionsTo = (from: string, to: string): number => {
  let n = 0;
  const b = dayOf(to);
  for (const d = dayOf(from); ; ) {
    d.setDate(d.getDate() + 1);
    if (d > b) break;
    if (isTradingDay(d)) n++;
  }
  return n;
};
const calDays = (from: string, to: string) => Math.max(0, Math.round((dayOf(to).getTime() - dayOf(from).getTime()) / 86_400_000));

/** The listed dates from today on, earliest first — UW's max-pain rows name every listed date */
export const listedDates = (rows: UwMaxPain[] | null, today = nyIsoDate()): string[] => (rows ?? []).map(r => r.expiry).filter(e => e >= today);

/** The book by strike for the listed dates asked (every 60 s) — the rows of each date, keyed by date */
export function useFeedByExpiry(on: boolean, ticker: string, dates: string[]): Map<string, FeedStrike[]> | null {
  const t = ticker.toUpperCase();
  const price = knownPrice(t);
  const w = price != null ? windowOf(t, price) : null;
  const key = on && t && dates.length && w ? `levels:exp:${t}:${dates.join(',')}:${w.lo}-${w.hi}` : null;
  const r = useFeedPoll(key, () => uwSpotGexByExpiryStrike(t, dates, { minStrike: w?.lo, maxStrike: w?.hi }), 60_000);
  const k = keep(key, r);
  return useMemo(() => {
    if (!k) return null;
    const m = new Map<string, FeedStrike[]>();
    for (const row of k.data) {
      const list = m.get(row.expiry) ?? [];
      list.push(feedStrike(row));
      m.set(row.expiry, list);
    }
    return m;
  }, [k?.data]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** One column of the feed's calendar: a listed date's rows (or the whole book's), and its open interest where an answer
    carries it */
export interface FeedColumn {
  expiry: SurfaceExpiry;
  rows: ReadonlyMap<number, FeedStrike>;
  oi?: ReadonlyMap<number, { call: number; put: number }>;
}

/** The whole book as one column — every expiry together, with the open interest by strike */
export function bookColumn(book: FeedBook, oi: FeedOi | null): FeedColumn {
  return { expiry: { dte: 0, short: 'All', date: 'All dates', iv: NaN, sessions: 0 }, rows: new Map(book.rows.map(r => [r.strike, r])), oi: oi?.byStrike };
}

/** The listed dates' columns, earliest first — a date the answer did not carry is left out */
export function dateColumns(byDate: Map<string, FeedStrike[]>, dates: string[], today = nyIsoDate()): FeedColumn[] {
  return dates
    .filter(d => byDate.has(d))
    .map(d => {
      const dte = calDays(today, d);
      const dd = dayOf(d);
      return {
        expiry: { dte, short: dte === 0 ? '0DTE' : `${dte}d`, date: `${MONTHS[dd.getMonth()]} ${dd.getDate()}`, iv: NaN, sessions: sessionsTo(today, d) },
        rows: new Map((byDate.get(d) ?? []).map(r => [r.strike, r])),
      };
    });
}

/**
 * The feed's book as an ExposureSurface — the house's calendar shape (data/exposureSurface.ts), so the Map's heatmap
 * and ladder draw it as they draw the house's: the book's strikes ascending, a column each. The levels are the WHOLE
 * book's (every expiry), the cells each column's own. Vega is not in the feed: its arrays are zero and its lens is
 * never offered (FEED_GREEKS). Open interest stands where an answer carries it (the whole book's column); elsewhere it
 * is NaN — "—" in the ledger's read line, left off the cards.
 */
export function feedSurface(book: FeedBook, profile: ExposureProfileData, columns: FeedColumn[], changePct: number): ExposureSurface {
  const strikes = book.rows.map(r => r.strike);
  const greeks: Greek[] = ['gex', 'dex', 'vex', 'vanna', 'charm'];
  const mk = () => ({ gex: [], dex: [], vex: [], vanna: [], charm: [] }) as Record<Greek, number[][]>;
  const put = mk();
  const call = mk();
  const net = mk();
  const maxAbs = { gex: 1, dex: 1, vex: 1, vanna: 1, charm: 1 } as Record<Greek, number>;
  const king = {} as ExposureSurface['king'];
  for (const g of greeks) king[g] = { strike: strikes[0] ?? book.spot, e: 0, value: 0 };
  const oi: number[][] = [];
  columns.forEach((col, e) => {
    oi.push(
      strikes.map(s => {
        if (!col.oi) return NaN;
        const o = col.oi.get(s);
        return o ? o.call + o.put : NaN;
      })
    );
    for (const g of greeks) {
      const p: number[] = [];
      const c: number[] = [];
      const n: number[] = [];
      for (const s of strikes) {
        const r = col.rows.get(s);
        /* vega is not in the feed: its cells are NaN — "—" on the page, never a nought */
        if (g === 'vex') {
          p.push(NaN);
          c.push(NaN);
          n.push(NaN);
          continue;
        }
        const leg = !r ? null : r[g];
        const pv = leg ? leg.put : 0;
        const cv = leg ? leg.call : 0;
        p.push(pv);
        c.push(cv);
        n.push(pv + cv);
        const a = Math.abs(pv + cv);
        if (a > maxAbs[g]) maxAbs[g] = a;
        if (a > Math.abs(king[g].value)) king[g] = { strike: s, e, value: pv + cv };
      }
      put[g].push(p);
      call[g].push(c);
      net[g].push(n);
    }
  });
  const supreme = {} as ExposureSurface['supreme'];
  for (const g of greeks) {
    let strike = book.levels.supreme;
    if (g !== 'gex' && g !== 'vex') {
      let best = -1;
      for (const r of book.rows) {
        const a = Math.abs(r[g].net);
        if (a > best) {
          best = a;
          strike = r.strike;
        }
      }
    }
    const row = book.rows.find(r => r.strike === strike);
    const total = row && g !== 'vex' ? row[g].net : 0;
    const si = strikes.indexOf(strike);
    let e = 0;
    let value = 0;
    if (si >= 0)
      for (let x = 0; x < columns.length; x++) {
        const v = net[g][x][si] ?? 0;
        if (Math.abs(v) > Math.abs(value)) {
          value = v;
          e = x;
        }
      }
    supreme[g] = { strike, e, value, total };
  }
  return { ticker: book.ticker, spot: book.spot, changePct, strikes, expiries: columns.map(c => c.expiry), put, call, net, oi, maxAbs, king, supreme, levels: profile.levels, front: profile };
}

/* ---- the price and its change ------------------------------------------------------------------------------- */

/** The name's last price and change on the day from UW's day state (every 10 s) — null for an index (UW gives an
    index no state) or before it answers */
export function useFeedDayState(on: boolean, ticker: string): { price: number; changePct: number } | null {
  const t = ticker.toUpperCase();
  const key = on && t && !isCashIndex(t) ? `trace:state:${t}` : null;
  const r = useFeedPoll(key, () => uwStockState(t), 10_000);
  const k = keep(key, r);
  return useMemo(() => {
    if (!k || k.data.close === null) return null;
    const prev = k.data.prevClose;
    return { price: k.data.close, changePct: prev ? ((k.data.close - prev) / prev) * 100 : NaN };
  }, [k?.data]); // eslint-disable-line react-hooks/exhaustive-deps
}

/* ---- the book through the day ---------------------------------------------------------------------------------- */

export interface FeedTimelinePoint {
  /** New York's minute of the day */
  minute: number;
  at: number;
  spot: number;
  /** The whole book's gamma per one-percent move, the house's sign */
  netGex: number;
}

/** The whole book's gamma a minute through the day, with the price (every 60 s) */
export function useFeedTimeline(on: boolean, ticker: string): FeedTimelinePoint[] | null {
  const t = ticker.toUpperCase();
  const key = on && t ? `levels:timeline:${t}` : null;
  const r = useFeedPoll(key, () => uwSpotExposures(t), 60_000);
  const k = keep(key, r);
  return useMemo(() => {
    if (!k) return null;
    return k.data
      .filter(p => Number.isFinite(p.at) && p.price != null)
      .sort((a, b) => a.at - b.at)
      .map(p => ({ minute: nyMinutes(p.at), at: p.at, spot: p.price as number, netGex: -p.gammaOi }));
  }, [k?.data]); // eslint-disable-line react-hooks/exhaustive-deps
}

/* ---- bars ------------------------------------------------------------------------------------------------------- */

const bars = new Map<string, Candle[]>();
const barSubs = new Map<string, Set<() => void>>();
const emitBars = (t: string) => barSubs.get(t)?.forEach(f => f());

/** Fold UW's bars (newest first) into a name's tape, oldest first, one bar a minute */
function foldBars(t: string, rows: { at: number; open: number | null; high: number | null; low: number | null; close: number | null; volume: number }[]) {
  const have = bars.get(t) ?? [];
  const byTime = new Map<number, Candle>(have.map(b => [b.time, b]));
  let changed = false;
  for (const r of rows) {
    if (!Number.isFinite(r.at) || r.open == null || r.high == null || r.low == null || r.close == null) continue;
    const time = Math.floor(r.at / 1000);
    const next: Candle = { time, open: r.open, high: r.high, low: r.low, close: r.close, volume: r.volume };
    const was = byTime.get(time);
    if (!was || was.close !== next.close || was.high !== next.high || was.low !== next.low || was.volume !== next.volume) {
      byTime.set(time, next);
      changed = true;
    }
  }
  if (!changed) return;
  bars.set(t, [...byTime.values()].sort((a, b) => a.time - b.time));
  emitBars(t);
}

/** Fold bars into a name's tape UNDER what is there — a minute already held keeps its bar (Massive's sessions before, under
    UW's own minutes) */
function foldUnder(t: string, rows: { t: number; o: number; h: number; l: number; c: number; v: number }[]) {
  const have = bars.get(t) ?? [];
  const byTime = new Map<number, Candle>(have.map(b => [b.time, b]));
  let changed = false;
  for (const r of rows) {
    if (!Number.isFinite(r.t) || !(r.o > 0) || !(r.h > 0) || !(r.l > 0) || !(r.c > 0)) continue;
    const time = Math.floor(r.t / 1000);
    if (byTime.has(time)) continue;
    byTime.set(time, { time, open: r.o, high: r.h, low: r.l, close: r.c, volume: r.v });
    changed = true;
  }
  if (!changed) return;
  bars.set(t, [...byTime.values()].sort((a, b) => a.time - b.time));
  emitBars(t);
}
async function foldedUnder<T extends { t: number; o: number; h: number; l: number; c: number; v: number }[]>(t: string, call: Promise<FeedResult<T>>): Promise<FeedResult<T>> {
  const r = await call;
  if (r.ok) foldUnder(t, r.data);
  return r;
}
/** The span Massive's minutes are asked for: five weeks back to the session before today (rounded to the day, so the
    address — the proxy's cache key — holds for the day) */
function historySpan(): { from: string; to: string } {
  const today = nyIsoDate();
  const [y, m, d] = today.split('-').map(Number);
  const f = new Date(y, m - 1, d - 35);
  const from = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
  return { from, to: sessionBefore(today) };
}

/** A loader's answer, its bars folded into the name's tape as it lands (outside a render) */
async function folded<T extends { at: number; open: number | null; high: number | null; low: number | null; close: number | null; volume: number }[]>(t: string, call: Promise<FeedResult<T>>): Promise<FeedResult<T>> {
  const r = await call;
  if (r.ok) foldBars(t, r.data);
  return r;
}

/** A name's one-minute bars from UW — about four sessions, extended hours too (2,500 a call), the newest asked again
    every 15 s. Null until the first answer; an index answers nothing (UW needs a CBOE grant for index prices). */
export function useFeedBars(on: boolean, ticker: string, opts: { history?: boolean } = {}): { bars: Candle[] | null; failed: FeedFail | null } {
  const t = ticker.toUpperCase();
  const index = isCashIndex(t);
  const kAll = on && t && !index ? `levels:bars:${t}` : null;
  const rAll = useFeedPoll(kAll, () => folded(t, uwOhlc(t, { size: '1m', limit: 2500 })), 5 * 60_000);
  const kNew = on && t && rAll?.ok ? `levels:bars-new:${t}` : null;
  useFeedPoll(kNew, () => folded(t, uwOhlc(t, { size: '1m', limit: 30 })), 15_000);
  /* THE SESSIONS BEFORE (Terrain, 2026-10-12): Massive's minute bars for the five weeks before the session — one call a
     name, kept half an hour by the proxy — folded UNDER UW's (a minute UW answered keeps UW's bar), so a 30m or an hour
     pane has a month behind it as the house's tape does. Massive is asked only while it is up; its minutes stop at the
     session before, which UW's four sessions reach past. */
  const massiveUp = useFeedStatus().massive.state === 'ok';
  const span = historySpan();
  const kOld = on && t && !index && opts.history && massiveUp ? `levels:bars-old:${t}:${span.from}:${span.to}` : null;
  useFeedPoll(kOld, () => foldedUnder(t, massiveBars(t, 1, 'minute', span.from, span.to)), 30 * 60_000);
  const list = useSyncExternalStore(
    fn => {
      const s = barSubs.get(t) ?? new Set();
      s.add(fn);
      barSubs.set(t, s);
      return () => s.delete(fn);
    },
    () => bars.get(t) ?? null
  );
  return { bars: list && list.length ? list : null, failed: on && index ? 'plan' : failOf(rAll) };
}

/* ---- the strike field: the book kept through the session -------------------------------------------------------- */

/* THE FIELD ON TERRAIN'S CHART (gexNodesPrimitive) is the book through time. UW answers the book as it stands now — no
   route gives it strike by strike for earlier in the day (checked against UW's spec, 2026-10-12: /spot-exposures/strike
   takes a date, never a time) — so the field is the books this terminal has read, one a UW minute, kept for New York's
   day. It fills from the first read on and draws nothing it did not read.
   KEPT ON THIS MACHINE (2026-10-12 — the owner: "why does terrain exposure trails not work"; it lived in the page's
   memory, so a reload or another room emptied it): every book read is written to IndexedDB (slayer_field, one record a
   name a day, the days before dropped) and read back as a name is first asked for, so the field survives a reload; and
   the shell keeps reading the open name's book on every page while the feed is up (components/layout/FieldRecorder.tsx),
   so the field fills while the terminal is open anywhere, not only while Terrain is. */
const field = new Map<string, { day: string; snaps: GexSnapshot[] }>();
const fieldSubs = new Set<() => void>();
const fieldBell = () => fieldSubs.forEach(fn => fn());

/* ---- the field on disk ---- */
const FIELD_DB = 'slayer_field';
let fieldDb: Promise<IDBDatabase | null> | null = null;
function openFieldDb(): Promise<IDBDatabase | null> {
  if (fieldDb) return fieldDb;
  fieldDb = new Promise(resolve => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(FIELD_DB, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains('days')) req.result.createObjectStore('days', { keyPath: 'id' });
      };
      req.onsuccess = () => {
        const db = req.result;
        /* the days before today are never drawn — drop them */
        try {
          const today = nyIsoDate();
          const cur = db.transaction('days', 'readwrite').objectStore('days').openCursor();
          cur.onsuccess = () => {
            const c = cur.result;
            if (!c) return;
            if ((c.value as { day?: string }).day !== today) c.delete();
            c.continue();
          };
        } catch {
          /* a refused clean-up leaves old days on disk, never drawn */
        }
        resolve(db);
      };
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return fieldDb;
}

const fieldLoaded = new Set<string>();
/** Read a name's field for today off the disk once, merged under what this page has read already */
function loadField(t: string) {
  if (fieldLoaded.has(t)) return;
  fieldLoaded.add(t);
  const day = nyIsoDate();
  void openFieldDb().then(db => {
    if (!db) return;
    try {
      const req = db.transaction('days', 'readonly').objectStore('days').get(`${t}:${day}`);
      req.onsuccess = () => {
        const rec = req.result as { day: string; snaps: GexSnapshot[] } | undefined;
        if (!rec || rec.day !== day || !Array.isArray(rec.snaps) || !rec.snaps.length) return;
        const f = field.get(t);
        const mine = f && f.day === day ? f.snaps : [];
        const byTime = new Map<number, GexSnapshot>();
        for (const s of rec.snaps) byTime.set(s.time, s);
        for (const s of mine) byTime.set(s.time, s);
        field.set(t, { day, snaps: [...byTime.values()].sort((a, b) => a.time - b.time) });
        fieldBell();
      };
    } catch {
      /* nothing on disk: the field fills from now */
    }
  });
}

const fieldSaves = new Map<string, number>();
/** Write a name's field to the disk, a few seconds after its last read */
function saveField(t: string) {
  if (typeof window === 'undefined') return;
  window.clearTimeout(fieldSaves.get(t));
  fieldSaves.set(
    t,
    window.setTimeout(() => {
      fieldSaves.delete(t);
      const f = field.get(t);
      if (!f) return;
      void openFieldDb().then(db => {
        if (!db) return;
        try {
          db.transaction('days', 'readwrite').objectStore('days').put({ id: `${t}:${f.day}`, day: f.day, snaps: f.snaps });
        } catch {
          /* a full or refused disk: the field lives for the page */
        }
      });
    }, 4000)
  );
}

function noteField(book: FeedBook) {
  const t = book.ticker;
  loadField(t);
  const day = nyIsoDate(book.at);
  let f = field.get(t);
  if (!f || f.day !== day) {
    f = { day, snaps: [] };
    field.set(t, f);
  }
  const time = Math.floor(book.at / 1000);
  const last = f.snaps[f.snaps.length - 1];
  if (last && last.time >= time) return;
  const levels: GexLevel[] = book.rows.map(r => ({ strike: r.strike, value: r.gex.net, dex: r.dex.net }));
  f.snaps = [...f.snaps, { time, levels }];
  fieldBell();
  saveField(t);
}

/** The books read so far today for a name, oldest first, outside a render (data/feed/pinpointMarket.ts) */
export function fieldSnaps(ticker: string): GexSnapshot[] {
  const t = ticker.toUpperCase();
  if (t) loadField(t);
  return field.get(t)?.snaps ?? EMPTY_SNAPS;
}
/** Told when any name's field moves */
export function subscribeField(fn: () => void): () => void {
  fieldSubs.add(fn);
  return () => fieldSubs.delete(fn);
}
/** The strikes asked round a name's price — null before its price is known */
export function feedWindow(ticker: string): { lo: number; hi: number } | null {
  const t = ticker.toUpperCase();
  const price = knownPrice(t);
  return price != null ? windowOf(t, price) : null;
}

/** The books read so far today for a name, oldest first — what this machine kept from earlier included */
export function useFeedField(ticker: string): GexSnapshot[] {
  const t = ticker.toUpperCase();
  if (t) loadField(t);
  return useSyncExternalStore(
    fn => {
      fieldSubs.add(fn);
      return () => fieldSubs.delete(fn);
    },
    () => field.get(t)?.snaps ?? EMPTY_SNAPS
  );
}
const EMPTY_SNAPS: GexSnapshot[] = [];

/* ---- TERRAIN ON THE FEED, EVERY CONTROL FILLED (2026-10-12) -------------------------------------------------------
   The owner: "but i build the UI that the real data goes into". A Terrain pane on the feed draws every control the
   house's pane draws; these are what fill the ones the book and the minute bars do not: the day bars (1D, 1W), the
   name's dark pool levels, its next report for the events lane, the open's ghost on the ladder off the field. */

/** A New York date as the chart's day bar time — the date's noon UTC, so it reads as the same date on New York's clock */
const dayTime = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d, 12) / 1000;
};
const isoOfDayStart = (ms: number): string => nyIsoDate(ms);

/**
 * A name's day bars, oldest first: UW's regular-session rows (about a year, today's among them, every 5 min) over
 * Massive's two years of day bars (asked once a day while Massive is up — it refuses an index, as UW does). A date
 * both carry is UW's. Null until either answers; an index asks nothing.
 */
export function useFeedDaily(on: boolean, ticker: string, opts: { massive?: boolean } = {}): Candle[] | null {
  const t = ticker.toUpperCase();
  const index = isCashIndex(t);
  const kUw = on && t && !index ? `levels:daily:${t}` : null;
  const rUw = useFeedPoll(kUw, () => uwDailyBars(t, { limit: 2500 }), 5 * 60_000);
  const uw = keep(kUw, rUw);
  const massiveUp = useFeedStatus().massive.state === 'ok';
  const today = nyIsoDate();
  const [y, m, d] = today.split('-').map(Number);
  const from = `${y - 2}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const kM = on && t && !index && opts.massive !== false && massiveUp ? `levels:daily-old:${t}:${from}` : null;
  const rM = useFeedPoll(kM, () => massiveBars(t, 1, 'day', from, today), 30 * 60_000);
  const old = keep(kM, rM);
  return useMemo(() => {
    if (!uw && !old) return null;
    const byDay = new Map<number, Candle>();
    for (const b of old?.data ?? []) {
      if (!(b.o > 0 && b.h > 0 && b.l > 0 && b.c > 0)) continue;
      const time = dayTime(isoOfDayStart(b.t));
      byDay.set(time, { time, open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v });
    }
    for (const r of uw?.data ?? []) {
      if (r.marketTime !== 'r' || !r.date || r.open == null || r.high == null || r.low == null || r.close == null) continue;
      const time = dayTime(r.date);
      byDay.set(time, { time, open: r.open, high: r.high, low: r.low, close: r.close, volume: r.volume });
    }
    const out = [...byDay.values()].sort((a, b) => a.time - b.time);
    return out.length ? out : null;
  }, [uw?.data, old?.data]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** The dark pool's floor for a name's levels — the crosses of $1M and up, as Trace's dark leaders read */
export const DARK_LEVEL_FLOOR = 1_000_000;

/**
 * A name's dark pool levels on the feed: the three largest off-exchange crosses of the session (UW, $1M and up, every
 * minute), in the shape the chart's dark pool lines read — the price, the notional in billions, the date and time
 * they printed (New York's). An index has no dark pool: none.
 */
export function useFeedDarkLevels(on: boolean, ticker: string): DarkPoolPrint[] {
  const t = ticker.toUpperCase();
  const key = on && t && !isCashIndex(t) ? `levels:dark:${t}` : null;
  const r = useFeedPoll(key, () => uwDarkpool({ ticker: t, limit: 200, minPremium: DARK_LEVEL_FLOOR }), 60_000);
  const k = keep(key, r);
  return useMemo(() => {
    if (!k) return EMPTY_DARK;
    return k.data
      .filter(p => !p.canceled && p.price > 0 && Number.isFinite(p.executedAt))
      .sort((a, b) => b.premium - a.premium)
      .slice(0, 3)
      .map(p => {
        const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).formatToParts(new Date(p.executedAt));
        const part = (n: string) => parts.find(x => x.type === n)?.value ?? '';
        return { price: p.price, notional: p.premium / 1e9, size: p.size, date: `${part('month')}/${part('day')}`, time: `${part('hour')}:${part('minute')}:${part('second')}` };
      });
  }, [k?.data]); // eslint-disable-line react-hooks/exhaustive-deps
}
const EMPTY_DARK: DarkPoolPrint[] = [];

/** The next report among a name's UW rows — on or after today, not yet reported */
const nextReport = (rows: readonly UwEarning[], today: string): UwEarning | null =>
  rows.filter(x => x.reportDate >= today && x.actualEps == null).sort((a, b) => (a.reportDate < b.reportDate ? -1 : 1))[0] ?? null;

/**
 * A name's next report for the chart's events lane, off UW's own record (every 30 min): the slot (before the open or
 * after the close), whether the company set the date, the move the options price in, and the typical move — the mean
 * of the last eight reports' next-session moves. A figure the record lacks is NaN ("—" on the card). Null with no
 * report ahead, or for an index.
 */
export function useFeedEarnings(on: boolean, ticker: string): TapeEarnings | null {
  const t = ticker.toUpperCase();
  const key = on && t && !isCashIndex(t) ? `levels:earnings:${t}` : null;
  const r = useFeedPoll(key, () => uwEarningsFor(t), 30 * 60_000);
  const k = keep(key, r);
  return useMemo(() => {
    if (!k) return null;
    const today = nyIsoDate();
    const next = nextReport(k.data, today);
    if (!next) return null;
    const past = k.data
      .filter(x => x.reportDate < today && x.postMove1d != null)
      .sort((a, b) => (a.reportDate < b.reportDate ? 1 : -1))
      .slice(0, 8);
    const hist = past.length ? (past.reduce((s, x) => s + Math.abs(x.postMove1d as number), 0) / past.length) * 100 : NaN;
    return {
      ticker: t,
      slot: next.reportTime === 'postmarket' ? 'AMC' : 'BMO',
      confirmed: next.dateSource === 'company',
      impliedMovePct: next.expectedMovePct != null ? next.expectedMovePct * 100 : NaN,
      histAvgMovePct: hist,
      daysOut: sessionsTo(today, next.reportDate),
    };
  }, [k?.data]); // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * The open's ghost on the feed: each strike's net at the first book this terminal read after New York's 09:30 today,
 * as a ratio of the newest book's — the house's rule (data/levelview.ts netSinceOpenRatio) on the field. Null when no
 * book was read after the open today, or only one ("—" on the card, no ghost drawn).
 */
export function feedOpenRatio(snaps: readonly GexSnapshot[], now = Date.now()): Map<number, number> | null {
  if (snaps.length < 2) return null;
  const today = nyIsoDate(now);
  const first = snaps.find(s => nyIsoDate(s.time * 1000) === today && nyMinutes(s.time * 1000) >= 9 * 60 + 30);
  const last = snaps[snaps.length - 1];
  if (!first || first === last || nyIsoDate(last.time * 1000) !== today) return null;
  const open = new Map(first.levels.map(l => [l.strike, l.value]));
  const out = new Map<number, number>();
  for (const l of last.levels) {
    const o = open.get(l.strike);
    if (o == null || Math.abs(l.value) < 1e-9) continue;
    out.set(l.strike, o / l.value);
  }
  return out;
}

/* ---- THE ALERTS' WATCHER (2026-10-12): a name's book once, outside a render ---------------------------------------- */

/** A name's book read once — the shell's alert watcher reads the walls, the flip and an index's price off it; the
    proxy keeps exposure 30 s, so a page polling the same book costs the vendor nothing more */
export async function feedBookOnce(ticker: string): Promise<FeedBook | null> {
  const t = ticker.toUpperCase();
  const r = await loadExposure(t);
  return r.ok ? bookFrom(t, r.data) : null;
}
