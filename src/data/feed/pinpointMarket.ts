/*
==================================================
  SLAYER TERMINAL - PINPOINT'S MARKET ON THE FEED
  (data/feed/pinpointMarket.ts)

  THE UI IS THE OWNER'S; THE FEED FILLS IT (2026-10-
  12 — the owner: "but i build the UI that the real
  data goes into"). Pinpoint has one set of pages.
  With its room on the feed, the frame sets the
  engines' market to this one (data/bookMarket.ts)
  and every page, panel and read runs the house's own
  engine on Unusual Whales' answers:

    the snapshot   the book by strike round UW's price
                   (/spot-exposures/strike), today's
                   open interest (/oi-per-strike) and
                   volume (/flow-per-strike), the
                   name's prints (/flow-recent)
    the name       UW's price for the book, its 1-day
                   implied vol (/interpolated-iv), its
                   day's change (/stock-state)
    the calendar   the book by listed date (/spot-
                   exposures/expiry-strike), each
                   date's own vol (/volatility/term-
                   structure)
    the bars       the regular sessions' minute bars
                   (/ohlc/1m — today's, and the six
                   sessions before by date); daily
                   bars for the ATR (/ohlc/1d)
    the history    each past session's book at its
                   open (the rebuilt field's 9:30 column — never UW's end-of-day state),
                   the last two closes' books (/spot-
                   exposures/strike?date=) with the
                   open interest they closed on, and
                   today's books as this machine read
                   them (levels.ts's field), a bar each
    the build      the session's open interest at the
                   open and with the day's traded
                   contracts on it — UW's own "by
                   volume" reading of what the day added
    the timeline   the whole book a minute (/spot-
                   exposures?date=)

  ASKED FOR ON DEMAND: an engine reading a name asks
  for the parts it reads (need), and only those are
  fetched — a part nobody asked for in a minute is not
  asked again, a hidden tab asks nothing, a past day
  is asked once. UW Basic answers three calls at once
  and the key is shared: at most three are in flight
  from here, a 429 is waited out, and every part keeps
  its last good answer.

  NEVER INVENTED: a name's snapshot does not exist
  until its book, its open interest and its implied
  vol have come; a figure no answer carries is NaN
  (vega is not in UW's exposure by strike) and the
  page prints "—". An index (SPX, NDX, RUT …) has no
  day state and no bars on this plan: never asked.
==================================================
*/

import { useSyncExternalStore } from 'react';
import { registerFeedMarket, type BookMarket, type BookMinute, type NameCfg } from '../bookMarket';
import { pinpointSource, roomOfPath } from './rooms';
import { getFeedStatus, subscribeFeedStatus } from './status';
import { isTradingDay } from '../../core/calendar';
import { nyClock, nyIsoDate, nyMinutes, SESSION_CLOSE_MIN, SESSION_OPEN_MIN } from '../../core/nyTime';
import { CALENDAR_DTES } from '../exposureSurface';
import type { ExposureSurface } from '../exposureSurface';
import type { ExposureProfileData } from '../../types/gex';
import type { Candle, GexLevel, GexSnapshot, MarketSnapshot, StrikeNode, TapeOrder } from '../../types/market';
import { feedFetch, type FeedFail, type FeedResult } from './client';
import { openColumn, type PastInputsLike } from './trailModel';
import {
  aroundPrice,
  bookFrom,
  dateColumns,
  FEED_HALF,
  feedStrike,
  feedFreshness,
  feedSurface,
  feedWindow,
  fieldSnaps,
  isCashIndex,
  listedDates,
  loadExposure,
  nearMaxPain,
  sessionBefore,
  shortDay,
  subscribeField,
  type FeedBook,
  type FeedStrike,
} from './levels';
import {
  uwFlowPerStrike,
  uwFlowRecent,
  uwInterpolatedIv,
  uwMaxPain,
  uwOhlc,
  uwOiPerStrike,
  uwSpotExposures,
  uwSpotGexByExpiryStrike,
  uwSpotGexByStrike,
  uwStockState,
  uwTermStructure,
  type UwBar,
  type UwExpiryStrikeExposure,
  type UwImpliedMove,
  type UwMaxPain,
  type UwOptionTrade,
  type UwSpotExposure,
  type UwStockState,
  type UwStrikeExposure,
  type UwStrikeFlow,
  type UwStrikeOi,
  type UwTermPoint,
} from './uw';

/* ---- the parts and how often each is asked ---------------------------------------------------------------------- */

/** Past sessions read by date — the range, the records and the closes */
export const PAST_SESSIONS = 6;
/** A part nobody has asked for in this long is not asked again */
const ASK_KEEP = 60_000;
/** At most this many calls in flight from here (UW Basic answers three at once, and the key is shared) */
const MAX_FLY = 3;
const NEVER = Number.POSITIVE_INFINITY;

type Kind = 'book' | 'oi' | 'vol' | 'day' | 'bars' | 'pastBars' | 'open' | 'close' | 'iv' | 'term' | 'exp' | 'maxpain' | 'minutes' | 'tape' | 'daily';

interface Spec {
  /** Asked again after this long (a past day: never) */
  period: (arg: string) => number;
  /** Asked before the rest — the snapshot's own parts first */
  rank: number;
  load: (t: string, arg: string) => Promise<FeedResult<unknown>>;
}

const today = () => nyIsoDate();
const past = (arg: string) => !!arg && arg < today();

const SPECS: Record<Kind, Spec> = {
  book: { rank: 0, period: () => 30_000, load: t => loadExposure(t) },
  iv: { rank: 0, period: () => 10 * 60_000, load: t => uwInterpolatedIv(t) },
  oi: { rank: 0, period: arg => (arg ? NEVER : 10 * 60_000), load: (t, arg) => uwOiPerStrike(t, arg || undefined) },
  day: { rank: 1, period: () => 15_000, load: t => uwStockState(t) },
  bars: { rank: 1, period: () => 30_000, load: t => uwOhlc(t, { size: '1m', limit: 1000 }) },
  vol: { rank: 2, period: arg => (past(arg) ? NEVER : 60_000), load: (t, arg) => uwFlowPerStrike(t, arg || undefined) },
  maxpain: { rank: 2, period: () => 10 * 60_000, load: t => uwMaxPain(t) },
  term: { rank: 2, period: () => 10 * 60_000, load: t => uwTermStructure(t) },
  exp: { rank: 3, period: () => 60_000, load: (t, arg) => loadByExpiry(t, arg.split(',')) },
  tape: { rank: 3, period: () => 60_000, load: t => uwFlowRecent(t) },
  minutes: { rank: 3, period: arg => (past(arg) ? NEVER : 60_000), load: (t, arg) => uwSpotExposures(t, arg || undefined) },
  pastBars: { rank: 4, period: () => NEVER, load: (t, arg) => uwOhlc(t, { size: '1m', limit: 1000, date: arg }) },
  open: { rank: 4, period: arg => (past(arg) ? NEVER : 10 * 60_000), load: (t, arg) => loadOpenColumn(t, arg) },
  close: { rank: 4, period: () => NEVER, load: (t, arg) => loadCloseBook(t, arg) },
  daily: { rank: 5, period: () => 60 * 60_000, load: t => uwOhlc(t, { size: '1d', limit: 40 }) },
};

/** The book by listed date, round the price */
function loadByExpiry(t: string, dates: string[]): Promise<FeedResult<UwExpiryStrikeExposure[]>> {
  const w = feedWindow(t);
  return uwSpotGexByExpiryStrike(t, dates, { minStrike: w?.lo, maxStrike: w?.hi });
}

/** A past session's book AT ITS OPEN (`date|open price|first bar's time (s)`): the rebuilt field's 9:30 column
    (trailModel openColumn) — the day's published count, the session before's close vols, the first minute's prints.
    UW's greek-exposure/strike?date=D is the day's END state (measured 2026-10-13: nearer the newest book than the
    prior close), never its open, so it is not read here any more. The server builds the session once when asked
    (/feed/field/<NAME>/past); until it is built the part fails and is asked again in a minute; a session the server
    cannot build (before the plan's window) is not asked again this visit. */
async function loadOpenColumn(t: string, arg: string): Promise<FeedResult<GexLevel[]>> {
  const [day, openStr, timeStr] = arg.split('|');
  const open = Number(openStr);
  const time = Number(timeStr);
  if (!day || !Number.isFinite(open) || !Number.isFinite(time)) return { ok: false, reason: 'shape', status: 0 };
  const asked = (await feedFetch(`/feed/field/${encodeURIComponent(t)}/past?days=${day}`)) as FeedResult<{ ready: string[]; failed?: Record<string, string> }>;
  if (!asked.ok) return asked;
  if (!Array.isArray(asked.data?.ready) || !asked.data.ready.includes(day)) return { ok: false, reason: asked.data?.failed && day in asked.data.failed ? 'plan' : 'timeout', status: 0 };
  const r = (await feedFetch(`/feed/field/${encodeURIComponent(t)}/day/${day}`)) as FeedResult<PastInputsLike & { oi?: unknown }>;
  if (!r.ok) return r;
  if (!r.data || !Array.isArray(r.data.oi)) return { ok: false, reason: 'shape', status: 0 };
  const col = openColumn(t, { day, oi: r.data.oi, seed: r.data.seed ?? null, ticks: r.data.ticks ?? {}, total: r.data.total ?? null }, { time, close: open });
  return { ok: true, data: col.levels, at: Date.now() };
}
/** The open's arg: the day, its opening price and its first bar's time */
const openArg = (day: string, open: number, time: number) => `${day}|${open}|${time}`;

/** A past session's book as it closed, round that day's close (`date|lo|hi`) */
function loadCloseBook(t: string, arg: string): Promise<FeedResult<UwStrikeExposure[]>> {
  const [date, lo, hi] = arg.split('|');
  return uwSpotGexByStrike(t, { date, minStrike: Number(lo), maxStrike: Number(hi) });
}
/** The strikes asked round a day's close: a tenth of the price each side, in whole dollars */
const closeArg = (date: string, close: number) => `${date}|${Math.max(0, Math.floor(close * 0.9))}|${Math.ceil(close * 1.1)}`;

/* ---- the store ---------------------------------------------------------------------------------------------------- */

interface Part {
  t: string;
  kind: Kind;
  arg: string;
  data: unknown;
  /** When the last good answer landed */
  at: number;
  /** When an engine last asked for it */
  asked: number;
  flying: boolean;
  /** The last call's failure, and when */
  fail: FeedFail | null;
  failAt: number;
}

const parts = new Map<string, Part>();
let version = 0;
/** Answers landed per name — a name's snapshot is made again when any part of it lands, so every read off it (the
    calendar, the history, the records) is read again with it */
const landed = new Map<string, number>();
const subs = new Set<() => void>();
let frame = 0;
const bump = () => {
  version++;
  if (frame) return;
  const run = () => {
    frame = 0;
    subs.forEach(fn => fn());
  };
  frame = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(run) : (setTimeout(run, 16) as unknown as number);
};
subscribeField(bump);

const hidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';
let flying = 0;
let pumpTimer: ReturnType<typeof setTimeout> | null = null;
let ticker: ReturnType<typeof setInterval> | null = null;

const keyOf = (t: string, kind: Kind, arg: string) => `${t}|${kind}|${arg}`;

/** An engine reads a part: it is asked for (again, once due) and its last good answer comes back — null before any */
function need<T>(t: string, kind: Kind, arg = ''): T | null {
  const key = keyOf(t, kind, arg);
  let p = parts.get(key);
  const now = Date.now();
  if (!p) {
    p = { t, kind, arg, data: null, at: 0, asked: now, flying: false, fail: null, failAt: 0 };
    parts.set(key, p);
    soon();
  } else {
    if (now - p.asked > 5000) soon();
    p.asked = now;
  }
  return p.data as T | null;
}

/** A part's last good answer without asking for it */
function peek<T>(t: string, kind: Kind, arg = ''): T | null {
  return (parts.get(keyOf(t, kind, arg))?.data as T | undefined) ?? null;
}

/* THE SESSIONS BEFORE, ASKED ONLY WHERE THEY ARE READ: the range's record, how the levels held, the overnight change and
   the pair's sessions ask for them (deep); the Board's rows and every other read take what is on hand, so a name on the
   Board costs its own book and today's bars, not six days of history */
const deepAsked = new Map<string, number>();
const deepNow = (t: string) => Date.now() - (deepAsked.get(t) ?? 0) < ASK_KEEP;
/** Ask for or peek at a part of the sessions before, as the name's reads want them */
const pastPart = <T,>(t: string, kind: Kind, arg: string): T | null => (deepNow(t) ? need<T>(t, kind, arg) : peek<T>(t, kind, arg));

/** The last failure of a part — for the "why" a page prints */
export function failOfPart(t: string, kind: Kind, arg = ''): FeedFail | null {
  return parts.get(keyOf(t.toUpperCase(), kind, arg))?.fail ?? null;
}

function soon() {
  if (pumpTimer) return;
  pumpTimer = setTimeout(() => {
    pumpTimer = null;
    pump();
  }, 0);
  if (!ticker && typeof setInterval === 'function') ticker = setInterval(pump, 1000);
}

function due(p: Part, now: number): boolean {
  if (p.flying || now - p.asked > ASK_KEEP) return false;
  if (p.fail) {
    /* a refusal the plan makes is not asked again this visit; a 429 or the network is waited out */
    if (p.fail === 'plan' || p.fail === 'no-key' || p.fail === 'key-refused') return false;
    const wait = p.fail === 'rate' ? 15_000 : 60_000;
    if (now - p.failAt < wait) return false;
  }
  if (!p.at) return true;
  return now - p.at >= SPECS[p.kind].period(p.arg);
}

function pump() {
  if (hidden()) return;
  const now = Date.now();
  const ready = [...parts.values()].filter(p => due(p, now)).sort((a, b) => SPECS[a.kind].rank - SPECS[b.kind].rank || b.asked - a.asked);
  for (const p of ready) {
    if (flying >= MAX_FLY) break;
    void run(p);
  }
  /* nothing left to ask: the second's tick stops until an engine asks again */
  if (!flying && !ready.length && ticker && [...parts.values()].every(p => now - p.asked > ASK_KEEP)) {
    clearInterval(ticker);
    ticker = null;
  }
}

async function run(p: Part) {
  p.flying = true;
  flying++;
  let r: FeedResult<unknown>;
  try {
    r = await SPECS[p.kind].load(p.t, p.arg);
  } catch {
    r = { ok: false, reason: 'shape', status: 0 };
  }
  flying--;
  p.flying = false;
  if (r.ok) {
    p.data = r.data;
    p.at = Date.now();
    p.fail = null;
    landed.set(p.t, (landed.get(p.t) ?? 0) + 1);
  } else {
    p.fail = r.reason;
    p.failAt = Date.now();
  }
  bump();
  soon();
}

if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => !hidden() && soon());

/** Re-render when an answer lands */
export function useFeedMarketVersion(): number {
  return useSyncExternalStore(
    fn => {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    () => version
  );
}

/* ---- memo by the answers a product is made of --------------------------------------------------------------------- */

const memos = new Map<string, { deps: unknown[]; value: unknown }>();
function made<T>(key: string, deps: unknown[], make: () => T): T {
  const had = memos.get(key);
  if (had && had.deps.length === deps.length && had.deps.every((d, i) => d === deps[i])) return had.value as T;
  const value = make();
  memos.set(key, { deps, value });
  return value;
}

/* ---- the days ---------------------------------------------------------------------------------------------------- */

const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dayOf = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};
/** The trading sessions before today, newest first */
function pastDates(n: number, from = today()): string[] {
  const out: string[] = [];
  const d = dayOf(from);
  for (let i = 0; i < 20 && out.length < n; i++) {
    d.setDate(d.getDate() - 1);
    if (isTradingDay(d)) out.push(isoOf(d));
  }
  return out;
}
/** The session after a date */
function sessionAfter(iso: string): string {
  const d = dayOf(iso);
  for (let i = 0; i < 10; i++) {
    d.setDate(d.getDate() + 1);
    if (isTradingDay(d)) break;
  }
  return isoOf(d);
}

/* ---- the bars ---------------------------------------------------------------------------------------------------- */

/** The regular session's minute bars of an answer, oldest first */
function regular(rows: UwBar[] | null): Candle[] {
  if (!rows) return [];
  const out: Candle[] = [];
  for (const r of rows) {
    if (r.marketTime !== 'r' || r.open == null || r.high == null || r.low == null || r.close == null || !Number.isFinite(r.at)) continue;
    const time = Math.floor(r.at / 1000);
    const m = nyMinutes(r.at);
    if (m < SESSION_OPEN_MIN || m >= SESSION_CLOSE_MIN) continue;
    out.push({ time, open: r.open, high: r.high, low: r.low, close: r.close, volume: r.volume });
  }
  return out.sort((a, b) => a.time - b.time);
}

/** Every regular minute on hand for a name — the sessions before by date, and today's — oldest first; null before any */
function candlesOf(t: string): Candle[] | null {
  if (isCashIndex(t)) return null;
  const latest = need<UwBar[]>(t, 'bars');
  const days = pastDates(PAST_SESSIONS);
  const olds = days.map(d => pastPart<UwBar[]>(t, 'pastBars', d));
  return made(`candles:${t}`, [latest, ...olds], () => {
    const byTime = new Map<number, Candle>();
    for (const rows of [...olds].reverse()) for (const c of regular(rows)) byTime.set(c.time, c);
    for (const c of regular(latest)) byTime.set(c.time, c);
    const all = [...byTime.values()].sort((a, b) => a.time - b.time);
    return all.length ? all : null;
  });
}

/** The day each regular session on hand ran, oldest first, with its first and last bar */
function sessionsOf(bars: readonly Candle[]): { day: string; first: Candle; last: Candle }[] {
  const out: { day: string; first: Candle; last: Candle }[] = [];
  for (const b of bars) {
    const day = nyIsoDate(b.time * 1000);
    const cur = out[out.length - 1];
    if (cur && cur.day === day) cur.last = b;
    else out.push({ day, first: b, last: b });
  }
  return out;
}

/* ---- the name ---------------------------------------------------------------------------------------------------- */

function bookOfName(t: string): FeedBook | null {
  const data = need<UwStrikeExposure[]>(t, 'book');
  return data ? bookFrom(t, data) : null;
}

/** The name's implied vol for the day ahead — UW's 1-day horizon, the nearest it carries otherwise */
function ivOf(t: string): number | null {
  const rows = need<UwImpliedMove[]>(t, 'iv');
  if (!rows) return null;
  for (const d of [1, 5, 7, 14, 30]) {
    const r = rows.find(x => x.days === d && x.volatility != null && x.volatility > 0);
    if (r) return r.volatility;
  }
  return null;
}

function cfgOf(t: string): NameCfg | undefined {
  const book = bookOfName(t);
  const iv = ivOf(t);
  if (!book || iv == null) return undefined;
  return made(`cfg:${t}`, [book, iv], () => ({ currentPrice: book.spot, iv, step: book.step }));
}

function changeOf(t: string): number {
  if (isCashIndex(t)) return NaN;
  const s = need<UwStockState>(t, 'day');
  if (!s || s.close == null || !s.prevClose) return NaN;
  return ((s.close - s.prevClose) / s.prevClose) * 100;
}

/* ---- the snapshot ------------------------------------------------------------------------------------------------ */

const NO_PLAN = { ticker: '', direction: 'BULLISH' as const, score: NaN, confidence: NaN, entry: NaN, stopLoss: NaN, target1: NaN, target2: NaN, flipZone: NaN, supportWall: NaN, resistanceWall: NaN };
const NO_INDICATORS = { rsi: NaN, ema9: NaN, ema21: NaN, ema50: NaN, squeeze: false };

/** A UW print as the tape the wall model reads: where it sat in the quote (a print at neither side is left out) */
function tapeOf(t: string, rows: UwOptionTrade[] | null): TapeOrder[] {
  if (!rows) return [];
  const out: TapeOrder[] = [];
  for (const r of rows) {
    if (r.canceled || !(r.strike > 0) || !(r.size > 0)) continue;
    const side = r.tags.includes('ask_side') ? 'ASK' : r.tags.includes('bid_side') ? 'BID' : null;
    if (!side) continue;
    out.push({
      time: Number.isFinite(r.executedAt) ? nyClock(r.executedAt, { seconds: true }) : '',
      ticker: t,
      strike: String(r.strike),
      type: r.type === 'put' ? 'P' : 'C',
      size: r.size,
      orderType: r.flags.includes('intermarket_sweep') ? 'SWEEP' : 'BLOCK',
      side,
    });
  }
  return out;
}

const NAN = Number.NaN;

/** A strike of the vendor's book as the chain the engines read — the house's sign, the vendor's own figures */
function nodeOf(r: FeedStrike, oi: { call: number; put: number } | undefined, vol: { call: number; put: number } | undefined): StrikeNode {
  return {
    strike: r.strike,
    callOI: oi?.call ?? 0,
    putOI: oi?.put ?? 0,
    /* the unit greeks are not in the vendor's exposure: the engines that need a size read the exposures below */
    gamma: NAN,
    callGex: r.gex.call,
    putGex: r.gex.put,
    netGex: r.gex.net,
    callDex: r.dex.call,
    putDex: r.dex.put,
    netDex: r.dex.net,
    /* vega is not in UW's exposure by strike */
    callVex: NAN,
    putVex: NAN,
    netVex: NAN,
    vanna: r.vanna.net,
    charm: r.charm.net,
    callVanna: r.vanna.call,
    putVanna: r.vanna.put,
    netVanna: r.vanna.net,
    callCharm: r.charm.call,
    putCharm: r.charm.put,
    netCharm: r.charm.net,
    volume: vol ? vol.call + vol.put : NAN,
  };
}

const oiMap = (rows: UwStrikeOi[] | null) => made(`oimap`, [rows], () => new Map((rows ?? []).map(r => [r.strike, { call: r.callOi, put: r.putOi }])));

function snapshotOf(t: string): MarketSnapshot | null {
  const book = bookOfName(t);
  const oiRows = need<UwStrikeOi[]>(t, 'oi');
  const iv = ivOf(t);
  const volRows = need<UwStrikeFlow[]>(t, 'vol');
  const tapeRows = need<UwOptionTrade[]>(t, 'tape');
  if (!isCashIndex(t)) need<UwStockState>(t, 'day');
  const bars = candlesOf(t);
  /* the calendar too: every page draws the book by listed date, and a calendar with no date is not a calendar */
  const cal = book ? byDateOf(t, calendarDates(t)) : null;
  if (!book || !oiRows || iv == null || !cal || !cal.size) return null;
  /* made again whenever any answer for the name lands (`landed`), so the calendar and the history read with it */
  return made(`snap:${t}`, [book, oiRows, iv, landed.get(t) ?? 0, fieldSnaps(t)], () => {
    const oi = new Map(oiRows.map(r => [r.strike, { call: r.callOi, put: r.putOi }]));
    const vol = volRows ? new Map(volRows.map(r => [r.strike, { call: r.callVolume, put: r.putVolume }])) : null;
    const chain = book.rows.map(r => nodeOf(r, oi.get(r.strike), vol?.get(r.strike)));
    const todays = bars ? bars.filter(b => nyIsoDate(b.time * 1000) === nyIsoDate(bars[bars.length - 1].time * 1000)) : [];
    const snap: MarketSnapshot = {
      ticker: t,
      spot: book.spot,
      changePercent: changeOf(t),
      priceHistory: todays.map(b => b.close),
      chain,
      indicators: NO_INDICATORS,
      plan: { ...NO_PLAN, ticker: t },
      tape: tapeOf(t, tapeRows),
      src: 'feed',
    };
    return snap;
  });
}

/* ---- the calendar ------------------------------------------------------------------------------------------------ */

/* AN INDEX LISTS ITS DAILIES UNDER A SECOND ROOT (data-feed-samples.md: SPX's own dates are the AM monthlies, SPXW's
   every session) — UW's book under the index's name carries both, so the dates are both roots' */
const DAILY_ROOT: Record<string, string> = { SPX: 'SPXW', NDX: 'NDXP', RUT: 'RUTW', VIX: 'VIXW' };

/** Every listed date from today on, earliest first, with each date's max pain — both roots of an index */
function listedRows(t: string): UwMaxPain[] | null {
  const own = need<UwMaxPain[]>(t, 'maxpain');
  const root = DAILY_ROOT[t];
  const daily = root ? need<UwMaxPain[]>(root, 'maxpain') : null;
  if (!own) return null;
  if (!root) return own;
  return made(`listed:${t}`, [own, daily], () => {
    const byDate = new Map<string, UwMaxPain>();
    for (const r of [...(daily ?? []), ...own]) byDate.set(r.expiry, r);
    return [...byDate.values()].sort((x, y) => (x.expiry < y.expiry ? -1 : x.expiry > y.expiry ? 1 : 0));
  });
}

/** The listed dates the calendar reads: the first listed date at or past each of the ledger's horizons, nearest first */
function calendarDates(t: string): string[] {
  const rows = listedRows(t);
  const listed = listedDates(rows);
  return made(`caldates:${t}`, [rows, today()], () => {
    const out: string[] = [];
    const t0 = dayOf(today()).getTime();
    for (const dte of CALENDAR_DTES) {
      const d = listed.find(x => Math.round((dayOf(x).getTime() - t0) / 86_400_000) >= dte);
      if (d && !out.includes(d)) out.push(d);
    }
    return out;
  });
}

/** The book's rows for listed dates, by date — the parts asked seven dates at a time (61 strikes × 7 under UW's 500) */
function byDateOf(t: string, dates: string[]): Map<string, FeedStrike[]> | null {
  if (!dates.length || !feedWindow(t)) return null;
  const groups: string[][] = [];
  for (let i = 0; i < dates.length; i += 7) groups.push(dates.slice(i, i + 7));
  const answers = groups.map(g => need<UwExpiryStrikeExposure[]>(t, 'exp', g.join(',')));
  if (answers.every(a => !a)) return null;
  return made(`bydate:${t}:${dates.join(',')}`, answers, () => {
    const m = new Map<string, FeedStrike[]>();
    for (const rows of answers)
      for (const row of rows ?? []) {
        const list = m.get(row.expiry) ?? [];
        list.push(feedStrike(row));
        m.set(row.expiry, list);
      }
    return m;
  });
}

/** The vendor's calendar, the house's shape (levels.ts feedSurface) — each date's own at-the-money vol on it */
export function feedSurfaceOf(snap: MarketSnapshot, profile: ExposureProfileData): ExposureSurface | null {
  const t = snap.ticker;
  const book = bookOfName(t);
  if (!book) return null;
  const dates = calendarDates(t);
  const byDate = byDateOf(t, dates);
  const term = need<UwTermPoint[]>(t, 'term');
  return made(`surface:${t}`, [book, profile, byDate, term, snap.changePercent], () => {
    /* the columns are the dates the answers carried, in order (levels.ts dateColumns) */
    const present = byDate ? dates.filter(d => byDate.has(d)) : [];
    const columns = byDate ? dateColumns(byDate, present) : [];
    columns.forEach((c, i) => {
      const v = term?.find(p => p.expiry === present[i])?.volatility;
      c.expiry.iv = v != null && v > 0 ? v : NaN;
    });
    return feedSurface(book, profile, columns, snap.changePercent);
  });
}

/** The chain of one listed date — the lens a reader picked ('0DTE', a week out, the monthly) — null while it comes */
export function feedLensChain(snap: MarketSnapshot, date: Date, exact = false): StrikeNode[] | null {
  const t = snap.ticker;
  const rows = listedRows(t);
  const listed = listedDates(rows);
  const want = isoOf(date);
  const iso = listed.find(d => d >= want);
  if (!iso) return rows ? [] : null;
  /* nothing listed on the day itself: no contract of that day (an empty chain, not a wait) */
  if (exact && iso !== want) return [];
  const inCal = calendarDates(t).includes(iso);
  const byDate = inCal ? byDateOf(t, calendarDates(t)) : byDateOf(t, [iso]);
  const list = byDate?.get(iso);
  if (!list) return null;
  const oi = new Map(snap.chain.map(n => [n.strike, n]));
  return made(`lens:${t}:${iso}`, [list, snap], () =>
    aroundPrice(list, snap.spot, FEED_HALF).map(r => {
      const n = nodeOf(r, undefined, undefined);
      /* the date's own open interest is not in this answer — the strike's whole count stands beside it, as the book's */
      const whole = oi.get(r.strike);
      return { ...n, callOI: whole?.callOI ?? 0, putOI: whole?.putOI ?? 0, volume: whole?.volume ?? NAN };
    })
  );
}

/* ---- the history ------------------------------------------------------------------------------------------------- */

/** The book through time: each past session at its open — the rebuilt field's column on its opening bar (loadOpenColumn),
    never UW's end-of-day state — (and the last two at their close, with the open interest they closed on), and today's
    books as this machine read them, carried on to every minute bar after each read */
function historyOf(t: string): GexSnapshot[] {
  const bars = candlesOf(t) ?? [];
  const sessions = sessionsOf(bars);
  const day0 = today();
  const field = fieldSnaps(t);
  const pastSessions = sessions.filter(s => s.day < day0);
  const opens = pastSessions.map(s => pastPart<GexLevel[]>(t, 'open', openArg(s.day, s.first.open, s.first.time)));
  /* the last three closes — the overnight change reads the two before the trailing session, whichever it is */
  const closers = pastSessions.slice(-3);
  const closes = closers.map(s => pastPart<UwStrikeExposure[]>(t, 'close', closeArg(s.day, s.last.close)));
  const closeOi = closers.map(s => (sessionAfter(s.day) === day0 ? need<UwStrikeOi[]>(t, 'oi') : pastPart<UwStrikeOi[]>(t, 'oi', sessionAfter(s.day))));
  return made(`history:${t}`, [bars, field, ...opens, ...closes, ...closeOi], () => {
    const out: GexSnapshot[] = [];
    pastSessions.forEach((s, i) => {
      const rows = opens[i];
      if (rows && rows.length) out.push({ time: s.first.time, levels: rows });
      const ci = closers.indexOf(s);
      if (ci >= 0) {
        const book = closes[ci] ? bookFrom(t, closes[ci]!) : null;
        const oi = closeOi[ci] ? new Map(closeOi[ci]!.map(r => [r.strike, r])) : null;
        if (book && s.last.time !== s.first.time)
          out.push({
            time: s.last.time,
            levels: book.rows.map(r => {
              const o = oi?.get(r.strike);
              return { strike: r.strike, value: r.gex.net, dex: r.dex.net, ...(o ? { callOI: o.callOi, putOI: o.putOi } : {}) };
            }),
          });
      }
    });
    /* today's session: the book this machine read last at or before each bar, from the first read on */
    const todays = sessions.filter(s => s.day === day0);
    if (todays.length && field.length) {
      const run = bars.filter(b => b.time >= todays[0].first.time);
      let k = -1;
      for (const b of run) {
        while (k + 1 < field.length && field[k + 1].time <= b.time + 59) k++;
        if (k >= 0) out.push({ time: b.time, levels: field[k].levels });
      }
    }
    return out.sort((a, b) => a.time - b.time);
  });
}

/** Building's history. Open interest is counted once a day, after the close — what a session added is known when the
    next count lands, never during it, and the day's traded contracts are not open interest (most of a day's 0DTE
    volume is closed by the bell). So the build on the feed is the last COUNTED session: the count before it (at its
    open) against the count after it (at its close), stamped on the last session's bars so the engine reads it whole.
    data/pinpointBook.ts tells Building it is a session that has closed (`buildClockOf`). */
function oiHistoryOf(t: string): GexSnapshot[] {
  const bars = candlesOf(t) ?? [];
  const sessions = sessionsOf(bars);
  const s = sessions[sessions.length - 1];
  const after = need<UwStrikeOi[]>(t, 'oi');
  const date = after?.[0]?.date ?? '';
  const before = date ? need<UwStrikeOi[]>(t, 'oi', sessionBefore(date)) : null;
  const book = bookOfName(t);
  if (!s || !after || !before || !book || s.last.time <= s.first.time) return [];
  return made(`oihistory:${t}`, [after, before, book, s.first, s.last], () => {
    const a = oiMap(after);
    const b = new Map(before.map(r => [r.strike, { call: r.callOi, put: r.putOi }]));
    const open: GexLevel[] = [];
    const now: GexLevel[] = [];
    for (const r of book.rows) {
      const o = b.get(r.strike) ?? { call: 0, put: 0 };
      const n = a.get(r.strike) ?? { call: 0, put: 0 };
      open.push({ strike: r.strike, value: r.gex.net, callOI: o.call, putOI: o.put });
      now.push({ strike: r.strike, value: r.gex.net, callOI: n.call, putOI: n.put });
    }
    return [
      { time: s.first.time, levels: open },
      { time: s.last.time, levels: now },
    ];
  });
}

/** The session the counts measure — the day before the latest count's date ("Oct 9") — null before the count lands */
export function countedSession(t: string): string | null {
  const after = peek<UwStrikeOi[]>(up(t), 'oi');
  const date = after?.[0]?.date;
  return date ? sessionBefore(date) : null;
}

/** The whole book a minute, the last session's regular minutes */
function minutesOf(t: string): BookMinute[] | null {
  const bars = candlesOf(t);
  const sessions = bars ? sessionsOf(bars) : [];
  const s = sessions[sessions.length - 1];
  const day = s?.day ?? today();
  const rows = need<UwSpotExposure[]>(t, 'minutes', day === today() ? '' : day);
  if (!rows) return null;
  return made(`minutes:${t}`, [rows], () =>
    rows
      .filter(r => r.price != null && Number.isFinite(r.at) && nyIsoDate(r.at) === day)
      .filter(r => {
        const m = nyMinutes(r.at);
        return m >= SESSION_OPEN_MIN && m < SESSION_CLOSE_MIN;
      })
      .map(r => ({ time: Math.floor(r.at / 1000), spot: r.price as number, netGex: -r.gammaOi }))
      .sort((a, b) => a.time - b.time)
  );
}

/** Daily bars for the ATR — a session a bar, oldest first */
function dailyOf(t: string): Candle[] {
  if (isCashIndex(t)) return [];
  const rows = need<UwBar[]>(t, 'daily');
  return made(`daily:${t}`, [rows], () =>
    (rows ?? [])
      .filter(r => r.marketTime === 'r' && r.open != null && r.high != null && r.low != null && r.close != null && Number.isFinite(r.at))
      .map(r => ({ time: Math.floor(r.at / 1000), open: r.open!, high: r.high!, low: r.low!, close: r.close!, volume: r.volume }))
      .sort((a, b) => a.time - b.time)
  );
}

/* ---- the market ---------------------------------------------------------------------------------------------------- */

const up = (t: string) => t.toUpperCase();

export const FEED_MARKET: BookMarket = {
  src: 'feed',
  peekCandles: t => candlesOf(up(t)),
  getCandles: t => candlesOf(up(t)) ?? [],
  getGexHistory: t => historyOf(up(t)),
  oiHistory: t => oiHistoryOf(up(t)),
  cfg: t => cfgOf(up(t)),
  dayChangePct: t => changeOf(up(t)),
  snapshotFor: t => snapshotOf(up(t)),
  isSeeded: t => snapshotOf(up(t)) != null,
  atrBars: t => dailyOf(up(t)),
  bookMinutes: t => minutesOf(up(t)),
  freshness: t => {
    const book = bookOfName(up(t));
    const rows = need<UwStrikeOi[]>(up(t), 'oi');
    return book ? feedFreshness(book, rows ? { date: rows[0]?.date ?? '', byStrike: new Map() } : null) : null;
  },
  deep: t => {
    deepAsked.set(up(t), Date.now());
  },
  oiCounts: t => {
    const name = up(t);
    const after = need<UwStrikeOi[]>(name, 'oi');
    const date = after?.[0]?.date ?? '';
    const before = date ? need<UwStrikeOi[]>(name, 'oi', sessionBefore(date)) : null;
    const book = bookOfName(name);
    if (!after || !before || !before.length || !book) return null;
    /* the strikes round the book's price; a count dated D is the positions at the close of the session before D */
    const lo = book.rows[0]?.strike ?? -Infinity;
    const hi = book.rows[book.rows.length - 1]?.strike ?? Infinity;
    const cut = (rows: UwStrikeOi[]): GexLevel[] => rows.filter(r => r.strike >= lo && r.strike <= hi).map(r => ({ strike: r.strike, value: 0, callOI: r.callOi, putOI: r.putOi }));
    return made(`oicounts:${name}`, [after, before, book], () => ({
      last: cut(after),
      before: cut(before),
      lastDay: shortDay(sessionBefore(date)),
      beforeDay: shortDay(sessionBefore(before[0].date)),
    }));
  },
  maxPain: t => nearMaxPain(listedRows(up(t)))?.strike ?? null,
  surfaceOf: (snap, profile) => feedSurfaceOf(snap, profile),
  lensChain: (snap, date, exact) => feedLensChain(snap, date, exact),
  subscribe: fn => {
    subs.add(fn);
    return () => subs.delete(fn);
  },
  version: () => version,
};

/* READ ON PINPOINT'S PAGES WHILE ITS ROOM READS THE FEED — the address and the room's standing at the call */
let onKey = '';
let onWas = false;
registerFeedMarket(
  FEED_MARKET,
  () => {
    const path = typeof window !== 'undefined' ? window.location.pathname : '';
    const st = getFeedStatus();
    const key = `${path}|${st.uw.state}`;
    if (key !== onKey) {
      onKey = key;
      onWas = roomOfPath(path) === 'pinpoint' && pinpointSource(st) === 'feed';
    }
    return onWas;
  },
  fn => subscribeFeedStatus(fn)
);

/* ---- what the frame reads beside the engines ------------------------------------------------------------------- */

/** Max pain per listed date (the frame's head, the calendar's line) */
export const feedMaxPainRows = (t: string): UwMaxPain[] | null => listedRows(up(t));
/** The name's implied move by horizon (the frame's head) */
export const feedMoveRows = (t: string): UwImpliedMove[] | null => need<UwImpliedMove[]>(up(t), 'iv');
/** Why a name's snapshot has not come — the book's or the open interest's last failure */
export const feedWhy = (t: string): FeedFail | null => failOfPart(t, 'book') ?? failOfPart(t, 'oi') ?? failOfPart(t, 'iv');
/** The session before a count's date — re-exported for the frame's words */
export { sessionBefore };
