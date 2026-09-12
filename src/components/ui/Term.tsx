import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { TERMS, type TermKey } from '../../data/terms';

interface TermProps {
  /** Dictionary key — the definition shown in the card */
  k: TermKey;
  /** Visible text; defaults to the key itself */
  children?: ReactNode;
  className?: string;
}

/**
 * Inline jargon explainer — wraps a label with a dotted underline and reveals
 * its one-line definition in a floating card on hover OR keyboard focus.
 * Fixed-position so it never clips inside scroll containers; any scroll
 * dismisses it (a fixed card would detach from its anchor otherwise). The
 * card itself stays hoverable; a short close delay bridges the anchor→card
 * gap.
 */
const Term = ({ k, children, className = '' }: TermProps) => {
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const closeTimer = useRef(0);
  const tipId = useId();
  const [pos, setPos] = useState<{ x: number; y: number; up: boolean } | null>(null);

  const show = () => {
    window.clearTimeout(closeTimer.current);
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // Open upward when the anchor sits in the lower half of the viewport.
    const up = r.top > (window.innerHeight || 900) * 0.5;
    setPos({ x: r.left + r.width / 2, y: up ? r.top - 6 : r.bottom + 6, up });
  };
  const hide = () => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setPos(null), 140);
  };

  useEffect(() => {
    if (!pos) return;
    const dismiss = () => setPos(null);
    window.addEventListener('scroll', dismiss, true);
    return () => {
      window.removeEventListener('scroll', dismiss, true);
      window.clearTimeout(closeTimer.current);
    };
  }, [pos]);

  return (
    <span
      ref={anchorRef}
      tabIndex={0}
      role="button"
      aria-expanded={pos != null}
      aria-describedby={pos ? tipId : undefined}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onKeyDown={e => {
        if (e.key === 'Escape' && pos) {
          // Escape closes the card without moving focus, per APG.
          e.stopPropagation();
          window.clearTimeout(closeTimer.current);
          setPos(null);
          return;
        }
        if (e.key === 'Enter' || e.key === ' ') {
          // A Term can sit inside a sortable table header. Left to bubble,
          // Enter on the definition would re-sort the table instead of
          // toggling the explainer.
          e.preventDefault();
          e.stopPropagation();
          if (pos) setPos(null);
          else show();
        }
      }}
      className={`cursor-help underline decoration-dotted decoration-textMuted/60 underline-offset-2 outline-none focus-visible:rounded-sm focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-select/60 ${className}`}
    >
      {children ?? k}
      {pos &&
        // Portaled to <body> — inside transformed containers (Pulse grid
        // tiles) `fixed` would anchor to the tile and clip.
        createPortal(
          <span
            id={tipId}
            role="tooltip"
            onMouseEnter={show}
            onMouseLeave={hide}
            onClick={e => e.stopPropagation()}
            className="fixed z-[60] block w-56 rounded-md border border-borderMuted bg-chip px-3 py-2 shadow-[0_12px_32px_-12px_rgba(0,0,0,0.75),0_4px_10px_-6px_rgba(0,0,0,0.55)] normal-case tracking-normal"
            style={{
              left: Math.min(Math.max(pos.x, 120), (window.innerWidth || 1440) - 120),
              top: pos.y,
              transform: `translate(-50%, ${pos.up ? '-100%' : '0'})`,
            }}
          >
            <span className="block font-mono text-[11px] font-semibold uppercase tracking-wider text-textPrimary">{k}</span>
            <span className="mt-0.5 block font-sans text-[11px] font-normal leading-relaxed text-textSecondary">
              {TERMS[k]}
            </span>
          </span>,
          document.body
        )}
    </span>
  );
};

export default Term;
