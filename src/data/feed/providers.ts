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
  theta: {
    name: 'Theta Data',
    plan: 'Professional — stocks, options and indices, through the Theta Terminal on this machine',
    carries: [
      "A name's minute bars, the consolidated tape with extended hours — a month a call",
      'Day bars, years back (its own end-of-day report)',
      'Every contract that quoted on a date, and each contract’s own trades',
      'Index values (SPX, VIX, NDX)',
      'Greeks, implied volatility and open interest by contract',
    ],
    leavesOut: [
      'Company records',
      'Anything while the Theta Terminal is not running on this machine (npm run theta:terminal)',
      'The consolidated tape in real time (fifteen minutes late; Nasdaq Basic is real time)',
    ],
  },
  massive: {
    name: 'Massive',
    plan: 'Basic — Stocks, Options, Indices, Currencies',
    carries: ["Bars to the minute, as of the session before", 'Two years back — a contract’s own minute trades too, expired ones among them', 'The listed contracts and their expiries, as of any day', 'Company records'],
    leavesOut: ['Anything from today', 'Index values (I:SPX, I:VIX) — refused for this key so far (403)', 'Streaming', 'More than about five calls a minute (the terminal queues them)'],
  },
};
