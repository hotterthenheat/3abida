import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useFocusTrap from '../ui/useFocusTrap';
import { Activity, ArrowRightLeft, CornerDownLeft, Crosshair, Users } from 'lucide-react';
import { NAV_ITEMS } from './nav';
import { GEX_SUBPAGES } from '../../pages/pinpoint/subnav';
import { TRACE_SUBPAGES } from '../../pages/trace/subnav';
import { COMMUNITY_SUBPAGES } from '../../pages/community/subnav';
import { RECORD_SUBPAGES } from '../../pages/record/subnav';
import { useMarketData } from '../../context/MarketDataContext';
import Simulator from '../../core/simulator';

type TickerModule = typeof import('../../data/tickers');

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

interface PaletteAction {
  id: string;
  group: 'Navigate' | 'Ticker';
  label: string;
  hint: string;
  run: () => void;
  icon?: React.ReactNode;
}

/* One id for the list and its rows — the field points at both. */
const LIST_ID = 'palette-matches';

const CommandPalette = ({ open, onClose }: CommandPaletteProps) => {
  const navigate = useNavigate();
  const { changeTicker, activeTicker } = useMarketData();
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const [tickMod, setTickMod] = useState<TickerModule | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(open, cardRef);

  // The full ticker universe (S&P 500 + NASDAQ listings) — lazy, its chunk is
  // ~300KB and ⌘K is the desk's only terminal-ticker control (Noah,
  // 2026-08-18: four names was the whole reachable market).
  useEffect(() => {
    if (open && !tickMod) import('../../data/tickers').then(setTickMod);
  }, [open, tickMod]);

  const actions = useMemo<PaletteAction[]>(() => {
    const nav: PaletteAction[] = NAV_ITEMS.map(item => ({
      id: `nav-${item.path}`,
      group: 'Navigate',
      label: item.label,
      hint: item.description,
      icon: <item.icon className="w-3.5 h-3.5" />,
      run: () => navigate(item.path),
    }));
    const gexSubs: PaletteAction[] = GEX_SUBPAGES.map(page => ({
      id: `nav-${page.path}`,
      group: 'Navigate',
      label: `Pinpoint → ${page.label}`,
      hint: page.subtitle,
      icon: <Crosshair className="w-3.5 h-3.5" />,
      run: () => navigate(page.path),
    }));
    const flowSubs: PaletteAction[] = TRACE_SUBPAGES.map(page => ({
      id: `nav-${page.path}`,
      group: 'Navigate',
      label: `Trace → ${page.label}`,
      hint: page.subtitle,
      icon: <Activity className="w-3.5 h-3.5" />,
      run: () => navigate(page.path),
    }));
    const communitySubs: PaletteAction[] = COMMUNITY_SUBPAGES.map(page => ({
      id: `nav-${page.path}`,
      group: 'Navigate',
      label: `Community → ${page.label}`,
      hint: page.subtitle,
      icon: <Users className="w-3.5 h-3.5" />,
      run: () => navigate(page.path),
    }));
    const recordSubs: PaletteAction[] = RECORD_SUBPAGES.map(page => ({
      id: `nav-${page.path}`,
      group: 'Navigate',
      label: `Record → ${page.label}`,
      hint: page.subtitle,
      icon: <page.icon className="w-3.5 h-3.5" />,
      run: () => navigate(page.path),
    }));
    return [...nav, ...gexSubs, ...recordSubs, ...flowSubs, ...communitySubs];
  }, [navigate]);

  // Ticker actions live outside the label filter: with a query they ARE the
  // search (symbol/name matched by searchTickers), resting they list the
  // names the sim already runs.
  const tickerActions = useMemo<PaletteAction[]>(() => {
    const q = query.trim();
    if (q && tickMod) {
      return tickMod.searchTickers(q, 8).map(t => ({
        id: `ticker-${t.symbol}`,
        group: 'Ticker' as const,
        label: `Set ticker → ${t.symbol}`,
        hint: t.symbol === activeTicker ? 'active' : t.name === t.symbol ? 'switch simulation feed' : t.name,
        icon: <ArrowRightLeft className="w-3.5 h-3.5" />,
        run: () => changeTicker(t.symbol),
      }));
    }
    return Object.keys(Simulator.TICKERS).map(tk => ({
      id: `ticker-${tk}`,
      group: 'Ticker' as const,
      label: `Set ticker → ${tk}`,
      hint: tk === activeTicker ? 'active' : 'switch simulation feed',
      icon: <ArrowRightLeft className="w-3.5 h-3.5" />,
      run: () => changeTicker(tk),
    }));
  }, [query, tickMod, changeTicker, activeTicker]);

  /* A MATCH ON THE NAME BEATS A MATCH ON THE BLURB. Unranked, the catalog's
     own order decided, and every page's one-line hint is fair game: typing
     "weigh" put COMPASS first, because its hint reads "weeklies, swings and
     LEAPS weighed and graded", and Enter — the thing a reader does straight
     after typing a page's name — took them to the wrong desk. Name first,
     then a name that contains it, then the blurb; ties keep catalog order. */
  const score = (a: PaletteAction, q: string): number => {
    const label = a.label.toLowerCase();
    if (label === q) return 0;
    if (label.startsWith(q)) return 1;
    if (label.includes(q)) return 2;
    return 3;
  };
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [...actions, ...tickerActions];
    const hits = actions
      .map((a, i) => ({ a, i, s: score(a, q) }))
      .filter(({ a, s }) => s < 3 || a.hint.toLowerCase().includes(q))
      .sort((x, y) => x.s - y.s || x.i - y.i)
      .map(({ a }) => a);
    return [...hits, ...tickerActions];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions, tickerActions, query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setHighlight(0);
      // Focus after the overlay paints
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    setHighlight(0);
  }, [query]);

  if (!open) return null;

  const runAction = (action: PaletteAction | undefined) => {
    if (!action) return;
    action.run();
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight(h => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      runAction(filtered[highlight]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  let lastGroup: string | null = null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[18vh] px-4" onKeyDown={onKeyDown}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} />
      {/* THE PALETTE IS A DIALOG AND HAD NEVER SAID SO. It is the terminal's
          keyboard-first surface, and it was the one modal in the app without
          a role, without aria-modal and without a focus trap — so a screen
          reader announced nothing and Tab walked straight out of it into the
          page behind. Modal.tsx has carried all three since it was written;
          this now borrows the same trap rather than growing a second one. */}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        data-command-palette
        className="relative w-full max-w-lg border border-borderMuted bg-panel rounded-lg shadow-2xl shadow-black overflow-hidden animate-slide-in"
      >
        {/* A COMBOBOX, WHICH IS WHAT IT HAS ALWAYS BEHAVED LIKE. Focus never
            leaves the field — the arrows move a highlight through a list the
            field owns — and that is exactly the pattern a screen reader
            cannot follow without being told: it announced the typing and
            nothing else, so a reader pressing Down four times and Enter was
            navigating the terminal blind. `aria-activedescendant` names the
            row the highlight is on, and each row is an option that says
            whether it is the selected one. Same wiring gex/CompareControl
            already uses; a placeholder is not a label, so the field has one. */}
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Type a command or destination…"
          role="combobox"
          aria-label="Command or destination"
          aria-expanded
          aria-autocomplete="list"
          aria-controls={LIST_ID}
          aria-activedescendant={filtered[highlight] ? `${LIST_ID}-opt-${highlight}` : undefined}
          className="w-full bg-transparent px-4 py-3 text-sm text-textPrimary placeholder:text-textMuted focus:outline-none border-b border-borderSubtle"
        />
        <div id={LIST_ID} role="listbox" aria-label="Matches" className="max-h-72 overflow-y-auto py-1.5">
          {filtered.length === 0 && (
            <div className="px-4 py-6 text-center font-mono text-[11px] text-textMuted">No matches</div>
          )}
          {filtered.map((action, i) => {
            const showGroup = action.group !== lastGroup;
            lastGroup = action.group;
            return (
              /* `presentation` on the wrapper and the heading: a listbox's
                 children have to be options, and a stray div between them
                 makes the count a reader hears wrong. */
              <div key={action.id} role="presentation">
                {showGroup && (
                  <div role="presentation" className="px-4 pt-2 pb-1 font-mono text-[10px] uppercase tracking-widest text-textMuted select-none">
                    {action.group}
                  </div>
                )}
                <button
                  id={`${LIST_ID}-opt-${i}`}
                  role="option"
                  aria-selected={i === highlight}
                  /* The field keeps the focus, so nothing in the list may
                     take it — a Tab that lands on row forty is a reader
                     lost inside a list they cannot see the top of. */
                  tabIndex={-1}
                  onClick={() => runAction(action)}
                  onMouseEnter={() => setHighlight(i)}
                  className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                    i === highlight ? 'bg-ink/[0.05]' : ''
                  }`}
                >
                  <span className={i === highlight ? 'text-select' : 'text-textMuted'}>{action.icon}</span>
                  <span className="text-[13px] text-textPrimary">{action.label}</span>
                  <span className="ml-auto text-[10px] font-mono text-textMuted truncate max-w-[45%]">{action.hint}</span>
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 px-4 py-2 border-t border-borderSubtle font-mono text-[10px] text-textMuted select-none">
          <span>↑↓ navigate</span>
          <span className="flex items-center gap-1">
            <CornerDownLeft className="w-3 h-3" /> select
          </span>
          <span className="ml-auto">esc close</span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
