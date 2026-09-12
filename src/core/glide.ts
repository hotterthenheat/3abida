/*
==================================================
  SLAYER TERMINAL - THE LAYOUT GLIDE (core/glide.ts)

  The perf sweep (2026-09-06). The sidebar folding
  is a 300ms width transition, and every canvas in
  the main column was re-laid out on each of its
  eighteen frames — two charts and a ladder at
  35–50ms a frame, the stutter Noah named first
  ("the sidebar being dragged for the first time").

  While a glide is on, the surfaces that cost the
  most HOLD THEIR SIZE — a chart pins itself to its
  panel's right edge and lets the panel grow or
  shrink round it, a ladder keeps its last measure —
  and each takes ONE resize when the glide ends.
  The DOM around them (borders, heads, rows of
  text) reflows every frame as before; that part
  was never the cost.

  Two kinds. 'frame' is the sidebar's width glide:
  the desk's grid items drop their own 200ms width
  transition for it (index.css), so they follow the
  frame instantly and settle when it does. 'snap'
  is that same item transition after a widget is
  dropped or resized — the chart holds through it
  and takes the final size once.
==================================================
*/

export type GlideKind = 'frame' | 'snap';

/** WHERE THE FRAME IS GOING (2026-09-12): the sidebar knows the width the main
    column will have when its glide settles, and says so at the start, so a
    surface can lay itself out for the destination at once and RIDE the glide
    there — instead of holding its old shape and snapping when the frame stops
    (Noah: "the cards freeze and snap into frame... it changes the user's pov
    rapidly"). */
export interface GlideTarget {
  mainWidth: number;
}

let gliding = false;
let endTimer = 0;
let target: GlideTarget | null = null;
const starters = new Set<() => void>();
const enders = new Set<() => void>();
const once = new Set<() => void>();

export const isGliding = (): boolean => gliding;
/** The frame's destination for the glide under way, when the starter said it */
export const glideTarget = (): GlideTarget | null => target;

/** A glide has begun; it ends on `endGlide`, or after `maxMs` if nobody reports the end */
export function beginGlide(maxMs = 450, kind: GlideKind = 'frame', to: GlideTarget | null = null): void {
  window.clearTimeout(endTimer);
  if (!gliding) {
    gliding = true;
    target = to;
    document.documentElement.setAttribute('data-glide', kind);
    starters.forEach(fn => fn());
  }
  /* A transition that never reports its end (a tab hidden mid-glide, a
     reduced-motion setting skipping it) must not hold the charts for good */
  endTimer = window.setTimeout(endGlide, maxMs);
}

/** THE HOST'S PROMISE: a host that already knows its width at the end of the
    glide declares it (`data-tile-width` — the desk's tiles, laid out for the
    destination the moment the glide begins and transitioning there). A surface
    inside asks for the width IT will have then, and sizes for it at the start —
    nothing left to do when the frame stops. Null when nothing above it made a
    promise, and the surface holds and takes one resize at the end as before. */
export function promisedWidth(el: HTMLElement): number | null {
  const host = el.closest<HTMLElement>('[data-tile-width]');
  if (!host) return null;
  const to = Number(host.dataset.tileWidth);
  if (!Number.isFinite(to) || to <= 0) return null;
  const insets = host.getBoundingClientRect().width - el.getBoundingClientRect().width;
  return Math.max(0, Math.round(to - insets));
}

export function endGlide(): void {
  window.clearTimeout(endTimer);
  if (!gliding) return;
  gliding = false;
  target = null;
  document.documentElement.removeAttribute('data-glide');
  const run = [...once];
  once.clear();
  run.forEach(fn => fn());
  enders.forEach(fn => fn());
}

/** Called at the start and the end of every glide; returns the unsubscribe */
export function onGlide(start: () => void, end: () => void): () => void {
  starters.add(start);
  enders.add(end);
  return () => {
    starters.delete(start);
    enders.delete(end);
  };
}

/** Run now — or, mid-glide, once when it ends (the same function is queued once) */
export function afterGlide(fn: () => void): void {
  if (!gliding) fn();
  else once.add(fn);
}
