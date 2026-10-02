/*
==================================================
  SLAYER TERMINAL - WHAT THE MARK IS SAYING (brand/markState.ts)

  "Six states. The system, never the market." (Slayer Logo System, 02 · Living mark.) The mark in the rail, the
  loading screen, the landing and the browser tab all read this one value, so they never disagree:

    idle      a mark the clock does not drive (and the static icons' frame) — the pan at 4.5 s, the cursor blinks
    loading   a load has run past 450 ms — the pan speeds up to 1.5 s, the cursor blinks
    live      the market is open (the owner, 2026-10-01) — the slow pan, the cursor blinks
    closed    the market is shut (before the open, after the close, weekends, holidays) — a slower pan still, the cursor
              blinks: never a still graphite S (the owner, 2026-10-02)
    alert     an alert fired — the cursor flashes the warning ink twice, then the mark goes back
    offline   the connection is gone — the S stands still and the cursor hides until it comes back

  The mark itself never moves but for the foil's pan and the cursor's blink (the owner, 2026-10-02), and every mark on
  the page does both on one beat (brand/brandClock.ts). Precedence when two hold at once: offline, alert, loading, then
  the market's own (live or closed). No red, green or lime on the mark, ever — the mark reports the terminal, not the
  price. Open and shut are the signature's word for it too (data/marketState.ts), so the mark and "slayer:~ $ ● live"
  never disagree.
==================================================
*/

import { useSyncExternalStore } from 'react';
import { readMarketState } from '../data/marketState';

export type MarkState = 'idle' | 'loading' | 'live' | 'closed' | 'alert' | 'offline';

/** "Any load over 450 ms" */
const LOAD_SHOWN_MS = 450;
/** two flashes of the warning ink, then back */
const ALERT_MS = 1200;
/** how often the market's open/shut is read again while anything listens */
const CLOCK_MS = 30_000;

let marketOpen = isMarketOpen();
let online = typeof navigator === 'undefined' ? true : navigator.onLine !== false;
let loadsShown = 0;
let alertUntil = 0;
let state: MarkState = derive();

const listeners = new Set<() => void>();
let clockTimer: number | null = null;
let alertTimer: number | null = null;

/** the signature's own reading (data/marketState.ts): live while the market is open — early closes and holidays known */
function isMarketOpen(): boolean {
  return readMarketState().word === 'live';
}

function derive(): MarkState {
  if (!online) return 'offline';
  if (alertUntil > Date.now()) return 'alert';
  if (loadsShown > 0) return 'loading';
  return marketOpen ? 'live' : 'closed';
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
