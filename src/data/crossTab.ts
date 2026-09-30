/*
==================================================
  SLAYER TERMINAL - THE OTHER TAB
  (data/crossTab.ts)

  A store is not this tab's alone.
==================================================

  TWO TABS WERE DESTROYING EACH OTHER'S WORK, and the shape of the bug is
  the same in every store here: read localStorage ONCE at module load, hold
  it in a module variable, and write the WHOLE object back on every change.
  Open the terminal twice and the second tab is holding a photograph. Add a
  name in the first, add one in the second, and the second's write erases
  the first's — silently, with the reader watching something they just did
  simply not be there after a refresh.

  THE `storage` EVENT IS EXACTLY THE SIGNAL. The browser fires it in every
  OTHER tab of the origin when one of them writes, and never in the tab that
  did the writing, so re-reading on it cannot loop. Two lines per store, and
  the whole class of "it forgot what I did" goes away.

  WHAT DOES NOT BELONG HERE. A per-tab preference — which pane is open,
  which columns are showing, the editor dock's height — is a thing a reader
  may deliberately want different in two windows, and syncing it would yank
  the layout out from under them. This is for CONTENT: the things they made
  and would be upset to lose.
*/

/**
 * Re-read a store when another tab writes its key.
 *
 * @param key    the localStorage key the store owns
 * @param reread called with nothing to do but re-read and notify; it runs
 *               only for a write in ANOTHER tab, or for a `clear()`
 *               (which arrives with a null key)
 * @returns a detach function, for the rare store that is torn down
 */
export function syncAcrossTabs(key: string, reread: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onStorage = (e: StorageEvent): void => {
    /* A null key means the whole origin was cleared — every store is stale,
       including this one. Any other key belongs to a different store. */
    if (e.key !== null && e.key !== key) return;
    reread();
  };
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}
