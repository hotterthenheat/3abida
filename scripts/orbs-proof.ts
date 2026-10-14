/*
  THE ORBS' PROOF (scripts/orbs-proof.ts, in `npm test`) — the owner's message of 2026-10-14, "NODES: SKYLIT-STYLE ORBS,
  DONE BETTER", held to its numbers:
    1. THE WALL WITH HYSTERESIS (item 13, trailModel WallStick): the owner's 9:50 / 9:58 / 10:04 flip-flop — a price
       dipping through the put wall's strike for two minutes and back moves nothing; three closed minutes below moves it;
       a strike 5% heavier never takes a standing wall, 12% heavier does after three minutes; a new day starts over; and
       this machine's recorded SPY day (2026-10-14, final rows) counted raw against the rule.
    2. THE OVAL'S MEASURES: d = 3 px + (85% row − 3 px) × √(min(size ÷ reference, 1)); the width cap; the merge of
       candles under 6 px; opacity 0.55 → 1.
    3. THE COLOURS: gold absorbs, violet amplifies — the paper tokens at 3:1 or better on the paper panel and canvas; the
       dark violet darker than the supreme's magenta; gold and violet apart from blue-and-orange candles under simulated
       protanopia, deuteranopia and tritanopia on the dark ground (and the paper distances printed, where they close up).
    4. THE LEGEND'S WORDS and the hit of the renderer's constants.
*/
import { existsSync, readFileSync } from 'node:fs';
import { WallStick, WALL_STICK, stickyWallMoves, stickyWalls, wallObsOf } from '../src/data/feed/trailModel';
import { HOVER_KEEP, NODE_LABELS, OVAL_ALPHA_MIN, OVAL_MERGE_CSS, OVAL_MIN_CSS, OVAL_OUTLINE_MIN_CSS, OVAL_ROW_SHARE, PIN_KEEP, TOP_NODES, mergeBars, optimalCandlestickWidth, ovalAlpha, ovalDiameter } from '../src/components/gex/gexNodesPrimitive';
import { beadLegendLines } from '../src/components/terrain/beadLegend';
import type { StoreRow } from '../server/fieldStore';

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (ok) pass++;
  else fail++;
};
const near = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol;

/* ---- 1. the wall with hysteresis ------------------------------------------------------------------------------- */
{
  /* the owner's scenario: SPY near 770; the put wall 770 (|g| 1.5) with 765 beside it (|g| 1.0); the price dips under
     770 at 9:50 for two minutes, comes back, dips again at 9:58 for three closed minutes */
  const t0 = Date.UTC(2026, 9, 14, 13, 45); // 9:45 am New York
  const levels = (spot: number) => [
    { strike: 760, value: 0.4e9 },
    { strike: 765, value: 1.0e9 },
    { strike: 770, value: 1.5e9 },
    { strike: 775, value: -0.8e9 },
    { strike: 780, value: -2.0e9 },
  ].map(l => ({ ...l, spot }));
  const path: number[] = [];
  for (let i = 0; i < 30; i++) {
    const m = 45 + i; // 9:45 .. 10:14
    let spot = 771.2;
    if (m === 50 || m === 51) spot = 769.8; // two minutes under 770
    if (m >= 58 && m <= 60) spot = 769.7; // three closed minutes under 770
    if (m >= 61 && m <= 63) spot = 769.9; // and three more
    path.push(spot);
  }
  const obs = path.map((spot, i) => wallObsOf((t0 + i * 60_000) / 1000, spot, levels(spot)));
  const raw = obs.map(o => o.pw);
  const shown = stickyWalls(obs);
  const rawMoves = raw.filter((w, i) => i > 0 && w !== raw[i - 1]).length;
  const moves = stickyWallMoves(obs.length, i => ({ cw: shown.cw[i], pw: shown.pw[i], time: obs[i].time }));
  const nyMin = (t: number) => Math.round((t * 1000 - t0) / 60_000) + 45;
  const said = moves.map(m => `${m.kind} ${m.from} → ${m.to} at ${Math.floor(nyMin(m.time) / 60) + 9}:${String(nyMin(m.time) % 60).padStart(2, '0')}`).join(', ');
  /* the two-minute dip moves nothing; the three-closed-minute dip moves the wall to 765 at 10:00; and when the price stands
     back over 770 — 1.5× the gamma at 765 — the owner's rule returns the wall to 770 three closed minutes later (10:06): the
     rule as asked slows a flip-flop, it does not forbid a heavier strike that re-qualifies */
  check(`the raw pick flips with the price (${rawMoves} changes in 30 minutes); the wall shown moves twice — 770 → 765 after three closed minutes under 770, back once 770 has stood three minutes over the price again (${said})`, rawMoves >= 4 && moves.length === 2 && moves[0].kind === 'PW' && moves[0].from === 770 && moves[0].to === 765 && nyMin(moves[0].time) === 60 && moves[1].from === 765 && moves[1].to === 770 && nyMin(moves[1].time) === 66);
  /* a wall that still stands gives way only to a strike 10% heavier that has stood three minutes */
  const stick = new WallStick();
  const t1 = Date.UTC(2026, 9, 14, 15, 0) / 1000;
  const wobble = (heavy: number, minutes: number): (number | null)[] => {
    const out: (number | null)[] = [];
    for (let i = 0; i < minutes; i++) {
      const lv = [
        { strike: 770, value: 1.0e9 },
        { strike: 765, value: i >= 3 ? heavy * 1.0e9 : 0.5e9 },
        { strike: 780, value: -1.0e9 },
      ];
      out.push(stick.next(wallObsOf(t1 + i * 60, 775, lv)).pw);
    }
    return out;
  };
  const five = wobble(1.05, 12);
  check(`a neighbour 5% heavier (under WALL_STICK.ratio ${WALL_STICK.ratio}) never takes a wall that stands: ${five.join(' ')}`, five.every(w => w === 770));
  const stick2 = new WallStick();
  const twelve: (number | null)[] = [];
  for (let i = 0; i < 8; i++) twelve.push(stick2.next(wallObsOf(t1 + i * 60, 775, [{ strike: 770, value: 1.0e9 }, { strike: 765, value: i >= 2 ? 1.12e9 : 0.5e9 }, { strike: 780, value: -1.0e9 }])).pw);
  check(`one 12% heavier takes it on its third closed minute as the raw pick (from minute 2: shown ${twelve.join(' ')})`, twelve.slice(0, 4).every(w => w === 770) && twelve.slice(4).every(w => w === 765));
  /* a new New York day starts over: the first raw pick of the day is the wall at once */
  const stick3 = new WallStick();
  const d1 = Date.UTC(2026, 9, 13, 19, 59) / 1000; // 3:59 pm Oct 13
  const d2 = Date.UTC(2026, 9, 14, 13, 30) / 1000; // 9:30 am Oct 14
  const a = stick3.next(wallObsOf(d1, 775, [{ strike: 770, value: 1e9 }, { strike: 780, value: -1e9 }]));
  const b = stick3.next(wallObsOf(d2, 775, [{ strike: 765, value: 1e9 }, { strike: 770, value: 0.2e9 }, { strike: 780, value: -1e9 }]));
  check(`a new day starts the stick over (Oct 13 close PW ${a.pw}; Oct 14 open PW ${b.pw} at once)`, a.pw === 770 && b.pw === 765);
  /* this machine's day: the recorded final rows, raw against the rule */
  const file = '.feed-cache/field/SPY/2026-10-14/final.jsonl';
  if (existsSync(file)) {
    const rows = readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l) as StoreRow).sort((x, y) => x.m - y.m);
    const o = rows.map(r => {
      const at = new Map<number, number>();
      for (const c of r.cells) at.set(c[0], c[1]);
      return { time: r.m / 1000, spot: r.spot, cw: r.cw, pw: r.pw, valueOf: (k: number) => at.get(k) ?? NaN };
    });
    const rawPw = rows.filter((r, i) => i > 0 && r.pw !== rows[i - 1].pw).length;
    const rawCw = rows.filter((r, i) => i > 0 && r.cw !== rows[i - 1].cw).length;
    const sw = stickyWalls(o);
    const mv = stickyWallMoves(o.length, i => ({ cw: sw.cw[i], pw: sw.pw[i], time: o[i].time }));
    const toNy = (t: number) => new Date(t * 1000).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' });
    console.log(`      SPY 2026-10-14 on this machine, ${rows.length} final rows ${toNy(o[0].time)}–${toNy(o[o.length - 1].time)}: raw put-wall changes ${rawPw}, call-wall ${rawCw}; with the rule ${mv.length} move${mv.length === 1 ? '' : 's'}: ${mv.map(m => `${m.kind} ${m.from} → ${m.to} ${toNy(m.time)}`).join(', ') || 'none'}`);
    check(`on this machine's recorded day the rule leaves fewer moves than the raw pick (${mv.length} of ${rawPw + rawCw})`, mv.length < rawPw + rawCw);
  } else console.log('      (no recorded SPY day on this machine to count)');
}

/* ---- 2. the oval's measures ------------------------------------------------------------------------------------ */
{
  check(`d at size 0 is ${OVAL_MIN_CSS} px on any row; at size 1 it is 85% of the row (row 20 → ${ovalDiameter(1, 20)} px; row 2 → ${ovalDiameter(1, 2)} px, never under ${OVAL_MIN_CSS})`, ovalDiameter(0, 20) === OVAL_MIN_CSS && near(ovalDiameter(1, 20), 17) && ovalDiameter(1, 2) === OVAL_MIN_CSS && near(OVAL_ROW_SHARE, 0.85));
  check(`d grows on the √ scale: at a quarter of the reference (√ = 0.5) it stands halfway (row 20 → ${ovalDiameter(0.5, 20)} px)`, near(ovalDiameter(0.5, 20), 10));
  check(`candles merge under ${OVAL_MERGE_CSS} px: spacing 6 → 1 bar, 3 → ${mergeBars(3)} bars (a ${3 * mergeBars(3)} px group), 1.5 → ${mergeBars(1.5)} bars, 0.8 → ${mergeBars(0.8)}`, mergeBars(6) === 1 && mergeBars(8) === 1 && mergeBars(3) === 3 && mergeBars(1.5) === 5 && mergeBars(0.8) === 9 && [3, 1.5, 0.8].every(sp => sp * mergeBars(sp) - 1 >= OVAL_MERGE_CSS));
  check(`opacity ${OVAL_ALPHA_MIN} at size 0, 1 at full, on the same √ (0.5 → ${ovalAlpha(0.5)})`, ovalAlpha(0) === OVAL_ALPHA_MIN && ovalAlpha(1) === 1 && near(ovalAlpha(0.5), 0.775));
  check(`the renderer's constants: ${TOP_NODES} nodes a candle plus the walls, ${NODE_LABELS} pills, the outline from ${OVAL_OUTLINE_MIN_CSS} px, the rest at ${HOVER_KEEP * 100}% under a hover and ${PIN_KEEP * 100}% under a pin`, TOP_NODES === 5 && NODE_LABELS === 3 && OVAL_OUTLINE_MIN_CSS === 6 && HOVER_KEEP === 0.6 && PIN_KEEP === 0.4);
  /* the library's own body width, so the candles' edge lands on the body drawn */
  check(`the candle body width follows lightweight-charts' optimalCandlestickWidth (spacing 3 → ${optimalCandlestickWidth(3, 1)}, 6 → ${optimalCandlestickWidth(6, 1)}, 12 → ${optimalCandlestickWidth(12, 1)}, 12 at 2× → ${optimalCandlestickWidth(12, 2)})`, optimalCandlestickWidth(3, 1) === 3 && optimalCandlestickWidth(6, 1) === 5 && optimalCandlestickWidth(12, 1) === 9 && optimalCandlestickWidth(12, 2) === 19);
}

/* ---- 3. the colours -------------------------------------------------------------------------------------------- */
{
  const css = readFileSync('src/theme/tokens.css', 'utf8');
  const token = (block: string, name: string): [number, number, number] => {
    const m = new RegExp(`${block}[\\s\\S]*?--${name}:\\s*(\\d+)\\s+(\\d+)\\s+(\\d+)`).exec(css);
    if (!m) throw new Error(`no --${name} after ${block}`);
    return [Number(m[1]), Number(m[2]), Number(m[3])];
  };
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const lum = (c: readonly number[]) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const contrast = (a: readonly number[], b: readonly number[]) => {
    const [x, y] = [lum(a), lum(b)];
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };
  const oklab = (l3: readonly number[]) => {
    const [r, g, b] = l3;
    const L = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const M = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const S = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * L + 0.793617785 * M - 0.0040720468 * S, 1.9779984951 * L - 2.428592205 * M + 0.4505937099 * S, 0.0259040371 * L + 0.7827717662 * M - 0.808675766 * S];
  };
  const toLin = (rgb: readonly number[]) => rgb.map(lin);
  const dist = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const M: Record<string, number[][]> = {
    protan: [
      [0.152286, 1.052583, -0.204868],
      [0.114503, 0.786281, 0.099216],
      [-0.003882, -0.048116, 1.051998],
    ],
    deutan: [
      [0.367322, 0.860646, -0.227968],
      [0.280085, 0.672501, 0.047413],
      [-0.01182, 0.04294, 0.968881],
    ],
    tritan: [
      [1.255528, -0.076749, -0.178779],
      [-0.078411, 0.930809, 0.147602],
      [0.004733, 0.691367, 0.3039],
    ],
  };
  const sim = (rgb: readonly number[], m: number[][]) => {
    const l = toLin(rgb);
    return m.map(row => Math.max(0, Math.min(1, row[0] * l[0] + row[1] * l[1] + row[2] * l[2])));
  };
  const apart = (a: readonly number[], b: readonly number[]) => Object.fromEntries(Object.entries(M).map(([k, m]) => [k, dist(oklab(sim(a, m)), oklab(sim(b, m)))])) as Record<string, number>;
  const f3 = (x: number) => x.toFixed(3);
  const darkAbsorb = token("\\[data-theme='dark'\\]", 'absorb');
  const darkAmplify = token("\\[data-theme='dark'\\]", 'amplify');
  const darkSupreme = token("\\[data-theme='dark'\\]", 'supreme');
  const darkPanel = token("\\[data-theme='dark'\\]", 'panel');
  const lightAbsorb = token("\\[data-theme='light'\\]", 'absorb');
  const lightAmplify = token("\\[data-theme='light'\\]", 'amplify');
  const lightPanel = token("\\[data-theme='light'\\]", 'panel');
  const lightCanvas = token("\\[data-theme='light'\\]", 'canvas');
  const cvdDark = { absorb: token("data-cvd='blue-orange'\\]", 'absorb'), amplify: token("data-cvd='blue-orange'\\]", 'amplify'), bull: token("data-cvd='blue-orange'\\]", 'bull'), bear: token("data-cvd='blue-orange'\\]", 'bear') };
  const cvdLight = { absorb: token("data-cvd='blue-orange'\\]\\[data-theme='light'\\]", 'absorb'), amplify: token("data-cvd='blue-orange'\\]\\[data-theme='light'\\]", 'amplify'), bull: token("data-cvd='blue-orange'\\]\\[data-theme='light'\\]", 'bull'), bear: token("data-cvd='blue-orange'\\]\\[data-theme='light'\\]", 'bear') };
  const pAbsorbPanel = contrast(lightAbsorb, lightPanel);
  const pAbsorbCanvas = contrast(lightAbsorb, lightCanvas);
  const pAmplifyPanel = contrast(lightAmplify, lightPanel);
  const pAmplifyCanvas = contrast(lightAmplify, lightCanvas);
  check(`the paper pair reads at 3:1 or better on the paper panel and canvas (gold ${pAbsorbPanel.toFixed(2)} / ${pAbsorbCanvas.toFixed(2)}, violet ${pAmplifyPanel.toFixed(2)} / ${pAmplifyCanvas.toFixed(2)})`, pAbsorbPanel >= 3 && pAbsorbCanvas >= 3 && pAmplifyPanel >= 3 && pAmplifyCanvas >= 3);
  check(`the dark pair on the dark panel: gold ${contrast(darkAbsorb, darkPanel).toFixed(1)}:1, violet ${contrast(darkAmplify, darkPanel).toFixed(1)}:1 (4.5 or better)`, contrast(darkAbsorb, darkPanel) >= 4.5 && contrast(darkAmplify, darkPanel) >= 4.5);
  check(`the violet is darker than the supreme's magenta (luminance ${lum(darkAmplify).toFixed(3)} against ${lum(darkSupreme).toFixed(3)}) and apart from it (OKLab ${f3(dist(oklab(toLin(darkAmplify)), oklab(toLin(darkSupreme))))})`, lum(darkAmplify) < lum(darkSupreme) && dist(oklab(toLin(darkAmplify)), oklab(toLin(darkSupreme))) >= 0.15);
  const gv = apart(darkAbsorb, darkAmplify);
  check(`gold and violet stay apart under every deficiency on the dark ground (OKLab ${Object.entries(gv).map(([k, v]) => `${k} ${f3(v)}`).join(', ')}; 0.02 is a just-noticeable difference)`, Math.min(...Object.values(gv)) >= 0.1);
  const go = apart(cvdDark.absorb, cvdDark.bear);
  const vb = apart(cvdDark.amplify, cvdDark.bull);
  check(`blue-and-orange candles on the dark ground: the gold stands off the orange (${Object.entries(go).map(([k, v]) => `${k} ${f3(v)}`).join(', ')}) and the violet off the blue (${Object.entries(vb).map(([k, v]) => `${k} ${f3(v)}`).join(', ')}), 0.1 or more each`, Math.min(...Object.values(go)) >= 0.1 && Math.min(...Object.values(vb)) >= 0.1);
  const gop = apart(cvdLight.absorb, cvdLight.bear);
  const vbp = apart(cvdLight.amplify, cvdLight.bull);
  console.log(`      on paper the pair closes up for a dichromat — gold from the orange ${Object.entries(gop).map(([k, v]) => `${k} ${f3(v)}`).join(', ')}; violet from the blue ${Object.entries(vbp).map(([k, v]) => `${k} ${f3(v)}`).join(', ')} — the oval's form and the candle's ground edge carry the rest (normal vision ${f3(dist(oklab(toLin(cvdLight.absorb)), oklab(toLin(cvdLight.bear))))} and ${f3(dist(oklab(toLin(cvdLight.amplify)), oklab(toLin(cvdLight.bull))))})`);
  check(`the blue-and-orange paper pair still reads at 3:1 on paper (gold ${contrast(cvdLight.absorb, lightPanel).toFixed(2)}, violet ${contrast(cvdLight.amplify, lightPanel).toFixed(2)})`, contrast(cvdLight.absorb, lightPanel) >= 3 && contrast(cvdLight.amplify, lightPanel) >= 3);
}

/* ---- 4. the legend's words ------------------------------------------------------------------------------------- */
{
  const l = beadLegendLines({ ref: 1e9, ring: 1.2e9, refG: 1.5e9, basis: 'session', at: Date.UTC(2026, 9, 14, 16, 17) / 1000, minutes: 100, sessions: 1, priorDay: null, greek: 'gex', sizeBy: 'gross', inks: { put: [132, 102, 234], call: [240, 196, 70], neutral: [125, 125, 125] }, nodes: 5 }, 'session', 0);
  check(`the legend says "size = total gamma at the strike · gold = absorb · violet = amplify · grey = balanced · soft edge = stale": ${l.tail}`, l.tail.startsWith('size = total gamma at the strike · gold = absorb · violet = amplify · grey = balanced · soft edge = stale'));
}

console.log(`\n${pass} of ${pass + fail} pass`);
if (fail) process.exit(1);
