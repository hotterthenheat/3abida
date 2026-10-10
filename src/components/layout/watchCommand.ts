/*
==================================================
  SLAYER TERMINAL - "WATCH NVDA" (components/layout/watchCommand.ts)

  The command line's way onto the one watchlist of names
  (data/nameWatch.ts). The command line itself
  (CommandPalette.tsx `goCmds`) asks this with the typed
  words and its own `knownName`; a match is one Go row:
  "Watch NVDA" puts the name on the list (an undo chip to
  take it back), "NVDA is on the watchlist" opens it.
==================================================
*/

import { isWatchedName, openWatchlist, unwatchName, watchName } from '../../data/nameWatch';
import { undoable } from '../ui/undo';

/** "watch NVDA", "NVDA watch", "watchlist NVDA" */
const WATCH_RE = /^(?:watch(?:list)?\s+([A-Za-z][A-Za-z0-9.^-]{0,9})|([A-Za-z][A-Za-z0-9.^-]{0,9})\s+watch(?:list)?)$/i;

export interface WatchCommand {
  id: string;
  label: string;
  hint: string;
  run: () => void;
}

/** The Go row for typed words, or null when they are not a watch command */
export function watchCommand(query: string, knownName: (word: string) => string | null): WatchCommand | null {
  const m = WATCH_RE.exec(query.trim());
  if (!m) return null;
  const sym = knownName(m[1] ?? m[2] ?? '');
  if (!sym) return null;
  if (isWatchedName(sym)) {
    return { id: `go:watch:${sym}`, label: `${sym} is on the watchlist`, hint: 'Open the watchlist', run: () => openWatchlist() };
  }
  return {
    id: `go:watch:${sym}`,
    label: `Watch ${sym}`,
    hint: 'Put the name on the watchlist — the rail’s Watchlist door keeps it',
    run: () => {
      if (watchName(sym) !== 'added') return;
      undoable({
        label: `${sym} is on the watchlist`,
        undo: () => {
          unwatchName(sym);
        },
        key: `watch-on-${sym}`,
      });
    },
  };
}
