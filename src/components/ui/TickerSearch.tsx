import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import type { TickerListing } from '../../data/tickers';
import CompanyLogo from './CompanyLogo';

type TickerModule = typeof import('../../data/tickers');

interface TickerSearchProps {
  value: string;
  onChange: (symbol: string) => void;
}

/** Compact searchable ticker menu — filters the full NASDAQ universe (lazy-loaded). */
const TickerSearch = ({ value, onChange }: TickerSearchProps) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const [mod, setMod] = useState<TickerModule | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const results: TickerListing[] = useMemo(
    () => (mod ? mod.searchTickers(query, 60) : []),
    [mod, query]
  );

  useEffect(() => {
    if (open) {
      setQuery('');
      setHighlight(0);
      if (!mod) import('../../data/tickers').then(setMod);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open, mod]);

  useEffect(() => setHighlight(0), [query]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  const pick = (symbol: string) => {
    onChange(symbol);
    setOpen(false);
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
      if (results[highlight]) pick(results[highlight].symbol);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 border border-borderSubtle hover:border-borderMuted bg-panel rounded-md pl-2.5 pr-2 py-1.5 font-mono text-xs transition-colors min-w-[104px]"
      >
        <Search className="w-3.5 h-3.5 text-textMuted" />
        <CompanyLogo ticker={value} size={14} />
        <span className="font-semibold text-textPrimary">{value}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-textMuted ml-auto transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 z-40 w-72 border border-borderMuted bg-panel rounded-lg shadow-2xl shadow-black overflow-hidden animate-slide-in"
          onKeyDown={onKeyDown}
        >
          <div className="flex items-center gap-2 px-3 border-b border-borderSubtle">
            <Search className="w-3.5 h-3.5 text-textMuted" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search all tickers…"
              className="w-full bg-transparent py-2.5 text-sm text-textPrimary placeholder:text-textMuted focus:outline-none"
            />
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {!mod ? (
              <div className="px-3 py-6 text-center font-mono text-[11px] text-textMuted">Loading tickers…</div>
            ) : results.length === 0 ? (
              <div className="px-3 py-6 text-center font-mono text-[11px] text-textMuted">No matches</div>
            ) : (
              results.map((t, i) => (
                <button
                  key={t.symbol}
                  onClick={() => pick(t.symbol)}
                  onMouseEnter={() => setHighlight(i)}
                  className={`w-full flex items-center gap-3 px-3 py-1.5 text-left transition-colors ${
                    i === highlight ? 'bg-ink/[0.05]' : ''
                  }`}
                >
                  <CompanyLogo ticker={t.symbol} size={16} />
                  <span
                    className={`font-mono text-xs font-semibold w-14 shrink-0 ${
                      t.symbol === value ? 'text-silver' : 'text-textPrimary'
                    }`}
                  >
                    {t.symbol}
                  </span>
                  <span className="text-[11px] text-textSecondary truncate">{t.name}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TickerSearch;
