/*
==================================================
  SLAYER TERMINAL - THE COMPASS BOARD (pages/compass/Board.tsx)

  The setups the sweep found, graded and ranked.
  WALKED into the house grammar (2026-09-11, the
  walk after Trace and the Record): under the
  shell head (CompassLayout), ONE box — the head
  with its facts and the top pick among them, one
  line of cards (Expiry · Kind · Name · Layout),
  the sentence, and the board growing with what
  the sweep found (the cards two across, or the
  grid) — with the heaviest contracts on the
  selected name in a rail beside it that sticks
  while the page scrolls (Noah, 2026-09-11). The
  four tenor boxes, the six scanner pills, the
  hand-rolled filter menu and the pager are gone;
  Expiry and Kind are cards on the line, changed
  in place, never pages in the sidebar (Noah:
  "they require immediate ability to change").

  A setup's page has a ROUTE of its own since the
  walk (/compass/<id>, pages/compass/SetupPage.tsx)
  — the board keeps its view in data/compassView
  across the trip and back.

  THE ENGINE IS UNTOUCHED: buildCompassView takes
  the snapshot, the kind, the universe and the
  tenor as arguments and never reads the simulator
  — the backtest harness runs the same call
  (docs/compass-backtest-spec.md). This file only
  decides what the reader sees.
==================================================
*/

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CalendarDays, LayoutGrid, Search, Shapes, Table } from 'lucide-react';
import { useMarketData } from '../../context/MarketDataContext';
import type { MarketSnapshot } from '../../types/market';
import Simulator from '../../core/simulator';
import { useSeeded } from '../../components/gex/useSeeded';
import { buildCompassView, buildImpact, setupIdOf } from '../../data/compass';
import { setCompassView, useCompassView, type BoardLayout } from '../../data/compassView';
import { SCANNERS, SLEEVES, isScannerEligible, type ImpactRow, type ScannerKey, type Setup, type SleeveKey } from '../../types/compass';
import { expiryFor } from '../../core/calendar';
import { tickerName } from '../../data/tickers';
import { NAV_INK } from '../../components/layout/nav';
import TraceBox, { Champion, Fact } from '../../components/trace/TraceBox';
import ReadDoor from '../../components/trace/ReadDoor';
import RichRead from '../../components/ui/RichRead';
import DropdownSelect, { type DropdownOption } from '../../components/ui/DropdownSelect';
import DropdownSearch, { type SearchOption } from '../../components/ui/DropdownSearch';
import BackToTop from '../../components/ui/BackToTop';
import ImpactLeaderboard from '../../components/compass/ImpactLeaderboard';
import SetupScanBoard from '../../components/compass/SetupScanBoard';
import { CompassGuide } from '../../components/compass/CompassGuide';
import { processState } from '../../components/compass/setupProcess';

/** The scanner sweeps on its own cadence — the feed must not vibrate with every price tick. */
const SCAN_INTERVAL_MS = 10_000;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "Sep 16", or "Sep 10 '27" once the year turns */
const dayOf = (d: Date) => {
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return `${MONTHS[d.getMonth()]} ${d.getDate()}${sameYear ? '' : ` '${String(d.getFullYear()).slice(2)}`}`;
};

const LAYOUT_OPTIONS: DropdownOption<BoardLayout>[] = [
  { value: 'cards', label: 'Cards', hint: "Two across, the stock's line on each" },
  { value: 'table', label: 'Table', hint: 'One row per setup, sortable' },
];

/* Each card's glyph wears its own ink on hover and while open — the sidebar's
   rule (Noah, 2026-09-11: "turn a colour like we have on our sidebar") */
const CARD_INK = { expiry: NAV_INK.record, kind: NAV_INK.weigher, name: NAV_INK.compass, layout: NAV_INK.terrain } as const;

const Board = () => {
  const { activeTicker, marketData, changeTicker } = useMarketData();
  const location = useLocation();
  const navigate = useNavigate();
  const { sleeve, scanner, layout, tickerFilter, selectedId } = useCompassView();
  const [guideOpen, setGuideOpen] = useState(false);

  // Deep links in: a setup from the Tracker, the Weigher, the tape's drilldown
  // or the Pulse tile lands on ITS PAGE; the wire's door lands here on one name.
  useEffect(() => {
    const state = location.state as {
      monitor?: { ticker: string; strike: number; right: 'C' | 'P'; scanner: ScannerKey; sleeve?: SleeveKey };
      tickerFilter?: string;
    } | null;
    if (state?.tickerFilter && !state.monitor) {
      setCompassView({ tickerFilter: state.tickerFilter });
      window.history.replaceState({}, '');
      return;
    }
    if (state?.monitor) {
      const incoming = state.monitor;
      // Legacy deep links can carry pre-sleeve scanner keys ('weeklies',
      // 'swings') — those were tenors, so they land on the matching sleeve.
      const known = SCANNERS.some(s => s.key === incoming.scanner);
      const kind: ScannerKey = known ? incoming.scanner : 'top-setups';
      const tenor: SleeveKey = incoming.sleeve ?? (!known ? ((incoming.scanner as string) === 'swings' ? 'swing' : 'weekly') : sleeve);
      navigate(`/compass/${setupIdOf({ ticker: incoming.ticker, strike: incoming.strike, right: incoming.right, scanner: kind, sleeve: tenor })}`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- two-tier cadence -----------------------------------------------------
  // Scan tier (every SCAN_INTERVAL_MS): the board, the counts, the rail.
  const [scanSnapshot, setScanSnapshot] = useState<MarketSnapshot | null>(null);
  const [lastScanAt, setLastScanAt] = useState<string>('');
  const scanRef = useRef<MarketSnapshot | null>(null);
  const lastScanTimeRef = useRef(0);

  useEffect(() => {
    if (!marketData) return;
    const now = Date.now();
    const due =
      !scanRef.current ||
      now - lastScanTimeRef.current >= SCAN_INTERVAL_MS ||
      scanRef.current.ticker !== marketData.ticker; // ticker switch refreshes immediately
    if (due) {
      scanRef.current = marketData;
      lastScanTimeRef.current = now;
      setScanSnapshot(marketData);
      setLastScanAt(new Date(now).toLocaleTimeString('en-GB'));
    }
  }, [marketData]);

  // The live harness's market state for the whole board — the engine takes it
  // as an argument (never reads the simulator itself), so replay and live run
  // identical code. Scan-tier cadence: quotes refresh with the sweep.
  const universe = useMemo(() => (scanSnapshot ? Simulator.universeQuotes(scanSnapshot.ticker) : []), [scanSnapshot]);

  // Scan tier: the groups, the counts, the rail — stable between sweeps
  const data = useMemo(() => (scanSnapshot ? buildCompassView(scanSnapshot, scanner, universe, sleeve) : null), [scanSnapshot, scanner, universe, sleeve]);

  // The groups under the Name card
  const filteredGroups = useMemo(() => {
    if (!data) return [];
    if (!tickerFilter) return data.groups;
    return data.groups.filter(g => g.ticker === tickerFilter);
  }, [data, tickerFilter]);

  // Counts per kind on this tenor (scan tier — stable between sweeps): only
  // the kinds this tenor sells, and All sums exactly those.
  const scannerCounts = useMemo(() => {
    if (!scanSnapshot) return {} as Record<ScannerKey, number>;
    const counts: Record<string, number> = {};
    let allCount = 0;
    for (const s of SCANNERS) {
      if (s.key === 'all' || !isScannerEligible(s.key, sleeve)) continue;
      const built = buildCompassView(scanSnapshot, s.key, universe, sleeve);
      const count = built.groups.reduce((acc, g) => acc + g.found, 0);
      counts[s.key] = count;
      allCount += count;
    }
    counts['all'] = allCount;
    return counts as Record<ScannerKey, number>;
  }, [scanSnapshot, universe, sleeve]);

  // Real expiry per tenor, through the clock-aware calendar — recomputed with
  // each sweep so a session rollover moves the card.
  const sleeveDates = useMemo(() => {
    void scanSnapshot; // sweep dependency — the calendar reads the engine clock
    return Object.fromEntries(SLEEVES.map(s => [s.key, expiryFor(s.dte)])) as Record<SleeveKey, ReturnType<typeof expiryFor>>;
  }, [scanSnapshot]);

  // The flat, globally-ranked board — rank is the organizing principle
  const rankedSetups = useMemo(() => filteredGroups.flatMap(g => g.setups).sort((a, b) => b.score - a.score), [filteredGroups]);

  /* Nothing selected → #1 is. The rail always follows a selection, so it
     never belongs to nothing; a sweep, filter or kind change that drops the
     selected card falls back to the first one visible. */
  useEffect(() => {
    if (!rankedSetups.length) return;
    if (!selectedId || !rankedSetups.some(s => s.id === selectedId)) setCompassView({ selectedId: rankedSetups[0].id });
  }, [rankedSetups, selectedId]);
  const selectedSetup = useMemo(() => rankedSetups.find(s => s.id === selectedId) ?? rankedSetups[0] ?? null, [rankedSetups, selectedId]);

  /* The rail's name (Noah, 2026-08-19): the SELECTED card's. Scan-tier
     cadence — the read lands on the same sweep as the board it sits beside.
     An unseeded roster name walks its history in idle time (the perf sweep). */
  const railTicker = selectedSetup?.ticker ?? scanSnapshot?.ticker ?? null;
  const railReady = useSeeded(railTicker && scanSnapshot && railTicker !== scanSnapshot.ticker ? railTicker : null);
  const railSnapshot = useMemo(() => {
    if (!scanSnapshot || !railTicker) return null;
    if (railTicker === scanSnapshot.ticker) return scanSnapshot;
    if (!railReady) return null;
    try {
      return Simulator.snapshotFor(railTicker);
    } catch {
      return scanSnapshot;
    }
  }, [scanSnapshot, railTicker, railReady]);
  const railRows = useMemo(() => (railSnapshot ? buildImpact(railSnapshot, sleeve) : []), [railSnapshot, sleeve]);
  const railNote = selectedSetup ? `the #${rankedSetups.indexOf(selectedSetup) + 1} card, ${selectedSetup.contract}` : undefined;

  const activeScanner = SCANNERS.find(s => s.key === scanner)!;
  const activeSleeveExp = sleeveDates[sleeve];

  const handleScanner = (next: ScannerKey) => setCompassView({ scanner: next, selectedId: null, tickerFilter: null });
  const handleSleeve = (next: SleeveKey) => {
    // A kind the new tenor doesn't sell falls back to the ranking — landing
    // on a Quick scalp that LEAPS doesn't have would strand the board.
    setCompassView({ sleeve: next, scanner: isScannerEligible(scanner, next) ? scanner : 'top-setups', selectedId: null });
  };

  // The setup's page. The desk REPOINTS to the contract's underlying (a QQQ
  // setup over an SPY chain was the monitor pricing the wrong market); the
  // card stays selected underneath, so coming Back lands on it with the rail
  // on its name.
  const openSetup = (setup: Setup) => {
    if (setup.ticker !== activeTicker) changeTicker(setup.ticker);
    setCompassView({ selectedId: setup.id });
    navigate(`/compass/${setup.id}`);
  };

  // One click selects; a second click on the selected card opens it.
  const handleSelect = (setup: Setup) => {
    if (setup.id === selectedId) openSetup(setup);
    else setCompassView({ selectedId: setup.id });
  };

  // A contract from the rail opens its OWN page (Mo, 2026-08-19) — the same
  // door the cards use, pinned to that strike and side on the rail's name.
  const handleOpenContract = (row: ImpactRow) => {
    const ticker = railSnapshot?.ticker ?? activeTicker;
    if (ticker !== activeTicker) changeTicker(ticker);
    navigate(`/compass/${setupIdOf({ ticker, strike: row.strike, right: row.right, scanner, sleeve })}`);
  };

  /* ---- the head's facts and the sentence ------------------------------------------ */

  const counts = useMemo(() => {
    let active = 0;
    let watch = 0;
    let fading = 0;
    for (const s of rankedSetups) {
      const st = processState(s);
      if (st === 'ACTIVE' || st === 'MOVING') active++;
      else if (st === 'WATCH') watch++;
      else fading++;
    }
    return { active, watch, fading };
  }, [rankedSetups]);
  const top = rankedSetups[0] ?? null;
  const byName = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of rankedSetups) m.set(s.ticker, (m.get(s.ticker) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [rankedSetups]);

  /* THE CARDS: the tenor as a date (the Map's spelling), the kind with its count, the name, the layout */
  const expiryOptions = useMemo<DropdownOption<SleeveKey>[]>(
    () =>
      SLEEVES.map(sl => {
        const exp = sleeveDates[sl.key];
        return {
          value: sl.key,
          label: `${sl.label} · ${dayOf(exp.date)}`,
          hint: exp.dte === 0 ? sl.blurb : `${sl.blurb} · ${exp.sessions} sessions`,
        };
      }),
    [sleeveDates]
  );
  const kindOptions = useMemo<DropdownOption<ScannerKey>[]>(
    () => SCANNERS.filter(s => isScannerEligible(s.key, sleeve)).map(s => ({ value: s.key, label: `${s.label} · ${scannerCounts[s.key] ?? 0}`, hint: s.blurb })),
    [sleeve, scannerCounts]
  );
  /* The Name card searches (Noah, 2026-09-11: "not a scroll down until you
     see the stock your looking for") — the ticker and the company both match */
  const nameOptions = useMemo<SearchOption<string>[]>(
    () => [
      { value: 'ALL', label: 'All names', hint: `${data?.groups.length ?? 0} names on this sweep` },
      ...(data?.groups ?? []).map(g => ({
        value: g.ticker,
        label: g.ticker,
        logo: g.ticker,
        keywords: tickerName(g.ticker),
        hint: `${tickerName(g.ticker)} · ${g.found} ${g.found === 1 ? 'setup' : 'setups'}`,
      })),
    ],
    [data]
  );

  const expiryWords = useMemo(() => {
    const day = dayOf(activeSleeveExp.date);
    if (sleeve === 'odte') return activeSleeveExp.dte === 0 ? "today's contracts" : `the ${day} contracts`;
    if (sleeve === 'weekly') return `this week's contracts (${day})`;
    if (sleeve === 'swing') return `the ${day} contracts`;
    return `the ${day} contracts, a year out`;
  }, [sleeve, activeSleeveExp]);
  const horizonWords = sleeve === 'odte' ? 'by the bell' : sleeve === 'leaps' ? 'over the year' : `by ${dayOf(activeSleeveExp.date)}`;

  const sentence = useMemo<ReactNode>(() => {
    if (!rankedSetups.length || !top) {
      return <RichRead text={`Nothing cleared the bar on ${expiryWords} this sweep — an empty board is a read, not an error.`} />;
    }
    /* One line at the desk's width: only the states that are there, the busiest name, the top pick as a door */
    const busiest = byName[0];
    const states = [
      counts.active ? `${counts.active} active` : '',
      counts.watch ? (counts.watch === 1 ? '1 still proving itself' : `${counts.watch} still proving themselves`) : '',
      counts.fading ? `${counts.fading} fading` : '',
    ].filter(Boolean);
    const names = byName.length === 1 ? `all on ${busiest[0]}` : `${busiest[0]} carries the most, ${busiest[1]} of ${byName.length} names`;
    const lead = `${rankedSetups.length} ${rankedSetups.length === 1 ? 'setup' : 'setups'} cleared the bar on ${expiryWords} at ${lastScanAt} — ${states.join(', ')} · ${names}. Top pick `;
    return (
      <>
        <RichRead text={lead} />
        <ReadDoor onOpen={() => openSetup(top)} title="Open the setup's page">
          {top.contract}
        </ReadDoor>
        <RichRead text={`, ±${top.sigmaMovePct}% ${horizonWords}.`} />
      </>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rankedSetups, top, byName, counts, expiryWords, horizonWords, lastScanAt]);

  /* THE RAIL'S TWO STANCES: a board shorter than the screen → the rail adopts
     the box's height and both end on one line; a board taller than the screen
     → the rail STICKS a screen tall while the page scrolls (Noah, 2026-09-11).
     Measured off the box with a callback ref (the box mounts after the first
     sweep), so a kind or tenor change re-decides. */
  const [boxEl, setBoxEl] = useState<HTMLDivElement | null>(null);
  const [boxH, setBoxH] = useState(0);
  useEffect(() => {
    if (!boxEl) return;
    const ro = new ResizeObserver(() => setBoxH(boxEl.getBoundingClientRect().height));
    ro.observe(boxEl);
    return () => ro.disconnect();
  }, [boxEl]);
  const railSticks = boxH > window.innerHeight - 40;

  if (!data || !marketData) {
    return (
      <div className="h-64 border border-borderSubtle rounded-md bg-panel flex items-center justify-center">
        <span className="font-mono text-[10px] uppercase tracking-widest text-textMuted">Waiting for the feed…</span>
      </div>
    );
  }

  const rail = <ImpactLeaderboard ticker={railSnapshot?.ticker ?? data.chain.ticker} note={railNote} rows={railRows} onOpen={handleOpenContract} />;

  return (
    <>
      {/* THE BOARD and its rail (Noah, 2026-08-17: "a side section next to the setups", clearly narrower) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch" data-compass-row data-rail={railSticks ? 'sticks' : 'adopts'}>
        <div ref={setBoxEl} className="xl:col-span-8 min-w-0">
          <TraceBox
            title="The board"
            sub={`${activeScanner.blurb} · a card selects, a second click opens its page`}
            testId="compass"
            data={{ expiry: sleeve, kind: scanner, layout, rows: rankedSetups.length }}
            guide={{ title: 'How to read the board', door: 'What a card, its state and the rail mean', body: <CompassGuide />, testId: 'compass-guide', open: guideOpen, onOpen: setGuideOpen }}
            facts={
              <>
                <Fact label="Found" testId="found">
                  {rankedSetups.length}
                  {tickerFilter && <span className="text-textMuted"> · of {data.totalFound}</span>}
                </Fact>
                <Fact label="Active" testId="active">
                  <span className={counts.active ? 'text-textPrimary' : 'text-textMuted'}>{counts.active}</span>
                </Fact>
                <Fact label="Proving" testId="proving">
                  <span className={counts.watch ? 'text-textPrimary' : 'text-textMuted'}>{counts.watch}</span>
                </Fact>
                <Fact label="Fading" testId="fading">
                  <span className={counts.fading ? 'text-textPrimary' : 'text-textMuted'}>{counts.fading}</span>
                </Fact>
                {top && (
                  <Champion label="Top pick" ink="supreme" onOpen={() => openSetup(top)} testId="top-pick">
                    {top.contract} · ±{top.sigmaMovePct}%
                  </Champion>
                )}
                <Fact label="Found at" testId="found-at">
                  {lastScanAt || <span className="text-textMuted">—</span>}
                </Fact>
              </>
            }
            controls={
              <>
                {/* Each card wears its own glyph, in its own ink on hover (Noah, 2026-09-11) */}
                <DropdownSelect label="Expiry" value={sleeve} options={expiryOptions} onChange={handleSleeve} title="How long the trade lives" icon={CalendarDays} ink={CARD_INK.expiry} testId="compass-expiry" />
                <DropdownSelect label="Kind" value={scanner} options={kindOptions} onChange={handleScanner} title="What found the setup" icon={Shapes} ink={CARD_INK.kind} testId="compass-kind" />
                <DropdownSearch
                  label="Name"
                  value={tickerFilter ?? 'ALL'}
                  options={nameOptions}
                  onChange={v => setCompassView({ tickerFilter: v === 'ALL' ? null : v })}
                  title="One name, or every name"
                  placeholder="Search a name…"
                  icon={Search}
                  ink={CARD_INK.name}
                  testId="compass-name"
                />
                <DropdownSelect label="Layout" value={layout} options={LAYOUT_OPTIONS} onChange={v => setCompassView({ layout: v })} title="Cards, or a table" icon={layout === 'cards' ? LayoutGrid : Table} ink={CARD_INK.layout} testId="compass-layout" />
              </>
            }
            sentence={sentence}
          >
            {/* The body fades on a kind or tenor change (the slow clock — a whole
                board arriving in 0.2s reads as a snap, Noah 2026-08-10); the head stays put */}
            <div key={`feed-${scanner}-${sleeve}`} className="animate-soft-in-slow">
              <SetupScanBoard setups={rankedSetups} layout={layout} selectedId={selectedId} onSelect={handleSelect} onAnalysis={openSetup} expiryChip={activeSleeveExp.label} showKind={scanner === 'all'} />
            </div>
          </TraceBox>
        </div>

        {/* The rail sits OUTSIDE the board's keyed swap on purpose — it holds
            still while the board fades through kind switches. */}
        {railSticks ? (
          <div className="xl:col-span-4 min-w-0 flex flex-col xl:sticky xl:top-5 xl:self-start xl:h-[calc(100vh-40px)]" data-compass-rail-col="sticks">
            {rail}
          </div>
        ) : (
          <div className="xl:col-span-4 min-w-0 flex flex-col" data-compass-rail-col="adopts">
            <div className="flex-1 flex flex-col xl:relative">
              <div className="xl:absolute xl:inset-0 flex flex-col min-h-0">{rail}</div>
            </div>
          </div>
        )}
      </div>
      {/* The page's door home once the board runs past a screen (Trace's, lifted to the page) */}
      <BackToTop testId="compass" />
    </>
  );
};

export default Board;
