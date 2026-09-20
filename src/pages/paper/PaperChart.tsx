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
    · a bracket's tag is THREE pills: what the level
      is worth (ticks and dollars, through the
      instrument's own multiplier), what the order
      is, and the × that cancels it — with a dotted
      spine down the lane to the position it
      protects. Hover an unprotected position and
      drag +TP or +SL out of it.
    · right-click anywhere and the TRADE MENU opens
      at that price; pick one and the card appears
      where you clicked. Two of those items open the
      LONG/SHORT TOOL (PositionTool): a plan drawn
      on the tape that becomes one bracketed entry.
    · behind the candles, not over them: the DEALER
      BANDS (gamma, delta or vanna by strike) and,
      in the evaluation, the price this position is
      liquidated at — which trails as it profits.

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
import { X, ChevronDown, ChevronRight, Crosshair, Minus, Plus } from 'lucide-react';
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
  type Logical,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import { candleSeriesOptions, chartSurface, getCandleTheme, useCandleThemeKey } from '../../components/gex/candleTheme';
import { LOCAL_TIME, localTickMarks } from '../../components/gex/chartTime';
import { CALL_WALL, FLIP, PUT_WALL } from '../../components/gex/palette';
import { useResolvedTheme } from '../../theme/theme';
import { tfMinutes, type Timeframe } from '../../data/timeframe';
import { fmtPrice, roundToTick, tagWord, type Instrument } from '../../core/paper/instruments';
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
import { isStopSide, isTargetSide, readLevel } from '../../core/paper/brackets';
import { bandHalfWidth, dealerBook, useImports, type DealerBook, type DealerGreek } from '../../core/paper/dealer';
import { liquidationFor } from '../../core/paper/propFirm';
import { readQueue } from '../../core/paper/queue';
import { useModes } from '../../core/paper/modes';
import { onCrosshair, onRange, publishCrosshair, publishRange, setUserLevels, useUserLevels } from '../../core/paper/workspace';
import type { ExposureExpiry } from '../../types/gex';
import { usePaperPrefs } from '../../core/paper/prefs';
import { BUY_HEX, LEVEL_HEX, Money, ProvenanceChip, SELL_HEX } from './paperKit';
import { OrderEditCard, TradeCard, TradeMenu, type MenuSection, type TradeDraft } from './TradeMenu';
import PositionTool, { type ChartGeo, type PositionPlan } from './PositionTool';

/* ---- one thing on the tape ---------------------------------------------------------------- */
interface TapeItem {
  key: string;
  kind: 'order' | 'position' | 'level' | 'liq';
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
  /** Which pane this is, for the sync bus — panes that share a tab talk through it */
  paneId?: string;
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

const TAG_H = 22;
const TAG_GAP = 2;
/*
  THE FOUR INKS, READ OFF A REAL CHART TRADER.

  A target is green, a stop is ORANGE, the position is blue, and red is kept
  for the two things that are not orders: the live price on the axis and the
  liquidation. That is the assignment TradingView's paper desk uses, and the
  reason for it is the red chip: a red stop line and a red last-price chip on
  the same scale are two different alarms wearing one colour.

  Colouring by SIDE is what these replace — a long's protection is two sell
  orders, so a side-coloured chart painted the target and the stop the same
  red and read as one wall of alarm.
*/
const TARGET_HEX = '#26A69A';
const STOP_HEX = '#FF9800';
const ENTRY_HEX = '#2962FF';
const LIQ_HEX = '#FF5252';
/*
  THE LINE IS SOLID AND IT CROSSES THE WHOLE PANE. It was drawn at a whisper
  here so the candles stayed the subject, and the result was a chart whose
  orders you had to look for. A working order is the most important thing on
  a trading chart; it gets a full-strength hairline, and the candles cope.
*/
const lineInk = (hex: string, kind: TapeItem['kind']): string => (kind === 'level' ? `${hex}99` : hex);
/* A ZONE IS A BAND, NOT A WASH. The book's own half-width is the strike's
   whole territory — on NQ, where a dollar of QQQ is 41 points, that is a third
   of the pane per strike and the tape disappears under it. Each zone is drawn
   at half of that, centred, so the gaps between strikes stay visible and the
   candles are never read through more than one. */
const ZONE_FILL = 0.5;
/** "$2.4B" · "−$840M" — a dealer figure is too big for the money formatter */
const shortMoney = (v: number): string => {
  const a = Math.abs(v);
  const sign = v < 0 ? '−' : '';
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(0)}M`;
  if (a >= 1e3) return `${sign}$${(a / 1e3).toFixed(0)}K`;
  return `${sign}$${a.toFixed(0)}`;
};
/** The P&L pill's ink — tokens, not hexes: this is DOM, not canvas */
const pnlInk = (v: number): string => (v >= 0 ? 'rgb(var(--bull))' : 'rgb(var(--bear))');

const PaperChart = ({ paneId = 'solo', instrument, quote, timeframe, revision, ready, selectedOrderId, onSelectOrder, topInset, apiRef, optionDraftAt, onOpenChain, onOpenSpread, onAlertAt, onToast }: PaperChartProps) => {
  const paper = usePaper();
  const prefs = usePaperPrefs();
  const allLevels = useUserLevels();
  const modes = useModes();
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
  /** The four numbers in the legend — written straight to the DOM, never through React */
  const ohlcRef = useRef<HTMLDivElement | null>(null);
  const lastBarRef = useRef<{ open: number; high: number; low: number; close: number } | null>(null);
  const paintRef = useRef<(b: { open: number; high: number; low: number; close: number } | null) => void>(() => {});
  const itemsRef = useRef<TapeItem[]>([]);
  /** Prices the scale must hold — the position's average and its protection */
  const scalePricesRef = useRef<number[]>([]);
  /*
    ONE MORE PRICE, and only while it is asked for.

    The scale always holds the position and its protection, because those are
    the trade. A WORKING ENTRY is not: a limit half a percent away would
    stretch the pane and squash the candles every time one rested, so it is
    left out. But that is exactly the order whose label parks at the edge, and
    a refit cannot reveal a price the fit was never told to keep. So pressing
    a parked label puts ITS price here for one fit, and the next time the
    reader takes the frame themselves it is let go.
  */
  const revealRef = useRef<number | null>(null);
  const dragRef = useRef<{ key: string; price: number } | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; price: number; order?: Order } | null>(null);
  const [draft, setDraft] = useState<{ at: { x: number; y: number }; draft: TradeDraft } | null>(null);
  const [edit, setEdit] = useState<{ at: { x: number; y: number }; order: Order } | null>(null);
  const [confirmMove, setConfirmMove] = useState<{ at: { x: number; y: number }; order: Order; price: number } | null>(null);
  const [posMenu, setPosMenu] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  /* the bracket pulled out of the position line: a handle dragged to a price */
  const [pull, setPull] = useState<{ kind: 'stop' | 'target'; price: number } | null>(null);
  const pullRef = useRef<{ kind: 'stop' | 'target'; price: number } | null>(null);
  const pullLineRef = useRef<IPriceLine | null>(null);
  const pullHudRef = useRef<HTMLDivElement | null>(null);
  const [hoverPos, setHoverPos] = useState(false);
  /** The reader has taken the frame — the way back shows only then */
  const [touched, setTouched] = useState(false);
  /** the dotted spine from the position's tag to each of its children */
  const spineRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  /** the long/short drawing — a plan, until its button is pressed */
  const [plan, setPlan] = useState<PositionPlan | null>(null);
  const geoRef = useRef<ChartGeo | null>(null);
  /** the tape's own ground, under everything the library draws */
  const groundRef = useRef<HTMLDivElement | null>(null);
  const zonesRef = useRef<HTMLDivElement | null>(null);
  /*
    THE BRACKET IS ONE OBJECT, so it is drawn as one.

    A target line, an entry line and a stop line are three unrelated hairlines
    until something fills the space between them. Every platform that lets you
    drag a bracket shades it: the ground you win on above the entry, the ground
    you lose on below it. That is what makes the thing read as a shape you can
    take hold of rather than three coincidental levels — and it puts the reward
    against the risk as AREA, which is read without arithmetic.
  */
  const profitZoneRef = useRef<HTMLDivElement | null>(null);
  const riskZoneRef = useRef<HTMLDivElement | null>(null);
  const bandRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const liqRef = useRef<HTMLDivElement | null>(null);
  /** set while a synced range is being applied, so it is not published straight back */
  const applyingRef = useRef(false);
  const bookRef = useRef<DealerBook | null>(null);
  const halfRef = useRef(0);
  const liqPriceRef = useRef<number | null>(null);
  const paneRef = useRef(paneId);
  paneRef.current = paneId;
  const topInsetRef = useRef(topInset);
  topInsetRef.current = topInset;

  const orders = useMemo(() => paper.orders.filter(o => o.instrumentId === instrument.id && isLive(o)), [paper.orders, instrument.id]);
  const position = useMemo(() => paper.positions.find(p => p.id === instrument.id && p.qty !== 0) ?? null, [paper.positions, instrument.id]);
  const mark = position ? markPosition(position, quote ?? undefined) : null;
  const quoteRef = useRef(quote);
  quoteRef.current = quote;
  const stopOrder = useMemo(() => orders.find(o => o.role === 'stop') ?? null, [orders]);
  const targetOrder = useMemo(() => orders.find(o => o.role === 'target') ?? null, [orders]);
  /* what the target is worth against what the stop costs, whenever both exist */
  /*
    THE THREE LINES THE DEALER TOGGLE DRAWS, named.

    They were created with a `title` and no label shown, which in this library
    version renders nothing at all — so the pane carried three anonymous
    hairlines a reader could only guess at, and an unnameable line on a
    trading chart is worse than no line. The names ride just inside the price
    axis, where an overlay's label belongs, rather than on the axis itself
    where the wall nearest the market would stack on the last-price chip.
  */
  const dealerLines = useMemo(() => {
    if (!prefs.levels) return [] as { key: string; price: number; hex: string; word: string }[];
    const L = levelsFor(instrument);
    if (!L) return [];
    return [
      { key: 'call', price: L.callWall, hex: CALL_WALL, word: 'Call wall' },
      { key: 'put', price: L.putWall, hex: PUT_WALL, word: 'Put wall' },
      { key: 'flip', price: L.flip, hex: FLIP, word: 'Gamma flip' },
    ].filter(l => Number.isFinite(l.price));
  }, [instrument, prefs.levels, revision]);
  const levelLabelRefs = useRef<Map<string, HTMLSpanElement>>(new Map());
  const dealerRef = useRef(dealerLines);
  dealerRef.current = dealerLines;

  const rr = useMemo(() => {
    if (!position || !stopOrder || !targetOrder) return null;
    const t = targetOrder.limitPrice ?? targetOrder.stopPrice;
    const st = stopOrder.stopPrice ?? stopOrder.limitPrice;
    if (t == null || st == null) return null;
    const reward = Math.abs(t - position.avgPrice);
    const risk = Math.abs(position.avgPrice - st);
    return risk > 0 ? reward / risk : null;
  }, [position, stopOrder, targetOrder]);
  const myLevels = allLevels[instrument.id] ?? [];
  /* the floor trails, so this is read fresh on every tick of the engine's clock */
  const liq = useMemo(() => liquidationFor(instrument.id), [instrument.id, revision, position?.qty, position?.avgPrice]);

  /* THE DEALER BOOK KEEPS ITS OWN SLOW CLOCK. Positioning moves in minutes, not
     ticks, and rebuilding forty bands on every quote would cost more than the
     whole trading layer. Read on the switch, the name, the greek and the
     expiry — and then every few seconds while it is on. */
  const dealerPrefs = prefs.dealer;
  const imports = useImports();
  const [book, setBook] = useState<DealerBook | null>(null);
  useEffect(() => {
    if (!dealerPrefs.on) {
      setBook(null);
      return;
    }
    const read = () => setBook(dealerBook(instrument, dealerPrefs.greek as DealerGreek, dealerPrefs.expiry as ExposureExpiry));
    read();
    const id = window.setInterval(read, 6000);
    return () => window.clearInterval(id);
  }, [dealerPrefs.on, dealerPrefs.greek, dealerPrefs.expiry, instrument, imports, ready]);
  const bandHalf = useMemo(() => (book ? bandHalfWidth(book.levels) : 0), [book]);
  bookRef.current = book;
  halfRef.current = bandHalf;
  liqPriceRef.current = liq?.price ?? null;
  /** the heaviest few, named on the tape */
  const namedLevels = useMemo(() => {
    if (!book || !dealerPrefs.labels) return new Set<number>();
    return new Set([...book.levels].sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 3).map(l => l.strike));
  }, [book, dealerPrefs.labels]);

  /* THE FRAME HOLDS STILL WHILE A TAG IS DRAGGED (the sprint's first rule):
     the canvas pans and zooms under the pointer otherwise, and the price the
     reader is aiming at moves while they aim. Given back on pointer-up. */
  const holdFrame = useCallback((held: boolean) => {
    chartRef.current?.applyOptions({ handleScroll: !held, handleScale: !held });
  }, []);

  /*
    THE LEGEND SAYS WHAT THE BAR DID, not what the strip already said.

    It used to print the last price and the bid × ask — the same three numbers
    the strip above it prints, forty pixels apart. It carries the hovered bar's
    open, high, low and close instead (the last bar's when the pointer is off
    the tape), which is the one thing a chart's legend is for and which nothing
    else on the desk says. Written to the DOM on the crosshair's own events,
    because a render per hovered bar is a render per seven pixels of travel.
  */
  const paintOhlc = useCallback(
    (b: { open: number; high: number; low: number; close: number } | null) => {
      const host = ohlcRef.current;
      if (!host) return;
      const bar = b ?? lastBarRef.current;
      if (!bar) return;
      const put = (k: string, v: string) => {
        const el = host.querySelector<HTMLElement>(`[data-ohlc="${k}"]`);
        if (el && el.textContent !== v) el.textContent = v;
      };
      put('o', fmtPrice(instrument, bar.open));
      put('h', fmtPrice(instrument, bar.high));
      put('l', fmtPrice(instrument, bar.low));
      put('c', fmtPrice(instrument, bar.close));
      const d = bar.close - bar.open;
      const pct = bar.open ? (d / bar.open) * 100 : 0;
      const chg = host.querySelector<HTMLElement>('[data-ohlc="chg"]');
      if (chg) {
        const words = `${d >= 0 ? '+' : ''}${fmtPrice(instrument, d)} (${d >= 0 ? '+' : ''}${pct.toFixed(2)}%)`;
        if (chg.textContent !== words) chg.textContent = words;
        chg.style.color = Math.abs(d) < 1e-9 ? 'rgb(var(--text-muted))' : d > 0 ? 'rgb(var(--bull))' : 'rgb(var(--bear))';
      }
    },
    [instrument]
  );

  /* ---- the chart, once ---- */
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const t = getCandleTheme();
    const s0 = chartSurface(t);
    const chart = createChart(host, {
      autoSize: true,
      /* TRANSPARENT ON PURPOSE: the ground is a div under this canvas, and the
         dealer bands go BETWEEN the two — genuinely behind the candles, the
         grid and the scales, rather than a wash laid over them. */
      layout: { background: { color: 'transparent' }, textColor: s0.text, fontFamily: "'SF Pro', sans-serif", fontSize: 10, attributionLogo: false },
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
        const reveal = revealRef.current;
        const keep = reveal == null ? scalePricesRef.current : [...scalePricesRef.current, reveal];
        if (!base?.priceRange || keep.length === 0) return base;
        let { minValue, maxValue } = base.priceRange;
        let stretched = false;
        for (const p of keep) {
          if (p < minValue) {
            minValue = p;
            stretched = true;
          }
          if (p > maxValue) {
            maxValue = p;
            stretched = true;
          }
        }
        /*
          HEADROOM FOR THE CHROME, when a kept price is what widened the range.

          Fitted exactly, the outermost of these lands ON the pane's edge. The
          top edge is not empty: the legend and the position bar are drawn over
          it, and a label may not sit under them, so one that the fit was meant
          to reveal parks at the boundary and stays unreachable. A flat
          percentage does not fix that either — it has to clear whatever the
          chrome actually measures this frame.

          So the top pad is the height of the chrome plus a label, as a
          fraction of the pane, and the bottom pad is a flat sliver because
          nothing is drawn down there but the clock, which has its own space.
          Only when a KEPT price did the stretching: left alone, the tape's own
          range keeps the library's margins.
        */
        if (stretched) {
          const span = maxValue - minValue || 1;
          const host = hostRef.current;
          const paneH = host ? Math.max(120, host.clientHeight - chart.timeScale().height()) : 400;
          const chrome = topInsetRef.current + (legendRef.current?.offsetHeight ?? 0) + 12 + TAG_H;
          const topFrac = Math.min(0.32, Math.max(0.08, chrome / paneH));
          maxValue += span * topFrac;
          minValue -= span * 0.08;
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
      if (!touchedRef.current) setTouched(true);
      touchedRef.current = true;
      revealRef.current = null;
      chart.priceScale('right').applyOptions({ autoScale: false });
    };
    const freezeOnPan = (e: PointerEvent) => {
      if (e.button === 0) freeze();
    };
    host.addEventListener('wheel', freeze, { passive: true });
    host.addEventListener('pointerdown', freezeOnPan);
    chart.subscribeCrosshairMove(p => {
      const bar = seriesRef.current ? (p.seriesData.get(seriesRef.current) as { open?: number; high?: number; low?: number; close?: number } | undefined) : undefined;
      paintRef.current(bar && bar.open != null ? (bar as { open: number; high: number; low: number; close: number }) : null);
      if (!p.point) {
        cursorPriceRef.current = null;
        publishCrosshair({ from: paneRef.current, time: null });
        return;
      }
      const price = seriesRef.current?.coordinateToPrice(p.point.y);
      cursorPriceRef.current = price == null ? null : Number(price);
      publishCrosshair({ from: paneRef.current, time: typeof p.time === 'number' ? p.time : null });
    });
    /* THE FRAME TRAVELS WITHOUT REACT (workspace.ts's bus): a pan here is
       applied straight to the other panes' chart objects. The flag stops the
       applied range from being published back and the two panes from chasing
       each other around the tape. */
    chart.timeScale().subscribeVisibleLogicalRangeChange(r => {
      if (!r || applyingRef.current) return;
      publishRange({ from: paneRef.current, from_: r.from, to: r.to });
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
    if (groundRef.current) groundRef.current.style.background = s.bg;
    chartRef.current?.applyOptions({
      layout: { background: { color: 'transparent' }, textColor: s.text },
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
    setTouched(false);
    revealRef.current = null;
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
    const tail = bars[bars.length - 1];
    lastBarRef.current = { open: tail.open, high: tail.high, low: tail.low, close: tail.close };
    if (cursorPriceRef.current == null) paintOhlc(null);
  }, [instrument, timeframe, revision, ready, themeKey, paintOhlc]);

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
    /* A LINE NOBODY CAN NAME IS NOISE. These three were drawn with their titles
       set but no label shown, so the pane carried three anonymous hairlines
       that a reader could only guess at. They wear their names now, on the
       line, at the left — and not on the price axis, where the wall nearest
       the market would stack on top of the last-price chip. */
    levelLinesRef.current = spec.map(s =>
      series.createPriceLine({
        price: s.price,
        color: `${s.color}66`,
        lineWidth: s.width,
        lineStyle: s.style,
        axisLabelVisible: false,
        title: s.title,
      })
    );
  }, [instrument, prefs.levels, ready, revision]);

  /* ---- what the other panes are doing ---- */
  useEffect(() => {
    const offCross = onCrosshair(m => {
      const chart = chartRef.current;
      const series = seriesRef.current;
      if (!chart || !series || m.from === paneRef.current) return;
      if (m.time == null) {
        chart.clearCrosshairPosition();
        return;
      }
      /* ONLY THE MOMENT TRAVELS, not the price: what a pane marks is the bar the
         other pane is on, read against ITS OWN tape — an option's premium and
         its underlying share a clock, never a scale. */
      const price = quoteRef.current?.last;
      if (price == null) return;
      chart.setCrosshairPosition(price, m.time as Time, series);
    });
    const offRange = onRange(m => {
      const chart = chartRef.current;
      if (!chart || m.from === paneRef.current) return;
      applyingRef.current = true;
      chart.timeScale().setVisibleLogicalRange({ from: m.from_, to: m.to });
      /* the library fires the change back on the next frame — the flag must outlive it */
      requestAnimationFrame(() => {
        applyingRef.current = false;
      });
    });
    return () => {
      offCross();
      offRange();
    };
  }, []);

  /* ---- what is on the tape: orders, the position, the reader's levels ---- */
  const items = useMemo<TapeItem[]>(() => {
    const out: TapeItem[] = [];
    if (position) {
      out.push({ key: `pos:${position.id}`, kind: 'position', price: position.avgPrice, hex: ENTRY_HEX, style: LineStyle.Solid, width: 1, position });
    }
    for (const o of orders) {
      const price = o.type === 'limit' ? o.limitPrice! : o.type === 'stop' ? o.stopPrice! : null;
      if (price == null) continue;
      const hex = o.role === 'target' ? TARGET_HEX : o.role === 'stop' ? STOP_HEX : o.side === 'buy' ? BUY_HEX : SELL_HEX;
      out.push({ key: `ord:${o.id}`, kind: 'order', price, hex, style: LineStyle.Solid, width: 1, order: o });
    }
    myLevels.forEach((p, i) => out.push({ key: `lvl:${i}:${p}`, kind: 'level', price: p, hex: LEVEL_HEX, style: LineStyle.LargeDashed, width: 1 }));
    /* WHERE THIS POSITION DIES. Only in the evaluation, only while something is
       open, and it MOVES: the floor trails the peak, so a position that makes
       money carries its own liquidation up behind it (propFirm.ts). */
    if (liq) out.push({ key: `liq:${instrument.id}`, kind: 'liq', price: liq.price, hex: LIQ_HEX, style: LineStyle.LargeDashed, width: 1 });
    return out;
  }, [orders, position, myLevels, liq, instrument.id]);
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
      const opts = { price, color: lineInk(it.hex, it.kind), lineWidth: it.width, lineStyle: it.style, axisLabelVisible: it.kind !== 'level', axisLabelColor: it.hex, axisLabelTextColor: '#0a0a0a', title: '' };
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
          /* "BUY 3 @ 17,054.50" and not "B 3" — a fill marker is the record of
             a trade and the price is the whole point of reading it back */
          text: `${f.side === 'buy' ? 'BUY' : 'SELL'} ${f.qty} @ ${fmtPrice(instrument, f.price)}`,
          size: 1,
        });
      }
    }
    marks.sort((a, b) => (a.time as number) - (b.time as number));
    m.setMarkers(marks.slice(-120));
  }, [paper.orders, instrument.id, timeframe, prefs.fillMarks, ready, revision]);

  paintRef.current = paintOhlc;

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
      /* A BRACKET IS ONE THING, SO IT IS DRAWN AS ONE: a 1px dotted spine down
         the lane between the tags and the price axis, from the position's tag
         to each protective child it owns. Nothing in the column moves for it. */
      const at = new Map(placed.map(p => [p.key, p.y]));
      const posY = at.get(itemsRef.current.find(i => i.kind === 'position')?.key ?? '');
      for (const [key, el] of spineRefs.current) {
        const y = at.get(key);
        const sig = posY == null || y == null ? 'off' : `${Math.round(Math.min(posY, y))}|${Math.round(Math.abs(y - posY))}|${axisW}`;
        if (last.get(`sp:${key}`) === sig) continue;
        last.set(`sp:${key}`, sig);
        if (sig === 'off' || posY == null || y == null) {
          el.style.display = 'none';
          continue;
        }
        const h = Math.abs(y - posY);
        el.style.display = h < 4 ? 'none' : 'block';
        el.style.transform = `translateY(${Math.round(Math.min(posY, y))}px)`;
        el.style.height = `${Math.round(h)}px`;
        el.style.left = '4px';
      }
      /* the dealer lines wear their names just inside the axis */
      for (const [key, el] of levelLabelRefs.current) {
        const price = dealerRef.current.find(l => l.key === key)?.price;
        const y = price == null ? null : series.priceToCoordinate(price);
        const sigL = y == null ? 'off' : `${Math.round(y)}|${axisW}`;
        if (last.get(`lvl:${key}`) === sigL) continue;
        last.set(`lvl:${key}`, sigL);
        if (y == null || y < 2 || y > paneH - 2) {
          el.style.display = 'none';
          continue;
        }
        el.style.display = 'block';
        el.style.transform = `translateY(${Math.round(y) - 7}px)`;
        el.style.right = `${axisW + 6}px`;
      }
      /* the bracket's two grounds: entry to target, entry to stop */
      {
        const items = itemsRef.current;
        const pos = items.find(i => i.kind === 'position');
        const legs: [HTMLDivElement | null, TapeItem | undefined][] = [
          [profitZoneRef.current, items.find(i => i.order?.role === 'target')],
          [riskZoneRef.current, items.find(i => i.order?.role === 'stop')],
        ];
        for (const [el, leg] of legs) {
          if (!el) continue;
          if (!pos || !leg) {
            if (el.style.display !== 'none') el.style.display = 'none';
            continue;
          }
          const a = series.priceToCoordinate(pos.price);
          const bq = series.priceToCoordinate(dragRef.current?.key === leg.key ? dragRef.current.price : leg.price);
          if (a == null || bq == null) {
            if (el.style.display !== 'none') el.style.display = 'none';
            continue;
          }
          const top = Math.round(Math.min(a, bq));
          const h = Math.round(Math.abs(bq - a));
          const sigZ = `${top}|${h}`;
          if (last.get(`bz:${el.dataset.bracketZone}`) === sigZ) continue;
          last.set(`bz:${el.dataset.bracketZone}`, sigZ);
          el.style.display = h < 2 ? 'none' : 'block';
          el.style.transform = `translateY(${top}px)`;
          el.style.height = `${h}px`;
        }
      }
      /* THE BANDS ARE THE ONLY THING UNDER THE CANDLES, so they are clipped to
         the pane: a zone must not run under the price axis or the clock. */
      const zones = zonesRef.current;
      if (zones) {
        const sigZ = `${Math.round(axisW)}|${Math.round(paneH)}`;
        if (last.get('zones') !== sigZ) {
          last.set('zones', sigZ);
          zones.style.right = `${Math.round(axisW)}px`;
          zones.style.height = `${Math.round(paneH)}px`;
        }
        for (const [i, el] of bandRefs.current) {
          const lv = bookRef.current?.levels[i];
          if (!lv) continue;
          const half = halfRef.current * ZONE_FILL;
          const top = series.priceToCoordinate(lv.price + half);
          const bot = series.priceToCoordinate(lv.price - half);
          const sigB = top == null || bot == null ? 'off' : `${Math.round(Math.min(top, bot))}|${Math.round(Math.abs(bot - top))}`;
          if (last.get(`bd:${i}`) === sigB) continue;
          last.set(`bd:${i}`, sigB);
          if (sigB === 'off' || top == null || bot == null) {
            el.style.display = 'none';
            continue;
          }
          el.style.display = 'block';
          el.style.transform = `translateY(${Math.round(Math.min(top, bot))}px)`;
          el.style.height = `${Math.max(2, Math.round(Math.abs(bot - top)))}px`;
        }
      }
      /* the watermark rides the liquidation line, wherever the floor has trailed to */
      const liqEl = liqRef.current;
      if (liqEl) {
        const p = liqPriceRef.current;
        const y = p == null ? null : series.priceToCoordinate(p);
        const sigL = y == null ? 'off' : `${Math.round(y)}`;
        if (last.get('liq') !== sigL) {
          last.set('liq', sigL);
          if (y == null) liqEl.style.display = 'none';
          else {
            liqEl.style.display = 'flex';
            liqEl.style.transform = `translateY(${Math.round(y)}px)`;
          }
        }
      }
      /* the read on a bracket being pulled out rides its own line, not the column */
      const hud = pullHudRef.current;
      if (hud) {
        const pl = pullRef.current;
        const y = pl ? series.priceToCoordinate(pl.price) : null;
        const sig = y == null ? 'off' : `${Math.round(y)}|${axisW}`;
        if (last.get('hud') !== sig) {
          last.set('hud', sig);
          if (y == null) hud.style.display = 'none';
          else {
            hud.style.display = 'inline-flex';
            hud.style.transform = `translateY(${Math.round(y - TAG_H / 2)}px)`;
            hud.style.right = `${axisW + 10}px`;
          }
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

  /* WHAT THE DRAWING TOOL IS ALLOWED TO KNOW: the series' own coordinates, and
     permission to hold the frame still. Not the engine, not the account. */
  geoRef.current = {
    priceToY: price => {
      const y = seriesRef.current?.priceToCoordinate(price);
      return y == null ? null : Number(y);
    },
    logicalToX: logical => {
      const x = chartRef.current?.timeScale().logicalToCoordinate(logical as Logical);
      return x == null ? null : Number(x);
    },
    priceAtClientY: clientY => priceAtClientY(clientY),
    logicalAtClientX: clientX => {
      const host = hostRef.current;
      const ts = chartRef.current?.timeScale();
      if (!host || !ts) return null;
      const l = ts.coordinateToLogical(clientX - host.getBoundingClientRect().left);
      return l == null ? null : Number(l);
    },
    paneW: () => Math.max(0, (hostRef.current?.clientWidth ?? 0) - (chartRef.current?.priceScale('right').width() ?? 0)),
    paneH: () => Math.max(0, (hostRef.current?.clientHeight ?? 0) - (chartRef.current?.timeScale().height() ?? 0)),
    hold: holdFrame,
  };

  /** A plan drawn at a price: the bracket's own distances, the reader's size */
  const openPlan = (side: Side, price: number, clientX: number) => {
    const t = instrument.tickSize;
    const dir = side === 'buy' ? 1 : -1;
    const from = Math.round(geoRef.current?.logicalAtClientX(clientX) ?? 0);
    setPlan({
      side,
      entry: roundToTick(instrument, price),
      target: roundToTick(instrument, price + dir * prefs.bracket.targetTicks * t),
      stop: roundToTick(instrument, price - dir * prefs.bracket.stopTicks * t),
      qty: prefs.defaultQty,
      from,
      to: from + 30,
    });
  };

  /* THE PLAN BECOMES ONE ORDER, THE WAY EVERY OTHER ORDER IS MADE: an entry at
     its price carrying its stop and its target (BracketSpec's price form), so
     the protection is attached by the engine the moment the entry fills. */
  const createFromPlan = (p: PositionPlan) => {
    submitOrder({
      instrument,
      side: p.side,
      qty: p.qty,
      type: 'limit',
      limitPrice: p.entry,
      role: 'entry',
      bracket: { stopPrice: p.stop, targetPrice: p.target },
      source: 'chart',
      note: 'position tool',
    });
    setPlan(null);
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
        { key: 'long-tool', label: 'Long position tool', hint: 'Draw the plan, read its R, then place it', onPick: () => openPlan('buy', m.price, m.x) },
        { key: 'short-tool', label: 'Short position tool', hint: 'Draw the plan, read its R, then place it', onPick: () => openPlan('sell', m.price, m.x) },
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
    /* THE TAG OWNS THIS PRESS. Neither the canvas under it nor the browser's
       own drag may see it — an order line is a control, not the chart. */
    e.stopPropagation();
    e.preventDefault();
    if (it.kind === 'order' && it.order) onSelectOrder(it.order.id);
    if (it.kind !== 'order' && it.kind !== 'level') return;
    const el = e.currentTarget;
    /*
      A PARKED TAG IS NOT A DRAG HANDLE, IT IS A WAY BACK TO ITS PRICE.

      A label whose line has left the pane parks at the edge it went out by
      (that is the rule: an order off the screen is still an order). But the
      pointer is then nowhere near the price, so a drag from it read the price
      under the EDGE and moved the order by a tick or two — silently nudging
      something the reader cannot see, which is the worst of the three
      possible behaviours. Nothing at all would be the second worst.

      So pressing a parked tag turns the scale's autofit back on instead. The
      fit already keeps the position and its protection in range
      (autoscaleInfoProvider above), so the order comes back into view and
      becomes draggable in the ordinary way.
    */
    if (el.dataset.off === 'above' || el.dataset.off === 'below') {
      revealRef.current = it.price;
      touchedRef.current = false;
      setTouched(false);
      /* toggling is what makes the fit recompute now; setting it true when it
         is already true is a no-op and the label would stay where it was */
      const scale = chartRef.current?.priceScale('right');
      scale?.applyOptions({ autoScale: false });
      scale?.applyOptions({ autoScale: true });
      onToast?.(`${fmtPrice(instrument, it.price)} was off the pane — the scale has been fitted to bring it back`);
      return;
    }
    el.setPointerCapture(e.pointerId);
    const start = it.price;
    let moved = false;
    dragRef.current = { key: it.key, price: start };
    setDragging(it.key);
    holdFrame(true);
    const protective = it.order && position && (it.order.role === 'stop' || it.order.role === 'target') ? position : null;
    const move = (ev: PointerEvent) => {
      const p = priceAtClientY(ev.clientY);
      if (p == null) return;
      if (p !== start) moved = true;
      dragRef.current = { key: it.key, price: p };
      const line = linesRef.current.get(it.key);
      line?.applyOptions({ price: p });
      const priceEl = el.querySelector<HTMLElement>('[data-tag-price]');
      if (priceEl) priceEl.textContent = fmtPrice(instrument, p);
      /* the pill says what this level is worth AS IT MOVES — ticks and dollars
         through the instrument's own multiplier (brackets.ts), never share money */
      if (protective) {
        const r = readLevel(instrument, protective, p);
        const pill = el.querySelector<HTMLElement>('[data-pnl-pill]');
        const money = el.querySelector<HTMLElement>('[data-tag-pnl]');
        const ticks = el.querySelector<HTMLElement>('[data-tag-ticks]');
        const chip = el.querySelector<HTMLElement>('[data-tag-live]');
        if (money) money.textContent = r.money;
        if (ticks) ticks.textContent = r.tickWords;
        if (chip) chip.textContent = r.money;
        if (pill) pill.style.color = pnlInk(r.pnl);
        /*
          AND THE REWARD AGAINST THE RISK, WHILE THE LEG IS STILL MOVING.

          R:R is the number you are dragging to FIND — you pull the stop until
          the ratio is one you will take. Left to the committed prices it only
          caught up when the pointer came off, which is the one moment it is no
          longer any use. The other leg holds still, so the live ratio is this
          price against that one.
        */
        const other =
          it.order?.role === 'stop'
            ? (targetOrder?.limitPrice ?? targetOrder?.stopPrice ?? null)
            : (stopOrder?.stopPrice ?? stopOrder?.limitPrice ?? null);
        const rrEl = wrapRef.current?.querySelector<HTMLElement>('[data-rr-value]');
        if (rrEl && other != null) {
          const avg = protective.avgPrice;
          const reward = it.order?.role === 'target' ? Math.abs(p - avg) : Math.abs(other - avg);
          const risk = it.order?.role === 'stop' ? Math.abs(avg - p) : Math.abs(avg - other);
          if (risk > 0) {
            const live = reward / risk;
            rrEl.textContent = live.toFixed(2);
            rrEl.style.color = live >= 2 ? TARGET_HEX : live >= 1 ? 'rgb(var(--text-primary))' : STOP_HEX;
          }
        }
      }
    };
    const up = (ev: PointerEvent) => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      const p = dragRef.current?.price ?? start;
      dragRef.current = null;
      setDragging(null);
      holdFrame(false);
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

  /* ---- pulling a bracket out of the position line ----------------------------------------
     The handles sit on the position's tag while the pointer is over it and only
     for the leg it does not have yet. Drag one to a price and that leg is placed
     there; a plain click drops it at the bracket's own distance (prefs). A stop
     dragged ABOVE a long is not a stop, so the price is held one tick on the
     side that makes it one — the engine is never asked for a contradiction. */
  const onPullDown = (kind: 'stop' | 'target') => (e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0 || !position) return;
    e.preventDefault();
    e.stopPropagation();
    const pos = position;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    holdFrame(true);
    const t = instrument.tickSize;
    const dir = pos.qty > 0 ? 1 : -1;
    const away = kind === 'stop' ? -dir : dir;
    const ticks = kind === 'stop' ? prefs.bracket.stopTicks : prefs.bracket.targetTicks;
    const ok = (p: number) => (kind === 'stop' ? isStopSide(pos.qty, pos.avgPrice, p) : isTargetSide(pos.qty, pos.avgPrice, p));
    const clamp = (p: number) => (ok(p) ? p : roundToTick(instrument, pos.avgPrice + away * t));
    let price = roundToTick(instrument, pos.avgPrice + away * ticks * t);
    const show = (p: number) => {
      price = p;
      pullRef.current = { kind, price: p };
      setPull({ kind, price: p });
    };
    show(price);
    const line =
      seriesRef.current?.createPriceLine({
        price,
        color: kind === 'stop' ? STOP_HEX : TARGET_HEX,
        lineWidth: 1,
        lineStyle: kind === 'stop' ? LineStyle.Dotted : LineStyle.Dashed,
        axisLabelVisible: true,
        axisLabelColor: kind === 'stop' ? STOP_HEX : TARGET_HEX,
        axisLabelTextColor: '#0a0a0a',
        title: '',
      }) ?? null;
    pullLineRef.current = line;
    const move = (ev: PointerEvent) => {
      const p = priceAtClientY(ev.clientY);
      if (p == null) return;
      const next = clamp(p);
      line?.applyOptions({ price: next });
      show(next);
    };
    const done = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', done);
      el.removeEventListener('pointercancel', done);
      holdFrame(false);
      if (pullLineRef.current) {
        seriesRef.current?.removePriceLine(pullLineRef.current);
        pullLineRef.current = null;
      }
      pullRef.current = null;
      setPull(null);
      if (kind === 'stop') setStop(instrument.id, price, 'chart');
      else setTarget(instrument.id, price, 'chart');
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', done);
    el.addEventListener('pointercancel', done);
  };

  const cancelConfirmMove = () => {
    if (confirmMove) linesRef.current.get(`ord:${confirmMove.order.id}`)?.applyOptions({ price: confirmMove.order.type === 'limit' ? confirmMove.order.limitPrice! : confirmMove.order.stopPrice! });
    setConfirmMove(null);
  };

  /* ---- the tag, in three parts ------------------------------------------------------------
     [ what it is worth ][ what it is ][ × ] — the sprint's shape. The first pill
     is there only when the level has a position to be measured against, and it
     is the one that carries the direction ink; the second says the order in the
     blotter's own words; the third cancels it. */
  const pnlOf = (it: TapeItem): ReturnType<typeof readLevel> | null => {
    const o = it.order;
    if (!o || !position || (o.role !== 'stop' && o.role !== 'target')) return null;
    return readLevel(instrument, position, it.price);
  };

  /*
    WHAT THE LABEL SAYS, read off a real chart trader.

    It says the SIZE and WHAT THE ORDER IS, and it carries its own cancel. Not
    the price — the price scale draws that, in this same ink, as the chip at
    the end of the line. Not the money either: the position bar over the tape
    keeps the running P&L, and a number that moves on every tick does not
    belong on a label you are trying to drag.

    That is three facts on the chart for one order and no repeats: the label
    says what and how many, the line says where, the axis chip says the price.

    Everything else — the ticks from the average, what it is worth if it
    fills, how much of it has filled, where it stands in the queue — unfurls
    to the RIGHT when the pointer is on it, away from the pane's edge.
  */
  const SEG = 'inline-flex items-center px-1.5';
  const RULE = 'w-px self-stretch my-[3px] bg-current opacity-30';
  /* THE SIZE READS WHITE, the word reads in the line's ink — the reference's
     own split, and the right one: how many is the fact you check at a glance,
     and the colour has already told you which line it is. On the position,
     where the whole label is filled, the type is white throughout. */
  const QTY = `${SEG} font-bold text-textPrimary`;

  /** "Take profit" · "Stop loss" · "Buy limit" — the words a ticket uses */
  const orderWord = (o: Order): string => {
    if (o.role === 'target') return 'Take profit';
    if (o.role === 'stop') return 'Stop loss';
    return `${o.side === 'buy' ? 'Buy' : 'Sell'} ${o.type === 'limit' ? 'limit' : o.type === 'stop' ? 'stop' : 'market'}`;
  };

  /* THE SEGMENTS RUN TOGETHER when anything reads the text rather than the
     picture — a screen reader, a copy, a probe — because they are separate
     spans with a rule between them. So the label carries its own spoken name. */
  const tagSaid = (it: TapeItem): string => {
    if (it.kind === 'position' && it.position) return `${it.position.qty > 0 ? 'Long' : 'Short'} ${Math.abs(it.position.qty)} at ${fmtPrice(instrument, it.price)}`;
    if (it.kind === 'order' && it.order) return `${orderWord(it.order)} ${it.order.qty - it.order.filledQty} at ${fmtPrice(instrument, it.price)}`;
    if (it.kind === 'liq') return `Liquidation at ${fmtPrice(instrument, it.price)}`;
    return `Level at ${fmtPrice(instrument, it.price)}`;
  };

  const tagRest = (it: TapeItem) => {
    if (it.kind === 'position' && it.position) {
      const p = it.position;
      return (
        <>
          <span className={`${SEG} font-bold`}>{Math.abs(p.qty)}</span>
          <span className={RULE} aria-hidden />
          <span className={SEG}>{p.qty > 0 ? 'Long' : 'Short'}</span>
        </>
      );
    }
    if (it.kind === 'order' && it.order) {
      const o = it.order;
      return (
        <>
          <span className={QTY}>{o.qty - o.filledQty}</span>
          <span className={RULE} aria-hidden />
          <span className={SEG}>{orderWord(o)}</span>
        </>
      );
    }
    if (it.kind === 'liq') return <span className={SEG}>Liquidation</span>;
    return <span className={SEG}>Level</span>;
  };

  const tagMore = (it: TapeItem) => {
    if (it.kind === 'position' && it.position && mark) {
      const p = it.position;
      return (
        <>
          <span className="text-textMuted">AVG</span> <span data-tag-price>{fmtPrice(instrument, p.avgPrice)}</span>
          <span className="text-textMuted">BE</span> <span>{fmtPrice(instrument, mark.breakeven)}</span>
        </>
      );
    }
    if (it.kind === 'order' && it.order) {
      const o = it.order;
      const read = pnlOf(it);
      const line = modes.realisticFills && o.type === 'limit' ? readQueue(o.id) : null;
      return (
        <>
          {read && (
            <span data-pnl-pill className="inline-flex items-center gap-1" style={{ color: pnlInk(read.pnl) }} title={`${read.tickWords} from the average — ${read.money} if it fills`}>
              <span data-tag-pnl className="font-semibold">{read.money}</span>
              <span data-tag-ticks className="opacity-70">{read.tickWords}</span>
            </span>
          )}
          {o.filledQty > 0 && (
            <span className="inline-flex items-center gap-1 text-warn" title={`${o.filledQty} of ${o.qty} filled — the rest is working`}>
              <span className="w-1.5 h-1.5 rounded-full bg-warn" /> {o.filledQty}/{o.qty}
            </span>
          )}
          {line && line.left > 0 && (
            <span className="text-textSecondary" data-queue={line.left} title={`EMULATED, not a feed: no data vendor can tell a paper order its place in a real queue — that needs market-by-order plus the exchange's own acknowledgement of your order. This is the desk's model of ${line.ahead} in front of you at this price.`}>
              Q {line.left} <span className="opacity-60">sim</span>
            </span>
          )}
          {o.bracket && o.role === 'entry' && <span className="text-textMuted">BRK</span>}
        </>
      );
    }
    if (it.kind === 'liq') return <><span data-tag-price>{fmtPrice(instrument, it.price)}</span><span className="text-textMuted">{liq && !liq.alone ? 'shared' : 'max drawdown'}</span></>;
    return <span data-tag-price>{fmtPrice(instrument, it.price)}</span>;
  };

  const removeItem = (it: TapeItem) => {
    if (it.kind === 'order' && it.order) cancelOrder(it.order.id, 'chart');
    if (it.kind === 'level') setUserLevels(instrument.id, myLevels.filter(p => p !== it.price));
  };

  return (
    <div ref={wrapRef} className="absolute inset-0" data-paper-chart={instrument.id} data-chart-ink onContextMenu={onContext} onDoubleClick={resetView} onPointerDown={() => onSelectOrder(null)}>
      {/* THE TAPE'S GROUND. The library's own canvas is transparent so the dealer
          bands can sit here — under the candles, the grid and the scales. */}
      <div ref={groundRef} className="absolute inset-0" aria-hidden />
      <div ref={zonesRef} className="absolute left-0 top-0 pointer-events-none overflow-hidden" style={{ right: 0, height: 0 }} data-dealer-zones={book ? book.greek : undefined} aria-hidden={!book}>
        {/* the bracket's two grounds, under the candles with the dealer bands */}
        <div ref={profitZoneRef} data-bracket-zone="profit" className="absolute left-0 right-0" style={{ top: 0, display: 'none', background: `${TARGET_HEX}22` }} />
        <div ref={riskZoneRef} data-bracket-zone="risk" className="absolute left-0 right-0" style={{ top: 0, display: 'none', background: `${STOP_HEX}14` }} />
        {book?.levels.map((lv, i) => (
          <div
            key={`${lv.strike}`}
            ref={el => {
              if (el) bandRefs.current.set(i, el);
              else bandRefs.current.delete(i);
            }}
            data-dealer-band={lv.value >= 0 ? 'pos' : 'neg'}
            className="absolute left-0 right-0"
            style={{ top: 0, display: 'none', background: `${lv.value >= 0 ? CALL_WALL : PUT_WALL}${Math.round((0.04 + lv.heat * 0.16) * 255).toString(16).padStart(2, '0')}` }}
          >
            {namedLevels.has(lv.strike) && (
              <span className="absolute left-1.5 top-0 font-mono text-[8px] uppercase tracking-widest whitespace-nowrap" style={{ color: lv.value >= 0 ? CALL_WALL : PUT_WALL, opacity: 0.75 }}>
                {book.greek} {lv.strike.toLocaleString('en-US')} · {shortMoney(lv.value)}
              </span>
            )}
          </div>
        ))}
      </div>
      <div ref={hostRef} className="absolute inset-0" />
      {/* the watermark: the price the evaluation ends at, said once, quietly */}
      <div ref={liqRef} className="absolute left-0 right-0 z-[9] pointer-events-none items-center gap-2 pl-2 -translate-y-1/2" style={{ top: 0, display: 'none' }} data-liq-watermark aria-hidden>
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-bear/40">Liquidation</span>
        <span className="h-px flex-1 bg-bear/25" />
      </div>

      {/* the legend: the name, the clock, the live tick, the touch */}
      <div ref={legendRef} className="absolute left-2 z-10 pointer-events-none select-none flex flex-col gap-1 font-mono" style={{ top: topInset + 4 }} data-chart-chrome>
        {/*
          THE LEGEND NAMES THE BAR, NOT THE INSTRUMENT.

          The strip directly above this carries the name in the picker that
          CHANGES it, and the position bar directly below carried it a third
          time — three prints of NQZ6 inside fifty-five vertical pixels, with
          the logo twice. A chart says what it is once, at the control that
          sets it. The timeframe went the same way: the strip's own row of
          them already shows which is lit.

          What is left is the only thing here that nothing else says: what the
          bar under the pointer did.
        */}
        <div className="flex items-center gap-1.5" ref={ohlcRef}>
          <span className="inline-flex items-center gap-1 text-[10px] tnum">
            <span className="text-textMuted">O</span>
            <span className="text-textPrimary" data-ohlc="o">—</span>
            <span className="text-textMuted ml-0.5">H</span>
            <span className="text-textPrimary" data-ohlc="h">—</span>
            <span className="text-textMuted ml-0.5">L</span>
            <span className="text-textPrimary" data-ohlc="l">—</span>
            <span className="text-textMuted ml-0.5">C</span>
            <span className="text-textPrimary" data-ohlc="c">—</span>
            <span className="ml-0.5 font-semibold" data-ohlc="chg">—</span>
          </span>
          {quote && <ProvenanceChip quote={quote} />}
        </div>
        {position && mark && (
          <PositionBar
            instrument={instrument}
            position={position}
            markRead={mark}
            hasStop={!!stopOrder}
            hasTarget={!!targetOrder}
            rr={rr}
            onMenu={(x, y) => setPosMenu({ x, y })}
          />
        )}
      </div>

      {/* THE TAGS ARE CONTROLS, SO THEY WIN (the directive: no button may cover
          another). z-30 puts them over the chart's own furniture — the reset
          pill lived at the same right offset as the tag column and swallowed
          the × of any tag parked at the bottom edge. The pill also moved to
          the left edge, where nothing of the trading layer goes. */}
      {plan && <PositionTool instrument={instrument} plan={plan} topInset={topInset} geo={geoRef} onChange={setPlan} onCreate={createFromPlan} onClose={() => setPlan(null)} />}

      <div className="absolute inset-0 pointer-events-none z-30" data-paper-tags>
        {/* the dotted spine, in the lane between the tags and the axis */}
        {position &&
          items
            .filter(i => i.order && (i.order.role === 'stop' || i.order.role === 'target'))
            .map(i => (
              <div
                key={`spine:${i.key}`}
                ref={el => {
                  if (el) spineRefs.current.set(i.key, el);
                  else spineRefs.current.delete(i.key);
                }}
                data-brk-spine={i.order?.role}
                className="absolute pointer-events-none"
                style={{ left: 4, top: 0, display: 'none', width: 0, borderLeft: `1px dotted ${i.hex}`, opacity: 0.6 }}
                aria-hidden
              />
            ))}
        {dealerLines.map(l => (
          <span
            key={l.key}
            ref={el => {
              if (el) levelLabelRefs.current.set(l.key, el);
              else levelLabelRefs.current.delete(l.key);
            }}
            data-level-label={l.key}
            className="absolute top-0 pointer-events-none select-none font-mono text-[8px] font-semibold uppercase tracking-widest whitespace-nowrap"
            style={{ display: 'none', color: l.hex, opacity: 0.8 }}
          >
            {l.word}
          </span>
        ))}
        {items.map(it => {
          const expanded = dragging === it.key || (selectedOrderId != null && it.order?.id === selectedOrderId);
          const bare = it.kind === 'position' && position && (!stopOrder || !targetOrder);
          const grabbable = it.kind === 'order' || it.kind === 'level';
          return (
            <div
              key={it.key}
              ref={el => {
                if (el) tagRefs.current.set(it.key, el);
                else tagRefs.current.delete(it.key);
              }}
              data-tag={it.kind}
              data-tag-key={it.key}
              data-tag-role={it.order?.role}
              data-tag-said={tagSaid(it)}
              role="group"
              aria-label={tagSaid(it)}
              data-open={expanded ? '1' : '0'}
              onPointerDown={onTagDown(it)}
              onPointerEnter={() => it.kind === 'position' && setHoverPos(true)}
              onPointerLeave={() => it.kind === 'position' && setHoverPos(false)}
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
              /* a parked tag is a way back to its price, not a drag handle — and
                 the cursor says which of the two it is at any moment */
              className={`group absolute pointer-events-auto select-none inline-flex items-stretch rounded-[3px] font-mono text-[10px] leading-none tnum whitespace-nowrap data-[off=above]:cursor-pointer data-[off=below]:cursor-pointer ${
                it.kind === 'position' ? 'cursor-pointer' : grabbable ? 'cursor-ns-resize' : 'cursor-default'
              }`}
              style={{ left: 6, height: TAG_H, visibility: 'hidden' }}
              title={
                it.kind === 'order'
                  ? 'Drag to move \u00b7 \u00d7 cancels \u00b7 right-click for more'
                  : it.kind === 'position'
                    ? 'The position \u2014 click for what can be done to it'
                    : it.kind === 'liq'
                      ? 'The evaluation liquidates this position here \u2014 it trails the peak, so it moves'
                      : 'Drag to move \u00b7 \u00d7 removes'
              }
            >
              <span data-conn className="absolute right-0 w-px bg-current opacity-50" style={{ display: 'none', color: it.hex }} aria-hidden />

              {/*
                THE LABEL. Filled for the POSITION, outlined for everything that
                is still only an order \u2014 the distinction a chart trader draws,
                and the one that matters: filled means you are in it.
              */}
              <span
                className="inline-flex items-stretch rounded-[2px] border overflow-hidden"
                style={
                  it.kind === 'position'
                    ? { background: it.hex, borderColor: it.hex, color: '#fff' }
                    : { background: 'rgb(var(--canvas) / 0.82)', borderColor: it.hex, color: it.hex }
                }
              >
                {tagRest(it)}
                <span data-caret className="font-bold self-center pr-1" style={{ display: 'none' }} aria-hidden />
                {/* the cancel, inside the label at its far end, the way the reference draws it */}
                {it.kind !== 'position' && it.kind !== 'liq' && (
                  <>
                    <span className={RULE} aria-hidden />
                    <button
                      type="button"
                      onPointerDown={e => e.stopPropagation()}
                      onClick={e => {
                        e.stopPropagation();
                        removeItem(it);
                      }}
                      aria-label={it.kind === 'order' ? 'Cancel this order' : 'Remove this level'}
                      className="inline-flex items-center justify-center w-[17px] shrink-0 hover:bg-bear/25 transition-colors"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </>
                )}
              </span>

              {/* the handles: over the position, for the leg it has not got */}
              {bare && hoverPos && (
                <span className="inline-flex items-stretch ml-px rounded-[2px] overflow-hidden border bg-canvas/90" style={{ borderColor: `${it.hex}66` }} data-brk-handles>
                  {!targetOrder && (
                    <button
                      type="button"
                      data-pull="target"
                      onPointerDown={onPullDown('target')}
                      onClick={e => e.stopPropagation()}
                      title="Drag out a target \u2014 or click to place it at the bracket's own distance"
                      className="inline-flex items-center gap-0.5 px-1 font-semibold cursor-ns-resize transition-colors hover:bg-bull/20"
                      style={{ color: TARGET_HEX }}
                    >
                      <Plus className="w-2.5 h-2.5" />TP
                    </button>
                  )}
                  {!stopOrder && (
                    <button
                      type="button"
                      data-pull="stop"
                      onPointerDown={onPullDown('stop')}
                      onClick={e => e.stopPropagation()}
                      title="Drag out a stop \u2014 or click to place it at the bracket's own distance"
                      className="inline-flex items-center gap-0.5 px-1 font-semibold cursor-ns-resize transition-colors hover:bg-bear/20 border-l border-borderSubtle"
                      style={{ color: STOP_HEX }}
                    >
                      <Plus className="w-2.5 h-2.5" />SL
                    </button>
                  )}
                </span>
              )}

              {/* THE DETAIL, unfurled to the RIGHT: only under the pointer, while
                  it is dragged, or while it is the order the desk has selected.
                  Rightward because the label is against the pane's left edge now
                  and there is nothing to its left to grow into. */}
              <span
                data-tag-more
                className="hidden group-hover:inline-flex group-data-[open=1]:inline-flex items-center gap-1.5 px-1.5 ml-px rounded-[2px] border bg-canvas/90 backdrop-blur-sm text-textPrimary"
                style={{ borderColor: `${it.hex}66` }}
              >
                {tagMore(it)}
              </span>
            </div>
          );
        })}
        {/* the read on a bracket being pulled out of the position line */}
        <div
          ref={pullHudRef}
          data-pull-hud={pull?.kind ?? ''}
          className="absolute pointer-events-none items-center gap-1.5 h-5 px-1.5 rounded border bg-panel/95 backdrop-blur-sm font-mono text-[10px] tnum shadow-md shadow-black/40 whitespace-nowrap"
          style={{ right: 60, display: 'none', borderColor: pull?.kind === 'stop' ? `${STOP_HEX}88` : `${TARGET_HEX}88` }}
        >
          {pull && position && (
            <>
              <span className={pull.kind === 'stop' ? 'text-bear font-bold' : 'text-bull font-bold'}>{pull.kind === 'stop' ? 'SL' : 'TP'}</span>
              <span className="text-textPrimary">{fmtPrice(instrument, pull.price)}</span>
              <span className="text-textMuted">·</span>
              <span style={{ color: pnlInk(readLevel(instrument, position, pull.price).pnl) }}>{readLevel(instrument, position, pull.price).money}</span>
              <span className="text-textSecondary">{readLevel(instrument, position, pull.price).tickWords}</span>
            </>
          )}
        </div>
      </div>

      {/* BACK TO THE TAPE — only once the reader has left it. A reset control on
          a frame that is already following the market is a button for nothing,
          and it sat on the volume band all day saying so. */}
      {touched && (
        <button
          onClick={resetView}
          title="Back to the live tape (Alt+R, or double-click)"
          data-paper-reset-view
          className="absolute z-20 right-[68px] bottom-8 inline-flex items-center justify-center w-6 h-6 rounded-full border border-borderSubtle bg-panel/80 backdrop-blur-md text-textMuted hover:text-textPrimary transition-colors"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}

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

const PositionBar = ({ instrument, position, markRead, hasStop, hasTarget, rr, onMenu }: { instrument: Instrument; position: Position; markRead: ReturnType<typeof markPosition>; hasStop: boolean; hasTarget: boolean; rr: number | null; onMenu: (x: number, y: number) => void }) => {
  const long = position.qty > 0;
  /* THE BAR'S ONE BIG NUMBER IS THE OPEN P&L. Everything else on it — the
     side, the average, breakeven — is a fact you check once when you enter;
     the money is the one you watch, and it was the same 10px as the rest. */
  const seg = 'inline-flex items-center gap-1 h-7 px-2 font-mono text-[10px] tnum transition-colors hover:bg-ink/[0.07]';
  return (
    <div className="pointer-events-auto inline-flex items-center rounded-md border border-borderSubtle bg-panel/90 backdrop-blur-md overflow-hidden shadow-md shadow-black/40 select-none" data-position-bar>
      <button type="button" onClick={e => onMenu(e.clientX, e.clientY)} title="Close some or all, add, reduce, reverse" className={`${seg} font-bold ${long ? 'text-bull' : 'text-bear'}`}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: long ? BUY_HEX : SELL_HEX }} aria-hidden />
        {long ? 'LONG' : 'SHORT'} {Math.abs(position.qty)}
        <ChevronDown className="w-3 h-3 opacity-70" />
      </button>
      <span className="w-px h-4 bg-borderSubtle" aria-hidden />
      <button type="button" onClick={() => closePosition(instrument.id, 1, 'chart')} title="Close the whole position at the market" className={`${seg} font-semibold`}>
        <Money v={markRead.unrealized} className="text-[15px] font-semibold leading-none" />
      </button>
      <span className="w-px h-4 bg-borderSubtle" aria-hidden />
      <span className={`${seg} hover:bg-transparent cursor-default`} title="Average entry">
        <span className="text-[8px] uppercase tracking-widest text-textMuted">Avg</span> <span className="text-textPrimary">{fmtPrice(instrument, position.avgPrice)}</span>
      </span>
      <span className="w-px h-4 bg-borderSubtle" aria-hidden />
      <button type="button" onClick={() => stopToBreakeven(instrument.id, 'chart')} title="Move the stop to breakeven — the average with the fees on it" className={seg}>
        <span className="text-[8px] uppercase tracking-widest text-textMuted">Breakeven</span> <span className="text-textPrimary">{fmtPrice(instrument, markRead.breakeven)}</span>
      </button>
      {/* THE REWARD AGAINST THE RISK, once the bracket has both legs. The two
          shaded grounds on the pane say it as area; this says it as a number,
          and it is the one figure that decides whether a trade is worth
          taking at all. */}
      {rr != null && (
        <>
          <span className="w-px h-4 bg-borderSubtle" aria-hidden />
          <span
            className={`${seg} hover:bg-transparent cursor-default`}
            data-position-rr={rr.toFixed(2)}
            title={`The target is worth ${rr.toFixed(2)} times what the stop costs`}
          >
            <span className="text-[8px] uppercase tracking-widest text-textMuted">R:R</span>{' '}
            <span data-rr-value className="font-semibold" style={{ color: rr >= 2 ? TARGET_HEX : rr >= 1 ? 'rgb(var(--text-primary))' : STOP_HEX }}>
              {rr.toFixed(2)}
            </span>
          </span>
        </>
      )}
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
