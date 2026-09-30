/*
==================================================
  SLAYER TERMINAL - WHICH VIEW A BOOK OPENS ON
  (components/gex/ledgerView.ts)

  The book by strike and expiry has three views: the
  CALENDAR (every cell a capsule), the LADDER (one
  row per strike, a bar a greek) and the MATRIX (one
  row per strike, the five greeks split put · call ·
  net, a figure and its bar in every cell — the
  August table, back at Noah's word 2026-09-28). It
  stands in two places, and they open differently:

    the MAP        opens on the MATRIX (2026-09-28;
                   the ladder is off the Map's list —
                   "delete the first part … that
                   showcases our current ladder")
    the PULSE tile opens on the CALENDAR — it is the
                   Exposure Ledger, and the Strike
                   Pressure Ladder is the tile beside
                   it; two ladders would be one tile
                   said twice

  Each remembers the reader's own pick after that, in
  its OWN key. They shared one key until this change,
  which is why the Map needed a new one: every reader
  who had ever looked at the calendar would otherwise
  still have opened on it.

  A tile that opens the Map "on what the tile showed"
  (workspace/registry.tsx) writes the MAP's key.

  Kept apart from ExposureField so the Map's skeleton
  can ask which shape to stand in as without pulling
  the field's code in with it.
==================================================
*/

export type LedgerView = 'calendar' | 'ladder' | 'matrix';
export type LedgerHost = 'map' | 'tile';

const KEY: Record<LedgerHost, string> = { map: 'slayer_map_view', tile: 'slayer_ledger_view' };
const FIRST: Record<LedgerHost, LedgerView> = { map: 'matrix', tile: 'calendar' };
/** The views a host offers — the Map's ladder went with the matrix's return */
export const VIEWS_FOR: Record<LedgerHost, LedgerView[]> = { map: ['matrix', 'calendar'], tile: ['calendar', 'ladder'] };

export function readLedgerView(host: LedgerHost): LedgerView {
  try {
    const saved = localStorage.getItem(KEY[host]);
    /* a pick this host no longer offers (the Map's old ladder) opens on the host's first */
    if ((saved === 'calendar' || saved === 'ladder' || saved === 'matrix') && VIEWS_FOR[host].includes(saved)) return saved;
  } catch {
    /* storage off — the host's first view */
  }
  return FIRST[host];
}

export function writeLedgerView(host: LedgerHost, view: LedgerView): void {
  try {
    localStorage.setItem(KEY[host], view);
  } catch {
    /* private mode — the pick lives for the session */
  }
}
