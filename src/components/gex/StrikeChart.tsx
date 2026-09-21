import {
  useCallback, useEffect, useMemo, useRef, useReducer, useState,
  useSyncExternalStore,
  type MutableRefObject, type PointerEvent as ReactPointerEvent, useLayoutEffect,
} from 'react';
import {
  AlignJustify, ArrowUpRight, Check, Circle, Equal, Eraser, Minus, MousePointer2, MoveDiagonal,
  MoveVertical, Ruler, Spline, Square, StickyNote, Trash2, TrendingUp,
} from 'lucide-react';
import {
  createChart,
  AreaSeries,
  BarSeries,
  BaselineSeries,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  LineStyle,
  LineType,
  PriceScaleMode,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type SeriesType,
  type UTCTimestamp,
  type MouseEventParams,
  type Time,
} from 'lightweight-charts';
import Simulator from '../../core/simulator';
import { onGlide, promisedWidth } from '../../core/glide';
import { compile, explain, run as runScript, type Compiled } from '../../core/pine';
import { setPaneBars, usePaneScripts } from '../../data/paneScripts';
import { drawRun, type ScriptHandle } from './scriptLayer';
import ScriptLegend from './ScriptLegend';
import ResetViewControl from './ResetViewControl';
import { LOCAL_TIME, localTickMarks } from './chartTime';
import {
  aggregateCandles,
  aggregateSnapshots,
  foldSnapshotsSlice,
  isFolded,
  snapshotsMaxAbs,
  tfMinutes,
  INTRADAY_MAX_MINUTES,
  type Timeframe,
} from '../../data/timeframe';
import { GexTrailsPrimitive } from './gexNodesPrimitive';
import ReplayStrip from './ReplayStrip';
import { commitArm, evaluateAlert, markFired, useAlerts, type AlertContext, type IndicatorSource } from './alertStore';
import { newsPulse } from '../../data/news';
import { exposureNowFor } from '../../data/gex';
import { ChevronsLeft, ChevronsUp, GripVertical, Lock, PanelLeft, PanelTop, Pencil, Type, Unlock } from 'lucide-react';
import { DrawingsPrimitive, loadDrawings, needsThirdAnchor, saveDrawings, type Drawing, type DrawingKind } from './drawingsPrimitive';
import {
  getCandleTheme,
  useCandleThemeKey,
  candleSeriesOptions,
  chartSurface,
  type CandleTheme,
  type CandleThemeKey,
} from './candleTheme';
import { useResolvedTheme } from '../../theme/theme';
import { barClockSpec, buildAltBars, type AltBarSpec } from '../../data/altBars';
import type { Candle } from '../../types/market';
import type { DarkPoolPrint, KeyLevels } from '../../types/gex';
import { bucketFlow, flowMaxLeg } from '../../data/flowBars';
import { atrBarSeries, bollingerSeries, emaSeries, macdSeries, rsiSeries, sessionStarts, smaSeries, vwapSeries, vwapSigmaSeries } from '../../data/indicators';
import { buildSessionLevels, type OpeningRange } from '../../data/sessionLevels';
import { SessionLevelsPrimitive, sessionLines } from './sessionLevelsPrimitive';
import { buildExpectedMoveCone } from '../../data/expectedMove';
import { buildTapeEvents, macroWindow, type MarketEvent, type MacroDate } from '../../data/events';
import { impliedDaySigma, sessionAtr } from '../../data/atr';
import { buildEarningsCalendar, type EarningsEvent } from '../../data/earnings';
import { EventsPrimitive } from './eventsPrimitive';
import { ExpectedMovePrimitive } from './expectedMovePrimitive';
import { RTH_MINUTES } from '../../core/calendar';
import { cumulativeDrift, driftPeak } from '../../data/driftSeries';
import { impliedVolLine, realizedVol, volCeiling } from '../../data/volDrift';
import type { FlowPrint } from '../../types/trace';

/* The shape this chart needs off a print: whatever FlowPrint is, plus the
   instant it arrived. Declared here rather than imported from the provider so a
   chart never depends on a React context it does not use. */
type StampedFlowPrint = FlowPrint & { at: number };

/*
  The band's share of the chart, as a STRETCH FACTOR against the price pane's.

  `setHeight(90)` was the first attempt and it does not hold: measured, the pane
  came back at 201px on a 900px window — lightweight-charts lays panes out by
  stretch and redistributes an explicit height away. A constant that names a
  pixel count it does not produce is worse than no constant, so this says what
  the library actually honours. 4:1 gives the tape four fifths, which is the
  reference's proportion, and a reader can still drag the separator.

  3 and not 4, and the reason is a coupling worth naming: the compare effect
  normalises EVERY pane whenever more than one exists — `panes[0]` to 3, all the
  rest to 1 — so whatever is set here is re-applied as 3:1 the next time
  comparisons rebuild. Asking for 4:1 measured 3:1 anyway. Matching it means the
  two places agree instead of silently fighting over the layout.
*/
const FLOW_STRETCH = 1;
const PRICE_STRETCH = 3;

/*
  A comparison in PANE mode goes BELOW the flow band when there is one.

  It was hard-coded to index 1. The flow band is built on demand, so 1 is
  sometimes the flow band and sometimes free — a compare line dropped into the
  flow pane would share its scale (pinned to +/- the heaviest premium leg) and
  render as a flat line on the zero rule while squashing the bars it landed on.
  Asking the flow series where it actually is beats assuming.
*/

/*
  THE FLOW LEGS DO NOT TAKE THE CANDLE THEME'S VOLUME INK, and that was the
  first thing I tried.

  Volume is ONE quantity, so it can be monochrome and still be readable — and
  in several themes it is: the Chrome theme paints volUp `rgba(238,241,245,.22)`
  and volDown `rgba(86,92,104,.30)`, two greys. Driven live with the legs on
  those, the flow band rendered with ZERO green and ZERO red pixels: calls and
  puts became the same colour, which is the one thing a two-sided histogram
  cannot survive. The whole point of drawing both legs is telling them apart.

  So the legs wear the house DIRECTION inks, always. That is the right register
  as well as the readable one: call premium arriving is bullish and put premium
  arriving is bearish, which is direction, not dealer side — gold and steel
  would be the wrong vocabulary here.
*/
const FLOW_CALL_INK = BULL;
const FLOW_PUT_INK = PUT_WALL;

/*
  THE DRIFT LINES WEAR THE SAME TWO INKS AS THE FLOW LEGS, and they should:
  they are the same two quantities. The band draws call and put premium per
  bar; the drift lines draw the running totals of exactly those bars. Giving
  the totals their own colours would ask a reader to learn a second vocabulary
  for a number they already know.
*/
const DRIFT_CALL_INK = BULL;
const DRIFT_PUT_INK = PUT_WALL;

/*
  THE TWO VOLATILITY LINES ADD NO NEW HUE.

  Both values already exist in this file as INDICATOR_INKS — the pale violet
  the ema21 wears and the warm cream the ema50 wears — and that is the correct
  register rather than a convenient one: realised vol is a line COMPUTED from
  the bars, which is what every ink in that set marks. The reference happens to
  draw the same pair as saturated purple and yellow; these are the house's
  muted version of the same two positions.

  Written out rather than read from INDICATOR_INKS on purpose. Reaching into
  that map would couple the vol pane to the EMA palette, so recolouring an
  indicator would silently recolour a different pane in a different unit.
*/
const RV_INK = '#BBB2E8';
const IV_INK = '#EDE4CD';

/** Height of a pane's name chip, and its inset from the pane's top edge. */
const PANE_LABEL_H = 17;
const PANE_LABEL_INSET = 3;

/* Every product pane names itself, the way the reference does — an unlabelled
   strip of bars under a chart is a puzzle. The fills are the faintest wash of
   each pane's own subject so the chip reads as belonging to its band. */
const PANE_LABEL_LOOK: Record<string, { text: string; bg: string; fg: string }> = {
  flow: { text: 'Flow', bg: 'rgba(120,110,40,0.35)', fg: '#E8E4C8' },
  netDrift: { text: 'Net drift', bg: 'rgba(40,90,60,0.35)', fg: '#CFE8D8' },
  volDrift: { text: 'Vol drift', bg: 'rgba(70,60,110,0.35)', fg: '#DCD6F0' },
};

/*
  The rail's thirteen, grouped the way a reader thinks: the lines they trade
  against, the shapes that mark areas, and the marks that carry their own
  words or numbers. Order inside a group is reach-for frequency.
*/
const DRAW_TOOL_GROUPS: { name: string; tools: { tool: DrawingKind; icon: JSX.Element; label: string }[] }[] = [
  {
    name: 'Lines',
    tools: [
      {
      tool: 'trend',
      /* TradingView's own glyph (Noah, 2026-08-28) — the diagonal with a
         circle on each end, which is also exactly what the placed mark's
         anchors look like now. */
      icon: (
        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden>
          <circle cx="3.4" cy="12.6" r="1.8" />
          <circle cx="12.6" cy="3.4" r="1.8" />
          <line x1="4.9" y1="11.1" x2="11.1" y2="4.9" />
        </svg>
      ),
      label: 'Trend',
    },
      { tool: 'extend', icon: <MoveDiagonal className="w-3.5 h-3.5" />, label: 'Extended' },
      { tool: 'arrow', icon: <ArrowUpRight className="w-3.5 h-3.5" />, label: 'Arrow' },
      {
        tool: 'path',
        /* TV's path glyph — dotted zigzag with the head. */
        icon: (
          <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden>
            <circle cx="2.6" cy="12.6" r="1.3" />
            <circle cx="6.8" cy="6.2" r="1.3" />
            <path d="M7.6 7.4 L10 10 L13.4 3.4" />
            <path d="M13.6 2.6 L13.9 5.4 M13.6 2.6 L10.9 3.1" strokeWidth="1.1" />
          </svg>
        ),
        label: 'Path',
      },
      { tool: 'hline', icon: <Minus className="w-3.5 h-3.5" />, label: 'Level' },
      { tool: 'vline', icon: <MoveVertical className="w-3.5 h-3.5" />, label: 'Moment' },
    ],
  },
  {
    name: 'Shapes',
    tools: [
      { tool: 'rect', icon: <Square className="w-3.5 h-3.5" />, label: 'Box' },
      { tool: 'ellipse', icon: <Circle className="w-3.5 h-3.5" />, label: 'Ellipse' },
      { tool: 'channel', icon: <Equal className="w-3.5 h-3.5" />, label: 'Channel' },
      { tool: 'curve', icon: <Spline className="w-3.5 h-3.5" />, label: 'Curve' },
    ],
  },
  {
    name: 'Marks',
    tools: [
      { tool: 'fib', icon: <AlignJustify className="w-3.5 h-3.5" />, label: 'Fib' },
      { tool: 'measure', icon: <Ruler className="w-3.5 h-3.5" />, label: 'Measure' },
      { tool: 'note', icon: <StickyNote className="w-3.5 h-3.5" />, label: 'Note' },
    ],
  },
];

/** What the user chose to draw — every overlay is independent. */
export interface ChartOverlays {
  trails: boolean;
  levels: boolean;
  darkpool: boolean;
  volume: boolean;
  /** Trace's option prints, bucketed to these bars — calls up, puts down. */
  flow: boolean;
  /** Running call/put premium totals for the session — the flow band summed. */
  netDrift: boolean;
  /** Realised vol measured off these bars against the feed's implied. */
  volDrift: boolean;
  /*
    Exposure by STRIKE, docked under the chart rather than drawn inside it.

    It lives on this type and not on a second one because the reader toggles it
    from the same menu as the panes and expects it saved with them — but this
    component never reads it. Every pane lightweight-charts draws shares one
    TIME axis, and this band's axis is the strike; the host renders it below.
  */
  dexStrike: boolean;
  /*
    The session's reference prices — T-6. Prior day high/low/close, the
    opening range and the initial balance, as horizontal rules with distinct
    dashes and their shorthand ON THE FIELD rather than on the price axis.

    ONE INK, FOUR DASH PATTERNS. The dealer palette is spoken for — gold is
    put-dominant, steel call-dominant, magenta the supreme, blue the flip, lime
    selection, white spot — and red and green mean price direction. A session
    level is none of those things, so it takes none of those colours: the dash
    pattern carries which level it is, which is what the directive asks for
    and what leaves the palette meaning what it means.
  */
  session: boolean;
  /*
    The expected-move cone — T-9. What the options were charging for today,
    drawn on the tape in the tape's own units: the ±1σ/±2σ envelope the book
    claimed from the open, and the cone it still claims from here to the
    bell, both off the feed's quoted vol (data/expectedMove.ts). White at
    furniture alpha — it is a claim ABOUT spot, so it wears spot's ink and
    none of the dealer palette's.
  */
  cone: boolean;
  /*
    Event markers — T-11. The calendar on the tape: this name's next report,
    FOMC/CPI/NFP, and the session's largest option prints, as glyphs in a
    lane above the time axis with a hover card each (data/events.ts).
  */
  events: boolean;
  /*
    The dotted orange line where a price alert waits (Noah, 2026-09-10:
    "there should be a way to get rid of the orange lines on the chart for
    the alert. whats the point of the lines when the alert will alert you").
    Off by default: the bell, the chip and the drawer say it either way; the
    line is for a reader who wants to SEE where the watch sits on the tape.
    An absent key on a saved set reads as off.
  */
  alerts?: boolean;
}

/* Chart styles, TradingView's picker (Noah, 2026-08-23: "notice how candles
   is different from the themes") — the SHAPE of the tape, orthogonal to the
   candle color theme. Every style draws from the same bars. */
export type ChartStyle = 'candles' | 'hollow' | 'bars' | 'line' | 'step' | 'area' | 'baseline';

export const CHART_STYLES: { value: ChartStyle; label: string }[] = [
  { value: 'candles', label: 'Candles' },
  { value: 'hollow', label: 'Hollow candles' },
  { value: 'bars', label: 'Bars' },
  { value: 'line', label: 'Line' },
  { value: 'step', label: 'Step line' },
  { value: 'area', label: 'Area' },
  { value: 'baseline', label: 'Baseline' },
];

/* Indicator overlays — computed chart-side from the same aggregated bars the
   tape draws, so they agree with it on every timeframe. */
export interface ChartIndicators {
  ema9: boolean;
  ema21: boolean;
  ema50: boolean;
  vwap: boolean;
  /* T-4's growth of the set. Overlays ride the tape's own scale: */
  /** Bollinger bands — SMA20 ± 2σ, basis and both bands. */
  bb: boolean;
  /** ±1σ/±2σ around the session VWAP — the vwap line's own family. */
  vwapBands: boolean;
  /** SMA 200 — the long classic the EMA trio does not cover. */
  sma: boolean;
  /* Sub-panes share the time axis below the tape (T-3, capped at two): */
  rsi: boolean;
  macd: boolean;
  /** ATR of THIS pane's bars — distinct from T-19's session-ATR ruler. */
  atrPane: boolean;
}

export const DEFAULT_INDICATORS: ChartIndicators = {
  ema9: false, ema21: false, ema50: false, vwap: false,
  bb: false, vwapBands: false, sma: false, rsi: false, macd: false, atrPane: false,
};

/* One categorical ink family for auxiliary lines (indicators here, compare
   lines in the widget) — hues that carry no house meaning. Each key's LEAD
   ink; multi-line indicators carry their parts in INDICATOR_PARTS below. */
export const INDICATOR_INKS: Record<keyof ChartIndicators, string> = {
  ema9: '#5B9CF6',
  ema21: '#BBB2E8',
  ema50: '#EDE4CD',
  vwap: '#6BD3C7',
  bb: '#C7A9CF',
  vwapBands: '#6BD3C7',
  sma: '#D8BC8F',
  rsi: '#A9C77F',
  macd: '#8FB8D8',
  atrPane: '#C0C7CF',
};

/*
  T-3/T-4 — WHAT EACH INDICATOR DRAWS, AND WHERE, as data.

  `pane: 'overlay'` rides the tape's own scale; `'sub'` takes a stacked pane
  below it sharing the time axis — the dexStrike dock's pattern, generalised
  through lightweight-charts' native panes instead of a second hand-rolled
  canvas. SUB_PANE_ORDER is both the allocation order and the CAP: at most
  two sub-panes draw (the directive's rule — refuse the third rather than
  shrink the tape below a floor), enforced in the menu and again here so a
  hand-edited setup cannot smuggle a third in.
*/
export const SUB_PANE_ORDER: (keyof ChartIndicators)[] = ['rsi', 'macd', 'atrPane'];
export const MAX_SUB_PANES = 2;

interface IndicatorPartSpec {
  part: string;
  kind: 'line' | 'hist';
  ink: string;
  dashed?: boolean;
  faint?: boolean;
}
const INDICATOR_PARTS: Record<keyof ChartIndicators, { pane: 'overlay' | 'sub'; parts: IndicatorPartSpec[] }> = {
  ema9: { pane: 'overlay', parts: [{ part: 'line', kind: 'line', ink: INDICATOR_INKS.ema9 }] },
  ema21: { pane: 'overlay', parts: [{ part: 'line', kind: 'line', ink: INDICATOR_INKS.ema21 }] },
  ema50: { pane: 'overlay', parts: [{ part: 'line', kind: 'line', ink: INDICATOR_INKS.ema50 }] },
  vwap: { pane: 'overlay', parts: [{ part: 'line', kind: 'line', ink: INDICATOR_INKS.vwap }] },
  bb: {
    pane: 'overlay',
    parts: [
      { part: 'basis', kind: 'line', ink: INDICATOR_INKS.bb },
      { part: 'upper', kind: 'line', ink: INDICATOR_INKS.bb, dashed: true, faint: true },
      { part: 'lower', kind: 'line', ink: INDICATOR_INKS.bb, dashed: true, faint: true },
    ],
  },
  vwapBands: {
    pane: 'overlay',
    parts: [
      { part: 'up1', kind: 'line', ink: INDICATOR_INKS.vwapBands, faint: true },
      { part: 'dn1', kind: 'line', ink: INDICATOR_INKS.vwapBands, faint: true },
      { part: 'up2', kind: 'line', ink: INDICATOR_INKS.vwapBands, dashed: true, faint: true },
      { part: 'dn2', kind: 'line', ink: INDICATOR_INKS.vwapBands, dashed: true, faint: true },
    ],
  },
  sma: { pane: 'overlay', parts: [{ part: 'line', kind: 'line', ink: INDICATOR_INKS.sma }] },
  rsi: { pane: 'sub', parts: [{ part: 'line', kind: 'line', ink: INDICATOR_INKS.rsi }] },
  macd: {
    pane: 'sub',
    parts: [
      /* The histogram draws FIRST so the lines read over it. One steel wash
         for its bars, not red/green — the sign of momentum is not the price
         direction the pair is reserved for. */
      { part: 'hist', kind: 'hist', ink: 'rgba(226,234,244,0.30)' },
      { part: 'line', kind: 'line', ink: INDICATOR_INKS.macd },
      { part: 'signal', kind: 'line', ink: '#D8A6A6' },
    ],
  },
  atrPane: { pane: 'sub', parts: [{ part: 'line', kind: 'line', ink: INDICATOR_INKS.atrPane }] },
};

/** The keys the T-8 readout prints — single-line overlays only: a
    five-line band pair would blow the readout row's measured width budget,
    and a sub-pane's value is in its own units, not the tape's. */
const READOUT_INDICATOR_KEYS = new Set<keyof ChartIndicators>(['ema9', 'ema21', 'ema50', 'vwap', 'sma']);

/* Compare symbols, TradingView's three flavors (Noah, 2026-08-23):
   percent = ride the SAME pane with the whole right scale in % change;
   scale   = same pane, its own LEFT price scale;
   pane    = its own pane below the tape, own scale. */
export type CompareMode = 'percent' | 'scale' | 'pane';
export interface CompareEntry {
  ticker: string;
  mode: CompareMode;
  /** Line + legend ink — assigned by the host so both stay in agreement */
  ink: string;
}

/*
  THE MAIN PRICE SCALE'S MODE — T-7.

  Four, and they are the library's four: a plain price axis, a logarithmic
  one, percent change from the left edge of the visible range, and every
  series indexed to 100 at that same edge.

  WHY THIS HAD TO EXIST. `CompareEntry` already carried a `percent` mode, and
  turning it on quietly rewrote the MAIN scale to percent — the reader had no
  control over the axis they read prices off, and no way to see that it had
  changed. A percent comparison over a dollar axis reads two ways at once; the
  library will not draw both, so something had to give, and what gave was
  silent. Now the mode is the reader's, and the one case where it is not is
  named on screen (see `priceScaleLock`).
*/
export type PriceScale = 'normal' | 'log' | 'percent' | 'indexed';

/** The picker's rows, and the short label the trigger wears — the axis mode
    is state a reader needs at a glance, so the trigger shows it rather than
    the word "Scale". */
export const PRICE_SCALES: { value: PriceScale; label: string; short: string; blurb: string }[] = [
  { value: 'normal', label: 'Linear', short: 'LIN', blurb: 'Equal dollars, equal height' },
  { value: 'log', label: 'Logarithmic', short: 'LOG', blurb: 'Equal percentages, equal height' },
  { value: 'percent', label: 'Percent', short: '%', blurb: 'Change from the left edge' },
  { value: 'indexed', label: 'Indexed to 100', short: '100', blurb: 'Every series starts at 100' },
];

const PRICE_SCALE_MODE: Record<PriceScale, PriceScaleMode> = {
  normal: PriceScaleMode.Normal,
  log: PriceScaleMode.Logarithmic,
  percent: PriceScaleMode.Percentage,
  indexed: PriceScaleMode.IndexedTo100,
};

/*
  WHEN THE READER'S CHOICE DOES NOT GET TO WIN, and what is holding it.

  A `percent` comparison rides the MAIN right scale. Both lines therefore have
  to be read in the same units or the comparison is not one — so the axis goes
  to percent whatever the picker says.

  ONE GENERATOR. The chart applies this and the toolbar reports it, and if the
  two derived it separately they would be one edit away from a picker that
  says LOG over an axis in percent. Both call this.
*/
export const priceScaleLockedBy = (compares: readonly CompareEntry[]): { mode: PriceScale; reason: string } | null =>
  compares.some(c => c.mode === 'percent')
    ? { mode: 'percent', reason: 'A % comparison shares this axis' }
    : null;

/*
  T-14 — WHICH TAPE A TIMEFRAME READS. At or above one minute the display is
  the 1-minute history aggregated up; below it the display IS the live-only
  seconds tape, never a resample — the sub-minute region before the app
  connected stays honestly empty (see data/timeframe.ts).

  T-15 — a non-time bar clock overrides the timeframe entirely: range and
  volume bars fold the same live-only seconds tape by RULE instead of by
  clock (data/altBars.ts), so they inherit T-14's honesty and its chip.
*/
/** A bar's own day and minute, the way the axis prints them ("Sep 8 · 11:59") */
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayWords = (t: number) => {
  const d = new Date(t * 1000);
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
};
const timeWords = (t: number) => {
  const d = new Date(t * 1000);
  return `${dayWords(t)} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
/** The chart's own replay plays by bars — the pace card's choices */
const BAR_PACES = [
  { value: 2, label: 'Two bars a second', hint: 'A minute bar every half second' },
  { value: 5, label: 'Five bars a second', hint: 'Quick — a session of minutes in about eighty seconds' },
  { value: 10, label: 'Ten bars a second', hint: 'Fast' },
  { value: 1, label: 'A bar a second', hint: 'Slow' },
];

export function displayBars(ticker: string, mins: number, alt?: AltBarSpec | null): Candle[] {
  if (alt) return buildAltBars(Simulator.getSecondsBars(ticker), alt);
  return mins < 1 ? Simulator.getSecondsBars(ticker) : aggregateCandles(Simulator.getCandles(ticker) ?? [], mins);
}

export const DEFAULT_OVERLAYS: ChartOverlays = {
  trails: true,
  levels: true,
  darkpool: false,
  volume: true,
  /* OFF by default, and not out of caution — the tape has no history. It
     accumulates from the moment the app opens, so on a cold load this pane has
     nothing to draw. Defaulting it on would greet every reader with an empty
     band under their chart and no clue why. */
  flow: false,
  /* Off for the same reason — it reads the same tape. */
  netDrift: false,
  /* Off because realised vol needs RV_MODEL.window bars before it can say
     anything, and because a reader who has not asked for a third band should
     not get one: every extra pane is height taken off the tape. */
  volDrift: false,
  /* Off because it costs the tape real height rather than sharing it. */
  dexStrike: false,
  /* Off because seven more rules across a tape is a lot to hand somebody who
     did not ask for them, and every stored setup written before T-6 comes
     back with it false anyway (setups.ts: a key the reader never saw cannot
     have been chosen by them). */
  session: false,
  /* Off for the same courtesy — an envelope plus a runway cone is a lot of
     geometry to hand a reader who has not asked what the options charge. */
  cone: false,
  /* Off until asked for, like every other layer of context. */
  events: false,
};

/*
  WHERE A PRICE LANDS ON THIS CHART, published live.

  A column drawn beside the tape has to agree with the tape's own price scale
  or it is a second, contradicting set of numbers 54px away. Rather than have
  the neighbour re-derive the mapping — it cannot; autoscale, a price-scale
  drag and percent mode all move it — the chart hands out the mapping itself.

  Every member reads at CALL time, so a consumer polling this in its own frame
  loop always gets the live answer and nothing goes stale across a style swap,
  a re-fit or a resize.

  yFor is NOT clamped: a price outside the visible range returns an off-plot y,
  including a negative one, because the caller has to be able to tell "above
  the top" from "at the top". It returns 0 for EVERY price while the scale is
  still empty, which is why a consumer must check the spacing between two
  prices rather than trusting a single coordinate.
*/
/**
 * How wide the price gutter is forced to be when the chart draws its own
 * live-price card (`priceTag`).
 *
 * The card is min-w-[68px] at right-1, so on the library's natural ~54px
 * gutter it hung ~18px over the plot and covered the tape's own right edge.
 * Widening the SCALE puts the card inside the gutter instead of over the
 * chart.
 *
 * EXPORTED because a host that floats chrome has to clear the same number.
 * Terrain kept its own `PRICE_GUTTER_PX = 56`, and the moment this became 74
 * the two disagreed and the desk would have parked a button on the price
 * ticks — the browser sweep failed on exactly that, which is what it is for.
 * One number, one place, both consumers reading it.
 */
export const PRICE_SCALE_MIN_WIDTH = 74;

export interface PriceProjection {
  /** y in CSS px from the top of the plot, or null if the series is gone. */
  yFor(price: number): number | null;
  /** The plot's own height — NOT the container's; the time axis is below it. */
  plotHeight(): number;
  /** The time axis's height, for a neighbour that has to stop above it. */
  axisHeight(): number;
}

interface StrikeChartProps {
  ticker: string;
  /** Bumped every simulator tick so the chart folds in the newest bar */
  revision: number;
  levels: KeyLevels;
  timeframe: Timeframe;
  height?: number;
  /** KEEP THE READER'S VIEW (the Weigher's rule, 2026-08-30). Off by default
      so Terrain and Pulse keep the behaviour Noah likes there. On: a width
      change never re-fits the window (a wider pane simply shows more bars),
      and the view — bar spacing and scroll position — survives a remount of
      the same name+timeframe, so a fullscreen takeover opens where the
      reader was instead of at the default window. */
  keepView?: boolean;
  /** Drop the container's own border/fill/rounding — the host supplies ONE
      surface and the tape bleeds to its edges (Noah, 2026-08-23: "i notice
      different layers of black"). */
  frameless?: boolean;
  /** Transient user-focused price — renders a cyan FOCUS line while set */
  focusPrice?: number | null;
  overlays?: ChartOverlays;
  /** Dark-pool prints for the DP overlay (whisper lines, MiniPane grammar) */
  prints?: DarkPoolPrint[];
  /**
   * Trace's option prints, for the FLOW pane.
   *
   * Handed in rather than read here, and that is the point: the tape desk and
   * this pane are two readers of ONE accumulated tape (the provider owns it),
   * so they cannot end up quoting different premium for the same session.
   * Every print, unfiltered — this component narrows to its own ticker, because
   * a host with four panes should not bucket the same tape four times.
   */
  flowPrints?: readonly StampedFlowPrint[];
  /** Comparison symbols drawn as lines over/under the tape */
  compares?: CompareEntry[];
  /** The main (right) price scale's mode — T-7. A `percent` comparison
      overrides it; see `priceScaleLockedBy`. */
  priceScale?: PriceScale;
  /** Which opening range the session overlay draws — T-6. Ignored unless
      `overlays.session` is on. */
  sessionOr?: OpeningRange;
  /** The tape's shape — candles, bars, line, area… (theme-independent) */
  chartStyle?: ChartStyle;
  /** Pin this chart to ONE candle theme, ignoring the app-wide store —
      Terrain's panes each own theirs (Noah, 2026-08-25). */
  themeKey?: CandleThemeKey;
  /** T-15 — the bar CLOCK, keyed into data/altBars.ts's BAR_CLOCKS. 'time'
      is the ordinary timeframe; a range/volume key folds the live seconds
      tape by rule instead. Overlays that assume a fixed bar interval (cone,
      events, session, the flow family, trails, VWAP) are gated off while a
      rule clock is on — their menu rows say why. */
  barClock?: string;
  /** Indicator overlays computed from the same bars */
  indicators?: ChartIndicators;
  /** THIS PANE'S NAME for the script library (the Pine runtime, 2026-09-10):
      'pulse:main', 'terrain:1', 'weigher', 'pinpoint:map'. Given, the scripts
      placed on it draw here over the same bars; absent, no script draws. */
  paneId?: string;
  /** Draw mode — pointer sketches trendlines/levels instead of panning */
  drawing?: boolean;
  onExitDraw?: () => void;
  /** The persistent rail's way IN — clicking a tool while not drawing arms
      draw mode with that tool. Hosts that never draw leave it unset and get
      no rail. */
  onEnterDraw?: () => void;
  /** Whether this host has headroom for the TOP dock. A docked pane's top
      band is already spoken for (identity chrome, the heaviest read, the
      toolbar chip), so the rail falls back to its left column there — the
      reader's `top` choice waits for a surface with room (Noah, 2026-08-29:
      "on minimal view the toolbar should be defaulted back to the left").
      Default true: a host that says nothing is a full surface. */
  railTopOk?: boolean;
  /** Replay mode — scrub through history bar by bar, trails included */
  replay?: boolean;
  /** The Map's own replay clock (2026-09-08): given, the chart shows the bars
      up to this time and keeps its own transport off — one scrubber drives
      the whole page. Absent, the chart's own transport plays as before. */
  replayTime?: number | null;
  /** PICK A BAR (the TradingView way in, 2026-09-08): the crosshair is a silver
      line and a click on a bar hands its time to the host, which starts the
      replay from that minute. */
  pickTime?: boolean;
  onPickTime?: (time: number) => void;
  onExitReplay?: () => void;
  /** The live price on the right scale as a soft two-line card — the price, a
      rule, and the time left in the current bar — in place of the library's
      flat last-value tag. Off by default; Terrain turns it on. */
  priceTag?: boolean;
  /** Which exposure the trails draw — gamma unless the host's head says
      otherwise (the Map's Greek dropdown, 2026-09-06). Pulse and Terrain
      pass nothing and stay on gamma. */
  trailsGreek?: 'gex' | 'dex' | 'vex';
  /** Fired on REAL pointer input only — the hovered bar's time, or null when
      the pointer leaves the plot. The library re-fires its crosshair event on
      every model update, and this chart updates four series a tick; those
      echoes are filtered out before this is called. */
  onCrosshair?: CrosshairSync;
  /** Handed this chart's own "mark that moment" function on mount and null on
      unmount, so a host can call it when a DIFFERENT pane is hovered. */
  syncRegister?: (apply: CrosshairSync | null) => void;
  /** This chart's OHLCV and indicator values at the hovered moment — T-8.
      Fires for a pointer on this plot AND for a moment arriving from another
      pane, so a synced desk reads values on every pane rather than only on
      the one under the cursor. */
  onReadout?: CrosshairReadout;
  /** Filled with this chart's live price projection on mount, nulled on
      unmount. A REF rather than a callback on purpose: a ref object's identity
      never changes, so it can sit in the mount effect's dep array without
      rebuilding the chart on every parent render. */
  projectionRef?: MutableRefObject<PriceProjection | null>;
  /** T-23 — filled with the pane's PNG exporter (chart.takeScreenshot plus
      an identity header and watermark, downloaded on call). Ref-based like
      the projection: the chart owns its canvases, the host owns the
      trigger. */
  exportRef?: MutableRefObject<(() => void) | null>;
  /**
   * SHRINK THE PRICE-SCALE FURNITURE — for a chart on a phone.
   *
   * The axis labels and the strike chips are fixed sizes, tuned on a chart
   * about 550px wide. They do not scale with the tape, so on a narrow one they
   * take a far larger share of it. Measured on `/pulse`: the price gutter is
   * 54px on BOTH — 4.2% of a 1280px desktop chart and 13.8% of a 390px phone
   * screen, three times the proportional cost for the same information.
   *
   * `compact` is the same idea as `ChartToolbar`'s: not a different design,
   * the same one at the size the host can afford.
   */
  compact?: boolean;
  /**
   * THIS CHART IS INSIDE A PAGE THAT SCROLLS — leave the wheel to it.
   *
   * lightweight-charts captures the wheel by default and zooms with it, which
   * is right when the chart owns its viewport and wrong when it is one tile in
   * a column taller than the window.
   *
   * Terrain below `lg` is the second case. Its root says "the page scrolls
   * normally" there, and it did not: measured at 900x700 with two panes, the
   * grid is a fixed 76..922 whatever the window height, so 222px sits below the
   * fold — and wheeling anywhere over a chart scrolled nothing. The page moved
   * only at x = 0, 3, 6, 894 and 897: two ~7px strips at the margins, plus the
   * 6px gap between the panes. The arrangement controls sat at y=854 in a
   * 700px window, unreachable.
   *
   * The trade is real and worth stating: wheel-zoom goes away on those widths.
   * A reader who cannot reach the controls at all has lost more.
   */
  pageScroll?: boolean;
}

/** Mark a moment on this chart on another pane's behalf; null clears it. */
export type CrosshairSync = (time: UTCTimestamp | null) => void;

/*
  WHAT THE HOVERED BAR SAYS — T-8.

  A SECOND channel, not an extension of `CrosshairSync`, and the split is
  deliberate. Sync carries a MOMENT between panes and nothing else ("no price
  can cross a pane boundary here — two panes are usually two symbols"). The
  readout is this chart reporting its OWN values at that moment to its OWN
  host. Widening CrosshairSync to carry them would put one pane's prices into
  another pane's hands, which is the thing that type exists to prevent.

  EVERY FIELD IS NULLABLE EXCEPT `close`, because the tape has seven shapes.
  A line, step, area or baseline chart draws closes; it has no high or low ON
  SCREEN, and the readout reports what the chart is drawing rather than
  re-deriving bars the reader did not ask to see. Volume is null when the
  overlay is off, and `indicators` carries only the ones actually drawn.
*/
export interface CrosshairBar {
  time: UTCTimestamp;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number;
  volume: number | null;
  /** Active indicators at that bar, in the chart's own order, with its inks. */
  indicators: { key: keyof ChartIndicators; ink: string; value: number }[];
}

/** This chart's values at the hovered moment; null when nothing is hovered. */
export type CrosshairReadout = (bar: CrosshairBar | null) => void;

// Wall / flip / supreme overlay colors (independent of candle theme)
import { BULL, CALL_WALL, PUT_WALL, FLIP, SUPREME, FOCUS, DARK_POOL, ALERT as ALERT_INK } from './palette';

// Level lines are created once per overlay/ticker, then their prices are
/* ── THE RAIL'S TWO READER PREFERENCES (Noah, 2026-08-29: "the user has a
   toolbar only if they please... being able to move the toolbar up top") ──
   One tiny store, module-wide, persisted — so hiding or re-docking the rail
   on ANY chart does it on every chart at once, which is the only version a
   reader can predict. `open` hides the rail down to a slim tab at its edge
   (TradingView's own collapse grammar — the tab is the way back, always
   visible, never a hunt); `dock` chooses the left edge (the column) or the
   top edge (the same tools as a row, in the chart's quiet upper band). */
type RailDock = 'left' | 'top';
const RAIL_KEY = 'slayer_draw_rail';
let railPrefs: { dock: RailDock; open: boolean } = (() => {
  try {
    const raw = JSON.parse(localStorage.getItem(RAIL_KEY) ?? '{}') as { dock?: string; open?: boolean };
    return { dock: raw.dock === 'top' ? 'top' : 'left', open: raw.open !== false };
  } catch {
    return { dock: 'left', open: true };
  }
})();
const railListeners = new Set<() => void>();
function setRailPrefs(patch: Partial<{ dock: RailDock; open: boolean }>): void {
  railPrefs = { ...railPrefs, ...patch };
  try {
    localStorage.setItem(RAIL_KEY, JSON.stringify(railPrefs));
  } catch {
    /* storage off — the choice lives for the session */
  }
  railListeners.forEach(fn => fn());
}
const railSubscribe = (fn: () => void) => {
  railListeners.add(fn);
  return () => {
    railListeners.delete(fn);
  };
};
const railSnapshot = () => railPrefs;
function useRailPrefs(): { dock: RailDock; open: boolean } {
  return useSyncExternalStore(railSubscribe, railSnapshot, railSnapshot);
}

/* THE STRIP'S GAP (Noah, 2026-09-12: the top-docked rail "should sit in
   between the timeframes and the replay button"): a host's strip lays its
   timeframes at the left and its menus at the right with a spacer between
   (ChartToolbar `[data-toolbar-gap]`). The rail centres itself IN THAT GAP,
   measured, rather than at a guessed nudge off 50% — the clusters differ per
   host (Terrain's symbol form is wider than Pulse's). Measured off the nearest
   ancestor that holds the spacer, re-read on any resize. Null when no strip
   holds one (the docked panes), and the rail keeps its own nudge. */
function useToolbarGap(containerRef: MutableRefObject<HTMLDivElement | null>, on: boolean): { left: number; width: number } | null {
  const [gap, setGap] = useState<{ left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!on || !el) {
      setGap(null);
      return;
    }
    const find = (): { host: HTMLElement; spacer: HTMLElement } | null => {
      let host: HTMLElement | null = el.parentElement;
      while (host) {
        const spacer = host.querySelector<HTMLElement>('[data-toolbar-gap]');
        if (spacer) return { host, spacer };
        host = host.parentElement;
      }
      return null;
    };
    let ro: ResizeObserver | null = null;
    let raf = 0;
    let tries = 0;
    const read = (spacer: HTMLElement) => {
      const g = spacer.getBoundingClientRect();
      const c = el.getBoundingClientRect();
      const next = { left: Math.round(g.left - c.left), width: Math.round(g.width) };
      setGap(prev => (prev && prev.left === next.left && prev.width === next.width ? prev : next));
    };
    const attach = () => {
      const found = find();
      if (!found) {
        /* The strip's spacer arrives a frame or two after the pane expands —
           its toolbar sheds `compact` only once the strip has measured its
           new width — so look again for a few frames before giving up */
        if (tries++ < 20) raf = requestAnimationFrame(attach);
        else setGap(null);
        return;
      }
      read(found.spacer);
      ro = new ResizeObserver(() => read(found.spacer));
      ro.observe(found.host);
      ro.observe(found.spacer);
    };
    attach();
    const onResize = () => {
      const found = find();
      if (found) read(found.spacer);
    };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, [containerRef, on]);
  return gap;
}

// TWEENED (rAF + easeOutCubic) so scan-tier level moves glide instead of jumping.
const LEVEL_SPEC: {
  key: 'callWall' | 'putWall' | 'flip' | 'supreme';
  color: string;
  title: string;
  style: LineStyle;
  width: 1 | 2;
}[] = [
  { key: 'callWall', color: CALL_WALL, title: 'CALL WALL', style: LineStyle.Solid, width: 1 },
  { key: 'putWall', color: PUT_WALL, title: 'PUT WALL', style: LineStyle.Solid, width: 1 },
  /* Width 2 + long dashes (Noah, 2026-08-29: "make the flip line more
     noticable and im not talking about color wise") — the regime border
     carries the supreme's weight; the dash rhythm is what says "boundary, not
     a wall". */
  { key: 'flip', color: FLIP, title: 'FLIP ZONE', style: LineStyle.LargeDashed, width: 2 },
  { key: 'supreme', color: SUPREME, title: 'SUPREME', style: LineStyle.Solid, width: 2 },
];
/* NO axis chips at all now — the supreme's capsule left the right pane too
   (Noah, 2026-08-23: "we will have a separate section of the website where
   we explain everything"). The field alone carries every identity: magenta
   band = supreme, green/red beads = walls, blue ticks = flip. LEVEL_SPEC stays
   for the tween plumbing and any future re-enable. */
const LINE_LEVELS: typeof LEVEL_SPEC = [];

/*
  NOTHING IS NAMED ON THE PRICE AXIS — not the walls, not the flip, not the
  supreme (Noah, 2026-08-25: "you can remove the flip zone and supreme node if you
  have it on the screen with its own UI touch that should be enough").

  That is the argument that took the walls off, carried the rest of the way.
  Every one of these levels already has a treatment ON the field: a green node
  band is the call wall, a red one the put wall, a dashed blue rule the flip,
  a magenta band the supreme. A capsule in the gutter repeats a fact the chart
  has already made, in the loudest form available, on top of the tape.

  LEVEL_SPEC above stays for the tween plumbing and any future re-enable; the
  pre-blending helper that went with the capsules is gone with them rather
  than left behind as scenery.
*/

const toCandle = (b: Candle) => ({
  time: b.time as UTCTimestamp,
  open: b.open,
  high: b.high,
  low: b.low,
  close: b.close,
});

/** Styles that eat whole bars; the rest eat closes. */
const OHLC_STYLES: ReadonlySet<ChartStyle> = new Set(['candles', 'hollow', 'bars']);
const toVolume = (b: Candle, t: CandleTheme) => ({
  time: b.time as UTCTimestamp,
  value: b.volume,
  color: b.close >= b.open ? t.volUp : t.volDown,
});

/** The field's clock: a bead every 5 minutes of real history, whatever the bar —
    a 30m bar carries six, an hour twelve (Noah, 2026-08-22). */
const TRAIL_TEXTURE_MINUTES = 5;
/** Bars a chart opens with — more than a screen at any pitch; the rest of the
    store loads when the reader scrolls to their left edge (see onRange) */
const INITIAL_BARS = 1000;
/** ...which is this many bars from the first loaded one */
const FULL_TRIGGER = 80;
/** The bars a world shows: the whole store once asked for, the recent window otherwise */
const windowOf = (all: Candle[], full: boolean): Candle[] =>
  full || all.length <= INITIAL_BARS + 200 ? all : all.slice(all.length - INITIAL_BARS);

/** keepView: the reader's view per world, surviving a remount — see the
    chart cleanup (save) and the data effect's new-world branch (restore). */
const KEPT_VIEWS = new Map<string, { barSpacing: number; scroll: number }>();

/** One empty array for the `compares` default — a literal [] default is a
    new identity per render, and an effect keyed on it fires every render. */
const NO_COMPARES: never[] = [];

/**
 * TradingView-grade candlestick chart with dealer-structure overlays and the
 * net-GEX node heatmap. Smoothness contract: created once; ticks arrive as
 * series.update() on the last (current-bucket) bar; full setData + fitContent
 * only on ticker/timeframe change. Pan/zoom is never fought.
 */
const StrikeChart = ({
  ticker,
  paneId,
  revision: revisionProp,
  levels,
  timeframe,
  height = 460,
  keepView = false,
  trailsGreek = 'gex',
  compact = false,
  pageScroll = false,
  frameless = false,
  focusPrice = null,
  overlays = DEFAULT_OVERLAYS,
  prints = [],
  flowPrints,
  compares = NO_COMPARES,
  priceScale = 'normal',
  sessionOr = 15,
  chartStyle = 'candles',
  themeKey: themeKeyProp,
  barClock = 'time',
  indicators = DEFAULT_INDICATORS,
  drawing = false,
  onExitDraw,
  onEnterDraw,
  railTopOk = true,
  replay = false,
  replayTime = null,
  pickTime = false,
  onPickTime,
  onExitReplay,
  priceTag = false,
  onCrosshair,
  syncRegister,
  onReadout,
  projectionRef,
  exportRef,
}: StrikeChartProps) => {
  /* NO TICK UNDER THE HAND (Noah, 2026-08-30: "i was in the middle of a drag
     and it practically ignored me and changed my view"). Measured with the
     button held down on the chart: the 1.5s tick's rebuild — candles,
     volume, indicators, compares, trails, session, cone, events, alerts —
     landed as 52–82ms tasks and 49–104ms frame gaps, so the drag froze and
     the queued pointer moves snapped the view afterwards. While a pointer is
     down on this chart the revision is HELD: every tick-driven effect below
     keys on this held value, so nothing rebuilds under a drag. The newest
     revision is applied once, on release. Pan/zoom is never fought. */
  const [revision, setRevision] = useState(revisionProp);
  const keepViewRef = useRef(keepView);
  keepViewRef.current = keepView;
  /** The price scale's resolved mode — a compare in scale mode locks it,
      otherwise the prop. A string, so effects can key on it safely. */
  const scaleMode = priceScaleLockedBy(compares)?.mode ?? priceScale;
  const panRef = useRef(false); // a pointer is down on the plot (the drawing tools own `dragRef` below)
  const pendingRef = useRef<number | null>(null);
  useEffect(() => {
    if (panRef.current) pendingRef.current = revisionProp;
    else setRevision(revisionProp);
  }, [revisionProp]);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const down = () => {
      panRef.current = true;
    };
    const up = () => {
      if (!panRef.current) return;
      panRef.current = false;
      if (pendingRef.current != null) {
        const r = pendingRef.current;
        pendingRef.current = null;
        // Applied at once: deferring it a frame measured WORSE (87–109ms →
        // 151ms on release) — React interleaved the deferred urgent update
        // with the desk's in-flight transition and did the work twice.
        setRevision(r);
      }
    };
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* PER-PANE CANDLE THEME (Noah, 2026-08-25: "if i change the theme for 1
     chart it should NOT change for all the others"). Ours, kept through the
     port — the partner tree reads the global store here and so paints every
     pane alike. A pinned pane takes the prop; everything unpinned keeps
     following the app-wide store. */
  const globalThemeKey = useCandleThemeKey();
  /* The app's theme moves the ground of a theme without a canvas of its own (2026-09-12) */
  const appTheme = useResolvedTheme();
  const themeKey = themeKeyProp ?? globalThemeKey;
  /* Read straight from the store rather than taken as a prop: alerts belong to
     the SYMBOL, and two panes showing the same symbol must draw the same set.
     The drawings store is read the same way, from this same component. */
  const alerts = useAlerts(ticker);
  /* The rule clock's spec, or null on the ordinary timeframe — resolved once
     per key so every effect gates on the same object. */
  const altSpec = useMemo(() => barClockSpec(barClock), [barClock]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  /* Read at CREATE time by the mount effect, which must not take `compact` as
     a dep — that effect builds the whole chart, and rebuilding it on a prop
     change would drop the reader's pan, zoom and drawings. An effect below
     applies later changes with `applyOptions` instead. */
  const compactRef = useRef(compact);
  compactRef.current = compact;
  const pageScrollRef = useRef(pageScroll);
  pageScrollRef.current = pageScroll;
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  /* Two series, not one signed one: the reference draws BOTH legs around a zero
     line, and a single net bar cannot say whether a quiet bucket was quiet or
     whether a billion dollars hit each side and cancelled. */
  const flowCallsRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const flowPutsRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  /* The two drift lines and the two vol lines, each pair sharing one pane. */
  const driftCallsRef = useRef<ISeriesApi<'Line'> | null>(null);
  const driftPutsRef = useRef<ISeriesApi<'Line'> | null>(null);
  const rvRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ivRef = useRef<ISeriesApi<'Line'> | null>(null);
  /* Where each product pane's top edge sits, in px up from the container's
     bottom. MEASURED off the chart rather than computed from a constant: a
     reader can drag the separators, the time axis's height is the library's to
     decide, and with three optional panes the offsets depend on which of them
     happen to be open. */
  const [paneLabels, setPaneLabels] = useState<{ key: string; bottom: number }[]>([]);
  /*
    THE RUNWAY — a series that draws nothing and holds only WHITESPACE.

    lightweight-charts labels the time axis from the time points its series
    hold, and it has none past the last bar. That is why the axis stopped 62%
    of the way across and the room this chart deliberately keeps open ahead of
    the market came out blank: not a spacing problem, a data problem. There is
    literally nothing there to label.

    Whitespace items — `{ time }` and no value — are the library's own answer.
    They are real time points to the scale and invisible to the plot, so the
    ticks continue past the last bar and keep continuing as the reader zooms
    out, which is what every platform does and what was asked for.

    It is a SEPARATE series on purpose. Appending whitespace to the candles
    would put the newest data point in the future, and `update()` refuses a
    point older than the last one — every live tick would be rejected and the
    tape would freeze. Keeping the runway beside the candles leaves that path
    exactly as it was.
  */
  const runwaySeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  /** Bar time the runway was last built from, and how far it reaches. */
  const runwayRef = useRef<{ from: number; slots: number }>({ from: 0, slots: 0 });
  /** Close of the newest bar — what the price card prints. */
  const lastCloseRef = useRef<number | null>(null);
  const priceTagRef = useRef<HTMLDivElement | null>(null);
  const priceTagRafRef = useRef(0);
  const trailsRef = useRef<GexTrailsPrimitive | null>(null);
  const compareSeriesRef = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());
  const compareLoadedRef = useRef('');
  const indicatorSeriesRef = useRef<Map<string, ISeriesApi<'Line'> | ISeriesApi<'Histogram'>>>(new Map());
  /* THE SCRIPTS ON THIS PANE (2026-09-10): one handle per placed script, the
     compiled trees by source hash, and the signature the handles were built
     for — a tick redraws in place, a change of set or shape rebuilds. */
  const scriptHandlesRef = useRef<Map<string, ScriptHandle>>(new Map());
  const scriptSigRef = useRef('');
  const compiledRef = useRef<Map<string, Compiled>>(new Map());
  const paneScripts = usePaneScripts(paneId);
  const indicatorLoadedRef = useRef('');
  /* The main series' style — a ref for the one-time creation effect, a
     nonce so every effect that hangs price lines off the main series knows
     to re-hang them after a style swap replaces it. */
  const styleRef = useRef<ChartStyle>(chartStyle);
  styleRef.current = chartStyle;
  const styleBuiltRef = useRef<ChartStyle | null>(null);
  const [mainNonce, setMainNonce] = useState(0);
  /* T-14: the sub-minute tape starts at connect, and the pane SAYS SO —
     0 = connected but no prints yet, a time = the first live quarter,
     null = not a sub-minute view. */
  const [liveFrom, setLiveFrom] = useState<number | null>(null);
  const printLinesRef = useRef<IPriceLine[]>([]);
  const levelLinesRef = useRef<Partial<Record<'callWall' | 'putWall' | 'flip' | 'supreme', IPriceLine>>>({});
  const shownLevelsRef = useRef<KeyLevels | null>(null);
  /** T-6's layer. One primitive for the life of the chart; what it draws is
      swapped, never the primitive itself — see the session effect below. */
  const sessionPrimRef = useRef<SessionLevelsPrimitive | null>(null);
  /** T-9's layer, run the same way — see the cone effect below. */
  const conePrimRef = useRef<ExpectedMovePrimitive | null>(null);
  /** T-11's layer, ditto. */
  const eventsPrimRef = useRef<EventsPrimitive | null>(null);
  /** The calendar half of the events data, cached per ticker+day — earnings
      and macro dates move daily while the prints move every tick, and
      rebuilding the whole earnings universe 40× a minute would be spend
      without information. */
  const eventsCalRef = useRef<{ key: string; earnings: EarningsEvent | null; macro: MacroDate[]; todayIso: string } | null>(null);
  /** The hovered marker's card. */
  const [eventCard, setEventCard] = useState<{ e: MarketEvent; x: number } | null>(null);
  const levelRafRef = useRef(0);
  /** Time of that bar, and the seconds one bar covers — what the runway is
      built from, kept in refs so the time-scale subscription can read them
      without being torn down and rebuilt on every tick. */
  const lastBarTimeRef = useRef(0);
  /* What the price card's countdown measures against: the bar time we last
     saw, when we saw it in REAL ms, and the observed real gap between the
     last two arrivals. `realMs: 0` means "not yet observed" and the countdown
     stays blank rather than guessing. */
  const barClockRef = useRef({ stamp: 0, at: 0, realMs: 0 });
  const bucketSecRef = useRef(60);
  const levelTickerRef = useRef('');
  const focusLineRef = useRef<IPriceLine | null>(null);
  /** One price line per alert, by alert id. */
  const alertLinesRef = useRef<Map<string, IPriceLine>>(new Map());
  /** One price line per alert, by alert id. */
  /** The focus price, readable from the autoscale provider (a closure built
      once at chart creation) — a focused strike must never sit off-screen. */
  const focusPriceRef = useRef<number | null>(focusPrice);
  const levelsRef = useRef<KeyLevels>(levels);
  const barCountRef = useRef(0);
  /* THE HISTORY ON DEMAND (2026-09-06, the perf sweep): a world (name ·
     interval · clock) opens on its recent bars; the reader scrolling to
     their left edge asks for the whole store, once — `fullWorldRef` names
     the world that asked, `recentHeldRef` says a window is on screen, and
     the nonce re-runs the data effects. */
  const fullWorldRef = useRef<string | null>(null);
  const recentHeldRef = useRef(false);
  const worldKeyRef = useRef('');
  const [fullNonce, setFullNonce] = useState(0);
  /* Mirrored every render, read from a subscription installed once — the same
     pattern levelsRef and focusPriceRef use, and the reason the mount effect
     never has to re-subscribe. `revision` bumps every 1500ms and an effect
     keyed on the prop would tear the handler down ten times a minute. */
  const onCrosshairRef = useRef(onCrosshair);
  onCrosshairRef.current = onCrosshair;
  const syncRegisterRef = useRef(syncRegister);
  syncRegisterRef.current = syncRegister;
  const onReadoutRef = useRef(onReadout);
  onReadoutRef.current = onReadout;
  /** The last payload actually sent, as a string — see `emitReadout`. */
  const readoutSigRef = useRef('');
  /** The moment this chart is currently marking for another pane, or null. */
  const syncedRef = useRef<UTCTimestamp | null>(null);
  /** Whether the horizontal crosshair arm is currently hidden because this
      chart is following another pane. Tracked SEPARATELY from syncedRef: a
      follower that is told to clear still has to get its own arm back, and
      hanging that off "am I marking a time" loses it the moment the time
      goes null. */
  const followerRef = useRef(false);
  /* Rule-clock bookkeeping: the bar counts last painted, so a pass can tell
     "the forming bar grew" (cheap update) from "a bar completed and a new
     one opened" (reload — update() cannot rewrite an older time). */
  const altCountRef = useRef(0);
  const indAltCountRef = useRef(0);
  const loadedRef = useRef<{ ticker: string; timeframe: Timeframe; theme: string; clock: string; full: boolean }>({
    ticker: '',
    timeframe: '1m',
    theme: '',
    clock: 'time',
    full: false,
  });

  // ---- drawing state ----
  const drawingsRef = useRef<DrawingsPrimitive | null>(null);
  const shapesRef = useRef<Drawing[]>([]);
  const dragRef = useRef<Drawing | null>(null);
  /** A committed BASE waiting for its third anchor — the channel's width,
      the curve's bend. Which kinds owe one comes from the same KIND_SHAPE
      table the validator reads (needsThirdAnchor). */
  const pendingThirdRef = useRef<Drawing | null>(null);
  /* The path under construction — clicks append here; a double-click seals
     it. Cleared when the hand changes tools or leaves draw mode. */
  const pathDraftRef = useRef<{ time: number; price: number }[] | null>(null);
  /* CLICK-MOVE-CLICK, armed (Noah, 2026-08-29: "on the first click it plops
     the entire thing down which is wrong. what it should do is on the first
     click ... be the first end of the line then it drags visibly until you
     plot the second point") — when a press releases without having really
     DRAGGED (under the pixel threshold), the draft stays in the hand: the
     line rides the cursor and the NEXT press plants the second anchor. A
     real drag still commits on release, so both grammars live. */
  const pendingSecondRef = useRef<Drawing | null>(null);
  /** Where the two-anchor press started, in px — release compares against
      this to tell a drag from a click. */
  const dragOriginRef = useRef<{ x: number; y: number } | null>(null);
  /** Where a note is being typed, in both spaces: chart coords to commit,
      client coords to float the input at. Null = no note in progress. */
  const [noteAt, setNoteAt] = useState<{ time: number; price: number; x: number; y: number } | null>(null);
  /* 'select' is the rail's pointer — not a DrawingKind, because it MAKES no
     drawing: it picks one up. The default, so entering draw mode never
     scribbles a trend on the first accidental drag. */
  const [drawTool, setDrawTool] = useState<DrawingKind | 'select'>('select');
  /** The selected mark's index in shapesRef — mirrored into the primitive
      for its handles. */
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  /** A drag in progress on the SELECTED mark: one anchor, or the whole body. */
  const editRef = useRef<{
    index: number;
    /** p1/p2/p3 = 0/1/2; a path's points index freely beyond that. */
    anchor: number | null;
    start: { time: number; price: number };
    orig: Drawing;
    moved: boolean;
  } | null>(null);

  const deselect = useCallback(() => {
    setSelectedIdx(null);
    drawingsRef.current?.setSelected(null);
    editRef.current = null;
  }, []);

  /* Leaving draw mode, or the world changing under it, abandons whatever was
     mid-gesture: a channel base with no width yet, a note not yet typed, a
     draft mid-drag. Committing any of them would be finishing a gesture the
     reader walked away from. */
  useEffect(() => {
    if (drawing) return;
    dragRef.current = null;
    pendingThirdRef.current = null;
    setNoteAt(null);
    drawingsRef.current?.setDraft(null);
    deselect();
  }, [drawing, deselect]);
  useEffect(() => {
    dragRef.current = null;
    pendingThirdRef.current = null;
    setNoteAt(null);
    drawingsRef.current?.setDraft(null);
    deselect();
  }, [ticker, timeframe, deselect]);

  // ---- replay state ----
  const replayRef = useRef(false); // effect-visible mirror of the replay prop
  const replayDataRef = useRef<{ bars: Candle[]; snaps: ReturnType<typeof aggregateSnapshots>; maxAbs: number } | null>(null);
  const replayAppliedRef = useRef(0); // last idx applied to the series (for the fast append path)
  const [replayIdx, setReplayIdx] = useState(0);
  const [replayPlaying, setReplayPlaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState(2);
  const [reloadNonce, setReloadNonce] = useState(0);

  // Keep the autoscale provider reading the freshest levels without re-mounting
  levelsRef.current = levels;

  /* The default view on a new world (ticker or timeframe): as many bars as
     the chart can hold at a DENSE pitch, not a fixed 130 (Noah, 2026-08-22:
     130 bars on a wide screen spread to ~10px and the ribbons ballooned;
     the view he wants is the one where bars sit at ~4px and the field reads
     as texture). Width-aware, so a docked panel and the fullscreen takeover
     each get the pitch, not the count. */
  /* The bar pitch the default view lands on, per timeframe (Noah,
     2026-08-22, tuned against his own screenshots): 5m reads right at ~4px,
     15m at ~6.5 — coarser bars earn more room, so a wider frame shows fewer
     of them and the recent structure stays legible. */
  const DEFAULT_PITCH_PX: Record<Timeframe, number> = { '15s': 3, '1m': 3.5, '5m': 4, '15m': 6.5, '30m': 8, '1h': 10, '1D': 14, '1W': 18 };
  /* History takes ~64% of the width; the rest stays OPEN ahead of the last
     bar (Noah, 2026-08-22: "more spacious... pay more attention to what's
     ahead / current time" — a window crammed with five prior sessions put
     the present at the right edge). */
  const HISTORY_SHARE = 0.64;
  const timeframeRef = useRef<Timeframe>(timeframe);
  timeframeRef.current = timeframe;
  /** The container's last observed width — the re-fit observer keeps it, so
      showRecent reads the DOM (a forced layout, 28–44ms of every desk open
      on the profiler) only the first time, before any observation. */
  const widthRef = useRef(0);
  const showRecent = useCallback(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const len = barCountRef.current;
    const width = widthRef.current || (containerRef.current?.clientWidth ?? 1200);
    const pitch = DEFAULT_PITCH_PX[timeframeRef.current] ?? 4;
    let total = Math.max(90, Math.min(700, Math.round(width / pitch)));
    /*
      T-14: a live-only tape can be MINUTES old — twenty quarter-bars against
      a 300-slot window rendered as a sliver at the left edge of 46 minutes
      of runway (measured on the first 15s pane). When the data is smaller
      than the window, the window shrinks to the data plus breathing room,
      keeping the same history/runway split — the bars stay readable and the
      runway stays a runway, not a prairie.
    */
    total = Math.min(total, Math.max(Math.ceil(len / HISTORY_SHARE) + 8, 48));
    const history = Math.round(total * HISTORY_SHARE);
    const ahead = total - history;
    chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, len - history), to: len + ahead });
  }, []);

  /*
    ══ RE-FIT WHEN THE PANE CHANGES WIDTH ═══════════════════════════════════

    `showRecent` splits the visible span 64% history / 36% runway, and it ran
    ONLY on mount, on a ticker/timeframe/theme change, and on a double-click
    reset. Nothing watched the container.

    That is fine until a pane changes size under a chart that is already
    mounted — which is what every Terrain layout change does. lightweight-
    charts preserves BAR SPACING across a resize, not the logical range, so a
    narrowed pane shows fewer bars while the runway, fixed in bars, keeps its
    pixel width. A 36% runway sized for a 1240px pane is ~446px; drop it into
    the 522px pane that "3 charts" produces and it is 85% of the chart.

    Measured across 24 transitions at 1280/1440/1760, candle occupancy of the
    pane that was already open:

      1 -> 2, 1 -> 3, 1 -> 4    0.60  ->  0.03-0.17   (1760 1->3 was 3%)
      2 -> 4, 4 -> 2            unchanged  (width is equal, only height moves)
      4 -> 1, 3 -> 1, 2 -> 1    0.49-0.61 -> 0.66-0.81  (wider: it IMPROVES)

    The asymmetry is the proof: it tracks WIDTH, not layout, and it never
    self-healed — identical at +2s and +17s, nine live ticks later.

    WIDTH ONLY. A height change is harmless (the 2<->4 row above), and re-
    fitting on one would throw the reader's view away for nothing.
  */
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    /* The Weigher opts out (Noah, 2026-08-30: "whenever i expand the price
       pane... it reverts me back to the original view. why is it forcing me
       to look back at a specific view?"): a wider pane keeps its bar spacing
       and simply shows more history. Terrain and Pulse keep the re-fit. */
    if (keepView) return;
    let lastWidth = el.clientWidth;
    let raf = 0;
    const obs = new ResizeObserver(entries => {
      const w = Math.round(entries[0]?.contentRect.width ?? 0);
      if (!w) return; // a pane being torn down reports 0 — re-fitting to it is meaningless
      widthRef.current = w;
      // 2%: a layout change is a third of the width or more; this is well clear
      // of sub-pixel reflow noise without needing to guess at a pixel count.
      if (Math.abs(w - lastWidth) < lastWidth * 0.02) return;
      lastWidth = w;
      // Coalesce: a drag fires this every frame, and setVisibleLogicalRange
      // mid-drag would fight the browser's own layout.
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (chartRef.current) showRecent();
      });
    });
    obs.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      obs.disconnect();
    };
  }, [showRecent, keepView]);

  /* HOLD STILL WHILE THE FRAME GLIDES (2026-09-06, the perf sweep): the
     sidebar folding resized this chart on every frame of its 300ms glide —
     three canvases re-allocated and the whole tape re-drawn eighteen times,
     the ribbon with it, 35–50ms a frame with two charts on the desk. For
     the glide the container pins to its panel's RIGHT edge, so the price axis
     and the latest bars stay exactly where they are while the panel grows or
     shrinks round it (the panel clips). AT THE WIDTH IT WILL HAVE when a host
     has promised one (core/glide.ts `promisedWidth` — the desk's tiles,
     2026-09-12): the one resize happens at the START and the tile's own glide
     reveals or covers the tape's left edge — nothing changes when the frame
     stops. With no promise, at the width it had, and the library's own
     observer takes the one resize when the glide ends. */
  useEffect(
    () =>
      onGlide(
        () => {
          const el = containerRef.current;
          if (!el) return;
          el.style.width = `${promisedWidth(el) ?? el.clientWidth}px`;
          el.style.left = 'auto';
        },
        () => {
          const el = containerRef.current;
          if (!el) return;
          el.style.width = '';
          el.style.left = '';
        }
      ),
    []
  );

  /*
    Keep enough whitespace ahead of the last bar that the time axis is labelled
    all the way to the right edge, at whatever zoom the reader is at.

    GROW-ONLY, and that is what stops it oscillating. `setData` on the runway
    can itself nudge the visible range, and a routine that recomputes a
    smaller number on the way back would sit in a loop shrinking and growing
    forever. It only ever extends, and rebuilds from scratch when a new bar
    forms and the anchor moves.

    The margin is a full screen's worth beyond the right edge, so dragging the
    scale does not outrun the labels between frames — the thing that would
    show up as ticks appearing a beat late.
  */
  /*
    The ceiling was 4000 and a reader found the end of it: at 2560px wide,
    fully zoomed out with the tape dragged off the left edge, the visible span
    was 5011 bars and the right fifth of the axis went unlabelled — the exact
    symptom the runway exists to remove. A cap is still needed (this is a
    runaway guard, not a budget), but it has to sit above any span a scale can
    actually reach: barSpacing bottoms out around 0.5, so a 4K-wide plot tops
    out near 8000 bars.
  */
  const RUNWAY_MAX = 12000;
  /** The runway grows by this many slots at a time — see ensureRunway. */
  const RUNWAY_STEP = 240;
  const ensureRunway = useCallback((lastTime: number, bucketSec: number) => {
    const chart = chartRef.current;
    const series = runwaySeriesRef.current;
    if (!chart || !series || !lastTime || bucketSec <= 0) return;

    const len = barCountRef.current;
    const range = chart.timeScale().getVisibleLogicalRange();
    const span = range ? Math.max(60, range.to - range.from) : 200;
    const reach = range ? range.to - (len - 1) : 0;
    const cur = runwayRef.current;
    /* GROWN IN CHUNKS (Noah, 2026-08-30, the mid-drag "buffer"): this runs
       on every visible-range change, i.e. every frame of a drag, and it used
       to grow the runway to EXACTLY the reach — so a rightward pan re-issued
       a setData of thousands of whitespace points frame after frame (a 67ms
       task measured inside a one-second drag). Rounded up to the next
       RUNWAY_STEP, the early return below holds for hundreds of frames. */
    const need = Math.max(120, Math.ceil(reach + span), cur.from === lastTime ? cur.slots : 0);
    const want = Math.min(RUNWAY_MAX, Math.ceil(need / RUNWAY_STEP) * RUNWAY_STEP);
    if (cur.from === lastTime && cur.slots >= want) return;

    const pts = [];
    for (let i = 1; i <= want; i++) pts.push({ time: (lastTime + i * bucketSec) as UTCTimestamp });
    series.setData(pts);
    runwayRef.current = { from: lastTime, slots: want };
  }, []);

  const resetView = useCallback(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.priceScale('right').applyOptions({ autoScale: true });
    showRecent();
  }, [showRecent]);

  /* The horizontal arm goes off while this chart is following another pane —
     a full crosshair reads as "your cursor is here", and it is not. Guarded so
     the option write only happens on a real change, not on every mousemove of
     whichever pane is leading. */
  const setFollower = useCallback((on: boolean) => {
    if (followerRef.current === on) return;
    followerRef.current = on;
    chartRef.current?.applyOptions({
      // The wheel belongs to the page when the page is the thing that scrolls.
      handleScroll: { mouseWheel: !pageScrollRef.current },
      handleScale: { mouseWheel: !pageScrollRef.current },
      crosshair: { horzLine: { visible: !on, labelVisible: !on } },
    });
  }, []);

  /*
    THE READOUT, BUILT FROM ONE PLACE — T-8.

    Both doors into it hand over a LOGICAL INDEX and nothing else: the pointer
    path has `param.logical`, and the sync path has already resolved the
    incoming time to this chart's own bar index (`idx` in applySync, floored to
    this pane's bucket so a 12:07 hover cannot land on a 15m neighbour's 12:15
    bar). Reading `param.seriesData` on one path and `dataByIndex` on the other
    would be two generators for one fact, and they would disagree exactly where
    it matters — on a followed pane, whose seriesData the event never carries.

    `dataByIndex` with no mismatch direction is an EXACT hit or null. A miss
    reports nothing rather than the nearest bar, because "the values at the
    moment you are pointing at" and "the values near it" are different claims.
  */
  const readoutAt = useCallback((idx: number | null | undefined): CrosshairBar | null => {
    const main = candleSeriesRef.current;
    if (main == null || idx == null) return null;
    /* Structural rather than by the library's data types: the main series is
       always handled as `ISeriesApi<'Candlestick'>` (see makeMain) whatever
       shape is really under it, so the declared return type is a candle even
       when the chart is drawing a line. Reading the fields that might be there
       and testing each one is the honest shape of that. */
    const d = main.dataByIndex(idx) as unknown as {
      time?: unknown; open?: unknown; high?: unknown; low?: unknown; close?: unknown; value?: unknown;
    } | null;
    if (!d || typeof d.time !== 'number') return null;
    const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
    /* A line/step/area/baseline tape carries `value`, a candle/bar tape
       `close`. Either is the close; neither being present means there is
       nothing to report and the row does not render at all. */
    const close = num(d.close) ?? num(d.value);
    if (close == null) return null;
    const volSeries = volumeSeriesRef.current;
    /* Asked of the SERIES, not of the `overlays` prop. The volume toggle hides
       the series rather than unmounting it, so its data reads back perfectly
       well while nothing is drawn — and a readout printing a figure the chart
       is not showing is exactly the kind of number this codebase keeps ruling
       out. One generator: whatever the toggle set is what is reported. */
    const volumeDrawn = volSeries?.options().visible !== false;
    const vol = volSeries?.dataByIndex(idx) as { value?: number } | null;
    const indicatorValues: CrosshairBar['indicators'] = [];
    for (const [id, series] of indicatorSeriesRef.current) {
      /* Map ids are `${key}:${part}` since T-4; the readout reports only the
         single-line overlays (READOUT_INDICATOR_KEYS says which and why). */
      const [key, part] = id.split(':') as [keyof ChartIndicators, string];
      if (part !== 'line' || !READOUT_INDICATOR_KEYS.has(key)) continue;
      const point = series.dataByIndex(idx) as { value?: number } | null;
      const v = num(point?.value);
      if (v != null) {
        indicatorValues.push({ key, ink: INDICATOR_INKS[key], value: v });
      }
    }
    return {
      time: d.time as UTCTimestamp,
      open: num(d.open),
      high: num(d.high),
      low: num(d.low),
      close,
      volume: volumeDrawn ? num(vol?.value) : null,
      indicators: indicatorValues,
    };
  }, []);

  /*
    DEDUPED, and that is what makes it safe to fire on model echoes.

    The library re-fires the crosshair handler on every `series.update()` while
    a crosshair is live — twice per series, and this chart updates candles,
    volume, indicators and compares on every 1500ms tick, so roughly ten fires
    a tick land on whichever pane is hovered. The sync path drops them all
    because a model echo is not a hover.

    The READOUT cannot drop them: the bar under the pointer is usually the live
    one, and ignoring its updates leaves a wrong price on screen for as long as
    the reader holds still. So the echoes are honoured and the PAYLOAD is
    compared instead — about one real change a tick gets through and the other
    nine cost a string compare rather than a render.
  */
  const emitReadout = useCallback((bar: CrosshairBar | null) => {
    const sig = bar
      ? `${bar.time}|${bar.open}|${bar.high}|${bar.low}|${bar.close}|${bar.volume}|${bar.indicators
          .map(i => `${i.key}:${i.value}`)
          .join(',')}`
      : '';
    if (sig === readoutSigRef.current) return;
    readoutSigRef.current = sig;
    onReadoutRef.current?.(bar);
  }, []);

  /* Mark a moment that belongs to ANOTHER pane. TIME ONLY, and that is forced
     rather than chosen: setCrosshairPosition demands a price, but crosshair
     mode defaults to Magnet and this chart never overrides it, so the magnet
     throws the price away and snaps to the RECEIVING chart's own close. No
     price can cross a pane boundary here — which is right, since two panes are
     usually two symbols. The horizontal arm goes off while this chart is a
     follower: a full crosshair reads as "your cursor is here", and it is not.

     Reads only refs, so the empty dep list is honest and the mount effect can
     list it without churn. */
  const applySync = useCallback((time: UTCTimestamp | null) => {
    const chart = chartRef.current;
    const series = candleSeriesRef.current;
    if (!chart || !series) return;
    syncedRef.current = time;
    const price = lastCloseRef.current;
    /* Not a nicety: setCrosshairPosition on a series whose price scale has no
       first value throws. Terrain boots through a splash and panes reload on
       every ticker and timeframe change, so this window is real. lastCloseRef
       is written from the same bars that feed setData. */
    if (time === null || price == null) {
      chart.clearCrosshairPosition();
      setFollower(false);
      emitReadout(null);
      return;
    }
    /* THIS chart's bucket, FLOORED — the bar the moment is inside of. The
       library's own lookup rounds UP, so a 12:07 hover would land on a 15m
       neighbour's 12:15 bar: one that had not happened at 12:07. Same formula
       aggregateCandles uses, so the result is an exact grid hit or nothing. */
    const bucket = Math.max(60, tfMinutes(timeframeRef.current) * 60);
    const target = (Math.floor(time / bucket) * bucket) as UTCTimestamp;
    const ts = chart.timeScale();
    const idx = ts.timeToIndex(target, false); // exact hit or null — never nearest
    const vis = ts.getVisibleLogicalRange();
    /* Outside this chart's data, or outside what it is currently showing, draw
       NOTHING. setCrosshairPosition clamps the index to the visible range and
       would otherwise print a confident mark on the wrong bar. Panes here pan
       and zoom independently, so this is the common case. */
    if (idx === null || vis === null || idx < vis.from || idx > vis.to) {
      chart.clearCrosshairPosition();
      setFollower(false);
      /* This pane has no bar at that moment, or is not showing it. It draws
         nothing, so it reports nothing — a readout beside a blank crosshair
         would be values with no mark to attach them to. */
      emitReadout(null);
      return;
    }
    setFollower(true);
    chart.setCrosshairPosition(price, target, series);
    /* THE FOLLOWER'S OWN VALUES, at the bar this pane resolved the moment to —
       which is the whole point of T-8 on a synced desk. `setCrosshairPosition`
       never fires the crosshair event (it skips it internally), so nothing
       else here would ever report them. */
    emitReadout(readoutAt(idx));
  }, [setFollower, readoutAt, emitReadout]);

  /* One datum mapper for every main-series write: OHLC styles get whole
     bars, value styles get closes. Typed `never` so the same call sites
     feed whichever series the style built (the ref stays nominally
     'Candlestick'; the payload is always correct for the REAL series). */
  const toMain = useCallback(
    (b: Candle) =>
      (OHLC_STYLES.has(styleRef.current)
        ? toCandle(b)
        : { time: b.time as UTCTimestamp, value: b.close }) as never,
    []
  );

  // Widen the visible price range to always include the walls/supreme so several
  // strike-node bands are on screen, not just the couple around spot — and
  // the FOCUS strike, when one is set (a strike sent here to be SEEN
  // cannot be off-screen; Noah, 2026-08-22).
  const autoscaleProvider = useCallback(
    /* `priceRange` is NULLABLE in the library and the annotation the partner
       tree still carries says it is not, so tsc blesses
       `base?.priceRange.minValue` — which throws the moment the view holds no
       candles at all. Terrain makes that state reachable: the runway extends
       the time axis past the last bar, so a pan into the open room ahead — or
       the reload moment of a timeframe swap — hands this provider
       `{ priceRange: null }` and the whole pane goes down as "Cannot read
       properties of null (reading 'minValue')" (Noah, 2026-08-25). Ours, kept
       through the port; it is still unfixed on his side. */
    (original: () => { priceRange: { minValue: number; maxValue: number } | null } | null) => {
      const base = original();
      const lv = levelsRef.current;
      const extras = [lv.putWall, lv.callWall, lv.supreme, lv.spot, focusPriceRef.current ?? NaN].filter(v =>
        Number.isFinite(v)
      );
      const range = base?.priceRange ?? null;
      // Nothing to scale by at all — let the library keep its own answer
      if (range === null && extras.length === 0) return base;
      let min = range ? range.minValue : Math.min(...extras);
      let max = range ? range.maxValue : Math.max(...extras);
      for (const v of extras) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
      const pad = Math.max((max - min) * 0.08, 0.01);
      return { priceRange: { minValue: min - pad, maxValue: max + pad } };
    },
    []
  );

  /* Build the main series for a style. Always returned as the nominal
     'Candlestick' handle — every consumer routes data through toMain and
     hangs price lines, which every series type supports. */
  const makeMain = useCallback(
    (chart: IChartApi, style: ChartStyle, t: CandleTheme): ISeriesApi<'Candlestick'> => {
      const base = {
        priceLineVisible: true,
        priceLineColor: 'rgba(237,237,237,0.4)',
        priceLineStyle: LineStyle.Dotted,
        autoscaleInfoProvider: autoscaleProvider,
      };
      let s: ISeriesApi<SeriesType>;
      switch (style) {
        case 'hollow': {
          // Up bodies filled with the surface = hollow; down bodies solid
          const surface = chartSurface(t).bg;
          s = chart.addSeries(CandlestickSeries, {
            ...candleSeriesOptions(t),
            upColor: surface === 'transparent' ? 'rgba(0,0,0,0)' : surface,
            borderUpColor: t.borderUp ?? t.up,
            wickUpColor: t.wickUp,
            ...base,
          });
          break;
        }
        case 'bars':
          s = chart.addSeries(BarSeries, { upColor: t.up, downColor: t.down, thinBars: false, ...base });
          break;
        case 'line':
          s = chart.addSeries(LineSeries, { color: t.up, lineWidth: 2, ...base });
          break;
        case 'step':
          s = chart.addSeries(LineSeries, { color: t.up, lineWidth: 2, lineType: LineType.WithSteps, ...base });
          break;
        case 'area':
          s = chart.addSeries(AreaSeries, {
            lineColor: t.up,
            lineWidth: 2,
            topColor: `${t.up}40`,
            bottomColor: `${t.up}05`,
            ...base,
          });
          break;
        case 'baseline':
          // Above/below the session open IS a price-direction read → the
          // house bull/bear pair (the one style allowed to speak it)
          s = chart.addSeries(BaselineSeries, {
            topLineColor: '#30D158',
            topFillColor1: 'rgba(48,209,88,0.20)',
            topFillColor2: 'rgba(48,209,88,0.02)',
            bottomLineColor: '#FF3B30',
            bottomFillColor1: 'rgba(255,59,48,0.02)',
            bottomFillColor2: 'rgba(255,59,48,0.20)',
            lineWidth: 2,
            ...base,
          });
          break;
        default:
          s = chart.addSeries(CandlestickSeries, { ...candleSeriesOptions(t), ...base });
      }
      return s as ISeriesApi<'Candlestick'>;
    },
    [autoscaleProvider]
  );

  // Mount once
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const s0 = chartSurface(getCandleTheme());
    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { color: s0.bg },
        // #7d7d7d on the dark family (matches textMuted, lifted 2026-07-25 for
        // legibility); its dark cut on a light ground (chartSurface)
        textColor: s0.text,
        fontFamily: "'SF Pro', sans-serif",
        // 9 on a phone. lightweight-charts sizes the price gutter from its
        // widest label, so this is what actually buys the tape its width back.
        fontSize: compactRef.current ? 9 : 10,
        attributionLogo: true,
      },
      // The reader's clock, not Greenwich's — see chartTime.ts.
      localization: LOCAL_TIME,
      // No grid (Noah, 2026-08-22): the nodes and the levels ARE the
      // structure; a grid behind them competes with the ribbons
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      // The live-price capsule REPLACES the series' own last-value label and is
      // 68px wide at `right-1` (see the priceTag element below). The gutter is
      // sized from its widest tick label — 54px — so the capsule stood 18px on
      // the plot, on top of the strip where lightweight-charts flush-rights its
      // price-line titles, and ate the date off every dark-pool print near spot.
      // 68 + 4 + 2 clear. Charts without the capsule keep the default 0.
      rightPriceScale: { borderColor: s0.line, minimumWidth: priceTag ? PRICE_SCALE_MIN_WIDTH : 0 },
      timeScale: { borderColor: s0.line, timeVisible: true, secondsVisible: false, rightOffset: 6, barSpacing: 7, tickMarkFormatter: localTickMarks },
      crosshair: {
        vertLine: { color: s0.crosshair, labelBackgroundColor: s0.label },
        horzLine: { color: s0.crosshair, labelBackgroundColor: s0.label },
      },
    });

    const candles = makeMain(chart, styleRef.current, getCandleTheme());
    styleBuiltRef.current = styleRef.current;

    const volume = chart.addSeries(HistogramSeries, {
      priceScaleId: 'vol',
      priceFormat: { type: 'volume' },
      lastValueVisible: false,
      priceLineVisible: false,
    });

    /* Its own price scale, so an empty series cannot drag the tape's autoscale
       around, and every visible affordance off. */
    const runway = chart.addSeries(LineSeries, {
      priceScaleId: 'runway',
      visible: false,
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    });
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.84, bottom: 0 } });

    const trails = new GexTrailsPrimitive();
    candles.attachPrimitive(trails);
    /* Dev only: the perf probes read each chart's visible range and loaded
       bar count off `window.__charts` (the axis is canvas, not DOM). */
    const devCharts = import.meta.env?.DEV ? ((window as unknown as { __charts?: Set<unknown> }).__charts ??= new Set()) : null;
    const devEntry = {
      chart,
      candles,
      host: container,
      state: () => ({ held: recentHeldRef.current, full: fullWorldRef.current, world: worldKeyRef.current }),
    };
    devCharts?.add(devEntry);
    const drawingsPrim = new DrawingsPrimitive();
    candles.attachPrimitive(drawingsPrim);
    /* T-6's session rules. Attached with the series like the two above, so it
       lives as long as the chart does; what it draws is swapped by the
       session effect. It renders at `bottom`, under the tape — the day's
       furniture, not the subject. */
    const sessionPrim = new SessionLevelsPrimitive();
    candles.attachPrimitive(sessionPrim);

    /* T-9's cone, run exactly the same way. */
    const conePrim = new ExpectedMovePrimitive();
    candles.attachPrimitive(conePrim);

    /* T-11's event lane. */
    const eventsPrim = new EventsPrimitive();
    candles.attachPrimitive(eventsPrim);

    /* Zooming out reaches past the runway's end; extend it as they go. The
       handler reads refs rather than closing over the bar time, so it is
       installed once with the chart and never re-subscribed. */
    const onRange = () => {
      ensureRunway(lastBarTimeRef.current, bucketSecRef.current);
      /* THE HISTORY ARRIVES WHEN THE READER SCROLLS TO IT (2026-09-06, the
         perf sweep): only the recent bars are loaded on open; reaching the
         left edge of them asks for the whole store, once per world. */
      if (recentHeldRef.current) {
        const r = chart.timeScale().getVisibleLogicalRange();
        if (r && r.from < FULL_TRIGGER && r.to - r.from > 10) {
          recentHeldRef.current = false;
          fullWorldRef.current = worldKeyRef.current;
          setFullNonce(n => n + 1);
        }
      }
      /* A synthetic crosshair is anchored to a PIXEL, not to a time: the model
         re-derives its bar from the saved x on the next update, so panning this
         pane slides someone else's mark onto a different bar without a word.
         Re-apply from the time we were actually told. applySync touches only
         the crosshair, so this cannot recurse. */
      if (syncedRef.current !== null) applySync(syncedRef.current);
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(onRange);

    /*
      HOVER, OUT — and only REAL hover.

      The library re-fires this handler on every model update while a crosshair
      is live, twice per series.update(); this chart updates candles, volume,
      indicators and compares on every 1500ms tick. Left unfiltered, a follower
      pane's own tick would look like a hover and it would broadcast straight
      back. Only pointer-driven fires carry `sourceEvent`, and a pointer LEAVING
      carries neither `point` nor `sourceEvent`. setCrosshairPosition itself
      never reaches here at all — it skips the event internally — so the fan-out
      cannot reflect even once.
    */
    const onCross = (param: MouseEventParams<Time>) => {
      if (!param.point) {              // the pointer left the plot
        onCrosshairRef.current?.(null);
        emitReadout(null);
        return;
      }
      /*
        THE ECHO FILTER APPLIES TO THE SYNC, NOT TO THE READOUT.

        It used to be a bare early return, which was right while the moment was
        the only thing this handler produced. The readout has the opposite
        requirement: the bar under the pointer is usually the LIVE one, so the
        updates that arrive without a `sourceEvent` are precisely the ones that
        keep its close honest while the reader holds still. `emitReadout`
        dedupes by payload, so honouring them costs a string compare.
      */
      if (param.sourceEvent) {
        // This pane owns its crosshair again — give the horizontal arm back.
        syncedRef.current = null;
        setFollower(false);
        onCrosshairRef.current?.(typeof param.time === 'number' ? (param.time as UTCTimestamp) : null);
      }
      emitReadout(readoutAt(param.logical));
    };
    chart.subscribeCrosshairMove(onCross);
    syncRegisterRef.current?.(applySync);

    chartRef.current = chart;
    candleSeriesRef.current = candles;
    volumeSeriesRef.current = volume;
    /* Dev-only handle for the house probes (scripts/*-proof.mjs read the
       visible range through it to catch a tick fighting a drag). Stripped
       from production builds by the env guard. */
    if (import.meta.env.DEV) {
      const dev = container as unknown as { __chart?: IChartApi; __series?: unknown };
      dev.__chart = chart;
      dev.__series = candles; // the probes read the visible PRICE range through it
    }
    runwaySeriesRef.current = runway;
    trailsRef.current = trails;
    drawingsRef.current = drawingsPrim;
    sessionPrimRef.current = sessionPrim;
    conePrimRef.current = conePrim;
    eventsPrimRef.current = eventsPrim;

    /* Reads candleSeriesRef rather than closing over `candles`: the style swap
       removes and replaces the main series in place, and a captured series
       would leave the neighbour projecting against a dead one. */
    if (projectionRef) {
      projectionRef.current = {
        yFor: price => candleSeriesRef.current?.priceToCoordinate(price) ?? null,
        plotHeight: () => chart.paneSize(0).height,
        axisHeight: () => chart.timeScale().height(),
      };
    }

    /*
      T-23 — THE EXPORTER. takeScreenshot captures every canvas layer the
      pane draws — candles, levels, drawings, the cone, the event lane — at
      device resolution. The frame adds what a shared image needs and the
      live pane does not: whose chart this is (ticker · interval · when) and
      whose terminal drew it. Reads refs at CALL time, so the header names
      what is on screen at the click, not at mount.
    */
    if (exportRef) {
      exportRef.current = () => {
        const c = chartRef.current;
        if (!c) return;
        const shot = c.takeScreenshot();
        const scale = Math.max(1, Math.round(shot.width / Math.max(1, containerRef.current?.clientWidth ?? shot.width)));
        const pad = 30 * scale;
        const out = document.createElement('canvas');
        out.width = shot.width;
        out.height = shot.height + pad;
        const g = out.getContext('2d');
        if (!g) return;
        g.fillStyle = '#0a0a0a';
        g.fillRect(0, 0, out.width, out.height);
        const stampIso = new Date().toISOString();
        const stamp = `${stampIso.slice(0, 10)} ${stampIso.slice(11, 16)}Z`;
        g.font = `600 ${11 * scale}px ui-monospace, SFMono-Regular, Menlo, monospace`;
        g.textBaseline = 'middle';
        g.fillStyle = 'rgba(255,255,255,0.85)';
        g.fillText(`${ticker} · ${timeframeRef.current}`, 10 * scale, pad / 2);
        const right = `${stamp} · SLAYER TERMINAL`;
        g.fillStyle = 'rgba(255,255,255,0.4)';
        g.fillText(right, out.width - g.measureText(right).width - 10 * scale, pad / 2);
        g.drawImage(shot, 0, pad);
        /* The in-plot watermark — faint, corner, the free distribution the
           directive wants from every shared screenshot. */
        g.font = `600 ${10 * scale}px ui-monospace, SFMono-Regular, Menlo, monospace`;
        g.fillStyle = 'rgba(255,255,255,0.28)';
        g.fillText('slayer_terminal', 10 * scale, out.height - 12 * scale);
        out.toBlob(blob => {
          if (!blob) return;
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `${ticker}-${timeframeRef.current}-${stampIso.slice(0, 16).replace(/[-T:]/g, '')}.png`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        });
      };
    }

    /* THE FRAME BELONGS TO THE USER AFTER FIRST TOUCH (ported from
       CampaignChart, 2026-08-30 — Noah: dragging/zooming had "this thing
       thats fighting my cursor... its like its ignoring me completely").
       The library only suspends price autoscale on an AXIS drag; a wheel
       zoom or a pan keeps it on, so every 1s tick re-fit the price scale
       and undid the reader's hand. First wheel/pointer on the chart
       freezes the scale outright. The way back: resetView (the pill,
       right-click card, Alt+R, dbl-click) or a new world re-engages. */
    const freezeScale = () => chart.priceScale('right').applyOptions({ autoScale: false });
    container.addEventListener('wheel', freezeScale, { passive: true });
    container.addEventListener('pointerdown', freezeScale);

    return () => {
      /* keepView: remember where the reader was before this instance dies —
         the Weigher's fullscreen takeover portals the chart to <body>, which
         is a remount, and the new instance restores this (see the data
         effect's new-world branch). Bar spacing + scroll position, not the
         logical range: a wider pane then shows MORE bars, not stretched ones. */
      if (keepViewRef.current) {
        const w = loadedRef.current;
        const ts = chart.timeScale();
        KEPT_VIEWS.set(`${w.ticker}|${w.timeframe}|${w.clock}`, { barSpacing: ts.options().barSpacing, scroll: ts.scrollPosition() });
      }
      container.removeEventListener('wheel', freezeScale);
      container.removeEventListener('pointerdown', freezeScale);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRange);
      chart.unsubscribeCrosshairMove(onCross);
      devCharts?.delete(devEntry);
      syncRegisterRef.current?.(null);
      syncedRef.current = null;
      if (projectionRef) projectionRef.current = null;
      if (exportRef) exportRef.current = null;
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      flowCallsRef.current = null;
      flowPutsRef.current = null;
      driftCallsRef.current = null;
      driftPutsRef.current = null;
      rvRef.current = null;
      ivRef.current = null;
      runwaySeriesRef.current = null;
      runwayRef.current = { from: 0, slots: 0 };
      trailsRef.current = null;
      drawingsRef.current = null;
      sessionPrimRef.current = null;
      conePrimRef.current = null;
      eventsPrimRef.current = null;
      compareSeriesRef.current.clear();
      compareLoadedRef.current = '';
      indicatorSeriesRef.current.clear();
      indicatorLoadedRef.current = '';
      styleBuiltRef.current = null;
      printLinesRef.current = [];
      levelLinesRef.current = {};
      shownLevelsRef.current = null;
      cancelAnimationFrame(levelRafRef.current);
      loadedRef.current = { ticker: '', timeframe: '1m', theme: '', clock: 'time', full: false };
    };
    // ensureRunway and applySync are stable useCallback([])s — listed so the
    // subscriptions installed here are never reading a stale one.
  }, [makeMain, ensureRunway, applySync, setFollower, projectionRef, readoutAt, emitReadout]);

  /* Style swap (Noah, 2026-08-23): replace ONLY the main series in place —
     price lines and primitives die with the old one, so the nonce tells the
     level/focus/print/data effects to re-hang everything on the new series.
     Pan/zoom survives; the tape reloads on the next pass of the data
     effect. */
  useEffect(() => {
    const chart = chartRef.current;
    const prev = candleSeriesRef.current;
    if (!chart || !prev) return;
    if (styleBuiltRef.current === chartStyle) return;
    const trails = trailsRef.current;
    const drawingsPrim = drawingsRef.current;
    const sessionPrim = sessionPrimRef.current;
    const conePrim = conePrimRef.current;
    chart.removeSeries(prev);
    const next = makeMain(chart, chartStyle, getCandleTheme());
    if (trails) next.attachPrimitive(trails);
    if (drawingsPrim) next.attachPrimitive(drawingsPrim);
    /* A style swap replaces the SERIES, and a primitive is attached to the
       series rather than to the chart — miss this and the session rules
       vanish the first time the reader picks a line chart, with no error and
       nothing to see. `mainNonce` then makes the session effect refill it. */
    if (sessionPrim) next.attachPrimitive(sessionPrim);
    if (conePrim) next.attachPrimitive(conePrim);
    if (eventsPrimRef.current) next.attachPrimitive(eventsPrimRef.current);
    candleSeriesRef.current = next;
    styleBuiltRef.current = chartStyle;
    levelLinesRef.current = {};
    shownLevelsRef.current = null;
    focusLineRef.current = null;
    printLinesRef.current = [];
    /* Force the data effect to re-setData() onto the new series, but ONLY by
       blanking the theme: a style swap is a REDRAW, not a new world. Blanking
       ticker/timeframe also sets `newWorld`, and that calls showRecent() —
       the reader's pan/zoom thrown away for a change of shape. This is the
       same lane a candle-theme swap already takes. */
    loadedRef.current = { ...loadedRef.current, theme: '' };
    setMainNonce(n => n + 1);
  }, [chartStyle, makeMain]);

  // Volume overlay toggle — series stays mounted, just hides
  useEffect(() => {
    volumeSeriesRef.current?.applyOptions({ visible: overlays.volume });
  }, [overlays.volume]);

  /*
    THE LAST PANE ANY PRODUCT OCCUPIES, or 0 when none of them are open.

    Three optional panes open and close in any order, so "the pane below the
    products" cannot be a constant and cannot be read off any one of them.
    Every product series is asked where it actually is and the deepest answer
    wins; with none open the answer is the tape's own pane, and the caller's
    +1 puts the compare band directly under it — the behaviour before any of
    these panes existed.
  */
  const lastProductPaneIndex = useCallback(() => {
    let deepest = 0;
    for (const s of [flowCallsRef.current, driftCallsRef.current, rvRef.current] as const) {
      if (!s) continue;
      try {
        const i = s.getPane().paneIndex();
        if (Number.isFinite(i) && i > deepest) deepest = i;
      } catch {
        /* a series mid-teardown has no pane to report */
      }
    }
    return deepest;
  }, []);

  /*
    WHERE EVERY PRODUCT PANE'S NAME CHIP GOES, measured in one pass.

    Each product effect calls this when it finishes, and it re-measures ALL of
    them rather than only its own — which is the point. Turning the drift pane
    on moves the flow band up by the drift pane's height, so a chip that only
    moved when its own effect ran would be left floating over its neighbour.

    Walking up from the container's bottom: the time axis first, then every
    pane at or below this one. The chip is then dropped just inside that pane's
    top edge, INSIDE the band rather than on its separator.

    The result is compared before it is stored. The flow effect re-runs on every
    tick of the tape, and handing React a fresh array each time would re-render
    the whole chart shell per tick for a set of numbers that had not changed.
  */
  const remeasurePaneLabels = useCallback(() => {
    const chart = chartRef.current;
    const wanted: { key: string; series: ISeriesApi<'Histogram'> | ISeriesApi<'Line'> | null }[] = [
      { key: 'flow', series: flowCallsRef.current },
      { key: 'netDrift', series: driftCallsRef.current },
      { key: 'volDrift', series: rvRef.current },
    ];
    let next: { key: string; bottom: number }[] = [];
    if (chart) {
      try {
        const panes = chart.panes();
        const heights = panes.map(pane => pane.getHeight());
        const axisH = chart.timeScale().height();
        for (const w of wanted) {
          if (!w.series) continue;
          const idx = w.series.getPane().paneIndex();
          /* Pane 0 is the tape. A product series that somehow landed there has
             no band of its own to label. */
          if (idx <= 0 || idx >= heights.length) continue;
          /* A band collapsed to a sliver has no room for a chip, and one drawn
             anyway would sit over the pane above it. */
          if (heights[idx] <= 8) continue;
          let up = axisH;
          for (let j = idx; j < heights.length; j++) up += heights[j];
          next.push({ key: w.key, bottom: up - PANE_LABEL_H - PANE_LABEL_INSET });
        }
      } catch {
        /* the chart is mid-teardown; no chips rather than a thrown render */
        next = [];
      }
    }
    setPaneLabels(prev =>
      prev.length === next.length && prev.every((p, i) => p.key === next[i].key && p.bottom === next[i].bottom)
        ? prev
        : next
    );
  }, []);

  /*
    THE FLOW BAND: Trace's premium, in this chart's own buckets.

    Rebuilt whenever the tape grows, the timeframe changes or the symbol
    changes. `bucketFlow` does the summing and is proved separately
    (scripts/flow-bars-proof.ts); this only decides ink and sign.

    Puts are NEGATED here rather than in the bucketer, which hands back two
    magnitudes. Which leg hangs below the axis is a drawing decision, and a
    module that answers "how much traded" should not be the one making it.
  */
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    /*
      THE BAND IS BUILT ON DEMAND AND TORN DOWN WHEN IT IS OFF.

      The first cut created the pane at mount and collapsed it to 1px when the
      overlay was off. That looked equivalent and was not: a second pane adds a
      SEPARATOR, and the time axis grew 26px -> 30px for every chart in the app,
      including charts whose reader never turns flow on. The desk's floating
      chrome clears a hard-coded 26px, so it started landing on the axis — which
      is exactly what `scripts/ui-sweep.mjs` asserts, and it failed there.

      Removing the series removes the pane, so a chart with flow off is the
      chart that existed before this feature. A toggle nobody touches costs
      nothing.
    */
    if (!overlays.flow || altSpec) {
      const oldCalls = flowCallsRef.current;
      const oldPuts = flowPutsRef.current;
      /* Refs cleared BEFORE the removals, not after: removing a series can
         throw on a chart that is already tearing down, and a ref still holding
         a destroyed series is one the label measurer would ask for a pane. */
      flowCallsRef.current = null;
      flowPutsRef.current = null;
      try {
        if (oldCalls) chart.removeSeries(oldCalls);
        if (oldPuts) chart.removeSeries(oldPuts);
      } catch {
        /* already gone */
      }
      remeasurePaneLabels();
      return;
    }

    let calls = flowCallsRef.current;
    let puts = flowPutsRef.current;
    if (!calls || !puts) {
      /* APPENDED, never a fixed index. Compare-in-pane mode may already own a
         pane, and hard-coding 1 is how two features end up in the same band. */
      const opts = {
        priceFormat: { type: 'volume' as const },
        lastValueVisible: false,
        priceLineVisible: false,
        base: 0,
      };
      const paneIndex = chart.panes().length;
      calls = chart.addSeries(HistogramSeries, opts, paneIndex);
      puts = chart.addSeries(HistogramSeries, opts, paneIndex);
      flowCallsRef.current = calls;
      flowPutsRef.current = puts;
      try {
        chart.panes()[0]?.setStretchFactor(PRICE_STRETCH);
        calls.getPane().setStretchFactor(FLOW_STRETCH);
      } catch {
        /* pane sizing is a nicety; never lose the chart over it */
      }
    }

    const barSec = tfMinutes(timeframe) * 60;
    const bars = bucketFlow(flowPrints ?? [], { barSec, ticker });

    calls.setData(
      bars
        .filter(b => b.callPrem > 0)
        .map(b => ({ time: b.time as UTCTimestamp, value: b.callPrem, color: FLOW_CALL_INK }))
    );
    puts.setData(
      bars
        .filter(b => b.putPrem > 0)
        .map(b => ({ time: b.time as UTCTimestamp, value: -b.putPrem, color: FLOW_PUT_INK }))
    );

    /*
      ONE SCALE ACROSS BOTH LEGS, and symmetric about zero.

      Left to autoscale, lightweight-charts fits each series to its own extent,
      so a $10k call bucket would be drawn exactly as tall as a $10M put bucket
      and the zero line would wander off centre. The heaviest leg anywhere sets
      both halves.
    */
    const max = flowMaxLeg(bars);
    if (max > 0) {
      const range = () => ({ priceRange: { minValue: -max, maxValue: max } });
      calls.applyOptions({ autoscaleInfoProvider: range });
      puts.applyOptions({ autoscaleInfoProvider: range });
    }

    remeasurePaneLabels();
  }, [overlays.flow, flowPrints, timeframe, ticker, themeKey, remeasurePaneLabels, altSpec]);

  /*
    THE NET DRIFT: the same premium the flow band bars, kept as a running total.

    Two LINES, not a histogram, and they share the flow legs' inks because they
    are the flow legs' numbers. The gap between them is the session's lean; the
    slope of each is where money is arriving right now.

    `cumulativeDrift` does the summing and is proved separately
    (scripts/drift-series-proof.ts); this only decides ink, scale and the pane.
  */
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    /* Built on demand and torn down when off — the flow band's rule, and for
       the same measured reason: a pane that is always present adds a separator
       and grows the time axis for every chart in the app, including charts
       whose reader never turns this on. */
    if (!overlays.netDrift || altSpec) {
      const oldCalls = driftCallsRef.current;
      const oldPuts = driftPutsRef.current;
      driftCallsRef.current = null;
      driftPutsRef.current = null;
      try {
        if (oldCalls) chart.removeSeries(oldCalls);
        if (oldPuts) chart.removeSeries(oldPuts);
      } catch {
        /* already gone */
      }
      remeasurePaneLabels();
      return;
    }

    let calls = driftCallsRef.current;
    let puts = driftPutsRef.current;
    if (!calls || !puts) {
      /* APPENDED, never a fixed index — three optional panes can be open in any
         combination, and hard-coding one is how two of them end up sharing a
         scale that belongs to neither. */
      const paneIndex = chart.panes().length;
      const opts = {
        lineWidth: 2 as const,
        priceFormat: { type: 'volume' as const },
        lastValueVisible: true,
        priceLineVisible: false,
        crosshairMarkerVisible: false,
      };
      calls = chart.addSeries(LineSeries, { ...opts, color: DRIFT_CALL_INK, title: 'Calls' }, paneIndex);
      puts = chart.addSeries(LineSeries, { ...opts, color: DRIFT_PUT_INK, title: 'Puts' }, paneIndex);
      driftCallsRef.current = calls;
      driftPutsRef.current = puts;
      try {
        chart.panes()[0]?.setStretchFactor(PRICE_STRETCH);
        calls.getPane().setStretchFactor(FLOW_STRETCH);
      } catch {
        /* pane sizing is a nicety; never lose the chart over it */
      }
    }

    const barSec = tfMinutes(timeframe) * 60;
    const points = cumulativeDrift(flowPrints ?? [], { barSec, ticker });
    calls.setData(points.map(p => ({ time: p.time as UTCTimestamp, value: p.calls })));
    puts.setData(points.map(p => ({ time: p.time as UTCTimestamp, value: p.puts })));

    /*
      ONE SCALE ACROSS BOTH LINES, anchored at zero.

      Left to autoscale, lightweight-charts fits each series to its own extent,
      so a session where calls took $50M and puts took $2M would draw the two
      lines at the same height and hide the entire story. Both are cumulative
      dollars — the same unit — so they share one range, and the range starts at
      zero because a running total that starts mid-axis exaggerates every wiggle
      in it.
    */
    const peak = driftPeak(points);
    if (peak > 0) {
      const range = () => ({ priceRange: { minValue: 0, maxValue: peak * 1.05 } });
      calls.applyOptions({ autoscaleInfoProvider: range });
      puts.applyOptions({ autoscaleInfoProvider: range });
    }

    remeasurePaneLabels();
  }, [overlays.netDrift, flowPrints, timeframe, ticker, themeKey, remeasurePaneLabels, altSpec]);

  /*
    THE VOLATILITY DRIFT: what the underlying is doing against what the option
    market says it expects.

    Realised is MEASURED from the same aggregated bars the tape draws, so the
    two agree on every timeframe. Implied is REPORTED by the feed and drawn as
    it arrives — see data/volDrift.ts for why the implied line is currently
    flat and why nothing here invents movement for it.
  */
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    /* Frozen during replay, like the compares and the indicators: the vol lines
       are computed off live bars, and letting them run forward while the tape
       is rewound would put two different clocks in one window. */
    if (replayRef.current) return;

    if (!overlays.volDrift || altSpec) {
      const oldRv = rvRef.current;
      const oldIv = ivRef.current;
      rvRef.current = null;
      ivRef.current = null;
      try {
        if (oldRv) chart.removeSeries(oldRv);
        if (oldIv) chart.removeSeries(oldIv);
      } catch {
        /* already gone */
      }
      remeasurePaneLabels();
      return;
    }

    let rv = rvRef.current;
    let iv = ivRef.current;
    if (!rv || !iv) {
      const paneIndex = chart.panes().length;
      const opts = {
        lineWidth: 1 as const,
        priceFormat: { type: 'custom' as const, formatter: (v: number) => `${v.toFixed(2)}%`, minMove: 0.01 },
        lastValueVisible: true,
        priceLineVisible: false,
        crosshairMarkerVisible: false,
      };
      rv = chart.addSeries(LineSeries, { ...opts, color: RV_INK, title: 'RV' }, paneIndex);
      iv = chart.addSeries(LineSeries, { ...opts, color: IV_INK, title: 'IV' }, paneIndex);
      rvRef.current = rv;
      ivRef.current = iv;
      try {
        chart.panes()[0]?.setStretchFactor(PRICE_STRETCH);
        rv.getPane().setStretchFactor(FLOW_STRETCH);
      } catch {
        /* pane sizing is a nicety; never lose the chart over it */
      }
    }

    const mins = tfMinutes(timeframe);
    const bars = displayBars(ticker, mins);
    const rvPoints = realizedVol(bars, mins * 60);
    /* The implied line is drawn only where realised is, so the pane never shows
       a lone flat line hanging over an empty half — the two are read as a PAIR,
       and a spread against nothing is not a spread. */
    const ivPoints = impliedVolLine(Simulator.TICKERS[ticker]?.iv, rvPoints);
    rv.setData(rvPoints.map(p => ({ time: p.time as UTCTimestamp, value: p.value })));
    iv.setData(ivPoints.map(p => ({ time: p.time as UTCTimestamp, value: p.value })));

    /*
      ONE SCALE, FROM ZERO. Both lines are percent, and the distance between
      them is the whole reading — two independently autoscaled lines would put
      realised and implied on top of each other whatever the spread actually
      was, which is the one thing this pane exists to show.
    */
    const ceiling = volCeiling(rvPoints, ivPoints);
    if (ceiling > 0) {
      const range = () => ({ priceRange: { minValue: 0, maxValue: ceiling } });
      rv.applyOptions({ autoscaleInfoProvider: range });
      iv.applyOptions({ autoscaleInfoProvider: range });
    }

    remeasurePaneLabels();
  }, [overlays.volDrift, revision, timeframe, ticker, themeKey, remeasurePaneLabels, altSpec]);

  /*
    THE INDICATOR SET — T-3/T-4 (grown from Noah's EMA/VWAP pair,
    2026-08-23). Everything is computed from the SAME aggregated bars the
    tape draws, in data/indicators.ts, so a strip summarising these lines
    cannot disagree with them. Full rebuild when the set or the world
    changes; per revision only the last point is pushed.

    SUB-PANES are lightweight-charts' native panes, allocated AFTER the
    compare pane when one is up (compares hold pane 1 by an older contract):
    the first active sub-indicator in SUB_PANE_ORDER takes the base index,
    the second the next. The third is REFUSED — the cap is enforced in the
    menu and again here, so a hand-edited setup cannot shrink the tape below
    its floor. Stretch factors put roughly two thirds of the height on the
    tape and split the rest.

    WARMUP NULLS map to WHITESPACE points — a gap on the left edge where the
    window does not exist yet, never a zero.
  */
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    if (replayRef.current) return; // frozen during replay, like compares
    const mins = tfMinutes(timeframe);
    const allKeys = Object.keys(INDICATOR_PARTS) as (keyof ChartIndicators)[];
    const subsActive = SUB_PANE_ORDER.filter(k => indicators[k]).slice(0, MAX_SUB_PANES);
    /* On a rule clock the session-anchored pair is out: vwapSeries cuts
       sessions by comparing bar gaps against the bar interval, and rule bars
       have no interval — it would cut sessions mid-day and draw a VWAP of
       nothing. The bar-indexed indicators (EMA/SMA/BB/RSI/MACD/ATR) are the
       classic companions of range and volume bars and stay. */
    const active = allKeys.filter(k => indicators[k] && (INDICATOR_PARTS[k].pane === 'overlay' || subsActive.includes(k)))
      .filter(k => !(altSpec && (k === 'vwap' || k === 'vwapBands')));
    const paneCompareOn = compares.some(c => c.mode === 'pane');
    const subBase = paneCompareOn ? 2 : 1;
    const full = fullWorldRef.current === `${ticker}|${timeframe}|${barClock}`;
    const sig = `${ticker}|${timeframe}|${barClock}|${active.join(',')}|${subBase}|${mainNonce}|${full ? 'full' : 'recent'}`;
    const rebuild = indicatorLoadedRef.current !== sig;
    if (rebuild) {
      for (const s of indicatorSeriesRef.current.values()) {
        try {
          chart.removeSeries(s);
        } catch {
          /* chart already torn down */
        }
      }
      indicatorSeriesRef.current.clear();
      for (const key of active) {
        const spec = INDICATOR_PARTS[key];
        const paneIndex = spec.pane === 'overlay' ? 0 : subBase + subsActive.indexOf(key);
        for (const part of spec.parts) {
          const series =
            part.kind === 'hist'
              ? chart.addSeries(HistogramSeries, { color: part.ink, priceLineVisible: false, lastValueVisible: false, priceFormat: { type: 'price', precision: 2, minMove: 0.01 } }, paneIndex)
              : chart.addSeries(
                  LineSeries,
                  {
                    color: part.ink,
                    lineWidth: 1,
                    lineStyle: part.dashed ? 2 : 0,
                    ...(part.faint ? { color: part.ink + '99' } : {}),
                    ...(spec.pane === 'overlay' ? { priceScaleId: 'right' } : {}),
                    priceLineVisible: false,
                    lastValueVisible: spec.pane === 'sub' && part.part !== 'signal',
                    crosshairMarkerVisible: false,
                  },
                  paneIndex
                );
          indicatorSeriesRef.current.set(`${key}:${part.part}`, series);
          /* The RSI pane's 30/70 rails — the two numbers the oscillator is
             read against, drawn once with the series. Unlabelled on the
             axis; the levels are the pane's grammar, not its data. */
          if (key === 'rsi' && part.part === 'line') {
            for (const lvl of [30, 70]) {
              (series as ISeriesApi<'Line'>).createPriceLine({
                price: lvl,
                color: 'rgba(226,234,244,0.25)',
                lineWidth: 1,
                lineStyle: 3,
                axisLabelVisible: false,
                title: '',
              });
            }
          }
        }
      }
      /* Two thirds to the tape, the rest split — only while subs exist. */
      if (subsActive.length > 0) {
        const panes = chart.panes();
        panes.forEach((p, i) => p.setStretchFactor(i === 0 ? 64 : Math.max(10, 36 / (panes.length - 1))));
      }
      indicatorLoadedRef.current = sig;
    }
    if (active.length === 0) return;
    /* The same window as the candles — a line that ran further left than
       the tape would widen the time scale and throw showRecent's arithmetic */
    const bars = windowOf(displayBars(ticker, mins, altSpec), full);
    if (bars.length === 0) return;
    /* The formulas live in data/indicators.ts — one copy, shared with the
       confluence strip and every other summariser (the walls' lesson). This
       maps numbers onto series points and owns nothing else. */
    const seriesFor = (key: keyof ChartIndicators): Record<string, (number | null)[]> => {
      switch (key) {
        case 'vwap':
          return { line: vwapSeries(bars, mins) };
        case 'bb': {
          const b = bollingerSeries(bars, 20, 2);
          return { basis: b.basis, upper: b.upper, lower: b.lower };
        }
        case 'vwapBands': {
          const vw = vwapSeries(bars, mins);
          const sg = vwapSigmaSeries(bars, mins);
          const band = (k: number) => vw.map((v, i) => (sg[i] === null ? null : v + k * (sg[i] as number)));
          return { up1: band(1), dn1: band(-1), up2: band(2), dn2: band(-2) };
        }
        case 'sma':
          return { line: smaSeries(bars, 200) };
        case 'rsi':
          return { line: rsiSeries(bars, 14) };
        case 'macd': {
          const m = macdSeries(bars, 12, 26, 9);
          return { line: m.macd, signal: m.signal, hist: m.hist };
        }
        case 'atrPane':
          return { line: atrBarSeries(bars, 14) };
        default:
          return { line: emaSeries(bars, key === 'ema9' ? 9 : key === 'ema21' ? 21 : 50) };
      }
    };
    for (const key of active) {
      const values = seriesFor(key);
      for (const [part, vals] of Object.entries(values)) {
        const s = indicatorSeriesRef.current.get(`${key}:${part}`);
        if (!s) continue;
        const pts = bars.map((b, i) =>
          vals[i] === null ? { time: b.time as UTCTimestamp } : { time: b.time as UTCTimestamp, value: vals[i] as number }
        );
        /* Same completed-bar rule as the candles: update() cannot rewrite
           an older time, so a rule-clock pass that changed the bar count
           reloads the series instead. */
        if (rebuild || (altSpec && indAltCountRef.current !== bars.length)) s.setData(pts);
        else s.update(pts[pts.length - 1]);
      }
    }
    indAltCountRef.current = bars.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicators, ticker, revision, timeframe, mainNonce, compares, altSpec, barClock, fullNonce]);

  /*
    THE SCRIPTS ON THIS PANE — the Pine runtime (2026-09-10). Every script the
    reader placed here runs over the same window of bars the candles and the
    built-in indicators draw from, with the reader's inputs and the pane's
    levels handed in through `slayer.*`. Overlay scripts ride the tape; an
    own-pane script takes a pane after the built-in sub-panes, under the same
    cap (MAX_SUB_PANES), refused in the library with the reason. A tick re-runs
    the scripts (the runtime is streaming, so a run is milliseconds on a pane's
    bars) and redraws each handle in place; a new set, a new input, a new
    shape or a new world rebuilds. The bars are left with the pane store so the
    editor can run a draft over exactly these.
  */
  useEffect(() => {
    const chart = chartRef.current;
    const handles = scriptHandlesRef.current;
    const tearDown = () => {
      for (const h of handles.values()) h.destroy();
      handles.clear();
      scriptSigRef.current = '';
    };
    if (!chart || !paneId) {
      tearDown();
      return;
    }
    if (replayRef.current) return;
    const mins = tfMinutes(timeframe);
    const full = fullWorldRef.current === `${ticker}|${timeframe}|${barClock}`;
    const bars = windowOf(displayBars(ticker, mins, altSpec), full).map(c => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume }));
    setPaneBars(paneId, bars, ticker, String(timeframe));
    if (bars.length === 0) {
      tearDown();
      return;
    }
    const subsActive = SUB_PANE_ORDER.filter(k => indicators?.[k]).slice(0, MAX_SUB_PANES);
    const paneCompareOn = compares.some(c => c.mode === 'pane');
    const subBase = paneCompareOn ? 2 : 1;
    const live = paneScripts.filter(p => p.chart.visible && p.script.status === 'ok');
    const sig = `${ticker}|${timeframe}|${barClock}|${full ? 'full' : 'recent'}|${mainNonce}|${subBase}|${subsActive.join(',')}|${live.map(p => `${p.chart.id}:${p.script.sourceHash}:${JSON.stringify(p.chart.inputs)}`).join(';')}`;
    const rebuild = scriptSigRef.current !== sig;
    if (rebuild) tearDown();
    const slayer = { callWall: levels.callWall, putWall: levels.putWall, flip: levels.flip, supreme: levels.supreme };
    let ownPanes = 0;
    for (const ps of live) {
      const own = ps.script.meta?.pane === 'own';
      if (own && subsActive.length + ownPanes >= MAX_SUB_PANES) continue;
      let compiled = compiledRef.current.get(ps.script.sourceHash);
      if (!compiled) {
        try {
          compiled = compile(ps.script.source);
          compiledRef.current.set(ps.script.sourceHash, compiled);
        } catch {
          continue;
        }
      }
      let result;
      try {
        result = runScript(compiled, bars, { inputs: ps.chart.inputs, ticker, timeframe: String(timeframe), slayer });
      } catch (e) {
        if (rebuild) console.warn(`[scripts] ${ps.script.title}: ${explain(e).message}`);
        continue;
      }
      const have = handles.get(ps.chart.id);
      if (have && have.update(result, bars)) {
        if (own) ownPanes++;
        continue;
      }
      if (have) {
        have.destroy();
        handles.delete(ps.chart.id);
      }
      const paneIndex = own ? subBase + subsActive.length + ownPanes++ : 0;
      handles.set(ps.chart.id, drawRun(chart, result, bars, paneIndex));
    }
    if (rebuild && subsActive.length + ownPanes > 0) {
      const panes = chart.panes();
      panes.forEach((p, i) => p.setStretchFactor(i === 0 ? 64 : Math.max(10, 36 / (panes.length - 1))));
    }
    scriptSigRef.current = sig;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paneId, paneScripts, indicators, ticker, revision, timeframe, mainNonce, compares, altSpec, barClock, fullNonce, levels]);

  /* the handles go with the chart */
  useEffect(
    () => () => {
      for (const h of scriptHandlesRef.current.values()) h.destroy();
      scriptHandlesRef.current.clear();
    },
    []
  );

  /* Compare lines (Noah, 2026-08-23, TradingView's three flavors). Rebuilt
     when the roster/timeframe/ticker changes, ticked per revision otherwise —
     the same full-load/incremental split the candles use. Scales follow the
     roster: any percent compare flips the WHOLE right scale to % change (the
     levels ride along, exactly as TV does it); any own-scale compare shows
     the left axis; pane compares live in pane 1, which lightweight-charts
     creates and removes with its series. */
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    if (replayRef.current) return; // replay owns the tape; compares freeze
    const mins = tfMinutes(timeframe);
    const full = fullWorldRef.current === `${ticker}|${timeframe}|${barClock}`;
    const sig = `${ticker}|${timeframe}|${compares.map(c => `${c.ticker}:${c.mode}:${c.ink}`).join(',')}|${full ? 'full' : 'recent'}`;
    const rebuild = compareLoadedRef.current !== sig;
    if (rebuild) {
      for (const s of compareSeriesRef.current.values()) {
        try {
          chart.removeSeries(s);
        } catch {
          /* chart already torn down */
        }
      }
      compareSeriesRef.current.clear();
      for (const c of compares) {
        Simulator.ensureTicker(c.ticker);
        const series = chart.addSeries(
          LineSeries,
          {
            color: c.ink,
            lineWidth: 2,
            priceScaleId: c.mode === 'scale' ? 'left' : 'right',
            priceLineVisible: false,
            lastValueVisible: true,
            title: c.ticker,
          },
          /* Below every product pane that is open, not below the flow band
             alone. The original asked the flow series where it was, which was
             right when flow was the only optional pane; with three of them a
             compare line would land inside whichever one happened to be last
             and inherit a scale pinned to dollars or percent. */
          c.mode === 'pane' ? lastProductPaneIndex() + 1 : 0
        );
        compareSeriesRef.current.set(`${c.ticker}:${c.mode}`, series);
      }
      /* The MODE is not set here any more — it is the reader's choice now, so
         it moved to its own effect below, which watches both inputs. Setting
         it here as well would mean adding a comparison silently reset an axis
         the reader had put in log, and only sometimes: this branch runs on the
         compare signature, not on the picker. */
      chart.applyOptions({
        leftPriceScale: { visible: compares.some(c => c.mode === 'scale'), borderColor: chartSurface(getCandleTheme()).line },
      });
      // TV proportions: the tape keeps ~3/4 of the window, the compare pane
      // rides below at ~1/4 (lightweight-charts defaults to an even split)
      const panes = chart.panes();
      if (panes.length > 1) {
        panes[0].setStretchFactor(3);
        for (let i = 1; i < panes.length; i++) panes[i].setStretchFactor(1);
      }
      compareLoadedRef.current = sig;
    }
    for (const c of compares) {
      const s = compareSeriesRef.current.get(`${c.ticker}:${c.mode}`);
      if (!s) continue;
      const bars = windowOf(displayBars(c.ticker, mins), full);
      if (bars.length === 0) continue;
      if (rebuild) {
        s.setData(bars.map(b => ({ time: b.time as UTCTimestamp, value: b.close })));
      } else {
        const last = bars[bars.length - 1];
        s.update({ time: last.time as UTCTimestamp, value: last.close });
      }
    }
  }, [compares, ticker, revision, timeframe, barClock, fullNonce]);

  /*
    THE MAIN SCALE'S MODE — T-7, and it is its own effect on purpose.

    It used to be one line inside the compare effect above, keyed on the
    compare SIGNATURE. That was correct while the mode had exactly one input;
    with the reader's picker as a second one it would have meant the axis only
    changed when a comparison did — pick LOG and nothing happens until you also
    add or remove a compare line, at which point it appears.

    So it watches both inputs and computes the answer from both, and the lock
    is asked for by name rather than re-tested here (`priceScaleLockedBy`) so
    the toolbar's report and the axis cannot drift apart.

    LOG IS SAFE ON THIS AXIS. Everything on the right scale is a price — the
    tape and any `percent`/`pane`-free comparison — and prices are positive.
    The volume histogram is on its own `vol` scale and the runway on `runway`,
    neither of which this touches.
  */
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    /* ONLY WHEN THE MODE ACTUALLY CHANGES (Noah, 2026-08-30: dragging the
       price axis on the Weigher, then letting go — "do you see what it
       does?"). Re-applying the mode, even the same mode, makes the library
       snap a manually-scaled price range back to its pre-drag range. This
       effect keyed on the `compares` array, whose default was a literal []
       — a new identity every render — so it fired on every render of the
       chart, and the Weigher renders the chart on every tick and on every
       pointer release. Now it keys on the resolved mode string. */
    chart.priceScale('right').applyOptions({ mode: PRICE_SCALE_MODE[scaleMode] });
  }, [scaleMode, mainNonce]);

  // Recolor the candle series AND the chart surface in place when the theme
  // picker changes — gallery themes carry their own background tint.
  useEffect(() => {
    const t = getCandleTheme();
    const main = candleSeriesRef.current;
    if (main) {
      // Recolor IN the active style's vocabulary — baseline keeps its fixed
      // bull/bear pair and needs nothing
      const style = styleRef.current;
      if (style === 'candles') main.applyOptions(candleSeriesOptions(t));
      else if (style === 'hollow') {
        const surface = chartSurface(t).bg;
        main.applyOptions({
          ...candleSeriesOptions(t),
          upColor: surface === 'transparent' ? 'rgba(0,0,0,0)' : surface,
          borderUpColor: t.borderUp ?? t.up,
          wickUpColor: t.wickUp,
        });
      } else if (style === 'bars') (main as unknown as ISeriesApi<'Bar'>).applyOptions({ upColor: t.up, downColor: t.down });
      else if (style === 'line' || style === 'step') (main as unknown as ISeriesApi<'Line'>).applyOptions({ color: t.up });
      else if (style === 'area')
        (main as unknown as ISeriesApi<'Area'>).applyOptions({ lineColor: t.up, topColor: `${t.up}40`, bottomColor: `${t.up}05` });
    }
    /* The frame's inks ride the theme too (2026-09-11, the Stone theme): a
       light ground takes the dark axis ink, scale borders and crosshair. */
    const s = chartSurface(t);
    chartRef.current?.applyOptions({
      layout: { background: { color: s.bg }, textColor: s.text },
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
      rightPriceScale: { borderColor: s.line },
      leftPriceScale: { borderColor: s.line },
      timeScale: { borderColor: s.line },
      crosshair: {
        vertLine: { color: s.crosshair, labelBackgroundColor: s.label },
        horzLine: { color: s.crosshair, labelBackgroundColor: s.label },
      },
    });
  }, [themeKey, appTheme, mainNonce]);

  // Candle data + trails: full load on ticker/timeframe/theme change, incremental
  // per tick (theme forces a reload because volume bars carry per-bar colors)
  useEffect(() => {
    if (replayRef.current) return; // replay owns the series while active
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    const trails = trailsRef.current;
    if (!chart || !candleSeries || !volumeSeries || !trails) return;

    const base = Simulator.getCandles(ticker);
    if (!base || base.length === 0) return;

    const theme = getCandleTheme();
    const mins = tfMinutes(timeframe);
    const all = displayBars(ticker, mins, altSpec);
    /* This world's key, and whether the reader has asked for its whole
       history (onRange sets it); the recent window otherwise */
    const key = `${ticker}|${timeframe}|${barClock}`;
    worldKeyRef.current = key;
    const full = fullWorldRef.current === key;
    const bars = windowOf(all, full);
    const held = bars.length < all.length;
    barCountRef.current = bars.length;
    /* A rule clock reads the seconds tape, so it wears T-14's chip too. */
    setLiveFrom(altSpec || mins < 1 ? bars[0]?.time ?? 0 : null);
    drawingsRef.current?.setBarTimes(bars.map(b => b.time));
    /* The measure counts BARS and annualizes off them, so the layer has to
       know what a bar is worth here — set beside the times it belongs with,
       so a timeframe change can never move one without the other. Rule bars
       have no fixed worth; 0 tells the measure to read elapsed time off the
       stamps instead of counting steps. */
    drawingsRef.current?.setBarMinutes(altSpec ? 0 : mins);
    /* T-19's rulers ride the same load — one ATR fold per data pass, so the
       measure box and the flip strip cannot disagree about the day's range. */
    drawingsRef.current?.setDistanceScales({
      atr: sessionAtr(base),
      sigma: impliedDaySigma(base.length ? base[base.length - 1].close : 0, Simulator.TICKERS[ticker]?.iv ?? 0),
    });

    const loaded = loadedRef.current;
    const newWorld = loaded.ticker !== ticker || loaded.timeframe !== timeframe || loaded.clock !== barClock;
    const changed = newWorld || loaded.theme !== themeKey || loaded.full !== full;
    let armTimer = 0;

    lastCloseRef.current = bars.length ? bars[bars.length - 1].close : null;
    if (bars.length) {
      lastBarTimeRef.current = bars[bars.length - 1].time;
      bucketSecRef.current = mins * 60;
      /* No runway on a rule clock: whitespace at timeframe spacing would be
         a claim about when the next bar lands, and rule bars land when the
         market says. Nothing needs it either — the cone and the event lane
         are gated off with it. */
      if (!altSpec) ensureRunway(lastBarTimeRef.current, bucketSecRef.current);
    }


    if (changed) {
      /* THE FIRST PAINT CARRIES THE RECENT BARS (2026-09-06, the perf sweep):
         a month of one-minute bars is 8,580 points, and the library checks
         every one of them on setData — the single largest cost of opening a
         chart, on the click frame; and the whole store following "one task
         later" was a 79ms task of its own on every open. Now the recent
         window is all that loads until the reader scrolls to its left edge
         (onRange), and the whole store lands then, once per world. The view
         holds through that because the library anchors the scroll to the
         right edge, not to a bar index. */
      candleSeries.setData(bars.map(toMain));
      volumeSeries.setData(bars.map(b => toVolume(b, theme)));
      // Baseline style pivots on the CURRENT session's open — found at the
      // last overnight gap in the aggregated bars (intraday only; dailies
      // fall back to the buffer's first open)
      if (styleRef.current === 'baseline' && bars.length > 0) {
        let baseValue = bars[0].open;
        /* Rule bars have no bar interval to scale — the overnight gap is
           found on the seconds tape's own line (an hour dwarfs any quarter
           spacing, see altBars.ts). */
        const gapSec = altSpec ? 3600 : mins * 60 * 1.5;
        for (let i = bars.length - 1; i > 0; i--) {
          if (bars[i].time - bars[i - 1].time > gapSec) {
            baseValue = bars[i].open;
            break;
          }
        }
        (candleSeries as unknown as ISeriesApi<'Baseline'>).applyOptions({ baseValue: { type: 'price', price: baseValue } });
      }
      if (newWorld) {
        // A new name/interval is a fresh greeting — autoscale returns with it.
        chart.priceScale('right').applyOptions({ autoScale: true });
        const kept = keepViewRef.current ? KEPT_VIEWS.get(`${ticker}|${timeframe}|${barClock}`) : undefined;
        if (kept) {
          // The reader's own view, carried across a remount (see the cleanup).
          chart.timeScale().applyOptions({ barSpacing: kept.barSpacing });
          chart.timeScale().scrollToPosition(kept.scroll, false);
        } else {
          showRecent(); // theme swaps must not yank the user's pan/zoom
        }
        /* A timeframe change BREATHES in (Noah, 2026-08-22: "should have a
           smooth transition, not quick"): the new world lands at zero and
           fades up on the house curve. Ticker changes are keyed by the host
           and already soft-fade; the first load is not a transition. */
        const el = containerRef.current;
        if (el && loaded.ticker === ticker) {
          el.style.transition = 'none';
          el.style.opacity = '0';
          // Lift on the next frame — or a timer, whichever comes first: a
          // background tab gets no frames, and a chart must never stay dark
          let lifted = false;
          const lift = () => {
            if (lifted) return;
            lifted = true;
            el.style.transition = 'opacity 480ms cubic-bezier(0.16, 1, 0.3, 1)';
            el.style.opacity = '1';
          };
          requestAnimationFrame(lift);
          window.setTimeout(lift, 40);
        }
      }
      loadedRef.current = { ticker, timeframe, theme: themeKey, clock: barClock, full };
      /* ARMED A FRAME LATER: the library reports a range on the setData
         itself, before it has laid the view out (−83..6 was measured on a
         mount), and that would have asked for the whole store at once. */
      recentHeldRef.current = false;
      if (held) armTimer = requestAnimationFrame(() => (recentHeldRef.current = true));
    } else if (altSpec && bars.length !== altCountRef.current) {
      /* On a rule clock the tick that COMPLETES the forming bar also opens
         the next, and update() refuses to rewrite an older time — so the
         completed bar's closing quarter would be lost. A count change
         reloads the whole (small, capped by the seconds ring) array; the
         in-between ticks stay on the cheap update path below. */
      candleSeries.setData(bars.map(toMain));
      volumeSeries.setData(bars.map(b => toVolume(b, theme)));
    } else {
      const last = bars[bars.length - 1];
      candleSeries.update(toMain(last));
      volumeSeries.update(toVolume(last, theme));
    }
    altCountRef.current = bars.length;

    // LED trails are intraday-only — dailies would smear the session structure.
    // The field keeps a FINER clock than the bars (Noah, 2026-08-22: one bead
    // per 30m/1h bar was a row of pearls): every 5 minutes of real history
    // is a bead, tiled across its bar by its time — six to a 30m bar, twelve
    // to an hour. More beads, same data.
    const baseGex = Simulator.getGexHistory(ticker);
    const trailMins = Math.min(mins, TRAIL_TEXTURE_MINUTES);
    /* Trails place their beads by TIME on a five-minute texture; a rule
       clock's axis only carries the times its bars happened to start at, so
       most beads would find no coordinate and the field would draw torn.
       Gated, and the menu row says why. */
    const showTrails = overlays.trails && mins <= INTRADAY_MAX_MINUTES && !altSpec;
    trails.labelPx = compact ? 8.5 : 9.5;
    const handTrails = () => {
      const snaps = aggregateSnapshots(baseGex ?? [], trailMins);
      trails.setData(snaps, snapshotsMaxAbs(snaps), showTrails, mins * 60, trailsGreek);
    };
    /* A COLD FOLD LEAVES THE MOUNT FRAME (2026-09-06, the perf sweep): the
       first time a store is folded to the field's texture it is the single
       biggest cost of opening a chart. The candles are already on screen at
       this point; the ribbon lands on the next task instead, and every tick
       after that folds incrementally in place. */
    if (baseGex && !isFolded(baseGex, trailMins)) {
      /* In slices of ~400 snapshots (under ten milliseconds each — 1,200
         measured as a 70ms task on the Map's open), one task apart, so no
         frame pays for the whole store */
      let id = 0;
      const slice = () => {
        if (chartRef.current !== chart) return;
        if (foldSnapshotsSlice(baseGex, trailMins, 400)) handTrails();
        else id = window.setTimeout(slice, 0);
      };
      id = window.setTimeout(slice, 0);
      return () => {
        window.clearTimeout(id);
        cancelAnimationFrame(armTimer);
      };
    }
    handTrails();
    return () => cancelAnimationFrame(armTimer);
  }, [ticker, revision, timeframe, themeKey, overlays.trails, showRecent, reloadNonce, mainNonce, toMain, compact, altSpec, barClock, fullNonce, trailsGreek]);

  /* `compact` can change without the chart being rebuilt — a desktop window
     dragged across the phone line, a handset rotated. The mount effect read it
     once at create time, so apply later changes here. */
  useEffect(() => {
    chartRef.current?.applyOptions({ layout: { fontSize: compact ? 9 : 10 } });
  }, [compact]);

  /* Crossing the breakpoint must not need a remount — the chart is created
     once and a window drag changes which side of it the reader is on. */
  useEffect(() => {
    chartRef.current?.applyOptions({
      handleScroll: { mouseWheel: !pageScroll },
      handleScale: { mouseWheel: !pageScroll },
    });
  }, [pageScroll]);

  // Key-level price lines — create/destroy only when overlay or ticker changes
  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    if (!candleSeries) return;
    cancelAnimationFrame(levelRafRef.current);
    for (const spec of LEVEL_SPEC) {
      const line = levelLinesRef.current[spec.key];
      if (line) candleSeries.removePriceLine(line);
      delete levelLinesRef.current[spec.key];
    }
    shownLevelsRef.current = null;

    // Levels are LIVE values — hidden during replay so history isn't lied about
    if (!overlays.levels || replay) return;

    // Chips, not lines: the level lives as a colored tag on the price axis.
    // Hovering its legend chip flashes the full line for orientation.
    const L = levelsRef.current;
    for (const spec of LINE_LEVELS) {
      levelLinesRef.current[spec.key] = candleSeries.createPriceLine({
        price: L[spec.key],
        color: spec.color,
        title: spec.title,
        lineStyle: spec.style,
        lineWidth: spec.width,
        lineVisible: false,
        axisLabelVisible: true,
      });
    }
    shownLevelsRef.current = { ...L };
    levelTickerRef.current = ticker;
  }, [ticker, overlays.levels, replay, mainNonce]);

  /*
    THE SESSION'S REFERENCE PRICES — T-6.

    Computed from the RAW 1-minute base bars, never from the aggregated ones
    this chart happens to be drawing: a 15-minute bar cannot answer what the
    first five minutes did, and reading the levels off the visible series
    would silently round every one of them to the pane's interval and give a
    30-minute pane a 30-minute "opening range" whatever the picker said.

    HIDDEN DURING REPLAY, exactly as the key levels are. These are levels of
    the LIVE session, and drawing today's opening range across a historical
    tape is a line that never existed at the moment being replayed.

    DRAWN BY A PRIMITIVE rather than by `createPriceLine`, because a price
    line can only be NAMED on the price axis and the house rule keeps names
    off it — see sessionLevelsPrimitive.ts. The primitive is attached once
    with the series and only its contents change, so a tick costs a compare
    rather than seven removals and seven creations.
  */
  useEffect(() => {
    const prim = sessionPrimRef.current;
    if (!prim) return;
    if (!overlays.session || replay || altSpec) {
      prim.setLines([]);
      return;
    }
    prim.setLines(sessionLines(buildSessionLevels(Simulator.getCandles(ticker) ?? [], sessionOr)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker, revision, sessionOr, overlays.session, replay, mainNonce, altSpec]);

  /*
    THE EXPECTED-MOVE CONE — T-9.

    Computed on the DISPLAYED grid, unlike the session levels above: the
    engine samples its envelope at whatever bars it is handed, and handing it
    the pane's own aggregated session means every past point is an exact bar
    hit and a crossing answers "did a close AT THIS TIMEFRAME leave the band"
    — the question the tape on screen can actually show. The √t curve itself
    is sampling-independent, so a 5-minute pane and a 1-minute pane draw the
    same envelope, just sampled coarser.

    σ IS THE FEED'S QUOTED VOL for the name — the same figure every options
    surface quotes. The REMAINING MINUTES come from the tape's own session,
    not from readSessionClock: the forward half is geometry BETWEEN the last
    bar and the bell on this time axis, and the simulator's tape runs its own
    accelerated clock (~15× wall speed — see seedCandles), so wall-clock
    minutes would draw a cone whose tip lands hours past the session's last
    possible bar. `RTH_MINUTES − elapsed` is readable off the same slice the
    envelope uses, collapses to zero exactly at the tape's bell, and when a
    real feed replaces the simulator the tape's clock IS the wall clock — the
    two derivations converge on the P-0 day fraction with nothing to rewire.

    HIDDEN DURING REPLAY, as the session levels are: the forward half is a
    claim about the LIVE session's remaining minutes, and drawing it from the
    middle of a historical tape would price a future that already happened.
  */
  useEffect(() => {
    const prim = conePrimRef.current;
    if (!prim) return;
    if (!overlays.cone || replay || altSpec) {
      prim.setData(null);
      return;
    }
    const mins = tfMinutes(timeframe);
    const bars = displayBars(ticker, mins);
    const starts = sessionStarts(bars, mins);
    const sess = starts.length > 0 ? bars.slice(starts[starts.length - 1]) : [];
    const iv = Simulator.TICKERS[Simulator.ensureTicker(ticker)]?.iv ?? 0;
    /* Elapsed counts THROUGH the last bar — a bar covers its interval. */
    const elapsed = sess.length > 0 ? (sess[sess.length - 1].time - sess[0].time) / 60 + mins : 0;
    prim.setData({
      cone: buildExpectedMoveCone(sess, iv, Math.max(0, RTH_MINUTES - elapsed), mins),
      barTimes: bars.map(b => b.time),
      barMinutes: mins,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker, timeframe, revision, overlays.cone, replay, mainNonce, altSpec]);

  /*
    THE EVENT MARKERS — T-11. The calendar half (this name's report, the
    macro dates) is cached per ticker and day; the prints half is live. Both
    hand the engine a clock-free input — the real "today" is read HERE, at
    the seam, exactly as the cone reads the tape's session (data/events.ts
    documents the sessions bridge).

    HIDDEN DURING REPLAY: the markers say where the calendar sits against
    the LIVE tape, and a replaying pane's moment is somewhere else entirely.
  */
  useEffect(() => {
    const prim = eventsPrimRef.current;
    if (!prim) return;
    if (!overlays.events || replay || altSpec) {
      prim.setData(null);
      setEventCard(null);
      return;
    }
    const now = new Date();
    const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const key = `${ticker}|${todayIso}`;
    if (eventsCalRef.current?.key !== key) {
      eventsCalRef.current = {
        key,
        earnings: buildEarningsCalendar().find(e => e.ticker === ticker.toUpperCase()) ?? null,
        macro: macroWindow(now),
        todayIso,
      };
    }
    const cal = eventsCalRef.current;
    const mins = tfMinutes(timeframe);
    const bars = displayBars(ticker, mins);
    // eslint-disable-next-line no-console
    console.log('[events-debug]', JSON.stringify(buildTapeEvents({ bars: Simulator.getCandles(ticker) ?? [], prints: flowPrints ?? [], earnings: cal.earnings, macro: cal.macro, todayIso: cal.todayIso }).map(e => ({ k: e.kind, t: e.time, m: e.minutesAhead, l: e.label }))), 'cal', JSON.stringify({ e: cal.earnings?.ticker, macro: cal.macro.length }));
    prim.setData({
      events: buildTapeEvents({
        bars: Simulator.getCandles(ticker) ?? [],
        prints: flowPrints ?? [],
        earnings: cal.earnings,
        macro: cal.macro,
        todayIso: cal.todayIso,
      }),
      barTimes: bars.map(b => b.time),
      barMinutes: mins,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker, timeframe, revision, overlays.events, replay, mainNonce, flowPrints, altSpec]);

  /*
    THE LIVE PRICE, as a card on the right scale.

    The library draws a flat one-line tag for the last value. This replaces it
    with the two-line card from the reference: the price, a hairline, and the
    time left in the current bar. So the library's own tag has to go, or there
    are two labels at the same y arguing with each other — `lastValueVisible`
    is turned off for exactly as long as the card is on, and restored if it
    ever goes off.

    Frame loop, not a one-second timer, and the reason is the position rather
    than the clock: the card's y is priceToCoordinate(lastClose), which moves
    when the price ticks, when the autoscale re-fits, AND when the reader pans
    or zooms. A timer leaves the card stranded on every one of those. It
    writes nothing it does not have to — price, countdown and transform are
    each compared before they are set — so a still chart on a still second
    does no DOM work at all.

    Hidden during replay: a countdown to the next live bar is a lie about
    history.
  */
  useEffect(() => {
    const series = candleSeriesRef.current;
    if (!series) return;
    const on = priceTag && !replay;
    series.applyOptions({ lastValueVisible: !on });
    if (!on) return;

    const chart = chartRef.current;
    const el = priceTagRef.current;
    if (!chart || !el) return;
    const priceEl = el.firstElementChild as HTMLElement | null;
    const timeEl = el.lastElementChild as HTMLElement | null;
    if (!priceEl || !timeEl) return;

    const bucket = Math.max(60, tfMinutes(timeframe) * 60);
    let shownPrice = '';
    let shownLeft = '';
    let shownY = Number.NaN;
    let shownW = -1;

    const frame = () => {
      priceTagRafRef.current = requestAnimationFrame(frame);
      /*
        AS WIDE AS THE GUTTER, MEASURED — not 68px of guess.

        The card was min-w-[68px] pinned 4px off the container's right edge:
        72px of card against a gutter lightweight-charts sizes from its widest
        LABEL, which measures 54px at three digits and 48 at two. So it hung
        17-23px back over the PLOT and covered the tape's right edge — the last
        bars and the end of every price line. Sitting ON the gutter is the
        point; sitting PAST it is the bug. Take the width from the scale itself
        so it follows the gutter when a longer price widens it. Guarded on >0:
        width() reports 0 for a hidden scale, and a 0px card is no card.
      */
      const gw = Math.round(chart.priceScale('right').width());
      if (gw > 0 && gw !== shownW) {
        el.style.width = `${gw}px`;
        shownW = gw;
      }
      const price = lastCloseRef.current;
      const y = price == null ? null : series.priceToCoordinate(price);
      if (price == null || y == null) {
        if (!Number.isNaN(shownY)) {
          el.style.opacity = '0';
          shownY = Number.NaN;
        }
        return;
      }

      const p = price.toFixed(2);
      if (p !== shownPrice) {
        priceEl.textContent = p;
        shownPrice = p;
      }

      /*
        ══ TIME LEFT IN THE BAR, ON THE CHART'S CLOCK ═══════════════════════

        This read `bucket - (now % bucket)`: wall-clock seconds to the next
        multiple of the timeframe. Two things wrong with it.

        It was off by an order of magnitude. A bar here is TICKS_PER_BAR (4)
        ticks at 1500ms, so one 1-minute bar arrives every SIX real seconds,
        not sixty. On 15m the card counted down from 15:00 while the bar it
        was counting to appeared in about ninety seconds.

        And the phase was wrong even in its own terms: epoch-modulo assumes
        bars land on multiples of the timeframe, which only holds at seeding.
        Live bars advance on tick count and drift off that grid immediately.

        So it is MEASURED instead of assumed — the real gap between the last
        two bar arrivals, which is the chart telling us its own cadence. No
        constant imported from the simulator, so the two cannot drift apart,
        and nothing is printed until a full bar has actually been observed:
        a countdown that has not yet seen a bar has nothing true to say.
      */
      const barAt = lastBarTimeRef.current;
      if (barAt !== barClockRef.current.stamp) {
        const nowMs = Date.now();
        if (barClockRef.current.stamp !== 0) barClockRef.current.realMs = nowMs - barClockRef.current.at;
        barClockRef.current.stamp = barAt;
        barClockRef.current.at = nowMs;
      }
      const period = barClockRef.current.realMs;
      const pad = (v: number) => String(v).padStart(2, '0');
      /*
        Blank until a full bar has been observed — but NEVER return early here.
        The card is POSITIONED below, and an early exit leaves it wherever it
        was last put. Measured when this returned instead of falling through:
        the card sat 654px from the price it names, and the sweep's
        "both columns print the same number at the same height" assertion
        failed in seven places across layouts 1, 2 and 4.
      */
      let t = '';
      /* A rule bar closes when the market moves or trades enough — "time
         left" is not a thing it has, so the card is price-only there. */
      if (period > 0 && !altSpec) {
        const left = Math.max(0, Math.round((period - (Date.now() - barClockRef.current.at)) / 1000));
        const hh = Math.floor(left / 3600);
        t = hh > 0
          ? `${hh}:${pad(Math.floor((left % 3600) / 60))}:${pad(left % 60)}`
          : `${pad(Math.floor(left / 60))}:${pad(left % 60)}`;
      }
      if (t !== shownLeft) {
        timeEl.textContent = t;
        shownLeft = t;
      }

      /* Centred on the price, the way the tag it replaces was. */
      const top = Math.round(y);
      if (top !== shownY) {
        el.style.transform = `translateY(${top}px) translateY(-50%)`;
        el.style.opacity = '1';
        shownY = top;
      }
    };

    priceTagRafRef.current = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(priceTagRafRef.current);
      candleSeriesRef.current?.applyOptions({ lastValueVisible: true });
    };
  }, [priceTag, timeframe, replay, mainNonce, altSpec]);

  // Dark-pool whisper lines — same grammar as the flow board minis
  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    if (!candleSeries) return;
    for (const line of printLinesRef.current) candleSeries.removePriceLine(line);
    printLinesRef.current = [];
    if (!overlays.darkpool || replay) return;
    // Teal, the app-wide dark-pool ink (Live Tape dot, landing accent) — the
    // old 65% white whisper vanished against the candles (Noah, 2026-08-18).
    printLinesRef.current = prints.map(print =>
      candleSeries.createPriceLine({
        price: print.price,
        color: DARK_POOL,
        title: `DP $${print.notional.toFixed(2)}B · ${print.date}`,
        lineStyle: LineStyle.Dashed,
        lineWidth: 1,
        axisLabelVisible: true,
        axisLabelColor: DARK_POOL,
        axisLabelTextColor: '#0a0a0a',
      })
    );
  }, [prints, overlays.darkpool, replay, mainNonce]);

  // Tween level prices to their new scan values — lines glide, never teleport
  useEffect(() => {
    const lines = levelLinesRef.current;
    if (!lines.supreme) return; // levels hidden

    // Ticker switch = new world: snap, don't tween across symbols
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (levelTickerRef.current !== ticker || reduced) {
      levelTickerRef.current = ticker;
      for (const spec of LEVEL_SPEC) lines[spec.key]?.applyOptions({ price: levels[spec.key] });
      shownLevelsRef.current = { ...levels };
      return;
    }

    const origin = shownLevelsRef.current ?? { ...levels };
    if (!LEVEL_SPEC.some(s => origin[s.key] !== levels[s.key])) return;

    cancelAnimationFrame(levelRafRef.current);
    const target = { ...levels };
    const start = performance.now();
    const DUR = 650;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / DUR);
      const e = 1 - Math.pow(1 - t, 3); // easeOutCubic
      const cur: KeyLevels = { ...target };
      for (const spec of LEVEL_SPEC) {
        cur[spec.key] = origin[spec.key] + (target[spec.key] - origin[spec.key]) * e;
        lines[spec.key]?.applyOptions({ price: cur[spec.key] });
      }
      shownLevelsRef.current = cur;
      if (t < 1) levelRafRef.current = requestAnimationFrame(step);
    };
    levelRafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(levelRafRef.current);
  }, [levels, ticker]);

  /* THE SCALE GLIDES (Noah, 2026-09-11, letting a strike go on the Map: "i get
     a page buffer and it drags me to another pov"): the focus price sits in
     the autoscale's extras so its line is always in frame — taking one
     stretched the range and letting it go shrank it back, each in ONE frame,
     the whole tape and every trail re-laid in a jolt. Now the range tweens
     from where it is to where the autoscale wants it, on the house curve,
     and autoscale takes over again at the end. The target is read without
     painting a frame: re-sending the last bar makes the library recalculate
     its panes synchronously (an applyOptions alone defers to the next frame),
     and the range read after it is the auto fit with the new extras. `from`
     is read by the caller BEFORE the focus ref moves, so it is the old fit. */
  const scaleGlideRef = useRef(0);
  const glideScale = (candleSeries: ISeriesApi<'Candlestick'>, from: { from: number; to: number } | null) => {
    cancelAnimationFrame(scaleGlideRef.current);
    const ps = candleSeries.priceScale();
    ps.applyOptions({ autoScale: true });
    const bars = candleSeries.data();
    const lastBar = bars[bars.length - 1];
    if (lastBar) candleSeries.update(lastBar);
    const to = ps.getVisibleRange();
    if (!from || !to || (Math.abs(from.from - to.from) < 1e-6 && Math.abs(from.to - to.to) < 1e-6)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    ps.setVisibleRange(from);
    const t0 = performance.now();
    const DUR = 320;
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / DUR);
      const e = 1 - Math.pow(1 - t, 3);
      if (t < 1) {
        ps.setVisibleRange({ from: from.from + (to.from - from.from) * e, to: from.to + (to.to - from.to) * e });
        scaleGlideRef.current = requestAnimationFrame(step);
      } else ps.applyOptions({ autoScale: true });
    };
    scaleGlideRef.current = requestAnimationFrame(step);
  };
  useEffect(() => () => cancelAnimationFrame(scaleGlideRef.current), []);

  // Transient FOCUS line — "what you clicked", drawn via the chart's native API
  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    /* The range as it stands, read before the focus moves the autoscale's extras */
    const rangeBefore = candleSeries?.priceScale().getVisibleRange() ?? null;
    focusPriceRef.current = focusPrice;
    if (!candleSeries) return;
    if (focusLineRef.current) {
      candleSeries.removePriceLine(focusLineRef.current);
      focusLineRef.current = null;
    }
    if (focusPrice != null) {
      // With the trails drawn, the painted band IS the focus — a line across
      // the whole tape under it read as a smear joining the band to the label
      // (Noah, 2026-08-22). The axis label stays; the line only returns when
      // no band can be drawn (overlay off, or a timeframe above intraday).
      const trailsDrawn = overlays.trails && tfMinutes(timeframe) <= INTRADAY_MAX_MINUTES;
      focusLineRef.current = candleSeries.createPriceLine({
        price: focusPrice,
        // The ink at creation too — a trails toggle recreates the line, and
        // the ink effect below only re-runs when the focus or the supreme moves
        color: Math.abs(levelsRef.current.supreme - focusPrice) < 1e-9 ? SUPREME : FOCUS,
        title: 'FOCUS',
        lineVisible: !trailsDrawn,
        lineStyle: LineStyle.Solid,
        lineWidth: 1,
        axisLabelVisible: true,
      });
    }
    // Re-run autoscale now, not on the next tick — the provider above reads
    // the new focus and brings the line into frame — on a glide, not a jump.
    glideScale(candleSeries, rangeBefore);
  }, [focusPrice, overlays.trails, timeframe, mainNonce]);

  /*
    ALERT LINES.

    Rehung whole whenever the set changes or the main series is replaced — a
    style swap destroys the old series and every price line hanging off it, and
    `mainNonce` is how the rest of this file already hears about that.

    An alert that has fired is drawn solid and named; one still waiting is
    dashed and quiet. The state lives HERE and not on the toolbar's bell,
    because the toolbar is hidden until the cursor is over its own pane — a
    badge there would be invisible almost all the time, which would make
    "you'll see it fire" untrue.

    ONLY THE PRICE KIND GETS A LINE (T-22). A level alert's level is already
    on the field as the bead inks and the flip rule, and an indicator alert's
    line is the indicator itself — a second line in alert orange on the same
    price would be duplicate ink fighting the first. The exposure and flow
    kinds have no single price at all. All of them live on the armed rail
    instead.
  */
  useEffect(() => {
    const series = candleSeriesRef.current;
    if (!series) return;
    const live = alertLinesRef.current;
    for (const line of live.values()) {
      try {
        series.removePriceLine(line);
      } catch {
        /* series already gone with the old style */
      }
    }
    live.clear();
    /* the lines are an overlay the reader switches on (off by default, 2026-09-10) */
    if (!overlays.alerts) return;
    for (const a of alerts) {
      if (a.kind !== 'price') continue;
      live.set(
        a.id,
        series.createPriceLine({
          price: a.price,
          color: ALERT_INK,
          title: a.firedAt ? 'ALERT' : '',
          lineStyle: a.firedAt ? LineStyle.Solid : LineStyle.Dashed,
          lineWidth: 1,
          axisLabelVisible: true,
        })
      );
    }
    return () => {
      for (const line of live.values()) {
        try {
          series.removePriceLine(line);
        } catch {
          /* chart already torn down */
        }
      }
      live.clear();
    };
  }, [alerts, mainNonce, overlays.alerts]);

  /*
    FIRING.

    Driven by the tape rather than by a timer: `revision` bumps on every tick
    and this runs with the close that tick produced. Replay is excluded — a
    price from history reaching a level the reader set today has not happened.

    `markFired` is idempotent, so a close that sits past an alert for the rest
    of the session does not repaint every pane on every tick.

    THE CONTEXT IS BUILT LAZILY (T-22). The rules live in `evaluateAlert`
    (alertStore.ts, proven in alerts-proof); this effect's whole job is
    handing them what they watch, and only what something armed actually
    watches — the book is read only when an exposure or level kind is armed,
    and an indicator series is recomputed only for an indicator alert on THIS
    pane's timeframe. Two panes on one symbol both run this; every rule is
    idempotent across evaluators the way `markFired` always was.
  */
  useEffect(() => {
    if (replay) return;
    const close = lastCloseRef.current;
    if (close == null) return;
    const waiting = alerts.filter(a => !a.firedAt);
    if (waiting.length === 0) return;

    const needsBook = waiting.some(a => a.kind === 'level' || a.kind === 'gexflip' || a.kind === 'newsupreme' || a.kind === 'wallmove');
    const exp = needsBook ? exposureNowFor(ticker) : null;

    const values: Partial<Record<IndicatorSource, number | null>> = {};
    const mins = tfMinutes(timeframe);
    for (const a of waiting) {
      if (a.kind !== 'indicator' || a.tf !== timeframe || a.source in values) continue;
      /* Deliberately WITHOUT the pane's rule clock: the alert was armed on
         this timeframe's TIME bars and keeps watching them, whatever the
         pane is currently drawing. */
      const bars = displayBars(ticker, mins);
      const last = (pts: readonly (number | null)[]) => {
        const p = pts[pts.length - 1];
        return typeof p === 'number' && Number.isFinite(p) ? p : null;
      };
      values[a.source] =
        a.source === 'vwap' ? last(vwapSeries(bars, mins))
        : a.source === 'rsi' ? last(rsiSeries(bars, 14))
        : last(emaSeries(bars, a.source === 'ema9' ? 9 : a.source === 'ema21' ? 21 : 50));
    }

    const ctx: AlertContext = {
      close,
      tf: timeframe,
      levels: {
        callWall: exp?.callWall ?? null,
        putWall: exp?.putWall ?? null,
        flip: exp?.flip ?? null,
        supreme: exp?.supreme ?? null,
      },
      netGex: exp ? exp.netGex : null,
      step: exp?.step ?? 0,
      values,
      prints: waiting.some(a => a.kind === 'flow')
        ? (flowPrints ?? []).filter(p => p.ticker === ticker).map(p => ({ at: p.at, premium: p.premium }))
        : [],
      news: waiting.some(a => a.kind === 'news') ? newsPulse(ticker) : [],
    };

    const now = Date.now();
    for (const a of waiting) {
      const verdict = evaluateAlert(a, ctx);
      if (verdict.fire) markFired(ticker, a.id, now);
      else if (verdict.armed) commitArm(ticker, verdict.armed);
    }
  }, [alerts, ticker, revision, replay, timeframe, flowPrints]);



  /* The focus INK follows the strike's standing, re-read every scan: magenta
     while the focused strike is the supreme, lime otherwise. The focus itself
     never moves — if 510 loses the crown, 510 turns lime and stays (Noah,
     2026-08-22); the new supreme keeps its own line. Line and trail agree. */
  useEffect(() => {
    const isSupreme = focusPrice != null && Math.abs(levels.supreme - focusPrice) < 1e-9;
    trailsRef.current?.setFocus(focusPrice, isSupreme ? 'supreme' : 'focus');
    /*
      ══ "KEY LEVELS" IS A SWITCH THAT NOW SWITCHES SOMETHING ══════════════

      It did nothing. `overlays.levels` gated exactly one loop — over
      LINE_LEVELS, which is `[]` because the axis capsules were deliberately
      removed (see its comment above). So the toggle had nothing left to turn
      off, while its menu row went on offering "CW · PW · flip · supreme".

      Measured before this change: toggling it moved 23 pixels of a 1240x804
      plot, against 795 pixels of drift on an untouched chart over the same
      interval — its entire effect was 34x below the tape's own tick noise.

      The levels were never missing, though: they are ON THE FIELD, as the
      bead inks and the dotted flip line, and the primitive already keeps
      those as four settable prices. Feeding it nulls is exactly "draw the
      exposure field with nothing named on it", which is what the label
      promises. No primitive change, and `trails` still owns the field itself.
    */
    const showLevels = overlays.levels;
    trailsRef.current?.setSupreme(showLevels && Number.isFinite(levels.supreme) ? levels.supreme : null);
    trailsRef.current?.setWalls(
      showLevels && Number.isFinite(levels.callWall) ? levels.callWall : null,
      showLevels && Number.isFinite(levels.putWall) ? levels.putWall : null,
      showLevels && Number.isFinite(levels.flip) ? levels.flip : null
    );
    focusLineRef.current?.applyOptions({ color: isSupreme ? SUPREME : FOCUS });
  }, [focusPrice, overlays.levels, levels.supreme, levels.callWall, levels.putWall, levels.flip]);

  // ---- replay lifecycle -----------------------------------------------------
  // Enter: snapshot the aggregated world and rewind. Exit: hand the series
  // back to the live effect (reloadNonce forces a full refresh).
  useEffect(() => {
    replayRef.current = replay;
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    if (!chart || !candleSeries || !volumeSeries) return;

    if (replay) {
      const mins = tfMinutes(timeframe);
      const bars = displayBars(ticker, mins);
      const snaps = aggregateSnapshots(Simulator.getGexHistory(ticker) ?? [], Math.min(mins, TRAIL_TEXTURE_MINUTES));
      if (bars.length < 40) return;
      replayDataRef.current = { bars, snaps, maxAbs: snapshotsMaxAbs(snaps) };
      /* Driven from outside: start where the host's clock points, and never
         play on our own — the host's strip is the transport. On our own: the
         same way in as the Map's (Noah, 2026-09-08) — pick a bar first; the
         series stays live-but-frozen until the click */
      const external = replayTimeRef.current != null;
      replayAppliedRef.current = 0;
      if (external) {
        let i = bars.length;
        while (i > 0 && bars[i - 1].time > (replayTimeRef.current as number)) i--;
        setReplayIdx(Math.max(31, i));
        setReplayNonce(n => n + 1);
        setOwnPhase('play');
      } else {
        setOwnPhase('pick');
        /* The day marks under the track: where each session starts, at most eight named */
        const starts: number[] = [0];
        for (let i = 1; i < bars.length; i++) if (bars[i].time - bars[i - 1].time > 90) starts.push(i);
        const every = Math.max(1, Math.ceil(starts.length / 8));
        setReplayMarks(starts.filter((_, k) => k % every === 0).map(i => ({ u: i / Math.max(1, bars.length), label: dayWords(bars[i].time) })));
      }
      setReplaySpeed(2);
      setReplayPlaying(false);
      /* The view is set once the sliced data is on the series (the apply
         effect) — set here, against the live window still on the series, the
         library re-anchored it past the last bar and the 1m replay opened blank */
    } else {
      replayDataRef.current = null;
      setReplayPlaying(false);
      loadedRef.current = { ticker: '', timeframe: '1m', theme: '', clock: 'time', full: false };
      setReloadNonce(n => n + 1);
    }
    /* On the host's clock a timeframe change re-cuts the same moment on the
       new bars (the Map keeps replaying); on its own transport it exits below */
  }, [replay, timeframe]); // eslint-disable-line react-hooks/exhaustive-deps

  // A ticker switch ends the replay — it was recorded in another world; so does
  // a timeframe switch when the chart is on its own transport
  useEffect(() => {
    if (replayRef.current) onExitReplay?.();
  }, [ticker]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (replayRef.current && replayTimeRef.current == null) onExitReplay?.();
  }, [timeframe]); // eslint-disable-line react-hooks/exhaustive-deps
  const [replayNonce, setReplayNonce] = useState(0);
  /** Dev only: what the replay applied — read by the probes */
  const [replayDebug, setReplayDebug] = useState('');
  /* The chart's OWN replay (Pulse, Terrain): pick a bar first, then the same
     strip the Map wears — by bars, at bars a second, the day marks under the
     track, the bar's own day and minute as the words */
  const [ownPhase, setOwnPhase] = useState<'pick' | 'play'>('pick');
  const [replayMarks, setReplayMarks] = useState<{ u: number; label: string }[]>([]);
  const external = replayTime != null;
  const picking = pickTime || (replay && !external && ownPhase === 'pick');

  /* PICKING A BAR: the crosshair turns into a silver line without a horizontal
     arm, and a click hands the bar's time up; on the way out the crosshair
     goes back to what the price tag's own rule wants */
  const onPickTimeRef = useRef(onPickTime);
  onPickTimeRef.current = onPickTime;
  /* THE FUTURE, FADED (Noah, 2026-09-08, TradingView's replay: "every candle
     right of the vertical line is faded"): a wash from the pointer's line to
     the plot's right edge, over the bars the replay would not yet have seen.
     THE LINE IS OURS, NOT THE LIBRARY'S: its crosshair snaps to bar centres
     and the line "took a stop at each candle" (Noah) — this one sits at the
     pointer's own x, moved through refs on every pointer event so it glides
     without a React render; the state below only mounts it and holds the
     axes' sizes. */
  const [pickFade, setPickFade] = useState<{ right: number; bottom: number } | null>(null);
  const pickFadeRef = useRef<HTMLDivElement | null>(null);
  const pickLineRef = useRef<HTMLDivElement | null>(null);
  const pickLabelRef = useRef<HTMLDivElement | null>(null);
  const pickXRef = useRef(0);
  const placePick = (x: number) => {
    pickXRef.current = x;
    if (pickFadeRef.current) pickFadeRef.current.style.left = `${x}px`;
    if (pickLineRef.current) pickLineRef.current.style.left = `${x}px`;
    if (pickLabelRef.current) pickLabelRef.current.style.left = `${x}px`;
  };
  const ownLabelRef = useRef('');
  useEffect(() => {
    const chart = chartRef.current;
    if (!picking || !chart) return;
    chart.applyOptions({ crosshair: { vertLine: { visible: false, labelVisible: false }, horzLine: { visible: false, labelVisible: false } } });
    const onClick = (p: MouseEventParams<Time>) => {
      if (typeof p.time !== 'number') return;
      if (pickTime) {
        onPickTimeRef.current?.(p.time as number);
        return;
      }
      /* Our own pick: the bar becomes the position, paused */
      const bars = replayDataRef.current?.bars;
      if (!bars) return;
      let i = bars.length;
      while (i > 0 && bars[i - 1].time > (p.time as number)) i--;
      replayAppliedRef.current = 0;
      setReplayIdx(Math.max(31, i));
      setReplayNonce(n => n + 1);
      setReplayPlaying(false);
      setOwnPhase('play');
    };
    let mounted = false;
    const onHover = (p: MouseEventParams<Time>) => {
      if (!p.point) {
        mounted = false;
        setPickFade(null);
        return;
      }
      placePick(p.point.x);
      /* The bar's own day and minute under the line — through the ref, no
         render; the host's page holds still until a bar is picked (2026-09-11) */
      ownLabelRef.current = typeof p.time === 'number' ? timeWords(p.time as number) : '';
      if (pickLabelRef.current) pickLabelRef.current.textContent = ownLabelRef.current;
      if (!mounted) {
        mounted = true;
        setPickFade({ right: chart.priceScale('right').width(), bottom: chart.timeScale().height() });
      }
    };
    chart.subscribeClick(onClick);
    chart.subscribeCrosshairMove(onHover);
    return () => {
      chart.unsubscribeClick(onClick);
      chart.unsubscribeCrosshairMove(onHover);
      setPickFade(null);
      const tagOn = priceTag && !replay;
      const sx = chartSurface(getCandleTheme());
      chart.applyOptions({
        crosshair: {
          vertLine: { color: sx.crosshair, width: 1, style: 3, labelBackgroundColor: sx.label },
          horzLine: { visible: !tagOn, labelVisible: !tagOn, color: sx.crosshair, labelBackgroundColor: sx.label },
        },
      });
    };
  }, [picking, pickTime, priceTag, replay, mainNonce]);

  /* The host's clock moves the position: the last bar at or before its time */
  const replayTimeRef = useRef<number | null>(replayTime);
  replayTimeRef.current = replayTime;
  useEffect(() => {
    if (!replay || replayTime == null) return;
    const bars = replayDataRef.current?.bars;
    if (!bars) return;
    let i = bars.length;
    while (i > 0 && bars[i - 1].time > replayTime) i--;
    setReplayIdx(Math.max(31, i));
  }, [replay, replayTime]);

  // Apply the current replay position to the series (append fast-path when
  // stepping forward one bar; full slice on scrubs/jumps).
  useEffect(() => {
    if (!replay) return;
    /* Our own replay has no position until a bar is picked */
    if (!external && ownPhase === 'pick') return;
    const data = replayDataRef.current;
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    const trails = trailsRef.current;
    if (!data || !candleSeries || !volumeSeries || !trails) return;

    // replayIdx still holds its pre-entry value on the entry commit (the
    // lifecycle effect's setReplayIdx lands NEXT commit) — never touch the
    // series until a real position arrives, and never fast-append onto a
    // series that hasn't been sliced yet.
    if (replayIdx < 31) return;
    const theme = getCandleTheme();
    const idx = Math.max(1, Math.min(replayIdx, data.bars.length));
    const fresh = replayAppliedRef.current === 0;
    if (idx === replayAppliedRef.current + 1 && replayAppliedRef.current >= 1) {
      const bar = data.bars[idx - 1];
      candleSeries.update(toMain(bar));
      volumeSeries.update(toVolume(bar, theme));
    } else {
      const visible = data.bars.slice(0, idx);
      candleSeries.setData(visible.map(toMain));
      volumeSeries.setData(visible.map(b => toVolume(b, theme)));
    }
    replayAppliedRef.current = idx;
    barCountRef.current = idx;

    /* Keep the moment on screen: on entry, and on a seek that lands past the
       visible edge or leaves fewer than twenty bars of history in view, the
       range comes along; a step inside it leaves the reader's view alone */
    const chart = chartRef.current;
    const vis = chart?.timeScale().getVisibleLogicalRange();
    if (chart && (fresh || !vis || idx - 1 > vis.to - 2 || idx - 1 - vis.from < 20)) {
      const span = fresh || !vis ? 120 : Math.max(20, vis.to - vis.from);
      chart.timeScale().setVisibleLogicalRange({ from: idx - 1 - span + 10, to: idx - 1 + 10 });
    }
    if (import.meta.env?.DEV) {
      const v2 = chart?.timeScale().getVisibleLogicalRange();
      setReplayDebug(`${v2 ? `${Math.round(v2.from)}..${Math.round(v2.to)}` : 'none'} · ${data.bars.length} bars · ${data.bars[Math.max(0, idx - 1)]?.time}`);
    }

    const cutoff = data.bars[idx - 1].time;
    const mins = tfMinutes(timeframe);
    // The replay's last bar is complete — its sub-bar beads belong to it
    trails.setData(
      data.snaps.filter(s => s.time < cutoff + mins * 60),
      data.maxAbs,
      overlays.trails && mins <= INTRADAY_MAX_MINUTES,
      mins * 60,
      trailsGreek
    );
  }, [replay, replayIdx, replayNonce, ownPhase, external, overlays.trails, timeframe]); // eslint-disable-line react-hooks/exhaustive-deps

  // Playback clock — `replaySpeed` bars a second
  useEffect(() => {
    if (!replay || !replayPlaying) return;
    const id = window.setInterval(() => {
      setReplayIdx(i => {
        const len = replayDataRef.current?.bars.length ?? 0;
        if (i >= len) {
          setReplayPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, Math.round(1000 / replaySpeed));
    return () => window.clearInterval(id);
  }, [replay, replayPlaying, replaySpeed]);

  // ---- drawings -------------------------------------------------------------
  // Per-ticker load; marks are the user's, so they persist across sessions
  useEffect(() => {
    shapesRef.current = loadDrawings(ticker);
    drawingsRef.current?.setDrawings([...shapesRef.current]);
  }, [ticker]);

  const commitDrawing = useCallback(
    (d: Drawing) => {
      shapesRef.current = [...shapesRef.current, d];
      drawingsRef.current?.setDrawings(shapesRef.current);
      saveDrawings(ticker, shapesRef.current);
      /* THE TOOL EMPTIES INTO YOUR HAND (Noah, 2026-08-28: "when i try to
         drag the line i just created it instead created another line...
         trading view doesnt have that type of bug"). Placing a mark drops
         the tool back to Select with the new mark already selected, so the
         very next drag MOVES it. Want another one? Re-click the tool on the
         rail — TradingView's own grammar. */
      setDrawTool('select');
      const idx = shapesRef.current.length - 1;
      setSelectedIdx(idx);
      drawingsRef.current?.setSelected(idx);
    },
    [ticker]
  );

  /* ── THE FLOATING MARK BAR (Noah, 2026-08-28, the reference's own) ──
     Appears whenever a mark is selected; movable anywhere on the pane by
     its grip; its trash kills ONLY the selected mark. Line color, the
     note's text color, weight, pattern, and the padlock all write straight
     onto the mark and persist with it. The settings dialog and the two
     crossed-out controls are deliberately absent. */
  const railPrefs = useRailPrefs();
  /* The dock the reader asked for, honoured only where it fits. */
  const rail = {
    open: railPrefs.open,
    dock: railPrefs.dock === 'top' && railTopOk ? ('top' as const) : ('left' as const),
    /** Both docks reachable here? Drives whether the flip button shows. */
    canTop: railTopOk,
  };
  /* where the host strip's gap is, when the rail rides the top */
  const gap = useToolbarGap(containerRef, rail.dock === 'top');
  const topDockStyle = rail.dock === 'top' && gap ? { left: gap.left + gap.width / 2, transform: 'translateX(-50%)', maxWidth: Math.max(160, gap.width - 16) } : undefined;
  const [, forceMark] = useReducer((x: number) => x + 1, 0);
  const [barPos, setBarPos] = useState<{ x: number; y: number } | null>(null);
  const [barMenu, setBarMenu] = useState<'color' | 'tcolor' | 'width' | 'style' | null>(null);
  useEffect(() => setBarMenu(null), [selectedIdx]);

  const updateSelected = useCallback(
    (patch: Partial<Drawing>) => {
      const i = selectedIdx;
      if (i === null) return;
      shapesRef.current = shapesRef.current.map((d, idx) => (idx === i ? { ...d, ...patch } : d));
      drawingsRef.current?.setDrawings(shapesRef.current);
      saveDrawings(ticker, shapesRef.current);
      forceMark();
    },
    [selectedIdx, ticker]
  );

  const onBarGripDown = (e: ReactPointerEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const wrap = containerRef.current;
    const bar = (e.currentTarget as HTMLElement).parentElement;
    if (!wrap || !bar) return;
    const rect = wrap.getBoundingClientRect();
    const bRect = bar.getBoundingClientRect();
    const dx = e.clientX - bRect.left;
    const dy = e.clientY - bRect.top;
    const move = (ev: PointerEvent) => {
      setBarPos({
        x: Math.min(rect.width - bRect.width, Math.max(0, ev.clientX - rect.left - dx)),
        y: Math.min(rect.height - bRect.height, Math.max(0, ev.clientY - rect.top - dy)),
      });
    };
    const up = () => window.removeEventListener('pointermove', move);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
  };

  const clearDrawings = useCallback(() => {
    shapesRef.current = [];
    drawingsRef.current?.setDrawings([]);
    saveDrawings(ticker, []);
    deselect();
  }, [ticker, deselect]);

  const pointFromClient = (clientX: number, clientY: number): { time: number; price: number } | null => {
    const container = containerRef.current;
    const candleSeries = candleSeriesRef.current;
    const prim = drawingsRef.current;
    if (!container || !candleSeries || !prim) return null;
    const rect = container.getBoundingClientRect();
    const time = prim.xToTime(clientX - rect.left);
    const price = candleSeries.coordinateToPrice(clientY - rect.top);
    if (time === null || price === null) return null;
    return { time, price };
  };
  const pointAt = (e: ReactPointerEvent<HTMLDivElement>) => pointFromClient(e.clientX, e.clientY);

  /*
    A MARK IS NEVER STATIC (Noah, 2026-08-28: "when i exit the toolbar and
    decide to click on ANY of my tools on the chart... i should be thrown
    back into the edit portion... instead its just static").

    Outside draw mode the edit overlay is unmounted and the tape owns the
    pointer — so this capture-phase handler on the chart's own container is
    the marks' standing doorbell. A press that lands on a mark (body or
    anchor) stops the chart's pan before it starts, wakes the editor with
    that mark selected, and rides THIS SAME GESTURE as the first drag —
    window-level listeners carry the move/up because the overlay cannot
    mount mid-gesture. A press on empty tape falls through untouched.
  */
  const onSleepingMarkDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (drawing) return; // the overlay owns the pointer in draw mode
    const rect = containerRef.current?.getBoundingClientRect();
    const prim = drawingsRef.current;
    if (!rect || !prim) return;
    const hit = prim.hitTestAt(e.clientX - rect.left, e.clientY - rect.top);
    if (!hit) return;
    e.preventDefault();
    e.stopPropagation();
    onEnterDraw?.();
    setDrawTool('select');
    setSelectedIdx(hit.index);
    prim.setSelected(hit.index);
    const start = pointFromClient(e.clientX, e.clientY);
    if (!start) return;
    editRef.current = { index: hit.index, anchor: hit.anchor, start, orig: shapesRef.current[hit.index], moved: false };
    const move = (ev: PointerEvent) => {
      const pt = pointFromClient(ev.clientX, ev.clientY);
      if (pt) applyEdit(pt);
    };
    const up = () => {
      if (editRef.current?.moved) saveDrawings(ticker, shapesRef.current);
      editRef.current = null;
      window.removeEventListener('pointermove', move);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
  };

  const deleteSelected = useCallback(() => {
    setSelectedIdx(idx => {
      if (idx !== null && shapesRef.current[idx]) {
        shapesRef.current = shapesRef.current.filter((_, i) => i !== idx);
        drawingsRef.current?.setDrawings(shapesRef.current);
        saveDrawings(ticker, shapesRef.current);
      }
      drawingsRef.current?.setSelected(null);
      return null;
    });
    editRef.current = null;
  }, [ticker]);

  /* DELETE AND BACKSPACE REMOVE THE SELECTED MARK (2026-09-06, Noah on the
     Map: "i see some random fib chart but cant remove it") — the key every
     drawing tool honours, beside the rail's bin. Not while typing a note. */
  useEffect(() => {
    if (selectedIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      e.preventDefault();
      deleteSelected();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedIdx, deleteSelected]);

  const onDrawDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = pointAt(e);
    if (!p) return;

    /*
      THE SELECT TOOL — the pointer that picks a mark up instead of making
      one. A press on an anchor starts an anchor edit, a press on the ink
      between anchors starts a whole-mark move, and a press on nothing puts
      the selection down. Hit-testing is the primitive's (it owns the
      geometry); this handler only decides what the press MEANS.
    */
    if (drawTool === 'select') {
      const rect = containerRef.current?.getBoundingClientRect();
      const hit = rect ? drawingsRef.current?.hitTestAt(e.clientX - rect.left, e.clientY - rect.top) ?? null : null;
      if (!hit) {
        /* TV's exit (Noah, 2026-08-28: "you just click anywhere that is NOT
           a tool you placed down and it takes you out of it") — a press on
           empty tape doesn't just drop the selection, it leaves edit mode.
           The checkmark this replaced is gone from the rail. */
        deselect();
        onExitDraw?.();
        return;
      }
      e.currentTarget.setPointerCapture(e.pointerId);
      setSelectedIdx(hit.index);
      drawingsRef.current?.setSelected(hit.index);
      editRef.current = { index: hit.index, anchor: hit.anchor, start: p, orig: shapesRef.current[hit.index], moved: false };
      return;
    }
    /* The click-move-click SECOND PRESS: the anchor in the hand lands. A
       three-anchor kind moves on to its width phase; the rest commit. */
    if (pendingSecondRef.current) {
      const base = pendingSecondRef.current;
      pendingSecondRef.current = null;
      if (needsThirdAnchor(base.kind)) {
        pendingThirdRef.current = { ...base, p2: p };
        drawingsRef.current?.setDraft({ ...base, p2: p });
        return;
      }
      drawingsRef.current?.setDraft(null);
      commitDrawing({ ...base, p2: p });
      return;
    }
    /* A THIRD-ANCHOR KIND'S SECOND PHASE ends on the next press: the base
       was drawn and released, the third anchor (the channel's width, the
       curve's bend) has been tracking the pointer since, and this click is
       the reader saying "there". */
    if (pendingThirdRef.current) {
      const base = pendingThirdRef.current;
      pendingThirdRef.current = null;
      drawingsRef.current?.setDraft(null);
      commitDrawing({ ...base, p3: p });
      return;
    }
    if (drawTool === 'hline' || drawTool === 'vline') {
      commitDrawing({ kind: drawTool, p1: p });
      return;
    }
    if (drawTool === 'note') {
      /*
        The words come from a floating input at the click; Enter commits it.

        preventDefault, and it is load-bearing: React commits the input and
        its autoFocus DURING this event's dispatch, and the pointerdown's
        DEFAULT action — moving focus to the pressed element's focusable
        ancestor, which is <body> here — runs after dispatch ends. Measured
        with a focus listener: `focus 11977, blur 11978` — the input lived
        one millisecond, and the blur handler read it as the reader walking
        away. Cancelling the pointerdown cancels its compatibility mouse
        events and their focus change with it.
      */
      e.preventDefault();
      setNoteAt({ time: p.time, price: p.price, x: e.clientX, y: e.clientY });
      return;
    }
    if (drawTool === 'path') {
      /* THE PATH PLOTS BY CLICKS (Noah, 2026-08-29: "it keeps plotting
         points as you click and stop when you double click") — each press
         adds a point; the draft's tail rides the cursor; the double-click
         handler below seals it with the head. */
      const run = pathDraftRef.current ?? [];
      run.push(p);
      pathDraftRef.current = run;
      drawingsRef.current?.setDraft({ kind: 'path', p1: run[0], pts: [...run, p] });
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    /* Every two-anchor kind takes the same gesture; only what gets drawn
       between the anchors differs. */
    dragOriginRef.current = { x: e.clientX, y: e.clientY };
    dragRef.current = { kind: drawTool, p1: p, p2: p };
    drawingsRef.current?.setDraft(dragRef.current);
  };

  const onDrawDblClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (drawTool !== 'path' || !pathDraftRef.current) return;
    /* The seal — and the wrapper's own dblclick is resetView, which must
       not fire under a finished path. */
    e.stopPropagation();
    e.preventDefault();
    const run = pathDraftRef.current;
    pathDraftRef.current = null;
    drawingsRef.current?.setDraft(null);
    /* The double-click's two presses plotted the final point twice —
       consecutive same-bar points collapse to one. */
    const pts = run.filter((q, i2, arr) => i2 === 0 || q.time !== arr[i2 - 1].time);
    if (pts.length >= 2) commitDrawing({ kind: 'path', p1: pts[0], pts });
  };

  const applyEdit = (p: { time: number; price: number }) => {
    const ed = editRef.current;
    const prim = drawingsRef.current;
    if (!ed || !prim) return;
    /* A LOCKED mark selects (that is how it gets unlocked) but never moves
       or reshapes — the bar's padlock is the only thing that can touch it. */
    if (shapesRef.current[ed.index]?.locked) return;
    let next: Drawing;
    if (ed.anchor !== null) {
      if (ed.orig.kind === 'path' && ed.orig.pts) {
        const pts = ed.orig.pts.map((q, k2) => (k2 === ed.anchor ? p : q));
        next = { ...ed.orig, pts, p1: pts[0] };
      } else {
        next = ed.anchor === 0 ? { ...ed.orig, p1: p } : ed.anchor === 1 ? { ...ed.orig, p2: p } : { ...ed.orig, p3: p };
      }
    } else {
      /*
        A BODY DRAG moves the whole mark in (bars, price): the price shift is
        the pointer's own, and the time shift is a WHOLE NUMBER OF BARS on
        the current grid — anchored times must land on the grid to survive a
        timeframe switch, so a mark slides along it rather than off it. NO
        edge clamp any more (Noah, 2026-08-28: "it looks like it hit an
        imaginary wall") — the grid extrapolates past both ends at the bar
        step, so the runway right of the last candle is as movable-into as
        anywhere else, and the mark's shape is preserved exactly because
        every point shifts by the same k on one uniform grid.
      */
      const dPrice = p.price - ed.start.price;
      const i0 = prim.barIndexOf(ed.start.time);
      const i1 = prim.barIndexOf(p.time);
      if (i0 === null || i1 === null) return;
      const k = i1 - i0;
      const shift = (q?: { time: number; price: number }) => {
        if (!q) return undefined;
        const bi = prim.barIndexOf(q.time);
        const t = bi === null ? null : prim.timeAtBarIndex(bi + k);
        return t === null ? q : { time: t, price: q.price + dPrice };
      };
      next = { ...ed.orig, p1: shift(ed.orig.p1)!, p2: shift(ed.orig.p2), p3: shift(ed.orig.p3) };
      if (ed.orig.kind === 'path' && ed.orig.pts) {
        const pts = ed.orig.pts.map(q => shift(q) ?? q);
        next = { ...next, pts, p1: pts[0] };
      }
    }
    ed.moved = true;
    shapesRef.current = shapesRef.current.map((d, i) => (i === ed.index ? next : d));
    prim.setDrawings(shapesRef.current);
  };

  const onDrawMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    /*
      THE CURSOR SAYS WHICH EDIT THIS IS (Noah, 2026-08-28: "one is the
      laditudinal/longitudinal being changed aka WHERE is it. the other is
      the shape/size"). Over a mark's BODY — a move, position about to
      change — the pointing finger. Over an ANCHOR circle — a reshape,
      geometry about to change — the plain arrow. Everywhere a tool is
      armed, the crosshair: that cursor means "a mark lands here". Written
      straight onto the overlay's style, not through state — this runs per
      pointer move and a re-render per mouse-twitch would be jank for a
      cursor.
    */
    if (drawTool === 'select') {
      const edit = editRef.current;
      let cursor = 'crosshair';
      if (edit) {
        cursor = edit.anchor !== null ? 'default' : 'pointer';
      } else {
        const rect = containerRef.current?.getBoundingClientRect();
        const hover = rect ? drawingsRef.current?.hitTestAt(e.clientX - rect.left, e.clientY - rect.top) ?? null : null;
        if (hover) cursor = hover.anchor !== null ? 'default' : 'pointer';
      }
      e.currentTarget.style.cursor = cursor;
      if (!edit) return;
      const p = pointAt(e);
      if (p) applyEdit(p);
      return;
    }
    e.currentTarget.style.cursor = 'crosshair';
    /* Click-move-click: the line in the hand follows the pointer. */
    if (pendingSecondRef.current) {
      const p = pointAt(e);
      if (p) drawingsRef.current?.setDraft({ ...pendingSecondRef.current, p2: p });
      return;
    }
    /* The path's tail rides the pointer between clicks. */
    if (drawTool === 'path' && pathDraftRef.current) {
      const p = pointAt(e);
      if (p) drawingsRef.current?.setDraft({ kind: 'path', p1: pathDraftRef.current[0], pts: [...pathDraftRef.current, p] });
      return;
    }
    /* Width phase: the draft is the base plus a p3 riding the pointer. */
    if (pendingThirdRef.current) {
      const p = pointAt(e);
      if (p) drawingsRef.current?.setDraft({ ...pendingThirdRef.current, p3: p });
      return;
    }
    if (!dragRef.current) return;
    const p = pointAt(e);
    if (!p) return;
    dragRef.current = { ...dragRef.current, p2: p };
    drawingsRef.current?.setDraft(dragRef.current);
  };

  /* A tool change or a mode exit abandons an unsealed path — half a path
     committing itself would be a mark nobody asked for. */
  useEffect(() => {
    if (drawTool !== 'path' && pathDraftRef.current) {
      pathDraftRef.current = null;
      drawingsRef.current?.setDraft(null);
    }
    /* The armed half-made line dies with the hand that held it. */
    if (pendingSecondRef.current && pendingSecondRef.current.kind !== drawTool) {
      pendingSecondRef.current = null;
      drawingsRef.current?.setDraft(null);
    }
  }, [drawTool]);
  useEffect(() => {
    if (!drawing && pathDraftRef.current) {
      pathDraftRef.current = null;
      drawingsRef.current?.setDraft(null);
    }
    if (!drawing && pendingSecondRef.current) {
      pendingSecondRef.current = null;
      drawingsRef.current?.setDraft(null);
    }
  }, [drawing]);

  const onDrawUp = (e?: ReactPointerEvent<HTMLDivElement>) => {
    if (editRef.current) {
      /* An edit is already applied live; release just makes it stored. */
      if (editRef.current.moved) saveDrawings(ticker, shapesRef.current);
      editRef.current = null;
      return;
    }
    const d = dragRef.current;
    const origin = dragOriginRef.current;
    dragRef.current = null;
    dragOriginRef.current = null;
    if (!d || !d.p2) return;
    /* A real DRAG, measured in pixels — time/price deltas lied here: one
       bar of jitter on a quick click committed a degenerate arrow ("plops
       the entire thing down"). Under the threshold the release ARMS
       click-move-click instead: the draft stays, the line follows the
       cursor, the next press plants the second anchor. */
    const real = !!origin && !!e && Math.hypot(e.clientX - origin.x, e.clientY - origin.y) >= 5;
    if (!real) {
      pendingSecondRef.current = { kind: d.kind, p1: d.p1 };
      drawingsRef.current?.setDraft(d);
      return;
    }
    /* A three-anchor kind is not finished at release — the base is. The
       draft STAYS, the third-anchor phase begins (the channel's width, the
       curve's bend), and the next press commits (onDrawDown). */
    if (needsThirdAnchor(d.kind)) {
      pendingThirdRef.current = d;
      drawingsRef.current?.setDraft(d);
      return;
    }
    drawingsRef.current?.setDraft(null);
    commitDrawing(d);
  };

  return (
    <div className="flex flex-col h-full">
      {/* No legend row — the chart owns the whole widget; inks are taught by
          the field itself, dbl-click resets the view (Noah, 2026-08-23) */}
      <div
        className={`relative flex-grow overflow-hidden ${
          frameless ? '' : 'border border-borderSubtle bg-inset rounded-md'
        }`}
        style={{ minHeight: height }}
        /* Everything in this box sits on the chart's ground — the dark island
           every chart is (data-theme, theme/tokens.css; Noah, 2026-09-12:
           "the charts to by default always be black"), re-scoped to a light
           candle canvas's inks by index.css [data-chart-ground='light'] */
        data-theme="dark"
        data-chart-ink
        onDoubleClick={resetView}
        onMouseMove={e => {
          /* The event lane's hover — resolved here because canvas glyphs
             cannot be hovered and the card wants real type. Cheap: one hit
             test per move, state written only when the answer changes. */
          const prim = eventsPrimRef.current;
          if (!prim?.data) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const plotH = chartRef.current?.paneSize(0).height ?? rect.height;
          const hit = prim.eventAtX(e.clientX - rect.left, e.clientY - rect.top, plotH);
          prim.setHovered(hit);
          setEventCard(prev => {
            if (hit === null) return prev === null ? prev : null;
            const x = prim.xOf(hit);
            if (x === null) return null;
            return prev?.e === hit ? prev : { e: hit, x };
          });
        }}
        onMouseLeave={() => {
          eventsPrimRef.current?.setHovered(null);
          setEventCard(null);
        }}
      >
        {picking && pickFade && (
          <>
            <div ref={pickFadeRef} aria-hidden className="absolute top-0 z-[5] pointer-events-none" style={{ left: pickXRef.current, right: pickFade.right, bottom: pickFade.bottom, background: 'rgba(10,10,10,0.72)' }} data-pick-fade />
            <div ref={pickLineRef} aria-hidden className="absolute top-0 z-[6] w-px pointer-events-none" style={{ left: pickXRef.current, bottom: pickFade.bottom, background: 'rgba(199,211,232,0.9)' }} data-pick-line />
            {/* The bar's day and minute under the line — its text moves through the ref with the pointer */}
            <div ref={pickLabelRef} aria-hidden className="absolute z-[6] -translate-x-1/2 px-1.5 py-0.5 rounded-[3px] font-mono text-[10px] tnum whitespace-nowrap pointer-events-none" style={{ left: pickXRef.current, bottom: pickFade.bottom + 4, background: '#C7D3E8', color: '#0a0a0a' }} data-pick-label>
              {ownLabelRef.current}
            </div>
          </>
        )}
        <div ref={containerRef} className={`absolute inset-0 ${picking ? 'cursor-crosshair' : ''}`} onPointerDownCapture={onSleepingMarkDown} data-pick-time={picking ? '' : undefined} data-replay-idx={replay ? replayIdx : undefined} data-replay-len={replay ? (replayDataRef.current?.bars.length ?? 0) : undefined} data-replay-time={replay && replayTime != null ? replayTime : undefined} data-replay-debug={replay ? replayDebug : undefined} />
        {/* The way home — pill, right-click card, Alt+R (2026-08-30) */}
        <ResetViewControl onReset={resetView} />
        {/* The scripts on this pane, named at the top left with hide and remove (2026-09-10) */}
        {paneId && paneScripts.length > 0 && !replay && <ScriptLegend paneId={paneId} scripts={paneScripts} />}
        {/* Every band says its own name, the way the reference does. An
            unlabelled strip under a chart is a puzzle; `pointer-events-none` so
            the tape still pans straight through them. Positions are measured
            off the live layout — see remeasurePaneLabels. */}
        {paneLabels.map(l => {
          const look = PANE_LABEL_LOOK[l.key];
          if (!look) return null;
          return (
            <span
              key={l.key}
              aria-hidden
              className="pointer-events-none absolute left-2 z-10 rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-widest"
              style={{ bottom: l.bottom, background: look.bg, color: look.fg }}
            >
              {look.text}
            </span>
          );
        })}


        {/* The pane's own fired chip (2026-08-28) left on 2026-09-10: the
            shell shows ONE chip for a firing wherever the reader is
            (components/alerts/AlertToasts.tsx), so a chart of the name no
            longer says it twice. The price line turning solid stays — the
            in-place mark. */}

        {/* Pinned to the container's right edge and moved down it by
            transform, so it rides the price scale rather than being re-laid
            out. OUR skin, kept through the port (Noah, 2026-08-25 called the
            slate-bubble original "childs play", and 2026-08-28 called its
            ported return childish again): near-black card, hairline border
            with the white left accent, right-aligned, the countdown a
            whisper under the price. The gutter-measured width is HIS — the
            one part of the ported card worth keeping. */}
        {priceTag && !replay && (
          <div
            ref={priceTagRef}
            aria-hidden
            className="pointer-events-none absolute top-0 right-0 z-10 rounded-[4px] border border-borderSubtle border-l-2 border-l-white/60 pl-2 pr-1.5 py-[3px] text-right opacity-0 shadow-md shadow-black/50"
            style={{ background: 'rgba(8,8,10,0.88)', backdropFilter: 'blur(3px)' }}
          >
            <div className="font-mono text-[12px] font-bold leading-[14px] tnum text-textPrimary" />
            <div className="font-mono text-[9px] leading-[11px] tnum text-textMuted" />
          </div>
        )}

        {/* Draw mode: pointer sketches instead of panning */}
        {drawing && (
          <div
            className="absolute inset-0 z-20 cursor-crosshair touch-none"
            onPointerDown={onDrawDown}
            onDoubleClick={onDrawDblClick}
            onPointerMove={onDrawMove}
            onPointerUp={onDrawUp}
          />
        )}
        {!compact && (drawing || onEnterDraw) && !rail.open && (
          /* THE WAY BACK — a slim tab at the docked edge, always there, so a
             hidden toolbar is one click from found (TV's collapse grammar). */
          <button
            onClick={() => setRailPrefs({ open: true })}
            title="Show the drawing tools"
            aria-label="Show the drawing tools"
            className={`absolute ${rail.dock === 'top' ? 'z-40' : 'z-30'} border border-borderMuted bg-panel/60 backdrop-blur-md text-textSecondary hover:text-textPrimary shadow-lg shadow-black/40 transition-[opacity,color] duration-300 opacity-55 hover:opacity-100 ${
              rail.dock === 'left'
                ? 'left-0 top-1/2 -translate-y-1/2 rounded-r-md border-l-0 px-1 py-2.5'
                : /* the tab hangs from the pane's top edge, in the strip's middle, over the strip */
                  `top-0 rounded-b-md border-t-0 px-2.5 py-1 ${gap ? '' : 'left-[calc(50%-48px)] -translate-x-1/2'}`
            }`}
            style={rail.dock === 'top' && gap ? { left: gap.left + gap.width / 2, transform: 'translateX(-50%)' } : undefined}
          >
            <Pencil className="w-3 h-3" />
          </button>
        )}
        {!compact && (drawing || onEnterDraw) && rail.open && (
          /*
            THE TOOL RAIL — persistent, and the reader's to place (Noah,
            2026-08-28: "lets start by adding a toolbar that we talked
            about"; 2026-08-29: "a toolbar only if they please... move the
            toolbar up top"). SOLID, not ghost chrome (Noah: "i cant see
            them"). Clicking any tool arms draw mode with that tool in hand;
            WHILE DRAWING it grows its editing tail. The two meta buttons at
            the end are the rail managing ITSELF: flip dock, and hide (the
            slim tab above is the way back). Phone and compact panes keep
            the toolbar door instead — a 34px column over a 350px pane is a
            wall.
          */
          <div
            /* GLASS, AND ONLY LOUD IN THE HAND (Noah, 2026-08-29: "the
               toolbar is translucent so you can see the chart through it and
               its only noticeable when you hover over that section... when
               you are currently editing a tool it should stay there until
               finished"). At rest it is a whisper — enough to find by
               position, quiet enough to never compete with the tape; hover
               or keyboard focus wakes it, and WHILE DRAWING it pins fully
               visible until the hand exits. This supersedes the solid-panel
               ruling ("i cant see them") with the piece it was missing: the
               rail is always seen when it is being USED. Transitions ride
               the house 300ms. */
            /* AT REST IT MUST STILL BE FOUND (Noah, 2026-09-12, the fullscreen
               chart: "my toolbar inside the charts keeps disappearing... like
               cant even see anything at all... do you see it? even remnants of
               it cause i dont"): the 20% whisper read as gone on his screen.
               The identity row's rest-dim, 55%, is the house's "quiet but
               there"; hover, focus and drawing still bring it to full. */
            className={`absolute ${rail.dock === 'top' ? 'z-40' : 'z-30'} border border-borderMuted bg-panel/60 backdrop-blur-md backdrop-saturate-150 rounded-md p-1 shadow-xl shadow-black/50 select-none flex items-stretch ${rail.dock === 'top' ? 'gap-px' : 'gap-0.5'} transition-opacity duration-300 ${
              drawing ? 'opacity-100' : 'opacity-55 hover:opacity-100 focus-within:opacity-100'
            } ${
              rail.dock === 'left'
                ? 'left-1.5 top-1/2 -translate-y-1/2 w-[34px] max-h-[92%] overflow-y-auto flex-col'
                : /* Not true center (Noah, 2026-08-29: "too close to the right
                     leaving more empty space to the left") — the hosts' strip
                     clusters are asymmetric: the right one (Replay → Theme)
                     reaches ~96px further into the middle than the timeframes
                     do from the left, so the empty band's visual center sits
                     LEFT of 50%. The clusters are fixed-width, so a constant
                     nudge holds at every screen width. */
                  /* IN THE STRIP'S EMPTY MIDDLE, ABOVE IT (Noah, 2026-09-12, the
                     fullscreen chart: "boom its completely gone", then "it
                     should sit in between the timeframes and the replay
                     button"): the top dock exists only where a host has a top
                     band — the takeovers — and every one of them wears a 44px
                     strip with its clusters at the two ends; the rail takes the
                     gap between them, on the strip's own line, and z-40 keeps
                     it over the strip (at z-30 it sat BEHIND Terrain's —
                     elementFromPoint at its centre returned the strip). */
                  `top-1.5 h-[34px] overflow-x-auto flex-row ${gap ? '' : 'left-[calc(50%-48px)] -translate-x-1/2 max-w-[94%]'}`
            }`}
            style={topDockStyle}
          >
            <button
              onClick={() => setDrawTool('select')}
              title="Select — click a drawing to move or delete it"
              aria-label="Select"
              aria-pressed={drawTool === 'select'}
              className={`inline-flex items-center justify-center rounded transition-colors shrink-0 ${
                rail.dock === 'left' ? 'h-[26px]' : 'w-[24px]'
              } ${
                drawing && drawTool === 'select'
                  ? 'bg-select/15 text-select'
                  : 'text-textSecondary hover:text-textPrimary hover:bg-ink/[0.04]'
              }`}
            >
              <MousePointer2 className="w-3.5 h-3.5" />
            </button>
            {DRAW_TOOL_GROUPS.map(group => (
              <div key={group.name} className={`flex items-stretch gap-0.5 ${rail.dock === 'left' ? 'flex-col' : 'flex-row'}`}>
                <div className={rail.dock === 'left' ? 'mx-1 my-0.5 h-px bg-borderMuted' : 'my-1 mx-0.5 w-px bg-borderMuted'} aria-hidden />
                {group.tools.map(item => (
                  <button
                    key={item.tool}
                    onClick={() => {
                      setDrawTool(item.tool);
                      if (!drawing) onEnterDraw?.();
                    }}
                    title={item.label}
                    aria-label={item.label}
                    aria-pressed={drawing && drawTool === item.tool}
                    className={`inline-flex items-center justify-center rounded transition-colors shrink-0 ${
                      rail.dock === 'left' ? 'h-[26px]' : 'w-[24px]'
                    } ${
                      drawing && drawTool === item.tool
                        ? 'bg-select/15 text-select'
                        : 'text-textSecondary hover:text-textPrimary hover:bg-ink/[0.04]'
                    }`}
                  >
                    {item.icon}
                  </button>
                ))}
              </div>
            ))}
            {drawing && (
              <>
                <div className={rail.dock === 'left' ? 'mx-1 my-0.5 h-px bg-borderMuted' : 'my-1 mx-0.5 w-px bg-borderMuted'} aria-hidden />
                <button
                  onClick={deleteSelected}
                  disabled={selectedIdx === null}
                  title="Delete the selected drawing"
                  aria-label="Delete selected"
                  className={`inline-flex items-center justify-center rounded transition-colors shrink-0 text-textSecondary enabled:hover:text-textPrimary enabled:hover:bg-ink/[0.04] ${
                    rail.dock === 'left' ? 'h-[26px]' : 'w-[24px]'
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={clearDrawings}
                  title="Clear all drawings"
                  aria-label="Clear all drawings"
                  className={`inline-flex items-center justify-center rounded transition-colors shrink-0 text-textSecondary hover:text-textPrimary hover:bg-ink/[0.04] ${
                    rail.dock === 'left' ? 'h-[26px]' : 'w-[24px]'
                  }`}
                >
                  <Eraser className="w-3.5 h-3.5" />
                </button>
              </>
            )}
            <div className={rail.dock === 'left' ? 'mx-1 my-0.5 h-px bg-borderMuted' : 'my-1 mx-0.5 w-px bg-borderMuted'} aria-hidden />
            {/* Offered only where the top dock would actually apply — a
                button that silently does nothing is worse than no button. */}
            {rail.canTop && <button
              onClick={() => setRailPrefs({ dock: rail.dock === 'left' ? 'top' : 'left' })}
              title={rail.dock === 'left' ? 'Move the tools to the top' : 'Move the tools to the left side'}
              aria-label={rail.dock === 'left' ? 'Move the tools to the top' : 'Move the tools to the left side'}
              className={`inline-flex items-center justify-center rounded transition-colors shrink-0 text-textMuted hover:text-textPrimary hover:bg-ink/[0.04] ${
                rail.dock === 'left' ? 'h-[26px]' : 'w-[24px]'
              }`}
            >
              {rail.dock === 'left' ? <PanelTop className="w-3.5 h-3.5" /> : <PanelLeft className="w-3.5 h-3.5" />}
            </button>}
            <button
              onClick={() => setRailPrefs({ open: false })}
              title="Hide the tools — the small tab at the edge brings them back"
              aria-label="Hide the tools"
              className={`inline-flex items-center justify-center rounded transition-colors shrink-0 text-textMuted hover:text-textPrimary hover:bg-ink/[0.04] ${
                rail.dock === 'left' ? 'h-[26px]' : 'w-[24px]'
              }`}
            >
              {rail.dock === 'left' ? <ChevronsLeft className="w-3.5 h-3.5" /> : <ChevronsUp className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}
        {drawing && selectedIdx !== null && shapesRef.current[selectedIdx] && (() => {
          const m = shapesRef.current[selectedIdx];
          /* On a note the 1–4 width field is TYPE SIZE, not stroke — the
             picker relabels itself and previews letters; the dash picker
             hides (a note has no line to dash). */
          const isNote = m.kind === 'note';
          /* Twenty inks in four rows (Noah, 2026-08-29: "i need more
             colors") — neutrals, warms, greens/cools, blues/violets. All
             chosen to survive the dark canvas; the reader's marks are
             theirs, so the wheel here is broader than the house tokens. */
          const swatches = [
            '#FFFFFF', '#EDEDED', '#C7D3E8', '#9CA3AF', '#64748B',
            '#FF3B30', '#FF6B4A', '#FF9500', '#F5C542', '#FFE08A',
            '#D2FF00', '#30D158', '#2DD4BF', '#3DD6E8', '#7DD3FC',
            '#5B9CF6', '#6366F1', '#A78BFA', '#EA00FF', '#FF5EA8',
          ];
          const btn = (on: boolean) =>
            `inline-flex items-center justify-center h-6 min-w-[24px] px-1 rounded transition-colors ${
              on ? 'bg-select/15 text-select' : 'text-textSecondary hover:text-textPrimary hover:bg-ink/[0.06]'
            }`;
          const pop = 'absolute left-0 top-full mt-1 z-50 border border-borderMuted bg-panel rounded-md shadow-2xl shadow-black/60 animate-slide-in';
          return (
            <div
              className={`absolute z-40 flex items-center gap-0.5 border border-borderMuted bg-panel/75 backdrop-blur-md backdrop-saturate-150 rounded-md p-1 shadow-xl shadow-black/50 select-none ${
                barPos ? '' : `left-1/2 -translate-x-1/2 ${rail.dock === 'top' && rail.open ? 'top-12' : 'top-2'}`
              }`}
              style={barPos ? { left: barPos.x, top: barPos.y } : undefined}
            >
              <span
                onPointerDown={onBarGripDown}
                title="Drag to move this bar"
                className="inline-flex items-center justify-center h-6 w-4 cursor-grab active:cursor-grabbing text-textMuted"
              >
                <GripVertical className="w-3.5 h-3.5" />
              </span>

              <span className="relative">
                <button onClick={() => setBarMenu(mn => (mn === 'color' ? null : 'color'))} title="Line color" className={btn(barMenu === 'color')}>
                  <span className="w-3.5 h-3.5 rounded-full border border-ink/25" style={{ background: m.color ?? '#EDEDED' }} />
                </button>
                {barMenu === 'color' && (
                  <span className={`${pop} grid grid-cols-[repeat(5,20px)] gap-1 p-1.5`}>
                    {swatches.map(c => (
                      <button
                        key={c}
                        onClick={() => {
                          updateSelected({ color: c });
                          setBarMenu(null);
                        }}
                        title={c}
                        className="w-5 h-5 rounded-full border border-ink/20 hover:scale-110 transition-transform"
                        style={{ background: c }}
                      />
                    ))}
                  </span>
                )}
              </span>

              <span className="relative">
                <button onClick={() => setBarMenu(mn => (mn === 'tcolor' ? null : 'tcolor'))} title="Text color" className={btn(barMenu === 'tcolor')}>
                  <span className="inline-flex flex-col items-center leading-none">
                    <Type className="w-3 h-3" />
                    <span className="mt-px h-[2px] w-3 rounded-full" style={{ background: m.textColor ?? m.color ?? '#EDEDED' }} />
                  </span>
                </button>
                {barMenu === 'tcolor' && (
                  <span className={`${pop} grid grid-cols-[repeat(5,20px)] gap-1 p-1.5`}>
                    {swatches.map(c => (
                      <button
                        key={c}
                        onClick={() => {
                          updateSelected({ textColor: c });
                          setBarMenu(null);
                        }}
                        title={c}
                        className="w-5 h-5 rounded-full border border-ink/20 hover:scale-110 transition-transform"
                        style={{ background: c }}
                      />
                    ))}
                  </span>
                )}
              </span>

              <span className="relative">
                <button
                  onClick={() => setBarMenu(mn => (mn === 'width' ? null : 'width'))}
                  title={isNote ? 'Text size' : 'Line weight'}
                  className={`${btn(barMenu === 'width')} gap-1`}
                >
                  {isNote ? (
                    <span className="font-semibold leading-none" style={{ fontSize: 9 + ((m.width ?? 2) - 1) * 2 }}>
                      Aa
                    </span>
                  ) : (
                    <>
                      <span className="w-4 border-t border-current" style={{ borderTopWidth: m.width ?? 2 }} />
                      <span className="font-mono text-[9px] tnum">{m.width ?? 2}px</span>
                    </>
                  )}
                </button>
                {barMenu === 'width' && (
                  <span className={`${pop} p-1 flex flex-col gap-0.5`}>
                    {[1, 2, 3, 4].map(wd => (
                      <button
                        key={wd}
                        onClick={() => {
                          updateSelected({ width: wd });
                          setBarMenu(null);
                        }}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded hover:bg-ink/[0.05] ${
                          (m.width ?? 2) === wd ? 'bg-ink/[0.08]' : ''
                        }`}
                      >
                        {isNote ? (
                          <>
                            <span className="w-8 text-textPrimary font-semibold leading-none" style={{ fontSize: 8 + wd * 2 }}>
                              Aa
                            </span>
                            <span className="font-mono text-[10px] text-textPrimary">
                              {['Small', 'Medium', 'Large', 'Huge'][wd - 1]}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="w-6 border-t border-current text-textPrimary" style={{ borderTopWidth: wd }} />
                            <span className="font-mono text-[10px] tnum text-textPrimary">{wd}px</span>
                          </>
                        )}
                      </button>
                    ))}
                  </span>
                )}
              </span>

              {!isNote && (
              <span className="relative">
                <button onClick={() => setBarMenu(mn => (mn === 'style' ? null : 'style'))} title="Line style" className={btn(barMenu === 'style')}>
                  <span
                    className="w-4 border-t-2 border-current"
                    style={{ borderTopStyle: (m.style ?? 'solid') === 'solid' ? 'solid' : m.style === 'dashed' ? 'dashed' : 'dotted' }}
                  />
                </button>
                {barMenu === 'style' && (
                  <span className={`${pop} p-1 flex flex-col gap-0.5 min-w-[124px]`}>
                    {(
                      [
                        { key: 'solid', label: 'Line', css: 'solid' },
                        { key: 'dashed', label: 'Dashed line', css: 'dashed' },
                        { key: 'dotted', label: 'Dotted line', css: 'dotted' },
                      ] as const
                    ).map(o => (
                      <button
                        key={o.key}
                        onClick={() => {
                          updateSelected({ style: o.key });
                          setBarMenu(null);
                        }}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded hover:bg-ink/[0.05] ${
                          (m.style ?? 'solid') === o.key ? 'bg-ink/[0.08]' : ''
                        }`}
                      >
                        <span className="w-6 border-t-2 border-current text-textPrimary" style={{ borderTopStyle: o.css }} />
                        <span className="font-mono text-[10px] text-textPrimary whitespace-nowrap">{o.label}</span>
                      </button>
                    ))}
                  </span>
                )}
              </span>
              )}

              <span className="mx-0.5 w-px h-4 bg-borderMuted" aria-hidden />

              <button
                onClick={() => updateSelected({ locked: !m.locked })}
                title={m.locked ? 'Unlock — allow moving again' : 'Lock in place — timeframes and drags cannot move it'}
                aria-pressed={!!m.locked}
                className={btn(!!m.locked)}
              >
                {m.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
              </button>
              <button onClick={deleteSelected} title="Delete this mark only" className={btn(false)}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })()}

        {drawing && (
          /* The active tool, named beside the rail — aria-live so a reader
             hears the hand change too. */
          <div
            aria-live="polite"
            className={`absolute z-30 pointer-events-none rounded border border-borderMuted bg-panel/95 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-widest text-select shadow-lg shadow-black/40 ${
              rail.dock === 'left' || !rail.open ? 'left-11 top-1/2 -translate-y-1/2' : 'top-11 left-[calc(50%-48px)] -translate-x-1/2'
            }`}
          >
            {drawTool === 'select' ? 'Select' : DRAW_TOOL_GROUPS.flatMap(g => g.tools).find(t => t.tool === drawTool)?.label ?? drawTool}
          </div>
        )}

        {/*
          THE NOTE'S WORDS — a floating input at the click, draw mode only.

          An input rather than a prompt(), because a prompt steals focus from
          the page and cannot be styled to say where the note will land. It
          floats at the CLICKED point, so the reader types next to the bar
          they are annotating; Enter commits, Escape abandons, and clicking
          elsewhere abandons too (blur) — a half-typed note is a gesture
          walked away from, same rule as the other tools.

          Position is clamped into the container so a note clicked at the
          right edge does not open an input the pane clips.
        */}
        {drawing && noteAt && (
          <div
            className="absolute z-40"
            style={{
              left: Math.max(4, Math.min(noteAt.x - (containerRef.current?.getBoundingClientRect().left ?? 0), (containerRef.current?.clientWidth ?? 400) - 190)),
              top: Math.max(4, Math.min(noteAt.y - (containerRef.current?.getBoundingClientRect().top ?? 0) - 14, (containerRef.current?.clientHeight ?? 300) - 36)),
            }}
          >
            <input
              autoFocus
              type="text"
              maxLength={80}
              placeholder="note, Enter to place"
              aria-label="Note text — Enter places it on the bar you clicked"
              className="w-[184px] px-2 py-1 rounded border border-select/60 bg-panel/95 font-mono text-[11px] text-textPrimary placeholder:text-textMuted shadow-xl shadow-black/50 outline-none"
              onKeyDown={e => {
                /* The desk's own keys (p, d, s, the arrows) must not fire
                   while typing — the desk's guard checks the target, but
                   stopping here keeps Escape from also collapsing a pane. */
                e.stopPropagation();
                if (e.key === 'Enter') {
                  const text = (e.target as HTMLInputElement).value.trim();
                  if (text) commitDrawing({ kind: 'note', p1: { time: noteAt.time, price: noteAt.price }, text });
                  setNoteAt(null);
                }
                if (e.key === 'Escape') setNoteAt(null);
              }}
              onBlur={() => setNoteAt(null)}
            />
          </div>
        )}

        {/* T-14's honesty chip: a sub-minute pane shows only what has
            actually printed since the app connected, and the empty region
            to the left is explained rather than silently blank. */}
        {liveFrom !== null && (
          <span className="absolute bottom-12 left-2 z-10 pointer-events-none font-mono text-[9px] uppercase tracking-wider text-textMuted bg-canvas/60 border border-borderSubtle/60 rounded px-1.5 py-0.5">
            {liveFrom === 0
              ? 'live only · awaiting first prints'
              : `live only · from ${new Date(liveFrom * 1000).toLocaleTimeString('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' })}`}
          </span>
        )}

        {/* T-11's hover card — floats above the lane at the marker's x,
            flipping to the left of it near the right edge. */}
        {eventCard && (
          <div
            className="absolute bottom-9 z-30 pointer-events-none border border-borderMuted bg-panel/95 rounded px-2 py-1.5 shadow-xl shadow-black/50 max-w-[260px]"
            style={
              eventCard.x > (containerRef.current?.clientWidth ?? 400) - 270
                ? { right: Math.max(4, (containerRef.current?.clientWidth ?? 400) - eventCard.x + 6) }
                : { left: Math.max(4, eventCard.x + 6) }
            }
          >
            <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-textPrimary whitespace-nowrap">
              {eventCard.e.label}
            </div>
            <div className="font-mono text-[9px] text-textSecondary mt-0.5">{eventCard.e.detail}</div>
          </div>
        )}

        {/* THE REPLAY STRIP — the chart's own, the same one the Map wears, along
            the foot of the plot (Noah, 2026-09-08: "every replay bar on the
            terrain/pulse pages… the same functionality… including the color");
            the Map's strip drives the chart from outside instead */}
        {replay && !external && (
          <div className="absolute bottom-0 inset-x-0 z-30">
            <ReplayStrip
              phase={ownPhase}
              pos={Math.max(0, replayIdx - 1)}
              length={Math.max(1, (replayDataRef.current?.bars.length ?? 1) - 1)}
              words={ownPhase === 'play' ? timeWords(replayDataRef.current?.bars[Math.max(0, Math.min(replayIdx, replayDataRef.current?.bars.length ?? 1) - 1)]?.time ?? 0) : undefined}
              marks={replayMarks}
              paces={BAR_PACES}
              playing={replayPlaying}
              onPlay={setReplayPlaying}
              pace={replaySpeed}
              onPace={setReplaySpeed}
              onSeek={i => setReplayIdx(Math.max(31, Math.min(replayDataRef.current?.bars.length ?? 31, Math.round(i) + 1)))}
              onExit={() => onExitReplay?.()}
              className="border-t border-b-0"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default StrikeChart;
