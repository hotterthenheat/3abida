/*
==================================================
  SLAYER TERMINAL - FLOW SEARCH (trace)

  The ticker/contract search every flow page
  carries (promoted from the Live Tape, 2026-08-30).
  Suggestions grouped TICKERS / CONTRACTS, ranked
  by money, keyboard-walkable; rows shaped
  {ticker, strike, right, premium} — FlowPrint and
  BookContract both fit.

  TWO STEPS, NOT ONE (Noah, 2026-08-30: "when i
  click on the ticker it doesnt navigate me to the
  contracts section it just kicks me out. and the
  user should have the option to skip the specific
  strikes in general and only see all the tapes for
  the ticker"). Picking a ticker SCOPES the menu:
  the filter applies at once (every print on that
  name is already on screen behind the menu), and
  the list turns into that ticker's contracts with
  "everything on <ticker>" at the top and a way
  back. Picking a contract, or "everything", closes.
  Typing anything drops the scope — the reader is
  searching again.

  IN THE HOUSE'S CLOTHES (Noah, 2026-09-20, with a
  picture of the old menu: "i feel as though it doesnt
  match our new and improved ui design"). It was the
  one control on a Trace toolbar still drawn the old
  way — a square menu hung under the field, a "/" for
  a name and a bare C or P for a contract, the field
  itself a different box from the cards beside it.
  Now:
    · THE FIELD is one of the cards on its line (the
      same height, ground, hairline and hover as
      DropdownSelect's trigger); holding a filter it
      is ARMED — the silver edge and a breath of
      silver behind, as the Account's drop zone is —
      and it wears the picked name's logo where the
      glass was. (The old armed box was `.holo-border`,
      whose fill is a typed black: on paper it was a
      black field with black words.)
    · THE MENU is the house card (DropdownSelect's
      CARD, on Radix Popover — portalled, so a pane
      that clips no longer slices it, and it keeps to
      the window by itself): rounded rows on an inset,
      caps headings, one figure column that lines up.
    · A NAME TRAVELS WITH ITS LOGO; a name that opens
      into its contracts says so with a chevron.
    · A CONTRACT IS WRITTEN THE WAY THE TAPE UNDER IT
      WRITES IT — name, strike, then "call" or "put"
      in the side's ink — and because the row IS a
      direction it wears green or red under the
      pointer (DropdownSelect's `tone` rule).
    · THE FILTER IN FORCE is the silver row with the
      check: where you are.
    · Nothing matches → the card says so, instead of
      not opening.
==================================================
*/

import { useMemo, useRef, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { ArrowLeft, ArrowUpRight, Check, ChevronRight, Layers, Search, X } from 'lucide-react';
import { fmtUsd } from '../../data/gex';
import CompanyLogo from '../ui/CompanyLogo';
import { CARD } from '../ui/DropdownSelect';

/** The four facts a row must carry — FlowPrint and BookContract both do. */
export interface FlowSearchRow {
  ticker: string;
  strike: number;
  right: 'C' | 'P';
  premium: number;
}

export const normSymbol = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

type Suggestion =
  | { key: string; kind: 'ticker'; ticker: string; primary: string; count: string; money: string }
  | { key: string; kind: 'contract'; query: string; ticker: string; strike: string; primary: string; right: 'C' | 'P'; count: string; money: string }
  | { key: string; kind: 'all'; ticker: string; primary: string; count: string; money: string }
  | { key: string; kind: 'back'; primary: string }
  | { key: string; kind: 'door'; primary: string };

/* A row that IS a side of the market wears it under the pointer — DropdownSelect's rule (its `tone`), the same washes */
const WASH = { plain: 'bg-ink/[0.06]', C: 'bg-bull/[0.12]', P: 'bg-bear/[0.12]' } as const;
const HEADING = 'px-2 pt-1.5 pb-1 font-mono text-[9px] uppercase tracking-widest text-textMuted';

/** A DOOR at the foot of the menu (the 0DTE desk, 2026-09-03): the search
    can only offer what its page carries, so its last row sends the typed
    name — or "any other name" — to the page that does. */
export interface SearchDoor {
  /** The row's words, given what is typed (upper-cased, may be empty) */
  label: (query: string) => string;
  onOpen: (query: string) => void;
}

const FlowSearch = ({
  value,
  onChange,
  rows,
  countNoun = 'prints',
  tickersOnly = false,
  compact = false,
  door,
}: {
  value: string;
  onChange: (v: string) => void;
  rows: FlowSearchRow[];
  /** What a ticker's tally counts — "prints" on the tape, "contracts" on a book page. */
  countNoun?: string;
  /** NAMES ONLY (Net Flow, 2026-09-03: "a ticker search (not contracts)") —
      the page is a board of names, so the menu lists tickers alone and a
      pick applies and closes; there is no contract step to scope into. */
  tickersOnly?: boolean;
  /** A pane-head fit: a short field the height of a chip, for the 0DTE
      panes whose 32px strip already carries a cut, four chips and three
      figures. Measured: the full field pushed a 2×2 pane's head 170px past
      its edge at 1200px wide. */
  compact?: boolean;
  /** The menu's last row, a way out to the page that carries the rest. */
  door?: SearchDoor;
}) => {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  /** A picked ticker — the menu is showing that name's contracts. */
  const [scope, setScope] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const nq = normSymbol(value);
  const active = value.length > 0;

  const close = () => {
    setOpen(false);
    setScope(null);
  };

  const tallies = useMemo(() => {
    const tick = new Map<string, { count: number; prem: number }>();
    const con = new Map<string, { ticker: string; strike: number; count: number; prem: number; right: 'C' | 'P' }>();
    for (const r of rows) {
      const t = tick.get(r.ticker) ?? { count: 0, prem: 0 };
      t.count += 1;
      t.prem += r.premium;
      tick.set(r.ticker, t);
      const ck = `${r.ticker} ${r.strike}${r.right}`;
      const c = con.get(ck) ?? { ticker: r.ticker, strike: r.strike, count: 0, prem: 0, right: r.right };
      c.count += 1;
      c.prem += r.premium;
      con.set(ck, c);
    }
    return { tick, con };
  }, [rows]);

  const contractRow = ([ck, v]: [string, { ticker: string; strike: number; count: number; prem: number; right: 'C' | 'P' }]): Suggestion => ({
    key: `c-${ck}`,
    kind: 'contract',
    query: ck,
    ticker: v.ticker,
    strike: String(v.strike),
    primary: ck,
    right: v.right,
    // A lone appearance says just its money — "1×" was noise.
    count: v.count > 1 ? `${v.count}×` : '',
    money: fmtUsd(v.prem),
  });

  /* Scoped: the picked ticker's own contracts, "everything" on top, a way back. */
  const scoped = useMemo<Suggestion[]>(() => {
    if (!scope) return [];
    const t = tallies.tick.get(scope);
    const contracts = [...tallies.con.entries()]
      .filter(([, v]) => v.ticker === scope)
      .sort((a, b) => b[1].prem - a[1].prem)
      .slice(0, 8)
      .map(contractRow);
    return [
      { key: 'back', kind: 'back', primary: 'All names' },
      {
        key: `all-${scope}`,
        kind: 'all',
        ticker: scope,
        primary: `Everything on ${scope}`,
        count: t ? `${t.count} ${countNoun}` : '',
        money: t ? fmtUsd(t.prem) : '',
      },
      ...contracts,
    ];
  }, [scope, tallies, countNoun]);

  /* Unscoped: the query against every ticker and contract. */
  const { tickers, contracts } = useMemo(() => {
    const tickers: Suggestion[] = [...tallies.tick.entries()]
      .filter(([tk]) => nq === '' || normSymbol(tk).includes(nq))
      .sort((a, b) => b[1].prem - a[1].prem)
      .slice(0, tickersOnly ? 8 : nq === '' ? 5 : 4)
      .map(([tk, v]) => ({ key: `t-${tk}`, kind: 'ticker', ticker: tk, primary: tk, count: `${v.count} ${countNoun}`, money: fmtUsd(v.prem) }));
    const contracts: Suggestion[] = tickersOnly
      ? []
      : [...tallies.con.entries()]
          .filter(([ck]) => nq === '' || normSymbol(ck).includes(nq))
          .sort((a, b) => b[1].prem - a[1].prem)
          .slice(0, nq === '' ? 4 : 6)
          .map(contractRow);
    return { tickers, contracts };
  }, [tallies, nq, countNoun, tickersOnly]);

  const doorRow: Suggestion | null = door ? { key: 'door', kind: 'door', primary: door.label(value.trim()) } : null;
  const flat: Suggestion[] = scope ? scoped : [...tickers, ...contracts, ...(doorRow ? [doorRow] : [])];
  const clampedHi = Math.min(hi, Math.max(0, flat.length - 1));

  const pick = (s: Suggestion) => {
    switch (s.kind) {
      case 'door':
        door?.onOpen(value.trim());
        close();
        return;
      case 'ticker':
        if (tickersOnly) {
          onChange(s.ticker);
          close();
          return;
        }
        // Apply at once — the whole name is now on screen — and stay open
        // showing its contracts, so narrowing further is one more click.
        onChange(s.ticker);
        setScope(s.ticker);
        setHi(1);
        return;
      case 'all':
        onChange(s.ticker);
        close();
        return;
      case 'back':
        onChange('');
        setScope(null);
        setHi(0);
        return;
      case 'contract':
        onChange(s.query);
        close();
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) setOpen(true);
      else setHi(h => Math.min(h + 1, flat.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHi(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      if (open && flat[clampedHi]) {
        e.preventDefault();
        pick(flat[clampedHi]);
      }
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      // Tab walks on to the next control — the card does not stay open behind the reader
      close();
    }
  };

  /* THE FILTER IN FORCE — the row that is the field's own words is where you are */
  const inForce = (s: Suggestion): boolean => {
    if (!active || scope) return s.kind === 'all' && normSymbol(value) === normSymbol(s.ticker);
    if (s.kind === 'ticker') return normSymbol(s.ticker) === nq;
    if (s.kind === 'contract') return normSymbol(s.query) === nq;
    return false;
  };
  /* the name the field holds, when it holds one — its logo stands where the glass was */
  const heldName = useMemo(() => {
    const first = value.trim().split(' ')[0];
    return first && tallies.tick.has(first) ? first : null;
  }, [value, tallies]);

  const renderRow = (s: Suggestion, idx: number) => {
    const lit = idx === clampedHi;
    const on = inForce(s);
    const quiet = s.kind === 'back' || s.kind === 'door';
    return (
      <button
        key={s.key}
        type="button"
        role="option"
        aria-selected={lit}
        onMouseEnter={() => setHi(idx)}
        onMouseDown={e => {
          e.preventDefault(); // keep focus; select before the field blurs
          pick(s);
        }}
        className={`w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${lit ? WASH[s.kind === 'contract' ? s.right : 'plain'] : ''}`}
        data-flow-search-row={s.kind}
        data-lit={lit || undefined}
      >
        <span className="w-4 h-4 shrink-0 flex items-center justify-center" aria-hidden="true">
          {s.kind === 'back' ? (
            <ArrowLeft className="w-3 h-3 text-textMuted" />
          ) : s.kind === 'door' ? (
            <ArrowUpRight className="w-3 h-3 text-textMuted" />
          ) : s.kind === 'all' ? (
            <Layers className="w-3 h-3 text-textMuted" />
          ) : (
            <CompanyLogo ticker={s.ticker} size={16} />
          )}
        </span>
        {s.kind === 'contract' ? (
          /* written the way the tape under it writes a contract: the name, the strike, the side in its ink */
          <span className="min-w-0 truncate font-mono text-[11px] leading-snug">
            <span className={`font-semibold ${on ? 'text-silver' : 'text-textPrimary'}`}>
              {s.ticker} {s.strike}
            </span>{' '}
            <span className={s.right === 'C' ? 'text-bull' : 'text-bear'}>{s.right === 'C' ? 'call' : 'put'}</span>
          </span>
        ) : (
          <span className={`min-w-0 truncate font-mono text-[11px] leading-snug ${quiet ? 'text-textSecondary' : `font-semibold ${on ? 'text-silver' : 'text-textPrimary'}`}`}>{s.primary}</span>
        )}
        {!quiet && (
          <span className="ml-auto shrink-0 flex items-center gap-2 pl-2 font-mono tnum">
            {s.count && <span className="text-[9px] text-textMuted whitespace-nowrap">{s.count}</span>}
            {/* one column of money down the card — the figures line up whatever stands before them */}
            <span className={`w-[50px] text-right text-[11px] ${lit ? 'text-textPrimary' : 'text-textSecondary'}`}>{s.money}</span>
            <span className="w-3 h-3 flex items-center justify-center">
              {on ? <Check className="w-3 h-3 text-silver" /> : s.kind === 'ticker' && !tickersOnly ? <ChevronRight className="w-3 h-3 text-textMuted" /> : null}
            </span>
          </span>
        )}
      </button>
    );
  };

  const nothing = !scope && tickers.length + contracts.length === 0;
  const noneWords = value.trim() ? `Nothing on this page matches “${value.trim()}”` : 'Nothing on this page yet';
  return (
    <Popover.Root
      open={open}
      onOpenChange={o => {
        if (!o) close();
      }}
      modal={false}
    >
      <Popover.Anchor asChild>
        <div
          ref={rootRef}
          /* One of the cards on its line. Holding a filter it is ARMED: silver is "where you are", never lime
             (Noah, 2026-08-30: "remove anything neon in this search thing to holographic silver") */
          className={`inline-flex items-center gap-1.5 rounded-md border transition-colors font-mono ${compact ? 'h-[22px] pl-2 pr-1.5' : 'h-7 pl-2.5 pr-2'} ${
            active ? 'border-silver bg-silver/[0.07]' : `border-borderSubtle bg-chip hover:border-borderMuted focus-within:border-silver/50 ${open ? 'border-silver/50' : ''}`
          }`}
          data-flow-search={active ? 'armed' : open ? 'open' : 'rest'}
        >
          {/* not in a pane's head (compact): the pane prints the held name's mark itself, right beside this field */}
          {heldName && !compact ? <CompanyLogo ticker={heldName} size={16} /> : <Search className={`w-3 h-3 shrink-0 ${active ? 'text-silver' : 'text-textMuted'}`} aria-hidden="true" />}
          <input
            value={value}
            onChange={e => {
              onChange(e.target.value.toUpperCase().replace(/[^A-Z0-9 .]/g, '').slice(0, 12));
              setScope(null); // typing is searching again
              setOpen(true);
              setHi(0);
            }}
            onFocus={() => setOpen(true)}
            // A click on a field that already has focus fires no focus event —
            // after a pick-then-clear the reader would be tapping a dead box.
            onClick={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={tickersOnly ? 'Ticker' : 'Ticker or contract'}
            aria-label={tickersOnly ? 'Search by ticker' : 'Search by ticker or contract'}
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
            className={`${compact ? 'w-[68px]' : 'w-[132px]'} bg-transparent text-[11px] font-semibold uppercase tracking-wider text-textPrimary placeholder:text-textMuted placeholder:font-normal placeholder:normal-case placeholder:tracking-normal focus:outline-none`}
          />
          {active && (
            <button
              type="button"
              onMouseDown={e => {
                e.preventDefault();
                onChange('');
                setScope(null);
              }}
              aria-label="Clear search"
              className="text-silver/70 hover:text-silver transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={12}
          /* the field keeps the caret: the card never takes focus, and a press on the field is not "outside" */
          onOpenAutoFocus={e => e.preventDefault()}
          onCloseAutoFocus={e => e.preventDefault()}
          onInteractOutside={e => {
            if (rootRef.current?.contains(e.target as Node)) e.preventDefault();
          }}
          className={`${CARD} w-[288px] p-1.5 overflow-y-auto overscroll-contain outline-none`}
          style={{ maxHeight: 'min(var(--radix-popover-content-available-height), 440px)' }}
          role="listbox"
          data-flow-search-card={scope ?? 'all'}
        >
          {nothing && !doorRow ? (
            <div className="px-2.5 py-4 text-center font-mono text-[10px] text-textMuted" data-flow-search-none>
              {noneWords}
            </div>
          ) : scope ? (
            <>
              {renderRow(flat[0], 0)}
              <div className={`${HEADING} mt-1 border-t border-borderSubtle/70 pt-2`}>On {scope}</div>
              {flat.slice(1).map((s, i) => renderRow(s, i + 1))}
            </>
          ) : (
            <>
              {tickers.length > 0 && (
                <>
                  <div className={HEADING}>Names</div>
                  {tickers.map((s, i) => renderRow(s, i))}
                </>
              )}
              {contracts.length > 0 && (
                <>
                  <div className={`${HEADING} ${tickers.length > 0 ? 'mt-1 border-t border-borderSubtle/70 pt-2' : ''}`}>Contracts</div>
                  {contracts.map((s, i) => renderRow(s, tickers.length + i))}
                </>
              )}
              {nothing && doorRow && (
                <div className="px-2 pt-2 pb-1.5 font-mono text-[10px] text-textMuted" data-flow-search-none>
                  {noneWords}
                </div>
              )}
              {doorRow && <div className={tickers.length + contracts.length > 0 || nothing ? 'mt-1 border-t border-borderSubtle/70 pt-1' : ''}>{renderRow(doorRow, tickers.length + contracts.length)}</div>}
            </>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};

export default FlowSearch;
