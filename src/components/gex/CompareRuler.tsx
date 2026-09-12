/*
==================================================
  SLAYER TERMINAL - ONE RULER LANE
  (components/gex/CompareRuler.tsx)

  The drawing at the heart of "The two books on one
  ruler" (2026-09-09, split out of CompareAxis so it
  can stand five wide): two names' hedging in ONE
  greek, on distance from each name's own spot, the
  first growing left, the second right; the window
  slides — a wheel or a pull sets a target the frame
  eases toward, capsules slide in under a clip at
  full length — and a read line under the canvas
  speaks the strike in hand. The box owns the head,
  the controls and the reach sums; five lanes share
  one window (one `want`), so a scroll on any moves
  them all together.

  THE NODE CARD (Noah, 2026-09-09, fullscreen: "make
  the specific nodes a translucent card on click not
  hover"): a click on a capsule keeps the strike and
  opens a translucent card beside it — that strike
  in all five greeks against the other name's
  nearest strike at the same distance, the lane's
  greek lit. The card rides the window: the frame
  loop places it on the capsule's row each frame,
  and hides it when the row slides out. The box
  owns which card is open (one across five lanes)
  and closes it on a click anywhere or Esc; inside
  the drawing the lane judges the click — empty
  space closes, another capsule moves the card, the
  same capsule again closes it and lets the strike
  go, a pull keeps it. The hover read line stays.
==================================================
*/

import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { X } from 'lucide-react';
import { fmtDollars } from '../../data/ahead';
import { GREEK_LABEL, GREEK_WORDS, distanceIn, sharedUnit, type Compare, type CompareSide, type Greek, type Reach } from '../../data/compare';
import { GREEKS } from '../../data/exposureSurface';
import type { DistanceUnit } from '../../data/atr';
import { CALL_WALL, FLIP, PUT_WALL, SUPREME } from './palette';
import { HEAT_MODE, heatCellStyle, type HeatMode } from './heatmap';
import { AXIS_COL_W, AXIS_READ_H } from './compareSkeletons';

const SILVER = '#C7D3E8';
const INK = '#ededed';
const INK_2 = '#a3a3a3';
const INK_3 = '#7d7d7d';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const SANS = '-apple-system, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
export const PAD = 14;

const fmtStrike = (v: number) => (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2));
const near = (x: number, y: number) => Math.abs(x - y) < 1e-9;
const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};
/* The capsules' ramp — the thermal by default, the house ramp when the head's
   Colours card says so (Noah, 2026-09-10: the ruler was missing "the house
   color vs thermal color button") */
const thermal = (value: number, maxAbs: number, mode: HeatMode = 'thermal-yellow') => {
  const s = heatCellStyle(value, maxAbs, mode);
  return { fill: String(s.backgroundColor ?? '#FFFFBF'), ink: String(s.color ?? '#0a0a0a') };
};

export type Unit = Exclude<DistanceUnit, '$'>;
export type SideKey = 'a' | 'b';

export interface RulerRow {
  strike: number;
  value: number;
  /** Distance from spot on the ruler */
  d: number;
}
interface PlacedRow extends RulerRow {
  y: number;
}
export interface SideLayout {
  side: CompareSide;
  /** Every strike of the book on the ruler, ascending — the frame decides which are in view */
  rows: RulerRow[];
  /** The smallest gap between neighbouring strikes on the ruler */
  minGap: number;
  flipD: number | null;
  /** The heaviest strike in the chosen greek — the supreme the Map's follows */
  supreme: number;
}
export interface Layout {
  U: Unit;
  R: number;
  /** How far either book runs from spot — the window cannot leave it */
  maxD: number;
  step: number;
  a: SideLayout;
  b: SideLayout;
}

/** A tick every "nice" step, at most four each side */
const stepFor = (R: number, U: Unit) => {
  const steps = U === '%' ? [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10, 20] : [0.25, 0.5, 1, 2, 5];
  return steps.find(s => R / s <= 4.5) ?? steps[steps.length - 1];
};
export const tickWords = (d: number, U: Unit) => {
  if (near(d, 0)) return 'spot';
  const sign = d < 0 ? '−' : '+';
  const a = Math.abs(d);
  const digits = a >= 10 ? 0 : a >= 1 ? 1 : 2;
  return U === '%' ? `${sign}${a.toFixed(digits)}%` : U === 'ATR' ? `${sign}${a.toFixed(digits)} ATR` : `${sign}${a.toFixed(digits)}σ`;
};
export const rulerWords = (U: Unit) => (U === '%' ? "percent from each name's own spot" : U === 'ATR' ? "ATRs from each name's own spot" : "expected moves from each name's own spot");
const REACH_MOVES: Record<Reach, number | null> = { one: 1, two: 2, three: 3, all: null };
/** The capsule's height for a pitch of pixels between neighbouring strikes —
    NEVER UNDER 11, the Map's profile panel's own floor (Noah, 2026-09-10: "unlike
    the map page they dont even show inside of the capsules"): a capsule is
    there to carry its figure, so a dense ladder (NVDA's 50-cent strikes at three
    expected moves) packs the capsules to touching rather than thinning them
    past what an 8px figure needs. The first cut let the pitch take them to 4px
    and every capsule on a tight pair stood empty. */
export const barHFor = (pitch: number) => Math.max(11, Math.min(22, Math.round(pitch * 0.72)));

/** The ruler and both books on it, in the chosen greek — pure; where the window sits and how tall it is are the frame's business */
export function layout(cmp: Compare, unit: DistanceUnit, reach: Reach, greek: Greek): Layout {
  let U = sharedUnit(unit);
  if (U === 'ATR' && !(cmp.a.scales.atr && cmp.b.scales.atr)) U = '%';
  const dOf = (s: CompareSide, strike: number) => distanceIn(strike - s.spot, s.spot, U, s.scales);
  /* The ruler's reach: so many of the day's expected moves each way, for both,
     and never fewer than the four nearest strikes each way of either — or
     everything, when the card says so */
  const moves = REACH_MOVES[reach];
  let R = 0;
  let maxD = 0;
  for (const s of [cmp.a, cmp.b]) {
    const ds = s.rows[greek].map(r => dOf(s, r.strike)).filter((d): d is number => d != null && Number.isFinite(d));
    for (const d of ds) maxD = Math.max(maxD, Math.abs(d));
    if (moves == null) {
      for (const d of ds) R = Math.max(R, Math.abs(d));
      continue;
    }
    const oneMove = U === '%' ? (s.sigmaDay / s.spot) * 100 : U === 'σ' ? 1 : s.sigmaDay / (s.scales.atr ?? s.sigmaDay);
    R = Math.max(R, moves * oneMove);
    const up = ds.filter(d => d > 0).sort((x, y) => x - y);
    const down = ds.filter(d => d < 0).sort((x, y) => y - x);
    R = Math.max(R, Math.abs(up[Math.min(3, up.length - 1)] ?? 0), Math.abs(down[Math.min(3, down.length - 1)] ?? 0));
  }
  if (!(R > 0)) R = 1;
  const step = stepFor(R, U);
  const place = (s: CompareSide): SideLayout => {
    const rows: RulerRow[] = [];
    let minGap = Infinity;
    let prev: number | null = null;
    for (const r of s.rows[greek]) {
      const d = dOf(s, r.strike);
      if (d == null || !Number.isFinite(d)) continue;
      if (prev != null) minGap = Math.min(minGap, Math.abs(d - prev));
      prev = d;
      rows.push({ strike: r.strike, value: r.value, d });
    }
    const fd = s.flip != null ? dOf(s, s.flip) : null;
    return { side: s, rows, minGap: Number.isFinite(minGap) ? minGap : R / 10, flipD: fd != null && Number.isFinite(fd) ? fd : null, supreme: s.supreme[greek].strike };
  };
  return { U, R, maxD, step, a: place(cmp.a), b: place(cmp.b) };
}

/** What sits in view at a window's centre, and the scale each side takes there */
export function inView(L: Layout, offset: number) {
  const on = (S: SideLayout) => S.rows.filter(r => Math.abs(r.d - offset) <= L.R);
  const scale = (rows: RulerRow[], S: SideLayout, greek: Greek) => {
    let m = 0;
    for (const r of rows) m = Math.max(m, Math.abs(r.value));
    return m || S.side.heaviest[greek] || 1;
  };
  const a = on(L.a);
  const b = on(L.b);
  return { a, b, scale: (greek: Greek) => ({ a: scale(a, L.a, greek), b: scale(b, L.b, greek) }), off: { a: L.a.rows.length - a.length, b: L.b.rows.length - b.length } };
}

interface Hover {
  side: SideKey;
  strike: number;
}

/** The card open on a capsule — which lane, which side, which strike, and where along the lane it was clicked */
export interface NodeCard {
  lane: Greek;
  side: SideKey;
  strike: number;
  x: number;
}
const CARD_W = 300;

const roleOf = (L: SideLayout, k: number) => (near(k, L.side.levels.callWall) ? 'call wall' : near(k, L.side.levels.putWall) ? 'put wall' : near(k, L.supreme) ? 'supreme' : null);
const valueOf = (s: CompareSide, g: Greek, strike: number) => s.rows[g].find(r => near(r.strike, strike))?.value ?? null;

export interface RulerLaneProps {
  cmp: Compare;
  unit: DistanceUnit;
  reach: Reach;
  greek: Greek;
  /** The window's target along the ruler, shared by every lane on the box */
  want: number;
  onWant: (next: number | ((w: number) => number)) => void;
  focusA: number | null;
  focusB: number | null;
  onPick: (strike: number, ticker: string) => void;
  /** A fixed drawing height; omitted, the lane fills its parent */
  height?: number;
  /** One of five side by side: the greek named over the lane, the read kept short */
  compact?: boolean;
  /** The capsules' ramp: the thermal try, or the house ember/glacier */
  palette?: 'house' | 'thermal';
  /** The card open across the box, if any — this lane draws it when it is its own */
  card?: NodeCard | null;
  /** Given, a click opens the node card (fullscreen); absent, a click only keeps the strike */
  onCard?: (card: NodeCard | null) => void;
}

const RulerLane = ({ cmp, unit, reach, greek, want, onWant, focusA, focusB, onPick, height, compact = false, card = null, onCard, palette = 'thermal' }: RulerLaneProps) => {
  const heat: HeatMode = palette === 'house' ? HEAT_MODE : 'thermal-yellow';
  const heatRef = useRef(heat);
  heatRef.current = heat;
  const cards = !!onCard;
  const myCard = card && card.lane === greek ? card : null;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const words = GREEK_WORDS[greek];
  const lay = useMemo(() => layout(cmp, unit, reach, greek), [cmp, unit, reach, greek]);
  const layRef = useRef(lay);
  layRef.current = lay;
  const limit = Math.max(0, lay.maxD - lay.R);
  const scrollable = lay.maxD > lay.R;
  const clampWant = (w: number) => Math.max(-limit, Math.min(limit, w));
  const target = clampWant(want);
  const wantRef = useRef(0);
  wantRef.current = target;

  /* The wheel — native and non-passive, so the page does not scroll under it
     while there is something off the ruler to reach */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onWheel = (e: WheelEvent) => {
      const L = layRef.current;
      if (L.maxD <= L.R) return;
      e.preventDefault();
      const H = root.clientHeight || 1;
      /* Half a pixel of ruler per pixel of wheel — one notch moves a quarter of the window */
      const per = (2 * L.R) / (H - 2 * PAD) / 2;
      const lim = Math.max(0, L.maxD - L.R);
      onWant(w => Math.max(-lim, Math.min(lim, w - e.deltaY * per)));
    };
    root.addEventListener('wheel', onWheel, { passive: false });
    return () => root.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* THE DRAG — press and pull the drawing, one to one; a pull is not a click */
  const dragRef = useRef<{ y: number; want: number; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);
  const suppressClick = useRef(false);

  const [hover, setHover] = useState<Hover | null>(null);
  const hoverRef = useRef<Hover | null>(null);
  hoverRef.current = hover;
  const focusRef = useRef({ a: focusA, b: focusB });
  focusRef.current = { a: focusA, b: focusB };
  const placedRef = useRef<{ a: PlacedRow[]; b: PlacedRow[] }>({ a: [], b: [] });
  const onMaxRef = useRef({ a: 1, b: 1 });
  const cardRef = useRef<HTMLDivElement | null>(null);
  const cardStateRef = useRef<NodeCard | null>(null);
  cardStateRef.current = myCard;
  /* Where the "▲ spot" word was last drawn (null while spot is on the ruler), and whether the pointer is on it */
  const spotWordRef = useRef<{ x: number; y: number } | null>(null);
  const overSpotRef = useRef(false);
  const [overSpot, setOverSpot] = useState(false);
  overSpotRef.current = overSpot;
  const greekRef = useRef(greek);
  greekRef.current = greek;
  const dataRev = useRef(0);
  useEffect(() => {
    dataRev.current++;
  }, [lay, focusA, focusB, heat]);
  const animRef = useRef(new Map<string, number>());
  const offRef = useRef(0);
  const lastTs = useRef(0);
  const settledRef = useRef(true);

  useEffect(() => {
    let raf = 0;
    let lastKey = '';
    const draw = (ts: number) => {
      raf = requestAnimationFrame(draw);
      const root = rootRef.current;
      const canvas = canvasRef.current;
      if (!root || !canvas) return;
      const W = root.clientWidth;
      const H = root.clientHeight;
      if (W < 120 || H < 80) return;
      const hv = hoverRef.current;
      const cs = cardStateRef.current;
      const key = `${W}|${H}|${hv?.side ?? ''}${hv?.strike ?? ''}|${dataRev.current}|${wantRef.current.toFixed(4)}|${cs ? `${cs.side}${cs.strike}@${cs.x}` : ''}|${overSpotRef.current ? 's' : ''}`;
      if (key === lastKey && settledRef.current) return;
      lastKey = key;
      const dt = lastTs.current ? Math.min(64, ts - lastTs.current) : 16;
      lastTs.current = ts;
      const k = 1 - Math.exp(-dt / 110);
      const anim = animRef.current;
      const touched = new Set<string>();
      let settled = true;

      const L = layRef.current;
      /* THE OFFSET EASES toward its target — a wheel notch or a pull lands as a glide */
      const goal = wantRef.current;
      const kOff = 1 - Math.exp(-dt / 70);
      let off = offRef.current + (goal - offRef.current) * kOff;
      const moving = Math.abs(goal - off) > L.R * 0.0005;
      if (!moving) off = goal;
      else settled = false;
      offRef.current = off;
      root.dataset.drawn = off.toFixed(4);

      const ease = (id: string, target: number, from: number) => {
        let v = anim.get(id);
        if (v == null) {
          /* A capsule entering because the window slid comes in at its full
             length; one entering because the data changed grows from a dot */
          v = moving ? target : from;
          anim.set(id, v);
        }
        touched.add(id);
        v += (target - v) * k;
        if (Math.abs(target - v) > 0.25) settled = false;
        else v = target;
        anim.set(id, v);
        return v;
      };

      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        canvas.style.width = `${W}px`;
        canvas.style.height = `${H}px`;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      const colW = compact ? Math.min(AXIS_COL_W, Math.max(52, W * 0.14)) : AXIS_COL_W;
      const cx = W / 2;
      const colL = cx - colW / 2;
      const colR = cx + colW / 2;
      const laneA = { from: colL - 4, to: 6 }; // grows left
      const laneB = { from: colR + 4, to: W - 6 }; // grows right
      const span = Math.max(1, laneA.from - laneA.to - 10);
      const yOf = (d: number) => PAD + ((off + L.R - d) / (2 * L.R)) * (H - 2 * PAD);
      /* ONE CAPSULE HEIGHT FOR BOTH SIDES, the smaller, from the drawing's own height */
      const pitchOf = (S: SideLayout) => (S.minGap / (2 * L.R)) * (H - 2 * PAD);
      const barH = Math.min(barHFor(pitchOf(L.a)), barHFor(pitchOf(L.b)));
      rootRef.current?.setAttribute('data-bar-h', String(barH));

      /* WHAT IS IN VIEW this frame — a little beyond the edges, so a capsule
         slides in under the clip instead of appearing whole */
      const reach = L.R + (barH / (H - 2 * PAD)) * 2 * L.R;
      const view = (S: SideLayout) => S.rows.filter(r => Math.abs(r.d - off) <= reach).map(r => ({ ...r, y: yOf(r.d) }));
      const placedA = view(L.a);
      const placedB = view(L.b);
      placedRef.current = { a: placedA, b: placedB };
      const counts = (S: SideLayout) => ({ up: S.rows.filter(r => r.d > off + L.R).length, down: S.rows.filter(r => r.d < off - L.R).length });
      const onMaxOf = (rows: PlacedRow[], S: SideLayout) => {
        let m = 0;
        for (const p of rows) if (Math.abs(p.d - off) <= L.R) m = Math.max(m, Math.abs(p.value));
        return m || S.side.heaviest[greekRef.current] || 1;
      };
      const onMaxA = onMaxOf(placedA, L.a);
      const onMaxB = onMaxOf(placedB, L.b);
      onMaxRef.current = { a: onMaxA, b: onMaxB };

      /* The hover wash, under everything */
      if (hv) {
        const rows = hv.side === 'a' ? placedA : placedB;
        const row = rows.find(p => near(p.strike, hv.strike));
        if (row) {
          ctx.fillStyle = 'rgba(255,255,255,0.04)';
          const pitch = Math.max(barH + 4, 12);
          if (hv.side === 'a') ctx.fillRect(0, row.y - pitch / 2, colL, pitch);
          else ctx.fillRect(colR, row.y - pitch / 2, W - colR, pitch);
        }
      }

      /* The column's ground and its edges */
      ctx.fillStyle = 'rgba(255,255,255,0.025)';
      ctx.fillRect(colL, 0, colW, H);
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(colL + 0.5, 0);
      ctx.lineTo(colL + 0.5, H);
      ctx.moveTo(colR - 0.5, 0);
      ctx.lineTo(colR - 0.5, H);
      ctx.stroke();

      /* Everything that slides is drawn inside the window's band */
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, PAD - 1, W, H - 2 * PAD + 2);
      ctx.clip();

      /* The ruler's ticks: a gridline across both lanes, the distance in the column */
      const ticks: number[] = [];
      for (let d = Math.ceil((off - reach) / L.step) * L.step; d <= off + reach + 1e-9; d += L.step) ticks.push(Math.abs(d) < 1e-9 ? 0 : Number(d.toFixed(6)));
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.beginPath();
      for (const d of ticks) {
        const yy = Math.round(yOf(d)) + 0.5;
        ctx.moveTo(6, yy);
        ctx.lineTo(colL - 2, yy);
        ctx.moveTo(colR + 2, yy);
        ctx.lineTo(W - 6, yy);
      }
      ctx.stroke();
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      for (const d of ticks) {
        if (near(d, 0)) continue;
        ctx.font = `${compact ? 9 : 10}px ${MONO}`;
        ctx.fillStyle = INK_2;
        ctx.fillText(tickWords(d, L.U), cx, yOf(d));
      }
      /* Spot: a rule across both lanes, a solid chip in the column */
      if (Math.abs(off) <= reach) {
        const y0 = Math.round(yOf(0)) + 0.5;
        ctx.strokeStyle = 'rgba(237,237,237,0.3)';
        ctx.beginPath();
        ctx.moveTo(0, y0);
        ctx.lineTo(W, y0);
        ctx.stroke();
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.roundRect(colL + 4, y0 - 8, colW - 8, 16, 4);
        ctx.fill();
        ctx.fillStyle = '#0a0a0a';
        ctx.font = `700 ${compact ? 9 : 10}px ${MONO}`;
        ctx.fillText('spot', cx, y0 + 0.5);
      }

      const capsule = (x: number, yMid: number, len: number, h: number, fill: string, ring: string | null) => {
        const y = Math.round(yMid - h / 2);
        const rad = Math.min(h / 2, len / 2);
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.roundRect(x, y, len, h, rad);
        ctx.fill();
        if (ring) {
          ctx.strokeStyle = ring;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(x - 0.5, y - 0.5, len + 1, h + 1, rad + 0.5);
          ctx.stroke();
        }
      };
      const textW = (t: string, font: string) => {
        ctx.font = font;
        return ctx.measureText(t).width;
      };
      const NAME = `500 9px ${SANS}`;
      const CHIP = `500 10px ${SANS}`;
      const chipOf = (words: string) => Math.ceil(textW(words, CHIP)) + 12;

      const drawSide = (S: SideLayout, placed: PlacedRow[], onMax: number, side: SideKey) => {
        const left = side === 'a';
        const s = S.side;
        const focus = side === 'a' ? focusRef.current.a : focusRef.current.b;
        /* Thin rows still print their figure, one point smaller (2026-09-09);
           the capsule is never under 11px now (barHFor), so a figure always
           has the height — only the length can refuse it */
        const canPrint = barH >= 11;
        const FIG = `600 ${barH >= 13 ? 9 : 8}px ${MONO}`;
        /* A name goes INSIDE a capsule that reaches the edge from 10px of row,
           one point smaller under 13 — never a chip over the figure (Noah, 2026-09-09) */
        const NAME_IN = barH >= 13 ? NAME : `500 8px ${SANS}`;
        const levelOf = new Map<number, { words: string; c: string }>();
        levelOf.set(s.levels.callWall, { words: 'Call wall', c: CALL_WALL });
        levelOf.set(s.levels.putWall, { words: 'Put wall', c: PUT_WALL });
        /* The supreme is the chosen greek's heaviest strike — the Map's rule */
        if (!near(S.supreme, s.levels.callWall) && !near(S.supreme, s.levels.putWall)) levelOf.set(S.supreme, { words: 'Supreme', c: SUPREME });
        const levelAt = (kk: number) => {
          for (const [lk, v] of levelOf) if (near(lk, kk)) return v;
          return undefined;
        };
        const chipsLater: { words: string; c: string; x: number; y: number; w: number }[] = [];

        for (const p of placed) {
          if (p.value === 0) continue;
          const target = Math.max(barH, (Math.abs(p.value) / onMax) * span);
          const len = ease(`${side}:${p.strike}`, target, barH);
          const x = left ? laneA.from - len : laneB.from;
          const t = thermal(p.value, onMax, heatRef.current);
          const isFocus = focus != null && near(focus, p.strike);
          const isHover = hv != null && hv.side === side && near(hv.strike, p.strike);
          capsule(x, p.y, len, barH, t.fill, isFocus ? SILVER : isHover ? rgba(SILVER, 0.6) : null);
          const fig = fmtDollars(Math.abs(p.value));
          const lvl = levelAt(p.strike);
          const outerX = left ? x + 6 : x + len - 6;
          const innerX = left ? x + len - 6 : x + 6;
          const outerAlign: CanvasTextAlign = left ? 'left' : 'right';
          const innerAlign: CanvasTextAlign = left ? 'right' : 'left';
          const chipW = lvl ? chipOf(lvl.words) : 0;
          const roomBeside = lvl ? (left ? x - 8 - chipW >= 6 : x + len + 8 + chipW <= W - 6) : false;
          if (lvl && !roomBeside) {
            if (barH >= 10 && textW(lvl.words, NAME_IN) + 12 <= len) {
              ctx.font = NAME_IN;
              ctx.fillStyle = t.ink;
              ctx.textAlign = outerAlign;
              ctx.fillText(lvl.words, outerX, p.y + 0.5);
              if (canPrint && textW(lvl.words, NAME_IN) + textW(fig, FIG) + 20 <= len) {
                ctx.font = FIG;
                ctx.textAlign = innerAlign;
                ctx.fillText(fig, innerX, p.y + 0.5);
              }
            } else {
              chipsLater.push({ words: lvl.words, c: lvl.c, x: left ? Math.max(6, x) : Math.min(W - 6 - chipW, x + len - chipW), y: p.y, w: chipW });
            }
          } else {
            if (canPrint && textW(fig, FIG) + 12 <= len) {
              ctx.font = FIG;
              ctx.fillStyle = t.ink;
              ctx.textAlign = outerAlign;
              ctx.fillText(fig, outerX, p.y + 0.5);
            }
            if (lvl) chipsLater.push({ words: lvl.words, c: lvl.c, x: left ? x - 8 - chipW : x + len + 8, y: p.y, w: chipW });
          }
        }

        /* The flip, dashed across this lane and named as a chip at the lane's outer edge */
        if (S.flipD != null && s.flip != null && Math.abs(S.flipD - off) <= reach) {
          const fy = yOf(S.flipD);
          const yy = Math.round(fy) + 0.5;
          ctx.save();
          ctx.setLineDash([3, 3]);
          ctx.strokeStyle = rgba(FLIP, 0.7);
          ctx.beginPath();
          if (left) {
            ctx.moveTo(6, yy);
            ctx.lineTo(colL - 2, yy);
          } else {
            ctx.moveTo(colR + 2, yy);
            ctx.lineTo(W - 6, yy);
          }
          ctx.stroke();
          ctx.restore();
          if (!compact) {
            const words = `flip ${fmtStrike(s.flip)}`;
            const w = chipOf(words);
            chipsLater.push({ words, c: FLIP, x: left ? 6 : W - 6 - w, y: fy, w });
          }
        }

        /* The chips — the walls beside their capsules' ends, the flip at the edge */
        for (const c of chipsLater) {
          const y = Math.round(c.y - 8) + 0.5;
          ctx.fillStyle = '#0a0a0a';
          ctx.beginPath();
          ctx.roundRect(c.x, y, c.w, 16, 8);
          ctx.fill();
          ctx.fillStyle = rgba(c.c, 0.14);
          ctx.fill();
          ctx.strokeStyle = rgba(c.c, 0.5);
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillStyle = c.c;
          ctx.font = CHIP;
          ctx.textAlign = 'center';
          ctx.fillText(c.words, c.x + c.w / 2, c.y + 0.5);
        }
      };
      drawSide(L.a, placedA, onMaxA, 'a');
      drawSide(L.b, placedB, onMaxB, 'b');
      ctx.restore();

      /* THE CARD RIDES ITS CAPSULE — placed on the row each frame, beside the
         click, kept inside the drawing; gone while the row is off the window */
      const cel = cardRef.current;
      if (cs && cel) {
        const row = (cs.side === 'a' ? placedA : placedB).find(p => near(p.strike, cs.strike));
        if (row && Math.abs(row.d - off) <= L.R) {
          const cw = cel.offsetWidth || CARD_W;
          const ch = cel.offsetHeight || 200;
          const left = cs.x + 14 + cw <= W - 6 ? cs.x + 14 : Math.max(6, cs.x - 14 - cw);
          const top = Math.max(PAD, Math.min(H - PAD - ch, row.y - ch / 2));
          cel.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
          cel.style.opacity = '1';
          cel.style.pointerEvents = 'auto';
        } else {
          cel.style.opacity = '0';
          cel.style.pointerEvents = 'none';
        }
      }

      /* Off the ruler, counted, in the margins — and the way back to spot when it has slid out */
      ctx.font = `9px ${MONO}`;
      ctx.fillStyle = INK_3;
      ctx.textBaseline = 'middle';
      for (const [S, left] of [[L.a, true], [L.b, false]] as [SideLayout, boolean][]) {
        const c = counts(S);
        ctx.textAlign = left ? 'right' : 'left';
        const cxx = left ? colL - 6 : colR + 6;
        if (c.up) ctx.fillText(`▲ ${c.up}`, cxx, PAD - 4);
        if (c.down) ctx.fillText(`▼ ${c.down}`, cxx, H - PAD + 4);
      }
      /* THE WAY BACK: the pointer word is a button — lit under the pointer, a
         click glides the window home (Noah, 2026-09-09) */
      if (Math.abs(off) > reach) {
        const wy = off > 0 ? H - PAD + 4 : PAD - 4;
        spotWordRef.current = { x: cx, y: wy };
        ctx.fillStyle = overSpotRef.current ? INK : INK_2;
        ctx.font = `700 9px ${MONO}`;
        ctx.textAlign = 'center';
        ctx.fillText(off > 0 ? '▼ spot' : '▲ spot', cx, wy);
      } else spotWordRef.current = null;

      /* Capsules whose strike left the ruler shrink away rather than vanish */
      for (const [id, v] of anim) {
        if (touched.has(id)) continue;
        if (v <= 1) {
          anim.delete(id);
          continue;
        }
        anim.set(id, v * (1 - k));
        settled = false;
      }
      settledRef.current = settled;
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Redraw on a resize — the loop keys on the size it reads */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const ro = new ResizeObserver(() => {
      dataRev.current++;
    });
    ro.observe(root);
    return () => ro.disconnect();
  }, []);

  /* THE POINTER — a pull moves the window; otherwise which side, then the nearest strike by height on it */
  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !scrollable) return;
    dragRef.current = { y: e.clientY, want: wantRef.current, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const onUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    dragRef.current = null;
    setDragging(false);
    if (d?.moved) suppressClick.current = true;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const root = rootRef.current;
    if (!root) return;
    /* Over the card the pointer is the card's, not the ruler's */
    if ((e.target as Element | null)?.closest?.('[data-node-card]')) {
      if (hoverRef.current) setHover(null);
      return;
    }
    const d = dragRef.current;
    if (d) {
      const dy = e.clientY - d.y;
      if (Math.abs(dy) > 3) d.moved = true;
      if (d.moved) {
        const H = root.clientHeight || 1;
        onWant(clampWant(d.want + dy * ((2 * lay.R) / (H - 2 * PAD))));
        if (hoverRef.current) setHover(null);
      }
      return;
    }
    const r = root.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    /* On the way-back word: a button, not a strike */
    const sw = spotWordRef.current;
    const onWord = !!sw && Math.abs(x - sw.x) <= 24 && Math.abs(y - sw.y) <= 8;
    if (onWord !== overSpotRef.current) setOverSpot(onWord);
    if (onWord) {
      if (hoverRef.current) setHover(null);
      return;
    }
    const side: SideKey = x < r.width / 2 ? 'a' : 'b';
    const rows = placedRef.current[side];
    let best: PlacedRow | null = null;
    let bestD = Infinity;
    for (const p of rows) {
      const dd = Math.abs(p.y - y);
      if (dd < bestD) {
        bestD = dd;
        best = p;
      }
    }
    if (!best || bestD > 24 || y < PAD || y > r.height - PAD) {
      if (hoverRef.current) setHover(null);
      return;
    }
    if (!hoverRef.current || hoverRef.current.side !== side || !near(hoverRef.current.strike, best.strike)) setHover({ side, strike: best.strike });
  };
  const onLeave = () => {
    setHover(null);
    if (overSpotRef.current) setOverSpot(false);
  };
  const onClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if ((e.target as Element | null)?.closest?.('[data-node-card]')) return;
    /* The way back: a click on "▲ spot" glides the window home */
    if (overSpotRef.current) {
      onWant(0);
      setOverSpot(false);
      return;
    }
    const hv = hoverRef.current;
    if (!hv) {
      /* Empty space closes the card; the kept strike stays kept */
      if (myCard) onCard?.(null);
      return;
    }
    const ticker = hv.side === 'a' ? cmp.a.ticker : cmp.b.ticker;
    if (!cards) {
      onPick(hv.strike, ticker);
      return;
    }
    /* THE CARD: this capsule opens it (and keeps the strike); the same capsule
       again closes it and lets the strike go; another capsule moves it */
    const same = myCard != null && myCard.side === hv.side && near(myCard.strike, hv.strike);
    if (same) {
      onCard?.(null);
      onPick(hv.strike, ticker);
      return;
    }
    const root = rootRef.current;
    const x = root ? e.clientX - root.getBoundingClientRect().left : 0;
    onCard?.({ lane: greek, side: hv.side, strike: hv.strike, x });
    const kept = (hv.side === 'a' ? focusA : focusB) === hv.strike;
    if (!kept) onPick(hv.strike, ticker);
  };

  /* THE READ LINE — the strike in hand, and the other name's nearest at the same distance */
  const readSide: SideKey | null = hover ? hover.side : focusA != null ? 'a' : focusB != null ? 'b' : null;
  const readStrike = hover ? hover.strike : readSide === 'a' ? focusA : readSide === 'b' ? focusB : null;
  const S = readSide === 'a' ? lay.a : readSide === 'b' ? lay.b : null;
  const O = readSide === 'a' ? lay.b : readSide === 'b' ? lay.a : null;
  const row = S && readStrike != null ? S.rows.find(p => near(p.strike, readStrike)) ?? null : null;
  const nearestOn = (O: SideLayout, d: number) => O.rows.reduce<RulerRow | null>((m, p) => (!m || Math.abs(p.d - d) < Math.abs(m.d - d) ? p : m), null);
  const other = row && O ? nearestOn(O, row.d) : null;
  const kept = row && S ? (readSide === 'a' ? focusA : focusB) === row.strike : false;

  /* THE CARD'S CONTENT — the node, and the other name's nearest strike at the same distance */
  const cardS = myCard ? (myCard.side === 'a' ? lay.a : lay.b) : null;
  const cardO = myCard ? (myCard.side === 'a' ? lay.b : lay.a) : null;
  const cardRow = cardS && myCard ? cardS.rows.find(p => near(p.strike, myCard.strike)) ?? null : null;
  const cardOther = cardRow && cardO ? nearestOn(cardO, cardRow.d) : null;
  const onMaxFor = (side: SideKey) => (side === 'a' ? onMaxRef.current.a : onMaxRef.current.b);
  const view = inView(lay, target);
  const scale = view.scale(greek);

  return (
    <div className="flex flex-col min-w-0 min-h-0 h-full" data-ruler-lane={greek}>
      {compact && (
        /* EACH NAME AT ITS OWN END of every lane (Noah, 2026-09-10: "quite hard
           to distinguish the respected tickers here") — the left name and its
           scale, the greek, the right scale and its name */
        <div className="px-2 flex items-center justify-between font-mono text-[9px] tnum whitespace-nowrap" style={{ height: 22 }} data-lane-caption>
          <span className="truncate">
            <span className="font-bold text-textPrimary">{cmp.a.ticker}</span> <span className="text-textMuted">{fmtDollars(scale.a)}</span>
          </span>
          <span className="font-bold uppercase tracking-widest text-textSecondary">{GREEK_LABEL[greek]}</span>
          <span className="truncate">
            <span className="text-textMuted">{fmtDollars(scale.b)}</span> <span className="font-bold text-textPrimary">{cmp.b.ticker}</span>
          </span>
        </div>
      )}
      <div
        ref={rootRef}
        className={`relative select-none flex-1 min-h-0 ${overSpot ? 'cursor-pointer' : scrollable ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
        style={{ height, flex: height != null ? 'none' : undefined, touchAction: scrollable ? 'none' : undefined }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerLeave={onLeave}
        onClick={onClick}
        onDoubleClick={() => onWant(0)}
        title={overSpot ? 'Back to spot' : scrollable ? 'Scroll or pull to move along the ruler · click ▲ spot or double-click to come back' : undefined}
        data-axis-canvas
        data-over-spot={overSpot || undefined}
        data-dragging={dragging || undefined}
      >
        <canvas ref={canvasRef} className="absolute inset-0 block" aria-hidden />
        {myCard && cardS && cardO && cardRow && (
          <div
            ref={cardRef}
            className="absolute left-0 top-0 z-20 rounded-md border border-borderSubtle px-3 py-2.5 select-text cursor-default"
            style={{ width: CARD_W, background: 'rgba(8,8,10,0.88)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', opacity: 0, pointerEvents: 'none', transition: 'opacity 160ms ease-out' }}
            onPointerDown={e => e.stopPropagation()}
            onDoubleClick={e => e.stopPropagation()}
            data-node-card={`${myCard.side}:${myCard.strike}`}
          >
            <div className="grid gap-x-3 gap-y-1.5 items-start" style={{ gridTemplateColumns: '44px minmax(0,1fr) minmax(0,1fr)' }}>
              {/* THE HEAD ROW: the node on its own side, the other name's nearest across from it */}
              <button type="button" onClick={() => onCard?.(null)} className="inline-flex items-center justify-center w-5 h-5 -ml-1 rounded text-textMuted hover:text-textPrimary hover:bg-ink/[0.06] transition-colors" title="Close (Esc)" data-card-close style={{ gridRow: 1 }}>
                <X className="w-3 h-3" />
              </button>
              {(['s', 'o'] as const).map(which => {
                const L = which === 's' ? cardS : cardO;
                const r = which === 's' ? cardRow : cardOther;
                const alignRight = (which === 's') === (myCard.side === 'a');
                return (
                  <span key={which} className={`min-w-0 flex flex-col leading-tight ${alignRight ? 'items-end text-right' : 'items-start'}`} style={{ gridRow: 1, gridColumn: (which === 's') === (myCard.side === 'a') ? 2 : 3 }} data-card-head={which}>
                    <span className="font-mono text-[12px] font-bold tnum text-textPrimary whitespace-nowrap">
                      {L.side.ticker} {r ? fmtStrike(r.strike) : '—'}
                    </span>
                    <span className="text-[9.5px] whitespace-nowrap">
                      {r ? (
                        <>
                          <span className={`font-mono tnum ${r.d > 0 ? 'text-bull' : r.d < 0 ? 'text-bear' : 'text-textMuted'}`}>{tickWords(r.d, lay.U)}</span>
                          {roleOf(L, r.strike) && <span className="text-textPrimary"> · {roleOf(L, r.strike)}</span>}
                          {which === 'o' && <span className="text-textMuted"> · nearest</span>}
                        </>
                      ) : (
                        <span className="text-textMuted">nothing near</span>
                      )}
                    </span>
                  </span>
                );
              })}
              {/* THE FIVE GREEKS, the lane's lit */}
              {GREEKS.map(g => (
                <span key={g} className={`font-mono text-[9px] uppercase tracking-widest self-start pt-[1px] ${g === greek ? 'text-textPrimary font-bold' : 'text-textMuted'}`} style={{ gridRow: GREEKS.indexOf(g) + 2, gridColumn: 1 }}>
                  {GREEK_LABEL[g]}
                </span>
              ))}
              {/* The node's column on its own side of the card, the other name's across from it */}
              {(myCard.side === 'a' ? (['s', 'o'] as const) : (['o', 's'] as const)).map((which, ci) => {
                const L = which === 's' ? cardS : cardO;
                const r = which === 's' ? cardRow : cardOther;
                if (!r) return null;
                return (
                  <div key={which} className="contents" data-card-col={which}>
                    {GREEKS.map(g => {
                      const v = valueOf(L.side, g, r.strike);
                      const lit = g === greek;
                      const alignRight = ci === 0;
                      return (
                        <span key={g} className={`min-w-0 flex flex-col leading-tight ${alignRight ? 'items-end text-right' : 'items-start'}`} style={{ gridRow: GREEKS.indexOf(g) + 2, gridColumn: ci + 2 }} data-card-cell={`${which}:${g}`}>
                          {v == null || v === 0 ? (
                            <span className="font-mono text-[11px] text-textMuted">—</span>
                          ) : (
                            <>
                              <span className={`font-mono text-[11px] tnum ${lit ? 'font-bold' : ''}`} style={{ color: thermal(v, L.side.heaviest[g] || 1, heat).fill }}>
                                {fmtDollars(Math.abs(v))}
                              </span>
                              <span className={`text-[9.5px] whitespace-nowrap truncate max-w-full ${lit ? 'text-textSecondary' : 'text-textMuted'}`}>{v > 0 ? GREEK_WORDS[g].pos : GREEK_WORDS[g].neg}</span>
                            </>
                          )}
                        </span>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            <div className="mt-2 pt-1.5 border-t border-ink/[0.06] text-[9px] text-textMuted whitespace-nowrap truncate">a click anywhere or Esc closes · the capsule again lets the strike go</div>
          </div>
        )}
      </div>
      <div className={`${compact ? 'px-2 text-[10px]' : 'px-5 text-[10.5px]'} border-t border-ink/[0.06] flex items-center gap-3 whitespace-nowrap overflow-hidden text-textSecondary`} style={{ height: AXIS_READ_H }} data-axis-read data-read-strike={row ? row.strike : undefined}>
        {row && S && readSide ? (
          compact ? (
            <>
              <span className="font-mono font-bold tnum text-textPrimary">
                {S.side.ticker} {fmtStrike(row.strike)}
              </span>
              <span className="font-mono tnum text-textPrimary truncate">
                {fmtDollars(Math.abs(row.value))} · {row.value > 0 ? words.pos : words.neg}
              </span>
            </>
          ) : (
            <>
              <span className="font-mono text-[11px] font-bold tnum text-textPrimary">
                {S.side.ticker} {fmtStrike(row.strike)}
              </span>
              <span className={`font-mono tnum ${row.d > 0 ? 'text-bull' : row.d < 0 ? 'text-bear' : 'text-textMuted'}`}>{tickWords(row.d, lay.U)}</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: thermal(row.value, onMaxFor(readSide), heat).fill }} aria-hidden />
                <span className="font-mono tnum text-textPrimary">
                  {fmtDollars(Math.abs(row.value))} {GREEK_LABEL[greek]} · {row.value > 0 ? words.pos : words.neg}
                </span>
              </span>
              {roleOf(S, row.strike) && <span className="text-textPrimary">{roleOf(S, row.strike)}</span>}
              {other && O && (
                <span className="text-textMuted">
                  · nearest on <span className="text-textSecondary">{O.side.ticker}</span>: <span className="font-mono tnum text-textPrimary">{fmtStrike(other.strike)}</span> <span className="font-mono tnum">{tickWords(other.d, lay.U)}</span> ·{' '}
                  <span className="font-mono tnum text-textPrimary">{fmtDollars(Math.abs(other.value))}</span> {other.value > 0 ? words.pos : words.neg}
                  {roleOf(O, other.strike) ? ` · ${roleOf(O, other.strike)}` : ''}
                </span>
              )}
              <span className="ml-auto text-textMuted">{hover ? (cards ? (myCard && myCard.side === hover.side && near(myCard.strike, hover.strike) ? 'its card is open · click to let go' : 'click for its card') : kept ? 'kept · click to let go' : 'click to keep') : 'kept'}</span>
            </>
          )
        ) : (
          <span className="text-textMuted truncate">{compact ? (cards ? 'hover a strike · click for its card' : 'hover a strike') : `hover a strike on either side · ${cards ? 'click for its card' : 'click to keep it'}${scrollable ? ' · scroll or pull to move along the ruler · double-click to come back to spot' : ''}`}</span>
        )}
      </div>
    </div>
  );
};

export default RulerLane;
