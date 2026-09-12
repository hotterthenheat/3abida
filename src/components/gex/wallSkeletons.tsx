/*
==================================================
  SLAYER TERMINAL - THE AT THE WALL PAGE'S SKELETONS
  (components/gex/wallSkeletons.tsx)

  The two boxes standing in their own shape — the
  head with its five facts, the one control, the
  beam, the seven reason rows on the SAME column
  template, the two paths at the drawing's exact
  aspect, the sentence; then the board with its
  eight columns. Imports nothing but Skeleton, so
  the shell can show them while the page's chunk is
  still travelling. The surfaces import their
  geometry FROM here, so the two cannot drift.
==================================================
*/

import { Skeleton } from '../ui/Skeleton';
import { ScopeChipMark } from '../ui/skeletonKit';

/* ---- geometry shared with AtTheWall.tsx / WallBoard.tsx -------------------------- */

/** Reason · the fact · the push meter · in words */
export const REASON_COLUMNS = '150px minmax(0,1fr) 112px minmax(0,1.3fr)';
export const REASON_KEYS = ['weight', 'tests', 'build', 'expiry', 'speed', 'prints', 'vol'] as const;
/** Wall · reached · holds · made of · tested · expires · if it breaks · if it holds */
export const BOARD_COLUMNS = '140px 80px 112px minmax(140px,1fr) 128px 88px 104px 104px';
/** The board's box at its tallest (the lock walk, Noah 2026-09-09: "make every
    wall on the strikes show taller and cover the full box") — the rows share
    this height. CAPPED (Noah, 2026-09-10, four walls at 85px each: "it became
    HUGE" → "cap it at 64"): a row never stands taller than the five-wall
    height, so with fewer walls the box ends sooner instead of stretching. */
export const BOARD_H = 480;
/** The column-head row of the board's grid */
export const BOARD_HEAD_H = 14;
/** A row at its tallest — the five-wall height Noah approved */
export const BOARD_ROW_MAX = 64;
/** The gap between rows (the grid's gap-y) */
export const BOARD_ROW_GAP = 3;
/** Everything in the box that is not a row: the head, the rows' bottom pad, the
    sentence, the borders — measured at 480 with seven walls (rows 45.9px). */
export const BOARD_CHROME = 124;
/** The box's height for n walls: the rows at their tallest, or BOARD_H, whichever is less */
export const boardH = (n: number) => Math.min(BOARD_H, BOARD_CHROME + BOARD_HEAD_H + Math.max(1, n) * (BOARD_ROW_MAX + BOARD_ROW_GAP));
/** The row template: the column heads, then every wall sharing what is left, never under 24px */
export const boardRows = (n: number) => `${BOARD_HEAD_H}px repeat(${Math.max(1, n)}, minmax(24px, 1fr))`;
export const PATHS_W = 1200;
export const PATHS_H = 130;
export const PATHS_M = { l: 44, r: 44 };

/* ---- box 1 ---------------------------------------------------------------------- */

/** At the wall, standing */
export const AtTheWallInner = () => {
  const W = PATHS_W;
  const H = PATHS_H;
  const M = PATHS_M;
  const pct = (v: number, of: number) => `${((v / of) * 100).toFixed(3)}%`;
  const inner = W - M.l - M.r;
  const pushes = [0.42, 0.6, 0.18, -0.26, -0.34, 0.12, -0.2];
  return (
    <section className="flex flex-col min-w-0" aria-hidden data-skeleton="at-the-wall">
      {/* THE HEAD */}
      <div className="px-5 pt-4 pb-3 flex items-start gap-6 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="h-6 flex items-center gap-3">
            <Skeleton className="h-3.5 w-[86px]" line />
            <Skeleton className="h-5 w-[104px] rounded-full" />
            <Skeleton className="h-3 w-[72px]" line />
          </div>
          <div className="mt-0.5 h-[17px] flex items-center">
            <Skeleton className="h-2.5 w-[500px] max-w-full" line />
          </div>
        </div>
        <dl className="grid grid-cols-5 gap-x-6">
          {[70, 34, 34, 76, 72].map((w, i) => (
            <div key={i} className="w-[101px]">
              <div className="h-[15px] flex items-center">
                <Skeleton className="h-2.5" style={{ width: [44, 96, 78, 54, 50][i] }} line />
              </div>
              <div className="mt-0.5 h-[18px] flex items-center">
                <Skeleton className="h-3" style={{ width: w }} line />
              </div>
            </div>
          ))}
        </dl>
      </div>

      {/* THE ONE CONTROL */}
      <div className="px-5 pb-2 flex items-center gap-2 flex-wrap">
        <Skeleton className="h-7 w-[150px]" />
        <Skeleton className="ml-auto h-2.5 w-44" line />
      </div>

      {/* THE BEAM */}
      <div className="px-5 pt-1 pb-3">
        <div className="h-[14px] flex items-center justify-between">
          <Skeleton className="h-2 w-[96px]" line />
          <Skeleton className="h-2 w-[190px]" line />
        </div>
        <div className="relative mt-1.5 h-[14px] rounded-full bg-ink/[0.06] overflow-hidden">
          <Skeleton className="absolute inset-y-0 left-0 w-[68%] rounded-full" />
        </div>
        <div className="mt-1 h-[16px] flex items-center justify-between">
          <Skeleton className="h-2.5 w-[60px]" line />
          <Skeleton className="h-2.5 w-[64px]" line />
        </div>
      </div>

      {/* THE REASONS */}
      <div className="px-5 pb-2">
        <div className="grid items-center gap-x-4 h-[14px]" style={{ gridTemplateColumns: REASON_COLUMNS }}>
          {[38, 46, 88, 46].map((w, i) => (
            <Skeleton key={i} className="h-2" style={{ width: w }} line />
          ))}
        </div>
        {pushes.map((p, i) => {
          const w = Math.abs(p) * 50;
          return (
            <div key={i} className="grid items-center gap-x-4 h-[28px] border-t border-borderSubtle/40" style={{ gridTemplateColumns: REASON_COLUMNS }}>
              <Skeleton className="h-2.5" style={{ width: [98, 74, 96, 88, 108, 92][i] }} line />
              <Skeleton className="h-2.5" style={{ width: [150, 120, 138, 116, 128, 132][i] }} line />
              <span className="relative block h-[4px] w-full rounded-full bg-ink/[0.06]">
                <span className="absolute inset-y-0 left-1/2 w-px bg-ink/25" />
                <Skeleton className="absolute inset-y-0 rounded-full" style={{ left: p >= 0 ? '50%' : `${50 - w}%`, width: `${w}%` }} />
              </span>
              <Skeleton className="h-2.5" style={{ width: [180, 120, 160, 150, 170, 140][i] }} line />
            </div>
          );
        })}
      </div>

      {/* THE TWO PATHS */}
      <div className="px-3 pt-1 pb-1">
        <div className="relative w-full" style={{ aspectRatio: `${W} / ${H}` }}>
          {/* the axis prices */}
          {[0.06, 0.2, 0.34, 0.48, 0.62, 0.76, 0.9].map((t, i) => (
            <Skeleton key={i} className="absolute h-2 w-6 -translate-x-1/2" line style={{ left: pct(M.l + inner * t, W), bottom: pct(3, H) }} />
          ))}
          {/* spot, dotted */}
          <span className="absolute border-l border-dotted border-ink/25" style={{ left: pct(M.l + inner * 0.36, W), top: pct(12, H), bottom: pct(18, H) }} />
          <Skeleton className="absolute h-2 w-8 -translate-x-1/2" line style={{ left: pct(M.l + inner * 0.36, W), top: 0 }} />
          {/* the wall */}
          <Skeleton className="absolute w-[4px] -translate-x-1/2 rounded-sm" style={{ left: pct(M.l + inner * 0.52, W), top: pct(22, H), bottom: pct(22, H) }} />
          {/* the break run and the way back */}
          <Skeleton className="absolute h-px" style={{ left: pct(M.l + inner * 0.52, W), width: pct(inner * 0.3, W), top: pct(62, H) }} />
          <Skeleton className="absolute h-2" line style={{ left: pct(M.l + inner * 0.53, W), width: 220, top: pct(48, H) }} />
          <Skeleton className="absolute h-px" style={{ left: pct(M.l + inner * 0.22, W), width: pct(inner * 0.3, W), top: pct(96, H) }} />
          <Skeleton className="absolute h-2" line style={{ right: pct(W - (M.l + inner * 0.51), W), width: 200, top: pct(102, H) }} />
        </div>
      </div>

      {/* THE SENTENCE — 12px on leading-relaxed is a 19.5px line */}
      <div className="px-5 pb-4 pt-2 h-[44px] flex items-center">
        <Skeleton className="h-3 w-[88%]" line />
      </div>
    </section>
  );
};

/* ---- box 2 ---------------------------------------------------------------------- */

/** Every wall, standing: the head, the grid on the SAME column template with the rows
    sharing the box's height (BOARD_H), the sentence */
export const WallBoardInner = ({ rows = 8 }: { rows?: number }) => (
  <section className="flex flex-col min-w-0 h-full min-h-0" aria-hidden data-skeleton="wall-board">
    <div className="shrink-0 px-5 pt-4 pb-3 flex items-start gap-6 flex-wrap">
      <div className="min-w-0 flex-1">
        <div className="h-6 flex items-center gap-3">
          <Skeleton className="h-3.5 w-[214px]" line />
          <ScopeChipMark />
        </div>
        <div className="mt-0.5 h-[17px] flex items-center">
          <Skeleton className="h-2.5 w-[620px] max-w-full" line />
        </div>
      </div>
    </div>
    <div className="flex-1 min-h-0 px-5 pb-2 overflow-x-auto">
      <div className="grid h-full min-w-[900px] items-center gap-x-3 gap-y-[3px]" style={{ gridTemplateColumns: BOARD_COLUMNS, gridTemplateRows: boardRows(rows) }}>
        {[28, 52, 36, 118, 74, 66, 60, 56].map((w, i) => (
          <div key={`h-${i}`} className={`h-[14px] flex items-center ${i === 1 || i === 2 || i === 4 || i === 5 ? 'justify-end' : ''}`}>
            <Skeleton className="h-2" style={{ width: w }} line />
          </div>
        ))}
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className="grid grid-cols-subgrid col-span-8 items-center h-full min-h-0">
            <div className="h-full flex items-center gap-1.5 px-2">
              <Skeleton className="h-3 w-8" line />
              <Skeleton className="h-2 w-10" line />
            </div>
            <div className="h-full flex items-center justify-end">
              <Skeleton className="h-3 w-7" line />
            </div>
            <div className="h-full flex items-center justify-end gap-2">
              <Skeleton className="h-3 w-7" line />
              <Skeleton className="h-[8px] w-[52px] rounded-full" />
            </div>
            <div className="h-full relative flex items-center">
              <span className="absolute inset-y-[32%] left-0 right-14 rounded-full bg-ink/[0.04]" />
              <Skeleton className="absolute inset-y-[32%] left-0 rounded-full" style={{ width: `${[64, 48, 30, 22, 14, 10, 8][r % 7]}%` }} />
              <Skeleton className="absolute right-0 h-2.5 w-9" line />
            </div>
            <div className="h-full flex items-center justify-end">
              <Skeleton className="h-2.5 w-[84px]" line />
            </div>
            <div className="h-full flex items-center justify-end">
              <Skeleton className="h-2.5 w-7" line />
            </div>
            <div className="h-full flex items-center">
              <Skeleton className="h-2.5 w-[74px]" line />
            </div>
            <div className="h-full flex items-center pr-2">
              <Skeleton className="h-2.5 w-[70px]" line />
            </div>
          </div>
        ))}
      </div>
    </div>
    <div className="shrink-0 px-5 pb-4 pt-2 h-[44px] flex items-center">
      <Skeleton className="h-3 w-[64%]" line />
    </div>
  </section>
);

/* ---- the page ------------------------------------------------------------------- */

export const WallPageSkeleton = ({ rows = 8 }: { rows?: number }) => (
  <>
    <div className="border border-borderSubtle rounded-md bg-panel" data-wall>
      <AtTheWallInner />
    </div>
    <div className="border border-borderSubtle rounded-md bg-panel flex flex-col" style={{ height: boardH(rows) }} data-wall-every>
      <WallBoardInner rows={rows} />
    </div>
  </>
);
