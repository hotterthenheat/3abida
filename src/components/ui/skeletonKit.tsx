/*
==================================================
  SLAYER TERMINAL - THE SKELETON KIT
  (components/ui/skeletonKit.tsx)

  Small parts every page-shaped skeleton is built
  from (Noah, 2026-09-08: a skeleton must "take the
  shape of its container"). Each part is a real
  piece of the house chrome at its real size — a
  dropdown trigger is h-7, a panel header is h-10,
  a table row is 39px with px-3 py-2 cells — so a
  skeleton assembled from them lands where the page
  lands. Imports nothing but Skeleton.
==================================================
*/

import type { CSSProperties, ReactNode } from 'react';
import { Skeleton } from './Skeleton';

/** A line of text, w × h in px (h defaults to a 10px line) */
export const Line = ({ w, h = 10, className = '', style }: { w: number | string; h?: number; className?: string; style?: CSSProperties }) => (
  <Skeleton className={className} line style={{ width: w, height: h, ...style }} />
);

/** A box, w × h in px */
export const Block = ({ w, h, className = '', style }: { w: number | string; h: number | string; className?: string; style?: CSSProperties }) => (
  <Skeleton className={className} style={{ width: w, height: h, ...style }} />
);

/** A DropdownSelect trigger's footprint: h-7 (28) by rest, rounded-md — h 24 for the small size a card head wears */
export const Trigger = ({ w, h = 28, className = '' }: { w: number; h?: number; className?: string }) => <Skeleton className={`rounded-md ${className}`} style={{ width: w, height: h }} />;

/** A ScopeChip's footprint (the mark · SPY · chevron | link, 2026-09-09): 103 × 24 */
export const ScopeChipMark = ({ className = '' }: { className?: string }) => <Skeleton className={`h-6 w-[103px] rounded-md ${className}`} />;

/** A section title row the house way: 15px title + the scope chip + the guide door, 24px tall */
export const TitleRow = ({ title = 144, chip = true, door = true }: { title?: number; chip?: boolean; door?: boolean }) => (
  <div className="h-6 flex items-center gap-3">
    <Line w={title} h={14} />
    {chip && <ScopeChipMark />}
    {door && <Line w={72} h={12} />}
  </div>
);

/** The 11px sub line under a title, 17px tall */
export const SubLine = ({ w = 560 }: { w?: number | string }) => (
  <div className="mt-0.5 h-[17px] flex items-center">
    <Line w={w} h={10} className="max-w-full" />
  </div>
);

/** Facts as label-over-value in a grid — the dl every Pinpoint head carries */
export const Facts = ({ widths, cols }: { widths: number[]; cols?: number }) => (
  <dl className="grid gap-x-6" style={{ gridTemplateColumns: `repeat(${cols ?? widths.length}, auto)` }}>
    {widths.map((w, i) => (
      <div key={i}>
        <div className="h-[15px] flex items-center">
          <Line w={Math.min(64, w)} h={10} />
        </div>
        <div className="mt-0.5 h-[18px] flex items-center">
          <Line w={w} h={12} />
        </div>
      </div>
    ))}
  </dl>
);

/** A chart's ground: one quiet block with a price axis down its right edge and a time axis along its foot */
export const ChartGround = ({ className = '', axis = 60, foot = 22 }: { className?: string; axis?: number; foot?: number }) => (
  <div className={`relative h-full w-full ${className}`} data-skeleton="chart">
    <div className="absolute inset-0 flex">
      <Skeleton className="flex-1 min-w-0 rounded-none opacity-60" style={{ marginBottom: foot }} />
      <div className="shrink-0 flex flex-col justify-between py-3 pl-2 pr-1" style={{ width: axis, marginBottom: foot }}>
        {Array.from({ length: 9 }, (_, i) => (
          <Line key={i} w={axis - 16} h={8} />
        ))}
      </div>
    </div>
    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-4" style={{ height: foot, paddingRight: axis + 8 }}>
      {Array.from({ length: 7 }, (_, i) => (
        <Line key={i} w={30} h={8} />
      ))}
    </div>
  </div>
);

/** The box every Pinpoint band sits in */
export const Box = ({ children, className = '', style, ...rest }: { children: ReactNode; className?: string; style?: CSSProperties } & Record<`data-${string}`, string | undefined>) => (
  <div className={`border border-borderSubtle rounded-md bg-panel ${className}`} style={style} {...rest}>
    {children}
  </div>
);
