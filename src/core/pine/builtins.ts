/*
==================================================
  SLAYER TERMINAL - PINE'S BUILT-INS (core/pine/builtins.ts)

  Every function and constant a script may name:
  the `ta.*` streams (ta.ts) fed by the bar, `math.*`,
  `str.*`, `color.*`, the `input.*` readers, the
  outputs (`plot`, `plotshape`, `plotchar`, `hline`,
  `fill`, `bgcolor`, `barcolor`, `alertcondition`,
  `alert`) and the casts. A name outside the subset
  stops the run with a plain sentence naming it —
  drawings, arrays, `request.security` and
  strategies are "not in this version yet", never a
  silent nothing.

  Named arguments resolve through SIGNATURES, so
  `plot(close, color = color.red, title = "Close")`
  reads the same as the positional form.
==================================================
*/

import type { ScriptInputKind, ScriptInputValue } from '../../types/scripts';
import { fromHex, gradient, isColor, named, rgb, toCss, withTransp } from './colors';
import * as ta from './ta';
import { PineError, type PineColor, type PlotRef, type Tuple, type Value } from './types';

/* ---- what a built-in may ask of the run ----------------------------------------- */

/** The bar in hand and the run's outputs, as the built-ins see them */
export interface Ctx {
  b: number;
  n: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  /** Seconds */
  time: number;
  timeframe: string;
  ticker: string;
  mintick: number;
  liveLast: boolean;
  /** A session key for the bar — the calendar day */
  sessionKey: string;
  slayer: Record<string, number>;
  /** The reader's value for an input, when they set one */
  inputValue: (id: string) => ScriptInputValue | undefined;
  /** A built-in series by name at this bar — `input.source` overrides name one ("hl2") */
  seriesByName: (name: string) => number | undefined;
  /** The id an input call resolves to — the variable it is assigned to, else its position */
  inputId: (nodeId: number) => string;
  /** The run's outputs, keyed by the call node that made them */
  output: OutputSink;
}

export interface OutputSink {
  plot: (nodeId: number, value: number, color: PineColor | null, opts: { title: string; style: string; width: number; offset: number; hidden: boolean; forceOverlay: boolean; ink: PineColor | null }) => PlotRef;
  hline: (nodeId: number, price: number, opts: { title: string; ink: PineColor | null; style: string; width: number }) => PlotRef;
  fill: (nodeId: number, a: PlotRef, b: PlotRef, color: PineColor | null, title: string) => void;
  shape: (nodeId: number, on: boolean | number, color: PineColor | null, opts: { title: string; style: string; location: string; size: string; text: string; ink: PineColor | null }) => void;
  bgcolor: (color: PineColor | null) => void;
  barcolor: (color: PineColor | null) => void;
  alertcondition: (nodeId: number, cond: boolean, title: string, message: string) => void;
  alert: (nodeId: number, message: string) => void;
}

export interface CallArg {
  name?: string;
  value: Value;
}

export type State = Record<string, unknown>;

/* ---- signatures (argument names, in order) ---------------------------------------- */

const SIG: Record<string, string[]> = {
  plot: ['series', 'title', 'color', 'linewidth', 'style', 'trackprice', 'histbase', 'offset', 'join', 'editable', 'show_last', 'display', 'format', 'precision', 'force_overlay'],
  plotshape: ['series', 'title', 'style', 'location', 'color', 'offset', 'text', 'textcolor', 'editable', 'size', 'show_last', 'display', 'format', 'precision', 'force_overlay'],
  plotchar: ['series', 'title', 'char', 'location', 'color', 'offset', 'text', 'textcolor', 'editable', 'size', 'show_last', 'display', 'format', 'precision', 'force_overlay'],
  hline: ['price', 'title', 'color', 'linestyle', 'linewidth', 'editable', 'display'],
  fill: ['plot1', 'plot2', 'color', 'title', 'editable', 'show_last', 'fillgaps', 'display'],
  bgcolor: ['color', 'offset', 'editable', 'show_last', 'title', 'display', 'force_overlay'],
  barcolor: ['color', 'offset', 'editable', 'show_last', 'title', 'display'],
  alertcondition: ['condition', 'title', 'message'],
  alert: ['message', 'freq'],
  indicator: ['title', 'shorttitle', 'overlay', 'format', 'precision', 'scale', 'max_bars_back', 'timeframe', 'timeframe_gaps', 'explicit_plot_zorder', 'max_lines_count', 'max_labels_count', 'max_boxes_count', 'calc_bars_count', 'max_polylines_count', 'dynamic_requests', 'behind_chart'],
  input: ['defval', 'title', 'tooltip', 'inline', 'group', 'display', 'active', 'confirm'],
  'input.int': ['defval', 'title', 'minval', 'maxval', 'step', 'options', 'tooltip', 'inline', 'group', 'confirm', 'display', 'active'],
  'input.float': ['defval', 'title', 'minval', 'maxval', 'step', 'options', 'tooltip', 'inline', 'group', 'confirm', 'display', 'active'],
  'input.bool': ['defval', 'title', 'tooltip', 'inline', 'group', 'confirm', 'display', 'active'],
  'input.string': ['defval', 'title', 'options', 'tooltip', 'inline', 'group', 'confirm', 'display', 'active'],
  'input.color': ['defval', 'title', 'tooltip', 'inline', 'group', 'confirm', 'display', 'active'],
  'input.source': ['defval', 'title', 'tooltip', 'inline', 'group', 'display', 'active'],
  'input.timeframe': ['defval', 'title', 'options', 'tooltip', 'inline', 'group', 'confirm', 'display', 'active'],
  'input.session': ['defval', 'title', 'options', 'tooltip', 'inline', 'group', 'confirm', 'display', 'active'],
  'input.symbol': ['defval', 'title', 'tooltip', 'inline', 'group', 'confirm', 'display', 'active'],
  'input.text_area': ['defval', 'title', 'tooltip', 'group', 'confirm', 'display', 'active'],
  'ta.sma': ['source', 'length'],
  'ta.ema': ['source', 'length'],
  'ta.rma': ['source', 'length'],
  'ta.wma': ['source', 'length'],
  'ta.vwma': ['source', 'length'],
  'ta.hma': ['source', 'length'],
  'ta.swma': ['source'],
  'ta.alma': ['series', 'length', 'offset', 'sigma', 'floor'],
  'ta.rsi': ['source', 'length'],
  'ta.macd': ['source', 'fastlen', 'slowlen', 'siglen'],
  'ta.atr': ['length'],
  'ta.tr': ['handle_na'],
  'ta.bb': ['series', 'length', 'mult'],
  'ta.bbw': ['series', 'length', 'mult'],
  'ta.stdev': ['source', 'length', 'biased'],
  'ta.variance': ['source', 'length', 'biased'],
  'ta.dev': ['source', 'length'],
  'ta.highest': ['source', 'length'],
  'ta.lowest': ['source', 'length'],
  'ta.highestbars': ['source', 'length'],
  'ta.lowestbars': ['source', 'length'],
  'ta.change': ['source', 'length'],
  'ta.mom': ['source', 'length'],
  'ta.roc': ['source', 'length'],
  'ta.crossover': ['source1', 'source2'],
  'ta.crossunder': ['source1', 'source2'],
  'ta.cross': ['source1', 'source2'],
  'ta.barssince': ['condition'],
  'ta.valuewhen': ['condition', 'source', 'occurrence'],
  'ta.cum': ['source'],
  'ta.sum': ['source', 'length'],
  'ta.vwap': ['source', 'anchor', 'stdev_mult'],
  'ta.supertrend': ['factor', 'atrPeriod'],
  'ta.dmi': ['diLength', 'adxSmoothing'],
  'ta.stoch': ['source', 'high', 'low', 'length'],
  'ta.cci': ['source', 'length'],
  'ta.mfi': ['series', 'length'],
  'ta.obv': [],
  'ta.wpr': ['length'],
  'ta.linreg': ['source', 'length', 'offset'],
  'ta.sar': ['start', 'inc', 'max'],
  'ta.rising': ['source', 'length'],
  'ta.falling': ['source', 'length'],
  'ta.max': ['source'],
  'ta.min': ['source'],
  'ta.median': ['source', 'length'],
  'ta.percentrank': ['source', 'length'],
  'ta.cog': ['source', 'length'],
  'ta.pivothigh': ['source', 'leftbars', 'rightbars'],
  'ta.pivotlow': ['source', 'leftbars', 'rightbars'],
  'ta.correlation': ['source1', 'source2', 'length'],
  'math.round': ['number', 'precision'],
  'math.round_to_mintick': ['number'],
  'math.sum': ['source', 'length'],
  'color.new': ['color', 'transp'],
  'color.rgb': ['red', 'green', 'blue', 'transp'],
  'color.from_gradient': ['value', 'bottom_value', 'top_value', 'bottom_color', 'top_color'],
  'str.tostring': ['value', 'format'],
  'str.format': ['formatString'],
  'str.replace': ['source', 'target', 'replacement', 'occurrence'],
  'str.replace_all': ['source', 'target', 'replacement'],
  nz: ['source', 'replacement'],
  na: ['x'],
  fixnan: ['source'],
};

/** Constants a script names by a dotted path */
export const CONSTANTS: Record<string, Value> = {
  'math.pi': Math.PI,
  'math.e': Math.E,
  'math.phi': (1 + Math.sqrt(5)) / 2,
  'math.rphi': 2 / (1 + Math.sqrt(5)),
  'plot.style_line': 'line',
  'plot.style_linebr': 'line',
  'plot.style_stepline': 'stepline',
  'plot.style_stepline_diamond': 'stepline',
  'plot.style_histogram': 'histogram',
  'plot.style_columns': 'columns',
  'plot.style_area': 'area',
  'plot.style_areabr': 'area',
  'plot.style_circles': 'circles',
  'plot.style_cross': 'cross',
  'hline.style_solid': 'solid',
  'hline.style_dashed': 'dashed',
  'hline.style_dotted': 'dotted',
  'shape.xcross': 'xcross',
  'shape.cross': 'cross',
  'shape.triangleup': 'triangleup',
  'shape.triangledown': 'triangledown',
  'shape.flag': 'flag',
  'shape.circle': 'circle',
  'shape.arrowup': 'arrowup',
  'shape.arrowdown': 'arrowdown',
  'shape.labelup': 'labelup',
  'shape.labeldown': 'labeldown',
  'shape.square': 'square',
  'shape.diamond': 'diamond',
  'location.abovebar': 'abovebar',
  'location.belowbar': 'belowbar',
  'location.top': 'top',
  'location.bottom': 'bottom',
  'location.absolute': 'absolute',
  'size.auto': 'auto',
  'size.tiny': 'tiny',
  'size.small': 'small',
  'size.normal': 'normal',
  'size.large': 'large',
  'size.huge': 'huge',
  'display.all': 'all',
  'display.none': 'none',
  'display.pane': 'pane',
  'display.data_window': 'data_window',
  'display.price_scale': 'price_scale',
  'display.status_line': 'status_line',
  'format.inherit': 'inherit',
  'format.price': 'price',
  'format.volume': 'volume',
  'format.percent': 'percent',
  'scale.right': 'right',
  'scale.left': 'left',
  'scale.none': 'none',
  'alert.freq_once_per_bar': 'once_per_bar',
  'alert.freq_once_per_bar_close': 'once_per_bar_close',
  'alert.freq_all': 'all',
  'dayofweek.sunday': 1,
  'dayofweek.monday': 2,
  'dayofweek.tuesday': 3,
  'dayofweek.wednesday': 4,
  'dayofweek.thursday': 5,
  'dayofweek.friday': 6,
  'dayofweek.saturday': 7,
  'xloc.bar_index': 'bar_index',
  'xloc.bar_time': 'bar_time',
  'yloc.price': 'price',
  'yloc.abovebar': 'abovebar',
  'yloc.belowbar': 'belowbar',
  'extend.none': 'none',
  'extend.left': 'left',
  'extend.right': 'right',
  'extend.both': 'both',
  'barmerge.gaps_off': 'gaps_off',
  'barmerge.gaps_on': 'gaps_on',
  'barmerge.lookahead_off': 'lookahead_off',
  'barmerge.lookahead_on': 'lookahead_on',
};

/** Namespaces the runtime knows but does not run yet — named so the sentence can say so */
const LATER = ['label', 'line', 'box', 'table', 'linefill', 'polyline', 'array', 'matrix', 'map', 'request', 'strategy', 'ticker', 'chart', 'log', 'runtime'];

/* ---- helpers ---------------------------------------------------------------------- */

const isNum = (v: Value): v is number => typeof v === 'number';
export const asNum = (v: Value): number => (typeof v === 'number' ? v : typeof v === 'boolean' ? (v ? 1 : 0) : NaN);
export const asBool = (v: Value): boolean => (typeof v === 'boolean' ? v : typeof v === 'number' ? !Number.isNaN(v) && v !== 0 : v !== null);
const asStr = (v: Value): string => (typeof v === 'string' ? v : v === null ? 'na' : isNum(v) ? fmtNum(v) : typeof v === 'boolean' ? String(v) : isColor(v) ? toCss(v) : '');
const asColor = (v: Value): PineColor | null => (isColor(v) ? v : typeof v === 'string' && /^#/.test(v) ? fromHex(v) : null);
const fmtNum = (v: number): string => (Number.isNaN(v) ? 'NaN' : Number.isInteger(v) ? String(v) : String(Number(v.toFixed(8))));
const tuple = (items: Value[]): Tuple => ({ tuple: items });

/** Positional and named arguments into a map by parameter name */
export function bind(callee: string, args: CallArg[], line: number): Record<string, Value> {
  const names = SIG[callee];
  const out: Record<string, Value> = {};
  if (!names) {
    args.forEach((a, i) => (out[a.name ?? String(i)] = a.value));
    return out;
  }
  let pos = 0;
  for (const a of args) {
    if (a.name) {
      if (!names.includes(a.name)) throw new PineError(`${callee} has no argument named "${a.name}"`, line);
      out[a.name] = a.value;
    } else {
      if (pos >= names.length) throw new PineError(`${callee} takes ${names.length} argument${names.length === 1 ? '' : 's'}`, line);
      out[names[pos++]] = a.value;
    }
  }
  return out;
}

const need = (a: Record<string, Value>, key: string, callee: string, line: number): Value => {
  if (!(key in a)) throw new PineError(`${callee} needs its "${key}"`, line);
  return a[key];
};
const len = (a: Record<string, Value>, key: string, callee: string, line: number): number => {
  const v = asNum(need(a, key, callee, line));
  if (Number.isNaN(v) || v < 1) throw new PineError(`${callee}: "${key}" must be a whole number of at least 1`, line);
  return Math.floor(v);
};
const num = (a: Record<string, Value>, key: string, dflt: number): number => (key in a ? asNum(a[key]) : dflt);
const str = (a: Record<string, Value>, key: string, dflt: string): string => (key in a && a[key] !== null ? asStr(a[key]) : dflt);

/* ---- the call ---------------------------------------------------------------------- */

/**
 * Run one built-in. `state` is the call site's own memory (a `ta.*` stream lives
 * in it); `nodeId` names the call for the outputs. Returns the value, or throws
 * a PineError the reader can act on.
 */
export function callBuiltin(ctx: Ctx, callee: string, args: CallArg[], state: State, nodeId: number, line: number): Value {
  const a = bind(callee, args, line);
  const ns = callee.includes('.') ? callee.split('.')[0] : '';
  if (LATER.includes(ns)) throw new PineError(`${ns}.* is not in this version yet — the runtime draws lines, shapes and fills, and reads the bar`, line);

  switch (callee) {
    /* ---- the header ---- */
    case 'indicator':
      return null;
    case 'strategy':
      throw new PineError('Strategies are not in this version yet — indicators only', line);
    case 'library':
      throw new PineError('Libraries are not in this version yet — scripts stand alone here', line);

    /* ---- na, casts ---- */
    case 'na': {
      const x = need(a, 'x', callee, line);
      return x === null || (typeof x === 'number' && Number.isNaN(x));
    }
    case 'nz': {
      const x = need(a, 'source', callee, line);
      const repl = 'replacement' in a ? a.replacement : 0;
      return x === null || (typeof x === 'number' && Number.isNaN(x)) ? repl : x;
    }
    case 'fixnan': {
      const x = need(a, 'source', callee, line);
      const bad = x === null || (typeof x === 'number' && Number.isNaN(x));
      if (!bad) state.last = x;
      return bad ? ((state.last as Value) ?? x) : x;
    }
    case 'int':
      return Math.trunc(asNum(a['0']));
    case 'float':
      return asNum(a['0']);
    case 'bool':
      return asBool(a['0']);
    case 'string':
      return asStr(a['0']);
    case 'color':
      return asColor(a['0']);

    /* ---- inputs ---- */
    case 'input':
    case 'input.int':
    case 'input.float':
    case 'input.bool':
    case 'input.string':
    case 'input.color':
    case 'input.source':
    case 'input.timeframe':
    case 'input.session':
    case 'input.symbol':
    case 'input.text_area': {
      const dflt = need(a, 'defval', callee, line);
      const id = ctx.inputId(nodeId);
      const given = ctx.inputValue(id);
      if (given === undefined) return dflt;
      if (callee === 'input.color') return typeof given === 'string' ? fromHex(given) : dflt;
      if (callee === 'input.source') return typeof given === 'string' ? (ctx.seriesByName(given) ?? dflt) : typeof given === 'number' ? given : dflt;
      if (callee === 'input.int') return Math.round(asNum(given as Value));
      if (callee === 'input.float') return asNum(given as Value);
      if (callee === 'input.bool') return asBool(given as Value);
      return typeof dflt === 'number' ? asNum(given as Value) : typeof dflt === 'boolean' ? asBool(given as Value) : String(given);
    }

    /* ---- outputs ---- */
    case 'plot': {
      const series = asNum(need(a, 'series', callee, line));
      const color = 'color' in a ? asColor(a.color) : null;
      return ctx.output.plot(nodeId, series, color, {
        title: str(a, 'title', ''),
        style: str(a, 'style', 'line'),
        width: num(a, 'linewidth', 1),
        offset: num(a, 'offset', 0),
        hidden: str(a, 'display', 'all') === 'none',
        forceOverlay: asBool(a.force_overlay ?? false),
        ink: color,
      });
    }
    case 'plotshape':
    case 'plotchar': {
      const series = need(a, 'series', callee, line);
      const color = 'color' in a ? asColor(a.color) : null;
      ctx.output.shape(nodeId, typeof series === 'number' ? series : asBool(series), color, {
        title: str(a, 'title', ''),
        style: callee === 'plotchar' ? 'char' : str(a, 'style', 'xcross'),
        location: str(a, 'location', 'abovebar'),
        size: str(a, 'size', 'auto'),
        text: callee === 'plotchar' ? str(a, 'char', '•') : str(a, 'text', ''),
        ink: color,
      });
      return null;
    }
    case 'hline': {
      const price = asNum(need(a, 'price', callee, line));
      return ctx.output.hline(nodeId, price, { title: str(a, 'title', ''), ink: 'color' in a ? asColor(a.color) : null, style: str(a, 'linestyle', 'solid'), width: num(a, 'linewidth', 1) });
    }
    case 'fill': {
      const p1 = need(a, 'plot1', callee, line) as PlotRef;
      const p2 = need(a, 'plot2', callee, line) as PlotRef;
      if (!p1 || typeof p1 !== 'object' || !('ref' in p1) || !p2 || typeof p2 !== 'object' || !('ref' in p2)) throw new PineError('fill() takes two plots, or two hlines', line);
      ctx.output.fill(nodeId, p1, p2, 'color' in a ? asColor(a.color) : null, str(a, 'title', ''));
      return null;
    }
    case 'bgcolor':
      ctx.output.bgcolor(asColor(need(a, 'color', callee, line)));
      return null;
    case 'barcolor':
      ctx.output.barcolor(asColor(need(a, 'color', callee, line)));
      return null;
    case 'alertcondition':
      ctx.output.alertcondition(nodeId, asBool(need(a, 'condition', callee, line)), str(a, 'title', ''), str(a, 'message', ''));
      return null;
    case 'alert':
      ctx.output.alert(nodeId, asStr(need(a, 'message', callee, line)));
      return null;

    /* ---- ta ---- */
    case 'ta.sma':
      return ta.sma(state, asNum(need(a, 'source', callee, line)), len(a, 'length', callee, line));
    case 'ta.ema':
      return ta.ema(state, asNum(need(a, 'source', callee, line)), len(a, 'length', callee, line));
    case 'ta.rma':
      return ta.rma(state, asNum(need(a, 'source', callee, line)), len(a, 'length', callee, line));
    case 'ta.wma':
      return ta.wma(state, asNum(need(a, 'source', callee, line)), len(a, 'length', callee, line));
    case 'ta.vwma':
      return ta.vwma(state, asNum(need(a, 'source', callee, line)), ctx.volume, len(a, 'length', callee, line));
    case 'ta.hma':
      return ta.hma(state, asNum(need(a, 'source', callee, line)), len(a, 'length', callee, line));
    case 'ta.swma':
      return ta.swma(state, asNum(need(a, 'source', callee, line)));
    case 'ta.alma':
      return ta.alma(state, asNum(need(a, 'series', callee, line)), len(a, 'length', callee, line), num(a, 'offset', 0.85), num(a, 'sigma', 6));
    case 'ta.rsi':
      return ta.rsi(state, asNum(need(a, 'source', callee, line)), len(a, 'length', callee, line));
    case 'ta.macd':
      return tuple(ta.macd(state, asNum(need(a, 'source', callee, line)), len(a, 'fastlen', callee, line), len(a, 'slowlen', callee, line), len(a, 'siglen', callee, line)));
    case 'ta.atr':
      return ta.atr(state, ctx.high, ctx.low, ctx.close, len(a, 'length', callee, line));
    case 'ta.tr':
      return ta.tr(state, ctx.high, ctx.low, ctx.close, asBool(a.handle_na ?? false));
    case 'ta.bb':
      return tuple(ta.bb(state, asNum(need(a, 'series', callee, line)), len(a, 'length', callee, line), num(a, 'mult', 2)));
    case 'ta.bbw': {
      const [basis, up, lo] = ta.bb(state, asNum(need(a, 'series', callee, line)), len(a, 'length', callee, line), num(a, 'mult', 2));
      return (up - lo) / basis;
    }
    case 'ta.stdev':
      return ta.stdev(state, asNum(need(a, 'source', callee, line)), len(a, 'length', callee, line), asBool(a.biased ?? true));
    case 'ta.variance':
      return ta.variance(state, asNum(need(a, 'source', callee, line)), len(a, 'length', callee, line), asBool(a.biased ?? true));
    case 'ta.dev':
      return ta.dev(state, asNum(need(a, 'source', callee, line)), len(a, 'length', callee, line));
    case 'ta.highest':
      return 'length' in a ? ta.highest(state, asNum(a.source), len(a, 'length', callee, line)) : ta.highest(state, ctx.high, len(a, 'source', callee, line));
    case 'ta.lowest':
      return 'length' in a ? ta.lowest(state, asNum(a.source), len(a, 'length', callee, line)) : ta.lowest(state, ctx.low, len(a, 'source', callee, line));
    case 'ta.highestbars':
      return 'length' in a ? ta.highestbars(state, asNum(a.source), len(a, 'length', callee, line)) : ta.highestbars(state, ctx.high, len(a, 'source', callee, line));
    case 'ta.lowestbars':
      return 'length' in a ? ta.lowestbars(state, asNum(a.source), len(a, 'length', callee, line)) : ta.lowestbars(state, ctx.low, len(a, 'source', callee, line));
    case 'ta.change':
    case 'ta.mom':
      return ta.change(state, asNum(need(a, 'source', callee, line)), 'length' in a ? len(a, 'length', callee, line) : 1);
    case 'ta.roc':
      return ta.roc(state, asNum(need(a, 'source', callee, line)), len(a, 'length', callee, line));
    case 'ta.crossover':
      return ta.crossover(state, asNum(need(a, 'source1', callee, line)), asNum(need(a, 'source2', callee, line)));
    case 'ta.crossunder':
      return ta.crossunder(state, asNum(need(a, 'source1', callee, line)), asNum(need(a, 'source2', callee, line)));
    case 'ta.cross':
      return ta.cross(state, asNum(need(a, 'source1', callee, line)), asNum(need(a, 'source2', callee, line)));
    case 'ta.barssince':
      return ta.barssince(state, asBool(need(a, 'condition', callee, line)));
    case 'ta.valuewhen':
      return ta.valuewhen(state, asBool(need(a, 'condition', callee, line)), asNum(need(a, 'source', callee, line)), num(a, 'occurrence', 0));
    case 'ta.cum':
      return ta.cum(state, asNum(need(a, 'source', callee, line)));
    case 'ta.sum':
    case 'math.sum':
      return ta.sum(state, asNum(need(a, 'source', callee, line)), len(a, 'length', callee, line));
    case 'ta.vwap':
      return ta.vwap(state, 'source' in a ? asNum(a.source) : (ctx.high + ctx.low + ctx.close) / 3, ctx.volume, ctx.sessionKey);
    case 'ta.supertrend':
      return tuple(ta.supertrend(state, ctx.high, ctx.low, ctx.close, asNum(need(a, 'factor', callee, line)), len(a, 'atrPeriod', callee, line)));
    case 'ta.dmi':
      return tuple(ta.dmi(state, ctx.high, ctx.low, ctx.close, len(a, 'diLength', callee, line), len(a, 'adxSmoothing', callee, line)));
    case 'ta.stoch':
      return ta.stoch(state, asNum(need(a, 'source', callee, line)), asNum(need(a, 'high', callee, line)), asNum(need(a, 'low', callee, line)), len(a, 'length', callee, line));
    case 'ta.cci':
      return ta.cci(state, asNum(need(a, 'source', callee, line)), len(a, 'length', callee, line));
    case 'ta.mfi':
      return ta.mfi(state, asNum(need(a, 'series', callee, line)), ctx.volume, len(a, 'length', callee, line));
    case 'ta.obv':
      return ta.obv(state, ctx.close, ctx.volume);
    case 'ta.wpr':
      return ta.wpr(state, ctx.high, ctx.low, ctx.close, len(a, 'length', callee, line));
    case 'ta.linreg':
      return ta.linreg(state, asNum(need(a, 'source', callee, line)), len(a, 'length', callee, line), num(a, 'offset', 0));
    case 'ta.sar':
      return ta.sar(state, ctx.high, ctx.low, ctx.close, num(a, 'start', 0.02), num(a, 'inc', 0.02), num(a, 'max', 0.2));
    case 'ta.rising':
      return ta.rising(state, asNum(need(a, 'source', callee, line)), len(a, 'length', callee, line));
    case 'ta.falling':
      return ta.falling(state, asNum(need(a, 'source', callee, line)), len(a, 'length', callee, line));
    case 'ta.max':
      return ta.max(state, asNum(need(a, 'source', callee, line)));
    case 'ta.min':
      return ta.min(state, asNum(need(a, 'source', callee, line)));
    case 'ta.median':
      return ta.median(state, asNum(need(a, 'source', callee, line)), len(a, 'length', callee, line));
    case 'ta.percentrank':
      return ta.percentrank(state, asNum(need(a, 'source', callee, line)), len(a, 'length', callee, line));
    case 'ta.cog':
      return ta.cog(state, asNum(need(a, 'source', callee, line)), len(a, 'length', callee, line));
    case 'ta.pivothigh':
    case 'ta.pivotlow': {
      /* two forms: (leftbars, rightbars) on high/low, or (source, leftbars, rightbars) */
      const three = 'rightbars' in a;
      const src = three ? asNum(a.source) : callee === 'ta.pivothigh' ? ctx.high : ctx.low;
      const left = three ? len(a, 'leftbars', callee, line) : len(a, 'source', callee, line);
      const right = three ? len(a, 'rightbars', callee, line) : len(a, 'leftbars', callee, line);
      return callee === 'ta.pivothigh' ? ta.pivothigh(state, src, left, right) : ta.pivotlow(state, src, left, right);
    }
    case 'ta.correlation':
      return ta.correlation(state, asNum(need(a, 'source1', callee, line)), asNum(need(a, 'source2', callee, line)), len(a, 'length', callee, line));

    /* ---- math ---- */
    case 'math.abs':
      return Math.abs(asNum(a['0']));
    case 'math.avg': {
      const vals = Object.values(a).map(asNum);
      return vals.reduce((x, y) => x + y, 0) / vals.length;
    }
    case 'math.max':
      return Math.max(...Object.values(a).map(asNum));
    case 'math.min':
      return Math.min(...Object.values(a).map(asNum));
    case 'math.ceil':
      return Math.ceil(asNum(a['0']));
    case 'math.floor':
      return Math.floor(asNum(a['0']));
    case 'math.round': {
      const x = asNum(need(a, 'number', callee, line));
      if ('precision' in a) {
        const p = Math.pow(10, asNum(a.precision));
        return Math.round(x * p) / p;
      }
      return Math.round(x);
    }
    case 'math.round_to_mintick': {
      const x = asNum(need(a, 'number', callee, line));
      return Math.round(x / ctx.mintick) * ctx.mintick;
    }
    case 'math.pow':
      return Math.pow(asNum(a['0']), asNum(a['1']));
    case 'math.sqrt':
      return Math.sqrt(asNum(a['0']));
    case 'math.exp':
      return Math.exp(asNum(a['0']));
    case 'math.log':
      return Math.log(asNum(a['0']));
    case 'math.log10':
      return Math.log10(asNum(a['0']));
    case 'math.sign':
      return Math.sign(asNum(a['0']));
    case 'math.sin':
      return Math.sin(asNum(a['0']));
    case 'math.cos':
      return Math.cos(asNum(a['0']));
    case 'math.tan':
      return Math.tan(asNum(a['0']));
    case 'math.asin':
      return Math.asin(asNum(a['0']));
    case 'math.acos':
      return Math.acos(asNum(a['0']));
    case 'math.atan':
      return Math.atan(asNum(a['0']));
    case 'math.todegrees':
      return (asNum(a['0']) * 180) / Math.PI;
    case 'math.toradians':
      return (asNum(a['0']) * Math.PI) / 180;
    case 'math.random':
      /* deterministic on purpose — a script must draw the same picture twice */
      return 0.5;

    /* ---- colour ---- */
    case 'color.new': {
      const c = asColor(need(a, 'color', callee, line));
      return c ? withTransp(c, asNum(need(a, 'transp', callee, line))) : null;
    }
    case 'color.rgb':
      return rgb(asNum(need(a, 'red', callee, line)), asNum(need(a, 'green', callee, line)), asNum(need(a, 'blue', callee, line)), num(a, 'transp', 0));
    case 'color.from_gradient': {
      const c0 = asColor(need(a, 'bottom_color', callee, line));
      const c1 = asColor(need(a, 'top_color', callee, line));
      if (!c0 || !c1) return null;
      return gradient(asNum(need(a, 'value', callee, line)), asNum(need(a, 'bottom_value', callee, line)), asNum(need(a, 'top_value', callee, line)), c0, c1);
    }
    case 'color.r':
      return asColor(a['0'])?.r ?? NaN;
    case 'color.g':
      return asColor(a['0'])?.g ?? NaN;
    case 'color.b':
      return asColor(a['0'])?.b ?? NaN;
    case 'color.t': {
      const c = asColor(a['0']);
      return c ? 100 * (1 - c.a) : NaN;
    }

    /* ---- strings ---- */
    case 'str.tostring': {
      const v = need(a, 'value', callee, line);
      if (typeof v === 'number' && 'format' in a) {
        const f = asStr(a.format);
        const m = /\.(#+|0+)/.exec(f);
        if (m) return v.toFixed(m[1].length);
        if (f === 'percent') return `${(v * 100).toFixed(2)}%`;
      }
      return asStr(v);
    }
    case 'str.tonumber': {
      const n = Number(asStr(a['0']));
      return Number.isNaN(n) ? NaN : n;
    }
    case 'str.length':
      return asStr(a['0']).length;
    case 'str.upper':
      return asStr(a['0']).toUpperCase();
    case 'str.lower':
      return asStr(a['0']).toLowerCase();
    case 'str.contains':
      return asStr(a['0']).includes(asStr(a['1']));
    case 'str.startswith':
      return asStr(a['0']).startsWith(asStr(a['1']));
    case 'str.endswith':
      return asStr(a['0']).endsWith(asStr(a['1']));
    case 'str.replace': {
      const s = asStr(need(a, 'source', callee, line));
      return s.replace(asStr(need(a, 'target', callee, line)), asStr(need(a, 'replacement', callee, line)));
    }
    case 'str.replace_all': {
      const s = asStr(need(a, 'source', callee, line));
      return s.split(asStr(need(a, 'target', callee, line))).join(asStr(need(a, 'replacement', callee, line)));
    }
    case 'str.format': {
      const f = asStr(need(a, 'formatString', callee, line));
      const rest = Object.entries(a)
        .filter(([k]) => k !== 'formatString')
        .map(([, v]) => v);
      return f.replace(/\{(\d+)(?:,number,([^}]*))?\}/g, (_, i, fmt) => {
        const v = rest[Number(i)];
        if (typeof v === 'number' && fmt) {
          const m = /\.(#+|0+)/.exec(fmt);
          if (m) return v.toFixed(m[1].length);
        }
        return asStr(v ?? null);
      });
    }

    /* ---- time ---- */
    case 'timestamp':
      throw new PineError('timestamp() is not in this version yet', line);
    case 'time':
      if (Object.keys(a).length) throw new PineError('time() with a session is not in this version yet — the bare `time` variable is', line);
      return ctx.time * 1000;
  }

  throw new PineError(`${callee}() is not in this version yet`, line);
}

/** Which input kind a call makes — for the shape the library keeps */
export const inputKindOf = (callee: string, defval: Value): ScriptInputKind => {
  switch (callee) {
    case 'input.int':
      return 'int';
    case 'input.float':
      return 'float';
    case 'input.bool':
      return 'bool';
    case 'input.color':
      return 'color';
    case 'input.source':
      return 'source';
    case 'input.timeframe':
      return 'timeframe';
    case 'input.string':
    case 'input.session':
    case 'input.symbol':
    case 'input.text_area':
      return 'string';
    default:
      return typeof defval === 'boolean' ? 'bool' : typeof defval === 'string' ? 'string' : isColor(defval) ? 'color' : Number.isInteger(defval as number) ? 'int' : 'float';
  }
};

export const namedColor = named;
