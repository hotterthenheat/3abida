/*
==================================================
  SLAYER TERMINAL - THE BOARD
  (pages/pinpoint/Board.tsx)

  Everything at a glance — every name the desk
  covers, one row each, the reads the Map makes for
  one name made for all of them. Click a row and the
  Map becomes that name (the Pinpoint roadmap,
  2026-09-05).

  THE GRID IS AG GRID (community, MIT), not a table
  of our own — Noah, 2026-09-05: "research any
  libraries/ui designs that come prebuilt therefore
  we don't look like a kid learning html/css for the
  first time but an actual large scale company". AG
  Grid is the data grid the large shops ship:
  sorting, resizing, pinned columns, keyboard
  navigation, virtualised rows, and a theming API
  (v33+) that takes our tokens as parameters instead
  of a stylesheet to fight. The cells that carry
  meaning — the name with its logo, the regime word,
  the walls in their inks, the bell's share, the
  session sparkline — are React cell renderers, so
  the house grammar rides inside the grid rather than
  over it.
==================================================
*/

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Plus, X } from 'lucide-react';
import { type ColDef, type ICellRendererParams, type IRowNode, type RowClickedEvent } from 'ag-grid-community';
import { AgGridProvider, AgGridReact } from 'ag-grid-react';
import { GRID_MODULES, GRID_THEME, openRowOnEnter } from '../../components/ui/houseGrid';
import { stampOf } from './usePinpoint';
import { useMarketData } from '../../context/MarketDataContext';
import { buildBoardRow, type BoardRow } from '../../data/board';
import { addBoardName, removeBoardName, useBoardNames } from '../../data/boardNames';
import { tickerName } from '../../data/tickers';
import TickerLookup from '../../components/ui/TickerLookup';
import useFocusTrap from '../../components/ui/useFocusTrap';
import { useAnchoredMenu } from '../../components/ui/useAnchoredMenu';
import { fmtUsd } from '../../data/gex';
import { REGIME_WORDS } from '../../data/flipGauge';
import CompanyLogo from '../../components/ui/CompanyLogo';
import { CALL_WALL, FLIP, LONG_GAMMA, PUT_WALL, SHORT_GAMMA, SUPREME, THERMAL_WARM } from '../../components/gex/paletteInk';
import { fmtDollars } from '../../data/ahead';

const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */
const ROLE_INK: Record<string, string> = { 'call wall': CALL_WALL, 'put wall': PUT_WALL, supreme: SUPREME, flip: FLIP };
const WARM = THERMAL_WARM;

/** The board sweeps on the scan tier — a bird's-eye view must not vibrate per tick */
const SCAN_INTERVAL_MS = 10_000;
/* The grid's theme and modules are the house's (components/ui/houseGrid.ts) — the Record's tables wear the same */
const MODULES = GRID_MODULES;
/* the house grid at the terminal's reading floor: an 11px head (the house's is 9) */
const THEME = GRID_THEME.withParams({ headerFontSize: 11 });
/* The grid's own words in the house voice (PP-14, PP-35), not AG Grid's Title Case */
const LOCALE = { noRowsToShow: 'No name on the board matches', noMatchingRows: 'No name on the board matches', loadingOoo: 'Reading the board…' };
const fmtStrike = (v: number) => (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2));
const fmtPct = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2)}%`;

// ---- cell renderers: the house grammar inside the grid -----------------------

/** What the grid hands every cell renderer (AgGridReact `context`) */
interface BoardContext {
  remove: (ticker: string) => void;
}

/* The × that takes a name off the board. A NATIVE handler on the button, not a
   React one: the grid's own row listeners hear the click before React's root
   does, so only a native stopPropagation at the target keeps the row from
   opening the name on the Map. Shown on the row's hover (index.css). */
const RemoveName = ({ ticker, remove }: { ticker: string; remove: (t: string) => void }) => {
  const ref = useCallback(
    (el: HTMLButtonElement | null) => {
      if (!el) return;
      el.onmousedown = e => e.stopPropagation();
      el.onclick = e => {
        e.stopPropagation();
        remove(ticker);
      };
    },
    [ticker, remove]
  );
  return (
    <button ref={ref} type="button" title="Take this name off the board" aria-label={`Take ${ticker} off the board`} className="hit ml-auto inline-flex items-center justify-center w-5 h-5 rounded text-textMuted hover:text-textPrimary hover:bg-ink/[0.06]" data-board-remove>
      <X className="w-3 h-3" />
    </button>
  );
};

const NameCell = ({ data, context }: ICellRendererParams<BoardRow, unknown, BoardContext>) =>
  data ? (
    <span className="flex items-center gap-2 font-mono w-full">
      <CompanyLogo ticker={data.ticker} size={16} />
      <span className="text-[12px] font-bold text-textPrimary">{data.ticker}</span>
      {/* YOUR POSITIONS ride on the name (PP-4: their own column pushed the grid past the screen at 1440 and 1920) */}
      {data.yours.positions > 0 && (
        <span className="text-[11px] tnum text-silver whitespace-nowrap" title={`You hold ${data.yours.contracts} contract${data.yours.contracts === 1 ? '' : 's'} in ${data.yours.positions} position${data.yours.positions === 1 ? '' : 's'} on ${data.ticker}`}>
          {data.yours.contracts} held
        </span>
      )}
      {context?.remove && <RemoveName ticker={data.ticker} remove={context.remove} />}
    </span>
  ) : null;

/** The session's closes as one quiet line — the day's shape, not a chart — beside the price it ends on */
const Spark = ({ spark }: { spark: number[] }) => {
  if (spark.length < 2) return null;
  const W = 56;
  const H = 20;
  const min = Math.min(...spark);
  const max = Math.max(...spark);
  const span = max - min || 1;
  const pts = spark.map((v, i) => `${((i / (spark.length - 1)) * W).toFixed(1)},${(H - 2 - ((v - min) / span) * (H - 4)).toFixed(1)}`).join(' ');
  const up = spark[spark.length - 1] >= spark[0];
  return (
    <svg width={W} height={H} className="block shrink-0" aria-hidden="true">
      <polyline points={pts} fill="none" stroke={up ? 'rgb(var(--bull))' : 'rgb(var(--bear))'} strokeOpacity={0.85} strokeWidth={1.2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};

/* TODAY SO FAR rides with the price (PP-4): the day's path ends on the figure beside it */
const SpotCell = ({ data }: ICellRendererParams<BoardRow>) =>
  data ? (
    <span className="inline-flex items-center gap-2 font-mono tnum">
      <span className="text-[12px] text-textPrimary">${data.spot.toFixed(2)}</span>
      <span className={`text-[11px] ${data.changePct >= 0 ? 'text-bull' : 'text-bear'}`}>{fmtPct(data.changePct)}</span>
      <Spark spark={data.spark} />
    </span>
  ) : null;

const RegimeCell = ({ data }: ICellRendererParams<BoardRow>) => {
  if (!data) return null;
  if (!data.regime) return <span className="font-mono text-[11px] text-textMuted">one-sided — no flip</span>;
  const w = REGIME_WORDS[data.regime];
  /* The shell's words, not "LONG GAMMA" (2026-09-09): plain English on Pinpoint */
  return (
    <span className="font-mono text-[11px] tnum" style={{ color: data.regime === 'SHORT' ? SHORT_GAMMA : LONG_GAMMA }} title={`${w.label.toLowerCase()} — ${w.blurb}`}>
      {data.regime === 'SHORT' ? 'amplifying moves' : 'absorbing moves'}
    </span>
  );
};

const FlipCell = ({ data }: ICellRendererParams<BoardRow>) =>
  data && data.flip != null ? (
    <span className="inline-flex items-baseline gap-2 font-mono tnum">
      <span className="text-[11px] font-semibold" style={{ color: FLIP }}>
        {fmtStrike(data.flip)}
      </span>
      {data.flipDistPct != null && <span className="text-[11px] text-textSecondary">{fmtPct(data.flipDistPct)}</span>}
      {/* CROSSED TODAY rides with the flip (PP-4) */}
      {data.crossings != null && <span className="text-[11px] text-textMuted" title="How many times price has crossed the flip today">· {data.crossings}×</span>}
    </span>
  ) : (
    <span className="font-mono text-[11px] text-textMuted">—</span>
  );

const WallCell = ({ data }: ICellRendererParams<BoardRow>) =>
  data ? (
    <span className="inline-flex items-baseline gap-2 font-mono tnum">
      <span className="text-[11px] font-bold" style={{ color: data.nearest.kind === 'call' ? CALL_WALL : PUT_WALL }}>
        {data.nearest.kind === 'call' ? 'Call wall' : 'Put wall'}
      </span>
      <span className="text-[11px] font-semibold text-textPrimary">{fmtStrike(data.nearest.strike)}</span>
      <span className="text-[11px] text-textSecondary">{fmtPct(data.nearest.distPct)}</span>
    </span>
  ) : null;

/** The agenda's #1 for the name: the strike in its kind's ink, reached · holds, the dollars at stake */
const WatchCell = ({ data }: ICellRendererParams<BoardRow>) => {
  if (!data) return null;
  const w = data.watch;
  if (!w) return <span className="font-mono text-[11px] text-textMuted">—</span>;
  const kind = w.role ?? (w.isShelf ? 'shelf' : w.isWall ? null : 'trapdoor');
  const ink = w.role ? ROLE_INK[w.role] : w.isShelf ? 'rgb(var(--text-muted))' : w.isWall ? undefined : WARM;
  return (
    <span className="inline-flex items-baseline gap-2 font-mono tnum">
      <span className="text-[11px] font-semibold text-textPrimary">{fmtStrike(w.strike)}</span>
      {kind && (
        <span className="text-[11px]" style={{ color: ink }}>
          {kind}
        </span>
      )}
      <span className="text-[11px] text-textSecondary">
        {Math.round(w.reach * 100)}% reached{w.isShelf ? ' · holds ' : ''}
        {w.isShelf && <span style={{ color: SILVER }}>{Math.round(w.hold * 100)}%</span>}
      </span>
      <span className="text-[11px] text-textMuted">{fmtDollars(w.stake)}</span>
    </span>
  );
};

const SupremeCell = ({ data }: ICellRendererParams<BoardRow>) =>
  data ? (
    <span className="font-mono text-[11px] font-bold tnum" style={{ color: SUPREME }}>
      {fmtStrike(data.supreme)}
    </span>
  ) : null;

const NetCell = ({ data }: ICellRendererParams<BoardRow>) =>
  data ? (
    <span className="font-mono text-[11px] font-semibold tnum" style={{ color: data.netGex > 0 ? SHORT_GAMMA : LONG_GAMMA }} title={data.netGex > 0 ? 'Put-heavy: in this terminal positive means more puts than calls, and dealer hedging there makes moves bigger' : 'Call-heavy: in this terminal negative means more calls than puts, and dealer hedging there softens moves'}>
      {fmtUsd(data.netGex)}
    </span>
  ) : null;

const BellCell = ({ data }: ICellRendererParams<BoardRow>) =>
  data && data.bellShare != null ? (
    <span className="inline-flex items-center gap-2 font-mono tnum w-full">
      <span className="text-[11px] text-textPrimary w-8 text-right">{data.bellShare}%</span>
      <span className="flex-1 h-[3px] rounded-full bg-ink/[0.06] overflow-hidden">
        <span className="block h-full rounded-full" style={{ width: `${data.bellShare}%`, background: 'rgb(var(--text-secondary))', opacity: 0.7 }} />
      </span>
    </span>
  ) : (
    <span className="font-mono text-[11px] text-textMuted">—</span>
  );

const Board = () => {
  const { marketData, changeTicker } = useMarketData();
  const navigate = useNavigate();
  /* THE NAMES ON THE BOARD — the list the user keeps (2026-09-09: twelve to
     start, add any listing, take any off) */
  const names = useBoardNames();
  const [rows, setRows] = useState<BoardRow[]>([]);
  const [scanAt, setScanAt] = useState('');
  const lastRef = useRef(0);
  const runRef = useRef(0);
  const liveRef = useRef(marketData);
  liveRef.current = marketData;
  /* ONE NAME PER MACROTASK: a name the simulator has not seen walks its whole
     history in (~0.6s), a seeded one takes ~20ms — twelve in one go would be
     one long task on every scan. Rows land as they are built; a run that is
     overtaken (the list changed, a new scan) stops where it is. */
  const rebuild = useCallback((list: string[], fresh: boolean) => {
    const run = ++runRef.current;
    if (fresh) setRows(prev => prev.filter(r => list.includes(r.ticker)));
    let i = 0;
    const step = () => {
      if (run !== runRef.current) return;
      if (i >= list.length) {
        setScanAt(stampOf(Date.now()));
        return;
      }
      const t = list[i++];
      /* the terminal's own tick for its name, so the row reads the scan its pages read (data/pinpointBook.ts) */
      const row = buildBoardRow(t, liveRef.current?.ticker === t ? liveRef.current : null);
      if (row)
        setRows(prev => {
          const at = prev.findIndex(r => r.ticker === row.ticker);
          if (at < 0) return [...prev, row];
          const next = prev.slice();
          next[at] = row;
          return next;
        });
      setTimeout(step, 0);
    };
    step();
  }, []);
  useEffect(() => {
    lastRef.current = Date.now();
    rebuild(names, true);
  }, [names, rebuild]);
  useEffect(() => {
    if (!marketData) return;
    const now = Date.now();
    if (now - lastRef.current < SCAN_INTERVAL_MS) return;
    lastRef.current = now;
    rebuild(names, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketData]);

  /* THE FILTER takes as many names as you like (Noah, 2026-09-09: "the filter
     only allows you to see one name at a time") — "SPY QQQ nvda" or commas;
     a row stays if any token starts its symbol or sits in its company name */
  const [quick, setQuick] = useState('');
  const tokens = useMemo(() => quick.toUpperCase().split(/[\s,]+/).filter(Boolean), [quick]);
  const tokensRef = useRef(tokens);
  tokensRef.current = tokens;
  const gridRef = useRef<AgGridReact<BoardRow>>(null);
  useEffect(() => {
    gridRef.current?.api?.onFilterChanged();
  }, [tokens]);
  const matches = useCallback((t: string) => {
    const name = tickerName(t).toUpperCase();
    return tokens.some(tok => t.startsWith(tok) || name.includes(tok));
  }, [tokens]);
  /* THE COUNT FOLLOWS THE FILTER (PP-14): "12 names" with two rows on screen read as a broken filter */
  const shownCount = tokens.length ? rows.filter(r => matches(r.ticker)).length : rows.length;
  const isExternalFilterPresent = useCallback(() => tokensRef.current.length > 0, []);
  const doesExternalFilterPass = useCallback((node: IRowNode<BoardRow>) => {
    const t = node.data?.ticker ?? '';
    const name = tickerName(t).toUpperCase();
    return tokensRef.current.some(tok => t.startsWith(tok) || name.includes(tok));
  }, []);

  /* ADD A NAME — the scope chip's menu, on the toolbar */
  const [adding, setAdding] = useState(false);
  const addRootRef = useRef<HTMLSpanElement | null>(null);
  const addMenuRef = useRef<HTMLDivElement | null>(null);
  const { anchorRef: addAnchor, placed: addPlaced } = useAnchoredMenu<HTMLButtonElement>(adding, 'bottom', 288, 'start');
  useFocusTrap(adding, addMenuRef);
  useEffect(() => {
    if (!adding) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (addRootRef.current?.contains(t) || addMenuRef.current?.contains(t)) return;
      setAdding(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setAdding(false);
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [adding]);
  const gridContext = useMemo<BoardContext>(() => ({ remove: removeBoardName }), []);

  /* THE COLUMNS FILL THE WIDTH — flex, not fixed pixels (Noah, 2026-09-05:
     "look at all the empty space on the right"). The name stays pinned at a
     fixed width; every other column takes its share of whatever is left.
     Headers in plain English — no jargon on this page. */
  /* EVERY HEAD EXPLAINS ITSELF ON HOVER (the lock walk, Noah, 2026-09-09: "certain
     row headers like 'expires today' need a brief hover description") — one
     sentence each, the grid's own tooltip, in the house clothes (index.css). */
  /* THE BOARD FITS (the audit's PP-4, 2026-10-09): twelve columns never fit at 1440, and "Your positions" stood off
     screen at 1920. Nine now — today's path rides with the price, the crossings with the flip, your contracts with the
     name — on widths that fit a 1440 screen with the rail open and fill a wider one. */
  const columnDefs = useMemo<ColDef<BoardRow>[]>(
    () => [
      { headerName: 'Name', field: 'ticker', pinned: 'left', width: 150, cellRenderer: NameCell, sortable: true, headerTooltip: 'A name and the contracts you hold on it — Enter or a click opens it on the Map' },
      { headerName: 'Price · today', field: 'spot', flex: 1.2, minWidth: 176, cellRenderer: SpotCell, comparator: (a: number, b: number) => a - b, headerTooltip: "The last price, today's change, and the path since the open" },
      {
        headerName: 'Watch first',
        field: 'watch',
        flex: 2,
        minWidth: 250,
        cellRenderer: WatchCell,
        cellDataType: false,
        headerTooltip: 'The strike to watch first on this name — the one most likely reached with the most at stake — with the odds it is reached, the odds it holds, and the dollars behind it',
        // The name whose first target matters most, first
        comparator: (a: BoardRow['watch'], b: BoardRow['watch']) => (a ? a.reach * a.stake : -1) - (b ? b.reach * b.stake : -1),
      },
      { headerName: 'Hedging today', field: 'regime', flex: 1, minWidth: 124, cellRenderer: RegimeCell, headerTooltip: 'Which side of the flip price is on: above it dealer hedging absorbs moves, below it the hedging amplifies them' },
      {
        headerName: 'Flip · crossed',
        field: 'flipDistPct',
        flex: 1.1,
        minWidth: 148,
        cellRenderer: FlipCell,
        sort: 'asc',
        headerTooltip: 'The price where dealer hedging switches sides, how far it is from spot, and how many times price has crossed it today — the names closest to flipping come first',
        // Closest to flipping first — the names that can change character next
        comparator: (a: number | null, b: number | null) => Math.abs(a ?? 1e9) - Math.abs(b ?? 1e9),
      },
      {
        headerName: 'Nearest wall',
        field: 'nearest',
        flex: 1.2,
        minWidth: 150,
        cellRenderer: WallCell,
        cellDataType: false,
        headerTooltip: 'The closest strike whose hedging pushes back on price, and how far it is',
        comparator: (a: BoardRow['nearest'], b: BoardRow['nearest']) => Math.abs(a.distPct) - Math.abs(b.distPct),
      },
      { headerName: 'Supreme', field: 'supreme', flex: 0.7, minWidth: 84, cellRenderer: SupremeCell, headerTooltip: 'The heaviest strike on the whole book — the one the Map marks in magenta' },
      {
        headerName: 'Net GEX',
        field: 'netGex',
        flex: 0.9,
        minWidth: 100,
        cellRenderer: NetCell,
        comparator: (a: number, b: number) => Math.abs(a) - Math.abs(b),
        /* THE SIGN, SAID ONCE (PP-3): the house sign is the street's turned over (data/exposure.ts) — positive is put-heavy
           and amplifies, negative call-heavy and absorbs. It is the whole book; Hedging today is where price stands
           against the flip, so a name can read "absorbing" there and positive here. */
        headerTooltip: "Today's hedging on the whole book added up, per 1% move. In this terminal positive means put-heavy, where dealer hedging makes moves bigger, and negative call-heavy, where it softens them. Hedging today reads which side of the flip price is on, so the two can differ",
      },
      { headerName: 'Expires today', field: 'bellShare', flex: 1, minWidth: 112, cellRenderer: BellCell, headerTooltip: "The share of the name's hedging sitting in contracts that expire at 4:00 today — it is gone at the close, and the walls it made go with it" },
    ],
    []
  );
  const defaultColDef = useMemo<ColDef<BoardRow>>(() => ({ sortable: true, resizable: true, suppressMovable: true }), []);

  const openName = (t: string) => {
    changeTicker(t);
    navigate('/pinpoint/map');
  };
  const open = (e: RowClickedEvent<BoardRow>) => {
    if (!e.data) return;
    openName(e.data.ticker);
  };

  return (
    /* Sized to its rows, not to the screen — a board of four names in an
       empty first screen is dead surface (Noah's rule); a board of forty
       scrolls the page like any list. */
    <div className="border border-borderSubtle rounded-md overflow-hidden flex flex-col" data-board>
      {/* THE TOOLBAR — the count, a filter, the scan */}
      <div className="shrink-0 flex items-center gap-3 flex-wrap px-2 py-1.5 bg-panel border-b border-borderSubtle/70" data-board-toolbar>
        {/* The rows are the names the terminal carries — "every name you follow" read as a
            watchlist nobody had made (Noah, 2026-09-09: "i still dont understand what it means") */}
        <span className="font-mono text-[11px] text-textSecondary">The names on your board</span>
        <span className="font-mono text-[11px] text-textMuted tnum" data-board-count>
          {rows.length < names.length
            ? `${rows.length} of ${names.length} names so far`
            : tokens.length
              ? `${shownCount} of ${names.length} names`
              : `${names.length} names`}{' '}
          · closest to its flip first · a name opens on the Map
        </span>
        <input
          value={quick}
          onChange={e => setQuick(e.target.value)}
          placeholder="Filter · SPY QQQ NVDA"
          aria-label="Filter names — as many as you like, spaces or commas between"
          title="As many names as you like, spaces or commas between"
          className="ml-auto w-44 h-7 bg-transparent border border-borderSubtle rounded-md px-2 font-mono text-[11px] text-textPrimary placeholder:text-textMuted focus:outline-none focus:border-silver/50"
          data-board-filter
        />
        <span ref={addRootRef} className="relative inline-flex">
          <button
            ref={addAnchor}
            type="button"
            onClick={() => setAdding(v => !v)}
            aria-expanded={adding}
            title="Add a name to the board"
            className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border bg-chip transition-colors font-mono select-none ${adding ? 'border-silver/50' : 'border-borderSubtle hover:border-borderMuted'}`}
            data-board-add
          >
            <Plus className="w-3 h-3 text-textMuted" />
            <span className="text-[11px] font-semibold text-textPrimary">Add a name</span>
          </button>
          {adding &&
            addPlaced &&
            createPortal(
              <div
                ref={addMenuRef}
                role="dialog"
                aria-label="Add a name to the board"
                style={{ position: 'fixed', ...addPlaced.box }}
                className="z-[120] w-72 border border-borderMuted bg-panel/80 backdrop-blur-xl backdrop-saturate-150 rounded-md shadow-2xl shadow-black/60 overflow-x-hidden overflow-y-auto overscroll-contain animate-slide-in"
                data-board-add-menu
              >
                <div className="px-2.5 py-1.5 border-b border-borderSubtle text-[11px] text-textMuted">Add a name to the board — it stays until you take it off</div>
                <TickerLookup
                  onPick={sym => {
                    addBoardName(sym);
                    setAdding(false);
                  }}
                />
              </div>,
              document.body
            )}
        </span>
        <span className="font-mono text-[11px] text-textMuted tnum">updated {scanAt} · every 10s</span>
      </div>
      {/* The house's board class set its heads in tracked caps (index.css); this board keeps sentence case, the row's
          pointer and the remove door's hover in its own classes */}
      <div className="grid-keys [&_.ag-row]:cursor-pointer [&_[data-board-remove]]:opacity-0 [&_[data-board-remove]]:transition-opacity [&_.ag-row:hover_[data-board-remove]]:opacity-100 [&_.ag-row:focus-within_[data-board-remove]]:opacity-100 [&_[data-board-remove]:focus-visible]:opacity-100">
        <AgGridProvider modules={MODULES}>
          <AgGridReact<BoardRow>
            ref={gridRef}
            theme={THEME}
            domLayout="autoHeight"
            rowData={rows}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            context={gridContext}
            getRowId={p => p.data.ticker}
            onRowClicked={open}
            isExternalFilterPresent={isExternalFilterPresent}
            doesExternalFilterPass={doesExternalFilterPass}
            rowSelection={{ mode: 'singleRow', checkboxes: false, enableClickSelection: true }}
            {...openRowOnEnter<BoardRow>(row => openName(row.ticker))}
            localeText={LOCALE}
            animateRows
            tooltipShowDelay={350}
            tooltipHideDelay={8000}
          />
        </AgGridProvider>
      </div>
    </div>
  );
};

export default Board;
