import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface HoverReadoutProps {
  /** Cursor client X/Y — the card floats just off the pointer and stays on-screen. */
  x: number;
  y: number;
  children: ReactNode;
}

const GAP = 14;
const EDGE = 8;

/**
 * The house floating read-out — one styled card for per-element hover detail,
 * so it reads identically wherever it appears. Pointer events pass through;
 * the card clamps to the viewport so it never clips. Portaled to <body>:
 * inside transformed containers (the Pulse grid tiles position with CSS
 * transforms) `fixed` would anchor to the tile and clip.
 *
 * The clamp measures the card rather than assuming it: a hard-coded size
 * either clips a wider card or slides the clamp back *under* the cursor near
 * the right edge — covering the cell being read. It flips to the other side
 * of the pointer when there is no room, and a max-width keeps the card's
 * shape stable wherever it lands.
 */
const HoverReadout = ({ x, y, children }: HoverReadoutProps) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 240, h: 130 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    setSize(prev => (prev.w === w && prev.h === h ? prev : { w, h }));
  }, [children]);

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1440;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 900;

  const flipX = x + GAP + size.w > vw - EDGE;
  const flipY = y + GAP + size.h > vh - EDGE;
  const left = Math.max(EDGE, flipX ? x - GAP - size.w : x + GAP);
  const top = Math.max(EDGE, flipY ? y - GAP - size.h : y + GAP);

  return createPortal(
    <div
      ref={ref}
      /* z-[90]: above the fullscreen takeovers (z-[80]) — a card that hides
         under the surface it explains is no card (2026-09-03). */
      className="pointer-events-none fixed z-[90] max-w-[320px] rounded-md border border-borderMuted bg-chip px-3 py-2 shadow-[0_12px_32px_-12px_rgba(0,0,0,0.75),0_4px_10px_-6px_rgba(0,0,0,0.55)]"
      style={{ left, top }}
    >
      {children}
    </div>,
    document.body
  );
};

export default HoverReadout;
