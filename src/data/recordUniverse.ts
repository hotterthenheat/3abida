/*
==================================================
  SLAYER TERMINAL - THE RECORD'S UNIVERSE
  (data/recordUniverse.ts)

  The names the Record's feeds can carry until a
  live feed names its own: the sector universe the
  dark-pool leaders file (110 names across the
  eleven sectors), with a stable price for a name
  the simulator is not running.
==================================================
*/

import Simulator from '../core/simulator';
import { h01 } from '../core/rng';
import { SECTOR_UNIVERSE } from './darkpool';
import { tickerName } from './tickers';

export interface RecordName {
  ticker: string;
  sector: string;
}

export const RECORD_UNIVERSE: RecordName[] = SECTOR_UNIVERSE.flatMap(s => s.tickers.map(ticker => ({ ticker, sector: s.sector })));

export const recordName = (ticker: string) => tickerName(ticker);

/** The name's price: the live one when the simulator runs it, else a hash that never jumps between renders */
export function recordPrice(ticker: string): number {
  const live = Simulator.TICKERS[ticker];
  if (live) return live.currentPrice;
  return Number((12 + Math.pow(h01(`rec-px-${ticker}`), 1.6) * 950).toFixed(2));
}
