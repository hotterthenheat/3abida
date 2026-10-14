/*
==================================================
  SLAYER TERMINAL - THE SESSION RECAP, ASKED (data/feed/recap.ts)

  The owner's item 9: the server builds a session's recap
  once the session is over (server/recap.ts — 4:05 pm New
  York on the always-on recorder, else on the first ask);
  the shell's watcher (components/review/RecapWatcher.tsx)
  asks for the sessions that have one, takes the picture
  and posts it to the Journal (data/review/recaps.ts).
==================================================
*/

import { feedFetch, type FeedResult } from './client';
import type { SessionRecap } from './sessionRecap';

/** A session a recap can be built for, with its recap's version (null before it is built) */
export interface RecapIndexRow {
  name: string;
  day: string;
  version: string | null;
  builtAt: number | null;
}
/** The recap as served: the figures, the quantiles its regime path read */
export interface ServedRecap extends SessionRecap {
  quantiles: (number[] | null)[] | null;
}
/** What the picture draws beside the figures: the rows' columns [minute ms, price, [strike, value][]], the day's budget */
export interface RecapField {
  cols: [number, number, [number, number][]][];
  move: { prevClose: number; sigma: number; from: string; profile: number[]; close: number | null } | null;
}

export async function loadRecapIndex(days = 7): Promise<FeedResult<RecapIndexRow[]>> {
  const r = await feedFetch(`/feed/field/recaps?days=${days}`);
  if (!r.ok) return r;
  const rows = (r.data as { sessions?: unknown }).sessions;
  return Array.isArray(rows) ? { ok: true, data: rows as RecapIndexRow[], at: r.at } : { ok: false, reason: 'shape', status: 200 };
}

export async function loadRecap(name: string, day: string, field: true): Promise<FeedResult<ServedRecap & { field: RecapField }>>;
export async function loadRecap(name: string, day: string, field?: false): Promise<FeedResult<ServedRecap>>;
export async function loadRecap(name: string, day: string, field = false): Promise<FeedResult<ServedRecap | (ServedRecap & { field: RecapField })>> {
  const r = await feedFetch(`/feed/field/${encodeURIComponent(name)}/recap?day=${day}${field ? '&field=1' : ''}`);
  if (!r.ok) return r;
  const x = r.data as ServedRecap & { field?: RecapField };
  if (typeof x?.version !== 'string' || !Array.isArray(x.bars) || (field && !Array.isArray(x.field?.cols))) return { ok: false, reason: 'shape', status: 200 };
  return { ok: true, data: x, at: r.at };
}
