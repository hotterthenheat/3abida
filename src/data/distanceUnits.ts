import { useSyncExternalStore } from 'react';
import { DISTANCE_UNITS, type DistanceUnit } from './atr';

/*
  THE DESK-WIDE UNIT — T-19's toggle, one store for every surface.

  The directive's point is that the surfaces SWITCH TOGETHER: a distance in
  ATR on the flip strip and in dollars on the measure box would be two desks
  wearing one skin. So the unit lives here — the candleTheme pattern, a
  module-level store with a reactive hook — and every renderer of a distance
  reads this one value. Persisted, because a reader who thinks in ATR thinks
  in ATR tomorrow too.
*/

const STORAGE_KEY = 'slayer_distance_unit';

function loadUnit(): DistanceUnit {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && (DISTANCE_UNITS as string[]).includes(raw)) return raw as DistanceUnit;
  } catch {
    /* storage blocked — session default */
  }
  return '$';
}

let current: DistanceUnit = loadUnit();
const listeners = new Set<() => void>();

export function getDistanceUnit(): DistanceUnit {
  return current;
}

export function setDistanceUnit(unit: DistanceUnit): void {
  if (unit === current) return;
  current = unit;
  try {
    localStorage.setItem(STORAGE_KEY, unit);
  } catch {
    /* non-fatal */
  }
  listeners.forEach(fn => fn());
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Reactive unit — every distance on the desk re-words in place. */
export function useDistanceUnit(): DistanceUnit {
  return useSyncExternalStore(subscribe, getDistanceUnit, getDistanceUnit);
}
