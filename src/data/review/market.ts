/*
==================================================
  SLAYER TERMINAL - REVIEW · WHICH MARKET A SESSION
  REPLAYS (data/review/market.ts)

  A backtest session replays ONE market, start to end
  (2026-10-12, the data feed):

    the house's tape   tape.ts and quotes.ts — the
                       terminal's own year of sessions,
                       the same past for every reader;
                       a session without `src`
    a real day         `src: 'feed'` — the market's own
                       record from Massive: the name's
                       minute bars, the contracts listed
                       that day, each opened contract's
                       own trades (realTape.ts, loaded by
                       data/feed/backtest.ts)

  ALL OR NOTHING: a real session never reads the house's
  tape, and a house session never reads the record. The
  engine asks `marketOf(session)` for every price, so the
  rules (fills, the ladder, the bell, the clock that only
  moves forward) are one set of code on either market.

  A real session whose record has not come in yet (the
  session list, the journal, a page before its load) gets
  a STILL market: its open contracts at the marks last
  seen, nothing that fills. Its trades never need the
  record — they were written down as they closed
  (data/review/realKeep.ts).
==================================================
*/

import type { Candle } from '../../types/market';
import { chainAt, contractDay, expiriesAt, quoteAt, quoteWith, spotForAsk, spotForBid, contractKey, type ChainRow, type ContractDay, type ContractId, type ListedExpiry, type Quote } from './quotes';
import { baseIvAt, dateOf, dayBars, dayIndex, nextDay, prevDay, reviewName, spotAt, tapeDays } from './tape';

export interface ReplayMarket {
  /** 'house': the terminal's own tape · 'feed': the market's own record */
  kind: 'house' | 'feed';
  /** False for a real session's still market: its record is not in, nothing fills */
  ready: boolean;
  /** The sessions the clock can stand on, oldest first */
  days(): string[];
  dayIndex(iso: string): number;
  /** The session after, or before — a real day's market also holds a few sessions before its first, for the chart */
  nextDay(iso: string): string | null;
  prevDay(iso: string): string | null;
  /** A day's 390 minute bars, 09:30 to 16:00 New York */
  dayBars(ticker: string, iso: string): Candle[];
  spotAt(ticker: string, iso: string, minute: number): number;
  /** The name's vol that day — what the tape's cone and an estimate are priced on */
  ivAt(ticker: string, iso: string): number;
  /** The distance between strikes the chain is centred by */
  stepOf(ticker: string): number;
  quoteAt(c: ContractId, iso: string, minute: number): Quote;
  /** The quote with the name somewhere else at that minute (the chart's lines) */
  quoteWith(c: ContractId, iso: string, minute: number, spot: number): Quote;
  spotForBid(c: ContractId, iso: string, minute: number, bid: number): number | null;
  spotForAsk(c: ContractId, iso: string, minute: number, ask: number): number | null;
  expiriesAt(ticker: string, iso: string): ListedExpiry[];
  chainAt(ticker: string, iso: string, minute: number, expiry: string, each?: number, centre?: number): { spot: number; rows: ChainRow[] };
  contractDay(c: ContractId, iso: string, minute: number): ContractDay;
}

/** THE HOUSE'S TAPE — tape.ts and quotes.ts, exactly as before */
export const HOUSE: ReplayMarket = {
  kind: 'house',
  ready: true,
  days: tapeDays,
  dayIndex,
  nextDay,
  prevDay,
  dayBars,
  spotAt,
  ivAt: baseIvAt,
  stepOf: t => reviewName(t).step,
  quoteAt,
  quoteWith,
  spotForBid,
  spotForAsk,
  expiriesAt,
  chainAt,
  contractDay,
};

/** What a session carries of the market it replays — read here, written by the store */
export interface MarketOf {
  id: string;
  src?: 'feed';
  real?: { days: string[]; marks?: Record<string, number> };
}

/* ---- the real markets, by session: registered by the loader once a session's record is in ---- */
const feedMarkets = new Map<string, ReplayMarket>();
export const registerMarket = (sessionId: string, m: ReplayMarket): void => {
  feedMarkets.set(sessionId, m);
};
export const unregisterMarket = (sessionId: string): void => {
  feedMarkets.delete(sessionId);
};

/** The calendar's own order for any day — a real session's days may lie before the house's tape begins */
export const dayOrdinal = (iso: string): number => Math.round(dateOf(iso).getTime() / 86_400_000);

/** A real session before its record is in: the marks last seen, the days it holds, nothing that fills */
function stillMarket(s: MarketOf): ReplayMarket {
  const days = s.real?.days ?? [];
  const marks = s.real?.marks ?? {};
  const at = (iso: string) => days.indexOf(iso);
  const still = (c: ContractId): Quote => {
    const v = marks[contractKey(c)] ?? 0;
    return { bid: v, ask: v, mark: v, iv: 0, delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0, intrinsic: 0, dead: true, spot: 0, src: 'coming' };
  };
  return {
    kind: 'feed',
    ready: false,
    days: () => days,
    dayIndex: at,
    nextDay: iso => days[at(iso) + 1] ?? null,
    prevDay: iso => days[at(iso) - 1] ?? null,
    dayBars: () => [],
    spotAt: () => 0,
    ivAt: t => reviewName(t).iv,
    stepOf: t => reviewName(t).step,
    quoteAt: still,
    quoteWith: still,
    spotForBid: () => null,
    spotForAsk: () => null,
    expiriesAt: () => [],
    chainAt: () => ({ spot: 0, rows: [] }),
    contractDay: () => ({ high: NaN, low: NaN, prevClose: NaN, last: NaN, volume: NaN, oi: NaN, breakeven: NaN, toBreakevenPct: NaN }),
  };
}

const stills = new Map<string, { marks: unknown; days: unknown; m: ReplayMarket }>();
/** The market a session replays: the house's tape, or its own real days (registered, or still until they come in) */
export function marketOf(s: MarketOf): ReplayMarket {
  if (s.src !== 'feed') return HOUSE;
  const live = feedMarkets.get(s.id);
  if (live) return live;
  const hit = stills.get(s.id);
  if (hit && hit.marks === s.real?.marks && hit.days === s.real?.days) return hit.m;
  const m = stillMarket(s);
  stills.set(s.id, { marks: s.real?.marks, days: s.real?.days, m });
  return m;
}
