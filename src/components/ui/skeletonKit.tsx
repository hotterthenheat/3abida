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

/** A DropdownSelect trigger's footprint: h-7, rounded-md */
export const Trigger = ({ w, className = '' }: { w: number; className?: string }) => <Skeleton className={`h-7 rounded-md ${className}`} style={{ width: w }} />;

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

/** A panel header the house way: h-10, px-4, a title at the left and something at the right */
export const PanelHeader = ({ title = 127, right = 190 }: { title?: number; right?: number }) => (
  <header className="flex items-center justify-between gap-3 px-4 h-10 border-b border-borderSubtle shrink-0">
    <Line w={title} h={11} />
    {right > 0 && <Line w={right} h={12} />}
  </header>
);

/** A read line under a border: the Trace family's "Tape read" strip */
export const ReadStrip = ({ label = 58, w = '88%' }: { label?: number; w?: number | string }) => (
  <div className="flex items-start gap-2.5 border-l-2 pl-3 py-0.5 border-borderMuted h-[21px]">
    <Line w={label} h={10} className="mt-[3px]" />
    <Line w={w} h={10} className="mt-[3px] flex-1" />
    <Line w={50} h={10} className="mt-[3px]" />
  </div>
);

/** A house table: a 32px sticky head and 39px rows of px-3 py-2 cells, in the given column widths */
export const TableRows = ({ cols, rows, className = '', rowH = 39, headH = 32 }: { cols: number[]; rows: number; className?: string; rowH?: number; headH?: number }) => (
  <div className={`w-full border-t border-borderSubtle ${className}`}>
    <div className="overflow-hidden">
      <table className="w-full border-collapse" style={{ minWidth: cols.reduce((a, b) => a + b, 0) }}>
        <thead>
          <tr className="bg-chip border-b border-borderSubtle" style={{ height: headH }}>
            {cols.map((w, i) => (
              <th key={i} className="px-3 py-2 text-left" style={{ width: w }}>
                <Line w={Math.max(24, w - 30)} h={9} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, r) => (
            <tr key={r} className="border-b border-borderSubtle/60" style={{ height: rowH, opacity: 1 - Math.min(0.5, r * 0.035) }}>
              {cols.map((w, i) => (
                <td key={i} className="px-3 py-2">
                  <Line w={Math.max(20, Math.round((w - 24) * (0.55 + ((r * 7 + i * 3) % 5) * 0.09)))} h={12} className={i > 1 ? 'ml-auto' : ''} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
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
