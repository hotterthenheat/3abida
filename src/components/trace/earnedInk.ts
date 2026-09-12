/*
==================================================
  SLAYER TERMINAL - EARNED INK (trace tables)

  Three registers per column, so a column is never
  a wall of one colour (Noah, 2026-08-30: "make the
  majority of the numbers be the same EXCEPT for
  the outliers... should we have a supreme outlier
  be magenta?" — yes, and 'supreme' is already the
  house's own word for exactly that ink):

    ordinary  the column's bulk — quiet gray, the
              "rest be normal"
    loud      the top quintile of what is actually
              on screen — earns WEIGHT (bold white)
              on magnitudes, DIRECTION ink on
              signed facts (the PressureMatrix rule)
    supreme   the single largest value in the
              column on this screen — the magenta
              standout family (#EA00FF: TOP PICK,
              the whale, the largest print). One
              champion per column, the way the tape
              chart marks its one LARGEST PRINT.

  Each column measures its OWN distribution over
  the rows on screen — sharing one bar would let a
  contracts column silently rank a percent column.
==================================================
*/

export interface InkMarks {
  /** The loud bar — 80th percentile of |value| among nonzero rows on screen */
  bar: number;
  /** The supreme bar — the largest |value| on screen */
  top: number;
}

export function earnMarks<T>(rows: T[], get: (r: T) => number): InkMarks {
  const v = rows
    .map(r => Math.abs(get(r)))
    .filter(x => x > 0)
    .sort((a, b) => a - b);
  if (v.length === 0) return { bar: Infinity, top: Infinity };
  return { bar: v[Math.floor(v.length * 0.8)], top: v[v.length - 1] };
}

/** A magnitude's ink: intensity is weight, never a hue — except the champion. */
export const weightInk = (v: number, m: InkMarks): string =>
  Math.abs(v) >= m.top ? 'text-supreme font-bold' : Math.abs(v) >= m.bar ? 'font-bold text-textPrimary' : 'text-textSecondary';

/** A signed fact's ink: direction colour once loud, magenta for the champion. */
export const directionInk = (v: number, m: InkMarks): string =>
  Math.abs(v) >= m.top
    ? 'text-supreme font-bold'
    : Math.abs(v) >= m.bar
      ? v > 0
        ? 'text-bull'
        : 'text-bear'
      : 'text-textSecondary';
