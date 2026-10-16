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
  draws as the shipped one does (inksBy: its text, its
  inks, are still the house's); once edited it is the
  reader's own and keeps the colours its code sets.

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
import { INDICATOR_INKS, MACD_SIGNAL_INK, SCRIPT_INKS } from '../components/gex/indicatorInks';
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
 * A retired built-in the reader keeps AS THE HOUSE WROTE IT: kept under its own id (data/scriptStore keepAsOwn writes
 * version 1) and never saved again by the reader — or its text is the house's own today. Every ink in it is the family's,
 * which the reader never set, so the chart draws it as the family's (indicatorInks scriptInksWith `kept`); once the reader
 * saves an edit it is theirs and keeps what its code sets.
 */
export function keptAsWritten(s: Pick<Script, 'id' | 'shelf' | 'version' | 'sourceHash'>): boolean {
  if (s.shelf !== 'mine' || !RETIRED_IDS.includes(s.id)) return false;
  if (s.version === 1) return true;
  const was = retiredBuiltin(s.id);
  return !!was && s.sourceHash === hashSource(was.source);
}

/** Who set a script's inks, as the chart maps them (indicatorInks scriptInksWith): the house's shelf, a retired built-in the
    reader keeps as the house wrote it, or the reader */
export type InksBy = 'shipped' | 'kept' | 'own';

let shippedText: Map<string, string> | null = null;
let retiredText: Map<string, string> | null = null;

/**
 * WHO SET A SCRIPT'S INKS (the review of the owner's colour rule, 2026-10-16): the terminal's shelf is the house's; so is a
 * COPY THE READER NEVER CHANGED — "Make a copy" (data/scriptStore fork) writes the house's text under the reader's name,
 * and every ink in it is still the house's, the reader set none. Mapped as the reader's own, an unedited copy of
 * Supertrend drew the house green and red beside Glacier's candles while its words said the candles' colours, and on a
 * Stone tape its dark inks at 1.07 to 1.89:1. So a script whose text IS a shipped script's draws as the shipped one does,
 * and one whose text is a retired built-in's as a kept copy does; a retired id kept as the house wrote it is kept
 * (keptAsWritten). Once the reader saves an edit the text is theirs and keeps the colours its code sets.
 */
export function inksBy(s: Pick<Script, 'id' | 'shelf' | 'version' | 'sourceHash' | 'source' | 'forkedFrom'>): InksBy {
  if (s.shelf === 'built-in') return 'shipped';
  if (keptAsWritten(s)) return 'kept';
  /* A COPY OF A SHIPPED SCRIPT NEVER SAVED AGAIN (the third review of the colour rule, 2026-10-16): "Make a copy" writes
     version 1 with the shelf's id in forkedFrom, so a copy is the house's until the reader saves it — as keptAsWritten
     reads a kept one. Its text alone could not tell: once the house moved one of its inks (Keltner's #7D7D74, MFI's
     #447CAE) a copy made the day before no longer matched the shelf's text, read as the reader's own, and drew those dark
     inks on a Stone tape at 2.21 and 2.35:1. Its inks the house has since moved draw as their pairs do now
     (indicatorInks FORMER_DARK, on the shipped path too). */
  if (s.shelf === 'mine' && s.version === 1 && s.forkedFrom && builtinScripts().some(b => b.id === s.forkedFrom)) return 'shipped';
  shippedText ??= new Map(builtinScripts().map(b => [b.sourceHash, b.source]));
  if (shippedText.get(s.sourceHash) === s.source) return 'shipped';
  retiredText ??= new Map(RETIRED_SOURCES.map(r => [hashSource(r.source), r.source]));
  if (retiredText.get(s.sourceHash) === s.source) return 'kept';
  return 'own';
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
