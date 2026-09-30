/*
==================================================
  SLAYER TERMINAL - THE SCREENER (Trace)

  The whole day's option book, asked questions
  (Noah, 2026-08-30; walked into the house grammar
  2026-09-09): one box — the head with the book's
  facts and its champions, one line of cards
  (Screen · Side · Tenor · Volume · Premium · Money)
  beside the live hold, the search and the column
  chooser, the sentence, then every contract in the
  house grid a screen tall. Screens are QUESTIONS,
  not judgments: a row opens the contract's card,
  and THERE the one state engine grades it.
==================================================
*/

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Link2, Save, Trash2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { filtersToParams, paramsToFilters } from '../../data/screenerViews';
import { screenerCuts } from '../../data/screenerViews';
import { SavedCutsControl, SavedCutsList, useSavedCuts } from '../../components/trace/SavedCuts';
import { useMarketData } from '../../context/MarketDataContext';
import Simulator from '../../core/simulator';
import { applyFilters, buildFlowBook, DEFAULT_FILTERS, FLOW_SCREENS, runScreen, type BookFilters, type ScreenKey } from '../../data/flowBook';
import { fmtUsd } from '../../data/gex';
import { SLEEVES, type SleeveKey } from '../../types/compass';
import type { BookContract } from '../../types/trace';
import type { Column } from '../../components/ui/DataTable';
import CompanyLogo from '../../components/ui/CompanyLogo';
import RichRead from '../../components/ui/RichRead';
import DropdownSelect, { type DropdownOption } from '../../components/ui/DropdownSelect';
import DropdownMulti from '../../components/ui/DropdownMulti';
import BookDrill from '../../components/trace/BookDrill';
import ContractCell from '../../components/trace/ContractCell';
import { earnMarks, weightInk } from '../../components/trace/earnedInk';
import FlowSearch, { normSymbol } from '../../components/trace/FlowSearch';
import { LiveHold, useHold } from '../../components/trace/LiveHold';
import ColumnChooser, { useHiddenColumns } from '../../components/trace/ColumnChooser';
import LeanCell from '../../components/trace/LeanCell';
import { SectorName } from '../../components/trace/SectorMark';
import WatchStar from '../../components/trace/WatchStar';
import TraceBox, { Champion, Fact, TraceGrid } from '../../components/trace/TraceBox';
import { ScreenerGuide } from '../../components/trace/TraceGuide';
import { contractKey, watchContract } from '../../context/WatchContext';
import ExpiryCalendar from '../../components/ui/ExpiryCalendar';
import { useExpiryCut } from '../../components/trace/bookExpiry';
import { isoDate } from '../../core/calendar';

const FILTERS_KEY = 'slayer_screener_filters';
const num = (v: number) => v.toLocaleString('en-US');

function loadFilters(): BookFilters {
  try {
    const raw = localStorage.getItem(FILTERS_KEY);
    if (!raw) return DEFAULT_FILTERS;
    const p = JSON.parse(raw) as Partial<BookFilters>;
    const sleeveKeys = SLEEVES.map(s => s.key);
    return {
      side: p.side === 'C' || p.side === 'P' ? p.side : 'ALL',
      tenors: Array.isArray(p.tenors) ? (p.tenors.filter(t => sleeveKeys.includes(t as SleeveKey)) as SleeveKey[]) : [],
      minVolume: Number.isFinite(p.minVolume) ? Math.max(0, Number(p.minVolume)) : 0,
      minPremium: Number.isFinite(p.minPremium) ? Math.max(0, Number(p.minPremium)) : 0,
      excludeItm: p.excludeItm === true,
    };
  } catch {
    return DEFAULT_FILTERS;
  }
}

/* THE CARDS — the filters popover's chips and number boxes as labelled cards (the approved look) */
const SIDE_OPTIONS: DropdownOption<BookFilters['side']>[] = [
  { value: 'ALL', label: 'Both', hint: 'Calls and puts' },
  { value: 'C', label: 'Calls', hint: 'Calls only' },
  { value: 'P', label: 'Puts', hint: 'Puts only' },
];
const VOLUME_STEPS = [0, 1_000, 5_000, 25_000, 100_000];
const VOLUME_OPTIONS: DropdownOption<number>[] = [
  { value: 0, label: 'Any volume', hint: 'Every contract that traded' },
  { value: 1_000, label: '1K and up', hint: 'At least a thousand contracts' },
  { value: 5_000, label: '5K and up', hint: 'At least five thousand' },
  { value: 25_000, label: '25K and up', hint: 'At least twenty-five thousand' },
  { value: 100_000, label: '100K and up', hint: 'The heaviest names only' },
];
const PREMIUM_STEPS = [0, 100_000, 1_000_000, 10_000_000];
const PREMIUM_OPTIONS: DropdownOption<number>[] = [
  { value: 0, label: 'Any premium', hint: 'Whatever the money' },
  { value: 100_000, label: '$100K and up', hint: 'At least a hundred thousand dollars' },
  { value: 1_000_000, label: '$1M and up', hint: 'At least a million' },
  { value: 10_000_000, label: '$10M and up', hint: 'Ten million and more' },
];
const MONEY_OPTIONS: DropdownOption<'any' | 'otm'>[] = [
  { value: 'any', label: 'Any strike', hint: 'In and out of the money' },
  { value: 'otm', label: 'Out of the money', hint: 'Strikes past the stock only' },
];
const snap = (v: number, steps: number[]) => steps.reduce((best, s) => (s <= v ? s : best), 0);

/** The grid's own widths where flex would starve a cell */
const WIDTHS: Record<string, number> = { time: 92, ticker: 96, contract: 150, dte: 64, otm: 76, last: 118, doi: 150, prem: 92, iv: 100, sector: 176 , lean: 96 };
const TOOLTIPS: Record<string, string> = {
  time: 'When the contract last printed — the star marks it for the Tracker',
  contract: 'The strike, the side and the expiry — click the row for the card',
  otm: 'How far the strike sits from the stock, as a percent',
  voloi: 'Volume over open interest — above 1.5 the positions were built today',
  sweep: 'The share of the volume that swept across exchanges',
  floor: 'The share that printed on the floor — worked orders',
  multi: 'The share that was a leg of a multi-leg structure',
  lean: 'Whether the volume paid the ask or hit the bid',
};

const OptionsScreener = () => {
  const { marketData, activeTicker } = useMarketData();
  const [params, setParams] = useSearchParams();

  /* THE URL WINS OVER THE STORED FILTER. A link someone was SENT is a more
     specific instruction than whatever this reader happened to be looking at
     last, and opening a shared screen only to get your own old one back
     would make links pointless. With no query, the stored filter stands. */
  const fromUrl = useMemo(() => paramsToFilters(params, SLEEVES.map(x => x.key)), [params]);
  const [screen, setScreen] = useState<ScreenKey>(
    () => (fromUrl.screen && FLOW_SCREENS.some(x => x.key === fromUrl.screen) ? (fromUrl.screen as ScreenKey) : 'active')
  );
  const [filters, setFilters] = useState<BookFilters>(() => (fromUrl.any ? fromUrl.filters : loadFilters()));
  const [query, setQuery] = useState(fromUrl.query);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const cuts = useSavedCuts();

  useEffect(() => {
    try {
      localStorage.setItem(FILTERS_KEY, JSON.stringify(filters));
    } catch {
      /* private mode — filters just don't persist */
    }
  }, [filters]);

  /* The address follows the screen. `replace` rather than push: tuning a
     filter is not a place a reader wants twenty Back presses to walk through. */
  useEffect(() => {
    const next = filtersToParams(filters, screen === 'active' ? undefined : screen, query || undefined);
    if (next.toString() !== params.toString()) setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, screen, query]);

  /* AND THE OTHER DIRECTION. Opening a saved view, pressing Back, or pasting
     a link changes the address without touching state — so state follows it.
     The guard is the same string comparison the writer uses, which is what
     keeps the two effects from chasing each other: neither fires unless the
     address and the screen actually disagree. */
  useEffect(() => {
    const mine = filtersToParams(filters, screen === 'active' ? undefined : screen, query || undefined);
    if (mine.toString() === params.toString()) return;
    const next = paramsToFilters(params, SLEEVES.map(x => x.key));
    setFilters(next.filters);
    setQuery(next.query);
    setScreen(next.screen && FLOW_SCREENS.some(x => x.key === next.screen) ? (next.screen as ScreenKey) : 'active');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);


  const liveBook = useMemo(
    () => buildFlowBook(Simulator.universeQuotes(activeTicker)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeTicker, marketData]
  );
  /* ONE hold for the whole page: paused, the book AND the tick freeze together */
  const hold = useHold(useMemo(() => ({ book: liveBook, tick: marketData }), [liveBook, marketData]), activeTicker);
  const { book: heldBook, tick } = hold.value;
  /* THE EXPIRY CUT (2026-09-12): the dates on the book, as a calendar */
  const { expiry, setExpiry, expiries, cut: cutExpiry, chosen } = useExpiryCut(heldBook, r => r.expiry);
  const book = useMemo(() => cutExpiry(heldBook), [heldBook, cutExpiry]);
  const keyOf = useCallback((r: { key: string }) => r.key, []);
  const openRow = useCallback((r: { key: string }) => setOpenKey(r.key), []);

  const rows = useMemo(() => {
    const cut = applyFilters(runScreen(book, screen), filters);
    const nq = normSymbol(query);
    return nq === '' ? cut : cut.filter(r => normSymbol(`${r.ticker}${r.strike}${r.right}`).includes(nq));
  }, [book, screen, filters, query]);

  /* Three registers per column — see components/trace/earnedInk.ts */
  const marks = useMemo(() => ({ vol: earnMarks(rows, r => r.volume), oi: earnMarks(rows, r => r.oi), doi: earnMarks(rows, r => r.deltaOI), prem: earnMarks(rows, r => r.premium) }), [rows]);

  const facts = useMemo(() => {
    let prem = 0;
    let callPrem = 0;
    let fresh = 0;
    const names = new Set<string>();
    for (const r of rows) {
      prem += r.premium;
      if (r.right === 'C') callPrem += r.premium;
      if (r.volOverOI >= 1.5) fresh++;
      names.add(r.ticker);
    }
    return { prem, callPct: Math.round((callPrem / Math.max(1, prem)) * 100), fresh, names: names.size };
  }, [rows]);
  const champs = useMemo(() => {
    const by = (pick: (r: BookContract) => boolean) => rows.filter(pick).reduce<BookContract | null>((a, r) => (a === null || r.premium > a.premium ? r : a), null);
    return { call: by(r => r.right === 'C'), put: by(r => r.right === 'P'), all: by(() => true) };
  }, [rows]);
  const sentence = useMemo(() => {
    if (rows.length === 0) return 'Nothing on this cut yet.';
    return `${fmtUsd(facts.prem)} across ${rows.length} contracts on ${facts.names} names — calls ${facts.callPct}% of it, puts ${100 - facts.callPct}%. ${facts.fresh} contracts trading past their open interest.`;
  }, [rows.length, facts]);
  const activeScreen = FLOW_SCREENS.find(s => s.key === screen) ?? FLOW_SCREENS[0];
  const pill = (r: BookContract) => `${r.ticker} ${r.strike}${r.right} · ${fmtUsd(r.premium)}`;

  const columns = useMemo<Column<BookContract>[]>(
    () => [
      {
        key: 'time',
        header: 'Last',
        sortValue: r => r.lastAtMin,
        render: r => (
          <span className="inline-flex items-center gap-1.5">
            <WatchStar k={contractKey(r)} make={() => watchContract(r, 'screener')} />
            <span className="text-[11px] text-textPrimary">{r.lastAt}</span>
          </span>
        ),
      },
      {
        key: 'ticker',
        header: 'Ticker',
        sortValue: r => r.ticker,
        render: r => (
          <span className="inline-flex items-center gap-1.5">
            <CompanyLogo ticker={r.ticker} size={15} />
            <span className="font-bold text-textPrimary">{r.ticker}</span>
          </span>
        ),
      },
      { key: 'contract', header: 'Contract', align: 'right', sortValue: r => r.strike, render: r => <ContractCell strike={r.strike} right={r.right} expiry={r.expiry} /> },
      { key: 'dte', header: 'DTE', align: 'right', sortValue: r => r.dte, render: r => <span className="text-textPrimary">{r.dte}d</span> },
      {
        key: 'otm',
        header: 'OTM %',
        align: 'right',
        sortValue: r => r.otmPct,
        render: r => (
          <span className="text-textPrimary">
            {r.otmPct >= 0 ? '+' : ''}
            {r.otmPct.toFixed(1)}%
          </span>
        ),
      },
      {
        key: 'last',
        header: 'Fill · Chg',
        align: 'right',
        sortValue: r => r.chgPct,
        render: r => (
          <span className="text-textPrimary">
            ${r.last.toFixed(2)}{' '}
            <span className={`text-[10px] ${r.chgPct >= 0 ? 'text-bull' : 'text-bear'}`}>
              {r.chgPct >= 0 ? '+' : ''}
              {r.chgPct.toFixed(1)}%
            </span>
          </span>
        ),
      },
      { key: 'vol', header: 'Vol', align: 'right', sortValue: r => r.volume, render: r => <span className={weightInk(r.volume, marks.vol)}>{num(r.volume)}</span> },
      { key: 'oi', header: 'OI', align: 'right', sortValue: r => r.oi, render: r => <span className={weightInk(r.oi, marks.oi)}>{num(r.oi)}</span> },
      {
        key: 'doi',
        header: 'ΔOI',
        align: 'right',
        sortValue: r => r.deltaOI,
        render: r => {
          if (r.deltaOI === 0) return <span className="text-textSecondary">—</span>;
          const a = Math.abs(r.deltaOI);
          const tone = a >= marks.doi.top ? 'text-supreme font-bold' : a >= marks.doi.bar ? (r.deltaOI > 0 ? 'text-bull' : 'text-bear') : 'text-textPrimary';
          return (
            <span className={tone}>
              {r.deltaOI > 0 ? '+' : ''}
              {num(r.deltaOI)}{' '}
              <span className="text-[10px] opacity-80">
                {r.deltaOIPct > 0 ? '+' : ''}
                {r.deltaOIPct.toFixed(0)}%
              </span>
            </span>
          );
        },
      },
      { key: 'prem', header: 'Prem', align: 'right', sortValue: r => r.premium, render: r => <span className={weightInk(r.premium, marks.prem)}>{fmtUsd(r.premium)}</span> },
      {
        key: 'iv',
        header: 'IV · Δ',
        align: 'right',
        sortValue: r => r.iv,
        render: r => (
          <span className="text-textPrimary">
            {r.iv.toFixed(0)}%{' '}
            <span className={`text-[10px] ${r.ivChg >= 0 ? 'text-bull' : 'text-bear'}`}>
              {r.ivChg >= 0 ? '+' : ''}
              {r.ivChg.toFixed(1)}
            </span>
          </span>
        ),
      },
      { key: 'voloi', header: 'Vol/OI', align: 'right', sortValue: r => r.volOverOI, render: r => <span className={r.volOverOI >= 1.5 ? 'font-bold text-textPrimary' : 'text-textPrimary'}>{r.volOverOI.toFixed(2)}</span> },
      { key: 'sweep', header: 'Sweep', align: 'right', sortValue: r => r.sweepPct, render: r => <span className={r.sweepPct >= 40 ? 'font-semibold text-textPrimary' : 'text-textPrimary'}>{r.sweepPct}%</span> },
      { key: 'floor', header: 'Floor', align: 'right', sortValue: r => r.floorPct, render: r => (r.floorPct === 0 ? <span className="text-textSecondary">—</span> : <span className={r.floorPct >= 50 ? 'text-textPrimary font-bold' : 'text-textPrimary'}>{r.floorPct}%</span>) },
      { key: 'multi', header: 'Multi', align: 'right', sortValue: r => r.multiPct, render: r => <span className={r.multiPct >= 30 ? 'font-semibold text-textPrimary' : 'text-textPrimary'}>{r.multiPct}%</span> },
      { key: 'lean', header: 'Lean', align: 'right', sortValue: r => r.askPct, render: r => <LeanCell askPct={r.askPct} /> },
      { key: 'sector', header: 'Sector', sortValue: r => r.sector ?? '', render: r => <SectorName sector={r.sector} /> },
    ],
    [marks]
  );

  const { hidden, toggle, showAll, hideAll } = useHiddenColumns('slayer_screener_cols');
  const chooserCols = useMemo(() => columns.map(c => ({ key: c.key, label: typeof c.header === 'string' ? c.header : c.key })), [columns]);
  const screenOptions = useMemo<DropdownOption<ScreenKey>[]>(() => FLOW_SCREENS.map(s => ({ value: s.key, label: s.label, hint: s.hint })), []);
  const tenorGroups = useMemo(() => [{ title: 'Tenor', options: SLEEVES.map(s => ({ value: s.key, label: s.label, hint: s.blurb })) }], []);

  return (
    <>
      <TraceBox
        title="The book"
        sub={`${activeScreen.label} — ${activeScreen.hint} · every contract that traded today · a row opens the contract's card`}
        testId="screener"
        data={{ screen, rows: rows.length, expiry: expiry ?? 'all' }}
        guide={{ title: 'How to read the book', door: 'What a row, the inks and the shares mean', body: <ScreenerGuide />, testId: 'screener-guide', open: guideOpen, onOpen: setGuideOpen }}
        facts={
          <>
            <Fact label="Premium" testId="premium">
              {fmtUsd(facts.prem)} <span className="text-textSecondary">·</span> <span className="text-bull">calls {facts.callPct}%</span> <span className="text-textSecondary">/</span> <span className="text-bear">puts {100 - facts.callPct}%</span>
            </Fact>
            <Fact label="Contracts" testId="contracts">
              {num(rows.length)} <span className="text-textSecondary">· {facts.names} names</span>
            </Fact>
            <Fact label="Built today" testId="fresh" title="Contracts trading past their open interest">
              {facts.fresh}
            </Fact>
            {champs.call && champs.call !== champs.all && (
              <Champion label="Top call" ink="bull" onOpen={() => setOpenKey(champs.call!.key)} testId="top-call">
                {pill(champs.call)}
              </Champion>
            )}
            {champs.put && champs.put !== champs.all && (
              <Champion label="Top put" ink="bear" onOpen={() => setOpenKey(champs.put!.key)} testId="top-put">
                {pill(champs.put)}
              </Champion>
            )}
            {champs.all && (
              <Champion label="Largest" ink="supreme" onOpen={() => setOpenKey(champs.all!.key)} testId="largest">
                {pill(champs.all)}
              </Champion>
            )}
          </>
        }
        controls={
          <>
            <LiveHold paused={hold.paused} onToggle={hold.toggle} heldAt={hold.heldAt} />
            <FlowSearch value={query} onChange={setQuery} rows={book} countNoun="contracts" />
            <DropdownSelect label="Screen" value={screen} options={screenOptions} onChange={setScreen} title="The question asked of the book" testId="screener-screen" />
            <DropdownSelect label="Side" value={filters.side} options={SIDE_OPTIONS} onChange={v => setFilters(f => ({ ...f, side: v }))} title="Calls, puts or both" testId="screener-side" />
            <DropdownMulti label="Tenor" values={filters.tenors} groups={tenorGroups} onChange={v => setFilters(f => ({ ...f, tenors: v as SleeveKey[] }))} title="How far out the contracts run" emptyWord="Any" align="start" testId="screener-tenor" />
            <DropdownSelect label="Volume" value={snap(filters.minVolume, VOLUME_STEPS)} options={VOLUME_OPTIONS} onChange={v => setFilters(f => ({ ...f, minVolume: v }))} title="The least volume a contract must carry" testId="screener-volume" />
            <DropdownSelect label="Premium" value={snap(filters.minPremium, PREMIUM_STEPS)} options={PREMIUM_OPTIONS} onChange={v => setFilters(f => ({ ...f, minPremium: v }))} title="The least money a contract must carry" testId="screener-premium" />
            <DropdownSelect label="Money" value={filters.excludeItm ? 'otm' : 'any'} options={MONEY_OPTIONS} onChange={v => setFilters(f => ({ ...f, excludeItm: v === 'otm' }))} title="Where the strikes sit against the stock" testId="screener-money" />
            <ExpiryCalendar value={chosen ? isoDate(chosen.date) : ''} expiries={expiries} onChange={e => setExpiry(isoDate(e.date))} onClear={() => setExpiry(null)} label="Expiry" icon={CalendarDays} steppers={false} title="Only contracts on one expiry — or every expiry" testId="screener-expiry" />
            {/* THE FILTER IS THE ADDRESS (data/savedViews): a tuned screen
                lives in the query string, so it can be sent, bookmarked,
                opened twice side by side, and saved by name. */}
            <SavedCutsControl
              store={screenerCuts}
              query={filtersToParams(filters, screen === 'active' ? undefined : screen, query || undefined).toString()}
              onOpen={q => setParams(new URLSearchParams(q), { replace: true })}
              noun="screen"
              testId="screener"
              onSay={cuts.say}
              open={cuts.open}
              onToggleOpen={cuts.toggle}
            />
            <div className="ml-auto">
              <ColumnChooser columns={chooserCols} hidden={hidden} onToggle={toggle} onAll={showAll} onNone={() => hideAll(columns.map(c => c.key))} />
            </div>
          </>
        }
        sentence={
          <>
            <SavedCutsList
              store={screenerCuts}
              query=""
              onOpen={q => setParams(new URLSearchParams(q), { replace: true })}
              noun="screen"
              testId="screener"
              onSay={cuts.say}
              open={cuts.open}
            />
            {cuts.said && (
              <p role="status" className="mb-2 font-mono text-[10px] text-textSecondary" data-screener-said>
                {cuts.said}
              </p>
            )}
            <RichRead text={sentence} />
          </>
        }
      >
        <TraceGrid rows={rows} columns={columns} hidden={hidden} widths={WIDTHS} tooltips={TOOLTIPS} rowKey={keyOf} onRowClick={openRow} selectedKey={openKey} autoHeight emptyText="Nothing matches this cut" emptyBody="Loosen a card — the screen, the side, the tenor, the volume or premium floor." testId="screener" />
      </TraceBox>
      <BookDrill list={rows} openKey={openKey} onOpen={setOpenKey} tick={tick} />
    </>
  );
};

export default OptionsScreener;
