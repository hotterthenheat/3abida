import Simulator from '../core/simulator';
import { onWake, wakeSymbol } from './seedPump';
import { buildLevelsFor, readHeatPattern, spotChangePct } from './gex';
import { getAlerts } from '../components/gex/alertStore';
import type { HeatPatternKey } from '../types/gex';

/*
==================================================
  SLAYER TERMINAL - THE WATCHLIST ROW
  (data/watchRow.ts)

  What a name says about itself, in one line.
==================================================

  A WATCHLIST OF PRICES IS A STOCK APP. The point of carrying a name on a
  terminal like this one is the things beside the price: where spot sits
  against the flip, which wall is nearest and how far, what the heat field
  is doing, and whether you already told it to shout at you. A row that
  printed last and change would have been faster to build and would have
  given a reader no reason to open this page rather than any other.

  UNSEEDED IS A STATE, NOT A ZERO. The simulator seeds a name's history
  lazily, and a name that has not been seeded has no levels — not levels of
  zero, NO levels. A row for it reports `resting` and prints dashes rather
  than manufacturing a flip at the current price, which is what any
  `?? 0` in here would have quietly done.

  BUILDING LEVELS WALKS A CHAIN, so it is not free and a twenty-name list
  would pay for it on every tick. The rows are memoised per name for a beat;
  the price beside them is read fresh every time, because that is the part
  that moves and the part a reader would notice going stale.
*/

export type RowState = 'live' | 'resting';

export interface WatchRow {
  symbol: string;
  state: RowState;
  last: number | null;
  changePct: number | null;
  ivPct: number | null;
  /** Above the flip is long gamma territory; below it is short */
  aboveFlip: boolean | null;
  flip: number | null;
  /** The nearer of the two walls, and how far spot is from it in percent */
  wall: { price: number; kind: 'call' | 'put'; distPct: number } | null;
  pattern: HeatPatternKey | null;
  patternWord: string | null;
  /** How many alerts the reader has set on this name */
  alerts: number;
}

const CACHE_MS = 4000;
const cache = new Map<string, { at: number; row: WatchRow }>();

function build(symbol: string): WatchRow {
  const sym = symbol.toUpperCase();
  const seeded = Simulator.isSeeded(sym);
  const cfg = Simulator.TICKERS[sym];
  const alerts = getAlerts(sym).length;

  if (!seeded || !cfg) {
    return {
      symbol: sym, state: 'resting', last: cfg?.currentPrice ?? null, changePct: null,
      ivPct: cfg ? Number((cfg.iv * 100).toFixed(1)) : null,
      aboveFlip: null, flip: null, wall: null, pattern: null, patternWord: null, alerts,
    };
  }

  const levels = buildLevelsFor(sym);
  const read = readHeatPattern(levels);
  const spot = levels.spot;
  const dCall = Math.abs(levels.callWall - spot);
  const dPut = Math.abs(levels.putWall - spot);
  const nearer = dCall <= dPut
    ? { price: levels.callWall, kind: 'call' as const, distPct: (dCall / spot) * 100 }
    : { price: levels.putWall, kind: 'put' as const, distPct: (dPut / spot) * 100 };

  return {
    symbol: sym,
    state: 'live',
    last: spot,
    changePct: spotChangePct(sym),
    ivPct: Number((cfg.iv * 100).toFixed(1)),
    aboveFlip: spot >= levels.flip,
    flip: levels.flip,
    wall: { ...nearer, distPct: Number(nearer.distPct.toFixed(2)) },
    pattern: read.key,
    patternWord: read.direction,
    alerts,
  };
}

export function watchRow(symbol: string): WatchRow {
  const sym = symbol.toUpperCase();
  const hit = cache.get(sym);
  const now = Date.now();
  if (hit && now - hit.at < CACHE_MS) {
    /* The price is the part that moves; the levels are the part that is
       expensive. Refresh the first off the ticker config and keep the second. */
    const cfg = Simulator.TICKERS[sym];
    if (cfg && hit.row.state === 'live') {
      return { ...hit.row, last: cfg.currentPrice, changePct: spotChangePct(sym), alerts: getAlerts(sym).length };
    }
    return hit.row;
  }
  const row = build(sym);
  cache.set(sym, { at: now, row });
  return row;
}

/* A name that finishes seeding must not be read from a row built while it
   was still resting — the cache would hold that answer for up to CACHE_MS
   after it stopped being true. The pump's signal clears it. */
onWake(() => cache.clear());

/* One pump serves the whole app — see data/seedPump.ts. */
export { onWake, wakeSymbol };
