import { HEAT_MODE, heatRampColor, heatRampColorFor, inkFor } from './heatmap';
import { BEAD_STEPS, FIXED_SESSIONS, RunningScale, columnGross, pooledRef, stepOf, stepT, strengthOf, type ScaleBasis, type ScaleRef } from '../../data/feed/beadScale';
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

/* THE FIELD'S OWN INKS: THE GAMMA PAIR (the owner, 2026-10-14 — B3: "Hue = side of the net: ember puts, glacier calls.
   Colour strength = |net| ÷ gross; grey when balanced"): the dark tokens' own ember and glacier (tokens.css), the
   neutral the text-muted ink; on paper the light set's, read off the chart's box (trailPaperFrom). Not the market
   red/green: on THIS surface those belong to the candles. Since B3 no mark wears an identity ink — not the supreme's
   magenta, not the walls' ("No King, glow, pulse, magnet or pin glyphs"): the axis chips and the wall-move chips name
   them; the focus (a strike the reader picked) keeps the house's silver. */
const PUT_RGB: readonly [number, number, number] = [245, 197, 66]; // --ember
const CALL_RGB: readonly [number, number, number] = [122, 189, 215]; // --glacier
const NEUTRAL_RGB: readonly [number, number, number] = [125, 125, 125]; // --text-muted on black: a balanced strike
const SUPREME_RGB: readonly [number, number, number] = [234, 0, 255]; // the in-plot strength labels alone (a host without axis chips)
/* THE WALLS WEAR THE GAMMA PAIR (the owner, 2026-10-14: "Wall chips: put wall ember, call wall glacier. Bull/bear is for
   candles only"): the dark tokens' own values (tokens.css); green and red until then. The chips, the ticks and the
   axis labels wear them — never a mark (B3). */
const CW_RGB: readonly [number, number, number] = [122, 189, 215]; // --glacier
const PW_RGB: readonly [number, number, number] = [245, 197, 66]; // --ember
const FLIP_RGBA = 'rgba(156,163,175,0.8)'; // indecision gray — the regime border (mirrors palette FLIP); alpha raised with the 2026-08-29 weight pass

/* EVERY STRIKE IN THE WINDOW DRAWS (the owner's second review, 2026-10-13, item 5: 774 stood at +$506M, half the
   reference, and drew nothing — only the twelve heaviest of a column were drawn), and since item 5 (e) every strike
   above zero: the floor is the reader's (`floor`, a share of the reference, off by default). The ranking happens ONCE,
   when the data arrives — a frame must never sort. */

/* STALENESS IS A SOFT EDGE, NOTHING ELSE (B3, 2026-10-14 — it was a dotted fill at a quieter alpha, item 5 (g)): 0 a
   cell on today's vols, 1 a modeled cell with half or more of its gamma on vols older than an hour, 2 a cell priced
   mostly on the session before's close vol (carried). A stale mark keeps its colour and its light and wears its edge
   soft — a one-device-pixel border at SOFT_EDGE_ALPHA of the mark's own alpha round a core inset by that pixel. The
   card says which of the two it is. */
export const SOFT_EDGE_ALPHA = 0.45;
const staleOf = (l: GexSnapshot['levels'][number]): 0 | 1 | 2 => (l.prov === 'carried' ? 2 : (l.staleShare ?? 0) >= 0.5 ? 1 : 0);

/* THE MARK'S COLOUR (B3): the side's ink mixed from the neutral by the colour strength — grey at 0 (the two sides
   balanced), the ink whole at 1 (one-sided); quantized to STRENGTH_STEPS so the field is a few paths a frame */
export const STRENGTH_STEPS = 10;
export interface MarkInks {
  put: RGB3;
  call: RGB3;
  neutral: RGB3;
}
export const DARK_MARK_INKS: MarkInks = { put: PUT_RGB, call: CALL_RGB, neutral: NEUTRAL_RGB };
export const markInk = (side: 1 | -1, strength: number, inks: MarkInks): RGB3 => {
  const u = Math.max(0, Math.min(1, strength));
  const to = side > 0 ? inks.put : inks.call;
  const n = inks.neutral;
  return [Math.round(n[0] + (to[0] - n[0]) * u), Math.round(n[1] + (to[1] - n[1]) * u), Math.round(n[2] + (to[2] - n[2]) * u)];
};

/** One mark: a strike's size step against the size reference, and how one-sided its book is */
interface Bead {
  strike: number;
  /** The net (the greek drawn) and the gross — |calls| + |puts|, |net| where the cell keeps none */
  value: number;
  gross: number;
  /** Its size, √(gross ÷ the size reference) clipped at 1, and the step it draws at (1..BEAD_STEPS) */
  t: number;
  step: number;
  /** |net| ÷ gross, 0 balanced to 1 one-sided; 1 where the cell keeps no gross */
  strength: number;
  /** Sim side-coding: positive = put-dominant (amplifies), negative = call-dominant (absorbs) */
  put: boolean;
  /** 0 fresh, 1 stale, 2 carried — a soft edge for either */
  stale: 0 | 1 | 2;
}

/** One column of the field, ranked and scaled at load time */
interface Column {
  time: number;
  /** The strikes that draw, largest first (by gross) */
  top: Bead[];
  /** Every strike — only consulted for a focused strike outside the top */
  all: Map<number, Bead>;
  /** The references this column's beads were measured against (the net's and the size's), and what it was built with */
  ref: number;
  refG: number;
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
  /** THE TOP SET (B4): the three heaviest strikes by size — a strike entering it wears a ring, one leaving it a ghost */
  topSet: Set<number>;
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
  /** the balanced mark's grey (B3) — the page's muted ink */
  neutral: RGB3;
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
    neutral: tokenRgb(el, '--text-muted', [64, 67, 74]),
    cw: tokenRgb(el, '--glacier', [3, 105, 161]),
    pw: tokenRgb(el, '--ember', [146, 86, 4]),
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
    cw: tokenRgb(el, '--glacier', [122, 189, 215]),
    pw: tokenRgb(el, '--ember', [245, 197, 66]),
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

/** A run of bars on screen with no column of the field, and the host's reason (B1) */
interface GapRun {
  t0: number;
  t1: number;
  words: string;
}
/** The bars in the visible range with no column of the field, as runs, each asked its reason of the host (src.gapCause):
    whitespace (no bar) is no gap; a run the host has no words for is left unlabelled */
function findGaps(src: GexTrailsPrimitive, series: ISeriesApi<'Candlestick'>, ts: ReturnType<IChartApi['timeScale']>, barSec: number): GapRun[] {
  const cause = src.gapCause;
  const r = ts.getVisibleLogicalRange();
  if (!cause || !r) return [];
  const out: GapRun[] = [];
  let run: { i0: number; i1: number; t0: number; t1: number } | null = null;
  const close = () => {
    if (!run) return;
    const words = cause(run.t0, run.t1 + barSec);
    if (words) out.push({ t0: run.t0, t1: run.t1, words });
    run = null;
  };
  const from = Math.max(0, Math.ceil(r.from));
  const to = Math.floor(r.to);
  /* a run never crosses the open or the close (New York's 9:30 and 4:00), nor a day: each has one cause */
  const sessionOf = (t: number): string => {
    const m = nyMinuteOf(t);
    return `${nyDayKey(t)}|${m < 570 ? 'pre' : m > 960 ? 'post' : 'in'}`;
  };
  let runSession = '';
  for (let i = from; i <= to && i - from < 4000; i++) {
    const d = series.dataByIndex(i) as { time?: unknown } | null;
    const t = d && typeof d.time === 'number' ? d.time : null;
    if (t == null || src.hasColumnAt(t)) {
      close();
      continue;
    }
    const ses = sessionOf(t);
    if (run && run.i1 === i - 1 && ses === runSession) {
      run.i1 = i;
      run.t1 = t;
    } else {
      close();
      run = { i0: i, i1: i, t0: t, t1: t };
      runSession = ses;
    }
  }
  close();
  return out;
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
  /** THE GAPS ON SCREEN (B1): runs of bars with no column and the host's reason for each, found as the bitmap is built */
  private gapRuns: GapRun[] = [];

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
    /* ONE SOLID MARK PER STRIKE PER CANDLE (the owner, 2026-10-14 — B2: "draw one solid mark per strike per candle (the
       cell is the bar's peak minute), on whole device pixels, no blur or shadow"; B3 for what a mark encodes). Until
       then the field was a RIBBON: beads as wide as their slot so they touched, their thickness the strength, a wider
       and fainter halo under a translucent core (0.16 to 0.66 alpha, the halo 0.04 to 0.18), ellipses on fractional
       coordinates, every sub-bar moment its own sliver — which read as soft slivers. Now a mark is a RECT on the
       device-pixel grid: as wide as the bar's slot less a hairline, its HEIGHT the strike's size (√ of the gross
       against the size reference, in BEAD_STEPS steps, one pixel to the strike row's share), its COLOUR the side's
       ink mixed from the neutral by |net| ÷ gross, filled whole (the density's dims and a focus apart), a stale cell's
       edge soft. The column is the bar's (timeframe.ts aggregateSnapshots: the cell its peak minute). */
    const focus = src.focusStrike;
    const supreme = src.supremeStrike;
    const paper = src.paper;
    const inks: MarkInks = paper ? { put: paper.put, call: paper.call, neutral: paper.neutral } : DARK_MARK_INKS;
    const ink = paper ? (src.focusInk === 'supreme' ? paper.supreme : paper.focus) : INK_RGB[src.focusInk];
    const inkCss = `rgba(${ink[0]},${ink[1]},${ink[2]},0.95)`;

    target.useBitmapCoordinateSpace(scope => {
      const ctx = scope.context;
      const hr = scope.horizontalPixelRatio;
      const vr = scope.verticalPixelRatio;
      const wCss = scope.mediaSize.width;
      /* SUB-BAR MOMENTS: the field's clock can be finer than the bars (a host handing per-minute columns to a wider
         chart); then a bar holds several marks across its width. On the chart's own fold the slot IS the bar.
         BUDGET: never more columns than the pixels can show — a slot under ~3px wide is drawn every 2nd/3rd/nth. */
      const barSec = src.barSec;
      const slots = Math.max(1, Math.round(barSec / Math.max(1, src.stepSec)));
      const stride = Math.max(1, Math.ceil(3 / (barSpacing / slots)));
      const drawnSlots = Math.max(1, Math.ceil(slots / stride));
      const slotCss = barSpacing / drawnSlots;
      const halfW = barSpacing * 0.5;
      /* THE MARK ON THE PIXEL GRID: one device pixel at least; the slot's width less a hairline, so neighbouring bars
         read as marks and not one band; its height by step, from one pixel to the strike row's share (never past the
         slot's width, so a mark is never taller than it is wide by much, nor past 14 CSS px) */
      const px = Math.max(1, Math.round(hr));
      const pxV = Math.max(1, Math.round(vr));
      const wDev = Math.max(px, Math.round(slotCss * hr) - px);
      const rowDev = (() => {
        const c = src.columnAt(first);
        const y0 = series.priceToCoordinate(c.spot);
        const y1 = series.priceToCoordinate(c.spot + c.step);
        return y0 != null && y1 != null && Math.abs(y0 - y1) > 0 ? Math.abs(y0 - y1) * vr : 12 * vr;
      })();
      const hMax = Math.max(2 * pxV, Math.min(Math.round(rowDev * 0.85), Math.round(Math.max(3, barSpacing * 0.9) * vr), Math.round(14 * vr)));
      const hMin = pxV;

      /* The cache fingerprint — see the field notes above. */
      const firstBucket = Math.floor(col0.time / barSec) * barSec;
      const x0 = ts.timeToCoordinate(firstBucket as Time);
      const probeA = series.priceToCoordinate(col0.top[0]?.strike ?? 0) ?? -1;
      const probeB = series.priceToCoordinate((col0.top[0]?.strike ?? 0) + 1) ?? -1;
      const key = `${src.rev}|${wCss}|${scope.mediaSize.height}|${barSpacing.toFixed(3)}|${x0}|${first}|${last}|${probeA.toFixed(2)}|${probeB.toFixed(2)}|${hr}|${vr}|${focus}|${src.focusInk}|${paper ? 'paper' : 'dark'}|${src.density ? 'd' : 'e'}|${src.globalDim}|${hMax}|${wDev}|${src.gapRev}`;
      const cached = key === this.cacheKey && !!this.bmp;

      /* BATCHED BY COLOUR: a mark's colour is one of STRENGTH_STEPS mixes a side, so the field is one Path2D per side,
         strength step, staleness and dimming — filled once each into the BITMAP; the soft edges the same keys at
         SOFT_EDGE_ALPHA; the change marks (B4) a path each, stroked once. */
      const fills = new Map<string, Path2D>();
      const edges = new Map<string, Path2D>();
      const rings = new Map<string, Path2D>();
      const ghosts = new Path2D();
      let ghostDrawn = false;
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

      // ---- the marks (skipped whole when the cache holds) --------------------
      const beadFloorCss = src.chromeInset > 0 ? src.chromeInset + 3 : 0;
      const paneHCss = scope.mediaSize.height;
      /* BEAD DENSITY (the Terrain UI pass, 2026-10-14): zoomed out past a session, a strike that is not one of the
         column's levels — its walls, its three heaviest BY SIZE (B3: "'Heaviest' in the zoom-out rule uses the size
         measure"), the focus — draws at a quarter of its light, and a non-level strike more than fifteen steps from
         the column's price at six tenths; every strike still draws, the levels at full light at any zoom. `density`
         false (the legend's "Every strike") draws every mark whole. */
      const zoomedOut = src.density && (last - first) * Math.max(1, src.stepSec) > 8 * 3600;
      for (let ci = cached ? last : first; ci < last; ci++) {
        const col = src.columnAt(ci);
        /* the column before, for the change marks — built if it is not yet (it is the one to the left, on screen or
           just off it) */
        const prev = ci > 0 ? src.columnAt(ci - 1) : null;
        const levelSet = src.density ? new Set<number>([col.cw ?? NaN, col.pw ?? NaN, ...col.topSet]) : null;
        // The mark's bar, and where inside it this moment sits
        const bucket = Math.floor(col.time / barSec) * barSec;
        const slot = slots > 1 ? Math.floor(((col.time - bucket) / barSec) * slots) : 0;
        if (slot % stride !== 0) continue;
        const xBar = ts.timeToCoordinate(bucket as Time);
        if (xBar === null || xBar < -halfW || xBar > wCss + halfW) continue;
        const x = slots > 1 ? xBar - halfW + ((slot / stride + 0.5) / drawnSlots) * barSpacing : xBar;
        const cx = x * hr;
        const left = Math.round(cx - wDev / 2);

        // The flip: a tick per column in the field's grammar, never a solid side line — EACH COLUMN'S OWN flip
        // (2026-10-13), off its own book; a column whose book never changes sign has none, and the trail gaps there
        if (col.flip != null) {
          const fy = series.priceToCoordinate(col.flip);
          if (fy !== null) {
            /* near-continuous: 90% slot coverage keeps it reading as a dashed rule rather than a row of crumbs */
            const w = Math.max(px, Math.round(slotCss * 0.9 * hr));
            flipPath.rect(Math.round(cx - w / 2), Math.round(fy * vr - 1.3 * vr), w, Math.max(pxV, Math.round(2.6 * vr)));
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
          /* IN RANGE ONLY (the owner's second review, 2026-10-13, item 2): a strike under the chrome band or off the
             pane's foot is not drawn — a wall beyond the clear area is named by its pinned chip */
          if (y < beadFloorCss || y > paneHCss) continue;

          /* THE DRAWN SIZE IS THE STATED ONE: the step's own share of the row (item 5 (d)) — the legend's reference is
             what full size means */
          const step = Math.max(isFocus ? 1 : 0, bead.step);
          if (step <= 0) continue;
          const h = Math.max(hMin, Math.round(hMin + stepT(step) * (hMax - hMin)));
          const top = Math.round(y * vr - h / 2);
          const stale = isFocus ? 0 : bead.stale;
          /* the light's factor: the field steps back behind a focus (0.3); the density's quarter and the distance's
             six tenths for a strike that is no level of its column */
          let dimA = focus != null && !isFocus ? 0.3 : 1;
          if (levelSet && !isFocus && !levelSet.has(bead.strike)) {
            if (zoomedOut) dimA *= 0.25;
            if (Math.abs(bead.strike - col.spot) > 15 * col.step) dimA *= 0.6;
          }
          const dim = dimA >= 1 ? '1' : dimA.toFixed(2);
          /* THE COLOUR (B3): the side's ink by how one-sided the strike is — grey when balanced; the focus the house's
             silver */
          const sStep = Math.round(Math.max(0, Math.min(1, bead.strength)) * STRENGTH_STEPS);
          const key2 = isFocus ? `f|0|${stale}|${dim}` : `${bead.put ? 'p' : 'c'}|${sStep}|${stale}|${dim}`;
          if (stale > 0 && wDev > 2 * px && h > 2 * pxV) {
            /* THE SOFT EDGE (B3): a one-pixel border at a fraction of the mark's light, the core inset by it */
            pathFor(edges, key2).rect(left, top, wDev, h);
            pathFor(fills, key2).rect(left + px, top + pxV, wDev - 2 * px, h - 2 * pxV);
          } else pathFor(fills, key2).rect(left, top, wDev, h);
          /* THE RING (B4): a strike entering the three heaviest wears a hollow ring on the bar it entered, one device
             pixel outside the mark, in its side's ink */
          if (prev && !isFocus && col.topSet.has(bead.strike) && !prev.topSet.has(bead.strike)) {
            pathFor(rings, bead.put ? 'p' : 'c').rect(left - px - 0.5, top - pxV - 0.5, wDev + 2 * px + 1, h + 2 * pxV + 1);
          }
        }
        /* THE GHOST (B4): a strike that LEFT the three heaviest draws an outline where it stood — the slot wide, the
           tallest mark's height, no fill, in the neutral */
        if (prev)
          for (const s of prev.topSet)
            if (!col.topSet.has(s)) {
              const y = yOf(s);
              if (y === null || y < beadFloorCss || y > paneHCss) continue;
              ghosts.rect(left + 0.5, Math.round(y * vr - hMax / 2) + 0.5, Math.max(1, wDev - 1), Math.max(1, hMax - 1));
              ghostDrawn = true;
            }
      }

      const paint = (tctx: CanvasRenderingContext2D, map: Map<string, Path2D>, edge: boolean) => {
        for (const [key2, path] of map) {
          const [side, sStep, , dim] = key2.split('|');
          const rgb = side === 'f' ? ink : markInk(side === 'p' ? 1 : -1, Number(sStep) / STRENGTH_STEPS, inks);
          const a = Number(dim) * src.globalDim * (edge ? SOFT_EDGE_ALPHA : 1);
          tctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a.toFixed(3)})`;
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
          paint(bctx, edges, true);
          paint(bctx, fills, false);
          bctx.lineWidth = Math.max(1, Math.round(vr));
          for (const [side, path] of rings) {
            const rgb = markInk(side === 'p' ? 1 : -1, 1, inks);
            bctx.strokeStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${(0.9 * src.globalDim).toFixed(3)})`;
            bctx.stroke(path);
          }
          if (ghostDrawn) {
            const n = inks.neutral;
            bctx.strokeStyle = `rgba(${n[0]},${n[1]},${n[2]},${(0.55 * src.globalDim).toFixed(3)})`;
            bctx.stroke(ghosts);
          }
          /* The regime border draws OVER the field (2026-08-29): it is the line the whole map hinges on, and under the
             marks it spent half its length buried in whatever band it crossed. One ink: the supreme's magenta on it
             went with B3 (no King) */
          if (flipDrawn) {
            bctx.fillStyle = paper ? rgba(paper.flip, 0.85) : FLIP_RGBA;
            bctx.fill(flipPath);
          }
          this.bmp = bmp;
          this.cacheKey = key;
          /* THE GAPS (B1), found while the cache is built: runs of bars on screen with no column, each asked its reason
             of the host — drawn under the chrome every frame (words are cheap; the walk is not) */
          this.gapRuns = src.gapCause ? findGaps(src, series, ts, barSec) : [];
        }
      }
      if (this.bmp) ctx.drawImage(this.bmp, 0, 0);

      /* the gap labels' boxes — the wall-move chips keep clear of them */
      const labelBoxes: { l: number; r: number; t: number; b: number }[] = [];
      // ---- the gaps, each with its reason (B1: "Never a blank chart without a reason") ---------------------------
      if (this.gapRuns.length) {
        const px11 = Math.max(11, src.labelPx);
        ctx.font = `${Math.round(px11 * vr)}px ${FONT_SANS}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const placed: { l: number; r: number; row: number }[] = [];
        /* the wall-move chips below keep clear of these */
        const floor = (src.chromeInset > 0 ? src.chromeInset + 3 : 0) * vr;
        const full = (px11 + 5) * vr;
        const padX = 4 * hr;
        const leftMost = CHIP_LEFT * hr;
        const rightMost = (wCss - CHIP_RIGHT) * hr;
        const n = paper ? paper.neutral : NEUTRAL_RGB;
        for (const g of this.gapRuns) {
          const x0 = ts.timeToCoordinate(g.t0 as Time);
          const x1 = ts.timeToCoordinate(g.t1 as Time);
          if (x0 === null || x1 === null) continue;
          const l = (x0 - halfW) * hr;
          const r = (x1 + halfW) * hr;
          const w = ctx.measureText(g.words).width;
          let bl = (l + r) / 2 - w / 2 - padX;
          let br = bl + w + 2 * padX;
          if (bl < leftMost) {
            bl = leftMost;
            br = bl + w + 2 * padX;
          }
          if (br > rightMost) {
            br = rightMost;
            bl = br - w - 2 * padX;
          }
          if (bl < leftMost) continue;
          /* a row where it fits (two rows), else dropped — the hairline under the words still marks the span */
          let row = 0;
          while (row < 2 && placed.some(p => p.row === row && bl < p.r + 4 * hr && br > p.l - 4 * hr)) row++;
          if (row >= 2) continue;
          placed.push({ l: bl, r: br, row });
          const top = floor + 4 * vr + row * (full + 2 * vr);
          labelBoxes.push({ l: bl, r: br, t: top, b: top + full + 2 * vr });
          ctx.fillStyle = paper ? rgba(paper.pad, 0.86) : 'rgba(5,5,5,0.72)';
          ctx.fillRect(bl, top, br - bl, full);
          ctx.fillStyle = `rgba(${n[0]},${n[1]},${n[2]},0.95)`;
          ctx.fillText(g.words, (bl + br) / 2, top + full / 2);
          ctx.fillStyle = `rgba(${n[0]},${n[1]},${n[2]},0.35)`;
          ctx.fillRect(Math.max(leftMost, l), top + full + vr, Math.max(1, Math.min(rightMost, r) - Math.max(leftMost, l)), Math.max(1, Math.round(vr)));
        }
      }


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
          const boxes: { l: number; r: number; t: number; b: number }[] = [...labelBoxes];
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

      // ---- the walls' moves, as ticks (B4: "short tick when a wall moves") ------------------------------------------
      {
        /* every move in view wears a short vertical tick at the NEW strike on the bar it moved, two device pixels wide
           and most of a strike row tall, in the wall's ink — the chips above name the newest three */
        const moves = wallMovesOf(last, ci => src.columnAt(ci), WALL_HOLD, first);
        const floorCss = src.chromeInset > 0 ? src.chromeInset + 3 : 0;
        const tw = Math.max(1, Math.round(2 * hr));
        const th = Math.max(Math.round(4 * vr), Math.round(rowDev * 0.7));
        for (const m of moves) {
          const bucket = Math.floor(m.time / barSec) * barSec;
          const xBar = ts.timeToCoordinate(bucket as Time);
          const y = series.priceToCoordinate(m.to);
          if (xBar === null || y === null || y < floorCss || y > scope.mediaSize.height) continue;
          const rgb = paper ? (m.kind === 'CW' ? paper.cw : paper.pw) : m.kind === 'CW' ? CW_RGB : PW_RGB;
          ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${(0.95 * src.globalDim).toFixed(3)})`;
          ctx.fillRect(Math.round(xBar * hr - tw / 2), Math.round(y * vr - th / 2), tw, th);
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
/** A moment's largest gross gamma at a strike (B3's size), remembered against the snapshot object */
const momentGross = new WeakMap<GexSnapshot, number>();
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
  /** THE GAPS' REASONS (B1): the host's words for a run of bars with no column, [from, to) in epoch seconds — null for
      none to say. Set by the chart from its host (Terrain reads the store's state, the session's hours and the clock). */
  gapCause: ((fromSec: number, toSec: number) => string | null) | null = null;
  /** Bumped by the host when the reasons may have changed without the columns — the bitmap (and the runs) are rebuilt */
  gapRev = 0;
  /** Whether a column of the field stands inside the bar at `barTime` (this chart's barSec) */
  hasColumnAt(barTime: number): boolean {
    const s = this.snapshots;
    const b0 = Math.floor(barTime / this.barSec) * this.barSec;
    let lo = 0;
    let hi = s.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (s[m].time < b0) lo = m + 1;
      else hi = m;
    }
    return lo < s.length && s[lo].time < b0 + this.barSec;
  }
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
  /** THE SIZE REFERENCE (B3): the same running count over each minute's peak GROSS gamma at a strike — a mark's size
      is √(gross ÷ this); where a cell keeps no gross, its |net| stands in (the legend says so) */
  private baseMaxG: number[] = [];
  private baseRefG: number[] = [];
  private baseRunG = new RunningScale();
  private dayMaximaG = new Map<string, number[]>();
  /** refAt's answers by column, kept until the base, the basis or the references change */
  private refMemo = new WeakMap<GexSnapshot, ReturnType<GexTrailsPrimitive['refAt']>>();
  private baseGreek: TrailGreek = 'gex';
  /** Each New York day's per-minute peaks in the base, for the prior and fixed bases (built as the base is) */
  private dayMaxima = new Map<string, number[]>();
  private dayRefs = new Map<string, { prior: ScaleRef | null; fixed: ScaleRef | null; priorG: ScaleRef | null; fixedG: ScaleRef | null; priorDay: string | null }>();

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
      for (const d of new Set(this.baseDays.slice(k))) {
        this.dayMaxima.delete(d);
        this.dayMaximaG.delete(d);
      }
      this.dayRefs.clear();
    }
    for (const arr of [this.baseIds, this.baseTimes, this.baseMax, this.baseRef, this.baseRing, this.baseDays, this.baseFirst, this.baseMaxG, this.baseRefG] as unknown[][]) arr.length = k;
    this.baseRun.reset();
    this.baseRunG.reset();
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
        this.baseRunG.reset();
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
      /* the minute's peak gross (the gamma field's own; the delta and vega fields size by their |value|) */
      let mg = momentGross.get(snap);
      if (mg === undefined) {
        mg = greek === 'gex' ? columnGross(snap.levels) : m;
        momentGross.set(snap, mg);
      }
      this.baseIds.push(snap);
      this.baseTimes.push(snap.time);
      this.baseMax.push(m);
      this.baseRef.push(this.baseRun.push(m));
      this.baseRing.push(this.baseRun.ring());
      this.baseMaxG.push(mg);
      this.baseRefG.push(this.baseRunG.push(mg));
      this.baseDays.push(d);
      this.baseFirst.push(first);
      let list = this.dayMaxima.get(d);
      if (!list) this.dayMaxima.set(d, (list = []));
      list.push(m);
      let listG = this.dayMaximaG.get(d);
      if (!listG) this.dayMaximaG.set(d, (listG = []));
      listG.push(mg);
    }
  }

  /** The prior and fixed references for a New York day: the server's where it has them, else the base's own */
  private dayRef(day: string): { prior: ScaleRef | null; fixed: ScaleRef | null; priorG: ScaleRef | null; fixedG: ScaleRef | null; priorDay: string | null } {
    let r = this.dayRefs.get(day);
    if (r) return r;
    const ext = this.external.get(day);
    const before = [...this.dayMaxima.keys()].filter(d => d < day).sort();
    const priorDay = before.length ? before[before.length - 1] : null;
    const prior = ext?.prior ?? (priorDay ? pooledRef(this.dayMaxima.get(priorDay)!, 1) : null);
    const pool = before.slice(-FIXED_SESSIONS);
    const fixed = ext?.fixed ?? (pool.length ? pooledRef(pool.flatMap(d => this.dayMaxima.get(d)!), pool.length) : null);
    /* the size's twins stand on the sessions this page holds (the server's scale.json carries the net's references
       alone — a follow-up adds the gross) */
    const priorG = priorDay ? pooledRef(this.dayMaximaG.get(priorDay)!, 1) : null;
    const fixedG = pool.length ? pooledRef(pool.flatMap(d => this.dayMaximaG.get(d)!), pool.length) : null;
    r = { prior, fixed, priorG, fixedG, priorDay: ext?.priorDay ?? priorDay };
    this.dayRefs.set(day, r);
    return r;
  }

  /** The reference column i is measured against — the basis's, as of the column's last minute; a basis with nothing to
      stand on (no session before loaded, none on the server) falls back to the session's own, and says so */
  refAt(i: number): { ref: number; ring: number; refG: number; basis: ScaleBasis; at: number; minutes: number; sessions: number; priorDay: string | null } {
    const snap = this.snapshots[i];
    const had = this.refMemo.get(snap);
    if (had) return had;
    const got = this.refOf(snap);
    this.refMemo.set(snap, got);
    return got;
  }
  private refOf(snap: GexSnapshot): { ref: number; ring: number; refG: number; basis: ScaleBasis; at: number; minutes: number; sessions: number; priorDay: string | null } {
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
      const gotG = this.basis === 'prior' ? r.priorG : r.fixedG;
      if (got) return { ref: got.ref, ring: got.ring, refG: gotG?.ref ?? got.ref, basis: this.basis, at: j >= 0 ? this.baseTimes[j] : snap.time, minutes: got.minutes, sessions: got.sessions, priorDay: r.priorDay };
    }
    if (j >= 0 && this.baseDays[j] === day) return { ref: this.baseRef[j], ring: this.baseRing[j], refG: this.baseRefG[j], basis: 'session', at: this.baseTimes[j], minutes: j - this.baseFirst[j] + 1, sessions: 1, priorDay: null };
    return { ref: 0, ring: 0, refG: 0, basis: 'session', at: snap.time, minutes: 0, sessions: 0, priorDay: null };
  }

  /** The reference the host last handed the legend — the renderer checks the newest column against it in development
      (item 5 acceptance (i): "the legend value equals the reference the renderer used at that minute (assert)") */
  published: number | null = null;
  /** What the legend prints: the newest column's reference, the very number its beads were drawn against */
  legend(): (ReturnType<GexTrailsPrimitive['refAt']> & { greek: TrailGreek; sizeBy: 'gross' | 'net' }) | null {
    if (!this.snapshots.length) return null;
    const last = this.snapshots[this.snapshots.length - 1];
    const r = this.refAt(this.snapshots.length - 1);
    /* the size stands on the gross where the newest column keeps it (the gamma field on the feed and the house's tape);
       on a tape that keeps the net alone (store rows before 2026-10-14) it stands on |net|, and the legend says so */
    const sizeBy: 'gross' | 'net' = this.greek === 'gex' && last.levels.some(l => l.gross != null) ? 'gross' : 'net';
    return r.ref > 0 ? { ...r, greek: this.greek, sizeBy } : null;
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
    const refG = r.refG || ref;
    const key = `${ref}|${refG}|${this.floor}`;
    if (!col || col.key !== key) {
      const all = new Map<number, Bead>();
      const gex = this.greek === 'gex';
      for (const l of snap.levels) {
        const v = this.valueOf(l);
        /* THE SIZE (B3): √(gross ÷ the size reference) — a square-root scale on magnitude (2026-10-13), quantized to its
           step (item 5 (d)); the gross where the cell keeps it, |net| where it does not (the delta and vega fields, and
           store rows before 2026-10-14). THE STRENGTH: |net| ÷ gross, 1 where the gross is not kept. */
        const gross = gex && l.gross != null && l.gross > 0 ? l.gross : Math.abs(v);
        const t = strengthOf(gross, refG);
        const strength = gex && l.gross != null && l.gross > 0 ? Math.min(1, Math.abs(v) / l.gross) : 1;
        all.set(l.strike, { strike: l.strike, value: v, gross, t, step: stepOf(t), strength, put: v >= 0, stale: staleOf(l) });
      }
      const floorAbs = this.floor * refG;
      const top = [...all.values()].filter(b => b.gross > 0 && b.gross >= floorAbs && b.step > 0).sort((a, b) => b.gross - a.gross);
      /* the moment's own price — the snapshot's, else its window's middle (the house's window is centred on it) */
      const spot = snap.spot ?? snap.levels[Math.floor(snap.levels.length / 2)]?.strike ?? 0;
      const flip = snap.levels.length > 1 ? pickFlip(snap.levels, spot, l => l.value) : null;
      const walls = pickWalls(snap.levels, spot, l => l.value);
      let step = Infinity;
      for (let i = 1; i < snap.levels.length; i++) {
        const d = Math.abs(snap.levels[i].strike - snap.levels[i - 1].strike);
        if (d > 0 && d < step) step = d;
      }
      col = { time: snap.time, top, all, ref, refG, key, flip, cw: walls.callWall, pw: walls.putWall, spot, step: Number.isFinite(step) ? step : 1, topSet: new Set(top.slice(0, 3).map(b => b.strike)) };
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
