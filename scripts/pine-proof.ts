// THE PINE RUNTIME'S ACCEPTANCE TEST (2026-09-10). Real scripts over synthetic
// bars, every figure checked against an independent implementation written
// here, plus the language's corners (history, var, user functions per call
// site, loops, switch, integer division, inputs) and the refusals (strategies,
// drawings, missing version, undeclared names) with their lines.
//   npx tsx scripts/pine-proof.ts
import { compile, run, runSource, explain } from '../src/core/pine';
import type { Bar } from '../src/core/pine';

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
plot(close, "Lagging span", color = color.new(#D2FF00, 30), offset = -disp + 1)
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
  check('Ichimoku meta: plot inks and titles', c.meta.plots[0].ink === '#7de3ff' && c.meta.plots[2].ink === 'rgba(210, 255, 0, 0.7)' && c.meta.plots[3].title === 'Leading span A', JSON.stringify(c.meta.plots.map(p => [p.title, p.ink])));
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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
