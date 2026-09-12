/*
==================================================
  SLAYER TERMINAL - THE PINE PARSER (core/pine/parser.ts)

  Logical lines into the tree. Blocks by indent;
  expressions by precedence, Pine's own order:

    1  ?:                     (lowest, right to left)
    2  or
    3  and
    4  ==  !=
    5  <  >  <=  >=
    6  +  -
    7  *  /  %
    8  unary + - not
    9  [ ]  .  ( )           (highest)

  What it refuses, it refuses in plain words with the
  line: `strategy()` and `library()` (not in this
  version yet), `import` / `export` / `method` /
  `type`, arrays and drawings.
==================================================
*/

import type { Arg, Expr, Program, Stmt } from './ast';
import { readLines, TYPE_WORDS, type LogicalLine, type Token } from './lexer';
import { PineError } from './types';

let nextId = 1;
const fresh = () => nextId++;

class LineParser {
  private i = 0;
  constructor(private toks: Token[], private line: number) {}

  get done(): boolean {
    return this.i >= this.toks.length;
  }
  peek(offset = 0): Token | undefined {
    return this.toks[this.i + offset];
  }
  next(): Token {
    const t = this.toks[this.i++];
    if (!t) throw new PineError('The line ends too soon', this.line);
    return t;
  }
  is(kind: Token['kind'], text?: string, offset = 0): boolean {
    const t = this.peek(offset);
    return !!t && t.kind === kind && (text === undefined || t.text === text);
  }
  isOp(text: string, offset = 0): boolean {
    return this.is('op', text, offset);
  }
  isKw(text: string, offset = 0): boolean {
    return this.is('kw', text, offset);
  }
  expectOp(text: string): Token {
    const t = this.peek();
    if (!t || t.kind !== 'op' || t.text !== text) throw new PineError(`Expected "${text}"${t ? ` but found "${t.text}"` : ''}`, this.line, t?.col);
    return this.next();
  }
  expectId(): Token {
    const t = this.peek();
    if (!t || t.kind !== 'id') throw new PineError(`Expected a name${t ? ` but found "${t.text}"` : ''}`, this.line, t?.col);
    return this.next();
  }
  /** The rest of the line must be empty */
  end(): void {
    const t = this.peek();
    if (t) throw new PineError(`Unexpected "${t.text}"`, this.line, t.col);
  }

  /* ---- expressions ---- */

  expr(): Expr {
    return this.ternary();
  }

  private ternary(): Expr {
    const c = this.or();
    if (this.isOp('?')) {
      const line = this.next().line;
      const a = this.ternary();
      this.expectOp(':');
      const b = this.ternary();
      return { t: 'tern', id: fresh(), line, c, a, b };
    }
    return c;
  }
  private or(): Expr {
    let l = this.and();
    while (this.isKw('or')) {
      const line = this.next().line;
      const r = this.and();
      l = { t: 'bin', id: fresh(), line, op: 'or', l, r };
    }
    return l;
  }
  private and(): Expr {
    let l = this.equality();
    while (this.isKw('and')) {
      const line = this.next().line;
      const r = this.equality();
      l = { t: 'bin', id: fresh(), line, op: 'and', l, r };
    }
    return l;
  }
  private equality(): Expr {
    let l = this.comparison();
    while (this.isOp('==') || this.isOp('!=')) {
      const op = this.next();
      const r = this.comparison();
      l = { t: 'bin', id: fresh(), line: op.line, op: op.text, l, r };
    }
    return l;
  }
  private comparison(): Expr {
    let l = this.additive();
    while (this.isOp('<') || this.isOp('>') || this.isOp('<=') || this.isOp('>=')) {
      const op = this.next();
      const r = this.additive();
      l = { t: 'bin', id: fresh(), line: op.line, op: op.text, l, r };
    }
    return l;
  }
  private additive(): Expr {
    let l = this.multiplicative();
    while (this.isOp('+') || this.isOp('-')) {
      const op = this.next();
      const r = this.multiplicative();
      l = { t: 'bin', id: fresh(), line: op.line, op: op.text, l, r };
    }
    return l;
  }
  private multiplicative(): Expr {
    let l = this.unary();
    while (this.isOp('*') || this.isOp('/') || this.isOp('%')) {
      const op = this.next();
      const r = this.unary();
      l = { t: 'bin', id: fresh(), line: op.line, op: op.text, l, r };
    }
    return l;
  }
  private unary(): Expr {
    if (this.isOp('-') || this.isOp('+')) {
      const op = this.next();
      return { t: 'unary', id: fresh(), line: op.line, op: op.text as '-' | '+', e: this.unary() };
    }
    if (this.isKw('not')) {
      const op = this.next();
      return { t: 'unary', id: fresh(), line: op.line, op: 'not', e: this.unary() };
    }
    return this.postfix();
  }
  private postfix(): Expr {
    let e = this.primary();
    for (;;) {
      if (this.isOp('[')) {
        const line = this.next().line;
        const index = this.expr();
        this.expectOp(']');
        e = { t: 'index', id: fresh(), line, base: e, index };
        continue;
      }
      break;
    }
    return e;
  }
  private primary(): Expr {
    const t = this.peek();
    if (!t) throw new PineError('The line ends where a value was expected', this.line);
    if (t.kind === 'num') {
      this.next();
      return { t: 'num', id: fresh(), line: t.line, v: t.num!, isInt: !!t.isInt };
    }
    if (t.kind === 'str') {
      this.next();
      return { t: 'str', id: fresh(), line: t.line, v: t.text };
    }
    if (t.kind === 'color') {
      this.next();
      return { t: 'color', id: fresh(), line: t.line, v: t.text };
    }
    if (t.kind === 'kw' && (t.text === 'true' || t.text === 'false')) {
      this.next();
      return { t: 'bool', id: fresh(), line: t.line, v: t.text === 'true' };
    }
    if (t.kind === 'kw' && t.text === 'na') {
      this.next();
      if (this.isOp('(')) return this.callRest('na', t.line);
      return { t: 'na', id: fresh(), line: t.line };
    }
    if (t.kind === 'op' && t.text === '(') {
      this.next();
      const e = this.expr();
      this.expectOp(')');
      return e;
    }
    if (t.kind === 'op' && t.text === '[') {
      this.next();
      const items: Expr[] = [];
      if (!this.isOp(']')) {
        items.push(this.expr());
        while (this.isOp(',')) {
          this.next();
          items.push(this.expr());
        }
      }
      this.expectOp(']');
      return { t: 'tuple', id: fresh(), line: t.line, items };
    }
    /* a type word used as a namespace or a name — `color.new`, `math.pi`, `input.int`, `string(x)` casts */
    if (t.kind === 'id' || (t.kind === 'kw' && TYPE_WORDS.has(t.text))) {
      this.next();
      let path = t.text;
      while (this.isOp('.') && (this.is('id', undefined, 1) || this.is('kw', undefined, 1))) {
        this.next();
        path += '.' + this.next().text;
      }
      if (this.isOp('(')) return this.callRest(path, t.line);
      if (path.includes('.')) return { t: 'member', id: fresh(), line: t.line, path };
      return { t: 'id', id: fresh(), line: t.line, name: path };
    }
    throw new PineError(`Unexpected "${t.text}"`, this.line, t.col);
  }
  /** The `(args)` after a callee */
  private callRest(callee: string, line: number): Expr {
    this.expectOp('(');
    const args: Arg[] = [];
    if (!this.isOp(')')) {
      for (;;) {
        if (this.is('id') && this.isOp('=', 1)) {
          const name = this.next().text;
          this.next();
          args.push({ name, value: this.expr() });
        } else if (this.is('kw') && this.isOp('=', 1) && TYPE_WORDS.has(this.peek()!.text)) {
          /* `color = …`, `string = …` as argument names */
          const name = this.next().text;
          this.next();
          args.push({ name, value: this.expr() });
        } else {
          args.push({ value: this.expr() });
        }
        if (this.isOp(',')) {
          this.next();
          continue;
        }
        break;
      }
    }
    this.expectOp(')');
    return { t: 'call', id: fresh(), line, callee, args };
  }
}

/* ---- statements, by line and indent ------------------------------------------------ */

class Parser {
  private i = 0;
  constructor(private lines: LogicalLine[]) {}

  private peek(): LogicalLine | undefined {
    return this.lines[this.i];
  }

  /** The statements at exactly `indent`, until the indent falls below it */
  block(indent: number): Stmt[] {
    const out: Stmt[] = [];
    for (;;) {
      const l = this.peek();
      if (!l || l.indent < indent) break;
      if (l.indent > indent) throw new PineError('This line is indented under nothing', l.line);
      out.push(this.statement());
    }
    return out;
  }

  /** The block under a header line: the next line must sit deeper */
  private nested(headerIndent: number, what: string): Stmt[] {
    const l = this.peek();
    if (!l || l.indent <= headerIndent) throw new PineError(`${what} needs an indented line under it`, this.lines[this.i - 1]?.line ?? 1);
    return this.block(l.indent);
  }

  private statement(): Stmt {
    const l = this.lines[this.i++];
    const p = new LineParser(l.tokens, l.line);
    const first = l.tokens[0];
    const line = l.line;

    if (first.kind === 'kw') {
      switch (first.text) {
        case 'if':
          return this.ifStatement(p, l);
        case 'for':
          return this.forStatement(p, l);
        case 'while': {
          p.next();
          const cond = p.expr();
          p.end();
          return { t: 'while', id: fresh(), line, cond, body: this.nested(l.indent, 'while') };
        }
        case 'switch':
          return this.switchStatement(p, l);
        case 'break':
          p.next();
          p.end();
          return { t: 'break', id: fresh(), line };
        case 'continue':
          p.next();
          p.end();
          return { t: 'continue', id: fresh(), line };
        case 'else':
          throw new PineError('"else" without an "if" above it', line);
        case 'import':
        case 'export':
        case 'method':
        case 'type':
        case 'enum':
          throw new PineError(`"${first.text}" is not in this version yet — scripts stand alone here`, line);
        case 'var':
        case 'varip':
          return this.declaration(p, l);
        default:
          if (TYPE_WORDS.has(first.text) && l.tokens[1]?.kind === 'id') return this.declaration(p, l);
      }
    }

    /* a function: name(params) => … */
    if (first.kind === 'id' && l.tokens[1]?.kind === 'op' && l.tokens[1].text === '(' && this.isFunctionHeader(l.tokens)) {
      return this.functionDecl(p, l);
    }
    /* a tuple declaration: [a, b] = … */
    if (first.kind === 'op' && first.text === '[' && this.isTupleDecl(l.tokens)) return this.declaration(p, l);
    /* a declaration: name = … / typed: float name = … */
    if (first.kind === 'id' && l.tokens[1]?.kind === 'op' && l.tokens[1].text === '=') return this.declaration(p, l);
    /* a reassignment */
    if (first.kind === 'id' && l.tokens[1]?.kind === 'op' && [':=', '+=', '-=', '*=', '/=', '%='].includes(l.tokens[1].text)) {
      p.next();
      const op = p.next().text;
      const expr = this.rhs(p, l);
      return { t: 'assign', id: fresh(), line, name: first.text, op, expr };
    }
    const e = p.expr();
    p.end();
    return { t: 'expr', id: fresh(), line, e };
  }

  /** `name(a, b) =>` — the `=>` after the closing bracket says so */
  private isFunctionHeader(toks: Token[]): boolean {
    let depth = 0;
    for (let k = 1; k < toks.length; k++) {
      const t = toks[k];
      if (t.kind === 'op' && t.text === '(') depth++;
      else if (t.kind === 'op' && t.text === ')') {
        depth--;
        if (depth === 0) return toks[k + 1]?.kind === 'op' && toks[k + 1].text === '=>';
      }
    }
    return false;
  }
  private isTupleDecl(toks: Token[]): boolean {
    let k = 1;
    while (toks[k] && !(toks[k].kind === 'op' && toks[k].text === ']')) k++;
    return toks[k + 1]?.kind === 'op' && toks[k + 1].text === '=';
  }

  private functionDecl(p: LineParser, l: LogicalLine): Stmt {
    const name = p.expectId().text;
    p.expectOp('(');
    const params: string[] = [];
    if (!p.isOp(')')) {
      for (;;) {
        /* a typed parameter: `int len` / `simple int len` / `series float src` */
        while (p.is('kw') && TYPE_WORDS.has(p.peek()!.text) && (p.is('id', undefined, 1) || p.is('kw', undefined, 1))) p.next();
        params.push(p.expectId().text);
        if (p.isOp('=')) {
          /* a default — read and drop it; Pine defaults on user functions are rare, and the call must pass the value here */
          p.next();
          p.expr();
        }
        if (p.isOp(',')) {
          p.next();
          continue;
        }
        break;
      }
    }
    p.expectOp(')');
    p.expectOp('=>');
    if (p.done) return { t: 'fn', id: fresh(), line: l.line, name, params, body: this.nested(l.indent, 'A function') };
    const e = this.rhs(p, l);
    return { t: 'fn', id: fresh(), line: l.line, name, params, body: [{ t: 'expr', id: fresh(), line: l.line, e }] };
  }

  private declaration(p: LineParser, l: LogicalLine): Stmt {
    let kind: '' | 'var' | 'varip' = '';
    if (p.isKw('var') || p.isKw('varip')) kind = p.next().text as 'var' | 'varip';
    let declaredType: string | undefined;
    while (p.is('kw') && TYPE_WORDS.has(p.peek()!.text)) declaredType = p.next().text;
    const names: string[] = [];
    if (p.isOp('[')) {
      p.next();
      names.push(p.expectId().text);
      while (p.isOp(',')) {
        p.next();
        names.push(p.expectId().text);
      }
      p.expectOp(']');
    } else {
      names.push(p.expectId().text);
    }
    p.expectOp('=');
    const expr = this.rhs(p, l);
    return { t: 'decl', id: fresh(), line: l.line, kind, names, expr, declaredType };
  }

  /** The right-hand side of `=`: an expression, or an `if` / `switch` whose block gives the value */
  private rhs(p: LineParser, l: LogicalLine): Expr {
    if (p.isKw('if')) {
      const s = this.ifStatement(p, l);
      if (s.t !== 'if') throw new PineError('Expected an if', l.line);
      return { t: 'ifexpr', id: fresh(), line: l.line, branches: s.branches };
    }
    if (p.isKw('switch')) {
      const s = this.switchStatement(p, l);
      if (s.t !== 'switch') throw new PineError('Expected a switch', l.line);
      return { t: 'switchexpr', id: fresh(), line: l.line, subject: s.subject, cases: s.cases };
    }
    const e = p.expr();
    p.end();
    return e;
  }

  private ifStatement(p: LineParser, l: LogicalLine): Stmt {
    p.next(); // if
    const branches: { cond: Expr | null; body: Stmt[] }[] = [];
    const cond = p.expr();
    p.end();
    branches.push({ cond, body: this.nested(l.indent, 'if') });
    for (;;) {
      const nl = this.peek();
      if (!nl || nl.indent !== l.indent || nl.tokens[0].kind !== 'kw' || nl.tokens[0].text !== 'else') break;
      this.i++;
      const ep = new LineParser(nl.tokens, nl.line);
      ep.next(); // else
      if (ep.isKw('if')) {
        ep.next();
        const c = ep.expr();
        ep.end();
        branches.push({ cond: c, body: this.nested(nl.indent, 'else if') });
        continue;
      }
      ep.end();
      branches.push({ cond: null, body: this.nested(nl.indent, 'else') });
      break;
    }
    return { t: 'if', id: fresh(), line: l.line, branches };
  }

  private forStatement(p: LineParser, l: LogicalLine): Stmt {
    p.next(); // for
    if (p.isOp('[')) throw new PineError('"for … in" over arrays is not in this version yet', l.line);
    const name = p.expectId().text;
    if (p.isKw('in')) throw new PineError('"for … in" over arrays is not in this version yet', l.line);
    p.expectOp('=');
    const from = p.expr();
    if (!p.isKw('to')) throw new PineError('A for loop reads "for i = a to b"', l.line);
    p.next();
    const to = p.expr();
    let by: Expr | null = null;
    if (p.isKw('by')) {
      p.next();
      by = p.expr();
    }
    p.end();
    return { t: 'for', id: fresh(), line: l.line, name, from, to, by, body: this.nested(l.indent, 'for') };
  }

  private switchStatement(p: LineParser, l: LogicalLine): Stmt {
    p.next(); // switch
    const subject = p.done ? null : p.expr();
    p.end();
    const first = this.peek();
    if (!first || first.indent <= l.indent) throw new PineError('switch needs its cases indented under it', l.line);
    const caseIndent = first.indent;
    const cases: { match: Expr | null; body: Stmt[] }[] = [];
    for (;;) {
      const cl = this.peek();
      if (!cl || cl.indent !== caseIndent) break;
      this.i++;
      const cp = new LineParser(cl.tokens, cl.line);
      let match: Expr | null = null;
      if (!cp.isOp('=>')) match = cp.expr();
      cp.expectOp('=>');
      let body: Stmt[];
      if (cp.done) body = this.nested(cl.indent, 'A case');
      else {
        const e = this.rhs(cp, cl);
        body = [{ t: 'expr', id: fresh(), line: cl.line, e }];
      }
      cases.push({ match, body });
    }
    return { t: 'switch', id: fresh(), line: l.line, subject, cases };
  }
}

/** Source text into the tree; throws a PineError with the line */
export function parse(source: string): Program {
  nextId = 1;
  const { pragma, lines } = readLines(source);
  if (pragma.version === null) throw new PineError('The first line must be //@version=6', 1);
  if (pragma.version < 5) throw new PineError(`Pine v${pragma.version} scripts are not in this version — the runtime reads v5 and v6`, pragma.line);
  const parser = new Parser(lines);
  const body = parser.block(lines[0]?.indent ?? 0);
  return { version: pragma.version, body };
}
