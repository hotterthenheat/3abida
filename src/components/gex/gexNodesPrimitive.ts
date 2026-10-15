import { HEAT_MODE, heatRampColorFor, inkFor } from './heatmap';
import { BEAD_STEPS, FIXED_SESSIONS, RunningScale, columnGross, pooledRef, stepOf, stepT, strengthOf, type ScaleBasis, type ScaleRef } from '../../data/feed/beadScale';
import { num } from '../../core/format';
import type { ISeriesPrimitive, ISeriesPrimitiveAxisView, SeriesAttachedParameter, Time, IChartApi, ISeriesApi } from 'lightweight-charts';
import type { GexSnapshot } from '../../types/market';
import { FONT_SANS } from '../../theme/fonts';
import { pickFlip, pickWalls, zeroCrossings } from '../../core/walls';
import { nyClock } from '../../core/nyTime';
import { stickyWallMoves, wallObsOf, wallStateEventsOf, WallStick, type WallMove, type WallObs, type WallShown, type WallStateEvent } from '../../data/feed/trailModel';

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
/* THE GAMMA PAIR (the owner's orbs message, 2026-10-14: "Gold = absorb (calls side), Violet = amplify (puts side) —
   Skylit's meaning"): the dark tokens' own values (tokens.css --absorb, --amplify); a light tape reads its own off the
   box (trailPaperFrom). Ember/glacier the other way round from 2026-08 to that day. */
const PUT_RGB: readonly [number, number, number] = [128, 100, 247]; // --amplify (violet): put-dominant, hedging amplifies a move
const CALL_RGB: readonly [number, number, number] = [232, 185, 74]; // --absorb (gold): call-dominant, hedging absorbs it
const NEUTRAL_RGB: readonly [number, number, number] = [125, 125, 125]; // --text-muted on black: a balanced strike
/* THE WALLS WEAR THE GAMMA PAIR (the orbs message: "Call wall chip gold, put wall chip violet"): the chips, the ticks,
   the wall lines and the axis labels — one meaning with the nodes. */
const CW_RGB = CALL_RGB;
const PW_RGB = PUT_RGB;
const FLIP_RGBA = 'rgba(156,163,175,0.8)'; // indecision gray — the regime border (mirrors palette FLIP); alpha raised with the 2026-08-29 weight pass

/* THE OVALS' MEASURES (the orbs message, SHAPE 1–5 and HOW MANY 6) */
/** Nodes drawn per candle by size — the interim default until the node test (section D) picks; the walls and the flip always */
export const TOP_NODES = 5;
/** d = OVAL_MIN_CSS + (OVAL_ROW_SHARE × the strike row − OVAL_MIN_CSS) × √(min(size ÷ reference, 1)), CSS px */
export const OVAL_MIN_CSS = 3;
export const OVAL_ROW_SHARE = 0.85;
/** Candles closer than this merge, so every oval is at least this wide */
export const OVAL_MERGE_CSS = 6;
/** An oval this big or bigger wears a one-pixel outline in a darker shade of its own hue */
export const OVAL_OUTLINE_MIN_CSS = 6;
/** Opacity OVAL_ALPHA_MIN → 1 on the same √ (the orbs' second round, 2026-10-15: "0.8 → 1.0 — lower opacity on
    near-black turns colours muddy") */
export const OVAL_ALPHA_MIN = 0.8;
const WALL_LINE_ALPHA = 0.4;
/** The light the rest of the field keeps under a hover (60%) and under a pin (40%) */
export const HOVER_KEEP = 0.6;
export const PIN_KEEP = 0.4;
/** The pills beside the last candle: the three largest live nodes */
export const NODE_LABELS = 3;
/** A wall move's tick: two pixels wide, seven tall, at the new strike */
const TICK_W_CSS = 2;
const TICK_H_CSS = 7;
/** The library's attribution mark, bottom-left: the words keep clear of it */
const LOGO_W_CSS = 110;
/** The Reset pill's keep-out: half its width with a margin, and the price scale it is centred over with the plot */
const RESET_HALF_W_CSS = 56;
const RESET_SCALE_CSS = 72;
const LOGO_H_CSS = 26;
/** A node's diameter in CSS px at size t (√ of gross ÷ reference, clipped at 1) on a strike row `rowCss` tall:
    3 px + (85% of the row − 3 px) × t — a row too short for three pixels gives three */
export const ovalDiameter = (t: number, rowCss: number): number => OVAL_MIN_CSS + (Math.max(OVAL_MIN_CSS, rowCss * OVAL_ROW_SHARE) - OVAL_MIN_CSS) * Math.max(0, Math.min(1, t));
/** How many neighbouring candles merge into one oval at this bar spacing (CSS px): one from six pixels up, else enough
    for the group to be at least six pixels wide after its one-pixel gap */
export const mergeBars = (barSpacing: number): number => (barSpacing >= OVAL_MERGE_CSS ? 1 : Math.ceil((OVAL_MERGE_CSS + 1) / barSpacing));
/** A node's opacity at size t: OVAL_ALPHA_MIN → 1 */
export const ovalAlpha = (t: number): number => OVAL_ALPHA_MIN + (1 - OVAL_ALPHA_MIN) * Math.max(0, Math.min(1, t));
/** lightweight-charts' own candle body width (src/renderers/optimal-bar-width.ts, 5.x), so the candles' edge lands on
    the body the library draws */
export function optimalCandlestickWidth(barSpacing: number, pixelRatio: number): number {
  if (barSpacing >= 2.5 && barSpacing <= 4) return Math.floor(3 * pixelRatio);
  const coeff = 1 - (0.2 * Math.atan(Math.max(4, barSpacing) - 4)) / (Math.PI * 0.5);
  const res = Math.floor(barSpacing * coeff * pixelRatio);
  const scaled = Math.floor(barSpacing * pixelRatio);
  return Math.max(Math.floor(pixelRatio), Math.min(res, scaled));
}

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
const staleOf = (l: GexSnapshot['levels'][number]): 0 | 1 | 2 => (l.prov === 'carried' ? 2 : (l.staleShare ?? 0) >= 0.5 || (l.wideShare ?? 0) >= 0.5 || l.readGap ? 1 : 0);

/* THE MARK'S COLOUR, TWO STATES (the orbs' second round, 2026-10-15 — the owner: "Most strikes hold both calls and puts,
   so the grey fade washes nearly everything out … Full hue unless |net| ÷ gross < 0.2; below that, grey. Two states, no
   gradient"): the side's ink whole where one side holds a fifth or more of the strike's gamma over the other, the
   neutral grey where the two all but cancel. STRENGTH_STEPS stays the quantum the paths are keyed by. */
export const STRENGTH_STEPS = 10;
/** |net| ÷ gross under this draws grey (balanced) */
export const BALANCED_BELOW = 0.2;
export interface MarkInks {
  put: RGB3;
  call: RGB3;
  neutral: RGB3;
}
export const DARK_MARK_INKS: MarkInks = { put: PUT_RGB, call: CALL_RGB, neutral: NEUTRAL_RGB };
export const markInk = (side: 1 | -1, strength: number, inks: MarkInks): RGB3 => (strength >= BALANCED_BELOW - 1e-9 ? (side > 0 ? inks.put : inks.call) : inks.neutral);

/** One node: a strike's size against the size reference, and how one-sided its book is */
interface Bead {
  strike: number;
  /** The net (the greek drawn) and the gross — |calls| + |puts|, |net| where the cell keeps none */
  value: number;
  gross: number;
  /** Its size, √(gross ÷ the size reference) clipped at 1, and the step it draws at (1..BEAD_STEPS) */
  t: number;
  step: number;
  /** The column the cell came from (a merged group keeps each strike's peak minute) */
  ci: number;
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
  /** THE WALLS SHOWN — from the book, held (trailModel WallStick, the owner's rule of 2026-10-14): the heaviest call- and
      put-dominant strikes, a new one taking over only after beating the held wall by 10% in three closed minutes in a
      row; walked on the PER-MINUTE store, so every timeframe shows the same walls (a column reads the stick at its last
      minute). Their states (broken / reclaimed) ride beside them, and the raw picks (pickWalls). */
  cw: number | null;
  pw: number | null;
  cwState: WallShown['cwState'];
  pwState: WallShown['pwState'];
  rawCw: number | null;
  rawPw: number | null;
  /** The moment's own price and the strikes' step — the density's distance fade reads them */
  spot: number;
  step: number;
  /** THE TOP SET (B4): the three heaviest strikes by size — the zoom-out rule keeps them at full light (no ring or ghost
      since the orbs' second round) */
  topSet: Set<number>;
}
/** A GROUP: one candle's columns (a 5-minute texture under an hour bar), or neighbouring candles merged where they stand
    closer than six pixels — each strike its peak minute, ranked by size; the walls and the flip the last column's */
interface Group {
  cols: number[];
  /** every strike above the floor, largest first */
  nodes: Bead[];
  all: Map<number, Bead>;
  last: Column;
  topSet: Set<number>;
}

/* A WALL THAT MOVES (2026-10-13): a chip at the moment the call or put wall changes strike — "CW 780 → 785 · 11:42" —
   counted once the new strike has held three moments (a wall trading places with its neighbour for a moment is not a
   move), the newest few on screen. The rule is trailModel's wallMovesOf (WALL_HOLD), the session recap's too. */
/** The wall chips keep this far in from the pane's left (the drawing rail) and right (the strength chips), CSS px */
const CHIP_LEFT = 58;
const CHIP_RIGHT = 96;
/** The newest wall chips on the plot — moves, breaks and reclaims together */
const WALL_CHIPS = 4;

/** What sits under the pointer on the field — the hover card's words come off it */
export interface BeadHit {
  strike: number;
  time: number;
  /** the column the cell came from */
  ci: number;
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

/** The focused level's ink, kept for the host's calls (the focus line is the chart's): a pinned chain keeps its own
    gold or violet and wears a ring in the ink since the orbs message (2026-10-14) — never recoloured */
export type FocusInk = 'focus' | 'supreme';

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
  /** the page's lead ink — the pills' words, the hover's ring */
  ink: RGB3;
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
    cw: tokenRgb(el, '--absorb', [158, 114, 0]),
    pw: tokenRgb(el, '--amplify', [91, 60, 230]),
    supreme: tokenRgb(el, '--supreme', [163, 0, 179]),
    focus: tokenRgb(el, '--select', [47, 61, 92]),
    flip: tokenRgb(el, '--flip', [107, 114, 128]),
    pad: tokenRgb(el, '--panel', [232, 231, 226]),
    ink: tokenRgb(el, '--text-primary', [20, 20, 22]),
  };
}
const rgba = (c: RGB3, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
/** The axis labels' inks, read off an element inside the chart's box (the direction pair follows Settings' colour-vision
    choice through the tokens) */
export function axisInksFrom(el: Element): Record<'cw' | 'pw' | 'flip' | 'supreme' | 'put' | 'call', RGB3> {
  return {
    cw: tokenRgb(el, '--absorb', [232, 185, 74]),
    pw: tokenRgb(el, '--amplify', [128, 100, 247]),
    flip: tokenRgb(el, '--flip', [156, 163, 175]),
    supreme: tokenRgb(el, '--supreme', [234, 0, 255]),
    put: tokenRgb(el, '--amplify', [128, 100, 247]),
    call: tokenRgb(el, '--absorb', [232, 185, 74]),
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
/** AN OVAL ON A SHARED PATH: its own subpath, begun with a moveTo at the arc's start (angle 0). Without it the canvas joins
    each ellipse to the path's current point — after a closePath that is the FIRST oval's start — so every stroked batch
    (the outlines, the rings, the ghosts, the pinned chain) fanned straight lines out of one node across the plot (seen
    2026-10-15 on SPY 15m; the fills hid it, a there-and-back line having no area) */
export function addOval(p: Path2D, cx: number, cy: number, rw: number, rh: number): void {
  p.moveTo(cx + rw, cy);
  p.ellipse(cx, cy, rw, rh, 0, 0, Math.PI * 2);
  p.closePath();
}

/** THE GAP NOTES: one a run, inside it at the plot's foot (or just over the Reset pill's row where the foot is taken),
    never twice, skipped where the run is too narrow to hold its words — each placed box added to `boxes` */
function placeGapNotes(
  ctx: CanvasRenderingContext2D,
  runs: readonly GapRun[],
  ts: ReturnType<IChartApi['timeScale']>,
  barSpacing: number,
  g: { hr: number; vr: number; paneHCss: number; full: number; padX: number; leftMost: number; rightMost: number; padInk: string; ink: RGB3 },
  boxes: { l: number; r: number; t: number; b: number }[],
  collides: (l: number, r: number, t: number, b: number) => boolean
): void {
  if (!runs.length) return;
  ctx.textAlign = 'center';
  const seen = new Set<string>();
  const footTop = (g.paneHCss - 4) * g.vr - g.full;
  const liftTop = (g.paneHCss - 32) * g.vr - g.full;
  for (const run of runs) {
    const gx0 = ts.timeToCoordinate(run.t0 as Time);
    const gx1 = ts.timeToCoordinate(run.t1 as Time);
    if (gx0 === null || gx1 === null) continue;
    const l = Math.max(g.leftMost, (gx0 - barSpacing / 2) * g.hr);
    const r = Math.min(g.rightMost, (gx1 + barSpacing / 2) * g.hr);
    const key = `${Math.round(l)}|${Math.round(r)}|${run.words}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const w = ctx.measureText(run.words).width;
    if (w + 2 * g.padX > r - l) continue;
    const bl = (l + r) / 2 - w / 2 - g.padX;
    const br = bl + w + 2 * g.padX;
    const top = !collides(bl, br, footTop, footTop + g.full) ? footTop : !collides(bl, br, liftTop, liftTop + g.full) ? liftTop : null;
    if (top === null) continue;
    boxes.push({ l: bl, r: br, t: top, b: top + g.full });
    ctx.fillStyle = g.padInk;
    ctx.fillRect(bl, top, br - bl, g.full);
    ctx.fillStyle = `rgba(${g.ink[0]},${g.ink[1]},${g.ink[2]},0.95)`;
    ctx.fillText(run.words, (bl + br) / 2, top + g.full / 2);
  }
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
  /* a run never crosses the open or the close (New York's 9:30 and 4:00), nor a day: each has one cause — a name with
     sessions of its own (SPX: overnight, regular to 4:15 pm, the curb) hands its own key (src.gapSession) */
  const sessionOf =
    src.gapSession ??
    ((t: number): string => {
      const m = nyMinuteOf(t);
      return `${nyDayKey(t)}|${m < 570 ? 'pre' : m > 960 ? 'post' : 'in'}`;
    });
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
    THE PATH CACHE (2026-08-29, the Weigher lag hunt). Building the field is the layer's whole cost — hundreds of
    columns × a handful of nodes each — and it was rebuilt on EVERY repaint, including the 60fps crosshair repaints a
    hovering pointer causes. The built Path2D batches are pure functions of (data revision, pan/zoom, the two scales,
    the identity inputs), so they are cached against exactly that fingerprint and rasterized once into a BITMAP; a
    hover repaint blits it. THE HOVER AND THE PIN ARE NOT IN THE BITMAP (the orbs, 2026-10-14): they are a veil and a
    chain drawn over it each frame, so a pointer never rebuilds the field.
  */
  private cacheKey = '';
  private bmp: HTMLCanvasElement | null = null;
  /** THE GAPS ON SCREEN (B1): runs of bars with no column and the host's reason for each, found as the bitmap is built */
  private gapRuns: GapRun[] = [];
  private bgCache: { css: string; rgb: RGB3 } | null = null;

  /** The chart's ground, for the veil and the candles' edge: the layout's background, else the tape's pad */
  private groundOf(chart: IChartApi, paper: TrailPaper | null): RGB3 {
    let css = '';
    try {
      const b = chart.options().layout.background as { type: string; color?: string; topColor?: string };
      css = (b.type === 'solid' ? b.color : b.topColor) ?? '';
    } catch {
      css = '';
    }
    if (this.bgCache && this.bgCache.css === css) return this.bgCache.rgb;
    let rgb: RGB3 | null = null;
    const m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(css);
    if (m) rgb = [Number(m[1]), Number(m[2]), Number(m[3])];
    else if (/^#[0-9a-f]{6}$/i.test(css)) rgb = [parseInt(css.slice(1, 3), 16), parseInt(css.slice(3, 5), 16), parseInt(css.slice(5, 7), 16)];
    else if (/^#[0-9a-f]{3}$/i.test(css)) rgb = [parseInt(css[1] + css[1], 16), parseInt(css[2] + css[2], 16), parseInt(css[3] + css[3], 16)];
    const out: RGB3 = rgb ?? paper?.pad ?? [10, 10, 10];
    this.bgCache = { css, rgb: out };
    return out;
  }

  /** THE VIEW IS ALL GAP: no column on screen, so nothing but the gaps' words is drawn — found once a view (the runs
      and their words cached on the view, the field's revision and the host's words) */
  private aloneKey = '';
  private drawGapsAlone(target: DrawTarget, src: GexTrailsPrimitive, series: ISeriesApi<'Candlestick'>, ts: ReturnType<IChartApi['timeScale']>): void {
    if (!src.gapCause) return;
    const barSpacing = ts.options().barSpacing ?? 6;
    const r = ts.getVisibleLogicalRange();
    const key = `${r ? `${Math.round(Number(r.from))}|${Math.round(Number(r.to))}` : ''}|${barSpacing.toFixed(3)}|${src.gapRev}|${src.rev}`;
    if (key !== this.aloneKey) {
      this.aloneKey = key;
      this.gapRuns = findGaps(src, series, ts, src.barSec);
    }
    if (!this.gapRuns.length) return;
    const paper = src.paper;
    target.useBitmapCoordinateSpace(scope => {
      const ctx = scope.context;
      const hr = scope.horizontalPixelRatio;
      const vr = scope.verticalPixelRatio;
      const wCss = scope.mediaSize.width;
      const paneHCss = scope.mediaSize.height;
      const px11 = Math.max(11, src.labelPx);
      const full = (px11 + 5) * vr;
      const boxes: { l: number; r: number; t: number; b: number }[] = [{ l: 0, r: LOGO_W_CSS * hr, t: (paneHCss - LOGO_H_CSS) * vr, b: paneHCss * vr }];
      const cx = (wCss + RESET_SCALE_CSS) / 2;
      boxes.push({ l: (cx - RESET_HALF_W_CSS) * hr, r: (cx + RESET_HALF_W_CSS) * hr, t: (paneHCss - 30) * vr, b: (paneHCss - 2) * vr });
      const collides = (l: number, rr: number, t: number, b: number) => boxes.some(q => l < q.r + 2 * hr && rr > q.l - 2 * hr && t < q.b + 2 * vr && b > q.t - 2 * vr);
      ctx.font = `${Math.round(px11 * vr)}px ${FONT_SANS}`;
      ctx.textBaseline = 'middle';
      placeGapNotes(ctx, this.gapRuns, ts, barSpacing, { hr, vr, paneHCss, full, padX: 4 * hr, leftMost: CHIP_LEFT * hr, rightMost: (wCss - CHIP_RIGHT) * hr, padInk: paper ? rgba(paper.pad, 0.88) : 'rgba(5,5,5,0.78)', ink: paper ? paper.neutral : NEUTRAL_RGB }, boxes, collides);
    });
  }

  draw(target: DrawTarget): void {
    const src = this.source;
    if (!src.enabled || !src.chart || !src.series) return;
    if (src.snapshots.length === 0) {
      this.drawGapsAlone(target, src, src.series, src.chart.timeScale());
      return;
    }
    const series = src.series;
    const chart = src.chart;
    const ts = chart.timeScale();
    /* ONLY THE COLUMNS ON SCREEN (2026-09-06, the perf sweep): two binary searches find the visible window of the
       time-sorted snapshots; columns are built lazily as they are first seen. */
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
    /* NO COLUMN IN VIEW: the view is all gap — its words still stand (B1: "never a blank chart without a reason"; the
       sessions, 2026-10-15: SPY's minutes after its close are all gap at one minute a bar) */
    if (last <= first) {
      this.drawGapsAlone(target, src, series, ts);
      return;
    }
    const col0 = src.columnAt(first);
    const barSpacing = ts.options().barSpacing ?? 6;
    if (src.ref <= 0) return;
    if (import.meta.env?.DEV && src.published != null && src.published > 0 && last === snaps.length) {
      const drawn = src.columnAt(last - 1).ref;
      if (Math.abs(drawn - src.published) > src.published * 1e-12) console.error(`bead legend out of step: the legend says ${src.published}, the newest column was drawn against ${drawn}`);
    }
    /* ONE SOLID OVAL PER NODE PER CANDLE (the owner's orbs message, 2026-10-14 — "NODES: SKYLIT-STYLE ORBS, DONE
       BETTER"): a node is centred on its candle and its strike; its diameter d = 3 px + (85% of the strike row − 3 px)
       × √(min(size ÷ reference, 1)), height d, width d capped at the candle spacing less a pixel, so a strong node is
       a tall oval and neighbours stand a pixel apart like a chain of beads; its opacity 0.55 → 1.0 on the same √;
       whole device pixels with anti-aliased edges; an oval six pixels or more wears a one-pixel outline in a darker
       shade of its own hue; no glow, blur, gradient, shadow or depth — a soft edge means STALE and nothing else. The
       cell is the bar's peak minute (timeframe.ts); where candles stand closer than 6 px neighbouring candles merge
       into one oval of the group's peak minute. */
    const focus = src.focusStrike;
    const hover = src.hover;
    const paper = src.paper;
    const inks: MarkInks = paper ? { put: paper.put, call: paper.call, neutral: paper.neutral } : DARK_MARK_INKS;
    const ground = this.groundOf(chart, paper);
    const ringInk: RGB3 = paper ? paper.ink : [255, 255, 255];

    target.useBitmapCoordinateSpace(scope => {
      const ctx = scope.context;
      const hr = scope.horizontalPixelRatio;
      const vr = scope.verticalPixelRatio;
      const wCss = scope.mediaSize.width;
      const paneHCss = scope.mediaSize.height;
      const barSec = src.barSec;
      const px = Math.max(1, Math.round(hr));
      const pxV = Math.max(1, Math.round(vr));
      /* THE MERGE: a group is one bar, or as many neighbouring bars as it takes for an oval to be six pixels wide */
      const gBars = mergeBars(barSpacing);
      const spanSec = barSec * gBars;
      src.groupBars = gBars;
      /* the strike row's height on the pane this frame: the first column's step */
      const rowCss = (() => {
        const y0 = series.priceToCoordinate(col0.spot);
        const y1 = series.priceToCoordinate(col0.spot + col0.step);
        return y0 != null && y1 != null && Math.abs(y0 - y1) > 0 ? Math.abs(y0 - y1) : 12;
      })();
      const dMaxCss = ovalDiameter(1, rowCss);
      const floorCss = src.chromeInset > 0 ? src.chromeInset + 3 : 0;

      /* The cache fingerprint — the field, the view and the scales; never the hover or the pin */
      const firstBucket = Math.floor(col0.time / spanSec) * spanSec;
      const x0 = ts.timeToCoordinate(firstBucket as Time);
      const probeA = series.priceToCoordinate(col0.top[0]?.strike ?? col0.spot) ?? -1;
      const probeB = series.priceToCoordinate((col0.top[0]?.strike ?? col0.spot) + 1) ?? -1;
      const key = `${src.rev}|${wCss}|${paneHCss}|${barSpacing.toFixed(3)}|${x0}|${first}|${last}|${probeA.toFixed(2)}|${probeB.toFixed(2)}|${hr}|${vr}|${paper ? 'paper' : 'dark'}|${src.density ? 'd' : 'e'}|${src.globalDim}|${dMaxCss.toFixed(2)}|${src.gapRev}|${ground.join(',')}`;
      const cached = key === this.cacheKey && !!this.bmp;

      const yCache = new Map<number, number | null>();
      const yOf = (strike: number) => {
        let y = yCache.get(strike);
        if (y === undefined) {
          y = series.priceToCoordinate(strike);
          yCache.set(strike, y);
        }
        return y;
      };
      /* a node's box on the device grid: whole pixels, centred on its candle and strike */
      const boxOf = (cxDev: number, yCss: number, t: number, capDev: number) => {
        const dCss = ovalDiameter(t, rowCss);
        const h = Math.max(pxV, Math.round(dCss * vr));
        const w = Math.max(px, Math.min(Math.round(dCss * hr), capDev));
        const left = Math.round(cxDev - w / 2);
        const top = Math.round(yCss * vr - h / 2);
        return { left, top, w, h };
      };
      const ellipse = (p: Path2D, b: { left: number; top: number; w: number; h: number }, inset = 0) => {
        const rw = Math.max(0.5, b.w / 2 - inset);
        const rh = Math.max(0.5, b.h / 2 - inset);
        addOval(p, b.left + b.w / 2, b.top + b.h / 2, rw, rh);
      };
      /* the darker shade of a node's own hue, for its outline */
      const shade = (c: RGB3): RGB3 => (paper ? [Math.round(c[0] * 0.7), Math.round(c[1] * 0.7), Math.round(c[2] * 0.7)] : [Math.round(c[0] * 0.6), Math.round(c[1] * 0.6), Math.round(c[2] * 0.6)]);
      const alphaOf = (aStep: number) => ovalAlpha(aStep / STRENGTH_STEPS);

      /* THE GROUPS ON SCREEN: consecutive columns in one span, each with its x and its width cap */
      type Placed = { g: Group; cxDev: number; capDev: number; xCss: number; widthCss: number };
      const placed: Placed[] = [];
      {
        let ci = first;
        while (ci < last) {
          const bucket = Math.floor(snaps[ci].time / spanSec) * spanSec;
          let cj = ci;
          while (cj + 1 < last && Math.floor(snaps[cj + 1].time / spanSec) * spanSec === bucket) cj++;
          const g = src.groupOf(ci, cj);
          /* the bars the group's columns stand in */
          let xMin = Infinity;
          let xMax = -Infinity;
          for (const c of g.cols) {
            const b = Math.floor(snaps[c].time / barSec) * barSec;
            const x = ts.timeToCoordinate(b as Time);
            if (x === null) continue;
            if (x < xMin) xMin = x;
            if (x > xMax) xMax = x;
          }
          if (Number.isFinite(xMin)) {
            const widthCss = xMax - xMin + barSpacing;
            const xCss = (xMin + xMax) / 2;
            if (xCss > -widthCss && xCss < wCss + widthCss) placed.push({ g, cxDev: xCss * hr, capDev: Math.max(px, Math.round(widthCss * hr) - px), xCss, widthCss });
          }
          ci = cj + 1;
        }
      }

      // ---- the field, into the bitmap (skipped whole when the cache holds) ---------------------------------------
      if (!cached) {
        const fills = new Map<string, Path2D>();
        const edges = new Map<string, Path2D>();
        const outlines = new Map<string, Path2D>();
        const flipPath = new Path2D();
        let flipDrawn = false;
        const cwLine = new Path2D();
        const pwLine = new Path2D();
        let cwDrawn = false;
        let pwDrawn = false;
        const pathFor = (map: Map<string, Path2D>, k: string) => {
          let p = map.get(k);
          if (!p) map.set(k, (p = new Path2D()));
          return p;
        };
        /* BEAD DENSITY (the Terrain UI pass, 2026-10-14): zoomed out past a session, a strike that is not one of the
           column's levels — its walls, its three heaviest by size — draws at a quarter of its light, and a non-level
           strike more than fifteen steps from the price at six tenths; every drawn strike keeps its colour. "Every
           strike" (density off) draws every strike whole. */
        const zoomedOut = src.density && (last - first) * Math.max(1, src.stepSec) > 8 * 3600;
        for (let pi = 0; pi < placed.length; pi++) {
          const { g, cxDev, capDev } = placed[pi];
          const col = g.last;
          const levelSet = src.density ? new Set<number>([col.cw ?? NaN, col.pw ?? NaN, ...g.topSet]) : null;
          for (const bead of src.nodesOf(g)) {
            const y = yOf(bead.strike);
            if (y === null) continue;
            /* IN RANGE ONLY (the owner's second review, 2026-10-13, item 2): a strike under the chrome band or off the
               pane's foot is not drawn — a wall beyond the clear area is named by its pinned chip */
            if (y < floorCss || y > paneHCss) continue;
            const box = boxOf(cxDev, y, bead.t, capDev);
            let dimA = 1;
            if (levelSet && !levelSet.has(bead.strike)) {
              if (zoomedOut) dimA *= 0.25;
              if (Math.abs(bead.strike - col.spot) > 15 * col.step) dimA *= 0.6;
            }
            const dim = dimA >= 1 ? '1' : dimA.toFixed(2);
            /* two states: the side's ink, or grey where the sides all but cancel */
            const sStep = bead.strength >= BALANCED_BELOW - 1e-9 ? STRENGTH_STEPS : 0;
            const aStep = Math.round(Math.max(0, Math.min(1, bead.t)) * STRENGTH_STEPS);
            const k = `${bead.put ? 'p' : 'c'}|${sStep}|${aStep}|${bead.stale}|${dim}`;
            if (bead.stale > 0 && box.w > 2 * px && box.h > 2 * pxV) {
              /* THE SOFT EDGE (B3): a one-pixel border at a fraction of the node's light, the core inset by it */
              ellipse(pathFor(edges, k), box);
              ellipse(pathFor(fills, k), box, Math.max(px, pxV));
            } else {
              ellipse(pathFor(fills, k), box);
              /* THE OUTLINE: a node six pixels or more wears a one-pixel line in a darker shade of its own hue */
              if (Math.min(box.w / hr, box.h / vr) >= OVAL_OUTLINE_MIN_CSS) ellipse(pathFor(outlines, k), box, Math.max(px, pxV) / 2);
            }
            /* no ring where a strike enters the three heaviest and no ghost where one leaves (the orbs' second round: "top-5
               membership changes too often for them to mean anything") — the wall-move ticks stay */
          }
          /* THE WALL LINES (the orbs message, "wall lines (thin, 40% opacity, in their oval colour)") and THE FLIP
             (a dashed grey rule) — each column's own, so a wall that moves steps, and a column whose book never changes
             sign leaves a gap in the flip */
          for (const c of g.cols) {
            const cc = src.columnAt(c);
            const b = Math.floor(snaps[c].time / barSec) * barSec;
            const xb = ts.timeToCoordinate(b as Time);
            if (xb === null) continue;
            const slotW = Math.max(px, Math.round((barSpacing / Math.max(1, g.cols.length / gBars)) * hr));
            const xl = Math.round(xb * hr - slotW / 2);
            if (cc.flip != null) {
              const fy = series.priceToCoordinate(cc.flip);
              if (fy !== null && fy >= floorCss && fy <= paneHCss) {
                const w = Math.max(px, Math.round(slotW * 0.9));
                flipPath.rect(Math.round(xb * hr - w / 2), Math.round(fy * vr - 1.3 * vr), w, Math.max(pxV, Math.round(2.6 * vr)));
                flipDrawn = true;
              }
            }
            if (cc.cw != null) {
              const y = yOf(cc.cw);
              if (y !== null && y >= floorCss && y <= paneHCss) {
                cwLine.rect(xl, Math.round(y * vr - pxV / 2), slotW, pxV);
                cwDrawn = true;
              }
            }
            if (cc.pw != null) {
              const y = yOf(cc.pw);
              if (y !== null && y >= floorCss && y <= paneHCss) {
                pwLine.rect(xl, Math.round(y * vr - pxV / 2), slotW, pxV);
                pwDrawn = true;
              }
            }
          }
        }

        const bmp = this.bmp && this.bmp.width === scope.bitmapSize.width && this.bmp.height === scope.bitmapSize.height ? this.bmp : document.createElement('canvas');
        bmp.width = scope.bitmapSize.width;
        bmp.height = scope.bitmapSize.height;
        const bctx = bmp.getContext('2d');
        if (bctx) {
          const paint = (map: Map<string, Path2D>, mode: 'fill' | 'edge' | 'outline') => {
            for (const [k, path] of map) {
              const [side, sStep, aStep, , dim] = k.split('|');
              const rgb = markInk(side === 'p' ? 1 : -1, Number(sStep) / STRENGTH_STEPS, inks);
              const a = alphaOf(Number(aStep)) * Number(dim) * src.globalDim * (mode === 'edge' ? SOFT_EDGE_ALPHA : 1);
              if (mode === 'outline') {
                const s = shade(rgb);
                bctx.lineWidth = Math.max(px, pxV);
                bctx.strokeStyle = `rgba(${s[0]},${s[1]},${s[2]},${a.toFixed(3)})`;
                bctx.stroke(path);
              } else {
                bctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a.toFixed(3)})`;
                bctx.fill(path);
              }
            }
          };
          paint(edges, 'edge');
          paint(fills, 'fill');
          paint(outlines, 'outline');
          bctx.lineWidth = Math.max(px, pxV);
          if (cwDrawn) {
            const c = paper ? paper.cw : CW_RGB;
            bctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${(WALL_LINE_ALPHA * src.globalDim).toFixed(3)})`;
            bctx.fill(cwLine);
          }
          if (pwDrawn) {
            const c = paper ? paper.pw : PW_RGB;
            bctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${(WALL_LINE_ALPHA * src.globalDim).toFixed(3)})`;
            bctx.fill(pwLine);
          }
          if (flipDrawn) {
            bctx.fillStyle = paper ? rgba(paper.flip, 0.85) : FLIP_RGBA;
            bctx.fill(flipPath);
          }
          /* THE CANDLES' EDGE: a one-pixel line of the ground round each candle's body and wick, where they cross a node
             (the orbs message: "Candles keep a 1 px background-coloured edge where they cross an oval") — the library's
             own pixel rules for the body and the wick (optimalCandlestickWidth; a wick floor(ratio) wide) */
          this.candleEdges(bctx, series, ts, scope, barSpacing, ground, px, pxV);
          this.bmp = bmp;
          this.cacheKey = key;
          /* THE GAPS (B1), found while the cache is built */
          this.gapRuns = src.gapCause ? findGaps(src, series, ts, barSec) : [];
        }
      }
      if (this.bmp) ctx.drawImage(this.bmp, 0, 0);

      // ---- the hover and the pin, over the bitmap (never in it) --------------------------------------------------
      /* HOVER: the node under the pointer wears a 1.5 px ring in the ink, its strike's whole chain brightens and every
         other node dims to 60%. THE PIN (a click on a node or on the ladder's strike): the chain stays bright and the
         rest dims to 40% until it is clicked again or Esc (the orbs message, items 9 and 10). The veil is the ground
         at the complement, so the field dims and nothing drawn after it does. */
      const pinned = focus != null;
      const hovered = hover != null && src.hasStrike(hover.strike);
      if (pinned || hovered) {
        ctx.fillStyle = rgba(ground, pinned ? 1 - PIN_KEEP : 1 - HOVER_KEEP);
        ctx.fillRect(0, 0, scope.bitmapSize.width, scope.bitmapSize.height);
        const chains = new Set<number>();
        if (pinned) chains.add(focus);
        if (hovered) chains.add(hover.strike);
        for (const strike of chains) {
          const y = yOf(strike);
          if (y === null || y < floorCss || y > paneHCss) continue;
          const path = new Path2D();
          const outs = new Path2D();
          let side: 1 | -1 = -1;
          let strength = 1;
          let any = false;
          for (const p of placed) {
            const b = p.g.all.get(strike);
            if (!b) continue;
            const box = boxOf(p.cxDev, y, b.t, p.capDev);
            ellipse(path, box);
            if (Math.min(box.w / hr, box.h / vr) >= OVAL_OUTLINE_MIN_CSS) ellipse(outs, box, Math.max(px, pxV) / 2);
            side = b.put ? 1 : -1;
            strength = b.strength;
            any = true;
          }
          if (!any) continue;
          const rgb = markInk(side, strength, inks);
          ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${src.globalDim.toFixed(3)})`;
          ctx.fill(path);
          const s = shade(rgb);
          ctx.lineWidth = Math.max(px, pxV);
          ctx.strokeStyle = `rgba(${s[0]},${s[1]},${s[2]},${src.globalDim.toFixed(3)})`;
          ctx.stroke(outs);
          if (pinned && strike === focus) {
            /* the pinned chain's ring: one pixel of the ink round every node */
            const ringPath = new Path2D();
            for (const p of placed) {
              const b = p.g.all.get(strike);
              if (!b) continue;
              const box = boxOf(p.cxDev, y, b.t, p.capDev);
              addOval(ringPath, box.left + box.w / 2, box.top + box.h / 2, box.w / 2 + px / 2, box.h / 2 + pxV / 2);
            }
            ctx.lineWidth = Math.max(px, pxV);
            ctx.strokeStyle = rgba(ringInk, 0.9);
            ctx.stroke(ringPath);
          }
        }
        /* the hovered node's ring, 1.5 px, outside the node */
        if (hovered) {
          const y = yOf(hover.strike);
          const p = placed.find(q => q.g.cols.some(c => snaps[c].time === hover.time) || q.g.all.get(hover.strike)?.ci === hover.ci);
          const b = p?.g.all.get(hover.strike);
          if (y !== null && p && b) {
            const box = boxOf(p.cxDev, y, b.t, p.capDev);
            const lw = Math.max(1, Math.round(1.5 * Math.min(hr, vr)));
            ctx.lineWidth = lw;
            ctx.strokeStyle = rgba(ringInk, 0.95);
            ctx.beginPath();
            ctx.ellipse(box.left + box.w / 2, box.top + box.h / 2, box.w / 2 + lw, box.h / 2 + lw, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
        /* the candles keep their edge over the brightened chain too */
        this.candleEdges(ctx, series, ts, scope, barSpacing, ground, px, pxV);
      }

      // ---- the words: gap labels, the node pills, the wall-move chips and ticks ----------------------------------
      /* every box placed on the plot; nothing written over another (the orbs message, items 11 and 14) */
      const boxes: { l: number; r: number; t: number; b: number }[] = [];
      const px11 = Math.max(11, src.labelPx);
      const full = (px11 + 5) * vr;
      const padX = 4 * hr;
      const floorDev = floorCss * vr;
      const leftMost = CHIP_LEFT * hr;
      const rightMost = (wCss - CHIP_RIGHT) * hr;
      /* the library's attribution mark stands at the plot's bottom-left: a keep-out box */
      boxes.push({ l: 0, r: LOGO_W_CSS * hr, t: (paneHCss - LOGO_H_CSS) * vr, b: paneHCss * vr });
      /* and the chart's Reset whisper pill (ResetViewControl: centred on the chart's box, price scale included, 24 px
         tall, its foot 4 px over the plot's) — a keep-out box a little wider than the pill */
      {
        const cx = (wCss + RESET_SCALE_CSS) / 2;
        boxes.push({ l: (cx - RESET_HALF_W_CSS) * hr, r: (cx + RESET_HALF_W_CSS) * hr, t: (paneHCss - 30) * vr, b: (paneHCss - 2) * vr });
      }
      const collides = (l: number, r: number, t: number, b: number) => boxes.some(q => l < q.r + 2 * hr && r > q.l - 2 * hr && t < q.b + 2 * vr && b > q.t - 2 * vr);
      /** a box slid down (then up) until it stands clear, or null when the plot has no room for it */
      const settle = (l: number, r: number, t: number, h: number): number | null => {
        let top = t;
        for (let i = 0; i < 24 && collides(l, r, top, top + h); i++) {
          const hit = boxes.filter(q => l < q.r + 2 * hr && r > q.l - 2 * hr && top < q.b + 2 * vr && top + h > q.t - 2 * vr);
          top = Math.max(...hit.map(q => q.b)) + 2 * vr;
        }
        if (top + h <= paneHCss * vr) return top;
        top = t;
        for (let i = 0; i < 24 && collides(l, r, top, top + h); i++) {
          const hit = boxes.filter(q => l < q.r + 2 * hr && r > q.l - 2 * hr && top < q.b + 2 * vr && top + h > q.t - 2 * vr);
          top = Math.min(...hit.map(q => q.t)) - h - 2 * vr;
        }
        return top >= floorDev ? top : null;
      };
      ctx.font = `${Math.round(px11 * vr)}px ${FONT_SANS}`;
      ctx.textBaseline = 'middle';
      const padInk = paper ? rgba(paper.pad, 0.88) : 'rgba(5,5,5,0.78)';
      const wordInk: RGB3 = paper ? paper.ink : [235, 235, 235];
      const n = paper ? paper.neutral : NEUTRAL_RGB;

      // the gaps, each with its reason (B1: "Never a blank chart without a reason") — ONE small note per gap, INSIDE its gap at
      // the foot of the plot, hidden where the gap is too narrow to hold it (the orbs' second round, 2026-10-15)
      placeGapNotes(ctx, this.gapRuns, ts, barSpacing, { hr, vr, paneHCss, full, padX, leftMost, rightMost, padInk, ink: n }, boxes, collides);

      // THE NODE PILLS (item 11): the three largest live nodes, "strike · % of the largest" with an oval swatch, beside
      // the last candle inside the plot, never over one another or the axis chips
      if (src.nodeLabels && placed.length) {
        const liveP = placed[placed.length - 1];
        const isLive = liveP.g.cols[liveP.g.cols.length - 1] === snaps.length - 1;
        if (isLive) {
          const nodes = src.nodesOf(liveP.g).slice().sort((a, b) => b.gross - a.gross).slice(0, NODE_LABELS);
          /* "% of the largest": the size reference — the session's largest node so far — so the words match the sizes */
          const largest = src.refAt(snaps.length - 1).refG || nodes[0]?.gross || 0;
          ctx.textAlign = 'left';
          const swW = 7 * hr;
          const swH = 9 * vr;
          const xLastCss = liveP.xCss + liveP.widthCss / 2;
          for (const b of nodes) {
            if (!(largest > 0)) break;
            const y = yOf(b.strike);
            if (y === null) continue;
            const strikeLabel = b.strike % 1 === 0 ? num(b.strike, 0) : num(b.strike, 2);
            const text = `${strikeLabel} · ${Math.round(Math.min(1, b.gross / largest) * 100)}%`;
            const tw = ctx.measureText(text).width;
            const pw = swW + 4 * hr + tw + 2 * padX;
            let l = (xLastCss + 8) * hr;
            if (l + pw > (wCss - 6) * hr) l = (liveP.xCss - liveP.widthCss / 2 - 8) * hr - pw;
            if (l < leftMost) continue;
            const want = Math.max(floorDev, Math.min(paneHCss * vr - full, y * vr - full / 2));
            const top = settle(l, l + pw, want, full);
            if (top === null) continue;
            boxes.push({ l, r: l + pw, t: top, b: top + full });
            ctx.fillStyle = padInk;
            ctx.fillRect(l, top, pw, full);
            const rgb = markInk(b.put ? 1 : -1, b.strength, inks);
            ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alphaOf(Math.round(b.t * STRENGTH_STEPS)).toFixed(3)})`;
            ctx.beginPath();
            ctx.ellipse(l + padX + swW / 2, top + full / 2, swW / 2, swH / 2, 0, 0, Math.PI * 2);
            ctx.fill();
            const s = shade(rgb);
            ctx.lineWidth = Math.max(px, pxV);
            ctx.strokeStyle = `rgba(${s[0]},${s[1]},${s[2]},0.95)`;
            ctx.stroke();
            ctx.fillStyle = `rgba(${wordInk[0]},${wordInk[1]},${wordInk[2]},0.95)`;
            ctx.fillText(text, l + padX + swW + 4 * hr, top + full / 2);
          }
        }
      }

      // the walls' moves and states: a chip where a wall changed strike (the stick has done the holding) or was broken or
      // reclaimed, and a short tick at a move
      {
        const tFrom = snaps[first].time;
        const tTo = snaps[last - 1].time + Math.max(60, src.stepSec);
        const moves = src.wallMoves.filter(m => m.time >= tFrom && m.time < tTo);
        const states = src.wallStates.filter(m => m.time >= tFrom && m.time < tTo);
        const chipFloorCss = floorCss;
        /* every move in view wears a short tick at the NEW strike on the bar it moved: two pixels wide, seven tall (the
           orbs message, item 14 — they drew most of a strike row tall) */
        const tw = Math.max(px, Math.round(TICK_W_CSS * hr));
        const th = Math.max(pxV, Math.round(TICK_H_CSS * vr));
        for (const m of moves) {
          const bucket = Math.floor(m.time / barSec) * barSec;
          const xBar = ts.timeToCoordinate(bucket as Time);
          const y = series.priceToCoordinate(m.to);
          if (xBar === null || y === null || y < chipFloorCss || y > paneHCss) continue;
          const rgb = paper ? (m.kind === 'CW' ? paper.cw : paper.pw) : m.kind === 'CW' ? CW_RGB : PW_RGB;
          ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${(0.95 * src.globalDim).toFixed(3)})`;
          ctx.fillRect(Math.round(xBar * hr - tw / 2), Math.round(y * vr - th / 2), tw, th);
        }
        /* the newest few, moves and states together: "PW 772 → 770 · 12:12 pm", "PW 772 broken · 10:54 am" */
        type Chip = { kind: 'CW' | 'PW'; at: number; time: number; words: (fmt: (k: number) => string) => string };
        const chips: Chip[] = [
          ...moves.map(m => ({ kind: m.kind, at: m.to, time: m.time, words: (fmt: (k: number) => string) => `${m.kind} ${fmt(m.from)} → ${fmt(m.to)}` })),
          ...states.map(m => ({ kind: m.kind, at: m.strike, time: m.time, words: (fmt: (k: number) => string) => `${m.kind} ${fmt(m.strike)} ${m.state}` })),
        ].sort((a, b) => b.time - a.time);
        const keep = chips.slice(0, WALL_CHIPS);
        ctx.textAlign = 'left';
        for (const m of keep) {
          const bucket = Math.floor(m.time / barSec) * barSec;
          const xBar = ts.timeToCoordinate(bucket as Time);
          const yAt = series.priceToCoordinate(m.at);
          if (xBar === null || yAt === null) continue;
          /* A WALL BEYOND THE CLEAR AREA IS PINNED AT ITS EDGE AND SAYS SO (the owner's second review, 2026-10-13) */
          const pin = yAt < chipFloorCss ? '▲ ' : yAt > paneHCss ? '▼ ' : '';
          const y = pin === '▲ ' ? chipFloorCss : pin === '▼ ' ? paneHCss : yAt;
          const fmt = (k: number) => (k % 1 === 0 ? num(k, 0) : num(k, 2));
          const text = `${pin}${m.words(fmt)} · ${nyClock(m.time * 1000)}`;
          const w = ctx.measureText(text).width;
          let l = xBar * hr + 3 * hr;
          if (l + w + padX * 2 > rightMost) l = xBar * hr - 3 * hr - w - padX * 2;
          l = Math.max(leftMost, Math.min(l, rightMost - w - padX * 2));
          if (l + w + padX * 2 > rightMost) continue;
          /* above its strike, else under it; off every box placed already; never into the chrome */
          let want = pin === '▲ ' ? floorDev : y * vr - full - 3 * vr;
          if (want < floorDev) want = Math.max(floorDev, y * vr + 3 * vr);
          const top = settle(l, l + w + padX * 2, want, full);
          if (top === null) continue;
          boxes.push({ l, r: l + w + padX * 2, t: top, b: top + full });
          const rgb = paper ? (m.kind === 'CW' ? paper.cw : paper.pw) : m.kind === 'CW' ? CW_RGB : PW_RGB;
          ctx.fillStyle = padInk;
          ctx.fillRect(l, top, w + padX * 2, full);
          ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.95)`;
          ctx.fillText(text, l + padX, top + full / 2);
        }
      }
    });
  }

  /** The candles' one-pixel edge in the ground's colour (the library's own pixel rules for body and wick) */
  private candleEdges(ctx: CanvasRenderingContext2D, series: ISeriesApi<'Candlestick'>, ts: ReturnType<IChartApi['timeScale']>, scope: BitmapScope, barSpacing: number, ground: RGB3, px: number, pxV: number): void {
    const r = ts.getVisibleLogicalRange();
    if (!r) return;
    const hr = scope.horizontalPixelRatio;
    const vr = scope.verticalPixelRatio;
    const bodyW = optimalCandlestickWidth(barSpacing, hr);
    let wickW = Math.min(Math.floor(hr), Math.floor(barSpacing * hr));
    wickW = Math.max(Math.floor(hr), Math.min(wickW, bodyW));
    const wickOff = Math.floor(wickW * 0.5);
    const from = Math.max(0, Math.ceil(r.from));
    const to = Math.floor(r.to);
    const path = new Path2D();
    let any = false;
    for (let i = from; i <= to && i - from < 4000; i++) {
      const d = series.dataByIndex(i) as { open?: number; high?: number; low?: number; close?: number } | null;
      if (!d || d.open == null || d.close == null || d.high == null || d.low == null) continue;
      const x = ts.logicalToCoordinate(i as unknown as Parameters<typeof ts.logicalToCoordinate>[0]);
      if (x === null) continue;
      const oy = series.priceToCoordinate(d.open);
      const cy = series.priceToCoordinate(d.close);
      const hy = series.priceToCoordinate(d.high);
      const ly = series.priceToCoordinate(d.low);
      if (oy === null || cy === null || hy === null || ly === null) continue;
      const scaledX = Math.round(hr * x);
      const top = Math.round(Math.min(oy, cy) * vr);
      const bottom = Math.round(Math.max(oy, cy) * vr);
      const left = scaledX - Math.floor(bodyW * 0.5);
      /* the body's edge: four one-pixel rects round the body's box */
      path.rect(left - px, top - pxV, bodyW + 2 * px, pxV);
      path.rect(left - px, bottom + 1, bodyW + 2 * px, pxV);
      path.rect(left - px, top, px, bottom - top + 1);
      path.rect(left + bodyW, top, px, bottom - top + 1);
      /* the wick's edge, above and below the body */
      const high = Math.round(hy * vr);
      const low = Math.round(ly * vr);
      const wl = scaledX - wickOff;
      if (high < top - pxV) {
        path.rect(wl - px, high - pxV, wickW + 2 * px, pxV);
        path.rect(wl - px, high, px, top - pxV - high);
        path.rect(wl + wickW, high, px, top - pxV - high);
      }
      if (low > bottom + pxV) {
        path.rect(wl - px, low + 1, wickW + 2 * px, pxV);
        path.rect(wl - px, bottom + pxV + 1, px, low - bottom - pxV);
        path.rect(wl + wickW, bottom + pxV + 1, px, low - bottom - pxV);
      }
      any = true;
    }
    if (!any) return;
    ctx.fillStyle = `rgb(${ground[0]},${ground[1]},${ground[2]})`;
    ctx.fill(path);
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
  /** THE NODE PILLS (the orbs message, item 11): the three largest live nodes named beside the last candle */
  nodeLabels = true;
  /** THE HOVER: the node under the pointer — its chain brightens, the rest dims (set by the chart as the pointer moves) */
  hover: { strike: number; time: number; ci: number } | null = null;
  setHover(h: BeadHit | null): void {
    const next = h ? { strike: h.strike, time: h.time, ci: h.ci } : null;
    if ((this.hover == null) === (next == null) && (!next || (this.hover!.strike === next.strike && this.hover!.ci === next.ci))) return;
    this.hover = next;
    this.requestUpdate?.();
  }
  /** How many candles a group merges this frame (the renderer's; the hit test reads the same) */
  groupBars = 1;
  /** THE STALE STATE (the UI pass): every bead's light times this — the host sets it under 1 while its data is old */
  globalDim = 1;
  /** THE GAPS' REASONS (B1): the host's words for a run of bars with no column, [from, to) in epoch seconds — null for
      none to say. Set by the chart from its host (Terrain reads the store's state, the session's hours and the clock). */
  gapCause: ((fromSec: number, toSec: number) => string | null) | null = null;
  /** The session a bar stands in, for the gaps' runs (core/sessions.ts gapSessionKey) — null: New York's regular hours */
  gapSession: ((timeSec: number) => string) | null = null;
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
  /** The walls shown at each column (the stick read at the column's last minute), the raw observations by snapshot
      identity, and the minute-precise moves and states the chips name */
  private colShown: (WallShown | null)[] = [];
  private rawObs = new WeakMap<GexSnapshot, WallObs>();
  wallMoves: WallMove[] = [];
  wallStates: WallStateEvent[] = [];
  /** Groups by their column span, for this revision */
  private groupCache = new Map<string, Group>();
  /** The columns ci0..ci1 (inclusive) as one group: each strike its peak-minute cell, ranked by size */
  groupOf(ci0: number, ci1: number): Group {
    const key = `${ci0}|${ci1}|${this.floor}`;
    const had = this.groupCache.get(key);
    if (had) return had;
    const all = new Map<number, Bead>();
    for (let c = ci0; c <= ci1; c++) {
      const col = this.columnAt(c);
      for (const b of col.all.values()) {
        const cur = all.get(b.strike);
        if (!cur || b.gross > cur.gross) all.set(b.strike, b);
      }
    }
    const last = this.columnAt(ci1);
    const floorAbs = this.floor * last.refG;
    const nodes = [...all.values()].filter(b => b.gross > 0 && b.gross >= floorAbs && b.step > 0).sort((a, b) => b.gross - a.gross);
    const g: Group = { cols: Array.from({ length: ci1 - ci0 + 1 }, (_, k) => ci0 + k), nodes, all, last, topSet: new Set(nodes.slice(0, 3).map(b => b.strike)) };
    if (this.groupCache.size > 4000) this.groupCache.clear();
    this.groupCache.set(key, g);
    return g;
  }
  /** The nodes a group draws: the TOP_NODES largest by size and the walls shown (HOW MANY 6); every strike with the
      density off ("Every strike") */
  nodesOf(g: Group): Bead[] {
    if (!this.density) return g.nodes;
    const out = g.nodes.slice(0, TOP_NODES);
    for (const k of [g.last.cw, g.last.pw]) {
      if (k == null || out.some(b => b.strike === k)) continue;
      const b = g.all.get(k);
      if (b && b.gross > 0) out.push(b);
    }
    return out;
  }
  /** Whether any column holds the strike (a hover on a strike the tape has not got draws nothing) */
  hasStrike(strike: number): boolean {
    const last = this.snapshots[this.snapshots.length - 1];
    return !!last && last.levels.some(l => l.strike === strike);
  }

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
  /* THE SIZE REFERENCE IS THE SESSION'S LARGEST NODE SO FAR (the orbs' second round, 2026-10-15 — the owner: "almost
     every oval draws at full height, so size says nothing … Make the reference the largest node of the session so far
     (no look-ahead). The largest is full size; the rest scale by √(size ÷ largest)"): a running maximum of each
     minute's peak gross, started over each New York day — the p85 it was clipped nearly every node at full */
  private runMaxG = 0;
  private dayMaximaG = new Map<string, number[]>();
  /** refAt's answers by column, kept until the base, the basis or the references change */
  private refMemo = new WeakMap<GexSnapshot, ReturnType<GexTrailsPrimitive['refAt']>>();
  private baseGreek: TrailGreek = 'gex';
  /** Each New York day's per-minute peaks in the base, for the prior and fixed bases (built as the base is) */
  private dayMaxima = new Map<string, number[]>();
  private dayRefs = new Map<string, { prior: ScaleRef | null; fixed: ScaleRef | null; priorG: ScaleRef | null; fixedG: ScaleRef | null; priorDay: string | null }>();

  /* THE SESSIONS THE SERVER FOLDED (Section I, src/data/feed/tiles.ts): their columns carry their own references and
     held walls (GexSnapshot `pre`); their per-minute peaks (the prior and fixed bases pool them as they pool the
     store's) and their walls' minute-precise moves and states are handed here, beside the page's own minutes */
  private preMaxima = new Map<string, { m: number[]; g: number[]; d: number[] }>();
  private preMoves: WallMove[] = [];
  private preStates: WallStateEvent[] = [];
  setPre(maxima: Map<string, { m: number[]; g: number[]; d: number[] }>, events: readonly [number, number, number | null, number, number][]): void {
    this.preMaxima = maxima;
    this.preMoves = [];
    this.preStates = [];
    for (const [k, strike, from, state, time] of events) {
      const kind = k === 0 ? 'CW' : 'PW';
      if (from != null) this.preMoves.push({ kind, from, to: strike, time, i: -1 });
      else if (state === 2 || state === 3) this.preStates.push({ kind, strike, state: state === 2 ? 'broken' : 'reclaimed', time, i: -1 });
    }
    this.dayRefs.clear();
    this.refMemo = new WeakMap();
  }

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
    this.runMaxG = 0;
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
        this.runMaxG = 0;
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
      this.runMaxG = Math.max(this.runMaxG, mg);
      this.baseRefG.push(this.runMaxG);
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
    /* a day's per-minute peaks: the page's own minutes, else the server's fold (the greek's own list) */
    const maxOf = (d: string): number[] | undefined => this.dayMaxima.get(d) ?? (this.preMaxima.has(d) ? (this.greek === 'dex' ? this.preMaxima.get(d)!.d : this.preMaxima.get(d)!.m) : undefined);
    const maxGOf = (d: string): number[] | undefined => this.dayMaximaG.get(d) ?? this.preMaxima.get(d)?.g;
    const before = [...new Set([...this.dayMaxima.keys(), ...this.preMaxima.keys()])].filter(d => d < day).sort();
    const priorDay = before.length ? before[before.length - 1] : null;
    const prior = ext?.prior ?? (priorDay ? pooledRef(maxOf(priorDay) ?? [], 1) : null);
    const pool = before.slice(-FIXED_SESSIONS);
    const fixed = ext?.fixed ?? (pool.length ? pooledRef(pool.flatMap(d => maxOf(d) ?? []), pool.length) : null);
    /* the size's twins stand on the sessions this page holds (the server's scale.json carries the net's references
       alone — a follow-up adds the gross) */
    /* the size's: the largest node of the prior session, or of the sixty before (the largest, as the session's own is) */
    const largestOf = (xs: number[], sessions: number): ScaleRef | null => {
      let m = 0;
      for (const x of xs) if (x > m) m = x;
      return m > 0 ? { ref: m, ring: m, minutes: xs.length, sessions } : null;
    };
    const priorG = priorDay ? largestOf(maxGOf(priorDay) ?? [], 1) : null;
    const fixedG = pool.length ? largestOf(pool.flatMap(d => maxGOf(d) ?? []), pool.length) : null;
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
    /* a column the server folded carries its session's reference as of its last minute (the greek's own) */
    const pre = snap.pre;
    if (this.basis !== 'session') {
      const r = this.dayRef(day);
      const got = this.basis === 'prior' ? r.prior : r.fixed;
      const gotG = this.basis === 'prior' ? r.priorG : r.fixedG;
      if (got) return { ref: got.ref, ring: got.ring, refG: gotG?.ref ?? got.ref, basis: this.basis, at: j >= 0 ? this.baseTimes[j] : snap.time, minutes: got.minutes, sessions: got.sessions, priorDay: r.priorDay };
    }
    if (pre) {
      const dex = this.greek === 'dex';
      return { ref: dex ? pre.refD : pre.ref, ring: dex ? pre.ringD : pre.ring, refG: dex ? pre.maxD : pre.refG, basis: 'session', at: pre.at, minutes: pre.minutes, sessions: 1, priorDay: null };
    }
    if (j >= 0 && this.baseDays[j] === day) return { ref: this.baseRef[j], ring: this.baseRing[j], refG: this.baseRefG[j], basis: 'session', at: this.baseTimes[j], minutes: j - this.baseFirst[j] + 1, sessions: 1, priorDay: null };
    return { ref: 0, ring: 0, refG: 0, basis: 'session', at: snap.time, minutes: 0, sessions: 0, priorDay: null };
  }

  /** The reference the host last handed the legend — the renderer checks the newest column against it in development
      (item 5 acceptance (i): "the legend value equals the reference the renderer used at that minute (assert)") */
  published: number | null = null;
  /** What the legend prints: the newest column's reference, the very number its beads were drawn against */
  legend(): (ReturnType<GexTrailsPrimitive['refAt']> & { greek: TrailGreek; sizeBy: 'gross' | 'net'; inks: MarkInks; nodes: number }) | null {
    if (!this.snapshots.length) return null;
    const last = this.snapshots[this.snapshots.length - 1];
    const r = this.refAt(this.snapshots.length - 1);
    /* the size stands on the gross where the newest column keeps it (the gamma field on the feed and the house's tape);
       on a tape that keeps the net alone (store rows before 2026-10-14) it stands on |net|, and the legend says so */
    const sizeBy: 'gross' | 'net' = this.greek === 'gex' && last.levels.some(l => l.gross != null) ? 'gross' : 'net';
    /* the inks the nodes wear on this tape — the legend's swatches are drawn in them */
    const inks: MarkInks = this.paper ? { put: this.paper.put, call: this.paper.call, neutral: this.paper.neutral } : DARK_MARK_INKS;
    return r.ref > 0 ? { ...r, greek: this.greek, sizeBy, inks, nodes: this.density ? TOP_NODES : 0 } : null;
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
    this.groupCache.clear();
    /* THE WALLS FROM THE BOOK, HELD (trailModel WallStick): one stick over the PER-MINUTE store, in time order, starting
       over on a new day — the raw picks cached by snapshot identity, the walk a few thousand cheap steps — and each
       column reads it at its last minute, so a 5-minute chart and a 1-minute chart name the same walls at the same time */
    {
      const minutes = base ?? snapshots;
      const stick = new WallStick();
      const shown: (WallShown & { time: number })[] = new Array(minutes.length);
      for (let i = 0; i < minutes.length; i++) {
        const snap = minutes[i];
        let o = this.rawObs.get(snap);
        if (!o) {
          const spot = snap.spot ?? snap.levels[Math.floor(snap.levels.length / 2)]?.strike ?? 0;
          o = wallObsOf(snap.time, spot, snap.levels);
          this.rawObs.set(snap, o);
        }
        shown[i] = { ...stick.next(o), time: snap.time };
      }
      this.wallMoves = [...this.preMoves, ...stickyWallMoves(shown.length, i => shown[i])];
      this.wallStates = [...this.preStates, ...wallStateEventsOf(shown.length, i => shown[i])];
      /* a column's last minute: its time plus its span less a minute */
      const span = Math.max(60, this.stepSec) - 60;
      this.colShown = new Array(snapshots.length);
      let j = 0;
      for (let i = 0; i < snapshots.length; i++) {
        /* a column the server folded carries the walls the stick held at its last minute */
        const pre = snapshots[i].pre;
        if (pre) {
          this.colShown[i] = { cw: pre.cw, pw: pre.pw, cwState: pre.cwState, pwState: pre.pwState, cwSince: 0, pwSince: 0, cwStateAt: 0, pwStateAt: 0 };
          continue;
        }
        const end = snapshots[i].time + span;
        while (j + 1 < shown.length && shown[j + 1].time <= end) j++;
        this.colShown[i] = shown.length && shown[j].time <= end ? shown[j] : null;
      }
    }
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
    const held0 = this.colShown[i];
    /* the walls shown ride in the key: the column a live minute replaces reads the stick afresh */
    const key = `${ref}|${refG}|${this.floor}|${held0?.cw}|${held0?.pw}|${held0?.cwState}|${held0?.pwState}`;
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
        all.set(l.strike, { strike: l.strike, value: v, gross, t, step: stepOf(t), strength, put: v >= 0, stale: staleOf(l), ci: i });
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
      const held = this.colShown[i];
      const cw = held ? held.cw : walls.callWall;
      const pw = held ? held.pw : walls.putWall;
      col = { time: snap.time, top, all, ref, refG, key, flip, cw, pw, cwState: held?.cwState ?? null, pwState: held?.pwState ?? null, rawCw: walls.callWall, rawPw: walls.putWall, spot, step: Number.isFinite(step) ? step : 1, topSet: new Set(top.slice(0, 3).map(b => b.strike)) };
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
   * The node under a point on the pane (CSS px), or null — the group whose span holds x (the same merge the renderer
   * drew this frame), and the drawn strike nearest y within half a row. Read by the chart's hover card, its hover ring and
   * its click.
   */
  beadAt(x: number, y: number): BeadHit | null {
    if (!this.enabled || !this.chart || !this.series || !this.snapshots.length || this.ref <= 0) return null;
    const ts = this.chart.timeScale();
    const t = ts.coordinateToTime(x);
    if (t == null) return null;
    const bar = Math.floor(Number(t) / this.barSec) * this.barSec;
    const spanSec = this.barSec * Math.max(1, this.groupBars);
    const bucket = Math.floor(bar / spanSec) * spanSec;
    const snaps = this.snapshots;
    let lo = 0;
    let hi = snaps.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (snaps[m].time < bucket) lo = m + 1;
      else hi = m;
    }
    if (lo >= snaps.length || snaps[lo].time >= bucket + spanSec) return null;
    let hi2 = lo;
    while (hi2 + 1 < snaps.length && snaps[hi2 + 1].time < bucket + spanSec) hi2++;
    const g = this.groupOf(lo, hi2);
    /* the strike row's height: half of it is the reach */
    const col = g.last;
    const y0 = this.series.priceToCoordinate(col.spot);
    const y1 = this.series.priceToCoordinate(col.spot + col.step);
    const reach = y0 != null && y1 != null && Math.abs(y0 - y1) > 0 ? Math.max(4, Math.abs(y0 - y1) / 2) : 6;
    let best: Bead | null = null;
    let bestD = reach;
    const drawn = this.nodesOf(g);
    const want = this.focusStrike != null && !drawn.some(b => b.strike === this.focusStrike) ? [...drawn, g.all.get(this.focusStrike)].filter((b): b is Bead => !!b) : drawn;
    for (const b of want) {
      const by = this.series.priceToCoordinate(b.strike);
      if (by === null) continue;
      const d = Math.abs(by - y);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    if (!best) return null;
    const i = best.ci;
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
    const colI = this.columnAt(i);
    return { strike: best.strike, time: snap.time, ci: i, value, share: total > 0 ? Math.abs(value) / total : 0, open, rebuilt: !!snap.rebuilt, level: lvl, flip: colI.flip, crossings: crossings.slice(1, 4), snap, x, y: this.series.priceToCoordinate(best.strike) ?? y };
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
