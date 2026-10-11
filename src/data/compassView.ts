/*
==================================================
  SLAYER TERMINAL - THE BOARD'S VIEW (data/compassView.ts)

  What the reader had the Compass board set to —
  the filters' address, the layout, the name, the
  selected card — kept across the trip to a
  setup's page and back (the page has its own
  route since 2026-09-11, so the board unmounts;
  Noah's 2026-08-19 rule that coming Back lands on
  the selected card with the rail on its name
  still holds). Session memory, not persisted.
==================================================
*/

import { useSyncExternalStore } from 'react';

export type BoardLayout = 'cards' | 'table';

export interface CompassView {
  /** THE FILTERS ARE THE BOARD'S ADDRESS (2026-10-11): Expiry, Kind and Option type live in /compass?exp=…&kind=…&type=…
      so a link keeps them; this is the last address the board had, so coming back from a setup's page (its Back goes to
      a bare /compass) lands on the same cut */
  boardQuery: string;
  layout: BoardLayout;
  /** null = every name */
  tickerFilter: string | null;
  selectedId: string | null;
  /** THE CONTRACT THE READER IS INSIDE (2026-09-13): the last setup page landed on — the sidebar's
      "Inside the contract" points at it and keeps it across the board and the Tracker until another
      contract takes its place (Noah: "it should stay there until another con takes its place") */
  chosenId: string | null;
}

let view: CompassView = { boardQuery: '', layout: 'cards', tickerFilter: null, selectedId: null, chosenId: null };
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
