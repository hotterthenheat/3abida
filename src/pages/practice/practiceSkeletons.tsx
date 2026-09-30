/*
  PRACTICE · THE SKELETONS — each page stands in as its own shape while its code travels (the house rule, skeleton-sweep):
  Paper is the chart beside the right column (the account over the order) over the book; a backtest's list is a box with a
  head and rows, its desk a chart beside a chain over a blotter beside a ticket; the Journal is its head, the month beside
  the figures, two charts, the five cuts.
*/

import { ChartSkeleton, Skeleton, TableSkeleton } from '../../components/ui/Skeleton';

const BoxSkeleton = ({ rows = 8 }: { rows?: number }) => (
  <div className="border border-borderSubtle rounded-md bg-panel overflow-hidden" aria-busy="true">
    <div className="px-5 pt-4 pb-3 flex items-start gap-6">
      <div className="flex-1 min-w-0">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-2 h-3 w-[60%]" />
      </div>
      <Skeleton className="h-8 w-56" />
    </div>
    <div className="px-5 pb-3 flex gap-2">
      <Skeleton className="h-7 w-32" />
      <Skeleton className="h-7 w-28" />
      <Skeleton className="h-7 w-36" />
    </div>
    <TableSkeleton rows={rows} />
  </div>
);

const BacktestDeskSkeleton = () => (
  <div className="flex flex-col gap-2.5" aria-busy="true">
    <Skeleton className="h-[52px] w-full rounded-md" />
    <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_440px]">
      <ChartSkeleton className="h-[468px] rounded-md" />
      <Skeleton className="h-[468px] rounded-md" />
    </div>
    <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_440px]">
      <Skeleton className="h-[240px] rounded-md" />
      <Skeleton className="h-[240px] rounded-md" />
    </div>
  </div>
);

const PaperSkeleton = () => (
  <div className="flex flex-col gap-2.5" aria-busy="true">
    <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_440px]">
      <ChartSkeleton className="h-[560px] rounded-md" />
      <div className="flex flex-col gap-2.5">
        <Skeleton className="h-[264px] rounded-md" />
        <Skeleton className="h-[286px] rounded-md" />
      </div>
    </div>
    <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_440px]">
      <Skeleton className="h-[200px] rounded-md" />
    </div>
  </div>
);

const JournalSkeleton = () => (
  <div className="flex flex-col gap-3" aria-busy="true">
    <Skeleton className="h-[132px] rounded-md" />
    <div className="grid gap-3 items-start lg:grid-cols-[minmax(0,1fr)_340px]">
      <Skeleton className="h-[520px] rounded-md" />
      <Skeleton className="h-[520px] rounded-md" />
    </div>
    <div className="grid gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <ChartSkeleton className="h-[320px] rounded-md" />
      <Skeleton className="h-[320px] rounded-md" />
    </div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 min-[1700px]:grid-cols-5">
      {[0, 1, 2, 3, 4].map(i => (
        <Skeleton key={i} className="h-[230px] rounded-md" />
      ))}
    </div>
  </div>
);

/** Which page is on its way, by its address */
export const PracticePageSkeleton = ({ pathname }: { pathname: string }) => {
  if (pathname.startsWith('/practice/paper')) return <PaperSkeleton />;
  if (pathname.startsWith('/practice/journal')) return <JournalSkeleton />;
  if (/^\/practice\/backtest\/[^/]+$/.test(pathname)) return <BacktestDeskSkeleton />;
  return <BoxSkeleton rows={pathname.includes('/report') ? 6 : 8} />;
};

/** The whole route, shell head and all — AppShell's fallback while the section's layout itself travels */
export const PracticeRouteSkeleton = ({ pathname }: { pathname: string }) => (
  <>
    <div className="pb-3 border-b border-borderSubtle" aria-busy="true">
      <Skeleton className="h-5 w-36" />
      <Skeleton className="mt-2 h-3 w-[48%]" />
    </div>
    <div className="mt-4">
      <PracticePageSkeleton pathname={pathname} />
    </div>
  </>
);
