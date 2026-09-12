import { buildExposureProfile } from './exposure';
import { pickWalls } from '../core/walls';
import type { ExposureExpiry } from '../types/gex';
import type { MarketSnapshot } from '../types/market';

/*
==================================================
  SLAYER TERMINAL - THE EXPIRY LADDER (data/expiryLadder.ts)

  Which expiry owns this strike — P-2.
==================================================

  THE QUESTION THE EXPOSURE PROFILE CANNOT ANSWER. That surface shows one
  expiry lens at a time, so a wall reads the same whether it is a 0DTE
  artifact that evaporates at the bell or a monthly shelf that has been
  there for three weeks and will still be there tomorrow. Those are
  opposite trades. The ladder puts the lenses side by side — strikes down,
  expiries across — so the composition of a level is one glance.

  BUILT ON THE SAME SEAM AS EVERY OTHER SURFACE. Each column is
  `buildExposureProfile` under its own lens, so the ladder cannot disagree
  with the profile a reader opens next: same window, same dealer sign
  convention, same numbers. When P-1's swap lands and the expiry breakdown
  becomes measured rather than modelled, this file changes not at all.

  WHAT THE CELLS MEAN, and the one thing they must not imply. Each cell is
  that lens's net GEX at that strike. The lenses are CUMULATIVE-ISH rather
  than disjoint — ALL is the whole pipeline, not the sum of the columns
  beside it — so the ladder never prints a total across a row: adding lenses
  that overlap would produce a number that means nothing. The row's summary
  is instead the lens that DOMINATES it, which is the actual question.

  DOMINANCE IS BY MAGNITUDE, and among the dated lenses only. ALL is
  excluded from the dominance read for the same reason it is excluded from
  any sum: it is the aggregate, so it would win every row and say nothing.
*/

/** The dated lenses, nearest first. ALL rides along as the aggregate column. */
export const LADDER_EXPIRIES: ExposureExpiry[] = ['0DTE', '1D', '2D', '5D', '7D', 'OPEX'];
export const LADDER_COLUMNS: ExposureExpiry[] = [...LADDER_EXPIRIES, 'ALL'];

export interface LadderCell {
  expiry: ExposureExpiry;
  netGex: number;
}

export interface LadderRow {
  strike: number;
  cells: LadderCell[];
  /** The dated lens carrying the most |gamma| here — null if the row is empty. */
  dominant: ExposureExpiry | null;
  /** That lens's share of the dated lenses' total |gamma|, 0–1. */
  dominantShare: number | null;
  /** Whether spot sits at or below this strike — the marker's anchor. */
  aboveSpot: boolean;
}

export interface ExpiryLadder {
  ticker: string;
  spot: number;
  columns: ExposureExpiry[];
  rows: LadderRow[];
  /** Largest |netGex| in any cell — what the heat scale divides by. */
  maxAbs: number;
}

/**
 * The ladder, strikes descending.
 *
 * @param half strikes each side of spot — the profile's own window type
 */
export function buildExpiryLadder(snapshot: MarketSnapshot, half: 10 | 15 | 20 | 30 = 10): ExpiryLadder {
  const empty: ExpiryLadder = { ticker: snapshot.ticker, spot: snapshot.spot, columns: LADDER_COLUMNS, rows: [], maxAbs: 0 };
  if (!snapshot.chain || snapshot.chain.length === 0) return empty;

  /* One profile per column, then transposed. Built once each rather than
     per row — a 21-row ladder would otherwise rebuild every lens 21 times. */
  const byExpiry = new Map<ExposureExpiry, Map<number, number>>();
  for (const e of LADDER_COLUMNS) {
    const profile = buildExposureProfile(snapshot, e, half);
    const m = new Map<number, number>();
    for (const s of profile.strikes) m.set(s.strike, s.gex.net);
    byExpiry.set(e, m);
  }

  /* The row set is the FIRST column's strikes — every lens is built over the
     same window off the same chain, so they agree by construction; taking
     one keeps the ladder rectangular even if a lens ever drops a strike. */
  const base = buildExposureProfile(snapshot, LADDER_COLUMNS[0], half);
  let maxAbs = 0;
  const rows: LadderRow[] = base.strikes.map(s => {
    const cells: LadderCell[] = LADDER_COLUMNS.map(e => {
      const v = byExpiry.get(e)?.get(s.strike) ?? 0;
      if (Math.abs(v) > maxAbs) maxAbs = Math.abs(v);
      return { expiry: e, netGex: v };
    });
    /* Dominance over the DATED lenses only — see the header. */
    let dominant: ExposureExpiry | null = null;
    let best = 0;
    let total = 0;
    for (const c of cells) {
      if (c.expiry === 'ALL') continue;
      const a = Math.abs(c.netGex);
      total += a;
      if (a > best) {
        best = a;
        dominant = c.expiry;
      }
    }
    return {
      strike: s.strike,
      cells,
      dominant: best > 0 ? dominant : null,
      dominantShare: total > 0 ? best / total : null,
      aboveSpot: s.strike >= snapshot.spot,
    };
  });

  return { ticker: snapshot.ticker, spot: snapshot.spot, columns: LADDER_COLUMNS, rows, maxAbs };
}

/**
 * The sentence a row's composition deserves.
 *
 * A strike whose gamma is concentrated in 0DTE is a level that will not
 * survive the bell; one spread across the dated lenses is structure. The
 * threshold is stated here rather than in a component so two surfaces
 * cannot word the same row differently.
 */
export const CONCENTRATED = 0.5;

/*
  THE LADDER'S HEADLINE — which expiry owns the WALLS. A reader does not
  scan twenty rows; they came to ask about the two strikes the whole desk
  is watching, and the answer belongs at the top in words. The walls are
  picked from the ladder's own ALL column through the shared pickWalls, so
  this cannot name a different strike than the map does.
*/
export interface WallOwnership {
  call: { strike: number; words: string } | null;
  put: { strike: number; words: string } | null;
}

export function wallOwnership(ladder: ExpiryLadder): WallOwnership {
  const book = ladder.rows.map(r => ({
    strike: r.strike,
    netGex: r.cells.find(c => c.expiry === 'ALL')?.netGex ?? 0,
  }));
  const w = pickWalls(book, ladder.spot, n => n.netGex);
  const mk = (strike: number | null | undefined) => {
    if (strike == null) return null;
    const row = ladder.rows.find(r => r.strike === strike);
    return row ? { strike, words: rowWords(row) } : null;
  };
  return { call: mk(w.callWall), put: mk(w.putWall) };
}

export function rowWords(row: LadderRow): string {
  if (row.dominant === null || row.dominantShare === null) return 'no gamma at this strike';
  const pct = Math.round(row.dominantShare * 100);
  if (row.dominantShare >= CONCENTRATED) {
    return row.dominant === '0DTE'
      ? `${pct}% of it is 0DTE — this level evaporates at the bell`
      : `${pct}% of it sits in ${row.dominant}`;
  }
  return `spread across expiries — ${row.dominant} leads with ${pct}%`;
}
