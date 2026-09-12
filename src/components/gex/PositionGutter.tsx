/*
==================================================
  SLAYER TERMINAL - THE POSITION GUTTER
  (components/gex/PositionGutter.tsx)

  Your contracts on the Map's price axis. A thin
  column between the chart's own scale and the rail,
  one chip per strike you hold, placed at the price
  the chart puts that strike at — the same
  PriceProjection the rail reads, in the same kind
  of frame loop, so a chip and the rail's row for
  that strike can never disagree.

  SILVER, because silver is where-you-are (the
  colour law) and a position is the most where-you-
  are thing on the page. Owned = a filled chip,
  sold = an outlined one. Click a chip and its
  strike is the terminal's strike. Hover and the
  read for that position is the tooltip.

  Renders nothing at all when there are no
  positions — the Map does not pay for an empty
  column.
==================================================
*/

import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import type { PriceProjection } from './StrikeChart';
import type { Position, PositionRead } from '../../data/positions';

const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */
export const GUTTER_W = 36;
const fmtStrike = (v: number) => (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2));

interface Stack {
  strike: number;
  /** "5C" · "2P" · "5C+2P" */
  label: string;
  /** True when every contract at the strike is owned */
  allOwned: boolean;
  title: string;
}

interface PositionGutterProps {
  positions: Position[];
  reads: ReadonlyMap<string, PositionRead>;
  projection: MutableRefObject<PriceProjection | null>;
  focusPrice?: number | null;
  onSelect?: (strike: number) => void;
}

const PositionGutter = ({ positions, reads, projection, focusPrice, onSelect }: PositionGutterProps) => {
  const trackRef = useRef<HTMLDivElement>(null);

  /* One chip per strike — calls and puts at the same strike stack into one label */
  const stacks = useMemo<Stack[]>(() => {
    const by = new Map<number, Position[]>();
    for (const p of positions) by.set(p.strike, [...(by.get(p.strike) ?? []), p]);
    return [...by.entries()]
      .map(([strike, ps]) => {
        const calls = ps.filter(p => p.right === 'C').reduce((s, p) => s + p.contracts, 0);
        const puts = ps.filter(p => p.right === 'P').reduce((s, p) => s + p.contracts, 0);
        const label = [calls ? `${calls}C` : '', puts ? `${puts}P` : ''].filter(Boolean).join('+');
        return {
          strike,
          label,
          allOwned: ps.every(p => p.side === 'long'),
          title: ps.map(p => reads.get(p.id)?.sentence ?? `${fmtStrike(strike)}`).join('\n'),
        };
      })
      .sort((a, b) => b.strike - a.strike);
  }, [positions, reads]);

  /* THE FRAME LOOP — the chart owns the mapping; we read it and move the chips
     only on the frames the mapping actually changed (the rail's fingerprint). */
  useEffect(() => {
    const track = trackRef.current;
    if (!track || !stacks.length) return;
    let raf = 0;
    let fpY = NaN;
    let fpH = -1;
    const hide = () => {
      if (track.style.opacity !== '0') track.style.opacity = '0';
      fpY = NaN;
      fpH = -1;
    };
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const p = projection.current;
      if (!p) return hide();
      const H = p.plotHeight();
      const y0 = p.yFor(stacks[0].strike);
      if (y0 == null || H <= 0) return hide();
      if (Math.round(y0 * 4) === fpY && H === fpH) return;
      fpY = Math.round(y0 * 4);
      fpH = H;
      track.style.height = `${H}px`;
      const chips = track.querySelectorAll<HTMLElement>('[data-position-chip]');
      chips.forEach(el => {
        const y = p.yFor(Number(el.dataset.strike));
        if (y == null || y < 0 || y > H) {
          el.style.display = 'none';
          return;
        }
        el.style.display = '';
        el.style.top = `${y}px`;
      });
      track.style.opacity = '1';
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [projection, stacks]);

  if (!stacks.length) return null;

  return (
    <div data-theme="dark" className="relative shrink-0 border-l border-borderSubtle/60 bg-panel" style={{ width: GUTTER_W }} data-position-gutter aria-label="Your positions on the price axis">
      <div ref={trackRef} className="absolute left-0 right-0 top-0 overflow-hidden transition-opacity duration-150" style={{ opacity: 0 }}>
        {stacks.map(s => {
          const isFocus = focusPrice != null && Math.abs(focusPrice - s.strike) < 1e-9;
          return (
            <button
              key={s.strike}
              data-position-chip
              data-strike={s.strike}
              title={s.title}
              onClick={() => onSelect?.(s.strike)}
              className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 px-1 h-[14px] rounded-[3px] font-mono text-[9px] font-bold tnum leading-none whitespace-nowrap transition-shadow"
              style={
                s.allOwned
                  ? { background: SILVER, color: '#0a0a0a', boxShadow: isFocus ? `0 0 0 1.5px ${SILVER}, 0 0 0 3px #0a0a0a` : undefined }
                  : { background: '#0a0a0a', color: SILVER, border: `1px solid ${SILVER}`, boxShadow: isFocus ? `0 0 0 1.5px ${SILVER}` : undefined }
              }
            >
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default PositionGutter;
