import React, { useEffect } from 'react';
import {
  changeTicker,
  clearLedger,
  executeTrade,
  startFeed,
  useMarketBackground,
  type LedgerState,
  type MarketState,
  type StampedPrint,
} from './marketStore';
import type { ExecuteResult, MarketSnapshot, TickerSymbol } from '../types/market';

/* THE FEED'S OLD FRONT DOOR (2026-10-10). The feed is context/marketStore.ts now, read a key at a time
   (useActiveTicker, useQuote, useSpot, useSnapshot, useScanSnapshot, useFlowTape, useTickSeq, useNow, useLinkedName).
   This provider only starts it and holds no state of its own, so it never renders the app again; `useMarketData`
   stays for the pages that read the whole feed — they render on every published tick, as every reader did before. */

export type { StampedPrint } from './marketStore';
export {
  changeTicker,
  useActiveTicker,
  useFeedReady,
  useFlowTape,
  useLinkedName,
  useLinkGroupName,
  useMarketSelect,
  useNow,
  useQuote,
  useScanSnapshot,
  useSnapshot,
  useSpot,
  useTickSeq,
  onMarketTick,
} from './marketStore';

interface MarketDataContextValue {
  activeTicker: TickerSymbol;
  marketData: MarketSnapshot | null;
  /** The session's option prints, newest first — aged and capped. */
  flowTape: StampedPrint[];
  ledgerState: LedgerState;
  changeTicker: (ticker: string) => void;
  executeTrade: () => ExecuteResult;
  clearLedger: () => void;
}

export const MarketDataProvider = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => startFeed(), []);
  return <>{children}</>;
};

const whole = (s: MarketState) => s;
/* Only what this door hands out — a link group moving is not a reason for its readers to render */
const sameFeed = (a: MarketState, b: MarketState) =>
  a.active === b.active && a.snapshot === b.snapshot && a.tape === b.tape && a.ledger === b.ledger;

/** The whole feed — renders on every published tick. A reader of one value reads it by its own hook instead. */
export const useMarketData = (): MarketDataContextValue => {
  const s = useMarketBackground(whole, sameFeed);
  return {
    activeTicker: s.active,
    marketData: s.snapshot,
    flowTape: s.tape,
    ledgerState: s.ledger,
    changeTicker,
    executeTrade,
    clearLedger,
  };
};
