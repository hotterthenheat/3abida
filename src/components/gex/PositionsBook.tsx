/*
==================================================
  SLAYER TERMINAL - YOUR POSITIONS
  (components/gex/PositionsBook.tsx)

  The Position Overlay's own section — the last
  question in the Map's read: WHAT DOES THIS MEAN
  FOR ME. A card per contract (PositionCard: the
  payoff sketch with the walls and the flip on it,
  one verdict chip, five facts, the sentence), and
  the grid kept behind "As a table" for a reader
  with twenty of them.

  REDONE 2026-09-05 on the grammar Noah chose from
  TradingView's strategy builder and Robinhood's
  holding cards: air instead of borders, labels
  above values, one accent, pills for choices, a
  popover form (PositionForm) to add or change a
  position instead of typing into cells.

  Positions can come in from the Tracker: a
  contract tracked on Compass is one you care
  about, so the head offers those with one click.
==================================================
*/

import { useCallback, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { AllCommunityModule, colorSchemeDark, themeQuartz, type CellValueChangedEvent, type ColDef, type ICellRendererParams, type RowClickedEvent } from 'ag-grid-community';
import { AgGridProvider, AgGridReact } from 'ag-grid-react';
import { useTracker } from '../../context/TrackerContext';
import { addPosition, positionFromTracked, positionsLine, readPosition, trackedNotIn, updatePosition, usePositions, type Position, type PositionRead } from '../../data/positions';
import { fmtUsd } from '../../data/gex';
import PositionCard from './PositionCard';
import PositionForm from './PositionForm';
import type { ExposureProfileData } from '../../types/gex';
import { TickerText } from '../ui/Name';

const MODULES = [AllCommunityModule];
const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */
const SILVER_FILL = 'rgb(var(--silver-fill))'; /* the silver as a SURFACE — a filled pill with the dark word on it, the holo flat form on either ground */
const fmtStrike = (v: number) => (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2));

/* The Board's theme — one grid grammar across Pinpoint */
const THEME = themeQuartz.withPart(colorSchemeDark).withParams({
  backgroundColor: '#0a0a0a',
  foregroundColor: 'rgb(var(--text-primary))',
  headerBackgroundColor: '#0c0c0c',
  headerTextColor: 'rgb(var(--text-secondary))',
  headerFontSize: 9,
  headerFontWeight: 600,
  headerHeight: 30,
  rowHeight: 40,
  fontSize: 11,
  fontFamily: 'inherit',
  borderColor: '#1c1c1c',
  rowBorder: true,
  columnBorder: false,
  wrapperBorder: false,
  wrapperBorderRadius: 0,
  headerColumnBorder: false,
  rowHoverColor: 'rgb(var(--ink) / 0.03)',
  selectedRowBackgroundColor: 'rgb(var(--silver) / 0.06)',
  accentColor: 'rgb(var(--silver))',
  cellHorizontalPadding: 12,
  iconSize: 12,
  inputBackgroundColor: 'rgb(var(--panel))',
  inputBorder: { color: 'rgb(var(--silver))', width: 1 },
  browserColorScheme: 'inherit',
});

type Row = Position & { read: PositionRead };

// ---- the table view's cells ------------------------------------------------------

const StrikeCell = ({ data }: ICellRendererParams<Row>) => (data ? <span className="font-mono text-[12px] font-bold tnum text-textPrimary">{fmtStrike(data.strike)}</span> : null);
const RightCell = ({ data }: ICellRendererParams<Row>) => (data ? <span className="text-[11px] text-textPrimary">{data.right === 'P' ? 'Put' : 'Call'}</span> : null);
const SideCell = ({ data }: ICellRendererParams<Row>) => (data ? <span className="text-[11px] text-textPrimary">{data.side === 'short' ? 'You sold' : 'You own'}</span> : null);
const ContractsCell = ({ value }: ICellRendererParams<Row, number>) => <span className="font-mono text-[12px] font-bold tnum text-textPrimary">{value}</span>;
const EntryCell = ({ data }: ICellRendererParams<Row>) => (data ? <span className="font-mono text-[11px] tnum text-textPrimary">{data.entry != null ? data.entry.toFixed(2) : '—'}</span> : null);
const ExpiryCell = ({ data }: ICellRendererParams<Row>) =>
  data ? (
    <span className="inline-flex items-baseline gap-2 font-mono tnum">
      <span className="text-[11px] text-textPrimary">{data.expiry.slice(5).replace('-', '/')}</span>
      <span className="text-[10px] text-textSecondary">{data.read.expires}</span>
    </span>
  ) : null;
const SitsCell = ({ data }: ICellRendererParams<Row>) => (data ? <span className="text-[11px] text-textSecondary truncate">{data.read.sits}</span> : null);
const HedgingCell = ({ data }: ICellRendererParams<Row>) => (data ? <span className="text-[11px] text-textSecondary whitespace-normal leading-snug py-1.5 block">{data.read.hedging}</span> : null);
const GammaCell = ({ data }: ICellRendererParams<Row>) =>
  data ? <span className={`font-mono text-[11px] tnum ${data.read.gammaHere === 0 ? 'text-textMuted' : data.read.gammaHere > 0 ? 'text-bear' : 'text-bull'}`}>{data.read.gammaHere === 0 ? 'outside the window' : fmtUsd(data.read.gammaHere)}</span> : null;

// ---- the section ----------------------------------------------------------------------

interface PositionsBookProps {
  profile: ExposureProfileData;
  focus: number | null;
  onPick: (strike: number) => void;
}

const PositionsBook = ({ profile, focus, onPick }: PositionsBookProps) => {
  const ticker = profile.ticker;
  const positions = usePositions(ticker);
  const { trackedSetups } = useTracker();
  const [view, setView] = useState<'cards' | 'table'>('cards');

  const reads = useMemo(() => new Map(positions.map(p => [p.id, readPosition(p, profile)])), [positions, profile]);
  const sorted = useMemo(() => [...positions].sort((a, b) => b.strike - a.strike || a.right.localeCompare(b.right)), [positions]);
  const rows = useMemo<Row[]>(() => sorted.map(p => ({ ...p, read: reads.get(p.id)! })), [sorted, reads]);
  const line = useMemo(() => positionsLine(ticker, positions, reads, profile.levels.spot), [ticker, positions, reads, profile.levels.spot]);
  const fromTracker = useMemo(() => trackedNotIn(trackedSetups, ticker, positions), [trackedSetups, ticker, positions]);
  const contracts = positions.reduce((s, p) => s + p.contracts, 0);
  const spot = profile.levels.spot;
  const lo = profile.strikes.length ? Math.min(...profile.strikes.map(s => s.strike)) : spot * 0.97;
  const hi = profile.strikes.length ? Math.max(...profile.strikes.map(s => s.strike)) : spot * 1.03;
  const nearest = profile.strikes.reduce((best, s) => (Math.abs(s.strike - spot) < Math.abs(best - spot) ? s.strike : best), profile.strikes[0]?.strike ?? spot);

  const importTracked = useCallback(() => {
    for (const t of fromTracker) addPosition(positionFromTracked(t));
  }, [fromTracker]);

  const onChanged = useCallback((e: CellValueChangedEvent<Row>) => {
    const field = e.colDef.field as keyof Position | undefined;
    if (!field || !e.data) return;
    if (field === 'strike') {
      const v = Number(e.newValue);
      if (Number.isFinite(v) && v > 0) updatePosition(e.data.id, { strike: v });
    } else if (field === 'contracts') {
      const v = Math.max(1, Math.round(Number(e.newValue)));
      if (Number.isFinite(v)) updatePosition(e.data.id, { contracts: v });
    } else if (field === 'entry') {
      const raw = e.newValue;
      if (raw === null || raw === undefined || raw === '') updatePosition(e.data.id, { entry: undefined });
      else if (Number.isFinite(Number(raw)) && Number(raw) >= 0) updatePosition(e.data.id, { entry: Number(raw) });
    } else if (field === 'expiry') {
      if (typeof e.newValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.newValue)) updatePosition(e.data.id, { expiry: e.newValue });
    }
  }, []);

  const columnDefs = useMemo<ColDef<Row>[]>(
    () => [
      { headerName: 'Strike', field: 'strike', width: 96, editable: true, cellEditor: 'agNumberCellEditor', cellEditorParams: { min: 0, precision: 2 }, cellRenderer: StrikeCell, sort: 'desc' },
      { headerName: 'Call / put', field: 'right', width: 90, cellRenderer: RightCell },
      { headerName: 'Own / sold', field: 'side', width: 96, cellRenderer: SideCell },
      { headerName: 'Contracts', field: 'contracts', width: 96, editable: true, cellEditor: 'agNumberCellEditor', cellEditorParams: { min: 1, precision: 0 }, cellRenderer: ContractsCell },
      { headerName: 'Paid', field: 'entry', width: 84, editable: true, cellEditor: 'agNumberCellEditor', cellEditorParams: { min: 0, precision: 2 }, cellRenderer: EntryCell },
      { headerName: 'Expires', field: 'expiry', width: 170, editable: true, cellDataType: 'dateString', cellEditor: 'agDateStringCellEditor', cellRenderer: ExpiryCell },
      { headerName: 'Where it sits', field: 'read', flex: 1.2, minWidth: 200, cellRenderer: SitsCell, cellDataType: false, sortable: false },
      { headerName: 'What the hedging does to it', field: 'read', flex: 2.4, minWidth: 360, cellRenderer: HedgingCell, cellDataType: false, sortable: false, wrapText: true, autoHeight: true },
      { headerName: 'Dealer gamma at your strike', field: 'read', flex: 1, minWidth: 180, cellRenderer: GammaCell, cellDataType: false, sortable: false },
    ],
    []
  );
  const defaultColDef = useMemo<ColDef<Row>>(() => ({ sortable: true, resizable: true, suppressMovable: true }), []);
  const onRow = (e: RowClickedEvent<Row>) => {
    if (e.data && !e.api.getEditingCells().length) onPick(e.data.strike);
  };

  const addButton = (
    <button data-add-position className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full text-[12px] font-semibold transition-opacity hover:opacity-90" style={{ background: SILVER_FILL, color: '#0a0a0a' }}>
      <Plus className="w-3.5 h-3.5" /> Add a position
    </button>
  );

  return (
    <section className="flex flex-col min-w-0" data-positions>
      {/* THE HEAD — a title, its count, and the two things you can do */}
      <div className="flex items-center gap-3 flex-wrap px-5 pt-4 pb-3" data-positions-toolbar>
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold leading-tight text-textPrimary">Your positions</h3>
          <p className="mt-0.5 text-[11px] text-textMuted">
            <TickerText size={11} text={positions.length ? `${contracts} contract${contracts === 1 ? '' : 's'} on ${ticker} · profit is measured from what you paid, or from today's value when you have not said` : `Nothing on ${ticker} yet`} />
          </p>
        </div>
        <span className="ml-auto" />
        {positions.length > 0 && (
          <span role="group" aria-label="View" className="inline-flex h-8 rounded-full border border-borderSubtle p-[2px] gap-[2px]" data-positions-view>
            {(['cards', 'table'] as const).map(v => (
              <button
                key={v}
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className="px-3 rounded-full text-[11px] font-medium transition-colors"
                style={view === v ? { background: SILVER_FILL, color: '#0a0a0a' } : { color: 'rgb(var(--text-secondary))' }}
              >
                {v === 'cards' ? 'As cards' : 'As a table'}
              </button>
            ))}
          </span>
        )}
        {fromTracker.length > 0 && (
          <button onClick={importTracked} className="h-8 px-3.5 rounded-full border border-borderSubtle text-[12px] font-medium text-textSecondary hover:text-textPrimary hover:border-borderMuted transition-colors">
            Bring in {fromTracker.length} from the Tracker
          </button>
        )}
        <PositionForm ticker={ticker} defaultStrike={focus ?? nearest} trigger={addButton} />
      </div>

      {line && (
        <p className="px-5 pb-3 text-[12px] leading-relaxed text-textSecondary" data-positions-line>
          {line}
        </p>
      )}

      {positions.length === 0 ? (
        <p className="px-5 pb-5 text-[12px] text-textMuted max-w-[64ch]">Add a contract you own or sold and the map draws where it sits, with the walls and the flip on the same picture, and says what the hedging does to it. Contracts you track on Compass can be brought in with one click.</p>
      ) : view === 'cards' ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 px-5 pb-5" data-position-cards>
          {sorted.map(p => (
            <PositionCard key={p.id} position={p} read={reads.get(p.id)!} spot={spot} levels={profile.levels} lo={lo} hi={hi} focused={focus != null && Math.abs(focus - p.strike) < 1e-9} onShow={onPick} />
          ))}
        </div>
      ) : (
        <div className="slayer-board border-t border-borderSubtle/60" data-position-table>
          <AgGridProvider modules={MODULES}>
            <AgGridReact<Row>
              theme={THEME}
              domLayout="autoHeight"
              rowData={rows}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              getRowId={p => p.data.id}
              onRowClicked={onRow}
              onCellValueChanged={onChanged}
              stopEditingWhenCellsLoseFocus
              rowSelection={{ mode: 'singleRow', checkboxes: false, enableClickSelection: true }}
              animateRows
            />
          </AgGridProvider>
          <p className="px-5 py-2 text-[10px] text-textMuted">Double-click a number or date to change it. Click a row to show its strike on the map.</p>
        </div>
      )}
    </section>
  );
};

export default PositionsBook;
