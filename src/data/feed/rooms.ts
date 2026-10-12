/*
==================================================
  SLAYER TERMINAL - WHICH ROOM READS THE FEED (data/feed/rooms.ts)

  ALL OR NOTHING, A ROOM AT A TIME (2026-10-12). A room
  reads the vendors only when EVERY source it needs is up;
  otherwise it reads its own book, exactly as before. Never
  a mix on one screen — a wall from one vendor beside a
  price from the house's book would be two markets.

  THE SEAM: one function per room (pulseSource …
  weigherSource). A room whose pages are not rewired yet
  (`wired: false`) returns 'stand-in' whatever the feed
  does. TRACE AND THE DOSSIER ARE WIRED (2026-10-12):
  their pages read data/feed/trace.ts and dossier.ts
  when their vendors are up; PINPOINT AND TERRAIN read
  data/feed/levels.ts. To move a
  room, set its `wired` to true and have its pages read
  `useRoomSource('<room>')` — 'feed' means read
  data/feed/uw.ts and massive.ts, 'stand-in' means read
  what the room reads today.

  `needs` is what the room would read; Settings › Data
  sources lists it.

  WHICH ROOM A PAGE IS IN (`roomOfPath`, `pageSource`):
  the shell's pieces that stand beside every page (the
  rail's price) read the room of the page under them, so
  they follow a room the day it is wired.
==================================================
*/

import type { FeedProvider } from './client';
import { isUp, useFeedStatus, type FeedStatus } from './status';

export type FeedRoom = 'pulse' | 'terrain' | 'trace' | 'dossier' | 'pinpoint' | 'compass' | 'weigher';
export type RoomSource = 'feed' | 'stand-in';

export interface RoomFeed {
  /** The room's name as the rail says it */
  name: string;
  /** Every vendor the room reads — all of them up, or none read */
  needs: FeedProvider[];
  /** What it would read from each, in the house's words */
  reads: string;
  /** True once the room's pages read the feed when it is up — the Dossier, Trace, Pinpoint and Terrain (2026-10-12) */
  wired: boolean;
}

export const ROOM_FEEDS: Record<FeedRoom, RoomFeed> = {
  pulse: { name: 'Pulse', needs: ['uw'], reads: 'Market tide, net premium, flow alerts and prices', wired: false },
  terrain: { name: 'Terrain', needs: ['uw'], reads: 'Exposure by strike and by expiry; the minute bars of the last four sessions', wired: true },
  trace: { name: 'Trace', needs: ['uw'], reads: 'The option tape, the day per contract, flow alerts, multi-leg orders, dark pool prints, net premium and Market Tide', wired: true },
  dossier: { name: 'Dossier', needs: ['uw', 'massive'], reads: 'Congress and insider filings, earnings, the wire and prices; the company record', wired: true },
  pinpoint: { name: 'Pinpoint', needs: ['uw'], reads: 'Exposure by strike and by expiry, open interest by strike, max pain, the implied move and the book through the day', wired: true },
  compass: { name: 'Compass', needs: ['uw', 'massive'], reads: 'Flow alerts and prices; the listed contracts', wired: false },
  weigher: { name: 'Weigher', needs: ['uw', 'massive'], reads: "The name's price; the listed contracts and their bars", wired: false },
};

export const FEED_ROOMS = Object.keys(ROOM_FEEDS) as FeedRoom[];

/** Every source the room needs is up */
export const roomCanRead = (room: FeedRoom, s: FeedStatus): boolean => ROOM_FEEDS[room].needs.every(p => isUp(s, p));

/** What a room reads now: the feed when it is wired and every source is up, else its own book */
export const roomSource = (room: FeedRoom, s: FeedStatus): RoomSource => (ROOM_FEEDS[room].wired && roomCanRead(room, s) ? 'feed' : 'stand-in');

/* ---- THE SEAMS: one a room — 'feed' only for a wired room with every vendor it needs up ---- */
export const pulseSource = (s: FeedStatus): RoomSource => roomSource('pulse', s);
export const terrainSource = (s: FeedStatus): RoomSource => roomSource('terrain', s);
export const traceSource = (s: FeedStatus): RoomSource => roomSource('trace', s);
export const dossierSource = (s: FeedStatus): RoomSource => roomSource('dossier', s);
export const pinpointSource = (s: FeedStatus): RoomSource => roomSource('pinpoint', s);
export const compassSource = (s: FeedStatus): RoomSource => roomSource('compass', s);
export const weigherSource = (s: FeedStatus): RoomSource => roomSource('weigher', s);

/** What a room reads, rendering when the feed's standing changes */
export function useRoomSource(room: FeedRoom): RoomSource {
  return roomSource(room, useFeedStatus());
}

/** The rooms that read a vendor when it is connected */
export const roomsReading = (p: FeedProvider): FeedRoom[] => FEED_ROOMS.filter(r => ROOM_FEEDS[r].needs.includes(p));

/* ---- WHICH ROOM A PAGE IS IN (2026-10-12) — the shell's pieces (the rail's price) read the room of the page they stand
   beside. A page no room holds (Practice, Settings, the Glossary, Community, Alerts) reads the house's book: Paper, the
   Backtest and the Journal mark on it, and the watchlist and alerts drawers open over any page with its prices. ---- */
const ROOM_PATHS: [RegExp, FeedRoom][] = [
  [/^\/(out\/)?pulse(\/|$)/, 'pulse'],
  [/^\/(out\/)?terrain(\/|$)/, 'terrain'],
  [/^\/trace(\/|$)/, 'trace'],
  [/^\/dossier(\/|$)/, 'dossier'],
  [/^\/pinpoint(\/|$)/, 'pinpoint'],
  [/^\/compass(\/|$)/, 'compass'],
  [/^\/weigher(\/|$)/, 'weigher'],
];

/** The room an address belongs to — null for a page no room holds */
export const roomOfPath = (pathname: string): FeedRoom | null => ROOM_PATHS.find(([re]) => re.test(pathname))?.[1] ?? null;

/** A wired room whose vendors have not been asked yet — its pages wait, showing nothing of either book */
export const roomPending = (room: FeedRoom, s: FeedStatus): boolean => ROOM_FEEDS[room].wired && ROOM_FEEDS[room].needs.some(p => s[p].state === 'unknown');

/** What a page reads, by its address: its room's source, or the house's book where no room holds it; 'pending' while
    a wired room's vendors are still being asked */
export function pageSource(pathname: string, s: FeedStatus): RoomSource | 'pending' {
  const room = roomOfPath(pathname);
  if (!room) return 'stand-in';
  if (roomPending(room, s)) return 'pending';
  return roomSource(room, s);
}
