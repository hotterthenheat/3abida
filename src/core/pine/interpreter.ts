/*
==================================================
  SLAYER TERMINAL - THE PINE INTERPRETER
  (core/pine/interpreter.ts)

  Walks the tree once per bar, first bar to last,
  the way Pine runs a script. Everything is a
  SERIES: a variable keeps one value per bar, so
  `x[1]` is what x was on the bar before; a `var`
  keeps its value from bar to bar until reassigned;
  a `ta.*` call is a stream that advances only when
  its line runs. A user function opens a fresh scope
  per CALL SITE, so two calls of the same function
  keep separate streams, and its parameters are
  series too.

  No eval anywhere: a script can only reach what the
  built-ins hand it. A run that outgrows its time
  budget stops with the bar it reached.

  THE AUDIT OF 2026-10-15: the pane's timeframe is
  read in the chart's own forms ("5m", "1h", "1D")
  as well as Pine's ("5", "60", "D"); the clock and
  calendar are New York's (core/nyTime), never the
  machine's; a session is New York's day; `ta.obv`,
  `ta.tr` and `ta.vwap` read as variables, the whole
  series whatever line reads them; an alert
  condition keeps the id the library lists. And a
  scope is the same object every bar — its
  variables, `ta.*` streams and histories hang off
  it by node id, where a string key was built and
  hashed on every call (the Ichimoku took 270 ms
  over 5,000 bars, past the 200 ms budget).
==================================================
*/

import type { ScriptInputValue } from '../../types/scripts';
import { nyParts } from '../nyTime';
import { constEval, type OutputPlan } from './analyze';
import { asBool, asNum, callBuiltin, clockField, CONSTANTS, namedColor, type CallArg, type ClockParts, type Ctx, type OutputSink, type State } from './builtins';
import { fromHex, isColor, toCss } from './colors';
import * as ta from './ta';
import type { Expr, Stmt } from './ast';
import type { Program } from './ast';
import { PineError, type AlertOut, type Bar, type FillOut, type HLineOut, type PlotOut, type PlotRef, type RunOptions, type RunResult, type ShapeOut, type Tuple, type UserFunction, type Value } from './types';
import type { ShapeLocation, ShapeStyle } from './types';
import type { ScriptPlotStyle } from '../../types/scripts';

/** One variable's values, a bar each — `undefined` where the line that sets it did not run */
interface Slot {
  arr: Value[];
}

/** A call site's memory: its `ta.*` stream, and the array its arguments are read into (made once, filled each bar) */
interface Site {
  state: State;
  args: CallArg[];
  /** The arguments by name, filled again each bar (builtins bind) */
  bound: Record<string, Value>;
  /** The answer, where it cannot change from bar to bar (ONCE, a colour of constants) */
  fixed?: Value;
}

/** Calls whose answer is the same on every bar of a run */
const ONCE = new Set(['indicator', 'input.int', 'input.float', 'input.bool', 'input.string', 'input.color', 'input.timeframe', 'input.session', 'input.symbol', 'input.text_area']);

interface Scope {
  /** What has been declared in this scope on this run of it — cleared each time the block runs again */
  names: Map<string, Slot>;
  parent: Scope | null;
  /** Loop counters — plain values, not series */
  loop?: Map<string, Value>;
  /* KEPT FROM BAR TO BAR: the scope a block runs in is the same object every bar (Runner.kid), so these hang off it by
     name or node id */
  slots: Map<string, Slot>;
  kids: Map<number, Scope>;
  sites: Map<number, Site>;
  hist: Map<number, Value[]>;
}

const scopeOf = (parent: Scope | null): Scope => ({ names: new Map(), parent, slots: new Map(), kids: new Map(), sites: new Map(), hist: new Map() });

/* THE PANE'S TIMEFRAME (2026-10-15, the audit: the chart hands "5m", "1h", "1D" — the forms in data/timeframe.ts — and
   the runtime read only Pine's "5", "60", "D", so timeframe.isintraday was false on every intraday pane). Both forms
   read: a bare number or "m" minutes, "h" hours (as minutes, the way Pine counts them), "s"/"S" seconds, "D", "W", and
   "M" months (a capital M; the chart's minutes are a small m). */
interface Frame {
  unit: 'S' | 'm' | 'D' | 'W' | 'M';
  /** Pine's timeframe.multiplier — seconds, minutes (an hour is 60), days, weeks or months */
  mult: number;
  /** Pine's timeframe.period — "15S", "5", "60", and "1D" ("D" in a v5 script, which leaves a multiplier of 1 out) */
  period: string;
}
export function readTimeframe(tf: string | undefined, version: number | null): Frame {
  const m = /^\s*(\d*)\s*([a-zA-Z]?)\s*$/.exec(tf ?? '');
  const n = m && m[1] ? Number(m[1]) : 1;
  let unit: Frame['unit'] = 'm';
  let mult = n;
  switch (m ? m[2] : '?') {
    case '':
    case 'm':
      break;
    case 'h':
    case 'H':
      mult = n * 60;
      break;
    case 's':
    case 'S':
      unit = 'S';
      break;
    case 'd':
    case 'D':
      unit = 'D';
      break;
    case 'w':
    case 'W':
      unit = 'W';
      break;
    case 'M':
      unit = 'M';
      break;
    default:
      mult = 1;
  }
  if (!Number.isFinite(mult) || mult < 1) mult = 1;
  const v5 = version !== null && version < 6;
  const period = unit === 'm' ? String(mult) : unit === 'S' ? `${mult}S` : v5 && mult === 1 ? unit : `${mult}${unit}`;
  return { unit, mult, period };
}

/** The `ta.*` names Pine also writes as variables — the whole series, read on any bar (2026-10-15, the audit) */
const TA_VARS = new Set(['ta.obv', 'ta.tr', 'ta.vwap']);
const HALF_DAY_S = 12 * 3600;

class BreakSignal {}
class ContinueSignal {}

const NA = NaN;
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const isNa = (v: Value) => v === null || (typeof v === 'number' && Number.isNaN(v));
const isTuple = (v: Value): v is Tuple => !!v && typeof v === 'object' && 'tuple' in v;

const BUILTIN_SERIES = new Set(['open', 'high', 'low', 'close', 'volume', 'hl2', 'hlc3', 'ohlc4', 'hlcc4', 'time', 'time_close', 'bar_index']);

export class Runner {
  private b = 0;
  private readonly n: number;
  private varSlots = new Set<Slot>();
  private funcs = new Map<string, UserFunction>();
  private module: Scope = scopeOf(null);
  private depth = 0;
  private readonly frame: Frame;
  /** A daily, weekly or monthly pane — a bar stands for a session's date, not a moment */
  private readonly dwm: boolean;
  /* the bar's New York reading, a bar at a time; and New York's hour, read through nyParts once an hour */
  private clockAt = -1;
  private clock: ClockParts = { year: NaN, month: NaN, day: NaN, hour: NaN, minute: NaN, second: NaN, weekday: NaN };
  private hourAt = NaN;
  private hourParts: ClockParts = this.clock;
  private sessionAt = -1;
  private session = '';
  private taVars = new Map<string, { values: Float64Array; upTo: number; state: State }>();
  private memberKept = new Map<string, { fixed: Value } | { ns: string; key: string }>();
  private readonly budget: number;
  private readonly t0: number;

  /* the outputs, keyed by the call that makes them */
  private plots: (PlotOut & { colorsArr: (string | null)[]; seen: boolean })[] = [];
  private plotIndex = new Map<number, number>();
  private shapes: (ShapeOut & { colorsArr: (string | null)[]; seen: boolean })[] = [];
  private shapeIndex = new Map<number, number>();
  private hlines: (HLineOut & { seen: boolean })[] = [];
  private hlineIndex = new Map<number, number>();
  private fills: (FillOut & { colorsArr: (string | null)[]; seen: boolean })[] = [];
  private fillIndex = new Map<number, number>();
  private alerts: AlertOut[] = [];
  private alertIndex = new Map<number, number>();
  /** Each alert's fallback title — an alertcondition's number among the conditions, as the library counts them */
  private alertNames: string[] = [];
  private bgcolors: (string | null)[] | null = null;
  private barcolors: (string | null)[] | null = null;

  private ctx: Ctx;

  constructor(
    private program: Program,
    private bars: Bar[],
    opts: RunOptions,
    plan: OutputPlan
  ) {
    this.n = bars.length;
    this.frame = readTimeframe(opts.timeframe, program.version);
    this.dwm = this.frame.unit === 'D' || this.frame.unit === 'W' || this.frame.unit === 'M';
    this.budget = opts.budgetMs ?? 200;
    this.t0 = now();
    const inputs = opts.inputs ?? {};
    const slayer: Record<string, number> = {};
    for (const k of ['callWall', 'putWall', 'flip', 'supreme'] as const) if (typeof opts.slayer?.[k] === 'number') slayer[k] = opts.slayer[k]!;

    plan.plots.forEach((id, i) => {
      this.plotIndex.set(id, i);
      this.plots.push({ id: `plot${i + 1}`, title: '', style: 'line', ink: '#5B9CF6', width: 1, offset: 0, values: new Float64Array(this.n).fill(NA), colors: null, colorsArr: new Array(this.n).fill(null), hidden: false, seen: false });
    });
    plan.shapes.forEach((id, i) => {
      this.shapeIndex.set(id, i);
      this.shapes.push({ id: `shape${i + 1}`, title: '', style: 'xcross', location: 'abovebar', size: 'auto', text: '', ink: '#5B9CF6', values: new Float64Array(this.n).fill(NA), colors: null, colorsArr: new Array(this.n).fill(null), seen: false });
    });
    plan.hlines.forEach((id, i) => {
      this.hlineIndex.set(id, i);
      this.hlines.push({ id: `hline${i + 1}`, title: '', price: NA, ink: '#787B86', style: 'solid', width: 1, seen: false });
    });
    plan.fills.forEach((id, i) => {
      this.fillIndex.set(id, i);
      this.fills.push({ id: `fill${i + 1}`, title: '', a: { ref: 'plot', index: 0 }, b: { ref: 'plot', index: 0 }, ink: 'rgba(120, 120, 120, 0.1)', colors: null, colorsArr: new Array(this.n).fill(null), seen: false });
    });
    /* THE IDS ARE THE PLAN'S (2026-10-15, the audit: the run numbered alert() and alertcondition() together while the
       library numbered the conditions alone, so an alert() written first moved every switch onto the wrong condition) */
    plan.alerts.forEach((id, i) => {
      this.alertIndex.set(id, i);
      const aid = plan.alertIds.get(id) ?? `alert${i + 1}`;
      this.alertNames.push(/^alert\d+$/.test(aid) ? `Alert ${aid.slice(5)}` : 'alert()');
      this.alerts.push({ id: aid, title: '', message: '', fired: new Uint8Array(this.n) });
    });

    const self = this;
    const sink: OutputSink = {
      /* every output call's node is in its index: planOutputs (analyze.ts) walks every statement and expression, a
         function's body and an if or switch expression's included, and run() hands the Runner its own compile's plan */
      plot(nodeId, value, color, o) {
        const i = self.plotIndex.get(nodeId)!;
        const p = self.plots[i];
        if (!p.seen) {
          p.seen = true;
          p.title = o.title || `Plot ${i + 1}`;
          p.style = o.style as ScriptPlotStyle;
          p.width = o.width;
          p.offset = o.offset;
          p.hidden = o.hidden;
          if (o.ink) p.ink = toCss(o.ink);
        }
        p.values[self.b] = value;
        if (color) p.colorsArr[self.b] = toCss(color);
        return { ref: 'plot', index: i };
      },
      hline(nodeId, price, o) {
        const i = self.hlineIndex.get(nodeId)!;
        const h = self.hlines[i];
        if (!h.seen) {
          h.seen = true;
          h.title = o.title || `Line ${i + 1}`;
          h.price = price;
          h.style = (o.style === 'dashed' || o.style === 'dotted' ? o.style : 'solid') as HLineOut['style'];
          h.width = o.width;
          if (o.ink) h.ink = toCss(o.ink);
        }
        return { ref: 'hline', index: i };
      },
      fill(nodeId, a, b, color, title) {
        const i = self.fillIndex.get(nodeId)!;
        const f = self.fills[i];
        if (!f.seen) {
          f.seen = true;
          f.a = a;
          f.b = b;
          f.title = title;
          if (color) f.ink = toCss(color);
        }
        if (color) f.colorsArr[self.b] = toCss(color);
      },
      shape(nodeId, on, color, o) {
        const i = self.shapeIndex.get(nodeId)!;
        const s = self.shapes[i];
        if (!s.seen) {
          s.seen = true;
          s.title = o.title || `Shape ${i + 1}`;
          s.style = o.style as ShapeStyle;
          s.location = o.location as ShapeLocation;
          s.size = o.size as ShapeOut['size'];
          s.text = o.text;
          if (o.ink) s.ink = toCss(o.ink);
        }
        /* a number is a condition (0 and na draw nothing) — except at location.absolute, where it is the price the mark
           stands at, 0 included (2026-10-15) */
        if (typeof on === 'number') {
          if (!Number.isNaN(on) && (on !== 0 || s.location === 'absolute')) s.values[self.b] = s.location === 'absolute' ? on : 1;
        } else if (on) s.values[self.b] = 1;
        if (color) s.colorsArr[self.b] = toCss(color);
      },
      bgcolor(color) {
        if (!self.bgcolors) self.bgcolors = new Array(self.n).fill(null);
        self.bgcolors[self.b] = color ? toCss(color) : null;
      },
      barcolor(color) {
        if (!self.barcolors) self.barcolors = new Array(self.n).fill(null);
        self.barcolors[self.b] = color ? toCss(color) : null;
      },
      alertcondition(nodeId, cond, title, message) {
        const i = self.alertIndex.get(nodeId)!;
        const al = self.alerts[i];
        if (!al.title) {
          al.title = title || self.alertNames[i];
          al.message = message;
        }
        if (cond) al.fired[self.b] = 1;
      },
      alert(nodeId, message) {
        const i = self.alertIndex.get(nodeId);
        if (i === undefined) return;
        const al = self.alerts[i];
        al.title = al.title || 'alert()';
        al.message = message;
        al.fired[self.b] = 1;
      },
    };

    this.ctx = {
      b: 0,
      n: this.n,
      open: NA,
      high: NA,
      low: NA,
      close: NA,
      volume: NA,
      time: 0,
      timeframe: opts.timeframe ?? '1',
      ticker: opts.ticker ?? 'SPY',
      mintick: opts.mintick ?? 0.01,
      liveLast: !!opts.liveLast,
      sessionKey: () => this.sessionOf(this.b),
      timezone: 'America/New_York',
      barClock: (ms: number) => (ms === this.bars[this.b].time * 1000 ? this.clockOf(this.b) : null),
      slayer,
      inputValue: (id: string): ScriptInputValue | undefined => inputs[id],
      seriesByName: (name: string): number | undefined => {
        const v = this.builtinSeries(name, this.b);
        return typeof v === 'number' ? v : undefined;
      },
      inputId: (nodeId: number) => plan.inputIds.get(nodeId) ?? `input${nodeId}`,
      output: sink,
    };
  }

  /* ---- the run ---------------------------------------------------------------- */

  run(): RunResult {
    for (const s of this.program.body) if (s.t === 'fn') this.funcs.set(s.name, { fn: true, name: s.name, params: s.params, body: s.body, line: s.line });
    for (let b = 0; b < this.n; b++) {
      this.b = b;
      const bar = this.bars[b];
      const c = this.ctx;
      c.b = b;
      c.open = bar.open;
      c.high = bar.high;
      c.low = bar.low;
      c.close = bar.close;
      c.volume = bar.volume;
      c.time = bar.time;
      this.carry();
      this.execBlock(this.program.body, this.module);
      if ((b & 63) === 63 && now() - this.t0 > this.budget) throw new PineError(`The script ran past its ${this.budget} ms budget at bar ${b + 1} of ${this.n} — lighter maths, or fewer bars`, 0);
    }
    return this.result();
  }

  private result(): RunResult {
    const collapse = (arr: (string | null)[], ink: string): { ink: string; colors: (string | null)[] | null } => {
      let first: string | null = null;
      let mixed = false;
      for (const c of arr) {
        if (c === null) continue;
        if (first === null) first = c;
        else if (c !== first) {
          mixed = true;
          break;
        }
      }
      if (mixed) return { ink, colors: arr };
      return { ink: first ?? ink, colors: null };
    };
    return {
      plots: this.plots.map(({ colorsArr, seen, ...p }) => {
        const c = collapse(colorsArr, p.ink);
        void seen;
        return { ...p, ink: c.ink, colors: c.colors };
      }),
      hlines: this.hlines.map(({ seen, ...h }) => {
        void seen;
        return h;
      }),
      fills: this.fills.map(({ colorsArr, seen, ...f }) => {
        const c = collapse(colorsArr, f.ink);
        void seen;
        return { ...f, ink: c.ink, colors: c.colors };
      }),
      shapes: this.shapes.map(({ colorsArr, seen, ...s }) => {
        const c = collapse(colorsArr, s.ink);
        void seen;
        return { ...s, ink: c.ink, colors: c.colors };
      }),
      bgcolors: this.bgcolors,
      barcolors: this.barcolors,
      alerts: this.alerts,
      stats: { bars: this.n, ms: now() - this.t0 },
    };
  }

  /** `var` series keep their value into the new bar until the script says otherwise */
  private carry(): void {
    if (this.b === 0) return;
    for (const { arr } of this.varSlots) {
      if (arr[this.b] === undefined && arr[this.b - 1] !== undefined) arr[this.b] = arr[this.b - 1];
    }
  }

  /* ---- New York's clock and day --------------------------------------------------- */

  /**
   * Bar `i`'s calendar and clock in New York (core/nyTime). A day, week or month bar stands for its session's date —
   * the chart's own rule (components/gex/chartTime sessionDateOf: New York's date twelve hours on from the stamp, which
   * the house puts at that date's UTC midnight) — and its clock reads the date's start. An intraday bar is its moment:
   * nyParts reads the top of each UTC hour, and the minutes and seconds past it are counted on (New York's offset is a
   * whole number of hours, so its own hour turns where UTC's does; a reading that would run past the hour is read whole).
   */
  private clockOf(i: number): ClockParts {
    if (this.clockAt === i) return this.clock;
    const t = this.bars[i].time;
    let p: ClockParts;
    if (this.dwm) {
      const s = nyParts((t + HALF_DAY_S) * 1000);
      p = { year: s.year, month: s.month, day: s.day, hour: 0, minute: 0, second: 0, weekday: s.weekday };
    } else {
      const top = Math.floor(t / 3600) * 3600;
      if (top !== this.hourAt) {
        this.hourAt = top;
        this.hourParts = nyParts(top * 1000);
      }
      const past = Math.floor(t - top);
      const minute = this.hourParts.minute + Math.floor(past / 60);
      p = minute < 60 ? { ...this.hourParts, minute, second: this.hourParts.second + (past % 60) } : nyParts(Math.floor(t) * 1000);
    }
    this.clockAt = i;
    this.clock = p;
    return p;
  }

  /** The session bar `i` belongs to: New York's date on an intraday pane; on a daily or longer one every bar is its own (TradingView restarts a session VWAP on each) */
  private sessionOf(i: number): string {
    if (this.sessionAt === i) return this.session;
    const p = this.dwm ? null : this.clockOf(i);
    this.sessionAt = i;
    this.session = p ? `${p.year}-${p.month}-${p.day}` : `bar ${i}`;
    return this.session;
  }

  /** `ta.obv`, `ta.tr` and `ta.vwap` as variables: one series for the run, filled up to the bar asked for — so a read inside an `if` or a `[k]` back sees the whole series, as Pine's built-in variables are */
  private taVar(path: string, at: number): number {
    if (at < 0) return NA;
    let s = this.taVars.get(path);
    if (!s) {
      s = { values: new Float64Array(this.n).fill(NA), upTo: -1, state: {} };
      this.taVars.set(path, s);
    }
    while (s.upTo < at) {
      const i = ++s.upTo;
      const bar = this.bars[i];
      s.values[i] =
        path === 'ta.obv' ? ta.obv(s.state, bar.close, bar.volume)
        : path === 'ta.tr' ? ta.tr(s.state, bar.high, bar.low, bar.close, false)
        : ta.vwap(s.state, (bar.high + bar.low + bar.close) / 3, bar.volume, this.sessionOf(i));
    }
    return s.values[at];
  }

  /* ---- series ------------------------------------------------------------------ */

  private readBack(slot: Slot, back: number): Value {
    const i = this.b - back;
    if (i < 0) return NA;
    const v = slot.arr[i];
    return v === undefined ? NA : v;
  }

  private resolve(sc: Scope, name: string): Slot | undefined {
    for (let s: Scope | null = sc; s; s = s.parent) {
      const k = s.names.get(name);
      if (k !== undefined) return k;
    }
    return undefined;
  }

  /** The slot a name declared in `sc` writes to — the same one every bar */
  private declare(sc: Scope, name: string): Slot {
    let slot = sc.slots.get(name);
    if (!slot) {
      slot = { arr: [] };
      sc.slots.set(name, slot);
    }
    sc.names.set(name, slot);
    return slot;
  }

  private loopVar(sc: Scope, name: string): Value | undefined {
    for (let s: Scope | null = sc; s; s = s.parent) {
      if (s.loop?.has(name)) return s.loop.get(name);
    }
    return undefined;
  }

  private builtinSeries(name: string, b: number): Value | undefined {
    if (b < 0) return NA;
    const bar = this.bars[b];
    switch (name) {
      case 'open':
        return bar.open;
      case 'high':
        return bar.high;
      case 'low':
        return bar.low;
      case 'close':
        return bar.close;
      case 'volume':
        return bar.volume;
      case 'hl2':
        return (bar.high + bar.low) / 2;
      case 'hlc3':
        return (bar.high + bar.low + bar.close) / 3;
      case 'ohlc4':
        return (bar.open + bar.high + bar.low + bar.close) / 4;
      case 'hlcc4':
        return (bar.high + bar.low + bar.close + bar.close) / 4;
      case 'time':
        return bar.time * 1000;
      case 'time_close':
        return (this.bars[b + 1]?.time ?? bar.time + (bar.time - (this.bars[b - 1]?.time ?? bar.time - 60))) * 1000;
      case 'bar_index':
        return b;
    }
    return undefined;
  }

  private builtinVar(name: string): Value | undefined {
    if (BUILTIN_SERIES.has(name)) return this.builtinSeries(name, this.b);
    switch (name) {
      case 'last_bar_index':
        return this.n - 1;
      case 'na':
        return NA;
      case 'timenow':
        return Date.now();
      /* the exchange's calendar and clock — New York's, never the machine's (2026-10-15) */
      case 'year':
      case 'month':
      case 'dayofmonth':
      case 'dayofweek':
      case 'hour':
      case 'minute':
      case 'second':
      case 'weekofyear':
        return clockField(name, this.clockOf(this.b));
    }
    return undefined;
  }

  private member(path: string, line: number): Value {
    let named = this.memberKept.get(path);
    if (!named) {
      /* a constant or a named colour is the same on every bar; anything else is split into its namespace once */
      if (path in CONSTANTS) named = { fixed: CONSTANTS[path] };
      else {
        const c = path.startsWith('color.') ? namedColor(path.slice(6)) : null;
        if (c) named = { fixed: c };
        else {
          const dot = path.indexOf('.');
          named = { ns: path.slice(0, dot), key: path.slice(dot + 1) };
        }
      }
      this.memberKept.set(path, named);
    }
    if ('fixed' in named) return named.fixed;
    const { ns, key } = named;
    switch (ns) {
      case 'barstate':
        switch (key) {
          case 'isfirst':
            return this.b === 0;
          case 'islast':
            return this.b === this.n - 1;
          case 'isconfirmed':
            return !(this.ctx.liveLast && this.b === this.n - 1);
          case 'isrealtime':
            return this.ctx.liveLast && this.b === this.n - 1;
          case 'ishistory':
            return !(this.ctx.liveLast && this.b === this.n - 1);
          case 'isnew':
            return true;
          case 'islastconfirmedhistory':
            return this.b === (this.ctx.liveLast ? this.n - 2 : this.n - 1);
        }
        break;
      case 'syminfo':
        switch (key) {
          case 'ticker':
          case 'tickerid':
          case 'root':
            return this.ctx.ticker;
          case 'mintick':
            return this.ctx.mintick;
          case 'type':
            return 'stock';
          case 'currency':
          case 'basecurrency':
            return 'USD';
          case 'description':
            return this.ctx.ticker;
          case 'timezone':
            return 'America/New_York';
          case 'pointvalue':
            return 1;
        }
        break;
      case 'timeframe': {
        const f = this.frame;
        switch (key) {
          case 'period':
          case 'main_period':
            return f.period;
          case 'multiplier':
            return f.mult;
          case 'isintraday':
            return f.unit === 'm' || f.unit === 'S';
          case 'isminutes':
            return f.unit === 'm';
          case 'isseconds':
            return f.unit === 'S';
          case 'isdaily':
            return f.unit === 'D';
          case 'isweekly':
            return f.unit === 'W';
          case 'ismonthly':
            return f.unit === 'M';
          case 'isdwm':
            return this.dwm;
        }
        break;
      }
      case 'slayer':
        return key in this.ctx.slayer ? this.ctx.slayer[key] : NA;
    }
    throw new PineError(`"${path}" is not something the runtime knows`, line);
  }

  /* ---- expressions ------------------------------------------------------------- */

  private ev(e: Expr, sc: Scope): Value {
    switch (e.t) {
      case 'num':
        return e.v;
      case 'str':
        return e.v;
      case 'bool':
        return e.v;
      case 'na':
        return NA;
      case 'color':
        return fromHex(e.v);
      case 'id': {
        const lv = this.loopVar(sc, e.name);
        if (lv !== undefined) return lv;
        const slot = this.resolve(sc, e.name);
        if (slot !== undefined) return this.readBack(slot, 0);
        const bv = this.builtinVar(e.name);
        if (bv !== undefined) return bv;
        if (this.funcs.has(e.name)) throw new PineError(`"${e.name}" is a function — call it with brackets`, e.line);
        throw new PineError(`"${e.name}" is not declared`, e.line);
      }
      case 'member':
        if (TA_VARS.has(e.path)) return this.taVar(e.path, this.b);
        return this.member(e.path, e.line);
      case 'call':
        return this.call(e, sc);
      case 'index':
        return this.index(e, sc);
      case 'unary': {
        const v = this.ev(e.e, sc);
        if (e.op === 'not') return !asBool(v);
        const n = asNum(v);
        return e.op === '-' ? -n : n;
      }
      case 'bin':
        return this.binary(e, sc);
      case 'tern':
        return asBool(this.ev(e.c, sc)) ? this.ev(e.a, sc) : this.ev(e.b, sc);
      case 'tuple':
        return { tuple: e.items.map(i => this.ev(i, sc)) };
      case 'ifexpr': {
        for (const br of e.branches) {
          if (!br.cond || asBool(this.ev(br.cond, sc))) return this.execBlock(br.body, this.kid(sc, e.id));
        }
        return NA;
      }
      case 'switchexpr':
        return this.switchValue(e.subject, e.cases, e.id, sc);
    }
  }

  private binary(e: Extract<Expr, { t: 'bin' }>, sc: Scope): Value {
    if (e.op === 'and') return asBool(this.ev(e.l, sc)) ? asBool(this.ev(e.r, sc)) : false;
    if (e.op === 'or') return asBool(this.ev(e.l, sc)) ? true : asBool(this.ev(e.r, sc));
    const l = this.ev(e.l, sc);
    const r = this.ev(e.r, sc);
    switch (e.op) {
      case '+':
        if (typeof l === 'string' || typeof r === 'string') return this.str(l) + this.str(r);
        return asNum(l) + asNum(r);
      case '-':
        return asNum(l) - asNum(r);
      case '*':
        return asNum(l) * asNum(r);
      case '/': {
        const d = asNum(r);
        if (d === 0) return NA;
        const q = asNum(l) / d;
        return e.intDiv ? Math.trunc(q) : q;
      }
      case '%': {
        const d = asNum(r);
        return d === 0 ? NA : asNum(l) % d;
      }
      case '==':
        return this.equals(l, r);
      case '!=':
        return !this.equals(l, r);
      case '<':
        return asNum(l) < asNum(r);
      case '>':
        return asNum(l) > asNum(r);
      case '<=':
        return asNum(l) <= asNum(r);
      case '>=':
        return asNum(l) >= asNum(r);
    }
    throw new PineError(`The operator "${e.op}" is not in Pine`, e.line);
  }

  private equals(l: Value, r: Value): boolean {
    if (isNa(l) || isNa(r)) return isNa(l) && isNa(r);
    if (typeof l === 'number' && typeof r === 'number') return l === r;
    if (typeof l === 'string' || typeof r === 'string') return this.str(l) === this.str(r);
    if (typeof l === 'boolean' || typeof r === 'boolean') return asBool(l) === asBool(r);
    if (isColor(l) && isColor(r)) return l.r === r.r && l.g === r.g && l.b === r.b && l.a === r.a;
    return l === r;
  }

  private str(v: Value): string {
    if (v === null) return 'na';
    if (typeof v === 'string') return v;
    if (typeof v === 'number') return Number.isNaN(v) ? 'NaN' : Number.isInteger(v) ? String(v) : String(Number(v.toFixed(8)));
    if (typeof v === 'boolean') return String(v);
    if (isColor(v)) return toCss(v);
    return '';
  }

  private index(e: Extract<Expr, { t: 'index' }>, sc: Scope): Value {
    const k = Math.floor(asNum(this.ev(e.index, sc)));
    if (Number.isNaN(k) || k < 0) return NA;
    const base = e.base;
    if (base.t === 'id') {
      if (this.loopVar(sc, base.name) !== undefined) throw new PineError(`"${base.name}" is a loop counter — it has no history`, e.line);
      const slot = this.resolve(sc, base.name);
      if (slot !== undefined) return this.readBack(slot, k);
      if (BUILTIN_SERIES.has(base.name)) return this.builtinSeries(base.name, this.b - k) ?? NA;
      if (this.builtinVar(base.name) !== undefined) throw new PineError(`"${base.name}" has no history`, e.line);
      throw new PineError(`"${base.name}" is not declared`, e.line);
    }
    if (base.t === 'member' && TA_VARS.has(base.path)) return this.taVar(base.path, this.b - k);
    /* anything else: run it now, keep what it was, answer from k bars back */
    let arr = sc.hist.get(base.id);
    if (!arr) {
      arr = [];
      sc.hist.set(base.id, arr);
    }
    const v = this.ev(base, sc);
    arr[this.b] = v;
    if (k === 0) return v;
    const i = this.b - k;
    if (i < 0) return NA;
    const back = arr[i];
    return back === undefined ? NA : back;
  }

  private call(e: Extract<Expr, { t: 'call' }>, sc: Scope): Value {
    const fn = this.funcs.get(e.callee);
    if (fn) return this.callUser(fn, e, sc);
    let site = sc.sites.get(e.id);
    if (!site) {
      site = { state: {}, args: e.args.map(a => ({ name: a.name, value: NA })), bound: {} };
      /* a colour made of constants is the same colour every bar — read once, the way analyze reads it for the library */
      if (e.callee === 'color.new' || e.callee === 'color.rgb') {
        const v = constEval(e);
        if (v !== undefined && v !== null) site.fixed = v;
      }
      sc.sites.set(e.id, site);
    }
    if (site.fixed !== undefined) return site.fixed;
    const args = site.args;
    for (let i = 0; i < args.length; i++) args[i].value = this.ev(e.args[i].value, sc);
    const v = callBuiltin(this.ctx, e.callee, args, site.state, e.id, e.line, site.bound);
    /* the header and a typed input say the same thing on every bar (Pine allows them only constant arguments) — asked once
       a run; `input.source` and the bare `input()`, which may hand a series, are asked every bar */
    if (ONCE.has(e.callee)) site.fixed = v;
    return v;
  }

  private callUser(fn: UserFunction, e: Extract<Expr, { t: 'call' }>, sc: Scope): Value {
    if (e.args.length !== fn.params.length) throw new PineError(`${fn.name}() takes ${fn.params.length} argument${fn.params.length === 1 ? '' : 's'}, not ${e.args.length}`, e.line);
    if (++this.depth > 64) throw new PineError(`${fn.name}() calls itself too deeply`, e.line);
    try {
      /* the call site's own scope — its parent is the module's, so the function sees the script's globals and never the caller's locals */
      const scope = this.kid(sc, e.id, this.module);
      /* named arguments may come in any order */
      const values: Value[] = new Array(fn.params.length);
      const positional = e.args.filter(a => !a.name);
      let pos = 0;
      for (const a of e.args) {
        if (a.name) {
          const i = fn.params.indexOf(a.name);
          if (i < 0) throw new PineError(`${fn.name}() has no argument named "${a.name}"`, e.line);
          values[i] = this.ev(a.value, sc);
        } else values[fn.params.indexOf(fn.params[pos])] = this.ev(positional[pos++].value, sc);
      }
      fn.params.forEach((p, i) => {
        this.declare(scope, p).arr[this.b] = values[i] ?? NA;
      });
      return this.execBlock(fn.body as Stmt[], scope);
    } finally {
      this.depth--;
    }
  }

  /* ---- statements ---------------------------------------------------------------- */

  /**
   * The scope a block (an `if`'s branch, a loop's body, a function's call) runs in under `sc` — the same object every bar,
   * so what hangs off it by node id keeps from bar to bar; what it has declared is forgotten each time it runs again, as
   * a fresh scope would.
   */
  private kid(sc: Scope, id: number, parent: Scope = sc): Scope {
    let k = sc.kids.get(id);
    if (!k) {
      k = scopeOf(parent);
      sc.kids.set(id, k);
    } else {
      k.names.clear();
      k.loop?.clear();
    }
    return k;
  }

  /** Runs the statements; the value is the last one's — what a function returns and an `if` expression gives */
  private execBlock(stmts: Stmt[], sc: Scope): Value {
    let last: Value = NA;
    for (const s of stmts) last = this.exec(s, sc);
    return last;
  }

  private exec(s: Stmt, sc: Scope): Value {
    switch (s.t) {
      case 'decl': {
        const slots = s.names.map(nm => this.declare(sc, nm));
        if (s.kind !== '') {
          const arr = slots[0].arr;
          if (arr[this.b] !== undefined) return arr[this.b];
          if (this.b > 0 && arr[this.b - 1] !== undefined) return arr[this.b - 1];
          slots.forEach(k => this.varSlots.add(k));
        }
        const v = this.ev(s.expr, sc);
        if (s.names.length === 1) {
          slots[0].arr[this.b] = v;
          return v;
        }
        if (!isTuple(v)) throw new PineError(`"[${s.names.join(', ')}] =" needs a value with that many parts`, s.line);
        slots.forEach((k, i) => (k.arr[this.b] = v.tuple[i] ?? NA));
        return v;
      }
      case 'assign': {
        const lv = this.loopVar(sc, s.name);
        if (lv !== undefined) throw new PineError(`"${s.name}" is a loop counter — it cannot be assigned`, s.line);
        const slot = this.resolve(sc, s.name);
        if (slot === undefined) throw new PineError(`"${s.name}" is not declared — write "${s.name} = …" first`, s.line);
        let v = this.ev(s.expr, sc);
        if (s.op !== ':=') {
          const cur = this.readBack(slot, 0);
          const op = s.op[0];
          if (op === '+' && (typeof cur === 'string' || typeof v === 'string')) v = this.str(cur) + this.str(v);
          else {
            const a = asNum(cur);
            const b = asNum(v);
            v = op === '+' ? a + b : op === '-' ? a - b : op === '*' ? a * b : op === '/' ? (b === 0 ? NA : a / b) : b === 0 ? NA : a % b;
          }
        }
        slot.arr[this.b] = v;
        return v;
      }
      case 'expr':
        return this.ev(s.e, sc);
      case 'if': {
        for (const br of s.branches) {
          if (!br.cond || asBool(this.ev(br.cond, sc))) return this.execBlock(br.body, this.kid(sc, s.id));
        }
        return NA;
      }
      case 'for': {
        const from = asNum(this.ev(s.from, sc));
        const to = asNum(this.ev(s.to, sc));
        let by = s.by ? asNum(this.ev(s.by, sc)) : from <= to ? 1 : -1;
        if (by === 0 || Number.isNaN(by)) by = 1;
        if (Number.isNaN(from) || Number.isNaN(to)) return NA;
        const scope = this.kid(sc, s.id);
        scope.loop ??= new Map();
        let last: Value = NA;
        let guard = 0;
        for (let i = from; by > 0 ? i <= to : i >= to; i += by) {
          if (++guard > 100000) throw new PineError('A for loop ran past a hundred thousand turns on one bar', s.line);
          scope.loop!.set(s.name, i);
          try {
            last = this.execBlock(s.body, scope);
          } catch (sig) {
            if (sig instanceof BreakSignal) break;
            if (sig instanceof ContinueSignal) continue;
            throw sig;
          }
        }
        return last;
      }
      case 'while': {
        const scope = this.kid(sc, s.id);
        let last: Value = NA;
        let guard = 0;
        while (asBool(this.ev(s.cond, sc))) {
          if (++guard > 100000) throw new PineError('A while loop ran past a hundred thousand turns on one bar', s.line);
          try {
            last = this.execBlock(s.body, scope);
          } catch (sig) {
            if (sig instanceof BreakSignal) break;
            if (sig instanceof ContinueSignal) continue;
            throw sig;
          }
        }
        return last;
      }
      case 'switch':
        return this.switchValue(s.subject, s.cases, s.id, sc);
      case 'fn':
        return NA;
      case 'break':
        throw new BreakSignal();
      case 'continue':
        throw new ContinueSignal();
    }
  }

  private switchValue(subject: Expr | null, cases: { match: Expr | null; body: Stmt[] }[], id: number, sc: Scope): Value {
    const subj = subject ? this.ev(subject, sc) : undefined;
    for (const c of cases) {
      if (!c.match) return this.execBlock(c.body, this.kid(sc, id));
      const m = this.ev(c.match, sc);
      const hit = subject ? this.equals(subj as Value, m) : asBool(m);
      if (hit) return this.execBlock(c.body, this.kid(sc, id));
    }
    return NA;
  }
}

export type { PlotRef };
