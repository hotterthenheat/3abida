/*
==================================================
  SLAYER TERMINAL - TRACE ON THE FEED (data/feed/trace.ts)

  TRACE READS UNUSUAL WHALES (2026-10-12). When the
  room's seam says 'feed' (rooms.ts traceSource: UW up
  and the room wired), every Trace page reads what is
  here, and nothing of the house's own book: one market
  on one screen. When it says 'stand-in', the pages read
  exactly what they read before, and nothing here asks
  the vendor anything (every poll's key is null).

  WHAT READS WHAT
    · THE DAY BOOK (Screener, Footprints, Watchers'
      rows, Windows' contracts, Net Flow's names, the
      Tracker): GET /api/screener/option-contracts — the
      market's 500 heaviest contracts and the active
      name's own 500, a row a contract with its day:
      volume, OI and the OI the close before, premium,
      ask / bid / sweep / floor / multi-leg volume, IV
      and its change, the streaks, the next report. The
      session before (`date`) gives the overnight ledger
      Footprints reads; a contract not in that session's
      lists has no ledger ("—").
    · THE TAPE (Live Tape, the cards' "could also be"):
      GET /api/option-trades, prints of $25K and up, the
      newest 500 every few seconds, kept for the session.
    · THE WATCHERS: GET /api/option-trades/flow-alerts
      ($100K and up), back to the open once, then the
      newest every 15 s.
    · WINDOWS: the tape's big prints ($250K and up, back
      to the open once), cut into the session's quarter
      hours — a window holds the big prints that landed
      in it, said so on the page.
    · MULTI-LEG: GET /api/option-trades/multi-leg ($50K
      and up), its legs asked when a structure opens.
    · NET FLOW / 0DTE / COMPARE: net-prem-ticks a name,
      Market Tide for the market, the same-day net flow
      (net-flow/expiry), top-net-impact for the board.
    · DARK POOL: the name's off-exchange prints, the
      day's volume by price (lit and off), its minute
      bars; the market's sized crosses for the leaders.
    · PRICES: a print carries its own underlying price;
      the name's spot is UW's quote.

  NEVER INVENTED: a figure the answers do not carry is
  NaN here and "—" on the page, titled "not in the feed".
  Times are New York's, the book's session is New
  York's 09:30 to 16:00 (the last session whole outside
  it), as bookSession() says.
==================================================
*/

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { bookSession, windowLabel, WINDOWS_PER_DAY, type Catch, type IntervalSlice, type IntervalWindow, type MoneynessKey, type NetFlowPoint, type NetFlowSegment, type NetFlowView, type NetLeader, type SpreadKind, type SpreadLeg, type SpreadTrade, type WatcherKey } from '../flowBook';
import { reasonMatches, type UserReason } from '../flowReasons';
import type { FollowRecord, Follow } from '../followThrough';
import { SECTOR_LIST } from '../darkpool';
import { isTradingDay, sessionsBetween } from '../../core/calendar';
import { nyClock, nyParts, SESSION_CLOSE_MIN, SESSION_OPEN_MIN } from '../../core/nyTime';
import type { BookContract, FlowPrint } from '../../types/trace';
import { useFeedPoll } from './poll';
import { NOT_IN_FEED, useFeedPrice } from './price';
import { useRoomSource } from './rooms';
import { useFeedStatus } from './status';
import type { FeedResult } from './client';
import {
  uwContractScreener,
  uwDarkpool,
  uwFlowAlerts,
  uwMultiLeg,
  uwOptionTrades,
  uwStockState,
  uwMarketTide,
  uwNetFlowExpiry,
  uwNetPremTicks,
  uwOhlc,
  uwTopNetImpact,
  uwMultiLegLegs,
  uwFlowPerExpiry,
  type UwMultiLegLeg,
  type UwContractDay,
  type UwDarkPrint,
  type UwFlowAlert,
  type UwMultiLeg,
  type UwOptionTrade,
} from './uw';

/* ---- the switch ----------------------------------------------------------------------------------------------- */

export type TraceSource = 'feed' | 'stand-in' | 'pending';

/**
 * What Trace reads now. 'pending' while the room is wired and the shell's first probe has not answered — the page
 * shows nothing rather than a flash of the house's book that the feed then replaces.
 */
export function useTraceSource(): TraceSource {
  const room = useRoomSource('trace');
  const status = useFeedStatus();
  if (room === 'feed') return 'feed';
  return status.uw.state === 'unknown' ? 'pending' : 'stand-in';
}

/** The words a "—" carries when the feed's answer has no such figure */
export { NOT_IN_FEED };
/** A figure the feed left out (NaN), or one with nothing to measure against */
export const isMissing = (v: number | null | undefined): boolean => v === null || v === undefined || !Number.isFinite(v);

/* ---- the session ---------------------------------------------------------------------------------------------- */

export interface FeedSession {
  /** The book's New York date, YYYY-MM-DD */
  date: string;
  /** The session before it */
  prev: string;
  /** Under way: the vendor's latest answers are this session's */
  live: boolean;
  open: number;
  close: number;
  /** New York's minute the book stands at */
  minute: number;
}

const two = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;

export function feedSession(at?: number): FeedSession {
  const s = bookSession(at);
  const d = new Date(s.year, s.month - 1, s.day);
  const p = new Date(d);
  for (let i = 0; i < 10; i++) {
    p.setDate(p.getDate() - 1);
    if (isTradingDay(p)) break;
  }
  return { date: iso(d), prev: iso(p), live: s.live, open: s.open, close: s.close, minute: s.minute };
}

/** The date a call names: none for the session under way (the vendor's latest), else the book's own session */
const dateParam = (s: FeedSession): string | undefined => (s.live ? undefined : s.date);

/** "2026-10-16" → "10/16/2026", the book's spelling */
export const mdy = (isoDate: string): string => {
  const [y, m, d] = isoDate.split('-');
  return `${m}/${d}/${y}`;
};
const dayOf = (isoDate: string): Date => {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d);
};
/** Calendar days from the session's date to an expiry */
export const dteOf = (s: FeedSession, expiry: string): number => Math.max(0, Math.round((dayOf(expiry).getTime() - dayOf(s.date).getTime()) / 86_400_000));
/** New York's minute of the day of an instant */
export const nyMinuteAt = (t: number): number => {
  const p = nyParts(t);
  return p.hour * 60 + p.minute;
};
const sectorInk = new Map(SECTOR_LIST.map(x => [x.sector, x.color]));
const round1 = (v: number) => Math.round(v * 10) / 10;

/** A string id as the stable number the tape's rows key on */
export function idNum(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* ---- the day book ----------------------------------------------------------------------------------------------- */

/** The book's own key — ticker, strike, side, days out, as buildFlowBook keys its rows */
export const bookKey = (ticker: string, strike: number, right: 'C' | 'P', dte: number) => `${ticker}-${strike}-${right}-${dte}`;

/** One contract's day from the vendor, as the book's row; the session before from `prev` when it is there */
export function bookRow(d: UwContractDay, s: FeedSession, prev: UwContractDay | undefined): BookContract {
  const right: 'C' | 'P' = d.type === 'put' ? 'P' : 'C';
  const dte = dteOf(s, d.expiry);
  const spot = d.stockPrice ?? NaN;
  const vol = d.volume;
  const share = (v: number) => (vol > 0 ? Math.round((v / vol) * 100) : NaN);
  const deltaOI = d.openInterest - d.prevOi;
  const iv = d.prevIv !== null && d.ivChange !== null ? (d.prevIv + d.ivChange) * 100 : d.prevIv !== null ? d.prevIv * 100 : NaN;
  const lastMin = Number.isFinite(d.lastFill) ? nyMinuteAt(d.lastFill) : NaN;
  const earn = d.nextEarnings ? sessionsBetween(dayOf(s.date), dayOf(d.nextEarnings)) : null;
  return {
    key: bookKey(d.ticker, d.strike, right, dte),
    occ: d.symbol,
    ticker: d.ticker,
    sector: d.sector || null,
    sectorColor: d.sector ? sectorInk.get(d.sector) ?? null : null,
    strike: d.strike,
    right,
    expiry: mdy(d.expiry),
    dte,
    spot,
    otmPct: spot > 0 ? round1(((d.strike - spot) / spot) * 100) : NaN,
    last: d.close ?? NaN,
    chgPct: d.open && d.close !== null ? round1(((d.close - d.open) / d.open) * 100) : NaN,
    lastAt: Number.isFinite(d.lastFill) ? nyClock(d.lastFill) : '—',
    lastAtMin: Number.isFinite(lastMin) ? lastMin : SESSION_OPEN_MIN,
    volume: vol,
    oi: d.openInterest,
    deltaOI,
    deltaOIPct: d.prevOi > 0 ? round1((deltaOI / d.prevOi) * 100) : NaN,
    premium: d.premium,
    iv: Number.isFinite(iv) ? round1(iv) : NaN,
    ivChg: d.ivChange !== null ? round1(d.ivChange * 100) : NaN,
    volOverOI: d.openInterest > 0 ? Math.round((vol / d.openInterest) * 100) / 100 : NaN,
    sweepPct: share(d.sweepVolume),
    multiPct: share(d.multilegVolume),
    floorPct: share(d.floorVolume),
    askPct: share(d.askVolume),
    bidPct: share(d.bidVolume),
    prevOI: d.prevOi,
    prevVolume: prev ? prev.volume : NaN,
    prevAvgFill: prev && prev.avgPrice !== null ? Math.round(prev.avgPrice * 100) / 100 : NaN,
    prevPremium: prev ? prev.premium : NaN,
    prevAskPct: prev && prev.volume > 0 ? Math.round((prev.askVolume / prev.volume) * 100) : NaN,
    prevBidPct: prev && prev.volume > 0 ? Math.round((prev.bidVolume / prev.volume) * 100) : NaN,
    nameVolume: d.tickerVolume || undefined,
    oiStreak: d.daysOfOiIncreases,
    volGtOiStreak: d.daysOfVolOverOi,
    earnDays: earn,
    /* the session before, quarter hour by quarter hour: not in these answers */
    prevSpark: [],
  };
}

const BOOK_MS = 60_000;
const NAME_MS = 30_000;
const PREV_MS = 15 * 60_000;

/**
 * The day book on the feed: the market's heaviest contracts and the name's own, one row a contract, heaviest volume
 * first. Null until the first answer; an empty list when the vendor refused (the page says nothing traded on its cut).
 */
export function useFeedBook(on: boolean, ticker: string): BookContract[] | null {
  const s = feedSession();
  const date = dateParam(s);
  const t = ticker.toUpperCase();
  const market = useFeedPoll(on ? `trace:book:${s.date}` : null, () => uwContractScreener({ limit: 500, date }), BOOK_MS);
  const name = useFeedPoll(on && t ? `trace:book:${s.date}:${t}` : null, () => uwContractScreener({ ticker: t, limit: 500, date }), NAME_MS);
  const prevMarket = useFeedPoll(on ? `trace:book:${s.prev}` : null, () => uwContractScreener({ limit: 500, date: s.prev }), PREV_MS);
  const prevName = useFeedPoll(on && t ? `trace:book:${s.prev}:${t}` : null, () => uwContractScreener({ ticker: t, limit: 500, date: s.prev }), PREV_MS);
  return useMemo(() => {
    if (!on || (!market && !name)) return null;
    const prev = new Map<string, UwContractDay>();
    for (const r of [prevMarket, prevName]) if (r?.ok) for (const d of r.data) prev.set(d.symbol, d);
    const seen = new Set<string>();
    const rows: BookContract[] = [];
    for (const r of [name, market]) {
      if (!r?.ok) continue;
      for (const d of r.data) {
        if (!d.symbol || seen.has(d.symbol) || d.volume <= 0) continue;
        seen.add(d.symbol);
        rows.push(bookRow(d, s, prev.get(d.symbol)));
      }
    }
    /* one row a contract — the key is the book's, so two symbols that land on one key (never seen) keep the first */
    const keys = new Set<string>();
    const out = rows.filter(r => (keys.has(r.key) ? false : (keys.add(r.key), true)));
    out.sort((a, b) => b.volume - a.volume);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, market, name, prevMarket, prevName, s.date]);
}

/* ---- the tape ---------------------------------------------------------------------------------------------------- */

/** The tape asks for prints of this much and more — the whole market's tape runs hundreds a second */
export const TAPE_FLOOR = 25_000;
const TAPE_MS = 5_000;
const TAPE_KEEP = 800;

/** A print from the feed: its instant, and whether the exchange marked it a floor trade (a condition ending "ft") */
export type FeedPrint = FlowPrint & { at: number; floor?: boolean };

const MULTI_CONDITIONS = /^(ml|tl|mf|me)/;

/** A print from the vendor as the tape's row: every figure its own, the side where it sat in the market */
export function printRow(t: UwOptionTrade, s: FeedSession): FeedPrint {
  const right: 'C' | 'P' = t.type === 'put' ? 'P' : 'C';
  const bid = t.nbboBid ?? NaN;
  const ask = t.nbboAsk ?? NaN;
  const width = ask - bid;
  const fillPos = width > 0 ? Math.max(0, Math.min(1, (t.price - bid) / width)) : t.price >= ask ? 1 : t.price <= bid ? 0 : 0.5;
  /* the side as the vendor tags it; with no tag, where the fill sat against the market it crossed into */
  const side: FlowPrint['side'] = t.tags.includes('ask_side')
    ? 'ASK'
    : t.tags.includes('bid_side')
      ? 'BID'
      : t.tags.includes('mid_side') || t.tags.includes('no_side')
        ? 'MID'
        : Number.isFinite(ask) && t.price >= ask
          ? 'ASK'
          : Number.isFinite(bid) && t.price <= bid
            ? 'BID'
            : 'MID';
  const dayVol = t.askVol + t.bidVol + t.midVol + t.noSideVol;
  const bidPct = dayVol > 0 ? Math.round((t.bidVol / dayVol) * 100) : NaN;
  const spot = t.underlyingPrice ?? NaN;
  const multi = MULTI_CONDITIONS.test(t.condition);
  return {
    id: idNum(t.id),
    at: t.executedAt,
    occ: t.chain,
    time: nyClock(t.executedAt, { seconds: true }),
    ticker: t.ticker,
    /* a multi-leg order's print says it is one, not how many legs it had */
    legs: 1,
    strike: t.strike,
    right,
    otmPct: spot > 0 ? round1(((t.strike - spot) / spot) * 100) : NaN,
    expiry: mdy(t.expiry),
    dte: dteOf(s, t.expiry),
    fill: t.price,
    bid,
    ask,
    fillPos: Math.round(fillPos * 100) / 100,
    side,
    /* where the fill sat in the spread, −100 at the bid to +100 at the ask */
    flowScore: Number.isFinite(width) ? Math.round((fillPos * 2 - 1) * 100) : 0,
    ratioLabel: !Number.isFinite(bidPct) ? '—' : bidPct >= 50 ? `BID ${bidPct}%` : `ASK ${100 - bidPct}%`,
    ratioBidPct: Number.isFinite(bidPct) ? bidPct : NaN,
    ratioAskPct: dayVol > 0 ? Math.round((t.askVol / dayVol) * 100) : NaN,
    size: t.size,
    premium: t.premium,
    volume: t.volume,
    oi: t.openInterest,
    /* a print carries no overnight change */
    deltaOI: NaN,
    spot,
    iv: t.iv !== null ? Math.round(t.iv * 10000) / 100 : NaN,
    volOverOI: t.openInterest > 0 ? Math.round((t.volume / t.openInterest) * 100) / 100 : NaN,
    strat: multi ? 'Multi-leg' : '—',
    sweep: t.flags.includes('intermarket_sweep') || t.condition === 'isoi',
    floor: /ft$/.test(t.condition),
  };
}

/* An accumulating store a key — the session's rows kept as they come, newest first, never twice. Fed by the poll's own
   loader and by the backfill (never during a render); read through useSyncExternalStore. */
interface Acc<T> {
  day: string;
  rows: Map<string, T>;
  list: T[];
  fns: Set<() => void>;
}
const accs = new Map<string, Acc<unknown>>();
function accOf<T>(key: string, day: string): Acc<T> {
  let a = accs.get(key) as Acc<T> | undefined;
  if (!a || a.day !== day) {
    a = { day, rows: new Map(), list: [], fns: a?.fns ?? new Set() };
    accs.set(key, a as Acc<unknown>);
  }
  return a;
}
function absorb<T>(a: Acc<T>, pairs: [string, T][], at: (x: T) => number, keep: number): void {
  let grew = false;
  for (const [id, x] of pairs) {
    if (a.rows.has(id)) continue;
    a.rows.set(id, x);
    grew = true;
  }
  if (!grew) return;
  let entries = Array.from(a.rows.entries()).sort((p, q) => at(q[1]) - at(p[1]));
  if (entries.length > keep) {
    entries = entries.slice(0, keep);
    a.rows = new Map(entries);
  }
  a.list = entries.map(e => e[1]);
  for (const f of Array.from(a.fns)) f();
}
function useAcc<T>(a: Acc<T> | null): T[] | null {
  const sub = useMemo(
    () => (fn: () => void) => {
      if (!a) return () => {};
      a.fns.add(fn);
      return () => {
        a.fns.delete(fn);
      };
    },
    [a]
  );
  const read = () => (a ? a.list : null);
  return useSyncExternalStore(sub, read, read);
}

/** Pages back, once a session, with `older_than` until the open (at most `pages` calls, a breath apart) */
const backfilled = new Set<string>();
async function backfill<T>(key: string, page: (olderThan: string) => Promise<FeedResult<T[]>>, timeOf: (x: T) => number, from: number, open: number, pages: number): Promise<void> {
  if (backfilled.has(key)) return;
  backfilled.add(key);
  let cursor = from;
  for (let i = 0; i < pages && cursor > open; i++) {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      backfilled.delete(key);
      return;
    }
    const r = await page(new Date(cursor).toISOString());
    if (!r.ok || r.data.length === 0) return;
    const oldest = r.data.reduce((m, x) => Math.min(m, timeOf(x)), Infinity);
    if (!(oldest < cursor)) return;
    cursor = oldest;
    await new Promise(res => setTimeout(res, 350));
  }
}

/**
 * One accumulating read: the poll's loader asks for the newest rows and keeps them; once the first answer is in, the
 * session is walked back to the open (when `pages` > 0). Null until the first answer, and null when `on` is false.
 */
function useSessionRows<T>(
  on: boolean,
  key: string,
  periodMs: number,
  ask: (olderThan?: string) => Promise<FeedResult<T[]>>,
  idOf: (x: T) => string,
  timeOf: (x: T) => number,
  keep: number,
  pages: number,
  inSession: (s: FeedSession, x: T) => boolean
): T[] | null {
  const s = feedSession();
  const a = on ? accOf<T>(key, s.date) : null;
  const take = (r: FeedResult<T[]>) => {
    if (a && r.ok) absorb(a, r.data.filter(x => inSession(s, x)).map(x => [idOf(x), x] as [string, T]), timeOf, keep);
    return r;
  };
  const r = useFeedPoll(on ? `trace:${key}` : null, () => ask().then(take), periodMs);
  const first = !!r?.ok;
  useEffect(() => {
    if (!on || !first || pages <= 0 || !a) return;
    const oldest = a.list.reduce((m, x) => Math.min(m, timeOf(x)), s.live ? Date.now() : s.close + 60_000);
    void backfill(`${key}-${s.date}`, older => ask(older).then(take), timeOf, oldest, s.open, pages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, first, s.date]);
  const list = useAcc(a);
  return on && r ? list : null;
}

const within = (s: FeedSession, t: number, slackMs = 0) => t >= s.open && t <= s.close + slackMs;

/** The tape on the feed: the session's prints of $25K and up, newest first. Null until the first answer. */
export function useFeedTape(on: boolean): FeedPrint[] | null {
  const s = feedSession();
  return useSessionRows<FeedPrint>(
    on,
    'tape',
    TAPE_MS,
    older => uwOptionTrades({ limit: 500, minPremium: TAPE_FLOOR, olderThan: older }).then(r => (r.ok ? { ...r, data: r.data.filter(t => !t.canceled).map(t => printRow(t, s)) } : r)),
    p => String(p.id),
    p => p.at,
    TAPE_KEEP,
    0,
    () => true
  );
}

/** The session's big prints for Windows: $250K and up, back to the open once, then the newest */
export const WINDOW_FLOOR = 250_000;
export function useFeedBigPrints(on: boolean): FeedPrint[] | null {
  const s = feedSession();
  return useSessionRows<FeedPrint>(
    on,
    'big',
    20_000,
    older => uwOptionTrades({ limit: 500, minPremium: WINDOW_FLOOR, olderThan: older }).then(r => (r.ok ? { ...r, data: r.data.filter(t => !t.canceled).map(t => printRow(t, s)) } : r)),
    p => String(p.id),
    p => p.at,
    8000,
    24,
    (ss, p) => within(ss, p.at)
  );
}

/* ---- the watchers -------------------------------------------------------------------------------------------- */

export const ALERT_FLOOR = 100_000;
/** The vendor's flow alerts of $100K and up, the session's, newest first */
export function useFeedAlerts(on: boolean): UwFlowAlert[] | null {
  return useSessionRows<UwFlowAlert>(
    on,
    'alerts',
    15_000,
    older => uwFlowAlerts({ limit: 500, minPremium: ALERT_FLOOR, olderThan: older }),
    x => x.id || `${x.chain}-${x.createdAt}`,
    x => x.createdAt,
    4000,
    12,
    (ss, x) => within(ss, x.createdAt, 60_000)
  );
}

/* ---- multi-leg ---------------------------------------------------------------------------------------------------- */

export const SPREAD_FLOOR = 50_000;
export function useFeedMultiLeg(on: boolean): UwMultiLeg[] | null {
  return useSessionRows<UwMultiLeg>(
    on,
    'multi',
    15_000,
    older => uwMultiLeg({ limit: 200, minPremium: SPREAD_FLOOR, olderThan: older }),
    m => m.id || `${m.ticker}-${m.executedAt}-${m.strikes.join('/')}`,
    m => m.executedAt,
    3000,
    10,
    (ss, m) => within(ss, m.executedAt)
  );
}

/* ---- dark pool: the market's sized crosses ---------------------------------------------------------------------- */

export const DARK_LEADER_FLOOR = 1_000_000;
export function useFeedDarkMarket(on: boolean): UwDarkPrint[] | null {
  const s = feedSession();
  return useSessionRows<UwDarkPrint>(
    on,
    'dark-market',
    30_000,
    older => uwDarkpool({ limit: 200, minPremium: DARK_LEADER_FLOOR, date: dateParam(s), olderThan: older }),
    p => `${p.trackingId}-${p.ticker}-${p.executedAt}`,
    p => p.executedAt,
    6000,
    10,
    (ss, p) => !p.canceled && within(ss, p.executedAt, 60 * 60_000)
  );
}

/* ---- a name's price ---------------------------------------------------------------------------------------------- */

/**
 * The name's price on the feed — the day's state (its latest trade and the close before), the price every Trace page and
 * the rail print beside the vendor's prints while the room reads the feed. Null until it answers.
 */
export function useFeedQuote(on: boolean, ticker: string): { spot: number; changePct: number } | null {
  /* one poll a name with the rail (data/feed/price.ts) — the last good answer standing through a 429 */
  return useFeedPrice(on, ticker).price;
}
export const useFeedSpot = (on: boolean, ticker: string): number | null => useFeedQuote(on, ticker)?.spot ?? null;

/** Session clamps for a minute of the day */
export const inSessionMinute = (m: number): number => Math.max(SESSION_OPEN_MIN, Math.min(SESSION_CLOSE_MIN, m));

/* ---- the watchers' catches ---------------------------------------------------------------------------------------- */

/* THE VENDOR'S ALERT, IN THE HOUSE'S WORDS: its rule says the contract was hit again and again — at climbing fills, at
   falling fills, or simply over and over — which are three of the desk's own reasons. The other three (big money, into
   earnings, fresh size) are the desk's reads of a whole day, not a moment, and the feed's alerts do not trip them. */
const ALERT_RULE: Record<string, WatcherKey> = {
  RepeatedHitsAscendingFill: 'climbing',
  RepeatedHitsDescendingFill: 'falling',
  RepeatedHits: 'hammering',
};
/** The reasons the feed's alerts can carry */
export const FEED_REASONS: WatcherKey[] = ['climbing', 'falling', 'hammering'];

/** A contract an alert names, as the book's row — the alert's own figures, the day's others not in it */
export function alertRow(a: UwFlowAlert, s: FeedSession): BookContract {
  const right: 'C' | 'P' = a.type === 'put' ? 'P' : 'C';
  const dte = dteOf(s, a.expiry);
  const spot = a.underlyingPrice ?? NaN;
  return {
    key: bookKey(a.ticker, a.strike, right, dte),
    occ: a.chain,
    ticker: a.ticker,
    sector: a.sector || null,
    sectorColor: a.sector ? sectorInk.get(a.sector) ?? null : null,
    strike: a.strike,
    right,
    expiry: mdy(a.expiry),
    dte,
    spot,
    otmPct: spot > 0 ? round1(((a.strike - spot) / spot) * 100) : NaN,
    last: a.price ?? NaN,
    chgPct: NaN,
    lastAt: nyClock(a.createdAt),
    lastAtMin: nyMinuteAt(a.createdAt),
    volume: a.volume,
    oi: a.openInterest,
    deltaOI: NaN,
    deltaOIPct: NaN,
    premium: NaN,
    iv: a.iv !== null ? round1(a.iv * 100) : NaN,
    ivChg: NaN,
    volOverOI: a.volumeOiRatio !== null ? Math.round(a.volumeOiRatio * 100) / 100 : a.openInterest > 0 ? Math.round((a.volume / a.openInterest) * 100) / 100 : NaN,
    sweepPct: NaN,
    multiPct: NaN,
    floorPct: NaN,
    askPct: NaN,
    prevOI: NaN,
    prevVolume: NaN,
    prevAvgFill: NaN,
    prevPremium: NaN,
    prevAskPct: NaN,
    oiStreak: 0,
    volGtOiStreak: 0,
    earnDays: a.nextEarnings ? sessionsBetween(dayOf(s.date), dayOf(a.nextEarnings)) : null,
    prevSpark: [],
  };
}

/**
 * Every alert the session carried, as the desk's catches, newest first: the vendor's rule in the house's words, the
 * reader's own reasons on the contract's row. The row is the book's when the book carries the contract, else the
 * alert's own. Its clip is the alert's: the contracts, the last fill, the premium, the side its money sat on.
 */
export function feedCatches(alerts: UwFlowAlert[], book: BookContract[], reasons: UserReason[], s: FeedSession): Catch[] {
  const byOcc = new Map<string, BookContract>();
  for (const r of book) if (r.occ) byOcc.set(r.occ, r);
  const out: Catch[] = [];
  for (const a of alerts) {
    const row = byOcc.get(a.chain) ?? alertRow(a, s);
    const house = ALERT_RULE[a.rule];
    const mine: string[] = [];
    for (const reason of reasons) {
      if (reasonMatches(reason, row)) mine.push(reason.id);
      if (mine.length === 2) break;
    }
    const rules = [...(house ? [house] : []), ...mine].slice(0, 2);
    const minute = nyMinuteAt(a.createdAt);
    const side: Catch['side'] = a.askSidePremium >= a.bidSidePremium ? 'ASK' : 'BID';
    for (const rule of rules) {
      out.push({
        id: `${a.id || `${a.chain}-${a.createdAt}`}-${rule}`,
        rule,
        mine: rule !== house,
        minute,
        time: nyClock(a.createdAt),
        clipSize: a.totalSize,
        clipFill: a.price ?? NaN,
        clipPremium: a.totalPremium,
        side,
        row,
        spotAt: a.underlyingPrice ?? undefined,
      });
    }
  }
  out.sort((a, b) => b.minute - a.minute);
  return out;
}

/** A move under this, either way, is "barely moved" — followThrough's own line */
const FLAT = 0.05;

/**
 * What the stock did after each flag, on the feed: from the price the alert carried to the newest price the feed has
 * for the name since (a later alert's, the book's, the tape's). A flag with no later price is counted apart, never
 * called flat.
 */
export function feedFollowThrough(catches: Catch[], latest: Map<string, { price: number; at: number }>, s: FeedSession): FollowRecord & { unmeasured: number } {
  const rows: Follow[] = [];
  let unmeasured = 0;
  for (const c of catches) {
    const now = latest.get(c.row.ticker);
    const at = s.open + (c.minute - (9 * 60 + 30)) * 60_000;
    if (!c.spotAt || !now || now.at <= at + 60_000) {
      unmeasured++;
      continue;
    }
    const dir: 1 | -1 = (c.row.right === 'C') === (c.side === 'ASK') ? 1 : -1;
    const movePct = ((now.price - c.spotAt) / c.spotAt) * 100;
    const way = Math.abs(movePct) < FLAT ? 'flat' : Math.sign(movePct) === dir ? 'with' : 'against';
    rows.push({ c, dir, from: c.spotAt, to: now.price, movePct, way });
  }
  return {
    rows,
    total: rows.length,
    with: rows.filter(r => r.way === 'with').length,
    against: rows.filter(r => r.way === 'against').length,
    flat: rows.filter(r => r.way === 'flat').length,
    closed: !s.live,
    unmeasured,
  };
}

/** The newest price the feed holds for each name: the alerts' own, and the book's (as of its last answer) */
export function latestPrices(alerts: UwFlowAlert[], book: BookContract[], bookAt: number): Map<string, { price: number; at: number }> {
  const m = new Map<string, { price: number; at: number }>();
  const put = (t: string, price: number, at: number) => {
    if (!(price > 0)) return;
    const had = m.get(t);
    if (!had || at > had.at) m.set(t, { price, at });
  };
  for (const a of alerts) if (a.underlyingPrice) put(a.ticker, a.underlyingPrice, a.createdAt);
  for (const r of book) put(r.ticker, r.spot, bookAt);
  return m;
}

/* ---- the day in windows, from the big prints ---------------------------------------------------------------------- */

const windowOfMinute = (m: number) => Math.max(0, Math.min(WINDOWS_PER_DAY - 1, Math.floor((m - (9 * 60 + 30)) / 15)));

/** A contract the tape named, as the book's row — the print's own figures, the day's others not in it */
function printBookRow(p: FeedPrint, dayVolume: number): BookContract {
  return {
    key: bookKey(p.ticker, p.strike, p.right, p.dte),
    occ: p.occ,
    ticker: p.ticker,
    sector: null,
    sectorColor: null,
    strike: p.strike,
    right: p.right,
    expiry: p.expiry,
    dte: p.dte,
    spot: p.spot,
    otmPct: p.otmPct,
    last: p.fill,
    chgPct: NaN,
    lastAt: p.time.slice(0, 5),
    lastAtMin: nyMinuteAt(p.at),
    volume: dayVolume,
    oi: p.oi,
    deltaOI: NaN,
    deltaOIPct: NaN,
    premium: NaN,
    iv: p.iv,
    ivChg: NaN,
    volOverOI: p.oi > 0 ? Math.round((dayVolume / p.oi) * 100) / 100 : NaN,
    sweepPct: NaN,
    multiPct: NaN,
    floorPct: NaN,
    askPct: p.ratioAskPct ?? NaN,
    bidPct: Number.isFinite(p.ratioBidPct) ? p.ratioBidPct : undefined,
    prevOI: NaN,
    prevVolume: NaN,
    prevAvgFill: NaN,
    prevPremium: NaN,
    prevAskPct: NaN,
    oiStreak: 0,
    volGtOiStreak: 0,
    earnDays: null,
    prevSpark: [],
  };
}

export interface FeedWindows {
  windows: IntervalWindow[];
  slices: (idx: number) => IntervalSlice[];
}

/**
 * The session in quarter hours, off the big prints: a window holds the contracts those prints carried inside it — their
 * size, their money, the side they sat on — against each contract's whole day (the book's, else the volume the
 * contract's latest print carried).
 */
export function feedWindows(prints: FeedPrint[], book: BookContract[], s: FeedSession): FeedWindows {
  const byOcc = new Map<string, BookContract>();
  for (const r of book) if (r.occ) byOcc.set(r.occ, r);
  const nowIdx = windowOfMinute(s.minute);
  const cells = new Map<string, { idx: number; occ: string; size: number; prem: number; ask: number; bid: number; sweep: number; multi: number; floor: number; ivs: number[]; last: FeedPrint }>();
  const latest = new Map<string, FeedPrint>();
  const totals = new Array<number>(nowIdx + 1).fill(0);
  for (const p of prints) {
    if (!p.occ || p.at < s.open || p.at > s.close) continue;
    const idx = windowOfMinute(nyMinuteAt(p.at));
    if (idx > nowIdx) continue;
    const had = latest.get(p.occ);
    if (!had || p.at > had.at) latest.set(p.occ, p);
    const k = `${p.occ}|${idx}`;
    const c = cells.get(k) ?? { idx, occ: p.occ, size: 0, prem: 0, ask: 0, bid: 0, sweep: 0, multi: 0, floor: 0, ivs: [], last: p };
    c.size += p.size;
    c.prem += p.premium;
    if (p.side === 'ASK') c.ask += p.size;
    else if (p.side === 'BID') c.bid += p.size;
    if (p.sweep) c.sweep += p.size;
    if (p.strat === 'Multi-leg') c.multi += p.size;
    if (p.floor) c.floor += p.size;
    if (Number.isFinite(p.iv)) c.ivs.push(p.iv);
    if (p.at > c.last.at) c.last = p;
    cells.set(k, c);
    totals[idx] += p.size;
  }
  const rowOf = (occ: string): BookContract => {
    const b = byOcc.get(occ);
    if (b) return b;
    const p = latest.get(occ)!;
    return printBookRow(p, p.volume);
  };
  const windows: IntervalWindow[] = totals.map((v, idx) => ({ idx, label: windowLabel(idx), totalVol: v, live: s.live && idx === nowIdx }));
  const byIdx = new Map<number, IntervalSlice[]>();
  for (const c of cells.values()) {
    const row = rowOf(c.occ);
    const day = row.volume > 0 ? row.volume : NaN;
    const slice: IntervalSlice = {
      key: `${row.key}-${c.idx}`,
      window: c.idx,
      vol: c.size,
      shareOfDayPct: Number.isFinite(day) ? Math.min(100, Math.round((c.size / day) * 1000) / 10) : NaN,
      premium: c.prem,
      avgFill: c.size > 0 ? Math.round((c.prem / (c.size * 100)) * 100) / 100 : NaN,
      ivChg: c.ivs.length >= 2 ? Math.round((c.ivs[c.ivs.length - 1] - c.ivs[0]) * 10) / 10 : NaN,
      sweepPct: Math.round((c.sweep / c.size) * 100),
      multiPct: Math.round((c.multi / c.size) * 100),
      floorPct: Math.round((c.floor / c.size) * 100),
      askPct: Math.round((c.ask / c.size) * 100),
      bidPct: Math.round((c.bid / c.size) * 100),
      volOverOI: row.oi > 0 ? Math.round((c.size / row.oi) * 100) / 100 : NaN,
      row,
    };
    const list = byIdx.get(c.idx) ?? [];
    list.push(slice);
    byIdx.set(c.idx, list);
  }
  for (const list of byIdx.values()) list.sort((a, b) => b.vol - a.vol);
  return { windows, slices: idx => byIdx.get(idx) ?? [] };
}

/* ---- net premium through the session ------------------------------------------------------------------------------ */

/** A line the pane draws on the feed: the money (cumulative net call and put premium), and the price behind it */
export interface FeedFlowLine {
  view: NetFlowView;
  /** The price ribbon, a point a minute (epoch seconds) */
  spot: { time: number; value: number }[];
}

const toSec = (t: number) => Math.floor(t / 1000);
const minuteSec = (t: number) => Math.floor(t / 60_000) * 60;

function viewOf(points: NetFlowPoint[]): NetFlowView {
  const last = points[points.length - 1];
  const vol = points.reduce((a, p) => a + (Number.isFinite(p.vol) ? p.vol : 0), 0);
  return { points, ncp: last?.callPrem ?? 0, npp: last?.putPrem ?? 0, vol: points.some(p => Number.isFinite(p.vol) && p.vol > 0) ? vol : NaN, count: NaN };
}

/** A name's minute bars inside the session, as the pane's price ribbon */
function spotOf(bars: { at: number; close: number | null }[] | null, s: FeedSession): { time: number; value: number }[] {
  if (!bars) return [];
  return bars
    .filter(b => b.at >= s.open && b.at < s.close && b.close !== null)
    .sort((a, b) => a.at - b.at)
    .map(b => ({ time: minuteSec(b.at), value: b.close as number }));
}

/**
 * One name's session on the feed: its net premium a tick a minute (every expiry — the ticks are not cut by expiry),
 * cumulated, its calls and puts traded a minute, on its own minute closes.
 */
export function useFeedNameFlow(on: boolean, ticker: string | null): FeedFlowLine | null {
  const s = feedSession();
  const t = ticker?.toUpperCase() ?? '';
  const date = dateParam(s);
  const ticks = useFeedPoll(on && t ? `trace:ticks:${t}:${s.date}` : null, () => uwNetPremTicks(t, date), 30_000);
  const bars = useFeedPoll(on && t ? `trace:bars:${t}:${s.date}` : null, () => uwOhlc(t, { size: '1m', limit: 1000, date }), 30_000);
  return useMemo(() => {
    if (!on || !t || !ticks) return null;
    const rows = ticks.ok ? ticks.data.filter(k => k.at >= s.open && k.at < s.close).sort((a, b) => a.at - b.at) : [];
    let call = 0;
    let put = 0;
    const points: NetFlowPoint[] = rows.map(k => {
      call += k.netCallPremium;
      put += k.netPutPremium;
      return { time: minuteSec(k.at), callPrem: Math.round(call), putPrem: Math.round(put), vol: k.callVolume + k.putVolume, volUp: k.netCallPremium - k.netPutPremium >= 0 };
    });
    return { view: viewOf(points), spot: spotOf(bars?.ok ? bars.data : null, s) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, t, ticks, bars, s.date]);
}

/** Market Tide: the whole market's net call and put premium, a point a minute, cumulative — with SPY's minute closes behind it */
export function useFeedTide(on: boolean, otmOnly = false): FeedFlowLine | null {
  const s = feedSession();
  const date = dateParam(s);
  const tide = useFeedPoll(on ? `trace:tide:${otmOnly ? 'otm' : 'all'}:${s.date}` : null, () => uwMarketTide({ date, otmOnly: otmOnly || undefined, interval5m: false }), 60_000);
  const bars = useFeedPoll(on ? `trace:bars:SPY:${s.date}` : null, () => uwOhlc('SPY', { size: '1m', limit: 1000, date }), 30_000);
  return useMemo(() => {
    if (!on || !tide) return null;
    const rows = tide.ok ? tide.data.filter(k => k.at >= s.open && k.at < s.close).sort((a, b) => a.at - b.at) : [];
    let prev: { c: number; p: number } | null = null;
    const points: NetFlowPoint[] = rows.map(k => {
      const up = prev ? k.netCallPremium - prev.c - (k.netPutPremium - prev.p) >= 0 : true;
      prev = { c: k.netCallPremium, p: k.netPutPremium };
      /* the tide carries net volume, not contracts traded — the pane's floor stays empty */
      return { time: minuteSec(k.at), callPrem: Math.round(k.netCallPremium), putPrem: Math.round(k.netPutPremium), vol: NaN, volUp: up };
    });
    return { view: viewOf(points), spot: spotOf(bars?.ok ? bars.data : null, s) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, tide, bars, s.date]);
}

/** The cuts the same-day net flow carries: the whole market, or its stocks alone */
export const feedZeroDteSeg = (seg: NetFlowSegment): 'all' | 'equity_only' | null => (seg === 'all' ? 'all' : seg === 'stocks' ? 'equity_only' : null);

/** The market's same-day money: net premium on contracts expiring today, a point a minute, cumulative, with SPY's price */
export function useFeedZeroDte(on: boolean, seg: NetFlowSegment, mny: MoneynessKey): FeedFlowLine | null {
  const s = feedSession();
  const date = dateParam(s);
  const tideType = feedZeroDteSeg(seg);
  const key = on && tideType ? `trace:0dte:${tideType}:${mny}:${s.date}` : null;
  const r = useFeedPoll(key, () => uwNetFlowExpiry({ expiration: 'zero_dte', moneyness: mny, tideType: tideType ?? 'all', date }), 30_000);
  return useMemo(() => {
    if (!key || !r) return null;
    const rows = r.ok ? r.data.filter(k => k.at >= s.open && k.at < s.close).sort((a, b) => a.at - b.at) : [];
    let prev: { c: number; p: number } | null = null;
    const points: NetFlowPoint[] = [];
    const spot: { time: number; value: number }[] = [];
    for (const k of rows) {
      const was: { c: number; p: number } | null = prev;
      const c: number = k.netCallPremium ?? was?.c ?? 0;
      const p: number = k.netPutPremium ?? was?.p ?? 0;
      points.push({ time: minuteSec(k.at), callPrem: Math.round(c), putPrem: Math.round(p), vol: NaN, volUp: was ? c - was.c - (p - was.p) >= 0 : true });
      prev = { c, p };
      if (k.underlyingPrice !== null) spot.push({ time: minuteSec(k.at), value: k.underlyingPrice });
    }
    return { view: viewOf(points), spot };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, r]);
}

/**
 * The board on the feed: the names with the most net premium either way today (the vendor's top fifty each way), as the
 * board's rows — the net is the vendor's; its calls and puts apart, and the contracts that carried it, are not in that
 * answer; the name's whole option volume is the book's where the book carries the name.
 */
export function useFeedLeaders(on: boolean, book: BookContract[]): NetLeader[] | null {
  const s = feedSession();
  const r = useFeedPoll(on ? `trace:impact:${s.date}` : null, () => uwTopNetImpact({ limit: 100, date: dateParam(s) }), 60_000);
  return useMemo(() => {
    if (!on || !r) return null;
    if (!r.ok) return [];
    const info = new Map<string, { sector: string | null; color: string | null; volume: number }>();
    for (const b of book) if (!info.has(b.ticker)) info.set(b.ticker, { sector: b.sector, color: b.sectorColor, volume: b.nameVolume ?? NaN });
    const seen = new Set<string>();
    return r.data
      .filter(x => x.ticker && !seen.has(x.ticker) && (seen.add(x.ticker), true))
      .map(x => {
        const i = info.get(x.ticker);
        return { ticker: x.ticker, sector: i?.sector ?? null, sectorColor: i?.color ?? null, net: x.netPremium, netCall: NaN, netPut: NaN, volume: i?.volume ?? NaN, count: NaN };
      })
      .sort((a, b) => b.net - a.net);
  }, [on, r, book]);
}

/** Epoch seconds of the session's minutes so far — the pane's own axis on the feed */
export const sessionSeconds = (s: FeedSession): number[] => {
  const first = toSec(s.open);
  const n = Math.max(1, s.minute - (9 * 60 + 30) + 1);
  return Array.from({ length: n }, (_, i) => first + i * 60);
};

/* ---- multi-leg orders as the page's structures -------------------------------------------------------------------- */

/** The vendor's name for a shape, as the page's kind */
export function kindOfStrategy(strategy: string): SpreadKind {
  const st = strategy.toLowerCase();
  if (st.includes('vertical')) return 'vertical';
  if (st.includes('condor')) return 'condor';
  if (st.includes('butterfly')) return 'butterfly';
  if (st === 'straddle') return 'straddle';
  if (st === 'strangle') return 'strangle';
  if (st.includes('calendar')) return 'calendar';
  if (st.includes('diagonal')) return 'diagonal';
  if (st.includes('ratio') || st.includes('backspread')) return 'ratio';
  if (st.includes('reversal')) return 'reversal';
  return 'other';
}

/**
 * A multi-leg order as the page's structure: the vendor's net price a structure (a debit positive), its premium, its max
 * loss and profit where it gives them, its greeks a structure (the answer's are the whole order's: size × 100 shares),
 * its near expiry by its days to it. The legs come when the structure is opened.
 */
export function spreadOf(m: UwMultiLeg, s: FeedSession): SpreadTrade {
  const near = new Date(dayOf(s.date));
  near.setDate(near.getDate() + m.minDte);
  const per = m.size > 0 ? m.size * 100 : NaN;
  const strikes = Array.from(new Set(m.strikes)).sort((a, b) => a - b);
  return {
    id: m.id || `${m.ticker}-${m.executedAt}`,
    minute: nyMinuteAt(m.executedAt),
    time: nyClock(m.executedAt),
    ticker: m.ticker,
    kind: kindOfStrategy(m.strategy),
    strikesLabel: strikes.join(' / '),
    expiry: mdy(iso(near)),
    dte: m.minDte,
    size: m.size,
    net: m.netPrice ?? NaN,
    premium: m.netPremium !== null ? Math.abs(m.netPremium) : NaN,
    maxLoss: m.maxLoss !== null ? Math.abs(m.maxLoss) : NaN,
    maxProfit: m.maxProfit !== null ? Math.abs(m.maxProfit) : NaN,
    iv: m.avgIv !== null ? round1(m.avgIv * 100) : NaN,
    delta: m.netDelta !== null ? Math.round((m.netDelta / per) * 100) / 100 : NaN,
    theta: m.netTheta !== null ? Math.round((m.netTheta / per) * 100) / 100 : NaN,
    spot: m.underlyingPrice ?? NaN,
    legs: [],
    strikeList: strikes,
    legCount: m.legCount,
  };
}

/** A structure's legs, asked once when it is opened. Null while they are asked. */
export function useFeedLegs(on: boolean, id: string | null): UwMultiLegLeg[] | null {
  const r = useFeedPoll(on && id ? `trace:legs:${id}` : null, () => uwMultiLegLegs(id!), 10 * 60_000);
  return r ? (r.ok ? r.data : []) : null;
}

/** The legs as the structure's own: bought where the leg printed at the ask, sold at the bid */
export function legsOf(legs: UwMultiLegLeg[], s: FeedSession, size: number): SpreadLeg[] {
  return legs.map(l => ({
    side: l.side === 'bid' ? 'SELL' : 'BUY',
    ratio: size > 0 ? Math.max(1, Math.round(l.size / size)) : 1,
    strike: l.strike,
    right: l.type === 'put' ? 'P' : 'C',
    expiry: mdy(l.expiry),
    dte: dteOf(s, l.expiry),
    fill: l.price ?? NaN,
  }));
}

/** A leg's contract as the book's row — the leg's own day (volume, open interest, IV), the rest not in the answer */
export function legRow(t: SpreadTrade, l: UwMultiLegLeg, i: number, s: FeedSession): BookContract {
  const right: 'C' | 'P' = l.type === 'put' ? 'P' : 'C';
  const dte = dteOf(s, l.expiry);
  return {
    key: `${t.id}-l${i}`,
    occ: l.symbol,
    ticker: t.ticker,
    sector: null,
    sectorColor: null,
    strike: l.strike,
    right,
    expiry: mdy(l.expiry),
    dte,
    spot: t.spot,
    otmPct: t.spot > 0 ? round1(((l.strike - t.spot) / t.spot) * 100) : NaN,
    last: l.price ?? NaN,
    chgPct: NaN,
    lastAt: t.time,
    lastAtMin: t.minute,
    volume: l.volume,
    oi: l.openInterest,
    deltaOI: NaN,
    deltaOIPct: NaN,
    premium: NaN,
    iv: l.iv !== null ? round1(l.iv * 100) : NaN,
    ivChg: NaN,
    volOverOI: l.openInterest > 0 ? Math.round((l.volume / l.openInterest) * 100) / 100 : NaN,
    sweepPct: NaN,
    multiPct: NaN,
    floorPct: NaN,
    askPct: NaN,
    prevOI: NaN,
    prevVolume: NaN,
    prevAvgFill: NaN,
    prevPremium: NaN,
    prevAskPct: NaN,
    oiStreak: 0,
    volGtOiStreak: 0,
    earnDays: null,
    prevSpark: [],
  };
}

/* ---- prices for a list of names ------------------------------------------------------------------------------------ */

/** The names' prices on the feed, the day's state each (at most twelve, the first twelve asked) — the Tracker's "now" */
export function useFeedPrices(on: boolean, tickers: string[]): Map<string, number> | null {
  const list = Array.from(new Set(tickers.map(t => t.toUpperCase()))).sort().slice(0, 12);
  const key = on && list.length ? `trace:prices:${list.join(',')}` : null;
  const r = useFeedPoll(
    key,
    async () => {
      const got = await Promise.all(list.map(t => uwStockState(t)));
      const data = got.flatMap(g => (g.ok && g.data.close !== null ? [{ ticker: g.data.ticker, price: g.data.close }] : []));
      return { ok: true as const, data, at: Date.now() };
    },
    30_000
  );
  return useMemo(() => (r?.ok ? new Map(r.data.map(x => [x.ticker, x.price])) : null), [r]);
}

/* ---- one name's whole book ------------------------------------------------------------------------------------------ */

/**
 * One name's contracts today (the vendor's 500 heaviest at most) — `complete` when the answer held fewer, so a sum over
 * the rows is the name's whole day; else a sum is left unsaid.
 */
export function useFeedNameBook(on: boolean, ticker: string): { rows: BookContract[]; complete: boolean } | null {
  const s = feedSession();
  const t = ticker.toUpperCase();
  const r = useFeedPoll(on && t ? `trace:book:${s.date}:${t}` : null, () => uwContractScreener({ ticker: t, limit: 500, date: dateParam(s) }), 30_000);
  return useMemo(() => {
    if (!on || !r) return null;
    if (!r.ok) return { rows: [], complete: false };
    const rows = r.data.filter(d => d.volume > 0 && d.ticker === t).map(d => bookRow(d, s, undefined));
    return { rows, complete: r.data.length < 500 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, r, t, s.date]);
}

/** One name's day by expiry — the premium and the volume at the ask and on the bid */
export function useFeedNameExpiries(on: boolean, ticker: string) {
  const s = feedSession();
  const t = ticker.toUpperCase();
  const r = useFeedPoll(on && t ? `trace:expflow:${t}:${s.date}` : null, () => uwFlowPerExpiry(t, dateParam(s)), 60_000);
  return r?.ok ? r.data : null;
}
