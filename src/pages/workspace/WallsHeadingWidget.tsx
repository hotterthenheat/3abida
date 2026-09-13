/*
==================================================
  SLAYER TERMINAL - PULSE DESK · WHERE THE WALLS ARE HEADING
  (pages/workspace/WallsHeadingWidget.tsx)

  Building's second box as a desk panel (2026-09-08):
  the four levels at the open, now, and by the close
  at today's pace, one row per level on the strike
  axis, with the challenger per wall. Takes the old
  Wall Drift's key so saved desks upgrade in place —
  the same question, on the new house drawing.
==================================================
*/

import { useMemo } from 'react';
import Simulator from '../../core/simulator';
import WallHeading from '../../components/gex/WallHeading';
import { buildBuilding } from '../../data/building';
import { buildExposureProfile } from '../../data/exposure';
import { useDeskClock } from './useDeskClock';
import type { WorkspaceCtx } from './registry';
import { Name } from '../../components/ui/Name';

const WallsHeadingWidget = ({ ctx }: { ctx: WorkspaceCtx }) => {
  const clock = useDeskClock();
  const data = useMemo(() => {
    const snap = ctx.snapshot;
    const t = snap.ticker;
    try {
      const profile = buildExposureProfile(snap, '0DTE', 30);
      return buildBuilding(snap, Simulator.getGexHistory(t), Simulator.getCandles(t), profile, clock);
    } catch {
      return null;
    }
  }, [ctx.snapshot, clock]);
  if (!data) return <div className="h-full grid place-items-center font-mono text-[11px] text-textMuted uppercase tracking-widest"><span>No book for <Name t={ctx.ticker} size={12} /></span></div>;
  return (
    <div className="h-full min-h-0" data-heading-widget>
      <WallHeading data={data} clock={clock} headless fill />
    </div>
  );
};

export default WallsHeadingWidget;
