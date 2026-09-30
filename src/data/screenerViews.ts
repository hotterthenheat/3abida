import { createViewStore, type SavedView } from './savedViews';
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

export type { SavedView };

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
/* The store itself is shared (data/savedViews) — the screener keeps only its
   own key and its own codec. */
export const screenerCuts = createViewStore('slayer_screener_views_v1');
