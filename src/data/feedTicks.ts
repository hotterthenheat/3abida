/*
==================================================
  SLAYER TERMINAL - THE FEED'S HEARTBEAT (data/feedTicks.ts)

  One signal, rung each time the live feed has moved
  (context/MarketDataContext, after the simulator's
  tick). What has to act on every tick WHEREVER THE
  READER IS — the paper account's working orders
  (data/paper/store.ts) — listens here, not to a page's
  render: a stop has to fill while the reader is on
  another page. No React, no data of its own.
==================================================
*/

const listeners = new Set<() => void>();

/** Listen to every tick; the returned function stops listening */
export function onFeedTick(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** The feed moved — called by the one place that moves it */
export function announceFeedTick(): void {
  for (const fn of listeners) {
    try {
      fn();
    } catch (err) {
      /* one listener's fault is not the feed's: the rest still hear it */
      console.error(err);
    }
  }
}
