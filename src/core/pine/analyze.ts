/*
==================================================
  SLAYER TERMINAL - READING A SCRIPT BEFORE IT RUNS
  (core/pine/analyze.ts)

  Two walks over the tree that never touch a bar:

    THE PLAN — every output call (plot, plotshape,
    plotchar, hline, fill, alertcondition, alert) and
    every input call, in source order, so the run and
    the library number them the same way; an input's
    id is the variable it is assigned to.

    THE META — what the library keeps beside the
    text (types/scripts ScriptMeta): the header's
    title and pane, the inputs with their defaults
    and bounds, the plots with their inks, the fills,
    the alerts, and whether the script reads the
    terminal's own numbers. Only constant arguments
    are read; a dynamic colour falls back to the
    house's line ink.

  And one small pass that marks integer division —
  Pine truncates `7 / 2` to 3 when both sides are
  whole numbers, and a Hull average's `len / 2`
  depends on it.
==================================================
*/

import type { ScriptInput, ScriptInputValue, ScriptMeta, ScriptPlot, ScriptPlotStyle } from '../../types/scripts';
import type { Arg, Expr, Program, Stmt } from './ast';
import { CONSTANTS, inputKindOf } from './builtins';
import { fromHex, isColor, named, rgb, toCss, withTransp } from './colors';
import type { Value } from './types';

/** The house's line ink when a plot's colour is decided bar by bar */
export const DYNAMIC_INK = '#5B9CF6';

export interface OutputPlan {
  plots: number[];
  shapes: number[];
  hlines: number[];
  fills: number[];
  alerts: number[];
  /** input call node id → the input's id */
  inputIds: Map<number, string>;
}

const OUTPUT_CALLS = new Set(['plot', 'plotshape', 'plotchar', 'hline', 'fill', 'alertcondition', 'alert']);
const isInputCall = (callee: string) => callee === 'input' || callee.startsWith('input.');

/* ---- walking ------------------------------------------------------------------- */

function walkExpr(e: Expr, visit: (e: Expr) => void): void {
  visit(e);
  switch (e.t) {
    case 'call':
      e.args.forEach(a => walkExpr(a.value, visit));
      break;
    case 'index':
      walkExpr(e.base, visit);
      walkExpr(e.index, visit);
      break;
    case 'unary':
      walkExpr(e.e, visit);
      break;
    case 'bin':
      walkExpr(e.l, visit);
      walkExpr(e.r, visit);
      break;
    case 'tern':
      walkExpr(e.c, visit);
      walkExpr(e.a, visit);
      walkExpr(e.b, visit);
      break;
    case 'tuple':
      e.items.forEach(i => walkExpr(i, visit));
      break;
    case 'ifexpr':
      e.branches.forEach(br => {
        if (br.cond) walkExpr(br.cond, visit);
        br.body.forEach(s => walkStmt(s, visit));
      });
      break;
    case 'switchexpr':
      if (e.subject) walkExpr(e.subject, visit);
      e.cases.forEach(c => {
        if (c.match) walkExpr(c.match, visit);
        c.body.forEach(s => walkStmt(s, visit));
      });
      break;
  }
}

function walkStmt(s: Stmt, visit: (e: Expr, owner?: Stmt) => void): void {
  switch (s.t) {
    case 'decl':
    case 'assign':
      walkExpr(s.expr, e => visit(e, s));
      break;
    case 'expr':
      walkExpr(s.e, e => visit(e, s));
      break;
    case 'if':
      s.branches.forEach(br => {
        if (br.cond) walkExpr(br.cond, visit);
        br.body.forEach(x => walkStmt(x, visit));
      });
      break;
    case 'for':
      walkExpr(s.from, visit);
      walkExpr(s.to, visit);
      if (s.by) walkExpr(s.by, visit);
      s.body.forEach(x => walkStmt(x, visit));
      break;
    case 'while':
      walkExpr(s.cond, visit);
      s.body.forEach(x => walkStmt(x, visit));
      break;
    case 'switch':
      if (s.subject) walkExpr(s.subject, visit);
      s.cases.forEach(c => {
        if (c.match) walkExpr(c.match, visit);
        c.body.forEach(x => walkStmt(x, visit));
      });
      break;
    case 'fn':
      s.body.forEach(x => walkStmt(x, visit));
      break;
  }
}

/* ---- the plan --------------------------------------------------------------------- */

export function planOutputs(program: Program): OutputPlan {
  const plan: OutputPlan = { plots: [], shapes: [], hlines: [], fills: [], alerts: [], inputIds: new Map() };
  let inputN = 0;
  const seenInputs = new Set<number>();
  for (const s of program.body) {
    walkStmt(s, (e, owner) => {
      if (e.t !== 'call') return;
      if (isInputCall(e.callee) && !seenInputs.has(e.id)) {
        seenInputs.add(e.id);
        inputN++;
        /* the variable the input is assigned to names it — `convLen = input.int(9, …)` */
        const direct = owner && owner.t === 'decl' && owner.expr === e && owner.names.length === 1;
        plan.inputIds.set(e.id, direct ? owner.names[0] : `input${inputN}`);
        return;
      }
      if (!OUTPUT_CALLS.has(e.callee)) return;
      if (e.callee === 'plot') plan.plots.push(e.id);
      else if (e.callee === 'plotshape' || e.callee === 'plotchar') plan.shapes.push(e.id);
      else if (e.callee === 'hline') plan.hlines.push(e.id);
      else if (e.callee === 'fill') plan.fills.push(e.id);
      else plan.alerts.push(e.id);
    });
  }
  return plan;
}

/* ---- constants ------------------------------------------------------------------ */

/** A value the script fixed in its text — a literal, a named constant, a colour built from constants — or undefined */
export function constEval(e: Expr): Value | undefined {
  switch (e.t) {
    case 'num':
      return e.v;
    case 'str':
      return e.v;
    case 'bool':
      return e.v;
    case 'na':
      return null;
    case 'color':
      return fromHex(e.v);
    case 'member': {
      if (e.path.startsWith('color.')) return named(e.path.slice(6));
      return e.path in CONSTANTS ? CONSTANTS[e.path] : undefined;
    }
    case 'unary': {
      const v = constEval(e.e);
      if (typeof v !== 'number') return undefined;
      return e.op === '-' ? -v : v;
    }
    case 'bin': {
      const l = constEval(e.l);
      const r = constEval(e.r);
      if (l === undefined || r === undefined) return undefined;
      if (e.op === '+' && (typeof l === 'string' || typeof r === 'string')) return String(l) + String(r);
      if (typeof l !== 'number' || typeof r !== 'number') return undefined;
      switch (e.op) {
        case '+':
          return l + r;
        case '-':
          return l - r;
        case '*':
          return l * r;
        case '/':
          return e.intDiv ? Math.trunc(l / r) : l / r;
      }
      return undefined;
    }
    case 'call': {
      const args = e.args.map(a => ({ name: a.name, value: constEval(a.value) }));
      if (args.some(a => a.value === undefined)) return undefined;
      const pos = (i: number, name: string) => args.find(a => a.name === name)?.value ?? args.filter(a => !a.name)[i]?.value;
      if (e.callee === 'color.new') {
        const c = pos(0, 'color');
        const t = pos(1, 'transp');
        return isColor(c) && typeof t === 'number' ? withTransp(c, t) : undefined;
      }
      if (e.callee === 'color.rgb') {
        const [r, g, b, t] = [pos(0, 'red'), pos(1, 'green'), pos(2, 'blue'), pos(3, 'transp') ?? 0];
        return typeof r === 'number' && typeof g === 'number' && typeof b === 'number' && typeof t === 'number' ? rgb(r, g, b, t) : undefined;
      }
      return undefined;
    }
    default:
      return undefined;
  }
}

/* ---- the meta ------------------------------------------------------------------- */

const argOf = (args: Arg[], name: string, position: number): Expr | undefined => args.find(a => a.name === name)?.value ?? args.filter(a => !a.name)[position]?.value;
const constArg = (args: Arg[], name: string, position: number): Value | undefined => {
  const e = argOf(args, name, position);
  return e ? constEval(e) : undefined;
};
const toInputValue = (v: Value | undefined): ScriptInputValue | undefined => (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string' ? v : isColor(v) ? toCss(v) : undefined);

const STYLE_SET = new Set<ScriptPlotStyle>(['line', 'stepline', 'histogram', 'columns', 'area', 'circles', 'cross']);

export function analyze(program: Program, plan: OutputPlan): ScriptMeta {
  const meta: ScriptMeta = { version: 6, title: '', kind: 'indicator', pane: 'own', inputs: [], plots: [], fills: plan.fills.length, alerts: [], usesSlayer: false };
  const seenInputs = new Set<number>();
  let plotN = 0;
  for (const s of program.body) {
    walkStmt(s, e => {
      if (e.t === 'member' && e.path.startsWith('slayer.')) meta.usesSlayer = true;
      if (e.t !== 'call') return;
      const c = e.callee;
      if (c === 'indicator' || c === 'strategy' || c === 'library') {
        const title = constArg(e.args, 'title', 0);
        meta.title = typeof title === 'string' ? title : '';
        meta.kind = c === 'strategy' ? 'strategy' : c === 'library' ? 'library' : 'indicator';
        meta.pane = constArg(e.args, 'overlay', 2) === true ? 'overlay' : 'own';
        return;
      }
      if (isInputCall(c) && !seenInputs.has(e.id)) {
        seenInputs.add(e.id);
        const id = plan.inputIds.get(e.id) ?? `input${meta.inputs.length + 1}`;
        const dflt = constArg(e.args, 'defval', 0);
        const title = constArg(e.args, 'title', 1);
        const optionsArg = argOf(e.args, 'options', -1);
        const options = optionsArg?.t === 'tuple' ? optionsArg.items.map(i => constEval(i)).filter((v): v is string => typeof v === 'string') : undefined;
        const input: ScriptInput = {
          id,
          kind: inputKindOf(c, dflt ?? null),
          title: typeof title === 'string' ? title : id,
          default: toInputValue(dflt) ?? (c === 'input.source' ? 'close' : 0),
        };
        const min = constArg(e.args, 'minval', -1);
        const max = constArg(e.args, 'maxval', -1);
        const step = constArg(e.args, 'step', -1);
        const group = constArg(e.args, 'group', -1);
        const tooltip = constArg(e.args, 'tooltip', -1);
        if (typeof min === 'number') input.min = min;
        if (typeof max === 'number') input.max = max;
        if (typeof step === 'number') input.step = step;
        if (options?.length) input.options = options;
        if (typeof group === 'string') input.group = group;
        if (typeof tooltip === 'string') input.tooltip = tooltip;
        if (c === 'input.source' && typeof dflt !== 'string') {
          const src = argOf(e.args, 'defval', 0);
          input.default = src?.t === 'id' ? src.name : 'close';
        }
        meta.inputs.push(input);
        return;
      }
      if (c === 'plot') {
        plotN++;
        const title = constArg(e.args, 'title', 1);
        const color = constArg(e.args, 'color', 2);
        const width = constArg(e.args, 'linewidth', 3);
        const style = constArg(e.args, 'style', 4);
        const plot: ScriptPlot = {
          id: `plot${plotN}`,
          title: typeof title === 'string' && title ? title : `Plot ${plotN}`,
          ink: isColor(color) ? toCss(color) : DYNAMIC_INK,
          style: typeof style === 'string' && STYLE_SET.has(style as ScriptPlotStyle) ? (style as ScriptPlotStyle) : 'line',
          width: typeof width === 'number' ? width : 1,
        };
        meta.plots.push(plot);
        return;
      }
      if (c === 'alertcondition') {
        const title = constArg(e.args, 'title', 1);
        const message = constArg(e.args, 'message', 2);
        meta.alerts.push({ id: `alert${meta.alerts.length + 1}`, title: typeof title === 'string' ? title : `Alert ${meta.alerts.length + 1}`, message: typeof message === 'string' ? message : '' });
      }
    });
  }
  return meta;
}

/* ---- integer division ------------------------------------------------------------ */

type NumType = 'int' | 'float' | 'other';

/** Marks every `/` whose two sides are whole numbers, so the run truncates it the way Pine does */
export function markIntDivision(program: Program): void {
  const INT_VARS = new Set(['bar_index', 'last_bar_index', 'year', 'month', 'dayofmonth', 'dayofweek', 'hour', 'minute', 'second', 'weekofyear', 'time', 'time_close', 'timenow']);
  const INT_CALLS = new Set(['input.int', 'math.floor', 'math.ceil', 'ta.barssince', 'ta.highestbars', 'ta.lowestbars', 'str.length', 'int']);

  const typeOf = (e: Expr, env: Map<string, NumType>): NumType => {
    switch (e.t) {
      case 'num':
        return e.isInt ? 'int' : 'float';
      case 'id':
        return env.get(e.name) ?? (INT_VARS.has(e.name) ? 'int' : 'float');
      case 'member':
        return e.path.startsWith('dayofweek.') ? 'int' : 'float';
      case 'call': {
        if (INT_CALLS.has(e.callee)) return 'int';
        if (e.callee === 'math.round') return e.args.length === 1 ? 'int' : 'float';
        if (e.callee === 'math.abs' || e.callee === 'math.max' || e.callee === 'math.min' || e.callee === 'nz') {
          const ts = e.args.map(a => typeOf(a.value, env));
          return ts.every(t => t === 'int') ? 'int' : 'float';
        }
        return 'float';
      }
      case 'index':
        return typeOf(e.base, env);
      case 'unary':
        return e.op === 'not' ? 'other' : typeOf(e.e, env);
      case 'bin': {
        const l = typeOf(e.l, env);
        const r = typeOf(e.r, env);
        if (['+', '-', '*', '%', '/'].includes(e.op)) return l === 'int' && r === 'int' ? 'int' : 'float';
        return 'other';
      }
      case 'tern': {
        const a = typeOf(e.a, env);
        const b = typeOf(e.b, env);
        return a === 'int' && b === 'int' ? 'int' : a === 'other' ? 'other' : 'float';
      }
      default:
        return 'float';
    }
  };

  const mark = (e: Expr, env: Map<string, NumType>): void => {
    walkExpr(e, x => {
      if (x.t === 'bin' && x.op === '/') x.intDiv = typeOf(x.l, env) === 'int' && typeOf(x.r, env) === 'int';
    });
  };

  const walk = (stmts: Stmt[], env: Map<string, NumType>): void => {
    for (const s of stmts) {
      switch (s.t) {
        case 'decl': {
          mark(s.expr, env);
          const declared = s.declaredType === 'int' ? 'int' : s.declaredType === 'float' ? 'float' : undefined;
          if (s.names.length === 1) env.set(s.names[0], declared ?? typeOf(s.expr, env));
          else s.names.forEach(n => env.set(n, 'float'));
          break;
        }
        case 'assign':
        case 'expr':
          mark(s.t === 'assign' ? s.expr : s.e, env);
          break;
        case 'if':
          s.branches.forEach(br => {
            if (br.cond) mark(br.cond, env);
            walk(br.body, env);
          });
          break;
        case 'for':
          mark(s.from, env);
          mark(s.to, env);
          if (s.by) mark(s.by, env);
          env.set(s.name, typeOf(s.from, env) === 'int' && typeOf(s.to, env) === 'int' ? 'int' : 'float');
          walk(s.body, env);
          break;
        case 'while':
          mark(s.cond, env);
          walk(s.body, env);
          break;
        case 'switch':
          if (s.subject) mark(s.subject, env);
          s.cases.forEach(c => {
            if (c.match) mark(c.match, env);
            walk(c.body, env);
          });
          break;
        case 'fn': {
          const inner = new Map(env);
          s.params.forEach(p => inner.set(p, 'float'));
          walk(s.body, inner);
          break;
        }
      }
    }
  };
  walk(program.body, new Map());
}
