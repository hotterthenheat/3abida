/*
  THE COMMAND PALETTE'S DOOR, FOR A PAGE (2026-09-19). The palette lives in the shell and opens on Ctrl K; a page that wants
  to offer it as a button — the not-found page's "search every page" — asks through here rather than faking a key press.
  AppShell listens.
*/
export const OPEN_PALETTE_EVENT = 'slayer:open-palette';
export const openPalette = (): void => {
  window.dispatchEvent(new Event(OPEN_PALETTE_EVENT));
};
