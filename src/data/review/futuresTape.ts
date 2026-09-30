/*
==================================================
  SLAYER TERMINAL - REVIEW · THE FUTURES TAPE
  (data/review/futuresTape.ts)

  What a FUTURES backtest replays (docs/review-futures-
  rules.md): a product's past trading days, a minute
  bar at a time. THIS FILE IS THE SEAM for futures the
  way tape.ts + quotes.ts are for options — today a
  seeded stand-in that stays put, and when the bought
  feed is wired in (one-minute bars per contract month,
  with the roll dates) only this file changes.

  A FUTURE'S DAY IS NOT A STOCK'S. It trades nearly
  round the clock: a trading day runs from 18:00 New
  York the evening before to 17:00, 1,380 minutes, and
  the hour's break after it is a GAP on the tape, not
  minutes to play through. Minute 0 of "Monday" is
  Sunday 18:00. A bar's `time` is the real instant it
  began, like every tape in the house. The night is
  quiet, Europe's morning less so, 08:30's numbers and
  the 09:30 open are the busy hours: the walk's width
  follows that shape and still lands on the day's
  close.

  The days are the stock tape's days (the house
  calendar). The exchange's own holiday sessions are
  not modelled; nor are limits or halts.
==================================================
*/

import type { Candle } from '../../types/market';
import { dateOf, dayWords, gauss, stream, tapeDays } from './tape';

export const FUT_DAY_MIN = 1380;
export const FUT_LAST_MIN = FUT_DAY_MIN - 1;
/** The minute of the trading day the stock market opens on (09:30 New York) — the jump most day traders want */
export const FUT_RTH_OPEN_MIN = 15 * 60 + 30;

export interface FutProduct {
  symbol: string;
  name: string;
  /** Dollars a whole point is worth, a contract */
  pointValue: number;
  tick: number;
  decimals: number;
  /** The stand-in's day margin a contract — the session can set its own */
  margin: number;
  /** Dollars a contract, each way */
  fee: number;
  /** Where it is quoted today — the tape's last close */
  px: number;
  /** Annual vol — the walk's width */
  vol: number;
  /** The contract months it lists, as month codes */
  months: string;
  /** The day of the month BEFORE the contract month (0) or OF it (1) the front month rolls on — a stand-in for the
      exchange's roll calendar, which comes with the feed */
  roll: { monthsBefore: 0 | 1; day: number };
}

/* the rules page's table, as data */
export const FUT_PRODUCTS: FutProduct[] = [
  { symbol: 'ES', name: 'S&P 500 futures', pointValue: 50, tick: 0.25, decimals: 2, margin: 1500, fee: 2, px: 5248.5, vol: 0.15, months: 'HMUZ', roll: { monthsBefore: 0, day: 10 } },
  { symbol: 'MES', name: 'Micro S&P 500 futures', pointValue: 5, tick: 0.25, decimals: 2, margin: 150, fee: 0.5, px: 5248.5, vol: 0.15, months: 'HMUZ', roll: { monthsBefore: 0, day: 10 } },
  { symbol: 'NQ', name: 'Nasdaq 100 futures', pointValue: 20, tick: 0.25, decimals: 2, margin: 2200, fee: 2, px: 18420.25, vol: 0.2, months: 'HMUZ', roll: { monthsBefore: 0, day: 10 } },
  { symbol: 'MNQ', name: 'Micro Nasdaq 100 futures', pointValue: 2, tick: 0.25, decimals: 2, margin: 220, fee: 0.5, px: 18420.25, vol: 0.2, months: 'HMUZ', roll: { monthsBefore: 0, day: 10 } },
  { symbol: 'CL', name: 'Crude oil futures', pointValue: 1000, tick: 0.01, decimals: 2, margin: 1800, fee: 2, px: 78.42, vol: 0.34, months: 'FGHJKMNQUVXZ', roll: { monthsBefore: 1, day: 15 } },
  { symbol: 'GC', name: 'Gold futures', pointValue: 100, tick: 0.1, decimals: 1, margin: 2000, fee: 2, px: 2384.6, vol: 0.16, months: 'GJMQVZ', roll: { monthsBefore: 1, day: 25 } },
  { symbol: 'SI', name: 'Silver futures', pointValue: 5000, tick: 0.005, decimals: 3, margin: 2500, fee: 2, px: 29.415, vol: 0.3, months: 'HKNUZ', roll: { monthsBefore: 1, day: 25 } },
];
const BY_SYMBOL = new Map(FUT_PRODUCTS.map(p => [p.symbol, p]));
export const futProduct = (symbol: string): FutProduct => BY_SYMBOL.get(symbol.toUpperCase()) ?? FUT_PRODUCTS[0];
export const isFutSymbol = (symbol: string): boolean => BY_SYMBOL.has(symbol.toUpperCase());

/** A price on the product's tick */
export const onTick = (p: FutProduct, v: number): number => +(Math.round(v / p.tick) * p.tick).toFixed(p.decimals);
export const futPrice = (p: FutProduct, v: number): string => v.toLocaleString('en-US', { minimumFractionDigits: p.decimals, maximumFractionDigits: p.decimals });

/* ---- the contract month in front on a day: "ESM6" ---- */
const MONTH_CODES = 'FGHJKMNQUVXZ';
const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
/** The front month on a day: the first listed month whose roll day is still ahead */
export const frontContract = (symbol: string, day: string): string => frontContractOf(futProduct(symbol), day);
/** …of a product this table does not list (the paper desk's Russell pair, data/paper/feed.ts) */
export function frontContractOf(p: FutProduct, day: string): string {
  const d = dateOf(day);
  for (let i = 0; i < 26; i++) {
    const y = d.getFullYear() + Math.floor((d.getMonth() + i) / 12);
    const m = (d.getMonth() + i) % 12;
    if (!p.months.includes(MONTH_CODES[m])) continue;
    const rm = m - p.roll.monthsBefore;
    const rollDay = iso(rm < 0 ? y - 1 : y, (rm + 12) % 12, p.roll.day);
    if (rollDay > day) return `${p.symbol}${MONTH_CODES[m]}${String(y).slice(-1)}`;
  }
  return `${p.symbol}?`;
}

/* ---- real instants: minute 0 is 18:00 New York on the calendar day BEFORE the trading day ---- */
let nyHour: Intl.DateTimeFormat | null = null;
let nyStamp: Intl.DateTimeFormat | null = null;
const opens = new Map<string, number>();
function openEpoch(day: string): number {
  const hit = opens.get(day);
  if (hit != null) return hit;
  const d = dateOf(day);
  d.setDate(d.getDate() - 1);
  /* 18:00 in New York, guessed as winter's (23:00 UTC) and set right by what New York's clock reads then */
  const guess = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 23, 0);
  nyHour ??= new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', hour: 'numeric' });
  const reads = Number(nyHour.formatToParts(new Date(guess)).find(x => x.type === 'hour')?.value ?? 18);
  const at = guess / 1000 - (reads - 18) * 3600;
  opens.set(day, at);
  return at;
}
export const futBarTime = (day: string, minute: number): number => openEpoch(day) + minute * 60;
/** "18:01" for minute 0 … "17:00" for the day's last. A cursor on minute m stands at the END of that bar. */
export const futClockWords = (minute: number): string => {
  const t = (18 * 60 + minute + 1) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};
/** "Jun 21 · 19:30" — the CALENDAR day of the moment (a trading day's evening belongs to the day before), in New York */
export const futMomentWords = (day: string, minute: number): string => {
  nyStamp ??= new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' });
  return `${nyStamp.format(new Date((futBarTime(day, minute) + 60) * 1000))} · ${futClockWords(minute)}`;
};
export { dayWords as futDayWords };

/* ---- the daily path, walked back from today's quote ---- */
interface DayFrame {
  open: number;
  close: number;
}
const frames = new Map<string, Map<string, DayFrame>>();
function framesFor(symbol: string): Map<string, DayFrame> {
  const list = tapeDays();
  const key = `${symbol}|${list[list.length - 1]}`;
  const hit = frames.get(key);
  if (hit) return hit;
  const p = futProduct(symbol);
  /* a micro is its big brother's price: one walk for the pair */
  const walkOf = symbol.startsWith('M') && isFutSymbol(symbol.slice(1)) ? symbol.slice(1) : symbol;
  const sigmaDay = p.vol / Math.sqrt(252);
  const draws = list.map(day => {
    const u = stream(`fut|${walkOf}|${day}|day`);
    return { ret: gauss(u) * sigmaDay * 0.9 + 0.0002, gap: gauss(u) * sigmaDay * 0.06 };
  });
  const closes = new Array<number>(list.length);
  closes[list.length - 1] = p.px;
  for (let i = list.length - 1; i > 0; i--) closes[i - 1] = closes[i] / (1 + draws[i].ret);
  const out = new Map<string, DayFrame>();
  list.forEach((day, i) => {
    const prev = i > 0 ? closes[i - 1] : closes[0] / (1 + draws[0].ret);
    out.set(day, { open: prev * (1 + draws[i].gap), close: closes[i] });
  });
  if (frames.size > 8) frames.clear();
  frames.set(key, out);
  return out;
}

/* THE DAY'S SHAPE, by the New York clock: a quiet night, Europe's morning, the 08:30 numbers, the stock market's own U,
   and a slow last hour. Minute k begins at 18:00 + k. */
const shapeAt = (k: number): number => {
  if (k < 480) return 0.35; // 18:00 – 02:00
  if (k < 840) return 0.55; // 02:00 – 08:00
  if (k < 930) return 0.95; // 08:00 – 09:30
  if (k < 1320) return 0.9 + 1.2 * Math.pow(Math.abs((k - 930) / 390 - 0.5) * 2, 1.6); // 09:30 – 16:00
  return 0.5; // 16:00 – 17:00
};
const SHAPE_NORM = Math.sqrt(Array.from({ length: FUT_DAY_MIN }, (_, k) => shapeAt(k) ** 2).reduce((a, b) => a + b, 0));

const barCache = new Map<string, Candle[]>();
export function futDayBars(symbol: string, day: string): Candle[] {
  const key = `${symbol}|${day}`;
  const hit = barCache.get(key);
  if (hit) return hit;
  const f = framesFor(symbol).get(day);
  if (!f) return [];
  const p = futProduct(symbol);
  const walkOf = symbol.startsWith('M') && isFutSymbol(symbol.slice(1)) ? symbol.slice(1) : symbol;
  const u = stream(`fut|${walkOf}|${day}|bars`);
  const sigmaDay = p.vol / Math.sqrt(252);
  const walk = new Array<number>(FUT_DAY_MIN + 1);
  walk[0] = 0;
  for (let k = 1; k <= FUT_DAY_MIN; k++) walk[k] = walk[k - 1] + (gauss(u) * sigmaDay * shapeAt(k - 1)) / SHAPE_NORM;
  /* the bridge: take out whatever the walk missed the close by, evenly */
  const miss = Math.log(f.close / f.open) - walk[FUT_DAY_MIN];
  const at = (k: number) => f.open * Math.exp(walk[k] + (miss * k) / FUT_DAY_MIN);
  const bars: Candle[] = [];
  for (let k = 0; k < FUT_DAY_MIN; k++) {
    const open = onTick(p, at(k));
    const close = onTick(p, at(k + 1));
    const wig = open * (sigmaDay / SHAPE_NORM) * shapeAt(k) * (0.35 + 0.9 * u());
    bars.push({
      time: futBarTime(day, k),
      open,
      high: onTick(p, Math.max(open, close) + wig),
      low: onTick(p, Math.min(open, close) - wig),
      close,
      volume: Math.round((p.symbol.startsWith('M') ? 900 : 2600) * shapeAt(k) ** 2 * (0.5 + u())),
    });
  }
  if (barCache.size > 24) barCache.clear();
  barCache.set(key, bars);
  return bars;
}
/** The bar of a minute — what an order meets */
export const futBarAt = (symbol: string, day: string, minute: number): Candle | undefined => futDayBars(symbol, day)[Math.max(0, Math.min(FUT_LAST_MIN, minute))];
/** Where it stood at the end of a minute */
export const futPriceAt = (symbol: string, day: string, minute: number): number => futBarAt(symbol, day, minute)?.close ?? futProduct(symbol).px;
