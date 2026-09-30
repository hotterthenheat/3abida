/*
==================================================
  SLAYER TERMINAL - REVIEW · A CLOSED TRADE ON ITS TAPE
  (components/review/TradeTape.tsx)

  The journal's picture of a trade: THE HOUSE CHART
  (StrikeChart, fed the replayed tape — the same chart
  the desk trades on, in the reader's candle theme)
  over the days the trade was on, with the day before
  it for context and THE REST OF THE LAST DAY after it
  — what the name did once you were out is half of
  what a journal is for. On it:

    an arrow in, an arrow out   at the minute of each,
                                with the price paid
                                and the price taken
    lines                       an option's way out
                                only when it was
                                PINNED TO THE NAME — a
                                way out priced on the
                                contract has no fixed
                                place on the name's
                                chart (decay moves it),
                                so it is drawn on the
                                figure under this one,
                                in dollars

  The chart opens on the trade (its window, with room
  either side), can be scrolled and zoomed like any
  tape, and can be DRAWN ON — a mark-up is kept with
  the trade (`journal:<trade>` is the drawings' key).

  A PAPER TRADE (2026-09-22) is drawn off the candles its
  account WROTE DOWN when it closed (data/paper/engine.ts
  `paths`: an hour before the way in, to the way out) —
  its simulated market is gone. They are on the chart's
  own clock, the one the desk drew them on, and so are its
  arrows. A trade older than the journal keeps drawings
  for says so in place of a chart.
==================================================
*/

import { useEffect, useMemo, useRef, useState } from 'react';
import { LineStyle, createSeriesMarkers, type IPriceLine, type ISeriesApi, type ISeriesMarkersPluginApi, type SeriesMarker, type SeriesType, type Time, type UTCTimestamp } from 'lightweight-charts';
import StrikeChart, { DEFAULT_INDICATORS, DEFAULT_OVERLAYS, type ChartLayerApi, type ChartOverlays, type ChartTape } from '../gex/StrikeChart';
import { chartGround, useCandleThemeKey } from '../gex/candleTheme';
import DropdownSelect, { type DropdownOption } from '../ui/DropdownSelect';
import { readToken } from '../../theme/theme';
import type { Excursion } from '../../data/review/excursion';
import { instantOf, nameOf, type JournalRow } from '../../data/review/journal';
import { PATHS_KEPT, candlesOfPath } from '../../data/paper/engine';
import { baseIvAt, dayBars, dayIndex, nextDay, prevDay } from '../../data/review/tape';
import { tfMinutes, type Timeframe } from '../../data/timeframe';
import type { KeyLevels } from '../../types/gex';

const FRAMES: DropdownOption<Timeframe>[] = [
  { value: '1m', label: '1m', hint: 'A minute a candle' },
  { value: '5m', label: '5m', hint: 'Five minutes a candle' },
  { value: '15m', label: '15m', hint: 'A quarter of an hour a candle' },
  { value: '1h', label: '1h', hint: 'An hour a candle' },
];
const OVERLAYS: ChartOverlays = { ...(Object.fromEntries(Object.keys(DEFAULT_OVERLAYS).map(k => [k, false])) as unknown as ChartOverlays), volume: true };
/** The interval a trade opens on: a candle small enough to see the trade, few enough to read */
const frameFor = (heldMin: number): Timeframe => (heldMin <= 150 ? '1m' : heldMin <= 900 ? '5m' : heldMin <= 3000 ? '15m' : '1h');
/** …a paper trade's: the candle its candles were written down at */
const frameForStep = (sec: number): Timeframe => (sec <= 60 ? '1m' : sec <= 300 ? '5m' : sec <= 900 ? '15m' : '1h');
const frameOf = (row: JournalRow): Timeframe => (row.paper ? frameForStep(row.s.paths[row.t.id]?.step ?? 60) : frameFor(row.t.heldMin));

interface Level {
  price: number;
  ink: '--text-primary' | '--bull' | '--bear';
  title: string;
  dashed: boolean;
}

/** What is hung on the chart: the two arrows, the lines, and the window the chart opens on */
const TradeLayer = ({ api, marks, levels, from, to, tradeKey }: { api: ChartLayerApi; marks: { time: number; buy: boolean; text: string }[]; levels: Level[]; from: number; to: number; tradeKey: string }) => {
  const inkRef = useRef<HTMLSpanElement | null>(null);
  const seriesRef = useRef<ISeriesApi<SeriesType> | null>(null);
  const linesRef = useRef<IPriceLine[]>([]);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  /** Bumped when the chart hands over a new series (a style swap): everything hung on the old one is hung again */
  const [seriesN, setSeriesN] = useState(0);
  useEffect(() => {
    let raf = 0;
    const watch = () => {
      const series = api.series();
      if (series !== seriesRef.current) {
        seriesRef.current = series;
        linesRef.current = [];
        markersRef.current = null;
        setSeriesN(n => n + 1);
      }
      raf = requestAnimationFrame(watch);
    };
    raf = requestAnimationFrame(watch);
    return () => {
      cancelAnimationFrame(raf);
      /* only while the chart stands (PositionLayer's note): a line taken off a removed chart throws a frame later */
      const series = api.chart() && api.series() === seriesRef.current ? seriesRef.current : null;
      if (series) {
        for (const l of linesRef.current) series.removePriceLine(l);
        markersRef.current?.setMarkers([]);
      }
    };
  }, [api]);
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    const el = inkRef.current ?? undefined;
    for (const l of linesRef.current) series.removePriceLine(l);
    linesRef.current = levels.map(l => series.createPriceLine({ price: l.price, color: readToken(l.ink, l.ink === '--text-primary' ? 0.7 : undefined, el), lineWidth: 1, lineStyle: l.dashed ? LineStyle.Dashed : LineStyle.Solid, axisLabelVisible: true, title: l.title }));
    api.room(levels.map(l => l.price));
    if (!markersRef.current) markersRef.current = createSeriesMarkers(series, []);
    const ms: SeriesMarker<Time>[] = [...marks]
      .sort((a, b) => a.time - b.time)
      .map(m => ({ time: m.time as UTCTimestamp, position: m.buy ? ('belowBar' as const) : ('aboveBar' as const), shape: m.buy ? ('arrowUp' as const) : ('arrowDown' as const), color: readToken(m.buy ? '--silver' : '--warn', undefined, el), text: m.text }));
    markersRef.current.setMarkers(ms);
  }, [api, marks, levels, seriesN]);
  /* THE CHART OPENS ON THE TRADE: its window with room either side — a frame on, once the tape has landed (the house
     chart's own rule for a range set from outside) */
  useEffect(() => {
    let raf = 0;
    let tries = 0;
    const open = () => {
      const chart = api.chart();
      if (!chart || !seriesRef.current) {
        if (tries++ < 120) raf = requestAnimationFrame(open);
        return;
      }
      try {
        chart.timeScale().setVisibleRange({ from: from as UTCTimestamp, to: to as UTCTimestamp });
      } catch {
        /* the tape has no bars yet: the library's own fit stands */
      }
    };
    raf = requestAnimationFrame(() => requestAnimationFrame(open));
    return () => cancelAnimationFrame(raf);
  }, [api, from, to, tradeKey, seriesN]);
  return <span ref={inkRef} className="hidden" data-chart-ink aria-hidden="true" />;
};

const TradeTape = ({ row, excursion, height = 380 }: { row: JournalRow; excursion: Excursion; height?: number }) => {
  const themeKey = useCandleThemeKey();
  const symbol = nameOf(row);
  const [frame, setFrame] = useState<Timeframe>(() => frameOf(row));
  const [drawing, setDrawing] = useState(false);
  useEffect(() => {
    setFrame(frameOf(row));
    setDrawing(false);
  }, [row.key]); // eslint-disable-line react-hooks/exhaustive-deps
  /* the pencil needs a pointer and room: on a phone the rail lay over a third of the tape, and a finger draws nothing fine */
  const [roomToDraw, setRoomToDraw] = useState(() => typeof window === 'undefined' || window.matchMedia('(min-width: 640px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)');
    const on = () => setRoomToDraw(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  /* the days on the tape: the one before the way in, every day it was on, all of the last one */
  const path = row.paper ? (row.s.paths[row.t.id] ?? null) : null;
  const tape = useMemo<ChartTape>(() => {
    if (row.paper) {
      const bars = path ? candlesOfPath(path) : [];
      return { bars, iv: 0.2, key: `journal:${row.key}` };
    }
    const days: string[] = [];
    const before = prevDay(row.t.opened.day);
    if (before) days.push(before);
    const t = row.t as Extract<JournalRow, { paper?: undefined }>['t'];
    for (let d: string | null = t.opened.day, n = 0; d && n < 60; d = nextDay(d), n++) {
      days.push(d);
      if (d === t.closed.day || dayIndex(d) >= dayIndex(t.closed.day)) break;
    }
    return { bars: days.flatMap(d => dayBars(symbol, d)), iv: baseIvAt(symbol, t.closed.day), key: `journal:${row.key}`, clock: 'ny' };
  }, [row.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const bucket = Math.max(1, tfMinutes(frame)) * 60;
  /* a moment is the END of its minute (journal.ts); an arrow sits on the candle the fill happened IN — the one that began a minute
     before. A paper fill sits where the chart stood when it happened (its `bar`, the chart's own clock). */
  const barOf = (l: JournalRow['t']['legs'][number]): number => (row.paper ? (l as { bar: number }).bar : instantOf(row, l.at) - 60);
  const tIn = barOf(row.t.legs[0]);
  const tOut = barOf(row.t.legs[row.t.legs.length - 1]);
  /* AN ARROW A FILL (the ladder): every way in and every piece going out, on the candle it happened in */
  const marks = useMemo(() => {
    const onBar = (t: number) => t - (t % bucket);
    const many = row.t.legs.length > 2;
    return row.t.legs.map(l => {
      const going = l.side === 'sell';
      return { time: onBar(barOf(l)), buy: l.side === 'buy', text: `${going ? 'Out' : 'In'} ${many ? `${l.qty} × ` : ''}${l.price.toFixed(2)}` };
    });
  }, [row.key, bucket]); // eslint-disable-line react-hooks/exhaustive-deps
  const levels = useMemo<Level[]>(() => {
    const out: Level[] = [];
    /* every level that has a place on THIS chart: an option's way out where it was pinned to the name */
    const here = (ws: Excursion['targets']) => ws.filter(w => w.of !== 'contract');
    here(excursion.targets).forEach((w, i, all) => out.push({ price: w.price, ink: '--bull', title: all.length > 1 ? `target ${i + 1}` : 'target', dashed: true }));
    here(excursion.stops).forEach((w, i, all) => out.push({ price: w.price, ink: '--bear', title: all.length > 1 ? `stop ${i + 1}` : 'stop', dashed: true }));
    return out;
  }, [row.key, excursion]); // eslint-disable-line react-hooks/exhaustive-deps
  const pad = Math.max(45 * 60, (tOut - tIn) * 0.5);
  const last = tape.bars[tape.bars.length - 1];
  const keyLevels: KeyLevels = { spot: last?.close ?? 0, callWall: NaN, putWall: NaN, flip: NaN, supreme: NaN };

  return (
    <div className="flex flex-col min-w-0" data-journal-tape={row.key}>
      <div className="min-h-9 px-4 py-1 flex items-center gap-3 border-b border-borderSubtle/70">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-textPrimary whitespace-nowrap">The name while it was on</span>
        {/* a phone's head has room for the title and the card, not for the line between them */}
        <span className="min-w-0 font-mono text-[9px] uppercase tracking-widest text-textMuted truncate max-sm:hidden">{row.paper ? 'the hour before · the trade · as the desk drew it' : 'the day before · the trade · the rest of its last day'}</span>
        <span className="ml-auto">
          <DropdownSelect label="Candles" value={frame} options={FRAMES} onChange={setFrame} title="How long a candle is" align="end" size="sm" testId="journal-frame" />
        </span>
      </div>
      {row.paper && !path ? (
        <div className="px-6 flex flex-col items-center justify-center text-center bg-panel" style={{ height }} data-journal-tape-gone>
          <p className="text-[13px] text-textPrimary">This trade’s chart was not kept.</p>
          <p className="mt-1 max-w-[420px] text-[11px] leading-snug text-textMuted">A paper trade’s candles are written down when it closes, and the journal keeps them for the last {PATHS_KEPT} trades. Its figures, its tags and your words are all still here.</p>
        </div>
      ) : (
      <div className="relative bg-panel" style={{ height }} data-theme="dark" data-chart-ground={chartGround(themeKey)}>
        <StrikeChart
          ticker={symbol}
          paneId="journal:trade"
          revision={row.paper ? Math.floor(row.t.closed.at / 1000) : dayIndex((row.t as Extract<JournalRow, { paper?: undefined }>['t']).closed.day) * 2000 + (row.t as Extract<JournalRow, { paper?: undefined }>['t']).closed.minute}
          levels={keyLevels}
          timeframe={frame}
          tape={tape}
          overlays={OVERLAYS}
          indicators={DEFAULT_INDICATORS}
          drawing={roomToDraw && drawing}
          onEnterDraw={roomToDraw ? () => setDrawing(true) : undefined}
          onExitDraw={() => setDrawing(false)}
          height={height}
          frameless
          layer={api => <TradeLayer api={api} marks={marks} levels={levels} from={tIn - pad} to={tOut + pad} tradeKey={row.key} />}
        />
      </div>
      )}
    </div>
  );
};

export default TradeTape;
