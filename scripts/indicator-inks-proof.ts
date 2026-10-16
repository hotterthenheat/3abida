/*
  THE INDICATORS' INKS (scripts/indicator-inks-proof.ts, in `npm test`) — the owner's approvals of 2026-10-15:
    4. "Indicator colours off gold/violet: approved."
    5. "Drop the six Pine scripts that duplicate built-ins: approved."
   11. "'The flip' script's red wash: remove it. Red carries no meaning on Terrain."
  Held to the audit's measure (docs/terrain-audit-2026-10-15/exercise/area-b.md §6d; scripts/terrain-exercise/area-b.mjs
  fieldClash — OKLab distance):
    1. every line the chart draws from the Indicators menu (StrikeChart INDICATOR_PARTS, the inks as that file takes
       them) and every line a shipped script draws (each one RUN, its plots and marks read back) stands 0.15 or more from
       the field's gold and violet — the house pair on the dark tape, the paper pair on the light one — and 0.08 or more
       from the colour-vision pair the field wears under blue-orange;
    2. no ink is two things: every ink 0.08 or more from every other indicator's or script's, from the compare lines,
       and from the house's inks a shipped script draws (the walls, the flip, the supreme, the direction pair) — on both
       grounds;
    3. on a light tape each reads 3:1 or better: the family on the darkest light tape (Stone on a dark page), the house's
       own inks (read off the paper tokens, as the chart reads them) on the light page's tape;
    4. the shelf no longer lists EMA ribbon, VWAP, Bollinger Bands, RSI, MACD or ATR; each is kept, once, as the
       reader's own where a pane, a star or an alert still names it, and never given to anyone else;
    5. "The flip" draws its line in the flip's own grey and paints no fill and no background; no other shipped script
       paints a red or green wash but the one reported (the Ichimoku cloud).
  And the review of those approvals (2026-10-15):
    6. no line reads as up or down, and no wash is red or green but the Ichimoku cloud: every ink with a hue (OKLCh
       chroma 0.04 or more) stands 30° or more of hue from the direction pair on its ground — a wash measured the same
       way, by its hue, so a pale sage or rose wash is found too (the ΔE test let Donchian's sage and Keltner's rose by);
    7. a line as drawn reads 3:1 on the darkest light tape — the Indicators menu's faint parts at the alpha the chart
       draws them at, a shipped script's lines through the light tape's mapper, alpha and all;
    8. the reader's colour vision reaches the chart's chrome: under blue and orange (and high contrast) a light tape's
       direction pair is the reader's light pair, not the dark island's, outranks the dark island's set, and reads 3:1
       (high contrast: its words 7:1) on the darkest light tape; a dark tape's chrome takes the reader's dark set.
  And the owner's colour rule of 2026-10-15, under every Colours option ("Only the ovals use their two colours …
  Anything meaning up/down uses the candles' up and down colours. Everything else uses the indicator palette, kept clear
  of the ovals' colours"):
    9. for every candle theme × page theme × colour vision (standard, blue and orange, high contrast — the rails' Colours
       move the ladder alone, never the ovals): every indicator, script, compare and default-plot ink, as drawn on that
       tape, stands the family's floor from the two ovals' inks of that option (0.15 from the house pair, 0.08 from the
       colour-vision pair) and 0.08 from them under simulated protanopia, deuteranopia and tritanopia; every
       shipped script's and built-in's up and down part IS the theme's candle up and down; the Ichimoku cloud's two
       fills are the candle inks at its alpha; a reader's own script keeps the colours its code sets; a plot given no
       colour and the compare lines wear the family's own inks, no blue near the violet. A table prints the closest
       pairs per option — the candles against the ovals among them, left as the owner's to decide where they close up.
  And the review of that rule (2026-10-16):
    9a. tritanopia is asserted like the other two simulations; the approved inks that clear it only with a new hue are
        HELD for the owner by name, printed with their nearest pair and one alternative, and the list only shrinks (9a′);
    9i. every ink as drawn stands 0.05 from that option's candle up and down (EMA 21 sat 0.038 from Glacier's rise);
    9j. the volatility pane's RV and IV are the family's pairs (they were Whipsaw's and Harbor's rising candles);
    4′. a retired copy kept as the house wrote it draws its family inks' paper pairs on a light tape (as a reader's own it
        drew its dark inks on Stone at 1.0 to 1.85:1), a former family ink its pair's current one; an edited copy keeps
        its colours;
    and what the rule leaves open is printed: direction lines under 3:1 on their own ground, a theme with one ink.
*/
import { readFileSync } from 'node:fs';
import { distanceUnder, type Deficiency } from './colour-sim';
import * as candleThemes from '../src/components/gex/candleTheme';
import type { CandleTheme, CandleThemeKey } from '../src/components/gex/candleTheme';
import { compile, explain, run } from '../src/core/pine';
import type { Bar, RunResult } from '../src/core/pine';
import * as builtins from '../src/data/builtinScripts';
import { INK_PAIRS, INDICATOR_INKS as FAMILY_INKS, MACD_HIST_INK, MACD_SIGNAL_INK, paperInk, paperInksWith, parseInk } from '../src/components/gex/indicatorInks';
import * as inkFamily from '../src/components/gex/indicatorInks';
import { ACCENT, BEAR, BULL, CALL_WALL, FLIP, PUT_WALL, SUPREME } from '../src/components/gex/palette';

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (ok) pass++;
  else fail++;
};
const info = (line: string) => console.log(`      ${line}`);

/* ---- colour arithmetic: OKLab (the audit's), WCAG contrast ------------------------------------------------------ */
type RGB = [number, number, number];
const lin = (c: number) => {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
function oklab([r, g, b]: RGB): RGB {
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
const dE = (a: RGB, b: RGB) => {
  const A = oklab(a);
  const B = oklab(b);
  return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
};
/** OKLCh chroma and hue (degrees) */
const lchOf = (rgb: RGB) => {
  const [, a, b] = oklab(rgb);
  return { C: Math.hypot(a, b), h: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360 };
};
const hueGap = (x: number, y: number) => {
  const d = Math.abs(x - y) % 360;
  return d > 180 ? 360 - d : d;
};
const lum = ([r, g, b]: RGB) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const contrast = (a: RGB, b: RGB) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const rgbOf = (css: string): RGB => {
  const c = parseInk(css);
  if (!c) throw new Error(`not an ink: ${css}`);
  return c.rgb;
};
const hexOf = (rgb: RGB) => `#${rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
/** an ink with an alpha below 1 as it lands on its ground — the MACD's steel wash is drawn at 30% */
const over = (css: string, ground: RGB): RGB => {
  const c = parseInk(css)!;
  return c.rgb.map((v, i) => v * c.a + ground[i] * (1 - c.a)) as RGB;
};

/* ---- the grounds and the house's tokens, read from the source the page is built from ---------------------------- */
const root = new URL('../', import.meta.url);
const read = (p: string) => readFileSync(new URL(p, root), 'utf8');
const tokensCss = read('src/theme/tokens.css');
const indexCss = read('src/index.css');
/** a token block's channels: the block that starts at `head` */
const blockOf = (head: string, text = tokensCss): Map<string, RGB> => {
  const at = text.indexOf(head);
  if (at < 0) throw new Error(`no block ${head}`);
  const body = text.slice(at, text.indexOf('\n}', at));
  const out = new Map<string, RGB>();
  for (const m of body.matchAll(/(--[\w-]+):\s*(\d+)\s+(\d+)\s+(\d+)\s*;/g)) out.set(m[1], [Number(m[2]), Number(m[3]), Number(m[4])]);
  return out;
};
const DARK_TOK = blockOf(":root,\n[data-theme='dark'] {");
const PAPER_TOK = blockOf("[data-theme='light'] {");
const CVD_DARK = blockOf(":root[data-cvd='blue-orange'],\n:root[data-cvd='blue-orange'] [data-theme='dark'] {");
const CVD_PAPER = blockOf(":root[data-cvd='blue-orange'][data-theme='light'],");
/* a light tape's own chrome set (index.css, under data-chart-ground="light"): the flip, the supreme, the direction pair and
   the silver a chart on a light tape reads off its box — the walls it leaves to the light ground's pair */
const CHART_LIGHT = blockOf("[data-chart-ground='light'] :is([data-chart-chrome], [data-chart-ink], [data-chart-frame]),", indexCss);
const tok = (m: Map<string, RGB>, n: string): RGB => {
  const v = m.get(n);
  if (!v) throw new Error(`no token ${n}`);
  return v;
};
const GOLD = { dark: tok(DARK_TOK, '--absorb'), paper: tok(PAPER_TOK, '--absorb'), cvdDark: tok(CVD_DARK, '--absorb'), cvdPaper: tok(CVD_PAPER, '--absorb') };
const VIOLET = { dark: tok(DARK_TOK, '--amplify'), paper: tok(PAPER_TOK, '--amplify'), cvdDark: tok(CVD_DARK, '--amplify'), cvdPaper: tok(CVD_PAPER, '--amplify') };

const themeSrc = read('src/components/gex/candleTheme.ts');
const DARK_GROUNDS: RGB[] = [...themeSrc.matchAll(/canvas: \{ bg: '(#[0-9A-Fa-f]{6})'(?![^}]*light: true)/g)].map(m => rgbOf(m[1]));
DARK_GROUNDS.push(tok(DARK_TOK, '--panel'));
const STONE_DARK_PAGE = rgbOf(/bg: '(#[0-9A-Fa-f]{6})', bgOnLightPage/.exec(themeSrc)![1]);
const STONE_LIGHT_PAGE = rgbOf(/bgOnLightPage: '(#[0-9A-Fa-f]{6})'/.exec(themeSrc)![1]);

/* the compare lines' inks: the family's since the owner's rule of 2026-10-15 (indicatorInks COMPARE_INKS, a light pair
   each); before it Terrain and the Pulse widget each wrote their own list, with no light pair */
const famCompare = INK_PAIRS.filter(p => p.name.startsWith('compare:'));
const compareOf = (p: string) => {
  const m = /const COMPARE_INKS = (\[[^\]]*\])/.exec(read(p));
  return m ? (JSON.parse(m[1].replace(/'/g, '"')) as string[]) : [];
};
const localCompare = [...new Set([...compareOf('src/pages/terrain/Terrain.tsx'), ...compareOf('src/pages/workspace/LiveChartWidget.tsx')])];
const COMPARE = famCompare.length ? famCompare.map(p => p.dark) : localCompare;
const COMPARE_PAPER = famCompare.length ? famCompare.map(p => p.paper) : localCompare;

/* ---- the inks the chart's own indicators draw, as StrikeChart takes them ----------------------------------------- */
interface Ink {
  owner: string;
  part: string;
  dark: string;
  paper: string;
  faint?: boolean;
}
const strike = read('src/components/gex/StrikeChart.tsx');
/** StrikeChart's INDICATOR_INKS: its own literal (the code before approval 4) or the family it imports */
const localLead = /export const INDICATOR_INKS[^=]*=\s*\{([\s\S]*?)\};/.exec(strike);
const leadOf: Record<string, string> = localLead ? Object.fromEntries([...localLead[1].matchAll(/(\w+):\s*'([^']+)'/g)].map(m => [m[1], m[2]])) : { ...FAMILY_INKS };
const localLight = /const INDICATOR_INKS_LIGHT[^=]*=\s*\{([\s\S]*?)\};/.exec(strike);
const lightOf = (dark: string): string => {
  if (localLight) {
    const m = new RegExp(`'${dark.replace(/[()]/g, '\\$&')}':\\s*'([^']+)'`).exec(localLight[1]);
    return m ? m[1] : dark;
  }
  return paperInk(dark);
};
const partsBlock = /const INDICATOR_PARTS[^=]*=\s*\{([\s\S]*?)\n\};/.exec(strike)![1];
const builtinInks: Ink[] = [];
for (const m of partsBlock.matchAll(/^ {2}(\w+): \{[\s\S]*?(?=^ {2}\w+: \{|$(?![\s\S]))/gm)) {
  const key = m[1];
  for (const p of m[0].matchAll(/part: '(\w+)'[^}]*?ink: ('[^']*'|[^,}]+)([^}]*)/g)) {
    const expr = p[2].trim();
    const dark = expr.startsWith("'") ? expr.slice(1, -1) : expr.startsWith('INDICATOR_INKS.') ? leadOf[expr.slice('INDICATOR_INKS.'.length)] : expr === 'MACD_SIGNAL_INK' ? MACD_SIGNAL_INK : expr === 'MACD_HIST_INK' ? MACD_HIST_INK : expr;
    builtinInks.push({ owner: `indicator:${key}`, part: p[1], dark, paper: lightOf(dark), faint: /faint: true/.test(p[3]) });
  }
}
check(`the chart's ten indicators are read (${new Set(builtinInks.map(i => i.owner)).size} keys, ${builtinInks.length} parts)`, new Set(builtinInks.map(i => i.owner)).size === 10 && builtinInks.every(i => !!parseInk(i.dark)), builtinInks.filter(i => !parseInk(i.dark)).map(i => `${i.owner}:${i.part}=${i.dark}`).join(', '));

/* ---- the inks every shipped script draws: each one run, its plots and marks read back ---------------------------- */
const walk = (n: number, start: number, step: number, seed0: number): Bar[] => {
  let s = seed0;
  const r = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const out: Bar[] = [];
  let p = 480;
  for (let i = 0; i < n; i++) {
    const o = p;
    const c = p + (r() - 0.5) * 2.4;
    out.push({ time: start + i * step, open: o, high: Math.max(o, c) + r() * 0.8, low: Math.min(o, c) - r() * 0.8, close: c, volume: Math.round(1000 + r() * 9000) });
    p = c;
  }
  return out;
};
const bars = walk(600, Date.UTC(2026, 9, 1, 13, 30) / 1000, 60, 99);
const last = bars[bars.length - 1].close;
/* the flip near the price so a wash under it would show on the bars */
const slayer = { callWall: Math.round(last) + 4, putWall: Math.round(last) - 4, flip: Math.round(last), supreme: Math.round(last) + 2 };
const runOf = (source: string): RunResult => run(compile(source), bars, { timeframe: '1m', slayer, budgetMs: 10_000 });

/* as StrikeChart hands the script layer its light tape's inks: the walls off the light ground, the rest off the tape's box */
const PAPER_HOUSE = (name: string): RGB | null => (name === '--absorb' || name === '--amplify' ? PAPER_TOK.get(name) : CHART_LIGHT.get(name)) ?? null;
const toPaper = paperInksWith(PAPER_HOUSE);
const HOUSE = new Map<string, string>([
  [hexOf(rgbOf(CALL_WALL)), 'call wall'],
  [hexOf(rgbOf(PUT_WALL)), 'put wall'],
  [hexOf(rgbOf(SUPREME)), 'supreme'],
  [hexOf(rgbOf(FLIP)), 'flip'],
  [hexOf(rgbOf(BULL)), 'up'],
  [hexOf(rgbOf(BEAR)), 'down'],
  [hexOf(rgbOf(ACCENT)), 'silver'],
]);
const isHouse = (css: string) => HOUSE.has(hexOf(rgbOf(css)));

const shipped = builtins.builtinScripts();
const scriptInks: Ink[] = [];
const houseUsed = new Map<string, Set<string>>();
const washes: { slug: string; what: string; inks: string[] }[] = [];
const runs = new Map<string, RunResult>();
/** every ink a shipped script draws as a line, alpha and all */
const drawnLines: { owner: string; part: string; css: string }[] = [];
for (const s of shipped) {
  const slug = s.id.replace(/^builtin:/, '');
  let r: RunResult;
  try {
    r = runOf(s.source);
  } catch (e) {
    check(`${s.title} runs`, false, explain(e).message);
    continue;
  }
  runs.set(slug, r);
  const seen = new Set<string>();
  const add = (part: string, css: string | null) => {
    if (!css || !parseInk(css) || parseInk(css)!.a === 0) return;
    if (isHouse(css)) {
      const set = houseUsed.get(HOUSE.get(hexOf(rgbOf(css)))!) ?? new Set<string>();
      set.add(slug);
      houseUsed.set(HOUSE.get(hexOf(rgbOf(css)))!, set);
      return;
    }
    const k = hexOf(rgbOf(css));
    if (seen.has(k)) return;
    seen.add(k);
    scriptInks.push({ owner: `script:${slug}`, part, dark: k, paper: toPaper(k) });
  };
  for (const p of r.plots) {
    add(p.title, p.ink);
    for (const c of new Set(p.colors ?? [])) add(p.title, c);
  }
  for (const sh of r.shapes) {
    add(sh.title, sh.ink);
    for (const c of new Set(sh.colors ?? [])) add(sh.title, c);
  }
  for (const p of r.plots) for (const c of new Set([p.ink, ...(p.colors ?? [])])) if (c) drawnLines.push({ owner: `script:${slug}`, part: p.title, css: c });
  for (const sh of r.shapes) for (const c of new Set([sh.ink, ...(sh.colors ?? [])])) if (c) drawnLines.push({ owner: `script:${slug}`, part: sh.title, css: c });
  const washInks = [...new Set([...r.fills.flatMap(f => [f.ink, ...(f.colors ?? [])]), ...(r.bgcolors ?? [])].filter((c): c is string => !!c && !!parseInk(c) && parseInk(c)!.a > 0))];
  if (r.bgcolors?.some(c => !!c)) washes.push({ slug, what: 'background', inks: [...new Set(r.bgcolors.filter((c): c is string => !!c))] });
  if (r.fills.length) washes.push({ slug, what: 'fill', inks: washInks });
}

/* ---- 1 and 2: off the field's hues, apart from each other ---------------------------------------------------------- */
const all: Ink[] = [...builtinInks, ...scriptInks];
/* one ink an owner and part kind: Bollinger's bands are its basis at an alpha, the same ink */
const items: Ink[] = [];
for (const i of all) {
  const k = `${i.owner}|${hexOf(rgbOf(i.dark))}`;
  if (!items.some(x => `${x.owner}|${hexOf(rgbOf(x.dark))}` === k)) items.push(i);
}
const darkOf = (i: Ink): RGB => (parseInk(i.dark)!.a < 1 ? over(i.dark, DARK_GROUNDS[0]) : rgbOf(i.dark));
const paperOf = (i: Ink): RGB => (parseInk(i.paper)!.a < 1 ? over(i.paper, STONE_LIGHT_PAGE) : rgbOf(i.paper));
const lines = items.filter(i => parseInk(i.dark)!.a >= 0.6); // the MACD's 30% steel wash is measured as drawn, below

const nearField: string[] = [];
const nearCvd: string[] = [];
let minField = Infinity;
for (const i of lines) {
  const d = rgbOf(i.dark);
  const p = rgbOf(i.paper);
  const dd = Math.min(dE(d, GOLD.dark), dE(d, VIOLET.dark));
  const pp = Math.min(dE(p, GOLD.paper), dE(p, VIOLET.paper));
  minField = Math.min(minField, dd, pp);
  if (dd < 0.15) nearField.push(`${i.owner} ${i.part} ${i.dark} ${dE(d, GOLD.dark) < dE(d, VIOLET.dark) ? 'gold' : 'violet'} ${dd.toFixed(3)}`);
  if (pp < 0.15) nearField.push(`${i.owner} ${i.part} paper ${i.paper} ${dE(p, GOLD.paper) < dE(p, VIOLET.paper) ? 'gold' : 'violet'} ${pp.toFixed(3)}`);
  const cd = Math.min(dE(d, GOLD.cvdDark), dE(d, VIOLET.cvdDark));
  const cp = Math.min(dE(p, GOLD.cvdPaper), dE(p, VIOLET.cvdPaper));
  if (cd < 0.08 || cp < 0.08) nearCvd.push(`${i.owner} ${i.part} ${cd.toFixed(3)}/${cp.toFixed(3)}`);
}
check(`every indicator and shipped-script line stands 0.15 or more (OKLab) from the field's gold and violet, dark tape and paper (${lines.length} inks; the nearest ${minField.toFixed(3)})`, nearField.length === 0, nearField.slice(0, 12).join('; '));
check('and 0.08 or more from the gold and violet the field wears under blue-orange colour vision, on both grounds', nearCvd.length === 0, nearCvd.slice(0, 8).join('; '));

/* shared inks and near pairs, across every owner (two lines of one indicator count too: the MACD's two, the stochastic's) */
const shared: string[] = [];
const close: string[] = [];
let minPair = Infinity;
let minPaperPair = Infinity;
for (let a = 0; a < items.length; a++)
  for (let b = a + 1; b < items.length; b++) {
    const A = items[a];
    const B = items[b];
    const dd = dE(darkOf(A), darkOf(B));
    const pp = dE(paperOf(A), paperOf(B));
    minPair = Math.min(minPair, dd);
    minPaperPair = Math.min(minPaperPair, pp);
    if (dd < 1e-6) shared.push(`${A.owner} ${A.part} and ${B.owner} ${B.part} both ${hexOf(darkOf(A))}`);
    else if (dd < 0.08) close.push(`${A.owner} ${A.part} ~ ${B.owner} ${B.part} ${dd.toFixed(3)}`);
    if (pp < 0.08 && dd >= 1e-6) close.push(`paper: ${A.owner} ${A.part} ~ ${B.owner} ${B.part} ${pp.toFixed(3)}`);
  }
check(`no two indicators or scripts share an ink (${items.length} inks)`, shared.length === 0, shared.slice(0, 10).join('; '));
check(`every ink 0.08 or more from every other, dark tape and paper (nearest ${minPair.toFixed(3)} and ${minPaperPair.toFixed(3)})`, close.length === 0, close.slice(0, 10).join('; '));

/* THE COMPARE LINES AND AN UNCOLOURED PLOT stand apart from the lines they share a pane with: the price pane's (the
   Indicators menu's overlays and the shipped overlay scripts) — never in a sub-pane indicator's (indicatorInks) */
const overlayKeys = new Set([...partsBlock.matchAll(/^ {2}(\w+): \{\s*pane: 'overlay'/gm)].map(m => `indicator:${m[1]}`));
for (const sc of shipped) if (sc.meta && sc.meta.pane !== 'own') overlayKeys.add(`script:${sc.id.replace(/^builtin:/, '')}`);
const priceLines = lines.filter(i => overlayKeys.has(i.owner));
const famAll = inkFamily as unknown as { DEFAULT_PLOT_INK?: string };
const defaultPair = INK_PAIRS.find(p => p.name === 'plot:default');
const sideLines: { name: string; dark: string; paper: string }[] = [
  ...COMPARE.map((c, k) => ({ name: `compare ${k + 1}`, dark: c, paper: COMPARE_PAPER[k] })),
  /* a plot given no colour: the family's default, or before the rule the interpreter's own '#5B9CF6' (no light pair) */
  defaultPair ? { name: 'default plot', dark: defaultPair.dark, paper: defaultPair.paper } : { name: 'default plot', dark: famAll.DEFAULT_PLOT_INK ?? '#5B9CF6', paper: famAll.DEFAULT_PLOT_INK ?? '#5B9CF6' },
];
/* THE VOLATILITY PANE'S RV AND IV: the family's own pairs since the review of the owner's rule (2026-10-16); before it
   StrikeChart's literals, the reference's lavender and cream, with no light pair */
const volPairs = INK_PAIRS.filter(p => p.name.startsWith('vol:'));
const volLiteral = (n: string) => /const (RV|IV)_INK = '([^']+)'/g.exec(strike) && [...strike.matchAll(/const (RV|IV)_INK = '([^']+)'/g)].find(m => m[1] === n)?.[2];
const volLines: { name: string; dark: string; paper: string }[] = volPairs.length
  ? volPairs.map(p => ({ name: p.name === 'vol:rv' ? 'RV' : 'IV', dark: p.dark, paper: p.paper }))
  : (['RV', 'IV'] as const).map(n => ({ name: n, dark: volLiteral(n) ?? '#000000', paper: volLiteral(n) ?? '#000000' }));
const nearCompare: string[] = [];
let minCompare = Infinity;
for (const i of priceLines)
  for (const c of sideLines) {
    const dd = dE(rgbOf(i.dark), rgbOf(c.dark));
    const pp = dE(rgbOf(i.paper), rgbOf(c.paper));
    minCompare = Math.min(minCompare, dd, pp);
    if (dd < 0.08 || pp < 0.08) nearCompare.push(`${i.owner} ${i.part} ~ ${c.name} ${c.dark}/${c.paper} ${Math.min(dd, pp).toFixed(3)}`);
  }
for (let a = 0; a < sideLines.length; a++)
  for (let b = a + 1; b < sideLines.length; b++) {
    const dd = dE(rgbOf(sideLines[a].dark), rgbOf(sideLines[b].dark));
    const pp = dE(rgbOf(sideLines[a].paper), rgbOf(sideLines[b].paper));
    if (dd < 0.08 || pp < 0.08) nearCompare.push(`${sideLines[a].name} ~ ${sideLines[b].name} ${Math.min(dd, pp).toFixed(3)}`);
  }
check(`the compare lines (${COMPARE.join(' ')}) and an uncoloured plot (${sideLines[4].dark}) stand 0.08 or more from every price-pane ink (${priceLines.length}) and from each other, dark tape and paper (nearest ${minCompare.toFixed(3)})`, nearCompare.length === 0, nearCompare.slice(0, 10).join('; '));

const houseInks: [string, RGB, RGB][] = [
  ['call wall', rgbOf(CALL_WALL), tok(PAPER_TOK, '--absorb')],
  ['put wall', rgbOf(PUT_WALL), tok(PAPER_TOK, '--amplify')],
  ['supreme', rgbOf(SUPREME), tok(CHART_LIGHT, '--supreme')],
  ['flip', rgbOf(FLIP), tok(CHART_LIGHT, '--flip')],
  ['up', rgbOf(BULL), tok(CHART_LIGHT, '--bull')],
  ['down', rgbOf(BEAR), tok(CHART_LIGHT, '--bear')],
  ["the rails' silver", rgbOf(ACCENT), tok(CHART_LIGHT, '--select')],
  ['the MACD steel wash as drawn', over(MACD_HIST_INK, DARK_GROUNDS[0]), over(paperInk(MACD_HIST_INK), STONE_LIGHT_PAGE)],
];
const nearHouse: string[] = [];
for (const i of lines)
  for (const [name, d, p] of houseInks) {
    const dd = dE(rgbOf(i.dark), d);
    const pp = dE(rgbOf(i.paper), p);
    if (dd < 0.08 || pp < 0.08) nearHouse.push(`${i.owner} ${i.part} ~ ${name} ${dd.toFixed(3)}/${pp.toFixed(3)}`);
  }
check("every ink 0.08 or more from the house's inks a shipped script draws (walls, flip, supreme, the direction pair, the rails' silver) and from the MACD's steel wash", nearHouse.length === 0, nearHouse.slice(0, 10).join('; '));
/* the light tape's own candles (Stone: blue up, black down) — a line on paper must not pass for a candle */
const stoneCandles = [...themeSrc.matchAll(/stone: \{\s*up: '(#[0-9A-Fa-f]{6})',\s*down: '(#[0-9A-Fa-f]{6})'/g)].flatMap(m => [rgbOf(m[1]), rgbOf(m[2])]);
const nearCandle = lines.flatMap(i => stoneCandles.filter(c => dE(rgbOf(i.paper), c) < 0.08).map(c => `${i.owner} ${i.part} ${i.paper} ~ ${hexOf(c)}`));
check(`every paper ink 0.08 or more from the light tape's own candles (${stoneCandles.map(hexOf).join(', ')})`, stoneCandles.length === 2 && nearCandle.length === 0, nearCandle.slice(0, 6).join('; '));
info(`house inks drawn by shipped scripts: ${[...houseUsed].map(([k, v]) => `${k} (${[...v].join(', ')})`).join('; ')}`);

/* ---- 3: readable on a light tape -------------------------------------------------------------------------------- */
const dim: string[] = [];
let worst = Infinity;
for (const i of lines) {
  const c = contrast(rgbOf(i.paper), STONE_DARK_PAGE);
  worst = Math.min(worst, c);
  if (c < 3) dim.push(`${i.owner} ${i.part} ${i.paper} ${c.toFixed(2)}:1`);
}
check(`every indicator and shipped-script line's paper ink reads 3:1 or better on the darkest light tape ${hexOf(STONE_DARK_PAGE)} (worst ${worst.toFixed(2)}:1)`, dim.length === 0, dim.slice(0, 10).join('; '));
const darkDim = lines.filter(i => DARK_GROUNDS.some(g => contrast(rgbOf(i.dark), g) < 3)).map(i => `${i.owner} ${i.part} ${i.dark}`);
check(`and its dark ink 3:1 or better on every dark tape (${DARK_GROUNDS.length} grounds)`, darkDim.length === 0, darkDim.join('; '));
/* the house's own inks a shipped script draws, through the light tape's mapper (the paper tokens) */
const houseLight: string[] = [];
const houseNotes: string[] = [];
/* the direction pair is not among them since the owner's rule of 2026-10-15: a shipped script's up and down are the
   candles' (9, below) */
for (const [name, d] of houseInks.slice(0, 7).filter(([n]) => n !== 'up' && n !== 'down')) {
  const mapped = rgbOf(toPaper(hexOf(d)));
  const onPage = contrast(mapped, STONE_LIGHT_PAGE);
  const onDarkPage = contrast(mapped, STONE_DARK_PAGE);
  houseNotes.push(`${name} ${hexOf(mapped)} ${onPage.toFixed(2)}:1 (${onDarkPage.toFixed(2)}:1 on Stone on a dark page)`);
  if (hexOf(mapped) === hexOf(d)) houseLight.push(`${name} not mapped`);
  else if (onPage < 3) houseLight.push(`${name} ${onPage.toFixed(2)}:1`);
}
check(`a shipped script's house inks (the walls, the flip, the supreme, the silver) take the paper tokens on a light tape and read 3:1 or better on the light page's tape ${hexOf(STONE_LIGHT_PAGE)}`, houseLight.length === 0, houseLight.join('; '));
info(houseNotes.join('; '));
const alphaKept = toPaper('rgba(232, 185, 74, 0.6)');
check(`an ink written at an alpha keeps it on paper (the call wall at 0.6 → ${alphaKept})`, /, 0\.6\)$/.test(alphaKept) && hexOf(rgbOf(alphaKept)) === hexOf(tok(PAPER_TOK, '--absorb')));

/* ---- 6: no line reads as up or down — every ink with a hue stands 30° of hue off the direction pair ------------ */
const UP_H = { dark: lchOf(rgbOf(BULL)).h, paper: lchOf(tok(CHART_LIGHT, '--bull')).h };
const DOWN_H = { dark: lchOf(rgbOf(BEAR)).h, paper: lchOf(tok(CHART_LIGHT, '--bear')).h };
/** the hue gap to the nearer of the pair, or null for an ink with no hue to read (chroma under 0.04) */
const dirGap = (rgb: RGB, ground: 'dark' | 'paper'): { gap: number; to: string } | null => {
  const { C, h } = lchOf(rgb);
  if (C < 0.04) return null;
  const u = hueGap(h, UP_H[ground]);
  const d = hueGap(h, DOWN_H[ground]);
  return u < d ? { gap: u, to: 'up' } : { gap: d, to: 'down' };
};
const onDir: string[] = [];
let minDirGap = Infinity;
for (const i of lines) {
  for (const [ground, css] of [['dark', i.dark], ['paper', i.paper]] as const) {
    const g = dirGap(rgbOf(css), ground);
    if (!g) continue;
    minDirGap = Math.min(minDirGap, g.gap);
    if (g.gap < 30) onDir.push(`${i.owner} ${i.part} ${ground === 'paper' ? 'paper ' : ''}${hexOf(rgbOf(css))} ${g.gap.toFixed(0)}° from ${g.to}`);
  }
}
check(`no indicator or shipped-script line reads as up or down: every ink with a hue stands 30° or more of OKLCh hue from the direction pair, dark tape and paper (nearest ${minDirGap.toFixed(0)}°)`, onDir.length === 0, onDir.slice(0, 12).join('; '));

/* ---- 7: a line as drawn reads 3:1 on the darkest light tape --------------------------------------------------- */
/* the Indicators menu's faint parts at the alpha the chart draws them: `+ '99'` (60% on either tape) before the review,
   indicatorInks faintInk after it */
const famAny = inkFamily as unknown as { faintInk?: (css: string, light: boolean) => string };
const faintOld = /inkOf\(part\.ink\) \+ '99'/.test(strike) || !famAny.faintInk;
const withA = (css: string, a: number) => {
  const c = parseInk(css)!;
  return `rgba(${c.rgb.join(', ')}, ${a})`;
};
const faintDrawn = (ink: string, light: boolean): string => (faintOld ? withA(light ? paperInk(ink) : ink, 0.6) : famAny.faintInk!(ink, light));
const faintParts = builtinInks.filter(i => i.faint);
const faintDim: string[] = [];
const faintNotes: string[] = [];
for (const i of faintParts) {
  const drawn = faintDrawn(i.dark, true);
  const c = contrast(over(drawn, STONE_DARK_PAGE), STONE_DARK_PAGE);
  faintNotes.push(`${i.owner} ${i.part} ${drawn} ${c.toFixed(2)}:1`);
  if (c < 3) faintDim.push(`${i.owner} ${i.part} ${drawn} ${c.toFixed(2)}:1`);
}
check(`the Indicators menu's faint parts, as drawn on a light tape, read 3:1 or better on ${hexOf(STONE_DARK_PAGE)} (${faintParts.length} parts)`, faintParts.length >= 6 && faintDim.length === 0, faintDim.join('; '));
info(`faint parts as drawn: ${faintNotes.join('; ')}`);
/* a shipped script's lines through the light tape's mapper, as the script layer hands them (a line, alpha and all); the
   house's own inks keep their meaning and their alpha (the silver guides, the walls) and are measured in 3 above */
const toPaperLine = toPaper as (css: string, kind?: 'line' | 'wash') => string;
const scriptDim: string[] = [];
let scriptWorst = Infinity;
let scriptFaint = 0;
for (const l of drawnLines) {
  const c0 = parseInk(l.css);
  if (!c0 || c0.a < 0.3 || isHouse(l.css)) continue;
  const drawn = toPaperLine(l.css, 'line');
  if (c0.a < 1) scriptFaint++;
  const c = contrast(over(drawn, STONE_DARK_PAGE), STONE_DARK_PAGE);
  scriptWorst = Math.min(scriptWorst, c);
  if (c < 3) scriptDim.push(`${l.owner} ${l.part} ${l.css} → ${drawn} ${c.toFixed(2)}:1`);
}
check(`every shipped script's own line, as the light tape draws it, reads 3:1 or better on ${hexOf(STONE_DARK_PAGE)} (${scriptFaint} written faint; worst ${scriptWorst.toFixed(2)}:1)`, scriptFaint >= 4 && scriptDim.length === 0, [...new Set(scriptDim)].slice(0, 8).join('; '));

/* ---- 4: the shelf, and the six kept for whoever had one -------------------------------------------------------- */
const SIX = ['ema-ribbon', 'vwap', 'bollinger', 'rsi', 'macd', 'atr'];
const onShelf = shipped.map(s => s.id.replace(/^builtin:/, ''));
const still = SIX.filter(s => onShelf.includes(s));
check(`the shelf no longer lists EMA ribbon, VWAP, Bollinger Bands, RSI, MACD or ATR (${onShelf.length} shipped: ${onShelf.join(', ')})`, still.length === 0, still.length ? `still listed: ${still.join(', ')}` : '');
const retiredBuiltin = (builtins as { retiredBuiltin?: (id: string) => { title: string; source: string } | null }).retiredBuiltin;
const RETIRED_IDS = (builtins as { RETIRED_IDS?: readonly string[] }).RETIRED_IDS ?? [];
const kept = SIX.map(s => ({ s, r: retiredBuiltin?.(`builtin:${s}`) ?? null }));
const keptBroken = kept.filter(k => {
  if (!k.r) return true;
  try {
    runOf(k.r.source);
    return false;
  } catch {
    return true;
  }
});
check('each of the six is kept as a source a reader can be given (it compiles and runs)', !!retiredBuiltin && keptBroken.length === 0 && RETIRED_IDS.length === 6, keptBroken.map(k => k.s).join(', '));
/* the kept copies draw the chart built-in's own inks, so the copy and the menu's line agree */
const keptInk = (slug: string) => (kept.find(k => k.s === slug)?.r ? runOf(kept.find(k => k.s === slug)!.r!.source).plots.map(p => hexOf(rgbOf(p.ink))) : []);
const want: Record<string, string[]> = {
  'ema-ribbon': [leadOf.ema9, leadOf.ema21, leadOf.ema50],
  vwap: [leadOf.vwap],
  bollinger: [leadOf.bb, leadOf.bb, leadOf.bb],
  rsi: [leadOf.rsi],
  macd: [MACD_HIST_INK, leadOf.macd, MACD_SIGNAL_INK],
  atr: [leadOf.atrPane],
};
const inkMiss = SIX.filter(s => {
  const got = keptInk(s);
  const w = want[s].map(c => hexOf(rgbOf(c)));
  return got.length !== w.length || got.some((g, i) => g !== w[i]);
});
check("the kept copies draw the inks they were kept with — the chart built-in's lines, the MACD copy's bars its steel wash (a reader's own script keeps the colours its code sets)", inkMiss.length === 0, inkMiss.map(s => `${s}: ${keptInk(s).join(' ')} want ${want[s].map(c => hexOf(rgbOf(c))).join(' ')}`).join('; '));

/* the store (its memory driver here — no IndexedDB in Node): a pane, a star and an alert keep theirs, once */
{
  const { scriptStore } = await import('../src/data/scriptStore');
  await scriptStore.toggleFavourite('builtin:macd');
  const placed = await scriptStore.place('terrain:1', 'builtin:rsi', { len: 21 });
  const mine = await scriptStore.list('mine');
  const rsi = await scriptStore.get('builtin:rsi');
  const macd = mine.find(s => s.id === 'builtin:macd');
  const onPane = await scriptStore.onPane('terrain:1');
  check(
    `a placed retired script is the reader's own, its placement and inputs standing (${rsi ? `"${rsi.title}", shelf ${rsi.shelf}, read-only ${rsi.readOnly}` : 'gone'}; pane ${onPane.map(c => `${c.scriptId} ${JSON.stringify(c.inputs)}`).join(', ')})`,
    !!rsi && rsi.shelf === 'mine' && !rsi.readOnly && rsi.source === retiredBuiltin?.('builtin:rsi')?.source && onPane.some(c => c.id === placed.id && c.scriptId === 'builtin:rsi' && c.inputs.len === 21) && mine.some(s => s.id === 'builtin:rsi')
  );
  check('a starred one is kept too, and listed under My scripts', !!macd && macd.shelf === 'mine');
  /* 4′. A KEPT COPY DRAWS AS THE FAMILY (the review of the owner's rule, 2026-10-16): mapped as a reader's own, the six
     kept copies drew their dark inks on a light tape at 1.0 to 1.85:1 (a kept RSI #FBACFE on Stone 1.11:1). A copy kept
     as the house wrote it (builtinScripts keptAsWritten) draws its family inks' paper pairs on a light tape and its pair's
     current ink where the family moved one; once the reader saves an edit it keeps what its code sets. */
  {
    const bs = builtins as unknown as { keptAsWritten?: (sc: { id: string; shelf: string; version: number; sourceHash: string }) => boolean; hashSource: (x: string) => string };
    const fam = inkFamily as unknown as { scriptInksWith?: (o: { shipped: boolean; kept?: boolean; light: boolean; dir: { up: string; down: string }; token: (n: string) => [number, number, number] | null }) => ((css: string, kind?: 'line' | 'wash') => string) | undefined };
    const ctk = candleThemes as unknown as { themeFor: (k: string, v: string) => CandleTheme; candleDirInks?: (t: CandleTheme) => { up: string; down: string } };
    const stone = ctk.themeFor('stone', 'standard');
    const stoneDir = ctk.candleDirInks ? ctk.candleDirInks(stone) : { up: stone.borderUp ?? stone.up, down: stone.borderDown ?? stone.down };
    const keptOf = (sc: { id: string; shelf: string; version: number; sourceHash: string }) => (bs.keptAsWritten ? bs.keptAsWritten(sc) : false);
    const wasKept = !!rsi && keptOf(rsi);
    const mapperOf = (kept: boolean, light: boolean) => fam.scriptInksWith?.({ shipped: false, kept, light, dir: stoneDir, token: PAPER_HOUSE }) ?? ((c: string) => c);
    const keptLight = mapperOf(wasKept, true);
    const keptDim: string[] = [];
    const keptNotes: string[] = [];
    let keptLines = 0;
    for (const { s: slug, r } of kept) {
      if (!r) continue;
      const run1 = runOf(r.source);
      for (const pl of run1.plots)
        for (const c of new Set([pl.ink, ...(pl.colors ?? [])])) {
          const c0 = c ? parseInk(c) : null;
          if (!c || !c0 || c0.a < 0.3 || isHouse(c)) continue;
          keptLines++;
          const drawn = keptLight(c, 'line');
          const ct2 = contrast(over(drawn, STONE_DARK_PAGE), STONE_DARK_PAGE);
          if (slug === 'rsi' || slug === 'ema-ribbon') keptNotes.push(`${slug} ${pl.title} ${c} → ${drawn} ${ct2.toFixed(2)}:1`);
          if (ct2 < 3) keptDim.push(`${slug} ${pl.title} ${c} → ${drawn} ${ct2.toFixed(2)}:1`);
        }
    }
    check(`4′. a retired copy kept as the house wrote it (${rsi ? `"${rsi.title}" version ${rsi.version}` : 'none'} reads as kept: ${wasKept}) draws every line its paper pair on a light tape, 3:1 or better on ${hexOf(STONE_DARK_PAGE)} (${keptLines} lines over the six)`, wasKept && keptLines >= 10 && keptDim.length === 0, keptDim.slice(0, 8).join('; '));
    info(`kept copies on Stone: ${keptNotes.join('; ')}`);
    /* a copy kept on an earlier day holds the family's inks of that day: its pair's current ink, on either tape */
    const ribbon = kept.find(k => k.s === 'ema-ribbon')?.r?.source ?? '';
    const formerMiss: string[] = [];
    for (const old of ['#75BBF4', '#77C4FE']) {
      const src = ribbon.replace(new RegExp(leadOf.ema21, 'i'), old);
      const plot = runOf(src).plots.find(pl => pl.title === 'EMA 21');
      if (!plot) {
        formerMiss.push(`${old}: no EMA 21`);
        continue;
      }
      const onDark = mapperOf(wasKept, false)(plot.ink, 'line');
      const onLight = mapperOf(wasKept, true)(plot.ink, 'line');
      const ems = INK_PAIRS.find(q => q.name === 'indicator:ema21')!;
      if (hexOf(rgbOf(onDark)) !== hexOf(rgbOf(ems.dark)) || hexOf(rgbOf(onLight)) !== hexOf(rgbOf(ems.paper))) formerMiss.push(`${old} → ${onDark} dark, ${onLight} light; want ${ems.dark} / ${ems.paper}`);
    }
    check(`4″. a kept copy holding a former family ink (EMA 21 #75BBF4, #77C4FE) draws its pair's current ink on a dark tape and its paper pair on a light one`, wasKept && formerMiss.length === 0, formerMiss.join('; '));
    /* who reads as kept: a retired id, the reader's shelf, never saved again by them (or the house's text today) */
    const rsiSrc = retiredBuiltin?.('builtin:rsi')?.source ?? '';
    const cases: [string, { id: string; shelf: string; version: number; sourceHash: string }, boolean][] = [
      ['kept, never saved', { id: 'builtin:rsi', shelf: 'mine', version: 1, sourceHash: 'x' }, true],
      ['saved again with the house text', { id: 'builtin:rsi', shelf: 'mine', version: 3, sourceHash: bs.hashSource(rsiSrc) }, true],
      ['edited by the reader', { id: 'builtin:rsi', shelf: 'mine', version: 2, sourceHash: bs.hashSource(`${rsiSrc}\n// mine`) }, false],
      ["the reader's own script", { id: 'a1b2', shelf: 'mine', version: 1, sourceHash: 'y' }, false],
      ['a shipped one', { id: 'builtin:supertrend', shelf: 'built-in', version: 1, sourceHash: 'z' }, false],
    ];
    const wrongCase = cases.filter(([, sc, want]) => keptOf(sc) !== want).map(([n]) => n);
    const edited = mapperOf(false, true);
    const editedKeeps = runOf(rsiSrc).plots.every(pl => edited(pl.ink, 'line') === pl.ink);
    check(`4‴. only an unedited kept copy reads as the house's (${cases.length} cases); one the reader edited keeps its coded colours on a light tape`, !!bs.keptAsWritten && wrongCase.length === 0 && editedKeeps, wrongCase.join('; '));
  }
  const atr = await scriptStore.get('builtin:atr'); // what the alert watcher asks for an alert on it
  check("one an alert names is kept when the alert's watcher asks for it", !!atr && atr.shelf === 'mine');
  const after = await scriptStore.list('mine');
  check(
    `nothing is given that nothing named (My scripts: ${after.map(s => s.id).join(', ')})`,
    !after.some(s => ['builtin:vwap', 'builtin:bollinger', 'builtin:ema-ribbon'].includes(s.id)) && after.filter(s => s.id === 'builtin:rsi').length === 1
  );
  const vRsi = await scriptStore.versions('builtin:rsi');
  const again = await scriptStore.get('builtin:rsi');
  check(`once: asked again it is the same script, one version (${vRsi.length})`, vRsi.length === 1 && again?.createdAt === rsi?.createdAt);
  await scriptStore.remove('builtin:rsi');
  const gone = await scriptStore.get('builtin:rsi');
  check('a reader who deletes it is not given it back', gone === null);
  const shelfIds = (await scriptStore.list('built-in')).map(s => s.id);
  check("a never-named retired id is not on any shelf, and asking the shelf does not make one", !shelfIds.some(id => RETIRED_IDS.includes(id)));
}

/* ---- 5: "The flip" — its own grey, no wash; no other red or green wash but the one reported --------------------- */
const flip = runs.get('flip');
const flipInk = flip?.plots[0]?.ink;
check(`"The flip" draws its line in the flip's own ink (${flipInk} — palette FLIP ${FLIP})`, !!flipInk && hexOf(rgbOf(flipInk)) === hexOf(rgbOf(FLIP)));
check(`"The flip" paints no fill and no background (${flip ? `${flip.fills.length} fills, ${flip.bgcolors?.filter(Boolean).length ?? 0} washed bars` : 'no run'})`, !!flip && flip.fills.length === 0 && !(flip.bgcolors ?? []).some(c => !!c));
/* A WASH IS RED OR GREEN BY ITS HUE (the review: a ΔE of 0.12 from the pure pair let a pale sage and a pale rose by):
   a wash's ink with a hue (chroma 0.04 or more), within 30° of the direction pair's — on the dark tape as written, on
   paper as the light tape's mapper hands it */
const redGreen = washes
  .map(w => ({
    ...w,
    hit: w.inks.flatMap(c => {
      const out: string[] = [];
      const d = dirGap(rgbOf(c), 'dark');
      if (d && d.gap < 30) out.push(`${c} ${d.gap.toFixed(0)}° from ${d.to}`);
      const p = dirGap(rgbOf(toPaper(c)), 'paper');
      if (p && p.gap < 30) out.push(`paper ${toPaper(c)} ${p.gap.toFixed(0)}° from ${p.to}`);
      return out;
    }),
  }))
  .filter(w => w.hit.length);
info(`washes in the shipped scripts: ${washes.map(w => `${w.slug} ${w.what} ${w.inks.slice(0, 3).join(' ')}`).join('; ')}`);
info(`red or green washes (reported, not changed): ${redGreen.map(w => `${w.slug} ${w.what} (${w.hit.slice(0, 2).join(', ')})`).join('; ') || 'none'}`);
check('no shipped script but the Ichimoku cloud writes a red or green wash (by hue) — and the chart draws the cloud in the candles\' up and down (9c)', redGreen.length >= 1 && redGreen.every(w => w.slug === 'ichimoku'), redGreen.filter(w => w.slug !== 'ichimoku').map(w => `${w.slug} ${w.what}: ${w.hit.slice(0, 2).join(', ')}`).join('; '));

/* ---- 8: the reader's colour vision on the chart's chrome ---------------------------------------------------------- */
/* a selector's specificity, as [attributes, classes and pseudo-classes] — enough for these blocks (no ids, no types) */
const specOf = (sel: string): number => {
  let n = 0;
  let rest = sel;
  for (;;) {
    const at = rest.indexOf(':is(');
    if (at < 0) break;
    let depth = 0;
    let end = at + 3;
    for (; end < rest.length; end++) {
      if (rest[end] === '(') depth++;
      else if (rest[end] === ')' && --depth === 0) break;
    }
    n += Math.max(...rest.slice(at + 4, end).split(',').map(specOf));
    rest = rest.slice(0, at) + rest.slice(end + 1);
  }
  return n + (rest.match(/\[[^\]]*\]/g)?.length ?? 0) + (rest.replace(/\[[^\]]*\]/g, '').match(/:[a-z-]+|\.[\w-]+/gi)?.length ?? 0);
};
const blockAt = (text: string, head: string): { sel: string; tok: Map<string, RGB> } | null => {
  const at = text.indexOf(head);
  if (at < 0) return null;
  const open = text.indexOf('{', at);
  const body = text.slice(open, text.indexOf('\n}', open));
  const tokMap = new Map<string, RGB>();
  for (const m of body.matchAll(/(--[\w-]+):\s*(\d+)\s+(\d+)\s+(\d+)\s*;/g)) tokMap.set(m[1], [Number(m[2]), Number(m[3]), Number(m[4])]);
  return { sel: text.slice(at, open).split(',')[0].trim(), tok: tokMap };
};
const ISLAND_CVD = { 'blue-orange': ":root[data-cvd='blue-orange'] [data-theme='dark']", 'high-contrast': ":root[data-cvd='high-contrast'] [data-theme='dark']" } as const;
const CVD_HC_DARK = blockOf(":root[data-cvd='high-contrast'],\n:root[data-cvd='high-contrast'] [data-theme='dark'] {");
for (const vision of ['blue-orange', 'high-contrast'] as const) {
  const light = blockAt(indexCss, `:root[data-cvd='${vision}'] [data-chart-ground='light'] :is(`);
  const dark = blockAt(indexCss, `:root[data-cvd='${vision}'] :is([data-chart-chrome]`);
  const island = specOf(ISLAND_CVD[vision]);
  if (!light) {
    check(`under ${vision}, a light tape's chrome has a set of the reader's own (index.css)`, false, `no :root[data-cvd='${vision}'] [data-chart-ground='light'] set — the dark island's colour-vision set (${ISLAND_CVD[vision]}, specificity ${island}) beats the light set (${specOf("[data-chart-ground='light'] :is([data-chart-chrome], [data-chart-ink], [data-chart-frame])")}) on the chart's box: ${vision === 'blue-orange' ? 'its direction pair is the dark ground\'s #50A4FF / #FF8526, 1.38 and 1.29:1 on the tape' : 'its words are the dark ground\'s near-white 250 250 250 on the light tape'}`);
  } else {
    const up = light.tok.get('--bull');
    const down = light.tok.get('--bear');
    const outranks = specOf(light.sel) > island;
    const reads = !!up && !!down && contrast(up, STONE_DARK_PAGE) >= 3 && contrast(down, STONE_DARK_PAGE) >= 3;
    const notes = [`selector ${specOf(light.sel)} over the island's ${island}`, up && down ? `up ${hexOf(up)} ${contrast(up, STONE_DARK_PAGE).toFixed(2)}:1, down ${hexOf(down)} ${contrast(down, STONE_DARK_PAGE).toFixed(2)}:1 on ${hexOf(STONE_DARK_PAGE)}` : 'no pair'];
    let words = true;
    if (vision === 'high-contrast') {
      for (const n of ['--text-primary', '--text-secondary', '--text-muted']) {
        const t = light.tok.get(n);
        const c = t ? contrast(t, STONE_DARK_PAGE) : 0;
        notes.push(`${n} ${t ? hexOf(t) : 'unset'} ${c.toFixed(2)}:1`);
        if (c < 7) words = false;
      }
      if (!up || !down || contrast(up, STONE_DARK_PAGE) < 4.5 || contrast(down, STONE_DARK_PAGE) < 4.5) words = false;
    } else {
      /* the reader's pair — the paper's blue and orange, deepened for the tape, never another hue */
      const pu = lchOf(tok(CVD_PAPER, '--bull')).h;
      const pd = lchOf(tok(CVD_PAPER, '--bear')).h;
      if (!up || !down || hueGap(lchOf(up).h, pu) > 10 || hueGap(lchOf(down).h, pd) > 10) words = false;
    }
    check(`under ${vision}, a light tape's chrome takes the reader's light set — it outranks the dark island's and reads ${vision === 'high-contrast' ? '4.5:1 (its words 7:1)' : '3:1'} on the darkest light tape`, outranks && reads && words, notes.join('; '));
  }
  const want = vision === 'blue-orange' ? CVD_DARK : CVD_HC_DARK;
  const names = vision === 'blue-orange' ? ['--bull', '--bear'] : ['--bull', '--bear', '--text-primary', '--text-secondary', '--text-muted'];
  const miss = names.filter(n => !dark || hexOf(dark.tok.get(n) ?? [0, 0, 0]) !== hexOf(tok(want, n)));
  check(`under ${vision}, a dark tape's chrome takes the reader's dark set (the dark chart set had kept the house's)`, !!dark && miss.length === 0, dark ? miss.map(n => `${n} ${dark.tok.get(n) ? hexOf(dark.tok.get(n)!) : 'unset'} want ${hexOf(tok(want, n))}`).join('; ') : 'no set');
}
/* ---- 9: the owner's rule under every Colours option (2026-10-15) ----------------------------------------------------
   "Only the ovals use their two colours (gold/violet, or the colour-vision pair). Anything meaning up/down uses the
   candles' up and down colours. Everything else uses the indicator palette, kept clear of the ovals' colours." */
{
  type Vision = 'standard' | 'blue-orange' | 'high-contrast';
  const ct = candleThemes as unknown as {
    CANDLE_THEME_OPTIONS: { value: CandleThemeKey }[];
    themeFor: (k: CandleThemeKey, v: Vision) => CandleTheme;
    candleDirInks?: (t: CandleTheme) => { up: string; down: string };
  };
  const fam = inkFamily as unknown as {
    scriptInksWith?: (o: { shipped: boolean; light: boolean; dir: { up: string; down: string }; token: (n: string) => [number, number, number] | null }) => ((css: string, kind?: 'line' | 'wash') => string) | undefined;
    DEFAULT_PLOT_INK?: string;
  };
  /* the candles' up and down as a line wears them: the rule's one source, or (before it) the same definition read here,
     so the old code is measured against the same candles */
  const dirOfTheme = (t: CandleTheme) => (ct.candleDirInks ? ct.candleDirInks(t) : { up: t.borderUp ?? t.up, down: t.borderDown ?? t.down });
  const lightBlock = (v: Vision) => (v === 'standard' ? CHART_LIGHT : (blockAt(indexCss, `:root[data-cvd='${v}'] [data-chart-ground='light'] :is(`)?.tok ?? CHART_LIGHT));
  const SIMS: Deficiency[] = ['protan', 'deutan', 'tritan'];
  const BULL_HEX = hexOf(rgbOf(BULL));
  const BEAR_HEX = hexOf(rgbOf(BEAR));
  const HOUSE_HEX = new Set([CALL_WALL, PUT_WALL, SUPREME, FLIP, ACCENT].map(c => hexOf(rgbOf(c))));
  interface Opt {
    key: CandleThemeKey;
    page: 'dark' | 'light';
    vision: Vision;
    light: boolean;
    ground: RGB;
    dir: { up: string; down: string };
    gold: RGB;
    violet: RGB;
    token: (n: string) => [number, number, number] | null;
  }
  const opts: Opt[] = [];
  for (const { value: key } of ct.CANDLE_THEME_OPTIONS)
    for (const page of ['dark', 'light'] as const)
      for (const vision of ['standard', 'blue-orange', 'high-contrast'] as const) {
        const t = ct.themeFor(key, vision);
        const light = t.canvas?.light === true;
        const ground: RGB = light ? rgbOf(page === 'light' ? (t.canvas?.bgOnLightPage ?? t.canvas!.bg) : t.canvas!.bg) : t.canvas?.bg ? rgbOf(t.canvas.bg) : tok(DARK_TOK, '--panel');
        const bo = vision === 'blue-orange';
        const gold = light ? (bo ? GOLD.cvdPaper : GOLD.paper) : bo ? GOLD.cvdDark : GOLD.dark;
        const violet = light ? (bo ? VIOLET.cvdPaper : VIOLET.paper) : bo ? VIOLET.cvdDark : VIOLET.dark;
        const lb = lightBlock(vision);
        const token = (n: string): [number, number, number] | null => {
          if (n === '--absorb') return [...gold] as [number, number, number];
          if (n === '--amplify') return [...violet] as [number, number, number];
          return ((light ? lb.get(n) ?? CHART_LIGHT.get(n) : DARK_TOK.get(n)) ?? null) as [number, number, number] | null;
        };
        opts.push({ key, page, vision, light, ground, dir: dirOfTheme(t), gold, violet, token });
      }
  /* the inks a script draws on this option's tape, as the chart hands them to the script layer: the rule's mapper, or
     (before it) the light tape's paper mapper for every script and nothing on a dark tape */
  const mapperFor = (o: Opt, shipped: boolean): ((css: string, kind?: 'line' | 'wash') => string) | undefined =>
    fam.scriptInksWith ? fam.scriptInksWith({ shipped, light: o.light, dir: o.dir, token: o.token }) : o.light ? paperInksWith(o.token) : undefined;
  const asIs = (css: string) => css;

  const floorOf = (o: Opt) => (o.vision === 'blue-orange' ? 0.08 : 0.15);
  /* HELD FOR THE OWNER (the review of the rule, 2026-10-16): the approved inks that clear the ovals under simulated
     tritanopia, or a candle, only with a new hue or a near-black — the family holds no room for them at a small move
     (scripts searched it: RSI, the stochastic's %K, ADX and the lagging span all land on the same few saturated pinks, and
     the paper blues and teals on near-blacks). Each is asserted held, never hidden: printed with its nearest pair and one
     alternative that clears every floor measured alone against today's family; an entry that clears is said, so the list
     only shrinks. Every other ink is held to the floor. */
  interface Held { what: string; alt: string; seen?: boolean; worst?: { d: number; s: string } }
  const HELD_TRITAN = new Map<string, Held>([
    ['#FBACFE', { what: 'RSI (dark)', alt: '#FF7BF1, a deeper pink' }],
    ['#FD98BE', { what: "the stochastic's %K (dark)", alt: '#FE549F, a deeper pink' }],
    ['#FFBCD3', { what: 'ADX (dark)', alt: '#944765, a dark rose' }],
    ['#FCDCFF', { what: "Ichimoku's lagging span (dark)", alt: '#EFF8C6, a pale yellow-green' }],
    ['#768EAE', { what: 'SMA (dark)', alt: '#338377, a teal (clears Foil\'s falling candle too)' }],
    ['#0E6B9E', { what: 'EMA 9 (paper)', alt: '#493285, a purple' }],
    ['#0B726E', { what: 'EMA 50 (paper)', alt: '#0E1DB1, a royal blue' }],
    ['#005282', { what: 'Donchian (paper)', alt: '#3A498A, a slate blue' }],
    ['#5C5663', { what: 'Keltner (paper)', alt: '#191221, a near-black' }],
  ]);
  const HELD_CANDLE = new Map<string, Held>([['#768EAE~#8B84B4', { what: "SMA (dark) against Foil's falling candle", alt: '#338377, a teal (clears the violet under tritanopia too); #6D89A2 clears the candle alone at a 0.036 move but stands 0.045 from the violet under tritanopia' }]]);
  const sideNear: string[] = [];
  const candleNear: string[] = [];
  const dirMiss: string[] = [];
  const cloudMiss: string[] = [];
  const forOwner: string[] = [];
  const rows: string[] = [];
  const seenRow = new Set<string>();
  let dirParts = 0;
  let cloudFills = 0;
  for (const o of opts) {
    const mapShipped = mapperFor(o, true) ?? asIs;
    /* (b) every ink drawn on this tape that is not an oval's and means no direction: the Indicators menu's lines, the
       shipped scripts' own lines (through the chart's mapper), the compare lines and a plot left uncoloured */
    const drawn: { who: string; rgb: RGB }[] = [];
    for (const i of lines) if (i.owner.startsWith('indicator:')) drawn.push({ who: `${i.owner}:${i.part}`, rgb: rgbOf(o.light ? i.paper : i.dark) });
    for (const [slug, r] of runs) {
      const marks = [...r.plots.map(p => ({ t: p.title, cs: [p.ink, ...(p.colors ?? [])] })), ...r.shapes.map(sh => ({ t: sh.title, cs: [sh.ink, ...(sh.colors ?? [])] }))];
      for (const m of marks)
        for (const c of new Set(m.cs)) {
          if (!c || !parseInk(c) || parseInk(c)!.a < 0.6) continue;
          const src = hexOf(rgbOf(c));
          const out = mapShipped(c, 'line');
          /* (c) a direction part: the theme's candle up or down, at the alpha written */
          if (src === BULL_HEX || src === BEAR_HEX) {
            dirParts++;
            const want = src === BULL_HEX ? o.dir.up : o.dir.down;
            if (hexOf(rgbOf(out)) !== hexOf(rgbOf(want)) || Math.abs(parseInk(out)!.a - parseInk(c)!.a) > 0.005) dirMiss.push(`${o.key}/${o.page}/${o.vision} ${slug} ${m.t} ${out} want ${want}`);
            continue;
          }
          if (HOUSE_HEX.has(src)) continue;
          drawn.push({ who: `script:${slug}:${m.t}`, rgb: rgbOf(out) });
        }
      /* the cloud: the candles' up and down at the alpha it was written with */
      if (slug === 'ichimoku')
        for (const f of r.fills)
          for (const c of new Set([f.ink, ...(f.colors ?? [])])) {
            if (!c) continue;
            const src = hexOf(rgbOf(c));
            if (src !== BULL_HEX && src !== BEAR_HEX) continue;
            cloudFills++;
            const out = mapShipped(c, 'wash');
            const want = src === BULL_HEX ? o.dir.up : o.dir.down;
            if (hexOf(rgbOf(out)) !== hexOf(rgbOf(want)) || Math.abs(parseInk(out)!.a - parseInk(c)!.a) > 0.005) cloudMiss.push(`${o.key}/${o.page}/${o.vision} ${out} want ${want} at ${parseInk(c)!.a.toFixed(2)}`);
          }
    }
    for (const c of sideLines) drawn.push({ who: c.name, rgb: rgbOf(o.light ? c.paper : c.dark) });
    for (const v of volLines) drawn.push({ who: `vol ${v.name}`, rgb: rgbOf(o.light ? v.paper : v.dark) });
    /* the measures: each ink against each oval ink, as seen and under each simulation */
    const ovals: [string, RGB][] = [['gold', o.gold], ['violet', o.violet]];
    let nearN = { d: Infinity, s: '' };
    const nearS: Record<Deficiency, { d: number; s: string }> = { protan: { d: Infinity, s: '' }, deutan: { d: Infinity, s: '' }, tritan: { d: Infinity, s: '' } };
    for (const x of drawn)
      for (const [on, ov] of ovals) {
        const dn = distanceUnder(x.rgb, ov);
        if (dn < nearN.d) nearN = { d: dn, s: `${x.who}~${on}` };
        if (dn < floorOf(o)) sideNear.push(`${o.key}/${o.page}/${o.vision} ${x.who} ${hexOf(x.rgb)} ~ ${on} ${dn.toFixed(3)}`);
        for (const k of SIMS) {
          const ds = distanceUnder(x.rgb, ov, k);
          if (ds < nearS[k].d) nearS[k] = { d: ds, s: `${x.who}~${on}` };
          if (ds >= 0.08) continue;
          /* tritanopia, asserted like the others; the inks only a new hue clears are held for the owner (HELD_TRITAN) */
          const held = k === 'tritan' ? HELD_TRITAN.get(hexOf(x.rgb)) : undefined;
          if (held) {
            held.seen = true;
            const w = `${x.who} ${hexOf(x.rgb)} ~ ${on} ${hexOf(ov)} ${ds.toFixed(3)}`;
            if (!held.worst || ds < held.worst.d) held.worst = { d: ds, s: w };
          } else sideNear.push(`${o.key}/${o.page}/${o.vision} ${x.who} ${hexOf(x.rgb)} ~ ${on} ${ds.toFixed(3)} (${k})`);
        }
      }
    /* the candles against the ovals and against the indicator inks — reported, the owner's to decide */
    const candles: [string, RGB][] = [['up', rgbOf(o.dir.up)], ['down', rgbOf(o.dir.down)]];
    let cand = { d: Infinity, s: '' };
    for (const [cn, c] of candles)
      for (const [on, ov] of ovals)
        for (const k of [undefined, ...SIMS] as (Deficiency | undefined)[]) {
          const d = distanceUnder(c, ov, k);
          if (d < cand.d) cand = { d, s: `${cn}~${on}${k ? ` ${k}` : ''}` };
          if (d < (k ? 0.08 : floorOf(o))) forOwner.push(`${o.key}/${o.page === 'light' && o.light ? 'light page' : 'any page'}/${o.vision}: candles ${cn} ${hexOf(c)} ~ oval ${on} ${hexOf(ov)} ${d.toFixed(3)}${k ? ` under ${k}` : ' as seen'}`);
        }
    let indCand = { d: Infinity, s: '' };
    for (const x of drawn)
      for (const [cn, c] of candles) {
        const d = distanceUnder(x.rgb, c);
        if (d < indCand.d) indCand = { d, s: `${x.who}~${cn}` };
        if (d >= 0.05) continue;
        const held = HELD_CANDLE.get(`${hexOf(x.rgb)}~${hexOf(c)}`);
        if (held) {
          held.seen = true;
          held.worst = { d, s: `${x.who} ${hexOf(x.rgb)} ~ ${o.key} ${cn} ${hexOf(c)} ${d.toFixed(3)}` };
        } else candleNear.push(`${o.key}/${o.light ? o.page : '*'}/${o.vision} ${x.who} ${hexOf(x.rgb)} ~ candles ${cn} ${hexOf(c)} ${d.toFixed(3)}`);
      }
    const updown = distanceUnder(rgbOf(o.dir.up), rgbOf(o.dir.down));
    const rowKey = `${o.key}|${o.light ? o.page : '*'}|${o.vision}`;
    if (!seenRow.has(rowKey)) {
      seenRow.add(rowKey);
      rows.push(
        `${o.key.padEnd(8)} ${(o.light ? `${o.page} page` : 'any page').padEnd(10)} ${o.vision.padEnd(13)} up ${hexOf(rgbOf(o.dir.up))} down ${hexOf(rgbOf(o.dir.down))} (apart ${updown.toFixed(3)}) | ink~oval ${nearN.d.toFixed(3)} ${nearN.s}; protan ${nearS.protan.d.toFixed(3)} deutan ${nearS.deutan.d.toFixed(3)} tritan ${nearS.tritan.d.toFixed(3)} ${nearS.tritan.s} | candle~oval ${cand.d.toFixed(3)} ${cand.s} | ink~candle ${indCand.d.toFixed(3)} ${indCand.s}`
      );
    }
  }
  const uniq = <T,>(a: T[]) => [...new Set(a)];
  check(`9a. under every Colours option (${opts.length}: ${ct.CANDLE_THEME_OPTIONS.length} candle themes × 2 page themes × 3 colour visions), every indicator, shipped-script, compare, default-plot and volatility ink as drawn stands the family's floor from that option's two oval inks (0.15 from the house pair, 0.08 from the colour-vision pair) and 0.08 under simulated protanopia, deuteranopia and tritanopia (${HELD_TRITAN.size} held for the owner under tritanopia, below)`, sideNear.length === 0, uniq(sideNear).slice(0, 10).join('; ') + (sideNear.length > 10 ? ` … ${uniq(sideNear).length} in all` : ''));
  check(`9i. every indicator, shipped-script, compare, default-plot and volatility ink as drawn stands 0.05 or more (OKLab) from that option's candle up and down — no line passes for a candle (${opts.length} options; ${HELD_CANDLE.size} pair held for the owner, below)`, candleNear.length === 0, uniq(candleNear).slice(0, 10).join('; ') + (candleNear.length > 10 ? ` … ${uniq(candleNear).length} in all` : ''));
  const cleared = [...HELD_TRITAN, ...HELD_CANDLE].filter(([, h]) => !h.seen).map(([k, h]) => `${h.what} ${k}`);
  check(`9a′. the held list only shrinks: every ink held for the owner still stands under its floor somewhere (an ink that clears comes off the list)`, cleared.length === 0, cleared.length ? `clears now: ${cleared.join('; ')}` : '');
  check(`9b. every shipped script's up and down part (Supertrend, the SAR, ADX's ±DI, Ichimoku's spans — ${dirParts} parts over every option) is the theme's candle up and down, at the alpha written`, dirParts > 0 && dirMiss.length === 0, uniq(dirMiss).slice(0, 8).join('; ') + (dirMiss.length > 8 ? ` … ${uniq(dirMiss).length} in all` : ''));
  /* the walls a shipped script draws are the ovals' own pair on that tape, in the reader's colour vision */
  const wallMiss: string[] = [];
  for (const o of opts) {
    const m = mapperFor(o, true) ?? asIs;
    for (const [nm, ink, want] of [['call wall', CALL_WALL, o.gold], ['put wall', PUT_WALL, o.violet]] as const) {
      const out = m(ink, 'line');
      if (hexOf(rgbOf(out)) !== hexOf(want)) wallMiss.push(`${o.key}/${o.page}/${o.vision} ${nm} ${out} want ${hexOf(want)}`);
    }
  }
  check(`9b′. a shipped script's walls are the ovals' own pair on every tape and colour vision (the gold and violet the field draws there)`, wallMiss.length === 0, uniq(wallMiss).slice(0, 6).join('; ') + (wallMiss.length > 6 ? ` … ${uniq(wallMiss).length} in all` : ''));
  check(`9c. the Ichimoku cloud's two fills are the candles' up and down at its alpha (${cloudFills} fills over every option), never a fixed red or green`, cloudFills > 0 && cloudMiss.length === 0, uniq(cloudMiss).slice(0, 6).join('; '));
  /* the built-in's direction part: the MACD's bars, drawn by StrikeChart in the candles' up and down */
  const macdBlock = /^ {2}macd: \{[\s\S]*?^ {2}\},?$/m.exec(partsBlock)?.[0] ?? '';
  const histDir = /part: 'hist', kind: 'hist', dir: true/.test(macdBlock) && !/part: 'hist'[^}]*ink:/.test(macdBlock);
  const readsCandles = /const dir = candleDirInks\(themeRef\.current\);\s*const dirUp = withAlpha\(dir\.up, DIR_WASH_ALPHA\);\s*const dirDown = withAlpha\(dir\.down, DIR_WASH_ALPHA\);/.test(strike);
  const flowReads = (strike.match(/candleDirInks\(themeRef\.current\)/g) ?? []).length;
  check(`9d. the chart's own up and down read the candles: the MACD's bars a direction part (${histDir ? 'dir, no ink' : 'a fixed ink'}), drawn in candleDirInks at DIR_WASH_ALPHA; the flow legs, the drift lines and the baseline style too (${flowReads} reads, ${/topLineColor: '#30D158'|FLOW_CALL_INK = BULL|DRIFT_CALL_INK = BULL/.test(strike) ? 'the house green and red still written' : 'no house pair written'})`, histDir && readsCandles && flowReads >= 4 && !/topLineColor: '#30D158'|FLOW_CALL_INK = BULL|DRIFT_CALL_INK = BULL/.test(strike));
  /* a reader's own script keeps the colours its code sets; a plot it left uncoloured wears the family's default */
  const own = runOf(`//@version=6
indicator("Mine", overlay = true)
plot(close, "Up", color = ${BULL})
plot(open, "Wall", color = ${CALL_WALL})
plot(high, "Plain")
fill(plot(low, "Lo", color = ${BEAR}), plot(low - 1, "Lo2", color = ${BEAR}), color = color.new(${BULL}, 80))`);
  const ownMiss: string[] = [];
  const defaultInk = fam.DEFAULT_PLOT_INK;
  for (const o of opts) {
    const m = mapperFor(o, false) ?? asIs;
    for (const p of own.plots) {
      const out = m(p.ink, 'line');
      const isDefault = !!defaultInk && hexOf(rgbOf(p.ink)) === hexOf(rgbOf(defaultInk));
      const want = isDefault && o.light ? defaultPair?.paper ?? p.ink : p.ink;
      if (hexOf(rgbOf(out)) !== hexOf(rgbOf(want))) ownMiss.push(`${o.key}/${o.page}/${o.vision} ${p.title} ${p.ink} → ${out}`);
    }
    for (const f of own.fills) {
      const out = m(f.ink, 'wash');
      if (out !== f.ink && hexOf(rgbOf(out)) !== hexOf(rgbOf(f.ink))) ownMiss.push(`${o.key}/${o.page}/${o.vision} fill ${f.ink} → ${out}`);
    }
  }
  check('9e. a reader\'s own script keeps the colours its code sets on every tape — its green, its gold, its wash — and only a plot it left uncoloured takes its light pair on a light tape', ownMiss.length === 0, uniq(ownMiss).slice(0, 6).join('; '));
  const plain = own.plots.find(p => p.title === 'Plain')?.ink ?? '';
  const shape = runOf(`//@version=6
indicator("Marks", overlay = true)
plotshape(close > open, "Rise")`).shapes[0]?.ink ?? '';
  const isFamily = INK_PAIRS.some(p => p.name === 'plot:default' && hexOf(rgbOf(p.dark)) === hexOf(rgbOf(plain)));
  const violetGap = plain ? distanceUnder(rgbOf(plain), VIOLET.dark) : 0;
  check(`9f. a plot and a shape given no colour wear the family's default (${plain} and ${shape}; ${violetGap.toFixed(3)} from the field's violet), never the old blue #5B9CF6 near the violet`, isFamily && hexOf(rgbOf(shape)) === hexOf(rgbOf(plain)) && violetGap >= 0.15 && hexOf(rgbOf(plain)) !== '#5B9CF6');
  const localLists = ['src/pages/terrain/Terrain.tsx', 'src/pages/workspace/LiveChartWidget.tsx'].filter(f => /const COMPARE_INKS = \[/.test(read(f)));
  /* no compare line and no uncoloured plot is a candle: 0.05 or more from every theme's up and down, as drawn on its tape
     (the lavender and the cream were Whipsaw's and Harbor's rising candles to the digit) */
  const onCandle: string[] = [];
  let minOnCandle = Infinity;
  for (const o of opts)
    for (const c of sideLines)
      for (const [cn, cd] of [['up', o.dir.up], ['down', o.dir.down]] as const) {
        const d = distanceUnder(rgbOf(o.light ? c.paper : c.dark), rgbOf(cd));
        minOnCandle = Math.min(minOnCandle, d);
        if (d < 0.05) onCandle.push(`${c.name} ${o.light ? c.paper : c.dark} ~ ${o.key} ${cn} ${cd} ${d.toFixed(3)}`);
      }
  check(`9g′. no compare line and no uncoloured plot wears a candle's ink: 0.05 or more from every theme's up and down under every option (nearest ${minOnCandle.toFixed(3)})`, onCandle.length === 0, uniq(onCandle).slice(0, 6).join('; '));
  const blueLeft = COMPARE.map(c => ({ c, d: distanceUnder(rgbOf(c), VIOLET.dark) })).filter(x => x.d < 0.15);
  check(`9g. the compare lines are the family's (${famCompare.length} pairs; ${localLists.length ? `own lists still in ${localLists.join(', ')}` : 'no list of their own on a page'}), none within 0.15 of the field's violet (${COMPARE.map(c => `${c} ${distanceUnder(rgbOf(c), VIOLET.dark).toFixed(3)}`).join(', ')})`, famCompare.length === 4 && localLists.length === 0 && blueLeft.length === 0);
  /* the rails' Colours (House, Thermal) move the ladder alone: the ovals read the gamma pair, never the ladder's pick */
  const nodesSrc = read('src/components/gex/gexNodesPrimitive.ts');
  check("9h. the rails' Colours (House, Thermal) leave the ovals' inks as they are — the ovals read the gamma pair (heatmap HEAT_MODE), never the ladder's pick", /heatRampColorFor\(1, 1, HEAT_MODE/.test(nodesSrc) && !/thermal|ProfilePalette/i.test(nodesSrc));
  /* THE VOLATILITY PANE'S RV AND IV (the review of the rule, 2026-10-16: "Everything else uses the indicator palette, kept
     clear of the ovals' colours" — they were Whipsaw's and Harbor's rising candles to the digit, with no light pair): the
     family's pairs, drawn by StrikeChart through them, apart from each other, the house's inks and every other ink */
  const volMiss: string[] = [];
  if (volPairs.length !== 2) volMiss.push(`no family pairs (StrikeChart's own ${volLines.map(v => `${v.name} ${v.dark}`).join(', ')}, no light pair)`);
  if (/const (RV|IV)_INK = '/.test(strike)) volMiss.push('StrikeChart writes its own RV_INK / IV_INK');
  if (!/paperInk\(RV_INK\)/.test(strike) || !/paperInk\(IV_INK\)/.test(strike)) volMiss.push('no paper pair drawn on a light tape');
  if (volLines.length === 2) {
    const [rv, iv] = volLines;
    for (const g of ['dark', 'paper'] as const) {
      const d = distanceUnder(rgbOf(rv[g]), rgbOf(iv[g]));
      if (d < 0.08) volMiss.push(`RV ~ IV ${g} ${d.toFixed(3)}`);
    }
    for (const v of volLines) {
      for (const [name, d, p2] of houseInks) {
        const dd = dE(rgbOf(v.dark), d);
        const pp = dE(rgbOf(v.paper), p2);
        if (dd < 0.08 || pp < 0.08) volMiss.push(`${v.name} ~ ${name} ${dd.toFixed(3)}/${pp.toFixed(3)}`);
      }
      for (const g of DARK_GROUNDS) if (contrast(rgbOf(v.dark), g) < 3) volMiss.push(`${v.name} ${v.dark} ${contrast(rgbOf(v.dark), g).toFixed(2)}:1 on ${hexOf(g)}`);
      if (contrast(rgbOf(v.paper), STONE_DARK_PAGE) < 3) volMiss.push(`${v.name} paper ${v.paper} ${contrast(rgbOf(v.paper), STONE_DARK_PAGE).toFixed(2)}:1 on ${hexOf(STONE_DARK_PAGE)}`);
      for (const [ground, css] of [['dark', v.dark], ['paper', v.paper]] as const) {
        const gp = dirGap(rgbOf(css), ground);
        if (gp && gp.gap < 30) volMiss.push(`${v.name} ${css} ${gp.gap.toFixed(0)}° from ${gp.to}`);
      }
      for (const f of INK_PAIRS.filter(q => !q.wash && !q.name.startsWith('vol:')))
        for (const g of ['dark', 'paper'] as const) {
          const d = distanceUnder(rgbOf(v[g]), rgbOf(f[g]));
          if (d < 0.05) volMiss.push(`${v.name} ~ ${f.name} ${g} ${d.toFixed(3)}`);
        }
    }
  }
  check(`9j. the volatility pane's RV and IV are the family's (${volLines.map(v => `${v.name} ${v.dark}/${v.paper}`).join(', ')}): a pair for a light tape each, 0.08 apart and from the house's inks, 0.05 from every other ink, 3:1 on every dark tape and on Stone, no direction hue — and off the ovals and the candles in 9a and 9i`, volMiss.length === 0, uniq(volMiss).slice(0, 8).join('; '));
  console.log('\n      THE CLOSEST PAIRS UNDER EVERY COLOURS OPTION (OKLab; "any page": a dark tape is the same island on either page)');
  for (const r of rows) console.log(`      ${r}`);
  console.log(`\n      HELD FOR THE OWNER — the family's approved inks that clear the ovals under simulated tritanopia, or a candle, only with a new hue (${HELD_TRITAN.size + HELD_CANDLE.size}; each nearest pair, then one alternative that clears every floor measured alone):`);
  for (const [how, list] of [['under tritanopia', HELD_TRITAN], ['as seen', HELD_CANDLE]] as const) for (const [, h] of list) console.log(`        ${h.what}: ${h.worst ? h.worst.s : 'clear'} (${how}) — alternative ${h.alt}`);
  const owner = uniq(forOwner);
  console.log(`\n      FOR THE OWNER — the candles against the ovals under the floor (the oval pair and the candle themes are left as they are; ${owner.length} pairs):`);
  for (const l of owner) console.log(`        ${l}`);
  /* WHAT THE RULE LEAVES OPEN (the review of the rule, 2026-10-16 — reported, the owner's to decide; the candle themes are
     left as they are): a direction line drawn in the candles' up or down reads under 3:1 on its own ground where the
     candle ink is dark on a dark tape or pale on a light one (it was the house pair or the tape's tokens at 3:1 or better
     before the rule), the MACD's bars at DIR_WASH_ALPHA fainter still; and a theme whose up and down are one ink (Wire)
     cannot tell ±DI, the cloud's two fills, the MACD's bars or the drift lines apart by colour. One alternative each: the
     line lifted (or deepened) to 3:1 on its ground at the candle's own hue, the candle left as it is; for one ink, the down
     part dashed or hollow. */
  const fromOklab = ([L, a, b]: number[]): RGB => {
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s2 = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    const lin3 = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s2, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s2, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s2];
    return lin3.map(v => Math.round(Math.max(0, Math.min(1, v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)) * 255)) as RGB;
  };
  const liftTo3 = (rgb: RGB, ground: RGB): RGB | null => {
    const [L0, a, b] = oklab(rgb);
    const up = lum(ground) < 0.18;
    for (let L = L0; L >= 0 && L <= 1; L += up ? 0.005 : -0.005) {
      const c = fromOklab([L, a, b]);
      if (contrast(c, ground) >= 3) return c;
    }
    return null;
  };
  const open: string[] = [];
  const oneInk: string[] = [];
  const seenOpen = new Set<string>();
  for (const o of opts) {
    if (o.vision === 'high-contrast') continue;
    /* a theme the blue-and-orange cut leaves alone is one row */
    const once = `${o.key}|${o.light ? o.page : ''}|${hexOf(rgbOf(o.dir.up))}|${hexOf(rgbOf(o.dir.down))}`;
    if (seenOpen.has(once)) continue;
    seenOpen.add(once);
    const tag = `${o.key}${o.light ? ` on the ${o.page} page` : ''}${o.vision === 'blue-orange' ? ' under blue and orange' : ''}`;
    if (hexOf(rgbOf(o.dir.up)) === hexOf(rgbOf(o.dir.down))) oneInk.push(`${tag}: up and down both ${hexOf(rgbOf(o.dir.up))} — alternative: the down part dashed (lines) or hollow (bars), the cloud's falling fill a hatch`);
    for (const [k, css] of [['up', o.dir.up], ['down', o.dir.down]] as const) {
      const c = rgbOf(css);
      const line = contrast(c, o.ground);
      const bars = contrast(over(`rgba(${c.join(', ')}, 0.6)`, o.ground), o.ground);
      if (line >= 3) continue;
      const alt = liftTo3(c, o.ground);
      open.push(`${tag} (${hexOf(o.ground)}): ${k} ${hexOf(c)} ${line.toFixed(2)}:1 as a line, ${bars.toFixed(2)}:1 as the MACD's bars at 0.6 — alternative ${alt ? `${hexOf(alt)} ${contrast(alt, o.ground).toFixed(2)}:1, the line at the candle's hue` : 'none at its hue'}`);
    }
  }
  console.log(`\n      WHAT THE RULE LEAVES OPEN — direction lines in the candles' inks under 3:1 on their own ground (${open.length}), and themes with one ink for up and down (${oneInk.length}):`);
  for (const l of [...open, ...oneInk]) console.log(`        ${l}`);
}

/* ---- the chart draws the family: no ink of its own in INDICATOR_PARTS ------------------------------------------- */
const literal = [...partsBlock.matchAll(/ink: '([^']+)'/g)].map(m => m[1]);
check("StrikeChart's indicators take their inks from the family (no literal in INDICATOR_PARTS, no INDICATOR_INKS of its own)", literal.length === 0 && !localLead && !localLight && /from '\.\/indicatorInks'/.test(strike), [literal.length ? `literals ${literal.join(' ')}` : '', localLead ? 'INDICATOR_INKS defined in StrikeChart' : '', localLight ? 'INDICATOR_INKS_LIGHT defined in StrikeChart' : ''].filter(Boolean).join('; '));
check(`the family lists every pair it hands out (${INK_PAIRS.length})`, INK_PAIRS.every(p => !!parseInk(p.dark) && !!parseInk(p.paper)));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
