/*
==================================================
  SLAYER TERMINAL - WALLS THROUGH THE DAY
  (components/terrain/wallsHeatPrimitive.ts)

  A strike × time heatmap drawn BEHIND a Terrain pane's
  candles (the ideas report, 2026-10-09, idea 2): every
  strike's exposure through the session, one cell per
  bar and strike, so a wall that built, moved or drained
  reads where the price was when it did. The lens is the
  pane's: dealer gamma, delta, or charm.

  READ FROM THE BOOK THE SIMULATOR KEEPS — one snapshot
  of the book per minute bar (Simulator.getGexHistory:
  net gamma, delta, open interest at every strike), the
  same history the Map's replay reads (data/replay.ts).
  A bar takes the last snapshot inside it. Charm is not
  kept per minute: a minute's charm is today's charm at
  the strike scaled by that minute's share of the
  strike's gamma — the shape of the day, today's sign.

  ONE BITMAP PER UPDATE: the cells are painted into an
  offscreen canvas only when what they depend on moved
  (the visible range, the bar spacing, the price scale,
  the newest snapshot, the lens, the ground, the size);
  every other frame draws that canvas once. Never a
  looping animation. The time one paint takes is kept
  on `lastPaintMs` (and the host's data attribute) so
  it can be measured.

  INKS: the house ramp (heatmap.ts — ember where hedging
  amplifies, glacier where it absorbs), the paper ramp
  on a light tape; quiet alphas, under the candles.
==================================================
*/

import type { IChartApiBase, IPanePrimitive, Logical, IPanePrimitivePaneView, IPrimitivePaneRenderer, ISeriesApi, PaneAttachedParameter, SeriesType, Time } from 'lightweight-charts';
import type { CanvasRenderingTarget2D } from 'fancy-canvas';
import Simulator from '../../core/simulator';
import { HEAT_MODE, heatRampColorFor } from '../gex/heatmap';
import type { GexSnapshot } from '../../types/market';

export type WallsLens = 'gex' | 'dex' | 'charm';
export const WALLS_LENSES: { value: WallsLens; label: string; hint: string }[] = [
  { value: 'gex', label: 'GEX', hint: "Dealer gamma at each strike through the day — where hedging amplifies or absorbs a move" },
  { value: 'charm', label: 'Charm', hint: "How each strike's dealer delta drifts with time alone — the hedging the clock forces" },
  { value: 'dex', label: 'DEX', hint: 'Dealer delta at each strike through the day — the stock dealers hold against the book' },
];

interface Cell {
  x: number;
  y: number;
  w: number;
  h: number;
  v: number;
}

class WallsRenderer implements IPrimitivePaneRenderer {
  constructor(private src: WallsHeatPrimitive) {}
  draw(target: CanvasRenderingTarget2D): void {
    this.src.paint(target);
  }
}

class WallsView implements IPanePrimitivePaneView {
  private r: WallsRenderer;
  constructor(src: WallsHeatPrimitive) {
    this.r = new WallsRenderer(src);
  }
  zOrder(): 'bottom' {
    return 'bottom';
  }
  renderer(): IPrimitivePaneRenderer {
    return this.r;
  }
}

/* the last snapshot at or before `t`, by bisection — the history is in time order */
function snapAtOrBefore(hist: readonly GexSnapshot[], t: number): number {
  let lo = 0;
  let hi = hist.length - 1;
  if (hi < 0 || hist[0].time > t) return -1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (hist[mid].time <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export class WallsHeatPrimitive implements IPanePrimitive<Time> {
  private chart: IChartApiBase<Time> | null = null;
  private requestUpdate: (() => void) | null = null;
  private readonly views: WallsView[];
  /** The series price is read off — asked each time: a style swap replaces it */
  getSeries: () => ISeriesApi<SeriesType> | null = () => null;
  ticker = '';
  lens: WallsLens = 'gex';
  paper = false;
  enabled = false;
  /** How long the last full paint took, ms — for measuring */
  lastPaintMs = 0;
  onPaint?: (ms: number) => void;
  private cache: { key: string; canvas: HTMLCanvasElement } | null = null;

  constructor() {
    this.views = [new WallsView(this)];
  }
  attached({ chart, requestUpdate }: PaneAttachedParameter<Time>): void {
    this.chart = chart;
    this.requestUpdate = requestUpdate;
  }
  detached(): void {
    this.chart = null;
    this.requestUpdate = null;
    this.cache = null;
  }
  paneViews(): readonly IPanePrimitivePaneView[] {
    return this.views;
  }
  set(patch: Partial<Pick<WallsHeatPrimitive, 'ticker' | 'lens' | 'paper' | 'enabled'>>): void {
    let changed = false;
    for (const [k, v] of Object.entries(patch) as [keyof typeof patch, never][]) {
      if (this[k] !== v) {
        (this as Record<string, unknown>)[k] = v;
        changed = true;
      }
    }
    if (changed) {
      this.cache = null;
      this.requestUpdate?.();
    }
  }

  paint(target: CanvasRenderingTarget2D): void {
    if (!this.enabled || !this.chart) return;
    const series = this.getSeries();
    if (!series) return;
    const data = series.data() as readonly { time: Time }[];
    if (data.length < 2) return;
    const t0 = Number(data[0].time);
    const t1 = Number(data[1].time);
    /* intraday tapes only — a daily bar has no minutes to show */
    if (!(t1 - t0 > 0 && t1 - t0 < 86_400)) return;
    const hist = Simulator.getGexHistory(this.ticker);
    if (!hist || !hist.length) return;
    const ts = this.chart.timeScale();
    const range = ts.getVisibleLogicalRange();
    if (!range) return;
    const from = Math.max(0, Math.floor(range.from) - 1);
    const to = Math.min(data.length - 1, Math.ceil(range.to) + 1);
    if (to <= from) return;
    const spacing = ts.options().barSpacing;
    /* the price scale, read as where two prices a dollar apart land */
    const anchor = hist[hist.length - 1].levels[0]?.strike ?? 0;
    const y0 = series.priceToCoordinate(anchor) ?? 0;
    const y1 = series.priceToCoordinate(anchor + 1) ?? 0;

    target.useBitmapCoordinateSpace(scope => {
      const { context: ctx, bitmapSize, horizontalPixelRatio: hr, verticalPixelRatio: vr } = scope;
      const last = hist[hist.length - 1];
      const key = [bitmapSize.width, bitmapSize.height, from, to, spacing.toFixed(3), ts.logicalToCoordinate(from as Logical)?.toFixed(1), y0.toFixed(2), (y1 - y0).toFixed(3), last.time, last.levels.length, this.lens, this.paper, this.ticker].join('|');
      if (this.cache?.key !== key) {
        const started = performance.now();
        const canvas = this.cache?.canvas ?? document.createElement('canvas');
        canvas.width = bitmapSize.width;
        canvas.height = bitmapSize.height;
        const c = canvas.getContext('2d');
        if (!c) return;
        c.clearRect(0, 0, canvas.width, canvas.height);

        /* charm's template: today's charm and gamma at every strike */
        let charmBy: Map<number, { charm: number; gamma: number }> | null = null;
        if (this.lens === 'charm') {
          charmBy = new Map();
          try {
            for (const n of Simulator.snapshotFor(this.ticker).chain) charmBy.set(n.strike, { charm: n.netCharm, gamma: n.netGex });
          } catch {
            charmBy = null;
          }
        }
        const valueOf = (l: GexSnapshot['levels'][number]): number => {
          if (this.lens === 'gex') return l.value;
          if (this.lens === 'dex') return l.dex ?? 0;
          const t = charmBy?.get(l.strike);
          return t && t.gamma !== 0 ? t.charm * (l.value / t.gamma) : 0;
        };

        const cells: Cell[] = [];
        for (let i = from; i <= to; i++) {
          const bt = Number(data[i].time);
          const next = i + 1 < data.length ? Number(data[i + 1].time) : bt + (t1 - t0);
          /* the last snapshot inside the bar — or, for a bar finer than a minute, the minute it sits in */
          const si = snapAtOrBefore(hist, next - 1);
          if (si < 0 || hist[si].time < bt - 120) continue;
          const snap = hist[si];
          const xc = ts.timeToCoordinate(data[i].time);
          if (xc == null) continue;
          const levels = snap.levels;
          for (let k = 0; k < levels.length; k++) {
            const l = levels[k];
            const y = series.priceToCoordinate(l.strike);
            if (y == null) continue;
            const up = k + 1 < levels.length ? series.priceToCoordinate(levels[k + 1].strike) : null;
            const dn = k > 0 ? series.priceToCoordinate(levels[k - 1].strike) : null;
            const h = Math.max(1, Math.abs((up != null ? up : dn != null ? 2 * y - dn : y - 4) - y));
            const v = valueOf(l);
            if (v !== 0) cells.push({ x: xc - spacing / 2, y: y - h / 2, w: Math.max(1, spacing), h, v });
          }
        }
        /* the scale is the screen's own: the 95th percentile of what is in view, so one freak strike does not wash the rest */
        const mags = cells.map(cl => Math.abs(cl.v)).sort((a, b) => a - b);
        const ref = mags.length ? Math.max(1e-9, mags[Math.floor(mags.length * 0.95)] ?? mags[mags.length - 1]) : 1;
        /* quiet: the field sits under the candles, never over them */
        const base = this.paper ? 0.03 : 0.025;
        const span = this.paper ? 0.2 : 0.24;
        for (const cl of cells) {
          const t = Math.min(1, Math.abs(cl.v) / ref);
          if (t < 0.04) continue;
          const [r, g, b] = heatRampColorFor(cl.v >= 0 ? 1 : -1, 0.25 + 0.75 * t, HEAT_MODE, this.paper);
          c.fillStyle = `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${(base + span * t).toFixed(3)})`;
          /* edges rounded on their own, so neighbouring columns and rows meet with no seam between them */
          const l = Math.round(cl.x * hr);
          const t2 = Math.round(cl.y * vr);
          c.fillRect(l, t2, Math.max(1, Math.round((cl.x + cl.w) * hr) - l), Math.max(1, Math.round((cl.y + cl.h) * vr) - t2));
        }
        this.cache = { key, canvas };
        this.lastPaintMs = performance.now() - started;
        this.onPaint?.(this.lastPaintMs);
      }
      if (this.cache) ctx.drawImage(this.cache.canvas, 0, 0);
    });
  }
}
