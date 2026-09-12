import { heatRampColor } from './heatmap';
import type { ISeriesPrimitive, SeriesAttachedParameter, Time, IChartApi, ISeriesApi } from 'lightweight-charts';
import type { GexSnapshot } from '../../types/market';

/*
  Exposure nodes — the ORIGINAL trail form, back by request (Noah,
  2026-08-22: "the prev exposure trail we used to have, the same one Skylit
  and a few others had"). For every bar-aligned snapshot, one small bead at
  each strike that carries enough gamma: its thickness and brightness are
  that moment's strength, and it simply isn't drawn when the strike stops
  mattering — so a wall reads as a dotted band that fattens as it builds,
  thins as it drains, and breaks where it died. Beads are anchored to
  absolute price (y) and time (x), so they stay pinned across timeframes.

  WHITE, not red/green (Noah): the trails say WHERE and HOW MUCH; the sign
  lives on the ladder, the map and the levels. Strength lives in alpha and
  height, never in desaturation.

  The level view rides on top: a focused strike's beads wear the focus ink
  (lime, or magenta while it is the supreme) at full strength, and the rest of
  the field steps back.
*/

/* THE FIELD'S OWN INKS (Noah, 2026-08-22): the house heatmap's steel-gold
   poles — gold = put-dominant / amplifying, steel = call-dominant /
   absorbing — and magenta on the supreme strike, as everywhere else. Not the
   market red/green: on THIS surface those belong to the candles, and a
   field in the tape's ink can't be told from the tape. The legend above the
   chart teaches the pair. Strength lives in height and alpha, never in
   desaturation. */
const PUT_RGB: readonly [number, number, number] = [245, 197, 66]; // honey gold
const CALL_RGB: readonly [number, number, number] = [214, 237, 248]; // glacier ice — the absorb pole (2026-08-29)
const SUPREME_RGB: readonly [number, number, number] = [234, 0, 255]; // magenta, restored — mirrors palette SUPREME
/* THE WALLS LIVE HERE (Noah, 2026-08-22: "I hate how they look on the side
   line"): each moment's call wall beads ink green, its put wall red, and the
   flip runs as a blue tick trail — the levels ON the tape, history included,
   instead of static lines at today's values. Same level rules as the chips
   used (buildLevelsFor): wall = heaviest |gamma| above/below that moment's
   close, flip = the sign-change midpoint nearest it. */
const CW_RGB: readonly [number, number, number] = [48, 209, 88]; // bull green
const PW_RGB: readonly [number, number, number] = [255, 59, 48]; // bear red
const FLIP_RGBA = 'rgba(156,163,175,0.8)'; // indecision gray — the regime border (mirrors palette FLIP); alpha raised with the 2026-08-29 weight pass

/* WHEN TWO IDENTITIES SHARE A STRIKE, THE SUPREME WINS OUTRIGHT (Noah,
   2026-08-29: "its so bright practically hard to miss especially on the
   charts" — then, shown a supreme-on-put-wall band rendering amber: "this is
   nowhere near neon"). The 2026-08-22 blends (wine/violet/amber) existed so
   a wall was never swallowed, but a 50/50 mix swallows the SUPREME instead —
   and lime diluted is olive, not neon. The wall's identity still gets told:
   its chip, its axis line, and the ladder's K·PW / K·CW tags all name it.
   The band belongs to the crown. */
const FLIPK_RGBA = 'rgba(234,0,255,0.85)'; // the supreme outranks the flip on a shared strike too

/* A dozen strikes per column, steep falloff; below the floor, nothing. The
   ranking happens ONCE, when the data arrives — a frame must never sort. */
const TOP_N = 12;
const MIN_STRENGTH = 0.08;

/** One bead: a strike's strength against the reference, and which side owns it */
interface Bead {
  strike: number;
  t: number;
  /** Sim side-coding: positive = put-dominant (amplifies), negative = call-dominant (absorbs) */
  put: boolean;
}

/** One column of the field, ranked and scaled at load time */
interface Column {
  time: number;
  /** The strikes that draw, strongest first */
  top: Bead[];
  /** Every strike — only consulted for a focused strike outside the top */
  all: Map<number, Bead>;
}

/** The focused level's ink: the focus lime — or the supreme's magenta while the
    focused strike IS the supreme. Mirrors palette FOCUS/SUPREME. */
export type FocusInk = 'focus' | 'supreme';
const INK_RGB: Record<FocusInk, readonly [number, number, number]> = {
  focus: [210, 255, 0],
  supreme: [234, 0, 255],
};

interface BitmapScope {
  context: CanvasRenderingContext2D;
  horizontalPixelRatio: number;
  verticalPixelRatio: number;
  mediaSize: { width: number; height: number };
  bitmapSize: { width: number; height: number };
}
interface DrawTarget {
  useBitmapCoordinateSpace(cb: (scope: BitmapScope) => void): void;
}

class TrailsPaneRenderer {
  constructor(private source: GexTrailsPrimitive) {}

  /*
    THE PATH CACHE (2026-08-29, the Weigher lag hunt). Building the bead
    field is the layer's whole cost — hundreds of columns × a dozen beads ×
    two subpaths — and it was rebuilt on EVERY repaint, including the 60fps
    crosshair repaints a hovering pointer causes. The profiler put ~90% of
    the desk's busy time here. The built Path2D batches are pure functions
    of (data revision, pan/zoom, the two scales, the identity inputs), so
    they are cached against exactly that fingerprint: a hover repaint now
    reuses them and only re-runs the ~30 fills. The vertical scale is
    captured by probing two prices — price→pixel is affine, so two points
    pin it completely.
  */
  private cacheKey = '';
  /** The field, rasterized — repaints between data ticks (crosshair moves
      run at 60fps) blit this instead of re-filling thousands of subpaths;
      the fill cost, not the path building, was the hover jank. */
  private bmp: HTMLCanvasElement | null = null;

  draw(target: DrawTarget): void {
    const src = this.source;
    if (!src.enabled || !src.chart || !src.series || src.snapshots.length === 0) return;
    const series = src.series;
    const ts = src.chart.timeScale();
    /* ONLY THE COLUMNS ON SCREEN (2026-09-06, the perf sweep): the field used
       to walk every snapshot in the store — 8,580 of them — on every data
       repaint, asking the time scale for a coordinate each, to find the few
       hundred that were visible. The snapshots are time-sorted, so the
       visible window is two binary searches, and the columns are built
       lazily as they are first seen (setData no longer ranks the whole
       session up front — the Weigher's open spent 96ms doing that). */
    const vis = ts.getVisibleRange();
    if (!vis) return;
    const fromT = Number(vis.from) - src.barSec * 2;
    const toT = Number(vis.to) + src.barSec * 2;
    const snaps = src.snapshots;
    let lo = 0;
    let hi = snaps.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (snaps[m].time < fromT) lo = m + 1;
      else hi = m;
    }
    const first = lo;
    lo = first;
    hi = snaps.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (snaps[m].time <= toT) lo = m + 1;
      else hi = m;
    }
    const last = lo; // exclusive
    if (last <= first) return;
    const col0 = src.columnAt(first);
    const barSpacing = ts.options().barSpacing ?? 6;
    if (src.ref <= 0) return;
    /* WAVEFORMS, NOT DOTS (Noah, 2026-08-22, against Sovereign's close-ups):
       a rail is a ribbon — every bead is as WIDE as its slot, so they touch,
       and the variation is VERTICAL: the ribbon's thickness flickers with
       each moment's strength, like an audio waveform. Weak strikes draw as
       hairline dashes, not specks. The ribbon is translucent and layered (a
       wider, fainter halo under a soft core) so candles show through it. */
    /* Amplitude follows the BAR WIDTH, not a fixed pixel count, so 15m/1h
       ribbons sit in proportion to their candles: the heaviest rail is
       ~60% of a bar tall, a hairline is under a pixel. t^1.6 keeps the
       weak field thin without crushing the mid-rails to nothing. */
    const A_MIN = 0.45;
    const A_MAX = Math.max(3, Math.min(barSpacing * 0.6, 9));
    const focus = src.focusStrike;
    const supreme = src.supremeStrike;
    const ink = INK_RGB[src.focusInk];
    const inkCss = `rgba(${ink[0]},${ink[1]},${ink[2]},0.95)`;

    target.useBitmapCoordinateSpace(scope => {
      const ctx = scope.context;
      const hr = scope.horizontalPixelRatio;
      const vr = scope.verticalPixelRatio;
      const wCss = scope.mediaSize.width;
      /* SUB-BAR BEADS (Noah, 2026-08-22: one bead per 30m/1h bar was a row of
         pearls): the field's clock is finer than the bars, so a bar holds
         several beads, each placed at its own time across the bar's width.
         On 1m/5m the slot IS the bar and nothing changes.
         BUDGET: never more columns than the pixels can show — a slot under
         ~3px wide is drawn every 2nd/3rd/nth, so a zoomed-out 1h chart costs
         the same frame as a 1m one (the price-scale drag lagged without it). */
      const barSec = src.barSec;
      const slots = Math.max(1, Math.round(barSec / Math.max(1, src.stepSec)));
      const stride = Math.max(1, Math.ceil(3 / (barSpacing / slots)));
      const drawnSlots = Math.max(1, Math.ceil(slots / stride));
      const rx = (barSpacing / drawnSlots) * 0.54 * hr;
      const halfW = barSpacing * 0.5;

      /* The cache fingerprint — see the field notes above. */
      const firstBucket = Math.floor(col0.time / barSec) * barSec;
      const x0 = ts.timeToCoordinate(firstBucket as Time);
      const probeA = series.priceToCoordinate(col0.top[0]?.strike ?? 0) ?? -1;
      const probeB = series.priceToCoordinate((col0.top[0]?.strike ?? 0) + 1) ?? -1;
      const key = `${src.rev}|${wCss}|${scope.mediaSize.height}|${barSpacing.toFixed(3)}|${x0}|${first}|${last}|${probeA.toFixed(2)}|${probeB.toFixed(2)}|${hr}|${vr}|${focus}|${supreme}|${src.cwStrike}|${src.pwStrike}|${src.flipPrice}|${src.focusInk}`;
      const cached = key === this.cacheKey && !!this.bmp;

      /* BATCHED: beads are gathered into one path per ink (alpha quantised to
         ~20 steps), then each path is filled once — into the BITMAP. */
      const cores = new Map<string, Path2D>();
      const halos = new Map<string, Path2D>();
      const flipPath = new Path2D();
      let flipDrawn = false;
      const pathFor = (map: Map<string, Path2D>, key: string) => {
        let p = map.get(key);
        if (!p) map.set(key, (p = new Path2D()));
        return p;
      };
      const yCache = new Map<number, number | null>();
      const yOf = (strike: number) => {
        let y = yCache.get(strike);
        if (y === undefined) {
          y = series.priceToCoordinate(strike);
          yCache.set(strike, y);
        }
        return y;
      };

      // ---- the beads (skipped whole when the cache holds) --------------------
      for (let ci = cached ? last : first; ci < last; ci++) {
        const col = src.columnAt(ci);
        // The bead's bar, and where inside it this moment sits
        const bucket = Math.floor(col.time / barSec) * barSec;
        const slot = slots > 1 ? Math.floor(((col.time - bucket) / barSec) * slots) : 0;
        if (slot % stride !== 0) continue;
        const xBar = ts.timeToCoordinate(bucket as Time);
        if (xBar === null || xBar < -halfW || xBar > wCss + halfW) continue;
        const x = slots > 1 ? xBar - halfW + ((slot / stride + 0.5) / drawnSlots) * barSpacing : xBar;
        const cx = x * hr;

        // The flip: ONE dotted blue line at TODAY'S flip — a tick per column
        // in the field's grammar, never a solid side line
        if (src.flipPrice != null) {
          const fy = series.priceToCoordinate(src.flipPrice);
          if (fy !== null) {
            /* Taller and near-continuous (Noah, 2026-08-29: "more noticable
               ... not color wise") — 90% slot coverage keeps it reading as a
               dashed rule rather than a row of crumbs. */
            const w = (barSpacing / drawnSlots) * 0.9 * hr;
            flipPath.rect(cx - w / 2, fy * vr - 1.3 * vr, w, 2.6 * vr);
            flipDrawn = true;
          }
        }

        // This moment's field, ranked at load — plus the focused strike at
        // EVERY moment, however faint (its history must have no gaps)
        let beads = col.top;
        if (focus != null && !beads.some(b => b.strike === focus)) {
          const fb = col.all.get(focus);
          if (fb) beads = [...beads, fb];
        }

        for (const bead of beads) {
          const isFocus = focus != null && bead.strike === focus;
          const y = yOf(bead.strike);
          if (y === null) continue;

          // t^1.6 — the amplitude; weak strikes stay hairlines, rails swell
          const t = Math.max(isFocus ? 0.08 : 0, bead.t);
          const s = Math.pow(t, 1.6);
          const ry = (A_MIN + s * (A_MAX - A_MIN)) * vr;
          const yc = y * vr;
          // Translucent on purpose — the tape reads THROUGH the ribbon
          let core = 0.16 + s * 0.5;
          let halo = 0.04 + s * 0.14;
          if (focus != null && !isFocus) {
            core *= 0.3; // the field steps back
            halo *= 0.3;
          }
          /* Ink precedence: the focus wins, then THE SUPREME — above the walls
             (Noah, 2026-08-29: the crown is never diluted; reverses the
             2026-08-22 wall-over-supreme order, whose worry — "I don't even see
             any put wall" — is answered by the wall's chip, axis line and
             the ladder's K·PW tag), then today's walls, then the side. */
          const isSupreme = supreme != null && bead.strike === supreme;
          /* SIDE BEADS TRAVEL THE HOUSE RAMP (ember/glacier, 2026-08-29 —
             "what about the charts"): each bead's hue comes from the ramp at
             its own strength, so a band heats oxblood → fire → gold where
             the book is heavy and cools where it drains — the ladder's
             journey, on the tape. Identity beads (focus/supreme/walls) keep
             their identity inks. The color-t is floored at 0.2 so the
             faintest bead still whispers in hue instead of vanishing into
             ramp-black — the alpha already carries the fade. Quantised to 8
             bins so the batcher stays a batcher. */
          const tBin = Math.min(7, Math.round((0.2 + 0.8 * t) * 7));
          const inkKey = isFocus
            ? 'f'
            : isSupreme
              ? 'k'
              : bead.strike === src.cwStrike
                ? 'cw'
                : bead.strike === src.pwStrike
                  ? 'pw'
                  : bead.put
                    ? `p@${tBin}`
                    : `c@${tBin}`;

          /* Each ELLIPSE bead is its OWN subpath: ellipse() draws a line
             from the path's current point to the ellipse's start, so without
             the moveTo every bead joined the last one. HAIRLINES DRAW AS
             RECTS (2026-08-29): under ~2px of height an ellipse is invisible
             arc math — the vast majority of beads — and rect() paths cost a
             fraction. Only the swelling rails keep the round nose. */
          const round = ry > 2 * vr;
          // The halo: wider and taller, faint — what makes the ribbon soft.
          // Gated on real pixels too: a halo around a sub-pixel bead is
          // path-building with no visible return.
          if (t > 0.2 && ry * 1.9 > 2.2 * vr) {
            const hx = rx * 1.15;
            const p = pathFor(halos, `${inkKey}|${Math.round(halo * 40)}`);
            if (round) {
              p.moveTo(cx + hx, yc);
              p.ellipse(cx, yc, hx, ry * 1.9, 0, 0, Math.PI * 2);
            } else {
              p.rect(cx - hx, yc - ry * 1.9, hx * 2, ry * 3.8);
            }
          }
          // The core: a slot-wide bead whose height is this moment's strength
          const p = pathFor(cores, `${inkKey}|${Math.round(core * 20)}`);
          if (round) {
            p.moveTo(cx + rx, yc);
            p.ellipse(cx, yc, rx, ry, 0, 0, Math.PI * 2);
          } else {
            p.rect(cx - rx, yc - ry, rx * 2, ry * 2);
          }
        }
      }

      const INKS: Record<string, readonly [number, number, number]> = {
        f: ink,
        k: SUPREME_RGB,
        cw: CW_RGB,
        pw: PW_RGB,
        p: PUT_RGB,
        c: CALL_RGB,
      };
      const paint = (tctx: CanvasRenderingContext2D, map: Map<string, Path2D>, step: number) => {
        for (const [key2, path] of map) {
          const [inkKey, q] = key2.split('|');
          const rgb =
            inkKey[1] === '@'
              ? heatRampColor(inkKey[0] === 'p' ? 1 : -1, Number(inkKey.slice(2)) / 7)
              : INKS[inkKey] ?? CALL_RGB;
          tctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${(Number(q) / step).toFixed(3)})`;
          tctx.fill(path);
        }
      };
      if (!cached) {
        const bmp = this.bmp && this.bmp.width === scope.bitmapSize.width && this.bmp.height === scope.bitmapSize.height
          ? this.bmp
          : document.createElement('canvas');
        bmp.width = scope.bitmapSize.width;
        bmp.height = scope.bitmapSize.height;
        const bctx = bmp.getContext('2d');
        if (bctx) {
          paint(bctx, halos, 40);
          paint(bctx, cores, 20);
          /* The regime border draws OVER the field (2026-08-29): it is the
             line the whole map hinges on, and under the beads it spent half
             its length buried in whatever band it crossed. */
          if (flipDrawn) {
            const flipOnSupreme = supreme != null && src.flipPrice != null && Math.abs(src.flipPrice - supreme) < 1e-6;
            bctx.fillStyle = flipOnSupreme ? FLIPK_RGBA : FLIP_RGBA;
            bctx.fill(flipPath);
          }
          this.bmp = bmp;
          this.cacheKey = key;
        }
      }
      if (this.bmp) ctx.drawImage(this.bmp, 0, 0);

      // ---- axis-side strength labels for the heaviest strikes ---------------
      const latest = src.snapshots[src.snapshots.length - 1];
      if (!latest) return;
      const total = latest.levels.reduce((s, l) => s + Math.abs(src.valueOf(l)), 0);
      if (total <= 0) return;

      // Four labels at most — one small sort on one snapshot, not per column
      const top = [...latest.levels]
        .map(l => ({ strike: l.strike, value: src.valueOf(l) }))
        .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
        .slice(0, 4)
        .filter(l => Math.abs(l.value) / total >= 0.08);

      const labelPx = src.labelPx;
      ctx.font = `${Math.round(labelPx * vr)}px "SF Pro", sans-serif`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      const xRight = (wCss - 8) * hr;

      const drawLabel = (lvl: { strike: number; value: number }, color: string) => {
        const y = series.priceToCoordinate(lvl.strike);
        if (y === null) return;
        const pct = Math.round((Math.abs(lvl.value) / total) * 100);
        const strikeLabel = lvl.strike % 1 === 0 ? lvl.strike.toFixed(0) : lvl.strike.toFixed(2);
        const text = `${strikeLabel} · ${pct}%`;
        const yPix = y * vr;

        // Dark backing pad so the label survives whatever sits behind it
        const w = ctx.measureText(text).width;
        /* The pad rides the type size. Fixed padding around shrinking text
           leaves the chip the same height with a smaller word rattling inside
           it — smaller type and no more room, which is the opposite of the
           point. */
        const scale = labelPx / 9.5;
        const padX = 4 * hr * scale;
        const padY = 2.5 * vr * scale;
        const boxH = 12 * vr * scale;
        ctx.fillStyle = 'rgba(5,5,5,0.72)';
        ctx.fillRect(xRight - w - padX, yPix - boxH / 2 - padY / 2, w + padX * 2, boxH + padY);
        ctx.fillStyle = color;
        ctx.fillText(text, xRight, yPix);
      };

      for (const lvl of top) {
        if (focus != null && lvl.strike === focus) continue; // drawn below, in its own ink
        const isSupreme = supreme != null && lvl.strike === supreme;
        const rgb = isSupreme ? SUPREME_RGB : lvl.value >= 0 ? PUT_RGB : CALL_RGB;
        /* The field's labels step back while a strike is focused — the SUPREME's
           never does. Lime at 0.55 is olive, not neon (the house lime rule:
           its identity IS luminance), and the crown is the one label that
           must survive every state. */
        drawLabel(lvl, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${focus != null && !isSupreme ? 0.55 : 0.95})`);
      }
      // The focused level is always labelled — its share of the book, in its ink
      if (focus != null) {
        const f = latest.levels.find(l => l.strike === focus);
        if (f) drawLabel(f, inkCss);
      }
    });
  }
}

class TrailsPaneView {
  private _renderer: TrailsPaneRenderer;
  constructor(source: GexTrailsPrimitive) {
    this._renderer = new TrailsPaneRenderer(source);
  }
  zOrder(): 'bottom' {
    return 'bottom';
  }
  renderer(): TrailsPaneRenderer {
    return this._renderer;
  }
}

/** A moment's largest |value|, remembered against the snapshot object */
/** Which exposure the beads draw — the head's Greek (2026-09-06). Gamma is the
    history's `value`; delta and vega ride beside it on every level. */
export type TrailGreek = 'gex' | 'dex' | 'vex';
const momentMax: Record<TrailGreek, WeakMap<GexSnapshot, number>> = { gex: new WeakMap(), dex: new WeakMap(), vex: new WeakMap() };
const levelValue = (l: GexSnapshot['levels'][number], greek: TrailGreek): number => (greek === 'gex' ? l.value : greek === 'dex' ? (l.dex ?? 0) : (l.vex ?? 0));

export class GexTrailsPrimitive implements ISeriesPrimitive<Time> {
  chart: IChartApi | null = null;
  series: ISeriesApi<'Candlestick'> | null = null;
  requestUpdate?: () => void;
  snapshots: GexSnapshot[] = [];
  maxAbs = 1;
  /** Robust strength reference: high percentile of per-moment maxima. Using
      the absolute max instead lets one freak spike crush every other wall. */
  ref = 0;
  enabled = true;
  /** The chart's bar length, seconds — a bead finds its bar by it */
  barSec = 60;
  /**
   * The strike chips' type size in CSS px — 9.5 normally, smaller on a phone.
   *
   * A field rather than another `setData` argument: it is a presentation
   * setting that changes with the HOST, while setData carries the data and is
   * called on every tick. Bundling them would make a size change look like new
   * data to every reader of this class.
   */
  labelPx = 9.5;
  /** The field's own clock, seconds between snapshots — beads per bar = barSec / stepSec */
  stepSec = 60;
  /** The level view's strike — its beads lead, the field steps back. */
  focusStrike: number | null = null;
  /** Its ink: lime, or magenta while the focused strike is the supreme. The
      focus never follows the supreme — the strike you clicked is the strike
      you're watching; the ink reports its standing (Noah, 2026-08-22). */
  focusInk: FocusInk = 'focus';
  /** The book's supreme strike — its band wears magenta (re-read every scan) */
  supremeStrike: number | null = null;
  /** TODAY'S levels — ONE green band, ONE red band, ONE blue flip line, all
      re-read every scan so they move with the math (Noah, 2026-08-22) */
  cwStrike: number | null = null;
  pwStrike: number | null = null;
  flipPrice: number | null = null;
  private _paneViews: TrailsPaneView[];

  constructor() {
    this._paneViews = [new TrailsPaneView(this)];
  }

  setSupreme(strike: number | null): void {
    if (this.supremeStrike === strike) return;
    this.supremeStrike = strike;
    this.requestUpdate?.();
  }

  setWalls(cw: number | null, pw: number | null, flip: number | null): void {
    if (this.cwStrike === cw && this.pwStrike === pw && this.flipPrice === flip) return;
    this.cwStrike = cw;
    this.pwStrike = pw;
    this.flipPrice = flip;
    this.requestUpdate?.();
  }

  setFocus(strike: number | null, ink: FocusInk = 'focus'): void {
    if (this.focusStrike === strike && this.focusInk === ink) return;
    this.focusStrike = strike;
    this.focusInk = ink;
    this.requestUpdate?.();
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

  paneViews(): TrailsPaneView[] {
    return this._paneViews;
  }

  /** Bumped on every data hand-off — the renderer's path cache keys on it. */
  rev = 0;
  /** Built columns by snapshot identity — see setData's incremental note. */
  private colCache = new WeakMap<GexSnapshot, { time: number; top: Bead[]; all: Map<number, Bead> }>();
  private colRef = -1;

  /** The Greek the beads draw — see TrailGreek */
  greek: TrailGreek = 'gex';
  private colGreek: TrailGreek = 'gex';
  valueOf(l: GexSnapshot['levels'][number]): number {
    return levelValue(l, this.greek);
  }

  setData(snapshots: GexSnapshot[], maxAbs: number, enabled: boolean, barSec = 60, greek: TrailGreek = 'gex'): void {
    this.rev++;
    this.snapshots = snapshots;
    this.maxAbs = maxAbs;
    this.barSec = barSec;
    this.greek = greek;
    // The snapshots' own spacing (the smallest gap between neighbours —
    // overnight gaps are larger and must not set it)
    let step = Infinity;
    for (let i = 1; i < snapshots.length; i++) {
      const d = snapshots[i].time - snapshots[i - 1].time;
      if (d > 0 && d < step) step = d;
    }
    this.stepSec = Number.isFinite(step) ? step : barSec;
    // Strength is ABSOLUTE against a stable window reference (a high
    // percentile of per-moment maxima), so a wall visibly builds and drains
    // over time instead of every moment being rescaled to its own peak.
    // Each moment's maximum is remembered against the snapshot object
    // (history snapshots are immutable; only the live last one is new each
    // tick), so a tick reads 1,700 numbers instead of walking 100,000 levels.
    const maxima: number[] = [];
    const memo = momentMax[greek];
    for (const s of snapshots) {
      let m = memo.get(s);
      if (m === undefined) {
        m = 0;
        for (const l of s.levels) {
          const a = Math.abs(levelValue(l, greek));
          if (a > m) m = a;
        }
        memo.set(s, m);
      }
      if (m > 0) maxima.push(m);
    }
    maxima.sort((a, b) => a - b);
    this.ref = maxima.length ? maxima[Math.min(maxima.length - 1, Math.floor(maxima.length * 0.85))] : 0;
    // Rank and scale every column NOW — draw() must never sort. And only
    // the columns that CHANGED (2026-08-29, the Weigher lag hunt): history
    // snapshots are immutable objects — only the live last one is replaced
    // each tick — so built columns cache against the snapshot's identity in
    // a WeakMap. A tick now builds ONE column instead of the whole session;
    // a reference shift (the 85th-percentile norm moving) drops the cache,
    // because every bead's t is baked against it.
    const ref = this.ref;
    if (ref !== this.colRef || greek !== this.colGreek) {
      this.colCache = new WeakMap();
      this.colRef = ref;
      this.colGreek = greek;
    }
    this.enabled = enabled;
    this.requestUpdate?.();
  }

  /** The column for snapshot i — built the first time it is on screen, then
      cached against the snapshot's identity (see setData's note). */
  columnAt(i: number): Column {
    const snap = this.snapshots[i];
    let col = this.colCache.get(snap);
    if (!col) {
      const ref = this.ref || 1;
      const all = new Map<number, Bead>();
      for (const l of snap.levels) {
        const v = this.valueOf(l);
        all.set(l.strike, { strike: l.strike, t: Math.min(1, Math.abs(v) / ref), put: v >= 0 });
      }
      const top = [...snap.levels]
        .sort((a, b) => Math.abs(this.valueOf(b)) - Math.abs(this.valueOf(a)))
        .slice(0, TOP_N)
        .map(l => all.get(l.strike)!)
        .filter(b => b.t >= MIN_STRENGTH);
      col = { time: snap.time, top, all };
      this.colCache.set(snap, col);
    }
    return col;
  }
}
