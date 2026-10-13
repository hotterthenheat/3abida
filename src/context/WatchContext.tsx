/*
==================================================
  SLAYER TERMINAL - WATCH CONTEXT (the Trace bookmarks)

  One store for everything a reader bookmarks on
  the Trace pages (Noah, 2026-09-03: "a bookmark
  ability by each tape ticker like how live tape
  has it already… for the other subpages"). Until
  now the tape's star and the card's "Track this
  print" wrote to page-local sets that died on the
  next navigation, and the Tracker tab was a
  scaffold with nowhere to read from.

  Three kinds of thing get watched, because the
  pages deal in three units:
    print      one execution off the tape — the
               thing that printed, as it printed
    contract   a whole contract off a book page
               (Screener, Footprints, Watchers,
               Windows, or the card) — keyed by
               ticker · strike · right · expiry so
               it survives the day rolling over
    structure  a multi-leg trade off Multi-Leg

  Every item carries WHEN it was watched, WHERE
  from, and a snapshot of what it looked like then —
  the Tracker's whole job is "what has it done
  since", and that needs a then. Persisted.
==================================================
*/

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { BookContract, FlowPrint } from '../types/trace';
import type { SpreadTrade } from '../data/flowBook';
import { getFeedStatus } from '../data/feed/status';
import { roomSource } from '../data/feed/rooms';
import { nyText } from '../core/nyTime';

/** Which market a mark is made in: the feed's, when Trace reads it */
const srcNow = (): { src?: 'feed' } => (roomSource('trace', getFeedStatus()) === 'feed' ? { src: 'feed' } : {});

const STORAGE_KEY = 'slayer_trace_watch';

export type WatchKind = 'print' | 'contract' | 'structure';
export type WatchSource = 'tape' | 'screener' | 'footprints' | 'watchers' | 'windows' | 'multi-leg' | 'card';

interface WatchBase {
  key: string;
  kind: WatchKind;
  ticker: string;
  /** Epoch ms */
  watchedAt: number;
  from: WatchSource;
  /** Marked while Trace read the feed (2026-10-12) — its THEN is the vendor's market, measured only against the vendor's */
  src?: 'feed';
}

export interface WatchedContract extends WatchBase {
  kind: 'contract';
  strike: number;
  right: 'C' | 'P';
  /** MM/DD/YYYY */
  expiry: string;
  /** The contract's facts at the moment it was watched — the Tracker's "then" */
  at: { dte: number; spot: number; last: number; chgPct: number; volume: number; oi: number; premium: number; askPct: number };
}

export interface WatchedPrint extends WatchBase {
  kind: 'print';
  strike: number;
  right: 'C' | 'P';
  expiry: string;
  dte: number;
  time: string;
  size: number;
  fill: number;
  premium: number;
  side: 'ASK' | 'BID' | 'MID';
  sweep: boolean;
  /** The underlying and the contract's day when it printed */
  at: { spot: number; volume: number; oi: number };
}

export interface WatchedStructure extends WatchBase {
  kind: 'structure';
  spreadKind: string;
  strikesLabel: string;
  expiry: string;
  dte: number;
  time: string;
  size: number;
  /** Positive = debit paid, negative = credit collected */
  net: number;
  premium: number;
  at: { spot: number };
}

export type WatchedItem = WatchedContract | WatchedPrint | WatchedStructure;

// ---- keys and builders ---------------------------------------------------------

export const contractKey = (c: { ticker: string; strike: number; right: 'C' | 'P'; expiry: string }) =>
  `c:${c.ticker}:${c.strike}:${c.right}:${c.expiry}`;

/** A print's key is its CONTENT, not its tape id — ids restart with the
    session, the print itself does not. */
export const printKey = (p: Pick<FlowPrint, 'ticker' | 'strike' | 'right' | 'expiry' | 'time' | 'size' | 'fill'>) => `p:${p.ticker}:${p.strike}:${p.right}:${p.expiry}:${p.time}:${p.size}:${p.fill}`;

export const structureKey = (t: SpreadTrade) => `s:${t.ticker}:${t.id}`;

export const watchContract = (r: BookContract, from: WatchSource): WatchedContract => ({
  key: contractKey(r),
  kind: 'contract',
  ticker: r.ticker,
  strike: r.strike,
  right: r.right,
  expiry: r.expiry,
  watchedAt: Date.now(),
  from,
  ...srcNow(),
  at: { dte: r.dte, spot: r.spot, last: r.last, chgPct: r.chgPct, volume: r.volume, oi: r.oi, premium: r.premium, askPct: r.askPct },
});

export const watchPrint = (p: FlowPrint, from: WatchSource): WatchedPrint => ({
  key: printKey(p),
  kind: 'print',
  ticker: p.ticker,
  strike: p.strike,
  right: p.right,
  expiry: p.expiry,
  dte: p.dte,
  time: p.time,
  size: p.size,
  fill: p.fill,
  premium: p.premium,
  side: p.side,
  sweep: p.sweep,
  watchedAt: Date.now(),
  from,
  ...srcNow(),
  at: { spot: p.spot, volume: p.volume, oi: p.oi },
});

export const watchStructure = (t: SpreadTrade, from: WatchSource): WatchedStructure => ({
  key: structureKey(t),
  kind: 'structure',
  ticker: t.ticker,
  spreadKind: t.kind,
  strikesLabel: t.strikesLabel,
  expiry: t.expiry,
  dte: t.dte,
  time: t.time,
  size: t.size,
  net: t.net,
  premium: t.premium,
  watchedAt: Date.now(),
  from,
  ...srcNow(),
  at: { spot: t.spot },
});

// ---- storage -------------------------------------------------------------------

const KINDS = new Set<string>(['print', 'contract', 'structure']);

/** One malformed row must never take a page down — the Tracker's own rule. */
function isValid(v: unknown): v is WatchedItem {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.key === 'string' &&
    typeof o.kind === 'string' &&
    KINDS.has(o.kind) &&
    typeof o.ticker === 'string' &&
    typeof o.watchedAt === 'number' &&
    typeof o.from === 'string' &&
    typeof o.at === 'object' &&
    o.at !== null
  );
}

/** "2:50:12 pm" on the reader's clock, on the local day `watchedAt` fell on → New York's "14:50:12"; null when the text
    is already a New York clock text (or anything else) */
export function nyTextFromPrinted(text: string, watchedAt: number): string | null {
  const m = /^\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap])m\s*$/i.exec(text);
  if (!m) return null;
  const h12 = Number(m[1]) % 12;
  const h = m[4].toLowerCase() === 'p' ? h12 + 12 : h12;
  const d = new Date(watchedAt);
  const local = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, Number(m[2]), Number(m[3] ?? 0));
  if (Number.isNaN(local.getTime())) return null;
  return nyText(local.getTime(), { seconds: m[3] != null });
}

function load(): WatchedItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    const valid = parsed.filter(isValid);
    /* The Trace page "Flow Alerts" became Watchers on 2026-09-11 — a mark taken
       there before that day keeps its source under the new name */
    let renamed = 0;
    for (const it of valid) {
      if ((it.from as string) === 'flow-alerts') {
        it.from = 'watchers';
        renamed++;
      }
    }
    /* A print's `time` is New York's "HH:MM:SS" text. For half an hour on 2026-10-13 the tape wrote it as a printed
       time on the reader's clock ("2:50:12 pm"); a print tracked then is put back: the 12-hour time read on the
       reader's own clock on the day it was watched, written as New York's text, and its key rebuilt */
    let repaired = 0;
    for (const it of valid) {
      if (it.kind !== 'print' && it.kind !== 'structure') continue;
      const fixed = nyTextFromPrinted(it.time, it.watchedAt);
      if (fixed == null) continue;
      it.time = fixed;
      if (it.kind === 'print') it.key = printKey(it);
      repaired++;
    }
    if (valid.length !== parsed.length || renamed > 0 || repaired > 0) save(valid);
    return valid;
  } catch {
    return [];
  }
}

function save(items: WatchedItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* storage full or off — the session still works */
  }
}

// ---- the context ---------------------------------------------------------------

interface WatchValue {
  watched: WatchedItem[];
  isWatched: (key: string) => boolean;
  /** Add when absent, remove when present — the star's one gesture. */
  toggle: (item: WatchedItem) => void;
  unwatch: (key: string) => void;
}

const WatchContext = createContext<WatchValue | null>(null);

export const WatchProvider = ({ children }: { children: React.ReactNode }) => {
  const [watched, setWatched] = useState<WatchedItem[]>(load);
  const keys = useMemo(() => new Set(watched.map(w => w.key)), [watched]);

  const isWatched = useCallback((key: string) => keys.has(key), [keys]);
  const toggle = useCallback((item: WatchedItem) => {
    setWatched(prev => {
      const next = prev.some(w => w.key === item.key) ? prev.filter(w => w.key !== item.key) : [...prev, item];
      save(next);
      return next;
    });
  }, []);
  const unwatch = useCallback((key: string) => {
    setWatched(prev => {
      const next = prev.filter(w => w.key !== key);
      save(next);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ watched, isWatched, toggle, unwatch }), [watched, isWatched, toggle, unwatch]);
  return <WatchContext.Provider value={value}>{children}</WatchContext.Provider>;
};

export const useWatch = (): WatchValue => {
  const ctx = useContext(WatchContext);
  if (!ctx) throw new Error('useWatch must be used within a WatchProvider');
  return ctx;
};
