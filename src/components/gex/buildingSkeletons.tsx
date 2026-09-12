/*
==================================================
  SLAYER TERMINAL - THE BUILDING PAGE'S SKELETONS
  (components/gex/buildingSkeletons.tsx)

  Noah, 2026-09-08: "the loading skeleton doesn't
  seem to take the shape of its container when the
  actual container loads. it just seems to be a
  generic loading skeleton and that's a design
  flaw." It was: the route's Suspense fallback was
  the one page skeleton every page shares (a chart
  box over two half boxes), and the deferred mounts
  stood in as a stock six-column table.

  These are the two boxes in their own shape, and
  they live in a file of their own that imports
  NOTHING but Skeleton — so the shell can show them
  while the page's code is still travelling, without
  pulling the page's chunk to do it. The surfaces
  import their geometry FROM here (the grid's column
  template, the drawing's margins and lanes), so a
  skeleton and its surface cannot drift apart.

  Measured (fake-clock probe, skeleton standing vs
  the real boxes landed): every landmark of the
  ledger +0 top / +0 height; the drawing within 1px.
==================================================
*/

import { Skeleton } from '../ui/Skeleton';

/* ---- the ledger's geometry, shared with BuildingLedger.tsx ---------------------- */

/** The grid's one column template: strike · hedging now · added today · change · calls · puts · the day · what's happening */
export const LEDGER_COLUMNS = '104px minmax(120px,1fr) minmax(160px,1.6fr) 72px 64px 64px 96px 150px';

/* ---- the drawing's geometry, shared with WallHeading.tsx ------------------------ */

export const HEADING_W = 1200;
export const HEADING_M = { l: 108, r: 40 };
export const HEADING_TOP = 30;
export const HEADING_ROW_H = 40;
export const HEADING_AXIS_H = 20;
/** Highest first — the way every strike surface on the terminal reads */
export const HEADING_ORDER = ['Call wall', 'Supreme', 'Flip', 'Put wall'] as const;
export const HEADING_H = HEADING_TOP + HEADING_ORDER.length * HEADING_ROW_H + HEADING_AXIS_H;

/* ---- box 1 ---------------------------------------------------------------------- */

/** Lane widths by row — a fixed pattern, most of them small, the way a real day reads */
const laneOf = (r: number): { calls: number; puts: number; callsRight: boolean; putsRight: boolean } => ({
  calls: 4 + ((r * 37) % 23) * 1.3 * (r % 5 === 0 ? 2.4 : 0.55),
  puts: 3 + ((r * 53) % 19) * 1.4 * (r % 7 === 3 ? 2.6 : 0.5),
  callsRight: r % 3 !== 1,
  putsRight: r % 4 !== 2,
});

/** What's being built, standing: the head with its four facts, the line of
    controls, the read line, the grid on the SAME column template with the
    spot rule after the middle row, the sentence. */
export const BuildingLedgerSkeleton = ({ rows = 31 }: { rows?: number }) => {
  const mid = Math.floor(rows / 2);
  return (
    <section className="flex flex-col min-w-0" aria-hidden data-skeleton="building-ledger">
      {/* THE HEAD */}
      <div className="px-5 pt-4 pb-3 flex items-start gap-6 flex-wrap">
        <div className="min-w-0 flex-1">
          {/* the scope chip and the guide door make this row 24px, not the title's 19 */}
          <div className="h-6 flex items-center gap-3">
            <Skeleton className="h-3.5 w-36" line />
            <Skeleton className="h-5 w-[104px] rounded-full" />
            <Skeleton className="h-3 w-[72px]" line />
          </div>
          <div className="mt-0.5 h-[17px] flex items-center">
            <Skeleton className="h-2.5 w-[560px] max-w-full" line />
          </div>
        </div>
        <dl className="grid grid-cols-4 gap-x-6">
          {[66, 78, 92, 90].map((w, i) => (
            <div key={i}>
              <div className="h-[15px] flex items-center">
                <Skeleton className="h-2.5 w-16" line />
              </div>
              <div className="mt-0.5 h-[18px] flex items-center">
                <Skeleton className="h-3" style={{ width: w }} line />
              </div>
            </div>
          ))}
        </dl>
      </div>

      {/* THE ONE LINE OF CONTROLS */}
      <div className="px-5 pb-2 flex items-center gap-2 flex-wrap">
        <Skeleton className="h-7 w-[122px]" />
        <Skeleton className="h-7 w-[104px]" />
        <Skeleton className="h-7 w-[134px]" />
        <Skeleton className="ml-auto h-2.5 w-44" line />
      </div>

      {/* THE READ LINE */}
      <div className="mx-5 px-3 py-2 border-y border-borderSubtle/60 min-h-[34px] flex items-center gap-2">
        <Skeleton className="h-3 w-8" line />
        <Skeleton className="h-2.5 w-[62%]" line />
      </div>

      {/* THE GRID */}
      <div className="px-5 pt-2 pb-2 overflow-x-auto">
        <div className="grid min-w-[980px] items-center gap-x-3 gap-y-[3px]" style={{ gridTemplateColumns: LEDGER_COLUMNS }}>
          {[40, 70, 190, 46, 32, 28, 44, 90].map((w, i) => (
            <div key={`h-${i}`} className={`h-[14px] flex items-center ${i >= 3 && i <= 5 ? 'justify-end' : ''}`}>
              <Skeleton className="h-2" style={{ width: w }} line />
            </div>
          ))}
          {Array.from({ length: rows }, (_, r) => {
            const fade = 1 - Math.min(0.55, Math.abs(r - mid) * 0.035);
            const lane = laneOf(r);
            const cells = (
              <div key={`r-${r}`} className="grid grid-cols-subgrid col-span-8 items-center">
                <div className="h-[22px] flex items-center px-2">
                  <Skeleton className="h-3 w-8" line style={{ opacity: fade }} />
                </div>
                <div className="h-[22px] flex items-center px-0.5">
                  <Skeleton className="h-[18px] w-full rounded-full" style={{ opacity: fade }} />
                </div>
                <div className="h-[22px] relative">
                  <span className="absolute inset-y-[3px] left-1/2 w-px bg-ink/[0.12]" />
                  <Skeleton className="absolute h-[6px] rounded-full" style={{ top: 3, width: `${lane.calls}%`, left: lane.callsRight ? '50%' : `calc(50% - ${lane.calls}%)`, opacity: fade }} />
                  <Skeleton className="absolute h-[6px] rounded-full" style={{ top: 12, width: `${lane.puts}%`, left: lane.putsRight ? '50%' : `calc(50% - ${lane.puts}%)`, opacity: fade }} />
                </div>
                <div className="h-[22px] flex items-center justify-end">
                  <Skeleton className="h-3 w-12" line style={{ opacity: fade }} />
                </div>
                <div className="h-[22px] flex items-center justify-end">
                  <Skeleton className="h-2.5 w-10" line style={{ opacity: fade }} />
                </div>
                <div className="h-[22px] flex items-center justify-end">
                  <Skeleton className="h-2.5 w-10" line style={{ opacity: fade }} />
                </div>
                <div className="h-[22px] flex items-center">
                  <Skeleton className="h-[5px] w-[96px] rounded-full" style={{ opacity: fade * 0.8 }} />
                </div>
                <div className="h-[22px] flex items-center pr-2">
                  <Skeleton className="h-2.5" line style={{ width: r % 4 === 0 ? 84 : 44, opacity: fade }} />
                </div>
              </div>
            );
            return r === mid + 1
              ? [
                  <div key="spot" className="col-span-8 px-2 py-0.5 flex items-center gap-1.5">
                    <span className="h-px flex-grow bg-gradient-to-r from-ink/[0.04] via-ink/[0.14] to-ink/[0.18]" />
                    <Skeleton className="h-2.5 w-6" line />
                    <Skeleton className="h-4 w-12 rounded-[3px]" />
                    <span className="h-px w-3 shrink-0 bg-ink/[0.18]" />
                  </div>,
                  cells,
                ]
              : cells;
          })}
        </div>
      </div>

      {/* THE SENTENCE — 12px on leading-relaxed is a 19.5px line */}
      <div className="px-5 pb-4 pt-2 h-[44px] flex items-center">
        <Skeleton className="h-3 w-[58%]" line />
      </div>
    </section>
  );
};

/* ---- box 2 ---------------------------------------------------------------------- */

/** Where the walls are heading, standing: the head, the read line, a box at
    the drawing's exact aspect with four lanes where the four levels will sit
    (a name block, its hairline, one dot for now), the dotted spot rule through
    them, the axis prices along the foot, the key on its own line. */
export const WallHeadingSkeleton = ({ headless = false, fill = false }: { headless?: boolean; fill?: boolean }) => {
  const W = HEADING_W;
  const H = HEADING_H;
  const M = HEADING_M;
  const pct = (v: number, of: number) => `${((v / of) * 100).toFixed(3)}%`;
  const dots = [0.62, 0.55, 0.5, 0.36];
  return (
    <section className={`flex flex-col min-w-0 ${fill ? 'h-full' : ''}`} aria-hidden data-skeleton="wall-heading">
      {headless ? (
        <div className="px-4 pt-2 pb-1 h-[36px] flex items-center">
          <Skeleton className="h-3 w-[72px]" line />
        </div>
      ) : (
        <div className="px-5 pt-4 pb-2 flex items-start gap-6 flex-wrap">
          <div className="min-w-0 flex-1">
            {/* the scope chip and the guide door make this row 24px, not the title's 19 */}
            <div className="h-6 flex items-center gap-3">
              <Skeleton className="h-3.5 w-52" line />
              <Skeleton className="h-5 w-[104px] rounded-full" />
              <Skeleton className="h-3 w-[72px]" line />
            </div>
            <div className="mt-0.5 h-[17px] flex items-center">
              <Skeleton className="h-2.5 w-[680px] max-w-full" line />
            </div>
          </div>
        </div>
      )}
      <div className="mx-5 px-3 py-2 border-y border-borderSubtle/60 min-h-[34px] flex items-center gap-2">
        <Skeleton className="h-2 w-12" line />
        <Skeleton className="h-2.5 w-[54%]" line />
      </div>
      <div className={`px-3 pt-3 pb-3 ${fill ? 'flex-1 min-h-0 flex flex-col' : ''}`}>
        <div className={`relative w-full ${fill ? 'flex-1 min-h-0' : ''}`} style={fill ? undefined : { aspectRatio: `${W} / ${H}` }}>
          {/* spot, dotted through every lane */}
          <span className="absolute border-l border-dotted border-ink/25" style={{ left: pct(M.l + (W - M.l - M.r) * 0.5, W), top: pct(HEADING_TOP - 12, H), bottom: pct(HEADING_AXIS_H - 2, H) }} />
          <Skeleton className="absolute h-2.5 w-10 -translate-x-1/2" line style={{ left: pct(M.l + (W - M.l - M.r) * 0.5, W), top: pct(HEADING_TOP - 24, H) }} />
          {HEADING_ORDER.map((name, i) => {
            const y = HEADING_TOP + i * HEADING_ROW_H + HEADING_ROW_H / 2;
            return (
              <div key={name} className="absolute inset-x-0 flex items-center" style={{ top: pct(y, H), height: 0 }}>
                <Skeleton className="absolute h-3 -translate-y-1/2" line style={{ left: pct(M.l - 14 - 60, W), width: 60 }} />
                <span className="absolute h-px bg-ink/[0.055]" style={{ left: pct(M.l, W), right: pct(M.r, W) }} />
                <Skeleton className="absolute h-2.5 w-2.5 rounded-full -translate-x-1/2 -translate-y-1/2" style={{ left: pct(M.l + (W - M.l - M.r) * dots[i], W) }} />
              </div>
            );
          })}
          {/* the axis prices */}
          {[0.08, 0.23, 0.38, 0.53, 0.68, 0.83, 0.98].map((t, i) => (
            <Skeleton key={i} className="absolute h-2 w-6 -translate-x-1/2" line style={{ left: pct(M.l + (W - M.l - M.r) * t, W), bottom: pct(4, H) }} />
          ))}
        </div>
        <div className="mt-1 pl-2 flex items-center gap-4 h-[14px]">
          {[64, 28, 150, 160].map((w, i) => (
            <span key={i} className="inline-flex items-center gap-1.5">
              <Skeleton className="h-2.5 w-2.5 rounded-full" />
              <Skeleton className="h-2" line style={{ width: w }} />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
};

/* ---- the page ------------------------------------------------------------------- */

/** The whole page standing — the two boxes in their own borders, the way Building.tsx lays them out */
export const BuildingPageSkeleton = ({ rows = 31 }: { rows?: number }) => (
  <>
    <div className="border border-borderSubtle rounded-md bg-panel" data-build>
      <BuildingLedgerSkeleton rows={rows} />
    </div>
    <div className="border border-borderSubtle rounded-md bg-panel" data-heading>
      <WallHeadingSkeleton />
    </div>
  </>
);
