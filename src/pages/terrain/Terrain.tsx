import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Code2, Link2, Maximize2, Minimize2, Rows3, X } from 'lucide-react';
import { DOCK_ROOM, openEditor } from '../../data/editorDock';
import Simulator from '../../core/simulator';
import { useMarketData } from '../../context/MarketDataContext';
import DistanceUnitPicker from '../../components/ui/DistanceUnitPicker';
import { futuresPhaseAt, FUTURES_PHASE_WORDS } from '../../core/calendar';
import {
  deleteNamedLayout, loadNamedLayouts, persistNamedLayouts, saveNamedLayout,
  MAX_NAMED_LAYOUTS, type NamedLayoutEntry,
} from './layouts';
import { buildLadderFor, buildLevelsFor, buildPrints, fmtUsd, spotChangePct } from '../../data/gex';
import StrikeChart, {
  PRICE_SCALE_MIN_WIDTH,
  DEFAULT_INDICATORS,
  DEFAULT_OVERLAYS,
  type ChartIndicators,
  type ChartOverlays,
  type ChartStyle,
  priceScaleLockedBy,
  PRICE_SCALES,
  type CrosshairBar,
  type CompareEntry,
  type CompareMode,
  type CrosshairSync,
  type PriceProjection,
  type PriceScale,
} from '../../components/gex/StrikeChart';
import ChartToolbar from '../../components/gex/ChartToolbar';
import { useFadeClose } from '../../components/ui/useFadeClose';
import CompareControl from '../../components/gex/CompareControl';
import ProfilePanel, { PROFILE_MIN_W, type ProfileLane } from '../../components/gex/ProfilePanel';
import ProfileGuide from '../../components/gex/ProfileGuide';
import GuideFocus from '../../components/ui/GuideFocus';
import { buildFlowFromRows } from '../../data/hedgeFlow';
import useFocusTrap from '../../components/ui/useFocusTrap';
import { useIsBelowLg, useIsPhone } from '../../components/ui/useMediaQuery';
import ScopeChip from '../../components/ui/ScopeChip';
import { ChartSkeleton, Deferred } from '../../components/ui/Skeleton';
import SpotPrice from '../../components/gex/SpotPrice';
import {
  CANDLE_THEMES,
  chartSurface,
  getCandleThemeKey,
  useCandleThemeKey,
  type CandleThemeKey,
} from '../../components/gex/candleTheme';
import { TIMEFRAMES, type Timeframe } from '../../data/timeframe';
import { TREND_GLYPH, buildConfluence, trendWords, type ConfluenceRow } from '../../data/confluence';
import { OPENING_RANGES, type OpeningRange } from '../../data/sessionLevels';
import { isBarClock } from '../../data/altBars';
import {
  SETUP_KEYS, applySetup, captureSetup, evict, readSetups, symKey, type SetupMap,
} from './setups';
import { flipRing, stepSymbol, stepTf } from './paneKeys';

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
  /** T-20 — the pane's link group. Panes sharing a letter follow each
      other's SYMBOL changes; null stands alone. Not a setup key: linking is
      slot business, like the rail. */
  link?: 'A' | 'B' | null;
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
      through the port — the partner tree paints every pane from one store. */
  theme: CandleThemeKey;
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
}

const TF_VALUES = new Set<string>(TIMEFRAMES.map(t => t.value));
const COMPARE_MODES = new Set<CompareMode>(['percent', 'scale', 'pane']);
/* The desk's comparison inks (LiveChartWidget's set, verbatim): none of them
   collide with the field's gold/steel, the levels' magenta/green/red/blue, or
   the interface's lime. Four, so a pane can cross four symbols at most. */
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
    theme: getCandleThemeKey(),
    link: null,
  }));

/* The map starts EMPTY on a fresh install, deliberately. Seeding it from the
   four watchlist rows would mean a reader who sets a pane to 1h and then picks
   SPY gets yanked back to 15m by a setup they never chose — precisely the
   surprise the earned-by-touch rule exists to prevent. */
const defaults = (): TerrainCfg => ({ layout: 3, panes: defaultPanes(), setups: {} });

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
    link: c.link === 'A' || c.link === 'B' ? c.link : null,
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

    if (Array.isArray(c.panes)) {
      const stored = c.panes as unknown[];
      const panes = def.panes.map((d, i) => readPane(stored[i], { ...d, ladder: deskLadder ?? d.ladder }));
      const hadSetups = !!c.setups && typeof c.setups === 'object';
      return { layout, panes, setups: hadSetups ? readSetups(c.setups) : seedFrom(panes) };
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
    return { layout, panes, setups: seedFrom(panes) };
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
const PRICE_GUTTER_PX = PRICE_SCALE_MIN_WIDTH + 2;

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
const ID_ROW_FULL_PX = 366;
const ID_ROW_NO_PCT_PX = 311;
const ID_ROW_NO_BADGE_PX = 286;

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
const HEAVY_LABEL_PX = 60; // the word plus its gap
const HEAVY_ENTRY_PX = 96; // the widest entry plus its gap
const HEAVY_MAX = 3;

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
const MTF_FULL_PX = 148;
const MTF_TIGHT_PX = 69;

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
const heaviest = (rows: { strike: number; value: number }[], n: number) =>
  [...rows].sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, n);

/* Share count, not dollars — `fmtUsd` would print a $ in front of a volume.
   Same K/M/B ladder so the two reads scan alike. */
const fmtVol = (v: number): string => {
  const a = Math.abs(v);
  if (a >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toFixed(0);
};

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
const ConfluenceStrip = ({ rows, form }: { rows: ConfluenceRow[]; form: 'full' | 'tight' }) => {
  const words = rows.map(trendWords).join(' · ');
  return (
    <span
      className="shrink-0 inline-flex items-center gap-1.5"
      title={words}
      role="img"
      aria-label={`Timeframe trend — ${words}`}
    >
      {rows.map(r => (
        <span key={r.tf} className="inline-flex items-baseline gap-0.5">
          {form === 'full' && <span className="font-mono text-[9px] text-textMuted">{r.tf}</span>}
          <span
            aria-hidden
            className={`font-mono text-[9px] leading-none ${
              r.state === 'up' ? 'text-bull' : r.state === 'down' ? 'text-bear' : 'text-textMuted'
            }`}
          >
            {/* A timeframe with too little history gets a dash, never a bar —
                "no view" and "flat" are different claims (data/confluence.ts). */}
            {r.state === null ? '–' : TREND_GLYPH[r.state]}
          </span>
        </span>
      ))}
    </span>
  );
};

/* One labelled figure in the readout row. The key is quiet and the value is
   not, so a row of six reads as values with keys rather than the other way
   round. `ink` carries an indicator's own line colour, so the number and the
   line it came from are the same colour a few pixels apart. */
const ReadoutCell = ({ k, v, ink }: { k: string; v: string; ink?: string }) => (
  <span className="shrink-0 whitespace-nowrap">
    <span className="font-mono text-[9px] uppercase tracking-wider text-textMuted">{k}</span>
    <span className="ml-1 font-mono text-[10px] tnum" style={ink ? { color: ink } : undefined}>
      {v}
    </span>
  </span>
);

interface PaneProps {
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
}

const Pane = ({
  cfg, onCfg, revision, expanded, onToggleExpand, index, tall,
  onCrosshair, registerSync, replay, onToggleReplay, onExitReplay,
  drawing, onToggleDrawing, onExitDraw,
  isActive, onActivate, paneCount, closing = false, menuOpen, onMenu,
  boxRef, cell = '',
}: PaneProps) => {
  const { ticker, timeframe, overlays, indicators, chartStyle, clock, compares, priceScale, sessionOr, ladder, theme } = cfg;
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
  const roomFor = (px: number) => stripInner === 0 || stripInner >= px;
  const showChangePct = roomFor(ID_ROW_FULL_PX);
  /* Gated on the row affording everything else FIRST — see MTF_*_PX. */
  const mtfForm: 'full' | 'tight' | 'none' = roomFor(ID_ROW_FULL_PX + MTF_FULL_PX)
    ? 'full'
    : roomFor(ID_ROW_FULL_PX + MTF_TIGHT_PX)
      ? 'tight'
      : 'none';
  const showBadge = paneCount > 1 && roomFor(ID_ROW_NO_PCT_PX);
  const showCompareAdd = roomFor(ID_ROW_NO_BADGE_PX);
  /* At least one entry: a HEAVIEST label with nothing after it is chrome that
     says nothing, so the row hides itself entirely rather than print a header
     over an empty line (see `heavy.length > 0` at the row). */
  const heavyCount = stripInner === 0
    ? HEAVY_MAX
    : Math.max(1, Math.min(HEAVY_MAX, Math.floor((stripInner - HEAVY_LABEL_PX) / HEAVY_ENTRY_PX)));
  /* The tape, straight from the provider that accumulates it. Read HERE rather
     than threaded down from Terrain: this component already takes fourteen
     props, and every pane wants the same unfiltered tape — StrikeChart narrows
     it to its own symbol. */
  const { flowTape } = useMarketData();

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
  const levels = useMemo(
    () => buildLevelsFor(ticker),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ticker, revision]
  );
  const changePct = useMemo(
    () => spotChangePct(ticker),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ticker, revision]
  );
  // Deterministic per ticker, so the dark-pool lines do not wander on a tick
  const prints = useMemo(
    () => buildPrints(ticker, levels.spot),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ticker]
  );
  /* The rail's rows come off the SAME snapshot `levels` was reduced from. The
     header's three-strike read uses them too, so the line and the column can
     never name different strikes. Read even when the rail is hidden, because
     the header is not. */
  const rail = useMemo(
    () => buildLadderFor(ticker),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ticker, revision]
  );
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
    () => (mtfForm === 'none' ? [] : buildConfluence(Simulator.getCandles(ticker) ?? [])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ticker, revision, mtfForm === 'none']
  );
  /* The header's heaviest read comes off the NEAR-SPOT core, not the widened
     set the rail draws. `rows` now reaches the whole maintained book so the
     column can fill the price scale; pointing the header at it would have it
     naming strikes $30 away from the market. */
  const heavy = useMemo(() => heaviest(rail.core, heavyCount), [rail, heavyCount]);

  /* What the reader clicked in the rail, flashed on the chart. Clicking the
     same strike again clears it, so the rail is a toggle rather than a thing
     you can only turn on. It resets on a symbol change because a price from
     the last book means nothing against this one. */
  /* Where the chart puts a price, handed to the rail so the two columns cannot
     disagree. A ref, so it never re-renders anything: the rail reads it inside
     its own frame loop. */
  const projectionRef = useRef<PriceProjection | null>(null);
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

  /* What a move to each strike forces dealers to trade — the panel's second
     lane, off the SAME rows the size lane draws, so the flow beside a capsule
     is the flow of that capsule's book. */
  const flow = useMemo(() => (rail.rows.length ? buildFlowFromRows(rail.rows, levels.spot) : null), [rail, levels.spot]);
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


  /* One surface under the header AND the tape, so a pane is one continuous
     black inside its frame rather than two shades meeting at a seam. */
  const themeKey = useCandleThemeKey();
  const themeBg = chartSurface(CANDLE_THEMES[themeKey]).bg;
  const surface = themeBg === 'transparent' ? 'rgb(var(--panel))' : themeBg;
  /* The strip's 55% wash of that surface — the token cannot take a hex alpha suffix */
  const strip = themeBg === 'transparent' ? 'rgb(var(--panel) / 0.55)' : `${themeBg}8C`;

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
          className={`shrink-0 w-4 h-4 rounded-[3px] font-mono text-[9px] font-bold tnum inline-flex items-center justify-center ${
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
      {replay && (
        <span
          title="This pane is replaying history — it is not live"
          className="shrink-0 inline-flex items-center gap-1 px-1.5 h-4 rounded-[3px] bg-silverFill text-[#0a0a0a] font-mono text-[9px] font-bold uppercase tracking-wider"
        >
          Replay
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
        {/* T-20's link chip: ∅ → A → B → ∅. Letters, not colours — the
            palette's inks all mean something already. */}
        {(cfg.link !== null && cfg.link !== undefined || showCompareAdd || expanded) && <button
          onClick={() => onCfg({ link: cfg.link === 'A' ? 'B' : cfg.link === 'B' ? null : 'A' })}
          aria-label={cfg.link ? `Link group ${cfg.link} — linked panes follow this pane's symbol` : 'Link this pane — panes sharing a letter follow each other\'s symbol'}
          title={cfg.link ? `Link group ${cfg.link} — panes sharing ${cfg.link} follow each other's symbol` : 'Link this pane to others — shared letters change symbols together'}
          className={`shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-[3px] font-mono text-[9px] font-bold transition-colors ${
            cfg.link ? 'bg-ink/[0.14] text-textPrimary' : 'text-textMuted hover:text-textPrimary hover:bg-ink/[0.06]'
          }`}
        >
          {cfg.link ?? <Link2 className="w-3 h-3" />}
        </button>}
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

  const paneToolbar = (spread: boolean) => (
    <ChartToolbar
      minimal
      candles
      compact={toolbarCompact}
      spread={spread}
      alertTicker={ticker}
      alertSpot={levels.spot}
      timeframe={timeframe}
      onTimeframe={tf => onCfg({ timeframe: tf })}
      overlays={overlays}
      onOverlays={o => onCfg({ overlays: o })}
      /* Everything EXCEPT the strike band: that band docks under the Pulse
         chart only (no Terrain surface mounts it — his tree included), and a
         switch that cannot turn anything on is a lie in a menu. Inherited
         dead toggle, caught 2026-08-28. */
      overlayKeys={['trails', 'levels', 'darkpool', 'volume', 'flow', 'netDrift', 'volDrift', 'session', 'cone', 'events', 'alerts']}
      indicators={indicators}
      onIndicators={i => onCfg({ indicators: i })}
      paneId={`terrain:${index + 1}`}
      fullscreen={expanded}
      chartStyle={chartStyle}
      onChartStyle={st => onCfg({ chartStyle: st })}
      themeKey={theme}
      onThemeKey={t => onCfg({ theme: t })}
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
        ref={boxRef}
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
            <Deferred index={index} fallback={<ChartSkeleton className="h-full" />} className="h-full animate-fade-in">
            <StrikeChart
              ticker={ticker}
              paneId={`terrain:${index + 1}`}
              revision={revision}
              levels={levels}
              timeframe={timeframe}
              flowPrints={flowTape}
              height={tall ? 260 : 200}
              overlays={overlays}
              indicators={indicators}
              chartStyle={chartStyle}
              themeKey={theme}
              barClock={clock}
              prints={prints}
              compares={compares}
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
              replay={replay}
              onExitReplay={onExitReplay}
              focusPrice={focus}
              priceTag
              onCrosshair={onCrosshair}
              syncRegister={registerSync}
              onReadout={setReadout}
              projectionRef={projectionRef}
              exportRef={exportPngRef}
              pageScroll={belowLg}
              frameless
            />
            </Deferred>

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
            {!expanded && (
              /* ── THE EXPAND BUTTON, FAR RIGHT (Noah, 2026-08-28: "push the
                 fullscreen button ... to the far right on both small chart
                 view and full chart view") — its own chip pinned to the
                 pane's top-right corner, clear of the price ticks, out of
                 the identity row it used to ride at the end of. Same
                 rest-dim as the rest of the chrome, always tappable, and
                 `chrome-hover` keeps it visible on a screen with no hover
                 to give. */
              <div
                className="chrome-hover absolute top-1.5 z-30 pointer-events-auto select-none rounded-md bg-canvas/25 backdrop-blur-[3px] p-0.5 opacity-55 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100"
                style={{ right: PRICE_GUTTER_PX + 6 }}
              >
                <button
                  onClick={onToggleExpand}
                  aria-pressed={expanded}
                  aria-label={`Expand ${ticker} to the full screen`}
                  title="Expand this pane — F"
                  className="inline-flex items-center justify-center w-6 h-6 rounded text-textMuted hover:text-textPrimary hover:bg-ink/[0.05] transition-colors"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>
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
              >
                {/* The symbol leads, Pulse-style — then a hairline, then
                    everything else spread to the far edge. */}
                <span className="shrink-0 flex items-center gap-2 pointer-events-auto">{identityControls}</span>
                {mtfForm !== 'none' && confluence.length > 0 && (
                  <span className="shrink-0 hidden xl:inline-flex pointer-events-auto">
                    <ConfluenceStrip rows={confluence} form={mtfForm} />
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
                   controls; the controls all moved up into the strip. */
                <div className="pointer-events-none select-none flex items-baseline gap-1.5 font-mono">
                  <span className="text-[11px] font-semibold text-textPrimary">{ticker}</span>
                  <span className="text-[10px] text-textMuted" aria-hidden>·</span>
                  <span className="text-[10px] text-textMuted">{timeframe}</span>
                  <span className="text-[10px] text-textMuted" aria-hidden>·</span>
                  <SpotPrice value={levels.spot} className="font-mono text-[11px] font-semibold tnum text-textPrimary" />
                  <span className={`text-[10px] font-semibold tnum ${up ? 'text-bull' : 'text-bear'}`}>
                    {up ? '+' : ''}
                    {changePct.toFixed(2)}%
                  </span>
                </div>
              ) : (
              <div className="chrome-hover relative z-30 pointer-events-auto w-fit max-w-full select-none flex items-center gap-2 rounded-md bg-canvas/25 backdrop-blur-[3px] px-2 py-1 opacity-55 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
                {/* This strip is the one row visible at rest, so the number
                    is legible without a pointer ever touching the desk. */}
                {showBadge && (
                  <span
                    aria-hidden
                    className={`shrink-0 w-4 h-4 rounded-[3px] font-mono text-[9px] font-bold tnum inline-flex items-center justify-center ${
                      isActive ? 'holo-bg text-[#0a0a0a]' : 'bg-ink/[0.08] text-textPrimary'
                    }`}
                  >
                    {index + 1}
                  </span>
                )}
                {/*
                  THE REPLAY BADGE — T-13, and it is the reason the rest of
                  this is safe to ship.

                  A pane in replay looks exactly like a live one: the same
                  candles, the same rail, the same symbol. The transport is at
                  the BOTTOM of the pane and a reader glancing at the top of a
                  four-pane desk cannot see it. A historical chart mistaken for
                  a live one is the worst thing this desk could show.

                  So it sits in the identity row, beside the symbol, and it is
                  NOT shed at any width: everything else in this row can go,
                  because everything else is a convenience. This one says which
                  world you are looking at.
                */}
                {replay && (
                  <span
                    title="This pane is replaying history — it is not live"
                    className="shrink-0 inline-flex items-center gap-1 px-1.5 h-4 rounded-[3px] bg-silverFill text-[#0a0a0a] font-mono text-[9px] font-bold uppercase tracking-wider"
                  >
                    Replay
                  </span>
                )}
                <span className="shrink-0 inline-flex items-center gap-1.5">
                  <ScopeChip
                    ticker={ticker}
                    onPick={t => onCfg({ ticker: t })}
                    open={menuOpen === 'symbol'}
                    onOpenChange={o => onMenu(o ? 'symbol' : null)}
                    /* The ring ↑/↓ walks is invisible, so the one control it
                       moves is where it gets named. */
                    title="Switch ticker — S · ↑ ↓ step your symbols"
                  />
                  {/* T-20's link chip: ∅ → A → B → ∅. Letters, not colours —
                      the palette's inks all mean something already, and a
                      letter reads at 9px where a fourth colour would need a
                      legend. Unlinked it is a convenience and sheds with the
                      compare tier; LINKED it is state and stays at every
                      width (ID_ROW_* above). */}
                  {(cfg.link !== null && cfg.link !== undefined || showCompareAdd) && <button
                    onClick={() => onCfg({ link: cfg.link === 'A' ? 'B' : cfg.link === 'B' ? null : 'A' })}
                    aria-label={cfg.link ? `Link group ${cfg.link} — linked panes follow this pane's symbol` : 'Link this pane — panes sharing a letter follow each other\'s symbol'}
                    title={cfg.link ? `Link group ${cfg.link} — panes sharing ${cfg.link} follow each other's symbol` : 'Link this pane to others — shared letters change symbols together'}
                    className={`shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-[3px] font-mono text-[9px] font-bold transition-colors ${
                      cfg.link ? 'bg-ink/[0.14] text-textPrimary' : 'text-textMuted hover:text-textPrimary hover:bg-ink/[0.06]'
                    }`}
                  >
                    {cfg.link ?? <Link2 className="w-3 h-3" />}
                  </button>}
                  {/* TradingView's "+" beside the symbol capsule — cross
                      another symbol onto this tape. Per pane, like the rest.

                      Last thing the row gives up (ID_ROW_NO_BADGE_PX): it is a
                      control, and a control is worth more than a label. What
                      it opens is still reachable — an existing comparison has
                      its own x in the legend below — and it returns as soon as
                      the column can hold it. */}
                  {showCompareAdd && (
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
                <span className="shrink-0">
                  <SpotPrice value={levels.spot} />
                </span>
                {/* First thing the row gives up when the column is narrow
                    (ID_ROW_FULL_PX) — the price it is a delta of is directly
                    to its left, and the chart draws the same move. */}
                {showChangePct && (
                  <span className={`shrink-0 font-mono text-[11px] font-semibold tnum ${up ? 'text-bull' : 'text-bear'}`}>
                    {up ? '+' : ''}
                    {changePct.toFixed(2)}%
                  </span>
                )}
                {/* Do the timeframes agree — T-12. At rest, not on hover: the
                    whole value of it is the glance. */}
                {mtfForm !== 'none' && confluence.length > 0 && (
                  <ConfluenceStrip rows={confluence} form={mtfForm} />
                )}

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
              {readout ? (
                <div className="chrome-hover relative z-10 pointer-events-none hidden sm:block w-fit max-w-full rounded-md bg-canvas/25 backdrop-blur-[3px] px-2 py-1">
                  <span className="flex items-center gap-2.5 whitespace-nowrap">
                    {showReadoutOhl && (
                      <>
                        <ReadoutCell k="O" v={readout.open!.toFixed(2)} />
                        <ReadoutCell k="H" v={readout.high!.toFixed(2)} />
                        <ReadoutCell k="L" v={readout.low!.toFixed(2)} />
                      </>
                    )}
                    {/* The one part that never goes. */}
                    <ReadoutCell k="C" v={readout.close.toFixed(2)} />
                    {showReadoutVol && <ReadoutCell k="V" v={fmtVol(readout.volume!)} />}
                    {showReadoutInds &&
                      readout.indicators.map(ind => (
                        <ReadoutCell key={ind.key} k={ind.key} v={ind.value.toFixed(2)} ink={ind.ink} />
                      ))}
                  </span>
                </div>
              ) : (
              heavy.length > 0 && (
                <div className="chrome-hover relative z-10 pointer-events-none hidden sm:block w-fit max-w-full rounded-md bg-canvas/25 backdrop-blur-[3px] px-2 py-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
                  <span className="flex items-center gap-2.5 whitespace-nowrap">
                    <span className="shrink-0 font-mono text-[9px] uppercase tracking-widest text-textMuted">Heaviest</span>
                    {heavy.map(row => (
                      <span key={row.strike} className="shrink-0 font-mono text-[10px] tnum whitespace-nowrap">
                        <span className="text-textSecondary">
                          {row.strike % 1 === 0 ? row.strike.toFixed(0) : row.strike.toFixed(2)}
                        </span>
                        <span className={`ml-1.5 font-semibold ${row.value >= 0 ? 'text-[#F5C542]' : 'text-[#AAB6C6]'}`}>
                          {fmtUsd(row.value)}
                        </span>
                      </span>
                    ))}
                  </span>
                </div>
              )
              )}

              {/* Its own, every one of them — and not there until you
                  reach. DOCKED ONLY: the expanded pane pins the same toolbar
                  to the top strip instead, where it does not need a hover to
                  exist. */}
              {!expanded && (
                <div className="chrome-hover chrome-tap relative z-10 pointer-events-none max-w-full rounded-md bg-canvas/25 backdrop-blur-[3px] px-2 py-1 opacity-0 transition-opacity duration-200 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
                  {paneToolbar(false)}
                </div>
              )}
            </div>

            {/* ── the crossed symbols, under the floating header ───────────
                One quiet row each: its line's own ink, its live price, and the
                only hand-removal outside the + menu. pointer-events are off on
                the stack and back on for the buttons, so the legend never eats
                a drag on the chart. */}
            {compares.length > 0 && (
              <div
                /* Unconditional, unlike the strip above: the legend rows are
                   ~106px, so even at a 369px column they clear both gutters. */
                style={{ top: stripH + 4 + (expanded ? 44 : 0), left: ownScale ? PRICE_GUTTER_PX : undefined }}
                className="pointer-events-none absolute left-3 z-10 flex flex-col gap-0.5 opacity-70 transition-opacity duration-200 group-hover:opacity-100"
                data-chart-chrome
              >
                {compares.map(c => (
                  <span key={`${c.ticker}:${c.mode}`} className="flex items-center gap-1.5">
                    <span className="w-2 h-[3px] rounded-full" style={{ background: c.ink }} aria-hidden />
                    <span className="font-mono text-[10px] font-semibold" style={{ color: c.ink }}>
                      {c.ticker}
                    </span>
                    {Simulator.TICKERS[c.ticker] && (
                      <SpotPrice
                        value={Simulator.TICKERS[c.ticker].currentPrice}
                        className="font-mono text-[10px] tnum text-textSecondary"
                      />
                    )}
                    <button
                      onClick={() => removeCompare(c.ticker, c.mode)}
                      aria-label={`Remove the ${c.ticker} comparison`}
                      title="Remove comparison"
                      className="pointer-events-auto inline-flex items-center justify-center w-4 h-4 rounded text-textMuted hover:text-textPrimary hover:bg-ink/[0.08] transition-colors"
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
          {ladder && rail.rows.length > 0 && (
            <ProfilePanel
              width={cfg.ladderW ?? PROFILE_MIN_W}
              onWidth={w => onCfg({ ladderW: w })}
              ticker={ticker}
              rows={rail.rows}
              maxAbs={rail.maxAbs}
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
              className="hidden lg:block"
            />
          )}
        </div>
        {/* THE GUIDE IN FOCUS — over the whole pane, the pane blurred behind it */}
        {ladder && (
          <GuideFocus open={guideOpen} onClose={() => setGuideOpen(false)} title="How to read this panel" testId="profile-guide">
            <ProfileGuide rows={rail.rows} levels={levels} flow={flow} />
          </GuideFocus>
        )}
      </div>
    </div>
  );
};

/** Terrain — the charts-only desk. */
const Terrain = () => {
  const { marketData } = useMarketData();
  const revRef = useRef(0);
  const revision = useMemo(() => ++revRef.current, [marketData]);

  const [cfg, setCfg] = useState<TerrainCfg>(() => {
    const c = loadCfg();
    /* The candles' one-time flip to the baby-blue tape (2026-08-29, "yes it
       should be baby blue"; supersedes the same-day foil flip) — pane themes
       are stored EXPLICITLY, so the store-level migration alone would leave
       every existing pane wearing its old metal. Same flag discipline: once. */
    try {
      if (!localStorage.getItem('slayer_terrain_sky1')) {
        localStorage.setItem('slayer_terrain_sky1', '1');
        return { ...c, panes: c.panes.map(p => ({ ...p, theme: 'glacier' as const })) };
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
  const setPane = (i: number, patch: Partial<PaneCfg>) =>
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
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.isComposing || e.repeat) return;
      if (editable(e.target) || editable(document.activeElement)) return;
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
        case 'ArrowUp': case 'ArrowDown': {
          if (!deskOwnsViewportRef.current && expandedRef.current === null) return;
          if (menuOpenRef.current) return;
          const q = cur.panes[i];
          if (!q) return;
          e.preventDefault();
          const ring = flipRing(Simulator.WATCHLIST, Object.keys(cur.setups));
          const next = stepSymbol(ring, q.ticker, e.key === 'ArrowDown' ? 1 : -1);
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
      className={`relative -mx-4 lg:-mx-6 2xl:-mx-8 px-1.5 flex flex-col ${
        isPhone
          ? '-mt-5 -mb-16 py-1.5 h-[calc(100dvh-3.5rem)] min-h-0'
          : 'lg:-mt-5 lg:-mb-16 lg:py-1.5 lg:h-[calc(100vh-3.5rem)] lg:min-h-0'
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
        style={{
          right:
            ((expanded !== null ? panes[expanded] : panes[panes.length - 1])?.ladder && !belowLg
              ? (expanded !== null ? panes[expanded] : panes[panes.length - 1])?.ladderW ?? PROFILE_MIN_W
              : 0) +
            PRICE_GUTTER_PX +
            8,
          bottom: TIME_AXIS_PX + 12,
        }}
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
        className={`chrome-hover pointer-events-none flex items-center gap-2 opacity-40 transition-opacity duration-200 hover:opacity-100 focus-within:opacity-100 ${
          expanded !== null ? 'fixed z-[90]' : 'absolute z-30'
        }`}
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
                className={`px-2.5 py-1 rounded font-mono text-[11px] font-semibold tnum transition-colors ${
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
          className={`pointer-events-auto inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-ink/[0.08] backdrop-blur-[3px] font-mono text-[10px] uppercase tracking-wider transition-colors ${
            anyLadder ? 'bg-ink/[0.16] text-textPrimary' : 'bg-canvas/40 text-textSecondary hover:text-textPrimary'
          }`}
        >
          Strikes
        </button>
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
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-ink/[0.08] backdrop-blur-[3px] font-mono text-[10px] uppercase tracking-wider transition-colors ${
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
                <div className="font-mono text-[9px] uppercase tracking-widest text-textMuted px-1 pb-1.5">
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
                        <span className="ml-1.5 text-[9px] text-textMuted tnum">
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
                  <div className="px-1.5 py-1 font-mono text-[10px] text-textMuted">Nothing saved yet — name this desk below.</div>
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
                    className="shrink-0 px-2 py-1 rounded font-mono text-[10px] uppercase tracking-wider text-select hover:bg-select/10 transition-colors"
                  >
                    Save
                  </button>
                </div>
                {layoutNote && <div className="px-1.5 pt-1 font-mono text-[9px] text-textMuted">{layoutNote}</div>}
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
            className="pointer-events-auto inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-ink/[0.08] bg-canvas/40 backdrop-blur-[3px] font-mono text-[10px] uppercase tracking-wider text-textSecondary hover:text-textPrimary transition-colors"
            data-terrain-pine
          >
            <Code2 className="w-3 h-3" /> Pine
          </button>
        )}

        {/* T-16's first piece: WHERE IN THE GLOBEX WEEK the wall clock sits.
            The session shading down the pane waits on the futures tape (MKT
            Futures — there are no overnight bars to shade yet); the chip is
            the real fact available today, re-read on every tick's render. */}
        {(() => {
          const words = FUTURES_PHASE_WORDS[futuresPhaseAt(new Date())];
          return (
            <span
              title={`${words.blurb}. Session shading over the tape arrives with the futures feed.`}
              className={`pointer-events-auto inline-flex items-center px-2 py-1.5 rounded-md border border-ink/[0.08] bg-canvas/40 backdrop-blur-[3px] font-mono text-[10px] uppercase tracking-wider ${
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
            className="pointer-events-auto inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-borderSubtle bg-canvas/70 backdrop-blur-[2px] font-mono text-[10px] uppercase tracking-wider text-textSecondary hover:text-textPrimary"
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
            menuOpen={menu?.pane === i ? menu.which : null}
            onMenu={which => setMenu(which ? { pane: i, which } : null)}
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

export default Terrain;
