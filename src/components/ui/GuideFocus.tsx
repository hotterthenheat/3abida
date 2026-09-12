/*
==================================================
  SLAYER TERMINAL - THE GUIDE IN FOCUS
  (components/ui/GuideFocus.tsx)

  The house pattern for "How to read this" (Noah,
  2026-09-06: "i love this, keep it in the design
  pattern style"): a small door in a surface's
  head, and the guide as a CENTRED CARD OVER THE
  SURFACE IT EXPLAINS, the surface blurred and
  dimmed behind it — the trader's clock's focus-
  and-blur, never a popover hanging off a button.
  Esc (captured, so a fullscreen host stays) or a
  click on the blur lets go. The host renders the
  layer inside its own `relative` box.
==================================================
*/

import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Info, X } from 'lucide-react';
import { CARD } from './DropdownSelect';

interface GuideDoorProps {
  open: boolean;
  onClick: () => void;
  /** The tooltip — what the card explains */
  title: string;
  testId: string;
  className?: string;
}

/** The door: a quiet "How to read" with the info mark, lit while the guide is open */
export const GuideDoor = ({ open, onClick, title, testId, className = '' }: GuideDoorProps) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={open}
    title={title}
    data-guide-door={testId}
    className={`shrink-0 inline-flex items-center gap-1 h-6 px-1.5 rounded-md text-[10px] text-textMuted hover:text-textPrimary hover:bg-ink/[0.05] aria-pressed:text-textPrimary transition-colors ${className}`}
  >
    <Info className="w-3 h-3" /> How to read
  </button>
);

interface GuideFocusProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  testId: string;
  /** The card's width; 460 holds two figures comfortably */
  width?: number;
  /** A short host (the clock's strip, the report) cannot hold the card: the
      focus takes the whole viewport instead, portalled to the body so no
      transformed ancestor can pin it. */
  viewport?: boolean;
}

const GuideFocus = ({ open, onClose, title, children, testId, width = 460, viewport = false }: GuideFocusProps) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  const layer = (
    <AnimatePresence>
      {open && (
        <motion.div
          key="guide"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={`${viewport ? 'fixed inset-0 z-[90]' : 'absolute inset-0 z-[70] rounded-[inherit]'} flex items-center justify-center bg-black/45 backdrop-blur-[3px]`}
          data-guide-layer={testId}
          data-guide-viewport={viewport || undefined}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.985 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className={`${CARD} max-w-[calc(100%-48px)] ${viewport ? 'max-h-[calc(100vh-48px)]' : 'max-h-[calc(100%-32px)]'} overflow-y-auto overscroll-contain flex flex-col`}
            style={{ width }}
            role="dialog"
            aria-label={title}
            data-popover-card={testId}
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center gap-2 px-3 pt-2.5 pb-2 border-b border-borderSubtle/70 bg-chip">
              <span className="font-mono text-[9px] font-semibold uppercase tracking-widest text-textSecondary">{title}</span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                title="Close (Esc)"
                className="ml-auto p-1 -mr-1 rounded text-textMuted hover:text-textPrimary hover:bg-ink/[0.06] transition-colors"
                data-guide-close
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
  return viewport ? createPortal(layer, document.body) : layer;
};

export default GuideFocus;
