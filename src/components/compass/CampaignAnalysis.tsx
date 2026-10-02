/*
==================================================
  SLAYER TERMINAL - CAMPAIGN ANALYSIS (Compass)
  Full analysis for the slow scanners: the campaign
  on a live chart. TP1–TP4 underlying milestones and
  the calculated floor are drawn on the candles
  (TradingView's lightweight-charts — the house
  engine), with the premium ladder, thesis and floor
  rule alongside. States, never orders.
==================================================
*/

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
  HistogramSeries,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type IPriceLine,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import { AlertTriangle, ArrowUpRight, Bookmark, Check, Info, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Simulator from '../../core/simulator';
import { chartGround, getCandleTheme, useCandleThemeKey, candleSeriesOptions, chartSurface } from '../gex/candleTheme';
import { useIsPhone } from '../ui/useMediaQuery';
import { useResolvedTheme } from '../../theme/theme';
import { LOCAL_TIME, localTickMarks } from '../gex/chartTime';
import ChartToolbar from '../gex/ChartToolbar';
import ResetViewControl from '../gex/ResetViewControl';
import { DEFAULT_OVERLAYS, type ChartOverlays } from '../gex/StrikeChart';
import { CALL_WALL, PUT_WALL, FLIP, SUPREME } from '../gex/palette';
import { TIMEFRAMES, tfMinutes, aggregateCandles, type Timeframe } from '../../data/timeframe';
import { buildLevelsFor } from '../../data/gex';
import CardTabs from '../ui/CardTabs';
import SignalBadge from '../ui/SignalBadge';
import AnimatedNumber from '../ui/AnimatedNumber';
import RichRead from '../ui/RichRead';
import CompanyLogo from '../ui/CompanyLogo';
import GuideFocus, { GuideDoor } from '../ui/GuideFocus';
import { Fact } from '../trace/TraceBox';
import GreeksRow from './GreeksRow';
import ContractFacts from './ContractFacts';
import { processState, PROCESS_META } from './setupProcess';
import { SetupGuide } from './SetupGuide';
import ContractTrack from './ContractTrack';
import SetupDrivers from './SetupDrivers';
import { buildCompassView, buildSetupDrivers, estimatePremium, gradeOfConfidence } from '../../data/compass';
import GradeMeter, { GRADE_INK } from '../ui/GradeMeter';
import ContractPick, { type ConPickRow } from './ContractPick';
import { SetupMarksPrimitive, type SetupMarks } from './setupMarksPrimitive';
import { CardRow, PointerFollowCard } from '../ui/PointerCard';
import { resolveInk } from '../gex/paletteInk';
import { spotForPremium } from './trackModel';
import { useFadeClose } from '../ui/useFadeClose';
import { useTracker } from '../../context/TrackerContext';
import {
  SCANNERS,
  SLEEVES,
  isScannerEligible,
  type DriverRow,
  type OptionRight,
  type ScannerKey,
  type Setup,
  type SleeveKey,
} from '../../types/compass';
import { FONT_SANS } from '../../theme/fonts';

let lastChartView: 'stock' | 'premium' = 'stock';

/* The lens said out loud (Noah, 2026-08-30: cards "dont state wether
   something is a 0dte, weekly, discounted etc so they all look the same...
   'oh it says right here this is a weekly'"). */
const SLEEVE_LABEL: Record<SleeveKey, string> = { odte: '0DTE', weekly: 'Weekly', swing: 'Swing', leaps: 'LEAPS' };

interface CampaignAnalysisProps {
  setup: Setup;
  /** Bumps every simulator tick — drives incremental candle updates */
  revision: number;
  /** The underlying, live — the facts strip and ladder inversions speak in it */
  spot: number;
  /** The lens that graded this setup — tracking files under it */
  scanner: ScannerKey;
  /** The tenor — it decides which exit-clock copy the floor panel speaks */
  sleeve: SleeveKey;
  /** Provenance: when this page opened — the numbers that earned the click are frozen from then */
  gradedAt?: string;
  /** Open another contract on the same name — a driver row, or the capsule's
      pick (which may carry a different tenor). The page's route does the rest
      (pages/compass/SetupPage.tsx, 2026-09-11); the way back lives there too. */
  onOpenContract?: (strike: number, right: OptionRight, sleeve?: SleeveKey) => void;
}

/** The driver list sweeps on the scan tier — structure must not vibrate with every tick. */
const DRIVERS_SCAN_MS = 10_000;

/** The campaign's story, stamped ON the tape (Noah's sketch, 2026-08-09):
    the entry premium on the bar it was graded, and each banked TP on the
    candle that actually crossed it. */
export interface CampaignEntry {
  /** Bar time (UTC seconds) of the sweep that opened this review */
  time: number;
  /** The graded mid — frozen at open, like the provenance line */
  mid: number;
}
export interface CampaignHit {
  /** TP rung, 1-based */
  level: number;
  /** Bar time (UTC seconds) of the candle that crossed the target */
  time: number;
}
export interface CampaignBreak {
  /** Bar time (UTC seconds) of the candle that CLOSED through the floor */
  time: number;
  /** That bar's close */
  price: number;
  /** The floor as it stood when it broke — frozen for the post-mortem */
  floor: number;
}

interface CampaignChartProps {
  setup: Setup;
  revision: number;
  entry: CampaignEntry | null;
  hits: CampaignHit[];
  brk: CampaignBreak | null;
  timeframe: Timeframe;
  overlays: ChartOverlays;
  /** Fraction of the pane the plot leaves clear at the TOP — the floating
      chrome strip lives there. Measured by the caller; default engine 0.2. */
  topMargin?: number;
}

/** Campaign chart preferences — persisted like Pulse's ('slayer_chart_overlays'
    is Pulse's key; the campaign map keeps its own diet). Trails and dark pool
    are deliberately NOT offered here: whole-market texture drowns a one-trade
    story. Volume is on by default; structural levels are opt-in axis chips. */
const CAMPAIGN_CHART_LS = 'slayer_campaign_chart';
/* Built FROM the chart's own defaults so a new overlay cannot silently
   arrive switched on here — the campaign map keeps its narrow diet. */
const CAMPAIGN_OVERLAY_DEFAULTS: ChartOverlays = {
  ...DEFAULT_OVERLAYS,
  trails: false,
  levels: false,
  darkpool: false,
  volume: true,
  flow: false,
  netDrift: false,
  volDrift: false,
  dexStrike: false,
  session: false,
  cone: false,
  events: false,
};
const loadChartPrefs = (): { timeframe: Timeframe; overlays: ChartOverlays } => {
  try {
    const raw = localStorage.getItem(CAMPAIGN_CHART_LS);
    if (raw) {
      const p = JSON.parse(raw) as Partial<{ timeframe: Timeframe; overlays: Partial<ChartOverlays> }>;
      return {
        timeframe: TIMEFRAMES.some(t => t.value === p.timeframe) ? (p.timeframe as Timeframe) : '1m',
        overlays: { ...CAMPAIGN_OVERLAY_DEFAULTS, ...(p.overlays && typeof p.overlays === 'object' ? p.overlays : {}) },
      };
    }
  } catch {
    /* corrupted prefs fall back to defaults */
  }
  return { timeframe: '1m', overlays: { ...CAMPAIGN_OVERLAY_DEFAULTS } };
};

/** Candles with the setup drawn on them: the targets still to be won (green, dashed), the floor (red). */
const CampaignChart = ({ setup, revision, entry, hits, brk, timeframe, overlays, topMargin }: CampaignChartProps) => {
  const themeKey = useCandleThemeKey();
  const appTheme = useResolvedTheme();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const linesRef = useRef<IPriceLine[]>([]);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  /* THE SETUP'S MARKS (2026-09-28): the entry rule, the floor rule and the target ladder at the right edge, drawn on
     the chart's own canvas (setupMarksPrimitive.ts) — no full-width lines, no axis capsules, no words over candles */
  const marksRef = useRef<SetupMarksPrimitive | null>(null);
  const marksDataRef = useRef<SetupMarks | null>(null);
  const lastCloseRef = useRef<number | null>(null);
  const [card, setCard] = useState<{ kind: string; price: number; x: number; y: number } | null>(null);
  /** Structural level chips (CW/PW/flip/supreme) — separate from the campaign's
      own TP/floor lines so the two layers never fight over one ref. */
  const structLinesRef = useRef<IPriceLine[]>([]);
  /** Levels the OPENING view must include — read by the candle series'
      autoscale provider, updated when the setup changes. EVERY campaign
      line rides here (all TPs + the floor), not just TP1: a price line
      above the fitted range lands in the top margin — the exact band the
      floating chrome reserves — so TP3's label was riding the toolbar
      (Noah's screenshot, 2026-08-30). Inside the range, the measured
      headroom keeps the topmost line below the chrome. */
  const scaleLevelsRef = useRef<number[]>([]);
  /** Which setup the chart last framed itself for — the ONLY trigger that
      may re-engage autoscale. Values drift per tick; identity doesn't. */
  const framedForRef = useRef<string | null>(null);
  const loadedRef = useRef<{ ticker: string; tf: string; length: number }>({ ticker: '', tf: '', length: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const s0 = chartSurface(getCandleTheme());
    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { color: s0.bg },
        // The quiet axis ink on the dark family; its dark cut on a light ground
        textColor: s0.light ? s0.text : '#5a5a5a',
        fontFamily: FONT_SANS,
        fontSize: 10,
        attributionLogo: false,
      },
      /* No grid at all (Noah, 2026-08-29: "remove the tradingview like
         horizontal lines... that look like a grid layout") — the tape's
         only lines are the campaign's own rules. */
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
      // The reader's clock, not Greenwich's — see chartTime.ts.
      localization: LOCAL_TIME,
      rightPriceScale: { borderColor: s0.line },
      timeScale: { borderColor: s0.line, timeVisible: true, secondsVisible: false, rightOffset: 4, barSpacing: 6, tickMarkFormatter: localTickMarks },
      crosshair: {
        vertLine: { color: s0.light ? s0.crosshair : 'rgba(255,255,255,0.25)', labelBackgroundColor: s0.label },
        horzLine: { color: s0.light ? s0.crosshair : 'rgba(255,255,255,0.25)', labelBackgroundColor: s0.label },
      },
    });

    const candles = chart.addSeries(CandlestickSeries, {
      ...candleSeriesOptions(getCandleTheme()),
      /* The opening view must SHOW the campaign: TP1 and the floor join the
         visible range (Noah, 2026-08-10 — "I have to scroll out quite a bit
         to see the tp and floor lines"). Same pattern as StrikeChart's
         walls/supreme. The user still pans and zooms freely from there — manual
         interaction suspends autoscale as usual. */
      autoscaleInfoProvider: (original: () => { priceRange: { minValue: number; maxValue: number } } | null) => {
        const base = original();
        const extras = scaleLevelsRef.current.filter(v => Number.isFinite(v));
        if (!base || extras.length === 0) return base;
        let { minValue, maxValue } = base.priceRange;
        for (const v of extras) {
          if (v < minValue) minValue = v;
          if (v > maxValue) maxValue = v;
        }
        const pad = Math.max((maxValue - minValue) * 0.06, 0.01);
        return { priceRange: { minValue: minValue - pad, maxValue: maxValue + pad } };
      },
    });
    const volume = chart.addSeries(HistogramSeries, {
      priceScaleId: 'vol',
      priceFormat: { type: 'volume' },
      lastValueVisible: false,
      priceLineVisible: false,
    });
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.86, bottom: 0 } });

    chartRef.current = chart;
    candleRef.current = candles;
    volumeRef.current = volume;
    markersRef.current = createSeriesMarkers(candles);
    const marks = new SetupMarksPrimitive();
    candles.attachPrimitive(marks);
    marksRef.current = marks;

    /* THE POINTER ON A MARK — within 6px of a rule or a rung, past where it starts: the card says what it is */
    chart.subscribeCrosshairMove(p => {
      const d = marksDataRef.current;
      if (!p.point || !d) {
        setCard(null);
        if (marks.data?.hot) marks.setData({ ...marks.data, hot: null });
        return;
      }
      const xEntry = d.entry ? chart.timeScale().timeToCoordinate(d.entry.time as Time) : null;
      const past = xEntry == null || p.point.x >= xEntry - 4;
      const near = (price: number) => {
        const y = candles.priceToCoordinate(price);
        return y != null && Math.abs(y - p.point!.y) <= 6;
      };
      let hit: { kind: string; price: number } | null = null;
      for (const t of d.targets) if (near(t.price)) hit = { kind: `target-${t.level}`, price: t.price };
      if (!hit && d.entry && past && near(d.entry.price)) hit = { kind: 'entry', price: d.entry.price };
      if (!hit && d.floor && past && near(d.floor.price)) hit = { kind: 'floor', price: d.floor.price };
      const hot = hit?.kind ?? null;
      if (marks.data && marks.data.hot !== hot) marks.setData({ ...marks.data, hot });
      const r = container.getBoundingClientRect();
      setCard(hit ? { ...hit, x: r.left + p.point.x, y: r.top + p.point.y } : null);
    });

    /* The frame belongs to the user after first touch (Noah, 2026-08-09 —
       "only on first open/load... after that its on the user"). The library
       only suspends price autoscale on an AXIS drag; wheel-zooming the
       candles keeps it on, so every tick would re-fit around TP1+floor and
       yank the view back. First wheel/pointer on the chart freezes the price
       scale outright. Re-frames: a new setup (effect below) or the built-in
       double-click on the price axis — both deliberate. */
    const freezeScale = () => chart.priceScale('right').applyOptions({ autoScale: false });
    container.addEventListener('wheel', freezeScale, { passive: true });
    container.addEventListener('pointerdown', freezeScale);

    return () => {
      container.removeEventListener('wheel', freezeScale);
      container.removeEventListener('pointerdown', freezeScale);
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      volumeRef.current = null;
      markersRef.current = null;
      marksRef.current = null;
      linesRef.current = [];
      structLinesRef.current = [];
      loadedRef.current = { ticker: '', tf: '', length: 0 };
    };
  }, []);

  // The caller's reserved headroom, applied live (it changes on resize/wrap).
  // Margins only steer autoscale, so a frame the user froze stays theirs.
  useEffect(() => {
    chartRef.current?.priceScale('right').applyOptions({
      scaleMargins: { top: Math.min(0.5, Math.max(0.05, topMargin ?? 0.2)), bottom: 0.1 },
    });
  }, [topMargin]);

  // Theme swap: recolor the candle series in place and repaint volume bars in
  // the new palette — without touching load bookkeeping, so the view never jumps.
  useEffect(() => {
    const t = getCandleTheme();
    candleRef.current?.applyOptions(candleSeriesOptions(t));
    const s = chartSurface(t);
    chartRef.current?.applyOptions({
      layout: { background: { color: s.bg }, textColor: s.light ? s.text : '#5a5a5a' },
      rightPriceScale: { borderColor: s.line },
      timeScale: { borderColor: s.line },
      crosshair: {
        vertLine: { color: s.light ? s.crosshair : 'rgba(255,255,255,0.25)', labelBackgroundColor: s.label },
        horzLine: { color: s.light ? s.crosshair : 'rgba(255,255,255,0.25)', labelBackgroundColor: s.label },
      },
    });
    const bars = aggregateCandles(Simulator.getCandles(setup.ticker) ?? [], tfMinutes(timeframe));
    if (bars.length > 0 && volumeRef.current) {
      volumeRef.current.setData(
        bars.map(b => ({
          time: b.time as UTCTimestamp,
          value: b.volume,
          color: b.close >= b.open ? t.volUp : t.volDown,
        }))
      );
    }
  }, [themeKey, appTheme, setup.ticker, timeframe]);

  // Volume overlay toggle — the series stays mounted, it just goes quiet
  useEffect(() => {
    volumeRef.current?.applyOptions({ visible: overlays.volume });
  }, [overlays.volume]);

  // Structural levels (CW/PW/flip/supreme) as QUIET AXIS CHIPS — lineVisible off,
  // label on. The campaign's own TP/floor lines keep the chart's ink; these
  // let the user check the thesis against the structure without a second
  // layer of full-width lines fighting it. Redrawn per tick while enabled
  // (the book drifts), removed entirely when toggled off.
  useEffect(() => {
    const candleSeries = candleRef.current;
    if (!candleSeries) return;
    for (const line of structLinesRef.current) candleSeries.removePriceLine(line);
    structLinesRef.current = [];
    if (!overlays.levels) return;
    const lv = buildLevelsFor(setup.ticker);
    const chip = (price: number, title: string, color: string) =>
      candleSeries.createPriceLine({
        price,
        color,
        title,
        lineStyle: LineStyle.Solid,
        lineWidth: 1,
        lineVisible: false,
        axisLabelVisible: true,
        axisLabelColor: color,
        axisLabelTextColor: '#0a0a0a',
      });
    structLinesRef.current = [
      chip(lv.callWall, 'CW', CALL_WALL),
      chip(lv.putWall, 'PW', PUT_WALL),
      chip(lv.flip, 'FLIP', FLIP),
      chip(lv.supreme, 'SUPREME', SUPREME),
    ];
  }, [overlays.levels, setup.ticker, revision]);

  // Candles — incremental per tick, aggregated to the selected timeframe
  useEffect(() => {
    const chart = chartRef.current;
    const candleSeries = candleRef.current;
    const volumeSeries = volumeRef.current;
    if (!chart || !candleSeries || !volumeSeries) return;

    const raw = Simulator.getCandles(setup.ticker);
    if (!raw || raw.length === 0) return;
    const bars = aggregateCandles(raw, tfMinutes(timeframe));
    if (bars.length === 0) return;

    const theme = getCandleTheme();
    const toCandle = (b: (typeof bars)[number]) => ({
      time: b.time as UTCTimestamp,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
    });
    const toVolume = (b: (typeof bars)[number]) => ({
      time: b.time as UTCTimestamp,
      value: b.volume,
      color: b.close >= b.open ? theme.volUp : theme.volDown,
    });

    const loaded = loadedRef.current;
    const reframe = loaded.ticker !== setup.ticker || loaded.tf !== timeframe;
    lastCloseRef.current = bars[bars.length - 1].close;
    if (reframe || Math.abs(bars.length - loaded.length) > 1) {
      candleSeries.setData(bars.map(toCandle));
      volumeSeries.setData(bars.map(toVolume));
      if (reframe) {
        // New name or new interval — re-frame the TIME axis. The price
        // scale's frozen/live state is the user's and stays untouched.
        const len = bars.length;
        chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, len - 120), to: len + 4 });
      }
      loadedRef.current = { ticker: setup.ticker, tf: timeframe, length: bars.length };
    } else {
      const last = bars[bars.length - 1];
      candleSeries.update(toCandle(last));
      volumeSeries.update(toVolume(last));
      lastCloseRef.current = last.close;
      loaded.length = bars.length;
    }
  }, [setup.ticker, revision, timeframe]);

  // The campaign stamped on the tape: entry on the bar it was graded, each
  // banked TP on the candle that crossed it. Direction places them — a call
  // enters off a low and banks at highs; a put mirrors.
  useEffect(() => {
    const plugin = markersRef.current;
    if (!plugin) return;
    const call = setup.right === 'C';
    // Markers pin to BARS: event times are 1-minute truth, so on coarser
    // intervals they snap to their containing bucket's candle.
    const bucketSec = tfMinutes(timeframe) * 60;
    const bucket = (t: number) => (bucketSec <= 60 ? t : Math.floor(t / bucketSec) * bucketSec);
    const markers: SeriesMarker<Time>[] = [];
    /* NO WORDS OVER THE CANDLES (Noah, 2026-09-28): the entry is a silver dot on its candle — its rule and figure are
       the primitive's; a won target keeps its arrow, a broken floor its arrow; the card says the rest */
    const silver = resolveInk('rgb(var(--silver))', containerRef.current);
    if (entry) {
      /* the entry's candle wears a silver arrow the trade's way — up for a call, down for a put; its rule and chip are the primitive's */
      markers.push({ time: bucket(entry.time) as UTCTimestamp, position: call ? 'belowBar' : 'aboveBar', color: silver, shape: call ? 'arrowUp' : 'arrowDown', text: '', size: 1 });
    }
    for (const h of hits) {
      markers.push({ time: bucket(h.time) as UTCTimestamp, position: call ? 'aboveBar' : 'belowBar', color: '#30D158', shape: call ? 'arrowUp' : 'arrowDown', text: '', size: 1 });
    }
    if (brk) {
      markers.push({ time: bucket(brk.time) as UTCTimestamp, position: call ? 'belowBar' : 'aboveBar', color: '#FF3B30', shape: call ? 'arrowDown' : 'arrowUp', text: '', size: 1 });
    }
    markers.sort((a, b) => (a.time as number) - (b.time as number));
    plugin.setMarkers(markers);
  }, [entry, hits, brk, setup.right, timeframe, themeKey]);

  // Campaign levels — UN-BANKED TP milestones, the floor, and the strike.
  // A hit TP's line comes DOWN: the banked rung lives on its candle marker
  // now (Noah's sketch, 2026-08-09), so the chart only draws what's still
  // to be won.
  useEffect(() => {
    const candleSeries = candleRef.current;
    if (!candleSeries) return;
    for (const line of linesRef.current) candleSeries.removePriceLine(line);
    const lines: IPriceLine[] = [];
    const banked = new Set(hits.map(h => h.level));

    /* THE MARKS (2026-09-28) — the entry rule from its candle, the floor rule (frozen where it broke; NO RUNGS, NO FLOOR
       for a thesis that earned zero targets — Noah, 2026-08-30 — a broken floor still shows), and the target ladder at
       the right edge, a won rung filled in; a retired setup draws no future rungs. All on the chart's own canvas. */
    const entryPrice = (() => {
      if (!entry) return null;
      const raw = Simulator.getCandles(setup.ticker) ?? [];
      let best: (typeof raw)[number] | null = null;
      for (const b of raw) if (b.time <= entry.time && (!best || b.time > best.time)) best = b;
      return best?.close ?? raw[0]?.close ?? null;
    })();
    const marksData: SetupMarks = {
      entry: entry && entryPrice != null ? { time: entry.time as UTCTimestamp, price: entryPrice, mid: entry.mid } : null,
      floor: setup.takeProfits.length > 0 || brk ? { price: brk ? brk.floor : setup.invalidationPrice, brokeAt: brk ? (brk.time as UTCTimestamp) : null } : null,
      targets: brk ? setup.priceTargets.map((price, i) => ({ level: i + 1, price, won: banked.has(i + 1) })).filter(t => t.won) : setup.priceTargets.map((price, i) => ({ level: i + 1, price, won: banked.has(i + 1) })),
      silver: resolveInk('rgb(var(--silver))', containerRef.current),
      bg: chartSurface(getCandleTheme()).bg === 'transparent' ? '#0a0a0a' : chartSurface(getCandleTheme()).bg,
      bull: '#30D158',
      bear: '#FF3B30',
      ink: chartSurface(getCandleTheme()).light ? '#14151a' : '#ededed',
      hot: null,
    };
    marksDataRef.current = marksData;
    marksRef.current?.setData(marksData);

    lines.push(
      candleSeries.createPriceLine({
        price: setup.strike,
        color: 'rgba(237,237,237,0.35)',
        title: 'STRIKE',
        lineStyle: LineStyle.Dotted,
        lineWidth: 1,
        axisLabelVisible: false,
      })
    );

    linesRef.current = lines;

    /* Feed the autoscale provider: TP1 + the floor are the campaign's
       opening frame ("at least tp1 and floor" — TP2-4 stay reachable by
       zooming out, so the candles keep their room). Re-engage autoscale on
       a NEW SETUP ONLY — the levels themselves drift with spot every tick
       (invalidation/targets derive from it), so comparing values re-framed
       every second and yanked the user's zoom (Noah caught it live). After
       the first frame, the view belongs to the user. */
    scaleLevelsRef.current = [...setup.priceTargets, ...(setup.takeProfits.length > 0 ? [setup.invalidationPrice] : [])];
    if (framedForRef.current !== setup.id) {
      framedForRef.current = setup.id;
      chartRef.current?.priceScale('right').applyOptions({ autoScale: true });
    }
  }, [setup.id, setup.priceTargets, setup.invalidationPrice, setup.strike, hits, brk]);

  /* The greeting, restorable: autoscale re-engages (the campaign frame —
     all TPs + floor — re-fits) and the opening time window returns. */
  const resetView = () => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.priceScale('right').applyOptions({ autoScale: true });
    const len = loadedRef.current.length;
    if (len > 0) chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, len - 120), to: len + 4 });
  };

  /* THE CARD on a mark: what it is, its price, how far from spot — the house's pointer card */
  const spotNow = lastCloseRef.current;
  const cardWords = card
    ? (() => {
        const t = card.kind.startsWith('target-') ? marksDataRef.current?.targets.find(x => `target-${x.level}` === card.kind) : undefined;
        const name = t ? `Target ${t.level}` : card.kind === 'entry' ? 'Entry' : 'Floor';
        const dist = spotNow ? ((card.price - spotNow) / spotNow) * 100 : null;
        const state = t ? (t.won ? 'won' : 'still to be won') : card.kind === 'entry' ? `premium ${marksDataRef.current?.entry?.mid.toFixed(2) ?? ''}` : marksDataRef.current?.floor?.brokeAt ? 'broke — the setup ended here' : `the case ends ${setup.right === 'C' ? 'below' : 'above'} it`;
        return { name, dist, state };
      })()
    : null;
  return (
    <div className="absolute inset-0" data-chart-ink data-chart-ground={chartGround(themeKey)}>
      <div ref={containerRef} className="absolute inset-0" />
      <ResetViewControl onReset={resetView} />
      {card && cardWords && (
        <PointerFollowCard start={{ x: card.x, y: card.y }} width={188} testId="data-setup-mark-card" testValue={card.kind} title={cardWords.name} aside={cardWords.state}>
          <CardRow k="Price" v={card.price.toFixed(2)} />
          {cardWords.dist != null && <CardRow k="From spot" v={`${cardWords.dist >= 0 ? '+' : '−'}${Math.abs(cardWords.dist).toFixed(2)}%`} sub={cardWords.dist >= 0 ? 'above' : 'below'} />}
        </PointerFollowCard>
      )}
    </div>
  );
};

const CampaignAnalysis = ({
  setup,
  revision,
  spot,
  scanner,
  sleeve,
  gradedAt,
  onOpenContract,
}: CampaignAnalysisProps) => {
  const { trackSetup, untrackSetup, isTracked } = useTracker();
  const navigate = useNavigate();
  const tracked = isTracked(setup.id);
  /* The charts' strips wear the ground of the tape's theme (index.css re-scopes their
     tokens under the stamp below; 2026-09-13) */
  const chartThemeKey = useCandleThemeKey();
  /* A phone gets the compact strip and the small menus (the phone pass, 2026-09-13) */
  const isPhone = useIsPhone();
  /* Untrack plays the door's unfold BACKWARDS before the unmount (Noah,
     2026-08-29: "the reverse of the entry"). useFadeClose so the removal is
     a timer, never an animation-completion wait — the wedge law. */
  const { closing: doorClosing, close: closeDoor } = useFadeClose(() => {}, 340);

  /* ENTRY = the bar on the tape when this review opened — and with it, THE
     WHOLE CAMPAIGN FROZEN: entry premium, price targets, premium ladder,
     floor. The engine derives targets as a percentage OF SPOT and this page
     regrades every tick, so live targets recede exactly as fast as price
     approaches them (Noah caught it: "same side magnets" — measured: spot
     +0.29 toward TP1 while TP1 fled +0.41). A campaign whose milestones move
     is unhittable by construction. Frozen at open, the same anchor as the
     provenance line: the numbers that earned the click must not silently
     become other numbers. */
  const entryRef = useRef<
    | (CampaignEntry & {
        id: string;
        priceTargets: number[];
        invalidationPrice: number;
        takeProfits: Setup['takeProfits'];
      })
    | null
  >(null);
  {
    const bars = Simulator.getCandles(setup.ticker);
    if (entryRef.current?.id !== setup.id && bars && bars.length > 0) {
      entryRef.current = {
        id: setup.id,
        time: bars[bars.length - 1].time,
        mid: setup.mid,
        priceTargets: setup.priceTargets,
        invalidationPrice: setup.invalidationPrice,
        takeProfits: setup.takeProfits,
      };
    }
  }
  const entry = entryRef.current && entryRef.current.id === setup.id ? entryRef.current : null;

  /* The campaign view of the setup: defining fields frozen at open, market
     reads (liveMid, score, greeks, spread) live. Every campaign surface on
     this page — chart lines, ladder, floor panel, facts, track — speaks c,
     never the regrading setup. */
  const c = useMemo<Setup>(
    () =>
      entry
        ? {
            ...setup,
            mid: entry.mid,
            priceTargets: entry.priceTargets,
            invalidationPrice: entry.invalidationPrice,
            takeProfits: entry.takeProfits,
          }
        : setup,
    [setup, entry]
  );

  /* TP hits AND the floor break are read off the TAPE, not the simulator's
     rolled status flags — every event must have a candle to point at, and
     the chart, the ladder and the count must all tell one story. Judged
     against the FROZEN campaign levels (c), latched with a scan watermark
     for cheap incremental sweeps — and once the floor breaks, nothing banks
     after it: the campaign died first. */
  const tapeRef = useRef<{ id: string; scanned: number; hits: Map<number, number>; brk: CampaignBreak | null }>({
    id: '',
    scanned: 0,
    hits: new Map(),
    brk: null,
  });
  const { tpHits, floorBreak } = useMemo(() => {
    if (!entry) return { tpHits: [] as CampaignHit[], floorBreak: null as CampaignBreak | null };
    if (tapeRef.current.id !== setup.id) {
      tapeRef.current = { id: setup.id, scanned: entry.time, hits: new Map(), brk: null };
    }
    const st = tapeRef.current;
    if (!st.brk) {
      const bars = Simulator.getCandles(setup.ticker) ?? [];
      for (const b of bars) {
        if (b.time <= st.scanned) continue;
        st.scanned = b.time;
        c.priceTargets.forEach((target, i) => {
          if (!st.hits.has(i + 1) && (setup.right === 'C' ? b.high >= target : b.low <= target)) {
            st.hits.set(i + 1, b.time);
          }
        });
        if (setup.right === 'C' ? b.close < c.invalidationPrice : b.close > c.invalidationPrice) {
          st.brk = { time: b.time, price: b.close, floor: c.invalidationPrice };
          break;
        }
      }
    }
    return {
      tpHits: [...st.hits.entries()].map(([level, time]) => ({ level, time })).sort((a, b) => a.level - b.level),
      floorBreak: st.brk,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry, c, setup.id, setup.right, setup.ticker, revision]);
  const retired = floorBreak != null;

  /* The contracts driving THIS setup — its own strike, the walls, supreme, pin,
     and the heaviest hedging between spot and the final target — read off
     the name's live book on the scan clock (a 1s rebuild would make the
     table vibrate), re-read at once when the contract changes. */
  const driversRef = useRef<{ key: string; at: number; rows: DriverRow[] }>({ key: '', at: 0, rows: [] });
  /* ALL of this name's cons on the Compass page — the reader's CHOSEN
     scanner swept across every eligible tenor, each row sleeve-tagged
     (Noah, 2026-08-30). LAZY: the sweeps run when the capsule opens, not
     per tick; useCallback identity keys the menu's cache. */
  const loadTickerCons = useCallback((): ConPickRow[] => {
    const snapshot = Simulator.snapshotFor(setup.ticker);
    const universe = Simulator.universeQuotes(setup.ticker);
    const out: ConPickRow[] = [];
    for (const sl of SLEEVES) {
      if (!isScannerEligible(scanner, sl.key)) continue;
      try {
        const view = buildCompassView(snapshot, scanner, universe, sl.key);
        for (const s of view.groups.flatMap(g => g.setups)) {
          if (s.ticker !== setup.ticker) continue;
          const key = `${s.strike}-${s.right}-${sl.key}`;
          if (out.some(r => r.key === key)) continue;
          out.push({
            key,
            strike: s.strike,
            right: s.right,
            sleeve: sl.key,
            title: s.contract,
            tag: sl.label,
            sub: `$${s.mid.toFixed(2)}`,
          });
        }
      } catch {
        /* an empty or ineligible sweep stays silent */
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setup.ticker, scanner]);

  const drivers = useMemo(() => {
    const st = driversRef.current;
    const key = `${setup.ticker}-${setup.strike}-${setup.right}-${sleeve}`;
    const now = Date.now();
    if (st.key !== key || now - st.at >= DRIVERS_SCAN_MS) {
      st.key = key;
      st.at = now;
      try {
        st.rows = buildSetupDrivers(Simulator.snapshotFor(setup.ticker), c, sleeve);
      } catch {
        st.rows = [];
      }
    }
    return st.rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setup.ticker, setup.strike, setup.right, sleeve, revision]);

  /* WHERE IT SITS ON TODAY'S BOARD — the same sweep the board runs, on the
     drivers' scan clock, so the Why tab can say "#3 of 17" or plainly that it
     is not on the board (a contract named by hand from the Weigher). */
  const rankRef = useRef<{ key: string; at: number; rank: number | null; of: number }>({ key: '', at: 0, rank: null, of: 0 });
  const boardPlace = useMemo(() => {
    const st = rankRef.current;
    const key = `${setup.ticker}-${setup.strike}-${setup.right}-${scanner}-${sleeve}`;
    const now = Date.now();
    if (st.key !== key || now - st.at >= DRIVERS_SCAN_MS) {
      st.key = key;
      st.at = now;
      try {
        const flat = buildCompassView(Simulator.snapshotFor(setup.ticker), scanner, Simulator.universeQuotes(setup.ticker), sleeve)
          .groups.flatMap(g => g.setups)
          .sort((a, b) => b.score - a.score);
        const i = flat.findIndex(x => x.ticker === setup.ticker && x.right === setup.right && Math.abs(x.strike - setup.strike) < 1e-9);
        st.rank = i >= 0 ? i + 1 : null;
        st.of = flat.length;
      } catch {
        st.rank = null;
        st.of = 0;
      }
    }
    return { rank: st.rank, of: st.of };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setup.ticker, setup.strike, setup.right, scanner, sleeve, revision]);

  const breakTimeLabel = floorBreak
    ? new Date(floorBreak.time * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : '';

  const bankedLevels = useMemo(() => new Set(tpHits.map(h => h.level)), [tpHits]);
  /* Retired: no rung is "working" anymore — the ladder freezes. */
  const workingLevel = retired
    ? null
    : (c.takeProfits.map((_, i) => i + 1).find(l => !bankedLevels.has(l)) ?? null);
  const ladderStatus = (i: number): 'HIT' | 'IN PROGRESS' | 'PENDING' =>
    bankedLevels.has(i + 1) ? 'HIT' : i + 1 === workingLevel ? 'IN PROGRESS' : 'PENDING';
  const hitCount = bankedLevels.size;

  /* Chart controls — the Pulse kit (timeframes, overlays, candles) scoped to
     this chart's diet, persisted across opens. */
  const [timeframe, setTimeframe] = useState<Timeframe>(() => loadChartPrefs().timeframe);
  const [overlays, setOverlays] = useState<ChartOverlays>(() => loadChartPrefs().overlays);
  useEffect(() => {
    localStorage.setItem(CAMPAIGN_CHART_LS, JSON.stringify({ timeframe, overlays }));
  }, [timeframe, overlays]);

  /* Fullscreen chart takeover — the Pulse contract verbatim: 'contents'
     wrapper keeps the grid slot when docked, fullscreen lifts the SAME panel
     (no remount, the chart keeps its view), Esc exits, page scroll locks. */
  /* The card speaks in tabs (Noah, 2026-08-17: "so over information doesnt
     hit the user") — Campaign = the trade's structure, Contract = the
     instrument's dollars. The verdict strip and confidence stay persistent. */
  /* THE CASE FIRST (Noah, 2026-09-28: "the 'why we chose this' should be the first view of the right card") */
  const [cardTab, setCardTab] = useState<'campaign' | 'contract' | 'why'>('why');
  /* The chart slot has two instruments (Noah, 2026-08-17: "i want a button
     ... that allows us to go to that chart"): Stock = the underlying's tape
     (the campaign map), Premium = the contract's modeled premium track
     (ContractTrack, resurrected). Same toggle rides on both panels. */
  /* Survives re-points: the page REMOUNTS per contract (keyed by identity),
     and stepping contracts from the PREMIUM capsule must land on the premium
     chart, not bounce back to stock (Noah's dropdown flow, 2026-08-30).
     Module-scope memory — session-lifetime, deliberately not persisted. */
  const [chartView, setChartView] = useState<'stock' | 'premium'>(() => lastChartView);
  useEffect(() => {
    lastChartView = chartView;
  }, [chartView]);

  /* The stock chart's chrome floats over its tape (same grammar as the
     premium view), so its real height — the strip can wrap — becomes the
     plot's reserved headroom. Both views stay mounted now (the cross-fade,
     2026-09-11), so the refs exist for the page's life: measured once, then
     on every resize. */
  const stockTapeRef = useRef<HTMLDivElement | null>(null);
  const stockChromeRef = useRef<HTMLDivElement | null>(null);
  const [stockTopMargin, setStockTopMargin] = useState(0.2);
  useEffect(() => {
    const measure = () => {
      const tape = stockTapeRef.current?.clientHeight ?? 0;
      const chrome = stockChromeRef.current?.clientHeight ?? 0;
      if (tape > 0 && chrome > 0) setStockTopMargin(Math.min(0.4, Math.max(0.1, (chrome + 16) / tape)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (stockTapeRef.current) ro.observe(stockTapeRef.current);
    if (stockChromeRef.current) ro.observe(stockChromeRef.current);
    return () => ro.disconnect();
  }, []);

  /* Ladder inversions: each premium rung, restated as the underlying level
     that pays it — priced by THE model that minted the mid (one-pricer rule). */
  const iv = setup.greeks.iv / 100;
  const sessions = Math.max(setup.sessionsLeft, 0.5);
  const priceAt = (s: number, sess: number) =>
    estimatePremium(s, setup.strike, setup.right, iv, Math.max(sess, 0.05) / 252);
  const needFor = (target: number) => spotForPremium(target, setup.right, priceAt, sessions, spot);

  /* The exit clock speaks the HOLD's calendar — a year-long trade must never
     read "otherwise it runs into Friday", and a scalp's real clock is its own. */
  const clockCopy =
    scanner === 'quick-scalp'
      ? "Through it the scalp is over — and the scalp's own clock retires it well before the contract's expiry does."
      : sleeve === 'odte'
        ? "A close through it retires the setup — and nothing here outlives today's close anyway."
        : sleeve === 'weekly'
          ? 'A close through it retires the setup — otherwise it runs into Friday.'
          : 'The only exit clock this trade has: a close through it and the setup retires.';

  /* ---- the words the page speaks (the walk, 2026-09-11): a state, a case, targets — never a thesis, a conviction or a milestone ---- */
  const state = processState(setup);
  const stateMeta = PROCESS_META[state];
  /* THE CASE, IN THE FOUR WORDS (Noah, 2026-09-19: "move both places to the four words as well"). The page spoke its own
     three — strong · fair · weak — beside a "Confidence 82%"; both were ONE figure said twice (confidence is the score on
     another scale), so they are one fact now: the word and the four-step meter, no digit. The cuts are the ones this page
     always had (data/compass.ts gradeOfConfidence): strong where it was strong, good where it said fair, and "weak" told
     apart as caution or poor. The Tracker reads the same function, so the two cannot disagree. */
  const caseWord = gradeOfConfidence(setup.confidence);
  const caseInk = GRADE_INK[caseWord];
  const sideWord = setup.right === 'C' ? 'a call, bullish' : 'a put, bearish';
  const tenorWord = `${SLEEVE_LABEL[sleeve] ?? sleeve} · ${setup.expiry === '0DTE' ? 'expires at the bell' : `${Math.round(setup.sessionsLeft)} ${Math.round(setup.sessionsLeft) === 1 ? 'session' : 'sessions'} left`}`;
  const kindLabel = SCANNERS.find(s => s.key === scanner)?.label ?? scanner;
  const targetsWord = retired
    ? `${hitCount} of ${c.takeProfits.length} hit before the break`
    : c.takeProfits.length === 0
      ? 'none — the case is fading'
      : `${hitCount} of ${c.takeProfits.length} hit`;
  const [guideOpen, setGuideOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      {/* THE SETUP'S HEAD — the name's page grammar (EarningsName): the logo, the
          contract in its side's ink, its state, the tenor and the kind, one line;
          the facts at the right. */}
      <div className="relative border border-borderSubtle rounded-md bg-panel" data-setup-head={setup.id} data-setup-state={retired ? 'RETIRED' : state}>
        <GuideFocus open={guideOpen} onClose={() => setGuideOpen(false)} title="How to read a setup" testId="setup-guide" viewport>
          <SetupGuide />
        </GuideFocus>
        <div className="px-5 pt-4 pb-4 flex items-start gap-6 flex-wrap">
          <div className="min-w-0 flex-1 flex items-center gap-3">
            <CompanyLogo ticker={setup.ticker} size={34} />
            <div className="min-w-0">
              {/* the contract's name is never the one squeezed: on a phone the badges wrap under it (2026-10-02 — at 390 px the
                  badges beside it took its whole width and the head read only "MOVING 0DTE Top ranked") */}
              <div className="min-h-6 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <h3 className={`shrink-0 max-w-full truncate text-[15px] font-semibold leading-tight ${setup.right === 'C' ? 'text-bull' : 'text-bear'}`}>{setup.contract}</h3>
                {retired ? (
                  <SignalBadge tone="bear">Retired</SignalBadge>
                ) : (
                  <SignalBadge tone={stateMeta.tone} dot pulse={stateMeta.pulse}>
                    {state}
                  </SignalBadge>
                )}
                <span className="px-1.5 py-0.5 rounded border border-borderSubtle bg-ink/[0.05] font-mono text-[9px] font-semibold uppercase tracking-wider text-textPrimary whitespace-nowrap">{SLEEVE_LABEL[sleeve] ?? sleeve}</span>
                <span className="font-mono text-[9px] tracking-wider text-textMuted whitespace-nowrap">{kindLabel}</span>
                <GuideDoor open={guideOpen} onClick={() => setGuideOpen(v => !v)} title="What the chart, the targets and the case mean" testId="setup-guide" />
              </div>
              <p className="mt-0.5 text-[11px] text-textMuted whitespace-nowrap truncate">
                {sideWord} · {tenorWord}
                {gradedAt != null && (
                  <>
                    {' '}
                    · found at <span className="text-textSecondary tnum">{gradedAt}</span>, read live since
                  </>
                )}
              </p>
            </div>
          </div>
          <dl className="flex flex-wrap gap-x-6 gap-y-2" data-setup-facts>
            <Fact label="Premium" testId="premium">
              <AnimatedNumber value={setup.liveMid} format={v => `$${v.toFixed(2)}`} flash />
            </Fact>
            <Fact label="The case" testId="case">
              <span className="inline-flex items-center gap-2" data-case={caseWord}>
                <GradeMeter grade={caseWord} className="w-16" />
                <span className={caseInk}>{caseWord}</span>
              </span>
            </Fact>
            <Fact label="Targets" testId="targets">
              {targetsWord}
            </Fact>
            <Fact label="Breaks at" testId="breaks">
              <span className={retired ? 'text-bear' : 'text-warn'}>
                {retired && floorBreak ? `broke $${floorBreak.floor.toFixed(2)}` : `${setup.right === 'C' ? 'below' : 'above'} $${c.invalidationPrice.toFixed(2)}`}
              </span>
            </Fact>
            <Fact label="Liquidity" testId="liquidity">
              {setup.liquidityLabel} <span className="text-textMuted">· {setup.liquiditySpread}</span>
            </Fact>
          </dl>
        </div>
      </div>

      {/* The retirement banner — the loudest thing on a dead setup's page. The
          reader is never navigated away (states, not orders): the case died,
          the post-mortem is information, they leave when they are done. */}
      {retired && floorBreak && (
        <div className="border border-bear/30 bg-bear/[0.04] rounded-md p-3 flex items-center gap-3 animate-soft-in" data-setup-retired>
          <ShieldAlert className="w-5 h-5 text-bear/90 shrink-0" />
          <div>
            <span className="block font-mono text-[12px] font-bold uppercase tracking-wider text-bear">Floor broken — setup retired</span>
            <p className="text-[12px] text-textPrimary leading-snug">
              <RichRead
                text={`${setup.ticker} closed ${setup.right === 'C' ? 'below' : 'above'} ${floorBreak.floor.toFixed(2)} at ${breakTimeLabel} — the case is gone. ${
                  hitCount > 0 ? `${hitCount} of ${c.takeProfits.length} targets hit before the break.` : 'No target was hit.'
                } What follows is the post-mortem.`}
              />
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
        {/* The chart slot — 60/40 with the card (Noah, 2026-08-17). Two
            instruments share it: the STOCK view is the setup drawn on the
            underlying's chart; the PREMIUM view is the contract's own modeled
            premium track. BOTH STAY MOUNTED, stacked in one grid cell, and
            CROSS-FADE — the card's Setup/Contract tabs' own transition (Noah,
            2026-09-11: "the transition needs to be as smooth as the setup →
            contract transition for the stock → prem"); a remount hard-cut the
            chart and rebuilt it from nothing. Fullscreen lifts the whole
            stack, so the lift never remounts either chart. The same strip
            rides both, slot for slot. */}
        {/* NO FULLSCREEN HERE (Noah, 2026-09-28: "compass chart should not have the option to become a full chart") — the
            chart is the setup's evidence beside its card, never a takeover; Terrain is the page for a whole chart */}
        <div className="contents" data-theme="dark">
          <div
            className="xl:col-span-7 min-w-0 animate-soft-in-slow flex flex-col border border-borderSubtle rounded-md bg-panel overflow-hidden"
            data-setup-chart={chartView}
            /* A dark island on any page (2026-09-12): both charts and their strips read the dark tokens */
            data-theme="dark"
            /* …and the strips the ground of the tape's theme (2026-09-13) */
            data-chart-ground={chartGround(chartThemeKey)}
          >
            <div className="flex flex-col flex-1 min-h-[500px]">
              <div className="flex-1 min-h-0 grid grid-rows-[minmax(0,1fr)]" data-setup-chart-stack>
                {/* THE STOCK VIEW */}
                <div
                  className={`col-start-1 row-start-1 min-h-0 flex flex-col transition-opacity duration-300 ${chartView === 'stock' ? 'opacity-100' : 'invisible opacity-0 pointer-events-none'}`}
                  data-setup-view="stock"
                  aria-hidden={chartView !== 'stock'}
                >
                  <div ref={stockTapeRef} className="relative flex-1 min-h-0 overflow-hidden">
                    <CampaignChart setup={c} revision={revision} entry={entry} hits={tpHits} brk={floorBreak} timeframe={timeframe} overlays={overlays} topMargin={stockTopMargin} />
                    {/* ONE strip + its whisper: the capsule, the Stock/Premium door,
                        then the chart's own toolbar. pr-14 keeps the strip's end off the price axis. */}
                    <div ref={stockChromeRef} className="absolute top-0 inset-x-0 z-20" data-chart-chrome>
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 pl-2 pr-14 py-1 select-none">
                        {/* The SAME capsule as the premium view — the contract, stepping
                            between this name's contracts — so the Stock/Premium door
                            beside it never moves between the two views */}
                        {onOpenContract ? (
                          <ContractPick label={`${setup.contract} · ${setup.expiry}`} current={{ strike: setup.strike, right: setup.right, sleeve: setup.sleeve }} loadRows={loadTickerCons} onPick={onOpenContract} />
                        ) : (
                          <span className="inline-flex items-center h-7 px-3 rounded-full bg-ink/[0.06] font-mono text-[11px] font-bold text-textPrimary shrink-0">
                            {setup.contract} · {setup.expiry}
                          </span>
                        )}
                        <CardTabs
                          ariaLabel="Chart view"
                          options={[
                            { value: 'stock', label: 'Stock' },
                            { value: 'premium', label: 'Premium' },
                          ]}
                          value={chartView}
                          onChange={setChartView}
                        />
                        {/* Its floor is its own row (the phone pass, 2026-09-13, the Weigher's lesson): at its one-row width the
                            toolbar wraps under the capsule and the tabs instead of piling up beside them; a phone gets the
                            compact strip and the small menus */}
                        <div className="flex-1 min-w-fit">
                          <ChartToolbar minimal candles spread compact={isPhone} dense={isPhone} overlayKeys={['levels', 'volume']} timeframe={timeframe} onTimeframe={setTimeframe} overlays={overlays} onOverlays={setOverlays} />
                        </div>
                      </div>
                      <div className="pl-3 pr-16 pointer-events-none">
                        <span className="font-mono text-[10px] text-textMuted">the targets and the floor on the live chart</span>
                      </div>
                    </div>
                  </div>
                </div>
                {/* THE PREMIUM VIEW */}
                <div
                  className={`col-start-1 row-start-1 min-h-0 flex flex-col transition-opacity duration-300 ${chartView === 'premium' ? 'opacity-100' : 'invisible opacity-0 pointer-events-none'}`}
                  data-setup-view="premium"
                  aria-hidden={chartView !== 'premium'}
                >
                  <ContractTrack
                    setup={c}
                    revision={revision}
                    retired={retired}
                    loadPickRows={loadTickerCons}
                    onOpenContract={onOpenContract}
                    actions={
                      <CardTabs
                        ariaLabel="Chart view"
                        options={[
                          { value: 'stock', label: 'Stock' },
                          { value: 'premium', label: 'Premium' },
                        ]}
                        value={chartView}
                        onChange={setChartView}
                      />
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* THE TRADE (Noah, 2026-08-17: the browse preview card, promoted) — the
            targets, why it is on the board, what retires it; the Contract tab
            for the instrument's own dollars. 7/5 split ("the chart takes up
            more space ... but not by much. like 60/40"). */}
        <div className="xl:col-span-5 min-w-0 flex flex-col">
          <div className="border border-borderSubtle rounded-md bg-panel flex flex-col flex-1 min-h-0 overflow-hidden" data-setup-card>
            <div className="px-5 pt-4 pb-3 flex items-start gap-6">
              <div className="min-w-0 flex-1">
                <div className="h-6 flex items-center gap-3">
                  <h3 className="text-[15px] font-semibold leading-tight text-textPrimary">The trade</h3>
                </div>
                <p className="mt-0.5 text-[11px] text-textMuted whitespace-nowrap truncate">
                  {retired ? `retired — ${hitCount} of ${c.takeProfits.length} targets hit` : c.takeProfits.length === 0 ? 'no targets — the case is fading' : `${hitCount} of ${c.takeProfits.length} targets hit`} · {sideWord}
                </p>
              </div>
              <CardTabs
                options={[
                  /* the case as a page of its own (Noah, 2026-09-13, with his partner's card) — and the first view (2026-09-28) */
                  { value: 'why', label: 'Why we chose this' },
                  { value: 'campaign', label: 'Setup' },
                  { value: 'contract', label: 'Contract' },
                ]}
                value={cardTab}
                onChange={setCardTab}
              />
            </div>

            {/* Tab body — BOTH panes stay mounted, stacked in one grid cell,
                the inactive one invisible. Height = the taller tab always, so
                switching never moves the row's bottom edge — and every
                AnimatedNumber keeps rolling instead of remounting. */}
            <div className="flex-1 p-3 grid border-t border-borderSubtle">
              <div className={`col-start-1 row-start-1 flex flex-col gap-4 transition-opacity duration-300 ${cardTab === 'campaign' ? 'opacity-100' : 'invisible opacity-0'}`}>
                <div className="border border-borderSubtle rounded-md overflow-hidden">
                  <div className="px-3 py-1.5 border-b border-borderSubtle bg-inset">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-textMuted">{c.takeProfits.length > 0 ? 'Targets' : 'Targets — none, the case is fading'}</span>
                  </div>
                  {/* The strict table (Noah, 2026-08-09; decoration stripped
                      2026-08-17): right-aligned figures, hairline rows, whisper
                      headers. Ink alone carries state — hit targets check + bull,
                      the working one bright, pending quiet. The floor is the
                      table's last row; its clock lives in the caption underneath. */}
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-borderSubtle">
                        <th className="text-left font-mono text-[9px] uppercase tracking-wider text-textMuted font-medium px-3 py-1.5">Target</th>
                        <th className="text-right font-mono text-[9px] uppercase tracking-wider text-textMuted font-medium px-3 py-1.5">Premium</th>
                        <th className="text-right font-mono text-[9px] uppercase tracking-wider text-textMuted font-medium px-3 py-1.5">From entry</th>
                        <th className="text-right font-mono text-[9px] uppercase tracking-wider text-textMuted font-medium px-3 py-1.5">{setup.ticker} needs</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-borderSubtle">
                      {[...c.takeProfits].reverse().map((tp, ri) => {
                        const i = c.takeProfits.length - 1 - ri;
                        // Status comes from the TAPE (same derivation as the
                        // chart's candle markers) — the rolled sim flags could
                        // claim a hit no candle ever printed.
                        const status = ladderStatus(i);
                        const hit = status === 'HIT';
                        const working = status === 'IN PROGRESS';
                        const need = hit || retired ? null : needFor(tp.target);
                        return (
                          <tr key={tp.level} data-setup-target={i + 1} data-status={status}>
                            <td className="px-3 py-2">
                              <span className={`inline-flex items-center gap-1.5 font-mono text-[11px] ${hit ? 'text-bull font-semibold' : working && !retired ? 'text-textPrimary font-semibold' : retired ? 'text-textMuted' : 'text-textSecondary'}`}>
                                {hit && <Check className="w-3 h-3" />}
                                Target {i + 1}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-[12px] font-semibold tnum text-textPrimary">${tp.target.toFixed(2)}</td>
                            <td className={`px-3 py-2 text-right font-mono text-[11px] tnum ${hit ? 'text-bull' : 'text-textSecondary'}`}>+{tp.expectedPct}%</td>
                            {/* The stock price that pays this target — a premium the
                                reader can't watch, turned into a price they can (per
                                the pricer). A hit target is done: nothing left to need. */}
                            <td className={`px-3 py-2 text-right font-mono text-[11px] tnum ${working && !retired ? 'text-textPrimary' : 'text-textSecondary'}`}>{need != null ? need.toFixed(2) : '—'}</td>
                          </tr>
                        );
                      })}

                      {/* Entry — the reference row */}
                      <tr>
                        <td className="px-3 py-2">
                          <span className="font-mono text-[11px] text-textSecondary">Entry</span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-[12px] font-semibold tnum text-textPrimary">${c.mid.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right font-mono text-[11px] tnum text-textMuted">—</td>
                        <td className="px-3 py-2 text-right font-mono text-[11px] tnum text-textMuted">—</td>
                      </tr>

                      {/* The floor — the table's base: through it, the setup
                          retires. Its level is a STOCK price, so it lives in
                          the needs column. */}
                      <tr>
                        <td className="px-3 py-2">
                          <span className="font-mono text-[11px] font-semibold text-bear">{setup.right === 'C' ? 'Floor' : 'Ceiling'}</span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-[11px] tnum text-textMuted">—</td>
                        <td className="px-3 py-2 text-right font-mono text-[11px] tnum text-textMuted">—</td>
                        <td className="px-3 py-2 text-right font-mono text-[12px] font-semibold tnum text-textPrimary whitespace-nowrap">
                          {retired && floorBreak ? `broke ${floorBreak.floor.toFixed(2)}` : `${setup.right === 'C' ? 'below' : 'above'} ${c.invalidationPrice.toFixed(2)}`}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* The floor's clock, spoken once as a caption — not shouted inside the row. */}
                  <p className="px-3 py-2 border-t border-borderSubtle text-[10px] leading-snug text-textSecondary">
                    {c.invalidationReason}. {retired ? 'A close through it retired the setup — what remains is the post-mortem.' : clockCopy}
                  </p>
                </div>

                {/* The case itself moved to its own tab, "Why we chose this" (2026-09-13) — the foot of the Setup tab is the floor alone */}

                {/* What retires it — the FROZEN floor (the merged `c`), the same
                    number the table's last row holds. */}
                <div className="border border-borderSubtle bg-inset rounded-md px-3 py-2.5">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <AlertTriangle className="w-3 h-3 text-warn" />
                    <span className="font-mono text-[9px] uppercase tracking-widest text-textMuted">What retires it</span>
                  </div>
                  <div className={`font-mono text-sm font-semibold tnum ${retired ? 'text-bear' : 'text-warn'}`}>
                    {retired && floorBreak ? `Broke $${floorBreak.floor.toFixed(2)}` : `A close ${setup.right === 'C' ? 'below' : 'above'} $${c.invalidationPrice.toFixed(2)}`}
                  </div>
                  <div className="font-mono text-[10px] text-textMuted">{c.invalidationReason}</div>
                </div>
              </div>

              <div className={`col-start-1 row-start-1 flex flex-col gap-4 transition-opacity duration-300 ${cardTab === 'contract' ? 'opacity-100' : 'invisible opacity-0'}`}>
                <div className="grid grid-cols-3 gap-2">
                  <div className="border border-borderSubtle bg-inset rounded-md px-3 py-2">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-textMuted">Premium</div>
                    <div className="mt-1 font-mono text-sm font-semibold text-textPrimary tnum">
                      <AnimatedNumber value={setup.mid} format={v => `$${v.toFixed(2)}`} flash />
                    </div>
                  </div>
                  <div className="border border-borderSubtle bg-inset rounded-md px-3 py-2">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-textMuted">Fair value</div>
                    <div className="mt-1 font-mono text-sm font-semibold text-textPrimary tnum">
                      <AnimatedNumber value={setup.liveMid} format={v => `$${v.toFixed(2)}`} flash />
                    </div>
                  </div>
                  <div className="border border-borderSubtle bg-inset rounded-md px-3 py-2">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-textMuted">Expected move</div>
                    <div className={`mt-1 font-mono text-sm font-semibold tnum ${setup.expectedMovePct >= 0 ? 'text-bull' : 'text-bear'}`}>
                      <AnimatedNumber value={setup.expectedMovePct} format={v => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`} />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="font-mono text-[9px] uppercase tracking-widest text-textMuted mb-1.5">Greeks</div>
                  <GreeksRow greeks={setup.greeks} fourth="iv" flash />
                </div>

                {/* The contract's dollars as a LEDGER — values on the same right rail as the greeks above */}
                <div>
                  <div className="font-mono text-[9px] uppercase tracking-widest text-textMuted mb-1.5">In dollars</div>
                  <ContractFacts setup={c} spot={spot} ledger />
                </div>
              </div>

              {/* WHY WE CHOSE THIS — the case as a page of its own (Noah, 2026-09-13, with his partner's card: "i like the why we
                  chose this as another section as well and not a little bottom section"), in the order a reader asks: which lens
                  found it, how strong the case is, the read in words, the numbers behind it, where it sits on today's board, and
                  what would make us wrong. */}
              <div className={`col-start-1 row-start-1 flex flex-col gap-3 transition-opacity duration-300 ${cardTab === 'why' ? 'opacity-100' : 'invisible opacity-0'}`} data-setup-why>
                <div className="flex items-center gap-2 flex-wrap">
                  {retired ? (
                    <SignalBadge tone="bear">Retired</SignalBadge>
                  ) : (
                    <SignalBadge tone={stateMeta.tone} dot pulse={stateMeta.pulse}>
                      {state}
                    </SignalBadge>
                  )}
                  <span className={`font-mono text-[11px] font-semibold ${caseInk}`}>a {caseWord} case</span>
                  <GradeMeter grade={caseWord} className="w-14" />
                  <span className="ml-auto font-mono text-[9px] uppercase tracking-wider text-textSecondary whitespace-nowrap">found by {kindLabel}</span>
                </div>
                <div className="flex items-start gap-2 border border-borderSubtle bg-inset rounded-md px-3 py-2.5">
                  <Info className="w-3.5 h-3.5 text-textSecondary shrink-0 mt-0.5" />
                  <div className="flex flex-col gap-1.5 min-w-0">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-textMuted">Why it is on the board</span>
                    <p key={setup.id} className="text-[11px] text-textPrimary leading-relaxed animate-soft-in">
                      <RichRead text={setup.whyText} />
                    </p>
                    <span className="flex items-center gap-1.5 flex-wrap">
                      {setup.whyChips.map(chip => (
                        <span key={chip} className="font-mono text-[8px] uppercase tracking-wider text-textSecondary border border-borderSubtle rounded px-1 py-px">
                          {chip}
                        </span>
                      ))}
                    </span>
                  </div>
                </div>
                <div className="border border-borderSubtle rounded-md overflow-hidden">
                  <div className="px-3 py-1.5 border-b border-borderSubtle bg-inset">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-textMuted">The numbers behind it</span>
                  </div>
                  <table className="w-full">
                    <tbody className="divide-y divide-borderSubtle">
                      {[
                        { k: 'The lens', v: `${kindLabel} — ${SCANNERS.find(s => s.key === scanner)?.blurb ?? ''}`, ink: 'text-textPrimary' },
                        { k: 'Priced against', v: `${setup.liveMid > setup.mid * 1.02 ? 'under' : setup.liveMid < setup.mid * 0.98 ? 'over' : 'at'} fair value — $${setup.mid.toFixed(2)} entry vs $${setup.liveMid.toFixed(2)} fair`, ink: setup.liveMid > setup.mid * 1.02 ? 'text-bull' : setup.liveMid < setup.mid * 0.98 ? 'text-bear' : 'text-textPrimary' },
                        { k: 'The move it needs', v: `±${setup.sigmaMovePct}% is the stock's 1σ to expiry · the setup asks +${setup.expectedMovePct.toFixed(1)}% of the premium`, ink: 'text-textPrimary' },
                        { k: 'The side', v: `${sideWord} — ${setup.right === 'C' ? 'dealers must buy the stock to stay hedged as it rises' : 'dealers must sell the stock to stay hedged as it falls'}`, ink: setup.right === 'C' ? 'text-bull' : 'text-bear' },
                        { k: 'The clock', v: tenorWord, ink: 'text-textPrimary' },
                        { k: 'The greeks', v: `delta ${setup.greeks.delta.toFixed(2)} · IV ${setup.greeks.iv.toFixed(1)}% · theta ${setup.greeks.theta.toFixed(2)}/day`, ink: 'text-textPrimary' },
                        { k: 'The liquidity', v: `${setup.liquidityLabel} — ${setup.liquiditySpread}`, ink: setup.liquidityLabel === 'Tight' ? 'text-bull' : setup.liquidityLabel === 'Wide' ? 'text-bear' : 'text-textPrimary' },
                        {
                          k: "Today's board",
                          v: boardPlace.rank != null ? `#${boardPlace.rank} of ${boardPlace.of} on the ${kindLabel} board at this expiry` : `not on today's ${kindLabel} board — it lists only the strongest few; this one was named by hand`,
                          ink: boardPlace.rank != null ? 'text-textPrimary' : 'text-warn',
                        },
                      ].map(row => (
                        <tr key={row.k} data-why-row={row.k}>
                          <td className="px-3 py-1.5 align-top font-mono text-[9px] uppercase tracking-wider text-textSecondary whitespace-nowrap w-28">{row.k}</td>
                          <td className={`px-3 py-1.5 text-[11px] leading-snug ${row.ink}`}>{row.v}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="border border-borderSubtle bg-inset rounded-md px-3 py-2.5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <AlertTriangle className="w-3 h-3 text-warn" />
                    <span className="font-mono text-[9px] uppercase tracking-widest text-textMuted">What would make us wrong</span>
                  </div>
                  <p className="text-[11px] text-textPrimary leading-snug">
                    A close {setup.right === 'C' ? 'below' : 'above'} <span className="font-mono font-semibold tnum text-warn">${c.invalidationPrice.toFixed(2)}</span> — {c.invalidationReason.toLowerCase()} gives way and the case is gone.{' '}
                    {c.takeProfits.length === 0 ? 'The case is already fading: no targets were earned.' : `${c.takeProfits.length} ${c.takeProfits.length === 1 ? 'target was' : 'targets were'} earned by the math; ${hitCount} ${hitCount === 1 ? 'has' : 'have'} been hit.`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/compass', { state: { tickerFilter: setup.ticker } })}
                  className="self-start inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-textSecondary hover:text-textPrimary transition-colors"
                  data-why-board
                >
                  <ArrowUpRight className="w-3 h-3" /> See <CompanyLogo ticker={setup.ticker} size={12} /> {setup.ticker} on the board
                </button>
              </div>
            </div>

            {/* Track — docked as the card's footer: the action belongs to the
                setup it acts on. Tracking UNFOLDS a second door beside it (Noah,
                2026-08-29) — the Track button slides left as the "Open in
                Tracker" door widens in. Untrack unmounts the door on the spot. */}
            <div className="border-t border-borderSubtle p-2 flex items-stretch">
              <button
                onClick={() => {
                  if (tracked) {
                    untrackSetup(setup.id);
                    closeDoor();
                  } else {
                    trackSetup(setup, scanner);
                  }
                }}
                className={`flex-1 min-w-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md font-mono text-[11px] font-semibold uppercase tracking-wider transition-colors ${
                  tracked ? 'border border-bear/40 text-bear hover:bg-bear/[0.06]' : 'text-[#0a0a0a] holo-bg hover:brightness-105'
                }`}
                data-setup-track={tracked ? 'on' : 'off'}
              >
                <Bookmark className="w-3.5 h-3.5" />
                {tracked ? 'Untrack setup' : 'Track setup'}
              </button>
              {(tracked || doorClosing) && (
                <div className={doorClosing && !tracked ? 'animate-track-close pointer-events-none' : 'animate-track-open'}>
                  <div className="overflow-hidden min-w-0 flex items-stretch">
                    <button
                      onClick={() => navigate('/compass/tracker', { state: { focus: setup.id } })}
                      title="Jump to this setup on the Tracker"
                      className="ml-2 h-full whitespace-nowrap inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md border border-borderSubtle bg-ink/[0.03] hover:bg-ink/[0.06] font-mono text-[11px] font-semibold uppercase tracking-wider text-textSecondary hover:text-textPrimary transition-colors"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      Open in Tracker
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* The contracts around it (Mo, 2026-08-19) — here, where there is ONE
          setup for the phrase to be true of. Keyed on the contract so a
          re-point soft-fades the grid in with the page. */}
      <div key={`drivers-${setup.ticker}-${setup.strike}-${setup.right}`} className="animate-soft-in-slow">
        <SetupDrivers ticker={setup.ticker} rows={drivers} onOpen={onOpenContract} />
      </div>
    </div>
  );
};

export default CampaignAnalysis;
