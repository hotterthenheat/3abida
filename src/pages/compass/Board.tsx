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

  THE FILTERS (the owner, 2026-10-11 — docs/compass-
  setups-2026-10-11.md): Expiry is a category (0DTE,
  Weekly, Swing, Position, Long-Dated) or a date on
  the house calendar; Kind is two sections, Main and
  Advanced; Option type is the structure a card is;
  Name as before. All three live in the address, so a
  link keeps them. The board sweeps every lens on
  every tenor and files each setup through the
  stand-in mapping (data/compassStandIn.ts); the
  0DTE rule is data/expiryClass.ts's.
==================================================
*/

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CalendarDays, Layers, LayoutGrid, Search, Shapes, Table } from 'lucide-react';
import { changeTicker, useActiveTicker, useScanSnapshot } from '../../context/MarketDataContext';
import Simulator from '../../core/simulator';
import { useSeeded } from '../../components/gex/useSeeded';
import { buildCompassView, buildImpact, setupIdOf } from '../../data/compass';
import { setCompassView, useCompassView, type BoardLayout } from '../../data/compassView';
import {
  EXPIRY_CATS,
  EXPIRY_CAT_BY_KEY,
  KINDS,
  KIND_BY_KEY,
  SCANNERS,
  SLEEVES,
  STRATEGIES,
  STRATEGIES_LATER,
  STRATEGY_BY_KEY,
  STRUCTURE_TYPE,
  type ExpiryCat,
  type ImpactRow,
  type KindKey,
  type ScannerKey,
  type Setup,
  type SleeveKey,
  type StrategyKey,
} from '../../types/compass';
import { expiryAt, isoDate, type Expiry } from '../../core/calendar';
import { expiryLabel } from '../../core/format';
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
import { noteFound } from '../../components/compass/campaignStore';
import { boardDay, filePool, listingsFor, type FiledSetup } from '../../data/compassStandIn';
import { structureName } from '../../components/compass/SetupFiling';
import { readExpiry, type BoardDay } from '../../data/expiryClass';
import { isIsoDay, oneOf, useAddressCut } from '../../components/trace/addressCut';
import { nyClock } from '../../core/nyTime';
import { useListedDates } from '../../data/feed/listings';
import { isUp, useFeedStatus } from '../../data/feed/status';
import { CompassPageSkeleton } from '../compassSkeleton';

/** The scanner sweeps on its own cadence — the feed must not vibrate with every price tick. */
const SCAN_INTERVAL_MS = 10_000;

const LAYOUT_OPTIONS: DropdownOption<BoardLayout>[] = [
  { value: 'cards', label: 'Cards', hint: "Two across, the stock's line on each" },
  { value: 'table', label: 'Table', hint: 'One row per setup, sortable' },
];

/* Each card's glyph wears its own ink on hover and while open — the sidebar's rule (Noah, 2026-09-11: "turn a colour
   like we have on our sidebar") */
const CARD_INK = { expiry: NAV_INK.record, kind: NAV_INK.weigher, type: NAV_INK.pinpoint, name: NAV_INK.compass, layout: NAV_INK.terrain } as const;

/** The five engine lenses the board sweeps on every tenor (All is the board's own, not a lens) */
const LENSES: ScannerKey[] = ['top-setups', 'quick-scalp', 'discounted', 'rebounds', 'whale-sweeps'];
/** Top Setups: the few strongest */
const TOP_FEW = 8;

const CAT_KEYS = EXPIRY_CATS.map(c => c.key) as string[];
const isCat = (v: string): v is ExpiryCat => CAT_KEYS.includes(v);

/* THE FILTERS' ADDRESS: /compass?exp=swing&kind=bounces&type=steady — a field at its default stays out of it */
const CUT = {
  exp: { def: '', valid: (v: string) => isCat(v) || isIsoDay(v) },
  kind: { def: 'top', valid: oneOf(KINDS.map(k => k.key)) },
  /* All types is where every kind opens (2026-10-11), so it stays out of the address */
  type: { def: 'all', valid: oneOf(STRATEGIES.map(t => t.key)) },
};

interface BoardCut {
  kind: KindKey;
  type: StrategyKey;
  exp: string;
  name?: string | null;
}

const inExpiry = (f: FiledSetup, exp: string) => (!exp ? true : isCat(exp) ? f.exp.cat === exp : isoDate(f.listing.expires) === exp);
const ofType = (f: FiledSetup, type: StrategyKey) => {
  if (type === 'all') return true;
  const t = STRUCTURE_TYPE[f.structure];
  if (type === 'steady') return t === 'single' && f.steady;
  if (type === 'big') return t === 'single' && !f.steady;
  return t === type;
};
const inKind = (f: FiledSetup, kind: KindKey) => kind === 'top' || kind === 'all' || f.kinds.includes(kind);
/** The option types Top Setups holds one of, at least, when the sweep found any */
const TOP_TYPES = ['single', 'spreads', 'premium', 'vol'] as const;

/**
 * A KIND'S OWN LIST, before the option type: one card a contract (the strongest lens's), in the engine's order — the
 * sweep's score, NO NAME AHEAD OF ANOTHER FOR BEING THAT NAME (the owner, 2026-10-11: "never put any tickers first").
 * Top Setups is the first few across every kind and every option type: the strongest of each option type the sweep
 * found, then the strongest of the rest, a contract once and at most two a name, shown in the engine's order.
 */
function kindList(pool: FiledSetup[], kind: KindKey, exp: string): FiledSetup[] {
  const best = new Map<string, FiledSetup>();
  for (const f of pool) {
    if (!inExpiry(f, exp) || !inKind(f, kind)) continue;
    const key = `${f.setup.ticker}|${f.legs}|${isoDate(f.listing.expires)}|${f.listing.am}`;
    const had = best.get(key);
    if (!had || f.setup.score > had.setup.score) best.set(key, f);
  }
  const list = [...best.values()].sort((a, b) => b.setup.score - a.setup.score);
  if (kind !== 'top') return list;
  /* THE FEW, NOT ONE CONTRACT FOUR TIMES: a contract once, on its strongest date, and at most two a name */
  const seen = new Set<string>();
  const perName = new Map<string, number>();
  const taken = new Set<FiledSetup>();
  const take = (f: FiledSetup): boolean => {
    const key = `${f.setup.ticker}|${f.legs}`;
    const n = perName.get(f.setup.ticker) ?? 0;
    if (taken.has(f) || seen.has(key) || n >= 2) return false;
    seen.add(key);
    perName.set(f.setup.ticker, n + 1);
    taken.add(f);
    return true;
  };
  /* EVERY OPTION TYPE STANDS IN IT (2026-10-11): the strongest single leg, spread, put sale and straddle or strangle */
  for (const t of TOP_TYPES) {
    const first = list.find(f => STRUCTURE_TYPE[f.structure] === t && !taken.has(f) && !seen.has(`${f.setup.ticker}|${f.legs}`) && (perName.get(f.setup.ticker) ?? 0) < 2);
    if (first) take(first);
  }
  for (const f of list) {
    if (taken.size >= TOP_FEW) break;
    take(f);
  }
  return list.filter(f => taken.has(f));
}

/** The board for one cut: the kind's list, narrowed by the option type */
function boardOf(pool: FiledSetup[], cut: BoardCut): FiledSetup[] {
  const list = kindList(pool, cut.kind, cut.exp).filter(f => ofType(f, cut.type));
  return cut.name ? list.filter(f => f.setup.ticker === cut.name) : list;
}

/** "Next session · Mon Oct 12" or "Today" — the 0DTE row's own words */
const zeroWords = (day: BoardDay) => (day.next ? `Next session · ${expiryLabel(isoDate(day.session))}` : day.before ? 'Today, from the open' : 'Today');

/* THE EXPIRATION CATEGORIES, over the calendar: a press filters to one, a day on the month to that date; the two never
   stand together, and the foot's "All expiries" clears both */
const ExpiryCategories = ({ exp, counts, day, onPick, close }: { exp: string; counts: Record<ExpiryCat, number>; day: BoardDay; onPick: (c: ExpiryCat) => void; close: () => void }) => (
  <div className="mb-3 pb-3 border-b border-borderSubtle" role="group" aria-label="Expiration category" data-expiry-cats>
    <div className="grid gap-1">
      {EXPIRY_CATS.map(c => {
        const on = exp === c.key;
        return (
          <button
            key={c.key}
            type="button"
            aria-pressed={on}
            onClick={() => {
              onPick(c.key);
              close();
            }}
            className={`hit w-full flex items-center gap-2 min-h-7 px-2 py-1 rounded border text-left transition-colors ${on ? 'border-silver/50 bg-silver/[0.06] text-textPrimary' : 'border-borderSubtle text-textSecondary hover:text-textPrimary hover:border-borderMuted'}`}
            data-expiry-cat={c.key}
          >
            <span className="w-[72px] shrink-0 font-mono text-[11px] font-semibold">{c.label}</span>
            <span className="flex-1 min-w-0 text-[11px] leading-snug text-textMuted">{c.key === '0dte' ? zeroWords(day) : c.line}</span>
            <span className="shrink-0 font-mono text-[11px] tnum">{counts[c.key]}</span>
          </button>
        );
      })}
    </div>
    <p className="mt-2 text-[11px] leading-snug text-textMuted">0DTE is a contract whose last trading day is today, read off each name's own dates. Or pick a date below.</p>
  </div>
);

const Board = () => {
  const activeTicker = useActiveTicker();
  const location = useLocation();
  const navigate = useNavigate();
  const { boardQuery, layout, tickerFilter, selectedId } = useCompassView();
  const [guideOpen, setGuideOpen] = useState(false);

  /* THE FILTERS ARE THE ADDRESS (2026-10-11) — validated, written with replace, only what differs from the default */
  const { cut, set: setCut, query } = useAddressCut(CUT);
  const kind = cut.kind as KindKey;
  const type = cut.type as StrategyKey;
  const exp = cut.exp;
  /* …and the trip back: a setup's Back goes to a bare /compass, which lands on the cut the board last had */
  const restoring = useRef(!location.search && !!boardQuery ? boardQuery : null);
  useEffect(() => {
    if (restoring.current) navigate({ search: `?${restoring.current}` }, { replace: true, state: location.state });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* only the board's own address is the board's cut: on the way out to a setup's page this page still renders a moment
     under that page's address, and must not write its bare query over the cut */
  const onBoard = location.pathname.replace(/\/$/, '') === '/compass';
  useEffect(() => {
    if (!onBoard) return;
    if (restoring.current !== null) {
      if (query !== restoring.current) return;
      restoring.current = null;
    }
    setCompassView({ boardQuery: query });
  }, [query, onBoard]);

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
      const lens: ScannerKey = known ? incoming.scanner : 'top-setups';
      const tenor: SleeveKey = incoming.sleeve ?? (!known && (incoming.scanner as string) === 'swings' ? 'swing' : 'weekly');
      navigate(`/compass/${setupIdOf({ ticker: incoming.ticker, strike: incoming.strike, right: incoming.right, scanner: lens, sleeve: tenor })}`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- two-tier cadence -----------------------------------------------------
  /* THE BOARD RENDERS ON THE SWEEP, NOT THE TICK (2026-10-10, the speed store): it read the whole feed and rendered on
     every tick to learn, nine times in ten, that the sweep was not due */
  const scanSnapshot = useScanSnapshot(SCAN_INTERVAL_MS);
  /* New York's clock, as every session time the terminal prints (the audit's X2) */
  const lastScanAt = useMemo(() => (scanSnapshot ? nyClock(Date.now(), { seconds: true }) : ''), [scanSnapshot]);
  /* Where the market's week stands — which session's contracts are the 0DTE list (data/expiryClass.ts) */
  const day = useMemo(() => {
    void scanSnapshot;
    return boardDay();
  }, [scanSnapshot]);

  // The live harness's market state for the whole board — the engine takes it
  // as an argument (never reads the simulator itself), so replay and live run
  // identical code. Scan-tier cadence: quotes refresh with the sweep.
  const universe = useMemo(() => (scanSnapshot ? Simulator.universeQuotes(scanSnapshot.ticker) : []), [scanSnapshot]);

  /* THE REAL CALENDAR (2026-10-12, data/feed/listings.ts): with UW up, each name's listed dates are the vendor's — the
     exchange's calendar, not a market reading, so they stand under the house's setups; the board waits for them (its
     skeleton) rather than filing on the schedule and moving every setup a moment later. UW down: the schedule, as
     before. */
  const feedStatus = useFeedStatus();
  const datesWait = feedStatus.uw.state === 'unknown';
  const universeNames = useMemo(() => universe.map(q => q.ticker), [universe]);
  const listed = useListedDates(isUp(feedStatus, 'uw'), universeNames, isoDate(day.today));
  const listedOf = listed.of;
  const listedReady = listed.ready && !datesWait;
  const listedVersion = listed.version;

  /* THE POOL: every lens on every tenor, as the engine finds them, each moved onto one of its name's listed dates and
     filed under its category, kinds, structure and tags (the stand-in mapping). Once a sweep — every filter below reads
     it, so a pick re-cuts without a sweep. */
  const pool = useMemo<FiledSetup[]>(() => {
    if (!scanSnapshot || !listedReady) return [];
    void listedVersion;
    const byLens: { lens: ScannerKey; sleeve: SleeveKey; setups: Setup[] }[] = [];
    for (const sl of SLEEVES) for (const lens of LENSES) byLens.push({ lens, sleeve: sl.key, setups: buildCompassView(scanSnapshot, lens, universe, sl.key).groups.flatMap(g => g.setups) });
    return filePool(byLens, universe, undefined, listedOf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanSnapshot, universe, listedReady, listedVersion]);
  const filingById = useMemo(() => new Map(pool.map(f => [f.setup.id, f])), [pool]);

  /* THE COUNTS — each the board that pick would show (the audit's CO-3: a figure is the number its own board lists): a
     kind's on the option type it would keep (the current one, or All types where the current one has nothing in it), a
     type's within the kind, a category's on the cut around it; never the name filter */
  const kindLists = useMemo(() => Object.fromEntries(KINDS.map(k => [k.key, kindList(pool, k.key, exp)])) as Record<KindKey, FiledSetup[]>, [pool, exp]);
  const typeIn = useCallback((k: KindKey): StrategyKey => (type === 'all' || kindLists[k].some(f => ofType(f, type)) ? type : 'all'), [kindLists, type]);
  const kindCounts = useMemo(() => Object.fromEntries(KINDS.map(k => [k.key, kindLists[k.key].filter(f => ofType(f, typeIn(k.key))).length])) as Record<KindKey, number>, [kindLists, typeIn]);
  const typeCounts = useMemo(() => Object.fromEntries(STRATEGIES.map(t => [t.key, kindLists[kind].filter(f => ofType(f, t.key)).length])) as Record<StrategyKey, number>, [kindLists, kind]);
  const catCounts = useMemo(() => Object.fromEntries(EXPIRY_CATS.map(c => [c.key, boardOf(pool, { kind, type, exp: c.key }).length])) as Record<ExpiryCat, number>, [pool, kind, type]);

  /* The cut's board before the name, and with it */
  const cutBoard = useMemo(() => boardOf(pool, { kind, type, exp }), [pool, kind, type, exp]);
  const filtered = useMemo(() => (tickerFilter ? cutBoard.filter(f => f.setup.ticker === tickerFilter) : cutBoard), [cutBoard, tickerFilter]);

  // The flat, globally-ranked board — rank is the organizing principle
  const freshSetups = useMemo(() => {
    const flat = filtered.map(f => f.setup);
    /* THE SWEEP'S MOMENT, noted once per setup (campaignStore — the audit's CO-5): the setup's page says "found at" this
       time, and its targets count from this bar */
    const at = Date.now();
    for (const s of flat) noteFound(s, 'sweep', at);
    return flat;
  }, [filtered]);

  /* THE BOARD HOLDS STILL UNDER THE HAND (the audit's CO-4: the order changed every 10 s under the pointer — twice in
     25 s — so a second click could open a different card, and the Tab order shifted mid-walk). While the pointer is over
     the board or the keys are in it, the cards keep their places (a setup the sweep dropped keeps its card, its figures
     the last it had); a new order waits, said in one line with a door to show it, and lands when the pointer and the
     keys leave. */
  const [holding, setHolding] = useState(false);
  /* bumps a render when the held order is replaced by hand */
  const [heldNonce, setHeldNonce] = useState(0);
  const pointerIn = useRef(false);
  const focusIn = useRef(false);
  const heldRef = useRef<typeof freshSetups | null>(null);
  const syncHold = useCallback(() => {
    const on = pointerIn.current || focusIn.current;
    if (!on) heldRef.current = null;
    setHolding(on);
  }, []);
  if (holding && !heldRef.current) heldRef.current = freshSetups;
  const rankedSetups = useMemo(() => {
    const held = holding ? heldRef.current : null;
    if (!held) return freshSetups;
    const byId = new Map(freshSetups.map(s => [s.id, s]));
    return held.map(s => byId.get(s.id) ?? s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freshSetups, holding, heldNonce]);
  const newOrder = useMemo(() => {
    if (!holding || rankedSetups === freshSetups) return false;
    if (rankedSetups.length !== freshSetups.length) return true;
    return rankedSetups.some((s, i) => s.id !== freshSetups[i].id);
  }, [holding, rankedSetups, freshSetups]);
  const showNewOrder = () => {
    heldRef.current = freshSetups;
    setHeldNonce(n => n + 1);
  };
  /* a card the sweep dropped keeps the filing it had while the board holds */
  const lastFiling = useRef(new Map<string, FiledSetup>());
  for (const f of filtered) lastFiling.current.set(f.setup.id, f);
  const boardFiling = useCallback((id: string) => filingById.get(id) ?? lastFiling.current.get(id), [filingById]);

  /* Nothing selected → #1 is. The rail always follows a selection, so it
     never belongs to nothing; a sweep, filter or kind change that drops the
     selected card falls back to the first one visible. */
  useEffect(() => {
    if (!rankedSetups.length) return;
    if (!selectedId || !rankedSetups.some(s => s.id === selectedId)) setCompassView({ selectedId: rankedSetups[0].id });
  }, [rankedSetups, selectedId]);
  const selectedSetup = useMemo(() => rankedSetups.find(s => s.id === selectedId) ?? rankedSetups[0] ?? null, [rankedSetups, selectedId]);
  const selectedFiling = selectedSetup ? boardFiling(selectedSetup.id) : undefined;
  /* the rail prices the selected card's tenor */
  const railSleeve: SleeveKey = selectedSetup?.sleeve ?? 'weekly';

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
  /* the rail's rows say, and open, the selected card's own date — the board moved it onto one of its name's listed days */
  const railDate = selectedFiling && selectedFiling.setup.id.match(/-\d{4}-\d{2}-\d{2}(am)?$/) ? { on: isoDate(selectedFiling.listing.last), am: selectedFiling.listing.am } : null;
  const railWord = selectedFiling ? (selectedFiling.exp.cat === '0dte' ? '0DTE' : `${selectedFiling.exp.dte}DTE`) : null;
  const railRows = useMemo(() => {
    if (!railSnapshot) return [];
    const rows = buildImpact(railSnapshot, railSleeve);
    return railWord ? rows.map(r => ({ ...r, expiry: railWord })) : rows;
  }, [railSnapshot, railSleeve, railWord]);
  const railNote = selectedSetup ? `the #${rankedSetups.indexOf(selectedSetup) + 1} card, ${structureName(selectedSetup, selectedFiling)}` : undefined;

  const activeKind = KIND_BY_KEY[kind];
  const activeType = STRATEGY_BY_KEY[type];

  /* A KIND KEEPS THE OPTION TYPE (2026-10-11 — the type narrows within the kind): unless the type has nothing in the new
     kind, then All types; and on every name, as the Kind card always did */
  const handleKind = (next: KindKey) => {
    setCut({ kind: next, type: typeIn(next) });
    setCompassView({ selectedId: null, tickerFilter: null });
  };
  const handleType = (next: StrategyKey) => {
    setCut({ type: next });
    setCompassView({ selectedId: null });
  };
  /* A category and a date never stand together; "All expiries" clears both */
  const handleExp = (next: string) => {
    setCut({ exp: next });
    setCompassView({ selectedId: null });
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
    navigate(`/compass/${setupIdOf({ ticker, strike: row.strike, right: row.right, scanner: selectedFiling?.lens ?? 'top-setups', sleeve: railSleeve, ...(railDate ?? {}) })}`);
  };

  /* ---- the head's facts and the sentence ------------------------------------------ */

  /* ACTIVE AND MOVING COUNTED APART (the audit's CO-13: "Active 16" counted the cards that said MOVING) */
  const counts = useMemo(() => {
    let active = 0;
    let moving = 0;
    let watch = 0;
    let fading = 0;
    for (const s of rankedSetups) {
      const st = processState(s);
      if (st === 'ACTIVE') active++;
      else if (st === 'MOVING') moving++;
      else if (st === 'WATCH') watch++;
      else fading++;
    }
    return { active, moving, watch, fading };
  }, [rankedSetups]);
  const top = rankedSetups[0] ?? null;
  const topFiling = top ? boardFiling(top.id) : undefined;
  const byName = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of rankedSetups) m.set(s.ticker, (m.get(s.ticker) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [rankedSetups]);

  /* THE CALENDAR'S LIT DAYS: every date a name on the board lists, each with its category (data/compassStandIn.ts
     listingsFor — the feed's own expiry list while UW is up, data/feed/listings.ts) */
  const calendar = useMemo(() => {
    void listedVersion;
    const byIso = new Map<string, { e: Expiry; cat: ExpiryCat; am: boolean }>();
    for (const q of universe) {
      for (const l of listingsFor(q.ticker, day, listedOf(q.ticker))) {
        const r = readExpiry(l, day);
        if (!r) continue;
        const iso = isoDate(l.expires);
        const had = byIso.get(iso);
        /* a date two contracts share is read by its PM one (SPX's AM monthly last trades the session before) */
        if (!had || (had.am && !l.am)) byIso.set(iso, { e: expiryAt(l.expires), cat: r.cat, am: l.am });
      }
    }
    return byIso;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [universe, day, listedVersion]);
  /* how many setups each date holds on the cut — said on the day's tooltip */
  const perDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of boardOf(pool, { kind: kind === 'top' ? 'all' : kind, type, exp: '' })) {
      const iso = isoDate(f.listing.expires);
      m.set(iso, (m.get(iso) ?? 0) + 1);
    }
    return m;
  }, [pool, kind, type]);
  const calendarDays = useMemo(() => [...calendar.values()].map(v => v.e).sort((a, b) => a.date.getTime() - b.date.getTime()), [calendar]);
  const pickedDate = exp && !isCat(exp) ? calendar.get(exp) ?? null : null;

  /* THE CARDS: Expiry (a category or a date), Kind in its two sections, Option type, the name, the layout */
  const kindOptions = useMemo<DropdownOption<KindKey>[]>(
    () => KINDS.map(k => ({ value: k.key, label: `${k.label} · ${kindCounts[k.key] ?? 0}`, short: k.label, hint: k.line, group: k.tier === 'main' ? 'Main' : 'Advanced' })),
    [kindCounts]
  );
  const typeOptions = useMemo<DropdownOption<string>[]>(
    () => [
      /* A TYPE WITH NOTHING IN THE KIND stays listed with its 0, greyed, and the keys pass over it as they pass the
         structures to come — unless it is the type on show */
      ...STRATEGIES.map(t => ({ value: t.key as string, label: `${t.label} · ${typeCounts[t.key] ?? 0}`, short: t.label, hint: t.line, indent: !!t.parent, disabled: !typeCounts[t.key] && t.key !== type })),
      ...STRATEGIES_LATER.map(l => ({ value: `later-${l}`, label: l, group: 'Coming later, after testing', disabled: true })),
    ],
    [typeCounts, type]
  );
  /* The Name card searches (Noah, 2026-09-11: "not a scroll down until you
     see the stock your looking for") — the ticker and the company both match */
  const nameOptions = useMemo<SearchOption<string>[]>(() => {
    const m = new Map<string, number>();
    for (const f of cutBoard) m.set(f.setup.ticker, (m.get(f.setup.ticker) ?? 0) + 1);
    const names = [...m.entries()].sort((a, b) => b[1] - a[1]);
    return [
      { value: 'ALL', label: 'All names', hint: `${names.length} names on this sweep` },
      ...names.map(([t, n]) => ({ value: t, label: t, logo: t, keywords: tickerName(t), hint: `${tickerName(t)} · ${n} ${n === 1 ? 'setup' : 'setups'}` })),
    ];
  }, [cutBoard]);

  /* The Expiry card's words: All, a category, or a date with its category */
  const expTrigger = !exp ? 'All' : isCat(exp) ? (exp === '0dte' && day.next ? '0DTE · Next session' : EXPIRY_CAT_BY_KEY[exp].label) : expiryLabel(exp);
  const expiryWords = useMemo(() => {
    if (!exp) return 'every listed expiry';
    if (pickedDate) return `the ${expiryLabel(exp)} contracts`;
    if (exp === '0dte') return day.next ? `the next session's contracts (${expiryLabel(isoDate(day.session))})` : "today's contracts";
    if (isCat(exp)) return `contracts ${EXPIRY_CAT_BY_KEY[exp].line.split(' —')[0]} out`;
    return `the ${expiryLabel(exp)} contracts`;
  }, [exp, pickedDate, day]);
  const horizonWords = topFiling ? (topFiling.exp.cat === '0dte' && !topFiling.exp.next ? 'by the bell' : `by ${expiryLabel(isoDate(topFiling.listing.expires))}`) : '';
  const cutWords = `${activeKind.label}${activeType.key === 'all' ? '' : ` as ${activeType.label}`}`;

  const sentence = useMemo<ReactNode>(() => {
    if (!rankedSetups.length || !top) {
      return <RichRead text={`Nothing cleared the bar for ${cutWords} on ${expiryWords} this sweep — an empty board is a read, not an error.`} />;
    }
    /* One line at the desk's width: only the states that are there, the busiest name, the top pick as a door */
    const busiest = byName[0];
    const states = [
      counts.active ? `${counts.active} active` : '',
      counts.moving ? `${counts.moving} moving` : '',
      counts.watch ? (counts.watch === 1 ? '1 still proving itself' : `${counts.watch} still proving themselves`) : '',
      counts.fading ? `${counts.fading} fading` : '',
    ].filter(Boolean);
    /* "NVDA carries the most, 1 of 15 names" when every name has one is no read (the audit's CO-12) */
    const names = byName.length === 1 ? `all on ${busiest[0]}` : busiest[1] === 1 ? `one each across ${byName.length} names` : `${busiest[1]} on ${busiest[0]}, the most of ${byName.length} names`;
    const lead = `${rankedSetups.length} ${rankedSetups.length === 1 ? 'setup' : 'setups'} for ${cutWords} on ${expiryWords} at ${lastScanAt} — ${states.join(', ')} · ${names}. Top pick `;
    return (
      <>
        <RichRead text={lead} />
        <ReadDoor onOpen={() => openSetup(top)} title="Open the setup's page">
          {structureName(top, topFiling)}
        </ReadDoor>
        <RichRead text={`, ±${top.sigmaMovePct.toFixed(1)}% ${horizonWords}.`} />
      </>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rankedSetups, top, topFiling, byName, counts, expiryWords, horizonWords, lastScanAt, cutWords]);

  /* THE RAIL'S TWO STANCES: a board shorter than the screen → the rail
     adopts the box's height and both end on one line; a board taller than the screen
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

  /* Before the first sweep, the board's own skeleton — never a line of caps saying what it waits for (the audit's CO-20) */
  if (!scanSnapshot || !pool.length) return <CompassPageSkeleton />;

  const rail = <ImpactLeaderboard ticker={railSnapshot?.ticker ?? scanSnapshot.ticker} note={railNote} rows={railRows} onOpen={handleOpenContract} />;

  return (
    <>
      {/* THE BOARD and its rail (Noah, 2026-08-17: "a side section next to the setups", clearly narrower) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch" data-compass-row data-rail={railSticks ? 'sticks' : 'adopts'}>
        <div ref={setBoxEl} className="xl:col-span-8 min-w-0">
          <TraceBox
            title="The board"
            sub={`${activeKind.label}: ${activeKind.line} · press a card, then Open`}
            testId="compass"
            data={{ expiry: exp || 'all', kind, type, layout, rows: rankedSetups.length }}
            guide={{ title: 'How to read the board', door: 'What a card, its filters and the rail mean', body: <CompassGuide />, testId: 'compass-guide', open: guideOpen, onOpen: setGuideOpen }}
            facts={
              <>
                <Fact label="Found" testId="found">
                  {rankedSetups.length}
                  {tickerFilter && <span className="text-textMuted"> · of {cutBoard.length}</span>}
                </Fact>
                <Fact label="Active" testId="active">
                  <span className={counts.active ? 'text-textPrimary' : 'text-textMuted'}>{counts.active}</span>
                </Fact>
                <Fact label="Moving" testId="moving" title="Active, and the contract now trades like its trade (delta 0.50 or more)">
                  <span className={counts.moving ? 'text-textPrimary' : 'text-textMuted'}>{counts.moving}</span>
                </Fact>
                {/* WATCH, the card's own word (setupProcess.ts) — the head said "Proving" while every card it counted said
                    WATCH (2026-10-01, the owner: "compass do what u need to do"); the sentence below still says what it
                    means, "still proving itself" */}
                <Fact label="Watch" testId="watch">
                  <span className={counts.watch ? 'text-textPrimary' : 'text-textMuted'}>{counts.watch}</span>
                </Fact>
                <Fact label="Fading" testId="fading">
                  <span className={counts.fading ? 'text-textPrimary' : 'text-textMuted'}>{counts.fading}</span>
                </Fact>
                {top && (
                  <Champion label="Top pick" ink="supreme" onOpen={() => openSetup(top)} testId="top-pick">
                    {structureName(top, topFiling)} · ±{top.sigmaMovePct.toFixed(1)}%
                  </Champion>
                )}
                <Fact label="Found at" testId="found-at">
                  {lastScanAt || <span className="text-textMuted">—</span>}
                </Fact>
              </>
            }
            controls={
              <>
                {/* EXPIRY: THE HOUSE CALENDAR (Trace's), its categories over the month (the owner, 2026-10-11: "bring the
                    calendar we use so people can also click on certain dates") */}
                <ExpiryCalendar
                  label="Expiry"
                  value={pickedDate ? exp : ''}
                  expiries={calendarDays}
                  onChange={e => handleExp(isoDate(e.date))}
                  onClear={() => handleExp('')}
                  clearLabel="All expiries"
                  anyLabel={expTrigger}
                  valueNote={pickedDate ? ` · ${EXPIRY_CAT_BY_KEY[pickedDate.cat].label}` : undefined}
                  dayNote={e => {
                    const c = calendar.get(isoDate(e.date));
                    if (!c) return undefined;
                    const n = perDay.get(isoDate(e.date)) ?? 0;
                    return `${EXPIRY_CAT_BY_KEY[c.cat].label}${c.am ? ' · AM-settled' : ''} · ${n === 0 ? 'nothing on this cut' : `${n} ${n === 1 ? 'setup' : 'setups'}`}`;
                  }}
                  steppers={false}
                  title="An expiration category, or a date"
                  icon={CalendarDays}
                  ink={CARD_INK.expiry}
                  testId="compass-expiry"
                  head={close => <ExpiryCategories exp={exp} counts={catCounts} day={day} onPick={handleExp} close={close} />}
                />
                <DropdownSelect label="Kind" value={kind} options={kindOptions} onChange={handleKind} title="What kind of setup" icon={Shapes} ink={CARD_INK.kind} testId="compass-kind" />
                <DropdownSelect label="Option type" value={type as string} options={typeOptions} onChange={v => handleType(v as StrategyKey)} title="The structure a card is" icon={Layers} ink={CARD_INK.type} testId="compass-type" />
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
                {/* the layout as its glyph and choice alone, so the five cards keep to one line on a desk */}
                <DropdownSelect label="Layout" bare value={layout} options={LAYOUT_OPTIONS} onChange={v => setCompassView({ layout: v })} title="Cards, or a table" icon={layout === 'cards' ? LayoutGrid : Table} ink={CARD_INK.layout} testId="compass-layout" />
              </>
            }
            sentence={sentence}
          >
            {/* The body fades on a filter change (the slow clock — a whole
                board arriving in 0.2s reads as a snap, Noah 2026-08-10); the head stays put */}
            <div
              key={`feed-${kind}-${type}-${exp}`}
              className="relative animate-soft-in-slow"
              onPointerEnter={e => {
                if (e.pointerType !== 'mouse') return;
                pointerIn.current = true;
                syncHold();
              }}
              onPointerLeave={() => {
                pointerIn.current = false;
                syncHold();
              }}
              onFocus={() => {
                focusIn.current = true;
                syncHold();
              }}
              onBlur={e => {
                if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
                focusIn.current = false;
                syncHold();
              }}
              data-board-held={holding || undefined}
            >
              {/* QUICK SCALPS, THIN OR EMPTY, SAYS WHY (2026-10-11): its rule is index products' same-day contracts alone */}
              {kind === 'quick-scalps' && rankedSetups.length < 4 && (
                <p className="px-5 pt-3 -mb-1 text-[11px] leading-snug text-textMuted" data-compass-note="quick-scalps">
                  Quick Scalps lists same-day contracts on index products only.
                </p>
              )}
              {/* the order waiting while the board holds — one quiet line, its door showing it now */}
              <div aria-live="polite" className={newOrder ? 'flex items-center justify-end gap-2 px-5 pt-2 -mb-1' : 'sr-only'}>
                {newOrder && (
                  <>
                    <span className="text-[11px] text-textMuted">The sweep has a new order — the cards hold still under your hand</span>
                    <button type="button" onClick={showNewOrder} className="hit font-mono text-[11px] uppercase tracking-wider text-textSecondary hover:text-textPrimary border border-borderSubtle hover:border-borderMuted rounded px-2 py-0.5 transition-colors" data-board-new-order>
                      Show it
                    </button>
                  </>
                )}
              </div>
              <SetupScanBoard
                setups={rankedSetups}
                layout={layout}
                selectedId={selectedId}
                onSelect={handleSelect}
                onAnalysis={openSetup}
                expiryChip=""
                showKind={kind === 'top' || kind === 'all'}
                filingOf={boardFiling}
              />
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
