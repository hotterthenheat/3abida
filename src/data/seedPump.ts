import Simulator from '../core/simulator';

/*
==================================================
  SLAYER TERMINAL - THE SEED PUMP (data/seedPump.ts)

  Asking the simulator to start carrying a name,
  without freezing a frame to do it.
==================================================

  SEEDING IS A QUEUE, NOT A CALL. `Simulator.seedAsync` walks a SLICE of a
  name's history per invocation and answers 'pending' until it is whole, so
  calling it once leaves the name half-built and permanently unseeded. This
  drives it across idle slots — a few milliseconds per quiet moment, never
  one long frame — and ONE pump serves every caller rather than each surface
  starting its own and competing for the same slots.

  WHO NEEDS THIS. Any surface that names a ticker the reader has not been
  looking at: a watchlist row, and the landing page, whose live panels are
  the first thing in the app to ask the simulator for a name nothing else
  has requested yet.
*/

const queue: string[] = [];
let pumping = false;
const listeners = new Set<() => void>();

const idle = (fn: () => void, timeout: number): void => {
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
  if (ric) ric(fn, { timeout });
  else window.setTimeout(fn, 60);
};

function pump(): void {
  const next = queue[0];
  if (!next) {
    pumping = false;
    return;
  }
  let state: 'done' | 'pending' = 'done';
  try {
    state = Simulator.seedAsync(next, 5);
  } catch {
    /* A name the simulator cannot build leaves the queue rather than
       retrying forever; the surface that asked reports it as unseeded. */
    state = 'done';
  }
  if (state === 'done') {
    queue.shift();
    for (const l of listeners) l();
  }
  idle(pump, 1500);
}

/** Told when any name finishes seeding, so a resting surface can redraw. */
export const onWake = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

/** Ask the simulator to start carrying a name. Idempotent and cheap. */
export function wakeSymbol(symbol: string): void {
  if (typeof window === 'undefined') return;
  const sym = symbol.toUpperCase();
  if (!Simulator.TICKERS[sym]) Simulator.register(sym);
  if (Simulator.isSeeded(sym) || queue.includes(sym)) return;
  queue.push(sym);
  if (!pumping) {
    pumping = true;
    idle(pump, 800);
  }
}
