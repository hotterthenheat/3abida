/*
==================================================
  SLAYER TERMINAL - BANDS AND NOTES ON A SMALL CHART
  (components/record/plotNotesPrimitive.ts)

  Two things the library's price lines cannot do on
  their own, drawn on the chart's own canvas so the
  chart stays the library's (the crosshair, the
  card, the axes are untouched):

    A BAND   a soft fill between two prices across
             the whole plot — the pair's usual range
             (2026-09-29: three dashed lines read as
             three more lines; a band reads as a
             room the line lives in)
    A NOTE   a line's NAME inside the plot at its
             left end, one point above the line —
             the axis then carries the figure alone
             (three wide "usual high 1.267" tags
             collided on the pair's price scale)

  The band sits under the series, the notes over it.
==================================================
*/

import type { IChartApi, IPrimitivePaneRenderer, IPrimitivePaneView, ISeriesApi, ISeriesPrimitive, SeriesAttachedParameter, SeriesType, Time } from 'lightweight-charts';

interface BitmapScope {
  context: CanvasRenderingContext2D;
  horizontalPixelRatio: number;
  verticalPixelRatio: number;
  mediaSize: { width: number; height: number };
}
interface DrawTarget {
  useBitmapCoordinateSpace(cb: (scope: BitmapScope) => void): void;
}

const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

export interface PlotBand {
  from: number;
  to: number;
  /** The fill — a literal, the chart is its own island */
  fill: string;
  /** A hairline at each edge, or none */
  edge: string | null;
}
export interface PlotNote {
  price: number;
  text: string;
  color: string;
  /** Under the line rather than over it */
  below?: boolean;
}
export interface PlotNotesData {
  bands: PlotBand[];
  notes: PlotNote[];
  /** The plot's own ground — a note stands on a pill of it, so the line passing under it leaves it legible */
  ground?: string;
}

class BandRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly source: PlotNotesPrimitive) {}
  draw(target: DrawTarget): void {
    const { series, data } = this.source;
    if (!series || !data.bands.length) return;
    target.useBitmapCoordinateSpace(scope => {
      const ctx = scope.context;
      const vr = scope.verticalPixelRatio;
      const W = scope.mediaSize.width * scope.horizontalPixelRatio;
      for (const b of data.bands) {
        const y0 = series.priceToCoordinate(b.from);
        const y1 = series.priceToCoordinate(b.to);
        if (y0 == null || y1 == null) continue;
        const top = Math.min(y0, y1) * vr;
        const bottom = Math.max(y0, y1) * vr;
        ctx.fillStyle = b.fill;
        ctx.fillRect(0, top, W, bottom - top);
        if (b.edge) {
          ctx.strokeStyle = b.edge;
          ctx.lineWidth = Math.max(1, Math.round(vr));
          ctx.beginPath();
          ctx.moveTo(0, Math.round(top) + 0.5);
          ctx.lineTo(W, Math.round(top) + 0.5);
          ctx.moveTo(0, Math.round(bottom) + 0.5);
          ctx.lineTo(W, Math.round(bottom) + 0.5);
          ctx.stroke();
        }
      }
    });
  }
}

class NotesRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly source: PlotNotesPrimitive) {}
  draw(target: DrawTarget): void {
    const { series, data } = this.source;
    if (!series || !data.notes.length) return;
    target.useBitmapCoordinateSpace(scope => {
      const ctx = scope.context;
      const hr = scope.horizontalPixelRatio;
      const vr = scope.verticalPixelRatio;
      ctx.font = `600 ${9 * vr}px ${MONO}`;
      ctx.textAlign = 'left';
      const H = scope.mediaSize.height * vr;
      const x = 8 * hr;
      const h = 13 * vr;
      /* the pills already drawn — a note whose pill would sit on one takes the other side of its line, or stays unsaid
         (two levels half a dollar apart printed one word over the other, the trend's 20-day and support, 2026-09-29) */
      const drawn: { top: number; bottom: number }[] = [];
      const placed = data.notes
        .map(n => {
          const c = series.priceToCoordinate(n.price);
          return { n, y: c == null ? null : (c as number) };
        })
        .filter((p): p is { n: PlotNote; y: number } => p.y != null)
        .sort((p, q) => p.y - q.y);
      for (const { n, y } of placed) {
        const py = y * vr;
        if (py < 0 || py > H) continue;
        const rectFor = (below: boolean) => {
          const ty = py + (below ? 3 : -3) * vr;
          const top = below ? ty - 2 * vr : ty - h + 2 * vr;
          return { ty, top, bottom: top + h };
        };
        const clear = (r: { top: number; bottom: number }) => r.top >= 0 && r.bottom <= H && !drawn.some(d => r.top < d.bottom + vr && r.bottom > d.top - vr);
        /* over its line unless told otherwise or out of room; then under it; else unsaid */
        const first = n.below ?? py < 15 * vr;
        let below = first;
        let r = rectFor(below);
        if (!clear(r)) {
          below = !first;
          r = rectFor(below);
          if (!clear(r)) continue;
        }
        drawn.push({ top: r.top, bottom: r.bottom });
        if (data.ground) {
          const w = ctx.measureText(n.text).width + 8 * hr;
          ctx.globalAlpha = 0.85;
          ctx.fillStyle = data.ground;
          ctx.beginPath();
          ctx.roundRect(x - 4 * hr, r.top, w, h, 3 * hr);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        ctx.fillStyle = n.color;
        ctx.textBaseline = below ? 'top' : 'bottom';
        ctx.fillText(n.text, x, r.ty);
      }
    });
  }
}

class View implements IPrimitivePaneView {
  constructor(
    private readonly r: IPrimitivePaneRenderer,
    private readonly z: 'bottom' | 'top'
  ) {}
  zOrder(): 'bottom' | 'top' {
    return this.z;
  }
  renderer(): IPrimitivePaneRenderer {
    return this.r;
  }
}

export class PlotNotesPrimitive implements ISeriesPrimitive<Time> {
  chart: IChartApi | null = null;
  series: ISeriesApi<SeriesType> | null = null;
  data: PlotNotesData = { bands: [], notes: [] };
  private requestUpdate?: () => void;
  private readonly views: View[];
  constructor() {
    this.views = [new View(new BandRenderer(this), 'bottom'), new View(new NotesRenderer(this), 'top')];
  }
  attached(param: SeriesAttachedParameter<Time>): void {
    this.chart = param.chart;
    this.series = param.series;
    this.requestUpdate = param.requestUpdate;
  }
  detached(): void {
    this.chart = null;
    this.series = null;
    this.requestUpdate = undefined;
  }
  paneViews(): View[] {
    return this.views;
  }
  update(data: PlotNotesData): void {
    this.data = data;
    this.requestUpdate?.();
  }
}
