/*
==================================================
  SLAYER TERMINAL - DROPDOWN SEARCH
  (components/ui/DropdownSearch.tsx)

  A DropdownSelect whose list is long enough to
  need a search (Noah, 2026-09-11, the Compass
  board's Name card: "should be a searchable thing
  not a scroll down until you see the stock your
  looking for"). The trigger wears the same clothes
  as every card on the line; the card opens with
  the search box first, then the matches — a logo
  where the option is a name, the current one in
  the silver where-you-are ink, the arrow keys and
  Enter pick.

  Built on Radix Popover, not DropdownMenu: a menu
  owns the keyboard for its typeahead and would eat
  the letters typed into the box.
==================================================
*/

import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { ChevronDown, Search, type LucideIcon } from 'lucide-react';
import CompanyLogo from './CompanyLogo';
import { CARD } from './DropdownSelect';
import { MENU_EMPTY } from './menuRoom';

const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */

export interface SearchOption<T extends string> {
  value: T;
  label: string;
  /** One line under the label — what picking this means */
  hint?: string;
  /** A name's logo beside it */
  logo?: string;
  /** More words the search should match (the company behind a ticker) */
  keywords?: string;
}

interface DropdownSearchProps<T extends string> {
  label: string;
  value: T;
  options: SearchOption<T>[];
  onChange: (v: T) => void;
  /** A heading inside the card; defaults to the label */
  title?: string;
  placeholder?: string;
  /** A glyph before the label, in the muted ink */
  icon?: LucideIcon;
  /** The glyph's own colour on hover and while open (the sidebar's rule) */
  ink?: string;
  align?: 'start' | 'end';
  testId?: string;
}

const DropdownSearch = <T extends string>({ label, value, options, onChange, title, placeholder = 'Search…', icon: Icon, ink, align = 'start', testId }: DropdownSearchProps<T>) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const current = options.find(o => o.value === value);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o => o.label.toLowerCase().includes(q) || (o.keywords ?? '').toLowerCase().includes(q) || (o.hint ?? '').toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    setHighlight(0);
    listRef.current?.scrollTo({ top: 0 });
  }, [query]);
  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const pick = (v: T) => {
    onChange(v);
    setOpen(false);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight(h => Math.min(h + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const hit = matches[highlight];
      if (hit) pick(hit.value);
    }
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen} modal={false}>
      <Popover.Trigger asChild>
        <button
          type="button"
          data-dropdown={testId ?? label}
          data-dropdown-search
          aria-label={`${label}: ${current?.label ?? ''}`}
          className="group inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-borderSubtle bg-chip hover:border-borderMuted data-[state=open]:border-silver/50 transition-colors font-mono select-none"
          style={ink ? ({ '--ink': ink } as CSSProperties) : undefined}
        >
          {Icon && (
            <Icon
              className={`w-3 h-3 shrink-0 transition-colors duration-200 ${ink ? 'text-textMuted group-hover:text-[color:var(--ink)] group-data-[state=open]:text-[color:var(--ink)]' : 'text-textMuted'}`}
              aria-hidden="true"
              data-dropdown-icon
            />
          )}
          <span className="text-[9px] uppercase tracking-widest text-textMuted">{label}</span>
          <span className="text-[11px] font-semibold text-textPrimary">{current?.label ?? '—'}</span>
          <ChevronDown className="w-3 h-3 text-textMuted" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align={align} sideOffset={6} className={`${CARD} w-[272px] p-0 overflow-hidden`} data-dropdown-card={testId ?? label} onOpenAutoFocus={e => { e.preventDefault(); inputRef.current?.focus(); }}>
          <div className="px-3.5 pt-2.5 pb-1 font-mono text-[9px] uppercase tracking-widest text-textMuted">{title ?? label}</div>
          <div className="mx-1.5 flex items-center gap-1.5 px-2 rounded-md border border-borderSubtle bg-panel" onKeyDown={onKeyDown}>
            <Search className="w-3 h-3 text-textMuted shrink-0" aria-hidden="true" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={placeholder}
              className="w-full bg-transparent py-1.5 font-mono text-[11px] text-textPrimary placeholder:text-textMuted focus:outline-none"
              data-dropdown-search-input
            />
          </div>
          <div ref={listRef} className="max-h-64 overflow-y-auto p-1.5" role="listbox">
            {matches.length === 0 ? (
              <div className={MENU_EMPTY}>Nothing on the board matches</div>
            ) : (
              matches.map((o, i) => {
                const on = o.value === value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    role="option"
                    aria-selected={on}
                    onClick={() => pick(o.value)}
                    onMouseEnter={() => setHighlight(i)}
                    data-search-option={o.value}
                    className={`w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${i === highlight ? 'bg-ink/[0.06]' : ''}`}
                  >
                    {o.logo ? <CompanyLogo ticker={o.logo} size={14} /> : <span className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
                    <span className="flex flex-col gap-[1px] min-w-0">
                      <span className={`font-mono text-[11px] leading-snug ${on ? 'font-semibold' : ''}`} style={on ? { color: SILVER } : undefined}>
                        {o.label}
                      </span>
                      {o.hint && <span className="font-mono text-[9px] leading-snug text-textMuted truncate">{o.hint}</span>}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};

export default DropdownSearch;
