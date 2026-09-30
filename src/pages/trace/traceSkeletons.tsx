/*
==================================================
  SLAYER TERMINAL - TRACE'S SKELETONS BY PAGE
  (pages/trace/traceSkeletons.tsx)

  Every Trace page standing in as itself while its
  code travels: the shell's head (the page's real
  icon, name and line — static chrome renders as
  itself), then the house box every walked page is
  (the walk, 2026-09-09): the head with its facts,
  one line of cards, the sentence, and the page's
  body — the grid in its window with the house's
  32px head and 39px rows, Net Flow's board and
  pane, 0DTE's panes, the tape's grid and rail, the
  Tracker's note, the dark pool's shelves. Imports
  nothing heavy.
==================================================
*/

import type { ReactNode } from 'react';
import { Block, ChartGround, Facts, Line, SubLine, TitleRow, Trigger } from '../../components/ui/skeletonKit';
import { TRACE_SUBPAGES } from './subnav';

/** THE SKELETON'S GRID: the rest of the first screen under the box's head, cards and sentence.
    The live grid grows with its rows since 2026-09-11 and runs past the fold; above the fold
    the stand-in and the page are the same shape, so the skeleton keeps a screen's worth. */
export const TRACE_GRID_H = 'calc(100vh - 247px)';
/** Windows carries the day strip above its box (60px and the gap) */
export const WINDOWS_GRID_H = 'calc(100vh - 317px)';

/* ---- the head ------------------------------------------------------------------ */

/** The shell's head, static chrome rendered as itself: the page's icon and name over its line (the tabs live in the sidebar tree since 2026-09-09) */
export const TraceStripSkeleton = ({ pathname }: { pathname: string }) => {
  const active = TRACE_SUBPAGES.find(p => pathname.startsWith(p.path)) ?? TRACE_SUBPAGES[0];
  const PageIcon = active.icon;
  return (
    <header className="flex items-start gap-6 flex-wrap pb-3 border-b border-borderSubtle" aria-hidden data-skeleton="trace-head">
      <div className="min-w-0 flex-1">
        <div className="h-6 flex items-center gap-2.5">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-md border border-borderSubtle text-textSecondary shrink-0">
            <PageIcon className="w-3.5 h-3.5" />
          </span>
          <span className="text-[15px] font-semibold leading-tight text-textPrimary">{active.label}</span>
        </div>
        <p className="mt-0.5 text-[11px] text-textMuted whitespace-nowrap truncate">{active.subtitle}</p>
      </div>
    </header>
  );
};

/* ---- the box ------------------------------------------------------------------- */

/** The grid in its window: the house's 32px head and 39px rows */
const GridWindow = ({ cols, rows, gridH }: { cols: number; rows: number; gridH: string }) => (
  <div className="border-t border-borderSubtle overflow-hidden" style={{ height: gridH }}>
    <div className="flex items-center gap-3 px-3 border-b border-borderSubtle h-[32px]">
      {Array.from({ length: cols }, (_, i) => (
        <Line key={i} w={[40, 50, 70, 30, 40, 60, 40, 40, 50, 50, 40, 40, 40, 40, 40, 40, 60][i % 17]} h={8} />
      ))}
    </div>
    {Array.from({ length: rows }, (_, r) => (
      <div key={r} className="flex items-center gap-3 px-3 border-b border-borderSubtle/60 h-[39px]">
        {Array.from({ length: cols }, (_, i) => (
          <Line key={i} w={[60, 60, 110, 30, 40, 70, 50, 50, 60, 50, 50, 40, 40, 40, 40, 50, 80][i % 17]} h={10} style={{ opacity: 0.9 - (r / rows) * 0.4 }} />
        ))}
      </div>
    ))}
  </div>
);

/** A WALKED page standing: the head with its facts, one line of cards (the hold 31px, the cards 28 — the line is 39), the sentence, then the page's body — the grid in its window unless the page brings its own */
export const TraceBoxSkeleton = ({
  title = 80,
  facts = [150, 110, 50, 140, 140, 140],
  triggers = [70, 170, 118, 96, 96, 118, 128, 118],
  right = [130],
  cols = 17,
  gridH = TRACE_GRID_H,
  rows = 18,
  className = '',
  hold = true,
  children,
}: {
  title?: number;
  facts?: number[];
  triggers?: number[];
  /** The cards at the line's right end — the column chooser */
  right?: number[];
  cols?: number;
  gridH?: string;
  rows?: number;
  className?: string;
  /** The line opens with the 31px hold — every page but the tape, which runs (2026-09-12) */
  hold?: boolean;
  children?: ReactNode;
}) => (
  <div className={`border border-borderSubtle rounded-md overflow-hidden bg-panel flex flex-col ${className}`} aria-hidden data-skeleton="trace-box">
    <div className="px-5 pt-4 pb-3 flex items-start gap-6 flex-wrap">
      <div className="min-w-0 flex-1">
        <TitleRow title={title} chip={false} />
        <SubLine w={560} />
      </div>
      <Facts widths={facts} />
    </div>
    <div className="px-5 pb-2 flex items-center gap-2 flex-wrap">
      {triggers.map((w, i) => (i === 0 && hold ? <Block key={i} w={w} h={31} className="rounded-md" /> : <Trigger key={i} w={w} />))}
      {right.length > 0 && (
        <span className="ml-auto flex items-center gap-2">
          {right.map((w, i) => (
            <Trigger key={i} w={w} />
          ))}
        </span>
      )}
    </div>
    <div className="px-5 pb-3 h-[32px] flex items-center">
      <Line w="58%" h={11} />
    </div>
    {children ?? <GridWindow cols={cols} rows={rows} gridH={gridH} />}
  </div>
);

/* ---- the bodies the pages bring ------------------------------------------------ */

/** A net-flow pane: the head of cards and figures, the chart */
const PaneSkeleton = ({ name = false, search = false, expand = false }: { name?: boolean; search?: boolean; expand?: boolean }) => (
  <div className="border border-borderSubtle bg-panel rounded-md overflow-hidden flex flex-col h-full">
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-2.5 py-1 min-h-8 shrink-0">
      {name ? (
        <span className="flex items-center gap-1.5">
          <Block w={16} h={16} className="rounded-full" />
          <Line w={34} h={11} />
        </span>
      ) : (
        <Block w={86} h={24} className="rounded-full" />
      )}
      {search && <Block w={144} h={25} className="rounded-md" />}
      <Trigger w={96} />
      {name && <Trigger w={118} />}
      <Line w={291} className="ml-auto" />
      {expand && <Block w={20} h={20} className="rounded" />}
    </div>
    <div className="relative flex-1 min-h-0">
      <ChartGround />
    </div>
  </div>
);

/** Net Flow: the board at the left, the picked name's pane at the right */
const NetFlowBody = () => (
  <div className="flex flex-1 min-h-0 border-t border-borderSubtle">
    <div className="w-[290px] shrink-0 border-r border-borderSubtle overflow-hidden">
      {Array.from({ length: 18 }, (_, i) => (
        <div key={i} className="flex flex-col gap-1 px-3 py-2 border-b border-borderSubtle/60 h-[51px]" style={{ opacity: 1 - Math.min(0.6, i * 0.035) }}>
          <div className="flex items-center justify-between">
            <Line w={44} h={12} />
            <Line w={56} h={12} />
          </div>
          <div className="flex items-center justify-between">
            <Line w={120} h={9} />
            <Line w={40} h={9} />
          </div>
        </div>
      ))}
    </div>
    <div className="flex-1 min-w-0 p-2">
      <PaneSkeleton name />
    </div>
  </div>
);

/** 0DTE: the desk of panes, two by two */
const OdteBody = () => (
  <div className="grid grid-cols-1 lg:grid-cols-2 lg:grid-rows-2 gap-2 flex-1 min-h-0 border-t border-borderSubtle p-2">
    {[0, 1, 2, 3].map(i => (
      <div key={i} className="min-h-0">
        <PaneSkeleton search expand />
      </div>
    ))}
  </div>
);

/** The Tracker's note when nothing is under watch — a sentence with doors, not a grid */
const TrackerBody = () => (
  <div className="border-t border-borderSubtle px-5 pt-[22px] h-[67px]">
    <Line w="62%" h={11} />
  </div>
);

/** The dark pool: the shelves beside the grid — the role, the price, the share bar; the card under them */
const DarkPoolBody = () => (
  <div className="flex border-t border-borderSubtle">
    <div className="w-[320px] shrink-0 border-r border-borderSubtle flex flex-col" style={{ height: TRACE_GRID_H }}>
      <div className="px-4 pt-3 pb-2">
        <Line w={70} h={11} />
        <Line w={200} h={9} className="mt-[5px]" />
      </div>
      {[210, 112, 164, 96, 140, 80].map((w, i) => (
        <div key={i} className="px-4 py-2 border-t border-borderSubtle/60 h-[52px]">
          <div className="flex items-center gap-2 h-[16px]">
            <Line w={60} h={9} />
            <Line w={46} h={12} />
            <Line w={34} h={9} />
            <Line w={44} h={10} className="ml-auto" />
          </div>
          <div className="mt-1 flex items-center gap-2 h-[14px]">
            <span className="flex-1 h-[4px] rounded-full bg-ink/[0.05]">
              <Line w={`${(w / 210) * 100}%`} h={4} />
            </span>
            <Line w={120} h={9} />
          </div>
        </div>
      ))}
      <div className="mt-auto border-t border-borderSubtle px-4 py-3">
        <Line w={180} h={10} />
      </div>
    </div>
    <div className="flex-1 min-w-0 -mt-px">
      <GridWindow cols={10} rows={18} gridH={TRACE_GRID_H} />
    </div>
  </div>
);

/** Compare: two panes over the ledger */
const CompareBody = () => (
  <div className="border-t border-borderSubtle">
    <div className="grid grid-cols-2">
      {[0, 1].map(i => (
        <div key={i} className={`flex flex-col ${i === 0 ? 'border-r border-borderSubtle' : ''}`}>
          <div className="flex items-center gap-2 px-3 h-9 border-b border-borderSubtle">
            <Line w={10} h={8} />
            <Block w={16} h={16} className="rounded-full" />
            <Line w={34} h={11} />
            <Line w={50} h={10} />
            <Line w={70} h={10} className="ml-auto" />
          </div>
          <div className="h-[340px] p-2">
            <PaneSkeleton name />
          </div>
          <div className="flex items-center gap-4 px-3 h-8 border-y border-borderSubtle">
            <Line w={50} h={8} />
            <Line w={60} h={9} />
            <Line w={70} h={9} />
            <Line w={90} h={9} className="ml-auto" />
          </div>
        </div>
      ))}
    </div>
    {Array.from({ length: 9 }, (_, i) => (
      <div key={i} className="flex items-center px-5 h-8 border-t border-borderSubtle/50">
        <Line w={[90, 70, 64, 80, 110, 96, 60, 70, 90][i]} h={10} />
        <Line w={70} h={10} className="ml-auto" />
        <Line w={70} h={10} className="ml-[170px]" />
      </div>
    ))}
  </div>
);

/* ---- the pages ----------------------------------------------------------------- */

/** The page under the strip, by path */
export const TracePageSkeleton = ({ pathname }: { pathname: string }) => {
  if (pathname.startsWith('/trace/screener')) return <TraceBoxSkeleton title={72} />;
  if (pathname.startsWith('/trace/net-flow'))
    return (
      <TraceBoxSkeleton title={215} facts={[150, 230, 110, 150, 150]} triggers={[70, 170]} right={[]} className="flex-1 min-h-0">
        <NetFlowBody />
      </TraceBoxSkeleton>
    );
  if (pathname.startsWith('/trace/footprints')) return <TraceBoxSkeleton title={196} facts={[170, 150, 150, 150, 140]} triggers={[70, 170, 118, 96]} cols={16} />;
  if (pathname.startsWith('/trace/watchers')) return <TraceBoxSkeleton title={180} facts={[150, 60, 150, 150, 150]} triggers={[70, 170, 150, 96, 120]} cols={13} />;
  if (pathname.startsWith('/trace/windows'))
    return (
      <>
        <div className="relative select-none">
          <div className="relative h-11 flex items-end gap-px px-px border-b border-borderMuted">
            {Array.from({ length: 78 }, (_, i) => (
              <Block key={i} w="100%" h={4 + ((i * 11) % 13) * 2 + (i > 66 ? 8 : 0)} className="rounded-none" style={{ opacity: i > 66 ? 0.6 : 0.3 }} />
            ))}
          </div>
          <div className="relative h-4 flex items-center justify-between px-2">
            {Array.from({ length: 8 }, (_, i) => (
              <Line key={i} w={22} h={8} />
            ))}
          </div>
        </div>
        <TraceBoxSkeleton title={180} facts={[190, 40, 150, 150, 170]} triggers={[70, 300, 170, 118, 96]} cols={19} gridH={WINDOWS_GRID_H} />
      </>
    );
  if (pathname.startsWith('/trace/odte'))
    return (
      <TraceBoxSkeleton title={150} facts={[60, 90, 90, 220]} triggers={[70, 110]} right={[]} className="flex-1 min-h-0">
        <OdteBody />
      </TraceBoxSkeleton>
    );
  if (pathname.startsWith('/trace/multi-leg')) return <TraceBoxSkeleton title={96} facts={[130, 110, 160, 170, 150]} triggers={[70, 170, 118, 110, 150]} cols={15} />;
  if (pathname.startsWith('/trace/compare'))
    return (
      <TraceBoxSkeleton title={190} facts={[90, 90, 150, 150, 150, 150]} triggers={[70, 180, 24, 180, 28, 150]} right={[]}>
        <CompareBody />
      </TraceBoxSkeleton>
    );
  if (pathname.startsWith('/trace/dark-pool'))
    return (
      <TraceBoxSkeleton title={110} facts={[110, 120, 140, 150, 170, 150, 190]} triggers={[70, 130, 110, 120]}>
        <DarkPoolBody />
      </TraceBoxSkeleton>
    );
  if (pathname.startsWith('/trace/tracker'))
    return (
      <TraceBoxSkeleton title={100} facts={[80, 200]} triggers={[70, 170]} right={[]}>
        <TrackerBody />
      </TraceBoxSkeleton>
    );
  /* The tape: no hold on its line, no rail beside its grid (2026-09-12) */
  return <TraceBoxSkeleton title={70} facts={[150, 180, 130, 90, 140, 140, 150]} triggers={[170, 100, 150, 100, 110, 150]} right={[130]} cols={19} hold={false} />;
};

/** The whole route standing: the strip, then the rows in the container the layout gives them */
export const TraceRouteSkeleton = ({ pathname }: { pathname: string }) => {
  const bleed = /^\/trace\/(net-flow|odte)/.test(pathname);
  return (
    <>
      <TraceStripSkeleton pathname={pathname} />
      <div className={`flex flex-col gap-2.5 ${bleed ? 'flex-1 min-h-0' : ''}`} aria-busy="true" aria-label="Loading">
        <TracePageSkeleton pathname={pathname} />
      </div>
    </>
  );
};
