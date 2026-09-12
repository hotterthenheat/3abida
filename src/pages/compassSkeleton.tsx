/*
==================================================
  SLAYER TERMINAL - THE COMPASS'S SKELETON
  (pages/compassSkeleton.tsx)

  The board standing in as itself (the walk,
  2026-09-11): the shell head as static chrome,
  then the box — the head with its facts, the four
  cards, the sentence, the cards window — beside
  the rail of heaviest contracts (a head, the
  sticky column heads, rows of 62). Imports
  nothing heavy.
==================================================
*/

import { Compass as CompassIcon } from 'lucide-react';
import { Block, ChartGround, Facts, Line, PanelHeader, SubLine, TitleRow, Trigger } from '../components/ui/skeletonKit';

/** The shell head as static chrome — the page's icon and name over its line (CompassLayout renders the real one) */
export const CompassHeadSkeleton = () => (
  <header className="flex items-start gap-6 flex-wrap pb-3 border-b border-borderSubtle" aria-hidden data-skeleton="compass-head">
    <div className="min-w-0 flex-1">
      <div className="h-6 flex items-center gap-2.5">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-md border border-borderSubtle text-textSecondary shrink-0">
          <CompassIcon className="w-3.5 h-3.5" />
        </span>
        <span className="text-[15px] font-semibold leading-tight text-textPrimary">Compass</span>
      </div>
      <p className="mt-0.5 text-[11px] text-textMuted whitespace-nowrap truncate">The setups found this sweep, graded and ranked — Active while the structure holds, Watch while it proves itself</p>
    </div>
  </header>
);

/** Under the shell: the board for /compass, a setup's page for /compass/<id> */
export const CompassRouteSkeleton = ({ pathname }: { pathname: string }) =>
  /^\/compass\/[^/]+/.test(pathname) ? (
    <>
      <div className="h-[15px] flex items-center" aria-hidden data-skeleton="setup-back">
        <Line w={84} h={10} />
      </div>
      <CampaignSkeleton />
    </>
  ) : (
    <CompassPageSkeleton />
  );

export const CompassPageSkeleton = () => (
  <>
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch" aria-hidden aria-busy="true" aria-label="Loading" data-skeleton="compass">
      <div className="xl:col-span-8 min-w-0">
        <div className="border border-borderSubtle rounded-md overflow-hidden bg-panel flex flex-col">
          <div className="px-5 pt-4 pb-3 flex items-start gap-6 flex-wrap">
            <div className="min-w-0 flex-1">
              <TitleRow title={74} chip={false} />
              <SubLine w={480} />
            </div>
            {/* Found · Active · Proving · Fading · Top pick · Found at — measured 2026-09-11 */}
            <Facts widths={[30, 30, 36, 31, 119, 52]} />
          </div>
          <div className="px-5 pb-2 flex items-center gap-2 flex-wrap">
            <Trigger w={159} />
            <Trigger w={155} />
            <Trigger w={128} />
            <Trigger w={119} />
          </div>
          <div className="px-5 pb-3 h-[32px] flex items-center">
            <Line w="72%" h={11} />
          </div>
          {/* The box grows with the cards (a typical sweep finds a dozen or so) */}
          <div className="border-t border-borderSubtle px-5 pt-4 pb-5">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              {Array.from({ length: 12 }, (_, i) => (
                <div key={i} className="rounded-md border border-borderSubtle p-3.5 flex flex-col gap-3 h-[138px]" style={{ opacity: 1 - Math.min(0.5, Math.floor(i / 2) * 0.12) }}>
                  <div className="flex items-center gap-2 h-[24px]">
                    <Line w={18} h={10} />
                    <Block w={78} h={22} className="rounded" />
                    <Block w={92} h={22} className="rounded" />
                    <Block w={68} h={20} className="rounded ml-auto" />
                  </div>
                  <div className="flex items-start justify-between gap-2 h-[30px]">
                    <div className="flex flex-col gap-1">
                      <Line w={40} h={8} />
                      <Line w={44} h={13} />
                    </div>
                    <Block w={96} h={30} className="rounded" style={{ opacity: 0.5 }} />
                    <div className="flex flex-col items-end gap-1">
                      <Line w={44} h={8} />
                      <Line w={40} h={13} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 h-[26px]">
                    <Line w={140} h={11} />
                    <Block w={64} h={24} className="rounded ml-auto" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="xl:col-span-4 min-w-0 flex flex-col xl:sticky xl:top-5 xl:self-start xl:h-[calc(100vh-40px)]">
        <div className="border border-borderSubtle rounded-md overflow-hidden bg-panel flex flex-col w-full flex-1 min-h-0">
          <div className="px-5 pt-4 pb-3">
            <TitleRow title={150} chip={false} door={false} />
            <SubLine w={320} />
          </div>
          <div className="flex-1 min-h-0 overflow-hidden border-t border-borderSubtle">
            <div className="grid grid-cols-4 gap-2 px-3 pt-2 pb-1.5 border-b border-borderSubtle h-[33px]">
              {[0, 1, 2, 3].map(k => (
                <Line key={k} w={40} h={9} />
              ))}
            </div>
            {Array.from({ length: 14 }, (_, i) => (
              <div key={i} className="px-3 py-2 border-b border-borderSubtle/50 h-[62px] flex flex-col justify-between" style={{ opacity: 1 - Math.min(0.6, i * 0.05) }}>
                <div className="flex items-center gap-2">
                  <Line w={24} h={11} />
                  <Line w={110} h={12} />
                  <Line w={50} h={11} className="ml-auto" />
                </div>
                <div className="flex items-center gap-2">
                  <Line w={160} h={9} />
                  <Line w={40} h={9} className="ml-auto" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </>
);

/** A setup's page standing in (the name's history still walking in): the
    head box (the logo, the contract, its state, the facts), the chart beside
    the trade card (7/5), the contracts around it as a grid. Measured
    2026-09-11: 77 · 649 · 257. */
export const CampaignSkeleton = () => (
  <div className="flex flex-col gap-4" aria-hidden aria-busy="true" aria-label="Loading" data-skeleton="campaign">
    <div className="border border-borderSubtle rounded-md bg-panel h-[77px] px-5 flex items-center gap-6">
      <div className="min-w-0 flex-1 flex items-center gap-3">
        <Block w={34} h={34} className="rounded-md" />
        <div className="min-w-0">
          <div className="h-6 flex items-center gap-2.5">
            <Line w={84} h={14} />
            <Block w={62} h={20} className="rounded" />
            <Block w={40} h={17} className="rounded" />
            <Line w={60} h={9} />
            <Line w={72} h={12} />
          </div>
          <SubLine w={420} />
        </div>
      </div>
      {/* Premium · Confidence · The case · Targets · Breaks at · Liquidity — measured 2026-09-11 */}
      <Facts widths={[41, 91, 43, 118, 86, 123]} />
    </div>
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch h-[649px]">
      <div className="xl:col-span-7 min-w-0 flex flex-col border border-borderSubtle rounded-md bg-panel overflow-hidden">
        <div className="flex items-center gap-2.5 pl-2 py-1 h-[36px]">
          <Block w={150} h={28} className="rounded-full" />
          <Line w={90} h={9} />
          <Line w={220} h={9} className="ml-4" />
        </div>
        <div className="flex-grow min-h-0 relative">
          <ChartGround />
        </div>
      </div>
      <div className="xl:col-span-5 min-w-0 flex flex-col border border-borderSubtle rounded-md bg-panel overflow-hidden">
        <div className="px-5 pt-4 pb-3 flex items-start gap-6">
          <div className="min-w-0 flex-1">
            <TitleRow title={68} chip={false} door={false} />
            <SubLine w={220} />
          </div>
          <Line w={110} h={10} />
        </div>
        <div className="flex-1 p-3 border-t border-borderSubtle flex flex-col gap-4">
          <div className="border border-borderSubtle rounded-md overflow-hidden">
            <div className="h-[30px] border-b border-borderSubtle bg-inset px-3 flex items-center">
              <Line w={60} h={8} />
            </div>
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex items-center justify-between h-[36px] px-3 border-b border-borderSubtle last:border-0">
                <Line w={54} h={10} />
                <Line w={40} h={11} />
                <Line w={40} h={10} />
                <Line w={56} h={10} />
              </div>
            ))}
            <div className="h-[38px] px-3 flex items-center">
              <Line w="88%" h={9} />
            </div>
          </div>
          <div className="border border-borderSubtle bg-inset rounded-md px-3 py-2.5 flex flex-col gap-2">
            <Line w={140} h={8} />
            <Line w="94%" h={10} />
            <Line w="72%" h={10} />
          </div>
          <div className="border border-borderSubtle bg-inset rounded-md px-3 py-2.5 flex flex-col gap-2">
            <Line w={90} h={8} />
            <Line w={150} h={14} />
            <Line w={170} h={9} />
          </div>
          <div className="mt-auto -mx-3 -mb-3 border-t border-borderSubtle p-2">
            <Block w="100%" h={38} className="rounded-md" />
          </div>
        </div>
      </div>
    </div>
    <div className="border border-borderSubtle rounded-md bg-panel overflow-hidden h-[263px]">
      <div className="px-5 pt-4 pb-3">
        <TitleRow title={176} chip={false} door={false} />
        <SubLine w={360} />
      </div>
      <div className="border-t border-borderSubtle">
        <div className="flex items-center gap-3 px-3 border-b border-borderSubtle h-[32px]">
          {[40, 70, 50, 50, 70, 70].map((w, i) => (
            <Line key={i} w={w} h={8} />
          ))}
        </div>
        {Array.from({ length: 3 }, (_, r) => (
          <div key={r} className="flex items-center gap-3 px-3 border-b border-borderSubtle/60 h-[39px]">
            {[90, 110, 50, 50, 50, 70].map((w, i) => (
              <Line key={i} w={w} h={10} style={{ opacity: 0.9 - r * 0.2 }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default CompassPageSkeleton;
