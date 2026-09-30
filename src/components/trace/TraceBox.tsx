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

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
      {/* the door's own hover, silver (door.ts) — it underlined on hover before 2026-09-16 */}
      <button type="button" onClick={onOpen} title="Open the contract's card" className="font-mono text-[12px] tnum font-semibold text-textPrimary hover:text-silver transition-colors">
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
        {/* A FLOOR UNDER THE NAME (2026-09-30): `flex-1` alone is a basis of zero, so the row never wrapped and a long run
            of facts squeezed the box's name to one word a line — "Which way the money leans" stood 49px wide and 94px
            tall at 1440. With a floor the facts go under the name when they cannot sit beside it. */}
        <div className="min-w-[15rem] flex-1">
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
      {/* THE CARDS LINE: one line where it fits; on a phone TWO COLUMNS, every
          card a cell (a wrapping row put the cards wherever they landed —
          Noah: "the buttons just randomly get compressed with no order"); the
          right-hand group (Rail · Columns, `ml-auto`) takes a row of its own
          at the end, still at the right. */}
      <div
        className="px-5 pb-2 flex items-center gap-2 flex-wrap max-sm:grid max-sm:grid-cols-2 max-sm:[&>*]:min-w-0 max-sm:[&>.ml-auto]:col-span-2 max-sm:[&>.ml-auto]:justify-end"
        data-trace-controls
      >
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

/* THE HEAVIEST AT REST, for every grid that grows (lifted from Intervals, 2026-09-20 — Noah, clearing the search on the
   book: "the repositioning… seem to be quite delayed causing it to look like lagging"). A grid that GROWS WITH ITS ROWS
   (autoHeight — the page scrolls, not the grid) draws EVERY row it holds: nothing is windowed. The book at rest is 403
   rows × 17 columns = 6,851 cells, each a React cell, and clearing the search mounted them all in one go — measured, one
   task of 625–668ms with the page frozen under it, and only THEN did the rows start to slide. So at rest a grid holds its
   first 80 rows (they are already ranked — the screen's own order) and a foot says how many there are and opens the rest.
   Never a door for fewer than 20 hidden rows: a door that hides a dozen is chrome. The reader's choice holds while the
   page is open. The page's figures (premium, counts, the champions, the drill's list) still read EVERY row. */
export const ROWS_AT_REST = 80;
const CAP_SLACK = 20;
export interface RestCap<T> {
  shown: T[];
  capped: boolean;
  /** Is there a foot at all */
  door: boolean;
  total: number;
  toggle: () => void;
}
export function useRestCap<T>(rows: T[]): RestCap<T> {
  const [all, setAll] = useState(false);
  const door = rows.length > ROWS_AT_REST + CAP_SLACK;
  const capped = door && !all;
  const shown = useMemo(() => (capped ? rows.slice(0, ROWS_AT_REST) : rows), [rows, capped]);
  return { shown, capped, door, total: rows.length, toggle: () => setAll(v => !v) };
}
export const RestFoot = <T,>({ cap, noun = 'contracts', testId }: { cap: RestCap<T>; noun?: string; testId: string }) =>
  cap.door ? (
    <div className="px-5 py-2.5 border-t border-borderSubtle flex items-center gap-2 text-[11px] text-textSecondary" data-rest-foot={testId} data-capped={cap.capped || undefined}>
      <span>{cap.capped ? `The first ${ROWS_AT_REST} of ${cap.total.toLocaleString('en-US')} ${noun}` : `All ${cap.total.toLocaleString('en-US')} ${noun}`}</span>
      <span className="text-textMuted" aria-hidden>
        ·
      </span>
      <button type="button" onClick={cap.toggle} className="font-semibold text-textPrimary hover:text-silver transition-colors" data-rest-door>
        {cap.capped ? 'Show all' : `Show the first ${ROWS_AT_REST}`}
      </button>
    </div>
  ) : null;

/** How many rows must come or go at once for a change to be A CUT (a card, the search) rather than the tape moving */
const CUT_JUMP = 8;
/** The crossfade: how far the rows step back, how long that takes, how long they take to come up */
const CUT_DIM = 0.3;
const CUT_OUT_MS = 120;
const CUT_IN_MS = 420;

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
  /* A CUT — the search cleared, a card turned, "Show all" — IS A CROSSFADE, NEVER A SLIDE AND NEVER A SWAP (2026-09-20).
     Two complaints from Noah, the same afternoon, on the book:
       · first the wait: clearing the search froze the page ~650ms and THEN two dozen rows slid out to their places among
         hundreds ("the repositioning… seem to be quite delayed"). The slide is for a RE-RANK — the same rows in a new
         order, the eye can follow one. For a cut there is nothing to follow, so a cut never glides (`animateRows` is read
         when the grid redraws, and every changed option is set before the rows are, so turning it off on the render that
         lands the cut is enough; the next re-rank glides again).
       · then, with the wait gone, the opposite: "it just abruptly changes the tape very quickly" — one frame a name's
         rows, the next frame eighty others.
     So a cut is HELD for a moment: the rows the grid has STEP BACK (to 0.3 over 120ms), only then is the grid given the new
     list, and once its rows are in they COME UP to full over 420ms. OPACITY ONLY, on the standard ease — the house rule
     for anything that holds a table (index.css: travel re-rasterises every figure every frame, and the expo curve is at
     0.87 by 90ms, a snap on a layer this large). THE MOUNT HIDES INSIDE THE STEP BACK: eighty rows × seventeen cells take
     ~140ms of main thread, and they are spent while the rows stand still and dim — nothing on screen is moving, so
     nothing can stutter. What is NOT a cut (the tape ticking, a re-rank, a few rows coming or going) passes straight
     through, untouched. Reduced motion: no hold, no fade. Only the ROWS fade; the head stays put. */
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const calm = useMemo(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  const landed = useRef(rows);
  const latest = useRef(rows);
  latest.current = rows;
  const landedAt = useRef(0);
  const [landN, setLandN] = useState(0);
  const cutting = !calm && Math.abs(rows.length - landed.current.length) > Math.max(CUT_JUMP, landed.current.length * 0.15);
  /* what the grid holds: the rows it had, while they step back; else the page's rows as they come */
  const gridRows = cutting ? landed.current : rows;
  useEffect(() => {
    if (!cutting) landed.current = rows;
  });
  const rowsBody = () => wrapRef.current?.querySelector<HTMLElement>('.ag-grid-scrolling-rows') ?? null;
  useEffect(() => {
    if (!cutting) return;
    const body = rowsBody();
    const out = body?.animate([{ opacity: Number(getComputedStyle(body).opacity) || 1 }, { opacity: CUT_DIM }], { duration: CUT_OUT_MS, easing: 'ease-out', fill: 'forwards' });
    const id = window.setTimeout(() => {
      landed.current = latest.current;
      landedAt.current = performance.now();
      setLandN(n => n + 1);
    }, CUT_OUT_MS);
    return () => {
      window.clearTimeout(id);
      /* held at the dim until the come-up takes over (below); a cut that is called off lets go */
      if (performance.now() - landedAt.current > 50) out?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cutting]);
  /* THE COME-UP starts on the first frame AFTER the new rows are in — the grid mounts them in the tasks that follow the
     commit, so the moment is read off the rows themselves (a mutation, then a frame), with a floor so an empty list that
     never mutates still comes up */
  useLayoutEffect(() => {
    if (landN === 0) return;
    const body = rowsBody();
    if (!body) return;
    let raf = 0;
    let done = false;
    const up = () => {
      if (done) return;
      done = true;
      mo.disconnect();
      window.clearTimeout(floor);
      const from = Math.min(Number(getComputedStyle(body).opacity) || CUT_DIM, 0.5);
      body.getAnimations().forEach(a => a.cancel());
      body.animate([{ opacity: from }, { opacity: 1 }], { duration: CUT_IN_MS, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' });
    };
    /* two quiet frames, not one: the grid mounts a long list in two passes (measured: 35 rows, then 80), and a come-up
       begun between them lost its first 95ms to the second */
    const mo = new MutationObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        raf = requestAnimationFrame(up);
      });
    });
    mo.observe(body, { childList: true, subtree: true });
    const floor = window.setTimeout(up, 420);
    return () => {
      cancelAnimationFrame(raf);
      up();
    };
  }, [landN]);
  const glide = animate && !cutting && performance.now() - landedAt.current > 450;
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
    <div ref={wrapRef} className="slayer-board relative border-t border-borderSubtle" style={autoHeight ? undefined : { height }} data-trace-grid={testId} data-cutting={cutting || undefined}>
      <AgGridProvider modules={GRID_MODULES}>
        <AgGridReact<T>
          ref={gridRef}
          theme={TRACE_GRID_THEME}
          domLayout={autoHeight ? 'autoHeight' : undefined}
          rowData={gridRows}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          getRowId={p => rowKey(p.data)}
          getRowClass={rowClass ? p => (p.data ? rowClass(p.data) : undefined) : undefined}
          onRowClicked={onRow}
          onBodyScroll={onBodyScroll}
          rowSelection={{ mode: 'singleRow', checkboxes: false, enableClickSelection: true }}
          suppressCellFocus
          animateRows={glide}
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
