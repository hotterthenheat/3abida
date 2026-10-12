/*
==================================================
  SLAYER TERMINAL - WHICH ROOM READS THE FEED (data/feed/rooms.ts)

  ALL OR NOTHING, A ROOM AT A TIME (2026-10-12). A room
  reads the vendors only when EVERY source it needs is up;
  otherwise it reads its own book, exactly as before. Never
  a mix on one screen — a wall from one vendor beside a
  price from the house's book would be two markets.

  THE SEAM: one function per room (pulseSource …
  weigherSource). Each returns 'stand-in' today, because
  no room's pages are rewired yet (`wired: false`): that
  comes once real answers can be seen on screen. To move a
  room, set its `wired` to true and have its pages read
  `useRoomSource('<room>')` — 'feed' means read
  data/feed/uw.ts and massive.ts, 'stand-in' means read
  what the room reads today.

  `needs` is what the room would read; Settings › Data
  sources lists it.
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
  /** True once the room's pages read the feed when it is up — false for every room today */
  wired: boolean;
}

export const ROOM_FEEDS: Record<FeedRoom, RoomFeed> = {
  pulse: { name: 'Pulse', needs: ['uw'], reads: 'Market tide, net premium, flow alerts and prices', wired: false },
  terrain: { name: 'Terrain', needs: ['uw', 'massive'], reads: "Exposure by strike and today's bars; earlier sessions' bars", wired: false },
  trace: { name: 'Trace', needs: ['uw'], reads: 'The option tape, flow alerts, dark pool prints and net premium', wired: false },
  dossier: { name: 'Dossier', needs: ['uw', 'massive'], reads: 'Congress and insider filings, earnings; the company record', wired: false },
  pinpoint: { name: 'Pinpoint', needs: ['uw', 'massive'], reads: 'Exposure by strike; the listed expiries', wired: false },
  compass: { name: 'Compass', needs: ['uw', 'massive'], reads: 'Flow alerts and prices; the listed contracts', wired: false },
  weigher: { name: 'Weigher', needs: ['uw', 'massive'], reads: "The name's price; the listed contracts and their bars", wired: false },
};

export const FEED_ROOMS = Object.keys(ROOM_FEEDS) as FeedRoom[];

/** Every source the room needs is up */
export const roomCanRead = (room: FeedRoom, s: FeedStatus): boolean => ROOM_FEEDS[room].needs.every(p => isUp(s, p));

/** What a room reads now: the feed when it is wired and every source is up, else its own book */
export const roomSource = (room: FeedRoom, s: FeedStatus): RoomSource => (ROOM_FEEDS[room].wired && roomCanRead(room, s) ? 'feed' : 'stand-in');

/* ---- THE SEAMS: one a room — 'stand-in' for every room today ---- */
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
