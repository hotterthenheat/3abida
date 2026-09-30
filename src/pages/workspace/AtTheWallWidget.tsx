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
import Simulator from '../../core/simulator';
import AtTheWall from '../../components/gex/AtTheWall';
import { buildBuilding } from '../../data/building';
import { buildExposureProfile } from '../../data/exposure';
import { buildExposureSurface, CALENDAR_DTES } from '../../data/exposureSurface';
import { sessionBars } from '../../data/levelview';
import { buildWallBoard } from '../../data/wall';
import { hhmmss, useDeskClock } from './useDeskClock';
import type { WorkspaceCtx } from './registry';

const AtTheWallWidget = ({ ctx }: { ctx: WorkspaceCtx }) => {
  const clock = useDeskClock();
  const focus = ctx.focusPrice ?? null;
  const built = useMemo(() => {
    const snap = ctx.snapshot;
    const t = snap.ticker;
    try {
      const profile = buildExposureProfile(snap, '0DTE', 30);
      const building = buildBuilding(snap, Simulator.getGexHistory(t), Simulator.getCandles(t), profile, clock);
      const surface = buildExposureSurface(snap, 30, CALENDAR_DTES);
      const iv = Simulator.TICKERS[t]?.iv ?? 0.2;
      return { board: buildWallBoard(snap, profile, building, surface, sessionBars(t) ?? [], clock, iv, focus), at: hhmmss(new Date()) };
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
