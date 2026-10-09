/*
==================================================
  SLAYER TERMINAL - PAPER · WHAT IS ON THE CHART
  (components/paper/TickerPicker.tsx)

  The Live Chart's ticker selection (Noah, 2026-09-22, with
  a picture of the partner's: "this is more organized the
  only thing he is missing is the ability to search
  yourself so add that and make that our new ticker
  selection for the paper live chart only").

  WHAT IS OFFERED IS A NAME WHOSE OPTIONS PAPER TRADES
  (2026-09-30: "make it strictly Options trading" — the
  futures that led the partner's list are gone from it,
  and from Paper). THE INDEX OPTIONS first — SPX, NDX and
  RUT, each with where it stands (made from their funds,
  data/paper/products.ts) — then the stocks and funds
  with their names. OURS ON TOP OF IT: ONE search box
  over all of it — a ticker, a company, an index's name
  ("nasdaq" finds NDX and QQQ) — the arrow keys walking
  the matches and Enter picking, the one on the chart in
  the silver that means where you are. A practice
  account and an evaluation are offered the same list:
  both trade options. A stock's price is not shown:
  asking for one starts the simulator on that name.
==================================================
*/

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { ChevronDown, Search } from 'lucide-react';
import CompanyLogo from '../ui/CompanyLogo';
import { CARD } from '../ui/DropdownSelect';
import type { PaperIndex } from '../../data/paper/products';
import { REVIEW_NAMES } from '../../data/review/tape';

const SILVER = 'rgb(var(--silver))';

interface Row {
  value: string;
  /** What the row is called — the index's or the stock's ticker */
  code: string;
  name: string;
  /** What else a search finds it by */
  keywords: string;
  price: number | null;
  decimals: number;
}

interface Props {
  /** The name on the chart: an index's or a stock's ticker — whose options the desk trades */
  value: string;
  onChange: (name: string) => void;
  /** The indexes whose options the feed carries, and where one stands now */
  indexes: PaperIndex[];
  indexPrice: (symbol: string) => number;
}

const TickerPicker = ({ value, onChange, indexes, indexPrice }: Props) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const indexRows: Row[] = indexes.map(x => ({ value: x.symbol, code: x.symbol, name: `${x.name} options`, keywords: `${x.symbol} ${x.name} index options ${x.fund}`, price: open ? indexPrice(x.symbol) : null, decimals: 2 }));
  const stocks: Row[] = useMemo(() => REVIEW_NAMES.map(n => ({ value: n.ticker, code: n.ticker, name: n.name, keywords: n.ticker, price: null, decimals: 2 })), []);
  const q = query.trim().toLowerCase();
  const hit = (r: Row) => !q || r.code.toLowerCase().includes(q) || r.value.toLowerCase().includes(q) || r.name.toLowerCase().includes(q) || r.keywords.toLowerCase().includes(q);
  const groups = [
    { key: 'indexes', title: 'Index options · the chain', rows: indexRows.filter(hit) },
    { key: 'stocks', title: 'Stocks & funds · their options', rows: stocks.filter(hit) },
  ];
  /** Every match in the order the card shows them — what the arrow keys walk */
  const flat = groups.flatMap(g => g.rows);
  const current = [...indexRows, ...stocks].find(r => r.value === value);

  useEffect(() => {
    setHighlight(0);
    listRef.current?.scrollTo({ top: 0 });
  }, [query]);
  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);
  /* the highlighted row stays in sight while the keys walk */
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-ticker-row-index="${highlight}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [highlight]);

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight(h => Math.min(h + 1, flat.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const r = flat[highlight];
      if (r) pick(r.value);
    }
  };

  let index = -1;
  return (
    <Popover.Root open={open} onOpenChange={setOpen} modal={false}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={`What is on the chart: ${current?.code ?? value} — ${current?.name ?? ''}`}
          title={current ? `${current.code} · ${current.name}` : value}
          className="group inline-flex items-center gap-1.5 h-7 pl-1.5 pr-2 rounded-md border border-borderSubtle bg-chip hover:border-borderMuted data-[state=open]:border-silver/50 transition-colors font-mono select-none"
          data-paper-ticker={value}
        >
          <CompanyLogo ticker={value} size={14} />
          <span className="text-[12px] font-bold text-textPrimary">{current?.code ?? value}</span>
          <ChevronDown className="w-3 h-3 text-textMuted transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className={`${CARD} w-[380px] p-0 overflow-hidden`}
          onOpenAutoFocus={e => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
          data-paper-ticker-card
        >
          <div className="p-2 border-b border-borderSubtle/70" onKeyDown={onKeyDown}>
            <div className="flex items-center gap-2 h-8 px-2.5 rounded-md border border-borderSubtle bg-panel focus-within:border-silver/50 transition-colors">
              <Search className="w-3.5 h-3.5 text-textMuted shrink-0" aria-hidden="true" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search a ticker, a company or an index…"
                aria-label="Search what to put on the chart"
                className="w-full bg-transparent font-mono text-[12px] text-textPrimary placeholder:text-textMuted focus:outline-none"
                data-paper-ticker-search
              />
            </div>
          </div>
          <div ref={listRef} className="max-h-[420px] overflow-y-auto overscroll-contain py-1.5" role="listbox" aria-label="What to put on the chart">
            {flat.length === 0 ? (
              <div className="px-4 py-6 text-center font-mono text-[10px] text-textMuted" data-paper-ticker-none>
                Nothing matches — try a ticker, a company or an index
              </div>
            ) : (
              groups.map(g =>
                g.rows.length === 0 ? null : (
                  <div key={g.key} className="pb-1" data-paper-ticker-group={g.key}>
                    <div className="px-4 pt-2 pb-1 font-mono text-[10px] uppercase tracking-widest text-textMuted">{g.title}</div>
                    {(
                      g.rows.map(r => {
                        index += 1;
                        const i = index;
                        const on = r.value === value;
                        return (
                          <button
                            key={r.value}
                            type="button"
                            role="option"
                            aria-selected={on}
                            onClick={() => pick(r.value)}
                            onMouseEnter={() => setHighlight(i)}
                            className={`w-[calc(100%-12px)] mx-1.5 grid grid-cols-[18px_62px_minmax(0,1fr)_auto] items-center gap-2 px-2.5 py-1.5 rounded-md text-left transition-colors ${i === highlight ? 'bg-ink/[0.06]' : ''}`}
                            data-ticker-row={r.value}
                            data-ticker-row-index={i}
                          >
                            <CompanyLogo ticker={r.value} size={14} />
                            <span className={`font-mono text-[12px] font-bold ${on ? '' : 'text-textPrimary'}`} style={on ? { color: SILVER } : undefined}>
                              {r.code}
                            </span>
                            <span className="text-[11px] text-textSecondary truncate">{r.name}</span>
                            <span className="font-mono text-[11px] tnum text-textPrimary">{r.price != null ? r.price.toLocaleString('en-US', { minimumFractionDigits: r.decimals, maximumFractionDigits: r.decimals }) : ''}</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                )
              )
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};

export default TickerPicker;
