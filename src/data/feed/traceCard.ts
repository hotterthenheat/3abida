/*
==================================================
  SLAYER TERMINAL - THE PRINT CARD ON THE FEED
  (data/feed/traceCard.ts)

  The card a Trace row opens (components/trace/
  PrintDrilldown.tsx) reads the contract's own day from
  Unusual Whales when the room is on the feed
  (2026-10-12) — one session, the book's:
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
  left out (the intraday shape of a past session; the
  name's premium minute by minute).
==================================================
*/

import { useMemo } from 'react';
import { nyClock, nyParts } from '../../core/nyTime';
import { SESSION_MIN, type ContractFlow, type FlowOrder, type FlowSide, type VolOiDay } from '../contractflow';
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
  /** The contract printed more today than its flow answered with — the card says "its latest" */
  capped: boolean;
}

const sideOf = (t: UwOptionTrade): FlowSide => (t.tags.includes('ask_side') ? 'ASK' : t.tags.includes('bid_side') ? 'BID' : 'MID');

function build(
  print: FlowPrint,
  s: FeedSession,
  intervalMin: number,
  prints: UwOptionTrade[],
  minutes: UwContractMinute[] | null,
  history: UwContractSession[] | null,
  ticks: UwNetPremTick[] | null,
  bars: UwBar[] | null,
  expiries: UwExpiryFlow[] | null,
  strikeFlow: UwStrikeFlow[] | null
): FeedCard {
  const snap = (m: number) => Math.max(0, Math.min(SESSION_MIN, Math.floor(m / intervalMin) * intervalMin));
  const today = prints.filter(t => t.executedAt >= s.open && t.executedAt <= s.close).sort((a, b) => a.executedAt - b.executedAt);
  const meanSize = today.length ? today.reduce((a, t) => a + t.size, 0) / today.length : 1;
  const points = today.map(t => ({
    min: snap(sinceOpen(t.executedAt)),
    price: t.price,
    size: t.size,
    side: sideOf(t),
    premium: t.premium,
    iv: t.iv !== null ? Math.round(t.iv * 1000) / 10 : NaN,
    relVol: Math.round((t.size / meanSize) * 100) / 100,
    multiLeg: /^(ml|tl|mf|me)/.test(t.condition),
    session: 0,
  }));
  const orders: FlowOrder[] = today
    .map(t => ({
      id: t.id,
      time: nyClock(t.executedAt, { seconds: true }),
      session: 0,
      price: t.price,
      size: t.size,
      side: sideOf(t),
      premium: t.premium,
      sweep: t.flags.includes('intermarket_sweep') || t.condition === 'isoi',
      multiLeg: /^(ml|tl|mf|me)/.test(t.condition),
      iv: t.iv !== null ? Math.round(t.iv * 1000) / 10 : NaN,
    }))
    .reverse();

  /* the average paid and the IV through the session, a bar per interval, off the contract's minutes */
  const mins = (minutes ?? []).filter(m => m.at >= s.open && m.at < s.close);
  const byBar = new Map<number, { cost: number; vol: number; ivSum: number; ivN: number }>();
  for (const m of mins) {
    const vol = m.volumeAsk + m.volumeBid + m.volumeMid + m.volumeNoSide;
    if (vol <= 0 || m.avgPrice === null) continue;
    const k = snap(sinceOpen(m.at));
    const b = byBar.get(k) ?? { cost: 0, vol: 0, ivSum: 0, ivN: 0 };
    b.cost += m.avgPrice * vol;
    b.vol += vol;
    if (m.ivLow !== null && m.ivHigh !== null) {
      b.ivSum += ((m.ivLow + m.ivHigh) / 2) * 100;
      b.ivN++;
    }
    byBar.set(k, b);
  }
  const keys = Array.from(byBar.keys()).sort((a, b) => a - b);
  const meanBar = keys.length ? keys.reduce((a, k) => a + byBar.get(k)!.vol, 0) / keys.length : 1;
  const avg = keys.map(k => {
    const b = byBar.get(k)!;
    return { min: k, price: Math.round((b.cost / b.vol) * 100) / 100, iv: b.ivN ? Math.round((b.ivSum / b.ivN) * 10) / 10 : NaN, relVol: Math.round((b.vol / meanBar) * 100) / 100 };
  });

  /* the contract's day, off its minutes when they are in (the whole session), else off its prints */
  let dayVol = 0;
  let dayPrem = 0;
  let askV = 0;
  let bidV = 0;
  let midV = 0;
  let multiV = 0;
  for (const m of mins) {
    askV += m.volumeAsk;
    bidV += m.volumeBid;
    midV += m.volumeMid + m.volumeNoSide;
    multiV += m.volumeMulti;
    dayPrem += m.premiumAsk + m.premiumBid + m.premiumMid + m.premiumNoSide;
  }
  dayVol = askV + bidV + midV;
  if (dayVol === 0) {
    for (const p of points) {
      dayVol += p.size;
      dayPrem += p.premium;
      if (p.side === 'ASK') askV += p.size;
      else if (p.side === 'BID') bidV += p.size;
      else midV += p.size;
      if (p.multiLeg) multiV += p.size;
    }
  }
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

  /* the name: its net premium a minute, cumulated, on its own minute closes */
  const step = Math.max(1, intervalMin);
  const sessionTicks = (ticks ?? []).filter(t => t.at >= s.open && t.at < s.close).sort((a, b) => a.at - b.at);
  const priceAt = new Map<number, number>();
  for (const b of bars ?? []) if (b.at >= s.open && b.at < s.close && b.close !== null) priceAt.set(snap(sinceOpen(b.at)), b.close);
  const series: ContractFlow['net']['series'] = [];
  const ubars = new Map<number, { callVol: number; putVol: number }>();
  let netCall = 0;
  let netPut = 0;
  let lastPrice = NaN;
  for (const t of sessionTicks) {
    netCall += t.netCallPremium;
    netPut += t.netPutPremium;
    const k = Math.floor(sinceOpen(t.at) / step) * step;
    const px = priceAt.get(snap(sinceOpen(t.at)));
    if (px !== undefined) lastPrice = px;
    const prev = series[series.length - 1];
    const pt = { min: k, netCall, netPut: -netPut, price: lastPrice };
    if (prev && prev.min === k) series[series.length - 1] = pt;
    else series.push(pt);
    const ub = ubars.get(k) ?? { callVol: 0, putVol: 0 };
    ub.callVol += t.callVolume;
    ub.putVol += t.putVolume;
    ubars.set(k, ub);
  }
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
  /* the minute's premium by side is not in the ticks — the bars carry volume alone, and the card offers no dollar view */
  const underBars = Array.from(ubars.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([min, v]) => ({ min, callVol: v.callVol, putVol: -v.putVol, callPrem: 0, putPrem: 0, price: priceAt.get(min) ?? NaN }));

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

  /* the contract's sessions, newest first */
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
      /* a session's shape through the day is not in these answers */
      intraday: [],
    };
  });

  const cf: ContractFlow = {
    points,
    avg,
    orders,
    volMax: Math.max(1, ...points.map(p => p.size)),
    windowMin: SESSION_MIN,
    sessions: 1,
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
  return { cf, capped: prints.length >= CARD_PRINTS };
}

/** The card's contract on the feed: null until its prints are in, or when the card is not on the feed */
export function useFeedCard(on: boolean, print: FlowPrint | null, intervalMin: number): FeedCard | null {
  const s = feedSession();
  const occ = print?.occ;
  const date = dateParam(s);
  const prints = useFeedContractPrints(on, occ);
  const minutes = useFeedPoll(on && occ ? `trace:cmin:${occ}:${s.date}` : null, () => uwContractIntraday(occ!, date), 30_000);
  const history = useFeedPoll(on && occ ? `trace:chist:${occ}` : null, () => uwContractHistoric(occ!), 10 * 60_000);
  const name = useFeedNameDay(on && !!print, print?.ticker);
  return useMemo(() => {
    if (!on || !print || !prints) return null;
    try {
      return build(print, s, intervalMin, prints, minutes?.ok ? minutes.data : null, history?.ok ? history.data : null, name.ticks, name.bars, name.expiries, name.strikes);
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, print, prints, minutes, history, name.ticks, name.bars, name.expiries, name.strikes, intervalMin, s.date]);
}

/** "MM/DD" of the session — the card's one day on the feed */
export const sessionLabel = (s: FeedSession): string => {
  const p = nyParts(s.open);
  return `${pad(p.month)}/${pad(p.day)}`;
};
