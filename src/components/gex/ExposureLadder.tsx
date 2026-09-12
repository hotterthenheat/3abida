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
==================================================
*/

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { HeatMode } from './heatmap';
import { HEAT_MODE, heatLaneColor } from './heatmap';
import SpotRule from '../ui/SpotRule';
import { fmtUsd } from '../../data/gex';
import { GREEKS, GREEK_UNIT, type ExposureSurface, type Greek } from '../../data/exposureSurface';
import { CALL_WALL, FLIP, PUT_WALL, SUPREME } from './palette';
import { afterGlide } from '../../core/glide';
import type { SurfaceCell } from './exposureView';

interface ExposureLadderProps {
  surface: ExposureSurface;
  liveSpot?: number;
  /** The greeks drawn, in the book's order — one, some, or all five */
  greeks: Greek[];
  depth: number;
  rings: number;
  hoverStrike?: number | null;
  palette?: 'house' | 'thermal';
  afterBell?: boolean;
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
const HEAD_H = 28;
const SPOT_H = 18;
const fmtStrike = (v: number) => (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2));

interface Row {
  strike: number;
  /** Per greek: the legs summed over the expiries drawn */
  legs: Record<Greek, { put: number; call: number; net: number }>;
}

const ExposureLadder = ({ surface, liveSpot, greeks, depth, rings, hoverStrike, palette = 'house', afterBell = false, selectedStrike, marks, onPointer, onSelectStrike, lead: leadProp, onLead }: ExposureLadderProps) => {
  /* the lead greek — the host's pick when it is among the greeks drawn, else the first */
  const lead: Greek = leadProp && greeks.includes(leadProp) ? leadProp : greeks[0];
  const mode: HeatMode = palette === 'thermal' ? 'thermal-yellow' : HEAT_MODE;
  /* THE EXPIRIES DRAWN — the Ledger's own rule, so both views sum the same book */
  const todayIdx = surface.expiries.findIndex(e => e.dte === 0);
  const shownIdx = useMemo(() => {
    const all = surface.expiries.map((_, i) => i);
    const live = afterBell && todayIdx >= 0 ? all.filter(i => i !== todayIdx) : all;
    return live.slice(0, Math.max(1, depth));
  }, [surface, afterBell, todayIdx, depth]);
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
      const o = outer.getBoundingClientRect();
      const h = head.getBoundingClientRect();
      const r = rows.getBoundingClientRect();
      const next = { left: Math.round(h.left - o.left), width: Math.round(h.width), top: Math.round(h.top - o.top), bottom: Math.round(o.bottom - r.bottom) };
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
  const rowH = Math.max(ROW_MIN, (boxH - SPOT_H) / Math.max(1, rows.length));
  const fontSize = Math.max(9.5, Math.min(12, rowH * 0.46));

  const { levels } = surface;
  const pinStrike = surface.front.strikes.find(r => r.pin)?.strike;
  const tagFor = (strike: number): { word: string; ink: string } | null =>
    strike === levels.supreme ? { word: 'supreme', ink: SUPREME }
    : strike === levels.callWall ? { word: 'call wall', ink: CALL_WALL }
    : strike === levels.putWall ? { word: 'put wall', ink: PUT_WALL }
    : strike === levels.flip ? { word: 'flip', ink: FLIP }
    : strike === pinStrike ? { word: 'pin', ink: '#7d7d7d' }
    : null;

  const one = greeks.length === 1;
  /* LEGS WHEN THEY FIT, NETS WHEN THEY DO NOT (Noah, 2026-09-12, on All five:
     "it looks so cramped and i cant tell what from what"). Three greeks or
     fewer keep their four columns — put · call · net · the book (Noah,
     2026-09-10: "the put call just disappears after 2 greeks"); four or five
     show each greek as its net and its bar, ten columns instead of twenty,
     every bar three times wider, the legs a click away (one greek, the read
     card, the read line). Every greek is ONE GROUP CELL with its own inner
     grid, a hairline at its left edge and an alternating wash down the
     ladder, so the eye follows a greek without counting columns. */
  const compact = greeks.length >= 4;
  /* Room for the figures and their bands (Noah, 2026-09-10: "provide more
     spacing for the put/call and net") — 104 · 104 · 112, 16px between */
  const LEGS = '104px 104px 112px minmax(140px,1fr)';
  /* five nets fit the calendar's box at 1905 without a scroll (measured: five
     groups of 278px inside 1605 with the strike column and the gutters) */
  const NETS = '104px minmax(120px,1fr)';
  const inner = compact ? NETS : LEGS;
  const groupMin = compact ? 104 + 120 + 16 + 12 : 104 + 104 + 112 + 140 + 48 + 12;
  const cols = one ? `112px ${LEGS}` : `112px ${greeks.map(() => `minmax(${groupMin}px, 1fr)`).join(' ')}`;
  const minW = 112 + greeks.length * groupMin + 24 + (one ? 64 : greeks.length * 16);
  /* A group cell: its inner grid, the hairline, the wash on every other greek */
  const groupClass = (i: number) => `grid items-center gap-x-4 h-full min-w-0 pl-3 -ml-1 border-l border-borderSubtle/60 ${i % 2 === 1 ? 'bg-ink/[0.02]' : ''}`;

  /* A FIGURE WITH ITS MINI BAND (Noah, 2026-09-10, his partner's rows: "there
     is no mini band for each strike as shown in the image"): the number, and
     under it a two-pixel band from the cell's left edge, its length the
     figure against the column's heaviest — the ratio at a glance. The band
     has NO TRACK behind it (the empty tracks read as "random white lines" on
     tall rows — Noah, later the same night). The net wears a pill in its
     sign's ink. */
  const Cell = ({ v, max, ink, bold, pill, testId }: { v: number; max: number; ink: string; bold?: boolean; pill?: boolean; testId: string }) => {
    const share = v === 0 ? 0 : Math.min(1, Math.abs(v) / max);
    const zero = v === 0;
    return (
      <span className="flex flex-col items-end justify-center gap-[2px] min-w-0" {...{ [testId]: Math.round(share * 100) }}>
        <span
          className={`font-mono tnum leading-none whitespace-nowrap ${bold ? 'font-bold' : ''} ${pill ? 'px-1 py-px rounded-[3px]' : ''}`}
          style={{ color: zero ? 'rgb(var(--text-muted))' : ink, ...(pill && !zero ? { background: `${ink}1f`, boxShadow: `inset 0 0 0 1px ${ink}55` } : {}) }}
        >
          {fmtUsd(v)}
        </span>
        <span className="relative block w-full h-[2px]" aria-hidden>
          <span className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500" style={{ width: `${share * 100}%`, background: ink, opacity: 0.85, transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }} />
        </span>
      </span>
    );
  };

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

  const rowEl = (r: Row) => {
    const kept = keptStrike != null && Math.abs(keptStrike - r.strike) < 1e-9;
    const washed = !pinned && ((hoverStrike != null && Math.abs(hoverStrike - r.strike) < 1e-9) || (hovered != null && Math.abs(hovered - r.strike) < 1e-9));
    const tag = tagFor(r.strike);
    const you = marks?.get(r.strike);
    return (
      <div
        key={r.strike}
        role="row"
        className={`grid items-center gap-x-4 px-3 border-b border-borderSubtle/40 cursor-pointer transition-colors ${kept ? 'relative z-30 bg-silver/[0.06] shadow-[inset_2px_0_0_0_rgba(199,211,232,0.7)]' : washed ? 'bg-silver/[0.04]' : 'hover:bg-ink/[0.03]'}`}
        style={{ gridTemplateColumns: cols, height: rowH, fontSize }}
        onPointerEnter={ev => {
          setHovered(r.strike);
          onPointer?.({ strike: r.strike, e: shownIdx[0] ?? 0 }, ev.clientX, ev.clientY);
        }}
        onPointerLeave={ev => {
          setHovered(h => (h === r.strike ? null : h));
          onPointer?.(null, ev.clientX, ev.clientY);
        }}
        onClick={() => onSelectStrike?.(r.strike)}
        data-ladder-row={r.strike}
        data-kept={kept || undefined}
        title={kept ? 'Kept · click to let go' : 'Click to keep this strike'}
      >
        <span className="flex items-center gap-1.5 min-w-0 font-mono tnum">
          <span className={`font-semibold ${kept ? 'text-silver' : 'text-textPrimary'}`}>{fmtStrike(r.strike)}</span>
          {tag && (
            <span className="uppercase tracking-widest whitespace-nowrap" style={{ color: tag.ink, fontSize: '8px' }}>
              {tag.word}
            </span>
          )}
          {you && (
            <span className="uppercase tracking-widest whitespace-nowrap" style={{ color: SILVER, fontSize: '8px' }} title={you}>
              you
            </span>
          )}
        </span>
        {greeks.map((g, gi) => {
          const l = r.legs[g];
          const share = Math.min(1, Math.abs(l.net) / maxAbs[g]);
          const fill = heatLaneColor(l.net, maxAbs[g], mode, 0.35);
          const barH = Math.max(4, Math.round(rowH * 0.34));
          /* THE BOOK DIVERGES FROM A CENTRE LINE (Noah, 2026-09-10: "making
             the put heavy net and the call heavy net going in different
             directions to cover more space"): a put-heavy net (positive)
             grows right, a call-heavy net (negative) grows left, both
             against the heaviest row shown, so the two signs read apart. */
          const bar = (
            <span className="relative block h-full min-w-0" aria-hidden>
              <span className="absolute inset-y-0 left-1/2 w-px bg-ink/[0.10]" />
              <span
                className="absolute inset-y-0 my-auto transition-[width] duration-500"
                style={{
                  height: barH,
                  width: `${share * 50}%`,
                  background: fill,
                  ...(l.net >= 0 ? { left: '50%', borderRadius: `0 ${barH}px ${barH}px 0` } : { right: '50%', borderRadius: `${barH}px 0 0 ${barH}px` }),
                  transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              />
            </span>
          );
          /* ONE FACT, ONE INK (Noah, 2026-09-10: "does it make sense that the
             net is green but the book color is blue?"): the net and the bar
             are the same verdict — what the hedging does at this strike — so
             the pill, its band and the bar share the calendar's own ramp
             (the Colours card: blue absorbs, orange to red amplifies). Red and
             green on this row mean one thing only: the put side, the call
             side. */
          const cells = (
            <>
              {!compact && <Cell v={l.put} max={maxLeg[g].put} ink={PUT_INK} testId="data-ladder-put" />}
              {!compact && <Cell v={l.call} max={maxLeg[g].call} ink={CALL_INK} testId="data-ladder-call" />}
              <Cell v={l.net} max={maxAbs[g]} ink={fill} bold pill testId="data-ladder-net" />
              <span className="h-full py-1" data-ladder-bar={Math.round(share * 100)} data-ladder-side={l.net >= 0 ? 'put' : 'call'}>{bar}</span>
            </>
          );
          if (one) return <Fragment key={g}>{cells}</Fragment>;
          return (
            <span key={g} className={groupClass(gi)} style={{ gridTemplateColumns: inner }} data-ladder-group={g}>
              {cells}
            </span>
          );
        })}
      </div>
    );
  };

  /* THE READ LINE — the calendar's: the strike in focus (kept, else under
     the pointer, else the supreme), its tag, its distance, its figures for
     every greek drawn, the verdict, and why it is the one shown */
  const focusStrike = keptStrike ?? hovered ?? hoverStrike ?? levels.supreme;
  const focusRow = rows.find(r => Math.abs(r.strike - focusStrike) < 1e-9) ?? rows[0];
  const why = pinned ? 'in focus · click anywhere outside to let go' : hovered != null || hoverStrike != null ? 'under the pointer' : 'the supreme · hover a row';
  const readLine = focusRow ? (() => {
    const tag = tagFor(focusRow.strike);
    const distPct = ((focusRow.strike - surface.spot) / surface.spot) * 100;
    const leadLegs = focusRow.legs[lead];
    const verdict = leadLegs.net >= 0 ? 'put-heavy — dealer hedging amplifies a move here' : 'call-heavy — dealer hedging absorbs one here';
    const verdictInk = heatLaneColor(leadLegs.net, Math.max(1, Math.abs(leadLegs.net)), mode, 0.35);
    return (
      <div className="shrink-0 flex items-center gap-x-5 gap-y-1 flex-wrap px-3 py-2 border-b border-borderSubtle/60 font-mono select-none" data-ladder-readline data-read-strike={focusRow.strike}>
        <span className="inline-flex items-baseline gap-2 whitespace-nowrap">
          <span className="text-[13px] font-bold text-textPrimary tnum">{fmtStrike(focusRow.strike)}</span>
          {tag && (
            <span className="text-[8px] font-bold uppercase tracking-widest" style={{ color: tag.ink }}>
              {tag.word}
            </span>
          )}
          <span className="text-[9px] text-textMuted tnum">
            {distPct >= 0 ? '+' : ''}
            {distPct.toFixed(2)}% from spot · {shownIdx.length} {shownIdx.length === 1 ? 'expiry' : 'expiries'}
          </span>
        </span>
        {greeks.map(g => {
          const l = focusRow.legs[g];
          return (
            <span key={g} className="inline-flex items-baseline gap-3 whitespace-nowrap">
              <span className="text-[8px] uppercase tracking-widest text-textSecondary">
                {GREEK_LABEL[g]} <span className="text-textMuted/70 normal-case tracking-normal">· $ per {GREEK_UNIT[g]}</span>
              </span>
              <span className="inline-flex items-baseline gap-1.5"><span className="text-[8px] uppercase tracking-widest text-textMuted">put</span><span className="text-[11px] tnum" style={{ color: PUT_INK }}>{fmtUsd(l.put)}</span></span>
              <span className="inline-flex items-baseline gap-1.5"><span className="text-[8px] uppercase tracking-widest text-textMuted">call</span><span className="text-[11px] tnum" style={{ color: CALL_INK }}>{fmtUsd(l.call)}</span></span>
              <span className="inline-flex items-baseline gap-1.5"><span className="text-[8px] uppercase tracking-widest text-textMuted">net</span><span className="text-[11px] tnum font-bold" style={{ color: heatLaneColor(l.net, maxAbs[g], mode, 0.35) }}>{fmtUsd(l.net)}</span></span>
            </span>
          );
        })}
        <span className="text-[9px] tracking-wide whitespace-nowrap" style={{ color: verdictInk }}>{verdict}</span>
        <span className={`ml-auto font-mono text-[8px] uppercase tracking-widest whitespace-nowrap ${pinned ? 'text-textSecondary' : 'text-textMuted'}`} data-ladder-why>{why}</span>
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
        <div role="row" className="grid items-stretch gap-x-4 px-3 h-7 border-b border-borderSubtle/40 text-[10px] font-semibold text-textPrimary" style={{ gridTemplateColumns: cols }} data-ladder-head-greeks>
          <span />
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
      <div role="row" className="grid items-stretch gap-x-4 px-3 h-7 text-[9px] text-textSecondary" style={{ gridTemplateColumns: cols }} data-ladder-head-columns>
        <span className="flex items-center">Strike</span>
        {greeks.map((g, gi) => {
          const names = (
            <>
              {!compact && <span className="text-right">Put</span>}
              {!compact && <span className="text-right">Call</span>}
              <span className="text-right">Net</span>
              {/* the bar's two ends — the short words in the net view, where the bar column is narrower */}
              <span className="flex items-center justify-between whitespace-nowrap">
                <span>{compact ? '◂ call' : '◂ call-heavy'}</span>
                {one && <span className="text-textPrimary">The book · per {GREEK_UNIT[g]}</span>}
                <span>{compact ? 'put ▸' : 'put-heavy ▸'}</span>
              </span>
            </>
          );
          if (one) return <Fragment key={g}>{names}</Fragment>;
          return (
            <span key={g} className={groupClass(gi)} style={{ gridTemplateColumns: inner }}>
              {names}
            </span>
          );
        })}
      </div>
    </div>
  );

  const foot = (
    <div className="shrink-0 flex items-center gap-4 px-3 h-7 border-t border-borderSubtle/60 font-mono text-[10px] tnum whitespace-nowrap overflow-hidden" data-ladder-foot>
      <span className="text-[8px] uppercase tracking-widest text-textMuted">{rows.length} strikes · {shownIdx.length} {shownIdx.length === 1 ? 'expiry' : 'expiries'}</span>
      {greeks.map(g => (
        <span key={g} className="inline-flex items-baseline gap-2">
          {!one && <span className="text-[8px] uppercase tracking-widest text-textMuted">{GREEK_LABEL[g]}</span>}
          {/* the legs only where the rows show them — the net view's foot is five nets */}
          {!compact && <span style={{ color: PUT_INK }}>put {fmtUsd(totals[g].put)}</span>}
          {!compact && <span style={{ color: CALL_INK }}>call {fmtUsd(totals[g].call)}</span>}
          {/* the total's verdict in the same ramp as the rows' */}
          <span className="font-bold" style={{ color: heatLaneColor(totals[g].net, Math.max(1, Math.abs(totals[g].net)), mode, 0.35) }}>net {fmtUsd(totals[g].net)}</span>
        </span>
      ))}
    </div>
  );

  return (
    /* A DARK ISLAND on either theme: the ladder wears the heat ramp and the
       chart palette, both cut for a dark ground (Noah, 2026-09-12: "these
       ladders need gray or black as the background") */
    <div data-theme="dark" className="h-full min-h-0 flex flex-col overflow-x-auto bg-panel" data-exposure-ladder data-greeks={greeks.join(',')}>
      <div ref={outerRef} className="relative h-full min-h-0 flex flex-col" style={{ minWidth: minW }}>
        {/* THE LANE IN FOCUS — Terrain's ring (index.css .holo-ring) over the lead
            greek's lane, its head to its last row, measured off the head cell */}
        {ring && <span aria-hidden className="holo-ring absolute rounded-md z-30" style={ring} data-ladder-lead-ring={lead} />}
        {readLine}
        {head}
        <div className="relative flex-1 min-h-0">
          {/* THE FOCUS SCRIM — one layer for the blur and the dim; only its opacity animates (the calendar's own, see index.css) */}
          <div
            aria-hidden
            data-ladder-scrim={pinned ? '' : undefined}
            className={`pointer-events-none absolute inset-0 z-20 transition-opacity duration-[420ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${pinned ? 'opacity-100' : 'opacity-0'}`}
            style={{ backdropFilter: `blur(${scrim ? 3 : 0}px)`, WebkitBackdropFilter: `blur(${scrim ? 3 : 0}px)`, background: 'rgba(10,10,10,0.66)' }}
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
    </div>
  );
};

export default ExposureLadder;
