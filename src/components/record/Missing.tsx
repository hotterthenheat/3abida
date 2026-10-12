/*
==================================================
  SLAYER TERMINAL - NOT IN THE FEED (components/record/Missing.tsx)

  When the Dossier reads the vendors (2026-10-12), a
  field the page shows that no answer carries is a
  dash with the reason in its title — never a figure
  of ours beside theirs, never a guess.
==================================================
*/

import type { ReactNode } from 'react';

export const NOT_IN_FEED = 'not in the feed';

/** A figure no answer carried: NaN, null or undefined */
export const missing = (v: number | null | undefined): boolean => v === null || v === undefined || !Number.isFinite(v);

/** The dash, in the muted ink, its reason in the title */
export const Missing = ({ className = '' }: { className?: string }) => (
  <span className={`font-mono text-[11px] text-textMuted ${className}`} title={NOT_IN_FEED} data-missing>
    —
  </span>
);

/** A figure, or the dash when no answer carried it */
export const Or = ({ v, children, className }: { v: number | null | undefined; children: ReactNode; className?: string }) => (missing(v) ? <Missing className={className} /> : <>{children}</>);

/** A grid's comparator: the dashes sort together, below every figure */
export const byFigure = (a: number | null | undefined, b: number | null | undefined): number => {
  const ma = missing(a);
  const mb = missing(b);
  if (ma || mb) return ma === mb ? 0 : ma ? -1 : 1;
  return (a as number) - (b as number);
};

/** A box's body for what no answer carries: one quiet line and the dash */
export const MissingLine = ({ what }: { what: string }) => (
  <div className="px-5 pb-4 pt-1 flex items-center gap-2 text-[11px] text-textMuted" title={NOT_IN_FEED} data-missing-box>
    <span className="font-mono">—</span>
    <span>{what} · {NOT_IN_FEED}</span>
  </div>
);
