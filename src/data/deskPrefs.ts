/*
==================================================
  SLAYER TERMINAL - THE DESK'S PREFERENCES (data/deskPrefs.ts)

  What every desk reads by, set once on the
  Settings page (Noah, 2026-09-12: "make the desk
  buttons actually have the function behind them"):
  the name and the timeframe a desk opens on,
  whether alerts sound, and whose clock the axes
  keep. On this machine (localStorage) until the
  account carries them; read by the hosts at their
  first render, by the chart clock at every label,
  by the bell at every ring.
==================================================
*/

import { useSyncExternalStore } from 'react';
import type { Timeframe } from './timeframe';

export type ClockZone = 'local' | 'ny';

export interface DeskPrefs {
  opensOn: {
    /** null = where you left off (the simulator's last active name) */
    ticker: string | null;
    /** null = each desk's own (Pulse 1m, the Map 15m …) */
    timeframe: Timeframe | null;
  };
  /** the jingle when one arms, the chime when it fires */
  alertsSound: boolean;
  /** the axes' clock — New York's, or the machine's own */
  clock: ClockZone;
}

const KEY = 'slayer_desk_prefs';
export const DEFAULT_DESK_PREFS: DeskPrefs = { opensOn: { ticker: null, timeframe: null }, alertsSound: true, clock: 'local' };

let prefs: DeskPrefs = (() => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_DESK_PREFS;
    const p = JSON.parse(raw) as Partial<DeskPrefs>;
    return {
      opensOn: { ticker: p.opensOn?.ticker ?? null, timeframe: p.opensOn?.timeframe ?? null },
      alertsSound: p.alertsSound ?? true,
      clock: p.clock === 'ny' ? 'ny' : 'local',
    };
  } catch {
    return DEFAULT_DESK_PREFS;
  }
})();
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

/** A patch — `opensOn` may name only the name or only the timeframe */
export type DeskPrefsPatch = Partial<Omit<DeskPrefs, 'opensOn'>> & { opensOn?: Partial<DeskPrefs['opensOn']> };
export function setDeskPrefs(patch: DeskPrefsPatch): void {
  prefs = { ...prefs, ...patch, opensOn: { ...prefs.opensOn, ...(patch.opensOn ?? {}) } };
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* storage off — the choice lives for the session */
  }
  listeners.forEach(fn => fn());
}

/** For code outside React — a host's first render, the chart clock, the bell */
export const readDeskPrefs = (): DeskPrefs => prefs;
export const useDeskPrefs = (): DeskPrefs => useSyncExternalStore(subscribe, readDeskPrefs, () => DEFAULT_DESK_PREFS);
