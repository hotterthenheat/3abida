/*
==================================================
  SLAYER TERMINAL - j AND k, AND g TO A ROOM
  (components/layout/rowStepKeys.ts)

  The ideas report's keyboard leftovers (item 9,
  2026-10-10):

    j / k   the row below and the row above, wherever
            ↓ and ↑ step rows — an AG Grid's cells,
            a grid or a list of rows, a menu of rows
            that steps with the arrows. Said as the
            arrow itself: the key is handed to the
            focused row as ↓ or ↑, so every place that
            already steps on the arrows steps on j and
            k too, with nothing of its own to learn.
    g, then a room's letter — the room (ROOM_KEYS;
            the `?` sheet prints them, keys.ts).

  The shell (AppShell) calls both from its one
  keydown listener; a key typed into a field is the
  field's, and an open layer keeps its keys.
==================================================
*/

/** A row that steps on ↓ and ↑ — the places j and k are aliases */
const ROW_STEPS = [
  '.ag-root-wrapper [role="gridcell"]',
  '.ag-root-wrapper [role="row"]',
  '[role="grid"] [role="row"]',
  '[role="grid"] [role="gridcell"]',
  '[role="menuitemradio"]',
  '[data-row-step]',
  '[data-matrix-row]',
  '[data-add-row]',
].join(', ');

/** Is the focused thing a row that steps on the arrows? */
const onSteppingRow = (el: Element | null): el is HTMLElement => !!el && el instanceof HTMLElement && !!el.closest(ROW_STEPS);

/**
 * j and k as ↓ and ↑: the arrow is handed to the focused row, and every handler that steps on it steps. Returns true
 * when the key was taken.
 */
export function aliasRowStep(e: KeyboardEvent): boolean {
  if (e.key !== 'j' && e.key !== 'k') return false;
  if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return false;
  const at = document.activeElement;
  if (!onSteppingRow(at)) return false;
  e.preventDefault();
  e.stopPropagation();
  const key = e.key === 'j' ? 'ArrowDown' : 'ArrowUp';
  at.dispatchEvent(new KeyboardEvent('keydown', { key, code: key, bubbles: true, cancelable: true, composed: true }));
  return true;
}

/** g, then the room's letter */
export const ROOM_KEYS: { key: string; room: string; path: string }[] = [
  { key: 'P', room: 'Pulse', path: '/pulse' },
  { key: 'T', room: 'Terrain', path: '/terrain' },
  { key: 'F', room: 'Trace — the flow', path: '/trace' },
  { key: 'D', room: 'Dossier', path: '/dossier' },
  { key: 'M', room: 'Pinpoint — its Map', path: '/pinpoint' },
  { key: 'C', room: 'Compass', path: '/compass' },
  { key: 'W', room: 'Weigher', path: '/weigher' },
  { key: 'A', room: 'Practice — Paper', path: '/practice/paper' },
  { key: 'B', room: 'Practice — Backtest', path: '/practice/backtest' },
  { key: 'J', room: 'Practice — Journal', path: '/practice/journal' },
  { key: 'S', room: 'Settings', path: '/settings' },
];

/** How long the room's letter is waited for after g */
export const G_WAIT_MS = 1200;

/** The room a letter names, after g — or null */
export const roomFor = (key: string): string | null => ROOM_KEYS.find(r => r.key === key.toUpperCase())?.path ?? null;
