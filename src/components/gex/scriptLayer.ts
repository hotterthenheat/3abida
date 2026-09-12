/*
==================================================
  SLAYER TERMINAL - A SCRIPT ON THE CHART (components/gex/scriptLayer.ts)

  What the Pine runtime hands back (core/pine
  RunResult) drawn onto a lightweight-charts pane:
  plots as line, step, histogram, area or dotted
  series with their per-bar inks; hlines as price
  lines; shapes as the library's markers; fills and
  background washes through one small primitive
  that paints between two series or behind the
  bars, since the library has no band of its own.
  One handle per placed script: a tick updates it
  in place, a change of shape rebuilds it, and the
  host tears it down whole.
==================================================
*/

import {
  AreaSeries,
  HistogramSeries,
  LineSeries,
  createSeriesMarkers,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type ISeriesPrimitive,
  type SeriesAttachedParameter,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import type { Bar, PlotOut, RunResult, ShapeOut } from '../../core/pine';

/* ---- the band primitive ------------------------------------------------------------- */

interface Band {
  a: Float64Array;
  b: Float64Array;
  colors: (string | null)[] | null;
  ink: string;
}

interface BitmapScope {
  context: CanvasRenderingContext2D;
  horizontalPixelRatio: number;
  verticalPixelRatio: number;
  mediaSize: { width: number; height: number };
}
interface DrawTarget {
  useBitmapCoordinateSpace(cb: (scope: BitmapScope) => void): void;
}

class BandRenderer {
  constructor(private src: BandPrimitive) {}
  draw(target: DrawTarget): void {
    const s = this.src;
    if (!s.chart || !s.series) return;
    if (s.bands.length === 0 && !s.columns) return;
    const chart = s.chart;
    const series = s.series;
    const times = s.times;
    target.useBitmapCoordinateSpace(scope => {
      const ctx = scope.context;
      const hr = scope.horizontalPixelRatio;
      const vr = scope.verticalPixelRatio;
      const h = scope.mediaSize.height * vr;
      const ts = chart.timeScale();
      const range = ts.getVisibleLogicalRange();
      if (!range) return;
      const from = Math.max(0, Math.floor(range.from) - 1);
      const to = Math.min(times.length - 1, Math.ceil(range.to) + 1);
      if (to < from) return;
      const xs = new Float64Array(to - from + 1);
      for (let i = from; i <= to; i++) {
        const x = ts.timeToCoordinate(times[i] as UTCTimestamp);
        xs[i - from] = x === null ? NaN : x * hr;
      }
      if (s.columns) {
        const w = Math.max(1, ts.options().barSpacing * hr);
        for (let i = from; i <= to; i++) {
          const c = s.columns[i];
          const x = xs[i - from];
          if (!c || Number.isNaN(x)) continue;
          ctx.fillStyle = c;
          ctx.fillRect(x - w / 2, 0, w, h);
        }
      }
      for (const band of s.bands) {
        let run: { color: string; top: [number, number][]; bottom: [number, number][] } | null = null;
        const flush = () => {
          if (run && run.top.length >= 2) {
            ctx.fillStyle = run.color;
            ctx.beginPath();
            ctx.moveTo(run.top[0][0], run.top[0][1]);
            for (let k = 1; k < run.top.length; k++) ctx.lineTo(run.top[k][0], run.top[k][1]);
            for (let k = run.bottom.length - 1; k >= 0; k--) ctx.lineTo(run.bottom[k][0], run.bottom[k][1]);
            ctx.closePath();
            ctx.fill();
          }
          run = null;
        };
        for (let i = from; i <= to; i++) {
          const x = xs[i - from];
          const av = band.a[i];
          const bv = band.b[i];
          const color = band.colors ? band.colors[i] : band.ink;
          if (Number.isNaN(x) || Number.isNaN(av) || Number.isNaN(bv) || !color) {
            flush();
            continue;
          }
          const ya = series.priceToCoordinate(av);
          const yb = series.priceToCoordinate(bv);
          if (ya === null || yb === null) {
            flush();
            continue;
          }
          if (run && run.color !== color) {
            run.top.push([x, ya * vr]);
            run.bottom.push([x, yb * vr]);
            flush();
          }
          if (!run) run = { color, top: [], bottom: [] };
          run.top.push([x, ya * vr]);
          run.bottom.push([x, yb * vr]);
        }
        flush();
      }
    });
  }
}

class BandPaneView {
  private r: BandRenderer;
  constructor(src: BandPrimitive) {
    this.r = new BandRenderer(src);
  }
  zOrder(): 'bottom' {
    return 'bottom';
  }
  renderer(): BandRenderer {
    return this.r;
  }
}

/** Fills between two of a script's plots and washes behind its bars — attached to one of the script's own series so it reads that pane's scale */
export class BandPrimitive implements ISeriesPrimitive<Time> {
  chart: IChartApi | null = null;
  series: ISeriesApi<'Line'> | ISeriesApi<'Histogram'> | ISeriesApi<'Area'> | null = null;
  requestUpdate?: () => void;
  bands: Band[] = [];
  columns: (string | null)[] | null = null;
  times: number[] = [];
  private views: BandPaneView[];
  constructor() {
    this.views = [new BandPaneView(this)];
  }
  attached(p: SeriesAttachedParameter<Time>): void {
    this.chart = p.chart;
    this.series = p.series as ISeriesApi<'Line'>;
    this.requestUpdate = p.requestUpdate;
  }
  detached(): void {
    this.chart = null;
    this.series = null;
    this.requestUpdate = undefined;
  }
  updateAllViews(): void {}
  paneViews(): BandPaneView[] {
    return this.views;
  }
  set(times: number[], bands: Band[], columns: (string | null)[] | null): void {
    this.times = times;
    this.bands = bands;
    this.columns = columns;
    this.requestUpdate?.();
  }
}

/* ---- points, markers, times ------------------------------------------------------- */

type AnySeries = ISeriesApi<'Line'> | ISeriesApi<'Histogram'> | ISeriesApi<'Area'>;
type Point = { time: UTCTimestamp; value: number; color?: string } | { time: UTCTimestamp };

/** The times a plot's points land on, shifted by its offset; past the last bar the clock keeps counting at the bar step */
function timesFor(bars: Bar[], offset: number): number[] {
  const n = bars.length;
  const step = n >= 2 ? bars[n - 1].time - bars[n - 2].time : 60;
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const j = i + offset;
    out[i] = j < 0 ? bars[0].time + j * step : j >= n ? bars[n - 1].time + (j - n + 1) * step : bars[j].time;
  }
  return out;
}

function pointsFor(p: PlotOut, bars: Bar[]): Point[] {
  const times = timesFor(bars, p.offset);
  const n = bars.length;
  const pts: Point[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const v = p.values[i];
    const t = times[i] as UTCTimestamp;
    if (Number.isNaN(v)) pts[i] = { time: t };
    else {
      const c = p.colors ? p.colors[i] : null;
      pts[i] = c ? { time: t, value: v, color: c } : { time: t, value: v };
    }
  }
  return pts;
}

const shapeOf = (style: string): SeriesMarker<Time>['shape'] => (style === 'triangleup' || style === 'arrowup' || style === 'labelup' ? 'arrowUp' : style === 'triangledown' || style === 'arrowdown' || style === 'labeldown' ? 'arrowDown' : style === 'square' || style === 'diamond' || style === 'flag' ? 'square' : 'circle');
const positionOf = (loc: string): 'aboveBar' | 'belowBar' | 'inBar' => (loc === 'belowbar' || loc === 'bottom' ? 'belowBar' : loc === 'absolute' ? 'inBar' : 'aboveBar');
const sizeOf = (size: string): number => (size === 'tiny' ? 0.6 : size === 'small' ? 0.8 : size === 'large' ? 1.5 : size === 'huge' ? 2 : 1);

function markersFor(sh: ShapeOut, bars: Bar[]): SeriesMarker<Time>[] {
  const list: SeriesMarker<Time>[] = [];
  for (let i = 0; i < bars.length; i++) {
    const v = sh.values[i];
    if (Number.isNaN(v)) continue;
    const color = (sh.colors ? sh.colors[i] : null) ?? sh.ink;
    const m: SeriesMarker<Time> = { time: bars[i].time as UTCTimestamp, position: positionOf(sh.location), shape: shapeOf(sh.style), color, size: sizeOf(sh.size) };
    if (sh.text) m.text = sh.text;
    list.push(m);
  }
  return list;
}

function bandsFor(run: RunResult, bars: Bar[]): { times: number[]; bands: Band[] } {
  const n = bars.length;
  const bands: Band[] = [];
  for (const f of run.fills) {
    const a = f.a.ref === 'plot' ? run.plots[f.a.index] : null;
    const b = f.b.ref === 'plot' ? run.plots[f.b.index] : null;
    if (a && b) bands.push({ a: a.values, b: b.values, colors: f.colors, ink: f.ink });
    else if (f.a.ref === 'hline' && f.b.ref === 'hline') {
      const ha = run.hlines[f.a.index];
      const hb = run.hlines[f.b.index];
      if (ha && hb) bands.push({ a: new Float64Array(n).fill(ha.price), b: new Float64Array(n).fill(hb.price), colors: f.colors, ink: f.ink });
    }
  }
  const firstFill = run.fills.find(f => f.a.ref === 'plot');
  const offset = firstFill ? (run.plots[firstFill.a.index]?.offset ?? 0) : 0;
  return { times: timesFor(bars, offset), bands };
}

/** The shape of a run — a different one means the series must be rebuilt */
const shapeSig = (run: RunResult): string => `${run.plots.map(p => `${p.hidden ? 'h' : p.style}:${p.width}:${p.ink}`).join(',')}|${run.shapes.length}|${run.hlines.length}|${run.fills.length}|${run.bgcolors ? 1 : 0}`;

/* ---- the handle ------------------------------------------------------------------------ */

export interface ScriptHandle {
  /** Redraw in place for a run of the same shape; false when the shape changed and the host must rebuild */
  update: (run: RunResult, bars: Bar[]) => boolean;
  destroy: () => void;
}

/**
 * Draw one run onto a pane. `paneIndex` 0 is the tape; an own-pane script
 * takes the index the host allocated.
 */
export function drawRun(chart: IChartApi, run: RunResult, bars: Bar[], paneIndex: number): ScriptHandle {
  const overlay = paneIndex === 0;
  const baseOpts = { priceLineVisible: false, lastValueVisible: !overlay, crosshairMarkerVisible: false, ...(overlay ? { priceScaleId: 'right' } : {}) };
  const sig = shapeSig(run);
  const plotSeries: { index: number; series: AnySeries }[] = [];
  const series: AnySeries[] = [];
  const markers: ISeriesMarkersPluginApi<Time>[] = [];
  let priceLines: IPriceLine[] = [];
  let band: BandPrimitive | null = null;

  const width = (w: number) => Math.min(4, Math.max(1, Math.round(w))) as 1 | 2 | 3 | 4;

  run.plots.forEach((p, index) => {
    if (p.hidden) return;
    const isHist = p.style === 'histogram' || p.style === 'columns';
    const isArea = p.style === 'area';
    const dotted = p.style === 'circles' || p.style === 'cross';
    let s: AnySeries;
    if (isHist) s = chart.addSeries(HistogramSeries, { ...baseOpts, color: p.ink, base: 0, priceFormat: { type: 'price', precision: 4, minMove: 0.0001 } }, paneIndex);
    else if (isArea) s = chart.addSeries(AreaSeries, { ...baseOpts, lineColor: p.ink, lineWidth: width(p.width), topColor: p.ink.startsWith('#') ? `${p.ink}55` : p.ink, bottomColor: 'rgba(0,0,0,0)' }, paneIndex);
    else s = chart.addSeries(LineSeries, { ...baseOpts, color: p.ink, lineWidth: width(p.width), lineType: p.style === 'stepline' ? 1 : 0, lineVisible: !dotted, pointMarkersVisible: dotted, pointMarkersRadius: dotted ? 2 : undefined }, paneIndex);
    s.setData(pointsFor(p, bars) as never);
    plotSeries.push({ index, series: s });
    series.push(s);
  });

  /* somewhere to hang markers, hlines and the band when a script draws no line of its own */
  let anchor = series[0];
  if (!anchor) {
    anchor = chart.addSeries(LineSeries, { ...baseOpts, color: 'rgba(0,0,0,0)', lineVisible: false, lastValueVisible: false }, paneIndex);
    anchor.setData(bars.map(b => ({ time: b.time as UTCTimestamp, value: b.close })) as never);
    series.push(anchor);
  }
  const anchorLine = anchor as ISeriesApi<'Line'>;

  const drawLines = (r: RunResult) => {
    for (const l of priceLines) anchorLine.removePriceLine(l);
    priceLines = [];
    for (const h of r.hlines) {
      if (Number.isNaN(h.price)) continue;
      priceLines.push(anchorLine.createPriceLine({ price: h.price, color: h.ink, lineWidth: width(h.width), lineStyle: h.style === 'dashed' ? 2 : h.style === 'dotted' ? 1 : 0, axisLabelVisible: false, title: '' }));
    }
  };
  drawLines(run);

  run.shapes.forEach(sh => markers.push(createSeriesMarkers(anchor, markersFor(sh, bars))));

  if (run.fills.length || run.bgcolors) {
    band = new BandPrimitive();
    anchor.attachPrimitive(band);
    const { times, bands } = bandsFor(run, bars);
    band.set(times, bands, run.bgcolors);
  }

  return {
    update(next, nextBars) {
      if (shapeSig(next) !== sig) return false;
      for (const { index, series: s } of plotSeries) s.setData(pointsFor(next.plots[index], nextBars) as never);
      if (!plotSeries.length) anchor.setData(nextBars.map(b => ({ time: b.time as UTCTimestamp, value: b.close })) as never);
      drawLines(next);
      next.shapes.forEach((sh, i) => markers[i]?.setMarkers(markersFor(sh, nextBars)));
      if (band) {
        const { times, bands } = bandsFor(next, nextBars);
        band.set(times, bands, next.bgcolors);
      }
      return true;
    },
    destroy() {
      for (const m of markers) {
        try {
          m.detach();
        } catch {
          /* gone with the chart */
        }
      }
      if (band) {
        try {
          anchor.detachPrimitive(band);
        } catch {
          /* gone with the chart */
        }
      }
      for (const s of series) {
        try {
          chart.removeSeries(s);
        } catch {
          /* chart already torn down */
        }
      }
    },
  };
}
