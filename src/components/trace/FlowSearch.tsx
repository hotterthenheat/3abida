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
==================================================
*/

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Search, X } from 'lucide-react';
import { fmtUsd } from '../../data/gex';
import { roomBelow } from '../ui/menuRoom';
import CompanyLogo from '../ui/CompanyLogo';

/** The four facts a row must carry — FlowPrint and BookContract both do. */
export interface FlowSearchRow {
  ticker: string;
  strike: number;
  right: 'C' | 'P';
  premium: number;
}

export const normSymbol = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

type Suggestion =
  | { key: string; kind: 'ticker'; ticker: string; primary: string; sub: string }
  | { key: string; kind: 'contract'; query: string; primary: string; right: 'C' | 'P'; sub: string }
  | { key: string; kind: 'all'; ticker: string; primary: string; sub: string }
  | { key: string; kind: 'back'; primary: string }
  | { key: string; kind: 'door'; primary: string };

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
  span = false,
  label,
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
  /** On a phone's two-column cards line, the field takes the whole line (its words were cut to "TICKER / CON…") */
  span?: boolean;
  /** The field's name for a screen reader, where one page carries two (Compare's A and B) */
  label?: string;
}) => {
  const listId = useId();
  /* THE DOOR OPENS ONLY WHEN IT IS CHOSEN (the audit's TR-55): a typed name the desk does not carry left for Net Flow on
     Enter, unasked — the door was the menu's only row and so its highlighted one. It opens on a click, or on Enter once
     the arrows have walked to it. */
  const [walked, setWalked] = useState(false);
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
    setWalked(false);
  };

  /* The menu's room (ui/menuRoom): inside a clipping pane it scrolls rather
     than being sliced at the pane's floor; elsewhere it stops at the window. */
  const [menuMax, setMenuMax] = useState<number>();
  useLayoutEffect(() => {
    if (open) setMenuMax(roomBelow(rootRef.current));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const tallies = useMemo(() => {
    const tick = new Map<string, { count: number; prem: number }>();
    const con = new Map<string, { ticker: string; count: number; prem: number; right: 'C' | 'P' }>();
    for (const r of rows) {
      const t = tick.get(r.ticker) ?? { count: 0, prem: 0 };
      t.count += 1;
      t.prem += r.premium;
      tick.set(r.ticker, t);
      const ck = `${r.ticker} ${r.strike}${r.right}`;
      const c = con.get(ck) ?? { ticker: r.ticker, count: 0, prem: 0, right: r.right };
      c.count += 1;
      c.prem += r.premium;
      con.set(ck, c);
    }
    return { tick, con };
  }, [rows]);

  const contractRow = ([ck, v]: [string, { count: number; prem: number; right: 'C' | 'P' }]): Suggestion => ({
    key: `c-${ck}`,
    kind: 'contract',
    query: ck,
    primary: ck,
    right: v.right,
    // A lone appearance says just its money — "1× ·" was noise.
    sub: `${v.count > 1 ? `${v.count}× · ` : ''}${fmtUsd(v.prem)}`,
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
      { key: 'back', kind: 'back', primary: 'All tickers' },
      {
        key: `all-${scope}`,
        kind: 'all',
        ticker: scope,
        primary: `Everything on ${scope}`,
        sub: t ? `${t.count} ${countNoun} · ${fmtUsd(t.prem)}` : '',
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
      .map(([tk, v]) => ({ key: `t-${tk}`, kind: 'ticker', ticker: tk, primary: tk, sub: `${v.count} ${countNoun} · ${fmtUsd(v.prem)}` }));
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

  /* A COMBOBOX (the audit's TR-4): the field keeps the keys — the arrows walk the menu, Enter picks, Esc closes it, and
     Tab leaves the field in one step (the menu's rows are not tab stops; it walked every suggestion before) */
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setWalked(true);
      if (!open) setOpen(true);
      else setHi(h => Math.min(h + 1, flat.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setWalked(true);
      setHi(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      const s = open ? flat[clampedHi] : undefined;
      if (!s) return;
      e.preventDefault();
      if (s.kind === 'door' && !walked) return;
      pick(s);
    } else if (e.key === 'Escape') {
      if (open) e.stopPropagation();
      close();
    } else if (e.key === 'Tab') {
      close();
    }
  };

  const rowClass = (idx: number) =>
    `w-full flex items-center gap-2 px-2.5 py-1.5 text-left transition-colors ${
      idx === clampedHi ? 'bg-ink/[0.06]' : 'hover:bg-ink/[0.03]'
    }`;

  const optionId = (idx: number) => `${listId}-o${idx}`;
  const renderRow = (s: Suggestion, idx: number) => (
    <button
      key={s.key}
      type="button"
      id={optionId(idx)}
      role="option"
      aria-selected={idx === clampedHi}
      tabIndex={-1}
      onMouseEnter={() => setHi(idx)}
      onMouseDown={e => {
        e.preventDefault(); // keep focus; select before the field blurs
        pick(s);
      }}
      className={rowClass(idx)}
    >
      {s.kind === 'contract' ? (
        <span className={`inline-flex w-3.5 justify-center font-mono text-[10px] font-bold ${s.right === 'C' ? 'text-bull' : 'text-bear'}`}>
          {s.right}
        </span>
      ) : s.kind === 'back' ? (
        <ArrowLeft className="w-3 h-3 text-textMuted" />
      ) : s.kind === 'door' ? (
        <ArrowUpRight className="w-3 h-3 text-textMuted" />
      ) : (
        /* a name travels with its mark (the global rule, 2026-09-12) */
        <CompanyLogo ticker={s.ticker} size={14} />
      )}
      <span className={`font-mono text-[11px] ${s.kind === 'back' || s.kind === 'door' ? 'text-textSecondary' : 'font-semibold text-textPrimary'}`}>
        {s.primary}
      </span>
      {s.kind !== 'back' && s.kind !== 'door' && <span className="ml-auto font-mono text-[10px] tnum text-textMuted">{s.sub}</span>}
    </button>
  );

  return (
    <div
      ref={rootRef}
      className="relative min-w-0"
      data-span={span || undefined}
      /* the keys left the field and its menu: the menu goes with them */
      onBlur={e => {
        if (!rootRef.current?.contains(e.relatedTarget as Node | null)) close();
      }}
    >
      <div
        /* Active = the holographic silver, not lime (Noah, 2026-08-30: "remove
           anything neon in this search thing to holographic silver") — the
           foil is the house's "where you are" ink — and since 2026-10-02 its only accent. */
        /* ON A PHONE THE BOX IS ITS CELL'S WIDTH (2026-10-01): in the two-column cards line a 151px cell held a 188px box,
           and its × stood past the card's edge, where no tap could reach it — the field takes what is left instead */
        className={`inline-flex max-sm:flex max-sm:w-full items-center gap-1.5 rounded-md transition-colors ${compact ? 'pl-2 pr-1.5 py-[3px]' : 'pl-2.5 pr-2 py-1.5'} ${
          active ? 'holo-border' : 'border border-borderSubtle bg-ink/[0.02] focus-within:border-borderMuted'
        }`}
      >
        <Search className={`w-3 h-3 shrink-0 ${active ? 'text-silver' : 'text-textMuted'}`} aria-hidden />
        <input
          value={value}
          role="combobox"
          aria-expanded={open && (flat.length > 0 || !!doorRow)}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && flat.length > 0 ? optionId(clampedHi) : undefined}
          onChange={e => {
            onChange(e.target.value.toUpperCase().replace(/[^A-Z0-9 .]/g, '').slice(0, 12));
            setScope(null); // typing is searching again
            setOpen(true);
            setHi(0);
            setWalked(false);
          }}
          onFocus={() => setOpen(true)}
          // A click on a field that already has focus fires no focus event —
          // after a pick-then-clear the reader would be tapping a dead box.
          onClick={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={tickersOnly ? 'Ticker' : 'Ticker or contract'}
          aria-label={label ?? (tickersOnly ? 'Search by ticker' : 'Search by ticker or contract')}
          className={`${compact ? 'w-[68px]' : 'w-[132px]'} max-sm:w-auto max-sm:min-w-0 max-sm:flex-1 bg-transparent font-mono text-[11px] font-semibold uppercase tracking-wider text-textPrimary placeholder:text-textMuted placeholder:font-normal focus:outline-none`}
        />
        {/* THE CLEAR × IS A BUTTON THE KEYS CAN PRESS (the audit's TR-5): it answered the mouse's press alone, so Enter
            and Space did nothing; the press still keeps the field's focus, and a finger gets a hit box round it */}
        {active && (
          <button
            type="button"
            onMouseDown={e => e.preventDefault()}
            onClick={() => {
              onChange('');
              setScope(null);
              setWalked(false);
            }}
            aria-label="Clear the search"
            className="hit -m-1 p-1 rounded text-silver/70 hover:text-silver transition-colors"
          >
            <X className="w-3.5 h-3.5" aria-hidden />
          </button>
        )}
      </div>
      {open && (flat.length > 0 || doorRow) && (
        <div
          id={listId}
          role="listbox"
          aria-label={tickersOnly ? 'Tickers' : 'Tickers and contracts'}
          style={{ maxHeight: menuMax }}
          className="absolute left-0 top-full mt-1 z-40 w-[236px] overflow-y-auto overscroll-contain border border-borderMuted bg-panel rounded-md shadow-2xl shadow-black/60 animate-slide-in"
        >
          {scope ? (
            <>
              {renderRow(flat[0], 0)}
              <div role="presentation" className="px-2.5 pt-1.5 pb-1 font-mono text-[10px] font-bold uppercase tracking-widest text-textMuted border-t border-borderSubtle">
                {scope}
              </div>
              {flat.slice(1).map((s, i) => renderRow(s, i + 1))}
            </>
          ) : (
            <>
              {tickers.length > 0 && (
                <>
                  <div role="presentation" className="px-2.5 pt-1.5 pb-1 font-mono text-[10px] font-bold uppercase tracking-widest text-textMuted">Tickers</div>
                  {tickers.map((s, i) => renderRow(s, i))}
                </>
              )}
              {contracts.length > 0 && (
                <>
                  <div role="presentation" className="px-2.5 pt-1.5 pb-1 font-mono text-[10px] font-bold uppercase tracking-widest text-textMuted border-t border-borderSubtle">
                    Contracts
                  </div>
                  {contracts.map((s, i) => renderRow(s, tickers.length + i))}
                </>
              )}
              {doorRow && (
                <div role="presentation" className={tickers.length + contracts.length > 0 ? 'border-t border-borderSubtle mt-1 pt-1' : ''}>
                  {renderRow(doorRow, tickers.length + contracts.length)}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default FlowSearch;
