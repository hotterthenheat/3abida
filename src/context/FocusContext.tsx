/*
==================================================
  SLAYER TERMINAL - THE SHARED STRIKE (FocusContext)
  One strike, held by the whole terminal (Noah,
  2026-09-05, the Pinpoint cut: "the shared
  strike"). Before this, every Pinpoint tab kept its
  own selected strike and forgot it on the next tab,
  and the chart learned a strike only by a route
  state handed to it on arrival. Now a strike picked
  anywhere — a ladder row, a capsule, a ranked
  target, a session grid — is THE strike: the shell
  wears it as a chip, every tab lights it, the Pulse
  chart draws it as the focus line the moment the
  desk opens.

  A focus is a fact about ONE name. Leaving that
  name retires it — but only a transition AWAY
  counts: arriving with a repoint in flight, the
  desk is briefly still on the old name, and
  clearing then would kill the focus before the
  chart ever drew it (the rule Pulse carried alone
  since 2026-08-19; it lives here now).
==================================================
*/

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useMarketData } from './MarketDataContext';

export interface StrikeFocus {
  ticker: string;
  /** The strike — a price on the name's ladder */
  price: number;
  /** A one-shot arrival token: changes on every focusOn, so a chart can lift itself for a NEW arrival only */
  token: number;
}

interface FocusValue {
  focus: StrikeFocus | null;
  /** Focus this strike on this name (a fresh token each call) */
  focusOn: (price: number, ticker: string) => void;
  /** The same strike again lets go; another strike takes over */
  toggleFocus: (price: number, ticker: string) => void;
  clearFocus: () => void;
}

const FocusCtx = createContext<FocusValue | null>(null);

export const FocusProvider = ({ children }: { children: ReactNode }) => {
  const { activeTicker } = useMarketData();
  const [focus, setFocus] = useState<StrikeFocus | null>(null);
  const focusOn = useCallback((price: number, ticker: string) => setFocus({ price, ticker, token: Date.now() }), []);
  const toggleFocus = useCallback(
    (price: number, ticker: string) => setFocus(prev => (prev && prev.ticker === ticker && prev.price === price ? null : { price, ticker, token: Date.now() })),
    []
  );
  const clearFocus = useCallback(() => setFocus(null), []);

  const prevTickerRef = useRef(activeTicker);
  useEffect(() => {
    const prev = prevTickerRef.current;
    prevTickerRef.current = activeTicker;
    if (focus && prev === focus.ticker && activeTicker !== focus.ticker) setFocus(null);
  }, [activeTicker, focus]);

  const value = useMemo<FocusValue>(() => ({ focus, focusOn, toggleFocus, clearFocus }), [focus, focusOn, toggleFocus, clearFocus]);
  return <FocusCtx.Provider value={value}>{children}</FocusCtx.Provider>;
};

export const useFocus = (): FocusValue => {
  const v = useContext(FocusCtx);
  if (!v) throw new Error('useFocus must be used inside FocusProvider');
  return v;
};

/** The focused strike if it belongs to this name, else null — the read every surface wants */
export const useFocusedStrike = (ticker: string | null | undefined): number | null => {
  const { focus } = useFocus();
  return focus && ticker && focus.ticker === ticker ? focus.price : null;
};
