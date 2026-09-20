/*
==================================================
  SLAYER TERMINAL - THE PROFILE PANEL
  (components/gex/ProfilePanel.tsx)

  Option C (Noah, 2026-09-06: "go with C build it"):
  the Map's size rail and its forced-flow curve,
  redrawn as ONE panel beside the chart — two lanes
  on the chart's own price axis, one strike column
  between them, one head, one hover card. The way a
  volume profile hangs off a chart (TradingView's
  visible-range profile, Quantower's DOM Surface
  histograms), not two widgets glued to its edge.

  THE HAND is the one the cards under the chart use:
    · lane heads in sentence case, 10px, muted
    · bars as thin rows — a 1px edge, a 0.18 fill,
      a 2px bright end cap; ember where hedging
      amplifies a move, glacier where it absorbs
    · the flow as a 1.25px line over a 0.14 fill,
      two or three prices named, the rest quiet
    · walls, pin and supreme as the cards' chips
    · one tabular strike column, spot as a solid
      chip, the flip as a dashed rule across both
    · gridlines at 0.05, dividers at 0.08, the
      panel's edge at 0.14 — nothing at full white
    · the 196px hover card, price first

  DRAWN ON CANVAS at the device pixel ratio, every
  row at the height the chart puts that price
  (`PriceProjection`, polled in a frame loop — the
  mapping moves on autoscale, drag and resize, none
  of which are React renders), so the two halves
  cannot disagree about a price and every line is
  crisp. What used to be forty DOM rows and an SVG,
  each anti-aliased its own way, is one drawing.

  The rows outside the chart's plot are culled and
  counted (▲ 24 / ▼ 29 in the column), never
  squeezed: the chain is wider than the plot and the
  chart's zoom decides what is on screen.

  TWO HOSTS (2026-09-08, Noah: "put the map panel
  on terrain"): the Map, where it fills a fixed
  share beside the chart, and every Terrain pane,
  where it took the old strike rail's place — its
  drag grip (`width`/`onWidth`), its × (`onClose`),
  its Vol underlay (`ticker`: the session's traded
  volume by price under the size lane), and the
  lane choice in its own head (`onLane`). The old
  rail printed no figure anywhere; this one prints
  them in the capsules and in the read line.
==================================================
*/

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type MutableRefObject, type PointerEvent as ReactPointerEvent } from 'react';
import { Info, X } from 'lucide-react';
import Simulator from '../../core/simulator';
import Term from '../ui/Term';
import DropdownSelect, { type DropdownOption } from '../ui/DropdownSelect';
import { fmtUsd } from '../../data/gex';
import { fmtFlow, type FlowLadder, type FlowRung } from '../../data/hedgeFlow';
import { sessionVolumeProfile, type VolumeProfile } from '../../data/volumeProfile';
import { CALL_WALL, FLIP, PUT_WALL, SUPREME } from './palette';
import { heatCellStyle } from './heatmap';
import type { PriceProjection } from './StrikeChart';
import type { GexLevel } from '../../types/market';
import type { KeyLevels } from '../../types/gex';

export type ProfileLane = 'both' | 'size' | 'flow';
export const LANE_OPTIONS: DropdownOption<ProfileLane>[] = [
  { value: 'both', label: 'Both', hint: 'What sits at each strike, and what a move there costs, side by side' },
  { value: 'size', label: 'Size', hint: 'Only what sits at each strike' },
  { value: 'flow', label: 'Flow', hint: 'Only what a move to each strike costs' },
];
/** The Map hands ExposureLevels (with the pin); a Terrain pane hands KeyLevels (without) */
export type PanelLevels = KeyLevels & { pin?: number };
/** The narrowest the panel is drawn — a Terrain pane's docked width, and the grip's floor */
export const PROFILE_MIN_W = 132;

/* THE CALENDAR'S THERMAL RAMP (Noah, 2026-09-06: "go build the thermal
   capsules") — the same cells the Exposure Ledger under this map wears, so a
   strike reads the same colour above and below: pale yellow balanced, orange
   to deep red where hedging amplifies, sky to deep blue where it absorbs;
   the ink chosen by contrast (black on the yellow middle, white at the deep
   ends). Solid, never translucent — a low-alpha warm over black goes khaki. */
const thermal = (value: number, maxAbs: number) => {
  const s = heatCellStyle(value, maxAbs, 'thermal-yellow');
  return { fill: String(s.backgroundColor ?? '#FFFFBF'), ink: String(s.color ?? '#0a0a0a') };
};
const SILVER = '#C7D3E8';
const INK = '#ededed';
const INK_2 = '#a3a3a3';
const INK_3 = '#7d7d7d';

/** The band the head owns — no row is drawn in it */
const HEAD_BAND = 30;
/** The lane the ▼ count sits in */
const FOOT_BAND = 14;
/** The strike column between the lanes */
const COL_W = 60;
/** A strike's label needs about this much line box */
const LABEL_PITCH = 12;

/* THE LANES' SPLIT (Noah, 2026-09-12: "the size gex and forced flow should
   have this default width but the ability to expand or compress them as
   well"): the size lane's share of the two, half by default, dragged on a
   sash over the strike column, double-click to reset. One store, module-wide
   and persisted, like the rail's prefs — a split set on any panel is the
   split on every panel. */
const SPLIT_KEY = 'slayer_profile_split';
const SPLIT_DEFAULT = 0.5;
const SPLIT_MIN = 0.25;
const SPLIT_MAX = 0.75;
let splitPref: number = (() => {
  try {
    const v = Number(localStorage.getItem(SPLIT_KEY));
    return Number.isFinite(v) && v >= SPLIT_MIN && v <= SPLIT_MAX ? v : SPLIT_DEFAULT;
  } catch {
    return SPLIT_DEFAULT;
  }
})();
const splitListeners = new Set<() => void>();
function setSplitPref(v: number): void {
  splitPref = Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, v));
  try {
    localStorage.setItem(SPLIT_KEY, String(splitPref));
  } catch {
    /* storage off — the choice lives for the session */
  }
  splitListeners.forEach(fn => fn());
}
const splitSubscribe = (fn: () => void) => {
  splitListeners.add(fn);
  return () => {
    splitListeners.delete(fn);
  };
};
const splitSnapshot = () => splitPref;
const useSplitPref = () => useSyncExternalStore(splitSubscribe, splitSnapshot, splitSnapshot);

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const SANS = '-apple-system, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const fmtStrike = (v: number) => (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2));
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

interface ProfilePanelProps {
  /** Every strike in the window, ascending, the chosen greek's net parked there */
  rows: GexLevel[];
  /** The largest |value| in the window — the size lane's scale */
  maxAbs: number;
  /** The chain's strike spacing — what one strike is worth in pixels */
  step: number;
  levels: PanelLevels;
  /** What a move to each strike forces dealers to trade */
  flow: FlowLadder | null;
  /** Which lanes to draw — the host's dropdown chooses, or the head's own when `onLane` is given */
  lane: ProfileLane;
  /** Given, the head carries the Lanes card itself (a Terrain pane has no row above the panel) */
  onLane?: (lane: ProfileLane) => void;
  /** The "How to read" door — the host opens the guide over the map box */
  onGuide?: () => void;
  guideOpen?: boolean;
  /** Names the size lane: "Size · GEX" */
  greek: string;
  /** The greek's two words for a strike's sign — gamma's push, delta's lean, vega's and
      vanna's and charm's own (2026-09-09). Omitted, gamma's. */
  words?: { pos: string; neg: string };
  focusPrice?: number | null;
  onSelect?: (price: number) => void;
  /** Where the chart beside this panel puts a price — read in the frame loop */
  projection: MutableRefObject<PriceProjection | null>;
  /** The name the panel reads. Given, the head grows the Vol switch: the
      session's traded volume by price, VPOC and value area, under the size
      lane — the old rail's overlay, kept (2026-09-08). */
  ticker?: string;
  /** Drawn at this width, with a drag grip on the left edge reporting the new
      width on release. Omitted, the panel fills its flex share (the Map). */
  width?: number;
  onWidth?: (px: number) => void;
  /** Given, the head carries an × — a panel you can turn on from a toolbar and
      not off from itself is a panel that feels stuck to the page. */
  onClose?: () => void;
  closeHint?: string;
  className?: string;
}

interface Placed {
  strike: number;
  y: number;
  value: number;
  rung: FlowRung | undefined;
}

interface Hover {
  strike: number;
  x: number;
  y: number;
}

const ProfilePanel = ({
  rows, maxAbs, step, levels, flow, lane, onLane, greek, words = { pos: 'amplifies', neg: 'absorbs' }, focusPrice, onSelect, projection, onGuide, guideOpen = false,
  ticker, width, onWidth, onClose, closeHint = 'Hide this panel', className = '',
}: ProfilePanelProps) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const placedRef = useRef<Placed[]>([]);
  const [hover, setHover] = useState<Hover | null>(null);
  /* Where the plot ends and the chart's time-axis band begins — the read line's
     home — and how wide the panel is, which decides what the line and the head
     can hold (a docked Terrain pane's panel is 132px; the Map's is 42% of the box) */
  const [foot, setFoot] = useState<{ top: number; h: number; w: number } | null>(null);
  const footRef = useRef<{ top: number; h: number; w: number } | null>(null);
  const hoverRef = useRef<Hover | null>(null);
  hoverRef.current = hover;

  /*
    THE GRIP (Terrain, 2026-08-29: "on full screen i should be able to drag the
    strikes out more to cover up more of the screen"). The width while the
    grip is held is local, so a drag never writes desk state per pointer move;
    the committed width lands once, on release. The ceiling — 60% of the
    surface the panel shares — is re-applied on every render, not only while
    dragging: a panel widened in the fullscreen pane must not keep that width
    when the pane collapses and swallow its own chart.
  */
  const [dragW, setDragW] = useState<number | null>(null);
  const [hostW, setHostW] = useState(0);
  const sized = width != null;
  useEffect(() => {
    if (!sized) return;
    const host = rootRef.current?.parentElement;
    if (!host) return;
    setHostW(host.getBoundingClientRect().width);
    const ro = new ResizeObserver(entries => {
      for (const e of entries) setHostW(e.contentRect.width);
    });
    ro.observe(host);
    return () => ro.disconnect();
  }, [sized]);
  const maxW = hostW > 0 ? Math.max(PROFILE_MIN_W, Math.round(hostW * 0.6)) : Number.POSITIVE_INFINITY;
  const shownW = sized ? Math.min(dragW ?? width, maxW) : undefined;
  const onGripDown = (e: ReactPointerEvent<HTMLSpanElement>) => {
    if (!onWidth) return;
    e.preventDefault();
    e.stopPropagation();
    const root = rootRef.current;
    if (!root) return;
    const startX = e.clientX;
    const startW = root.getBoundingClientRect().width;
    const host = root.parentElement?.getBoundingClientRect().width ?? startW * 3;
    const max = Math.max(PROFILE_MIN_W, Math.round(host * 0.6));
    let last = startW;
    const move = (ev: PointerEvent) => {
      last = Math.round(Math.min(max, Math.max(PROFILE_MIN_W, startW + (startX - ev.clientX))));
      setDragW(last);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      setDragW(null);
      onWidth(last);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
  };
  /* THE SASH BETWEEN THE LANES — drag right to widen the size lane, left to widen the flow lane */
  const onSplitDown = (e: ReactPointerEvent<HTMLSpanElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const root = rootRef.current;
    if (!root) return;
    const startX = e.clientX;
    const startSplit = liveSplit;
    const lanesW = Math.max(1, root.getBoundingClientRect().width - COL_W);
    let last = startSplit;
    const move = (ev: PointerEvent) => {
      last = Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, startSplit + (ev.clientX - startX) / lanesW));
      setDragSplit(last);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      setDragSplit(null);
      setSplitPref(last);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
  };

  /*
    THE VOL UNDERLAY — the old rail's T-10, kept. The capsules say where the
    BOOK is heavy; the profile says where the TAPE has traded, and the point is
    reading the two against each other, so it is an underlay at texture
    strength rather than a second lane. Off by default; the Vol switch in the
    head turns it on. Recomputed when the rows do — the host hands new rows
    every tick, so the session's newest minute is always folded in.
  */
  const [showVol, setShowVol] = useState(false);
  const vp = useMemo<VolumeProfile | null>(
    () => (showVol && ticker ? sessionVolumeProfile(Simulator.getCandles(ticker) ?? []) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showVol, ticker, rows]
  );
  const vpRef = useRef<VolumeProfile | null>(null);
  vpRef.current = vp;
  /* THE TWEEN (Noah, 2026-09-06: "the size and flow charts resizing… a quick
     jolt that looks ugly. make this smooth and flawless"). Every capsule
     keeps its drawn length and colour here and eases toward its target each
     frame — a scan tick, a new on-screen scale, a lens change: nothing jumps.
     A capsule entering the view grows in from a dot. Exponential smoothing
     with a 110ms time constant: settled in about 400ms, and a change that
     lands mid-glide simply bends the glide. */
  const animRef = useRef(new Map<string, { len: number; c: [number, number, number]; h: number }>());
  const lastTsRef = useRef(0);
  const settledRef = useRef(true);
  /* Bumped when the data changes so the frame loop redraws even if nothing moved */
  const dataRev = useRef(0);
  useEffect(() => {
    dataRev.current++;
  }, [rows, maxAbs, step, levels, flow, lane, focusPrice, vp]);

  const showSize = lane !== 'flow';
  const showFlow = lane !== 'size';
  const bothLanes = showSize && showFlow;
  /* the lanes' split — the reader's, live while the sash is in hand */
  const split = useSplitPref();
  const [dragSplit, setDragSplit] = useState<number | null>(null);
  const liveSplit = dragSplit ?? split;

  /* THE FRAME LOOP — draw when the chart's mapping, the size or the data moved */
  useEffect(() => {
    let raf = 0;
    let lastKey = '';
    const rungBy = new Map<number, FlowRung>();
    if (flow) for (const r of flow.rungs) rungBy.set(r.strike, r);

    const draw = (ts: number) => {
      raf = requestAnimationFrame(draw);
      const dt = lastTsRef.current ? Math.min(64, ts - lastTsRef.current) : 16;
      lastTsRef.current = ts;
      const k = 1 - Math.exp(-dt / 110);
      const root = rootRef.current;
      const canvas = canvasRef.current;
      const p = projection.current;
      if (!root || !canvas || !p) return;
      const W = root.clientWidth;
      const Htot = root.clientHeight;
      if (W < 40 || Htot < 40) return;
      const H = p.plotHeight() || Htot;
      if (!footRef.current || footRef.current.top !== H || footRef.current.h !== Htot - H || footRef.current.w !== W) {
        footRef.current = { top: H, h: Htot - H, w: W };
        setFoot(footRef.current);
      }
      /* The pin is the Map's; a Terrain pane's levels carry none. NaN is never near anything. */
      const pin = levels.pin ?? Number.NaN;
      /* Is the scale live? Two prices a strike apart must land on different rows */
      const anchor = rows[Math.floor(rows.length / 2)]?.strike ?? levels.spot;
      const y0 = p.yFor(anchor);
      const y1 = p.yFor(anchor + step);
      if (y0 == null || y1 == null || !Number.isFinite(y0) || !Number.isFinite(y1) || Math.abs(y1 - y0) < 0.5) return;
      const pitch = Math.abs(y1 - y0);
      const spotY = p.yFor(levels.spot) ?? -1;
      const hv = hoverRef.current;
      const key = `${W}|${Htot}|${H}|${y0.toFixed(1)}|${pitch.toFixed(2)}|${spotY.toFixed(1)}|${hv?.strike ?? ''}|${dataRev.current}`;
      if (key === lastKey && settledRef.current) return;
      lastKey = key;
      /* Ease one capsule toward its target length and colour; says whether it got there */
      const anim = animRef.current;
      const touched = new Set<string>();
      let settled = true;
      /* `h` is the capsule's height, eased too (2026-09-06: a zoom-in made the
         rows taller in one frame — the one jolt the length tween left) */
      const ease = (id: string, len: number, fill: string, dot: number, h: number) => {
        const m = /(\d+),\s*(\d+),\s*(\d+)/.exec(fill);
        const target: [number, number, number] = m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [255, 255, 191];
        let a = anim.get(id);
        if (!a) {
          a = { len: dot, c: target, h };
          anim.set(id, a);
        }
        touched.add(id);
        a.len += (len - a.len) * k;
        a.h += (h - a.h) * k;
        a.c = [a.c[0] + (target[0] - a.c[0]) * k, a.c[1] + (target[1] - a.c[1]) * k, a.c[2] + (target[2] - a.c[2]) * k];
        const far = Math.abs(len - a.len) > 0.25 || Math.abs(h - a.h) > 0.25 || Math.abs(target[0] - a.c[0]) + Math.abs(target[1] - a.c[1]) + Math.abs(target[2] - a.c[2]) > 1.5;
        if (far) settled = false;
        else {
          a.len = len;
          a.h = h;
          a.c = target;
        }
        const [r, g, b] = a.c;
        /* The ink follows the colour it sits on, so it never flips mid-glide */
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        return { len: a.len, h: a.h, fill: `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`, ink: lum > 150 ? '#0a0a0a' : '#ffffff' };
      };

      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(Htot * dpr)) {
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(Htot * dpr);
        canvas.style.width = `${W}px`;
        canvas.style.height = `${Htot}px`;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, Htot);

      /* THE LANES */
      const both = showSize && showFlow;
      /* the size lane takes its share of the two, the flow lane the rest */
      const sizeW = both ? Math.round((W - COL_W) * liveSplit) : W - COL_W;
      const sizeL = showSize ? 0 : -1;
      const sizeR = showSize ? sizeW : -1;
      const colL = showSize ? sizeW : 0;
      const colR = colL + COL_W;
      const flowL = showFlow ? colR : -1;
      const flowR = showFlow ? W : -1;

      /* THE ROWS on screen, and the ones culled above and below */
      const barH = Math.max(4, Math.min(22, Math.round(pitch * 0.62)));
      const half = barH / 2;
      const placed: Placed[] = [];
      let above = 0;
      let below = 0;
      for (const r of rows) {
        const y = p.yFor(r.strike);
        if (y == null || !Number.isFinite(y)) continue;
        if (y - half < HEAD_BAND) {
          above++;
          continue;
        }
        if (y + half > H - FOOT_BAND) {
          below++;
          continue;
        }
        placed.push({ strike: r.strike, y, value: r.value, rung: rungBy.get(r.strike) });
      }
      placedRef.current = placed;
      const stride = Math.max(1, Math.ceil(LABEL_PITCH / pitch));
      const isLevel = (k: number) => near(k, levels.callWall) || near(k, levels.putWall) || near(k, levels.supreme) || near(k, pin);
      const isFocus = (k: number) => focusPrice != null && near(k, focusPrice);
      const isHover = (k: number) => hv != null && near(k, hv.strike);
      const labelled = (i: number, k: number) => i % stride === 0 || isLevel(k) || isFocus(k) || isHover(k);

      /* Hover wash first, under everything */
      if (hv) {
        const row = placed.find(r => near(r.strike, hv.strike));
        if (row) {
          ctx.fillStyle = 'rgba(255,255,255,0.04)';
          ctx.fillRect(0, row.y - pitch / 2, W, pitch);
        }
      }

      /* The column's ground, the dividers, the panel's edge */
      ctx.fillStyle = 'rgba(255,255,255,0.025)';
      ctx.fillRect(colL, HEAD_BAND, COL_W, H - HEAD_BAND - FOOT_BAND);
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (showSize) {
        ctx.moveTo(colL + 0.5, HEAD_BAND);
        ctx.lineTo(colL + 0.5, H);
      }
      if (showFlow) {
        ctx.moveTo(colR - 0.5, HEAD_BAND);
        ctx.lineTo(colR - 0.5, H);
      }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.beginPath();
      ctx.moveTo(0.5, 0);
      ctx.lineTo(0.5, Htot);
      ctx.stroke();

      /* THE VOL UNDERLAY — where the session has traded, as neutral steel
         under the size lane: bars growing from the column outward like the
         capsules over them, the value area's edges dashed, the VPOC solid.
         Traded volume carries no dealer meaning, so it takes none of the
         palette's inks. */
      const prof = vpRef.current;
      if (showSize && prof && prof.totalVolume > 0) {
        let maxV = 0;
        for (const b of prof.bins) maxV = Math.max(maxV, b.volume);
        if (maxV > 0) {
          const vSpan = Math.max(1, sizeR - sizeL - 10);
          for (const b of prof.bins) {
            const y = p.yFor(b.price);
            const y2 = p.yFor(b.price + prof.binSize);
            if (y == null || y2 == null || !Number.isFinite(y) || !Number.isFinite(y2)) continue;
            const top = Math.max(HEAD_BAND, Math.min(y, y2));
            const bot = Math.min(H - FOOT_BAND, Math.max(y, y2));
            if (bot - top < 0.5) continue;
            const isPoc = prof.vpoc !== null && Math.abs(b.price - prof.vpoc) < prof.binSize / 2;
            const len = (b.volume / maxV) * vSpan;
            ctx.fillStyle = `rgba(226,234,244,${isPoc ? 0.2 : 0.09})`;
            ctx.fillRect(sizeR - len, top, len, Math.max(1, bot - top - 1));
          }
          const rule = (price: number | null, alpha: number, dash: number[]) => {
            if (price === null) return;
            const y = p.yFor(price);
            if (y == null || y < HEAD_BAND || y > H - FOOT_BAND) return;
            ctx.save();
            ctx.strokeStyle = `rgba(226,234,244,${alpha})`;
            ctx.lineWidth = 1;
            ctx.setLineDash(dash);
            ctx.beginPath();
            ctx.moveTo(sizeL + 4, Math.round(y) + 0.5);
            ctx.lineTo(sizeR - 2, Math.round(y) + 0.5);
            ctx.stroke();
            ctx.restore();
          };
          rule(prof.vah, 0.28, [3, 3]);
          rule(prof.val, 0.28, [3, 3]);
          rule(prof.vpoc, 0.4, []);
          if (prof.vpoc !== null) {
            const y = p.yFor(prof.vpoc);
            if (y != null && y > HEAD_BAND + 8 && y < H - FOOT_BAND) {
              ctx.font = `7px ${MONO}`;
              ctx.fillStyle = 'rgba(226,234,244,0.55)';
              ctx.textAlign = 'left';
              ctx.textBaseline = 'bottom';
              ctx.fillText('VPOC', sizeL + 6, y - 2);
            }
          }
        }
      }

      /* Gridlines at the labelled rows */
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.beginPath();
      placed.forEach((r, i) => {
        if (!labelled(i, r.strike)) return;
        const yy = Math.round(r.y) + 0.5;
        if (showSize) {
          ctx.moveTo(sizeL + 6, yy);
          ctx.lineTo(sizeR - 2, yy);
        }
        if (showFlow) {
          ctx.moveTo(flowL + 2, yy);
          ctx.lineTo(flowR - 6, yy);
        }
      });
      ctx.stroke();

      /* THE FLIP — a dashed rule across both lanes */
      const flipY = p.yFor(levels.flip);
      if (flipY != null && flipY > HEAD_BAND && flipY < H - FOOT_BAND) {
        const yy = Math.round(flipY) + 0.5;
        ctx.save();
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = rgba(FLIP, 0.7);
        ctx.beginPath();
        ctx.moveTo(showSize ? 4 : colR, yy);
        ctx.lineTo(showFlow ? W - 4 : colL, yy);
        ctx.stroke();
        ctx.restore();
        ctx.font = `9px ${MONO}`;
        ctx.fillStyle = rgba(FLIP, 0.9);
        ctx.textBaseline = 'bottom';
        if (showFlow) {
          ctx.textAlign = 'right';
          ctx.fillText(`flip ${fmtStrike(levels.flip)}`, W - 6, yy - 2);
        } else {
          ctx.textAlign = 'left';
          ctx.fillText(`flip ${fmtStrike(levels.flip)}`, 6, yy - 2);
        }
      }

      /* THE SPOT RULE — under the bars; its chip comes last */
      const spotOn = spotY > HEAD_BAND && spotY < H - FOOT_BAND;
      if (spotOn) {
        const yy = Math.round(spotY) + 0.5;
        ctx.strokeStyle = 'rgba(237,237,237,0.3)';
        ctx.beginPath();
        ctx.moveTo(0, yy);
        ctx.lineTo(W, yy);
        ctx.stroke();
      }

      /* THE CAPSULES — the ledger's cells turned sideways: one solid capsule
         per strike, its length the figure, its colour the thermal ramp, the
         figure printed inside at the outer end when there is room. Both lanes
         scale to the largest strike ON SCREEN so a zoomed-in chart still shows
         capsules that read as capsules. */
      const capsule = (x: number, yMid: number, len: number, fill: string, ring: string | null, h = barH) => {
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
      /* Words inside a capsule from 10px of row, one point smaller under 13 —
         a name must go INSIDE a capsule that reaches the edge, whatever the
         zoom, never over its figure (Noah, 2026-09-09) */
      const figureIn = (text: string, x: number, len: number, yMid: number, ink: string, outer: 'left' | 'right', font = `600 9px ${MONO}`) => {
        if (barH < 10) return;
        ctx.font = barH < 13 ? font.replace('9px', '8px') : font;
        const w = ctx.measureText(text).width;
        if (w + 12 > len) return;
        ctx.fillStyle = ink;
        ctx.textBaseline = 'middle';
        ctx.textAlign = outer === 'left' ? 'left' : 'right';
        ctx.fillText(text, outer === 'left' ? x + 6 : x + len - 6, yMid + 0.5);
      };
      const ringFor = (k: number) => (isFocus(k) ? SILVER : isHover(k) ? rgba(SILVER, 0.6) : null);
      /* THE LEVEL NAMES — the cards' chips beside a capsule's end when there is
         room; when the capsule reaches the lane's edge (the wall is usually the
         longest) the name goes INSIDE it at the outer end and the figure moves
         to the inner end, so neither covers the other (Noah, 2026-09-06: "the
         call wall/put wall sometimes overlays the number of the strike when
         it's too long. find another way"). */
      const levelOf = new Map<number, { words: string; c: string }>();
      levelOf.set(levels.callWall, { words: 'Call wall', c: CALL_WALL });
      levelOf.set(levels.putWall, { words: 'Put wall', c: PUT_WALL });
      if (!near(levels.supreme, levels.callWall) && !near(levels.supreme, levels.putWall)) levelOf.set(levels.supreme, { words: 'Supreme', c: SUPREME });
      if (Number.isFinite(pin) && !near(pin, levels.callWall) && !near(pin, levels.putWall) && !near(pin, levels.supreme)) levelOf.set(pin, { words: 'Pin', c: INK_2 });
      const levelAt = (k: number) => {
        for (const [lk, v] of levelOf) if (near(lk, k)) return v;
        return undefined;
      };
      const chipW = (words: string) => {
        ctx.font = `500 10px ${SANS}`;
        return Math.ceil(ctx.measureText(words).width) + 12;
      };
      const insideNamed = new Set<number>();
      const NAME_FONT = `500 9px ${SANS}`;
      const figW = (text: string) => {
        ctx.font = `600 9px ${MONO}`;
        return ctx.measureText(text).width;
      };

      /* THE SIZE LANE — capsules growing from the column outward */
      const barEnd = new Map<number, number>();
      if (showSize) {
        const span = Math.max(1, sizeR - sizeL - 10);
        let onMax = 0;
        for (const r of placed) onMax = Math.max(onMax, Math.abs(r.value));
        if (!onMax) onMax = maxAbs || 1;
        for (const r of placed) {
          if (r.value === 0) continue;
          const target = Math.max(barH, (Math.abs(r.value) / onMax) * span);
          const t = ease(`s:${r.strike}`, target, thermal(r.value, onMax).fill, barH, barH);
          const len = t.len;
          const x = sizeR - len;
          barEnd.set(r.strike, x);
          capsule(x, r.y, len, t.fill, ringFor(r.strike), t.h);
          const fig = fmtUsd(Math.abs(r.value));
          const lvl = levelAt(r.strike);
          if (lvl && x - 8 - chipW(lvl.words) < 6 && barH >= 10) {
            /* No room beside the end: the name inside at the outer end, the figure at the inner end */
            insideNamed.add(r.strike);
            figureIn(lvl.words, x, len, r.y, t.ink, 'left', NAME_FONT);
            ctx.font = NAME_FONT;
            const nw = ctx.measureText(lvl.words).width;
            if (nw + figW(fig) + 20 <= len) figureIn(fig, x, len, r.y, t.ink, 'right');
          } else {
            figureIn(fig, x, len, r.y, t.ink, 'left');
          }
        }
      }

      /* THE FLOW LANE — THE LEVELS NAMED, THE REST A SILHOUETTE (Noah,
         2026-09-06: "still find the flow unappealing"). The flow is a running
         total, so drawn at every strike it is a smooth wedge — no rhythm, and
         the ramp across it turns into a rainbow. So the whole wedge sits
         behind in one quiet grey, and capsules are drawn ONLY where the number
         matters: the walls, the supreme, the pin, the kept strike and the one
         under the pointer — warm where that flow speeds the move up, cool where
         it slows it, the verb and the figure inside ("sell $118M"), or beside
         the capsule when it is too short to hold them. */
      if (showFlow && flow) {
        let onMax = 0;
        for (const r of placed) if (r.rung) onMax = Math.max(onMax, Math.abs(r.rung.flow));
        if (!onMax) onMax = flow.maxAbs || 1;
        const span = Math.max(1, flowR - flowL - 10);
        const x0 = flowL + 4;
        /* Every rung's length and colour eased, so the silhouette and the named
           capsules glide together */
        const eased = new Map<number, { len: number; h: number; fill: string; ink: string }>();
        for (const r of placed) {
          const g = r.rung;
          if (!g) continue;
          const mag = Math.abs(g.flow);
          const target = Math.max(barH, (mag / onMax) * span);
          eased.set(r.strike, ease(`f:${r.strike}`, target, thermal(g.amplifies ? mag : -mag, onMax).fill, barH, barH));
        }
        /* The silhouette: the wedge above spot and the wedge below it, pinched to nothing at spot */
        const pts = placed.filter(r => r.rung).map(r => ({ x: x0 + Math.max(0, (eased.get(r.strike)?.len ?? barH) - barH), y: r.y }));
        if (spotY > HEAD_BAND && spotY < H - FOOT_BAND) pts.push({ x: x0, y: spotY });
        pts.sort((a, b) => a.y - b.y);
        if (pts.length > 1) {
          ctx.beginPath();
          ctx.moveTo(x0, pts[0].y);
          for (const q of pts) ctx.lineTo(q.x, q.y);
          ctx.lineTo(x0, pts[pts.length - 1].y);
          ctx.closePath();
          ctx.fillStyle = 'rgba(255,255,255,0.04)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.10)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (const q of pts.slice(1)) ctx.lineTo(q.x, q.y);
          ctx.stroke();
        }
        /* The named strikes */
        const named = new Set<number>();
        const nameAt = (k: number | null | undefined) => {
          if (k == null) return;
          const row = placed.find(r => near(r.strike, k));
          if (!row || !row.rung || row.rung.flow === 0 || named.has(row.strike)) return;
          named.add(row.strike);
          const g = row.rung;
          const t = eased.get(row.strike);
          if (!t) return;
          const len = t.len;
          capsule(x0, row.y, len, t.fill, ringFor(row.strike), t.h);
          ctx.font = `600 9px ${MONO}`;
          const full = `${g.flow >= 0 ? 'buy' : 'sell'} ${fmtFlow(g.flow)}`;
          const fits = (s: string) => barH >= 10 && ctx.measureText(s).width + 12 <= len;
          /* Flow-only: the level's chip lives at the lane's right edge; a capsule
             that reaches it takes the name inside at its outer end instead */
          const lvl = !showSize ? levelAt(row.strike) : undefined;
          if (lvl && x0 + len + 8 + chipW(lvl.words) > W - 6 && barH >= 10) {
            insideNamed.add(row.strike);
            figureIn(lvl.words, x0, len, row.y, t.ink, 'right', NAME_FONT);
            ctx.font = NAME_FONT;
            const nw = ctx.measureText(lvl.words).width;
            const short = fmtFlow(g.flow);
            if (nw + figW(full) + 20 <= len) figureIn(full, x0, len, row.y, t.ink, 'left');
            else if (nw + figW(short) + 20 <= len) figureIn(short, x0, len, row.y, t.ink, 'left');
            return;
          }
          if (fits(full)) figureIn(full, x0, len, row.y, t.ink, 'right');
          else if (fits(fmtFlow(g.flow))) figureIn(fmtFlow(g.flow), x0, len, row.y, t.ink, 'right');
          else {
            ctx.fillStyle = INK_2;
            ctx.textBaseline = 'middle';
            ctx.textAlign = 'left';
            ctx.fillText(full, x0 + len + 6, row.y + 0.5);
          }
        };
        nameAt(levels.callWall);
        nameAt(levels.putWall);
        nameAt(levels.supreme);
        nameAt(levels.pin);
        nameAt(focusPrice);
        nameAt(hv?.strike);
      }

      /* THE STRIKE COLUMN */
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      const cx = colL + COL_W / 2;
      placed.forEach((r, i) => {
        if (!labelled(i, r.strike)) return;
        if (spotOn && Math.abs(r.y - spotY) < 9) return; // the spot chip owns that height
        const k = r.strike;
        const focus = isFocus(k);
        ctx.font = `${focus ? '600 ' : ''}10px ${MONO}`;
        ctx.fillStyle = focus ? SILVER : near(k, levels.callWall) ? CALL_WALL : near(k, levels.putWall) ? PUT_WALL : near(k, levels.supreme) ? SUPREME : near(k, pin) || isHover(k) ? INK : INK_2;
        ctx.fillText(fmtStrike(k), cx, r.y);
      });
      /* Culled rows, counted */
      ctx.font = `9px ${MONO}`;
      ctx.fillStyle = INK_3;
      if (above) ctx.fillText(`▲ ${above}`, cx, HEAD_BAND + 6);
      if (below) ctx.fillText(`▼ ${below}`, cx, H - FOOT_BAND / 2 + 1);

      /* THE LEVEL CHIPS — the cards' chips, on their rows */
      const chip = (k: number, words: string, c: string) => {
        const row = placed.find(r => near(r.strike, k));
        if (!row || insideNamed.has(row.strike)) return;
        ctx.font = `500 10px ${SANS}`;
        const w = Math.ceil(ctx.measureText(words).width) + 12;
        /* Beside the bar's end when there is room, else over it at the lane's edge */
        const end = barEnd.get(k);
        const x = showSize ? (end != null ? Math.max(6, end - 8 - w) : 6) : W - 6 - w;
        const y = Math.round(row.y - 8) + 0.5;
        ctx.fillStyle = '#0a0a0a';
        ctx.beginPath();
        ctx.roundRect(x, y, w, 16, 8);
        ctx.fill();
        ctx.fillStyle = rgba(c, 0.14);
        ctx.fill();
        ctx.strokeStyle = rgba(c, 0.5);
        ctx.stroke();
        ctx.fillStyle = c;
        ctx.textAlign = 'center';
        ctx.fillText(words, x + w / 2, row.y + 0.5);
      };
      chip(levels.callWall, 'Call wall', CALL_WALL);
      chip(levels.putWall, 'Put wall', PUT_WALL);
      if (!near(levels.supreme, levels.callWall) && !near(levels.supreme, levels.putWall)) chip(levels.supreme, 'Supreme', SUPREME);
      if (Number.isFinite(pin) && !near(pin, levels.callWall) && !near(pin, levels.putWall) && !near(pin, levels.supreme)) chip(pin, 'Pin', INK_2);

      /* THE SPOT CHIP — solid, in the column */
      if (spotOn) {
        const y = Math.round(spotY - 8);
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.roundRect(colL + 2, y, COL_W - 4, 16, 4);
        ctx.fill();
        ctx.fillStyle = '#0a0a0a';
        ctx.font = `700 10px ${MONO}`;
        ctx.textAlign = 'center';
        ctx.fillText(levels.spot.toFixed(2), cx, spotY + 0.5);
      }

      /* THE MIRROR (Noah, 2026-09-06: "i love how this section zooms out… i
         want the opposite effect when zooming in… a zoom in bar by bar"): a
         size capsule whose strike has just left the view does not vanish — it
         shrinks back to a dot at the edge it left by, then goes; the entering
         glide run backwards. (The flow lane's entries are only the
         silhouette's memory and go at once.) A capsule that comes back
         mid-shrink simply grows again from where it was. */
      for (const [id, a] of anim) {
        if (touched.has(id)) continue;
        if (!id.startsWith('s:') || !showSize) {
          anim.delete(id);
          continue;
        }
        const strike = Number(id.slice(2));
        const yRaw = p.yFor(strike);
        if (yRaw == null || !Number.isFinite(yRaw)) {
          anim.delete(id);
          continue;
        }
        a.len += (a.h - a.len) * k;
        if (a.len - a.h < 0.5) {
          anim.delete(id);
          continue;
        }
        settled = false;
        const yc = Math.min(H - FOOT_BAND - a.h / 2, Math.max(HEAD_BAND + a.h / 2, yRaw));
        const [r, g, b] = a.c;
        capsule(sizeR - a.len, yc, a.len, `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`, null, a.h);
      }
      settledRef.current = settled;
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [rows, maxAbs, step, levels, flow, lane, focusPrice, projection, showSize, showFlow, vp, liveSplit]);

  /* THE POINTER — the nearest strike by height, anywhere in the lanes */
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const root = rootRef.current;
    if (!root) return;
    const r = root.getBoundingClientRect();
    const y = e.clientY - r.top;
    const x = e.clientX - r.left;
    if (y < HEAD_BAND) {
      if (hoverRef.current) setHover(null);
      return;
    }
    let best: Placed | null = null;
    let bestD = Infinity;
    for (const row of placedRef.current) {
      const d = Math.abs(row.y - y);
      if (d < bestD) {
        bestD = d;
        best = row;
      }
    }
    if (!best) return;
    if (!hoverRef.current || !near(hoverRef.current.strike, best.strike) || Math.abs(hoverRef.current.x - x) > 2) setHover({ strike: best.strike, x, y: best.y });
  };
  const onLeave = () => setHover(null);
  const onClick = () => {
    if (hoverRef.current && onSelect) onSelect(hoverRef.current.strike);
  };

  /* THE READ LINE (Noah, 2026-09-06: "the card on hover blocks the view of
     the flow") — the Exposure Ledger's answer to the same problem, NO floating
     card: one fixed line in the chart's time-axis band under the lanes, which
     covers nothing. The hovered strike first, else the kept one, else the
     hint. The swatches read the same on-screen scale the capsules use. */
  const readStrike = hover?.strike ?? focusPrice ?? null;
  const readRow = readStrike != null ? placedRef.current.find(r => near(r.strike, readStrike)) ?? null : null;
  const hoverMax = placedRef.current.reduce((m, r) => Math.max(m, Math.abs(r.value)), 0) || maxAbs || 1;
  const hoverFlowMax = placedRef.current.reduce((m, r) => Math.max(m, Math.abs(r.rung?.flow ?? 0)), 0) || flow?.maxAbs || 1;
  /* WHAT THE LINE HOLDS follows the panel's width — it never wraps and it never
     clips a figure mid-number. Wide, the whole read; under ~430px the words go
     and the figures stay; under ~240px (a docked Terrain pane) the strike and
     the size, which is the one number the old rail never printed. */
  const panelW = foot?.w ?? 0;
  const tight = panelW > 0 && panelW < 430;
  const tiny = panelW > 0 && panelW < 240;
  const readLine = foot && (
    <div
      data-profile-read
      data-read-strike={readRow ? readRow.strike : undefined}
      className={`absolute inset-x-0 flex items-center ${tight ? 'gap-2 px-2' : 'gap-3 px-2.5'} border-t border-borderSubtle bg-panel whitespace-nowrap overflow-hidden text-[10.5px] text-textSecondary pointer-events-none`}
      style={{ top: foot.top, height: foot.h }}
    >
      {readRow ? (
        <>
          <span className="font-mono text-[11px] font-bold tnum text-textPrimary">{fmtStrike(readRow.strike)}</span>
          {!tiny && (
            <span className={`font-mono tnum ${readRow.strike > levels.spot ? 'text-bull' : readRow.strike < levels.spot ? 'text-bear' : 'text-textMuted'}`}>
              {readRow.strike > levels.spot ? '+' : ''}
              {(((readRow.strike - levels.spot) / levels.spot) * 100).toFixed(2)}%{tight ? '' : ' from spot'}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            {!tight && <span className="text-textMuted">Size</span>}
            {readRow.value !== 0 && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: thermal(readRow.value, hoverMax).fill }} aria-hidden />}
            <span className="font-mono tnum text-textPrimary">
              {readRow.value === 0 ? '—' : tight ? fmtUsd(Math.abs(readRow.value)) : `${fmtUsd(Math.abs(readRow.value))} · ${readRow.value > 0 ? words.pos : words.neg}`}
            </span>
          </span>
          {!tiny && (
            <span className="inline-flex items-center gap-1.5">
              {!tight && <span className="text-textMuted">A move here forces</span>}
              {readRow.rung && readRow.rung.flow !== 0 && (
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: thermal(readRow.rung.amplifies ? Math.abs(readRow.rung.flow) : -Math.abs(readRow.rung.flow), hoverFlowMax).fill }} aria-hidden />
              )}
              <span className="font-mono tnum text-textPrimary">{readRow.rung && readRow.rung.flow !== 0 ? `${readRow.rung.flow >= 0 ? 'buy' : 'sell'} ${fmtFlow(readRow.rung.flow)}` : '—'}</span>
            </span>
          )}
          {!tight && (
            <span className="truncate">
              {readRow.rung
                ? readRow.rung.flow === 0
                  ? 'no forced flow at this strike'
                  : `dealers ${readRow.rung.amplifies ? 'chase' : 'lean against'} a move here · ${readRow.rung.amplifies ? 'speeds it up' : 'slows it'}`
                : 'the market is here'}
            </span>
          )}
          {!tight && <span className="ml-auto text-textMuted">{hover ? (focusPrice != null && near(focusPrice, readRow.strike) ? 'kept · click to let go' : 'click to keep') : 'kept'}</span>}
        </>
      ) : (
        <span className="text-textMuted">{tiny ? 'hover a strike' : 'hover a strike · click to keep it'}</span>
      )}
    </div>
  );

  /* HOW TO READ THIS (Noah, 2026-09-06: "how can someone know this info in the
     page?" — they couldn't): the two lanes defined in plain words, drawn as
     two figures in the panel's own hand, and today's walls read both ways —
     see ProfileGuide.tsx. */
  /* The door only — the host opens the guide as a FOCUS over the whole map
     box, the rest blurred behind it (Noah, 2026-09-06: "a focus and blur
     effect on the how to read card"), the way the trader's clock keeps a
     phase. */
  /* Narrow, the door is its icon alone and the Lanes card waits for room —
     a docked Terrain pane's panel is 132px, and the words would push the ×
     off the edge. The card comes back first (250px: a three-up pane's panel
     dragged to its 60% ceiling holds it), the door's words after. */
  const narrow = panelW > 0 && panelW < 320;
  const roomForLanes = panelW >= 250;
  const guide = onGuide && (
    <button
      type="button"
      data-profile-guide
      aria-pressed={guideOpen}
      onClick={onGuide}
      aria-label="How to read"
      className="pointer-events-auto shrink-0 inline-flex items-center gap-1 h-6 px-1.5 rounded-md text-[10px] text-textMuted hover:text-textPrimary hover:bg-ink/[0.05] aria-pressed:text-textPrimary transition-colors"
      title="What the two lanes mean"
    >
      <Info className="w-3 h-3" />
      {!narrow && 'How to read'}
    </button>
  );
  /* THE HEAD'S TOOLS, at the panel's right edge so a card opens snug to it
     (Noah, 2026-09-06): the Lanes card when the host has no row of its own
     for it, the Vol switch, the door, the ×. */
  const tools = (
    <span className="ml-auto shrink-0 flex items-center gap-1 pointer-events-auto" data-profile-tools>
      {onLane && roomForLanes && <DropdownSelect label="Lanes" value={lane} options={LANE_OPTIONS} onChange={onLane} title="What the panel draws" testId="lanes" align="end" />}
      {ticker && showSize && (
        <button
          type="button"
          onClick={() => setShowVol(v => !v)}
          aria-pressed={showVol}
          title="Volume profile — the session's traded volume by price, VPOC and value area, under the size lane"
          className={`shrink-0 h-6 rounded px-1.5 font-mono text-[9px] font-bold uppercase tracking-widest transition-colors ${
            showVol ? 'bg-ink/[0.14] text-textPrimary' : 'text-textMuted hover:text-textPrimary hover:bg-ink/[0.08]'
          }`}
          data-profile-vol
        >
          Vol
        </button>
      )}
      {guide}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label={ticker ? `Hide the ${ticker} panel` : 'Hide this panel'}
          title={closeHint}
          className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded text-textMuted hover:text-textPrimary hover:bg-ink/[0.08] transition-colors"
          data-profile-close
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  );

  return (
    <div
      ref={rootRef}
      className={`relative h-full select-none ${sized ? 'shrink-0' : 'flex-1 min-w-0'} ${className}`}
      style={sized ? { width: shownW } : undefined}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      onClick={onClick}
      data-profile-panel
      data-lane={lane}
      aria-label={ticker ? `${ticker} exposure by strike` : undefined}
    >
      {/* The grip: the panel's own left edge, live. Invisible until the
          pointer finds it, like every sash on the desk. */}
      {sized && onWidth && (
        <span
          onPointerDown={onGripDown}
          onDoubleClick={() => onWidth(PROFILE_MIN_W)}
          role="separator"
          aria-orientation="vertical"
          aria-label="Drag to resize the panel — double-click to reset"
          title="Drag to resize · double-click to reset"
          className="absolute left-0 inset-y-0 -ml-1 w-2 z-30 cursor-col-resize hover:bg-ink/[0.10] transition-colors"
          data-profile-grip
        />
      )}
      {/* The sash between the two lanes, over the strike column's left edge —
          the lanes' split, live under the hand */}
      {bothLanes && (
        <span
          onPointerDown={onSplitDown}
          onDoubleClick={() => setSplitPref(SPLIT_DEFAULT)}
          role="separator"
          aria-orientation="vertical"
          aria-label="Drag to widen one lane and narrow the other — double-click to reset"
          title="Drag to widen one lane and narrow the other · double-click to reset"
          className="absolute inset-y-0 -ml-1 w-2 z-30 cursor-col-resize hover:bg-ink/[0.10] transition-colors"
          style={{ left: `calc((100% - ${COL_W}px) * ${liveSplit})` }}
          data-profile-split-grip
        />
      )}
      <canvas ref={canvasRef} className="absolute inset-0 block" aria-hidden />
      {/* THE HEAD — one row: the lanes named over themselves, the tools at the
          end so a narrow lane never hides its words */}
      <div className="absolute inset-x-0 top-0 flex items-center px-2 pointer-events-none" style={{ height: HEAD_BAND }} data-profile-head>
        {showSize && (
          <span
            className={`min-w-0 flex items-center gap-2 text-[10px] text-textMuted ${bothLanes ? 'shrink-0' : 'flex-1'}`}
            /* the size lane's head sits over its lane, whatever the split */
            style={bothLanes ? { width: `calc((100% - ${COL_W}px) * ${liveSplit})` } : undefined}
            data-lane-head="size"
          >
            <Term k="Size at a strike" className="pointer-events-auto truncate">
              Size · {greek}
            </Term>
          </span>
        )}
        {showFlow && (
          <>
            <span className="shrink-0" style={{ width: COL_W }} aria-hidden />
            <span className="flex-1 min-w-0 flex items-center gap-2 text-[10px] text-textMuted pl-1" data-lane-head="flow">
              <Term k="What a move forces" className="pointer-events-auto truncate">
                What a move forces {!narrow && <span className="text-textMuted/60">· from gamma</span>}
              </Term>
            </span>
          </>
        )}
        {tools}
      </div>
      {readLine}
    </div>
  );
};

export default ProfilePanel;
