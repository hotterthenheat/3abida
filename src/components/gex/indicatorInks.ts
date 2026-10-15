/*
==================================================
  SLAYER TERMINAL - THE INDICATORS' INKS (components/gex/indicatorInks.ts)

  One categorical family for every line the chart
  draws from its own maths (the Indicators menu) and
  for every line the shipped scripts draw (data/
  builtinScripts.ts) — hues that carry no house
  meaning, each with its pair for a light tape.

  OFF THE FIELD'S HUES (2026-10-15 — the owner,
  approval 4: "Indicator colours off gold/violet:
  approved"; the audit's §6d, area D): thirteen
  lines stood within OKLab 0.15 of the field's gold
  or violet, and several shared an ink with each
  other and with the compare lines. Now each ink
  stands 0.15 or more from the field's gold and
  violet on its ground (and 0.08 from the pair the
  field wears under blue-orange colour vision), 0.08
  or more from every other ink here, from the
  compare lines, the direction pair, the supreme,
  the flip, the rails' silver and the MACD's steel
  wash; its paper pair reads 3:1 or better on the
  darkest light tape (Stone on a dark page, #BEBDB8)
  and stands off Stone's own candles. The lines that
  sit on the price pane together (the averages, the
  VWAP and the bands) took the inks furthest from
  the field's and the direction pair's.

  OFF THE DIRECTION PAIR'S HUES TOO (the review of
  those approvals, the same day — the owner: "Red
  carries no meaning on Terrain"): Donchian's sage
  and Keltner's rose made green and red washes, and
  MFI, OBV, Williams %R and the stochastic's %K on
  paper sat at the up or down hue. Every ink with a
  hue (OKLCh chroma 0.04 or more) now stands 30° or
  more of hue from the direction pair on its ground
  — the channels' washes with it — and an ink inside
  those arcs is a true grey (Keltner's). A line drawn
  faint keeps a third of its faintness on paper
  (paperLineAlpha), so it reads 3:1 as drawn.
  scripts/indicator-inks-proof.ts measures all of it.

  THE HOUSE'S OWN INKS IN A SCRIPT (a wall, the flip,
  the supreme, the direction pair, the silver) are
  not this family's: on a light tape they take the
  paper's (paperInksWith — the walls the light
  ground's gold and violet, as the field's ovals do;
  the rest off the tape's own box), so a shipped wall
  stays the field's wall.
==================================================
*/

import { ACCENT, BEAR, BULL, CALL_WALL, FLIP, PUT_WALL, SUPREME } from './palette';

/** [the ink on a dark tape, its pair on a light one] */
type Pair = readonly [string, string];

/** StrikeChart's ChartIndicators keys — named here so this module reads without the chart (the proofs run in Node); a key
    the chart adds and this list lacks fails the chart's typecheck where it reads INDICATOR_INKS */
export type IndicatorKey = 'ema9' | 'ema21' | 'ema50' | 'vwap' | 'bb' | 'vwapBands' | 'sma' | 'rsi' | 'macd' | 'atrPane';

/* The Indicators menu's lines (StrikeChart INDICATOR_PARTS) — a lead ink a key; the MACD's signal and its steel wash
   beside them */
const INDICATOR_PAIRS: Record<IndicatorKey, Pair> = {
  ema9: ['#0099CC', '#0E6B9E'],
  ema21: ['#77C4FE', '#002A57'],
  ema50: ['#ABF8F3', '#0B726E'],
  sma: ['#768EAE', '#04077E'],
  vwap: ['#06BFB0', '#003F38'],
  vwapBands: ['#42F6D9', '#005856'],
  bb: ['#D498FC', '#703E81'],
  rsi: ['#FBACFE', '#3A2244'],
  macd: ['#B692CE', '#410569'],
  atrPane: ['#A77E91', '#5A0040'],
};
const MACD_SIGNAL_PAIR: Pair = ['#D37C18', '#774202'];
/** One steel wash for the MACD's bars, not red and green — the sign of momentum is not the price direction */
const MACD_HIST_PAIR: Pair = ['rgba(226,234,244,0.30)', 'rgba(60,64,72,0.30)'];

/* The shipped scripts' own lines (the walls, the flip and the supreme keep the house's inks; the direction lines of
   Supertrend, Parabolic SAR, ADX's ±DI and Ichimoku's leading spans keep the direction pair) */
export type ScriptInkKey =
  | 'movingAverage'
  | 'ichimokuConversion'
  | 'ichimokuBase'
  | 'ichimokuLagging'
  | 'keltner'
  | 'donchian'
  | 'stochasticK'
  | 'stochasticD'
  | 'adx'
  | 'cci'
  | 'williamsR'
  | 'mfi'
  | 'obv';
const SCRIPT_PAIRS: Record<ScriptInkKey, Pair> = {
  movingAverage: ['#18A19C', '#002823'],
  ichimokuConversion: ['#E37DC1', '#791853'],
  ichimokuBase: ['#9F9170', '#4D4834'],
  ichimokuLagging: ['#FCDCFF', '#700982'],
  keltner: ['#7D7D74', '#5C5663'],
  donchian: ['#58B0D1', '#005282'],
  stochasticK: ['#FD98BE', '#BD1D73'],
  stochasticD: ['#A78A00', '#433009'],
  adx: ['#FFBCD3', '#5B3244'],
  cci: ['#C267A9', '#9A0179'],
  williamsR: ['#C73996', '#974477'],
  mfi: ['#447CAE', '#013583'],
  obv: ['#AB713C', '#321901'],
};

const dark = <K extends string>(r: Record<K, Pair>): Record<K, string> => Object.fromEntries(Object.entries<Pair>(r).map(([k, v]) => [k, v[0]])) as Record<K, string>;

/** Each Indicators-menu key's lead ink on a dark tape */
export const INDICATOR_INKS: Record<IndicatorKey, string> = dark(INDICATOR_PAIRS);
export const MACD_SIGNAL_INK = MACD_SIGNAL_PAIR[0];
export const MACD_HIST_INK = MACD_HIST_PAIR[0];
/** Each shipped script's own line inks on a dark tape — the Pine sources write them (data/builtinScripts.ts) */
export const SCRIPT_INKS: Record<ScriptInkKey, string> = dark(SCRIPT_PAIRS);

/** Every pair of the family, for the proof and for the light tape's lookup */
export const INK_PAIRS: { name: string; dark: string; paper: string; wash?: true }[] = [
  ...Object.entries<Pair>(INDICATOR_PAIRS).map(([k, [d, p]]) => ({ name: `indicator:${k}`, dark: d, paper: p })),
  { name: 'indicator:macdSignal', dark: MACD_SIGNAL_PAIR[0], paper: MACD_SIGNAL_PAIR[1] },
  { name: 'indicator:macdHist', dark: MACD_HIST_PAIR[0], paper: MACD_HIST_PAIR[1], wash: true },
  ...Object.entries<Pair>(SCRIPT_PAIRS).map(([k, [d, p]]) => ({ name: `script:${k}`, dark: d, paper: p })),
];

/* ---- reading an ink, and its paper pair ---------------------------------------------- */

/** The channels and alpha of '#rrggbb', '#rrggbbaa', 'rgb(r g b)', 'rgb(r g b / a)' or 'rgba(r, g, b, a)' — null for
    anything else (a named colour, a gradient) */
export function parseInk(css: string): { rgb: [number, number, number]; a: number } | null {
  const s = css.trim();
  let m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(s);
  if (m) {
    const h = m[1];
    return { rgb: [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)], a: m[2] ? parseInt(m[2], 16) / 255 : 1 };
  }
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/i.exec(s);
  if (m) return { rgb: [Number(m[1]), Number(m[2]), Number(m[3])], a: m[4] == null ? 1 : Number(m[4]) };
  return null;
}
const keyOf = (rgb: readonly number[]): string => rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
const cssOf = (rgb: readonly number[], a: number): string => (a >= 1 ? `#${keyOf(rgb)}` : `rgba(${rgb.map(v => Math.round(v)).join(', ')}, ${Number(a.toFixed(3))})`);

/* the family's paper pairs, by the dark ink's channels (an alpha the script set is kept: color.new(ink, 40)) */
const PAPER_OF = new Map<string, [number, number, number]>();
for (const p of INK_PAIRS) {
  const d = parseInk(p.dark);
  const q = parseInk(p.paper);
  if (d && q) PAPER_OF.set(keyOf(d.rgb), q.rgb);
}

/** A family ink on a light tape: its paper pair, at the alpha it was written with; any other ink as it came */
export function paperInk(css: string): string {
  const c = parseInk(css);
  if (!c) return css;
  const to = PAPER_OF.get(keyOf(c.rgb));
  if (!to) return css;
  /* the wash's own alpha is in its pair (0.30) — the alpha written is the one kept */
  return cssOf(to, c.a);
}

/* ---- a line drawn faint ---------------------------------------------------------------- */

/** The alpha the Indicators menu's faint parts are drawn at on a dark tape (the Bollinger and VWAP bands) */
export const FAINT_ALPHA = 0.6;

/**
 * A LINE DRAWN FAINT, ON A LIGHT TAPE (the review of approvals 4, 5 and 11, 2026-10-15): the paper pairs read 3:1 whole,
 * but a band drawn at 60% read 2.2 to 2.4:1 on the darkest light tape (the VWAP bands' #00574C, the Bollinger bands'
 * #753F80, on #BEBDB8) — the 3:1 was measured on the ink, not on the line. On paper a line keeps a third of its
 * faintness (0.6 → 0.867, 0.7 → 0.9, 0.4 → 0.8): still fainter than its whole line, and the line as drawn reads 3:1.
 * A wash (a fill, a background) keeps its alpha — it is a ground, not a line.
 */
export const paperLineAlpha = (a: number): number => (a >= 1 ? 1 : Math.round((1 - (1 - a) / 3) * 1000) / 1000);

/** A faint part of an Indicators-menu line, as drawn: its ink at FAINT_ALPHA on a dark tape, its paper pair at the
    paper line alpha on a light one */
export function faintInk(css: string, light: boolean): string {
  const c = parseInk(light ? paperInk(css) : css);
  if (!c) return css;
  return cssOf(c.rgb, light ? paperLineAlpha(FAINT_ALPHA) : FAINT_ALPHA);
}

/** The house's own inks a script may write, and the token each reads on the tape's ground */
export const HOUSE_INK_TOKENS: [string, string][] = [
  [CALL_WALL, '--absorb'],
  [PUT_WALL, '--amplify'],
  [SUPREME, '--supreme'],
  [FLIP, '--flip'],
  [BULL, '--bull'],
  [BEAR, '--bear'],
  [ACCENT, '--select'],
];

/** What a script's ink paints: a line (a plot, an hline, a shape) or a wash (a fill, a background) */
export type InkKind = 'line' | 'wash';

/**
 * THE LIGHT TAPE'S INKS FOR A SCRIPT: the family's paper pairs, and the house's own inks read off the tape's tokens
 * (`token` gives a token's channels on that ground — off the chart's box in the page, off tokens.css in the proof).
 * A family ink written at an alpha for a LINE takes the paper line alpha (paperLineAlpha); a wash keeps its alpha, and
 * so does a house ink (the silver guides stay quiet). Kept per ink, so a run's per-bar colours cost a lookup each.
 */
export function paperInksWith(token: (name: string) => [number, number, number] | null): (css: string, kind?: InkKind) => string {
  const house = new Map<string, [number, number, number]>();
  for (const [hex, name] of HOUSE_INK_TOKENS) {
    const c = parseInk(hex);
    const t = token(name);
    if (c && t) house.set(keyOf(c.rgb), t);
  }
  const kept = new Map<string, string>();
  return (css: string, kind: InkKind = 'wash') => {
    const key = `${kind}|${css}`;
    const hit = kept.get(key);
    if (hit !== undefined) return hit;
    let out = css;
    const c = parseInk(css);
    if (c) {
      const k = keyOf(c.rgb);
      const family = PAPER_OF.get(k);
      if (family) out = cssOf(family, kind === 'line' ? paperLineAlpha(c.a) : c.a);
      else {
        const to = house.get(k);
        if (to) out = cssOf(to, c.a);
      }
    }
    if (kept.size > 512) kept.clear();
    kept.set(key, out);
    return out;
  };
}
