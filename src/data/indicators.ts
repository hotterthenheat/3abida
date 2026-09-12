import type { Candle } from '../types/market';

/*
==================================================
  SLAYER TERMINAL - INDICATOR SERIES (data/indicators.ts)

  Every indicator the tape draws, as plain numbers.
==================================================

  WHY THEY LEFT THE CHART.

  Both were written inside `StrikeChart`'s indicator effect, as a closure over
  the bars it had just aggregated. That was fine while the chart was the only
  thing that had an opinion about them. T-12's confluence strip has to say
  whether price is above its EMA21 and its VWAP on five timeframes at once,
  and a second copy of these formulas would be a strip that can disagree with
  the lines it is summarising — the same "written twice, and the copies
  disagreed" that `core/walls.ts` exists because of.

  So: one generator, and the chart maps the numbers onto its own series.
  Nothing here knows about charts, so `npm test` can hold both to a fixture.

  ALIGNED TO `bars`, one value per bar, no leading nulls. Both are seeded
  rather than warmed up, which is a real property and is asserted rather than
  hidden: `emaSeries` starts at the first close, so early values are closer to
  price than a settled EMA would be, and a caller that needs a settled one has
  to say how many bars it wants behind it. `WARMUP_BARS` is that number.
*/

/**
 * How many bars an EMA needs behind it before its value is the EMA rather
 * than the seed still washing out. One period: after `period` steps the seed's
 * weight is `(1 - 2/(period+1))^period`, which is about 13% at 21 and falls
 * from there — small enough that the curve is the data's, large enough that
 * calling it settled before then would be a claim the numbers do not support.
 */
export const emaWarmup = (period: number): number => period;

/**
 * Exponential moving average of closes, seeded at the first close.
 *
 * Seeded rather than started from an SMA of the first `period` bars, because
 * that is what the tape has always drawn and the two differ visibly on the
 * left edge. Changing it here would move a line readers have been reading.
 */
export function emaSeries(bars: readonly Candle[], period: number): number[] {
  if (bars.length === 0) return [];
  const k = 2 / (period + 1);
  let ema = bars[0].close;
  return bars.map(b => {
    ema = b.close * k + ema * (1 - k);
    return ema;
  });
}

/**
 * WHERE A SESSION STARTS — index 0, and every bar that follows a gap.
 *
 * A GAP is a step between bar times of more than 1.5× the bar's own length,
 * which is how a session boundary shows up in a series that only holds RTH
 * bars: 09:30 follows 15:59 by seventeen and a half hours. `barMinutes` has
 * to be the interval these bars were AGGREGATED to, not the base interval —
 * pass 1m bars a `barMinutes` of 15 and every bar looks like a new session.
 *
 * ONE RULE, because two things now need it: the VWAP re-anchors here, and
 * T-6's session levels cut the prior day here. Two copies would be a prior
 * high taken from a different day than the VWAP was anchored to.
 */
export function sessionStarts(bars: readonly Candle[], barMinutes: number): number[] {
  if (bars.length === 0) return [];
  const gap = barMinutes * 60 * 1.5;
  const out = [0];
  for (let i = 1; i < bars.length; i++) {
    if (bars[i].time - bars[i - 1].time > gap) out.push(i);
  }
  return out;
}

/**
 * Session-anchored VWAP: cumulative typical×volume over cumulative volume,
 * reset at every session start.
 *
 * Falls back to the close on a bar with no volume behind it, so the series is
 * a price throughout rather than dropping to zero on a dead open.
 */
export function vwapSeries(bars: readonly Candle[], barMinutes: number): number[] {
  const starts = new Set(sessionStarts(bars, barMinutes));
  const out: number[] = [];
  let pv = 0;
  let vol = 0;
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    /* `i > 0` because index 0 is a session start too and there is nothing to
       reset before the first bar — resetting there is a no-op, but saying so
       keeps this loop reading the same as it did before the rule moved out. */
    if (i > 0 && starts.has(i)) {
      pv = 0;
      vol = 0;
    }
    const typical = (b.high + b.low + b.close) / 3;
    pv += typical * b.volume;
    vol += b.volume;
    out.push(vol > 0 ? pv / vol : b.close);
  }
  return out;
}

/*
  ──────────────────────────────────────────────────────────────────────────
  THE T-4 SET. Two conventions live in this file now, and the difference is
  deliberate:

  · emaSeries / vwapSeries are SEEDED — full-length, no nulls — because that
    is what the tape has always drawn and moving those lines would move
    something readers already read.
  · Everything below is WARMED UP — null until the window it claims to
    summarise actually exists. An RSI printed off three bars is a number the
    app cannot source, and the chart maps a null to whitespace, not to zero.
  ──────────────────────────────────────────────────────────────────────────
*/

/**
 * Wilder's RSI. Null through index `period` − the first value sits ON the
 * bar that completes the seed window (period changes need period+1 bars).
 * A lossless window reads 100 and a gainless one 0, per Wilder.
 */
export function rsiSeries(bars: readonly Candle[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(bars.length).fill(null);
  if (period < 1 || bars.length <= period) return out;
  let g = 0;
  let l = 0;
  for (let i = 1; i <= period; i++) {
    const ch = bars[i].close - bars[i - 1].close;
    if (ch >= 0) g += ch;
    else l -= ch;
  }
  g /= period;
  l /= period;
  const rsiOf = () => (l === 0 ? (g === 0 ? 50 : 100) : 100 - 100 / (1 + g / l));
  out[period] = rsiOf();
  for (let i = period + 1; i < bars.length; i++) {
    const ch = bars[i].close - bars[i - 1].close;
    g = (g * (period - 1) + Math.max(0, ch)) / period;
    l = (l * (period - 1) + Math.max(0, -ch)) / period;
    out[i] = rsiOf();
  }
  return out;
}

export interface MacdSeries {
  macd: (number | null)[];
  signal: (number | null)[];
  /** macd − signal, the bars under the lines. */
  hist: (number | null)[];
}

/**
 * MACD off the SAME seeded EMAs the tape draws (emaSeries), nulled through
 * each part's own warmup: the macd line until the slow EMA has settled
 * (emaWarmup(slow)), the signal until its own EMA of the macd has settled on
 * top of that. Two warmups, because the signal cannot be older than the line
 * it smooths.
 */
export function macdSeries(bars: readonly Candle[], fast = 12, slow = 26, signal = 9): MacdSeries {
  const n = bars.length;
  const macd: (number | null)[] = new Array(n).fill(null);
  const sig: (number | null)[] = new Array(n).fill(null);
  const hist: (number | null)[] = new Array(n).fill(null);
  if (n === 0) return { macd, signal: sig, hist };
  const ef = emaSeries(bars, fast);
  const es = emaSeries(bars, slow);
  const from = emaWarmup(slow);
  const k = 2 / (signal + 1);
  let s: number | null = null;
  for (let i = from; i < n; i++) {
    const m = ef[i] - es[i];
    macd[i] = m;
    s = s === null ? m : m * k + s * (1 - k);
    if (i >= from + emaWarmup(signal)) {
      sig[i] = s;
      hist[i] = m - s;
    }
  }
  return { macd, signal: sig, hist };
}

export interface BollingerSeries {
  basis: (number | null)[];
  upper: (number | null)[];
  lower: (number | null)[];
}

/**
 * Bollinger bands: SMA(period) ± k·σ, population σ over the same window.
 * Null until a full window exists.
 */
export function bollingerSeries(bars: readonly Candle[], period = 20, k = 2): BollingerSeries {
  const n = bars.length;
  const basis: (number | null)[] = new Array(n).fill(null);
  const upper: (number | null)[] = new Array(n).fill(null);
  const lower: (number | null)[] = new Array(n).fill(null);
  for (let i = period - 1; i < n; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += bars[j].close;
    const mid = sum / period;
    let v = 0;
    for (let j = i - period + 1; j <= i; j++) v += (bars[j].close - mid) ** 2;
    const sd = Math.sqrt(v / period);
    basis[i] = mid;
    upper[i] = mid + k * sd;
    lower[i] = mid - k * sd;
  }
  return { basis, upper, lower };
}

/** Plain SMA of closes, null until a full window exists. */
export function smaSeries(bars: readonly Candle[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(bars.length).fill(null);
  if (period < 1) return out;
  let sum = 0;
  for (let i = 0; i < bars.length; i++) {
    sum += bars[i].close;
    if (i >= period) sum -= bars[i - period].close;
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

/**
 * The volume-weighted σ around the session VWAP, per bar — the ruler the
 * VWAP bands are k of. Same anchor rule as the VWAP itself (sessionStarts),
 * computed off the same typical prices, so the band and its centre line
 * cannot disagree about where the session began. σ is null on a bar with no
 * volume behind it yet — a band of width zero would claim certainty, not
 * absence.
 */
export function vwapSigmaSeries(bars: readonly Candle[], barMinutes: number): (number | null)[] {
  const out: (number | null)[] = new Array(bars.length).fill(null);
  if (bars.length === 0) return out;
  const starts = new Set(sessionStarts(bars, barMinutes));
  let cumV = 0;
  let cumPV = 0;
  let cumP2V = 0;
  for (let i = 0; i < bars.length; i++) {
    if (starts.has(i)) {
      cumV = 0;
      cumPV = 0;
      cumP2V = 0;
    }
    const typ = (bars[i].high + bars[i].low + bars[i].close) / 3;
    cumV += bars[i].volume;
    cumPV += typ * bars[i].volume;
    cumP2V += typ * typ * bars[i].volume;
    if (cumV > 0) {
      const vwap = cumPV / cumV;
      out[i] = Math.sqrt(Math.max(0, cumP2V / cumV - vwap * vwap));
    }
  }
  return out;
}

/**
 * Wilder's ATR over the DISPLAYED bars — the sub-pane's line, in this
 * pane's own interval, distinct from data/atr.ts's session ATR (T-19's
 * ruler): a 5-minute pane's ATR sub-pane answers "how big are 5-minute
 * bars lately", the ruler answers "how big is a day". Null through the
 * seed window.
 */
export function atrBarSeries(bars: readonly Candle[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(bars.length).fill(null);
  if (period < 1 || bars.length <= period) return out;
  const tr = (i: number) =>
    Math.max(bars[i].high - bars[i].low, Math.abs(bars[i].high - bars[i - 1].close), Math.abs(bars[i].low - bars[i - 1].close));
  let atr = 0;
  for (let i = 1; i <= period; i++) atr += tr(i);
  atr /= period;
  out[period] = atr;
  for (let i = period + 1; i < bars.length; i++) {
    atr = (atr * (period - 1) + tr(i)) / period;
    out[i] = atr;
  }
  return out;
}
