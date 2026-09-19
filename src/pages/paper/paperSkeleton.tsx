/*
==================================================
  SLAYER TERMINAL - THE PAPER DESK'S SKELETON
  (pages/paper/paperSkeleton.tsx)

  The desk standing in as itself while its chunk
  travels: the shell head with its six facts, the
  chart with its strip, the rail with the ticket's
  rows, the blotter's head and rows. Imports
  nothing heavy.
==================================================
*/

import { ClipboardPen } from 'lucide-react';
import { Block, ChartGround, Facts, Line, Trigger } from '../../components/ui/skeletonKit';

const CARD = 'rgb(var(--panel))';

export const PaperPageSkeleton = () => (
  <div className="relative flex-1 min-h-0 flex flex-col" aria-hidden aria-busy="true" aria-label="Loading" data-skeleton="paper">
    <header className="shrink-0 flex items-start gap-6 flex-wrap pb-3 border-b border-borderSubtle">
      <div className="min-w-0 flex-1">
        <div className="h-6 flex items-center gap-2.5">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-md border border-borderSubtle text-textSecondary shrink-0">
            <ClipboardPen className="w-3.5 h-3.5" />
          </span>
          <span className="text-[15px] font-semibold leading-tight text-textPrimary">Paper</span>
          <Block w={40} h={16} className="rounded" />
          <Line w={72} h={12} />
        </div>
        <p className="mt-0.5 text-[11px] text-textMuted whitespace-nowrap truncate">Trade the chart — futures and options against the live market state, on paper. Right-click a price to start.</p>
      </div>
      <Facts widths={[92, 88, 96, 90, 84, 84]} />
    </header>
    <div className="relative flex-1 min-h-0 mt-4 grid grid-cols-[minmax(0,1fr)_272px] grid-rows-[minmax(0,3fr)_minmax(0,2fr)] gap-2.5">
      <div className="min-h-0 min-w-0">
        <div className="h-full relative overflow-hidden rounded-md border border-ink/[0.07]" style={{ background: CARD }}>
          <div className="absolute inset-0">
            <ChartGround />
          </div>
          <div className="absolute top-0 inset-x-0 z-20 flex flex-wrap items-center gap-x-2.5 gap-y-1 pl-2 pr-[76px] py-1">
            <Block w={112} h={28} className="rounded-full" />
            <Line w={56} h={11} />
            <Line w={80} h={10} />
            {[28, 28, 28, 32, 32, 28].map((w, i) => (
              <Line key={i} w={w} h={9} />
            ))}
          </div>
        </div>
      </div>
      <div className="min-h-0 min-w-0">
        <div className="h-full flex flex-col overflow-hidden rounded-md border border-ink/[0.07]" style={{ background: CARD }}>
          <div className="flex items-center gap-2 px-3 h-8 border-b border-ink/[0.05]">
            <Line w={70} h={10} />
            <Block w={40} h={16} className="ml-auto rounded" />
          </div>
          <div className="px-3 pt-2.5 flex flex-col gap-2.5">
            {[0, 1, 2].map(i => (
              <div key={i} className="flex items-center justify-between h-[22px]">
                <Line w={48} h={8} />
                <Line w={110} h={10} />
              </div>
            ))}
            <div className="flex items-center gap-1.5">
              <Trigger w={24} />
              <Trigger w={48} />
              <Trigger w={24} />
              <span className="ml-auto inline-flex gap-1">
                {[0, 1, 2, 3].map(i => (
                  <Block key={i} w={26} h={24} className="rounded" />
                ))}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Block w="100%" h={40} className="rounded-md" />
              <Block w="100%" h={40} className="rounded-md" />
            </div>
          </div>
        </div>
      </div>
      <div className="min-h-0 min-w-0 col-span-2">
        <div className="h-full flex flex-col overflow-hidden rounded-md border border-ink/[0.07]" style={{ background: CARD }}>
          <div className="flex items-center gap-4 px-2.5 min-h-8 border-b border-ink/[0.05]">
            {[64, 48, 48, 30].map((w, i) => (
              <Line key={i} w={w} h={9} />
            ))}
          </div>
          <div className="flex items-center gap-3 px-3 h-8 border-b border-ink/[0.06]">
            {[60, 40, 40, 70, 60, 80, 70, 60].map((w, i) => (
              <Line key={i} w={w} h={8} className={i > 2 ? 'ml-auto' : ''} />
            ))}
          </div>
          {[0, 1, 2].map(r => (
            <div key={r} className="flex items-center gap-3 px-3 h-[39px] border-b border-ink/[0.04]" style={{ opacity: 1 - r * 0.2 }}>
              {[64, 44, 36, 76, 66, 84, 74, 64].map((w, i) => (
                <Line key={i} w={w} h={10} className={i > 2 ? 'ml-auto' : ''} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

export default PaperPageSkeleton;
