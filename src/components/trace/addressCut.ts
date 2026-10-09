/*
==================================================
  SLAYER TERMINAL - THE CUT IS THE ADDRESS, ON EVERY
  BOOK PAGE (components/trace/addressCut.ts)

  The Live Tape and the Screener kept their cut in
  the address, so it could be sent, bookmarked and
  saved by name; Footprints, Watchers, Windows and
  Multi-Leg could not (the audit's TR-13). Here the
  address IS the state: each card reads its value
  off the query string (validated — a URL is user
  input) and a pick writes it back, replace never
  push. Only what differs from the page's default is
  written, so an untouched page has a clean address.
  No copy of the cut lives in React state, so the
  back button, a pasted link and a saved cut opened
  all land the same way: the address changes, the
  page reads it.
==================================================
*/

import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/** A card's field: its default, and the values the address may carry (anything else falls back to the default) */
export type CutSpec<K extends string> = Record<K, { def: string; valid: (v: string) => boolean }>;

export interface AddressCut<K extends string> {
  /** Every field's value now — the address's, or the default */
  cut: Record<K, string>;
  /** Write some fields; a field set to its default leaves the address */
  set: (patch: Partial<Record<K, string>>) => void;
  /** The cut as a query string, without the '?' — for Link and Save */
  query: string;
  /** Open a saved cut */
  open: (query: string) => void;
}

export function useAddressCut<K extends string>(spec: CutSpec<K>): AddressCut<K> {
  const [params, setParams] = useSearchParams();
  const keys = Object.keys(spec) as K[];
  const cut = useMemo(() => {
    const out = {} as Record<K, string>;
    for (const k of keys) {
      const raw = params.get(k);
      out[k] = raw !== null && spec[k].valid(raw) ? raw : spec[k].def;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);
  const query = useMemo(() => {
    const p = new URLSearchParams();
    for (const k of keys) if (cut[k] !== spec[k].def) p.set(k, cut[k]);
    return p.toString();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cut]);
  const set = useCallback(
    (patch: Partial<Record<K, string>>) => {
      setParams(
        prev => {
          const next = new URLSearchParams(prev);
          for (const k of Object.keys(patch) as K[]) {
            const v = patch[k];
            if (v === undefined || v === spec[k].def || v === '') next.delete(k);
            else next.set(k, v);
          }
          return next;
        },
        { replace: true }
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setParams]
  );
  const open = useCallback((q: string) => setParams(new URLSearchParams(q), { replace: true }), [setParams]);
  return { cut, set, query, open };
}

/** A field that takes any of a fixed list */
export const oneOf = (list: readonly string[]) => (v: string) => list.includes(v);
/** An expiry, YYYY-MM-DD */
export const isIsoDay = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
/** A search: letters, digits, spaces and dots, as the search field writes it */
export const isQuery = (v: string) => /^[A-Z0-9 .]{1,12}$/.test(v);
