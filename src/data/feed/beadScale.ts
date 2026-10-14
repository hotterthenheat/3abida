/*
  THE BEAD SCALE'S REFERENCE, ONE PIECE OF CODE (2026-10-13 — the owner's item 5 acceptance (i): "the legend value equals
  the reference the renderer used at that minute (assert)", and item 1: the store carries "the brightness reference
  (session p85 so far)"). The renderer (components/gex/gexNodesPrimitive.ts baseFrom) and the store (server/fieldStore.ts)
  run the same count: each minute's reference is the 85th percentile of the per-MINUTE peaks AT OR BEFORE it IN ITS OWN
  SESSION (New York's date) — a column wider than a minute stands against its last minute's — kept as a log-binned count — 1/32 of a decade a bin, from $1 to $10^16 — so a column added on
  the right never changes a column on the left, and a loud session does not dim the next. A bead's strength is
  √(|value| ÷ reference), clipped at 1, drawn in its step (stepOf) — Terrain's legend states it (components/terrain/
  beadLegend.ts).
*/

export const RUN_BINS = 512;
/** The quantile the reference stands at */
export const SCALE_Q = 0.85;
/** The quantile above which a bead wears its ring (the owner's item 5 (c): "clipped giants stay distinguishable") */
export const RING_Q = 0.95;
/** Brightness steps a side (item 5 (d): "quantize brightness to 8–12 steps per side") */
export const BEAD_STEPS = 10;
/** A bead's step, 1..BEAD_STEPS, from its strength t = √(|value| ÷ reference) clipped at 1 — every strike above zero
    draws (the floor is the reader's, item 5 (e), off by default); 0 for nothing */
export const stepOf = (t: number): number => (t > 0 ? Math.min(BEAD_STEPS, Math.max(1, Math.ceil(t * BEAD_STEPS - 1e-9))) : 0);
/** The strength a step draws at — its top, so the top step is full brightness */
export const stepT = (k: number): number => k / BEAD_STEPS;
/** A bead's strength against a reference */
export const strengthOf = (value: number, ref: number): number => (ref > 0 ? Math.min(1, Math.sqrt(Math.abs(value) / ref)) : 0);

/* THE BASIS (item 5 (b)): what the reference is taken over — the session so far (each minute's own, the default), a
   FIXED reference (the p85 of every minute's peak over the 60 sessions before the day, frozen for the day), or the
   session before's p85. Each a pair: the reference and the ring's p95. */
export type ScaleBasis = 'session' | 'fixed' | 'prior';
export const FIXED_SESSIONS = 60;
export interface ScaleRef {
  ref: number;
  ring: number;
  /** Minutes and sessions it was taken over */
  minutes: number;
  sessions: number;
}
/** A reference pooled over many minutes' peaks (the same bins as the running count) */
export function pooledRef(maxima: Iterable<number>, sessions: number): ScaleRef | null {
  const hist = new Float64Array(RUN_BINS);
  let n = 0;
  for (const m of maxima) {
    if (m > 0) {
      hist[binOf(m)]++;
      n++;
    }
  }
  return n ? { ref: quantileOf(hist, n, SCALE_Q), ring: quantileOf(hist, n, RING_Q), minutes: n, sessions } : null;
}
/** A session's per-minute peaks as a sparse count — what a day keeps so the fixed reference never re-reads its rows */
export function binsOf(maxima: Iterable<number>): Record<number, number> {
  const out: Record<number, number> = {};
  for (const m of maxima) if (m > 0) out[binOf(m)] = (out[binOf(m)] ?? 0) + 1;
  return out;
}
/** A reference from sparse counts summed (the sessions' `binsOf`) */
export function refOfBins(counts: readonly Record<number, number>[]): ScaleRef | null {
  const hist = new Float64Array(RUN_BINS);
  let n = 0;
  for (const c of counts)
    for (const [b, k] of Object.entries(c)) {
      hist[Number(b)] += k;
      n += k;
    }
  return n ? { ref: quantileOf(hist, n, SCALE_Q), ring: quantileOf(hist, n, RING_Q), minutes: n, sessions: counts.length } : null;
}

/** THE SESSION'S RUNNING REFERENCES, a minute at a time — the renderer's and the store's one code: each minute's
    reference and ring over the minutes AT OR BEFORE it in its own session (`dayOf` names the session) */
export function minuteRefs(times: readonly number[], maxima: readonly number[], dayOf: (t: number) => string): { ref: Float64Array; ring: Float64Array } {
  const ref = new Float64Array(times.length);
  const ring = new Float64Array(times.length);
  const run = new RunningScale();
  let day = '';
  for (let i = 0; i < times.length; i++) {
    const d = dayOf(times[i]);
    if (d !== day) {
      day = d;
      run.reset();
    }
    ref[i] = run.push(maxima[i]);
    ring[i] = run.ring();
  }
  return { ref, ring };
}
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
  /** The ring's quantile over the same count */
  ring(): number {
    return this.count ? quantileOf(this.hist, this.count, RING_Q) : 0;
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
