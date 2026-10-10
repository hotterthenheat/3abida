/*
==================================================
  SLAYER TERMINAL - THE EXPOSURE LADDER
  (components/gex/ExposureLadder.tsx)

  The calendar's second view (Noah, 2026-09-10, his
  partner's "inventory & sensitivity by strike": "the
  net, put, call ratios with the bar for each section
  looks good. make a new button that allows for
  either the heatmap or this"): the SAME book as the
  Ledger — the same surface, the same window, the
  same expiries drawn, the same palette — as ONE ROW
  PER STRIKE instead of a cell per strike and expiry:

    STRIKE (its tag: call wall · put wall · flip ·
    supreme · pin · you)  ·  PUT  ·  CALL  ·  NET  ·
    THE BOOK — a bar for the net against the heaviest
    row shown, in the calendar's own ramp

  The legs are summed over the expiries drawn (the
  head's Expiries card, after the bell without
  today's), so the ladder and the calendar always
  say the same total. "All" shows every greek's net
  as a figure and a bar side by side. Spot runs
  through the rows as the same rule. Hover washes
  the row (and the chart's ladder beside it); a click
  keeps the strike — the shared focus — and the same
  strike again lets go.

  SEVERAL GREEKS: THE BAR OWNS THE LANE (Noah,
  2026-09-21, his partner's five-column page beside
  ours: "it lacks quick understanding because the bars
  are practically all the same size"). Measured, at
  1905 wide with all five drawn: a pane was 288px, its
  lane 205, and 60px each side of the lane was kept for
  the put and call figures — a bar could reach 36px,
  and against a $10B wall a $1B strike got 3px. So with
  more than one greek drawn:
    · ONE BAR A ROW, the net — it grows left from the
      centre line when puts lead, right when calls lead,
      and takes the whole lane (the figures leave the
      row: the read line above and the row's card have
      every one of them);
    · THE SCALE IS CUT AT THE HEAVIEST ORDINARY STRIKE —
      the 90th percentile of |net| among the rows shown,
      not the wall. The few strikes past it reach the
      lane's end and wear a tick: those are the walls,
      and the net figure says by how much. Linear
      inside the cut, never a square root — a bar that
      lies about "twice" would mislead a trader;
    · THE BAR WEARS ITS FIGURE'S INK — one colour a row,
      the ramp by amount the net figure wears, on either
      palette (the first cut kept House bars flat gold /
      ice with length alone saying the amount; Noah,
      2026-09-21: "why do the bars not match our in house
      colour palette that's also on the numbers?");
      never a gradient along the bar (at 9px tall that
      read as noise).
    · THE COLOUR IS READ AGAINST THE CUT TOO, THROUGH A
      WINDOW (Noah, 2026-09-22: "almost every color on
      this page reads ashy and muted"): the length was cut
      at the heaviest ordinary strike but the colour still
      ran to the wall, so most rows sat in the ramp's rust
      and teal. Now an amount is read against the cut and
      through the saturated stretch of each side
      (heatmap.ts, heatLadderColor) — ordinary strikes
      span it, the walls sit at its end. The supreme's
      strike prints in magenta on its row, the way the
      calendar prints it; the put and call figures are
      bold — small type at a pure hue needs weight.
  One greek drawn keeps the two legs with their figures:
  there the lane is 500px and more, and the legs read
  through the same window.
==================================================
*/

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { HeatMode } from './heatmap';
import { HEAT_MODE, heatLadderColor, heatLaneInks, heatRampColorFor, ladderRampT } from './heatmap';
import SpotRule from '../ui/SpotRule';
import { CardRow, PointerFollowCard } from '../ui/PointerCard';
import { fmtUsd } from '../../data/gex';
import { GREEKS, GREEK_UNIT, type ExposureSurface, type Greek } from '../../data/exposureSurface';
/* the TOKEN inks (paletteInk), not the hex palette: every use here is DOM — inline colours and SVG
   attributes — and the hex green/red printed the dark theme's pair on paper at 2:1 (2026-09-16) */
import { CALL_WALL, FLIP, PUT_WALL, SUPREME } from './paletteInk';
import { afterGlide } from '../../core/glide';
import { useResolvedTheme } from '../../theme/theme';
import type { SurfaceCell } from './exposureView';

interface ExposureLadderProps {
  surface: ExposureSurface;
  liveSpot?: number;
  /** The greeks drawn, in the book's order — one, some, or all five */
  greeks: Greek[];
  /** The expiry columns drawn, as surface indices, nearest first — the host's window after the bell, its ceiling and
      what fits (ExposureField `shownIdxOf`), so both views sum the same book */
  expiries: number[];
  rings: number;
  hoverStrike?: number | null;
  palette?: 'house' | 'thermal';
  selectedStrike?: number | null;
  marks?: ReadonlyMap<number, string>;
  onPointer?: (cell: SurfaceCell | null, clientX: number, clientY: number) => void;
  onSelectStrike?: (strike: number) => void;
  /** THE LANE IN FOCUS (Noah, 2026-09-12: "like the terrain section can we have
      that holo border on the active card for the all five greeks"): with more
      than one greek drawn, the lead greek's lane wears the holo ring from its
      head to its last row — the read line's verdict and the read card follow
      it. A click on a lane's head makes it the lead. */
  lead?: Greek;
  onLead?: (greek: Greek) => void;
  /** The strikes in another instrument's terms (the Pulse ladder's SPX / ES lens) — the book stays the ETF's */
  strikeFormat?: (strike: number) => string;
  /** The row's floor — the Map's 18 by rest; a tile that must show its whole window passes less (the Pulse ladder, 10) */
  rowMin?: number;
}

const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */
/* The legs' inks are the HOUSE's put and call (the profile panel's wall pills,
   the calendar's tags) — the put side red, the call side green (Noah,
   2026-09-10: "the put color is off") */
const PUT_INK = PUT_WALL;
const CALL_INK = CALL_WALL;
const GREEK_LABEL: Record<Greek, string> = { gex: 'GEX', dex: 'DEX', vex: 'VEX', vanna: 'VANNA', charm: 'CHARM' };
/* The Ledger's floor, so ±20 strikes stand in the calendar's box without a scroll (measured: 823px holds 40 rows at 19.4) */
const ROW_MIN = 18;
const SPOT_H = 18;
const fmtStrike = (v: number) => (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2));
const fmtDist = (pct: number) => {
  const d = Math.abs(pct) < 0.005 ? 0 : pct;
  return `${d > 0 ? '+' : ''}${d.toFixed(2)}%`;
};
const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';
/* THE LEGS ARE THE CHART LADDER'S (Noah, 2026-09-12, the Strike Pressure
   Ladder beside a four-name book: "make it look like this ladder instead"):
   a bar from the centre line, its length AND its brightness carrying the
   amount on the calendar's ramp — puts grow left, calls grow right. A
   gradient cannot be transitioned, so a bar carries both ramps and
   crossfades when the Colours card changes. */
const rampCss = (side: 'put' | 'call', t: number, mode: HeatMode, paper: boolean) => {
  const sign = side === 'put' ? 1 : -1;
  const [r, g, b] = heatRampColorFor(sign, ladderRampT(sign, t, mode, paper), mode, paper);
  return `rgb(${r},${g},${b})`;
};
const legGradient = (side: 'put' | 'call', s: number, mode: HeatMode, paper: boolean) =>
  `linear-gradient(to ${side === 'put' ? 'left' : 'right'}, ${rampCss(side, 0, mode, paper)}, ${rampCss(side, s / 3, mode, paper)}, ${rampCss(side, (2 * s) / 3, mode, paper)}, ${rampCss(side, s, mode, paper)})`;
const RAMP_PAIR: [HeatMode, HeatMode] = [HEAT_MODE, 'thermal-yellow'];
const LegBar = ({ px, strength, side, mode, h, paper }: { px: number; strength: number; side: 'put' | 'call'; mode: HeatMode; h: number; paper: boolean }) => {
  const rounded = side === 'put' ? 'rounded-l-[2px]' : 'rounded-r-[2px]';
  return (
    <span
      aria-hidden="true"
      data-leg={side}
      className={`absolute top-1/2 -translate-y-1/2 overflow-hidden transition-[width] duration-700 ${rounded}`}
      style={{ ...(side === 'put' ? { right: '50%' } : { left: '50%' }), width: px, height: h, transitionTimingFunction: EASE }}
    >
      {RAMP_PAIR.map(m => (
        <span
          key={m}
          aria-hidden="true"
          className={`absolute inset-0 transition-opacity duration-700 ${rounded}`}
          style={{ background: legGradient(side, strength, m, paper), opacity: m === mode || (!RAMP_PAIR.includes(mode) && m === HEAT_MODE) ? 1 : 0, transitionTimingFunction: EASE }}
        />
      ))}
    </span>
  );
};
/** THE NET BAR (several greeks): one flat bar from the centre line — left when puts lead, right when calls lead. Past the
    scale's cut it reaches the lane's end and wears a tick. `data-leg` says its side, so the calendar ↔ ladder flight
    (ExposureField's `ladderPieces`) finds it where a leg stood. */
const NetBar = ({ px, side, ink, capped, h }: { px: number; side: 'put' | 'call'; ink: string; capped: boolean; h: number }) => (
  <>
    <span
      aria-hidden="true"
      data-leg={side}
      data-ladder-bar={side}
      data-capped={capped || undefined}
      /* the width glides over 700ms with the data; the colour over 450ms — the Colours switch says its new palette at the
         top of its orbs' run (Palette's OUT, ~300ms in) and the bars land with the orbs' return (~460ms later) */
      className={`absolute top-1/2 -translate-y-1/2 transition-[width,background-color] [transition-duration:700ms,450ms] ${side === 'put' ? 'rounded-l-[2px]' : 'rounded-r-[2px]'}`}
      style={{ ...(side === 'put' ? { right: '50%' } : { left: '50%' }), width: px, height: h, background: ink, transitionTimingFunction: EASE }}
    />
    {/* the tick: a wall — past the heaviest ordinary strike, its true length would run off the lane */}
    {capped && <span aria-hidden="true" className="absolute top-1/2 -translate-y-1/2 w-[2px] rounded-full bg-textPrimary" style={{ ...(side === 'put' ? { left: 0 } : { right: 0 }), height: h + 6 }} data-ladder-tick={side} />}
  </>
);
/** The lane's key inks — the chart ladder's gold and ice on the house ramp, the thermal poles otherwise */
/* the house inks as tokens (2026-09-16): #F5C542 / #7ABDD7 on black, cut for paper by the light set */
const laneInksFor = (mode: HeatMode, paper: boolean) => (mode === HEAT_MODE ? { put: 'rgb(var(--ember))', call: 'rgb(var(--glacier))' } : (({ pos, neg }) => ({ put: pos, call: neg }))(heatLaneInks(mode, 0.78, paper)));

interface Row {
  strike: number;
  /** Per greek: the legs summed over the expiries drawn */
  legs: Record<Greek, { put: number; call: number; net: number }>;
}

const ExposureLadder = ({ surface, liveSpot, greeks, expiries, rings, hoverStrike, palette = 'house', selectedStrike, marks, onPointer, onSelectStrike, lead: leadProp, onLead, strikeFormat, rowMin = ROW_MIN }: ExposureLadderProps) => {
  const fmtS = strikeFormat ?? fmtStrike;
  /* the lead greek — the host's pick when it is among the greeks drawn, else the first */
  const lead: Greek = leadProp && greeks.includes(leadProp) ? leadProp : greeks[0];
  const mode: HeatMode = palette === 'thermal' ? 'thermal-yellow' : HEAT_MODE;
  /* ON PAPER THE LADDER IS PART OF THE PAGE (2026-09-22, Noah with the light Map: "can we make this look more
     appealing on light theme with the soft gray look"): the island's soft grey, the page's inks, and the paper ramps
     (heatmap.ts, PAPER) — grey for a small amount, the deep pole for a heavy one, on bars and figures alike. On the
     dark terminal it is EXACTLY what it was: every dark colour below is the same literal or the same dark token. */
  const paper = useResolvedTheme() === 'light';
  /* THE EXPIRIES DRAWN — the host's list (its window, its ceiling, what fits), so both views sum the same book */
  const shownIdx = useMemo(() => (expiries.length ? expiries.filter(i => i >= 0 && i < surface.expiries.length) : [Math.max(0, surface.expiries.findIndex(e => e.dte === 0))]), [expiries, surface]);
  /* Descending, the window's rings each side of spot */
  const { above, below } = useMemo(() => {
    const desc = [...surface.strikes].sort((a, b) => b - a);
    return {
      above: desc.filter(s => s >= surface.spot).slice(-Math.max(1, rings)),
      below: desc.filter(s => s < surface.spot).slice(0, Math.max(1, rings)),
    };
  }, [surface, rings]);
  const rowFor = (strike: number): Row => {
    const si = surface.strikes.indexOf(strike);
    const legs = {} as Row['legs'];
    for (const g of GREEKS) {
      let put = 0, call = 0, net = 0;
      if (si >= 0)
        for (const e of shownIdx) {
          put += surface.put[g][e]?.[si] ?? 0;
          call += surface.call[g][e]?.[si] ?? 0;
          net += surface.net[g][e]?.[si] ?? 0;
        }
      legs[g] = { put, call, net };
    }
    return { strike, legs };
  };
  const rowsAbove = useMemo(() => above.map(rowFor), [above, surface, shownIdx]); // eslint-disable-line react-hooks/exhaustive-deps
  const rowsBelow = useMemo(() => below.map(rowFor), [below, surface, shownIdx]); // eslint-disable-line react-hooks/exhaustive-deps
  const rows = useMemo(() => [...rowsAbove, ...rowsBelow], [rowsAbove, rowsBelow]);
  /* The scales: the heaviest |net|, |put| and |call| among the rows shown, per
     greek — the bar and each figure's mini band read against them */
  const maxAbs = useMemo(() => {
    const m = {} as Record<Greek, number>;
    for (const g of GREEKS) m[g] = Math.max(1, ...rows.map(r => Math.abs(r.legs[g].net)));
    return m;
  }, [rows]);
  /* THE CUT (several greeks): the 90th percentile of |net| among the rows shown — the heaviest ORDINARY strike. With
     fewer than ten rows, or where the ninetieth is the heaviest, it is simply the heaviest. */
  const cap = useMemo(() => {
    const m = {} as Record<Greek, number>;
    for (const g of GREEKS) {
      const abs = rows.map(r => Math.abs(r.legs[g].net)).sort((a, b) => a - b);
      const p90 = abs.length >= 10 ? abs[Math.floor(0.9 * (abs.length - 1))] : abs[abs.length - 1] ?? 0;
      m[g] = Math.max(1, p90 > 0 ? p90 : abs[abs.length - 1] ?? 1);
    }
    return m;
  }, [rows]);
  const maxLeg = useMemo(() => {
    const m = {} as Record<Greek, { put: number; call: number }>;
    for (const g of GREEKS) m[g] = { put: Math.max(1, ...rows.map(r => Math.abs(r.legs[g].put))), call: Math.max(1, ...rows.map(r => Math.abs(r.legs[g].call))) };
    return m;
  }, [rows]);
  /* The totals over the rows shown — the foot's read */
  const totals = useMemo(() => {
    const t = {} as Record<Greek, { put: number; call: number; net: number }>;
    for (const g of GREEKS) t[g] = rows.reduce((a, r) => ({ put: a.put + r.legs[g].put, call: a.call + r.legs[g].call, net: a.net + r.legs[g].net }), { put: 0, call: 0, net: 0 });
    return t;
  }, [rows]);

  /* THE LANE IN FOCUS — where the lead greek's lane is, measured off its head
     cell and the rows' box whenever the ladder is laid out again; nothing when
     one greek fills the ladder */
  const outerRef = useRef<HTMLDivElement | null>(null);
  const [ring, setRing] = useState<{ left: number; width: number; top: number; bottom: number } | null>(null);
  useLayoutEffect(() => {
    const outer = outerRef.current;
    if (!outer || greeks.length < 2) {
      setRing(null);
      return;
    }
    const read = () => {
      const head = outer.querySelector<HTMLElement>(`[data-ladder-group-head="${lead}"]`);
      const rows = outer.querySelector<HTMLElement>('[data-ladder-focus], [role="table"]');
      if (!head || !rows) {
        setRing(null);
        return;
      }
      /* the ring starts at the READ LINE's cell for the lead (2026-09-21: the figures and the verdict stand over the
         pane, and the verdict is the lead's — so they sit inside the ring), else at the pane's head */
      const read = outer.querySelector<HTMLElement>(`[data-read-greek="${lead}"]`);
      const o = outer.getBoundingClientRect();
      const h = head.getBoundingClientRect();
      const t = (read ?? head).getBoundingClientRect();
      const r = rows.getBoundingClientRect();
      /* 4px above the read cell — into the row's padding — so the figures never touch the foil (Noah, 2026-09-21:
         "touching border top way too close") */
      const next = { left: Math.round(h.left - o.left), width: Math.round(h.width), top: Math.round(t.top - o.top - (read ? 4 : 0)), bottom: Math.round(o.bottom - r.bottom) };
      setRing(prev => (prev && prev.left === next.left && prev.width === next.width && prev.top === next.top && prev.bottom === next.bottom ? prev : next));
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(outer);
    return () => ro.disconnect();
  }, [lead, greeks]);

  /* THE ROWS FILL THE HEIGHT, never under ROW_MIN — past that the ladder scrolls */
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [boxH, setBoxH] = useState(0);
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const read = () => setBoxH(prev => (prev === el.clientHeight ? prev : el.clientHeight));
    const first = requestAnimationFrame(read);
    const ro = new ResizeObserver(() => afterGlide(read));
    ro.observe(el);
    return () => {
      cancelAnimationFrame(first);
      ro.disconnect();
    };
  }, []);
  const rowH = Math.max(rowMin, (boxH - SPOT_H) / Math.max(1, rows.length));
  /* THE SPOT IN THE MIDDLE (2026-09-22): when the rows run past the box they open with the spot rule centred — the
     strikes either side of price are the ones read first — once per window, never under a reader who scrolled */
  const centredFor = useRef('');
  useLayoutEffect(() => {
    const el = boxRef.current;
    const key = `${surface.ticker}|${rings}|${boxH}`;
    if (!el || boxH === 0 || centredFor.current === key) return;
    centredFor.current = key;
    if (el.scrollHeight <= el.clientHeight + 1) return;
    const spot = el.querySelector<HTMLElement>('[data-ladder-spot]');
    if (spot) el.scrollTop = Math.max(0, spot.offsetTop - (el.clientHeight - spot.offsetHeight) / 2);
  }, [surface.ticker, rings, boxH, rowH]);
  const fontSize = Math.max(9.5, Math.min(12, rowH * 0.46));

  const { levels } = surface;
  const pinStrike = surface.front.strikes.find(r => r.pin)?.strike;
  const tagFor = (strike: number): { word: string; ink: string } | null =>
    strike === levels.supreme ? { word: 'supreme', ink: SUPREME }
    : strike === levels.callWall ? { word: 'call wall', ink: CALL_WALL }
    : strike === levels.putWall ? { word: 'put wall', ink: PUT_WALL }
    : strike === levels.flip ? { word: 'flip', ink: FLIP }
    : strike === pinStrike ? { word: 'pin', ink: paper ? 'rgb(var(--text-muted))' : '#7d7d7d' }
    : null;

  const one = greeks.length === 1;
  /* THE CHART LADDER'S OWN GRAMMAR (Noah, 2026-09-12, the Strike Pressure
     Ladder beside a four-name book: "remove the stripe row i dont like it.
     what about making it look like this ladder instead?"): STRIKE · Δ SPOT ·
     THE LANE (the put leg growing left from a centre line, the call leg
     right, each on the calendar's ramp, the leg's figure riding its bar's
     end) · NET — a lane and a net per greek drawn. ONE SCALE FOR BOTH LEGS,
     the heaviest leg among the rows shown, so the bars compare across the
     centre; the lane is measured so the biggest leg reaches the lane's end
     minus its figure. A narrow column (names side by side) or four+ greeks
     take the compact tracks. */
  const rootRef = useRef<HTMLDivElement | null>(null);
  const laneRef = useRef<HTMLSpanElement | null>(null);
  const [narrow, setNarrow] = useState(false);
  const [laneW, setLaneW] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    /* THE TRACKS SETTLE ONCE (2026-09-13, the columns' glide): a column
       arriving or leaving narrows this ladder over ~280ms — the lane follows
       every frame (the bars ride the glide), but the roomy/compact switch
       waits for the size to settle, so the strike column never flips mid-glide */
    let settle = 0;
    const read = (now: boolean) => {
      const lane = laneRef.current;
      if (lane) setLaneW(lane.getBoundingClientRect().width);
      window.clearTimeout(settle);
      const decide = () => setNarrow(el.clientWidth > 0 && el.clientWidth < 720);
      if (now) decide();
      else settle = window.setTimeout(decide, 120);
    };
    read(true);
    const ro = new ResizeObserver(() => read(false));
    ro.observe(el);
    if (laneRef.current) ro.observe(laneRef.current);
    return () => {
      window.clearTimeout(settle);
      ro.disconnect();
    };
  }, [greeks.length]);
  const compact = narrow || greeks.length >= 4;
  const STRIKE_W = compact ? 64 : 84;
  const DIST_W = compact ? 46 : 52;
  const LANE = compact ? 'minmax(150px,1fr) 66px' : 'minmax(240px,1fr) 76px';
  const groupMin = compact ? 150 + 66 + 8 : 240 + 76 + 8;
  const cols = one ? `${STRIKE_W}px ${DIST_W}px ${LANE}` : `${STRIKE_W}px ${DIST_W}px ${greeks.map(() => `minmax(${groupMin}px, 1fr)`).join(' ')}`;
  const minW = STRIKE_W + DIST_W + 16 + 24 + (one ? groupMin : greeks.length * (groupMin + 12));
  /* A group cell: the hairline and the wash on every other greek (the skin), and its inner grid */
  const groupSkin = (i: number) => `h-full min-w-0 pl-2 -ml-1 border-l border-borderSubtle/60 ${i % 2 === 1 ? 'bg-ink/[0.02]' : ''}`;
  const groupClass = (i: number) => `grid items-center gap-x-2 ${groupSkin(i)}`;
  /* the lane's reach: half the lane — less the room a figure needs at the bar's end, when the figures ride the bars (one
     greek); the whole half, less a little air for the tick, when the bar owns the lane (several) */
  const FIGURE_W = 60;
  const reach = laneW == null ? 0 : one ? Math.max(24, laneW / 2 - FIGURE_W - 6) : Math.max(24, laneW / 2 - 5);
  const maxLegAll = useMemo(() => {
    const m = {} as Record<Greek, number>;
    for (const g of GREEKS) m[g] = Math.max(1, maxLeg[g].put, maxLeg[g].call);
    return m;
  }, [maxLeg]);
  const laneInks = laneInksFor(mode, paper);

  /* THE FOCUS (Noah, 2026-09-10: "create a focus status like we have for the
     heatmap"): the calendar's own contract — the kept strike stays sharp and
     everything else softens behind ONE blurred scrim (only its opacity
     animates, see index.css); the read line above the rows says whose figures
     it is showing and why; a click anywhere outside lets go. */
  const [hovered, setHovered] = useState<number | null>(null);
  const keptStrike = selectedStrike != null && rows.some(r => Math.abs(r.strike - selectedStrike) < 1e-9) ? selectedStrike : null;
  const pinned = keptStrike != null;
  const [scrim, setScrim] = useState(false);
  useEffect(() => {
    if (pinned) {
      setScrim(true);
      return;
    }
    const t = window.setTimeout(() => setScrim(false), 460);
    return () => window.clearTimeout(t);
  }, [pinned]);
  const keptRef = useRef(keptStrike);
  keptRef.current = keptStrike;
  useEffect(() => {
    if (!pinned) return;
    const h = (ev: MouseEvent) => {
      const t = ev.target as Element | null;
      if (t?.closest('[data-ladder-row],[data-cell],[data-strike],[data-profile-panel],[data-position-gutter],[data-dropdown],[data-dropdown-card],[role="menu"],[data-focus-chip],[data-guide-door],button,a,input,select,textarea')) return;
      if (keptRef.current != null) onSelectStrike?.(keptRef.current); // the host toggles it off
    };
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, [pinned, onSelectStrike]);

  /* THE ROW'S OWN CARD (Noah, 2026-09-12: "the book ladder should have its own
     hover card with beneficial information" — then "use the same method for
     the translucent hover card you did for the building page… right now they
     do not function the same"): the Building page's PointerCard — glass,
     beside the pointer and moving WITH it, flipping at the right edge — the
     strike in silver with its part, the distance at the right, then label ·
     value · sub rows: the lead greek's put, call and net (its verdict as the
     sub), the open interest, the expiry carrying most of it, the strike's
     share of the book shown. Never while a strike is kept — the scrim and the
     read line own that. A row's pointer-leave waits a few frames, so the card
     does not blink at the seam between rows.
     ONE CARD PER HOVER (Noah, 2026-09-12: "this hover effect… lacks
     smoothness. in between 2 strikes it gets stuck and glitches/spazzes
     out"): the card is `PointerFollowCard` — it tracks the pointer by itself
     from where the row was entered, so a move re-renders nothing here, and
     its content is built by a plain function, never a component declared in
     this render (that remounted the card, and restarted its fade-in, on every
     pointer move — the card never got past a third of its opacity). The rows
     re-render only when the pointer crosses into another row. */
  const [card, setCard] = useState<{ strike: number; x: number; y: number } | null>(null);
  const leaveTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(leaveTimer.current), []);
  const rowCard = (r: Row, start: { x: number; y: number }) => {
    const tag = tagFor(r.strike);
    const you = marks?.get(r.strike);
    const si = surface.strikes.indexOf(r.strike);
    const distPct = ((r.strike - surface.spot) / surface.spot) * 100;
    const l = r.legs[lead];
    const ink = heatLadderColor(l.net, cap[lead], mode, paper);
    const total = rows.reduce((s, x) => s + Math.abs(x.legs[lead].net), 0);
    const share = total > 0 ? (Math.abs(l.net) / total) * 100 : 0;
    const heaviest = si >= 0 ? shownIdx.map(e => ({ e, v: surface.net[lead][e]?.[si] ?? 0 })).sort((a, b) => Math.abs(b.v) - Math.abs(a.v))[0] : undefined;
    const oi = si >= 0 ? shownIdx.reduce((s, e) => s + (surface.oi[e]?.[si] ?? 0), 0) : 0;
    const pct = (v: number, max: number) => `${Math.round((Math.abs(v) / Math.max(1, max)) * 100)}%`;
    return (
      <PointerFollowCard
        start={start}
        width={212}
        testId="data-ladder-card"
        testValue={r.strike}
        title={
          <>
            {fmtS(r.strike)}
            {tag && (
              <span className="text-[11px] uppercase tracking-widest font-normal" style={{ color: tag.ink }}>
                {tag.word}
              </span>
            )}
            {you && (
              <span className="text-[11px] uppercase tracking-widest font-normal" style={{ color: SILVER }}>
                you
              </span>
            )}
          </>
        }
        aside={`${distPct >= 0 ? '+' : '−'}${Math.abs(distPct).toFixed(2)}% · ${distPct >= 0 ? 'above' : 'below'} spot`}
      >
        <CardRow k="Put" v={fmtUsd(l.put)} sub={pct(l.put, maxLeg[lead].put)} ink={PUT_INK} />
        <CardRow k="Call" v={fmtUsd(l.call)} sub={pct(l.call, maxLeg[lead].call)} ink={CALL_INK} />
        <CardRow k={`Net · ${GREEK_LABEL[lead]}`} v={fmtUsd(l.net)} sub={l.net >= 0 ? 'put-heavy' : 'call-heavy'} ink={ink} />
        {oi > 0 && <CardRow k="Open interest" v={Math.round(oi).toLocaleString()} sub="contracts" />}
        {heaviest && <CardRow k="Heaviest expiry" v={fmtUsd(heaviest.v)} sub={surface.expiries[heaviest.e]?.date} ink={ink} />}
        <CardRow k="Of the book" v={`${share.toFixed(1)}%`} sub="shown" />
      </PointerFollowCard>
    );
  };
  const cardRow = card && !pinned ? rows.find(r => Math.abs(r.strike - card.strike) < 1e-9) ?? null : null;

  const rowEl = (r: Row) => {
    const kept = keptStrike != null && Math.abs(keptStrike - r.strike) < 1e-9;
    const washed = !pinned && ((hoverStrike != null && Math.abs(hoverStrike - r.strike) < 1e-9) || (hovered != null && Math.abs(hovered - r.strike) < 1e-9));
    const tag = tagFor(r.strike);
    const you = marks?.get(r.strike);
    const distPct = ((r.strike - surface.spot) / surface.spot) * 100;
    const isSupreme = r.strike === levels.supreme;
    const legH = Math.max(5, Math.min(9, rowH - 9));
    /* the legs' figures: 11px on the Map's rows, smaller on a tight tile's (a 12px row holds 10px, an 11px row 9.5px) */
    const legFig = rowH >= 16 ? 11 : rowH >= 12 ? 10 : 9.5;
    return (
      <div
        key={r.strike}
        role="row"
        /* the supreme's row wears the magenta wash end to end, the chart ladder's rule */
        className={`relative grid items-center gap-x-2 px-3 border-b border-borderSubtle/30 cursor-pointer transition-[color,background-color,border-color,grid-template-columns] duration-200 motion-reduce:transition-none ${
          kept ? `z-30 bg-silver/[0.06] ${paper ? '' : 'shadow-[inset_2px_0_0_0_rgb(var(--silver)/0.7)]'}` : washed ? 'bg-silver/[0.04]' : isSupreme ? 'bg-supreme/[0.14] hover:bg-supreme/[0.18]' : 'hover:bg-ink/[0.03]'
        }`}
        /* the kept row's silver edge: the dark literal above, the paper silver token here (steel on paper) */
        style={{ gridTemplateColumns: cols, height: rowH, fontSize, ...(kept && paper ? { boxShadow: 'inset 2px 0 0 0 rgb(var(--silver) / 0.7)' } : {}) }}
        onPointerEnter={ev => {
          if (leaveTimer.current) window.clearTimeout(leaveTimer.current);
          leaveTimer.current = 0;
          setHovered(r.strike);
          /* the card's content turns to this row; where the pointer is from here on is the card's own business */
          setCard(c => (c && c.strike === r.strike ? c : { strike: r.strike, x: ev.clientX, y: ev.clientY }));
          onPointer?.({ strike: r.strike, e: shownIdx[0] ?? 0 }, ev.clientX, ev.clientY);
        }}
        onPointerLeave={ev => {
          onPointer?.(null, ev.clientX, ev.clientY);
          if (leaveTimer.current) window.clearTimeout(leaveTimer.current);
          leaveTimer.current = window.setTimeout(() => {
            leaveTimer.current = 0;
            setHovered(h => (h === r.strike ? null : h));
            setCard(c => (c && c.strike === r.strike ? null : c));
          }, 70);
        }}
        onClick={() => onSelectStrike?.(r.strike)}
        data-ladder-row={r.strike}
        data-kept={kept || undefined}
        data-supreme={isSupreme || undefined}
      >
        {/* the part it plays, as a left edge — the chart ladder's */}
        {tag && !kept && <span aria-hidden="true" className="absolute left-0 inset-y-0 w-[2px]" style={{ background: tag.ink }} />}
        <span className="flex items-center gap-1.5 min-w-0 font-mono tnum whitespace-nowrap overflow-hidden">
          {/* THE SUPREME IS THE STRIKE PRINTED IN MAGENTA, the calendar's rule (2026-09-22) — a kept row wears silver first */}
          <span className={`text-[11px] ${isSupreme ? 'font-bold' : 'font-semibold'} ${kept ? 'text-silver' : 'text-textPrimary'}`} style={!kept && isSupreme ? { color: SUPREME } : undefined}>{fmtS(r.strike)}</span>
          {/* the tag's word folds away in a narrow column — the edge in its ink stays, the read line and the card still name it */}
          {tag && !compact && (
            <span className="text-[11px]" style={{ color: tag.ink }}>
              {tag.word}
            </span>
          )}
          {you && (
            <span className="text-[11px]" style={{ color: SILVER }}>
              you
            </span>
          )}
        </span>
        <span className="font-mono text-[11px] tnum whitespace-nowrap text-right text-textPrimary">{fmtDist(distPct)}</span>
        {greeks.map((g, gi) => {
          const l = r.legs[g];
          const putS = Math.abs(l.put) / maxLegAll[g];
          const callS = Math.abs(l.call) / maxLegAll[g];
          const putEnd = reach * putS;
          const callEnd = reach * callS;
          /* ONE FACT, ONE INK: the net figure wears the calendar's ramp (the
             Colours card: blue absorbs, orange to red amplifies) */
          const netInk = heatLadderColor(l.net, cap[g], mode, paper);
          /* SEVERAL GREEKS: one net bar, cut at the heaviest ordinary strike (the head note) */
          const netS = Math.abs(l.net) / cap[g];
          const capped = netS > 1 + 1e-9;
          const netSide: 'put' | 'call' = l.net >= 0 ? 'put' : 'call';
          /* the bar wears its figure's ink on either palette (Noah, 2026-09-21: "why do the bars not match our in house
             colour palette that's also on the numbers?" — the first cut kept House bars flat gold / ice) */
          const barInk = netInk;
          const cells = (
            <>
              <span className="relative block self-stretch min-h-[14px] min-w-0" data-ladder-lane={g}>
                <span aria-hidden="true" className="absolute inset-y-0 left-1/2 w-px bg-ink/[0.08]" />
                {/* once the lane is measured — mounted at their real length, never transitioned from a guess */}
                {laneW != null && !one && l.net !== 0 && <NetBar px={reach * Math.min(1, netS)} side={netSide} ink={barInk} capped={capped} h={legH} />}
                {laneW != null && one && (
                  <>
                    <LegBar paper={paper} px={putEnd} strength={putS} side="put" mode={mode} h={legH} />
                    <LegBar paper={paper} px={callEnd} strength={callS} side="call" mode={mode} h={legH} />
                    <span
                      className="absolute top-1/2 -translate-y-1/2 text-right font-mono font-medium tnum whitespace-nowrap text-textPrimary transition-[right] duration-700"
                      style={{ right: `calc(50% + ${putEnd + 6}px)`, transitionTimingFunction: EASE, fontSize: legFig }}
                      data-ladder-put={Math.round(putS * 100)}
                    >
                      {fmtUsd(Math.abs(l.put))}
                    </span>
                    <span
                      className="absolute top-1/2 -translate-y-1/2 font-mono font-medium tnum whitespace-nowrap text-textPrimary transition-[left] duration-700"
                      style={{ left: `calc(50% + ${callEnd + 6}px)`, transitionTimingFunction: EASE, fontSize: legFig }}
                      data-ladder-call={Math.round(callS * 100)}
                    >
                      {fmtUsd(Math.abs(l.call))}
                    </span>
                  </>
                )}
              </span>
              <span className="text-right font-mono text-[11px] font-semibold tnum whitespace-nowrap transition-[color] duration-[450ms]" style={{ color: l.net === 0 ? 'rgb(var(--text-muted))' : netInk }} data-ladder-net={Math.round(Math.min(1, Math.abs(l.net) / maxAbs[g]) * 100)}>
                {fmtUsd(l.net)}
              </span>
            </>
          );
          if (one) return <Fragment key={g}>{cells}</Fragment>;
          return (
            <span key={g} className={groupClass(gi)} style={{ gridTemplateColumns: LANE }} data-ladder-group={g}>
              {cells}
            </span>
          );
        })}
      </div>
    );
  };

  /* THE READ LINE IS A ROW OF THE TABLE (Noah, 2026-09-21, with a picture
     of it: "i like the information here in the header but something about
     it is so off putting"). It was a sentence of seventeen figures over a
     table of five columns: it wrapped wherever the width ran out (four
     greeks on one line, CHARM alone on the next beside the verdict),
     nothing stood over the pane it described, fifteen coloured figures at
     one size with three tiers of type repeated five times, the verdict
     buried mid-line and "under the pointer" floating alone at the far
     right. Now it stands ON THE LADDER'S OWN COLUMNS:
       · the strike cell (the strike and Δ spot columns): the strike, its
         tag, its distance, and why it is the one shown — kept, under the
         pointer, or the supreme;
       · each greek's put · call · net OVER ITS OWN PANE, on the pane's
         skin — the net bold, put and call in their inks; a narrow pane
         drops the PUT / CALL / NET words and keeps the figures;
       · the verdict UNDER THE LEAD PANE'S figures — it is read off the lead
         greek, so it sits inside the ring.
     The unit words left it: the pane's head says them one row down. The
     expiry count left it too: the foot has it. One greek drawn is the same
     row with one cell over the wide lane. */
  const focusStrike = keptStrike ?? hovered ?? hoverStrike ?? levels.supreme;
  const focusRow = rows.find(r => Math.abs(r.strike - focusStrike) < 1e-9) ?? rows[0];
  /* the why is a short line in the strike cell (118px in the compact tracks — measured: 26 characters of 8px caps run
     5px past it, 21 fit with room): the tag beside the strike already says SUPREME, and a kept row wears silver, so the
     words say only what to do next; the calendar's "click anywhere outside" is the title */
  const why = pinned ? 'click off to let go' : hovered != null || hoverStrike != null ? 'under the pointer' : 'supreme · hover a row';
  const whyTitle = pinned ? 'Kept: click anywhere outside the ladder to let go' : 'Click a row to keep it in the line';
  /* the PUT / CALL / NET words want ~190px of lane beside the figures (measured: the five figures with their words are
     ~250px of a ~280px pane at 1905); under that the figures stand alone in their inks */
  const readWords = one || laneW == null || laneW >= 190;
  /* one figure of the row: its word (when there is room) and the amount in its ink — BOLD, all three (2026-09-22: the
     put and call figures are the one place the pure pair appears on the ladder, at 11px; regular weight read muted) */
  const figure = (word: string, v: number, ink: string, _bold = true) => (
    <span className="inline-flex items-baseline gap-1.5 min-w-0">
      {readWords && <span className="text-[11px] uppercase tracking-widest text-textMuted">{word}</span>}
      <span className="text-[11px] tnum font-bold" style={{ color: ink }}>{fmtUsd(v)}</span>
    </span>
  );
  /* the lean, the row card's own word for a net's sign */
  const leanOf = (net: number) => (net >= 0 ? 'put-heavy' : 'call-heavy');
  /* the three figures of one greek, centred over its pane */
  const figures = (l: { put: number; call: number; net: number }, netInk: string) => (
    <span className="flex items-baseline justify-center gap-x-3 min-w-0 whitespace-nowrap overflow-hidden">
      {figure('put', l.put, PUT_INK)}
      {figure('call', l.call, CALL_INK)}
      {figure('net', l.net, netInk, true)}
    </span>
  );
  const readLine = focusRow ? (() => {
    const tag = tagFor(focusRow.strike);
    const distPct = ((focusRow.strike - surface.spot) / surface.spot) * 100;
    const leadLegs = focusRow.legs[lead];
    const verdict = leadLegs.net >= 0 ? 'put-heavy — dealer hedging amplifies a move here' : 'call-heavy — dealer hedging absorbs one here';
    const verdictInk = heatLadderColor(leadLegs.net, Math.max(1, Math.abs(leadLegs.net)), mode, paper);
    /* EVERY CELL IS THE SAME SHAPE (Noah, 2026-09-21: "the active box… doesn't look the same"): the figures on the first
       line of every pane, at one height; under them the strike's lean in the net's ink — the lead pane's the full verdict,
       the others' the word. The cell's own top inset is the air under the ring. */
    const cell = (g: Greek, gi: number) => {
      const l = focusRow.legs[g];
      const netInk = heatLadderColor(l.net, cap[g], mode, paper);
      return (
        <span key={g} className={`${one ? 'col-span-2' : groupSkin(gi)} flex flex-col justify-center gap-0.5 min-w-0 pt-1`} data-read-greek={g}>
          {figures(l, netInk)}
          {g === lead ? (
            <span className="text-[11px] tracking-wide whitespace-nowrap overflow-hidden text-ellipsis text-center" style={{ color: verdictInk }} title={verdict} data-read-verdict>
              {verdict}
            </span>
          ) : (
            <span className="text-[11px] tracking-wide whitespace-nowrap overflow-hidden text-ellipsis text-center" style={{ color: netInk }} title={`${GREEK_LABEL[g]} at this strike leans ${leanOf(l.net) === 'put-heavy' ? 'to the puts' : 'to the calls'}`} data-read-lean>
              {leanOf(l.net)}
            </span>
          )}
        </span>
      );
    };
    return (
      <div role="row" className="shrink-0 grid items-center gap-x-2 px-3 py-2 border-b border-borderSubtle/60 font-mono select-none" style={{ gridTemplateColumns: cols }} data-ladder-readline data-read-strike={focusRow.strike}>
        <span className="col-span-2 min-w-0 flex flex-col gap-0.5 whitespace-nowrap">
          <span className="inline-flex items-baseline gap-2 min-w-0">
            <span className="text-[13px] font-bold text-textPrimary tnum leading-none">{fmtS(focusRow.strike)}</span>
            {tag && (
              <span className="text-[11px] font-bold uppercase tracking-widest truncate" style={{ color: tag.ink }}>
                {tag.word}
              </span>
            )}
          </span>
          <span className="text-[11px] text-textMuted tnum leading-none">
            {distPct >= 0 ? '+' : ''}
            {distPct.toFixed(2)}% from spot
          </span>
          <span className={`text-[11px] truncate leading-none ${pinned ? 'text-silver' : 'text-textMuted'}`} title={whyTitle} data-ladder-why>{why}</span>
        </span>
        {greeks.map(cell)}
      </div>
    );
  })() : null;

  /* The head: with several greeks, a row naming each greek over its four
     columns, then the four column names under every one. Two fixed rows —
     the first cut gave the names 8px when two greeks were on and they bled
     into the strikes (Noah, 2026-09-10: "the headers bleeding into the
     ladder. they are also not visible enough") — and the words in the
     secondary ink, the greeks' names in the primary. */
  const head = (
    <div className="shrink-0 border-b border-borderSubtle/70 font-mono uppercase tracking-widest" data-ladder-head>
      {!one && (
        <div role="row" className="grid items-stretch gap-x-2 px-3 h-7 border-b border-borderSubtle/40 text-[11px] font-semibold text-textPrimary" style={{ gridTemplateColumns: cols }} data-ladder-head-greeks>
          {/* THE DIRECTION, SAID ONCE (Noah, 2026-09-21, "do it all" on: the "puts lead · calls lead" caption repeated
              five times across the head is noise): over the strike columns, where the eye starts the row, in the lane
              inks; each pane's caption below says its own scale instead */}
          <span
            className="col-span-2 flex items-center gap-1.5 min-w-0 whitespace-nowrap overflow-hidden text-[11px] font-normal text-textMuted"
            title="Every pane: a bar grows left from the centre line when puts lead at the strike, right when calls lead"
            data-ladder-head-direction
          >
            <span className="transition-colors duration-[450ms]" style={{ color: laneInks.put }}>◂ puts</span>
            <span>·</span>
            <span className="transition-colors duration-[450ms]" style={{ color: laneInks.call }}>calls ▸</span>
          </span>
          {greeks.map((g, gi) => (
            <span
              key={g}
              className={`${groupClass(gi)} flex items-center ${onLead ? 'cursor-pointer hover:text-silver' : ''} ${g === lead ? 'text-silver' : ''}`}
              onClick={() => onLead?.(g)}
              title={g === lead ? `${GREEK_LABEL[g]} leads — the read and the verdict follow it` : `Lead with ${GREEK_LABEL[g]} — the read and the verdict follow it`}
              data-ladder-group-head={g}
              data-lead={g === lead || undefined}
            >
              <span className="whitespace-nowrap">
                {GREEK_LABEL[g]} <span className="font-normal text-textSecondary">· per {GREEK_UNIT[g]}</span>
              </span>
            </span>
          ))}
        </div>
      )}
      {/* the captions — the chart ladder's whisper row */}
      <div role="row" className="grid items-stretch gap-x-2 px-3 h-7 text-[11px] text-textSecondary" style={{ gridTemplateColumns: cols }} data-ladder-head-columns>
        <span className="flex items-center">Strike</span>
        <span className="flex items-center justify-end whitespace-nowrap">Δ spot</span>
        {greeks.map((g, gi) => {
          const names = (
            <>
              {one ? (
                <span ref={laneRef} className="flex items-center justify-center gap-2 min-w-0 whitespace-nowrap overflow-hidden text-textMuted" data-ladder-head-lane>
                  <span className="transition-colors duration-[450ms]" style={{ color: laneInks.put }}>◂ puts</span>
                  <span>·</span>
                  <span className="transition-colors duration-[450ms]" style={{ color: laneInks.call }}>calls ▸</span>
                </span>
              ) : (
                /* THE PANE'S SCALE (Noah, 2026-09-21: "a bar in GEX and a bar of the same length in DEX are not the
                   same money… if you want it louder"): what a full bar stands for in THIS pane, and that a bar past it
                   is ticked; the words fold to the figure alone in a narrow pane */
                <span
                  ref={gi === 0 ? laneRef : undefined}
                  className="flex items-center justify-center gap-1 min-w-0 whitespace-nowrap overflow-hidden text-textMuted"
                  title={`A bar that reaches the lane's end is ${fmtUsd(cap[g])} of net ${GREEK_LABEL[g]} at the strike — the heaviest ordinary strike shown, nine strikes in ten fit under it. A strike past it runs to the end and wears a tick: a wall; its figure says by how much. Each pane has its own scale. Hover a row for its put, call and net.`}
                  data-ladder-head-lane
                  data-ladder-scale={cap[g]}
                >
                  <span>full at</span>
                  <span className="tnum text-textSecondary">{fmtUsd(cap[g])}</span>
                  {laneW != null && laneW >= 190 && <span>· ticked past it</span>}
                </span>
              )}
              <span className="flex items-center justify-end">Net</span>
            </>
          );
          if (one) return <Fragment key={g}>{names}</Fragment>;
          return (
            <span key={g} className={groupClass(gi)} style={{ gridTemplateColumns: LANE }}>
              {names}
            </span>
          );
        })}
      </div>
    </div>
  );

  /* THE FOOT IS A ROW OF THE TABLE TOO (Noah, 2026-09-21, with a picture of
     the old one-line foot: "needs a makeover… doesn't look appealing"): the
     whole book's figures for each greek stand over the greek's own pane, in
     the read line's grammar — put · call · net, the net bold in the ramp's
     ink, the book's lean beneath — and the left cell says what was added up.
     The two rows mirror each other: the top reads one strike, the foot reads
     them all. */
  const foot = (
    <div role="row" className="shrink-0 grid items-stretch gap-x-2 px-3 py-1.5 border-t border-borderSubtle/60 font-mono select-none" style={{ gridTemplateColumns: cols }} data-ladder-foot>
      <span className="col-span-2 min-w-0 flex flex-col justify-center gap-0.5 whitespace-nowrap">
        <span className="text-[11px] font-bold text-textPrimary leading-none">Total</span>
        <span className="text-[11px] text-textMuted truncate leading-none">
          {rows.length} strikes · {shownIdx.length} {shownIdx.length === 1 ? 'expiry' : 'expiries'}
        </span>
      </span>
      {greeks.map((g, gi) => {
        const t = totals[g];
        const ink = heatLadderColor(t.net, Math.max(1, Math.abs(t.net)), mode, paper);
        return (
          <span key={g} className={`${one ? 'col-span-2' : groupSkin(gi)} flex flex-col justify-center gap-0.5 min-w-0`} data-foot-greek={g}>
            {figures(t, ink)}
            <span
              className="text-[11px] tracking-wide whitespace-nowrap overflow-hidden text-ellipsis text-center"
              style={{ color: ink }}
              title={`Every strike shown, added up: ${fmtUsd(t.put)} on the put side, ${fmtUsd(t.call)} on the call side, ${fmtUsd(t.net)} net ${GREEK_LABEL[g]}`}
              data-foot-lean
            >
              {leanOf(t.net)}
            </span>
          </span>
        );
      })}
    </div>
  );

  return (
    /* A DARK ISLAND on the dark terminal (Noah, 2026-09-12: "these ladders
       need gray or black as the background" — black); on paper the GREY of
       that word: the page's soft inset, the page's inks (2026-09-22) */
    <div ref={rootRef} data-theme={paper ? 'light' : 'dark'} className={`h-full min-h-0 flex flex-col overflow-x-auto ${paper ? 'bg-inset' : 'bg-panel'}`} data-exposure-ladder data-paper={paper || undefined} data-greeks={greeks.join(',')} data-ladder-compact={compact || undefined}>
      <div ref={outerRef} className="relative h-full min-h-0 flex flex-col" style={{ minWidth: minW }}>
        {/* THE LANE IN FOCUS — Terrain's ring (index.css .holo-ring) over the lead
            greek's lane, its head to its last row, measured off the head cell.
            FIRMER since 2026-09-21 (Noah: "seems too muted"): two pixels of the
            foil over a soft silver halo — the weight changed, never the colour */}
        {ring && <span aria-hidden className="holo-halo absolute rounded-md z-30" style={ring} data-ladder-lead-halo />}
        {ring && <span aria-hidden className="holo-ring holo-ring-firm absolute rounded-md z-30" style={ring} data-ladder-lead-ring={lead} />}
        {readLine}
        {head}
        <div className="relative flex-1 min-h-0">
          {/* THE FOCUS SCRIM — one layer for the blur and the dim; only its opacity animates (the calendar's own, see index.css) */}
          <div
            aria-hidden
            data-ladder-scrim={pinned ? '' : undefined}
            className={`pointer-events-none absolute inset-0 z-20 transition-opacity duration-[420ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${pinned ? 'opacity-100' : 'opacity-0'}`}
            style={{ backdropFilter: `blur(${scrim ? 3 : 0}px)`, WebkitBackdropFilter: `blur(${scrim ? 3 : 0}px)`, background: paper ? 'rgb(var(--inset) / 0.66)' : 'rgba(10,10,10,0.66)' }}
          />
          <div ref={boxRef} className="h-full overflow-y-auto" role="table" aria-label="Exposure by strike" data-ladder-focus={pinned ? '' : undefined}>
            {rowsAbove.map(rowEl)}
            <div className="px-3" style={{ height: SPOT_H }} data-ladder-spot>
              <SpotRule ticker={surface.ticker} price={liveSpot ?? surface.spot} />
            </div>
            {rowsBelow.map(rowEl)}
          </div>
        </div>
        {foot}
      </div>
      {/* THE ROW'S CARD — glass beside the pointer, moving with it, never while kept; one element for the whole hover */}
      {cardRow && card && rowCard(cardRow, card)}
    </div>
  );
};

export default ExposureLadder;
