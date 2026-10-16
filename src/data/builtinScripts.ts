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

  THE WALLS WEAR THE HOUSE'S WALL INKS (2026-10-15,
  the audit): a script cannot read a token, so a wall
  is written in palette.ts's CALL_WALL and PUT_WALL
  hexes — gold for the call wall, violet for the put
  wall — and the direction pair stays for direction
  only (a trend's up and down). A wall is read off the
  book wherever the price stands, so no word puts the
  call wall above or the put wall below. The MACD's
  histogram is the chart's own steel wash, and OBV is
  read as TradingView writes it, `ta.obv`.

  UP AND DOWN ARE THE CANDLES' (the owner, 2026-10-15:
  "Shipped scripts (Supertrend and the rest): up/down
  inks use the candles' colours, so they follow every
  Colours option"): a script cannot read the chart's
  theme, so a direction is written in palette.ts's
  BULL and BEAR and the chart draws a shipped
  script's pair in its candles' up and down
  (indicatorInks scriptInksWith) — Supertrend, the
  SAR, ADX's ±DI, Ichimoku's leading spans and its
  cloud, a faint wash. A copy the reader never changed
  draws as the shipped one does — the house's text of
  today under its id, whatever day it was copied on
  (inksBy, drawnText, FORMER_TEXTS); once edited it
  is the reader's own and keeps the colours its code
  sets.

  EVERY OTHER LINE WEARS ITS OWN INK (2026-10-15 —
  the owner's approvals 4 and 5): the family in
  components/gex/indicatorInks.ts, off the field's
  gold and violet and apart from each other, the
  compare lines and the chart's own indicators. The
  six scripts that repeated a chart built-in (EMA
  ribbon, VWAP, Bollinger Bands, RSI, MACD, ATR) left
  the shelf; a reader who had one on a pane keeps it
  as a script of their own (RETIRED, data/
  scriptStore.ts keepAsOwn). "The flip" draws its
  line in the flip's own grey and no wash (the
  owner, approval 11: "Red carries no meaning on
  Terrain").
==================================================
*/

import { compile, explain } from '../core/pine';
import type { Script } from '../types/scripts';
import { INDICATOR_INKS, MACD_SIGNAL_INK, SCRIPT_INKS, inkNow } from '../components/gex/indicatorInks';
import { BEAR, BULL, CALL_WALL, FLIP, PUT_WALL, SUPREME } from '../components/gex/palette';

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
    description: "Today's call wall and put wall — the book's heaviest call and put strikes, wherever the price stands — drawn across the pane, with the corridor between them washed",
    source: `//@version=6
indicator("The walls", overlay = true)

// The walls wear the terminal's own inks: gold for the call wall, violet for the put wall
callWall = slayer.callWall
putWall  = slayer.putWall

c = plot(callWall, "Call wall", color = ${CALL_WALL}, linewidth = 1)
p = plot(putWall,  "Put wall",  color = ${PUT_WALL}, linewidth = 1)
fill(c, p, color = color.new(#C7D3E8, 96), title = "The corridor")
alertcondition(ta.crossover(close, callWall),  "Through the call wall", "{{ticker}} closed above the call wall")
alertcondition(ta.crossunder(close, putWall),  "Through the put wall",  "{{ticker}} closed below the put wall")`,
  },
  {
    slug: 'flip',
    group: 'Slayer',
    title: 'The flip',
    description: "Where dealer gamma changes sign, drawn across the pane in the flip's own grey",
    source: `//@version=6
indicator("The flip", overlay = true)

flip = slayer.flip
plot(flip, "Flip", color = ${FLIP}, linewidth = 1)
alertcondition(ta.cross(close, flip), "Crossed the flip", "{{ticker}} crossed the flip")`,
  },
  {
    slug: 'supreme',
    group: 'Slayer',
    title: 'The supreme strike',
    description: 'The single heaviest strike on the book, in the champion ink',
    source: `//@version=6
indicator("The supreme strike", overlay = true)

plot(slayer.supreme, "Supreme", color = ${SUPREME}, linewidth = 2)`,
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

plot(toCall, "To the call wall", color = ${CALL_WALL})
plot(toPut,  "To the put wall",  color = ${PUT_WALL})
hline(0, "Touching", color = color.new(#C7D3E8, 60), linestyle = hline.style_dotted)`,
  },
  {
    slug: 'wall-approach',
    group: 'Slayer',
    title: 'Wall approach',
    description: 'A mark when price comes within a quarter percent of a wall — over the bar for the call wall, under it for the put wall',
    source: `//@version=6
indicator("Wall approach", overlay = true)

near = input.float(0.25, "Within (%)", minval = 0.05, step = 0.05)
nearCall = math.abs(slayer.callWall - close) / close * 100 <= near
nearPut  = math.abs(close - slayer.putWall) / close * 100 <= near

plotshape(nearCall, "Near the call wall", shape.circle, location.abovebar, ${CALL_WALL}, size = size.tiny)
plotshape(nearPut,  "Near the put wall",  shape.circle, location.belowbar, ${PUT_WALL}, size = size.tiny)`,
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

plot(ma, "MA", color = ${SCRIPT_INKS.movingAverage}, linewidth = 2)`,
  },
  {
    slug: 'supertrend',
    group: 'Trend',
    title: 'Supertrend',
    description: "An ATR stop that only ever moves in the trend — in the candles' up colour under price, their down colour over it",
    source: `//@version=6
indicator("Supertrend", overlay = true)

factor = input.float(3.0, "Factor", minval = 0.5, step = 0.5)
atrLen = input.int(10, "ATR length", minval = 1)

[st, dir] = ta.supertrend(factor, atrLen)
up   = dir < 0 ? st : na
down = dir > 0 ? st : na
plot(up,   "Up trend",   color = ${BULL}, linewidth = 2, style = plot.style_linebr)
plot(down, "Down trend", color = ${BEAR}, linewidth = 2, style = plot.style_linebr)
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
plot(sar, "SAR", color = sar < close ? ${BULL} : ${BEAR}, style = plot.style_circles, linewidth = 1)`,
  },
  {
    slug: 'ichimoku',
    group: 'Trend',
    title: 'Ichimoku Cloud',
    description: "The conversion and base lines, the lagging span, and the cloud drawn ahead of price in the candles' up and down colours",
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

plot(conv, "Conversion", color = ${SCRIPT_INKS.ichimokuConversion})
plot(base, "Base", color = ${SCRIPT_INKS.ichimokuBase})
plot(close, "Lagging span", color = color.new(${SCRIPT_INKS.ichimokuLagging}, 30), offset = -disp + 1)
a = plot(spanA, "Leading span A", color = color.new(${BULL}, 55), offset = disp - 1)
b = plot(spanB, "Leading span B", color = color.new(${BEAR}, 55), offset = disp - 1)
fill(a, b, color = spanA > spanB ? color.new(${BULL}, 88) : color.new(${BEAR}, 88), title = "Cloud")
alertcondition(ta.crossover(conv, base),  "Conversion crossed up",   "{{ticker}} tenkan crossed above kijun")
alertcondition(ta.crossunder(conv, base), "Conversion crossed down", "{{ticker}} tenkan crossed below kijun")`,
  },

  /* ---- Bands ------------------------------------------------------------------- */
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
plot(basis, "Basis", color = ${SCRIPT_INKS.keltner})
u = plot(basis + band, "Upper", color = color.new(${SCRIPT_INKS.keltner}, 40))
l = plot(basis - band, "Lower", color = color.new(${SCRIPT_INKS.keltner}, 40))
fill(u, l, color = color.new(${SCRIPT_INKS.keltner}, 94), title = "Channel")`,
  },
  {
    slug: 'donchian',
    group: 'Bands',
    title: 'Donchian Channels',
    description: 'The highest high and lowest low of the last N bars — the envelope a breakout leaves',
    source: `//@version=6
indicator("Donchian Channels", overlay = true)

len = input.int(20, "Length", minval = 1)
u = plot(ta.highest(high, len), "Upper", color = color.new(${SCRIPT_INKS.donchian}, 30))
l = plot(ta.lowest(low, len),   "Lower", color = color.new(${SCRIPT_INKS.donchian}, 30))
plot(math.avg(ta.highest(high, len), ta.lowest(low, len)), "Middle", color = color.new(${SCRIPT_INKS.donchian}, 60))
fill(u, l, color = color.new(${SCRIPT_INKS.donchian}, 95), title = "Channel")`,
  },

  /* ---- Momentum ----------------------------------------------------------------- */
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
plot(k, "%K", color = ${SCRIPT_INKS.stochasticK})
plot(d, "%D", color = ${SCRIPT_INKS.stochasticD})
hline(80, "Upper", color = color.new(#C7D3E8, 70), linestyle = hline.style_dotted)
hline(20, "Lower", color = color.new(#C7D3E8, 70), linestyle = hline.style_dotted)`,
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
plot(adx, "ADX", color = ${SCRIPT_INKS.adx}, linewidth = 2)
plot(dp,  "+DI", color = ${BULL})
plot(dm,  "-DI", color = ${BEAR})
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
plot(ta.cci(hlc3, len), "CCI", color = ${SCRIPT_INKS.cci})
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
plot(ta.wpr(len), "%R", color = ${SCRIPT_INKS.williamsR})
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
plot(ta.mfi(hlc3, len), "MFI", color = ${SCRIPT_INKS.mfi}, linewidth = 2)
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

plot(ta.obv, "OBV", color = ${SCRIPT_INKS.obv})`,
  },
];

/*
  THE SIX THAT LEFT THE SHELF (2026-10-15 — the owner, approval 5: "Drop the six Pine scripts that duplicate built-ins:
  approved"). Each repeated a line the chart draws itself from the Indicators menu (EMA 9/21/50, VWAP, Bollinger, RSI 14,
  MACD, ATR 14). A placement names a script by id ("builtin:rsi"), so a reader who had one on a pane, starred, or behind
  an alert would have lost it in silence (data/paneScripts.ts lifts a placement whose script is gone): the store keeps
  each such one ONCE as a script of the reader's own under the same id, with this source — the reader's inputs, alerts
  and favourite stand — and never offers it to anyone else (data/scriptStore.ts keepAsOwn). The inks are the chart
  built-in's own, so the copy and the menu's line agree.
*/
const RETIRED_SOURCES: BuiltinSource[] = [
  {
    slug: 'ema-ribbon',
    group: 'Trend',
    title: 'EMA ribbon',
    description: 'The 9, 21 and 50 exponential averages together — the ribbon opens in a trend and knots in a range',
    source: `//@version=6
indicator("EMA ribbon", overlay = true)

plot(ta.ema(close, 9),  "EMA 9",  color = ${INDICATOR_INKS.ema9})
plot(ta.ema(close, 21), "EMA 21", color = ${INDICATOR_INKS.ema21})
plot(ta.ema(close, 50), "EMA 50", color = ${INDICATOR_INKS.ema50})`,
  },
  {
    slug: 'vwap',
    group: 'Trend',
    title: 'VWAP',
    description: 'The session volume-weighted average price, restarting each day',
    source: `//@version=6
indicator("VWAP", overlay = true)

plot(ta.vwap(hlc3), "VWAP", color = ${INDICATOR_INKS.vwap}, linewidth = 2)`,
  },
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
plot(basis, "Basis", color = ${INDICATOR_INKS.bb})
u = plot(upper, "Upper", color = color.new(${INDICATOR_INKS.bb}, 40))
l = plot(lower, "Lower", color = color.new(${INDICATOR_INKS.bb}, 40))
fill(u, l, color = color.new(${INDICATOR_INKS.bb}, 94), title = "Band")`,
  },
  {
    slug: 'rsi',
    group: 'Momentum',
    title: 'RSI',
    description: "Wilder's relative strength, 0 to 100, read against the 30 and 70 rails",
    source: `//@version=6
indicator("RSI")

len = input.int(14, "Length", minval = 1)
rsi = ta.rsi(close, len)
plot(rsi, "RSI", color = ${INDICATOR_INKS.rsi}, linewidth = 2)
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
// One steel wash for the bars, as the chart's own MACD: the sign of momentum is not a price direction
plot(h, "Histogram", color = color.new(#E2EAF4, 70), style = plot.style_histogram)
plot(m, "MACD",   color = ${INDICATOR_INKS.macd})
plot(s, "Signal", color = ${MACD_SIGNAL_INK})
hline(0, "Zero", color = color.new(#C7D3E8, 80))`,
  },
  {
    slug: 'atr',
    group: 'Momentum',
    title: 'ATR',
    description: 'The average true range — how far a bar travels, in price',
    source: `//@version=6
indicator("ATR")

len = input.int(14, "Length", minval = 1)
plot(ta.atr(len), "ATR", color = ${INDICATOR_INKS.atrPane}, linewidth = 2)`,
  },
];

/** A script that left the shelf, by its old id — its title, words and source, as a reader keeps it */
export function retiredBuiltin(id: string): { title: string; description: string; tags: string[]; source: string } | null {
  const s = RETIRED_SOURCES.find(r => `builtin:${r.slug}` === id);
  return s ? { title: s.title, description: s.description, tags: [s.group], source: s.source } : null;
}

/** The old ids of the scripts that left the shelf */
export const RETIRED_IDS: readonly string[] = RETIRED_SOURCES.map(r => `builtin:${r.slug}`);

/**
 * A SCRIPT'S TEXT AS THE HOUSE WRITES IT TODAY: every former family ink in it (indicatorInks FORMER_DARK) its pair's
 * current one. The house's text is its template with the family's inks of the day, so a text saved the day before the
 * house moved an ink — a kept RSI holding #FBACFE, a copy of Keltner holding #7D7D74 — is the house's text still, and
 * reads so here (the fourth review of the colour rule, 2026-10-16: the third review's palette move made every pre-move
 * kept or copied text the reader's own, drawn in its dark inks on Stone at 1.1:1).
 */
export function asHouseNow(source: string): string {
  return source.replace(/#[0-9A-Fa-f]{6}\b/g, inkNow);
}

/**
 * THE HOUSE'S TEXTS OF FORMER DAYS (the fifth review of the owner's colour rule, 2026-10-16): the hash (hashSource) of every
 * text the house has written under an id but today's, from the first commit (2026-10-03) on — read off builtinScripts() and
 * the retired list at every commit that changed this file, components/gex/indicatorInks.ts or palette.ts. "Make a copy" has
 * written the house's text as the reader's, version 1 with forkedFrom, since that first day, and the inks of the days before
 * approval 4 were shared across scripts (#5B9CF6 was the moving average's, the MACD's, the EMA ribbon's and the
 * stochastic's; #6BD3C7 Donchian's, MFI's and VWAP's; #D8BC8F Keltner's and ATR's), so no ink-by-ink table can read them
 * back (indicatorInks FORMER_DARK begins at approval 4): a text of then — a copy of a script since retired, a copy saved
 * again unchanged, a pasted one — is known for the house's by its text. A change that moves one of today's texts adds its
 * hash here (scripts/indicator-inks-proof.ts 4⁗‴ holds every former text in scripts/fixtures/house-script-texts.json, with
 * the hash of each text of today, and fails on a text of today that has moved without joining).
 */
export const FORMER_TEXTS: Readonly<Record<string, readonly string[]>> = {
  'builtin:walls': ['d8d6dcf5'],
  'builtin:flip': ['8a85717a'],
  'builtin:distance-to-walls': ['d8e059e4'],
  'builtin:wall-approach': ['cc016d6e'],
  'builtin:moving-average': ['ec89dae5', 'd14aec79'],
  'builtin:ichimoku': ['e9324301', 'fa0b9af3', '4e5ef4b9'],
  'builtin:keltner': ['48319ae7', 'dc8a099f', 'd831c66b', 'eaa983d3'],
  'builtin:donchian': ['104e0601', '0b9c7c91', '096a9055'],
  'builtin:stochastic': ['c55acdf2', 'c7db4429', '703eaa78'],
  'builtin:adx': ['adb4b697', 'cce99fdb'],
  'builtin:cci': ['75596273', '27fd5e40'],
  'builtin:williams-r': ['28a06b71', '37ea1bde', '1dc231b1'],
  'builtin:mfi': ['fd2923f9', '065a1f35', '77d5821e', '341901b6'],
  'builtin:obv': ['06beb608', 'b6027711', 'f5b03569', 'ecb79583'],
  'builtin:ema-ribbon': ['60691560', '6e66d7d5', '07e11337', 'df1c0da8'],
  'builtin:vwap': ['71529608', '5aeb394b'],
  'builtin:bollinger': ['d1e20257', 'd69eff25', 'e418d3c7'],
  'builtin:rsi': ['1a3e17c8', 'd59cc4d4'],
  'builtin:macd': ['2b1d6ec6', '53ee695d', 'daed019d', '7a08163b'],
  'builtin:atr': ['d0c0d235', '9aa19f32'],
};

let todayText: Map<string, { source: string; sourceHash: string }> | null = null;
/** The text the house writes under an id today — a shipped script's, or a retired one's as a reader keeps it — with its hash */
export function houseText(id: string): { source: string; sourceHash: string } | null {
  todayText ??= new Map([...builtinScripts().map(b => [b.id, { source: b.source, sourceHash: b.sourceHash }] as const), ...RETIRED_SOURCES.map(r => [`builtin:${r.slug}`, { source: r.source, sourceHash: hashSource(r.source) }] as const)]);
  return todayText.get(id) ?? null;
}

/** A text the house wrote under this id: today's, a former day's (FORMER_TEXTS), or today's but for inks it has since moved
    (asHouseNow). With no text to hand, its stored hash is asked */
function isHouseTextOf(id: string, source: string | undefined, sourceHash: string): boolean {
  const now = houseText(id);
  if (!now) return false;
  const hash = source != null ? hashSource(source) : sourceHash;
  if (source != null ? source === now.source : hash === now.sourceHash) return true;
  if (FORMER_TEXTS[id]?.includes(hash)) return true;
  return source != null && asHouseNow(source) === now.source;
}

/**
 * A retired built-in the reader keeps AS THE HOUSE WROTE IT: kept under its own id (data/scriptStore keepAsOwn writes
 * version 1) and never saved again by the reader — or its text is the house's own, today's or a former day's
 * (isHouseTextOf). Every ink in it is the family's, which the reader never set, so the chart draws it as the family's
 * (indicatorInks scriptInksWith `kept`); once the reader saves an edit it is theirs and keeps what its code sets.
 */
export function keptAsWritten(s: Pick<Script, 'id' | 'shelf' | 'version' | 'sourceHash'> & { source?: string }): boolean {
  if (s.shelf !== 'mine' || !RETIRED_IDS.includes(s.id)) return false;
  if (s.version === 1) return true;
  return isHouseTextOf(s.id, s.source, s.sourceHash);
}

/** Who set a script's inks, as the chart maps them (indicatorInks scriptInksWith): the house's shelf, a retired built-in the
    reader keeps as the house wrote it, or the reader */
export type InksBy = 'shipped' | 'kept' | 'own';

let byText: Map<string, string> | null = null;
/** the id whose text of today or of a former day this is, by its hash */
function idOfHouseText(source: string): string | null {
  if (!byText) {
    byText = new Map();
    for (const [id, hashes] of Object.entries(FORMER_TEXTS)) for (const h of hashes) byText.set(h, id);
    for (const id of [...builtinScripts().map(b => b.id), ...RETIRED_IDS]) byText.set(houseText(id)!.sourceHash, id);
  }
  const id = byText.get(hashSource(source));
  if (id && isHouseTextOf(id, source, '')) return id;
  /* today's text but for an ink the house has since moved */
  const now = asHouseNow(source);
  if (now === source) return null;
  const moved = byText.get(hashSource(now));
  return moved && houseText(moved)?.source === now ? moved : null;
}

type ScriptKey = Pick<Script, 'id' | 'shelf' | 'version' | 'sourceHash' | 'source' | 'forkedFrom'>;
const houseSeen = new Map<string, { id: string; by: 'shipped' | 'kept' } | null>();

/**
 * WHOSE TEXT A SCRIPT IS (the reviews of the owner's colour rule, 2026-10-16): the house's id it is drawn as and how, or
 * null for the reader's own. The terminal's shelf is the house's; so is a COPY THE READER NEVER CHANGED — "Make a copy"
 * (data/scriptStore fork) writes the house's text under the reader's name, and every ink in it is still the house's, the
 * reader set none. Mapped as the reader's own, an unedited copy of Supertrend drew the house green and red beside Glacier's
 * candles while its words said the candles' colours, and on a Stone tape its dark inks at 1.07 to 1.89:1. So:
 *  · a retired id kept as the house wrote it is kept (keptAsWritten);
 *  · A COPY OF A SHIPPED SCRIPT NEVER SAVED AGAIN is the house's (the third review: version 1 with the shelf's id in
 *    forkedFrom — a copy made the day before the house moved an ink no longer matched the shelf's text), whatever day it
 *    was made on;
 *  · A COPY OF A KEPT RETIRED SCRIPT NEVER SAVED AGAIN is kept while its text is the house's (the fourth review): a kept
 *    script, unlike a shipped one, can be edited, and a copy of an edited one holds the reader's text; a copy of the shelf's
 *    RSI made before it was retired holds the house's text of that day (FORMER_TEXTS — the fifth review);
 *  · a text the house wrote, today or on a former day — saved again unchanged, or pasted — is the house's.
 * Once the reader saves an edit the text is theirs and keeps the colours its code sets.
 */
export function houseOf(s: ScriptKey): { id: string; by: 'shipped' | 'kept' } | null {
  if (s.shelf === 'built-in') return { id: s.id, by: 'shipped' };
  const key = `${s.id}|${s.shelf}|${s.version}|${s.forkedFrom ?? ''}|${s.sourceHash}|${s.source.length}`;
  if (houseSeen.has(key)) return houseSeen.get(key)!;
  let out: { id: string; by: 'shipped' | 'kept' } | null = null;
  if (keptAsWritten(s)) out = { id: s.id, by: 'kept' };
  else if (s.shelf === 'mine' && s.version === 1 && s.forkedFrom && builtinScripts().some(b => b.id === s.forkedFrom)) out = { id: s.forkedFrom, by: 'shipped' };
  else if (s.shelf === 'mine' && s.version === 1 && s.forkedFrom && RETIRED_IDS.includes(s.forkedFrom) && isHouseTextOf(s.forkedFrom, s.source, s.sourceHash)) out = { id: s.forkedFrom, by: 'kept' };
  else {
    const id = idOfHouseText(s.source);
    if (id) out = { id, by: RETIRED_IDS.includes(id) ? 'kept' : 'shipped' };
  }
  if (houseSeen.size > 256) houseSeen.clear();
  houseSeen.set(key, out);
  return out;
}

/** Who set a script's inks (houseOf): the house's shelf, a retired built-in kept as the house wrote it, or the reader */
export function inksBy(s: ScriptKey): InksBy {
  return houseOf(s)?.by ?? 'own';
}

/**
 * THE TEXT THE CHART DRAWS FOR A SCRIPT (the fifth review of the owner's colour rule, 2026-10-16): a script that is the
 * house's text (houseOf) draws the house's text of TODAY under its id, so an unedited copy draws as the shipped one does —
 * the same program, its inks where the house puts them now. A copy made before approval 4 held inks no table can carry
 * forward (a Keltner copy #D8BC8F, 1.03:1 on a Stone tape; the moving average's #5B9CF6, the blue 0.137 from the field's
 * violet; Ichimoku's #7DE3FF and #FF9500), and a copy of the days before the house reshaped a script draws its shape of
 * today too — the flip's red wash gone (approval 11), the walls in the field's pair, the MACD's bars the steel wash. Every
 * former text the house wrote compiles with today's inputs and pane (scripts/indicator-inks-proof.ts 4⁗‴). A reader's own
 * script draws its own text; the editor and the alert watcher read the script's own text always.
 */
export function drawnText(s: ScriptKey): { source: string; sourceHash: string } {
  const h = houseOf(s);
  const now = h ? houseText(h.id) : null;
  return now ?? { source: s.source, sourceHash: s.sourceHash };
}

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

plot(ma, "EMA", color = ${SCRIPT_INKS.movingAverage}, linewidth = 2)
`;
