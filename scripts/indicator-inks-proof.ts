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
       direction pair — the one a script's lines read off the box — is the reader's light pair, not the dark island's,
       outranks the dark island's set, and reads 3:1 (high contrast: its words 7:1) on the darkest light tape; a dark
       tape's chrome takes the reader's dark set.
*/
import { readFileSync } from 'node:fs';
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

/* the compare lines' inks (Terrain and the Pulse widget hand them out; neither has a light pair) */
const compareOf = (p: string) => JSON.parse((/const COMPARE_INKS = (\[[^\]]*\])/.exec(read(p))![1]).replace(/'/g, '"')) as string[];
const COMPARE = [...new Set([...compareOf('src/pages/terrain/Terrain.tsx'), ...compareOf('src/pages/workspace/LiveChartWidget.tsx')])];

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

const nearCompare: string[] = [];
for (const i of lines)
  for (const c of COMPARE) {
    const dd = dE(rgbOf(i.dark), rgbOf(c));
    /* a compare line has no light pair: it is drawn in the same hex on a light tape */
    const pp = dE(rgbOf(i.paper), rgbOf(c));
    if (dd < 0.08 || pp < 0.08) nearCompare.push(`${i.owner} ${i.part} ${i.dark} ~ compare ${c} ${Math.min(dd, pp).toFixed(3)}`);
  }
check(`every ink 0.08 or more from the compare lines' ${COMPARE.join(' ')}`, nearCompare.length === 0, nearCompare.slice(0, 10).join('; '));

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
for (const [name, d] of houseInks.slice(0, 7)) {
  const mapped = rgbOf(toPaper(hexOf(d)));
  const onPage = contrast(mapped, STONE_LIGHT_PAGE);
  const onDarkPage = contrast(mapped, STONE_DARK_PAGE);
  houseNotes.push(`${name} ${hexOf(mapped)} ${onPage.toFixed(2)}:1 (${onDarkPage.toFixed(2)}:1 on Stone on a dark page)`);
  if (hexOf(mapped) === hexOf(d)) houseLight.push(`${name} not mapped`);
  else if (onPage < 3) houseLight.push(`${name} ${onPage.toFixed(2)}:1`);
}
check(`a shipped script's house inks take the paper tokens on a light tape and read 3:1 or better on the light page's tape ${hexOf(STONE_LIGHT_PAGE)}`, houseLight.length === 0, houseLight.join('; '));
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
check("the kept copies draw the chart built-in's own inks", inkMiss.length === 0, inkMiss.map(s => `${s}: ${keptInk(s).join(' ')} want ${want[s].map(c => hexOf(rgbOf(c))).join(' ')}`).join('; '));

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
check('no shipped script but the Ichimoku cloud paints a red or green wash (by hue)', redGreen.length >= 1 && redGreen.every(w => w.slug === 'ichimoku'), redGreen.filter(w => w.slug !== 'ichimoku').map(w => `${w.slug} ${w.what}: ${w.hit.slice(0, 2).join(', ')}`).join('; '));

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
/* a shipped script's direction lines on a blue-and-orange light tape: the reader's light pair, read 3:1 on the tape */
{
  const light = blockAt(indexCss, ":root[data-cvd='blue-orange'] [data-chart-ground='light'] :is(");
  /* as the chart reads them off its box: the light set, then the reader's (or, before the review, the dark island's) */
  const boxTok = (name: string): RGB | null => (name === '--absorb' || name === '--amplify' ? CVD_PAPER.get(name) : name === '--bull' || name === '--bear' ? (light?.tok.get(name) ?? CVD_DARK.get(name)) : CHART_LIGHT.get(name)) ?? null;
  const cvdPaper = paperInksWith(boxTok);
  const notes: string[] = [];
  let ok = true;
  for (const [name, ink] of [['up', BULL], ['down', BEAR]] as const) {
    const drawn = rgbOf(cvdPaper(ink));
    const c = contrast(drawn, STONE_DARK_PAGE);
    notes.push(`${name} ${hexOf(drawn)} ${c.toFixed(2)}:1`);
    if (c < 3) ok = false;
  }
  check(`under blue-orange, Supertrend's, SAR's, ±DI's and the Ichimoku spans' direction lines on a light tape read 3:1 or better on ${hexOf(STONE_DARK_PAGE)}`, ok, notes.join('; '));
  info(`blue-orange light tape: ${notes.join('; ')}`);
}

/* ---- the chart draws the family: no ink of its own in INDICATOR_PARTS ------------------------------------------- */
const literal = [...partsBlock.matchAll(/ink: '([^']+)'/g)].map(m => m[1]);
check("StrikeChart's indicators take their inks from the family (no literal in INDICATOR_PARTS, no INDICATOR_INKS of its own)", literal.length === 0 && !localLead && !localLight && /from '\.\/indicatorInks'/.test(strike), [literal.length ? `literals ${literal.join(' ')}` : '', localLead ? 'INDICATOR_INKS defined in StrikeChart' : '', localLight ? 'INDICATOR_INKS_LIGHT defined in StrikeChart' : ''].filter(Boolean).join('; '));
check(`the family lists every pair it hands out (${INK_PAIRS.length})`, INK_PAIRS.every(p => !!parseInk(p.dark) && !!parseInk(p.paper)));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
