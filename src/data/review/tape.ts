/*
==================================================
  SLAYER TERMINAL - REVIEW · THE TAPE
  (data/review/tape.ts)

  What a backtest replays: one name's past sessions,
  a minute bar at a time. THIS FILE AND quotes.ts ARE
  THE SEAM — today they are a seeded stand-in, and
  when the real tape is wired in (ThetaData's history
  on R2, docs/launch-costs.md ch. 12) only these two
  files change. Nothing above them reads a simulator.

  WHY NOT THE LIVE SIMULATOR'S HISTORY. It is rolled
  with Math.random and anchored to the moment the app
  opened, so it is a different past on every load — a
  session saved on Tuesday would reopen on Wednesday
  over prices that never were. A backtest needs a past
  that STAYS PUT: this tape is seeded by the name and
  the date, so the 14th of March is the same 14th of
  March for every reader, every time.

  THE SHAPE. A year of real trading days (the house
  calendar, holidays and all) ending at the last
  finished session. Each day is 390 minute bars, 09:30
  to 16:00 New York. A bar's `time` is THE REAL
  INSTANT that New York minute began (daylight saving
  and all) — the backtest is drawn by the house chart
  now (2026-09-20), and every chart in the house reads
  real epochs through chartTime.ts, in the clock the
  reader chose in Settings. (It was the wall-clock
  minute written as UTC while the backtest drew a
  small chart of its own.)
  The daily path is walked BACK from the name's quote
  today, so the last session ends where the terminal
  says the name is.
==================================================
*/

import { isTradingDay, isoDate, today } from '../../core/calendar';
import { UNIVERSE } from '../universe';
import type { Candle } from '../../types/market';

/** Minutes in a session, and the minute the bell rings on (the last bar's index) */
export const DAY_MIN = 390;
export const LAST_MIN = DAY_MIN - 1;
/** How far back the tape goes, in trading days */
export const TAPE_DAYS = 252;

export interface ReviewName {
  ticker: string;
  name: string;
  /** Where the name is quoted today — the tape's last close */
  px: number;
  /** The name's own annual vol — the walk's width and the chain's base */
  iv: number;
  /** The distance between listed strikes */
  step: number;
}

const stepFor = (px: number) => (px < 25 ? 0.5 : px < 100 ? 1 : px < 250 ? 2.5 : 5);
const FUNDS: ReviewName[] = [
  { ticker: 'SPY', name: 'S&P 500 fund', px: 520.4, iv: 0.15, step: 1 },
  { ticker: 'QQQ', name: 'Nasdaq 100 fund', px: 446.2, iv: 0.19, step: 1 },
  { ticker: 'IWM', name: 'Russell 2000 fund', px: 221.7, iv: 0.21, step: 1 },
];
/** Every name a session can be opened on — the funds, then the terminal's universe */
export const REVIEW_NAMES: ReviewName[] = [
  ...FUNDS,
  ...UNIVERSE.map(u => ({ ticker: u.ticker, name: u.name, px: u.px, iv: Math.min(0.85, Math.max(0.14, 0.1 + 0.16 * u.beta)), step: stepFor(u.px) })),
];
const BY_TICKER = new Map(REVIEW_NAMES.map(n => [n.ticker, n]));
export const reviewName = (ticker: string): ReviewName => BY_TICKER.get(ticker.toUpperCase()) ?? FUNDS[0];

/* ---- a seeded generator: the same draws for the same key, in order ---- */
function seedOf(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
/** mulberry32 — one stream per key (NOT a hash per draw: keys that differ only at their end come out correlated) */
export function stream(key: string): () => number {
  let a = seedOf(key) || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const gauss = (u: () => number) => Math.sqrt(-2 * Math.log(Math.max(1e-12, u()))) * Math.cos(2 * Math.PI * u());

/* ---- the days ---- */
export const dateOf = (iso: string): Date => new Date(`${iso}T12:00:00`);
let daysFor = '';
let days: string[] = [];
/** The tape's trading days, oldest first — it ends at the last FINISHED session (never today: today is still live) */
export function tapeDays(): string[] {
  const key = isoDate(today());
  if (key === daysFor) return days;
  const out: string[] = [];
  const d = new Date(today());
  d.setHours(12, 0, 0, 0);
  while (out.length < TAPE_DAYS) {
    d.setDate(d.getDate() - 1);
    if (isTradingDay(d)) out.push(isoDate(d));
  }
  daysFor = key;
  days = out.reverse();
  return days;
}
export const dayIndex = (iso: string): number => tapeDays().indexOf(iso);
/** The trading day after this one on the tape, or null at its end */
export const nextDay = (iso: string): string | null => tapeDays()[dayIndex(iso) + 1] ?? null;
export const prevDay = (iso: string): string | null => tapeDays()[dayIndex(iso) - 1] ?? null;

/* 09:30 in New York on a date, as a real instant. The guess is winter's (14:30 UTC); what New York's clock reads at that
   instant says whether the date is in summer time. The clocks change at 02:00 on a Sunday, never inside a session. */
let nyHour: Intl.DateTimeFormat | null = null;
const opens = new Map<string, number>();
function openEpoch(iso: string): number {
  const hit = opens.get(iso);
  if (hit != null) return hit;
  const [y, m, d] = iso.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d, 14, 30);
  nyHour ??= new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', hour: 'numeric' });
  const reads = Number(nyHour.formatToParts(new Date(guess)).find(p => p.type === 'hour')?.value ?? 9);
  const at = guess / 1000 - (reads - 9) * 3600;
  opens.set(iso, at);
  return at;
}
/** A bar's stamp: the real instant its New York minute began (see the head note) */
export function barTime(iso: string, minute: number): number {
  return openEpoch(iso) + minute * 60;
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** "Mar 14" · "Fri, Mar 14, 2025" */
export const dayWords = (iso: string, long = false): string => {
  const d = dateOf(iso);
  return long ? `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}` : `${MONTHS[d.getMonth()]} ${d.getDate()}`;
};
/** "09:30" for minute 0 … "16:00" for the bell. A cursor on minute m stands at the END of that bar: m + 1 minutes in. */
export const clockWords = (minute: number): string => {
  const t = 9 * 60 + 30 + minute + 1;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

/* ---- the daily path, walked back from today's quote ---- */
interface DayFrame {
  open: number;
  close: number;
  /** The name's vol that day — it breathes, slowly */
  iv: number;
}
const frames = new Map<string, Map<string, DayFrame>>();
function framesFor(ticker: string): Map<string, DayFrame> {
  const list = tapeDays();
  const key = `${ticker}|${list[list.length - 1]}`;
  const hit = frames.get(key);
  if (hit) return hit;
  const n = reviewName(ticker);
  const sigmaDay = n.iv / Math.sqrt(252);
  /* each day's own draws: its return, its overnight gap, its vol's nudge */
  const draws = list.map(iso => {
    const u = stream(`${ticker}|${iso}|day`);
    return { ret: gauss(u) * sigmaDay * 0.9 + 0.0002, gap: gauss(u) * sigmaDay * 0.35, nudge: gauss(u) };
  });
  const closes = new Array<number>(list.length);
  closes[list.length - 1] = n.px;
  for (let i = list.length - 1; i > 0; i--) closes[i - 1] = closes[i] / (1 + draws[i].ret);
  /* the vol mean-reverts round the name's own, and leans up after a hard day down */
  let v = 1;
  const out = new Map<string, DayFrame>();
  list.forEach((iso, i) => {
    const prev = i > 0 ? closes[i - 1] : closes[0] / (1 + draws[0].ret);
    v = Math.min(1.7, Math.max(0.7, v + (1 - v) * 0.12 + draws[i].nudge * 0.035 + Math.max(0, -draws[i].ret) * 2.2));
    out.set(iso, { open: prev * (1 + draws[i].gap), close: closes[i], iv: n.iv * v });
  });
  frames.clear(); // one name's year at a time is plenty
  frames.set(key, out);
  return out;
}
/** The name's base vol on a day — what that day's chain is priced off */
export const baseIvAt = (ticker: string, iso: string): number => framesFor(ticker).get(iso)?.iv ?? reviewName(ticker).iv;

/* ---- a day's minutes: a walk from its open that lands on its close ---- */
const r2 = (v: number) => Math.round(v * 100) / 100;
const barCache = new Map<string, Candle[]>();
export function dayBars(ticker: string, iso: string): Candle[] {
  const key = `${ticker}|${iso}`;
  const hit = barCache.get(key);
  if (hit) return hit;
  const f = framesFor(ticker).get(iso);
  if (!f) return [];
  const u = stream(`${key}|bars`);
  const sigmaMin = (f.iv / Math.sqrt(252)) / Math.sqrt(DAY_MIN);
  /* the open and the close are busier than lunch: the step's width follows a U */
  const shape = (k: number) => 0.7 + 1.1 * Math.pow(Math.abs(k / LAST_MIN - 0.5) * 2, 1.6);
  const walk = new Array<number>(DAY_MIN + 1);
  walk[0] = 0;
  for (let k = 1; k <= DAY_MIN; k++) walk[k] = walk[k - 1] + gauss(u) * sigmaMin * shape(k);
  /* the bridge: take out whatever the walk missed the close by, evenly */
  const miss = Math.log(f.close / f.open) - walk[DAY_MIN];
  const at = (k: number) => f.open * Math.exp(walk[k] + (miss * k) / DAY_MIN);
  const n = reviewName(ticker);
  const bars: Candle[] = [];
  for (let k = 0; k < DAY_MIN; k++) {
    const open = at(k);
    const close = at(k + 1);
    const wig = open * sigmaMin * (0.35 + 0.9 * u());
    bars.push({
      time: barTime(iso, k),
      open: r2(open),
      high: r2(Math.max(open, close) + wig),
      low: r2(Math.min(open, close) - wig),
      close: r2(close),
      volume: Math.round((n.px < 60 ? 9000 : 4200) * shape(k) * (0.5 + u())),
    });
  }
  if (barCache.size > 48) barCache.clear();
  barCache.set(key, bars);
  return bars;
}
/** Where the name stood at the end of a minute */
export function spotAt(ticker: string, iso: string, minute: number): number {
  const bars = dayBars(ticker, iso);
  return bars[Math.max(0, Math.min(LAST_MIN, minute))]?.close ?? reviewName(ticker).px;
}
