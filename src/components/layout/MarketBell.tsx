/*
==================================================
  SLAYER TERMINAL - THE OPEN AND THE CLOSE, OUT LOUD (components/layout/MarketBell.tsx)

  "One tone up at the open, one down at the close." (Slayer Logo System, 14 · Motion and sound — off until switched on
  in Settings › Sounds.) Watches the market's state while the terminal is open and sounds the turn when it sees one;
  a terminal opened after the bell hears nothing. Draws nothing.
==================================================
*/

import { useEffect, useRef } from 'react';
import { readMarketState, type MarketStateKind } from '../../data/marketState';
import { marketBell } from '../../core/sound';

const OPEN: MarketStateKind[] = ['open', 'early-close'];

const MarketBell = () => {
  const last = useRef<MarketStateKind>(readMarketState().kind);
  useEffect(() => {
    const id = window.setInterval(() => {
      const now = readMarketState().kind;
      const was = last.current;
      last.current = now;
      if (now === was) return;
      if (OPEN.includes(now) && !OPEN.includes(was)) marketBell(true);
      else if (!OPEN.includes(now) && OPEN.includes(was)) marketBell(false);
    }, 15_000);
    return () => window.clearInterval(id);
  }, []);
  return null;
};

export default MarketBell;
