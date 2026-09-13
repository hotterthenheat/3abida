/*
==================================================
  SLAYER TERMINAL - PINPOINT'S SKELETONS BY PAGE
  (pages/pinpoint/pinpointSkeletons.tsx)

  What stands in for a Pinpoint page while its code
  travels (App's lazy routes) or its first read
  walks in. Noah, 2026-09-08: "the loading skeleton
  doesn't seem to take the shape of its container…
  a generic loading skeleton and that's a design
  flaw" — the shell showed ONE page skeleton for
  every route. Now every page stands in as its own
  boxes, drawn to the landed geometry measured at
  1500×1100 (scripts dump, 2026-09-08): the same
  paddings, the same heads, the same rows.

  STATIC CHROME RENDERS AS ITSELF: the shell row's
  page name and words come from the registry, so
  the row wraps exactly where the real one wraps
  (a one-line stand-in sat 22px short on Building).
  Only what data decides shimmers.

  Imports nothing heavy — no page, no simulator — so
  the shell can render these before any chunk lands.
==================================================
*/

import { Fragment } from 'react';
import { Skeleton } from '../../components/ui/Skeleton';
import { Block, Box, ChartGround, Facts, Line, ScopeChipMark, SubLine, TitleRow, Trigger } from '../../components/ui/skeletonKit';
import { BuildingPageSkeleton } from '../../components/gex/buildingSkeletons';
import { WallPageSkeleton } from '../../components/gex/wallSkeletons';
import { TargetsPageSkeleton } from '../../components/gex/targetsSkeletons';
import { ComparePageSkeleton } from '../../components/gex/compareSkeletons';
import { GEX_SUBPAGES } from './subnav';

/* ---- the shell row ------------------------------------------------------------- */

/** The shell's head — the page's real icon, name and words on the left; on the
    right the four facts as label-over-value blocks the width of the real ones
    (Dealers · Flip · Flip crossed today · To the close) and the Ruler card. */
export const PinpointShellSkeleton = ({ pathname }: { pathname: string }) => {
  const page = GEX_SUBPAGES.find(p => pathname.startsWith(p.path)) ?? GEX_SUBPAGES[0];
  const PageIcon = page.icon;
  return (
    <header className="flex items-start gap-6 flex-wrap pb-3 border-b border-borderSubtle" aria-hidden data-skeleton="pinpoint-shell">
      <div className="min-w-0 flex-1">
        <div className="h-6 flex items-center gap-2.5">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-md border border-borderSubtle text-textSecondary shrink-0">
            <PageIcon className="w-3.5 h-3.5" />
          </span>
          <span className="text-[15px] font-semibold leading-tight text-textPrimary">{page.label}</span>
        </div>
        <p className="mt-0.5 text-[11px] text-textMuted whitespace-nowrap truncate">{page.subtitle}</p>
      </div>
      <div className="flex items-center gap-6">
        <Facts widths={[112, 150, 58, 68]} />
        <Trigger w={86} />
      </div>
    </header>
  );
};

/* ---- the Map ------------------------------------------------------------------- */

const MAP_H = 'calc(100vh - 184px)';

/** The Map's box: the chart toolbar, the sentence row with its three dropdowns, the chart beside the profile panel */
export const MapBoxSkeleton = () => (
  <div className="relative border border-borderSubtle rounded-md overflow-hidden" style={{ height: MAP_H, minHeight: 560 }} aria-hidden data-skeleton="map-box">
    <div className="flex flex-col h-full min-h-0">
      {/* the chart toolbar, 38 */}
      <div className="shrink-0 flex items-center gap-2 flex-wrap px-2 py-1.5 bg-panel border-b border-borderSubtle">
        <ScopeChipMark />
        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-0.5">
            {[32, 32, 34, 34, 34, 34, 32, 34].map((w, i) => (
              <Block key={i} w={w} h={25} className="rounded" />
            ))}
          </span>
          <span className="inline-flex items-center gap-1">
            <Block w={112} h={25} className="rounded" />
            <Block w={96} h={25} className="rounded" />
            <Block w={103} h={25} className="rounded" />
          </span>
          <span className="w-px h-4 bg-borderSubtle" />
          <Block w={117} h={25} className="rounded" />
          <Block w={89} h={25} className="rounded" />
          <Block w={30} h={22} className="rounded" />
        </div>
      </div>
      {/* the sentence row, 43 */}
      <div className="shrink-0 px-2.5 py-1.5 border-b border-borderSubtle/60 flex items-center gap-2">
        <Block w={67} h={21} className="rounded" />
        <div className="min-w-0 flex-1 flex flex-col gap-[5px] py-[2px]">
          <Line w="72%" />
          <Line w="46%" />
        </div>
        <span className="shrink-0 inline-flex items-center gap-1.5 ml-1">
          <Line w={40} />
          <Block w={110} h={24} className="rounded-full" />
        </span>
        <span className="ml-auto shrink-0 inline-flex items-center gap-2">
          <Trigger w={112} />
          <Trigger w={103} />
        </span>
      </div>
      {/* the chart, the whole box (the strike panel left the Map on 2026-09-13) */}
      <div className="relative flex-1 min-h-0 flex">
        <div className="relative flex-1 min-w-0" style={{ background: '#0a0a0a' }}>
          <ChartGround axis={74} />
        </div>
      </div>
    </div>
  </div>
);

/** The greek board under the Map: five strips side by side — a head, a net line, the strike rows, the foot */
export const BoardInner = ({ panels = 5 }: { panels?: number }) => (
  <div className="h-full min-h-0 flex flex-col" aria-hidden data-skeleton="greek-board">
    <div className="flex-1 min-h-0 flex">
      {Array.from({ length: panels }, (_, p) => (
        <div key={p} className="flex-1 min-w-0 flex flex-col border-r border-borderSubtle last:border-r-0">
          <div className="shrink-0 flex items-center gap-1 px-1.5 py-1 border-b border-borderSubtle">
            <ScopeChipMark />
            <Trigger w={62} />
            <Trigger w={58} />
            <Line w={44} className="ml-auto" />
          </div>
          <div className="shrink-0 flex items-center gap-2 px-2 h-6 border-b border-borderSubtle/70">
            <Line w={22} h={8} />
            <Line w={54} h={9} />
            <Line w={70} h={8} />
          </div>
          <div className="shrink-0 flex items-center gap-4 px-2 h-6 border-b border-borderSubtle">
            <Line w={34} h={8} />
            <Line w={60} h={8} />
          </div>
          <div className="flex-1 min-h-0 flex flex-col justify-center gap-[6px] px-2 py-2">
            {Array.from({ length: 22 }, (_, r) => (
              <div key={r} className="flex items-center gap-3 h-[22px]">
                <Line w={28} h={10} />
                <div className="flex-1 flex flex-col gap-[3px]">
                  <Line w={`${34 + ((r * 13) % 30)}%`} h={10} />
                  <Line w={`${20 + ((r * 7) % 40)}%`} h={3} />
                </div>
              </div>
            ))}
          </div>
          <div className="shrink-0 flex items-center gap-3 px-2 h-6 border-t border-borderSubtle">
            <Line w={50} h={8} />
            <Line w={44} h={8} />
          </div>
        </div>
      ))}
    </div>
    <div className="shrink-0 flex items-center gap-3 px-3 h-9 border-t border-borderSubtle">
      <Line w={44} h={8} />
      <Block w={140} h={24} className="rounded" />
      <Block w={60} h={24} className="rounded" />
      <Block w={56} h={24} className="rounded" />
      <Block w={54} h={24} className="rounded" />
      <Line w={160} className="ml-auto" />
      <Block w={120} h={24} className="rounded" />
      <Line w={170} />
    </div>
  </div>
);
export const BoardBoxSkeleton = () => (
  <div className="border border-borderSubtle rounded-md overflow-hidden flex flex-col" style={{ height: MAP_H, minHeight: 560 }}>
    <BoardInner />
  </div>
);

/** The Day: the trader's clock — head with three facts, the phases strip, the schedule band, the line */
export const DayInner = () => (
    <section className="relative flex flex-col min-w-0" aria-hidden data-skeleton="day-box">
      <div className="px-5 pt-4 pb-3 flex items-start gap-6 flex-wrap">
        <div className="min-w-0 flex-1">
          <TitleRow title={130} />
          <SubLine w={520} />
        </div>
        <Facts widths={[88, 104, 96]} />
      </div>
      <div className="px-5 pb-4">
        <div className="relative h-5 flex items-center gap-1">
          {[14, 13, 22, 16, 20, 15].map((w, i) => (
            <Block key={i} w={`${w}%`} h={20} className="rounded-sm" style={{ opacity: 0.5 + (i % 2) * 0.25 }} />
          ))}
        </div>
        <div className="relative h-[42px] mt-0 flex items-end gap-[3px]">
          {Array.from({ length: 13 }, (_, i) => (
            <Block key={i} w="100%" h={8 + ((i * 5) % 7) * 4 + (i > 9 ? 10 : 0)} className="rounded-t-sm" style={{ opacity: 0.6 }} />
          ))}
        </div>
        <div className="mt-2 h-5 flex items-center">
          <Line w="58%" h={11} />
        </div>
      </div>
    </section>
);
export const DayBoxSkeleton = () => (
  <Box>
    <DayInner />
  </Box>
);

/** How the levels held today: a head and five level rows of 85px */
export const ReportInner = () => (
    <section className="relative flex flex-col min-w-0" aria-hidden data-skeleton="report-box">
      <div className="px-5 pt-4 pb-3">
        <TitleRow title={190} />
        <SubLine w={340} />
      </div>
      <ul className="flex flex-col">
        {[130, 110, 96, 120, 90].map((w, i) => (
          <li key={i} className="border-t border-borderSubtle/50 h-[85px] px-5 flex flex-col justify-center gap-2">
            <div className="flex items-center gap-4">
              <Line w={w} h={12} />
              <Line w={70} />
              <Block w="22%" h={6} className="rounded-full" />
              <Line w={64} className="ml-auto" />
              <Line w={64} />
              <Line w={64} />
            </div>
            <Line w="52%" />
          </li>
        ))}
      </ul>
    </section>
);
export const ReportBoxSkeleton = () => (
  <Box className="overflow-hidden">
    <ReportInner />
  </Box>
);

/** Your positions: the toolbar and the note (empty), the way the box opens */
export const PositionsInner = () => (
    <section className="flex flex-col min-w-0" aria-hidden data-skeleton="positions-box">
      <div className="flex items-center gap-3 flex-wrap px-5 pt-4 pb-3">
        <div className="min-w-0 h-[37px] flex flex-col justify-between py-[2px]">
          <Line w={105} h={13} />
          <Line w={80} />
        </div>
        <Block w={132} h={32} className="rounded-full" />
      </div>
      <div className="px-5 pb-5 max-w-[64ch] h-[74px] flex flex-col justify-between py-[3px]">
        <Line w="100%" />
        <Line w="92%" />
        <Line w="60%" />
      </div>
    </section>
);
export const PositionsBoxSkeleton = () => (
  <Box className="overflow-hidden">
    <PositionsInner />
  </Box>
);

export const MapPageSkeleton = () => (
  <>
    <MapBoxSkeleton />
    <BoardBoxSkeleton />
    <DayBoxSkeleton />
    <ReportBoxSkeleton />
    <PositionsBoxSkeleton />
  </>
);

/* ---- Ahead --------------------------------------------------------------------- */

/** The range: head with four facts, the one control (If vol), the price pane at its aspect, the half hours' head and pane, the sentences */
export const CorridorInner = () => (
    <section className="relative flex flex-col min-w-0" aria-hidden data-skeleton="corridor-box">
      <div className="px-5 pt-4 pb-2 flex items-start gap-6 flex-wrap">
        <div className="min-w-0 flex-1">
          <TitleRow title={92} />
          <SubLine w={620} />
        </div>
        <Facts widths={[118, 130, 140, 128]} />
      </div>
      <div className="px-5 pb-2 flex items-center gap-2 flex-wrap">
        <Skeleton className="h-7 w-[168px] rounded-md" />
        <Line w={230} h={9} className="ml-auto" />
      </div>
      <div className="relative">
        <div className="px-3">
          <div className="relative w-full" style={{ aspectRatio: '1200 / 300' }}>
            <ChartGround axis={74} foot={18} />
          </div>
        </div>
        <div className="px-5 pt-1 pb-1 h-[28px] flex items-baseline gap-5">
          <Line w={90} />
          <Line w={190} />
          <Line w={170} />
          <Line w={96} />
          <Line w={200} />
          <Line w={150} />
        </div>
        <div className="px-3">
          <div className="relative w-full" style={{ aspectRatio: '1200 / 118' }}>
            <div className="absolute inset-x-3 bottom-5 top-4 flex items-end gap-[6px]">
              {Array.from({ length: 13 }, (_, i) => (
                <Block key={i} w="100%" h={`${10 + ((i * 3) % 4) * 8 + (i > 9 ? 40 : 0)}%`} className="rounded-t-sm" style={{ opacity: i > 9 ? 0.7 : 0.35 }} />
              ))}
            </div>
          </div>
        </div>
        <div className="px-5 h-[14px] flex items-center">
          <Line w={200} h={9} />
        </div>
      </div>
      <div className="px-5 pb-4 pt-2 h-[92px] flex flex-col justify-center gap-[9px]">
        <Line w="62%" h={11} />
        <Line w="78%" h={11} />
        <Line w="70%" h={11} />
      </div>
    </section>
);
export const CorridorBoxSkeleton = () => (
  <Box>
    <CorridorInner />
  </Box>
);

/** Where it closes: the head with four facts, the drawing at the range's aspect — the two bands
    across it, the silhouette hugging the axis — the read line, the sentence (redrawn 2026-09-09) */
export const CloseInner = () => (
  <section className="relative flex flex-col min-w-0" aria-hidden data-skeleton="close-box">
    <div className="px-5 pt-4 pb-2 flex items-start gap-6 flex-wrap">
      <div className="min-w-0 flex-1">
        <TitleRow title={118} />
        <SubLine w={640} />
      </div>
      <Facts widths={[80, 96, 96, 150]} />
    </div>
    <div className="px-3">
      <div className="relative w-full" style={{ aspectRatio: '1200 / 300' }}>
        <ChartGround axis={74} foot={0} />
        <div className="absolute rounded-sm" style={{ left: '1%', right: 'calc(74px + 0.5%)', top: '30%', height: '36%', background: 'rgb(var(--ink) / 0.03)' }} />
        <div className="absolute rounded-sm" style={{ left: '1%', right: 'calc(74px + 0.5%)', top: '40%', height: '17%', background: 'rgba(199,211,232,0.07)' }} />
        <div className="absolute" style={{ right: 'calc(74px + 0.5%)', top: '12%', bottom: '10%', width: '46%' }}>
          <div className="absolute inset-0 rounded-l-full" style={{ background: 'linear-gradient(to left, rgba(199,211,232,0.14), rgba(199,211,232,0.02))', clipPath: 'ellipse(100% 50% at 100% 50%)' }} />
        </div>
      </div>
    </div>
    <div className="px-5 h-[18px] flex items-center">
      <Line w={320} h={9} />
    </div>
    {/* the three reads: most likely · the bands · the pull (2026-09-09) */}
    <div className="px-5 pb-4 pt-2 grid gap-x-4 gap-y-1.5" style={{ gridTemplateColumns: '84px minmax(0, 1fr)' }}>
      {[[52, '34%'], [46, '58%'], [40, '50%']].map(([l, w], i) => (
        <Fragment key={i}>
          <div className="h-[17px] flex items-center">
            <Line w={l as number} h={9} />
          </div>
          <div className="h-[17px] flex items-center">
            <Line w={w as string} h={11} />
          </div>
        </Fragment>
      ))}
    </div>
  </section>
);
export const CloseBoxSkeleton = () => (
  <Box>
    <CloseInner />
  </Box>
);

export const AheadPageSkeleton = () => (
  <>
    <CorridorBoxSkeleton />
    <CloseBoxSkeleton />
  </>
);

/* ---- Targets ------------------------------------------------------------------- */

/** The agenda and the axis, in their own file (components/gex/targetsSkeletons.tsx) */
export { TargetsPageSkeleton };

/* ---- Board --------------------------------------------------------------------- */

/** The board: its toolbar, the grid's head and its rows of 44 */
export const BoardPageSkeleton = ({ rows = 12 }: { rows?: number }) => (
  <div className="border border-borderSubtle rounded-md overflow-hidden flex flex-col" aria-hidden data-skeleton="board">
    <div className="shrink-0 flex items-center gap-3 flex-wrap px-2 py-1.5 bg-panel border-b border-borderSubtle/70 h-[38px]">
      <Line w={137} h={9} />
      <Line w={415} h={9} />
      <Block w={160} h={25} className="ml-auto rounded" />
      <Line w={164} h={9} />
    </div>
    {/* the grid, one block the way AG Grid mounts: a 30px head and rows of 44 */}
    <div style={{ height: 30 + rows * 44 + 1 }}>
      <div className="flex items-center gap-3 px-3 h-[30px] border-b border-borderSubtle/60">
        {[70, 90, 80, 90, 80, 80, 80, 80, 90, 100].map((w, i) => (
          <Line key={i} w={w} h={9} className={i > 0 ? 'ml-auto' : ''} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-3 px-3 h-[44px] border-b border-borderSubtle/40">
          <div className="flex items-center gap-2">
            <Block w={22} h={22} className="rounded-md" />
            <Line w={44} h={12} />
          </div>
          {[70, 70, 80, 70, 70, 80, 70, 90, 100].map((w, i) => (
            <Line key={i} w={w} h={11} className="ml-auto" />
          ))}
        </div>
      ))}
    </div>
  </div>
);

/* ---- by path ------------------------------------------------------------------- */

/** The page under the shell row, by path */
export const PinpointPageSkeleton = ({ pathname }: { pathname: string }) => {
  if (pathname.startsWith('/pinpoint/building')) return <BuildingPageSkeleton />;
  if (pathname.startsWith('/pinpoint/wall')) return <WallPageSkeleton />;
  if (pathname.startsWith('/pinpoint/ahead')) return <AheadPageSkeleton />;
  if (pathname.startsWith('/pinpoint/targets')) return <TargetsPageSkeleton />;
  if (pathname.startsWith('/pinpoint/board')) return <BoardPageSkeleton />;
  if (pathname.startsWith('/pinpoint/compare')) return <ComparePageSkeleton />;
  return <MapPageSkeleton />;
};

/** The whole route standing: the shell row, then the page in its own frame */
export const PinpointRouteSkeleton = ({ pathname }: { pathname: string }) => (
  <>
    <PinpointShellSkeleton pathname={pathname} />
    <div className="flex flex-col gap-4 flex-grow min-h-[calc(100vh-174px)]" aria-busy="true" aria-label="Loading">
      <PinpointPageSkeleton pathname={pathname} />
    </div>
  </>
);
