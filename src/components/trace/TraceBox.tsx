/*
==================================================
  SLAYER TERMINAL - THE TRACE BOX (components/trace/TraceBox.tsx)

  The house grammar for every Trace page (the walk,
  2026-09-09): ONE box — the head (15px title, the
  guide door, the 11px line, the facts as a dl with
  the page's champions among them in their inks),
  one line of cards, the sentence, then the body —
  and THE GRID: AG Grid on the house theme at the
  tape's 39px rows, fed by the same Column<T>
  definitions the pages already carry (the adapter
  below), so a page's cells, inks and doors are
  untouched. Since 2026-09-11 the grid GROWS with
  its rows and the page scrolls (Noah: "as long as
  information is flowing then the page should keep
  getting longer", the Compass board's rule) — the
  door home is the page's (BackToTop in the shell);
  a window a screen tall is still there for a host
  that asks for one.

  What it replaces: the composition strip and its
  pills, the FlowTop control row and its filters
  popover of chips, the read strip with its ink
  key, and the hand-rolled table.
==================================================
*/

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowUp } from 'lucide-react';
import { type BodyScrollEvent, type ColDef, type ICellRendererParams, type RowClickedEvent } from 'ag-grid-community';
import { AgGridProvider, AgGridReact } from 'ag-grid-react';
import { GRID_MODULES, GRID_THEME } from '../ui/houseGrid';
import GuideFocus, { GuideDoor } from '../ui/GuideFocus';
import type { Column } from '../ui/DataTable';
import DataState, { type DataStateKind } from '../ui/DataState';
import { withLeadingMark } from '../ui/Name';

/** The tape's rows: 39px on a 32px head (the house grid's feed pages run 44 on 30) */
export const TRACE_GRID_THEME = GRID_THEME.withParams({ rowHeight: 39, headerHeight: 32, fontSize: 12 });

/* ---- the head's facts ------------------------------------------------------------ */

export const Fact = ({ label, children, testId, title }: { label: string; children: ReactNode; testId?: string; title?: string }) => (
  <div className="min-w-0" title={title}>
    <dt className="text-[10px] text-textMuted whitespace-nowrap">{label}</dt>
    <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap" data-trace-fact={testId}>
      {children}
    </dd>
  </div>
);

type Ink = 'supreme' | 'bull' | 'bear' | 'warn';
const INK: Record<Ink, string> = { supreme: 'text-supreme', bull: 'text-bull', bear: 'text-bear', warn: 'text-warn' };

/** A champion: the label in its ink, the row's words as a door onto the row */
export const Champion = ({ label, ink, onOpen, children, testId }: { label: string; ink: Ink; onOpen: () => void; children: ReactNode; testId?: string }) => (
  <div className="min-w-0">
    <dt className={`text-[10px] whitespace-nowrap ${INK[ink]}`}>{label}</dt>
    <dd className="mt-0.5 whitespace-nowrap" data-trace-champion={testId}>
      <button type="button" onClick={onOpen} title="Open the contract's card" className="font-mono text-[12px] tnum font-semibold text-textPrimary hover:underline underline-offset-2 decoration-textMuted">
        {withLeadingMark(children)}
      </button>
    </dd>
  </div>
);

/* ---- the box ---------------------------------------------------------------------- */

interface TraceBoxProps {
  title: string;
  sub: ReactNode;
  /** The dl of facts and champions */
  facts: ReactNode;
  /** The one line of cards */
  controls: ReactNode;
  /** The page's sentence (RichRead + doors) */
  sentence: ReactNode;
  guide?: { title: string; door: string; body: ReactNode; testId: string; open: boolean; onOpen: (v: boolean) => void };
  children: ReactNode;
  testId: string;
  className?: string;
  /** Attributes for the probes */
  data?: Record<string, string | number | undefined>;
}

export const TraceBox = ({ title, sub, facts, controls, sentence, guide, children, testId, className = '', data }: TraceBoxProps) => {
  const attrs = Object.fromEntries(Object.entries(data ?? {}).map(([k, v]) => [`data-${k}`, v]));
  return (
    /* overflow-CLIP, not hidden: hidden makes the box a scroll container, and
       a rail that should stick to the page while the grid runs past a screen
       (the tape's) would stick to the box instead — which never scrolls */
    <div className={`relative border border-borderSubtle rounded-md overflow-clip bg-panel flex flex-col ${className}`} {...attrs} data-trace-box={testId}>
      {guide && (
        <GuideFocus open={guide.open} onClose={() => guide.onOpen(false)} title={guide.title} testId={guide.testId} viewport>
          {guide.body}
        </GuideFocus>
      )}
      <div className="px-5 pt-4 pb-3 flex items-start gap-6 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="h-6 flex items-center gap-3">
            <h3 className="text-[15px] font-semibold leading-tight text-textPrimary">{title}</h3>
            {guide && <GuideDoor open={guide.open} onClick={() => guide.onOpen(!guide.open)} title={guide.door} testId={guide.testId} />}
          </div>
          <p className="mt-0.5 text-[11px] text-textMuted whitespace-nowrap truncate">{sub}</p>
        </div>
        {/* FLEX-WRAP, NEVER grid-flow-col auto-cols-max. That grid CANNOT
            wrap: on a 390px phone this strip measured 794px wide and four of
            its six facts sat past the right edge with no horizontal scroll to
            reach them — "sweeps · blocks", "0DTE", both champions, simply
            absent. Every Trace page wears this one strip, so it was the same
            four facts missing eleven times. */}
        <dl className="flex flex-wrap items-start gap-x-6 gap-y-1" data-trace-facts>
          {facts}
        </dl>
      </div>
      <div className="px-5 pb-2 flex items-center gap-2 flex-wrap" data-trace-controls>
        {controls}
      </div>
      <p className="px-5 pb-3 text-[12px] leading-relaxed text-textSecondary" data-trace-sentence>
        {sentence}
      </p>
      {children}
    </div>
  );
};

/* ---- the grid in its window ------------------------------------------------------ */

/** A page's Column<T> definitions as AG Grid columns — the cells, inks and doors untouched */
export function columnsToColDefs<T>(columns: Column<T>[], hidden: Set<string>, widths: Record<string, number> = {}, tooltips: Record<string, string> = {}, flexes: Record<string, number> = {}): ColDef<T>[] {
  return columns.map(c => {
    const fixed = widths[c.key] ?? (c.width ? parseInt(c.width, 10) : undefined);
    const def: ColDef<T> = {
      colId: c.key,
      headerName: typeof c.header === 'string' ? c.header : c.key.charAt(0).toUpperCase() + c.key.slice(1),
      headerTooltip: tooltips[c.key],
      hide: hidden.has(c.key),
      sortable: !!c.sortValue,
      valueGetter: c.sortValue ? p => (p.data ? c.sortValue!(p.data) : null) : undefined,
      cellRenderer: (p: ICellRendererParams<T>) => (p.data ? c.render(p.data) : null),
      type: c.align === 'right' ? 'rightAligned' : undefined,
      resizable: true,
      suppressMovable: true,
    };
    if (fixed) def.width = fixed;
    else {
      def.flex = flexes[c.key] ?? 1;
      /* 92, not 84: the house's widest standard cell (the Lean bar) is 64px
         and the grid's own padding is 24, so 84 guaranteed a four-pixel
         overflow — and an overflowing cell paints a CLIPPED ELLIPSIS, a
         single stray dot at the cell's edge that reads as a rendering
         fault. A floor below what the house's own cells need is not a
         floor. */
      def.minWidth = 92;
    }
    return def;
  });
}

/** AG Grid's no-rows overlay, in the house's own words. A COMPONENT, not the
    HTML template it was: a template cannot carry an icon, a second line or a
    retry, which is why the grids only ever said one of the four things. */
const NoRows = (p: { kind?: DataStateKind; title?: string; body?: ReactNode; onRetry?: () => void }) => (
  <DataState kind={p.kind ?? 'empty'} title={p.title} body={p.body} onRetry={p.onRetry} pad="sm" />
);

interface TraceGridProps<T> {
  rows: T[];
  columns: Column<T>[];
  hidden?: Set<string>;
  widths?: Record<string, number>;
  /** A wide text column's share of the room (the default is 1) */
  flexes?: Record<string, number>;
  tooltips?: Record<string, string>;
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  selectedKey?: string | null;
  /** A window's height — a screen less the chrome above it (a host that keeps a window) */
  height?: string;
  /** No window: the grid grows with its rows and the PAGE scrolls — every Trace page since 2026-09-11 (the Compass board's rule) */
  autoHeight?: boolean;
  /** The first sort: a column key and its direction */
  initialSort?: { key: string; dir: 'asc' | 'desc' };
  /** Extra classes for a row — the tape's arrival fade, the Tracker's dimmed rows */
  rowClass?: (row: T) => string | undefined;
  /** Rows slide to their new place on a re-sort (off for the tape: a print a second would keep every row moving) */
  animate?: boolean;
  emptyText?: string;
  /* THE FOUR NON-ANSWERS (components/ui/DataState). A table with no rows is
     not automatically EMPTY: it may be still loading, unable to answer at
     all, or broken, and a reader who cannot tell the difference will keep
     loosening a filter that was never the problem. The grids spoke only one
     of the four — a grey line of small caps — so every surface behind them
     said "nothing" whatever had actually happened. */
  state?: DataStateKind;
  /** One line under the headline: what would put something here, or why not */
  emptyBody?: ReactNode;
  onRetry?: () => void;
  testId: string;
}

export const TraceGrid = <T,>({ rows, columns, hidden, widths, flexes, tooltips, rowKey, onRowClick, selectedKey, height, autoHeight = false, initialSort, rowClass, animate = true, emptyText = 'Nothing on this cut', state = 'empty', emptyBody, onRetry, testId }: TraceGridProps<T>) => {
  const gridRef = useRef<AgGridReact<T>>(null);
  const hiddenSet = hidden ?? new Set<string>();
  const columnDefs = useMemo(() => {
    const defs = columnsToColDefs(columns, hiddenSet, widths, tooltips, flexes);
    if (initialSort) {
      const d = defs.find(x => x.colId === initialSort.key);
      if (d) d.sort = initialSort.dir;
    }
    return defs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, hiddenSet, widths, tooltips, flexes]);
  const defaultColDef = useMemo<ColDef<T>>(() => ({ sortable: true, resizable: true, suppressMovable: true }), []);
  /* The open row wears the house selection — the drill's row, wherever the click came from */
  useEffect(() => {
    const api = gridRef.current?.api;
    if (!api) return;
    api.forEachNode(n => {
      const on = !!n.data && rowKey(n.data) === selectedKey;
      if (n.isSelected() !== on) n.setSelected(on);
    });
  }, [selectedKey, rows, rowKey]);
  /* A click on a control inside a cell (the watch mark, a door with its own
     action) is that control's, not the row's — React's stopPropagation never
     reaches the grid's native listener, so the row asks the target itself */
  const onRow = (e: RowClickedEvent<T>) => {
    const target = e.event?.target as HTMLElement | null | undefined;
    if (target?.closest?.('button, a, [data-own-click]')) return;
    if (e.data && onRowClick) onRowClick(e.data);
  };

  /* THE DOOR HOME (Noah, 2026-09-10: "the ability to glide back to the top if
     user scrolls down too far"): the grid scrolls inside its own window, so
     the door watches the grid's body and sits in the window's corner — shown
     once the reader is a screen or so deep (the tape's 600px), gliding home
     on the house curve with absolute writes each frame so a tick cannot
     shove the scroll mid-glide; reduced motion jumps. */
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [showTop, setShowTop] = useState(false);
  /* v36 scrolls the whole grid viewport (`.ag-grid-viewport`); older builds scrolled the body */
  const viewport = () => wrapRef.current?.querySelector<HTMLElement>('.ag-grid-viewport, .ag-body-viewport') ?? null;
  const onBodyScroll = (e: BodyScrollEvent<T>) => {
    if (e.direction === 'vertical') setShowTop(e.top > 600);
  };
  /* Rows cut down under the reader (a card, the search) pull the scroll back without a scroll event */
  useEffect(() => {
    setShowTop((viewport()?.scrollTop ?? 0) > 600);
  }, [rows]);
  const scrollToTop = () => {
    const el = viewport();
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.scrollTop = 0;
      return;
    }
    const start = el.scrollTop;
    const t0 = performance.now();
    const DUR = 450;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      el.scrollTop = 0;
      setShowTop(false);
    };
    const step = (now: number) => {
      if (done) return;
      const t = Math.min(1, (now - t0) / DUR);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic, the house curve
      el.scrollTop = Math.round(start * (1 - eased));
      if (t < 1) requestAnimationFrame(step);
      else finish();
    };
    requestAnimationFrame(step);
    window.setTimeout(finish, DUR + 100);
  };

  return (
    <div ref={wrapRef} className="slayer-board relative border-t border-borderSubtle" style={autoHeight ? undefined : { height }} data-trace-grid={testId}>
      <AgGridProvider modules={GRID_MODULES}>
        <AgGridReact<T>
          ref={gridRef}
          theme={TRACE_GRID_THEME}
          domLayout={autoHeight ? 'autoHeight' : undefined}
          rowData={rows}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          getRowId={p => rowKey(p.data)}
          getRowClass={rowClass ? p => (p.data ? rowClass(p.data) : undefined) : undefined}
          onRowClicked={onRow}
          onBodyScroll={onBodyScroll}
          rowSelection={{ mode: 'singleRow', checkboxes: false, enableClickSelection: true }}
          suppressCellFocus
          animateRows={animate}
          tooltipShowDelay={350}
          tooltipHideDelay={8000}
          noRowsOverlayComponent={NoRows}
          noRowsOverlayComponentParams={{ kind: state, title: emptyText, body: emptyBody, onRetry }}
        />
      </AgGridProvider>
      {showTop && !autoHeight && (
        <button
          onClick={scrollToTop}
          title="Back to top"
          aria-label="Scroll back to the top"
          data-trace-top
          className="absolute bottom-5 right-6 z-10 inline-flex items-center justify-center w-9 h-9 rounded-full border border-borderMuted bg-panel/90 backdrop-blur-sm text-textSecondary hover:text-textPrimary hover:bg-panelHover shadow-lg shadow-black/40 transition-colors animate-soft-in"
        >
          <ArrowUp className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default TraceBox;
