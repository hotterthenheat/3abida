import type { ISeriesPrimitive, SeriesAttachedParameter, Time, IChartApi, ISeriesApi } from 'lightweight-charts';
import type { MarketEvent } from '../../data/events';

/*
==================================================
  SLAYER TERMINAL - EVENT MARKER LAYER — T-11
  (components/gex/eventsPrimitive.ts)
==================================================

  Draws data/events.ts along the tape's bottom edge: small glyphs in a thin
  lane above the time axis, one per event, past ones on their bars and
  future ones on the runway.

  GLYPHS CARRY THE KIND, SHAPE CARRIES THE SIDE, COLOUR CARRIES NOTHING.
  Earnings are a filled diamond, macro a hollow square, prints a triangle —
  pointing up for calls and down for puts, which is POSITION, not price
  direction, so it gets a shape and not an ink. Everything draws in the
  same steel the session furniture uses: an event is context, and none of
  the dealer palette's meanings apply to it.

  FUTURE X THROUGH THE SAME ARITHMETIC AS THE CONE — minutes ahead over the
  runway's logical axis, fractions interpolated (v5.2's logicalToCoordinate
  returns 0 for a fractional logical; measured in T-9, worked around the
  same way here).

  THE HOVER CARD IS THE HOST'S. This layer only draws; `eventAtX` answers
  "which event sits near this x", and StrikeChart floats the DOM card —
  canvas text cannot be hovered, and the card wants real type.

  KNOWN LIMIT, measured: on Terrain the pane's bottom-right corner carries
  the arrangement cluster (layout picker, STRIKES chip) as a SIBLING of the
  chart wrapper, so pointer moves over that ~300px patch never reach the
  wrapper's handler — a glyph underneath it draws but cannot be hovered
  until the view shifts it out from under the cluster. Every other x is
  live.
*/

const INK = '226,234,244';
const GLYPH = 4; // half-size, CSS px
/** The lane's centre line sits this far above the plot's bottom edge. */
const LANE = 10;

interface BitmapScope {
  context: CanvasRenderingContext2D;
  horizontalPixelRatio: number;
  verticalPixelRatio: number;
  mediaSize: { width: number; height: number };
}
interface DrawTarget {
  useBitmapCoordinateSpace(cb: (scope: BitmapScope) => void): void;
}

export interface EventsData {
  events: MarketEvent[];
  /** The displayed grid — past times map through it, futures ride past its
      last index. */
  barTimes: number[];
  barMinutes: number;
}

class EventsRenderer {
  constructor(private source: EventsPrimitive) {}

  draw(target: DrawTarget): void {
    const src = this.source;
    const data = src.data;
    if (!src.chart || !data || data.events.length === 0) return;

    target.useBitmapCoordinateSpace(scope => {
      const ctx = scope.context;
      const hr = scope.horizontalPixelRatio;
      const vr = scope.verticalPixelRatio;
      const w = scope.mediaSize.width * hr;
      /* MEASURED: mediaSize here spans the full canvas INCLUDING the time
         axis — a lane hung off it painted its glyphs into the axis strip.
         The plot's own floor comes from paneSize, which is what the lane is
         measured against everywhere else (hover guard included). */
      const paneH = src.chart ? src.chart.paneSize(0).height : scope.mediaSize.height;
      const y = (paneH - LANE) * vr;

      ctx.save();
      for (const e of data.events) {
        const cssX = src.xOf(e);
        if (cssX === null) continue;
        const x = cssX * hr;
        if (x < -20 || x > w + 20) continue;
        const g = GLYPH * vr;
        const hovered = src.hovered === e;
        const alpha = hovered ? 0.95 : 0.6;
        ctx.strokeStyle = `rgba(${INK},${alpha})`;
        ctx.fillStyle = `rgba(${INK},${alpha})`;
        ctx.lineWidth = Math.max(1, Math.round(vr));

        if (e.kind === 'earnings') {
          ctx.beginPath();
          ctx.moveTo(x, y - g);
          ctx.lineTo(x + g, y);
          ctx.lineTo(x, y + g);
          ctx.lineTo(x - g, y);
          ctx.closePath();
          ctx.fill();
        } else if (e.kind === 'macro') {
          ctx.strokeRect(x - g, y - g, g * 2, g * 2);
        } else {
          ctx.beginPath();
          if (e.side === 'P') {
            ctx.moveTo(x - g, y - g);
            ctx.lineTo(x + g, y - g);
            ctx.lineTo(x, y + g);
          } else {
            ctx.moveTo(x - g, y + g);
            ctx.lineTo(x + g, y + g);
            ctx.lineTo(x, y - g);
          }
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.restore();
    });
  }
}

class EventsPaneView {
  private _renderer: EventsRenderer;
  constructor(source: EventsPrimitive) {
    this._renderer = new EventsRenderer(source);
  }
  zOrder(): 'top' {
    return 'top';
  }
  renderer(): EventsRenderer {
    return this._renderer;
  }
}

export class EventsPrimitive implements ISeriesPrimitive<Time> {
  chart: IChartApi | null = null;
  series: ISeriesApi<'Candlestick'> | null = null;
  requestUpdate?: () => void;
  data: EventsData | null = null;
  hovered: MarketEvent | null = null;
  private _paneViews: EventsPaneView[];

  constructor() {
    this._paneViews = [new EventsPaneView(this)];
  }

  attached(param: SeriesAttachedParameter<Time>): void {
    this.chart = param.chart;
    this.series = param.series as ISeriesApi<'Candlestick'>;
    this.requestUpdate = param.requestUpdate;
  }

  detached(): void {
    this.chart = null;
    this.series = null;
    this.requestUpdate = undefined;
  }

  updateAllViews(): void {}

  paneViews(): EventsPaneView[] {
    return this._paneViews;
  }

  /** An event's CSS x on the current view, or null off-grid. */
  xOf(e: MarketEvent): number | null {
    const chart = this.chart;
    const data = this.data;
    if (!chart || !data || data.barTimes.length === 0) return null;
    const ts = chart.timeScale();
    const logicalToX = (logical: number): number | null => {
      const lo = Math.floor(logical);
      const frac = logical - lo;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const x0 = ts.logicalToCoordinate(lo as any);
      if (x0 === null) return null;
      if (frac === 0) return x0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const x1 = ts.logicalToCoordinate((lo + 1) as any);
      return x1 === null ? x0 : x0 + (x1 - x0) * frac;
    };
    if (e.minutesAhead !== undefined) {
      return logicalToX(data.barTimes.length - 1 + e.minutesAhead / data.barMinutes);
    }
    if (e.time === undefined) return null;
    const bt = data.barTimes;
    let lo = 0;
    let hi = bt.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (bt[mid] < e.time) lo = mid + 1;
      else hi = mid;
    }
    if (lo > 0 && Math.abs(bt[lo - 1] - e.time) < Math.abs(bt[lo] - e.time)) lo -= 1;
    return logicalToX(lo);
  }

  /** The event nearest an x, within the lane's reach — the hover card's
      question. `plotHeight` is the PANE's plot height (chart.paneSize), not
      the container's — the container carries the time axis under the plot
      and the lane is measured from the plot's own floor. The window reaches
      a little into the axis, because a pointer resting on the timestamps is
      still asking about the lane above them. */
  eventAtX(x: number, y: number, plotHeight: number): MarketEvent | null {
    if (!this.data) return null;
    if (y < plotHeight - LANE * 2.4 || y > plotHeight + 20) return null;
    let best: MarketEvent | null = null;
    let bestD = 7;
    for (const e of this.data.events) {
      const ex = this.xOf(e);
      if (ex === null) continue;
      const d = Math.abs(ex - x);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  setData(next: EventsData | null): void {
    const wasOff = this.data === null;
    this.data = next;
    if (!(wasOff && next === null)) this.requestUpdate?.();
  }

  setHovered(e: MarketEvent | null): void {
    if (this.hovered === e) return;
    this.hovered = e;
    this.requestUpdate?.();
  }
}
