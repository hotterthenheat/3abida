/*
==================================================
  SLAYER TERMINAL - REVIEW · THE SESSIONS' STORE
  (data/review/store.ts)

  The reader's backtest sessions, kept on this machine
  (`slayer_review_v1`) until the account's storage
  carries them — the watchlist's pattern: a module
  store with a subscription, so the desk, the list,
  the report and the journal all read one thing.
  Every change goes through the engine's pure
  functions; this file only holds and saves.

  TWO KINDS OF SESSION, ONE LIST (2026-09-20): an
  options session (engine.ts) and a futures one
  (futuresEngine.ts, `kind: 'futures'`). They share
  what the list needs — a name, its names, a clock,
  its start — and nothing of how they trade, so every
  change below asks the session what kind it is and
  hands it to its own engine.
==================================================
*/

import { useSyncExternalStore } from 'react';
import { advance, amend, attach, cancel, newSession, place, rebase, setBreakeven, setTrail, type Draft, type Moment, type Session, type SessionRules } from './engine';
import { futAdvance, futAmend, futAttach, futBookOf, futCancel, futPlace, futSetBreakeven, futSetTrail, newFutSession, type FutDraft, type FutSession } from './futuresEngine';
import type { DayNote, JournalEntry } from './journal';
import { contractKey, type ContractId } from './quotes';

export type AnySession = Session | FutSession;
export const isFutures = (s: AnySession | null | undefined): s is FutSession => !!s && (s as FutSession).kind === 'futures';

export const REVIEW_KEY = 'slayer_review_v1';

const isSession = (v: unknown): v is AnySession => {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>;
  return typeof s.id === 'string' && typeof s.ticker === 'string' && typeof s.startCash === 'number' && Array.isArray(s.orders) && Array.isArray(s.fills) && typeof s.cursor === 'object' && s.cursor !== null;
};
function load(): AnySession[] {
  try {
    const raw = localStorage.getItem(REVIEW_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isSession) : [];
  } catch {
    return [];
  }
}
let list: AnySession[] = typeof localStorage === 'undefined' ? [] : load();
const listeners = new Set<() => void>();
let saveTimer: number | undefined;
const save = () => {
  try {
    localStorage.setItem(REVIEW_KEY, JSON.stringify(list));
  } catch {
    /* full or unavailable — the session still runs for the visit */
  }
};
/** The clock ticks four times a second while a session plays: the write is held a moment, the screen is not */
const commit = (next: AnySession[], now = false) => {
  list = next;
  listeners.forEach(fn => fn());
  window.clearTimeout(saveTimer);
  if (now) save();
  else saveTimer = window.setTimeout(save, 600);
};
if (typeof window !== 'undefined') window.addEventListener('beforeunload', save);

/** A change to an OPTIONS session (a futures one of that id is left as it is) */
const swap = (id: string, fn: (s: Session) => Session, now = false) => commit(list.map(s => (s.id === id && !isFutures(s) ? fn(s) : s)), now);
/** …and to a FUTURES one */
const swapFut = (id: string, fn: (s: FutSession) => FutSession, now = false) => commit(list.map(s => (s.id === id && isFutures(s) ? fn(s) : s)), now);
const newId = (now: number) => `s${now.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;

/** `tickers`: one name or two. `rules`: the reader's own, set here and never after — a rule that can be loosened in the
    middle of a losing day is not a rule. */
export function createSession(o: { name: string; ticker: string; tickers?: string[]; rules?: SessionRules; startCash: number; fee: number; startDay: string }): Session {
  const now = Date.now();
  const s = newSession({ ...o, id: newId(now), now });
  commit([s, ...list], true);
  return s;
}
/** A futures session: one product or two, the same rules card, margin instead of cash (futuresEngine.ts) */
export function createFutSession(o: { name: string; tickers: string[]; rules?: SessionRules; startCash: number; fee: number | null; startDay: string }): FutSession {
  const now = Date.now();
  const s = newFutSession({ ...o, id: newId(now), now });
  commit([s, ...list], true);
  return s;
}
/** RUN IT AGAIN: a new session on the same set-up — the names, the money, the fee, the start day, the reader's rules —
    with a fresh book and the clock back at that day's open. What a second try at a day is; not a copy of the first
    try's trades. "SPY from Jun 22" → "SPY from Jun 22 · run 2" → "· run 3". */
export function runAgain(id: string): AnySession | null {
  const from = list.find(s => s.id === id);
  if (!from) return null;
  const stem = from.name.replace(/ · run \d+$/, '');
  const runs = list.filter(s => s.name === stem || s.name.startsWith(`${stem} · run `)).length;
  if (isFutures(from)) return createFutSession({ name: `${stem} · run ${runs + 1}`, tickers: from.tickers, rules: from.rules, startCash: from.startCash, fee: from.fee, startDay: from.startDay });
  return createSession({ name: `${stem} · run ${runs + 1}`, ticker: from.ticker, tickers: from.tickers, rules: from.rules, startCash: from.startCash, fee: from.fee, startDay: from.startDay });
}
export const deleteSession = (id: string) => commit(list.filter(s => s.id !== id), true);
export const renameSession = (id: string, name: string) => commit(list.map(s => (s.id === id ? { ...s, name: name.trim() || s.name } : s)), true);
export const moveClock = (id: string, to: Moment) => swap(id, s => advance(s, to, Date.now()));
/* ---- a futures session's changes ---- */
export const moveFutClock = (id: string, to: Moment) => swapFut(id, s => futAdvance(s, to, Date.now()));
export const placeFutOrder = (id: string, d: FutDraft) => swapFut(id, s => futPlace(s, d, Date.now()), true);
export const cancelFutOrder = (id: string, orderId: string) => swapFut(id, s => futCancel(s, orderId, Date.now()), true);
export const amendFutOrder = (id: string, orderId: string, price: number) => swapFut(id, s => futAmend(s, orderId, price, Date.now()), true);
export const attachFutBracket = (id: string, symbol: string, kind: 'target' | 'stop', price: number) => swapFut(id, s => futAttach(s, symbol, kind, price, Date.now()), true);
/** Flat, now: whatever is working to take it out goes first, then the lot goes at the market */
export const closeFutPosition = (id: string, symbol: string) =>
  swapFut(
    id,
    s => {
      const pos = futBookOf(s).positions.find(p => p.symbol === symbol);
      if (!pos) return s;
      let next = s;
      for (const o of s.orders) if (o.status === 'working' && o.exit && o.symbol === symbol) next = futCancel(next, o.id, Date.now());
      return futPlace(next, { symbol, side: pos.long ? 'sell' : 'buy', qty: pos.qty, kind: 'market' }, Date.now());
    },
    true
  );
export const placeOrder = (id: string, d: Draft) => swap(id, s => place(s, d, Date.now()), true);
export const cancelOrder = (id: string, orderId: string) => swap(id, s => cancel(s, orderId, Date.now()), true);
export const attachBracket = (id: string, contract: ContractId, kind: 'target' | 'stop', price: number, on?: 'name') => swap(id, s => attach(s, contract, kind, price, Date.now(), on), true);
/** The same way out, waiting on the other thing — the name's price, or the contract's (engine `rebase`) */
export const rebaseOrder = (id: string, orderId: string, to: 'name' | 'contract') => swap(id, s => rebase(s, orderId, to, Date.now()), true);
export const amendOrder = (id: string, orderId: string, price: number) => swap(id, s => amend(s, orderId, price, Date.now()), true);
/** A working stop's two switches (the ladder — engine.ts): trailing is that stop's, breakeven is its whole group's */
export const trailOrder = (id: string, orderId: string, on: boolean, by?: number) => swap(id, s => setTrail(s, orderId, on, Date.now(), by), true);
export const breakevenOrder = (id: string, orderId: string, on: boolean) => swap(id, s => setBreakeven(s, orderId, on, Date.now()), true);
export const trailFutOrder = (id: string, orderId: string, on: boolean, by?: number) => swapFut(id, s => futSetTrail(s, orderId, on, Date.now(), by), true);
export const breakevenFutOrder = (id: string, orderId: string, on: boolean) => swapFut(id, s => futSetBreakeven(s, orderId, on, Date.now()), true);
/** Out of a contract now: whatever is working on it goes first, then the lot is sold at the bid */
export const closePosition = (id: string, contract: ContractId, qty: number) =>
  swap(
    id,
    s => {
      const key = contractKey(contract);
      let next = s;
      for (const o of s.orders) if (o.status === 'working' && o.side === 'sell' && contractKey(o.contract) === key) next = cancel(next, o.id, Date.now());
      return place(next, { contract, side: 'sell', qty, kind: 'market' }, Date.now());
    },
    true
  );
export const setNote = (id: string, tradeId: string, note: string) => commit(list.map(s => (s.id === id ? { ...s, notes: { ...s.notes, [tradeId]: note } } : s)), true);
/** The journal's entry on a closed trade — what is given is written over what was there; an answer emptied is kept empty,
    so the first journal's one note does not come back as the first answer */
export const setEntry = (id: string, tradeId: string, patch: Partial<JournalEntry>) =>
  commit(list.map(s => (s.id === id ? { ...s, journal: { ...s.journal, [tradeId]: { ...s.journal?.[tradeId], ...patch } } } : s)), true);
/** A note on one of a session's replayed days: the plan before, the review after */
export const setDayNote = (id: string, day: string, patch: Partial<DayNote>) =>
  commit(list.map(s => (s.id === id ? { ...s, days: { ...s.days, [day]: { ...s.days?.[day], ...patch } } } : s)), true);

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const snapshot = () => list;
/** Every session of both kinds, newest first */
export const useSessions = (): AnySession[] => useSyncExternalStore(subscribe, snapshot, snapshot);
/** Any session by its id — what a page asks first, to know which desk or report it is */
export const useAnySession = (id: string | undefined): AnySession | null => useSessions().find(s => s.id === id) ?? null;
/** An OPTIONS session (null for a futures one: its desk is FuturesDesk) */
export const useSession = (id: string | undefined): Session | null => {
  const s = useAnySession(id);
  return s && !isFutures(s) ? s : null;
};
export const useFutSession = (id: string | undefined): FutSession | null => {
  const s = useAnySession(id);
  return isFutures(s) ? s : null;
};
