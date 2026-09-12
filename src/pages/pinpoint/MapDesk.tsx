/*
==================================================
  SLAYER TERMINAL - THE MAP
  (pages/pinpoint/MapDesk.tsx)

  Band 2 of the Pinpoint roadmap (2026-09-05, the
  blank canvas): the day's chart with the dealer
  levels drawn on it, and the strike rail fused to
  its right edge AS THE PRICE AXIS — every strike a
  row at the height the chart puts that price, the
  exposure parked there as a bar, walls, pin and
  supreme tagged on their rows, spot and the flip
  cutting across as rules. One thin toolbar over
  both. One line under the toolbar: what the book
  says today. Nothing else on the page.

  NOTHING HERE IS NEW MACHINERY, deliberately. The
  chart is the terminal's own StrikeChart (Pulse's
  and Terrain's — untouched: a prop that handed the
  chart's own price scale to the rail was tried and
  reverted the same day, Noah: "change it back to two
  price columns"); it publishes where it
  puts a price (`PriceProjection`) and the rail is
  Terrain's PaneLadder, which places its rows by
  that projection in its own frame loop, so the two
  columns cannot disagree about a price. The book is
  `buildExposureProfile` — the same one the Strike
  Pressure Ladder widget reads — under the toolbar's
  expiry, greek and range. The sentence is the same
  engine read the ladder card carries. The Map is a
  COMPOSITION: canvas first, settings as a toolbar,
  prose as the last resort, one strike everywhere.

  The strike a reader clicks on the rail is THE
  strike (FocusContext): the chart draws it as the
  focus line, the shell wears it as the chip, and
  Targets lights it. The Calendar (the Exposure
  Ledger aligned under this map) is the next band.
==================================================
*/

import { useDeferredValue, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { DOCK_ROOM } from '../../data/editorDock';
import { SHARE_DEFAULT, SHARE_MAX, SHARE_MIN, setPanelShare, shareWidth, usePanelShare } from '../../data/mapPanelShare';
import { motion } from 'framer-motion';
import Simulator from '../../core/simulator';
import { useMarketData } from '../../context/MarketDataContext';
import { useFocus } from '../../context/FocusContext';
import ScopeChip from '../../components/ui/ScopeChip';
import StrikeChart, { DEFAULT_INDICATORS, DEFAULT_OVERLAYS, type ChartIndicators, type ChartOverlays, type ChartStyle, type PriceProjection } from '../../components/gex/StrikeChart';
import ChartToolbar from '../../components/gex/ChartToolbar';
import DropdownSelect, { type DropdownOption } from '../../components/ui/DropdownSelect';
import DropdownMulti from '../../components/ui/DropdownMulti';
import { GREEK_PICK_OPTIONS, nextGreekPick, pickGreeks } from '../../components/gex/exposureView';
import ProfilePanel, { LANE_OPTIONS, type ProfileLane } from '../../components/gex/ProfilePanel';
import ProfileGuide from '../../components/gex/ProfileGuide';
import GuideFocus from '../../components/ui/GuideFocus';
import { Deferred } from '../../components/ui/Skeleton';
import { ChartGround } from '../../components/ui/skeletonKit';
import { CalendarInner, DayInner, MapPageSkeleton, PositionsInner, ReportInner } from './pinpointSkeletons';
import ExposureField from '../../components/gex/ExposureField';
import TraderClock from '../../components/gex/TraderClock';
import WallReportCard from '../../components/gex/WallReportCard';
import ReplayStrip from '../../components/gex/ReplayStrip';
import { barsAt, barTimeAt, replayDay, replayMinute, replayRangeAt, snapPos, snapshotAt, type ReplayRange } from '../../data/replay';
import PositionGutter from '../../components/gex/PositionGutter';
import PositionsBook from '../../components/gex/PositionsBook';
import { readPosition, usePositions } from '../../data/positions';
import { buildHedgeFlowLadder } from '../../data/hedgeFlow';
import { ladderExpiryOptions, LadderPatternStrip } from '../../components/gex/ladderControls';
import { buildExposureProfile, type StrikeWindow } from '../../data/exposure';
import type { Greek as SurfaceGreek } from '../../data/exposureSurface';
import { GREEK_WORDS } from '../../data/compare';
import { readHeatPattern } from '../../data/gex';
import { twinFamilyFor, twinLabel, twinPrice, twinBasis, fmtTwin, type TwinLensKey } from '../../data/indexTwins';
import type { Timeframe } from '../../data/timeframe';
import type { ExposureExpiry } from '../../types/gex';
import type { Candle, GexLevel, MarketSnapshot } from '../../types/market';
import { useOnScreen } from '../../components/ui/useOnScreen';

/** The book sweeps on its own cadence — the rail's bars must not vibrate with every tick. */
const SCAN_INTERVAL_MS = 10_000;
type Greek = SurfaceGreek;
/* THE HEAD'S CHOICES, as dropdown cards with one plain line each (the approved
   Targets grammar, 2026-09-05). The chart's own controls — timeframes,
   Indicators, Alerts, Candles, fullscreen — come from ChartToolbar, the same
   head Pulse and Terrain wear, so the top of every chart reads the same. */
/* Spelled as dates on the market calendar (Noah, 2026-09-08) — one list with the desk's ladder */
const EXPIRY_OPTIONS: DropdownOption<ExposureExpiry>[] = ladderExpiryOptions();
/* THE PANEL'S LANES, as a dropdown card beside Expiry and Greek (2026-09-06:
   a pill group inside the panel's head ate its words at 1440) */
/* THE GREEKS ARE A MULTI PICK (Noah, 2026-09-10: "you can either choose 1 or 2
   or 3 or 4 or all") — the calendar draws every greek ticked; the panel's
   bars take the first of them. Options and rules in exposureView.ts. */
const GREEK_GROUPS = [{ title: 'What the bars and the calendar measure', options: GREEK_PICK_OPTIONS }];
/* THE WINDOW IS THE WHOLE BOOK (Noah, 2026-09-05: "the strikes literally doesn't
   move anything, is it dead weight?" — it was: the chart's own zoom decides
   which strikes the rail can show, so a hand-picked window only ever hid rows).
   Thirty strikes each side are built once; the rail and the curve draw whatever
   of them the chart has on screen. The Calendar keeps its own window control. */
const WINDOW: StrikeWindow = 30;
/* THE CUT (Noah, 2026-09-06, option C of the "Map Section Sources" page): the
   chart keeps ~58% of the box; the size rail and the forced-flow curve became
   ONE profile panel on the other ~42%, two lanes on the chart's own axis.
   THE SASH (Noah, 2026-09-12: "the chart width should be this default but
   changeable"): the reader drags the seam — the store, the default and the
   limits live in data/mapPanelShare.ts, shared with the page's skeleton. */
/** The Map owns its first screen: the shell above it is one row now (~130px with the top bar) */
/* The first screen: the top bar, the shell's head (2026-09-09: the house head,
   34px taller than the old row) and the page's padding — the Map ends where
   it ended before */
const MAP_H = 'calc(100vh - 184px)';

/*
  EACH BOX CAN HOLD ITS OWN NAME (Noah, 2026-09-06: "i should be able to change
  tickers on each singular section as i please … they should all start off as
  one"). The scoping rule, box by box: a box FOLLOWS the frame's name until its
  chip unlinks it, then it reads its own snapshot (the simulator's pure read,
  refreshed on the scan cadence) and its chip wears the name. Held across route
  changes within a session and reset on reload, so every visit starts as one.
*/
type BoxKey = 'map' | 'calendar' | 'day' | 'report';
type Scopes = Partial<Record<BoxKey, string>>;
let scopesMemory: Scopes = {};

const MapDesk = () => {
  const { marketData, flowTape, activeTicker, changeTicker } = useMarketData();
  const { focus, toggleFocus, focusOn } = useFocus();

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
  /* ONE LENS PER PAGE (Noah, 2026-09-08, "do the sync"): the toolbar's Greek
     and the calendar's Greek are the same choice — change it in either place
     and the ladder, the trails and the calendar all move. The calendar's
     "All" (the five greeks side by side) leaves the ladder on gamma. The flow
     lane never follows: only gamma turns a price move into forced trading. */
  const [greekPick, setGreekPick] = useState<string[]>(['gex']);
  const pickGreek = (next: string[]) => setGreekPick(nextGreekPick(greekPick, next));
  /** The panel's one greek — the first ticked (GEX when all five are) */
  const greek: Greek = pickGreeks(greekPick)[0] ?? 'gex';
  /* 15m FIRST (Noah, 2026-09-06, the screenshot he sent: "i want this to be
     the first view a person sees when they enter the page") — the whole
     session on the tape and the whole strike window on the panel; 1m is one
     click away on the head. */
  const [timeframe, setTimeframe] = useState<Timeframe>('15m');
  const [lens, setLens] = useState<TwinLensKey>('etf');
  /* The chart's own settings, owned by the shared head (ChartToolbar) */
  const [overlays, setOverlays] = useState<ChartOverlays>(DEFAULT_OVERLAYS);
  const [chartStyle, setChartStyle] = useState<ChartStyle>('candles');
  const [indicators, setIndicators] = useState<ChartIndicators>(DEFAULT_INDICATORS);
  /* Which lanes the profile panel shows — both by default, the Lanes card changes it */
  const [lane, setLane] = useState<ProfileLane>('both');
  /* THE SEAM between the chart and the panel — the panel's share of the box,
     the reader's, live while the sash is in hand and committed on release */
  const share = usePanelShare();
  const [dragShare, setDragShare] = useState<number | null>(null);
  const liveShare = dragShare ?? share;
  const boxRef = useRef<HTMLDivElement | null>(null);
  const onSashDown = (e: ReactPointerEvent<HTMLSpanElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const box = boxRef.current;
    if (!box) return;
    const startX = e.clientX;
    const startShare = liveShare;
    const boxW = Math.max(1, box.getBoundingClientRect().width);
    let last = startShare;
    const move = (ev: PointerEvent) => {
      /* dragging left gives the panel more of the box */
      last = Math.min(SHARE_MAX, Math.max(SHARE_MIN, startShare + (startX - ev.clientX) / boxW));
      setDragShare(last);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      setDragShare(null);
      setPanelShare(last);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
  };
  /* Draw mode on the chart — the rail's tools arm it, Esc or Done leaves it */
  const [drawing, setDrawing] = useState(false);
  /* THE GUIDE AS A FOCUS (Noah, 2026-09-06: "i dont like the placement and
     maybe a focus and blur effect on the how to read card would be great"):
     the card sits centred over the whole map box and everything behind it
     blurs and dims — the trader's clock's focus-and-blur, not a popover
     hanging off a button. Esc or a click on the blur lets go. */
  const [guideOpen, setGuideOpen] = useState(false);
  /* FULLSCREEN IS THE SAME BOX, MOVED — not a second copy in a portal. One
     body, one chart, one projection: the box animates between its place in
     the page and the whole viewport (framer `layout`), so the chart, the
     rail and the curve stay mounted and nothing jumps or vanishes (Noah,
     2026-09-05: the rail and the flow "disappeared" after fullscreen — two
     charts had shared one projection ref, and the leaving one nulled it). */
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
     seconds, so the capsules and the bars turn rather than step. Esc, a name
     change, or "Back to live" ends it. Boxes pinned to another name stay live. */
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
  const pinnedKey = [scopes.map, scopes.calendar, scopes.day, scopes.report].filter(Boolean).join('|');
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
  /* WHILE PICKING, only the line moves (2026-09-11 — Noah: "notice terrain
     and pulse they dont look laggy and it doesnt move the strikes throughout
     the vertical line process"). The page used to rewind under the pointer
     twelve times a second — the ladder, the curve, the calendar and the
     sentence all turning as the line swept — and read as lag. The book
     rewinds once a bar is picked, the way the other charts' replays do. */
  /* The session on hand for the replay, and the book at the position */
  const moment = playing ? { range: playing.range, pos: playing.pos } : null;
  const range = moment?.range ?? null;
  const framePos = moment && range ? snapPos(moment.pos, range.length) : 0;
  const replaySnap = useMemo(() => (range && scan ? snapshotAt(scan, range, framePos) : null), [range, scan, framePos]);
  /* THE MINUTE GRID for the boxes under the map (2026-09-11): the calendar,
     the clock and the report read the book once per replayed minute — their
     surfaces are the page's heaviest, and re-reading them on every
     five-second frame was the replay's stutter. The ladder and the chart keep
     the five-second grid, so the capsules still turn rather than step. */
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
  /** The calendar's copy of the transport — the heatmap under the chart carries
      the position too, and while a bar is being picked it says so (Noah:
      "where did the heatmap replay go?" — it had only appeared once playing) */
  const replayBar = replay ? (
    <ReplayStrip
      compact
      phase={replay.phase}
      pos={playing?.pos ?? 0}
      length={playing?.range.length ?? 0}
      day={playing ? replayDay(playing.range) : undefined}
      playing={playing?.playing ?? false}
      onPlay={p => setReplay(r => (r && r.phase === 'play' ? { ...r, playing: p } : r))}
      pace={playing?.pace ?? 60}
      onPace={pace => setReplay(r => (r && r.phase === 'play' ? { ...r, pace } : r))}
      onSeek={pos => setReplay(r => (r && r.phase === 'play' ? { ...r, pos } : r))}
      onExit={() => setReplay(null)}
    />
  ) : null;

  /** The snapshot a box reads: the frame's (rewound while replaying — the map on
      the five-second grid, the boxes under it on the minute), or its own */
  const snapFor = (key: BoxKey): MarketSnapshot | null => {
    if (!scan) return null;
    const t = scopes[key];
    if (!t || t === scan.ticker) return (key === 'map' ? replaySnap : replaySnapMinute) ?? scan;
    return ownSnaps.get(t) ?? scan;
  };
  /* A BOX NOBODY SEES HOLDS STILL while the replay runs (2026-09-11): the
     calendar, the clock and the report sit under the map — below the fold, or
     behind the fullscreen chart — and rebuilding them on every replayed minute
     was the frame the ladder stuttered on. Off screen, a box keeps the moment
     it last showed; scrolled into view, it catches up on its next render. */
  const [calRef, calOn] = useOnScreen<HTMLDivElement>();
  const [dayRef, dayOn] = useOnScreen<HTMLDivElement>();
  const [reportRef, reportOn] = useOnScreen<HTMLDivElement>();
  const heldRef = useRef<{ calendar: MarketSnapshot | null; day: MarketSnapshot | null; report: MarketSnapshot | null; bars: Candle[] | undefined }>({ calendar: null, day: null, report: null, bars: undefined });
  const shown = (key: 'calendar' | 'day' | 'report', on: boolean): MarketSnapshot | null => {
    const fresh = snapFor(key);
    if (!replayOn || on || !heldRef.current[key]) heldRef.current[key] = fresh;
    return heldRef.current[key];
  };
  /* Fullscreen lays the map over the whole viewport — the boxes under it are
     still "in" the viewport to an observer, but nobody sees them. And what
     they do read arrives DEFERRED: React renders the map's frame first and
     the boxes' rebuild in a later, interruptible pass, so a calendar in view
     no longer holds the ladder's easing for the length of its rebuild. */
  const mapSnap = snapFor('map');
  const calSnap = useDeferredValue(shown('calendar', calOn && !full));
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

  /* The rail's rows: every strike in the window, the chosen greek's net parked there.
     Ascending, the way the chain is kept; the rail places them by price anyway. */
  const rail = useMemo(() => {
    if (!data) return null;
    const rows: GexLevel[] = [...data.strikes].reverse().map(s => ({ strike: s.strike, value: s[greek].net }));
    let step = Infinity;
    for (let i = 1; i < rows.length; i++) step = Math.min(step, rows[i].strike - rows[i - 1].strike);
    return { rows, maxAbs: data.maxAbs[greek] || 1, step: Number.isFinite(step) && step > 0 ? step : 1 };
  }, [data, greek]);

  /* What a move to each strike forces dealers to trade — the flow ladder's rows,
     off the same lens the rail draws (roadmap: the Hedge Flow Forecast) */
  const flow = useMemo(() => (data ? buildHedgeFlowLadder(data) : null), [data]);

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

  /* Where the chart puts a price — handed to the rail, read in its frame loop */
  const projectionRef = useRef<PriceProjection | null>(null);
  const ticker = mapSnap?.ticker ?? activeTicker;
  const focusPrice = focusFor(ticker);
  const calTicker = calSnap?.ticker ?? ticker;
  const dayTicker = daySnap?.ticker ?? ticker;
  const reportTicker = reportSnap?.ticker ?? ticker;

  /* YOUR POSITIONS on this name (roadmap step 6): read against the 0DTE book
     the rail draws, once per scan; the gutter, the ledger's marks and the box
     all read the same map */
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

  /* The page stands in as its own five boxes while the first read walks in
     (Noah, 2026-09-08: a stock skeleton "doesn't take the shape of its
     container") — the same shapes the route's fallback and the deferred
     mounts use, so nothing on the page moves when the map lands. */
  if (!scan || !mapSnap || !data || !rail) return <MapPageSkeleton />;

  const body = (isFull: boolean) => (
    <div className="flex flex-col h-full min-h-0" data-map>
      {/* THE HEAD — one thin line over the chart and the rail. Left: what you
          are looking at, as dropdown cards (Expiry · Greek · Strikes ·
          Instrument) and the Forced-flow toggle. Right: the chart's own head,
          the same ChartToolbar Pulse and Terrain wear (timeframes, Indicators,
          Alerts, Candles, fullscreen), untouched. No chip rows (Noah,
          2026-09-05: "the charts up top selection … does not match"). */}
      <div className="shrink-0 flex items-center gap-2 flex-wrap px-2 py-1.5 bg-panel border-b border-borderSubtle/70" data-map-toolbar>
        {/* THE MAP'S SCOPE CHIP — follows the frame, or holds its own name; the
            rail, the curve, the sentence and your positions all read this box's
            name with it. */}
        <span data-map-scope>{chipFor('map', ticker)}</span>
        {/* The chart's own head — Pulse's and Terrain's, unchanged. The head is
            the chart's alone now; the choices that shape the RAIL and the CURVE
            sit on the sentence row, over the columns they change (Noah,
            2026-09-05: "the exp is all the way far left and the size and
            forced flow is all the way far right"). */}
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
          right, over the rail and the curve, the two choices that shape them
          (Expiry · Greek) and the curve's own switch. */}
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
              <DropdownSelect label="Expiry" value={expiry} options={EXPIRY_OPTIONS} onChange={setExpiry} title="Which contracts the rail weighs" testId="expiry" align="end" />
              <DropdownMulti label="Greek" values={greekPick} groups={GREEK_GROUPS} onChange={pickGreek} emptyWord="All" title="One, some, or all five" testId="greek" align="end" />
              <DropdownSelect label="Lanes" value={lane} options={LANE_OPTIONS} onChange={setLane} title="What the panel draws" testId="lanes" align="end" />
            </span>
          }
        />
      )}
      {/* THE MAP — the tape, and the rail as its price axis */}
      {/* A dark island on any page (2026-09-12): the tape, the rail and the curve read the dark tokens */}
      <div ref={boxRef} className="relative flex-1 min-h-0 flex bg-panel" data-theme="dark">
        <div className="relative flex-1 min-w-0" key={ticker}>
          {/* The chart mounts a frame after the page paints, behind its skeleton
              (2026-09-06, the perf sweep); the panel beside it waits for the
              chart's projection and draws the moment it exists. */}
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
              /* THE DRAWING TOOLS, wired like Pulse's chart (2026-09-06, Noah:
                 "where is the toolbar in the chart i see some random fib chart
                 but cant remove it") — drawings are saved per name and every
                 chart of that name draws them, but without these the Map had
                 no rail and a click on a mark could not wake the editor. */
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
              /* The trails read the same Greek the panel and the ledger do
                 (2026-09-06, Noah: "if gex is changed to dex then the
                 exposure should change") */
              trailsGreek={greek === 'vanna' || greek === 'charm' ? 'gex' : greek}
            />
          </Deferred>
        </div>
        {/* THE AXIS COLUMNS — your contracts, the rail, the flow curve. Keyed on
            the head's choices so a change of lens FADES the new column in
            instead of snapping (Noah: "a smooth transition between changes,
            not a jump"). The chart beside them never remounts. */}
        <div key={`${expiry}-${greek}`} className="relative flex shrink-0 animate-fade-in" style={{ width: shareWidth(liveShare) }} data-axis-columns>
          {/* THE SASH on the seam: invisible until the pointer finds it, like
              every sash on the desk; drag left for more panel, right for more
              chart, double-click for the 42% cut */}
          <span
            onPointerDown={onSashDown}
            onDoubleClick={() => setPanelShare(SHARE_DEFAULT)}
            role="separator"
            aria-orientation="vertical"
            aria-label="Drag to give the chart or the panel more room — double-click to reset"
            title="Drag to resize · double-click to reset"
            className="absolute left-0 inset-y-0 -ml-1 w-2 z-30 cursor-col-resize hover:bg-ink/[0.10] transition-colors"
            data-map-panel-grip
          />
          {/* Your contracts on the price axis — a chip per strike, at the chart's own y */}
          <PositionGutter positions={positions} reads={reads} projection={projectionRef} focusPrice={focusPrice} onSelect={price => toggleFocus(price, ticker)} />
          {/* THE PROFILE PANEL — the size at each strike and what a move there
              forces, two lanes on the chart's own axis, one drawing */}
          <ProfilePanel
            rows={rail.rows}
            maxAbs={rail.maxAbs}
            step={rail.step}
            levels={data.levels}
            flow={flow}
            lane={lane}
            onGuide={() => setGuideOpen(v => !v)}
            guideOpen={guideOpen}
            greek={greek.toUpperCase()}
            words={GREEK_WORDS[greek]}
            focusPrice={focusPrice}
            projection={projectionRef}
            onSelect={price => toggleFocus(price, ticker)}
          />
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
        {/* THE GUIDE IN FOCUS — over the whole box, the box blurred behind it */}
        <GuideFocus open={guideOpen} onClose={() => setGuideOpen(false)} title="How to read this panel" testId="profile-guide">
          <ProfileGuide rows={rail.rows} levels={data.levels} flow={flow} />
        </GuideFocus>
      </motion.div>
      {/* BAND 3 — THE CALENDAR: the same book by expiry, the Exposure Ledger
          under the map with its one-row toolbar (greek · expiries · strikes ·
          palette · Now | After the bell · the supreme door · fullscreen). The
          host names the book, so the ledger's head carries no name or search.
          The strike a capsule pins is the same shared strike the rail lights. */}
      {/* Each box below wears its own scope chip (2026-09-06): it follows the
          frame until unlinked, then reads its own name's book. */}
      {/* The boxes under the map mount one per frame behind their skeletons
          (2026-09-06, the perf sweep) — they are below the fold, and building
          them inside the click was half the page's cost. */}
      {/* 870px = the whole default window (±20 strikes at the ledger's 18px
          floor) with the toolbar and the read line, no scrolling — the lock
          walk's first fix (Noah, 2026-09-09: "the heatmap length is a bit
          short so make it taller"; at 600 only 25 of the 40 rows showed) */}
      <div ref={calRef} className="border border-borderSubtle rounded-md overflow-hidden h-[870px] flex flex-col" data-calendar data-scope-ticker={calTicker} data-on-screen={calOn}>
        <Deferred index={1} frames={22} fallback={<CalendarInner />} className="h-full min-h-0 flex flex-col animate-fade-in">
          <ExposureField
            snapshot={calSnap ?? scan}
            toolbar="band"
            lead={chipFor('calendar', calTicker)}
            greeks={greekPick}
            onGreeks={setGreekPick}
            fullMode="move"
            fresh={replayOn && calTicker === ticker}
            after={calTicker === ticker ? replayBar : undefined}
            selectedStrike={focusFor(calTicker)}
            marks={calTicker === ticker ? marks : undefined}
            onSelectStrike={price => toggleFocus(price, calTicker)}
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
        <Deferred index={2} frames={26} fallback={<DayInner />} className="animate-fade-in">
          <TraderClock snapshot={daySnap ?? scan} scope={chipFor('day', dayTicker)} at={moment && dayTicker === ticker ? replayMinute(framePos) : undefined} />
        </Deferred>
      </div>
      {/* HOW THE LEVELS HELD TODAY — full width, in the approved grammar: the
          page grows rather than cramming (Noah, 2026-09-05) */}
      <div ref={reportRef} className="border border-borderSubtle rounded-md overflow-hidden bg-panel" data-report data-scope-ticker={reportTicker} data-on-screen={reportOn}>
        <Deferred index={3} frames={30} fallback={<ReportInner />} className="animate-fade-in">
          <WallReportCard snapshot={reportSnap ?? scan} focus={focusFor(reportTicker)} onPick={price => toggleFocus(price, reportTicker)} scope={chipFor('report', reportTicker)} bars={moment && reportTicker === ticker ? reportBars : undefined} />
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
