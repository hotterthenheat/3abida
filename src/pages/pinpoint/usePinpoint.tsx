/*
==================================================
  SLAYER TERMINAL - THE PAGES' COMMON PARTS
  (pages/pinpoint/usePinpoint.tsx)

  Every Pinpoint page read the market the same four
  ways, each with its own copy: a clock re-read every
  15 s, a scan of the frame's name every 10 s, boxes
  that can each step onto their own name, and a
  strike window. The copies drifted — each page's
  scan ten seconds out of step with the next, three
  windows with three names and three defaults (the
  audit's X1 and PP-20, 2026-10-09). They live here
  once, and the scan is the room's (data/
  pinpointBook.ts): two pages open within the same
  ten seconds read the same snapshot.
==================================================
*/

import { useCallback, useEffect, useMemo, useState } from 'react';
import Simulator from '../../core/simulator';
import { changeTicker, useActiveTicker } from '../../context/MarketDataContext';
import { useMarketBackground } from '../../context/marketStore';
import { useFocus } from '../../context/FocusContext';
import LiveScopeChip from '../../components/link/LiveScopeChip';
import { aheadClock, type AheadClock } from '../../data/ahead';
import { readSessionClock } from '../../data/sessionClock';
import { ROOM_WINDOW_REST, ROOM_WINDOWS, scanOf, SCAN_MS, type RoomWindow, type Scan } from '../../data/pinpointBook';
import { nyClock } from '../../core/nyTime';
import type { MarketSnapshot } from '../../types/market';

/** New York's clock as the odds read it — re-read every 15 s */
export function useBookClock(): AheadClock {
  const [raw, setRaw] = useState(() => readSessionClock());
  useEffect(() => {
    const id = window.setInterval(() => setRaw(readSessionClock()), 15_000);
    return () => window.clearInterval(id);
  }, []);
  return useMemo(() => aheadClock(raw), [raw]);
}

/** The frame's name on the room's scan — the same snapshot every page reads within the ten seconds */
export function useFrameScan(): Scan | null {
  /* read off the store (context/marketStore.ts): a page renders when the scan turns, not on every tick inside it */
  return useMarketBackground(s => (s.snapshot ? scanOf(s.snapshot.ticker, s.snapshot) : null));
}

/** "updated 14:03:42 ET" — the scan's stamp, New York's clock */
export const stampOf = (at: number) => nyClock(at, { seconds: true, zone: true });

/* EACH BOX CAN HOLD ITS OWN NAME (Noah, 2026-09-06): a box follows the frame
   until its chip unlinks it. Held per page across route changes in a session,
   reset on reload, so every visit starts as one. */
const scopeMemory = new Map<string, Record<string, string>>();

export interface Boxes<K extends string> {
  /** The name a box reads */
  tickerFor: (key: K) => string;
  /** The snapshot a box reads: the frame's scan, or its own name's scan */
  snapFor: (key: K) => MarketSnapshot | null;
  /** The box's chip: follows the terminal, or holds its own name */
  chipFor: (key: K, t?: string) => JSX.Element;
  /** The shared strike, when it belongs to this name */
  focusFor: (t: string) => number | null;
  /** True while a box holds its own name */
  own: (key: K) => boolean;
}

export function useBoxes<K extends string>(page: string, scan: Scan | null): Boxes<K> {
  const activeTicker = useActiveTicker();
  const { focus } = useFocus();
  const [scopes, setScopes] = useState<Record<string, string>>(() => scopeMemory.get(page) ?? {});
  const setScope = useCallback(
    (key: K, t: string | undefined) =>
      setScopes(prev => {
        const next = { ...prev };
        if (t === undefined) delete next[key];
        else next[key] = t;
        scopeMemory.set(page, next);
        return next;
      }),
    [page]
  );
  /* An own name's scan is taken on the frame's cadence, from the room's shared scans */
  const ownKey = Object.values(scopes).sort().join('|');
  const ownSnaps = useMemo(() => {
    const m = new Map<string, MarketSnapshot>();
    if (!scan || !ownKey) return m;
    for (const t of new Set(ownKey.split('|'))) {
      if (t === scan.snap.ticker) continue;
      const s = scanOf(t);
      if (s) m.set(t, s.snap);
    }
    return m;
  }, [scan, ownKey]);
  const tickerFor = (key: K) => scopes[key] ?? activeTicker;
  const snapFor = (key: K): MarketSnapshot | null => {
    if (!scan) return null;
    const t = scopes[key];
    if (!t || t === scan.snap.ticker) return scan.snap;
    return ownSnaps.get(t) ?? scan.snap;
  };
  const chipFor = (key: K, t = tickerFor(key)) => (
    <LiveScopeChip
      ticker={t}
      linked={scopes[key] === undefined}
      quote
      onToggleLink={() => setScope(key, scopes[key] === undefined ? t : undefined)}
      onPick={next => (scopes[key] === undefined ? changeTicker(next) : setScope(key, next))}
    />
  );
  const focusFor = (t: string) => (focus && focus.ticker === t ? focus.price : null);
  return { tickerFor, snapFor, chipFor, focusFor, own: key => scopes[key] !== undefined };
}

/* ---- THE STRIKES CONTROL, ONE FOR THE ROOM (the audit's PP-20; the choices are data/pinpointBook.ts's) -------- */

const ROOM_WINDOW_KEY = 'slayer_pinpoint_strikes';
const readRoomWindow = (): RoomWindow => {
  try {
    const v = Number(localStorage.getItem(ROOM_WINDOW_KEY));
    return (ROOM_WINDOWS as number[]).includes(v) ? (v as RoomWindow) : ROOM_WINDOW_REST;
  } catch {
    return ROOM_WINDOW_REST;
  }
};
let roomWindow: RoomWindow | null = null;
const listeners = new Set<(w: RoomWindow) => void>();

/** The room's strike window — what every page draws, remembered on this machine */
export function useRoomWindow(): [RoomWindow, (w: RoomWindow) => void] {
  const [w, setW] = useState<RoomWindow>(() => (roomWindow ??= readRoomWindow()));
  useEffect(() => {
    listeners.add(setW);
    return () => {
      listeners.delete(setW);
    };
  }, []);
  const set = useCallback((next: RoomWindow) => {
    roomWindow = next;
    try {
      localStorage.setItem(ROOM_WINDOW_KEY, String(next));
    } catch {
      /* storage off — the pick lives for the session */
    }
    listeners.forEach(fn => fn(next));
  }, []);
  return [w, set];
}

/** A name's scan is warm once the simulator has its history — the Board waits a name at a time for the rest */
export const isWarm = (t: string) => Simulator.isSeeded(t);
export { SCAN_MS };
