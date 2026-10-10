/*
==================================================
  SLAYER TERMINAL - THE OPTIONS CHAIN AS A GRID
  (components/weigher/ChainGrid.tsx)

  The Weigher's chain — its column catalog, the grid, the
  market's hairline between strikes, the weigh-up (Stats ·
  The Greeks) unfolding under a picked strike — lifted out
  of pages/weigher/WeigherDesk.tsx on 2026-09-22 so the
  Paper Live Chart could stand the SAME chain beside its
  chart (Noah: "use the Weigher's chain … like we have for
  the dropdown of the weigher options chain"). Nothing in
  it changed for the Weigher; the Live Chart asks for three
  things the Weigher does not: `drillExtra` (the order,
  inside the dropdown), `held` (a HELD mark on a strike the
  reader holds), and the catalog's "Decay a day" column.
==================================================
*/

import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Check, ChevronRight, Plus } from 'lucide-react';
import { HEAT_MODE, heatLadderColor } from '../gex/heatmap';
import { useResolvedTheme } from '../../theme/theme';
import { ShapeChip } from './BookBlock';
import type { BookAtStrike } from '../../data/bookAtStrike';
import { type ColDef, type ICellRendererParams, type RowClickedEvent, type RowDoubleClickedEvent } from 'ag-grid-community';
import { AgGridProvider, AgGridReact } from 'ag-grid-react';
import { GRID_MODULES, GRID_THEME } from '../ui/houseGrid';
import type { MultiGroup } from '../ui/DropdownMulti';
import Term from '../ui/Term';
import { useIsPhone } from '../ui/useMediaQuery';
import type { DeskContract, DeskChain } from '../../data/weigherDesk';
import type { OptionRight } from '../../types/compass';

export const fmtStrike = (v: number) => (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2));
export const fmtCount = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}K` : String(v));

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
  /* what the contract loses a day in DOLLARS a contract — theta × 100, the figure a buyer feels (the Live Chart's chain,
     2026-09-22: "you would need the actual options chain to see the vol, decay etc") */
  { key: 'decay', label: 'Decay a day', head: 'Decay/day', term: 'Theta', render: c => ({ text: `$${Math.abs(c.theta * 100).toFixed(2)}`, ink: 'text-bear' }) },
  /* to a tenth: whole points hid the smile (the audit's CO-21) */
  { key: 'iv', label: 'IV', head: 'IV', term: 'IV', render: c => ({ text: `${c.iv.toFixed(1)}%` }) },
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
export const COLUMN_GROUPS: MultiGroup[] = [{ title: 'Facts', options: CHAIN_COLUMNS.map(c => ({ value: c.key, label: c.label })) }];

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
const CHAIN_THEME = GRID_THEME.withParams({ rowHeight: 30, headerHeight: 28, fontSize: 11, headerFontSize: 10, cellHorizontalPadding: 8 });
const CHAIN_COL: ColDef<ChainGridRow> = { sortable: false, resizable: true, suppressMovable: true };
type ChainGridRow = { kind: 'row'; key: string; c: DeskContract } | { kind: 'divider'; key: string; spot: number } | { kind: 'drill'; key: string; c: DeskContract; extra?: (c: DeskContract) => ReactNode };
const CHAIN_ROW_H = 30;
const DIVIDER_H = 22;
const DRILL_H = 210;

/* The strike cell — the chevron turns on the picked row (CSS, off the selection); a strike the reader HOLDS says so (the
   Live Chart's chain — `held`).
   THE STRIKE CARRIES ITS BOOK (the desk's chain — `book`): the Map's shape chip after the figure, and the strike's net
   gamma as a short bar along the cell's foot on the house ramp — the weight of hedging there. A column of its own was
   built first and pushed the watch door off the chain's right edge at 1440 (2026-09-28); in the strike's cell the chain
   keeps every column it had. The whole read waits in the strike's weigh-up (BookBlock). */
const StrikeCell = ({ data, held, book }: ICellRendererParams<ChainGridRow> & { held?: ReadonlySet<number>; book?: (strike: number) => BookAtStrike | null }) => {
  const paper = useResolvedTheme() === 'light';
  if (data?.kind !== 'row') return null;
  const read = book?.(data.c.strike) ?? null;
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold tnum text-textPrimary" data-chain-strike data-book-cell={read ? read.shape ?? 'none' : undefined}>
      <ChevronRight aria-hidden className="w-3 h-3 shrink-0 text-textMuted" data-chain-chevron />
      {fmtStrike(data.c.strike)}
      {held?.has(data.c.strike) && (
        <span className="ml-1 inline-flex items-center h-[16px] px-1 rounded-sm bg-silver/[0.15] text-[10px] font-bold text-silver leading-none" data-chain-held>
          Held
        </span>
      )}
      {read?.shape && (
        <span className="ml-0.5 inline-flex">
          <ShapeChip shape={read.shape} />
        </span>
      )}
      {read && (
        /* the cell is the containing block (the grid lays its cells out absolutely): the bar rides its foot */
        <span className="absolute left-2 right-2 bottom-[3px] h-[3px] rounded-full bg-ink/[0.06] overflow-hidden" aria-hidden data-book-bar>
          <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.max(3, read.share * 100)}%`, background: heatLadderColor(read.net, Math.max(1, Math.abs(read.net) / Math.max(read.share, 0.01)), HEAT_MODE, paper) }} />
        </span>
      )}
    </span>
  );
};

/* A catalog column's cell: the fact in its ink */
const factCell =
  (col: ChainCol) =>
  ({ data }: ICellRendererParams<ChainGridRow>) => {
    if (data?.kind !== 'row') return null;
    const v = col.render(data.c);
    /* 11 px, the figures a reader acts on (the audit's X9.2: 164 figures at 10 px) */
    return <span className={`font-mono whitespace-nowrap tnum text-[11px] ${v.bold ? 'font-bold' : ''} ${v.ink ?? (v.bold ? 'text-textPrimary' : 'text-textSecondary')}`}>{v.text}</span>;
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
    /* ON THE NEXT FRAME, never inside the commit: telling the grid a row's height from a React effect made it re-render
       through flushSync inside a lifecycle — the console's "flushSync was called from inside a lifecycle method" on every
       strike pressed (the audit's X14, ChainGrid:158) */
    let raf = 0;
    const set = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const h = Math.ceil(el.getBoundingClientRect().height);
        if (h > 0 && p.node.rowHeight !== h) {
          p.node.setRowHeight(h);
          p.api.onRowHeightChanged();
        }
      });
    };
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [data, p.node, p.api]);
  if (!data) return null;
  if (data.kind === 'divider') {
    return (
      <div className="h-full px-2 flex items-center select-none" data-chain-divider>
        <span className="flex-1 h-px bg-textPrimary/25" />
        <span className="mx-2 font-mono text-[10px] font-semibold tnum text-textPrimary bg-ink/[0.06] rounded px-1.5 py-0.5">{data.spot.toFixed(2)}</span>
        <span className="flex-1 h-px bg-textPrimary/25" />
      </div>
    );
  }
  return (
    <div ref={ref} className="bg-silver/[0.04] animate-soft-in" data-chain-drill>
      <div className="px-3 py-2.5 border-b border-ink/[0.05] flex flex-col gap-3">
        <WeighGrids c={data.c} />
        {data.kind === 'drill' && data.extra?.(data.c)}
      </div>
    </div>
  );
};

/* memo, deliberately: this is the desk's whale — 301 rows by up to 29
   columns. It re-renders when its OWN facts change (a chain sweep, a
   selection, a column pick) and sits out everything else. */
/* THE DOOR TO THE WATCHLIST ON EVERY STRIKE (Noah, 2026-09-14: "there should be some sort
   of add to watchlist on the chain like a plus button or something") — a + at the row's end,
   shown on the row's hover; once watched it stays, a check in the where-you-are ink */
const WatchCell = ({ strike, on, onWatch }: { strike: number; on: boolean; onWatch: (strike: number) => void }) => (
  <button
    type="button"
    onClick={e => {
      e.stopPropagation();
      onWatch(strike);
    }}
    title={on ? 'On your watchlist — open it' : "Add to your watchlist — marked at this tick's price"}
    aria-label={on ? 'On your watchlist' : 'Add to your watchlist'}
    className={`hit inline-flex items-center justify-center w-6 h-6 rounded transition-colors ${on ? 'text-silver hover:bg-silver/[0.10]' : 'text-textMuted hover:text-textPrimary hover:bg-ink/[0.08]'}`}
    data-chain-watch={strike}
    data-on={on || undefined}
  >
    {on ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
  </button>
);

export const ChainCard = memo(function ChainCard({
  chain,
  right,
  sel,
  onSelect,
  cols,
  centerKey,
  inlineDrill,
  reveal,
  watched,
  onWatch,
  drillExtra,
  held,
  book,
}: {
  chain: DeskChain;
  right: OptionRight;
  sel: number | null;
  onSelect: (strike: number, clicks?: number) => void;
  cols: ChainCol[];
  /** The strikes on the watchlist for this ladder, and the door that adds one (the desk; Pulse's tile has neither) */
  watched?: ReadonlySet<number>;
  onWatch?: (strike: number) => void;
  /** Changes when the ladder itself changes (name, expiry, depth) — the cue
      to re-centre the scroll on the market. A moving spot alone must NOT
      re-centre; it would fight the user's own scrolling every tick. */
  centerKey: string;
  /** Pulse's grammar (Noah, 2026-08-26: "it drops down just right under
      that strike and not all the way at the bottom") — the selected row
      unfolds its weigh-up inline, Robinhood-style. The desk page leaves
      this off; its weigh-up owns the bottom-right card. */
  inlineDrill?: boolean;
  /** A strike to bring into view — a contract carried in by a deep link
      (Noah, 2026-09-12: "instead of taking me to the spot it should take me
      to the dropdown view of that specific strike"). `n` bumps per ask so
      the same strike asked twice scrolls twice; the row lands at the top
      third, its weigh-up unfolding beneath it. */
  reveal?: { strike: number; n: number } | null;
  /** What the inline dropdown carries under the weigh-up — the Live Chart's order for the contract */
  drillExtra?: (c: DeskContract) => ReactNode;
  /** The strikes the reader holds on this side and expiry: marked on their rows */
  held?: ReadonlySet<number>;
  /** OUR TWO CENTS ON EVERY STRIKE (2026-09-28): the dealer book's read of it — the shape word and the net bar as a
      column, "The book" (data/bookAtStrike.ts); the desk hands it, Pulse's tile does not */
  book?: (strike: number) => BookAtStrike | null;
}) {
  const gridRef = useRef<AgGridReact<ChainGridRow>>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [away, setAway] = useState<'above' | 'below' | null>(null);
  /* the back-to-the-market pill stands at the window's top while a strike's weigh-up fills its foot (the audit's WE-6:
     "↓ $476.76" sat on the drill's "A move through it") */
  const [pillUp, setPillUp] = useState(false);
  /* A PHONE'S CHAIN FITS ITS CARD (the audit's WE-2: 556 px of columns in a 358 px card — the odds, the volume, the open
     interest and the watch door off screen, with no cue): the strike, the mark and the delta, and the + — the rest of a
     contract is in its weigh-up, a press away */
  const phone = useIsPhone();
  const shown = useMemo(() => {
    if (!phone) return cols;
    const keep = cols.filter(c => c.key === 'mark' || c.key === 'delta');
    return keep.length ? keep : cols.slice(0, 2);
  }, [cols, phone]);
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
      if (inlineDrill && sel != null && Math.abs(c.strike - sel) < 1e-9) out.push({ kind: 'drill', key: `d${c.strike}`, c, extra: drillExtra });
      const next = ordered[i + 1];
      if (c.strike > chain.spot && next && next.strike <= chain.spot) {
        divider = out.length;
        out.push({ kind: 'divider', key: 'divider', spot: chain.spot });
      }
    });
    return { rows: out, dividerIdx: divider };
  }, [chain, right, sel, inlineDrill, drillExtra]);

  const columnDefs = useMemo<ColDef<ChainGridRow>[]>(
    () => [
      {
        colId: 'strike',
        headerName: 'Strike',
        headerTooltip: book ? 'The strike, with what the dealer book says about it — its shape (wall · cliff · shelf · void) and, as the bar under it, the weight of hedging there; open the strike for the whole read' : undefined,
        width: held || book ? 116 : 84,
        cellRenderer: StrikeCell,
        cellRendererParams: { held, book },
        resizable: false,
      },
      ...shown.map<ColDef<ChainGridRow>>(col => ({
        colId: col.key,
        headerName: col.head,
        headerTooltip: col.label,
        flex: 1,
        minWidth: phone ? 56 : 72,
        type: 'rightAligned',
        cellRenderer: factCell(col),
      })),
      /* the watchlist door, a narrow last column — the desk's chain only */
      ...(onWatch
        ? [
            {
              colId: 'watch',
              headerName: '',
              headerTooltip: 'Add a contract to your watchlist',
              /* 44 wide, the glyph at the left of it: the grid lays its last column under an
                 overlay scrollbar (headless Chromium, some Macs) — the right 16px stay clear */
              width: 44,
              resizable: false,
              cellRenderer: ({ data }: ICellRendererParams<ChainGridRow>) => (data?.kind === 'row' ? <WatchCell strike={data.c.strike} on={!!watched?.has(data.c.strike)} onWatch={onWatch} /> : null),
            } satisfies ColDef<ChainGridRow>,
          ]
        : []),
    ],
    [shown, phone, watched, onWatch, held, book]
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
    /* a weigh-up reaching into the window's foot sends the pill to the top */
    let drillAtFoot = false;
    api.forEachNode(n => {
      if (n.data?.kind !== 'drill' || n.rowTop == null) return;
      const top = n.rowTop;
      const bottom = top + (n.rowHeight ?? DRILL_H);
      if (bottom > range.bottom - 48 && top < range.bottom) drillAtFoot = true;
    });
    setPillUp(drillAtFoot);
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
  /* …unless a contract was carried in: its row is brought to the top third
     (the market's centring above runs first, this lands after it). Waits for
     the ladder that holds the strike — a name switch lands its rows a render
     later — and asks once per `n`. */
  const revealed = useRef(0);
  useEffect(() => {
    if (!reveal || !ready || revealed.current === reveal.n) return;
    const idx = rows.findIndex(r => r.kind === 'row' && Math.abs(r.c.strike - reveal.strike) < 1e-9);
    if (idx < 0) return;
    const raf = requestAnimationFrame(() => {
      const api = gridRef.current?.api;
      if (!api) return;
      const node = api.getDisplayedRowAtIndex(idx);
      const vp = viewport();
      if (!node || node.rowTop == null || !vp) {
        api.ensureIndexVisible(idx, 'top');
      } else {
        vp.scrollTo({ top: Math.max(0, node.rowTop - vp.clientHeight * 0.28), behavior: 'smooth' });
      }
      revealed.current = reveal.n;
      locate();
    });
    return () => cancelAnimationFrame(raf);
  }, [reveal, ready, rows]); // eslint-disable-line react-hooks/exhaustive-deps

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
            /* the watch door's click is its own — React's stopPropagation never reaches the grid's native listener */
            if ((e.event?.target as HTMLElement | null)?.closest?.('[data-chain-watch]')) return;
            if (((e.event as MouseEvent | null)?.detail ?? 1) > 1) return;
            onSelect(e.data.c.strike, 1);
          }}
          onRowDoubleClicked={(e: RowDoubleClickedEvent<ChainGridRow>) => {
            if (e.data?.kind !== 'row') return;
            if ((e.event?.target as HTMLElement | null)?.closest?.('[data-chain-watch]')) return;
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
          className={`hit absolute ${pillUp ? 'top-9' : 'bottom-3'} left-1/2 -translate-x-1/2 z-20 inline-flex items-center gap-1.5 rounded-full border border-ink/10 px-3 py-1 font-mono text-[11px] font-semibold tnum text-textPrimary backdrop-blur-[3px] transition-colors hover:bg-ink/[0.08]`}
          data-pill-pos={pillUp ? 'top' : 'bottom'}
          style={{ background: 'rgb(var(--panel) / 0.85)' }}
          data-chain-away={away}
        >
          {away === 'above' ? <ArrowUp className="w-3 h-3 text-textSecondary" aria-hidden /> : <ArrowDown className="w-3 h-3 text-textSecondary" aria-hidden />}${chain.spot.toFixed(2)}
        </button>
      )}
    </div>
  );
});


/** One labeled figure in the drilldown - silver label, bright number. */
export const StatCell = ({ label, value, term, ink }: { label: string; value: string; term?: string; ink?: string }) => (
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
export const WeighGrids = ({ c }: { c: DeskContract }) => (
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

