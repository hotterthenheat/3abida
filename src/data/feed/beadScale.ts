/*
  THE BEAD SCALE'S REFERENCE, ONE PIECE OF CODE (2026-10-13 — the owner's item 5 acceptance (i): "the legend value equals
  the reference the renderer used at that minute (assert)", and item 1: the store carries "the brightness reference
  (session p85 so far)"). The renderer (components/gex/gexNodesPrimitive.ts runFrom) and the store (server/fieldStore.ts)
  run the same count: each column's reference is the 85th percentile of the per-column maxima AT OR BEFORE it IN ITS OWN
  SESSION (New York's date), kept as a log-binned count — 1/32 of a decade a bin, from $1 to $10^16 — so a column added on
  the right never changes a column on the left, and a loud session does not dim the next. A bead's strength is
  √(|value| ÷ reference), clipped at 1 (gexNodesPrimitive BEAD_SCALE).
*/

export const RUN_BINS = 512;
/** The quantile the reference stands at */
export const SCALE_Q = 0.85;
export const binOf = (m: number) => Math.max(0, Math.min(RUN_BINS - 1, Math.floor(Math.log10(Math.max(1, m)) * 32)));
/** The value at quantile q of a log-binned count — the bin's upper edge */
export function quantileOf(hist: Float64Array, count: number, q: number): number {
  const want = Math.min(count - 1, Math.floor(count * q));
  let seen = 0;
  for (let b = 0; b < hist.length; b++) {
    seen += hist[b];
    if (seen > want) return Math.pow(10, (b + 1) / 32);
  }
  return Math.pow(10, hist.length / 32);
}

/** A session's running reference: push each column's largest |value| in order; the reference after each push is the
    column's own (the push included). `reset()` at a new session. */
export class RunningScale {
  private hist = new Float64Array(RUN_BINS);
  private count = 0;
  reset(): void {
    this.hist.fill(0);
    this.count = 0;
  }
  push(columnMax: number): number {
    if (columnMax > 0) {
      this.hist[binOf(columnMax)]++;
      this.count++;
    }
    return this.ref();
  }
  ref(): number {
    return this.count ? quantileOf(this.hist, this.count, SCALE_Q) : 0;
  }
  get columns(): number {
    return this.count;
  }
}

/** A column's largest magnitude */
export const columnMax = (levels: readonly { value: number }[]): number => {
  let m = 0;
  for (const l of levels) {
    const a = Math.abs(l.value);
    if (a > m) m = a;
  }
  return m;
};
