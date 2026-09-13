/*
==================================================
  SLAYER TERMINAL - CONTRACT PICK (Compass)
  The premium chart's capsule as a DOOR (Noah,
  2026-08-30, round 2: "should it be ALL cons for
  that ticker... a little distinguishing feature
  about each one stating wether its a weekly, 0dte").

  The menu lists EVERY con this ticker has on the
  Compass page — the reader's CHOSEN scanner swept
  across every eligible tenor (crossing scanners
  silently would re-grade cons under a lens the user
  didn't pick), each row wearing its sleeve tag.
  Rows load LAZILY on first open: four sweeps are
  click-money, not tick-money. Picking carries the
  sleeve through the door, so a weekly con opens ON
  the weekly lens — the Tracker sleeve lesson,
  applied at the source.

  The Weigher's StrikePick grammar, Compass-flavored:
  capsule + chevron, glass menu (anchored, portaled —
  the tape region is overflow-hidden, an in-place
  menu would clip), Esc and click-away close.
==================================================
*/

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { useAnchoredMenu } from '../ui/useAnchoredMenu';
import type { OptionRight, SleeveKey } from '../../types/compass';

const MENU_W = 288;

export interface ConPickRow {
  key: string;
  strike: number;
  right: OptionRight;
  sleeve: SleeveKey;
  /** The listed expiry's calendar days — the page prices the pick at this exact date (2026-09-12) */
  dte?: number;
  /** The contract, e.g. "AAPL 185.50C" */
  title: string;
  /** The distinguishing word — the sleeve's label (0DTE / Weekly / …) */
  tag: string;
  /** Right-side whisper, e.g. the live mid */
  sub: string;
}

const ContractPick = ({
  label,
  current,
  loadRows,
  onPick,
}: {
  label: string;
  current: { strike: number; right: OptionRight; sleeve: SleeveKey };
  /** Called on first open — the sweeps run when the reader asks, not per tick. */
  loadRows: () => ConPickRow[];
  onPick: (strike: number, right: OptionRight, sleeve: SleeveKey, dte?: number) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ConPickRow[] | null>(null);
  const { anchorRef, placed } = useAnchoredMenu<HTMLButtonElement>(open, 'bottom', MENU_W, 'start');
  const menuRef = useRef<HTMLDivElement | null>(null);

  // A re-pointed page hands in a fresh loader — stale rows die with the old one.
  useEffect(() => setRows(null), [loadRows]);
  useEffect(() => {
    if (open && rows === null) setRows(loadRows());
  }, [open, rows, loadRows]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || anchorRef.current?.contains(t)) return;
      setOpen(false);
    };
    // Window-capture Escape — the innermost open thing gets the key.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open, anchorRef]);

  return (
    <>
      <button
        ref={anchorRef}
        onClick={() => setOpen(o => !o)}
        title="Every contract this name has on the board — step between them"
        className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-ink/[0.06] hover:bg-ink/[0.10] font-mono text-[11px] font-bold text-textPrimary transition-colors shrink-0"
      >
        {label}
        <ChevronDown className={`w-3 h-3 text-textSecondary transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open &&
        placed &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            aria-label="Contracts on this name"
            style={{ position: 'fixed', ...placed.box }}
            className="z-[120] w-[288px] border border-borderMuted bg-panel/80 backdrop-blur-xl backdrop-saturate-150 rounded-md shadow-2xl shadow-black/60 overflow-x-hidden overflow-y-auto overscroll-contain animate-slide-in p-1"
          >
            {rows === null && (
              <div className="px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-textMuted">Sweeping the book…</div>
            )}
            {rows?.map(r => {
              const isCur =
                Math.abs(r.strike - current.strike) < 1e-9 && r.right === current.right && r.sleeve === current.sleeve;
              return (
                <button
                  key={r.key}
                  role="option"
                  aria-selected={isCur}
                  onClick={() => {
                    setOpen(false);
                    if (!isCur) onPick(r.strike, r.right, r.sleeve, r.dte);
                  }}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-left transition-colors ${
                    isCur ? 'bg-ink/[0.06]' : 'hover:bg-ink/[0.04]'
                  }`}
                >
                  <span className="font-mono text-[11px] font-bold text-textPrimary">{r.title}</span>
                  <span className="px-1 py-px rounded border border-borderSubtle bg-ink/[0.05] font-mono text-[8px] font-semibold uppercase tracking-wider text-textSecondary">
                    {r.tag}
                  </span>
                  <span className="ml-auto font-mono text-[10px] tnum text-textSecondary">{r.sub}</span>
                </button>
              );
            })}
            {rows !== null && rows.length === 0 && (
              <div className="px-3 py-2 font-mono text-[10px] text-textMuted">Nothing else surfaced for this name today</div>
            )}
          </div>,
          document.body
        )}
    </>
  );
};

export default ContractPick;
