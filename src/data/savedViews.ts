import { useSyncExternalStore } from 'react';

/*
==================================================
  SLAYER TERMINAL - SAVED CUTS (data/savedViews.ts)

  One store, any surface.
==================================================

  THE FILTER IS THE ADDRESS. A screen the reader has tuned — the side, the
  tenors, the floors, the order, the expiry — lived in one localStorage key
  per page, which meant it could not be shared, could not be bookmarked,
  could not be opened twice side by side, and could not be described to
  anyone except by listing the controls out loud. Putting it in the query
  string fixes all four at once, and it is the cheapest possible fix: the URL
  bar is a share sheet every browser already ships.

  The screener learned that first and kept the machinery to itself, so the
  tape — the surface a trader most wants to hand someone ("look at this cut
  right now") — had no way to save or send a thing. The store is a FACTORY
  now: a key in, a little store out, and any surface that can express its
  cut as a query string gets saved cuts for four lines.
*/

export interface SavedView {
  id: string;
  name: string;
  /** The query string, without the leading '?' */
  query: string;
  at: number;
}

/** The most cuts one surface keeps — old ones fall off the end. */
const LIMIT = 24;

export interface ViewStore {
  useViews: () => SavedView[];
  getViews: () => SavedView[];
  /** Saving the same name twice replaces it rather than growing a duplicate. */
  saveView: (name: string, query: string) => SavedView | null;
  removeView: (id: string) => void;
}

let seq = 0;

export function createViewStore(storageKey: string): ViewStore {
  const read = (): SavedView[] => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return [];
      const p = JSON.parse(raw) as unknown;
      if (!Array.isArray(p)) return [];
      return p
        .filter((v): v is SavedView => !!v && typeof v.id === 'string' && typeof v.name === 'string' && typeof v.query === 'string')
        .map(v => ({ id: v.id, name: v.name.slice(0, 40), query: v.query.slice(0, 400), at: Number(v.at) || 0 }))
        .slice(0, LIMIT);
    } catch {
      return [];
    }
  };

  let views = read();
  const subs = new Set<() => void>();

  const commit = (next: SavedView[]): void => {
    views = next;
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* A blocked store keeps the session's cuts and forgets them on reload. */
    }
    for (const f of subs) f();
  };

  const subscribe = (f: () => void) => {
    subs.add(f);
    return () => {
      subs.delete(f);
    };
  };

  const getViews = () => views;

  return {
    getViews,
    useViews: () => useSyncExternalStore(subscribe, getViews, getViews),
    saveView(name, query) {
      const n = name.trim().slice(0, 40);
      if (!n) return null;
      const v: SavedView = { id: `v-${Date.now().toString(36)}-${++seq}`, name: n, query, at: Date.now() };
      commit([v, ...views.filter(x => x.name.toLowerCase() !== n.toLowerCase())].slice(0, LIMIT));
      return v;
    },
    removeView(id) {
      commit(views.filter(v => v.id !== id));
    },
  };
}
