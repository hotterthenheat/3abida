/*
==================================================
  SLAYER TERMINAL - A NAME'S HISTORY, IN IDLE TIME
  (components/gex/useSeeded.ts)

  The perf sweep (2026-09-06). A surface that needs a
  name the simulator has not walked yet used to
  seed it inline — 22 sessions in one synchronous
  call, a long frame on the click. This hook asks
  for the history a slice at a time from idle
  callbacks and reports when it is whole; the
  surface shows its skeleton meanwhile. A name that
  is already seeded is ready at once.
==================================================
*/

import { useEffect, useState } from 'react';
import Simulator from '../../core/simulator';

/* A short timer, not an idle callback: a chart's frame loop leaves the
   browser no quiet moment, so idle callbacks only fire on their timeout. */
const idle = (fn: () => void, _timeout: number) => ({ id: window.setTimeout(fn, 24), idle: false });

export function useSeeded(ticker: string | null | undefined): boolean {
  const [ready, setReady] = useState(() => (ticker ? Simulator.isSeeded(ticker) : false));
  useEffect(() => {
    if (!ticker) {
      setReady(false);
      return;
    }
    if (Simulator.isSeeded(ticker)) {
      setReady(true);
      return;
    }
    setReady(false);
    let handle: { id: number; idle: boolean } | null = null;
    let stopped = false;
    const pump = () => {
      if (stopped) return;
      let state: 'done' | 'pending' = 'done';
      try {
        state = Simulator.seedAsync(ticker, 5);
      } catch {
        state = 'done';
      }
      if (state === 'done') {
        setReady(true);
        return;
      }
      handle = idle(pump, 400);
    };
    handle = idle(pump, 200);
    return () => {
      stopped = true;
      if (!handle) return;
      const w = window as Window & { cancelIdleCallback?: (id: number) => void };
      if (handle.idle) w.cancelIdleCallback?.(handle.id);
      else window.clearTimeout(handle.id);
    };
  }, [ticker]);
  return ready;
}
