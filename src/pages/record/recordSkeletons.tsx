/*
==================================================
  SLAYER TERMINAL - THE RECORD'S SKELETONS
  (pages/record/recordSkeletons.tsx)

  What stands in for the Record's pages while their
  code travels: the shell's head with the page's
  real icon and words, then the page's own shape —
  Insiders and Congress as the house table box (the
  head, one line of cards, the sentence, the grid at
  its 30px head and 44px rows); News as the wire (the
  head, the cards, the map's 960:440 pane beside the
  400px story column, 34px rows, the sentence) over
  the day's two columns. Earnings keeps the one page
  skeleton until its own walk. Imports nothing heavy.
==================================================
*/

import { PageSkeleton, Skeleton } from '../../components/ui/Skeleton';
import { Block, Facts, Line, SubLine, TitleRow, Trigger } from '../../components/ui/skeletonKit';
import { RECORD_SUBPAGES } from './subnav';

/** The grid's geometry, shared with the pages so the two cannot drift */
export const GRID_HEAD_H = 30;
export const GRID_ROW_H = 44;
/** The wire's rows and the day's rows (News.tsx) */
export const NEWS_ROW_H = 34;
/* The grids' stand-in heights: the rest of the first screen under each page's
   head, cards, sentence and strip. The live grids grow with their rows since
   2026-09-11 and run past the fold; above the fold the stand-in and the page
   are the same shape, so each skeleton keeps a screen's worth. */
/** Insiders: the names-to-know strip carries six cards */
export const NAMES_TO_KNOW = 6;
export const INSIDERS_GRID_H = 'calc(100vh - 367px)';
/** Congress: the reports-to-know strip, the same shape */
export const REPORTS_TO_KNOW = 6;
export const CONGRESS_GRID_H = 'calc(100vh - 367px)';
/** The map's drawing: 960 × 440 at the box's width, beside a 400px story column */
export const NEWS_STORY_W = 400;
/** Stocks: the rotation strip carries the universe's ten sectors */
export const ROTATION_SECTORS = 10;
export const STOCKS_GRID_H = 'calc(100vh - 362px)';

export const RecordShellSkeleton = ({ pathname }: { pathname: string }) => {
  const page = RECORD_SUBPAGES.find(p => pathname.startsWith(p.path)) ?? RECORD_SUBPAGES[0];
  const PageIcon = page.icon;
  return (
    <header className="flex items-start gap-6 flex-wrap pb-3 border-b border-borderSubtle" aria-hidden data-skeleton="record-shell">
      <div className="min-w-0 flex-1">
        <div className="h-6 flex items-center gap-2.5">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-md border border-borderSubtle text-textSecondary shrink-0">
            <PageIcon className="w-3.5 h-3.5" />
          </span>
          <span className="text-[15px] font-semibold leading-tight text-textPrimary">{page.label}</span>
        </div>
        <p className="mt-0.5 text-[11px] text-textMuted whitespace-nowrap truncate">{page.subtitle}</p>
      </div>
      <Facts widths={[260]} />
    </header>
  );
};

/** A feed page standing: the head with four facts, four cards, the sentence, the grid.
    `bare` is the Earnings grid box: a plain head (title + line, no facts, cards or sentence) over the grid */
export const RecordTableInner = ({ rows = 12, cols = 8, title = 120, bare = false }: { rows?: number; cols?: number; title?: number; bare?: boolean }) => (
  <section className="flex flex-col min-w-0" aria-hidden data-skeleton="record-table">
    {bare ? (
      <div className="px-5 pt-4 pb-3">
        <div className="h-[19px] flex items-center">
          <Line w={title} h={12} />
        </div>
        <SubLine w={420} />
      </div>
    ) : (
      <>
        <div className="px-5 pt-4 pb-3 flex items-start gap-6 flex-wrap">
          <div className="min-w-0 flex-1">
            <TitleRow title={title} chip={false} />
            <SubLine w={640} />
          </div>
          <Facts widths={[60, 72, 96, 110]} />
        </div>
        <div className="px-5 pb-2 flex items-center gap-2 flex-wrap">
          <Trigger w={128} />
          <Trigger w={126} />
          <Trigger w={120} />
          <Trigger w={150} />
          <Skeleton className="h-7 w-[176px] rounded-md ml-auto" />
        </div>
        {/* the sentence: one line of 12px on relaxed leading, plus its pb-3 (measured 32) */}
        <div className="px-5 pb-3 h-[32px] flex items-center">
          <Line w="62%" h={11} />
        </div>
      </>
    )}
    <div className="flex items-center gap-3 px-3 border-b border-borderSubtle" style={{ height: GRID_HEAD_H }}>
      {Array.from({ length: cols }, (_, i) => (
        <Line key={i} w={[46, 120, 90, 70, 60, 110, 60, 40][i % 8]} h={8} />
      ))}
    </div>
    {Array.from({ length: rows }, (_, r) => (
      <div key={r} className="flex items-center gap-3 px-3 border-b border-borderSubtle/60" style={{ height: GRID_ROW_H }}>
        {Array.from({ length: cols }, (_, i) => (
          <Line key={i} w={[40, 140, 110, 80, 64, 130, 60, 36][i % 8]} h={10} style={{ opacity: 0.9 - (r / rows) * 0.4 }} />
        ))}
      </div>
    ))}
  </section>
);

export const RecordTableBoxSkeleton = (props: { rows?: number; cols?: number; title?: number; bare?: boolean }) => (
  <div className="border border-borderSubtle rounded-md overflow-hidden bg-panel">
    <RecordTableInner {...props} />
  </div>
);

/** The wire standing: the head with four facts, four cards, the map beside the story card, the rows, the sentence.
    The wire drips 24 stories through a day (news.ts FEED_SIZE) — 21 is an afternoon's count */
export const NewsInner = ({ rows = 21 }: { rows?: number }) => (
  <div className="flex flex-col min-w-0" aria-hidden data-skeleton="news-wire">
    <div className="px-5 pt-4 pb-3 flex items-start gap-6 flex-wrap">
      <div className="min-w-0 flex-1">
        <TitleRow title={68} chip={false} />
        <SubLine w={640} />
      </div>
      <Facts widths={[150, 70, 96, 130]} />
    </div>
    <div className="px-5 pb-3 flex items-center gap-2 flex-wrap">
      <Trigger w={96} />
      <Trigger w={116} />
      <Trigger w={128} />
      <Trigger w={104} />
      {/* the heat legend: cool · warm · hot · where the news lands (measured 241) */}
      <Line w={241} h={9} className="ml-2" />
      {/* the Filter card at rest prints "Everything" (measured 138) */}
      <Trigger w={138} className="ml-auto" />
    </div>
    <div className="grid border-t border-borderSubtle" style={{ gridTemplateColumns: `minmax(0, 1fr) ${NEWS_STORY_W}px` }}>
      <div className="min-w-0 flex flex-col border-r border-borderSubtle">
        <div className="px-2 pt-2">
          <div className="relative w-full" style={{ aspectRatio: '960 / 440' }}>
            {[[0.2, 0.36], [0.28, 0.4], [0.47, 0.3], [0.52, 0.34], [0.72, 0.42], [0.8, 0.5], [0.62, 0.58], [0.3, 0.62]].map(([x, y], i) => (
              <Skeleton key={i} className="absolute rounded-full" style={{ left: `${x * 100}%`, top: `${y * 100}%`, width: 10 + (i % 3) * 4, height: 10 + (i % 3) * 4 }} />
            ))}
          </div>
        </div>
        {/* the drip bar, then the read line */}
        <div className="px-4 h-[28px] border-t border-borderSubtle flex items-center gap-3">
          <Block w={14} h={14} />
          <Line w={26} h={9} />
          <Skeleton className="h-[2px] flex-1 rounded-full" />
          <Line w={26} h={9} />
          <Line w={30} h={9} className="ml-2" />
        </div>
        <div className="px-4 h-[26px] border-t border-borderSubtle flex items-center">
          <Line w={420} h={9} />
          <Line w={90} h={9} className="ml-auto" />
        </div>
      </div>
      <div className="px-4 pt-3 pb-3 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Block w={16} h={16} className="rounded-full" />
          <Line w={44} h={12} />
          <Line w={40} h={9} />
          <Line w={90} h={9} className="ml-auto" />
        </div>
        <Line w="92%" h={12} />
        <Line w="70%" h={12} />
        <Skeleton className="h-[4px] w-full rounded-full" />
        <div className="grid grid-cols-3 gap-x-3 gap-y-2.5">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i}>
              <Line w={64} h={8} />
              <Line w={48} h={12} className="mt-1" />
            </div>
          ))}
        </div>
        <Skeleton className="h-[6px] w-full rounded-full" />
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i}>
            <Line w={70} h={8} />
            <Line w="96%" h={10} className="mt-1" />
            <Line w="60%" h={10} className="mt-1" />
          </div>
        ))}
      </div>
    </div>
    <div className="border-t border-borderSubtle">
      <div className="px-5 h-[22px] flex items-center gap-3">
        {[30, 34, 30, 36, 60, 30, 28].map((w, i) => (
          <Line key={i} w={w} h={8} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="px-5 grid items-center gap-x-3 border-t border-borderSubtle/40" style={{ height: NEWS_ROW_H, gridTemplateColumns: '72px 104px 96px 72px minmax(0, 1fr) 76px 72px' }}>
          <Line w={36} h={9} />
          <Line w={54} h={10} />
          <Line w={60} h={9} />
          <Line w={40} h={8} />
          <Line w={`${52 + ((r * 17) % 40)}%`} h={10} />
          <Line w={40} h={10} className="ml-auto" />
          <Line w={28} h={9} className="ml-auto" />
        </div>
      ))}
    </div>
    {/* the sentence: pt-3 + one 12px line on relaxed leading + pb-4 (measured 49) */}
    <div className="px-5 pb-4 pt-3 border-t border-borderSubtle/40 h-[49px] flex items-center">
      <Line w="30%" h={11} />
    </div>
  </div>
);

export const NewsPageSkeleton = () => (
  <>
    <div className="border border-borderSubtle rounded-md bg-panel">
      <NewsInner />
    </div>
    <div className="border border-borderSubtle rounded-md bg-panel">
      {/* the day's head has no door and no chip: the 15px title stands 19px tall */}
      <div className="px-5 pt-4 pb-3">
        <div className="h-[19px] flex items-center">
          <Line w={60} h={12} />
        </div>
        <SubLine w={420} />
      </div>
      <div className="grid border-t border-borderSubtle" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)' }}>
        <div className="border-r border-borderSubtle">
          <div className="px-5 h-[22px] flex items-center">
            <Line w={160} h={8} />
          </div>
          {/* the calendar keeps a print for ten hours after it lands — a dozen rows through the afternoon */}
          {Array.from({ length: 12 }, (_, r) => (
            <div key={r} className="px-5 flex items-center gap-3 border-t border-borderSubtle/40" style={{ height: NEWS_ROW_H }}>
              <Line w={`${40 + ((r * 13) % 30)}%`} h={10} />
              <Line w={28} h={9} className="ml-auto" />
              <Line w={48} h={9} />
            </div>
          ))}
        </div>
        <div>
          <div className="px-5 h-[22px] flex items-center">
            <Line w={60} h={8} />
          </div>
          {Array.from({ length: 4 }, (_, r) => (
            <div key={r} className="px-5 py-2.5 border-t border-borderSubtle/40">
              <Line w={110} h={9} />
              <Line w="94%" h={10} className="mt-2" />
              <Line w="58%" h={10} className="mt-1.5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  </>
);

/** A box head in the house grammar with no door and no chip: 15px title + 11px line (66px with its padding) */
const PlainHead = ({ title = 120, sub = 420 }: { title?: number; sub?: number }) => (
  <div className="px-5 pt-4 pb-3">
    <div className="h-[19px] flex items-center">
      <Line w={title} h={12} />
    </div>
    <SubLine w={sub} />
  </div>
);

/** The calendar standing: the head with four facts, three cards, the sentence, THE BOARD of five days (the default since 2026-09-10), then the grid of both weeks */
export const EarningsPageSkeleton = () => (
  <>
    <div className="border border-borderSubtle rounded-md bg-panel" data-skeleton="earnings">
      <div className="px-5 pt-4 pb-3 flex items-start gap-6 flex-wrap">
        <div className="min-w-0 flex-1">
          <TitleRow title={92} chip={false} />
          <SubLine w={560} />
        </div>
        <Facts widths={[92, 150, 150, 130]} />
      </div>
      <div className="px-5 pb-2 flex items-center gap-2 flex-wrap">
        <Trigger w={129} />
        <Trigger w={144} />
        <Trigger w={119} />
      </div>
      <div className="px-5 pb-3 h-[32px] flex items-center">
        <Line w="70%" h={11} />
      </div>
      <div className="border-t border-borderSubtle">
        {/* five days, each a list of shelves (before the open / after the close) with a card count — a week with one two-shelf day */}
        <div className="grid grid-cols-5 gap-px bg-borderSubtle/60">
          {[[1], [], [2], [], [1, 1]].map((shelves, d) => (
            <div key={d} className="bg-panel px-3 py-3 min-h-[176px]">
              <div className="h-[15px] flex items-center">
                <Line w={62} h={11} />
              </div>
              <span className="block h-px mt-1.5 bg-borderSubtle" />
              {d === 1 ? (
                /* an empty day with a macro date's chip under its head */
                <div className="mt-2.5 flex">
                  <Block w={44} h={24} className="rounded-md" />
                </div>
              ) : shelves.length === 0 ? (
                <div className="mt-7 flex justify-center">
                  <Line w={64} h={8} />
                </div>
              ) : (
                <div className="mt-2.5 flex flex-col gap-3">
                  {shelves.map((n, s) => (
                    <div key={s}>
                      <div className="h-[13px] flex items-center px-1">
                        <Line w={92} h={8} />
                      </div>
                      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                        {Array.from({ length: n }, (_, i) => (
                          <span key={i} className="flex flex-col items-center gap-1.5 rounded-md border border-borderSubtle bg-chip px-2 pt-3 pb-2.5">
                            <Block w={28} h={28} className="rounded-md" />
                            <Line w={34} h={12} className="mt-0.5" />
                            <Line w={40} h={11} />
                            <span className="h-3 flex items-center">
                              <Line w={52} h={8} />
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
    <RecordTableBoxSkeleton rows={14} cols={8} title={96} bare />
  </>
);

/** A name's page standing: the way back, the name, the replay, the two charts, after the print, the contracts, the record */
export const EarningsNameSkeleton = () => (
  <>
    <div className="h-[15px] flex items-center">
      <Line w={92} h={9} />
    </div>
    <div className="border border-borderSubtle rounded-md bg-panel" data-skeleton="earnings-name">
      <div className="px-5 pt-4 pb-4 flex items-start gap-6 flex-wrap">
        <div className="min-w-0 flex-1 flex items-center gap-3">
          <Block w={34} h={34} className="rounded-md" />
          <div>
            <TitleRow title={110} chip={false} door={false} />
            {/* the line under the name carries the slot mark, so it stands 22px (measured 80 for the head) */}
            <div className="mt-0.5 h-[22px] flex items-center">
              <Line w={380} h={9} />
            </div>
          </div>
        </div>
        <Facts widths={[110, 60, 90, 150, 84]} />
      </div>
      <div className="px-5 pb-3 flex items-center gap-2">
        {[68, 68, 76, 72].map((w, i) => (
          <Skeleton key={i} className="h-6 rounded-md" style={{ width: w }} />
        ))}
      </div>
    </div>
    <div className="border border-borderSubtle rounded-md bg-panel">
      <PlainHead title={168} sub={470} />
      <div className="px-5 pb-4 flex flex-col gap-3">
        {/* the price line carries a 16px figure: 24px */}
        <div className="h-[24px] flex items-center gap-2.5">
          <Line w={130} h={9} />
          <Line w={50} h={14} />
          <Line w={90} h={9} />
        </div>
        <div className="mx-auto w-full max-w-[640px]">
          <div className="relative" style={{ height: 112 }}>
            <span className="absolute inset-x-0 top-1/2 h-px bg-ink/10" />
            <div className="absolute inset-y-0 left-24 right-0 flex items-stretch gap-1.5">
              {[0.5, -0.8, 0.3, -0.4, 0.9, -0.6, 0.2, -0.7].map((v, i) => (
                <span key={i} className="relative flex-1">
                  <Skeleton className="absolute left-1/2 -translate-x-1/2 w-[22px] rounded-[2px]" style={v >= 0 ? { bottom: '50%', height: 56 * v } : { top: '50%', height: 56 * -v }} />
                </span>
              ))}
            </div>
          </div>
          <div className="flex gap-1.5 mt-1 pl-24 h-[14px] items-center">
            {Array.from({ length: 8 }, (_, i) => (
              <span key={i} className="flex-1 flex justify-center">
                <Line w={24} h={8} />
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2.5 h-[20px]">
          <Line w={220} h={12} />
          <Line w={110} h={9} />
        </div>
        <div className="pt-3 border-t border-borderSubtle/60">
          <Facts widths={[110, 80, 140, 60, 70]} />
        </div>
      </div>
    </div>
    <div className="grid grid-cols-2 gap-4">
      {[0, 1].map(i => (
        <div key={i} className="border border-borderSubtle rounded-md bg-panel">
          <PlainHead title={i === 0 ? 118 : 88} sub={i === 0 ? 420 : 340} />
          <div className="px-5 pb-4">
            <div className="h-[132px] flex items-end gap-3 pl-10 pr-2 pb-5">
              {[0.5, 0.7, 0.4, 0.8, 0.6, 0.9, 0.5, 0.7].map((v, k) => (
                <Skeleton key={k} className="flex-1 rounded-t-[2px]" style={{ height: `${v * 100}%` }} />
              ))}
            </div>
            <div className="mt-2 h-[12px] flex items-center">
              <Line w={200} h={8} />
            </div>
          </div>
        </div>
      ))}
    </div>
    <div className="border border-borderSubtle rounded-md bg-panel">
      <PlainHead title={112} sub={520} />
      <div className="px-5 pb-4">
        <Facts widths={[60, 60, 60, 70]} />
      </div>
    </div>
    <div className="grid grid-cols-2 gap-4">
      {[0, 1].map(i => (
        <div key={i} className="border border-borderSubtle rounded-md bg-panel">
          <PlainHead title={100} sub={330} />
          <div className="pb-2">
            {Array.from({ length: 3 }, (_, k) => (
              <div key={k} className="px-5 py-2.5 border-t border-borderSubtle/40 flex flex-col gap-1">
                <div className="flex items-baseline gap-2 h-[18px]">
                  <Line w={150} h={11} />
                  <Line w={50} h={11} className="ml-auto" />
                </div>
                <div className="flex items-center gap-2 h-[16px]">
                  <Line w={20} h={8} />
                  <Skeleton className="w-24 h-[4px] rounded-full" />
                  <Line w={40} h={10} />
                  <Line w={160} h={9} />
                </div>
                <div className="h-[15px] flex items-center">
                  <Line w={180} h={9} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
    <div className="grid grid-cols-2 gap-4">
      {[0, 1].map(i => (
        <div key={i} className="border border-borderSubtle rounded-md bg-panel">
          <PlainHead title={i === 0 ? 140 : 160} sub={300} />
          <div className="px-5 h-[22px] flex items-center gap-6">
            {[30, 30, 34, 40, 38, 50].map((w, k) => (
              <Line key={k} w={w} h={8} />
            ))}
          </div>
          {/* a name on the fortnight's calendar carries a couple of rows on the record, rarely more */}
          {Array.from({ length: 2 }, (_, k) => (
            <div key={k} className="px-5 h-[38px] flex items-center gap-4 border-t border-borderSubtle/40">
              <Line w={40} h={9} />
              <span className="flex flex-col gap-1">
                <Line w={110} h={10} />
                <Line w={80} h={8} />
              </span>
              <Line w={40} h={9} className="ml-auto" />
              <Line w={70} h={9} />
            </div>
          ))}
          <div className="px-5 py-2.5 border-t border-borderSubtle/40 h-[38px] flex items-center">
            <Line w={90} h={9} className="ml-auto" />
          </div>
        </div>
      ))}
    </div>
  </>
);

/* The row counts are the default window's (90 days): Congress files about 45
   reports, Insiders about 140 open-market rows — more than a first screen holds,
   so the stand-in draws the first screen's worth */
/** A feed page with a to-know strip standing (Insiders, Congress): the head and cards, the sentence, six cards, the grid in its window */
export const FeedStripPageSkeleton = ({ name, title, triggers, cols, widths, gridH }: { name: string; title: number; triggers: number[]; cols: number; widths: number[]; gridH: string }) => (
  <div className="border border-borderSubtle rounded-md overflow-hidden bg-panel flex flex-col" data-skeleton={name}>
    <div className="px-5 pt-4 pb-3 flex items-start gap-6 flex-wrap">
      <div className="min-w-0 flex-1">
        <TitleRow title={title} chip={false} />
        <SubLine w={640} />
      </div>
      <Facts widths={[60, 72, 96, 110]} />
    </div>
    <div className="px-5 pb-2 flex items-center gap-2 flex-wrap">
      {triggers.map((w, i) => (
        <Trigger key={i} w={w} />
      ))}
      <Trigger w={138} className="ml-auto" />
    </div>
    <div className="px-5 pb-3 h-[32px] flex items-center">
      <Line w="62%" h={11} />
    </div>
    <div className="px-5 pb-3 border-t border-borderSubtle/60">
      <div className="h-[26px] flex items-center gap-3">
        <Line w={96} h={8} />
        <Line w={420} h={9} />
      </div>
      {/* a name card: the mark row 18, the dollars row 16, the word 12 (measured 78 with its padding) */}
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${NAMES_TO_KNOW}, minmax(0, 1fr))` }}>
        {Array.from({ length: NAMES_TO_KNOW }, (_, i) => (
          <div key={i} className="rounded-md border border-borderSubtle px-3 py-2.5 flex flex-col">
            <div className="h-[18px] flex items-center gap-2">
              <Block w={18} h={18} className="rounded-full" />
              <Line w={40} h={11} />
              <Line w={70} h={8} />
            </div>
            <div className="mt-1.5 h-[18px] flex items-center gap-2">
              <Line w={44} h={12} />
              <Line w={60} h={8} />
              <Line w={40} h={8} className="ml-auto" />
            </div>
            <div className="mt-1 h-[12px] flex items-center">
              <Line w={70} h={7} />
            </div>
          </div>
        ))}
      </div>
    </div>
    <div className="border-t border-borderSubtle overflow-hidden" style={{ height: gridH }}>
      <div className="flex items-center gap-3 px-3 border-b border-borderSubtle" style={{ height: GRID_HEAD_H }}>
        {Array.from({ length: cols }, (_, i) => (
          <Line key={i} w={widths[i % widths.length]} h={8} />
        ))}
      </div>
      {Array.from({ length: 16 }, (_, r) => (
        <div key={r} className="flex items-center gap-3 px-3 border-b border-borderSubtle/60" style={{ height: GRID_ROW_H }}>
          {Array.from({ length: cols }, (_, i) => (
            <Line key={i} w={widths[i % widths.length] + 20} h={10} style={{ opacity: 0.9 - (r / 16) * 0.4 }} />
          ))}
        </div>
      ))}
    </div>
  </div>
);

export const InsidersPageSkeleton = () => <FeedStripPageSkeleton name="insiders" title={110} triggers={[128, 182, 110, 130]} cols={9} widths={[46, 120, 90, 70, 60, 110, 60, 40, 50]} gridH={INSIDERS_GRID_H} />;
export const CongressPageSkeleton = () => <FeedStripPageSkeleton name="congress" title={150} triggers={[128, 108, 100, 130]} cols={8} widths={[46, 150, 120, 70, 60, 180, 60, 40]} gridH={CONGRESS_GRID_H} />;

/** Stocks standing: the head with four facts, three cards, the sentence, the rotation's ten sector cards, the grid in its window */
export const StocksPageSkeleton = () => (
  <div className="border border-borderSubtle rounded-md overflow-hidden bg-panel flex flex-col" data-skeleton="stocks">
    <div className="px-5 pt-4 pb-3 flex items-start gap-6 flex-wrap">
      <div className="min-w-0 flex-1">
        <TitleRow title={168} chip={false} />
        <SubLine w={640} />
      </div>
      <Facts widths={[200, 40, 90, 110]} />
    </div>
    <div className="px-5 pb-2 flex items-center gap-2 flex-wrap">
      <Trigger w={130} />
      <Trigger w={130} />
      <Trigger w={130} />
      <Trigger w={138} className="ml-auto" />
    </div>
    <div className="px-5 pb-3 h-[32px] flex items-center">
      <Line w="62%" h={11} />
    </div>
    <div className="px-5 pb-3 border-t border-borderSubtle/60">
      <div className="h-[26px] flex items-center gap-3">
        <Line w={84} h={8} />
        <Line w={480} h={9} />
      </div>
      {/* a sector card: the rank row 18, the bar 4, the word row 12, the windows row 12 (with its padding 80) */}
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${ROTATION_SECTORS}, minmax(0, 1fr))` }}>
        {Array.from({ length: ROTATION_SECTORS }, (_, i) => (
          <div key={i} className="rounded-md border border-borderSubtle px-3 py-2.5 flex flex-col">
            <div className="h-[18px] flex items-center gap-1.5">
              <Line w={12} h={8} />
              <Block w={12} h={12} className="rounded" />
              <Line w={64} h={11} />
            </div>
            <div className="mt-1.5 h-[4px] rounded-full bg-ink/[0.06] overflow-hidden">
              <Line w={`${100 - i * 8}%`} h={4} />
            </div>
            <div className="mt-1 h-[12px] flex items-center">
              <Line w={44} h={7} />
            </div>
            <div className="mt-0.5 h-[12px] flex items-center">
              <Line w={80} h={8} />
            </div>
          </div>
        ))}
      </div>
    </div>
    <div className="border-t border-borderSubtle overflow-hidden" style={{ height: STOCKS_GRID_H }}>
      <div className="flex items-center gap-3 px-3 border-b border-borderSubtle" style={{ height: GRID_HEAD_H }}>
        {[120, 150, 60, 50, 60, 70, 70, 70, 70, 60, 200].map((w, i) => (
          <Line key={i} w={w} h={8} />
        ))}
      </div>
      {Array.from({ length: 16 }, (_, r) => (
        <div key={r} className="flex items-center gap-3 px-3 border-b border-borderSubtle/60" style={{ height: GRID_ROW_H }}>
          {[140, 150, 60, 50, 72, 80, 80, 80, 80, 60, 260].map((w, i) => (
            <Line key={i} w={w} h={i >= 5 && i <= 8 ? 4 : 10} style={{ opacity: 0.9 - (r / 16) * 0.4 }} />
          ))}
        </div>
      ))}
    </div>
  </div>
);

export const RecordPageSkeleton = ({ pathname }: { pathname: string }) => {
  if (pathname.startsWith('/record/insiders')) return <InsidersPageSkeleton />;
  if (pathname.startsWith('/record/congress')) return <CongressPageSkeleton />;
  if (pathname.startsWith('/record/stocks')) return <StocksPageSkeleton />;
  if (pathname.startsWith('/record/news')) return <NewsPageSkeleton />;
  if (/^\/record\/earnings\/[^/]+/.test(pathname)) return <EarningsNameSkeleton />;
  if (pathname.startsWith('/record/earnings')) return <EarningsPageSkeleton />;
  return <PageSkeleton />;
};

/** The whole route standing: the shell's head, then the page in its own frame */
export const RecordRouteSkeleton = ({ pathname }: { pathname: string }) => (
  <>
    <RecordShellSkeleton pathname={pathname} />
    <div className="flex flex-col gap-4 flex-grow min-h-[calc(100vh-174px)]" aria-busy="true" aria-label="Loading">
      <RecordPageSkeleton pathname={pathname} />
    </div>
  </>
);
