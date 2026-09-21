import { useSyncExternalStore } from 'react';
import { DEFAULT_FILTERS, type BookFilters } from './flowBook';
import type { SleeveKey } from '../types/compass';

/*
==================================================
  SLAYER TERMINAL - SCREENER VIEWS
  (data/screenerViews.ts)

  A filter you can send someone.
==================================================

  THE FILTER IS THE ADDRESS. A screen the reader has tuned — the side, the
  tenors, the floors, whether in-the-money is excluded — lived in one
  localStorage key, which meant it could not be shared, could not be
  bookmarked, could not be opened twice side by side, and could not be
  described to anyone except by listing the controls out loud.

  Putting it in the query string fixes all four at once, and it is the
  cheapest possible fix: the URL bar is a share sheet that every browser
  already ships.

  THE URL WINS OVER THE STORED FILTER, always. A link someone was SENT is a
  more specific instruction than what that reader happened to be looking at
  last; opening it and getting your own old screen instead would make links
  useless. When there is no query, the stored filter is the fallback.

  ONLY WHAT DIFFERS IS WRITTEN. A default-valued filter leaves no parameter
  behind, so an untouched screener has a clean URL and a shared one carries
  exactly the decisions that were made — which also makes the link readable,
  and a readable link is one a reader will trust enough to click.
*/

export interface SavedView {
  id: string;
  name: string;
  /** The query string, without the leading '?' */
  query: string;
  at: number;
}

const KEY = 'slayer_screener_views_v1';

// ---- the codec ------------------------------------------------------------

const SIDES = new Set(['ALL', 'C', 'P']);

/** Only the fields that differ from the default are written. */
export function filtersToParams(f: BookFilters, screen?: string, query?: string): URLSearchParams {
  const p = new URLSearchParams();
  if (screen) p.set('screen', screen);
  if (query) p.set('q', query);
  if (f.side !== DEFAULT_FILTERS.side) p.set('side', f.side);
  if (f.tenors.length) p.set('tenors', f.tenors.join(','));
  if (f.minVolume > 0) p.set('vol', String(f.minVolume));
  if (f.minPremium > 0) p.set('prem', String(f.minPremium));
  if (f.excludeItm) p.set('otm', '1');
  return p;
}

/**
 * Read a filter out of a query string.
 *
 * Every field is validated rather than trusted: a URL is user input, and
 * anyone can type one. A malformed value falls back to its default instead
 * of poisoning the screen — `vol=abc` filters nothing rather than filtering
 * everything away and leaving a reader staring at an empty table.
 */
export function paramsToFilters(p: URLSearchParams, validTenors: readonly string[]): {
  filters: BookFilters;
  screen: string | null;
  query: string;
  any: boolean;
} {
  const num = (v: string | null): number => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  const rawSide = p.get('side');
  const rawTenors = (p.get('tenors') ?? '').split(',').filter(t => validTenors.includes(t));
  const filters: BookFilters = {
    side: rawSide && SIDES.has(rawSide) ? (rawSide as BookFilters['side']) : DEFAULT_FILTERS.side,
    tenors: rawTenors as SleeveKey[],
    minVolume: num(p.get('vol')),
    minPremium: num(p.get('prem')),
    excludeItm: p.get('otm') === '1',
  };
  const any = ['side', 'tenors', 'vol', 'prem', 'otm', 'screen', 'q'].some(k => p.has(k));
  return { filters, screen: p.get('screen'), query: p.get('q') ?? '', any };
}

// ---- the saved views ------------------------------------------------------

function read(): SavedView[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const p = JSON.parse(raw) as unknown;
    if (!Array.isArray(p)) return [];
    return p
      .filter((v): v is SavedView =>
        !!v && typeof v.id === 'string' && typeof v.name === 'string' && typeof v.query === 'string')
      .map(v => ({ id: v.id, name: v.name.slice(0, 40), query: v.query.slice(0, 400), at: Number(v.at) || 0 }))
      .slice(0, 24);
  } catch {
    return [];
  }
}

let views: SavedView[] = read();
const subs = new Set<() => void>();

function commit(next: SavedView[]): void {
  views = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* A blocked store keeps the session's views and forgets them on reload. */
  }
  for (const f of subs) f();
}

const subscribe = (f: () => void) => {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
};

export const getViews = (): SavedView[] => views;
export const useViews = (): SavedView[] => useSyncExternalStore(subscribe, getViews, getViews);

let seq = 0;

/** Saving the same name twice replaces it rather than growing a duplicate. */
export function saveView(name: string, query: string): SavedView | null {
  const n = name.trim().slice(0, 40);
  if (!n) return null;
  const v: SavedView = { id: `v-${Date.now().toString(36)}-${++seq}`, name: n, query, at: Date.now() };
  const rest = views.filter(x => x.name.toLowerCase() !== n.toLowerCase());
  commit([v, ...rest].slice(0, 24));
  return v;
}

export function removeView(id: string): void {
  commit(views.filter(v => v.id !== id));
}
