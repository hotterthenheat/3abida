/*
==================================================
  SLAYER TERMINAL - STOCKS (pages/record/Stocks.tsx)

  How every name screens. Four sleeves — the trend
  (momentum), the numbers (quality), the money (flow)
  and the news — each read against the 50 line and
  rolled into one screen: STRONG, MIXED or WEAK. The
  same sleeves rolled up by sector are THE ROTATION,
  so who leads and which names carry it come from one
  composite, never two opinions.

  Walked into the Record (Noah, 2026-09-10: "i think
  it needs to be apart of the records section and
  also needs to go through the extensive walk"). The
  old page — a metric grid of five cards, a ladder
  panel with a summary paragraph, a filter-tab table
  with a thesis strip — is now the Record's one box:

    THE HEAD      the names and how they split, the
                  breadth, the leading and trailing
                  sector (each a door to its names)
    THE CARDS     Screen · Sector · Names, and the
                  Filter as a card reading the page
    THE SENTENCE
    THE ROTATION  every sector ranked, leader first,
                  its bar the share of the leader's
                  screen, its direction word and its
                  two windows — a card keeps the grid
                  to its names
    THE GRID      in a window a screen tall: the name,
                  its sector, the price and the day,
                  the 30-day line, the four sleeves as
                  BARS ONLY (the figures stay inside
                  the engine — Noah, 2026-08-16), the
                  screen word, and the read in plain
                  words. A row opens the name on the Map.

  States, not orders: STRONG / MIXED / WEAK are what
  the data says about a name, never an instruction.
==================================================
*/

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { type ColDef, type ICellRendererParams, type RowClickedEvent } from 'ag-grid-community';
import { AgGridProvider, AgGridReact } from 'ag-grid-react';
import { GRID_MODULES, GRID_THEME } from '../../components/ui/houseGrid';
import DropdownSelect, { type DropdownOption } from '../../components/ui/DropdownSelect';
import DropdownMulti, { type MultiGroup } from '../../components/ui/DropdownMulti';
import GuideFocus, { GuideDoor } from '../../components/ui/GuideFocus';
import CompanyLogo from '../../components/ui/CompanyLogo';
import Sparkline from '../../components/compass/Sparkline';
import { SectorMark } from '../../components/trace/SectorMark';
import { StocksGuide } from '../../components/record/StocksGuide';
import { useMarketData } from '../../context/MarketDataContext';
import { useBoardNames } from '../../data/boardNames';
import { buildSectorBoard, buildStockBoard, type SectorRow, type StockPick, type StockSleeves, type StockVerdict } from '../../data/stocks';
import { SECTORS, type Sector } from '../../data/universe';
import { ROTATION_SECTORS } from './recordSkeletons';

type ScreenPick = 'all' | StockVerdict;
type SectorPick = 'all' | Sector;
type NamesPick = 'all' | 'board';

/** User-facing screen words — the data's read, never an instruction */
const SCREEN_WORD: Record<StockVerdict, string> = { ACCUMULATE: 'STRONG', HOLD: 'MIXED', AVOID: 'WEAK' };
const SCREEN_DOT: Record<StockVerdict, string> = { ACCUMULATE: 'bg-bull', HOLD: 'bg-ink/30', AVOID: 'bg-bear' };

const SCREEN_OPTIONS: DropdownOption<ScreenPick>[] = [
  { value: 'all', label: 'Every screen', hint: 'Strong, mixed and weak' },
  { value: 'ACCUMULATE', label: 'Strong', hint: 'All four sleeves point the same way' },
  { value: 'HOLD', label: 'Mixed', hint: 'The sleeves disagree — a catalyst decides' },
  { value: 'AVOID', label: 'Weak', hint: 'The data argues against the name' },
];
const SECTOR_OPTIONS: DropdownOption<SectorPick>[] = [{ value: 'all', label: 'Every sector', hint: 'The ten sectors the universe files' }, ...SECTORS.map(s => ({ value: s, label: s }))];
const NAMES_OPTIONS: DropdownOption<NamesPick>[] = [
  { value: 'all', label: 'Every name', hint: 'The whole universe' },
  { value: 'board', label: 'Your board', hint: 'The names on your Board' },
];

/* Direction of relative strength over two windows — a different axis from
   the ladder's rank. LEADING is the ladder's absolute top only (ties share it),
   the one magenta on the page; the phase words say which way a sector moves. */
const PHASE_WORD: Record<SectorRow['phase'], string> = { LEADING: 'RISING', IMPROVING: 'TURNING UP', WEAKENING: 'ROLLING OVER', LAGGING: 'FALLING' };
const PHASE_INK: Record<SectorRow['phase'], string> = { LEADING: 'text-bull', IMPROVING: 'text-flip', WEAKENING: 'text-warn', LAGGING: 'text-bear' };
const PHASE_BAR: Record<SectorRow['phase'], string> = { LEADING: 'bg-bull', IMPROVING: 'bg-flip', WEAKENING: 'bg-warn', LAGGING: 'bg-bear/80' };

/** The two consumer sectors by their second word on a card 150px wide — the mark and the grid carry the whole name */
const SHORT_SECTOR: Partial<Record<Sector, string>> = { 'Consumer Discretionary': 'Discretionary', 'Consumer Staples': 'Staples' };

const signedPct = (v: number, d = 1) => `${v >= 0 ? '+' : ''}${v.toFixed(d)}%`;
const dirInk = (v: number) => (v >= 0 ? 'text-bull' : 'text-bear');
/** "A, B and C" — never "A and B and C" */
const listPhrase = (items: string[]) => (items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);

/* ---- cells --------------------------------------------------------------------- */

const NameCell = ({ data }: ICellRendererParams<StockPick>) =>
  data ? (
    <span className="inline-flex items-center gap-2 min-w-0">
      <CompanyLogo ticker={data.ticker} size={16} />
      <span className="flex flex-col leading-tight min-w-0">
        <span className="font-mono text-[12px] font-bold text-textPrimary">{data.ticker}</span>
        <span className="text-[10px] text-textMuted truncate">{data.name}</span>
      </span>
    </span>
  ) : null;

const SectorCell = ({ data }: ICellRendererParams<StockPick>) =>
  data ? (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-textSecondary">
      <SectorMark sector={data.sector} />
      {data.sector}
    </span>
  ) : null;

const LastCell = ({ data }: ICellRendererParams<StockPick>) => (data ? <span className="font-mono text-[11px] tnum text-textPrimary">${data.price.toFixed(2)}</span> : null);
const TodayCell = ({ data }: ICellRendererParams<StockPick>) => (data ? <span className={`font-mono text-[11px] tnum ${dirInk(data.changePct)}`}>{signedPct(data.changePct, 2)}</span> : null);
const TrendCell = ({ data }: ICellRendererParams<StockPick>) => (data ? <Sparkline data={data.trend} up={data.trend[data.trend.length - 1] >= data.trend[0]} width={72} height={20} /> : null);

/** A sleeve as a bar against the 50 line — the bar is the whole read; its figure stays inside the engine */
const sleeveCell =
  (key: keyof StockSleeves) =>
  ({ data }: ICellRendererParams<StockPick>) => {
    if (!data) return null;
    const v = data.sleeves[key];
    return (
      <span className="flex items-center h-full w-full pr-2" title={v > 50 ? 'Above the 50 line — for the name' : 'Below the 50 line — against it'}>
        <span className="relative flex-1 h-[4px] rounded-full bg-ink/[0.06] overflow-hidden">
          <span className={`absolute left-0 top-0 h-full rounded-full ${v > 50 ? 'bg-bull' : 'bg-bear/70'}`} style={{ width: `${v}%` }} />
        </span>
      </span>
    );
  };

const ScreenCell = ({ data }: ICellRendererParams<StockPick>) =>
  data ? (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-textPrimary">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${SCREEN_DOT[data.verdict]}`} />
      {SCREEN_WORD[data.verdict]}
    </span>
  ) : null;

const WhyCell = ({ data }: ICellRendererParams<StockPick>) =>
  data ? (
    <span className="block text-[11px] text-textSecondary truncate" title={data.thesis}>
      {data.thesis}
    </span>
  ) : null;

/* ---- the rotation -------------------------------------------------------------- */

/** One sector on the ladder: the rank and mark, the bar as a share of the leader's screen, the direction word, the two windows. A click keeps the grid to its names. */
const SectorCard = ({ s, rank, leader, top, on, onToggle }: { s: SectorRow; rank: number; leader: boolean; top: number; on: boolean; onToggle: () => void }) => (
  <button
    type="button"
    onClick={onToggle}
    aria-pressed={on}
    title={`${s.note} ${on ? 'Click to show every sector.' : `Click to keep the grid to ${s.sector}.`}`}
    className={`group text-left rounded-md border px-3 py-2.5 transition-colors min-w-0 ${on ? 'border-silver/60 bg-silver/[0.08]' : 'border-borderMuted bg-card hover:border-silver/40 hover:bg-silver/[0.05]'}`}
    data-stocks-sector={s.sector}
    data-on={on || undefined}
  >
    <span className="flex items-center gap-1.5 min-w-0 h-[18px]">
      <span className="font-mono text-[9px] text-textMuted tnum">{String(rank).padStart(2, '0')}</span>
      <SectorMark sector={s.sector} />
      <span className="text-[11px] font-bold text-textPrimary truncate">{SHORT_SECTOR[s.sector] ?? s.sector}</span>
    </span>
    <span className="mt-1.5 block h-[4px] rounded-full bg-ink/[0.06] overflow-hidden">
      <span className={`block h-full rounded-full ${leader ? 'bg-supreme' : PHASE_BAR[s.phase]}`} style={{ width: `${Math.round((s.score / top) * 100)}%` }} />
    </span>
    <span className={`mt-1 block h-[12px] font-mono text-[8px] uppercase tracking-widest whitespace-nowrap ${leader ? 'text-supreme' : PHASE_INK[s.phase]}`}>{leader ? 'LEADING' : PHASE_WORD[s.phase]}</span>
    <span className="mt-0.5 block h-[12px] font-mono text-[9px] tnum whitespace-nowrap">
      <span className="text-textMuted">1w </span>
      <span className={dirInk(s.rs1w)}>{signedPct(s.rs1w)}</span>
      <span className="text-textMuted"> · 1m </span>
      <span className={dirInk(s.rs1m)}>{signedPct(s.rs1m)}</span>
    </span>
  </button>
);

/* ---- the page ------------------------------------------------------------------ */

const Stocks = () => {
  const { changeTicker } = useMarketData();
  const navigate = useNavigate();
  const boardNames = useBoardNames();
  const [screen, setScreen] = useState<ScreenPick>('all');
  const [sector, setSector] = useState<SectorPick>('all');
  const [names, setNames] = useState<NamesPick>('all');
  const [guideOpen, setGuideOpen] = useState(false);

  /* The board is deterministic per session day; the rotation rolls it up */
  const picks = useMemo(() => buildStockBoard(), []);
  const sectors = useMemo(() => buildSectorBoard(picks), [picks]);
  const top = sectors[0];
  const bottom = sectors[sectors.length - 1];

  /* The cards cut the board; the Filter keeps from the cut */
  const cut = useMemo(() => {
    const board = new Set(boardNames);
    return picks.filter(p => (screen === 'all' || p.verdict === screen) && (sector === 'all' || p.sector === sector) && (names === 'all' || board.has(p.ticker)));
  }, [picks, screen, sector, names, boardNames]);

  /* THE FILTER reads the names on the cut; any pick matching keeps the row. Names
     only — the sectors are the Sector card's and the rotation's (Noah, 2026-09-10:
     a Filter holding Technology contradicted every other sector he clicked) */
  const [filter, setFilter] = useState<string[]>([]);
  const filterGroups = useMemo<MultiGroup[]>(() => {
    const byName = new Map(cut.map(p => [p.ticker, p.name]));
    filter.forEach(f => {
      const key = f.replace(/^name:/, '');
      if (!byName.has(key)) byName.set(key, picks.find(p => p.ticker === key)?.name ?? key);
    });
    return [{ title: 'Names on the page', options: [...byName.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([t, n]) => ({ value: `name:${t}`, label: t, hint: n, count: cut.some(p => p.ticker === t) ? 1 : 0 })) }];
  }, [cut, filter, picks]);
  const rows = useMemo(() => {
    if (filter.length === 0) return cut;
    const on = new Set(filter);
    return cut.filter(p => on.has(`name:${p.ticker}`));
  }, [cut, filter]);

  const facts = useMemo(() => {
    const strong = rows.filter(p => p.verdict === 'ACCUMULATE').length;
    const weak = rows.filter(p => p.verdict === 'AVOID').length;
    const breadth = rows.length ? Math.round((rows.filter(p => p.sleeves.momentum > 50).length / rows.length) * 100) : 0;
    return { names: rows.length, strong, mixed: rows.length - strong - weak, weak, breadth };
  }, [rows]);

  /* The leader is never called a laggard in the same breath: rank and direction are different axes */
  const laggards = sectors.filter(s => s.phase === 'LAGGING' && s.score !== top.score).map(s => s.sector);
  const toggleSector = (s: Sector) => setSector(v => (v === s ? 'all' : s));

  const sentence = useMemo<ReactNode>(
    () => (
      <>
        <span className="text-supreme font-semibold">{top.sector}</span> leads the rotation, {sectors[1].sector} close behind
        {laggards.length > 0 ? (
          <>
            {' — '}
            <span className="text-bear font-semibold">{listPhrase(laggards)}</span> {laggards.length === 1 ? 'is' : 'are'} falling on both windows
          </>
        ) : (
          ' — no sector is falling on both windows'
        )}
        . <span className="text-textPrimary font-semibold">{facts.breadth}%</span> of the names here sit above their trend;{' '}
        <span className="text-bull font-semibold">{facts.strong}</span> screen strong, <span className="text-bear font-semibold">{facts.weak}</span> weak.
      </>
    ),
    [top, sectors, laggards, facts]
  );

  const columnDefs = useMemo<ColDef<StockPick>[]>(
    () => [
      { headerName: 'Name', field: 'ticker', flex: 1.2, minWidth: 180, cellRenderer: NameCell, headerTooltip: 'The company — click the row to open it on the Map' },
      { headerName: 'Sector', field: 'sector', width: 190, cellRenderer: SectorCell, headerTooltip: 'The sector the name files under' },
      { headerName: 'Last', field: 'price', width: 96, cellRenderer: LastCell, type: 'rightAligned', headerTooltip: 'The last price' },
      { headerName: 'Today', field: 'changePct', width: 88, cellRenderer: TodayCell, type: 'rightAligned', headerTooltip: "Today's change" },
      { headerName: '30 days', field: 'trend', width: 100, cellRenderer: TrendCell, sortable: false, headerTooltip: 'Strength against the tape over the last thirty sessions' },
      { headerName: 'Trend', colId: 'momentum', valueGetter: p => p.data?.sleeves.momentum ?? 0, width: 104, cellRenderer: sleeveCell('momentum'), headerTooltip: 'Momentum — is the price trend up and holding; above the 50 line green, below red' },
      { headerName: 'Numbers', colId: 'quality', valueGetter: p => p.data?.sleeves.quality ?? 0, width: 104, cellRenderer: sleeveCell('quality'), headerTooltip: 'Quality — margins, growth and the balance sheet; above the 50 line green, below red' },
      { headerName: 'Money', colId: 'flow', valueGetter: p => p.data?.sleeves.flow ?? 0, width: 104, cellRenderer: sleeveCell('flow'), headerTooltip: 'Flow — what the options and dark-pool money is doing; above the 50 line green, below red' },
      { headerName: 'News', colId: 'news', valueGetter: p => p.data?.sleeves.news ?? 0, width: 104, cellRenderer: sleeveCell('news'), headerTooltip: "The wire's lean on the name; above the 50 line green, below red" },
      { headerName: 'Screen', field: 'verdict', width: 100, cellRenderer: ScreenCell, comparator: (a: StockVerdict, b: StockVerdict) => ['ACCUMULATE', 'HOLD', 'AVOID'].indexOf(a) - ['ACCUMULATE', 'HOLD', 'AVOID'].indexOf(b), headerTooltip: 'The four sleeves rolled into one word — strong, mixed or weak; what the data says, never an instruction' },
      { headerName: 'Why', field: 'thesis', flex: 2, minWidth: 260, cellRenderer: WhyCell, sortable: false, headerTooltip: 'What is for the name, what is against it — hover for the whole line' },
    ],
    []
  );
  const defaultColDef = useMemo<ColDef<StockPick>>(() => ({ sortable: true, resizable: true, suppressMovable: true }), []);

  /* THE CUT GLIDES IN (Noah, 2026-09-10: "clicking on any of the sectors should
     have the smooth glide animation that we have… it just appears"). The old
     page keyed its table by the filter so a swap faded up softly; the grid
     stays mounted here, so its window replays the house soft-in on every new
     cut instead — the rows land in place under it, nothing shuffles. */
  const gridRef = useRef<HTMLDivElement | null>(null);
  const cutKey = `${screen}|${sector}|${names}|${filter.join(',')}`;
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    el.classList.remove('animate-soft-in');
    void el.offsetWidth; // the reflow that lets the animation start again
    el.classList.add('animate-soft-in');
  }, [cutKey]);

  const open = (e: RowClickedEvent<StockPick>) => {
    if (!e.data) return;
    changeTicker(e.data.ticker);
    navigate('/pinpoint/map');
  };

  return (
    <div className="relative border border-borderSubtle rounded-md overflow-hidden bg-panel flex flex-col" data-stocks data-screen={screen} data-sector={sector} data-rows={rows.length}>
      <GuideFocus open={guideOpen} onClose={() => setGuideOpen(false)} title="How to read the screens" testId="stocks-guide" viewport>
        <StocksGuide />
      </GuideFocus>
      {/* THE HEAD */}
      <div className="px-5 pt-4 pb-3 flex items-start gap-6 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="h-6 flex items-center gap-3">
            <h3 className="text-[15px] font-semibold leading-tight text-textPrimary">How every name screens</h3>
            <GuideDoor open={guideOpen} onClick={() => setGuideOpen(v => !v)} title="What the sleeves, the screen and the rotation mean" testId="stocks-guide" />
          </div>
          <p className="mt-0.5 text-[11px] text-textMuted whitespace-nowrap truncate">
            The trend, the numbers, the money and the news, each read against the 50 line and rolled into one screen · strongest first · the rotation ranks the sectors the same way · a row opens the name on the Map
          </p>
        </div>
        <dl className="grid grid-flow-col auto-cols-max gap-x-6">
          <div>
            <dt className="text-[10px] text-textMuted">Names</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap" data-stocks-names>
              {facts.names} <span className="text-textMuted">·</span> <span className="text-bull">{facts.strong} strong</span> <span className="text-textMuted">·</span> <span className="text-textSecondary">{facts.mixed} mixed</span> <span className="text-textMuted">·</span> <span className="text-bear">{facts.weak} weak</span>
            </dd>
          </div>
          <div>
            <dt className="text-[10px] text-textMuted">Above their trend</dt>
            <dd className={`mt-0.5 font-mono text-[12px] tnum whitespace-nowrap ${facts.breadth >= 55 ? 'text-bull' : facts.breadth <= 40 ? 'text-bear' : 'text-textPrimary'}`} data-stocks-breadth>
              {facts.breadth}%
            </dd>
          </div>
          <div>
            <dt className="text-[10px] text-textMuted">Leading sector</dt>
            <dd className="mt-0.5 whitespace-nowrap" data-stocks-leader>
              <button type="button" onClick={() => toggleSector(top.sector)} title={`Keep the grid to ${top.sector}`} className="font-mono text-[12px] tnum text-supreme font-semibold hover:underline underline-offset-2">
                {top.sector}
              </button>
            </dd>
          </div>
          <div>
            <dt className="text-[10px] text-textMuted">Trailing sector</dt>
            <dd className="mt-0.5 whitespace-nowrap" data-stocks-trailer>
              <button type="button" onClick={() => toggleSector(bottom.sector)} title={`Keep the grid to ${bottom.sector}`} className="font-mono text-[12px] tnum text-bear hover:underline underline-offset-2">
                {bottom.sector}
              </button>
            </dd>
          </div>
        </dl>
      </div>
      {/* THE ONE LINE OF CONTROLS */}
      <div className="px-5 pb-2 flex items-center gap-2 flex-wrap" data-stocks-controls>
        <DropdownSelect label="Screen" value={screen} options={SCREEN_OPTIONS} onChange={setScreen} title="Which screens" testId="stocks-screen" />
        <DropdownSelect label="Sector" value={sector} options={SECTOR_OPTIONS} onChange={setSector} title="Which sector" testId="stocks-sector" />
        <DropdownSelect label="Names" value={names} options={NAMES_OPTIONS} onChange={setNames} title="Which companies" testId="stocks-names" />
        <div className="ml-auto" title="The names on the page right now — tick any number; only those stay">
          <DropdownMulti label="Filter" values={filter} groups={filterGroups} onChange={setFilter} title="Keep only these" testId="stocks-filter" />
        </div>
      </div>
      <p className="px-5 pb-3 text-[12px] leading-relaxed text-textSecondary" data-stocks-sentence>
        {sentence}
      </p>
      {/* THE ROTATION */}
      <div className="px-5 pb-3 border-t border-borderSubtle/60" data-stocks-rotation>
        <div className="h-[26px] flex items-center gap-3 text-[10px] font-semibold uppercase tracking-widest text-textPrimary">
          <span>The rotation</span>
          <span className="normal-case tracking-normal font-normal text-[10px] text-textSecondary">every sector ranked by its names' screens, leader first · the two windows against the tape · click a sector to keep the grid to its names</span>
        </div>
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${ROTATION_SECTORS}, minmax(0, 1fr))` }}>
          {sectors.map((s, i) => (
            <SectorCard key={s.sector} s={s} rank={i + 1} leader={s.score === top.score} top={top.score} on={sector === s.sector} onToggle={() => toggleSector(s.sector)} />
          ))}
        </div>
      </div>
      {/* THE GRID — grown to its rows, the page scrolls (2026-09-11, the Compass board's rule) */}
      <div ref={gridRef} className="slayer-board border-t border-borderSubtle" data-stocks-grid>
        <AgGridProvider modules={GRID_MODULES}>
          <AgGridReact<StockPick>
            theme={GRID_THEME}
            domLayout="autoHeight"
            rowData={rows}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            getRowId={p => p.data.ticker}
            onRowClicked={open}
            rowSelection={{ mode: 'singleRow', checkboxes: false, enableClickSelection: true }}
            suppressCellFocus
            animateRows={false}
            tooltipShowDelay={350}
            tooltipHideDelay={8000}
            overlayNoRowsTemplate='<span class="font-mono text-[10px] uppercase tracking-widest text-textMuted">No name on this cut</span>'
          />
        </AgGridProvider>
      </div>
    </div>
  );
};

export default Stocks;
