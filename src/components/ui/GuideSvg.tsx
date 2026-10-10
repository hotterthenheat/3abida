/*
==================================================
  SLAYER TERMINAL - A GUIDE'S DRAWING AT THE FLOOR
  (components/ui/GuideSvg.tsx)

  The "How to read" guides draw their surfaces
  small on a fixed viewBox, and their words were
  6–9 units — 6 to 9 px in a 460 px card, 4 px on
  a phone (the audit's X9, fixed 2026-10-10). The
  drawing reads its own width (ui/svgFloor.ts
  `useSvgFloor`) and hands its figures the sizes
  in units: `w` a word at 11 px, `t` a chart's tick
  at 10, `k` the units a pixel. Rows are drawn to
  hold words GUIDE_FLOOR_MAX larger than at k = 1;
  past that (a phone) the drawing keeps a least
  width and its box scrolls sideways.

  `word` is the word size the drawing was laid out
  for at k = 1 (11 by default; the Weigher's wide
  card lays its words at 8.5 and reads them at 11).
==================================================
*/

import type { ReactNode } from 'react';
import { useSvgFloor } from './svgFloor';

/** How far a guide's words may grow against its drawing before the drawing scrolls instead */
export const GUIDE_FLOOR_MAX = 1.1;

export interface GuideType {
  /** A word, in units: 11 px at the drawing's size */
  w: number;
  /** A chart's tick, in units: 10 px */
  t: number;
  /** Units a pixel */
  k: number;
}

interface GuideSvgProps {
  /** The viewBox's width and height */
  w: number;
  h: number;
  label: string;
  /** data-guide-figure's value */
  figure?: string;
  /** The word size the drawing is laid out for at k = 1 */
  word?: number;
  children: (type: GuideType) => ReactNode;
}

export const GuideSvg = ({ w, h, label, figure = '', word = 11, children }: GuideSvgProps) => {
  const floor = useSvgFloor<SVGSVGElement>((w * 11) / word, undefined, GUIDE_FLOOR_MAX);
  const size = word * floor.k;
  return (
    <div className="overflow-x-auto overscroll-x-contain" data-guide-scroll>
      <svg ref={floor.ref} viewBox={`0 0 ${w} ${h}`} width="100%" style={{ minWidth: floor.minWidth, display: 'block' }} role="img" aria-label={label} data-guide-figure={figure}>
        {children({ w: size, t: (size * 10) / 11, k: floor.k })}
      </svg>
    </div>
  );
};
