/*
  THE STAR — the Live Tape's bookmark, shared with every Trace table (Noah,
  2026-09-03). It leads the row's first cell, it is its own control (a click
  on it must not also open the row's card), and it reads the watch store
  itself, so a table's memoised rows sit still when a bookmark flips — only
  the stars redraw. Lime when on: the same ink the tape's star always wore.
*/

import { Bookmark } from 'lucide-react';
import { useWatch, type WatchedItem } from '../../context/WatchContext';

const WatchStar = ({
  k,
  make,
  noun = 'contract',
  className = '',
}: {
  /** The item's key — what the store is asked about */
  k: string;
  /** Builds the item on demand, so an unwatched row never allocates one */
  make: () => WatchedItem;
  noun?: 'print' | 'contract' | 'structure';
  className?: string;
}) => {
  const { isWatched, toggle } = useWatch();
  const on = isWatched(k);
  return (
    <button
      type="button"
      onClick={e => {
        e.stopPropagation();
        toggle(make());
      }}
      aria-pressed={on}
      aria-label={on ? `Untrack this ${noun}` : `Track this ${noun}`}
      title={on ? `Tracking this ${noun} — click to untrack` : `Track this ${noun} in the Tracker`}
      className={`shrink-0 transition-colors ${on ? 'text-select' : 'text-textMuted/40 hover:text-textSecondary'} ${className}`}
    >
      <Bookmark className="w-3 h-3" fill={on ? 'currentColor' : 'none'} />
    </button>
  );
};

export default WatchStar;
