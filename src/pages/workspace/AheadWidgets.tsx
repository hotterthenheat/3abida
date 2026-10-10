/*
==================================================
  SLAYER TERMINAL - PULSE DESK · THE RANGE, WHERE IT CLOSES
  (pages/workspace/AheadWidgets.tsx)

  The Ahead page's two boxes as desk panels
  (2026-09-08): the range price is likely to hold to
  the close, bent by the walls, and the odds for the
  close strike by strike. The very components the
  page runs, on the desk's own name and scan; the
  tile head carries the scope chip, so the surfaces
  take none.
==================================================
*/

import { useMemo, useState } from 'react';
import AheadCorridor from '../../components/gex/AheadCorridor';
import CloseOdds from '../../components/gex/CloseOdds';
import type { VolPoints } from '../../data/ahead';
import { bookOf, closeOddsOf, corridorOf, scanOf, scheduleOf } from '../../data/pinpointBook';
import { useDeskClock } from './useDeskClock';
import type { WorkspaceCtx } from './registry';

/* PINPOINT'S ONE BOOK (data/pinpointBook.ts, 2026-10-10): both panels read the Ahead page's scan and book — the whole
   chain, not a fifteen-strike window of their own — so the range and the close odds here are the page's */
const bookFor = (ctx: WorkspaceCtx, clock: ReturnType<typeof useDeskClock>) => {
  const scan = scanOf(ctx.snapshot.ticker, ctx.snapshot);
  return scan ? bookOf(scan.snap, clock) : null;
};

export const RangeWidget = ({ ctx }: { ctx: WorkspaceCtx }) => {
  const clock = useDeskClock();
  const [volPoints, setVolPoints] = useState<VolPoints>(-1);
  const data = useMemo(() => {
    try {
      const book = bookFor(ctx, clock);
      if (!book) return null;
      return { profile: book.profile, corridor: corridorOf(book), schedule: scheduleOf(book, volPoints) };
    } catch {
      return null;
    }
  }, [ctx.snapshot, clock, volPoints]);
  if (!data) return <div className="h-full grid place-items-center font-mono text-[11px] text-textMuted uppercase tracking-widest">No book for {ctx.ticker}</div>;
  return (
    <div className="h-full min-h-0 overflow-y-auto" data-range-widget>
      <AheadCorridor corridor={data.corridor} schedule={data.schedule} levels={data.profile.levels} ticker={ctx.ticker} clock={clock} focus={ctx.focusPrice ?? null} onPick={price => ctx.focusStrike?.(price)} volPoints={volPoints} onVolPoints={setVolPoints} headless />
    </div>
  );
};

export const CloseWidget = ({ ctx }: { ctx: WorkspaceCtx }) => {
  const clock = useDeskClock();
  const data = useMemo(() => {
    try {
      const book = bookFor(ctx, clock);
      if (!book) return null;
      return { odds: closeOddsOf(book), levels: book.profile.levels };
    } catch {
      return null;
    }
  }, [ctx.snapshot, clock]);
  if (!data) return <div className="h-full grid place-items-center font-mono text-[11px] text-textMuted uppercase tracking-widest">No book for {ctx.ticker}</div>;
  return (
    <div className="h-full min-h-0 overflow-y-auto" data-close-widget>
      <CloseOdds odds={data.odds} levels={data.levels} spot={ctx.liveSpot ?? ctx.snapshot.spot} ticker={ctx.ticker} clock={clock} focus={ctx.focusPrice ?? null} onPick={price => ctx.focusStrike?.(price)} headless />
    </div>
  );
};
