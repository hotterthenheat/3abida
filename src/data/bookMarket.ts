/*
==================================================
  SLAYER TERMINAL - THE MARKET THE BOOK READS
  (data/bookMarket.ts)

  THE UI IS THE OWNER'S; THE FEED FILLS IT (2026-10-
  12). Pinpoint's pages, and every engine under them
  (the profile, the calendar, the build, the wall
  model, the odds, the range, the close, the
  schedule, the clock, the records, the timeline),
  read a name's market through this one seam and
  never through the simulator by name:

    the bars       a name's minute bars, the regular
                   sessions on hand, oldest first
    the history    the book by strike through time
    the build      open interest through the session
    the name       its price, its implied vol, its
                   strike step, its day's change
    the snapshot   the chain the profile is built on

  'house' is the simulator, exactly as the pages read
  it before. 'feed' is Unusual Whales' answers
  (data/feed/pinpointMarket.ts registers it), set by
  Pinpoint's frame while its room reads the feed —
  the same engines then run on the vendor's figures,
  and nothing of the house's is read beside them.
  One room is on screen at a time, so one market is.
==================================================
*/

import { useSyncExternalStore } from 'react';
import Simulator from '../core/simulator';
import type { Candle, GexSnapshot, MarketSnapshot, StrikeNode } from '../types/market';
import type { ExposureProfileData } from '../types/gex';
import type { ExposureSurface } from './exposureSurface';

export type BookSource = 'house' | 'feed';

/** What a name is, as the engines ask it */
export interface NameCfg {
  currentPrice: number;
  /** Annualized implied vol, a fraction */
  iv: number;
  /** The strike step near the price */
  step: number;
}

/** One minute of the dealers' whole book — the timeline's own point, where the market keeps it outside the history */
export interface BookMinute {
  /** Epoch seconds */
  time: number;
  spot: number;
  /** The whole book's net gamma, the house's sign */
  netGex: number;
}

export interface BookMarket {
  readonly src: BookSource;
  /** Minute bars, the regular sessions on hand, oldest first — null before any (never seeds) */
  peekCandles(t: string): Candle[] | null;
  /** The same — the house seeds a name it has not walked */
  getCandles(t: string): Candle[];
  /** The book by strike through time, oldest first */
  getGexHistory(t: string): GexSnapshot[];
  /** Open interest by strike through the session — what Building measures what was added against */
  oiHistory(t: string): GexSnapshot[];
  cfg(t: string): NameCfg | undefined;
  /** The day's change in percent — NaN where no answer carries it */
  dayChangePct(t: string): number;
  /** A name's snapshot — null while it has not come */
  snapshotFor(t: string): MarketSnapshot | null;
  /** True once a name's history is on hand */
  isSeeded(t: string): boolean;
  /** The bars the ATR is read on — sessions, oldest first (the house folds its minute bars) */
  atrBars(t: string): Candle[];
  /** The session's dealer book minute by minute, where the market keeps it apart from the history — null to read it
      off the history (the house keeps a book a bar) */
  bookMinutes(t: string): BookMinute[] | null;
  /** What a level stands on, in the vendor's words — null for the house's own line (data/levelSureness.ts) */
  freshness?(t: string): string | null;
  /** A read that needs the sessions before today (the range's record, the levels' record, the overnight change) asks
      for them — the feed fetches them only then */
  deep?(t: string): void;
  /** Max pain for the nearest listed date, the vendor's own — null where none is listed */
  maxPain?(t: string): number | null;
  /** A feed snapshot's calendar — the vendor's own dates (the house builds its calendar in data/exposureSurface.ts) */
  surfaceOf?(snap: MarketSnapshot, profile: ExposureProfileData): ExposureSurface | null;
  /** A feed snapshot's chain on one listed date — the first listed on or after it, or (`exact`) that day's alone; empty
      when none is listed, null while it comes */
  lensChain?(snap: MarketSnapshot, date: Date, exact?: boolean): StrikeNode[] | null;
  /** Told when an answer lands (the feed) — the house's reads move with the market store instead */
  subscribe?(fn: () => void): () => void;
  version?(): number;
}

/* ---- the house: the simulator, exactly as before ----------------------------------------------------------------- */

const HOUSE: BookMarket = {
  src: 'house',
  peekCandles: t => Simulator.peekCandles(t),
  getCandles: t => Simulator.getCandles(t),
  getGexHistory: t => Simulator.getGexHistory(t) ?? [],
  oiHistory: t => Simulator.getGexHistory(t) ?? [],
  cfg: t => Simulator.TICKERS[t.toUpperCase()],
  dayChangePct: t => Simulator.dayChangePct(Simulator.ensureTicker(t)),
  snapshotFor: t => {
    try {
      return Simulator.snapshotFor(t);
    } catch {
      return null;
    }
  },
  isSeeded: t => Simulator.isSeeded(t),
  atrBars: t => Simulator.getCandles(t) ?? [],
  bookMinutes: () => null,
};

/* ---- the switch -------------------------------------------------------------------------------------------------- */

let feed: BookMarket | null = null;
let feedOn: (() => boolean) | null = null;
const subs = new Set<() => void>();

/** The feed's market and when it is the one read — registered by data/feed/pinpointMarket.ts (kept apart so the
    engines never import the feed). `on` reads the page's address and the room's standing at the call, so a page of
    another room — rendered before Pinpoint's frame has gone — never reads the feed's book. */
export function registerFeedMarket(m: BookMarket, on: () => boolean, onChange: (fn: () => void) => () => void): void {
  feed = m;
  feedOn = on;
  onChange(() => subs.forEach(fn => fn()));
}

/** The market every engine reads now */
export const bookMarket = (): BookMarket => (feed && feedOn?.() ? feed : HOUSE);
/** The house's market whatever is read — for a surface that is the house's by its nature */
export const houseMarket = (): BookMarket => HOUSE;
/** The feed's market, whatever is read — what a feed snapshot's own calendar and lenses are read through */
export const feedMarket = (): BookMarket | null => feed;

/** True when a snapshot was built from the vendor's answers */
export const isFeedSnap = (s: MarketSnapshot | null | undefined): boolean => s?.src === 'feed';

/** A surface that reads the market by name re-renders when the source turns or an answer lands */
export function useBookVersion(): string {
  return useSyncExternalStore(
    fn => {
      subs.add(fn);
      const offFeed = feed?.subscribe?.(fn);
      return () => {
        subs.delete(fn);
        offFeed?.();
      };
    },
    () => {
      const m = bookMarket();
      return `${m.src}:${m.version?.() ?? 0}`;
    }
  );
}
