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

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type MutableRefObject, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { Info, X } from 'lucide-react';
import Simulator from '../../core/simulator';
import Term from '../ui/Term';
import DropdownSelect, { type DropdownOption } from '../ui/DropdownSelect';
import { fmtUsd } from '../../data/gex';
import { sinceOpenRead } from '../../data/levelview';
import { fmtFlow, type FlowLadder, type FlowRung } from '../../data/hedgeFlow';
import { sessionVolumeProfile, type VolumeProfile } from '../../data/volumeProfile';
import { CALL_WALL, FLIP, PUT_WALL, SUPREME } from './palette';
import { HowSureBook } from '../levels/HowSure';
import type { Sureness } from '../../data/levelSureness';
import * as TOKEN from './paletteInk';
import { HEAT_MODE, heatCellStyle, heatRampColorFor, ladderRampT, type HeatMode } from './heatmap';
import { splinePath } from './spline';
import type { PriceProjection } from './StrikeChart';
import type { GexLevel } from '../../types/market';
import type { KeyLevels } from '../../types/gex';
import { FONT_SANS } from '../../theme/fonts';
import { readToken, useResolvedTheme } from '../../theme/theme';

export type ProfileLane = 'both' | 'size' | 'flow';
export const LANE_OPTIONS: DropdownOption<ProfileLane>[] = [
  { value: 'both', label: 'Both', hint: 'What sits at each strike, and what a move there costs, side by side' },
  { value: 'size', label: 'Size', hint: 'Only what sits at each strike' },
  { value: 'flow', label: 'Flow', hint: 'Only what a move to each strike costs' },
];
/** The Map hands ExposureLevels (with the pin); a Terrain pane hands KeyLevels (without) */
export type PanelLevels = KeyLevels & { pin?: number };
/** The narrowest the panel is drawn — the grip's floor. 180, not 132 (Noah, 2026-09-16, with
    the partner's ladder at three widths: "we should have a cutoff after a certain scaling
    becomes too minimum"): at 132 the ladder was a spine with pill legs and printed nothing. */
export const PROFILE_MIN_W = 180;
/** THE REST WIDTH (the same day: "open the rail wider by rest and only fall to the floor on a
    four-up") — by the desk's pane count, since the panes' widths follow it: one pane or the
    fullscreen pane 520 (the top tier: the dollars at the tips, the Δ column, the key), two or
    four panes (two columns either way) 340, three across 240. The 60% ceiling of the pane
    still holds above it. */
export const profileRestWidth = (panes: number, expanded: boolean): number => (expanded || panes === 1 ? 520 : panes === 3 ? 240 : 340);
/** THE TIERS (the partner's ladder drops its columns as it narrows; ours too): full — the Δ
    column, the key, the dollars past the tips when the lane has room; mid — the Δ column and
    a short key; thin — the strike and the legs alone. Below full, the hover card carries
    the figures the rows cannot print. */
export type ProfileTier = 'full' | 'mid' | 'thin';
export const profileTier = (panelW: number): ProfileTier => (panelW >= 440 ? 'full' : panelW >= 300 ? 'mid' : 'thin');

/* THE CALENDAR'S THERMAL RAMP (Noah, 2026-09-06: "go build the thermal
   capsules") — the same cells the Exposure Ledger under this map wears, so a
   strike reads the same colour above and below: pale yellow balanced, orange
   to deep red where hedging amplifies, sky to deep blue where it absorbs;
   the ink chosen by contrast (black on the yellow middle, white at the deep
   ends). Solid, never translucent — a low-alpha warm over black goes khaki. */
const heatOn = (value: number, maxAbs: number, mode: HeatMode, paper = false) => {
  const s = heatCellStyle(value, maxAbs, mode, paper);
  return { fill: String(s.backgroundColor ?? '#FFFFBF'), ink: String(s.color ?? '#0a0a0a') };
};
/* THE SIZE LANE IS THE LADDER (Noah, 2026-09-13, with the strike ladder's
   screenshot: "I would like this ladder to be our new size strike ladder…
   keep the flow section and let the page have both thermal and the house
   colours"): one row per strike, the put leg growing LEFT from a centre line
   and the call leg growing RIGHT, each a journey along the ramp from the
   centre's quiet to the colour its own strength earns, the figure past each
   tip, and THE SPINE — one curve through the rows leaning toward the side
   that dominates by the strike's net, its dashed ghost the same curve at the
   open. Drawn on the canvas at the chart's own rows, so it still lines up
   with the price axis the way the capsules did. */
export type ProfilePalette = 'thermal' | 'house';
export const PALETTE_OPTIONS: DropdownOption<ProfilePalette>[] = [
  { value: 'thermal', label: 'Thermal', hint: 'Yellow in the middle, red where hedging amplifies a move, blue where it absorbs one' },
  { value: 'house', label: 'House', hint: 'Gold where hedging amplifies, ice where it absorbs' },
];
const modeOf = (p: ProfilePalette): HeatMode => (p === 'house' ? HEAT_MODE : 'thermal-yellow');
/** The spine may lean this far from the centre line, as a share of half the lane, either way */
const MAX_LEAN = 0.44;
/** Room kept at each end of the lane for a leg's figure; under it the figures wait for the read line */
const LEG_FIG_W = 40;
const SILVER = '#C7D3E8';
const INK = '#ededed';
const INK_2 = '#a3a3a3';
const INK_3 = '#7d7d7d';

/** The band the head owns — no row is drawn in it */
const HEAD_TOP = 30;
/** The head on TWO ROWS below the full tier (2026-09-16: the view tabs and the host's Expiry
    card on the first, the lane tools on the second — one row cannot hold them all at 340) */
const HEAD_TOP_2 = 56;
/** The key under the head (the full and mid tiers): what the ramp, the spine, the ghost and the
    magenta mean — one line, drawn on the canvas */
const KEY_BAND = 16;
/** The column heads over the rows (every tier — the partner's header: STRIKE · Δ SPOT · ◂ PUTS ·
    CALLS ▸, and NET on the net view), drawn on the canvas */
const COL_HEAD = 15;
/** The lane the ▼ count sits in */
const FOOT_BAND = 14;
/** …and the line the ▲ count sits on, under the column heads */
const COUNT_BAND = 13;
/** The strike column between the lanes — and the wider one that carries the Δ from spot beside
    the strike (the full and mid tiers) */
const COL_W = 60;
const COL_W_WIDE = 96;
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

/* the figures' voice — Helvetica's digits are tabular (theme/fonts.ts) */
const FIG = FONT_SANS;
const SANS = FONT_SANS;

const fmtStrike = (v: number) => (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2));
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

/* THE CANVAS'S INKS FOLLOW THE PANE'S GROUND (the owner, 2026-10-02, with the light Terrain: "the terrain still has
   one black one white fix that"). A pane's chart wears its own theme's ground (Stone is light, the page's default on
   paper), but the ladder beside it was drawn black on every ground — on the light page every pane was a white tape
   beside a black ladder. The ladder is the pane's chrome, so it wears the ground the chart's strips wear: on a DARK
   ground the inks below, exactly as they were; on a LIGHT ground the chart's light set, read as TOKENS off the panel's
   own box (the pane carries data-chart-frame — index.css) — dark inks, hairlines and washes in ink alpha, the deep
   level inks, and the paper ramps (heatmap.ts `paper`) for the legs, the dashes and the capsules. */
interface PanelInks {
  ink: string;
  ink2: string;
  ink3: string;
  silver: string;
  silverSoft: string;
  callWall: string;
  putWall: string;
  supreme: string;
  supremeWash: string;
  flipRule: string;
  /** the flip's caption — on the light set the flip's own grey is 4.1:1 at 9px, so its words take the muted ink */
  flipText: string;
  hoverWash: string;
  headRule: string;
  colGround: string;
  divider: string;
  edge: string;
  grid: string;
  spotRule: string;
  spine: string;
  ghost: string;
  keyGhost: string;
  silFill: string;
  silStroke: string;
  /** the Vol underlay's neutral steel at an alpha */
  vol: (a: number) => string;
  /** the VPOC's word over it */
  volText: string;
  /** a level chip's ground, under its ink's wash */
  chipGround: string;
  spotChip: string;
  spotChipText: string;
  markFill: string;
  /** one of the inks above at an alpha */
  alpha: (c: string, a: number) => string;
}
const DARK_INKS: PanelInks = {
  ink: INK,
  ink2: INK_2,
  ink3: INK_3,
  silver: SILVER,
  silverSoft: rgba(SILVER, 0.6),
  callWall: CALL_WALL,
  putWall: PUT_WALL,
  supreme: SUPREME,
  supremeWash: rgba(SUPREME, 0.13),
  flipRule: rgba(FLIP, 0.7),
  flipText: rgba(FLIP, 0.9),
  hoverWash: 'rgba(255,255,255,0.04)',
  headRule: 'rgba(255,255,255,0.06)',
  colGround: 'rgba(255,255,255,0.025)',
  divider: 'rgba(255,255,255,0.08)',
  edge: 'rgba(255,255,255,0.14)',
  grid: 'rgba(255,255,255,0.05)',
  spotRule: 'rgba(237,237,237,0.3)',
  spine: 'rgba(237,237,237,0.85)',
  ghost: 'rgba(237,237,237,0.35)',
  keyGhost: 'rgba(237,237,237,0.4)',
  silFill: 'rgba(255,255,255,0.04)',
  silStroke: 'rgba(255,255,255,0.10)',
  vol: a => `rgba(226,234,244,${a})`,
  volText: 'rgba(226,234,244,0.55)',
  chipGround: '#0a0a0a',
  spotChip: INK,
  spotChipText: '#0a0a0a',
  markFill: '#0e0e0f',
  alpha: rgba,
};
/** The light set, read off the panel's box — resolved when the ground or the page's theme changes, never per frame */
const lightInks = (el: Element): PanelInks => {
  const t = (name: string, a?: number) => readToken(name, a, el);
  return {
    ink: t('--text-primary'),
    ink2: t('--text-secondary'),
    ink3: t('--text-muted'),
    silver: t('--silver'),
    silverSoft: t('--silver', 0.6),
    callWall: t('--bull'),
    putWall: t('--bear'),
    supreme: t('--supreme'),
    /* 0.09: the supreme's own magenta label on its row stays 4.5:1 on the light page's panel */
    supremeWash: t('--supreme', 0.09),
    flipRule: t('--flip', 0.85),
    flipText: t('--text-muted'),
    hoverWash: t('--ink', 0.05),
    headRule: t('--ink', 0.1),
    colGround: t('--ink', 0.035),
    divider: t('--ink', 0.1),
    edge: t('--ink', 0.16),
    grid: t('--ink', 0.07),
    spotRule: t('--text-primary', 0.4),
    spine: t('--text-primary', 0.85),
    ghost: t('--text-primary', 0.4),
    keyGhost: t('--text-primary', 0.45),
    silFill: t('--ink', 0.05),
    silStroke: t('--ink', 0.16),
    vol: a => t('--silver', a),
    /* the steel at 0.55 is 2.9:1 on the light panel; at 0.85 it reads (5.9:1) */
    volText: t('--silver', 0.85),
    chipGround: t('--panel'),
    spotChip: t('--text-primary'),
    /* a chip filled with the primary ink takes the panel for its words (the theme rules) */
    spotChipText: t('--panel'),
    markFill: t('--panel'),
    alpha: TOKEN.alpha,
  };
};

interface ProfilePanelProps {
  /** Every strike in the window, ascending, the chosen greek's net parked there */
  rows: GexLevel[];
  /** The largest |value| in the window — the size lane's scale */
  maxAbs: number;
  /** Per strike, the put and call hedging behind the net — the ladder's two legs. Omitted, the
      net alone is drawn as one leg on its side. */
  legs?: ReadonlyMap<number, { put: number; call: number }>;
  /** Per strike, the net at the open as a ratio of now — the spine's dashed ghost */
  openRatio?: ReadonlyMap<number, number> | null;
  /** The ramp the legs and the flow wear — the thermal by default, or the house gold and
      ice. The host's choice (Terrain's desk bar carries the card: a rail's head is 132px
      on a three-up desk and cannot hold another card). */
  palette?: ProfilePalette;
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
  /** The width the host rests this panel at (`profileRestWidth`) — the grip's double-click
      goes back to it, not to the floor */
  restWidth?: number;
  /** A card the host stands in the head beside the view tabs (Terrain's Expiry, 2026-09-16:
      "the expiry should be at the top next to the ladder and net buttons") */
  headCard?: ReactNode;
  /** The most of the surface the panel may take (0.6 by default) — a host with panes beside it passes less, so the
      chart keeps its share (Terrain at three and four panes: 0.4) */
  maxShare?: number;
  /** Given, the head carries an × — a panel you can turn on from a toolbar and
      not off from itself is a panel that feels stuck to the page. */
  onClose?: () => void;
  closeHint?: string;
  /** The ground of the chart beside it (candleTheme.ts chartGround — the pane's own theme): the panel is drawn on it.
      Omitted, dark. */
  ground?: 'light' | 'dark';
  /** HOW SURE THE LEVELS ARE (data/levelSureness.ts, the ideas' rank 3 — Pinpoint's door, 2026-10-10): given, the head
      carries one "How sure" door that reads the walls and the flip each way */
  sure?: Sureness[];
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
  rows, maxAbs, legs, openRatio = null, palette = 'thermal', step, levels, flow, lane, onLane, greek, words = { pos: 'amplifies', neg: 'absorbs' }, focusPrice, onSelect, projection, onGuide, guideOpen = false,
  ticker, width, onWidth, restWidth, headCard, onClose, closeHint = 'Hide this panel', ground = 'dark', className = '', maxShare = 0.6, sure,
}: ProfilePanelProps) => {
  const mode = modeOf(palette);
  /* ON A LIGHT GROUND the ramps are the paper ramps (heatmap.ts) and the canvas's inks the light set's tokens */
  const paper = ground === 'light';
  const thermal = (value: number, max: number) => heatOn(value, max, mode, paper);
  const rootRef = useRef<HTMLDivElement | null>(null);
  /* the canvas's inks, re-read off the box when the ground or the page's theme changes (the light page lifts the
     light set — index.css) */
  const pageTheme = useResolvedTheme();
  const inksRef = useRef<PanelInks>(DARK_INKS);
  useEffect(() => {
    inksRef.current = paper && rootRef.current ? lightInks(rootRef.current) : DARK_INKS;
  }, [paper, pageTheme]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const placedRef = useRef<Placed[]>([]);
  const [hover, setHover] = useState<Hover | null>(null);
  /* THE VIEW of the size lane (Noah, 2026-09-16, on the partner's Net tab: "I actually like his
     net gamma mini bars, they do read, just change their colors"): the ladder — the legs and the
     spine — or the net: each strike's net as a figure and a row of dashes, one per tenth of the
     largest net on screen, walking the ramp the legs wear (ember where hedging amplifies, glacier
     where it absorbs). */
  const [view, setView] = useState<'ladder' | 'net'>('ladder');
  /* where the rows start this frame — the head, plus the key when it is drawn */
  const headBandRef = useRef(HEAD_TOP);
  /* whether the rows PRINT their figures this frame — the card carries them only when they
     cannot (the partner's rule: the card once the numbers no longer fit) */
  const figuresRef = useRef(true);
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
  const maxW = hostW > 0 ? Math.max(PROFILE_MIN_W, Math.round(hostW * maxShare)) : Number.POSITIVE_INFINITY;
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
    const max = Math.max(PROFILE_MIN_W, Math.round(host * maxShare));
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
    const lanesW = Math.max(1, root.getBoundingClientRect().width - colW);
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
  /* THE PALETTE GLIDE (Noah, 2026-09-16: "have the thermal to house transition of coloring be
     smooth, right now it just changes really quickly"): the loop paints every colour as a MIX of
     the ramp it is leaving and the ramp it is going to, the mix gliding 0 → 1 on the capsules'
     own time constant (~330ms to settle). Each ramp is read on its own magnitude curve and the
     two RESULTS are mixed, so a cell never crosses a curve neither ramp has. Turned back
     mid-glide, the mix simply reverses from where it stands. */
  const paletteRef = useRef<{ from: HeatMode; to: HeatMode; mix: number }>({ from: mode, to: mode, mix: 1 });
  useEffect(() => {
    const pal = paletteRef.current;
    if (pal.to === mode) return;
    if (pal.from === mode && pal.mix < 1) {
      pal.from = pal.to;
      pal.to = mode;
      pal.mix = 1 - pal.mix;
    } else {
      pal.from = pal.to;
      pal.to = mode;
      pal.mix = 0;
    }
    settledRef.current = false;
  }, [mode]);
  useEffect(() => {
    dataRev.current++;
  }, [rows, maxAbs, legs, openRatio, mode, step, levels, flow, lane, focusPrice, vp, view, paper, pageTheme]);

  const showSize = lane !== 'flow';
  const showFlow = lane !== 'size';
  const bothLanes = showSize && showFlow;
  /* the lanes' split — the reader's, live while the sash is in hand */
  const split = useSplitPref();
  const [dragSplit, setDragSplit] = useState<number | null>(null);
  const liveSplit = dragSplit ?? split;
  /* THE TIER, for the head, the sash and the card — the draw loop reads the same rule off its
     own width each frame */
  const panelW = foot?.w ?? 0;
  const tier = profileTier(panelW);
  const colW = tier === 'thin' ? COL_W : COL_W_WIDE;

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
      /* THE TIER this frame, off the panel's own width: the column's width, and whether the key
         is drawn under the head (the ladder view, above thin) — the rows start under both */
      const tierNow = profileTier(W);
      const colW = tierNow === 'thin' ? COL_W : COL_W_WIDE;
      const keyOn = showSize && tierNow !== 'thin';
      const headTop = tierNow === 'full' ? HEAD_TOP : HEAD_TOP_2;
      const HEAD_BAND = headTop + (keyOn ? KEY_BAND : 0) + COL_HEAD;
      headBandRef.current = HEAD_BAND;
      /* Ease one capsule toward its target length and colour; says whether it got there */
      const anim = animRef.current;
      const touched = new Set<string>();
      let settled = true;
      /* THE PALETTE'S MIX THIS FRAME — every colour below reads `ramp` and `heat`, never a mode */
      const pal = paletteRef.current;
      if (pal.mix < 1) {
        pal.mix += (1 - pal.mix) * k;
        if (pal.mix > 0.995) pal.mix = 1;
        else settled = false;
      }
      type Rgb = [number, number, number];
      const mixRgb = (a: Rgb, b: Rgb): Rgb => [Math.round(a[0] + (b[0] - a[0]) * pal.mix), Math.round(a[1] + (b[1] - a[1]) * pal.mix), Math.round(a[2] + (b[2] - a[2]) * pal.mix)];
      const ramp = (sign: 1 | -1, t: number): Rgb =>
        pal.mix >= 1 ? heatRampColorFor(sign, t, pal.to, paper) : mixRgb(heatRampColorFor(sign, t, pal.from, paper), heatRampColorFor(sign, t, pal.to, paper));
      /* THE LADDER'S STRETCH of a ramp — the legs, the key's swatches, a leg leaving: on paper the window the house's
         ladders on paper read (heatmap.ts PAPER_WINDOW: quiet colour to the deep pole, never the grey); on a dark
         ground the whole ramp, as it always was */
      const legRamp = (sign: 1 | -1, t: number): Rgb => ramp(sign, paper ? ladderRampT(sign, t, pal.to, true) : t);
      /* THE INKS this frame (PanelInks above) */
      const ink = inksRef.current;
      const rgbOf = (fill: string): Rgb => {
        const m = /(\d+),\s*(\d+),\s*(\d+)/.exec(fill);
        return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [255, 255, 191];
      };
      const heat = (value: number, max: number) => {
        const to = heatOn(value, max, pal.to, paper);
        if (pal.mix >= 1) return to;
        const from = heatOn(value, max, pal.from, paper);
        const [rr, gg, bb] = mixRgb(rgbOf(from.fill), rgbOf(to.fill));
        return { fill: `rgb(${Math.round(rr)},${Math.round(gg)},${Math.round(bb)})`, ink: pal.mix >= 0.5 ? to.ink : from.ink };
      };
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

      /* THE LANES. THE COLUMN COMES FIRST when only the size lane draws (Noah, 2026-09-16: "I
         want his layout verbatim, just with our colors" — the partner's STRIKE · Δ SPOT at the
         left, the lane after); with both lanes it stands between them as before. */
      const both = showSize && showFlow;
      const colFirst = showSize && !showFlow;
      /* the size lane takes its share of the two, the flow lane the rest */
      const sizeW = both ? Math.round((W - colW) * liveSplit) : W - colW;
      const sizeL = showSize ? (colFirst ? colW : 0) : -1;
      const sizeR = showSize ? (colFirst ? W : sizeW) : -1;
      const colL = colFirst ? 0 : showSize ? sizeW : 0;
      const colR = colL + colW;
      const flowL = showFlow ? colR : -1;
      const flowR = showFlow ? W : -1;
      /* THE LADDER'S NET COLUMN at the lane's right edge (the partner's wide row: STRIKE · Δ ·
         legs · NET) when the lane has the room */
      const netCol = view === 'ladder' && showSize && sizeR - sizeL >= 300 ? 60 : 0;

      /* THE ROWS on screen, and the ones culled above and below */
      const barH = Math.max(4, Math.min(22, Math.round(pitch * 0.62)));
      const half = barH / 2;
      const placed: Placed[] = [];
      let above = 0;
      let below = 0;
      /* THE ▲ COUNT HAS A LINE OF ITS OWN (the audit's TE-4: "▲ 21" sat on the 486/487 labels): the first row starts
         under it, as the last ends over the ▼ count's foot band */
      const ROWS_TOP = HEAD_BAND + COUNT_BAND;
      for (const r of rows) {
        const y = p.yFor(r.strike);
        if (y == null || !Number.isFinite(y)) continue;
        if (y - half < ROWS_TOP) {
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
          ctx.fillStyle = ink.hoverWash;
          ctx.fillRect(0, row.y - pitch / 2, W, pitch);
        }
      }
      /* THE SUPREME'S ROW washed in its magenta across the panel (the partner's row) */
      {
        const row = placed.find(r => near(r.strike, levels.supreme));
        if (row) {
          ctx.fillStyle = ink.supremeWash;
          ctx.fillRect(0, row.y - pitch / 2, W, pitch);
        }
      }

      /* THE KEY under the head (the full and mid tiers, the ladder view): the ramp's two poles
         with their words, the spine, the ghost at the open, the supreme's magenta */
      if (keyOn) {
        const ky = headTop + KEY_BAND / 2 + 0.5;
        let kx = 8;
        const swatch = (sign: 1 | -1, w: number) => {
          const g = ctx.createLinearGradient(kx, 0, kx + w, 0);
          const [r0, g0, b0] = legRamp(sign, 0.15);
          const [r1, g1, b1] = legRamp(sign, 0.9);
          g.addColorStop(0, `rgb(${r0},${g0},${b0})`);
          g.addColorStop(1, `rgb(${r1},${g1},${b1})`);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.roundRect(kx, ky - 3, w, 6, 2);
          ctx.fill();
          kx += w + 4;
        };
        const word = (t: string, c = ink.ink2) => {
          /* 10 px: the key is words a reader acts on (the audit's X9.6) */
          ctx.font = `500 10px ${SANS}`;
          ctx.fillStyle = c;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(t, kx, ky);
          kx += ctx.measureText(t).width + 8;
        };
        const full = tierNow === 'full';
        swatch(1, 14);
        word(full ? 'puts amplify' : 'puts');
        swatch(-1, 14);
        word(full ? 'calls absorb' : 'calls');
        ctx.strokeStyle = ink.spine;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(kx, ky);
        ctx.lineTo(kx + 12, ky);
        ctx.stroke();
        kx += 16;
        word(full ? 'the spine now' : 'now');
        ctx.save();
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = ink.keyGhost;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(kx, ky);
        ctx.lineTo(kx + 12, ky);
        ctx.stroke();
        ctx.restore();
        kx += 16;
        word(full ? 'at the open' : 'open');
        ctx.fillStyle = ink.supreme;
        ctx.fillRect(kx, ky - 3, 6, 6);
        kx += 10;
        word('supreme', ink.supreme);
      }
      /* THE COLUMN HEADS over the rows — the partner's header row in the house's letters: the
         lane's name centred over it (◂ PUTS · CALLS ▸, or NET on the net view), STRIKE over the
         column with Δ SPOT at its right when the column is wide, the flow lane's name over it */
      {
        const hy = HEAD_BAND - COL_HEAD / 2 + 0.5;
        ctx.font = `600 9px ${FIG}`;
        ctx.fillStyle = ink.ink3;
        ctx.textBaseline = 'middle';
        if (showSize) {
          if (view === 'net') {
            ctx.textAlign = 'left';
            ctx.fillText('NET GAMMA', sizeL + 8, hy);
            ctx.fillStyle = ink.ink3;
            ctx.font = `9px ${FIG}`;
            ctx.fillText('puts · calls', sizeL + 8 + ctx.measureText('NET GAMMA ').width + 8, hy);
            ctx.font = `600 9px ${FIG}`;
          } else {
            ctx.textAlign = 'center';
            ctx.fillText('◂ PUTS · CALLS ▸', sizeL + (sizeR - netCol - sizeL) / 2, hy);
            if (netCol) {
              ctx.textAlign = 'right';
              ctx.fillText('NET', sizeR - 6, hy);
            }
          }
        }
        ctx.textAlign = 'left';
        ctx.fillText('STRIKE', colL + 6, hy);
        if (colW === COL_W_WIDE && view === 'ladder') {
          ctx.textAlign = 'right';
          ctx.fillText('Δ SPOT', colR - 6, hy);
        }
        if (showFlow) {
          ctx.textAlign = 'left';
          ctx.fillText('A MOVE FORCES', flowL + 6, hy);
        }
        ctx.strokeStyle = ink.headRule;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(2, HEAD_BAND - 0.5);
        ctx.lineTo(W - 2, HEAD_BAND - 0.5);
        ctx.stroke();
      }

      /* The column's ground, the dividers, the panel's edge */
      ctx.fillStyle = ink.colGround;
      ctx.fillRect(colL, HEAD_BAND, colW, H - HEAD_BAND - FOOT_BAND);
      ctx.strokeStyle = ink.divider;
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
      ctx.strokeStyle = ink.edge;
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
            ctx.fillStyle = ink.vol(isPoc ? 0.2 : 0.09);
            ctx.fillRect(sizeR - len, top, len, Math.max(1, bot - top - 1));
          }
          const rule = (price: number | null, alpha: number, dash: number[]) => {
            if (price === null) return;
            const y = p.yFor(price);
            if (y == null || y < HEAD_BAND || y > H - FOOT_BAND) return;
            ctx.save();
            ctx.strokeStyle = ink.vol(alpha);
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
              ctx.font = `7px ${FIG}`;
              ctx.fillStyle = ink.volText;
              ctx.textAlign = 'left';
              ctx.textBaseline = 'bottom';
              ctx.fillText('VPOC', sizeL + 6, y - 2);
            }
          }
        }
      }

      /* Gridlines at the labelled rows */
      ctx.strokeStyle = ink.grid;
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
        ctx.strokeStyle = ink.flipRule;
        ctx.beginPath();
        ctx.moveTo(4, yy);
        ctx.lineTo(W - 4, yy);
        ctx.stroke();
        ctx.restore();
        ctx.font = `9px ${FIG}`;
        ctx.fillStyle = ink.flipText;
        ctx.textBaseline = 'bottom';
        if (showFlow) {
          ctx.textAlign = 'right';
          ctx.fillText(`flip ${fmtStrike(levels.flip)}`, W - 6, yy - 2);
        } else {
          /* the caption at the lane's right end — the figures live at its left */
          ctx.textAlign = 'right';
          ctx.fillText(`flip ${fmtStrike(levels.flip)}`, W - 6, yy - 2);
        }
      }

      /* THE SPOT RULE — under the bars; its chip comes last */
      const spotOn = spotY > HEAD_BAND && spotY < H - FOOT_BAND;
      if (spotOn) {
        const yy = Math.round(spotY) + 0.5;
        ctx.strokeStyle = ink.spotRule;
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
      const figureIn = (text: string, x: number, len: number, yMid: number, fg: string, outer: 'left' | 'right', font = `600 9px ${FIG}`) => {
        if (barH < 10) return;
        ctx.font = barH < 13 ? font.replace('9px', '8px') : font;
        const w = ctx.measureText(text).width;
        if (w + 12 > len) return;
        ctx.fillStyle = fg;
        ctx.textBaseline = 'middle';
        ctx.textAlign = outer === 'left' ? 'left' : 'right';
        ctx.fillText(text, outer === 'left' ? x + 6 : x + len - 6, yMid + 0.5);
      };
      const ringFor = (k: number) => (isFocus(k) ? ink.silver : isHover(k) ? ink.silverSoft : null);
      /* THE LEVEL NAMES — the cards' chips beside a capsule's end when there is
         room; when the capsule reaches the lane's edge (the wall is usually the
         longest) the name goes INSIDE it at the outer end and the figure moves
         to the inner end, so neither covers the other (Noah, 2026-09-06: "the
         call wall/put wall sometimes overlays the number of the strike when
         it's too long. find another way"). */
      const levelOf = new Map<number, { words: string; c: string }>();
      levelOf.set(levels.callWall, { words: 'Call wall', c: ink.callWall });
      levelOf.set(levels.putWall, { words: 'Put wall', c: ink.putWall });
      if (!near(levels.supreme, levels.callWall) && !near(levels.supreme, levels.putWall)) levelOf.set(levels.supreme, { words: 'Supreme', c: ink.supreme });
      if (Number.isFinite(pin) && !near(pin, levels.callWall) && !near(pin, levels.putWall) && !near(pin, levels.supreme)) levelOf.set(pin, { words: 'Pin', c: ink.ink2 });
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
        ctx.font = `600 9px ${FIG}`;
        return ctx.measureText(text).width;
      };

      /* THE SIZE LANE IS THE LADDER — a centre line, the put leg growing left
         and the call leg right, each a journey along the ramp; the figures
         past the tips when the lane has room; the spine through the rows */
      /* THE SIGN'S SHADE — one colour per side off the ramp the legs wear (the partner's flat
         inks, ours): the put pole where hedging amplifies, the call pole where it absorbs */
      const sideInk = (sign: 1 | -1) => {
        const [rr, gg, bb] = ramp(sign, 0.8);
        return `rgb(${rr},${gg},${bb})`;
      };
      if (showSize && view === 'net') {
        /* THE NET VIEW — THE PARTNER'S ROW, VERBATIM, IN OUR INKS (Noah, 2026-09-16): the strike
           in the column at the left, the net figure right after it in the sign's colour, and the
           dashes on their own line UNDER the figure — one dash per share of the largest net on
           screen, in the same colour; when the chart's pitch is too tight for two lines the
           dashes sit beside the figure. The length eases the way the legs do. */
        const laneW = sizeR - sizeL;
        const twoLine = pitch >= 24;
        const figures = laneW >= 90 && barH >= 8;
        figuresRef.current = figures;
        const x0 = sizeL + 8;
        const DASH = 5;
        const DASH_H = 3;
        const GAP = 3;
        ctx.font = `700 ${pitch >= 30 ? 10 : 9}px ${FIG}`;
        const figW = figures ? Math.ceil(ctx.measureText('−$999.9M').width) : 0;
        const dashX0 = twoLine || !figures ? x0 : x0 + figW + 8;
        const track = Math.max(DASH, sizeR - 8 - dashX0);
        const maxN = Math.max(1, Math.floor((track + GAP) / (DASH + GAP)));
        /* THE ROW IS THE STRIKE'S TOTAL, SPLIT (Noah, with the partner's Net view up close: "the
           net gamma should look like this, in our colors"): ONE row of dashes under the figure —
           the put gamma's share first in the put side's ink, the call gamma's after it in the
           call side's, the row's whole length the strike's total against the largest total on
           screen (fourteen dashes at most). No legs known, the net alone in its sign's ink. */
        const legOf = (k: number, v: number) => {
          const l = legs?.get(k);
          if (l) return { put: Math.abs(l.put), call: Math.abs(l.call) };
          return v >= 0 ? { put: Math.abs(v), call: 0 } : { put: 0, call: Math.abs(v) };
        };
        let totalMax = 0;
        for (const r of placed) {
          const l = legOf(r.strike, r.value);
          totalMax = Math.max(totalMax, l.put + l.call);
        }
        if (!totalMax) totalMax = maxAbs || 1;
        for (const r of placed) {
          const l = legOf(r.strike, r.value);
          const total = l.put + l.call;
          if (total <= 0) continue;
          const sign: 1 | -1 = r.value >= 0 ? 1 : -1;
          /* the shares in dashes, the leading side never rounded away */
          let nPut = Math.round((l.put / totalMax) * 14);
          let nCall = Math.round((l.call / totalMax) * 14);
          if (nPut + nCall === 0) {
            if (sign > 0) nPut = 1;
            else nCall = 1;
          }
          const over = nPut + nCall - maxN;
          if (over > 0) {
            if (nPut >= nCall) nPut -= over;
            else nCall -= over;
          }
          const n = nPut + nCall;
          const target = n * (DASH + GAP) - GAP;
          const e = ease(`n:${r.strike}`, target, '', 0, DASH_H);
          const figY = twoLine ? r.y - 5 : r.y;
          const dashY = twoLine ? Math.round(r.y + 4) : Math.round(r.y - DASH_H / 2);
          if (figures && r.value !== 0) {
            ctx.font = `700 ${pitch >= 30 ? 10 : 9}px ${FIG}`;
            ctx.fillStyle = sideInk(sign);
            ctx.textBaseline = 'middle';
            ctx.textAlign = 'left';
            ctx.fillText(`${sign > 0 ? '' : '−'}${fmtUsd(Math.abs(r.value))}`, x0, figY + 0.5);
          }
          for (let i = 0; i < n; i++) {
            const dx = dashX0 + i * (DASH + GAP);
            const w = Math.min(DASH, e.len - i * (DASH + GAP));
            if (w <= 0) break;
            ctx.fillStyle = sideInk(i < nPut ? 1 : -1);
            ctx.fillRect(dx, dashY, w, DASH_H);
          }
          const ring = ringFor(r.strike);
          if (ring) {
            ctx.strokeStyle = ring;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(dashX0 - 2.5, dashY - 2, e.len + 5, DASH_H + 4, 2);
            ctx.stroke();
          }
        }
      } else if (showSize) {
        /* the legs' lane stops short of the NET column when one is drawn */
        const laneW = sizeR - netCol - sizeL;
        const mid = sizeL + laneW / 2;
        const figures = laneW >= 180 && barH >= 10;
        figuresRef.current = figures;
        const reach = Math.max(8, laneW / 2 - (figures ? LEG_FIG_W : 6) - 4);
        const legH = Math.max(3, Math.min(9, Math.round(barH * 0.55)));
        /* the legs' scale is the largest leg ON SCREEN, the spine's the largest |net| — both live, like the capsules' were */
        let legMax = 0;
        let netMax = 0;
        const legOf = (k: number, v: number) => {
          const l = legs?.get(k);
          if (l) return { put: Math.abs(l.put), call: Math.abs(l.call) };
          /* no legs known: the net alone on its side — positive is put-dominant */
          return v >= 0 ? { put: Math.abs(v), call: 0 } : { put: 0, call: Math.abs(v) };
        };
        for (const r of placed) {
          const l = legOf(r.strike, r.value);
          legMax = Math.max(legMax, l.put, l.call);
          netMax = Math.max(netMax, Math.abs(r.value));
        }
        if (!legMax) legMax = maxAbs || 1;
        if (!netMax) netMax = maxAbs || 1;
        /* the centre line */
        ctx.strokeStyle = ink.divider;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(Math.round(mid) + 0.5, HEAD_BAND);
        ctx.lineTo(Math.round(mid) + 0.5, H - FOOT_BAND);
        ctx.stroke();
        const rampAt = (sign: 1 | -1, t: number) => {
          const [rr, gg, bb] = legRamp(sign, Math.max(0, Math.min(1, t)));
          return `rgb(${rr},${gg},${bb})`;
        };
        /** A leg: the ramp from the centre's quiet (t = 0) to the tip (t = its strength) */
        const leg = (side: 'put' | 'call', yMid: number, len: number, s: number, h: number, ring: string | null) => {
          if (len < 0.5) return;
          const sign: 1 | -1 = side === 'put' ? 1 : -1;
          const x0 = side === 'put' ? mid - len : mid;
          const x1 = side === 'put' ? mid : mid + len;
          const grad = ctx.createLinearGradient(mid, 0, side === 'put' ? mid - len : mid + len, 0);
          grad.addColorStop(0, rampAt(sign, 0));
          grad.addColorStop(1 / 3, rampAt(sign, s / 3));
          grad.addColorStop(2 / 3, rampAt(sign, (2 * s) / 3));
          grad.addColorStop(1, rampAt(sign, s));
          const y = Math.round(yMid - h / 2);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.roundRect(x0, y, x1 - x0, h, 2);
          ctx.fill();
          if (ring) {
            ctx.strokeStyle = ring;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(x0 - 0.5, y - 0.5, x1 - x0 + 1, h + 1, 2.5);
            ctx.stroke();
          }
        };
        for (const r of placed) {
          const l = legOf(r.strike, r.value);
          const ring = ringFor(r.strike);
          /* the lengths ease, the way the capsules did; the colour follows the eased strength */
          const pt = ease(`p:${r.strike}`, l.put > 0 ? Math.max(2, (l.put / legMax) * reach) : 0, '', 0, legH);
          const ct = ease(`c:${r.strike}`, l.call > 0 ? Math.max(2, (l.call / legMax) * reach) : 0, '', 0, legH);
          leg('put', r.y, pt.len, Math.min(1, pt.len / reach), legH, ring);
          leg('call', r.y, ct.len, Math.min(1, ct.len / reach), legH, ring);
          if (figures) {
            ctx.font = `500 9px ${FIG}`;
            ctx.fillStyle = ink.ink;
            ctx.textBaseline = 'middle';
            if (l.put > 0) {
              ctx.textAlign = 'right';
              ctx.fillText(fmtUsd(l.put), mid - pt.len - 4, r.y + 0.5);
            }
            if (l.call > 0) {
              ctx.textAlign = 'left';
              ctx.fillText(fmtUsd(l.call), mid + ct.len + 4, r.y + 0.5);
            }
          }
          /* the NET column — the strike's net at the lane's right edge in the sign's colour */
          if (netCol && r.value !== 0 && barH >= 8) {
            const sign: 1 | -1 = r.value >= 0 ? 1 : -1;
            ctx.font = `700 9px ${FIG}`;
            ctx.fillStyle = sideInk(sign);
            ctx.textBaseline = 'middle';
            ctx.textAlign = 'right';
            ctx.fillText(`${sign > 0 ? '' : '−'}${fmtUsd(Math.abs(r.value))}`, sizeR - 6, r.y + 0.5);
          }
        }
        /* THE SPINE — the contour through the rows, leaning toward the side that dominates
           by the strike's net (positive net is put-dominant: it leans left); its ghost at the open */
        if (placed.length > 1) {
          const lean = (laneW / 2) * MAX_LEAN;
          const pts = placed.map(r => ({ x: mid - (r.value / netMax) * lean, y: r.y })).sort((a, b) => a.y - b.y);
          const clampX = (v: number) => Math.max(sizeL + 2, Math.min(sizeR - netCol - 2, v));
          const hasGhost = !!openRatio && placed.some(r => openRatio.has(r.strike));
          if (hasGhost) {
            const gpts = placed
              .map(r => {
                const ratio = openRatio!.get(r.strike);
                const x = ratio == null ? mid - (r.value / netMax) * lean : mid - Math.max(-1.6, Math.min(1.6, ratio)) * ((r.value / netMax) * lean);
                return { x: clampX(x), y: r.y };
              })
              .sort((a, b) => a.y - b.y);
            ctx.save();
            ctx.setLineDash([3, 3]);
            ctx.strokeStyle = ink.ghost;
            ctx.lineWidth = 1;
            ctx.stroke(new Path2D(splinePath(gpts, sizeL + 2, sizeR - netCol - 2)));
            ctx.restore();
          }
          ctx.strokeStyle = ink.spine;
          ctx.lineWidth = 1.5;
          ctx.stroke(new Path2D(splinePath(pts.map(q => ({ x: clampX(q.x), y: q.y })), sizeL + 2, sizeR - netCol - 2)));
          /* the strike in hand, marked on the spine */
          const mark = placed.find(r => isFocus(r.strike) || isHover(r.strike));
          if (mark) {
            ctx.fillStyle = ink.markFill;
            ctx.strokeStyle = ink.silver;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(clampX(mid - (mark.value / netMax) * lean), mark.y, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
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
          eased.set(r.strike, ease(`f:${r.strike}`, target, heat(g.amplifies ? mag : -mag, onMax).fill, barH, barH));
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
          ctx.fillStyle = ink.silFill;
          ctx.fill();
          ctx.strokeStyle = ink.silStroke;
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
          ctx.font = `600 9px ${FIG}`;
          const full = `${g.flow >= 0 ? 'buy' : 'sell'} ${fmtFlow(g.flow)}`;
          const fits = (s: string) => barH >= 10 && ctx.measureText(s).width + 12 <= len;
          /* The level's chip lives at this lane's right edge; a capsule that
             reaches it takes the name inside at its outer end instead */
          const lvl = levelAt(row.strike);
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
            ctx.fillStyle = ink.ink2;
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

      /* THE STRIKE COLUMN — the strike centred in the thin column; in the wide one (the full and
         mid tiers) the strike at the left and its Δ FROM SPOT at the right, the partner's column,
         in the direction's ink */
      ctx.textBaseline = 'middle';
      const cx = colL + colW / 2;
      const wide = colW === COL_W_WIDE;
      placed.forEach((r, i) => {
        if (!labelled(i, r.strike)) return;
        if (spotOn && Math.abs(r.y - spotY) < 9) return; // the spot chip owns that height
        const k = r.strike;
        const focus = isFocus(k);
        /* the strike bold in the wide column (the partner's), plain in the thin one */
        ctx.font = `${focus || wide ? '700 ' : ''}10px ${FIG}`;
        ctx.fillStyle = focus ? ink.silver : near(k, levels.callWall) ? ink.callWall : near(k, levels.putWall) ? ink.putWall : near(k, levels.supreme) ? ink.supreme : near(k, pin) || isHover(k) ? ink.ink : wide ? ink.ink : ink.ink2;
        ctx.textAlign = wide ? 'left' : 'center';
        ctx.fillText(fmtStrike(k), wide ? colL + 6 : cx, r.y);
        if (wide) {
          if (view === 'net') {
            /* the net view's column carries the role tag after the strike (CW · PW · SUP ★), not the Δ */
            const tag = near(k, levels.callWall) ? { t: 'CW', c: ink.callWall } : near(k, levels.putWall) ? { t: 'PW', c: ink.putWall } : near(k, levels.supreme) ? { t: 'SUP ★', c: ink.supreme } : null;
            if (tag) {
              const sw = ctx.measureText(fmtStrike(k)).width;
              ctx.font = `700 9px ${FIG}`;
              ctx.fillStyle = tag.c;
              ctx.fillText(tag.t, colL + 6 + sw + 5, r.y + 0.5);
            }
          } else {
            const d = ((k - levels.spot) / levels.spot) * 100;
            ctx.font = `9px ${FIG}`;
            ctx.fillStyle = d > 0 ? 'rgb(var(--bull))' : d < 0 ? 'rgb(var(--bear))' : ink.ink3;
            ctx.textAlign = 'right';
            ctx.fillText(`${d > 0 ? '+' : ''}${d.toFixed(2)}%`, colR - 6, r.y);
          }
        }
      });
      /* Culled rows, counted */
      ctx.font = `9px ${FIG}`;
      ctx.fillStyle = ink.ink3;
      ctx.textAlign = 'center';
      if (above) ctx.fillText(`▲ ${above}`, cx, HEAD_BAND + COUNT_BAND / 2 + 1);
      if (below) ctx.fillText(`▼ ${below}`, cx, H - FOOT_BAND / 2 + 1);

      /* THE LEVEL NAMES — the cards' chips at the flow lane's right edge when
         that lane is drawn. The size lane is the ladder, so it marks a level the
         ladder's way: a stripe on the row's left edge in the level's colour, the
         strike label in that colour, and the name in the read line — never a
         chip over a leg's figure. */
      const chip = (k: number, words: string, c: string) => {
        const row = placed.find(r => near(r.strike, k));
        if (!row) return;
        if (showSize) {
          ctx.fillStyle = c;
          const sh = Math.max(4, Math.round(barH) + 2);
          /* the stripe on the panel's own left edge (the partner's), which is the column's when it comes first */
          ctx.fillRect(colFirst ? 0 : sizeL, Math.round(row.y - sh / 2), 2, sh);
        }
        if (!showFlow || insideNamed.has(row.strike)) return;
        ctx.font = `500 10px ${SANS}`;
        const w = Math.ceil(ctx.measureText(words).width) + 12;
        const x = W - 6 - w;
        const y = Math.round(row.y - 8) + 0.5;
        ctx.fillStyle = ink.chipGround;
        ctx.beginPath();
        ctx.roundRect(x, y, w, 16, 8);
        ctx.fill();
        ctx.fillStyle = ink.alpha(c, 0.14);
        ctx.fill();
        ctx.strokeStyle = ink.alpha(c, 0.5);
        ctx.stroke();
        ctx.fillStyle = c;
        ctx.textAlign = 'center';
        ctx.fillText(words, x + w / 2, row.y + 0.5);
      };
      chip(levels.callWall, 'Call wall', ink.callWall);
      chip(levels.putWall, 'Put wall', ink.putWall);
      if (!near(levels.supreme, levels.callWall) && !near(levels.supreme, levels.putWall)) chip(levels.supreme, 'Supreme', ink.supreme);
      if (Number.isFinite(pin) && !near(pin, levels.callWall) && !near(pin, levels.putWall) && !near(pin, levels.supreme)) chip(pin, 'Pin', ink.ink2);

      /* THE SPOT CHIP — solid, in the column */
      if (spotOn) {
        const y = Math.round(spotY - 8);
        ctx.fillStyle = ink.spotChip;
        ctx.beginPath();
        ctx.roundRect(colL + 2, y, colW - 4, 16, 4);
        ctx.fill();
        ctx.fillStyle = ink.spotChipText;
        ctx.font = `700 10px ${FIG}`;
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
        const isLeg = id.startsWith('p:') || id.startsWith('c:');
        if (!isLeg || !showSize) {
          anim.delete(id);
          continue;
        }
        const strike = Number(id.slice(2));
        const yRaw = p.yFor(strike);
        if (yRaw == null || !Number.isFinite(yRaw)) {
          anim.delete(id);
          continue;
        }
        /* a leg whose strike has left the view shrinks back into the centre line, then goes */
        a.len += (0 - a.len) * k;
        if (a.len < 0.5) {
          anim.delete(id);
          continue;
        }
        settled = false;
        const yc = Math.min(H - FOOT_BAND - a.h / 2, Math.max(HEAD_BAND + a.h / 2, yRaw));
        const laneW = ((showFlow ? Math.round((W - colW) * liveSplit) : W - colW) || 1) - netCol;
        const mid = (colFirst ? colW : 0) + laneW / 2;
        const sign: 1 | -1 = id.startsWith('p:') ? 1 : -1;
        const [rr, gg, bb] = legRamp(sign, 0.5);
        ctx.fillStyle = `rgba(${rr},${gg},${bb},0.6)`;
        ctx.beginPath();
        ctx.roundRect(sign === 1 ? mid - a.len : mid, Math.round(yc - a.h / 2), a.len, a.h, 2);
        ctx.fill();
      }
      settledRef.current = settled;
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [rows, maxAbs, legs, openRatio, mode, step, levels, flow, lane, focusPrice, projection, showSize, showFlow, vp, liveSplit, view, paper]);

  /* THE POINTER — the nearest strike by height, anywhere in the lanes */
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const root = rootRef.current;
    if (!root) return;
    const r = root.getBoundingClientRect();
    const y = e.clientY - r.top;
    const x = e.clientX - r.left;
    if (y < headBandRef.current) {
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
  /* The part the strike plays, named here — the size lane marks it with a stripe and its colour, never a chip. In the
     level's TOKEN (paletteInk.ts): the dark island's are these very inks, and a light ground cuts them deep. */
  const readRole = readRow
    ? near(readRow.strike, levels.callWall)
      ? { words: 'Call wall', c: TOKEN.CALL_WALL }
      : near(readRow.strike, levels.putWall)
        ? { words: 'Put wall', c: TOKEN.PUT_WALL }
        : near(readRow.strike, levels.supreme)
          ? { words: 'Supreme', c: TOKEN.SUPREME }
          : levels.pin != null && near(readRow.strike, levels.pin)
            ? { words: 'Pin', c: 'rgb(var(--text-secondary))' }
            : null
    : null;
  const hoverMax = placedRef.current.reduce((m, r) => Math.max(m, Math.abs(r.value)), 0) || maxAbs || 1;
  /* the partner's footer figures: the picked strike's legs and its share of the net on screen */
  const readLegs = readRow ? legs?.get(readRow.strike) ?? null : null;
  const readShare = readRow ? (() => { const total = placedRef.current.reduce((s, r) => s + Math.abs(r.value), 0); return total > 0 ? (100 * Math.abs(readRow.value)) / total : null; })() : null;
  const hoverFlowMax = placedRef.current.reduce((m, r) => Math.max(m, Math.abs(r.rung?.flow ?? 0)), 0) || flow?.maxAbs || 1;
  /* WHAT THE LINE HOLDS follows the panel's width — it never wraps and it never
     clips a figure mid-number. Wide, the whole read; under ~430px the words go
     and the figures stay; under ~240px (a docked Terrain pane) the strike and
     the size, which is the one number the old rail never printed. */
  const tight = panelW > 0 && panelW < 430;
  const tiny = panelW > 0 && panelW < 240;
  /* THE CARD BELOW THE TOP TIER (Noah, 2026-09-16: the partner's ladder "carries a hover card
     once the numbers can't fit the screen anymore"): the figures the rows cannot print, over
     the CHART beside the pointer's row — never over the lanes (the 2026-09-06 ruling that put
     the read line under them stands): the strike and its distance from spot, the put and call
     legs with their dollars, the net and its word, the open interest where the book carries it,
     and the change since the open. */
  const cardOn = !!hover && showSize && !figuresRef.current;
  const cardRow = cardOn && readRow ? readRow : null;
  const cardLegs = cardRow ? legs?.get(cardRow.strike) ?? null : null;
  const cardLevel = cardRow ? rows.find(r => near(r.strike, cardRow.strike)) ?? null : null;
  const cardLegMax = cardRow ? placedRef.current.reduce((m, r) => { const l = legs?.get(r.strike); return l ? Math.max(m, Math.abs(l.put), Math.abs(l.call)) : m; }, 0) || 1 : 1;
  /* the house's one since-open rule (data/levelview): the figure is a percent, a multiple, or
     words alone — never a run of digits (the first cut printed "+164103195%") */
  const sinceOpen = cardRow && openRatio ? sinceOpenRead(openRatio.get(cardRow.strike)) : null;
  /* the strike KEPT by a click wears the silver ring on the row; the card says so in the read
     line's own words (Noah, 2026-09-16: the card "on the focus status should showcase that") */
  const cardKept = !!cardRow && focusPrice != null && near(focusPrice, cardRow.strike);
  const cardTop = cardRow && foot ? Math.max(headBandRef.current, Math.min(cardRow.y - 44, foot.top - 132)) : 0;
  const rampInk = (sign: 1 | -1, t: number) => {
    const tt = Math.max(0, Math.min(1, t));
    const [rr, gg, bb] = heatRampColorFor(sign, paper ? ladderRampT(sign, tt, mode, true) : Math.max(0.35, tt), mode, paper);
    return `rgb(${rr},${gg},${bb})`;
  };
  const card = cardRow && (
    <div
      data-profile-card={cardRow.strike}
      className="absolute z-40 pointer-events-none w-[236px] rounded-lg border border-borderMuted bg-card/95 backdrop-blur-sm shadow-[0_8px_24px_rgba(0,0,0,0.5)] px-3 py-2 animate-soft-in"
      style={{ right: 'calc(100% + 10px)', top: cardTop }}
    >
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[12px] font-bold tnum text-textPrimary">
          {ticker ? `${ticker} ` : ''}
          {fmtStrike(cardRow.strike)}
        </span>
        <span className={`font-mono text-[10px] tnum ${cardRow.strike > levels.spot ? 'text-bull' : cardRow.strike < levels.spot ? 'text-bear' : 'text-textMuted'}`}>
          {cardRow.strike > levels.spot ? '+' : ''}
          {(((cardRow.strike - levels.spot) / levels.spot) * 100).toFixed(2)}% from spot
        </span>
        {readRole && (
          <span className="ml-auto text-[10px] font-medium" style={{ color: readRole.c }}>
            {readRole.words}
          </span>
        )}
      </div>
      {cardLegs && (
        <div className="mt-1.5 flex flex-col gap-1">
          {(
            [
              ['Puts', Math.abs(cardLegs.put), 1],
              ['Calls', Math.abs(cardLegs.call), -1],
            ] as const
          ).map(([name, v, sign]) => (
            <div key={name} className="flex items-center gap-2">
              <span className="w-8 shrink-0 font-mono text-[9px] uppercase tracking-wider text-textMuted">{name}</span>
              <span className="flex-1 h-[5px] rounded-full bg-ink/[0.06] overflow-hidden">
                <span className="block h-full rounded-full transition-colors duration-300" style={{ width: `${Math.round((v / cardLegMax) * 100)}%`, background: rampInk(sign, v / cardLegMax) }} />
              </span>
              <span className="w-14 shrink-0 text-right font-mono text-[10px] tnum text-textPrimary">{v > 0 ? fmtUsd(v) : '—'}</span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-1.5 grid grid-cols-3 gap-2">
        <div>
          <div className="font-mono text-[9px] uppercase tracking-wider text-textMuted">Net</div>
          <div className="mt-0.5 flex items-center gap-1 font-mono text-[10px] tnum text-textPrimary">
            {cardRow.value !== 0 && <span className="w-2 h-2 rounded-full shrink-0 transition-colors duration-300" style={{ background: thermal(cardRow.value, hoverMax).fill }} aria-hidden />}
            {cardRow.value === 0 ? '—' : fmtUsd(Math.abs(cardRow.value))}
          </div>
          {cardRow.value !== 0 && <div className="text-[9px] text-textMuted">{cardRow.value > 0 ? words.pos : words.neg}</div>}
        </div>
        <div>
          <div className="font-mono text-[9px] uppercase tracking-wider text-textMuted">Open int</div>
          <div className="mt-0.5 font-mono text-[10px] tnum text-textPrimary">{cardLevel && (cardLevel.callOI != null || cardLevel.putOI != null) ? ((cardLevel.callOI ?? 0) + (cardLevel.putOI ?? 0)).toLocaleString('en-US') : '—'}</div>
        </div>
        <div>
          <div className="font-mono text-[9px] uppercase tracking-wider text-textMuted">Since open</div>
          {/* the figure in the direction's ink; with no figure the short words take its line */}
          <div className={`mt-0.5 font-mono text-[10px] tnum ${sinceOpen == null ? 'text-textMuted' : sinceOpen.dir < 0 ? 'text-bear' : sinceOpen.dir > 0 ? 'text-bull' : 'text-textPrimary'}`} data-card-since>
            {sinceOpen == null ? '—' : sinceOpen.figure ?? sinceOpen.short}
          </div>
          {sinceOpen?.figure && <div className="text-[9px] text-textMuted">{sinceOpen.short}</div>}
        </div>
      </div>
      {/* KEPT OR NOT — the read line's own words, so the card says what the silver ring means */}
      <div className={`mt-1.5 pt-1.5 border-t border-borderSubtle/60 flex items-center gap-1.5 text-[9px] ${cardKept ? 'text-silver' : 'text-textMuted'}`} data-card-kept={cardKept ? '' : undefined}>
        {cardKept && <span className="w-1.5 h-1.5 rounded-full bg-silver shrink-0" aria-hidden />}
        {cardKept ? 'Kept · click to let go' : 'Click to keep'}
      </div>
    </div>
  );
  const readLine = foot && (
    <div
      data-profile-read
      data-read-strike={readRow ? readRow.strike : undefined}
      className={`absolute inset-x-0 flex items-center ${tight ? 'gap-2 px-2' : 'gap-3 px-2.5'} border-t border-ink/[0.06] bg-panel whitespace-nowrap overflow-hidden text-[10.5px] text-textSecondary pointer-events-none`}
      style={{ top: foot.top, height: foot.h }}
    >
      {readRow ? (
        <>
          <span className="font-mono text-[11px] font-bold tnum text-textPrimary">{fmtStrike(readRow.strike)}</span>
          {readRole && (
            <span className="text-[10px] font-medium shrink-0" style={{ color: readRole.c }} data-read-role>
              {readRole.words}
            </span>
          )}
          {!tiny && (
            <span className={`font-mono tnum ${readRow.strike > levels.spot ? 'text-bull' : readRow.strike < levels.spot ? 'text-bear' : 'text-textMuted'}`}>
              {readRow.strike > levels.spot ? '+' : ''}
              {(((readRow.strike - levels.spot) / levels.spot) * 100).toFixed(2)}%{tight ? '' : ' from spot'}
            </span>
          )}
          {view === 'net' && readLegs ? (
            /* the partner's footer for the picked strike: PUT · CALL · SHARE */
            <>
              <span className="inline-flex items-center gap-1.5">
                <span className="text-textMuted">Put</span>
                <span className="font-mono tnum text-textPrimary">{fmtUsd(Math.abs(readLegs.put))}</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="text-textMuted">Call</span>
                <span className="font-mono tnum text-textPrimary">{fmtUsd(Math.abs(readLegs.call))}</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="text-textMuted">Share</span>
                <span className="font-mono tnum text-textPrimary">{readShare != null ? `${readShare.toFixed(1)}%` : '—'}</span>
              </span>
            </>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              {!tight && <span className="text-textMuted">Size</span>}
              {readRow.value !== 0 && <span className="w-2 h-2 rounded-full shrink-0 transition-colors duration-300" style={{ background: thermal(readRow.value, hoverMax).fill }} aria-hidden />}
              <span className="font-mono tnum text-textPrimary">
                {readRow.value === 0 ? '—' : tight ? fmtUsd(Math.abs(readRow.value)) : `${fmtUsd(Math.abs(readRow.value))} · ${readRow.value > 0 ? words.pos : words.neg}`}
              </span>
            </span>
          )}
          {!tiny && (
            <span className="inline-flex items-center gap-1.5">
              {!tight && <span className="text-textMuted">A move here forces</span>}
              {readRow.rung && readRow.rung.flow !== 0 && (
                <span className="w-2 h-2 rounded-full shrink-0 transition-colors duration-300" style={{ background: thermal(readRow.rung.amplifies ? Math.abs(readRow.rung.flow) : -Math.abs(readRow.rung.flow), hoverFlowMax).fill }} aria-hidden />
              )}
              <span className="font-mono tnum text-textPrimary">{readRow.rung && readRow.rung.flow !== 0 ? `${readRow.rung.flow >= 0 ? 'buy' : 'sell'} ${fmtFlow(readRow.rung.flow)}` : '—'}</span>
            </span>
          )}
          {!tight && (
            /* it gives way first, so the kept word at the end is never cut (the audit's TE-9) */
            <span className="truncate min-w-0">
              {readRow.rung
                ? readRow.rung.flow === 0
                  ? 'no forced flow at this strike'
                  : `dealers ${readRow.rung.amplifies ? 'chase' : 'lean against'} a move here · ${readRow.rung.amplifies ? 'speeds it up' : 'slows it'}`
                : 'the market is here'}
            </span>
          )}
          {!tight && <span className="ml-auto shrink-0 text-textMuted">{hover ? (focusPrice != null && near(focusPrice, readRow.strike) ? 'kept · click to let go' : 'click to keep') : 'kept'}</span>}
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
  /* THE HEAD'S TOOLS (Noah, 2026-09-06): the Lanes card when the host has no row of its own
     for it, the Vol switch, the door — and the ×, which keeps the first row's right edge
     whatever the tier. Below the full tier the head is TWO ROWS: the view tabs and the host's
     card on the first, these tools on the second (a 340 head cannot hold them all on one). */
  const twoRowHead = tier !== 'full';
  const laneTools = (
    <>
      {onLane && (roomForLanes || twoRowHead) && <DropdownSelect label="Lanes" value={lane} options={LANE_OPTIONS} onChange={onLane} title="What the panel draws" testId="lanes" align={twoRowHead ? 'start' : 'end'} size="sm" />}
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
      {sure && sure.length > 0 && <HowSureBook sures={sure} compact={narrow} align={twoRowHead ? 'start' : 'end'} className="pointer-events-auto" />}
      {guide}
    </>
  );
  const closeDoor = onClose && (
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
  );
  /* THE VIEW TABS in the Expiry card's own clothes — the dropdown trigger's chip, the one in
     hand wearing the silver edge (Noah, 2026-09-16: "those buttons should match the formatting
     of the expiry button") */
  const viewTabs = showSize && (
    <span className="pointer-events-auto shrink-0 inline-flex items-center gap-1" data-profile-views>
      {(['ladder', 'net'] as const).map(v => (
        <button
          key={v}
          type="button"
          onClick={() => setView(v)}
          aria-pressed={view === v}
          data-profile-view={v}
          className={`inline-flex items-center h-6 px-2 rounded-md border bg-chip font-mono text-[11px] font-semibold select-none transition-colors ${
            view === v ? 'border-silver/50 text-textPrimary' : 'border-borderSubtle text-textMuted hover:border-borderMuted hover:text-textPrimary'
          }`}
          title={v === 'ladder' ? 'The put and call legs at each strike, the spine through them' : "Each strike's net as a figure and a row of dashes"}
        >
          {v === 'ladder' ? 'Ladder' : 'Net'}
        </button>
      ))}
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
          onDoubleClick={() => onWidth(restWidth ?? PROFILE_MIN_W)}
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
          style={{ left: `calc((100% - ${colW}px) * ${liveSplit})` }}
          data-profile-split-grip
        />
      )}
      <canvas ref={canvasRef} className="absolute inset-0 block" aria-hidden />
      {/* THE HEAD — the view tabs and the host's Expiry card first, the lanes' names after them
          on the full tier, the tools at the end; below the full tier a second row takes the
          tools, and the column heads under it name the lanes */}
      <div className="absolute inset-x-0 top-0 flex flex-col px-2 pointer-events-none" style={{ height: twoRowHead ? HEAD_TOP_2 : HEAD_TOP }} data-profile-head data-head-rows={twoRowHead ? 2 : 1}>
        <div className="flex items-center gap-1.5 min-w-0" style={{ height: HEAD_TOP }}>
          {viewTabs}
          {headCard && (
            <span className="pointer-events-auto shrink-0 inline-flex" data-profile-head-card>
              {headCard}
            </span>
          )}
          {!twoRowHead && showSize && (
            <span className="min-w-0 flex-1 flex items-center gap-2 text-[10px] text-textMuted pl-1" data-lane-head="size">
              <Term k={view === 'net' ? 'Net at a strike' : 'Size at a strike'} className="pointer-events-auto truncate">
                {view === 'net' ? 'Net' : 'Size'} · {greek}
                <span className="text-textMuted">{view === 'net' ? ' · puts − calls' : ' · puts ◂ ▸ calls'}</span>
              </Term>
            </span>
          )}
          {!twoRowHead && showFlow && (
            <span className="min-w-0 flex-1 flex items-center gap-2 text-[10px] text-textMuted pl-1" data-lane-head="flow">
              <Term k="What a move forces" className="pointer-events-auto truncate">
                What a move forces <span className="text-textMuted">· from gamma</span>
              </Term>
            </span>
          )}
          <span className="ml-auto shrink-0 flex items-center gap-1 pointer-events-auto" data-profile-tools={twoRowHead ? undefined : ''}>
            {!twoRowHead && laneTools}
            {closeDoor}
          </span>
        </div>
        {twoRowHead && (
          <div className="flex items-center gap-1 pointer-events-auto" style={{ height: HEAD_TOP_2 - HEAD_TOP }} data-profile-tools>
            {laneTools}
          </div>
        )}
      </div>
      {readLine}
      {card}
    </div>
  );
};

export default ProfilePanel;
