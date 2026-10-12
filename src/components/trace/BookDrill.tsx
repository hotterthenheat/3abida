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
import { useFeedLatestPrint } from '../../data/feed/traceCard';
import Simulator from '../../core/simulator';
import PrintDrilldown from './PrintDrilldown';
import { bookRowToPrint } from '../../data/tape';
import { contractKey, useWatch, watchContract } from '../../context/WatchContext';
import type { BookContract, FlowPrint } from '../../types/trace';

interface BookDrillProps {
  /** The page's visible rows, in table order — stepping walks this list */
  list: BookContract[];
  /** Key of the open row, null = closed */
  openKey: string | null;
  onOpen: (key: string | null) => void;
  /** Anchor-print override per row — Watchers hands in the exact clip */
  clipFor?: (row: BookContract) => { size: number; fill: number; side: 'ASK' | 'BID'; time: string; premium?: number } | undefined;
  /** Changes every simulator tick so the snapshot stays live */
  tick?: unknown;
  /** Trace is on the feed (2026-10-12): the row speaks as its own latest print from the vendor, never a drawn one */
  feed?: boolean;
}

/* A book row as a print on the feed: the contract's latest print when it is in, the clip a watcher caught when one is
   handed in — the day's facts (volume, open interest and its change, IV) the row's own, and the market a fill crossed
   into only where the vendor gave it */
function feedPrint(row: BookContract, latest: FlowPrint | null, clip?: { size: number; fill: number; side: 'ASK' | 'BID'; time: string; premium?: number }): FlowPrint {
  const day = {
    volume: row.volume,
    oi: row.oi,
    deltaOI: row.deltaOI,
    volOverOI: row.volOverOI,
    ratioBidPct: row.bidPct ?? NaN,
    ratioAskPct: row.askPct,
    ratioLabel: !Number.isFinite(row.askPct) || row.bidPct === undefined ? '—' : row.bidPct >= row.askPct ? `BID ${row.bidPct}%` : `ASK ${row.askPct}%`,
  };
  if (clip) {
    return {
      ...(latest ?? {}),
      id: hashKey(`${row.key}-${clip.time}`),
      occ: row.occ,
      time: clip.time,
      ticker: row.ticker,
      legs: 1,
      strike: row.strike,
      right: row.right,
      otmPct: row.otmPct,
      expiry: row.expiry,
      dte: row.dte,
      fill: clip.fill,
      bid: NaN,
      ask: NaN,
      fillPos: clip.side === 'ASK' ? 1 : 0,
      side: clip.side,
      flowScore: clip.side === 'ASK' ? 100 : -100,
      size: clip.size,
      premium: clip.premium ?? Math.round(clip.fill * clip.size * 100),
      spot: row.spot,
      iv: row.iv,
      strat: '—',
      sweep: false,
      ...day,
    };
  }
  if (latest) return { ...latest, ...day, iv: Number.isFinite(latest.iv) ? latest.iv : row.iv };
  const side: FlowPrint['side'] = row.bidPct !== undefined && row.askPct - row.bidPct >= 10 ? 'ASK' : row.bidPct !== undefined && row.bidPct - row.askPct >= 10 ? 'BID' : 'MID';
  return {
    id: hashKey(row.key),
    occ: row.occ,
    time: row.lastAt,
    ticker: row.ticker,
    legs: 1,
    strike: row.strike,
    right: row.right,
    otmPct: row.otmPct,
    expiry: row.expiry,
    dte: row.dte,
    fill: row.last,
    bid: NaN,
    ask: NaN,
    fillPos: 0.5,
    side,
    flowScore: 0,
    size: NaN,
    premium: NaN,
    spot: row.spot,
    iv: row.iv,
    strat: '—',
    sweep: false,
    ...day,
  };
}
const hashKey = (k: string) => {
  let h = 2166136261;
  for (let i = 0; i < k.length; i++) {
    h ^= k.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const BookDrill = ({ list, openKey, onOpen, clipFor, tick, feed = false }: BookDrillProps) => {
  /* The card's bookmark is the CONTRACT's (2026-09-03) — the same star the
     row wears, the same store the Tracker reads. */
  const { isWatched, toggle } = useWatch();

  const idx = openKey === null ? -1 : list.findIndex(r => r.key === openKey);
  const row = idx >= 0 ? list[idx] : null;

  const latest = useFeedLatestPrint(feed && !!row, row?.occ);
  const print = useMemo(() => (!row ? null : feed ? feedPrint(row, latest, clipFor?.(row)) : bookRowToPrint(row, clipFor?.(row))), [row, clipFor, feed, latest]);

  const snapshot = useMemo(
    () => (row && !feed ? Simulator.snapshotFor(row.ticker) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [row?.ticker, tick, feed]
  );

  return (
    <PrintDrilldown
      print={print}
      snapshot={snapshot}
      feed={feed}
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
