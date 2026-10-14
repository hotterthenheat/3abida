/*
==================================================
  SLAYER TERMINAL - THE SESSION RECAPS IN THE JOURNAL (data/review/recaps.ts)

  The owner's item 9 ("Post it to the Journal room"): a
  session's recap, posted once the session is over by the
  shell's watcher (components/review/RecapWatcher.tsx),
  read by the Journal's day (components/review/
  SessionRecap.tsx) and its month's marks. Kept on this
  machine:
    · the figures, the alerts and the picture's size —
      slayer_journal_recaps, the newest sixty sessions;
    · the picture itself — a PNG a recap in IndexedDB
      (slayer_recaps · pictures), too large for the small
      store; without IndexedDB it lives for the visit.
  A recap whose figures change on the server (the official
  close kept, the session rebuilt) is posted again under
  its new version; its picture is taken again only when
  what it draws changed.
==================================================
*/

import { useEffect, useState, useSyncExternalStore } from 'react';
import type { SessionRecap } from '../feed/sessionRecap';

/** An alert that fired in the session, with what followed it */
export interface RecapAlert {
  key: string;
  /** 'level' a level alert (data/levelAlerts.ts), 'alert' one of the house's alerts (components/gex/alertStore.ts) */
  kind: 'level' | 'alert';
  at: number;
  tier: 1 | 2 | 3 | null;
  words: string;
  /** The price when it fired */
  spot: number | null;
  stale?: boolean;
  capped?: boolean;
  /** +15 and +30 minutes: the close then, the points (toward the side for a level), held — a touch back on the side it
      came from, a cross still beyond (the track record's rule); null for a horizon past the session */
  out: ({ h: number; close: number; points: number; held: boolean | null } | null)[];
}
/** A posted recap: the server's figures (its bars and quantiles left behind), the alerts, the picture's size */
export interface PostedRecap {
  key: string;
  name: string;
  day: string;
  version: string;
  /** What the picture was taken on (SessionRecap chartKey); null without a picture */
  chartKey: string | null;
  postedAt: number;
  /** When the version on show was posted — a notice stands for a few seconds after */
  updatedAt: number;
  recap: Omit<SessionRecap, 'bars'>;
  alerts: RecapAlert[];
  picture: { w: number; h: number } | null;
}

const KEY = 'slayer_journal_recaps';
const KEEP = 60;
const subs = new Set<() => void>();
let cache: Record<string, PostedRecap> | null = null;
let version = 0;
const ring = () => {
  version++;
  subs.forEach(f => f());
};
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => subs.delete(f);
};

export const recapKey = (name: string, day: string) => `${name.toUpperCase()}:${day}`;

export function postedRecaps(): Record<string, PostedRecap> {
  if (!cache) {
    cache = {};
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
      const parsed = raw ? (JSON.parse(raw) as Record<string, PostedRecap>) : {};
      for (const [k, v] of Object.entries(parsed)) if (v && typeof v.version === 'string' && typeof v.day === 'string' && v.recap) cache[k] = v;
    } catch {
      /* no storage, or a store from another version — start empty */
    }
  }
  return cache;
}
function save(all: Record<string, PostedRecap>): void {
  /* the newest sixty sessions stay */
  const keep = Object.values(all)
    .sort((a, b) => b.day.localeCompare(a.day) || a.name.localeCompare(b.name))
    .slice(0, KEEP);
  const next: Record<string, PostedRecap> = {};
  for (const r of keep) next[r.key] = r;
  for (const k of Object.keys(all)) if (!next[k]) void dropPicture(k);
  cache = next;
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage full or off — the visit keeps it */
  }
  ring();
}
/** Post a recap (or its new version) to the Journal */
export function postRecap(p: Omit<PostedRecap, 'postedAt' | 'updatedAt'>, now = Date.now()): PostedRecap {
  const had = postedRecaps()[p.key];
  const posted: PostedRecap = { ...p, postedAt: had?.postedAt ?? now, updatedAt: now };
  save({ ...postedRecaps(), [p.key]: posted });
  return posted;
}

export function usePostedRecaps(): Record<string, PostedRecap> {
  useSyncExternalStore(subscribe, () => version);
  return postedRecaps();
}
/** A day's recaps, one a name, by name */
export function useDayRecaps(day: string): PostedRecap[] {
  const all = usePostedRecaps();
  return Object.values(all)
    .filter(r => r.day === day)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/* ---- THE PICTURES, in IndexedDB ------------------------------------------------------------------------------------ */

const DB = 'slayer_recaps';
const STORE = 'pictures';
const memory = new Map<string, Blob>();
let dbOpen: Promise<IDBDatabase | null> | null = null;
function db(): Promise<IDBDatabase | null> {
  if (dbOpen) return dbOpen;
  dbOpen = new Promise(resolve => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbOpen;
}
const pictureVersion = new Map<string, number>();
export async function putPicture(key: string, blob: Blob): Promise<void> {
  memory.set(key, blob);
  pictureVersion.set(key, (pictureVersion.get(key) ?? 0) + 1);
  const d = await db();
  if (d)
    await new Promise<void>(resolve => {
      try {
        const tx = d.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(blob, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
        tx.onabort = () => resolve();
      } catch {
        resolve();
      }
    });
  ring();
}
export async function getPicture(key: string): Promise<Blob | null> {
  const m = memory.get(key);
  if (m) return m;
  const d = await db();
  if (!d) return null;
  return new Promise(resolve => {
    try {
      const req = d.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result instanceof Blob ? req.result : null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}
async function dropPicture(key: string): Promise<void> {
  memory.delete(key);
  const d = await db();
  if (!d) return;
  try {
    d.transaction(STORE, 'readwrite').objectStore(STORE).delete(key);
  } catch {
    /* gone already */
  }
}
/** A posted recap's picture as an address the page can show — let go when the reader moves on */
export function useRecapPicture(key: string, chartKey: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  const tick = useSyncExternalStore(subscribe, () => pictureVersion.get(key) ?? 0);
  useEffect(() => {
    if (!chartKey) {
      setUrl(null);
      return;
    }
    let live = true;
    let made: string | null = null;
    void getPicture(key).then(b => {
      if (!live || !b) return;
      made = URL.createObjectURL(b);
      setUrl(made);
    });
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [key, chartKey, tick]);
  return url;
}
