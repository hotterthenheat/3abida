/*
==================================================
  SLAYER TERMINAL - AN SVG'S WORDS AT THE FLOOR (components/ui/svgFloor.ts)

  A drawing on a fixed viewBox stretched to its box
  draws its words at the box's scale: Pinpoint's
  axes are 1,200 units wide, so an 11-unit word was
  10.4 px at 1440, and 3 px on a phone (2026-10-10,
  the sweep for words under 11 px). The drawing
  reads its own width and hands back `k`, its units
  a pixel, never under 1 (a wider box draws the
  words bigger, as before) and never over `max` —
  past that the drawing keeps a least width
  (`minWidth`) and its box scrolls sideways (a
  phone, a narrow Pulse panel), so the rows the
  words sit on never crowd. A word is `11 * k`,
  a tick `10 * k`.
==================================================
*/

import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

/** How far the words may grow against the drawing (rows are drawn for 11-unit words; a quarter more still clears them) */
export const SVG_FLOOR_MAX = 1.25;

export function useSvgFloor<T extends Element = SVGSVGElement>(width: number, given?: RefObject<T>, max = SVG_FLOOR_MAX) {
  const own = useRef<T>(null);
  const ref: RefObject<T> = given ?? own;
  const [k, setK] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setK(Math.min(max, Math.max(1, width / w)));
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width, max]);
  return { ref, k, minWidth: Math.round(width / max) };
}

/** A box that scrolls a drawing wider than itself, opened with `at` (0–1 of the drawing's width, spot's place) in its
    middle — once, when the drawing first overflows, so the reader's own scroll is never taken back. */
export function useCentredScroll(at: number | null) {
  const ref = useRef<HTMLDivElement>(null);
  const done = useRef(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || done.current || at == null || !Number.isFinite(at)) return;
    if (el.scrollWidth <= el.clientWidth + 1) return;
    el.scrollLeft = Math.max(0, at * el.scrollWidth - el.clientWidth / 2);
    done.current = true;
  });
  return ref;
}
