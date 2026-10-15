/*
==================================================
  SLAYER TERMINAL - THE PINE RUNTIME'S SHAPES
  (core/pine/types.ts)

  What goes in (bars, the reader's inputs, the
  terminal's own numbers) and what comes out (the
  lines, fills, marks and alerts a script drew) of a
  run. The runtime is a Pine v6 subset interpreted in
  the browser — never eval — see core/pine/index.ts.
==================================================
*/

import type { ScriptInputValue, ScriptPlotStyle } from '../../types/scripts';

/** One bar of the pane — time in seconds (lightweight-charts' clock) */
export interface Bar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** A colour inside the runtime: channels 0–255 and an opacity 0–1 (Pine's `transp` is 100 minus that, in percent) */
export interface PineColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** A plot or hline handed back by `plot()` / `hline()`, so `fill()` can name it */
export interface PlotRef {
  ref: 'plot' | 'hline';
  index: number;
}

/** A `[a, b, c]` value — what `ta.macd`, `ta.bb`, `ta.supertrend` and a user function may return */
export interface Tuple {
  tuple: Value[];
}

/** A function the script declared, callable by name */
export interface UserFunction {
  fn: true;
  name: string;
  params: string[];
  body: unknown;
  line: number;
}

/** Everything a Pine expression can be. `null` is `na` for anything that is not a number; a number's `na` is NaN */
export type Value = number | boolean | string | PineColor | PlotRef | Tuple | UserFunction | null;

/** The terminal's own numbers a script may read through `slayer.*` — the one namespace beyond Pine */
export interface SlayerFeed {
  /** The book's call wall and put wall (either side of the spot), the flip, the supreme strike — the pane's latest levels */
  callWall?: number;
  putWall?: number;
  flip?: number;
  supreme?: number;
}

export interface RunOptions {
  /** The reader's values for the script's inputs, by input id */
  inputs?: Record<string, ScriptInputValue>;
  /** How long a run may take before it stops and says so (SCRIPT_CAPS.budgetMs) */
  budgetMs?: number;
  ticker?: string;
  /** The pane's timeframe — the chart's own forms ("15s", "1m", "5m", "1h", "1D", "1W", data/timeframe.ts) or Pine's
      ("1", "5", "60", "D"); `timeframe.*` reads either (interpreter.ts readTimeframe) */
  timeframe?: string;
  mintick?: number;
  /** The last bar is still forming — `barstate.isconfirmed` is false on it */
  liveLast?: boolean;
  slayer?: SlayerFeed;
}

/* ---- what a run draws ------------------------------------------------------------ */

export interface PlotOut {
  id: string;
  title: string;
  style: ScriptPlotStyle;
  /** The plot's own ink as CSS; a per-bar `colors` array overrides it where set */
  ink: string;
  width: number;
  /** Bars to shift the line by — positive draws into the future */
  offset: number;
  /** One value per bar, NaN where the script gave `na` */
  values: Float64Array;
  colors: (string | null)[] | null;
  /** `display = display.none` hides it while `fill()` can still use it */
  hidden: boolean;
}

export interface HLineOut {
  id: string;
  title: string;
  price: number;
  ink: string;
  style: 'solid' | 'dashed' | 'dotted';
  width: number;
}

export interface FillOut {
  id: string;
  title: string;
  a: PlotRef;
  b: PlotRef;
  ink: string;
  colors: (string | null)[] | null;
}

export type ShapeStyle = 'xcross' | 'cross' | 'triangleup' | 'triangledown' | 'flag' | 'circle' | 'arrowup' | 'arrowdown' | 'labelup' | 'labeldown' | 'square' | 'diamond' | 'char';
export type ShapeLocation = 'abovebar' | 'belowbar' | 'top' | 'bottom' | 'absolute';

export interface ShapeOut {
  id: string;
  title: string;
  style: ShapeStyle;
  location: ShapeLocation;
  size: 'auto' | 'tiny' | 'small' | 'normal' | 'large' | 'huge';
  /** `plotchar`'s character, or `plotshape`'s text */
  text: string;
  ink: string;
  /** NaN where nothing is drawn; 1 where the condition held; the price for `location.absolute` */
  values: Float64Array;
  colors: (string | null)[] | null;
}

export interface AlertOut {
  id: string;
  title: string;
  message: string;
  /** 1 on the bars where the condition held */
  fired: Uint8Array;
}

export interface RunResult {
  plots: PlotOut[];
  hlines: HLineOut[];
  fills: FillOut[];
  shapes: ShapeOut[];
  /** `bgcolor()` — one CSS colour or null per bar, or null when the script never called it */
  bgcolors: (string | null)[] | null;
  /** `barcolor()` — the colour each bar's candle takes, or null where it keeps its own: every call's offset, show_last
      and display applied, the later call winning a bar two colour (interpreter.ts barcolorsOut); null when the script
      never called it. The chart lays it on the candles (components/gex/barTints.ts) */
  barcolors: (string | null)[] | null;
  alerts: AlertOut[];
  stats: {
    bars: number;
    ms: number;
  };
}

/** A parse or run failure, with the line the reader should look at */
export class PineError extends Error {
  line: number;
  column?: number;
  constructor(message: string, line: number, column?: number) {
    super(message);
    this.name = 'PineError';
    this.line = line;
    this.column = column;
  }
}
