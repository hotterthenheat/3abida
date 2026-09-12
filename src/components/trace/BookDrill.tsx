/*
==================================================
  SLAYER TERMINAL - BOOK DRILL (Trace)
  One card for a contract, EVERYWHERE (Noah,
  2026-08-30: "should they not open up this type
  of card that we currently have on our options
  tape and not the rest of them?").

  Mounts the Live Tape's full PrintDrilldown for
  any day-book row: the row speaks as its latest
  print (data/tape bookRowToPrint), the snapshot
  is the row's OWN ticker (so the Compass strip
  grades every name, not just the active one), and
  ↑/↓ steps through the host page's table order.
  Opening an unseeded name pays its seed here —
  the Dark Pool Leaders precedent.
==================================================
*/

import { useMemo } from 'react';
import Simulator from '../../core/simulator';
import PrintDrilldown from './PrintDrilldown';
import { bookRowToPrint } from '../../data/tape';
import { contractKey, useWatch, watchContract } from '../../context/WatchContext';
import type { BookContract } from '../../types/trace';

interface BookDrillProps {
  /** The page's visible rows, in table order — stepping walks this list */
  list: BookContract[];
  /** Key of the open row, null = closed */
  openKey: string | null;
  onOpen: (key: string | null) => void;
  /** Anchor-print override per row — Watchers hands in the exact clip */
  clipFor?: (row: BookContract) => { size: number; fill: number; side: 'ASK' | 'BID'; time: string } | undefined;
  /** Changes every simulator tick so the snapshot stays live */
  tick?: unknown;
}

const BookDrill = ({ list, openKey, onOpen, clipFor, tick }: BookDrillProps) => {
  /* The card's bookmark is the CONTRACT's (2026-09-03) — the same star the
     row wears, the same store the Tracker reads. */
  const { isWatched, toggle } = useWatch();

  const idx = openKey === null ? -1 : list.findIndex(r => r.key === openKey);
  const row = idx >= 0 ? list[idx] : null;

  const print = useMemo(() => (row ? bookRowToPrint(row, clipFor?.(row)) : null), [row, clipFor]);

  const snapshot = useMemo(
    () => (row ? Simulator.snapshotFor(row.ticker) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [row?.ticker, tick]
  );

  return (
    <PrintDrilldown
      print={print}
      snapshot={snapshot}
      onClose={() => onOpen(null)}
      isMarked={row ? isWatched(contractKey(row)) : false}
      onToggleMark={() => row && toggle(watchContract(row, 'card'))}
      onStep={dir => {
        const next = list[idx + dir];
        if (next) onOpen(next.key);
      }}
      hasPrev={idx > 0}
      hasNext={idx >= 0 && idx < list.length - 1}
    />
  );
};

export default BookDrill;
