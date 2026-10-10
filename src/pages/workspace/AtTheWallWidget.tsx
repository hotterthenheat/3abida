/*
==================================================
  SLAYER TERMINAL - PULSE DESK · AT THE WALL
  (pages/workspace/AtTheWallWidget.tsx)

  The At the wall page's first box as a desk panel
  (2026-09-08): does the wall hold when price gets
  there — the beam, the six reasons, the two paths —
  for the desk's focus strike, else the nearest wall.
  The very component the page runs; the tile head
  carries the scope chip.
==================================================
*/

import { useMemo } from 'react';
import AtTheWall from '../../components/gex/AtTheWall';
import { bookOf, scanOf, wallBoardOf } from '../../data/pinpointBook';
import { stampOf } from '../pinpoint/usePinpoint';
import { useDeskClock } from './useDeskClock';
import type { WorkspaceCtx } from './registry';

const AtTheWallWidget = ({ ctx }: { ctx: WorkspaceCtx }) => {
  const clock = useDeskClock();
  const focus = ctx.focusPrice ?? null;
  /* PINPOINT'S ONE BOOK (data/pinpointBook.ts, 2026-10-10): the At the wall page's scan and book, so the hold odds here
     are the page's; the stamp is the scan's, on New York's clock */
  const built = useMemo(() => {
    try {
      const scan = scanOf(ctx.snapshot.ticker, ctx.snapshot);
      if (!scan) return null;
      return { board: wallBoardOf(bookOf(scan.snap, clock), focus), at: stampOf(scan.at) };
    } catch {
      return null;
    }
  }, [ctx.snapshot, clock, focus]);
  if (!built) return <div className="h-full grid place-items-center font-mono text-[11px] text-textMuted uppercase tracking-widest">No book for {ctx.ticker}</div>;
  return (
    <div className="h-full min-h-0 overflow-y-auto" data-wall-widget>
      <AtTheWall board={built.board} ticker={ctx.ticker} clock={clock} onPick={strike => ctx.focusStrike?.(strike)} updatedAt={built.at} headless />
    </div>
  );
};

export default AtTheWallWidget;
