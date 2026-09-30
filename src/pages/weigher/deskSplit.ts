/*
==================================================
  SLAYER TERMINAL - THE DESK'S SASH (pages/weigher/deskSplit.ts)

  The Weigher's frame is two rows — the chart and
  the chain in a WINDOW on top, the watchlist and
  the position growing under it, the page
  scrolling (2026-09-14). The window's height is
  the reader's (Noah: "build it with the sash"):
  dragged on a sash in the gap under it,
  double-click resets, kept in this browser, in
  pixels. Read by the desk AND its skeleton, so
  the stand-in lands on the same height.
==================================================
*/

const KEY = 'slayer_weigher_top';
export const DESK_TOP_DEFAULT = 560;
export const DESK_TOP_MIN = 320;
export const DESK_TOP_MAX = 1200;

export const clampDeskTop = (v: number): number => Math.round(Math.min(DESK_TOP_MAX, Math.max(DESK_TOP_MIN, v)));

export function readDeskTop(): number {
  try {
    const v = Number(localStorage.getItem(KEY));
    return Number.isFinite(v) && v >= DESK_TOP_MIN && v <= DESK_TOP_MAX ? Math.round(v) : DESK_TOP_DEFAULT;
  } catch {
    return DESK_TOP_DEFAULT;
  }
}

export function saveDeskTop(v: number): void {
  try {
    localStorage.setItem(KEY, String(clampDeskTop(v)));
  } catch {
    /* storage off — the height lives for the session */
  }
}

/** The frame's two rows: the window at its height, the bottom row as tall as its cards */
export const deskRows = (top: number): string => `${top}px auto`;
