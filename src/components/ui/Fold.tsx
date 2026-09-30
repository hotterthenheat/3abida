/*
==================================================
  SLAYER TERMINAL - THE FOLD (components/ui/Fold.tsx)

  A control that STEPS DOWN from one row into
  another (Noah, 2026-09-13, on the calendar's band
  with names side by side: the ticker chip, the
  supreme fact and the read "shouldn't exist" on the
  band once every column carries its own — "the
  exiting and entering of these things should be
  smooth and quick, not jittery").

  The fold keeps its child MOUNTED and folds its
  track shut — a grid track going 1fr → 0fr, the
  child clipped inside, the opacity with it — so the
  neighbours slide over on real layout (no
  transform, nothing scaled, nothing remounted), and
  a fold opening elsewhere in the same 220ms reads
  as the same control arriving there. Shut, it is
  out of the tab order and off the pointer
  (visibility flips at the fold's end), and the gap
  it would leave beside itself is cancelled.
==================================================
*/

import type { ReactNode } from 'react';

export const FOLD_MS = 220;
const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';

interface FoldProps {
  open: boolean;
  /** 'x' folds the width (a control on a row); 'y' folds the height (a row in a column) */
  axis?: 'x' | 'y';
  /** The row's gap beside this fold, cancelled while shut so nothing is left behind (x only) */
  gap?: number;
  className?: string;
  children: ReactNode;
  testId?: string;
}

const Fold = ({ open, axis = 'x', gap = 0, className = '', children, testId }: FoldProps) => {
  const Tag = axis === 'x' ? 'span' : 'div';
  return (
    <Tag
      className={`grid min-w-0 min-h-0 motion-reduce:transition-none ${className}`}
      style={{
        ...(axis === 'x' ? { gridTemplateColumns: open ? '1fr' : '0fr', marginRight: open ? 0 : -gap } : { gridTemplateRows: open ? '1fr' : '0fr' }),
        opacity: open ? 1 : 0,
        visibility: open ? 'visible' : 'hidden',
        transition: `grid-template-columns ${FOLD_MS}ms ${EASE}, grid-template-rows ${FOLD_MS}ms ${EASE}, margin ${FOLD_MS}ms ${EASE}, opacity ${FOLD_MS}ms ${EASE}, visibility 0s linear ${open ? 0 : FOLD_MS}ms`,
      }}
      aria-hidden={!open || undefined}
      data-fold={open ? 'open' : 'shut'}
      {...(testId ? { [testId]: '' } : {})}
    >
      <Tag className={`min-w-0 min-h-0 overflow-hidden ${axis === 'x' ? 'inline-flex items-center whitespace-nowrap [&>*]:shrink-0' : 'flex flex-col'}`}>{children}</Tag>
    </Tag>
  );
};

export default Fold;
