/*
==================================================
  SLAYER TERMINAL - TICKER LOOKUP
  The compact search body embedded inside picker
  menus (TickerQuickPick, WidgetTickerPicker).
  Filters the full bundled universe — NASDAQ json +
  the NYSE half of the S&P 500 — lazy-loaded so the
  ~300KB listing chunk never rides the first paint.
  A symbol with no listing still picks on Enter:
  the sim synthesizes unknown names.
==================================================
*/

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import type { TickerListing } from '../../data/tickers';

type TickerModule = typeof import('../../data/tickers');

interface TickerLookupProps {
  onPick: (symbol: string) => void;
  /** Currently active symbol — marked in the list */
  active?: string;
  /** Rows shown at once (list scrolls beyond it) */
  limit?: number;
}

const TickerLookup = ({ onPick, active, limit = 40 }: TickerLookupProps) => {
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const [mod, setMod] = useState<TickerModule | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    import('../../data/tickers').then(setMod);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const results: TickerListing[] = useMemo(() => (mod ? mod.searchTickers(query, limit) : []), [mod, query, limit]);

  useEffect(() => {
    setHighlight(0);
    listRef.current?.scrollTo({ top: 0 });
  }, [query]);

  const pick = (symbol: string) => {
    const sym = symbol.trim().toUpperCase();
    if (sym) onPick(sym);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight(h => Math.min(h + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // Top match wins; an unlisted symbol still goes through raw — the sim
      // synthesizes it, same contract as the old free-entry box.
      if (results[highlight]) pick(results[highlight].symbol);
      else pick(query.slice(0, 6));
    }
  };

  return (
    <div onKeyDown={onKeyDown}>
      <div className="flex items-center gap-1.5 px-2 border-b border-borderSubtle">
        <Search className="w-3 h-3 text-textMuted shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search S&P 500 + more…"
          className="w-full bg-transparent py-1.5 font-mono text-[11px] text-textPrimary placeholder:text-textMuted focus:outline-none"
        />
      </div>
      <div ref={listRef} className="max-h-56 overflow-y-auto py-1">
        {!mod ? (
          <div className="px-2.5 py-4 text-center font-mono text-[10px] text-textMuted">Loading tickers…</div>
        ) : results.length === 0 ? (
          <div className="px-2.5 py-4 text-center font-mono text-[10px] text-textMuted">
            No listing — Enter picks “{query.trim().toUpperCase().slice(0, 6)}”
          </div>
        ) : (
          results.map((t, i) => (
            <button
              key={t.symbol}
              onClick={() => pick(t.symbol)}
              onMouseEnter={() => setHighlight(i)}
              className={`w-full flex items-center gap-2 px-2.5 py-1 text-left transition-colors ${
                i === highlight ? 'bg-ink/[0.05]' : ''
              }`}
            >
              <span
                className={`font-mono text-[11px] font-semibold w-14 shrink-0 ${
                  t.symbol === active ? 'text-silver' : 'text-textPrimary'
                }`}
              >
                {t.symbol}
              </span>
              <span className="text-[10px] text-textSecondary truncate">{t.name === t.symbol ? '' : t.name}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
};

export default TickerLookup;
