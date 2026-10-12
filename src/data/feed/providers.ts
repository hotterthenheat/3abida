/*
==================================================
  SLAYER TERMINAL - THE VENDORS, AS SETTINGS SAYS THEM (data/feed/providers.ts)

  What each plan carries and leaves out, in the house's
  words, for Settings › Data sources.
==================================================
*/

import type { FeedProvider } from './client';

export interface ProviderInfo {
  name: string;
  plan: string;
  carries: string[];
  leavesOut: string[];
}

export const PROVIDER_INFO: Record<FeedProvider, ProviderInfo> = {
  uw: {
    name: 'Unusual Whales',
    plan: 'API Basic',
    carries: [
      'Options flow and the option tape as it prints, asked for every few seconds',
      'Nasdaq prices in real time',
      'Dark pool prints, net premium, Market Tide',
      'Spot exposure by strike, open interest daily (FLEX too)',
      'Congress and insider filings, earnings',
      'Two years back',
    ],
    leavesOut: ["SPX's market-maker exposure by the minute", 'Streaming (every room asks on a timer)', 'The premium routes', 'CME futures'],
  },
  massive: {
    name: 'Massive',
    plan: 'Basic — Stocks, Options, Indices, Currencies',
    carries: ["Bars to the minute, as of the session before", 'The listed contracts and their expiries', 'Company records'],
    leavesOut: ['Anything from today', 'Index values (I:SPX, I:VIX) — refused for this key so far (403)', 'Streaming', 'More than about five calls a minute (the terminal queues them)'],
  },
};
