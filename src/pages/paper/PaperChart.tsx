/*
==================================================
  SLAYER TERMINAL - THE TRADING CHART (pages/paper/PaperChart.tsx)

  The chart IS the order ticket. The house tape —
  lightweight-charts on the candle theme every
  other desk draws, the reader's clock, the volume
  band, the dealer levels — with a TRADING LAYER
  over it that is made of controls, not decoration:

    · every working order is a line across the tape
      with a tag at the axis: SELL LMT 3 · 29,900.00
      · ×. The tag DRAGS — up and down is the price,
      live on the axis while it moves — and × cancels.
    · the position is a line at its average with a
      tag that says LONG 3 · +$975.00 · AVG · BE, and
      a bar at the top of the tape with the four
      things a position needs done to it.
    · a stop is dotted, a target dashed, an entry
      dashed too; buys wear the bull green, sells
      the bear red; a partly filled order says so;
      a fill prints a mark on the bar it landed on.
    · right-click anywhere and the TRADE MENU opens
      at that price; pick one and the card appears
      where you clicked.

  THE CHART NEVER TOUCHES THE ACCOUNT. Every
  control here calls the engine (core/paper/engine)
  and then draws what the engine now says.

  Its own chart rather than StrikeChart, on purpose:
  a future's tape and an option's premium tape are
  DERIVED instruments (market.ts), and the trading
  layer needs the series' own coordinates to drag
  a line — neither is something the big chart
  hands out. The theme, the clock, the fonts and
  the crosshair are the house's, imported.
==================================================
*/

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject, type PointerEvent as ReactPointerEvent } from 'react';
import { X, ChevronDown, Crosshair, Minus, Plus, RotateCcw } from 'lucide-react';
import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
  HistogramSeries,
  LineStyle,
  type IChartApi,
  type AutoscaleInfo,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import { candleSeriesOptions, chartSurface, getCandleTheme, useCandleThemeKey } from '../../components/gex/candleTheme';
import { LOCAL_TIME, localTickMarks } from '../../components/gex/chartTime';
import { CALL_WALL, FLIP, PUT_WALL } from '../../components/gex/palette';
import { useResolvedTheme } from '../../theme/theme';
import { tfMinutes, type Timeframe } from '../../data/timeframe';
import CompanyLogo from '../../components/ui/CompanyLogo';
import SpotPrice from '../../components/gex/SpotPrice';
import { fmtMoney, fmtPrice, roundToTick, tagWord, type Instrument } from '../../core/paper/instruments';
import { barsFor, levelsFor, type Quote } from '../../core/paper/market';
import {
  addToPosition,
  cancelAll,
  cancelOrder,
  closePosition,
  isLive,
  markPosition,
  modifyOrder,
  placeBracket,
  reducePosition,
  reversePosition,
  setStop,
  setTarget,
  stopToBreakeven,
  submitOrder,
  typeWord,
  usePaper,
  type Order,
  type Position,
  type Side,
} from '../../core/paper/engine';
import { usePaperPrefs } from '../../core/paper/prefs';
import { BUY_HEX, LEVEL_HEX, Money, ProvenanceChip, SELL_HEX } from './paperKit';
import { OrderEditCard, TradeCard, TradeMenu, type MenuSection, type TradeDraft } from './TradeMenu';

/* ---- the reader's own levels, per instrument ---------------------------------------------- */
const LEVELS_KEY = 'slayer_paper_levels_v1';
function loadLevels(): Record<string, number[]> {
  try {
    const raw = localStorage.getItem(LEVELS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number[]>) : {};
  } catch {
    return {};
  }
}
let userLevels = loadLevels();
const levelListeners = new Set<() => void>();
function setUserLevels(id: string, next: number[]): void {
  userLevels = { ...userLevels, [id]: next };
  try {
    localStorage.setItem(LEVELS_KEY, JSON.stringify(userLevels));
  } catch {
    /* the session keeps them */
  }
  levelListeners.forEach(fn => fn());
}

/* ---- one thing on the tape ---------------------------------------------------------------- */
interface TapeItem {
  key: string;
  kind: 'order' | 'position' | 'level';
  price: number;
  hex: string;
  style: LineStyle;
  width: 1 | 2;
  order?: Order;
  position?: Position;
}

export interface PaperChartApi {
  resetView: () => void;
  /** The price under the pointer, or null when it is off the tape */
  cursorPrice: () => number | null;
  /** Open the trade menu at a price (a hotkey's way in) */
  openCard: (draft: TradeDraft) => void;
}

interface PaperChartProps {
  instrument: Instrument;
  quote: Quote | null;
  timeframe: Timeframe;
  /** Bumps every clock tick */
  revision: number;
  /** The underlying's history is whole */
  ready: boolean;
  selectedOrderId: string | null;
  onSelectOrder: (id: string | null) => void;
  /** Reserved height at the top for the host's strip, px */
  topInset: number;
  apiRef?: MutableRefObject<PaperChartApi | null>;
  /** An option on this tape at a price — the host builds the contract; null when there is no chain here */
  optionDraftAt?: (price: number, right: 'C' | 'P', side: Side) => TradeDraft | null;
  onOpenChain?: () => void;
  onOpenSpread?: () => void;
  onAlertAt?: (price: number) => void;
  onToast?: (words: string) => void;
}

const TAG_H = 20;
const TAG_GAP = 2;

const PaperChart = ({ instrument, quote, timeframe, revision, ready, selectedOrderId, onSelectOrder, topInset, apiRef, optionDraftAt, onOpenChain, onOpenSpread, onAlertAt, onToast }: PaperChartProps) => {
  const paper = usePaper();
  const prefs = usePaperPrefs();
  const themeKey = useCandleThemeKey();
  const appTheme = useResolvedTheme();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const linesRef = useRef<Map<string, IPriceLine>>(new Map());
  const levelLinesRef = useRef<IPriceLine[]>([]);
  const loadedRef = useRef('');
  const barCountRef = useRef(0);
  const touchedRef = useRef(false);
  const cursorPriceRef = useRef<number | null>(null);
  const tagRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const legendRef = useRef<HTMLDivElement | null>(null);
  const itemsRef = useRef<TapeItem[]>([]);
  /** Prices the scale must hold — the position's average and its protection */
  const scalePricesRef = useRef<number[]>([]);
  const dragRef = useRef<{ key: string; price: number } | null>(null);
  const [, bumpLevels] = useState(0);
  const [menu, setMenu] = useState<{ x: number; y: number; price: number; order?: Order } | null>(null);
  const [draft, setDraft] = useState<{ at: { x: number; y: number }; draft: TradeDraft } | null>(null);
  const [edit, setEdit] = useState<{ at: { x: number; y: number }; order: Order } | null>(null);
  const [confirmMove, setConfirmMove] = useState<{ at: { x: number; y: number }; order: Order; price: number } | null>(null);
  const [posMenu, setPosMenu] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const topInsetRef = useRef(topInset);
  topInsetRef.current = topInset;

  useEffect(() => {
    const fn = () => bumpLevels(n => n + 1);
    levelListeners.add(fn);
    return () => {
      levelListeners.delete(fn);
    };
  }, []);

  const orders = useMemo(() => paper.orders.filter(o => o.instrumentId === instrument.id && isLive(o)), [paper.orders, instrument.id]);
  const position = useMemo(() => paper.positions.find(p => p.id === instrument.id && p.qty !== 0) ?? null, [paper.positions, instrument.id]);
  const mark = position ? markPosition(position, quote ?? undefined) : null;
  const myLevels = userLevels[instrument.id] ?? [];

  /* ---- the chart, once ---- */
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const t = getCandleTheme();
    const s0 = chartSurface(t);
    const chart = createChart(host, {
      autoSize: true,
      layout: { background: { color: s0.bg }, textColor: s0.text, fontFamily: "'SF Pro', sans-serif", fontSize: 10, attributionLogo: false },
      localization: LOCAL_TIME,
      grid: { vertLines: { visible: false }, horzLines: { color: s0.grid } },
      rightPriceScale: { borderColor: s0.line, scaleMargins: { top: 0.2, bottom: 0.08 } },
      timeScale: { borderColor: s0.line, timeVisible: true, secondsVisible: false, rightOffset: 8, barSpacing: 7, tickMarkFormatter: localTickMarks },
      crosshair: {
        vertLine: { color: s0.crosshair, labelBackgroundColor: s0.label },
        horzLine: { color: s0.crosshair, labelBackgroundColor: s0.label },
      },
    });
    const series = chart.addSeries(CandlestickSeries, {
      ...candleSeriesOptions(t),
      priceLineVisible: true,
      priceLineColor: 'rgba(237,237,237,0.35)',
      priceLineStyle: LineStyle.SparseDotted,
      /*
        THE POSITION AND ITS PROTECTION ARE ALWAYS ON THE SCREEN.

        A bracket 40 ticks out lands above the bars the tape is drawing, and
        with the library's own range the target's line — and the tag that
        cancels and drags it — sat off the top of the pane where nothing can
        reach them. The scale widens to hold the position's average and its
        stop and target, the way the premium pane widens for its levels.

        Only those: a reader's own far-off limit stays out of it, because
        including a level 5% away would crush the candles into a band. That
        one parks its tag at the edge with a caret instead (the tag loop).
      */
      autoscaleInfoProvider: (orig: () => AutoscaleInfo | null): AutoscaleInfo | null => {
        const base = orig();
        const keep = scalePricesRef.current;
        if (!base?.priceRange || keep.length === 0) return base;
        let { minValue, maxValue } = base.priceRange;
        for (const p of keep) {
          if (p < minValue) minValue = p;
          if (p > maxValue) maxValue = p;
        }
        return { ...base, priceRange: { minValue, maxValue } };
      },
    });
    const volume = chart.addSeries(HistogramSeries, { priceScaleId: 'vol', priceFormat: { type: 'volume' }, lastValueVisible: false, priceLineVisible: false });
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.88, bottom: 0 } });
    chartRef.current = chart;
    seriesRef.current = series;
    volumeRef.current = volume;
    markersRef.current = createSeriesMarkers(series, []);

    /* The frame belongs to the reader after the first touch (the house rule) —
       a wheel, or a left-button press that pans. A right-click is a trade,
       not a hand on the frame, and leaves the scale following the market. */
    const freeze = () => {
      touchedRef.current = true;
      chart.priceScale('right').applyOptions({ autoScale: false });
    };
    const freezeOnPan = (e: PointerEvent) => {
      if (e.button === 0) freeze();
    };
    host.addEventListener('wheel', freeze, { passive: true });
    host.addEventListener('pointerdown', freezeOnPan);
    chart.subscribeCrosshairMove(p => {
      if (!p.point) {
        cursorPriceRef.current = null;
        return;
      }
      const price = seriesRef.current?.coordinateToPrice(p.point.y);
      cursorPriceRef.current = price == null ? null : Number(price);
    });
    return () => {
      host.removeEventListener('wheel', freeze);
      host.removeEventListener('pointerdown', freezeOnPan);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      volumeRef.current = null;
      markersRef.current = null;
      linesRef.current = new Map();
      levelLinesRef.current = [];
      loadedRef.current = '';
    };
  }, []);

  /* ---- the theme, in place ---- */
  useEffect(() => {
    const t = getCandleTheme();
    const s = chartSurface(t);
    seriesRef.current?.applyOptions(candleSeriesOptions(t));
    chartRef.current?.applyOptions({
      layout: { background: { color: s.bg }, textColor: s.text },
      grid: { horzLines: { color: s.grid } },
      rightPriceScale: { borderColor: s.line },
      timeScale: { borderColor: s.line },
      crosshair: { vertLine: { color: s.crosshair, labelBackgroundColor: s.label }, horzLine: { color: s.crosshair, labelBackgroundColor: s.label } },
    });
    loadedRef.current = ''; // repaint the volume inks with the next data pass
  }, [themeKey, appTheme]);

  /* ---- the headroom for the host's strip and the position bar ---- */
  useEffect(() => {
    const host = hostRef.current;
    const h = host?.clientHeight ?? 400;
    const top = Math.min(0.45, Math.max(0.12, (topInset + 44) / Math.max(200, h)));
    chartRef.current?.priceScale('right').applyOptions({ scaleMargins: { top, bottom: 0.08 } });
  }, [topInset, ready]);

  const resetView = useCallback(() => {
    const chart = chartRef.current;
    if (!chart) return;
    touchedRef.current = false;
    chart.priceScale('right').applyOptions({ autoScale: true });
    const len = barCountRef.current;
    chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, len - 140), to: len + 8 });
  }, []);

  /* ---- the tape ---- */
  useEffect(() => {
    const series = seriesRef.current;
    const volume = volumeRef.current;
    const chart = chartRef.current;
    if (!series || !volume || !chart || !ready) return;
    const bars = barsFor(instrument, timeframe);
    if (bars.length === 0) return;
    const t = getCandleTheme();
    const toC = (b: (typeof bars)[number]) => ({ time: b.time as UTCTimestamp, open: b.open, high: b.high, low: b.low, close: b.close });
    const toV = (b: (typeof bars)[number]) => ({ time: b.time as UTCTimestamp, value: b.volume, color: b.close >= b.open ? t.volUp : t.volDown });
    const sig = `${instrument.id}|${timeframe}`;
    const decimals = instrument.tickSize >= 1 ? 0 : Math.min(4, Math.ceil(-Math.log10(instrument.tickSize)));
    if (loadedRef.current !== sig || Math.abs(bars.length - barCountRef.current) > 1) {
      series.applyOptions({ priceFormat: { type: 'price', precision: Math.max(2, decimals), minMove: instrument.tickSize } });
      series.setData(bars.map(toC));
      volume.setData(bars.map(toV));
      if (loadedRef.current.split('|')[0] !== instrument.id || !touchedRef.current) {
        touchedRef.current = false;
        chart.priceScale('right').applyOptions({ autoScale: true });
        chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, bars.length - 140), to: bars.length + 8 });
      }
      loadedRef.current = sig;
    } else {
      const last = bars[bars.length - 1];
      series.update(toC(last));
      volume.update(toV(last));
    }
    barCountRef.current = bars.length;
  }, [instrument, timeframe, revision, ready, themeKey]);

  /* ---- the dealer levels: the walls and the flip, quietly ---- */
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    for (const l of levelLinesRef.current) series.removePriceLine(l);
    levelLinesRef.current = [];
    if (!prefs.levels || !ready) return;
    const L = levelsFor(instrument);
    if (!L) return;
    const spec: { price: number; color: string; title: string; style: LineStyle; width: 1 | 2 }[] = [
      { price: L.callWall, color: CALL_WALL, title: 'CALL WALL', style: LineStyle.Solid, width: 1 },
      { price: L.putWall, color: PUT_WALL, title: 'PUT WALL', style: LineStyle.Solid, width: 1 },
      { price: L.flip, color: FLIP, title: 'FLIP', style: LineStyle.LargeDashed, width: 1 },
    ];
    levelLinesRef.current = spec.map(s =>
      series.createPriceLine({ price: s.price, color: `${s.color}66`, lineWidth: s.width, lineStyle: s.style, axisLabelVisible: false, title: s.title })
    );
  }, [instrument, prefs.levels, ready, revision]);

  /* ---- what is on the tape: orders, the position, the reader's levels ---- */
  const items = useMemo<TapeItem[]>(() => {
    const out: TapeItem[] = [];
    if (position) {
      out.push({ key: `pos:${position.id}`, kind: 'position', price: position.avgPrice, hex: position.qty > 0 ? BUY_HEX : SELL_HEX, style: LineStyle.Solid, width: 1, position });
    }
    for (const o of orders) {
      const price = o.type === 'limit' ? o.limitPrice! : o.type === 'stop' ? o.stopPrice! : null;
      if (price == null) continue;
      out.push({ key: `ord:${o.id}`, kind: 'order', price, hex: o.side === 'buy' ? BUY_HEX : SELL_HEX, style: o.type === 'stop' ? LineStyle.Dotted : LineStyle.Dashed, width: 1, order: o });
    }
    myLevels.forEach((p, i) => out.push({ key: `lvl:${i}:${p}`, kind: 'level', price: p, hex: LEVEL_HEX, style: LineStyle.LargeDashed, width: 1 }));
    return out;
  }, [orders, position, myLevels]);
  itemsRef.current = items;
  scalePricesRef.current = items.filter(i => i.kind === 'position' || i.order?.role === 'stop' || i.order?.role === 'target').map(i => i.price);

  /* the lines follow the items — created, moved, or removed in place */
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    const have = linesRef.current;
    const want = new Set(items.map(i => i.key));
    for (const [key, line] of have) {
      if (!want.has(key)) {
        series.removePriceLine(line);
        have.delete(key);
      }
    }
    for (const it of items) {
      const price = dragRef.current?.key === it.key ? dragRef.current.price : it.price;
      const opts = { price, color: it.kind === 'level' ? 'rgba(237,237,237,0.55)' : it.hex, lineWidth: it.width, lineStyle: it.style, axisLabelVisible: it.kind !== 'level', axisLabelColor: it.hex, axisLabelTextColor: '#0a0a0a', title: '' };
      const cur = have.get(it.key);
      if (cur) cur.applyOptions(opts);
      else have.set(it.key, series.createPriceLine(opts));
    }
  }, [items, ready]);

  /* ---- the fills, printed on the bars they landed on ---- */
  useEffect(() => {
    const m = markersRef.current;
    if (!m) return;
    if (!prefs.fillMarks || !ready) {
      m.setMarkers([]);
      return;
    }
    const bucket = tfMinutes(timeframe) * 60;
    const marks: SeriesMarker<Time>[] = [];
    for (const o of paper.orders) {
      if (o.instrumentId !== instrument.id) continue;
      for (const f of o.fills) {
        if (f.barTime == null) continue;
        const time = (Math.floor(f.barTime / bucket) * bucket) as UTCTimestamp;
        marks.push({
          time,
          position: f.side === 'buy' ? 'belowBar' : 'aboveBar',
          shape: f.side === 'buy' ? 'arrowUp' : 'arrowDown',
          color: f.side === 'buy' ? BUY_HEX : SELL_HEX,
          text: `${f.side === 'buy' ? 'B' : 'S'} ${f.qty}`,
          size: 1,
        });
      }
    }
    marks.sort((a, b) => (a.time as number) - (b.time as number));
    m.setMarkers(marks.slice(-120));
  }, [paper.orders, instrument.id, timeframe, prefs.fillMarks, ready, revision]);

  /* ---- the tags ride the lines: one frame loop, DOM writes only when something moved ---- */
  useEffect(() => {
    let raf = 0;
    const last = new Map<string, string>();
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const series = seriesRef.current;
      const chart = chartRef.current;
      const host = hostRef.current;
      if (!series || !chart || !host) return;
      const axisW = chart.priceScale('right').width();
      const paneH = host.clientHeight - chart.timeScale().height();
      /* The chrome over the tape — the host's strip and the legend rows — is
         not a place for a tag: one that belongs up there sits just under the
         chrome with a hairline down to its line, never under a button */
      const topMin = topInsetRef.current + (legendRef.current?.offsetHeight ?? 0) + 6 + TAG_H / 2;
      const botMax = paneH - TAG_H / 2 - 2;
      const placed: { key: string; y: number; want: number; off: -1 | 0 | 1; el: HTMLDivElement }[] = [];
      for (const it of itemsRef.current) {
        const el = tagRefs.current.get(it.key);
        if (!el) continue;
        const price = dragRef.current?.key === it.key ? dragRef.current.price : it.price;
        const y = series.priceToCoordinate(price);
        if (y == null) {
          if (last.get(it.key) !== 'hidden') {
            el.style.visibility = 'hidden';
            last.set(it.key, 'hidden');
          }
          continue;
        }
        /* AN ORDER OFF THE SCREEN IS STILL AN ORDER (the directive's rule that
           a label repositions rather than disappears): it parks at the edge it
           left by, wearing a caret that says which way its price lies, and its
           × still cancels it. A drag from a parked tag is meaningless, so the
           caret is the reader's cue to scroll to it instead. */
        const offTop = y < topMin;
        const offBottom = y > botMax;
        placed.push({ key: it.key, y: offTop ? topMin : offBottom ? botMax : y, want: y, off: offTop ? -1 : offBottom ? 1 : 0, el });
      }
      /* Tags that would overlap slide apart — the line keeps the true price, a hairline links the two */
      placed.sort((a, b) => a.want - b.want);
      for (let i = 1; i < placed.length; i++) {
        const prev = placed[i - 1];
        if (placed[i].y < prev.y + TAG_H + TAG_GAP) placed[i].y = prev.y + TAG_H + TAG_GAP;
      }
      for (let i = placed.length - 1; i >= 0; i--) {
        const max = paneH - TAG_H / 2;
        if (placed[i].y > max) placed[i].y = max;
        if (i < placed.length - 1 && placed[i].y > placed[i + 1].y - TAG_H - TAG_GAP) placed[i].y = placed[i + 1].y - TAG_H - TAG_GAP;
      }
      for (const p of placed) {
        const slide = Math.round(p.y - p.want);
        const sig = `${Math.round(p.y)}|${slide}|${p.off}|${axisW}`;
        if (last.get(p.key) === sig) continue;
        last.set(p.key, sig);
        p.el.style.visibility = 'visible';
        p.el.style.transform = `translateY(${Math.round(p.y - TAG_H / 2)}px)`;
        p.el.style.right = `${axisW + 6}px`;
        p.el.dataset.off = p.off === 0 ? '' : p.off < 0 ? 'above' : 'below';
        const caret = p.el.querySelector<HTMLElement>('[data-caret]');
        if (caret) {
          caret.style.display = p.off === 0 ? 'none' : 'inline';
          caret.textContent = p.off < 0 ? '↑' : '↓';
        }
        const conn = p.el.querySelector<HTMLElement>('[data-conn]');
        if (conn) {
          /* the hairline only bridges a tag NUDGED off its line, never one parked at an edge */
          if (p.off === 0 && Math.abs(slide) > 2) {
            conn.style.display = 'block';
            conn.style.height = `${Math.abs(slide)}px`;
            conn.style.top = slide > 0 ? `${-Math.abs(slide) + TAG_H / 2}px` : `${TAG_H / 2}px`;
          } else conn.style.display = 'none';
        }
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  /* ---- the api the host reaches for ---- */
  useEffect(() => {
    if (!apiRef) return;
    apiRef.current = {
      resetView,
      cursorPrice: () => cursorPriceRef.current,
      openCard: d => {
        const rect = wrapRef.current?.getBoundingClientRect();
        setDraft({ at: { x: (rect?.left ?? 0) + Math.min(320, (rect?.width ?? 600) * 0.35), y: (rect?.top ?? 0) + 80 }, draft: d });
      },
    };
    return () => {
      apiRef.current = null;
    };
  }, [apiRef, resetView]);

  /* Alt+R resets, Delete cancels the selected order (the drawing tools' keys) */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.altKey && e.code === 'KeyR') {
        e.preventDefault();
        resetView();
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedOrderId) {
        e.preventDefault();
        cancelOrder(selectedOrderId, 'chart');
        onSelectOrder(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [resetView, selectedOrderId, onSelectOrder]);

  /* ---- geometry helpers ---- */
  const priceAtClientY = (clientY: number): number | null => {
    const host = hostRef.current;
    const series = seriesRef.current;
    if (!host || !series) return null;
    const rect = host.getBoundingClientRect();
    const p = series.coordinateToPrice(clientY - rect.top);
    return p == null ? null : roundToTick(instrument, Number(p));
  };

  /* ---- the right-click ---- */
  const onContext = (e: React.MouseEvent) => {
    e.preventDefault();
    const price = priceAtClientY(e.clientY) ?? quote?.last ?? null;
    if (price == null) return;
    setPosMenu(null);
    setMenu({ x: e.clientX, y: e.clientY, price });
  };

  const place = (d: TradeDraft) => {
    submitOrder({ instrument: d.instrument, side: d.side, qty: d.qty, type: d.type, limitPrice: d.type === 'limit' ? d.price : undefined, stopPrice: d.type === 'stop' ? d.price : undefined, source: 'chart' });
  };
  const openDraft = (at: { x: number; y: number }, d: TradeDraft) => setDraft({ at, draft: d });

  const menuSections = (m: { x: number; y: number; price: number; order?: Order }): MenuSection[] => {
    const at = { x: m.x, y: m.y };
    const P = fmtPrice(instrument, m.price);
    const qty = prefs.defaultQty;
    const S = (side: Side, type: 'market' | 'limit' | 'stop') => () => openDraft(at, { instrument, side, type, qty, price: type === 'market' ? undefined : m.price });
    const sections: MenuSection[] = [];
    if (m.order) {
      const o = m.order;
      sections.push({
        title: `${o.side === 'buy' ? 'Buy' : 'Sell'} ${typeWord(o)} ${o.qty - o.filledQty} · ${fmtPrice(instrument, o.type === 'limit' ? o.limitPrice! : o.stopPrice!)}`,
        items: [
          { key: 'order-modify', label: 'Modify order', hint: 'Change its price or size', onPick: () => setEdit({ at, order: o }) },
          { key: 'order-move', label: 'Move to this price', meta: P, hint: 'Drag does the same', onPick: () => modifyOrder(o.id, o.type === 'limit' ? { limitPrice: m.price } : { stopPrice: m.price }, 'chart') },
          { key: 'order-cancel', label: 'Cancel order', danger: true, onPick: () => cancelOrder(o.id, 'chart') },
        ],
      });
    }
    sections.push({
      title: 'Trade',
      items: [
        { key: 'buy-mkt', label: 'Buy market', meta: quote ? fmtPrice(instrument, quote.ask) : undefined, onPick: S('buy', 'market') },
        { key: 'sell-mkt', label: 'Sell market', meta: quote ? fmtPrice(instrument, quote.bid) : undefined, onPick: S('sell', 'market') },
        { key: 'buy-lmt', label: 'Buy limit at', meta: P, onPick: S('buy', 'limit') },
        { key: 'sell-lmt', label: 'Sell limit at', meta: P, onPick: S('sell', 'limit') },
        { key: 'buy-stp', label: 'Buy stop at', meta: P, onPick: S('buy', 'stop') },
        { key: 'sell-stp', label: 'Sell stop at', meta: P, onPick: S('sell', 'stop') },
      ],
    });
    if (position) {
      const dir = position.qty > 0 ? 1 : -1;
      const above = m.price > position.avgPrice;
      /* a level above a long is a target, below it a stop — and the reverse for a short */
      const protectiveHere = (above ? dir > 0 : dir < 0) ? 'target' : 'stop';
      sections.push({
        title: `Position · ${position.qty > 0 ? 'long' : 'short'} ${Math.abs(position.qty)}`,
        items: [
          { key: 'close', label: 'Close position', danger: true, onPick: () => closePosition(instrument.id, 1, 'chart') },
          { key: 'close25', label: 'Close 25%', onPick: () => closePosition(instrument.id, 0.25, 'chart') },
          { key: 'close50', label: 'Close 50%', onPick: () => closePosition(instrument.id, 0.5, 'chart') },
          { key: 'close75', label: 'Close 75%', onPick: () => closePosition(instrument.id, 0.75, 'chart') },
          { key: 'reverse', label: 'Reverse position', onPick: () => reversePosition(instrument.id, 'chart') },
          { key: 'add', label: `Add ${qty} to position`, onPick: () => addToPosition(instrument.id, qty, 'chart') },
          { key: 'reduce', label: `Reduce by ${qty}`, disabled: Math.abs(position.qty) <= 0, onPick: () => reducePosition(instrument.id, qty, 'chart') },
          { key: 'stop-here', label: protectiveHere === 'stop' ? 'Move stop here' : 'Move target here', meta: P, onPick: () => (protectiveHere === 'stop' ? setStop(instrument.id, m.price, 'chart') : setTarget(instrument.id, m.price, 'chart')) },
          { key: 'be', label: 'Move stop to breakeven', meta: mark ? fmtPrice(instrument, mark.breakeven) : undefined, onPick: () => stopToBreakeven(instrument.id, 'chart') },
        ],
      });
    }
    sections.push({
      title: 'Orders',
      items: [
        {
          key: 'bracket',
          label: position ? 'Place bracket' : 'Bracket entry here',
          hint: position ? `A stop and a target ${prefs.bracket.stopTicks}/${prefs.bracket.targetTicks} ticks off the average` : 'A limit at this price with a stop and a target attached',
          meta: position ? undefined : P,
          onPick: () =>
            position
              ? placeBracket(instrument.id, undefined, undefined, 'chart')
              : openDraft(at, { instrument, side: m.price <= (quote?.last ?? m.price) ? 'buy' : 'sell', type: 'limit', qty, price: m.price }),
        },
        {
          key: 'oco',
          label: 'Place OCO',
          hint: position ? 'A stop and a target that cancel each other' : 'Needs a position to protect',
          disabled: !position,
          onPick: () => placeBracket(instrument.id, undefined, undefined, 'chart'),
        },
        { key: 'modify', label: 'Modify order', hint: 'Right-click an order tag, or drag it', disabled: orders.length === 0, onPick: () => (orders[0] ? setEdit({ at, order: orders[0] }) : null) },
        { key: 'cancel-one', label: 'Cancel order', disabled: !selectedOrderId && orders.length === 0, onPick: () => cancelOrder(selectedOrderId ?? orders[0]?.id ?? '', 'chart') },
        { key: 'cancel-all', label: 'Cancel all orders', danger: true, disabled: orders.length === 0, meta: orders.length ? String(orders.length) : undefined, onPick: () => cancelAll(instrument.id, 'chart') },
      ],
    });
    if (optionDraftAt) {
      const opt = (right: 'C' | 'P', side: Side) => () => {
        const d = optionDraftAt(m.price, right, side);
        if (d) openDraft(at, d);
      };
      sections.push({
        title: 'Options',
        items: [
          { key: 'buy-call', label: 'Buy call', hint: 'The strike nearest this price', onPick: opt('C', 'buy') },
          { key: 'buy-put', label: 'Buy put', hint: 'The strike nearest this price', onPick: opt('P', 'buy') },
          { key: 'sell-call', label: 'Sell call', onPick: opt('C', 'sell') },
          { key: 'sell-put', label: 'Sell put', onPick: opt('P', 'sell') },
          { key: 'spread', label: 'Open spread', onPick: () => onOpenSpread?.() },
          { key: 'multi', label: 'Open multi-leg', onPick: () => onOpenSpread?.() },
          { key: 'chain', label: 'Open option chain', onPick: () => onOpenChain?.() },
        ],
      });
    }
    sections.push({
      title: 'Chart',
      items: [
        { key: 'alert', label: 'Set alert', meta: P, disabled: !onAlertAt, onPick: () => onAlertAt?.(m.price) },
        {
          key: 'copy',
          label: 'Copy price',
          meta: P,
          onPick: () => {
            navigator.clipboard?.writeText(String(m.price)).then(() => onToast?.(`${P} copied`)).catch(() => onToast?.('The clipboard is closed'));
          },
        },
        { key: 'level', label: 'Add horizontal level', meta: P, onPick: () => setUserLevels(instrument.id, [...myLevels, m.price]) },
        {
          key: 'remove',
          label: 'Remove drawing',
          hint: 'The level nearest this price',
          disabled: myLevels.length === 0,
          onPick: () => {
            const nearest = myLevels.reduce((b, p) => (Math.abs(p - m.price) < Math.abs(b - m.price) ? p : b), myLevels[0]);
            setUserLevels(instrument.id, myLevels.filter(p => p !== nearest));
          },
        },
        { key: 'reset', label: 'Reset chart', meta: 'Alt+R', onPick: resetView },
      ],
    });
    return sections;
  };

  /* ---- dragging a tag ---- */
  const onTagDown = (it: TapeItem) => (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    if (it.kind === 'order' && it.order) onSelectOrder(it.order.id);
    if (it.kind !== 'order' && it.kind !== 'level') return;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const start = it.price;
    let moved = false;
    dragRef.current = { key: it.key, price: start };
    setDragging(it.key);
    const move = (ev: PointerEvent) => {
      const p = priceAtClientY(ev.clientY);
      if (p == null) return;
      if (p !== start) moved = true;
      dragRef.current = { key: it.key, price: p };
      const line = linesRef.current.get(it.key);
      line?.applyOptions({ price: p });
      const priceEl = el.querySelector<HTMLElement>('[data-tag-price]');
      if (priceEl) priceEl.textContent = fmtPrice(instrument, p);
    };
    const up = (ev: PointerEvent) => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      const p = dragRef.current?.price ?? start;
      dragRef.current = null;
      setDragging(null);
      if (!moved || p === start) {
        linesRef.current.get(it.key)?.applyOptions({ price: start });
        return;
      }
      if (it.kind === 'level') {
        setUserLevels(instrument.id, myLevels.map(x => (x === start ? p : x)));
        return;
      }
      const o = it.order!;
      if (prefs.confirmDrag) {
        setConfirmMove({ at: { x: ev.clientX, y: ev.clientY }, order: o, price: p });
        return;
      }
      modifyOrder(o.id, o.type === 'limit' ? { limitPrice: p } : { stopPrice: p }, 'chart');
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  };

  const cancelConfirmMove = () => {
    if (confirmMove) linesRef.current.get(`ord:${confirmMove.order.id}`)?.applyOptions({ price: confirmMove.order.type === 'limit' ? confirmMove.order.limitPrice! : confirmMove.order.stopPrice! });
    setConfirmMove(null);
  };

  /* ---- the tags' words ---- */
  const tagWords = (it: TapeItem) => {
    if (it.kind === 'position' && it.position && mark) {
      const p = it.position;
      return (
        <>
          <span className="font-bold">{p.qty > 0 ? 'LONG' : 'SHORT'} {Math.abs(p.qty)}</span>
          <span className="text-textMuted">·</span>
          <Money v={mark.unrealized} className="font-semibold" />
          <span className="text-textMuted">·</span>
          <span className="text-textSecondary">AVG</span> <span data-tag-price>{fmtPrice(instrument, p.avgPrice)}</span>
          <span className="text-textMuted">·</span>
          <span className="text-textSecondary">BE</span> <span>{fmtPrice(instrument, mark.breakeven)}</span>
        </>
      );
    }
    if (it.kind === 'order' && it.order) {
      const o = it.order;
      const left = o.qty - o.filledQty;
      return (
        <>
          {o.role === 'stop' && <span className="text-textSecondary">STOP</span>}
          {o.role === 'target' && <span className="text-textSecondary">TARGET</span>}
          <span className="font-bold">
            {o.side === 'buy' ? 'BUY' : 'SELL'} {typeWord(o)} {left}
          </span>
          {o.filledQty > 0 && (
            <span className="inline-flex items-center gap-1 text-warn" title={`${o.filledQty} of ${o.qty} filled — the rest is working`}>
              <span className="w-1.5 h-1.5 rounded-full bg-warn" /> {o.filledQty}/{o.qty}
            </span>
          )}
          <span className="text-textMuted">·</span>
          <span data-tag-price>{fmtPrice(instrument, it.price)}</span>
          {o.bracket && o.role === 'entry' && <span className="text-[8px] px-1 rounded bg-ink/[0.08] text-textSecondary">BRK</span>}
          {o.ocoGroup && o.role !== 'entry' && <span className="text-[8px] px-1 rounded bg-ink/[0.08] text-textSecondary">OCO</span>}
        </>
      );
    }
    return (
      <>
        <span className="text-textSecondary">LEVEL</span>
        <span data-tag-price>{fmtPrice(instrument, it.price)}</span>
      </>
    );
  };

  const removeItem = (it: TapeItem) => {
    if (it.kind === 'order' && it.order) cancelOrder(it.order.id, 'chart');
    if (it.kind === 'level') setUserLevels(instrument.id, myLevels.filter(p => p !== it.price));
  };

  return (
    <div ref={wrapRef} className="absolute inset-0" data-paper-chart={instrument.id} data-chart-ink onContextMenu={onContext} onDoubleClick={resetView} onPointerDown={() => onSelectOrder(null)}>
      <div ref={hostRef} className="absolute inset-0" />

      {/* the legend: the name, the clock, the live tick, the touch */}
      <div ref={legendRef} className="absolute left-2 z-10 pointer-events-none select-none flex flex-col gap-1 font-mono" style={{ top: topInset + 4 }} data-chart-chrome>
        <div className="flex items-center gap-1.5">
          <CompanyLogo ticker={instrument.underlying} size={13} />
          <span className="text-[11px] font-semibold text-textPrimary">{tagWord(instrument)}</span>
          <span className="text-[10px] text-textMuted" aria-hidden>·</span>
          <span className="text-[10px] text-textMuted">{timeframe}</span>
          {quote && (
            <>
              <span className="text-[10px] text-textMuted" aria-hidden>·</span>
              <SpotPrice value={quote.last} className="text-[11px] font-semibold tnum text-textPrimary" />
              <span className="text-[9px] tnum text-textMuted">
                {fmtPrice(instrument, quote.bid)} × {fmtPrice(instrument, quote.ask)}
              </span>
              <ProvenanceChip quote={quote} />
            </>
          )}
        </div>
        {position && mark && (
          <PositionBar
            instrument={instrument}
            position={position}
            markRead={mark}
            hasStop={orders.some(o => o.role === 'stop')}
            hasTarget={orders.some(o => o.role === 'target')}
            onMenu={(x, y) => setPosMenu({ x, y })}
          />
        )}
      </div>

      {/* THE TAGS ARE CONTROLS, SO THEY WIN (the directive: no button may cover
          another). z-30 puts them over the chart's own furniture — the reset
          pill lived at the same right offset as the tag column and swallowed
          the × of any tag parked at the bottom edge. The pill also moved to
          the left edge, where nothing of the trading layer goes. */}
      <div className="absolute inset-0 pointer-events-none z-30" data-paper-tags>
        {items.map(it => (
          <div
            key={it.key}
            ref={el => {
              if (el) tagRefs.current.set(it.key, el);
              else tagRefs.current.delete(it.key);
            }}
            data-tag={it.kind}
            data-tag-key={it.key}
            onPointerDown={onTagDown(it)}
            onContextMenu={e => {
              e.preventDefault();
              e.stopPropagation();
              const price = priceAtClientY(e.clientY) ?? it.price;
              if (it.kind === 'order') setMenu({ x: e.clientX, y: e.clientY, price, order: it.order });
              else if (it.kind === 'position') setPosMenu({ x: e.clientX, y: e.clientY });
              else setMenu({ x: e.clientX, y: e.clientY, price });
            }}
            onClick={e => {
              e.stopPropagation();
              if (it.kind === 'position') setPosMenu({ x: e.clientX, y: e.clientY });
            }}
            className={`absolute pointer-events-auto select-none inline-flex items-center gap-1.5 h-5 pl-1.5 pr-1 rounded border bg-panel/95 backdrop-blur-sm font-mono text-[10px] tnum text-textPrimary shadow-md shadow-black/40 whitespace-nowrap ${
              it.kind === 'position' ? 'cursor-pointer' : 'cursor-ns-resize'
            } ${dragging === it.key ? 'opacity-90' : ''} ${selectedOrderId && it.order?.id === selectedOrderId ? 'ring-1 ring-silver/70' : ''}`}
            style={{ right: 60, visibility: 'hidden', borderColor: `${it.hex}88` }}
            title={it.kind === 'order' ? 'Drag to move · × cancels · right-click for more' : it.kind === 'position' ? 'The position — click for what can be done to it' : 'Drag to move · × removes'}
          >
            <span className="w-[3px] self-stretch rounded-full -ml-0.5" style={{ background: it.hex }} aria-hidden />
            <span data-conn className="absolute left-2 w-px bg-current opacity-50" style={{ display: 'none', color: it.hex }} aria-hidden />
            {tagWords(it)}
            {/* off the pane: which way its price lies */}
            <span data-caret className="font-bold" style={{ display: 'none', color: it.hex }} aria-hidden />
            {it.kind !== 'position' && (
              <button
                type="button"
                onPointerDown={e => e.stopPropagation()}
                onClick={e => {
                  e.stopPropagation();
                  removeItem(it);
                }}
                aria-label={it.kind === 'order' ? 'Cancel this order' : 'Remove this level'}
                className="ml-0.5 inline-flex items-center justify-center w-4 h-4 rounded text-textMuted hover:text-textPrimary hover:bg-ink/[0.1] transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* the reset pill — ResetViewControl's, without its right-click (that is the trade menu's now) */}
      <button
        onClick={resetView}
        title="Reset chart view (Alt+R, double-click)"
        className="absolute z-20 left-2 bottom-8 inline-flex items-center gap-1 px-2 h-6 rounded-full border border-borderSubtle bg-panel/70 backdrop-blur-md font-mono text-[9px] uppercase tracking-wider text-textMuted hover:text-textPrimary opacity-35 hover:opacity-100 transition-opacity"
      >
        <RotateCcw className="w-3 h-3" />
        Reset
      </button>

      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-panel/70 z-20">
          <span className="font-mono text-[10px] uppercase tracking-widest text-textMuted animate-live-breathe">Walking {instrument.underlying}'s history in…</span>
        </div>
      )}

      {menu && <TradeMenu at={menu} sections={menuSections(menu)} onClose={() => setMenu(null)} head={<span className="font-mono text-[10px] tnum text-textSecondary">{tagWord(instrument)} · at <span className="text-textPrimary font-semibold">{fmtPrice(instrument, menu.price)}</span></span>} />}
      {posMenu && position && (
        <TradeMenu
          at={posMenu}
          onClose={() => setPosMenu(null)}
          head={<span className="font-mono text-[10px] text-textSecondary">{position.qty > 0 ? 'Long' : 'Short'} {Math.abs(position.qty)} {tagWord(instrument)} · avg {fmtPrice(instrument, position.avgPrice)}</span>}
          sections={[
            {
              title: 'Position',
              items: [
                { key: 'close', label: 'Close position', danger: true, onPick: () => closePosition(instrument.id, 1, 'chart') },
                { key: 'c25', label: 'Close 25%', onPick: () => closePosition(instrument.id, 0.25, 'chart') },
                { key: 'c50', label: 'Close 50%', onPick: () => closePosition(instrument.id, 0.5, 'chart') },
                { key: 'c75', label: 'Close 75%', onPick: () => closePosition(instrument.id, 0.75, 'chart') },
                { key: 'reverse', label: 'Reverse position', onPick: () => reversePosition(instrument.id, 'chart') },
                { key: 'add', label: `Add ${prefs.defaultQty}`, onPick: () => addToPosition(instrument.id, prefs.defaultQty, 'chart') },
                { key: 'reduce', label: `Reduce by ${prefs.defaultQty}`, onPick: () => reducePosition(instrument.id, prefs.defaultQty, 'chart') },
              ],
            },
            {
              title: 'Protection',
              items: [
                { key: 'bracket', label: orders.some(o => o.role === 'stop' || o.role === 'target') ? 'Re-place the bracket' : 'Place bracket', hint: `${prefs.bracket.stopTicks} ticks of stop, ${prefs.bracket.targetTicks} of target`, onPick: () => placeBracket(instrument.id, undefined, undefined, 'chart') },
                { key: 'be', label: 'Move stop to breakeven', meta: mark ? fmtPrice(instrument, mark.breakeven) : undefined, onPick: () => stopToBreakeven(instrument.id, 'chart') },
                { key: 'cancel', label: 'Cancel its orders', danger: true, disabled: orders.length === 0, onPick: () => cancelAll(instrument.id, 'chart') },
              ],
            },
          ]}
        />
      )}
      {draft && <TradeCard at={draft.at} draft={draft.draft} quote={draft.draft.instrument.id === instrument.id ? quote : paper.quotes[draft.draft.instrument.id] ?? null} onPlace={place} onClose={() => setDraft(null)} />}
      {edit && (
        <OrderEditCard
          at={edit.at}
          inst={instrument}
          side={edit.order.side}
          words={`${edit.order.side === 'buy' ? 'BUY' : 'SELL'} ${typeWord(edit.order)} ${edit.order.qty - edit.order.filledQty}`}
          qty={edit.order.qty - edit.order.filledQty}
          price={edit.order.type === 'limit' ? edit.order.limitPrice! : edit.order.stopPrice!}
          priceLabel={edit.order.type === 'limit' ? 'Limit' : 'Stop'}
          onSave={n => modifyOrder(edit.order.id, { qty: edit.order.filledQty + n.qty, ...(edit.order.type === 'limit' ? { limitPrice: n.price } : { stopPrice: n.price }) }, 'chart')}
          onClose={() => setEdit(null)}
        />
      )}
      {confirmMove && (
        <TradeMenu
          at={confirmMove.at}
          onClose={cancelConfirmMove}
          head={
            <span className="font-mono text-[10px] text-textSecondary">
              Move {confirmMove.order.side === 'buy' ? 'BUY' : 'SELL'} {typeWord(confirmMove.order)} to <span className="text-textPrimary font-semibold tnum">{fmtPrice(instrument, confirmMove.price)}</span>?
            </span>
          }
          sections={[
            {
              title: 'Confirm',
              items: [
                {
                  key: 'yes',
                  label: 'Move it',
                  onPick: () => {
                    modifyOrder(confirmMove.order.id, confirmMove.order.type === 'limit' ? { limitPrice: confirmMove.price } : { stopPrice: confirmMove.price }, 'chart');
                    setConfirmMove(null);
                  },
                },
                { key: 'no', label: 'Keep it where it was', onPick: cancelConfirmMove },
              ],
            },
          ]}
        />
      )}
    </div>
  );
};

/* ---- the position bar: the four things a position needs done to it ------------------------ */

const PositionBar = ({ instrument, position, markRead, hasStop, hasTarget, onMenu }: { instrument: Instrument; position: Position; markRead: ReturnType<typeof markPosition>; hasStop: boolean; hasTarget: boolean; onMenu: (x: number, y: number) => void }) => {
  const long = position.qty > 0;
  const seg = 'inline-flex items-center gap-1 h-6 px-2 font-mono text-[10px] tnum transition-colors hover:bg-ink/[0.07]';
  return (
    <div className="pointer-events-auto inline-flex items-center rounded-md border border-borderSubtle bg-panel/90 backdrop-blur-md overflow-hidden shadow-md shadow-black/40 select-none" data-position-bar>
      <button type="button" onClick={e => onMenu(e.clientX, e.clientY)} title="Close some or all, add, reduce, reverse" className={`${seg} font-bold ${long ? 'text-bull' : 'text-bear'}`}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: long ? BUY_HEX : SELL_HEX }} aria-hidden />
        {long ? 'LONG' : 'SHORT'} {Math.abs(position.qty)} {tagWord(instrument)}
        <ChevronDown className="w-3 h-3 opacity-70" />
      </button>
      <span className="w-px h-4 bg-borderSubtle" aria-hidden />
      <button type="button" onClick={() => closePosition(instrument.id, 1, 'chart')} title="Close the whole position at the market" className={`${seg} font-semibold`}>
        <Money v={markRead.unrealized} />
      </button>
      <span className="w-px h-4 bg-borderSubtle" aria-hidden />
      <span className={`${seg} hover:bg-transparent cursor-default text-textSecondary`} title="Average entry">
        AVG <span className="text-textPrimary">{fmtPrice(instrument, position.avgPrice)}</span>
      </span>
      <span className="w-px h-4 bg-borderSubtle" aria-hidden />
      <button type="button" onClick={() => stopToBreakeven(instrument.id, 'chart')} title="Move the stop to breakeven — the average with the fees on it" className={`${seg} text-textSecondary`}>
        BE <span className="text-textPrimary">{fmtPrice(instrument, markRead.breakeven)}</span>
      </button>
      <span className="w-px h-4 bg-borderSubtle" aria-hidden />
      {!hasStop && (
        <button type="button" onClick={() => placeBracket(instrument.id, undefined, hasTarget ? undefined : undefined, 'chart')} title="A stop under it (and a target over it)" className={`${seg} text-textSecondary hover:text-textPrimary`}>
          <Plus className="w-3 h-3" /> Stop
        </button>
      )}
      {!hasTarget && hasStop && (
        <button type="button" onClick={() => placeBracket(instrument.id, undefined, undefined, 'chart')} title="A target over it" className={`${seg} text-textSecondary hover:text-textPrimary`}>
          <Plus className="w-3 h-3" /> Target
        </button>
      )}
      <button type="button" onClick={() => reversePosition(instrument.id, 'chart')} title="Reverse — close and open the other way" className={`${seg} text-textSecondary hover:text-textPrimary`}>
        <Crosshair className="w-3 h-3" /> Reverse
      </button>
      <button type="button" onClick={() => closePosition(instrument.id, 1, 'chart')} title="Close the position" className={`${seg} text-textSecondary hover:text-bear`}>
        <Minus className="w-3 h-3" /> Close
      </button>
    </div>
  );
};

export default PaperChart;
