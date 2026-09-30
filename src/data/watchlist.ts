/*
==================================================
  SLAYER TERMINAL - THE WATCHLIST'S STORE (data/watchlist.ts)

  The watched contracts, kept on this machine
  (`slayer_watchlist_v1`) until the account's
  storage carries them — the Tracker's pattern, as
  a module store with a subscription so a door on
  any page can add without a provider.

  PRICED BY THE ONE ESTIMATOR every Compass surface
  prices with (data/compass estimatePremium, on the
  chain's own smile — weigherDesk contractIvFor):
  the mark at the add, the mark every tick, the
  close every session, intrinsic at the bell. One
  pricer, never two (the partner's two-pricer
  lesson). When live quotes land, `markOf` is the
  one seam to move.

  RETURNS IN R AS WELL AS DOLLARS: for a bought
  option the premium paid is the whole risk, so
  1R = the cost when added; a doubled contract is
  +1.0R, a contract gone to zero is −1.0R. Dollars
  are ×100 × size.
==================================================
*/

import { useSyncExternalStore } from 'react';
import Simulator from '../core/simulator';
import { isoDate, sessionsBetween, today } from '../core/calendar';
import { now } from '../core/clock';
import { estimatePremium } from './compass';
import { contractIvFor } from './weigherDesk';
import type { OptionRight } from '../types/compass';
import type { WatchRequest, WatchedContract } from '../types/watchlist';

/** v2 (2026-09-14): the store's key moved once so the desk opened on a clean list for the walk (Noah: "refresh my entire watchlist") */
export const WATCHLIST_KEY = 'slayer_watchlist_v2';

/* ---- storage ------------------------------------------------------------------- */

function isValid(w: unknown): w is WatchedContract {
  if (typeof w !== 'object' || w === null) return false;
  const s = w as Record<string, unknown>;
  return (
    typeof s.id === 'string' &&
    typeof s.ticker === 'string' &&
    typeof s.strike === 'number' &&
    (s.right === 'C' || s.right === 'P') &&
    typeof s.expiry === 'string' &&
    typeof s.addedAt === 'number' &&
    typeof s.addedMark === 'number' &&
    typeof s.addedSpot === 'number' &&
    typeof s.size === 'number' &&
    (s.status === 'open' || s.status === 'closed' || s.status === 'expired') &&
    Array.isArray(s.marks)
  );
}

function load(): WatchedContract[] {
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isValid) : [];
  } catch {
    return [];
  }
}

function save(list: WatchedContract[]): void {
  try {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list));
  } catch {
    /* full or unavailable — the page still works for the session */
  }
}

let list: WatchedContract[] = load();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(fn => fn());
const commit = (next: WatchedContract[]) => {
  list = next;
  save(next);
  emit();
};

/* ---- pricing --------------------------------------------------------------------- */

/** Years to the expiry's session, floored at half a session — a listed contract has at least that (the Weigher's floor) */
export function yearsToExpiry(expiry: string, from: Date = today()): number {
  const sessions = sessionsBetween(from, new Date(`${expiry}T12:00:00`));
  return Math.max(sessions, 0.5) / 252;
}

/** The underlying now — the sim's tape; the live feed's seam later */
export function spotOf(ticker: string): number {
  const sym = Simulator.ensureTicker(ticker);
  return Simulator.TICKERS[sym].currentPrice;
}

/** The contract's mark now, by the one estimator */
export function markOf(w: Pick<WatchedContract, 'ticker' | 'strike' | 'right' | 'expiry'>, spot = spotOf(w.ticker)): number {
  const iv = contractIvFor(w.ticker, w.strike, w.right);
  return Number(estimatePremium(spot, w.strike, w.right, iv, yearsToExpiry(w.expiry)).toFixed(2));
}

/** What the contract is worth at the bell — intrinsic, nothing else */
export function intrinsicOf(strike: number, right: OptionRight, spot: number): number {
  return Number(Math.max(0, right === 'C' ? spot - strike : strike - spot).toFixed(2));
}

/** The contract's value at a spot on a date — the what-if's pricer, the same one */
export function valueAt(w: Pick<WatchedContract, 'ticker' | 'strike' | 'right'>, spot: number, tYears: number): number {
  if (tYears <= 0) return intrinsicOf(w.strike, w.right, spot);
  const iv = contractIvFor(w.ticker, w.strike, w.right);
  return Number(estimatePremium(spot, w.strike, w.right, iv, tYears).toFixed(2));
}

/** Risk-neutral odds the contract finishes in the money — N(d2), the chain's own family */
export function itmOddsOf(w: Pick<WatchedContract, 'ticker' | 'strike' | 'right' | 'expiry'>, spot = spotOf(w.ticker)): number {
  const t = yearsToExpiry(w.expiry);
  const iv = contractIvFor(w.ticker, w.strike, w.right);
  const r = 0.05;
  const d1 = (Math.log(spot / w.strike) + (r + (iv * iv) / 2) * t) / (iv * Math.sqrt(t));
  const d2 = d1 - iv * Math.sqrt(t);
  const nd2 = normalCDF(d2);
  return Math.round((w.right === 'C' ? nd2 : 1 - nd2) * 100);
}

/** Abramowitz–Stegun N(x) — the approximation core/greeks and the chain use */
function normalCDF(x: number): number {
  const k = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804 * Math.exp((-x * x) / 2);
  const p = k * (0.31938153 + k * (-0.356563782 + k * (1.781477937 + k * (-1.821255978 + k * 1.330274429))));
  return x >= 0 ? 1 - d * p : d * p;
}

/* ---- the returns ------------------------------------------------------------------ */

export interface WatchReturns {
  /** The mark the row shows: priced live while open, the close once settled */
  mark: number;
  /** Yesterday's close of the mark, or the cost if added today */
  prevClose: number;
  todayDollars: number;
  todayR: number;
  totalDollars: number;
  totalR: number;
  /** The contract's own breakeven — the strike ± the cost */
  breakeven: number;
  /** Spot's distance to the breakeven, signed percent of spot */
  toBreakevenPct: number;
  spot: number;
  /** Sessions left to the expiry; 0 on the day */
  dte: number;
}

export function returnsOf(w: WatchedContract, spot = spotOf(w.ticker)): WatchReturns {
  const open = w.status === 'open';
  const mark = open ? markOf(w, spot) : (w.closedMark ?? w.addedMark);
  const todayKey = isoDate(today());
  const before = [...w.marks].filter(m => m.day < todayKey).sort((a, b) => (a.day < b.day ? 1 : -1))[0];
  const prevClose = before ? before.close : w.addedMark;
  const risk = Math.max(0.01, w.addedMark);
  const per = 100 * w.size;
  const breakeven = Number((w.right === 'C' ? w.strike + w.addedMark : w.strike - w.addedMark).toFixed(2));
  return {
    mark,
    prevClose,
    todayDollars: Number(((mark - prevClose) * per).toFixed(2)),
    todayR: (mark - prevClose) / risk,
    totalDollars: Number(((mark - w.addedMark) * per).toFixed(2)),
    totalR: (mark - w.addedMark) / risk,
    breakeven,
    toBreakevenPct: ((breakeven - spot) / spot) * 100,
    spot,
    dte: sessionsBetween(today(), new Date(`${w.expiry}T12:00:00`)),
  };
}

/** The record — the Tracker's own line: settled · hit · R */
export function recordOf(rows: WatchedContract[]): { settled: number; hit: number; r: number } {
  const done = rows.filter(w => w.status !== 'open');
  let hit = 0;
  let r = 0;
  for (const w of done) {
    const close = w.closedMark ?? w.addedMark;
    const rr = (close - w.addedMark) / Math.max(0.01, w.addedMark);
    if (close > w.addedMark) hit += 1;
    r += rr;
  }
  return { settled: done.length, hit, r };
}

/* ---- the store's doors ------------------------------------------------------------ */

/** Watch a contract — marked at this tick's mark and spot. Returns the row, or the one already watching it. */
export function addToWatchlist(req: WatchRequest): WatchedContract {
  const same = list.find(w => w.status === 'open' && w.ticker === req.ticker && w.strike === req.strike && w.right === req.right && w.expiry === req.expiry);
  if (same) return same;
  const spot = spotOf(req.ticker);
  const at = now().getTime();
  const addedMark = markOf(req, spot);
  const row: WatchedContract = {
    id: `${req.ticker}-${req.strike}-${req.right}-${req.expiry}-${at}`,
    ticker: req.ticker,
    strike: req.strike,
    right: req.right,
    expiry: req.expiry,
    addedAt: at,
    addedMark,
    addedSpot: spot,
    size: Math.max(1, Math.round(req.size ?? 1)),
    status: 'open',
    marks: [{ day: isoDate(today()), close: addedMark }],
  };
  commit([row, ...list]);
  return row;
}

/** Anything open on the list? — the Weigher's list card opens on the watchlist when there is */
export function hasOpenWatched(): boolean {
  return list.some(w => w.status === 'open');
}

/** The open row for this contract, else its latest settled one, else null */
export function watchedFor(req: Pick<WatchRequest, 'ticker' | 'strike' | 'right' | 'expiry'>): WatchedContract | null {
  const same = list.filter(w => w.ticker === req.ticker && w.strike === req.strike && w.right === req.right && w.expiry === req.expiry);
  return same.find(w => w.status === 'open') ?? same.sort((a, b) => b.addedAt - a.addedAt)[0] ?? null;
}

/** Is this contract on the list, open? */
export function isWatching(req: Pick<WatchRequest, 'ticker' | 'strike' | 'right' | 'expiry'>): boolean {
  return list.some(w => w.status === 'open' && w.ticker === req.ticker && w.strike === req.strike && w.right === req.right && w.expiry === req.expiry);
}

/** Close at the mark now — the return locks */
export function closeWatched(id: string): void {
  const w = list.find(x => x.id === id);
  if (!w || w.status !== 'open') return;
  commit(list.map(x => (x.id === id ? { ...x, status: 'closed', closedAt: now().getTime(), closedMark: markOf(x) } : x)));
}

/** Take it off the list altogether — the record forgets it */
export function removeWatched(id: string): void {
  commit(list.filter(x => x.id !== id));
}

export function setWatchedSize(id: string, size: number): void {
  commit(list.map(x => (x.id === id ? { ...x, size: Math.max(1, Math.round(size)) } : x)));
}

export function setWatchedNote(id: string, note: string): void {
  commit(list.map(x => (x.id === id ? { ...x, note: note.trim() || undefined } : x)));
}

/**
 * The tick's housekeeping, called by the page on every render of the tape:
 * today's close on every open row (one entry per session, the last mark of
 * the day), and the bell — a contract past its expiry settles at intrinsic.
 * Writes only when a day rolls or a contract settles; the in-memory close
 * updates every tick and is flushed with the next write or on the way out.
 */
export function tickWatchlist(): void {
  const todayKey = isoDate(today());
  let changed = false;
  let touched = false;
  const next = list.map(w => {
    if (w.status !== 'open') return w;
    const spot = spotOf(w.ticker);
    /* THE BELL: the expiry's session has passed */
    if (w.expiry < todayKey) {
      changed = true;
      return { ...w, status: 'expired' as const, closedAt: now().getTime(), closedMark: intrinsicOf(w.strike, w.right, spot) };
    }
    const mark = markOf(w, spot);
    const last = w.marks[w.marks.length - 1];
    if (!last || last.day !== todayKey) {
      changed = true;
      return { ...w, marks: [...w.marks, { day: todayKey, close: mark }] };
    }
    if (last.close !== mark) {
      touched = true;
      last.close = mark; // in place — today's close moves with the tape, persisted with the next write
    }
    return w;
  });
  if (changed) commit(next);
  else if (touched) emit();
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => save(list));
}

/* ---- the subscription ------------------------------------------------------------- */

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
const snapshot = () => list;

/** The list, live — every page that watches or shows it */
export function useWatchlist(): WatchedContract[] {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
