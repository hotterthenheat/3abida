/*
==================================================
  SLAYER TERMINAL - THE NAMES YOU FOLLOW ON THE WIRE
  (data/newsFollows.ts)

  Which tickers' news the reader follows, and which
  of them ring the bell (Noah, 2026-09-13: "you
  should be able to choose which tickers' news to
  follow, have alerts on for specific tickers").
  One store, read with useSyncExternalStore, the
  board-names store's shape, remembered in
  localStorage. Turning a name's alerts on arms the
  shell's own news alert for it (alertStore.armNews)
  so the bell rings the way every other alert does.
==================================================
*/

import { useSyncExternalStore } from 'react';
import { armNews, getAlerts, removeAlert } from '../components/gex/alertStore';
import { DEFAULT_BOARD_NAMES } from './boardNames';

const KEY = 'slayer_news_follows';

export interface NewsFollow {
  ticker: string;
  /** The bell rings on a new headline for the name */
  alerts: boolean;
}

const clean = (raw: unknown): NewsFollow[] | null => {
  if (!Array.isArray(raw)) return null;
  const out: NewsFollow[] = [];
  for (const v of raw) {
    if (!v || typeof v !== 'object') continue;
    const t = String((v as { ticker?: unknown }).ticker ?? '')
      .trim()
      .toUpperCase();
    if (!/^[A-Z.\-]{1,6}$/.test(t) || out.some(f => f.ticker === t)) continue;
    out.push({ ticker: t, alerts: Boolean((v as { alerts?: unknown }).alerts) });
  }
  return out;
};

function load(): NewsFollow[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const f = clean(JSON.parse(raw));
      if (f) return f;
    }
  } catch {
    /* no storage — the first three names on the board, the bell off */
  }
  return DEFAULT_BOARD_NAMES.slice(0, 3).map(ticker => ({ ticker, alerts: false }));
}

let current: NewsFollow[] = load();
const listeners = new Set<() => void>();
const commit = (next: NewsFollow[]) => {
  current = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage may be off — the list still lives for the session */
  }
  for (const l of listeners) l();
};
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

export const getFollows = (): NewsFollow[] => current;
export const useFollows = (): NewsFollow[] => useSyncExternalStore(subscribe, getFollows, getFollows);
export const isFollowed = (ticker: string): boolean => current.some(f => f.ticker === ticker.toUpperCase());

export function followName(symbol: string): void {
  const t = symbol.trim().toUpperCase();
  if (!t || current.some(f => f.ticker === t)) return;
  commit([...current, { ticker: t, alerts: false }]);
}

export function unfollowName(symbol: string): void {
  const t = symbol.trim().toUpperCase();
  if (!current.some(f => f.ticker === t)) return;
  setFollowAlerts(t, false);
  commit(current.filter(f => f.ticker !== t));
}

/** The bell for a name — on arms the shell's news alert, off disarms it */
export function setFollowAlerts(symbol: string, on: boolean): void {
  const t = symbol.trim().toUpperCase();
  if (on) armNews(t, Date.now());
  else for (const a of getAlerts(t)) if (a.kind === 'news') removeAlert(t, a.id);
  commit(current.map(f => (f.ticker === t ? { ...f, alerts: on } : f)));
}
