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
==================================================
*/

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RotateCcw } from 'lucide-react';

const ResetViewControl = ({
  onReset,
  /** Where the pill floats — override to dodge a host's own furniture. */
  pillClass = 'right-16 bottom-8',
}: {
  onReset: () => void;
  pillClass?: string;
}) => {
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const cb = useRef(onReset);
  cb.current = onReset;
  const hoverRef = useRef(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

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
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      close();
    };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [menu]);

  return (
    <>
      <span ref={anchorRef} className="hidden" aria-hidden />
      <button
        onClick={() => cb.current()}
        title="Reset chart view (Alt+R) — or right-click the chart"
        className={`absolute z-20 inline-flex items-center gap-1 px-2 h-6 rounded-full border border-borderSubtle bg-panel/70 backdrop-blur-md font-mono text-[9px] uppercase tracking-wider text-textMuted hover:text-textPrimary opacity-35 hover:opacity-100 transition-opacity ${pillClass}`}
      >
        <RotateCcw className="w-3 h-3" />
        Reset
      </button>
      {menu &&
        createPortal(
          <div
            className="fixed z-[200] min-w-[230px] border border-borderSubtle bg-panel/90 backdrop-blur-xl backdrop-saturate-150 rounded-md shadow-2xl shadow-black/60 p-1 animate-slide-in"
            style={{
              left: Math.min(menu.x, window.innerWidth - 246),
              top: Math.min(menu.y, window.innerHeight - 52),
            }}
            onMouseDown={e => e.stopPropagation()}
            onContextMenu={e => e.preventDefault()}
          >
            <button
              onClick={() => {
                cb.current();
                setMenu(null);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded hover:bg-ink/[0.05] font-mono text-[11px] text-textPrimary text-left transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-textSecondary" />
              Reset chart view
              <span className="ml-auto pl-6 font-mono text-[9px] text-textMuted">Alt + R</span>
            </button>
          </div>,
          document.body
        )}
    </>
  );
};

export default ResetViewControl;
