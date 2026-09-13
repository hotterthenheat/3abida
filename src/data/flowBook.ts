/*
==================================================
  SLAYER TERMINAL - THE DAY BOOK (data/flowBook.ts)

  Every contract that traded today, rolled up — the
  ONE generator behind the whole flow family. The
  screener reads it whole; net flow, the OI explorer,
  0DTE, interval and multi-leg views are CUTS of the
  same book, so seven surfaces can never quote seven
  different days. (The live tape is a different fact:
  a per-print stream that only exists while the app
  listens — flowBars.ts. This is the day's totals.)

  Deterministic per (day, minute) through the engine
  clock — the DRIP's contract: numbers GROW through
  the session for real, replay re-derives the same
  book, and everything memoizes on the clock's
  minute. Placeholder physics — a real per-contract
  aggregation feed fills the same rows later.

  The fill model mirrors data/tape.ts enrichPrint
  (intrinsic + gaussian time value) so the book and
  the tape price a contract alike.
==================================================
*/

import { dayKey, h01, hRange } from '../core/rng';
import { now } from '../core/clock';
import { SECTOR_LIST, sectorOf } from './darkpool';
import { buildEarningsCalendar } from './earnings';
import { sleeveForDte } from './compass';
import { reasonMatches, reasonsSignature, type UserReason } from './flowReasons';
import type { SleeveKey } from '../types/compass';
import type { UniverseQuote } from '../types/compass';
import type { BookContract } from '../types/trace';

/** Expiry runway the book quotes on — short end dense, the tape's own skew. */
const DTE_POOL = [0, 1, 2, 5, 9, 16, 30, 44, 72, 102, 183] as const;

/** How much of the day's flow has landed by minute m — front-loaded like a
    real session, monotonic so cumulative columns never shrink. */
function accruedFrac(minute: number): number {
  const fm = Math.min(1, Math.max(0, minute / 1440));
  return Math.pow(fm, 0.85);
}

function expiryLabel(dte: number): string {
  const d = new Date(now().getTime() + dte * 86400000);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
}

let bookCache: { key: string; rows: BookContract[] } | null = null;

/** The whole market's option day, one row per contract. Pass the same
    universe the Compass sweeps (Simulator.universeQuotes) — a replay harness
    hands historical quotes through the same parameter. */
export function buildFlowBook(quotes: UniverseQuote[]): BookContract[] {
  const day = dayKey();
  const t0 = now();
  const nowMin = t0.getHours() * 60 + t0.getMinutes();
  const cacheKey = `${day}-${nowMin}`;
  if (bookCache?.key === cacheKey) return bookCache.rows;

  // Quarter-hour bucket — intraday wobble steps deterministically, not per render.
  const q = Math.floor(nowMin / 15);
  const frac = accruedFrac(nowMin);
  const rows: BookContract[] = [];

  // Sessions-to-earnings from the Earnings desk's own calendar — one source.
  const earnMap = new Map<string, number>();
  for (const e of buildEarningsCalendar()) {
    if (!earnMap.has(e.ticker)) earnMap.set(e.ticker, e.daysOut);
  }

  for (const quote of quotes) {
    const t = quote.ticker;
    const sec = sectorOf(t);
    // Per-ticker day weight — leadership rotates day to day.
    const dayW = Math.pow(hRange(`${day}-fbw-${t}`, 0.45, 1.55), 1.6);

    for (const dte of DTE_POOL) {
      // Short-dated contracts almost always print; the long end is sparse.
      const liveProb = dte <= 2 ? 0.92 : dte <= 16 ? 0.72 : dte <= 72 ? 0.5 : 0.34;
      if (h01(`${day}-fb-on-${t}-${dte}`) > liveProb) continue;

      const nStrikes = 2 + Math.floor(h01(`${day}-fb-ns-${t}-${dte}`) * 3);
      // Two draws can land the same strike+right — ONE row per contract, ever
      // (a duplicate key double-quotes the day and corrupts row reconciliation).
      const taken = new Set<string>();
      for (let si = 0; si < nStrikes; si++) {
        const seed = `${day}-fb-${t}-${dte}-${si}`;
        const h = (tag: string) => h01(`${seed}-${tag}`);

        // Strike near the money with a slight OTM lean — where flow lives.
        const offset = Math.round((h('off') - 0.42) * 9);
        const strike = Number((Math.round(quote.price / quote.step) * quote.step + offset * quote.step).toFixed(2));
        if (strike <= 0) continue;
        const right: 'C' | 'P' = h('right') < 0.55 ? 'C' : 'P';
        if (taken.has(`${strike}-${right}`)) continue;
        taken.add(`${strike}-${right}`);
        const money = (strike - quote.price) / quote.price;

        // Pricing first — the tape's fill model, so both surfaces quote alike.
        const ivFrac = quote.iv * (0.8 + h('iv') * 0.55);
        const intrinsic = right === 'C' ? Math.max(quote.price - strike, 0) : Math.max(strike - quote.price, 0);
        const timeValue =
          quote.price * ivFrac * 0.08 * Math.exp(-Math.pow(money * 18, 2) / 2) * (0.5 + Math.sqrt((dte + 1) / 30));
        const openFill = Math.max(0.05, intrinsic * 0.98 + timeValue);

        // Day volume target: power-law so a handful of contracts carry the
        // tape, damped by PRICE — a $20 contract cannot trade like a $0.30
        // one, and without this the book prints billion-dollar rows.
        const dteBoost = dte <= 1 ? 1.6 : dte <= 6 ? 1.15 : dte <= 44 ? 0.75 : 0.42;
        const priceDamp = 1 / Math.pow(1 + openFill / 1.2, 0.9);
        const target = (500 + Math.pow(h('vt'), 2.2) * 200000) * dayW * dteBoost * priceDamp;
        // Accrual with a per-contract quarter-hour wobble — grows, never shrinks.
        const wobble = 0.92 + 0.16 * h01(`${seed}-ph-${q}`);
        const volume = Math.round(target * frac * wobble);
        if (volume < 60) continue; // quiet contracts don't make the book

        /* The overnight ledger — OI is what STAYED. A few contracts each day
           are OPENERS (yesterday's volume became standing interest), a few are
           UNWINDS (positions closed out), the rest drift. Volume is loud and
           gone; this is the fat-tailed fact Footprints ranks by. */
        const opener = h('opn') > 0.955;
        const closer = !opener && h('cls') > 0.945;
        let prevOI = Math.max(25, Math.round(target * hRange(`${seed}-poi`, 0.3, 2.2)));
        let deltaOI: number;
        let prevVolume: number;
        if (opener) {
          // A fresh build sometimes lands on a near-empty contract — the
          // percentage is the scream, not the count.
          if (h('fresh') > 0.6) prevOI = Math.max(5, Math.round(hRange(`${seed}-poi2`, 5, 900)));
          prevVolume = Math.round(target * (1.5 + Math.pow(h('opv'), 2) * 6.5));
          deltaOI = Math.round(prevVolume * hRange(`${seed}-carry`, 0.55, 0.95));
        } else if (closer) {
          deltaOI = -Math.round(prevOI * hRange(`${seed}-unw`, 0.15, 0.6));
          prevVolume = Math.round(Math.abs(deltaOI) * hRange(`${seed}-unv`, 1.1, 1.8));
        } else {
          deltaOI = h('doi') > 0.32 ? Math.round((h('doi2') - 0.42) * prevOI * 0.35) : 0;
          prevVolume = Math.round(target * hRange(`${seed}-pv`, 0.5, 1.5));
        }
        const oi = Math.max(25, prevOI + deltaOI);

        // Ask-side share first; the day's price change leans the same way the
        // aggressors did, plus noise — buyers lifting tends to mark it up.
        const askPct = Math.round(15 + h('ask') * 70);
        const chgPct = Number((((askPct - 50) / 50) * 38 + (h01(`${seed}-chg-${q}`) - 0.5) * 44).toFixed(1));
        const last = Number(Math.max(0.05, openFill * (1 + chgPct / 100)).toFixed(2));

        // Most recent print: heavy contracts print constantly, quiet ones lag.
        const gapCap = volume > 20000 ? 3 : volume > 3000 ? 25 : 240;
        const gap = Math.round(Math.pow(1 - h01(`${seed}-la-${q}`), 2) * gapCap);
        const lastAtMin = Math.max(10, nowMin - gap);

        // Yesterday's texture — fill, side, and the 15-min shape of the day.
        const prevAvgFill = Number(Math.max(0.05, openFill * hRange(`${seed}-pf`, 0.75, 1.2)).toFixed(2));
        const prevAskPct = Math.round(15 + h('pask') * 70);
        const spark: number[] = [];
        const buildAt = Math.floor(h('sw0') * 22);
        for (let b = 0; b < 26; b++) {
          let v = Math.pow(h01(`${seed}-sp-${b}`), 3);
          // An opener's build shows as a burst window, the reference's own tell.
          if (opener && b >= buildAt && b < buildAt + 3) v += 0.7 + h01(`${seed}-spk-${b}`) * 0.3;
          spark.push(v);
        }
        const sparkMax = Math.max(...spark, 0.001);

        rows.push({
          key: `${t}-${strike}-${right}-${dte}`,
          ticker: t,
          sector: sec?.sector ?? null,
          sectorColor: sec?.color ?? null,
          strike,
          right,
          expiry: expiryLabel(dte),
          dte,
          spot: Number(quote.price.toFixed(2)),
          otmPct: Number((money * 100).toFixed(1)),
          last,
          chgPct,
          lastAt: `${String(Math.floor(lastAtMin / 60)).padStart(2, '0')}:${String(lastAtMin % 60).padStart(2, '0')}`,
          lastAtMin,
          volume,
          oi,
          deltaOI,
          deltaOIPct: Number(((deltaOI / prevOI) * 100).toFixed(1)),
          premium: Math.round(volume * last * 100 * hRange(`${seed}-pj`, 0.85, 1.15)),
          iv: Number((ivFrac * 100).toFixed(1)),
          ivChg: Number(((h('ivd') - 0.42) * ivFrac * 100 * 0.25).toFixed(1)),
          volOverOI: Number((volume / oi).toFixed(2)),
          sweepPct: Math.round(Math.pow(h('sw'), 1.5) * 70),
          multiPct: Math.round(Math.pow(h('ml'), 2) * 55),
          // Floor crosses: most contracts none, some a slice, a rare few
          // trade ENTIRELY on the floor — one institution's day.
          floorPct:
            h('flr3') > 0.96
              ? 90 + Math.round(h('flr4') * 10)
              : h('flr') > 0.72
                ? Math.round(Math.pow(h('flr2'), 2) * 70)
                : 0,
          askPct,
          prevOI,
          prevVolume,
          prevAvgFill,
          prevPremium: Math.round(prevVolume * prevAvgFill * 100),
          prevAskPct,
          oiStreak: deltaOI > 0 ? 1 + Math.floor(Math.pow(h('stk'), 1.6) * 9) : 0,
          volGtOiStreak: prevVolume > prevOI ? 1 + Math.floor(h('vstk') * 3) : 0,
          earnDays: earnMap.get(t) ?? null,
          prevSpark: spark.map(v => Number((v / sparkMax).toFixed(3))),
        });
      }
    }
  }

  rows.sort((a, b) => b.volume - a.volume);
  bookCache = { key: cacheKey, rows };
  return rows;
}

// ---- screens ----------------------------------------------------------------

/* A screen is a QUESTION asked of the book — a filter and an ordering, never a
   judgment. States stay Compass's job; a screen only decides which rows are an
   answer and which number ranks them. */
export type ScreenKey =
  | 'active'
  | 'bullish'
  | 'bearish'
  | 'fresh'
  | 'conviction-calls'
  | 'conviction-puts'
  | 'cheap'
  | 'long-term';

export interface FlowScreen {
  key: ScreenKey;
  label: string;
  /** Whispered under the chip row — what the cut means, in plain English */
  hint: string;
}

export const FLOW_SCREENS: FlowScreen[] = [
  { key: 'active', label: 'Most active', hint: 'The whole book, heaviest volume first' },
  { key: 'bullish', label: 'Unusually bullish', hint: 'Calls being bought and puts being sold, ranked by premium' },
  { key: 'bearish', label: 'Unusually bearish', hint: 'Puts being bought and calls being sold, ranked by premium' },
  { key: 'fresh', label: 'New positioning', hint: 'Volume running past open interest — positions built today' },
  { key: 'conviction-calls', label: 'Conviction calls', hint: 'Out-of-the-money calls with heavy sweep share' },
  { key: 'conviction-puts', label: 'Conviction puts', hint: 'Out-of-the-money puts with heavy sweep share' },
  { key: 'cheap', label: 'Cheap calls', hint: 'Low-priced out-of-the-money calls the crowd is trading' },
  { key: 'long-term', label: 'Long-dated', hint: 'Three months out and beyond — patient money' },
];

/** Aggressive call flow reads bullish; put flow bought at the ask reads
    bearish — sentimentOf's rule, applied to the day's dominant side. */
function leansBull(r: BookContract): boolean {
  return r.right === 'C' ? r.askPct >= 58 : r.askPct <= 42;
}
function leansBear(r: BookContract): boolean {
  return r.right === 'P' ? r.askPct >= 58 : r.askPct <= 42;
}

export function runScreen(rows: BookContract[], key: ScreenKey): BookContract[] {
  switch (key) {
    case 'active':
      return rows; // the book's own order — volume desc
    case 'bullish':
      return rows.filter(r => leansBull(r) && r.volOverOI >= 0.8).sort((a, b) => b.premium - a.premium);
    case 'bearish':
      return rows.filter(r => leansBear(r) && r.volOverOI >= 0.8).sort((a, b) => b.premium - a.premium);
    case 'fresh':
      return rows.filter(r => r.volOverOI >= 1.5).sort((a, b) => b.volOverOI - a.volOverOI);
    case 'conviction-calls':
      return rows
        .filter(r => r.right === 'C' && r.sweepPct >= 25 && r.otmPct >= 0)
        .sort((a, b) => b.premium - a.premium);
    case 'conviction-puts':
      return rows
        .filter(r => r.right === 'P' && r.sweepPct >= 25 && r.otmPct <= 0)
        .sort((a, b) => b.premium - a.premium);
    case 'cheap':
      return rows.filter(r => r.right === 'C' && r.last <= 1.5 && r.otmPct >= 3).sort((a, b) => b.volume - a.volume);
    case 'long-term':
      return rows.filter(r => r.dte >= 90).sort((a, b) => b.premium - a.premium);
  }
}

// ---- footprint screens ------------------------------------------------------

/* Footprints asks the OVERNIGHT questions — what stayed, who built it, what
   left. Same rule as the screener's screens: a filter and an ordering, never
   a judgment. */
export type FootprintScreenKey =
  | 'builds'
  | 'fresh'
  | 'bought'
  | 'sold'
  | 'carryover'
  | 'unwinds'
  | 'streaks';

export interface FootprintScreen {
  key: FootprintScreenKey;
  label: string;
  hint: string;
}

export const FOOTPRINT_SCREENS: FootprintScreen[] = [
  { key: 'builds', label: 'Biggest builds', hint: 'The most new interest standing since yesterday' },
  { key: 'fresh', label: 'Fresh positions', hint: 'Built on near-empty contracts — the loudest percentage jumps' },
  { key: 'bought', label: 'Bought to open', hint: 'Builds that lifted the ask — buyers opened these' },
  { key: 'sold', label: 'Sold to open', hint: 'Builds that hit the bid — these were written, not bought' },
  { key: 'carryover', label: 'Carryover', hint: "Yesterday's heaviest volume that became standing interest" },
  { key: 'unwinds', label: 'Unwinds', hint: 'Interest that left — positions closed out overnight' },
  { key: 'streaks', label: 'Building streaks', hint: 'Interest climbing three sessions or more in a row' },
];

export function runFootprintScreen(rows: BookContract[], key: FootprintScreenKey): BookContract[] {
  const builds = rows.filter(r => r.deltaOI > 0);
  switch (key) {
    case 'builds':
      return builds.sort((a, b) => b.deltaOI - a.deltaOI);
    case 'fresh':
      return builds.filter(r => r.prevOI <= 1000).sort((a, b) => b.deltaOIPct - a.deltaOIPct);
    case 'bought':
      return builds.filter(r => r.prevAskPct >= 58).sort((a, b) => b.deltaOI - a.deltaOI);
    case 'sold':
      return builds.filter(r => r.prevAskPct <= 42).sort((a, b) => b.deltaOI - a.deltaOI);
    case 'carryover':
      return builds
        .filter(r => r.prevVolume >= 20000 && r.deltaOI >= r.prevVolume * 0.5)
        .sort((a, b) => b.deltaOI - a.deltaOI);
    case 'unwinds':
      return rows.filter(r => r.deltaOI < 0).sort((a, b) => a.deltaOI - b.deltaOI);
    case 'streaks':
      return builds.filter(r => r.oiStreak >= 3).sort((a, b) => b.oiStreak - a.oiStreak || b.deltaOI - a.deltaOI);
  }
}

// ---- flow alerts ------------------------------------------------------------

/* The tape watching itself. Rules are the desk's own watchers over the day
   book — a contract surfaces the moment it trips one, and the feed drips
   through the session on the engine clock exactly like the news wire, so
   alerts LAND live and replay re-derives the same day. One book, one more
   reader: an alert can never quote numbers the screener disagrees with. */

/* VOCABULARY RULING (Noah, 2026-08-30): the user-facing word is REASON, not
   rule — the reader's question is "why is this in front of me", and each row
   answers it in a house phrase. "Repeated Hits" was the reference's verbatim
   wording (banned, the king→supreme precedent) and "whale" anything echoes
   their brand name — both replaced. */
export type WatcherKey = 'big-money' | 'into-earnings' | 'climbing' | 'falling' | 'fresh-size' | 'hammering';

export interface WatcherRule {
  key: WatcherKey;
  /** Short chip handle */
  label: string;
  /** The row's why — a plain-English clause, shown in the Reason column */
  reason: string;
  hint: string;
}

/** THE DESK'S WATCHERS (the Trace page of the same name — "Flow Alerts" until
    2026-09-11: the bell is the reader's alerts, these are the desk's own
    watchers over the day book). Priority order — a loud contract reports
    under its loudest reason first. */
export const WATCHERS: WatcherRule[] = [
  {
    key: 'big-money',
    label: 'Big money',
    reason: 'One print carried outsized money',
    hint: 'A single print big enough to move the day',
  },
  {
    key: 'into-earnings',
    label: 'Into earnings',
    reason: 'Built days before the report',
    hint: 'Heavy positioning with earnings days away',
  },
  {
    key: 'climbing',
    label: 'Climbing fills',
    reason: 'Kept printing at higher and higher prices',
    hint: 'Buying that keeps coming back, each fill higher — chasers',
  },
  {
    key: 'falling',
    label: 'Falling fills',
    reason: 'Kept printing at lower and lower prices',
    hint: 'Fills stepping lower while the volume keeps coming',
  },
  {
    key: 'fresh-size',
    label: 'Fresh size',
    reason: 'Volume ran far past the standing interest',
    hint: 'Trading many times its open interest — positions built today',
  },
  {
    key: 'hammering',
    label: 'Hammering',
    reason: 'The same contract hit over and over',
    hint: 'One contract absorbing hit after hit all session',
  },
];

/** One row the desk's (or the reader's) watcher caught */
export interface Catch {
  id: string;
  /** A house reason's key, or one of the reader's own reasons' ids. */
  rule: string;
  /** True when the reader wrote this reason — the feed is one feed, but it
      always says whose watcher caught the row. */
  mine: boolean;
  /** Minute-of-day the rule tripped */
  minute: number;
  /** HH:MM of the trip */
  time: string;
  /** The print that tripped it — sized within the contract's own day */
  clipSize: number;
  clipFill: number;
  clipPremium: number;
  side: 'ASK' | 'BID';
  row: BookContract;
}

function rulesFor(r: BookContract): WatcherKey[] {
  const out: WatcherKey[] = [];
  // "Big enough to move the day" has to stay RARE or the words mean nothing.
  if (r.premium >= 25_000_000) out.push('big-money');
  if (r.earnDays != null && r.earnDays <= 5 && r.deltaOI > 0 && r.volume >= 3000) out.push('into-earnings');
  // Climbing and falling are mirror predicates — chasers vs sellers, same bar.
  if (r.volume >= 6000 && r.sweepPct >= 25 && r.chgPct >= 8 && r.askPct >= 55) out.push('climbing');
  else if (r.volume >= 6000 && r.sweepPct >= 25 && r.chgPct <= -8 && r.askPct <= 45) out.push('falling');
  if (r.volOverOI >= 1.8 && r.premium >= 300_000) out.push('fresh-size');
  if (r.volume >= 12000 && r.sweepPct >= 30) out.push('hammering');
  return out.slice(0, 2); // a very loud contract reports at most twice
}

/** The reader's own reasons this row meets — same per-row ceiling as the house
    rules, so one very loud contract can never take over the feed. */
function myReasonsFor(r: BookContract, reasons: UserReason[]): string[] {
  const out: string[] = [];
  for (const reason of reasons) {
    if (reasonMatches(reason, r)) out.push(reason.id);
    if (out.length === 2) break;
  }
  return out;
}

let catchCache: { key: string; catches: Catch[] } | null = null;

/**
 * Every reason trip that has LANDED so far today, newest first — the desk's six
 * and the reader's own in ONE feed. A reader-made reason drips through the
 * session on the same clock and quotes the same book, so it can no more invent
 * a number than a house rule can.
 */
export function buildCatches(rows: BookContract[], reasons: UserReason[] = []): Catch[] {
  const day = dayKey();
  const t0 = now();
  const nowMin = t0.getHours() * 60 + t0.getMinutes();
  // The reader's shelf is part of the key: edit a reason and the feed must
  // re-derive now, not at the next minute boundary.
  const cacheKey = `${day}-${nowMin}-${reasonsSignature(reasons)}`;
  if (catchCache?.key === cacheKey) return catchCache.catches;

  const catches: Catch[] = [];
  for (const r of rows) {
    const house = rulesFor(r);
    const mine = myReasonsFor(r, reasons);
    for (const rule of [...house, ...mine]) {
      const isMine = !house.includes(rule as WatcherKey);
      const seed = `${day}-fa-${r.key}-${rule}`;
      // The trip is scheduled through the session — the drip's contract.
      const minute = 30 + Math.floor(h01(`${seed}-t`) * 1395);
      if (minute > nowMin) continue; // not tripped yet
      const clipSize = Math.max(10, Math.round(r.volume * hRange(`${seed}-cs`, 0.02, 0.18)));
      const clipFill = Number(Math.max(0.05, r.last * hRange(`${seed}-cf`, 0.9, 1.1)).toFixed(2));
      const side: Catch['side'] =
        rule === 'climbing' ? 'ASK' : rule === 'falling' ? 'BID' : r.askPct >= 50 ? 'ASK' : 'BID';
      catches.push({
        id: seed,
        rule,
        mine: isMine,
        minute,
        time: `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`,
        clipSize,
        clipFill,
        clipPremium: Math.round(clipSize * clipFill * 100),
        side,
        row: r,
      });
    }
  }

  catches.sort((a, b) => b.minute - a.minute);
  catchCache = { key: cacheKey, catches };
  return catches;
}

// ---- the day in windows -----------------------------------------------------

/* The tape cut into quarter-hours. Every contract's day volume distributes
   across the session's 96 windows by day-stable weights — a few contracts
   BURST (one window carries most of their whole day: somebody acted all at
   once), the rest dribble. Slices always sum back to the book's own day
   volume, so this page and the screener can never disagree about a day. */

const WINDOW_MIN = 15;
const WINDOWS_PER_DAY = 1440 / WINDOW_MIN;

export interface IntervalSlice {
  key: string;
  /** Window index, 0-95 */
  window: number;
  /** Contracts traded inside this window */
  vol: number;
  /** This window's share of the contract's WHOLE day, 0-100 — the burst tell */
  shareOfDayPct: number;
  /** Dollars traded inside the window. Derives from the day's premium by
      share, so window premiums SUM BACK to the book's own number. */
  premium: number;
  /** The window's average fill — premium ÷ (vol × 100), so the triple
      (vol, fill, $) can never contradict itself. */
  avgFill: number;
  /** IV drift inside the window, signed points */
  ivChg: number;
  sweepPct: number;
  multiPct: number;
  floorPct: number;
  askPct: number;
  volOverOI: number;
  row: BookContract;
}

export interface IntervalWindow {
  idx: number;
  /** "14:30–14:45" */
  label: string;
  /** All contracts' volume inside the window */
  totalVol: number;
  /** Still filling — the clock is inside it */
  live: boolean;
}

export function windowLabel(idx: number): string {
  const f = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  return `${f(idx * WINDOW_MIN)}–${f(idx * WINDOW_MIN + WINDOW_MIN)}`;
}

/** Day-stable per-window weights for one contract — long-tailed, with a rare
    burst window that swallows most of the day when it lands. */
const weightsCache = new Map<string, number[]>();
let weightsCacheDay = '';

function windowWeights(day: string, rowKey: string): number[] {
  if (weightsCacheDay !== day) {
    weightsCache.clear();
    weightsCacheDay = day;
  }
  const hit = weightsCache.get(rowKey);
  if (hit) return hit;
  const w: number[] = [];
  let baseSum = 0;
  for (let i = 0; i < WINDOWS_PER_DAY; i++) {
    const v = 0.05 + Math.pow(h01(`${day}-ivw-${rowKey}-${i}`), 3);
    w.push(v);
    baseSum += v;
  }
  if (h01(`${day}-ivb-${rowKey}`) > 0.88) {
    // The whole day in one window — the burst weight is sized against the
    // REST of the day, so the share lands 55-86% regardless of window count.
    const burstAt = Math.floor(h01(`${day}-ivb2-${rowKey}`) * WINDOWS_PER_DAY);
    w[burstAt] += baseSum * hRange(`${day}-ivb3-${rowKey}`, 1.2, 6);
  }
  weightsCache.set(rowKey, w);
  return w;
}

const wobble30 = (base: number, seed: string) =>
  Math.max(0, Math.min(100, Math.round(base + (h01(seed) - 0.5) * 30)));

let sliceCache: { key: string; slices: IntervalSlice[] } | null = null;

/** Every contract that traded inside window `idx`, heaviest first. */
export function buildIntervalSlices(rows: BookContract[], idx: number): IntervalSlice[] {
  const day = dayKey();
  const t0 = now();
  const nowMin = t0.getHours() * 60 + t0.getMinutes();
  const qNow = Math.floor(nowMin / WINDOW_MIN);
  const cacheKey = `${day}-${nowMin}-${idx}`;
  if (sliceCache?.key === cacheKey) return sliceCache.slices;

  // A window's price level relative to the contract's last — the wobble that
  // makes fills vary window to window while premiums still conserve.
  const fillW = (rowKey: string, i: number) => 0.85 + h01(`${day}-ivf-${rowKey}-${i}`) * 0.3;

  const slices: IntervalSlice[] = [];
  for (const r of rows) {
    const w = windowWeights(day, r.key);
    let landedSum = 0;
    let landedDollarW = 0;
    for (let i = 0; i <= qNow; i++) {
      landedSum += w[i];
      landedDollarW += w[i] * fillW(r.key, i);
    }
    let daySum = 0;
    for (let i = 0; i < WINDOWS_PER_DAY; i++) daySum += w[i];
    const vol = Math.round((r.volume * w[idx]) / landedSum);
    if (vol < 10) continue;
    // Dollar-weighted share of the day's premium — Σ over landed windows
    // returns r.premium exactly; the fill is read back OUT of the premium.
    const premium = Math.round((r.premium * (w[idx] * fillW(r.key, idx))) / landedDollarW);
    const seed = `${day}-ivs-${r.key}-${idx}`;
    slices.push({
      key: `${r.key}-${idx}`,
      window: idx,
      vol,
      shareOfDayPct: Number(((w[idx] / daySum) * 100).toFixed(1)),
      premium,
      avgFill: Number(Math.max(0.01, premium / (vol * 100)).toFixed(2)),
      ivChg: Number(((h01(`${seed}-ivd`) - 0.5) * r.iv * 0.1).toFixed(1)),
      sweepPct: wobble30(r.sweepPct, `${seed}-sw`),
      multiPct: wobble30(r.multiPct, `${seed}-ml`),
      floorPct: r.floorPct === 0 ? 0 : wobble30(r.floorPct, `${seed}-fl`),
      askPct: Math.max(5, Math.min(95, Math.round(r.askPct + (h01(`${seed}-ask`) - 0.5) * 30))),
      volOverOI: Number((vol / r.oi).toFixed(2)),
      row: r,
    });
  }

  slices.sort((a, b) => b.vol - a.vol);
  sliceCache = { key: cacheKey, slices };
  return slices;
}

let navCache: { key: string; windows: IntervalWindow[] } | null = null;

/** The session so far as a navigator — total volume per landed window. */
export function intervalWindows(rows: BookContract[]): IntervalWindow[] {
  const day = dayKey();
  const t0 = now();
  const nowMin = t0.getHours() * 60 + t0.getMinutes();
  const qNow = Math.floor(nowMin / WINDOW_MIN);
  const cacheKey = `${day}-${nowMin}`;
  if (navCache?.key === cacheKey) return navCache.windows;

  const totals = new Array(qNow + 1).fill(0);
  for (const r of rows) {
    const w = windowWeights(day, r.key);
    let landedSum = 0;
    for (let i = 0; i <= qNow; i++) landedSum += w[i];
    for (let i = 0; i <= qNow; i++) totals[i] += (r.volume * w[i]) / landedSum;
  }
  const windows: IntervalWindow[] = totals.map((v, idx) => ({
    idx,
    label: windowLabel(idx),
    totalVol: Math.round(v),
    live: idx === qNow,
  }));
  navCache = { key: cacheKey, windows };
  return windows;
}

// ---- net premium through the session ----------------------------------------

/* The running answer to "which way is the money leaning" — cumulative net
   call and net put premium (bought minus sold) through the day, per cut of
   the book. Built on the SAME window weights the Windows page walks, sampled
   along whatever timeline the caller's chart already draws, and premiums
   scale to the book's own day numbers — one more reader of the one book.
   The 0DTE desk reads it with dteMax 1; a whole-book net-flow surface reads
   it with no cap. */

/* THE CUT, in plain English (Noah, 2026-09-03: "i dont get what 'single
   names' mean… are the dropdowns reasonable? i am struggling to figure out
   the idea behind them"). The old list mixed four kinds of thing — the whole
   book, two families, two funds pulled out for convenience, one lone sector
   — and its family label was street jargon that promised ONE name. Now a
   cut is one of two kinds: the book by FAMILY (everything, the stocks alone,
   the index funds alone) or the book by SECTOR (every sector the terminal
   files, index funds excluded). One name is not a cut at all — it is the
   pane's ticker mode, reached through the name search in its head. */
export type NetFlowSegment = 'all' | 'stocks' | 'index-funds' | `sector:${string}`;

export interface NetSegmentMeta {
  key: NetFlowSegment;
  label: string;
  group: 'The book' | 'Sectors';
}

const INDEX_FUNDS = new Set(['SPY', 'QQQ', 'IWM']);

/* A sector is told by its glyph (components/trace/SectorMark), never a colour. */
export const NET_SEGMENTS: NetSegmentMeta[] = [
  { key: 'all', label: 'Everything', group: 'The book' },
  { key: 'stocks', label: 'Stocks only', group: 'The book' },
  { key: 'index-funds', label: 'Index funds only', group: 'The book' },
  ...SECTOR_LIST.map(s => ({ key: `sector:${s.sector}` as const, label: s.sector, group: 'Sectors' as const })),
];

export const isNetSegment = (v: unknown): v is NetFlowSegment =>
  typeof v === 'string' && NET_SEGMENTS.some(s => s.key === v);

export const segmentLabel = (seg: NetFlowSegment): string => NET_SEGMENTS.find(s => s.key === seg)?.label ?? seg;

export type MoneynessKey = 'all' | 'itm' | 'otm' | 'atm';

export const MONEYNESS: { key: MoneynessKey; label: string; hint: string }[] = [
  { key: 'all', label: 'All strikes', hint: 'Every strike in the cut' },
  { key: 'itm', label: 'ITM', hint: 'In the money — intrinsic value now' },
  { key: 'otm', label: 'OTM', hint: 'Out of the money — all time value' },
  { key: 'atm', label: 'ATM', hint: 'Within 1% of the spot' },
];

export function segmentFilter(r: BookContract, seg: NetFlowSegment): boolean {
  if (seg === 'all') return true;
  if (seg === 'index-funds') return INDEX_FUNDS.has(r.ticker);
  if (seg === 'stocks') return !INDEX_FUNDS.has(r.ticker);
  /* A sector is a cut of the STOCKS: the sector map files SPY/QQQ/IWM under
     Financial Services, and they would swallow that sector on a 0DTE day. */
  return r.sector === seg.slice('sector:'.length) && !INDEX_FUNDS.has(r.ticker);
}

export function moneynessFilter(r: BookContract, m: MoneynessKey): boolean {
  if (m === 'all') return true;
  if (m === 'atm') return Math.abs(r.otmPct) <= 1;
  const itm = r.right === 'C' ? r.otmPct < 0 : r.otmPct > 0;
  return m === 'itm' ? itm : !itm;
}

export interface NetFlowPoint {
  /** Epoch seconds — the caller's own chart timeline */
  time: number;
  /** Cumulative net call premium, signed dollars */
  callPrem: number;
  /** Cumulative net put premium, signed dollars */
  putPrem: number;
  /** Contracts traded in the bar */
  vol: number;
  /** The bar's own lean — inked green when the flow ran bullish */
  volUp: boolean;
}

export interface NetFlowView {
  points: NetFlowPoint[];
  /** Day-to-now net call premium */
  ncp: number;
  /** Day-to-now net put premium */
  npp: number;
  vol: number;
  /** Contracts in the cut */
  count: number;
}

/** Cumulative net premium sampled at the given times (epoch seconds).
    `ticker` narrows to one name (and replaces the segment cut); `tenor`
    narrows to a sleeve — the Net Flow page's axes. */
/*
  ── PRINTS, NOT EXPECTATIONS ─────────────────────────────────────────────────

  Noah, 2026-08-30, first: "why are my net call and put lines so straight and
  lack any movement to them?" — and, after a first repair, again: "they are
  literally straight lines that look like a kid was drawing. no diversity...
  do they even match their cards".

  The first repair added minute tables (a lumpy share of each window's flow,
  and a common mood shock) and measured its success by counting direction
  changes. It genuinely flipped sign every other minute — and still read as
  a ruler, because the flips were dust against the day's range. The reason is
  structural: the curve was an EXPECTATION. Each contract's premium was spread
  across the day as a smooth share, its lean applied as a fraction, and the
  mood folded in as a shift to that fraction. Averages are smooth, a sum of
  averages is smoother, and integrating the mood against the flow low-passed
  the one thing that could have bent it.

  A net-premium line is a running sum of PRINTS. It is flat while nobody
  trades, steps when someone does, and steps the other way when the other
  side trades. So the view now lands realised clips:

    per contract, per window   one to four clips, sizes heavy-tailed (one
                               clip often carries most of the window), each
                               dropped on a minute of its own
    per clip                   a realised SIDE — bought at the ask (+) or
                               sold on the bid (−) — drawn with probability
                               = the contract's own ask share, pushed by the
                               day's mood at that minute. The mood is what
                               makes a whole stretch of clips lean one way
                               and then the other, which is what an
                               aggregate reversal IS.

  What survives from before: window weights still shape the day (the
  screener, the windows page and the leader board keep agreeing to the
  dollar, because a contract's clips inside a window sum to that window's
  weight), the mood walk still supplies the common tide, and the curve is
  still normalised so it ENDS on the book's own totals — the header cards
  read the last point, by construction.

  Cost: day-stable clip tables cached per contract; a lookup is one window
  prefix plus at most four clip reads. Same order as the tables it replaces.
*/
const MINUTES_PER_DAY = 1440;

/*
  THE MOOD IS A WALK, NOT A STAIRCASE. The first attempt at this kept the shock
  mean-zero inside each window, which guaranteed it disturbed nothing — and
  looked it: the curve was pinned back onto its backbone every quarter hour, so
  it read as a smooth trend wearing fuzz rather than as a tape. A price line
  looks like a price line because its deviations PERSIST.

  So the mood is now an AR(1) walk sampled every minute, and its contribution is
  folded into the window prefixes themselves — the curve wanders for hours and
  the day still ends where the day's premium says it ends. Nothing downstream
  reads the net curve's window knots (the interval pages compute their own
  totals from windowWeights, and the leader board reads this very function), so
  there was no reason to pin them beyond my own caution.

  TWO SCALES, BOTH NEEDED. A pure AR(1) is smooth minute to minute, so on its
  own it just traded one wrong picture for another: big graceful swings and no
  texture at all (2 direction changes per 100 points, where the first attempt
  managed 50). A price line has roughness at EVERY scale, so the mood carries a
  slow component for the session's swings and an independent per-minute one for
  the chop. Integrated against the flow, the fast part is what makes the
  cumulative curve walk rather than glide.

    phi 0.965   half-life ≈ 20 minutes — swings that outlast a bar, and still
                cross zero often enough that a whole day is not one-way
    fast        iid per minute; large enough to out-vote the book's own lean,
                which is what actually flips the slope
    clamped     a lean is a share of flow; it cannot run away
*/
const MOOD_PHI = 0.965;
const MOOD_STEP = 0.3;
const MOOD_FAST = 2;
/** The mood's pull in LEAN units (lean spans -1 at the bid to +1 at the ask). */
const MOOD_LEAN = 0.5;

interface DayTables {
  /** The day's mood, one value per minute, detrended — the common tide every
      clip's side is drawn against. */
  mood: number[];
}

let tabDay = '';
let tabs: DayTables | null = null;

function dayTables(day: string): DayTables {
  if (tabDay === day && tabs) return tabs;
  // The day's mood, one value per minute, mean-reverting so it swings without
  // wandering off. Common to every contract — independent noise cancels across
  // a hundred rows, a shared factor does not. That is the whole mechanism.
  const mood = new Array<number>(MINUTES_PER_DAY);
  let x = 0;
  let sum = 0;
  for (let m = 0; m < MINUTES_PER_DAY; m++) {
    x = x * MOOD_PHI + (h01(`${day}-nfw-${m}`) - 0.5) * 2 * MOOD_STEP;
    const fast = (h01(`${day}-nff-${m}`) - 0.5) * 2 * MOOD_FAST;
    /* SQUASHED, not clipped. A hard clamp on a loud fast term spends most of
       its time pinned at the rail, which turns the chop into a square wave and
       — because the rails are hit unevenly — quietly drags the day's average
       off centre. tanh keeps the signal inside the same bounds while leaving
       every wiggle its relative size. */
    mood[m] = Math.tanh((x + fast) * 0.6);
    sum += mood[m];
  }
  /* DETRENDED, and that is what lets the mood be loud. Left alone, a day that
     happened to draw a bullish walk would add its whole average onto the day's
     net premium — and then a contract the tables call "ASK 61%" could finish
     with net premium pointing the other way. Centred, the mood only ever moves
     the PATH: the day still ends exactly where the book's own lean says it
     ends, so the leader board, the drilldown and this curve keep agreeing while
     the line in between is free to wander. */
  const mean = sum / MINUTES_PER_DAY;
  for (let m = 0; m < MINUTES_PER_DAY; m++) mood[m] -= mean;
  tabs = { mood };
  tabDay = day;
  return tabs;
}

/* ── the clip tables ─────────────────────────────────────────────────────── */

interface Clip {
  /** Minute of day the clip landed */
  m: number;
  /** Its share of the contract's day (window weight × its share of the window) */
  size: number;
  /** +1 bought at the ask, −1 sold on the bid */
  side: 1 | -1;
}
interface ClipTable {
  /** Per window, sorted by minute */
  clips: Clip[][];
  /** Weight landed BEFORE window i */
  wPre: number[];
  /** Signed weight landed BEFORE window i */
  sPre: number[];
}

/** Two to four clips per contract per window. Never one: the book's burst
    windows (one quarter-hour carrying most of a name's day) would otherwise
    land as a single minute, and a burst is a sweep over minutes, not a bang. */
const CLIPS_MIN = 2;
const CLIPS_MAX = 4;
/** The tail on clip sizes. Measured, not guessed: at 0.8 with a 0.02 floor one
    clip could be 92% of a name's whole range and one minute 300× the median
    volume — a needle, not a tape. 0.5 over a 0.08 floor keeps a clip to at
    most ~55% of its window; the burst windows supply the rest of the drama. */
const CLIP_TAIL = 0.5;
const CLIP_FLOOR = 0.08;

const clipCache = new Map<string, ClipTable>();
let clipCacheDay = '';

function clipTable(day: string, r: BookContract, mood: number[]): ClipTable {
  if (clipCacheDay !== day) {
    clipCache.clear();
    clipCacheDay = day;
  }
  const hit = clipCache.get(r.key);
  if (hit) return hit;

  const w = windowWeights(day, r.key);
  const dir: 1 | -1 = r.right === 'C' ? 1 : -1;
  const clips: Clip[][] = [];
  const wPre = [0];
  const sPre = [0];
  for (let i = 0; i < WINDOWS_PER_DAY; i++) {
    const n = CLIPS_MIN + Math.floor(h01(`${day}-npn-${r.key}-${i}`) * (CLIPS_MAX - CLIPS_MIN + 1));
    const raw: number[] = [];
    let sum = 0;
    for (let j = 0; j < n; j++) {
      const x = Math.pow(h01(`${day}-nps-${r.key}-${i}-${j}`) + CLIP_FLOOR, -CLIP_TAIL);
      raw.push(x);
      sum += x;
    }
    const win: Clip[] = [];
    let sw = 0;
    for (let j = 0; j < n; j++) {
      const m = i * WINDOW_MIN + Math.floor(h01(`${day}-npm-${r.key}-${i}-${j}`) * WINDOW_MIN);
      /* The side is DRAWN, not averaged: the contract's own ask share, pushed
         by the mood at that minute — a bullish stretch lifts call buying and
         leans put flow to the bid. Clamped so no contract is ever one-way. */
      const pBuy = Math.max(0.08, Math.min(0.92, r.askPct / 100 + MOOD_LEAN * dir * mood[m]));
      const side: 1 | -1 = h01(`${day}-npb-${r.key}-${i}-${j}`) < pBuy ? 1 : -1;
      const size = (w[i] * raw[j]) / sum;
      win.push({ m, size, side });
      sw += side * size;
    }
    win.sort((a, b) => a.m - b.m);
    clips.push(win);
    wPre.push(wPre[i] + w[i]);
    sPre.push(sPre[i] + sw);
  }
  const t = { clips, wPre, sPre };
  clipCache.set(r.key, t);
  return t;
}

/** Weight and signed weight landed by minute m — window prefix plus that
    window's own clips up to the minute. Written to the two scratch slots below
    rather than returned as a tuple: this runs ~200k times per view. */
let landedW = 0;
let landedS = 0;
function landedAt(t: ClipTable, m: number): void {
  const i = Math.min(Math.floor(m / WINDOW_MIN), WINDOWS_PER_DAY - 1);
  let w = t.wPre[i];
  let s = t.sPre[i];
  const win = t.clips[i];
  for (let j = 0; j < win.length; j++) {
    const c = win[j];
    if (c.m > m) break;
    w += c.size;
    s += c.side * c.size;
  }
  landedW = w;
  landedS = s;
}

export function buildNetFlowView(
  rows: BookContract[],
  seg: NetFlowSegment,
  mny: MoneynessKey,
  times: number[],
  dteMax = 1,
  ticker: string | null = null,
  tenor: SleeveKey | 'all' = 'all'
): NetFlowView {
  const day = dayKey();
  /* THE TAPE IS THE CLOCK (Noah, 2026-08-30: the 0DTE panes "look horrid
     and unfinished" — every line went dead flat after ~18:00 while the
     candles ran on to 22:35). The simulator's bar time advances ~15× wall
     speed, but this view was accruing on the WALL clock and clamping every
     minute past wall-now flat — so the longer the app stayed open, the
     longer the dead tail; his screenshot had four and a half hours of it.
     A view drawn ON a tape must live at that tape's own now: the minute of
     the LAST bar it was handed. The wall clock survives only as the
     empty-timeline fallback, and the leaders board samples at this same
     instant, so the board and the chart still cannot disagree. */
  const lastT = times.length ? times[times.length - 1] : Math.floor(now().getTime() / 1000);
  const dLast = new Date(lastT * 1000);
  const nowMin = dLast.getHours() * 60 + dLast.getMinutes();

  const cut = rows.filter(
    r =>
      r.dte <= dteMax &&
      (ticker ? r.ticker === ticker : segmentFilter(r, seg)) &&
      moneynessFilter(r, mny) &&
      (tenor === 'all' || sleeveForDte(r.dte) === tenor)
  );

  /* Per row: its day-stable clip table, and how much of it has landed by the
     tape's now. That landed weight is the denominator that pins the curve's
     END to the book's own totals — the header cards read exactly those. */
  const T = dayTables(day);
  const pre = cut.map(r => {
    const t = clipTable(day, r, T.mood);
    landedAt(t, nowMin);
    return { r, t, landed: landedW, isCall: r.right === 'C' };
  });

  const points: NetFlowPoint[] = [];
  let prevCall = 0;
  let prevPut = 0;
  let prevVol = 0;
  for (const t of times) {
    const d = new Date(t * 1000);
    const m = Math.min(nowMin, d.getHours() * 60 + d.getMinutes());
    let callPrem = 0;
    let putPrem = 0;
    let vol = 0;
    for (let k = 0; k < pre.length; k++) {
      const p = pre[k];
      if (p.landed <= 0) continue;
      landedAt(p.t, m);
      // Bought clips push the line up, sold clips pull it back — the walk.
      const signed = (landedS / p.landed) * p.r.premium;
      if (p.isCall) callPrem += signed;
      else putPrem += signed;
      vol += (landedW / p.landed) * p.r.volume;
    }
    // The first bar is an OPENING BALANCE, not a bar — everything before the
    // chart's left edge. Charting it would dwarf every real bar to nothing.
    const barVol = points.length === 0 ? 0 : Math.max(0, Math.round(vol - prevVol));
    points.push({
      time: t,
      callPrem: Math.round(callPrem),
      putPrem: Math.round(putPrem),
      vol: barVol,
      volUp: callPrem - prevCall - (putPrem - prevPut) >= 0,
    });
    prevCall = callPrem;
    prevPut = putPrem;
    prevVol = vol;
  }

  const last = points[points.length - 1];
  return {
    points,
    ncp: last?.callPrem ?? 0,
    npp: last?.putPrem ?? 0,
    vol: Math.round(points.reduce((a, p) => a + p.vol, 0)),
    count: cut.length,
  };
}

// ---- the net-flow board -----------------------------------------------------

/* Every name ranked by which way its money leans TODAY. Each leader's number
   comes out of buildNetFlowView ITSELF (sampled at this instant), so the
   board and the chart it opens can never quote two different leans. */

export interface NetLeader {
  ticker: string;
  sector: string | null;
  sectorColor: string | null;
  /** Bullish lean, signed dollars: net calls minus net puts */
  net: number;
  netCall: number;
  netPut: number;
  /** The name's whole day volume — the book's own fact */
  volume: number;
  /** Contracts in the name's book */
  count: number;
}

let leadersCache: { key: string; leaders: NetLeader[] } | null = null;

/** `sampleTime` = the chart tape's LAST bar (epoch seconds) — pass the same
    timeline end the pane beside the board draws with, so both read the same
    instant of the same curve. Falls back to the wall clock only when no tape
    is on screen to borrow a clock from. */
export function buildNetLeaders(rows: BookContract[], sampleTime?: number, scope = ''): NetLeader[] {
  const day = dayKey();
  const nowSec = sampleTime ?? Math.floor(now().getTime() / 1000);
  const d0 = new Date(nowSec * 1000);
  const nowMin = d0.getHours() * 60 + d0.getMinutes();
  /* `scope` names the cut the rows came through (an expiry, 2026-09-12) — the
     same minute on a different cut is a different board */
  const cacheKey = `${day}-${nowMin}-${scope}-${rows.length}`;
  if (leadersCache?.key === cacheKey) return leadersCache.leaders;

  const byTicker = new Map<string, BookContract[]>();
  for (const r of rows) {
    const arr = byTicker.get(r.ticker);
    if (arr) arr.push(r);
    else byTicker.set(r.ticker, [r]);
  }

  const leaders: NetLeader[] = [...byTicker.entries()].map(([t, own]) => {
    const v = buildNetFlowView(rows, 'all', 'all', [nowSec], Infinity, t);
    return {
      ticker: t,
      sector: own[0].sector,
      sectorColor: own[0].sectorColor,
      net: v.ncp - v.npp,
      netCall: v.ncp,
      netPut: v.npp,
      volume: own.reduce((a, r) => a + r.volume, 0),
      count: own.length,
    };
  });

  leaders.sort((a, b) => b.net - a.net);
  leadersCache = { key: cacheKey, leaders };
  return leaders;
}

// ---- multi-leg structures ---------------------------------------------------

/* The tape reconstructed into STRUCTURES — spreads, not single prints. Each
   trade is a package: legs built on the strike grid, priced with the same
   fill model as everything else, with the package's own defined-risk math
   (max loss / max profit) and a plain-English line saying what the shape
   DOES. Dripped through the session like the wire and the alerts. */

export type SpreadKind = 'vertical' | 'condor' | 'butterfly' | 'straddle' | 'strangle' | 'calendar' | 'ratio';

export interface SpreadKindDef {
  key: SpreadKind;
  label: string;
  /** What the shape does, in plain English — information, never advice */
  read: string;
}

export const SPREAD_KINDS: SpreadKindDef[] = [
  { key: 'vertical', label: 'Vertical', read: 'One strike bought, the next sold — a lane between them, risk capped both ways.' },
  { key: 'condor', label: 'Iron condor', read: 'Both sides sold, wings bought for cover — collects if the name goes nowhere.' },
  { key: 'butterfly', label: 'Butterfly', read: 'Wings bought, the body sold twice — pays most if it pins the middle strike.' },
  { key: 'straddle', label: 'Straddle', read: 'Call and put at the same strike — a position on movement itself, either direction.' },
  { key: 'strangle', label: 'Strangle', read: 'Call above, put below — movement either way, cheaper than the straddle.' },
  { key: 'calendar', label: 'Calendar', read: 'Same strike on two clocks — the near expiry sold, the far one bought.' },
  { key: 'ratio', label: 'Ratio', read: 'Unbalanced legs — extra contracts written on one side, risk open past the far strike.' },
];

export interface SpreadLeg {
  side: 'BUY' | 'SELL';
  ratio: number;
  strike: number;
  right: 'C' | 'P';
  /** MM/DD/YYYY */
  expiry: string;
  dte: number;
  fill: number;
}

export interface SpreadTrade {
  id: string;
  minute: number;
  time: string;
  ticker: string;
  kind: SpreadKind;
  /** "480 / 490" — the structure's strikes, sorted */
  strikesLabel: string;
  /** Near leg's expiry & DTE */
  expiry: string;
  dte: number;
  size: number;
  /** Per-structure price: positive = debit paid, negative = credit collected */
  net: number;
  /** |net| × size × 100, dollars */
  premium: number;
  maxLoss: number | 'uncapped';
  maxProfit: number | 'uncapped' | null;
  iv: number;
  delta: number;
  theta: number;
  spot: number;
  legs: SpreadLeg[];
}

const SPREAD_DTE_POOL = [0, 1, 2, 5, 9, 16, 30, 44, 72, 102] as const;

/** The tape's fill model — the one price shape every flow surface shares. */
function legFill(spot: number, strike: number, right: 'C' | 'P', dte: number, ivFrac: number): number {
  const money = (strike - spot) / spot;
  const intrinsic = right === 'C' ? Math.max(spot - strike, 0) : Math.max(strike - spot, 0);
  const timeValue = spot * ivFrac * 0.08 * Math.exp(-Math.pow(money * 18, 2) / 2) * (0.5 + Math.sqrt((dte + 1) / 30));
  return Number(Math.max(0.05, intrinsic * 0.98 + timeValue).toFixed(2));
}

const SPREADS_PER_DAY = 90;
let spreadCache: { key: string; trades: SpreadTrade[] } | null = null;

/** Every multi-leg structure that has landed so far today, newest first. */
export function buildSpreadFlow(quotes: UniverseQuote[]): SpreadTrade[] {
  const day = dayKey();
  const t0 = now();
  const nowMin = t0.getHours() * 60 + t0.getMinutes();
  const cacheKey = `${day}-${nowMin}`;
  if (spreadCache?.key === cacheKey) return spreadCache.trades;

  const trades: SpreadTrade[] = [];
  for (let i = 0; i < SPREADS_PER_DAY; i++) {
    const seed = `${day}-ml-${i}`;
    const h = (tag: string) => h01(`${seed}-${tag}`);
    const minute = 15 + Math.floor(h('t') * 1395);
    if (minute > nowMin) continue; // the drip

    // Index names lead multi-leg tape share — the universe's front is heavier.
    const q = quotes[Math.floor(Math.pow(h('tk'), 1.5) * quotes.length)];
    const spot = q.price;
    const st = q.step;
    const ivFrac = q.iv * (0.85 + h('iv') * 0.4);
    const atm = Math.round(spot / st) * st;
    const w = st * (1 + Math.floor(h('w') * 3));
    const dte = SPREAD_DTE_POOL[Math.floor(Math.pow(h('dte'), 1.4) * SPREAD_DTE_POOL.length)];
    const kindRoll = h('kind');
    const kind: SpreadKind =
      kindRoll < 0.4
        ? 'vertical'
        : kindRoll < 0.55
          ? 'condor'
          : kindRoll < 0.65
            ? 'butterfly'
            : kindRoll < 0.75
              ? 'straddle'
              : kindRoll < 0.85
                ? 'strangle'
                : kindRoll < 0.93
                  ? 'calendar'
                  : 'ratio';

    const exp = expiryLabel(dte);
    const mk = (side: 'BUY' | 'SELL', ratio: number, strike: number, right: 'C' | 'P', legDte: number = dte): SpreadLeg => ({
      side,
      ratio,
      strike: Number(strike.toFixed(2)),
      right,
      expiry: expiryLabel(legDte),
      dte: legDte,
      fill: legFill(spot, strike, right, legDte, ivFrac),
    });

    let legs: SpreadLeg[];
    let maxLossOf: (net: number, size: number) => number | 'uncapped';
    let maxProfitOf: (net: number, size: number) => number | 'uncapped' | null;
    const width = w;
    switch (kind) {
      case 'vertical': {
        const right: 'C' | 'P' = h('r') < 0.55 ? 'C' : 'P';
        const k1 = atm;
        const k2 = right === 'C' ? atm + width : atm - width;
        const debit = h('dc') < 0.7;
        legs = [mk(debit ? 'BUY' : 'SELL', 1, k1, right), mk(debit ? 'SELL' : 'BUY', 1, k2, right)];
        maxLossOf = (net, size) => (net > 0 ? net * 100 * size : Math.max(0, (width - Math.abs(net)) * 100 * size));
        maxProfitOf = (net, size) => (net > 0 ? Math.max(0, (width - net) * 100 * size) : Math.abs(net) * 100 * size);
        break;
      }
      case 'condor': {
        const kc = atm + width;
        const kp = atm - width;
        legs = [mk('SELL', 1, kp, 'P'), mk('BUY', 1, kp - width, 'P'), mk('SELL', 1, kc, 'C'), mk('BUY', 1, kc + width, 'C')];
        maxLossOf = (net, size) => Math.max(0, (width - Math.abs(net)) * 100 * size);
        maxProfitOf = (net, size) => Math.abs(net) * 100 * size;
        break;
      }
      case 'butterfly': {
        const right: 'C' | 'P' = h('r') < 0.6 ? 'C' : 'P';
        legs = [mk('BUY', 1, atm - width, right), mk('SELL', 2, atm, right), mk('BUY', 1, atm + width, right)];
        maxLossOf = (net, size) => Math.abs(net) * 100 * size;
        maxProfitOf = (net, size) => Math.max(0, (width - Math.abs(net)) * 100 * size);
        break;
      }
      case 'straddle': {
        const long = h('ls') < 0.65;
        legs = [mk(long ? 'BUY' : 'SELL', 1, atm, 'C'), mk(long ? 'BUY' : 'SELL', 1, atm, 'P')];
        maxLossOf = (net, size) => (net > 0 ? net * 100 * size : 'uncapped');
        maxProfitOf = (net, size) => (net > 0 ? 'uncapped' : Math.abs(net) * 100 * size);
        break;
      }
      case 'strangle': {
        const long = h('ls') < 0.65;
        legs = [mk(long ? 'BUY' : 'SELL', 1, atm + width, 'C'), mk(long ? 'BUY' : 'SELL', 1, atm - width, 'P')];
        maxLossOf = (net, size) => (net > 0 ? net * 100 * size : 'uncapped');
        maxProfitOf = (net, size) => (net > 0 ? 'uncapped' : Math.abs(net) * 100 * size);
        break;
      }
      case 'calendar': {
        const right: 'C' | 'P' = h('r') < 0.6 ? 'C' : 'P';
        const far = dte + [16, 30, 44][Math.floor(h('far') * 3)];
        legs = [mk('SELL', 1, atm, right, dte), mk('BUY', 1, atm, right, far)];
        maxLossOf = (net, size) => Math.abs(net) * 100 * size;
        maxProfitOf = () => null; // depends where the near clock leaves it
        break;
      }
      case 'ratio': {
        const right: 'C' | 'P' = h('r') < 0.6 ? 'C' : 'P';
        const k2 = right === 'C' ? atm + width : atm - width;
        legs = [mk('BUY', 1, atm, right), mk('SELL', 2, k2, right)];
        maxLossOf = () => 'uncapped';
        maxProfitOf = (net, size) => Math.max(0.05, (width - net) * 100 * size);
        break;
      }
    }

    let net = 0;
    for (const l of legs) net += (l.side === 'BUY' ? 1 : -1) * l.fill * l.ratio;
    net = Number((Math.abs(net) < 0.05 ? 0.05 * Math.sign(net || 1) : net).toFixed(2));
    const size = Math.round(5 + Math.pow(h('sz'), 2.5) * 1500);
    const strikes = [...new Set(legs.map(l => l.strike))].sort((a, b) => a - b);

    // Package greeks: directional shapes carry delta, premium-sellers carry
    // positive theta — plausible placeholder physics, one convention.
    const dir = legs[0].right === 'C' ? 1 : -1;
    const delta =
      kind === 'vertical' || kind === 'ratio'
        ? Number((dir * Math.sign(net) * (0.12 + h('dl') * 0.35)).toFixed(2))
        : Number(((h('dl') - 0.5) * 0.2).toFixed(2));
    const theta = Number(((net > 0 ? -1 : 1) * (0.01 + h('th') * 0.05) * Math.max(1, Math.abs(net))).toFixed(2));

    trades.push({
      id: seed,
      minute,
      time: `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`,
      ticker: q.ticker,
      kind,
      strikesLabel: strikes.join(' / '),
      expiry: exp,
      dte,
      size,
      net,
      premium: Math.round(Math.abs(net) * size * 100),
      maxLoss: maxLossOf(net, size),
      maxProfit: maxProfitOf(net, size),
      iv: Number((ivFrac * 100).toFixed(1)),
      delta,
      theta,
      spot: Number(spot.toFixed(2)),
      legs,
    });
  }

  trades.sort((a, b) => b.minute - a.minute);
  spreadCache = { key: cacheKey, trades };
  return trades;
}

/**
 * One leg of a structure, spoken as a day-book row (Noah, 2026-08-30: "the
 * multi leg tape doesnt follow the same rule as the others with the highlighted
 * blue for the cons and takes them to the tape con page").
 *
 * The multi-leg page's own fact is the STRUCTURE, so a row click still opens
 * the structure card. But a strike inside it is a contract like any other, and
 * on every other flow surface a contract is a blue-underlined door to the tape.
 * Turning the leg into a `BookContract` is what lets it walk through that same
 * door — `BookDrill` then mounts the identical card, with ↑/↓ stepping between
 * the structure's own legs.
 *
 * The leg carries the facts that matter (strike, right, expiry, fill, side);
 * the rest of a book row is dressed here, deterministically per structure and
 * leg, in the same idiom the book itself uses. `multiPct` is pinned high on
 * purpose: this contract IS one leg of a spread, and the card should say so.
 */
export function spreadLegRow(trade: SpreadTrade, i: number): BookContract {
  const l = trade.legs[i];
  const seed = `${trade.id}-leg${i}`;
  const h = (tag: string) => h01(`${seed}-${tag}`);
  const volume = Math.max(1, Math.round(trade.size * l.ratio * hRange(`${seed}-v`, 1.05, 2.6)));
  const prevOI = Math.max(25, Math.round(volume * hRange(`${seed}-poi`, 0.6, 4)));
  const deltaOI = Math.round(volume * hRange(`${seed}-doi`, 0.1, 0.7));
  const oi = Math.max(25, prevOI + deltaOI);
  const prevVolume = Math.round(volume * hRange(`${seed}-pv`, 0.4, 1.6));
  const prevAvgFill = Number(Math.max(0.05, l.fill * hRange(`${seed}-pf`, 0.75, 1.25)).toFixed(2));
  return {
    // Unique per (structure, leg): a calendar has two legs on ONE strike, so a
    // strike-based key would collide and the stepper would loop on itself.
    key: `${trade.id}-l${i}`,
    ticker: trade.ticker,
    sector: sectorOf(trade.ticker)?.sector ?? null,
    sectorColor: sectorOf(trade.ticker)?.color ?? null,
    strike: l.strike,
    right: l.right,
    expiry: l.expiry,
    dte: l.dte,
    spot: trade.spot,
    otmPct: Number((((l.strike - trade.spot) / trade.spot) * 100).toFixed(1)),
    last: l.fill,
    chgPct: Number(((h('chg') - 0.45) * 40).toFixed(1)),
    lastAt: trade.time,
    lastAtMin: trade.minute,
    volume,
    oi,
    deltaOI,
    deltaOIPct: Number(((deltaOI / Math.max(prevOI, 1)) * 100).toFixed(1)),
    premium: Math.round(volume * l.fill * 100),
    iv: trade.iv,
    ivChg: Number(((h('ivc') - 0.5) * 6).toFixed(1)),
    volOverOI: Number((volume / Math.max(oi, 1)).toFixed(2)),
    sweepPct: Math.round(hRange(`${seed}-sw`, 0, 45)),
    // It is a spread leg. That is the one thing we know for certain about it.
    multiPct: Math.round(hRange(`${seed}-ml`, 82, 100)),
    floorPct: Math.round(hRange(`${seed}-fl`, 0, 40)),
    // Bought legs lift the offer, sold legs hit the bid — the leg's own side.
    askPct: l.side === 'BUY' ? Math.round(hRange(`${seed}-ap`, 58, 92)) : Math.round(hRange(`${seed}-ap`, 8, 42)),
    prevOI,
    prevVolume,
    prevAvgFill,
    prevPremium: Math.round(prevVolume * prevAvgFill * 100),
    prevAskPct: Math.round(hRange(`${seed}-pap`, 20, 80)),
    oiStreak: Math.floor(h('ois') * 4),
    volGtOiStreak: Math.floor(h('vgs') * 3),
    earnDays: null,
    prevSpark: Array.from({ length: 26 }, (_, k) => h01(`${seed}-sp${k}`)),
  };
}

// ---- reader filters ---------------------------------------------------------

export interface BookFilters {
  side: 'ALL' | 'C' | 'P';
  /** Empty = every tenor */
  tenors: SleeveKey[];
  minVolume: number;
  /** Dollars */
  minPremium: number;
  excludeItm: boolean;
}

export const DEFAULT_FILTERS: BookFilters = {
  side: 'ALL',
  tenors: [],
  minVolume: 0,
  minPremium: 0,
  excludeItm: false,
};

export function applyFilters(rows: BookContract[], f: BookFilters): BookContract[] {
  return rows.filter(r => {
    if (f.side !== 'ALL' && r.right !== f.side) return false;
    if (f.tenors.length > 0 && !f.tenors.includes(sleeveForDte(r.dte))) return false;
    if (r.volume < f.minVolume) return false;
    if (r.premium < f.minPremium) return false;
    if (f.excludeItm) {
      const itm = r.right === 'C' ? r.otmPct < 0 : r.otmPct > 0;
      if (itm) return false;
    }
    return true;
  });
}
