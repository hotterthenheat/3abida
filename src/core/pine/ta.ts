/*
==================================================
  SLAYER TERMINAL - THE STREAMING MATHS (core/pine/ta.ts)

  Pine's `ta.*` functions, each one fed one value a
  bar and keeping its own state — the way Pine runs
  them: every CALL SITE is its own stream, so
  `ta.ema(close, 9)` on line 12 and `ta.ema(close, 9)`
  on line 20 never share a memory, and a call inside
  an `if` that did not run this bar simply does not
  advance. The seeds and edge cases follow Pine's
  reference implementations (an EMA seeds from the
  first full SMA; RSI is 100 when the down average
  is 0; crossover is greater now and not greater the
  bar before).

  `na` is NaN throughout. A window that holds any NaN
  answers NaN, and a window that is not full yet
  answers NaN.
==================================================
*/

/* ---- a window over the last N values ------------------------------------------ */

export class Ring {
  private buf: number[] = [];
  push(v: number): void {
    this.buf.push(v);
    if (this.buf.length > 4096) this.buf.splice(0, this.buf.length - 2048);
  }
  get count(): number {
    return this.buf.length;
  }
  /** 0 = the newest */
  at(back: number): number {
    const i = this.buf.length - 1 - back;
    return i < 0 ? NaN : this.buf[i];
  }
  /** The last `len` values, newest last; empty when the window is not full */
  last(len: number): number[] {
    if (len <= 0 || this.buf.length < len) return [];
    return this.buf.slice(this.buf.length - len);
  }
}

const full = (r: Ring, len: number): number[] | null => {
  const w = r.last(len);
  if (w.length === 0) return null;
  for (const v of w) if (Number.isNaN(v)) return null;
  return w;
};

const mean = (w: number[]) => w.reduce((a, b) => a + b, 0) / w.length;

export type State = Record<string, unknown>;
const ring = (s: State, key = 'r'): Ring => (s[key] as Ring) ?? (s[key] = new Ring());

/* ---- averages ------------------------------------------------------------------ */

export function sma(s: State, src: number, len: number): number {
  const r = ring(s);
  r.push(src);
  const w = full(r, len);
  return w ? mean(w) : NaN;
}

/** An exponential average seeded from the first full simple average, as Pine's reference does */
export function ema(s: State, src: number, len: number): number {
  const alpha = 2 / (len + 1);
  return smoothed(s, src, len, alpha);
}

/** Wilder's average — the EMA with alpha = 1 / length; what RSI and ATR run on */
export function rma(s: State, src: number, len: number): number {
  return smoothed(s, src, len, 1 / len);
}

function smoothed(s: State, src: number, len: number, alpha: number): number {
  const prev = s.prev as number | undefined;
  if (prev === undefined || Number.isNaN(prev)) {
    const seed = sma(s, src, len);
    if (!Number.isNaN(seed)) s.prev = seed;
    return seed;
  }
  const next = alpha * src + (1 - alpha) * prev;
  s.prev = Number.isNaN(src) ? prev : next;
  return Number.isNaN(src) ? NaN : next;
}

export function wma(s: State, src: number, len: number): number {
  const r = ring(s);
  r.push(src);
  const w = full(r, len);
  if (!w) return NaN;
  let num = 0;
  let den = 0;
  for (let i = 0; i < len; i++) {
    num += w[i] * (i + 1);
    den += i + 1;
  }
  return num / den;
}

export function vwma(s: State, src: number, vol: number, len: number): number {
  const a = sma((s.a as State) ?? (s.a = {}), src * vol, len);
  const b = sma((s.b as State) ?? (s.b = {}), vol, len);
  return a / b;
}

/** Hull: wma(2·wma(len/2) − wma(len), round(√len)) */
export function hma(s: State, src: number, len: number): number {
  const half = Math.floor(len / 2);
  const w1 = wma((s.w1 as State) ?? (s.w1 = {}), src, half);
  const w2 = wma((s.w2 as State) ?? (s.w2 = {}), src, len);
  const diff = 2 * w1 - w2;
  return wma((s.w3 as State) ?? (s.w3 = {}), diff, Math.round(Math.sqrt(len)));
}

/** Symmetrically weighted over four bars: 1 2 2 1 over 6 */
export function swma(s: State, src: number): number {
  const r = ring(s);
  r.push(src);
  const w = full(r, 4);
  return w ? (w[0] * 1 + w[1] * 2 + w[2] * 2 + w[3] * 1) / 6 : NaN;
}

export function alma(s: State, src: number, len: number, offset: number, sigma: number): number {
  const r = ring(s);
  r.push(src);
  const w = full(r, len);
  if (!w) return NaN;
  const m = offset * (len - 1);
  const sd = len / sigma;
  let num = 0;
  let den = 0;
  for (let i = 0; i < len; i++) {
    const wt = Math.exp(-((i - m) * (i - m)) / (2 * sd * sd));
    num += w[i] * wt;
    den += wt;
  }
  return num / den;
}

/* ---- windows -------------------------------------------------------------------- */

export function highest(s: State, src: number, len: number): number {
  const r = ring(s);
  r.push(src);
  const w = full(r, len);
  return w ? Math.max(...w) : NaN;
}
export function lowest(s: State, src: number, len: number): number {
  const r = ring(s);
  r.push(src);
  const w = full(r, len);
  return w ? Math.min(...w) : NaN;
}
/** The offset to the highest value in the window — 0 for this bar, −k for k bars back */
export function highestbars(s: State, src: number, len: number): number {
  const r = ring(s);
  r.push(src);
  const w = full(r, len);
  if (!w) return NaN;
  let best = 0;
  for (let i = 1; i < len; i++) if (w[i] >= w[best]) best = i;
  return best - (len - 1);
}
export function lowestbars(s: State, src: number, len: number): number {
  const r = ring(s);
  r.push(src);
  const w = full(r, len);
  if (!w) return NaN;
  let best = 0;
  for (let i = 1; i < len; i++) if (w[i] <= w[best]) best = i;
  return best - (len - 1);
}

export function sum(s: State, src: number, len: number): number {
  const r = ring(s);
  r.push(src);
  const w = full(r, len);
  return w ? w.reduce((a, b) => a + b, 0) : NaN;
}

/** `ta.change(src, len)` — this value less the one `len` bars back */
export function change(s: State, src: number, len = 1): number {
  const r = ring(s);
  r.push(src);
  return src - r.at(len);
}
export function roc(s: State, src: number, len: number): number {
  const r = ring(s);
  r.push(src);
  const back = r.at(len);
  return (100 * (src - back)) / back;
}

export function stdev(s: State, src: number, len: number, biased = true): number {
  const r = ring(s);
  r.push(src);
  const w = full(r, len);
  if (!w) return NaN;
  const m = mean(w);
  const ss = w.reduce((a, v) => a + (v - m) * (v - m), 0);
  return Math.sqrt(ss / (biased ? len : Math.max(1, len - 1)));
}
export function variance(s: State, src: number, len: number, biased = true): number {
  const sd = stdev(s, src, len, biased);
  return sd * sd;
}
/** Mean absolute deviation */
export function dev(s: State, src: number, len: number): number {
  const r = ring(s);
  r.push(src);
  const w = full(r, len);
  if (!w) return NaN;
  const m = mean(w);
  return w.reduce((a, v) => a + Math.abs(v - m), 0) / len;
}

export function median(s: State, src: number, len: number): number {
  const r = ring(s);
  r.push(src);
  const w = full(r, len);
  if (!w) return NaN;
  const sorted = [...w].sort((a, b) => a - b);
  const mid = Math.floor(len / 2);
  return len % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** The share of the previous `len` values at or below this one, in percent */
export function percentrank(s: State, src: number, len: number): number {
  const r = ring(s);
  const prev = r.last(len);
  r.push(src);
  if (prev.length < len || prev.some(Number.isNaN)) return NaN;
  const below = prev.filter(v => v <= src).length;
  return (100 * below) / len;
}

/** Centre of gravity (Ehlers) */
export function cog(s: State, src: number, len: number): number {
  const r = ring(s);
  r.push(src);
  const w = full(r, len);
  if (!w) return NaN;
  let num = 0;
  let den = 0;
  for (let i = 0; i < len; i++) {
    const v = w[len - 1 - i];
    num += v * (i + 1);
    den += v;
  }
  return den === 0 ? NaN : -num / den;
}

/** The value of a least-squares line through the last `len` values, `offset` bars back from its end */
export function linreg(s: State, src: number, len: number, offset = 0): number {
  const r = ring(s);
  r.push(src);
  const w = full(r, len);
  if (!w) return NaN;
  let sx = 0;
  let sy = 0;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < len; i++) {
    sx += i;
    sy += w[i];
    sxy += i * w[i];
    sxx += i * i;
  }
  const slope = (len * sxy - sx * sy) / (len * sxx - sx * sx);
  const intercept = (sy - slope * sx) / len;
  return intercept + slope * (len - 1 - offset);
}

export function rising(s: State, src: number, len: number): boolean {
  const r = ring(s);
  const prev = r.last(len);
  r.push(src);
  return prev.length === len && prev.every(v => src > v);
}
export function falling(s: State, src: number, len: number): boolean {
  const r = ring(s);
  const prev = r.last(len);
  r.push(src);
  return prev.length === len && prev.every(v => src < v);
}

/** Running max / min over the whole history */
export function max(s: State, src: number): number {
  if (Number.isNaN(src)) return (s.m as number) ?? NaN;
  s.m = s.m === undefined ? src : Math.max(s.m as number, src);
  return s.m as number;
}
export function min(s: State, src: number): number {
  if (Number.isNaN(src)) return (s.m as number) ?? NaN;
  s.m = s.m === undefined ? src : Math.min(s.m as number, src);
  return s.m as number;
}

export function cum(s: State, src: number): number {
  const prev = (s.c as number) ?? 0;
  const next = Number.isNaN(src) ? prev : prev + src;
  s.c = next;
  return next;
}

/* ---- crossings and events ------------------------------------------------------- */

export function crossover(s: State, a: number, b: number): boolean {
  const pa = s.pa as number | undefined;
  const pb = s.pb as number | undefined;
  s.pa = a;
  s.pb = b;
  return pa !== undefined && pb !== undefined && a > b && pa <= pb;
}
export function crossunder(s: State, a: number, b: number): boolean {
  const pa = s.pa as number | undefined;
  const pb = s.pb as number | undefined;
  s.pa = a;
  s.pb = b;
  return pa !== undefined && pb !== undefined && a < b && pa >= pb;
}
export function cross(s: State, a: number, b: number): boolean {
  const pa = s.pa as number | undefined;
  const pb = s.pb as number | undefined;
  s.pa = a;
  s.pb = b;
  return pa !== undefined && pb !== undefined && ((a > b && pa <= pb) || (a < b && pa >= pb));
}

/** Bars since the condition last held; NaN before it ever did */
export function barssince(s: State, cond: boolean): number {
  if (cond) s.n = 0;
  else if (s.n !== undefined) s.n = (s.n as number) + 1;
  return (s.n as number) ?? NaN;
}

/** The source's value the `occurrence`-th most recent time the condition held (0 = the latest) */
export function valuewhen(s: State, cond: boolean, src: number, occurrence: number): number {
  const hits = (s.h as number[]) ?? (s.h = []);
  if (cond) {
    hits.push(src);
    if (hits.length > 512) hits.shift();
  }
  const i = hits.length - 1 - Math.max(0, Math.floor(occurrence));
  return i < 0 ? NaN : hits[i];
}

/* ---- the bar-fed ones ------------------------------------------------------------ */

/** True range: the bar's range widened to yesterday's close */
export function tr(s: State, high: number, low: number, close: number, handleNa: boolean): number {
  const pc = s.pc as number | undefined;
  s.pc = close;
  if (pc === undefined || Number.isNaN(pc)) return handleNa ? high - low : NaN;
  return Math.max(high - low, Math.abs(high - pc), Math.abs(low - pc));
}

export function atr(s: State, high: number, low: number, close: number, len: number): number {
  const t = tr((s.t as State) ?? (s.t = {}), high, low, close, true);
  return rma((s.r as State) ?? (s.r = {}), t, len);
}

export function rsi(s: State, src: number, len: number): number {
  const prev = s.p as number | undefined;
  s.p = src;
  if (prev === undefined || Number.isNaN(prev) || Number.isNaN(src)) {
    /* the averages still need feeding so the seed window fills */
    rma((s.u as State) ?? (s.u = {}), NaN, len);
    rma((s.d as State) ?? (s.d = {}), NaN, len);
    return NaN;
  }
  const ch = src - prev;
  const up = rma((s.u as State) ?? (s.u = {}), Math.max(ch, 0), len);
  const down = rma((s.d as State) ?? (s.d = {}), Math.max(-ch, 0), len);
  if (Number.isNaN(up) || Number.isNaN(down)) return NaN;
  return down === 0 ? 100 : up === 0 ? 0 : 100 - 100 / (1 + up / down);
}

export function macd(s: State, src: number, fast: number, slow: number, signalLen: number): [number, number, number] {
  const f = ema((s.f as State) ?? (s.f = {}), src, fast);
  const sl = ema((s.s as State) ?? (s.s = {}), src, slow);
  const line = f - sl;
  const sig = ema((s.g as State) ?? (s.g = {}), line, signalLen);
  return [line, sig, line - sig];
}

export function bb(s: State, src: number, len: number, mult: number): [number, number, number] {
  const basis = sma((s.m as State) ?? (s.m = {}), src, len);
  const sd = stdev((s.d as State) ?? (s.d = {}), src, len);
  return [basis, basis + mult * sd, basis - mult * sd];
}

export function stoch(s: State, src: number, high: number, low: number, len: number): number {
  const hh = highest((s.h as State) ?? (s.h = {}), high, len);
  const ll = lowest((s.l as State) ?? (s.l = {}), low, len);
  return (100 * (src - ll)) / (hh - ll);
}

export function cci(s: State, src: number, len: number): number {
  const m = sma((s.m as State) ?? (s.m = {}), src, len);
  const d = dev((s.d as State) ?? (s.d = {}), src, len);
  return (src - m) / (0.015 * d);
}

export function wpr(s: State, high: number, low: number, close: number, len: number): number {
  const hh = highest((s.h as State) ?? (s.h = {}), high, len);
  const ll = lowest((s.l as State) ?? (s.l = {}), low, len);
  return ((hh - close) / (hh - ll)) * -100;
}

export function mfi(s: State, src: number, vol: number, len: number): number {
  const prev = s.p as number | undefined;
  s.p = src;
  const up = prev !== undefined && src > prev ? src * vol : 0;
  const down = prev !== undefined && src < prev ? src * vol : 0;
  const su = sum((s.u as State) ?? (s.u = {}), up, len);
  const sd = sum((s.d as State) ?? (s.d = {}), down, len);
  if (Number.isNaN(su) || Number.isNaN(sd)) return NaN;
  return sd === 0 ? 100 : 100 - 100 / (1 + su / sd);
}

export function obv(s: State, close: number, vol: number): number {
  const prev = s.p as number | undefined;
  s.p = close;
  const sign = prev === undefined ? 0 : close > prev ? 1 : close < prev ? -1 : 0;
  return cum((s.c as State) ?? (s.c = {}), sign * vol);
}

/** Session VWAP — the running volume-weighted average since the session opened */
export function vwap(s: State, src: number, vol: number, sessionKey: string): number {
  if (s.k !== sessionKey) {
    s.k = sessionKey;
    s.pv = 0;
    s.v = 0;
  }
  s.pv = (s.pv as number) + src * vol;
  s.v = (s.v as number) + vol;
  return (s.v as number) === 0 ? NaN : (s.pv as number) / (s.v as number);
}

/** TradingView's own supertrend: [line, direction] with direction −1 in an uptrend, 1 in a downtrend */
export function supertrend(s: State, high: number, low: number, close: number, factor: number, atrLen: number): [number, number] {
  const a = atr((s.a as State) ?? (s.a = {}), high, low, close, atrLen);
  const src = (high + low) / 2;
  let upper = src + factor * a;
  let lower = src - factor * a;
  const prevUpper = (s.pu as number | undefined) ?? NaN;
  const prevLower = (s.pl as number | undefined) ?? NaN;
  const prevClose = (s.pc as number | undefined) ?? NaN;
  const prevAtr = (s.pa as number | undefined) ?? NaN;
  const prevSt = (s.ps as number | undefined) ?? NaN;
  const nzU = Number.isNaN(prevUpper) ? 0 : prevUpper;
  const nzL = Number.isNaN(prevLower) ? 0 : prevLower;
  lower = lower > nzL || prevClose < nzL ? lower : nzL;
  upper = upper < nzU || prevClose > nzU ? upper : nzU;
  let dir: number;
  if (Number.isNaN(prevAtr)) dir = 1;
  else if (prevSt === prevUpper) dir = close > upper ? -1 : 1;
  else dir = close < lower ? 1 : -1;
  const st = dir === -1 ? lower : upper;
  s.pu = upper;
  s.pl = lower;
  s.pc = close;
  s.pa = a;
  s.ps = st;
  return [Number.isNaN(a) ? NaN : st, dir];
}

/** Directional movement: [+DI, −DI, ADX] */
export function dmi(s: State, high: number, low: number, close: number, diLen: number, adxLen: number): [number, number, number] {
  const ph = s.ph as number | undefined;
  const pl = s.pl as number | undefined;
  s.ph = high;
  s.pl = low;
  const upMove = ph === undefined ? NaN : high - ph;
  const downMove = pl === undefined ? NaN : pl - low;
  const plusDM = Number.isNaN(upMove) ? NaN : upMove > downMove && upMove > 0 ? upMove : 0;
  const minusDM = Number.isNaN(downMove) ? NaN : downMove > upMove && downMove > 0 ? downMove : 0;
  const trs = rma((s.t as State) ?? (s.t = {}), tr((s.tr as State) ?? (s.tr = {}), high, low, close, true), diLen);
  const plus = (100 * rma((s.p as State) ?? (s.p = {}), plusDM, diLen)) / trs;
  const minus = (100 * rma((s.m as State) ?? (s.m = {}), minusDM, diLen)) / trs;
  const dx = Number.isNaN(plus) || Number.isNaN(minus) ? NaN : plus + minus === 0 ? 0 : (100 * Math.abs(plus - minus)) / (plus + minus);
  const adx = rma((s.x as State) ?? (s.x = {}), dx, adxLen);
  return [plus, minus, adx];
}

/** Parabolic SAR */
export function sar(s: State, high: number, low: number, close: number, start: number, inc: number, maxAf: number): number {
  const ph = s.ph as number | undefined;
  const pl = s.pl as number | undefined;
  if (ph === undefined || pl === undefined) {
    s.ph = high;
    s.pl = low;
    s.pc = close;
    return NaN;
  }
  if (s.sar === undefined) {
    /* the second bar decides the first direction */
    const up = close > (s.pc as number);
    s.up = up;
    s.sar = up ? pl : ph;
    s.ep = up ? high : low;
    s.af = start;
  } else {
    let sarV = (s.sar as number) + (s.af as number) * ((s.ep as number) - (s.sar as number));
    if (s.up) {
      if (low < sarV) {
        s.up = false;
        sarV = s.ep as number;
        s.ep = low;
        s.af = start;
      } else {
        if (high > (s.ep as number)) {
          s.ep = high;
          s.af = Math.min(maxAf, (s.af as number) + inc);
        }
        sarV = Math.min(sarV, pl, s.pl2 as number ?? pl);
      }
    } else {
      if (high > sarV) {
        s.up = true;
        sarV = s.ep as number;
        s.ep = high;
        s.af = start;
      } else {
        if (low < (s.ep as number)) {
          s.ep = low;
          s.af = Math.min(maxAf, (s.af as number) + inc);
        }
        sarV = Math.max(sarV, ph, s.ph2 as number ?? ph);
      }
    }
    s.sar = sarV;
  }
  s.ph2 = ph;
  s.pl2 = pl;
  s.ph = high;
  s.pl = low;
  s.pc = close;
  return s.sar as number;
}

/** A pivot high: the value `right` bars after a bar that was the highest of `left` before and `right` after it; NaN otherwise */
export function pivothigh(s: State, src: number, left: number, right: number): number {
  const r = ring(s);
  r.push(src);
  const len = left + right + 1;
  const w = full(r, len);
  if (!w) return NaN;
  const c = w[left];
  for (let i = 0; i < len; i++) {
    if (i === left) continue;
    if (i < left ? w[i] >= c : w[i] > c) return NaN;
  }
  return c;
}
export function pivotlow(s: State, src: number, left: number, right: number): number {
  const r = ring(s);
  r.push(src);
  const len = left + right + 1;
  const w = full(r, len);
  if (!w) return NaN;
  const c = w[left];
  for (let i = 0; i < len; i++) {
    if (i === left) continue;
    if (i < left ? w[i] <= c : w[i] < c) return NaN;
  }
  return c;
}

export function correlation(s: State, a: number, b: number, len: number): number {
  const ra = ring(s, 'a');
  const rb = ring(s, 'b');
  ra.push(a);
  rb.push(b);
  const wa = full(ra, len);
  const wb = full(rb, len);
  if (!wa || !wb) return NaN;
  const ma = mean(wa);
  const mb = mean(wb);
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < len; i++) {
    num += (wa[i] - ma) * (wb[i] - mb);
    da += (wa[i] - ma) ** 2;
    db += (wb[i] - mb) ** 2;
  }
  return num / Math.sqrt(da * db);
}
