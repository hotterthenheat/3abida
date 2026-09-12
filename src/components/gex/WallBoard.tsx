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

  THE ROWS SHARE THE BOX (the lock walk, Noah,
  2026-09-09: "make every wall on the strikes show
  taller and cover the full box when it becomes
  taller"): the box is up to BOARD_H tall and the
  walls split what the head and the sentence leave —
  five walls stand ~64px each, nine ~36px, never
  under 24 (past that the grid scrolls). The type,
  the beam and the made-of bar grow with the row,
  the calendar's way, so a tall row is not a thin
  line lost in space. AND NEVER PAST 64 (Noah,
  2026-09-10, four walls at 85px: "it became HUGE"):
  the box itself is sized by `boardH(n)`, so four
  walls make a shorter box, not taller rows.
==================================================
*/

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ROLE_INK } from './AtTheWall';
import { heatLaneColor } from './heatmap';
import { BOARD_COLUMNS as COLUMNS, BOARD_HEAD_H, boardRows } from './wallSkeletons';
import { fmtDollars, fmtStrike, type AheadClock } from '../../data/ahead';
import type { WallBoard as Board } from '../../data/wall';

const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */
const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';
/** What a wall is made of, in the calendar's own ink: hedging that pushes
    back is the cool side of the thermal ramp, deeper the heavier (Noah,
    2026-09-08: "everything is gray and practically unable to read") */
const madeOfInk = (weight: number, max: number) => heatLaneColor(-Math.abs(weight), max, 'thermal-yellow', 0.35);
const pct = (v: number) => `${Math.round(v * 100)}%`;
const ROW_MIN = 24;
const ROW_GAP = 3;

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

  /* HOW TALL A ROW IS — read off the grid, so the type and the bars can grow with it */
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [rowH, setRowH] = useState(ROW_MIN);
  useLayoutEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const read = () => {
      const h = el.clientHeight;
      const next = Math.max(ROW_MIN, (h - BOARD_HEAD_H - ROW_GAP * Math.max(1, n)) / Math.max(1, n));
      setRowH(prev => (Math.abs(prev - next) < 0.5 ? prev : next));
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [n]);
  /* 0 at a 24px row, 1 from 64px: the scale the type and the bars follow */
  const s = Math.max(0, Math.min(1, (rowH - ROW_MIN) / 40));
  const fig = `${(11 + 2 * s).toFixed(1)}px`;
  const small = `${(10 + 2 * s).toFixed(1)}px`;
  const tagSize = `${(8 + 1.5 * s).toFixed(1)}px`;
  const beamH = Math.round(6 + 4 * s);
  const beamW = Math.round(52 + 28 * s);
  const barInset = `${Math.round(rowH * 0.34)}px`;

  return (
    <section className="relative flex flex-col min-w-0 h-full min-h-0" data-wall-board data-row-h={rowH.toFixed(1)}>
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
      <div className="flex-1 min-h-0 px-5 pb-2 overflow-auto" data-wall-rows onPointerLeave={() => setHover(null)}>
        <div ref={gridRef} className="grid h-full min-w-[900px] items-center gap-x-3 gap-y-[3px]" style={{ gridTemplateColumns: COLUMNS, gridTemplateRows: boardRows(n) }}>
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
                <div className={`h-full flex items-center gap-1.5 px-2 font-mono tnum ${kept ? 'text-silver font-bold shadow-[inset_2px_0_0_0_rgba(199,211,232,0.7)]' : 'text-textPrimary'}`} style={{ fontSize: fig }}>
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
