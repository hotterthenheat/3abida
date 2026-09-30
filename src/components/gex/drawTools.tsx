/*
==================================================
  SLAYER TERMINAL - THE DRAWING TOOLS, AS A LIST
  (components/gex/drawTools.tsx)

  Every drawing tool the chart has, in the FAMILIES a
  trader looks for them under (TradingView's own, from
  the panels Noah sent on 2026-09-19). One list, read
  by everything that offers a tool — the rail's family
  buttons, a family's fly-out, the all-tools sheet and
  the command palette — so a tool added here appears
  in all four and cannot be in one and not another.

  The rail shows ONE BUTTON A FAMILY, never one a tool
  ("how can we add all of these into the toolbar
  without extending the toolbar super long"): the rail
  is as long as the families are many, and only the
  lists grow. A family's button wears the LAST tool
  used from it, so the tool a reader lives in is one
  click and the list is for the rest.

  NAMES are the ones traders already know — a reader
  searching "horizontal line" must find it — and the
  house's older words (Level, Moment, Box, Measure)
  are kept as search words.

  WHAT THE READER KEEPS (one store, every chart):
    last   the tool each family's button wears
    favs   the starred tools — the rail's last button
==================================================
*/

import { useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import type { DrawingKind } from './drawingsPrimitive';

export type DrawFamilyId = 'trend' | 'fib' | 'measure' | 'shapes' | 'words';

export interface DrawToolDef {
  tool: DrawingKind;
  label: string;
  icon: JSX.Element;
  /** The small head it sits under in its family's list */
  sub: string;
  /** More words the search answers to */
  keys?: string;
}

export interface DrawFamily {
  id: DrawFamilyId;
  name: string;
  /** The sheet's tab — six of them share one row, so each is a word */
  short: string;
  tools: DrawToolDef[];
}

/** Every glyph is drawn at 1em — the rail, the list and the sheet's tile each set their own size */
const G = ({ children, fill }: { children: ReactNode; fill?: boolean }) => (
  <svg viewBox="0 0 16 16" className="w-[1em] h-[1em] shrink-0" fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
);
const END = (cx: number, cy: number) => <circle cx={cx} cy={cy} r="1.6" fill="none" />;

const ICON = {
  trend: (
    <G>
      {END(3.4, 12.6)}
      {END(12.6, 3.4)}
      <path d="M4.6 11.4 11.4 4.6" />
    </G>
  ),
  ray: (
    <G>
      {END(3.2, 12.8)}
      {END(8, 8)}
      <path d="M4.4 11.6 6.8 9.2M9.2 6.8 14 2" />
    </G>
  ),
  extend: (
    <G>
      {END(5.4, 10.6)}
      {END(10.6, 5.4)}
      <path d="M1.5 14.5 4.2 11.8M6.6 9.4 9.4 6.6M11.8 4.2 14.5 1.5" />
    </G>
  ),
  hline: (
    <G>
      {END(8, 8)}
      <path d="M1.5 8h4.9M9.6 8h4.9" />
    </G>
  ),
  hray: (
    <G>
      {END(3.4, 8)}
      <path d="M5 8h9.5" />
    </G>
  ),
  vline: (
    <G>
      {END(8, 8)}
      <path d="M8 1.5v4.9M8 9.6v4.9" />
    </G>
  ),
  cross: (
    <G>
      {END(8, 8)}
      <path d="M1.5 8h4.9M9.6 8h4.9M8 1.5v4.9M8 9.6v4.9" />
    </G>
  ),
  channel: (
    <G>
      {END(3, 10)}
      {END(11, 3.5)}
      <path d="M4.3 9 9.7 4.5M5 14.5 14.5 6.8" />
    </G>
  ),
  fib: (
    <G>
      <path d="M2 3h12M2 6.4h12M2 9.6h9M2 13h12" />
      {END(12.6, 9.6)}
    </G>
  ),
  fibext: (
    <G>
      <path d="M6 3h8.5M6 6h8.5M6 9h8.5" />
      <path d="M2 14 5 9.5 8 12.5" />
      {END(2, 14)}
    </G>
  ),
  fibchannel: (
    <G>
      <path d="M1.5 10.5 12 2M2.8 13 13.3 4.5M4 15.5 14.5 7" />
      {END(12.2, 2)}
    </G>
  ),
  long: (
    <G>
      <path d="M2 8h12M2 3h9M2 13h9" />
      <path d="M12.5 6V2.5M11 4l1.5-1.5L14 4" />
    </G>
  ),
  short: (
    <G>
      <path d="M2 8h12M2 3h9M2 13h9" />
      <path d="M12.5 10v3.5M11 12l1.5 1.5L14 12" />
    </G>
  ),
  prange: (
    <G>
      <path d="M3 2.5h10M3 13.5h10M8 4.5v7M6.3 6 8 4.3 9.7 6M6.3 10 8 11.7 9.7 10" />
    </G>
  ),
  drange: (
    <G>
      <path d="M2.5 3v10M13.5 3v10M4.5 8h7M6 6.3 4.3 8 6 9.7M10 6.3 11.7 8 10 9.7" />
    </G>
  ),
  measure: (
    <G>
      <rect x="2.5" y="2.5" width="11" height="11" rx="1" />
      <path d="M8 5v6M5 8h6" />
    </G>
  ),
  avwap: (
    <G>
      {END(2.8, 11.5)}
      <path d="M4.3 11c2-.4 3.2-3.6 5.2-4.6s3.4-.2 4.5-1.4" />
      <path d="M6.5 13.5v-2M9.5 12.5v-3M12.5 11V8" />
    </G>
  ),
  brush: (
    <G>
      <path d="M13.5 2.5c-3 1.6-5.6 4.3-7.2 7l1.7 1.7c2.7-1.6 5.4-4.2 7-7.2z" />
      <path d="M6.3 9.5c-1.8 0-2.8 1-3 2.6-.1.8-.5 1.3-1.3 1.6 2.6.6 5.4-.3 6-2.5" />
    </G>
  ),
  highlighter: (
    <G>
      <path d="M9.5 2.5 13.5 6.5 7.8 12.2H3.8v-4z" />
      <path d="M2 14.5h12" />
    </G>
  ),
  arrow: (
    <G>
      {END(3.2, 12.8)}
      <path d="M4.4 11.6 13 3M13 3H8.6M13 3v4.4" />
    </G>
  ),
  arrowup: (
    <G>
      <path d="M8 2 13 7.5H10V14H6V7.5H3z" />
    </G>
  ),
  arrowdown: (
    <G>
      <path d="M8 14 3 8.5H6V2h4v6.5h3z" />
    </G>
  ),
  rect: (
    <G>
      <rect x="2.5" y="3.5" width="11" height="9" rx="0.5" />
    </G>
  ),
  rotrect: (
    <G>
      <path d="M6.5 1.8 14.2 6.5 9.5 14.2 1.8 9.5z" />
    </G>
  ),
  circle: (
    <G>
      <circle cx="8" cy="8" r="5.6" />
      <circle cx="8" cy="8" r="0.9" fill="currentColor" stroke="none" />
    </G>
  ),
  ellipse: (
    <G>
      <ellipse cx="8" cy="8" rx="6.3" ry="3.9" />
    </G>
  ),
  triangle: (
    <G>
      <path d="M3 13 5.5 3 13.5 10.5z" />
    </G>
  ),
  polyline: (
    <G>
      <path d="M3 5.5 8.5 2.5 13.5 6 11.5 12.5 4.5 13.5z" />
    </G>
  ),
  path: (
    <G>
      {END(2.6, 12.6)}
      {END(6.8, 6.2)}
      <path d="M7.6 7.4 10 10 13.4 3.4M13.6 2.6l.3 2.8M13.6 2.6l-2.7.5" />
    </G>
  ),
  curve: (
    <G>
      {END(2.8, 12.8)}
      {END(13.2, 5)}
      <path d="M3.4 11.3C4 5 8 3 11.7 4.6" />
    </G>
  ),
  text: (
    <G>
      <path d="M3.5 4V3h9v1M8 3v10M6.3 13h3.4" />
    </G>
  ),
  note: (
    <G>
      <path d="M3 2.5h10v7.5l-3.5 3.5H3z" />
      <path d="M13 10H9.5v3.5" />
    </G>
  ),
  callout: (
    <G>
      <path d="M2.5 2.5h11v8H8L4.5 13.8V10.5h-2z" />
    </G>
  ),
  pricelabel: (
    <G>
      <path d="M5 2.5h8.5v6.5H8.5L2.5 13.5 5 9z" />
      <path d="M7.4 5.8h3.7" />
    </G>
  ),
} satisfies Partial<Record<DrawingKind, JSX.Element>>;

export const DRAW_FAMILIES: DrawFamily[] = [
  {
    id: 'trend',
    name: 'Trend tools',
    short: 'Trend',
    tools: [
      { tool: 'trend', label: 'Trendline', icon: ICON.trend, sub: 'Lines', keys: 'trend line' },
      { tool: 'ray', label: 'Ray', icon: ICON.ray, sub: 'Lines' },
      { tool: 'extend', label: 'Extended line', icon: ICON.extend, sub: 'Lines', keys: 'extended' },
      { tool: 'hline', label: 'Horizontal line', icon: ICON.hline, sub: 'Lines', keys: 'level support resistance' },
      { tool: 'hray', label: 'Horizontal ray', icon: ICON.hray, sub: 'Lines' },
      { tool: 'vline', label: 'Vertical line', icon: ICON.vline, sub: 'Lines', keys: 'moment time' },
      { tool: 'cross', label: 'Crossline', icon: ICON.cross, sub: 'Lines', keys: 'cross line' },
      { tool: 'channel', label: 'Parallel channel', icon: ICON.channel, sub: 'Channels' },
    ],
  },
  {
    id: 'fib',
    name: 'Fibonacci',
    short: 'Fib',
    tools: [
      { tool: 'fib', label: 'Fib retracement', icon: ICON.fib, sub: 'Fibonacci', keys: 'fibonacci' },
      { tool: 'fibext', label: 'Trend-based fib extension', icon: ICON.fibext, sub: 'Fibonacci', keys: 'fibonacci projection' },
      { tool: 'fibchannel', label: 'Fib channel', icon: ICON.fibchannel, sub: 'Fibonacci', keys: 'fibonacci' },
    ],
  },
  {
    id: 'measure',
    name: 'Forecasting and measurement',
    short: 'Measure',
    tools: [
      { tool: 'long', label: 'Long position', icon: ICON.long, sub: 'Positions', keys: 'risk reward target stop' },
      { tool: 'short', label: 'Short position', icon: ICON.short, sub: 'Positions', keys: 'risk reward target stop' },
      { tool: 'avwap', label: 'Anchored VWAP', icon: ICON.avwap, sub: 'Volume', keys: 'volume weighted average price' },
      { tool: 'prange', label: 'Price range', icon: ICON.prange, sub: 'Measure' },
      { tool: 'drange', label: 'Date range', icon: ICON.drange, sub: 'Measure', keys: 'time bars' },
      { tool: 'measure', label: 'Date and price range', icon: ICON.measure, sub: 'Measure', keys: 'measure ruler' },
    ],
  },
  {
    id: 'shapes',
    name: 'Geometric shapes',
    short: 'Shapes',
    tools: [
      { tool: 'brush', label: 'Brush', icon: ICON.brush, sub: 'Freehand', keys: 'pen draw' },
      { tool: 'highlighter', label: 'Highlighter', icon: ICON.highlighter, sub: 'Freehand', keys: 'marker' },
      { tool: 'arrow', label: 'Arrow', icon: ICON.arrow, sub: 'Arrows' },
      { tool: 'arrowup', label: 'Arrow mark up', icon: ICON.arrowup, sub: 'Arrows', keys: 'buy' },
      { tool: 'arrowdown', label: 'Arrow mark down', icon: ICON.arrowdown, sub: 'Arrows', keys: 'sell' },
      { tool: 'rect', label: 'Rectangle', icon: ICON.rect, sub: 'Shapes', keys: 'box zone' },
      { tool: 'rotrect', label: 'Rotated rectangle', icon: ICON.rotrect, sub: 'Shapes' },
      { tool: 'circle', label: 'Circle', icon: ICON.circle, sub: 'Shapes' },
      { tool: 'ellipse', label: 'Ellipse', icon: ICON.ellipse, sub: 'Shapes', keys: 'oval' },
      { tool: 'triangle', label: 'Triangle', icon: ICON.triangle, sub: 'Shapes' },
      { tool: 'polyline', label: 'Polyline', icon: ICON.polyline, sub: 'Shapes', keys: 'polygon' },
      { tool: 'path', label: 'Path', icon: ICON.path, sub: 'Shapes' },
      { tool: 'curve', label: 'Curve', icon: ICON.curve, sub: 'Shapes' },
    ],
  },
  {
    id: 'words',
    name: 'Annotation',
    short: 'Words',
    tools: [
      { tool: 'text', label: 'Text', icon: ICON.text, sub: 'Words' },
      { tool: 'note', label: 'Note', icon: ICON.note, sub: 'Words' },
      { tool: 'callout', label: 'Callout', icon: ICON.callout, sub: 'Words' },
      { tool: 'pricelabel', label: 'Price label', icon: ICON.pricelabel, sub: 'Words', keys: 'tag' },
    ],
  },
];

export const ALL_DRAW_TOOLS: DrawToolDef[] = DRAW_FAMILIES.flatMap(f => f.tools);
const BY_KIND = new Map<DrawingKind, DrawToolDef>(ALL_DRAW_TOOLS.map(t => [t.tool, t]));
const FAMILY_OF = new Map<DrawingKind, DrawFamilyId>(DRAW_FAMILIES.flatMap(f => f.tools.map(t => [t.tool, f.id] as const)));

export const drawToolDef = (kind: DrawingKind): DrawToolDef | undefined => BY_KIND.get(kind);
export const drawToolLabel = (kind: DrawingKind): string => BY_KIND.get(kind)?.label ?? kind;

/** What the search box answers to: the name, the family, and the older and looser words */
export function searchDrawTools(query: string): DrawToolDef[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return ALL_DRAW_TOOLS;
  return ALL_DRAW_TOOLS.filter(t => {
    const hay = `${t.label} ${t.keys ?? ''} ${t.sub} ${DRAW_FAMILIES.find(f => f.id === FAMILY_OF.get(t.tool))?.name ?? ''}`.toLowerCase();
    return words.every(w => hay.includes(w));
  });
}

// ---- what the reader keeps ----------------------------------------------------------

interface DrawToolPrefs {
  last: Partial<Record<DrawFamilyId, DrawingKind>>;
  favs: DrawingKind[];
}

const KEY = 'slayer_draw_tools_v1';
const read = (): DrawToolPrefs => {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || '{}') as Partial<DrawToolPrefs>;
    const last: DrawToolPrefs['last'] = {};
    if (c.last && typeof c.last === 'object')
      for (const f of DRAW_FAMILIES) {
        const k = (c.last as Record<string, unknown>)[f.id];
        /* a stored tool must still exist, and still be in that family */
        if (typeof k === 'string' && FAMILY_OF.get(k as DrawingKind) === f.id) last[f.id] = k as DrawingKind;
      }
    const favs = Array.isArray(c.favs) ? c.favs.filter((k): k is DrawingKind => typeof k === 'string' && BY_KIND.has(k as DrawingKind)) : [];
    return { last, favs: [...new Set(favs)] };
  } catch {
    return { last: {}, favs: [] };
  }
};

let prefs: DrawToolPrefs = read();
const listeners = new Set<() => void>();
const write = (next: DrawToolPrefs) => {
  prefs = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* storage off — the choice lives for the session */
  }
  listeners.forEach(fn => fn());
};
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
const snapshot = () => prefs;

export const useDrawToolPrefs = (): DrawToolPrefs => useSyncExternalStore(subscribe, snapshot, snapshot);

/** A tool was taken in hand: its family's button wears it from now on */
export function rememberDrawTool(kind: DrawingKind): void {
  const fam = FAMILY_OF.get(kind);
  if (!fam || prefs.last[fam] === kind) return;
  write({ ...prefs, last: { ...prefs.last, [fam]: kind } });
}

export function toggleDrawFavourite(kind: DrawingKind): void {
  write({ ...prefs, favs: prefs.favs.includes(kind) ? prefs.favs.filter(k => k !== kind) : [...prefs.favs, kind] });
}

/** The tool a family's button wears: the last one used from it, else its first */
export const familyFace = (f: DrawFamily, p: DrawToolPrefs): DrawToolDef => f.tools.find(t => t.tool === p.last[f.id]) ?? f.tools[0];

// ---- arming a tool from outside a chart (the command palette) -------------------------

/* A chart that can draw registers itself; the one the pointer was last over answers. With one chart on the page it is that one. */
type Arm = (kind: DrawingKind) => void;
const charts = new Map<symbol, Arm>();
let lastTouched: symbol | null = null;
export function registerDrawChart(id: symbol, arm: Arm): () => void {
  charts.set(id, arm);
  return () => {
    charts.delete(id);
    if (lastTouched === id) lastTouched = null;
  };
}
export const touchDrawChart = (id: symbol): void => {
  lastTouched = id;
};
export const canArmDrawTool = (): boolean => charts.size > 0;
export function armDrawTool(kind: DrawingKind): boolean {
  const arm = (lastTouched && charts.get(lastTouched)) || [...charts.values()][0];
  if (!arm) return false;
  arm(kind);
  return true;
}
