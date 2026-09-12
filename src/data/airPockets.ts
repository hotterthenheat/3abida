import type { StrikeExposure, ZoneBand } from '../types/gex';

/*
==================================================
  SLAYER TERMINAL - AIR POCKETS (data/airPockets.ts)

  Where price does NOT stop — P-5.
==================================================

  A WALL TELLS YOU WHERE PRICE STOPS. An air pocket tells you where it
  doesn't: a contiguous run of strikes carrying almost no dealer gamma,
  sitting between two shelves that carry plenty. There is no hedging flow in
  there to slow anything down, which is the mechanical explanation for the
  moves that look like nothing happened — price crosses the range in seconds
  because nothing was mechanically obliged to lean against it.

  THE DEFINITION, and every threshold in it argued rather than tuned:

    NEAR-ZERO is relative to the book, not absolute. A strike carrying under
    QUIET_SHARE of the window's HEAVIEST strike is quiet — on a $600 index
    and a $12 name alike, because both are read against their own book. An
    absolute dollar floor would call every strike on a small name an air
    pocket.

    A RUN IS AT LEAST MIN_STRIKES wide. Two quiet strikes between two shelves
    is the ordinary texture of any book; the read only means something when
    the gap is wide enough that price crossing it has real distance to
    travel unopposed.

    IT MUST BE BETWEEN SHELVES. A quiet run at the END of the window is not a
    pocket — it is the edge of the book, where gamma thins out because there
    are no strikes left, not because the strikes there are empty. Requiring a
    heavy strike on BOTH sides is what separates "nothing here" from "nothing
    listed here".

    A SHELF IS SHELF_SHARE of the heaviest. Deliberately lower than a wall's
    bar: the pocket's claim is about what BOUNDS the emptiness, and a shelf
    that would lose a wall contest can still be the thing price stops at on
    the way through.

  MODELLED LIKE EVERY OTHER READ off this chain, and the provenance chip on
  the surface says so.
*/

/** A strike under this share of the window's heaviest is "quiet". */
export const QUIET_SHARE = 0.12;
/** A strike over this share bounds a pocket. */
export const SHELF_SHARE = 0.35;
/** Fewer contiguous quiet strikes than this is texture, not a pocket. */
export const MIN_STRIKES = 3;

export interface AirPocket {
  /** Upper strike of the empty run (inclusive). */
  from: number;
  /** Lower strike of the empty run (inclusive). */
  to: number;
  /** Strikes in the run. */
  width: number;
  /** The shelves that bound it, above and below. */
  ceiling: number;
  floor: number;
  /** Largest |net gamma| inside the run, against the window's heaviest. */
  peakShare: number;
}

/**
 * The pockets in a strike window.
 *
 * @param strikes the profile's own rows, DESCENDING (highest strike first)
 */
export function findAirPockets(strikes: readonly StrikeExposure[]): AirPocket[] {
  if (strikes.length < MIN_STRIKES + 2) return [];
  const mag = strikes.map(s => Math.abs(s.gex.net));
  const heaviest = Math.max(...mag);
  if (heaviest <= 0) return [];

  const quiet = mag.map(m => m / heaviest < QUIET_SHARE);
  const shelf = mag.map(m => m / heaviest >= SHELF_SHARE);

  const out: AirPocket[] = [];
  let i = 0;
  while (i < strikes.length) {
    if (!quiet[i]) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < strikes.length && quiet[j + 1]) j++;
    const width = j - i + 1;
    /* Bounded by a shelf on BOTH sides, and wide enough to matter. Rows run
       descending, so i−1 is the strike ABOVE the run and j+1 the one below. */
    const above = i - 1;
    const below = j + 1;
    if (width >= MIN_STRIKES && above >= 0 && below < strikes.length && shelf[above] && shelf[below]) {
      out.push({
        from: strikes[i].strike,
        to: strikes[j].strike,
        width,
        ceiling: strikes[above].strike,
        floor: strikes[below].strike,
        peakShare: Math.max(...mag.slice(i, j + 1)) / heaviest,
      });
    }
    i = j + 1;
  }
  return out;
}

/** The pockets as map bands, in the same shape the zones already use. */
export function airPocketZones(pockets: readonly AirPocket[]): ZoneBand[] {
  return pockets.map(p => ({
    from: p.from,
    to: p.to,
    kind: 'air-pocket' as const,
    label: 'AIR POCKET',
  }));
}

/** What a pocket is worth saying, in the desk's own voice. */
export function pocketWords(p: AirPocket, spot: number): string {
  const span = Math.abs(p.ceiling - p.floor);
  const where = spot > p.ceiling ? 'below' : spot < p.floor ? 'above' : 'around';
  return `${p.floor}–${p.ceiling} is ${span.toFixed(2)} wide with almost no hedging in it — ${where} spot, price has nothing to lean on crossing it`;
}
