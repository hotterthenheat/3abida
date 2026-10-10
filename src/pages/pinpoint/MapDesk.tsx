/*
==================================================
  SLAYER TERMINAL - THE MAP
  (pages/pinpoint/MapDesk.tsx)

  The book by expiry, FIRST (Noah, 2026-09-12:
  "remove this entire section from the pinpoint
  map page. the first thing that should be shown
  is the heatmap and this is already shown in
  multiple pages like the terrain and pulse
  pages"). The day-on-one-chart box that opened
  this page since band 2 (the tape with the dealer
  levels drawn on it, the strike rail fused to its
  price axis as one profile panel, its own head,
  fullscreen, drawing rail and replay pick) is
  GONE — Terrain and Pulse carry that chart. What
  is left is the read, top to bottom: the Exposure
  Ledger (the same book by expiry, as a heatmap or
  a ladder), the Trader's Clock, the Wall Report
  Card, your positions. One strike shared across
  them (FocusContext); each box can step onto its
  own name; the replay runs the boxes on a minute
  grid from the calendar's own strip.

  NOTHING HERE IS NEW MACHINERY. The book is
  `buildExposureProfile` — the same one the Strike
  Pressure Ladder widget reads — under the calendar's
  expiries, greek and window. The Calendar (the
  Exposure Ledger) is band 3 of the blank canvas.
==================================================
*/

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import Simulator from '../../core/simulator';
import { useMarketData } from '../../context/MarketDataContext';
import { useFocus } from '../../context/FocusContext';
import ScopeChip from '../../components/ui/ScopeChip';
import { Deferred } from '../../components/ui/Skeleton';
import { CalendarInner, DayInner, MapPageSkeleton, ReportInner } from './pinpointSkeletons';
import ExposureField from '../../components/gex/ExposureField';
import TraderClock from '../../components/gex/TraderClock';
import WallReportCard from '../../components/gex/WallReportCard';
import ReplayStrip from '../../components/gex/ReplayStrip';
import { barsAt, replayDay, replayMinute, replayRange, replayStart, snapPos, snapshotAt, type ReplayRange } from '../../data/replay';
import { readPosition, usePositions } from '../../data/positions';
import { buildExposureProfile, type StrikeWindow } from '../../data/exposure';
import type { ExposureExpiry } from '../../types/gex';
import type { Candle, MarketSnapshot } from '../../types/market';
import { useOnScreen } from '../../components/ui/useOnScreen';
import { scanOf } from '../../data/pinpointBook';
import { useFrameScan, useRoomWindow } from './usePinpoint';

/* THE WINDOW IS THE WHOLE BOOK (Noah, 2026-09-05): thirty strikes each side are
   built once; the boxes draw whatever of them they need. */
const WINDOW: StrikeWindow = 30;
/** Your positions read against the 0DTE book — the same book the ladder tile draws */
const POSITIONS_EXPIRY: ExposureExpiry = '0DTE';

/*
  EACH BOX CAN HOLD ITS OWN NAME (Noah, 2026-09-06: "i should be able to change
  tickers on each singular section as i please … they should all start off as
  one"). The scoping rule, box by box: a box FOLLOWS the frame's name until its
  chip unlinks it, then it reads its own snapshot (the simulator's pure read,
  refreshed on the scan cadence) and its chip wears the name. Held across route
  changes within a session and reset on reload, so every visit starts as one.
*/
type BoxKey = 'calendar' | 'day' | 'report';
type Scopes = Partial<Record<BoxKey, string>>;
let scopesMemory: Scopes = {};

const MapDesk = () => {
  const { marketData, activeTicker, changeTicker } = useMarketData();
  const { focus, toggleFocus } = useFocus();

  /* Which boxes have stepped off the frame, and onto which name */
  const [scopes, setScopesState] = useState<Scopes>(scopesMemory);
  const setScope = (key: BoxKey, t: string | undefined) =>
    setScopesState(prev => {
      const next = { ...prev };
      if (t === undefined) delete next[key];
      else next[key] = t;
      scopesMemory = next;
      return next;
    });

  /* ONE LENS PER PAGE (Noah, 2026-09-08, "do the sync"): the calendar's Greek is
     the page's — the calendar's "All" is the five greeks side by side.
     THE MAP OPENS ON ALL FIVE (Noah, 2026-09-21: "the initial render of the
     pinpoint map page should be the 5 box setup always") — the ladder with a
     pane a greek, the net bar in each; the pick is the page's for the visit,
     never stored, so every visit opens the same way. */
  const [greekPick, setGreekPick] = useState<string[]>(['all']);

  /* REPLAY (2026-09-08): one position on today's session — seconds from the
     open — and every box reads the book as it stood then (data/replay.ts).
     The strip on the calendar's band is the transport; it starts from the open
     (the chart whose bar picked the minute is gone from this page). Esc, a
     name change, or "Back to live" ends it. Boxes pinned to another name stay
     live. */
  const [replay, setReplay] = useState<{ phase: 'play'; range: ReplayRange; pos: number; playing: boolean; pace: number } | null>(null);
  const replayOn = replay != null;
  const playing = replay;

  /* The room's scan (data/pinpointBook.ts): the book sweeps every ten seconds, the same snapshot every page reads */
  const scan = useFrameScan()?.snap ?? null;
  /* THE STRIKES — the room's one window, the calendar's Strikes card (PP-20) */
  const [half, setHalf] = useRoomWindow();

  /* THE OWN-NAME SNAPSHOTS — one per name a box has stepped onto, rebuilt on
     the scan cadence like the frame's own. A pure read of the simulator. */
  const pinnedKey = [scopes.calendar, scopes.day, scopes.report].filter(Boolean).join('|');
  const ownSnaps = useMemo(() => {
    const m = new Map<string, MarketSnapshot>();
    if (!scan || !pinnedKey) return m;
    for (const t of new Set(pinnedKey.split('|'))) {
      if (t === scan.ticker) continue;
      const own = scanOf(t);
      if (own) m.set(t, own.snap);
    }
    return m;
  }, [scan, pinnedKey]);

  /* The session on hand for the replay, and the book at the position — THE
     MINUTE GRID (2026-09-11): the calendar, the clock and the report read the
     book once per replayed minute; their surfaces are the page's heaviest. */
  const range = playing?.range ?? null;
  const framePos = playing && range ? snapPos(playing.pos, range.length) : 0;
  const minutePos = Math.floor(framePos / 60) * 60;
  const replaySnapMinute = useMemo(() => (range && scan ? snapshotAt(scan, range, minutePos) : null), [range, scan, minutePos]);
  const replayBars = useMemo(() => (range ? barsAt(range, minutePos) : undefined), [range, minutePos]);
  useEffect(() => {
    if (!playing?.playing || !range) return;
    const id = window.setInterval(() => {
      setReplay(r => {
        if (!r || !r.playing) return r;
        const next = r.pos + r.pace * 0.25;
        return next >= range.length ? { ...r, pos: range.length, playing: false } : { ...r, pos: next };
      });
    }, 250);
    return () => window.clearInterval(id);
  }, [playing?.playing, playing?.pace, range]);
  useEffect(() => {
    if (!replayOn) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) setReplay(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [replayOn]);
  /* A replay was recorded in one name's world — a new name ends it */
  useEffect(() => setReplay(null), [scan?.ticker]);
  /* Replay opens at the OPEN, paused — the strip's own scrubber takes it from there */
  const startReplay = () => {
    if (!scan) return;
    const r = replayRange(scan.ticker);
    if (!r) return;
    setReplay({ phase: 'play', range: r, pos: 0, playing: false, pace: 60 });
  };
  /** The calendar's transport: the door to start, then the strip with the position */
  const replayBar = replay ? (
    <ReplayStrip
      compact
      phase={replay.phase}
      pos={playing?.pos ?? 0}
      length={playing?.range.length ?? 0}
      day={playing ? replayDay(playing.range) : undefined}
      startMin={playing ? replayStart(playing.range) : undefined}
      playing={playing?.playing ?? false}
      onPlay={p => setReplay(r => (r ? { ...r, playing: p } : r))}
      pace={playing?.pace ?? 60}
      onPace={pace => setReplay(r => (r ? { ...r, pace } : r))}
      onSeek={pos => setReplay(r => (r ? { ...r, pos } : r))}
      onExit={() => setReplay(null)}
    />
  ) : (
    <button
      type="button"
      onClick={startReplay}
      title="Replay today's session from the open — every box on the page reads the book as it stood"
      className="hit inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-borderSubtle bg-chip hover:border-borderMuted font-mono text-[11px] text-textSecondary hover:text-textPrimary transition-colors"
      data-map-replay
    >
      <Play className="w-3 h-3" /> Replay
    </button>
  );

  /* THE NAMES BESIDE THE CALENDAR'S REWIND WITH IT (2026-09-13): a column's
     book is its name's own session at the replayed minute — a name with no
     session on hand stays live */
  const columnSnap = useCallback(
    (t: string): MarketSnapshot => {
      const live = Simulator.snapshotFor(t);
      if (!range) return live;
      const own = replayRange(t);
      return own ? snapshotAt(live, own, Math.min(minutePos, own.length)) : live;
    },
    [range, minutePos]
  );
  /** The snapshot a box reads: the frame's (rewound to the minute while replaying), or its own */
  const snapFor = (key: BoxKey): MarketSnapshot | null => {
    if (!scan) return null;
    const t = scopes[key];
    if (!t || t === scan.ticker) return replaySnapMinute ?? scan;
    return ownSnaps.get(t) ?? scan;
  };
  /* A BOX NOBODY SEES HOLDS STILL while the replay runs (2026-09-11): off
     screen, a box keeps the moment it last showed; scrolled into view, it
     catches up on its next render. What it reads arrives DEFERRED. */
  const [calRef, calOn] = useOnScreen<HTMLDivElement>();
  const [dayRef, dayOn] = useOnScreen<HTMLDivElement>();
  const [reportRef, reportOn] = useOnScreen<HTMLDivElement>();
  const heldRef = useRef<{ calendar: MarketSnapshot | null; day: MarketSnapshot | null; report: MarketSnapshot | null; bars: Candle[] | undefined }>({ calendar: null, day: null, report: null, bars: undefined });
  const shown = (key: BoxKey, on: boolean): MarketSnapshot | null => {
    const fresh = snapFor(key);
    if (!replayOn || on || !heldRef.current[key]) heldRef.current[key] = fresh;
    return heldRef.current[key];
  };
  const calSnap = useDeferredValue(shown('calendar', calOn));
  const daySnap = useDeferredValue(shown('day', dayOn));
  const reportSnap = useDeferredValue(shown('report', reportOn));
  if (!replayOn || reportOn || !heldRef.current.bars) heldRef.current.bars = replayBars;
  const reportBars = useDeferredValue(heldRef.current.bars);
  /** The shared strike belongs to ONE name — a box on another name never draws it */
  const focusFor = (t: string) => (focus && focus.ticker === t ? focus.price : null);
  /** A box's chip: follows the frame, or holds its own name */
  const chipFor = (key: BoxKey, t: string) => (
    <ScopeChip
      ticker={t}
      linked={scopes[key] === undefined}
      quote
      onToggleLink={() => setScope(key, scopes[key] === undefined ? t : undefined)}
      onPick={next => (scopes[key] === undefined ? changeTicker(next) : setScope(key, next))}
    />
  );

  /* THE BOOK the positions read against — the frame's, at the replayed minute */
  const frameSnap = replaySnapMinute ?? scan;
  const data = useMemo(() => {
    if (!frameSnap) return null;
    try {
      return buildExposureProfile(frameSnap, POSITIONS_EXPIRY, WINDOW);
    } catch {
      return null;
    }
  }, [frameSnap]);

  const ticker = frameSnap?.ticker ?? activeTicker;
  const calTicker = calSnap?.ticker ?? ticker;
  const dayTicker = daySnap?.ticker ?? ticker;
  const reportTicker = reportSnap?.ticker ?? ticker;

  /* YOUR POSITIONS on this name (roadmap step 6): read against the 0DTE book,
     once per scan; the ledger's marks and the box read the same map */
  const positions = usePositions(ticker);
  const reads = useMemo(() => new Map(data ? positions.map(p => [p.id, readPosition(p, data)]) : []), [positions, data]);
  const marks = useMemo(() => {
    const m = new Map<number, string>();
    for (const p of positions) {
      const s = reads.get(p.id)?.sentence ?? '';
      m.set(p.strike, m.has(p.strike) ? `${m.get(p.strike)}\n${s}` : s);
    }
    return m;
  }, [positions, reads]);

  /* The page stands in as its own four boxes while the first read walks in
     (Noah, 2026-09-08: a stock skeleton "doesn't take the shape of its
     container") — the same shapes the route's fallback and the deferred
     mounts use, so nothing on the page moves when the book lands. */
  if (!scan || !data) return <MapPageSkeleton />;

  return (
    <>
      {/* THE CALENDAR, FIRST — the same book by expiry, the Exposure Ledger with
          its one-row toolbar (greek · expiries · strikes · palette · Now | After
          the bell · the read · fullscreen) and the replay's transport. The host
          names the book, so the ledger's head carries no name or search. The
          strike a capsule pins is the same shared strike every box lights. */}
      {/* 870px = the whole default window (±20 strikes at the ledger's 18px
          floor) with the toolbar and the read line, no scrolling — the lock
          walk's first fix (Noah, 2026-09-09: "the heatmap length is a bit
          short so make it taller"; at 600 only 25 of the 40 rows showed) */}
      {/* never taller than the screen under the head (PP-17): at 1280 × 720 the page and the ladder scrolled inside each other */}
      <div ref={calRef} className="border border-borderSubtle rounded-md overflow-hidden h-[min(870px,calc(100svh-120px))] min-h-[520px] flex flex-col" data-calendar data-scope-ticker={calTicker} data-on-screen={calOn}>
        <Deferred index={0} frames={0} fallback={<CalendarInner />} className="h-full min-h-0 flex flex-col animate-fade-in">
          <ExposureField
            snapshot={calSnap ?? scan}
            toolbar="band"
            half={half}
            onHalf={setHalf}
            lead={chipFor('calendar', calTicker)}
            greeks={greekPick}
            onGreeks={setGreekPick}
            fullMode="move"
            fresh={replayOn && calTicker === ticker}
            after={calTicker === ticker ? replayBar : undefined}
            selectedStrike={focusFor(calTicker)}
            marks={calTicker === ticker ? marks : undefined}
            onSelectStrike={price => toggleFocus(price, calTicker)}
            /* NAMES SIDE BY SIDE (2026-09-12): up to four books on the one band; a
               kept strike belongs to its own name */
            multi
            selectedStrikeFor={focusFor}
            onSelectStrikeFor={(t, price) => toggleFocus(price, t)}
            snapshotFor={columnSnap}
          />
        </Deferred>
      </div>
      {/* THE DAY — the two tools nobody ships (roadmap step 5, 2026-09-05):
          the Trader's Clock, today's hedging schedule with the book's figures
          in it, and the Wall Report Card, every level's record on today's
          tape. One box, two columns, the same strike shared. */}
      {/* No overflow clip here: the clock's hover card rises above the strip and a
          long phase sentence would be cut at the box's top edge */}
      <div ref={dayRef} className="border border-borderSubtle rounded-md bg-panel" data-day data-scope-ticker={dayTicker} data-on-screen={dayOn}>
        <Deferred index={1} frames={22} fallback={<DayInner />} className="animate-fade-in">
          <TraderClock snapshot={daySnap ?? scan} scope={chipFor('day', dayTicker)} at={playing && dayTicker === ticker ? replayMinute(framePos, range) : undefined} />
        </Deferred>
      </div>
      {/* HOW THE LEVELS HELD TODAY — full width, in the approved grammar: the
          page grows rather than cramming (Noah, 2026-09-05) */}
      <div ref={reportRef} className="border border-borderSubtle rounded-md overflow-hidden bg-panel" data-report data-scope-ticker={reportTicker} data-on-screen={reportOn}>
        <Deferred index={2} frames={26} fallback={<ReportInner />} className="animate-fade-in">
          <WallReportCard snapshot={reportSnap ?? scan} focus={focusFor(reportTicker)} onPick={price => toggleFocus(price, reportTicker)} scope={chipFor('report', reportTicker)} bars={playing && reportTicker === ticker ? reportBars : undefined} />
        </Deferred>
      </div>
      {/* YOUR POSITIONS left this page for the Weigher's desk (Noah, 2026-09-14: "this is a
          feature a weigher section should have and not a pinpoint map section") — the map keeps
          the marks the positions leave on its ladder (`marks` above) */}
    </>
  );
};

export default MapDesk;
