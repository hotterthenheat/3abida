/*
==================================================
  SLAYER TERMINAL - THE SCOPE CHIP (components/ui/ScopeChip.tsx)

  The one control that says WHICH NAME a surface
  reads, now that the frame owns the terminal's
  subject (direction B, Noah, 2026-09-05). Two
  states, one grammar, on every page:

    FOLLOWS the frame — a quiet chip: a silver link
      and the words "follows SPY". Nothing to read
      twice: the name and its price are in the
      sidebar. A pick here moves the frame, so every
      following surface moves with it.

    ITS OWN name — a bordered chip with the mark,
      the name, and (when asked) the live price and
      change: this surface has stepped off the
      frame. A pick here stays here. The broken link
      at its end puts it back on the frame.

  A surface with no link model at all (a chart pane
  on Terrain, a cell on the 4-way board) wears the
  own-name chip without the broken link: every one
  of them holds its own name by design.

  ONE CONTROL, IN THE TRIGGERS' CLOTHES (the lock
  walk, Noah, 2026-09-09: "the ticker selection
  button. its damn near hiding. not easy to see on
  any of the cards"): the following chip used to be
  bare words — a small silver link and "follows SPY"
  in the secondary ink, no ground, no border — and
  it vanished on every head. Both states now wear
  the same bordered chip every DropdownSelect
  trigger wears (the #0c0c0c ground, the subtle
  border; 24px tall, the title rows' height, where
  the triggers are 28): the mark, the name, the quote
  when asked, the chevron — and the link state as
  the chip's own end, behind a hairline: the silver
  link while it follows, the broken one when it
  holds its own name.

  Replaces WidgetTickerPicker (the pin) on Pulse and
  the bare TickerQuickPick on the pane heads.
==================================================
*/

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Link2, Unlink2 } from 'lucide-react';
import Simulator from '../../core/simulator';
import CompanyLogo from './CompanyLogo';
import TickerLookup from './TickerLookup';
import useFocusTrap from './useFocusTrap';
import { useAnchoredMenu } from './useAnchoredMenu';

const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */
/** Matches the `w-72` on the menu — the placement keeps its far edge on screen */
const MENU_W = 288;

interface ScopeChipProps {
  /** The name this surface reads right now */
  ticker: string;
  /** Whether it follows the frame's subject. Omitted = no link model: the
      surface always holds its own name (Terrain panes, the 4-way board). */
  linked?: boolean;
  /** Link ↔ unlink. Only meaningful with `linked`. */
  onToggleLink?: () => void;
  /** A name was picked — the host decides whether that moves the frame
      (linked) or only this surface (its own). */
  onPick: (ticker: string) => void;
  /** Print the live price and change on an own-name chip. Off where the
      host already prints its own price beside the chip. */
  quote?: boolean;
  /** Optionally controlled, like TickerQuickPick — a host with keys owns it */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title?: string;
  /** The FOLLOWING chip in the own-name chip's clothes — the mark, the name,
      the quote — with the silver link at its end saying it follows. For a
      surface where two chips stand side by side and must look alike (Compare,
      Noah 2026-09-09: "make the left one look like the right one"). */
  full?: boolean;
}

const ScopeChip = ({ ticker, linked, onToggleLink, onPick, quote, open: openProp, onOpenChange, title, full = false }: ScopeChipProps) => {
  const [selfOpen, setSelfOpen] = useState(false);
  const open = openProp ?? selfOpen;
  const setOpen = (next: boolean) => {
    onOpenChange?.(next);
    if (openProp === undefined) setSelfOpen(next);
  };
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const { anchorRef, placed } = useAnchoredMenu<HTMLButtonElement>(open, 'bottom', MENU_W, 'start');
  useFocusTrap(open, menuRef);

  /* Outside click and Escape close it — window-capture on the key so the
     desk behind (an expanded pane on Escape) never sees it. POINTERDOWN, not
     mousedown (Noah, 2026-09-06: "i shouldn't be able to open 2 dropdowns at
     once"): a Radix trigger opens on pointerdown and prevents its default,
     which cancels the compatibility mousedown — so a mousedown listener never
     heard the click that opened the other menu, and both stayed open. */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pick = (sym: string) => {
    setOpen(false);
    if (sym && sym !== ticker) onPick(sym);
  };

  const hasLink = linked !== undefined;
  const follows = linked === true;

  /* The live quote, read straight from the simulator: a pure read, and the
     host re-renders on every tick anyway. */
  const cfg = quote && (!follows || full) ? Simulator.TICKERS[ticker] : undefined;
  const price = cfg?.currentPrice;
  const change = cfg ? ((cfg.currentPrice - cfg.basePrice) / cfg.basePrice) * 100 : undefined;

  const menu =
    open &&
    placed &&
    createPortal(
      <div
        ref={menuRef}
        role="dialog"
        aria-label={`Change symbol — currently ${ticker}`}
        style={{ position: 'fixed', ...placed.box }}
        className="z-[120] w-72 border border-borderMuted bg-panel/80 backdrop-blur-xl backdrop-saturate-150 rounded-md shadow-2xl shadow-black/60 overflow-x-hidden overflow-y-auto overscroll-contain animate-slide-in"
      >
        {hasLink && (
          <div className="px-2.5 py-1.5 border-b border-borderSubtle text-[10px] text-textMuted">
            {follows ? 'Follows the frame — a name picked here moves the whole terminal' : 'Its own name — a name picked here stays on this panel'}
          </div>
        )}
        <TickerLookup active={ticker} onPick={pick} />
      </div>,
      document.body
    );

  /* ONE CHIP FOR BOTH STATES, in the triggers' clothes: the picker, then the
     link state as the chip's own end behind a hairline. */
  return (
    <span
      ref={rootRef}
      /* h-6, not the triggers' h-7: the chip lives on 24px title rows, and every
         page's skeleton was measured with a 24px chip there */
      className={`relative inline-flex items-stretch h-6 rounded-md border bg-chip overflow-hidden transition-colors font-mono select-none ${open ? 'border-silver/50' : 'border-borderSubtle hover:border-borderMuted'}`}
      data-scope={follows ? 'follows' : 'own'}
      data-scope-ticker={ticker}
    >
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={`${follows ? 'Follows' : 'Reads'} ${ticker} — pick another name`}
        title={title ?? (follows ? 'Follows the terminal · pick a name to move the whole terminal' : hasLink ? 'Its own name · pick a name for this panel alone' : 'Switch ticker')}
        className="inline-flex items-center gap-1.5 pl-2 pr-1.5 hover:bg-ink/[0.05] transition-colors"
        data-scope-pick
      >
        <CompanyLogo ticker={ticker} size={14} />
        <span className="text-[12px] font-semibold text-textPrimary leading-none">{ticker}</span>
        {price != null && change != null && (
          <>
            <span className="text-[11px] tnum text-textPrimary leading-none" data-scope-price>
              ${price.toFixed(2)}
            </span>
            <span className={`text-[10px] tnum leading-none ${change >= 0 ? 'text-bull' : 'text-bear'}`}>
              {change >= 0 ? '+' : ''}
              {change.toFixed(2)}%
            </span>
          </>
        )}
        <ChevronDown className={`w-3 h-3 text-textMuted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {hasLink && (
        <button
          type="button"
          onClick={onToggleLink}
          aria-pressed={follows}
          aria-label={follows ? `Follows the terminal's ${ticker} — click to give this panel its own name` : `Holds ${ticker} — click to follow the terminal again`}
          title={follows ? 'Follows the terminal · click to give this panel its own name' : 'Its own name · click to follow the terminal again'}
          className={`inline-flex items-center justify-center px-1.5 border-l border-borderSubtle hover:bg-ink/[0.05] transition-colors ${follows ? '' : 'text-textMuted hover:text-textPrimary'}`}
          style={follows ? { color: SILVER } : undefined}
          data-scope-link
        >
          {follows ? <Link2 className="w-3 h-3" /> : <Unlink2 className="w-3 h-3" />}
        </button>
      )}
      {menu}
    </span>
  );
};

export default ScopeChip;
