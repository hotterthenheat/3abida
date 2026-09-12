/*
==================================================
  SLAYER TERMINAL - EXPOSURE LEDGER
  Strike × expiry in the house capsules, one greek
  at a time or all five side by side — the grid
  Skylit is known for, in the house's own cells
  (Noah, 2026-09-03: "dates with the ability to only
  show vex, dex, or gex individually or all 3 side
  by side… the king node stands out" — 09-04: the
  house word is SUPREME, "king" is theirs; 09-09:
  "the 'all' is only dex, vex, gex. not vanna and
  charm" — All is the five now, and a cell too
  narrow for "-$272.1M" prints "-272M", or the
  colour alone).

  CAPSULES, FULL (Noah, 2026-09-05, closing the
  redesign arc — terrain, reach, wheel, wind map,
  hexbin, honeycomb: "i feel like im trying too hard
  to recreate the wheel. lets revert back to capsules
  just make our capsules nice and full"):
    · the rows share the panel's whole height — no
      dead surface under the grid (fullscreen used to
      fill a third of the screen); each capsule fills
      its cell, and the figure inside scales with the
      row (9–13px); more rows than fit scroll
    · every cell is a HeatPill on the house ramp
      (ember amplifies, glacier absorbs, the dark
      zero), sized against the whole surface's scale
      so a far expiry's quiet cells read quiet next
      to today's loud ones
    · HOVER lights the capsule (silver ring) with a
      quiet wash along its row and down its column,
      and ONE FIXED READ LINE above the grid carries
      strike · date · put · call · net · OI · the
      verdict — no card under the pointer (the thing
      Noah would not have back); a click PINS it
      (the ring stays, the strike label goes silver),
      clicking empty space lets go
    · the SUPREME — the heaviest STRIKE of the whole book, the chart's
      magenta — wears the magenta tag on its row and the ring on the date
      carrying most of it; the heaviest single CELL wears a plain star
      (2026-09-08: the two had shared one word and named different strikes);
      spot runs through the rows as a rule
==================================================
*/

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import HeatPill from './HeatPill';
import { HEAT_MODE, heatLaneColor, type HeatMode } from './heatmap';
import SpotRule from '../ui/SpotRule';
import { fmtUsd } from '../../data/gex';
import { GREEK_UNIT, type ExposureSurface, type Greek } from '../../data/exposureSurface';
import { LONG_GAMMA, SHORT_GAMMA, SUPREME } from './paletteInk';
import { afterGlide, onGlide, promisedWidth } from '../../core/glide';
import { netInk } from './ExposureReadout';
import type { SurfaceCell } from './exposureView';

interface ExposureLedgerProps {
  surface: ExposureSurface;
  /** The live spot for the rule between the rows — the surface itself is rebuilt only when spot has moved (see ExposureField) */
  liveSpot?: number;
  /** The greeks drawn, in the book's order — one, some, or all five (a stable array) */
  greeks: Greek[];
  depth: number;
  /** Strikes each side of spot — the head's window */
  rings: number;
  /** A strike another surface is hovering (the ladder) — its row washes here too */
  hoverStrike?: number | null;
  /** The capsules' ramp: the house ember/glacier, or the thermal try (cool absorbs · yellow balanced · warm amplifies) */
  palette?: 'house' | 'thermal';
  /** BOOK AFTER THE BELL (band 3, 2026-09-05): today's column taken out — the book as it stands at the next open */
  afterBell?: boolean;
  selectedStrike?: number | null;
  /** YOUR POSITIONS (2026-09-05): strike → the read for it; the strike label wears a silver "you" */
  marks?: ReadonlyMap<number, string>;
  onPointer?: (cell: SurfaceCell | null, clientX: number, clientY: number) => void;
  onSelectStrike?: (strike: number) => void;
}

const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */
const PUT_INK = '#F5C542';
const CALL_INK = '#7ABDD7';
/** The strike and its tag slot — "497.50" plus two short tags on one right edge */
const STRIKE_W = 104;
/** A row never thinner than this — past it the grid scrolls */
const ROW_MIN = 18;
const SPOT_H = 18;
const HEAD_H = 44;
const fmtStrike = (v: number) => (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2));
/** The figure for a narrow cell — "272M" where "-$272.1M" would not fit (All at
    forty columns): four glyphs at most, no sign — the capsule's colour IS the
    sign on every ramp, and the read line carries the signed figure */
const fmtShortUsd = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1e9) return `${(a / 1e9).toFixed(a >= 1e10 ? 0 : 1)}B`;
  if (a >= 1e6) return `${Math.round(a / 1e6)}M`;
  if (a >= 1e3) return `${Math.round(a / 1e3)}K`;
  return a.toFixed(0);
};
/** What a cell prints: the full figure, the short one, or the colour alone */
type Figure = 'full' | 'short' | 'none';
const GREEK_LABEL: Record<Greek, string> = { gex: 'GEX', dex: 'DEX', vex: 'VEX', vanna: 'VANNA', charm: 'CHARM' };
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

interface Focus {
  strike: number;
  e: number;
  greek: Greek;
}

/** One figure of the read line: the word quiet, the number in its ink */
const Read = ({ k, v, ink, bold }: { k: string; v: string; ink?: string; bold?: boolean }) => (
  <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
    <span className="text-[8px] uppercase tracking-widest text-textMuted">{k}</span>
    <span className={`text-[11px] tnum ${bold ? 'font-bold' : ''}`} style={{ color: ink ?? '#EDEDED' }}>
      {v}
    </span>
  </span>
);

/* THE CELL, MEMOISED FOR REAL (2026-09-06, the perf sweep). The pill was
   memo'd but every cell handed it a fresh closure and a fresh star element
   on every render, so a tick re-rendered all eight hundred — 35ms of every
   desk open and a slice of every scan tick. The cell now takes primitives
   and two stable handlers, and its figures are rounded to the three digits
   the pill prints: a tick that does not move a printed figure does not
   touch that cell. */
const q3 = (x: number) => (x === 0 ? 0 : Number(x.toPrecision(3)));

interface LedgerCellProps {
  strike: number;
  e: number;
  g: Greek;
  v: number;
  maxAbs: number;
  date: string;
  first: boolean;
  wash: string;
  isKing: boolean;
  ring?: string;
  star: boolean;
  fontSize: number;
  figure: Figure;
  mode?: HeatMode;
  /** The pinned cell — the one the focus mode keeps sharp */
  pinned?: boolean;
  onHover: (f: Focus | null, x: number, y: number) => void;
  onPick: (f: Focus) => void;
}

const LedgerCell = memo(({ strike, e, g, v, maxAbs, date, first, wash, isKing, ring, star, fontSize, figure, mode, pinned, onHover, onPick }: LedgerCellProps) => (
  <div
    data-cell
    data-pinned={pinned ? '' : undefined}
    className={`min-w-0 px-[3px] py-[2px] ${first ? 'border-l border-borderSubtle/60' : ''} ${wash}`}
    onPointerEnter={ev => onHover({ strike, e, greek: g }, ev.clientX, ev.clientY)}
    onPointerMove={ev => onHover({ strike, e, greek: g }, ev.clientX, ev.clientY)}
    onPointerLeave={ev => onHover(null, ev.clientX, ev.clientY)}
    onClick={() => onPick({ strike, e, greek: g })}
  >
    <HeatPill
      value={v}
      maxAbs={maxAbs}
      className={`h-full ${isKing ? 'font-bold' : ''}`}
      fontSize={fontSize}
      mode={mode}
      tight={figure !== 'full'}
      selected={!!ring}
      ringColor={ring}
      // The star needs a lane of its own; in a narrow column (All at 24
      // columns) the ring and the read line carry the supreme instead
      marker={star ? <span className="text-textPrimary">★</span> : undefined}
      title={`${GREEK_LABEL[g]} · ${date} · ${fmtUsd(v)}${isKing ? ' · the heaviest cell' : ''}`}
    >
      {figure === 'full' ? fmtUsd(v) : figure === 'short' ? fmtShortUsd(v) : ''}
    </HeatPill>
  </div>
));

const ExposureLedger = ({ surface, liveSpot, greeks, depth, rings, hoverStrike, palette = 'house', afterBell = false, selectedStrike, marks, onPointer, onSelectStrike }: ExposureLedgerProps) => {
  const mode = palette === 'thermal' ? ('thermal-yellow' as const) : undefined;
  /* THE COLUMNS, as surface indices — after the bell today's is gone and the
     next `depth` expiries step forward: the book at the next open. */
  const todayIdx = surface.expiries.findIndex(e => e.dte === 0);
  const shownIdx = useMemo(() => {
    const all = surface.expiries.map((_, i) => i);
    const live = afterBell && todayIdx >= 0 ? all.filter(i => i !== todayIdx) : all;
    return live.slice(0, Math.max(1, depth));
  }, [surface, afterBell, todayIdx, depth]);
  // Descending, the ledger's way — the window's rings each side of spot
  const { above, below } = useMemo(() => {
    const desc = [...surface.strikes].sort((a, b) => b - a);
    return {
      above: desc.filter(s => s >= surface.spot).slice(-Math.max(1, rings)),
      below: desc.filter(s => s < surface.spot).slice(0, Math.max(1, rings)),
    };
  }, [surface, rings]);
  const strikes = useMemo(() => [...above, ...below], [above, below]);
  const cols = greeks.length * shownIdx.length;
  const pinStrike = surface.front.strikes.find(r => r.pin)?.strike;
  /* THE SUPREME on the columns DRAWN: the book's heaviest strike, on whichever
     drawn date carries most of it (after the bell, today is out of the running) */
  const supremeFor = useCallback(
    (g: Greek) => {
      const sup = surface.supreme[g];
      if (shownIdx.includes(sup.e)) return { strike: sup.strike, e: sup.e, value: sup.value };
      const si = surface.strikes.indexOf(sup.strike);
      let best = { strike: sup.strike, e: shownIdx[0] ?? 0, value: 0 };
      if (si >= 0)
        for (const e of shownIdx) {
          const v = surface.net[g][e][si] ?? 0;
          if (Math.abs(v) > Math.abs(best.value)) best = { strike: sup.strike, e, value: v };
        }
      return best;
    },
    [surface, shownIdx]
  );
  /* The heaviest CELL among the columns DRAWN — the star, never the supreme */
  const kingFor = useCallback(
    (g: Greek) => {
      const k = surface.king[g];
      if (shownIdx.includes(k.e)) return k;
      let best = { strike: strikes[0] ?? surface.spot, e: shownIdx[0] ?? 0, value: 0 };
      for (const e of shownIdx)
        for (const strike of strikes) {
          const v = surface.net[g][e][surface.strikes.indexOf(strike)] ?? 0;
          if (Math.abs(v) > Math.abs(best.value)) best = { strike, e, value: v };
        }
      return best;
    },
    [surface, shownIdx, strikes]
  );

  /* THE ROWS FILL THE HEIGHT — measured so the figure inside can scale with them */
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const read = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      setBox(prev => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    /* A FRAME AFTER THE COMMIT (2026-09-06, the perf sweep): read inside it,
       the two sizes forced the desk's whole layout early — 16ms of every
       open on the profiler. The grid stays invisible for that one frame
       (see the body below) so the figures never pop from 9px to 13px. And
       not per frame of a sidebar glide either: once, when it ends. */
    const first = requestAnimationFrame(read);
    const ro = new ResizeObserver(() => afterGlide(read));
    ro.observe(el);
    /* …unless the host has promised where it is going (the desk's tiles,
       2026-09-12): then once at the START, for that width, so the figures fit
       the destination from the first frame of the glide */
    const off = onGlide(
      () => {
        const w = promisedWidth(el);
        if (w != null) setBox(prev => (prev.w === w ? prev : { w, h: prev.h }));
      },
      () => undefined
    );
    return () => {
      cancelAnimationFrame(first);
      ro.disconnect();
      off();
    };
  }, []);
  const rowH = Math.max(ROW_MIN, (box.h - HEAD_H - SPOT_H) / Math.max(1, strikes.length));
  // The figure scales with the row AND must fit the column: "-$272.1M" is eight
  // mono glyphs at ~0.62em each inside the capsule's 16px of padding (All at
  // 24 columns on a 1900 screen truncated at 13px — measured 2026-09-05).
  const cellW = (box.w - STRIKE_W) / Math.max(1, cols);
  const fontSize = clamp(Math.min(rowH * 0.46, (cellW - 22) / (8 * 0.68)), 9, 13);
  /* Under 71px the full figure no longer fits at 9px (All at forty columns
     on a page-width calendar): print the short one on half the padding, and
     under 42px nothing — the colour is the read, the read line carries the
     figure. The date heads lose their "· 2d" the same way. */
  const figure: Figure = cellW >= 71 ? 'full' : cellW >= 42 ? 'short' : 'none';
  const narrowHead = cellW < 60;
  const rowsTemplate = [
    `${HEAD_H / 2}px ${HEAD_H / 2}px`,
    above.length ? `repeat(${above.length}, minmax(${ROW_MIN}px, 1fr))` : '',
    `${SPOT_H}px`,
    below.length ? `repeat(${below.length}, minmax(${ROW_MIN}px, 1fr))` : '',
  ]
    .filter(Boolean)
    .join(' ');

  /* FOCUS: the pinned cell holds, else the hovered, else the supreme */
  const [hovered, setHovered] = useState<Focus | null>(null);
  const [pinned, setPinned] = useState<Focus | null>(null);
  const heaviestExpiry = useCallback(
    (strike: number, g: Greek) => {
      const s = surface.strikes.indexOf(strike);
      let best = 0;
      let bestV = -1;
      for (const e of shownIdx) {
        const v = Math.abs(surface.net[g][e][s] ?? 0);
        if (v > bestV) {
          bestV = v;
          best = e;
        }
      }
      return best;
    },
    [surface, shownIdx]
  );
  // The host owns the strike; the cell (its expiry) is ours — keep the two in step
  useEffect(() => {
    if (selectedStrike == null) setPinned(null);
    else setPinned(prev => (prev && prev.strike === selectedStrike ? prev : { strike: selectedStrike, e: heaviestExpiry(selectedStrike, greeks[0]), greek: greeks[0] }));
  }, [selectedStrike, heaviestExpiry, greeks]);
  useEffect(() => {
    setPinned(prev => (prev && !greeks.includes(prev.greek) ? { ...prev, greek: greeks[0] } : prev));
  }, [greeks]);

  const hoverCell = (f: Focus | null, x: number, y: number) => {
    setHovered(prev => (prev?.strike === f?.strike && prev?.e === f?.e && prev?.greek === f?.greek ? prev : f));
    onPointer?.(f ? { strike: f.strike, e: f.e } : null, x, y);
  };
  /* Stable handles for the memoised cells — the latest closures behind them */
  const hoverRef = useRef(hoverCell);
  hoverRef.current = hoverCell;
  const onHoverCell = useCallback((f: Focus | null, x: number, y: number) => hoverRef.current(f, x, y), []);
  const pick = (cell: Focus | null) => {
    if (!cell) {
      if (pinned) onSelectStrike?.(pinned.strike); // the host toggles it off
      return;
    }
    if (pinned && pinned.strike === cell.strike) {
      if (pinned.e === cell.e && pinned.greek === cell.greek) onSelectStrike?.(cell.strike); // the same cell again — let go
      else setPinned(cell); // the same strike, another cell — the pin moves along the row
      return;
    }
    setPinned(cell);
    onSelectStrike?.(cell.strike);
  };
  const pickRef = useRef(pick);
  pickRef.current = pick;
  const onPickCell = useCallback((cell: Focus) => pickRef.current(cell), []);

  /* THE FOCUS MODE (Noah, 2026-09-07): while a cell is pinned, that node stays
     sharp and the rest of the calendar softens behind it — and a click ANYWHERE
     outside it lets go (another cell moves the pin instead; the head's controls
     and any other button are not "outside"). The rule itself is CSS in
     index.css off `data-ledger-focus`; this only says when it is on. */
  /* NOT "OUTSIDE" EITHER: the surfaces that pick a strike themselves — the
     Map's profile panel and the position gutter — own their own toggle. This
     listener runs AFTER React's (the root hears the click first, the document
     last), so on a panel click it used to re-toggle the strike the panel had
     just let go of, and the focus could never be left from the panel (Noah,
     2026-09-10: "clicking the strike row of the focus should allow me to exit
     the focus mode"). */
  useEffect(() => {
    if (!pinned) return;
    const h = (ev: MouseEvent) => {
      const t = ev.target as Element | null;
      if (t?.closest('[data-cell],[data-strike],[data-profile-panel],[data-position-gutter],[data-dropdown],[data-dropdown-card],[role="menu"],[data-focus-chip],[data-guide-door],button,a,input,select,textarea')) return;
      pickRef.current(null);
    };
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, [pinned]);

  const supremeGreek = greeks[0];
  const supremeDefault = supremeFor(supremeGreek);
  const focus: Focus = pinned ?? hovered ?? { strike: supremeDefault.strike, e: supremeDefault.e, greek: supremeGreek };
  const why = pinned ? 'in focus · click anywhere outside to let go' : hovered ? 'under the pointer' : 'the supreme · hover a cell';
  const fs = surface.strikes.indexOf(focus.strike);
  const ex = surface.expiries[focus.e];
  const putV = fs >= 0 ? surface.put[focus.greek][focus.e][fs] : 0;
  const callV = fs >= 0 ? surface.call[focus.greek][focus.e][fs] : 0;
  const netV = fs >= 0 ? surface.net[focus.greek][focus.e][fs] : 0;
  const oi = fs >= 0 ? surface.oi[focus.e][fs] : 0;
  const gexV = fs >= 0 ? surface.net.gex[focus.e][fs] : 0;
  const distPct = ((focus.strike - surface.spot) / surface.spot) * 100;
  const kingHere = kingFor(focus.greek);
  const isKingCell = kingHere.strike === focus.strike && kingHere.e === focus.e;
  const isSupreme = surface.supreme[focus.greek].strike === focus.strike;
  /* HOW MUCH OF THIS BOOK DIES AT THE BELL — today's column against every
     column drawn (today counted back in when it is hidden), in the window */
  const bell = (() => {
    if (todayIdx < 0) return null;
    // The same book either way: today plus the columns that stand beside it
    // NOW — so the figure does not move when the toggle flips
    const all = shownIdx.includes(todayIdx) ? shownIdx : [todayIdx, ...shownIdx.slice(0, Math.max(0, shownIdx.length - 1))];
    let dies = 0;
    let total = 0;
    for (const e of all)
      for (const strike of strikes) {
        const v = Math.abs(surface.net[focus.greek][e][surface.strikes.indexOf(strike)] ?? 0);
        total += v;
        if (e === todayIdx) dies += v;
      }
    return total > 0 ? Math.round((100 * dies) / total) : 0;
  })();
  const bellWords = bell == null ? null : afterBell ? `after the close · today's ${bell}% has expired` : `${bell}% of this expires today at 4:00`;
  const verdict =
    focus.greek === 'gex'
      ? gexV >= 0
        ? 'peak — dealer hedging amplifies a move here'
        : 'well — dealer hedging absorbs one here'
      : netV >= 0
        ? 'the put side wins here'
        : 'the call side wins here';
  const verdictInk = focus.greek === 'gex' ? (gexV >= 0 ? SHORT_GAMMA : LONG_GAMMA) : netInk(focus.greek, netV);
  const { levels } = surface;
  const role = focus.strike === levels.callWall ? 'call wall' : focus.strike === levels.putWall ? 'put wall' : focus.strike === pinStrike ? 'pin' : null;
  /* While a node is in focus the pointer stops washing rows and columns — two
     highlights at once is no highlight */
  const hoverRow = pinned ? null : (hovered?.strike ?? hoverStrike ?? null);
  /* The scrim's blur outlives the pin by the length of its fade — dropping the
     radius the moment the pin goes would un-blur the grid in one frame under a
     scrim that is still fading. Between times the layer sits at blur(0), which
     measured free. */
  const [scrim, setScrim] = useState(false);
  useEffect(() => {
    if (pinned) {
      setScrim(true);
      return;
    }
    const t = window.setTimeout(() => setScrim(false), 460);
    return () => window.clearTimeout(t);
  }, [pinned]);
  /* The star and the supreme per greek, once per render rather than once per cell */
  const kings = useMemo(() => new Map(greeks.map(g => [g, kingFor(g)] as const)), [greeks, kingFor]);
  const supremes = useMemo(() => new Map(greeks.map(g => [g, supremeFor(g)] as const)), [greeks, supremeFor]);
  const supremeStrike = surface.supreme[supremeGreek].strike;
  /** A row's tags, most telling first, two at most: yours, the wall, the pin */
  const tagsFor = (strike: number): string[] => {
    const t: string[] = [];
    if (marks?.has(strike)) t.push('you');
    if (strike === levels.callWall) t.push('cw');
    if (strike === levels.putWall) t.push('pw');
    if (strike === pinStrike) t.push('pin');
    return t.slice(0, 2);
  };
  const showStar = cellW >= 96;

  return (
    <div className="h-full min-h-0 flex flex-col" data-ledger>
      {/* THE READ LINE — one fixed line, never a card under the pointer */}
      <div className="shrink-0 flex items-center gap-x-5 gap-y-1 flex-wrap px-3 py-2 border-b border-borderSubtle/60 font-mono select-none" data-readline>
        <span className="inline-flex items-baseline gap-2 whitespace-nowrap">
          <span className="text-[13px] font-bold text-textPrimary tnum">{fmtStrike(focus.strike)}</span>
          {role && <span className="text-[8px] uppercase tracking-widest text-textSecondary">{role}</span>}
          <span className="text-[10px] text-textSecondary">
            {ex?.date ?? ''} <span className="text-textMuted">· {focus.e === todayIdx ? 'today' : (ex?.short ?? '')}</span>
          </span>
          <span className="text-[9px] text-textMuted tnum">
            {distPct >= 0 ? '+' : ''}
            {distPct.toFixed(2)}% · OI {oi.toLocaleString('en-US')}
          </span>
          {isSupreme && (
            <span className="text-[8px] font-bold uppercase tracking-widest" style={{ color: SUPREME }}>
              supreme
            </span>
          )}
          {isKingCell && <span className="text-[8px] uppercase tracking-widest text-textSecondary">★ heaviest cell</span>}
        </span>
        <span className="inline-flex items-baseline gap-3 whitespace-nowrap">
          <span className="text-[8px] uppercase tracking-widest text-textSecondary">
            {GREEK_LABEL[focus.greek]} <span className="text-textMuted/70 normal-case tracking-normal">· $ per {GREEK_UNIT[focus.greek]}</span>
          </span>
          <Read k="put" v={fmtUsd(putV)} ink={PUT_INK} />
          <Read k="call" v={fmtUsd(callV)} ink={CALL_INK} />
          {/* the net figure in the ramp the capsule wears (the ladder's rule, 2026-09-12); the verdict's WORDS keep the regime inks */}
          <Read k="net" v={fmtUsd(netV)} ink={heatLaneColor(netV, surface.maxAbs[focus.greek], mode ?? HEAT_MODE, 0.35)} bold />
        </span>
        <span className="text-[9px] tracking-wide whitespace-nowrap" style={{ color: verdictInk }}>
          {verdict}
        </span>
        <span className="ml-auto inline-flex items-baseline gap-4 font-mono text-[8px] uppercase tracking-widest whitespace-nowrap">
          {bellWords && <span className={afterBell ? 'text-textPrimary' : 'text-textSecondary'}>{bellWords}</span>}
          <span className={pinned ? 'text-textSecondary' : 'text-textMuted'}>{why}</span>
        </span>
      </div>

      {/* THE GRID — rows share the height; past ROW_MIN it scrolls */}
      <div className="relative flex-1 min-h-0">
        {/* THE FOCUS SCRIM — one layer for the blur and the dim (see index.css) */}
        <div
          aria-hidden
          data-ledger-scrim={pinned ? '' : undefined}
          className={`pointer-events-none absolute inset-0 z-20 transition-opacity duration-[420ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${pinned ? 'opacity-100' : 'opacity-0'}`}
          /* ONLY THE OPACITY ANIMATES. The radius holds while the scrim is up
             and the layer stays mounted at blur(0) between times, so the first
             frame has nothing to allocate. Measured on a 320-cell calendar,
             frames in 700ms against 101 idle: blurring every cell 46 (a 120ms
             stall) · this 94 in and 101 out · easing the radius on the scrim
             instead 85 and 89 — re-blurring the backdrop every frame costs
             more than the fade is worth. */
          style={{ backdropFilter: `blur(${scrim ? 3 : 0}px)`, WebkitBackdropFilter: `blur(${scrim ? 3 : 0}px)`, background: 'rgba(10,10,10,0.66)' }}
        />
        <div
          ref={boxRef}
          className="h-full overflow-auto"
          /* Invisible for the one frame before its box is measured (see the effect above) */
          style={box.w ? undefined : { visibility: 'hidden' }}
        >
        {/* Keyed on the head's choices: a change of greek, expiries, window or
            palette FADES the new grid in rather than snapping (Noah, 2026-09-05:
            "a smooth transition between changes … same with the heatmap") */}
        <div
          key={`${greeks.join(',')}-${shownIdx.join('|')}-${rings}-${palette}-${afterBell ? 'after' : 'now'}`}
          data-ledger-focus={pinned ? '' : undefined}
          className="grid min-h-full animate-fade-in"
          style={{ gridTemplateColumns: `${STRIKE_W}px repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: rowsTemplate }}
        >
          {/* HEAD — sticky under scroll */}
          <div className="sticky top-0 z-10 bg-panel px-2 flex items-end pb-1 font-mono text-[9px] font-semibold uppercase tracking-widest text-textSecondary border-b border-borderSubtle" style={{ gridRow: 'span 2' }}>
            Strike
          </div>
          {greeks.map(g => (
            <div
              key={`g-${g}`}
              className="sticky top-0 z-10 bg-panel px-2 flex items-center justify-center font-mono text-[10px] font-bold uppercase tracking-widest text-textPrimary border-l border-borderSubtle"
              style={{ gridColumn: `span ${shownIdx.length}` }}
            >
              {GREEK_LABEL[g]} <span className="ml-1 font-normal text-textMuted">· {GREEK_UNIT[g]}</span>
            </div>
          ))}
          {greeks.map(g =>
            shownIdx.map((e, ci) => {
              const exp = surface.expiries[e];
              return (
                <div
                  key={`h-${g}-${exp.dte}`}
                  data-exp-head
                  data-pinned-col={pinned && pinned.greek === g && pinned.e === e ? '' : undefined}
                  className={`sticky z-10 bg-panel ${narrowHead ? 'px-1 overflow-hidden' : 'px-2'} flex items-center justify-end font-mono text-[9px] uppercase tracking-wider text-textSecondary border-b border-borderSubtle whitespace-nowrap ${
                    ci === 0 ? 'border-l' : ''
                  } ${(pinned ? pinned.greek === g && pinned.e === e : hovered && hovered.greek === g && hovered.e === e) ? 'text-textPrimary' : ''}`}
                  style={{ top: HEAD_H / 2 }}
                >
                  <span className={e === todayIdx ? 'text-textPrimary font-bold' : ''}>{exp.date}</span>
                  {!narrowHead && <span className="text-textMuted">&nbsp;· {e === todayIdx ? 'today' : exp.short}</span>}
                </div>
              );
            })
          )}

          {/* ROWS */}
          {strikes.map((strike, si) => {
            const s = surface.strikes.indexOf(strike);
            const isPinnedRow = strike === pinned?.strike;
            const isSupremeRow = strike === supremeStrike;
            const isHoverRow = strike === hoverRow;
            const rowWash = isHoverRow ? 'bg-silver/[0.05]' : '';
            return [
              si === above.length && (
                <div key="spot" className="px-2 flex items-center" style={{ gridColumn: `span ${cols + 1}` }}>
                  <SpotRule ticker={surface.ticker} price={liveSpot ?? surface.spot} />
                </div>
              ),
              <div
                key={`s-${strike}`}
                data-strike={strike}
                data-pinned-row={isPinnedRow ? '' : undefined}
                onClick={() => onSelectStrike?.(strike)}
                className={`px-2 flex items-center gap-1.5 overflow-hidden font-mono text-[11px] tnum cursor-pointer ${rowWash} ${
                  isPinnedRow ? 'text-silver font-bold shadow-[inset_2px_0_0_0_rgba(199,211,232,0.7)]' : isSupremeRow ? 'font-bold' : 'text-textPrimary'
                }`}
                style={!isPinnedRow && isSupremeRow ? { color: SUPREME } : undefined}
                data-supreme-row={isSupremeRow ? '' : undefined}
              >
                {/* THE SUPREME is the strike printed in magenta — the chart's ink, no word
                    (a word did not fit beside "497.50"); THE TAGS share one right-aligned
                    slot, two at most, so they stand on one edge down the column
                    (Noah, 2026-09-08: "supreme, you, and pin … look crooked") */}
                {fmtStrike(strike)}
                <span className="ml-auto inline-flex items-center gap-1 text-[8px] uppercase tracking-widest whitespace-nowrap" data-row-tags>
                  {tagsFor(strike).map(t => (
                    <span key={t} className={t === 'you' ? 'text-silver' : 'text-textMuted'} title={t === 'you' ? marks?.get(strike) : undefined} data-yours={t === 'you' ? '' : undefined}>
                      {t}
                    </span>
                  ))}
                </span>
              </div>,
              ...greeks.flatMap(g => {
                const king = kings.get(g)!;
                const sup = supremes.get(g)!;
                const maxAbs = q3(surface.maxAbs[g]);
                return shownIdx.map((e, ci) => {
                  const exp = surface.expiries[e];
                  const isKing = king.e === e && king.strike === strike;
                  const isSupremeCell = sup.e === e && sup.strike === strike;
                  const isPinned = !!pinned && pinned.strike === strike && pinned.e === e && pinned.greek === g;
                  const isHover = !pinned && !!hovered && hovered.strike === strike && hovered.e === e && hovered.greek === g;
                  const colWash = !pinned && hovered && hovered.greek === g && hovered.e === e && !isHoverRow ? 'bg-silver/[0.05]' : '';
                  const ring = isHover || isPinned ? SILVER : isSupremeCell ? SUPREME : undefined;
                  return (
                    <LedgerCell
                      key={`c-${g}-${exp.dte}-${strike}`}
                      strike={strike}
                      e={e}
                      g={g}
                      v={q3(surface.net[g][e][s])}
                      maxAbs={maxAbs}
                      date={exp.date}
                      first={ci === 0}
                      wash={rowWash || colWash}
                      isKing={isKing}
                      ring={ring}
                      star={isKing && showStar}
                      fontSize={fontSize}
                      figure={figure}
                      mode={mode}
                      pinned={isPinned}
                      onHover={onHoverCell}
                      onPick={onPickCell}
                    />
                  );
                });
              }),
            ];
          })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExposureLedger;
