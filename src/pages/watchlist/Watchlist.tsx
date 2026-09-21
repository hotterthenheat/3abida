import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Bookmark, ChevronDown, ChevronUp, Plus, X } from 'lucide-react';
import { NAV_INK } from '../../components/layout/nav';
import { Fact } from '../../components/trace/TraceBox';
import CompanyLogo from '../../components/ui/CompanyLogo';
import DropdownSelect, { type DropdownOption } from '../../components/ui/DropdownSelect';
import { useMarketData } from '../../context/MarketDataContext';
import {
  addSymbol, createList, listNameTaken, moveSymbol, removeList, removeSymbol, renameList, setActiveList, useWatchlists,
} from '../../data/watchlists';
import { onWake, wakeSymbol, watchRow, type WatchRow } from '../../data/watchRow';
import type { HeatPatternKey } from '../../types/gex';
import ConfirmButton from '../../components/ui/ConfirmButton';

/*
==================================================
  SLAYER TERMINAL - WATCHLISTS
  (pages/watchlist/Watchlist.tsx)

  The names a reader is carrying, and what each of
  them is doing.
==================================================

  A WATCHLIST OF PRICES IS A STOCK APP. What makes a name worth carrying on
  this terminal is the column beside the price: which side of the flip spot
  is on, which wall is nearest and how far, what the heat field is doing,
  and whether you already told it to shout. So the row leads with the name
  and the move and then answers the question the rest of the terminal is
  built to answer.

  PICKING A NAME IS NAVIGATION. Clicking a row sets the terminal's active
  ticker and takes you to the desk — the whole point of a list is that it
  is the way IN, not a place to look at names and then go select them again
  somewhere else. The row's own controls (the star, the reorder arrows) are
  buttons INSIDE the row rather than the row itself, so aiming at one never
  costs a navigation you did not ask for.

  A RESTING NAME SAYS SO. The simulator seeds a history lazily and a name it
  has not built yet has no levels — not levels of zero. Those rows print
  dashes and the word `resting`, and a pump wakes them a few milliseconds at
  a time in the background. Manufacturing a flip at the current price would
  have filled the column and lied.
*/

const PATTERN_INK: Record<HeatPatternKey, string> = {
  SPRINGBOARD: 'text-bull',
  TRAPDOOR: 'text-bear',
  PINNED: 'text-textSecondary',
  WHIPSAW: 'text-warn',
};

const COLS = '1.5fr 0.85fr 0.8fr 0.65fr 0.9fr 1.1fr 1fr 0.5fr';

const Col = ({ children, right }: { children?: React.ReactNode; right?: boolean }) => (
  <span className={`font-mono text-[9px] uppercase tracking-widest text-textMuted ${right ? 'text-right' : ''}`}>{children}</span>
);

const Row = ({ row, listId, onOpen, first, last }: {
  row: WatchRow; listId: string; onOpen: (s: string) => void; first: boolean; last: boolean;
}) => {
  const up = (row.changePct ?? 0) >= 0;
  return (
    <div
      className="group grid items-center px-3 py-1.5 border-b border-borderSubtle/50 last:border-0 hover:bg-ink/[0.03] transition-colors cursor-pointer"
      style={{ gridTemplateColumns: COLS }}
      onClick={() => onOpen(row.symbol)}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(row.symbol); } }}
      aria-label={`Open ${row.symbol}`}
      data-watch-row={row.symbol}
    >
      <span className="flex items-center gap-1.5 min-w-0">
        <CompanyLogo ticker={row.symbol} size={15} />
        <span className="text-[12px] font-semibold text-textPrimary truncate">{row.symbol}</span>
        {row.state === 'resting' && <span className="font-mono text-[8.5px] uppercase tracking-widest text-textMuted shrink-0">resting</span>}
      </span>

      <span className="text-[12px] tnum text-right text-textPrimary">
        {row.last == null ? '—' : row.last.toFixed(2)}
      </span>

      <span className={`text-[12px] tnum text-right ${row.changePct == null ? 'text-textMuted' : up ? 'text-bull' : 'text-bear'}`}>
        {row.changePct == null ? '—' : `${up ? '+' : ''}${row.changePct.toFixed(2)}%`}
      </span>

      <span className="text-[12px] tnum text-right text-textSecondary">{row.ivPct == null ? '—' : row.ivPct.toFixed(0)}</span>

      <span className="text-[11px] text-right">
        {row.aboveFlip == null ? (
          <span className="text-textMuted">—</span>
        ) : (
          <span className={row.aboveFlip ? 'text-bull' : 'text-bear'}>{row.aboveFlip ? 'above' : 'below'}</span>
        )}
      </span>

      <span className="text-[11px] tnum text-right text-textSecondary">
        {row.wall == null ? '—' : (
          <>
            <span className={row.wall.kind === 'call' ? 'text-bull' : 'text-bear'}>{row.wall.kind === 'call' ? 'C' : 'P'}</span>
            {' '}{row.wall.price.toFixed(2)}
            <span className="text-textMuted"> · {row.wall.distPct.toFixed(1)}%</span>
          </>
        )}
      </span>

      <span className={`text-[10.5px] text-right font-semibold ${row.pattern ? PATTERN_INK[row.pattern] : 'text-textMuted'}`}>
        {row.pattern ?? '—'}
      </span>

      <span className="flex items-center justify-end gap-0.5" onClick={e => e.stopPropagation()}>
        {row.alerts > 0 && (
          <span className="inline-flex items-center gap-0.5 font-mono text-[9px] text-warn mr-0.5" title={`${row.alerts} alert${row.alerts === 1 ? '' : 's'} set`}>
            <Bell className="w-2.5 h-2.5" aria-hidden="true" />{row.alerts}
          </span>
        )}
        <button type="button" onClick={() => moveSymbol(listId, row.symbol, -1)} disabled={first} aria-label={`Move ${row.symbol} up`} className="opacity-0 group-hover:opacity-100 disabled:opacity-0 w-5 h-5 inline-flex items-center justify-center rounded text-textMuted hover:text-textPrimary transition-all">
          <ChevronUp className="w-3 h-3" />
        </button>
        <button type="button" onClick={() => moveSymbol(listId, row.symbol, 1)} disabled={last} aria-label={`Move ${row.symbol} down`} className="opacity-0 group-hover:opacity-100 disabled:opacity-0 w-5 h-5 inline-flex items-center justify-center rounded text-textMuted hover:text-textPrimary transition-all">
          <ChevronDown className="w-3 h-3" />
        </button>
        <button type="button" onClick={() => removeSymbol(listId, row.symbol)} aria-label={`Remove ${row.symbol}`} className="opacity-0 group-hover:opacity-100 w-5 h-5 inline-flex items-center justify-center rounded text-textMuted hover:text-bear transition-all" data-watch-remove={row.symbol}>
          <X className="w-3 h-3" />
        </button>
      </span>
    </div>
  );
};

const Watchlist = () => {
  const navigate = useNavigate();
  const { changeTicker } = useMarketData();
  const { lists, activeId } = useWatchlists();
  const list = lists.find(l => l.id === activeId) ?? lists[0];
  const [adding, setAdding] = useState('');
  const [said, setSaid] = useState('');
  const [tick, setTick] = useState(0);
  /* Naming a list, inline — see the form in the bar below for why it is not
     a `window.prompt` any more. */
  const [naming, setNaming] = useState<'new' | 'rename' | null>(null);
  const [draft, setDraft] = useState('');

  const startNaming = (mode: 'new' | 'rename'): void => {
    setNaming(mode);
    setDraft(mode === 'rename' ? (list?.name ?? '') : '');
    setSaid('');
  };
  const stopNaming = (): void => {
    setNaming(null);
    setDraft('');
    setSaid('');
  };
  const commitName = (): void => {
    const n = draft.trim();
    if (n.length === 0) return;
    if (naming === 'rename') {
      if (!list) return;
      if (n.toLowerCase() === list.name.toLowerCase()) { stopNaming(); return; }
      if (listNameTaken(n, list.id)) { setSaid(`There is already a list called ${n}.`); return; }
      renameList(list.id, n);
    } else {
      if (listNameTaken(n)) { setSaid(`There is already a list called ${n}.`); return; }
      createList(n);
    }
    stopNaming();
  };

  /* One tick drives every row — the prices move, the levels are memoised
     behind them, and a name that finishes seeding announces itself. */
  useEffect(() => {
    const t = window.setInterval(() => setTick(n => n + 1), 1200);
    const off = onWake(() => setTick(n => n + 1));
    return () => { window.clearInterval(t); off(); };
  }, []);

  useEffect(() => {
    for (const s of list?.symbols ?? []) wakeSymbol(s);
  }, [list?.symbols]);

  /* `tick` is the VALUE, not the setter. Destructuring the setter into the
     dep array made this memo permanently stale — the names were seeding fine
     and the table simply never recomputed, so every row read `resting`
     forever. A stable function in a dep array is a dependency that can never
     change, which is the quietest way to freeze a live surface. */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rows = useMemo(() => (list?.symbols ?? []).map(watchRow), [list?.symbols, tick]);

  const open = useCallback((symbol: string) => {
    changeTicker(symbol);
    navigate('/weigher');
  }, [changeTicker, navigate]);

  const add = () => {
    const s = adding.trim().toUpperCase();
    if (!s) return;
    if (!addSymbol(list.id, s)) { setSaid(`${s} is already on ${list.name}, or is not a symbol.`); return; }
    wakeSymbol(s);
    setAdding('');
    setSaid('');
  };

  const options: DropdownOption<string>[] = lists.map(l => ({
    value: l.id, label: l.name, hint: `${l.symbols.length} name${l.symbols.length === 1 ? '' : 's'}`,
  }));

  const live = rows.filter(r => r.state === 'live');
  const up = live.filter(r => (r.changePct ?? 0) > 0).length;
  const aboveFlip = live.filter(r => r.aboveFlip === true).length;

  return (
    <div className="flex flex-col gap-3" data-watchlist-page>
      <header className="flex items-start gap-6 flex-wrap pb-3 border-b border-borderSubtle" data-shell>
        <div className="min-w-0 flex-1">
          <div className="h-6 flex items-center gap-2.5" data-shell-page>
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-md border border-borderSubtle text-textSecondary shrink-0" aria-hidden="true" style={{ '--ink': NAV_INK.tracker } as CSSProperties}>
              <Bookmark className="w-3.5 h-3.5" />
            </span>
            <h1 className="text-[15px] font-semibold leading-tight text-textPrimary">Watchlists</h1>
          </div>
          <p className="mt-0.5 text-[11px] text-textMuted whitespace-nowrap truncate">The names you are carrying — where each sits against its flip, which wall is nearest, and what the field is doing. Pick one to take the desk there.</p>
        </div>
        <dl className="flex flex-wrap items-start gap-x-6 gap-y-1" data-shell-facts>
          <Fact label="Names" testId="wl-count">{list?.symbols.length ?? 0}</Fact>
          <Fact label="Green" testId="wl-up">{live.length ? `${up}/${live.length}` : '—'}</Fact>
          <Fact label="Above flip" testId="wl-flip">{live.length ? `${aboveFlip}/${live.length}` : '—'}</Fact>
        </dl>
      </header>

      <div className="flex items-center gap-2 flex-wrap" data-watchlist-bar>
        <DropdownSelect<string> label="List" value={list?.id ?? ''} options={options} onChange={setActiveList} title="Which list" testId="watchlist-pick" align="start" />
        <span className="inline-flex items-center gap-1">
          <input
            value={adding}
            onChange={e => setAdding(e.target.value.slice(0, 12))}
            onKeyDown={e => { if (e.key === 'Enter') add(); }}
            placeholder="Add a name"
            aria-label="Add a symbol"
            className="w-[120px] h-7 px-2 rounded-md border border-borderSubtle bg-inputBg font-mono text-[11px] font-semibold uppercase text-textPrimary placeholder:text-textMuted placeholder:font-normal placeholder:normal-case outline-none focus:border-silver/60"
            data-watch-add-input
          />
          <button type="button" onClick={add} aria-label="Add" className="w-7 h-7 inline-flex items-center justify-center rounded-md border border-borderSubtle text-textSecondary hover:text-textPrimary hover:border-borderMuted transition-colors" data-watch-add>
            <Plus className="w-3.5 h-3.5" />
          </button>
        </span>
        {/* AN INLINE FIELD, NOT `window.prompt`. Every other name in this
            terminal is typed into the page — the saved cut, the desk, the
            alert — and a browser prompt is the one control that cannot be
            styled, cannot say why it refused, and is blocked outright in
            some embeddings. It also had nowhere to put "that name is
            already taken", so two lists called Swing were simply made. */}
        {naming ? (
          <span className="inline-flex items-center gap-1" data-watch-name-form>
            <input
              value={draft}
              onChange={e => { setDraft(e.target.value.slice(0, 32)); setSaid(''); }}
              onKeyDown={e => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') stopNaming(); }}
              placeholder={naming === 'rename' ? 'New name' : 'Name the list'}
              aria-label={naming === 'rename' ? 'Rename the list' : 'Name the new list'}
              autoFocus
              className="w-[150px] h-7 px-2 rounded-md border border-borderSubtle bg-inputBg text-[11px] text-textPrimary placeholder:text-textMuted outline-none focus:border-silver/60"
              data-watch-name-input
            />
            <button type="button" onClick={commitName} disabled={draft.trim().length === 0} className="h-7 px-2.5 rounded-md border border-borderMuted text-[11px] font-semibold text-textPrimary hover:bg-ink/[0.05] disabled:opacity-40 transition-colors" data-watch-name-save>
              {naming === 'rename' ? 'Rename' : 'Create'}
            </button>
            <button type="button" onClick={stopNaming} className="h-7 px-2 rounded-md border border-borderSubtle text-[11px] text-textSecondary hover:text-textPrimary transition-colors">
              Cancel
            </button>
          </span>
        ) : (
          <>
            <button type="button" onClick={() => startNaming('new')} className="h-7 px-2.5 rounded-md border border-borderSubtle text-[11px] text-textSecondary hover:text-textPrimary hover:border-borderMuted transition-colors" data-watch-new-list>
              New list
            </button>
            {list && (
              <button type="button" onClick={() => startNaming('rename')} className="h-7 px-2.5 rounded-md border border-borderSubtle text-[11px] text-textSecondary hover:text-textPrimary hover:border-borderMuted transition-colors" data-watch-rename>
                Rename
              </button>
            )}
          </>
        )}
        {list && (
          <>
            {/* THE SECOND CLICK (ui/ConfirmButton). One click used to take a
                list and up to a hundred names with it, with nothing asked and
                nothing to undo — and the empty state promises that every name
                added "starts building its history in the background", so it
                was real work going quietly. The armed label counts it. */}
            <ConfirmButton
              onConfirm={() => { if (!removeList(list.id)) setSaid('That is the last list — a reader with none has no way back.'); }}
              disabled={lists.length <= 1}
              confirm={`Yes — delete ${list.name} and its ${list.symbols.length} name${list.symbols.length === 1 ? '' : 's'}`}
              title={`Delete ${list.name}`}
              testId="watchlist-delete"
              className="h-7 px-2.5 rounded-md border border-borderSubtle text-[11px] text-textSecondary hover:text-bear hover:border-borderMuted"
            >
              Delete
            </ConfirmButton>
          </>
        )}
        {said && <span role="status" className="font-mono text-[10px] text-warn">{said}</span>}
      </div>

      <div className="border border-borderSubtle rounded-md overflow-hidden" data-watchlist-table>
        <div className="grid px-3 py-1.5 border-b border-borderSubtle bg-inset" style={{ gridTemplateColumns: COLS }}>
          <Col>Name</Col><Col right>Last</Col><Col right>Change</Col><Col right>IV</Col>
          <Col right>vs flip</Col><Col right>Nearest wall</Col><Col right>Field</Col><Col right />
        </div>
        {rows.length === 0 ? (
          <div className="px-3 py-10 flex flex-col items-center gap-2" data-watchlist-empty>
            <Bookmark className="w-6 h-6 text-textMuted" aria-hidden="true" />
            <p className="text-[12px] text-textPrimary">{list?.name ?? 'This list'} is empty</p>
            <p className="text-[11px] text-textMuted text-center max-w-xs">Type a symbol above and it joins the list. Every name you add starts building its history in the background.</p>
          </div>
        ) : (
          rows.map((r, i) => (
            <Row key={r.symbol} row={r} listId={list.id} onOpen={open} first={i === 0} last={i === rows.length - 1} />
          ))
        )}
      </div>

      <p className="px-1 text-[10.5px] leading-relaxed text-textMuted">
        The flip, the walls and the field are read from the dealer model on each name&apos;s own chain — derived, not quoted. A row that says <span className="text-textSecondary">resting</span> has no history built yet and is being woken a few milliseconds at a time; nothing is estimated in its place.
      </p>
    </div>
  );
};

export default Watchlist;
