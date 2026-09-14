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

/*
  THE SKELETON IS NOT A FRAME BUDGET (Noah, 2026-09-14: "terrain and pinpoint
  and a few other areas dont load").

  This pumped 5ms of seeding every 24ms — a 17% duty cycle — so a name that
  needs ~420ms of CPU took two and a half seconds of wall clock to arrive, and
  a desk that wants three names waited on them one after another. On this
  machine that was ~640ms of skeleton on Terrain, survivable. On a CPU four
  times slower, which is any laptop or phone:

      /terrain          3.8s to real content, 1.8s of it skeleton
      /pinpoint/map    12.2s to real content, 7.2s of it skeleton

  Twelve seconds is not slow, it is broken — the page reads as one that never
  loads, which is exactly how it was reported.

  The 24ms gap was there to protect a chart's frame loop. But the whole point
  of this hook is that the surface is showing its SKELETON: there is no chart
  drawing yet, and nothing to stutter. So the slice is fat now and the gap is
  gone. setTimeout(…, 0) nested past a few levels is clamped to ~4ms by the
  browser, which lands the duty cycle near 80% — fast enough to be a blink,
  and still yielding often enough that a pane that IS live next to this one
  keeps its frames.
*/
const SLICE_MS = 16;
const idle = (fn: () => void, _timeout: number) => ({ id: window.setTimeout(fn, 0), idle: false });

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
        state = Simulator.seedAsync(ticker, SLICE_MS);
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
