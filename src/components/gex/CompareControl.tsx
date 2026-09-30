/*
==================================================
  SLAYER TERMINAL - COMPARE SYMBOLS
  TradingView's "+" next to the symbol capsule
  (Noah, 2026-08-23): opens a compact search over
  the full universe; HOVERING a symbol row reveals
  the three ways to lay it on the chart — Same %
  scale / New price scale / New pane. Added symbols
  list at the top with their line ink and an ✕.
==================================================
*/

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, X } from 'lucide-react';
import type { TickerListing } from '../../data/tickers';
import type { CompareEntry, CompareMode } from './StrikeChart';
import useFocusTrap from '../ui/useFocusTrap';

type TickerModule = typeof import('../../data/tickers');

const MODE_LABEL: Record<CompareMode, string> = {
  percent: 'Same % scale',
  scale: 'New price scale',
  pane: 'New pane',
};
const MODES = Object.keys(MODE_LABEL) as CompareMode[];

interface CompareControlProps {
  /** The chart's own name — excluded from the list */
  current: string;
  compares: CompareEntry[];
  onAdd: (ticker: string, mode: CompareMode) => void;
  onRemove: (ticker: string, mode: CompareMode) => void;
  /** Roster cap — the + dims when reached */
  max?: number;
  /* OPTIONALLY CONTROLLED — see TickerQuickPick for the same shim and why. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const CompareControl = ({
  current, compares, onAdd, onRemove, max = 4, open: openProp, onOpenChange,
}: CompareControlProps) => {
  const [selfOpen, setSelfOpen] = useState(false);
  const open = openProp ?? selfOpen;
  const setOpen = (next: boolean) => {
    onOpenChange?.(next);
    if (openProp === undefined) setSelfOpen(next);
  };
  const [query, setQuery] = useState('');
  const [mod, setMod] = useState<TickerModule | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const full = compares.length >= max;

  /*
    IT IS A COMBOBOX, WITH ONE TAB STOP.

    Adding a comparison was flatly impossible from a keyboard. Measured on the
    running build: the three scale buttons compute `display: none` on every row
    with a real desktop pointer, so they cannot be reached; there was no Enter
    handler in this file at all, so typing QQQ and pressing Enter added
    nothing; and the first Tab out of the search box landed on a control BEHIND
    the still-open menu. On a coarse pointer the same markup went the other way
    — the buttons show, and the menu became 28 tab stops named from three
    repeated strings.

    So the row is chosen with Up/Down and the way it joins the chart with
    Left/Right, both driven from the search box. Focus never leaves the input,
    because it has to keep filtering while you steer. The scale buttons stay
    exactly as they are for the pointer, and are taken out of the tab order
    rather than out of the DOM — which leaves the touch path untouched.
  */
  const [highlight, setHighlight] = useState(0);
  const [modeIdx, setModeIdx] = useState(0);
  const uid = useId();

  // Outside click / Escape closes — the TickerQuickPick contract
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
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

  useEffect(() => {
    if (!open) return;
    import('../../data/tickers').then(setMod);
    requestAnimationFrame(() => inputRef.current?.focus());
    setHighlight(0);
    setModeIdx(0);
  }, [open]);

  /* A new search is a new list — keeping the old index would leave the
     highlight on whatever row happens to sit at that position now. */
  useEffect(() => setHighlight(0), [query]);

  /* One focusable inside, so the trap pins Tab to the search box rather than
     letting it land on a control hidden behind this menu — and hands focus
     back to the + button on the way out, which did not happen before. */
  useFocusTrap(open, menuRef);

  const taken = useMemo(() => new Set(compares.map(c => c.ticker)), [compares]);
  const results: TickerListing[] = useMemo(
    () => (mod ? mod.searchTickers(query, 24).filter(t => t.symbol !== current && !taken.has(t.symbol)) : []),
    [mod, query, current, taken]
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = Math.max(0, Math.min(results.length - 1, highlight + (e.key === 'ArrowDown' ? 1 : -1)));
      setHighlight(next);
      rowRefs.current[next]?.scrollIntoView({ block: 'nearest' });
      return;
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      setModeIdx(cur => Math.max(0, Math.min(MODES.length - 1, cur + (e.key === 'ArrowRight' ? 1 : -1))));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const pick = results[highlight];
      if (!full && pick) add(pick.symbol, MODES[modeIdx]);
    }
  };

  const add = (symbol: string, mode: CompareMode) => {
    onAdd(symbol.trim().toUpperCase(), mode);
    setQuery('');
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        title={full ? `Compare (${max} max — remove one first)` : 'Compare symbol'}
        aria-label="Compare symbol"
        className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-ink/[0.06] hover:bg-ink/[0.10] text-textSecondary hover:text-textPrimary transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div
          ref={menuRef}
          tabIndex={-1}
          className="absolute left-0 top-full mt-1 z-40 w-[380px] border border-borderMuted bg-panel rounded-md shadow-2xl shadow-black/60 overflow-hidden animate-slide-in"
        >
          <div className="flex items-center gap-1.5 px-2 border-b border-borderSubtle">
            <Search className="w-3 h-3 text-textMuted shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              role="combobox"
              aria-expanded
              aria-controls={`${uid}-list`}
              aria-autocomplete="list"
              aria-activedescendant={results[highlight] ? `${uid}-opt-${highlight}` : undefined}
              placeholder="Compare symbols…"
              title="Up and down to choose a symbol, left and right for the scale, Enter to add"
              className="w-full bg-transparent py-1.5 font-mono text-[11px] text-textPrimary placeholder:text-textMuted focus:outline-none"
            />
          </div>

          {compares.length > 0 && (
            <div className="border-b border-borderSubtle/60 py-1">
              <div className="px-2.5 pt-1 pb-0.5 font-mono text-[9px] uppercase tracking-wider text-textMuted">
                Added symbols
              </div>
              {compares.map(c => (
                <div key={`${c.ticker}:${c.mode}`} className="flex items-center gap-2 px-2.5 py-1">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.ink }} aria-hidden />
                  <span className="font-mono text-[11px] font-semibold text-textPrimary w-14 shrink-0">{c.ticker}</span>
                  <span className="font-mono text-[10px] text-textMuted">{MODE_LABEL[c.mode]}</span>
                  <button
                    onClick={() => onRemove(c.ticker, c.mode)}
                    aria-label={`Remove ${c.ticker} comparison`}
                    title="Remove comparison"
                    className="ml-auto inline-flex items-center justify-center w-5 h-5 rounded text-textMuted hover:text-textPrimary hover:bg-ink/[0.06] transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* tabIndex is not decorative: Chrome makes an overflowing scroll
              container focusable, which showed up as an unnamed tab stop. */}
          <div id={`${uid}-list`} role="listbox" tabIndex={-1} aria-label="Symbols to compare" className="max-h-64 overflow-y-auto py-1">
            {!mod ? (
              <div className="px-2.5 py-4 text-center font-mono text-[10px] text-textMuted">Loading tickers…</div>
            ) : results.length === 0 ? (
              <div className="px-2.5 py-4 text-center font-mono text-[10px] text-textMuted">No matches</div>
            ) : (
              results.map((t, i) => (
                <div
                  key={t.symbol}
                  id={`${uid}-opt-${i}`}
                  role="option"
                  aria-selected={i === highlight}
                  ref={el => { rowRefs.current[i] = el; }}
                  onMouseEnter={() => setHighlight(i)}
                  className={`group relative flex items-center gap-2 px-2.5 py-1.5 hover:bg-ink/[0.04] transition-colors ${
                    i === highlight ? 'bg-ink/[0.05]' : ''
                  }`}
                >
                  <span className="font-mono text-[11px] font-semibold text-textPrimary w-14 shrink-0">{t.symbol}</span>
                  <span className="text-[10px] text-textSecondary truncate">{t.name === t.symbol ? '' : t.name}</span>
                  {/* The TV move: the row's right side becomes the three
                      scale choices on hover — how the line joins the chart */}
                  {!full && (
                    <span
                      className={`touch-reveal absolute right-1.5 top-1/2 -translate-y-1/2 items-center gap-1 bg-panel pl-1.5 ${
                        i === highlight ? 'flex' : 'hidden group-hover:flex'
                      }`}
                    >
                      {MODES.map((mode, mi) => {
                        const ringed = i === highlight && mi === modeIdx;
                        return (
                          <button
                            key={mode}
                            /* Out of the TAB ORDER, not out of the DOM: the
                               pointer and touch paths are unchanged, and a
                               keyboard user steers these from the search box
                               instead of walking three of them per row. */
                            tabIndex={-1}
                            onClick={() => add(t.symbol, mode)}
                            /* The ring FOLLOWS the pointer (Noah, 2026-08-26:
                               "hard set on the first choice but it should be
                               on whichever one is hovered") — hover moves the
                               same modeIdx the arrow keys steer, so mouse and
                               keyboard share one visible state and Enter
                               always adds exactly what the ring marks. */
                            onMouseEnter={() => setModeIdx(mi)}
                            aria-label={`Add ${t.symbol} — ${MODE_LABEL[mode]}`}
                            className={`relative px-1.5 py-0.5 rounded border bg-inset font-mono text-[9px] whitespace-nowrap transition-colors duration-150 ${
                              ringed
                                ? 'border-transparent text-textPrimary'
                                : 'border-borderSubtle text-textSecondary hover:text-textPrimary'
                            }`}
                          >
                            {/* One shared ring that GLIDES between the chips —
                                the FilterTabs pill grammar via layoutId. */}
                            {ringed && (
                              <motion.span
                                layoutId={`${uid}-mode-ring`}
                                className="absolute -inset-px rounded border border-select pointer-events-none"
                                transition={{ type: 'spring', bounce: 0.18, duration: 0.28 }}
                                aria-hidden
                              />
                            )}
                            {MODE_LABEL[mode]}
                          </button>
                        );
                      })}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CompareControl;
