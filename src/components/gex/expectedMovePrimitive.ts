import type { ISeriesPrimitive, SeriesAttachedParameter, Time, IChartApi, ISeriesApi } from 'lightweight-charts';
import type { ExpectedMoveCone } from '../../data/expectedMove';

/*
==================================================
  SLAYER TERMINAL - EXPECTED-MOVE LAYER — T-9
  (components/gex/expectedMovePrimitive.ts)
==================================================

  Draws data/expectedMove.ts on the tape: the envelope the options have been
  claiming since the open, and the cone they still claim from here to the
  bell. The engine is pure and proven headless; this file is only geometry.

  WHITE, AND ONLY WHITE. The dealer palette is spoken for (gold put-dominant,
  steel call-dominant, magenta supreme, gray flip, lime the user's marks) and
  red/green mean price direction. The cone is neither: it is a claim ABOUT
  spot, so it wears spot's ink at low alpha — present under the tape, never
  competing with it. A crossing needs no colour of its own either: it is
  drawn ON the edge that was crossed, and which edge carries which direction.

  THE FORWARD HALF DRAWS ON THE RUNWAY — the whitespace the chart already
  keeps to the right of the live bar (ensureRunway). Future minutes map
  through LOGICAL coordinates: the last bar is logical `barTimes.length - 1`
  and a point m minutes out sits at `+ m / barMinutes`, which lands
  fractional strides (a 12.5-minute remainder on 5-minute bars) exactly
  where they belong instead of snapping them to a slot.

  THE 0DTE COLLAPSE IS DRAWN, NOT PADDED. By late afternoon the forward claim
  is nearly nothing; the directive warns that an honest zero-width cone can
  read as a broken overlay. The answer here is not a minimum width — inflating
  the geometry would draw a claim the options are not making — it is the TAG:
  the tip always prints `EM ±$…`, so a collapsed cone reads "the claim is
  ±$0.04" rather than "the overlay died". The edges still converge to their
  point, which is the correct picture of the correct fact.
*/

/* Spot's white, at furniture alpha. */
const INK = '255,255,255';
const EDGE1_ALPHA = 0.32;
const EDGE2_ALPHA = 0.16;
const FILL_ALPHA = 0.05;
const CROSSING_ALPHA = 0.85;
const TAG_ALPHA = 0.62;

/* 2σ is the quieter, dashed pair — same convention on both halves. */
const DASH2 = [4, 4];
/** Crossing tick half-height, CSS px. */
const TICK = 4;

interface BitmapScope {
  context: CanvasRenderingContext2D;
  horizontalPixelRatio: number;
  verticalPixelRatio: number;
  mediaSize: { width: number; height: number };
}
interface DrawTarget {
  useBitmapCoordinateSpace(cb: (scope: BitmapScope) => void): void;
}

/** Everything one paint needs, swapped as a unit so a half-updated frame
    cannot pair yesterday's cone with today's bar grid. */
export interface ConeData {
  cone: ExpectedMoveCone;
  /** The DISPLAYED bars' times — the same grid the engine's session slice
      came from, so every past point is an exact hit. */
  barTimes: number[];
  barMinutes: number;
}

class ExpectedMoveRenderer {
  constructor(private source: ExpectedMovePrimitive) {}

  draw(target: DrawTarget): void {
    const src = this.source;
    const chart = src.chart;
    const series = src.series;
    const data = src.data;
    if (!chart || !series || !data) return;
    const { cone, barTimes, barMinutes } = data;
    if (cone.past.length === 0 && cone.forward.length === 0) return;

    target.useBitmapCoordinateSpace(scope => {
      const ctx = scope.context;
      const hr = scope.horizontalPixelRatio;
      const vr = scope.verticalPixelRatio;
      const w = scope.mediaSize.width * hr;

      const ts = chart.timeScale();
      /* time → bitmap x, exact-index over the displayed grid (the same
         binary search the drawings layer uses — see drawingsPrimitive). */
      const timeToX = (time: number): number | null => {
        if (barTimes.length === 0) return null;
        let lo = 0;
        let hi = barTimes.length - 1;
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          if (barTimes[mid] < time) lo = mid + 1;
          else hi = mid;
        }
        if (lo > 0 && Math.abs(barTimes[lo - 1] - time) < Math.abs(barTimes[lo] - time)) lo -= 1;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const x = ts.logicalToCoordinate(lo as any);
        return x === null ? null : x * hr;
      };
      /* MEASURED, not assumed: v5.2's logicalToCoordinate mishandles a
         FRACTIONAL logical — logical 610 mapped to x 1064 while 610.263
         returned 0, which dragged the cone's exact-close tip to the left
         edge and wrapped the fill across the whole tape. Integers go
         direct; fractions interpolate between their integer neighbours,
         which is exact because the logical axis is linear in x. */
      const logicalToX = (logical: number): number | null => {
        const lo = Math.floor(logical);
        const frac = logical - lo;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const x0 = ts.logicalToCoordinate(lo as any);
        if (x0 === null) return null;
        if (frac === 0) return x0 * hr;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const x1 = ts.logicalToCoordinate((lo + 1) as any);
        if (x1 === null) return x0 * hr;
        return (x0 + (x1 - x0) * frac) * hr;
      };
      const priceToY = (price: number): number | null => {
        const y = series.priceToCoordinate(price);
        return y === null ? null : y * vr;
      };

      const stroke = (pts: [number, number][], alpha: number, dash: number[]) => {
        if (pts.length < 2) return;
        ctx.strokeStyle = `rgba(${INK},${alpha})`;
        ctx.lineWidth = Math.max(1, Math.round(vr));
        ctx.setLineDash(dash.map(d => d * hr));
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.stroke();
        ctx.setLineDash([]);
      };

      ctx.save();

      /* ── the envelope since the open ──────────────────────────────────── */
      const up1: [number, number][] = [];
      const dn1: [number, number][] = [];
      const up2: [number, number][] = [];
      const dn2: [number, number][] = [];
      for (const p of cone.past) {
        const x = timeToX(p.time);
        if (x === null || x < -w || x > 2 * w) continue; // off the paint, skip cheaply
        const y1u = priceToY(p.up1), y1d = priceToY(p.dn1);
        const y2u = priceToY(p.up2), y2d = priceToY(p.dn2);
        if (y1u !== null && y1d !== null) { up1.push([x, y1u]); dn1.push([x, y1d]); }
        if (y2u !== null && y2d !== null) { up2.push([x, y2u]); dn2.push([x, y2d]); }
      }
      stroke(up2, EDGE2_ALPHA, DASH2);
      stroke(dn2, EDGE2_ALPHA, DASH2);
      stroke(up1, EDGE1_ALPHA, []);
      stroke(dn1, EDGE1_ALPHA, []);

      /* The session's exits, ticked ON the edge they crossed — the edge
         carries the direction, so no second ink is needed. */
      ctx.strokeStyle = `rgba(${INK},${CROSSING_ALPHA})`;
      ctx.lineWidth = Math.max(1, Math.round(vr));
      for (const c of cone.crossings) {
        const x = timeToX(c.time);
        const y = priceToY(c.edge);
        if (x === null || y === null) continue;
        ctx.beginPath();
        ctx.moveTo(x, y - TICK * vr);
        ctx.lineTo(x, y + TICK * vr);
        ctx.stroke();
      }

      /* ── the forward cone, on the runway ──────────────────────────────── */
      const anchor = barTimes.length - 1;
      const fUp1: [number, number][] = [];
      const fDn1: [number, number][] = [];
      const fUp2: [number, number][] = [];
      const fDn2: [number, number][] = [];
      for (const p of cone.forward) {
        const x = logicalToX(anchor + p.minutesAhead / barMinutes);
        if (x === null) continue;
        const y1u = priceToY(p.up1), y1d = priceToY(p.dn1);
        const y2u = priceToY(p.up2), y2d = priceToY(p.dn2);
        if (y1u !== null && y1d !== null) { fUp1.push([x, y1u]); fDn1.push([x, y1d]); }
        if (y2u !== null && y2d !== null) { fUp2.push([x, y2u]); fDn2.push([x, y2d]); }
        if (x > w) break; // past the right edge — nothing further can paint
      }

      /* A wash between the ±1σ edges. The runway has no bars under it, so
         the fill costs the tape nothing and gives the cone its shape. */
      if (fUp1.length >= 2) {
        ctx.fillStyle = `rgba(${INK},${FILL_ALPHA})`;
        ctx.beginPath();
        ctx.moveTo(fUp1[0][0], fUp1[0][1]);
        for (let i = 1; i < fUp1.length; i++) ctx.lineTo(fUp1[i][0], fUp1[i][1]);
        for (let i = fDn1.length - 1; i >= 0; i--) ctx.lineTo(fDn1[i][0], fDn1[i][1]);
        ctx.closePath();
        ctx.fill();
      }
      stroke(fUp2, EDGE2_ALPHA, DASH2);
      stroke(fDn2, EDGE2_ALPHA, DASH2);
      stroke(fUp1, EDGE1_ALPHA + 0.06, []);
      stroke(fDn1, EDGE1_ALPHA + 0.06, []);

      /* ── the tip's claim, in words ─────────────────────────────────────
         Always printed while the forward half exists — this is what keeps a
         collapsed 0DTE cone reading as a fact instead of a failure. */
      if (cone.forward.length > 0) {
        const tip = cone.forward[cone.forward.length - 1];
        const tipW1 = tip.up1 - cone.forward[0].up1; // forward[0] is spot exactly
        const label = `EM ±$${tipW1.toFixed(2)}`;
        ctx.font = `${9 * vr}px ui-monospace, SFMono-Regular, Menlo, monospace`;
        ctx.textBaseline = 'middle';
        const textW = ctx.measureText(label).width;
        const boxW = textW + 4 * 2 * hr;
        const boxH = 13 * vr + 2 * 2 * vr;
        const tipX = logicalToX(anchor + tip.minutesAhead / barMinutes);
        const tipY = priceToY(tip.up1);
        if (tipX !== null && tipY !== null) {
          /* Left of the tip, clamped onto the paint; riding the upper edge so
             it never sits on the live price line. */
          const x = Math.max(0, Math.min(w - boxW, tipX - boxW - 4 * hr));
          const top = Math.max(0, tipY - boxH - 2 * vr);
          ctx.fillStyle = 'rgba(10,10,10,0.55)';
          ctx.fillRect(x, top, boxW, boxH);
          ctx.fillStyle = `rgba(${INK},${TAG_ALPHA})`;
          ctx.fillText(label, x + 4 * hr, top + boxH / 2);
        }
      }

      ctx.restore();
    });
  }
}

class ExpectedMovePaneView {
  private _renderer: ExpectedMoveRenderer;
  constructor(source: ExpectedMovePrimitive) {
    this._renderer = new ExpectedMoveRenderer(source);
  }
  /* Under the tape, like the session rules — the candles are the subject and
     the claim is context. */
  zOrder(): 'bottom' {
    return 'bottom';
  }
  renderer(): ExpectedMoveRenderer {
    return this._renderer;
  }
}

export class ExpectedMovePrimitive implements ISeriesPrimitive<Time> {
  chart: IChartApi | null = null;
  series: ISeriesApi<'Candlestick'> | null = null;
  requestUpdate?: () => void;
  data: ConeData | null = null;
  private _paneViews: ExpectedMovePaneView[];

  constructor() {
    this._paneViews = [new ExpectedMovePaneView(this)];
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

  paneViews(): ExpectedMovePaneView[] {
    return this._paneViews;
  }

  /**
   * Swap what is drawn. No deep compare here, unlike the session layer's
   * setLines: the cone's spot re-anchor moves on every tick while the overlay
   * is on, so consecutive frames genuinely differ — comparing ~400 points to
   * discover that would cost more than the repaint it saves. Only the
   * off→off case is skipped.
   */
  setData(next: ConeData | null): void {
    const wasOff = this.data === null;
    this.data = next;
    if (!(wasOff && next === null)) this.requestUpdate?.();
  }
}
