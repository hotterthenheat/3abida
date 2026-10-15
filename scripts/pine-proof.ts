// THE PINE RUNTIME'S ACCEPTANCE TEST (2026-09-10). Real scripts over synthetic
// bars, every figure checked against an independent implementation written
// here, plus the language's corners (history, var, user functions per call
// site, loops, switch, integer division, inputs) and the refusals (strategies,
// drawings, missing version, undeclared names) with their lines.
// THE AUDIT OF 2026-10-15 (sections 8-18): a check for each bug it found —
// str.format's arguments, timeframe.* on the chart's own forms, New York's
// clock and calendar, the VWAP's New York day, the alert ids, ta.obv / ta.tr /
// ta.vwap as variables, arrays named as not yet, location.absolute at its
// price, the shipped scripts' inks and words, the editor's chords — each one
// written to fail on the code before the fix; then every shipped script over
// 5,000 bars with its run time. In `npm test` since the same day.
// barcolor() (section 19, the owner's approval 13): its colours bar by bar, na,
// offset either way, show_last, display.none, two calls in one script and two
// scripts on one pane, and the candle a colour dresses.
//   npx tsx scripts/pine-proof.ts
import { readFileSync } from 'node:fs';
import { compile, run, runSource, explain } from '../src/core/pine';
import type { Bar, RunOptions, RunResult } from '../src/core/pine';
import { builtinScripts, retiredBuiltin } from '../src/data/builtinScripts';
import { BEAR, BULL, CALL_WALL, PUT_WALL } from '../src/components/gex/palette';
import { markersFor } from '../src/components/gex/scriptMarkers';
import { SCRIPT_CAPS } from '../src/types/scripts';
import { named, toCss } from '../src/core/pine/colors';
/* the chart's side of barcolor, read where it exists — the engine's cases below run either way */
const layer: Partial<typeof import('../src/components/gex/barTints')> = await import('../src/components/gex/barTints').catch(() => ({}));

/* ---- synthetic bars: a seeded random walk ---------------------------------------- */
let seed = 20260910;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const bars: Bar[] = [];
let px = 480;
for (let i = 0; i < 400; i++) {
  const o = px;
  const c = px + (rnd() - 0.5) * 2.4;
  const h = Math.max(o, c) + rnd() * 0.8;
  const l = Math.min(o, c) - rnd() * 0.8;
  bars.push({ time: 1757500000 + i * 300, open: o, high: h, low: l, close: c, volume: Math.round(1000 + rnd() * 9000) });
  px = c;
}
const close = bars.map(b => b.close);
const high = bars.map(b => b.high);
const low = bars.map(b => b.low);

/* ---- independent maths ------------------------------------------------------------ */
const smaAt = (xs: number[], i: number, len: number) => (i < len - 1 ? NaN : xs.slice(i - len + 1, i + 1).reduce((a, b) => a + b, 0) / len);
const emaSeries = (xs: number[], len: number) => {
  const out: number[] = [];
  const a = 2 / (len + 1);
  let prev = NaN;
  for (let i = 0; i < xs.length; i++) {
    if (Number.isNaN(prev)) {
      prev = smaAt(xs, i, len);
      out.push(prev);
    } else {
      prev = a * xs[i] + (1 - a) * prev;
      out.push(prev);
    }
  }
  return out;
};
const rmaSeries = (xs: number[], len: number) => {
  const out: number[] = [];
  let prev = NaN;
  for (let i = 0; i < xs.length; i++) {
    if (Number.isNaN(prev)) {
      prev = smaAt(xs, i, len);
      out.push(prev);
    } else {
      prev = (xs[i] + (len - 1) * prev) / len;
      out.push(prev);
    }
  }
  return out;
};
const rsiSeries = (xs: number[], len: number) => {
  const ups = xs.map((x, i) => (i === 0 ? NaN : Math.max(x - xs[i - 1], 0)));
  const downs = xs.map((x, i) => (i === 0 ? NaN : Math.max(xs[i - 1] - x, 0)));
  const u = rmaSeries(ups.slice(1), len);
  const d = rmaSeries(downs.slice(1), len);
  return xs.map((_, i) => (i === 0 ? NaN : d[i - 1] === 0 ? 100 : u[i - 1] === 0 ? 0 : 100 - 100 / (1 + u[i - 1] / d[i - 1])));
};
const stdevAt = (xs: number[], i: number, len: number) => {
  if (i < len - 1) return NaN;
  const w = xs.slice(i - len + 1, i + 1);
  const m = w.reduce((a, b) => a + b, 0) / len;
  return Math.sqrt(w.reduce((a, v) => a + (v - m) ** 2, 0) / len);
};
const highestAt = (xs: number[], i: number, len: number) => (i < len - 1 ? NaN : Math.max(...xs.slice(i - len + 1, i + 1)));
const lowestAt = (xs: number[], i: number, len: number) => (i < len - 1 ? NaN : Math.min(...xs.slice(i - len + 1, i + 1)));

/* ---- the harness ------------------------------------------------------------------ */
let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
};
const close_ = (a: number, b: number, eps = 1e-9) => (Number.isNaN(a) && Number.isNaN(b)) || Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));
const sameSeries = (got: ArrayLike<number>, want: number[], from: number, eps = 1e-9) => {
  for (let i = from; i < want.length; i++) if (!close_(got[i], want[i], eps)) return `bar ${i}: got ${got[i]} want ${want[i]}`;
  return '';
};
const fails = (source: string, pattern: RegExp): string => {
  try {
    runSource(source, bars);
    return 'ran without complaint';
  } catch (e) {
    const { line, message } = explain(e);
    return pattern.test(message) ? `line ${line}: ${message}` : `WRONG MESSAGE line ${line}: ${message}`;
  }
};

/* ---- 1. the averages ----------------------------------------------------------------- */
{
  const r = runSource(`//@version=6
indicator("Averages")
plot(ta.sma(close, 20), "sma")
plot(ta.ema(close, 9), "ema")
plot(ta.rma(close, 14), "rma")
plot(ta.wma(close, 10), "wma")`, bars);
  const wantSma = close.map((_, i) => smaAt(close, i, 20));
  const wantEma = emaSeries(close, 9);
  const wantRma = rmaSeries(close, 14);
  const wantWma = close.map((_, i) => {
    if (i < 9) return NaN;
    let num = 0;
    for (let k = 0; k < 10; k++) num += close[i - 9 + k] * (k + 1);
    return num / 55;
  });
  check('ta.sma matches', sameSeries(r.plots[0].values, wantSma, 0) === '', sameSeries(r.plots[0].values, wantSma, 0));
  check('ta.ema matches (seeded from the first SMA)', sameSeries(r.plots[1].values, wantEma, 0) === '', sameSeries(r.plots[1].values, wantEma, 0));
  check('ta.rma matches', sameSeries(r.plots[2].values, wantRma, 0) === '', sameSeries(r.plots[2].values, wantRma, 0));
  check('ta.wma matches', sameSeries(r.plots[3].values, wantWma, 0) === '', sameSeries(r.plots[3].values, wantWma, 0));
  check('plot titles land', r.plots.map(p => p.title).join(',') === 'sma,ema,rma,wma');
}

/* ---- 2. RSI, MACD, Bollinger ------------------------------------------------------------ */
{
  const r = runSource(`//@version=6
indicator("Oscillators")
plot(ta.rsi(close, 14), "rsi")
[m, s, h] = ta.macd(close, 12, 26, 9)
plot(m, "macd")
plot(s, "signal")
plot(h, "hist")
[basis, upper, lower] = ta.bb(close, 20, 2)
plot(basis, "basis")
plot(upper, "upper")
plot(lower, "lower")`, bars);
  const wantRsi = rsiSeries(close, 14);
  check('ta.rsi matches Wilder', sameSeries(r.plots[0].values, wantRsi, 0, 1e-8) === '', sameSeries(r.plots[0].values, wantRsi, 0, 1e-8));
  const e12 = emaSeries(close, 12);
  const e26 = emaSeries(close, 26);
  const macd = close.map((_, i) => e12[i] - e26[i]);
  const sig = emaSeries(macd, 9);
  check('ta.macd line matches', sameSeries(r.plots[1].values, macd, 0) === '', sameSeries(r.plots[1].values, macd, 0));
  check('ta.macd signal matches', sameSeries(r.plots[2].values, sig, 0, 1e-8) === '', sameSeries(r.plots[2].values, sig, 0, 1e-8));
  const hist = macd.map((v, i) => v - sig[i]);
  check('ta.macd histogram = line − signal', sameSeries(r.plots[3].values, hist, 0, 1e-8) === '', sameSeries(r.plots[3].values, hist, 0, 1e-8));
  const basis = close.map((_, i) => smaAt(close, i, 20));
  const upper = close.map((_, i) => basis[i] + 2 * stdevAt(close, i, 20));
  const lower = close.map((_, i) => basis[i] - 2 * stdevAt(close, i, 20));
  check('ta.bb basis matches', sameSeries(r.plots[4].values, basis, 0) === '');
  check('ta.bb upper matches (population stdev)', sameSeries(r.plots[5].values, upper, 0, 1e-8) === '', sameSeries(r.plots[5].values, upper, 0, 1e-8));
  check('ta.bb lower matches', sameSeries(r.plots[6].values, lower, 0, 1e-8) === '');
}

/* ---- 3. the Ichimoku script from the screenshot ------------------------------------------ */
const ICHIMOKU = `//@version=6
indicator("Ichimoku Cloud", overlay = true)

convLen = input.int(9,  "Conversion", minval = 1)
baseLen = input.int(26, "Base", minval = 1)
spanLen = input.int(52, "Leading span B", minval = 1)
disp    = input.int(26, "Displacement", minval = 1)

donchian(int len) => math.avg(ta.lowest(len), ta.highest(len))

conv  = donchian(convLen)
base  = donchian(baseLen)
spanA = math.avg(conv, base)
spanB = donchian(spanLen)

plot(conv, "Conversion", color = #7DE3FF)
plot(base, "Base", color = #FF9500)
plot(close, "Lagging span", color = color.new(#C7D3E8, 30), offset = -disp + 1)
a = plot(spanA, "Leading span A", color = color.new(#30D158, 55), offset = disp - 1)
b = plot(spanB, "Leading span B", color = color.new(#FF3B30, 55), offset = disp - 1)
fill(a, b, color = spanA > spanB ? color.new(#30D158, 88) : color.new(#FF3B30, 88), title = "Cloud")
alertcondition(ta.crossover(conv, base), "Conversion crossed up", "{{ticker}} tenkan crossed above kijun")
alertcondition(ta.crossunder(conv, base), "Conversion crossed down", "{{ticker}} tenkan crossed below kijun")`;
{
  const c = compile(ICHIMOKU);
  check('Ichimoku meta: title, overlay', c.meta.title === 'Ichimoku Cloud' && c.meta.pane === 'overlay', JSON.stringify([c.meta.title, c.meta.pane]));
  check('Ichimoku meta: four inputs by their variable names', c.meta.inputs.map(i => i.id).join(',') === 'convLen,baseLen,spanLen,disp', c.meta.inputs.map(i => i.id).join(','));
  check('Ichimoku meta: input titles, defaults, minval', c.meta.inputs[0].title === 'Conversion' && c.meta.inputs[0].default === 9 && c.meta.inputs[0].min === 1 && c.meta.inputs[0].kind === 'int');
  check('Ichimoku meta: five plots, one fill, two alerts', c.meta.plots.length === 5 && c.meta.fills === 1 && c.meta.alerts.length === 2);
  check('Ichimoku meta: plot inks and titles', c.meta.plots[0].ink === '#7de3ff' && c.meta.plots[2].ink === 'rgba(199, 211, 232, 0.7)' && c.meta.plots[3].title === 'Leading span A', JSON.stringify(c.meta.plots.map(p => [p.title, p.ink])));
  check('Ichimoku meta: alerts', c.meta.alerts[0].title === 'Conversion crossed up' && c.meta.alerts[1].message.includes('kijun'));

  const r = run(c, bars);
  const conv = close.map((_, i) => (lowestAt(low, i, 9) + highestAt(high, i, 9)) / 2);
  const base = close.map((_, i) => (lowestAt(low, i, 26) + highestAt(high, i, 26)) / 2);
  check('Ichimoku conversion = avg(lowest 9, highest 9)', sameSeries(r.plots[0].values, conv, 0) === '', sameSeries(r.plots[0].values, conv, 0));
  check('Ichimoku base = avg(lowest 26, highest 26) — a second call of the same function, its own stream', sameSeries(r.plots[1].values, base, 0) === '', sameSeries(r.plots[1].values, base, 0));
  check('Ichimoku span A = avg(conv, base)', sameSeries(r.plots[3].values, conv.map((v, i) => (v + base[i]) / 2), 0) === '');
  check('Ichimoku lagging span offset −25, leading +25', r.plots[2].offset === -25 && r.plots[3].offset === 25, `${r.plots[2].offset} ${r.plots[3].offset}`);
  check('Ichimoku fill names the two plots and varies by bar', r.fills[0].a.index === 3 && r.fills[0].b.index === 4 && r.fills[0].colors !== null && r.fills[0].colors!.some(x => x?.includes('48, 209, 88')) && r.fills[0].colors!.some(x => x?.includes('255, 59, 48')));
  const fired = r.alerts.map(a => Array.from(a.fired).reduce((x, y) => x + y, 0));
  check('Ichimoku alerts fire on crossings', r.alerts[0].title === 'Conversion crossed up' && fired[0] > 0 && fired[1] > 0, `up ${fired[0]} down ${fired[1]}`);

  const r2 = run(c, bars, { inputs: { convLen: 5 } });
  const conv5 = close.map((_, i) => (lowestAt(low, i, 5) + highestAt(high, i, 5)) / 2);
  check("the reader's input changes the run (convLen 5)", sameSeries(r2.plots[0].values, conv5, 0) === '', sameSeries(r2.plots[0].values, conv5, 0));
}

/* ---- 4. the language's corners --------------------------------------------------------- */
{
  const r = runSource(`//@version=6
indicator("Corners")
var count = 0
count := count + 1
plot(count, "count")
plot(close[1], "prev close")
plot(7 / 2, "int div")
plot(7 / 2.0, "float div")
s = 0.0
for i = 0 to 4
    s := s + close[i]
plot(s / 5, "loop sma5")
x = if close > open
    1
else
    -1
plot(x, "if expr")
kind = "ema"
ma = switch kind
    "sma" => ta.sma(close, 5)
    "ema" => ta.ema(close, 5)
    => close
plot(ma, "switch")
f(len) => ta.ema(close, len)
plot(f(9), "f9")
plot(f(21), "f21")
plot(nz(close[400], -1), "nz")
plot(bar_index, "bar_index")
plot(ta.sma(close, 20)[1], "sma[1]")
hi = ta.highest(high, 10)
plot(hi, "highest")
c = close > open ? color.green : color.red
plot(close, "coloured", color = c)
bgcolor(close > open ? color.new(color.green, 90) : na)
plotshape(ta.crossover(close, ta.sma(close, 20)), "cross", shape.triangleup, location.belowbar, color.lime)
hline(50, "half", color.gray, hline.style_dashed)`, bars);
  const by = (t: string) => r.plots.find(p => p.title === t)!;
  check('var persists and := adds each bar', by('count').values[399] === 400, String(by('count').values[399]));
  check('close[1] is the bar before', by('prev close').values[10] === close[9] && Number.isNaN(by('prev close').values[0]));
  check('7 / 2 truncates to 3 (Pine int division), 7 / 2.0 is 3.5', by('int div').values[5] === 3 && by('float div').values[5] === 3.5, `${by('int div').values[5]} ${by('float div').values[5]}`);
  check('a for loop over close[i] equals sma 5', sameSeries(by('loop sma5').values, close.map((_, i) => smaAt(close, i, 5)), 4) === '');
  check('if as an expression', by('if expr').values[3] === (close[3] > bars[3].open ? 1 : -1));
  check('switch picks the ema', sameSeries(by('switch').values, emaSeries(close, 5), 0) === '');
  check('two call sites of one user function keep separate streams', sameSeries(by('f9').values, emaSeries(close, 9), 0) === '' && sameSeries(by('f21').values, emaSeries(close, 21), 0) === '');
  check('nz replaces na', by('nz').values[0] === -1 && by('nz').values[399] === -1);
  check('bar_index counts from 0', by('bar_index').values[0] === 0 && by('bar_index').values[399] === 399);
  check('a call subscripted [1] is its previous value', close_(by('sma[1]').values[30], smaAt(close, 29, 20)));
  check('ta.highest over high', sameSeries(by('highest').values, high.map((_, i) => highestAt(high, i, 10)), 0) === '');
  const col = by('coloured');
  check('a per-bar colour is recorded per bar', col.colors !== null && col.colors!.every((x, i) => x === (close[i] > bars[i].open ? '#4caf50' : '#f23645')), col.colors?.slice(0, 3).join(' '));
  check('bgcolor records a colour on up bars and none on down bars', r.bgcolors !== null && r.bgcolors!.every((x, i) => (close[i] > bars[i].open ? x === 'rgba(76, 175, 80, 0.1)' : x === null)));
  const shape = r.shapes[0];
  check('plotshape draws where the condition held', shape.style === 'triangleup' && shape.location === 'belowbar' && shape.ink === '#00e676' && Array.from(shape.values).filter(v => v === 1).length > 0);
  check('hline keeps its price, ink and style', r.hlines[0].price === 50 && r.hlines[0].style === 'dashed' && r.hlines[0].ink === '#787b86');
}

/* ---- 5. more of ta ------------------------------------------------------------------------ */
{
  const r = runSource(`//@version=6
indicator("More")
[st, dir] = ta.supertrend(3, 10)
plot(st, "st")
plot(dir, "dir")
plot(ta.atr(14), "atr")
[dp, dm, adx] = ta.dmi(14, 14)
plot(adx, "adx")
plot(ta.stoch(close, high, low, 14), "stoch")
plot(ta.vwap(hlc3), "vwap")
plot(ta.hma(close, 9), "hma")
plot(ta.change(close), "change")
plot(ta.barssince(ta.crossover(close, ta.sma(close, 10))), "since")
plot(ta.valuewhen(ta.crossover(close, ta.sma(close, 10)), close, 0), "when")
plot(ta.cum(volume), "cum")`, bars);
  const by = (t: string) => r.plots.find(p => p.title === t)!;
  const dirs = new Set(Array.from(by('dir').values).filter(v => !Number.isNaN(v)));
  check('supertrend direction is −1 or 1 and the line is finite', [...dirs].every(d => d === 1 || d === -1) && Number.isFinite(by('st').values[399]), [...dirs].join(','));
  const tr = bars.map((b, i) => (i === 0 ? b.high - b.low : Math.max(b.high - b.low, Math.abs(b.high - close[i - 1]), Math.abs(b.low - close[i - 1]))));
  check('atr = rma of true range', sameSeries(by('atr').values, rmaSeries(tr, 14), 0, 1e-8) === '', sameSeries(by('atr').values, rmaSeries(tr, 14), 0, 1e-8));
  check('adx is between 0 and 100', Array.from(by('adx').values).filter(v => !Number.isNaN(v)).every(v => v >= 0 && v <= 100));
  const stoch = close.map((_, i) => (100 * (close[i] - lowestAt(low, i, 14))) / (highestAt(high, i, 14) - lowestAt(low, i, 14)));
  check('stoch matches', sameSeries(by('stoch').values, stoch, 0, 1e-8) === '');
  check('vwap is finite and near the price', Number.isFinite(by('vwap').values[399]) && Math.abs(by('vwap').values[399] - close[399]) < 30);
  check('hull average is finite after its window', Number.isFinite(by('hma').values[50]));
  check('change = close − close[1]', sameSeries(by('change').values, close.map((v, i) => (i === 0 ? NaN : v - close[i - 1])), 0) === '');
  check('barssince counts up, valuewhen holds the close at the crossing', by('since').values[399] >= 0 && Number.isFinite(by('when').values[399]));
  check('cum sums the volume', close_(by('cum').values[399], bars.reduce((a, b) => a + b.volume, 0)));
}

/* ---- 6. the refusals, with lines ------------------------------------------------------- */
{
  check('a missing version line is refused at line 1', /must be \/\/@version=6/.test(fails(`indicator("x")\nplot(close)`, /version/)), fails(`indicator("x")\nplot(close)`, /version/));
  check('strategy() is not in this version yet', /Strategies are not in this version/.test(fails(`//@version=6\nstrategy("s")\nplot(close)`, /Strateg/)), fails(`//@version=6\nstrategy("s")\nplot(close)`, /Strateg/));
  check('request.security is named as not yet', /request\.\* is not in this version yet/.test(fails(`//@version=6\nindicator("x")\nd = request.security(syminfo.tickerid, "D", close)\nplot(d)`, /request/)), fails(`//@version=6\nindicator("x")\nd = request.security(syminfo.tickerid, "D", close)\nplot(d)`, /request/));
  check('label.new is named as not yet', /label\.\* is not in this version yet/.test(fails(`//@version=6\nindicator("x")\nlabel.new(bar_index, close, "hi")\nplot(close)`, /label/)));
  check('an undeclared name names itself and its line', /line 3: "foo" is not declared/.test(fails(`//@version=6\nindicator("x")\nplot(foo)`, /not declared/)), fails(`//@version=6\nindicator("x")\nplot(foo)`, /not declared/));
  check(':= before a declaration says so', /is not declared — write "y = …" first/.test(fails(`//@version=6\nindicator("x")\ny := 1\nplot(y)`, /declared/)));
  check('an unclosed bracket names its line', /line 3: A bracket was opened and never closed/.test(fails(`//@version=6\nindicator("x")\nplot(ta.sma(close, 20)`, /bracket/)), fails(`//@version=6\nindicator("x")\nplot(ta.sma(close, 20)`, /bracket/));
  check('an unknown function names itself', /ta\.magic\(\) is not in this version yet/.test(fails(`//@version=6\nindicator("x")\nplot(ta.magic(close))`, /magic/)));
  check('a wrong argument name names the function', /ta\.sma has no argument named "len"/.test(fails(`//@version=6\nindicator("x")\nplot(ta.sma(close, len = 5))`, /argument/)));
  check('the budget stops a runaway loop', /budget/.test(fails(`//@version=6\nindicator("x")\ns = 0.0\nfor i = 0 to 20000\n    s := s + ta.sma(close, 5)\nplot(s)`, /budget|turns/)) || /turns/.test(fails(`//@version=6\nindicator("x")\ns = 0.0\nfor i = 0 to 20000\n    s := s + ta.sma(close, 5)\nplot(s)`, /budget|turns/)));
}

/* ---- 7. speed --------------------------------------------------------------------------- */
{
  const many: Bar[] = [];
  let p = 480;
  for (let i = 0; i < 5000; i++) {
    const o = p;
    const c = p + (rnd() - 0.5) * 2.4;
    many.push({ time: 1757500000 + i * 60, open: o, high: Math.max(o, c) + rnd(), low: Math.min(o, c) - rnd(), close: c, volume: 1000 + Math.round(rnd() * 9000) });
    p = c;
  }
  const c = compile(ICHIMOKU);
  const t0 = performance.now();
  const r = run(c, many, { budgetMs: 2000 });
  const ms = performance.now() - t0;
  check(`Ichimoku over 5,000 bars inside 200 ms (${ms.toFixed(0)} ms, run says ${r.stats.ms.toFixed(0)})`, ms < 200);
}

/* ==== THE AUDIT OF 2026-10-15 — one check (or more) a bug, each written to fail on the code before the fix ==== */

const tryRun = (source: string, b: Bar[] = bars, opts: RunOptions = {}): { r: RunResult | null; err: string } => {
  try {
    return { r: runSource(source, b, opts), err: '' };
  } catch (e) {
    const { line, message } = explain(e);
    return { r: null, err: `line ${line}: ${message}` };
  }
};
/** What a script said through alert() — the one way a string leaves a run */
const said = (source: string, b: Bar[] = bars, opts: RunOptions = {}): string => {
  const t = tryRun(source, b, opts);
  if (!t.r) return `threw — ${t.err}`;
  return t.r.alerts.filter(a => a.title === 'alert()').map(a => a.message).join(' ‖ ');
};
const compileFails = (source: string, pattern: RegExp): string => {
  try {
    compile(source);
    return 'compiled without complaint';
  } catch (e) {
    const { line, message } = explain(e);
    return pattern.test(message) ? `line ${line}: ${message}` : `WRONG MESSAGE line ${line}: ${message}`;
  }
};
/** Seeded bars from `start` (seconds), `step` seconds apart */
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
/* New York's calendar and clock, read independently of the runtime — Intl on the exchange's zone */
const NY_FMT = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', weekday: 'short', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
const nyOf = (sec: number) => {
  const r: Record<string, string> = {};
  for (const x of NY_FMT.formatToParts(new Date(sec * 1000))) if (x.type !== 'literal') r[x.type] = x.value;
  return { year: +r.year, month: +r.month, day: +r.day, hour: +r.hour % 24, minute: +r.minute, second: +r.second, dow: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(r.weekday) + 1, date: `${r.year}-${r.month}-${r.day}` };
};
/** A session VWAP computed here, resetting where `key` changes */
const vwapByKey = (b: Bar[], key: (i: number) => string): number[] => {
  let pv = 0;
  let v = 0;
  let k = '';
  return b.map((x, i) => {
    const kk = key(i);
    if (kk !== k) {
      k = kk;
      pv = 0;
      v = 0;
    }
    const src = (x.high + x.low + x.close) / 3;
    pv += src * x.volume;
    v += x.volume;
    return pv / v;
  });
};

/* ---- 8. bug 1: str.format takes a format and any number of arguments ---------------- */
{
  const one = said(`//@version=6
indicator("Format")
if barstate.islast
    alert(str.format("{0} and {1}", 3, 2.5))`);
  check('bug 1: str.format("{0} and {1}", 3, 2.5) says "3 and 2.5"', one === '3 and 2.5', one);
  const two = said(`//@version=6
indicator("Format")
if barstate.islast
    alert(str.format("{1}{0} · {2,number,#.##} · {3,number,0.00} · {4,number,integer}", "a", "b", 1.5, 2, 7.6))`);
  check('bug 1: str.format reads its arguments in any order, with #.##, 0.00 and integer', two === 'ba · 1.5 · 2.00 · 8', two);
}

/* ---- 9. bug 2: timeframe.* on the chart's own forms --------------------------------- */
{
  const TF = (v: number) => `//@version=${v}
indicator("Timeframe")
if barstate.islast
    alert(timeframe.period + "|" + str.tostring(timeframe.multiplier) + "|" + str.tostring(timeframe.isintraday) + "|" + str.tostring(timeframe.isminutes) + "|" + str.tostring(timeframe.isseconds) + "|" + str.tostring(timeframe.isdaily) + "|" + str.tostring(timeframe.isweekly) + "|" + str.tostring(timeframe.ismonthly) + "|" + str.tostring(timeframe.isdwm))`;
  /* period | multiplier | intraday | minutes | seconds | daily | weekly | monthly | dwm — Pine v6 always writes the multiplier ("1D") */
  const want: [string, string][] = [
    ['15s', '15S|15|true|false|true|false|false|false|false'],
    ['1m', '1|1|true|true|false|false|false|false|false'],
    ['5m', '5|5|true|true|false|false|false|false|false'],
    ['15m', '15|15|true|true|false|false|false|false|false'],
    ['30m', '30|30|true|true|false|false|false|false|false'],
    ['1h', '60|60|true|true|false|false|false|false|false'],
    ['4h', '240|240|true|true|false|false|false|false|false'],
    ['1D', '1D|1|false|false|false|true|false|false|true'],
    ['1W', '1W|1|false|false|false|false|true|false|true'],
    /* Pine's own forms still read */
    ['5', '5|5|true|true|false|false|false|false|false'],
    ['60', '60|60|true|true|false|false|false|false|false'],
    ['D', '1D|1|false|false|false|true|false|false|true'],
    ['W', '1W|1|false|false|false|false|true|false|true'],
    ['1M', '1M|1|false|false|false|false|false|true|true'],
    ['15S', '15S|15|true|false|true|false|false|false|false'],
  ];
  const wrong = want.map(([tf, w]) => [tf, said(TF(6), bars, { timeframe: tf }), w]).filter(([, got, w]) => got !== w);
  check('bug 2: timeframe.* reads every form the chart hands it (15s … 1W) and Pine\'s own', wrong.length === 0, wrong.map(([tf, got, w]) => `${tf}: got ${got} want ${w}`).join('; '));
  const intraday = ['15s', '1m', '5m', '15m', '30m', '1h', '4h'].filter(tf => !said(TF(6), bars, { timeframe: tf }).includes('|true|'));
  check('bug 2: timeframe.isintraday is true on every intraday pane', intraday.length === 0, intraday.join(','));
  const v5 = said(TF(5), bars, { timeframe: '1D' }).split('|')[0];
  check('bug 2: a v5 script reads "D" for a daily pane (v5 leaves a multiplier of 1 out)', v5 === 'D', v5);
}

/* ---- 10. bug 3: the clock and calendar are New York's, whatever the machine's zone ----- */
{
  const before = process.env.TZ;
  process.env.TZ = 'Asia/Kolkata'; // UTC+5:30 — a half-hour zone, so even the minute would show a local reading
  const at = [
    Date.UTC(2026, 0, 15, 14, 30, 0), // 9:30 am EST
    Date.UTC(2026, 2, 8, 6, 59, 30), // 1:59:30 am EST, the minute before the spring change
    Date.UTC(2026, 2, 8, 7, 0, 0), // 3:00 am EDT
    Date.UTC(2026, 9, 14, 13, 35, 0), // 9:35 am EDT, a Wednesday
    Date.UTC(2026, 9, 15, 3, 30, 0), // 11:30 pm EDT on Oct 14 — Oct 15 in UTC and in Kolkata
    Date.UTC(2026, 10, 1, 5, 30, 0), // 1:30 am EDT, Nov 1
    Date.UTC(2026, 10, 1, 6, 30, 0), // 1:30 am EST, Nov 1 — the hour that happens twice
  ].map(ms => ms / 1000);
  const b = at.map((t, i) => ({ time: t, open: 100 + i, high: 101 + i, low: 99 + i, close: 100.5 + i, volume: 1000 }));
  const t = tryRun(`//@version=6
indicator("Clock")
plot(hour, "hour")
plot(minute, "minute")
plot(second, "second")
plot(dayofweek, "dayofweek")
plot(dayofmonth, "dayofmonth")
plot(month, "month")
plot(year, "year")`, b, { timeframe: '1m' });
  const f = tryRun(`//@version=6
indicator("Clock, the function forms")
plot(hour(time), "hour(time)")
plot(minute(time), "minute(time)")
plot(dayofweek(time, "America/New_York"), "dayofweek(time, NY)")
plot(dayofmonth(time, syminfo.timezone), "dayofmonth(time, exchange)")
plot(hour(time, "UTC"), "hour(time, UTC)")`, b, { timeframe: '1m' });
  process.env.TZ = before;
  if (before === undefined) delete process.env.TZ;
  const misses = (res: { r: RunResult | null }, want: (sec: number) => [string, number][]): string[] => {
    const wrong: string[] = [];
    at.forEach((sec, i) => {
      for (const [k, w] of want(sec)) {
        const got = res.r?.plots.find(p => p.title === k)?.values[i];
        if (got !== w) wrong.push(`${new Date(sec * 1000).toISOString()} ${k} ${got} want ${w}`);
      }
    });
    return wrong;
  };
  const wrongVars = misses(t, sec => {
    const ny = nyOf(sec);
    return [['hour', ny.hour], ['minute', ny.minute], ['second', ny.second], ['dayofweek', ny.dow], ['dayofmonth', ny.day], ['month', ny.month], ['year', ny.year]];
  });
  check('bug 3: hour, minute, second, dayofweek, dayofmonth, month, year are New York\'s on a Kolkata machine, across both DST changes', !t.err && wrongVars.length === 0, t.err || wrongVars.slice(0, 4).join('; '));
  const wrongFns = misses(f, sec => {
    const ny = nyOf(sec);
    return [['hour(time)', ny.hour], ['minute(time)', ny.minute], ['dayofweek(time, NY)', ny.dow], ['dayofmonth(time, exchange)', ny.day], ['hour(time, UTC)', new Date(sec * 1000).getUTCHours()]];
  });
  check('bug 3: the function forms — hour(time), dayofweek(time, zone) … — read New York by default, UTC when asked', !f.err && wrongFns.length === 0, f.err || wrongFns.slice(0, 4).join('; '));
  /* a day bar stands for its New York session: the house stamps it at that date's UTC midnight (8 pm the evening before in New York) */
  const days = [Date.UTC(2026, 9, 12), Date.UTC(2026, 9, 13), Date.UTC(2026, 9, 14)].map(ms => ms / 1000);
  const db = days.map(t0 => ({ time: t0, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 }));
  const d = tryRun(`//@version=6
indicator("Day")
plot(dayofmonth, "dom")
plot(dayofweek, "dow")`, db, { timeframe: '1D' });
  const dom = Array.from(d.r?.plots[0].values ?? []);
  const dow = Array.from(d.r?.plots[1].values ?? []);
  check('bug 3: on a daily pane dayofmonth and dayofweek name the session the bar stands for', dom.join(',') === '12,13,14' && dow.join(',') === '2,3,4', `${dom.join(',')} / ${dow.join(',')}`);
  const df = tryRun(`//@version=6
indicator("Day")
plot(dayofweek(time), "dow(time)")
plot(dayofmonth(time, "UTC"), "dom(time, UTC)")`, db, { timeframe: '1D' });
  const dowT = Array.from(df.r?.plots[0].values ?? []);
  const domU = Array.from(df.r?.plots[1].values ?? []);
  check('bug 3: on a daily pane dayofweek(time) agrees with dayofweek; UTC reads the stamp as it is', !df.err && dowT.join(',') === '2,3,4' && domU.join(',') === '12,13,14', df.err || `${dowT.join(',')} / ${domU.join(',')}`);
}

/* ---- 11. bug 4: ta.vwap resets at New York's day, and on a day bar is the bar --------- */
{
  /* five-minute bars round the clock over three days in October (summer time): New York's midnight is 04:00 UTC */
  const b = walk(3 * 288, Date.UTC(2026, 9, 12, 20, 0) / 1000, 300, 77);
  const r = tryRun(`//@version=6
indicator("VWAP")
plot(ta.vwap(hlc3), "vwap")`, b, { timeframe: '5m' });
  const want = vwapByKey(b, i => nyOf(b[i].time).date);
  const got = r.r?.plots[0].values ?? new Float64Array(b.length).fill(NaN);
  check('bug 4: ta.vwap restarts at New York\'s midnight (not 01:00 in summer)', !r.err && sameSeries(got, want, 0) === '', r.err || sameSeries(got, want, 0));
  const a = tryRun(`//@version=6
indicator("VWAP")
plot(ta.vwap(hlc3, bar_index % 10 == 0), "anchored")`, b, { timeframe: '5m' });
  const anchored = vwapByKey(b, i => String(Math.floor(i / 10)));
  const ga = a.r?.plots[0].values ?? new Float64Array(b.length).fill(NaN);
  check('bug 4: ta.vwap(src, anchor) restarts where the anchor holds', !a.err && sameSeries(ga, anchored, 0) === '', a.err || sameSeries(ga, anchored, 0));
  const s = tryRun(`//@version=6
indicator("VWAP")
[v, u, l] = ta.vwap(hlc3, stdev_mult = 2)
plot(v, "v")
plot(u, "u")
plot(l, "l")`, b, { timeframe: '5m' });
  /* the bands: the volume-weighted deviation of the source from the VWAP, since the session began */
  const bands = (() => {
    let pv = 0;
    let p2v = 0;
    let v = 0;
    let k = '';
    return b.map(x => {
      const kk = nyOf(x.time).date;
      if (kk !== k) {
        k = kk;
        pv = p2v = v = 0;
      }
      const s = (x.high + x.low + x.close) / 3;
      pv += s * x.volume;
      p2v += s * s * x.volume;
      v += x.volume;
      const m = pv / v;
      const sd = Math.sqrt(Math.max(p2v / v - m * m, 0));
      return [m + 2 * sd, m - 2 * sd];
    });
  })();
  const gv = s.r?.plots[0].values ?? new Float64Array(b.length).fill(NaN);
  const gu = s.r?.plots[1].values ?? new Float64Array(b.length).fill(NaN);
  const gl = s.r?.plots[2].values ?? new Float64Array(b.length).fill(NaN);
  check('bug 4: ta.vwap(src, stdev_mult = 2) hands back the line and its two bands', !s.err && sameSeries(gv, want, 0) === '' && sameSeries(gu, bands.map(x => x[0]), 0, 1e-7) === '' && sameSeries(gl, bands.map(x => x[1]), 0, 1e-7) === '', s.err || sameSeries(gu, bands.map(x => x[0]), 0, 1e-7));
  /* TradingView: the default anchor is a new session; on a day bar every bar is one, so the VWAP is the bar's own source */
  const days = walk(60, Date.UTC(2026, 6, 1) / 1000, 86400, 5);
  const weeks = walk(30, Date.UTC(2026, 0, 5) / 1000, 7 * 86400, 6);
  const dv = tryRun(`//@version=6\nindicator("v")\nplot(ta.vwap(hlc3), "v")`, days, { timeframe: '1D' });
  const wv = tryRun(`//@version=6\nindicator("v")\nplot(ta.vwap(hlc3), "v")`, weeks, { timeframe: '1W' });
  const hlc = (xs: Bar[]) => xs.map(x => (x.high + x.low + x.close) / 3);
  check('bug 4: on a daily or weekly pane ta.vwap is each bar\'s hlc3 — TradingView restarts it every session (unchanged)', !dv.err && !wv.err && sameSeries(dv.r!.plots[0].values, hlc(days), 0) === '' && sameSeries(wv.r!.plots[0].values, hlc(weeks), 0) === '', dv.err || wv.err);
}

/* ---- 12. bug 5: an alert() before an alertcondition() keeps the switches' ids ------------ */
{
  const source = `//@version=6
indicator("Ids")
if close > open
    alert("up bar")
alertcondition(close < open, "Down bar", "a down bar")
alertcondition(close > open, "Up bar", "an up bar")`;
  const c = compile(source);
  const r = run(c, bars);
  const ids = c.meta.alerts.map(a => a.id);
  const hit = (id: string) => r.alerts.find(a => a.id === id);
  const downs = bars.map(x => (x.close < x.open ? 1 : 0));
  const ups = bars.map(x => (x.close > x.open ? 1 : 0));
  const down = hit(ids[0]);
  const up = hit(ids[1]);
  check('bug 5: the switch the library lists finds its own condition in the run (alert() written first)', c.meta.alerts[0].title === 'Down bar' && down?.title === 'Down bar' && up?.title === 'Up bar' && Array.from(down.fired).join('') === downs.join('') && Array.from(up!.fired).join('') === ups.join(''), `meta ${ids.join(',')} → run ${ids.map(id => hit(id)?.title ?? 'none').join(',')}`);
  const calls = r.alerts.filter(a => a.title === 'alert()');
  check('bug 5: an alert() call keeps an id of its own, never a switch\'s', calls.length === 1 && !ids.includes(calls[0].id), calls.map(a => a.id).join(','));
}

/* ---- 13. bug 6: ta.obv, ta.tr and ta.vwap written as variables ----------------------------- */
{
  /* one script a variable, so each check fails for its own reason */
  const one = (body: string) => tryRun(`//@version=6\nindicator("Variables")\n${body}`);
  const plotOf = (res: { r: RunResult | null }, t: string) => res.r?.plots.find(p => p.title === t)?.values ?? new Float64Array(bars.length).fill(NaN);
  let o = 0;
  const obv = bars.map((x, i) => (i === 0 ? 0 : (o += Math.sign(x.close - bars[i - 1].close) * x.volume)));
  const tr = bars.map((x, i) => (i === 0 ? NaN : Math.max(x.high - x.low, Math.abs(x.high - bars[i - 1].close), Math.abs(x.low - bars[i - 1].close))));
  const vw = vwapByKey(bars, i => nyOf(bars[i].time).date);
  const ro = one(`plot(ta.obv, "obv")\nplot(ta.obv[1], "obv[1]")`);
  check('bug 6: ta.obv as a variable is the running on-balance volume', !ro.err && sameSeries(plotOf(ro, 'obv'), obv, 0) === '', ro.err || sameSeries(plotOf(ro, 'obv'), obv, 0));
  check('bug 6: ta.obv[1] is the bar before\'s', !ro.err && sameSeries(plotOf(ro, 'obv[1]'), obv.map((_, i) => (i === 0 ? NaN : obv[i - 1])), 0) === '', ro.err);
  const rt = one(`plot(ta.tr, "tr")\nplot(ta.tr(true), "tr(true)")`);
  check('bug 6: ta.tr as a variable is the true range (na on the first bar, as ta.tr(false))', !rt.err && sameSeries(plotOf(rt, 'tr'), tr, 0) === '', rt.err || sameSeries(plotOf(rt, 'tr'), tr, 0));
  check('bug 6: ta.tr(true) still reads the first bar\'s range', !rt.err && plotOf(rt, 'tr(true)')[0] === bars[0].high - bars[0].low, rt.err);
  const rv = one(`plot(ta.vwap, "vwap")`);
  check('bug 6: ta.vwap as a variable is the session VWAP of hlc3', !rv.err && sameSeries(plotOf(rv, 'vwap'), vw, 0) === '', rv.err || sameSeries(plotOf(rv, 'vwap'), vw, 0));
  const ri = one(`x = 0.0\nif bar_index % 3 == 0\n    x := ta.tr\nplot(x, "tr inside an if")`);
  const trIf = tr.map((v, i) => (i % 3 === 0 ? v : 0));
  check('bug 6: a variable read on some bars only is still the whole series (ta.tr inside an if)', !ri.err && sameSeries(plotOf(ri, 'tr inside an if'), trIf, 0) === '', ri.err || sameSeries(plotOf(ri, 'tr inside an if'), trIf, 0));
}

/* ---- 14. bug 7: arrays, matrices and maps are refused in the engine's own words ------------ */
{
  const head = `//@version=6\nindicator("x")\n`;
  const cases: [string, RegExp][] = [
    [`a = array.new_float(10)\nplot(close)`, /array\.\* is not in this version yet/],
    [`float[] xs = array.new_float(0)\nplot(close)`, /array\.\* is not in this version yet/],
    [`array<float> xs = array.new<float>()\nplot(close)`, /array\.\* is not in this version yet/],
    [`var a = array.new<float>(5, 0.0)\nplot(close)`, /array\.\* is not in this version yet/],
    [`m = matrix.new<float>(2, 2, 0.0)\nplot(close)`, /matrix\.\* is not in this version yet/],
    [`m = map.new<string, float>()\nplot(close)`, /map\.\* is not in this version yet/],
    [`f(float[] xs) => 1\nplot(close)`, /array\.\* is not in this version yet/],
  ];
  const bad = cases.map(([src, re]) => compileFails(head + src, re)).filter(m => !/^line \d+: /.test(m) || m.startsWith('WRONG'));
  check('bug 7: arrays, matrices and maps are named as not yet, when the script is read', bad.length === 0, bad.join('; '));
}

/* ---- 15. bug 8: location.absolute stands at the price given --------------------------------- */
{
  const r = tryRun(`//@version=6
indicator("Absolute")
plotshape(close > open ? high + 1 : na, "over", shape.circle, location.absolute)
plotshape(bar_index % 7 == 0 ? 0 : na, "on zero", shape.diamond, location.absolute)
plotchar(close < open ? low - 1 : na, "under", "x", location.absolute)
plot(close)`);
  const shapes = r.r?.shapes ?? [];
  const over = shapes[0];
  const zero = shapes[1];
  const under = shapes[2];
  const wantOver = bars.map(x => (x.close > x.open ? x.high + 1 : NaN));
  const wantUnder = bars.map(x => (x.close < x.open ? x.low - 1 : NaN));
  const wantZero = bars.map((_, i) => (i % 7 === 0 ? 0 : NaN));
  check('bug 8: a location.absolute shape carries its price, a price of 0 included', !r.err && !!over && sameSeries(over.values, wantOver, 0) === '' && sameSeries(under.values, wantUnder, 0) === '' && sameSeries(zero.values, wantZero, 0) === '', r.err || (zero ? sameSeries(zero.values, wantZero, 0) : 'no shapes'));
  const marks = over ? markersFor(over, bars) : [];
  const zeroMarks = zero ? markersFor(zero, bars) : [];
  const off = [...marks, ...zeroMarks].filter((m, k) => {
    const all = [...wantOver.filter(v => !Number.isNaN(v)), ...wantZero.filter(v => !Number.isNaN(v))];
    return m.position !== 'atPriceMiddle' || (m as { price?: number }).price !== all[k];
  });
  check('bug 8: the chart draws an absolute mark at its price (atPriceMiddle, price set)', marks.length > 0 && zeroMarks.length > 0 && off.length === 0, off.slice(0, 2).map(m => JSON.stringify(m)).join(' '));
  const above = markersFor({ ...over!, location: 'abovebar' }, bars)[0];
  check('bug 8: an above-the-bar mark still stands above the bar', above?.position === 'aboveBar', above?.position);
}

/* ---- 16. bug 9: the shipped scripts wear the house's inks and say what is true ------------- */
{
  const shipped = builtinScripts();
  const bySlug = (slug: string) => shipped.find(s => s.id === `builtin:${slug}`)!;
  const ink = (hex: string) => hex.toLowerCase();
  const feed = { callWall: 485, putWall: 476, flip: 480, supreme: 482 };
  const wallWrong: string[] = [];
  for (const slug of ['walls', 'distance-to-walls', 'wall-approach']) {
    const s = bySlug(slug);
    const r = tryRun(s.source, bars, { slayer: feed });
    if (!r.r) {
      wallWrong.push(`${slug}: ${r.err}`);
      continue;
    }
    for (const out of [...r.r.plots, ...r.r.shapes]) {
      const t = out.title.toLowerCase();
      const want = t.includes('call wall') ? ink(CALL_WALL) : t.includes('put wall') ? ink(PUT_WALL) : null;
      if (want && out.ink !== want) wallWrong.push(`${slug} "${out.title}" ${out.ink} want ${want}`);
      if (want && [ink(BULL), ink(BEAR)].includes(out.ink)) wallWrong.push(`${slug} "${out.title}" wears the direction pair`);
    }
  }
  check('bug 9: every shipped wall wears the house\'s wall inks (palette CALL_WALL / PUT_WALL), never bull/bear', wallWrong.length === 0, wallWrong.join('; '));
  const walls = bySlug('walls');
  check('bug 9: "The walls" no longer says the call wall is above and the put wall below', !/\babove\b|\bbelow\b/i.test(walls.description), walls.description);
  /* the MACD left the shelf on 2026-10-15 (approval 5); the source a reader who had it keeps is held to the same rule */
  const macd = tryRun(retiredBuiltin('builtin:macd')!.source);
  const hist = macd.r?.plots.find(p => p.title === 'Histogram');
  const steel = (css: string) => /^rgba\(226, 234, 244, 0\.3\)$/.test(css);
  check('bug 9: the Pine MACD\'s histogram is the built-in\'s one steel wash, not red and green', !!hist && hist.colors === null && steel(hist.ink), hist ? `${hist.ink} ${hist.colors ? 'per-bar colours' : ''}` : macd.err);
  const obvSrc = bySlug('obv').source;
  const obvRun = tryRun(obvSrc);
  check('bug 9: the OBV script reads ta.obv as TradingView writes it — a variable, no brackets', /\bta\.obv\b(?!\s*\()/.test(obvSrc) && !/ta\.obv\s*\(/.test(obvSrc) && !!obvRun.r, obvRun.err || obvSrc.split('\n').pop());
}

/* ---- 17. bug 10: the editor prints its chords through modKey -------------------------------- */
{
  const text = readFileSync(new URL('../src/components/scripts/ScriptEditor.tsx', import.meta.url), 'utf8');
  const literal = text.match(/Ctrl[ +](S|Enter)\b/g) ?? [];
  check('bug 10: the script editor prints no literal "Ctrl S" / "Ctrl Enter" — modKey says the machine\'s own', literal.length === 0 && /modKey\('S'\)/.test(text) && /modKey\('Enter'\)/.test(text), literal.join(', '));
}

/* ---- 18. every shipped script compiles and runs over 5,000 bars ------------------------------ */
{
  const many = walk(5000, Date.UTC(2026, 9, 1, 13, 30) / 1000, 60, 4242);
  const last = many[many.length - 1].close;
  const feed = { callWall: Math.round(last) + 5, putWall: Math.round(last) - 5, flip: Math.round(last), supreme: Math.round(last) + 2 };
  const rows: string[] = [];
  const broken: string[] = [];
  const slow: string[] = [];
  for (const s of builtinScripts()) {
    if (s.status !== 'ok') {
      broken.push(`${s.title}: ${s.error?.message}`);
      continue;
    }
    try {
      const c = compile(s.source);
      run(c, many.slice(0, 200), { timeframe: '1m', slayer: feed, budgetMs: 10_000 }); // a warm-up, so the time below is the run's own
      const t0 = performance.now();
      const r = run(c, many, { timeframe: '1m', slayer: feed, budgetMs: 10_000 });
      const ms = performance.now() - t0;
      const drew = r.plots.length + r.shapes.length + r.hlines.length + r.fills.length;
      rows.push(`${s.title.padEnd(24)} ${ms.toFixed(1).padStart(7)} ms   ${drew} outputs`);
      if (drew === 0) broken.push(`${s.title}: drew nothing`);
      if (ms > SCRIPT_CAPS.budgetMs) slow.push(`${s.title} ${ms.toFixed(0)} ms`);
    } catch (e) {
      broken.push(`${s.title}: ${explain(e).message}`);
    }
  }
  console.log(`\n  every shipped script over 5,000 one-minute bars:\n  ${rows.join('\n  ')}\n`);
  check(`all ${builtinScripts().length} shipped scripts compile, run and draw over 5,000 bars`, broken.length === 0, broken.join('; '));
  check(`each shipped script runs inside the terminal's ${SCRIPT_CAPS.budgetMs} ms budget over 5,000 bars`, slow.length === 0, slow.join('; '));
}

/* ---- 19. barcolor(): the bars' colours, as Pine lays them (approval 13) ------------------------- */
{
  const BLUE = toCss(named('blue')!);
  const ORANGE = toCss(named('orange')!);
  const up = (i: number) => bars[i].close > bars[i].open;
  const n = bars.length;
  const first = (got: (string | null)[] | null, want: (i: number) => string | null) => {
    if (!got) return 'no barcolors';
    if (got.length !== n) return `${got.length} bars, want ${n}`;
    for (let i = 0; i < n; i++) if (got[i] !== want(i)) return `bar ${i}: got ${got[i]} want ${want(i)}`;
    return '';
  };
  const runOf = (body: string) => tryRun(`//@version=6\nindicator("Bars", overlay=true)\n${body}\n`);
  const plain = runOf('barcolor(close > open ? color.blue : na)');
  const wantPlain = (i: number) => (up(i) ? BLUE : null);
  check('barcolor: a colour on the bars it returns one, none where it returns na', !plain.err && first(plain.r!.barcolors, wantPlain) === '', plain.err || first(plain.r!.barcolors, wantPlain));
  const none = runOf('barcolor(na)');
  const noneOk = !none.err && !!none.r!.barcolors && none.r!.barcolors.every(c => c === null);
  check('barcolor: na on every bar leaves every bar its own colour', noneOk, noneOk ? '' : none.err || (none.r!.barcolors ? `a colour: ${none.r!.barcolors.find(c => c !== null)}` : 'no barcolors'));
  const never = runOf('plot(close)');
  check('barcolor: a script that never calls it hands back no colours', !never.err && never.r!.barcolors === null, never.err || (never.r!.barcolors === null ? '' : 'colours handed back'));
  const right = runOf('barcolor(close > open ? color.blue : na, offset = 2)');
  const wantRight = (i: number) => (i >= 2 && up(i - 2) ? BLUE : null);
  check('barcolor: offset = 2 lays bar i\'s colour on bar i + 2 (the first two bars none)', !right.err && first(right.r!.barcolors, wantRight) === '', right.err || first(right.r!.barcolors, wantRight));
  const left = runOf('barcolor(close > open ? color.blue : na, offset = -1)');
  const wantLeft = (i: number) => (i + 1 < n && up(i + 1) ? BLUE : null);
  check('barcolor: offset = -1 lays bar i\'s colour on bar i − 1 (the last bar none)', !left.err && first(left.r!.barcolors, wantLeft) === '', left.err || first(left.r!.barcolors, wantLeft));
  const two = runOf('barcolor(close > open ? color.blue : na)\nbarcolor(bar_index % 3 == 0 ? color.orange : na)');
  const wantTwo = (i: number) => (i % 3 === 0 ? ORANGE : up(i) ? BLUE : null);
  check('barcolor: two calls — the later one wins a bar both colour, and its na leaves the earlier one\'s', !two.err && first(two.r!.barcolors, wantTwo) === '', two.err || first(two.r!.barcolors, wantTwo));
  const last = runOf('barcolor(color.blue, show_last = 10)');
  const wantLast = (i: number) => (i >= n - 10 ? BLUE : null);
  check('barcolor: show_last = 10 colours the last ten bars alone', !last.err && first(last.r!.barcolors, wantLast) === '', last.err || first(last.r!.barcolors, wantLast));
  const hidden = runOf('barcolor(color.blue, display = display.none)');
  const hiddenOk = !hidden.err && !!hidden.r!.barcolors && hidden.r!.barcolors.every(c => c === null);
  check('barcolor: display = display.none colours nothing', hiddenOk, hiddenOk ? '' : hidden.err || (hidden.r!.barcolors ? `a colour: ${hidden.r!.barcolors.find(c => c !== null)}` : 'no barcolors'));

  /* the chart's side: the pane's runs merged, the light tape's inks, the candle a colour dresses */
  const { barTints, tintPoint, candleTintForm } = layer;
  const hasLayer = !!barTints && !!tintPoint && !!candleTintForm;
  check('barcolor: the chart lays a run\'s colours on the candles (components/gex/barTints)', hasLayer, hasLayer ? '' : 'no components/gex/barTints module');
  if (barTints && tintPoint && candleTintForm) {
    const odd = runOf('barcolor(bar_index % 2 == 1 ? color.orange : na)');
    const tints = barTints([plain.r!, odd.r!], bars);
    const wantTint = (i: number) => (i % 2 === 1 ? ORANGE : up(i) ? BLUE : undefined);
    const off = bars.findIndex((b, i) => tints.get(b.time) !== wantTint(i));
    check('barcolor: two scripts on one pane — the last drawn wins a bar, its na leaves the one before', off === -1, off === -1 ? '' : `bar ${off}: ${tints.get(bars[off].time)} want ${wantTint(off)}`);
    const inked = barTints([plain.r!], bars, (css, kind) => `${kind}:${css}`);
    const firstUp = bars.findIndex((_, i) => up(i));
    check('barcolor: every colour passes through the host\'s ink as a line\'s (a light tape\'s paper inks)', inked.get(bars[firstUp].time) === `line:${BLUE}`, inked.get(bars[firstUp].time) === `line:${BLUE}` ? '' : String(inked.get(bars[firstUp].time)));
    const rise = { time: 1, open: 10, high: 12, low: 9, close: 11 };
    const fall = { time: 2, open: 11, high: 12, low: 9, close: 10 };
    const solid = candleTintForm('#93C9F2', '#93C9F2');
    const hollow = candleTintForm('rgba(0,0,0,0)', '#50A4FF');
    const s1 = tintPoint(rise, BLUE, solid) as unknown as Record<string, unknown>;
    const h1 = tintPoint(rise, BLUE, hollow) as unknown as Record<string, unknown>;
    const h2 = tintPoint(fall, BLUE, hollow) as unknown as Record<string, unknown>;
    const bar = tintPoint(fall, BLUE, { kind: 'bar', hollowUp: null }) as unknown as Record<string, unknown>;
    const bare = tintPoint(rise, undefined, solid) as unknown as Record<string, unknown>;
    const okSolid = s1.color === BLUE && s1.borderColor === BLUE && s1.wickColor === BLUE;
    const okHollow = h1.color === 'rgba(0,0,0,0)' && h1.borderColor === BLUE && h1.wickColor === BLUE && h2.color === BLUE;
    const okBar = bar.color === BLUE && !('wickColor' in bar) && !('color' in bare) && !('borderColor' in bare) && !('wickColor' in bare);
    check('barcolor: a solid candle takes the colour on its body, border and wick', okSolid, okSolid ? '' : JSON.stringify(s1));
    check('barcolor: a hollow theme\'s rising candle stays hollow (border and wick coloured), a falling one fills', okHollow, okHollow ? '' : `${JSON.stringify(h1)} ${JSON.stringify(h2)}`);
    check('barcolor: a bar takes the colour as its one stroke; na leaves a candle its theme\'s colours', okBar, okBar ? '' : `${JSON.stringify(bar)} ${JSON.stringify(bare)}`);
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
