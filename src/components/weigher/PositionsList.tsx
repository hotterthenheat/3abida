/*
==================================================
  SLAYER TERMINAL - THE DESK'S LIST (components/weigher/PositionsList.tsx)

  One list, two kinds of rows (Noah, 2026-09-14):
  the contracts you WATCH (marked at the moment
  they were added, data/watchlist) and the
  positions you OWN or SOLD (what you paid,
  data/positions — the Map's "Your positions",
  moved here). Each row is tagged, the figures
  read the same way: the mark now, today's move,
  the total since it was added, in dollars then
  in R. A row puts that contract on the desk; the
  picked one wears the where-you-are selection.
  The grid grows with its rows, the scanner's
  clothes.
==================================================
*/

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ColDef, GridSizeChangedEvent, ICellRendererParams, RowClickedEvent } from 'ag-grid-community';
import { AgGridProvider, AgGridReact } from 'ag-grid-react';
import { Trash2 } from 'lucide-react';
import ContractLabel from '../ui/ContractLabel';
import { When } from '../record/when';
import { GRID_MODULES, GRID_THEME } from '../ui/houseGrid';
import type { WatchReturns } from '../../data/watchlist';
import type { WatchedContract } from '../../types/watchlist';
import type { Position, Verdict } from '../../data/positions';

export type ListRow =
  | { kind: 'watch'; id: string; w: WatchedContract; r: WatchReturns }
  | {
      kind: 'own';
      id: string;
      p: Position;
      /** The contract's value now, per share */
      value: number;
      /** Dollars since what was paid — null when the reader gave no cost */
      total: number | null;
      /** …and in R against what was paid */
      totalR: number | null;
    };

export const usdSigned = (v: number) => `${v < 0 ? '−' : '+'}$${Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
export const rSigned = (v: number) => `${v < 0 ? '−' : '+'}${Math.abs(v).toFixed(2)}R`;
/** The direction's ink, and its mark under the blue–orange pair (`dir-up` / `dir-down`, theme/tokens.css) */
export const dirInk = (v: number) => (v > 0 ? 'text-bull dir-up' : v < 0 ? 'text-bear dir-down' : 'text-textPrimary');
export const monthDay = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
export const daysSince = (at: number) => Math.max(0, Math.floor((Date.now() - at) / 86_400_000));
export const fmtStrike = (v: number) => (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2));

const LIST_THEME = GRID_THEME.withParams({ rowHeight: 34, headerHeight: 28, fontSize: 11 });
/** Every column with the Hedging one beside them: 210 + 100 + 72 + 72 + 100 + 108 + 36 = 698 — the column from 700 */
const HEDGE_COLUMN_FROM = 700;
const HEDGE_INK: Record<Verdict, string> = { with: 'text-bull', against: 'text-bear', mixed: 'text-textMuted' };
const HEDGE_SAYS: Record<Verdict, string> = {
  with: 'Dealer hedging works with this contract today — the position card says why',
  against: 'Dealer hedging leans against this contract today — the position card says why',
  mixed: 'Dealer hedging cuts both ways for this contract today — the position card says why',
};
const LIST_COL: ColDef<ListRow> = { sortable: false, resizable: false, suppressMovable: true };

const contractOf = (row: ListRow) => (row.kind === 'watch' ? row.w : row.p);
/** The row's tag — only what differs INSIDE its card (the card's name says the rest, 2026-09-14:
    Your positions and the Watchlist are two cards now) */
export const tagOf = (row: ListRow): string => {
  if (row.kind === 'watch') return row.w.status === 'open' ? '' : row.w.status === 'closed' ? 'closed' : 'settled';
  return row.p.source === 'tracker' ? 'from the Tracker' : row.p.side === 'long' ? '' : 'you sold';
};

export const ListGrid = memo(function ListGrid({
  rows,
  selectedId,
  onPick,
  onRemove,
  emptyText,
  hedgeOf,
  testId,
}: {
  rows: ListRow[];
  selectedId: string | null;
  onPick: (row: ListRow) => void;
  /** OUR TWO CENTS ON EVERY ROW (2026-09-28): whether dealer hedging works with the contract today, against it, or both —
      the position card's own verdict, as one word a row; null = no read (a settled row, a name with no book yet) */
  hedgeOf?: (row: ListRow) => Verdict | null;
  /** THE TRASH BIN on every row (Noah, 2026-09-14: "so delete is relatively easy") — shown on the
      row's hover, the picked row, and under the keyboard; a click removes without picking */
  onRemove?: (row: ListRow) => void;
  emptyText: string;
  testId: string;
}) {
  const gridRef = useRef<AgGridReact<ListRow>>(null);
  /* THE LIST KNOWS ITS ROOM (the chain's head does the same): the Hedging word is a COLUMN of its own where the card is
     wide enough to hold every column with it (1905 wide desks), and rides the contract's own line below that — a column
     pushed Today under a sideways scroll in a 1440 card and the trash bin off a 1600 one (2026-09-28) */
  const [wide, setWide] = useState(false);
  const onGridSizeChanged = useCallback((e: GridSizeChangedEvent<ListRow>) => setWide(e.clientWidth >= HEDGE_COLUMN_FROM), []);
  const hedgeColumn = !!hedgeOf && wide;
  const columnDefs = useMemo<ColDef<ListRow>[]>(
    () => [
      {
        colId: 'contract',
        headerName: 'Contract',
        flex: 1.4,
        /* 222 holds the widest line with the word on it ("× 10 · Sep 21 AGAINST"); a 1600 card has it to spare */
        /* the floor gives way before the Total does (the audit's WE-5: "TO" at 1440, "HEDGI…" at 1920) — the line truncates */
        minWidth: hedgeOf && !hedgeColumn ? 180 : 160,
        cellRenderer: ({ data }: ICellRendererParams<ListRow>) => {
          if (!data) return null;
          const c = contractOf(data);
          const size = data.kind === 'watch' ? data.w.size : data.p.contracts;
          const tag = tagOf(data);
          const hedge = hedgeOf && !hedgeColumn ? hedgeOf(data) : null;
          return (
            <span className="inline-flex items-center gap-1.5 min-w-0">
              <ContractLabel contract={`${c.ticker} ${fmtStrike(c.strike)}${c.right}`} right={c.right} logo={c.ticker} size="sm" />
              <span className="font-mono text-[11px] text-textMuted whitespace-nowrap">
                {size > 1 ? `× ${size} · ` : '· '}
                {tag ? `${tag} · ` : ''}
                {monthDay(c.expiry)}
                {hedge && (
                  <span className={`ml-1 font-semibold uppercase tracking-wide ${HEDGE_INK[hedge]}`} title={HEDGE_SAYS[hedge]} data-list-hedge={hedge}>
                    {hedge}
                  </span>
                )}
              </span>
            </span>
          );
        },
      },
      {
        colId: 'added',
        headerName: 'Added',
        width: 88,
        headerTooltip: 'When it was added — a watched contract is marked then; a position you own carries what you paid',
        cellRenderer: ({ data }: ICellRendererParams<ListRow>) =>
          data ? (
            <span className="font-mono text-[11px] tnum text-textSecondary whitespace-nowrap">
              <When days={daysSince(contractOf(data).addedAt)} size={10} />
            </span>
          ) : null,
      },
      {
        colId: 'mark',
        headerName: 'Mark',
        width: 72,
        type: 'rightAligned',
        cellRenderer: ({ data }: ICellRendererParams<ListRow>) =>
          data ? <span className={`font-mono text-[11px] tnum ${data.kind === 'watch' && data.w.status !== 'open' ? 'text-textSecondary' : 'text-textPrimary'}`}>${(data.kind === 'watch' ? data.r.mark : data.value).toFixed(2)}</span> : null,
      },
      ...(hedgeOf && hedgeColumn
        ? [
            {
              colId: 'hedging',
              headerName: 'Hedging',
              width: 84,
              headerTooltip: 'Whether dealer hedging works with the contract today (with), leans against it (against), or both (mixed) — the position card says why',
              cellRenderer: ({ data }: ICellRendererParams<ListRow>) => {
                if (!data) return null;
                const v = hedgeOf(data);
                return v ? (
                  <span className={`font-mono text-[11px] font-semibold uppercase tracking-wider ${HEDGE_INK[v]}`} title={HEDGE_SAYS[v]} data-list-hedge={v}>
                    {v}
                  </span>
                ) : (
                  <span className="font-mono text-[11px] text-textMuted">—</span>
                );
              },
            } satisfies ColDef<ListRow>,
          ]
        : []),
      {
        colId: 'today',
        headerName: 'Today',
        width: 100,
        type: 'rightAligned',
        headerTooltip: "Today's move against the last session's close — dollars, then R (watched contracts)",
        cellRenderer: ({ data }: ICellRendererParams<ListRow>) =>
          data ? (
            data.kind === 'watch' && data.w.status === 'open' ? (
              <span className={`font-mono text-[11px] tnum ${dirInk(data.r.todayDollars)}`}>
                {usdSigned(data.r.todayDollars)} <span className="text-[11px]">{rSigned(data.r.todayR)}</span>
              </span>
            ) : (
              <span className="font-mono text-[11px] text-textMuted">—</span>
            )
          ) : null,
      },
      {
        colId: 'total',
        headerName: 'Total',
        width: 108,
        type: 'rightAligned',
        headerTooltip: 'Since it was added — dollars, then R; the cost is 1R',
        cellRenderer: ({ data }: ICellRendererParams<ListRow>) => {
          if (!data) return null;
          const d = data.kind === 'watch' ? data.r.totalDollars : data.total;
          const r = data.kind === 'watch' ? data.r.totalR : data.totalR;
          if (d == null || r == null) return <span className="font-mono text-[11px] text-textMuted">no cost given</span>;
          return (
            <span className={`font-mono text-[11px] font-semibold tnum ${dirInk(d)}`}>
              {usdSigned(d)} <span className="text-[11px] font-normal">{rSigned(r)}</span>
            </span>
          );
        },
      },
      ...(onRemove
        ? [
            {
              colId: 'remove',
              headerName: '',
              width: 36,
              cellClass: 'ag-cell-remove',
              cellRenderer: ({ data }: ICellRendererParams<ListRow>) =>
                data ? (
                  <button
                    type="button"
                    onClick={() => onRemove(data)}
                    title={data.kind === 'own' ? 'Remove this position' : 'Remove it from the watchlist'}
                    aria-label={data.kind === 'own' ? 'Remove this position' : 'Remove it from the watchlist'}
                    className="hit inline-flex items-center justify-center w-6 h-6 rounded text-textMuted hover:text-bear hover:bg-ink/[0.06] transition-colors"
                    data-list-remove={data.id}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                ) : null,
            } satisfies ColDef<ListRow>,
          ]
        : []),
    ],
    [onRemove, hedgeOf, hedgeColumn]
  );
  /* The picked row wears the house selection — synced once the grid has its rows */
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const api = gridRef.current?.api;
    if (!api || !ready) return;
    api.forEachNode(n => {
      const on = n.data?.id === selectedId;
      if (n.isSelected() !== on) n.setSelected(on);
    });
  }, [selectedId, rows, ready]);
  return (
    /* a WINDOW (2026-09-14): the card's height is the column's share; the rows past it scroll inside */
    <div className="slayer-board h-full" data-watch-grid={rows.length} data-list={testId}>
      <AgGridProvider modules={GRID_MODULES}>
        <AgGridReact<ListRow>
          ref={gridRef}
          theme={LIST_THEME}
          rowData={rows}
          columnDefs={columnDefs}
          defaultColDef={LIST_COL}
          getRowId={p => p.data.id}
          getRowClass={p => (p.data?.kind === 'watch' && p.data.w.status !== 'open' ? 'opacity-60' : undefined)}
          /* a click that came from the trash bin removes and never picks (React's stopPropagation
             never reaches the grid's native listener — the chain's + door has the same guard) */
          onRowClicked={(e: RowClickedEvent<ListRow>) => {
            if ((e.event?.target as HTMLElement | null)?.closest?.('[data-list-remove]')) return;
            if (e.data) onPick(e.data);
          }}
          rowSelection={{ mode: 'singleRow', checkboxes: false, enableClickSelection: false }}
          suppressCellFocus
          /* rows glide into place when one is added, closed or removed */
          animateRows
          onFirstDataRendered={() => setReady(true)}
          onGridSizeChanged={onGridSizeChanged}
          tooltipShowDelay={350}
          overlayNoRowsTemplate={`<span class="font-mono text-[11px] uppercase tracking-widest text-textMuted">${emptyText}</span>`}
        />
      </AgGridProvider>
    </div>
  );
});
