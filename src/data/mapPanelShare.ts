/*
==================================================
  SLAYER TERMINAL - THE MAP'S CUT
  (data/mapPanelShare.ts)

  How much of the Map's box the profile panel takes.
  THE CUT (Noah, 2026-09-06, option C of the "Map
  Section Sources" page): the chart keeps ~58% of
  the box, the size rail and the forced-flow curve
  became ONE profile panel on the other ~42%.
  THE SASH (Noah, 2026-09-12: "the chart width
  should be this default but changeable"): 42% is
  the default, the reader drags the seam between
  the chart and the panel — a share of the box, not
  pixels, so a window resized keeps the cut —
  between 22% and 60%, double-click back to 42%.
  One store, persisted, like the panel's own lane
  split; its own module so the page's skeleton can
  stand in at the same cut without loading the page.
==================================================
*/

import { useSyncExternalStore } from 'react';

const SHARE_KEY = 'slayer_map_panel_share';
export const SHARE_DEFAULT = 0.42;
export const SHARE_MIN = 0.22;
export const SHARE_MAX = 0.6;

let sharePref: number = (() => {
  try {
    const v = Number(localStorage.getItem(SHARE_KEY));
    return Number.isFinite(v) && v >= SHARE_MIN && v <= SHARE_MAX ? v : SHARE_DEFAULT;
  } catch {
    return SHARE_DEFAULT;
  }
})();
const listeners = new Set<() => void>();

export function setPanelShare(v: number): void {
  sharePref = Math.min(SHARE_MAX, Math.max(SHARE_MIN, v));
  try {
    localStorage.setItem(SHARE_KEY, String(sharePref));
  } catch {
    /* storage off — the choice lives for the session */
  }
  listeners.forEach(fn => fn());
}
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
/** The panel's share of the box, as stored (the skeleton reads it once) */
export const readPanelShare = (): number => sharePref;
/** The panel's share of the box, live */
export const usePanelShare = (): number => useSyncExternalStore(subscribe, readPanelShare, () => SHARE_DEFAULT);
/** The share as a CSS width */
export const shareWidth = (share: number): string => `${(share * 100).toFixed(2)}%`;
