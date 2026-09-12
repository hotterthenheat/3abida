/*
==================================================
  SLAYER TERMINAL - CONGRESS (pages/record/Congress.tsx)

  What members of Congress reported trading under
  the STOCK Act, and how long they took to say so.
  The partner's "Disclosures" (2026-09-09) in the
  house, and walked the same night as Insiders:

    THE HEAD      four facts
    THE CARDS     Window · Chamber · Owner · Show, and
                  the Filter as a card that reads the
                  names, members and committees on
                  the page
    THE SENTENCE
    THE REPORTS   trades in a sector the member's
    TO KNOW       own committee oversees, the biggest
                  bracket first — the reading this
                  data is for; a card keeps the grid
                  to its member
    THE GRID      in a window a screen tall that
                  scrolls inside itself, its head
                  pinned

  A row's name opens it on the Map.
==================================================
*/

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { type ColDef, type ICellRendererParams, type RowClickedEvent } from 'ag-grid-community';
import { AgGridProvider, AgGridReact } from 'ag-grid-react';
import { GRID_MODULES, GRID_THEME } from '../../components/ui/houseGrid';
import DropdownSelect, { type DropdownOption } from '../../components/ui/DropdownSelect';
import DropdownMulti, { type MultiGroup } from '../../components/ui/DropdownMulti';
import GuideFocus, { GuideDoor } from '../../components/ui/GuideFocus';
import CompanyLogo from '../../components/ui/CompanyLogo';
import { CongressGuide } from '../../components/record/CongressGuide';
import { useMarketData } from '../../context/MarketDataContext';
import { AMOUNT_BRACKETS, STOCK_ACT_DEADLINE_DAYS, bracketLabel, buildCongress, congressSentence, summariseCongress } from '../../data/congress';
import { tickerName } from '../../data/tickers';
import type { Chamber, CongressTrade, ReportOwner } from '../../types/record';
import { REPORTS_TO_KNOW } from './recordSkeletons';

const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */
type Window = 30 | 90 | 180;
type ChamberPick = 'both' | Chamber;
type OwnerPick = 'any' | ReportOwner;
type Show = 'all' | 'committee' | 'late' | 'purchases' | 'sales';

const WINDOW_OPTIONS: DropdownOption<Window>[] = [
  { value: 30, label: '30 days', hint: 'Reports filed in the last month' },
  { value: 90, label: '90 days', hint: 'The last quarter' },
  { value: 180, label: '180 days', hint: 'The last half year' },
];
const CHAMBER_OPTIONS: DropdownOption<ChamberPick>[] = [
  { value: 'both', label: 'Both', hint: 'House and Senate' },
  { value: 'House', label: 'House', hint: 'Representatives only' },
  { value: 'Senate', label: 'Senate', hint: 'Senators only' },
];
const OWNER_OPTIONS: DropdownOption<OwnerPick>[] = [
  { value: 'any', label: 'Any', hint: 'The member, their spouse, a joint account or a dependent' },
  { value: 'Self', label: 'Self', hint: "The member's own holding" },
  { value: 'Spouse', label: 'Spouse', hint: "The spouse's holding" },
  { value: 'Joint', label: 'Joint', hint: 'A joint account' },
  { value: 'Dependent', label: 'Dependent', hint: "A dependent child's holding" },
];
const SHOW_OPTIONS: DropdownOption<Show>[] = [
  { value: 'all', label: 'All reports', hint: 'Every report in the window' },
  { value: 'committee', label: 'Own committee', hint: "Trades in a sector the member's own committee oversees — the reading this data is for" },
  { value: 'late', label: 'Late only', hint: 'Filed past the 45-day deadline' },
  { value: 'purchases', label: 'Purchases', hint: 'Purchases only' },
  { value: 'sales', label: 'Sales', hint: 'Sales only, full or partial' },
];

const ago = (d: number) => (d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d}d ago`);
const seat = (t: CongressTrade) => `${t.member.party}-${t.member.district ?? t.member.state}`;
const typeWord = (t: CongressTrade) => (t.type === 'Purchase' ? 'Purchase' : t.type === 'Exchange' ? 'Exchange' : 'Sale');
const typeInk = (t: CongressTrade) => (t.type === 'Purchase' ? 'text-bull' : t.type === 'Exchange' ? 'text-textMuted' : 'text-bear');

/* ---- cells: the house grammar inside the grid ------------------------------------ */

const FiledCell = ({ data }: ICellRendererParams<CongressTrade>) => (data ? <span className="font-mono text-[11px] tnum text-textSecondary">{ago(data.filedDaysAgo)}</span> : null);

const MemberCell = ({ data }: ICellRendererParams<CongressTrade>) =>
  data ? (
    <span className="flex flex-col leading-tight min-w-0">
      <span className="text-[12px] font-semibold text-textPrimary truncate">
        {data.member.name} <span className="font-mono text-[10px] font-normal text-textMuted">{seat(data)}</span>
      </span>
      {data.committeeOverlap ? (
        <span className="text-[10px] text-textSecondary truncate" title="A trade in a sector this committee oversees">
          {data.committeeOverlap} · <span className="text-textPrimary">own committee</span>
        </span>
      ) : (
        <span className="text-[10px] text-textMuted truncate">{data.member.chamber}</span>
      )}
    </span>
  ) : null;

const AssetCell = ({ data }: ICellRendererParams<CongressTrade>) =>
  data ? (
    <span className="inline-flex items-center gap-2 min-w-0">
      <CompanyLogo ticker={data.ticker} size={16} />
      <span className="flex flex-col leading-tight min-w-0">
        <span className="font-mono text-[12px] font-bold text-textPrimary">{data.ticker}</span>
        <span className="text-[10px] text-textMuted truncate">{data.assetKind === 'Stock' ? tickerName(data.ticker) : data.assetKind}</span>
      </span>
    </span>
  ) : null;

const TypeCell = ({ data }: ICellRendererParams<CongressTrade>) =>
  data ? (
    <span className={`font-mono text-[11px] tnum ${typeInk(data)}`}>
      {typeWord(data)}
      {data.type === 'Sale (Partial)' && <span className="text-textMuted"> · partial</span>}
    </span>
  ) : null;

const OwnerCell = ({ data }: ICellRendererParams<CongressTrade>) =>
  data ? <span className={`font-mono text-[8px] uppercase tracking-widest ${data.owner === 'Self' ? 'text-textPrimary' : 'text-textMuted'}`}>{data.owner}</span> : null;

/** The ten rungs as a ladder, the disclosed one lit — never a midpoint */
const Ladder = ({ bracket }: { bracket: number }) => (
  <span className="inline-flex items-center gap-[2px]" aria-hidden>
    {AMOUNT_BRACKETS.map((b, i) => (
      <span key={b.column} className="block w-[5px] h-[8px] rounded-[1px]" style={{ background: i <= bracket ? SILVER : 'rgb(var(--ink) / 0.08)', opacity: i === bracket ? 1 : i < bracket ? 0.55 : 1 }} />
    ))}
  </span>
);
const AmountCell = ({ data }: ICellRendererParams<CongressTrade>) => {
  if (!data) return null;
  if (data.bracket === null) return <span className="font-mono text-[10px] text-textMuted">not disclosed</span>;
  return (
    <span className="inline-flex items-center gap-2.5" title={`Rung ${AMOUNT_BRACKETS[data.bracket].column} of ${AMOUNT_BRACKETS.length}`}>
      <Ladder bracket={data.bracket} />
      <span className="font-mono text-[11px] tnum text-textPrimary whitespace-nowrap">{bracketLabel(data.bracket)}</span>
    </span>
  );
};

const TradedCell = ({ data }: ICellRendererParams<CongressTrade>) => (data ? <span className="font-mono text-[11px] tnum text-textSecondary">{ago(data.tradedDaysAgo)}</span> : null);

const LagCell = ({ data }: ICellRendererParams<CongressTrade>) => {
  if (!data) return null;
  if (data.lagDays < 0) return <span className="font-mono text-[10px] text-textMuted" title="Filed before the trade date — a filing artefact real feeds carry">before the trade</span>;
  return (
    <span className="inline-flex items-center gap-2 font-mono text-[11px] tnum">
      <span className={data.late ? 'text-bear font-semibold' : data.lagDays > 30 ? 'text-textPrimary' : 'text-textSecondary'}>{data.lagDays}d</span>
      {data.late && <span className="text-[8px] uppercase tracking-widest text-bear">late</span>}
    </span>
  );
};

/* ---- the reports to know ------------------------------------------------------- */

/** One own-committee trade: the stock, the member, the bracket, the committee. A click keeps the grid to the member. */
const ReportCard = ({ t, on, onToggle }: { t: CongressTrade; on: boolean; onToggle: () => void }) => (
  <button
    type="button"
    onClick={onToggle}
    aria-pressed={on}
    title={on ? `Showing ${t.member.name} only — click to show every member` : `Keep the grid to ${t.member.name}`}
    className={`group text-left rounded-md border px-3 py-2.5 transition-colors ${on ? 'border-silver/60 bg-silver/[0.08]' : 'border-borderMuted bg-card hover:border-silver/40 hover:bg-silver/[0.05]'}`}
    data-congress-report={t.id}
    data-on={on || undefined}
  >
    <span className="flex items-center gap-2 min-w-0">
      <CompanyLogo ticker={t.ticker} size={18} />
      <span className="font-mono text-[12px] font-bold text-textPrimary">{t.ticker}</span>
      <span className="text-[10px] text-textSecondary truncate">
        {t.member.name} <span className="font-mono text-textMuted">{seat(t)}</span>
      </span>
    </span>
    {/* the bracket as its words — the ladder lives in the grid; at six across it pushed the label off the card */}
    <span className="mt-1.5 flex items-center gap-2 font-mono tnum">
      <span className={`text-[11px] ${typeInk(t)}`}>{typeWord(t)}</span>
      <span className="text-[11px] font-bold text-textPrimary truncate">{bracketLabel(t.bracket)}</span>
      {t.late && <span className="ml-auto text-[8px] uppercase tracking-widest text-bear">late</span>}
    </span>
    <span className="mt-1 block font-mono text-[8px] uppercase tracking-widest text-textSecondary truncate">
      {t.committeeOverlap} <span className="text-silver">· own committee</span>
    </span>
  </button>
);

/* ---- the page ------------------------------------------------------------------ */

const Congress = () => {
  const { changeTicker } = useMarketData();
  const navigate = useNavigate();
  const [window, setWindow] = useState<Window>(90);
  const [chamber, setChamber] = useState<ChamberPick>('both');
  const [owner, setOwner] = useState<OwnerPick>('any');
  const [show, setShow] = useState<Show>('all');
  const [guideOpen, setGuideOpen] = useState(false);

  /* The feed is deterministic per session day; the cards cut it, the Filter keeps from the cut */
  const feed = useMemo(() => buildCongress(window), [window]);
  const cut = useMemo(
    () =>
      feed.trades.filter(t => {
        if (chamber !== 'both' && t.member.chamber !== chamber) return false;
        if (owner !== 'any' && t.owner !== owner) return false;
        if (show === 'committee' && !t.committeeOverlap) return false;
        if (show === 'late' && !t.late) return false;
        if (show === 'purchases' && t.type !== 'Purchase') return false;
        if (show === 'sales' && (t.type === 'Purchase' || t.type === 'Exchange')) return false;
        return true;
      }),
    [feed, chamber, owner, show]
  );

  /* THE FILTER reads the names, members and committees on the cut; any pick matching keeps the row */
  const [picks, setPicks] = useState<string[]>([]);
  const filterGroups = useMemo<MultiGroup[]>(() => {
    const count = (key: (t: CongressTrade) => string | null) => {
      const m = new Map<string, number>();
      cut.forEach(t => {
        const k = key(t);
        if (k) m.set(k, (m.get(k) ?? 0) + 1);
      });
      return m;
    };
    const byNames = count(t => t.ticker);
    const byMembers = count(t => t.member.name);
    const byCommittees = count(t => t.committeeOverlap);
    picks.forEach(p => {
      const [kind, ...rest] = p.split(':');
      const key = rest.join(':');
      if (kind === 'name' && !byNames.has(key)) byNames.set(key, 0);
      if (kind === 'member' && !byMembers.has(key)) byMembers.set(key, 0);
      if (kind === 'committee' && !byCommittees.has(key)) byCommittees.set(key, 0);
    });
    const order = (a: [string, number], b: [string, number]) => b[1] - a[1] || a[0].localeCompare(b[0]);
    const seatOf = (name: string) => {
      const t = cut.find(x => x.member.name === name);
      return t ? `${seat(t)} · ${t.member.chamber}` : undefined;
    };
    return [
      { title: 'Names', options: [...byNames.entries()].sort(order).map(([n, c]) => ({ value: `name:${n}`, label: n, hint: tickerName(n), count: c })) },
      { title: 'Members', options: [...byMembers.entries()].sort(order).map(([m, c]) => ({ value: `member:${m}`, label: m, hint: seatOf(m), count: c })) },
      { title: 'Own committee', options: [...byCommittees.entries()].sort(order).map(([k, c]) => ({ value: `committee:${k}`, label: k, count: c })) },
    ];
  }, [cut, picks]);
  const rows = useMemo(() => {
    if (picks.length === 0) return cut;
    const picked = new Set(picks);
    return cut.filter(t => picked.has(`name:${t.ticker}`) || picked.has(`member:${t.member.name}`) || (t.committeeOverlap ? picked.has(`committee:${t.committeeOverlap}`) : false));
  }, [cut, picks]);
  const toggleMember = (name: string) => setPicks(p => (p.includes(`member:${name}`) ? p.filter(x => x !== `member:${name}`) : [...p, `member:${name}`]));
  const stats = useMemo(() => summariseCongress(rows, window), [rows, window]);

  /* THE REPORTS TO KNOW: own-committee trades on the cut, the biggest bracket first, the latest first among equals */
  const toKnow = useMemo(
    () =>
      cut
        .filter(t => t.committeeOverlap)
        .sort((a, b) => (b.bracket ?? -1) - (a.bracket ?? -1) || a.filedDaysAgo - b.filedDaysAgo)
        .slice(0, REPORTS_TO_KNOW),
    [cut]
  );

  const columnDefs = useMemo<ColDef<CongressTrade>[]>(
    () => [
      { headerName: 'Filed', field: 'filedDaysAgo', width: 96, cellRenderer: FiledCell, sort: 'asc', headerTooltip: 'When the report was filed — newest first' },
      { headerName: 'Member', field: 'member', flex: 1.7, minWidth: 220, cellRenderer: MemberCell, comparator: (a: CongressTrade['member'], b: CongressTrade['member']) => a.name.localeCompare(b.name), headerTooltip: "Who filed it, with party and seat — and their own committee under the name when the trade sits in a sector it oversees" },
      { headerName: 'Asset', field: 'ticker', flex: 1.3, minWidth: 170, cellRenderer: AssetCell, headerTooltip: 'The stock the report names — click the row to open it on the Map' },
      { headerName: 'Type', field: 'type', flex: 0.8, minWidth: 110, cellRenderer: TypeCell, headerTooltip: 'Purchase, sale (full or partial), or an exchange' },
      { headerName: 'Owner', field: 'owner', flex: 0.7, minWidth: 96, cellRenderer: OwnerCell, headerTooltip: "Whose holding the report covers — the member's own, their spouse's, a joint account or a dependent's" },
      {
        headerName: 'Amount disclosed',
        field: 'bracket',
        flex: 1.6,
        minWidth: 220,
        cellRenderer: AmountCell,
        comparator: (a: number | null, b: number | null) => (a ?? -1) - (b ?? -1),
        headerTooltip: 'The bracket the member disclosed, as a rung on the ten-rung ladder — never a midpoint; some scanned filings carry none',
      },
      { headerName: 'Traded', field: 'tradedDaysAgo', width: 96, cellRenderer: TradedCell, headerTooltip: 'When the trade itself happened' },
      { headerName: 'Lag', field: 'lagDays', width: 100, cellRenderer: LagCell, headerTooltip: `Days from the trade to the filing — past ${STOCK_ACT_DEADLINE_DAYS} it is late` },
    ],
    []
  );
  const defaultColDef = useMemo<ColDef<CongressTrade>>(() => ({ sortable: true, resizable: true, suppressMovable: true }), []);
  const open = (e: RowClickedEvent<CongressTrade>) => {
    if (!e.data) return;
    changeTicker(e.data.ticker);
    navigate('/pinpoint/map');
  };

  return (
    <div className="relative border border-borderSubtle rounded-md overflow-hidden bg-panel flex flex-col" data-congress data-window={window}>
      <GuideFocus open={guideOpen} onClose={() => setGuideOpen(false)} title="How to read the reports" testId="congress-guide" viewport>
        <CongressGuide />
      </GuideFocus>
      {/* THE HEAD */}
      <div className="px-5 pt-4 pb-3 flex items-start gap-6 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="h-6 flex items-center gap-3">
            <h3 className="text-[15px] font-semibold leading-tight text-textPrimary">What Congress reported</h3>
            <GuideDoor open={guideOpen} onClick={() => setGuideOpen(v => !v)} title="What a row, a bracket, an owner and the lag mean" testId="congress-guide" />
          </div>
          <p className="mt-0.5 text-[11px] text-textMuted whitespace-nowrap truncate">Every report in the window, newest filing first · the people are invented until the feed lands, the shape is the real one</p>
        </div>
        <dl className="grid grid-cols-4 gap-x-6">
          <div>
            <dt className="text-[10px] text-textMuted">Reports</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap" data-congress-count>
              {stats.trades.length} <span className="text-textMuted">· {stats.purchases} bought · {stats.sales} sold</span>
            </dd>
          </div>
          <div>
            <dt className="text-[10px] text-textMuted">Median lag</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap" data-congress-lag>
              {stats.medianLag}d
            </dd>
          </div>
          <div>
            <dt className="text-[10px] text-textMuted">Past the deadline</dt>
            <dd className={`mt-0.5 font-mono text-[12px] tnum whitespace-nowrap ${stats.lateFilings ? 'text-bear' : 'text-textPrimary'}`} data-congress-late>
              {stats.lateFilings}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] text-textMuted">In own committee</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap" data-congress-overlap>
              {stats.overlaps}
            </dd>
          </div>
        </dl>
      </div>
      {/* THE ONE LINE OF CONTROLS */}
      <div className="px-5 pb-2 flex items-center gap-2 flex-wrap" data-congress-controls>
        <DropdownSelect label="Window" value={window} options={WINDOW_OPTIONS} onChange={setWindow} title="How far back the reports run" testId="congress-window" />
        <DropdownSelect label="Chamber" value={chamber} options={CHAMBER_OPTIONS} onChange={setChamber} title="Which chamber" testId="congress-chamber" />
        <DropdownSelect label="Owner" value={owner} options={OWNER_OPTIONS} onChange={setOwner} title="Whose holding" testId="congress-owner" />
        <DropdownSelect label="Show" value={show} options={SHOW_OPTIONS} onChange={setShow} title="Which reports" testId="congress-show" />
        <div className="ml-auto" title="The names, members and committees on the page right now — tick any number; only those stay">
          <DropdownMulti label="Filter" values={picks} groups={filterGroups} onChange={setPicks} title="Keep only these" testId="congress-filter" />
        </div>
      </div>
      <p className="px-5 pb-3 text-[12px] leading-relaxed text-textSecondary" data-congress-sentence>
        {congressSentence(stats)}
      </p>
      {/* THE REPORTS TO KNOW */}
      <div className="px-5 pb-3 border-t border-borderSubtle/60" data-congress-to-know>
        <div className="h-[26px] flex items-center gap-3 text-[10px] font-semibold uppercase tracking-widest text-textPrimary">
          <span>The reports to know</span>
          <span className="normal-case tracking-normal font-normal text-[10px] text-textSecondary">trades in a sector the member's own committee oversees, the biggest bracket first · click one to keep the grid to that member</span>
        </div>
        {toKnow.length === 0 ? (
          <div className="h-[70px] flex items-center font-mono text-[10px] uppercase tracking-widest text-textMuted">No trade in a member's own committee on this cut</div>
        ) : (
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${REPORTS_TO_KNOW}, minmax(0, 1fr))` }}>
            {toKnow.map(t => (
              <ReportCard key={t.id} t={t} on={picks.includes(`member:${t.member.name}`)} onToggle={() => toggleMember(t.member.name)} />
            ))}
          </div>
        )}
      </div>
      {/* THE GRID — grown to its rows, the page scrolls (2026-09-11, the Compass board's rule) */}
      <div className="slayer-board border-t border-borderSubtle" data-congress-grid>
        <AgGridProvider modules={GRID_MODULES}>
          <AgGridReact<CongressTrade>
            theme={GRID_THEME}
            domLayout="autoHeight"
            rowData={rows}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            getRowId={p => p.data.id}
            onRowClicked={open}
            rowSelection={{ mode: 'singleRow', checkboxes: false, enableClickSelection: true }}
            suppressCellFocus
            animateRows
            tooltipShowDelay={350}
            tooltipHideDelay={8000}
          />
        </AgGridProvider>
      </div>
    </div>
  );
};

export default Congress;
