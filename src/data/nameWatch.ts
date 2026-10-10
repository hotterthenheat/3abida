/*
==================================================
  SLAYER TERMINAL - ONE WATCHLIST OF NAMES (data/nameWatch.ts)

  The ideas report's "one watchlist of names" (2026-10-10):
  the shell keeps one list of NAMES — never contracts —
  in sections the reader names, a name flagged or not.
  The contract lists stay what they are (the Weigher's
  watched contracts, Trace's bookmarks, Compass's
  Tracker); a name's row links to them.

  Kept on this machine (slayer_watch_names); the drawer
  (components/layout/WatchlistDrawer.tsx) reads it, the
  rail's Watchlist door opens it, and `watchName` is the
  one action the command line calls ("watch NVDA").
==================================================
*/

import { useSyncExternalStore } from 'react';

export const NAME_WATCH_KEY = 'slayer_watch_names';
/** A list a reader can still read at a glance */
export const MAX_NAMES = 60;
export const MAX_SECTIONS = 8;

export interface WatchedName {
  symbol: string;
  flagged: boolean;
  addedAt: number;
}
export interface WatchSection {
  id: string;
  name: string;
  names: WatchedName[];
}
export interface NameWatch {
  sections: WatchSection[];
}

const FIRST: NameWatch = { sections: [{ id: 'names', name: 'Names', names: [] }] };

const clean = (raw: unknown): NameWatch => {
  const r = raw as Partial<NameWatch> | null;
  if (!r || !Array.isArray(r.sections) || r.sections.length === 0) return FIRST;
  const seen = new Set<string>();
  const sections: WatchSection[] = [];
  for (const s of r.sections.slice(0, MAX_SECTIONS)) {
    if (!s || typeof s.id !== 'string' || typeof s.name !== 'string' || !Array.isArray(s.names)) continue;
    const names: WatchedName[] = [];
    for (const n of s.names) {
      if (!n || typeof n.symbol !== 'string') continue;
      const symbol = n.symbol.toUpperCase();
      if (!/^[A-Z][A-Z0-9.^-]{0,9}$/.test(symbol) || seen.has(symbol)) continue;
      seen.add(symbol);
      names.push({ symbol, flagged: n.flagged === true, addedAt: typeof n.addedAt === 'number' ? n.addedAt : Date.now() });
    }
    sections.push({ id: s.id, name: s.name.slice(0, 32) || 'Names', names });
  }
  return sections.length ? { sections } : FIRST;
};

const load = (): NameWatch => {
  try {
    const raw = localStorage.getItem(NAME_WATCH_KEY);
    return raw ? clean(JSON.parse(raw)) : FIRST;
  } catch {
    return FIRST;
  }
};

let state: NameWatch = load();
const subs = new Set<() => void>();
const commit = (next: NameWatch): void => {
  state = next;
  try {
    localStorage.setItem(NAME_WATCH_KEY, JSON.stringify(next));
  } catch {
    /* storage blocked — the list lives for the visit */
  }
  subs.forEach(fn => fn());
};
/* another tab's change lands here too */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', e => {
    if (e.key !== NAME_WATCH_KEY) return;
    state = load();
    subs.forEach(fn => fn());
  });
}

const subscribe = (fn: () => void) => {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
};
const get = () => state;
export const useNameWatch = (): NameWatch => useSyncExternalStore(subscribe, get, get);
export const getNameWatch = (): NameWatch => state;

const count = (w: NameWatch) => w.sections.reduce((n, s) => n + s.names.length, 0);
export const isWatchedName = (symbol: string, w: NameWatch = state): boolean => w.sections.some(s => s.names.some(n => n.symbol === symbol.toUpperCase()));
/** The section a name stands in, or null */
export const sectionOf = (symbol: string, w: NameWatch = state): WatchSection | null => w.sections.find(s => s.names.some(n => n.symbol === symbol.toUpperCase())) ?? null;

export type WatchResult = 'added' | 'already' | 'full' | 'invalid';

/**
 * Put a name on the list — THE ACTION the command line calls ("watch NVDA"). Into `sectionId` when given, else the
 * first section. A name already on the list stays where it is.
 */
export function watchName(symbol: string, sectionId?: string): WatchResult {
  const sym = symbol.trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9.^-]{0,9}$/.test(sym)) return 'invalid';
  if (isWatchedName(sym)) return 'already';
  if (count(state) >= MAX_NAMES) return 'full';
  const into = state.sections.find(s => s.id === sectionId) ?? state.sections[0];
  commit({ sections: state.sections.map(s => (s === into ? { ...s, names: [...s.names, { symbol: sym, flagged: false, addedAt: Date.now() }] } : s)) });
  return 'added';
}

/** Take a name off — returns what the undo puts back (its section and place) */
export function unwatchName(symbol: string): { sectionId: string; index: number; name: WatchedName } | null {
  const sym = symbol.toUpperCase();
  for (const s of state.sections) {
    const index = s.names.findIndex(n => n.symbol === sym);
    if (index < 0) continue;
    const name = s.names[index];
    commit({ sections: state.sections.map(x => (x === s ? { ...x, names: x.names.filter(n => n.symbol !== sym) } : x)) });
    return { sectionId: s.id, index, name };
  }
  return null;
}

/** Put a name back where it stood — the undo of an unwatch */
export function restoreName(back: { sectionId: string; index: number; name: WatchedName }): void {
  if (isWatchedName(back.name.symbol)) return;
  const into = state.sections.find(s => s.id === back.sectionId) ?? state.sections[0];
  commit({
    sections: state.sections.map(s => {
      if (s !== into) return s;
      const names = [...s.names];
      names.splice(Math.min(back.index, names.length), 0, back.name);
      return { ...s, names };
    }),
  });
}

export function setNameFlag(symbol: string, flagged: boolean): void {
  const sym = symbol.toUpperCase();
  commit({ sections: state.sections.map(s => ({ ...s, names: s.names.map(n => (n.symbol === sym ? { ...n, flagged } : n)) })) });
}

/** Move a name to another section, at its end */
export function moveName(symbol: string, sectionId: string): void {
  const sym = symbol.toUpperCase();
  const from = sectionOf(sym);
  const to = state.sections.find(s => s.id === sectionId);
  if (!from || !to || from === to) return;
  const name = from.names.find(n => n.symbol === sym)!;
  commit({
    sections: state.sections.map(s => (s === from ? { ...s, names: s.names.filter(n => n.symbol !== sym) } : s === to ? { ...s, names: [...s.names, name] } : s)),
  });
}

/** A name one step up or down inside its section — the keys' move */
export function nudgeName(symbol: string, by: -1 | 1): void {
  const sym = symbol.toUpperCase();
  const s = sectionOf(sym);
  if (!s) return;
  const i = s.names.findIndex(n => n.symbol === sym);
  const j = i + by;
  if (j < 0 || j >= s.names.length) return;
  const names = [...s.names];
  [names[i], names[j]] = [names[j], names[i]];
  commit({ sections: state.sections.map(x => (x === s ? { ...x, names } : x)) });
}

export function addSection(name: string): string | null {
  if (state.sections.length >= MAX_SECTIONS) return null;
  const words = name.trim().slice(0, 32) || `Section ${state.sections.length + 1}`;
  const id = `s${Date.now().toString(36)}`;
  commit({ sections: [...state.sections, { id, name: words, names: [] }] });
  return id;
}

export function renameSection(id: string, name: string): void {
  const words = name.trim().slice(0, 32);
  if (!words) return;
  commit({ sections: state.sections.map(s => (s.id === id ? { ...s, name: words } : s)) });
}

/** Take a section off — its names go too; returns what the undo puts back. The last section stays. */
export function removeSection(id: string): { section: WatchSection; index: number } | null {
  if (state.sections.length <= 1) return null;
  const index = state.sections.findIndex(s => s.id === id);
  if (index < 0) return null;
  const section = state.sections[index];
  commit({ sections: state.sections.filter(s => s.id !== id) });
  return { section, index };
}

export function restoreSection(back: { section: WatchSection; index: number }): void {
  if (state.sections.some(s => s.id === back.section.id)) return;
  const taken = new Set(state.sections.flatMap(s => s.names.map(n => n.symbol)));
  const section = { ...back.section, names: back.section.names.filter(n => !taken.has(n.symbol)) };
  const sections = [...state.sections];
  sections.splice(Math.min(back.index, sections.length), 0, section);
  commit({ sections });
}

/* ---- the drawer, open or shut (the alerts drawer's grammar, data/alertsDrawer.ts) ------------------------------------ */

let open = false;
const openSubs = new Set<() => void>();
const notifyOpen = () => openSubs.forEach(fn => fn());
export const openWatchlist = (): void => {
  if (open) return;
  open = true;
  notifyOpen();
};
export const closeWatchlist = (): void => {
  if (!open) return;
  open = false;
  notifyOpen();
};
export const toggleWatchlist = (): void => (open ? closeWatchlist() : openWatchlist());
const subscribeOpen = (fn: () => void) => {
  openSubs.add(fn);
  return () => {
    openSubs.delete(fn);
  };
};
const getOpen = () => open;
export const useWatchlistOpen = (): boolean => useSyncExternalStore(subscribeOpen, getOpen, getOpen);
