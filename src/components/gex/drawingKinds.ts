/*
==================================================
  SLAYER TERMINAL - THE EVERYDAY DRAWING KINDS
  (components/gex/drawingKinds.ts)

  The layer's first thirteen kinds are drawn inside
  drawingsPrimitive.ts. These twenty-one arrived
  together (Noah, 2026-09-19, with TradingView's own
  drawing panels: "how can we add all of these into
  the toolbar without extending the toolbar super
  long" → "build it, rail plus the everyday tools"),
  and the primitive was a thousand lines already, so
  they live here: how each one is DRAWN and how each
  one is HIT, as two functions the primitive calls
  first and falls through when they say "not mine".

  Both halves of a kind sit side by side on purpose —
  a mark that is drawn one way and hit another is the
  bug this layer has met most often.

    LINES      ray · hray · cross
    FIB        fibext · fibchannel
    MEASURE    long · short · prange · drange · avwap
    SHAPES     triangle · circle · rotrect · polyline
               brush · highlighter · arrowup · arrowdown
    WORDS      text · callout · pricelabel

  COLOUR. A mark is the reader's, so it wears the
  layer's white or the ink they chose. Three places
  take the pair instead, because there they ARE
  direction: a position's reward and risk, a price
  range's sign, and the up and down arrow stamps.
==================================================
*/

import { fmtElapsed, measureSpan } from '../../data/measure';
import type { Drawing, DrawingPoint } from './drawingsPrimitive';

export interface KindBar {
  time: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const UP = '48,209,88';
const DOWN = '255,59,48';
const HIGHLIGHT = '245,197,66';

export const FIBEXT_RATIOS = [0, 0.618, 1, 1.272, 1.618, 2.618] as const;
export const FIBCHANNEL_RATIOS = [0, 0.382, 0.618, 1, 1.618] as const;

/** Everything a kind needs to draw itself — bitmap pixels throughout */
export interface KindRender {
  ctx: CanvasRenderingContext2D;
  hr: number;
  vr: number;
  w: number;
  h: number;
  /** time → x on the bar grid; null off it */
  X(time: number): number | null;
  /** time → x BETWEEN bars too — the freehand kinds */
  XE(time: number): number | null;
  Y(price: number): number | null;
  /** 'r,g,b' */
  ink: string;
  textInk: string;
  /** the mark chose its own ink */
  inked: boolean;
  alpha: number;
  /** still in the hand — not yet committed */
  draft: boolean;
  bars: KindBar[];
  barsRev: number;
  barMinutes: number;
  font(px?: number): string;
  /** the 1–4 width field spoken as type */
  typePx(width?: number): number;
  wash(x: number, y: number, w: number, h: number, r: number, fill: string, stroke?: string): void;
  dot(x: number, y: number): void;
}

/** Everything a kind needs to answer "is the pointer on me" — CSS pixels throughout */
export interface KindHit {
  x: number;
  y: number;
  P(pt?: DrawingPoint): [number, number] | null;
  PE(pt?: DrawingPoint): [number, number] | null;
  X(time: number): number | null;
  Y(price: number): number | null;
  w: number;
  h: number;
  distSeg(ax: number, ay: number, bx: number, by: number): number;
  BODY: number;
  AXIS: number;
  bars: KindBar[];
  barsRev: number;
  typePx(width?: number): number;
}

// ---- shared geometry ----------------------------------------------------------

type XY = [number, number];

const inPoly = (x: number, y: number, poly: XY[]): boolean => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

/** The rotated rectangle's four corners: p1→p2 is one side, p3's distance off that line is the width */
const rotRectCorners = (a: XY, b: XY, c: XY): XY[] => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const dist = (c[0] - a[0]) * nx + (c[1] - a[1]) * ny;
  return [a, b, [b[0] + nx * dist, b[1] + ny * dist], [a[0] + nx * dist, a[1] + ny * dist]];
};

/** Where a ray from a through b leaves a box `w` wide */
const rayEnd = (a: XY, b: XY, w: number): XY => {
  if (b[0] === a[0]) return [a[0], b[1] >= a[1] ? 1e5 : -1e5];
  const xe = b[0] > a[0] ? w : 0;
  return [xe, a[1] + ((b[1] - a[1]) / (b[0] - a[0])) * (xe - a[0])];
};

/** The extension's rules run from its first anchor to half a span past its last */
const fibExtSpan = (xs: number[]): [number, number] => {
  const xa = Math.min(...xs);
  const xb = Math.max(...xs);
  return [xa, xb + Math.max(40, (xb - xa) * 0.5)];
};

/** The stop a position opens with: half the reward away on the other side — two to one */
export const defaultStop = (entry: number, target: number): number => entry - (target - entry) / 2;

// ---- the anchored VWAP -----------------------------------------------------------

let vwapRev = -1;
const vwapCache = new Map<number, { i0: number; v: number[] } | null>();
/** Volume-weighted average price from the anchor's bar on: Σ(typical × volume) / Σ volume */
export function avwapSeries(bars: KindBar[], rev: number, anchorTime: number): { i0: number; v: number[] } | null {
  if (rev !== vwapRev) {
    vwapCache.clear();
    vwapRev = rev;
  }
  const kept = vwapCache.get(anchorTime);
  if (kept !== undefined) return kept;
  let i0 = bars.findIndex(b => b.time >= anchorTime);
  /* anchored in the empty room right of the last candle: it starts at the last bar there is, and grows as bars print */
  if (i0 < 0 && bars.length) i0 = bars.length - 1;
  let out: { i0: number; v: number[] } | null = null;
  if (i0 >= 0) {
    const v: number[] = [];
    let pv = 0;
    let vol = 0;
    for (let i = i0; i < bars.length; i++) {
      const b = bars[i];
      /* a bar with no volume still happened — it counts once, so a quiet tape draws a line rather than nothing */
      const wgt = b.volume > 0 ? b.volume : 1;
      pv += ((b.high + b.low + b.close) / 3) * wgt;
      vol += wgt;
      v.push(pv / vol);
    }
    out = { i0, v };
  }
  vwapCache.set(anchorTime, out);
  return out;
}

// ---- words ---------------------------------------------------------------------------

/** A words box's size in CSS px, estimated at the mono face's ~0.58em a character — the hit area, and the callout's frame before the canvas measures it */
const wordsBox = (text: string, px: number): { w: number; h: number } => ({ w: Math.max(18, text.length * px * 0.6) + 12, h: px * 1.7 });

const priceWords = (price: number): string => price.toFixed(2);

// ---- DRAWN -----------------------------------------------------------------------------

/** Draw `d` if it is one of these kinds. False: not mine — the primitive draws it. */
export function renderKind(d: Drawing, R: KindRender): boolean {
  const { ctx, hr, vr, w, h, ink, alpha } = R;
  const solid = `rgba(${ink},${alpha})`;
  const pt = (p?: DrawingPoint): XY | null => {
    if (!p) return null;
    const x = R.X(p.time);
    const y = R.Y(p.price);
    return x === null || y === null ? null : [x, y];
  };
  const line = (a: XY, b: XY) => {
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  };
  const head = (tip: XY, ang: number, size = 9 * vr) => {
    ctx.save();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(tip[0], tip[1]);
    ctx.lineTo(tip[0] - size * Math.cos(ang - 0.42), tip[1] - size * Math.sin(ang - 0.42));
    ctx.lineTo(tip[0] - size * Math.cos(ang + 0.42), tip[1] - size * Math.sin(ang + 0.42));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };
  /** One printed line on its wash; `at` is the box's left-middle. Returns the box's width. */
  const label = (text: string, x: number, y: number, inkRgb: string, a = 1, px?: number, frame?: string): number => {
    ctx.font = R.font(px);
    ctx.textBaseline = 'middle';
    const tw = ctx.measureText(text).width;
    const pad = 5 * hr;
    const hh = (px ?? 10) * 0.85 * vr;
    const bw = tw + pad * 2;
    const bx = Math.max(2 * hr, Math.min(x, w - bw - 2 * hr));
    R.wash(bx, y - hh, bw, hh * 2, 3 * vr, 'rgba(10,10,10,0.82)', frame);
    ctx.fillStyle = `rgba(${inkRgb},${a})`;
    ctx.fillText(text, bx + pad, y);
    return bw;
  };

  switch (d.kind) {
    // ── lines ──────────────────────────────────────────────────────────────
    case 'ray': {
      const a = pt(d.p1);
      const b = pt(d.p2);
      if (!a || !b) return true;
      line(a, rayEnd(a, b, w));
      R.dot(a[0], a[1]);
      R.dot(b[0], b[1]);
      return true;
    }
    case 'hray': {
      const a = pt(d.p1);
      if (!a) return true;
      line(a, [w, a[1]]);
      R.dot(a[0], a[1]);
      return true;
    }
    case 'cross': {
      const a = pt(d.p1);
      if (!a) return true;
      line([0, a[1]], [w, a[1]]);
      line([a[0], 0], [a[0], h]);
      return true;
    }

    // ── fib ────────────────────────────────────────────────────────────────
    case 'fibext': {
      const a = pt(d.p1);
      const b = pt(d.p2);
      if (!a || !b || !d.p2) return true;
      const c = pt(d.p3);
      /* the legs the projection is read off: the move, then the pullback it is projected from */
      ctx.save();
      ctx.setLineDash([4 * hr, 4 * hr]);
      ctx.lineWidth = 1 * vr;
      line(a, b);
      if (c) line(b, c);
      ctx.restore();
      if (c && d.p3) {
        const [xa, xb] = fibExtSpan([a[0], b[0], c[0]]);
        const leg = d.p2.price - d.p1.price;
        for (const r of FIBEXT_RATIOS) {
          const price = d.p3.price + leg * r;
          const y = R.Y(price);
          if (y === null) continue;
          const major = r === 0 || r === 1 || r === 1.618;
          ctx.strokeStyle = `rgba(${ink},${major ? alpha * 0.8 : alpha * 0.45})`;
          ctx.lineWidth = 1 * vr;
          line([xa, y], [xb, y]);
          label(`${r}  ${priceWords(price)}`, xb + 4 * hr, y, R.textInk, major ? alpha : alpha * 0.75);
        }
        ctx.strokeStyle = solid;
        ctx.fillStyle = solid;
        R.dot(c[0], c[1]);
      }
      ctx.fillStyle = solid;
      R.dot(a[0], a[1]);
      R.dot(b[0], b[1]);
      return true;
    }
    case 'fibchannel': {
      const a = pt(d.p1);
      const b = pt(d.p2);
      if (!a || !b) return true;
      const c = pt(d.p3);
      const baseYat = (x: number) => (b[0] !== a[0] ? a[1] + ((b[1] - a[1]) / (b[0] - a[0])) * (x - a[0]) : a[1]);
      if (!c) {
        line(a, rayEnd(a, b, w));
      } else {
        const off = c[1] - baseYat(c[0]);
        const e0 = rayEnd(a, b, w);
        /* the channel itself — 0 to 1 — is the space, and wears the wash */
        ctx.fillStyle = `rgba(${ink},0.04)`;
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(e0[0], e0[1]);
        ctx.lineTo(e0[0], e0[1] + off);
        ctx.lineTo(a[0], a[1] + off);
        ctx.closePath();
        ctx.fill();
        for (const r of FIBCHANNEL_RATIOS) {
          const whole = r === 0 || r === 1;
          ctx.strokeStyle = `rgba(${ink},${whole ? alpha : alpha * 0.5})`;
          line([a[0], a[1] + off * r], [e0[0], e0[1] + off * r]);
          label(String(r), a[0] - 34 * hr, a[1] + off * r, R.textInk, whole ? alpha : alpha * 0.7);
        }
        ctx.strokeStyle = solid;
        ctx.fillStyle = solid;
        R.dot(c[0], c[1]);
      }
      ctx.fillStyle = solid;
      R.dot(a[0], a[1]);
      R.dot(b[0], b[1]);
      return true;
    }

    // ── forecast and measure ───────────────────────────────────────────────
    case 'long':
    case 'short': {
      const a = pt(d.p1);
      const b = pt(d.p2);
      if (!a || !b || !d.p2) return true;
      const entry = d.p1.price;
      const target = d.p2.price;
      const stop = d.p3 ? d.p3.price : defaultStop(entry, target);
      const yS = R.Y(stop);
      if (yS === null) return true;
      const xa = Math.min(a[0], b[0]);
      const xb = Math.max(Math.max(a[0], b[0]), xa + 24 * hr);
      ctx.setLineDash([]);
      /* reward and risk ARE direction — the one place this layer takes the pair */
      ctx.fillStyle = `rgba(${UP},${0.16 * alpha})`;
      ctx.fillRect(xa, Math.min(a[1], b[1]), xb - xa, Math.abs(b[1] - a[1]));
      ctx.fillStyle = `rgba(${DOWN},${0.16 * alpha})`;
      ctx.fillRect(xa, Math.min(a[1], yS), xb - xa, Math.abs(yS - a[1]));
      ctx.lineWidth = 1 * vr;
      ctx.strokeStyle = `rgba(${UP},${0.7 * alpha})`;
      line([xa, b[1]], [xb, b[1]]);
      ctx.strokeStyle = `rgba(${DOWN},${0.7 * alpha})`;
      line([xa, yS], [xb, yS]);
      ctx.strokeStyle = solid;
      line([xa, a[1]], [xb, a[1]]);
      const reward = Math.abs(target - entry);
      const risk = Math.abs(stop - entry);
      const pct = (v: number) => `${((v / entry) * 100).toFixed(2)}%`;
      const above = (yy: number, other: number) => (yy < other ? yy - 11 * vr : yy + 11 * vr);
      label(`Target ${priceWords(target)}  ${reward.toFixed(2)}  ${pct(reward)}`, xa + 4 * hr, above(b[1], a[1]), UP, alpha);
      label(`Stop ${priceWords(stop)}  ${risk.toFixed(2)}  ${pct(risk)}`, xa + 4 * hr, above(yS, a[1]), DOWN, alpha);
      label(`${d.kind === 'long' ? 'Long' : 'Short'} ${priceWords(entry)}  reward to risk ${risk > 0 ? (reward / risk).toFixed(2) : '—'}`, xa + 4 * hr, a[1], R.textInk, alpha);
      ctx.fillStyle = solid;
      R.dot(a[0], a[1]);
      R.dot(b[0], b[1]);
      if (d.p3) {
        const sx = R.X(d.p3.time);
        if (sx !== null) R.dot(sx, yS);
      }
      return true;
    }
    case 'prange': {
      const a = pt(d.p1);
      const b = pt(d.p2);
      if (!a || !b || !d.p2) return true;
      const xa = Math.min(a[0], b[0]);
      const xb = Math.max(Math.max(a[0], b[0]), xa + 30 * hr);
      const rose = d.p2.price >= d.p1.price;
      const dir = rose ? UP : DOWN;
      ctx.setLineDash([]);
      ctx.fillStyle = `rgba(${dir},${0.1 * alpha})`;
      ctx.fillRect(xa, Math.min(a[1], b[1]), xb - xa, Math.abs(b[1] - a[1]));
      ctx.lineWidth = 1 * vr;
      line([xa, a[1]], [xb, a[1]]);
      line([xa, b[1]], [xb, b[1]]);
      const mx = (xa + xb) / 2;
      line([mx, a[1]], [mx, b[1]]);
      if (Math.abs(b[1] - a[1]) > 10 * vr) head([mx, b[1]], rose ? -Math.PI / 2 : Math.PI / 2, 7 * vr);
      const delta = d.p2.price - d.p1.price;
      const sign = delta >= 0 ? '+' : '−';
      label(`${sign}${Math.abs(delta).toFixed(2)}  ${sign}${Math.abs((delta / d.p1.price) * 100).toFixed(2)}%`, mx + 8 * hr, rose ? b[1] - 11 * vr : b[1] + 11 * vr, dir, alpha, 11);
      return true;
    }
    case 'drange': {
      const a = pt(d.p1);
      const b = pt(d.p2);
      if (!a || !b || !d.p2) return true;
      const xa = Math.min(a[0], b[0]);
      const xb = Math.max(a[0], b[0]);
      let ya = Math.min(a[1], b[1]);
      let yb = Math.max(a[1], b[1]);
      if (yb - ya < 28 * vr) {
        const mid = (ya + yb) / 2;
        ya = mid - 14 * vr;
        yb = mid + 14 * vr;
      }
      ctx.setLineDash([]);
      ctx.fillStyle = `rgba(${ink},${0.06 * alpha})`;
      ctx.fillRect(xa, ya, Math.max(1, xb - xa), yb - ya);
      ctx.lineWidth = 1 * vr;
      line([xa, ya], [xa, yb]);
      line([xb, ya], [xb, yb]);
      const my = (ya + yb) / 2;
      line([xa, my], [xb, my]);
      if (xb - xa > 12 * hr) head([b[0] >= a[0] ? xb : xa, my], b[0] >= a[0] ? 0 : Math.PI, 7 * vr);
      const span = measureSpan(d.p1.time, d.p1.price, d.p2.time, d.p2.price, R.barMinutes);
      const words = R.barMinutes > 0 ? `${span.bars} bar${span.bars === 1 ? '' : 's'} · ${fmtElapsed(span.tradingMin)}` : fmtElapsed(span.tradingMin);
      label(words, xa + 4 * hr, yb + 11 * vr, R.textInk, alpha, 11);
      return true;
    }
    case 'avwap': {
      const s = avwapSeries(R.bars, R.barsRev, d.p1.time);
      if (!s || s.v.length === 0) {
        /* no bars yet (a draft before the tape loads): the anchor alone, so the click still shows */
        const a = pt(d.p1);
        if (a) R.dot(a[0], a[1]);
        return true;
      }
      ctx.lineJoin = 'round';
      ctx.beginPath();
      let first: XY | null = null;
      let last: XY | null = null;
      for (let k = 0; k < s.v.length; k++) {
        const x = R.X(R.bars[s.i0 + k].time);
        const y = R.Y(s.v[k]);
        if (x === null || y === null) continue;
        if (!first) {
          first = [x, y];
          ctx.moveTo(x, y);
        } else ctx.lineTo(x, y);
        last = [x, y];
      }
      ctx.stroke();
      if (first) R.dot(first[0], first[1]);
      if (last) label(`Anchored VWAP  ${priceWords(s.v[s.v.length - 1])}`, last[0] + 6 * hr, last[1], R.textInk, alpha);
      return true;
    }

    // ── shapes ─────────────────────────────────────────────────────────────
    case 'triangle': {
      const a = pt(d.p1);
      const b = pt(d.p2);
      if (!a || !b) return true;
      const c = pt(d.p3);
      if (!c) {
        line(a, b);
      } else {
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.lineTo(c[0], c[1]);
        ctx.closePath();
        ctx.fillStyle = `rgba(${ink},0.055)`;
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = solid;
        R.dot(c[0], c[1]);
      }
      ctx.fillStyle = solid;
      R.dot(a[0], a[1]);
      R.dot(b[0], b[1]);
      return true;
    }
    case 'circle': {
      const a = pt(d.p1);
      const b = pt(d.p2);
      if (!a || !b) return true;
      ctx.beginPath();
      ctx.arc(a[0], a[1], Math.max(1, Math.hypot(b[0] - a[0], b[1] - a[1])), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${ink},0.055)`;
      ctx.fill();
      ctx.stroke();
      return true;
    }
    case 'rotrect': {
      const a = pt(d.p1);
      const b = pt(d.p2);
      if (!a || !b) return true;
      const c = pt(d.p3);
      if (!c) {
        line(a, b);
      } else {
        const q = rotRectCorners(a, b, c);
        ctx.beginPath();
        ctx.moveTo(q[0][0], q[0][1]);
        for (let i = 1; i < 4; i++) ctx.lineTo(q[i][0], q[i][1]);
        ctx.closePath();
        ctx.fillStyle = `rgba(${ink},0.055)`;
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = solid;
      R.dot(a[0], a[1]);
      R.dot(b[0], b[1]);
      return true;
    }
    case 'polyline': {
      const cs: XY[] = [];
      for (const q of d.pts ?? []) {
        const c = pt(q);
        if (!c) return true;
        cs.push(c);
      }
      if (cs.length < 2) return true;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(cs[0][0], cs[0][1]);
      for (let i = 1; i < cs.length; i++) ctx.lineTo(cs[i][0], cs[i][1]);
      /* in the hand it is an open run with its tail on the pointer; sealed, it closes and takes the wash */
      if (!R.draft && cs.length >= 3) {
        ctx.closePath();
        ctx.fillStyle = `rgba(${ink},0.055)`;
        ctx.fill();
      }
      ctx.stroke();
      return true;
    }
    case 'brush':
    case 'highlighter': {
      const cs: XY[] = [];
      for (const q of d.pts ?? []) {
        const x = R.XE(q.time);
        const y = R.Y(q.price);
        if (x === null || y === null) continue;
        cs.push([x, y]);
      }
      if (cs.length < 2) return true;
      ctx.save();
      ctx.setLineDash([]);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      if (d.kind === 'highlighter') {
        /* a marker pen: wide, see-through, yellow unless the reader chose an ink */
        ctx.strokeStyle = `rgba(${R.inked ? ink : HIGHLIGHT},${0.3 * (alpha / 0.8)})`;
        ctx.lineWidth = (6 + 4 * (d.width ?? 2)) * vr;
      }
      /* through the midpoints, so a fast hand draws a curve rather than a run of corners */
      ctx.beginPath();
      ctx.moveTo(cs[0][0], cs[0][1]);
      for (let i = 1; i < cs.length - 1; i++) ctx.quadraticCurveTo(cs[i][0], cs[i][1], (cs[i][0] + cs[i + 1][0]) / 2, (cs[i][1] + cs[i + 1][1]) / 2);
      ctx.lineTo(cs[cs.length - 1][0], cs[cs.length - 1][1]);
      ctx.stroke();
      ctx.restore();
      return true;
    }
    case 'arrowup':
    case 'arrowdown': {
      const a = pt(d.p1);
      if (!a) return true;
      const up = d.kind === 'arrowup';
      const s = (9 + 3 * (d.width ?? 2)) * vr;
      const dir = up ? 1 : -1;
      /* the stamp sits on the far side of the point and points AT it: an up arrow under a low, a down arrow over a high */
      ctx.save();
      ctx.setLineDash([]);
      ctx.fillStyle = `rgba(${R.inked ? ink : up ? UP : DOWN},${Math.min(1, alpha + 0.15)})`;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1] + dir * 3 * vr);
      ctx.lineTo(a[0] - s * 0.62, a[1] + dir * (3 * vr + s * 0.8));
      ctx.lineTo(a[0] - s * 0.24, a[1] + dir * (3 * vr + s * 0.8));
      ctx.lineTo(a[0] - s * 0.24, a[1] + dir * (3 * vr + s * 1.7));
      ctx.lineTo(a[0] + s * 0.24, a[1] + dir * (3 * vr + s * 1.7));
      ctx.lineTo(a[0] + s * 0.24, a[1] + dir * (3 * vr + s * 0.8));
      ctx.lineTo(a[0] + s * 0.62, a[1] + dir * (3 * vr + s * 0.8));
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      return true;
    }

    // ── words ──────────────────────────────────────────────────────────────
    case 'text': {
      const a = pt(d.p1);
      if (!a) return true;
      const px = R.typePx(d.width);
      ctx.font = R.font(px);
      ctx.textBaseline = 'middle';
      const words = d.text ?? '';
      const tw = ctx.measureText(words).width;
      /* bare words, the way a text mark reads — on the faintest wash, because words over candles are not words */
      R.wash(a[0] - 3 * hr, a[1] - px * 0.85 * vr, tw + 6 * hr, px * 1.7 * vr, 3 * vr, 'rgba(10,10,10,0.55)');
      ctx.fillStyle = `rgba(${R.textInk},${Math.min(1, alpha + 0.15)})`;
      ctx.fillText(words, a[0], a[1]);
      return true;
    }
    case 'callout': {
      const a = pt(d.p1);
      const b = pt(d.p2);
      if (!a || !b) return true;
      const px = R.typePx(d.width);
      ctx.font = R.font(px);
      ctx.textBaseline = 'middle';
      const words = d.text ?? '…';
      const tw = ctx.measureText(words).width;
      const bw = tw + 14 * hr;
      const bh = px * 2 * vr;
      ctx.save();
      ctx.setLineDash([]);
      ctx.lineWidth = 1 * vr;
      line(a, b);
      ctx.restore();
      R.wash(b[0] - bw / 2, b[1] - bh / 2, bw, bh, 5 * vr, 'rgba(10,10,10,0.88)', `rgba(${ink},0.55)`);
      ctx.fillStyle = `rgba(${R.textInk},${Math.min(1, alpha + 0.15)})`;
      ctx.fillText(words, b[0] - tw / 2, b[1]);
      ctx.fillStyle = solid;
      R.dot(a[0], a[1]);
      return true;
    }
    case 'pricelabel': {
      const a = pt(d.p1);
      if (!a) return true;
      const px = R.typePx(d.width);
      ctx.save();
      ctx.setLineDash([]);
      ctx.lineWidth = 1 * vr;
      line(a, [a[0] + 12 * hr, a[1] - 12 * vr]);
      ctx.restore();
      label(priceWords(d.p1.price), a[0] + 12 * hr, a[1] - 12 * vr - px * 0.85 * vr, R.textInk, Math.min(1, alpha + 0.15), px, `rgba(${ink},0.55)`);
      ctx.fillStyle = solid;
      R.dot(a[0], a[1]);
      return true;
    }
    default:
      return false;
  }
}

/** The handles a selected mark wears when they are NOT simply its stored anchors. Bitmap px; null = the stored anchors. */
export function handlePoints(d: Drawing, R: KindRender): XY[] | null {
  if (d.kind === 'brush' || d.kind === 'highlighter') return [];
  if (d.kind === 'avwap') {
    const s = avwapSeries(R.bars, R.barsRev, d.p1.time);
    if (!s || !s.v.length) return null;
    const x = R.X(R.bars[s.i0].time);
    const y = R.Y(s.v[0]);
    return x === null || y === null ? [] : [[x, y]];
  }
  return null;
}

// ---- HIT ---------------------------------------------------------------------------------

/** Is the pointer on `d`'s body? null: not one of these kinds. Anchors are the primitive's to test. */
export function hitKind(d: Drawing, H: KindHit): boolean | null {
  const { x, y, BODY, AXIS, distSeg } = H;
  const near = (a: XY, b: XY, tol = BODY) => distSeg(a[0], a[1], b[0], b[1]) <= tol;
  const a = H.P(d.p1);
  const b = H.P(d.p2);
  const c = H.P(d.p3);

  switch (d.kind) {
    case 'ray':
      return !!a && !!b && near(a, rayEnd(a, b, H.w));
    case 'hray':
      return !!a && x >= a[0] - AXIS && Math.abs(y - a[1]) <= AXIS;
    case 'cross':
      return !!a && (Math.abs(y - a[1]) <= AXIS || Math.abs(x - a[0]) <= AXIS);
    case 'fibext': {
      if (!a || !b || !d.p2) return false;
      if (near(a, b) || (c && near(b, c))) return true;
      if (!c || !d.p3) return false;
      const [xa, xb] = fibExtSpan([a[0], b[0], c[0]]);
      const leg = d.p2.price - d.p1.price;
      for (const r of FIBEXT_RATIOS) {
        const py = H.Y(d.p3.price + leg * r);
        if (py !== null && x >= xa - BODY && x <= xb + BODY && Math.abs(y - py) <= BODY) return true;
      }
      return false;
    }
    case 'fibchannel': {
      if (!a || !b) return false;
      const e0 = rayEnd(a, b, H.w);
      if (!c) return near(a, e0);
      const baseY = b[0] !== a[0] ? a[1] + ((b[1] - a[1]) / (b[0] - a[0])) * (c[0] - a[0]) : a[1];
      const off = c[1] - baseY;
      return FIBCHANNEL_RATIOS.some(r => near([a[0], a[1] + off * r], [e0[0], e0[1] + off * r]));
    }
    case 'long':
    case 'short': {
      if (!a || !b || !d.p2) return false;
      const yS = H.Y(d.p3 ? d.p3.price : defaultStop(d.p1.price, d.p2.price));
      if (yS === null) return false;
      const xa = Math.min(a[0], b[0]);
      const xb = Math.max(Math.max(a[0], b[0]), xa + 24);
      /* the inside is the shape too — the box's own ruling */
      return x >= xa && x <= xb && y >= Math.min(a[1], b[1], yS) && y <= Math.max(a[1], b[1], yS);
    }
    case 'prange': {
      if (!a || !b) return false;
      const xa = Math.min(a[0], b[0]);
      const xb = Math.max(Math.max(a[0], b[0]), xa + 30);
      const mx = (xa + xb) / 2;
      return near([xa, a[1]], [xb, a[1]]) || near([xa, b[1]], [xb, b[1]]) || near([mx, a[1]], [mx, b[1]]);
    }
    case 'drange': {
      if (!a || !b) return false;
      const xa = Math.min(a[0], b[0]);
      const xb = Math.max(a[0], b[0]);
      let ya = Math.min(a[1], b[1]);
      let yb = Math.max(a[1], b[1]);
      if (yb - ya < 28) {
        const mid = (ya + yb) / 2;
        ya = mid - 14;
        yb = mid + 14;
      }
      const my = (ya + yb) / 2;
      return near([xa, ya], [xa, yb]) || near([xb, ya], [xb, yb]) || near([xa, my], [xb, my]);
    }
    case 'avwap': {
      const s = avwapSeries(H.bars, H.barsRev, d.p1.time);
      if (!s) return false;
      let prev: XY | null = null;
      for (let k = 0; k < s.v.length; k++) {
        const px = H.X(H.bars[s.i0 + k].time);
        const py = H.Y(s.v[k]);
        if (px === null || py === null) continue;
        const cur: XY = [px, py];
        if (k === 0 && Math.hypot(x - px, y - py) <= 7) return true;
        if (prev && near(prev, cur)) return true;
        prev = cur;
      }
      return false;
    }
    case 'triangle': {
      if (!a || !b) return false;
      if (!c) return near(a, b);
      return inPoly(x, y, [a, b, c]) || near(a, b) || near(b, c) || near(c, a);
    }
    case 'circle': {
      if (!a || !b) return false;
      const r = Math.hypot(b[0] - a[0], b[1] - a[1]);
      return Math.hypot(x - a[0], y - a[1]) <= r + BODY;
    }
    case 'rotrect': {
      if (!a || !b) return false;
      if (!c) return near(a, b);
      const q = rotRectCorners(a, b, c);
      return inPoly(x, y, q) || q.some((p, i) => near(p, q[(i + 1) % 4]));
    }
    case 'polyline': {
      const cs = (d.pts ?? []).map(q => H.P(q)).filter((q): q is XY => !!q);
      if (cs.length < 2) return false;
      if (cs.length >= 3 && inPoly(x, y, cs)) return true;
      return cs.some((p, i) => near(p, cs[(i + 1) % cs.length]));
    }
    case 'brush':
    case 'highlighter': {
      const cs = (d.pts ?? []).map(q => H.PE(q)).filter((q): q is XY => !!q);
      const tol = d.kind === 'highlighter' ? 3 + 2 * (d.width ?? 2) + BODY : BODY + 1;
      for (let i = 1; i < cs.length; i++) if (near(cs[i - 1], cs[i], tol)) return true;
      return false;
    }
    case 'arrowup':
    case 'arrowdown': {
      if (!a) return false;
      const s = 9 + 3 * (d.width ?? 2);
      const dir = d.kind === 'arrowup' ? 1 : -1;
      const y0 = a[1] + dir * 3;
      const y1 = a[1] + dir * (3 + s * 1.7);
      return Math.abs(x - a[0]) <= s * 0.7 && y >= Math.min(y0, y1) - 2 && y <= Math.max(y0, y1) + 2;
    }
    case 'text': {
      if (!a) return false;
      const box = wordsBox(d.text ?? '', H.typePx(d.width));
      return x >= a[0] - 4 && x <= a[0] + box.w && Math.abs(y - a[1]) <= box.h / 2 + 2;
    }
    case 'callout': {
      if (!a || !b) return false;
      const box = wordsBox(d.text ?? '…', H.typePx(d.width));
      return near(a, b) || (Math.abs(x - b[0]) <= box.w / 2 + 2 && Math.abs(y - b[1]) <= box.h / 2 + 3);
    }
    case 'pricelabel': {
      if (!a) return false;
      const px = H.typePx(d.width);
      const box = wordsBox(priceWords(d.p1.price), px);
      const by = a[1] - 12 - px * 0.85;
      return near(a, [a[0] + 12, a[1] - 12]) || (x >= a[0] + 10 && x <= a[0] + 14 + box.w && Math.abs(y - by) <= box.h / 2 + 2);
    }
    default:
      return null;
  }
}
