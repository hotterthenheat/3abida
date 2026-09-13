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

  THE EXPIRY IS A CALENDAR (Noah, 2026-09-12: "Use
  this calendar in the expiry tab on the board
  because right now all we have is [four tenors]
  and I feel like its very incomplete"): the Trace
  calendar, listing every date the names on the
  sweep actually trade — dailies where the index
  complex lists them, Fridays and monthlies for
  the rest — and the engine prices every name at
  the date IT lists nearest the pick. The sleeve
  (0DTE / weekly / swing / LEAPS) is derived from
  the date and keeps steering which kinds run.

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
import { buildCompassView, buildImpact, setupIdOf, sleeveForDte } from '../../data/compass';
import { setCompassView, useCompassView, type BoardLayout } from '../../data/compassView';
import { SCANNERS, SLEEVE_BY_KEY, isScannerEligible, type ImpactRow, type ScannerKey, type Setup, type SleeveKey } from '../../types/compass';
import { expiryAt, isoDate, type Expiry } from '../../core/calendar';
import { listExpiriesFor, nearestListedExpiry } from '../../data/optionChain';
import { tickerName } from '../../data/tickers';
import { NAV_INK } from '../../components/layout/nav';
import TraceBox, { Champion, Fact } from '../../components/trace/TraceBox';
import ReadDoor from '../../components/trace/ReadDoor';
import RichRead from '../../components/ui/RichRead';
import DropdownSelect, { type DropdownOption } from '../../components/ui/DropdownSelect';
import DropdownSearch, { type SearchOption } from '../../components/ui/DropdownSearch';
import ExpiryCalendar from '../../components/ui/ExpiryCalendar';
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
const parseIso = (iso: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
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
  const { sleeve, expiry, scanner, layout, tickerFilter, selectedId } = useCompassView();
  const [guideOpen, setGuideOpen] = useState(false);

  // Deep links in: a setup from the Tracker, the Weigher, the tape's drilldown
  // or the Pulse tile lands on ITS PAGE; the wire's door lands here on one name.
  useEffect(() => {
    const state = location.state as {
      monitor?: { ticker: string; strike: number; right: 'C' | 'P'; scanner: ScannerKey; sleeve?: SleeveKey; dte?: number };
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
      const id = setupIdOf({ ticker: incoming.ticker, strike: incoming.strike, right: incoming.right, scanner: kind, sleeve: tenor, dte: incoming.dte });
      setCompassView({ chosenId: id, selectedId: id });
      navigate(`/compass/${id}`, { replace: true });
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

  /* THE DATES THE NAMES ON THIS SWEEP TRADE — the union of every name's own
     listing (data/optionChain listExpiriesFor), so the calendar offers a daily
     because SPY lists it and a monthly because everyone does, and never a date
     nobody trades. Re-read with the sweep (the list rolls at midnight). */
  const boardExpiries = useMemo<Expiry[]>(() => {
    const seen = new Map<string, Expiry>();
    const names = universe.length ? universe.map(q => q.ticker) : [activeTicker];
    for (const t of names) for (const e of listExpiriesFor(t)) if (!seen.has(e.label)) seen.set(e.label, e);
    return [...seen.values()].sort((a, b) => a.dte - b.dte);
  }, [universe, activeTicker]);

  /* THE EXPIRY ON THE BOARD: the picked date, or — before any pick — the date
     nearest the stored sleeve's tenor that the sweep lists (0DTE → today when
     today is a session). Its sleeve steers the kinds. */
  const activeExp = useMemo<Expiry>(() => {
    const picked = expiry ? parseIso(expiry) : null;
    const listed = picked ? boardExpiries.find(e => isoDate(e.date) === expiry) : undefined;
    if (listed) return listed;
    if (picked) return expiryAt(picked);
    const want = (SLEEVE_BY_KEY[sleeve] ?? SLEEVE_BY_KEY.weekly).dte;
    return boardExpiries.reduce((best, e) => (Math.abs(e.dte - want) < Math.abs(best.dte - want) ? e : best), boardExpiries[0] ?? expiryAt(new Date()));
  }, [expiry, sleeve, boardExpiries]);
  const effSleeve: SleeveKey = sleeveForDte(activeExp.dte);
  const boardDte = activeExp.dte;
  /* The stored sleeve follows the date, so the kinds card and the setup pages agree with the board */
  useEffect(() => {
    if (effSleeve !== sleeve) setCompassView({ sleeve: effSleeve, scanner: isScannerEligible(scanner, effSleeve) ? scanner : 'top-setups' });
  }, [effSleeve, sleeve, scanner]);

  // Scan tier: the groups, the counts, the rail — stable between sweeps
  const data = useMemo(() => (scanSnapshot ? buildCompassView(scanSnapshot, scanner, universe, effSleeve, boardDte) : null), [scanSnapshot, scanner, universe, effSleeve, boardDte]);

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
      if (s.key === 'all' || !isScannerEligible(s.key, effSleeve)) continue;
      const built = buildCompassView(scanSnapshot, s.key, universe, effSleeve, boardDte);
      const count = built.groups.reduce((acc, g) => acc + g.found, 0);
      counts[s.key] = count;
      allCount += count;
    }
    counts['all'] = allCount;
    return counts as Record<ScannerKey, number>;
  }, [scanSnapshot, universe, effSleeve, boardDte]);

  // The flat, globally-ranked board — rank is the organizing principle
  const rankedSetups = useMemo(() => filteredGroups.flatMap(g => g.setups).sort((a, b) => b.score - a.score), [filteredGroups]);

  /* Nothing selected → #1 is. The rail always follows a selection, so it
     never belongs to nothing; a sweep, filter or kind change that drops the
     selected card falls back to the first one visible. The fallback is NOT a
     choice — `chosenId` (the sidebar's gate) is set only by the reader's hand. */
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
  /* The rail's book prices at the date ITS name lists nearest the board's */
  const railDte = useMemo(() => (railTicker ? nearestListedExpiry(railTicker, boardDte).dte : boardDte), [railTicker, boardDte]);
  const railRows = useMemo(() => (railSnapshot ? buildImpact(railSnapshot, effSleeve, railDte) : []), [railSnapshot, effSleeve, railDte]);
  const railNote = selectedSetup ? `the #${rankedSetups.indexOf(selectedSetup) + 1} card, ${selectedSetup.contract}` : undefined;

  const activeScanner = SCANNERS.find(s => s.key === scanner)!;

  const handleScanner = (next: ScannerKey) => setCompassView({ scanner: next, selectedId: null, tickerFilter: null });
  /* A date from the calendar: the sleeve follows it, and a kind the new tenor
     doesn't sell falls back to the ranking — landing on a Quick scalp that
     LEAPS doesn't have would strand the board. */
  const handleExpiry = (e: Expiry) => {
    const next = sleeveForDte(e.dte);
    setCompassView({ expiry: isoDate(e.date), sleeve: next, scanner: isScannerEligible(scanner, next) ? scanner : 'top-setups', selectedId: null });
  };

  // The setup's page. The desk REPOINTS to the contract's underlying (a QQQ
  // setup over an SPY chain was the monitor pricing the wrong market); the
  // card stays selected underneath, so coming Back lands on it with the rail
  // on its name. Opening is a CHOICE — the sidebar's page appears with it.
  const openSetup = (setup: Setup) => {
    if (setup.ticker !== activeTicker) changeTicker(setup.ticker);
    setCompassView({ selectedId: setup.id, chosenId: setup.id });
    navigate(`/compass/${setup.id}`);
  };

  // One click selects (and CHOOSES — the reader picked a contract); a second click on the selected card opens it.
  const handleSelect = (setup: Setup) => {
    if (setup.id === selectedId) openSetup(setup);
    else setCompassView({ selectedId: setup.id, chosenId: setup.id });
  };

  // A contract from the rail opens its OWN page (Mo, 2026-08-19) — the same
  // door the cards use, pinned to that strike and side on the rail's name,
  // at the date the rail priced.
  const handleOpenContract = (row: ImpactRow) => {
    const ticker = railSnapshot?.ticker ?? activeTicker;
    if (ticker !== activeTicker) changeTicker(ticker);
    const id = setupIdOf({ ticker, strike: row.strike, right: row.right, scanner, sleeve: effSleeve, dte: railDte });
    setCompassView({ chosenId: id });
    navigate(`/compass/${id}`);
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

  /* THE CARDS: the expiry as a calendar, the kind with its count, the name, the layout */
  const kindOptions = useMemo<DropdownOption<ScannerKey>[]>(
    () => SCANNERS.filter(s => isScannerEligible(s.key, effSleeve)).map(s => ({ value: s.key, label: `${s.label} · ${scannerCounts[s.key] ?? 0}`, hint: s.blurb })),
    [effSleeve, scannerCounts]
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
    const day = dayOf(activeExp.date);
    if (activeExp.dte === 0) return "today's contracts";
    return `the ${day} contracts (${activeExp.sessions} ${activeExp.sessions === 1 ? 'session' : 'sessions'} out)`;
  }, [activeExp]);
  const horizonWords = activeExp.dte === 0 ? 'by the bell' : `by ${dayOf(activeExp.date)}`;

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
     sweep), so a kind or tenor change re-decides.
     WITH HYSTERESIS (2026-09-12, the jitter walk): a board that grew by one
     card across the threshold used to flip the rail between its two stances
     on the sweep that did it — a whole-column relayout the reader saw as the
     page shaking. It now takes a clear margin to change stance either way. */
  const [boxEl, setBoxEl] = useState<HTMLDivElement | null>(null);
  const [railSticks, setRailSticks] = useState(false);
  useEffect(() => {
    if (!boxEl) return;
    const ro = new ResizeObserver(() => {
      const h = boxEl.getBoundingClientRect().height;
      setRailSticks(prev => (prev ? h > window.innerHeight - 160 : h > window.innerHeight - 40));
    });
    ro.observe(boxEl);
    return () => ro.disconnect();
  }, [boxEl]);

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
            data={{ expiry: isoDate(activeExp.date), sleeve: effSleeve, kind: scanner, layout, rows: rankedSetups.length }}
            guide={{ title: 'How to read the board', door: 'What a card, its state and the rail mean', body: <CompassGuide />, testId: 'compass-guide', open: guideOpen, onOpen: setGuideOpen }}
            facts={
              <>
                <Fact label="Found" testId="found">
                  {rankedSetups.length}
                  {tickerFilter && <span className="text-textSecondary"> · of {data.totalFound}</span>}
                </Fact>
                <Fact label="Active" testId="active">
                  <span className={counts.active ? 'text-textPrimary' : 'text-textSecondary'}>{counts.active}</span>
                </Fact>
                <Fact label="Proving" testId="proving">
                  <span className={counts.watch ? 'text-textPrimary' : 'text-textSecondary'}>{counts.watch}</span>
                </Fact>
                <Fact label="Fading" testId="fading">
                  <span className={counts.fading ? 'text-textPrimary' : 'text-textSecondary'}>{counts.fading}</span>
                </Fact>
                {top && (
                  <Champion label="Top pick" ink="supreme" onOpen={() => openSetup(top)} testId="top-pick">
                    {top.contract} · ±{top.sigmaMovePct}%
                  </Champion>
                )}
                <Fact label="Found at" testId="found-at">
                  {lastScanAt || <span className="text-textSecondary">—</span>}
                </Fact>
              </>
            }
            controls={
              <>
                {/* THE EXPIRY IS THE TRACE CALENDAR (Noah, 2026-09-12): every date the
                    names on the sweep list, the chosen one priced across the board */}
                <ExpiryCalendar
                  value={isoDate(activeExp.date)}
                  expiries={boardExpiries}
                  onChange={handleExpiry}
                  label="Expiry"
                  icon={CalendarDays}
                  ink={CARD_INK.expiry}
                  title="The listed expiry the board prices — each name at the date it lists nearest"
                  testId="compass-expiry"
                />
                {/* Each card wears its own glyph, in its own ink on hover (Noah, 2026-09-11) */}
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
            /* Two lines are reserved for the sentence whatever it says (the jitter
               walk, 2026-09-12): a sweep that turned a one-line read into two used
               to grow the head and push the whole board down a line. */
            sentence={<span className="block min-h-[2.6em]">{sentence}</span>}
          >
            {/* The body fades on a kind or date change (the slow clock — a whole
                board arriving in 0.2s reads as a snap, Noah 2026-08-10); the head
                stays put. A sweep on the SAME kind and date never remounts it —
                the cards glide to their new ranks (SetupScanBoard). */}
            <div key={`feed-${scanner}-${isoDate(activeExp.date)}`} className="animate-soft-in-slow">
              <SetupScanBoard setups={rankedSetups} layout={layout} selectedId={selectedId} onSelect={handleSelect} onAnalysis={openSetup} expiryChip={activeExp.label} showKind={scanner === 'all'} />
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
