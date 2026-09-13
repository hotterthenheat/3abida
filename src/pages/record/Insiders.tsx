/*
==================================================
  SLAYER TERMINAL - INSIDERS (pages/record/Insiders.tsx)

  What the people who run these companies did with
  their own shares — and whether they chose to. The
  partner's "Keyhole" (2026-09-09) in the house, and
  walked the same evening (Noah: "move onto the
  insiders page"):

    THE HEAD      four facts
    THE CARDS     Window · Show · Role · Names, and
                  the Filter as a card that reads the
                  names, people and roles on the page
    THE SENTENCE
    THE NAMES     where someone chose to buy with
    TO KNOW       their own money, heaviest first —
                  the read the rows alone never gave;
                  a card filters the grid to its name
    THE GRID      in a window a screen tall that
                  scrolls inside itself, its head
                  pinned — the page stays one screen

  Open-market trades by default; the plumbing one
  card away, marked for what it is. A row's name
  opens it on the Map.
==================================================
*/

import { useMemo, useState } from 'react';
import { now } from '../../core/clock';
import { useNavigate } from 'react-router-dom';
import { type ColDef, type ICellRendererParams, type RowClickedEvent } from 'ag-grid-community';
import { AgGridProvider, AgGridReact } from 'ag-grid-react';
import { GRID_MODULES, GRID_THEME } from '../../components/ui/houseGrid';
import DropdownSelect, { type DropdownOption } from '../../components/ui/DropdownSelect';
import DropdownMulti, { type MultiGroup } from '../../components/ui/DropdownMulti';
import GuideFocus, { GuideDoor } from '../../components/ui/GuideFocus';
import CompanyLogo from '../../components/ui/CompanyLogo';
import { InsidersGuide } from '../../components/record/InsidersGuide';
import { useMarketData } from '../../context/MarketDataContext';
import { fmtDollars } from '../../data/ahead';
import { useBoardNames } from '../../data/boardNames';
import { ALL_CODES, OPEN_MARKET_CODES, TX_CODES, insiderBuyers, insiderFeed, insidersSentence, isChosenBuy } from '../../data/insiders';
import { tickerName } from '../../data/tickers';
import type { InsiderFlow, InsiderRole, InsiderTrade } from '../../types/record';
import { NAMES_TO_KNOW } from './recordSkeletons';

type Window = 30 | 90 | 180;
type Show = 'market' | 'all';
type RolePick = 'any' | InsiderRole;
type NamesPick = 'all' | 'board';

const WINDOW_OPTIONS: DropdownOption<Window>[] = [
  { value: 30, label: '30 days', hint: 'Filings in the last month' },
  { value: 90, label: '90 days', hint: 'The last quarter' },
  { value: 180, label: '180 days', hint: 'The last half year' },
];
const SHOW_OPTIONS: DropdownOption<Show>[] = [
  { value: 'market', label: 'Open-market trades', hint: 'Purchases and sales someone made in the market — the rows that are trades' },
  { value: 'all', label: 'Every filing', hint: 'With the grants, conversions, withholdings and gifts — compensation plumbing, marked for what it is' },
];
const ROLE_OPTIONS: DropdownOption<RolePick>[] = [
  { value: 'any', label: 'Any role', hint: 'Officers, directors and holders of a tenth' },
  { value: 'CEO', label: 'CEO', hint: 'The chief executive' },
  { value: 'CFO', label: 'CFO', hint: 'The chief financial officer' },
  { value: 'COO', label: 'COO', hint: 'The chief operating officer' },
  { value: 'Director', label: 'Director', hint: 'Board members' },
  { value: 'EVP', label: 'EVP', hint: 'Executive vice presidents' },
  { value: 'Chief Legal Officer', label: 'Chief Legal Officer', hint: 'The general counsel' },
  { value: '10% owner', label: '10% owner', hint: 'Holders of a tenth of the company' },
];
const NAMES_OPTIONS: DropdownOption<NamesPick>[] = [
  { value: 'all', label: 'Every name', hint: 'Every company the terminal files' },
  { value: 'board', label: 'Your board', hint: 'The names on your Board' },
];

/** The engine's word for a name, in the page's ink */
const SIGNAL_WORD: Record<InsiderFlow['signal'], { word: string; ink: string }> = {
  accumulating: { word: 'accumulating', ink: 'text-bull' },
  distributing: { word: 'distributing', ink: 'text-bear' },
  'scheduled selling': { word: 'scheduled selling', ink: 'text-textMuted' },
  quiet: { word: 'quiet', ink: 'text-textMuted' },
};

/* THE DATE, THEN HOW LONG AGO (Noah, 2026-09-13: "the WHEN should not be 9d
   ago cause who is naming what 9 days ago was — have specific dates, or it
   can be 9/19 · 2 days ago type of thing") */
const dated = (d: number): string => {
  const t = now();
  t.setDate(t.getDate() - Math.max(0, d));
  return `${t.getMonth() + 1}/${t.getDate()}`;
};
const ago = (d: number) => `${dated(d)} · ${d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d}d ago`}`;
const fmtInt = (n: number) => Math.round(n).toLocaleString('en-US');

/* ---- cells --------------------------------------------------------------------- */

const WhenCell = ({ data }: ICellRendererParams<InsiderTrade>) => (data ? <span className="font-mono text-[11px] tnum text-textPrimary">{ago(data.daysAgo)}</span> : null);

const NameCell = ({ data }: ICellRendererParams<InsiderTrade>) =>
  data ? (
    <span className="inline-flex items-center gap-2 min-w-0">
      <CompanyLogo ticker={data.ticker} size={16} />
      <span className="flex flex-col leading-tight min-w-0">
        <span className="font-mono text-[12px] font-bold text-textPrimary">{data.ticker}</span>
        <span className="text-[10px] text-textMuted truncate">{tickerName(data.ticker)}</span>
      </span>
    </span>
  ) : null;

const WhoCell = ({ data }: ICellRendererParams<InsiderTrade>) =>
  data ? (
    <span className="flex flex-col leading-tight min-w-0">
      <span className="text-[12px] font-semibold text-textPrimary truncate">{data.person}</span>
      <span className="text-[10px] text-textMuted truncate">{data.role}</span>
    </span>
  ) : null;

/** The trade in words: bought or sold in the market in the direction inks; the plumbing named and quiet */
const TradeCell = ({ data }: ICellRendererParams<InsiderTrade>) => {
  if (!data) return null;
  const meta = TX_CODES[data.code];
  if (meta.openMarket)
    return (
      <span className={`font-mono text-[11px] tnum ${data.kind === 'BUY' ? 'text-bull' : 'text-bear'}`} title={meta.note}>
        {data.kind === 'BUY' ? 'Bought' : 'Sold'}
      </span>
    );
  return (
    <span className="font-mono text-[10px] text-textMuted" title={meta.note}>
      {meta.label}
    </span>
  );
};

const SharesCell = ({ data }: ICellRendererParams<InsiderTrade>) => (data ? <span className="font-mono text-[11px] tnum text-textPrimary">{fmtInt(data.shares)}</span> : null);
const PriceCell = ({ data }: ICellRendererParams<InsiderTrade>) => (data ? <span className="font-mono text-[11px] tnum text-textSecondary">${data.price.toFixed(2)}</span> : null);
const ValueCell = ({ data }: ICellRendererParams<InsiderTrade>) => (data ? <span className="font-mono text-[11px] tnum font-semibold text-textPrimary">{fmtDollars(data.value)}</span> : null);
const StakeCell = ({ data }: ICellRendererParams<InsiderTrade>) => (data ? <span className="font-mono text-[11px] tnum text-textSecondary">{data.stakePct.toFixed(1)}%</span> : null);

/** Chosen, planned or unstated — the flag the whole page turns on */
const PlanCell = ({ data }: ICellRendererParams<InsiderTrade>) => {
  if (!data) return null;
  if (!TX_CODES[data.code].openMarket) return <span className="font-mono text-[10px] text-textMuted">—</span>;
  if (data.plan === 'plan') return <span className="font-mono text-[8px] uppercase tracking-widest text-textMuted" title="Ran off a 10b5-1 plan adopted months earlier — no view on the day">planned</span>;
  if (data.plan === 'unknown') return <span className="font-mono text-[8px] uppercase tracking-widest text-textMuted" title="The filing carried no plan box either way">unstated</span>;
  const loud = isChosenBuy(data);
  return (
    <span className={`font-mono text-[8px] uppercase tracking-widest ${loud ? 'text-textPrimary font-bold' : 'text-textSecondary'}`} title={loud ? 'A purchase the insider chose to make with their own money — the loudest row here' : 'A trade the insider chose to make'}>
      chosen
    </span>
  );
};

const OthersCell = ({ data }: ICellRendererParams<InsiderTrade>) => {
  if (!data) return null;
  if (data.clusterCount < 2) return <span className="font-mono text-[10px] text-textMuted">—</span>;
  return (
    <span className="font-mono text-[11px] tnum text-textPrimary" title={`${data.clusterCount} filers did the same in this name inside 30 days`}>
      {data.clusterCount} filers
    </span>
  );
};

/* ---- the names to know --------------------------------------------------------- */

/** One name where someone chose to buy: the mark, the dollars, the filers, the engine's word. A click keeps the grid to it. */
const NameCard = ({ f, on, onToggle }: { f: InsiderFlow; on: boolean; onToggle: () => void }) => {
  const s = SIGNAL_WORD[f.signal];
  /* the distinct people who chose to buy in the window (the engine's cluster counts thirty days only) */
  const buyers = new Set(f.trades.filter(t => isChosenBuy(t)).map(t => t.person)).size;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      title={on ? `Showing ${f.ticker} only — click to show every name` : `Keep the grid to ${f.ticker}`}
      /* Lifted a tier from the panel (Noah, 2026-09-09: "too many grays … practically invisible"):
         the stronger border on a lighter ground, the words in the secondary and primary inks */
      className={`group text-left rounded-md border px-3 py-2.5 transition-colors ${on ? 'border-silver/60 bg-silver/[0.08]' : 'border-borderMuted bg-card hover:border-silver/40 hover:bg-silver/[0.05]'}`}
      data-insiders-name={f.ticker}
      data-on={on || undefined}
    >
      <span className="flex items-center gap-2 min-w-0">
        <CompanyLogo ticker={f.ticker} size={18} />
        <span className="font-mono text-[12px] font-bold text-textPrimary">{f.ticker}</span>
        <span className="text-[10px] text-textSecondary truncate">{tickerName(f.ticker)}</span>
      </span>
      <span className="mt-1.5 flex items-baseline gap-2 font-mono tnum">
        <span className="text-[13px] font-bold text-bull">{fmtDollars(f.openMarketBuys)}</span>
        <span className="text-[9px] text-textSecondary">chosen buying</span>
        <span className="ml-auto text-[10px] text-textPrimary">
          {buyers} {buyers === 1 ? 'buyer' : 'buyers'}
        </span>
      </span>
      <span className={`mt-1 block font-mono text-[8px] uppercase tracking-widest ${s.ink}`}>{s.word}</span>
    </button>
  );
};

/* ---- the page ------------------------------------------------------------------ */

const Insiders = () => {
  const { changeTicker } = useMarketData();
  const navigate = useNavigate();
  const boardNames = useBoardNames();
  const [window, setWindow] = useState<Window>(90);
  const [show, setShow] = useState<Show>('market');
  const [role, setRole] = useState<RolePick>('any');
  const [names, setNames] = useState<NamesPick>('all');
  const [guideOpen, setGuideOpen] = useState(false);

  /* The feed is deterministic per session day; the cards cut it, the Filter keeps from the cut */
  const feed = useMemo(() => insiderFeed(window, show === 'market' ? OPEN_MARKET_CODES : ALL_CODES), [window, show]);
  const cut = useMemo(() => {
    const board = new Set(boardNames);
    return feed.filter(t => (role === 'any' || t.role === role) && (names === 'all' || board.has(t.ticker)));
  }, [feed, role, names, boardNames]);

  /* THE FILTER reads the names, people and roles on the cut (Noah: "it should read
     whats on the current page … so user can select what to add"); any pick matching keeps the row */
  const [picks, setPicks] = useState<string[]>([]);
  const filterGroups = useMemo<MultiGroup[]>(() => {
    const count = (key: (t: InsiderTrade) => string) => {
      const m = new Map<string, number>();
      cut.forEach(t => m.set(key(t), (m.get(key(t)) ?? 0) + 1));
      return m;
    };
    const byNames = count(t => t.ticker);
    const byPeople = count(t => t.person);
    const byRoles = count(t => t.role);
    picks.forEach(p => {
      const [kind, ...rest] = p.split(':');
      const key = rest.join(':');
      if (kind === 'name' && !byNames.has(key)) byNames.set(key, 0);
      if (kind === 'person' && !byPeople.has(key)) byPeople.set(key, 0);
      if (kind === 'role' && !byRoles.has(key)) byRoles.set(key, 0);
    });
    const order = (a: [string, number], b: [string, number]) => b[1] - a[1] || a[0].localeCompare(b[0]);
    const roleOf = (person: string) => cut.find(t => t.person === person);
    return [
      { title: 'Names', options: [...byNames.entries()].sort(order).map(([n, c]) => ({ value: `name:${n}`, label: n, hint: tickerName(n), count: c })) },
      { title: 'People', options: [...byPeople.entries()].sort(order).map(([p, c]) => ({ value: `person:${p}`, label: p, hint: roleOf(p) ? `${roleOf(p)!.role} · ${roleOf(p)!.ticker}` : undefined, count: c })) },
      { title: 'Roles', options: [...byRoles.entries()].sort(order).map(([r, c]) => ({ value: `role:${r}`, label: r, count: c })) },
    ];
  }, [cut, picks]);
  const rows = useMemo(() => {
    if (picks.length === 0) return cut;
    const picked = new Set(picks);
    return cut.filter(t => picked.has(`name:${t.ticker}`) || picked.has(`person:${t.person}`) || picked.has(`role:${t.role}`));
  }, [cut, picks]);
  const toggleName = (ticker: string) => setPicks(p => (p.includes(`name:${ticker}`) ? p.filter(x => x !== `name:${ticker}`) : [...p, `name:${ticker}`]));

  const facts = useMemo(() => {
    const market = rows.filter(t => TX_CODES[t.code].openMarket);
    const chosen = market.filter(t => isChosenBuy(t)).reduce((s, t) => s + t.value, 0);
    const sales = market.filter(t => t.kind === 'SELL');
    const sold = sales.reduce((s, t) => s + t.value, 0);
    const planned = sales.filter(t => t.plan === 'plan').length;
    return { filings: rows.length, chosen, sold, plannedPct: sales.length ? Math.round((planned / sales.length) * 100) : null };
  }, [rows]);

  /* THE NAMES TO KNOW: chosen buying in the window, heaviest first, on the Names card's cut */
  const toKnow = useMemo(() => {
    const board = new Set(boardNames);
    return insiderBuyers(window)
      .filter(f => names === 'all' || board.has(f.ticker))
      .slice(0, NAMES_TO_KNOW);
  }, [window, names, boardNames]);

  const columnDefs = useMemo<ColDef<InsiderTrade>[]>(
    () => [
      { headerName: 'When', field: 'daysAgo', width: 118, cellRenderer: WhenCell, sort: 'asc', headerTooltip: 'When the trade happened — newest first' },
      { headerName: 'Name', field: 'ticker', flex: 1.3, minWidth: 170, cellRenderer: NameCell, headerTooltip: 'The company — click the row to open it on the Map' },
      { headerName: 'Who', field: 'person', flex: 1.4, minWidth: 180, cellRenderer: WhoCell, headerTooltip: 'The insider and their role — invented names until the feed lands' },
      { headerName: 'Trade', field: 'code', flex: 0.9, minWidth: 120, cellRenderer: TradeCell, headerTooltip: 'Bought or sold in the market; with Every filing on, the grants, conversions and withholdings are named for what they are' },
      { headerName: 'Shares', field: 'shares', width: 100, cellRenderer: SharesCell, type: 'rightAligned', headerTooltip: 'Shares in the transaction' },
      { headerName: 'Price', field: 'price', width: 96, cellRenderer: PriceCell, type: 'rightAligned', headerTooltip: 'The filed price per share' },
      { headerName: 'Value', field: 'value', width: 104, cellRenderer: ValueCell, type: 'rightAligned', headerTooltip: 'Shares times the filed price' },
      { headerName: 'Of stake', field: 'stakePct', width: 96, cellRenderer: StakeCell, type: 'rightAligned', headerTooltip: "The share of the insider's own holding this trade was" },
      {
        headerName: 'Chose to?',
        field: 'plan',
        width: 104,
        cellRenderer: PlanCell,
        comparator: (a: InsiderTrade['plan'], b: InsiderTrade['plan']) => ['discretionary', 'unknown', 'plan'].indexOf(a) - ['discretionary', 'unknown', 'plan'].indexOf(b),
        headerTooltip: 'Chosen: the insider decided to trade. Planned: it ran off a 10b5-1 schedule adopted months earlier. Unstated: the filing carried no box either way',
      },
      { headerName: 'Others', field: 'clusterCount', width: 92, cellRenderer: OthersCell, headerTooltip: 'How many distinct filers did the same in this name inside 30 days — a cluster is a stronger read than one' },
    ],
    []
  );
  const defaultColDef = useMemo<ColDef<InsiderTrade>>(() => ({ sortable: true, resizable: true, suppressMovable: true }), []);
  const open = (e: RowClickedEvent<InsiderTrade>) => {
    if (!e.data) return;
    changeTicker(e.data.ticker);
    navigate('/pinpoint/map');
  };

  return (
    <div className="relative border border-borderSubtle rounded-md overflow-hidden bg-panel flex flex-col" data-insiders data-window={window} data-show={show}>
      <GuideFocus open={guideOpen} onClose={() => setGuideOpen(false)} title="How to read the filings" testId="insiders-guide" viewport>
        <InsidersGuide />
      </GuideFocus>
      {/* THE HEAD */}
      <div className="px-5 pt-4 pb-3 flex items-start gap-6 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="h-6 flex items-center gap-3">
            <h3 className="text-[15px] font-semibold leading-tight text-textPrimary">What insiders did</h3>
            <GuideDoor open={guideOpen} onClick={() => setGuideOpen(v => !v)} title="What a row, a chosen trade and a plan mean" testId="insiders-guide" />
          </div>
          <p className="mt-0.5 text-[11px] text-textSecondary whitespace-nowrap truncate">
            {show === 'market' ? 'Open-market purchases and sales only — the rows that are trades; the grants and withholdings are one card away' : 'Every filing, the plumbing named for what it is'} · newest first · the people are invented until the feed lands
          </p>
        </div>
        <dl className="grid grid-cols-4 gap-x-6">
          <div>
            <dt className="text-[10px] text-textMuted">Filings</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap" data-insiders-count>
              {facts.filings}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] text-textMuted">Chosen buying</dt>
            <dd className={`mt-0.5 font-mono text-[12px] tnum whitespace-nowrap ${facts.chosen > 0 ? 'text-bull' : 'text-textMuted'}`} data-insiders-chosen>
              {facts.chosen > 0 ? fmtDollars(facts.chosen) : 'none'}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] text-textMuted">Sold in the market</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap" data-insiders-sold>
              {facts.sold > 0 ? fmtDollars(facts.sold) : 'none'}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] text-textMuted">Sales on a plan</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap" data-insiders-planned>
              {facts.plannedPct == null ? '—' : `${facts.plannedPct}%`}
            </dd>
          </div>
        </dl>
      </div>
      {/* THE ONE LINE OF CONTROLS */}
      <div className="px-5 pb-2 flex items-center gap-2 flex-wrap" data-insiders-controls>
        <DropdownSelect label="Window" value={window} options={WINDOW_OPTIONS} onChange={setWindow} title="How far back the filings run" testId="insiders-window" />
        <DropdownSelect label="Show" value={show} options={SHOW_OPTIONS} onChange={setShow} title="Trades only, or every filing" testId="insiders-show" />
        <DropdownSelect label="Role" value={role} options={ROLE_OPTIONS} onChange={setRole} title="Whose filings" testId="insiders-role" />
        <DropdownSelect label="Names" value={names} options={NAMES_OPTIONS} onChange={setNames} title="Which companies" testId="insiders-names" />
        <div className="ml-auto" title="The names, people and roles on the page right now — tick any number; only those stay">
          <DropdownMulti label="Filter" values={picks} groups={filterGroups} onChange={setPicks} title="Keep only these" testId="insiders-filter" />
        </div>
      </div>
      <p className="px-5 pb-3 text-[12px] leading-relaxed text-textSecondary" data-insiders-sentence>
        {insidersSentence(rows, window)}
      </p>
      {/* THE NAMES TO KNOW */}
      <div className="px-5 pb-3 border-t border-borderSubtle/60" data-insiders-to-know>
        <div className="h-[26px] flex items-center gap-3 text-[10px] font-semibold uppercase tracking-widest text-textPrimary">
          <span>The names to know</span>
          <span className="normal-case tracking-normal font-normal text-[10px] text-textSecondary">where someone chose to buy with their own money in the last {window} days, heaviest first · click a name to keep the grid to it</span>
        </div>
        {toKnow.length === 0 ? (
          <div className="h-[70px] flex items-center font-mono text-[10px] uppercase tracking-widest text-textMuted">No insider chose to buy in this window</div>
        ) : (
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${NAMES_TO_KNOW}, minmax(0, 1fr))` }}>
            {toKnow.map(f => (
              <NameCard key={f.ticker} f={f} on={picks.includes(`name:${f.ticker}`)} onToggle={() => toggleName(f.ticker)} />
            ))}
          </div>
        )}
      </div>
      {/* THE GRID — grown to its rows, the page scrolls (2026-09-11, the Compass board's rule) */}
      <div className="slayer-board border-t border-borderSubtle" data-insiders-grid>
        <AgGridProvider modules={GRID_MODULES}>
          <AgGridReact<InsiderTrade>
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

export default Insiders;
