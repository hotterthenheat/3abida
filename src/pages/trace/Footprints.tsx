/*
==================================================
  SLAYER TERMINAL - FOOTPRINTS (Trace)
  What the flow left standing (Noah, 2026-08-30 —
  expansion page 2, from the reference's open-
  interest explorer; renamed: footprints are the
  marks the prints leave behind).

  Volume is loud and gone by the close; open
  interest is what STAYED. This page ranks the
  overnight ledger — positions built, positions
  unwound, who built them (ask or bid side), and
  whether the build has legs (streaks). Same laws
  as the Screener: screens are questions, the one
  state engine only speaks inside the contract
  card, every column open.
==================================================
*/

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { CalendarDays } from 'lucide-react';
import { useMarketData } from '../../context/MarketDataContext';
import Simulator from '../../core/simulator';
import {
  buildFlowBook,
  FOOTPRINT_SCREENS,
  runFootprintScreen,
  type FootprintScreenKey,
} from '../../data/flowBook';
import { fmtUsd } from '../../data/gex';
import type { BookContract } from '../../types/trace';
import type { Column } from '../../components/ui/DataTable';
import CompanyLogo from '../../components/ui/CompanyLogo';
import DropdownSelect, { type DropdownOption } from '../../components/ui/DropdownSelect';
import WatchStar from '../../components/trace/WatchStar';
import { contractKey, watchContract } from '../../context/WatchContext';
import RichRead from '../../components/ui/RichRead';
import BookDrill from '../../components/trace/BookDrill';
import ContractCell from '../../components/trace/ContractCell';
import ReadDoor from '../../components/trace/ReadDoor';
import { earnMarks, weightInk, type InkMarks } from '../../components/trace/earnedInk';
import FlowSearch, { normSymbol } from '../../components/trace/FlowSearch';
import { LiveHold, useHold } from '../../components/trace/LiveHold';
import ColumnChooser, { useHiddenColumns } from '../../components/trace/ColumnChooser';
import LeanCell from '../../components/trace/LeanCell';
import TraceBox, { Champion, Fact, TraceGrid } from '../../components/trace/TraceBox';
import { FootprintsGuide } from '../../components/trace/TraceGuide';
import ExpiryCalendar from '../../components/ui/ExpiryCalendar';
import { useExpiryCut } from '../../components/trace/bookExpiry';
import { isoDate } from '../../core/calendar';

const num = (v: number) => v.toLocaleString('en-US');

/* THE CARDS (the walk, 2026-09-09): the filters popover's chips as labelled cards */
const SIDE_OPTIONS: DropdownOption<'ALL' | 'C' | 'P'>[] = [
  { value: 'ALL', label: 'Both', hint: 'Calls and puts' },
  { value: 'C', label: 'Calls', hint: 'Calls only' },
  { value: 'P', label: 'Puts', hint: 'Puts only' },
];
const WIDTHS: Record<string, number> = { ticker: 124, contract: 150, dte: 64, otm: 76, doi: 104, doipct: 96, builton: 104, streak: 76, spark: 76, earn: 84 , lean: 96 };
const TOOLTIPS: Record<string, string> = {
  oi: 'Open interest standing this morning',
  prevoi: 'Open interest standing yesterday morning',
  doi: 'What changed overnight — positions built or unwound',
  doipct: 'The change as a share of what stood before',
  builton: 'Which side did the building yesterday — at the ask, buyers; on the bid, sellers',
  streak: 'Sessions in a row the interest has grown',
  spark: "Yesterday's volume, quarter hour by quarter hour",
  earn: "The name's next report, if it sits inside the position's runway",
};

/* The quintile machinery moved to components/trace/earnedInk.ts (2026-08-30,
   when the whole flow family got the three-register pass) and gained the
   SUPREME tier there - one magenta champion per column. */
const dirInk = (v: number, m: InkMarks): string =>
  Math.abs(v) >= m.top ? 'text-supreme font-bold' : Math.abs(v) >= m.bar ? (v > 0 ? 'text-bull' : 'text-bear') : 'text-textPrimary';

/** The prior session's 15-min volume shape — a whisper, not a second fact. */
const PrevSpark = ({ values }: { values: number[] }) => (
  <svg width={52} height={14} aria-hidden className="block">
    {values.map((v, i) => {
      const h = Math.max(1, v * 13);
      return <rect key={i} x={i * 2} y={14 - h} width={1.4} height={h} fill="rgba(237,237,237,0.6)" />;
    })}
  </svg>
);

const Footprints = () => {
  const { marketData, activeTicker } = useMarketData();
  const [screen, setScreen] = useState<FootprintScreenKey>('builds');
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
  /* THE EXPIRY CUT (2026-09-12): the dates on the book, as a calendar */
  const { expiry, setExpiry, expiries, cut: cutExpiry, chosen } = useExpiryCut(heldBook, r => r.expiry);
  const book = useMemo(() => cutExpiry(heldBook), [heldBook, cutExpiry]);
  const keyOf = useCallback((r: { key: string }) => r.key, []);
  const openRow = useCallback((r: { key: string }) => setOpenKey(r.key), []);

  const rows = useMemo(() => {
    const cut = runFootprintScreen(book, screen);
    const sided = side === 'ALL' ? cut : cut.filter(r => r.right === side);
    const nq = normSymbol(query);
    return nq === '' ? sided : sided.filter(r => normSymbol(`${r.ticker}${r.strike}${r.right}`).includes(nq));
  }, [book, screen, side, query]);
  /* every row — the grid draws only what is on screen */
  const shown = rows;

  const loudestBuild = useMemo(
    () => [...book.filter(r => r.deltaOI > 0)].sort((a, b) => b.deltaOI - a.deltaOI)[0] ?? null,
    [book]
  );

  /* ReactNode: "The loudest:" is a door into the same card its table row
     opens — even when the current screen has it filtered out. */
  const read = useMemo<ReactNode>(() => {
    const builds = book.filter(r => r.deltaOI > 0);
    const unwinds = book.filter(r => r.deltaOI < 0);
    const added = builds.reduce((a, r) => a + r.deltaOI, 0);
    const removed = unwinds.reduce((a, r) => a + r.deltaOI, 0);
    if (builds.length === 0 && unwinds.length === 0) return <RichRead text="Nothing changed hands overnight." />;
    /* The Screener's grammar (Noah, 2026-08-30): what open interest did, in
       plain words — no "standing interest", no "builds and unwinds" puzzle. */
    const base = `Open interest grew by ${num(added)} contracts overnight — ${builds.length} contracts added interest, ${
      unwinds.length
    } shed ${num(Math.abs(removed))}.`;
    if (!loudestBuild) return <RichRead text={base} />;
    return (
      <>
        <RichRead text={`${base} Biggest build: `} />
        <ReadDoor onOpen={() => setOpenKey(loudestBuild.key)}>
          {loudestBuild.ticker} {loudestBuild.strike}
          {loudestBuild.right}
        </ReadDoor>
        <RichRead
          text={` [[+${num(loudestBuild.deltaOI)}]], ${loudestBuild.prevAskPct >= 50 ? 'bought at the ask' : 'sold on the bid'}.`}
        />
      </>
    );
  }, [book, loudestBuild]);

  const activeScreen = FOOTPRINT_SCREENS.find(s => s.key === screen) ?? FOOTPRINT_SCREENS[0];
  const screenOptions = useMemo<DropdownOption<FootprintScreenKey>[]>(() => FOOTPRINT_SCREENS.map(s => ({ value: s.key, label: s.label, hint: s.hint })), []);

  /*
    INK IS EARNED, COLUMN BY COLUMN (Noah, 2026-08-30: "shoudnt the green be
    reserved for cons that are above a certain amount of positive change
    because right now they all read the same color no matter how small or big
    ... matter of fact shoudnt the entire page be like that? look at prev vol.
    they are all white making nothing stand out").

    He is describing the house rule this page never got — the PressureMatrix
    quintile rule the screener's ΔOI already follows. Paint every positive
    number green and the colour says only "positive", which the + sign in front
    of it already said; paint every count white and the column has no shape at
    all. So each column now sets its OWN bar at the 80th percentile of what is
    actually on screen, and only the cells that clear it get any emphasis.

    WHICH emphasis depends on what the column means. ΔOI and ΔOI % are SIGNED,
    so they earn direction ink. Counts and dollars have no direction, so they
    earn WEIGHT — the 2026-08-30 ink law: intensity is bold white, never a hue
    that would imply a verdict the number is not making.

    Each column reads its own distribution: a contract can be huge in contracts
    and ordinary in percent (+39,040 is only +15%), and one bar for both would
    have let the absolute column quietly rank the percentage one.
  */
  const marks = useMemo(
    () => ({
      oi: earnMarks(shown, r => r.oi),
      prevOI: earnMarks(shown, r => r.prevOI),
      doi: earnMarks(shown, r => r.deltaOI),
      doiPct: earnMarks(shown, r => r.deltaOIPct),
      prevVol: earnMarks(shown, r => r.prevVolume),
      vol: earnMarks(shown, r => r.volume),
      prevAvg: earnMarks(shown, r => r.prevAvgFill),
      prevPrem: earnMarks(shown, r => r.prevPremium),
    }),
    [shown]
  );

  const columns = useMemo<Column<BookContract>[]>(
    () => [
      {
        key: 'ticker',
        header: 'Ticker',
        sortValue: r => r.ticker,
        // The star leads the row, the tape's own placement (see WatchStar).
        render: r => (
          <span className="inline-flex items-center gap-1.5">
            <WatchStar k={contractKey(r)} make={() => watchContract(r, 'footprints')} />
            <CompanyLogo ticker={r.ticker} size={15} />
            <span className="font-bold text-textPrimary">{r.ticker}</span>
          </span>
        ),
      },
      {
        key: 'contract',
        header: 'Contract',
        align: 'right',
        sortValue: r => r.strike,
        render: r => <ContractCell strike={r.strike} right={r.right} expiry={r.expiry} />,
      },
      {
        key: 'dte',
        header: 'DTE',
        align: 'right',
        sortValue: r => r.dte,
        render: r => <span className="text-textPrimary">{r.dte}d</span>,
      },
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
        key: 'oi',
        header: 'OI',
        align: 'right',
        sortValue: r => r.oi,
        render: r => <span className={weightInk(r.oi, marks.oi)}>{num(r.oi)}</span>,
      },
      {
        key: 'prevoi',
        header: 'Prev OI',
        align: 'right',
        sortValue: r => r.prevOI,
        render: r => <span className={weightInk(r.prevOI, marks.prevOI)}>{num(r.prevOI)}</span>,
      },
      {
        key: 'doi',
        header: 'ΔOI',
        align: 'right',
        sortValue: r => r.deltaOI,
        /* THIS page's lead fact, so it earns the strongest treatment there
           is — direction ink AND weight — but only above the bar. Below it the
           number still reads; it just stops shouting alongside a build forty
           times its size. */
        render: r => {
          if (r.deltaOI === 0) return <span className="text-textSecondary">—</span>;
          const a = Math.abs(r.deltaOI);
          const ink =
            a >= marks.doi.top
              ? 'text-supreme font-bold'
              : a >= marks.doi.bar
                ? `font-bold ${r.deltaOI > 0 ? 'text-bull' : 'text-bear'}`
                : 'text-textPrimary';
          return (
            <span className={ink}>
              {r.deltaOI > 0 ? '+' : ''}
              {num(r.deltaOI)}
            </span>
          );
        },
      },
      {
        key: 'doipct',
        header: 'ΔOI %',
        align: 'right',
        sortValue: r => r.deltaOIPct,
        // Ranked against the PERCENTAGES, not the contract counts — colour
        // only, so the absolute column stays the louder of the pair.
        render: r => {
          if (r.deltaOI === 0) return <span className="text-textSecondary">—</span>;
          return (
            <span className={dirInk(r.deltaOI > 0 ? Math.abs(r.deltaOIPct) : -Math.abs(r.deltaOIPct), marks.doiPct)}>
              {r.deltaOIPct > 0 ? '+' : ''}
              {num(Math.round(r.deltaOIPct))}%
            </span>
          );
        },
      },
      {
        key: 'builton',
        header: 'Built on',
        align: 'right',
        sortValue: r => r.prevAskPct,
        // Which side did the building — the tape's own bid/ask cell.
        render: r => <LeanCell askPct={r.prevAskPct} />,
      },
      {
        key: 'prevvol',
        header: 'Prev vol',
        align: 'right',
        sortValue: r => r.prevVolume,
        render: r => <span className={weightInk(r.prevVolume, marks.prevVol)}>{num(r.prevVolume)}</span>,
      },
      {
        key: 'vol',
        header: 'Vol today',
        align: 'right',
        sortValue: r => r.volume,
        render: r => <span className={weightInk(r.volume, marks.vol)}>{num(r.volume)}</span>,
      },
      {
        key: 'prevavg',
        header: 'Prev avg',
        align: 'right',
        sortValue: r => r.prevAvgFill,
        render: r => <span className={weightInk(r.prevAvgFill, marks.prevAvg)}>${r.prevAvgFill.toFixed(2)}</span>,
      },
      {
        key: 'prevprem',
        header: 'Prev $',
        align: 'right',
        sortValue: r => r.prevPremium,
        render: r => <span className={weightInk(r.prevPremium, marks.prevPrem)}>{fmtUsd(r.prevPremium)}</span>,
      },
      {
        key: 'streak',
        header: 'Streak',
        align: 'right',
        sortValue: r => r.oiStreak,
        // A build with legs — three sessions and up earns weight, not neon.
        render: r =>
          r.oiStreak === 0 ? (
            <span className="text-textSecondary">—</span>
          ) : (
            <span className={r.oiStreak >= 3 ? 'font-bold text-textPrimary' : 'text-textPrimary'}>{r.oiStreak}d</span>
          ),
      },
      {
        key: 'spark',
        header: 'Prev day',
        align: 'right',
        render: r => <PrevSpark values={r.prevSpark} />,
      },
      {
        key: 'earn',
        header: 'Earnings',
        align: 'right',
        sortValue: r => r.earnDays ?? 999,
        // A report inside the position's runway is a risk event — warn ink.
        render: r =>
          r.earnDays == null ? (
            <span className="text-textSecondary">—</span>
          ) : (
            <span className={r.earnDays <= 5 ? 'text-warn' : 'text-textPrimary'}>
              {r.earnDays === 0 ? 'today' : `in ${r.earnDays}d`}
            </span>
          ),
      },
    ],
    [marks]
  );

  /* THE TAPE'S HEAD, THIS PAGE'S RULES (Noah, 2026-08-30): the composition
     strip — facts left, champions as pills right — and the column chooser.
     The bull/bear pills only show when they are not the magenta one. */
  const champs = useMemo(() => {
    const builds = shown.filter(r => r.deltaOI > 0);
    const unwinds = shown.filter(r => r.deltaOI < 0);
    const build = builds.reduce<BookContract | null>((a, r) => (a === null || r.deltaOI > a.deltaOI ? r : a), null);
    const unwind = unwinds.reduce<BookContract | null>((a, r) => (a === null || r.deltaOI < a.deltaOI ? r : a), null);
    const fastest = builds.reduce<BookContract | null>((a, r) => (a === null || r.deltaOIPct > a.deltaOIPct ? r : a), null);
    return { build, unwind, fastest };
  }, [shown]);
  const facts = useMemo(() => {
    let added = 0;
    let shed = 0;
    let builds = 0;
    let unwinds = 0;
    for (const r of book) {
      if (r.deltaOI > 0) { added += r.deltaOI; builds++; }
      else if (r.deltaOI < 0) { shed -= r.deltaOI; unwinds++; }
    }
    return { added, shed, builds, unwinds };
  }, [book]);
  const pill = (r: BookContract, v: string) => `${r.ticker} ${r.strike}${r.right} · ${v}`;
  const { hidden, toggle, showAll, hideAll } = useHiddenColumns('slayer_footprints_cols');
  const chooserCols = useMemo(() => columns.map(c => ({ key: c.key, label: typeof c.header === 'string' ? c.header : c.key })), [columns]);

  return (
    <>
      <TraceBox
        title="What the flow left standing"
        sub={`${activeScreen.label} — ${activeScreen.hint} · open interest is what stayed overnight · a row opens the contract's card`}
        testId="footprints"
        data={{ screen, rows: rows.length, expiry: expiry ?? 'all' }}
        guide={{ title: 'How to read the footprints', door: 'What open interest, a build and a streak mean', body: <FootprintsGuide />, testId: 'footprints-guide', open: guideOpen, onOpen: setGuideOpen }}
        facts={
          <>
            <Fact label="Overnight" testId="overnight">
              <span className="text-bull">+{num(facts.added)}</span> <span className="text-textSecondary">added ·</span> <span className="text-bear">−{num(facts.shed)}</span> <span className="text-textSecondary">shed</span>
            </Fact>
            <Fact label="Contracts" testId="contracts">
              {facts.builds} <span className="text-textSecondary">built · {facts.unwinds} unwound</span>
            </Fact>
            {champs.build && champs.build !== champs.fastest && (
              <Champion label="Biggest build" ink="bull" onOpen={() => setOpenKey(champs.build!.key)} testId="build">
                {pill(champs.build, `+${num(champs.build.deltaOI)}`)}
              </Champion>
            )}
            {champs.unwind && (
              <Champion label="Biggest unwind" ink="bear" onOpen={() => setOpenKey(champs.unwind!.key)} testId="unwind">
                {pill(champs.unwind, num(champs.unwind.deltaOI))}
              </Champion>
            )}
            {champs.fastest && (
              <Champion label="Fastest build" ink="supreme" onOpen={() => setOpenKey(champs.fastest!.key)} testId="fastest">
                {pill(champs.fastest, `+${num(Math.round(champs.fastest.deltaOIPct))}%`)}
              </Champion>
            )}
          </>
        }
        controls={
          <>
            <LiveHold paused={hold.paused} onToggle={hold.toggle} heldAt={hold.heldAt} />
            <FlowSearch value={query} onChange={setQuery} rows={book} countNoun="contracts" />
            <DropdownSelect label="Cut" value={screen} options={screenOptions} onChange={setScreen} title="Which side of the overnight ledger" testId="footprints-cut" />
            <DropdownSelect label="Side" value={side} options={SIDE_OPTIONS} onChange={setSide} title="Calls, puts or both" testId="footprints-side" />
            <ExpiryCalendar value={chosen ? isoDate(chosen.date) : ''} expiries={expiries} onChange={e => setExpiry(isoDate(e.date))} onClear={() => setExpiry(null)} label="Expiry" icon={CalendarDays} steppers={false} title="Only contracts on one expiry — or every expiry" testId="footprints-expiry" />
            <div className="ml-auto">
              <ColumnChooser columns={chooserCols} hidden={hidden} onToggle={toggle} onAll={showAll} onNone={() => hideAll(columns.map(c => c.key))} />
            </div>
          </>
        }
        sentence={read}
      >
        <TraceGrid rows={shown} columns={columns} hidden={hidden} widths={WIDTHS} tooltips={TOOLTIPS} rowKey={keyOf} onRowClick={openRow} selectedKey={openKey} autoHeight emptyText="Nothing on this cut" emptyBody="No contract's open interest moved enough to show under these cards." testId="footprints" />
      </TraceBox>

      <BookDrill
        list={loudestBuild && !shown.some(r => r.key === loudestBuild.key) ? [loudestBuild, ...shown] : shown}
        openKey={openKey}
        onOpen={setOpenKey}
        tick={tick}
      />
    </>
  );
};

export default Footprints;
