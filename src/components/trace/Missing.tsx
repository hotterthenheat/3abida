/*
==================================================
  SLAYER TERMINAL - A FIGURE THE FEED LEFT OUT
  (components/trace/Missing.tsx)

  Trace on the feed (2026-10-12) never makes a figure
  up: where the vendor's answer carries no such field,
  the cell says "—" and its title says why.
==================================================
*/

import type { ReactNode } from 'react';
import { isMissing, NOT_IN_FEED } from '../../data/feed/trace';

export const Missing = ({ className = 'text-textSecondary' }: { className?: string }) => (
  <span className={className} title={NOT_IN_FEED}>
    —
  </span>
);

/** The figure, or "—" titled "not in the feed" when it is not there */
export const fig = (v: number | null | undefined, show: (v: number) => ReactNode, className?: string): ReactNode =>
  isMissing(v) ? <Missing className={className} /> : show(v as number);
