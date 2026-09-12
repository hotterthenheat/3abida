import React, { createContext, startTransition, useContext, useState, useEffect, useRef } from 'react';
import Simulator from '../core/simulator';
import Ledger from '../core/ledger';
import { enrichPrint } from '../data/tape';
import type { FlowPrint } from '../types/trace';
import type { ExecuteResult, LedgerStats, MarketSnapshot, TickerSymbol, TradeRecord } from '../types/market';

/* THE LIVE TAPE, kept for the desk (ported 2026-08-27).

   Prints arrive a handful per tick and several surfaces want the same
   unfiltered stream — the chart's event markers read the biggest of them,
   the flow overlays bucket them to bars. Holding it here means one tape,
   stamped once, rather than every pane growing its own.

   Aged FIRST, then capped: age alone lets a busy session run unbounded, and
   the count alone keeps yesterday's prints alive on a tab left open. */
export type StampedPrint = FlowPrint & { at: number };
const TAPE_CAP = 5000;
const TAPE_MAX_AGE_MS = 4 * 60 * 60 * 1000;

interface LedgerState {
  activeTrades: TradeRecord[];
  closedTrades: TradeRecord[];
  stats: LedgerStats;
}

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

const MarketDataContext = createContext<MarketDataContextValue | null>(null);

export const MarketDataProvider = ({ children }: { children: React.ReactNode }) => {
  const [activeTicker, setActiveTickerState] = useState<TickerSymbol>(Simulator.getActiveTicker());
  const [marketData, setMarketData] = useState<MarketSnapshot | null>(null);
  const [flowTape, setFlowTape] = useState<StampedPrint[]>([]);
  /* The print id counter lives in a ref, not in state: it must never reset on
     a re-render, and a duplicate id would collapse two prints into one row. */
  const printIdRef = useRef(0);
  const [ledgerState, setLedgerState] = useState<LedgerState>({
    activeTrades: [],
    closedTrades: [],
    stats: { winRate: 0, profitFactor: 0, avgAccuracy: 0, totalPnL: 0, count: 0 }
  });

  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /* The feed's first tick: the active name seeds in slices at boot (the
     simulator's pump), and the tick emits nothing until it is whole — so the
     provider asks again every 80ms until the first snapshot lands, instead
     of waiting out a whole interval with the desk on "Awaiting feed". */
  const readyRef = useRef(false);
  const warmRef = useRef<number | null>(null);

  // Initialize Ledger on Mount
  useEffect(() => {
    Ledger.loadFromStorage();
    updateLedgerState();

    // Start Ticking
    startSimulator();

    return () => {
      stopSimulator();
    };
  }, []);

  const updateLedgerState = () => {
    setLedgerState({
      activeTrades: [...Ledger.getActiveTrades()],
      closedTrades: [...Ledger.getClosedTrades()],
      stats: Ledger.getStats()
    });
  };

  const absorbTape = (data: MarketSnapshot) => {
    if (!data.tape || data.tape.length === 0) return;
    const now = Date.now();
    const fresh: StampedPrint[] = data.tape.map(o => ({ ...enrichPrint(o, ++printIdRef.current), at: now }));
    setFlowTape(prev => {
      const next = [...fresh, ...prev];
      const cutoff = now - TAPE_MAX_AGE_MS;
      const aged =
        next.length > TAPE_CAP || (next[next.length - 1]?.at ?? now) < cutoff
          ? next.filter(p => p.at >= cutoff)
          : next;
      return aged.length > TAPE_CAP ? aged.slice(0, TAPE_CAP) : aged;
    });
  };

  const processTick = () => {
    Simulator.tick((data) => {
      readyRef.current = true;
      // 1. Evaluate open trades — a side effect on the ledger, not a render.
      const currentActiveTicker = Simulator.getActiveTicker();
      Ledger.updateOpenTrades(currentActiveTicker, data.spot);

      /* 2. Publish the tick AS A TRANSITION (Noah, 2026-08-30: "some sort of
         buffer... jolts the entire website"). Measured on the Screener: the
         minute-turn redraw of a 250-row table ran as one 182ms task — the
         page simply stopped. Nobody clicked for this update; it is background
         data, so React may render it in slices between frames and commit
         when done. Same pixels, no frozen frame. Ticker changes stay urgent
         (changeTicker below) because a person is waiting on those. */
      startTransition(() => {
        setMarketData(data);
        absorbTape(data);
        updateLedgerState();
      });
    });
  };

  const startSimulator = () => {
    if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
    processTick();
    tickIntervalRef.current = setInterval(processTick, 1500);
    const warm = () => {
      warmRef.current = null;
      if (readyRef.current) return;
      processTick();
      if (!readyRef.current) warmRef.current = window.setTimeout(warm, 80);
    };
    if (!readyRef.current) warmRef.current = window.setTimeout(warm, 80);
  };

  const stopSimulator = () => {
    if (tickIntervalRef.current) {
      clearInterval(tickIntervalRef.current);
      tickIntervalRef.current = null;
    }
    if (warmRef.current !== null) {
      window.clearTimeout(warmRef.current);
      warmRef.current = null;
    }
  };

  const changeTicker = (ticker: string) => {
    const sym = Simulator.setActiveTicker(ticker);
    setActiveTickerState(sym);

    // Trigger instant tick for snappy UI transition
    Simulator.tick((data) => {
      setMarketData(data);
      absorbTape(data);
      updateLedgerState();
    });
  };

  const executeTrade = (): ExecuteResult => {
    if (!marketData || !marketData.plan) return { success: false, message: 'No active plan' };
    const res = Ledger.executePlan(marketData.plan);
    updateLedgerState();
    return res;
  };

  const clearLedger = () => {
    Ledger.clearHistory();
    updateLedgerState();
  };

  return (
    <MarketDataContext.Provider value={{
      activeTicker,
      marketData,
      flowTape,
      ledgerState,
      changeTicker,
      executeTrade,
      clearLedger
    }}>
      {children}
    </MarketDataContext.Provider>
  );
};

export const useMarketData = (): MarketDataContextValue => {
  const context = useContext(MarketDataContext);
  if (!context) {
    throw new Error('useMarketData must be used within a MarketDataProvider');
  }
  return context;
};
