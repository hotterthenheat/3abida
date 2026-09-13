/*
==================================================
  SLAYER TERMINAL - THE MAP
  (pages/pinpoint/MapDesk.tsx)

  Band 2 of the Pinpoint roadmap (2026-09-05, the
  blank canvas): the day's chart with the dealer
  levels drawn on it — the walls, the pin, the
  supreme, the flip, the trails of the chosen greek
  — under one thin toolbar, with one line under the
  toolbar: what the book says today.

  THE STRIKE PANEL LEFT THE MAP (Noah, 2026-09-13:
  "please remove this from my pinpoint page, makes
  no sense to have it in pulse, terrain and now
  here"). The chart takes the whole box; the
  strikes live in the board under it — the Greek
  Board (components/gex/GreekBoard.tsx), up to
  five Net strips side by side, one greek each,
  "where you just see the gex/dex/vex/vanna/charm
  easily because it's an information thing".

  NOTHING HERE IS NEW MACHINERY, deliberately. The
  chart is the terminal's own StrikeChart (Pulse's
  and Terrain's); the book is `buildExposureProfile`
  — the same one the Strike Pressure Ladder widget
  reads — under the toolbar's expiry; the sentence
  is the same engine read the ladder card carries.
  The Map is a COMPOSITION: canvas first, settings
  as a toolbar, prose as the last resort, one
  strike everywhere.

  The strike a reader clicks on the board is THE
  strike (FocusContext): the chart draws it as the
  focus line, the shell wears it as the chip, and
  Targets lights it.
==================================================
*/

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { DOCK_ROOM } from '../../data/editorDock';
import { motion } from 'framer-motion';
import Simulator from '../../core/simulator';
import { useMarketData } from '../../context/MarketDataContext';
import { useFocus } from '../../context/FocusContext';
import ScopeChip from '../../components/ui/ScopeChip';
import StrikeChart, { DEFAULT_INDICATORS, DEFAULT_OVERLAYS, type ChartIndicators, type ChartOverlays, type ChartStyle, type PriceProjection } from '../../components/gex/StrikeChart';
import ChartToolbar from '../../components/gex/ChartToolbar';
import DropdownSelect, { type DropdownOption } from '../../components/ui/DropdownSelect';
import { Deferred } from '../../components/ui/Skeleton';
import { ChartGround } from '../../components/ui/skeletonKit';
import { BoardInner, DayInner, MapPageSkeleton, PositionsInner, ReportInner } from './pinpointSkeletons';
import GreekBoard from '../../components/gex/GreekBoard';
import TraderClock from '../../components/gex/TraderClock';
import WallReportCard from '../../components/gex/WallReportCard';
import ReplayStrip from '../../components/gex/ReplayStrip';
import { barsAt, barTimeAt, replayDay, replayMinute, replayRangeAt, snapPos, snapshotAt, type ReplayRange } from '../../data/replay';
import PositionsBook from '../../components/gex/PositionsBook';
import { ladderExpiryOptions, LadderPatternStrip } from '../../components/gex/ladderControls';
import { buildExposureProfile, type StrikeWindow } from '../../data/exposure';
import { GREEK_OPTIONS, type Greek } from '../../data/compare';
import { readHeatPattern } from '../../data/gex';
import { twinFamilyFor, twinLabel, twinPrice, twinBasis, fmtTwin, type TwinLensKey } from '../../data/indexTwins';
import type { Timeframe } from '../../data/timeframe';
import type { ExposureExpiry } from '../../types/gex';
import type { Candle, MarketSnapshot } from '../../types/market';
import { useOnScreen } from '../../components/ui/useOnScreen';

/** The book sweeps on its own cadence — the chart's trails must not vibrate with every tick. */
const SCAN_INTERVAL_MS = 10_000;
/* THE HEAD'S CHOICES, as dropdown cards with one plain line each (the approved
   Targets grammar, 2026-09-05). The chart's own controls — timeframes,
   Indicators, Alerts, Candles, fullscreen — come from ChartToolbar, the same
   head Pulse and Terrain wear, so the top of every chart reads the same. */
/* Spelled as dates on the market calendar (Noah, 2026-09-08) — one list with the desk's ladder */
const EXPIRY_OPTIONS: DropdownOption<ExposureExpiry>[] = ladderExpiryOptions();
/* THE GREEK is one pick now (2026-09-13): it chooses the chart's trails. The
   board under the map carries every greek at once, one panel each. */
const GREEK_DROP: DropdownOption<Greek>[] = GREEK_OPTIONS.map(g => ({ value: g.value, label: g.label, hint: g.hint }));
/* THE WINDOW IS THE WHOLE BOOK (Noah, 2026-09-05): thirty strikes each side
   are built once; the chart draws whatever of them it has on screen. */
const WINDOW: StrikeWindow = 30;
/** The Map owns its first screen: the top bar, the shell's head (2026-09-09:
    the house head) and the page's padding — and the board under it takes a
    screen of its own */
const MAP_H = 'calc(100vh - 184px)';

/*
  EACH BOX CAN HOLD ITS OWN NAME (Noah, 2026-09-06: "i should be able to change
  tickers on each singular section as i please … they should all start off as
  one"). The scoping rule, box by box: a box FOLLOWS the frame's name until its
  chip unlinks it, then it reads its own snapshot (the simulator's pure read,
  refreshed on the scan cadence) and its chip wears the name. Held across route
  changes within a session and reset on reload, so every visit starts as one.
  The board's panels carry their own chips (GreekBoard).
*/
type BoxKey = 'map' | 'day' | 'report';
type Scopes = Partial<Record<BoxKey, string>>;
let scopesMemory: Scopes = {};

const MapDesk = () => {
  const { marketData, flowTape, activeTicker, changeTicker } = useMarketData();
  const { focus, focusOn } = useFocus();

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

  /* The chart folds in the newest bar on every tick — the same counter Terrain keeps */
  const revRef = useRef(0);
  const revision = useMemo(() => ++revRef.current, [marketData]);

  /* THE TOOLBAR'S STATE — the book's lens */
  const [expiry, setExpiry] = useState<ExposureExpiry>('0DTE');
  const [greek, setGreek] = useState<Greek>('gex');
  /* 15m FIRST (Noah, 2026-09-06, the screenshot he sent: "i want this to be
     the first view a person sees when they enter the page") — the whole
     session on the tape; 1m is one click away on the head. */
  const [timeframe, setTimeframe] = useState<Timeframe>('15m');
  const [lens, setLens] = useState<TwinLensKey>('etf');
  /* The chart's own settings, owned by the shared head (ChartToolbar) */
  const [overlays, setOverlays] = useState<ChartOverlays>(DEFAULT_OVERLAYS);
  const [chartStyle, setChartStyle] = useState<ChartStyle>('candles');
  const [indicators, setIndicators] = useState<ChartIndicators>(DEFAULT_INDICATORS);
  /* Draw mode on the chart — the rail's tools arm it, Esc or Done leaves it */
  const [drawing, setDrawing] = useState(false);
  /* FULLSCREEN IS THE SAME BOX, MOVED — not a second copy in a portal. One
     body, one chart: the box animates between its place in the page and the
     whole viewport (framer `layout`), so the chart stays mounted and nothing
     jumps or vanishes. */
  const [full, setFull] = useState(false);
  const close = () => setFull(false);
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => {
      // A modal over the takeover took the key already (Modal marks it)
      if (e.key === 'Escape' && !e.defaultPrevented) setFull(false);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [full]);

  /* REPLAY (2026-09-08): one position on today's session — seconds from the
     open — and every box that follows the frame reads the book as it stood
     then (data/replay.ts). The strip under the head is the transport; the
     chart's own replay follows the same clock; the frame grid is five
     seconds, so the bars turn rather than step. Esc, a name change, or
     "Back to live" ends it. Boxes pinned to another name stay live. */
  const [replay, setReplay] = useState<{ phase: 'pick' } | { phase: 'play'; range: ReplayRange; pos: number; playing: boolean; pace: number } | null>(null);
  const replayOn = replay != null;
  const playing = replay?.phase === 'play' ? replay : null;

  /* Scan-tier snapshot: the book sweeps every SCAN_INTERVAL_MS (a name change is immediate) */
  const [scan, setScan] = useState<MarketSnapshot | null>(null);
  const scanRef = useRef<MarketSnapshot | null>(null);
  const scanAtRef = useRef(0);
  useEffect(() => {
    if (!marketData) return;
    const now = Date.now();
    const due = !scanRef.current || now - scanAtRef.current >= SCAN_INTERVAL_MS || scanRef.current.ticker !== marketData.ticker;
    if (due) {
      scanRef.current = marketData;
      scanAtRef.current = now;
      setScan(marketData);
    }
  }, [marketData]);

  /* THE OWN-NAME SNAPSHOTS — one per name a box has stepped onto, rebuilt on
     the scan cadence like the frame's own. A pure read of the simulator. */
  const pinnedKey = [scopes.map, scopes.day, scopes.report].filter(Boolean).join('|');
  const ownSnaps = useMemo(() => {
    const m = new Map<string, MarketSnapshot>();
    if (!scan || !pinnedKey) return m;
    for (const t of new Set(pinnedKey.split('|'))) {
      if (t === scan.ticker) continue;
      try {
        m.set(t, Simulator.snapshotFor(t));
      } catch {
        /* a name the sim can't build — the box stays on the frame's */
      }
    }
    return m;
  }, [scan, pinnedKey]);
  /* WHILE PICKING, only the line moves (2026-09-11): the book rewinds once a
     bar is picked, the way the other charts' replays do. */
  const moment = playing ? { range: playing.range, pos: playing.pos } : null;
  const range = moment?.range ?? null;
  const framePos = moment && range ? snapPos(moment.pos, range.length) : 0;
  const replaySnap = useMemo(() => (range && scan ? snapshotAt(scan, range, framePos) : null), [range, scan, framePos]);
  /* THE MINUTE GRID for the boxes under the map (2026-09-11): the board, the
     clock and the report read the book once per replayed minute — their
     surfaces are the page's heaviest. The chart keeps the five-second grid. */
  const minutePos = Math.floor(framePos / 60) * 60;
  const replaySnapMinute = useMemo(() => (range && scan ? snapshotAt(scan, range, minutePos) : null), [range, scan, minutePos]);
  const replayBars = useMemo(() => (range ? barsAt(range, minutePos) : undefined), [range, minutePos]);
  useEffect(() => {
    if (!playing?.playing || !range) return;
    const id = window.setInterval(() => {
      setReplay(r => {
        if (!r || r.phase !== 'play' || !r.playing) return r;
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
  /* Replay opens on the PICK: the chart's cursor turns silver and the bar you
     click is the minute the replay starts from, paused (the TradingView way) */
  const toggleReplay = () => setReplay(r => (r ? null : { phase: 'pick' }));
  const pickTime = (time: number) => {
    if (!scan) return;
    const at = replayRangeAt(scan.ticker, time);
    if (!at) return;
    setReplay({ phase: 'play', range: at.range, pos: at.pos, playing: false, pace: 60 });
  };

  /** The snapshot a box reads: the frame's (rewound while replaying — the map on
      the five-second grid, the boxes under it on the minute), or its own */
  const snapFor = (key: BoxKey | 'board'): MarketSnapshot | null => {
    if (!scan) return null;
    const t = key === 'board' ? undefined : scopes[key];
    if (!t || t === scan.ticker) return (key === 'map' ? replaySnap : replaySnapMinute) ?? scan;
    return ownSnaps.get(t) ?? scan;
  };
  /* A BOX NOBODY SEES HOLDS STILL while the replay runs (2026-09-11): the
     board, the clock and the report sit under the map — below the fold, or
     behind the fullscreen chart — and rebuilding them on every replayed minute
     was the frame the chart stuttered on. Off screen, a box keeps the moment
     it last showed; scrolled into view, it catches up on its next render. */
  const [boardRef, boardOn] = useOnScreen<HTMLDivElement>();
  const [dayRef, dayOn] = useOnScreen<HTMLDivElement>();
  const [reportRef, reportOn] = useOnScreen<HTMLDivElement>();
  const heldRef = useRef<{ board: MarketSnapshot | null; day: MarketSnapshot | null; report: MarketSnapshot | null; bars: Candle[] | undefined }>({ board: null, day: null, report: null, bars: undefined });
  const shown = (key: 'board' | 'day' | 'report', on: boolean): MarketSnapshot | null => {
    const fresh = snapFor(key);
    if (!replayOn || on || !heldRef.current[key]) heldRef.current[key] = fresh;
    return heldRef.current[key];
  };
  /* Fullscreen lays the map over the whole viewport — the boxes under it are
     still "in" the viewport to an observer, but nobody sees them. And what
     they do read arrives DEFERRED: React renders the map's frame first and
     the boxes' rebuild in a later, interruptible pass. */
  const mapSnap = snapFor('map');
  const boardSnap = useDeferredValue(shown('board', boardOn && !full));
  const daySnap = useDeferredValue(shown('day', dayOn && !full));
  const reportSnap = useDeferredValue(shown('report', reportOn && !full));
  if (!replayOn || (reportOn && !full) || !heldRef.current.bars) heldRef.current.bars = replayBars;
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

  /* THE BOOK under the toolbar's lens — the ladder widget's own builder */
  const data = useMemo(() => {
    if (!mapSnap) return null;
    try {
      return buildExposureProfile(mapSnap, expiry, WINDOW);
    } catch {
      return null;
    }
  }, [mapSnap, expiry]);

  /* The sentence — the engine's read of the book, in the lens's own prices */
  const fam = mapSnap ? twinFamilyFor(mapSnap.ticker) : null;
  const activeLens: TwinLensKey = fam ? lens : 'etf';
  const pattern = useMemo(() => {
    if (!data) return null;
    const { levels } = data;
    if (!fam || activeLens === 'etf') return readHeatPattern(levels);
    const c = (v: number) => twinPrice(fam, activeLens, v, levels.spot);
    return readHeatPattern({ spot: c(levels.spot), flip: c(levels.flip), callWall: c(levels.callWall), putWall: c(levels.putWall), supreme: c(levels.supreme) });
  }, [data, fam, activeLens]);

  /* Where the chart puts a price — kept for the chart's own readers */
  const projectionRef = useRef<PriceProjection | null>(null);
  const ticker = mapSnap?.ticker ?? activeTicker;
  const focusPrice = focusFor(ticker);
  const dayTicker = daySnap?.ticker ?? ticker;
  const reportTicker = reportSnap?.ticker ?? ticker;

  /* The page stands in as its own boxes while the first read walks in
     (Noah, 2026-09-08: a stock skeleton "doesn't take the shape of its
     container") — the same shapes the route's fallback and the deferred
     mounts use, so nothing on the page moves when the map lands. */
  if (!scan || !mapSnap || !data) return <MapPageSkeleton />;

  const body = (isFull: boolean) => (
    <div className="flex flex-col h-full min-h-0" data-map>
      {/* THE HEAD — one thin line over the chart. Left: the map's scope chip.
          Right: the chart's own head, the same ChartToolbar Pulse and Terrain
          wear (timeframes, Indicators, Alerts, Candles, fullscreen). */}
      <div className="shrink-0 flex items-center gap-2 flex-wrap px-2 py-1.5 bg-panel border-b border-borderSubtle/70" data-map-toolbar>
        <span data-map-scope>{chipFor('map', ticker)}</span>
        <div className="flex-1 min-w-0">
          <ChartToolbar
            minimal
            candles
            spread
            timeframe={timeframe}
            onTimeframe={setTimeframe}
            overlays={overlays}
            onOverlays={setOverlays}
            chartStyle={chartStyle}
            onChartStyle={setChartStyle}
            indicators={indicators}
            onIndicators={setIndicators}
            paneId="pinpoint:map"
            alertTicker={ticker}
            alertSpot={data.levels.spot}
            fullscreen={isFull}
            onToggleFullscreen={() => (isFull ? close() : setFull(true))}
            replay={replayOn}
            onToggleReplay={toggleReplay}
          />
        </div>
      </div>
      {/* THE REPLAY STRIP — "select a bar" first, then the transport, while the page is rewound */}
      {replay && (
        <ReplayStrip
          phase={replay.phase}
          pos={playing?.pos ?? 0}
          length={range?.length ?? 0}
          day={range ? replayDay(range) : undefined}
          playing={playing?.playing ?? false}
          onPlay={p => setReplay(r => (r && r.phase === 'play' ? { ...r, playing: p } : r))}
          pace={playing?.pace ?? 60}
          onPace={pace => setReplay(r => (r && r.phase === 'play' ? { ...r, pace } : r))}
          onSeek={pos => setReplay(r => (r && r.phase === 'play' ? { ...r, pos } : r))}
          onExit={() => setReplay(null)}
        />
      )}
      {/* THE SENTENCE ROW — the one line of prose the page keeps, with the
          instrument whose prices it prints right after it, and at the far
          right the two choices that shape the levels and the trails (Expiry ·
          Greek). */}
      {pattern && (
        <LadderPatternStrip
          pattern={pattern}
          after={
            fam ? (
              <span role="group" aria-label="Prices in" className="shrink-0 inline-flex items-center gap-1.5 ml-1" data-instrument>
                <span className="text-[10px] text-textMuted">prices in</span>
                <span className="inline-flex h-6 rounded-full border border-borderSubtle p-[2px] gap-[2px]">
                  {(['etf', 'index', 'futures'] as TwinLensKey[]).map(k => (
                    <button
                      key={k}
                      aria-pressed={activeLens === k}
                      onClick={() => setLens(k)}
                      title={k === 'etf' ? 'Prices as the fund trades' : k === 'index' ? `Prices as the index, ${fam.index}` : `Prices as the futures, ${fam.futures} ${fmtTwin(twinPrice(fam, 'futures', data.levels.spot, data.levels.spot))} — ${fmtTwin(twinBasis(fam, data.levels.spot))} over ${fam.index}`}
                      className="px-2 rounded-full text-[10px] font-medium transition-colors"
                      style={activeLens === k ? { background: 'rgb(var(--silver-fill))', color: '#0a0a0a' } : { color: 'rgb(var(--text-secondary))' }}
                    >
                      {twinLabel(fam, k)}
                    </button>
                  ))}
                </span>
              </span>
            ) : null
          }
          right={
            <span className="inline-flex items-center gap-2" data-axis-controls>
              <DropdownSelect label="Expiry" value={expiry} options={EXPIRY_OPTIONS} onChange={setExpiry} title="Which contracts the levels are read from" testId="expiry" align="end" />
              <DropdownSelect label="Greek" value={greek} options={GREEK_DROP} onChange={setGreek} title="Which greek the chart's trails follow" testId="greek" align="end" />
            </span>
          }
        />
      )}
      {/* THE MAP — the tape, the whole box */}
      {/* A dark island on any page (2026-09-12): the tape reads the dark tokens */}
      <div className="relative flex-1 min-h-0 flex bg-panel" data-theme="dark">
        <div className="relative flex-1 min-w-0" key={ticker}>
          {/* The chart mounts a frame after the page paints, behind its skeleton
              (2026-09-06, the perf sweep) */}
          <Deferred fallback={<ChartGround axis={74} />} className="h-full animate-fade-in">
            <StrikeChart
              ticker={ticker}
              paneId="pinpoint:map"
              revision={revision}
              /* The tape is the frame's name's — a box on another name draws none */
              flowPrints={ticker === activeTicker ? flowTape : []}
              levels={data.levels}
              timeframe={timeframe}
              overlays={overlays}
              chartStyle={chartStyle}
              indicators={indicators}
              focusPrice={focusPrice}
              projectionRef={projectionRef}
              height={isFull ? 600 : 420}
              railTopOk={isFull}
              priceTag
              frameless
              /* THE DRAWING TOOLS, wired like Pulse's chart (2026-09-06) —
                 drawings are saved per name and every chart of that name
                 draws them */
              drawing={drawing}
              onEnterDraw={() => setDrawing(true)}
              onExitDraw={() => setDrawing(false)}
              /* The chart's replay on the Map's clock — one scrubber for the page;
                 first the pick, the bar you click being the minute it starts from */
              replay={replay?.phase === 'play'}
              replayTime={playing && range ? barTimeAt(range, framePos) : null}
              onExitReplay={() => setReplay(null)}
              pickTime={replay?.phase === 'pick'}
              onPickTime={pickTime}
              /* The trails read the Greek the head picks (2026-09-06, Noah: "if
                 gex is changed to dex then the exposure should change") */
              trailsGreek={greek === 'vanna' || greek === 'charm' ? 'gex' : greek}
            />
          </Deferred>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <motion.div
        layout
        /* Measure for the layout move ONLY when the box moves (fullscreen on or
           off) — by default framer re-measures on every render, a forced layout
           of the whole page on each tick and each replay frame (2026-09-11) */
        layoutDependency={full}
        transition={{ layout: { duration: 0.32, ease: [0.16, 1, 0.3, 1] } }}
        data-map-box
        data-full={full ? 'true' : 'false'}
        className={full ? 'fixed inset-0 z-[80] bg-panel flex flex-col' : 'relative border border-borderSubtle rounded-md overflow-hidden'}
        /* full: the script editor's dock takes the right edge while it is open (data/editorDock.ts) */
        style={full ? DOCK_ROOM : { height: MAP_H, minHeight: 560 }}
      >
        {body(full)}
      </motion.div>
      {/* BAND 3 — THE GREEK BOARD: the strikes under the map, up to five Net
          strips side by side, one greek each (2026-09-13). Each panel wears
          its own scope chip; the strike a panel pins is the same shared strike
          the chart lights. A screen of its own, so every row is readable. */}
      {/* The boxes under the map mount one per frame behind their skeletons
          (2026-09-06, the perf sweep) — they are below the fold, and building
          them inside the click was half the page's cost. */}
      <div ref={boardRef} className="border border-borderSubtle rounded-md overflow-hidden flex flex-col bg-panel" style={{ height: MAP_H, minHeight: 560 }} data-greek-board-box data-on-screen={boardOn}>
        <Deferred index={1} frames={22} fallback={<BoardInner />} className="h-full min-h-0 flex flex-col animate-fade-in">
          <GreekBoard snapshot={boardSnap ?? scan} frameTicker={activeTicker} onFrameTicker={changeTicker} revision={revision} timeframe={timeframe} expiry={expiry} />
        </Deferred>
      </div>
      {/* THE DAY — the two tools nobody ships (roadmap step 5, 2026-09-05):
          the Trader's Clock, today's hedging schedule with the book's figures
          in it, and the Wall Report Card, every level's record on today's
          tape. One box, two columns, the same strike shared. */}
      {/* No overflow clip here: the clock's hover card rises above the strip and a
          long phase sentence would be cut at the box's top edge */}
      <div ref={dayRef} className="border border-borderSubtle rounded-md bg-panel" data-day data-scope-ticker={dayTicker} data-on-screen={dayOn}>
        <Deferred index={2} frames={26} fallback={<DayInner />} className="animate-fade-in">
          <TraderClock snapshot={daySnap ?? scan} scope={chipFor('day', dayTicker)} at={moment && dayTicker === ticker ? replayMinute(framePos) : undefined} />
        </Deferred>
      </div>
      {/* HOW THE LEVELS HELD TODAY — full width, in the approved grammar: the
          page grows rather than cramming (Noah, 2026-09-05) */}
      <div ref={reportRef} className="border border-borderSubtle rounded-md overflow-hidden bg-panel" data-report data-scope-ticker={reportTicker} data-on-screen={reportOn}>
        <Deferred index={3} frames={30} fallback={<ReportInner />} className="animate-fade-in">
          <WallReportCard snapshot={reportSnap ?? scan} focus={focusFor(reportTicker)} onPick={price => focusOn(price, reportTicker)} scope={chipFor('report', reportTicker)} bars={moment && reportTicker === ticker ? reportBars : undefined} />
        </Deferred>
      </div>
      {/* YOUR POSITIONS — the book made personal (roadmap step 6): what this
          map means for the contracts you actually hold. The last question in
          the read, so the last box on the page. */}
      <div className="border border-borderSubtle rounded-md overflow-hidden bg-panel">
        <Deferred index={4} frames={34} fallback={<PositionsInner />} className="animate-fade-in">
          <PositionsBook profile={data} focus={focusPrice} onPick={price => focusOn(price, ticker)} />
        </Deferred>
      </div>
    </>
  );
};

export default MapDesk;
