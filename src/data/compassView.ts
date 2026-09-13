/*
==================================================
  SLAYER TERMINAL - THE BOARD'S VIEW (data/compassView.ts)

  What the reader had the Compass board set to —
  the tenor, the kind, the layout, the name, the
  selected card — kept across the trip to a
  setup's page and back (the page has its own
  route since 2026-09-11, so the board unmounts;
  Noah's 2026-08-19 rule that coming Back lands on
  the selected card with the rail on its name
  still holds). Session memory, not persisted.
==================================================
*/

import { useSyncExternalStore } from 'react';
import type { ScannerKey, SleeveKey } from '../types/compass';

export type BoardLayout = 'cards' | 'table';

export interface CompassView {
  sleeve: SleeveKey;
  /** The listed expiry the board is set to, YYYY-MM-DD (the calendar walk,
      2026-09-12); null = the sleeve's canonical date. The sleeve is DERIVED
      from it (sleeveForDte) and kept beside it for the kinds' eligibility. */
  expiry: string | null;
  scanner: ScannerKey;
  layout: BoardLayout;
  /** null = every name */
  tickerFilter: string | null;
  selectedId: string | null;
  /** A contract the reader actually CHOSE — clicked or opened — as opposed to
      the #1 the rail falls back to. The sidebar's "Inside the contract" page
      exists only once this is set (Noah, 2026-09-12: "logically you can't be
      inside the con if you haven't picked it"). */
  chosenId: string | null;
}

let view: CompassView = { sleeve: 'odte', expiry: null, scanner: 'top-setups', layout: 'cards', tickerFilter: null, selectedId: null, chosenId: null };
const subs = new Set<() => void>();

export const setCompassView = (patch: Partial<CompassView>): void => {
  view = { ...view, ...patch };
  subs.forEach(fn => fn());
};

const subscribe = (fn: () => void) => {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
};
const get = () => view;

export const useCompassView = (): CompassView => useSyncExternalStore(subscribe, get, get);
