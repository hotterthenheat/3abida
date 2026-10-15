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
  ema9: ['#0099CC', '#10699A'],
  ema21: ['#75BBF4', '#002A57'],
  ema50: ['#ABF8F3', '#04706D'],
  sma: ['#768EAE', '#04077E'],
  vwap: ['#06BFB0', '#003F38'],
  vwapBands: ['#57F7CA', '#00574C'],
  bb: ['#D498FC', '#753F80'],
  rsi: ['#FBACFE', '#3A2244'],
  macd: ['#B692CE', '#410569'],
  atrPane: ['#A77E91', '#5A0040'],
};
const MACD_SIGNAL_PAIR: Pair = ['#D27843', '#7B3806'];
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
  movingAverage: ['#18A19C', '#162728'],
  ichimokuConversion: ['#E37DC1', '#791853'],
  ichimokuBase: ['#968D6C', '#544D28'],
  ichimokuLagging: ['#FCDCFF', '#700982'],
  keltner: ['#CE909B', '#974662'],
  donchian: ['#7BAB84', '#004D0F'],
  stochasticK: ['#FD98BE', '#BC175B'],
  stochasticD: ['#AA8802', '#423310'],
  adx: ['#FFBCD3', '#5B3445'],
  cci: ['#C267A9', '#9C066E'],
  williamsR: ['#D06976', '#72071D'],
  mfi: ['#40A859', '#023100'],
  obv: ['#FA7F7D', '#4B0013'],
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

/**
 * THE LIGHT TAPE'S INKS FOR A SCRIPT: the family's paper pairs, and the house's own inks read off the tape's tokens
 * (`token` gives a token's channels on that ground — off the chart's box in the page, off tokens.css in the proof).
 * Kept per ink, so a run's per-bar colours cost a lookup each.
 */
export function paperInksWith(token: (name: string) => [number, number, number] | null): (css: string) => string {
  const house = new Map<string, [number, number, number]>();
  for (const [hex, name] of HOUSE_INK_TOKENS) {
    const c = parseInk(hex);
    const t = token(name);
    if (c && t) house.set(keyOf(c.rgb), t);
  }
  const kept = new Map<string, string>();
  return (css: string) => {
    const hit = kept.get(css);
    if (hit !== undefined) return hit;
    let out = css;
    const c = parseInk(css);
    if (c) {
      const k = keyOf(c.rgb);
      const to = PAPER_OF.get(k) ?? house.get(k);
      if (to) out = cssOf(to, c.a);
    }
    if (kept.size > 512) kept.clear();
    kept.set(css, out);
    return out;
  };
}
