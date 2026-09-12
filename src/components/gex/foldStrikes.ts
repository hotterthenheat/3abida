/*
==================================================
  SLAYER TERMINAL - FOLDING THE QUIET STRIKES
  (components/gex/foldStrikes.ts)

  A chain is mostly empty away from the money. Drawn
  in full, forty near-zero rows bury the dozen that
  matter inside a wall of almost-black, and the
  reader scrolls past the book to find the book.

  This folds contiguous runs of quiet strikes into a
  single marker that SAYS HOW MANY WENT. The count is
  the whole point: a surface that silently drops rows
  is lying about the chain it claims to show.

  NOTHING NEAR THE MONEY IS EVER FOLDED, however
  quiet. A zero at a strike two ticks from spot is
  information — it says the book has nothing there,
  which is a fact about the most important part of
  the chain. A zero forty strikes out is just the
  chain being long.
==================================================
*/

/** A row that survived, or a count of the ones that did not. */
export type FoldedRow<T> = { kind: 'row'; row: T; index: number } | { kind: 'hidden'; count: number };

export interface FoldOptions {
  /**
   * How loud a row must be to survive, as a share of the surface's scale.
   *
   * 0.02 is the default: two percent of the heaviest strike. Below that a cell
   * is drawn at the ramp's floor and is indistinguishable from an empty one, so
   * folding it costs the reader nothing they could actually see.
   */
  threshold?: number;
  /**
   * Rows this close to the spot row are always kept, by INDEX distance.
   *
   * Index rather than price, because the caller's rows are already the window
   * it chose and their spacing is its business — a $1 chain and a $5 chain
   * should both keep the same number of rows around the money.
   */
  keepNear?: number;
  /**
   * A run must be at least this long to be worth folding.
   *
   * Folding one row replaces a row with a row and saves nothing while costing
   * the reader a number they could have just read.
   */
  minRun?: number;
}

const DEFAULTS = { threshold: 0.02, keepNear: 6, minRun: 2 };

/**
 * Fold quiet runs out of a list of rows.
 *
 * `loudness` returns the row's largest absolute value — the caller knows
 * whether its row is one number or seven. `spotIndex` may be -1 when the
 * surface has no spot row, in which case nothing is pinned.
 */
export function foldQuietStrikes<T>(
  rows: readonly T[],
  loudness: (row: T) => number,
  maxAbs: number,
  spotIndex: number,
  options: FoldOptions = {}
): FoldedRow<T>[] {
  const threshold = Number.isFinite(options.threshold)
    ? Math.max(0, options.threshold as number)
    : DEFAULTS.threshold;
  const keepNear = Number.isFinite(options.keepNear)
    ? Math.max(0, Math.floor(options.keepNear as number))
    : DEFAULTS.keepNear;
  const minRun = Number.isFinite(options.minRun)
    ? Math.max(1, Math.floor(options.minRun as number))
    : DEFAULTS.minRun;

  /* A scale of zero means the whole surface is empty. Folding every row then
     would replace the chain with the word "hidden", so nothing folds. */
  if (!Number.isFinite(maxAbs) || maxAbs <= 0) {
    return rows.map((row, index) => ({ kind: 'row', row, index }));
  }

  const cut = maxAbs * threshold;
  const keeps = rows.map((row, i) => {
    if (spotIndex >= 0 && Math.abs(i - spotIndex) <= keepNear) return true;
    const l = loudness(row);
    return !Number.isFinite(l) || Math.abs(l) > cut;
  });

  const out: FoldedRow<T>[] = [];
  let i = 0;
  while (i < rows.length) {
    if (keeps[i]) {
      out.push({ kind: 'row', row: rows[i], index: i });
      i++;
      continue;
    }
    let j = i;
    while (j < rows.length && !keeps[j]) j++;
    const length = j - i;
    if (length >= minRun) {
      out.push({ kind: 'hidden', count: length });
    } else {
      for (let k = i; k < j; k++) out.push({ kind: 'row', row: rows[k], index: k });
    }
    i = j;
  }
  return out;
}

/** How many rows a fold actually removed — for a caller that wants to say so. */
export function hiddenCount<T>(folded: readonly FoldedRow<T>[]): number {
  return folded.reduce((n, f) => (f.kind === 'hidden' ? n + f.count : n), 0);
}
