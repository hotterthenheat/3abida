import { HEAT_MODE, heatRampColor, heatRampColorFor, inkFor } from './heatmap';
import { BEAD_STEPS, FIXED_SESSIONS, RunningScale, pooledRef, stepOf, stepT, strengthOf, type ScaleBasis, type ScaleRef } from '../../data/feed/beadScale';
import { num } from '../../core/format';
import type { ISeriesPrimitive, ISeriesPrimitiveAxisView, SeriesAttachedParameter, Time, IChartApi, ISeriesApi } from 'lightweight-charts';
import type { GexSnapshot } from '../../types/market';
import { FONT_SANS } from '../../theme/fonts';
import { pickFlip, pickWalls, zeroCrossings } from '../../core/walls';
import { nyClock } from '../../core/nyTime';
import { WALL_HOLD, wallMovesOf } from '../../data/feed/trailModel';

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
  (the silver accent, or magenta while it is the supreme) at full strength, and
  the rest of the field steps back.
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
   and a neon diluted is mud, not neon. The wall's identity still gets told:
   its chip, its axis line, and the ladder's K·PW / K·CW tags all name it.
   The band belongs to the crown. */
const FLIPK_RGBA = 'rgba(234,0,255,0.85)'; // the supreme outranks the flip on a shared strike too

/* EVERY STRIKE IN THE WINDOW DRAWS (the owner's second review, 2026-10-13, item 5: 774 stood at +$506M, half the
   reference, and drew nothing — only the twelve heaviest of a column were drawn), and since item 5 (e) every strike
   above zero: the floor is the reader's (`floor`, a share of the reference, off by default). The ranking happens ONCE,
   when the data arrives — a frame must never sort. */

/* STALENESS IN THE MARK ITSELF (item 5 (g) — "reduced opacity with a dotted outline, quantized to 3 steps. Do not use
   desaturation"): 0 a cell on today's vols, 1 a modeled cell with half or more of its gamma on vols older than an hour,
   2 a cell priced mostly on the session before's close vol (carried). The same inks; the core and halo at these shares
   of their alpha, filled dotted (STALE_COVER), and a dotted outline round a swelling bead. */
export const STALE_ALPHA = [1, 0.8, 0.6] as const;
/** The share of a stale bead its dotted fill covers (two on, one off; one on, one off) */
export const STALE_COVER = [1, 2 / 3, 1 / 2] as const;
const staleOf = (l: GexSnapshot['levels'][number]): 0 | 1 | 2 => (l.prov === 'carried' ? 2 : (l.staleShare ?? 0) >= 0.5 ? 1 : 0);
/** A bead's core and halo alpha at a step (the halo's under the core: what makes the ribbon soft) — one function, so the
    greyscale proof reads what is drawn */
export const coreAlpha = (s: number) => 0.16 + s * 0.5;
export const haloAlpha = (s: number) => 0.04 + s * 0.14;
/** The side ramp's colour at a step: floored at 0.2 so the faintest step still whispers in hue */
export const stepColourT = (s: number) => 0.2 + 0.8 * s;

/** One bead: a strike's step against the reference, and which side owns it */
interface Bead {
  strike: number;
  /** Its strength, √(|value| ÷ reference) clipped at 1, and the step it draws at (1..BEAD_STEPS) */
  t: number;
  step: number;
  /** Sim side-coding: positive = put-dominant (amplifies), negative = call-dominant (absorbs) */
  put: boolean;
  /** 0 fresh, 1 stale, 2 carried — STALE_ALPHA */
  stale: 0 | 1 | 2;
  /** Above the basis's p95 — it wears a ring (item 5 (c)) */
  ring: boolean;
}

/** One column of the field, ranked and scaled at load time */
interface Column {
  time: number;
  /** The strikes that draw, strongest first */
  top: Bead[];
  /** Every strike — only consulted for a focused strike outside the top */
  all: Map<number, Bead>;
  /** The reference this column's beads were measured against, and what it was built with */
  ref: number;
  key: string;
  /* THIS MOMENT'S OWN LEVELS (2026-10-13): the flip and the walls of the column's own book, against its own price —
     core/walls.ts pickFlip (the sign change nearest the price; null where the book never changes sign: a gap, never the
     last one carried) and pickWalls */
  flip: number | null;
  cw: number | null;
  pw: number | null;
  /** The moment's own price and the strikes' step — the density's distance fade reads them */
  spot: number;
  step: number;
}


/* A WALL THAT MOVES (2026-10-13): a chip at the moment the call or put wall changes strike — "CW 780 → 785 · 11:42" —
   counted once the new strike has held three moments (a wall trading places with its neighbour for a moment is not a
   move), the newest few on screen. The rule is trailModel's wallMovesOf (WALL_HOLD), the session recap's too. */
/** The wall chips keep this far in from the pane's left (the drawing rail) and right (the strength chips), CSS px */
const CHIP_LEFT = 58;
const CHIP_RIGHT = 96;
const WALL_CHIPS = 3;

/** What sits under the pointer on the field — the hover card's words come off it */
export interface BeadHit {
  strike: number;
  time: number;
  value: number;
  /** Its share of the moment's book, 0–1 */
  share: number;
  /** Its value at the day's 09:30 moment, when the field holds one */
  open: number | null;
  rebuilt: boolean;
  /** The cell itself — its provenance and staleness on the feed */
  level: GexSnapshot['levels'][number];
  /** The column's flip (its sign change nearest its price) and the other crossings near the price, nearest first */
  flip: number | null;
  crossings: number[];
  snap: GexSnapshot;
  x: number;
  y: number;
}

/** The focused level's ink: the focus silver (the house accent, the lime until
    2026-10-02) — or the supreme's magenta while the focused strike IS the
    supreme. Mirrors palette FOCUS/SUPREME. */
export type FocusInk = 'focus' | 'supreme';
const INK_RGB: Record<FocusInk, readonly [number, number, number]> = {
  focus: [199, 211, 232],
  supreme: [234, 0, 255],
};

type RGB3 = readonly [number, number, number];

/* THE FIELD ON PAPER (2026-10-02 — the owner, of the light Terrain: "it's the strike chart that's not going with the
   appearance"). Every ink above is cut for the black tape: honey gold and glacier ice beads, a light-silver focus, and
   chips on a black pad. On a light tape (a Stone pane, a light page's default) those beads were near-white streaks on
   pale grey and the chips black stickers on paper. So a light tape hands the field the inks of ITS OWN ground, read off
   the chart's box (index.css [data-chart-ground='light']): the side beads walk the paper ramp (heatmap.ts — the muted
   ink at nothing, the deep ember/glacier poles where the book is heavy), the walls and the supreme wear the paper
   bull/bear/supreme, the focus the deep silver, the flip the paper grey, and the chips sit on the tape's own panel. The
   dark tape is untouched. */
export interface TrailPaper {
  put: RGB3;
  call: RGB3;
  cw: RGB3;
  pw: RGB3;
  supreme: RGB3;
  focus: RGB3;
  flip: RGB3;
  pad: RGB3;
}
const tokenRgb = (el: Element, name: string, fallback: RGB3): RGB3 => {
  const v = getComputedStyle(el).getPropertyValue(name).trim().split(/[\s,]+/).map(Number);
  return v.length >= 3 && v.slice(0, 3).every(Number.isFinite) ? [v[0], v[1], v[2]] : fallback;
};
/** The field's inks on a light tape, read off an element inside the chart's box */
export function trailPaperFrom(el: Element): TrailPaper {
  return {
    put: heatRampColorFor(1, 1, HEAT_MODE, true),
    call: heatRampColorFor(-1, 1, HEAT_MODE, true),
    cw: tokenRgb(el, '--bull', [15, 107, 44]),
    pw: tokenRgb(el, '--bear', [168, 36, 27]),
    supreme: tokenRgb(el, '--supreme', [163, 0, 179]),
    focus: tokenRgb(el, '--select', [47, 61, 92]),
    flip: tokenRgb(el, '--flip', [107, 114, 128]),
    pad: tokenRgb(el, '--panel', [232, 231, 226]),
  };
}
const rgba = (c: RGB3, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
/** The axis labels' inks, read off an element inside the chart's box (the direction pair follows Settings' colour-vision
    choice through the tokens) */
export function axisInksFrom(el: Element): Record<'cw' | 'pw' | 'flip' | 'supreme' | 'put' | 'call', RGB3> {
  return {
    cw: tokenRgb(el, '--bull', [48, 209, 88]),
    pw: tokenRgb(el, '--bear', [255, 59, 48]),
    flip: tokenRgb(el, '--flip', [156, 163, 175]),
    supreme: tokenRgb(el, '--supreme', [234, 0, 255]),
    put: tokenRgb(el, '--ember', [245, 197, 66]),
    call: tokenRgb(el, '--glacier', [122, 189, 215]),
  };
}

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
  /** The stale steps' dotted fills, by ink and step — two device pixels on and one off (stale), one on and one off
      (carried), anchored to the bitmap so a row of beads dots evenly */
  private dotCache = new Map<string, CanvasPattern | string>();
  dots(ctx: CanvasRenderingContext2D, css: string, stale: 1 | 2, px: number): CanvasPattern | string {
    const key = `${css}|${stale}|${px}`;
    let p = this.dotCache.get(key);
    if (p) return p;
    const c = document.createElement('canvas');
    c.width = (stale === 2 ? 2 : 3) * px;
    c.height = 1;
    const g = c.getContext('2d');
    if (g) {
      g.fillStyle = css;
      g.fillRect(0, 0, (stale === 2 ? 1 : 2) * px, 1);
    }
    p = (g && ctx.createPattern(c, 'repeat')) || css;
    if (this.dotCache.size > 400) this.dotCache.clear();
    this.dotCache.set(key, p);
    return p;
  }

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
    if (import.meta.env?.DEV && src.published != null && src.published > 0 && last === snaps.length) {
      const drawn = src.columnAt(last - 1).ref;
      if (Math.abs(drawn - src.published) > src.published * 1e-12) console.error(`bead legend out of step: the legend says ${src.published}, the newest column was drawn against ${drawn}`);
    }
    /* WAVEFORMS, NOT DOTS (Noah, 2026-08-22, against Sovereign's close-ups):
       a rail is a ribbon — every bead is as WIDE as its slot, so they touch,
       and the variation is VERTICAL: the ribbon's thickness flickers with
       each moment's strength, like an audio waveform. Weak strikes draw as
       hairline dashes, not specks. The ribbon is translucent and layered (a
       wider, fainter halo under a soft core) so candles show through it. */
    /* Amplitude follows the BAR WIDTH, not a fixed pixel count, so 15m/1h
       ribbons sit in proportion to their candles: the heaviest rail is
       ~60% of a bar tall, a hairline is under a pixel. The strength is t, √(size ÷ the session's reference) — the scale
       the legend states (BEAD_SCALE). */
    const A_MIN = 0.45;
    const A_MAX = Math.max(3, Math.min(barSpacing * 0.6, 9));
    const focus = src.focusStrike;
    const supreme = src.supremeStrike;
    const paper = src.paper;
    const ink = paper ? (src.focusInk === 'supreme' ? paper.supreme : paper.focus) : INK_RGB[src.focusInk];
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
      const key = `${src.rev}|${wCss}|${scope.mediaSize.height}|${barSpacing.toFixed(3)}|${x0}|${first}|${last}|${probeA.toFixed(2)}|${probeB.toFixed(2)}|${hr}|${vr}|${focus}|${supreme}|${src.cwStrike}|${src.pwStrike}|${src.flipPrice}|${src.focusInk}|${paper ? 'paper' : 'dark'}|${src.density ? 'd' : 'e'}|${src.globalDim}`;
      const cached = key === this.cacheKey && !!this.bmp;

      /* BATCHED BY STEP (item 5 (d)): a bead's brightness is one of BEAD_STEPS steps a side, so the field is one Path2D
         per ink, step, staleness and dimming — filled once each, into the BITMAP. Rings (item 5 (c)) and the stale
         steps' dotted outlines (item 5 (g)) are a path per ink each, stroked once. */
      const cores = new Map<string, Path2D>();
      const halos = new Map<string, Path2D>();
      const rings = new Map<string, Path2D>();
      const dotted = new Map<string, Path2D>();
      const flipPath = new Path2D();
      const flipKPath = new Path2D();
      let flipDrawn = false;
      const pathFor = (map: Map<string, Path2D>, key: string) => {
        let p = map.get(key);
        if (!p) map.set(key, (p = new Path2D()));
        return p;
      };
      /* RUNS (item 5 (iv), the frame at full zoom-out): a hairline bead is a rect as wide as its slot, so neighbours at a
         strike overlap by design — a row of them at one step and staleness is ONE rect from the first's left edge to
         the last's right, the same pixels in one fill (a path's subpaths union, so nothing doubles), a fraction of the
         shapes. Keyed by strike and layer; a gap, a step change or a round bead between starts a new run. */
      type Run = { map: Map<string, Path2D>; key: string; x0: number; x1: number; y0: number; h: number };
      const runs = new Map<number, Run>();
      const flush = (r: Run) => pathFor(r.map, r.key).rect(r.x0, r.y0, r.x1 - r.x0, r.h);
      const runRect = (map: Map<string, Path2D>, layer: number, strike: number, key: string, x0: number, y0: number, w: number, h: number) => {
        const id = strike * 4 + layer;
        const r = runs.get(id);
        if (r && r.map === map && r.key === key && r.y0 === y0 && r.h === h && x0 <= r.x1 + 0.5) {
          if (x0 + w > r.x1) r.x1 = x0 + w;
          return;
        }
        if (r) flush(r);
        runs.set(id, { map, key, x0, x1: x0 + w, y0, h });
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
      const beadFloorCss = src.chromeInset > 0 ? src.chromeInset + 3 : 0;
      const paneHCss = scope.mediaSize.height;
      /* BEAD DENSITY (the Terrain UI pass, 2026-10-14): zoomed out past a session, a strike that is not one of the
         column's levels — its walls, its three heaviest, the supreme, the focus — draws at a quarter of its light, and a
         non-level strike more than fifteen steps from the column's price at six tenths; every strike still draws, the
         levels at full light at any zoom. `density` false (the legend's "Every strike") draws every bead whole. */
      const zoomedOut = src.density && (last - first) * Math.max(1, src.stepSec) > 8 * 3600;
      for (let ci = cached ? last : first; ci < last; ci++) {
        const col = src.columnAt(ci);
        const levelSet = zoomedOut || src.density ? new Set<number>([col.cw ?? NaN, col.pw ?? NaN, ...col.top.slice(0, 3).map(b => b.strike)]) : null;
        // The bead's bar, and where inside it this moment sits
        const bucket = Math.floor(col.time / barSec) * barSec;
        const slot = slots > 1 ? Math.floor(((col.time - bucket) / barSec) * slots) : 0;
        if (slot % stride !== 0) continue;
        const xBar = ts.timeToCoordinate(bucket as Time);
        if (xBar === null || xBar < -halfW || xBar > wCss + halfW) continue;
        const x = slots > 1 ? xBar - halfW + ((slot / stride + 0.5) / drawnSlots) * barSpacing : xBar;
        const cx = x * hr;

        // The flip: a tick per column in the field's grammar, never a solid side line — EACH COLUMN'S OWN flip
        // (2026-10-13), off its own book; a column whose book never changes sign has none, and the trail gaps there
        if (col.flip != null) {
          const fy = series.priceToCoordinate(col.flip);
          if (fy !== null) {
            /* Taller and near-continuous (Noah, 2026-08-29: "more noticable
               ... not color wise") — 90% slot coverage keeps it reading as a
               dashed rule rather than a row of crumbs. */
            const w = (barSpacing / drawnSlots) * 0.9 * hr;
            const onK = supreme != null && Math.abs(col.flip - supreme) < 1e-6;
            (onK ? flipKPath : flipPath).rect(cx - w / 2, fy * vr - 1.3 * vr, w, 2.6 * vr);
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
          /* IN RANGE ONLY (the owner's second review, 2026-10-13, item 2: "the 785 beads run along the top edge under
             the header"): a strike under the chrome band or off the pane's foot is not drawn — the fit keeps every
             strike in the candles' range clear of the band, and a wall beyond it is named by its pinned chip */
          if (y < beadFloorCss || y > paneHCss) continue;

          /* THE DRAWN STRENGTH IS THE STATED ONE: the step's own strength (item 5 (d)) — height, light and hue all
             follow it, so the legend's reference is what full brightness means */
          const step = Math.max(isFocus ? 1 : 0, bead.step);
          if (step <= 0) continue;
          const sd = stepT(step);
          const ry = (A_MIN + sd * (A_MAX - A_MIN)) * vr;
          const yc = y * vr;
          const stale = isFocus ? 0 : bead.stale;
          /* the light's factor: the field steps back behind a focus (0.3); the density's quarter and the distance's
             six tenths for a strike that is no level of its column */
          let dimA = focus != null && !isFocus ? 0.3 : 1;
          if (levelSet && !isFocus && !(supreme != null && bead.strike === supreme) && !levelSet.has(bead.strike)) {
            if (zoomedOut) dimA *= 0.25;
            if (Math.abs(bead.strike - col.spot) > 15 * col.step) dimA *= 0.6;
          }
          const dim = dimA >= 1 ? '1' : dimA.toFixed(2);
          /* Ink precedence: the focus wins, then THE SUPREME — above the walls
             (Noah, 2026-08-29: the crown is never diluted; reverses the
             2026-08-22 wall-over-supreme order, whose worry — "I don't even see
             any put wall" — is answered by the wall's chip, axis line and
             the ladder's K·PW tag), then today's walls, then the side. */
          const isSupreme = supreme != null && bead.strike === supreme;
          /* SIDE BEADS TRAVEL THE HOUSE RAMP (ember/glacier, 2026-08-29): each step's hue comes from the ramp at its
             own strength (stepColourT), so a band heats where the book is heavy and cools where it drains; identity
             beads (focus/supreme/walls) keep their identity inks */
          const inkKey = isFocus
            ? 'f'
            : isSupreme
              ? 'k'
              : bead.strike === src.cwStrike
                ? 'cw'
                : bead.strike === src.pwStrike
                  ? 'pw'
                  : bead.put
                    ? `p@${step}`
                    : `c@${step}`;
          const key2 = `${inkKey}|${step}|${stale}|${dim}`;

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
          if (sd > 0.2 && ry * 1.9 > 2.2 * vr) {
            const hx = rx * 1.15;
            if (round) {
              const p = pathFor(halos, key2);
              p.moveTo(cx + hx, yc);
              p.ellipse(cx, yc, hx, ry * 1.9, 0, 0, Math.PI * 2);
            } else {
              runRect(halos, 1, bead.strike, key2, cx - hx, yc - ry * 1.9, hx * 2, ry * 1.9 * 2);
            }
          }
          // The core: a slot-wide bead whose height is this moment's step
          if (round) {
            const p = pathFor(cores, key2);
            p.moveTo(cx + rx, yc);
            p.ellipse(cx, yc, rx, ry, 0, 0, Math.PI * 2);
          } else {
            runRect(cores, 0, bead.strike, key2, cx - rx, yc - ry, rx * 2, ry * 2);
          }
          /* THE RING (item 5 (c)): a bead above the basis's p95 — clipped at full brightness with the rest of the top
             step, and told apart by a hairline round it */
          if (bead.ring && dim === '1') {
            const g = 1.2 * vr;
            const r = pathFor(rings, inkKey.replace(/@\d+$/, ''));
            if (round) {
              r.moveTo(cx + rx + g, yc);
              r.ellipse(cx, yc, rx + g, ry + g, 0, 0, Math.PI * 2);
            } else r.rect(cx - rx - g, yc - ry - g, (rx + g) * 2, (ry + g) * 2);
          }
          /* THE STALE STEPS, DOTTED (item 5 (g)): a stale bead is filled with a dotted pattern of its ink (paint below) —
             a hairline reads as a dotted line, never a quieter solid one — and a swelling bead also wears a dotted outline.
             (Dots drawn as shapes cost 25,000 extra rects a frame at full zoom-out; a pattern costs none.) */
          if (stale > 0 && round) {
            const o = pathFor(dotted, `${inkKey.replace(/@\d+$/, '')}|${stale}`);
            const g = 0.8 * vr;
            o.moveTo(cx + rx + g, yc);
            o.ellipse(cx, yc, rx + g, ry + g, 0, 0, Math.PI * 2);
          }
        }
      }

      for (const r of runs.values()) flush(r);
      runs.clear();

      const INKS: Record<string, readonly [number, number, number]> = paper
        ? { f: ink, k: paper.supreme, cw: paper.cw, pw: paper.pw, p: paper.put, c: paper.call }
        : {
            f: ink,
            k: SUPREME_RGB,
            cw: CW_RGB,
            pw: PW_RGB,
            p: PUT_RGB,
            c: CALL_RGB,
          };
      const inkOf = (inkKey: string): RGB3 => {
        if (inkKey[1] === '@') {
          const sd = stepColourT(stepT(Number(inkKey.slice(2))));
          return paper ? heatRampColorFor(inkKey[0] === 'p' ? 1 : -1, sd, HEAT_MODE, true) : heatRampColor(inkKey[0] === 'p' ? 1 : -1, sd);
        }
        return INKS[inkKey] ?? INKS.c;
      };
      const paint = (tctx: CanvasRenderingContext2D, map: Map<string, Path2D>, alphaOf: (s: number) => number) => {
        for (const [key2, path] of map) {
          const [inkKey, step, stale, dim] = key2.split('|');
          const rgb = inkOf(inkKey);
          const a = alphaOf(stepT(Number(step))) * STALE_ALPHA[Number(stale) as 0 | 1 | 2] * Number(dim) * src.globalDim;
          const css = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a.toFixed(3)})`;
          tctx.fillStyle = stale === '0' ? css : this.dots(tctx, css, Number(stale) as 1 | 2, Math.max(1, Math.round(hr)));
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
          paint(bctx, halos, haloAlpha);
          paint(bctx, cores, coreAlpha);
          bctx.lineWidth = Math.max(1, Math.round(vr));
          for (const [inkKey, path] of rings) {
            const rgb = inkOf(inkKey === 'p' || inkKey === 'c' ? `${inkKey}@${BEAD_STEPS}` : inkKey);
            bctx.strokeStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.9)`;
            bctx.stroke(path);
          }
          bctx.lineWidth = Math.max(1, Math.round(vr * 0.8));
          for (const [k, path] of dotted) {
            const [inkKey, stale] = k.split('|');
            const rgb = inkOf(inkKey === 'p' || inkKey === 'c' ? `${inkKey}@${BEAD_STEPS}` : inkKey);
            bctx.setLineDash([1 * hr, (stale === '2' ? 1.5 : 2.5) * hr]);
            bctx.strokeStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${stale === '2' ? 0.55 : 0.65})`;
            bctx.stroke(path);
          }
          bctx.setLineDash([]);
          /* The regime border draws OVER the field (2026-08-29): it is the
             line the whole map hinges on, and under the beads it spent half
             its length buried in whatever band it crossed. */
          if (flipDrawn) {
            bctx.fillStyle = paper ? rgba(paper.flip, 0.85) : FLIP_RGBA;
            bctx.fill(flipPath);
            bctx.fillStyle = paper ? rgba(paper.supreme, 0.85) : FLIPK_RGBA;
            bctx.fill(flipKPath);
          }
          this.bmp = bmp;
          this.cacheKey = key;
        }
      }
      if (this.bmp) ctx.drawImage(this.bmp, 0, 0);

      // ---- the walls' moves: a chip where a wall changed strike and held --------------------------------------------
      {
        /* the rule is the session recap's too (trailModel wallMovesOf) */
        const moves = wallMovesOf(last, ci => src.columnAt(ci), WALL_HOLD, first);
        moves.sort((a, b) => b.time - a.time);
        const keep = moves.slice(0, WALL_CHIPS);
        if (keep.length) {
          const px = Math.max(11, src.labelPx);
          ctx.font = `${Math.round(px * vr)}px ${FONT_SANS}`;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          const boxes: { l: number; r: number; t: number; b: number }[] = [];
          const chipFloorCss = src.chromeInset > 0 ? src.chromeInset + 3 : 0;
          const chipPaneH = scope.mediaSize.height;
          for (const m of keep) {
            const bucket = Math.floor(m.time / barSec) * barSec;
            const xBar = ts.timeToCoordinate(bucket as Time);
            const yAt = series.priceToCoordinate(m.to);
            if (xBar === null || yAt === null) continue;
            /* A WALL BEYOND THE CLEAR AREA IS PINNED AT ITS EDGE AND SAYS SO (the owner's second review, 2026-10-13:
               "the '785 · 8%' chip sits at ~783.6 instead of on 785"): under the chrome band or off the foot, the chip
               stands at the edge with an arrow — never on a strike it does not name */
            const pin = yAt < chipFloorCss ? '▲ ' : yAt > chipPaneH ? '▼ ' : '';
            const y = pin === '▲ ' ? chipFloorCss : pin === '▼ ' ? chipPaneH : yAt;
            const fmt = (k: number) => (k % 1 === 0 ? num(k, 0) : num(k, 2));
            const text = `${pin}${m.kind} ${fmt(m.from)} → ${fmt(m.to)} · ${nyClock(m.time * 1000)}`;
            const w = ctx.measureText(text).width;
            const padX = 4 * hr;
            const full = (px + 5) * vr;
            /* clear of the drawing rail on the left and of the strength chips on the right: past the column when there is
               room, else before it */
            const leftMost = CHIP_LEFT * hr;
            const rightMost = (wCss - CHIP_RIGHT) * hr;
            let l = xBar * hr + 3 * hr;
            if (l + w + padX * 2 > rightMost) l = xBar * hr - 3 * hr - w - padX * 2;
            l = Math.max(leftMost, Math.min(l, rightMost - w - padX * 2));
            if (l + w + padX * 2 > rightMost) continue;
            /* above its line, off any chip placed already — and UNDER THE HOST'S CHROME, never over the timeframe
               tabs (the audit of 2026-10-13: "→ 780 · 8:45 am" stood on "1D"): a chip that would rise into the chrome
               band sits under it instead, below its line */
            const floor = src.chromeInset > 0 ? (src.chromeInset + 3) * vr : 0;
            let top = pin === '▲ ' ? floor : y * vr - full - 3 * vr;
            if (top < floor) top = Math.max(floor, y * vr + 3 * vr);
            for (const b of boxes) if (l < b.r && l + w + padX * 2 > b.l && top < b.b && top + full > b.t) top = b.b + 2 * vr;
            if (top < 0) continue;
            boxes.push({ l, r: l + w + padX * 2, t: top, b: top + full });
            const rgb = paper ? (m.kind === 'CW' ? paper.cw : paper.pw) : m.kind === 'CW' ? CW_RGB : PW_RGB;
            ctx.fillStyle = paper ? rgba(paper.pad, 0.86) : 'rgba(5,5,5,0.72)';
            ctx.fillRect(l, top, w + padX * 2, full);
            ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.95)`;
            ctx.fillText(text, l + padX, top + full / 2);
          }
        }
      }

      // ---- axis-side strength labels for the heaviest strikes ---------------
      /* off where the host names the heaviest strike on its axis chips (the Terrain UI pass): no chip over the candles */
      const latest = src.snapshots[src.snapshots.length - 1];
      if (!latest || !src.strengthLabels) return;
      const total = latest.levels.reduce((s, l) => s + Math.abs(src.valueOf(l)), 0);
      if (total <= 0) return;

      // Four labels at most — one small sort on one snapshot, not per column
      const top = [...latest.levels]
        .map(l => ({ strike: l.strike, value: src.valueOf(l) }))
        .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
        .slice(0, 4)
        .filter(l => Math.abs(l.value) / total >= 0.08);

      const labelPx = src.labelPx;
      ctx.font = `${Math.round(labelPx * vr)}px ${FONT_SANS}`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      const xRight = (wCss - 8) * hr;
      /* THE CHIPS NEVER STACK (the audit's TE-3: QQQ's "408 · 10% / 407 · 10% / 406 · 9% / 405 · 19%" printed in 30 px).
         Placed heaviest first — the focused strike, then the supreme, then by weight — each takes its own line's height;
         one that would land on a chip already placed may nudge up to half a chip off its line, else it is left out (its
         line and its beads still say it). And THE CHART'S RESET PILL keeps its corner (the audit's WE-6: "RESET" sat under
         "474 · 9%"): a chip in the pill's band moves left of it, on its own line. */
      const placed: { top: number; bottom: number }[] = [];
      const hCss = scope.mediaSize.height;
      const keepOut = { top: (hCss - 34) * vr, left: (wCss - 78) * hr };

      const labelFloorCss = src.chromeInset > 0 ? src.chromeInset + 3 : 0;
      const drawLabel = (lvl: { strike: number; value: number }, color: string) => {
        const yAt = series.priceToCoordinate(lvl.strike);
        if (yAt === null) return;
        /* A STRIKE BEYOND THE CLEAR AREA IS NAMED AT ITS EDGE WITH AN ARROW (the owner's second review, 2026-10-13),
           never on another strike's line */
        const pin = yAt < labelFloorCss ? '▲ ' : yAt > hCss ? '▼ ' : '';
        const y = pin === '▲ ' ? labelFloorCss : pin === '▼ ' ? hCss : yAt;
        const pct = Math.round((Math.abs(lvl.value) / total) * 100);
        const strikeLabel = lvl.strike % 1 === 0 ? num(lvl.strike, 0) : num(lvl.strike, 2);
        const text = `${pin}${strikeLabel} · ${pct}%`;

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
        /* UNDER THE HOST'S CHROME, NEVER BEHIND IT (Noah, 2026-09-14: the top
           wall's "430 · 17%" over the strip's fullscreen door): the label's box
           stops at the chrome's edge and slides down to sit under it — the line
           stays where the price is. The autoscale keeps the walls clear of the
           band by rest; this is for a tape the reader has scaled by hand. */
        let yPix = y * vr;
        const floor = src.chromeInset > 0 ? (src.chromeInset + 3) * vr : 0;
        const boxTop = yPix - boxH / 2 - padY / 2;
        if (boxTop < floor) yPix += floor - boxTop;
        const full = boxH + padY;
        if (pin === '▼ ') yPix = hCss * vr - full / 2 - padY;
        const gap = 2 * vr;
        const hits = (c: number) => placed.some(p => c - full / 2 < p.bottom + gap && c + full / 2 > p.top - gap);
        if (hits(yPix)) {
          const nudges = [-full / 2, full / 2, -full * 0.35, full * 0.35];
          const ok = nudges.map(d => yPix + d).find(c => !hits(c) && c - full / 2 >= floor);
          if (ok === undefined) return;
          yPix = ok;
        }
        placed.push({ top: yPix - full / 2, bottom: yPix + full / 2 });
        const right = yPix + full / 2 > keepOut.top ? Math.min(xRight, keepOut.left) : xRight;
        ctx.fillStyle = paper ? rgba(paper.pad, 0.86) : 'rgba(5,5,5,0.72)';
        ctx.fillRect(right - w - padX, yPix - full / 2, w + padX * 2, full);
        ctx.fillStyle = color;
        ctx.fillText(text, right, yPix);
      };

      // The focused level is always labelled — its share of the book, in its ink — and it is placed first
      if (focus != null) {
        const f = latest.levels.find(l => l.strike === focus);
        if (f) drawLabel({ strike: f.strike, value: src.valueOf(f) }, inkCss);
      }
      /* the supreme next, then by weight (the list is heaviest first already) */
      top.sort((a, b) => Number(b.strike === supreme) - Number(a.strike === supreme));
      for (const lvl of top) {
        if (focus != null && lvl.strike === focus) continue; // placed above, in its own ink
        const isSupreme = supreme != null && lvl.strike === supreme;
        const rgb = paper ? (isSupreme ? paper.supreme : lvl.value >= 0 ? paper.put : paper.call) : isSupreme ? SUPREME_RGB : lvl.value >= 0 ? PUT_RGB : CALL_RGB;
        /* The field's labels step back while a strike is focused — the SUPREME's
           never does. A neon at 0.55 is mud, not neon (its identity IS
           luminance), and the crown is the one label that must survive every
           state. */
        drawLabel(lvl, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${focus != null && !isSupreme ? 0.55 : 0.95})`);
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

/** What the legend prints (GexTrailsPrimitive.legend) */
export type BeadLegend = NonNullable<ReturnType<GexTrailsPrimitive['legend']>>;

/** One pinned label on the price axis */
class AxisLabel implements ISeriesPrimitiveAxisView {
  constructor(
    private y: number,
    private words: string,
    private rgb: RGB3,
    private shown: boolean
  ) {}
  coordinate(): number {
    return this.y;
  }
  text(): string {
    return this.words;
  }
  textColor(): string {
    return inkFor([this.rgb[0], this.rgb[1], this.rgb[2]]);
  }
  backColor(): string {
    return `rgb(${this.rgb[0]},${this.rgb[1]},${this.rgb[2]})`;
  }
  visible(): boolean {
    return this.shown;
  }
  tickVisible(): boolean {
    return false;
  }
}

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
  /** The host's floating chrome, CSS px from the pane's top to its lowest edge — the strike
      chips never paint behind it (set by the chart as it measures the strip; 0 = no chrome) */
  chromeInset = 0;
  /** The field's own clock, seconds between snapshots — beads per bar = barSec / stepSec */
  stepSec = 60;
  /** The level view's strike — its beads lead, the field steps back. */
  focusStrike: number | null = null;
  /** BEAD DENSITY (the Terrain UI pass): non-level strikes step back zoomed out and far from the price; off, every bead whole */
  density = true;
  /** The in-plot "772 · 9%" chips at the right edge — off where the host's axis chips name the heaviest strike */
  strengthLabels = true;
  /** THE STALE STATE (the UI pass): every bead's light times this — the host sets it under 1 while its data is old */
  globalDim = 1;
  /** Its ink: the silver accent, or magenta while the focused strike is the supreme. The
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

  /** The field's inks on a light tape, or null on a dark one — see TrailPaper */
  paper: TrailPaper | null = null;
  setPaper(paper: TrailPaper | null): void {
    if (JSON.stringify(this.paper) === JSON.stringify(paper)) return;
    this.paper = paper;
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

  paneViews(): TrailsPaneView[] {
    return this._paneViews;
  }

  /** Bumped on every data hand-off — the renderer's path cache keys on it. */
  rev = 0;
  /** Built columns by snapshot identity — see setData's incremental note. */
  private colCache = new WeakMap<GexSnapshot, Column>();

  /* THE REFERENCE IS TAKEN OVER MINUTES (the owner's item 5, 2026-10-13: "Full brightness = $X gamma per 1% (session p85
     of per-minute peaks, as of <time>)"): whatever the chart's timeframe, each minute's peak goes into the session's
     count (data/feed/beadScale.ts — the store's one code), and a column wider than a minute is measured against the
     reference as of its last minute. The base is the per-minute store the columns were folded from. */
  private baseIds: GexSnapshot[] = [];
  private baseTimes: number[] = [];
  private baseMax: number[] = [];
  private baseRef: number[] = [];
  private baseRing: number[] = [];
  private baseDays: string[] = [];
  /** Each minute's session's first minute (an index into the base) */
  private baseFirst: number[] = [];
  private baseRun = new RunningScale();
  /** refAt's answers by column, kept until the base, the basis or the references change */
  private refMemo = new WeakMap<GexSnapshot, ReturnType<GexTrailsPrimitive['refAt']>>();
  private baseGreek: TrailGreek = 'gex';
  /** Each New York day's per-minute peaks in the base, for the prior and fixed bases (built as the base is) */
  private dayMaxima = new Map<string, number[]>();
  private dayRefs = new Map<string, { prior: ScaleRef | null; fixed: ScaleRef | null; priorDay: string | null }>();

  /** The basis (item 5 (b)) and the floor (item 5 (e): a share of the reference; 0 = off) */
  basis: ScaleBasis = 'session';
  floor = 0;
  /** The server's references by New York day (the feed: the fixed over the 60 sessions before the day, and the prior),
      read before the base's own where it has them */
  external = new Map<string, { fixed: ScaleRef | null; prior: ScaleRef | null; priorDay: string | null }>();

  private baseFrom(base: GexSnapshot[], greek: TrailGreek): void {
    const memo = momentMax[greek];
    let k = 0;
    if (greek === this.baseGreek) while (k < this.baseIds.length && k < base.length && this.baseIds[k] === base[k]) k++;
    else this.baseGreek = greek;
    /* roll back to the first minute of k's session, so the running count restarts there */
    if (k > 0 && k < this.baseIds.length) {
      const day = this.baseDays[k - 1];
      while (k > 0 && this.baseDays[k - 1] === day) k--;
    }
    if (k < this.baseIds.length) {
      for (const d of new Set(this.baseDays.slice(k))) this.dayMaxima.delete(d);
      this.dayRefs.clear();
    }
    for (const arr of [this.baseIds, this.baseTimes, this.baseMax, this.baseRef, this.baseRing, this.baseDays, this.baseFirst] as unknown[][]) arr.length = k;
    this.baseRun.reset();
    this.refMemo = new WeakMap();
    let day = k > 0 ? this.baseDays[k - 1] : '';
    let first = k > 0 ? this.baseFirst[k - 1] : 0;
    for (let i = k; i < base.length; i++) {
      const snap = base[i];
      const d = nyDayKey(snap.time);
      if (d !== day) {
        day = d;
        first = i;
        this.baseRun.reset();
      }
      let m = memo.get(snap);
      if (m === undefined) {
        m = 0;
        for (const l of snap.levels) {
          const a = Math.abs(levelValue(l, greek));
          if (a > m) m = a;
        }
        memo.set(snap, m);
      }
      this.baseIds.push(snap);
      this.baseTimes.push(snap.time);
      this.baseMax.push(m);
      this.baseRef.push(this.baseRun.push(m));
      this.baseRing.push(this.baseRun.ring());
      this.baseDays.push(d);
      this.baseFirst.push(first);
      let list = this.dayMaxima.get(d);
      if (!list) this.dayMaxima.set(d, (list = []));
      list.push(m);
    }
  }

  /** The prior and fixed references for a New York day: the server's where it has them, else the base's own */
  private dayRef(day: string): { prior: ScaleRef | null; fixed: ScaleRef | null; priorDay: string | null } {
    let r = this.dayRefs.get(day);
    if (r) return r;
    const ext = this.external.get(day);
    const before = [...this.dayMaxima.keys()].filter(d => d < day).sort();
    const priorDay = before.length ? before[before.length - 1] : null;
    const prior = ext?.prior ?? (priorDay ? pooledRef(this.dayMaxima.get(priorDay)!, 1) : null);
    const pool = before.slice(-FIXED_SESSIONS);
    const fixed = ext?.fixed ?? (pool.length ? pooledRef(pool.flatMap(d => this.dayMaxima.get(d)!), pool.length) : null);
    r = { prior, fixed, priorDay: ext?.priorDay ?? priorDay };
    this.dayRefs.set(day, r);
    return r;
  }

  /** The reference column i is measured against — the basis's, as of the column's last minute; a basis with nothing to
      stand on (no session before loaded, none on the server) falls back to the session's own, and says so */
  refAt(i: number): { ref: number; ring: number; basis: ScaleBasis; at: number; minutes: number; sessions: number; priorDay: string | null } {
    const snap = this.snapshots[i];
    const had = this.refMemo.get(snap);
    if (had) return had;
    const got = this.refOf(snap);
    this.refMemo.set(snap, got);
    return got;
  }
  private refOf(snap: GexSnapshot): { ref: number; ring: number; basis: ScaleBasis; at: number; minutes: number; sessions: number; priorDay: string | null } {
    const end = snap.time + Math.max(60, this.stepSec) - 1;
    /* the last base minute at or before the column's end */
    let lo = 0;
    let hi = this.baseTimes.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (this.baseTimes[m] <= end) lo = m + 1;
      else hi = m;
    }
    const j = lo - 1;
    const day = nyDayKey(snap.time);
    if (this.basis !== 'session') {
      const r = this.dayRef(day);
      const got = this.basis === 'prior' ? r.prior : r.fixed;
      if (got) return { ref: got.ref, ring: got.ring, basis: this.basis, at: j >= 0 ? this.baseTimes[j] : snap.time, minutes: got.minutes, sessions: got.sessions, priorDay: r.priorDay };
    }
    if (j >= 0 && this.baseDays[j] === day) return { ref: this.baseRef[j], ring: this.baseRing[j], basis: 'session', at: this.baseTimes[j], minutes: j - this.baseFirst[j] + 1, sessions: 1, priorDay: null };
    return { ref: 0, ring: 0, basis: 'session', at: snap.time, minutes: 0, sessions: 0, priorDay: null };
  }

  /** The reference the host last handed the legend — the renderer checks the newest column against it in development
      (item 5 acceptance (i): "the legend value equals the reference the renderer used at that minute (assert)") */
  published: number | null = null;
  /** What the legend prints: the newest column's reference, the very number its beads were drawn against */
  legend(): (ReturnType<GexTrailsPrimitive['refAt']> & { greek: TrailGreek }) | null {
    if (!this.snapshots.length) return null;
    const r = this.refAt(this.snapshots.length - 1);
    return r.ref > 0 ? { ...r, greek: this.greek } : null;
  }

  setBasis(basis: ScaleBasis, floor: number): void {
    if (this.basis === basis && this.floor === floor) return;
    this.basis = basis;
    this.floor = floor;
    this.refMemo = new WeakMap();
    this.rev++;
    this.requestUpdate?.();
  }
  setExternal(refs: Map<string, { fixed: ScaleRef | null; prior: ScaleRef | null; priorDay: string | null }>): void {
    this.external = refs;
    this.dayRefs.clear();
    this.refMemo = new WeakMap();
    this.rev++;
    this.requestUpdate?.();
  }

  /** The Greek the beads draw — see TrailGreek */
  greek: TrailGreek = 'gex';
  private colGreek: TrailGreek = 'gex';
  valueOf(l: GexSnapshot['levels'][number]): number {
    return levelValue(l, this.greek);
  }

  setData(snapshots: GexSnapshot[], maxAbs: number, enabled: boolean, barSec = 60, greek: TrailGreek = 'gex', base?: GexSnapshot[]): void {
    if (greek !== this.colGreek) {
      this.colCache = new WeakMap();
      this.colGreek = greek;
    }
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
    /* THE SCALE RUNS FORWARD (2026-10-13, the research's look-ahead rule): strength is ABSOLUTE against a stable
       reference — the 85th percentile of the per-minute peaks — each minute's taken over the minutes AT OR BEFORE it IN
       ITS OWN SESSION (New York's date), so nothing to its right changes what is drawn on its left and a quiet session
       is not dimmed by a loud one before it. Kept incrementally by identity: a tick that replaces the live last minute
       re-reads its session's count, and a store whose front moved starts over in a few milliseconds. */
    this.baseFrom(base ?? snapshots, greek);
    this.ref = snapshots.length ? this.refAt(snapshots.length - 1).ref : 0;
    this.enabled = enabled;
    this.requestUpdate?.();
  }

  /** The column for snapshot i — built the first time it is on screen, then
      cached against the snapshot's identity (see setData's note). */
  columnAt(i: number): Column {
    const snap = this.snapshots[i];
    let col = this.colCache.get(snap);
    const r = this.refAt(i);
    const ref = r.ref || this.ref || 1;
    const key = `${ref}|${r.ring}|${this.floor}`;
    if (!col || col.key !== key) {
      const all = new Map<number, Bead>();
      for (const l of snap.levels) {
        const v = this.valueOf(l);
        /* A SQUARE-ROOT SCALE ON MAGNITUDE (2026-10-13 — the owner: "Use a square-root scale on magnitude"): one strike
           holding a third of the book no longer leaves the rest unlit — a strike at a quarter of the reference draws at
           half strength — quantized to its step (item 5 (d)) */
        const t = strengthOf(v, ref);
        all.set(l.strike, { strike: l.strike, t, step: stepOf(t), put: v >= 0, stale: staleOf(l), ring: r.ring > 0 && Math.abs(v) > r.ring });
      }
      const floorAbs = this.floor * ref;
      const top = [...snap.levels]
        .filter(l => Math.abs(this.valueOf(l)) > 0 && Math.abs(this.valueOf(l)) >= floorAbs)
        .sort((a, b) => Math.abs(this.valueOf(b)) - Math.abs(this.valueOf(a)))
        .map(l => all.get(l.strike)!)
        .filter(b => b.step > 0);
      /* the moment's own price — the snapshot's, else its window's middle (the house's window is centred on it) */
      const spot = snap.spot ?? snap.levels[Math.floor(snap.levels.length / 2)]?.strike ?? 0;
      const flip = snap.levels.length > 1 ? pickFlip(snap.levels, spot, l => l.value) : null;
      const walls = pickWalls(snap.levels, spot, l => l.value);
      let step = Infinity;
      for (let i = 1; i < snap.levels.length; i++) {
        const d = Math.abs(snap.levels[i].strike - snap.levels[i - 1].strike);
        if (d > 0 && d < step) step = d;
      }
      col = { time: snap.time, top, all, ref, key, flip, cw: walls.callWall, pw: walls.putWall, spot, step: Number.isFinite(step) ? step : 1 };
      this.colCache.set(snap, col);
    }
    return col;
  }

  /* THE KEY LEVELS PINNED ON THE PRICE AXIS (item 5 (h)): the call wall, the put wall and the flip — the ladder's own,
     the same strikes the field inks — and at most two more, the supreme and the heaviest strike after it, each its
     PRICE on the level's ink, never a name (the house keeps names off the axis). A level beyond the clear area stands
     at the edge with an arrow, as the chips do; the library moves labels apart where they would overlap. */
  private axisViews: AxisLabel[] = [];
  priceAxisViews(): readonly ISeriesPrimitiveAxisView[] {
    return this.enabled && this.axisLabels ? this.axisViews : [];
  }
  axisLabels = true;
  /** The book's levels for the axis — the ladder's call wall, put wall, flip and supreme, whatever the Key levels
      overlay says (it only decides whether the field's beads wear the walls' inks) */
  private axisLv: { cw: number | null; pw: number | null; flip: number | null; supreme: number | null } = { cw: null, pw: null, flip: null, supreme: null };
  setAxisLevels(lv: { cw: number | null; pw: number | null; flip: number | null; supreme: number | null }): void {
    const a = this.axisLv;
    if (a.cw === lv.cw && a.pw === lv.pw && a.flip === lv.flip && a.supreme === lv.supreme) return;
    this.axisLv = lv;
    this.requestUpdate?.();
  }
  /** The inks the axis labels wear, read off the chart's box by the host (tokens: --bull, --bear, --flip, --supreme,
      --ember, --glacier, --panel) */
  axisInks: Record<'cw' | 'pw' | 'flip' | 'supreme' | 'put' | 'call', RGB3> | null = null;
  updateAllViews(): void {
    const series = this.series;
    const latest = this.snapshots[this.snapshots.length - 1];
    if (!series || !latest || !this.enabled || !this.axisInks) {
      this.axisViews = [];
      return;
    }
    const inks = this.axisInks;
    /* in the axis's own format, so a label covers the tick it stands on */
    const pf = series.priceFormatter();
    const fmt = (k: number) => pf.format(k);
    const lv = this.axisLv;
    const want: { price: number; rgb: RGB3 }[] = [];
    if (lv.cw != null && Number.isFinite(lv.cw)) want.push({ price: lv.cw, rgb: inks.cw });
    if (lv.pw != null && Number.isFinite(lv.pw)) want.push({ price: lv.pw, rgb: inks.pw });
    if (lv.flip != null && Number.isFinite(lv.flip)) want.push({ price: lv.flip, rgb: inks.flip });
    const taken = new Set(want.map(w => w.price));
    /* the two more: the supreme, then the field's heaviest strike now (the one its strength chip names) */
    const more: { price: number; rgb: RGB3 }[] = [];
    if (lv.supreme != null && Number.isFinite(lv.supreme) && !taken.has(lv.supreme)) more.push({ price: lv.supreme, rgb: inks.supreme });
    const heavy = [...latest.levels].sort((a, b) => Math.abs(this.valueOf(b)) - Math.abs(this.valueOf(a)));
    for (const l of heavy) {
      if (more.length >= 2) break;
      if (taken.has(l.strike) || more.some(m => m.price === l.strike) || this.valueOf(l) === 0) continue;
      more.push({ price: l.strike, rgb: this.valueOf(l) >= 0 ? inks.put : inks.call });
    }
    const floor = this.chromeInset > 0 ? this.chromeInset + 3 : 0;
    let paneH = 0;
    try {
      paneH = this.chart?.paneSize(0).height ?? 0;
    } catch {
      paneH = 0;
    }
    this.axisViews = [...want, ...more].slice(0, 5).map(w => {
      const y = series.priceToCoordinate(w.price);
      const pin = y == null ? '' : y < floor ? '▲ ' : paneH > 0 && y > paneH ? '▼ ' : '';
      const at = y == null ? -1000 : pin === '▲ ' ? floor + 8 : pin === '▼ ' ? paneH - 8 : y;
      return new AxisLabel(at, `${pin}${fmt(w.price)}`, w.rgb, y != null);
    });
  }
  /**
   * The bead under a point on the pane (CSS px), or null — the moment whose slot holds x, and the strike drawn within a
   * few pixels of y among that moment's drawn beads. Read by the chart's hover card.
   */
  beadAt(x: number, y: number): BeadHit | null {
    if (!this.enabled || !this.chart || !this.series || !this.snapshots.length || this.ref <= 0) return null;
    const ts = this.chart.timeScale();
    const t = ts.coordinateToTime(x);
    if (t == null) return null;
    const bar = Number(t);
    const snaps = this.snapshots;
    /* the moments inside the bar under x; the one whose slot is nearest x */
    let lo = 0;
    let hi = snaps.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (snaps[m].time < bar) lo = m + 1;
      else hi = m;
    }
    if (lo >= snaps.length || snaps[lo].time >= bar + this.barSec) return null;
    const barX = ts.timeToCoordinate(bar as Time);
    const spacing = ts.options().barSpacing ?? 6;
    const slots = Math.max(1, Math.round(this.barSec / Math.max(1, this.stepSec)));
    let i = lo;
    if (slots > 1 && barX !== null) {
      const slot = Math.max(0, Math.min(slots - 1, Math.floor(((x - (barX - spacing / 2)) / spacing) * slots)));
      const want = bar + (slot * this.barSec) / slots;
      while (i + 1 < snaps.length && snaps[i + 1].time <= want && snaps[i + 1].time < bar + this.barSec) i++;
    }
    const col = this.columnAt(i);
    let best: Bead | null = null;
    let bestD = 6;
    for (const b of col.top) {
      const by = this.series.priceToCoordinate(b.strike);
      if (by === null) continue;
      const d = Math.abs(by - y);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    if (!best) return null;
    const snap = snaps[i];
    const lvl = snap.levels.find(l => l.strike === best!.strike);
    if (!lvl) return null;
    const value = this.valueOf(lvl);
    const total = snap.levels.reduce((s, l) => s + Math.abs(this.valueOf(l)), 0);
    /* the day's 09:30 moment: the first at or after New York's open on the same New York day */
    const day = nyDayKey(snap.time);
    let open: number | null = null;
    for (let k = 0; k <= i; k++) {
      const sk = snaps[k];
      if (nyDayKey(sk.time) !== day || nyMinuteOf(sk.time) < 570) continue;
      const lo2 = sk.levels.find(l => l.strike === best!.strike);
      open = lo2 ? this.valueOf(lo2) : null;
      break;
    }
    /* every zero crossing of the column's book, nearest its price first — the flip is the first (core/walls.ts
       pickFlip, the same linear crossing) */
    const spot = snap.spot ?? snap.levels[Math.floor(snap.levels.length / 2)]?.strike ?? 0;
    const crossings = zeroCrossings(snap.levels, l => l.value);
    crossings.sort((a, b) => Math.abs(a - spot) - Math.abs(b - spot));
    return { strike: best.strike, time: snap.time, value, share: total > 0 ? Math.abs(value) / total : 0, open, rebuilt: !!snap.rebuilt, level: lvl, flip: col.flip, crossings: crossings.slice(1, 4), snap, x, y: this.series.priceToCoordinate(best.strike) ?? y };
  }
}

/* New York's day and minute of a moment, for the hover's 09:30 column */
const nyFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: 'numeric', minute: 'numeric' });
const nyCache = new Map<number, { day: string; minute: number }>();
function nyOf(timeSec: number): { day: string; minute: number } {
  const h = Math.floor(timeSec / 3600);
  let p = nyCache.get(h);
  if (!p) {
    const r: Record<string, string> = {};
    for (const x of nyFmt.formatToParts(new Date(h * 3600_000))) if (x.type !== 'literal') r[x.type] = x.value;
    p = { day: `${r.year}-${r.month}-${r.day}`, minute: (Number(r.hour) % 24) * 60 + Number(r.minute) };
    if (nyCache.size > 5000) nyCache.clear();
    nyCache.set(h, p);
  }
  return { day: p.day, minute: p.minute + Math.floor((timeSec - h * 3600) / 60) };
}
const nyDayKey = (timeSec: number) => nyOf(timeSec).day;
const nyMinuteOf = (timeSec: number) => nyOf(timeSec).minute;

/* the running scale's log-binned count lives in data/feed/beadScale.ts — the store runs the same one */
