/*
==================================================
  SLAYER TERMINAL - RESET VIEW CONTROL
  Every chart's way home (Noah, 2026-08-30: "on
  every chart i need a reset chart button that goes
  back to how the user was greeted... right click be
  reserved for a reset button display card").

  One control, three doors, mounted INSIDE the chart
  wrapper so every host inherits all of them:
    - a whisper pill floating on the tape (wakes on
      hover, the drawing-rail grammar)
    - RIGHT-CLICK anywhere on the chart → a context
      card at the cursor: "Reset chart view · Alt+R"
    - Alt+R while the cursor is over the chart

  The card portals to document.body — charts live
  inside overflow-hidden and transformed (RGL)
  ancestors, and a fixed card inside a transformed
  ancestor sizes to the widget, not the viewport
  (the containing-block law). It closes on pick,
  click-away, or Esc; its own mousedown is stopped
  so the click-away listener can't unmount the
  button before the click lands.

  The host is found by parentElement off a hidden
  anchor, so callers just drop the control in — no
  refs to thread. `onReset` rides a ref, so hosts
  may pass a fresh closure every render.

  OVER A PANE FOOT THE PILL STANDS ABOVE IT (approval 3,
  and its third review, 2026-10-16): wherever a foot
  with a height stands over the host — a replay's
  strip, the Backtest's clock, Paper's position bar,
  one strip across two charts — the pill's top is 2rem
  over the foot's (PaneFoot's --pane-foot-top): its own
  1.5rem and 0.5rem clear, in rem so the clearance
  grows with the pill (the fourth review: at a reader's
  larger type, a 24 px root, a fixed 32 px sank the
  36 px pill's foot under the strip). A host that keeps
  words off the pill is told whenever it may have moved
  (`onPlace`) and measures it where it stands.
==================================================
*/

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RotateCcw } from 'lucide-react';
import { useOverlay } from '../ui/layers';
import { onPaneFoot, paneFootTopOver } from './PaneFoot';

/** The pill over a pane foot: its top 2rem above the foot's — its own 1.5rem (h-6) and 0.5rem clear, both in rem, so a
    reader's larger type moves it with the pill */
const OVER_FOOT = { top: 'calc(var(--pane-foot-top) - 2rem)', bottom: 'auto' } as const;

const ResetViewControl = ({
  onReset,
  /** Where the pill floats — override to dodge a host's own furniture. At the foot's middle by rest (the audit's PU-13,
      2026-10-10): at the right it lay over the level tags ("474 · 9%") the walls print against the price axis, and the
      left foot is the drawing rail's and the engine's mark. */
  pillClass = 'left-1/2 -translate-x-1/2 bottom-8',
  /** Told whenever the pill may have moved — its place class or the foot over it changed, the host or the pill resized —
      with the pill, to measure where it stands (StrikeChart: the field's words keep clear of it) */
  onPlace,
}: {
  onReset: () => void;
  pillClass?: string;
  onPlace?: (pill: HTMLButtonElement | null) => void;
}) => {
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const pillRef = useRef<HTMLButtonElement | null>(null);
  const cb = useRef(onReset);
  cb.current = onReset;
  const placeCb = useRef(onPlace);
  placeCb.current = onPlace;
  const hoverRef = useRef(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  /* a pane foot over the host (PaneFoot): the pill stands above it — its top read off the foot's, the class's place kept
     across */
  const [overFoot, setOverFoot] = useState(false);
  useEffect(() => {
    const host = anchorRef.current?.parentElement;
    const read = () => setOverFoot(paneFootTopOver(host) != null);
    read();
    return onPaneFoot(read);
  }, []);
  /* WHERE THE PILL STANDS, said to a host that asks: after a render that moved it (its class, a foot coming or going), and
     a frame after a foot moved (the pill rides --pane-foot-top with no render) or the host or the pill was resized */
  useLayoutEffect(() => {
    placeCb.current?.(pillRef.current);
  }, [overFoot, pillClass]);
  useEffect(() => {
    const host = anchorRef.current?.parentElement;
    if (!placeCb.current || !host) return;
    let raf = 0;
    const soon = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => placeCb.current?.(pillRef.current));
    };
    const sizes = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(soon);
    sizes?.observe(host);
    if (pillRef.current) sizes?.observe(pillRef.current);
    const off = onPaneFoot(soon);
    return () => {
      cancelAnimationFrame(raf);
      sizes?.disconnect();
      off();
    };
  }, []);

  useEffect(() => {
    const host = anchorRef.current?.parentElement;
    if (!host) return;
    const onCtx = (e: MouseEvent) => {
      e.preventDefault();
      setMenu({ x: e.clientX, y: e.clientY });
    };
    const onEnter = () => {
      hoverRef.current = true;
    };
    const onLeave = () => {
      hoverRef.current = false;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.code === 'KeyR' && hoverRef.current) {
        e.preventDefault();
        cb.current();
        setMenu(null);
      }
    };
    host.addEventListener('contextmenu', onCtx);
    host.addEventListener('mouseenter', onEnter);
    host.addEventListener('mouseleave', onLeave);
    window.addEventListener('keydown', onKey);
    return () => {
      host.removeEventListener('contextmenu', onCtx);
      host.removeEventListener('mouseenter', onEnter);
      host.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [menu]);
  /* THE HOUSE'S OVERLAY CONTRACT (ui/layers.ts — the audit): Esc closes the card when it is the top layer, the keys go
     into it and back where they were */
  const cardRef = useRef<HTMLDivElement | null>(null);
  useOverlay({ open: !!menu, ref: cardRef, onClose: () => setMenu(null) });

  return (
    <>
      <span ref={anchorRef} className="hidden" aria-hidden />
      <button
        ref={pillRef}
        onClick={() => cb.current()}
        title="Reset chart view (Alt+R) — or right-click the chart"
        style={overFoot ? OVER_FOOT : undefined}
        data-reset-pill={overFoot ? 'over-foot' : ''}
        className={`hit absolute z-20 inline-flex items-center gap-1 px-2 h-6 rounded-full border border-borderSubtle bg-panel/70 backdrop-blur-md font-mono text-[11px] uppercase tracking-wider text-textMuted hover:text-textPrimary focus-visible:opacity-100 opacity-35 hover:opacity-100 transition-opacity ${pillClass}`}
      >
        <RotateCcw className="w-3 h-3" />
        Reset
      </button>
      {menu &&
        createPortal(
          <div
            ref={cardRef}
            role="menu"
            aria-label="Chart"
            className="fixed z-[200] min-w-[230px] border border-borderSubtle bg-panel/90 backdrop-blur-xl backdrop-saturate-150 rounded-md shadow-2xl shadow-black/60 p-1 animate-slide-in"
            style={{
              left: Math.min(menu.x, window.innerWidth - 246),
              top: Math.min(menu.y, window.innerHeight - 52),
            }}
            onMouseDown={e => e.stopPropagation()}
            onContextMenu={e => e.preventDefault()}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                cb.current();
                setMenu(null);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded hover:bg-ink/[0.05] font-mono text-[11px] text-textPrimary text-left transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-textSecondary" />
              Reset chart view
              <span className="ml-auto pl-6 font-mono text-[11px] text-textMuted">Alt + R</span>
            </button>
          </div>,
          document.body
        )}
    </>
  );
};

export default ResetViewControl;
