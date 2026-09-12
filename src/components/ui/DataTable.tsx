import React, { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUp, ChevronDown, ChevronUp } from 'lucide-react';

/** Rows the first paint carries — about a screen; the window takes over from there */
const FIRST_ROWS = 36;
/* THE WINDOW (2026-09-09, Noah: the sidebar "used to be very laggy" on every
   Trace page): only the rows near the scroll box's viewport are in the DOM,
   with two empty rows holding the height of the rest. Measured before: the
   Screener's 250 rows were 15,000 nodes, and the sidebar's 300ms width
   animation forced five 68ms layouts of all of them; Windows' 287 rows were
   worse. A screen of rows is what the Record's grids draw, and they were
   smooth. The guess is the house row (py-2, text-xs); the first row drawn
   corrects it. */
const ROW_H_GUESS = 39;
const OVERSCAN = 14;

export interface Column<T> {
  key: string;
  /** ReactNode so a header can wrap itself in a Term explainer */
  header: React.ReactNode;
  align?: 'left' | 'right';
  width?: string;
  /** Provide to make the column sortable */
  sortValue?: (row: T) => number | string;
  render: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  selectedKey?: string | null;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
  /** Scroll container height, e.g. "320px" */
  maxHeight?: string;
  emptyText?: string;
  /** Floating door home once the reader is a screen or so deep — the Live
      Tape's back-to-top grammar, aimed at THIS table's own scroller. */
  backToTop?: boolean;
  /** Extra classes for a row (the tape's arrival fade). Keep it referentially
      stable — a fresh function per render is harmless, but the string it
      returns is what the row memo compares. */
  rowClass?: (row: T) => string | undefined;
  /** FROZEN COLUMNS — for a table whose rows ARRIVE (the tape, 2026-09-03,
      moved here from LiveTape where it was born on 2026-08-30: "tables
      shrink then go back to normal spacing"). Measured there: an auto-layout
      table re-spaces every column whenever a wider row lands or scrolls
      off — three times in twenty seconds, columns shifting up to 11px —
      and the whole table breathes sideways under the reader. Frozen, the
      table measures itself ONCE per column set (auto layout, the first body
      row's cells, plus a little slack), then locks those widths into a
      colgroup under fixed layout. A value that genuinely would not fit
      releases the freeze for one re-measure, checked on the newest eight
      rows only, where arrivals land. Off by default: a table that changes
      once a minute (the Screener) has nothing to freeze. */
  freezeColumns?: boolean;
}

/* ONE ROW, MEMOISED (2026-09-03). The tape's rows are immutable prints —
   a print never changes after it lands — so with the table's callbacks and
   column array held stable by the caller, a tick that prepends one row
   re-renders ONE row, not a hundred and twenty. On the once-a-minute pages
   the rows are rebuilt wholesale each minute and the memo simply passes
   through; a selection change now touches the two rows whose `selected`
   flipped instead of the whole table. */
const DataRowInner = <T,>({
  row,
  columns,
  selected,
  onRowClick,
  extra,
}: {
  row: T;
  columns: Column<T>[];
  selected: boolean;
  onRowClick?: (row: T) => void;
  extra?: string;
}) => (
  <tr
    data-row
    onClick={onRowClick ? () => onRowClick(row) : undefined}
    className={`border-b border-borderSubtle/60 last:border-0 transition-colors ${onRowClick ? 'cursor-pointer' : ''} ${
      /* Holographic silver, not lime (Noah, 2026-08-30): a selected
         row is WHERE YOU ARE — the same rail the drilldown's
         latest row and the Weigher's open row wear. */
      selected ? 'bg-silver/[0.06] shadow-[inset_2px_0_0_0_rgba(199,211,232,0.7)]' : 'hover:bg-ink/[0.02]'
    } ${extra ?? ''}`}
  >
    {columns.map(col => (
      <td
        key={col.key}
        className={`px-3 py-2 font-mono text-xs tnum whitespace-nowrap ${col.align === 'right' ? 'text-right' : 'text-left'}`}
      >
        {col.render(row)}
      </td>
    ))}
  </tr>
);
const DataRow = memo(DataRowInner) as typeof DataRowInner;

/** Dense sortable data table. Wrap in <Panel flush> for the standard look. */
const DataTable = <T,>({
  columns,
  rows,
  rowKey,
  onRowClick,
  selectedKey,
  initialSort,
  maxHeight,
  emptyText = 'No data',
  backToTop = false,
  rowClass,
  freezeColumns = false,
}: DataTableProps<T>) => {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(initialSort ?? null);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  /* Which box actually scrolls. Capped (maxHeight) → this table's own box.
     Uncapped → the table flows with the PAGE (Noah, 2026-08-30: "not a static
     box that you scroll INSIDE of... actually be able to scroll DOWN like in
     live tape"), so the door home watches and drives the shell's main. */
  const scrollBox = () => (maxHeight ? scrollerRef.current : (scrollerRef.current?.closest('main') ?? null));
  const [showTop, setShowTop] = useState(false);
  useEffect(() => {
    if (!backToTop) return;
    const el = scrollBox();
    if (!el) return;
    const onScroll = () => setShowTop(el.scrollTop > 600);
    el.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener('scroll', onScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backToTop, maxHeight]);

  /* The tape's own tween: absolute writes on the house curve each frame, so
     nothing can shove scrollTop mid-glide; reduced-motion jumps. */
  const scrollToTop = () => {
    const el = scrollBox();
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
    };
    const step = (now: number) => {
      if (done) return;
      const t = Math.min(1, (now - t0) / DUR);
      const e = 1 - Math.pow(1 - t, 3); // easeOutCubic, the house curve
      el.scrollTop = Math.round(start * (1 - e));
      if (t < 1) requestAnimationFrame(step);
      else finish();
    };
    requestAnimationFrame(step);
    window.setTimeout(finish, DUR + 100);
  };

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find(c => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const sv = col.sortValue;
    return [...rows].sort((a, b) => {
      const va = sv(a);
      const vb = sv(b);
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }, [rows, sort, columns]);

  /* THE WINDOW (see the top of the file): the first paint carries the first
     screen; from then on the scroll box says which rows are near its
     viewport, one placement per frame at most, and the state only changes
     when the window does — a width animation that moves no row costs no
     render. The table body's top is read in the box's scroll space so the
     window is right whether the box is this table's own (maxHeight) or the
     shell's main. */
  const tableRef = useRef<HTMLTableElement | null>(null);
  const total = sortedRows.length;
  const [win, setWin] = useState({ start: 0, end: FIRST_ROWS });
  const rowH = useRef(ROW_H_GUESS);
  useEffect(() => {
    const box = scrollBox();
    const table = tableRef.current;
    if (!box || !table) return;
    let raf = 0;
    const place = () => {
      raf = 0;
      const body = table.tBodies[0];
      if (!body) return;
      /* the row height is the average of the rows drawn, taken once it is
         steady — a single row can be a pixel off its neighbours and half a
         pixel over 250 rows moved the table's end by a hundred (measured) */
      const drawn = body.querySelectorAll<HTMLTableRowElement>('tr[data-row]');
      if (drawn.length >= 4) {
        const avg = [...drawn].reduce((s, r) => s + r.getBoundingClientRect().height, 0) / drawn.length;
        if (avg > 20 && Math.abs(avg - rowH.current) > 1) rowH.current = avg;
      }
      const h = rowH.current;
      const bodyTop = body.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
      const viewTop = box.scrollTop - bodyTop;
      const start = Math.max(0, Math.floor(viewTop / h) - OVERSCAN);
      const end = Math.min(total, Math.max(start + FIRST_ROWS, Math.ceil((viewTop + box.clientHeight) / h) + OVERSCAN));
      setWin(w => (w.start === start && w.end === end ? w : { start, end }));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(place);
    };
    place();
    box.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      box.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, maxHeight]);
  const start = Math.min(win.start, Math.max(0, total - 1));
  const end = Math.min(win.end, total);
  const shownRows = sortedRows.slice(start, end);

  const toggleSort = (col: Column<T>) => {
    if (!col.sortValue) return;
    setSort(prev =>
      prev?.key === col.key ? { key: col.key, dir: prev.dir === 'desc' ? 'asc' : 'desc' } : { key: col.key, dir: 'desc' }
    );
  };

  /* The freeze (see the prop). The column set releases it; so does a cell
     among the newest rows that would clip. Nothing here runs unless asked. */
  const [colWidths, setColWidths] = useState<number[] | null>(null);
  const colSig = columns.map(c => c.key).join('|');
  useLayoutEffect(() => {
    if (freezeColumns) setColWidths(null);
  }, [colSig, freezeColumns]);
  /* A FRAME AFTER EACH COMMIT, never inside it (2026-09-06, the perf sweep):
     measured in a layout effect, the eighteen rects forced the freshly
     rendered table's whole layout early — 12ms of the trace page's open on
     the profiler, and the eight-row clip check the same on every tick. A
     frame on, the browser has laid the table out for paint anyway; the
     first frame simply runs unfrozen. */
  useEffect(() => {
    if (!freezeColumns) return;
    const id = requestAnimationFrame(() => {
      const table = tableRef.current;
      if (!table) return;
      if (!colWidths) {
        if (sortedRows.length === 0) return;
        const tds = table.querySelector('tbody tr')?.querySelectorAll('td');
        if (!tds || tds.length !== columns.length) return;
        const raw = [...tds].map(td => td.getBoundingClientRect().width);
        /* Two cases, told apart by whether the columns are at their NATURAL
           widths (the table overflows its box) or were STRETCHED to fill it.
           Overflowing: round up and add slack, so the next slightly wider
           value still lands without a re-measure. Fitting: every column
           already holds free space, so no slack — and round DOWN, because
           under fixed layout the table grows to the columns' sum, and
           nineteen rounded-up stretched columns summed to 19px past a box
           they fit in, buying a scrollbar for nothing (2026-09-03). */
        const box = scrollerRef.current?.clientWidth ?? 0;
        const total = raw.reduce((s, w) => s + w, 0);
        setColWidths(total > box + 1 ? raw.map(w => Math.ceil(w) + 6) : raw.map(w => Math.floor(w)));
        return;
      }
      const fresh = table.querySelectorAll('tbody tr:nth-child(-n+8) td');
      for (const td of fresh) {
        if (td.scrollWidth > td.clientWidth) {
          setColWidths(null);
          return;
        }
      }
    });
    return () => cancelAnimationFrame(id);
  });
  /* The box changing width (a side rail shown or hidden, a window resized)
     releases the freeze too — frozen widths measured for one box would
     overflow a narrower one and leave a wider one short. ONCE THE WIDTH HAS
     SETTLED (2026-09-09): the sidebar animates its width over 300ms, and
     releasing on every frame of it re-rendered the whole table per frame. */
  useEffect(() => {
    if (!freezeColumns) return;
    const el = scrollerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let last = el.clientWidth;
    let settle = 0;
    const ro = new ResizeObserver(() => {
      window.clearTimeout(settle);
      settle = window.setTimeout(() => {
        const w = el.clientWidth;
        if (w === last) return;
        last = w;
        setColWidths(null);
      }, 160);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      window.clearTimeout(settle);
    };
  }, [freezeColumns]);

  return (
    <div ref={scrollerRef} className="overflow-auto" style={maxHeight ? { maxHeight } : undefined}>
      <table ref={tableRef} className={`w-full border-collapse ${colWidths ? 'table-fixed' : ''}`}>
        {colWidths && (
          <colgroup>
            {colWidths.map((w, i) => (
              <col key={i} style={{ width: w }} />
            ))}
          </colgroup>
        )}
        <thead className="sticky top-0 z-10">
          <tr className="bg-chip border-b border-borderSubtle">
            {columns.map(col => (
              <th
                key={col.key}
                style={col.width ? { width: col.width } : undefined}
                className={`px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-textMuted whitespace-nowrap ${
                  col.align === 'right' ? 'text-right' : 'text-left'
                } ${col.sortValue ? 'cursor-pointer select-none hover:text-textSecondary' : ''}`}
                onClick={() => toggleSort(col)}
              >
                <span className="inline-flex items-center gap-1">
                  {col.align === 'right' && sort?.key === col.key && (
                    sort.dir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />
                  )}
                  {col.header}
                  {col.align !== 'right' && sort?.key === col.key && (
                    sort.dir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-8 text-center font-mono text-[11px] text-textMuted">
                {emptyText}
              </td>
            </tr>
          ) : (
            <>
              {/* the rows above the window, as one empty row of their height */}
              {start > 0 && (
                <tr aria-hidden style={{ height: start * rowH.current }} data-row-spacer="above">
                  <td colSpan={columns.length} className="p-0 border-0" />
                </tr>
              )}
              {shownRows.map(row => {
                const key = rowKey(row);
                return (
                  <DataRow
                    key={key}
                    row={row}
                    columns={columns}
                    selected={selectedKey === key}
                    onRowClick={onRowClick}
                    extra={rowClass?.(row)}
                  />
                );
              })}
              {end < total && (
                <tr aria-hidden style={{ height: (total - end) * rowH.current }} data-row-spacer="below">
                  <td colSpan={columns.length} className="p-0 border-0" />
                </tr>
              )}
            </>
          )}
        </tbody>
      </table>
      {backToTop &&
        showTop &&
        createPortal(
          <button
            onClick={scrollToTop}
            title="Back to top"
            aria-label="Scroll back to the top"
            className="fixed bottom-6 right-6 z-40 inline-flex items-center justify-center w-9 h-9 rounded-full border border-borderMuted bg-panel/90 backdrop-blur-sm text-textSecondary hover:text-textPrimary hover:border-borderMuted hover:bg-panelHover shadow-lg shadow-black/40 transition-colors animate-soft-in"
          >
            <ArrowUp className="w-4 h-4" />
          </button>,
          document.body
        )}
    </div>
  );
};

/* MEMOISED (Noah, 2026-08-30: "some sort of buffer... jolts the entire
   website"). Measured on the Screener: every 1.5s market tick re-rendered
   this table — 250 rows × 17 cells — for 55–104ms, and the minute turn for
   182ms, with nothing on screen changing. The tick reaches every page
   through the market-data context; this table has no business redrawing for
   it unless its rows, columns or selection actually changed. Callers keep
   `rowKey` and `onRowClick` referentially stable (useCallback) so the memo
   can do its job; the cast keeps the generic signature memo() would erase. */
export default memo(DataTable) as typeof DataTable;
