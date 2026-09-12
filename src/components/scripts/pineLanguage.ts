/*
==================================================
  SLAYER TERMINAL - PINE IN THE EDITOR (components/scripts/pineLanguage.ts)

  CodeMirror's view of a Pine script: a small
  tokenizer for the highlighter, and the house's own
  theme — the panel's black, the mono face, silver
  for the keywords, the toolbar's line blue for the
  functions, the old gold for strings and colours,
  the muted ink for comments. No colour here means
  anything on the chart's colour law; this is text.
==================================================
*/

import { HighlightStyle, StreamLanguage, syntaxHighlighting, type StringStream } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';

const KEYWORDS = new Set(['if', 'else', 'for', 'to', 'by', 'in', 'while', 'switch', 'and', 'or', 'not', 'var', 'varip', 'true', 'false', 'na', 'break', 'continue', 'import', 'export', 'method', 'type', 'enum']);
const TYPES = new Set(['int', 'float', 'bool', 'string', 'color', 'series', 'simple', 'const', 'input', 'line', 'label', 'box', 'table']);
const NAMESPACES = new Set(['ta', 'math', 'str', 'color', 'input', 'plot', 'shape', 'location', 'size', 'hline', 'display', 'barstate', 'syminfo', 'timeframe', 'slayer', 'format', 'scale', 'alert', 'dayofweek', 'xloc', 'yloc', 'extend', 'barmerge', 'request', 'strategy', 'label', 'line', 'box', 'table', 'array', 'matrix', 'map']);
const SERIES = new Set(['open', 'high', 'low', 'close', 'volume', 'hl2', 'hlc3', 'ohlc4', 'hlcc4', 'time', 'time_close', 'bar_index', 'last_bar_index', 'year', 'month', 'dayofmonth', 'hour', 'minute', 'second', 'timenow']);
const TOP = new Set(['indicator', 'strategy', 'library', 'plot', 'plotshape', 'plotchar', 'plotarrow', 'plotcandle', 'plotbar', 'hline', 'fill', 'bgcolor', 'barcolor', 'alertcondition', 'alert', 'nz', 'fixnan']);

interface State {
  afterDot: boolean;
}

export const pineLanguage = StreamLanguage.define<State>({
  startState: () => ({ afterDot: false }),
  token(stream: StringStream, state: State): string | null {
    if (stream.eatSpace()) return null;
    if (stream.match('//')) {
      stream.skipToEnd();
      return 'comment';
    }
    if (stream.match(/^#[0-9a-fA-F]{6,8}\b/)) return 'color';
    if (stream.match(/^"(?:[^"\\]|\\.)*"?/) || stream.match(/^'(?:[^'\\]|\\.)*'?/)) return 'string';
    if (stream.match(/^(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?/)) return 'number';
    if (stream.match(/^(?:=>|:=|==|!=|<=|>=|[+\-*/%<>=?:,()[\]])/)) {
      state.afterDot = false;
      return 'operator';
    }
    if (stream.match('.')) {
      state.afterDot = true;
      return 'operator';
    }
    const m = stream.match(/^[A-Za-z_][A-Za-z0-9_]*/) as RegExpMatchArray | null;
    if (m) {
      const word = m[0];
      const wasAfterDot = state.afterDot;
      state.afterDot = false;
      if (wasAfterDot) return stream.peek() === '(' ? 'function' : 'property';
      if (KEYWORDS.has(word)) return 'keyword';
      if (TYPES.has(word) && stream.peek() !== '.') return 'typeName';
      if (NAMESPACES.has(word) && stream.peek() === '.') return 'namespace';
      if (SERIES.has(word)) return 'variableName';
      if (TOP.has(word)) return 'function';
      return null;
    }
    stream.next();
    return null;
  },
  tokenTable: {
    comment: t.lineComment,
    color: t.color,
    string: t.string,
    number: t.number,
    operator: t.operator,
    keyword: t.keyword,
    typeName: t.typeName,
    namespace: t.namespace,
    variableName: t.variableName,
    function: t.function(t.name),
    property: t.propertyName,
  },
  languageData: { commentTokens: { line: '//' } },
});

const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */
const BLUE = '#5B9CF6';
const GOLD = '#D9B76A';
const MUTED = '#7c8290';
const INK = 'rgb(var(--text-primary))';
const SECOND = 'rgb(var(--text-secondary))';

export const pineHighlight = syntaxHighlighting(
  HighlightStyle.define([
    { tag: t.lineComment, color: MUTED, fontStyle: 'italic' },
    { tag: t.keyword, color: SILVER },
    { tag: t.typeName, color: SECOND },
    { tag: t.namespace, color: '#8EA2F5' },
    { tag: t.function(t.name), color: BLUE },
    { tag: t.propertyName, color: '#9FB6E8' },
    { tag: t.variableName, color: INK, fontWeight: '600' },
    { tag: t.string, color: GOLD },
    { tag: t.color, color: GOLD },
    { tag: t.number, color: INK },
    { tag: t.operator, color: SECOND },
  ])
);

/** The house's editor chrome */
export const pineTheme = EditorView.theme(
  {
    '&': { backgroundColor: '#0b0b0c', color: INK, fontSize: '12px', height: '100%' },
    '.cm-scroller': { fontFamily: 'ui-monospace, Menlo, Consolas, monospace', lineHeight: '1.65', overflow: 'auto' },
    '.cm-content': { padding: '10px 0', caretColor: SILVER },
    '.cm-line': { padding: '0 12px' },
    '&.cm-focused': { outline: 'none' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: SILVER, borderLeftWidth: '2px' },
    '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: 'rgba(199, 211, 232, 0.16)' },
    '.cm-activeLine': { backgroundColor: 'rgba(199, 211, 232, 0.035)' },
    '.cm-gutters': { backgroundColor: '#0b0b0c', color: MUTED, border: 'none', borderRight: '1px solid rgba(255,255,255,0.06)', fontSize: '11px' },
    '.cm-gutter.cm-lineNumbers .cm-gutterElement': { padding: '0 10px 0 14px', minWidth: '40px' },
    '.cm-activeLineGutter': { backgroundColor: 'rgba(199, 211, 232, 0.05)', color: SECOND },
    '.cm-matchingBracket': { backgroundColor: 'rgba(199, 211, 232, 0.14)', outline: 'none' },
    '.cm-tooltip': { backgroundColor: '#121212', border: '1px solid rgba(255,255,255,0.08)', color: INK },
    '.cm-pine-error': { backgroundColor: 'rgba(255, 59, 48, 0.12)' },
    '.cm-pine-error-gutter': { color: '#FF3B30' },
  },
  { dark: true }
);
