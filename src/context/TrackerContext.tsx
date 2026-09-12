/*
==================================================
  SLAYER TERMINAL - TRACKER CONTEXT
  Manages bookmarked setups with localStorage
  persistence. Provides track/untrack/isTracked
  to the entire app.
==================================================
*/

import React, { createContext, useContext, useState, useCallback } from 'react';
import type { TrackedSetup } from '../types/tracker';
import { SCANNERS, type Setup, type ScannerKey } from '../types/compass';

const STORAGE_KEY = 'slayer_tracked_setups';

/** Entries written by older builds can miss fields newer code dereferences
    (strike/right landed after launch) — one malformed row must never be able
    to take the Tracker page down. */
function isValidTracked(t: unknown): t is TrackedSetup {
  if (typeof t !== 'object' || t === null) return false;
  const s = t as Record<string, unknown>;
  return (
    typeof s.id === 'string' &&
    typeof s.ticker === 'string' &&
    typeof s.contract === 'string' &&
    typeof s.strike === 'number' &&
    (s.right === 'C' || s.right === 'P') &&
    // Must be a scanner this build actually knows — stale keys crash builders
    SCANNERS.some(sc => sc.key === s.scanner) &&
    typeof s.trackedAt === 'number'
  );
}

function loadFromStorage(): TrackedSetup[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    const valid = parsed.filter(isValidTracked);
    // Persist the cleaned list so stale rows don't resurface
    if (valid.length !== parsed.length) saveToStorage(valid);
    return valid;
  } catch {
    return [];
  }
}

function saveToStorage(setups: TrackedSetup[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(setups));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

interface TrackerContextValue {
  trackedSetups: TrackedSetup[];
  trackSetup: (setup: Setup, scanner: ScannerKey) => void;
  untrackSetup: (id: string) => void;
  isTracked: (id: string) => boolean;
}

const TrackerContext = createContext<TrackerContextValue | null>(null);

export const TrackerProvider = ({ children }: { children: React.ReactNode }) => {
  const [trackedSetups, setTrackedSetups] = useState<TrackedSetup[]>(loadFromStorage);

  const trackSetup = useCallback((setup: Setup, scanner: ScannerKey) => {
    setTrackedSetups(prev => {
      if (prev.some(t => t.id === setup.id)) return prev; // already tracked
      const next = [
        ...prev,
        {
          id: setup.id,
          contract: setup.contract,
          ticker: setup.ticker,
          strike: setup.strike,
          right: setup.right,
          scanner,
          sleeve: setup.sleeve,
          trackedAt: Date.now(),
          scoreAtTrack: setup.score,
          verdictAtTrack: setup.verdict,
        },
      ];
      saveToStorage(next);
      return next;
    });
  }, []);

  const untrackSetup = useCallback((id: string) => {
    setTrackedSetups(prev => {
      const next = prev.filter(t => t.id !== id);
      saveToStorage(next);
      return next;
    });
  }, []);

  const isTracked = useCallback(
    (id: string) => trackedSetups.some(t => t.id === id),
    [trackedSetups]
  );

  return (
    <TrackerContext.Provider value={{ trackedSetups, trackSetup, untrackSetup, isTracked }}>
      {children}
    </TrackerContext.Provider>
  );
};

export const useTracker = (): TrackerContextValue => {
  const context = useContext(TrackerContext);
  if (!context) {
    throw new Error('useTracker must be used within a TrackerProvider');
  }
  return context;
};
