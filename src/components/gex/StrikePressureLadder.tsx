/*
==================================================
  SLAYER TERMINAL - STRIKE PRESSURE LADDER
  The heatmap's replacement (Mo, 2026-08-19: "I
  don't think we should keep a generic orange/gray
  heatmap just because every other options platform
  has one"). Every strike is a ROW; the put and call
  gamma at it are TICKS counted out from the centre
  line — one tick is a fixed sum, so $1.2B against
  $300M is counted, not estimated. Beside the rows:
  net, distance from spot, open interest, volume,
  and the part the strike plays. Spot and the flip
  run THROUGH the ladder as rules; walls, pin and
  supreme are named on their rows.

  THE SPINE (Noah, 2026-08-22): a contour drawn over
  the bars — at every row it leans toward the side
  that dominates, by that strike's net, and the rows
  join into one curve. It crosses centre at the flip
  and bulges hardest at the walls. A dashed ghost is
  the same curve at the session open; the gap between
  them, row by row, is the strike building or
  bleeding. The bars never move — they are anchored
  at centre so the legs stay comparable down the
  ladder (the first cut grew them from the bent spine
  and every row looked shoved sideways).
==================================================
*/

import React, { createContext, Fragment, useContext, useLayoutEffect, useRef, useState } from 'react';

/** A smooth open spline through points (Catmull-Rom, rendered as cubic
    Béziers). One curve for the whole ladder — the per-row quadratics met at
    corners and doubled back wherever neighbours pulled opposite ways (Noah,
    2026-08-22: "the curve is glitching"). Control x is clamped to the lane. */
const splinePath = (pts: { x: number; y: number }[], xMin: number, xMax: number): string => {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  const cx = (v: number) => Math.max(xMin, Math.min(xMax, v));
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = cx(p1.x + (p2.x - p0.x) / 6);
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = cx(p2.x - (p3.x - p1.x) / 6);
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
};
import { fmtUsd } from '../../data/gex';
import { afterGlide, onGlide, promisedWidth } from '../../core/glide';
import HoverReadout from '../ui/HoverReadout';
import SpotRule from '../ui/SpotRule';
import Term from '../ui/Term';
import { CALL_WALL, FLIP, SUPREME, PUT_WALL, alpha } from './paletteInk';
import { HEAT_MODE, heatLaneInks, heatRampColorFor, type HeatMode } from './heatmap';
import type { ExposureProfileData, StrikeExposure } from '../../types/gex';
import { Name } from '../ui/Name';

interface StrikePressureLadderProps {
  data: ExposureProfileData;
  /** Strike column in another instrument's terms (SPX / ES on index names) */
  strikeFormat?: (strike: number) => string;
  /** Rows stretch to fill the host's height instead of taking a fixed row height */
  fill?: boolean;
  /** Per strike, net gamma at the open as a ratio of now — draws the ghost spine */
  openRatio?: Map<number, number> | null;
  /** The bars' ramp — the house ember/glacier by default, or the thermal the
      Ledger and Building offer (Noah, 2026-09-08: "no in house color vs thermal") */
  mode?: HeatMode;
  /** The strike under the pointer, as it moves — the read card beside the ladder follows it (2026-09-12) */
  onPointer?: (strike: number | null) => void;
}

// The legs' inks come from the HOUSE RAMP (ember/glacier, 2026-08-29) so
// the ladder, the matrix and the partner desks all say the same thing. A
// bar is a JOURNEY now, not a fade: it travels the ramp from the spine's
// quiet dark to the color its own strength has earned — a heavy put leg
// runs oxblood → fire → gold, a light one never leaves the embers. The
// eye still catches brightness scanning the column (the ramp's luminance
// IS the strength), and length stays the number you read when you stop.
// Under the thermal ramp the same journey runs yellow → red for puts and
// yellow → blue for calls, and the words on the key follow.
const HOUSE_INKS = { put: '#F5C542', call: '#7ABDD7', words: 'gold amplifies, ice absorbs · longer and hotter is heavier' }; // the ember pole; a readable mid-glacier step
const inksFor = (mode: HeatMode) => {
  if (mode === HEAT_MODE) return HOUSE_INKS;
  const { pos, neg } = heatLaneInks(mode, 0.78);
  return { put: pos, call: neg, words: mode === 'thermal-yellow' ? 'red amplifies, blue absorbs · longer and hotter is heavier' : 'warm amplifies, cool absorbs · longer and hotter is heavier' };
};
const rampCss = (side: 'put' | 'call', t: number, mode: HeatMode) => {
  const [r, g, b] = heatRampColorFor(side === 'put' ? 1 : -1, t, mode);
  return `rgb(${r},${g},${b})`;
};
/** The bar's surface: the ramp from the spine (t=0) out to the tip (t=strength). */
const legGradient = (side: 'put' | 'call', s: number, mode: HeatMode) =>
  `linear-gradient(to ${side === 'put' ? 'left' : 'right'}, ${rampCss(side, 0, mode)}, ${rampCss(side, s / 3, mode)}, ${rampCss(side, (2 * s) / 3, mode)}, ${rampCss(side, s, mode)})`;
/** The ramp in hand, read by the legs and the card without threading a prop through every row */
const ModeCtx = createContext<HeatMode>(HEAT_MODE);
const useMode = () => useContext(ModeCtx);

/** Below this width the OI / volume / role columns fold away — the bars are
    the point, and they must never shrink to slivers to keep a caption. */
const COMPACT_BELOW = 820;
/** Below this the net column and the legs' figures go too (a docked Terrain
    pane's rail, four charts up — Noah, 2026-09-12: "depending if someone has
    4 charts or 1 you can remove the net old volume and xyz"); the hover card
    still prints every figure */
const TIGHT_BELOW = 420;
/** Below this only the strike and the bars remain — the narrowest the rail is drawn */
const BARE_BELOW = 280;
/** The spine may lean this far from centre, in % of the bars lane, either way */
const MAX_LEAN = 22;
/** Room kept at each lane end for the leg's figure (11px mono, up to "$999.9M") */
const FIGURE_W = 60;

const fmtStrikeDefault = (v: number) => (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2));
const fmtDist = (pct: number) => {
  const d = Math.abs(pct) < 0.005 ? 0 : pct;
  return `${d > 0 ? '+' : ''}${d.toFixed(2)}%`;
};
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

type Role = { label: string; color: string };

/** One legend entry: a swatch, the NAME bright, the meaning in plain words —
    the strip has to be readable at a glance, not decoded (Noah, 2026-08-22:
    "I need more visibility"). */
const LegendItem = ({ glyph, name, text, compact }: { glyph: React.ReactNode; name: React.ReactNode; text: string; compact: boolean }) => (
  <span className="inline-flex items-center gap-1.5 whitespace-nowrap" title={compact ? text : undefined}>
    {glyph}
    <span className="font-semibold uppercase tracking-wide text-textPrimary">{name}</span>
    {/* Narrow panels keep the name and carry the meaning on hover — a key
        that wraps to three lines eats the ladder it explains */}
    {!compact && <span className="text-textSecondary">{text}</span>}
  </span>
);

/** The tail's ink — the house attention colour; neither side's market colour */
const TAIL = 'rgb(var(--warn))';
/** A strike this far from spot is "far" — the day's fight is inside it */
const TAIL_DIST_PCT = 3;

/* When a strike plays SEVERAL parts, only the first keeps its word — the
   rest compress to the house initials, and the cell clips as a hard floor
   (Noah, 2026-08-30: "the supreme node word is bleeding out of its
   container" — SUPREME + PUT WALL on one strike overran the lane). */
const SHORT_ROLE: Record<string, string> = {
  SUPREME: 'SUP',
  'CALL WALL': 'CW',
  'PUT WALL': 'PW',
  TAIL: 'TAIL',
  PIN: 'PIN',
};

/** The part a strike plays, in the order that matters if it plays several. */
const rolesOf = (row: StrikeExposure, levels: ExposureProfileData['levels'], tails: Set<number>): Role[] => {
  const out: Role[] = [];
  if (row.strike === levels.supreme) out.push({ label: 'SUPREME', color: SUPREME });
  if (row.strike === levels.callWall) out.push({ label: 'CALL WALL', color: CALL_WALL });
  if (row.strike === levels.putWall) out.push({ label: 'PUT WALL', color: PUT_WALL });
  if (tails.has(row.strike)) out.push({ label: 'TAIL', color: TAIL });
  if (row.pin) out.push({ label: 'PIN', color: 'rgb(var(--text-primary))' });
  return out;
};

/** TAIL strikes (Skylit's "hedge node", in our words): far from spot, and
    carrying outsized gamma against their own neighbourhood — protective
    positioning that only matters if the tape gets there, or when it builds
    fast on a news day. Named only when it actually exists. */
const findTails = (strikes: StrikeExposure[], spot: number, maxNet: number): Set<number> => {
  const out = new Set<number>();
  strikes.forEach((s, i) => {
    const dist = Math.abs((s.strike - spot) / spot) * 100;
    if (dist < TAIL_DIST_PCT) return;
    const mag = Math.abs(s.gex.net);
    if (mag < 0.2 * maxNet) return;
    const neighbours = [i - 2, i - 1, i + 1, i + 2].map(j => strikes[j]).filter(Boolean);
    if (neighbours.length === 0) return;
    const around = neighbours.reduce((a, n) => a + Math.abs(n.gex.net), 0) / neighbours.length;
    if (mag >= 2 * Math.max(around, 1)) out.add(s.strike);
  });
  return out;
};

/** The flip's rule — the pill CENTRED on a dashed line to both edges (the spot rule's placement, 2026-09-12) */
const FlipRule = ({ price }: { price: number }) => (
  <span className="flex items-center gap-1.5 select-none" aria-label={`gamma flip ${price.toFixed(2)}`} data-flip-rule>
    <span className="h-px flex-1 border-t border-dashed" style={{ borderColor: alpha(FLIP, 0.6) }} />
    <span className="font-mono text-[9px] uppercase tracking-wider whitespace-nowrap" style={{ color: FLIP }}>
      flip
    </span>
    <span
      className="inline-flex items-center rounded-[3px] px-1.5 py-px font-mono text-[10px] font-bold tnum text-[#0a0a0a] whitespace-nowrap"
      style={{ background: FLIP }}
    >
      {price.toFixed(2)}
    </span>
    <span className="h-px flex-1 border-t border-dashed" style={{ borderColor: alpha(FLIP, 0.6) }} />
  </span>
);

/** A leg: a solid bar from the centre line, length AND brightness carrying the
    amount. `side` is the direction it grows. */
/** A gradient cannot be transitioned, so a bar carries BOTH ramps and
    crossfades between them when the Colours card changes (Noah, 2026-09-08:
    "change between color for the ladder should be smooth") */
const RAMP_PAIR: [HeatMode, HeatMode] = [HEAT_MODE, 'thermal-yellow'];
const Ramps = ({ side, strength, mode, rounded }: { side: 'put' | 'call'; strength: number; mode: HeatMode; rounded: string }) => (
  <>
    {RAMP_PAIR.map(m => (
      <span
        key={m}
        aria-hidden="true"
        className={`absolute inset-0 transition-opacity duration-700 ${rounded}`}
        style={{ background: legGradient(side, strength, m), opacity: (m === mode || (!RAMP_PAIR.includes(mode) && m === HEAT_MODE)) ? 1 : 0, transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
      />
    ))}
  </>
);

const LegBar = ({ px, strength, side }: { px: number; strength: number; side: 'put' | 'call' }) => {
  const mode = useMode();
  const rounded = side === 'put' ? 'rounded-l-[2px]' : 'rounded-r-[2px]';
  return (
    <span
      aria-hidden="true"
      data-leg={side}
      className={`absolute top-1/2 -translate-y-1/2 h-[9px] overflow-hidden transition-[width] duration-700 ${rounded}`}
      style={{
        ...(side === 'put' ? { right: '50%' } : { left: '50%' }),
        width: px,
        transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <Ramps side={side} strength={strength} mode={mode} rounded={rounded} />
    </span>
  );
};

const StrikePressureLadder = ({ data, strikeFormat = fmtStrikeDefault, fill = false, openRatio = null, mode = HEAT_MODE, onPointer }: StrikePressureLadderProps) => {
  const { ticker, strikes, levels, spotAfterIndex } = data;
  const inks = inksFor(mode);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const laneRef = useRef<HTMLSpanElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const rowLaneRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [compact, setCompact] = useState(false);
  const [tight, setTight] = useState(false);
  const [bare, setBare] = useState(false);
  /* null until measured (2026-09-06, the perf sweep): the legs and their
     figures mount at their real length on the second frame instead of
     transitioning from a guessed one, and the measure itself waits for
     that frame — read inside the commit it forced the desk's whole first
     layout early, 21–29ms of every open on the profiler. */
  const [laneW, setLaneW] = useState<number | null>(null);
  /* The list's inner height, so fill-mode rows can be given EXPLICIT heights
     — flex-sized rows re-flow in one frame; a px height can glide (Noah,
     2026-08-22: "make the transition between 10, 15, 20 smooth"). */
  const [listH, setListH] = useState(0);
  /* The hover read-out — the house floating card, not the browser's title
     tooltip (Noah, 2026-08-22: "looks like old school html"). Follows the
     pointer; pointer events pass through it. */
  const [hover, setHover] = useState<{ row: StrikeExposure; x: number; y: number } | null>(null);
  /* The contour's geometry: each row's lane centre (y) and the lane's x
     range, measured in the list's own coordinates (scroll included) so one
     SVG over the list can draw the whole curve. */
  const [geom, setGeom] = useState<{ ys: number[]; laneLeft: number; laneWidth: number; width: number; height: number } | null>(null);
  /** The last row count and list height the measure saw — a change means a glide */
  const shapeRef = useRef('');

  // The column set and the lane's tick capacity follow the host's REAL width,
  // not the viewport's — a panel on a desk can be narrow on a wide screen.
  // Measured NOW for the first paint (observer notifications arrive in the
  // render step, which a background tab may not run), then tracked.
  useLayoutEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const read = () => {
      const w = el.clientWidth;
      setCompact(w < COMPACT_BELOW);
      setTight(w < TIGHT_BELOW);
      setBare(w < BARE_BELOW);
      if (laneRef.current) setLaneW(laneRef.current.clientWidth);
    };
    const first = requestAnimationFrame(read);
    /* Not per frame of a sidebar glide — once, when it ends (core/glide.ts) —
       or, when the host has promised where it is going (the desk's tiles,
       2026-09-12), once at the START for that width, so the lane already fits
       the destination and nothing changes when the frame stops */
    const ro = new ResizeObserver(() => afterGlide(read));
    ro.observe(el);
    const off = onGlide(
      () => {
        const hostTo = promisedWidth(el);
        const laneTo = laneRef.current ? promisedWidth(laneRef.current) : null;
        if (hostTo != null) {
          setCompact(hostTo < COMPACT_BELOW);
          setTight(hostTo < TIGHT_BELOW);
          setBare(hostTo < BARE_BELOW);
        }
        if (laneTo != null) setLaneW(laneTo);
      },
      () => undefined
    );
    return () => {
      cancelAnimationFrame(first);
      ro.disconnect();
      off();
    };
  }, []);

  // Measure the rows for the contour — synchronously after layout, again
  // whenever the list resizes, and EVERY FRAME while a window change is
  // gliding the rows to their new heights, so the spine rides the rows
  // instead of snapping ahead of them.
  const ROW_GLIDE_MS = 500;
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = () => {
      setListH(list.clientHeight);
      const lr = list.getBoundingClientRect();
      const lanes = rowLaneRefs.current.slice(0, strikes.length);
      const first = lanes.find(Boolean);
      if (!first) return;
      const fr = first.getBoundingClientRect();
      const ys = lanes.map(el => {
        if (!el) return 0;
        const r = el.getBoundingClientRect();
        return r.top - lr.top + list.scrollTop + r.height / 2;
      });
      const next = { ys, laneLeft: fr.left - lr.left, laneWidth: fr.width, width: list.clientWidth, height: list.scrollHeight };
      /* Only a CHANGED geometry re-renders (2026-09-06, the perf sweep): a
         window or sidebar width glide fires this every frame, and a render
         per frame that lands the same numbers is a layout thrash for nothing. */
      setGeom(prev => {
        if (
          prev &&
          prev.laneLeft === next.laneLeft &&
          prev.laneWidth === next.laneWidth &&
          prev.width === next.width &&
          prev.height === next.height &&
          prev.ys.length === next.ys.length &&
          prev.ys.every((y, i) => Math.abs(y - next.ys[i]) < 0.5)
        )
          return prev;
        return next;
      });
    };
    /* ONE MEASURE PER FRAME, AT MOST (2026-09-06, the perf sweep): the
       observer fires on every frame of a width glide (the sidebar folding,
       a window drag) and the follow loop below fired on top of it — the
       profiler put 115ms of a 300ms sidebar fold inside this one function,
       each call forcing a fresh layout. Now every request coalesces into the
       next animation frame, and the follow loop runs only in fill mode,
       where rows really do glide to new heights. */
    let pending = 0;
    let raf = 0;
    const started = performance.now();
    const schedule = () => {
      if (pending) return;
      pending = requestAnimationFrame(() => {
        pending = 0;
        measure();
      });
    };
    /* The follow loop only when the rows are actually gliding: a new row
       count or a new list height in fill mode. A scan that swaps the strike
       array for one the same size moves nothing, and the desk used to spend
       33 measured frames on every one of them. */
    const settleShape = () => {
      const shape = `${fill ? 1 : 0}|${strikes.length}|${list.clientHeight}`;
      const gliding = fill && shapeRef.current !== '' && shapeRef.current !== shape;
      shapeRef.current = shape;
      if (!gliding) return;
      const follow = () => {
        measure();
        if (performance.now() - started < ROW_GLIDE_MS + 50) raf = requestAnimationFrame(follow);
      };
      raf = requestAnimationFrame(follow);
    };
    /* THE FIRST MEASURE — AND THE HEIGHT THE SHAPE READS — A FRAME LATER,
       never inside the commit (2026-09-06, the perf sweep): read there they
       forced the whole page's layout on every tick that swapped the strike
       array, 68ms of a desk's open on the profiler and a slice of every
       idle second. A frame on, the browser has laid the page out anyway,
       and the contour is a hairline nobody misses for sixteen milliseconds. */
    pending = requestAnimationFrame(() => {
      pending = 0;
      settleShape();
      measure();
    });
    /* And not at all while the frame glides: the sidebar folding fired this
       on every one of its eighteen frames, each a forced layout of every
       row. The contour keeps its last geometry for the 300ms and takes one
       measure when the glide ends (core/glide.ts). */
    const ro = new ResizeObserver(() => afterGlide(schedule));
    ro.observe(list);
    const onEnd = (e: TransitionEvent) => {
      if (e.propertyName === 'height') schedule();
    };
    list.addEventListener('transitionend', onEnd);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
      cancelAnimationFrame(pending);
      list.removeEventListener('transitionend', onEnd);
    };
  }, [strikes, compact, tight, bare, laneW, fill, spotAfterIndex]);

  // One scale for BOTH legs — the bars are comparable across the centre line.
  // The biggest leg reaches the lane's end minus its figure; the rest scale.
  const maxLeg = strikes.reduce((m, s) => Math.max(m, Math.abs(s.gex.put), Math.abs(s.gex.call)), 1);
  const maxNet = strikes.reduce((m, s) => Math.max(m, Math.abs(s.gex.net)), 1);
  const reach = laneW === null ? 0 : Math.max(24, laneW / 2 - (tight ? 4 : FIGURE_W) - 6);
  const strengthOf = (v: number) => Math.abs(v) / maxLeg;
  const tails = findTails(strikes, levels.spot, maxNet);

  // Spine x per row, in % of the lane. Negative net = call-dominant = the
  // book leans toward the call side (right); positive leans left.
  const spineX = strikes.map(s => 50 - (s.gex.net / maxNet) * MAX_LEAN);
  // The ghost: the same row's net at the open, as the strike's own ratio
  // applied to its current lean — absent rows sit on the live spine.
  const ghostX = strikes.map((s, i) => {
    const r = openRatio?.get(s.strike);
    if (r == null) return spineX[i];
    return 50 - clamp(r, -1.6, 1.6) * ((s.gex.net / maxNet) * MAX_LEAN);
  });
  const hasGhost = !!openRatio && strikes.some(s => openRatio.has(s.strike));
  // The contour in list pixels: x from the row's lean, y from the measured row centre
  const toPts = (xs: number[]) =>
    geom ? xs.map((x, i) => ({ x: geom.laneLeft + (x / 100) * geom.laneWidth, y: geom.ys[i] ?? 0 })).filter(p => p.y > 0) : [];
  const spinePath = geom ? splinePath(toPts(spineX), geom.laneLeft, geom.laneLeft + geom.laneWidth) : '';
  const ghostPath = geom && hasGhost ? splinePath(toPts(ghostX), geom.laneLeft, geom.laneLeft + geom.laneWidth) : '';

  // The flip is a midpoint — it sits BETWEEN two rows (strikes descending)
  const flipDegenerate = Math.abs(levels.flip - levels.spot) < 1e-9;
  let flipAfterIndex = -2;
  if (!flipDegenerate) {
    flipAfterIndex = strikes.findIndex(
      (row, i) => row.strike >= levels.flip && (strikes[i + 1]?.strike ?? -Infinity) < levels.flip
    );
  }

  // The bars lane carries a floor in both sets — the bars are the number
  /* The figure columns hold "-$1185.8M" at 10px mono with a gutter to spare
     (Noah, 2026-09-12, the photo with the net column cut off at the edge);
     the tightest set (a docked pane's rail) keeps the strike and the bars. */
  const cols = tight
    ? bare
      ? 'grid-cols-[48px_minmax(120px,1fr)]'
      : 'grid-cols-[48px_46px_minmax(140px,1fr)]'
    : compact
      ? 'grid-cols-[52px_50px_minmax(160px,1fr)_84px]'
      : 'grid-cols-[56px_52px_minmax(240px,1fr)_92px_66px_66px_84px]';
  const cell = 'font-mono text-[10px] tnum whitespace-nowrap';
  const head = 'font-mono text-[9px] uppercase tracking-widest text-textSecondary whitespace-nowrap';
  /* Row height as a NUMBER: in fill mode the rows share the list's height
     (the rules take their own), floored at 16px so the tail scrolls; the
     height glides between window sizes. No glide until the first real
     measurement, or every mount would grow from the floor. */
  const RULE_PX = 22;
  const ruleCount = (spotAfterIndex >= -0.5 ? 1 : 0) + (flipAfterIndex >= 0 ? 1 : 0);
  const rowPx = fill ? Math.max(16, Math.floor((listH - ruleCount * RULE_PX - 2) / Math.max(1, strikes.length))) : 24;
  const rowGlide = listH > 0 ? 'transition-[height,background-color] duration-500' : 'transition-colors';

  return (
    <ModeCtx.Provider value={mode}>
    <div ref={hostRef} className="h-full min-h-0 flex flex-col">
      {/* HOW TO READ IT — at the top, where the eye lands first (Noah,
          2026-08-22: "this should be explained at the top"). */}
      {/* One line at full width (Noah, 2026-08-22) — 9px, short meanings;
          the long form lives on the term explainers. */}
      {!bare && (
      <div className="shrink-0 flex items-center gap-x-5 gap-y-1 flex-wrap px-3 py-1.5 border-b border-borderSubtle/60 font-mono text-[9px] select-none">
        <LegendItem
          glyph={
            <span className="inline-flex items-center" aria-hidden="true">
              <span className="relative inline-block w-4 h-[7px] rounded-l-[2px] overflow-hidden">
                <Ramps side="put" strength={1} mode={mode} rounded="rounded-l-[2px]" />
              </span>
              <span className="relative inline-block w-4 h-[7px] rounded-r-[2px] overflow-hidden">
                <Ramps side="call" strength={1} mode={mode} rounded="rounded-r-[2px]" />
              </span>
            </span>
          }
          name={
            <>
              <Term k="Puts">Puts</Term> · <Term k="Calls">Calls</Term>
            </>
          }
          text={inks.words}
          compact={compact}
        />
        <LegendItem
          glyph={<span aria-hidden="true" className="inline-block w-5 h-[2px] rounded-full" style={{ background: 'rgba(237,237,237,0.9)' }} />}
          name="Solid"
          text="where the book leans now"
          compact={compact}
        />
        {hasGhost && (
          <LegendItem
            glyph={<span aria-hidden="true" className="inline-block w-5 border-t-2 border-dashed" style={{ borderColor: 'rgba(237,237,237,0.55)' }} />}
            name="Dashed"
            text="the same curve at the open"
            compact={compact}
          />
        )}
        <LegendItem
          glyph={<span aria-hidden="true" className="inline-block w-[9px] h-[9px] rounded-[2px]" style={{ background: SUPREME }} />}
          name={<span style={{ color: SUPREME }}>Supreme</span>}
          text="heaviest strike, washed across its row"
          compact={compact}
        />
        {tails.size > 0 && (
          <LegendItem
            glyph={<span aria-hidden="true" className="inline-block w-[9px] h-[9px] rounded-[2px]" style={{ background: TAIL }} />}
            name={
              <span style={{ color: TAIL }}>
                <Term k="Tail">Tail</Term>
              </span>
            }
            text="heavy gamma far from price"
            compact={compact}
          />
        )}
      </div>
      )}

      {/* Captions — one whisper row */}
      <div className={`shrink-0 grid ${cols} items-center gap-x-2 px-2 h-6 border-b border-borderSubtle bg-chip select-none`}>
        <span className={head}>Strike</span>
        {!bare && (
          <span className={`${head} text-right`}>
            <Term k="From spot">Δ spot</Term>
          </span>
        )}
        <span ref={laneRef} className={`${head} text-center text-textMuted block min-w-0`}>
          <span className="transition-colors duration-700" style={{ color: inks.put }}>◂ puts</span>
          <span className="mx-2 text-textMuted">·</span>
          <span className="transition-colors duration-700" style={{ color: inks.call }}>calls ▸</span>
        </span>
        {!tight && (
          <span className={`${head} text-right`}>
            <Term k="Net GEX">Net</Term>
          </span>
        )}
        {!compact && (
          <>
            <span className={`${head} text-right`}>
              <Term k="Open interest">OI</Term>
            </span>
            <span className={`${head} text-right`}>
              <Term k="Volume">Vol</Term>
            </span>
            <span className={`${head} text-right`}>Role</span>
          </>
        )}
      </div>

      {/* The ladder — strikes descending, spot and flip as rules between rows.
          ONE contour (and its ghost) is drawn over the whole list, so it runs
          smoothly through the rules instead of breaking at them. */}
      {/* Always scrollable: fill rows stretch when there is room and stop at
          their floor when there isn't — the tail must scroll, not vanish
          (Noah, 2026-08-22: "it cuts off after 485"). */}
      <div ref={listRef} className="relative flex-1 min-h-0 flex flex-col overflow-y-auto">
        {geom && (
          <svg
            aria-hidden="true"
            className="absolute left-0 top-0 pointer-events-none z-[1]"
            width={geom.width}
            height={geom.height}
            viewBox={`0 0 ${geom.width} ${geom.height}`}
          >
            {ghostPath && (
              <path data-ghost d={ghostPath} fill="none" stroke="rgba(237,237,237,0.35)" strokeWidth={1} strokeDasharray="3 3" />
            )}
            {spinePath && <path data-spine d={spinePath} fill="none" stroke="rgba(237,237,237,0.85)" strokeWidth={1.5} />}
          </svg>
        )}
        {spotAfterIndex === -0.5 && (
          <div className="shrink-0 px-2 py-0.5">
            <SpotRule ticker={ticker} price={levels.spot} />
          </div>
        )}
        {strikes.map((row, i) => {
          const v = row.gex.net;
          const putStrength = strengthOf(row.gex.put);
          const callStrength = strengthOf(row.gex.call);
          const putEnd = reach * putStrength;
          const callEnd = reach * callStrength;
          const distPct = ((row.strike - levels.spot) / levels.spot) * 100;
          const roles = rolesOf(row, levels, tails);
          const edge = roles[0]?.color;
          const isSupreme = row.strike === levels.supreme;
          return (
            <Fragment key={row.strike}>
              <div
                data-supreme={isSupreme || undefined}
                /* The supreme's row wears a constant magenta wash end to end
                   (Noah, 2026-08-22; the 2026-08-29 color odyssey ended
                   where it began) — the book's heaviest strike is findable
                   from across the room, not just by its tag. */
                /* Keyed by strike: a window change keeps the rows that stay
                   (they glide), and only the new strikes soft-fade in. */
                className={`relative shrink-0 grid ${cols} items-center gap-x-2 px-2 border-b border-borderSubtle/30 animate-soft-in ${rowGlide} hover:bg-ink/[0.03] ${
                  isSupreme ? 'bg-supreme/[0.09]' : row.pin ? 'bg-ink/[0.02]' : ''
                }`}
                /* Unmeasured (first paint): flex-sized like before, so the
                   first explicit height lands where the row already is — no
                   grow-from-the-floor on mount */
                style={{ height: listH > 0 ? rowPx : undefined, flex: listH > 0 ? undefined : '1 1 0%', minHeight: 16, transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
                data-strike={row.strike}
                onMouseEnter={e => {
                  setHover({ row, x: e.clientX, y: e.clientY });
                  onPointer?.(row.strike);
                }}
                onMouseMove={e => setHover({ row, x: e.clientX, y: e.clientY })}
                onMouseLeave={() => {
                  setHover(null);
                  onPointer?.(null);
                }}
              >
                {/* The part it plays, as a left edge — readable even when the
                    role column has folded away */}
                {edge && <span aria-hidden="true" className="absolute left-0 inset-y-0 w-[2px]" style={{ background: edge }} />}
                {/* Strike, distance and the leg figures wear the PRIMARY ink at
                    11px (Noah, 2026-08-22: "really muted") — the numbers a
                    trader reads must never sit in the whisper register. */}
                <span className="font-mono text-[11px] font-semibold tnum whitespace-nowrap text-textPrimary">{strikeFormat(row.strike)}</span>
                {!bare && <span className="font-mono text-[10px] tnum whitespace-nowrap text-right text-textPrimary">{fmtDist(distPct)}</span>}

                {/* THE LANE: the legs from the centre line, the leg's figure
                    riding each bar's end, and the spine contour drawn over it */}
                <span
                  ref={el => {
                    rowLaneRefs.current[i] = el;
                  }}
                  className="relative block self-stretch min-h-[14px] min-w-0"
                >
                  <span aria-hidden="true" className="absolute inset-y-0 left-1/2 w-px bg-ink/[0.08]" />
                  {/* Once the lane is measured — mounted at their real length, never transitioned from a guess */}
                  {laneW !== null && (
                    <>
                      <LegBar px={putEnd} strength={putStrength} side="put" />
                      <LegBar px={callEnd} strength={callStrength} side="call" />
                      {/* figures at the bar ends — axis labels on the bars themselves;
                          folded at the tight width, where they would sit on the bars */}
                      {!tight && (
                        <>
                          <span
                            className="absolute top-1/2 -translate-y-1/2 text-right font-mono text-[11px] font-medium tnum whitespace-nowrap text-textPrimary transition-[right] duration-700"
                            style={{ right: `calc(50% + ${putEnd + 6}px)`, transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
                          >
                            {fmtUsd(Math.abs(row.gex.put))}
                          </span>
                          <span
                            className="absolute top-1/2 -translate-y-1/2 font-mono text-[11px] font-medium tnum whitespace-nowrap text-textPrimary transition-[left] duration-700"
                            style={{ left: `calc(50% + ${callEnd + 6}px)`, transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
                          >
                            {fmtUsd(Math.abs(row.gex.call))}
                          </span>
                        </>
                      )}
                    </>
                  )}
                </span>

                {/* Sim side-coding: negative = call-dominant = absorbs (steel), positive = amplifies (gold) */}
                {!tight && (
                  <span className={`${cell} text-right font-semibold transition-colors duration-700`} style={{ color: v < 0 ? inks.call : v > 0 ? inks.put : undefined }}>
                    {fmtUsd(v)}
                  </span>
                )}
                {!compact && (
                  <>
                    <span className={`${cell} text-right text-textPrimary`}>{row.oi.toLocaleString()}</span>
                    <span className={`${cell} text-right text-textPrimary`}>{row.volume.toLocaleString()}</span>
                    <span className="flex items-center justify-end gap-1.5 min-w-0 overflow-hidden">
                      {roles.slice(0, 2).map((r, ri) => (
                        <span key={r.label} className="font-mono text-[8px] font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: r.color }}>
                          {ri === 0 ? r.label : SHORT_ROLE[r.label] ?? r.label}
                        </span>
                      ))}
                    </span>
                  </>
                )}
              </div>
              {i === spotAfterIndex && (
                <div className="shrink-0 px-2 py-0.5">
                  <SpotRule ticker={ticker} price={levels.spot} />
                </div>
              )}
              {i === flipAfterIndex && (
                <div className="shrink-0 px-2 py-0.5">
                  <FlipRule price={levels.flip} />
                </div>
              )}
            </Fragment>
          );
        })}
      </div>

      {hover && (
        <HoverReadout x={hover.x} y={hover.y}>
          <StrikeCard row={hover.row} data={data} strikeFormat={strikeFormat} maxLeg={maxLeg} openRatio={openRatio} tails={tails} />
        </HoverReadout>
      )}
    </div>
    </ModeCtx.Provider>
  );
};

/** The read-out's body: the strike and the parts it plays, both legs with
    their share of the book's heaviest leg, net, distance, OI, volume, and
    how the strike has moved since the open. Numbers in the card, never a
    sentence — this is a reading, not a read. */
const StrikeCard = ({
  row,
  data,
  strikeFormat,
  maxLeg,
  openRatio,
  tails,
}: {
  row: StrikeExposure;
  data: ExposureProfileData;
  strikeFormat: (s: number) => string;
  maxLeg: number;
  openRatio: Map<number, number> | null;
  tails: Set<number>;
}) => {
  const { levels, ticker } = data;
  const mode = useMode();
  const inks = inksFor(mode);
  const roles = rolesOf(row, levels, tails);
  const v = row.gex.net;
  const distPct = ((row.strike - levels.spot) / levels.spot) * 100;
  const ratio = openRatio?.get(row.strike);
  /* Since the open, as |net| now against |net| at the open — the same
     measure the chart's focus chip uses. A negative ratio means the strike
     changed SIDES, where a percent is nonsense (the first cut printed
     "−1291%"); a near-zero open means the gamma is new today. */
  const sinceOpen: { pct: number | null; text: string } | null =
    ratio == null
      ? null
      : ratio < 0
        ? { pct: null, text: 'flipped sides since the open' }
        : Math.abs(ratio) < 0.05
          ? { pct: null, text: 'new since the open' }
          : (() => {
              const pct = Math.max(-99, Math.min(999, (1 / Math.abs(ratio) - 1) * 100));
              return { pct, text: Math.abs(pct) < 15 ? 'about where it opened' : pct > 0 ? 'gamma building' : 'gamma bleeding' };
            })();
  const leg = (label: string, amt: number, side: 'put' | 'call') => (
    <div className="flex items-center gap-2">
      <span className="w-9 font-mono text-[9px] uppercase tracking-wider text-textSecondary">{label}</span>
      <span className="relative flex-1 h-[5px] rounded-full bg-ink/[0.06] overflow-hidden">
        <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(Math.abs(amt) / maxLeg) * 100}%`, background: legGradient(side, Math.abs(amt) / maxLeg, mode) }} />
      </span>
      <span className="w-16 text-right font-mono text-[11px] font-semibold tnum text-textPrimary">{fmtUsd(Math.abs(amt))}</span>
    </div>
  );
  return (
    <div className="flex flex-col gap-2 min-w-[236px]">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[13px] font-bold tnum text-textPrimary">
          <Name t={ticker} size={13} /> {strikeFormat(row.strike)}
        </span>
        <span className={`font-mono text-[10px] tnum ${distPct > 0 ? 'text-textSecondary' : 'text-textSecondary'}`}>{fmtDist(distPct)} from spot</span>
        <span className="ml-auto inline-flex items-center gap-1.5">
          {roles.map(r => (
            <span key={r.label} className="font-mono text-[8px] font-bold uppercase tracking-wider" style={{ color: r.color }}>
              {r.label}
            </span>
          ))}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {leg('puts', row.gex.put, 'put')}
        {leg('calls', row.gex.call, 'call')}
      </div>
      <div className="grid grid-cols-3 gap-x-3 pt-1.5 border-t border-borderSubtle/60">
        <span className="flex flex-col">
          <span className="font-mono text-[8px] uppercase tracking-widest text-textMuted">Net</span>
          <span className="font-mono text-[11px] font-semibold tnum" style={{ color: v < 0 ? inks.call : v > 0 ? inks.put : undefined }}>
            {fmtUsd(v)}
          </span>
        </span>
        <span className="flex flex-col">
          <span className="font-mono text-[8px] uppercase tracking-widest text-textMuted">Open int</span>
          <span className="font-mono text-[11px] tnum text-textPrimary">{row.oi.toLocaleString()}</span>
        </span>
        <span className="flex flex-col">
          <span className="font-mono text-[8px] uppercase tracking-widest text-textMuted">Volume</span>
          <span className="font-mono text-[11px] tnum text-textPrimary">{row.volume.toLocaleString()}</span>
        </span>
      </div>
      {sinceOpen && (
        <div className="flex items-center gap-2 pt-1.5 border-t border-borderSubtle/60">
          <span className="font-mono text-[8px] uppercase tracking-widest text-textMuted">Since open</span>
          {sinceOpen.pct != null && (
            <span className="font-mono text-[11px] tnum text-textPrimary">
              {sinceOpen.pct > 0 ? '+' : ''}
              {sinceOpen.pct.toFixed(0)}%
            </span>
          )}
          <span className="font-mono text-[9px] text-textSecondary">{sinceOpen.text}</span>
        </div>
      )}
    </div>
  );
};

export default StrikePressureLadder;
