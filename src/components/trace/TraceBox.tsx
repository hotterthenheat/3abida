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

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowUp, ChevronDown } from 'lucide-react';
import { type BodyScrollEvent, type ColDef, type ICellRendererParams, type RowClickedEvent } from 'ag-grid-community';
import { AgGridProvider, AgGridReact } from 'ag-grid-react';
import { GRID_MODULES, GRID_THEME, openRowOnEnter } from '../ui/houseGrid';
import { useIsPhone } from '../ui/useMediaQuery';
import GuideFocus, { GuideDoor } from '../ui/GuideFocus';
import type { Column } from '../ui/DataTable';
import DataState, { type DataStateKind } from '../ui/DataState';
import { withLeadingMark } from '../ui/Name';

/** The tape's rows: 39px on a 32px head (the house grid's feed pages run 44 on 30). The heads are the house's, 11px in
    sentence case (the audit's X9: every Trace grid head was 9px uppercase). */
export const TRACE_GRID_THEME = GRID_THEME.withParams({ rowHeight: 39, headerHeight: 32, fontSize: 12 });
/** A phone's row: two lines, the contract over its figures (see PhoneRow) */
const TRACE_PHONE_THEME = GRID_THEME.withParams({ rowHeight: 58, headerHeight: 0, fontSize: 12 });


/* ---- the head's facts ------------------------------------------------------------ */

export const Fact = ({ label, children, testId, title }: { label: string; children: ReactNode; testId?: string; title?: string }) => (
  <div className="min-w-0" title={title}>
    <dt className="text-[11px] text-textMuted whitespace-nowrap">{label}</dt>
    <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap" data-trace-fact={testId}>
      {children}
    </dd>
  </div>
);

/* 'plain' for a champion that is a MAGNITUDE with no side (the busiest name, the busier tape) — it wore the warn orange,
   the same ink as SWEEP, so orange meant two things on one screen (the audit's TR-18) */
type Ink = 'supreme' | 'bull' | 'bear' | 'warn' | 'plain';
const INK: Record<Ink, string> = { supreme: 'text-supreme', bull: 'text-bull', bear: 'text-bear', warn: 'text-warn', plain: 'text-textSecondary' };

/** A champion: the label in its ink, the row's words as a door onto the row */
export const Champion = ({ label, ink, onOpen, children, testId, title = "Open the contract's card" }: { label: string; ink: Ink; onOpen: () => void; children: ReactNode; testId?: string; title?: string }) => (
  <div className="min-w-0">
    <dt className={`text-[11px] whitespace-nowrap ${INK[ink]}`}>{label}</dt>
    <dd className="mt-0.5 whitespace-nowrap" data-trace-champion={testId}>
      {/* the door's own hover, silver (door.ts) — it underlined on hover before 2026-09-16 */}
      <button type="button" onClick={onOpen} title={title} className="hit font-mono text-[12px] tnum font-semibold text-textPrimary hover:text-silver transition-colors">
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
  /* THE SUMMARY FOLDS ON A PHONE (the audit's TR-15): the facts, the champions and seven cards stood ~470px tall before
     the first row. On a phone the facts are one press away; on a desk they stand as they always did. */
  const [factsOpen, setFactsOpen] = useState(false);
  const subText = typeof sub === 'string' ? sub : undefined;
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
      <div className="px-5 pt-4 pb-3 flex items-start gap-x-6 gap-y-2 flex-wrap max-sm:px-4">
        {/* A FLOOR UNDER THE NAME (2026-09-30): `flex-1` alone is a basis of zero, so the row never wrapped and a long run
            of facts squeezed the box's name to one word a line — "Which way the money leans" stood 49px wide and 94px
            tall at 1440. With a floor the facts go under the name when they cannot sit beside it. */}
        <div className="min-w-[15rem] max-sm:min-w-0 flex-1">
          <div className="min-h-6 flex items-center gap-3">
            {/* AN h2 UNDER THE SHELL'S h1 (the audit's X4.10 and TR-10): it was an h3, a level skipped on every page */}
            <h2 className="text-[15px] font-semibold leading-tight text-textPrimary">{title}</h2>
            {guide && <GuideDoor open={guide.open} onClick={() => guide.onOpen(!guide.open)} title={guide.door} testId={guide.testId} />}
            <button
              type="button"
              onClick={() => setFactsOpen(o => !o)}
              aria-expanded={factsOpen}
              aria-controls={`${testId}-facts`}
              className="hit sm:hidden ml-auto inline-flex items-center gap-1 h-7 px-2 rounded-md border border-borderSubtle text-[11px] text-textSecondary"
              data-trace-summary-toggle
            >
              Summary <ChevronDown className={`w-3 h-3 transition-transform ${factsOpen ? 'rotate-180' : ''}`} aria-hidden />
            </button>
          </div>
          {/* TWO LINES, NOT ONE CUT MID-WORD (the audit's X10): the line said what a row does and lost its end on five
              pages at 1440 and nearly all of it on a phone; it may take a second line, and the whole of it is its title */}
          <p className="mt-0.5 text-[11px] leading-snug text-textMuted line-clamp-2" title={subText}>
            {sub}
          </p>
        </div>
        {/* FLEX-WRAP, NEVER grid-flow-col auto-cols-max. That grid CANNOT
            wrap: on a 390px phone this strip measured 794px wide and four of
            its six facts sat past the right edge with no horizontal scroll to
            reach them — "sweeps · blocks", "0DTE", both champions, simply
            absent. Every Trace page wears this one strip, so it was the same
            four facts missing eleven times. */}
        <dl id={`${testId}-facts`} className={`flex flex-wrap items-start gap-x-6 gap-y-1 ${factsOpen ? '' : 'max-sm:hidden'}`} data-trace-facts>
          {facts}
        </dl>
      </div>
      {/* THE CARDS LINE: one line where it fits; on a phone TWO COLUMNS, every
          card a cell (a wrapping row put the cards wherever they landed —
          Noah: "the buttons just randomly get compressed with no order"); the
          right-hand group (Rail · Columns, `ml-auto`) takes a row of its own
          at the end, still at the right. A card that is a pair of its own (the
          search, Compare's names) spans the line (`data-span`). */}
      <div
        className="px-5 pb-2 flex items-center gap-2 flex-wrap max-sm:px-4 max-sm:grid max-sm:grid-cols-2 max-sm:[&>*]:min-w-0 max-sm:[&>.ml-auto]:col-span-2 max-sm:[&>.ml-auto]:justify-end max-sm:[&>[data-span]]:col-span-2"
        data-trace-controls
      >
        {controls}
      </div>
      {/* A div, not a p: the saved-cuts status inside it is a paragraph of its own (the audit's X14 — a <p> in a <p>) */}
      <div className="px-5 pb-3 text-[12px] leading-relaxed text-textSecondary max-sm:px-4" data-trace-sentence>
        {sentence}
      </div>
      {children}
    </div>
  );
};

/** A PHONE'S ROW (the audit's TR-7): every grid showed about two and a half columns on a 390px screen — the time, the
    ticker and part of the contract — and the premium and the side were a sideways swipe away. On a phone a row is two
    lines: who and what on top, the figures that matter under it. */
export const PhoneRow = ({ lead, title, aside, figures }: { lead?: ReactNode; title: ReactNode; aside?: ReactNode; figures: ReactNode[] }) => (
  <span className="flex flex-col gap-1 py-1.5 w-full leading-none">
    <span className="flex items-center gap-2 min-w-0">
      {lead}
      <span className="min-w-0 flex items-center gap-1.5 font-mono text-[12px] text-textPrimary">{title}</span>
      {aside && <span className="ml-auto shrink-0 font-mono text-[11px] tnum text-textSecondary">{aside}</span>}
    </span>
    <span className="flex items-center gap-x-3 gap-y-0.5 flex-wrap font-mono text-[11px] tnum text-textSecondary pl-5">
      {figures.map((f, i) => (
        <span key={i} className="whitespace-nowrap">
          {f}
        </span>
      ))}
    </span>
  </span>
);

/* ---- the grid in its window ------------------------------------------------------ */

/** A page's Column<T> definitions as AG Grid columns — the cells, inks and doors untouched */
/* A HEAD IS NEVER CUT (2026-10-10, the heads at 11 px in sentence case): a flexible column's floor is its head's own
   width — the words at the grid's head font, the cell's padding either side, and room for the sort arrow — so a narrow
   screen scrolls the grid sideways before it cuts "The clock stands at" to "The clock st…". Measured once a head. */
const headWidths = new Map<string, number>();
let headPen: CanvasRenderingContext2D | null | undefined;
function headWidth(words: string): number {
  const known = headWidths.get(words);
  if (known !== undefined) return known;
  if (headPen === undefined) headPen = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
  let w = words.length * 6.4;
  if (headPen) {
    headPen.font = `600 11px ${getComputedStyle(document.body).fontFamily || 'Helvetica, Arial, sans-serif'}`;
    w = headPen.measureText(words).width;
  }
  const out = Math.ceil(w) + 24 + 18;
  headWidths.set(words, out);
  return out;
}

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
      def.minWidth = Math.max(92, headWidth(def.headerName ?? ''));
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
   page is open. The page's figures (premium, counts, the champions, the drill's list) still read EVERY row.
   IN THE GRID ITSELF, BY THE GRID'S OWN PAGE (2026-09-30, the perf pass — Trace was the repo's own again and every one of
   its pages drew every row: the Screener opened on 33,000 elements and a 550ms freeze). The rows are all handed to the
   grid and the grid shows its first page of 80: a page is cut AFTER the grid sorts, so a column sorted by the reader
   still shows the top 80 of EVERY row, not a sort of whichever 80 came first. A row opened from somewhere else that sits
   past the page opens the rest. */
export const ROWS_AT_REST = 80;
const CAP_SLACK = 20;

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
  /** What a row is, for the foot under a long list: "The first 80 of 412 contracts" */
  noun?: string;
  /** Columns that stand still at the left while the rest scroll (the audit's TR-3) — the row's who and what */
  pinLeft?: string[];
  /** …and at the right: the page's one figure that must always show (the premium, the read, the risk) */
  pinRight?: string[];
  /** The row on a phone, two lines (PhoneRow) — given, a phone shows it in place of the columns (the audit's TR-7) */
  phoneRow?: (row: T) => ReactNode;
  testId: string;
}

export const TraceGrid = <T,>({ rows, columns, hidden, widths, flexes, tooltips, rowKey, onRowClick, selectedKey, height, autoHeight = false, initialSort, rowClass, animate = true, emptyText = 'Nothing on this cut', state = 'empty', emptyBody, onRetry, noun = 'rows', pinLeft, pinRight, phoneRow, testId }: TraceGridProps<T>) => {
  const gridRef = useRef<AgGridReact<T>>(null);
  const phone = useIsPhone() && !!phoneRow;
  /* THE REST (ROWS_AT_REST, above): a grid that grows shows its first page of 80 until the reader asks for all of them */
  const [all, setAll] = useState(false);
  const door = autoHeight && rows.length > ROWS_AT_REST + CAP_SLACK;
  const capped = door && !all;
  /* the row the rest was last opened FOR — asked once per row, so the reader can still fold the list back */
  const openedFor = useRef<string | null>(null);
  const hiddenSet = hidden ?? new Set<string>();
  const columnDefs = useMemo(() => {
    if (phone && phoneRow) {
      /* one column, the row in two lines */
      return [{ colId: 'phone', headerName: '', flex: 1, sortable: false, resizable: false, suppressMovable: true, cellRenderer: (p: ICellRendererParams<T>) => (p.data ? phoneRow(p.data) : null) } as ColDef<T>];
    }
    const defs = columnsToColDefs(columns, hiddenSet, widths, tooltips, flexes);
    for (const d of defs) {
      if (pinLeft?.includes(d.colId ?? '')) d.pinned = 'left';
      else if (pinRight?.includes(d.colId ?? '')) d.pinned = 'right';
    }
    if (initialSort) {
      const d = defs.find(x => x.colId === initialSort.key);
      if (d) d.sort = initialSort.dir;
    }
    return defs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, hiddenSet, widths, tooltips, flexes, phone, phoneRow, pinLeft, pinRight]);
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
  /* whether the cut under way LANDED (its rows went in) — then the come-up below lets the dim go; else nothing will */
  const landing = useRef(false);
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
      landing.current = true;
      setLandN(n => n + 1);
    }, CUT_OUT_MS);
    return () => {
      window.clearTimeout(id);
      /* held at the dim until the come-up takes over (below) — only a cut that landed has one coming; a cut called off
         lets go at once. (Told apart by the time since the last landing, a cut called off within 50ms of one was left
         at the dim with no come-up to lift it: the tape's rows stood at 0.3 — measured in the landing's films, whose
         clock steps a tenth of a second at a time; a quick hand on the filters could do the same.) */
      if (!landing.current) out?.cancel();
      landing.current = false;
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
    let at: number | null = null;
    api.forEachNode(n => {
      const on = !!n.data && rowKey(n.data) === selectedKey;
      if (n.isSelected() !== on) n.setSelected(on);
      if (on) at = n.rowIndex;
    });
    /* the open row sits past the first page (a link, the drill stepping on): the rest opens so it can be seen — once for
       that row, so "Show the first 80" still folds it */
    if (capped && at != null && at >= ROWS_AT_REST && openedFor.current !== selectedKey) {
      openedFor.current = selectedKey ?? null;
      setAll(true);
    }
  }, [selectedKey, rows, rowKey, capped]);
  /* A click on a control inside a cell (the watch mark, a door with its own
     action) is that control's, not the row's — React's stopPropagation never
     reaches the grid's native listener, so the row asks the target itself */
  const onRow = (e: RowClickedEvent<T>) => {
    const target = e.event?.target as HTMLElement | null | undefined;
    if (target?.closest?.('button, a, [data-own-click]')) return;
    if (e.data && onRowClick) onRowClick(e.data);
  };
  /* ROWS THE KEYS CAN OPEN (the audit's X6.1): Tab reached the heads and the bookmarks, never a row. A cell takes focus
     now; the arrows walk the rows, Enter or Space opens the one in focus as the click does, and Tab leaves the grid in
     one step (ui/houseGrid openRowOnEnter) */
  const keys = useMemo(() => openRowOnEnter<T>(row => onRowClick?.(row)), [onRowClick]);

  /* THE SIDEWAYS SCROLL WHERE THE READER IS (the audit's TR-3): a grid that grows with its rows put its own sideways
     scrollbar under its last row, 1,300 to 4,600px down the page. This one stands at the foot of the screen while the
     grid is on it (sticky), the width of the grid's own scrolling part, and the two move together. The key columns are
     pinned, so the row's who and what never leave. */
  const barRef = useRef<HTMLDivElement | null>(null);
  const [span, setSpan] = useState({ sw: 0, cw: 0, left: 0 });
  const measure = useCallback(() => {
    /* AG Grid 36 scrolls the whole grid sideways in one viewport, its pinned columns standing still inside it */
    const v = viewport();
    if (!v) return;
    const sw = v.scrollWidth;
    const cw = v.clientWidth;
    setSpan(o => (o.sw === sw && o.cw === cw ? o : { sw, cw, left: 0 }));
  }, []);
  useEffect(() => {
    if (!autoHeight || phone) return;
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    const t = window.setTimeout(measure, 120);
    return () => {
      ro.disconnect();
      window.clearTimeout(t);
    };
  }, [autoHeight, phone, measure, columnDefs]);
  const scrolling = useRef<'bar' | 'grid' | null>(null);
  const onBar = () => {
    if (scrolling.current === 'grid') return;
    const v = viewport();
    if (!v || !barRef.current) return;
    scrolling.current = 'bar';
    v.scrollLeft = barRef.current.scrollLeft;
    requestAnimationFrame(() => (scrolling.current = null));
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
    else if (barRef.current && scrolling.current !== 'bar') {
      scrolling.current = 'grid';
      barRef.current.scrollLeft = e.left;
      requestAnimationFrame(() => (scrolling.current = null));
    }
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
    <div
      ref={wrapRef}
      className={`slayer-board grid-keys relative border-t border-borderSubtle ${autoHeight && !phone ? '[&_.ag-body-horizontal-scroll]:!hidden' : ''}`}
      style={autoHeight ? undefined : { height }}
      data-trace-grid={testId}
      data-cutting={cutting || undefined}
      data-phone-rows={phone || undefined}
    >
      <AgGridProvider modules={GRID_MODULES}>
        <AgGridReact<T>
          ref={gridRef}
          theme={phone ? TRACE_PHONE_THEME : TRACE_GRID_THEME}
          domLayout={autoHeight ? 'autoHeight' : undefined}
          rowData={gridRows}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          getRowId={p => rowKey(p.data)}
          getRowClass={rowClass ? p => (p.data ? rowClass(p.data) : undefined) : undefined}
          onRowClicked={onRow}
          onBodyScroll={onBodyScroll}
          rowSelection={{ mode: 'singleRow', checkboxes: false, enableClickSelection: true }}
          {...keys}
          animateRows={glide}
          pagination={capped}
          paginationPageSize={ROWS_AT_REST}
          paginationPageSizeSelector={false}
          suppressPaginationPanel
          tooltipShowDelay={350}
          tooltipHideDelay={8000}
          noRowsOverlayComponent={NoRows}
          noRowsOverlayComponentParams={{ kind: state, title: emptyText, body: emptyBody, onRetry }}
        />
      </AgGridProvider>
      {autoHeight && !phone && span.sw > span.cw + 1 && (
        <div
          ref={barRef}
          onScroll={onBar}
          className="sticky bottom-0 z-20 h-3 overflow-x-auto overflow-y-hidden bg-panel/90 border-t border-borderSubtle [scrollbar-width:thin] [scrollbar-color:rgb(var(--text-muted)/0.6)_transparent]"
          style={{ marginLeft: span.left, width: span.cw }}
          aria-hidden
          data-trace-hscroll={testId}
        >
          <div style={{ width: span.sw, height: 1 }} />
        </div>
      )}
      {door && (
        <div className="px-5 py-2.5 border-t border-borderSubtle flex items-center gap-2 text-[11px] text-textSecondary" data-rest-foot={testId} data-capped={capped || undefined}>
          <span>{capped ? `The first ${ROWS_AT_REST} of ${rows.length.toLocaleString('en-US')} ${noun}` : `All ${rows.length.toLocaleString('en-US')} ${noun}`}</span>
          <span className="text-textMuted" aria-hidden>
            ·
          </span>
          <button type="button" onClick={() => setAll(v => !v)} className="font-semibold text-textPrimary hover:text-silver transition-colors" data-rest-door>
            {capped ? 'Show all' : `Show the first ${ROWS_AT_REST}`}
          </button>
        </div>
      )}
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
