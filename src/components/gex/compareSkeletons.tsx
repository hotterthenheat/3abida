/*
==================================================
  SLAYER TERMINAL - THE COMPARE PAGE'S SKELETONS
  (components/gex/compareSkeletons.tsx)

  The three boxes standing in their own shape: the
  head-to-head (head with its three facts, the two
  chips at the head of their own columns, ten rows
  on the SAME column template, the sentence), the
  two books on one ruler (the Reach card, the lane
  heads, the drawing at its exact height, the read
  line, the four bands within reach), and today's
  two lines over a chart's ground with its read
  line. Imports nothing but the kit, so the shell
  can show them while the page's chunk is still
  travelling; the surfaces import their geometry
  FROM here, so the two cannot drift.
==================================================
*/

import { Skeleton } from '../ui/Skeleton';
import { Block, Box, ChartGround, Facts, Line, SubLine, TitleRow } from '../ui/skeletonKit';

/* ---- geometry shared with HeadToHead.tsx / CompareAxis.tsx / CompareTapes.tsx ------- */

/** A's value · the read · B's value */
export const H2H_COLUMNS = 'minmax(0,1fr) 250px minmax(0,1fr)';
export const H2H_ROW_H = 30;
/** The card's head row holds the two chips (the second, with its quote, is 28px) */
export const H2H_HEAD_H = 36;
export const H2H_KEYS = ['price', 'dealers', 'flip', 'move', 'callWall', 'putWall', 'supreme', 'watch', 'closes', 'bell'] as const;
/** The drawing's height (640 since 2026-09-09 — Noah: "needs to be taller, cover more of
    the capsules"), the lane heads over it and the read line under it */
export const AXIS_H = 640;
export const AXIS_HEADS_H = 22;
export const AXIS_READ_H = 26;
export const AXIS_COL_W = 76;
/** The caption over the four bands within reach */
export const BANDS_CAP_H = 22;
export const BAND_KEYS = ['up1', 'up2', 'dn1', 'dn2'] as const;
/** Today's two lines, and the read line under them */
export const TAPES_H = 300;
export const TAPES_READ_H = 26;
/** The pair over the sessions — the drawing's height and its margins — and its read line */
export const PAIR_H = 240;
export const PAIR_M = { l: 16, r: 84, t: 22, b: 28 };
export const PAIR_READ_H = 26;

/* ---- box 1 ---------------------------------------------------------------------- */

/** Head to head, standing */
export const HeadToHeadInner = () => (
  <section className="flex flex-col min-w-0" aria-hidden data-skeleton="head-to-head">
    <div className="px-5 pt-4 pb-3 flex items-start gap-6 flex-wrap">
      <div className="min-w-0 flex-1">
        <TitleRow title={110} chip={false} door={false} />
        <SubLine w={560} />
      </div>
      <Facts widths={[118, 96, 82]} />
    </div>
    {/* The card's head: each chip at the head of its own column, both in the full chip's clothes */}
    <div className="mx-5 grid items-center gap-x-4 border-b border-borderSubtle/60" style={{ gridTemplateColumns: H2H_COLUMNS, height: H2H_HEAD_H }}>
      <div className="flex justify-end">
        <Skeleton className="h-7 w-[176px] rounded-md" />
      </div>
      <div className="flex items-center justify-center gap-2">
        <Line w={40} h={10} />
        <Skeleton className="h-6 w-6 rounded" />
      </div>
      <div className="flex items-center gap-3">
        <Skeleton className="h-7 w-[176px] rounded-md" />
        <Line w={176} h={10} className="ml-auto" />
      </div>
    </div>
    {H2H_KEYS.map((k, i) => (
      <div key={k} className="mx-5 grid items-center gap-x-4 border-t border-borderSubtle/40 first:border-t-0" style={{ gridTemplateColumns: H2H_COLUMNS, height: H2H_ROW_H }}>
        <div className="flex justify-end">
          <Line w={[150, 168, 140, 128, 156, 156, 120, 176, 96, 118][i]} h={12} />
        </div>
        <div className="flex flex-col items-center gap-1">
          <Line w={[34, 88, 50, 128, 52, 50, 54, 62, 84, 96][i]} h={10} />
          {i % 3 !== 0 && <Line w={72} h={8} />}
        </div>
        <Line w={[150, 168, 140, 128, 156, 156, 120, 176, 96, 118][(i + 3) % 10]} h={12} />
      </div>
    ))}
    <div className="px-5 pb-4 pt-2 min-h-[44px] flex items-center">
      <Line w="72%" h={11} />
    </div>
  </section>
);

/* ---- box 2 ---------------------------------------------------------------------- */

/** The two books on one ruler, standing */
export const CompareAxisInner = () => {
  const rows = 15;
  const mid = 7;
  return (
    <section className="flex flex-col min-w-0" aria-hidden data-skeleton="compare-axis">
      <div className="px-5 pt-4 pb-3 flex items-start gap-6 flex-wrap">
        <div className="min-w-0 flex-1">
          <TitleRow title={196} chip={false} />
          <SubLine w={640} />
        </div>
        <Facts widths={[96, 60, 92, 104, 104]} />
      </div>
      <div className="px-5 pb-2 flex items-center gap-2 flex-wrap">
        {/* Expiry · Reach · Greek · Colours — measured 163/203/103/140 (2026-09-10) */}
        <Skeleton className="h-7 w-[163px] rounded-md" />
        <Skeleton className="h-7 w-[203px] rounded-md" />
        <Skeleton className="h-7 w-[103px] rounded-md" />
        <Skeleton className="h-7 w-[140px] rounded-md" />
        <Line w={220} h={9} className="ml-auto" />
      </div>
      <div className="px-5 flex items-center justify-between" style={{ height: AXIS_HEADS_H }}>
        <Line w={150} h={10} />
        <Line w={260} h={9} />
        <Line w={150} h={10} />
      </div>
      <div className="relative" style={{ height: AXIS_H }}>
        <div className="absolute inset-y-3 left-1/2 -translate-x-1/2 rounded bg-ink/[0.025]" style={{ width: AXIS_COL_W }} />
        {Array.from({ length: rows }, (_, r) => {
          const t = 1 - Math.abs(r - mid) / mid;
          const y = 14 + r * ((AXIS_H - 28) / (rows - 1));
          const wl = 8 + Math.round(t * t * 80);
          const wr = 8 + Math.round((1 - Math.abs(r - mid + 2) / mid) ** 2 * 70);
          return (
            <div key={r} className="absolute inset-x-0" style={{ top: y - 7, height: 14 }}>
              <Block w={`${wl * 0.42}%`} h={14} className="absolute rounded-full" style={{ right: `calc(50% + ${AXIS_COL_W / 2 + 4}px)`, opacity: 0.35 + t * 0.5 }} />
              <Line w={30} h={9} className="absolute left-1/2 -translate-x-1/2 top-[2px]" />
              <Block w={`${Math.max(4, wr) * 0.42}%`} h={14} className="absolute rounded-full" style={{ left: `calc(50% + ${AXIS_COL_W / 2 + 4}px)`, opacity: 0.35 + t * 0.5 }} />
            </div>
          );
        })}
      </div>
      <div className="px-5 border-t border-ink/[0.06] flex items-center gap-3" style={{ height: AXIS_READ_H }}>
        <Line w={160} h={10} />
        <Line w={220} h={10} />
      </div>
      {/* the four band rows that stood here are gone (2026-09-09) — the reach facts live in the head */}
      <div className="h-3" />
    </section>
  );
};

/* ---- box 3 ---------------------------------------------------------------------- */

/** Since the open, standing */
export const CompareTapesInner = () => (
  <section className="flex flex-col min-w-0" aria-hidden data-skeleton="compare-tapes">
    <div className="px-5 pt-4 pb-3 flex items-start gap-6 flex-wrap">
      <div className="min-w-0 flex-1">
        <TitleRow title={110} chip={false} door={false} />
        <SubLine w={620} />
      </div>
      <Facts widths={[150, 96, 130]} />
    </div>
    <div className="border-t border-borderSubtle/60" style={{ height: TAPES_H }}>
      <ChartGround axis={60} />
    </div>
    <div className="px-5 border-t border-ink/[0.06] flex items-center gap-3" style={{ height: TAPES_READ_H }}>
      <Line w={36} h={10} />
      <Line w={90} h={10} />
      <Line w={90} h={10} />
      <Line w={120} h={10} />
    </div>
  </section>
);

/* ---- box 4 ---------------------------------------------------------------------- */

/** The pair, standing: the band across the drawing, the average through it, a run of session dots */
export const ComparePairInner = () => {
  const dots = 21;
  const inner = PAIR_H - PAIR_M.t - PAIR_M.b;
  return (
    <section className="flex flex-col min-w-0" aria-hidden data-skeleton="compare-pair">
      <div className="px-5 pt-4 pb-3 flex items-start gap-6 flex-wrap">
        <div className="min-w-0 flex-1">
          <TitleRow title={132} chip={false} door={false} />
          <SubLine w={620} />
        </div>
        <Facts widths={[70, 120, 130]} />
      </div>
      <div className="relative border-t border-borderSubtle/60" style={{ height: PAIR_H }}>
        <Block w={`calc(100% - ${PAIR_M.l + PAIR_M.r}px)`} h={inner * 0.34} className="absolute rounded-sm opacity-40" style={{ left: PAIR_M.l, top: PAIR_M.t + inner * 0.33 }} />
        <Line w={`calc(100% - ${PAIR_M.l + PAIR_M.r}px)`} h={1} className="absolute" style={{ left: PAIR_M.l, top: PAIR_M.t + inner * 0.5 }} />
        {Array.from({ length: dots }, (_, i) => {
          const t = i / (dots - 1);
          const y = PAIR_M.t + inner * (0.5 + 0.3 * Math.sin(i * 1.3));
          return <Block key={i} w={6} h={6} className="absolute rounded-full" style={{ left: `calc(${PAIR_M.l}px + (100% - ${PAIR_M.l + PAIR_M.r}px) * ${t})`, top: y - 3, opacity: 0.5 + t * 0.4 }} />;
        })}
        <div className="absolute" style={{ right: 8, top: PAIR_M.t + inner * 0.5 - 6 }}>
          <Line w={56} h={12} />
        </div>
        <div className="absolute flex justify-between" style={{ left: PAIR_M.l, right: PAIR_M.r, bottom: 6 }}>
          {[0, 1, 2, 3, 4, 5].map(i => (
            <Line key={i} w={34} h={8} />
          ))}
        </div>
      </div>
      <div className="px-5 border-t border-ink/[0.06] flex items-center gap-3" style={{ height: PAIR_READ_H }}>
        <Line w={36} h={10} />
        <Line w={80} h={10} />
        <Line w={160} h={10} />
      </div>
      <div className="px-5 pb-4 pt-2 min-h-[44px] flex items-center">
        <Line w="64%" h={11} />
      </div>
    </section>
  );
};

/* ---- the page ------------------------------------------------------------------- */

export const ComparePageSkeleton = () => (
  <>
    <Box data-skeleton="compare-1">
      <HeadToHeadInner />
    </Box>
    <Box data-skeleton="compare-2">
      <CompareAxisInner />
    </Box>
    <Box data-skeleton="compare-3">
      <CompareTapesInner />
    </Box>
    <Box data-skeleton="compare-4">
      <ComparePairInner />
    </Box>
  </>
);
