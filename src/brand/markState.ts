/*
==================================================
  SLAYER TERMINAL - WHAT THE MARK IS SAYING (brand/markState.ts)

  "Six states. The system, never the market." (Slayer Logo System, 02 · Living mark.) The mark in the rail, the
  loading screen, the landing and the browser tab all read this one value, so they never disagree:

    idle      the default — the silver pans, the cursor blinks
    loading   a load has run past 450 ms — the pan speeds up, the cursor holds
    live      a real feed is connected and the market is open — never on the simulated feed, so never yet
    closed    the market is shut (before the open, after the close, weekends, holidays) — the S stands still in graphite
    alert     an alert fired — the cursor flashes the warning ink twice, then the mark goes back
    offline   the connection is gone — the S stands still and the cursor hides until it comes back

  Precedence when two hold at once: offline, alert, loading, closed, live, idle. No red or green on the mark, ever —
  the mark reports the terminal, not the price.
==================================================
*/

import { useSyncExternalStore } from 'react';
import { readSessionClock } from '../data/sessionClock';

export type MarkState = 'idle' | 'loading' | 'live' | 'closed' | 'alert' | 'offline';

/** "Any load over 450 ms" */
const LOAD_SHOWN_MS = 450;
/** two flashes of the warning ink, then back */
const ALERT_MS = 1200;
/** how often the market's open/shut is read again while anything listens */
const CLOCK_MS = 30_000;

let marketOpen = isMarketOpen();
/* A real feed — the simulated one never sets this (core/simulator.ts). A data layer that connects sets it with setFeedLive. */
let feedLive = false;
let online = typeof navigator === 'undefined' ? true : navigator.onLine !== false;
let loadsShown = 0;
let alertUntil = 0;
let state: MarkState = derive();

const listeners = new Set<() => void>();
let clockTimer: number | null = null;
let alertTimer: number | null = null;

function isMarketOpen(): boolean {
  const phase = readSessionClock().phase;
  return phase === 'OPEN' || phase === 'AUCTION';
}

function derive(): MarkState {
  if (!online) return 'offline';
  if (alertUntil > Date.now()) return 'alert';
  if (loadsShown > 0) return 'loading';
  if (!marketOpen) return 'closed';
  if (feedLive) return 'live';
  return 'idle';
}

function emit(): void {
  const next = derive();
  if (next === state) return;
  state = next;
  listeners.forEach(l => l());
}

const onOnline = () => {
  online = true;
  emit();
};
const onOffline = () => {
  online = false;
  emit();
};

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1 && typeof window !== 'undefined') {
    marketOpen = isMarketOpen();
    online = navigator.onLine !== false;
    emit();
    clockTimer = window.setInterval(() => {
      marketOpen = isMarketOpen();
      emit();
    }, CLOCK_MS);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== 'undefined') {
      if (clockTimer != null) window.clearInterval(clockTimer);
      clockTimer = null;
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    }
  };
}

export const getMarkState = (): MarkState => state;

/** The mark's state, for anything that draws it */
export function useMarkState(): MarkState {
  return useSyncExternalStore(subscribe, getMarkState, getMarkState);
}

/** An alert fired somewhere in the terminal: the cursor flashes the warning ink twice */
export function flashAlert(): void {
  alertUntil = Date.now() + ALERT_MS;
  emit();
  if (alertTimer != null) window.clearTimeout(alertTimer);
  alertTimer = window.setTimeout(() => {
    alertTimer = null;
    emit();
  }, ALERT_MS + 20);
}

/** A load began. The mark says so only once it has run past 450 ms; call the returned function when it ends. */
export function beginLoad(): () => void {
  let shown = false;
  let done = false;
  const t = window.setTimeout(() => {
    if (done) return;
    shown = true;
    loadsShown += 1;
    emit();
  }, LOAD_SHOWN_MS);
  return () => {
    if (done) return;
    done = true;
    window.clearTimeout(t);
    if (shown) {
      loadsShown = Math.max(0, loadsShown - 1);
      emit();
    }
  };
}

/** A real feed connected or dropped — the simulated feed never calls this */
export function setFeedLive(live: boolean): void {
  feedLive = live;
  emit();
}
