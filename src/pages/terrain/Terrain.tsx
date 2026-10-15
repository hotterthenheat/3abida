import { isoDayLabel, num, numSigned, pctSigned, usd, usdCompact, usdCompactSigned, usdSigned } from '../../core/format';
import PaneHead, { type JumpSpan, type WindowValue } from '../../components/terrain/PaneHead';
import DecisionStrip, { type DecisionBox } from '../../components/terrain/DecisionStrip';
import CrosshairReadout from '../../components/terrain/CrosshairReadout';
import { liveWithinMs, paneAgeOf, type PaneAge } from '../../components/terrain/paneAge';
import type { ToolbarPart } from '../../components/gex/ChartToolbar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Code2, ExternalLink, Maximize2, Minimize2, Rows3, X } from 'lucide-react';
import { DOCK_ROOM, openEditor } from '../../data/editorDock';
import Simulator from '../../core/simulator';
import { useFlowTape, useTickSeq } from '../../context/MarketDataContext';
import { isLinkGroup, setLinkGroup, useLinkGroups, type LinkGroup } from '../../context/marketStore';
import LinkGroupChip from '../../components/link/LinkGroupChip';
import DistanceUnitPicker from '../../components/ui/DistanceUnitPicker';
import { futuresPhaseAt, FUTURES_PHASE_WORDS } from '../../core/calendar';
import {
  deleteNamedLayout, loadNamedLayouts, persistNamedLayouts, saveNamedLayout,
  MAX_NAMED_LAYOUTS, type NamedLayoutEntry,
} from './layouts';
import { buildLadderFor, buildLevelsFor, buildPrints, fmtUsd, spotChangePct } from '../../data/gex';
import { pickFlip, pickWalls } from '../../core/walls';
import { priceKey, useFeedPrice } from '../../data/feed/price';
import { refreshFeed } from '../../data/feed/poll';
import { uwSpotGexByStrike } from '../../data/feed/uw';
import { nyClock as nyClockAt, clock as printClock, marketClock, nyIsoDate, nyMinutes, nyParts, nySessionPhase, nyWallTime } from '../../core/nyTime';
import { registerDepthState } from '../../dev/depthTrap';
import { GTH_END_MIN, GTH_START_MIN, RTH_OPEN_MIN, fieldDayOf, fieldSessionAt, indexPrintsAt, isTradingIso, tradesAllSessions } from '../../core/sessions';
import { overnightSourceOf } from '../../data/feed/optionsPrice';
import { readoutOf, remLines, SESSION_MINUTES, shareBetween, sigmasAway, sigmaRemOf, type SigmaRem } from '../../data/feed/pricedMove';
import { bookSureness, type Sureness } from '../../data/levelSureness';
import { buildExposureSurface, CALENDAR_DTES } from '../../data/exposureSurface';
import { expiryFor } from '../../core/calendar';
import ExpiryCard, { type ExpiryChoice } from '../../components/ui/ExpiryCard';
import StrikeChart, {
  AXIS_CHIPS_SCALE_MIN_WIDTH,
  DEFAULT_INDICATORS,
  DEFAULT_OVERLAYS,
  type ChartIndicators,
  type ChartOverlays,
  type ChartStyle,
  priceScaleLockedBy,
  PRICE_SCALES,
  useRailLeftInset,
  type CrosshairBar,
  type CompareEntry,
  type CompareMode,
  type CrosshairSync,
  type PriceProjection,
  type PriceScale,
  type ChartTape,
} from '../../components/gex/StrikeChart';
import type { BeadLegend } from '../../components/gex/gexNodesPrimitive';
import { BASIS_HINT, BASIS_LABEL, FLOORS, beadLegendLines, beadLegendWords } from '../../components/terrain/beadLegend';

/** The column the bead legend's whole words take in two lines (its key ~470 px, then the full size and basis); under it
    the short form */
const LEGEND_FULL_MIN_PX = 480;
/** A legend swatch: an oval in a node's ink, with the darker outline the nodes wear (the orbs message, item 12) */
const LegendSwatch = ({ rgb }: { rgb: readonly [number, number, number] }) => (
  <span aria-hidden className="inline-block w-[7px] h-[9px] rounded-[50%] align-[-1px] mr-1 shrink-0" style={{ background: `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`, boxShadow: `inset 0 0 0 1px rgb(${Math.round(rgb[0] * 0.6)},${Math.round(rgb[1] * 0.6)},${Math.round(rgb[2] * 0.6)})` }} data-legend-swatch />
);
import LevelAlertMenu from '../../components/terrain/LevelAlertMenu';
import { outcomesOf, useLevelLog } from '../../data/levelAlerts';
import type { ScaleBasis } from '../../data/feed/beadScale';
import ChartToolbar from '../../components/gex/ChartToolbar';
import { useFadeClose } from '../../components/ui/useFadeClose';
import CompareControl from '../../components/gex/CompareControl';
import ProfilePanel, { PALETTE_OPTIONS, PROFILE_MIN_W, profileRestWidth, type ProfileLane, type ProfilePalette } from '../../components/gex/ProfilePanel';
import DropdownSelect from '../../components/ui/DropdownSelect';
import { netSinceOpenRatio } from '../../data/levelview';
import ProfileGuide from '../../components/gex/ProfileGuide';
import GuideFocus from '../../components/ui/GuideFocus';
import { buildFlowFromRows } from '../../data/hedgeFlow';
import useFocusTrap from '../../components/ui/useFocusTrap';
import { layerOpen, useEscapeLayer } from '../../components/ui/layers';
import { useIsBelowLg, useIsPhone } from '../../components/ui/useMediaQuery';
import ScopeChip from '../../components/ui/ScopeChip';
import { ChartSkeleton, Deferred } from '../../components/ui/Skeleton';
import SpotPrice from '../../components/gex/SpotPrice';
import { CANDLE_THEMES, chartGround, pageDefaultCandleKey, usePageDefaultCandleKey, type CandleThemeKey } from '../../components/gex/candleTheme';
import { TIMEFRAMES, tfMinutes, type Timeframe } from '../../data/timeframe';
import { TREND_GLYPH, buildConfluence, trendWords, type ConfluenceRow } from '../../data/confluence';
import { OPENING_RANGES, type OpeningRange } from '../../data/sessionLevels';
import { isBarClock } from '../../data/altBars';
import {
  SETUP_KEYS, applySetup, captureSetup, evict, readSetups, symKey, type SetupMap,
} from './setups';
import { flipRing, stepSymbol, stepTf } from './paneKeys';
import TerrainLayers from '../../components/terrain/TerrainLayers';
import { openPopOut } from '../../components/layout/deskChannel';
import { WALLS_LENSES, type WallsLens } from '../../components/terrain/wallsHeatPrimitive';
import { useFeedTrailField, totalOf, straddlesAtMinute } from '../../data/feed/trailField';
import { econMacro, useFeedEcon } from '../../data/feed/news';
import {
  feedFreshness,
  feedOpenRatio,
  isCashIndex,
  listedDates,
  shortDay,
  sessionBefore,
  bookFrom,
  useFeedBars,
  useFeedBook,
  useFeedByExpiry,
  useFeedDaily,
  useFeedDarkLevels,
  useFeedEarnings,
  useFeedField,
  useServerField,
  useServerPastSessions,
  useFieldCoverage,
  coverageLine,
  useTrackRecord,
  useRegimeReference,
  usePricedMove,
  useFeedMaxPain,
  useFeedMoves,
  useFeedOi,
  useTerrainSource,
  type FeedBook,
  type FeedOi,
  type FeedStrike, useBeadScaleRefs, measuredBooks60, measuredBooks, pastSessionsOf, useReplaySessions, type PricedMoveFeed
} from '../../data/feed/levels';
import { loadTileRange, tileDay, tileHeld, tileSaid, useTileDaily, useTileSessions, type TileDay } from '../../data/feed/tileClient';
import { mergeByTime, TILE_WINDOWS, type TileTf } from '../../data/feed/tiles';
import { book60Window, driftEndOf, driftOf, netOf, ordinal, regimeForWindow, regimeReadOf, regimeSide, regimeWordsOf, sigmaOf, wallStateOn, WallStick, type ExpiryWindow, type RegimeRead, type WallShown } from '../../data/feed/trailModel';
import ReplayStrip from '../../components/gex/ReplayStrip';
import ReplayTools from '../../components/terrain/ReplayTools';
import { useTerrainReplay } from '../../components/terrain/useTerrainReplay';
import { laggedAt, sessionSpan, type ReplayFrame } from '../../data/replayFrame';
import { useFeedNamePrints } from '../../data/feed/trace';
import type { WallsSource } from '../../components/terrain/wallsHeatPrimitive';
import type { Candle, GexSnapshot } from '../../types/market';

/*
==================================================
  SLAYER TERMINAL - TERRAIN (pages/terrain/Terrain.tsx)

  Charts, and nothing else. One to four of them,
  filling the screen, and EACH ONE IS ITS OWN
  WORKSPACE — its own symbol, interval, overlays,
  indicators and tape shape.
==================================================

  THE PANES ARE INDEPENDENT (Noah, 2026-08-25: "each chart box should have
  its own time frame area, it's own everything because each is different from
  the other ones"). The first cut shared one rail across every pane, on the
  reasoning that a three-up read only means something if the panes agree. That
  was the wrong call for this desk and it is reversed here: the panes are
  three different instruments at three different resolutions, and the whole
  point of putting them side by side is that they are set up differently.

  So the only things left on the top rail are the two that belong to the
  ARRANGEMENT rather than to any chart: how many panes there are, and whether
  they carry their strike rail. Everything else lives in the pane.

  WHAT A PANE CARRIES, top to bottom:

      symbol · price · session change      identity
      interval + overlays + indicators     ChartToolbar, `minimal`
      the three heaviest strikes near      the book, in one line
      spot, signed
      the chart, and the panel beside it   StrikeChart + ProfilePanel
                                           (the Map's: size at each
                                           strike and what a move
                                           there forces, figures in
                                           the capsules and in the
                                           read line — 2026-09-08,
                                           in the old rail's place)

  IT TAKES THE WHOLE SCREEN. The shell wraps every page in horizontal padding,
  20px above and 64px below, then ends it with the site footer. A workspace
  wants none of that, so the margins are cancelled and the height is pinned to
  the viewport less the top bar — measured at 56px, not guessed. The footer
  still follows, below the fold, exactly as it does on every other page.
  Below `lg` all of it comes off: the panes stack, the height cap lifts, and
  the page scrolls, because four charts sharing one phone screen is four
  charts nobody can read.

  WHY IT IS NOT THE 4-WAY BOARD. /pulse/board is four cells with four
  toolbars, fixed at four, on a page that scrolls. Terrain is one to four
  panes that own the viewport, with a strike rail and named levels on the
  axis. They have converged on per-pane controls, which is the right answer
  for both; what still separates them is the arrangement and the density.
*/

const TERRAIN_KEY = 'slayer_terrain_v1';

/* `stepTf` and the symbol ring moved to ./paneKeys — pure, and therefore
   provable by `npm test`, which this file can never be: it imports
   StrikeChart, which imports the charting library. The clamp had been
   unasserted since it was written. */

/** How many panes are on screen. Four is the ceiling: at 1440 a fifth pane is
    260px wide, and a chart that narrow stops being a chart — the same finding
    that keeps the Pulse desk's widgets from going below their floor. */
export const LAYOUTS = [1, 2, 3, 4] as const;
export type TerrainLayout = (typeof LAYOUTS)[number];

/*
  Everything one pane owns. There is nothing else — a setting that is not here
  is a setting every pane shares, and only two of those exist.

  KEPT FLAT on purpose, even though five of these fields now also follow the
  SYMBOL (SETUP_KEYS in ./setups). A complete PaneCfg on disk means an older
  build — a rollback, or a tab still holding cached JS — reads the reader's
  setup instead of resetting every pane to 15m candles, and it costs nothing,
  because the whole config was already being stringified.

  `ticker` and `ladder` follow the SLOT, never the symbol; see ./setups for
  why the rail in particular has to.
*/
export interface PaneCfg {
  /** T-20 — the pane's link group, A–D and shell-wide since 2026-10-10 (context/marketStore.ts): panes, Pulse panels
      and the Weigher sharing a letter follow each other's SYMBOL changes; null stands alone. Not a setup key: linking
      is slot business, like the rail. */
  link?: LinkGroup | null;
  ticker: string;
  timeframe: Timeframe;
  overlays: ChartOverlays;
  indicators: ChartIndicators;
  chartStyle: ChartStyle;
  /** T-15 — the bar CLOCK: 'time', or a range/volume key from
      data/altBars.ts's BAR_CLOCKS. Rule bars fold the live seconds tape by
      rule instead of by the timeframe. Per SLOT like sessionOr: it is a way
      of reading a pane, not a fact about a symbol. */
  clock: string;
  /** Symbols crossed onto this pane's tape — the compare overlay. Per pane,
      like everything else here, and persisted with it. */
  compares: CompareEntry[];
  /** The main price axis's mode — linear, log, percent or indexed (T-7).
      Follows the SYMBOL, like the interval; see ./setups. */
  priceScale: PriceScale;
  /*
    Which opening range the session overlay draws — T-6.

    Per SLOT, not per symbol, and that is the opposite call from `timeframe`
    on purpose. Which opening range a reader watches is a METHOD — some read
    the first five minutes, some the first thirty — and a method does not
    change because they looked at a different name. The interval does: NVDA at
    1m and SPY at 15m is a normal pair of choices. Same reasoning as `ladder`.
  */
  sessionOr: OpeningRange;
  /** Whether this pane carries the strike rail down its right edge. Per pane
      too (Noah, 2026-08-25: "make sure the strike thing you added is
      removable") — the rail has its own × and the top button is a
      convenience that sets every pane at once, not the only way out. */
  ladder: boolean;
  /** The strike rail's width in px. Absent = the house default. */
  ladderW?: number;
  /** Which lanes the rail's panel draws — size, what a move forces, or both.
      Per SLOT like `ladder`: a way of reading a pane. 'size' by default,
      because the docked panel is 132px and two lanes want room. */
  lane: ProfileLane;
  /** This pane's candle theme (Noah, 2026-08-25: "if i change the theme for
      1 chart it should NOT change for all the others"). A SLOT field like
      the rail: the arrangement's look, not the symbol's memory. Ours, kept
      through the port — the partner tree paints every pane from one store.
      ABSENT = the pane has not been given one and wears THE PAGE'S DEFAULT
      (candleTheme.ts pageDefaultCandleKey: Glacier on the dark terminal, Stone on
      paper) — NOT the store's pick: the panes let go of their written 'glacier'
      (core/storedDefaults.ts) must stay Glacier on the dark terminal whatever the
      store holds there, or a light-theme change has moved the dark theme. A pane
      that is given a theme keeps it on both. */
  theme?: CandleThemeKey;
  /** Walls through the day's lens — gamma, charm or delta. A SLOT field, a way of reading a pane, like `lane`. */
  wallsLens?: WallsLens;
  /** THE BEAD SCALE (the owner's item 5): what full brightness is measured against — the session so far (absent: the
      default), a fixed 60-session reference, or the prior session's — and the floor, a share of it (absent: off) */
  beadBasis?: ScaleBasis;
  beadFloor?: number;
  /** BEAD DENSITY (the Terrain UI pass, 2026-10-14): absent, non-level strikes step back zoomed out and far from the
      price; false, every bead draws whole ("Every strike") */
  beadDensity?: boolean;
  /** THE BEAD LEGEND (the UI pass — the L key, the hover row's Legend door): false hides the legend's line */
  legend?: boolean;
}

interface TerrainCfg {
  layout: TerrainLayout;
  /** Always four, whatever the layout, so going 3 → 2 → 3 gives the third
      pane back exactly as it was rather than resetting it. */
  panes: PaneCfg[];
  /** How each symbol was last set up. Consulted ONLY when a symbol is newly
      picked — never re-applied to what is already on screen, or a reader's
      live pane would be rewritten under them by an old decision. */
  setups: SetupMap;
  /** The rails' colours — the thermal ramp or the house gold and ice — ONE choice
      for the desk (Noah, 2026-09-13: "let the page have both thermal and the house
      colours"): a colour that means one thing on one pane and another next door
      is a colour nobody can read. The card sits in the desk's own cluster. */
  palette: ProfilePalette;
  /** The reader's own pick of the rails' colours, kept since 2026-10-14 (the default is the house's; see defaults()) */
  rails?: ProfilePalette;
  /** WHICH CONTRACTS THE RAILS READ (Noah, 2026-09-16, on the partner's Expiry card: the rail
      summed the whole book, so a wall beside the live chart could be a monthly's) — ONE EXPIRY,
      picked on the calendar card in the rail's head (the book's real dates lit — Noah, later:
      "an actual calendar of the dates so a user doesn't feel forced to choose from three"), or
      the whole book; one choice for the desk, and the chart's walls, the header's heaviest line,
      the flow lane and the Net view follow it. */
  railCut: RailCut;
}

/** A calendar expiry's days-to-expiry, or the whole book */
export type RailCut = number | 'book' | WindowCut;
/* THE EXPIRY WINDOWS (the owner's item 6, 2026-10-14): 0DTE, to Friday, to monthly OPEX — on the feed, beside "All 60
   days" (the book: the field's 60 days, the ladder Unusual Whales' book on every expiry). The field, its flip and walls,
   the regime strip and the bead scale follow the window (data/feed/trailModel.ts windowView — every column carries its
   sums by expiry partition, so a switch asks nothing), and the ladder reads Unusual Whales' 60-day book through the
   same window. */
export type WindowCut = 'w:0dte' | 'w:fri' | 'w:opex';
const WINDOW_CUTS: readonly WindowCut[] = ['w:0dte', 'w:fri', 'w:opex'];
const isWindowCut = (c: unknown): c is WindowCut => typeof c === 'string' && (WINDOW_CUTS as readonly string[]).includes(c);
/** The field's window for a cut: a window's own, else every expiry the field holds */
const windowOfCut = (c: RailCut): ExpiryWindow => (isWindowCut(c) ? (c.slice(2) as ExpiryWindow) : 'all');
const WINDOW_CHOICES: ExpiryChoice<RailCut>[] = [
  { value: 'w:0dte', label: '0DTE', hint: "The contracts that settle the session's own day", date: null },
  { value: 'w:fri', label: 'To Friday', hint: 'Every expiry to the Friday of this week', date: null },
  { value: 'w:opex', label: 'To monthly OPEX', hint: "Every expiry to the month's third Friday (the next month's once it has passed)", date: null },
];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** The card's choices: the calendar's expiries as lit days (two horizons on one Friday are one
    day), the book as the foot pill — built at render, since the dates are today's */
const railCutChoices = (): ExpiryChoice<RailCut>[] => {
  const out: ExpiryChoice<RailCut>[] = [];
  const seen = new Set<string>();
  for (const dte of CALENDAR_DTES) {
    const e = expiryFor(dte);
    const key = e.date.toISOString().slice(0, 10);
    if (seen.has(key)) continue;
    seen.add(key);
    const day = `${MONTHS[e.date.getMonth()]} ${e.date.getDate()}`;
    out.push({ value: dte, label: dte === 0 ? `Today · ${day}` : day, hint: dte === 0 ? "The contracts that expire at today's bell" : `${e.sessions} sessions out`, date: e.date });
  }
  out.push({ value: 'book', label: 'All expiries', hint: 'Every expiry the name carries', date: null });
  return out;
};
type RailData = ReturnType<typeof buildLadderFor> & { levels: ReturnType<typeof buildLevelsFor>; legs: Map<number, { put: number; call: number }>; sure: Sureness[] };
/** The walls off a set of rows, the book's own rule (`buildLevelsFor`, core/walls.ts): the heaviest CALL-dominant strike
    above spot and PUT-dominant strike below it (the copy here took the heaviest either way, so a day's put-heavy strike
    overhead read as its call wall — 2026-10-10), the heaviest anywhere, the sign change nearest spot */
const levelsOf = (rows: { strike: number; value: number }[], spot: number): ReturnType<typeof buildLevelsFor> => {
  let supreme = spot;
  let supremeAbs = 0;
  for (const l of rows) {
    const a = Math.abs(l.value);
    if (a > supremeAbs) {
      supremeAbs = a;
      supreme = l.strike;
    }
  }
  const w = pickWalls(rows, spot, l => l.value);
  const flip = pickFlip(rows, spot, l => l.value);
  return { spot, callWall: w.callWall ?? spot, putWall: w.putWall ?? spot, flip: flip ?? spot, supreme };
};
/** HOW SURE THE RAIL'S WALLS AND FLIP ARE (data/levelSureness.ts — Pinpoint's read, the same book the rail drew) */
const sureOf = (rows: readonly { strike: number; value: number }[], spot: number, ticker: string): Sureness[] => {
  const all = bookSureness(rows.map(r => ({ strike: r.strike, netGex: r.value })), spot, ticker);
  return [all['call wall'], all['put wall'], all.flip];
};
/** The rail's shape off rows in DESCENDING strike order: the near-spot core, its scale, the step */
const railShape = (rows: { strike: number; value: number; callOI?: number }[], spot: number) => {
  const spotIdx = Math.max(0, rows.findIndex(s => s.strike <= spot));
  const core = rows.slice(Math.max(0, spotIdx - 10), spotIdx + 11);
  let maxAbs = 1;
  for (const r of core) maxAbs = Math.max(maxAbs, Math.abs(r.value));
  let step = Infinity;
  for (let i = 1; i < rows.length; i++) {
    const d = rows[i - 1].strike - rows[i].strike;
    if (d > 1e-9) step = Math.min(step, d);
  }
  if (!Number.isFinite(step) || step <= 0) step = 1;
  return { rows, core, maxAbs, spot, step };
};
/** The rail's rows, its near-spot core, its walls and its legs FOR A CUT. The book is the
    snapshot the rail has always drawn (summed across expiries); a date is that one expiry off
    the calendar's surface (one chain built, the same engine the Map's calendar reads, so a wall
    here is the wall the Map names for that day), the strike's open interest on one key so the
    rail's card prints it whole, the walls reduced by the book's own rule. */
function railForCut(ticker: string, cut: RailCut): RailData {
  /* the house's field has no expiry partitions: a window reads the whole book there */
  if (cut === 'book' || isWindowCut(cut)) {
    const base = buildLadderFor(ticker);
    const legs = new Map<number, { put: number; call: number }>();
    try {
      for (const n of Simulator.snapshotFor(ticker).chain) legs.set(n.strike, { put: n.putGex, call: n.callGex });
    } catch {
      /* no chain for this name yet — the net alone draws */
    }
    /* the whole book buildLevelsFor reduced, not the rail's window, so the read names the walls the rail marks */
    const snaps = Simulator.getGexHistory(Simulator.ensureTicker(ticker));
    const book = snaps?.[snaps.length - 1]?.levels ?? base.rows;
    return { ...base, levels: buildLevelsFor(ticker), legs, sure: sureOf(book, base.spot, ticker) };
  }
  const spot = Simulator.TICKERS[Simulator.ensureTicker(ticker)].currentPrice;
  const empty: RailData = { rows: [], core: [], maxAbs: 1, spot, step: 1, levels: { spot, callWall: spot, putWall: spot, flip: spot, supreme: spot }, legs: new Map(), sure: [] };
  /* THE FRONT STANDS FIRST, ALWAYS (found 2026-09-16 when the days would not move — Noah: "why do
     the net puts and calls only seem to change when I change the week and not the day?"): the
     surface takes its FIRST expiry for the front book and prices every later one off it — the
     Black-Scholes gamma at that expiry's time to the bell, scaled per strike to the front — so a
     surface built from the chosen date alone wore the front's legs whatever the date, and only
     the ticks moved the figures. Built from the front and the date, the date's own column is
     read; a date that is today's session dedupes to the front. */
  let surface: ReturnType<typeof buildExposureSurface> | null = null;
  try {
    surface = buildExposureSurface(Simulator.snapshotFor(ticker), 30, cut === 0 ? [0] : [0, cut]);
  } catch {
    surface = null;
  }
  if (!surface || surface.strikes.length === 0) return empty;
  const e = surface.expiries.length - 1;
  const put = surface.put.gex[e] ?? [];
  const call = surface.call.gex[e] ?? [];
  const net = surface.net.gex[e] ?? [];
  const oiRow = surface.oi[e] ?? [];
  const legs = new Map<number, { put: number; call: number }>();
  const asc = surface.strikes.map((strike, s) => {
    legs.set(strike, { put: put[s] ?? 0, call: call[s] ?? 0 });
    return { strike, value: net[s] ?? 0, callOI: oiRow[s] ?? 0 };
  });
  const rows = [...asc].reverse();
  return { ...railShape(rows, spot), levels: levelsOf(rows, spot), legs, sure: sureOf(asc, spot, ticker) };
}

/* ---- TERRAIN ON THE FEED (2026-10-12) ---------------------------------------------------------------------------
   With the room reading Unusual Whales (rooms.ts terrainSource) a pane reads the vendor's book for its name — the
   whole book or one listed date — and the real bars, and nothing of the house's: the ladder, the walls on the chart,
   the field and the candles are one market.
   THE SAME PANE, FILLED (the owner, 2026-10-12: "but i build the UI that the real data goes into"): every timeframe,
   overlay, compare, lane and switch the house's pane carries is here, read off the real inputs — UW's minutes (four
   sessions) over Theta Data's five weeks before them (Massive's until 2026-10-14); UW's day bars over Theta Data's two
   years (1D, 1W); range and volume
   bars folded from the minutes; the name's prints of $25K and up (the flow band, the net drift, the events lane's
   prints); its three largest dark crosses of the session; its next report off UW's record; the walls through the day
   and the open's ghost off the books this terminal read today; the Vol switch on the minutes; the alerts as the
   house's pane arms them. No plan carries seconds: 15 s stays, held, its title saying so. An index has no price bars
   on UW's plan (a CBOE grant): its chart says so in its own place and the ladder stands on the book (Theta Data carries
   index prices — drawing them is a step to come). */

/** The timeframes a pane on the feed holds, and why — the one control the rule lets stand disabled */
const FEED_HELD: Partial<Record<Timeframe, string>> = {
  '15s': 'No seconds on the feed here yet — the panes draw bars of a minute and up',
};
const EMPTY_BARS: Candle[] = [];
/* THE SESSIONS BEFORE TODAY, BY TIMEFRAME (Section I — "load by visible range plus a buffer"): the timeframe's tile, and
   how many sessions the view opens on — about what a pane shows at its opening zoom and the same again to its left; the
   left edge reaching the oldest asks the next block (the adjacent range, prefetched behind the view) */
const TILE_TF_OF: Partial<Record<Timeframe, TileTf>> = { '1m': 1, '5m': 5, '15m': 15, '30m': 30, '1h': 60 };
const TILE_SPAN: Record<number, number> = { 1: 3, 5: 10, 15: 25, 30: 40, 60: 60 };
/** The timeframes a switch reaches in one step from this one — prefetched behind the view */
const TILE_NEIGHBOURS: Record<number, TileTf[]> = { 1: [5], 5: [1, 15], 15: [5, 30], 30: [15, 60], 60: [30] };
const lastClose = (bars: readonly Candle[] | undefined): number => (bars && bars.length ? bars[bars.length - 1].close : NaN);
/** A price scale for a pane with no bars (an index on the feed): the book's strikes round the price, top to bottom of
    the box, so the ladder still stands on rows */
const bookProjection = (box: HTMLElement | null, lo: number, hi: number): PriceProjection => ({
  yFor: price => {
    const h = box?.clientHeight ?? 0;
    if (!(h > 0) || !(hi > lo)) return null;
    return ((hi - price) / (hi - lo)) * (h - 28);
  },
  plotHeight: () => Math.max(0, (box?.clientHeight ?? 0) - 28),
  axisHeight: () => 28,
});
const MS_DAY = 86_400_000;
const calDaysTo = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date();
  return Math.round((new Date(y, m - 1, d).getTime() - new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime()) / MS_DAY);
};
/** The expiry card's choices on the feed: UW's listed dates out to a quarter, then the whole book */
const feedCutChoices = (dates: string[]): ExpiryChoice<RailCut>[] => {
  const out: ExpiryChoice<RailCut>[] = [];
  for (const iso of dates) {
    const dte = calDaysTo(iso);
    if (dte < 0 || dte > 91) continue;
    const [y, m, d] = iso.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const day = `${MONTHS[date.getMonth()]} ${date.getDate()}`;
    out.push({ value: dte, label: dte === 0 ? `Today · ${day}` : day, hint: dte === 0 ? "The contracts that expire at today's bell" : `${dte} days out — a date Unusual Whales lists`, date });
  }
  out.push(...WINDOW_CHOICES, { value: 'book', label: 'All 60 days', hint: "The field: every expiry within 60 days. The ladder keeps Unusual Whales' book on every expiry.", date: null });
  return out;
};
/** The rail off the feed's rows (ascending, the house's sign) — the walls by the book's own rule, the open interest on
    one key for the card, how sure in the feed's words */
function feedRail(book: FeedBook, rowsAsc: readonly FeedStrike[], oi: FeedOi | null, whole: boolean, liveSpot: number | null = null): RailData {
  /* THE ONE CURRENT PRICE (the Terrain audit of 2026-10-13, item 1): the rail's quote stands as the ladder's spot — its
     band, Δ SPOT, the walls' and the flip's side — the book's own price (UW figured the hedging at it, the regular
     close after hours) says so in How sure, never as the price on screen */
  const spot = liveSpot != null && Number.isFinite(liveSpot) && liveSpot > 0 ? liveSpot : book.spot;
  const legs = new Map<number, { put: number; call: number }>();
  const asc = rowsAsc.map(r => {
    legs.set(r.strike, { put: r.gex.put, call: r.gex.call });
    const o = whole ? oi?.byStrike.get(r.strike) : undefined;
    return { strike: r.strike, value: r.gex.net, ...(o ? { callOI: o.call + o.put } : {}) };
  });
  const rows = [...asc].reverse();
  const fresh = feedFreshness(book, oi);
  const sure = bookSureness(asc.map(r => ({ strike: r.strike, netGex: r.value })), spot);
  return { ...railShape(rows, spot), levels: levelsOf(rows, spot), legs, sure: [sure['call wall'], sure['put wall'], sure.flip].map(x => ({ ...x, freshness: fresh })) };
}
const emptyRail = (spot: number): RailData => ({ rows: [], core: [], maxAbs: 1, spot, step: 1, levels: { spot, callWall: spot, putWall: spot, flip: spot, supreme: spot }, legs: new Map(), sure: [] });
/** THE RAIL AT A REPLAY'S CURSOR (the owner's item 8): the field's column at the minute — the modeled net per strike (the
    model keeps the net, so no put and call legs) — its walls and flip by the store's own summary (data/replayFrame.ts
    frameAt); a minute the field has no column for is an empty rail whose levels are "—", never the price */
function frameRail(f: ReplayFrame): RailData {
  const spot = f.spot;
  if (!f.column) return { rows: [], core: [], maxAbs: 1, spot, step: 1, levels: { spot, callWall: NaN, putWall: NaN, flip: NaN, supreme: NaN }, legs: new Map(), sure: [] };
  const asc = [...f.column.levels].sort((a, b) => a.strike - b.strike).map(l => ({ strike: l.strike, value: l.value }));
  const rows = [...asc].reverse();
  const sure = bookSureness(asc.map(r => ({ strike: r.strike, netGex: r.value })), spot);
  return {
    ...railShape(rows, spot),
    levels: { spot, callWall: f.cw ?? NaN, putWall: f.pw ?? NaN, flip: f.flip ?? NaN, supreme: f.top[0]?.[0] ?? NaN },
    legs: new Map(),
    sure: [sure['call wall'], sure['put wall'], sure.flip],
  };
}
const EMPTY_COLS: GexSnapshot[] = [];
/** The replay's paces (the owner's item 8): multiples of the market's own time, on the bar's 'seconds' unit — 60 is a
    minute of tape a second */
/** New York's minute of an epoch second */
const nyMinutesOf = (t: number): number => nyMinutes(t * 1000);
const REPLAY_PACES = [
  { value: 1, label: '1×' },
  { value: 5, label: '5×' },
  { value: 20, label: '20×' },
  { value: 60, label: '60×' },
];
let feedRev = 0;
const EMPTY_FLOW: never[] = [];

const TF_VALUES = new Set<string>(TIMEFRAMES.map(t => t.value));
const COMPARE_MODES = new Set<CompareMode>(['percent', 'scale', 'pane']);
/* The desk's comparison inks (LiveChartWidget's set, verbatim): none of them
   collide with the field's gold/steel, the levels' magenta/green/red/blue, or
   the interface's silver. Four, so a pane can cross four symbols at most. */
const COMPARE_INKS = ['#5B9CF6', '#BBB2E8', '#EDE4CD', '#6BD3C7'];
const STYLES = new Set<ChartStyle>(['candles', 'hollow', 'bars', 'line', 'step', 'area', 'baseline']);
/* Derived from the picker's own list rather than typed a second time — a
   fifth mode added there is accepted here without an edit, and one removed
   stops validating here in the same commit. */
const SCALES = new Set<string>(PRICE_SCALES.map(o => o.value));
/* Same rule: derived from the engine's own list rather than typed twice. */
const OR_VALUES = new Set<number>(OPENING_RANGES);

/** The pane slots differ only by symbol at first; a reader sets the rest. */
const defaultPanes = (): PaneCfg[] =>
  Simulator.WATCHLIST.slice(0, 4).map(ticker => ({
    ticker,
    timeframe: '15m' as Timeframe,
    overlays: { ...DEFAULT_OVERLAYS },
    indicators: { ...DEFAULT_INDICATORS },
    chartStyle: 'candles' as ChartStyle,
    clock: 'time',
    compares: [] as CompareEntry[],
    priceScale: 'normal' as PriceScale,
    sessionOr: 15 as OpeningRange,
    ladder: true,
    lane: 'size' as ProfileLane,
    theme: undefined as CandleThemeKey | undefined,
    link: null,
  }));

/* The map starts EMPTY on a fresh install, deliberately. Seeding it from the
   four watchlist rows would mean a reader who sets a pane to 1h and then picks
   SPY gets yanked back to 15m by a setup they never chose — precisely the
   surprise the earned-by-touch rule exists to prevent. */
/* THE RAILS' COLOURS ARE THE HOUSE'S BY DEFAULT since the orbs message (2026-10-14 — one meaning everywhere: the ovals,
   the ladder's bars, the legend, the chips, the regime strip); Thermal stays the reader's own pick. A choice is kept
   under `rails` from that day, so the old default ('thermal', written by every save before it) no longer stands in for a
   choice no one made. */
const defaults = (): TerrainCfg => ({ layout: 3, panes: defaultPanes(), setups: {}, palette: 'house', railCut: 'book' });

/** One stored pane, validated field by field against a known-good default. */
/*
  MIGRATION ONLY. A blob written before setups existed has four panes a reader
  did configure, so their settings become those four symbols' setups — the
  same reasoning as the legacy fan-out below.

  It runs only off a blob that ALREADY EXISTED: a fresh browser returns the
  defaults before reaching here, so its map stays empty and nothing is
  remembered that the reader never chose. Duplicate tickers across panes:
  later index wins, the same last-touch-wins rule the reducer uses.
*/
const seedFrom = (panes: PaneCfg[]): SetupMap => {
  const now = Date.now();
  const out: SetupMap = {};
  for (const p of panes) out[symKey(p.ticker)] = captureSetup(p, now);
  return out;
};

function readPane(raw: unknown, def: PaneCfg): PaneCfg {
  const c = (raw && typeof raw === 'object' ? raw : {}) as Partial<PaneCfg>;
  return {
    ticker: typeof c.ticker === 'string' && c.ticker ? c.ticker : def.ticker,
    timeframe: typeof c.timeframe === 'string' && TF_VALUES.has(c.timeframe) ? (c.timeframe as Timeframe) : def.timeframe,
    overlays: { ...DEFAULT_OVERLAYS, ...(c.overlays && typeof c.overlays === 'object' ? c.overlays : {}) },
    indicators: { ...DEFAULT_INDICATORS, ...(c.indicators && typeof c.indicators === 'object' ? c.indicators : {}) },
    chartStyle: typeof c.chartStyle === 'string' && STYLES.has(c.chartStyle as ChartStyle) ? (c.chartStyle as ChartStyle) : def.chartStyle,
    /* The clock list lives with the engine (data/altBars.ts) and is checked
       through its own validator — not a second enumeration here (T-0's
       lesson, same as the layouts module). */
    clock: isBarClock(c.clock) ? c.clock : def.clock,
    /* Each entry validated on its own: a stored comparison whose symbol was
       renamed, or whose ink went missing, must not take the pane down. */
    compares: Array.isArray(c.compares)
      ? (c.compares as unknown[])
          .filter(
            (e): e is CompareEntry =>
              !!e &&
              typeof e === 'object' &&
              typeof (e as CompareEntry).ticker === 'string' &&
              typeof (e as CompareEntry).ink === 'string' &&
              COMPARE_MODES.has((e as CompareEntry).mode)
          )
          .slice(0, COMPARE_INKS.length)
      : def.compares,
    priceScale: typeof c.priceScale === 'string' && SCALES.has(c.priceScale) ? (c.priceScale as PriceScale) : def.priceScale,
    sessionOr: typeof c.sessionOr === 'number' && OR_VALUES.has(c.sessionOr) ? (c.sessionOr as OpeningRange) : def.sessionOr,
    ladder: typeof c.ladder === 'boolean' ? c.ladder : def.ladder,
    ladderW:
      typeof c.ladderW === 'number' && c.ladderW >= PROFILE_MIN_W && c.ladderW < 4000 ? c.ladderW : def.ladderW,
    lane: c.lane === 'both' || c.lane === 'size' || c.lane === 'flow' ? c.lane : def.lane,
    theme: typeof c.theme === 'string' && c.theme in CANDLE_THEMES ? (c.theme as CandleThemeKey) : def.theme,
    link: isLinkGroup(c.link) ? c.link : null,
    wallsLens: c.wallsLens === 'dex' || c.wallsLens === 'charm' || c.wallsLens === 'gex' ? c.wallsLens : undefined,
    beadBasis: c.beadBasis === 'fixed' || c.beadBasis === 'prior' ? c.beadBasis : undefined,
    beadFloor: typeof c.beadFloor === 'number' && (FLOORS as readonly number[]).includes(c.beadFloor) && c.beadFloor > 0 ? c.beadFloor : undefined,
    beadDensity: c.beadDensity === false ? false : undefined,
    legend: c.legend === false ? false : undefined,
  };
}

/*
  Self-healing load, and a MIGRATION.

  The shape stored before this change was flat — one timeframe, one set of
  overlays, one style for the whole desk, plus a `tickers` array. Somebody's
  browser is holding that right now, and dropping it would silently reset the
  symbols and the interval they chose. So the old fields are read and fanned
  out across the panes: the shared interval becomes every pane's interval,
  which is precisely what the reader was looking at when they left.

  Everything else keeps the contract the board's loader set: anything
  malformed falls back to the default rather than throwing on read. A layout
  of 7, a ticker that is a number, a timeframe that was renamed — each is a
  value a browser can be holding after a deploy, and none of them may take
  the page down.
*/
function loadCfg(): TerrainCfg {
  const def = defaults();
  try {
    const raw = localStorage.getItem(TERRAIN_KEY);
    if (!raw) return def;
    const c = JSON.parse(raw) as Record<string, unknown>;
    if (!c || typeof c !== 'object') return def;

    const layout = (LAYOUTS as readonly number[]).includes(c.layout as number)
      ? (c.layout as TerrainLayout)
      : def.layout;
    /* `ladder` used to be one flag for the whole desk. If that is what is in
       storage it becomes every pane's flag, the same way the one shared
       interval did. */
    const deskLadder = typeof c.ladder === 'boolean' ? (c.ladder as boolean) : undefined;
    const palette: ProfilePalette = c.rails === 'thermal' ? 'thermal' : c.rails === 'house' ? 'house' : def.palette;
    const railCut: RailCut = (typeof c.railCut === 'number' && (CALENDAR_DTES as readonly number[]).includes(c.railCut)) || isWindowCut(c.railCut) ? (c.railCut as RailCut) : def.railCut;

    if (Array.isArray(c.panes)) {
      const stored = c.panes as unknown[];
      const panes = def.panes.map((d, i) => readPane(stored[i], { ...d, ladder: deskLadder ?? d.ladder }));
      const hadSetups = !!c.setups && typeof c.setups === 'object';
      return { layout, panes, setups: hadSetups ? readSetups(c.setups) : seedFrom(panes), palette, railCut };
    }

    // ── the flat shape, fanned out ──
    const legacy: Partial<PaneCfg> = {
      timeframe: typeof c.timeframe === 'string' && TF_VALUES.has(c.timeframe) ? (c.timeframe as Timeframe) : undefined,
      overlays: c.overlays && typeof c.overlays === 'object' ? (c.overlays as ChartOverlays) : undefined,
      indicators: c.indicators && typeof c.indicators === 'object' ? (c.indicators as ChartIndicators) : undefined,
      chartStyle: typeof c.chartStyle === 'string' && STYLES.has(c.chartStyle as ChartStyle) ? (c.chartStyle as ChartStyle) : undefined,
      /* Not in the flat shape — it predates T-7 by a long way — so it is left
         off and `readPane` gives the pane its default. */
    };
    const tickers = Array.isArray(c.tickers) ? (c.tickers as unknown[]) : [];
    const panes = def.panes.map((d, i) =>
      readPane({ ...legacy, ticker: typeof tickers[i] === 'string' ? tickers[i] : d.ticker }, {
        ...d,
        ladder: deskLadder ?? d.ladder,
      })
    );
    return { layout, panes, setups: seedFrom(panes), palette, railCut };
  } catch {
    return def;
  }
}

/** How many columns a layout wants, and from which breakpoint. One pane is
    full width at every size; the rest stack on a phone and open out on a
    laptop, because three 400px charts on a 1280 screen read and three 160px
    ones do not. */
const COLS: Record<TerrainLayout, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 lg:grid-cols-2',
  3: 'grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3',
  4: 'grid-cols-1 lg:grid-cols-2',
};

/*
  ROWS HAVE TO FOLLOW COLUMNS, at every breakpoint, or a pane falls out of the
  grid's height.

  Three panes in two columns need TWO rows. Layout 3 declared one, so the
  third pane landed in an IMPLICIT row — and an implicit row is sized to its
  content, not to a share of the container, while the single explicit row took
  the whole height. Measured at 1024 and at 1440: two panes full height and a
  third at 174px.

  It hid because layout 3 is three columns from `2xl` up, and every screenshot
  of it was taken at 1760. The band it was broken in — 1024 to 1535 — is most
  laptops, and layout 3 is the default.
*/
const ROWS: Record<TerrainLayout, string> = {
  1: 'lg:grid-rows-1',
  2: 'lg:grid-rows-1',
  3: 'lg:grid-rows-2 2xl:grid-rows-1',
  4: 'lg:grid-rows-2',
};

/*
  Height of the time axis lightweight-charts draws under the plot, in px.

  MEASURED, not chosen: with `timeVisible: true` and this font the axis canvas
  runs 858→884 in a 1000px viewport. It is a library constant for this
  configuration, so it is written down once here and asserted in the sweep —
  if a library upgrade moves it, the rail stops lining up with the plot floor
  and the check fails instead of the corner quietly filling with ladder again.
*/
const TIME_AXIS_PX = 26;

/*
  CLEARANCE for the price gutter lightweight-charts draws down the right of
  the plot, in px. Floating chrome has to stop short of that gutter or it
  lands on the price ticks.

  It is deliberately a hair MORE than the gutter itself, and it is DERIVED
  from the chart's own minimum rather than typed here. It used to be a literal
  56 against a ~54px gutter, and when the chart widened its scale to 74 (so
  the live-price card sits in the gutter instead of over the tape) the two
  became a two-generators-for-one-fact bug: the desk would have gone on
  clearing 56 and parking a button on the price ticks. The browser sweep
  caught it — clearance at least as wide as the gutter, and not so much wider
  that it is throwing away chart — and this is the fix that keeps it caught.
*/
/* the axis chips' gutter since the UI pass of 2026-10-14 (every Terrain pane draws them) */
const PRICE_GUTTER_PX = AXIS_CHIPS_SCALE_MIN_WIDTH + 2;

/*
  WHAT THE FULL CONTROL STRIP NEEDS — inside the chart column, with the price
  gutter already taken off it.

  Measured against this build at 2560, where nothing can be forcing a wrap:
  the un-compacted toolbar lays out at 972px on one line. The timeframe strip
  is 289 of that (eight chips now — T-14's `15s` is 36px of the move below),
  `Replay` 78, the three worded triggers (Indicators 117 · Alerts 93 ·
  Candles 102) another 311, `Overlays 3` 117, `Theme` 89, and the rest gaps
  and dividers. Add the strip's 6px left pad and the toolbar band's 16px of
  `px-2` and the column has to give it 994px past the gutter.

  IT HAS MOVED THREE TIMES, and every time the control that moved it was in
  another file: 818 → 856 when T-1 wired the draw pencil, → 934 when T-13
  wired Replay, and → 972 when T-14 put `15s` on the picker. That is the
  whole hazard of a measured constant, and it is why the sweep asserts the
  PROPERTY — the toolbar occupies exactly one row at every width and layout —
  rather than this figure. The number here is the gate; the sweep is what
  notices when it is wrong (it did: two panes at 1180 wrapped over the tape
  for exactly the 38px the 15s chip is worth).

  T-7 ADDED NO WIDTH, and that was the deciding constraint rather than a happy
  accident: a price-scale trigger of its own is 39px at the very least, and the
  COMPACT strip has none to spare, so the scale folded into the Candles menu
  (see ChartToolbar). T-13's Replay is SHED in compact for the same budget —
  it has `p` and a badge, and the pencil has neither.

  The sweep asserts the PROPERTY as well as these figures: the toolbar
  occupies exactly one row at every width and layout. The next control to land
  in that strip fails a build rather than quietly wrapping it over the tape.

  Under that it does not clip or scroll, it WRAPS — the root is `flex-wrap`
  and the Indicators/Alerts/Candles span inside it wraps again. At 1024px with
  two grid columns the chart column is 369px, so 291px of line takes 818px of
  controls in FOUR rows: 126px of toolbar inside a 205px chrome stack over a
  411px pane — half the pane, sitting on the tape. On a coarse pointer
  `.chrome-hover` pins that visible (index.css), so it never goes away.

  It is a PANE width, not a window width: a four-pane desk at 1440px still
  gives each toolbar ~577px and still wraps.
*/
const TOOLBAR_FULL_PX = 994;
/** The fullscreen door when it rides the identity row: its 24px button and the row's 8px gap */
const ROW_DOOR_PX = 32;

/*
  THE STRIP'S OWN PADDING, when it is not clearing a price gutter (`p-1.5`).
  Named because the usable width below is derived from it rather than from a
  second copy of the number.
*/
const STRIP_PAD_PX = 6;

/*
  WHAT THE IDENTITY ROW COSTS, AND WHAT IT GIVES UP WHEN THE COLUMN CANNOT PAY.

  The row is `w-fit max-w-full` and every child is `shrink-0`, which caps the
  BOX at the column and lets the CONTENTS overflow it visibly. So it does not
  wrap and it does not clip — it prints past the pane's edge, onto the price
  ticks. Measured at a 1024px viewport with the rail up, where the chart column
  is 369px and the usable width is 287:

    padding 16 · badge 16 · symbol capsule 146 · link chip 26 · price 47 ·
    change 44 · expand 24 = 343 needed against 287 available, on ALL FOUR
    panes (341 on QQQ). (The link chip joined with T-20 — and joined these
    figures only after the sweep caught its 26px printing the row's tail on
    the axis at 1024-1280: one overflowing button per pane, the exact width
    of the part nobody had re-measured.)

  The 30px that did not fit was the EXPAND BUTTON, sitting on the price axis —
  in the shipped build, at a laptop width, with or without a second axis. The
  comment above this row says the identity and the button are fixed and only
  the strike read gives. That was not true, and this is what makes it true.

  The order things go in is by what the reader loses least:

    the CHANGE %  first — the price it is a delta of is still right there, and
                  the chart draws the same move. Costs 52 (44 + its gap).
    the BADGE     next — the symbol already names the pane; the number is only
                  a shorthand for it. Costs 24, and only exists at all when
                  more than one pane is up.
    the COMPARE + last — a control, so it goes last. Removing a comparison is
                  still possible from the legend's own x, and the menu comes
                  back the moment the column is wide enough. Costs 34, since
                  the button sits inside the capsule (146 = 112 + 6 + 28).
    the LINK CHIP sheds with the compare tier — but ONLY while it is unlinked,
                  when it is a convenience like the +. A pane that is LINKED
                  wears its letter at every width, the replay badge's rule:
                  a pane that follows another silently is a surprise, and
                  state is never shed.

  Thresholds are the cost of the NEXT tier down plus room to spare, because
  the parts are not fixed: `min-w-[112px]` on the symbol button is a floor, so
  a five-letter symbol grows it, and a four-figure price is wider than the
  $501.80 measured here. The sweep asserts the GEOMETRY — nothing over an axis
  — rather than these numbers, so a symbol that outgrows them fails the build
  instead of quietly printing on the ticks.
*/
/* The old identity row's tiers (366 / 311 / 286) are the header's budget now — `headPlan` in the Pane, the same
   measured parts taken in the order a reader gains most. */

/*
  THE HEAVIEST READ'S ENTRIES, measured the same way: the HEAVIEST label is 50
  and the widest entry seen is 86 ("172.50 $131.3M"), each followed by a 10px
  gap.

  This count used to come from the LAYOUT — `layout >= 3 ? 2 : 3` — and layout
  is not what decides it. At a 1024px viewport every layout from 2 up has the
  SAME 369px column, so a two-pane desk printed three entries in exactly the
  width where a four-pane desk correctly printed two, and the third ran onto
  the price axis. Measured: 2 entries fit 287px with room (`scrollWidth ===
  clientWidth`), 3 need ~338.
*/

/*
  WHAT THE HOVERED-BAR READOUT COSTS — T-8, MEASURED in this build with all
  four indicators drawn, at a width where nothing was forcing it to shed. Each
  figure is the cell plus the row's own 10px gap:

    O · H · L   46 each → 168 for the three
    C           45 → 55, and it never goes; a readout with no close is not one
    V 151.4K    45 → 55
    EMA50       the widest indicator at 71 → 81; four of them is 324

  The whole row with everything on measures 596px.

  THE ORDER THINGS GO IN — what a reader loses least, first:

    the INDICATORS  first, and they are the biggest single saving. Their lines
                    are ON THE TAPE in their own inks a few pixels away, so
                    the number is a precision the chart is already showing.
    the VOLUME      next: the histogram is drawn along the floor of the same
                    plot, so the bar's size is visible even unlabelled.
    the OPEN,       last before the floor. They are the only parts with no
    HIGH and LOW    second home on a line, step or area tape — but on those
                    shapes they are null anyway and the row never carries
                    them, so what is dropped here is only ever dropped from a
                    candle or bar chart, where the wick and body draw them.

  The floor is `C` alone at 55px, which every column on this desk can pay.
*/
/*
  WHAT THE CONFLUENCE STRIP COSTS — T-12, MEASURED in this build at 1024–1920
  with two panes, not estimated. Each figure is the strip plus the row's 8px
  gap:

    FULL   `1m▼ 5m▼ 15m▼ 1h▬ 1D▲`   140 → 148, the timeframes named
    TIGHT  `▼▼▼▬▲`                    61 →  69, the SHAPE alone

  TWO FORMS, NOT A SHED ORDER, because there is only one thing here and
  dropping it leaves nothing. The tight form is not a degraded full one: what
  a reader takes from this strip in the first instant is whether the arrows
  AGREE, and five glyphs in a fixed order say that as well as five labelled
  ones. Which timeframe is which stays in the hover title and the accessible
  name — the same trade `compact` makes across the toolbar.

  It is the FIRST thing the identity row gives up, and it is gated on the row
  affording everything ELSE first: a strip that arrived by pushing the change
  percentage off the row would be trading a measurement for a summary of
  measurements.

  ON THE MARGINS. At the width the full form first appears the row sits about
  8px inside its box — thin, and deliberately not padded out. The box it would
  overflow is the strip's CONTENT box, and the strip's right padding IS the
  price-gutter clearance (PRICE_GUTTER_PX): a row that runs a few pixels long
  grows into 76px of clearance, not onto the price ticks. What the sweep holds
  is that geometry — nothing over an axis — rather than these figures, so a
  symbol or a price wider than the ones measured here fails a build instead of
  quietly printing on the ticks.

  Measured tiers with two panes: full to 1440 · tight at 1366 and 1280 · gone
  at 1180 and below, where the row is already shedding its own parts.
*/

const READOUT_C_PX = 55;
const READOUT_OHL_PX = 168;
const READOUT_VOL_PX = 55;
const READOUT_IND_PX = 81;

/*
  The heaviest strikes in the pane's window, signed — the one-line read of
  where the book is, and the same rows the rail draws.

  HOW MANY depends on the layout, and that is a correctness fix rather than a
  tidiness one. The row clips at the pane's edge, and clipping happens WITHIN
  an entry, not between them: at three-up a pane printed "425 -$13", which is
  the front of -$135.6M and reads as thirteen dollars. A number cut in half is
  not a shortened number, it is a different number. Narrow panes therefore
  carry fewer entries, and what still clips is faded out so an incomplete
  value cannot pass for a complete one.
*/

/*
  THE TIMEFRAMES, AND WHETHER THEY AGREE — T-12.

  BULL AND BEAR INK, deliberately, and it is the one place on this desk where
  that is not a violation: the house rule is "red/green is price direction
  only", and price direction is exactly what these arrows are. Nothing here
  touches the dealer palette.

  ONE `title` AND ONE ACCESSIBLE NAME for the whole strip rather than per
  glyph: five tooltips on five 20px targets is five things to hover, and in
  the tight form the labels are the only way to know which is which.
*/
/* THE STRIP IS THE PANE'S TIMEFRAMES (the audit's TE-1, 2026-10-09: "1m ▼ 5m ▼ 15m ▼ 1h ▼ 1D ▼" looked like tabs and
   pressed like nothing, while the real "15m ▾" showed only under the pointer). Each entry is now a tab: a press puts the
   pane on that timeframe, the pane's own timeframe stands lit at rest, and the arrow beside each still says its trend. */
const ConfluenceStrip = ({ rows, form, current, onPick }: { rows: ConfluenceRow[]; form: 'full' | 'tight'; current: Timeframe; onPick: (tf: Timeframe) => void }) => {
  const words = rows.map(trendWords).join(' · ');
  return (
    <span className="shrink-0 inline-flex items-center gap-0.5 pointer-events-auto" role="group" aria-label={`Timeframe — and each one's trend: ${words}`} title={words} data-confluence-tabs>
      {rows.map(r => {
        const on = r.tf === current;
        return (
          <button
            key={r.tf}
            type="button"
            onClick={() => onPick(r.tf)}
            aria-pressed={on}
            aria-label={`${r.tf}${on ? ', on this pane' : ''} — ${trendWords(r)}`}
            className={`hit inline-flex items-baseline gap-0.5 h-5 px-1 rounded-[3px] transition-colors ${on ? 'bg-ink/[0.14]' : 'hover:bg-ink/[0.07]'}`}
            data-tf={r.tf}
          >
            {(form === 'full' || on) && <span className={`font-mono text-[11px] ${on ? 'text-textPrimary font-semibold' : 'text-textMuted'}`}>{r.tf}</span>}
            <span
              aria-hidden
              className={`font-mono text-[11px] leading-none ${
                r.state === 'up' ? 'text-bull' : r.state === 'down' ? 'text-bear' : 'text-textMuted'
              }`}
            >
              {/* A timeframe with too little history gets a dash, never a bar —
                  "no view" and "flat" are different claims (data/confluence.ts). */}
              {r.state === null ? '–' : TREND_GLYPH[r.state]}
            </span>
          </button>
        );
      })}
    </span>
  );
};

/* ONE TOOLBAR, THREE MOUNTS (the UI pass): the header carries Replay, Alerts and the layers; its timeframe trigger stands
   alone where the tabs have no room; the hover row carries the rest */
/* `replay: true` keeps the Replay door in a compact mount (ChartToolbar drops it there otherwise): without it a docked pane
   showed no Replay button at any width (the audit's A-56) */
const HEAD_PARTS: Partial<Record<ToolbarPart, boolean>> = { timeframes: false, indicators: false, candles: false, theme: false, fullscreen: false, replay: true };
/* the hover row when the header holds no tools: every part, Replay kept in its compact form */
const HOVER_ALL_PARTS: Partial<Record<ToolbarPart, boolean>> = { replay: true };
const HOVER_PARTS: Partial<Record<ToolbarPart, boolean>> = { replay: false, alerts: false, overlays: false };

interface PaneProps {
  /** Bumped by the desk when the T key asks this pane for its calendar */
  openDateNonce?: number;
  cfg: PaneCfg;
  onCfg: (patch: Partial<PaneCfg>) => void;
  revision: number;
  expanded: boolean;
  onToggleExpand: () => void;
  index: number;
  /** Panes get shorter as the grid gets wider — one chart earns the height */
  tall: boolean;
  /** This pane's real hover, out to the desk. null when the pointer leaves. */
  onCrosshair: CrosshairSync;
  /** Hand the desk this pane's "mark that moment" function, null on unmount. */
  registerSync: (apply: CrosshairSync | null) => void;
  /*
    REPLAY — T-13, and it lives in the DESK rather than in the pane, unlike
    draw mode.

    Because it has a key. `p` acts on whichever pane is active, and the key
    handler is installed once at the desk; a flag inside the pane would need
    to be reached through a ref per pane to be togglable from there. Draw mode
    has no key, so it stays where it is used.

    It also has to be desk-level for the CROSSHAIR decision below — one pane
    cannot know whether another is replaying, and that is exactly the question
    the sync has to answer before it marks a moment.
  */
  replay: boolean;
  onToggleReplay: () => void;
  onExitReplay: () => void;
  /** THE REPLAY'S KEYS (item 8): the pane hands the desk its play-and-pause and its step, for Shift ↓ and Shift → */
  registerReplayKeys?: (k: { toggle: () => void; step: () => void; playing: () => boolean; picking: () => boolean } | null) => void;
  /** Whether this pane shows the Compare door now — the C key asks it (the audit's A-236) */
  registerCompareRoom?: (room: boolean | null) => void;
  /*
    DRAW MODE, and it sits beside replay for the same two reasons.

    It has a KEY now (`d`), so the desk has to own it — the handler is
    installed once and toggles whichever pane is active. And both are MODES
    rather than settings, so both are shed from the compact strip together and
    both need a door that survives the shedding.

    Neither is persisted: a reader who left a pane sketching or scrubbing
    yesterday wants a chart today.
  */
  drawing: boolean;
  onToggleDrawing: () => void;
  onExitDraw: () => void;
  /** Whether the keys act on this pane, and how to make them. */
  isActive: boolean;
  onActivate: () => void;
  /** How many panes are on the desk — a number badge on the only pane on
      screen is chrome that says nothing. */
  paneCount: number;
  /** Mid-fade on the way out of the takeover — see the desk's `closeExpanded`. */
  closing?: boolean;
  /** Which of this pane's menus a key has opened, if any. */
  menuOpen: 'symbol' | 'compare' | null;
  onMenu: (which: 'symbol' | 'compare' | null) => void;
  /** The pane's real box, handed up so the desk can scroll it into view when
      a key makes it active — below `lg` the panes stack and the page scrolls. */
  boxRef?: (el: HTMLDivElement | null) => void;
  /*
    Extra grid classes for THIS pane's box.

    They have to arrive here rather than being written on the grid, for the
    same reason the stacked-phone floor does: the wrapper below is
    `display: contents` when the pane is not expanded, so a `[&>*]` rule on
    the grid lands on an element that generates no box and is ignored. That
    trap has already cost one silent defect in this file.
  */
  cell?: string;
  /** The desk's one choice of rail colours — see TerrainCfg.palette */
  palette: ProfilePalette;
  /** Which contracts this pane's rail reads — the desk's one choice, changed from any rail's head */
  railCut: RailCut;
  onRailCut: (cut: RailCut) => void;
  /** POP-OUT (2026-10-10): open this pane in a window of its own — a door beside the fullscreen one */
  onPopOut?: () => void;
  /** The pane alone in a pop-out window: no fullscreen and no pop-out doors (it is the window) */
  bare?: boolean;
}

const Pane = ({
  cfg, onCfg, revision, expanded, onToggleExpand, index, tall,
  onCrosshair, registerSync, replay, onToggleReplay, onExitReplay, registerReplayKeys, registerCompareRoom,
  drawing, onToggleDrawing, onExitDraw,
  isActive, onActivate, paneCount, closing = false, menuOpen, onMenu,
  boxRef, cell = '', palette, railCut, onRailCut, onPopOut, bare = false, openDateNonce = 0,
}: PaneProps) => {
  const { ticker, timeframe, overlays, indicators, chartStyle, clock, compares, priceScale, sessionOr, ladder } = cfg;
  /* its own theme, else the page's default — Glacier on the dark terminal, Stone on paper — re-read on a flip */
  const pageDefault = usePageDefaultCandleKey();
  const theme = cfg.theme ?? pageDefault;
  /* WHAT THE AXIS IS ACTUALLY DRAWING, from the one function that decides it.
     The chart asks the same question of the same list, so the picker's trigger
     and the price ticks can never disagree — a second `compares.some(...)`
     here would be two generators for one fact, which is the bug this desk has
     already paid for once (PRICE_GUTTER_PX). */
  const scaleLock = priceScaleLockedBy(compares);
  /* An "Own scale" comparison gives the tape a SECOND price gutter, down the
     LEFT (StrikeChart's `leftPriceScale.visible`). Every piece of this pane's
     floating chrome is left-anchored, so it has to step aside for that axis
     exactly the way it already steps aside for the right-hand one. */
  const ownScale = compares.some(c => c.mode === 'scale');
  /* Below `lg` this desk stops filling the viewport and becomes a column the
     page scrolls through — so the wheel has to belong to the page, not to the
     chart. See `pageScroll` on StrikeChart for what was measured. */
  const belowLg = useIsBelowLg();
  /* Read here rather than threaded down: this component already takes fourteen
     props, and it is the same one-line media query the page reads. */
  const isPhone = useIsPhone();

  /*
    ══ THE COMPARE LEGEND HAS TO START BELOW THE STRIP, NOT AT 46px ═════════

    The legend was pinned at `top-[46px]` — the strip's height when it holds
    one row. The strip is a `flex-col` and holds two whenever the toolbar is
    up, so on hover it grew over the legend and the legend is z-10 against the
    strip's z-20.

    Measured at 1440x900, one compare: legend row [19,109,109,16] against the
    heaviest-strike read [13,109,316,23] — 16px of 16 vertical overlap, 109 of
    109 horizontal. With four compares the Remove buttons land at y=109/127/
    145/163 and elementFromPoint at the third one's own centre returns the
    timeframe strip's button: that × cannot be clicked at all, even though it
    carries `pointer-events-auto`.

    So the offset is the strip's OWN height, measured. A second hard-coded
    number would be the same bug with a bigger constant — the strip's height
    is whatever its content and the pane's width make it.
  */
  const stripRef = useRef<HTMLDivElement | null>(null);
  /* This pane's own box — the section its toolbar's menus stay inside (Noah,
     2026-09-13: "aren't in their section"); the desk's paneRefs get the same
     element through boxRef. */
  const paneBoxRef = useRef<HTMLDivElement | null>(null);
  const [stripH, setStripH] = useState(46);
  /* The SAME observation answers a second question: how much room the toolbar
     has. The strip is `inset-x-0` on the chart column, so its width IS the
     column's — which is the width that decides whether the strip wraps, and
     which no media query on the window can stand in for.

     Width in, height out: the decision is made on the room AVAILABLE, never
     on the strip's own content, so compacting cannot feed back into the
     measurement and oscillate. `inset-x-0` also means flipping to compact
     leaves this width unchanged — only stripH moves, and that only shifts the
     compare legend. */
  const [stripW, setStripW] = useState(0);
  useEffect(() => {
    const el = stripRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const obs = new ResizeObserver(() => {
      // getBoundingClientRect, not contentRect: the strip carries p-1.5 and
      // contentRect excludes padding, which would put the legend back under it.
      const r = el.getBoundingClientRect();
      const h = Math.round(r.height);
      if (h > 0) setStripH(h);
      if (r.width > 0) setStripW(Math.round(r.width));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  /* WHAT THE STRIP'S ROWS CAN ACTUALLY USE — the column, less the gutter it
     clears on each side. Derived from the SAME expression the padding above
     applies, so the two cannot disagree about how much room was taken.

     Width in, content out, exactly as the observer's own note requires: the
     tiers below read this, never their own rendered width, so shedding a part
     cannot change the number that decided to shed it. `inset-x-0` keeps this
     width fixed across a tier change, so there is no oscillation to damp.

     Before the first measurement stripW is 0 and everything renders — the
     honest default is the full row for one frame, not a shed one that grows. */
  const stripInner = stripW > 0 ? stripW - PRICE_GUTTER_PX - (ownScale ? PRICE_GUTTER_PX : STRIP_PAD_PX) : 0;
  /* the bead legend's form: the whole words where the column holds them in two lines, the short form under that */
  const railInset = useRailLeftInset();
  const legendShort = stripInner > 0 && stripInner - railInset < LEGEND_FULL_MIN_PX;
  /* The tape, straight from the provider that accumulates it. Read HERE rather
     than threaded down from Terrain: this component already takes fourteen
     props, and every pane wants the same unfiltered tape — StrikeChart narrows
     it to its own symbol. */
  const flowTape = useFlowTape();

  /* Add / remove a crossed symbol. Capped at the ink list's length so every
     comparison on a pane is a DIFFERENT colour — two lines sharing an ink is
     a chart that cannot be read, and the legend below would name them both
     the same. A symbol already crossed, or the pane's own, is refused. */
  const addCompare = (t: string, mode: CompareMode) =>
    onCfg({
      compares: (() => {
        if (compares.length >= COMPARE_INKS.length || compares.some(c => c.ticker === t) || t === ticker) return compares;
        const ink = COMPARE_INKS.find(i => !compares.some(c => c.ink === i)) ?? COMPARE_INKS[0];
        return [...compares, { ticker: t, mode, ink }];
      })(),
    });
  const removeCompare = (t: string, mode: CompareMode) =>
    onCfg({ compares: compares.filter(c => !(c.ticker === t && c.mode === mode)) });

  /* The desk's reducer now sets `compares` explicitly on every symbol change,
     so the effect that used to clear them here is gone — and it had to go.
     Keyed on [ticker], it also ran on MOUNT, which wrote a saved comparison
     back and then wiped it a frame later: measured on a boot with one stored
     comparison, the array ended empty and no legend row ever rendered.
     Compares have been persisted-but-dead since they were added. */

  // Each pane reads its own book; revision keeps the levels tracking the tick
  /* THE RAIL'S BOOK FOR THE DESK'S CUT (2026-09-16): rows, core, walls and legs in one read, so
     the chart's level lines, the header's heaviest line and the rail can never name different
     strikes for different expiries */
  /* THE ROOM'S SOURCE (2026-10-12): 'feed' reads Unusual Whales' book and bars for this pane's name; 'pending' (the
     shell's first probe out) reads nothing yet — never a flash of the house's market before the vendor's */
  const terrainSrc = useTerrainSource();
  const onFeed = terrainSrc === 'feed';
  const offHouse = terrainSrc !== 'stand-in';
  const fBook = useFeedBook(onFeed, ticker).book;
  const fOi = useFeedOi(onFeed, ticker).today;
  const fBars = useFeedBars(onFeed, ticker, { history: true });
  const fFieldRead = useFeedField(ticker);
  /* the server records this pane's name once a minute through the session (server/fieldRecorder.ts) — its day joins the
     field. An index has no field on the plan but SPX: its minutes and its three sessions come from the recorder (its prints
     in the index's hours, its options' forward outside them — core/sessions.ts, server/overnightReader.ts) */
  const fieldName = !isCashIndex(ticker) || tradesAllSessions(ticker);
  useServerField(onFeed && fieldName, ticker);
  /* 1D and 1W read the day bars — asked only while the pane draws them */
  const wantsDaily = timeframe === '1D' || timeframe === '1W';
  const fDaily = useFeedDaily(onFeed && wantsDaily, ticker);
  const fDark = useFeedDarkLevels(onFeed && !!overlays.darkpool, ticker);
  const fEarnings = useFeedEarnings(onFeed && !!overlays.events, ticker);
  /* THE MACRO DATES ON THE FEED (2026-10-13 — the owner: "nothing on terrain should be made up data"): UW's economic
     calendar, its high-impact releases, in place of the house's calendar rules (data/feed/news.ts econMacro) */
  const fEcon = useFeedEcon(onFeed && !!overlays.events);
  const fMacro = useMemo(() => (fEcon ? econMacro(fEcon) : undefined), [fEcon]);
  /* the name's prints: the flow band, the net drift and the events lane's prints */
  const fPrints = useFeedNamePrints(onFeed && !!(overlays.flow || overlays.netDrift || overlays.events), isCashIndex(ticker) ? null : ticker);
  /* COMPARES ON THE FEED: each crossed name's minutes (and days for 1D and 1W) — four slots, the inks' count */
  const c0 = compares[0]?.ticker ?? '';
  const c1 = compares[1]?.ticker ?? '';
  const c2 = compares[2]?.ticker ?? '';
  const c3 = compares[3]?.ticker ?? '';
  const cb0 = useFeedBars(onFeed && !!c0, c0).bars;
  const cb1 = useFeedBars(onFeed && !!c1, c1).bars;
  const cb2 = useFeedBars(onFeed && !!c2, c2).bars;
  const cb3 = useFeedBars(onFeed && !!c3, c3).bars;
  const cd0 = useFeedDaily(onFeed && wantsDaily && !!c0, c0);
  const cd1 = useFeedDaily(onFeed && wantsDaily && !!c1, c1);
  const cd2 = useFeedDaily(onFeed && wantsDaily && !!c2, c2);
  const cd3 = useFeedDaily(onFeed && wantsDaily && !!c3, c3);
  const compareBars = useMemo(() => {
    if (!onFeed) return undefined;
    const out: Record<string, { bars: Candle[]; daily?: Candle[] | null }> = {};
    const slots: [string, Candle[] | null, Candle[] | null][] = [[c0, cb0, cd0], [c1, cb1, cd1], [c2, cb2, cd2], [c3, cb3, cd3]];
    for (const [t, b, d] of slots) if (t) out[t] = { bars: b ?? EMPTY_BARS, daily: d };
    return out;
  }, [onFeed, c0, c1, c2, c3, cb0, cb1, cb2, cb3, cd0, cd1, cd2, cd3]);
  /* the rail's own quote (one poll a name, price.ts) — the pane head, the ladder and the capsule print it (item 1) */
  const fQuote = useFeedPrice(onFeed, ticker).price;
  const fDay = useMemo(() => (fQuote ? { price: fQuote.spot, changePct: fQuote.changePct } : null), [fQuote]);
  const fMoves = useFeedMoves(onFeed, ticker);
  const fDates = useFeedMaxPain(onFeed, ticker);
  const fListed = useMemo(() => listedDates(fDates), [fDates]);
  /* the desk's cut as one of UW's listed dates — a cut no listed date matches reads the whole book */
  const cutDate = onFeed && typeof railCut === 'number' ? fListed.find(d => calDaysTo(d) === railCut) ?? null : null;
  /* the expiry window (item 6) — on the feed alone; a listed date or the book reads every window */
  const win: ExpiryWindow = onFeed ? windowOfCut(railCut) : 'all';
  /* THE FIELD, FULL (2026-10-13): today's minutes rebuilt from the chain on the house's pricer and calibrated to UW's
     newest book, the sessions before off UW's own book for each date, the books this terminal read in their own minutes
     (data/feed/trailField.ts) */
  /* the field follows the pane's expiry card: one listed date's contracts alone, or every expiry */
  const trailCut = cutDate;
  const fTrail = useFeedTrailField(onFeed && fieldName, ticker, fBars.bars, fFieldRead, trailCut, win);
  /* ══ THE SESSIONS BEFORE TODAY, AS THE SERVER FOLDED THEM (the owner's Section I, 2026-10-15) ══════════════════════
     Each past session comes as tiles (server/fieldTiles.ts): its bars at this pane's timeframe and its columns through
     the pane's window, each column carrying its references and held walls — modeled once on the server at rebuild time,
     never in the page, never folded here. The view opens on the newest sessions the timeframe shows and a buffer; its
     left edge reaching the oldest asks the next block (onViewFrom); behind the view the page asks the next block, the
     same sessions at the neighbouring timeframes and the other windows, so a switch finds them in hand. A listed-date
     cut, an index, and a server with no tiles route read the sessions as before (useServerPastSessions). */
  const tileTf = TILE_TF_OF[timeframe === '15s' ? '1m' : timeframe] ?? null;
  const tileReady = onFeed && fieldName && cutDate == null;
  const tDaily = useTileDaily(tileReady, ticker);
  const tilesToday = nyIsoDate();
  const [tileExtra, setTileExtra] = useState(0);
  useEffect(() => setTileExtra(0), [ticker, timeframe]);
  /* the sessions there are or will be tiles for: the tiled ones, the ones the server can tile (rebuilt, not yet tiled)
     and the ones the chart's own minutes hold (the server is asked to rebuild them — useServerPastSessions below) */
  const barDays = useMemo(() => pastSessionsOf(fBars.bars), [fBars.bars]);
  const tiledBefore = useMemo(() => (tDaily ? [...new Set([...tDaily.days, ...tDaily.pending, ...barDays])].filter(d => d < tilesToday).sort() : []), [tDaily, barDays, tilesToday]);
  const tileSpan = tileTf ? TILE_SPAN[tileTf] : 0;
  const tileDays = useMemo(() => (tileReady && tileTf ? tiledBefore.slice(-(tileSpan + tileExtra)) : []), [tileReady, tileTf, tiledBefore, tileSpan, tileExtra]);
  const tileAlso = useMemo(() => {
    if (!tileTf || !tileDays.length) return [];
    const n = tileSpan + tileExtra;
    const older = tiledBefore.slice(Math.max(0, tiledBefore.length - n - tileSpan), Math.max(0, tiledBefore.length - n));
    return [
      { tf: tileTf, w: win, days: older },
      ...TILE_NEIGHBOURS[tileTf].map(nt => ({ tf: nt, w: win, days: tiledBefore.slice(-TILE_SPAN[nt]) })),
      ...TILE_WINDOWS.filter(ow => ow !== win).map(ow => ({ tf: tileTf, w: ow, days: tileDays })),
    ];
  }, [tileTf, tileDays, tiledBefore, tileSpan, tileExtra, win]);
  const tiles = useTileSessions(tileReady && !!tileTf, ticker, tileTf ?? 5, win, tileDays, tileAlso);
  /* the tiles route answers (a server with none — an always-on recorder on older code — reads the sessions as before) */
  const tilesOn = tileReady && !tiles.unavailable && tDaily != null;
  const preTape = useMemo(() => {
    if (!tilesOn || !tileTf || !tileDays.length) return undefined;
    const held: TileDay[] = [];
    for (const d of tileDays) {
      const td = tileDay(ticker, tileTf, win, d);
      if (td) held.push(td);
    }
    if (!held.length) return undefined;
    const maxima = new Map<string, TileDay['maxima']>();
    for (const td of held) maxima.set(td.day, td.maxima);
    return { tf: tileTf, bars: held.flatMap(td => td.bars), cols: held.flatMap(td => td.cols), maxima, events: held.flatMap(td => td.events), days: held.map(td => td.day) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tilesOn, tileTf, tileDays, ticker, win, tiles.version]);
  /* the reader's view reaching the oldest session in hand asks the block before it */
  const onViewFrom = useCallback(
    (fromTime: number) => {
      if (!tilesOn || !tileDays.length || tileDays.length >= tiledBefore.length) return;
      const d = nyIsoDate(fromTime * 1000);
      const idx = tileDays.indexOf(d);
      if (d <= tileDays[0] || (idx >= 0 && idx < Math.ceil(tileSpan / 3))) setTileExtra(e => e + tileSpan);
    },
    [tilesOn, tileDays, tiledBefore.length, tileSpan]
  );
  /* the sessions before today the chart holds, rebuilt by the server from UW's dated history (server/fieldBackfill.ts) —
     modeled in the page only where the tiles do not stand (above) */
  /* a replay reads the live trail's columns for every session the recorder did not keep (the replay's twin), so while the
     pane is in a replay the sessions are modeled in the page as before */
  const fPast = useServerPastSessions(onFeed && fieldName && overlays.trails, ticker, fBars.bars, !tilesOn || replay);
  const fField = fTrail.snaps;
  /* the page's own minutes for the tape: the tiled sessions' left out (their bars come folded with their columns) */
  const tiledSet = useMemo(() => new Set(preTape?.days ?? []), [preTape]);
  const tapeBars = useMemo(() => (fBars.bars && tiledSet.size ? fBars.bars.filter(b => !tiledSet.has(nyIsoDate(b.time * 1000))) : fBars.bars), [fBars.bars, tiledSet]);
  /* the day bars: the vendor's (UW, Theta) over every tiled session's — fourteen years where the server holds them */
  const allDaily = useMemo(() => {
    if (!tilesOn || !tDaily?.bars.length) return fDaily;
    if (!fDaily?.length) return tDaily.bars;
    return mergeByTime(fDaily, tDaily.bars);
  }, [tilesOn, tDaily, fDaily]);
  const fByDate = useFeedByExpiry(onFeed && cutDate !== null, ticker, cutDate ? [cutDate] : []);
  const houseRail = useMemo(
    () => (offHouse ? null : railForCut(ticker, railCut)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ticker, revision, railCut, offHouse]
  );
  /* THE LADDER THROUGH THE WINDOW (item 6): Unusual Whales' 60-day book by expiry partition, the newest read carrying
     them (the recorder's five-minute read) — none yet, and the ladder keeps the book on every expiry, said in How sure */
  const fBook60 = useMemo(() => {
    if (!onFeed || win === 'all') return null;
    const all = measuredBooks60(ticker);
    for (let i = all.length - 1; i >= 0; i--) {
      const v = book60Window(all[i], win);
      if (v) return v;
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onFeed, win, ticker, fFieldRead]);
  const feedRailData = useMemo(() => {
    if (!onFeed || !fBook) return null;
    if (fBook60) {
      const nan = { put: NaN, call: NaN, net: NaN };
      const rows: FeedStrike[] = fBook60.rows.map(r => ({ strike: r.strike, gex: { put: r.put, call: r.call, net: r.net }, dex: nan, vanna: nan, charm: nan, gexVol: nan, time: fBook60.at }));
      return feedRail({ ...fBook, spot: fBook60.spot, at: fBook60.at }, rows, null, false, fDay?.price ?? null);
    }
    const dateRows = cutDate ? fByDate?.get(cutDate) : null;
    if (cutDate && !dateRows) return null;
    const rows = dateRows ? [...dateRows].filter(r => fBook.rows.some(b => b.strike === r.strike)).sort((a, b) => a.strike - b.strike) : fBook.rows;
    return feedRail(fBook, rows, fOi, !dateRows, fDay?.price ?? null);
  }, [onFeed, fBook, fOi, fByDate, cutDate, fDay, fBook60]);
  const rawLiveRail = houseRail ?? feedRailData ?? emptyRail(fBook?.spot ?? 0);
  /* THE RAIL'S WALLS, FROM THE BOOK AND HELD (the owner, 2026-10-14 — trailModel WallStick, the field's one rule): the
     ladder's wall rows, the axis chips and the decision strip read these levels, so the stick stands here, one per name,
     fed each time the live rail is read anew (the book's poll, the house's scan); a new strike is the wall once it has
     been the raw pick and beaten the held wall by 10% for three minutes, or the held wall is no wall any more. The replay's
     rail is the store's own column, held the same way (data/replayFrame.ts). */
  const wallStickRef = useRef<{ ticker: string; stick: WallStick; firstAt: number; shown: WallShown | null }>({ ticker, stick: new WallStick(), firstAt: 0, shown: null });
  const liveRail = useMemo(() => {
    if (wallStickRef.current.ticker !== ticker) wallStickRef.current = { ticker, stick: new WallStick(), firstAt: 0, shown: null };
    const lv = rawLiveRail.levels;
    const fin = (v: number) => (Number.isFinite(v) ? v : null);
    const at = new Map<number, number>();
    for (const r of rawLiveRail.rows as readonly { strike: number; value: number }[]) at.set(r.strike, r.value);
    /* the house rail writes spot where it has no wall: no candidate then */
    const cw = fin(lv.callWall) != null && lv.callWall !== lv.spot && at.has(lv.callWall) ? lv.callWall : null;
    const pw = fin(lv.putWall) != null && lv.putWall !== lv.spot && at.has(lv.putWall) ? lv.putWall : null;
    if (!at.size) return rawLiveRail;
    const now = Date.now() / 1000;
    if (!wallStickRef.current.firstAt) wallStickRef.current.firstAt = now;
    const w = wallStickRef.current.stick.next({ time: now, spot: lv.spot, cw, pw, valueOf: k => at.get(k) ?? NaN });
    wallStickRef.current.shown = w;
    if (w.cw === cw && w.pw === pw) return rawLiveRail;
    return { ...rawLiveRail, levels: { ...lv, callWall: w.cw ?? (Number.isFinite(lv.callWall) ? NaN : lv.callWall), putWall: w.pw ?? (Number.isFinite(lv.putWall) ? NaN : lv.putWall) } };
  }, [rawLiveRail, ticker]);
  /* ══ THE REPLAY (the owner's item 8, 2026-10-14) ═══════════════════════════════════════════════════════════════
     The pane reads everything at the replay's cursor (components/terrain/useTerrainReplay.ts): the chart a tape cut there,
     the ladder and the levels the field's column there. On the feed the field is the replay's twin — a session the
     recorder kept whole is drawn as it was shown, the rest as the live chart draws them — and each session's priced move
     is asked once; the house's tape and field are held as they stood when the replay began. An index has no bars on
     these plans: nothing to replay. */
  const replayable = replay && !(onFeed && isCashIndex(ticker));
  /* an index on the feed has no minute bars on this plan, so no replay: a P or a door that asked for one is let go at
     once rather than leaving a badge with no transport that only P took down (the audit's A-02) */
  useEffect(() => {
    if (replay && !replayable) onExitReplay?.();
  }, [replay, replayable, onExitReplay]);
  const fTrailRec = useFeedTrailField(onFeed && replayable, ticker, fBars.bars, fFieldRead, trailCut, win, true);
  const replayPast = useMemo(() => (onFeed && replayable ? pastSessionsOf(fBars.bars) : []), [onFeed, replayable, fBars.bars]);
  const replayDays = useMemo(() => [...replayPast, nyIsoDate()], [replayPast]);
  const rpSessions = useReplaySessions(onFeed && replayable, ticker, replayDays, true);
  const houseReplay = useMemo(
    () => (replayable && !offHouse ? { bars: [...(Simulator.getCandles(Simulator.ensureTicker(ticker)) ?? [])], cols: [...(Simulator.getGexHistory(Simulator.ensureTicker(ticker)) ?? [])] } : null),
    [replayable, offHouse, ticker]
  );
  const budgetOf = useCallback((d: string): boolean | null => (onFeed ? !!rpSessions.moves.get(d) : null), [onFeed, rpSessions]);
  const sigmaFor = useCallback(
    (d: string) => {
      const m = rpSessions.moves.get(d);
      return m ? { prevClose: m.prevClose, s: m.sigma } : null;
    },
    [rpSessions]
  );
  const rp = useTerrainReplay({
    on: replayable,
    ticker,
    minutes: tfMinutes(offHouse && timeframe === '15s' ? '1m' : timeframe),
    bars: onFeed ? fBars.bars : houseReplay?.bars ?? null,
    cols: onFeed ? fTrailRec.snaps : houseReplay?.cols ?? EMPTY_COLS,
    daily: onFeed ? fDaily : null,
    compareBars,
    budgetOf,
    step: liveRail.step,
    sigmaOf: sigmaFor,
  });
  const rpRail = useMemo(() => (rp.frame ? frameRail(rp.frame) : null), [rp.frame]);
  /* a new name ends the replay — it was recorded in another world */
  const tickerSeen = useRef(ticker);
  useEffect(() => {
    if (tickerSeen.current !== ticker && replay) onExitReplay();
    tickerSeen.current = ticker;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker]);
  const railData = rp.active && rpRail ? rpRail : liveRail;
  /* BROKEN OR RECLAIMED (the owner, 2026-10-14: "Price crossing a wall no longer moves it; the chip shows 'broken', and
     'reclaimed' when price comes back"): each rail wall's state on today's closed minutes since it took its strike — the
     session's open for a wall standing since the page first read the book (trailModel wallStateOn, the stick's machine) */
  const railWallState = useMemo(() => {
    if (rp.active) return null;
    const bars = onFeed ? fBars.bars : offHouse ? null : Simulator.getCandles(Simulator.ensureTicker(ticker));
    if (!bars || !bars.length) return null;
    const nowS = Date.now() / 1000;
    const today = nyIsoDate();
    const [y, mo, d] = today.split('-').map(Number);
    const open = nyWallTime(y, mo, d, 9, 30) / 1000;
    const closed = bars.filter(b => b.time >= open && b.time + 60 <= nowS);
    const st = wallStickRef.current;
    const sinceOf = (t: number | undefined) => (t == null || t <= st.firstAt ? open : Math.floor(t / 60) * 60);
    const lv = liveRail.levels;
    const fin = (v: number) => (Number.isFinite(v) ? v : null);
    return {
      cw: wallStateOn('cw', fin(lv.callWall), closed, sinceOf(st.shown?.cwSince))?.state ?? null,
      pw: wallStateOn('pw', fin(lv.putWall), closed, sinceOf(st.shown?.pwSince))?.state ?? null,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rp.active, onFeed, fBars.bars, offHouse, ticker, liveRail, revision]);
  const levels = railData.levels;
  /* in a replay, the cursor's price against the session before's close: the official close the priced move stands on (the
     feed), the house's last bar of the session before */
  const rpPrevClose = useMemo(() => {
    if (!rp.active) return NaN;
    if (onFeed) return rpSessions.moves.get(rp.day)?.prevClose ?? NaN;
    const bars = houseReplay?.bars ?? [];
    const open = sessionSpan(rp.day).first;
    for (let i = bars.length - 1; i >= 0; i--) if (bars[i].time < open) return bars[i].close;
    return NaN;
  }, [rp.active, rp.day, onFeed, rpSessions, houseReplay]);
  const changePct = useMemo(
    () => (rp.active ? (Number.isFinite(rpPrevClose) && rpPrevClose > 0 ? (levels.spot / rpPrevClose - 1) * 100 : NaN) : offHouse ? fDay?.changePct ?? NaN : spotChangePct(ticker)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ticker, revision, offHouse, fDay, rp.active, rpPrevClose, levels.spot]
  );
  // Deterministic per ticker, so the dark-pool lines do not wander on a tick — on the feed, the session's three largest crosses
  const housePrints = useMemo(
    () => (offHouse ? [] : buildPrints(ticker, levels.spot)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ticker, offHouse]
  );
  const prints = offHouse ? fDark : housePrints;
  /* ON THE FEED the chart draws UW's minute bars as its tape, the books this terminal read today as its field, and the
     30-day implied vol as the name's vol (data/feed/levels.ts) */
  const feedIv = fMoves?.find(m => m.days === 30)?.volatility ?? null;
  const feedTape = useMemo(
    () =>
      onFeed && fBars.bars
        ? { bars: tapeBars ?? fBars.bars, iv: feedIv ?? 0, key: `feed:${ticker}`, book: fField, daily: allDaily ?? undefined, compareBars, earnings: fEarnings, macro: fMacro ?? [], pre: preTape }
        : undefined,
    [onFeed, fBars.bars, tapeBars, feedIv, ticker, fField, allDaily, compareBars, fEarnings, fMacro, preTape]
  );
  const feedRevision = useMemo(() => (feedRev += 1), [feedTape]); // eslint-disable-line react-hooks/exhaustive-deps
  /* no plan carries seconds: a pane kept on 15 s draws the minute until the reader picks again */
  const tf = offHouse && timeframe === '15s' ? '1m' : timeframe;
  const paneOverlays = overlays;
  const paneCompares = compares;
  /* the name's prints on the feed, as the chart's flow tape */
  const paneFlow = offHouse ? fPrints ?? EMPTY_FLOW : flowTape;
  /* AN INDEX ON THE FEED has its book but no bars on these plans — the chart says so in its place, and the ladder stands
     on the book's own rows (bookProjection) */
  /* SPX with no minutes from the recorder: why, by its session now (core/sessions.ts) and the server's Theta source */
  const spxEmptyWords = (() => {
    if (!tradesAllSessions(ticker)) return '';
    const now = Date.now();
    const s = fieldSessionAt(ticker, now);
    const src = overnightSourceOf(ticker);
    if (s && !indexPrintsAt(now)) {
      const where = s.session === 'gth' ? "SPX's overnight session" : s.session === 'curb' ? "SPX's curb" : 'After the index\'s close';
      if (src && !src.thetaKey) return `${where}: no S&P 500 value prints, and its options' quotes come through Theta's terminal — this server reads none. The ladder reads its book.`;
      if (src?.state === 'no-terminal') return `${where}: no S&P 500 value prints, and its options' quotes come through Theta's terminal — none runs on this server's machine (the always-on machine has one). The ladder reads its book.`;
      if (src?.state === 'no-answer') return `${where}: Theta answered no quotes yet. The ladder reads its book.`;
      return `${where}: waiting on the first quotes. The ladder reads its book.`;
    }
    return "SPX's minutes come from the server's recorder as it reads its prints — none recorded yet today. The ladder reads its book.";
  })();
  /* an index the recorder draws no minutes for (every one but SPX, or SPX before its first answer) */
  const noBars = onFeed && isCashIndex(ticker) && !(tradesAllSessions(ticker) && fBars.bars?.length);
  const indexTape = useMemo(
    () => (noBars ? { bars: EMPTY_BARS, iv: feedIv ?? 0, key: `feed:${ticker}`, book: fField, earnings: null, macro: fMacro ?? [] } : undefined),
    [noBars, feedIv, ticker, fField, fMacro]
  );
  const chartTape = noBars ? indexTape : feedTape;
  /* ══ THE HEADER'S BUDGET (the Terrain UI pass, 2026-10-14) ════════════════════════════════════════════════════════
     One row, its parts measured at 1440 × 900 on 2026-10-14 (the sweep holds the geometry — nothing over an axis — not
     these figures). THE FLOOR is the symbol chip, the price, the timeframe trigger and the fullscreen door with their
     gaps; a LINKED pane wears its letter at every width. Then the age chip as a dot, and,
     in the order a reader gains most, while the column pays: the tabs' shape, the window as a trigger, the jumps as
     a trigger, Replay · Alerts · Layers, the change, the age's words, the tabs' names, the badge, the ?, the compare +
     with the unlinked link chip, the pop-out, the window whole, the jumps whole (the costs below). What the row cannot pay for stands in the hover row
     (the three doors, the pop-out) or behind its key (?, the window's W, the jumps' T) — never on the price ticks.
     Width in, content out: nothing here reads its own rendered width, so a tier cannot feed back and oscillate. */
  const headPlan = (() => {
    /* the row's usable width: the strip's inner width less the row's own padding (px-2) and a few pixels of slack for
       a wider figure than the ones measured */
    const room = stripInner > 0 ? stripInner - 16 - 4 : 0;
    const GAPX = 8;
    const linked = cfg.link !== null && cfg.link !== undefined;
    /* measured 2026-10-14 at 1440 × 900: the symbol chip 78, the price 46, the trigger 52, the dot 10, the door 24, five
       gaps; the tight tabs 124 (72 over the trigger), the full 194 (70 more); the three doors 132 with the hairline
       before them; the window's trigger 49, its chips 158; the jumps' trigger with its calendar 83, whole 214; the
       change 44; the age's words 33 over the dot; the badge 16; the ? 24; the compare + 26 with the unlinked link chip
       32; the pop-out 24 */
    let used = 78 + 46 + 52 + 24 + 4 * GAPX + (linked ? 32 + GAPX : 0);
    const take = (px: number): boolean => {
      if (room !== 0 && room < used + px) return false;
      used += px;
      return true;
    };
    /* the age chip as a dot first — the least a column can hold beyond the floor */
    const ageDot = take(10 + GAPX);
    const tabsTight = take(72);
    const windowTrigger = onFeed && !isCashIndex(ticker) ? take(49 + GAPX) : false;
    const jumpTrigger = !noBars ? take(83 + GAPX) : false;
    const tools = take(132 + 1 + 2 * GAPX);
    const change = take(44 + GAPX);
    const ageWords = ageDot && take(33);
    const tabsFull = tabsTight && take(70);
    const badge = paneCount > 1 && take(16 + GAPX);
    const keys = take(24 + GAPX);
    const compare = take(26 + GAPX + (linked ? 0 : 32 + GAPX));
    const popOut = !!onPopOut && !bare && take(24 + 4);
    const windowFull = windowTrigger && take(158 - 49);
    const jumpFull = jumpTrigger && take(214 - 83);
    return { tabsForm: tabsFull ? ('full' as const) : tabsTight ? ('tight' as const) : ('none' as const), tools, windowForm: windowFull ? ('full' as const) : windowTrigger ? ('trigger' as const) : ('none' as const), jumpForm: jumpFull ? ('full' as const) : jumpTrigger ? ('trigger' as const) : ('none' as const), change, ageDot, ageWords, badge, keys, compare, popOut };
  })();
  const showChangePct = headPlan.change;
  const mtfForm = headPlan.tabsForm;
  const showBadge = headPlan.badge;
  const showCompareAdd = headPlan.compare;
  /* the C key opens Compare only where its door stands (the audit's A-236: with the door shed the key left a menu flag
     set with nothing to clear it, and ↑ ↓ j k stood still until another menu was opened and closed) */
  const compareRoom = showCompareAdd || expanded;
  useEffect(() => {
    registerCompareRoom?.(compareRoom);
  }, [compareRoom, registerCompareRoom]);
  useEffect(() => () => registerCompareRoom?.(null), [registerCompareRoom]);
  /* THE REPLAY'S TAPE: the live tape's kind, cut at the cursor — the house's held as it stood (item 8) */
  const replayTape = useMemo<ChartTape | undefined>(() => {
    if (!rp.active || !rp.cut) return undefined;
    const base: ChartTape = chartTape ?? { bars: [], iv: Simulator.TICKERS[Simulator.ensureTicker(ticker)]?.iv ?? 0, key: ticker };
    /* THE SERVER'S TILED SESSIONS CUT AT THE CURSOR TOO (2026-10-15, the audit): `pre` came uncut — with the cursor on a
       tiled day the chart drew that day's later bars and the field's later columns past the cursor. The sessions before
       stand whole; the cursor's day stands to the bar holding its minute; a wall's later move is not said; a day's
       per-minute peaks (the next session's prior basis) are kept only for days before the cursor's */
    const pre = base.pre;
    const cur = rp.cursor;
    const cutPre: ChartTape['pre'] = pre
      ? {
          tf: pre.tf,
          /* whole buckets only: the tile's bar and column for the cursor's bucket hold its later minutes — that bucket
             comes from the cut's own minutes */
          bars: pre.bars.filter(b => b.time + pre.tf * 60 - 60 <= cur),
          cols: pre.cols.filter(c => c.time + pre.tf * 60 - 60 <= cur),
          events: pre.events.filter(e => e[4] <= cur),
          maxima: new Map([...pre.maxima].filter(([d]) => d < nyIsoDate(cur * 1000))),
        }
      : undefined;
    return { ...base, bars: rp.cut.bars, book: rp.cut.cols, daily: rp.cut.daily, compareBars: rp.cut.compareBars ?? base.compareBars, pre: cutPre };
  }, [rp.active, rp.cut, rp.cursor, chartTape, ticker]);
  const replayRev = useMemo(() => (feedRev += 1), [replayTape]); // eslint-disable-line react-hooks/exhaustive-deps
  /* THE PRICED MOVE AT THE CURSOR: the cursor's day's budget and profile, and the 1σ left to the close off the straddle at
     the cursor's minute (the store's own rule — trailModel straddleOfMinute); never its calibration or its official
     close, both known only after the moment */
  const rpMove = useMemo<PricedMoveFeed | null>(() => {
    if (!rp.active || !rp.frame?.bar || !onFeed) return null;
    const m = rpSessions.moves.get(rp.day);
    if (!m) return null;
    const st = straddlesAtMinute(ticker, trailCut, true, rp.frame.bar);
    const sg = sigmaOf(st?.today ?? null);
    return { ...m, calibration: null, rem: sg != null && st?.today ? { sigma: sg, src: st.today.src, at: rp.frame.bar.time * 1000 } : null, close: null };
  }, [rp.active, rp.frame, rp.day, rpSessions, ticker, trailCut, onFeed]);
  /* the walls through the day on the feed: the books this terminal read today, charm's template off the newest book */
  const wallsSource = useMemo<WallsSource | null>(() => {
    if (!onFeed) return null;
    const charm = new Map<number, { charm: number; gamma: number }>();
    /* charm's template is the newest book's — a replay has no book of its minute, so its charm lens stands empty */
    if (!rp.active) for (const r of fBook?.rows ?? []) charm.set(r.strike, { charm: r.charm.net, gamma: r.gex.net });
    return { hist: rp.active && rp.cut ? rp.cut.cols : preTape ? mergeByTime(preTape.cols, fField) : fField, charm };
  }, [onFeed, fField, fBook, rp.active, rp.cut, preTape]);
  /* The rail's rows come off the SAME snapshot `levels` was reduced from. The
     header's three-strike read uses them too, so the line and the column can
     never name different strikes. Read even when the rail is hidden, because
     the header is not. */
  const rail = railData;
  /* HOW SURE, WITH THE FIELD (2026-10-13): on the feed the ladder's "How sure" also says how far the modeled field stands
     from Unusual Whales' own figures today — one line, no new panel */
  /* the field's line in How sure: its residual against the vendor's book, and the sessions rebuilt (the coverage line) */
  const fCoverage = useFieldCoverage(onFeed && fieldName && overlays.trails, ticker);
  const fieldLine = useMemo(() => [fTrail.residual, coverageLine(fCoverage)].filter(Boolean).join(' '), [fTrail.residual, fCoverage]);
  /* the track record (the owner's item 2): the level types scored against their baselines, in How sure and the hover card */
  const fRecord = useTrackRecord(onFeed && overlays.trails, ticker);
  /* THE PRICED MOVE (item 4): the day's budget, the profile, the live remaining 1σ, the calibration */
  const fMove = usePricedMove(onFeed && fieldName && (!!overlays.cone || overlays.trails), ticker);
  /* THE BEAD SCALE (item 5): the server's fixed and prior references, and the legend the chart hands back — kept only
     when its words would change, so a tick does not re-render the pane for nothing */
  const fScale = useBeadScaleRefs(onFeed && fieldName && overlays.trails, ticker);
  const [beadLegend, setBeadLegend] = useState<BeadLegend | null>(null);
  const onBeadLegend = useCallback((l: BeadLegend | null) => {
    setBeadLegend(prev => (prev && l && prev.ref === l.ref && prev.refG === l.refG && prev.sizeBy === l.sizeBy && prev.ring === l.ring && prev.at === l.at && prev.basis === l.basis && prev.sessions === l.sessions && prev.priorDay === l.priorDay && prev.greek === l.greek ? prev : l));
  }, []);
  const beadBasis: ScaleBasis = cfg.beadBasis ?? 'session';
  const beadFloor = cfg.beadFloor ?? 0;
  /* THE REGIME STRIP (item 3): the reference built nightly, and UW's directionalized sign in the house's sign — read
     whenever the pane is on the feed since the UI pass (the decision strip's Regime box reads them with the strip off) */
  const fRegime = useRegimeReference(onFeed && fieldName, ticker);
  const regimeDir = useMemo<1 | -1 | 0 | null>(() => {
    if (!onFeed) return null;
    const rows = totalOf(ticker)?.rows;
    const last = rows?.length ? rows[rows.length - 1] : null;
    const d = last?.[4];
    if (d == null || !Number.isFinite(d)) return null;
    /* UW's sign is the house's turned over (the house negates the book) */
    return d > 0 ? -1 : d < 0 ? 1 : 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onFeed, ticker, fTrail.snaps]);
  const recordSure = useMemo(
    () =>
      fRecord
        ? {
            lines: Object.values(fRecord.lines),
            note: fRecord.holdoutNote,
            scope: `Touches counted on ${fRecord.main.sessions} session${fRecord.main.sessions === 1 ? '' : 's'}${fRecord.main.firstDay && fRecord.main.lastDay ? ` (${isoDayLabel(fRecord.main.firstDay)} to ${isoDayLabel(fRecord.main.lastDay)})` : ''}; each level's bounce rate stands beside a strike-matched baseline's, never alone.`,
          }
        : undefined,
    [fRecord]
  );
  /* ONE σ_remaining FOR THE PANE (the owner, 2026-10-14): the live straddle's 1σ to the close — in a replay the one read
     at the cursor — else the budget's leftover σ_day × √(1 − used), said as the budget's. The strip's distances, the axis
     chips, the ladder's σ column and the hover cards all read this one; null once the session is over. */
  const moveNow = rp.active ? rpMove : fMove;
  const moveAt = rp.active ? (rp.frame?.bar ? rp.frame.bar.time * 1000 + 60_000 : null) : Date.now();
  const sessionMinute = moveAt == null ? null : Math.max(0, Math.min(SESSION_MINUTES, nyMinutes(moveAt) - (9 * 60 + 30)));
  const sigmaRem = useMemo<SigmaRem | null>(() => {
    if (!onFeed || !moveNow || sessionMinute == null || sessionMinute >= SESSION_MINUTES) return null;
    return sigmaRemOf(moveNow.rem, moveNow.sigma, shareBetween(moveNow.profile, 0, sessionMinute));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onFeed, moveNow, sessionMinute, revision]);
  /* THE PRICED MOVE BOX'S LINES in How sure: the straddle's and the budget's, two numbers, never one — the calibration
     under them live (a replay stands on sessions before its moment: no calibration there) */
  const moveSure = useMemo(() => {
    if (!onFeed || !moveNow || sessionMinute == null) return undefined;
    const over = sessionMinute >= SESSION_MINUTES;
    const lines = over ? ['The session is over: nothing left to the close.'] : remLines(moveNow.rem, moveNow.sigma, shareBetween(moveNow.profile, 0, sessionMinute), ms => printClock(ms));
    return { lines, ...(!rp.active && moveNow.calibration?.length ? { calibration: moveNow.calibration } : {}) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onFeed, moveNow, sessionMinute, rp.active, revision]);
  /* THE REGIME'S READING, as the chart's strip hands it (one reading for the chip and the box — trailModel
     regimeWordsOf); the How sure section it opens */
  const [regimeRead, setRegimeRead] = useState<(RegimeRead & { words: string; range: string | null }) | null>(null);
  const onRegime = useCallback((r: (RegimeRead & { words: string; range: string | null }) | null) => setRegimeRead(r), []);
  useEffect(() => setRegimeRead(null), [ticker]);
  /* THE READING WHEN THE STRIP IS OFF: the pane's own, off the newest column — the same functions, so the box and the
     chip can never disagree (in a replay the cursor's column; on the house its field's last moment) */
  const paneRegime = useMemo<(RegimeRead & { words: string; range: string | null }) | null>(() => {
    if (regimeRead) return regimeRead;
    const col: GexSnapshot | null = rp.active ? rp.frame?.column ?? null : offHouse ? (fTrail.snaps.length ? fTrail.snaps[fTrail.snaps.length - 1] : null) : (Simulator.getGexHistory(Simulator.ensureTicker(ticker)) ?? []).slice(-1)[0] ?? null;
    if (!col || !col.levels.length) return null;
    const at = col.time;
    const r = regimeReadOf(netOf(col.levels), nyMinutes(at * 1000), nyIsoDate(at * 1000), regimeForWindow(fRegime, win), win === 'all' && !rp.active ? regimeDir : null, at);
    return { ...r, words: regimeWordsOf(r, usdCompactSigned, ms => printClock(ms)), range: null };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regimeRead, rp.active, rp.frame, offHouse, fTrail.snaps, ticker, fRegime, win, regimeDir, revision]);
  const regimeSure = useMemo(
    () => (paneRegime ? { line: paneRegime.words, range: paneRegime.range, note: "Estimated dealer gamma (assumed sign) — it describes the next 30 to 60 minutes' range and the last half hour's momentum on negative days; never a level, and never the flip's side." } : undefined),
    [paneRegime]
  );
  /* A JUMP OF THE VIEW (the header's Today · 1W · 1M · 6M · 1Y · Max and its calendar): the timeframe that fits the
     span first — the pane's own intraday one for the session, 15 m for a week, hourly for a month, day bars beyond —
     then the chart's range (StrikeChart `jumpTo`) */
  const [jumpTo, setJumpTo] = useState<{ nonce: number; kind: 'span'; span: JumpSpan } | { nonce: number; kind: 'day'; day: string } | { nonce: number; kind: 'live' } | null>(null);
  /* A DAY THE TAPE DOES NOT HOLD (the UI pass — the "no data" card): the chart's answer to a day jump */
  const [noDay, setNoDay] = useState<{ day: string; first: string | null; last: string | null } | null>(null);
  const onJumpResult = useCallback((r: { day: string; found: boolean; first: string | null; last: string | null }) => setNoDay(r.found ? null : { day: r.day, first: r.first, last: r.last }), []);
  /* THE LIVE EDGE: the view's right edge on the last bar, or back in the past (the "Back to live" pill) */
  const [atLive, setAtLive] = useState(true);
  const onViewEdge = useCallback((v: boolean) => setAtLive(v), []);
  const backToLive = useCallback(() => {
    setNoDay(null);
    setJumpTo({ nonce: ++jumpNonce.current, kind: 'live' });
  }, []);
  const jumpNonce = useRef(0);
  const jumpSpan = useCallback(
    (span: JumpSpan) => {
      const m = tfMinutes(timeframe);
      const next: Timeframe = span === 'today' ? (m >= 1 && m <= 15 ? timeframe : '5m') : span === '1w' ? (m >= 15 && m <= 60 ? timeframe : '15m') : span === '1m' ? (m >= 60 && m <= 1440 ? timeframe : '1h') : '1D';
      if (next !== timeframe) onCfg({ timeframe: next });
      setJumpTo({ nonce: ++jumpNonce.current, kind: 'span', span });
    },
    [timeframe, onCfg]
  );
  const jumpDate = useCallback(
    (day: string, wanted?: Timeframe) => {
      /* a day the minutes reach keeps an intraday pane; an older one takes the day bars — unless the host names one */
      const ageDays = (Date.now() - new Date(`${day}T12:00:00`).getTime()) / 86_400_000;
      const m = tfMinutes(timeframe);
      const next: Timeframe = wanted ?? (ageDays > 30 ? '1D' : m >= 1 && m <= 60 ? timeframe : '15m');
      if (next !== timeframe) onCfg({ timeframe: next });
      setNoDay(null);
      setJumpTo({ nonce: ++jumpNonce.current, kind: 'day', day });
    },
    [timeframe, onCfg]
  );
  /* the sessions either side of a day the tape lacks (weekends skipped; a holiday is found by the tape's own answer) */
  const nextSession = (iso: string): string => {
    const d = new Date(`${iso}T12:00:00Z`);
    do d.setUTCDate(d.getUTCDate() + 1);
    while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
    return d.toISOString().slice(0, 10);
  };
  const jumpMin = useMemo(() => {
    const first = (fDaily && fDaily.length ? fDaily[0] : null) ?? (fBars.bars && fBars.bars.length ? fBars.bars[0] : null) ?? (!offHouse ? (Simulator.getCandles(Simulator.ensureTicker(ticker)) ?? [])[0] : null);
    return first ? nyIsoDate(first.time * 1000) : undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fDaily, fBars.bars, offHouse, ticker]);
  /* HOW OLD WHAT THE PANE SHOWS IS — the header's Live / data-age chip (paneAge.ts): the newest of the last bar's end,
     the quote's moment and the field's newest column against the clock; a closed market is not stale data */
  const age = useMemo<PaneAge | null>(() => {
    if (rp.active || noBars) return null;
    const at = Date.now();
    if (!offHouse) return paneAgeOf(at, [at], 60_000);
    const bars = fBars.bars;
    const barMs = tfMinutes(tf) * 60_000;
    const lastBar = bars?.length ? bars[bars.length - 1] : null;
    const col = fTrail.snaps.length ? fTrail.snaps[fTrail.snaps.length - 1] : null;
    const a = paneAgeOf(at, [lastBar ? lastBar.time * 1000 + barMs : null, fQuote?.at ?? null, col ? col.time * 1000 + 60_000 : null], liveWithinMs(barMs));
    if (a.kind === 'old' && nySessionPhase(at) !== 'open') return { ...a, kind: 'closed', words: `Closed · ${printClock(a.at ?? at)}` };
    return a;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rp.active, noBars, offHouse, fBars.bars, tf, fTrail.snaps, fQuote, revision]);
  /* THE STALE STATE (the UI pass): on the feed with the newest data past its window — the candles at six tenths, the
     beads at four, an amber chip in the header and on the price, a banner naming the last repriced minute, Retry */
  const stale = onFeed && age?.kind === 'old';
  const lastRepriced = fTrail.snaps.length ? fTrail.snaps[fTrail.snaps.length - 1].time * 1000 + 60_000 : age?.at ?? null;
  const retryFeed = useCallback(() => {
    const t = ticker.toUpperCase();
    for (const k of [`levels:bars:${t}`, `levels:bars-new:${t}`, `levels:book:${t}`, priceKey(t)]) refreshFeed(k);
  }, [ticker]);
  /* THE LEGEND'S SWITCH (the L key, the hover row's door) */
  const legendOn = cfg.legend !== false;
  /* THE DAY PANEL (the UI pass — history on a daily chart): a click on a day's bar opens its card — the close, the regime
     and the levels at the day's last modeled column, the three strikes nearest the close, and Unusual Whales' end-of-day
     book by strike beside it as the measured reference (spot-exposures/strike?date=, the date's END state) */
  const [dayPanel, setDayPanel] = useState<string | null>(null);
  useEffect(() => setDayPanel(null), [ticker, tf]);
  const onBarClick = useCallback(
    (t: number) => {
      if (tfMinutes(tf) < 1440) return;
      /* a day bar's stamp is its day's start on one clock or another (the fold's UTC midnight, the feed's noon UTC, the
         house's 09:30 New York): twelve hours on lands inside the session's own New York date on every one of them */
      setDayPanel(nyIsoDate((t + 12 * 3600) * 1000));
    },
    [tf]
  );
  const [dayBook, setDayBook] = useState<{ day: string; book: FeedBook | null; failed: boolean } | null>(null);
  useEffect(() => {
    if (!dayPanel || !onFeed || isCashIndex(ticker)) return;
    let gone = false;
    const day = dayPanel;
    setDayBook(null);
    void uwSpotGexByStrike(ticker, { date: day, limit: 500 }).then(r => {
      if (gone) return;
      setDayBook({ day, book: r.ok && r.data ? bookFrom(ticker, r.data) : null, failed: !r.ok });
    });
    return () => {
      gone = true;
    };
  }, [dayPanel, onFeed, ticker]);
  const dayRead = useMemo(() => {
    if (!dayPanel) return null;
    const day = dayPanel;
    const bar = (fDaily ?? (!offHouse ? Simulator.getCandles(Simulator.ensureTicker(ticker)) ?? [] : [])).find(b => nyIsoDate(b.time * 1000) === day) ?? null;
    /* a tiled session's minutes come from its 1m tile (Section I); today's and an untiled session's off the page's field */
    const tiled = tilesOn && day < nyIsoDate() ? tileDay(ticker, 1, win, day)?.cols ?? null : null;
    const cols = tiled ?? (offHouse ? fTrail.snaps : Simulator.getGexHistory(Simulator.ensureTicker(ticker)) ?? []).filter(c => nyIsoDate(c.time * 1000) === day);
    const last = cols.length ? cols[cols.length - 1] : null;
    const close = bar?.close ?? last?.spot ?? null;
    const spot = last ? last.spot ?? close ?? 0 : 0;
    const walls = last ? pickWalls(last.levels, spot, l => l.value) : null;
    const flip = last ? pickFlip(last.levels, spot, l => l.value) : null;
    const regime = last ? regimeReadOf(netOf(last.levels), nyMinutes(last.time * 1000), day, regimeForWindow(fRegime, win), null, last.time) : null;
    const nearest = last && close != null ? [...last.levels].sort((a, b) => Math.abs(a.strike - close) - Math.abs(b.strike - close)).slice(0, 3) : [];
    const uw = dayBook && dayBook.day === day && dayBook.book ? (() => {
      const b = dayBook.book!;
      const rows = b.rows.map(r => ({ strike: r.strike, value: r.gex.net }));
      return { walls: pickWalls(rows, b.spot, l => l.value), flip: pickFlip(rows, b.spot, l => l.value), spot: b.spot, at: b.at };
    })() : null;
    return { day, close, last, walls, flip, regime: regime ? regimeWordsOf(regime, usdCompactSigned, ms => printClock(ms)) : null, nearest, uw, uwFailed: dayBook?.day === day && dayBook.failed, uwWaiting: onFeed && !isCashIndex(ticker) && (!dayBook || dayBook.day !== day) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayPanel, fDaily, offHouse, ticker, fTrail.snaps, fRegime, win, dayBook, onFeed, tilesOn, tiles.version]);
  /* the day panel's session at the minute, from its 1m tile */
  useEffect(() => {
    if (dayPanel && tilesOn && dayPanel < nyIsoDate() && !tileHeld(ticker, 1, win, dayPanel)) void loadTileRange(ticker, 1, win, dayPanel, dayPanel);
  }, [dayPanel, tilesOn, ticker, win]);
  /* THE LADDER'S PEEK ON A PHONE (the UI pass): the three strikes nearest the price, a tap opening the ladder */
  const peek = useMemo(() => (belowLg && rail.rows.length ? [...rail.rows].sort((a, b) => Math.abs(a.strike - levels.spot) - Math.abs(b.strike - levels.spot)).slice(0, 3).sort((a, b) => b.strike - a.strike) : []), [belowLg, rail.rows, levels.spot]);
  /* THE LEVELS A RIGHT-CLICK CAN FOLLOW (item 7): the book's walls and flip, and its three heaviest strikes */
  const axisLevels = useMemo(() => {
    const fin = (v: number) => (Number.isFinite(v) && v > 0 ? v : null);
    return { callWall: fin(levels.callWall), putWall: fin(levels.putWall), flip: fin(levels.flip) };
  }, [levels.callWall, levels.putWall, levels.flip]);
  const top3 = useMemo(() => [...rail.rows].sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 3).map(r => r.strike), [rail.rows]);
  /* the field's largest node now, as the chart drew it (StrikeChart onTopNode) — the header's "Top" */
  const [topNode, setTopNode] = useState<number | null>(null);
  /* THE DECISION STRIP'S FIVE READS (the Terrain UI pass, 2026-10-14): one line each off what the pane already holds —
     the regime, the nearest named level each side with its distance in dollars and σ to the close, the priced move,
     what stands behind the track record, and how fresh the inputs are. Each box opens How sure at its own section. */
  const boxes = useMemo<DecisionBox[]>(() => {
    const out: DecisionBox[] = [];
    const price = levels.spot;
    const k = (v: number) => num(v, v % 1 === 0 ? 0 : 2);
    out.push(
      paneRegime
        ? { key: 'regime', label: 'Regime', words: `${regimeSide(paneRegime.net)} ${usdCompactSigned(paneRegime.net)}${paneRegime.pct != null ? ` · ${ordinal(paneRegime.pct)} pct` : ''}`, short: `${regimeSide(paneRegime.net)} ${usdCompactSigned(paneRegime.net)}`, title: paneRegime.words, tone: paneRegime.net < 0 ? 'calls' : 'puts' }
        : { key: 'regime', label: 'Regime', words: '—', short: '—', title: 'No column of the field yet', tone: null }
    );
    const fin = (v: number) => Number.isFinite(v) && v > 0;
    const cands: { name: string; price: number }[] = [];
    if (fin(levels.callWall)) cands.push({ name: 'CW', price: levels.callWall });
    if (fin(levels.putWall)) cands.push({ name: 'PW', price: levels.putWall });
    if (fin(levels.flip)) cands.push({ name: 'Flip', price: levels.flip });
    /* ONE "TOP" (the owner's orbs round 2, item 6, 2026-10-15: "The header says 'Top 765' and the axis chip says 'Top 755'.
       Use one definition, or two different names"): the names are the axis chips' own — CW, PW, Flip, Sup off the book,
       Top the field's largest node now, handed by the chart (onTopNode, beadScale `largestNodeOf`) */
    if (fin(levels.supreme) && !cands.some(c => Math.abs(c.price - levels.supreme) < 1e-9)) cands.push({ name: 'Sup', price: levels.supreme });
    if (topNode != null && fin(topNode) && !cands.some(c => Math.abs(c.price - topNode) < 1e-9)) cands.push({ name: 'Top', price: topNode });
    const above = cands.filter(c => c.price > price).sort((a, b) => a.price - b.price)[0] ?? null;
    const below = cands.filter(c => c.price < price).sort((a, b) => b.price - a.price)[0] ?? null;
    const side = (c: { name: string; price: number } | null, arrow: string, short: boolean) => {
      if (!c) return `${arrow} —`;
      const sg = sigmasAway(c.price, price, sigmaRem);
      const sigma = sg != null ? ` ${num(Math.abs(sg), 1)}σ` : '';
      return short ? `${arrow}${c.name} ${k(c.price)}${sigma || ` ${usdSigned(c.price - price)}`}` : `${arrow}${c.name} ${k(c.price)} ${usdSigned(c.price - price)}${sigma}`;
    };
    const have = fin(price) && cands.length > 0;
    out.push({ key: 'levels', label: 'Nearest', words: have ? `${side(above, '▲', false)} · ${side(below, '▼', false)}` : '—', short: have ? `${side(above, '▲', true)} ${side(below, '▼', true)}` : '—', title: "The nearest named level each side of the price — one of the chips on the price axis: a wall, the flip, the supreme (the book's heaviest strike) or Top (the field's largest node now) — its distance in dollars and in σ to the close", tone: null });
    if (sigmaRem && moveNow && sessionMinute != null) {
      const r = readoutOf(price, moveNow.prevClose, moveNow.sigma, sessionMinute, moveNow.profile);
      out.push({ key: 'move', label: 'Move', words: `±${usd(sigmaRem.sigma)} to close · ${sigmaRem.src === 'straddle' ? 'market' : 'budget'}${r ? ` · ${r.sigmas >= 0 ? '+' : '−'}${num(Math.abs(r.sigmas), 1)}σ day` : ''}`, short: `±${usd(sigmaRem.sigma)} ${sigmaRem.src === 'straddle' ? 'mkt' : 'bgt'}`, title: `${sigmaRem.src === 'straddle' ? "1σ to the close off the straddle on today's expiry, live" : '1σ to the close as the budget leaves it: σ_day × √(1 − the variance used)'} — and where the price stands on the day's budget`, tone: null });
    } else out.push({ key: 'move', label: 'Move', words: '—', short: '—', title: onFeed ? (sessionMinute != null && sessionMinute >= SESSION_MINUTES ? 'The session is over: nothing left to the close' : 'No priced move yet') : "No priced move off the house's tape", tone: null });
    if (fRecord) {
      const thin = fRecord.main.touches < 500 || fRecord.main.months < 12;
      out.push({ key: 'record', label: 'Record', words: `${fRecord.main.sessions} sessions · ${fRecord.main.touches} touches${thin ? ' · thin' : ''}`, short: `${fRecord.main.sessions}s · ${fRecord.main.touches}t${thin ? ' · thin' : ''}`, title: `${thin ? 'Insufficient data (under 500 touches or 12 months) — ' : ''}${fRecord.lines['call wall']}`, tone: thin ? 'warn' : null });
    } else out.push({ key: 'record', label: 'Record', words: '—', short: '—', title: onFeed ? 'No scorecard for this name yet' : "No track record off the house's tape", tone: null });
    if (onFeed) {
      const col = fTrail.snaps.length ? fTrail.snaps[fTrail.snaps.length - 1] : null;
      let vols = 0;
      let readGap = 0;
      if (col) for (const l of col.levels) {
        if (l.freshAt && l.freshAt > vols) vols = l.freshAt;
        if (l.readGap && l.readGap > readGap) readGap = l.readGap;
      }
      /* EVERY TIME SAYS WHAT IT IS (the orbs message, item 17: "The OI chip says 12:02 pm in one screenshot and 12:17 pm in
         the other; OI changes once a day — say what that time is"): the count is dated, the book's and the vols' times
         are their reads — the short form kept the times and dropped their words */
      /* WHAT EACH TIME IS (the owner, 2026-10-14, item 17 — "OI changes once a day — say what that time is"): open
         interest carries its DATE alone (counted once a day after the close, published before the open); the book's time
         is when Unusual Whales figured it (its rows' own stamp); the vols' time is the newest option trade a vol the
         field priced with came from (the newest column's `freshAt`) — it moves with each chain read, every ten minutes */
      /* THE CHAIN READ STOPPED (the owner's orbs round 2, item 8): the newest column stands on a read more than fifteen
         minutes old (trailModel READ_GAP_MS) — said in the warn ink, as its marks wear the stale edge */
      const gapWords = readGap ? `no chain read since ${printClock(readGap)}` : null;
      const parts = [fOi?.date ? `OI dated ${shortDay(fOi.date)}` : 'OI —', fBook ? `book figured ${printClock(fBook.at)}` : 'book —', vols ? `vols traded to ${printClock(vols)}` : null, gapWords].filter((x): x is string => !!x);
      const shortParts = [fOi?.date ? `OI ${shortDay(fOi.date)}` : 'OI —', vols ? `vols to ${printClock(vols)}` : fBook ? `book ${printClock(fBook.at)}` : null, readGap ? `no read since ${printClock(readGap)}` : null].filter((x): x is string => !!x);
      out.push({ key: 'freshness', label: 'Fresh', words: parts.join(' · '), short: shortParts.join(' · '), title: `${rail.sure[0]?.freshness ?? 'How fresh the inputs are'} — open interest carries its date alone: it is counted once a day after the close and published before the open. "Book figured" is when Unusual Whales figured the book by strike; "vols traded to" is the newest option trade behind the vols the field priced with, which moves with each chain read (every ten minutes)${readGap ? `. No chain read has come since ${printClock(readGap)}: the field's vols stand where that read left them, and its marks wear the stale edge` : ''}`, tone: readGap ? 'warn' : null });
    } else out.push({ key: 'freshness', label: 'Fresh', words: 'OI last close · spot live', short: 'OI last close', title: rail.sure[0]?.freshness ?? 'How fresh the inputs are', tone: null });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paneRegime, levels, topNode, sigmaRem, moveNow, sessionMinute, fRecord, onFeed, fTrail.snaps, fOi, fBook, rail.sure, revision]);
  /* THE LEVEL ALERTS IN HOW SURE (item 7): today's, each joined to its +15 and +30 minutes on the chart's own minutes */
  const levelEvents = useLevelLog(ticker);
  const alertSure = useMemo(() => {
    const today = nyIsoDate();
    const mine = levelEvents.filter(e => nyIsoDate(e.at) === today).slice(0, 12);
    if (!mine.length) return undefined;
    const bars = offHouse ? fBars.bars ?? [] : (Simulator.getCandles(Simulator.ensureTicker(ticker)) ?? []);
    const pts = (n: number) => numSigned(n, 2);
    const lines = mine.map(e => {
      const o = outcomesOf(e, bars);
      const said = o.map((x, i) => (x ? `+${i ? 30 : 15} min: ${x.held == null ? `${pts(x.points)} since` : `${x.held ? 'held' : 'gave way'}, ${pts(x.points)}`}` : `+${i ? 30 : 15} min: not yet`)).join(' · ');
      return `${printClock(e.at)} · tier ${e.tier}${e.stale ? ' (stale)' : e.capped ? ' (capped)' : ''} · ${e.words} — ${said}`;
    });
    return { lines };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelEvents, offHouse, fBars.bars, ticker, revision]);
  /* THE WINDOW IN HOW SURE (item 6): the badge, and what the field and the ladder read in the window */
  const windowSure = useMemo(() => {
    if (!onFeed || isCashIndex(ticker)) return undefined;
    const label = win === '0dte' ? '0DTE' : win === 'fri' ? 'To Friday' : win === 'opex' ? 'To monthly OPEX' : null;
    const line = !label
      ? null
      : fBook60
        ? `${label}: the field sums the contracts in the window, priced in the same pass as every other; the ladder reads Unusual Whales' 60-day book through the same window (${fBook60.expiries.length} expir${fBook60.expiries.length === 1 ? 'y' : 'ies'}, figured ${printClock(fBook60.at)}).`
        : `${label}: the field sums the contracts in the window; Unusual Whales' book by expiry has not been read yet today, so the ladder shows every expiry.`;
    return { badge: 'repriced every minute · all windows', line };
  }, [onFeed, ticker, win, fBook60]);
  /* THE CHARM-TO-CLOSE DRIFT IN HOW SURE (item 10): the newest column's — the cursor's in a replay — through the pane's
     window, priced by the model (trailModel driftToClose): one number, "mechanical drift, unvalidated" */
  const driftSure = useMemo(() => {
    if (!onFeed || isCashIndex(ticker)) return undefined;
    const col = rp.active ? rp.frame?.column ?? null : fTrail.snaps.length ? fTrail.snaps[fTrail.snaps.length - 1] : null;
    if (!col) return undefined;
    const at = col.time * 1000;
    const day = nyIsoDate(at);
    const v = driftOf(col, win);
    const note =
      "The day's expiry repriced ten minutes before it expires, with the price and each vol held; on Unusual Whales' clock a later expiry's time is whole days, the same all session, so it adds nothing, and every window reads the same. Dollars of the underlying, the field's delta sign (each contract's delta turned over). Unvalidated: no study measures index charm flows.";
    const end = driftEndOf(day);
    /* the label the owner asked for, the end on the reader's own clock */
    const head = `Delta to ${printClock(end)} · mechanical drift, unvalidated`;
    if (v == null)
      return {
        head,
        line: at + 30_000 >= end ? `Past ${printClock(end)} on ${isoDayLabel(day)}: nothing left to drift.` : `No contract expiring on ${isoDayLabel(day)} stands in the field: on the model's clock nothing moves before ${printClock(end)}.`,
        note,
      };
    const price = Number.isFinite(col.spot ?? NaN) ? ` at ${num(col.spot as number, 2)}` : '';
    return { head, line: `${usdCompactSigned(v)} of dealer delta by ${printClock(end)}${price}, the vols as traded by ${printClock(at + 60_000)}.`, note };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onFeed, ticker, rp.active, rp.frame, fTrail.snaps, win]);
  /* HOW SURE IN A REPLAY (item 8): the moment, what the ladder stands on there, and how the session is drawn — never the
     track record or the calibration (both stand on sessions after the moment) nor today's live alerts */
  const replaySure = useMemo(() => {
    if (!rp.active || !rp.frame) return null;
    const when = printClock(rp.cursor * 1000);
    const kept = rpSessions.recorded.get(rp.day)?.complete;
    const lines = [
      rp.frame.column
        ? `The ladder and the levels are the field's column at ${when} — the modeled net per strike (estimated dealer gamma, assumed sign) from what was knowable by the minute's end. Unusual Whales serves no book by strike for a past minute.`
        : `The field has no column at ${when}, so no level is drawn.`,
      'The track record and the priced move’s calibration are left out: both stand on sessions after this moment.',
    ];
    /* how fresh: how the session is drawn */
    const source = !onFeed ? "The house's tape and field as they stood when the replay began." : rp.day === nyIsoDate() ? "Today's session as the recorder read it, each minute on the vols traded by then." : kept ? 'This session is drawn as the recorder showed it live.' : "This session is rebuilt from Unusual Whales' dated history, each minute on the vols traded by then.";
    return { badge: `Replay · ${isoDayLabel(rp.day)} · ${when}`, lines, source };
  }, [rp.active, rp.frame, rp.cursor, rp.day, rpSessions, onFeed]);
  const railSure = useMemo(
    () =>
      replaySure
        ? rail.sure.map(x => ({ ...x, freshness: replaySure.source, ...(windowSure ? { window: windowSure } : {}), ...(regimeSure ? { regime: regimeSure } : {}), ...(moveSure ? { move: { lines: moveSure.lines } } : {}), ...(driftSure ? { drift: driftSure } : {}), replay: { badge: replaySure.badge, lines: replaySure.lines } }))
        : ((onFeed && (fieldLine || recordSure || moveSure || windowSure || driftSure)) || alertSure || regimeSure) && rail.sure
          ? rail.sure.map(x => ({ ...x, ...(onFeed && fieldLine ? { field: fieldLine } : {}), ...(regimeSure ? { regime: regimeSure } : {}), ...(onFeed && recordSure ? { record: recordSure } : {}), ...(onFeed && moveSure ? { move: moveSure } : {}), ...(onFeed && windowSure ? { window: windowSure } : {}), ...(onFeed && driftSure ? { drift: driftSure } : {}), ...(alertSure ? { alerts: alertSure } : {}) }))
          : rail.sure,
    [onFeed, fieldLine, recordSure, moveSure, windowSure, driftSure, alertSure, rail.sure, replaySure, regimeSure]
  );
  /* THE LADDER'S GHOST DOTS (item 8): each strike's net 10, 30 and 60 minutes before — in a replay off the field's columns
     at the cursor; live off the books the ladder itself reads (Unusual Whales' book read every minute, or its 60-day book
     through the window, every five; the house's own minutes) — never a column beside a book. A listed date has no
     history of its book: no dots. */
  const liveLagged = useMemo(() => {
    if (replay) return null;
    const nowMin = Math.floor(Date.now() / 60_000) * 60;
    if (!offHouse) return laggedAt(Simulator.getGexHistory(Simulator.ensureTicker(ticker)) ?? [], nowMin);
    if (!onFeed || cutDate) return null;
    if (win !== 'all') {
      const books = measuredBooks60(ticker)
        .map(b => book60Window(b, win))
        .filter((b): b is NonNullable<typeof b> => !!b)
        .map(b => ({ time: Math.floor(b.at / 60_000) * 60, levels: b.rows.map(r => ({ strike: r.strike, value: r.net })) }));
      return laggedAt(books, nowMin, undefined, 6);
    }
    return laggedAt(measuredBooks(ticker).map(b => ({ time: Math.floor(b.at / 60_000) * 60, levels: b.rows.map(r => ({ strike: r.strike, value: r.gex.net })) })), nowMin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replay, offHouse, onFeed, cutDate, win, ticker, revision, fFieldRead]);
  const lagged = rp.active ? rp.lagged : liveLagged;
  /* THE TRANSPORT (item 8): under the chart, at the foot of the price pane — the house's replay bar on the session's regular
     hours, at Terrain's paces (1×, 5×, 20× and 60× the market's own time), stepping a bar of the chart to its end, with go
     to, a random start and hide the future beside the way out */
  const replayBar = (() => {
    const c = rp.ctl;
    if (!c) return null;
    const day = rp.day || rp.days[rp.days.length - 1] || nyIsoDate();
    /* the track: New York's regular hours on the feed; the house's sessions keep their own hours, so its track is the span
       the day's minutes cover */
    const own = !onFeed && rp.minutesOfDay.length ? { first: rp.minutesOfDay[0], last: rp.minutesOfDay[rp.minutesOfDay.length - 1] } : sessionSpan(day);
    const first = c.phase === 'play' ? Math.min(own.first, rp.cursor) : own.first;
    const last = c.phase === 'play' ? Math.max(own.last, rp.cursor) : own.last;
    const tools = (
      <ReplayTools
        days={rp.days}
        day={day}
        onJump={rp.jump}
        onRandom={rp.random}
        ready={rp.readiness.filter(r => r.ready).length}
        hideFuture={c.hideFuture}
        onHideFuture={rp.setHideFuture}
        picked={c.phase === 'play'}
      />
    );
    return (
      <ReplayStrip
        phase={c.phase}
        pos={rp.cursor - first}
        length={Math.max(60, last - first)}
        startMin={onFeed ? 9 * 60 + 30 : nyMinutesOf(first)}
        playing={c.playing}
        onPlay={rp.setPlaying}
        pace={c.speed}
        onPace={v => rp.setSpeed(v as (typeof rp.speeds)[number])}
        paces={REPLAY_PACES}
        candleMin={Math.max(1, tfMinutes(offHouse && timeframe === '15s' ? '1m' : timeframe))}
        onSeek={pos => rp.seekTo(first + pos)}
        onStep={rp.stepBy}
        onExit={onExitReplay}
        words={c.phase === 'play' ? `${isoDayLabel(day)} · ${printClock(rp.cursor * 1000)}` : undefined}
        wordsAt={pos => printClock((first + pos) * 1000)}
        stateWord="replay"
        tools={tools}
      />
    );
  })();
  /* REPLAY FROM A BEAD (the UI pass): the pane's replay turned on, then the bead's bar picked once the transport stands */
  const pendingPick = useRef<number | null>(null);
  const onReplayFrom = useCallback(
    (time: number) => {
      pendingPick.current = time;
      if (!replay) onToggleReplay();
      else if (rp.ctl) {
        rp.pick(time);
        pendingPick.current = null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [replay, onToggleReplay, rp.ctl]
  );
  useEffect(() => {
    if (pendingPick.current == null || !rp.ctl) return;
    const t = pendingPick.current;
    pendingPick.current = null;
    rp.pick(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rp.ctl]);
  /* Esc ends the replay — the top layer, as every overlay on the terminal (ui/layers.ts) */
  /* a mode, not an overlay: Esc ends it, and the shell's ?, / and g keep working through it (the audit's A-247) */
  useEscapeLayer(replayable, onExitReplay, { mode: true });
  /* the keys reach the transport through refs, so the desk's handler (installed once) always plays the newest */
  const rpRef = useRef(rp);
  rpRef.current = rp;
  useEffect(() => {
    registerReplayKeys?.({ toggle: () => rpRef.current.togglePlay(), step: () => rpRef.current.stepBy(1), playing: () => !!rpRef.current.ctl?.playing, picking: () => rpRef.current.ctl?.phase === 'pick' });
    return () => registerReplayKeys?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /*
    THE FIVE TIMEFRAMES' TREND STATE — T-12.

    Off the SAME 1-minute base the tape is built from, aggregated per
    timeframe inside the engine, so the strip and any pane showing one of
    those intervals cannot disagree about where price sits.

    Skipped entirely when there is no room for it. MEASURED against the
    simulator's own buffer — 22 sessions of 390 one-minute bars, 8,580 of them
    — the engine costs 1.45ms a call, so four panes at the desk's ten scans a
    minute is about 58ms per minute of wall clock. Cheap, but not free, and a
    pane at 1024 with three neighbours never renders the result.
  */
  const confluence = useMemo(
    () => (mtfForm === 'none' ? [] : offHouse ? buildConfluence(fBars.bars ?? []) : buildConfluence(Simulator.getCandles(ticker) ?? [])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ticker, revision, mtfForm === 'none', offHouse, fBars.bars]
  );

  /* What the reader clicked in the rail, flashed on the chart. Clicking the
     same strike again clears it, so the rail is a toggle rather than a thing
     you can only turn on. It resets on a symbol change because a price from
     the last book means nothing against this one. */
  /* Where the chart puts a price, handed to the rail so the two columns cannot
     disagree. A ref, so it never re-renders anything: the rail reads it inside
     its own frame loop. */
  const projectionRef = useRef<PriceProjection | null>(null);
  /* an index on the feed: no chart to place prices, so the ladder's rows stand on the book's own scale round the price */
  const noBarsBoxRef = useRef<HTMLDivElement | null>(null);
  const noBarsChartProjection = useRef<PriceProjection | null>(null);
  const coreLo = rail.core.length ? Math.min(...rail.core.map(r => r.strike)) - rail.step : NaN;
  const coreHi = rail.core.length ? Math.max(...rail.core.map(r => r.strike)) + rail.step : NaN;
  useEffect(() => {
    if (!noBars) return;
    projectionRef.current = bookProjection(noBarsBoxRef.current, coreLo, coreHi);
    return () => {
      projectionRef.current = null;
    };
  }, [noBars, coreLo, coreHi]);
  /** T-23 — the pane's PNG exporter, filled by the chart. */
  const exportPngRef = useRef<(() => void) | null>(null);

  /* An expanded pane covers the desk, so the keyboard has to be inside it.
     Measured before this: thirteen Tabs from the expand button walked out of
     the overlay and into the pane underneath, and the overlay told assistive
     technology nothing about being modal at all. */
  const overlayRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(expanded, overlayRef);

  const [focus, setFocus] = useState<number | null>(null);
  useEffect(() => setFocus(null), [ticker]);
  /* THE LADDER UNDER `lg` (the audit's TE-6: the room's defining panel was simply missing on a phone and a tablet): a
     Strikes door on the pane lays the ladder over the chart's right side, on the chart's own price rows — the rail
     beside the chart needs a desk's width, the overlay does not. Off until pressed; a slot's business, never stored. */
  const [narrowLadder, setNarrowLadder] = useState(false);

  /* THE GAPS' REASONS (the owner's B1, 2026-10-14: "Never a blank chart without a reason"): a run of bars with no column
     of the field says why, from the store's state — the session's hours (the book is read 9:30 to 4:00 New York, said on
     the reader's clock), a past session the server has not rebuilt (queued, being rebuilt, failed and why, or beyond
     the ten sessions this page asks), today's minutes before the recorder's first chain read (building) or before its
     first column (not recorded), and the live edge (the newest column lags the bar by a minute or two). The chart draws
     the words over the run (StrikeChart `fieldGapCause`, gexNodesPrimitive findGaps). */
  const gapCause = useMemo(() => {
    if (!onFeed || !overlays.trails) return null;
    const snaps = fTrail.snaps;
    /* today's trading day — SPX's from 8:15 pm is the next one (its overnight session) */
    const today = fieldDayOf(ticker, Date.now());
    const lastCol = snaps.length ? snaps[snaps.length - 1].time : 0;
    let firstToday = 0;
    for (const c of snaps)
      if (fieldDayOf(ticker, c.time * 1000) === today) {
        firstToday = c.time;
        break;
      }
    const hours = `${marketClock(9, 30)} to ${marketClock(16, 0)}`;
    const past = fPast;
    const full = fTrail.full;
    const allSessions = tradesAllSessions(ticker);
    return (fromSec: number, toSec: number, empty: boolean): string | null => {
      /* COLUMNS THAT HOLD NO STRIKE (round 3, the gap sweep: AAPL's 0DTE window on a Tuesday or a Thursday — AAPL lists no
         contract settling those days, so every column of the window stood empty and the chart was blank with no reason) */
      if (empty) {
        if (win === '0dte') return `no ${ticker} expiry settles this day · the 0DTE window is empty`;
        if (win === 'fri') return 'no expiry to Friday · the window is empty';
        if (win === 'opex') return 'no expiry to the monthly · the window is empty';
        return 'no strike with gamma in these columns';
      }
      /* OUTSIDE THE NAME'S SESSIONS (core/sessions.ts — the owner, 2026-10-15: "SPY and QQQ: regular hours by default,
         with the gap outside them labelled"): an equity's field is its regular hours; SPX's its three sessions */
      const ses = fieldSessionAt(ticker, fromSec * 1000);
      const day = ses?.day ?? nyIsoDate(fromSec * 1000);
      if (!ses) {
        if (!isTradingIso(nyIsoDate(fromSec * 1000)) && !allSessions) return 'no session';
        const mFrom = nyMinutes(fromSec * 1000);
        if (allSessions) {
          if (mFrom >= GTH_END_MIN && mFrom < RTH_OPEN_MIN) return 'no session · the overnight session ends at ' + marketClock(9, 25);
          if (mFrom >= GTH_START_MIN || !isTradingIso(nyIsoDate(fromSec * 1000))) return 'no session';
          return `no session · Cboe's overnight session opens at ${marketClock(20, 15)}`;
        }
        return `outside regular hours · the field is ${hours}`;
      }
      if (day < today && tilesOn && tileTf) {
        /* a tiled session: what the server said of it (Section I) */
        if (tileHeld(ticker, tileTf, win, day)) return 'rebuilt · no column at these minutes';
        const said = tileSaid(ticker, tileTf, win, day);
        if (said?.failed) return `not rebuilt · ${said.failed}`;
        if (said?.building) return said.queued ? 'queued to rebuild' : 'rebuilding on the server';
        if (said?.none) return 'not rebuilt · nothing on the server to rebuild it from';
        if (!tileDays.includes(day)) return tiledBefore.includes(day) ? 'not loaded · scroll to it' : 'not rebuilt';
        return 'loading';
      }
      if (day < today) {
        if (past?.failedWhy[day]) return `not rebuilt · ${past.failedWhy[day]}`;
        if (past?.working === day) return 'rebuilding on the server';
        if (past?.queuedDays.includes(day)) return 'queued to rebuild';
        if (past?.readyDays.includes(day)) return 'rebuilt · no column at these minutes';
        if (past && !past.days.includes(day)) return 'not rebuilt · beyond the ten sessions asked';
        return 'not rebuilt yet';
      }
      /* SPX WHERE ITS INDEX DOES NOT PRINT (overnight, 4:00 to 4:15 pm, the curb): its field stands on its options' quotes,
         read through Theta's terminal on the machine the server runs on — say which is missing */
      if (allSessions && !indexPrintsAt(fromSec * 1000) && (lastCol === 0 || fromSec > lastCol || toSec <= firstToday || !firstToday)) {
        const where = ses.session === 'gth' ? 'overnight' : ses.session === 'curb' ? 'curb' : "after the index's close";
        const src = overnightSourceOf(ticker);
        if (!src) return `${where} · asking the server`;
        if (!src.thetaKey) return `${where} · this server reads no Theta — its quotes are the only source here`;
        if (src.state === 'no-terminal') return `${where} · no Theta terminal runs on this server's machine`;
        if (src.state === 'no-answer') return `${where} · Theta answered no quotes`;
        return `${where} · no quotes read yet`;
      }
      if (!firstToday) return full ? 'no column today' : 'chain not read yet · building';
      if (lastCol > 0 && fromSec >= lastCol) {
        const lag = Math.max(1, Math.round((toSec - lastCol) / 60));
        return `live lag · ${lag} min`;
      }
      if (toSec <= firstToday) return 'not recorded · before the first read';
      return 'not recorded';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onFeed, overlays.trails, fTrail.snaps, fTrail.full, fPast, tilesOn, tileTf, win, ticker, tileDays, tiledBefore, tiles.version]);

  /* development only: what this pane stood at if React reports a render loop (src/dev/depthTrap.ts — the owner,
     2026-10-14: "log the component and state when it fires") */
  const depthRef = useRef<Record<string, unknown>>({});
  depthRef.current = { ticker, tf, stripW, stripH, isPhone, narrowLadder, atLive, dayPanel, plan: headPlan };
  useEffect(() => (import.meta.env.DEV ? registerDepthState(`terrain pane ${ticker}`, () => depthRef.current) : undefined), [ticker]);

  /* What a move to each strike forces dealers to trade — the panel's second
     lane, off the SAME rows the size lane draws, so the flow beside a capsule
     is the flow of that capsule's book. */
  const flow = useMemo(() => (rail.rows.length ? buildFlowFromRows(rail.rows, levels.spot) : null), [rail, levels.spot]);
  /* THE LADDER'S TWO LEGS (2026-09-13): the put and call hedging behind every
     strike's net, off the live chain, and the net at the open as a ratio of
     now for the spine's ghost — the size lane draws the strike ladder's rows */
  const legs = railData.legs;
  const openRatio = useMemo(
    () => (rp.active && rp.cut ? feedOpenRatio(rp.cut.cols, rp.asOf ?? undefined) : offHouse ? feedOpenRatio(fField) : netSinceOpenRatio(ticker)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ticker, revision, offHouse, fField, rp.active, rp.cut, rp.asOf]
  );
  /* The panel's "How to read", as a focus over this pane — the Map's own card */
  const [guideOpen, setGuideOpen] = useState(false);

  /*
    THE HOVERED BAR — T-8. The chart reports its own values at the crosshair,
    for a pointer on this plot and for a moment arriving from another pane, so
    a synced desk reads values on every pane rather than only under the cursor.

    Cleared on a change of symbol or interval as well as on the chart's own
    leave. The chart does emit null when the pointer goes, but a reload is not
    a leave: switching symbol with the pointer still resting on the plot would
    otherwise leave the last name's prices in this row under the new name's
    tape. Same reason `focus` resets.
  */
  const [readout, setReadout] = useState<CrosshairBar | null>(null);
  useEffect(() => setReadout(null), [ticker, timeframe]);


  /* THE CHROME WEARS THIS PANE'S THEME (Noah, 2026-09-13, three cuts in one night: "the
     tool chart should NEVER change colors" → "the only thing I specified as staying black
     was the drawing tool bar" → "now you can change the top section to match the chart
     theme"). The pane stamps the ground of ITS OWN theme on its box (data-chart-ground —
     the store's theme is not this pane's, which is what painted a dark pane's strip light
     grey the first time), and index.css re-scopes the tokens on every strip and chip inside
     to that ground: Stone's chrome is stone with dark ink, a dark tape's is black with light
     ink, the drawing rail stays black on either. THE FRAME FOLLOWS TOO (the owner, 2026-10-02,
     with the light Terrain: "the terrain still has one black one white fix that" — every pane
     was a white tape beside a black ladder): the box carries data-chart-frame, so on a light
     ground its panel, its edge, the corner chip and the ladder beside the tape (ProfilePanel's
     `ground`) wear the chart's light set; a dark ground keeps the dark island exactly as it was. */
  const ground = chartGround(theme);
  const surface = 'rgb(var(--panel))';
  /* The strip's 55% wash of the chrome's panel — the strip carries data-chart-chrome, so the
     token it reads is the ground's: black over a dark tape, stone over a light one */
  const strip = 'rgb(var(--panel) / 0.55)';

  const up = changePct >= 0;

  /*
    WHAT OF THE READOUT FITS — the same width budget the rows above spend, and
    the same rule: the row does not wrap and it does not clip, so it sheds.

    `stripInner === 0` is the frame before the first measurement, where the
    honest default is everything — a shed row that then grows reads as a
    glitch, a full row that then sheds reads as a fit.
  */
  const readoutInds = readout?.indicators.length ?? 0;
  const roomForReadout = (px: number) => stripInner === 0 || stripInner >= px;
  const showReadoutInds = readoutInds > 0 && roomForReadout(READOUT_C_PX + READOUT_OHL_PX + READOUT_VOL_PX + readoutInds * READOUT_IND_PX);
  const showReadoutVol = readout?.volume != null && roomForReadout(READOUT_C_PX + READOUT_OHL_PX + READOUT_VOL_PX);
  const showReadoutOhl = readout?.open != null && roomForReadout(READOUT_C_PX + READOUT_OHL_PX);

  /* COMPACT WHEN THE STRIP WOULD NOT FIT ON ONE LINE — the mode the phone
     already uses (ChartToolbar's `compact`): the seven timeframes collapse
     into the current interval as a trigger, and every dropdown trades its
     word for its icon, keeping the word as the hover/AT name.

     Measured after: 818px of controls becomes 350px. Four rows become one at
     1280 and up in every layout (177px of chrome down to 112, 43% of the
     pane down to 27%), and two at 1024 with 2+ panes, where the column is
     only 369px (205px down to 145, 50% down to 35%). The single wide pane
     beside a narrow one keeps its full labels, because the test is its own
     column's width.

     THE 1180 CLAIM WAS WRONG, and by one pixel. This read "one at 1180/1280
     in every layout"; re-measured across the whole width × layout matrix, at
     1180 with 2+ panes the toolbar's usable column is 349px and the compact
     strip is 350, so it takes two rows there and always has. The same
     350-into-347 happens in the three-up at 1760, which the old note did not
     mention either. Verified against a clean build of the tree before T-7 —
     identical at every cell — so it is a stale claim rather than a
     regression, and the sweep now asserts what is true rather than what was
     written. Closing that pixel means shrinking a control that no current
     work touches; it is recorded here rather than quietly rounded away. */
  const toolbarCompact = stripW > 0 && stripW - PRICE_GUTTER_PX < TOOLBAR_FULL_PX;
  /* THE TOOLBAR RIDES THE IDENTITY ROW WHEN THE ROW HAS THE ROOM (Noah, 2026-09-16: "if I ever
     have enough space on the top section then this timeframe / replay all the way down to the
     right row should take its place in the top section like we have on the singular live chart
     for Pulse"): the identity at its fullest (the change and the confluence strip) plus a gap
     plus the toolbar as it would draw — full or compact — plus the fullscreen door, which
     joins the row's end then, against the strip's usable width. It never wraps inside the
     row; short of the room it keeps its own line below the book. */
  /* the doors at the row's end: the fullscreen one, the pop-out beside it on the desk, none in a pop-out */
  const rowDoorPx = bare ? 0 : onPopOut ? ROW_DOOR_PX + 28 : ROW_DOOR_PX;
  /* THE TOOLBAR NEVER RIDES THE HEADER NOW (the Terrain UI pass, 2026-10-14): the header is one row of its own —
     identity, facts, the age chip, the timeframe, the window, the jumps, Replay, Alerts, the layers, ? and the doors —
     and the rest of the toolbar is the hover row under it, on every width */
  const toolbarInline = false;
  const toolbarCompactShown = toolbarCompact;

  /* ONE TOOLBAR, TWO MOUNTS (Noah, 2026-08-28: "make the row ... sit up top
     like how the fullscreen of the pulse page does"). Docked it is the
     hover-revealed chip floating over the tape; expanded it is the always-on
     strip pinned across the pane's top, the Pulse fullscreen grammar. A
     render function rather than two prop lists, so a control added later
     cannot exist in one mount and not the other. */
  /*
    THE IDENTITY CONTROLS, hoisted (Noah, 2026-08-29: fullscreen "should look
    like the pulse top section with the ticker on the most top section far
    left then followed by the rest"). One definition, two homes: EXPANDED
    they lead the pinned strip, exactly as Pulse's takeover leads with its
    symbol capsule; DOCKED they stay in the floating chip over the tape.
  */
  const identityControls = (
    <>
      {showBadge && (
        <span
          aria-hidden
          className={`shrink-0 w-4 h-4 rounded-[3px] font-mono text-[11px] font-bold tnum inline-flex items-center justify-center ${
            isActive ? 'holo-bg text-[#0a0a0a]' : 'bg-ink/[0.08] text-textPrimary'
          }`}
        >
          {index + 1}
        </span>
      )}
      {/*
        THE REPLAY BADGE — T-13, and it is the reason the rest of this is
        safe to ship. A pane in replay looks exactly like a live one, and the
        transport sits at the BOTTOM where a glance never reaches. It is NOT
        shed at any width: everything else here is a convenience; this one
        says which world you are looking at.
      */}
      {replayable && (
        <span
          title="This pane is replaying history — it is not live"
          className="shrink-0 inline-flex items-center gap-1 px-1.5 h-4 rounded-[3px] bg-silverFill text-[#0a0a0a] font-mono text-[11px] font-bold"
          data-replay-badge
        >
          <span className="uppercase tracking-wider">Replay</span>
          {/* the moment on screen (item 8: "REPLAY - <date> <time>" so a replay is never mistaken for live) */}
          {rp.active ? <span className="tnum">· {isoDayLabel(rp.day)} · {printClock(rp.cursor * 1000)}</span> : <span className="font-semibold">· pick a bar</span>}
        </span>
      )}
      <span className="shrink-0 inline-flex items-center gap-1.5">
        {/* The own-name scope chip (2026-09-06): every Terrain pane holds its
            own name, so it wears the bordered chip with the mark. */}
        <ScopeChip
          ticker={ticker}
          onPick={t => onCfg({ ticker: t })}
          open={menuOpen === 'symbol'}
          onOpenChange={o => onMenu(o ? 'symbol' : null)}
          /* The ring ↑/↓ walks is invisible, so the one control it moves is
             where it gets named. */
          title="Switch ticker — S · ↑ ↓ step your symbols"
        />
        {/* T-20's link chip, shell-wide since 2026-10-10 (components/link/LinkGroupChip.tsx): none, or a group A–D that
            every room shares — a pane in A reads group A's name and a name picked on it moves the group. Letters, not
            colours — the palette's inks all mean something already. */}
        {(cfg.link !== null && cfg.link !== undefined || showCompareAdd || expanded) && (
          <LinkGroupChip size="sm" group={cfg.link ?? null} onChange={g => onCfg({ link: g })} noneHint="Stands alone — its own name" what="this pane" />
        )}
        {/* TradingView's "+" beside the symbol capsule — cross another
            symbol onto this tape. Fullscreen always has room for it. */}
        {(showCompareAdd || expanded) && (
          <CompareControl
            current={ticker}
            compares={compares}
            onAdd={addCompare}
            onRemove={removeCompare}
            open={menuOpen === 'compare'}
            onOpenChange={o => onMenu(o ? 'compare' : null)}
          />
        )}
      </span>
    </>
  );

  /* THE FACTS beside the identity: the price, an index's print chip, the Strikes door under lg, the change */
  /* SPX'S PRICE FROM ITS OPTIONS (the owner, 2026-10-15: "Label it 'price from options (overnight)'") */
  const optionsChip = fQuote?.source === 'options' && fQuote.at != null && (
    <span className={`shrink-0 font-mono text-[11px] tnum ${fQuote.stale ? 'text-warn' : 'text-textMuted'}`} data-pane-print="options" title={`No S&P 500 index value outside 9:30 am to 4:00 pm New York: the price is the forward SPX's at-the-money options imply by put-call parity (the median of the three strikes nearest parity on the front expiry), ${printClock(fQuote.at)}${fQuote.stale ? ' — older than two minutes' : ''}`}>
      price from options ({fieldSessionAt(ticker, fQuote.at - 60_000)?.session === 'gth' ? 'overnight' : 'after the close'}){fQuote.stale ? ' · stale' : ''}
    </span>
  );
  const printChip = fQuote?.source === 'print' && fQuote.at != null && (
    <span className={`shrink-0 font-mono text-[11px] tnum ${fQuote.stale ? 'text-warn' : 'text-textMuted'}`} data-pane-print={fQuote.stale ? 'stale' : 'fresh'} title={`The index is priced off its newest option print carrying a price, ${printClock(fQuote.at)}${fQuote.stale ? ' — older than two minutes' : ''}`}>
      {printClock(fQuote.at)} print{fQuote.stale ? ' · stale' : ''}
    </span>
  );
  const facts = (
    <>
      <span className={`shrink-0 ${stale ? 'text-warn [&_*]:!text-warn' : ''}`} data-price-stale={stale ? '' : undefined} title={stale ? 'The price is as old as the data' : undefined}>
        <SpotPrice value={levels.spot} />
      </span>
      {printChip}
      {optionsChip}
      {/* under lg the ladder's door is the peek over the chart's foot (the UI pass); the Strikes button stands only
          where the peek has nothing to show */}
      {belowLg && rail.rows.length > 0 && peek.length === 0 && (
        <button
          type="button"
          onClick={() => setNarrowLadder(v => !v)}
          aria-pressed={narrowLadder}
          title={narrowLadder ? 'Hide the strike ladder' : 'Show the strike ladder over the chart'}
          className={`hit shrink-0 pointer-events-auto inline-flex items-center h-5 px-1.5 rounded-[3px] font-mono text-[11px] font-semibold transition-colors ${narrowLadder ? 'bg-ink/[0.16] text-textPrimary' : 'text-textSecondary hover:text-textPrimary hover:bg-ink/[0.06]'}`}
          data-narrow-ladder
        >
          Strikes
        </button>
      )}
      {/* First thing the row gives up when the column is narrow (ID_ROW_FULL_PX) — the price it is a delta of is
          directly to its left, and the chart draws the same move; the house's percent, a signed figure (data-dir) */}
      {showChangePct && Number.isFinite(changePct) && (
        <span className={`shrink-0 font-mono text-[11px] font-semibold tnum ${up ? 'text-bull' : 'text-bear'}`} data-dir={up ? 'up' : 'down'}>
          {pctSigned(changePct)}
        </span>
      )}
    </>
  );
  /* WALLS THROUGH THE DAY'S LENS, chosen in the pane while the walls are drawn — on the hover row, where the header's
     width budget is not spent */
  const wallsLens = (
    <span role="group" aria-label="Walls through the day — the lens" className="shrink-0 pointer-events-auto inline-flex items-center gap-0.5 rounded-[3px] border border-ink/[0.10] p-px" data-walls-lens>
      {WALLS_LENSES.map(o => {
        const on = (cfg.wallsLens ?? 'gex') === o.value;
        return (
          <button key={o.value} type="button" aria-pressed={on} title={o.hint} onClick={() => onCfg({ wallsLens: o.value })} className={`hit h-[18px] px-1.5 rounded-[2px] font-mono text-[11px] transition-colors ${on ? 'bg-ink/[0.14] text-textPrimary font-semibold' : 'text-textMuted hover:text-textPrimary'}`}>
            {o.label}
          </button>
        );
      })}
    </span>
  );
  /* THE BEAD SCALE'S BASIS AND FLOOR (item 5 (b) and (e)) — on the hover row since the legend became one line */
  const beadControls = (
    <>
      <span role="group" aria-label="What full brightness is measured against" className="shrink-0 inline-flex items-center gap-0.5 rounded-[3px] border border-ink/[0.10] p-px" data-bead-basis-pick>
        {(['session', 'fixed', 'prior'] as const).map(b => {
          const on = beadBasis === b;
          return (
            <button key={b} type="button" aria-pressed={on} title={BASIS_HINT[b]} onClick={() => onCfg({ beadBasis: b === 'session' ? undefined : b })} className={`hit h-[16px] px-1.5 rounded-[2px] text-[11px] transition-colors ${on ? 'bg-ink/[0.14] text-textPrimary font-semibold' : 'text-textMuted hover:text-textPrimary'}`}>
              {BASIS_LABEL[b]}
            </button>
          );
        })}
      </span>
      <label className="shrink-0 inline-flex items-center gap-1 text-[11px] text-textMuted cursor-pointer" title="Every strike at full light at any zoom — off, a strike that is no level of its column steps back zoomed out and far from the price (the levels never do)" data-bead-density>
        <input type="checkbox" className="accent-[rgb(var(--silver))]" checked={cfg.beadDensity === false} onChange={e => onCfg({ beadDensity: e.target.checked ? false : undefined })} />
        Every strike
      </label>
      <span role="group" aria-label="Floor: hide the beads under a share of full brightness" title="Hide the beads under a share of full brightness — always measured against the reference, never against the single largest bead" className="shrink-0 inline-flex items-center gap-0.5 rounded-[3px] border border-ink/[0.10] p-px text-[11px] text-textMuted" data-bead-floor>
        <span className="px-1">Floor</span>
        {FLOORS.map(f => {
          const on = beadFloor === f;
          return (
            <button key={f} type="button" aria-pressed={on} onClick={() => onCfg({ beadFloor: f > 0 ? f : undefined })} className={`hit h-[16px] px-1.5 rounded-[2px] text-[11px] tnum transition-colors ${on ? 'bg-ink/[0.14] text-textPrimary font-semibold' : 'text-textMuted hover:text-textPrimary'}`}>
              {f === 0 ? 'Off' : `${Math.round(f * 100)}%`}
            </button>
          );
        })}
      </span>
    </>
  );

  const paneToolbar = (spread: boolean, parts?: Partial<Record<ToolbarPart, boolean>>, compact?: boolean) => (
    <ChartToolbar
      minimal
      candles
      compact={compact ?? toolbarCompactShown}
      parts={parts}
      /* Docked, the menus are the small ones, and every menu stays inside this pane (Noah, 2026-09-13) */
      dense={!expanded}
      menuBounds={paneBoxRef}
      spread={spread}
      alertTicker={ticker}
      alertSpot={levels.spot}
      timeframe={tf}
      /* on the feed 15 s stands held — no plan carries seconds */
      heldTimeframes={offHouse ? FEED_HELD : undefined}
      onTimeframe={next => onCfg({ timeframe: next })}
      overlays={overlays}
      onOverlays={o => onCfg({ overlays: o })}
      /* Everything EXCEPT the strike band: that band docks under the Pulse
         chart only (no Terrain surface mounts it — his tree included), and a
         switch that cannot turn anything on is a lie in a menu. Inherited
         dead toggle, caught 2026-08-28. */
      overlayKeys={['trails', 'levels', 'darkpool', 'volume', 'flow', 'netDrift', 'volDrift', 'session', 'cone', 'events', 'alerts', 'walls', 'phases', 'regime']}
      indicators={indicators}
      onIndicators={i => onCfg({ indicators: i })}
      paneId={`terrain:${index + 1}`}
      fullscreen={expanded}
      chartStyle={chartStyle}
      onChartStyle={st => onCfg({ chartStyle: st })}
      themeKey={theme}
      onThemeKey={t => onCfg({ theme: t })}
      /* range and volume bars: the house's live seconds, or on the feed the minutes, folded by rule */
      barClock={clock}
      onBarClock={k => onCfg({ clock: k })}
      priceScale={priceScale}
      onPriceScale={ps => onCfg({ priceScale: ps })}
      priceScaleLock={scaleLock}
      onExportPng={() => exportPngRef.current?.()}
      sessionOr={sessionOr}
      onSessionOr={o => onCfg({ sessionOr: o })}
      replay={replay}
      onToggleReplay={onToggleReplay}
    />
  );

  /* THE HEADER'S TIMEFRAME: the five tabs with their trends where the row has the room (T-12), else the compact
     trigger — and the pane's own timeframe named where the tabs do not carry it (TE-1, TE-12) */
  const headTimeframes =
    mtfForm !== 'none' && confluence.length > 0 ? (
      <>
        <ConfluenceStrip rows={confluence} form={mtfForm} current={tf} onPick={next => onCfg({ timeframe: next })} />
        {!confluence.some(c => c.tf === tf) && (
          <span className="shrink-0 font-mono text-[11px] font-semibold text-textSecondary" title="This pane's timeframe — the toolbar under the pointer changes it" data-pane-tf>
            {tf}
          </span>
        )}
      </>
    ) : null;
  /* THE FULLSCREEN DOOR, one button with two homes when docked: the corner chip at rest, or the
     identity row's last item when the toolbar rides that row (Noah, 2026-09-16: "does the full
     screen button look aligned to you with the rest?" — the chip stood 4px above the row's
     centre and its 28px covered the Theme button's end). */
  const popOutDoor = !bare && onPopOut && (
        <button
          onClick={onPopOut}
          aria-label={`Open ${ticker}'s pane in its own window`}
          title="Open this pane in its own window — for a second screen; it keeps the name, the link group and the theme in step"
          className="hit shrink-0 inline-flex items-center justify-center w-6 h-6 rounded text-textMuted hover:text-textPrimary hover:bg-ink/[0.05] transition-colors"
          data-popout-door="terrain"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
  );
  const expandDoor = bare ? null : (
    <span className="inline-flex items-center gap-1">
      {/* POP-OUT (2026-10-10): this pane in a window of its own, for a second screen — kept in step with the terminal;
          where the header's budget cannot pay for it, it stands in the hover row */}
      {headPlan.popOut && popOutDoor}
      <button
        onClick={onToggleExpand}
        aria-pressed={expanded}
        aria-label={`Expand ${ticker} to the full screen`}
        title="Expand this pane — F"
        className="hit shrink-0 inline-flex items-center justify-center w-6 h-6 rounded text-textMuted hover:text-textPrimary hover:bg-ink/[0.05] transition-colors"
        data-expand-door
      >
        <Maximize2 className="w-3.5 h-3.5" />
      </button>
    </span>
  );

  return (
    <div
      ref={overlayRef}
      /* IN AND OUT ON A FADE, the Pulse takeover's own grammar (Noah,
         2026-08-28: "the full screen enter and exit for terrain ... the pulse
         has a nice smoothness to it"). Enter is the house soft-in; exit is a
         200ms opacity fade that the desk's `closeExpanded` holds the unmount
         open for. Opacity only — a transform on a fixed layer would become
         the containing block for anything fixed inside it. */
      className={
        expanded
          ? `fixed inset-0 z-[80] flex flex-col animate-soft-in transition-opacity duration-200 ease-out ${
              closing ? 'opacity-0' : ''
            }`
          : 'contents'
      }
      {...(expanded
        ? /* the script editor's dock takes the right edge while it is open (data/editorDock.ts) */
          { role: 'dialog' as const, 'aria-modal': true, tabIndex: -1, 'aria-label': `${ticker} expanded`, style: DOCK_ROOM }
        : {})}
    >
      {/*
        THE PANE'S OWN FLOOR, and it has to be here.

        The wrapper above is `display: contents` when the pane is not
        expanded, so THIS div is the real grid item. A `[&>*]:min-h-[420px]`
        rule on the grid targets the wrapper instead, where min-height is
        computed and then ignored — `contents` elements generate no box for it
        to apply to. Measured on a phone with that rule in place: both panes
        0px tall, the whole grid 10px, the charts stacked on top of each other
        under a pile of floating chrome. It looked like a layout bug and it
        was a selector pointing one element too high.

        Only below `lg`. Above it the grid owns the height and a floor here
        would fight it.
      */}
      {/* Activation lives on THIS div, not the wrapper above: the wrapper is
          `display: contents` when the pane is not expanded and generates no
          box, so it has neither a border to ring nor an area to click. Both
          handlers are capture-phase, so reaching for any control inside the
          pane makes it the active one before that control does its own job. */}
      <div
        ref={el => {
          paneBoxRef.current = el;
          boxRef?.(el);
        }}
        onPointerDownCapture={onActivate}
        onFocusCapture={onActivate}
        className={`relative flex flex-col overflow-hidden animate-soft-in ${
          expanded
            ? 'flex-1 min-h-0'
            /*
              The 420px floor is for the STACKED, SCROLLING shape between phone
              and `lg`, where a pane with no floor collapses to nothing. It is
              not lowered here — on a phone it does not apply at all, because
              there is exactly one pane and it is inside a fixed-height parent
              that already gives it the whole viewport. Keeping the floor there
              would push a 420px pane into a 334px landscape window and
              overflow it, which is the floor doing the opposite of its job.
            */
            : `${isPhone ? 'min-h-0' : 'min-h-[420px]'} lg:min-h-0 border rounded-md ${cell} ${
                /* Active wears the FOIL — border-transparent holds the
                   layout slot, the .holo-ring overlay paints the silver
                   (Noah, 2026-08-30; the lime border retired here). */
                isActive && paneCount > 1 ? 'border-transparent' : 'border-borderSubtle'
              }`
        }`}
        style={{ animationDelay: `${index * 60}ms`, background: surface }}
        /* A dark island on any page (2026-09-12): a pane reads the dark tokens whatever the page wears */
        data-theme="dark"
        /* …and its chrome the ground of this pane's own theme (2026-09-13) */
        data-chart-ground={ground}
        /* …and so does the frame itself, the ladder in it with it (2026-10-02, index.css) */
        data-chart-frame
      >
        {!expanded && isActive && paneCount > 1 && (
          <span aria-hidden className="holo-ring absolute inset-0 rounded-md z-30" />
        )}
        {/* Chart and rail on ONE line, and that line is the WHOLE pane —
            `absolute inset-0`, not a flex row under a header. The header
            floats on top of the chart instead of sitting above it, so the
            tape gets every pixel the pane has. min-w-0 on the chart column is
            load-bearing: a flex item wider than its line does not wrap, it
            spills, and a chart's natural width is whatever its container was
            last tick. */}
        <div className="absolute inset-0 flex">
          <div className="group relative flex-1 min-w-0">
            {/* ONE PANE PER FRAME (2026-09-06, the perf sweep): each chart mounts
                a frame after the last behind its skeleton, so a four-pane desk
                opens on its next frame instead of building four charts in the
                click. */}
            {noBars && (
              /* AN INDEX ON THE FEED: its book, no bars on these plans — said in the chart's own place (the chart and its
                 tools stand under it, empty), the ladder beside it standing on the book's rows */
              <div ref={noBarsBoxRef} className="absolute inset-0 z-10 pointer-events-none flex items-start justify-center pt-24 pl-14 pr-6 text-center" data-no-bars>
                <p className="max-w-[360px] rounded bg-canvas/70 px-2 py-1 text-[12px] text-textMuted">
                  {tradesAllSessions(ticker)
                    ? spxEmptyWords
                    : `${ticker}'s price bars are not drawn here yet — Unusual Whales' plan carries no index price. The ladder reads its book.`}
                </p>
              </div>
            )}
            {offHouse && !chartTape ? (
              /* THE FEED'S PANE BEFORE ITS BARS */
              <div className="h-full flex items-center justify-center px-6 text-center" data-feed-chart-wait>
                {onFeed && fBars.failed && fBars.failed !== 'rate' ? (
                  <p className="max-w-[360px] text-[12px] text-textMuted" title="Waiting on the next answer">
                    {ticker}'s price bars did not come back{fBars.failed === 'upstream' || fBars.failed === 'plan' ? ' — Unusual Whales gives no bars for this name on this plan' : ' — asked again shortly'}.
                  </p>
                ) : (
                  <ChartSkeleton className="h-full w-full" />
                )}
              </div>
            ) : (
            <Deferred index={index} fallback={<ChartSkeleton className="h-full" />} className="h-full animate-fade-in">
            <StrikeChart
              ticker={ticker}
              paneId={`terrain:${index + 1}`}
              revision={rp.active ? replayRev : offHouse ? feedRevision : revision}
              levels={levels}
              timeframe={tf}
              flowPrints={rp.active ? EMPTY_FLOW : paneFlow}
              height={tall ? 260 : 200}
              overlays={paneOverlays}
              indicators={indicators}
              chartStyle={chartStyle}
              themeKey={theme}
              barClock={clock}
              prints={rp.active ? EMPTY_FLOW : prints}
              compares={paneCompares}
              /* ON THE FEED: the real bars and the books read today (data/feed/levels.ts); an index's tape has no bars — and in
                 a replay the same kind of tape cut at the cursor (item 8) */
              tape={rp.active ? replayTape : chartTape}
              priceScale={priceScale}
              sessionOr={sessionOr}
              drawing={drawing}
              onExitDraw={onExitDraw}
              /* The persistent rail's way in — a tool clicked at rest arms
                 draw mode with that tool in hand (guarded in the chart, so
                 clicking tools WHILE drawing never toggles it off). */
              onEnterDraw={onToggleDrawing}
              /* Only the takeover has a top band to spare. */
              railTopOk={expanded}
              /* THE REPLAY (item 8): the pane drives it — the pick, then a rewound clock over a cut tape, the transport at
                 the foot of the price pane */
              pickTime={!!rp.ctl && rp.ctl.phase === 'pick'}
              onPickTime={rp.pick}
              asOf={rp.asOf}
              futureBars={rp.future}
              footBar={replayBar}
              focusPrice={focus}
              priceTag
              onCrosshair={onCrosshair}
              syncRegister={registerSync}
              onReadout={setReadout}
              /* an index on the feed: the ladder stands on the book's scale, not this empty chart's */
              projectionRef={noBars ? noBarsChartProjection : projectionRef}
              exportRef={exportPngRef}
              pageScroll={belowLg}
              /* New York's clock (the audit's X2), and the tape near the right edge — a little room ahead of the last bar,
                 not a third of the chart (X11) */
              nyClock
              recordLines={rp.active ? undefined : fRecord?.lines}
              /* the window's own reference (item 6); UW's directional series and the scorecard's ranges stand on every
                 expiry, so a window says neither */
              regimeRef={regimeForWindow(fRegime, win)}
              regimeDir={win === 'all' && !rp.active ? regimeDir : null}
              regimeRanges={win === 'all' && !rp.active ? fRecord?.main.regime?.ranges ?? null : null}
              pricedMove={rp.active ? rpMove : fMove}
              onRegime={onRegime}
              onTopNode={setTopNode}
              jumpTo={jumpTo}
              /* THE AXIS CHIPS, the σ, the live legs, the count's date, the density and the card's doors (the UI pass) */
              axisChips
              wallStates={railWallState}
              sigmaRem={sigmaRem?.sigma ?? null}
              legsNow={legs}
              oiDate={onFeed ? fOi?.date ?? null : null}
              beadDensity={cfg.beadDensity !== false}
              onReplayFrom={noBars ? undefined : onReplayFrom}
              onPinStrike={k => setFocus(cur => (cur != null && Math.abs(cur - k) < 1e-9 ? null : k))}
              onJumpResult={onJumpResult}
              onViewEdge={onViewEdge}
              onViewFrom={onViewFrom}
              onBarClick={tfMinutes(tf) >= 1440 ? onBarClick : undefined}
              stale={stale}
              beadBasis={beadBasis}
              beadFloor={beadFloor}
              beadRefs={fScale?.gex ?? null}
              onBeadLegend={onBeadLegend}
              fieldGapCause={gapCause}
              axisLevels
              historyShare={0.88}
              /* the price axis fits the candles (the owner, 2026-10-13) — a wall far from the price no longer flattens the
                 tape — and never spans less than eight strikes, so the ladder keeps its rows (the audit, row 31) */
              fitCandles={8 * (railData.step || 1)}
              /* the rail's quote on the capsule, and the bar's count on the clock's grid, on the feed (the audit, items 1
                 and 15) */
              quote={rp.active ? (Number.isFinite(levels.spot) ? levels.spot : null) : onFeed ? fDay?.price ?? null : null}
              barCountdown={onFeed ? 'grid' : 'measured'}
              frameless
              /* WALLS THROUGH THE DAY and THE SESSION'S PHASES (the ideas report, 2026-10-09) — drawn behind the candles
                 through the chart's own layer, off until the Overlays menu turns them on */
              layer={api => (
                <>
                  <TerrainLayers api={api} ticker={ticker} walls={!!paneOverlays.walls} lens={cfg.wallsLens ?? 'gex'} phases={!!overlays.phases} ground={ground} wallsSource={wallsSource} />
                  {/* a right-click on a level: an alert that follows it (the owner's item 7) — a live watch, so not from a replay */}
                  {!rp.active && <LevelAlertMenu api={api} ticker={ticker} levels={axisLevels} top={top3} sigma={fMove ? { prevClose: fMove.prevClose, s: fMove.sigma } : null} />}
                </>
              )}
            />
            </Deferred>
            )}

            {/*
              ── who this pane is, and how it is set up ──────────────────
              FLOATING OVER THE TAPE, not stacked above it (Noah, 2026-08-25:
              "find a way in logic to make that stuff transparently fit into
              the chart screens so the charts can be damn near full screen").
              Two header rows in flow cost every pane ~56px of chart; over the
              tape they cost nothing, because the top of a chart is the
              emptiest part of it — price sits in the middle and volume at the
              floor.

              SCOPED TO THE CHART COLUMN, not the pane. Spanning the pane put
              the strip across the strike rail's own header and clipped it to
              "TRIKE ×". The rail is a sibling of this column, so bounding the
              overlay to the column is the fix — not a z-index, and not a
              right-margin that has to be kept in step with the rail's width.

              The strip is `pointer-events-none` and each control group turns
              them back on. Without that the invisible gaps BETWEEN the
              controls swallow drags on the chart underneath, and a chart you
              cannot pan by its top third is broken in a way that looks like
              nothing at all.
            */}
            {/*
              IT COMES AND GOES (Noah, 2026-08-25: "fix the chart float to
              actual be a hover over kinda thing, that way you can have all
              the info you need but it comes and goes").

              Graded, not all-or-nothing, because the two rows answer
              different questions. WHAT AM I LOOKING AT is a question you have
              while your eyes are on the tape and your cursor is somewhere
              else entirely — so the symbol, price and change stay on screen,
              just quiet. HOW IS IT SET UP is a question you only have while
              you are reaching for a control, so the toolbar is not there at
              all until the cursor arrives. Hiding the symbol too would mean
              a four-pane desk where you cannot tell the panes apart without
              waving at each one.

              focus-within, not only hover: the toolbar is reachable by Tab,
              and a control you can focus but not see is worse than one you
              cannot reach. Keyboard focus brings the strip up exactly as the
              cursor does.
            */}
            {/* WHILE THE FIELD IS EMPTY on the feed (2026-10-13): the server has not read the chain yet, or there is no bar of
                today — the line goes as the first modeled minute lands (the house's pane has no such line) */}
            {/* BUILDING / CATCHING UP (the UI pass): a hatched chip while the field fills or the earlier sessions come in */}
            {onFeed && overlays.trails && !noBars && (!fTrail.full || (tilesOn ? (preTape?.days.length ?? 0) < tileDays.length : fPast && fPast.ready < fPast.asked)) && (
              <div className={`stripes absolute left-14 ${stale ? 'bottom-[3.75rem]' : 'bottom-8'} z-20 pointer-events-none select-none rounded border border-ink/[0.10] bg-canvas/70 px-1.5 py-0.5 text-[11px] text-textSecondary tnum`} data-trail-since data-building={!fTrail.full ? 'field' : 'past'}>
                {!fTrail.full ? 'Building · the chain is being read' : tilesOn ? `Catching up · earlier sessions ${preTape?.days.length ?? 0} of ${tileDays.length} in` : `Catching up · earlier sessions ${fPast!.ready} of ${fPast!.asked} in`}
              </div>
            )}
            {/* THE STALE BANNER: the newest data is old — when it was last repriced, and a way to ask again */}
            {stale && age && (
              <div className="absolute left-14 bottom-8 z-20 flex items-center gap-2 rounded-md border border-warn/40 bg-warn/[0.10] backdrop-blur-[3px] px-2 py-1 text-[11px] text-warn tnum" role="status" data-stale-banner>
                <span>Data {age.words} · last repriced {lastRepriced ? printClock(lastRepriced) : '—'}</span>
                <button type="button" onClick={retryFeed} className="hit h-5 px-1.5 rounded-[3px] border border-warn/50 font-semibold text-warn hover:bg-warn/[0.12]" data-stale-retry>
                  Retry
                </button>
              </div>
            )}
            {/* NO DATA for a day the tape does not hold: the reason, and the sessions either side */}
            {noDay && (
              <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none" data-no-day>
                <div className="pointer-events-auto rounded-md border border-borderMuted bg-panel/95 px-3 py-2.5 shadow-xl shadow-black/50 max-w-[360px] text-[12px]">
                  <p className="font-semibold text-textPrimary">No data for {isoDayLabel(noDay.day)}</p>
                  <p className="text-textSecondary tnum">{noDay.first && noDay.last ? `The tape holds ${isoDayLabel(noDay.first)} to ${isoDayLabel(noDay.last)} on this timeframe.` : 'The tape holds no bars on this timeframe yet.'}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <button type="button" onClick={() => jumpDate(sessionBefore(noDay.day))} className="hit h-6 px-2 rounded-[3px] border border-ink/[0.14] font-mono text-[11px] text-textSecondary hover:text-textPrimary" data-no-day-prev>
                      ‹ Previous session
                    </button>
                    <button type="button" onClick={() => jumpDate(nextSession(noDay.day))} className="hit h-6 px-2 rounded-[3px] border border-ink/[0.14] font-mono text-[11px] text-textSecondary hover:text-textPrimary" data-no-day-next>
                      Next session ›
                    </button>
                    <button type="button" onClick={backToLive} className="hit ml-auto h-6 px-2 rounded-[3px] bg-ink/[0.14] font-mono text-[11px] font-semibold text-textPrimary" data-no-day-live>
                      Back to live
                    </button>
                  </div>
                </div>
              </div>
            )}
            {/* BACK TO LIVE: the view has left the last bar */}
            {!atLive && !rp.active && !noBars && (
              <button type="button" onClick={backToLive} className="hit absolute bottom-8 z-20 h-6 px-2 rounded-[3px] bg-ink/[0.14] font-mono text-[11px] font-semibold text-textPrimary backdrop-blur-[3px]" style={{ right: PRICE_GUTTER_PX + 8 }} data-back-to-live>
                Back to live ›
              </button>
            )}
            {/* THE DAY PANEL on a daily chart */}
            {dayRead && (
              <div className="absolute left-3 z-40 rounded-md border border-borderMuted bg-panel/95 px-3 py-2.5 shadow-xl shadow-black/50 max-w-[380px] text-[12px]" style={{ top: stripH + 4 }} data-day-panel={dayRead.day}>
                <div className="flex items-baseline gap-2">
                  <p className="font-semibold text-textPrimary">{isoDayLabel(dayRead.day)}</p>
                  {dayRead.close != null && <span className="font-mono text-[11px] tnum text-textSecondary">close {num(dayRead.close, 2)}</span>}
                  <button type="button" onClick={() => setDayPanel(null)} aria-label="Close the day panel" title="Close — Esc" className="hit ml-auto h-5 w-5 inline-flex items-center justify-center rounded text-textMuted hover:text-textPrimary">
                    ×
                  </button>
                </div>
                {dayRead.last ? (
                  <>
                    <p className="text-[11px] text-textMuted mt-1">At the day's last modeled column ({printClock(dayRead.last.time * 1000)})</p>
                    {dayRead.regime && <p className="text-textSecondary tnum">Regime: {dayRead.regime}</p>}
                    <p className="text-textSecondary tnum">
                      CW {dayRead.walls?.callWall != null ? num(dayRead.walls.callWall, dayRead.walls.callWall % 1 ? 2 : 0) : '—'} · PW {dayRead.walls?.putWall != null ? num(dayRead.walls.putWall, dayRead.walls.putWall % 1 ? 2 : 0) : '—'} · flip {dayRead.flip != null ? num(dayRead.flip, 2) : '—'}
                    </p>
                    {dayRead.nearest.length > 0 && <p className="text-textSecondary tnum">Nearest the close: {dayRead.nearest.map(l => `${num(l.strike, l.strike % 1 ? 2 : 0)} ${usdCompactSigned(l.value)}`).join(' · ')}</p>}
                  </>
                ) : (
                  <p className="text-textMuted mt-1">No modeled column for this day on this machine.</p>
                )}
                {onFeed && !isCashIndex(ticker) && (
                  <p className="text-[11px] text-textMuted mt-1 tnum">
                    {dayRead.uw ? `Unusual Whales' end-of-day book: CW ${dayRead.uw.walls.callWall != null ? num(dayRead.uw.walls.callWall, dayRead.uw.walls.callWall % 1 ? 2 : 0) : '—'} · PW ${dayRead.uw.walls.putWall != null ? num(dayRead.uw.walls.putWall, dayRead.uw.walls.putWall % 1 ? 2 : 0) : '—'} · flip ${dayRead.uw.flip != null ? num(dayRead.uw.flip, 2) : '—'} (figured at ${num(dayRead.uw.spot, 2)}, ${printClock(dayRead.uw.at)})` : dayRead.uwFailed ? "Unusual Whales' end-of-day book did not come back" : dayRead.uwWaiting ? "Unusual Whales' end-of-day book: asking…" : ''}
                  </p>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <button type="button" onClick={() => jumpDate(dayRead.day, '5m')} className="hit h-6 px-2 rounded-[3px] bg-ink/[0.14] font-mono text-[11px] font-semibold text-textPrimary" data-day-open>
                    Open this session · 5m
                  </button>
                  {!noBars && (
                    <button type="button" onClick={() => { const [y, m, d] = dayRead.day.split('-').map(Number); onReplayFrom(Math.floor(nyWallTime(y, m, d, 9, 30) / 1000)); setDayPanel(null); }} className="hit h-6 px-2 rounded-[3px] border border-ink/[0.14] font-mono text-[11px] text-textSecondary hover:text-textPrimary" data-day-replay>
                      Replay this day
                    </button>
                  )}
                </div>
              </div>
            )}
            {/* THE LADDER'S PEEK on a phone: the three strikes nearest the price, a tap opening the ladder */}
            {belowLg && !narrowLadder && peek.length > 0 && (
              <button type="button" onClick={() => setNarrowLadder(true)} className="hit absolute left-3 bottom-8 z-20 flex items-center gap-1.5 rounded-md bg-canvas/70 backdrop-blur-[3px] px-2 py-1 font-mono text-[11px] tnum text-textSecondary" title="The three strikes nearest the price — open the ladder" data-ladder-peek>
                {peek.map(r => (
                  <span key={r.strike} className="whitespace-nowrap">
                    <span className="text-textPrimary">{num(r.strike, r.strike % 1 ? 2 : 0)}</span> <span className={r.value >= 0 ? 'text-[rgb(var(--amplify))]' : 'text-[rgb(var(--absorb))]'}>{usdCompactSigned(r.value)}</span>
                  </span>
                ))}
                <span className="text-textMuted">Strikes ›</span>
              </button>
            )}
            {expanded && (
              /* ── THE FULLSCREEN TOP STRIP (Noah, 2026-08-28) ──
                 The Pulse takeover's grammar exactly: full width, always
                 visible, translucent over the tape with the same 55% surface
                 wash and blur, controls spread edge to edge. The floating
                 identity chrome below steps down out of its way. */
              <div
                className="absolute top-0 inset-x-0 z-30 select-none flex flex-wrap items-center px-3 py-2 gap-3 backdrop-blur-md backdrop-saturate-150"
                style={{ background: strip }}
                /* Chrome over the tape: its tokens follow the pane's ground (index.css), and
                   the scripts' legend measures it like the identity row below */
                data-chart-chrome
              >
                {/* The symbol leads, Pulse-style — then a hairline, then
                    everything else spread to the far edge. */}
                <span className="shrink-0 flex items-center gap-2 pointer-events-auto">{identityControls}</span>
                {mtfForm !== 'none' && confluence.length > 0 && (
                  <span className="shrink-0 hidden xl:inline-flex pointer-events-auto">
                    <ConfluenceStrip rows={confluence} form={mtfForm} current={tf} onPick={next => onCfg({ timeframe: next })} />
                  </span>
                )}
                <span className="shrink-0 w-px h-4 bg-borderSubtle" aria-hidden />
                <div className="flex-1 min-w-0">{paneToolbar(true)}</div>
                {/* The way back out, at the far right end of the strip — the
                    mirror of the docked corner chip. */}
                <button
                  onClick={onToggleExpand}
                  aria-pressed={expanded}
                  aria-label={`Collapse ${ticker}`}
                  title="Collapse — Esc"
                  className="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded text-textMuted hover:text-textPrimary hover:bg-ink/[0.05] transition-colors"
                >
                  <Minimize2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <div
              ref={stripRef}
              /* Padding clears the price gutter, so nothing floating ever
                 lands on a price tick — BOTH gutters whenever there is a left
                 one, with no width condition on it.

                 It used to be conditional, and the condition was covering for
                 a different bug. Taking the left gutter on a narrow pane moved
                 the collision to the RIGHT axis, so the clearance was gated on
                 the column being wide enough to hold both. But the right axis
                 was ALREADY being overprinted at those widths by 28-30px, with
                 or without a left one — the gate was not preventing that, only
                 declining to make it worse. Now that the row sheds parts to fit
                 (ID_ROW_* above), there is nothing to trade and the axis on
                 each side is simply left alone. */
              style={{
                paddingLeft: ownScale ? PRICE_GUTTER_PX : undefined,
                paddingRight: PRICE_GUTTER_PX,
              }}
              className={`pointer-events-none absolute inset-x-0 ${expanded ? 'top-11' : 'top-0'} z-20 flex flex-col items-start gap-1 p-1.5`}
              /* Floating chrome the chart's scripts legend measures and sits under (2026-09-10) */
              data-chart-chrome
            >
              {/*
                ONE ROW, ALWAYS — it does not wrap, it clips.

                Wrapping made the panes disagree about where their charts
                start: the heaviest-strike read is as wide as its numbers
                happen to be, so a pane holding three $200M strikes pushed the
                expand button onto a second line while the pane beside it
                stayed on one. The strike read gives by carrying
                fewer entries, and the identity row gives by dropping parts of
                itself (ID_ROW_* above). Neither is ever cut mid-value.
              */}
              {/*
                IT HUGS ITS CONTENT. It used to carry the heaviest-strike read
                as well, which is as wide as its numbers happen to be, so the
                row overflowed and `max-w-full` stretched the translucent band
                across the entire top of the tape — and pushed the expand icon
                out over the price ticks.

                Moving the read off did not fix that, it only made it smaller:
                identity ALONE still needed 317px of the 287 a 369px column
                gives, and the expand icon was still on the ticks. `max-w-full`
                caps this box; it does not clip `shrink-0` children, so what
                does not fit is drawn past the edge either way. This row is
                only narrow enough because it now sheds parts — ID_ROW_* above,
                and the sweep section that measures it in a real browser.
              */}
              {expanded ? (
                /* FULLSCREEN'S SECOND LINE (Noah, 2026-08-29: "right below it
                   is simply the ticker, timeframe, and tick price") — the
                   Pulse takeover's own legend: facts on the tape, no chip, no
                   controls; the controls all moved up into the strip. The
                   decision strip and the crosshair readout stand under it. */
                <>
                  <div className="pointer-events-none select-none flex items-baseline gap-1.5 font-mono">
                    <span className="text-[11px] font-semibold text-textPrimary">{ticker}</span>
                    <span className="text-[11px] text-textMuted" aria-hidden>·</span>
                    <span className="text-[11px] text-textMuted">{tf}</span>
                    <span className="text-[11px] text-textMuted" aria-hidden>·</span>
                    <SpotPrice value={levels.spot} className="font-mono text-[11px] font-semibold tnum text-textPrimary" />
                    {printChip}
                    {Number.isFinite(changePct) && (
                      <span className={`text-[11px] font-semibold tnum ${up ? 'text-bull' : 'text-bear'}`} data-dir={up ? 'up' : 'down'}>
                        {pctSigned(changePct)}
                      </span>
                    )}
                  </div>
                  <DecisionStrip boxes={boxes} sures={railSure} room={stripInner} className="relative z-20" />
                  {readout && <CrosshairReadout readout={readout} showOhl={showReadoutOhl} showVol={showReadoutVol} showInds={showReadoutInds} className="relative z-10" />}
                </>
              ) : (
              /* THE ONE HEADER ROW (the Terrain UI pass, 2026-10-14; components/terrain/PaneHead.tsx): the identity and
                 the facts the host sheds by its own budget, the age chip, the timeframe, the expiry window, the jumps,
                 then Replay · Alerts · Layers, ? and the doors — at rest, one line, never wrapping */
              <div className="relative z-30 pointer-events-none w-full select-none rounded-md bg-canvas/25 backdrop-blur-[3px] px-2 py-1" data-pane-head-row>
                <PaneHead
                  identity={identityControls}
                  facts={facts}
                  age={headPlan.ageDot ? age : null}
                  ageForm={headPlan.ageWords ? 'words' : 'dot'}
                  timeframes={headTimeframes}
                  tf={{ value: tf, onChange: next => onCfg({ timeframe: next }), held: offHouse ? FEED_HELD : undefined }}
                  window={headPlan.windowForm !== 'none' ? { value: isWindowCut(railCut) ? railCut : 'book', onChange: (v: WindowValue) => onRailCut(v), form: headPlan.windowForm } : null}
                  jump={headPlan.jumpForm !== 'none' ? { onSpan: jumpSpan, onDate: jumpDate, minDate: jumpMin, maxDate: nyIsoDate(), form: headPlan.jumpForm } : null}
                  tools={headPlan.tools ? paneToolbar(false, HEAD_PARTS, true) : null}
                  keys={headPlan.keys}
                  doors={expandDoor}
                  openDateNonce={openDateNonce}
                />
              </div>
              )}

              {/*
                THE BOOK, on its own line and only while you are looking.

                It rode in the identity row and kept getting cut mid-number —
                a pane printed "521 -$235.4", which is the front of -$235.4M
                and reads as a complete number that is wrong by six orders of
                magnitude. Fading the tail did not fix that; a faded number is
                still a number. On its own full-width line, revealed with the
                toolbar, there is room for every entry whole.
              */}
              {/*
                THE HOVERED BAR TAKES THE BOOK'S LINE — T-8, and it shares the
                slot rather than adding one.

                A row of its own would push the toolbar and the compare legend
                DOWN the moment the pointer crossed onto the plot — chrome
                moving under the cursor that caused it, on a desk whose whole
                premise is that the tape keeps still. Sharing costs nothing and
                the two reads are never both wanted: the pointer is either over
                the tape, where the question is what this bar did, or over the
                chrome, where it is where the book is. Leaving the plot brings
                the heaviest read straight back.

                It is not `opacity-0` like the row it replaces, because it only
                exists WHILE the pointer is on the plot — which is already the
                hover state. Fading in something that is only ever created by a
                hover would just make it late.
              */}
              {/* THE DECISION STRIP (the UI pass, 2026-10-14; components/terrain/DecisionStrip.tsx): five reads at rest —
                  Regime, Nearest levels, Priced move, Track record, Freshness — each a door into How sure at its section */}
              {!expanded && <DecisionStrip boxes={boxes} sures={railSure} room={stripInner} className="relative z-20" />}

              {/* THE BEAD LEGEND, ALWAYS IN VIEW while the field is drawn (the owner's item 5 (a)): what full brightness is,
                  in money, as of when — the renderer's own reference (data-bead-ref) — with the basis (item 5 (b)) and
                  the floor (item 5 (e)) beside it */}
              {overlays.trails && beadLegend && legendOn && (
                /* IT FITS (the owner's orbs round 2, item 5, 2026-10-15: "The legend is cut off ('soft edge = sta…'); make it
                   fit"): each piece keeps its words whole and the line wraps between pieces when the column is narrow, so
                   nothing is cut — the chart measures the band it takes (StrikeChart's chrome band) and fits under it. The
                   basis's words stand in the title; the basis and the floor ride the hover row (beadControls); L hides it */
                /* A NARROW PANE (a desk of two or more) takes the short form — the swatches name their side, the size its
                   full figure — so the legend stays two lines at most; the whole of it stands in the title. It starts past
                   the drawing rail, as the candles do (useRailLeftInset) */
                <div className="relative z-10 pointer-events-auto max-w-full rounded-md bg-canvas/25 backdrop-blur-[3px] px-2 py-0.5 text-[11px] leading-[16px] text-textMuted tnum" style={railInset ? { marginLeft: Math.max(0, railInset - 6), maxWidth: `calc(100% - ${Math.max(0, railInset - 6)}px)` } : undefined} title={`${beadLegendLines(beadLegend, beadBasis, beadFloor).tail} · ${beadLegendWords(beadLegend, beadBasis, beadFloor)}`} data-bead-legend data-bead-form={legendShort ? 'short' : 'full'} data-bead-ref={beadLegend.ref} data-bead-basis={beadLegend.basis}>
                  {/* THE SWATCHES (the orbs message, item 12): an oval before each colour's word, in the inks the nodes wear on
                      this tape — the renderer's own hand-off (legend().inks) */}
                  {legendShort ? (
                    <span className="flex flex-wrap items-center gap-x-1.5 min-w-0 [&>span]:whitespace-nowrap" data-bead-scale>
                      <span className="inline-flex items-center"><LegendSwatch rgb={beadLegend.inks.call} />absorb</span>
                      <span className="inline-flex items-center"><LegendSwatch rgb={beadLegend.inks.put} />amplify</span>
                      <span className="inline-flex items-center"><LegendSwatch rgb={beadLegend.inks.neutral} />balanced ·</span>
                      <span>size = total gamma · soft edge = stale ·</span>
                      <span data-bead-scale-words>Full size {usdCompact(beadLegend.refG)}</span>
                    </span>
                  ) : (
                    <span className="flex flex-wrap items-center gap-x-1.5 min-w-0 [&>span]:whitespace-nowrap" data-bead-scale>
                      <span>size = total gamma at the strike ·</span>
                      <span className="inline-flex items-center"><LegendSwatch rgb={beadLegend.inks.call} />gold = absorb ·</span>
                      <span className="inline-flex items-center"><LegendSwatch rgb={beadLegend.inks.put} />violet = amplify ·</span>
                      <span className="inline-flex items-center"><LegendSwatch rgb={beadLegend.inks.neutral} />grey = balanced ·</span>
                      <span>soft edge = stale ·</span>
                      <span className="!whitespace-normal min-w-0" data-bead-scale-words>{beadLegendLines(beadLegend, beadBasis, beadFloor).head}</span>
                    </span>
                  )}
                </div>
              )}

              {/* Its own, every one of them — and not there until you
                  reach. DOCKED ONLY: the expanded pane pins the same toolbar
                  to the top strip instead, where it does not need a hover to
                  exist. */}
              {!expanded && !toolbarInline && (
                /* OUT OF THE FLOW (the UI pass, 2026-10-14): it stands under the strip, over the plot, and only while the
                   pointer or the keys are on the pane — so the chrome band the chart keeps clear of is the header, the
                   strip and the legend alone, and a hover moves nothing (the band's height is what fits the scale) */
                <div className={isPhone ? 'relative z-10 pointer-events-auto max-w-full rounded-md bg-canvas/25 backdrop-blur-[3px] px-2 py-1 flex items-center gap-2 flex-nowrap overflow-x-auto overscroll-x-contain [&>*]:shrink-0' : 'chrome-hover chrome-tap touch-reveal absolute left-1.5 top-full mt-0.5 z-10 pointer-events-none max-w-[calc(100%-12px)] rounded-md bg-canvas/70 backdrop-blur-[3px] px-2 py-1 hidden group-hover:flex group-focus-within:flex group-hover:pointer-events-auto group-focus-within:pointer-events-auto items-center gap-2 flex-wrap'} style={!isPhone && ownScale ? { left: PRICE_GUTTER_PX + 6 } : undefined} data-toolbar-row>
                  {paneToolbar(false, headPlan.tools ? HOVER_PARTS : HOVER_ALL_PARTS)}
                  {!headPlan.popOut && popOutDoor}
                  {overlays.walls && wallsLens}
                  {overlays.trails && beadLegend && beadControls}
                  {overlays.trails && (
                    <button type="button" aria-pressed={legendOn} onClick={() => onCfg({ legend: legendOn ? false : undefined })} title="The bead legend's line — L" className={`hit h-[18px] px-1.5 rounded-[2px] text-[11px] transition-colors ${legendOn ? 'bg-ink/[0.14] text-textPrimary font-semibold' : 'text-textMuted hover:text-textPrimary'}`} data-legend-door>
                      Legend
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* ── the crossed symbols, under the floating header ───────────
                One quiet row each: its line's own ink, its live price, and the
                only hand-removal outside the + menu. pointer-events are off on
                the stack and back on for the buttons, so the legend never eats
                a drag on the chart. */}
            {/* THE CROSSHAIR READOUT (the UI pass): the hovered bar's figures at the plot's top-left, under the chrome —
                only while a pointer is on the plot or a moment arrives from another pane */}
            {readout && !expanded && (
              <div className="pointer-events-none absolute left-3 z-10" style={{ top: stripH + 4, left: ownScale ? PRICE_GUTTER_PX : undefined }} data-chart-chrome>
                <CrosshairReadout readout={readout} showOhl={showReadoutOhl} showVol={showReadoutVol} showInds={showReadoutInds} />
              </div>
            )}
            {compares.length > 0 && (
              <div
                /* Unconditional, unlike the strip above: the legend rows are
                   ~106px, so even at a 369px column they clear both gutters. */
                style={{ top: stripH + 4 + (expanded ? 44 : 0) + (readout && !expanded ? 24 : 0), left: ownScale ? PRICE_GUTTER_PX : undefined }}
                className="pointer-events-none absolute left-3 z-10 flex flex-col gap-0.5 opacity-70 transition-opacity duration-200 group-hover:opacity-100"
                data-chart-chrome
              >
                {compares.map(c => (
                  <span key={`${c.ticker}:${c.mode}`} className="flex items-center gap-1.5">
                    <span className="w-2 h-[3px] rounded-full" style={{ background: c.ink }} aria-hidden />
                    <span className="font-mono text-[11px] font-semibold" style={{ color: c.ink }}>
                      {c.ticker}
                    </span>
                    {/* on the feed the crossed name's own last bar ("—" where its bars are not on the plans: an index) */}
                    {offHouse ? (
                      Number.isFinite(lastClose(compareBars?.[c.ticker]?.bars)) ? (
                        <SpotPrice value={lastClose(compareBars?.[c.ticker]?.bars)} className="font-mono text-[11px] tnum text-textSecondary" />
                      ) : (
                        <span className="font-mono text-[11px] tnum text-textMuted" title="Not available on these plans">—</span>
                      )
                    ) : (
                      Simulator.TICKERS[c.ticker] && (
                        <SpotPrice
                          value={Simulator.TICKERS[c.ticker].currentPrice}
                          className="font-mono text-[11px] tnum text-textSecondary"
                        />
                      )
                    )}
                    <button
                      onClick={() => removeCompare(c.ticker, c.mode)}
                      aria-label={`Remove the ${c.ticker} comparison`}
                      title="Remove comparison"
                      className="hit pointer-events-auto inline-flex items-center justify-center w-4 h-4 rounded text-textMuted hover:text-textPrimary hover:bg-ink/[0.08] transition-colors"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/*
            NOT ON A PHONE. The rail is 132px, which is a THIRD of a 390px
            screen — with it up, the chart column is 250px and the price
            gutter takes 56 of those, leaving under 200px of plot beside a
            full-height ladder. Worse, the pane's own floating chrome is wider
            than 250px, so it spilled out of the column and over the ladder.

            Hidden by breakpoint, not by config: the reader's `ladder` choice
            is left exactly as they set it and comes back the moment the
            window is wide enough. Turning it off in storage would silently
            rewrite a preference because they picked up their phone.
          */}
          {/* the ladder stands on the chart's price rows — an index on the feed has none, so it stands on the book's own */}
          {(belowLg ? narrowLadder : ladder) && rail.rows.length > 0 && !(offHouse && !chartTape) && (
            <ProfilePanel
              /* THE REST WIDTH follows the pane count (2026-09-16): 520 alone or expanded, 340 on
                 two or four, 240 three across — the reader's own width once dragged */
              width={belowLg ? 340 : cfg.ladderW ?? profileRestWidth(paneCount, expanded)}
              restWidth={profileRestWidth(paneCount, expanded)}
              onWidth={w => onCfg({ ladderW: w })}
              /* THE EXPIRY CARD in the rail's head beside the view tabs (Noah, 2026-09-16) — the
                 desk's one cut, so a change here changes every pane */
              /* bare beside another pane: the card's word went, its value cut to "Every expir…" in every pane (the
                 audit's TE-2) — the value says it, the tooltip names it */
              headCard={<ExpiryCard label="Expiry" size="sm" bare={!expanded && paneCount > 1} value={offHouse && cutDate === null && !isWindowCut(railCut) ? 'book' : railCut} choices={offHouse ? feedCutChoices(fListed) : railCutChoices()} onChange={onRailCut} title="Expiry — which contracts the rails read" testId="terrain-expiry" />}
              /* THE CHART KEEPS ITS SHARE (the audit's TE-5: in three and four panes the ladder took ~60% and the chart
                 shrank to ~175 px): beside other panes the rail stops at 40% of the pane */
              maxShare={belowLg ? 0.82 : !expanded && paneCount >= 3 ? 0.4 : 0.6}
              /* the Vol switch: the session's traded volume by price — the house's tape, or on the feed the minutes */
              ticker={ticker}
              volBars={rp.active && rp.cut ? rp.cut.bars : offHouse ? fBars.bars : undefined}
              rows={rail.rows}
              /* how sure the walls and the flip are — Pinpoint's read of the same book (components/levels/HowSure) */
              sure={railSure}
              sigmaRem={sigmaRem?.sigma ?? null}
              maxAbs={rail.maxAbs}
              legs={legs}
              openRatio={openRatio}
              lagged={lagged}
              palette={palette}
              step={rail.step}
              levels={levels}
              flow={flow}
              lane={cfg.lane}
              onLane={l => onCfg({ lane: l })}
              greek="GEX"
              onGuide={() => setGuideOpen(v => !v)}
              guideOpen={guideOpen}
              focusPrice={focus}
              projection={projectionRef}
              onClose={() => {
                if (belowLg) {
                  setNarrowLadder(false);
                  return;
                }
                onCfg({ ladder: false });
                /*
                  A control that removes ITSELF has to say where focus goes.

                  This button unmounts on the same click, and the browser's
                  answer to "the focused element is gone" is <body> — so a
                  keyboard reader is dropped to the top of the document and
                  tabs back through the whole desk to reach anything. Focus
                  goes to the one control that undoes this, which is what a
                  reader would look for next.

                  After the commit, not during: the button is still mounted in
                  this tick, and focusing the target before React removes it
                  would be undone by the removal.
                */
                requestAnimationFrame(() => {
                  const undo = document.querySelector<HTMLElement>('[data-strikes-toggle]');
                  // Belt and braces. This × only exists where the rail does,
                  // which is `lg` and up, and STRIKES is rendered across that
                  // whole range — so the query should always find it. If a
                  // resize ever lands between the two, leaving focus where it
                  // is beats throwing on null.
                  if (undo?.isConnected) undo.focus();
                });
              }}
              closeHint="Hide this rail — R"
              onSelect={price => setFocus(cur => (cur != null && Math.abs(cur - price) < 1e-9 ? null : price))}
              /* the ladder is drawn on the ground of the tape beside it */
              ground={ground}
              className={belowLg ? 'absolute right-0 inset-y-0 z-[25] shadow-2xl shadow-black/50' : 'hidden lg:block'}
            />
          )}
        </div>
        {/* THE GUIDE IN FOCUS — over the whole pane, the pane blurred behind it. Its card keeps the dark island on
            either ground: ProfileGuide's figures are drawn for black (a `contents` box — the layer still fills the pane, and
            takes its corners) */}
        {ladder && (
          <div className="contents rounded-[inherit]" data-theme="dark">
            <GuideFocus open={guideOpen} onClose={() => setGuideOpen(false)} title="How to read this panel" testId="profile-guide">
              <ProfileGuide rows={rail.rows} levels={levels} flow={flow} />
            </GuideFocus>
          </div>
        )}
      </div>
    </div>
  );
};

/** Terrain — the charts-only desk. */
const Terrain = () => {
  /* the published tick's counter — the panes' books and levels follow it (context/marketStore.ts) */
  const revision = useTickSeq();

  const [cfg, setCfg] = useState<TerrainCfg>(() => {
    const c = loadCfg();
    /* The candles' one-time flip to the baby-blue tape (2026-08-29, "yes it
       should be baby blue"; supersedes the same-day foil flip) — pane themes
       are stored EXPLICITLY, so the store-level migration alone would leave
       every existing pane wearing its old metal. Same flag discipline: once. */
    try {
      if (!localStorage.getItem('slayer_terrain_sky1')) {
        localStorage.setItem('slayer_terrain_sky1', '1');
        /* since 2026-09-19 the flip lands a pane on the STORE (whose dark pick that same day became glacier), not on a
           typed 'glacier': a typed one would hold a first-time visitor's panes off Stone on the light page for good */
        return { ...c, panes: c.panes.map(p => ({ ...p, theme: undefined })) };
      }
    } catch {
      /* storage unavailable — panes keep their stored themes */
    }
    return c;
  });

  /*
    T-18 — the named-layouts shelf. Validation on load is the desk's OWN
    readPane (injected — layouts.ts holds no second copy of the pane's
    fields), and applying an entry NORMALIZES its pane count to the desk's
    fixed four: stored panes fill from the front, defaults fill the rest, so
    a two-pane snapshot recalled onto a four-slot desk leaves slots three
    and four at their defaults instead of undefined.
  */
  const [namedLayouts, setNamedLayouts] = useState<Record<string, NamedLayoutEntry<PaneCfg>>>(() =>
    loadNamedLayouts(readPane, defaultPanes()[0], LAYOUTS)
  );
  const [layoutsOpen, setLayoutsOpen] = useState(false);
  const [layoutName, setLayoutName] = useState('');
  const [layoutNote, setLayoutNote] = useState<string | null>(null);
  const applyNamedLayout = (entry: NamedLayoutEntry<PaneCfg>) => {
    const defs = defaultPanes();
    const panes = defs.map((d, i) => entry.panes[i] ?? d);
    /* Through the dissolve as well — recalling a shelf layout is the biggest
       reflow the desk does. */
    dissolve(() =>
      setCfg(prev => ({ ...prev, layout: (LAYOUTS as readonly number[]).includes(entry.layout) ? (entry.layout as TerrainLayout) : prev.layout, panes }))
    );
    setLayoutsOpen(false);
  };
  const saveCurrentLayout = () => {
    const next = saveNamedLayout(namedLayouts, layoutName, cfg.layout, cfg.panes, Date.now());
    if (next === null) {
      setLayoutNote(layoutName.trim() ? `the shelf holds ${MAX_NAMED_LAYOUTS} — delete one first` : 'give it a name');
      return;
    }
    setNamedLayouts(next);
    persistNamedLayouts(next);
    setLayoutName('');
    setLayoutNote(null);
  };
  const removeNamedLayout = (name: string) => {
    const next = deleteNamedLayout(namedLayouts, name);
    setNamedLayouts(next);
    persistNamedLayouts(next);
  };
  useEffect(() => {
    try {
      localStorage.setItem(TERRAIN_KEY, JSON.stringify(cfg));
    } catch {
      /* storage can be full, private, or switched off — never fatal */
    }
  }, [cfg]);

  /* The key handler is installed once, so it reaches the reducer through a ref
     rather than closing over the first render's copy of it. */
  const setPaneRef = useRef<(i: number, patch: Partial<PaneCfg>) => void>(() => {});

  /*
    EVERY pane mutation funnels here, which is why both halves of the symbol
    memory live here and nowhere else.

    Doing the restore in a Pane effect instead would give one render with the
    new symbol and the OLD interval, then another with both — two full reloads
    of candles, volume and trails for one pick, and it would mis-fire the
    chart's own "same ticker" fade guard. This is one commit: symbol and
    settings land together.
  */
  const groups = useLinkGroups();
  const setPane = (i: number, patch: Partial<PaneCfg>) => {
    /* THE SHELL'S LINK GROUPS (2026-10-10): a symbol picked on a pane in a group is the group's name, in every room; a
       pane joining a group nobody has named gives it its own */
    const cur = cfg.panes[i];
    const group = patch.link !== undefined ? patch.link : (cur?.link ?? null);
    if (group && patch.ticker) setLinkGroup(group, patch.ticker);
    else if (patch.link && cur && !groups[patch.link]) setLinkGroup(patch.link, cur.ticker);
    setPaneCfg(i, patch);
  };
  const setPaneCfg = (i: number, patch: Partial<PaneCfg>) =>
    setCfg(prev => {
      const cur = prev.panes[i];
      if (!cur) return prev;
      const now = Date.now();
      const put = (p: PaneCfg, setups: SetupMap) => ({
        ...prev,
        setups,
        panes: prev.panes.map((q, j) => (j === i ? p : q)),
      });

      // A SYMBOL CHANGE — restore, and never capture the symbol on its way out
      if (patch.ticker && symKey(patch.ticker) !== symKey(cur.ticker)) {
        const key = symKey(patch.ticker);
        const saved = prev.setups[key];
        /* With nothing saved, applySetup reduces to `cur` — a symbol nobody
           has configured inherits the pane exactly as it stands, which is the
           behaviour that was here before any of this. `compares` is written
           explicitly every time, so a comparison can never leak across a
           symbol change. */
        const setups = saved ? { ...prev.setups, [key]: { ...saved, seen: now } } : prev.setups;
        /*
          T-20 — LINKED PANES FOLLOW THE SYMBOL. Every pane sharing this
          pane's group letter takes the same new symbol through the same
          restore path (each keeps its own slot business — rail, link,
          replay — because applySetup touches only setup keys). Symbol only,
          deliberately: the directive offers timeframe linking as an option,
          and a linked TIMEFRAME quietly overwriting a per-symbol setup's
          interval would fight the earned-by-touch rule the setups are built
          on. One follow rule, no surprises.
        */
        const group = cur.link ?? null;
        const panes = prev.panes.map((q, j) => {
          const inGroup = j === i || (group !== null && q.link === group);
          if (!inGroup) return q;
          const base = j === i ? cur : q;
          const applied = { ...applySetup(base, saved), compares: saved?.compares ?? [] };
          return j === i ? { ...applied, ...patch } : { ...applied, ticker: patch.ticker! };
        });
        return { ...prev, setups, panes };
      }

      // A CONTROL TOUCH — this is what earns the symbol its entry
      const next = { ...cur, ...patch };
      // A rail-only patch is slot business and writes nothing to the symbol.
      if (!SETUP_KEYS.some(k => k in patch)) return put(next, prev.setups);
      return put(next, evict({ ...prev.setups, [symKey(cur.ticker)]: captureSetup(next, now) }));
    });
  setPaneRef.current = setPane;
  /* …and a group's name moved elsewhere (a Pulse panel, the Weigher, another pane) comes to every pane in it, through
     the same restore path a pick takes */
  useEffect(() => {
    cfg.panes.forEach((p, i) => {
      const name = p.link ? groups[p.link] : null;
      if (name && symKey(name) !== symKey(p.ticker)) setPaneCfg(i, { ticker: name });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, cfg.panes]);

  const [expanded, setExpanded] = useState<number | null>(null);
  const expandedRef = useRef<number | null>(null);
  expandedRef.current = expanded;
  /* The takeover leaves on a fade instead of vanishing — the same hook the
     Pulse fullscreen uses, so the two desks feel like one product. Every
     reader-initiated close routes through `closeExpanded`; the layout guard
     below still drops it instantly, because that is a correctness reset
     rather than someone leaving. */
  const { closing: expClosing, close: closeExpanded } = useFadeClose(() => setExpanded(null));
  const closeExpandedRef = useRef(closeExpanded);
  closeExpandedRef.current = closeExpanded;
  /* Expand is instant, collapse fades. */
  const toggleExpand = useCallback((i: number) => {
    if (expandedRef.current === i) closeExpandedRef.current();
    else setExpanded(i);
  }, []);
  const toggleExpandRef = useRef(toggleExpand);
  toggleExpandRef.current = toggleExpand;

  /*
    THE PANE-COUNT SWAP DISSOLVES (Noah, 2026-08-28: "the transition between 1
    pane, 2 pane, 3 and 4 pane is not smooth its very rapid").

    No CSS transition can carry this reflow, and that is not a matter of
    picking the right duration: grid track COUNTS do not interpolate —
    `repeat(2,1fr)` to `repeat(3,1fr)` has no halfway value — so the panes
    teleport into their new widths however the property is animated.

    So the desk carries it instead. It fades down, the layout changes while
    nobody can see it, and it fades back up; the charts' own resize storm
    lands inside that gap, which is the part that read as "rapid" in the first
    place. Same opacity grammar as the takeover above, on purpose.

    On a TIMER, never on an animation event — the house law that keeps a
    dropped frame from stranding the desk at zero opacity.
  */
  const [swapping, setSwapping] = useState(false);
  const dissolve = useCallback((apply: () => void) => {
    setSwapping(true);
    window.setTimeout(() => {
      apply();
      setSwapping(false);
    }, 130);
  }, []);
  const changeLayout = useCallback(
    (n: TerrainLayout) => {
      if (cfgRef.current.layout === n) return; // a no-op should not blink
      dissolve(() => setCfg(prev => ({ ...prev, layout: n })));
    },
    [dissolve]
  );
  const changeLayoutRef = useRef(changeLayout);
  changeLayoutRef.current = changeLayout;

  /*
    AN EXPANDED PANE CANNOT OUTLIVE THE PANE IT POINTS AT.

    `expanded` is an INDEX, and the number of panes is a separate piece of
    state that the layout buttons and the 1-4 keys both change without
    consulting it. Expand the fourth chart, then press 2: the fourth pane stops
    rendering, so its `fixed inset-0` overlay vanishes and the desk looks
    normal — while `expanded` is still 3.

    What is left behind is worse than a stale number. The scroll lock is
    installed by the effect below and released by its cleanup, and the cleanup
    only runs when `expanded` CHANGES: it did not, so `document.body.style
    .overflow` stays `hidden` with nothing expanded. Below `lg` the desk is a
    scrolling page, and the reader is left on a page that will not scroll, with
    a floating "Esc" chip offering to close something that is not open.

    Clearing rather than clamping: shrinking the desk past the pane you were
    looking at is not a request to look at a different one.
  */
  useEffect(() => {
    setExpanded(cur => (cur !== null && cur >= cfg.layout ? null : cur));
  }, [cfg.layout]);

  useEffect(() => {
    if (expanded === null) return;
    const onKey = (e: KeyboardEvent) => {
      // A modal over the takeover took the key already (Modal marks it)
      if (e.key === 'Escape' && !e.defaultPrevented) closeExpandedRef.current();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [expanded]);

  /*
    A PHONE GETS ONE CHART, and it is the same rule Pulse uses — `useIsPhone`,
    not a second breakpoint. `PHONE_QUERY` already carries the landscape clause
    `(pointer: coarse) and (max-height: 540px)`, which was written for exactly
    this failure: a handset held sideways is 844x390, WIDER than the md floor,
    so a width test hands it the full desk inside 390px of height.

    Terrain has been on `useIsBelowLg` alone, which stacks the panes and lets
    the page scroll — four charts at `min-h-[420px]` against a 334px viewport.

    ONE pane, not four shrunk. 420px is the floor for a chart that can be read
    at all, and the desk already caps at four for the matching reason ("at 1440
    a fifth pane is 260px wide, and a chart that narrow stops being a chart").
    Four panes into 334px produces four charts nobody can read; one pane
    produces one they can.
  */
  const isPhone = useIsPhone();

  /*
    AND THE RAILS ARE NOT ON SCREEN BELOW `lg`.

    PaneLadder renders with `className="hidden lg:flex"` (see the pane, below),
    so between 768px and 1023.98px every pane's stored `ladder` flag is still
    `true` while nothing is drawn. Measured at 900x800 layout 3: three rails
    in the DOM, `display: "none"` and 0px wide, all three.

    That is deliberate and it stays — the rail is 132px, and the comment at the
    render site says why a narrow column cannot carry it. What was NOT
    deliberate is that the flag went on being read as if it were visible:

      · the arrangement bar held `right: 216px` (132 + the 76px price gutter +
        8) for a rail that is `display: none`, which put its Rows3 icon and
        its `1`/`2` buttons on the volume histogram with 135px of empty runway
        beside them. Measured at 768, 900 and a coarse-pointer 820x1180; at
        1024 the same expression is right and the gap is 3px.

      · STRIKES rendered lit, `aria-pressed="true"`, titled "Hide every strike
        rail". At 1023x800 a real mouse click on it rewrote all four panes'
        flags to `false` in storage and changed NOTHING on screen — 0 rails
        before, 0 after. The comment above the bar states the rule it broke:
        "A control that visibly does nothing when pressed is worse than an
        absent one."

    So the breakpoint is read wherever the flag is acted on, not just where the
    rail is drawn. The stored preference is still never touched by the window
    — it comes back the moment the reader is wide enough, which is the whole
    point of hiding by breakpoint rather than by config.
  */
  const belowLg = useIsBelowLg();
  /* The key handler is installed once and must never read a stale closure —
     the same mirror the config and the expanded pane already keep. */
  const belowLgRef = useRef(false);
  belowLgRef.current = belowLg;

  const panes = cfg.panes.slice(0, cfg.layout);
  const anyLadder = panes.some(p => p.ladder);

  /*
    WHICH PANE A KEY ACTS ON.

    Stored unclamped and clamped on read, the same way the pane configs are:
    going 4 → 2 → 4 gives the fourth pane back rather than having silently
    forgotten it. It starts at 0 from first paint, so no key ever acts on
    something the reader cannot see, and reaching for any control inside a
    pane makes that pane active before the control does its own job.
  */
  const [activeRaw, setActiveRaw] = useState(0);
  const activeRaw0 = useRef(0);
  activeRaw0.current = activeRaw;
  const active = Math.min(activeRaw, cfg.layout - 1);
  /* Mirrors for the key handler, which is installed once and must never read
     a stale closure — the same pattern the charts use for their own
     subscriptions. */
  const activeRef = useRef(0);
  activeRef.current = active;
  /* Assigned during render, not in an effect: two keys inside one frame must
     both see the config the first one produced. */
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;

  /*
    WHICH PANES ARE REPLAYING — T-13.

    Four flags rather than one index: nothing stops a reader replaying two
    panes side by side, and that is arguably the point of a four-pane desk.
    Held here rather than in the panes because `p` acts on the active one and
    because the crosshair has to know (see `emitCrosshair`).

    NOT PERSISTED. It is a mode, not a setting — a reader who left a pane
    scrubbing yesterday wants a live chart today, not a frozen one. Same
    reasoning as draw mode.
  */
  const [replaying, setReplaying] = useState<boolean[]>(() => [false, false, false, false]);
  /* each replaying pane's play-and-pause and step, for Shift ↓ and Shift → (item 8) */
  const replayKeys = useRef(new Map<number, { toggle: () => void; step: () => void; playing: () => boolean; picking: () => boolean }>());
  const compareRoom = useRef(new Map<number, boolean>());
  /* one function a pane for the life of the page, so the pane's effect does not re-run each render */
  const compareRoomSetters = useRef(new Map<number, (room: boolean | null) => void>());
  const compareRoomOf = (i: number) => {
    let f = compareRoomSetters.current.get(i);
    if (!f) {
      f = room => {
        if (room === null) compareRoom.current.delete(i);
        else compareRoom.current.set(i, room);
      };
      compareRoomSetters.current.set(i, f);
    }
    return f;
  };
  const replayingRef = useRef<boolean[]>(replaying);
  replayingRef.current = replaying;
  const setPaneReplay = (i: number, on: boolean) =>
    setReplaying(prev => (prev[i] === on ? prev : prev.map((v, j) => (j === i ? on : v))));

  /* Draw mode, the same shape and here for the same reasons — see PaneProps. */
  const [drawingPanes, setDrawingPanes] = useState<boolean[]>(() => [false, false, false, false]);
  const drawingRef = useRef<boolean[]>(drawingPanes);
  drawingRef.current = drawingPanes;
  const setPaneDrawing = (i: number, on: boolean) =>
    setDrawingPanes(prev => (prev[i] === on ? prev : prev.map((v, j) => (j === i ? on : v))));

  /** Which pane has a menu open, and which menu — so `s` and `c` can open one
      without every pane growing its own piece of state. */
  const [menu, setMenu] = useState<{ pane: number; which: 'symbol' | 'compare' } | null>(null);
  /* the T key: the active pane's calendar (PaneHead `openDateNonce`) */
  const [dateAsk, setDateAsk] = useState<{ pane: number; n: number }>({ pane: -1, n: 0 });
  /* the W key cycles the desk's expiry window — on the feed, where windows exist */
  const deskSrc = useTerrainSource();
  const deskOnFeedRef = useRef(deskSrc === 'feed');
  deskOnFeedRef.current = deskSrc === 'feed';
  /* The key handler has to know a menu is up. `editable` already covers the
     search box inside one — but the focus trap can put focus on the panel
     itself, and ↑/↓ pressed there belong to the list being read, not to the
     pane behind it. */
  const menuOpenRef = useRef(false);
  menuOpenRef.current = menu !== null;

  /*
    WHO OWNS ↑ AND ↓ — and it is not always this desk.

    Every other Terrain key is an unmodified letter or digit, which the browser
    does nothing with. The arrows scroll the page, and between `md` and `lg`
    THIS PAGE SCROLLS: the panes stack and the root drops its height cap. A
    desk that swallowed the arrows there would take a keyboard reader's only
    way down a four-pane column — the keyboard version of "Below lg the page
    could not be scrolled, because the charts ate the wheel", which is already
    a fix in this file's history.

    So the flip is bound exactly where the desk owns the viewport and there is
    no scrolling left to steal: on a phone (one pane, `100dvh`), from `lg` up
    (the grid fills the window), and while a pane is expanded at any width —
    that overlay is `fixed inset-0` and pins `body { overflow: hidden }`, so
    the arrows have nothing to scroll whatever the breakpoint says.
  */
  const deskOwnsViewportRef = useRef(false);
  deskOwnsViewportRef.current = isPhone || !belowLg;

  /* A ring is feedback for people who can see it. Everything a key changes is
     also said out loud, or the whole layer is silent to a screen reader. */
  const [announce, setAnnounce] = useState('');
  const paneRefs = useRef<(HTMLDivElement | null)[]>([]);

  /*
    THE KEYS.

    Installed once, for the page's life: every mutation goes through a
    functional updater so the deps stay empty and `revision` — which bumps ten
    times a minute — cannot tear the listener down and rebuild it.

    Guards first. A key pressed while typing belongs to the text field, not to
    the desk, and `e.repeat` is dropped so a held key does not walk the
    timeframe list at the keyboard's repeat rate.
  */
  useEffect(() => {
    const editable = (el: EventTarget | null) => {
      const n = el as HTMLElement | null;
      return !!n && (n.tagName === 'INPUT' || n.tagName === 'TEXTAREA' || n.tagName === 'SELECT' || n.isContentEditable);
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.metaKey || ev.ctrlKey || ev.altKey || ev.isComposing || ev.repeat) return;
      if (editable(ev.target) || editable(document.activeElement)) return;
      /* a house layer open over the desk (the keys sheet, a guide, the alerts drawer) takes the keys: none acts on the
         desk behind it (the audit's A-257 — `2` changed the layout behind the sheet) */
      if (layerOpen()) return;
      /* CAPS LOCK reads the letters as typed without it (the audit's A-256: P, D, T … matched nothing and r became R) */
      const caps = ev.key.length === 1 && ev.getModifierState?.('CapsLock') === true;
      const key = caps ? (ev.key === ev.key.toUpperCase() ? ev.key.toLowerCase() : ev.key.toUpperCase()) : ev.key;
      const e = { key, shiftKey: ev.shiftKey, preventDefault: () => ev.preventDefault() };
      const i = activeRef.current;
      /* Read the config, compute the delta, then set — rather than doing any
         of it inside the updater. An updater that also calls setState is not
         pure, and React is free to run it more than once. */
      const cur = cfgRef.current;
      /* THROUGH setPane, not straight to setCfg. That reducer is the one place
         a pane change is turned into the symbol's remembered setup, and a
         second writer here meant a key-driven change was never remembered —
         measured: the `=` key moved the pane to 1h and wrote no SPY entry. */
      const patch = (fn: (q: PaneCfg) => Partial<PaneCfg>, say: (q: PaneCfg) => string) => {
        const q = cur.panes[i];
        if (!q) return;
        const delta = fn(q);
        setPaneRef.current(i, delta);
        setAnnounce(say({ ...q, ...delta }));
      };

      /* THE REPLAY'S KEYS (the owner's item 8, TradingView's): Shift ↓ plays and pauses, Shift → steps a bar — on the active
         pane while it replays; elsewhere Shift ↓ is ↓ as before */
      if (e.shiftKey && (e.key === 'ArrowDown' || e.key === 'ArrowRight') && (replayingRef.current[i] ?? false)) {
        const k = replayKeys.current.get(i);
        if (k) {
          e.preventDefault();
          /* before a bar is picked nothing can play or step: say so (the audit's A-240/241 — it said "Replay playing") */
          if (k.picking()) {
            setAnnounce('Pick a bar to replay from first');
            return;
          }
          if (e.key === 'ArrowDown') {
            const was = k.playing();
            k.toggle();
            setAnnounce(was ? 'Replay paused' : 'Replay playing');
          } else {
            k.step();
            setAnnounce('Replay one bar on');
          }
          return;
        }
      }
      switch (e.key) {
        case '1': case '2': case '3': case '4': {
          e.preventDefault();
          const n = Number(e.key) as TerrainLayout;
          changeLayoutRef.current(n);
          setAnnounce(n === 1 ? 'One chart' : `${n} charts`);
          return;
        }
        case '[': case ']': {
          e.preventDefault();
          const n = cur.layout;
          const next = ((Math.min(activeRaw0.current, n - 1) + (e.key === ']' ? 1 : -1)) + n) % n;
          setActiveRaw(next);
          /* Below `lg` the panes stack and the page scrolls, so the newly
             active one can be off screen entirely. */
          paneRefs.current[next]?.scrollIntoView({ block: 'nearest' });
          setAnnounce(`Chart ${next + 1} of ${n}, ${cur.panes[next]?.ticker ?? ''}`);
          return;
        }
        case '-': case '=':
          e.preventDefault();
          patch(q => ({ timeframe: stepTf(q.timeframe, e.key === '=' ? 1 : -1) }), q => `${q.ticker} ${q.timeframe}`);
          return;
        /*
          THE WATCHLIST FLIP — the active pane's symbol, without the picker.

          Through the SAME reducer every other symbol change goes through, so
          the name arrives with the setup the reader left it in: interval,
          overlays, indicators, style and comparisons, all in one commit. That
          is the whole reason this key is nearly free — see ./setups.

          The ring is rebuilt from the live config on every press rather than
          memoised into a ref. It is at most 64 short strings and this runs
          once per keystroke; a stale ring after a symbol was configured would
          be a real bug, and there is nothing here worth risking it for.

          Announced with the POSITION, not just the name. The ring is a list
          nobody can see, so "NVDA" alone leaves a reader with no idea whether
          the next press wraps — `4 of 7` says it.
        */
        /* j and k are ↓ and ↑ here too (2026-10-10, the ideas' keyboard leftovers) */
        case 'ArrowUp': case 'ArrowDown': case 'j': case 'k': {
          if (!deskOwnsViewportRef.current && expandedRef.current === null) return;
          if (menuOpenRef.current) return;
          const q = cur.panes[i];
          if (!q) return;
          e.preventDefault();
          const ring = flipRing(Simulator.WATCHLIST, Object.keys(cur.setups));
          const next = stepSymbol(ring, q.ticker, e.key === 'ArrowDown' || e.key === 'j' ? 1 : -1);
          const at = ring.indexOf(next);
          /* A one-name ring steps onto itself. Announce it — silence on a
             keypress reads as a broken key — but do not push a patch that the
             reducer would turn into a no-op write of the whole config. */
          if (next !== symKey(q.ticker)) setPaneRef.current(i, { ticker: next });
          setAnnounce(at >= 0 ? `${next}, ${at + 1} of ${ring.length}` : next);
          return;
        }
        /* BOTH RAIL KEYS ARE UNBOUND BELOW `lg`, for the same reason the
           STRIKES button is not rendered there: the rail is `hidden lg:block`,
           so the only thing a press could do is rewrite storage silently and
           announce a rail that never appears. "Strike rail on every chart" read
           out to a screen reader while no rail exists is worse than a key that
           does nothing — it is a key that lies. They are the same control as
           the button, which titles itself "Shift R", so they come and go with
           it rather than half of it surviving. */
        case 'r':
          if (belowLgRef.current) return;
          e.preventDefault();
          patch(q => ({ ladder: !q.ladder }), q => `${q.ticker} strike rail ${q.ladder ? 'shown' : 'hidden'}`);
          return;
        case 'R': {
          if (belowLgRef.current) return;
          e.preventDefault();
          const any = cur.panes.slice(0, cur.layout).some(q => q.ladder);
          setCfg(prev => ({ ...prev, panes: prev.panes.map(q => ({ ...q, ladder: !any })) }));
          setAnnounce(any ? 'Every strike rail hidden' : 'Strike rail on every chart');
          return;
        }
        /* REPLAY — T-13. Acts on the active pane, like every other pane key.
           The chart owns the transport once it is up; this is the door. */
        case 'p': {
          e.preventDefault();
          const on = !(replayingRef.current[i] ?? false);
          if (on && deskOnFeedRef.current && isCashIndex(cur.panes[i]?.ticker ?? '')) {
            setAnnounce(`No replay for ${cur.panes[i]?.ticker ?? 'an index'}: its minute bars are not on this plan`);
            return;
          }
          setPaneReplay(i, on);
          setAnnounce(`${cur.panes[i]?.ticker ?? ''} replay ${on ? 'on' : 'off'}`);
          return;
        }
        /* DRAW MODE — the pencil's key, so the strip can shed the pencil at
           widths that cannot pay for it and the layer stays reachable. */
        case 'd': {
          e.preventDefault();
          const on = !(drawingRef.current[i] ?? false);
          setPaneDrawing(i, on);
          setAnnounce(`${cur.panes[i]?.ticker ?? ''} draw mode ${on ? 'on' : 'off'}`);
          return;
        }
        /* THE UI PASS's keys (2026-10-14): T the calendar, W the window, L the legend */
        case 't':
          e.preventDefault();
          setDateAsk(prev => ({ pane: i, n: prev.n + 1 }));
          setAnnounce('Jump to a date');
          return;
        case 'w': {
          if (!deskOnFeedRef.current) return;
          e.preventDefault();
          const ring: RailCut[] = ['book', 'w:0dte', 'w:fri', 'w:opex'];
          const at = ring.indexOf(cur.railCut);
          const next = ring[(at < 0 ? 0 : at + 1) % ring.length];
          setCfg(prev => ({ ...prev, railCut: next }));
          setAnnounce(`Expiry window: ${next === 'book' ? 'all 60 days' : next === 'w:0dte' ? '0DTE' : next === 'w:fri' ? 'to Friday' : 'to monthly OPEX'}`);
          return;
        }
        case 'l':
          e.preventDefault();
          patch(q => ({ legend: q.legend === false ? undefined : false }), q => `${q.ticker} bead legend ${q.legend === false ? 'hidden' : 'shown'}`);
          return;
        case 'f':
          e.preventDefault();
          toggleExpandRef.current(i);
          setAnnounce(`${cur.panes[i]?.ticker ?? ''} ${expandedRef.current === i ? 'collapsed' : 'expanded'}`);
          return;
        case 's':
          e.preventDefault();
          setMenu({ pane: i, which: 'symbol' });
          return;
        case 'c':
          e.preventDefault();
          if (compareRoom.current.get(i) === false) {
            setAnnounce('No room for Compare in this chart — F opens it full size');
            return;
          }
          setMenu({ pane: i, which: 'compare' });
          return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /*
    CROSSHAIR SYNC — one pane's hover, marking the same MOMENT on the others.

    IMPERATIVE, and that is the design rather than a shortcut. A hovered
    timestamp in React state would re-render every Pane and every StrikeChart
    at mousemove rate; neither is memoised, so that is up to four chart
    subtrees reconciled per pointer event on a desk whose whole premise is that
    the charts stay smooth. The panes hand up their own "mark that moment"
    function and the desk calls it directly: no state, no render.

    Only the moment travels — never a price. Two panes are usually two symbols,
    and the library's magnet discards a foreign price anyway, snapping to the
    receiving chart's own close.
  */
  const sinks = useRef(new Map<number, CrosshairSync>()).current;
  const sourcePane = useRef<number | null>(null);

  /* Plain functions, recreated every render on purpose: StrikeChart holds
     syncRegister through a ref and calls it only on mount, and reaches
     onCrosshair through a ref refreshed every render, so a changing identity
     costs nothing and useCallback here would be ceremony. */
  const registerSync = (i: number, apply: CrosshairSync | null) => {
    if (apply) sinks.set(i, apply);
    else sinks.delete(i);
  };

  /*
    WHOSE MOMENT MAY TRAVEL — the T-13 question, settled here.

    A REPLAYING PANE'S MOMENT IS HISTORICAL. Marking it on a live pane says
    "your cursor is at this time on this chart too", and it is not: the live
    pane is showing today and the mark would land on a bar from a different
    session entirely. The reverse is worse — a live hover jumping a replaying
    pane's crosshair off the position the reader is scrubbing.

    So a moment travels only between panes in the SAME MODE and on the SAME
    INTERVAL. Two replaying panes at 1m and 15m are scrubbing independent
    positions in history, and their bar grids do not line up; `applySync` would
    refuse most of those marks anyway (it floors to the receiving pane's own
    bucket and draws nothing outside its visible range), but "would refuse
    most" is not a rule, and this is.

    Live panes are unchanged: they sync to each other exactly as before,
    whatever intervals they are on, because they are all showing NOW.
  */
  const emitCrosshair = (i: number, time: Parameters<CrosshairSync>[0]) => {
    /* A LEAVE from a pane that is not the current source is stale. Dragging
       the pointer from one pane straight onto the next fires the old pane's
       leave and the new pane's enter in the same turn, and honouring that
       leave would wipe the mark the new pane had just set — a visible flicker
       on exactly the gesture this feature exists for. */
    if (time === null && sourcePane.current !== i) return;
    sourcePane.current = time === null ? null : i;
    const rep = replayingRef.current;
    const panesNow = cfgRef.current.panes;
    for (const [j, apply] of sinks) {
      if (j === i) continue;
      const sameMode = (rep[j] ?? false) === (rep[i] ?? false);
      /* The interval clause applies only in replay — see the note above. */
      const ok = rep[i] ? sameMode && panesNow[j]?.timeframe === panesNow[i]?.timeframe : sameMode;
      if (ok) apply(time);
      /* A pane that is NOT going to be marked has its old mark cleared, or a
         stale crosshair sits on it for as long as the reader hovers elsewhere. */
      else apply(null);
    }
  };

  /* Nothing carries across a change of arrangement: a pane that has gone
     leaves no mark behind it, and the fullscreen takeover has nothing to sync
     with. */
  useEffect(() => {
    for (const apply of sinks.values()) apply(null);
    sourcePane.current = null;
  }, [cfg.layout, expanded, sinks]);

  return (
    /*
      FULL BLEED, and only from `lg`. The negative margins cancel the shell's
      own padding (px-4/6/8, pt-5, pb-16) so the panes reach the window edges,
      and the height is the viewport less the 56px top bar — measured in the
      built page, not guessed at. Below `lg` every one of those comes off and
      the page scrolls normally.
    */
    <div
      /*
        FULL BLEED, from `lg` — and on a PHONE, which is the addition. The
        negative margins cancel the shell's own padding (px-4/6/8, pt-5, pb-16)
        so the pane reaches the window edges, and the height is the viewport
        less the 56px top bar, measured in the built page rather than guessed.
        Between the two — tablets, narrow laptops — the panes still stack and
        the page scrolls normally, which is the right shape for a window that
        can hold more than one chart but not side by side.

        `dvh` on the phone, `vh` above it. On a phone browser `100vh` is the
        height with the URL bar RETRACTED, so a pane sized to it runs under the
        browser chrome until the reader scrolls — and the bottom of a Terrain
        pane is its time axis. Pulse already documents this; same reason here.
      */
      /* THE WHOLE WINDOW from `lg` (Noah, 2026-09-13, the desk bar with a dead
         band under it: "because we removed the footer from the terrain page
         you can fit the rest of the chart in this bottom section"): the
         height used to subtract the 56px top bar, which the frame lost on
         2026-09-05 — so 56px sat empty under the desk. Measured before: the
         root 904 tall in a 960 window, the panes ending at 861. The phone
         keeps its subtraction: it still has a bar up top. */
      className={`relative -mx-4 lg:-mx-6 2xl:-mx-8 px-1.5 flex flex-col ${
        isPhone
          ? '-mt-5 -mb-16 py-1.5 h-[calc(100dvh-3rem)] min-h-0'
          : 'lg:-mt-5 lg:-mb-16 lg:py-1.5 lg:h-screen lg:min-h-0'
      }`}
    >
      {/*
        THE ARRANGEMENT CONTROLS, floating over the top-right of the grid.

        There is no page title and no caption any more (Noah, 2026-08-25: "i
        don't need to be told what page i'm on i know what i clicked"). He is
        right — a heading that names the thing you just navigated to is a line
        of chrome that tells a reader something they did on purpose thirty
        seconds ago, and on this desk that line was coming out of the charts.

        What is left is the two controls that belong to the ARRANGEMENT rather
        than to any chart, and they float rather than sit in flow, so they
        cost the grid nothing. Top RIGHT, because every pane's own controls
        float top left and two translucent strips on the same corner would
        stack into an unreadable pile.

        NOT ON A PHONE, and this is a correctness point rather than a space
        one. Both controls are inert there: the arrangement picker sets a pane
        COUNT, and a phone renders exactly one pane whatever it says, so
        pressing 4 changes nothing a reader can see; STRIKES toggles the strike
        rails, which are `hidden lg:block` and so never draw on a phone at all.
        A control that visibly does nothing when pressed is worse than an
        absent one — it teaches the reader that the desk is broken.

        The symbol is still changeable: every pane carries its own picker in
        its header, and `[` / `]` still walk the configured slots.
      */}
      {!isPhone && (
      <div
        /*
          BOTTOM right, not top right.

          Top right put them straight through the last pane's own header: a
          pane's identity strip is as wide as its numbers, and at three-up the
          heaviest-strike read carries it most of the way across. Two floating
          things on the same corner is one unreadable thing.

          The bottom right of a chart is the emptiest region on this desk — it
          is the room held open AHEAD of the last bar, by design — so controls
          parked there cover nothing. Lifted clear of the time axis, and
          cleared past the last pane's rail when it has one; the rail's width
          comes from its own export rather than a number copied here that
          drifts the first time somebody edits the other file.
        */
        /* Cleared past the rail of the pane that is actually UNDER it. That is
           the last pane normally, but the EXPANDED one while a pane is
           expanded — it is the only one on screen, and its rail is the only
           one this bar can land on. Reading the last pane's flag there put the
           clearance on the wrong pane's setting the moment the two differed. */
        /* `&& !belowLg` because the rail is hidden by BREAKPOINT and kept in
           config: below `lg` the flag reads true against a `display: none`
           element, and the 132px it buys is clearance from nothing. Measured
           at 900x800 layout 3 — bar at `right: 216px`, every rail 0px wide,
           135px of dead runway between the bar and the price gutter while the
           bar itself sat on the volume columns. At 1024 the flag and the rail
           agree again and the gap is 3px. */
        style={
          expanded !== null
            ? {
                right: (panes[expanded]?.ladder && !belowLg ? panes[expanded]?.ladderW ?? profileRestWidth(cfg.layout, true) : 0) + PRICE_GUTTER_PX + 8,
                bottom: TIME_AXIS_PX + 12,
              }
            : undefined
        }
        /* They come and go like the pane chrome, and they were the loudest
           thing on the screen while they were here: a solid white STRIKES
           button and a solid white active count, on a desk that had just been
           asked for less. Quiet at rest, full on hover or keyboard focus. */
        /*
          ABOVE THE EXPANDED PANE, AND FIXED WHILE IT IS UP.

          The expanded pane is `fixed inset-0 z-[80]`, and this bar was
          `absolute z-30` — under it. All three controls stayed mounted,
          `opacity: 1` and `pointer-events: auto`, and `elementFromPoint` at
          each one's own centre returned the expanded chart's canvas: painted,
          and dead. Measured at 1440x900 and 1024x768.

          The Esc chip is the one that made this worth fixing, because it
          renders ONLY while expanded — a control whose entire job is the
          pointer way out of fullscreen, shipped in the one state where it
          cannot be clicked. (The pane's own Collapse button is inside the
          modal and does work, so this was a dead duplicate rather than a
          trap; it still offered a reader a button that does nothing.)

          `fixed` rather than `absolute` while expanded, to match what it now
          sits over: `absolute` anchors to this page root, and below `lg` the
          root is a scrolling column rather than the viewport, so the bar
          would ride down the page while the modal stayed pinned to the glass.
        */
        /*
          THE DESK BAR, DOCKED: A ROW UNDER THE GRID (Noah, 2026-09-13, "also
          touch the desk bar at the bottom", with a two-up desk where it lay
          across both panes' feet — over one pane's volume columns, under the
          other's watermark, at a 40% rest-dim that read as faint). The floating
          placement was cut for a one-up desk, whose bottom-right corner is
          the room ahead of the last bar; on a two-up the bar is wider than a
          pane's plot, so it lands on whatever is there. In flow it lands on
          nothing: the grid gives up one row (the room the bar takes is now the
          desk's, not the tape's), the chips read at full strength on the
          page's own ground — whatever theme the tapes wear — and the pointer
          finds them without a hover first. FULLSCREEN KEEPS THE FLOAT: the
          expanded pane is the whole screen and this bar rides fixed over its
          foot with Pine and Esc, quiet at rest as before.
        */
        className={
          expanded !== null
            ? 'chrome-hover pointer-events-none flex items-center gap-2 opacity-40 transition-opacity duration-200 hover:opacity-100 focus-within:opacity-100 fixed z-[90]'
            : 'order-last shrink-0 mt-1.5 flex items-center justify-end gap-2'
        }
        data-terrain-desk-bar={expanded !== null ? 'floating' : 'docked'}
        /* Floating over the expanded pane, it is chrome over that tape and wears
           its ground like the strip does (index.css) — dark words on Stone */
        data-chart-chrome={expanded !== null ? '' : undefined}
        data-chart-ground={expanded !== null ? chartGround(panes[expanded]?.theme ?? pageDefaultCandleKey()) : undefined}
      >
        <div
          role="group"
          aria-label="How many charts"
          className="pointer-events-auto inline-flex flex-wrap items-center gap-0.5 border border-ink/[0.08] bg-canvas/40 backdrop-blur-[3px] rounded-md p-0.5"
        >
          <Rows3 className="w-3.5 h-3.5 mx-1.5 text-textMuted shrink-0" aria-hidden />
          {LAYOUTS.map(n => {
            const active = n === cfg.layout;
            return (
              <button
                key={n}
                onClick={() => changeLayout(n)}
                aria-pressed={active}
                aria-label={`${n} ${n === 1 ? 'chart' : 'charts'}`}
                title={`${n} ${n === 1 ? 'chart' : 'charts'} — press ${n}`}
                className={`hit px-2.5 py-1 rounded font-mono text-[11px] font-semibold tnum transition-colors ${
                  active ? 'bg-ink/[0.16] text-textPrimary' : 'text-textSecondary hover:text-textPrimary hover:bg-ink/[0.06]'
                }`}
              >
                {n}
              </button>
            );
          })}
        </div>

        {/* Every pane at once — a convenience over the per-pane ×, not the
            only way out of the rail. It reads the panes rather than holding
            its own flag: if any visible pane still shows a rail the button is
            lit and pressing it clears them all; with none showing it puts
            them all back. A button that can disagree with what is on screen
            is a button nobody trusts.

            AND BELOW `lg` IT IS NOT HERE AT ALL, which is that same sentence
            taken seriously. The rail is `hidden lg:block`, so from 768px to
            1023.98px this button disagreed with the screen in the strongest
            way available: lit, `aria-pressed="true"`, titled "Hide every strike
            rail", and clicking it at 1023x800 rewrote all four panes to
            `false` with 0 rails on screen before and 0 after. The layout
            picker beside it stays, because it is NOT inert there — the panes
            stack and the page scrolls, so 4 really does draw four charts. */}
        {!belowLg && (
        <button
          /* Named so a control that REMOVES itself can hand focus here — see
             the rail's × below. A data attribute rather than an id: a desk can
             hold four panes and an id has to be unique, while this button is
             the one global undo for all of them. */
          data-strikes-toggle=""
          onClick={() => setCfg(prev => ({ ...prev, panes: prev.panes.map(p => ({ ...p, ladder: !anyLadder })) }))}
          aria-pressed={anyLadder}
          title={anyLadder ? 'Hide every strike rail — Shift R' : 'Show the strike rail beside every chart — Shift R'}
          className={`pointer-events-auto inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-ink/[0.08] backdrop-blur-[3px] font-mono text-[11px] uppercase tracking-wider transition-colors ${
            anyLadder ? 'bg-ink/[0.16] text-textPrimary' : 'bg-canvas/40 text-textSecondary hover:text-textPrimary'
          }`}
        >
          Strikes
        </button>
        )}

        {/* THE RAILS' COLOURS, one card for the desk (Noah, 2026-09-13) — here
            rather than in each rail's head, which is 132px on a three-up desk
            and cannot hold it; hidden with the rails, like the button beside it */}
        {!belowLg && anyLadder && (
          <span className="pointer-events-auto inline-flex" data-terrain-colours>
            {/* the Expiry cut lives in each rail's head beside the view tabs (2026-09-16) — one desk-wide choice, changed from any pane */}
            <DropdownSelect label="Colours" value={cfg.palette} options={PALETTE_OPTIONS} onChange={p => setCfg(prev => ({ ...prev, palette: p, rails: p }))} title="What the rails' colours mean" testId="terrain-colours" />
          </span>
        )}

        {/* T-19's desk-wide ruler, in the desk's own cluster — the same four
            chips the flip strip carries on Pinpoint, one store behind both. */}
        <span className="pointer-events-auto inline-flex rounded-md border border-ink/[0.08] bg-canvas/40 backdrop-blur-[3px] px-1 py-0.5">
          <DistanceUnitPicker dense />
        </span>

        {/* T-18 — the named-layouts shelf, in the desk's own cluster. */}
        <span className="relative pointer-events-auto">
          <button
            onClick={() => setLayoutsOpen(o => !o)}
            aria-haspopup="dialog"
            aria-expanded={layoutsOpen}
            title="Named layouts — save this arrangement, recall another"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-ink/[0.08] backdrop-blur-[3px] font-mono text-[11px] uppercase tracking-wider transition-colors ${
              layoutsOpen ? 'bg-ink/[0.16] text-textPrimary' : 'bg-canvas/40 text-textSecondary hover:text-textPrimary'
            }`}
          >
            <Rows3 className="w-3 h-3" /> Layouts
          </button>
          {layoutsOpen && (
            <>
              <span className="fixed inset-0 z-30" onClick={() => setLayoutsOpen(false)} aria-hidden />
              <div
                role="dialog"
                aria-label="Named layouts"
                onKeyDown={e => {
                  /* Escape closes the shelf from anywhere inside it — a
                     panel with a click-away backdrop and no key out is a
                     trap for keyboard readers (and the probe that found
                     this). Stopped, so the desk's own Escape does not also
                     fire. */
                  if (e.key === 'Escape') {
                    e.stopPropagation();
                    setLayoutsOpen(false);
                  }
                }}
                className="absolute bottom-full right-0 mb-2 z-40 w-64 border border-borderMuted bg-panel/95 rounded-md p-2 shadow-xl shadow-black/50"
              >
                <div className="font-mono text-[11px] uppercase tracking-widest text-textMuted px-1 pb-1.5">
                  Named layouts · {Object.keys(namedLayouts).length}/{MAX_NAMED_LAYOUTS}
                </div>
                {Object.entries(namedLayouts)
                  .sort((a, b) => b[1].savedAt - a[1].savedAt)
                  .map(([name, entry]) => (
                    <div key={name} className="flex items-center gap-1 group">
                      <button
                        onClick={() => applyNamedLayout(entry)}
                        title={`${entry.layout} pane${entry.layout === 1 ? '' : 's'} · ${entry.panes.slice(0, entry.layout).map(pn => pn.ticker).join(' ')}`}
                        className="flex-1 min-w-0 text-left px-1.5 py-1 rounded font-mono text-[11px] text-textSecondary hover:text-textPrimary hover:bg-ink/[0.05] truncate transition-colors"
                      >
                        {name}
                        <span className="ml-1.5 text-[11px] text-textMuted tnum">
                          {entry.layout}× {entry.panes.slice(0, entry.layout).map(pn => pn.ticker).join('·')}
                        </span>
                      </button>
                      <button
                        onClick={() => removeNamedLayout(name)}
                        aria-label={`Delete the layout ${name}`}
                        className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded text-textMuted opacity-0 group-hover:opacity-100 hover:text-textPrimary hover:bg-ink/[0.08] transition-all"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                {Object.keys(namedLayouts).length === 0 && (
                  <div className="px-1.5 py-1 font-mono text-[11px] text-textMuted">Nothing saved yet — name this desk below.</div>
                )}
                <div className="mt-1.5 pt-1.5 border-t border-borderSubtle/60 flex items-center gap-1">
                  <input
                    value={layoutName}
                    onChange={e => { setLayoutName(e.target.value); setLayoutNote(null); }}
                    onKeyDown={e => { if (e.key === 'Escape') { setLayoutsOpen(false); return; } e.stopPropagation(); if (e.key === 'Enter') saveCurrentLayout(); }}
                    placeholder="name this arrangement"
                    aria-label="Layout name"
                    className="flex-1 min-w-0 px-1.5 py-1 rounded border border-borderSubtle bg-inset font-mono text-[11px] text-textPrimary placeholder:text-textMuted outline-none focus:border-borderMuted"
                  />
                  <button
                    onClick={saveCurrentLayout}
                    className="shrink-0 px-2 py-1 rounded font-mono text-[11px] uppercase tracking-wider text-select hover:bg-select/10 transition-colors"
                  >
                    Save
                  </button>
                </div>
                {layoutNote && <div className="px-1.5 pt-1 font-mono text-[11px] text-textMuted">{layoutNote}</div>}
              </div>
            </>
          )}
        </span>

        {/* THE PINE DOOR, FULLSCREEN ONLY (Noah, 2026-09-12: "there should be
            another button here ONLY on full screen that has the Pine ability
            to open up the terminal on the right side"): the editor docks at
            the right of the expanded pane (data/editorDock.ts — the pane
            narrows by --editor-w), a blank script for THIS pane. Docked panes
            have no room beside them, so no door. */}
        {expanded !== null && (
          <button
            onClick={() => openEditor(null, `terrain:${expanded + 1}`)}
            title="Write a Pine script for this chart — the editor opens beside it"
            className="pointer-events-auto inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-ink/[0.08] bg-canvas/40 backdrop-blur-[3px] font-mono text-[11px] uppercase tracking-wider text-textSecondary hover:text-textPrimary transition-colors"
            data-terrain-pine
          >
            <Code2 className="w-3 h-3" /> Pine
          </button>
        )}

        {/* WHERE IN THE WEEK the wall clock sits — the chip, re-read on every tick's render; the shading down the panes is
            each pane's Session phases overlay (components/terrain/sessionPhasesPrimitive.ts). */}
        {(() => {
          const words = FUTURES_PHASE_WORDS[futuresPhaseAt(new Date())];
          return (
            <span
              /* no promise of a feature to come (the audit's X7.15) — the phases are on every pane's Overlays menu now */
              title={`${words.blurb}. The session's phases can be shaded on any pane — Overlays, Session phases.`}
              className={`pointer-events-auto inline-flex items-center px-2 py-1.5 rounded-md border border-ink/[0.08] bg-canvas/40 backdrop-blur-[3px] font-mono text-[11px] uppercase tracking-wider ${
                words.label === 'RTH' ? 'text-textPrimary' : 'text-textSecondary'
              }`}
            >
              {words.label}
            </span>
          );
        })()}

        {expanded !== null && (
          <button
            onClick={() => closeExpanded()}
            className="pointer-events-auto inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-borderSubtle bg-canvas/70 backdrop-blur-[2px] font-mono text-[11px] uppercase tracking-wider text-textSecondary hover:text-textPrimary"
          >
            <X className="w-3.5 h-3.5" /> Esc
          </button>
        )}
      </div>
      )}

      {/* The ring and the badge are feedback for people who can see them. A
          key that rearranges the desk has to say so as well, or the whole
          layer is silent to a screen reader. */}
      <span className="sr-only" aria-live="polite">{announce}</span>
      {/* THE PAGE'S NAME for the keys and a screen reader (the audit's X4.9): the charts are the page, so no head is drawn */}
      <h1 className="sr-only">Terrain</h1>

      {/*
        THE CHARTS ARE THE PAGE, so the grid takes every pixel the root has
        left rather than a fraction of the viewport. `flex-1 min-h-0` is what
        does it — min-h-0 is what lets a flex child actually shrink; without
        it the charts set the floor and the grid grows past the window.

        Below `lg` the panes stack and each takes a readable minimum instead,
        because four charts sharing one phone screen is four unreadable ones.
      */}
      <div
        /* The stacked-phone minimum lives on the PANE, not here — see the
           note on Pane's own wrapper for why a rule here does nothing. */
        className={`grid ${isPhone ? COLS[1] : COLS[cfg.layout]} ${
          isPhone ? ROWS[1] : ROWS[cfg.layout]
        } gap-1.5 flex-1 min-h-0 transition-opacity duration-200 ease-out ${swapping ? 'opacity-0' : ''}`}
      >
        {panes.map((pane, i) =>
          /*
            A REAL BRANCH, not `hidden`. A CSS-hidden pane still MOUNTS: three
            more StrikeCharts building canvases, subscribing to the tick and
            re-rendering every revision, behind a screen nobody can see, on the
            device least able to carry them.

            The INDEX is preserved rather than the array re-sliced, because
            every callback below is index-based — `setPane(i, …)`,
            `expanded === i`, `paneRefs.current[i]`, and the `[`/`]` cycle. Show
            pane 2 of 4 on a phone and it is still pane 2 to all of them, so a
            setting changed there lands where the reader expects when they open
            the desk again.
          */
          isPhone && i !== active ? null : (
          <Pane
            key={i}
            cfg={pane}
            onCfg={patch => setPane(i, patch)}
            revision={revision}
            expanded={expanded === i}
            onToggleExpand={() => toggleExpand(i)}
            closing={expClosing}
            index={i}
            tall={cfg.layout === 1}
            onCrosshair={t => emitCrosshair(i, t)}
            registerSync={apply => registerSync(i, apply)}
            registerReplayKeys={k => {
              if (k) replayKeys.current.set(i, k);
              else replayKeys.current.delete(i);
            }}
            registerCompareRoom={compareRoomOf(i)}
            replay={replaying[i] ?? false}
            onToggleReplay={() => setPaneReplay(i, !(replaying[i] ?? false))}
            /* The chart calls this itself on a ticker or timeframe change —
               a replay was recorded in another world and cannot survive one. */
            onExitReplay={() => setPaneReplay(i, false)}
            drawing={drawingPanes[i] ?? false}
            onToggleDrawing={() => setPaneDrawing(i, !(drawingPanes[i] ?? false))}
            onExitDraw={() => setPaneDrawing(i, false)}
            isActive={i === active}
            onActivate={() => setActiveRaw(i)}
            paneCount={cfg.layout}
            palette={cfg.palette}
            railCut={cfg.railCut}
            onRailCut={c => setCfg(prev => ({ ...prev, railCut: c }))}
            openDateNonce={dateAsk.pane === i ? dateAsk.n : 0}
            menuOpen={menu?.pane === i ? menu.which : null}
            onMenu={which => setMenu(which ? { pane: i, which } : null)}
            onPopOut={isPhone ? undefined : () => openPopOut(`/out/terrain?pane=${encodeURIComponent(JSON.stringify(pane))}&rail=${encodeURIComponent(JSON.stringify({ palette: cfg.palette, rails: cfg.palette, railCut: cfg.railCut }))}`, `terrain-${i + 1}`, { w: 1100, h: 700 })}
            boxRef={el => { paneRefs.current[i] = el; }}
            /*
              THE ODD PANE OUT TAKES THE WHOLE ROW.

              Three panes in two columns leaves the second row half empty —
              at 1440, the most ordinary laptop width there is, that is a
              quarter of the desk showing nothing. The third pane spans both
              columns instead. From `2xl` the layout is three columns and the
              span comes straight back off, because there is no odd pane any
              more.
            */
            cell={cfg.layout === 3 && i === 2 ? 'lg:col-span-2 2xl:col-span-1' : ''}
          />
          )
        )}
      </div>
    </div>
  );
};

/* ---- ONE PANE IN A WINDOW OF ITS OWN (2026-10-10, the ideas report's pop-outs) --------------------------------------

   A pane opened from the desk's pop-out door stands alone in its window (pages/popout/PopOut.tsx): the same Pane, on
   the configuration it left the desk with, held by the window — the desk's own storage is never written from here, so a
   pop-out can change its interval without moving the desk's. Its link group is the shell's, so a name picked in the
   group anywhere comes here, and one picked here goes everywhere; the window's channel keeps the rest in step
   (components/layout/deskChannel.ts). A reload keeps what was changed (the window's session). */
const SOLO_KEY = 'slayer_popout_pane';
export const TerrainSoloPane = ({ initial, rail, onName }: { initial: unknown; rail?: unknown; onName?: (ticker: string) => void }) => {
  const revision = useTickSeq();
  const groups = useLinkGroups();
  const [pane, setPaneState] = useState<PaneCfg>(() => {
    let kept: unknown = null;
    try {
      kept = JSON.parse(sessionStorage.getItem(SOLO_KEY) ?? 'null');
    } catch {
      kept = null;
    }
    return readPane(kept ?? initial, defaultPanes()[0]);
  });
  const r = (rail && typeof rail === 'object' ? rail : {}) as { palette?: unknown; rails?: unknown; railCut?: unknown };
  const palette: ProfilePalette = r.rails === 'thermal' ? 'thermal' : 'house';
  const [railCut, setRailCut] = useState<RailCut>(() => ((typeof r.railCut === 'number' && (CALENDAR_DTES as readonly number[]).includes(r.railCut)) || isWindowCut(r.railCut) ? (r.railCut as RailCut) : 'book'));
  const [replay, setReplay] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [menu, setMenu] = useState<'symbol' | 'compare' | null>(null);
  useEffect(() => {
    onName?.(pane.ticker);
    try {
      sessionStorage.setItem(SOLO_KEY, JSON.stringify(pane));
    } catch {
      /* the window keeps it for the visit */
    }
  }, [pane]);
  const onCfg = (patch: Partial<PaneCfg>) => {
    const group = patch.link !== undefined ? patch.link : (pane.link ?? null);
    if (group && patch.ticker) setLinkGroup(group, patch.ticker);
    else if (patch.link && !groups[patch.link]) setLinkGroup(patch.link, pane.ticker);
    setPaneState(p => ({ ...p, ...patch }));
  };
  /* a name the group took elsewhere comes to this pane */
  useEffect(() => {
    const name = pane.link ? groups[pane.link] : null;
    if (name && symKey(name) !== symKey(pane.ticker)) setPaneState(p => ({ ...p, ticker: name }));
  }, [groups, pane.link, pane.ticker]);
  return (
    <div className="h-full min-h-0 grid grid-cols-1 grid-rows-1" data-terrain-solo>
      <Pane
        cfg={pane}
        onCfg={onCfg}
        revision={revision}
        expanded={false}
        onToggleExpand={() => undefined}
        index={0}
        tall
        onCrosshair={() => undefined}
        registerSync={() => undefined}
        replay={replay}
        onToggleReplay={() => setReplay(v => !v)}
        onExitReplay={() => setReplay(false)}
        drawing={drawing}
        onToggleDrawing={() => setDrawing(v => !v)}
        onExitDraw={() => setDrawing(false)}
        isActive
        onActivate={() => undefined}
        paneCount={1}
        palette={palette}
        railCut={railCut}
        onRailCut={setRailCut}
        menuOpen={menu}
        onMenu={setMenu}
        bare
      />
    </div>
  );
};

export default Terrain;
