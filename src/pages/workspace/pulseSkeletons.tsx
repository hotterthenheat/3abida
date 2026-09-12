/*
==================================================
  SLAYER TERMINAL - PULSE'S SKELETONS
  (pages/workspace/pulseSkeletons.tsx)

  The desk standing in as itself: the head, the
  presets row, the toolbar, then the default
  layout's three panels — the live chart, the
  strike pressure ladder, the exposure ledger across
  the bottom — each with its drag head. And the
  board: the back button and its title, then four
  name cards two across. Landed geometry measured
  2026-09-08 at 1500×1100. Imports nothing heavy.
==================================================
*/

import { Block, ChartGround, Line, ScopeChipMark } from '../../components/ui/skeletonKit';
import { Skeleton } from '../../components/ui/Skeleton';

/** The tile head in the house grammar: the grip, the title with its one-line sub, the scope chip, the close */
const WidgetHead = ({ title, sub = 220 }: { title: number; sub?: number }) => (
  <div className="flex items-center gap-2.5 pl-3 pr-2.5 h-[42px] border-b border-borderSubtle shrink-0">
    <Block w={14} h={14} className="rounded-sm" />
    <div className="min-w-0 flex-1 flex flex-col justify-center gap-[3px]">
      <Line w={title} h={12} />
      <Line w={sub} h={9} />
    </div>
    <span className="ml-auto flex items-center gap-1.5">
      <ScopeChipMark />
      <Block w={28} h={28} className="rounded" />
    </span>
  </div>
);

/** The Targets panel standing: the one control, the sentence, the head row, the rows of 32 */
export const TargetsWidgetSkeleton = ({ rows = 12 }: { rows?: number }) => (
  <div className="h-full min-h-0 flex flex-col" aria-hidden data-skeleton="targets-widget">
    <div className="shrink-0 px-2 py-1.5 border-b border-borderSubtle/60 flex items-center gap-2 h-[41px]">
      <Block w={168} h={28} className="rounded-md" />
      <Line w={190} h={9} className="ml-auto" />
    </div>
    <div className="shrink-0 px-2.5 py-1.5 border-b border-borderSubtle/60 flex items-center gap-2 h-[31px]">
      <Line w={38} h={9} />
      <Line w="70%" h={10} />
    </div>
    <div className="shrink-0 grid items-center gap-x-2 px-2.5 h-6 border-b border-borderSubtle bg-chip" style={{ gridTemplateColumns: '28px minmax(0,1fr) 44px 92px 108px' }}>
      {[8, 34, 46, 34, 48].map((w, i) => (
        <div key={i} className={`flex ${i === 2 || i === 3 ? 'justify-end' : ''}`}>
          <Line w={w} h={8} />
        </div>
      ))}
    </div>
    <div className="flex-1 min-h-0 overflow-hidden">
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="grid items-center gap-x-2 px-2.5 h-8 border-b border-borderSubtle/30" style={{ gridTemplateColumns: '28px minmax(0,1fr) 44px 92px 108px', opacity: 1 - Math.min(0.55, r * 0.045) }}>
          <Line w={16} h={9} />
          <div className="flex items-center gap-1.5">
            <Line w={30} h={12} />
            {r % 3 === 0 && <Line w={36} h={8} />}
            <Line w={34} h={8} />
          </div>
          <Line w={26} h={10} className="ml-auto" />
          <div className="flex items-center justify-end gap-1.5">
            <Line w={26} h={10} />
            <Block w={36} h={5} className="rounded-full" />
          </div>
          <div className="relative h-8 flex items-center">
            <Block w={`${[70, 48, 60, 30, 22, 16, 12][r % 7]}%`} h={8} className="rounded-full" />
            <Line w={34} h={9} className="absolute right-0" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

const Widget = ({ title, sub, children, className = '' }: { title: number; sub?: number; children: React.ReactNode; className?: string }) => (
  <div className={`border border-borderSubtle bg-panel rounded-md overflow-hidden flex flex-col h-[488px] ${className}`}>
    <WidgetHead title={title} sub={sub} />
    <div className="flex-grow min-h-0 overflow-hidden relative">{children}</div>
  </div>
);

export const PulsePageSkeleton = () => (
  <>
    <div className="flex items-end justify-between gap-4 flex-wrap" aria-hidden data-skeleton="pulse">
      <div className="min-w-0">
        <div className="h-[15px] flex items-center gap-1.5">
          <Line w={60} h={9} />
          <Line w={110} h={9} />
        </div>
        <div className="mt-1.5 h-6 flex items-center gap-2">
          <Line w={80} h={20} />
          <Block w={64} h={20} className="rounded-full" />
        </div>
        <div className="mt-1.5 h-4 flex items-center">
          <Line w={520} />
        </div>
      </div>
    </div>
    <div className="flex items-center gap-2.5 flex-wrap h-[25px]" aria-hidden>
      <Line w={46} h={9} />
      <span className="flex items-center gap-0.5">
        <Block w={70} h={21} className="rounded" />
        <Block w={72} h={21} className="rounded" />
        <Block w={68} h={21} className="rounded" />
      </span>
      <span className="w-px h-3.5 bg-borderSubtle" />
      <Block w={85} h={25} className="rounded-md" />
    </div>
    <div className="flex items-center gap-3 flex-wrap h-[31px]" aria-hidden>
      <Block w={121} h={29} className="rounded-md" />
      <Block w={129} h={31} className="rounded-md" />
      <Line w={302} className="ml-auto" />
    </div>
    {/* the desk sits in a wrapper the real one has (its soft-in), then the grid */}
    <div aria-hidden aria-busy="true" aria-label="Loading">
    <div className="grid grid-cols-2 gap-3">
      <Widget title={62} sub={250}>
        <div className="flex flex-col absolute inset-0">
          <div className="h-[37px] shrink-0 flex items-center gap-2 px-2">
            {[32, 32, 34, 34, 34, 96, 103].map((w, i) => (
              <Block key={i} w={w} h={25} className="rounded" />
            ))}
          </div>
          <div className="flex-1 min-h-0">
            <ChartGround />
          </div>
        </div>
      </Widget>
      <Widget title={140} sub={290}>
        <div className="absolute inset-0 flex flex-col">
          <div className="h-[41px] flex items-center px-2 gap-2">
            {[96, 108, 122].map((w, i) => (
              <Block key={i} w={w} h={28} className="rounded-md" />
            ))}
            <Block w={28} h={28} className="rounded ml-auto" />
          </div>
          <div className="flex-1 min-h-0 relative">
            {Array.from({ length: 21 }, (_, i) => {
              const t = Math.abs(i - 10) / 10;
              const w = 14 + Math.round((1 - t) * 60 * (0.6 + ((i * 7) % 5) * 0.12));
              return (
                <div key={i} className="absolute inset-x-0 flex items-center" style={{ top: `${(i + 0.5) * (100 / 21)}%` }}>
                  <div className="absolute left-2 w-10">
                    <Line w={30} h={8} />
                  </div>
                  <div className="absolute left-14 right-3">
                    <Block w={`${w}%`} h={11} className="rounded-full" style={{ opacity: 0.55 + (1 - t) * 0.45 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Widget>
      <Widget title={104} sub={330} className="col-span-2">
        <div className="absolute inset-0 flex flex-col">
          <div className="shrink-0 border-b border-borderSubtle/60">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 pt-2 pb-1.5 h-[46px]">
              <Line w={80} h={13} />
              <Block w={180} h={26} className="rounded-md" />
              <Block w={232} h={32} className="rounded-md ml-auto" />
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 px-3 pb-2 h-[36px]">
              {[103, 170, 158, 101, 140].map((w, i) => (
                <Block key={i} w={w} h={28} className="rounded-md" />
              ))}
            </div>
          </div>
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="shrink-0 flex items-center gap-5 px-3 py-2 border-b border-borderSubtle/60 h-[34px]">
              <Line w={30} h={13} />
              <Line w={120} />
              <Line w={70} />
              <Line w={180} className="ml-auto" />
            </div>
            <div className="flex-1 min-h-0 grid" style={{ gridTemplateColumns: '66px repeat(8, minmax(0, 1fr))', gridTemplateRows: '22px 22px repeat(6, minmax(14px, 1fr)) 18px repeat(6, minmax(14px, 1fr))' }}>
              <div className="row-span-2 px-2 flex items-end pb-1 border-b border-borderSubtle">
                <Line w={36} h={9} />
              </div>
              <div className="col-span-8 px-2 flex items-center justify-center border-l border-borderSubtle">
                <Line w={90} h={9} />
              </div>
              {Array.from({ length: 8 }, (_, i) => (
                <div key={`h-${i}`} className={`px-2 flex items-center justify-end border-b border-borderSubtle ${i === 0 ? 'border-l' : ''}`}>
                  <Line w={64} h={9} />
                </div>
              ))}
              {Array.from({ length: 13 }, (_, r) =>
                r === 6 ? (
                  <div key="spot" className="col-span-9 px-2 flex items-center gap-1.5">
                    <span className="h-px flex-grow bg-gradient-to-r from-ink/[0.04] via-ink/[0.14] to-ink/[0.18]" />
                    <Line w={24} h={9} />
                    <Block w={48} h={15} className="rounded-[3px]" />
                    <span className="h-px w-3 shrink-0 bg-ink/[0.18]" />
                  </div>
                ) : (
                  [
                    <div key={`s-${r}`} className="px-2 flex items-center">
                      <Line w={30} h={11} />
                    </div>,
                    ...Array.from({ length: 8 }, (_, c) => (
                      <div key={`c-${r}-${c}`} className={`min-w-0 px-[3px] py-[2px] ${c === 0 ? 'border-l border-borderSubtle/60' : ''}`}>
                        <Skeleton className="h-full w-full rounded-full" style={{ opacity: 0.45 + 0.55 * (1 - Math.abs(r - 6) / 6) }} />
                      </div>
                    )),
                  ]
                )
              )}
            </div>
          </div>
        </div>
      </Widget>
    </div>
    </div>
  </>
);

/** The board: the back button and the title, then the name cards two across */
export const PulseBoardSkeleton = () => (
  <>
    <div className="flex items-center gap-3 h-[35px]" aria-hidden data-skeleton="pulse-board">
      <Block w={32} h={32} className="rounded-md" />
      <div className="flex flex-col justify-between h-[35px] py-[2px]">
        <Line w={160} h={16} />
        <Line w={286} h={10} />
      </div>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3" aria-hidden aria-busy="true" aria-label="Loading">
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="relative flex flex-col min-h-0 overflow-hidden border border-borderSubtle rounded-md bg-panel">
          <div className="shrink-0 w-full flex items-center gap-2.5 flex-wrap px-2.5 py-1.5 h-[69px]">
            <Block w={78} h={28} className="rounded-md" />
            <Line w={47} h={11} />
            <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
              {[70, 80, 90, 70, 80].map((w, k) => (
                <Line key={k} w={w} />
              ))}
            </div>
          </div>
          <div className="h-[38vh] min-h-[300px] relative">
            <ChartGround />
          </div>
        </div>
      ))}
    </div>
  </>
);
