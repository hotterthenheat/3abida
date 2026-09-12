/*
==================================================
  SLAYER TERMINAL - TICKER QUICK-PICK
  The compact in-header ticker switcher shared by
  the flow-board minis, the 4-way chart board and
  the live chart's fullscreen strip. The menu is a
  full-universe search (S&P 500 + NASDAQ listings),
  not a watchlist — four presets and a blind text
  box was the whole reachable market until Noah
  called it (2026-08-18). Unknown symbols still
  pick on Enter; the sim synthesizes them.
==================================================
*/

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAnchoredMenu } from '../ui/useAnchoredMenu';

/** Matches the `w-72` on the menu below. Passed to the placement so it can
    keep the menu's far edge on screen; assuming a narrower default put this
    one 162px off the left of the window in a left-column pane. */
const MENU_W = 288;
import { ChevronDown } from 'lucide-react';
import TickerLookup from '../ui/TickerLookup';
import useFocusTrap from '../ui/useFocusTrap';

interface TickerQuickPickProps {
  /* The chain card wears the SLIM cut (Noah, 2026-08-26: "make it blend in
     with its background more and thinner... it just doesnt look like it
     belongs there") — the capsule's pill is the chart toolbar's grammar,
     where the name is the subject and earns a surface. In a strip of quiet
     text chips it speaks chip instead: no fill, chip-height, hover reveal. */
  slim?: boolean;
  /** What the capsule SAYS when that is more than the ticker — the Weigher's
      contract lens prints the whole contract ("SPY 507 Call") while the
      button stays the same ticker door it always was. */
  label?: string;
  ticker: string;
  onPick: (ticker: string) => void;
  /* The button's tooltip. Defaulted, so every caller that has never thought
     about it keeps the words it already had. A host with KEYS on this control
     names them here — Terrain's `s` opens this menu and ↑/↓ step the symbol
     without it, and the desk's convention is that a control's title names its
     key (the expand button's "— F", the rail's "— R"). */
  title?: string;
  /* OPTIONALLY CONTROLLED. Left alone the button owns its own open state, the
     way every other caller uses it. A host that has to open this from a
     keyboard passes both, and then owns it — there is no third state where
     both the host and the button think they are in charge. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const TickerQuickPick = ({ ticker, onPick, open: openProp, onOpenChange, slim, label, title = 'Switch ticker' }: TickerQuickPickProps) => {
  const [selfOpen, setSelfOpen] = useState(false);
  const open = openProp ?? selfOpen;
  const setOpen = (next: boolean) => {
    onOpenChange?.(next);
    if (openProp === undefined) setSelfOpen(next);
  };
  const rootRef = useRef<HTMLDivElement | null>(null);
  /* Portalled and placed, same as the toolbar's menus — see useAnchoredMenu
     for why this could not stay `absolute` inside the pane. */
  /* 'start': the capsule lives at a pane's LEFT edge, so the menu opens
     rightward INTO that pane instead of reaching back over its neighbour. */
  const { anchorRef, placed } = useAnchoredMenu<HTMLButtonElement>(open, 'bottom', MENU_W, 'start');
  const menuRef = useRef<HTMLDivElement | null>(null);
  /*
    The menu covers the pane's own controls, and without a trap Tab walked
    straight out of it onto them: a keyboard reader kept tabbing into things
    they could not see, hidden behind the panel they were reading. Measured on
    the Terrain desk, Tab from the search box reached desk controls underneath
    the open menu within a few dozen stops.

    `CompareControl` — the other menu on this toolbar — already does exactly
    this. This one was the odd one out, so it uses the same hook rather than a
    second mechanism: the trap also hands focus back to the trigger on close,
    which is the half a reader notices when it is missing.
  */
  useFocusTrap(open, menuRef);

  // Outside click / Escape closes the picker
  useEffect(() => {
    if (!open) return;
    /* pointerdown, not mousedown: a Radix trigger's pointerdown prevents its
       default, which cancels the compatibility mousedown — a mousedown listener
       never heard the click that opened the other menu (2026-09-06). */
    const onDown = (e: PointerEvent) => {
      /* The menu is PORTALLED to the body, so it is not inside rootRef any
         more — without the menuRef clause every click on the menu counted as
         an outside click and closed it before it could act. */
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    /* CAPTURE, and it stops the key going any further.

       Escape is not owned by one component: the desk behind this menu closes
       an expanded pane on the same key, and both listeners are on `window`.
       Bubble-phase, both fire — measured: one Escape with this open inside an
       expanded pane closed the menu AND collapsed the pane. Window-capture
       runs before window-bubble, so the innermost thing open gets the key and
       nothing else sees it. Same pattern as the date picker. */
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
  }, [open]);

  const pick = (sym: string) => {
    setOpen(false);
    if (sym && sym !== ticker) onPick(sym);
  };

  return (
    <div ref={rootRef} className="relative">
      {/* TradingView's symbol button (Noah, 2026-08-23): the name wears a
          capsule a shade grayer than the bar it sits on — the one control
          on the taskbar with its own surface, because it IS the subject.
          TV-sized: ~112×28, name leading, the affordance at the far end. */}
      <button
        ref={anchorRef}
        onClick={() => setOpen(!open)}
        title={title}
        className={
          slim
            ? 'inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[10px] font-semibold text-textPrimary hover:bg-ink/[0.04] transition-colors'
            : 'inline-flex items-center justify-between gap-2 h-7 min-w-[112px] px-3 rounded-full bg-ink/[0.06] hover:bg-ink/[0.10] font-mono text-[11px] font-bold text-textPrimary transition-colors'
        }
      >
        {label ?? ticker}
        <ChevronDown className={`w-3 h-3 text-textSecondary transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && placed && createPortal(
        <div
          ref={menuRef}
          role="dialog"
          aria-label={`Change symbol — currently ${ticker}`}
          style={{ position: 'fixed', ...placed.box }}
          className="z-[120] w-72 border border-borderMuted bg-panel/80 backdrop-blur-xl backdrop-saturate-150 rounded-md shadow-2xl shadow-black/60 overflow-x-hidden overflow-y-auto overscroll-contain animate-slide-in"
        >
          <TickerLookup active={ticker} onPick={pick} />
        </div>,
        document.body
      )}
    </div>
  );
};

export default TickerQuickPick;
