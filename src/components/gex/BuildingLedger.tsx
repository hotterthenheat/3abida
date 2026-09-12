/*
==================================================
  SLAYER TERMINAL - WHAT'S BEING BUILT, THE LEDGER
  (components/gex/BuildingLedger.tsx)

  Box 1 of the Building page (2026-09-07): one row
  per strike on the price axis, spot cutting across
  as the same rule the ladder draws. Per row —

    the CAPSULE     the hedging sitting there now,
                    in the Ledger's own grammar
                    (colour is the value, figure
                    inside) on the Ledger's own two
                    palettes, House or Thermal
    the BAR         what today added, in two lanes
                    from a centre line — puts in the
                    ramp's warm ink, calls in its
                    cool one (the same ramp the
                    capsules wear, so the row speaks
                    one palette); right is added,
                    left is taken off
    the FIGURE      the wall's size change, signed
    CALLS · PUTS    the contracts behind it
    THE DAY         the wall's size through the
                    session as a thin line
    the WORD        building · draining · steady ·
                    changed sides · new today

  ONE FIXED READ LINE above the grid (the Ledger's
  rule); the BAR alone answers the pointer with a
  small translucent card (Noah, 2026-09-07: "a very
  simple translucent hover card instead of a basic
  html box") — no browser tooltips anywhere. A
  click pins the terminal's focus strike. One thin
  line of labelled dropdowns (Order · Strikes ·
  Colours) and the update words at its right.
==================================================
*/

import { useEffect, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import DropdownSelect, { type DropdownOption } from '../ui/DropdownSelect';
import GuideFocus, { GuideDoor } from '../ui/GuideFocus';
import SpotRule from '../ui/SpotRule';
import HeatPill from './HeatPill';
import { BuildingGuide } from './BuildingGuide';
import { LEDGER_COLUMNS } from './buildingSkeletons';
import { HEAT_MODE, heatLaneColor, heatLaneInks, type HeatMode } from './heatmap';
import { BULL, CALL_WALL, PUT_WALL, SUPREME } from './paletteInk';
import { fmtDollars, fmtStrike, type AheadClock } from '../../data/ahead';
import type { BuildRow, Building } from '../../data/building';
import { STRIKE_WINDOWS, type StrikeWindow } from '../../data/exposure';

const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */
const ROLE_INK: Record<string, string> = { 'call wall': CALL_WALL, 'put wall': PUT_WALL, supreme: SUPREME };
const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';

export type BuildOrder = 'strike' | 'built' | 'drained';
export type BuildPalette = 'house' | 'thermal';
export const ORDER_OPTIONS: DropdownOption<BuildOrder>[] = [
  { value: 'strike', label: 'By strike', hint: 'Highest first, spot marked between' },
  { value: 'built', label: 'Most built first', hint: 'The strikes gaining the most hedging today' },
  { value: 'drained', label: 'Most drained first', hint: 'The strikes losing the most hedging today' },
];
export const WINDOW_OPTIONS: DropdownOption<StrikeWindow>[] = STRIKE_WINDOWS.map(w => ({ value: w, label: `±${w}`, hint: w === 30 ? 'Every strike' : `${w} strikes each side of spot` }));
/* The Ledger's own two palettes, the same words */
export const PALETTE_OPTIONS: DropdownOption<BuildPalette>[] = [
  { value: 'thermal', label: 'Thermal', hint: 'Yellow in the middle, red where hedging amplifies a move, blue where it absorbs one' },
  { value: 'house', label: 'House', hint: 'Gold where hedging amplifies, ice where it absorbs' },
];
export const modeFor = (p: BuildPalette): HeatMode => (p === 'thermal' ? 'thermal-yellow' : HEAT_MODE);

const signed = (v: number) => `${v >= 0 ? '+' : '−'}${fmtDollars(v)}`;
const contracts = (n: number) => (n === 0 ? '0' : `${n > 0 ? '+' : '−'}${Math.abs(n).toLocaleString('en-US')}`);

/* ONE RULE FOR BOTH COLUMNS (Noah, 2026-09-08: "what is the process for
   choosing what numbers on change and the what's happening columns to
   highlight"): a row whose change is material — at least 5% of the biggest
   wall shown, the same line that names it building or draining — prints its
   number AND its word in white; steady rows print both muted. Draining used
   to sit a shade dimmer than building, which left a bold number beside a grey
   word with nothing on the page to say why. */
const verdictWords = (r: BuildRow): { text: string; ink: string } => {
  const dominant = Math.abs(r.callAdded) >= Math.abs(r.putAdded) ? 'calls' : 'puts';
  switch (r.verdict) {
    case 'building':
      return { text: `building · ${dominant}`, ink: 'rgb(var(--text-primary))' };
    case 'draining':
      return { text: `draining · ${dominant}`, ink: 'rgb(var(--text-primary))' };
    case 'switched':
      return { text: `changed sides · now ${r.now < 0 ? 'calls' : 'puts'}`, ink: 'rgb(var(--text-primary))' };
    case 'new':
      return { text: 'new today', ink: 'rgb(var(--text-primary))' };
    default:
      return { text: 'steady', ink: 'rgb(var(--text-muted))' };
  }
};

/** The wall's size through the day — a thin line, the last point marked. On a
    row that moved, the stretch holding the day's biggest rise is tinted green
    and the one holding its biggest drop red — the same 1px line, only its
    colour shifts (Noah, 2026-09-07: "just a slight color change will do");
    a steady row stays one quiet line. */
const Shape = ({ shape, live, verdict }: { shape: number[]; live: boolean; verdict: BuildRow['verdict'] }) => {
  const W = 96;
  const H = 18;
  if (shape.length < 2) return <svg width={W} height={H} />;
  const X = (i: number) => (i / (shape.length - 1)) * (W - 4) + 2;
  const Y = (v: number) => H - 2 - v * (H - 5);
  const pt = (i: number) => `${X(i).toFixed(1)},${Y(shape[i]).toFixed(1)}`;
  const pts = shape.map((_, i) => pt(i));
  const lastX = X(shape.length - 1);
  const lastY = Y(shape[shape.length - 1]);
  /* The two stretches that mattered: the run around the largest single rise and
     the run around the largest single drop, only when the step is a real share
     of the day's range and the row is not steady */
  let up: number | null = null;
  let down: number | null = null;
  if (verdict !== 'steady') {
    const range = Math.max(...shape) - Math.min(...shape);
    let bestUp = 0;
    let bestDown = 0;
    for (let i = 1; i < shape.length; i++) {
      const d = shape[i] - shape[i - 1];
      if (d > bestUp) {
        bestUp = d;
        up = i;
      }
      if (d < bestDown) {
        bestDown = d;
        down = i;
      }
    }
    if (bestUp < 0.2 * range) up = null;
    if (-bestDown < 0.2 * range) down = null;
  }
  const run = (i: number, sign: 1 | -1): [number, number] => {
    let a = i - 1;
    let b = i;
    while (a > 0 && Math.sign(shape[a] - shape[a - 1]) === sign) a--;
    while (b < shape.length - 1 && Math.sign(shape[b + 1] - shape[b]) === sign) b++;
    return [a, b];
  };
  const tint = (i: number, sign: 1 | -1, ink: string, key: string) => {
    const [a, b] = run(i, sign);
    const seg = Array.from({ length: b - a + 1 }, (_, k) => pt(a + k));
    return <polyline key={key} points={seg.join(' ')} fill="none" stroke={ink} strokeOpacity={0.85} strokeWidth={1} strokeLinejoin="round" strokeLinecap="round" data-shape-mark={key} />;
  };
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden data-build-shape>
      <polyline points={`${pts[0].split(',')[0]},${H - 1} ${pts.join(' ')} ${lastX.toFixed(1)},${H - 1}`} fill="#ffffff" fillOpacity={0.04} stroke="none" />
      <polyline points={pts.join(' ')} fill="none" stroke={verdict === 'steady' ? '#5c6270' : '#8a909c'} strokeWidth={1} strokeLinejoin="round" />
      {up != null && tint(up, 1, BULL, 'rise')}
      {down != null && tint(down, -1, PUT_WALL, 'drop')}
      <circle cx={lastX} cy={lastY} r={1.8} fill={live ? 'rgb(var(--text-primary))' : '#8a909c'} />
    </svg>
  );
};

/** Two lanes from a centre line — calls above, puts below; right is added, left
    is taken off. Each lane wears the ramp colour its own size earns, so the bar
    is the capsule's heat drawn as length. */
const ChangeBar = ({ row, max, mode }: { row: BuildRow; max: number; mode: HeatMode }) => {
  const lane = (v: number, sign: 1 | -1, top: number, key: string) => {
    const w = (Math.min(1, Math.abs(v) / max) * 50).toFixed(2);
    const added = v >= 0;
    return (
      <span
        key={key}
        className="absolute h-[6px] rounded-full transition-[width,left,background-color] duration-700"
        style={{
          top,
          left: added ? '50%' : `calc(50% - ${w}%)`,
          width: `${w}%`,
          background: heatLaneColor(sign * Math.abs(v), max, mode),
          opacity: added ? 0.95 : 0.5,
          transitionTimingFunction: EASE,
        }}
        data-build-lane={key}
      />
    );
  };
  return (
    <span className="absolute inset-0" aria-hidden>
      <span className="absolute inset-y-[3px] left-1/2 w-px bg-ink/20" />
      {lane(row.callAdded, -1, 3, 'calls')}
      {lane(row.putAdded, 1, 12, 'puts')}
    </span>
  );
};

/** The bar's card — small, translucent, beside the pointer, never in its way */
const BarCard = ({ row, x, y, inks }: { row: BuildRow; x: number; y: number; inks: { pos: string; neg: string } }) => {
  const W = 196;
  const onRight = typeof globalThis.innerWidth !== 'number' || x + 14 + W < globalThis.innerWidth - 8;
  const Row = ({ k, v, sub, ink }: { k: string; v: string; sub: string; ink?: string }) => (
    <>
      <span className="text-textMuted">{k}</span>
      <span className="text-right font-mono text-[11px] tnum" style={{ color: ink ?? 'rgb(var(--text-primary))' }}>
        {v} <span className="text-[9px] text-textMuted">{sub}</span>
      </span>
    </>
  );
  return createPortal(
    <div
      className="fixed z-[80] rounded-lg border border-borderMuted bg-card/85 backdrop-blur-md px-3 py-2.5 shadow-[0_12px_32px_rgba(0,0,0,0.55)] animate-soft-in pointer-events-none"
      style={{ width: W, left: onRight ? x + 14 : x - 14 - W, top: y - 12 }}
      data-build-card={row.strike}
    >
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[11px] font-semibold tnum" style={{ color: SILVER }}>
          {fmtStrike(row.strike)}
        </span>
        {row.role && (
          <span className="text-[8px] uppercase tracking-widest" style={{ color: ROLE_INK[row.role] }}>
            {row.role}
          </span>
        )}
        <span className="ml-auto text-[9px] text-textMuted">added today</span>
      </div>
      <div className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[10px]">
        <Row k="Calls" v={signed(row.callAdded)} sub={contracts(row.dCall)} ink={inks.neg} />
        <Row k="Puts" v={signed(row.putAdded)} sub={contracts(row.dPut)} ink={inks.pos} />
        <Row k="The wall" v={signed(row.sizeChange)} sub={row.verdict === 'steady' ? 'steady' : row.verdict === 'switched' ? 'changed sides' : row.verdict} />
      </div>
    </div>,
    document.body
  );
};

interface Props {
  data: Building;
  ticker: string;
  clock: AheadClock;
  order: BuildOrder;
  onOrder: (o: BuildOrder) => void;
  window: StrikeWindow;
  onWindow: (w: StrikeWindow) => void;
  palette: BuildPalette;
  onPalette: (p: BuildPalette) => void;
  /** "14:35:10" — when the numbers were last read */
  updatedAt: string;
  yours?: Set<number>;
  focus?: number | null;
  onPick?: (price: number) => void;
  /** Let the pinned strike go — a click anywhere outside its row */
  onClear?: () => void;
  scope?: ReactNode;
}

const BuildingLedger = ({ data, ticker, clock, order, onOrder, window, onWindow, palette, onPalette, updatedAt, yours, focus, onPick, onClear, scope }: Props) => {
  const [guideOpen, setGuideOpen] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const [card, setCard] = useState<{ strike: number; x: number; y: number } | null>(null);
  const { rows, maxAbs, maxChange, spotAfter } = data;
  const mode = modeFor(palette);
  const inks = heatLaneInks(mode);

  const shown = order === 'strike' ? rows : [...rows].sort((a, b) => (order === 'built' ? b.sizeChange - a.sizeChange : a.sizeChange - b.sizeChange));
  const readRow = (focus != null && rows.find(r => Math.abs(r.strike - focus) < 1e-9)) || (hover != null && rows.find(r => r.strike === hover)) || data.fastestUp || data.fastestDown || rows[0] || null;
  const pinned = focus != null && readRow != null && Math.abs(readRow.strike - focus) < 1e-9;
  const cardRow = card ? rows.find(r => r.strike === card.strike) : null;
  /* FOCUS AND BLUR (Noah, 2026-09-07): a pinned row stays sharp, every other row softens behind it */
  const anyKept = focus != null && rows.some(r => Math.abs(r.strike - focus) < 1e-9);
  /* …and a click anywhere outside a row lets it go (Noah: "exitable on click
     anywhere outside of that row"). Another row's click moves the pin instead;
     the controls, the shell's focus chip and the guide are not "outside". */
  useEffect(() => {
    if (!anyKept || !onClear) return;
    const h = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (t?.closest('[data-build-row],[data-dropdown],[data-dropdown-card],[role="menu"],[data-focus-chip],[data-guide-door],button,a,input,select,textarea')) return;
      onClear();
    };
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, [anyKept, onClear]);

  const onBarMove = (strike: number) => (e: ReactPointerEvent<HTMLDivElement>) => setCard({ strike, x: e.clientX, y: e.clientY });

  return (
    <section className="relative flex flex-col min-w-0" data-build-band>
      <GuideFocus open={guideOpen} onClose={() => setGuideOpen(false)} title="How to read what's being built" testId="build-guide" viewport>
        <BuildingGuide data={data} clock={clock} inks={inks} />
      </GuideFocus>

      {/* THE HEAD */}
      <div className="px-5 pt-4 pb-3 flex items-start gap-6 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="text-[15px] font-semibold leading-tight text-textPrimary">What's being built</h3>
            {scope}
            <GuideDoor open={guideOpen} onClick={() => setGuideOpen(v => !v)} title="What the capsule and the bar mean" testId="build-guide" />
          </div>
          <p className="mt-0.5 text-[11px] text-textMuted whitespace-nowrap truncate">
            {clock.inSession ? "Today's trading" : 'The last session'}, strike by strike · the hedging added or taken off since the open, so a wall shows up before it is the wall · a bold change is past 5% of the biggest wall
          </p>
        </div>
        <dl className="grid grid-cols-4 gap-x-6">
          <div>
            <dt className="text-[10px] text-textMuted">{clock.inSession ? 'Built today' : 'Built last session'}</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap" data-build-built>
              +{fmtDollars(data.built)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] text-textMuted">{clock.inSession ? 'Drained today' : 'Drained last session'}</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap" data-build-drained>
              −{fmtDollars(data.drained)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] text-textMuted">Growing fastest</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum whitespace-nowrap" style={{ color: SILVER }} data-build-up>
              {data.fastestUp ? `${fmtStrike(data.fastestUp.strike)} · ${signed(data.fastestUp.sizeChange)}` : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] text-textMuted">Fading fastest</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap" data-build-down>
              {data.fastestDown ? `${fmtStrike(data.fastestDown.strike)} · ${signed(data.fastestDown.sizeChange)}` : '—'}
            </dd>
          </div>
        </dl>
      </div>

      {/* THE ONE LINE OF CONTROLS */}
      <div className="px-5 pb-2 flex items-center gap-2 flex-wrap" data-build-controls>
        <DropdownSelect label="Order" value={order} options={ORDER_OPTIONS} onChange={onOrder} title="How the strikes are listed" testId="build-order" />
        <DropdownSelect label="Strikes" value={window} options={WINDOW_OPTIONS} onChange={onWindow} title="How many strikes each side of spot" testId="build-window" />
        <DropdownSelect label="Colours" value={palette} options={PALETTE_OPTIONS} onChange={onPalette} title="What the colours mean" testId="build-colours" />
        <span className="ml-auto font-mono text-[9px] uppercase tracking-widest text-textMuted whitespace-nowrap" data-build-updated>
          updated {updatedAt} · every 10s
        </span>
      </div>

      {/* THE READ LINE — one fixed line */}
      <div className="mx-5 px-3 py-2 border-y border-borderSubtle/60 font-mono text-[11px] leading-snug select-none min-h-[34px] flex items-center" data-build-read>
        {readRow ? (
          <span className={pinned ? 'text-textPrimary' : 'text-textSecondary'}>
            <span className="font-bold text-[12px] text-textPrimary tnum">{fmtStrike(readRow.strike)}</span>
            <span className="text-textMuted"> · </span>
            {readRow.words.slice(readRow.words.indexOf('·') + 2)}
          </span>
        ) : (
          <span className="text-textMuted">nothing to read yet</span>
        )}
      </div>

      {/* THE GRID */}
      <div className="px-5 pt-2 pb-2 overflow-x-auto" data-build-rows onPointerLeave={() => setHover(null)}>
        {/* The column template is the skeleton's own (buildingSkeletons.tsx), so the two cannot drift */}
        <div key={`${order}-${window}-${palette}`} className="grid min-w-[980px] items-center gap-x-3 gap-y-[3px] animate-fade-in" style={{ gridTemplateColumns: LEDGER_COLUMNS }}>
          <div className="text-[9px] uppercase tracking-widest text-textMuted">Strike</div>
          <div className="text-[9px] uppercase tracking-widest text-textMuted">Hedging now</div>
          <div className="text-[9px] uppercase tracking-widest text-textMuted whitespace-nowrap">
            Added today <span className="normal-case tracking-normal text-textMuted/70">· right added, left taken off ·</span>{' '}
            <span className="normal-case tracking-normal" style={{ color: inks.neg }}>
              calls
            </span>{' '}
            <span className="normal-case tracking-normal" style={{ color: inks.pos }}>
              puts
            </span>
          </div>
          {/* The bold rule lives in the sub line — said here it ran out of its 72px column into Calls and Puts (Noah, 2026-09-09: "crammed") */}
          <div className="text-[9px] uppercase tracking-widest text-textMuted text-right whitespace-nowrap">Change</div>
          <div className="text-[9px] uppercase tracking-widest text-textMuted text-right">Calls</div>
          <div className="text-[9px] uppercase tracking-widest text-textMuted text-right">Puts</div>
          <div className="text-[9px] uppercase tracking-widest text-textMuted">The day</div>
          <div className="text-[9px] uppercase tracking-widest text-textMuted">What's happening</div>

          {shown.map((r, i) => {
            const ink = r.role ? ROLE_INK[r.role] : undefined;
            const kept = focus != null && Math.abs(focus - r.strike) < 1e-9;
            const hovered = hover === r.strike;
            const wash = kept || hovered ? 'bg-silver/[0.05]' : '';
            /* blur-0 rather than no filter at all: a filter list interpolates
               with another list, and letting go used to snap from blur to none */
            const dim = anyKept && !kept;
            const soft = dim ? 'blur-[2px] opacity-30' : 'blur-0 opacity-100';
            const v = verdictWords(r);
            const cell = 'h-[22px] flex items-center';
            const enter = () => setHover(r.strike);
            const pick = () => onPick?.(r.strike);
            /* THE ROW IS A SUBGRID, NOT `contents` (Noah, 2026-09-08: "the black
               spaces between the focus horizontal line"): the wash and the
               focus blur painted per cell broke into pieces at every column
               gap; a real row element on the parent's own tracks paints one
               band across the gaps — and blurs once, not eight times. */
            const cells = (
              <div
                key={`r-${r.strike}`}
                className={`grid grid-cols-subgrid col-span-8 items-center rounded cursor-pointer transition-[filter,opacity] duration-[420ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${wash} ${soft}`}
                data-build-row={r.strike}
                data-verdict={r.verdict}
                data-soft={dim ? '' : undefined}
                onPointerEnter={enter}
                onClick={pick}
              >
                <button type="button" className={`${cell} gap-1.5 px-2 text-left font-mono text-[11px] tnum ${kept ? 'text-silver font-bold shadow-[inset_2px_0_0_0_rgba(199,211,232,0.7)]' : 'text-textPrimary'}`}>
                  {fmtStrike(r.strike)}
                  {r.role && (
                    <span className="text-[8px] uppercase tracking-widest whitespace-nowrap" style={{ color: ink }}>
                      {r.role}
                    </span>
                  )}
                </button>
                <div className={`${cell} px-0.5`}>
                  <HeatPill
                    value={r.now}
                    maxAbs={maxAbs}
                    className="h-[18px] w-full"
                    fontSize={10}
                    selected={kept}
                    ringColor={SILVER}
                    mode={mode}
                    marker={
                      yours?.has(r.strike) ? (
                        <span className="text-[7px] font-semibold uppercase tracking-widest whitespace-nowrap opacity-90" data-yours>
                          you own
                        </span>
                      ) : undefined
                    }
                  >
                    {fmtDollars(r.now)}
                  </HeatPill>
                </div>
                <div className={`${cell} relative`} onPointerMove={onBarMove(r.strike)} onPointerLeave={() => setCard(null)} data-build-bar>
                  <ChangeBar row={r} max={maxChange} mode={mode} />
                </div>
                <div className={`${cell} justify-end font-mono text-[11px] tnum ${r.verdict === 'steady' ? 'text-textMuted' : 'text-textPrimary font-semibold'}`} data-build-change>
                  {signed(r.sizeChange)}
                </div>
                <div className={`${cell} justify-end font-mono text-[10px] tnum text-textSecondary`}>{contracts(r.dCall)}</div>
                <div className={`${cell} justify-end font-mono text-[10px] tnum text-textSecondary`}>{contracts(r.dPut)}</div>
                <div className={cell}>
                  <Shape shape={r.shape} live={clock.inSession} verdict={r.verdict} />
                </div>
                <div className={`${cell} pr-2 text-[10px] whitespace-nowrap`} style={{ color: v.ink }} data-build-word>
                  {v.text}
                </div>
              </div>
            );
            return order === 'strike' && i === spotAfter
              ? [
                  <div key="spot" className="col-span-8 px-2 py-0.5">
                    <SpotRule ticker={ticker} price={data.spot} />
                  </div>,
                  cells,
                ]
              : cells;
          })}
          {order === 'strike' && (spotAfter < 0 || spotAfter >= shown.length) && (
            <div className="col-span-8 px-2 py-0.5">
              <SpotRule ticker={ticker} price={data.spot} />
            </div>
          )}
        </div>
      </div>
      {card && cardRow && <BarCard row={cardRow} x={card.x} y={card.y} inks={inks} />}

      <p className="px-5 pb-4 pt-2 text-[12px] leading-relaxed text-textSecondary" data-build-sentence>
        {data.sentence}
      </p>
    </section>
  );
};

export default BuildingLedger;
