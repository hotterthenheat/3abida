/*
==================================================
  SLAYER TERMINAL - MODAL
  A centred overlay card — the house pattern for
  drilldowns that need room but must not take the
  screen. Deliberately NOT a side drawer: a right-
  hand panel covers the very rows you are comparing
  against, while a centred card over a dimmed tape
  keeps the context you came from visible.

  Owns the portal, backdrop, escape (ui/layers.ts),
  focus (ui/useFocusTrap.ts), click-outside, scroll
  lock and motion. Callers supply a header
  and a body; the body scrolls, the header doesn't.

  THE WAY OUT IS AS SMOOTH AS THE WAY IN (Noah,
  2026-09-28, on the Trace print card: "the entrance
  and exit need to be smoother"): closing keeps the
  card up for OUT_MS on a fade and a small settle,
  then a TIMER unmounts it — never an animation's
  end (the house's wedge law: a close must never
  depend on an animation finishing). The last content
  is held through the fade, so a host that clears
  its record on close does not empty the card mid-way.
==================================================
*/

/** The close: the fade's length, and the timer that follows it */
const OUT_MS = 180;

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useEscapeLayer } from './layers';
import useFocusTrap from './useFocusTrap';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  ariaLabel: string;
  header: ReactNode;
  children: ReactNode;
  /** Extra controls pinned to the header's right, before the close button. */
  headerActions?: ReactNode;
  /** Controls centred in the header — for the one control the whole view hangs on. */
  headerCenter?: ReactNode;
  /** Tailwind max-width class — default is the medium drilldown size. */
  widthClass?: string;
}

const Modal = ({ open, onClose, ariaLabel, header, children, headerActions, headerCenter, widthClass = 'max-w-[760px]' }: ModalProps) => {
  /* shown outlives open by OUT_MS — the fade; the content of the last open render is held through it */
  const [shown, setShown] = useState(open);
  const [closing, setClosing] = useState(false);
  const held = useRef({ header, children, headerActions, headerCenter });
  if (open) held.current = { header, children, headerActions, headerCenter };
  useEffect(() => {
    if (open) {
      setShown(true);
      setClosing(false);
      return;
    }
    if (!shown) return;
    setClosing(true);
    const t = window.setTimeout(() => {
      setShown(false);
      setClosing(false);
    }, OUT_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  /* ESC CLOSES THE TOP LAYER, EVERY TIME (2026-10-09, the audit's TR-2): the card used to skip any Escape another
     handler had already marked (defaultPrevented), meant for a Radix menu inside it — and a key marked by anything else
     left the card up. The layer stack (ui/layers.ts) now decides: a Radix menu open over the card takes the key, else
     the top layer closes and the key is marked, so the full-screen takeovers behind it (2026-09-10: the scripts library
     over a full-screen chart) still stand still. FOCUS comes in with the card — on the card itself, so the next Tab
     is its first control — stays inside it, and goes back to the row or button that opened it on close (X13). */
  const box = useRef<HTMLDivElement | null>(null);
  useEscapeLayer(open, onClose);
  useFocusTrap(open, box, { initialFocus: 'container' });
  // The page underneath must not scroll while we're up.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!shown) return null;
  const h = open ? { header, children, headerActions, headerCenter } : held.current;

  return createPortal(
    <div className={`fixed inset-0 z-[90] flex items-center justify-center p-4 ${closing ? 'pointer-events-none' : ''}`} data-modal-closing={closing || undefined}>
      {/* Backdrop — dimmed but deliberately still legible underneath */}
      <div className={`absolute inset-0 bg-black/55 backdrop-blur-[2px] ${closing ? 'animate-modal-backdrop-out' : 'animate-modal-backdrop'}`} onClick={onClose} aria-hidden />

      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
        className={`relative outline-none w-full ${widthClass} max-h-[86vh] flex flex-col border border-borderMuted bg-panel rounded-lg shadow-2xl shadow-black/70 overflow-hidden ${closing ? 'animate-modal-card-out' : 'animate-modal-card'}`}
      >
        {/* Three tracks so the centre stays centred no matter how long the
            identity on the left runs — an absolute overlay would collide. */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-3 border-b border-borderSubtle shrink-0">
          <div className="min-w-0">{h.header}</div>
          <div className="flex items-center justify-center">{h.headerCenter}</div>
          <div className="flex items-center justify-end gap-2">
            {h.headerActions}
            <button
              onClick={onClose}
              aria-label="Close"
              className="p-1 -m-1 rounded text-textMuted hover:text-textPrimary hover:bg-ink/[0.05] transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* [&>*]:shrink-0 — sections render at natural height and the BODY
            scrolls. Without it, any child with overflow-hidden (rounded frames)
            has a flex min-size of 0 and gets crushed to fit 86vh instead:
            clipped text, half-drawn charts, whole sections silently missing. */}
        <div className="overflow-y-auto px-4 py-4 flex flex-col gap-4 [&>*]:shrink-0">{h.children}</div>
      </div>
    </div>,
    document.body
  );
};

export default Modal;
