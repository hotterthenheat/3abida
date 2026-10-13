/*
==================================================
  SLAYER TERMINAL - MANY NAMES' DAY AT ONCE
  (data/feed/stockDay.ts)

  UW's stock screener answers a list of names in one
  call (uw.ts uwStockScreener — 43 names seen in one
  answer): the day's price and its change, the ranges
  and returns, the averages, RSI and ADX, implied vol
  and its rank, the option volume and premium, the next
  report. A page that shows many names (Dossier's
  Stocks, Dark Pool's leaders) reads them here in one
  poll — fifty names a call, a minute apart — rather
  than a day state a name.
==================================================
*/

import { useMemo } from 'react';
import { useFeedPoll } from './poll';
import { uwStockScreener, type UwStockDay } from './uw';
import type { FeedResult } from './client';

const CHUNK = 50;
const PERIOD_MS = 60_000;

/** The day's change of a name, percent — NaN where the answer has no close or close before */
export const dayChangePct = (d: UwStockDay | undefined): number =>
  d && d.close !== null && d.prevClose ? ((d.close - d.prevClose) / d.prevClose) * 100 : NaN;

/** Many names' day, in calls of fifty, every minute. Null until the first answer; names the answer left out are absent. */
export function useFeedStockDays(on: boolean, tickers: string[]): Map<string, UwStockDay> | null {
  const list = useMemo(() => Array.from(new Set(tickers.map(t => t.toUpperCase()).filter(Boolean))).sort(), [tickers]);
  const key = on && list.length ? `uw:stocks:${list.join(',')}` : null;
  const r = useFeedPoll<UwStockDay[]>(
    key,
    async (): Promise<FeedResult<UwStockDay[]>> => {
      const out: UwStockDay[] = [];
      let last: FeedResult<UwStockDay[]> | null = null;
      for (let i = 0; i < list.length; i += CHUNK) {
        last = await uwStockScreener(list.slice(i, i + CHUNK));
        if (last.ok) out.push(...last.data);
      }
      if (!out.length && last && !last.ok) return last;
      return { ok: true, data: out, at: Date.now() };
    },
    PERIOD_MS
  );
  return useMemo(() => (r?.ok ? new Map(r.data.map(d => [d.ticker.toUpperCase(), d])) : null), [r]);
}
