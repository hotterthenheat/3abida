/*
==================================================
  SLAYER TERMINAL - TRACE'S DAY BOOK, FROM ONE PLACE
  (components/trace/useTraceBook.ts)

  Every Trace page that read buildFlowBook reads this
  (2026-10-12): the vendor's book when the room is on
  the feed (data/feed/trace.ts), the house's own book
  when it is not — never both on one screen, and
  nothing at all while the shell's first probe is out.
==================================================
*/

import { useMemo } from 'react';
import Simulator from '../../core/simulator';
import { buildFlowBook } from '../../data/flowBook';
import { useFeedBook, useTraceSource, type TraceSource } from '../../data/feed/trace';
import type { BookContract } from '../../types/trace';

const EMPTY: BookContract[] = [];

export interface TraceBook {
  book: BookContract[];
  source: TraceSource;
  /** On the feed, the first answer is not in yet */
  loading: boolean;
}

/** `tick` is the page's market tick — the house's book is rebuilt on it, as before */
export function useTraceBook(activeTicker: string, tick: unknown): TraceBook {
  const source = useTraceSource();
  const feed = useFeedBook(source === 'feed', activeTicker);
  const stand = useMemo(
    () => (source === 'stand-in' ? buildFlowBook(Simulator.universeQuotes(activeTicker)) : EMPTY),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [source, activeTicker, tick]
  );
  return useMemo(
    () => (source === 'feed' ? { book: feed ?? EMPTY, source, loading: feed === null } : { book: stand, source, loading: source === 'pending' }),
    [source, feed, stand]
  );
}
