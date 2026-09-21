import { useSyncExternalStore } from 'react';

/*
==================================================
  SLAYER TERMINAL - WATCHLISTS (data/watchlists.ts)

  The names a reader is carrying, in lists they
  named themselves.
==================================================

  THE TERMINAL HAD NO WATCHLIST. It had a four-name constant in the
  simulator that nobody could edit, and a WatchContext that bookmarks Trace
  PRINTS and CONTRACTS — a different unit entirely. A reader following
  twelve names had nowhere to keep them and no way to see them together.

  A LIST IS NAMED AND THERE ARE SEVERAL, because a trader carries more than
  one at a time: the names they hold, the names they are stalking, the
  names reporting this week. One flat list forces those into one column and
  loses the reason each name is there.

  SYMBOLS ARE STORED, NOTHING ELSE. No prices, no levels, no snapshot of
  how a name looked when it was added — those are read live when the row is
  drawn. Persisting a price here would create a second source of truth for
  the one number the whole terminal already agrees on, and it would be
  stale the moment it was written.
*/

export interface Watchlist {
  id: string;
  name: string;
  /** Uppercase symbols, in the reader's own order */
  symbols: string[];
}

interface Stored {
  lists: Watchlist[];
  activeId: string;
}

const KEY = 'slayer_watchlists_v1';

/* The first lists a reader sees are the ones the terminal can actually
   populate — the simulator's seeded roster — rather than an empty box with
   an arrow pointing at it. They are ordinary lists: renameable, editable,
   deletable, with nothing special about them. */
const SEED: Stored = {
  lists: [
    { id: 'core', name: 'Core', symbols: ['SPY', 'QQQ', 'IWM'] },
    { id: 'names', name: 'Names', symbols: ['NVDA', 'AAPL', 'MSFT', 'TSLA', 'AMD', 'META'] },
  ],
  activeId: 'core',
};

const SYMBOL = /^[A-Z][A-Z.:-]{0,11}$/;

function read(): Stored {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return SEED;
    const p = JSON.parse(raw) as Partial<Stored>;
    const lists = Array.isArray(p.lists)
      ? p.lists
          .filter((l): l is Watchlist =>
            !!l && typeof l.id === 'string' && typeof l.name === 'string' && Array.isArray(l.symbols))
          .map(l => ({ id: l.id, name: l.name.slice(0, 32), symbols: l.symbols.filter(s => typeof s === 'string' && SYMBOL.test(s)).slice(0, 100) }))
      : [];
    if (lists.length === 0) return SEED;
    const activeId = lists.some(l => l.id === p.activeId) ? (p.activeId as string) : lists[0].id;
    return { lists, activeId };
  } catch {
    return SEED;
  }
}

let state: Stored = read();
const subs = new Set<() => void>();

function commit(next: Stored): void {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* A blocked store keeps the session's lists and loses them on reload —
       the lists still work, they just stop being remembered. */
  }
  for (const f of subs) f();
}

const subscribe = (f: () => void) => {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
};

/* TWO TABS WERE DESTROYING EACH OTHER'S WORK. The store reads localStorage
   once at module load and writes the WHOLE object on every change, so a
   second tab held a stale copy: add a name in tab A, add another in tab B,
   and B's write silently erased A's. The reader saw a symbol they had just
   added simply not be there after a refresh, with nothing said.

   The `storage` event fires in every OTHER tab of the origin when one of
   them writes, which is exactly the signal needed: re-read and tell the
   subscribers. It never fires in the tab that did the writing, so there is
   no loop, and the whole fix is to stop treating a shared store as if this
   tab were the only one holding it. */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', e => {
    if (e.key !== null && e.key !== KEY) return;
    state = read();
    for (const f of subs) f();
  });
}

export const getWatchlists = (): Stored => state;
export const useWatchlists = (): Stored => useSyncExternalStore(subscribe, getWatchlists, getWatchlists);

export const activeList = (): Watchlist =>
  state.lists.find(l => l.id === state.activeId) ?? state.lists[0];

export function setActiveList(id: string): void {
  if (!state.lists.some(l => l.id === id)) return;
  commit({ ...state, activeId: id });
}

let seq = 0;
const freshId = () => `wl-${Date.now().toString(36)}-${++seq}`;

/** The cleaned name, or null when it is empty. */
const cleanName = (name: string): string | null => {
  const n = name.trim().slice(0, 32);
  return n.length > 0 ? n : null;
};

/**
 * Is this name already taken, ignoring one list (the one being renamed)?
 *
 * A LIST IS PICKED BY ITS NAME. The strip, the dropdown and every "add to a
 * list" menu in the terminal show nothing but it, so two lists called
 * "Swing" are two identical rows a reader has to pick between by guessing —
 * and the one they meant is decided by which the store happened to order
 * first. Case does not count, because a strip showing "Swing" and "swing"
 * is the same problem with an extra insult.
 */
export const listNameTaken = (name: string, exceptId?: string): boolean => {
  const n = cleanName(name)?.toLowerCase();
  if (n == null) return false;
  return state.lists.some(l => l.id !== exceptId && l.name.toLowerCase() === n);
};

/** The new list's id, or null when the name is empty or already in use. */
export function createList(name: string): string | null {
  const n = cleanName(name);
  if (n == null || listNameTaken(n)) return null;
  const id = freshId();
  commit({ lists: [...state.lists, { id, name: n, symbols: [] }], activeId: id });
  return id;
}

/** False when the name is empty, unchanged or already in use. */
export function renameList(id: string, name: string): boolean {
  const n = cleanName(name);
  if (n == null || listNameTaken(n, id)) return false;
  commit({ ...state, lists: state.lists.map(l => (l.id === id ? { ...l, name: n } : l)) });
  return true;
}

/** The last list cannot be removed — a reader with none has no way back. */
export function removeList(id: string): boolean {
  if (state.lists.length <= 1) return false;
  const lists = state.lists.filter(l => l.id !== id);
  commit({ lists, activeId: state.activeId === id ? lists[0].id : state.activeId });
  return true;
}

/** Returns false when the symbol is malformed or already on the list. */
export function addSymbol(listId: string, symbol: string): boolean {
  const s = symbol.trim().toUpperCase();
  if (!SYMBOL.test(s)) return false;
  const list = state.lists.find(l => l.id === listId);
  if (!list || list.symbols.includes(s) || list.symbols.length >= 100) return false;
  commit({ ...state, lists: state.lists.map(l => (l.id === listId ? { ...l, symbols: [...l.symbols, s] } : l)) });
  return true;
}

export function removeSymbol(listId: string, symbol: string): void {
  commit({
    ...state,
    lists: state.lists.map(l => (l.id === listId ? { ...l, symbols: l.symbols.filter(s => s !== symbol) } : l)),
  });
}

/** Move a symbol within its list — the reader's order is the list's order. */
export function moveSymbol(listId: string, symbol: string, delta: number): void {
  const list = state.lists.find(l => l.id === listId);
  if (!list) return;
  const i = list.symbols.indexOf(symbol);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= list.symbols.length) return;
  const symbols = [...list.symbols];
  [symbols[i], symbols[j]] = [symbols[j], symbols[i]];
  commit({ ...state, lists: state.lists.map(l => (l.id === listId ? { ...l, symbols } : l)) });
}

/** Every list holding a name — the "on 2 lists" badge, and the star's state. */
export function listsWith(symbol: string): Watchlist[] {
  const s = symbol.toUpperCase();
  return state.lists.filter(l => l.symbols.includes(s));
}

export function resetWatchlists(): void {
  commit(SEED);
}
