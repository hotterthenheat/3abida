/*
==================================================
  SLAYER TERMINAL - THE WIRE, FROM THE FEED
  (pages/record/NewsFeed.tsx)

  /dossier/news when the Dossier reads the vendors
  (2026-10-12; data/feed/rooms.ts). UW's headlines
  route (/api/news/headlines — in UW's own catalog,
  checked live on the Basic plan the same day) carries
  the headline, the wire it came over, the minute, the
  names it carries with their price today and the
  session before, UW's major flag and UW's own tone
  tag. That is what stands here, newest first: the
  head's facts, three cards and the Filter, and every
  headline as a row; a row with a name opens the name.

  ALL OR NOTHING: the house's wire (the map's cities,
  a story's read, its odds, the calendar of the day
  ahead) is the house's book — one quiet line says it
  is not in the feed. A headline is what was reported,
  never what to do.
==================================================
*/

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { type ColDef, type ICellRendererParams, type RowClickedEvent } from 'ag-grid-community';
import { AgGridProvider, AgGridReact } from 'ag-grid-react';
import { GRID_MODULES, GRID_THEME, openRowOnEnter } from '../../components/ui/houseGrid';
import DropdownSelect, { type DropdownOption } from '../../components/ui/DropdownSelect';
import DropdownMulti, { type MultiGroup } from '../../components/ui/DropdownMulti';
import CompanyLogo from '../../components/ui/CompanyLogo';
import { MissingLine } from '../../components/record/Missing';
import { changeTicker } from '../../context/MarketDataContext';
import { nyClock } from '../../core/nyTime';
import { useBoardNames } from '../../data/boardNames';
import { useFeedNews } from '../../data/feed/dossier';
import type { UwHeadline } from '../../data/feed/uw';
import { RecordPageSkeleton } from './recordSkeletons';

type NamesPick = 'all' | 'board' | 'macro';
type ShowPick = 'all' | 'major';

const NAMES_OPTIONS: DropdownOption<NamesPick>[] = [
  { value: 'all', label: 'Every headline', hint: 'With a name or without' },
  { value: 'board', label: 'Your board', hint: 'Headlines carrying a name on your Board' },
  { value: 'macro', label: 'No single name', hint: 'The economy, policy, the world — headlines carrying no name' },
];
const SHOW_OPTIONS: DropdownOption<ShowPick>[] = [
  { value: 'all', label: 'All', hint: 'Every headline on the wire' },
  { value: 'major', label: 'Major only', hint: 'The headlines the wire flags as major' },
];

interface Row {
  id: string;
  at: number;
  h: UwHeadline;
}

const signedPct = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)}%`;
const dayPct = (p: { close: number | null; prevClose: number | null } | undefined): number | null =>
  p && p.close != null && p.prevClose != null && p.prevClose > 0 ? ((p.close - p.prevClose) / p.prevClose) * 100 : null;

const TimeCell = ({ data }: ICellRendererParams<Row>) =>
  data ? (
    <span className="font-mono text-[11px] tnum text-textPrimary whitespace-nowrap">
      {Number.isFinite(data.at) ? nyClock(data.at, { zone: true }) : '—'}
    </span>
  ) : null;

const HeadlineCell = ({ data }: ICellRendererParams<Row>) =>
  data ? (
    <span className={`block text-[12px] truncate ${data.h.isMajor ? 'text-textPrimary font-semibold' : 'text-textSecondary'}`} title={data.h.headline}>
      {data.h.headline}
    </span>
  ) : null;

const NamesCell = ({ data }: ICellRendererParams<Row>) => {
  if (!data) return null;
  if (data.h.tickers.length === 0) return <span className="font-mono text-[11px] text-textMuted">no single name</span>;
  return (
    <span className="inline-flex items-center gap-3 min-w-0">
      {data.h.tickers.slice(0, 3).map(t => {
        const ch = dayPct(data.h.prices[t]);
        return (
          <span key={t} className="inline-flex items-center gap-1.5 shrink-0">
            <CompanyLogo ticker={t} size={14} />
            <span className="font-mono text-[11px] font-bold text-textPrimary">{t}</span>
            {ch != null && (
              <span className={`font-mono text-[11px] tnum ${ch >= 0 ? 'text-bull' : 'text-bear'}`} data-dir={ch >= 0 ? 'up' : 'down'} title="Today against the session before's close">
                {signedPct(ch)}
              </span>
            )}
          </span>
        );
      })}
      {data.h.tickers.length > 3 && <span className="font-mono text-[11px] text-textMuted">+{data.h.tickers.length - 3}</span>}
    </span>
  );
};

const SourceCell = ({ data }: ICellRendererParams<Row>) => (data ? <span className="text-[11px] text-textSecondary truncate">{data.h.source}</span> : null);
const MajorCell = ({ data }: ICellRendererParams<Row>) =>
  data ? data.h.isMajor ? <span className="font-mono text-[11px] text-textPrimary">major</span> : <span className="font-mono text-[11px] text-textMuted">—</span> : null;
/** The wire's own tag for the headline's tone — the wire's word, not ours */
const ToneCell = ({ data }: ICellRendererParams<Row>) =>
  data ? (
    <span className={`font-mono text-[11px] ${data.h.sentiment === 'positive' ? 'text-bull' : data.h.sentiment === 'negative' ? 'text-bear' : 'text-textMuted'}`} title="The wire's own tag for the headline's tone">
      {data.h.sentiment || '—'}
    </span>
  ) : null;

const Fact = ({ label, children, testId }: { label: string; children: React.ReactNode; testId?: string }) => (
  <div>
    <dt className="text-[11px] text-textMuted whitespace-nowrap">{label}</dt>
    <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap" data-news-fact={testId}>
      {children}
    </dd>
  </div>
);

const NewsFeed = () => {
  const navigate = useNavigate();
  const boardNames = useBoardNames();
  const fed = useFeedNews(true);
  const [names, setNames] = useState<NamesPick>('all');
  const [show, setShow] = useState<ShowPick>('all');
  const [picks, setPicks] = useState<string[]>([]);

  const all = useMemo<Row[]>(() => (fed?.ok ? fed.data.map((h, i) => ({ id: `${h.createdAt}|${i}|${h.headline.slice(0, 40)}`, at: h.createdAt, h })) : []), [fed]);
  const cut = useMemo(() => {
    const board = new Set(boardNames);
    return all.filter(r => {
      if (show === 'major' && !r.h.isMajor) return false;
      if (names === 'board' && !r.h.tickers.some(t => board.has(t))) return false;
      if (names === 'macro' && r.h.tickers.length > 0) return false;
      return true;
    });
  }, [all, show, names, boardNames]);
  const filterGroups = useMemo<MultiGroup[]>(() => {
    const byName = new Map<string, number>();
    const bySource = new Map<string, number>();
    cut.forEach(r => {
      r.h.tickers.forEach(t => byName.set(t, (byName.get(t) ?? 0) + 1));
      bySource.set(r.h.source, (bySource.get(r.h.source) ?? 0) + 1);
    });
    picks.forEach(p => {
      const [kind, ...rest] = p.split(':');
      const key = rest.join(':');
      if (kind === 'name' && !byName.has(key)) byName.set(key, 0);
      if (kind === 'source' && !bySource.has(key)) bySource.set(key, 0);
    });
    const order = (a: [string, number], b: [string, number]) => b[1] - a[1] || a[0].localeCompare(b[0]);
    return [
      { title: 'Names', options: [...byName.entries()].sort(order).map(([n, c]) => ({ value: `name:${n}`, label: n, count: c })) },
      { title: 'Wires', options: [...bySource.entries()].sort(order).map(([n, c]) => ({ value: `source:${n}`, label: n, count: c })) },
    ];
  }, [cut, picks]);
  const rows = useMemo(() => {
    if (picks.length === 0) return cut;
    const on = new Set(picks);
    return cut.filter(r => on.has(`source:${r.h.source}`) || r.h.tickers.some(t => on.has(`name:${t}`)));
  }, [cut, picks]);

  const facts = useMemo(() => {
    const major = rows.filter(r => r.h.isMajor).length;
    const named = new Set(rows.flatMap(r => r.h.tickers)).size;
    const latest = rows.reduce((m, r) => (Number.isFinite(r.at) && r.at > m ? r.at : m), 0);
    const earliest = rows.reduce((m, r) => (Number.isFinite(r.at) && r.at < m ? r.at : m), Infinity);
    return { major, named, latest, earliest };
  }, [rows]);

  const columnDefs = useMemo<ColDef<Row>[]>(
    () => [
      { headerName: 'Time', field: 'at', width: 104, cellRenderer: TimeCell, sort: 'desc', headerTooltip: 'When it came over the wire, New York time — newest first' },
      { headerName: 'Headline', colId: 'headline', valueGetter: p => p.data?.h.headline ?? '', flex: 3, minWidth: 320, cellRenderer: HeadlineCell, headerTooltip: 'The headline as the wire carried it — a major one in the lead ink' },
      { headerName: 'Names', colId: 'names', valueGetter: p => p.data?.h.tickers.join(',') ?? '', flex: 1.2, minWidth: 180, cellRenderer: NamesCell, headerTooltip: 'The names it carries, each with its day against the session before — a row with a name opens the name' },
      { headerName: 'Wire', colId: 'source', valueGetter: p => p.data?.h.source ?? '', width: 130, cellRenderer: SourceCell, headerTooltip: 'The wire it came over' },
      { headerName: 'Major', colId: 'major', valueGetter: p => (p.data?.h.isMajor ? 1 : 0), width: 84, cellRenderer: MajorCell, headerTooltip: 'Flagged major by the wire' },
      { headerName: 'Tone', colId: 'tone', valueGetter: p => p.data?.h.sentiment ?? '', width: 92, cellRenderer: ToneCell, headerTooltip: "The wire's own tag for the headline's tone — its word, not a read of ours" },
    ],
    []
  );
  const defaultColDef = useMemo<ColDef<Row>>(() => ({ sortable: true, resizable: true, suppressMovable: true }), []);
  const openRow = (r: Row) => {
    const t = r.h.tickers[0];
    if (!t) return;
    changeTicker(t);
    navigate(`/dossier/stocks/${t}`);
  };
  const onRow = (e: RowClickedEvent<Row>) => {
    if (e.data) openRow(e.data);
  };

  if (fed === null) return <RecordPageSkeleton pathname="/dossier/news" />;

  return (
    <div className="relative border border-borderSubtle rounded-md overflow-hidden bg-panel flex flex-col" data-news data-news-source="feed" data-rows={rows.length}>
      <div className="px-5 pt-4 pb-3 flex items-start gap-6 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="h-6 flex items-center gap-3">
            <h3 className="text-[15px] font-semibold leading-tight text-textPrimary">The wire</h3>
          </div>
          <p className="mt-0.5 text-[11px] text-textMuted whitespace-nowrap truncate">
            The latest {all.length} headlines, newest first{Number.isFinite(facts.earliest) ? `, back to ${nyClock(facts.earliest, { zone: true })}` : ''} · a row with a name opens the name’s page
          </p>
        </div>
        <dl className="flex flex-wrap gap-x-6 gap-y-2">
          <Fact label="Headlines" testId="count">
            {rows.length}
          </Fact>
          <Fact label="Major" testId="major">
            {facts.major}
          </Fact>
          <Fact label="Names carried" testId="named">
            {facts.named}
          </Fact>
          <Fact label="Latest" testId="latest">
            {facts.latest ? nyClock(facts.latest, { zone: true }) : '—'}
          </Fact>
        </dl>
      </div>
      <div className="px-5 pb-2 flex items-center gap-2 flex-wrap" data-news-controls>
        <DropdownSelect label="Names" value={names} options={NAMES_OPTIONS} onChange={setNames} title="Which headlines" testId="news-names" />
        <DropdownSelect label="Show" value={show} options={SHOW_OPTIONS} onChange={setShow} title="Every headline or the major ones" testId="news-show" />
        <div className="ml-auto" title="The names and wires on the page right now — tick any number; only those stay">
          <DropdownMulti label="Filter" values={picks} groups={filterGroups} onChange={setPicks} title="Keep only these" testId="news-filter" />
        </div>
      </div>
      {fed && !fed.ok && <p className="px-5 pb-3 text-[12px] text-textSecondary">No headlines came back this time — asked again in a minute.</p>}
      <MissingLine what="Where a story comes from on the map, its read and the day ahead" />
      {/* ON A PHONE a headline is the row's whole width, wrapped — the grid's columns would cut it (the house's phone rows) */}
      <ul className="lg:hidden border-t border-borderSubtle" data-news-phone>
        {rows.length === 0 && <li className="px-4 py-6 font-mono text-[11px] text-textMuted">No headline on this cut</li>}
        {[...rows]
          .sort((a, b) => b.at - a.at)
          .slice(0, 60)
          .map(r => (
            <li key={r.id} className="border-b border-borderSubtle/60 last:border-0">
              <button type="button" onClick={() => openRow(r)} disabled={r.h.tickers.length === 0} className="hit w-full text-left px-4 py-3 flex flex-col gap-1.5 disabled:cursor-default" data-news-phone-row>
                <span className="flex items-center gap-2 font-mono text-[11px] tnum text-textMuted">
                  {Number.isFinite(r.at) ? nyClock(r.at, { zone: true }) : '—'}
                  <span>· {r.h.source}</span>
                  {r.h.isMajor && <span className="text-textPrimary">· major</span>}
                </span>
                <span className={`text-[13px] leading-snug ${r.h.isMajor ? 'text-textPrimary font-semibold' : 'text-textSecondary'}`}>{r.h.headline}</span>
                {r.h.tickers.length > 0 && (
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    {r.h.tickers.slice(0, 4).map(t => {
                      const ch = dayPct(r.h.prices[t]);
                      return (
                        <span key={t} className="inline-flex items-center gap-1.5">
                          <CompanyLogo ticker={t} size={14} />
                          <span className="font-mono text-[11px] font-bold text-textPrimary">{t}</span>
                          {ch != null && (
                            <span className={`font-mono text-[11px] tnum ${ch >= 0 ? 'text-bull' : 'text-bear'}`} data-dir={ch >= 0 ? 'up' : 'down'}>
                              {signedPct(ch)}
                            </span>
                          )}
                        </span>
                      );
                    })}
                  </span>
                )}
              </button>
            </li>
          ))}
      </ul>
      <div className="max-lg:hidden grid-keys slayer-board border-t border-borderSubtle" data-news-grid>
        <AgGridProvider modules={GRID_MODULES}>
          <AgGridReact<Row>
            theme={GRID_THEME}
            domLayout="autoHeight"
            rowData={rows}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            getRowId={p => p.data.id}
            onRowClicked={onRow}
            {...openRowOnEnter<Row>(openRow)}
            rowSelection={{ mode: 'singleRow', checkboxes: false, enableClickSelection: true }}
            animateRows={false}
            tooltipShowDelay={350}
            tooltipHideDelay={8000}
            overlayNoRowsTemplate='<span class="font-mono text-[11px] text-textMuted">No headline on this cut</span>'
          />
        </AgGridProvider>
      </div>
    </div>
  );
};

export default NewsFeed;
