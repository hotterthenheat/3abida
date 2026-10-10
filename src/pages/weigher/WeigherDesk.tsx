/*
==================================================
  SLAYER TERMINAL - WEIGHER DESK (pages/weigher/WeigherDesk.tsx)

  The Weigher workstation: chart, chain, scanner
  and the weigh station as four cards on one desk,
  on the same plain black canvas as every other page.
==================================================

  STATIC, BY DECREE (Noah, 2026-08-30: "no movementes except for scrolling.
  no dragging things"). This desk spent five days as a movable react-grid-
  layout surface and every session of it bought a new fight — dead-zone
  sashes, drags that stuttered, cards that would not come back up, a reset
  button to apologise for all of it. The layout is now a FIXED FRAME: the
  chart and the chain split the top 60% of the height half-and-half, the
  scanner and the strike read split the bottom 40% the same way, and the
  only thing that moves anywhere is a scrollbar inside a card. Fullscreen
  stays — a takeover is a view, not a rearrangement.

  THE FOUR CARDS, and the loop that makes them one page:
  the scanner picks the NAME → the chain picks the CONTRACT → the chart can
  show either the stock's tape or that contract's modeled premium → the weigh
  station says what the contract costs and what it has to clear. Facts only,
  Term-explained; there is no order entry anywhere because we are not a
  broker (Noah, 2026-08-25: "forget everything related to buy/sell").

  NO MOOD FIELD (Noah, 2026-09-03: "remove the green background effect…
  a regular full black background like the other pages"). For nine days the
  desk sat on a top-anchored red/green/gray wash keyed to the Nasdaq's
  session; it is gone, and the desk sits on the shell's canvas like every
  other page. The session read in the head (label, NDX move, the diverging
  hairline) is now the only place the Nasdaq's direction shows here.
*/

import { memo, startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Maximize2, Minimize2, Plus } from 'lucide-react';
import { type ColDef, type ICellRendererParams, type RowClickedEvent } from 'ag-grid-community';
import { AgGridProvider, AgGridReact } from 'ag-grid-react';
import { GRID_MODULES, GRID_THEME } from '../../components/ui/houseGrid';
import DropdownSelect, { type DropdownOption } from '../../components/ui/DropdownSelect';
import ExpiryCard, { type ExpiryChoice } from '../../components/ui/ExpiryCard';
import DropdownMulti from '../../components/ui/DropdownMulti';
import CardTabs from '../../components/ui/CardTabs';
import GuideFocus, { GuideDoor } from '../../components/ui/GuideFocus';
import CompanyLogo from '../../components/ui/CompanyLogo';
import { Fact } from '../../components/trace/TraceBox';
import { WeigherGuide } from '../../components/weigher/WeigherGuide';
import { TimeframeStrip } from '../../components/gex/ChartToolbar';
import { chartGround, useCandleThemeKey } from '../../components/gex/candleTheme';
import Simulator from '../../core/simulator';
import { onGlide } from '../../core/glide';
import { DOCK_ROOM } from '../../data/editorDock';
import { useMarketData } from '../../context/MarketDataContext';
import { buildLevelsFor, buildPrints, fmtUsd, spotChangePct } from '../../data/gex';
import { estimatePremium } from '../../data/compass';
import { buildDeskChain, buildScan, contractIvFor, dteForDate, deskExpiries, marketMood, marketSession, type DeskContract, type ScanPreset, type ScanRow } from '../../data/weigherDesk';
import { expiryFor, isoDate, today } from '../../core/calendar';
import { addToWatchlist, closeWatched, hasOpenWatched, removeWatched, returnsOf, spotOf, tickWatchlist, useWatchlist, watchedFor } from '../../data/watchlist';
import type { WatchedContract } from '../../types/watchlist';
import { costOf, valueOn } from '../../data/positionCurve';
import { readPosition, removePosition, useAllPositions, type Position, type Verdict } from '../../data/positions';
import { buildBook } from '../../data/bookAtStrike';
import BookBlock from '../../components/weigher/BookBlock';
import PositionForm from '../../components/gex/PositionForm';
import PositionDeskCard from '../../components/weigher/PositionDeskCard';
import { monthDay, ListGrid, type ListRow } from '../../components/weigher/PositionsList';
import { buildExposureProfile } from '../../data/exposure';
import type { ExposureProfileData } from '../../types/gex';
import { useIsBelowLg } from '../../components/ui/useMediaQuery';
import { DESK_TOP_DEFAULT, clampDeskTop, deskRows, readDeskTop, saveDeskTop } from './deskSplit';
import { readDeskPrefs } from '../../data/deskPrefs';
import StrikeChart, {
  DEFAULT_INDICATORS,
  DEFAULT_OVERLAYS,
  type ChartIndicators,
  type ChartOverlays,
  type ChartStyle,
} from '../../components/gex/StrikeChart';
import ChartToolbar from '../../components/gex/ChartToolbar';
import TickerQuickPick from '../../components/gex/TickerQuickPick';
import { ChartSkeleton, Deferred } from '../../components/ui/Skeleton';
import SpotPrice from '../../components/gex/SpotPrice';
import ContractPremiumPane from '../../components/gex/ContractPremiumPane';
import { useFadeClose } from '../../components/ui/useFadeClose';
import { fmtStrike, CHAIN_COLUMNS, DEFAULT_COLS, COLUMN_GROUPS, ChainCard } from '../../components/weigher/ChainGrid';
import VolCurves from '../../components/weigher/VolCurves';
import type { Timeframe } from '../../data/timeframe';
import type { OptionRight } from '../../types/compass';
import ProductGlyph from '../../brand/ProductGlyph';

/* Still v2 on purpose: the desk went static (2026-08-30) and the stored
   `layout` field simply stopped being read — but the tickers, columns, depth
   and every other choice in the same record survive the change untouched. */
const DESK_KEY = 'slayer_weigher_desk_v2';

/** The heavy tables' sweep cadence — the chain and scanner rebuild on this
    clock and hold still in between, the Pulse contract. Charts and prices
    stay on the 1s tick. */
const SCAN_MS = 3000;

/** How far the chain reaches each side of spot. The book maintains ~30; the
    ladder synthesizes honest wings beyond it (see buildDeskChain). Sized to
    read like a FULL listed chain — Robinhood shows SPY roughly ±150 strikes,
    and Noah asked twice (2026-08-25: "WAYY more", then "add more strikes
    please"). The second ask was a migration bug wearing a feature-request
    coat: his stored depth (30) was still on the previous list, so it
    validated and never fell forward. No old value (10/15/20/30/50/80) is on
    THIS list, so every stored depth migrates to the new default. */
const DESK_DEPTHS = [100, 150, 250, 400] as const;

/* THE CARDS (the walk, 2026-09-11): the chain's chip rows — Calls/Puts, eight
   expiries, four reaches, the columns door — and the scanner's three chips
   became one line of labelled cards each, the house grammar (Noah, 2026-09-05:
   dropdown cards, never chip rows). */
const SIDE_OPTIONS: DropdownOption<OptionRight>[] = [
  { value: 'C', label: 'Calls', hint: 'The right to buy', tone: 'bull' },
  { value: 'P', label: 'Puts', hint: 'The right to sell', tone: 'bear' },
];
/* THE CHAIN HEAD'S ROOM, in px of card (measured 2026-09-20 with the longest everyday values — a five-letter name, a
   "Sep 22 · Tue" expiry, "Mark, Delta +4"): the whole line on one row needs ~760; the four NAMED cards on a row of their
   own need ~590; under that they go bare (~395). A little air on each so a longer value does not break the row. */
const CHAIN_ONE_ROW_PX = 790;
const CHAIN_NAMED_ROW_PX = 610;

const REACH_OPTIONS: DropdownOption<number>[] = DESK_DEPTHS.map(d => ({ value: d, label: `±${d}`, hint: `${d} strikes each side of the market` }));
/** What the desk's list card lists: THE WATCHLIST first (Noah, 2026-09-14 — Robinhood's list
    on the desk: every watched contract, marked when added, tracked as if bought), then the
    scanner's three cuts. The card opens on the watchlist whenever anything is watched. */
type ListKind = ScanPreset | 'watchlist';
/** Which of the bottom row's three cards stand folded to their heads (kept in `slayer_weigher_folds`):
    Your positions · the Watchlist · The position */
type Folds = { positions: boolean; watchlist: boolean; position: boolean };
const KIND_OPTIONS: DropdownOption<ListKind>[] = [
  { value: 'watchlist', label: 'Watchlist', hint: 'The contracts you watch — marked when added, tracked as if bought' },
  { value: 'gainers', label: 'Gainers today', hint: 'The largest gains this session first', tone: 'bull' },
  { value: 'losers', label: 'Losers today', hint: 'The largest losses this session first', tone: 'bear' },
  { value: 'voliv', label: 'Busiest options', hint: 'The most contracts traded, the priciest vol first' },
];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDay = (d: Date) => `${MONTHS[d.getMonth()]} ${d.getDate()}`;

interface DeskState {
  ticker: string;
  dte: number;
  /** stock · the picked contract's premium · the vol view (the smile and the term) */
  lens: 'stock' | 'contract' | 'vol';
  right: OptionRight;
  preset: ListKind;
  depth: number;
  /** Which catalog columns the chain shows, in catalog order */
  cols: string[];
}

/* An old record may still carry `layout`/`rowsV`/`colsV` from the movable
   era — parsed and ignored here, and the next save sheds them for good. */
function loadDesk(): DeskState {
  const def: DeskState = { ticker: 'SPY', dte: 2, lens: 'stock', right: 'C', preset: 'watchlist', depth: 150, cols: DEFAULT_COLS };
  /* the list card opens on the watchlist whenever anything is watched — Robinhood's list is
     always the first thing on the page; the reader's cut holds for the session after that */
  const opensOnList = (d: DeskState): DeskState => (hasOpenWatched() ? { ...d, preset: 'watchlist' } : d);
  try {
    const raw = localStorage.getItem(DESK_KEY);
    if (!raw) return def;
    const c = JSON.parse(raw) as Partial<DeskState>;
    // Stored columns keep only keys the catalog still knows, in its order;
    // an empty or unknown set falls back to the default chain.
    const storedCols = Array.isArray(c.cols) ? (c.cols as string[]) : null;
    const cols = storedCols ? CHAIN_COLUMNS.map(x => x.key).filter(k => storedCols.includes(k)) : [];
    return opensOnList({
      ticker: typeof c.ticker === 'string' && c.ticker ? c.ticker : def.ticker,
      /* any horizon inside ninety days — a contract's own expiry, carried in
         by a deep link, is kept across a refresh (2026-09-12) */
      dte: typeof c.dte === 'number' && Number.isInteger(c.dte) && c.dte >= 0 && c.dte <= 90 ? c.dte : def.dte,
      lens: c.lens === 'contract' ? 'contract' : c.lens === 'vol' ? 'vol' : 'stock',
      right: c.right === 'P' ? 'P' : 'C',
      preset: c.preset === 'losers' || c.preset === 'voliv' || c.preset === 'gainers' || c.preset === 'watchlist' ? c.preset : def.preset,
      depth: typeof c.depth === 'number' && (DESK_DEPTHS as readonly number[]).includes(c.depth) ? c.depth : def.depth,
      cols: cols.length ? cols : [...def.cols],
    });
  } catch {
    return def;
  }
}

/* ---- the card shell --------------------------------------------------------
   The cards keep their translucent fill from the wash days, but not the
   backdrop blur: with the wash gone (2026-09-03) there is nothing under a
   card but the shell's flat canvas, and a backdrop-filter over a flat ground
   is a compositing cost that paints nothing. */
/* The card is a PANEL (2026-09-12): the 55% near-black wash it wore read as
   the same panel on the dark canvas and as a mid-grey slab on the light one */
const DeskCard = ({
  title,
  actions,
  under,
  children,
  fold,
}: {
  title?: string;
  actions?: React.ReactNode;
  /** A SECOND HEAD ROW, under the title's (the chain's cards when the card is too narrow for one line — see
      `CHAIN_ONE_ROW_PX`): one block with the first, so the rule between the head and the body moves under it */
  under?: React.ReactNode;
  children: React.ReactNode;
  /** A card that folds to its head (the three cards of the bottom row, 2026-09-14): the chevron
      beside the title. The two list cards fold through their column's rows (the cell shrinks,
      the card is clipped); a card that folds ITSELF (`self` — the position card, whose row is as
      tall as it is) glides its body from its height to nothing and stands at its own height. */
  fold?: { open: boolean; onToggle: () => void; testId?: string; self?: boolean };
}) => (
  <div className={`${fold?.self ? '' : 'h-full '}flex flex-col overflow-hidden rounded-md border border-ink/[0.07] bg-panel`} data-folded={fold && !fold.open ? '' : undefined}>
    {/* min-h, not h: a crowded actions strip (the chain's) wraps, and the
        header must GROW with it — with a fixed height the wrapped chips
        slid under the table and its sticky header ate their clicks. */}
    <div className={`shrink-0 flex items-center gap-2 pr-2.5 py-0.5 min-h-8 ${under ? '' : 'border-b border-ink/[0.05]'}`}>
      {/* The title takes its NATURAL width and keeps it — flex-1 here let the
          chain's loaded strip squeeze it down to "C…". The actions take the
          remainder and wrap; the header grows to fit them. (The drag grip
          that lived here died with the movable desk, 2026-08-30.) */}
      <div className="select-none flex items-center gap-2 pl-2.5 self-stretch shrink-0">
        {fold && (
          <button
            type="button"
            onClick={fold.onToggle}
            aria-expanded={fold.open}
            title={fold.open ? 'Fold the card to its head' : 'Open the card'}
            className="hit inline-flex items-center justify-center w-4 h-4 -ml-1 rounded text-textMuted hover:text-textPrimary hover:bg-ink/[0.06] transition-colors"
            data-fold={fold.testId}
          >
            <ChevronDown className={`w-3 h-3 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${fold.open ? '' : '-rotate-90'}`} />
          </button>
        )}
        {title && (
          <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-textPrimary whitespace-nowrap">{title}</span>
        )}
      </div>
      {/* NO overflow-x-auto here: overflow-x forces overflow-y clipping too,
          and it cut the chain's ticker dropdown to a 26px sliver below the
          header (Noah, 2026-08-25: "the chain ticker should have the same
          dropdown as the chart ticker" — it always was the same menu, just
          decapitated). Wide strips wrap instead; the header grows. */}
      {actions && (
        <span className="ml-auto flex flex-1 flex-wrap items-center justify-end gap-1.5 min-w-0">{actions}</span>
      )}
    </div>
    {under && (
      <div className="shrink-0 flex flex-wrap items-center gap-1.5 px-2.5 pb-1.5 border-b border-ink/[0.05]" data-card-under>
        {under}
      </div>
    )}
    {fold?.self ? (
      /* the body on one grid row, 1fr open and 0fr folded — the same glide the left column's rows
         ride; the content stays mounted (the chart, the ruler, the tab keep their state) and is
         clipped while folded */
      <div className="flex-grow min-h-0 grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]" style={{ gridTemplateRows: fold.open ? '1fr' : '0fr' }} data-fold-body>
        <div className="min-h-0 overflow-hidden">{children}</div>
      </div>
    ) : (
      <div className="flex-grow min-h-0">{children}</div>
    )}
  </div>
);

/* ---- the chain card -------------------------------------------------------- */
/* ---- the scanner as a grid -------------------------------------------------- */
const SCAN_THEME = GRID_THEME.withParams({ rowHeight: 34, headerHeight: 28, fontSize: 11 });
const SCAN_COL: ColDef<ScanRow> = { sortable: false, resizable: false, suppressMovable: true };
const SCAN_EMPTY: Record<ScanPreset, string> = { gainers: 'No names up today', losers: 'No names down today', voliv: 'Nothing on the tape' };

export const ScanGrid = memo(function ScanGrid({ rows, ticker, preset, onPick }: { rows: ScanRow[]; ticker: string; preset: ScanPreset; onPick: (t: string) => void }) {
  const gridRef = useRef<AgGridReact<ScanRow>>(null);
  const columnDefs = useMemo<ColDef<ScanRow>[]>(
    () => [
      {
        colId: 'ticker',
        headerName: 'Name',
        flex: 1.3,
        minWidth: 110,
        cellRenderer: ({ data }: ICellRendererParams<ScanRow>) =>
          data ? (
            <span className="inline-flex items-center gap-2">
              <CompanyLogo ticker={data.ticker} size={16} />
              <span className="font-mono text-[11px] font-semibold text-textPrimary" data-scan-name>
                {data.ticker}
              </span>
            </span>
          ) : null,
      },
      { colId: 'last', headerName: 'Last', width: 88, type: 'rightAligned', cellRenderer: ({ data }: ICellRendererParams<ScanRow>) => (data ? <span className="font-mono text-[11px] tnum text-textPrimary">${data.last.toFixed(2)}</span> : null) },
      {
        colId: 'change',
        headerName: 'Change',
        width: 88,
        type: 'rightAligned',
        cellRenderer: ({ data }: ICellRendererParams<ScanRow>) =>
          data ? (
            <span className={`font-mono text-[11px] font-semibold tnum ${data.changePct >= 0 ? 'text-bull' : 'text-bear'}`}>
              {data.changePct >= 0 ? '+' : ''}
              {data.changePct.toFixed(2)}%
            </span>
          ) : null,
      },
      { colId: 'optvol', headerName: 'Opt vol', width: 88, type: 'rightAligned', headerTooltip: "Contracts traded today across the name's chain", cellRenderer: ({ data }: ICellRendererParams<ScanRow>) => (data ? <span className="font-mono text-[11px] tnum text-textSecondary">{fmtUsd(data.optVolume).replace('$', '')}</span> : null) },
      { colId: 'iv', headerName: 'IV', width: 64, type: 'rightAligned', cellRenderer: ({ data }: ICellRendererParams<ScanRow>) => (data ? <span className="font-mono text-[11px] tnum text-textSecondary">{data.ivPct.toFixed(1)}%</span> : null) },
    ],
    []
  );
  /* The desk's name wears the house selection — synced once the grid has
     its rows (the first effect fires before the grid exists) */
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const api = gridRef.current?.api;
    if (!api || !ready) return;
    api.forEachNode(n => {
      const on = n.data?.ticker === ticker;
      if (n.isSelected() !== on) n.setSelected(on);
    });
  }, [ticker, rows, ready]);
  return (
    <div className="slayer-board h-full" data-scan-grid={preset}>
      <AgGridProvider modules={GRID_MODULES}>
        <AgGridReact<ScanRow>
          ref={gridRef}
          theme={SCAN_THEME}
          rowData={rows}
          columnDefs={columnDefs}
          defaultColDef={SCAN_COL}
          getRowId={p => p.data.ticker}
          onRowClicked={(e: RowClickedEvent<ScanRow>) => e.data && onPick(e.data.ticker)}
          rowSelection={{ mode: 'singleRow', checkboxes: false, enableClickSelection: false }}
          suppressCellFocus
          animateRows={false}
          onFirstDataRendered={() => setReady(true)}
          tooltipShowDelay={350}
          overlayNoRowsTemplate={`<span class="font-mono text-[10px] uppercase tracking-widest text-textMuted">${SCAN_EMPTY[preset]}</span>`}
        />
      </AgGridProvider>
    </div>
  );
});

/** One chain row, with the spot rule under it when it brackets the market.
    Clicking it puts the strike ON THE SCALE - the Strike card carries the
    weigh-up now, so the ladder itself stays clean. */
/* The contract capsule's OWN menu (Noah, 2026-08-27: "i shoudnt be shown
   tickers, rather i should be shown the strikes i can click on") - in the
   contract lens the capsule's job is stepping between CONTRACTS, so its
   door lists the chain's strikes, opened with the one on the scale centred.
   The ticker door still lives where tickers are the subject: the stock
   lens and the chain header. */
const StrikePickInner = ({
  label,
  contracts,
  sel,
  onPick,
}: {
  label: string;
  contracts: DeskContract[];
  sel: number | null;
  onPick: (strike: number) => void;
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    // Window-capture Escape - the TickerQuickPick contract: the innermost
    // open thing gets the key and nothing behind it sees it.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  // The menu opens with the selection in the MIDDLE - stepping strikes
  // should feel like nudging a dial, not re-finding your place in a list.
  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'center' });
    });
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        title="Switch strike"
        className="inline-flex items-center justify-between gap-2 h-7 min-w-[112px] px-3 rounded-full bg-ink/[0.06] hover:bg-ink/[0.10] font-mono text-[11px] font-bold text-textPrimary transition-colors"
      >
        {label}
        <ChevronDown className={`w-3 h-3 text-textSecondary transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-40 w-52 border border-borderMuted bg-panel rounded-md shadow-2xl shadow-black/60 overflow-hidden animate-slide-in">
          <div className="px-3 py-1.5 border-b border-borderSubtle flex items-center justify-between font-mono text-[9px] font-semibold uppercase tracking-widest text-textMuted select-none">
            <span>Strike</span>
            <span>Mark</span>
          </div>
          <div ref={listRef} className="max-h-72 overflow-y-auto py-1">
            {[...contracts].reverse().map(c => {
              const active = sel != null && Math.abs(c.strike - sel) < 1e-9;
              return (
                <button
                  key={c.strike}
                  aria-selected={active}
                  onClick={() => {
                    setOpen(false);
                    onPick(c.strike);
                  }}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-1 font-mono text-[11px] tnum transition-colors ${
                    active ? 'bg-silver/[0.08] text-silver font-bold' : 'text-textPrimary hover:bg-ink/[0.04]'
                  }`}
                >
                  <span>{fmtStrike(c.strike)}</span>
                  <span className={active ? '' : 'text-textSecondary'}>${c.mark.toFixed(2)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};


/* The picker lists 301 strikes while open; memoised so a light tick does not
   re-render the whole list under the pointer. Its props are stable: the
   side's contracts are memoised on the desk, onPick is the setter itself. */
const StrikePick = memo(StrikePickInner);

/* THE DESK'S ONLY EAR ON THE MARKET TICK, kept in a leaf. The context hands
   every subscriber a new value each 1.5s; if the desk itself subscribed, a
   tick it chose to STASH (pointer down) would still re-render the whole
   desk for nothing. This null component takes the hit instead — the desk
   renders once per APPLIED tick, through its own state, as a transition. */
const TickPump = memo(function TickPump({ onTick }: { onTick: () => void }) {
  const { marketData } = useMarketData();
  useEffect(() => {
    onTick();
  }, [marketData, onTick]);
  return null;
});

/* ---- the desk -------------------------------------------------------------- */
/** What a deep link may carry: a name alone (Trace's "Weigh it"), or THE
    contract — the Record's busiest rows (2026-09-12): the side and the
    expiry DATE ("2026-09-18") pick the chain, the strike picks the row */
export interface WeighRequest {
  ticker: string;
  strike?: number;
  right?: 'C' | 'P';
  expiry?: string;
}

const WeigherDesk = ({ incoming }: { incoming?: WeighRequest | null }) => {
  /* TWO TIERS, the Pulse rule (Noah, 2026-08-27: "i dont ever have this
     problem with the pulse page"): the light tick runs every snapshot and
     feeds the cheap live readouts — prices, the mood, the charts' bar
     appends. The SCAN tick sweeps every few seconds and feeds the heavy
     rebuilds — the 301-strike chain and the scanner. (The mid-drag freeze
     that used to ride here died with the movable desk.) */
  const [tick, setTick] = useState(0);
  const [scanTick, setScanTick] = useState(0);
  const lastScanRef = useRef(0);
  /* The chart's chrome wears the ground of the tape's theme (the store's, on this desk —
     index.css re-scopes the strip's tokens under the stamp; 2026-09-13) */
  const chartThemeKey = useCandleThemeKey();
  /* Both tiers publish as TRANSITIONS (Noah, 2026-08-30): the scan tick
     rebuilds a 301-row chain and the scanner — a 54–103ms render measured
     at idle. As urgent updates those blocked the very click they landed
     under; as transitions React yields to the click first and finishes the
     sweep after. Same data, same cadence, no frozen frame. */
  const applyTick = useCallback(() => {
    const now = Date.now();
    const sweep = now - lastScanRef.current >= SCAN_MS;
    if (sweep) lastScanRef.current = now;
    startTransition(() => setTick(t => t + 1));
    /* The sweep lands a frame AFTER the light tick, never in the same
       commit: measured on release after a long drag, the two together were
       one 87ms task — the cheap readouts waiting on the 301-row rebuild.
       Apart, the release paints at once and the sweep follows. */
    if (sweep) window.setTimeout(() => startTransition(() => setScanTick(t => t + 1)), 32);
  }, []);
  /* NO TICK UNDER THE HAND, desk-wide (Noah, 2026-08-30: "i was in the middle
     of a drag and it practically ignored me and changed my view"). Measured
     with the button held down on the chart: even with the chart's own
     effects held, the light tick and the sweep still landed as 51ms and 85ms
     tasks — the desk re-rendering under a drag. So while any pointer is down
     on the page, ticks are stashed; the newest is applied on release. A
     click holds them for the ~100ms it lasts, a drag for as long as it
     takes, and the data is never stale by more than the gesture. */
  const pointerDownRef = useRef(false);
  const pendingTickRef = useRef(false);
  const onTick = useCallback(() => {
    if (pointerDownRef.current) {
      pendingTickRef.current = true;
      return;
    }
    applyTick();
  }, [applyTick]);
  useEffect(() => {
    const down = () => {
      pointerDownRef.current = true;
    };
    const up = () => {
      if (!pointerDownRef.current) return;
      pointerDownRef.current = false;
      if (pendingTickRef.current) {
        pendingTickRef.current = false;
        applyTick();
      }
    };
    window.addEventListener('pointerdown', down, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', up, true);
    return () => {
      window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', up, true);
    };
  }, [applyTick]);

  const [desk, setDesk] = useState<DeskState>(loadDesk);
  const [sel, setSel] = useState<number | null>(null);
  /* opens on the desk's timeframe when the reader set one (Settings › The desk) */
  const [timeframe, setTimeframe] = useState<Timeframe>(() => readDeskPrefs().opensOn.timeframe ?? '1m');
  const [overlays, setOverlays] = useState<ChartOverlays>(DEFAULT_OVERLAYS);
  const [chartStyle, setChartStyle] = useState<ChartStyle>('candles');
  const [indicators, setIndicators] = useState<ChartIndicators>(DEFAULT_INDICATORS);

  useEffect(() => {
    try {
      localStorage.setItem(DESK_KEY, JSON.stringify(desk));
    } catch {
      /* storage can be full or off — never fatal */
    }
  }, [desk]);

  const { ticker, dte, lens, right, preset, depth, cols } = desk;
  const patch = (p: Partial<DeskState>) => setDesk(d => ({ ...d, ...p }));

  const mood = useMemo(() => marketMood(), [tick]);
  const session = useMemo(() => marketSession(), [tick]);
  const chain = useMemo(() => buildDeskChain(ticker, dte, depth), [ticker, dte, depth, scanTick]); // eslint-disable-line react-hooks/exhaustive-deps
  const scan = useMemo(() => (preset === 'watchlist' ? [] : buildScan(preset, ticker)), [preset, ticker, scanTick]); // eslint-disable-line react-hooks/exhaustive-deps
  const levels = useMemo(() => buildLevelsFor(ticker), [ticker, tick]);
  const changePct = useMemo(() => spotChangePct(ticker), [ticker, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const prints = useMemo(() => buildPrints(ticker, levels.spot), [ticker]); // eslint-disable-line react-hooks/exhaustive-deps
  /* The rail's expiries — and the one a deep link asked for when the rail
     does not list it (a contract's own Friday), in date order */
  const expiries = useMemo(() => {
    const rail = deskExpiries();
    if (rail.some(e => e.dte === dte)) return rail;
    return [...rail, expiryFor(dte)].sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [dte]);
  /* The expiries as dates (Noah, 2026-09-08 on the Map: "it just says 1d 2d 3d") */
  const expiryOptions = useMemo<ExpiryChoice<number>[]>(
    () =>
      expiries.map(e => ({
        value: e.dte,
        label: e.dte === 0 ? `Today · ${fmtDay(e.date)}` : `${fmtDay(e.date)} · ${e.weekday}`,
        hint: e.dte === 0 ? 'The contracts that expire at the bell' : `${e.dte} days out · ${e.sessions} ${e.sessions === 1 ? 'session' : 'sessions'}`,
        date: e.date,
      })),
    [expiries]
  );
  const shownCols = useMemo(() => CHAIN_COLUMNS.filter(c => cols.includes(c.key)), [cols]);
  // One array per chain per side — the picker's memo depends on this identity.
  const sideContracts = useMemo(() => chain.rows.map(r => (right === 'C' ? r.call : r.put)), [chain, right]);

  /* FULLSCREEN takeovers (Noah, 2026-08-27: "make the ability for the chart
     to be full screen.... same with the chain") — the pressure ladder's
     grammar: portal to <body>, Esc exits on a fade, page scroll locks
     underneath. One card at a time; its grid cell goes blank behind the
     takeover so no chart runs twice. */
  const [full, setFull] = useState<'chart' | 'chain' | null>(null);
  /* the chain card's measured width — what its head lays itself out by (see `chainHead`); read before the first paint,
     so the head never opens broken and then mends itself */
  const chainRO = useRef<ResizeObserver | null>(null);
  const [chainW, setChainW] = useState(0);
  const chainBoxRef = useCallback((el: HTMLDivElement | null) => {
    chainRO.current?.disconnect();
    chainRO.current = null;
    if (!el) return;
    setChainW(Math.round(el.getBoundingClientRect().width));
    const ro = new ResizeObserver(entries => setChainW(Math.round(entries[0].contentRect.width)));
    ro.observe(el);
    chainRO.current = ro;
  }, []);
  const [guideOpen, setGuideOpen] = useState(false);
  const { closing, close } = useFadeClose(() => setFull(null));
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => {
      // A modal over the takeover took the key already (Modal marks it)
      if (e.key === 'Escape' && !e.defaultPrevented) close();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [full, close]);

  const fullBtn = (card: 'chart' | 'chain') => (
    <button
      onClick={() => setFull(card)}
      title={card === 'chart' ? 'Fullscreen chart' : 'Fullscreen chain'}
      aria-label={card === 'chart' ? 'Fullscreen chart' : 'Fullscreen chain'}
      className="hit p-1 rounded text-textMuted hover:text-textPrimary hover:bg-ink/[0.05] transition-colors"
    >
      <Maximize2 className="w-3 h-3" />
    </button>
  );

  const selected: DeskContract | null = useMemo(() => {
    if (sel == null) return null;
    const row = chain.rows.find(r => Math.abs(r.strike - sel) < 1e-9);
    return row ? (right === 'C' ? row.call : row.put) : null;
  }, [chain, sel, right]);

  const pickTicker = (t: string) => {
    if (t === ticker) return;
    Simulator.ensureTicker(t);
    setSel(null);
    setListSel(null);
    patch({ ticker: t, lens: lens === 'vol' ? 'vol' : 'stock' });
  };

  /* A deep link arrives with a name (Trace's "Weigh it") — or with a CONTRACT
     (the Record's busiest rows, 2026-09-12). It repoints the desk once; after
     that the desk's own pickers own the ticker again, and the stored desk
     state carries it to the next visit. A contract also sets the side and the
     nearest listed expiry, and asks for its strike. */
  const [pendingPick, setPendingPick] = useState<{ ticker: string; dte: number; strike: number } | null>(null);
  /* THE LIST'S PICK — the row the reader pressed on the positions or the watchlist card; the card draws it until the
     reader presses a strike on the chain or moves the desk to another name (declared here so those pickers can let it go) */
  const [listSel, setListSel] = useState<string | null>(null);
  /* POINT THE DESK AT A CONTRACT — the deep link's move, and a watchlist row's (2026-09-14) */
  const pointTo = useCallback(
    (req: WeighRequest) => {
      const t = req.ticker;
      Simulator.ensureTicker(t);
      setSel(null);
      /* the contract's OWN expiry, as the desk's horizon for that date — listed
         on the rail when the rail has it, added to the rail when it does not */
      const near = req.expiry ? dteForDate(req.expiry) : null;
      setPendingPick(req.strike == null ? null : { ticker: t, dte: near ?? dte, strike: req.strike });
      patch({ ticker: t, lens: 'stock', ...(req.right ? { right: req.right } : {}), ...(near != null ? { dte: near } : {}) });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dte]
  );
  useEffect(() => {
    if (incoming) pointTo(incoming);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incoming]);
  /* The pick lands once the chain for THAT name and expiry is up — on the
     row's own strike when the chain lists it, else the nearest listed one */
  const [reveal, setReveal] = useState<{ strike: number; n: number } | null>(null);
  useEffect(() => {
    if (!pendingPick || pendingPick.ticker !== ticker || pendingPick.dte !== dte || !chain.rows.length) return;
    const want = pendingPick.strike;
    const nearest = chain.rows.reduce((best, r) => (Math.abs(r.strike - want) < Math.abs(best.strike - want) ? r : best), chain.rows[0]);
    setPendingPick(null);
    setSel(nearest.strike);
    /* and the chain scrolls to it, its weigh-up open — not to the market */
    setReveal(r => ({ strike: nearest.strike, n: (r?.n ?? 0) + 1 }));
  }, [pendingPick, chain, ticker, dte]);

  /* ONE click weighs, TWO clicks chart (Noah, 2026-08-26: "a double click of
     the chain should change the live chart to the contract one and one click
     shows the strike info at the bottom"). The single click only moves the
     Strike card; the chart keeps whatever lens it had — except when the
     click CLEARS the selection, because a contract lens with no contract has
     nothing to show and falls back to the stock tape. */
  /* What the last single click did, and when — the double-click rule below
     needs to know whether the first click of a pair CLOSED the row. */
  const lastToggle = useRef<{ strike: number; off: boolean; at: number } | null>(null);
  const pickStrike = useCallback((strike: number, clicks = 1) => {
    /* the reader's own press on the chain — the card follows the chain again */
    setListSel(null);
    if (clicks >= 2) {
      /* A quick re-click on the OPEN row arrives as the second click of a
         double (e.detail 2): the first click closed the row, and treating the
         second as "chart it" re-opened it and flipped the chart (Noah,
         2026-09-11: "sometimes the reclick doesnt allow the dropdown to go
         back up making me click in 2 or 3 times"). If the first click of
         this pair closed this strike, the row stays closed — the double
         click charts a row from CLOSED (the first click opens it, the second
         charts it), never from open. */
      const last = lastToggle.current;
      if (last && last.off && Math.abs(last.strike - strike) < 1e-9 && Date.now() - last.at < 700) return;
      setSel(strike);
      setDesk(d => ({ ...d, lens: 'contract' }));
      return;
    }
    setSel(cur => {
      const next = cur != null && Math.abs(cur - strike) < 1e-9 ? null : strike;
      lastToggle.current = { strike, off: next == null, at: Date.now() };
      if (next == null) setDesk(d => (d.lens === 'contract' ? { ...d, lens: 'stock' } : d));
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tYears = Math.max(chain.expiry.sessions, 0.5) / 252;

  /* Floating identity, defined once and rendered inside EACH lens's chart
     box — over the plot, below the toolbar (it was landing on the Tools
     row). */
  // The name leads the toolbar row (Noah, 2026-08-25: "right next to the
  // timeframes on the left, pushing the timeframes and tools down to the
  // right") - an inline group, nothing floating.
  const identity = (
    <span className="inline-flex items-center gap-2 select-none shrink-0">
      <TickerQuickPick ticker={ticker} onPick={pickTicker} />
      <SpotPrice value={Simulator.TICKERS[ticker]?.currentPrice ?? chain.spot} />
      <span className={`font-mono text-[11px] font-semibold tnum ${changePct >= 0 ? 'text-bull' : 'text-bear'}`}>
        {changePct >= 0 ? '\u25b2' : '\u25bc'} {changePct >= 0 ? '+' : ''}
        {changePct.toFixed(2)}%
      </span>
    </span>
  );

  /* In the contract lens the strip speaks the CONTRACT (Noah, 2026-08-26:
     "it should say 'spy 507 call' with the price ticker being changed from
     the stock price to the contract changing price") \u2014 same capsule, same
     ticker door behind it, but the name is the whole contract and the tick
     is its mark against yesterday's modeled close, the reference's own
     "$0.38 \u25bc $0.07 (15.56%)" grammar. */
  /* The chain sweeps every few seconds, but the capsule's price must tick
     with the tape — one contract re-priced per second is cheap; 602 are
     not. Same estimator, same smile, so the sweep never disagrees with it. */
  const liveMark = useMemo(() => {
    if (sel == null || !selected) return null;
    const spotNow = Simulator.TICKERS[ticker]?.currentPrice ?? chain.spot;
    return Number(estimatePremium(spotNow, sel, right, contractIvFor(ticker, sel, right), tYears).toFixed(2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, right, ticker, selected, tick]);

  const shownMark = liveMark ?? selected?.mark ?? 0;
  const contractChg = selected ? shownMark - selected.prevClose : 0;
  const contractChgPct = selected && selected.prevClose > 0 ? (contractChg / selected.prevClose) * 100 : 0;
  const contractIdentity = selected != null && sel != null && (
    <span className="inline-flex items-center gap-2 select-none shrink-0">
      <StrikePick
        label={`${ticker} ${fmtStrike(sel)} ${right === 'C' ? 'Call' : 'Put'}`}
        contracts={sideContracts}
        sel={sel}
        onPick={setSel}
      />
      <SpotPrice value={shownMark} />
      <span className={`font-mono text-[11px] font-semibold tnum ${contractChg >= 0 ? 'text-bull' : 'text-bear'}`}>
        {/* signed, as everywhere (the audit's WE-7: "▼ $0.54 (91.53%)") */}
        {contractChg >= 0 ? '\u25b2' : '\u25bc'} {contractChg >= 0 ? '+' : '−'}${Math.abs(contractChg).toFixed(2)} ({contractChgPct >= 0 ? '+' : '−'}
        {Math.abs(contractChgPct).toFixed(2)}%)
      </span>
    </span>
  );

  /* The Stock/Premium door in the strip's SECOND slot, the setup page's
     grammar (2026-09-11: "a control never changes side") — it used to sit at
     the far right and say Contract. Premium needs a picked contract; with
     none picked the door stays on Stock. */
  const lensTabs = (
    <CardTabs
      ariaLabel="Chart view"
      options={[
        { value: 'stock', label: 'Stock' },
        { value: 'contract', label: 'Premium' },
        /* the smile and the term (the ideas report, 2026-10-09) */
        { value: 'vol', label: 'Vol' },
      ]}
      value={lens}
      onChange={v => (v === 'contract' ? selected && patch({ lens: 'contract' }) : patch({ lens: v === 'vol' ? 'vol' : 'stock' }))}
    />
  );

  /* The card bodies live in consts so the SAME JSX serves the grid cell and
     the fullscreen takeover — one source, two frames, no drift. */
  /*
    THE PULSE GRAMMAR, applied here (Noah, 2026-08-29: "the weigher chart is
    currently having the same problem as we prev did with the pulse charts.
    i clearly see padding on all 4 sides. the bar up top is not translucent
    ... basically 2 rows of top sections instead of one"):

    - the tape is EDGE TO EDGE — absolute inset-0, no header rows in flow;
    - ONE strip, fused to the top, translucent over the tape (the card's own
      surface at its own alpha + blur, so there is no second black);
    - everything that lived on the old two rows rides that strip: the drag
      grip, the identity, the toolbar, the Stock/Contract lens chips, and
      the fullscreen door — which becomes the minimize door IN fullscreen,
      because the takeover shows this same body and a Back row over it was
      the second row Noah counted.
  */
  const chartStrip = (
    <div
      /* NO band (Noah, 2026-08-29, after two alpha attempts: "i beg to
         differ" — a dark wash over a dark tape IS a solid box; there is
         nothing behind it for translucency to reveal). The Terrain floating
         chrome grammar instead: the strip is transparent and each control
         carries its own pill, so the tape runs untouched to the card's top
         edge. */
      /* CLEAR OF THE PRICE AXIS (Noah, 2026-08-30: the lens chips and the
         fullscreen door read as "overbleeding the price axis"). The strip
         spans the card, so its right cluster used to land on the axis
         column; a right inset the width of that column keeps every control
         inside the plot, where the tape is, and off the numbers. */
      /* pr-[68px], down from 76 (2026-09-13): the axis column is 54, so 14px
         stays clear of it — and the 8px is what keeps the whole strip on ONE
         row at 1905 now that the toolbar no longer squeezes (below). */
      className="absolute top-0 inset-x-0 z-20 flex flex-wrap items-center gap-x-2.5 gap-y-1 pl-2 pr-[68px] py-1 select-none"
      /* Floating chrome the chart's scripts legend measures and sits under (2026-09-10) */
      data-chart-chrome
    >
      {/* THE SAME STRIP AS PULSE, slot for slot (the walk, 2026-09-11): the
          identity, the Stock/Premium door, then the toolbar — timeframes,
          overlays, indicators, alerts, theme — and the expand door last. On
          the half-width card the toolbar drops its words (compact icons); in
          fullscreen it wears Pulse's full words. Replay and the drawing rail
          stay off: review tools, not weighing tools. */}
      {lens === 'vol' ? (
        <>
          {identity}
          {lensTabs}
          <span className="ml-auto flex items-center gap-1.5">
            {full === 'chart' ? (
              <button onClick={close} title="Exit fullscreen (Esc)" aria-label="Exit fullscreen" className="hit p-1 rounded text-textMuted hover:text-textPrimary hover:bg-ink/[0.05] transition-colors">
                <Minimize2 className="w-3 h-3" />
              </button>
            ) : (
              fullBtn('chart')
            )}
          </span>
        </>
      ) : lens === 'contract' && selected != null && sel != null ? (
        <>
          {contractIdentity}
          {lensTabs}
          <TimeframeStrip value={timeframe} onChange={setTimeframe} />
          {/* The premium lens has no toolbar to carry the door, so it stands alone at the end */}
          <span className="ml-auto flex items-center gap-1.5">
            {full === 'chart' ? (
              <button
                onClick={close}
                title="Exit fullscreen (Esc)"
                className="p-1 rounded text-textMuted hover:text-textPrimary hover:bg-ink/[0.05] transition-colors"
              >
                <Minimize2 className="w-3 h-3" />
              </button>
            ) : (
              fullBtn('chart')
            )}
          </span>
        </>
      ) : (
        <>
          {identity}
          {lensTabs}
          {/* `spread` + the room to spread in (Noah, 2026-09-11: "shouldn't the
              indicators and everything right of it be on the right side of the
              header?") — Pulse's rule: the timeframes keep the left, the divider
              becomes the spacer, Indicators · Alerts · Candles · Overlays · Theme
              land at the right edge beside the expand door. Compact (the card)
              stays packed — there is no room to spread across. */}
          {/* ITS FLOOR IS ITS OWN ROW (Noah, 2026-09-13, the card at ~1130px:
              "as the page gets slightly smaller the top section just gets
              completely discombobulated"): this wrapper was `min-w-0`, so
              when the identity and the tabs left it less than a row's worth,
              it shrank to one icon's width and the toolbar's own wrap stacked
              its six controls into a COLUMN, with the identity centred beside
              it. `min-w-fit` keeps the floor at the toolbar's one-row width
              (capped at the strip's own), so it wraps to a row of its own
              under the identity instead — two tidy rows, then one again. */}
          <div className="flex-1 min-w-fit">
            <ChartToolbar
              minimal
              candles
              spread
              alertTicker={ticker}
              alertSpot={levels.spot}
              compact={full !== 'chart'}
              timeframe={timeframe}
              onTimeframe={setTimeframe}
              overlays={overlays}
              onOverlays={setOverlays}
              chartStyle={chartStyle}
              onChartStyle={setChartStyle}
              indicators={indicators}
              onIndicators={setIndicators}
              paneId="weigher"
              fullscreen={full === 'chart'}
              /* THE DOOR RIDES THE TOOLBAR (2026-09-13): it used to stand alone
                 after it with `ml-auto`, so when the toolbar wrapped to a row
                 of its own the door was left behind on the first row, or
                 dropped to a third. As the toolbar's last control it goes
                 wherever the toolbar goes — and in fullscreen it is the
                 minimize door at the strip's far right, as before. */
              onToggleFullscreen={full === 'chart' ? close : () => setFull('chart')}
            />
          </div>
        </>
      )}
    </div>
  );

  const chartBody = (
    /* A dark island on any page (2026-09-12): the tape and its strip read the dark tokens —
       and the strip the ground of the tape's theme (2026-09-13) */
    <div className="relative h-full bg-panel" data-theme="dark" data-chart-ground={chartGround(chartThemeKey)}>
      <div className="absolute inset-0">
        {lens === 'vol' ? (
          <VolCurves ticker={ticker} chain={chain} sel={sel} />
        ) : lens === 'contract' && selected ? (
          /* Keyed remount: stepping strikes lands the new premium tape on a
             soft fade instead of a hard cut. */
          <div key={`${ticker}:${sel}:${right}:${dte}`} className="h-full animate-soft-in">
            <ContractPremiumPane
              ticker={ticker}
              strike={selected.strike}
              right={right}
              tYears={tYears}
              timeframe={timeframe}
              revision={tick}
            />
          </div>
        ) : (
          /* The chart mounts a frame after the page paints, behind its skeleton (2026-09-06, the perf sweep) */
          <Deferred fallback={<ChartSkeleton className="h-full" />} className="h-full animate-fade-in">
            <StrikeChart
              ticker={ticker}
              paneId="weigher"
              revision={tick}
              levels={levels}
              timeframe={timeframe}
              keepView
              /* the session's own clock, and the tape near its right edge (the audit's X2 and X11) */
              nyClock
              historyShare={0.9}
              /* THE WHEEL BELONGS TO THE PAGE over the docked chart (2026-09-14, Noah: "the scroll
                 bar doesn't work at all" — the desk scrolls now, and the chart ate every wheel
                 over the top-left 40% of the screen); fullscreen keeps the wheel zoom, as Terrain
                 below lg does — the same trade, see `pageScroll` */
              pageScroll={full !== 'chart'}
              overlays={overlays}
              chartStyle={chartStyle}
              indicators={indicators}
              prints={prints}
              height={180}
              frameless
            />
          </Deferred>
        )}
      </div>
      {chartStrip}
    </div>
  );

  /* The chain's line of cards: the name's own door (Noah, 2026-08-25: "the
     chain should have its own ticker search" — the same state as the chart's
     picker, so either one repoints both), then Side · Expiry (as dates, the
     Map's spelling) · Reach (the strike distance is a choice, not a cap) ·
     Columns (the catalog, in catalog order), and the expected move as a fact.

     THE HEAD KNOWS ITS ROOM (Noah, 2026-09-20, with the landing's picture of this desk: "the chain buttons of top … are
     screwed up"). Measured: the line needs ~760px of card, and the card has 491 at 1280, 571 at 1440 and 643 at 1600 —
     on every laptop the cards broke into a ragged second line inside their own strip and the fullscreen door fell to a
     third. So, by the card's measured width: ONE ROW where it fits (as it always was on a wide screen); else TWO — the
     chain's identity on the title's row (whose chain · the move it is charging for · the door at the row's end) and the
     four cards on a row of their own; and where even four NAMED cards do not fit a row, the cards drop their printed
     names (`bare` — the name stays in the tooltip and the open card's heading) rather than break again. */
  const chainName = <TickerQuickPick ticker={ticker} onPick={pickTicker} slim />;
  const chainMove = (
    <span className="font-mono text-[10px] tnum text-textMuted whitespace-nowrap" title="The move the options are charging for by this expiry">
      ±{chain.expectedMovePct.toFixed(1)}%
    </span>
  );
  const chainCards = (bare: boolean) => (
    <>
      <DropdownSelect label="Side" value={right} options={SIDE_OPTIONS} onChange={v => patch({ right: v })} title="Calls or puts" testId="weigher-side" bare={bare} />
      <ExpiryCard label="Expiry" value={chain.expiry.dte} choices={expiryOptions} onChange={v => patch({ dte: v })} free={{ days: 90, toValue: d => dteForDate(isoDate(d)) }} title="Which contracts the chain lists" testId="weigher-expiry" bare={bare} />
      <DropdownSelect label="Reach" value={depth} options={REACH_OPTIONS} onChange={v => patch({ depth: v })} title="How many strikes each side of the market" testId="weigher-reach" bare={bare} />
      <DropdownMulti
        label="Columns"
        values={cols}
        groups={COLUMN_GROUPS}
        onChange={next => patch({ cols: CHAIN_COLUMNS.map(c => c.key).filter(k => next.includes(k)) })}
        emptyWord="Strike only"
        title="Which facts the chain shows"
        testId="weigher-columns"
        align="end"
        bare={bare}
      />
    </>
  );
  const chainActions = (
    <span className="flex items-center gap-1.5 flex-wrap">
      {chainName}
      {chainCards(false)}
      {chainMove}
    </span>
  );
  const chainHead: 'one' | 'two' | 'bare' = chainW === 0 || chainW >= CHAIN_ONE_ROW_PX ? 'one' : chainW >= CHAIN_NAMED_ROW_PX ? 'two' : 'bare';

  /* THE WEIGH-UP IS GONE (Noah, 2026-09-14): the Compass grade, the board's rank and the
     doors to the setup page left the card with it — the card is the contract's page now */
  /* THE WATCHLIST ON THE DESK (2026-09-14 — Noah, with Robinhood's list and its contract page:
     the bottom-left card lists every watched contract, the bottom-right reads the one picked).
     The store's housekeeping — today's close, the bell — rides the desk's tick; the rows are
     priced on the sweep, like the chain. */
  const watchlist = useWatchlist();
  useEffect(() => {
    tickWatchlist();
  }, [tick]);
  /* ONE LIST, TWO KINDS OF ROWS (2026-09-14): the contracts you watch and the positions you own
     or sold (the Map's "Your positions", moved here) — priced on the sweep, open rows first,
     newest first */
  const positions = useAllPositions();
  /* TWO CARDS (Noah, 2026-09-14: "one is just a random watchlist position whilst the other is
     YOUR position"): the positions you own or sold in one, the contracts you watch in the other
     — the same rows, priced on the sweep, newest first, a watched row's settled ones last */
  const ownRows = useMemo<ListRow[]>(
    () =>
      positions
        .map<ListRow>(p => {
          const value = valueOn(p, spotOf(p.ticker), 0);
          const sign = p.side === 'long' ? 1 : -1;
          /* against what was typed, else the mark when it was added (positionCurve costOf, 2026-09-16) */
          const cost = costOf(p);
          const total = cost ? (value - cost.value) * sign * 100 * p.contracts : null;
          const totalR = cost && cost.value > 0 ? ((value - cost.value) / cost.value) * sign : null;
          return { kind: 'own', id: p.id, p, value, total, totalR };
        })
        .sort((a, b) => (b.kind === 'own' ? b.p.addedAt : 0) - (a.kind === 'own' ? a.p.addedAt : 0)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [positions, scanTick]
  );
  const watchRows = useMemo<ListRow[]>(() => {
    const rank = (w: WatchedContract) => (w.status === 'open' ? 0 : 1);
    return [...watchlist].sort((a, b) => rank(a) - rank(b) || b.addedAt - a.addedAt).map<ListRow>(w => ({ kind: 'watch', id: w.id, w, r: returnsOf(w) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchlist, scanTick]);
  const listRows = useMemo<ListRow[]>(() => [...ownRows, ...watchRows], [ownRows, watchRows]);
  const watchReq = useMemo(() => (sel != null ? { ticker, strike: sel, right, expiry: isoDate(chain.expiry.date) } : null), [ticker, sel, right, chain.expiry.date]);
  /* the picked contract's watched row — open, or its latest settled one */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const watched = useMemo(() => (watchReq ? watchedFor(watchReq) : null), [watchReq, watchlist]);
  const watching = watched?.status === 'open';
  /* THE ROW THE CARD DRAWS: the row the reader pressed on a list, while the desk is on its name — else the picked
     contract's own row (an open watched one first, then a position) — else none.
     A PRESSED ROW ALWAYS OPENS (Noah, 2026-09-20, a TSLA 244P that "just refuses to open anything up"; 2026-09-28, "the
     'your positions' doesnt allow me to view the right card … but the watchlist does"): the chain could not point at
     those contracts — a strike it does not list (TSLA steps by 2.50), an expiry it no longer carries (a position from
     Sep 21 on Sep 28) — and the card, matching the row against the CHAIN's contract, found nothing and said "Not on your
     list" under the very row that was pressed. The card prices a row from the row, not from the chain: the pressed row
     is drawn whatever strike or date the desk settled on. The reader's own press on a strike of the chain, or a move to
     another name, lets the pick go and the card follows the chain again (pickStrike, pickTicker). */
  const cardRow = useMemo<ListRow | null>(() => {
    const chosen = listSel ? listRows.find(r => r.id === listSel) : null;
    if (chosen && (chosen.kind === 'watch' ? chosen.w : chosen.p).ticker === ticker) return chosen;
    const same = (r: ListRow) => {
      const c = r.kind === 'watch' ? r.w : r.p;
      return !!watchReq && c.ticker === watchReq.ticker && c.right === watchReq.right && c.expiry === watchReq.expiry && Math.abs(c.strike - watchReq.strike) < 1e-9;
    };
    return listRows.find(r => same(r) && (r.kind === 'own' || r.w.status === 'open')) ?? listRows.find(r => same(r)) ?? null;
  }, [listRows, listSel, watchReq, ticker]);
  /* THE DOOR: watch the picked contract — the store marks it at this tick's price — and the
     list card turns to the watchlist, where its row now stands selected */
  const watchIt = useCallback(() => {
    if (!watchReq) return;
    if (!watching) addToWatchlist(watchReq);
    patch({ preset: 'watchlist' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchReq, watching]);
  const pickRow = useCallback(
    (row: ListRow) => {
      const c = row.kind === 'watch' ? row.w : row.p;
      setListSel(row.id);
      pointTo({ ticker: c.ticker, strike: c.strike, right: c.right, expiry: c.expiry });
    },
    [pointTo]
  );
  /* THE TRASH BIN on a list row (Noah, 2026-09-14): a watched contract leaves the list, a
     position is removed — the row glides out (animateRows) and the card follows the list */
  const removeRow = useCallback((row: ListRow) => {
    if (row.kind === 'watch') removeWatched(row.w.id);
    else removePosition(row.p.id);
    setListSel(s => (s === row.id ? null : s));
  }, []);
  /* THE BOTTOM ROW'S CARDS FOLD to their heads (Noah, 2026-09-14): a folded list card gives its
     room to the other; both folded, the column is two heads; THE POSITION CARD folds too (Noah:
     "make the position page collapsable as well") — its body glides away and the row settles on
     the column's floor. Kept in this browser. The rows glide between the two states
     (grid-template-rows transitions in Chromium). */
  const [folds, setFolds] = useState<Folds>(() => {
    try {
      const raw = localStorage.getItem('slayer_weigher_folds');
      const v = raw ? (JSON.parse(raw) as Partial<Folds>) : {};
      return { positions: v.positions === true, watchlist: v.watchlist === true, position: v.position === true };
    } catch {
      return { positions: false, watchlist: false, position: false };
    }
  });
  const toggleFold = useCallback((key: keyof Folds) => {
    setFolds(f => {
      const next = { ...f, [key]: !f[key] };
      try {
        localStorage.setItem('slayer_weigher_folds', JSON.stringify(next));
      } catch {
        /* storage off — the fold lives for the session */
      }
      return next;
    });
  }, []);
  const columnRows = `${folds.positions ? 'minmax(33px, 0fr)' : 'minmax(0, 1fr)'} ${folds.watchlist ? 'minmax(33px, 0fr)' : 'minmax(0, 1fr)'}`;
  /* A POSITION JUST ADDED lands on the desk: the form saved it, the list has it — its row is
     picked so the card turns to it on the soft fade (Noah: "smooth as butter") */
  const knownPositions = useRef<Set<string> | null>(null);
  useEffect(() => {
    const ids = new Set(positions.map(p => p.id));
    const known = knownPositions.current;
    knownPositions.current = ids;
    if (!known) return;
    const fresh = positions.find(p => !known.has(p.id));
    const row = fresh ? listRows.find(r => r.id === fresh.id) : null;
    if (row) pickRow(row);
  }, [positions, listRows, pickRow]);
  /* THE DOOR ON EVERY CHAIN ROW (Noah, 2026-09-14): the strikes of this ladder that are on the
     list, and the +: it picks the strike, watches it if it is not watched yet, and turns the
     list card to the watchlist — the position lands in the card the moment it is entered */
  const expiryIso = isoDate(chain.expiry.date);
  const watchedStrikes = useMemo(() => new Set(watchlist.filter(w => w.status === 'open' && w.ticker === ticker && w.right === right && w.expiry === expiryIso).map(w => w.strike)), [watchlist, ticker, right, expiryIso]);
  const watchFromChain = useCallback(
    (strike: number) => {
      setSel(strike);
      if (!watchedStrikes.has(strike)) addToWatchlist({ ticker, strike, right, expiry: expiryIso });
      patch({ preset: 'watchlist' });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [watchedStrikes, ticker, right, expiryIso]
  );

  /* THE DAY'S DEALER MAP for the name — the position card's sketch draws its walls and flip
     on the price axis and its read speaks against it (the Positions panel reads every
     position against the 0DTE book, thirty strikes each side); rebuilt on the sweep */
  const profile = useMemo<ExposureProfileData | null>(() => {
    try {
      return buildExposureProfile(Simulator.snapshotFor(ticker), '0DTE', 30);
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker, scanTick]);
  /* OUR TWO CENTS (Noah, 2026-09-28, his partner: "or else it would just be a robinhood watchlist all over again"):
     THE BOOK for the desk's name — every strike's shape, lean, part, record, close odds and change (data/bookAtStrike.ts)
     — read by the chain's column and the strike's third block; and the lists' HEDGING word, the position card's own
     verdict for every row, a profile per name on the scan */
  const book = useMemo(() => (profile ? buildBook(ticker, profile) : null), [profile, ticker]);
  const bookAt = useCallback((strike: number) => book?.rows.get(strike) ?? null, [book]);
  const drillBook = useCallback((c: DeskContract) => <BookBlock read={bookAt(c.strike)} c={c} />, [bookAt]);
  const profilesRef = useRef(new Map<string, ExposureProfileData | null>());
  useEffect(() => {
    profilesRef.current.clear();
  }, [scanTick]);
  const hedgeOf = useCallback(
    (row: ListRow): Verdict | null => {
      const c = row.kind === 'watch' ? row.w : row.p;
      const open = row.kind === 'watch' ? row.w.status === 'open' : c.expiry >= isoDate(today());
      if (!open) return null;
      let prof: ExposureProfileData | null | undefined = c.ticker === ticker ? profile : profilesRef.current.get(c.ticker);
      if (prof === undefined) {
        try {
          prof = buildExposureProfile(Simulator.snapshotFor(c.ticker), '0DTE', 30);
        } catch {
          prof = null;
        }
        profilesRef.current.set(c.ticker, prof);
      }
      if (!prof) return null;
      const pos: Position = row.kind === 'own' ? row.p : { id: row.w.id, ticker: row.w.ticker, strike: row.w.strike, right: row.w.right, side: 'long', contracts: row.w.size, expiry: row.w.expiry, entry: row.w.addedMark, source: 'you', addedAt: row.w.addedAt };
      return readPosition(pos, prof).verdict;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ticker, profile, scanTick]
  );

  /* THE SASH (Noah, 2026-09-14: "build it with the sash"): the WINDOW's height — the chart and
     the chain — dragged on a sash in the gap under it, double-click to reset, kept in this
     browser in pixels (deskSplit.ts — the skeleton reads the same number); the row under it
     grows with its cards and the page scrolls. Only where the desk is a frame; on a phone the
     cards stack at their own heights. The desk already stashes its ticks while a pointer is
     down, so the drag is never re-rendered under the hand. */
  const belowLg = useIsBelowLg();
  const [top, setTop] = useState<number>(readDeskTop);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const onSashDown = useCallback((e: React.PointerEvent) => {
    const frame = frameRef.current;
    if (!frame) return;
    e.preventDefault();
    const move = (ev: PointerEvent) => {
      const r = frame.getBoundingClientRect();
      setTop(clampDeskTop(ev.clientY - r.top));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      setTop(v => {
        saveDeskTop(v);
        return v;
      });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }, []);
  const resetSash = useCallback(() => {
    setTop(DESK_TOP_DEFAULT);
    saveDeskTop(DESK_TOP_DEFAULT);
  }, []);

  const chainBody = (
    <ChainCard
      inlineDrill
      chain={chain}
      right={right}
      sel={sel}
      onSelect={pickStrike}
      cols={shownCols}
      centerKey={`${ticker}:${dte}:${depth}`}
      reveal={reveal}
      watched={watchedStrikes}
      onWatch={watchFromChain}
      book={bookAt}
      drillExtra={drillBook}
    />
  );

  /* THE WHOLE DESK HOLDS STILL FOR THE SIDEBAR'S GLIDE (Noah, 2026-09-11, the
     Weigher walk: "my main pet peeve about that page … the sidebar drag being
     laggy"). The chain's rows got their hold on 2026-09-10 and the chart has
     its own, but the frame around them — the scanner's rows, the strike's
     meters, four card heads, the grid itself — still re-laid out on every one
     of the glide's eighteen frames (measured: 28ms worst frames here against
     14 on Compass). The charts' rule, applied to the desk as one: the root
     pins its width when the glide begins and takes the new width once when
     it ends — one layout. main clips the overlap (index.css [data-glide]). */
  const deskRef = useRef<HTMLDivElement | null>(null);
  useEffect(
    () =>
      onGlide(
        () => {
          const el = deskRef.current;
          if (!el) return;
          el.style.width = `${el.getBoundingClientRect().width}px`;
          /* And it rides the glide as ONE compositor layer: the sidebar's
             width shifts the whole column sideways every frame, and without
             a layer the chart's canvases and both tables re-rasterise on each
             of them (the residual after the width hold — measured 21–35ms
             worst frames against Compass's 14). Rastered once, then moved. */
          el.style.willChange = 'transform';
        },
        () => {
          const el = deskRef.current;
          if (!el) return;
          el.style.width = '';
          el.style.willChange = '';
        }
      ),
    []
  );

  return (
    /* The desk is the first screenful's remainder: the shell hands /weigher
       exactly one viewport of height (the footer waits one slight scroll
       below), and this column absorbs it — the "100%" the 60/40 splits. */
    <div ref={deskRef} className="relative flex-1 min-h-0 flex flex-col" data-weigher-desk>
      <TickPump onTick={onTick} />

      {/* ONE strip of chrome, the Trace verdict applied here (Noah,
          2026-08-30: "just like the trace pages we are having way too much
          space up top") — the page identity on the left and THE SESSION READ
          on the right. Weight at both ends, the card-head law.

          THE SESSION READ, not a badge (Noah, 2026-08-30: the centred
          sun/moon capsule "looks exactly like robinhood legend" — gone).
          Three quiet facts in the house's own registers: the session as a
          whisper label (overnight wears the moon ink, the evening colour),
          the index's move in direction ink, and a DIVERGING hairline — the
          Net Flow board's instrument turned two-sided: a centre mark is
          unchanged, the fill runs right for up and left for down, and its
          length is the size of the move (±2% fills a side — Noah, 2026-08-30:
          "make it 2%"; an ordinary day now shows on the bar). The fill EASES
          between ticks on the house curve instead of stepping. No icon, no
          capsule, no fill behind the words. */}
      {/* THE SHELL HEAD (the walk, 2026-09-11) — the page's icon and name over
          one line, the house head every walked page wears; the session read
          rides at the right as two labelled facts (the diverging hairline kept:
          ±2% fills a side, Noah 2026-08-30). */}
      <header className="shrink-0 flex items-start gap-6 flex-wrap pb-3 border-b border-borderSubtle" data-shell data-weigher-shell>
        <div className="min-w-0 flex-1">
          <div className="h-6 flex items-center gap-2.5" data-shell-page>
            <ProductGlyph name="weigher" size={18} bare className="shrink-0" />
            <h1 className="text-[15px] font-semibold leading-tight text-textPrimary">Weigher</h1>
            <GuideDoor open={guideOpen} onClick={() => setGuideOpen(v => !v)} title="What the chain, the read and the chart mean" testId="weigher-guide" />
          </div>
          <p className="mt-0.5 text-[11px] text-textMuted line-clamp-2 md:line-clamp-1" title="Chart, chain and watchlist on one desk — a name, a contract on it, and what it would do">Chart, chain and watchlist on one desk — a name, a contract on it, and what it would do</p>
        </div>
        <dl
          className="flex flex-wrap gap-x-6 gap-y-2"
          data-shell-facts
          title={session === 'overnight' ? 'Overnight — New York is closed; the read follows the Nasdaq session (QQQ)' : 'Trading hours — the read follows the Nasdaq session (QQQ)'}
        >
          <Fact label="Session" testId="session">
            {session === 'overnight' ? <span className="text-moon">Overnight · Nasdaq</span> : 'Regular session · Nasdaq'}
          </Fact>
          <Fact label="NDX" testId="ndx">
            <span className="inline-flex items-center gap-2">
              <span className={mood.changePct > 0 ? 'text-bull' : mood.changePct < 0 ? 'text-bear' : 'text-textSecondary'}>
                {mood.changePct >= 0 ? '+' : ''}
                {mood.changePct.toFixed(2)}%
              </span>
              <span className="relative w-16 h-[3px] rounded-full bg-ink/[0.06] overflow-hidden" aria-hidden>
                <span
                  className={`absolute inset-y-0 rounded-full transition-[width] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
                    mood.changePct >= 0 ? 'left-1/2 bg-bull/70' : 'right-1/2 bg-bear/70'
                  }`}
                  style={{ width: `${Math.min(50, (Math.abs(mood.changePct) / 2) * 50)}%` }}
                />
                <span className="absolute inset-y-0 left-1/2 w-px bg-ink/30" />
              </span>
            </span>
          </Fact>
        </dl>
      </header>
      <GuideFocus open={guideOpen} onClose={() => setGuideOpen(false)} title="How to read the Weigher" testId="weigher-guide" viewport width={620}>
        <WeigherGuide />
      </GuideFocus>

      {/* THE STATIC FRAME (Noah, 2026-08-30): four cells, drawn once.
          Top row = the chart and the chain, 50/50, on 60% of the height;
          bottom row = the scanner and the strike read, 50/50, on the
          remaining 40%. 3fr/2fr IS 60/40; minmax(0,·) on every track is
          load-bearing — without it a wide chain row or a tall read would
          push its track past the split and the frame would silently stop
          being the frame. */}
      {/* ON A PHONE, A COLUMN (the phone pass, 2026-09-13 — Noah: "charts
          should stay… our product should be phone small level"): the four
          cards under each other at a readable height each — the chart at
          three fifths of the screen, the chain a screen, the scanner three
          fifths — and the page scrolls (the shell drops the viewport frame
          below md). Four cells in a 390px frame were four unreadable ones. */}
      {/* THE WINDOW AND THE ROW UNDER IT (2026-09-14): the chart and the chain in a window at the
          reader's height (the sash), the watchlist and the position in a row that grows with
          its cards — the page scrolls, like every other page. The phone's column never sees the
          style; its cards stack at their own heights. */}
      <div
        ref={frameRef}
        className="relative mt-4 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2.5 max-lg:grid-cols-1 max-lg:grid-rows-none max-lg:auto-rows-auto"
        style={belowLg ? undefined : { gridTemplateRows: deskRows(top) }}
        data-weigher-frame
        data-desk-top={belowLg ? undefined : top}
      >
        <div className="min-h-0 min-w-0 max-lg:h-[60vh]">
          {/* NOT a DeskCard: the chart card has no header row — the strip
              inside chartBody is its whole chrome (Noah, 2026-08-29: one
              row, translucent, tape edge to edge). */}
          <div className="h-full relative overflow-hidden rounded-md border border-ink/[0.07] bg-panel">
            {full === 'chart' ? <div className="h-full" /> : chartBody}
          </div>
        </div>

        <div ref={chainBoxRef} className="min-h-0 min-w-0 max-lg:h-[100vh]" data-chain-head={chainHead}>
          <DeskCard
            title="Chain"
            actions={
              chainHead === 'one' ? (
                <>
                  {chainActions}
                  {fullBtn('chain')}
                </>
              ) : (
                /* the row's whole width: the chain's identity beside its title, the door at the row's end */
                <span className="flex flex-1 items-center gap-1.5 min-w-0">
                  {chainName}
                  {chainMove}
                  <span className="ml-auto inline-flex">{fullBtn('chain')}</span>
                </span>
              )
            }
            under={chainHead === 'one' ? undefined : chainCards(chainHead === 'bare')}
          >
            {full === 'chain' ? <div className="h-full" /> : chainBody}
          </DeskCard>
        </div>

        <div className="min-h-0 min-w-0 grid gap-2.5 min-h-[438px] transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]" style={{ gridTemplateRows: columnRows }} data-left-column data-folds={`${folds.positions ? 'p' : ''}${folds.watchlist ? 'w' : ''}${folds.position ? 'c' : ''}`}>
          {/* TWO CARDS IN THE LEFT COLUMN (Noah, 2026-09-14): YOUR POSITIONS — the ones you own
              or sold, the Map's form to add one — over THE WATCHLIST, the contracts you watch
              (its List control turns it into the scanner's roster). Both feed the position card
              beside them; the picked row wears the selection in whichever card holds it. THE
              TWO ARE EQUAL WINDOWS (Noah: "should have equal lengths… if they exceed this
              height the rest should be scrollable inside of the boxes"): the column takes the
              row's height — the position card's, or 438 at the least — split in two, and each
              grid scrolls inside its card. */}
          <div className="min-h-0" data-positions-card>
            <DeskCard
              title="Your positions"
              fold={{ open: !folds.positions, onToggle: () => toggleFold('positions'), testId: 'positions' }}
              actions={
                /* ADD A POSITION — the Map's form, here now: strike · call or put · own or sold · contracts · expires · what you paid */
                <PositionForm
                  ticker={ticker}
                  /* a strike THE CHAIN LISTS: the money rounded to a dollar (244 on a name that steps by 2.50) made positions
                     no chain row could answer to */
                  defaultExpiry={isoDate(chain.expiry.date)}
                  defaultRight={right}
                  defaultStrike={sel ?? (chain.rows.length ? chain.rows.reduce((best, r) => (Math.abs(r.strike - levels.spot) < Math.abs(best.strike - levels.spot) ? r : best), chain.rows[0]).strike : Math.round(levels.spot))}
                  align="end"
                  trigger={
                    /* the small size — a 28px control filled the head's 32px line to the borders (Noah, 2026-09-14) */
                    <button className="inline-flex items-center gap-1 h-6 px-2 rounded-md border border-borderSubtle bg-ink/[0.03] hover:bg-ink/[0.06] font-mono text-[9px] uppercase tracking-wider text-textSecondary hover:text-textPrimary transition-colors" title="Add a position you own or sold — its projected returns land in the card" data-add-position>
                      <Plus className="w-3 h-3" />
                      Add a position
                    </button>
                  }
                />
              }
            >
              <ListGrid rows={ownRows} selectedId={cardRow?.id ?? null} onPick={pickRow} onRemove={removeRow} hedgeOf={hedgeOf} emptyText="No positions yet — add one you own or sold" testId="positions" />
            </DeskCard>
          </div>
          <div className="min-h-0" data-watchlist-card>
            <DeskCard
              title={preset === 'watchlist' ? 'Watchlist' : 'Scanner'}
              fold={{ open: !folds.watchlist, onToggle: () => toggleFold('watchlist'), testId: 'watchlist' }}
              actions={<DropdownSelect label="List" value={preset} options={KIND_OPTIONS} onChange={v => patch({ preset: v })} title="What this card lists" testId="weigher-kind" align="end" size="sm" />}
            >
              {/* THE HOUSE GRID (the walk, 2026-09-11) — the roster as an AG Grid
                  window: the head pinned, the rows in the house's clothes, the
                  desk's name in the where-you-are selection; a row puts that
                  name on the desk. The watchlist wears the same window: a row
                  puts that CONTRACT on the desk. */}
              {/* the swap between the list and a scanner's cut lands on the house's soft fade (Noah: "smooth as butter") */}
              <div key={preset} className="h-full animate-soft-in-slow" data-list-view={preset}>
                {preset === 'watchlist' ? <ListGrid rows={watchRows} selectedId={cardRow?.id ?? null} onPick={pickRow} onRemove={removeRow} hedgeOf={hedgeOf} emptyText="Nothing watched yet — press + on a strike in the chain" testId="watchlist" /> : <ScanGrid rows={scan} ticker={ticker} preset={preset} onPick={pickTicker} />}
              </div>
            </DeskCard>
          </div>
        </div>

        {/* THE POSITION CARD stands at its own height (self-start): the row is as tall as it is — or
            as the column's 438 floor when it is folded or empty — never a stretched card with a
            folded body */}
        <div className="min-h-0 min-w-0 self-start" data-position-card>
          <DeskCard
            title="The position"
            fold={{ open: !folds.position, onToggle: () => toggleFold('position'), testId: 'position', self: true }}
            actions={
              cardRow || (selected && sel != null) ? (
                /* the card's own contract where it draws a row — its strike AND its date, which the chain may not list
                   (a position from Sep 21 pressed on Sep 28 said "· 2d", the chain's, 2026-09-28) */
                <span className="font-mono text-[10px] font-semibold tnum text-textSecondary whitespace-nowrap" data-position-head>
                  {(() => {
                    const c = cardRow ? (cardRow.kind === 'watch' ? cardRow.w : cardRow.p) : null;
                    return c ? `${c.ticker} ${fmtStrike(c.strike)}${c.right} · ${monthDay(c.expiry)}` : `${ticker} ${fmtStrike(sel!)}${right} · ${chain.expiry.dte}d`;
                  })()}
                </span>
              ) : undefined
            }
          >
            <PositionDeskCard
              picked={selected}
              row={cardRow}
              profile={profile}
              onWatch={watchIt}
              onClose={cardRow?.kind === 'watch' ? () => closeWatched(cardRow.w.id) : undefined}
              onRemove={cardRow?.kind === 'watch' ? () => removeWatched(cardRow.w.id) : undefined}
              onRemovePosition={cardRow?.kind === 'own' ? () => removePosition(cardRow.p.id) : undefined}
              contractKey={`${ticker}-${sel ?? 'none'}-${right}-${chain.expiry.dte}`}
            />
          </DeskCard>
        </div>

        {/* THE SASH, in the gap under the window — invisible until the pointer finds it, like
            every sash on the desk */}
        {!belowLg && (
          <span
            onPointerDown={onSashDown}
            onDoubleClick={resetSash}
            role="separator"
            aria-orientation="horizontal"
            aria-label="Drag to make the chart and the chain taller or shorter — double-click to reset"
            title="Drag to resize the window · double-click to reset"
            className="absolute inset-x-0 h-2.5 z-30 cursor-row-resize hover:bg-ink/[0.10] transition-colors"
            style={{ top }}
            data-weigher-sash
          />
        )}
      </div>

      {/* Portal, not a plain fixed div: the cards' backdrop-blur creates a
          containing block for position:fixed, so an in-place overlay would
          size itself to the card. Escaping to <body> is the only way out
          (the ladder widget learned this first). */}
      {full === 'chart' &&
        createPortal(
          /* The Pulse takeover's grammar: the chart IS the screen — no
             padding frame, no Back row; the strip inside chartBody carries
             every control plus the minimize door, and Esc still works. */
          <div
            className={`fixed inset-0 z-[80] bg-canvas flex flex-col animate-soft-in transition-opacity duration-200 ease-out ${
              closing ? 'opacity-0' : ''
            }`}
            /* the script editor's dock takes the right edge while it is open (data/editorDock.ts) */
            style={DOCK_ROOM}
          >
            <div className="flex-1 min-h-0">{chartBody}</div>
          </div>,
          document.body
        )}
      {full === 'chain' &&
        createPortal(
          <div
            className={`fixed inset-0 z-[80] bg-canvas p-3 flex flex-col animate-soft-in transition-opacity duration-200 ease-out ${
              closing ? 'opacity-0' : ''
            }`}
          >
            <div className="flex-1 min-h-0 border border-borderSubtle bg-panel rounded-lg overflow-hidden flex flex-col">
              {/* ONE row (Noah, 2026-08-29: the Back button was the second
                  one) — the chain's own controls, and the minimize door. */}
              <div className="shrink-0 flex items-center gap-2 px-2.5 py-1.5 border-b border-ink/[0.05]">
                <span className="ml-auto flex flex-wrap items-center justify-end gap-1.5 min-w-0">{chainActions}</span>
                <button
                  onClick={close}
                  title="Exit fullscreen (Esc)"
                  className="p-1 rounded text-textMuted hover:text-textPrimary hover:bg-ink/[0.05] transition-colors"
                >
                  <Minimize2 className="w-3 h-3" />
                </button>
              </div>
              <div className="flex-1 min-h-0">{chainBody}</div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default WeigherDesk;
