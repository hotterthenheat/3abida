/*
==================================================
  SLAYER TERMINAL - THE MARK (brand/SlayerMark.tsx)

  ">S|" on its tile — "One SVG component for the side rail, the loading screen and the landing" (Slayer Logo System,
  2026-09-30). The S is outlined from the spec; holographic silver pans across it, 4.5 s each way; the cursor is the
  one bright part. On paper the S is graphite and the cursor the page's black.

  THE MARK STANDS STILL BUT FOR TWO THINGS (the owner, 2026-10-02: "the logo stays still outside of the holographic
  silver that moves the | is the one that blinks"): the foil pans across the S in every state but offline, and the
  cursor blinks in every state but offline (hidden) and alert (the warning ink flashes in its place). No glow round the
  cursor, no lime, no still graphite S. And "it should be in sync": every mark and wordmark cursor on a page blinks and
  pans on one beat, whenever it mounted (brand/brandClock.ts pins each loop to the page's clock).

  WHY IT IS THREE LAYERS AND NOT ONE SVG: the S never stops moving, and an SVG part that animates is repainted every
  frame (the speed rules, .claude/CLAUDE.md). So the tile, its brackets and the ">" are a still SVG; the S is a box
  cut to the S's outline (a CSS mask) with a wide strip of foil inside it that SLIDES — a transform, which the
  compositor runs without painting anything; the cursor is a box whose opacity blinks, the same. Nothing here paints
  after the first frame.

  SIZES: from 64 px the whole mark — tile, corner brackets, the ">". Below 64 px there is no ">" and no brackets; the
  S| is centred on its tile. `bare` drops the tile too (the phone strip's door, a heading's small mark).

  STATES: brand/markState.ts. The mark follows the terminal unless it is told a state (the Logo System's own table on
  the landing, a preview in Settings).

  NEAR: "Bring the pointer within 80 px and the S brightens" — opt-in, for the rail's mark and the landing's.
==================================================
*/

import { useEffect, useLayoutEffect, useRef, type CSSProperties } from 'react';
import { MARK } from './paths';
import { useMarkState, type MarkState } from './markState';
import { alignBrandLoops } from './brandClock';

interface SlayerMarkProps {
  /** the box's side, px */
  size: number;
  /** the state to show — the terminal's own when left out */
  state?: MarkState;
  /** no tile: the S| alone */
  bare?: boolean;
  /** brighten the S when the pointer comes within 80 px */
  near?: boolean;
  className?: string;
  /** the accessible name — "Slayer Terminal" when left out; an empty string makes the mark decorative */
  label?: string;
}

/** the S| alone, without the ">": 24.4 → 51.9 across, 15.49 → 48.49 down */
const CONTENT = { x0: 24.4, y0: 15.49, x1: 51.9, y1: 48.49 };

type Box = { x: number; y: number; side: number };

const boxFor = (size: number, bare: boolean): Box => {
  if (!bare && size >= 64) return { x: 0, y: 0, side: 64 };
  const w = CONTENT.x1 - CONTENT.x0;
  const h = CONTENT.y1 - CONTENT.y0;
  const side = Math.max(w, h) * (bare ? 1.1 : 1.5);
  return { x: (CONTENT.x0 + CONTENT.x1) / 2 - side / 2, y: (CONTENT.y0 + CONTENT.y1) / 2 - side / 2, side };
};

/** a rectangle in tile units, as percentages of the box */
const place = (b: Box, x: number, y: number, w: number, h: number): CSSProperties => ({
  left: `${((x - b.x) / b.side) * 100}%`,
  top: `${((y - b.y) / b.side) * 100}%`,
  width: `${(w / b.side) * 100}%`,
  height: `${(h / b.side) * 100}%`,
});

/* The S's outline as a mask image, built once: its own viewBox is the S's box, so it fills the masked box exactly */
const [sx0, sy0, sx1, sy1] = MARK.sBox;
const S_MASK = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${sx0} ${sy0} ${sx1 - sx0} ${sy1 - sy0}" preserveAspectRatio="none"><path d="${MARK.s}"/></svg>`
)}")`;

/* ── NEAR: one listener for every mark that asked, rect reads batched into a frame ─────────────────────────────── */
const nearMarks = new Set<HTMLElement>();
let nearFrame = 0;
let lastPointer: { x: number; y: number } | null = null;
const NEAR_PX = 80;
const checkNear = () => {
  nearFrame = 0;
  if (!lastPointer) return;
  const { x, y } = lastPointer;
  nearMarks.forEach(el => {
    const r = el.getBoundingClientRect();
    const dx = Math.max(r.left - x, 0, x - r.right);
    const dy = Math.max(r.top - y, 0, y - r.bottom);
    const near = dx * dx + dy * dy <= NEAR_PX * NEAR_PX && r.width > 0;
    if (near !== el.hasAttribute('data-near')) el.toggleAttribute('data-near', near);
  });
};
const onPointer = (e: PointerEvent) => {
  lastPointer = { x: e.clientX, y: e.clientY };
  if (!nearFrame) nearFrame = requestAnimationFrame(checkNear);
};
const watchNear = (el: HTMLElement) => {
  nearMarks.add(el);
  if (nearMarks.size === 1) window.addEventListener('pointermove', onPointer, { passive: true });
  return () => {
    nearMarks.delete(el);
    el.removeAttribute('data-near');
    if (nearMarks.size === 0) {
      window.removeEventListener('pointermove', onPointer);
      if (nearFrame) cancelAnimationFrame(nearFrame);
      nearFrame = 0;
    }
  };
};

/** The mark with the terminal's own state */
const LiveMark = (props: Omit<SlayerMarkProps, 'state'>) => {
  const state = useMarkState();
  return <MarkFace {...props} state={state} />;
};

/** The mark: the terminal's state unless one is given */
const SlayerMark = (props: SlayerMarkProps) => (props.state ? <MarkFace {...props} state={props.state} /> : <LiveMark {...props} />);

const MarkFace = ({ size, state, bare = false, near = false, className = '', label }: SlayerMarkProps & { state: MarkState }) => {
  const ref = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    if (!near || !ref.current) return;
    return watchNear(ref.current);
  }, [near]);
  /* on the page's beat from the first frame, and again whenever the state changes the loops (brand/brandClock.ts) */
  useLayoutEffect(() => {
    alignBrandLoops(ref.current);
  }, [state]);

  const b = boxFor(size, bare);
  const full = !bare && size >= 64;
  const radius = full ? 3 : b.side * 0.075;
  const [cx, cy, cw, ch] = MARK.cursor;
  const name = label ?? 'Slayer Terminal';
  return (
    <span
      ref={ref}
      className={`slayer-mark ${className}`}
      data-state={state}
      data-mark-size={full ? 'full' : bare ? 'bare' : 'small'}
      style={{ width: size, height: size, '--sm-u': `${size / b.side}px` } as CSSProperties}
      role={name ? 'img' : undefined}
      aria-label={name || undefined}
      aria-hidden={name ? undefined : true}
    >
      <svg viewBox={`${b.x} ${b.y} ${b.side} ${b.side}`} aria-hidden focusable="false">
        {!bare && (
          <>
            <rect x={b.x} y={b.y} width={b.side} height={b.side} rx={radius} style={{ fill: 'rgb(var(--tile))' }} />
            <rect
              x={b.x + 0.4}
              y={b.y + 0.4}
              width={b.side - 0.8}
              height={b.side - 0.8}
              rx={Math.max(0, radius - 0.4)}
              style={{ fill: 'none', stroke: 'rgb(var(--tile-edge))', strokeWidth: 0.8 }}
            />
          </>
        )}
        {full && (
          <>
            <path d={MARK.brackets} style={{ fill: 'none', stroke: 'rgb(var(--bracket))', strokeWidth: 0.7 }} />
            <path d={MARK.chevron} style={{ fill: 'rgb(var(--chevron))' }} />
          </>
        )}
      </svg>
      <span className="sm-s" style={{ ...place(b, sx0, sy0, sx1 - sx0, sy1 - sy0), WebkitMaskImage: S_MASK, maskImage: S_MASK }} aria-hidden>
        <span className="sm-foil" />
      </span>
      <span className="sm-cursor" style={place(b, cx, cy, cw, ch)} aria-hidden />
      <span className="sm-cursor sm-cursor-warn" style={place(b, cx, cy, cw, ch)} aria-hidden />
    </span>
  );
};

export default SlayerMark;
