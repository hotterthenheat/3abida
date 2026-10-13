/*
==================================================
  SLAYER TERMINAL - THE PRINT CARD ON THE FEED
  (data/feed/traceCard.ts)

  The card a Trace row opens (components/trace/
  PrintDrilldown.tsx) reads the contract's own day from
  Unusual Whales when the room is on the feed
  (2026-10-12) — over the card's own window (its range
  of sessions, the session it ends on, the single-leg
  cut: every answer below takes a `date`, so a past
  session is the vendor's too, asked once and kept):
    · its prints: GET /api/option-contract/{id}/flow
      (the newest 500 — a busy contract prints more in
      a day, and the card says "its latest" then);
    · its minutes: …/intraday (the average paid and the
      IV, a minute at a time, the whole session);
    · its sessions: …/historic (volume, OI, the close,
      the sides, the sweeps — ten sessions);
    · the name's day: net-prem-ticks (a tick a minute),
      flow-per-expiry (the premium at the ask and on
      the bid), flow-per-strike, and its minute bars.
  Nothing here is drawn: what the answers leave out is
  left out (the name's premium minute by minute — the
  dollar view's bars are "—").
==================================================
*/

import { useMemo } from 'react';
import { nyClock, nyParts, nyWallTime, nyText } from '../../core/nyTime';
import { sessionsBefore, SESSION_MIN, type ContractFlow, type FlowOptions, type FlowOrder, type FlowRange, type FlowSide, type VolOiDay } from '../contractflow';
import type { FeedResult } from './client';
import type { FlowPrint } from '../../types/trace';
import { useFeedPoll } from './poll';
import { feedSession, nyMinuteAt, printRow, type FeedPrint, type FeedSession } from './trace';
import {
  uwContractFlow,
  uwContractHistoric,
  uwContractIntraday,
  uwFlowPerExpiry,
  uwFlowPerStrike,
  uwNetPremTicks,
  uwOhlc,
  type UwBar,
  type UwContractMinute,
  type UwContractSession,
  type UwExpiryFlow,
  type UwNetPremTick,
  type UwOptionTrade,
  type UwStrikeFlow,
} from './uw';

/** The prints a contract's flow answers with at most */
export const CARD_PRINTS = 500;

const dateParam = (s: FeedSession) => (s.live ? undefined : s.date);
/** Minutes since 09:30 New York */
const sinceOpen = (t: number) => nyMinuteAt(t) - (9 * 60 + 30);
const pad = (n: number) => String(n).padStart(2, '0');

/** The contract's newest prints today — shared by the card and by a book row that opens it */
export function useFeedContractPrints(on: boolean, occ: string | undefined): UwOptionTrade[] | null {
  const s = feedSession();
  const r = useFeedPoll(on && occ ? `trace:cflow:${occ}:${s.date}` : null, () => uwContractFlow(occ!, { limit: CARD_PRINTS, date: dateParam(s) }), 15_000);
  return r?.ok ? r.data.filter(t => !t.canceled) : r ? [] : null;
}

/** A book row's latest print, as the tape speaks it — or null while it is asked */
export function useFeedLatestPrint(on: boolean, occ: string | undefined): FeedPrint | null {
  const s = feedSession();
  const prints = useFeedContractPrints(on, occ);
  return useMemo(() => (prints && prints.length ? printRow(prints[0], s) : null), [prints, s.date]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** The name's own day, for the card's lower strip — shared with Net Flow's pane where the keys match */
export function useFeedNameDay(on: boolean, ticker: string | undefined) {
  const s = feedSession();
  const t = ticker?.toUpperCase();
  const date = dateParam(s);
  const ticks = useFeedPoll(on && t ? `trace:ticks:${t}:${s.date}` : null, () => uwNetPremTicks(t!, date), 30_000);
  const bars = useFeedPoll(on && t ? `trace:bars:${t}:${s.date}` : null, () => uwOhlc(t!, { size: '1m', limit: 1000, date }), 30_000);
  const expiries = useFeedPoll(on && t ? `trace:expflow:${t}:${s.date}` : null, () => uwFlowPerExpiry(t!, date), 60_000);
  const strikes = useFeedPoll(on && t ? `trace:strikeflow:${t}:${s.date}` : null, () => uwFlowPerStrike(t!, date), 60_000);
  return {
    ticks: ticks?.ok ? ticks.data : null,
    bars: bars?.ok ? bars.data : null,
    expiries: expiries?.ok ? expiries.data : null,
    strikes: strikes?.ok ? strikes.data : null,
  };
}

/** The session's regular minutes of a name's bars, oldest first */
export function sessionBars(bars: UwBar[] | null, s: FeedSession): UwBar[] {
  if (!bars) return [];
  return bars.filter(b => b.at >= s.open && b.at < s.close && b.close !== null).sort((a, b) => a.at - b.at);
}

export interface FeedCard {
  cf: ContractFlow;
  /** The contract printed more in a session than its flow answered with — the card says "its latest" */
  capped: boolean;
}

const sideOf = (t: UwOptionTrade): FlowSide => (t.tags.includes('ask_side') ? 'ASK' : t.tags.includes('bid_side') ? 'BID' : 'MID');
const isMulti = (t: UwOptionTrade) => /^(ml|tl|mf|me)/.test(t.condition);

/** One session of the card's window, as the vendor answered it */
export interface CardDay {
  /** YYYY-MM-DD, New York's */
  date: string;
  open: number;
  close: number;
  prints: UwOptionTrade[];
  minutes: UwContractMinute[] | null;
  ticks: UwNetPremTick[] | null;
  bars: UwBar[] | null;
}

/**
 * The card's window off the vendor's answers, session by session (0 the earliest), as the house's card lays it out
 * (contractflow.ts buildContractFlow): the contract's prints and its minutes, the name's net premium and volume a
 * minute on its own minute closes; where the day's activity sat on the chain and the flow by expiry are the last
 * session's. `singleLegOnly` drops the prints the exchange marked as a leg of a multi-leg order.
 */
export function buildCard(
  print: FlowPrint,
  days: CardDay[],
  intervalMin: number,
  singleLegOnly: boolean,
  history: UwContractSession[] | null,
  expiries: UwExpiryFlow[] | null,
  strikeFlow: UwStrikeFlow[] | null
): FeedCard {
  const snap = (m: number) => Math.max(0, Math.min(SESSION_MIN, Math.floor(m / intervalMin) * intervalMin));
  const at = (i: number, t: number) => i * SESSION_MIN + snap(sinceOpen(t));
  const points: ContractFlow['points'] = [];
  const orders: FlowOrder[] = [];
  let capped = false;
  const all: { i: number; t: UwOptionTrade }[] = [];
  days.forEach((d, i) => {
    if (d.prints.length >= CARD_PRINTS) capped = true;
    for (const t of d.prints) if (t.executedAt >= d.open && t.executedAt <= d.close && !(singleLegOnly && isMulti(t))) all.push({ i, t });
  });
  all.sort((a, b) => a.t.executedAt - b.t.executedAt);
  const meanSize = all.length ? all.reduce((a, x) => a + x.t.size, 0) / all.length : 1;
  for (const { i, t } of all) {
    points.push({
      min: at(i, t.executedAt),
      price: t.price,
      size: t.size,
      side: sideOf(t),
      premium: t.premium,
      iv: t.iv !== null ? Math.round(t.iv * 1000) / 10 : NaN,
      relVol: Math.round((t.size / meanSize) * 100) / 100,
      multiLeg: isMulti(t),
      session: i,
    });
    orders.push({
      id: t.id,
      time: nyText(t.executedAt, { seconds: true }),
      session: i,
      price: t.price,
      size: t.size,
      side: sideOf(t),
      premium: t.premium,
      sweep: t.flags.includes('intermarket_sweep') || t.condition === 'isoi',
      multiLeg: isMulti(t),
      iv: t.iv !== null ? Math.round(t.iv * 1000) / 10 : NaN,
    });
  }
  orders.reverse();

  /* the average paid and the IV through the window, a bar per interval, off the contract's minutes */
  const byBar = new Map<number, { cost: number; vol: number; ivSum: number; ivN: number }>();
  let askV = 0;
  let bidV = 0;
  let midV = 0;
  let multiV = 0;
  let dayPrem = 0;
  let minutesIn = false;
  days.forEach((d, i) => {
    for (const m of d.minutes ?? []) {
      if (m.at < d.open || m.at >= d.close) continue;
      minutesIn = true;
      askV += m.volumeAsk;
      bidV += m.volumeBid;
      midV += m.volumeMid + m.volumeNoSide;
      multiV += m.volumeMulti;
      dayPrem += m.premiumAsk + m.premiumBid + m.premiumMid + m.premiumNoSide;
      const vol = m.volumeAsk + m.volumeBid + m.volumeMid + m.volumeNoSide;
      if (vol <= 0 || m.avgPrice === null) continue;
      const k = at(i, m.at);
      const b = byBar.get(k) ?? { cost: 0, vol: 0, ivSum: 0, ivN: 0 };
      b.cost += m.avgPrice * vol;
      b.vol += vol;
      if (m.ivLow !== null && m.ivHigh !== null) {
        b.ivSum += ((m.ivLow + m.ivHigh) / 2) * 100;
        b.ivN++;
      }
      byBar.set(k, b);
    }
  });
  const keys = Array.from(byBar.keys()).sort((a, b) => a - b);
  const meanBar = keys.length ? keys.reduce((a, k) => a + byBar.get(k)!.vol, 0) / keys.length : 1;
  const avg = keys.map(k => {
    const b = byBar.get(k)!;
    return { min: k, price: Math.round((b.cost / b.vol) * 100) / 100, iv: b.ivN ? Math.round((b.ivSum / b.ivN) * 10) / 10 : NaN, relVol: Math.round((b.vol / meanBar) * 100) / 100 };
  });
  /* the window's tape, off its minutes when they are in, else off its prints */
  if (!minutesIn) {
    for (const p of points) {
      dayPrem += p.premium;
      if (p.side === 'ASK') askV += p.size;
      else if (p.side === 'BID') bidV += p.size;
      else midV += p.size;
      if (p.multiLeg) multiV += p.size;
    }
  }
  const dayVol = askV + bidV + midV;
  const stats = {
    vol: dayVol,
    oi: print.oi,
    avgPrice: dayVol > 0 ? Math.round((dayPrem / (dayVol * 100)) * 100) / 100 : NaN,
    premium: dayPrem,
    otmPct: Number.isFinite(print.spot) && print.spot > 0 ? Math.round((((print.right === 'C' ? print.strike - print.spot : print.spot - print.strike) / print.spot) * 100) * 10) / 10 : NaN,
    volOverOi: print.oi > 0 ? Math.round((dayVol / print.oi) * 100) / 100 : NaN,
    multiPct: dayVol > 0 ? Math.round((multiV / dayVol) * 100) : 0,
    bidCount: bidV,
    midCount: midV,
    askCount: askV,
    askSharePct: dayVol > 0 ? Math.round((askV / dayVol) * 100) : 0,
  };

  /* the name: its net premium a minute, cumulated through the window, on its own minute closes */
  const step = Math.max(1, intervalMin);
  const series: ContractFlow['net']['series'] = [];
  const ubars = new Map<number, { callVol: number; putVol: number; price: number }>();
  let netCall = 0;
  let netPut = 0;
  let lastPrice = NaN;
  days.forEach((d, i) => {
    const priceAt = new Map<number, number>();
    for (const b of d.bars ?? []) if (b.at >= d.open && b.at < d.close && b.close !== null) priceAt.set(snap(sinceOpen(b.at)), b.close);
    const ticks = (d.ticks ?? []).filter(t => t.at >= d.open && t.at < d.close).sort((a, b) => a.at - b.at);
    for (const t of ticks) {
      netCall += t.netCallPremium;
      netPut += t.netPutPremium;
      const k = i * SESSION_MIN + Math.floor(sinceOpen(t.at) / step) * step;
      const px = priceAt.get(snap(sinceOpen(t.at)));
      if (px !== undefined) lastPrice = px;
      const prev = series[series.length - 1];
      const pt = { min: k, netCall, netPut: -netPut, price: lastPrice };
      if (prev && prev.min === k) series[series.length - 1] = pt;
      else series.push(pt);
      const ub = ubars.get(k) ?? { callVol: 0, putVol: 0, price: NaN };
      ub.callVol += t.callVolume;
      ub.putVol += t.putVolume;
      ub.price = px ?? ub.price;
      ubars.set(k, ub);
    }
  });
  const exp = expiries ?? [];
  const callBought = exp.reduce((a, e) => a + e.callPremiumAsk, 0);
  const callSold = exp.reduce((a, e) => a + e.callPremiumBid, 0);
  const putBought = exp.reduce((a, e) => a + e.putPremiumAsk, 0);
  const putSold = exp.reduce((a, e) => a + e.putPremiumBid, 0);
  const uCallVol = exp.reduce((a, e) => a + e.callVolume, 0);
  const uPutVol = exp.reduce((a, e) => a + e.putVolume, 0);
  const uCallPrem = exp.reduce((a, e) => a + e.callPremium, 0);
  const uPutPrem = exp.reduce((a, e) => a + e.putPremium, 0);
  const premAbs = Math.max(1, ...series.map(p => Math.max(Math.abs(p.netCall), Math.abs(p.netPut))));
  const bullTotal = Math.abs(netCall);
  const bearTotal = Math.abs(netPut);
  /* the minute's premium by side is not in the ticks — the bars carry volume alone; the dollar view's bars are "—" */
  const underBars = Array.from(ubars.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([min, v]) => ({ min, callVol: v.callVol, putVol: -v.putVol, callPrem: NaN, putPrem: NaN, price: v.price }));

  /* where the day's activity sat: the 21 strikes nearest the spot, the contract's own among them */
  const spot = print.spot;
  const sf = (strikeFlow ?? []).filter(k => k.callVolume + k.putVolume > 0);
  const near = Number.isFinite(spot) ? [...sf].sort((a, b) => Math.abs(a.strike - spot) - Math.abs(b.strike - spot)).slice(0, 21) : sf.slice(0, 21);
  if (!near.some(k => k.strike === print.strike)) {
    const own = sf.find(k => k.strike === print.strike);
    if (own) near.push(own);
  }
  const strikes = near
    .sort((a, b) => a.strike - b.strike)
    .map(k => ({ strike: k.strike, callVol: k.callVolume, putVol: -k.putVolume, callPrem: k.callPremium, putPrem: -k.putPremium, isFocus: k.strike === print.strike }));

  /* the contract's sessions, newest first — a session's shape through the day off its minutes where the window holds it */
  const shapeOf = new Map<string, number[]>();
  for (const d of days) {
    const buckets = new Array<number>(26).fill(0);
    let any = false;
    for (const m of d.minutes ?? []) {
      if (m.at < d.open || m.at >= d.close) continue;
      const k = Math.max(0, Math.min(25, Math.floor(sinceOpen(m.at) / 15)));
      buckets[k] += m.volumeAsk + m.volumeBid + m.volumeMid + m.volumeNoSide;
      any = true;
    }
    if (any) {
      const top = Math.max(1, ...buckets);
      shapeOf.set(d.date, buckets.map(v => v / top));
    }
  }
  const hist = (history ?? []).slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  const premSum = hist.reduce((a, h) => a + h.premium, 0) || 1;
  const historyRows: VolOiDay[] = hist.map((h, i) => {
    const before = hist[i + 1];
    const [, m, d] = h.date.split('-');
    return {
      date: `${m}/${d}`,
      vol: h.volume,
      oi: h.openInterest,
      oiChangePct: before && before.openInterest > 0 ? Math.round(((h.openInterest - before.openInterest) / before.openInterest) * 1000) / 10 : NaN,
      close: h.lastPrice ?? NaN,
      avg: h.avgPrice !== null ? Math.round(h.avgPrice * 100) / 100 : NaN,
      bidPct: h.volume > 0 ? Math.round((h.bidVolume / h.volume) * 100) : NaN,
      iv: h.iv !== null ? Math.round(h.iv * 1000) / 10 : NaN,
      sweepPct: h.volume > 0 ? Math.round((h.sweepVolume / h.volume) * 100) : NaN,
      multiPct: h.volume > 0 ? Math.round((h.multilegVolume / h.volume) * 100) : NaN,
      totalPrem: h.premium,
      shareOfTotalPct: Math.round((h.premium / premSum) * 1000) / 10,
      intraday: shapeOf.get(h.date) ?? [],
    };
  });

  const cf: ContractFlow = {
    points,
    avg,
    orders,
    volMax: Math.max(1, ...points.map(p => p.size)),
    windowMin: SESSION_MIN * Math.max(1, days.length),
    sessions: Math.max(1, days.length),
    stats,
    net: {
      series,
      callBought,
      callSold,
      putBought,
      putSold,
      netPrem: netCall - netPut,
      netCallPrem: netCall,
      netPutPrem: netPut,
      underlyingVol: uCallVol + uPutVol,
      underlyingPrem: uCallPrem + uPutPrem,
      premAbs,
      bullishPct: Math.round((bullTotal / Math.max(bullTotal + bearTotal, 1)) * 100),
    },
    underlying: {
      bars: underBars,
      callVol: uCallVol,
      putVol: uPutVol,
      callPrem: uCallPrem,
      putPrem: uPutPrem,
      putSharePct: Math.round((uPutVol / Math.max(uCallVol + uPutVol, 1)) * 100),
      putPremSharePct: Math.round((uPutPrem / Math.max(uCallPrem + uPutPrem, 1)) * 100),
    },
    strikes,
    history: historyRows,
  };
  return { cf, capped };
}

const SESSIONS_FOR: Record<FlowRange, number> = { '1D': 1, '2D': 2, '3D': 3, '5D': 5, '10D': 10, '1M': 21 };
const two = (n: number) => String(n).padStart(2, '0');
const isoOf = (d: Date) => `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;

/** The window's sessions, oldest first: `n` sessions ending `back` sessions before the book's own */
export function cardDates(s: FeedSession, back: number, n: number): string[] {
  const [y, m, d] = s.date.split('-').map(Number);
  const end = sessionsBefore(new Date(y, m - 1, d), back);
  const out: string[] = [];
  for (let k = n - 1; k >= 0; k--) out.push(isoOf(sessionsBefore(end, k)));
  return out;
}
const openOf = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return { open: nyWallTime(y, m, d, 9, 30), close: nyWallTime(y, m, d, 16, 0) };
};

/** Past sessions of the window, asked once in turn and kept (the proxy keeps a past day's answers half an hour) */
async function loadPast(occ: string, ticker: string, dates: string[]): Promise<FeedResult<CardDay[]>> {
  const out: CardDay[] = [];
  for (const date of dates) {
    const [prints, minutes, ticks, bars] = [
      await uwContractFlow(occ, { limit: CARD_PRINTS, date }),
      await uwContractIntraday(occ, date),
      await uwNetPremTicks(ticker, date),
      await uwOhlc(ticker, { size: '1m', limit: 1000, date }),
    ];
    if (!prints.ok && prints.reason === 'rate') return prints;
    out.push({
      date,
      ...openOf(date),
      prints: prints.ok ? prints.data.filter(t => !t.canceled) : [],
      minutes: minutes.ok ? minutes.data : null,
      ticks: ticks.ok ? ticks.data : null,
      bars: bars.ok ? bars.data : null,
    });
  }
  return { ok: true, data: out, at: Date.now() };
}

/**
 * The card's contract on the feed, over the card's own window — its range of sessions ending `dayOffset` sessions back,
 * the single-leg cut and the interval: null until the newest session's prints are in, or when the card is not on the
 * feed. The book's own session is polled as it moves; the sessions before it are asked once.
 */
export function useFeedCard(on: boolean, print: FlowPrint | null, opts: FlowOptions): FeedCard | null {
  const s = feedSession();
  const occ = print?.occ;
  const ticker = print?.ticker?.toUpperCase() ?? '';
  const dates = useMemo(() => cardDates(s, opts.dayOffset, SESSIONS_FOR[opts.range] ?? 1), [s.date, opts.dayOffset, opts.range]); // eslint-disable-line react-hooks/exhaustive-deps
  const endDate = dates[dates.length - 1];
  /* the book's own session, when the window ends on it, moves — polled; any other session is asked once */
  const liveEnd = endDate === s.date;
  const date = dateParam(s);
  const prints = useFeedContractPrints(on && liveEnd, occ);
  const minutes = useFeedPoll(on && liveEnd && occ ? `trace:cmin:${occ}:${s.date}` : null, () => uwContractIntraday(occ!, date), 30_000);
  const history = useFeedPoll(on && occ ? `trace:chist:${occ}` : null, () => uwContractHistoric(occ!), 10 * 60_000);
  const name = useFeedNameDay(on && !!print && liveEnd, print?.ticker);
  const pastDates = liveEnd ? dates.slice(0, -1) : dates;
  const past = useFeedPoll(on && occ && ticker && pastDates.length ? `trace:cpast:${occ}:${pastDates.join(',')}` : null, () => loadPast(occ!, ticker, pastDates), 10 * 60_000);
  /* the chain and the flow by expiry are the last session's — the book's own, or a past one asked once */
  const endChain = useFeedPoll(
    on && ticker && !liveEnd ? `trace:cchain:${ticker}:${endDate}` : null,
    async () => {
      const e = await uwFlowPerExpiry(ticker, endDate);
      const k = await uwFlowPerStrike(ticker, endDate);
      return { ok: true as const, data: { expiries: e.ok ? e.data : null, strikes: k.ok ? k.data : null }, at: Date.now() };
    },
    10 * 60_000
  );
  return useMemo(() => {
    if (!on || !print) return null;
    if (liveEnd && !prints) return null;
    if (pastDates.length && !past) return null;
    const days: CardDay[] = [...(past?.ok ? past.data : [])];
    if (liveEnd)
      days.push({ date: s.date, open: s.open, close: s.close, prints: prints ?? [], minutes: minutes?.ok ? minutes.data : null, ticks: name.ticks, bars: name.bars });
    try {
      const chain = liveEnd ? { expiries: name.expiries, strikes: name.strikes } : endChain?.ok ? endChain.data : { expiries: null, strikes: null };
      return buildCard(print, days, opts.intervalMin, opts.singleLegOnly, history?.ok ? history.data : null, chain.expiries, chain.strikes);
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, print, prints, minutes, history, past, endChain, name.ticks, name.bars, name.expiries, name.strikes, opts.intervalMin, opts.singleLegOnly, liveEnd, s.date]);
}

/** "MM/DD" of the session — the card's one day on the feed */
export const sessionLabel = (s: FeedSession): string => {
  const p = nyParts(s.open);
  return `${pad(p.month)}/${pad(p.day)}`;
};
