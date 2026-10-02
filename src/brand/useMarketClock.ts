/*
==================================================
  SLAYER TERMINAL - THE MARKET'S CLOCK (brand/useMarketClock.ts)

  "New York 1:42 PM" — the market's own clock, beside the signature on the landing's first screen (2026-10-02, from the
  owner's notes on two landings that keep a live clock as the proof the page is now). The time is New York's, where the
  market keeps its hours, whatever zone the reader is in — the same reading the signature's live and closed come from
  (data/marketState.ts). It moves on with the minute, on the minute.
==================================================
*/

import { useEffect, useState } from 'react';

const FORMAT = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' });

/** New York's time now, "1:42 PM" */
export const newYorkTime = (at: Date = new Date()): string => FORMAT.format(at);

/** New York's time, kept current on the minute */
export function useMarketClock(): string {
  const [now, setNow] = useState(() => newYorkTime());
  useEffect(() => {
    let id = 0;
    const tick = () => {
      setNow(newYorkTime());
      id = window.setTimeout(tick, 60_000 - (Date.now() % 60_000) + 30);
    };
    id = window.setTimeout(tick, 60_000 - (Date.now() % 60_000) + 30);
    return () => window.clearTimeout(id);
  }, []);
  return now;
}
