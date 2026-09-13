/*
==================================================
  SLAYER TERMINAL - CONTRACT PREMIUM PANE
  The desk chart's CONTRACT lens — and it IS the
  house chart now (Noah, 2026-08-25: "why is the
  premium chart not the same lightweight chart?"):
  the same lightweight-charts engine, the same
  candle theme, the same fonts and crosshair, real
  candles on the reader's chosen interval.

  THE CANDLES ARE DERIVED, HONESTLY. The sim keeps
  no per-bar tape for a contract, but premium is
  MONOTONIC in spot (up for calls, down for puts),
  so pricing the contract at a bar's own O, H, L
  and C gives the bar's true premium extremes —
  max/min of the four IS the high/low, whichever
  right. Nothing is invented beyond what the
  estimator already says.
==================================================
*/

import { useEffect, useRef, type MutableRefObject } from 'react';
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  LineStyle,
  type AutoscaleInfo,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import Simulator from '../../core/simulator';
import { aggregateCandles, tfMinutes, type Timeframe } from '../../data/timeframe';
import { estimatePremium } from '../../data/compass';
import { contractIvFor } from '../../data/weigherDesk';
import { candleSeriesOptions, chartSurface, getCandleTheme, useCandleThemeKey } from './candleTheme';
import { useResolvedTheme } from '../../theme/theme';
import { LOCAL_TIME, localTickMarks } from './chartTime';
import type { OptionRight } from '../../types/compass';
import type { PriceProjection } from './StrikeChart';
import ResetViewControl from './ResetViewControl';

/** Where this pane puts a premium — the chart's own projection (StrikeChart's
    contract) plus the last close, for a neighbour drawing level capsules on
    the same axis (the setup page's rail, 2026-09-12). */
export interface PremiumProjectionApi extends PriceProjection {
  /** The newest bar's close — where NOW is on the axis */
  last(): number | null;
}

/** A labeled rule on the premium tape — a TP, the stop, the reference. */
export interface PremiumLevel {
  price: number;
  label: string;
  color: string;
  style?: 'solid' | 'dashed' | 'dotted';
}

/** A modeled projection drawn past NOW — theta held flat, spot at the stop. */
export interface PremiumProjection {
  key: string;
  color: string;
  dashed?: boolean;
  points: { time: number; value: number }[];
}

interface ContractPremiumPaneProps {
  ticker: string;
  strike: number;
  right: OptionRight;
  /** Years to expiry, fixed at selection — the curve shows the session, not decay */
  tYears: number;
  timeframe: Timeframe;
  revision: number;
  /** The pricing vol. Omitted, the desk's smile (contractIvFor) — the
      campaign passes the SETUP's own iv so the tape and its level lines
      speak one model (the one-generator rule, applied to a chart). */
  iv?: number;
  /** Labeled rules pinned to premiums — TPs, the stop, the reference
      (Noah, 2026-08-29: "with tps, stops being labeled on the chart"). */
  levels?: PremiumLevel[];
  /** Modeled futures drawn past the last bar. */
  projections?: PremiumProjection[];
  /** Fraction of the pane the plot leaves clear at the TOP — callers with
      floating chrome over the tape pass their measured chrome height so no
      candle or level label ever runs under it. Default = the engine's 0.2. */
  topMargin?: number;
  /** Filled with this pane's live projection on mount, nulled on unmount —
      the level rail beside it reads it in its own frame loop. */
  projectionRef?: MutableRefObject<PremiumProjectionApi | null>;
  /** ALWAYS CENTRED (Noah, 2026-09-12: "the first chart should be the options
      chart … make sure its always centered"): while the reader has not touched
      the frame, a resize or a return to this view re-fits the tape and its
      levels to the pane; the first wheel or drag hands the frame to them. */
  visible?: boolean;
}

const LEVEL_STYLE: Record<NonNullable<PremiumLevel['style']>, LineStyle> = {
  solid: LineStyle.Solid,
  dashed: LineStyle.Dashed,
  dotted: LineStyle.SparseDotted,
};

const ContractPremiumPane = ({ ticker, strike, right, tYears, timeframe, revision, iv: ivProp, levels, projections, topMargin, projectionRef, visible = true }: ContractPremiumPaneProps) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const loadedRef = useRef('');
  /** The reader's hand has been on the frame since the last new contract */
  const touchedRef = useRef(false);
  const lastCloseRef = useRef<number | null>(null);
  const linesRef = useRef<IPriceLine[]>([]);
  /* Undocked levels COUNT in the autoscale range (read by the provider
     below): a rule the caller chose to show on-plot must land on the plot,
     not in the margin band where the floating strip lives — a TP just above
     the candle range was rendering its label under the chrome. The caller's
     docking contract still caps how far a wild TP can stretch the scale. */
  const levelPricesRef = useRef<number[]>([]);
  const projSeriesRef = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());
  const projRangeRef = useRef('');
  const barCountRef = useRef(0);
  const themeKey = useCandleThemeKey();
  const appTheme = useResolvedTheme();

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const t = getCandleTheme();
    const s0 = chartSurface(t);
    const chart = createChart(host, {
      autoSize: true,
      layout: {
        background: { color: s0.bg },
        textColor: s0.text,
        fontFamily: "'SF Pro', sans-serif",
        fontSize: 10,
        attributionLogo: false,
      },
      // The reader's clock, not Greenwich's — see chartTime.ts.
      localization: LOCAL_TIME,
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
      rightPriceScale: { borderColor: s0.line },
      timeScale: { borderColor: s0.line, timeVisible: true, secondsVisible: false, rightOffset: 5, barSpacing: 7, tickMarkFormatter: localTickMarks },
      crosshair: {
        vertLine: { color: s0.crosshair, labelBackgroundColor: s0.label },
        horzLine: { color: s0.crosshair, labelBackgroundColor: s0.label },
      },
    });
    const series = chart.addSeries(CandlestickSeries, {
      ...candleSeriesOptions(t),
      priceLineVisible: true,
      priceLineColor: 'rgba(237,237,237,0.4)',
      priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
      autoscaleInfoProvider: (orig: () => AutoscaleInfo | null): AutoscaleInfo | null => {
        const base = orig();
        const lv = levelPricesRef.current;
        if (!base?.priceRange || lv.length === 0) return base;
        let { minValue, maxValue } = base.priceRange;
        for (const p of lv) {
          if (p < minValue) minValue = p;
          if (p > maxValue) maxValue = p;
        }
        return { ...base, priceRange: { minValue, maxValue } };
      },
    });
    /* THE FRAME BELONGS TO THE USER AFTER FIRST TOUCH (ported from
       CampaignChart, 2026-08-30 — Noah: dragging/zooming had "this thing
       thats fighting my cursor... its like its ignoring me completely").
       The library only suspends price autoscale on an AXIS drag; a wheel
       zoom or a pan keeps it on, so every 1s tick re-fit the price scale
       and undid the reader's hand. First wheel/pointer on the chart
       freezes the scale outright. The way back: resetView (the pill,
       right-click card, Alt+R, dbl-click) or a new world re-engages. */
    const freezeScale = () => {
      touchedRef.current = true;
      chart.priceScale('right').applyOptions({ autoScale: false });
    };
    host.addEventListener('wheel', freezeScale, { passive: true });
    host.addEventListener('pointerdown', freezeScale);

    chartRef.current = chart;
    seriesRef.current = series;
    if (projectionRef) {
      projectionRef.current = {
        yFor: price => seriesRef.current?.priceToCoordinate(price) ?? null,
        plotHeight: () => chart.paneSize(0).height,
        axisHeight: () => chart.timeScale().height(),
        last: () => lastCloseRef.current,
      };
    }
    /* STAYS CENTRED: an untouched frame re-fits when the pane changes size —
       the card column narrowing, the sidebar folding, fullscreen — so the
       tape and its levels sit in the middle of whatever room there is. */
    const ro = new ResizeObserver(() => {
      if (touchedRef.current) return;
      const c = chartRef.current;
      if (!c) return;
      c.priceScale('right').applyOptions({ autoScale: true });
      const len = barCountRef.current;
      if (len > 0) c.timeScale().setVisibleLogicalRange({ from: Math.max(0, len - 130), to: len + 5 });
    });
    ro.observe(host);
    return () => {
      ro.disconnect();
      host.removeEventListener('wheel', freezeScale);
      host.removeEventListener('pointerdown', freezeScale);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      loadedRef.current = '';
      if (projectionRef) projectionRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Coming back to this view re-centres an untouched frame (the stacked
     cross-fade keeps both charts mounted, so a view that was hidden while the
     tape grew re-fits on its return) */
  useEffect(() => {
    if (!visible || touchedRef.current) return;
    const c = chartRef.current;
    if (!c) return;
    c.priceScale('right').applyOptions({ autoScale: true });
    const len = barCountRef.current;
    if (len > 0) c.timeScale().setVisibleLogicalRange({ from: Math.max(0, len - 130), to: len + 5 });
  }, [visible]);

  // The caller's reserved headroom, applied live (it changes on resize/wrap)
  useEffect(() => {
    chartRef.current?.priceScale('right').applyOptions({
      scaleMargins: { top: Math.min(0.5, Math.max(0.05, topMargin ?? 0.2)), bottom: 0.1 },
    });
  }, [topMargin]);

  // Recolor in place when the app-wide theme changes — same contract as StrikeChart
  useEffect(() => {
    const t = getCandleTheme();
    seriesRef.current?.applyOptions(candleSeriesOptions(t));
    const s = chartSurface(t);
    chartRef.current?.applyOptions({
      layout: { background: { color: s.bg }, textColor: s.text },
      rightPriceScale: { borderColor: s.line },
      timeScale: { borderColor: s.line },
      crosshair: {
        vertLine: { color: s.crosshair, labelBackgroundColor: s.label },
        horzLine: { color: s.crosshair, labelBackgroundColor: s.label },
      },
    });
  }, [themeKey, appTheme]);

  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;
    const mins = tfMinutes(timeframe);
    const bars = aggregateCandles(Simulator.getCandles(ticker) ?? [], mins);
    if (bars.length === 0) return;
    const iv = ivProp ?? contractIvFor(ticker, strike, right);
    const px = (spot: number) => estimatePremium(spot, strike, right, iv, tYears);
    const pts = bars.map(b => {
      const o = px(b.open);
      const c = px(b.close);
      const a = px(b.high);
      const z = px(b.low);
      return {
        time: b.time as UTCTimestamp,
        open: Number(o.toFixed(2)),
        close: Number(c.toFixed(2)),
        high: Number(Math.max(o, c, a, z).toFixed(2)),
        low: Number(Math.min(o, c, a, z).toFixed(2)),
      };
    });
    barCountRef.current = pts.length;
    lastCloseRef.current = pts[pts.length - 1]?.close ?? null;
    const sig = `${ticker}|${strike}|${right}|${timeframe}|${tYears.toFixed(4)}|${themeKey}`;
    if (loadedRef.current !== sig) {
      series.setData(pts);
      // A new contract is a fresh greeting — autoscale returns with it, and the frame is nobody's yet.
      touchedRef.current = false;
      chart.priceScale('right').applyOptions({ autoScale: true });
      chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, pts.length - 130), to: pts.length + 5 });
      loadedRef.current = sig;
    } else {
      series.update(pts[pts.length - 1]);
    }
  }, [ticker, strike, right, timeframe, tYears, revision, themeKey, ivProp]);

  /* The level rules — recreated whole when they change; lightweight-charts
     price lines carry the label on the line and the price on the axis, which
     is the ask verbatim. */
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    levelPricesRef.current = (levels ?? []).map(l => l.price);
    for (const l of linesRef.current) series.removePriceLine(l);
    linesRef.current = (levels ?? []).map(l =>
      series.createPriceLine({
        price: l.price,
        color: l.color,
        lineWidth: 1,
        lineStyle: LEVEL_STYLE[l.style ?? 'dashed'],
        axisLabelVisible: true,
        title: l.label,
      })
    );
  }, [JSON.stringify(levels)]); // eslint-disable-line react-hooks/exhaustive-deps

  /* The projections — their own thin line series, allowed to run past NOW.
     Series are KEYED AND REUSED: the tape advances every second and each new
     bar shifts every projected timestamp, so this effect runs per tick —
     setData on a held series is a repaint, remove-and-recreate is churn.
     The visible range is pinned only when the projection SHAPE changes
     (mount, retirement, a leg vanishing); repinning per tick would stomp a
     reader's own panning the moment they touched the chart. */
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const want = (projections ?? []).filter(p => p.points.length >= 2);
    const held = projSeriesRef.current;
    for (const [key, line] of held) {
      if (!want.some(p => p.key === key)) {
        chart.removeSeries(line);
        held.delete(key);
      }
    }
    for (const p of want) {
      let line = held.get(p.key);
      if (!line) {
        line = chart.addSeries(LineSeries, {
          color: p.color,
          lineWidth: 1,
          lineStyle: p.dashed === false ? LineStyle.Solid : LineStyle.Dashed,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        held.set(p.key, line);
      }
      line.setData(p.points.map(q => ({ time: q.time as UTCTimestamp, value: Number(q.value.toFixed(2)) })));
    }
    if (want.length > 0) {
      // show: recent history + the whole projected horizon — once per shape
      const extraBars = want.reduce((m, p) => Math.max(m, p.points.length), 0);
      const rangeSig = `${want.map(p => p.key).join(',')}|${extraBars}`;
      if (projRangeRef.current !== rangeSig) {
        projRangeRef.current = rangeSig;
        chart.timeScale().setVisibleLogicalRange({
          from: Math.max(0, barCountRef.current - 90),
          to: barCountRef.current + extraBars + 4,
        });
      }
    }
  }, [projections]);

  /* The greeted view, restorable (Noah, 2026-08-30): autoscale back on and
     the same opening window the load applies — projections widen it exactly
     as they do on first paint. */
  const resetView = () => {
    const chart = chartRef.current;
    if (!chart) return;
    touchedRef.current = false;
    chart.priceScale('right').applyOptions({ autoScale: true });
    const len = barCountRef.current;
    const extraBars = (projections ?? [])
      .filter(p => p.points.length >= 2)
      .reduce((m, p) => Math.max(m, p.points.length), 0);
    chart.timeScale().setVisibleLogicalRange(
      extraBars > 0 ? { from: Math.max(0, len - 90), to: len + extraBars + 4 } : { from: Math.max(0, len - 130), to: len + 5 }
    );
  };

  return (
    <div className="absolute inset-0" data-chart-ink>
      <div ref={hostRef} className="absolute inset-0" />
      <ResetViewControl onReset={resetView} />
    </div>
  );
};

export default ContractPremiumPane;
