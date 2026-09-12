/*
==================================================
  SLAYER TERMINAL - LAYING OUT A STRIKE BAND
  (components/gex/strikeBand.ts)

  The geometry behind a diverging histogram whose
  X AXIS IS THE STRIKE, not the clock — the shape the
  reference uses for exposure by strike, and the one
  shape that cannot be a pane inside the price chart,
  because every pane there shares the time axis.

  Pulled out of the component and proved separately
  for the usual reason: arithmetic that only ever runs
  inside a render is arithmetic nobody can test, and
  the failures it produces (a bar off the top, a bar
  that vanishes, labels stacked on each other) look
  like styling bugs right up until they are not.
==================================================
*/

/** One bar, already in SVG user units with y measured DOWN from the top. */
export interface BandBar {
  strike: number;
  value: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Above the zero rule. A zero value is NOT positive — it is neither. */
  positive: boolean;
}

/*
  A REAL VALUE IS NEVER DRAWN AS NOTHING.

  Away from the money most strikes carry a fraction of a percent of the
  heaviest one, and scaled honestly they round to less than a pixel. Drawing
  them at zero height makes the band assert the book is EMPTY there, which is a
  different and stronger claim than "there is very little here". One pixel is
  the smallest mark that distinguishes the two.

  It applies only to values that are actually non-zero. A true zero draws
  nothing, because nothing is what it means.
*/
const MIN_INK = 1;

/**
 * Place one bar per row across `width`, diverging from a zero rule at mid
 * height.
 *
 * `maxAbs` is the surface's scale rather than this window's max, so two bands
 * drawn from the same book stay comparable. A non-positive or non-finite scale
 * lays every bar out flat instead of dividing by it.
 */
/*
  GENERIC OVER THE ROW, not over `{ strike }` alone.

  It took `readonly { strike: number }[]` and handed the accessor the same
  narrowed type, so every caller whose rows carry a value had to cast inside
  its own accessor — `r => (r as { v: number }).v`. A cast in the one place
  that is supposed to READ the row is a cast that can be wrong silently, and
  the band would then lay out zeros without complaining.

  `T extends { strike: number }` keeps the constraint this function actually
  relies on (it reads `strike` and nothing else) while letting the accessor
  see the row it was given. Every existing call infers T and is unchanged.
*/
export function layoutBand<T extends { strike: number }>(
  rows: readonly T[],
  valueOf: (row: T, index: number) => number,
  maxAbs: number,
  width: number,
  height: number,
  gap = 2
): BandBar[] {
  const n = rows.length;
  if (n === 0 || !(width > 0) || !(height > 0)) return [];

  const slot = width / n;
  const w = Math.max(1, slot - gap);
  const mid = height / 2;
  const scale = Number.isFinite(maxAbs) && maxAbs > 0 ? maxAbs : 0;

  return rows.map((row, i) => {
    const raw = valueOf(row, i);
    const value = Number.isFinite(raw) ? raw : 0;
    let h = 0;
    if (scale > 0 && value !== 0) {
      /* Clamped: a value past the scale is drawn AT the edge rather than over
         it. A bar taller than its half would spill across the zero rule and
         read as belonging to the other side. */
      h = Math.min(mid, (Math.abs(value) / scale) * mid);
      if (h < MIN_INK) h = MIN_INK;
    }
    const positive = value > 0;
    return {
      strike: row.strike,
      value,
      x: i * slot + (slot - w) / 2,
      y: positive ? mid - h : mid,
      w,
      h,
      positive,
    };
  });
}

/**
 * How many rows to skip between printed x-axis labels.
 *
 * Returns a stride, not a list, so the caller keeps ownership of what a label
 * says. `minPx` is the narrowest gap two labels may sit at before they touch.
 */
export function labelStride(count: number, width: number, minPx: number): number {
  if (count <= 0 || !(width > 0) || !(minPx > 0)) return 1;
  const perLabel = width / count;
  if (perLabel >= minPx) return 1;
  return Math.max(1, Math.ceil(minPx / perLabel));
}

/**
 * Where spot falls along the band, in the same user units as the bars.
 *
 * `spotAfterIndex` is the profile's own answer — the row index AFTER which the
 * marker belongs, and -0.5 when spot sits above every row. The rule lands on
 * the boundary BETWEEN two slots rather than on a bar's centre, because spot is
 * a price between strikes, not a strike.
 *
 * Returns null when the band has no rows to place it against; the caller draws
 * no rule rather than one at the left edge.
 */
export function spotX(spotAfterIndex: number, count: number, width: number): number | null {
  if (count <= 0 || !(width > 0)) return null;
  if (!Number.isFinite(spotAfterIndex)) return null;
  const slot = width / count;
  /* +1 puts the rule on the trailing edge of the row it comes after. */
  const x = (spotAfterIndex + 1) * slot;
  if (x < 0 || x > width) return null;
  return x;
}

/**
 * The gap that leaves each bar `barFraction` of its slot.
 *
 * A FIXED gap is the wrong unit for a band that has to work at 300px and at
 * 1600px. Two pixels of air between 21 bars is generous at phone width and
 * invisible at desk width — measured at 1600px the band fused into one
 * continuous red-then-green block, which is exactly the failure the capsule
 * heatmap was built to fix: without air, a row of bars is a band the eye has to
 * find seams in before it can count columns.
 *
 * Proportional keeps the same PICTURE at every width. The floor of one pixel is
 * for the degenerate end: a band narrower than its strike count still has to
 * draw something.
 */
export function barGap(width: number, count: number, barFraction = 0.6): number {
  if (count <= 0 || !(width > 0)) return 1;
  const f = Number.isFinite(barFraction) ? Math.min(1, Math.max(0.05, barFraction)) : 0.6;
  return Math.max(1, (width / count) * (1 - f));
}

/**
 * Turn the profile's DESCENDING spot index into the ascending band's.
 *
 * `ExposureProfileData.spotAfterIndex` is an index into strikes sorted HIGH to
 * low — the row after which the spot marker belongs — and -0.5 means spot sits
 * above every strike in the window. The band draws strikes LOW to high, so the
 * index has to be mirrored, and mirroring an "after this row" index is not the
 * same as mirroring the row: the boundary between rows k and k+1 descending is
 * the boundary between n-2-k and n-1-k ascending.
 *
 * Off by one here does not throw and does not look wrong at a glance. It puts
 * the spot rule one strike away from where the market is, on a panel a reader
 * uses to decide which strike matters — which is the most expensive kind of
 * quiet bug this file could ship.
 */
export function ascendingSpotIndex(spotAfterIndex: number, count: number): number {
  return count - 2 - spotAfterIndex;
}
