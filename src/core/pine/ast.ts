/*
==================================================
  SLAYER TERMINAL - THE PINE TREE (core/pine/ast.ts)

  What the parser builds and the interpreter walks.
  Every node carries the line it came from and an id
  of its own: a call's id is the key its `ta.*` state
  lives under, and a subscripted expression's id is
  the key its history is kept under.
==================================================
*/

export interface Arg {
  name?: string;
  value: Expr;
}

export type Expr =
  | { t: 'num'; id: number; line: number; v: number; isInt: boolean }
  | { t: 'str'; id: number; line: number; v: string }
  | { t: 'bool'; id: number; line: number; v: boolean }
  | { t: 'na'; id: number; line: number }
  | { t: 'color'; id: number; line: number; v: string }
  | { t: 'id'; id: number; line: number; name: string }
  /** A dotted name — `ta.sma`, `color.red`, `barstate.islast`, `plot.style_line` */
  | { t: 'member'; id: number; line: number; path: string }
  | { t: 'call'; id: number; line: number; callee: string; args: Arg[] }
  | { t: 'index'; id: number; line: number; base: Expr; index: Expr }
  | { t: 'unary'; id: number; line: number; op: '-' | '+' | 'not'; e: Expr }
  | { t: 'bin'; id: number; line: number; op: string; l: Expr; r: Expr; intDiv?: boolean }
  | { t: 'tern'; id: number; line: number; c: Expr; a: Expr; b: Expr }
  | { t: 'tuple'; id: number; line: number; items: Expr[] }
  | { t: 'ifexpr'; id: number; line: number; branches: { cond: Expr | null; body: Stmt[] }[] }
  | { t: 'switchexpr'; id: number; line: number; subject: Expr | null; cases: { match: Expr | null; body: Stmt[] }[] };

export type Stmt =
  | { t: 'decl'; id: number; line: number; kind: '' | 'var' | 'varip'; names: string[]; expr: Expr; declaredType?: string }
  | { t: 'assign'; id: number; line: number; name: string; op: string; expr: Expr }
  | { t: 'expr'; id: number; line: number; e: Expr }
  | { t: 'if'; id: number; line: number; branches: { cond: Expr | null; body: Stmt[] }[] }
  | { t: 'for'; id: number; line: number; name: string; from: Expr; to: Expr; by: Expr | null; body: Stmt[] }
  | { t: 'while'; id: number; line: number; cond: Expr; body: Stmt[] }
  | { t: 'switch'; id: number; line: number; subject: Expr | null; cases: { match: Expr | null; body: Stmt[] }[] }
  | { t: 'fn'; id: number; line: number; name: string; params: string[]; body: Stmt[] }
  | { t: 'break'; id: number; line: number }
  | { t: 'continue'; id: number; line: number };

export interface Program {
  version: number | null;
  body: Stmt[];
}
