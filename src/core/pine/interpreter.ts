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
==================================================
*/

import type { ScriptInputValue } from '../../types/scripts';
import type { OutputPlan } from './analyze';
import { asBool, asNum, callBuiltin, CONSTANTS, namedColor, type CallArg, type Ctx, type OutputSink, type State } from './builtins';
import { fromHex, isColor, toCss } from './colors';
import type { Expr, Stmt } from './ast';
import type { Program } from './ast';
import { PineError, type AlertOut, type Bar, type FillOut, type HLineOut, type PineColor, type PlotOut, type PlotRef, type RunOptions, type RunResult, type ShapeOut, type Tuple, type UserFunction, type Value } from './types';
import type { ShapeLocation, ShapeStyle } from './types';
import type { ScriptPlotStyle } from '../../types/scripts';

interface Scope {
  path: string;
  names: Map<string, string>;
  parent: Scope | null;
  /** Loop counters — plain values, not series */
  loop?: Map<string, Value>;
}

class BreakSignal {}
class ContinueSignal {}

const NA = NaN;
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const isNa = (v: Value) => v === null || (typeof v === 'number' && Number.isNaN(v));
const isTuple = (v: Value): v is Tuple => !!v && typeof v === 'object' && 'tuple' in v;
const isFn = (v: Value): v is UserFunction => !!v && typeof v === 'object' && 'fn' in v;

const BUILTIN_SERIES = new Set(['open', 'high', 'low', 'close', 'volume', 'hl2', 'hlc3', 'ohlc4', 'hlcc4', 'time', 'time_close', 'bar_index']);

export class Runner {
  private b = 0;
  private readonly n: number;
  private series = new Map<string, Value[]>();
  private varKeys = new Set<string>();
  private sites = new Map<string, State>();
  private hist = new Map<string, Value[]>();
  private funcs = new Map<string, UserFunction>();
  private module: Scope = { path: '', names: new Map(), parent: null };
  private depth = 0;
  private dateCache: { b: number; d: Date } | null = null;
  private readonly budget: number;
  private readonly t0: number;
  private warnings: string[] = [];

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
  private bgcolors: (string | null)[] | null = null;
  private barcolors: (string | null)[] | null = null;

  private ctx: Ctx;

  constructor(
    private program: Program,
    private bars: Bar[],
    private opts: RunOptions,
    private plan: OutputPlan
  ) {
    this.n = bars.length;
    this.budget = opts.budgetMs ?? 200;
    this.t0 = now();
    const inputs = opts.inputs ?? {};
    const slayer: Record<string, number> = {};
    for (const k of ['callWall', 'putWall', 'flip', 'supreme'] as const) if (typeof opts.slayer?.[k] === 'number') slayer[k] = opts.slayer[k]!;

    plan.plots.forEach((id, i) => {
      this.plotIndex.set(id, i);
      this.plots.push({ id: `plot${i + 1}`, title: '', style: 'line', ink: '#5B9CF6', width: 1, offset: 0, values: new Float64Array(this.n).fill(NA), colors: null, colorsArr: new Array(this.n).fill(null), hidden: false, forceOverlay: false, seen: false });
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
    plan.alerts.forEach((id, i) => {
      this.alertIndex.set(id, i);
      this.alerts.push({ id: `alert${i + 1}`, title: '', message: '', fired: new Uint8Array(this.n) });
    });

    const self = this;
    const sink: OutputSink = {
      plot(nodeId, value, color, o) {
        const i = self.plotIndex.get(nodeId);
        if (i === undefined) throw new PineError('plot() must sit at the top level of the script', 0);
        const p = self.plots[i];
        if (!p.seen) {
          p.seen = true;
          p.title = o.title || `Plot ${i + 1}`;
          p.style = o.style as ScriptPlotStyle;
          p.width = o.width;
          p.offset = o.offset;
          p.hidden = o.hidden;
          p.forceOverlay = o.forceOverlay;
          if (o.ink) p.ink = toCss(o.ink);
        }
        p.values[self.b] = value;
        if (color) p.colorsArr[self.b] = toCss(color);
        return { ref: 'plot', index: i };
      },
      hline(nodeId, price, o) {
        const i = self.hlineIndex.get(nodeId);
        if (i === undefined) throw new PineError('hline() must sit at the top level of the script', 0);
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
        const i = self.fillIndex.get(nodeId);
        if (i === undefined) throw new PineError('fill() must sit at the top level of the script', 0);
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
        const i = self.shapeIndex.get(nodeId);
        if (i === undefined) throw new PineError('plotshape() must sit at the top level of the script', 0);
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
        if (typeof on === 'number') {
          if (!Number.isNaN(on) && on !== 0) s.values[self.b] = s.location === 'absolute' ? on : 1;
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
        const i = self.alertIndex.get(nodeId);
        if (i === undefined) throw new PineError('alertcondition() must sit at the top level of the script', 0);
        const al = self.alerts[i];
        if (!al.title) {
          al.title = title || `Alert ${i + 1}`;
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
      sessionKey: '',
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
      c.sessionKey = this.dayKey(b);
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
      warnings: this.warnings,
      stats: { bars: this.n, ms: now() - this.t0 },
    };
  }

  /** `var` series keep their value into the new bar until the script says otherwise */
  private carry(): void {
    if (this.b === 0) return;
    for (const key of this.varKeys) {
      const arr = this.series.get(key)!;
      if (arr[this.b] === undefined && arr[this.b - 1] !== undefined) arr[this.b] = arr[this.b - 1];
    }
  }

  private dayKey(b: number): string {
    const t = this.bars[b].time;
    return String(Math.floor((t - 5 * 3600) / 86400));
  }

  private date(): Date {
    if (this.dateCache && this.dateCache.b === this.b) return this.dateCache.d;
    const d = new Date(this.bars[this.b].time * 1000);
    this.dateCache = { b: this.b, d };
    return d;
  }

  /* ---- series ------------------------------------------------------------------ */

  private set(key: string, v: Value): void {
    let arr = this.series.get(key);
    if (!arr) {
      arr = [];
      this.series.set(key, arr);
    }
    arr[this.b] = v;
  }

  private readBack(key: string, back: number): Value {
    const arr = this.series.get(key);
    if (!arr) return NA;
    const i = this.b - back;
    if (i < 0) return NA;
    const v = arr[i];
    return v === undefined ? NA : v;
  }

  private resolve(sc: Scope, name: string): string | undefined {
    for (let s: Scope | null = sc; s; s = s.parent) {
      const k = s.names.get(name);
      if (k !== undefined) return k;
    }
    return undefined;
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
      case 'year':
        return this.date().getFullYear();
      case 'month':
        return this.date().getMonth() + 1;
      case 'dayofmonth':
        return this.date().getDate();
      case 'dayofweek':
        return this.date().getDay() + 1;
      case 'hour':
        return this.date().getHours();
      case 'minute':
        return this.date().getMinutes();
      case 'second':
        return this.date().getSeconds();
      case 'weekofyear': {
        const d = this.date();
        const start = new Date(d.getFullYear(), 0, 1);
        return Math.ceil(((d.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
      }
    }
    return undefined;
  }

  private member(path: string, line: number): Value {
    if (path in CONSTANTS) return CONSTANTS[path];
    if (path.startsWith('color.')) {
      const c = namedColor(path.slice(6));
      if (c) return c;
    }
    const [ns, key] = path.split('.');
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
        const tf = this.ctx.timeframe;
        const mins = /^\d+$/.test(tf) ? Number(tf) : 0;
        switch (key) {
          case 'period':
            return tf;
          case 'multiplier':
            return mins || 1;
          case 'isintraday':
          case 'isminutes':
            return mins > 0;
          case 'isseconds':
            return /S$/.test(tf);
          case 'isdaily':
            return tf === 'D' || tf === '1D';
          case 'isweekly':
            return tf === 'W';
          case 'ismonthly':
            return tf === 'M';
          case 'isdwm':
            return /^[DWM]$/.test(tf);
        }
        break;
      }
      case 'slayer': {
        if (key === 'netGex') {
          const v = this.opts.slayer?.netGex?.[this.b];
          return typeof v === 'number' ? v : NA;
        }
        return key in this.ctx.slayer ? this.ctx.slayer[key] : NA;
      }
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
        const key = this.resolve(sc, e.name);
        if (key !== undefined) return this.readBack(key, 0);
        const bv = this.builtinVar(e.name);
        if (bv !== undefined) return bv;
        if (this.funcs.has(e.name)) throw new PineError(`"${e.name}" is a function — call it with brackets`, e.line);
        throw new PineError(`"${e.name}" is not declared`, e.line);
      }
      case 'member':
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
          if (!br.cond || asBool(this.ev(br.cond, sc))) return this.execBlock(br.body, this.child(sc, e.id));
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
      const key = this.resolve(sc, base.name);
      if (key !== undefined) return this.readBack(key, k);
      if (BUILTIN_SERIES.has(base.name)) return this.builtinSeries(base.name, this.b - k) ?? NA;
      if (this.builtinVar(base.name) !== undefined) throw new PineError(`"${base.name}" has no history`, e.line);
      throw new PineError(`"${base.name}" is not declared`, e.line);
    }
    /* anything else: run it now, keep what it was, answer from k bars back */
    const key = `${sc.path}|${base.id}`;
    let arr = this.hist.get(key);
    if (!arr) {
      arr = [];
      this.hist.set(key, arr);
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
    const args: CallArg[] = e.args.map(a => ({ name: a.name, value: this.ev(a.value, sc) }));
    const siteKey = `${sc.path}|${e.id}`;
    let state = this.sites.get(siteKey);
    if (!state) {
      state = {};
      this.sites.set(siteKey, state);
    }
    return callBuiltin(this.ctx, e.callee, args, state, e.id, e.line);
  }

  private callUser(fn: UserFunction, e: Extract<Expr, { t: 'call' }>, sc: Scope): Value {
    if (e.args.length !== fn.params.length) throw new PineError(`${fn.name}() takes ${fn.params.length} argument${fn.params.length === 1 ? '' : 's'}, not ${e.args.length}`, e.line);
    if (++this.depth > 64) throw new PineError(`${fn.name}() calls itself too deeply`, e.line);
    try {
      const path = `${sc.path}/${e.id}`;
      const scope: Scope = { path, names: new Map(), parent: this.module };
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
        const key = `${path}|${p}`;
        scope.names.set(p, key);
        this.set(key, values[i] ?? NA);
      });
      return this.execBlock(fn.body as Stmt[], scope);
    } finally {
      this.depth--;
    }
  }

  /* ---- statements ---------------------------------------------------------------- */

  private child(sc: Scope, id: number): Scope {
    return { path: `${sc.path}/${id}`, names: new Map(), parent: sc };
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
        const keys = s.names.map(nm => {
          const key = `${sc.path}|${nm}`;
          sc.names.set(nm, key);
          return key;
        });
        if (s.kind !== '') {
          const arr = this.series.get(keys[0]);
          if (arr && arr[this.b] !== undefined) return arr[this.b];
          if (arr && this.b > 0 && arr[this.b - 1] !== undefined) return arr[this.b - 1];
          keys.forEach(k => this.varKeys.add(k));
        }
        const v = this.ev(s.expr, sc);
        if (s.names.length === 1) {
          this.set(keys[0], v);
          return v;
        }
        if (!isTuple(v)) throw new PineError(`"[${s.names.join(', ')}] =" needs a value with that many parts`, s.line);
        keys.forEach((k, i) => this.set(k, v.tuple[i] ?? NA));
        return v;
      }
      case 'assign': {
        const lv = this.loopVar(sc, s.name);
        if (lv !== undefined) throw new PineError(`"${s.name}" is a loop counter — it cannot be assigned`, s.line);
        const key = this.resolve(sc, s.name);
        if (key === undefined) throw new PineError(`"${s.name}" is not declared — write "${s.name} = …" first`, s.line);
        let v = this.ev(s.expr, sc);
        if (s.op !== ':=') {
          const cur = this.readBack(key, 0);
          const op = s.op[0];
          if (op === '+' && (typeof cur === 'string' || typeof v === 'string')) v = this.str(cur) + this.str(v);
          else {
            const a = asNum(cur);
            const b = asNum(v);
            v = op === '+' ? a + b : op === '-' ? a - b : op === '*' ? a * b : op === '/' ? (b === 0 ? NA : a / b) : b === 0 ? NA : a % b;
          }
        }
        this.set(key, v);
        return v;
      }
      case 'expr':
        return this.ev(s.e, sc);
      case 'if': {
        for (const br of s.branches) {
          if (!br.cond || asBool(this.ev(br.cond, sc))) return this.execBlock(br.body, this.child(sc, s.id));
        }
        return NA;
      }
      case 'for': {
        const from = asNum(this.ev(s.from, sc));
        const to = asNum(this.ev(s.to, sc));
        let by = s.by ? asNum(this.ev(s.by, sc)) : from <= to ? 1 : -1;
        if (by === 0 || Number.isNaN(by)) by = 1;
        if (Number.isNaN(from) || Number.isNaN(to)) return NA;
        const scope: Scope = { path: `${sc.path}/${s.id}`, names: new Map(), parent: sc, loop: new Map() };
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
        const scope = this.child(sc, s.id);
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
      if (!c.match) return this.execBlock(c.body, this.child(sc, id));
      const m = this.ev(c.match, sc);
      const hit = subject ? this.equals(subj as Value, m) : asBool(m);
      if (hit) return this.execBlock(c.body, this.child(sc, id));
    }
    return NA;
  }
}

/** A colour string a plot handed back, for callers that keep colours as text */
export const cssOf = (c: PineColor | null): string | null => (c ? toCss(c) : null);
export type { PlotRef };
