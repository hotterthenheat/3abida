/*
==================================================
  SLAYER TERMINAL - THE TARGETS PAGE'S SKELETONS
  (components/gex/targetsSkeletons.tsx)

  The two boxes standing in their own shape: the
  agenda (head with its four facts, the line of
  controls, the sentence, three cards, the list on
  the SAME column template) and the strike axis at
  the drawing's exact aspect. Imports nothing but
  Skeleton; the surfaces import their geometry from
  here, so the two cannot drift.
==================================================
*/

import { Skeleton } from '../ui/Skeleton';

/* ---- geometry shared with TargetsBoard.tsx / TargetsAxis.tsx -------------------- */

/** # · strike · from spot · reached · holds · if it breaks · today · at stake · why · actions */
export const AGENDA_COLUMNS = '32px 150px 72px 72px 104px minmax(150px,1fr) 112px 130px minmax(150px,1.2fr) 120px';
/** The columns' floor plus nine 12px gaps */
export const AGENDA_MIN_W = 1200;
export const CARD_H = 158;
export const ROW_H = 32;
export const AXIS_W = 1200;
export const AXIS_H = 150;
export const AXIS_M = { l: 44, r: 44 };
export const AXIS_BASE = 112;

/* ---- box 1 ---------------------------------------------------------------------- */

const CardSkeleton = ({ pick = false }: { pick?: boolean }) => (
  <div className={`relative rounded-md border p-3 flex flex-col ${pick ? 'border-supreme/30' : 'border-borderSubtle'}`} style={{ height: CARD_H }}>
    <div className="flex items-center gap-2 h-[22px]">
      <Skeleton className="h-4 w-[92px] rounded-full" />
      <Skeleton className="h-4 w-10" line />
      <Skeleton className="h-2.5 w-12" line />
      <Skeleton className="ml-auto h-2.5 w-12" line />
    </div>
    <div className="mt-2 flex items-center justify-between h-[14px]">
      <Skeleton className="h-2 w-[76px]" line />
      <Skeleton className="h-2 w-[54px]" line />
    </div>
    <Skeleton className="mt-1 h-[8px] w-full rounded-full" />
    <div className="mt-2 h-[15px] flex items-center">
      <Skeleton className="h-2.5 w-[86%]" line />
    </div>
    <div className="mt-1 h-[15px] flex items-center gap-3">
      <Skeleton className="h-2.5 w-[120px]" line />
      <Skeleton className="h-2.5 w-[90px]" line />
    </div>
    <div className="mt-auto flex items-center justify-end gap-1 h-[22px]">
      <Skeleton className="h-4 w-14" line />
      <Skeleton className="h-4 w-12" line />
    </div>
  </div>
);

/** The agenda, standing */
export const TargetsInner = ({ rows = 28 }: { rows?: number }) => (
  <section className="flex flex-col min-w-0" aria-hidden data-skeleton="targets">
    {/* THE HEAD */}
    <div className="px-5 pt-4 pb-3 flex items-start gap-6 flex-wrap">
      <div className="min-w-0 flex-1">
        <div className="h-6 flex items-center gap-3">
          <Skeleton className="h-3.5 w-[64px]" line />
          <Skeleton className="h-5 w-[104px] rounded-full" />
          <Skeleton className="h-3 w-[72px]" line />
        </div>
        <div className="mt-0.5 h-[17px] flex items-center">
          <Skeleton className="h-2.5 w-[520px] max-w-full" line />
        </div>
      </div>
      <dl className="grid grid-cols-4 gap-x-6">
        {[[58, 60], [92, 72], [110, 60], [70, 68]].map(([dt, dd], i) => (
          <div key={i}>
            <div className="h-[15px] flex items-center">
              <Skeleton className="h-2.5" style={{ width: dt }} line />
            </div>
            <div className="mt-0.5 h-[18px] flex items-center">
              <Skeleton className="h-3" style={{ width: dd }} line />
            </div>
          </div>
        ))}
      </dl>
    </div>

    {/* THE ONE LINE OF CONTROLS */}
    <div className="px-5 pb-2 flex items-center gap-2 flex-wrap">
      <Skeleton className="h-7 w-[168px]" />
      <Skeleton className="h-7 w-[132px]" />
      <Skeleton className="ml-auto h-2.5 w-44" line />
      <Skeleton className="h-7 w-[73px]" />
    </div>

    {/* THE SENTENCE — the surface's min-h-[34px] line */}
    <div className="mx-5 px-3 py-2 border-y border-borderSubtle/60 h-[34px] flex items-center gap-2">
      <Skeleton className="h-3 w-10" line />
      <Skeleton className="h-2.5 w-[70%]" line />
    </div>

    {/* THE THREE */}
    <div className="px-5 pt-3 pb-3 grid grid-cols-3 gap-3">
      <CardSkeleton pick />
      <CardSkeleton />
      <CardSkeleton />
    </div>

    {/* THE LIST */}
    <div className="px-5 pb-2 overflow-x-auto">
      <div className="grid items-center gap-x-3 gap-y-0" style={{ gridTemplateColumns: AGENDA_COLUMNS, minWidth: AGENDA_MIN_W }}>
        {[10, 34, 54, 48, 34, 62, 36, 50, 24, 44].map((w, i) => (
          <div key={`h-${i}`} className={`h-[14px] flex items-center ${i >= 2 && i <= 4 ? 'justify-end' : i === 9 ? 'justify-end' : ''}`}>
            <Skeleton className="h-2" style={{ width: w }} line />
          </div>
        ))}
        {Array.from({ length: rows }, (_, r) => {
          const fade = 1 - Math.min(0.55, r * 0.02);
          return (
            <div key={r} className="grid grid-cols-subgrid col-span-10 items-center border-t border-borderSubtle/40" style={{ height: ROW_H }}>
              <div className="flex items-center">
                <Skeleton className="h-2.5 w-4" line style={{ opacity: fade }} />
              </div>
              <div className="flex items-center gap-1.5 px-2">
                <Skeleton className="h-3 w-9" line style={{ opacity: fade }} />
                {r % 5 === 0 && <Skeleton className="h-2 w-10" line style={{ opacity: fade }} />}
              </div>
              <div className="flex items-center justify-end">
                <Skeleton className="h-2.5 w-10" line style={{ opacity: fade }} />
              </div>
              <div className="flex items-center justify-end">
                <Skeleton className="h-2.5 w-7" line style={{ opacity: fade }} />
              </div>
              <div className="flex items-center justify-end gap-2">
                <Skeleton className="h-2.5 w-7" line style={{ opacity: fade }} />
                <Skeleton className="h-[6px] w-[52px] rounded-full" style={{ opacity: fade }} />
              </div>
              <div className="flex items-center">
                <Skeleton className="h-2.5" line style={{ width: [150, 120, 160, 130][r % 4], opacity: fade }} />
              </div>
              <div className="flex items-center">
                <Skeleton className="h-2.5" line style={{ width: r % 3 === 0 ? 96 : 40, opacity: fade }} />
              </div>
              <div className="relative flex items-center">
                <span className="absolute inset-y-[12px] left-0 right-14 rounded-full bg-ink/[0.04]" />
                <Skeleton className="absolute inset-y-[12px] left-0 rounded-full" style={{ width: `${[70, 48, 60, 30, 22, 16, 12][r % 7]}%`, opacity: fade }} />
                <Skeleton className="absolute right-0 h-2.5 w-10" line style={{ opacity: fade }} />
              </div>
              <div className="flex items-center">
                <Skeleton className="h-2.5" line style={{ width: [170, 140, 180, 150][r % 4], opacity: fade }} />
              </div>
              <div className="flex items-center justify-end gap-1">
                <Skeleton className="h-4 w-14" line style={{ opacity: fade }} />
                <Skeleton className="h-4 w-12" line style={{ opacity: fade }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>

    {/* THE FOOT — 12px on leading-relaxed is a 19.5px line */}
    <div className="px-5 pb-4 pt-2 h-[44px] flex items-center">
      <Skeleton className="h-3 w-[58%]" line />
    </div>
  </section>
);

/* ---- box 2 ---------------------------------------------------------------------- */

/** Where they sit, standing: the head, the drawing at its exact aspect with the ruler, the ticks, the axis prices, the key */
export const TargetsAxisInner = () => {
  const W = AXIS_W;
  const H = AXIS_H;
  const M = AXIS_M;
  const pct = (v: number, of: number) => `${((v / of) * 100).toFixed(3)}%`;
  const inner = W - M.l - M.r;
  const ticks = [
    [0.47, 0.9], [0.44, 0.7], [0.53, 0.55], [0.4, 0.6], [0.57, 0.5], [0.36, 0.45], [0.61, 0.35], [0.32, 0.3], [0.65, 0.3], [0.28, 0.2], [0.7, 0.25], [0.24, 0.15], [0.75, 0.18], [0.2, 0.12], [0.8, 0.12],
  ];
  return (
    <section className="flex flex-col min-w-0" aria-hidden data-skeleton="targets-axis">
      <div className="px-5 pt-4 pb-3 flex items-start gap-6 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="h-6 flex items-center gap-3">
            <Skeleton className="h-3.5 w-[112px]" line />
            <Skeleton className="h-5 w-[104px] rounded-full" />
          </div>
          <div className="mt-0.5 h-[17px] flex items-center">
            <Skeleton className="h-2.5 w-[560px] max-w-full" line />
          </div>
        </div>
      </div>
      <div className="px-3 pt-1 pb-1">
        <div className="relative w-full" style={{ aspectRatio: `${W} / ${H}` }}>
          {/* the ruler: one expected move each side of spot */}
          <span className="absolute rounded-sm bg-ink/[0.035]" style={{ left: pct(M.l + inner * 0.34, W), width: pct(inner * 0.32, W), top: pct(24, H), bottom: pct(H - AXIS_BASE, H) }} />
          <span className="absolute border-l border-dotted border-ink/25" style={{ left: pct(M.l + inner * 0.5, W), top: pct(12, H), bottom: pct(H - AXIS_BASE - 6, H) }} />
          <Skeleton className="absolute h-2 w-8 -translate-x-1/2" line style={{ left: pct(M.l + inner * 0.5, W), top: 0 }} />
          <span className="absolute h-px bg-ink/[0.12]" style={{ left: pct(M.l, W), right: pct(M.r, W), top: pct(AXIS_BASE, H) }} />
          {ticks.map(([t, h], i) => (
            <Skeleton key={i} className="absolute w-[3px] -translate-x-1/2 rounded-sm" style={{ left: pct(M.l + inner * t, W), bottom: pct(H - AXIS_BASE, H), height: pct(h * 76, H), opacity: 0.4 + h * 0.6 }} />
          ))}
          {[0.06, 0.2, 0.34, 0.48, 0.62, 0.76, 0.9].map((t, i) => (
            <Skeleton key={`a-${i}`} className="absolute h-2 w-6 -translate-x-1/2" line style={{ left: pct(M.l + inner * t, W), bottom: pct(14, H) }} />
          ))}
        </div>
        <div className="mt-1 pl-2 flex items-center gap-4 h-[14px]">
          {[70, 44, 62, 118].map((w, i) => (
            <span key={i} className="inline-flex items-center gap-1.5">
              <Skeleton className="h-2.5 w-[3px] rounded-sm" />
              <Skeleton className="h-2" line style={{ width: w }} />
            </span>
          ))}
        </div>
      </div>
      <div className="px-5 pb-4 pt-2 h-[44px] flex items-center">
        <Skeleton className="h-3 w-[60%]" line />
      </div>
    </section>
  );
};

/* ---- the page ------------------------------------------------------------------- */

export const TargetsPageSkeleton = ({ rows = 28 }: { rows?: number }) => (
  <>
    <div className="border border-borderSubtle rounded-md bg-panel" data-targets>
      <TargetsInner rows={rows} />
    </div>
    <div className="border border-borderSubtle rounded-md bg-panel" data-targets-axis>
      <TargetsAxisInner />
    </div>
  </>
);
