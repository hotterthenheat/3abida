/*
==================================================
  SLAYER TERMINAL - THE THEME PREVIEW (components/gex/ThemePreview.tsx)

  Not a swatch — the chart, drawn by the house
  engine in the theme you are hovering (Noah,
  2026-09-11: "i want an actual high quality image
  of the layout on the chart like how we have it
  for the add widgets on pulse"). The Pulse widget
  preview's rule, applied to candles: today's own
  bars on the name the chart is on, the real
  candlestick series and volume, re-inked in place
  as the pointer moves down the list. It cannot
  drift from the product, because it IS the
  product's engine.

  One chart, re-themed — never one per theme:
  twelve live charts in a menu would cost the open.
==================================================
*/

import { useEffect, useRef } from 'react';
import { CandlestickSeries, createChart, HistogramSeries, type IChartApi, type ISeriesApi, type UTCTimestamp } from 'lightweight-charts';
import Simulator from '../../core/simulator';
import { aggregateCandles, tfMinutes, type Timeframe } from '../../data/timeframe';
import { CANDLE_THEMES, candleSeriesOptions, chartSurface, type CandleThemeKey } from './candleTheme';
import { readToken, useResolvedTheme } from '../../theme/theme';
import { LOCAL_TIME, localTickMarks } from './chartTime';

/** How many bars the preview shows — enough shape to judge a palette on */
const BARS = 48;

interface ThemePreviewProps {
  ticker: string;
  timeframe: Timeframe;
  themeKey: CandleThemeKey;
  width?: number;
  height?: number;
}

const ThemePreview = ({ ticker, timeframe, themeKey, width = 352, height = 200 }: ThemePreviewProps) => {
  const appTheme = useResolvedTheme();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const t = CANDLE_THEMES[themeKey];
    const s = chartSurface(t);
    const chart = createChart(host, {
      width,
      height,
      layout: { background: { color: s.bg === 'transparent' ? readToken('--panel', undefined, host) : s.bg }, textColor: s.light ? s.text : '#5a5a5a', fontFamily: "'SF Pro', sans-serif", fontSize: 9, attributionLogo: false },
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
      localization: LOCAL_TIME,
      rightPriceScale: { borderColor: s.line, scaleMargins: { top: 0.08, bottom: 0.18 } },
      timeScale: { borderColor: s.line, timeVisible: true, secondsVisible: false, rightOffset: 2, barSpacing: 6, tickMarkFormatter: localTickMarks },
      crosshair: { vertLine: { visible: false, labelVisible: false }, horzLine: { visible: false, labelVisible: false } },
      handleScroll: false,
      handleScale: false,
    });
    const candles = chart.addSeries(CandlestickSeries, { ...candleSeriesOptions(t), priceLineVisible: false, lastValueVisible: true });
    const volume = chart.addSeries(HistogramSeries, { priceScaleId: 'vol', priceFormat: { type: 'volume' }, lastValueVisible: false, priceLineVisible: false });
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    chartRef.current = chart;
    candlesRef.current = candles;
    volumeRef.current = volume;
    return () => {
      chart.remove();
      chartRef.current = null;
      candlesRef.current = null;
      volumeRef.current = null;
    };
    // The chart is built once; the theme and the bars are applied below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height]);

  /* The bars: the name's own, on the chart's timeframe, the last few dozen */
  useEffect(() => {
    const candles = candlesRef.current;
    const volume = volumeRef.current;
    const chart = chartRef.current;
    if (!candles || !volume || !chart) return;
    const raw = Simulator.getCandles(ticker) ?? [];
    const bars = aggregateCandles(raw, tfMinutes(timeframe)).slice(-BARS);
    const t = CANDLE_THEMES[themeKey];
    candles.setData(bars.map(b => ({ time: b.time as UTCTimestamp, open: b.open, high: b.high, low: b.low, close: b.close })));
    volume.setData(bars.map(b => ({ time: b.time as UTCTimestamp, value: b.volume, color: b.close >= b.open ? t.volUp : t.volDown })));
    chart.timeScale().fitContent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker, timeframe]);

  /* The theme, applied in place — the candles re-ink under the pointer */
  useEffect(() => {
    const candles = candlesRef.current;
    const volume = volumeRef.current;
    const chart = chartRef.current;
    if (!candles || !volume || !chart) return;
    const t = CANDLE_THEMES[themeKey];
    const s = chartSurface(t);
    candles.applyOptions(candleSeriesOptions(t));
    /* The frame's inks too — Stone's preview shows its dark axis, the way the chart will */
    chart.applyOptions({
      layout: { background: { color: s.bg === 'transparent' ? readToken('--panel', undefined, hostRef.current) : s.bg }, textColor: s.light ? s.text : '#5a5a5a' },
      rightPriceScale: { borderColor: s.line },
      timeScale: { borderColor: s.line },
    });
    const raw = Simulator.getCandles(ticker) ?? [];
    const bars = aggregateCandles(raw, tfMinutes(timeframe)).slice(-BARS);
    volume.setData(bars.map(b => ({ time: b.time as UTCTimestamp, value: b.volume, color: b.close >= b.open ? t.volUp : t.volDown })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeKey, appTheme]);

  /* A dark island like every chart (2026-09-12) — the preview's ground is the chart's, not the menu's */
  return <div ref={hostRef} className="rounded border border-borderSubtle overflow-hidden pointer-events-none select-none bg-panel" style={{ width, height }} aria-hidden data-theme-preview={themeKey} data-theme="dark" />;
};

export default ThemePreview;
