/*
==================================================
  SLAYER TERMINAL - THE PINE READER (core/pine/lexer.ts)

  Text into tokens, one logical line at a time. Pine
  is laid out by indentation (a block is the lines
  indented under `if`, `for`, `while`, `switch` and a
  function's `=>`), and a long statement may wrap
  onto the next line inside open brackets or with an
  indent that is not a multiple of four. The reader
  settles both before the parser sees anything: it
  hands over lines, each with its indent and its
  tokens, and the physical line every token came
  from, so an error can name it.
==================================================
*/

import { PineError } from './types';

export type TokenKind = 'num' | 'str' | 'id' | 'kw' | 'op' | 'color' | 'eol';

export interface Token {
  kind: TokenKind;
  /** The text: an operator, a keyword, a name, a string's contents, a number's text, a colour's hex */
  text: string;
  /** A number's value; an int when the text carried no point or exponent */
  num?: number;
  isInt?: boolean;
  line: number;
  col: number;
}

/** One statement's worth of tokens, with the indent it sits at */
export interface LogicalLine {
  indent: number;
  line: number;
  tokens: Token[];
}

export interface Pragma {
  version: number | null;
  line: number;
}

export const KEYWORDS = new Set([
  'if', 'else', 'for', 'to', 'by', 'in', 'while', 'switch', 'and', 'or', 'not', 'var', 'varip', 'true', 'false', 'na',
  'break', 'continue', 'import', 'export', 'method', 'type', 'enum',
  /* type words, allowed before a name and otherwise ignored */
  'int', 'float', 'bool', 'string', 'color', 'series', 'simple', 'const', 'input', 'line', 'label', 'box', 'table', 'linefill', 'array', 'matrix', 'map',
]);
/** The type words a declaration may open with (`float x = …`) — ignored by the runtime, allowed for the reader */
export const TYPE_WORDS = new Set(['int', 'float', 'bool', 'string', 'color', 'series', 'simple', 'const', 'input', 'line', 'label', 'box', 'table', 'linefill']);

const OPS3 = ['...'];
const OPS2 = ['==', '!=', '<=', '>=', ':=', '=>', '+=', '-=', '*=', '/=', '%='];
const OPS1 = ['+', '-', '*', '/', '%', '<', '>', '=', '?', ':', ',', '(', ')', '[', ']', '.'];

/** The indent of a physical line, a tab counting four */
const indentOf = (s: string): number => {
  let n = 0;
  for (const ch of s) {
    if (ch === ' ') n += 1;
    else if (ch === '\t') n += 4;
    else break;
  }
  return n;
};

/** Strip a `//` comment, leaving one inside a string alone */
const stripComment = (s: string): string => {
  let inStr: string | null = null;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (ch === '\\') i++;
      else if (ch === inStr) inStr = null;
    } else if (ch === '"' || ch === "'") inStr = ch;
    else if (ch === '/' && s[i + 1] === '/') return s.slice(0, i);
  }
  return s;
};

/** Open brackets minus closed, outside strings — a positive count means the statement continues on the next line */
const bracketDepth = (s: string): number => {
  let d = 0;
  let inStr: string | null = null;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (ch === '\\') i++;
      else if (ch === inStr) inStr = null;
    } else if (ch === '"' || ch === "'") inStr = ch;
    else if (ch === '(' || ch === '[') d++;
    else if (ch === ')' || ch === ']') d--;
  }
  return d;
};

/** Tokenise one logical line's text; `line` is the physical line it began on */
export function tokenize(text: string, line: number): Token[] {
  const out: Token[] = [];
  let i = 0;
  const n = text.length;
  while (i < n) {
    const ch = text[i];
    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
      i++;
      continue;
    }
    const col = i + 1;
    /* a colour literal: #RRGGBB or #RRGGBBAA */
    if (ch === '#') {
      const m = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/.exec(text.slice(i));
      if (!m) throw new PineError('A colour is written #RRGGBB or #RRGGBBAA', line, col);
      out.push({ kind: 'color', text: m[0], line, col });
      i += m[0].length;
      continue;
    }
    /* a string */
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      let s = '';
      while (j < n && text[j] !== ch) {
        if (text[j] === '\\' && j + 1 < n) {
          const e = text[j + 1];
          s += e === 'n' ? '\n' : e === 't' ? '\t' : e;
          j += 2;
        } else {
          s += text[j];
          j++;
        }
      }
      if (j >= n) throw new PineError('A string was opened and never closed', line, col);
      out.push({ kind: 'str', text: s, line, col });
      i = j + 1;
      continue;
    }
    /* a number */
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(text[i + 1] ?? ''))) {
      const m = /^(\d+\.\d*|\.\d+|\d+)([eE][+-]?\d+)?/.exec(text.slice(i))!;
      const isInt = !m[0].includes('.') && !m[2];
      out.push({ kind: 'num', text: m[0], num: Number(m[0]), isInt, line, col });
      i += m[0].length;
      continue;
    }
    /* a name or a keyword */
    if (/[A-Za-z_]/.test(ch)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(text.slice(i))!;
      out.push({ kind: KEYWORDS.has(m[0]) ? 'kw' : 'id', text: m[0], line, col });
      i += m[0].length;
      continue;
    }
    /* an operator */
    const three = text.slice(i, i + 3);
    const two = text.slice(i, i + 2);
    if (OPS3.includes(three)) {
      out.push({ kind: 'op', text: three, line, col });
      i += 3;
      continue;
    }
    if (OPS2.includes(two)) {
      out.push({ kind: 'op', text: two, line, col });
      i += 2;
      continue;
    }
    if (OPS1.includes(ch)) {
      out.push({ kind: 'op', text: ch, line, col });
      i += 1;
      continue;
    }
    throw new PineError(`The character "${ch}" is not part of Pine`, line, col);
  }
  return out;
}

/** The whole source as logical lines, plus the `//@version=` pragma */
export function readLines(source: string): { pragma: Pragma; lines: LogicalLine[] } {
  const physical = source.replace(/\r\n?/g, '\n').split('\n');
  const pragma: Pragma = { version: null, line: 0 };
  const lines: LogicalLine[] = [];
  let current: { indent: number; line: number; text: string; depth: number } | null = null;

  const close = () => {
    if (!current) return;
    if (current.depth > 0) throw new PineError('A bracket was opened and never closed', current.line);
    const tokens = tokenize(current.text, current.line);
    if (tokens.length) lines.push({ indent: current.indent, line: current.line, tokens });
    current = null;
  };

  for (let idx = 0; idx < physical.length; idx++) {
    const raw = physical[idx];
    const lineNo = idx + 1;
    const pm = /^\s*\/\/\s*@version\s*=\s*(\d+)/.exec(raw);
    if (pm) {
      pragma.version = Number(pm[1]);
      pragma.line = lineNo;
      continue;
    }
    const text = stripComment(raw);
    if (text.trim() === '') continue;
    const indent = indentOf(text);
    /* Continuation: inside open brackets, or a wrap indented off the four-space grid */
    if (current && (current.depth > 0 || (indent % 4 !== 0 && indent > current.indent))) {
      current.text += ' ' + text.trim();
      current.depth += bracketDepth(text);
      continue;
    }
    close();
    current = { indent, line: lineNo, text: text.trim(), depth: bracketDepth(text) };
  }
  close();
  return { pragma, lines };
}
