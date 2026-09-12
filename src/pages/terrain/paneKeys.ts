import { TIMEFRAMES, type Timeframe } from '../../data/timeframe';
import { symKey } from './setups';

/*
==================================================
  SLAYER TERMINAL - PANE KEY WALKS (terrain/paneKeys.ts)

  The two lists a Terrain key steps along: the
  interval list, and the reader's own symbols.
==================================================

  WHY THEY SIT TOGETHER, AND WHY THEY ARE HERE RATHER THAN IN Terrain.tsx.

  `stepTf` lived in Terrain.tsx, which imports StrikeChart, which imports the
  charting library — so it could never be loaded by a plain `tsx` run and its
  clamp has never been asserted anywhere. `stepSymbol` is its sibling and does
  the OPPOSITE thing at the ends of its list, deliberately. A proof that cannot
  put the two side by side cannot show that the difference is a decision.

  So: no React, no simulator, no chart. Pure enough for `npm test`, and the
  imports are the interval table and `symKey` — both already pure for exactly
  this reason (see ./setups on why its StrikeChart imports are type-only).

  THE RING IS BUILT FROM DATA HANDED IN, never read from a module here. The
  desk owns the watchlist and the setup map; this file owns the walk.
*/

/* One step along the interval list, CLAMPED at both ends. Wrapping would
   turn one keypress on a 1-minute chart into a weekly chart, which is a
   different instrument, not a smaller adjustment. */
export const stepTf = (tf: Timeframe, dir: 1 | -1): Timeframe => {
  const i = TIMEFRAMES.findIndex(t => t.value === tf);
  const j = Math.max(0, Math.min(TIMEFRAMES.length - 1, (i < 0 ? 2 : i) + dir));
  return TIMEFRAMES[j].value;
};

/*
  THE SYMBOLS ↑/↓ WALK, in a fixed order.

  The watchlist first, in its own order, then every OTHER name the reader has
  configured, alphabetically. Two questions were settled to get here:

  WHY NOT THE WATCHLIST ALONE. It is four names. A flip key that can only ever
  reach four symbols is a shortcut to the picker rather than a replacement for
  it, and the reader's real working set is already on disk — `setups` is a
  60-entry map of every symbol they have set up BY TOUCH, which is as close to
  "their watchlist" as this app has without inventing a second stored list and
  a surface to manage it.

  WHY NOT MOST-RECENTLY-SEEN ORDER. `setups` carries `seen`, so sorting by it
  would be the obvious "recent symbols" ring — and it reorders itself as you
  walk it, because picking a stored symbol restamps `seen`. Press ↓ three times
  and the list under your fingers is not the list you started on. Alphabetical
  is arbitrary but it is STILL, and still is the property that matters for a
  list nobody can see.

  A symbol is only ever in `configured` because the reader moved a control
  while it was up, so this ring cannot fill with names they never chose.
*/
export function flipRing(watchlist: readonly string[], configured: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (raw: string) => {
    const k = symKey(raw);
    if (!k || seen.has(k)) return;
    seen.add(k);
    out.push(k);
  };
  for (const t of watchlist) push(t);
  for (const t of [...configured].map(symKey).sort()) push(t);
  return out;
}

/*
  One step along that ring, WRAPPING — the opposite of `stepTf` above, and the
  difference is the point.

  The intervals are a SCALE: the step past the end is a different instrument,
  so it is refused. The ring is a SET of peers, all of them equally valid to be
  looking at, so the step past the end is the first one again. `[`/`]` already
  wraps the pane cycle for the same reason.

  A symbol that is NOT on the ring — one picked out of the full universe and
  never configured — enters at the end it was walked towards, so ↓ lands on the
  first name and ↑ on the last. It is never dropped silently onto ring[0]
  regardless of direction, which would make ↑ and ↓ do the same thing once.
*/
export function stepSymbol(ring: readonly string[], current: string, dir: 1 | -1): string {
  if (ring.length === 0) return symKey(current);
  const i = ring.indexOf(symKey(current));
  if (i < 0) return dir === 1 ? ring[0] : ring[ring.length - 1];
  return ring[(i + dir + ring.length) % ring.length];
}
