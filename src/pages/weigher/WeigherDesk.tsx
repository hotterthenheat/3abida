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
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown, ArrowUp, ArrowUpRight, Check, ChevronDown, ChevronRight, Maximize2, Minimize2, Scale } from 'lucide-react';
import { type ColDef, type ICellRendererParams, type RowClickedEvent, type RowDoubleClickedEvent } from 'ag-grid-community';
import { AgGridProvider, AgGridReact } from 'ag-grid-react';
import { GRID_MODULES, GRID_THEME } from '../../components/ui/houseGrid';
import DropdownSelect, { type DropdownOption } from '../../components/ui/DropdownSelect';
import DropdownMulti, { type MultiGroup } from '../../components/ui/DropdownMulti';
import ExpiryCalendar from '../../components/ui/ExpiryCalendar';
import { isoDate } from '../../core/calendar';
import { listExpiriesFor, listingPatternFor, nearestListedExpiry } from '../../data/optionChain';
import { spotForPremium } from '../../components/compass/trackModel';
import CardTabs from '../../components/ui/CardTabs';
import GuideFocus, { GuideDoor } from '../../components/ui/GuideFocus';
import CompanyLogo from '../../components/ui/CompanyLogo';
import { Fact } from '../../components/trace/TraceBox';
import { WeigherGuide } from '../../components/weigher/WeigherGuide';
import { processState, PROCESS_META } from '../../components/compass/setupProcess';
import { TimeframeStrip } from '../../components/gex/ChartToolbar';
import Simulator from '../../core/simulator';
import { onGlide } from '../../core/glide';
import { DOCK_ROOM } from '../../data/editorDock';
import { useMarketData } from '../../context/MarketDataContext';
import { buildLevelsFor, buildPrints, fmtUsd, spotChangePct } from '../../data/gex';
import { buildCompassView, estimatePremium, makeSetup, sleeveForDte } from '../../data/compass';
import {
  SCAN_PRESETS,
  SCAN_PRESET_KEYS,
  buildDeskChain,
  buildScan,
  contractIvFor,
  marketMood,
  marketSession,
  type DeskChain,
  type DeskContract,
  type ScanPreset,
  type ScanRow,
} from '../../data/weigherDesk';
import StrikeChart, {
  DEFAULT_INDICATORS,
  DEFAULT_OVERLAYS,
  type ChartIndicators,
  type ChartOverlays,
  type ChartStyle,
} from '../../components/gex/StrikeChart';
import ChartToolbar from '../../components/gex/ChartToolbar';
import { weighContract, type WeighYourOwn, type ContractVerdict } from '../../core/contractScore';
import RichRead from '../../components/ui/RichRead';
import SignalBadge from '../../components/ui/SignalBadge';
import TickerQuickPick from '../../components/gex/TickerQuickPick';
import { ChartSkeleton, Deferred } from '../../components/ui/Skeleton';
import SpotPrice from '../../components/gex/SpotPrice';
import ContractPremiumPane from '../../components/gex/ContractPremiumPane';
import { useFadeClose } from '../../components/ui/useFadeClose';
import Term from '../../components/ui/Term';
import type { Timeframe } from '../../data/timeframe';
import type { OptionRight, Setup } from '../../types/compass';

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
  { value: 'C', label: 'Calls', hint: 'The right to buy' },
  { value: 'P', label: 'Puts', hint: 'The right to sell' },
];
const REACH_OPTIONS: DropdownOption<number>[] = DESK_DEPTHS.map(d => ({ value: d, label: `±${d}`, hint: `${d} strikes each side of the market` }));
/* Every kind the scanner asks (data/weigherDesk SCAN_PRESETS — Noah, 2026-09-12:
   52-week highs and lows, gaps, jumps and dips, option volume, IV, earnings…) */
const KIND_OPTIONS: DropdownOption<ScanPreset>[] = SCAN_PRESETS.map(p => ({ value: p.key, label: p.label, hint: p.hint }));

interface DeskState {
  ticker: string;
  dte: number;
  lens: 'stock' | 'contract';
  right: OptionRight;
  preset: ScanPreset;
  depth: number;
  /** Which catalog columns the chain shows, in catalog order */
  cols: string[];
}

/* An old record may still carry `layout`/`rowsV`/`colsV` from the movable
   era — parsed and ignored here, and the next save sheds them for good. */
function loadDesk(): DeskState {
  const def: DeskState = { ticker: 'SPY', dte: 2, lens: 'stock', right: 'C', preset: 'gainers', depth: 150, cols: DEFAULT_COLS };
  try {
    const raw = localStorage.getItem(DESK_KEY);
    if (!raw) return def;
    const c = JSON.parse(raw) as Partial<DeskState>;
    // Stored columns keep only keys the catalog still knows, in its order;
    // an empty or unknown set falls back to the default chain.
    const storedCols = Array.isArray(c.cols) ? (c.cols as string[]) : null;
    const cols = storedCols ? CHAIN_COLUMNS.map(x => x.key).filter(k => storedCols.includes(k)) : [];
    return {
      ticker: typeof c.ticker === 'string' && c.ticker ? c.ticker : def.ticker,
      /* Any horizon the calendar can list — snapped to the name's own dates on the desk */
      dte: typeof c.dte === 'number' && Number.isFinite(c.dte) && c.dte >= 0 && c.dte <= 400 ? Math.round(c.dte) : def.dte,
      lens: c.lens === 'contract' ? 'contract' : 'stock',
      right: c.right === 'P' ? 'P' : 'C',
      preset: typeof c.preset === 'string' && SCAN_PRESET_KEYS.has(c.preset) ? (c.preset as ScanPreset) : 'gainers',
      depth: typeof c.depth === 'number' && (DESK_DEPTHS as readonly number[]).includes(c.depth) ? c.depth : def.depth,
      cols: cols.length ? cols : [...def.cols],
    };
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
  children,
}: {
  title?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <div className="h-full flex flex-col overflow-hidden rounded-md border border-ink/[0.07] bg-panel">
    {/* min-h, not h: a crowded actions strip (the chain's) wraps, and the
        header must GROW with it — with a fixed height the wrapped chips
        slid under the table and its sticky header ate their clicks. */}
    <div className="shrink-0 flex items-center gap-2 pr-2.5 py-0.5 min-h-8 border-b border-ink/[0.05]">
      {/* The title takes its NATURAL width and keeps it — flex-1 here let the
          chain's loaded strip squeeze it down to "C…". The actions take the
          remainder and wrap; the header grows to fit them. (The drag grip
          that lived here died with the movable desk, 2026-08-30.) */}
      <div className="select-none flex items-center gap-2 pl-2.5 self-stretch shrink-0">
        {title && (
          <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-textPrimary whitespace-nowrap">{title}</span>
        )}
      </div>
      {/* NO overflow-x-auto here: overflow-x forces overflow-y clipping too,
          and it cut the chain's ticker dropdown to a 26px sliver below the
          header (Noah, 2026-08-25: "the chain ticker should have the same
          dropdown as the chart ticker" — it always was the same menu, just
          decapitated). Wide strips wrap instead; the header grows. */}
      {/* THE CARDS HUG THE TITLE (Noah, 2026-09-12: "you see how far apart the
          ticker name is from the other black space and that only happens when
          the left nav bar is open"): the strip flows on from the title instead
          of being pushed to the far edge — when it wraps under a narrow column,
          the first line no longer strands the ticker alone at the right. What
          belongs at the edge (the expand door) carries its own ml-auto. */}
      {actions && (
        <span className="flex flex-1 flex-wrap items-center justify-start gap-1.5 min-w-0">{actions}</span>
      )}
    </div>
    <div className="flex-grow min-h-0">{children}</div>
  </div>
);

/* ---- the chain card -------------------------------------------------------- */
const fmtStrike = (v: number) => (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2));
const fmtCount = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}K` : String(v));

/* ---- the chain's column catalog -------------------------------------------
   Every face of the contract the reference offers that is a FACT (Noah,
   2026-08-26, the customize-columns screenshots). The four return-on-…
   entries stayed out on purpose: a projected yield on a position is strategy
   advice wearing a stat's clothes, and we are not a broker. Order here IS
   column order; the menu speaks the reference's wording, the header speaks
   compact, and every jargon head carries its Term. */
export interface ChainCol {
  key: string;
  /** The menu's wording - the reference's own names */
  label: string;
  /** The column header's compact wording */
  head: string;
  term?: string;
  render: (c: DeskContract) => { text: string; ink?: string; bold?: boolean };
}

const money = (v: number) => `$${v.toFixed(2)}`;
const signedPct = (v: number, dp = 1) => `${v >= 0 ? '+' : ''}${v.toFixed(dp)}%`;

export const CHAIN_COLUMNS: ChainCol[] = [
  { key: 'mark', label: 'Mark', head: 'Mark', term: 'Mark', render: c => ({ text: money(c.mark), bold: true }) },
  { key: 'bid', label: 'Bid', head: 'Bid', render: c => ({ text: money(c.bid) }) },
  { key: 'ask', label: 'Ask', head: 'Ask', render: c => ({ text: money(c.ask) }) },
  { key: 'bidSize', label: 'Bid size', head: 'Bid size', render: c => ({ text: fmtCount(c.bidSize) }) },
  { key: 'askSize', label: 'Ask size', head: 'Ask size', render: c => ({ text: fmtCount(c.askSize) }) },
  { key: 'last', label: 'Last', head: 'Last', render: c => ({ text: money(c.last) }) },
  {
    key: 'netChange',
    label: 'Net change',
    head: 'Net chg',
    render: c => ({
      text: `${c.netChange >= 0 ? '+' : '-'}$${Math.abs(c.netChange).toFixed(2)}`,
      ink: c.netChange >= 0 ? 'text-bull' : 'text-bear',
    }),
  },
  {
    key: 'changePct',
    label: 'Change %',
    head: 'Chg %',
    render: c => ({ text: signedPct(c.netChangePct), ink: c.netChangePct >= 0 ? 'text-bull' : 'text-bear' }),
  },
  { key: 'high', label: 'High', head: 'High', render: c => ({ text: money(c.high) }) },
  { key: 'low', label: 'Low', head: 'Low', render: c => ({ text: money(c.low) }) },
  { key: 'prevClose', label: 'Prev close', head: 'Prev close', render: c => ({ text: money(c.prevClose) }) },
  { key: 'delta', label: 'Delta', head: 'Delta', term: 'Delta', render: c => ({ text: c.delta.toFixed(2) }) },
  { key: 'gamma', label: 'Gamma', head: 'Gamma', term: 'Gamma', render: c => ({ text: c.gamma.toFixed(4) }) },
  { key: 'theta', label: 'Theta', head: 'Theta', term: 'Theta', render: c => ({ text: c.theta.toFixed(4) }) },
  { key: 'vega', label: 'Vega', head: 'Vega', term: 'Vega', render: c => ({ text: c.vega.toFixed(4) }) },
  { key: 'rho', label: 'Rho', head: 'Rho', term: 'Rho', render: c => ({ text: c.rho.toFixed(4) }) },
  { key: 'iv', label: 'IV', head: 'IV', term: 'IV', render: c => ({ text: `${c.iv.toFixed(0)}%` }) },
  { key: 'itm', label: 'Probability ITM', head: 'ITM odds', term: 'ITM odds', render: c => ({ text: `${c.itmOdds.toFixed(0)}%` }) },
  { key: 'otm', label: 'Probability OTM', head: 'OTM odds', term: 'OTM odds', render: c => ({ text: `${(100 - c.itmOdds).toFixed(0)}%` }) },
  {
    key: 'touch',
    label: 'Probability of touching',
    head: 'Touch odds',
    term: 'Touch odds',
    render: c => ({ text: `${c.touchOdds.toFixed(0)}%` }),
  },
  {
    key: 'copLong',
    label: 'Chance of profit (long)',
    head: 'Profit odds L',
    term: 'Profit odds',
    render: c => ({ text: `${c.profitOddsLong.toFixed(0)}%` }),
  },
  {
    key: 'copShort',
    label: 'Chance of profit (short)',
    head: 'Profit odds S',
    term: 'Profit odds',
    render: c => ({ text: `${c.profitOddsShort.toFixed(0)}%` }),
  },
  { key: 'breakeven', label: 'Breakeven', head: 'Breakeven', term: 'Breakeven', render: c => ({ text: money(c.breakeven) }) },
  { key: 'toBreakeven', label: 'To breakeven', head: 'To B/E', term: 'To breakeven', render: c => ({ text: signedPct(c.toBreakevenPct) }) },
  { key: 'intrinsic', label: 'Intrinsic value', head: 'Intrinsic', term: 'Intrinsic value', render: c => ({ text: money(c.intrinsic) }) },
  { key: 'extrinsic', label: 'Extrinsic value', head: 'Extrinsic', term: 'Extrinsic value', render: c => ({ text: money(c.extrinsic) }) },
  { key: 'vol', label: 'Volume', head: 'Vol', term: 'Volume', render: c => ({ text: fmtCount(c.volume) }) },
  { key: 'oi', label: 'Open interest', head: 'OI', term: 'Open interest', render: c => ({ text: fmtCount(c.oi) }) },
];

/** The chain as it has always opened. */
export const DEFAULT_COLS = ['mark', 'delta', 'iv', 'itm', 'vol', 'oi'];
/** The catalog as the Columns card's one group — the reference's own names */
const COLUMN_GROUPS: MultiGroup[] = [{ title: 'Facts', options: CHAIN_COLUMNS.map(c => ({ value: c.key, label: c.label })) }];

/* ---- the chain as a grid ----------------------------------------------------
   THE HOUSE GRID (the walk, 2026-09-11): AG Grid on the house theme at 30px
   rows — only the rows in the window exist, so a ±400 chain scrolls and
   re-inks like a short one (the Trace walk's scroll fix, the one Noah asked
   for here: "the sidebar drag being laggy"). The market's hairline and
   Pulse's inline weigh-up ride as FULL-WIDTH rows; the picked strike is the
   grid's selection (index.css .slayer-chain re-inks it, no re-render); the
   chain still opens centred on the market and the back-to-price pill still
   floats up when the spot row leaves the window. The progressive first paint
   (forty rows, then sixty a frame) is gone with the table: the grid never
   renders a row nobody can see. */
const CHAIN_THEME = GRID_THEME.withParams({ rowHeight: 30, headerHeight: 28, fontSize: 11, cellHorizontalPadding: 8 });
const CHAIN_COL: ColDef<ChainGridRow> = { sortable: false, resizable: true, suppressMovable: true };
type ChainGridRow = { kind: 'row'; key: string; c: DeskContract } | { kind: 'divider'; key: string; spot: number } | { kind: 'drill'; key: string; c: DeskContract };
const CHAIN_ROW_H = 30;
const DIVIDER_H = 22;
const DRILL_H = 210;

/* The strike cell — the chevron turns on the picked row (CSS, off the selection) */
const StrikeCell = ({ data }: ICellRendererParams<ChainGridRow>) =>
  data?.kind === 'row' ? (
    <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold tnum text-textPrimary" data-chain-strike>
      <ChevronRight aria-hidden className="w-3 h-3 shrink-0 text-textMuted" data-chain-chevron />
      {fmtStrike(data.c.strike)}
    </span>
  ) : null;

/* A catalog column's cell: the fact in its ink */
const factCell =
  (col: ChainCol) =>
  ({ data }: ICellRendererParams<ChainGridRow>) => {
    if (data?.kind !== 'row') return null;
    const v = col.render(data.c);
    /* Every figure in the primary ink (Noah, 2026-09-12: "the grey text is hard
       to see") — a direction fact keeps its own colour, the mark stays bold */
    return <span className={`font-mono whitespace-nowrap tnum ${v.bold ? 'text-[11px] font-bold' : 'text-[10px]'} ${v.ink ?? 'text-textPrimary'}`}>{v.text}</span>;
  };

/* The two full-width rows: the market's hairline, and (Pulse) the weigh-up
   unfolding under the picked strike — its height is its content's, measured
   once it paints and handed to the grid */
const FullRow = (p: ICellRendererParams<ChainGridRow>) => {
  const data = p.data;
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (data?.kind !== 'drill' || !ref.current) return;
    const el = ref.current;
    const set = () => {
      const h = Math.ceil(el.getBoundingClientRect().height);
      if (h > 0 && p.node.rowHeight !== h) {
        p.node.setRowHeight(h);
        p.api.onRowHeightChanged();
      }
    };
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, [data, p.node, p.api]);
  if (!data) return null;
  if (data.kind === 'divider') {
    return (
      <div className="h-full px-2 flex items-center select-none" data-chain-divider>
        <span className="flex-1 h-px bg-textPrimary/25" />
        <span className="mx-2 font-mono text-[9px] font-semibold tnum text-textPrimary bg-ink/[0.06] rounded px-1.5 py-0.5">{data.spot.toFixed(2)}</span>
        <span className="flex-1 h-px bg-textPrimary/25" />
      </div>
    );
  }
  return (
    <div ref={ref} className="bg-silver/[0.04] animate-soft-in" data-chain-drill>
      <div className="px-3 py-2.5 border-b border-ink/[0.05] flex flex-col gap-3">
        <WeighGrids c={data.c} />
      </div>
    </div>
  );
};

/* memo, deliberately: this is the desk's whale — 301 rows by up to 29
   columns. It re-renders when its OWN facts change (a chain sweep, a
   selection, a column pick) and sits out everything else. */
export const ChainCard = memo(function ChainCard({
  chain,
  right,
  sel,
  onSelect,
  cols,
  centerKey,
  inlineDrill,
}: {
  chain: DeskChain;
  right: OptionRight;
  sel: number | null;
  onSelect: (strike: number, clicks?: number) => void;
  cols: ChainCol[];
  /** Changes when the ladder itself changes (name, expiry, depth) — the cue
      to re-centre the scroll on the market. A moving spot alone must NOT
      re-centre; it would fight the user's own scrolling every tick. */
  centerKey: string;
  /** Pulse's grammar (Noah, 2026-08-26: "it drops down just right under
      that strike and not all the way at the bottom") — the selected row
      unfolds its weigh-up inline, Robinhood-style. The desk page leaves
      this off; its weigh-up owns the bottom-right card. */
  inlineDrill?: boolean;
}) {
  const gridRef = useRef<AgGridReact<ChainGridRow>>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [away, setAway] = useState<'above' | 'below' | null>(null);
  const [ready, setReady] = useState(false);

  /* High strikes at the top, like a price axis; the market's hairline slots
     between the strikes that bracket it; the weigh-up under the picked one */
  const { rows, dividerIdx } = useMemo(() => {
    const contracts = chain.rows.map(r => (right === 'C' ? r.call : r.put));
    const ordered = [...contracts].reverse();
    const out: ChainGridRow[] = [];
    let divider = -1;
    ordered.forEach((c, i) => {
      out.push({ kind: 'row', key: `s${c.strike}`, c });
      if (inlineDrill && sel != null && Math.abs(c.strike - sel) < 1e-9) out.push({ kind: 'drill', key: `d${c.strike}`, c });
      const next = ordered[i + 1];
      if (c.strike > chain.spot && next && next.strike <= chain.spot) {
        divider = out.length;
        out.push({ kind: 'divider', key: 'divider', spot: chain.spot });
      }
    });
    return { rows: out, dividerIdx: divider };
  }, [chain, right, sel, inlineDrill]);

  const columnDefs = useMemo<ColDef<ChainGridRow>[]>(
    () => [
      { colId: 'strike', headerName: 'Strike', width: 84, cellRenderer: StrikeCell, resizable: false },
      ...cols.map<ColDef<ChainGridRow>>(col => ({
        colId: col.key,
        headerName: col.head,
        headerTooltip: col.label,
        flex: 1,
        minWidth: 68,
        type: 'rightAligned',
        cellRenderer: factCell(col),
      })),
    ],
    [cols]
  );

  /* The picked strike is the grid's selection — synced, never clicked into
     (a click is the desk's: one weighs, two chart) */
  useEffect(() => {
    const api = gridRef.current?.api;
    if (!api || !ready) return;
    api.forEachNode(n => {
      const on = n.data?.kind === 'row' && sel != null && Math.abs(n.data.c.strike - sel) < 1e-9;
      if (n.isSelected() !== on) n.setSelected(on);
    });
  }, [sel, rows, ready]);

  const viewport = () => wrapRef.current?.querySelector<HTMLElement>('.ag-grid-viewport, .ag-body-viewport') ?? null;
  /* Once the spot row leaves the window, the pill floats up with the live
     price and an arrow pointing back the way it went (Noah, 2026-08-25) */
  const locate = useCallback(() => {
    const api = gridRef.current?.api;
    if (!api || dividerIdx < 0) return setAway(null);
    const node = api.getDisplayedRowAtIndex(dividerIdx);
    if (!node || node.rowTop == null) return setAway(null);
    const range = api.getVerticalPixelRange();
    const mid = node.rowTop + (node.rowHeight ?? DIVIDER_H) / 2;
    setAway(mid < range.top + 34 ? 'above' : mid > range.bottom - 8 ? 'below' : null);
  }, [dividerIdx]);
  const centerOnSpot = useCallback(
    (smooth: boolean) => {
      const api = gridRef.current?.api;
      if (!api || dividerIdx < 0) return;
      const node = api.getDisplayedRowAtIndex(dividerIdx);
      const vp = viewport();
      if (!smooth || !node || node.rowTop == null || !vp) {
        api.ensureIndexVisible(dividerIdx, 'middle');
        return;
      }
      vp.scrollTo({ top: Math.max(0, node.rowTop - vp.clientHeight / 2 + (node.rowHeight ?? DIVIDER_H) / 2), behavior: 'smooth' });
    },
    [dividerIdx]
  );
  /* A new ladder (name, expiry, depth) opens centred on the market */
  useEffect(() => {
    if (!ready) return;
    centerOnSpot(false);
    locate();
  }, [centerKey, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={wrapRef} className="slayer-board slayer-chain relative h-full" data-chain-grid={centerKey}>
      <AgGridProvider modules={GRID_MODULES}>
        <AgGridReact<ChainGridRow>
          ref={gridRef}
          theme={CHAIN_THEME}
          rowData={rows}
          columnDefs={columnDefs}
          defaultColDef={CHAIN_COL}
          getRowId={p => p.data.key}
          isFullWidthRow={p => p.rowNode.data?.kind !== 'row'}
          fullWidthCellRenderer={FullRow}
          getRowHeight={p => (p.data?.kind === 'divider' ? DIVIDER_H : p.data?.kind === 'drill' ? DRILL_H : CHAIN_ROW_H)}
          /* One click weighs, two chart: the grid hands the single click through
             as 1 and the double through its own event as 2 (a second click's
             detail is not relied on — the grid may fold it into the double) */
          onRowClicked={(e: RowClickedEvent<ChainGridRow>) => {
            if (e.data?.kind !== 'row') return;
            if (((e.event as MouseEvent | null)?.detail ?? 1) > 1) return;
            onSelect(e.data.c.strike, 1);
          }}
          onRowDoubleClicked={(e: RowDoubleClickedEvent<ChainGridRow>) => {
            if (e.data?.kind !== 'row') return;
            onSelect(e.data.c.strike, 2);
          }}
          rowSelection={{ mode: 'singleRow', checkboxes: false, enableClickSelection: false }}
          suppressCellFocus
          animateRows={false}
          /* The scrollbar's room is reserved from the first sizing pass, so the
             flex columns never lay out under it (the last column was clipped) */
          alwaysShowVerticalScroll
          onFirstDataRendered={() => setReady(true)}
          onBodyScroll={locate}
          onViewportChanged={locate}
          tooltipShowDelay={350}
        />
      </AgGridProvider>
      {away && (
        <button
          onClick={() => centerOnSpot(true)}
          title="Back to the market price"
          className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 inline-flex items-center gap-1.5 rounded-full border border-ink/10 px-3 py-1 font-mono text-[10px] font-semibold tnum text-textPrimary backdrop-blur-[3px] transition-colors hover:bg-ink/[0.08]"
          style={{ background: 'rgb(var(--panel) / 0.85)' }}
          data-chain-away={away}
        >
          {away === 'above' ? <ArrowUp className="w-3 h-3 text-textSecondary" aria-hidden /> : <ArrowDown className="w-3 h-3 text-textSecondary" aria-hidden />}${chain.spot.toFixed(2)}
        </button>
      )}
    </div>
  );
});

/* ---- the scanner as a grid -------------------------------------------------- */
const SCAN_THEME = GRID_THEME.withParams({ rowHeight: 34, headerHeight: 28, fontSize: 11 });
const SCAN_COL: ColDef<ScanRow> = { sortable: false, resizable: false, suppressMovable: true };
const FACT_INK: Record<ScanRow['factInk'], string> = { bull: 'text-bull', bear: 'text-bear', warn: 'text-warn', white: 'text-textPrimary' };

export const ScanGrid = memo(function ScanGrid({ rows, ticker, preset, onPick }: { rows: ScanRow[]; ticker: string; preset: ScanPreset; onPick: (t: string) => void }) {
  const gridRef = useRef<AgGridReact<ScanRow>>(null);
  const kind = SCAN_PRESETS.find(p => p.key === preset) ?? SCAN_PRESETS[0];
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
      /* THE KIND'S OWN FIGURE — the number this kind ranked by, in its ink
         (a gap up green, a report tomorrow amber, a volume plain white) */
      {
        colId: 'fact',
        headerName: kind.fact,
        width: 104,
        type: 'rightAligned',
        headerTooltip: kind.hint,
        cellRenderer: ({ data }: ICellRendererParams<ScanRow>) => (data ? <span className={`font-mono text-[11px] font-semibold tnum ${FACT_INK[data.factInk]}`}>{data.fact}</span> : null),
      },
      /* No grey figures anywhere on the scanner (Noah, 2026-09-12) */
      { colId: 'optvol', headerName: 'Opt vol', width: 84, type: 'rightAligned', headerTooltip: "Contracts traded today across the name's chain", cellRenderer: ({ data }: ICellRendererParams<ScanRow>) => (data ? <span className="font-mono text-[10px] tnum text-textPrimary">{fmtUsd(data.optVolume).replace('$', '')}</span> : null) },
      { colId: 'iv', headerName: 'IV', width: 60, type: 'rightAligned', cellRenderer: ({ data }: ICellRendererParams<ScanRow>) => (data ? <span className="font-mono text-[10px] tnum text-textPrimary">{data.ivPct.toFixed(0)}%</span> : null) },
    ],
    [kind]
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
          overlayNoRowsTemplate={`<span class="font-mono text-[10px] uppercase tracking-widest text-textMuted">${kind.empty}</span>`}
        />
      </AgGridProvider>
    </div>
  );
});

/** One labeled figure in the drilldown - silver label, bright number. */
const StatCell = ({ label, value, term, ink }: { label: string; value: string; term?: string; ink?: string }) => (
  <span className="flex flex-col gap-0.5 min-w-0">
    <span className="font-mono text-[9px] uppercase tracking-widest text-silver whitespace-nowrap">
      {term ? <Term k={term as never}>{label}</Term> : label}
    </span>
    <span className={`font-mono text-[11px] font-semibold tnum ${ink ?? 'text-textPrimary'}`}>{value}</span>
  </span>
);

/** The weigh-up's two sections — Stats and The Greeks — shared verbatim by
    the desk's Strike card and Pulse's inline drilldown, so the two surfaces
    can never drift apart. A fragment on purpose: hosts that SPREAD the
    sections (justify-evenly) need them as direct children. */
const WeighGrids = ({ c }: { c: DeskContract }) => (
  <>
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-textSecondary">Stats</span>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-x-4 gap-y-2.5">
            <StatCell label="Bid" value={`$${c.bid.toFixed(2)}`} />
            <StatCell label="Mark" term="Mark" value={`$${c.mark.toFixed(2)}`} />
            <StatCell label="High" value={`$${c.high.toFixed(2)}`} />
            <StatCell label="Last trade" value={`$${c.last.toFixed(2)}`} />
            <StatCell label="Volume" term="Volume" value={fmtCount(c.volume)} />
            <StatCell label="Ask" value={`$${c.ask.toFixed(2)}`} />
            <StatCell label="Prev close" value={`$${c.prevClose.toFixed(2)}`} />
            <StatCell label="Low" value={`$${c.low.toFixed(2)}`} />
            <StatCell label="IV" term="IV" value={`${c.iv.toFixed(2)}%`} />
            <StatCell label="Open interest" term="Open interest" value={fmtCount(c.oi)} />
            <StatCell label="Breakeven" term="Breakeven" value={`$${c.breakeven.toFixed(2)}`} />
            <StatCell
              label="From spot"
              value={`${c.fromSpotPct >= 0 ? '+' : ''}${c.fromSpotPct.toFixed(1)}%`}
              ink={c.fromSpotPct >= 0 ? 'text-bull' : 'text-bear'}
            />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-textSecondary">The Greeks</span>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-x-4 gap-y-2.5">
            <StatCell label="Delta" term="Delta" value={c.delta.toFixed(4)} />
            <StatCell label="Gamma" term="Gamma" value={c.gamma.toFixed(4)} />
            <StatCell label="Theta / day" term="Theta" value={c.theta.toFixed(4)} />
            <StatCell label="Vega" term="Vega" value={c.vega.toFixed(4)} />
            <StatCell label="Rho" term="Rho" value={c.rho.toFixed(4)} />
          </div>
        </div>
  </>
);

/* States, never orders (the Compass ruling): BUY/WATCH/FADE are internal
   loop vocabulary; the reader sees the state — and THE CASE in one word
   (the walk, 2026-09-11: "High conviction" was a buzzword; the setup page
   says strong / fair / weak off the same score, so this card does too). */
const CASE_WORD = (score: number) => (score >= 93 ? 'strong' : score >= 85 ? 'fair' : 'weak');
const CASE_INK = (score: number) => (score >= 93 ? 'text-bull' : score >= 85 ? 'text-warn' : 'text-bear');
const SLEEVE_WORD: Record<string, string> = { odte: 'same-day', weekly: 'weekly', swing: 'swing', leaps: 'long-dated' };
const DOOR_CLS =
  'inline-flex items-center gap-1 px-2 py-1 rounded-md border border-borderSubtle bg-ink/[0.03] hover:bg-ink/[0.06] font-mono text-[9px] uppercase tracking-wider text-textSecondary hover:text-textPrimary transition-colors';
/* TRANSFORM, never width (Noah, 2026-08-29: "the confidence bars are moving
   very laggy") — width is a LAYOUT property, and a layout animation under
   this desk's per-second churn drops frames; scaleX rides the compositor
   (the Trace live-meter law, applied here). Geometry takes the raw float. */
const METER_GLIDE = 'transition-[transform,background-color] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]';

/* The strike's weigh-up gets its OWN quadrant instead of unfolding inside
   the chain (Noah, 2026-08-26: "to differ from robinhood legend... the empty
   section in the bottom right be the information for the strike you click").
   Every pick lands on a soft fade - keyed remount, the Compass mode-swap
   recipe - and the content spreads to FILL the card rather than huddling at
   the top. Facts only; the greeks stay magnitudes with no direction ink.

   THREE TABS (Noah, 2026-09-12: "this is a weigher based on the parameters we
   will set so it should be the same as compass's but … people might have had
   their own cons and wanted our thoughts with our parameters"):
     Contract — the instrument's own facts, cleaned up and fuller
     Setup    — the take profits, the fair value, the works the Compass page
                carries, for THIS contract
     Verdict  — whether we like it or would fade it, and the reasoning */
export type ContractTab = 'contract' | 'setup' | 'verdict';
export const CONTRACT_TABS: readonly { value: ContractTab; label: string }[] = [
  { value: 'contract', label: 'Contract' },
  { value: 'setup', label: 'Setup' },
  { value: 'verdict', label: 'Verdict' },
];

const VERDICT_WORDS: Record<ContractVerdict, { words: string; ink: string }> = {
  BUY: { words: 'We like it', ink: 'text-bull' },
  WATCH: { words: 'We are watching it', ink: 'text-warn' },
  FADE: { words: 'We would fade it', ink: 'text-bear' },
};
const signedPctWord = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;

/** A group of facts under one whisper head — the Contract tab's grammar */
const FactGroup = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1.5">
    <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-textSecondary">{title}</span>
    <div className="grid grid-cols-3 md:grid-cols-5 gap-x-4 gap-y-2">{children}</div>
  </div>
);

export const StrikeCard = ({
  c,
  contractKey,
  weigh,
  grade,
  boardRank,
  onOpenSetup,
  onSeeBoard,
  tab,
  spot,
}: {
  c: DeskContract | null;
  contractKey: string;
  weigh: WeighYourOwn | null;
  /** THE state — from makeSetup, the same engine that grades the board. */
  grade: Setup | null;
  /** This contract's place on today's board for its sleeve; null = not on it. */
  boardRank: number | null;
  onOpenSetup: () => void;
  onSeeBoard: () => void;
  tab: ContractTab;
  /** The underlying, live — the Setup tab's "needs" column speaks in it */
  spot: number;
}) => {
  if (!c || !weigh || !grade) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-1.5 select-none animate-soft-in">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-textMuted">
          Nothing weighed yet
        </span>
        <span className="font-mono text-[9px] text-textSecondary">
          Click a strike in the chain — its read lands here; a double click puts it on the chart
        </span>
      </div>
    );
  }
  const state = processState(grade);
  const verdict = VERDICT_WORDS[weigh.contract.verdict];

  /* THE SETUP'S OWN MATH — the Compass page's, verbatim: each premium rung
     restated as the stock price that pays it, by THE pricer that minted the
     mid (one-pricer rule). */
  const iv = grade.greeks.iv / 100;
  const sessions = Math.max(grade.sessionsLeft, 0.5);
  const priceAt = (s: number, sess: number) => estimatePremium(s, grade.strike, grade.right, iv, Math.max(sess, 0.05) / 252);
  const needFor = (target: number) => spotForPremium(target, grade.right, priceAt, sessions, spot);

  return (
    <div className="h-full overflow-y-auto animate-soft-in" data-contract-tab={tab}>
      <div className="min-h-full flex flex-col gap-3 px-3.5 py-2.5">
        {tab === 'contract' && (
          <div key={`con-${contractKey}`} className="flex flex-col gap-3 animate-soft-in" data-contract-read>
            <FactGroup title="The quote">
              <StatCell label="Bid" value={`$${c.bid.toFixed(2)}`} />
              <StatCell label="Mark" term="Mark" value={`$${c.mark.toFixed(2)}`} />
              <StatCell label="Ask" value={`$${c.ask.toFixed(2)}`} />
              <StatCell label="Last trade" value={`$${c.last.toFixed(2)}`} />
              <StatCell label="Net change" value={`${c.netChange >= 0 ? '+' : '-'}$${Math.abs(c.netChange).toFixed(2)} (${signedPctWord(c.netChangePct)})`} ink={c.netChange >= 0 ? 'text-bull' : 'text-bear'} />
              <StatCell label="Prev close" value={`$${c.prevClose.toFixed(2)}`} />
              <StatCell label="High" value={`$${c.high.toFixed(2)}`} />
              <StatCell label="Low" value={`$${c.low.toFixed(2)}`} />
              <StatCell label="Bid size" value={fmtCount(c.bidSize)} />
              <StatCell label="Ask size" value={fmtCount(c.askSize)} />
            </FactGroup>
            <FactGroup title="The odds">
              <StatCell label="ITM odds" term="ITM odds" value={`${c.itmOdds.toFixed(0)}%`} />
              <StatCell label="Touch odds" term="Touch odds" value={`${c.touchOdds.toFixed(0)}%`} />
              <StatCell label="Profit odds" term="Profit odds" value={`${c.profitOddsLong.toFixed(0)}%`} />
              <StatCell label="Breakeven" term="Breakeven" value={`$${c.breakeven.toFixed(2)}`} />
              <StatCell label="To breakeven" term="To breakeven" value={signedPctWord(c.toBreakevenPct)} ink={c.toBreakevenPct >= 0 ? 'text-bull' : 'text-bear'} />
            </FactGroup>
            <FactGroup title="The value">
              <StatCell label="Intrinsic" term="Intrinsic value" value={`$${c.intrinsic.toFixed(2)}`} />
              <StatCell label="Extrinsic" term="Extrinsic value" value={`$${c.extrinsic.toFixed(2)}`} />
              <StatCell label="IV" term="IV" value={`${c.iv.toFixed(1)}%`} />
              <StatCell label="Volume" term="Volume" value={fmtCount(c.volume)} />
              <StatCell label="Open interest" term="Open interest" value={fmtCount(c.oi)} />
              <StatCell label="From spot" value={signedPctWord(c.fromSpotPct)} ink={c.fromSpotPct >= 0 ? 'text-bull' : 'text-bear'} />
              <StatCell label="Expires" value={`${grade.expiryDate.slice(5).replace('-', '/')} · ${Math.round(grade.sessionsLeft)} sess.`} />
              <StatCell label="1σ move" value={`±${grade.sigmaMovePct}%`} />
            </FactGroup>
            <FactGroup title="The Greeks">
              <StatCell label="Delta" term="Delta" value={c.delta.toFixed(4)} />
              <StatCell label="Gamma" term="Gamma" value={c.gamma.toFixed(4)} />
              <StatCell label="Theta / day" term="Theta" value={c.theta.toFixed(4)} />
              <StatCell label="Vega" term="Vega" value={c.vega.toFixed(4)} />
              <StatCell label="Rho" term="Rho" value={c.rho.toFixed(4)} />
            </FactGroup>
          </div>
        )}

        {tab === 'setup' && (
          <div key={`setup-${contractKey}`} className="flex flex-col gap-3 animate-soft-in" data-contract-setup>
            {/* The three numbers a setup is priced on — the Compass page's trio */}
            <div className="grid grid-cols-3 gap-2">
              <div className="border border-borderSubtle bg-inset rounded-md px-3 py-2">
                <div className="font-mono text-[9px] uppercase tracking-widest text-textMuted">Premium</div>
                <div className="mt-1 font-mono text-sm font-semibold text-textPrimary tnum">${grade.mid.toFixed(2)}</div>
              </div>
              <div className="border border-borderSubtle bg-inset rounded-md px-3 py-2">
                <div className="font-mono text-[9px] uppercase tracking-widest text-textMuted">Fair value</div>
                <div className="mt-1 font-mono text-sm font-semibold text-textPrimary tnum">${grade.liveMid.toFixed(2)}</div>
              </div>
              <div className="border border-borderSubtle bg-inset rounded-md px-3 py-2">
                <div className="font-mono text-[9px] uppercase tracking-widest text-textMuted">Expected move</div>
                <div className={`mt-1 font-mono text-sm font-semibold tnum ${grade.expectedMovePct >= 0 ? 'text-bull' : 'text-bear'}`}>{signedPctWord(grade.expectedMovePct)}</div>
              </div>
            </div>
            {/* The targets — the Compass page's strict table, for this contract */}
            <div className="border border-borderSubtle rounded-md overflow-hidden">
              <div className="px-3 py-1.5 border-b border-borderSubtle bg-inset">
                <span className="font-mono text-[9px] uppercase tracking-widest text-textMuted">{grade.takeProfits.length > 0 ? 'Targets' : 'Targets — none, the case is fading'}</span>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-borderSubtle">
                    <th className="text-left font-mono text-[9px] uppercase tracking-wider text-textMuted font-medium px-3 py-1.5">Target</th>
                    <th className="text-right font-mono text-[9px] uppercase tracking-wider text-textMuted font-medium px-3 py-1.5">Premium</th>
                    <th className="text-right font-mono text-[9px] uppercase tracking-wider text-textMuted font-medium px-3 py-1.5">From entry</th>
                    <th className="text-right font-mono text-[9px] uppercase tracking-wider text-textMuted font-medium px-3 py-1.5">{grade.ticker} needs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borderSubtle">
                  {[...grade.takeProfits].reverse().map(tp => {
                    const hit = tp.status === 'HIT';
                    const working = tp.status === 'IN PROGRESS';
                    const need = hit ? null : needFor(tp.target);
                    return (
                      <tr key={tp.level} data-setup-target={tp.level} data-status={tp.status}>
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center gap-1.5 font-mono text-[11px] ${hit ? 'text-bull font-semibold' : working ? 'text-textPrimary font-semibold' : 'text-textPrimary'}`}>
                            {hit && <Check className="w-3 h-3" />}
                            Target {tp.level}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-[12px] font-semibold tnum text-textPrimary">${tp.target.toFixed(2)}</td>
                        <td className={`px-3 py-2 text-right font-mono text-[11px] tnum ${hit ? 'text-bull' : 'text-textPrimary'}`}>+{tp.expectedPct}%</td>
                        <td className="px-3 py-2 text-right font-mono text-[11px] tnum text-textPrimary">{need != null ? need.toFixed(2) : '—'}</td>
                      </tr>
                    );
                  })}
                  <tr>
                    <td className="px-3 py-2"><span className="font-mono text-[11px] text-textPrimary">Entry</span></td>
                    <td className="px-3 py-2 text-right font-mono text-[12px] font-semibold tnum text-textPrimary">${grade.mid.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-mono text-[11px] tnum text-textSecondary">—</td>
                    <td className="px-3 py-2 text-right font-mono text-[11px] tnum text-textSecondary">—</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2"><span className="font-mono text-[11px] font-semibold text-bear">{grade.right === 'C' ? 'Floor' : 'Ceiling'}</span></td>
                    <td className="px-3 py-2 text-right font-mono text-[11px] tnum text-textSecondary">—</td>
                    <td className="px-3 py-2 text-right font-mono text-[11px] tnum text-textSecondary">—</td>
                    <td className="px-3 py-2 text-right font-mono text-[12px] font-semibold tnum text-textPrimary whitespace-nowrap">{grade.right === 'C' ? 'below' : 'above'} {grade.invalidationPrice.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
              <p className="px-3 py-2 border-t border-borderSubtle text-[10px] leading-snug text-textPrimary">
                {grade.invalidationReason}. A close through it retires the setup{grade.expiry === '0DTE' ? ' — and nothing here outlives today\u2019s close anyway' : ` — otherwise it runs to ${grade.expiryDate.slice(5).replace('-', '/')}`}.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <StatCell label="1σ move" value={`±${grade.sigmaMovePct}%`} />
              <StatCell label="Swing target" value={`$${grade.swingTarget.price.toFixed(2)} · +${grade.swingTarget.pct}%`} ink="text-bull" />
              <StatCell label="Scalp exit" value={`$${grade.scalpExit.price.toFixed(2)} · +${grade.scalpExit.pct}%`} ink="text-bull" />
            </div>
          </div>
        )}

        {tab === 'verdict' && (
          /* NO key on the container (Noah, 2026-08-29: "transition between
             different cons should have the confidence bars be a smooth
             transition") — the DOM persists across contract switches so the
             bars GLIDE (METER_GLIDE), and only the PROSE crossfades. */
          <div className="flex flex-col justify-evenly gap-2 flex-1" data-contract-verdict>
            <div key={`v-${contractKey}`} className="flex items-center gap-2 flex-wrap animate-soft-in">
              <span className={`font-mono text-[13px] font-bold ${verdict.ink}`} data-verdict={weigh.contract.verdict}>{verdict.words}</span>
              <SignalBadge tone={PROCESS_META[state].tone} dot pulse={PROCESS_META[state].pulse}>
                {state}
              </SignalBadge>
              <span className={`font-mono text-[10px] font-semibold ${CASE_INK(grade.score)}`}>a {CASE_WORD(grade.score)} case</span>
              <span className="font-mono text-[10px] tnum text-textPrimary">{grade.confidence}%</span>
              <span className="ml-auto font-mono text-[9px] text-textSecondary whitespace-nowrap">graded as a {SLEEVE_WORD[grade.sleeve] ?? grade.sleeve} contract</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-[9px] uppercase tracking-widest text-textMuted">The contract itself</span>
              {weigh.contract.factors.map(f => (
                <div key={f.key} className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="w-28 shrink-0 font-mono text-[9px] uppercase tracking-wider text-textSecondary">{f.label}</span>
                    <span className="flex-1 h-[4px] rounded-full bg-ink/[0.06] overflow-hidden">
                      <span
                        className={`block h-full w-full rounded-full origin-left ${METER_GLIDE} ${
                          f.score >= 60 ? 'bg-bull/85' : f.score >= 40 ? 'bg-ink/30' : 'bg-bear/75'
                        }`}
                        style={{ transform: `scaleX(${f.score / 100})` }}
                      />
                    </span>
                  </div>
                  <p key={contractKey} className="pl-28 text-[11px] text-textPrimary leading-snug animate-soft-in">
                    <RichRead text={f.detail} />
                  </p>
                </div>
              ))}
            </div>
            {/* Edge speaks for the trade, risk against it — the labels wear
                their sides (Noah, 2026-08-29: "edge and risk should be color
                coded"). Crossfades with the prose; the sentences stay bright. */}
            <div key={`er-${contractKey}`} className="grid grid-cols-1 gap-1.5 pt-1.5 border-t border-borderSubtle/60 animate-soft-in">
              <p className="text-[11px] leading-snug">
                <span className="font-mono text-[9px] font-semibold uppercase tracking-wider text-bull mr-2">Edge</span>
                <span className="text-textPrimary"><RichRead text={weigh.contract.edge} /></span>
              </p>
              <p className="text-[11px] leading-snug">
                <span className="font-mono text-[9px] font-semibold uppercase tracking-wider text-bear mr-2">Risk</span>
                <span className="text-textPrimary"><RichRead text={weigh.contract.risk} /></span>
              </p>
              <p className="text-[11px] leading-snug">
                <span className="font-mono text-[9px] font-semibold uppercase tracking-wider text-textSecondary mr-2">Why</span>
                <span className="text-textPrimary"><RichRead text={grade.whyText} /></span>
              </p>
            </div>
            {/* The absence answered — the very question that exposed the two
                engines. On the board: say where. Off it: say why plainly. */}
            <div key={`bd-${contractKey}`} className="pt-1.5 border-t border-borderSubtle/60 flex items-center gap-2 flex-wrap animate-soft-in">
              {boardRank != null ? (
                <span className="font-mono text-[10px] text-textPrimary">
                  On today's Compass board · <span className="font-semibold tnum">#{boardRank}</span>
                </span>
              ) : (
                <span className="font-mono text-[10px] text-textSecondary">
                  Not on today's board — it lists only the strongest few
                </span>
              )}
              <span className="ml-auto flex items-center gap-1.5">
                <button onClick={onOpenSetup} className={DOOR_CLS}>
                  <ArrowUpRight className="w-3 h-3" />
                  Setup page
                </button>
                <button onClick={onSeeBoard} className={DOOR_CLS}>
                  <ArrowUpRight className="w-3 h-3" />
                  The board
                </button>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

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
const WeigherDesk = ({ incomingTicker }: { incomingTicker?: string | null }) => {
  /* TWO TIERS, the Pulse rule (Noah, 2026-08-27: "i dont ever have this
     problem with the pulse page"): the light tick runs every snapshot and
     feeds the cheap live readouts — prices, the mood, the charts' bar
     appends. The SCAN tick sweeps every few seconds and feeds the heavy
     rebuilds — the 301-strike chain and the scanner. (The mid-drag freeze
     that used to ride here died with the movable desk.) */
  const [tick, setTick] = useState(0);
  const [scanTick, setScanTick] = useState(0);
  const lastScanRef = useRef(0);
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
  /* Which face of the contract card is up (Noah, 2026-09-12: contract · setup · verdict) */
  const [conTab, setConTab] = useState<ContractTab>('contract');
  const [timeframe, setTimeframe] = useState<Timeframe>('1m');
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
  const scan = useMemo(() => buildScan(preset, ticker), [preset, ticker, scanTick]); // eslint-disable-line react-hooks/exhaustive-deps
  const levels = useMemo(() => buildLevelsFor(ticker), [ticker, tick]);
  const changePct = useMemo(() => spotChangePct(ticker), [ticker, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const prints = useMemo(() => buildPrints(ticker, levels.spot), [ticker]); // eslint-disable-line react-hooks/exhaustive-deps
  /* THE NAME'S OWN DATES (Noah, 2026-09-12: "only show the dates that these
     tickers have cause every ticker may have different option dates") — the
     calendar lists exactly what this name trades, and a stored horizon that
     the name does not list snaps to the nearest one it does. */
  const expiries = useMemo(() => listExpiriesFor(ticker), [ticker, scanTick]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const snapped = nearestListedExpiry(ticker, dte).dte;
    if (snapped !== dte) setDesk(d => ({ ...d, dte: snapped }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker]);
  const shownCols = useMemo(() => CHAIN_COLUMNS.filter(c => cols.includes(c.key)), [cols]);
  // One array per chain per side — the picker's memo depends on this identity.
  const sideContracts = useMemo(() => chain.rows.map(r => (right === 'C' ? r.call : r.put)), [chain, right]);

  /* FULLSCREEN takeovers (Noah, 2026-08-27: "make the ability for the chart
     to be full screen.... same with the chain") — the pressure ladder's
     grammar: portal to <body>, Esc exits on a fade, page scroll locks
     underneath. One card at a time; its grid cell goes blank behind the
     takeover so no chart runs twice. */
  const [full, setFull] = useState<'chart' | 'chain' | null>(null);
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
      className="p-1 rounded text-textMuted hover:text-textPrimary hover:bg-ink/[0.05] transition-colors"
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
    patch({ ticker: t, lens: 'stock', dte: nearestListedExpiry(t, dte).dte });
  };

  /* A deep link arrives with a name (Trace's "Weigh it"). It repoints the
     desk once; after that the desk's own pickers own the ticker again, and
     the stored desk state carries it to the next visit. */
  useEffect(() => {
    if (!incomingTicker || incomingTicker === ticker) return;
    Simulator.ensureTicker(incomingTicker);
    setSel(null);
    patch({ ticker: incomingTicker, lens: 'stock' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingTicker]);

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
      if (next == null) setDesk(d => ({ ...d, lens: 'stock' }));
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
        {contractChg >= 0 ? '\u25b2' : '\u25bc'} ${Math.abs(contractChg).toFixed(2)} ({Math.abs(contractChgPct).toFixed(2)}%)
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
      ]}
      value={lens}
      onChange={v => (v === 'contract' ? selected && patch({ lens: 'contract' }) : patch({ lens: 'stock' }))}
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
      className="absolute top-0 inset-x-0 z-20 flex flex-wrap items-center gap-x-2.5 gap-y-1 pl-2 pr-[76px] py-1 select-none"
      /* Floating chrome the chart's scripts legend measures and sits under (2026-09-10) */
      data-chart-chrome
    >
      {/* THE SAME STRIP AS PULSE, slot for slot (the walk, 2026-09-11): the
          identity, the Stock/Premium door, then the toolbar — timeframes,
          overlays, indicators, alerts, theme — and the expand door last. On
          the half-width card the toolbar drops its words (compact icons); in
          fullscreen it wears Pulse's full words. Replay and the drawing rail
          stay off: review tools, not weighing tools. */}
      {lens === 'contract' && selected != null && sel != null ? (
        <>
          {contractIdentity}
          {lensTabs}
          <TimeframeStrip value={timeframe} onChange={setTimeframe} />
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
          {/* ONE ROW, OR ONE MORE — never a stack (Noah, 2026-09-12: "when the
              left tab is out there's a bunch of space on the top that makes it
              look bad"). The toolbar used to sit in a flex-1 slot that the
              identity and the lens door squeezed to a sliver on the half-width
              card when the sidebar was open, and its controls wrapped one per
              line down the tape. A floor on the slot makes the toolbar wrap AS
              A WHOLE onto the strip's next line, still horizontal; and the
              compact card packs its controls instead of spreading them. */}
          <div className="flex-[1_1_360px] min-w-[300px] max-w-full">
            <ChartToolbar
              minimal
              candles
              spread={full === 'chart'}
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
            />
          </div>
        </>
      )}
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
    </div>
  );

  const chartBody = (
    /* A dark island on any page (2026-09-12): the tape and its strip read the dark tokens */
    <div className="relative h-full bg-panel" data-theme="dark">
      <div className="absolute inset-0">
        {lens === 'contract' && selected ? (
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
     Columns (the catalog, in catalog order), and the expected move as a fact. */
  const chainActions = (
    <span className="flex items-center gap-1.5 flex-wrap">
      <TickerQuickPick ticker={ticker} onPick={pickTicker} slim />
      <DropdownSelect label="Side" value={right} options={SIDE_OPTIONS} onChange={v => patch({ right: v })} title="Calls or puts" testId="weigher-side" />
      <ExpiryCalendar value={isoDate(chain.expiry.date)} expiries={expiries} onChange={e => patch({ dte: e.dte })} pattern={listingPatternFor(ticker)} title="Which contracts the chain lists — the dates this name trades" testId="weigher-expiry" />
      <DropdownSelect label="Reach" value={depth} options={REACH_OPTIONS} onChange={v => patch({ depth: v })} title="How many strikes each side of the market" testId="weigher-reach" />
      <DropdownMulti
        label="Columns"
        values={cols}
        groups={COLUMN_GROUPS}
        onChange={next => patch({ cols: CHAIN_COLUMNS.map(c => c.key).filter(k => next.includes(k)) })}
        emptyWord="Strike only"
        title="Which facts the chain shows"
        testId="weigher-columns"
        align="end"
      />
      <span className="font-mono text-[10px] tnum whitespace-nowrap" title="The move the options are charging for by this expiry">
        <span className="text-textMuted uppercase tracking-widest text-[9px] mr-1">move</span>
        <span className="text-textPrimary font-semibold">±{chain.expectedMovePct.toFixed(1)}%</span>
      </span>
    </span>
  );

  /* The desk's judgment for the strike on the scale — the same scorer the
     Compass runs. Recomputed when the pick or the chain's sweep changes. */
  /* THE STATE — the board's own engine grading this exact contract (the
     dteOverride path makeSetup grew for user-named cons). Same cadence as
     the quality weigh: re-graded when the chain sweeps or the pick moves. */
  const compassGrade = useMemo(() => {
    if (sel == null) return null;
    const cfg = Simulator.TICKERS[ticker];
    if (!cfg) return null;
    return makeSetup(ticker, cfg.currentPrice, sel, right, 'top-setups', cfg.iv, sleeveForDte(chain.expiry.dte), chain.expiry.dte);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, right, ticker, chain]);

  /* Is this con on today's board? The SAME sweep Compass runs for this
     sleeve, checked at pick time — a snapshot answer for a snapshot
     question ("why isn't it there?"). */
  /* THE BOARD IS SWEPT ONCE PER CHAIN, NOT ONCE PER CLICK (Noah, 2026-08-30:
     "very delayed to answer the dropdown"). This used to run the ENTIRE
     Compass board — every name in the universe, every setup scored — on
     every strike pick, purely to look up one contract's rank. The sweep now
     lives on the chain's cadence (and off the click path, since the scan
     tick is a transition); a pick is a find over the flat list. */
  const boardFlat = useMemo(
    () =>
      sel == null
        ? null
        : buildCompassView(
            Simulator.snapshotFor(ticker),
            'top-setups',
            Simulator.universeQuotes(ticker),
            sleeveForDte(chain.expiry.dte)
          ).groups.flatMap(g => g.setups),
    // `sel != null` on purpose: the board is needed while anything is picked,
    // and must not be re-swept because the pick moved a strike.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sel != null, ticker, chain]
  );
  const boardRank = useMemo(() => {
    if (sel == null || !boardFlat) return null;
    const i = boardFlat.findIndex(x => x.ticker === ticker && x.right === right && Math.abs(x.strike - sel) < 1e-9);
    return i >= 0 ? i + 1 : null;
  }, [boardFlat, sel, right, ticker]);

  const navigate = useNavigate();
  const openSetupPage = useCallback(() => {
    if (sel == null) return;
    navigate('/compass', {
      state: { monitor: { ticker, strike: sel, right, scanner: 'top-setups', sleeve: sleeveForDte(chain.expiry.dte), dte: chain.expiry.dte } },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, ticker, sel, right, chain]);
  const seeBoard = useCallback(
    () => navigate('/compass', { state: { tickerFilter: ticker } }),
    [navigate, ticker]
  );

  const weighed = useMemo(
    () => (sel != null ? weighContract(Simulator.snapshotFor(ticker), right, sel, chain.expiry.dte) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sel, right, ticker, chain]
  );

  const chainBody = (
    <ChainCard
      inlineDrill
      chain={chain}
      right={right}
      sel={sel}
      onSelect={pickStrike}
      cols={shownCols}
      centerKey={`${ticker}:${dte}:${depth}`}
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
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-md border border-borderSubtle text-textSecondary shrink-0" aria-hidden="true">
              <Scale className="w-3.5 h-3.5" />
            </span>
            <h1 className="text-[15px] font-semibold leading-tight text-textPrimary">Weigher</h1>
            <GuideDoor open={guideOpen} onClick={() => setGuideOpen(v => !v)} title="What the chain, the read and the chart mean" testId="weigher-guide" />
          </div>
          <p className="mt-0.5 text-[11px] text-textMuted whitespace-nowrap truncate">Chart, chain and scanner on one desk — pick a name, pick a contract, read what it has to clear</p>
        </div>
        <dl
          className="grid grid-flow-col auto-cols-max gap-x-6"
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
      <GuideFocus open={guideOpen} onClose={() => setGuideOpen(false)} title="How to read the Weigher" testId="weigher-guide" viewport>
        <WeigherGuide />
      </GuideFocus>

      {/* THE STATIC FRAME (Noah, 2026-08-30): four cells, drawn once.
          Top row = the chart and the chain, 50/50, on 60% of the height;
          bottom row = the scanner and the strike read, 50/50, on the
          remaining 40%. 3fr/2fr IS 60/40; minmax(0,·) on every track is
          load-bearing — without it a wide chain row or a tall read would
          push its track past the split and the frame would silently stop
          being the frame. */}
      <div className="relative flex-1 min-h-0 mt-4 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] grid-rows-[minmax(0,3fr)_minmax(0,2fr)] gap-2.5" data-weigher-frame>
        <div className="min-h-0 min-w-0">
          {/* NOT a DeskCard: the chart card has no header row — the strip
              inside chartBody is its whole chrome (Noah, 2026-08-29: one
              row, translucent, tape edge to edge). */}
          <div className="h-full relative overflow-hidden rounded-md border border-ink/[0.07] bg-panel">
            {full === 'chart' ? <div className="h-full" /> : chartBody}
          </div>
        </div>

        <div className="min-h-0 min-w-0">
          <DeskCard
            title="Chain"
            actions={
              <>
                {chainActions}
                <span className="ml-auto">{fullBtn('chain')}</span>
              </>
            }
          >
            {full === 'chain' ? <div className="h-full" /> : chainBody}
          </DeskCard>
        </div>

        <div className="min-h-0 min-w-0">
          <DeskCard title="Scanner" actions={<DropdownSelect label="Kind" value={preset} options={KIND_OPTIONS} onChange={v => patch({ preset: v })} title="Which names to look at today" testId="weigher-kind" align="end" />}>
            {/* THE HOUSE GRID (the walk, 2026-09-11) — the roster as an AG Grid
                window: the head pinned, the rows in the house's clothes, the
                desk's name in the where-you-are selection; a row puts that
                name on the desk. */}
            <ScanGrid rows={scan} ticker={ticker} preset={preset} onPick={pickTicker} />
          </DeskCard>
        </div>

        <div className="min-h-0 min-w-0">
          <DeskCard
            title="The contract"
            actions={
              <>
                {selected && sel != null && (
                  <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold tnum text-textPrimary whitespace-nowrap">
                    <CompanyLogo ticker={ticker} size={14} />
                    <span className={right === 'C' ? 'text-bull' : 'text-bear'}>
                      {ticker} {fmtStrike(sel)}
                      {right}
                    </span>
                    <span className="text-textSecondary">· {chain.expiry.dte === 0 ? 'today' : `${chain.expiry.dte}d`}</span>
                  </span>
                )}
                <span className="ml-auto">
                  <CardTabs ariaLabel="The contract's faces" options={CONTRACT_TABS} value={conTab} onChange={setConTab} />
                </span>
              </>
            }
          >
            <StrikeCard
              c={selected}
              weigh={weighed}
              grade={compassGrade}
              boardRank={boardRank}
              onOpenSetup={openSetupPage}
              onSeeBoard={seeBoard}
              contractKey={`${ticker}-${sel ?? 'none'}-${right}-${chain.expiry.dte}`}
              tab={conTab}
              spot={Simulator.TICKERS[ticker]?.currentPrice ?? chain.spot}
            />
          </DeskCard>
        </div>

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
