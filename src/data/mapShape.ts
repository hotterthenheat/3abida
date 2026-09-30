/*
==================================================
  SLAYER TERMINAL - THE MAP'S SHAPE (data/mapShape.ts)

  The Map rebuilt (2026-09-26 — Noah: "start with the
  map delete everything on that page … i feel as if
  there is a lack of quality on this page"; my read:
  five ladders of measurements and no claim). What the
  page says about the book is worked out here, pure:

    THE ROWS      a strike a row, the five greeks' legs
                  summed over the expiries drawn, the
                  greek being DRAWN as the row's net
    THE SHAPE     a word a row earns from the drawn
                  greek's |net| against the rows shown —
                  WALL (the heaviest hedging, a local
                  peak, or the book's named wall), CLIFF
                  (the strike right past a wall on the
                  far side from price, where the hedging
                  drops away), SHELF (a run of strikes of
                  steady, middling hedging), VOID (next
                  to nothing) — Building's grammar of a
                  verdict per row, for shape
    THE FOLDS     three or more voids in a row fold to
                  one line, so the movers are the page
                  (Building's steady fold); no fold
                  crosses price
    THE CUT       the heaviest ORDINARY strike — the
                  90th percentile of |net| — every bar
                  and colour reads against it, so one
                  monster strike never flattens the rest
                  (the ladder's own rule, kept)
    THE READ      one paragraph: where price stands
                  against the walls, which way the book
                  leans above and below it, how
                  concentrated it is, and where the
                  heaviest strike moved since the open

  Words, never a digit of ours, for the shape and the
  concentration (the house rule); the dollars are the
  book's own.
==================================================
*/

import { GREEKS, type ExposureSurface, type Greek } from './exposureSurface';
import { fmtDollars, fmtStrike } from './ahead';

export type Shape = 'wall' | 'cliff' | 'shelf' | 'void';
export type Role = 'call wall' | 'put wall' | 'supreme' | null;

export interface Legs {
  put: number;
  call: number;
  net: number;
}

export interface MapRow {
  strike: number;
  /** Per greek, the legs summed over the expiries drawn — signed dollars, the house sign */
  legs: Record<Greek, Legs>;
  /** The drawn greek's net */
  net: number;
  shape: Shape | null;
  role: Role;
  /** Above price (strikes at or over spot) */
  above: boolean;
}

/** A run of voids folded to one line — strikes high to low */
export interface MapFold {
  key: string;
  from: number;
  to: number;
  n: number;
  above: boolean;
  rows: MapRow[];
}

export type MapLine = { kind: 'row'; row: MapRow } | { kind: 'fold'; fold: MapFold };

export const SHAPE_WORD: Record<Shape, string> = { wall: 'Wall', cliff: 'Cliff', shelf: 'Shelf', void: 'Void' };
export const SHAPE_SAYS: Record<Shape, string> = {
  wall: 'The heaviest hedging around — a move tends to slow or turn here',
  cliff: 'Right past a wall, on the far side from price, the hedging drops away — a break through the wall meets little here',
  shelf: 'A run of strikes with steady, middling hedging — support in layers rather than one line',
  void: 'Next to nothing here — a move through these strikes meets no hedging',
};
export const GREEK_WORD: Record<Greek, string> = { gex: 'gamma', dex: 'delta', vex: 'vega', vanna: 'vanna', charm: 'charm' };
export const GREEK_UNIT_WORDS: Record<Greek, string> = { gex: 'dollars of hedging per 1% move', dex: 'dollars of hedging per 1σ move', vex: 'dollars per 1% of vol', vanna: 'dollars of delta per vol point', charm: 'dollars of delta the clock takes a day' };

/* the shape's thresholds, as shares of the heaviest |net| among the rows shown */
const WALL_AT = 0.5;
const CLIFF_DROP = 0.35;
const SHELF_LO = 0.2;
const SHELF_HI = 0.55;
const VOID_AT = 0.06;
const FOLD_AT = 3;

/** The rows, high strike first: `rings` each side of spot, the legs summed over the expiries drawn */
export function rowsOf(surface: ExposureSurface, expiryIdx: readonly number[], rings: number, lead: Greek): MapRow[] {
  const idx = expiryIdx.filter(i => i >= 0 && i < surface.expiries.length);
  const desc = [...surface.strikes].sort((a, b) => b - a);
  const above = desc.filter(s => s >= surface.spot).slice(-Math.max(1, rings));
  const below = desc.filter(s => s < surface.spot).slice(0, Math.max(1, rings));
  const { callWall, putWall, supreme } = surface.levels;
  const rowFor = (strike: number, isAbove: boolean): MapRow => {
    const si = surface.strikes.indexOf(strike);
    const legs = {} as Record<Greek, Legs>;
    for (const g of GREEKS) {
      let put = 0;
      let call = 0;
      let net = 0;
      if (si >= 0)
        for (const e of idx) {
          put += surface.put[g][e]?.[si] ?? 0;
          call += surface.call[g][e]?.[si] ?? 0;
          net += surface.net[g][e]?.[si] ?? 0;
        }
      legs[g] = { put, call, net };
    }
    const role: Role = strike === supreme ? 'supreme' : strike === callWall ? 'call wall' : strike === putWall ? 'put wall' : null;
    return { strike, legs, net: legs[lead].net, shape: null, role, above: isAbove };
  };
  const rows = [...above.map(s => rowFor(s, true)), ...below.map(s => rowFor(s, false))];
  return shapesOf(rows);
}

/** The shape words, from the drawn greek's |net| against the rows shown (see the head) */
export function shapesOf(rows: MapRow[]): MapRow[] {
  const abs = rows.map(r => Math.abs(r.net));
  const max = Math.max(1e-9, ...abs);
  const share = abs.map(a => a / max);
  const shape: (Shape | null)[] = rows.map(() => null);
  /* walls: the book's named walls, and any local peak that carries half the heaviest */
  for (let i = 0; i < rows.length; i++) {
    const peak = share[i] >= WALL_AT && share[i] >= (share[i - 1] ?? 0) && share[i] >= (share[i + 1] ?? 0);
    if (peak || rows[i].role === 'call wall' || rows[i].role === 'put wall') shape[i] = 'wall';
  }
  /* cliffs: the strike right past a wall on the far side from price, where the hedging falls to a third or less */
  for (let i = 0; i < rows.length; i++) {
    if (shape[i] !== 'wall' || share[i] < SHELF_LO) continue;
    const j = rows[i].above ? i - 1 : i + 1;
    if (j < 0 || j >= rows.length || shape[j] === 'wall') continue;
    if (share[j] <= share[i] * CLIFF_DROP) shape[j] = 'cliff';
  }
  /* voids */
  for (let i = 0; i < rows.length; i++) if (shape[i] == null && share[i] < VOID_AT) shape[i] = 'void';
  /* shelves: two or more in a row of steady, middling hedging on the same side */
  let i = 0;
  while (i < rows.length) {
    if (shape[i] != null || share[i] < SHELF_LO || share[i] > SHELF_HI) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < rows.length && shape[j + 1] == null && share[j + 1] >= SHELF_LO && share[j + 1] <= SHELF_HI && Math.sign(rows[j + 1].net) === Math.sign(rows[i].net)) j++;
    if (j > i) for (let k = i; k <= j; k++) shape[k] = 'shelf';
    i = j + 1;
  }
  return rows.map((r, k) => ({ ...r, shape: shape[k] }));
}

/** The rows as lines: runs of three or more voids folded, never across price */
export function linesOf(rows: MapRow[]): MapLine[] {
  const out: MapLine[] = [];
  let i = 0;
  while (i < rows.length) {
    const r = rows[i];
    if (r.shape === 'void') {
      let j = i;
      while (j + 1 < rows.length && rows[j + 1].shape === 'void' && rows[j + 1].above === r.above) j++;
      if (j - i + 1 >= FOLD_AT) {
        const run = rows.slice(i, j + 1);
        out.push({ kind: 'fold', fold: { key: `${run[0].strike}-${run[run.length - 1].strike}`, from: run[0].strike, to: run[run.length - 1].strike, n: run.length, above: r.above, rows: run } });
        i = j + 1;
        continue;
      }
    }
    out.push({ kind: 'row', row: r });
    i++;
  }
  return out;
}

/** THE CUT — the heaviest ordinary strike: the 90th percentile of |net| among the rows shown (the heaviest itself under ten rows) */
export function cutOf(rows: readonly MapRow[]): number {
  const abs = rows.map(r => Math.abs(r.net)).sort((a, b) => a - b);
  if (!abs.length) return 1;
  const p90 = abs.length >= 10 ? abs[Math.floor(0.9 * (abs.length - 1))] : abs[abs.length - 1];
  return Math.max(1, p90 > 0 ? p90 : abs[abs.length - 1]);
}

/** The heaviest strike among rows by |net| — null when the book is empty */
export const heaviestOf = (rows: readonly { strike: number; net: number }[]): number | null => {
  let best: { strike: number; net: number } | null = null;
  for (const r of rows) if (!best || Math.abs(r.net) > Math.abs(best.net)) best = r;
  return best && Math.abs(best.net) > 0 ? best.strike : null;
};

/** How concentrated the hedging is, in words: the share the heaviest few strikes hold of every strike's |net| */
export function concentrationWords(rows: readonly MapRow[], greek: Greek): string {
  const abs = rows.map(r => Math.abs(r.net)).sort((a, b) => b - a);
  const total = abs.reduce((a, b) => a + b, 0);
  const word = GREEK_WORD[greek];
  if (total <= 0) return `There is no ${word} to speak of in these strikes.`;
  const top = (n: number) => abs.slice(0, n).reduce((a, b) => a + b, 0) / total;
  if (top(1) >= 0.45) return `One strike holds nearly half the ${word}.`;
  if (top(2) >= 0.5) return `Two strikes hold half the ${word}.`;
  if (top(4) >= 0.6) return `Four strikes hold most of the ${word}.`;
  if (top(8) >= 0.75) return `The ${word} sits in a handful of strikes.`;
  return `The ${word} is spread across the strikes.`;
}

/** Where the heaviest strike went since the open */
export function migrationWords(openHeaviest: number | null, nowHeaviest: number | null): string | null {
  if (openHeaviest == null || nowHeaviest == null) return null;
  if (openHeaviest === nowHeaviest) return `The heaviest strike has held at ${fmtStrike(nowHeaviest)} since the open.`;
  return `The heaviest strike moved ${fmtStrike(openHeaviest)} → ${fmtStrike(nowHeaviest)} since the open.`;
}

/** The read — where price stands, which way the book leans either side of it, and how concentrated it is */
export function readOf(surface: ExposureSurface, rows: readonly MapRow[], lead: Greek, migration: string | null): string {
  const { ticker, spot, levels } = surface;
  const { callWall, putWall } = levels;
  const where = spot > putWall && spot < callWall ? `${ticker} sits between the ${fmtStrike(putWall)} put wall and the ${fmtStrike(callWall)} call wall.` : spot >= callWall ? `${ticker} trades above its call wall at ${fmtStrike(callWall)}.` : `${ticker} trades below its put wall at ${fmtStrike(putWall)}.`;
  const aboveNet = rows.filter(r => r.above).reduce((a, r) => a + r.net, 0);
  const belowNet = rows.filter(r => !r.above).reduce((a, r) => a + r.net, 0);
  /* the house sign: negative = call-heavy = dealers absorb; positive = put-heavy = dealers amplify (data/exposure.ts) */
  const lean =
    lead === 'gex'
      ? `Above price the book is ${aboveNet < 0 ? 'call-heavy, so dealers push back on a rise' : 'put-heavy, so dealers push a rise along'}; below it ${belowNet < 0 ? 'they push back on a drop' : 'they push a drop along'}.`
      : `Above price the ${GREEK_WORD[lead]} leans ${aboveNet < 0 ? 'call-heavy' : 'put-heavy'}; below it ${belowNet < 0 ? 'call-heavy' : 'put-heavy'}.`;
  return [where, lean, concentrationWords(rows, lead), migration].filter(Boolean).join(' ');
}

/** "+$1.2B" · "−$340M" — the book's dollars, signed */
export const signedDollars = (v: number): string => `${v >= 0 ? '+' : '−'}${fmtDollars(v)}`;
