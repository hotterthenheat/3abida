/*
==================================================
  SLAYER TERMINAL - THE TILES IN THE PAGE (src/data/feed/tileClient.ts)

  2026-10-15 — the owner's Section I: "Load by visible range plus a buffer; never load a whole history into the page
  … Prefetch the adjacent range and recently viewed tickers."

  The sessions before today come to Terrain as the server folded them (server/fieldTiles.ts, src/data/feed/tiles.ts):
  each session's columns at the field's texture and its bars at the chart's timeframe, through the pane's expiry
  window. Asked by range — the sessions the chart shows and a buffer — kept raw (the parsed tile, numbers in arrays)
  and decoded to the chart's shapes only for the timeframe and window drawn, so a page that has visited a week at five
  timeframes and four windows holds arrays, not hundreds of thousands of objects. A range already in hand answers at
  once; the rest are asked in one call a range. A session the server is still building is said as such and asked
  again; a server that has no tiles route (an always-on recorder on older code) says `unavailable`, and the page reads
  the sessions the way it did before.

  One store for the page (subscribe and a version, for useSyncExternalStore).
==================================================
*/
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { Candle, GexSnapshot } from '../../types/market';
import { feedFetch } from './client';
import { decodeBar, decodeColumn, type Tile, type TileBars, type TileTf } from './tiles';
import type { ExpiryWindow } from './trailModel';

export interface TileDay {
  day: string;
  cols: GexSnapshot[];
  bars: Candle[];
  maxima: Tile['maxima'];
  events: Tile['events'];
}

interface RangeAnswer {
  days: { day: string; tile: Tile; bars: TileBars }[];
  building: string[];
  queued: string[];
  working: string | null;
  failed: Record<string, string>;
  none: string[];
}

/* the raw tiles, a key a session: name|tf|window|day — at most RAW_MAX, the oldest asked dropped first */
const RAW_MAX = 1600;
const raw = new Map<string, { tile: Tile; bars: TileBars }>();
/* the decoded sessions for what is drawn — at most DECODED_MAX */
const DECODED_MAX = 240;
const decoded = new Map<string, TileDay>();
/* what the server said of a session not in hand: building, queued, failed (why), none */
const said = new Map<string, { building: boolean; queued: boolean; failed: string | null; none: boolean; at: number }>();
/** A session the server had nothing to tile from is asked again after this long (it may have been rebuilt since) */
const NONE_AGAIN_MS = 30_000;
const waiting = (s: { building: boolean; none: boolean; at: number } | null): boolean => !!s && (s.building || (s.none && Date.now() - s.at > NONE_AGAIN_MS));
const settledNone = (s: { none: boolean; at: number } | null): boolean => !!s && s.none && Date.now() - s.at <= NONE_AGAIN_MS;
let unavailable = false;
let version = 0;
const listeners = new Set<() => void>();
const bump = () => {
  version++;
  for (const l of listeners) l();
};
export const tilesSubscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const tilesVersion = () => version;
/** The server answers no tiles (an older recorder): the page reads the sessions as it did */
export const tilesUnavailable = () => unavailable;

const keyOf = (name: string, tf: TileTf, w: ExpiryWindow, day: string) => `${name}|${tf}|${w}|${day}`;
const touch = <V>(m: Map<string, V>, k: string, v: V, max: number) => {
  m.delete(k);
  m.set(k, v);
  while (m.size > max) m.delete(m.keys().next().value as string);
};

const inFlight = new Map<string, Promise<void>>();
/** Ask the server for the sessions in [from, to] at a timeframe through a window — one call, the answer kept raw */
export function loadTileRange(name: string, tf: TileTf, w: ExpiryWindow, from: string, to: string): Promise<void> {
  const t = name.toUpperCase();
  const url = `/feed/field/${t}/tiles?tf=${tf}&w=${w}&from=${from}&to=${to}`;
  const had = inFlight.get(url);
  if (had) return had;
  const run = (async () => {
    const r = await feedFetch(url);
    if (!r.ok) {
      if (r.status === 404 || r.reason === 'absent') {
        if (!unavailable) {
          unavailable = true;
          bump();
        }
      }
      return;
    }
    if (unavailable) unavailable = false;
    const a = r.data as RangeAnswer;
    for (const d of a.days) {
      touch(raw, keyOf(t, tf, w, d.day), { tile: d.tile, bars: d.bars }, RAW_MAX);
      said.delete(keyOf(t, tf, w, d.day));
    }
    const queued = new Set(a.queued);
    const at = Date.now();
    for (const d of a.building) said.set(keyOf(t, tf, w, d), { building: true, queued: queued.has(d), failed: a.failed[d] ?? null, none: false, at });
    for (const d of a.none) said.set(keyOf(t, tf, w, d), { building: false, queued: false, failed: null, none: true, at });
    bump();
  })();
  inFlight.set(url, run);
  void run.finally(() => inFlight.delete(url));
  return run;
}

/** A session at a timeframe through a window, in the chart's shapes — decoded once, kept while it is drawn */
export function tileDay(name: string, tf: TileTf, w: ExpiryWindow, day: string): TileDay | null {
  const k = keyOf(name.toUpperCase(), tf, w, day);
  const had = decoded.get(k);
  if (had) return had;
  const r = raw.get(k);
  if (!r) return null;
  const out: TileDay = { day, cols: r.tile.cols.map(decodeColumn), bars: r.bars.bars.map(decodeBar), maxima: r.tile.maxima, events: r.tile.events ?? [] };
  touch(decoded, k, out, DECODED_MAX);
  return out;
}
export const tileHeld = (name: string, tf: TileTf, w: ExpiryWindow, day: string) => raw.has(keyOf(name.toUpperCase(), tf, w, day));
export const tileSaid = (name: string, tf: TileTf, w: ExpiryWindow, day: string) => said.get(keyOf(name.toUpperCase(), tf, w, day)) ?? null;

/* ---- every tiled session's day bar (1D and 1W over the whole history: 3,528 bars for fourteen years) ---------- */
const daily = new Map<string, { days: string[]; pending: string[]; bars: Candle[]; at: number }>();
export async function loadTileDaily(name: string): Promise<void> {
  const t = name.toUpperCase();
  const url = `/feed/field/${t}/tiles/days`;
  const had = inFlight.get(url);
  if (had) return had;
  const run = (async () => {
    const r = await feedFetch(url);
    if (!r.ok) return;
    const a = r.data as { days: string[]; pending?: string[]; bars: [number, number, number, number, number, number][] };
    daily.set(t, { days: a.days, pending: a.pending ?? [], bars: a.bars.map(decodeBar), at: Date.now() });
    bump();
  })();
  inFlight.set(url, run);
  void run.finally(() => inFlight.delete(url));
  return run;
}
export const tileDaily = (name: string) => daily.get(name.toUpperCase()) ?? null;

/** The sessions the server has tiled for a name (off the daily list), ascending — null before it is known */
export const tiledDays = (name: string): string[] | null => daily.get(name.toUpperCase())?.days ?? null;

/* ---- the hook ------------------------------------------------------------------------------------------------- */
const BUILDING_POLL_MS = 3000;
/** Contiguous runs of the days still to ask, as [from, to] ranges */
function runsOf(days: readonly string[]): [string, string][] {
  const out: [string, string][] = [];
  const sorted = [...days].sort();
  let start: string | null = null;
  let prev: string | null = null;
  for (const d of sorted) {
    if (start == null) start = d;
    else if (prev && Date.parse(`${d}T12:00:00Z`) - Date.parse(`${prev}T12:00:00Z`) > 4 * 86_400_000) {
      out.push([start, prev]);
      start = d;
    }
    prev = d;
  }
  if (start && prev) out.push([start, prev]);
  return out;
}

/**
 * The sessions `days` at timeframe `tf` through window `w`, asked when not in hand and again while the server builds
 * them; `also` are asked behind them (the adjacent range, the other timeframes and windows — prefetch), never waited on.
 */
export function useTileSessions(on: boolean, name: string, tf: TileTf, w: ExpiryWindow, days: readonly string[], also: readonly { tf: TileTf; w: ExpiryWindow; days: readonly string[] }[] = []): { version: number; unavailable: boolean } {
  const v = useSyncExternalStore(tilesSubscribe, tilesVersion, tilesVersion);
  const t = name.toUpperCase();
  const daysKey = days.join(',');
  const alsoKey = also.map(a => `${a.tf}:${a.w}:${a.days.join(',')}`).join(';');
  useEffect(() => {
    if (!on || !t || !days.length) return;
    let gone = false;
    const missing = () => days.filter(d => !tileHeld(t, tf, w, d) && !settledNone(tileSaid(t, tf, w, d)));
    const ask = async () => {
      const want = missing();
      for (const [a, b] of runsOf(want)) await loadTileRange(t, tf, w, a, b);
      if (gone) return;
      /* behind the view: the adjacent range, the other timeframes and windows — one at a time, the view's first */
      for (const x of also) {
        const rest = x.days.filter(d => !tileHeld(t, x.tf, x.w, d) && !settledNone(tileSaid(t, x.tf, x.w, d)));
        for (const [a, b] of runsOf(rest)) {
          if (gone) return;
          await loadTileRange(t, x.tf, x.w, a, b);
        }
      }
    };
    void ask();
    /* sessions the server is still building, or had nothing for a while ago: asked again until they stand */
    const id = window.setInterval(() => {
      if (days.some(d => waiting(tileSaid(t, tf, w, d)))) {
        void loadTileDaily(t);
        void ask();
      }
    }, BUILDING_POLL_MS);
    return () => {
      gone = true;
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, t, tf, w, daysKey, alsoKey]);
  return useMemo(() => ({ version: v, unavailable }), [v]);
}

/** Every tiled session's day bar for a name, asked once a visit and again after a minute */
export function useTileDaily(on: boolean, name: string): { days: string[]; pending: string[]; bars: Candle[] } | null {
  const v = useSyncExternalStore(tilesSubscribe, tilesVersion, tilesVersion);
  const t = name.toUpperCase();
  useEffect(() => {
    if (!on || !t) return;
    const d = daily.get(t);
    if (!d || Date.now() - d.at > 60_000) void loadTileDaily(t);
  }, [on, t, v]);
  return on ? daily.get(t) ?? null : null;
}
