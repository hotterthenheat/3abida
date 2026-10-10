/*
  THE SHELL'S DOORS, FOR A PAGE (2026-09-19, more on 2026-10-09). The command line lives in the shell and opens on
  Ctrl K (⌘K on a Mac); a page that wants to offer it as a button — the not-found page's "search every page" — asks
  through here rather than faking a key press. AppShell listens. The same goes for the keys sheet (`?`) and the rail's
  fold, which the command line's actions open from anywhere.
*/
export { PALETTE_KEY } from './keys';

export const OPEN_PALETTE_EVENT = 'slayer:open-palette';
export const openPalette = (): void => {
  window.dispatchEvent(new Event(OPEN_PALETTE_EVENT));
};

/** The sheet of keys for the page you are on (ShortcutSheet.tsx) */
export const OPEN_KEYS_EVENT = 'slayer:open-keys';
export const openKeySheet = (): void => {
  window.dispatchEvent(new Event(OPEN_KEYS_EVENT));
};

/** Fold the rail to its icons, or open it (SideNav.tsx) */
export const TOGGLE_RAIL_EVENT = 'slayer:toggle-rail';
export const toggleRail = (): void => {
  window.dispatchEvent(new Event(TOGGLE_RAIL_EVENT));
};
