/*
==================================================
  SLAYER TERMINAL - THE BACKTEST'S REAL DAYS
  (data/feed/backtest.ts)

  The Backtest replays a REAL past session (2026-10-12)
  from the market's own record — Theta Data's since
  2026-10-14 (Massive's before; the owner: "you can
  disable the massive ones and use this one") — never a
  vendor figure beside the house's tape
  (data/review/market.ts: one market a session, start to
  end). The Theta Terminal on this machine answers a few
  calls at once (the proxy queues the rest), so a day
  comes in FEW calls, each kept for the visit:

    the picker      a name's sessions, two years of day
                    bars — two calls a name (a year a call)
    a session       each name's minutes for every day it
                    holds (and two before, for the chart),
                    09:30 to 16:00 — one call a name (a
                    month at most); the contracts that
                    quoted on its first day — one call a
                    name, the expiries and every expiry's
                    strikes read off it
    a contract      its own minutes for every day the
                    session holds, folded by the proxy from
                    the contract's own trades (the minute's
                    own volume-weighted average) — a call a
                    day, asked when the reader opens it
                    (and, as a session opens, for every
                    contract its book holds or works)

  A 429 is waited out (the step says so) and asked
  again; anything else fails the step, in words, with a
  door to ask again. Nothing here reads a key: the proxy
  holds it (server/feed.ts).
==================================================
*/

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { Candle } from '../../types/market';
import type { FeedFail, FeedResult } from './client';
import { occTicker } from './massive';
import { thetaContractMinutes, thetaContractsOn, thetaStockDays, thetaStockMinutes, type ThetaBar } from './theta';
import { useRoomSource } from './rooms';
import { useFeedStatus, type ProviderState } from './status';
import { isoDate, today } from '../../core/calendar';
import { EARLY_CLOSES } from '../marketState';
import { bookOf, namesOf, type RealBook, type Session } from '../review/engine';
import { registerMarket, type ReplayMarket } from '../review/market';
import { buildRealMarket, type PrintBar, type RealRecord } from '../review/realTape';
import { DAY_MIN, barTime, dayWords, reviewName } from '../review/tape';
import { longLeg, type ContractId } from '../review/quotes';

/** How far back the record goes on these plans (day bars answered from two years back, 2026-10-12) */
const BACK_DAYS = 730;
/** The sessions a real session holds: the day picked and the ones after it — one call a name, whatever the count */
export const REAL_DAYS = 10;
/** Sessions before the first, for the chart */
const BEFORE = 2;
/** A 429 is waited out this long, this many times */
const RATE_WAIT_MS = 15_000;
const RATE_TRIES = 4;

/* ---- the slots: one a call, kept for the visit ---- */
export type SlotState = 'asking' | 'waiting' | 'done' | 'failed';
interface Slot<T = unknown> {
  state: SlotState;
  /** What it is, in the house's words ("SPY's minutes, Sep 14 to Sep 25") */
  words: string;
  data?: T;
  reason?: FeedFail;
}
const slots = new Map<string, Slot>();
let version = 0;
const fns = new Set<() => void>();
const bump = () => {
  version++;
  for (const f of Array.from(fns)) f();
};
const subscribe = (fn: () => void) => {
  fns.add(fn);
  return () => fns.delete(fn);
};
/** Renders when anything the record holds changes */
export const useRealRecordVersion = (): number => useSyncExternalStore(subscribe, () => version, () => version);

const wait = (ms: number) => new Promise(res => setTimeout(res, ms));
/** Ask once — a slot already asked is left be, a failed one too, until the reader asks again (`forgetFailed`) */
function ask<T>(key: string, words: string, run: () => Promise<FeedResult<T>>): void {
  if (slots.has(key)) return;
  const slot: Slot<T> = { state: 'asking', words };
  slots.set(key, slot as Slot);
  bump();
  void (async () => {
    for (let n = 0; ; n++) {
      const r = await run();
      if (r.ok) {
        slots.set(key, { state: 'done', words, data: r.data });
        break;
      }
      if (r.reason === 'rate' && n < RATE_TRIES) {
        slots.set(key, { state: 'waiting', words, reason: 'rate' });
        bump();
        await wait(RATE_WAIT_MS);
        slots.set(key, { state: 'asking', words });
        bump();
        continue;
      }
      slots.set(key, { state: 'failed', words, reason: r.reason });
      break;
    }
    bump();
  })();
}
/** The reader asked again: every call that failed is forgotten, so the next pass asks it afresh */
export function forgetFailed(): void {
  for (const [k, v] of slots) if (v.state === 'failed') slots.delete(k);
  bump();
}
const dataOf = <T>(key: string): T | undefined => (slots.get(key)?.state === 'done' ? (slots.get(key)!.data as T) : undefined);
export const slotOf = (key: string): Slot | undefined => slots.get(key);

/* ---- New York's day of an instant ---- */
let nyDay: Intl.DateTimeFormat | null = null;
const nyIso = (ms: number): string => {
  nyDay ??= new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
  return nyDay.format(new Date(ms));
};
const isoBack = (days: number): string => {
  const d = new Date(today());
  d.setDate(d.getDate() - days);
  return isoDate(d);
};

/* ---- 1. A NAME'S SESSIONS: two years of day bars, one call ---- */
export interface DayRecord {
  /** Every session on the record before today, oldest first */
  days: string[];
  closes: number[];
  opens: number[];
}
const daysKey = (t: string) => `days|${t}`;
export function askDays(ticker: string): void {
  const t = ticker.toUpperCase();
  ask<DayRecord>(daysKey(t), `${t}’s sessions, the last two years`, async () => {
    const r = await thetaStockDays(t, isoBack(BACK_DAYS), isoBack(1));
    if (!r.ok) return r;
    const now = isoDate(today());
    const rows = r.data.map(b => ({ iso: nyIso(b.t), b })).filter(x => x.iso < now);
    return { ok: true, at: r.at, data: { days: rows.map(x => x.iso), closes: rows.map(x => x.b.c), opens: rows.map(x => x.b.o) } };
  });
}
export const dayRecordOf = (ticker: string): DayRecord | undefined => dataOf<DayRecord>(daysKey(ticker.toUpperCase()));

/** The days a session on these names can start on: on every name's record, never a half session */
export function realDaysOf(tickers: string[]): string[] | undefined {
  const recs = tickers.map(dayRecordOf);
  if (recs.some(r => !r)) return undefined;
  const [first, ...rest] = recs as DayRecord[];
  const sets = rest.map(r => new Set(r.days));
  return first.days.filter(d => !EARLY_CLOSES.has(d) && sets.every(s => s.has(d)));
}

/** The vol of the twenty sessions before a day — what an estimate is priced on before a contract trades */
function pastVol(rec: DayRecord | undefined, day: string, ticker: string): number {
  if (!rec) return reviewName(ticker).iv;
  const i = rec.days.indexOf(day);
  const closes = rec.closes.slice(Math.max(0, i - 21), Math.max(0, i));
  const rets: number[] = [];
  for (let k = 1; k < closes.length; k++) rets.push(Math.log(closes[k] / closes[k - 1]));
  if (rets.length < 5) return reviewName(ticker).iv;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const sd = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1));
  return Math.min(1.5, Math.max(0.08, sd * Math.sqrt(252)));
}

/** WHAT A SESSION FROM THIS DAY HOLDS: the day and the sessions on the record after it (to REAL_DAYS, stopping short of a
    half session), two before it for the chart, and each name's past vol */
export function realBookFor(tickers: string[], day: string): RealBook | null {
  const all = realDaysOf(tickers);
  const rec = dayRecordOf(tickers[0]);
  if (!all || !rec) return null;
  const i = all.indexOf(day);
  if (i < 0) return null;
  const days: string[] = [];
  /* every session after it on the record — a half session ends the run (the desk's day runs to the 16:00 bell) */
  for (let k = rec.days.indexOf(day); k >= 0 && k < rec.days.length && days.length < REAL_DAYS; k++) {
    if (EARLY_CLOSES.has(rec.days[k]) || !all.includes(rec.days[k])) break;
    days.push(rec.days[k]);
  }
  const at = rec.days.indexOf(day);
  const before = rec.days.slice(Math.max(0, at - BEFORE), at);
  return { days, before, vol: Object.fromEntries(tickers.map(t => [t, pastVol(dayRecordOf(t), day, t)])) };
}

/* ---- 2. A NAME'S MINUTES: every day the session holds, one call ---- */
interface Minutes {
  /** 390 a day, 09:30 to 16:00 — a minute with no trade stands where the last one closed */
  byDay: Map<string, Candle[]>;
  /** Days the record stops short on (a half session) or holds nothing for */
  short: Set<string>;
}
const minutesKey = (t: string, from: string, to: string) => `min|${t}|${from}|${to}`;
/** The record's bars onto the desk's minutes: 09:30 New York is minute 0, the bell's bar 389 */
function toMinutes(bars: ThetaBar[], days: string[]): Minutes {
  const byDay = new Map<string, Candle[]>();
  const short = new Set<string>();
  for (const iso of days) {
    const open = barTime(iso, 0) * 1000;
    const end = open + DAY_MIN * 60_000;
    const mine = bars.filter(b => b.t >= open && b.t < end);
    if (!mine.length) {
      short.add(iso);
      continue;
    }
    const out: Candle[] = new Array(DAY_MIN);
    let last = mine[0].o;
    let j = 0;
    let lastIdx = -1;
    for (let k = 0; k < DAY_MIN; k++) {
      const t = open + k * 60_000;
      while (j < mine.length && mine[j].t < t) j++;
      const b = mine[j] && mine[j].t === t ? mine[j] : null;
      if (b) {
        out[k] = { time: t / 1000, open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v };
        last = b.c;
        lastIdx = k;
      } else out[k] = { time: t / 1000, open: last, high: last, low: last, close: last, volume: 0 };
    }
    /* the record stopped well before the bell: a half session */
    if (lastIdx < DAY_MIN - 30) short.add(iso);
    byDay.set(iso, out);
  }
  return { byDay, short };
}
function askMinutes(ticker: string, book: RealBook): void {
  const days = [...book.before, ...book.days];
  const from = days[0];
  const to = days[days.length - 1];
  ask<Minutes>(minutesKey(ticker, from, to), `${ticker}’s minutes, ${dayWords(book.days[0])} to ${dayWords(book.days[book.days.length - 1])}`, async () => {
    const r = await thetaStockMinutes(ticker, from, to, { regular: true });
    return r.ok ? { ok: true, at: r.at, data: toMinutes(r.data, days) } : r;
  });
}
const minutesOf = (ticker: string, book: RealBook): Minutes | undefined => {
  const days = [...book.before, ...book.days];
  return dataOf<Minutes>(minutesKey(ticker, days[0], days[days.length - 1]));
};

/* ---- 3. THE CONTRACTS ON THE FIRST DAY: one call a name — the contracts that quoted that day (Theta Data has no
   listing "as of" a date; a listed contract quotes), the expiries and every expiry's strikes read off it ---- */
const expiriesKey = (t: string, asOf: string) => `exp|${t}|${asOf}`;
function askExpiries(ticker: string, asOf: string, _near: number): void {
  ask<string[]>(expiriesKey(ticker, asOf), `${ticker}’s expiries, as listed on ${dayWords(asOf)}`, async () => {
    const r = await thetaContractsOn(ticker, asOf);
    return r.ok ? { ok: true, at: r.at, data: Array.from(new Set(r.data.filter(c => c.symbol === ticker).map(c => c.expiration))).filter(e => e >= asOf).sort() } : r;
  });
}

/* ---- 4. THE STRIKES LISTED FOR AN EXPIRY: off the same day's contracts, when the chain shows it ---- */
const strikesKey = (t: string, expiry: string, asOf: string) => `k|${t}|${expiry}|${asOf}`;
export function askStrikes(ticker: string, expiry: string, asOf: string): void {
  ask<number[]>(strikesKey(ticker, expiry, asOf), `${ticker}’s strikes for ${dayWords(expiry)}`, async () => {
    const r = await thetaContractsOn(ticker, asOf);
    return r.ok ? { ok: true, at: r.at, data: Array.from(new Set(r.data.filter(c => c.symbol === ticker && c.expiration === expiry && c.right === 'C').map(c => c.strike))).sort((a, b) => a - b) } : r;
  });
}
export const strikesState = (ticker: string, expiry: string, asOf: string): Slot | undefined => slots.get(strikesKey(ticker, expiry, asOf));

/* ---- 5. A CONTRACT'S OWN MINUTES: one call, when it is opened ---- */
const printsKey = (c: ContractId, book: RealBook) => `p|${occTicker(c)}|${book.days[0]}|${book.days[book.days.length - 1]}`;
function toPrints(bars: ThetaBar[], days: string[]): Map<string, (PrintBar | null)[]> {
  const out = new Map<string, (PrintBar | null)[]>();
  for (const iso of days) {
    const open = barTime(iso, 0) * 1000;
    const row: (PrintBar | null)[] = new Array(DAY_MIN).fill(null);
    for (const b of bars) {
      const k = Math.round((b.t - open) / 60_000);
      if (k >= 0 && k < DAY_MIN) row[k] = { o: b.o, h: b.h, l: b.l, c: b.c, v: b.v, vw: b.vw ?? null };
    }
    out.set(iso, row);
  }
  return out;
}
/** Ask for a single contract's own minutes (a spread: each of its legs) */
export function askPrints(c: ContractId, book: RealBook): void {
  const legs = c.short != null ? [longLeg(c), { ...longLeg(c), strike: c.short }] : [c];
  for (const leg of legs) {
    const occ = occTicker(leg);
    ask<Map<string, (PrintBar | null)[]>>(printsKey(leg, book), `${leg.ticker} ${leg.strike}${leg.right} ${dayWords(leg.expiry)} — its own trades`, async () => {
      /* a call a day the contract was alive, the days in turn (a day's trades of an at-the-money same-day contract are
         tens of megabytes on the terminal's side; the proxy hands back its minutes) */
      const all: ThetaBar[] = [];
      let at = 0;
      for (const day of book.days.filter(d => d <= leg.expiry)) {
        const r = await thetaContractMinutes({ underlying: leg.ticker, expiry: leg.expiry, strike: leg.strike, right: leg.right }, day);
        if (!r.ok) return r;
        all.push(...r.data);
        at = Math.max(at, r.at);
      }
      void occ;
      return { ok: true, at: at || Date.now(), data: toPrints(all, book.days) };
    });
  }
}
export const printsState = (c: ContractId, book: RealBook): Slot | undefined => slots.get(printsKey(longLeg(c), book));

/* ---- THE RECORD A SESSION READS (realTape.ts) ---- */
/** The days the record really holds: the session's, cut at the first a name's record stops short on */
function heldDays(tickers: string[], book: RealBook): string[] {
  const mins = tickers.map(t => minutesOf(t, book));
  const out: string[] = [];
  for (const d of book.days) {
    if (mins.some(m => !m || m.short.has(d) || !m.byDay.has(d))) break;
    out.push(d);
  }
  return out;
}
function recordOf(s: Session): RealRecord {
  const book = s.real!;
  const names = namesOf(s);
  const days = heldDays(names, book);
  const first = book.days[0];
  return {
    days,
    before: book.before.filter(d => names.every(t => minutesOf(t, book)?.byDay.has(d))),
    bars: (t, iso) => minutesOf(t, book)?.byDay.get(iso),
    vol: t => book.vol[t] ?? reviewName(t).iv,
    expiries: t => dataOf<string[]>(expiriesKey(t, first)),
    strikes: (t, e) => dataOf<number[]>(strikesKey(t, e, first)),
    prints: c => dataOf<Map<string, (PrintBar | null)[]>>(printsKey(c, book)),
  };
}

/* ---- what the desk sees ---- */
export interface RealStep {
  key: string;
  words: string;
  state: SlotState | 'queued';
  reason?: FeedFail;
}
export type RealPhase = 'waiting' | 'off' | 'loading' | 'ready' | 'failed' | 'short';
export interface RealSession {
  phase: RealPhase;
  /** Theta Data's standing, when it is not up */
  standing?: ProviderState;
  steps: RealStep[];
  /** The days the record holds — fewer than asked when a half session cut the run */
  days: string[];
  market: ReplayMarket | null;
  retry: () => void;
}

/** Every contract the book holds or works — what has to be in before the clock may move */
const bookContracts = (s: Session): ContractId[] => {
  const out = new Map<string, ContractId>();
  for (const p of bookOf(s).positions) out.set(occTicker(p.contract) + (p.contract.short ?? ''), p.contract);
  for (const o of s.orders) if (o.status === 'working') out.set(occTicker(o.contract) + (o.contract.short ?? ''), o.contract);
  return [...out.values()];
};
const legKeys = (c: ContractId, book: RealBook) => (c.short != null ? [longLeg(c), { ...longLeg(c), strike: c.short }] : [c]).map(l => printsKey(l, book));

function askAll(s: Session): void {
  const book = s.real;
  if (!book?.days.length) return;
  for (const t of namesOf(s)) askMinutes(t, book);
  for (const t of namesOf(s)) {
    const open = minutesOf(t, book)?.byDay.get(book.days[0])?.[0]?.open;
    if (open) askExpiries(t, book.days[0], open);
  }
  for (const c of bookContracts(s)) askPrints(c, book);
}

const markets = new Map<string, { m: ReplayMarket; days: string }>();
/**
 * A REAL SESSION, AS ITS DESK OPENS IT: asks what it needs (each name's minutes, then its expiries, then every contract the
 * book holds or works), says where each call stands, and — once all of it is in — registers the session's market, so the
 * engine's every price is the record's (data/review/market.ts).
 */
export function useRealSession(s: Session | null): RealSession {
  const v = useRealRecordVersion();
  const source = useRoomSource('backtest');
  const status = useFeedStatus();
  const isReal = s?.src === 'feed' && !!s.real;
  const contractsKey = isReal && s ? bookContracts(s).map(c => occTicker(c) + (c.short ?? '')).join(',') : '';
  /* once Theta Data is up: the minutes first, the expiries once a name's first open is known (one more pass), the book */
  useEffect(() => {
    if (isReal && s && source === 'feed') askAll(s);
  }, [isReal, s?.id, source, contractsKey, v]); // eslint-disable-line react-hooks/exhaustive-deps

  return useMemo<RealSession>(() => {
    const retry = () => {
      forgetFailed();
      if (s && isReal) askAll(s);
    };
    if (!s || !isReal) return { phase: 'ready', steps: [], days: [], market: null, retry };
    const book = s.real!;
    const names = namesOf(s);
    if (source !== 'feed') {
      const standing = status.theta.state;
      return { phase: standing === 'unknown' ? 'waiting' : 'off', standing, steps: [], days: book.days, market: null, retry };
    }
    const keys: string[] = [];
    const days = [...book.before, ...book.days];
    for (const t of names) keys.push(minutesKey(t, days[0], days[days.length - 1]));
    for (const t of names) keys.push(expiriesKey(t, book.days[0]));
    for (const c of bookContracts(s)) keys.push(...legKeys(c, book));
    const steps: RealStep[] = keys.map(k => {
      const sl = slots.get(k);
      return { key: k, words: sl?.words ?? (k.startsWith('exp|') ? `${k.split('|')[1]}’s expiries, as listed on ${dayWords(book.days[0])}` : 'Waiting its turn'), state: sl?.state ?? 'queued', reason: sl?.reason };
    });
    if (steps.some(x => x.state === 'failed')) return { phase: 'failed', steps, days: book.days, market: null, retry };
    if (steps.some(x => x.state !== 'done')) return { phase: 'loading', steps, days: book.days, market: null, retry };
    const held = heldDays(names, book);
    if (!held.length) return { phase: 'short', steps, days: held, market: null, retry };
    /* one market a session, built once its days are known; it reads the slots live, so a contract opened later is in it */
    const sig = held.join(',');
    let hit = markets.get(s.id);
    if (!hit || hit.days !== sig) {
      hit = { m: buildRealMarket(recordOf(s)), days: sig };
      markets.set(s.id, hit);
    }
    registerMarket(s.id, hit.m);
    return { phase: 'ready', steps, days: held, market: hit.m, retry };
  }, [s, isReal, source, status.theta.state, v]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** THE PICKER'S DAYS: each name's sessions on the record, asked once Theta Data is up */
export function useRealDays(tickers: string[], on: boolean): { state: 'off' | 'loading' | 'ready' | 'failed'; days: string[]; reason?: FeedFail; retry: () => void } {
  const v = useRealRecordVersion();
  const key = tickers.join(',');
  useEffect(() => {
    if (on) for (const t of tickers) askDays(t);
  }, [on, key]); // eslint-disable-line react-hooks/exhaustive-deps
  return useMemo(() => {
    const retry = () => {
      forgetFailed();
      tickers.forEach(askDays);
    };
    if (!on) return { state: 'off' as const, days: [], retry };
    const failed = tickers.map(t => slots.get(daysKey(t.toUpperCase()))).find(x => x?.state === 'failed');
    if (failed) return { state: 'failed' as const, days: [], reason: failed.reason, retry };
    const days = realDaysOf(tickers);
    return days ? { state: 'ready' as const, days, retry } : { state: 'loading' as const, days: [], retry };
  }, [on, key, v]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Why a call came back empty-handed, in the house's words */
export const failWords = (reason?: FeedFail | ProviderState): string =>
  reason === 'no-key'
    ? 'Theta Data has no key on this machine (THETADATA_API_KEY in .env)'
    : reason === 'no-terminal'
      ? 'The Theta Terminal is not running on this machine — start it with npm run theta:terminal'
      : reason === 'key-refused'
        ? 'Theta Data refused the key'
        : reason === 'plan'
          ? 'Theta Data’s plan does not reach this'
          : reason === 'rate'
            ? 'The Theta Terminal asked for a slower pace — too many calls at once'
            : reason === 'network'
              ? 'The network refused Theta Data’s host'
              : reason === 'timeout'
                ? 'Theta Data took too long to answer'
                : reason === 'absent'
                  ? 'The terminal’s feed proxy is not running here — it runs with the terminal’s own server'
                  : reason === 'unknown'
                    ? 'Asking where Theta Data stands'
                    : 'Theta Data answered with an error';
