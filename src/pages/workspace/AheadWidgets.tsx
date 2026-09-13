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
import Simulator from '../../core/simulator';
import AheadCorridor from '../../components/gex/AheadCorridor';
import CloseOdds from '../../components/gex/CloseOdds';
import { buildCloseOdds, buildCorridor, buildSchedule, type VolPoints } from '../../data/ahead';
import { buildExposureProfile } from '../../data/exposure';
import { useDeskClock } from './useDeskClock';
import type { WorkspaceCtx } from './registry';
import { Name } from '../../components/ui/Name';

const WINDOW = 15;

export const RangeWidget = ({ ctx }: { ctx: WorkspaceCtx }) => {
  const clock = useDeskClock();
  const [volPoints, setVolPoints] = useState<VolPoints>(-1);
  const data = useMemo(() => {
    try {
      const profile = buildExposureProfile(ctx.snapshot, '0DTE', WINDOW);
      const iv = Simulator.TICKERS[ctx.snapshot.ticker]?.iv ?? 0.2;
      return { profile, corridor: buildCorridor(ctx.snapshot, profile, iv, clock), schedule: buildSchedule(ctx.snapshot, profile, clock, volPoints) };
    } catch {
      return null;
    }
  }, [ctx.snapshot, clock, volPoints]);
  if (!data) return <div className="h-full grid place-items-center font-mono text-[11px] text-textMuted uppercase tracking-widest"><span>No book for <Name t={ctx.ticker} size={12} /></span></div>;
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
      const profile = buildExposureProfile(ctx.snapshot, '0DTE', WINDOW);
      const iv = Simulator.TICKERS[ctx.snapshot.ticker]?.iv ?? 0.2;
      const corridor = buildCorridor(ctx.snapshot, profile, iv, clock);
      return { odds: buildCloseOdds(profile, ctx.snapshot.spot, corridor.sigma, clock), levels: profile.levels };
    } catch {
      return null;
    }
  }, [ctx.snapshot, clock]);
  if (!data) return <div className="h-full grid place-items-center font-mono text-[11px] text-textMuted uppercase tracking-widest"><span>No book for <Name t={ctx.ticker} size={12} /></span></div>;
  return (
    <div className="h-full min-h-0 overflow-y-auto" data-close-widget>
      <CloseOdds odds={data.odds} levels={data.levels} spot={ctx.snapshot.spot} ticker={ctx.ticker} clock={clock} focus={ctx.focusPrice ?? null} onPick={price => ctx.focusStrike?.(price)} headless />
    </div>
  );
};
