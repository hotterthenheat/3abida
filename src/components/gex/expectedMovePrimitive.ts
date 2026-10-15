import type { ISeriesPrimitive, SeriesAttachedParameter, Time, IChartApi, ISeriesApi, ITimeScaleApi } from 'lightweight-charts';
import type { ExpectedMoveCone } from '../../data/expectedMove';
import type { ConePoint } from '../../data/feed/pricedMove';
import { alpha } from './paletteInk';
import { FONT_SANS } from '../../theme/fonts';
import { usd } from '../../core/format';

/* a token's ink at an alpha (paletteInk `alpha`, named apart from the strokes' own alpha figures) */
const inkAt = alpha;

/*
==================================================
  SLAYER TERMINAL - EXPECTED-MOVE LAYER — T-9
  (components/gex/expectedMovePrimitive.ts)
==================================================

  Draws data/expectedMove.ts on the tape: the envelope the options have been
  claiming since the open, and the cone they still claim from here to the
  bell. The engine is pure and proven headless; this file is only geometry.

  WHITE, AND ONLY WHITE. The dealer palette is spoken for (gold put-dominant,
  steel call-dominant, magenta supreme, gray flip, the silver accent the user's marks) and
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

/* Spot's ink at furniture alpha — the pane's own (`ink`, a token read off the chart's box), so a paper tape draws it dark
   (the audit's B-29: a literal white on every ground) */
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
  /** The pane's ink and panel, tokens read off the chart's box */
  ink: string;
  panel: string;
}
/** THE PRICED MOVE ON THE FEED (the owner's item 4, data/feed/pricedMove.ts): the day's ±1σ and ±2σ from the prior
    close's 4:00 pm straddle, standing the whole session, and the cone of what is left — 50%, 68% and 95% bands as
    stacked washes, no hard edge — with the readout at its head. Every ink the pane's own (`ink`, a token read off the
    chart's box), never a literal white. */
export interface PricedMoveData {
  kind: 'priced';
  barTimes: number[];
  barMinutes: number;
  ink: string;
  /** The session's first bar, seconds */
  from: number;
  prevClose: number;
  sigma: number;
  /** The cone from the last bar's end: minutes ahead, half-widths (50, 68, 95) */
  cone: ConePoint[];
  spot: number;
  readout: string;
  /** "priced at the prior close" or the like, said once beside the +1σ label */
  note: string;
  /** The session's last regular bar, seconds, once the session has closed — the lines end there, not on the evening */
  to: number | null;
  /** Each bar's high and low (beside barTimes) — the readout stands clear of the candles it is drawn over */
  highs: number[];
  lows: number[];
  /** The pane's ground, the readout's backing */
  panel: string;
}


class ExpectedMoveRenderer {
  constructor(private source: ExpectedMovePrimitive) {}

  draw(target: DrawTarget): void {
    const src = this.source;
    const chart = src.chart;
    const series = src.series;
    const data = src.data;
    if (!chart || !series || !data) return;
    if ('kind' in data && data.kind === 'priced') {
      drawPriced(target, chart, series, data);
      return;
    }
    const { cone, barTimes, barMinutes, ink, panel } = data as ConeData;
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
        const x = ts.logicalToCoordinate(scaleIndex(ts, barTimes, lo) as any);
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

      const stroke = (pts: [number, number][], a: number, dash: number[]) => {
        if (pts.length < 2) return;
        ctx.strokeStyle = inkAt(ink, a);
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
      ctx.strokeStyle = inkAt(ink, CROSSING_ALPHA);
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
      const anchor = scaleIndex(ts, barTimes, barTimes.length - 1);
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
        ctx.fillStyle = inkAt(ink, FILL_ALPHA);
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
        /* the house's one formatter (core/format) and the type floor, 11 px (the audit's B-29: "EM ±$0.00" at 9 px) */
        const label = `EM ±${usd(tipW1)}`;
        ctx.font = `${11 * vr}px ${FONT_SANS}`;
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
          ctx.fillStyle = inkAt(panel, 0.55);
          ctx.fillRect(x, top, boxW, boxH);
          ctx.fillStyle = inkAt(ink, TAG_ALPHA);
          ctx.fillText(label, x + 4 * hr, top + boxH / 2);
        }
      }

      ctx.restore();
    });
  }
}

/** The priced move's geometry (PricedMoveData) */
/** A bar's place on the TIME SCALE. The candle series holds only the recent window of the bars handed here
    (StrikeChart `windowOf` — the whole store lands once the reader scrolls left), so a position in `barTimes` is not a
    logical index; the scale's own lookup is (2026-10-13: the session's first bar mapped 2,900 bars past the right edge
    and the σ lines drew nothing). */
function scaleIndex(ts: ITimeScaleApi<Time>, barTimes: readonly number[], i: number): number {
  const idx = barTimes.length ? ts.timeToIndex(barTimes[Math.max(0, Math.min(barTimes.length - 1, i))] as Time, true) : null;
  return idx == null ? i : (idx as unknown as number);
}

function drawPriced(target: DrawTarget, chart: IChartApi, series: ISeriesApi<'Candlestick'>, d: PricedMoveData): void {
  if (!d.barTimes.length || !(d.sigma > 0)) return;
  target.useBitmapCoordinateSpace(scope => {
    const ctx = scope.context;
    const hr = scope.horizontalPixelRatio;
    const vr = scope.verticalPixelRatio;
    const W = scope.mediaSize.width * hr;
    const ts = chart.timeScale();
    const logicalToX = (logical: number): number | null => {
      const lo = Math.floor(logical);
      const frac = logical - lo;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const x0 = ts.logicalToCoordinate(lo as any);
      if (x0 === null) return null;
      if (frac === 0) return x0 * hr;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const x1 = ts.logicalToCoordinate((lo + 1) as any);
      return x1 === null ? x0 * hr : (x0 + (x1 - x0) * frac) * hr;
    };
    const indexOf = (time: number): number => {
      let lo = 0;
      let hi = d.barTimes.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (d.barTimes[mid] < time) lo = mid + 1;
        else hi = mid;
      }
      return lo;
    };
    const y = (price: number): number | null => {
      const v = series.priceToCoordinate(price);
      return v === null ? null : v * vr;
    };
    const last = scaleIndex(ts, d.barTimes, d.barTimes.length - 1);
    const coneEnd = d.cone.length ? d.cone[d.cone.length - 1].minutesAhead : 0;
    const xFrom = logicalToX(scaleIndex(ts, d.barTimes, indexOf(d.from))) ?? 0;
    /* the cone starts at the last bar's end (its centre + half a bar) */
    const xAt = (minutesAhead: number) => logicalToX(last + 0.5 + minutesAhead / d.barMinutes);
    /* the lines run to the close: the cone's end while the session runs, the last regular bar's end after it */
    const xEnd = Math.min(W, (d.to != null ? logicalToX(scaleIndex(ts, d.barTimes, indexOf(d.to)) + 0.5) : xAt(coneEnd)) ?? logicalToX(last) ?? W);

    /* THE CONE: three washes, the widest first, so the middle reads darkest — no edge drawn */
    if (d.cone.length > 1) {
      const washes = [0.06, 0.07, 0.09];
      for (let band = 2; band >= 0; band--) {
        ctx.beginPath();
        let first = true;
        for (const p of d.cone) {
          const x = xAt(p.minutesAhead);
          const yy = y(d.spot + p.half[band]);
          if (x === null || yy === null) continue;
          if (first) ctx.moveTo(x, yy);
          else ctx.lineTo(x, yy);
          first = false;
        }
        for (let i = d.cone.length - 1; i >= 0; i--) {
          const p = d.cone[i];
          const x = xAt(p.minutesAhead);
          const yy = y(d.spot - p.half[band]);
          if (x === null || yy === null) continue;
          ctx.lineTo(x, yy);
        }
        ctx.closePath();
        ctx.fillStyle = alpha(d.ink, washes[band]);
        ctx.fill();
      }
    }

    /* THE DAY'S LINES: ±1σ solid, ±2σ dashed, the prior close dotted, from the session's first bar */
    const lines: { k: number; a: number; dash: number[]; label: string }[] = [
      { k: 0, a: 0.28, dash: [1 * hr, 3 * hr], label: '' },
      { k: 1, a: 0.5, dash: [], label: '+1σ' },
      { k: -1, a: 0.5, dash: [], label: '−1σ' },
      { k: 2, a: 0.32, dash: [4 * hr, 4 * hr], label: '+2σ' },
      { k: -2, a: 0.32, dash: [4 * hr, 4 * hr], label: '−2σ' },
    ];
    ctx.lineWidth = Math.max(1, Math.round(hr));
    const font = Math.round(11 * vr);
    ctx.font = `${font}px ${FONT_SANS}`;
    ctx.textBaseline = 'middle';
    for (const l of lines) {
      const price = d.prevClose + l.k * d.sigma;
      const yy = y(price);
      if (yy === null) continue;
      ctx.setLineDash(l.dash);
      ctx.strokeStyle = alpha(d.ink, l.a);
      ctx.beginPath();
      ctx.moveTo(Math.max(0, xFrom), Math.round(yy) + 0.5);
      ctx.lineTo(xEnd, Math.round(yy) + 0.5);
      ctx.stroke();
      if (!l.label) continue;
      const text = `${l.label} ${price.toFixed(2)}${l.k === 1 && d.note ? ` · ${d.note}` : ''}`;
      const tw = ctx.measureText(text).width;
      const tx = Math.max(4 * hr, Math.min(xEnd - tw - 4 * hr, W - tw - 4 * hr));
      ctx.fillStyle = alpha(d.ink, 0.72);
      ctx.fillText(text, tx, yy - 8 * vr);
    }
    ctx.setLineDash([]);

    /* THE READOUT: at the cone's head where the cone has room for it; otherwise ending at the last bar, over (or, with no
       room above, under) the candles it spans — never at the right edge, where the pinned strike chips stand, nor in
       the band the chart keeps clear for the pane's chrome */
    if (d.readout) {
      const H = scope.mediaSize.height * vr;
      const tw = ctx.measureText(d.readout).width;
      const padX = 4 * hr;
      const boxH = Math.round(15 * vr);
      let clearTop = 0;
      try {
        clearTop = (series.priceScale().options().scaleMargins?.top ?? 0) * H;
      } catch {
        /* a chart mid-teardown */
      }
      const minY = clearTop + boxH * 1.5;
      const head = xAt(0);
      let tx: number;
      let ty: number | null = null;
      if (d.cone.length > 1 && head !== null && xEnd - head >= tw + 2 * padX + 6 * hr) {
        tx = head + 6 * hr;
        const yy = y(d.spot + Math.max(...d.cone.map(p => p.half[2])));
        ty = yy === null ? null : yy - boxH;
      } else {
        /* never past the plot's own edge (the audit's after-run: with the newest bar beyond the view's right edge the words
           ran off it, "−1.(") */
        const right = Math.min(W, logicalToX(last + 0.5) ?? W) - 4 * hr;
        tx = Math.max(padX, right - tw - 2 * padX);
        /* the bars under the text: from its left edge to the last bar */
        let hi = -Infinity;
        let lo = Infinity;
        for (let i = d.barTimes.length - 1; i >= 0; i--) {
          const x = logicalToX(scaleIndex(ts, d.barTimes, i));
          if (x === null || x < tx - 4 * hr) break;
          hi = Math.max(hi, d.highs[i]);
          lo = Math.min(lo, d.lows[i]);
        }
        const above = Number.isFinite(hi) ? y(hi) : y(d.spot);
        const below = Number.isFinite(lo) ? y(lo) : y(d.spot);
        if (above !== null && above - 6 * vr - boxH >= minY) ty = above - 6 * vr - boxH;
        else if (below !== null) ty = Math.min(H - boxH * 2, below + 6 * vr);
      }
      if (ty !== null) {
        ty = Math.max(minY, ty);
        ctx.fillStyle = alpha(d.panel, 0.78);
        ctx.fillRect(tx, ty, tw + 2 * padX, boxH);
        ctx.fillStyle = alpha(d.ink, 0.86);
        ctx.fillText(d.readout, tx + padX, ty + boxH / 2);
      }
    }
  });
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
  data: ConeData | PricedMoveData | null = null;
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
  setData(next: ConeData | PricedMoveData | null): void {
    const wasOff = this.data === null;
    this.data = next;
    if (!(wasOff && next === null)) this.requestUpdate?.();
  }
}
