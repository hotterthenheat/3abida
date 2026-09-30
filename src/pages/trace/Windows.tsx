/*
==================================================
  SLAYER TERMINAL - WINDOWS (Trace)
  The day cut into quarter-hours (Noah, 2026-08-30
  — expansion page 4, from the reference's
  interval-flow table; renamed per the reason-not-
  rule law — "Interval" is their tab's word).

  The question this page answers: WHEN did a
  contract's day actually happen? Most dribble all
  session; a few BURST — the whole day in one
  window, somebody acting all at once. Share-of-day
  is the tell, and the navigator strip lets the
  reader walk the session window by window.
==================================================
*/

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { useMarketData } from '../../context/MarketDataContext';
import Simulator from '../../core/simulator';
import {
  buildFlowBook,
  buildIntervalSlices,
  intervalWindows,
  type IntervalSlice,
} from '../../data/flowBook';
import { fmtUsd } from '../../data/gex';
import type { BookContract } from '../../types/trace';
import type { Column } from '../../components/ui/DataTable';
import CompanyLogo from '../../components/ui/CompanyLogo';
import DropdownSelect, { type DropdownOption } from '../../components/ui/DropdownSelect';
import RichRead from '../../components/ui/RichRead';
import BookDrill from '../../components/trace/BookDrill';
import ContractCell from '../../components/trace/ContractCell';
import ReadDoor from '../../components/trace/ReadDoor';
import { earnMarks, weightInk } from '../../components/trace/earnedInk';
import FlowSearch, { normSymbol } from '../../components/trace/FlowSearch';
import { LiveHold, useHold } from '../../components/trace/LiveHold';
import ExpiryCalendar from '../../components/ui/ExpiryCalendar';
import { useExpiryCut } from '../../components/trace/bookExpiry';
import { isoDate } from '../../core/calendar';
import ColumnChooser, { useHiddenColumns } from '../../components/trace/ColumnChooser';
import DayStrip from '../../components/trace/DayStrip';
import TraceBox, { Champion, Fact, TraceGrid } from '../../components/trace/TraceBox';
import { WindowsGuide } from '../../components/trace/TraceGuide';
import WatchStar from '../../components/trace/WatchStar';
import { contractKey, watchContract } from '../../context/WatchContext';
import LeanCell from '../../components/trace/LeanCell';

const num = (v: number) => v.toLocaleString('en-US');

type CutKey = 'all' | 'bursts' | 'ask' | 'bid';

const CUTS: { key: CutKey; label: string; hint: string }[] = [
  { key: 'all', label: 'Everything', hint: 'Every contract that traded in this window, heaviest first' },
  { key: 'bursts', label: 'Bursts', hint: 'Half the contract’s whole day or more landed right here' },
  { key: 'ask', label: 'Lifted the ask', hint: 'Window flow that paid up — buyers' },
  { key: 'bid', label: 'Hit the bid', hint: 'Window flow that sold down — writers' },
];

/* THE CARDS (the walk, 2026-09-09) */
const CUT_OPTIONS: DropdownOption<CutKey>[] = CUTS.map(c => ({ value: c.key, label: c.label, hint: c.hint }));
const SIDE_OPTIONS: DropdownOption<'ALL' | 'C' | 'P'>[] = [
  { value: 'ALL', label: 'Both', hint: 'Calls and puts' },
  { value: 'C', label: 'Calls', hint: 'Calls only' },
  { value: 'P', label: 'Puts', hint: 'Puts only' },
];
const WIDTHS: Record<string, number> = { ticker: 124, contract: 150, dte: 64, otm: 76, wvol: 112, share: 120, lean: 96, daylean: 96, earn: 84 };
const TOOLTIPS: Record<string, string> = {
  wvol: "The contract's volume inside this quarter hour",
  share: 'How much of its whole day landed in this window — half or more is a burst',
  wprem: 'The money that printed in the window',
  lean: 'Whether the window paid the ask or hit the bid',
  daylean: "The same for the contract's whole day",
};

const Windows = () => {
  const { marketData, activeTicker } = useMarketData();
  const [winSel, setWinSel] = useState<number | 'latest'>('latest');
  const [cut, setCut] = useState<CutKey>('all');
  const [side, setSide] = useState<'ALL' | 'C' | 'P'>('ALL');
  const [query, setQuery] = useState('');
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);

  const liveBook = useMemo(
    () => buildFlowBook(Simulator.universeQuotes(activeTicker)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeTicker, marketData]
  );
  // The shared hold (see LiveHold): book and tick freeze together while paused.
  const hold = useHold(useMemo(() => ({ book: liveBook, tick: marketData }), [liveBook, marketData]), activeTicker);
  const { book: heldBook, tick } = hold.value;
  /* THE EXPIRY CUT (2026-09-12): the day's windows over the cut book */
  const { expiry, setExpiry, expiries, cut: cutExpiry, chosen } = useExpiryCut(heldBook, r => r.expiry);
  const book = useMemo(() => cutExpiry(heldBook), [heldBook, cutExpiry]);
  const keyOf = useCallback((s: { key: string }) => s.key, []);
  const openRow = useCallback((s: { row: { key: string } }) => setOpenKey(s.row.key), []);
  const windows = useMemo(() => intervalWindows(book), [book]);

  // "Latest" follows the newest COMPLETE window; the live one is a click away.
  const latestIdx = windows.length >= 2 ? windows[windows.length - 2].idx : windows[windows.length - 1]?.idx ?? 0;
  const winIdx = winSel === 'latest' ? latestIdx : Math.min(winSel, windows.length - 1);
  const win = windows[winIdx];

  const slices = useMemo(() => {
    const all = buildIntervalSlices(book, winIdx);
    const nq = normSymbol(query);
    return all.filter(s => {
      if (side !== 'ALL' && s.row.right !== side) return false;
      if (nq !== '' && !normSymbol(`${s.row.ticker}${s.row.strike}${s.row.right}`).includes(nq)) return false;
      if (cut === 'bursts') return s.shareOfDayPct >= 50;
      if (cut === 'ask') return s.askPct >= 58;
      if (cut === 'bid') return s.askPct <= 42;
      return true;
    });
  }, [book, winIdx, cut, side, query]);

  /* Three registers per column — components/trace/earnedInk.ts. Window facts
     and whole-day facts each measure their own crowd. */
  const marks = useMemo(
    () => ({
      wvol: earnMarks(slices, s => s.vol),
      wprem: earnMarks(slices, s => s.premium),
      dayVol: earnMarks(slices, s => s.row.volume),
      oi: earnMarks(slices, s => s.row.oi),
      dayPrem: earnMarks(slices, s => s.row.premium),
    }),
    [slices]
  );

  /* ReactNode: the loudest slice's contract is a door into its card. */
  const read = useMemo<ReactNode>(() => {
    if (!win || slices.length === 0)
      return <RichRead text={`Nothing traded between ${win ? win.label.replace('–', ' and ') : 'these minutes'} on this cut.`} />;
    const total = slices.reduce((a, s) => a + s.vol, 0);
    const names = new Set(slices.map(s => s.row.ticker)).size;
    const loud = slices[0];
    return (
      <>
        <RichRead
          text={`Between ${win.label.replace('–', ' and ')} the book traded ${num(total)} contracts across ${names} names. The loudest: `}
        />
        <ReadDoor onOpen={() => setOpenKey(loud.row.key)}>
          {loud.row.ticker} {loud.row.strike}
          {loud.row.right}
        </ReadDoor>
        <RichRead
          text={`, [[${num(loud.vol)}]] contracts — ${loud.shareOfDayPct.toFixed(0)}% of its whole day${
            win.live ? '. This window is still filling' : ''
          }.`}
        />
      </>
    );
  }, [slices, win]);

  const activeCut = CUTS.find(c => c.key === cut) ?? CUTS[0];

  const columns = useMemo<Column<IntervalSlice>[]>(
    () => [
      {
        key: 'ticker',
        header: 'Ticker',
        sortValue: s => s.row.ticker,
        // The star leads the row, the tape's own placement (see WatchStar).
        render: s => (
          <span className="inline-flex items-center gap-1.5">
            <WatchStar k={contractKey(s.row)} make={() => watchContract(s.row, 'windows')} />
            <CompanyLogo ticker={s.row.ticker} size={15} />
            <span className="font-bold text-textPrimary">{s.row.ticker}</span>
          </span>
        ),
      },
      {
        key: 'contract',
        header: 'Contract',
        align: 'right',
        sortValue: s => s.row.strike,
        render: s => <ContractCell strike={s.row.strike} right={s.row.right} expiry={s.row.expiry} />,
      },
      {
        key: 'dte',
        header: 'DTE',
        align: 'right',
        sortValue: s => s.row.dte,
        render: s => <span className="text-textPrimary">{s.row.dte}d</span>,
      },
      {
        key: 'otm',
        header: 'OTM %',
        align: 'right',
        sortValue: s => s.row.otmPct,
        render: s => (
          <span className="text-textPrimary">
            {s.row.otmPct >= 0 ? '+' : ''}
            {s.row.otmPct.toFixed(1)}%
          </span>
        ),
      },
      {
        key: 'wvol',
        header: 'This window',
        align: 'right',
        sortValue: s => s.vol,
        render: s => <span className={weightInk(s.vol, marks.wvol)}>{num(s.vol)}</span>,
      },
      {
        key: 'share',
        header: 'Share of day',
        align: 'right',
        sortValue: s => s.shareOfDayPct,
        // The burst tell — half a day in one window earns WEIGHT, not hue
        // (the lime retreat: data intensity is bold white, neon is not a fact).
        render: s => {
          const hot = s.shareOfDayPct >= 50;
          return (
            <span className="inline-flex items-center gap-1.5 justify-end">
              <span className="relative inline-block w-10 h-1 rounded-full bg-ink/[0.08] overflow-hidden align-middle">
                <span
                  className={`absolute left-0 top-0 h-full ${hot ? 'bg-ink/85' : 'bg-ink/40'}`}
                  style={{ width: `${Math.min(100, s.shareOfDayPct)}%` }}
                />
              </span>
              <span className={`tnum ${hot ? 'font-bold text-textPrimary' : 'text-textPrimary'}`}>
                {s.shareOfDayPct.toFixed(0)}%
              </span>
            </span>
          );
        },
      },
      {
        key: 'fill',
        header: 'Fill',
        align: 'right',
        sortValue: s => s.avgFill,
        render: s => <span className="text-textPrimary">${s.avgFill.toFixed(2)}</span>,
      },
      {
        key: 'wprem',
        header: 'Window $',
        align: 'right',
        sortValue: s => s.premium,
        render: s => <span className={weightInk(s.premium, marks.wprem)}>{fmtUsd(s.premium)}</span>,
      },
      {
        key: 'lean',
        header: 'Lean',
        align: 'right',
        sortValue: s => s.askPct,
        render: s => <LeanCell askPct={s.askPct} />,
      },
      {
        key: 'ivchg',
        header: 'IV Δ',
        align: 'right',
        sortValue: s => s.ivChg,
        // Signed change = direction ink, same as the screener's IV · Δ.
        render: s => (
          <span className={s.ivChg >= 0 ? 'text-bull' : 'text-bear'}>
            {s.ivChg >= 0 ? '+' : ''}
            {s.ivChg.toFixed(1)}
          </span>
        ),
      },
      {
        key: 'sweep',
        header: 'Sweep',
        align: 'right',
        sortValue: s => s.sweepPct,
        render: s => <span className={s.sweepPct >= 40 ? 'font-semibold text-textPrimary' : 'text-textPrimary'}>{s.sweepPct}%</span>,
      },
      {
        key: 'floor',
        header: 'Floor',
        align: 'right',
        sortValue: s => s.floorPct,
        // A floor cross is an institution's fingerprint — bright when it owns
        // the window.
        render: s =>
          s.floorPct === 0 ? (
            <span className="text-textSecondary">—</span>
          ) : (
            <span className={s.floorPct >= 50 ? 'text-textPrimary font-bold' : 'text-textPrimary'}>{s.floorPct}%</span>
          ),
      },
      {
        key: 'multi',
        header: 'Multi',
        align: 'right',
        sortValue: s => s.multiPct,
        render: s => <span className={s.multiPct >= 30 ? 'font-semibold text-textPrimary' : 'text-textPrimary'}>{s.multiPct}%</span>,
      },
      {
        key: 'voloi',
        header: 'Vol/OI',
        align: 'right',
        sortValue: s => s.volOverOI,
        render: s => (
          <span className={s.volOverOI >= 1.5 ? 'font-bold text-textPrimary' : 'text-textPrimary'}>
            {s.volOverOI.toFixed(2)}
          </span>
        ),
      },
      {
        key: 'dayvol',
        header: 'Day vol',
        align: 'right',
        sortValue: s => s.row.volume,
        render: s => <span className={weightInk(s.row.volume, marks.dayVol)}>{num(s.row.volume)}</span>,
      },
      {
        key: 'oi',
        header: 'OI',
        align: 'right',
        sortValue: s => s.row.oi,
        render: s => <span className={weightInk(s.row.oi, marks.oi)}>{num(s.row.oi)}</span>,
      },
      {
        key: 'daylean',
        header: 'Day lean',
        align: 'right',
        sortValue: s => s.row.askPct,
        render: s => <LeanCell askPct={s.row.askPct} />,
      },
      {
        key: 'prem',
        header: 'Day $',
        align: 'right',
        sortValue: s => s.row.premium,
        render: s => <span className={weightInk(s.row.premium, marks.dayPrem)}>{fmtUsd(s.row.premium)}</span>,
      },
      {
        key: 'earn',
        header: 'Earnings',
        align: 'right',
        sortValue: s => s.row.earnDays ?? 999,
        render: s =>
          s.row.earnDays == null ? (
            <span className="text-textSecondary">—</span>
          ) : (
            <span className={s.row.earnDays <= 5 ? 'text-warn' : 'text-textPrimary'}>
              {s.row.earnDays === 0 ? 'today' : `in ${s.row.earnDays}d`}
            </span>
          ),
      },
    ],
    []
  );

  /* THE TAPE'S HEAD, THIS PAGE'S RULES (Noah, 2026-08-30): the composition
     strip — facts left, champions as pills right — and the column chooser.
     The bull/bear pills only show when they are not the magenta one. */
  const champs = useMemo(() => {
    const by = (pick: (s: IntervalSlice) => boolean, key: (s: IntervalSlice) => number) =>
      slices.filter(pick).reduce<IntervalSlice | null>((a, x) => (a === null || key(x) > key(a) ? x : a), null);
    return {
      lifted: by(s => s.askPct >= 58, s => s.vol),
      hit: by(s => s.askPct <= 42, s => s.vol),
      burst: by(() => true, s => s.shareOfDayPct),
    };
  }, [slices]);
  const facts = useMemo(() => {
    const total = slices.reduce((a, s) => a + s.vol, 0);
    const prem = slices.reduce((a, s) => a + s.premium, 0);
    const names = new Set(slices.map(s => s.row.ticker)).size;
    return { total, prem, names };
  }, [slices]);
  const pill = (s: IntervalSlice, v: string) => (
    <>
      {s.row.ticker} {s.row.strike}
      {s.row.right} · {v}
    </>
  );
  const { hidden, toggle, showAll, hideAll } = useHiddenColumns('slayer_windows_cols');
  const chooserCols = useMemo(() => columns.map(c => ({ key: c.key, label: typeof c.header === 'string' ? c.header : c.key })), [columns]);
  const selectedKey = openKey ? (slices.find(s => s.row.key === openKey)?.key ?? null) : null;
  const stepBtn = 'inline-flex items-center justify-center w-7 h-7 rounded-md border border-borderSubtle bg-chip text-textSecondary hover:text-textPrimary hover:border-borderMuted transition-colors';

  return (
    <>
      {/* The session as an instrument — see components/trace/DayStrip. */}
      <DayStrip windows={windows} selectedIdx={winIdx} onSelect={setWinSel} paused={hold.paused} />

      <TraceBox
        title="A quarter hour of the day"
        sub={`${activeCut.label} — ${activeCut.hint} · a row opens the contract's card`}
        testId="windows"
        data={{ cut, window: win?.label, rows: slices.length, expiry: expiry ?? 'all' }}
        guide={{ title: 'How to read the windows', door: 'What a window, a burst and the share of the day mean', body: <WindowsGuide />, testId: 'windows-guide', open: guideOpen, onOpen: setGuideOpen }}
        facts={
          <>
            <Fact label="In the window" testId="window">
              {num(facts.total)} <span className="text-textSecondary">contracts ·</span> {fmtUsd(facts.prem)}
              {win?.live && (hold.paused ? <span className="ml-2 text-[9px] uppercase tracking-widest text-warn">held</span> : <span className="ml-2 text-[9px] uppercase tracking-widest text-select animate-live-breathe">still filling</span>)}
            </Fact>
            <Fact label="Names" testId="names">
              {facts.names}
            </Fact>
            {champs.lifted && champs.lifted !== champs.burst && (
              <Champion label="Lifted most" ink="bull" onOpen={() => setOpenKey(champs.lifted!.row.key)} testId="lifted">
                {pill(champs.lifted, num(champs.lifted.vol))}
              </Champion>
            )}
            {champs.hit && champs.hit !== champs.burst && (
              <Champion label="Hit most" ink="bear" onOpen={() => setOpenKey(champs.hit!.row.key)} testId="hit">
                {pill(champs.hit, num(champs.hit.vol))}
              </Champion>
            )}
            {champs.burst && (
              <Champion label="Burst" ink="supreme" onOpen={() => setOpenKey(champs.burst!.row.key)} testId="burst">
                {pill(champs.burst, `${champs.burst.shareOfDayPct.toFixed(0)}% of its day`)}
              </Champion>
            )}
          </>
        }
        controls={
          <>
            <LiveHold paused={hold.paused} onToggle={hold.toggle} heldAt={hold.heldAt} />
            {/* THE WINDOW: back, the label, forward, and Latest to follow the newest complete one */}
            <span className="inline-flex items-center gap-1.5" data-windows-nav>
              <button type="button" onClick={() => setWinSel(Math.max(0, winIdx - 1))} disabled={winIdx === 0} aria-label="Previous window" className={stepBtn}>
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="inline-flex items-center gap-2 h-7 px-2.5 rounded-md border border-borderSubtle bg-chip font-mono">
                <span className="text-[9px] uppercase tracking-widest text-textMuted">Window</span>
                <span className="text-[11px] font-semibold tnum text-textPrimary">{win?.label ?? '—'}</span>
                {win?.live && (hold.paused ? <span className="text-[9px] uppercase tracking-widest text-warn">held</span> : <span className="text-[9px] uppercase tracking-widest text-select animate-live-breathe">live</span>)}
              </span>
              <button type="button" onClick={() => setWinSel(Math.min(windows.length - 1, winIdx + 1))} disabled={winIdx >= windows.length - 1} aria-label="Next window" className={stepBtn}>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setWinSel('latest')}
                aria-pressed={winSel === 'latest'}
                title="Follow the newest complete window"
                className={`h-7 px-2.5 rounded-md border font-mono text-[9px] uppercase tracking-widest transition-colors ${winSel === 'latest' ? 'border-silver/50 bg-silver/[0.06] text-textPrimary' : 'border-borderSubtle bg-chip text-textSecondary hover:text-textPrimary hover:border-borderMuted'}`}
                data-windows-latest
              >
                Latest
              </button>
            </span>
            <FlowSearch value={query} onChange={setQuery} rows={book} countNoun="contracts" />
            <DropdownSelect label="Cut" value={cut} options={CUT_OPTIONS} onChange={setCut} title="Which of the window's flow" testId="windows-cut" />
            <DropdownSelect label="Side" value={side} options={SIDE_OPTIONS} onChange={setSide} title="Calls, puts or both" testId="windows-side" />
            <ExpiryCalendar value={chosen ? isoDate(chosen.date) : ''} expiries={expiries} onChange={e => setExpiry(isoDate(e.date))} onClear={() => setExpiry(null)} label="Expiry" icon={CalendarDays} steppers={false} title="Only contracts on one expiry — or every expiry" testId="windows-expiry" />
            <div className="ml-auto">
              <ColumnChooser columns={chooserCols} hidden={hidden} onToggle={toggle} onAll={showAll} onNone={() => hideAll(columns.map(c => c.key))} />
            </div>
          </>
        }
        sentence={read}
      >
        <TraceGrid rows={slices} columns={columns} hidden={hidden} widths={WIDTHS} tooltips={TOOLTIPS} rowKey={keyOf} onRowClick={openRow} selectedKey={selectedKey} autoHeight emptyText="Nothing in this window" emptyBody="No contract traded inside it on this cut — try a wider window or a looser card." testId="windows" />
      </TraceBox>

      <BookDrill list={slices.map(s => s.row)} openKey={openKey} onOpen={setOpenKey} tick={tick} />
    </>
  );
};

export default Windows;
