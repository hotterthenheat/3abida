/*
==================================================
  SLAYER TERMINAL - THE CHART'S OWN INDICATORS
  (components/gex/indicatorItems.ts)

  The built-in overlays and panes StrikeChart draws
  from its own maths (data/indicators.ts) — the
  "Chart tools" shelf of the script library, and
  the rows the toolbar used to list. Kept apart from
  the toolbar so the library can read them without
  a circle.
==================================================
*/

import type { ChartIndicators } from './StrikeChart';

export interface IndicatorItem {
  key: keyof ChartIndicators;
  label: string;
  hint: string;
  /** Takes its own pane under the tape (the sub-pane cap applies) */
  sub?: boolean;
}

/* The order is the menu's order: overlays first, then the panes. A pane
   takes height OFF the tape, which is why the sub-panes carry the cap
   (MAX_SUB_PANES), refused in place with the reason. */
export const INDICATOR_ITEMS: IndicatorItem[] = [
  { key: 'ema9', label: 'EMA 9', hint: '9-bar exponential moving average' },
  { key: 'ema21', label: 'EMA 21', hint: '21-bar exponential moving average' },
  { key: 'ema50', label: 'EMA 50', hint: '50-bar exponential moving average' },
  { key: 'sma', label: 'SMA 200', hint: 'The long classic the EMA trio does not cover' },
  { key: 'vwap', label: 'VWAP', hint: 'Volume-weighted average price, session-anchored' },
  { key: 'vwapBands', label: 'VWAP bands', hint: '±1σ and ±2σ around the session VWAP, volume-weighted' },
  { key: 'bb', label: 'Bollinger', hint: 'SMA 20 ± 2σ — the squeeze and the stretch' },
  { key: 'rsi', label: 'RSI 14', hint: 'Wilder momentum, 30/70 rails — its own pane below the tape', sub: true },
  { key: 'macd', label: 'MACD', hint: '12/26 EMAs and their 9-EMA signal, with the histogram', sub: true },
  { key: 'atrPane', label: 'ATR 14', hint: "This pane's bar-to-bar range — its own pane below the tape", sub: true },
];
