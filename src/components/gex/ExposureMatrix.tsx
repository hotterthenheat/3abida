/*
==================================================
  SLAYER TERMINAL - THE EXPOSURE MATRIX
  (components/gex/ExposureMatrix.tsx)

  Back at Noah's word (2026-09-28, with the picture
  of the 22 August build: "delete the first part of
  the pinpoint map page that showcases our current
  ladder and replace that with this one"), then made
  A VIEW OF THE CALENDAR'S BOX ("this should have the
  same hover card and top button layout that the
  ladder had with the color palette choice and all …
  the calendar should be a button you can switch up
  top as well like matrix vs calendar"). So it reads
  what the ladder read — the surface under the
  band's expiries, strikes and greeks — and wears
  what the ladder wore: the Colours switch's ramp on
  every bar, the pointer card, the kept strike, the
  wall words on the strike.

  The table it was: one row a strike, and for every
  greek three cells — PUT · CALL · NET — each a
  figure with a thin bar under it, the bar's length
  the cell's share of its column's heaviest and its
  ink that share on the palette's ramp (warm or gold
  where hedging amplifies, cool or ice where it
  absorbs; the August red-and-green on the legs went,
  because red and green mean price direction in this
  house and the leg's name stands in the head). The
  spot rule between the strikes above and below
  price.
==================================================
*/

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { HEAT_MODE, heatLadderColor, type HeatMode } from './heatmap';
import SpotRule from '../ui/SpotRule';
import { CardRow, PointerFollowCard } from '../ui/PointerCard';
import { fmtUsd } from '../../data/gex';
import { GREEKS, GREEK_UNIT, type ExposureSurface, type Greek } from '../../data/exposureSurface';
import { CALL_WALL, FLIP, PUT_WALL, SUPREME } from './paletteInk';
import { useResolvedTheme } from '../../theme/theme';
import type { SurfaceCell } from './exposureView';

interface ExposureMatrixProps {
  surface: ExposureSurface;
  liveSpot: number;
  /** The greeks drawn, in the band's pick — a column group each */
  greeks: Greek[];
  /** Indices into surface.expiries — the band's window, summed per cell */
  expiries: number[];
  /** Strikes each side of spot */
  rings: number;
  hoverStrike?: number | null;
  palette?: 'house' | 'thermal';
  selectedStrike?: number | null;
  marks?: ReadonlyMap<number, string>;
  onPointer?: (cell: SurfaceCell | null, clientX: number, clientY: number) => void;
  onSelectStrike?: (strike: number) => void;
  /** The greek the pointer card reads — the band's lead */
  lead?: Greek;
  /** Today's max pain (data/maxPain.ts) — one plain marked line on its strike */
  maxPain?: number | null;
}

type Leg = 'put' | 'call' | 'net';
const LEGS: Leg[] = ['put', 'call', 'net'];
const GREEK_LABEL: Record<Greek, string> = { gex: 'GEX', dex: 'DEX', vex: 'VEX', vanna: 'VANNA', charm: 'CHARM' };
const SILVER = 'rgb(var(--silver))';
const PUT_INK = PUT_WALL;
const CALL_INK = CALL_WALL;
const ROW_H = 27;
const fmtStrike = (v: number) => (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2));
const head = 'font-mono text-[11px] font-semibold';

interface Row {
  strike: number;
  legs: Record<Greek, { put: number; call: number; net: number }>;
}

/* THE GROUPS APART (Noah, 2026-09-28: "better dividers between each greek section … where the net ends and the put
   begins for another greek there is no appearance of separation, but it also should not cast too much attention"):
   the ladder's pane skin — a hairline at a group's left edge, a faint wash on every other group, a little more air
   at the seam. */
/* A shade more on the dark terminal (Noah: "a slight bit more for the dark mode, the light mode is pretty good") — the
   light values are untouched; the two grounds get their own hairline and wash. */
const groupSkin = (gi: number, leg: Leg, paper: boolean) => `${leg === 'put' ? `border-l ${paper ? 'border-borderSubtle' : 'border-borderMuted'} pl-3` : ''} ${leg === 'net' ? 'pr-3' : ''} ${gi % 2 === 1 ? (paper ? 'bg-ink/[0.02]' : 'bg-ink/[0.045]') : ''}`;

const Cell = ({ value, leg, cap, mode, paper, gi }: { value: number; leg: Leg; cap: number; mode: HeatMode; paper: boolean; gi: number }) => {
  const pct = Math.min(100, (Math.abs(value) / Math.max(1, cap)) * 100);
  return (
    <td className={`px-2 py-1 text-right align-middle ${groupSkin(gi, leg, paper)}`} data-matrix-leg={leg}>
      <span className={`block font-mono text-[11px] tnum leading-none ${leg === 'net' ? 'text-textPrimary font-semibold' : 'text-textPrimary'}`}>{fmtUsd(value)}</span>
      <span className="mt-1 ml-auto block h-[3px] w-full max-w-[56px] rounded-full bg-ink/[0.06]">
        {/* the width glides with the data, the ink with the Colours switch — the ladder's two clocks */}
        <span className="block h-full rounded-full transition-[width,background-color] [transition-duration:700ms,450ms]" style={{ width: `${pct}%`, background: value === 0 ? 'transparent' : heatLadderColor(value, cap, mode, paper) }} />
      </span>
    </td>
  );
};

const ExposureMatrix = ({ surface, liveSpot, greeks, expiries, rings, hoverStrike, palette = 'house', selectedStrike, marks, onPointer, onSelectStrike, lead: leadProp, maxPain }: ExposureMatrixProps) => {
  const mode: HeatMode = palette === 'thermal' ? 'thermal-yellow' : HEAT_MODE;
  const paper = useResolvedTheme() === 'light';
  const shownGreeks = useMemo(() => GREEKS.filter(g => greeks.includes(g)), [greeks]);
  const lead: Greek = leadProp && shownGreeks.includes(leadProp) ? leadProp : shownGreeks[0] ?? 'gex';
  const cols = 1 + shownGreeks.length * LEGS.length;
  /* THE EXPIRIES DRAWN — the host's list, so every view sums the same book */
  const shownIdx = useMemo(() => (expiries.length ? expiries.filter(i => i >= 0 && i < surface.expiries.length) : [Math.max(0, surface.expiries.findIndex(e => e.dte === 0))]), [expiries, surface]);
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
  /* THE SCALES — each column against its own heaviest among the rows shown: a bar's length and its ink read the same */
  const caps = useMemo(() => {
    const m = {} as Record<Greek, Record<Leg, number>>;
    for (const g of GREEKS) m[g] = { put: Math.max(1, ...rows.map(r => Math.abs(r.legs[g].put))), call: Math.max(1, ...rows.map(r => Math.abs(r.legs[g].call))), net: Math.max(1, ...rows.map(r => Math.abs(r.legs[g].net))) };
    return m;
  }, [rows]);

  const levels = surface.levels;
  const pinStrike = surface.front.strikes.find(r => r.pin)?.strike;
  const tagFor = (strike: number): { word: string; ink: string } | null =>
    strike === levels.supreme ? { word: 'supreme', ink: SUPREME }
    : strike === levels.callWall ? { word: 'call wall', ink: CALL_WALL }
    : strike === levels.putWall ? { word: 'put wall', ink: PUT_WALL }
    : strike === levels.flip ? { word: 'flip', ink: FLIP }
    : strike === pinStrike ? { word: 'pin', ink: 'rgb(var(--text-muted))' }
    : null;

  /* THE KEPT STRIKE — the ladder's rule: no card while one is kept; a click anywhere off the rows lets it go */
  const keptStrike = selectedStrike ?? null;
  const pinned = keptStrike != null;
  const keptRef = useRef(keptStrike);
  keptRef.current = keptStrike;
  useEffect(() => {
    if (!pinned) return;
    const h = (ev: MouseEvent) => {
      const t = ev.target as Element | null;
      if (t?.closest('[data-matrix-row],[data-ladder-row],[data-cell],[data-strike],[data-profile-panel],[data-dropdown],[data-dropdown-card],[role="menu"],[data-focus-chip],[data-guide-door],button,a,input,select,textarea')) return;
      if (keptRef.current != null) onSelectStrike?.(keptRef.current);
    };
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, [pinned, onSelectStrike]);

  /* THE POINTER CARD — the ladder's, one mounted element per hover, tracking the pointer by itself */
  const [hovered, setHovered] = useState<number | null>(null);
  const [card, setCard] = useState<{ strike: number; x: number; y: number } | null>(null);
  const leaveTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(leaveTimer.current), []);
  const rowCard = (r: Row, start: { x: number; y: number }) => {
    const tag = tagFor(r.strike);
    const you = marks?.get(r.strike);
    const si = surface.strikes.indexOf(r.strike);
    const distPct = ((r.strike - surface.spot) / surface.spot) * 100;
    const l = r.legs[lead];
    const ink = heatLadderColor(l.net, caps[lead].net, mode, paper);
    const total = rows.reduce((s, x) => s + Math.abs(x.legs[lead].net), 0);
    const share = total > 0 ? (Math.abs(l.net) / total) * 100 : 0;
    const heaviest = si >= 0 ? shownIdx.map(e => ({ e, v: surface.net[lead][e]?.[si] ?? 0 })).sort((a, b) => Math.abs(b.v) - Math.abs(a.v))[0] : undefined;
    const oi = si >= 0 ? shownIdx.reduce((s, e) => s + (surface.oi[e]?.[si] ?? 0), 0) : 0;
    const pct = (v: number, max: number) => `${Math.round((Math.abs(v) / Math.max(1, max)) * 100)}%`;
    return (
      <PointerFollowCard
        start={start}
        width={212}
        testId="data-matrix-card"
        testValue={r.strike}
        title={
          <>
            {fmtStrike(r.strike)}
            {tag && (
              <span className="text-[11px] font-normal" style={{ color: tag.ink }}>
                {tag.word}
              </span>
            )}
            {you && (
              <span className="text-[11px] font-normal" style={{ color: SILVER }}>
                you
              </span>
            )}
          </>
        }
        aside={`${distPct >= 0 ? '+' : '−'}${Math.abs(distPct).toFixed(2)}% · ${distPct >= 0 ? 'above' : 'below'} spot`}
      >
        <CardRow k="Put" v={fmtUsd(l.put)} sub={pct(l.put, caps[lead].put)} ink={PUT_INK} />
        <CardRow k="Call" v={fmtUsd(l.call)} sub={pct(l.call, caps[lead].call)} ink={CALL_INK} />
        <CardRow k={`Net · ${GREEK_LABEL[lead]}`} v={fmtUsd(l.net)} sub={l.net >= 0 ? 'put-heavy' : 'call-heavy'} ink={ink} />
        {oi > 0 && <CardRow k="Open interest" v={Math.round(oi).toLocaleString()} sub="contracts" />}
        {heaviest && <CardRow k="Heaviest expiry" v={fmtUsd(heaviest.v)} sub={surface.expiries[heaviest.e]?.date} ink={ink} />}
        <CardRow k="Of the book" v={`${share.toFixed(1)}%`} sub="shown" />
      </PointerFollowCard>
    );
  };
  const cardRow = card && !pinned ? rows.find(r => Math.abs(r.strike - card.strike) < 1e-9) ?? null : null;

  /* the box opens with price in the middle of it, once per name */
  const spotRef = useRef<HTMLTableRowElement | null>(null);
  const centredFor = useRef<string | null>(null);
  useEffect(() => {
    if (centredFor.current === surface.ticker) return;
    centredFor.current = surface.ticker;
    const row = spotRef.current;
    const box = row?.closest('[data-matrix-scroll]') as HTMLElement | null;
    if (!row || !box) return;
    box.scrollTop = Math.max(0, row.offsetTop - box.clientHeight / 2);
  }, [surface.ticker, rows.length]);

  /* THE ROWS BY THE KEYS (X6): one Tab stop for the whole matrix — the kept strike, else the one at spot — the arrows
     walk the strikes, Home and End the ends, Enter or Space keeps the strike (it was one 1152 × 787 tab stop) */
  const rovingStrike = keptStrike != null && rows.some(r => r.strike === keptStrike) ? keptStrike : rowsBelow[0]?.strike ?? rowsAbove[rowsAbove.length - 1]?.strike ?? null;
  const onRowKey = (r: Row) => (ev: React.KeyboardEvent<HTMLTableRowElement>) => {
    if (ev.target !== ev.currentTarget) return;
    const i = rows.findIndex(x => x.strike === r.strike);
    const go = (j: number) => {
      const k = rows[Math.max(0, Math.min(rows.length - 1, j))]?.strike;
      if (k == null) return;
      ev.preventDefault();
      const el = (ev.currentTarget.closest('[data-matrix-scroll]') as HTMLElement | null)?.querySelector<HTMLElement>(`[data-matrix-row="${k}"]`);
      el?.focus();
    };
    if (ev.key === 'ArrowDown') go(i + 1);
    else if (ev.key === 'ArrowUp') go(i - 1);
    else if (ev.key === 'Home') go(0);
    else if (ev.key === 'End') go(rows.length - 1);
    else if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      onSelectStrike?.(r.strike);
    }
  };

  /* the head's ground: the island's own (bg-inset on paper, the panel on black), the group's wash as a layer on it */
  const ground = paper ? 'bg-inset' : 'bg-panel';
  const washOf = (gi: number) => (gi % 2 === 1 ? { backgroundImage: `linear-gradient(rgb(var(--ink) / ${paper ? 0.02 : 0.045}), rgb(var(--ink) / ${paper ? 0.02 : 0.045}))` } : undefined);

  const renderRow = (r: Row) => {
    const on = keptStrike === r.strike;
    const pain = maxPain != null && Math.abs(maxPain - r.strike) < 1e-9;
    const lit = hoverStrike === r.strike || hovered === r.strike;
    const tag = tagFor(r.strike);
    const you = marks?.get(r.strike);
    return (
      <tr
        key={r.strike}
        onPointerEnter={ev => {
          if (leaveTimer.current) window.clearTimeout(leaveTimer.current);
          leaveTimer.current = 0;
          setHovered(r.strike);
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
        onKeyDown={onRowKey(r)}
        onFocus={() => setHovered(r.strike)}
        onBlur={() => setHovered(h => (h === r.strike ? null : h))}
        tabIndex={onSelectStrike ? (r.strike === rovingStrike ? 0 : -1) : undefined}
        role={onSelectStrike ? 'button' : undefined}
        aria-pressed={onSelectStrike ? on : undefined}
        aria-label={`${fmtStrike(r.strike)}${tag ? `, the ${tag.word}` : ''}${pain ? ', max pain' : ''}: net ${GREEK_LABEL[lead]} ${fmtUsd(r.legs[lead].net)}`}
        className={`relative transition-colors outline-none focus-visible:shadow-[inset_0_0_0_2px_rgb(var(--silver)/0.55)] ${pain ? 'border-b border-dashed border-textSecondary/70' : 'border-b border-borderSubtle/30'} ${onSelectStrike ? 'cursor-pointer' : ''} ${on ? 'bg-ink/[0.05]' : lit ? 'bg-ink/[0.04]' : ''} ${pinned && !on ? 'opacity-60' : ''}`}
        style={{ height: ROW_H, ...(on ? { boxShadow: `inset 2px 0 0 0 ${SILVER}` } : {}) }}
        data-matrix-row={r.strike}
        data-kept={on || undefined}
        title={you}
      >
        <td className="px-2 py-1 align-middle bg-inset border-r border-borderSubtle/40 font-mono text-[11px] font-semibold tnum text-textSecondary whitespace-nowrap">
          <span className={on || lit ? 'text-textPrimary' : ''}>{fmtStrike(r.strike)}</span>
          {tag && (
            <span className="ml-1.5 font-mono text-[11px] font-semibold" style={{ color: tag.ink }} data-matrix-role={tag.word}>
              {tag.word}
            </span>
          )}
          {/* MAX PAIN, one plain mark: the row's dashed rule and its name, no ink of its own (data/maxPain.ts) */}
          {pain && (
            <span className="ml-1.5 font-mono text-[11px] text-textMuted" title="Max pain — the close at which today's contracts pay their holders least; marked, not a target" data-matrix-maxpain>
              max pain
            </span>
          )}
          {you && <span className="ml-1.5 font-mono text-[11px] font-semibold text-silver">you own</span>}
        </td>
        {shownGreeks.map((g, gi) => LEGS.map(leg => <Cell key={`${g}-${leg}`} value={r.legs[g][leg]} leg={leg} cap={caps[g][leg]} mode={mode} paper={paper} gi={gi} />))}
      </tr>
    );
  };

  return (
    <div className="overflow-auto h-full min-h-0 scroll-pt-[64px]" data-matrix-scroll data-exposure-matrix={surface.ticker} data-matrix-palette={palette}>
      <table className="w-full border-collapse" style={{ minWidth: 84 + shownGreeks.length * 3 * 66 }}>
        {/* THE HEAD IS SOLID (PP-16): its cells' washes were see-through, so the rows scrolled under showed between its two
            lines as cut figures — each head cell now stands on the island's own ground with the wash laid over it */}
        <thead className={`sticky top-0 z-10 ${ground}`}>
          <tr>
            <th className={`${head} ${ground} px-2 pt-2 pb-1 text-left text-textSecondary border-b border-borderSubtle`}>Strike</th>
            {shownGreeks.map((g, gi) => (
              <th key={g} colSpan={3} style={washOf(gi)} className={`${head} ${ground} px-2 pt-2 pb-1 text-center border-b border-l ${paper ? 'border-borderSubtle' : 'border-borderMuted'} ${g === lead && shownGreeks.length > 1 ? 'text-silver' : 'text-textPrimary'}`} data-matrix-group={g} data-lead={g === lead || undefined}>
                {GREEK_LABEL[g]} <span className="text-textSecondary font-medium">· {GREEK_UNIT[g]}</span>
              </th>
            ))}
          </tr>
          <tr>
            <th className={`${ground} border-b border-borderSubtle`} />
            {shownGreeks.map((g, gi) =>
              LEGS.map(leg => (
                <th key={`${g}-${leg}`} style={washOf(gi)} className={`${head} ${ground} px-2 py-1 text-right text-textSecondary border-b border-borderSubtle ${groupSkin(gi, leg, paper).replace(/bg-ink\/\[[\d.]+\]/, '')}`}>
                  {leg}
                </th>
              ))
            )}
          </tr>
        </thead>
        <tbody>
          {rowsAbove.map(renderRow)}
          <tr ref={spotRef} data-matrix-spot>
            <td colSpan={cols} className="px-2 py-1">
              <SpotRule ticker={surface.ticker} price={liveSpot} />
            </td>
          </tr>
          {rowsBelow.map(renderRow)}
        </tbody>
      </table>
      {cardRow && card && <Fragment key="card">{rowCard(cardRow, card)}</Fragment>}
    </div>
  );
};

export default ExposureMatrix;
