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
  the supreme, the silver) are not this family's: on
  a light tape they take the paper's (paperInksWith —
  the walls the light ground's gold and violet, as
  the field's ovals do; the rest off the tape's own
  box), so a shipped wall stays the field's wall.

  ONE RULE UNDER EVERY COLOURS OPTION (the owner,
  2026-10-15: "Only the ovals use their two colours
  … Anything meaning up/down uses the candles' up and
  down colours. Everything else uses the indicator
  palette, kept clear of the ovals' colours"): a
  shipped script's up and down (it writes the house
  pair, BULL and BEAR) are drawn in the candles' up
  and down (candleTheme candleDirInks, after the
  reader's colour vision) on every tape — Supertrend,
  SAR, ADX's ±DI, Ichimoku's spans and its cloud, a
  faint wash at the alpha it was written with — and
  its walls in the field's pair on the tape's ground
  (scriptInksWith). A reader's own script keeps the
  colours its code sets; a plot it leaves uncoloured
  takes the family's default (DEFAULT_PLOT_INK). The
  compare lines are the family's too (COMPARE_INKS):
  no blue near the violet.
==================================================
*/

import { ACCENT, BEAR, BULL, CALL_WALL, FLIP, PUT_WALL, SUPREME } from './palette';

/** [the ink on a dark tape, its pair on a light one] */
type Pair = readonly [string, string];

/** StrikeChart's ChartIndicators keys — named here so this module reads without the chart (the proofs run in Node); a key
    the chart adds and this list lacks fails the chart's typecheck where it reads INDICATOR_INKS */
export type IndicatorKey = 'ema9' | 'ema21' | 'ema50' | 'vwap' | 'bb' | 'vwapBands' | 'sma' | 'rsi' | 'macd' | 'atrPane';

/* The Indicators menu's lines (StrikeChart INDICATOR_PARTS) — a lead ink a key; the MACD's signal and its steel wash
   beside them.
   UNDER EVERY COLOURS OPTION, TRITANOPIA AND THE CANDLES TOO (the review of the owner's colour rule, 2026-10-16): the
   family's floor from the ovals holds as seen and under simulated protanopia, deuteranopia and tritanopia, and every ink
   stands 0.05 from every theme's candle up and down. The inks that met it with a small move moved (EMA 21 #77C4FE → off
   Glacier's rising candle at 0.038; Bollinger #D498FC, Keltner #7D7D74 and MFI #447CAE off the gold or the violet under
   tritanopia; compare lines 1 and 4). Those that met it only with a new hue — RSI, the stochastic's %K, ADX, Ichimoku's
   lagging span, the SMA, and on paper EMA 9, EMA 50, Donchian and Keltner — are the owner's to decide, each measured in
   scripts/indicator-inks-proof.ts with an alternative that clears it.
   THE CANDLES UNDER COLOUR VISION, AND THEIR HUES (the third review of the rule, 2026-10-16 — the owner: "Check that
   candles, indicator inks and the two oval colours stay distinct under every Colours option, including colour-vision
   simulations"): every ink as drawn stands 0.05 from each option's candle up and down under simulated protanopia,
   deuteranopia and tritanopia too, and 30° of OKLCh hue from each candle ink with a hue. Measured on the family as
   it was, 516 of 21,216 option-ink-candle-view pairs stood under the floor (Bollinger 0.004 from the blue-orange rise
   #50A4FF under protanopia, IV 0.005 from Glacier's rise and the MACD signal 0.009 from Market's fall, both under
   deuteranopia) and 284 ink-candle pairs within 30° of hue (EMA 21 and the SMA 3° from the blue-orange rise, the MACD
   signal 10° from its fall). The candles' own hues — the colour-vision cut's blue and orange, Neon's lime, Foil's
   violet fall — joined to the direction pair's red and green and the ovals' gold and violet leave the family three arcs
   and the greys: teals and aquas, pinks and magentas, an olive. So it moved there, 27 of its 31 dark inks and 17 paper
   pairs (each paper ink that moved kept its dark ink's hue), every floor above kept; FORMER_DARK keeps what each was.
   A clash left with the candle the owner is deciding on in one of eight themes (Contrast's, Velvet's, Tide's and
   Harbor's falling candles, Whipsaw's violets, Stone's blue rise) waits on that decision, held by ink and theme in the
   proof. EMA 21's and the SMA's paper inks keep their navy: no paper ink at their new dark inks' hue clears every
   floor. Of the inks held under tritanopia above, the stochastic's %K and EMA 50's and Keltner's paper inks are held
   still; the rest moved and clear it.
   NO LINE PASSES FOR STONE'S BLACK CANDLE (the fourth review of the rule, 2026-10-16): VWAP's paper ink had gone to
   #140013 and compare line 2's to #32051A, the darkness of Stone's black falling candle (1.04 and 1.17:1 by luminance) —
   OKLab's cube-root lightness stretches the near-blacks apart, so the 0.05 floor let them by, and a VWAP reset read as one
   more black wick. Every price-pane paper ink now reads 1.5:1 or better from that candle, as seen and under each
   simulation (scripts/indicator-inks-proof.ts 9m): VWAP, EMA 21, the SMA, the moving average and the compare lines took
   lighter inks of their own hue (compare line 1 made room for 3), but for the moving average, which found no teal clear
   of its neighbours and stands a blue beside EMA 21's and the SMA's, held with them for the owner's decision on Stone's
   blue rise. Every other floor holds. The price pane's magentas near the supreme's hue are the owner's to decide (9n);
   none moved toward it. */
const INDICATOR_PAIRS: Record<IndicatorKey, Pair> = {
  ema9: ['#54A6AB', '#04585C'],
  ema21: ['#88C0B4', '#002B66'],
  ema50: ['#75E0D8', '#0B726E'],
  sma: ['#FB31BA', '#071591'],
  vwap: ['#C21EB2', '#400279'],
  vwapBands: ['#FF69F6', '#54286C'],
  bb: ['#DB88CE', '#703E81'],
  rsi: ['#C68B9E', '#5C3242'],
  macd: ['#A1667A', '#400220'],
  atrPane: ['#885288', '#4B054D'],
};
const MACD_SIGNAL_PAIR: Pair = ['#F35697', '#763F01'];
/** The steel wash the MACD's bars wore until 2026-10-16 — a kept MACD script (the reader's own since approval 5) still
    draws it. The chart's own MACD draws its bars in the candles' up and down now (DIR_WASH_ALPHA, the owner's rule) */
const MACD_HIST_PAIR: Pair = ['rgba(226,234,244,0.30)', 'rgba(60,64,72,0.30)'];
/** The alpha the chart's MACD bars wear the candles' up and down at, on either tape — a wash under the two lines */
export const DIR_WASH_ALPHA = 0.6;

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
  movingAverage: ['#0C9884', '#093E89'],
  ichimokuConversion: ['#DD62D1', '#791853'],
  ichimokuBase: ['#9F9170', '#4D4834'],
  ichimokuLagging: ['#187D6E', '#034239'],
  keltner: ['#71674D', '#5C5663'],
  donchian: ['#DC2C92', '#730081'],
  stochasticK: ['#FD98BE', '#BD1D73'],
  stochasticD: ['#9931A7', '#270033'],
  adx: ['#C6B4C4', '#291509'],
  cci: ['#C66597', '#9A0179'],
  williamsR: ['#B2448F', '#974477'],
  mfi: ['#596F82', '#3B2634'],
  obv: ['#9F7A2B', '#402E05'],
};

/* THE COMPARE LINES AND A PLOT LEFT UNCOLOURED (the owner, 2026-10-15: "Compare lines and Pine plots with no colour set:
   indicator palette, no blue near the violet"): the compare lines wore #5B9CF6, #BBB2E8, #EDE4CD and #6BD3C7 with no
   pair for a light tape, and a Pine plot given no colour #5B9CF6 — a blue 0.137 from the field's violet, under the 0.15
   the family keeps; the lavender and the cream were Whipsaw's and Harbor's rising candles to the digit. Members of the
   family now, held to its floors from the field's pair (and from it under simulated protanopia, deuteranopia and
   tritanopia — compare lines 1 and 4 moved off the gold under tritanopia on 2026-10-16), from
   the house's inks, from every theme's candles (0.05 — no compare line is a candle) and from each other, each with its
   pair for a light tape. THEY STAND APART FROM THE LINES THEY SHARE A PANE WITH: a compare line and a script's plot draw
   on the price pane or a pane of their own, never in a sub-pane indicator's, so they keep 0.08 from the price pane's
   inks (the averages, the VWAP and its bands, Bollinger, the shipped overlays), not from RSI's or the stochastic's. The
   family holds no free blue at 0.08 on either ground (2026-10-16, searched: the only room was dim mid-tones at
   L 0.50–0.57), so no compare line is a blue. The second and third moved off the candles under colour vision
   (2026-10-16: the olive 0.010 from Market's fall under protanopia and 20° from Neon's lime rise, the grey-teal 0.046 from
   Glacier's rise under tritanopia); a desk saved with either takes its slot's ink (OLD_COMPARE_INKS). */
const COMPARE_PAIRS: readonly Pair[] = [
  ['#C4879C', '#AC3D75'],
  ['#A87084', '#883C59'],
  ['#C4B5C3', '#4B2535'],
  ['#A92E81', '#9E0065'],
];
const PLOT_DEFAULT_PAIR: Pair = ['#A97C07', '#432F01'];

const dark = <K extends string>(r: Record<K, Pair>): Record<K, string> => Object.fromEntries(Object.entries<Pair>(r).map(([k, v]) => [k, v[0]])) as Record<K, string>;

/** Each Indicators-menu key's lead ink on a dark tape */
export const INDICATOR_INKS: Record<IndicatorKey, string> = dark(INDICATOR_PAIRS);
export const MACD_SIGNAL_INK = MACD_SIGNAL_PAIR[0];
export const MACD_HIST_INK = MACD_HIST_PAIR[0];
/** Each shipped script's own line inks on a dark tape — the Pine sources write them (data/builtinScripts.ts) */
export const SCRIPT_INKS: Record<ScriptInkKey, string> = dark(SCRIPT_PAIRS);

/** The compare lines' inks on a dark tape, a slot each (four, so a pane crosses four names at most) */
export const COMPARE_INKS: readonly string[] = COMPARE_PAIRS.map(p => p[0]);
/** A Pine plot's or shape's ink when its script sets none (core/pine) */
export const DEFAULT_PLOT_INK = PLOT_DEFAULT_PAIR[0];
/* the compare inks a desk may have saved, by slot: before the family took the compare lines in, and the family's first cut
   (2026-10-16, its first and fourth moved off the gold under tritanopia the same day) */
const OLD_COMPARE_INKS: readonly (readonly string[])[] = [
  ['#5B9CF6', '#BBB2E8', '#EDE4CD', '#6BD3C7'],
  ['#D69FB2', '#929A2D', '#9EC3C2', '#FDBCD2'],
];
/** A compare line's ink as a desk saved it: one saved with a former ink is its slot's ink now */
export function compareInk(saved: string): string {
  const key = saved.trim().toUpperCase();
  for (const list of OLD_COMPARE_INKS) {
    const i = list.indexOf(key);
    if (i >= 0) return COMPARE_INKS[i];
  }
  return saved;
}
/** A compare line's ink as its tape draws it — its slot's ink (compareInk), the paper pair on a light tape. The one answer
    for the line, the chart's legend and the compare menu's swatch, so a swatch never names a colour the line is not (the
    review of 2026-10-16: on Stone the menu showed IWM's dark-tape grey-teal beside a dark purple line) */
export function compareInkOn(saved: string, light: boolean): string {
  const ink = compareInk(saved);
  return light ? paperInk(ink) : ink;
}

/* THE VOLATILITY PANE'S TWO LINES (StrikeChart's vol drift — realised against implied): the lavender and the cream they
   wore were Whipsaw's and Harbor's rising candles to the digit, the reference's purple and yellow — the ovals' two hues —
   and had no pair for a light tape (the review of the owner's colour rule, 2026-10-16: "Everything else uses the indicator
   palette, kept clear of the ovals' colours"). Members of the family now, held to its floors from the ovals (as seen and
   under the three simulations), the house's inks and every theme's candles, 0.08 from each other, 0.05 from every other
   ink (their pane is their own), each with its pair for a light tape. */
const VOL_PAIRS = { rv: ['#7F5D08', '#583F00'] as Pair, iv: ['#15DECE', '#212F32'] as Pair };
/** Realised volatility's line on a dark tape (its pair on a light one through paperInk) */
export const RV_INK = VOL_PAIRS.rv[0];
/** Implied volatility's line on a dark tape */
export const IV_INK = VOL_PAIRS.iv[0];

/** Every pair of the family, for the proof and for the light tape's lookup */
export const INK_PAIRS: { name: string; dark: string; paper: string; wash?: true }[] = [
  ...Object.entries<Pair>(INDICATOR_PAIRS).map(([k, [d, p]]) => ({ name: `indicator:${k}`, dark: d, paper: p })),
  { name: 'indicator:macdSignal', dark: MACD_SIGNAL_PAIR[0], paper: MACD_SIGNAL_PAIR[1] },
  { name: 'indicator:macdHist', dark: MACD_HIST_PAIR[0], paper: MACD_HIST_PAIR[1], wash: true },
  ...Object.entries<Pair>(SCRIPT_PAIRS).map(([k, [d, p]]) => ({ name: `script:${k}`, dark: d, paper: p })),
  ...COMPARE_PAIRS.map(([d, p], i) => ({ name: `compare:${i + 1}`, dark: d, paper: p })),
  { name: 'plot:default', dark: PLOT_DEFAULT_PAIR[0], paper: PLOT_DEFAULT_PAIR[1] },
  { name: 'vol:rv', dark: VOL_PAIRS.rv[0], paper: VOL_PAIRS.rv[1] },
  { name: 'vol:iv', dark: VOL_PAIRS.iv[0], paper: VOL_PAIRS.iv[1] },
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

/* THE FAMILY'S FORMER DARK INKS, by the pair that holds the line now. A retired built-in kept as the house wrote it
   (approval 5) holds the inks of the day it was kept, and draws its pair's current ink (keptInksWith), so the copy and the
   Indicators menu's line agree — and it finds its paper pair on a light tape (an ink the family no longer lists had none:
   a copy kept on 2026-10-15 drew its EMA 21 and MACD signal dark inks on Stone). */
export const FORMER_DARK: readonly [string, string][] = [
  /* approval 4's first cut (03ca5ad), moved by its review (59d97da) */
  ['#75BBF4', 'indicator:ema21'],
  ['#D27843', 'indicator:macdSignal'],
  /* moved under every Colours option (2026-10-16): EMA 21 off Glacier's rising candle, Bollinger off the gold under
     tritanopia */
  ['#77C4FE', 'indicator:ema21'],
  ['#D498FC', 'indicator:bb'],
  /* A SHIPPED SCRIPT'S COPY HOLDS ITS DAY'S INKS TOO (the third review of the colour rule, 2026-10-16): an unedited copy
     draws as the shipped one (builtinScripts inksBy), so an ink the house moved since it was made is its pair's ink now —
     on a Stone tape a Keltner copy's #7D7D74 and an MFI copy's #447CAE drew at 2.21 and 2.35:1. The same day's moves
     (8367930), and the first cut's script inks that its review moved (59d97da) */
  ['#7D7D74', 'script:keltner'],
  ['#447CAE', 'script:mfi'],
  ['#968D6C', 'script:ichimokuBase'],
  ['#CE909B', 'script:keltner'],
  ['#7BAB84', 'script:donchian'],
  ['#AA8802', 'script:stochasticD'],
  ['#D06976', 'script:williamsR'],
  ['#40A859', 'script:mfi'],
  ['#FA7F7D', 'script:obv'],
  /* moved off the candles under colour vision and their hues (the third review, 2026-10-16) */
  ['#0099CC', 'indicator:ema9'],
  ['#85B9FE', 'indicator:ema21'],
  ['#ABF8F3', 'indicator:ema50'],
  ['#768EAE', 'indicator:sma'],
  ['#06BFB0', 'indicator:vwap'],
  ['#42F6D9', 'indicator:vwapBands'],
  ['#D394FE', 'indicator:bb'],
  ['#FBACFE', 'indicator:rsi'],
  ['#B692CE', 'indicator:macd'],
  ['#A77E91', 'indicator:atrPane'],
  ['#D37C18', 'indicator:macdSignal'],
  ['#18A19C', 'script:movingAverage'],
  ['#E37DC1', 'script:ichimokuConversion'],
  ['#FCDCFF', 'script:ichimokuLagging'],
  ['#6A6B57', 'script:keltner'],
  ['#58B0D1', 'script:donchian'],
  ['#A78A00', 'script:stochasticD'],
  ['#FFBCD3', 'script:adx'],
  ['#C267A9', 'script:cci'],
  ['#C73996', 'script:williamsR'],
  ['#44739E', 'script:mfi'],
  ['#AB713C', 'script:obv'],
];
const NOW_OF = new Map<string, [number, number, number]>();
/* the same, as the house writes the ink in a script's text ('#RRGGBB', its pair's dark ink) */
const NOW_TEXT = new Map<string, string>();
for (const [hex, name] of FORMER_DARK) {
  const was = parseInk(hex);
  const pair = INK_PAIRS.find(p => p.name === name);
  const now = parseInk(pair?.dark ?? '');
  if (was && now && pair) {
    NOW_OF.set(keyOf(was.rgb), now.rgb);
    NOW_TEXT.set(keyOf(was.rgb), pair.dark);
  }
}

/** A '#rrggbb' as the house writes it today: a former family ink its pair's current dark ink, any other as it came — so a
    script's text the house wrote before it moved an ink reads as the house's text now (data/builtinScripts inksBy) */
export function inkNow(hex: string): string {
  const c = parseInk(hex);
  return (c && NOW_TEXT.get(keyOf(c.rgb))) ?? hex;
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

/** The house's own inks a script may write, and the token each reads on the tape's ground — the walls the field's pair,
    the flip, the supreme and the silver. The direction pair (BULL, BEAR) is not among them: a shipped script's up and
    down are the candles' (scriptInksWith) */
export const HOUSE_INK_TOKENS: [string, string][] = [
  [CALL_WALL, '--absorb'],
  [PUT_WALL, '--amplify'],
  [SUPREME, '--supreme'],
  [FLIP, '--flip'],
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

/** An ink at an alpha: '#rrggbb' or an rgb() as 'rgba(r, g, b, a)' — anything else as it came */
export function withAlpha(css: string, a: number): string {
  const c = parseInk(css);
  return c ? cssOf(c.rgb, a) : css;
}

/** What a script's inks are mapped by: whether the terminal ships it, the tape's ground, the chart's candles */
export interface ScriptInkOpts {
  /** A script the terminal ships (Script `shelf: 'built-in'`), or a copy of one the reader never changed — its text and
      its inks are still the house's (data/builtinScripts inksBy). A reader's own — one they wrote, a copy or a kept
      retired one they have edited — keeps the colours its code sets */
  shipped: boolean;
  /** A retired built-in the reader keeps AS THE HOUSE WROTE IT (data/builtinScripts keptAsWritten — kept since approval 5
      and never saved again by the reader): every ink in it is the family's, which the reader never set, so it draws as the
      Indicators menu's own line does — its pair's current ink, and on a light tape the paper pair */
  kept?: boolean;
  /** The tape's ground is light (Stone) */
  light: boolean;
  /** The candles' up and down this chart paints (candleTheme candleDirInks, after the reader's colour vision) */
  dir: { up: string; down: string };
  /** A house token's channels on the tape's ground: the walls the field's pair there, the rest off the tape's own box */
  token: (name: string) => [number, number, number] | null;
}

const DEFAULT_PLOT_KEY = keyOf(parseInk(PLOT_DEFAULT_PAIR[0])!.rgb);
const DEFAULT_PLOT_PAPER = parseInk(PLOT_DEFAULT_PAIR[1])!.rgb;
const BULL_KEY = keyOf(parseInk(BULL)!.rgb);
const BEAR_KEY = keyOf(parseInk(BEAR)!.rgb);

/**
 * A RETIRED BUILT-IN KEPT AS THE HOUSE WROTE IT (ScriptInkOpts `kept`): its inks are the family's, written by the house in
 * their dark values, and the reader never set one. So it draws as the Indicators menu's line does: an ink the family has
 * since moved takes its pair's current ink, and on a light tape every family ink its paper pair and the house's inks the
 * tape's tokens (paperInksWith) — the light-tape guarantee of approval 4 (the review of 2026-10-16: mapped as a reader's
 * own, a kept RSI, EMA ribbon, VWAP, Bollinger, MACD or ATR drew its dark inks on Stone at 1.0 to 1.85:1). Once the reader
 * saves it, it is theirs and keeps what its code sets.
 */
function keptInksWith(o: ScriptInkOpts): (css: string, kind?: InkKind) => string {
  const light = o.light ? paperInksWith(o.token) : null;
  const kept = new Map<string, string>();
  return (css: string, kind: InkKind = 'wash') => {
    const key = `${kind}|${css}`;
    const hit = kept.get(key);
    if (hit !== undefined) return hit;
    let out = css;
    const c = parseInk(css);
    if (c) {
      const now = NOW_OF.get(keyOf(c.rgb));
      if (now) out = cssOf(now, c.a);
      if (light) out = light(out, kind);
    }
    if (kept.size > 512) kept.clear();
    kept.set(key, out);
    return out;
  };
}

/**
 * A SCRIPT'S INKS ON THIS CHART (the owner's rule of 2026-10-15), or undefined where nothing is mapped:
 *  · a SHIPPED script's up and down (the house pair it writes, BULL and BEAR) are the candles' up and down, at the alpha
 *    written — on a dark tape and a light one, under every theme and colour vision (the last review found nothing mapped
 *    on a dark tape: under blue and orange Supertrend drew the house green and red beside blue and orange candles); its
 *    walls are the field's pair on the tape's ground (under blue and orange the ovals' paler gold and redder violet); on a
 *    light tape its flip, supreme and silver are the tape's tokens and the family's inks their paper pairs
 *    (paperInksWith);
 *  · a READER'S OWN script keeps every colour its code sets; only a plot it left uncoloured — the family's default, the
 *    house's pick — takes its pair on a light tape;
 *  · a retired built-in KEPT AS THE HOUSE WROTE IT draws as the family does (keptInksWith).
 */
export function scriptInksWith(o: ScriptInkOpts): ((css: string, kind?: InkKind) => string) | undefined {
  if (!o.shipped && o.kept) return keptInksWith(o);
  if (!o.shipped) {
    if (!o.light) return undefined;
    return (css: string, kind: InkKind = 'wash') => {
      const c = parseInk(css);
      if (!c || keyOf(c.rgb) !== DEFAULT_PLOT_KEY) return css;
      return cssOf(DEFAULT_PLOT_PAPER, kind === 'line' ? paperLineAlpha(c.a) : c.a);
    };
  }
  const up = parseInk(o.dir.up)?.rgb ?? null;
  const down = parseInk(o.dir.down)?.rgb ?? null;
  const light = o.light ? paperInksWith(o.token) : null;
  /* on a dark tape the walls alone move — to the field's pair as the reader's colour vision has it; the flip, the supreme
     and the silver are written in the dark island's own values */
  const house = new Map<string, [number, number, number]>();
  if (!o.light)
    for (const [hex, name] of HOUSE_INK_TOKENS.filter(([, n]) => n === '--absorb' || n === '--amplify')) {
      const c = parseInk(hex);
      const t = o.token(name);
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
      /* an ink the house has since moved (a copy made before the move holds it) is its pair's ink now */
      const now = NOW_OF.get(k);
      const cur = now ? cssOf(now, c.a) : css;
      if (k === BULL_KEY && up) out = cssOf(up, c.a);
      else if (k === BEAR_KEY && down) out = cssOf(down, c.a);
      else if (light) out = light(cur, kind);
      else {
        const to = house.get(k);
        out = to ? cssOf(to, c.a) : cur;
      }
    }
    if (kept.size > 512) kept.clear();
    kept.set(key, out);
    return out;
  };
}
