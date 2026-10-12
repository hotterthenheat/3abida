/*
==================================================
  SLAYER TERMINAL - THE STOCKS BOARD ON THE FEED
  (data/feed/stocks.ts)

  THE UI IS THE OWNER'S; THE FEED FILLS IT (2026-10-12).
  With the Dossier on the feed, the Stocks page is the
  house's board on the vendor's figures: every name's
  day off UW's stock screener (one call for the list,
  stockDay.ts), its four sleeves READ off those figures
  and put through the board's own composite, verdict and
  read (data/stocks.ts pickOf), its thirty-session line
  off UW's daily bars against SPY's, and the sectors'
  rotation off their names' one-week and one-month
  returns against SPY's (buildSectorBoard's own rule).

  THE SLEEVES, each 50 ± 50 × the balance of its reads
  (stockOverview.ts's scoreOf, the overview's own way):
    the trend    price against its 50- and 200-day
                 averages, RSI, the month's return
    the numbers  earnings a share against the same
                 quarter a year before
    the money    the day's bullish premium against its
                 bearish (calls bought, puts sold, and
                 the other way round)
    the news     the wire's lean on the name (UW tags
                 its headlines' sentiment; a name with
                 none reads in the middle)
==================================================
*/

import { useMemo } from 'react';
import { useFeedPoll } from './poll';
import { uwOhlc, type UwHeadline, type UwStockDay } from './uw';
import { dayChangePct } from './stockDay';
import { buildSectorBoard, pickOf, type SectorRow, type StockPick, type StockSleeves } from '../stocks';
import type { Sector, UniverseName } from '../universe';
import type { FeedResult } from './client';

const clamp = (v: number) => Math.max(-1, Math.min(1, v));
/** 50 ± 50 × the reads' mean; NaN when none can be read */
const sleeve = (leans: number[]): number => {
  const ok = leans.filter(Number.isFinite);
  return ok.length ? Math.round(50 + (50 * ok.reduce((a, b) => a + b, 0)) / ok.length) : NaN;
};
const off = (a: number | null, b: number | null) => (a !== null && b ? ((a - b) / b) * 100 : NaN);

/** The four sleeves off the vendor's figures for one name */
export function feedSleeves(d: UwStockDay | undefined, wire: UwHeadline[] | null): StockSleeves {
  if (!d) return { momentum: NaN, quality: NaN, flow: NaN, news: NaN };
  const momentum = sleeve([
    clamp(off(d.close, d.sma50) / 5),
    clamp(off(d.close, d.sma200) / 10),
    d.rsi14 !== null ? clamp((d.rsi14 - 50) / 20) : NaN,
    d.oneMonthPerc !== null ? clamp((d.oneMonthPerc * 100) / 8) : NaN,
  ]);
  const quality = sleeve([d.epsGrowth4q !== null ? clamp(d.epsGrowth4q / 0.3) : NaN]);
  const bull = d.bullishPremium ?? NaN;
  const bear = d.bearishPremium ?? NaN;
  const flow = sleeve([bull + bear > 0 ? clamp(((bull - bear) / (bull + bear)) * 1.5) : NaN]);
  const t = d.ticker.toUpperCase();
  const lean = (wire ?? [])
    .filter(h => h.tickers.some(x => x.toUpperCase() === t))
    .map((h): number => (/positive|bullish/i.test(h.sentiment) ? 0.5 : /negative|bearish/i.test(h.sentiment) ? -0.5 : 0));
  const news = Math.round(50 + (lean.length ? lean.reduce((a, b) => a + b, 0) / lean.length : 0) * 48);
  return { momentum, quality, flow, news };
}

/** The thirty sessions' line against SPY's (the board's sparkline), off UW's daily bars, regular session alone */
export function useFeedTrends(on: boolean, tickers: string[]): Map<string, number[]> | null {
  const list = useMemo(() => Array.from(new Set(['SPY', ...tickers.map(t => t.toUpperCase())])).sort(), [tickers]);
  const r = useFeedPoll<Record<string, number[]>>(
    on && tickers.length ? `uw:trends:${list.join(',')}` : null,
    async (): Promise<FeedResult<Record<string, number[]>>> => {
      const out: Record<string, number[]> = {};
      for (const t of list) {
        const b = await uwOhlc(t, { size: '1d', limit: 120 });
        if (!b.ok) continue;
        out[t] = b.data
          .filter(x => x.marketTime === 'r' && x.close !== null && Number.isFinite(x.at))
          .sort((a, z) => a.at - z.at)
          .slice(-30)
          .map(x => x.close as number);
      }
      return { ok: true, data: out, at: Date.now() };
    },
    30 * 60_000
  );
  return useMemo(() => {
    if (!r?.ok) return null;
    const spy = r.data.SPY ?? [];
    const m = new Map<string, number[]>();
    for (const [t, closes] of Object.entries(r.data)) {
      const n = Math.min(closes.length, spy.length);
      if (n < 2) continue;
      const a = closes.slice(-n);
      const s = spy.slice(-n);
      /* relative strength, rebased to 50 on the first session */
      m.set(t, a.map((c, i) => (50 * (c / a[0])) / (s[i] / s[0])));
    }
    return m;
  }, [r]);
}

/** The board on the feed: the house's names, each one's pick off the vendor's figures */
export function feedStockBoard(names: UniverseName[], days: Map<string, UwStockDay> | null, trends: Map<string, number[]> | null, wire: UwHeadline[] | null): StockPick[] {
  return names
    .map(u => {
      const d = days?.get(u.ticker.toUpperCase());
      return pickOf(u, feedSleeves(d, wire), d?.close ?? NaN, dayChangePct(d), trends?.get(u.ticker.toUpperCase()) ?? []);
    })
    .sort((a, b) => (Number.isFinite(b.composite) ? b.composite : -1) - (Number.isFinite(a.composite) ? a.composite : -1));
}

/** The rotation on the feed: each sector's names' returns against SPY's over a week and a month */
export function feedSectorBoard(picks: StockPick[], days: Map<string, UwStockDay> | null): SectorRow[] {
  const spy = days?.get('SPY');
  const avg = (xs: (number | null)[]) => {
    const ok = xs.filter((x): x is number => x !== null && Number.isFinite(x));
    return ok.length ? ok.reduce((a, b) => a + b, 0) / ok.length : NaN;
  };
  return buildSectorBoard(picks, (sector: Sector) => {
    const members = picks.filter(p => p.sector === sector).map(p => days?.get(p.ticker.toUpperCase()));
    const w = avg(members.map(m => m?.oneWeekPerc ?? null)) - (spy?.oneWeekPerc ?? NaN);
    const mo = avg(members.map(m => m?.oneMonthPerc ?? null)) - (spy?.oneMonthPerc ?? NaN);
    return { rs1w: w * 100, rs1m: mo * 100 };
  });
}
