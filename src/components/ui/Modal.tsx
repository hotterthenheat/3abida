/*
==================================================
  SLAYER TERMINAL - MODAL
  A centred overlay card — the house pattern for
  drilldowns that need room but must not take the
  screen. Deliberately NOT a side drawer: a right-
  hand panel covers the very rows you are comparing
  against, while a centred card over a dimmed tape
  keeps the context you came from visible.

  Owns the portal, backdrop, escape, click-outside,
  scroll lock and motion. Callers supply a header
  and a body; the body scrolls, the header doesn't.
==================================================
*/

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useFocusTrap } from './useFocusTrap';

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
  /* THE KEYBOARD MUST NOT WALK OUT OF A MODAL. This card carried role=dialog
     and aria-modal and neither of those does anything to Tab: the page
     behind is dimmed, not hidden, so a reader who cannot see the dim tabbed
     straight off the card and into controls that, to them, are not there.
     The trap the palette and the drilldown already use (ui/useFocusTrap),
     finally on the house's own modal. */
  const cardRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(open, cardRef);
  // Escape closes; the page underneath must not scroll while we're up.
  /* THE INNERMOST THING GETS THE KEY (2026-09-10: the scripts library opened
     over a full-screen chart, and one Escape closed the library AND left
     full screen). Listened on the document, which the key reaches before the
     window where the full-screen takeovers listen; a layer inside the modal
     (a Radix menu) that already took the key marks it defaultPrevented and is
     left alone, and the modal marks it the same way so the takeovers behind
     it stand still. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      e.preventDefault();
      onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      {/* Backdrop — dimmed but deliberately still legible underneath */}
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px] animate-modal-backdrop" onClick={onClose} aria-hidden />

      <div
        ref={cardRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className={`relative w-full ${widthClass} max-h-[86vh] flex flex-col border border-borderMuted bg-panel rounded-lg shadow-2xl shadow-black/70 overflow-hidden animate-modal-card`}
      >
        {/* Three tracks so the centre stays centred no matter how long the
            identity on the left runs — an absolute overlay would collide. */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-3 border-b border-borderSubtle shrink-0">
          <div className="min-w-0">{header}</div>
          <div className="flex items-center justify-center">{headerCenter}</div>
          <div className="flex items-center justify-end gap-2">
            {headerActions}
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
        <div className="overflow-y-auto px-4 py-4 flex flex-col gap-4 [&>*]:shrink-0">{children}</div>
      </div>
    </div>,
    document.body
  );
};

export default Modal;
