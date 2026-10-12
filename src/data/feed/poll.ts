/*
==================================================
  SLAYER TERMINAL - POLLING THE FEED (data/feed/poll.ts)

  NO SOCKET ON THESE PLANS (UW API Basic, Massive Basic),
  so a room polls — on the market store's terms
  (context/marketStore.ts): a reader subscribes to the
  KEY it reads and renders only when that key's answer
  moves, through useSyncExternalStore.

    · ONE POLL PER KEY: however many panels ask for
      "uw:flow-alerts:SPY", one timer runs, at the
      shortest period any of them asked for, and one
      request is in flight;
    · A HIDDEN TAB ASKS NOTHING: the timers stop when
      the tab hides, and a key whose answer went stale
      meanwhile is asked again as it comes back;
    · answers land once a frame, as the market store's
      ticks do;
    · the last answer is kept a minute after its last
      reader leaves, so a room opened again shows it at
      once while the next one comes.

  THE KEY NAMES EVERYTHING THE LOADER ASKS FOR (the name,
  the limit, the date): two readers with one key share
  one loader — the first one's.
==================================================
*/

import { useCallback, useRef, useSyncExternalStore } from 'react';
import type { FeedResult } from './client';

interface Entry {
  load: () => Promise<FeedResult<unknown>>;
  value: FeedResult<unknown> | null;
  /** When the last answer landed */
  at: number;
  periods: Map<number, number>;
  readers: Set<() => void>;
  timer: ReturnType<typeof setTimeout> | null;
  flying: boolean;
  dropTimer: ReturnType<typeof setTimeout> | null;
}

const entries = new Map<string, Entry>();
const KEEP_MS = 60 * 1000;
const MIN_PERIOD = 1000;

const hidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';

/* answers land once a frame */
const dirty = new Set<Entry>();
let frame = 0;
const flush = () => {
  frame = 0;
  const now = Array.from(dirty);
  dirty.clear();
  for (const e of now) for (const f of Array.from(e.readers)) f();
};
const notify = (e: Entry) => {
  dirty.add(e);
  if (frame) return;
  frame = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(flush) : (setTimeout(flush, 16) as unknown as number);
};

const periodOf = (e: Entry): number => Math.max(MIN_PERIOD, Math.min(...Array.from(e.periods.keys())));

function schedule(e: Entry) {
  if (e.timer) clearTimeout(e.timer);
  e.timer = null;
  if (e.periods.size === 0 || hidden()) return;
  const wait = e.at ? Math.max(0, e.at + periodOf(e) - Date.now()) : 0;
  e.timer = setTimeout(() => void run(e), wait);
}

async function run(e: Entry) {
  e.timer = null;
  if (e.flying || hidden() || e.periods.size === 0) return;
  e.flying = true;
  try {
    e.value = await e.load();
  } catch {
    e.value = { ok: false, reason: 'shape', status: 0 };
  }
  e.at = Date.now();
  e.flying = false;
  notify(e);
  schedule(e);
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    for (const e of entries.values()) {
      if (hidden()) {
        if (e.timer) clearTimeout(e.timer);
        e.timer = null;
      } else schedule(e);
    }
  });
}

function join(key: string, load: () => Promise<FeedResult<unknown>>, period: number, reader: () => void): () => void {
  let e = entries.get(key);
  if (!e) {
    e = { load, value: null, at: 0, periods: new Map(), readers: new Set(), timer: null, flying: false, dropTimer: null };
    entries.set(key, e);
  }
  const entry = e;
  if (entry.dropTimer) clearTimeout(entry.dropTimer);
  entry.dropTimer = null;
  entry.readers.add(reader);
  entry.periods.set(period, (entry.periods.get(period) ?? 0) + 1);
  schedule(entry);
  return () => {
    entry.readers.delete(reader);
    const n = (entry.periods.get(period) ?? 1) - 1;
    if (n <= 0) entry.periods.delete(period);
    else entry.periods.set(period, n);
    if (entry.periods.size === 0) {
      if (entry.timer) clearTimeout(entry.timer);
      entry.timer = null;
      entry.dropTimer = setTimeout(() => {
        if (entry.periods.size === 0) entries.delete(key);
      }, KEEP_MS);
    } else schedule(entry);
  };
}

/**
 * Poll a feed call every `periodMs` while mounted and the tab is visible; the latest answer, or null before the first.
 * A null `key` asks nothing — how a room that is not reading the feed stays off it.
 */
export function useFeedPoll<T>(key: string | null, load: () => Promise<FeedResult<T>>, periodMs: number): FeedResult<T> | null {
  const loadRef = useRef(load);
  loadRef.current = load;
  const subscribe = useCallback(
    (reader: () => void) => (key ? join(key, () => loadRef.current(), periodMs, reader) : () => {}),
    [key, periodMs]
  );
  const read = useCallback(() => (key ? ((entries.get(key)?.value ?? null) as FeedResult<T> | null) : null), [key]);
  return useSyncExternalStore(subscribe, read, read);
}

/** Ask a key again now, whoever polls it (a reader's "refresh") */
export function refreshFeed(key: string): void {
  const e = entries.get(key);
  if (e && !e.flying) void run(e);
}
