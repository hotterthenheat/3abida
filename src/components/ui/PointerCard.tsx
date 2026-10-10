/*
==================================================
  SLAYER TERMINAL - THE POINTER CARD (components/ui/PointerCard.tsx)

  The Building page's hover card, made one piece so
  every surface can wear it the same way (Noah,
  2026-09-12, on the book ladder: "use the same
  method for the translucent hover card you did for
  the building page… right now they do not function
  the same"): small, translucent glass, beside the
  pointer and moving WITH it, never in its way,
  flipping to the pointer's other side at the right
  edge and riding up when it would run off the
  bottom; a head (the strike in silver, its part, a
  word at the right) over a two-column grid of
  label · value with a small sub. Portalled to
  <body> so a transformed ancestor never traps it.

  ONE MOUNTED ELEMENT PER HOVER — the card's fade-in
  runs once, when it appears; a host that remounted
  it on every pointer move (a component defined
  inside the host's render) restarted the fade sixty
  times a second and the card never got past a third
  of its opacity (Noah, 2026-09-12: "it lacks
  smoothness… gets stuck and glitches/spazzes out").
  `PointerFollowCard` is the host-proof shape: the
  host names where the pointer WAS when the card
  appeared, and the card tracks the pointer itself
  from there, so the host never re-renders on a move.
==================================================
*/

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const SILVER = 'rgb(var(--silver))';
const GAP = 14;
const LIFT = 12;
const EDGE = 8;

interface PointerCardProps {
  /** The pointer's client position — the card sits 14px to its right (or left, at the edge), 12px above it */
  x: number;
  y: number;
  width?: number;
  /** The head's left: the strike (in silver) and its part */
  title: ReactNode;
  /** The head's right, muted */
  aside?: ReactNode;
  children: ReactNode;
  testId?: string;
  testValue?: string | number;
}

/** One line of the card: the label muted, the value right-aligned in its ink, a small sub after it */
export const CardRow = ({ k, v, sub, ink }: { k: string; v: ReactNode; sub?: ReactNode; ink?: string }) => (
  <>
    <span className="text-textMuted whitespace-nowrap">{k}</span>
    <span className="text-right font-mono text-[11px] tnum whitespace-nowrap" style={{ color: ink ?? 'rgb(var(--text-primary))' }}>
      {v}
      {sub != null && <span className="text-[11px] text-textMuted"> {sub}</span>}
    </span>
  </>
);

const PointerCard = ({ x, y, width = 196, title, aside, children, testId = 'data-pointer-card', testValue = '' }: PointerCardProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const onRight = typeof globalThis.innerWidth !== 'number' || x + GAP + width < globalThis.innerWidth - EDGE;
  /* The card's own height decides where it stops at the bottom edge — measured
     before paint on every placement, so the card follows the pointer as far
     down as it can and never jumps to a guess */
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof globalThis.innerHeight !== 'number') return;
    el.style.top = `${Math.max(EDGE, Math.min(y - LIFT, globalThis.innerHeight - EDGE - el.offsetHeight))}px`;
  });
  return createPortal(
    <div
      ref={ref}
      className="fixed z-[90] rounded-lg border border-borderMuted bg-card/85 backdrop-blur-md px-3 py-2.5 shadow-[0_12px_32px_rgba(0,0,0,0.55)] animate-soft-in pointer-events-none"
      style={{ width, left: onRight ? x + GAP : x - GAP - width, top: Math.max(EDGE, y - LIFT) }}
      {...{ [testId]: testValue }}
    >
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[11px] font-semibold tnum inline-flex items-baseline gap-1.5" style={{ color: SILVER }}>
          {title}
        </span>
        {aside != null && <span className="ml-auto text-[11px] text-textMuted whitespace-nowrap">{aside}</span>}
      </div>
      <div className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">{children}</div>
    </div>,
    document.body
  );
};

interface PointerFollowCardProps extends Omit<PointerCardProps, 'x' | 'y'> {
  /** Where the pointer was when the card appeared — the card tracks it from here on its own */
  start: { x: number; y: number };
}

/** The card that follows the pointer by itself: mount it once per hover, change
    its content as the pointer crosses rows, and only the card re-renders on a
    move — the host's rows never do */
export const PointerFollowCard = ({ start, ...rest }: PointerFollowCardProps) => {
  const [pos, setPos] = useState(start);
  useEffect(() => {
    const onMove = (ev: PointerEvent) => setPos({ x: ev.clientX, y: ev.clientY });
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);
  return <PointerCard x={pos.x} y={pos.y} {...rest} />;
};
