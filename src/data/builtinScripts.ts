/*
==================================================
  SLAYER TERMINAL - THE BUILT-IN SCRIPTS (data/builtinScripts.ts)

  The scripts the terminal ships, as Pine source —
  scripts like any other, owned by the terminal and
  read-only; Make a copy turns one into yours. Two
  shelves: SLAYER, which read the terminal's own
  numbers through `slayer.*` (the one namespace
  beyond Pine), and TECHNICALS, the classics in
  plain Pine v6 that paste straight into TradingView
  and back.
==================================================
*/

import { compile, explain } from '../core/pine';
import type { Script } from '../types/scripts';

interface BuiltinSource {
  slug: string;
  group: 'Slayer' | 'Trend' | 'Bands' | 'Momentum' | 'Volume';
  title: string;
  description: string;
  source: string;
}

const SOURCES: BuiltinSource[] = [
  /* ---- Slayer ---------------------------------------------------------------- */
  {
    slug: 'walls',
    group: 'Slayer',
    title: 'The walls',
    description: "Today's call wall above and put wall below, drawn across the pane, with the corridor between them washed",
    source: `//@version=6
indicator("The walls", overlay = true)

callWall = slayer.callWall
putWall  = slayer.putWall

c = plot(callWall, "Call wall", color = #30D158, linewidth = 1)
p = plot(putWall,  "Put wall",  color = #FF3B30, linewidth = 1)
fill(c, p, color = color.new(#C7D3E8, 96), title = "The corridor")
alertcondition(ta.crossover(close, callWall),  "Through the call wall", "{{ticker}} closed above the call wall")
alertcondition(ta.crossunder(close, putWall),  "Through the put wall",  "{{ticker}} closed below the put wall")`,
  },
  {
    slug: 'flip',
    group: 'Slayer',
    title: 'The flip',
    description: 'Where dealer gamma changes sign — the line, and a wash under it while price sits below',
    source: `//@version=6
indicator("The flip", overlay = true)

flip = slayer.flip
plot(flip, "Flip", color = #C7D3E8, linewidth = 1)
bgcolor(close < flip ? color.new(#FF3B30, 94) : na, title = "Below the flip")
alertcondition(ta.cross(close, flip), "Crossed the flip", "{{ticker}} crossed the flip")`,
  },
  {
    slug: 'supreme',
    group: 'Slayer',
    title: 'The supreme strike',
    description: 'The single heaviest strike on the book, in the champion ink',
    source: `//@version=6
indicator("The supreme strike", overlay = true)

plot(slayer.supreme, "Supreme", color = #EA00FF, linewidth = 2)`,
  },
  {
    slug: 'distance-to-walls',
    group: 'Slayer',
    title: 'Distance to the walls',
    description: 'How far price sits from the call wall and the put wall, in percent, in its own pane',
    source: `//@version=6
indicator("Distance to the walls")

toCall = (slayer.callWall - close) / close * 100
toPut  = (close - slayer.putWall) / close * 100

plot(toCall, "To the call wall", color = #30D158)
plot(toPut,  "To the put wall",  color = #FF3B30)
hline(0, "Touching", color = color.new(#C7D3E8, 60), linestyle = hline.style_dotted)`,
  },
  {
    slug: 'wall-approach',
    group: 'Slayer',
    title: 'Wall approach',
    description: 'A mark under the bar when price comes within a quarter percent of a wall',
    source: `//@version=6
indicator("Wall approach", overlay = true)

near = input.float(0.25, "Within (%)", minval = 0.05, step = 0.05)
nearCall = math.abs(slayer.callWall - close) / close * 100 <= near
nearPut  = math.abs(close - slayer.putWall) / close * 100 <= near

plotshape(nearCall, "Near the call wall", shape.triangledown, location.abovebar, #30D158, size = size.tiny)
plotshape(nearPut,  "Near the put wall",  shape.triangleup,   location.belowbar, #FF3B30, size = size.tiny)`,
  },

  /* ---- Trend ------------------------------------------------------------------- */
  {
    slug: 'moving-average',
    group: 'Trend',
    title: 'Moving average',
    description: 'One average of your choosing — simple, exponential, weighted, Hull or volume-weighted',
    source: `//@version=6
indicator("Moving average", overlay = true)

len  = input.int(20, "Length", minval = 1)
kind = input.string("EMA", "Kind", options = ["SMA", "EMA", "WMA", "HMA", "VWMA"])
src  = input.source(close, "Source")

ma = switch kind
    "SMA"  => ta.sma(src, len)
    "WMA"  => ta.wma(src, len)
    "HMA"  => ta.hma(src, len)
    "VWMA" => ta.vwma(src, len)
    => ta.ema(src, len)

plot(ma, "MA", color = #5B9CF6, linewidth = 2)`,
  },
  {
    slug: 'ema-ribbon',
    group: 'Trend',
    title: 'EMA ribbon',
    description: 'The 9, 21 and 50 exponential averages together — the ribbon opens in a trend and knots in a range',
    source: `//@version=6
indicator("EMA ribbon", overlay = true)

plot(ta.ema(close, 9),  "EMA 9",  color = #5B9CF6)
plot(ta.ema(close, 21), "EMA 21", color = #BBB2E8)
plot(ta.ema(close, 50), "EMA 50", color = #EDE4CD)`,
  },
  {
    slug: 'vwap',
    group: 'Trend',
    title: 'VWAP',
    description: 'The session volume-weighted average price, restarting each day',
    source: `//@version=6
indicator("VWAP", overlay = true)

plot(ta.vwap(hlc3), "VWAP", color = #6BD3C7, linewidth = 2)`,
  },
  {
    slug: 'supertrend',
    group: 'Trend',
    title: 'Supertrend',
    description: 'An ATR stop that only ever moves in the trend — green under price, red over it',
    source: `//@version=6
indicator("Supertrend", overlay = true)

factor = input.float(3.0, "Factor", minval = 0.5, step = 0.5)
atrLen = input.int(10, "ATR length", minval = 1)

[st, dir] = ta.supertrend(factor, atrLen)
up   = dir < 0 ? st : na
down = dir > 0 ? st : na
plot(up,   "Up trend",   color = #30D158, linewidth = 2, style = plot.style_linebr)
plot(down, "Down trend", color = #FF3B30, linewidth = 2, style = plot.style_linebr)
alertcondition(ta.change(dir) != 0, "Trend turned", "{{ticker}} supertrend turned")`,
  },
  {
    slug: 'parabolic-sar',
    group: 'Trend',
    title: 'Parabolic SAR',
    description: 'The trailing stop as dots — under the tape while price climbs, over it while it falls',
    source: `//@version=6
indicator("Parabolic SAR", overlay = true)

start = input.float(0.02, "Start", step = 0.01)
inc   = input.float(0.02, "Increment", step = 0.01)
maxAf = input.float(0.2,  "Maximum", step = 0.05)

sar = ta.sar(start, inc, maxAf)
plot(sar, "SAR", color = sar < close ? #30D158 : #FF3B30, style = plot.style_circles, linewidth = 1)`,
  },
  {
    slug: 'ichimoku',
    group: 'Trend',
    title: 'Ichimoku Cloud',
    description: 'The conversion and base lines, the lagging span, and the cloud drawn ahead of price',
    source: `//@version=6
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
alertcondition(ta.crossover(conv, base),  "Conversion crossed up",   "{{ticker}} tenkan crossed above kijun")
alertcondition(ta.crossunder(conv, base), "Conversion crossed down", "{{ticker}} tenkan crossed below kijun")`,
  },

  /* ---- Bands ------------------------------------------------------------------- */
  {
    slug: 'bollinger',
    group: 'Bands',
    title: 'Bollinger Bands',
    description: 'A 20-bar average two deviations either side — the squeeze and the stretch',
    source: `//@version=6
indicator("Bollinger Bands", overlay = true)

len  = input.int(20, "Length", minval = 1)
mult = input.float(2.0, "Deviations", minval = 0.5, step = 0.25)

[basis, upper, lower] = ta.bb(close, len, mult)
plot(basis, "Basis", color = #C7A9CF)
u = plot(upper, "Upper", color = color.new(#C7A9CF, 40))
l = plot(lower, "Lower", color = color.new(#C7A9CF, 40))
fill(u, l, color = color.new(#C7A9CF, 94), title = "Band")`,
  },
  {
    slug: 'keltner',
    group: 'Bands',
    title: 'Keltner Channels',
    description: 'An EMA with ATR shoulders — the channel a trend rides inside',
    source: `//@version=6
indicator("Keltner Channels", overlay = true)

len   = input.int(20, "Length", minval = 1)
mult  = input.float(2.0, "ATR multiple", minval = 0.5, step = 0.25)
atrLn = input.int(10, "ATR length", minval = 1)

basis = ta.ema(close, len)
band  = ta.atr(atrLn) * mult
plot(basis, "Basis", color = #D8BC8F)
u = plot(basis + band, "Upper", color = color.new(#D8BC8F, 40))
l = plot(basis - band, "Lower", color = color.new(#D8BC8F, 40))
fill(u, l, color = color.new(#D8BC8F, 94), title = "Channel")`,
  },
  {
    slug: 'donchian',
    group: 'Bands',
    title: 'Donchian Channels',
    description: 'The highest high and lowest low of the last N bars — the envelope a breakout leaves',
    source: `//@version=6
indicator("Donchian Channels", overlay = true)

len = input.int(20, "Length", minval = 1)
u = plot(ta.highest(high, len), "Upper", color = color.new(#6BD3C7, 30))
l = plot(ta.lowest(low, len),   "Lower", color = color.new(#6BD3C7, 30))
plot(math.avg(ta.highest(high, len), ta.lowest(low, len)), "Middle", color = color.new(#6BD3C7, 60))
fill(u, l, color = color.new(#6BD3C7, 95), title = "Channel")`,
  },

  /* ---- Momentum ----------------------------------------------------------------- */
  {
    slug: 'rsi',
    group: 'Momentum',
    title: 'RSI',
    description: "Wilder's relative strength, 0 to 100, read against the 30 and 70 rails",
    source: `//@version=6
indicator("RSI")

len = input.int(14, "Length", minval = 1)
rsi = ta.rsi(close, len)
plot(rsi, "RSI", color = #A9C77F, linewidth = 2)
hline(70, "Overbought", color = color.new(#C7D3E8, 70), linestyle = hline.style_dotted)
hline(30, "Oversold",   color = color.new(#C7D3E8, 70), linestyle = hline.style_dotted)
alertcondition(ta.crossover(rsi, 70),  "Above 70", "{{ticker}} RSI crossed above 70")
alertcondition(ta.crossunder(rsi, 30), "Below 30", "{{ticker}} RSI crossed below 30")`,
  },
  {
    slug: 'macd',
    group: 'Momentum',
    title: 'MACD',
    description: 'The 12 and 26 averages, their 9-bar signal, and the histogram between them',
    source: `//@version=6
indicator("MACD")

fast = input.int(12, "Fast", minval = 1)
slow = input.int(26, "Slow", minval = 1)
sig  = input.int(9,  "Signal", minval = 1)

[m, s, h] = ta.macd(close, fast, slow, sig)
plot(h, "Histogram", color = h >= 0 ? color.new(#30D158, 40) : color.new(#FF3B30, 40), style = plot.style_histogram)
plot(m, "MACD",   color = #5B9CF6)
plot(s, "Signal", color = #D8A6A6)
hline(0, "Zero", color = color.new(#C7D3E8, 80))`,
  },
  {
    slug: 'stochastic',
    group: 'Momentum',
    title: 'Stochastic',
    description: 'Where the close sits in the recent range, smoothed twice',
    source: `//@version=6
indicator("Stochastic")

len = input.int(14, "Length", minval = 1)
kS  = input.int(3, "%K smoothing", minval = 1)
dS  = input.int(3, "%D smoothing", minval = 1)

k = ta.sma(ta.stoch(close, high, low, len), kS)
d = ta.sma(k, dS)
plot(k, "%K", color = #5B9CF6)
plot(d, "%D", color = #FF9500)
hline(80, "Upper", color = color.new(#C7D3E8, 70), linestyle = hline.style_dotted)
hline(20, "Lower", color = color.new(#C7D3E8, 70), linestyle = hline.style_dotted)`,
  },
  {
    slug: 'atr',
    group: 'Momentum',
    title: 'ATR',
    description: 'The average true range — how far a bar travels, in price',
    source: `//@version=6
indicator("ATR")

len = input.int(14, "Length", minval = 1)
plot(ta.atr(len), "ATR", color = #D8BC8F, linewidth = 2)`,
  },
  {
    slug: 'adx',
    group: 'Momentum',
    title: 'ADX and DI',
    description: 'Trend strength, with the two directional lines that make it',
    source: `//@version=6
indicator("ADX and DI")

diLen  = input.int(14, "DI length", minval = 1)
adxLen = input.int(14, "ADX smoothing", minval = 1)

[dp, dm, adx] = ta.dmi(diLen, adxLen)
plot(adx, "ADX", color = #C7D3E8, linewidth = 2)
plot(dp,  "+DI", color = #30D158)
plot(dm,  "-DI", color = #FF3B30)
hline(25, "Trending", color = color.new(#C7D3E8, 70), linestyle = hline.style_dotted)`,
  },
  {
    slug: 'cci',
    group: 'Momentum',
    title: 'CCI',
    description: 'The commodity channel index — price against its own average, in deviations',
    source: `//@version=6
indicator("CCI")

len = input.int(20, "Length", minval = 1)
plot(ta.cci(hlc3, len), "CCI", color = #BBB2E8)
hline(100,  "Upper", color = color.new(#C7D3E8, 70), linestyle = hline.style_dotted)
hline(-100, "Lower", color = color.new(#C7D3E8, 70), linestyle = hline.style_dotted)`,
  },
  {
    slug: 'williams-r',
    group: 'Momentum',
    title: 'Williams %R',
    description: 'The close against the recent high, 0 to −100',
    source: `//@version=6
indicator("Williams %R")

len = input.int(14, "Length", minval = 1)
plot(ta.wpr(len), "%R", color = #A9C77F)
hline(-20, "Upper", color = color.new(#C7D3E8, 70), linestyle = hline.style_dotted)
hline(-80, "Lower", color = color.new(#C7D3E8, 70), linestyle = hline.style_dotted)`,
  },

  /* ---- Volume ------------------------------------------------------------------- */
  {
    slug: 'mfi',
    group: 'Volume',
    title: 'Money flow index',
    description: 'RSI weighted by volume — where the money went, 0 to 100',
    source: `//@version=6
indicator("Money flow index")

len = input.int(14, "Length", minval = 1)
plot(ta.mfi(hlc3, len), "MFI", color = #6BD3C7, linewidth = 2)
hline(80, "Upper", color = color.new(#C7D3E8, 70), linestyle = hline.style_dotted)
hline(20, "Lower", color = color.new(#C7D3E8, 70), linestyle = hline.style_dotted)`,
  },
  {
    slug: 'obv',
    group: 'Volume',
    title: 'On-balance volume',
    description: 'Volume added on up bars and taken on down bars — a running count of conviction',
    source: `//@version=6
indicator("On-balance volume")

plot(ta.obv(), "OBV", color = #EDE4CD)`,
  },
];

let cache: Script[] | null = null;

/** The built-ins as scripts — compiled once so the library has their meta */
export function builtinScripts(): Script[] {
  if (cache) return cache;
  const at = Date.UTC(2026, 8, 10);
  cache = SOURCES.map(s => {
    const id = `builtin:${s.slug}`;
    try {
      const c = compile(s.source);
      return {
        id,
        ownerId: 'slayer',
        shelf: 'built-in' as const,
        title: s.title,
        description: s.description,
        tags: [s.group],
        visibility: 'public' as const,
        source: s.source,
        sourceHash: hashSource(s.source),
        meta: c.meta,
        status: 'ok' as const,
        version: 1,
        readOnly: true,
        createdAt: at,
        updatedAt: at,
        publishedAt: at,
      };
    } catch (e) {
      const { line, message } = explain(e);
      return {
        id,
        ownerId: 'slayer',
        shelf: 'built-in' as const,
        title: s.title,
        description: s.description,
        tags: [s.group],
        visibility: 'public' as const,
        source: s.source,
        sourceHash: hashSource(s.source),
        meta: null,
        status: 'error' as const,
        error: { line, message },
        version: 1,
        readOnly: true,
        createdAt: at,
        updatedAt: at,
      };
    }
  });
  return cache;
}

/** FNV-1a over the text, as hex — the same save twice is known for what it is */
export function hashSource(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** The template a new script opens on */
export const NEW_SCRIPT_SOURCE = `//@version=6
indicator("My script", overlay = true)

len = input.int(20, "Length", minval = 1)
ma  = ta.ema(close, len)

plot(ma, "EMA", color = #5B9CF6, linewidth = 2)
`;
