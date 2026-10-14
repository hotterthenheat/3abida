/*
==================================================
  SLAYER TERMINAL - REVIEW · A REAL DAY'S MARKET
  (data/review/realTape.ts)

  The other market a session can replay (market.ts):
  the market's own record (2026-10-12; Massive's then, Theta
  Data's since 2026-10-14).
  Pure — it reads a RealRecord (the bars, the listings,
  the prints) that data/feed/backtest.ts fills in, so
  scripts/review-engine-proof.ts can hand it a record
  of its own.

  THE NAME: its own minute bars, 09:30 to 16:00 New
  York. A minute the record has no bar for (no trade)
  stands where the last one closed, volume nothing.

  A CONTRACT: its own minute bars, asked for when the
  reader opens it — one call a contract, for every
  day the session holds.

    a minute it traded   the price is that minute's
                         volume-weighted average (its
                         close where none is given):
                         the bid, the ask and the mark
                         are all that one price, so a
                         buy and a sell fill at it. No
                         spread is made up round it.
    a minute it did not  NO FILL. The quote is the
                         house's pricer on the name's
                         real price, at the vol the
                         contract's last trade implied
                         (or, before its first, the
                         name's own past vol) — said on
                         screen as estimated, and dead,
                         so orders wait for a minute
                         that traded.
    before its trades    'coming': nothing fills, the
    are in               chain shows the estimate.

  The greeks are worked out here off the price, by the
  house's own math (core/greeks), as the house's tape
  does; open interest is not in the record ("—").
==================================================
*/

import { blackScholesGreeks, blackScholesPrice } from '../../core/greeks';
import { isTradingDay } from '../../core/calendar';
import type { Candle } from '../../types/market';
import type { ReplayMarket } from './market';
import { contractKey, dteAt, longLeg, priceWith, spotForQuote, spreadWidth, yearsLeft, type ChainRow, type ContractDay, type ContractId, type ListedExpiry, type Quote } from './quotes';
import { LAST_MIN, dateOf, dayWords, reviewName } from './tape';

/** One minute of a contract's own trades — folded a minute from its trades (Theta Data's since 2026-10-14, server/feed.ts
    thetaOptionMinutes; Massive's minute aggregate before) */
export interface PrintBar {
  o: number;
  h: number;
  l: number;
  c: number;
  /** Contracts traded */
  v: number;
  /** The volume-weighted average price — null where the record gives none */
  vw: number | null;
}

/** What a real session's market is read from — filled in by data/feed/backtest.ts */
export interface RealRecord {
  /** The sessions the clock can stand on, oldest first */
  days: string[];
  /** A few sessions before the first, for the chart alone */
  before: string[];
  /** A day's 390 minute bars of the name; undefined until they are in */
  bars(ticker: string, iso: string): Candle[] | undefined;
  /** The name's vol over the sessions before the first day — what an estimate is priced on before a contract trades */
  vol(ticker: string): number;
  /** The expiry dates listed on the first day; undefined until they are in */
  expiries(ticker: string): string[] | undefined;
  /** The strikes listed for an expiry, lowest first; undefined until they are in */
  strikes(ticker: string, expiry: string): number[] | undefined;
  /** One contract's own minutes, by day — 390 a day, null where it did not trade; undefined until they are in */
  prints(c: ContractId): Map<string, (PrintBar | null)[]> | undefined;
}

const cents = (v: number) => Math.round(v * 100) / 100;
const clampMin = (m: number) => Math.max(0, Math.min(LAST_MIN, m));

/** The price of a minute that traded */
export const printPrice = (b: PrintBar): number => cents(b.vw != null && b.vw > 0 ? b.vw : b.c);

/** The vol a price implies (Black-Scholes, bisected) — NaN when no vol gives it (under what it is worth in the money) */
export function impliedVol(price: number, spot: number, strike: number, t: number, right: 'C' | 'P'): number {
  if (!(t > 0) || !(price > 0) || !(spot > 0)) return NaN;
  let lo = 0.005;
  let hi = 5;
  if (price <= blackScholesPrice(spot, strike, t, lo, right)) return NaN;
  if (price >= blackScholesPrice(spot, strike, t, hi, right)) return NaN;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (blackScholesPrice(spot, strike, t, mid, right) > price) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

/** A single contract at a price (or at the model's price for a vol), with the house's greeks */
function quoteOf(c: ContractId, spot: number, t: number, iv: number, src: NonNullable<Quote['src']>, price?: number): Quote {
  const intrinsic = Math.max(0, c.right === 'C' ? spot - c.strike : c.strike - spot);
  const model = Math.max(intrinsic, blackScholesPrice(spot, c.strike, t, iv, c.right));
  const mark = cents(price ?? model);
  const g = blackScholesGreeks(spot, c.strike, t, iv);
  const dayOn = Math.max(0, t - 1 / 252);
  const theta = (dayOn > 0 ? Math.max(intrinsic, blackScholesPrice(spot, c.strike, dayOn, iv, c.right)) : intrinsic) - model;
  return {
    bid: mark,
    ask: mark,
    mark,
    iv,
    delta: c.right === 'C' ? g.deltaCall : g.deltaPut,
    gamma: g.gamma,
    theta,
    vega: g.vega,
    rho: c.right === 'C' ? g.rhoCall : g.rhoPut,
    intrinsic: cents(intrinsic),
    dead: src !== 'print' || !(mark > 0),
    spot,
    src,
  };
}

/** The third Friday of its month (or the session before it, a holiday Friday) — a monthly */
function kindOf(iso: string): ListedExpiry['kind'] {
  const d = dateOf(iso);
  const fri = new Date(d);
  /* the Friday of its week: a Thursday expiry before a Friday holiday is that Friday's */
  if (d.getDay() === 4) {
    const next = new Date(d);
    next.setDate(d.getDate() + 1);
    if (!isTradingDay(next)) fri.setDate(d.getDate() + 1);
  }
  if (fri.getDay() !== 5) return 'daily';
  return fri.getDate() >= 15 && fri.getDate() <= 21 ? 'monthly' : 'weekly';
}

/** The market of a real session, read off its record */
export function buildRealMarket(r: RealRecord): ReplayMarket {
  const all = [...r.before, ...r.days];
  const at = new Map(r.days.map((d, i) => [d, i]));
  const atAll = new Map(all.map((d, i) => [d, i]));
  const bars = (t: string, iso: string) => r.bars(t, iso) ?? [];
  const spotAt = (t: string, iso: string, m: number) => bars(t, iso)[clampMin(m)]?.close ?? 0;

  /* the last minute that traded, at or before a moment — an index per day, made once */
  const lastIdx = new WeakMap<(PrintBar | null)[], Int16Array>();
  const lastOf = (arr: (PrintBar | null)[]): Int16Array => {
    let a = lastIdx.get(arr);
    if (!a) {
      a = new Int16Array(arr.length);
      let k = -1;
      for (let i = 0; i < arr.length; i++) {
        if (arr[i]) k = i;
        a[i] = k;
      }
      lastIdx.set(arr, a);
    }
    return a;
  };
  const lastPrint = (c: ContractId, iso: string, m: number): { iso: string; minute: number; bar: PrintBar } | null => {
    const p = r.prints(c);
    if (!p) return null;
    let di = atAll.get(iso) ?? -1;
    let mm = clampMin(m);
    while (di >= 0) {
      const day = all[di];
      const arr = p.get(day);
      if (arr && arr.length) {
        const k = lastOf(arr)[Math.min(mm, arr.length - 1)];
        if (k >= 0) return { iso: day, minute: k, bar: arr[k]! };
      }
      di--;
      mm = LAST_MIN;
    }
    return null;
  };
  /* the vol a trade implied, kept by the minute it printed */
  const ivMemo = new Map<string, number>();
  const ivOfPrint = (c: ContractId, iso: string, minute: number, bar: PrintBar): number => {
    const key = `${contractKey(c)}|${iso}|${minute}`;
    let v = ivMemo.get(key);
    if (v === undefined) {
      v = impliedVol(printPrice(bar), spotAt(c.ticker, iso, minute), c.strike, yearsLeft(iso, minute, c.expiry), c.right);
      if (ivMemo.size > 20000) ivMemo.clear();
      ivMemo.set(key, v);
    }
    return v;
  };

  /** One leg. `onClock`: the name is where the record has it (a print counts); off it, the price is estimated. */
  const single = (c: ContractId, iso: string, m: number, spot: number, onClock: boolean): Quote => {
    const t = yearsLeft(iso, m, c.expiry);
    const base = r.vol(c.ticker);
    if (t <= 0) return { ...priceWith(c, spot, 0, base), src: 'estimate' };
    const p = r.prints(c);
    if (!p) return { ...priceWith(c, spot, t, base), dead: true, src: 'coming' };
    const bar = onClock ? p.get(iso)?.[clampMin(m)] : null;
    if (bar) {
      const px = printPrice(bar);
      const iv = impliedVol(px, spot, c.strike, t, c.right);
      return quoteOf(c, spot, t, Number.isFinite(iv) ? iv : base, 'print', px);
    }
    const last = lastPrint(c, iso, m);
    const iv = last ? ivOfPrint(c, last.iso, last.minute, last.bar) : NaN;
    if (Number.isFinite(iv)) return quoteOf(c, spot, t, iv, 'estimate');
    /* no trade yet to read a vol off: the house's pricer, on the name's own past vol */
    const q = priceWith(c, spot, t, base);
    return { ...q, bid: q.mark, ask: q.mark, dead: true, src: 'estimate' };
  };
  const quote = (c: ContractId, iso: string, m: number, spot: number, onClock: boolean): Quote => {
    if (c.short == null) return single(c, iso, m, spot, onClock);
    const a = single(longLeg(c), iso, m, spot, onClock);
    const b = single({ ...longLeg(c), strike: c.short }, iso, m, spot, onClock);
    const width = spreadWidth(c);
    const inside = (v: number) => Math.max(0, Math.min(width, v));
    const v = cents(inside(a.mark - b.mark));
    const intrinsic = cents(inside(a.intrinsic - b.intrinsic));
    if (yearsLeft(iso, m, c.expiry) <= 0) return { ...a, bid: intrinsic, ask: intrinsic, mark: intrinsic, intrinsic, delta: 0, dead: false, src: 'estimate' };
    const both = a.src === 'print' && b.src === 'print';
    return {
      bid: v,
      ask: v,
      mark: v,
      iv: a.iv,
      delta: a.delta - b.delta,
      gamma: a.gamma - b.gamma,
      theta: a.theta - b.theta,
      vega: a.vega - b.vega,
      rho: a.rho - b.rho,
      intrinsic,
      dead: !both || !(v > 0),
      spot,
      src: a.src === 'coming' || b.src === 'coming' ? 'coming' : both ? 'print' : 'estimate',
    };
  };
  const quoteAt = (c: ContractId, iso: string, m: number): Quote => quote(c, iso, m, spotAt(c.ticker, iso, m), true);
  const quoteWith = (c: ContractId, iso: string, m: number, spot: number): Quote => (Math.abs(spot - spotAt(c.ticker, iso, m)) < 1e-6 ? quoteAt(c, iso, m) : quote(c, iso, m, spot, false));
  /* where a line is drawn: the estimator walked, never a print (a print is one price at one place) */
  const walk = (c: ContractId, iso: string, m: number, v: number, which: 'bid' | 'ask') => spotForQuote(spotAt(c.ticker, iso, m), s => quote(c, iso, m, s, false), c.right, v, which);

  return {
    kind: 'feed',
    ready: true,
    days: () => r.days,
    dayIndex: iso => at.get(iso) ?? -1,
    nextDay: iso => {
      const i = atAll.get(iso);
      return i == null ? null : (all[i + 1] ?? null);
    },
    prevDay: iso => {
      const i = atAll.get(iso);
      return i == null ? null : (all[i - 1] ?? null);
    },
    dayBars: bars,
    spotAt,
    ivAt: t => r.vol(t),
    stepOf: t => reviewName(t).step,
    quoteAt,
    quoteWith,
    spotForBid: (c, iso, m, bid) => walk(c, iso, m, bid, 'bid'),
    spotForAsk: (c, iso, m, ask) => walk(c, iso, m, ask, 'ask'),
    expiriesAt: (ticker, iso) => (r.expiries(ticker) ?? []).filter(e => e >= iso).map(e => ({ iso: e, label: dayWords(e), dte: dteAt(iso, e), kind: kindOf(e) })),
    chainAt: (ticker, iso, m, expiry, each = 10, centre) => {
      const spot = spotAt(ticker, iso, m);
      const listed = r.strikes(ticker, expiry);
      if (!listed?.length) return { spot, rows: [] };
      const mid = centre ?? spot;
      let i = 0;
      for (let k = 1; k < listed.length; k++) if (Math.abs(listed[k] - mid) < Math.abs(listed[i] - mid)) i = k;
      const rows: ChainRow[] = [];
      for (let k = Math.min(listed.length - 1, i + each); k >= Math.max(0, i - each); k--) {
        const strike = listed[k];
        rows.push({ strike, call: quoteAt({ ticker, strike, right: 'C', expiry }, iso, m), put: quoteAt({ ticker, strike, right: 'P', expiry }, iso, m) });
      }
      return { spot, rows };
    },
    contractDay: (c, iso, m): ContractDay => {
      const q = quoteAt(c, iso, m);
      const even = c.right === 'C' ? c.strike + q.ask : c.strike - q.ask;
      const breakeven = cents(even);
      const toBreakevenPct = q.spot > 0 ? ((even - q.spot) / q.spot) * 100 : NaN;
      const p = r.prints(c);
      if (!p) return { high: NaN, low: NaN, prevClose: NaN, last: NaN, volume: NaN, oi: NaN, breakeven, toBreakevenPct };
      const today = p.get(iso) ?? [];
      let high = -Infinity;
      let low = Infinity;
      let volume = 0;
      for (let k = 0; k <= clampMin(m) && k < today.length; k++) {
        const b = today[k];
        if (!b) continue;
        high = Math.max(high, b.h);
        low = Math.min(low, b.l);
        volume += b.v;
      }
      const last = lastPrint(c, iso, m);
      const before = atAll.get(iso);
      const prev = before != null && before > 0 ? lastPrint(c, all[before - 1], LAST_MIN) : null;
      return {
        high: Number.isFinite(high) ? high : NaN,
        low: Number.isFinite(low) ? low : NaN,
        prevClose: prev ? printPrice(prev.bar) : NaN,
        last: last && last.iso === iso ? printPrice(last.bar) : NaN,
        volume,
        oi: NaN,
        breakeven,
        toBreakevenPct,
      };
    },
  };
}
