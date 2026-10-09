/*
==================================================
  SLAYER TERMINAL - ONE BOOK FOR PINPOINT (data/pinpointBook.ts)

  THE PAGES DISAGREED (the audit's X1.6–X1.8, 2026-
  10-09): within a minute the call wall read 480 on
  the Map and the Board and 481 on Ahead, Building,
  At the wall and Compare, and one strike carried
  three sets of odds. Each page built its own book —
  its own scan of the market, ten seconds apart from
  the next page's; its own strike window (15, 20 or
  30 each side), which set the heaviest strike, the
  shelves, the air pockets and the paths; its own
  calendar at its own width, which set the vol lean;
  and the Board read the simulator while the pages
  read the live tick, whose prints lean the odds.

  Now there is ONE of each, per name:

    the scan     one snapshot of a name per ten
                 seconds, shared by every page that
                 asks within them (scanOf)
    the book     built on the whole chain, thirty
                 strikes each side, today's
                 contracts (profileOf), the calendar
                 at the same width (surfaceOf), the
                 day's build, the wall model's
                 context — once per scan and clock
                 minute (bookOf)
    the reads    the agenda, the wall board, the
                 close odds, the range and the
                 schedule, each read off that book
                 and kept with it

  A page's strike window chooses WHICH ROWS IT DRAWS
  (inWindow), never what the rows say. The levels,
  the odds and the paths are the same on every page.
==================================================
*/

import Simulator from '../core/simulator';
import { buildExposureProfile, type StrikeWindow } from './exposure';
import { buildExposureSurface, CALENDAR_DTES, type ExposureSurface } from './exposureSurface';
import { buildBuilding, type Building } from './building';
import { buildWallBoard, buildWallContext, type WallBoard, type WallContext } from './wall';
import { buildAgenda, type Agenda, type AgendaOrder } from './agenda';
import { buildCloseOdds, buildCorridor, buildSchedule, type AheadClock, type CloseOdds, type Corridor, type Schedule, type VolPoints } from './ahead';
import { sessionBars } from './levelview';
import type { ExposureProfileData } from '../types/gex';
import type { Candle, MarketSnapshot } from '../types/market';

/** The whole chain — every strike the book carries each side of spot */
export const BOOK_WINDOW: StrikeWindow = 30;
/** One scan of a name per this long; a name change is immediate */
export const SCAN_MS = 10_000;

/* ---- the scan ------------------------------------------------------------------- */

export interface Scan {
  snap: MarketSnapshot;
  /** When it was taken, epoch ms */
  at: number;
}

const scans = new Map<string, Scan>();

/**
 * The scan of a name, shared by every page: the same snapshot until SCAN_MS has
 * passed, then the next one. `live` is the terminal's own tick for its name (it
 * carries the tick's prints); any other name is the simulator's pure read.
 */
export function scanOf(ticker: string, live?: MarketSnapshot | null, nowMs = Date.now()): Scan | null {
  const t = ticker.toUpperCase();
  const prev = scans.get(t);
  if (prev && nowMs - prev.at < SCAN_MS) return prev;
  let snap: MarketSnapshot | null = live && live.ticker === t ? live : null;
  if (!snap) {
    try {
      snap = Simulator.snapshotFor(t);
    } catch {
      return prev ?? null;
    }
  }
  if (!snap || !snap.chain?.length) return prev ?? null;
  const next = { snap, at: nowMs };
  scans.set(t, next);
  return next;
}

/** The scan already on hand for a name, without taking a new one */
export const peekScan = (ticker: string): Scan | null => scans.get(ticker.toUpperCase()) ?? null;

/* ---- the book ------------------------------------------------------------------- */

const profiles = new WeakMap<MarketSnapshot, ExposureProfileData>();
const surfaces = new WeakMap<MarketSnapshot, ExposureSurface | null>();

/** Today's contracts on the whole chain — the profile every Pinpoint page reads */
export function profileOf(snap: MarketSnapshot): ExposureProfileData {
  let p = profiles.get(snap);
  if (!p) {
    p = buildExposureProfile(snap, '0DTE', BOOK_WINDOW);
    profiles.set(snap, p);
  }
  return p;
}

/** The calendar at the book's width — null for a name the desk cannot price */
export function surfaceOf(snap: MarketSnapshot): ExposureSurface | null {
  if (surfaces.has(snap)) return surfaces.get(snap) ?? null;
  let s: ExposureSurface | null = null;
  try {
    s = buildExposureSurface(snap, BOOK_WINDOW, CALENDAR_DTES);
  } catch {
    s = null;
  }
  surfaces.set(snap, s);
  return s;
}

export interface Book {
  ticker: string;
  spot: number;
  snap: MarketSnapshot;
  clock: AheadClock;
  iv: number;
  /** Today's session bars, New York's open on (levelview.ts sessionCut) */
  bars: Candle[];
  profile: ExposureProfileData;
  surface: ExposureSurface | null;
  building: Building;
  ctx: WallContext;
  /** The reads already made off this book */
  memo: Map<string, unknown>;
}

/** A clock minute — the book's reads move with the clock, not with each render */
const clockKey = (c: AheadClock) => `${c.inSession ? 1 : 0}|${c.minutesLeft}|${c.nowMin ?? ''}`;
const books = new WeakMap<MarketSnapshot, { key: string; book: Book }>();

/** The book of a scan at a clock minute — built once, read by every page */
export function bookOf(snap: MarketSnapshot, clock: AheadClock): Book {
  const key = clockKey(clock);
  const kept = books.get(snap);
  if (kept && kept.key === key) return kept.book;
  const t = snap.ticker;
  const iv = Simulator.TICKERS[t]?.iv ?? 0.2;
  const profile = profileOf(snap);
  const surface = surfaceOf(snap);
  const bars = sessionBars(t) ?? [];
  const building = buildBuilding(snap, Simulator.getGexHistory(t) ?? [], Simulator.getCandles(t) ?? [], profile, clock);
  const ctx = buildWallContext(snap, profile, building, surface, bars, clock, iv);
  const book: Book = { ticker: t, spot: snap.spot, snap, clock, iv, bars, profile, surface, building, ctx, memo: new Map() };
  books.set(snap, { key, book });
  return book;
}

const memo = <T>(book: Book, key: string, make: () => T): T => {
  if (book.memo.has(key)) return book.memo.get(key) as T;
  const v = make();
  book.memo.set(key, v);
  return v;
};

/** Every strike in the order asked — Targets, the Board's first strike, Compare's */
export const agendaOf = (book: Book, order: AgendaOrder = 'matters'): Agenda =>
  memo(book, `agenda:${order}`, () => buildAgenda(book.snap, book.profile, book.building, book.surface, book.bars, book.clock, book.iv, order, book.ctx));

/** Every wall on the book, with the one in focus — At the wall */
export const wallBoardOf = (book: Book, focus: number | null = null): WallBoard =>
  memo(book, `walls:${focus ?? ''}`, () => buildWallBoard(book.snap, book.profile, book.building, book.surface, book.bars, book.clock, book.iv, focus, book.ctx));

/** The range likely to hold to the close — Ahead */
export const corridorOf = (book: Book): Corridor => memo(book, 'corridor', () => buildCorridor(book.snap, book.profile, book.iv, book.clock));

/** Where the close lands, strike by strike — Ahead, Compare */
export const closeOddsOf = (book: Book): CloseOdds => memo(book, 'close', () => buildCloseOdds(book.profile, book.spot, corridorOf(book).sigma, book.clock));

/** What dealers must trade each half hour, and if vol moves — Ahead */
export const scheduleOf = (book: Book, vol: VolPoints = -1): Schedule => memo(book, `schedule:${vol}`, () => buildSchedule(book.snap, book.profile, book.clock, vol, book.surface));

/* ---- what a page draws ------------------------------------------------------------ */

/* THE STRIKES CONTROL, ONE FOR THE ROOM (the audit's PP-20): "Strikes: 20 each side" on the Map, "15 each side" on
   Targets, "±15" on Building — one name, one set of choices, one remembered pick for the room now (pages/pinpoint/
   usePinpoint.tsx keeps it). 15 is the floor (Noah, 2026-09-22: "15 should be the absolute smallest strike size"), 20
   the rest he chose, 30 every strike the chain has. */
export type RoomWindow = 15 | 20 | 25 | 30;
export const ROOM_WINDOWS: RoomWindow[] = [15, 20, 25, 30];
export const ROOM_WINDOW_REST: RoomWindow = 20;
/** The control's options, worded once */
export const STRIKE_OPTIONS: { value: RoomWindow; label: string; hint: string }[] = ROOM_WINDOWS.map(w => ({
  value: w,
  label: `${w} each side`,
  hint: w === 30 ? `Every strike the chain has — ${w * 2 + 1} rows` : `${w * 2 + 1} rows — ${w} strikes above spot and ${w} below`,
}));
/** The control's one line */
export const STRIKES_TITLE = 'How many strikes around spot the page draws — the levels and the odds are read on every strike either way';

/**
 * The rows a page draws: `half` strikes each side of spot, from rows in any order.
 * The window is a drawing choice only — the rows' figures are the book's.
 */
export function inWindow<T extends { strike: number }>(rows: readonly T[], spot: number, half: number): T[] {
  if (half >= BOOK_WINDOW) return rows.slice();
  const asc = [...new Set(rows.map(r => r.strike))].sort((a, b) => a - b);
  if (!asc.length) return [];
  let at = asc.findIndex(k => k > spot);
  if (at < 0) at = asc.length;
  /* the strike at or just under spot is the first below; `half` above it and `half` below it */
  const lo = asc[Math.max(0, at - half - 1)];
  const hi = asc[Math.min(asc.length - 1, at + half - 1)];
  return rows.filter(r => r.strike >= lo && r.strike <= hi);
}
