/*
==================================================
  SLAYER TERMINAL - EVERY WALL TODAY
  (components/gex/WallBoard.tsx)

  Box 2 of the At the wall page: every wall on the
  strikes shown, nearest first — the odds it is
  reached, the odds it holds, what it is made of
  (a bar against the biggest), how it tested, what
  expires at 4:00, and the two paths. The weakest
  and the strongest in reach wear a tag. A row is
  a strike: click it and it is the wall above and
  the shared strike in the shell. Rows are
  subgrids, so the wash is one band.

  EVERY ROW IS ONE HEIGHT (2026-09-13; Noah: the box
  "just keeps increasing and decreasing in size and
  it's way too big… the made-of bars, wall etc
  should not be getting bigger"): the rows used to
  share a box of up to 480px and grow with it —
  type, beam and bar — so every change in the wall
  count re-sized everything. Now a row is 30px, the
  type 11/10px, the beam 6×52, the bar 8px, and the
  box is as tall as its rows. A shelf near the line
  stays listed while it holds three quarters of it
  (data/wall.ts), so the count itself stops
  flickering.
==================================================
*/

import { useState, type ReactNode } from 'react';
import { ROLE_INK } from './AtTheWall';
import { heatLaneColor } from './heatmap';
import { BOARD_COLUMNS as COLUMNS, boardRows } from './wallSkeletons';
import { fmtDollars, fmtStrike, type AheadClock } from '../../data/ahead';
import type { WallBoard as Board } from '../../data/wall';

const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */
const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';
/** What a wall is made of, in the calendar's own ink: hedging that pushes
    back is the cool side of the thermal ramp, deeper the heavier (Noah,
    2026-09-08: "everything is gray and practically unable to read") */
const madeOfInk = (weight: number, max: number) => heatLaneColor(-Math.abs(weight), max, 'thermal-yellow', 0.35);
const pct = (v: number) => `${Math.round(v * 100)}%`;
/* the one row's sizes */
const fig = '11px';
const small = '10px';
const tagSize = '8px';
const beamH = 6;
const beamW = 52;
const barInset = '11px';

interface Props {
  board: Board;
  clock: AheadClock;
  focus?: number | null;
  onPick?: (strike: number) => void;
  scope?: ReactNode;
}

const WallBoard = ({ board, clock, focus, onPick, scope }: Props) => {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...board.walls.map(w => w.weightEff));
  const n = board.walls.length;

  return (
    <section className="relative flex flex-col min-w-0" data-wall-board data-rows={n}>
      <div className="shrink-0 px-5 pt-4 pb-3 flex items-start gap-6 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="text-[15px] font-semibold leading-tight text-textPrimary">Every wall on the strikes shown</h3>
            {scope}
          </div>
          <p className="mt-0.5 text-[11px] text-textMuted whitespace-nowrap truncate">
            The named walls and the shelves between them — every strike that pushes back with at least a third of the biggest · nearest first · about {fmtDollars(board.marketPer1Pct)} moves this name 1% today
          </p>
        </div>
      </div>
      <div className="px-5 pb-2 overflow-x-auto" data-wall-rows onPointerLeave={() => setHover(null)}>
        <div className="grid min-w-[900px] items-center gap-x-3 gap-y-[3px]" style={{ gridTemplateColumns: COLUMNS, gridTemplateRows: boardRows(n) }}>
          <div className="text-[9px] uppercase tracking-widest text-textMuted">Wall</div>
          <div className="text-[9px] uppercase tracking-widest text-textMuted text-right">{clock.inSession ? 'Reached' : 'Reached next'}</div>
          <div className="text-[9px] uppercase tracking-widest text-textMuted text-right">Holds</div>
          <div className="text-[9px] uppercase tracking-widest text-textMuted">Made of · per 1% move</div>
          <div className="text-[9px] uppercase tracking-widest text-textMuted text-right">Tested today</div>
          <div className="text-[9px] uppercase tracking-widest text-textMuted text-right">{clock.inSession ? 'Expires 4:00' : 'Expired 4:00'}</div>
          <div className="text-[9px] uppercase tracking-widest text-textMuted">If it breaks</div>
          <div className="text-[9px] uppercase tracking-widest text-textMuted">If it holds</div>
          {board.walls.map(w => {
            const kept = focus != null && Math.abs(focus - w.strike) < 1e-9;
            const hovered = hover === w.strike;
            const wash = kept || hovered ? 'bg-silver/[0.05]' : '';
            const ink = w.role ? ROLE_INK[w.role] : undefined;
            const tag = w.strike === board.weakest ? 'weakest' : w.strike === board.strongest ? 'strongest' : null;
            return (
              <div key={w.strike} className={`grid grid-cols-subgrid col-span-8 items-center h-full min-h-0 rounded cursor-pointer ${wash}`} data-wall-row={w.strike} data-tag={tag ?? undefined} onPointerEnter={() => setHover(w.strike)} onClick={() => onPick?.(w.strike)}>
                <div className={`h-full flex items-center gap-1.5 px-2 font-mono tnum ${kept ? 'text-silver font-bold shadow-[inset_2px_0_0_0_rgb(var(--silver)/0.7)]' : 'text-textPrimary'}`} style={{ fontSize: fig }}>
                  {fmtStrike(w.strike)}
                  {/* A named level wears its ink; the rest are shelves — heavy strikes the Map does not name */}
                  <span className="uppercase tracking-widest whitespace-nowrap" style={{ color: ink ?? 'rgb(var(--text-muted))', fontSize: tagSize }}>
                    {w.role ?? 'shelf'}
                  </span>
                  {tag && (
                    <span className="ml-auto uppercase tracking-widest whitespace-nowrap" style={{ color: SILVER, fontSize: tagSize }}>
                      {tag}
                    </span>
                  )}
                </div>
                <div className="h-full flex items-center justify-end font-mono tnum text-textPrimary" style={{ fontSize: fig }}>
                  {pct(w.reach)}
                </div>
                {/* The beam, small: the silver share is the odds it holds */}
                <div className="h-full flex items-center justify-end gap-2 font-mono tnum font-semibold" style={{ color: SILVER, fontSize: fig }}>
                  {pct(w.hold)}
                  <span className="relative block rounded-full bg-ink/[0.06] overflow-hidden" style={{ height: beamH, width: beamW }} aria-hidden>
                    <span className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700" style={{ width: `${w.hold * 100}%`, background: SILVER, opacity: 0.85, transitionTimingFunction: EASE }} />
                  </span>
                </div>
                <div className="h-full relative flex items-center">
                  <span className="absolute left-0 right-14 rounded-full bg-ink/[0.04]" style={{ top: barInset, bottom: barInset }} />
                  <span className="absolute left-0 rounded-full transition-[width] duration-700" style={{ top: barInset, bottom: barInset, width: `calc(${(w.weightEff / max) * 100}% - ${(w.weightEff / max) * 56}px)`, background: madeOfInk(w.weightEff, max), transitionTimingFunction: EASE }} />
                  <span className="absolute right-0 font-mono tnum text-textPrimary" style={{ fontSize: small }}>
                    {fmtDollars(w.weightEff)}
                  </span>
                </div>
                <div className={`h-full flex items-center justify-end font-mono tnum whitespace-nowrap ${w.touches === 0 ? 'text-textMuted' : 'text-textPrimary'}`} style={{ fontSize: small }}>
                  {w.touches === 0 ? 'not yet' : `${w.touches}× · held ${Math.max(0, w.touches - w.breaks)} · broke ${w.breaks}`}
                </div>
                <div className="h-full flex items-center justify-end font-mono tnum text-textSecondary" style={{ fontSize: small }}>
                  {pct(w.expiresToday)}
                </div>
                <div className="h-full flex items-center font-mono tnum text-textSecondary truncate" style={{ fontSize: small }}>
                  {w.breakPath.to != null ? `runs to ${fmtStrike(w.breakPath.to)}${w.breakPath.pocket ? ' · empty' : ''}` : 'no shelf behind'}
                </div>
                <div className="h-full flex items-center pr-2 font-mono tnum text-textSecondary truncate" style={{ fontSize: small }}>
                  {w.holdPath.to != null ? `back to ${fmtStrike(w.holdPath.to)}` : '—'}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <p className="shrink-0 px-5 pb-4 pt-2 text-[12px] leading-relaxed text-textSecondary whitespace-nowrap truncate" data-wall-board-sentence title={board.sentence}>
        {board.sentence}
      </p>
    </section>
  );
};

export default WallBoard;
