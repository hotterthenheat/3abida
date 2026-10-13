/*
==================================================
  SLAYER TERMINAL - A NAME'S OVERVIEW ON THE FEED
  (data/feed/stockName.ts)

  THE UI IS THE OWNER'S; THE FEED FILLS IT (2026-10-12).
  With the Dossier on the feed, a name's page is the
  house's overview (data/stockOverview.ts overviewFrom —
  the four pillars, the read, the timeline, the method)
  run on the vendors' answers:

    THE TREND    UW's daily bars (the regular session,
                 up to 250 sessions — so the 50- and 200-
                 day averages are real ones) and today's
                 minute bars
    THE MONEY    UW's book by strike (the house's sign,
                 levels.ts), its open interest, the name's
                 contracts today (the screener), its dark
                 crosses (traceDark.ts), the day's volume
                 against its sessions
    THE NEWS     UW's wire on the name, as the house's
                 stories (news.ts), the name's next report
                 and its last eight reported
    THE NUMBERS  UW's filed numbers (/financials): the
                 last print, beats, growth, margins, P/E,
                 EV/sales, PEG, the balance sheet's health
                 — fair value and guidance are not on the
                 plan ("—")
    THE TAPE     the name's recent option prints
==================================================
*/

import { useMemo } from 'react';
import type { Candle } from '../../types/market';
import type { BookContract, FlowPrint } from '../../types/trace';
import type { DarkPoolView } from '../../types/darkpool';
import type { Fundamentals } from '../fundamentals';
import { moneyFactors, newsPart, numbersFactors, overviewFrom, type MoneyRead, type StockOverview } from '../stockOverview';
import { lookup } from '../universe';
import { tickerName } from '../tickers';
import { nyClock, nyIsoDate, nyParts, nySessionPhase, nyTextClock } from '../../core/nyTime';
import { useFeedPoll } from './poll';
import { useFeedPrice } from './price';
import { useFeedBook as useLevelsBook, useFeedOi, type FeedBook, type FeedOi } from './levels';
import { feedSession, printRow, useFeedNameBook } from './trace';
import { useFeedDarkView } from './traceDark';
import { wireEvents } from './news';
import { useFeedEarningsFor, useFeedNews, type FeedEarningsName } from './dossier';
import { useFeedStockDays } from './stockDay';
import { uwFinancials, uwFlowRecent, uwOhlc, type UwBar, type UwFinancials, type UwHeadline, type UwStockDay } from './uw';

const fin = Number.isFinite;


/* ---- the numbers, off the filed record ------------------------------------------------------------------------- */

/** The record's numbers as the page's: what the filings carry, NaN where they do not */
export function feedFundamentals(f: UwFinancials | null, price: number, day: UwStockDay | undefined): Fundamentals {
  const q = <T extends { type: string; fiscalEnd: string }>(xs: T[]) => xs.filter(x => x.type === 'quarterly').sort((a, b) => (a.fiscalEnd < b.fiscalEnd ? 1 : -1));
  const eps = q(f?.earnings ?? []).filter(e => e.reported !== null);
  const inc = q(f?.income ?? []);
  const cash = q(f?.cash ?? []);
  const bal = q(f?.balance ?? []);
  const last = eps[0];
  const yearAgo = eps[4];
  const beats = eps.slice(0, 8).filter(e => e.reported !== null && e.estimated !== null);
  const rev = inc[0]?.revenue ?? null;
  const revYearAgo = inc[4]?.revenue ?? null;
  const opInc = inc[0]?.operatingIncome ?? null;
  const fcf = cash[0] && cash[0].operatingCashflow !== null ? cash[0].operatingCashflow - Math.abs(cash[0].capex ?? 0) : null;
  const ttmEps = eps.length >= 4 ? eps.slice(0, 4).reduce((a, e) => a + (e.reported ?? 0), 0) : NaN;
  const ttmRev = inc.length >= 4 && inc.slice(0, 4).every(x => x.revenue !== null) ? inc.slice(0, 4).reduce((a, x) => a + (x.revenue ?? 0), 0) : NaN;
  const b = bal[0];
  const shares = b?.shares ?? null;
  const cap = day?.marketcap ?? (shares && fin(price) ? shares * price : null);
  const ev = cap !== null && b ? cap + (b.totalDebt ?? 0) - (b.cash ?? 0) : NaN;
  const pe = fin(ttmEps) && ttmEps > 0 && fin(price) ? price / ttmEps : NaN;
  const epsGrowthPct = last?.reported != null && yearAgo?.reported != null && yearAgo.reported !== 0 ? ((last.reported - yearAgo.reported) / Math.abs(yearAgo.reported)) * 100 : NaN;
  /* the balance sheet's health: the current ratio and debt against equity, each read for or against */
  const cr = b && b.currentAssets !== null && b.currentLiabilities ? b.currentAssets / b.currentLiabilities : NaN;
  const de = b && b.totalDebt !== null && b.equity ? b.totalDebt / b.equity : NaN;
  const clamp1 = (v: number) => Math.max(-1, Math.min(1, v));
  const health = fin(cr) || fin(de) ? Math.round(Math.max(0, Math.min(100, 50 + (fin(cr) ? 25 * clamp1((cr - 1) / 1.5) : 0) + (fin(de) ? 25 * clamp1(1 - de) : 0)))) : NaN;
  return {
    sample: false,
    epsEstimate: last?.estimated ?? NaN,
    epsActual: last?.reported ?? NaN,
    epsSurprisePct: last?.surprisePct ?? (last && last.estimated ? ((last.reported! - last.estimated) / Math.abs(last.estimated)) * 100 : NaN),
    revenueEstimateB: NaN,
    revenueActualB: rev !== null ? rev / 1e9 : NaN,
    revenueSurprisePct: NaN,
    beats: beats.length ? beats.filter(e => (e.reported as number) > (e.estimated as number)).length : NaN,
    revenueGrowthPct: rev !== null && revYearAgo ? ((rev - revYearAgo) / Math.abs(revYearAgo)) * 100 : NaN,
    epsGrowthPct,
    operatingMarginPct: rev && opInc !== null ? (opInc / rev) * 100 : NaN,
    freeCashFlowMarginPct: rev && fcf !== null ? (fcf / rev) * 100 : NaN,
    pe,
    sectorMedianPe: NaN,
    evToSales: fin(ev) && fin(ttmRev) && ttmRev > 0 ? ev / ttmRev : NaN,
    peg: fin(pe) && fin(epsGrowthPct) && epsGrowthPct > 0 ? pe / epsGrowthPct : NaN,
    sectorPercentile: NaN,
    fairValue: NaN,
    vsFairValuePct: NaN,
    valuation: 'fairly valued',
    healthScore: health,
    guidance: '—',
  };
}

/* ---- the sessions ---------------------------------------------------------------------------------------------- */

/** The name's sessions, oldest first: each past session its daily bar, today's its minute bars when they are in */
export function feedBlocks(daily: UwBar[] | null, minutes: UwBar[] | null): { blocks: Candle[][]; today: Candle[] } {
  const today = nyIsoDate();
  const s = feedSession();
  const mins: Candle[] = (minutes ?? [])
    .filter(b => b.at >= s.open && b.at < s.close && b.open !== null && b.high !== null && b.low !== null && b.close !== null)
    .sort((a, b) => a.at - b.at)
    .map(b => ({ time: Math.floor(b.at / 60_000) * 60, open: b.open as number, high: b.high as number, low: b.low as number, close: b.close as number, volume: b.volume }));
  const sessionDay = s.date;
  const days = (daily ?? [])
    .filter(b => b.marketTime === 'r' && b.open !== null && b.high !== null && b.low !== null && b.close !== null && fin(b.at))
    .sort((a, b) => a.at - b.at);
  const blocks: Candle[][] = [];
  for (const b of days) {
    const p = nyParts(b.at);
    const iso = `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
    if (mins.length && (iso === sessionDay || iso === today)) continue;
    /* a session's first bar is its open, 09:30 New York (its daily bar is stamped 16:00) */
    blocks.push([{ time: Math.floor(b.at / 1000) - 6.5 * 3600, open: b.open as number, high: b.high as number, low: b.low as number, close: b.close as number, volume: b.volume }]);
  }
  if (mins.length) blocks.push(mins);
  return { blocks, today: mins };
}

/* ---- the money ------------------------------------------------------------------------------------------------- */

const EMPTY_DARK = (ticker: string, spot: number): DarkPoolView => ({ ticker, spot, dpSharePct: NaN, netPosturePct: 0, posture: 'BALANCED', postureNote: '', totalNotional: 0, levels: [], prints: [], largest: null });

export function feedMoney(ticker: string, price: number, changePct: number, book: FeedBook | null, oi: FeedOi | null, rows: BookContract[], dark: DarkPoolView | null, blocks: Candle[][], today: Candle[]): { read: MoneyRead; factors: ReturnType<typeof moneyFactors> } {
  const calls = rows.filter(r => r.right === 'C');
  const puts = rows.filter(r => r.right === 'P');
  const sum = (xs: BookContract[], f: (r: BookContract) => number) => xs.reduce((a, r) => a + (fin(f(r)) ? f(r) : 0), 0);
  const callVolume = sum(calls, r => r.volume);
  const putVolume = sum(puts, r => r.volume);
  const totalVol = callVolume + putVolume;
  const sided = rows.filter(r => fin(r.askPct));
  const sidedVol = sum(sided, r => r.volume);
  const vols = blocks.map(b => b.reduce((a, c) => a + (c.volume ?? 0), 0));
  const todayVol = today.length ? today.reduce((a, c) => a + (c.volume ?? 0), 0) : NaN;
  const past = today.length ? vols.slice(-21, -1) : vols.slice(-20);
  const avgVol = past.length ? past.reduce((a, b) => a + b, 0) / past.length : NaN;
  const hi = today.length ? Math.max(...today.map(c => c.high)) : NaN;
  const lo = today.length ? Math.min(...today.map(c => c.low)) : NaN;
  const levels = book?.levels ?? { spot: price, callWall: NaN, putWall: NaN, pin: NaN, flip: NaN, supreme: NaN };
  const netGex = book?.netGex ?? NaN;
  const d = dark ?? EMPTY_DARK(ticker, price);
  const byVol = (a: BookContract, b: BookContract) => b.volume - a.volume;
  let callOI = NaN;
  let putOI = NaN;
  if (oi) {
    callOI = 0;
    putOI = 0;
    for (const v of oi.byStrike.values()) {
      callOI += v.call;
      putOI += v.put;
    }
  }
  const read: MoneyRead = {
    netGex,
    netDex: book?.netDex ?? NaN,
    /* vega by strike is not in the feed */
    netVex: NaN,
    netVanna: book ? book.rows.reduce((a, r) => a + r.vanna.net, 0) : NaN,
    netCharm: book ? book.rows.reduce((a, r) => a + r.charm.net, 0) : NaN,
    levels,
    /* the house's sign: at or above the flip dealers absorb; with no flip, a call-heavy (negative) book absorbs */
    regime: fin(levels.flip) ? (price >= levels.flip ? 'absorbing' : 'amplifying') : netGex <= 0 ? 'absorbing' : 'amplifying',
    callPremium: rows.length ? sum(calls, r => r.premium) : NaN,
    putPremium: rows.length ? sum(puts, r => r.premium) : NaN,
    callVolume: rows.length ? callVolume : NaN,
    putVolume: rows.length ? putVolume : NaN,
    askSharePct: sidedVol > 0 ? sum(sided, r => r.askPct * r.volume) / sidedVol : NaN,
    sweepSharePct: totalVol > 0 ? sum(rows, r => r.sweepPct * r.volume) / totalVol : NaN,
    rvol: fin(todayVol) && fin(avgVol) && avgVol > 0 ? todayVol / avgVol : null,
    volumeToday: fin(todayVol) && todayVol > 0 ? todayVol : null,
    volumeAvg: fin(avgVol) && avgVol > 0 ? avgVol : null,
    closeInRange: fin(hi) && fin(lo) && hi > lo ? (today[today.length - 1].close - lo) / (hi - lo) : null,
    callOI,
    putOI,
    unusual: rows.filter(r => r.volOverOI >= 2).length,
    dark: d,
    darkBlocks: d.prints.filter(p => p.size >= 50_000).length,
    today: today.map(c => ({ time: c.time, close: c.close })),
    busiest: { calls: [...calls].sort(byVol).slice(0, 3), puts: [...puts].sort(byVol).slice(0, 3) },
  };
  return { read, factors: moneyFactors(read, changePct) };
}

/* ---- the whole page -------------------------------------------------------------------------------------------- */

const phaseWord = (): string => {
  const ph = nySessionPhase();
  return ph === 'open' ? 'market open' : ph === 'before' ? 'pre-market' : 'market closed';
};

/** The name's overview on the feed — null until its price and its sessions are in */
export function useFeedOverview(on: boolean, ticker: string): StockOverview | null {
  const T = ticker.toUpperCase();
  const s = feedSession();
  const price = useFeedPrice(on, T).price;
  const daily = useFeedPoll(on && T ? `uw:daily:${T}` : null, () => uwOhlc(T, { size: '1d', limit: 800 }), 30 * 60_000);
  const minutes = useFeedPoll(on && T ? `trace:bars:${T}:${s.date}` : null, () => uwOhlc(T, { size: '1m', limit: 1000, date: s.live ? undefined : s.date }), 30_000);
  const book = useLevelsBook(on, T).book;
  const oi = useFeedOi(on, T).today;
  const name = useFeedNameBook(on, T);
  const dark = useFeedDarkView(on, T, price?.spot ?? null, price?.changePct ?? null);
  const wire = useFeedNews(on);
  const reports = useFeedEarningsFor(on, T);
  const fins = useFeedPoll(on && T ? `dossier:fin:${T}` : null, () => uwFinancials(T), 6 * 3600_000);
  const tape = useFeedPoll(on && T ? `uw:flow-recent:${T}` : null, () => uwFlowRecent(T), 30_000);
  const days = useFeedStockDays(on, [T]);
  return useMemo(() => {
    if (!on || !price || !daily) return null;
    const u = lookup(T);
    const day = days?.get(T);
    const { blocks, today } = feedBlocks(daily.ok ? daily.data : null, minutes?.ok ? minutes.data : null);
    const money = feedMoney(T, price.spot, price.changePct, book, oi, name?.rows ?? [], dark, blocks, today);
    const stories = wireEvents((wire?.ok ? wire.data : []).filter((h: UwHeadline) => h.tickers.some(x => x.toUpperCase() === T)));
    const lean = stories.length ? stories.reduce((a, e) => a + e.item.sentiment, 0) / stories.length : 0;
    const er: FeedEarningsName | null = reports?.ok ? reports.data : null;
    const ev = er?.dossier?.event ?? null;
    const nextEarnings = ev ? { label: ev.dateLabel, daysOut: ev.daysOut, impliedMovePct: ev.impliedMovePct, confirmed: ev.confirmed } : null;
    const quarters = er?.dossier?.quarters ?? [];
    const news = newsPart(stories, lean, nextEarnings, quarters);
    const numbersRead = feedFundamentals(fins?.ok ? fins.data : null, price.spot, day);
    const own: FlowPrint[] = (tape?.ok ? tape.data : []).filter(t => !t.canceled).map(t => printRow(t, s));
    const stamp = nyClock(Date.now());
    const sessionsOn = blocks.length;
    return overviewFrom({
      ticker: T,
      name: u?.name ?? (day?.fullName || tickerName(T)),
      sector: u?.sector ?? (day?.sector || null),
      price: price.spot,
      changePct: price.changePct,
      marketWord: phaseWord(),
      blocks,
      money,
      news,
      numbers: { read: numbersRead, factors: numbersFactors(numbersRead) },
      own,
      from: { trend: `${sessionsOn} sessions of UW's daily bars`, numbers: 'the filed record', money: "UW's book, the name's contracts and its dark crosses", news: "UW's wire" },
      sources: (sessions, nr) => [
        { key: 'price', label: 'Price', status: 'live', stamp: `UW · ${stamp}` },
        { key: 'book', label: 'The options book', status: book ? 'live' : 'thin', stamp: book ? `UW · figured ${nyClock(book.at)}` : 'not in yet' },
        { key: 'flow', label: 'The flow book', status: name?.rows.length ? 'live' : 'thin', stamp: name?.rows.length ? `UW · ${name.rows.length} contracts${name.complete ? '' : ', the heaviest'}` : 'not in yet' },
        { key: 'tape', label: 'The tape', status: own.length ? 'live' : 'thin', stamp: own.length ? `UW · the newest print ${nyTextClock(own[0].time)}` : 'no prints on the name yet' },
        { key: 'dark', label: 'Dark pool', status: dark?.prints.length ? 'live' : 'thin', stamp: dark?.prints.length ? `UW · ${dark.prints.length} crosses` : 'no crosses yet' },
        { key: 'news', label: 'The wire', status: 'live', stamp: nr.stories.length ? `UW · the newest story ${nr.stories[0].item.time}` : `UW · nothing on the name in the latest hundred` },
        { key: 'sessions', label: 'Sessions', status: sessions >= 200 ? 'live' : 'thin', stamp: `${sessions} on hand` },
        { key: 'fundamentals', label: 'Fundamentals', status: fins?.ok ? 'live' : 'thin', stamp: fins?.ok ? 'the filed record · fair value and guidance not on the plan' : 'not in yet' },
        { key: 'record', label: 'Insiders and Congress', status: 'live', stamp: 'as filed' },
      ],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, T, price, daily, minutes, book, oi, name, dark, wire, reports, fins, tape, days, s.date]);
}


