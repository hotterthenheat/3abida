/*
==================================================
  SLAYER TERMINAL - THE CORRIDOR
  (components/gex/AheadCorridor.tsx)

  Band 1 of the Ahead page (2026-09-06): the day
  from now to the close on ONE time axis, in two
  lanes the way the Map's chart carries its volume
  and the profile panel carries size and flow:

    WHERE PRICE CAN GO   today's path so far as a
                         thin line, NOW in the live
                         ink, and from now onward
                         the corridor — the expected
                         move opening out on the
                         square root of the minutes
                         left, its centre pulled by
                         the strikes the odds peak
                         on, bent where a wall sits
                         inside its reach; the
                         levels as dashed hairlines
                         named on the price axis

    WHAT DEALERS MUST    the half hours as one quiet
    TRADE                grey silhouette (the flow
                         lane's grammar), the biggest
                         half hour lit in its ink
                         with its figure, the rest on
                         hover — the delta hedge on
                         today's options coming off
                         as their delta bleeds

  The sketch grammar is PositionCard's PayoffSketch:
  thin lines, fills at 0.14, hairlines at 0.16, 9px
  mono axis text, one silver dot for where we are,
  a small card that answers the pointer, ONE fixed
  read line under the lanes, sentences under it all.
==================================================
*/

import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import DropdownSelect from '../ui/DropdownSelect';
import GuideFocus, { GuideDoor } from '../ui/GuideFocus';
import { CorridorGuide } from './AheadGuide';
import { CALL_WALL, FLIP, PUT_WALL, SUPREME } from './paletteInk';
import { CLOSE_MIN, OPEN_MIN, SESSION_MIN, VOL_OPTIONS, fmtDollars, fmtPrice, fmtStrike, hhmm, volWords, type AheadClock, type Corridor, type Schedule, type ScheduleBlock, type VolPoints } from '../../data/ahead';
import type { ExposureLevels } from '../../types/gex';

const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */
const LIVE = 'rgb(var(--select))';
const GREEN = CALL_WALL;
const RED = PUT_WALL;
const MONO = 'ui-monospace, Menlo, monospace';
const SANS = 'ui-sans-serif, system-ui, sans-serif';
const W = 1200;
/* The price pane and the flow pane share the same left/right margins so the
   two SVGs' minutes line up to the pixel */
const M = { l: 12, r: 74 };
const PH = 300; // the price pane
const PM = { t: 20, b: 10 };
const FH = 118; // the flow pane
const FM = { t: 22, b: 22 };

/** A tick step the axis can print without crowding — eight or so labels, the
    way the chart's own scale reads (a step of 5 on a 12-point range left one
    tick standing once the level chips took the others, 2026-09-06) */
const niceStep = (range: number): number => {
  const steps = [0.1, 0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 25, 50, 100];
  const want = range / 9;
  return steps.find(s => s >= want) ?? steps[steps.length - 1];
};
const verbOf = (flow: number) => (flow >= 0 ? 'buy' : 'sell');
const blockWords = (b: ScheduleBlock) =>
  b.past
    ? `${hhmm(b.from)} to ${hhmm(b.to)} has passed.`
    : `${hhmm(b.from)} to ${hhmm(b.to)}, ${b.phase} — dealers ${verbOf(b.flow)} about ${fmtDollars(b.flow)} of stock to stay hedged · ${b.flow >= 0 ? 'a tailwind' : 'a headwind'} for that half hour`;

interface Props {
  corridor: Corridor;
  schedule: Schedule;
  levels: ExposureLevels;
  ticker: string;
  clock: AheadClock;
  /** The shared strike, when it belongs to this name */
  focus?: number | null;
  onPick?: (price: number) => void;
  scope?: ReactNode;
  /** On a desk tile the tile head names the box — only the door and the facts stay (2026-09-08) */
  headless?: boolean;
  /** THE VOL SCENARIO — vanna spoken (2026-09-09): the card on the one line of controls */
  volPoints: VolPoints;
  onVolPoints: (p: VolPoints) => void;
}

const SHIFT_INK: Record<string, string> = { 'call-wall': CALL_WALL, 'put-wall': PUT_WALL, flip: FLIP, supreme: SUPREME };
const SHIFT_NAME: Record<string, string> = { 'call-wall': 'call wall', 'put-wall': 'put wall', flip: 'flip', supreme: 'supreme' };

const AheadCorridor = ({ corridor, schedule, levels, ticker, clock, focus, onPick, scope, headless = false, volPoints, onVolPoints }: Props) => {
  const priceRef = useRef<SVGSVGElement>(null);
  const flowRef = useRef<SVGSVGElement>(null);
  const [hoverMin, setHoverMin] = useState<number | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const { spot, sigma, sigmaDay, likely, outer, cone, path } = corridor;
  const { blocks, toClose, biggest, bellShare, vol } = schedule;
  /* Where the walls and the flip go under the vol move — the ghosts on the drawing */
  const ghosts = (vol?.shifts ?? []).filter(s => s.kind !== 'supreme');

  const iw = W - M.l - M.r;
  const ih = PH - PM.t - PM.b;
  const x = (min: number) => M.l + ((min - OPEN_MIN) / SESSION_MIN) * iw;

  /* The price domain: the outer band, today's path and any level within reach */
  const { lo, hi } = useMemo(() => {
    let lo = outer.low;
    let hi = outer.high;
    for (const p of path) {
      lo = Math.min(lo, p.price);
      hi = Math.max(hi, p.price);
    }
    const reach = sigmaDay * 2.6;
    for (const k of [levels.callWall, levels.putWall, levels.flip, levels.supreme, ...ghosts.map(g => g.projected)]) {
      if (Math.abs(k - spot) <= reach) {
        lo = Math.min(lo, k);
        hi = Math.max(hi, k);
      }
    }
    const pad = Math.max((hi - lo) * 0.07, 0.01);
    return { lo: lo - pad, hi: hi + pad };
  }, [outer, path, levels, spot, sigmaDay, ghosts]);
  const y = (p: number) => PM.t + (1 - (p - lo) / (hi - lo)) * ih;

  const start = clock.nowMin ?? OPEN_MIN;
  const highWall = likely.high.why === 'the call wall' ? likely.high.price : null;
  const lowWall = likely.low.why === 'the put wall' ? likely.low.price : null;
  const band = (hiKey: 'hi1' | 'hi2', loKey: 'lo1' | 'lo2') => {
    const top = cone.map(c => `${x(c.min).toFixed(1)},${y(c[hiKey]).toFixed(1)}`);
    const bottom = [...cone].reverse().map(c => `${x(c.min).toFixed(1)},${y(c[loKey]).toFixed(1)}`);
    return `M${top.join(' L')} L${bottom.join(' L')} Z`;
  };
  const pathD = path.length ? path.map((p, i) => `${i ? 'L' : 'M'}${x(p.min).toFixed(1)},${y(p.price).toFixed(1)}`).join(' ') : '';
  const last = path[path.length - 1];

  /* THE AXIS IS FOR PRICES (Noah, 2026-09-06: "i only see 1 price saying
     530 — do we even need to see the call/put/flip and supreme?"): regular
     ticks that never give way, spot as the white chip, and the levels that
     SHAPE this corridor — the two walls and the flip; the supreme only when
     it is another strike — as small chips in their ink on the axis, their
     names as quiet tags at the left end of their lines, the way the chart's
     session levels are named on the field and priced on the scale. */
  const step = niceStep(hi - lo);
  const ticks: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(Number(v.toFixed(4)));
  const named = (() => {
    const out: { price: number; name: string; ink: string }[] = [
      { price: levels.callWall, name: 'call wall', ink: CALL_WALL },
      { price: levels.putWall, name: 'put wall', ink: PUT_WALL },
      { price: levels.flip, name: 'flip', ink: FLIP },
    ];
    if (![levels.callWall, levels.putWall].some(k => Math.abs(k - levels.supreme) < 1e-9)) out.push({ price: levels.supreme, name: 'supreme', ink: SUPREME });
    return out.filter(l => l.price > lo && l.price < hi);
  })();
  /* The names and prices at the left end of their lines, pushed apart when
     two levels sit a strike apart — nothing about a level on the axis (Noah:
     "the call/put/flip chips are not needed on the right side") */
  const tags = named.map(l => ({ ...l, ty: y(l.price) - 4 })).sort((a, b) => a.ty - b.ty);
  for (let i = 1; i < tags.length; i++) if (tags[i].ty - tags[i - 1].ty < 11) tags[i].ty = tags[i - 1].ty + 11;
  const tagY = (name: string) => tags.find(t => t.name === name)?.ty ?? 0;
  const rightX = W - M.r + 6;
  const gradId = `corridor-fade-${Math.round(spot * 100)}`;
  const midD = cone.map((c, i) => `${i ? 'L' : 'M'}${x(c.min).toFixed(1)},${y(c.mid).toFixed(1)}`).join(' ');
  const hours = [OPEN_MIN, 10 * 60, 11 * 60, 12 * 60, 13 * 60, 14 * 60, 15 * 60, CLOSE_MIN];

  /* The pointer → a minute; either pane sets it, both panes answer it */
  const minuteAt = (svg: SVGSVGElement | null, clientX: number) => {
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    const u = ((clientX - r.left) / r.width) * W;
    const min = Math.round(OPEN_MIN + ((u - M.l) / iw) * SESSION_MIN);
    return min >= OPEN_MIN && min <= CLOSE_MIN ? min : null;
  };
  const onPriceMove = (e: ReactPointerEvent<SVGSVGElement>) => setHoverMin(minuteAt(priceRef.current, e.clientX));
  const onFlowMove = (e: ReactPointerEvent<SVGSVGElement>) => setHoverMin(minuteAt(flowRef.current, e.clientX));
  /* The corridor at the pointer's minute (from now on) … */
  const ahead = hoverMin != null && hoverMin >= start ? hoverMin : null;
  const at = ahead != null ? (() => {
    const i = cone.findIndex(c => c.min >= ahead);
    const a = cone[Math.max(0, i - 1)] ?? cone[0];
    const b = cone[Math.max(0, i)] ?? a;
    const f = b.min === a.min ? 0 : (ahead - a.min) / (b.min - a.min);
    const mix = (p: number, q: number) => p + (q - p) * f;
    return { min: ahead, lo1: mix(a.lo1, b.lo1), hi1: mix(a.hi1, b.hi1), lo2: mix(a.lo2, b.lo2), hi2: mix(a.hi2, b.hi2) };
  })() : null;
  /* … and the price ON THE LINE at that minute (Noah: "make the spy line
     also traceable with the price") — the nearest close so far */
  const pathAt = hoverMin != null && path.length ? path.reduce((b, p) => (Math.abs(p.min - hoverMin) < Math.abs(b.min - hoverMin) ? p : b), path[0]) : null;
  const traced = pathAt && Math.abs(pathAt.min - hoverMin!) <= 2 ? pathAt : null;
  const hoverX = hoverMin != null ? x(hoverMin) : null;
  const cardLeftPct = hoverX != null ? (hoverX / W) * 100 : 0;
  const cardOnRight = hoverX != null ? hoverX < W * 0.62 : true;
  const showCard = at != null || traced != null;
  /* The axis readouts — spot always, the traced price while hovering; ticks give way to them */
  const readouts = [{ y: y(spot) }, ...(traced ? [{ y: y(traced.price) }] : [])];
  const tickShown = (v: number) => readouts.every(r => Math.abs(r.y - y(v)) > 9);
  const movePct = ((sigma / spot) * 100).toFixed(2);

  /* The flow lane: the half hours as a silhouette, the biggest lit, the hovered one lit */
  const fh = FH - FM.t - FM.b;
  const fBottom = FH - FM.b;
  const maxFlow = Math.max(1, ...blocks.map(b => Math.abs(b.flow)));
  const topOf = (b: ScheduleBlock) => (b.past ? fBottom - 2 : fBottom - Math.max(3, (Math.abs(b.flow) / maxFlow) * fh));
  const remaining = blocks.filter(b => !b.past);
  /* The silhouette starts at NOW, not at the current half hour's start — the
     minutes already gone in it have no dollars left */
  const leftOf = (b: ScheduleBlock) => x(Math.max(b.from, start));
  const silhouette = remaining.length
    ? `M${leftOf(remaining[0]).toFixed(1)},${fBottom} ` + remaining.map(b => `L${leftOf(b).toFixed(1)},${topOf(b).toFixed(1)} L${x(b.to).toFixed(1)},${topOf(b).toFixed(1)}`).join(' ') + ` L${x(remaining[remaining.length - 1].to).toFixed(1)},${fBottom} Z`
    : '';
  const hoveredBlock = hoverMin != null ? blocks.find(b => hoverMin >= b.from && hoverMin < b.to) ?? null : null;
  const litBlocks = [biggest, hoveredBlock && !hoveredBlock.past && hoveredBlock !== biggest ? hoveredBlock : null].filter((b): b is ScheduleBlock => !!b);
  const readLine = hoveredBlock ? blockWords(hoveredBlock) : clock.inSession ? 'hover a half hour · forced buying or selling, whatever the news' : 'hover a half hour · drawn for the next session';
  const ink = toClose >= 0 ? GREEN : RED;

  return (
    <section className="relative flex flex-col min-w-0" data-corridor-band>
      <GuideFocus open={guideOpen} onClose={() => setGuideOpen(false)} title="How to read the range" testId="corridor-guide" viewport>
        <CorridorGuide corridor={corridor} schedule={schedule} levels={levels} clock={clock} />
      </GuideFocus>
      <div className={`${headless ? 'px-4 pt-3 pb-1' : 'px-5 pt-4 pb-2'} flex items-start gap-6 flex-wrap`}>
        {headless ? (
          <div className="shrink-0 h-[35px] flex items-center">
            <GuideDoor open={guideOpen} onClick={() => setGuideOpen(v => !v)} title="What the band, the walls and the half hours mean" testId="corridor-guide" />
          </div>
        ) : (
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="text-[15px] font-semibold leading-tight text-textPrimary">The range</h3>
              {scope}
              <GuideDoor open={guideOpen} onClick={() => setGuideOpen(v => !v)} title="What the band, the walls and the half hours mean" testId="corridor-guide" />
            </div>
            <p className="mt-0.5 text-[11px] text-textMuted whitespace-nowrap truncate">{clock.inSession ? 'From now to the close' : 'The next session'} · where price stays, and what the clock and a vol move make dealers buy or sell</p>
          </div>
        )}
        <dl className={`grid grid-cols-4 gap-x-6 ${headless ? 'ml-auto' : ''}`}>
          <div>
            <dt className="text-[10px] text-textMuted">Likely range</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap" data-corridor-range>
              {fmtPrice(likely.low.price)} – {fmtPrice(likely.high.price)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] text-textMuted">Top edge</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum whitespace-nowrap" style={{ color: highWall != null ? CALL_WALL : 'rgb(var(--text-primary))' }}>
              {fmtPrice(likely.high.price)} <span className="text-textMuted">· {likely.high.why}</span>
            </dd>
          </div>
          <div>
            <dt className="text-[10px] text-textMuted">Floor</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum whitespace-nowrap" style={{ color: lowWall != null ? PUT_WALL : 'rgb(var(--text-primary))' }}>
              {fmtPrice(likely.low.price)} <span className="text-textMuted">· {likely.low.why}</span>
            </dd>
          </div>
          <div>
            <dt className="text-[10px] text-textMuted">Expected move</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap" data-corridor-sigma>
              ±{fmtPrice(sigma)} <span className="text-textMuted">· {movePct}% {clock.inSession ? 'to the close' : 'in a day'}</span>
            </dd>
          </div>
        </dl>
      </div>

      {/* THE ONE LINE OF CONTROLS — the vol scenario (vanna) */}
      <div className={`${headless ? 'px-4' : 'px-5'} pb-2 flex items-center gap-2 flex-wrap`} data-corridor-controls>
        <DropdownSelect label="If vol" value={volPoints} options={VOL_OPTIONS} onChange={onVolPoints} title="A vol move as a scenario — what it makes dealers trade, and where the walls go" testId="if-vol" />
        <span className="ml-auto font-mono text-[9px] uppercase tracking-widest text-textMuted whitespace-nowrap" data-corridor-vol-note>
          {vol ? (ghosts.length ? 'the dashed ghosts are where the walls go under it' : 'the walls stay put under it') : 'no vol move · the clock alone'}
        </span>
      </div>

      {/* THE TWO LANES ARE A DARK ISLAND on either theme — a drawn chart, like the
          Map's row and the Weigher's card (Noah, 2026-09-12: "the charts to by
          default always be black") */}
      <div data-theme="dark" className="relative bg-panel" onPointerLeave={() => setHoverMin(null)} data-corridor-island>
        {/* LANE 1 — WHERE PRICE CAN GO */}
        <div className="relative px-3">
          <svg ref={priceRef} viewBox={`0 0 ${W} ${PH}`} width="100%" role="img" aria-label="Today's path so far and the range price is likely to hold until the close, with the dealer levels marked" onPointerMove={onPriceMove} data-corridor-svg>
            <defs>
              {/* The band fades toward the close — the further ahead, the less certain */}
              <linearGradient id={`${gradId}-likely`} gradientUnits="userSpaceOnUse" x1={x(start)} x2={x(CLOSE_MIN)} y1={0} y2={0}>
                <stop offset="0" stopColor={SILVER} stopOpacity={0.22} />
                <stop offset="1" stopColor={SILVER} stopOpacity={0.07} />
              </linearGradient>
              <linearGradient id={`${gradId}-outer`} gradientUnits="userSpaceOnUse" x1={x(start)} x2={x(CLOSE_MIN)} y1={0} y2={0}>
                <stop offset="0" stopColor="#ffffff" stopOpacity={0.07} />
                <stop offset="1" stopColor="#ffffff" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            {/* the price grid, every tick printed unless a chip sits on it */}
            {ticks.map(v => (
              <g key={v}>
                <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke="#ffffff" strokeOpacity={0.05} />
                {tickShown(v) && (
                  <text x={rightX} y={y(v) + 3} fontSize={9} fill="#7c8290" fontFamily={MONO} data-axis-tick>
                    {fmtStrike(v)}
                  </text>
                )}
              </g>
            ))}
            {hours.map(t => (
              <line key={t} x1={x(t)} x2={x(t)} y1={PM.t} y2={PH - PM.b} stroke="#ffffff" strokeOpacity={0.04} />
            ))}
            {/* the corridor: the rarer band faint, the likely band silver, bent by the walls, its centre dotted */}
            <path d={band('hi2', 'lo2')} fill={`url(#${gradId}-outer)`} data-corridor-outer />
            <path d={band('hi1', 'lo1')} fill={`url(#${gradId}-likely)`} stroke={SILVER} strokeOpacity={0.55} strokeWidth={1} data-corridor-likely />
            {midD && <path d={midD} fill="none" stroke={SILVER} strokeOpacity={0.55} strokeWidth={1} strokeDasharray="1.5 4" strokeLinecap="round" data-corridor-mid />}
            {/* the levels that shape it — a hairline each, named and priced at its left end */}
            {named.map(l => (
              <g key={l.name} onClick={() => onPick?.(l.price)} style={{ cursor: onPick ? 'pointer' : undefined }} data-level={l.name}>
                <line x1={M.l} x2={W - M.r} y1={y(l.price)} y2={y(l.price)} stroke={l.ink} strokeOpacity={focus === l.price ? 0.9 : 0.4} strokeWidth={1} strokeDasharray="3 4" />
                {/* plain sans, no outline — the outlined mono read like a game's HUD (Noah) */}
                <text x={M.l + 6} y={tagY(l.name)} fontSize={9} fontWeight={500} fill={l.ink} fillOpacity={0.9} fontFamily={SANS} data-level-label>
                  {l.name} {fmtStrike(l.price)}
                </text>
              </g>
            ))}
            {/* THE GHOSTS — where each level goes under the vol move, dashed in its own ink, named at the right end */}
            {ghosts
              .filter(g => g.projected > lo && g.projected < hi)
              .map(g => (
                <g key={`ghost-${g.kind}`} data-ghost={g.kind}>
                  <line x1={M.l} x2={W - M.r} y1={y(g.projected)} y2={y(g.projected)} stroke={SHIFT_INK[g.kind] ?? SILVER} strokeOpacity={0.32} strokeWidth={1} strokeDasharray="1.5 4" />
                  <text x={W - M.r - 6} y={y(g.projected) - 4} textAnchor="end" fontSize={9} fontWeight={500} fill={SHIFT_INK[g.kind] ?? SILVER} fillOpacity={0.75} fontFamily={SANS} data-ghost-label>
                    {SHIFT_NAME[g.kind] ?? g.label.toLowerCase()} {fmtStrike(g.current)} → {fmtStrike(g.projected)} if vol {volWords(vol?.points ?? 0)}
                  </text>
                </g>
              ))}
            {/* spot: a dotted hairline and a plain readout on the axis — no pill (Noah: "gamified") */}
            <line x1={M.l} x2={W - M.r} y1={y(spot)} y2={y(spot)} stroke="#ededed" strokeOpacity={0.3} strokeWidth={1} strokeDasharray="1.5 3" />
            <text x={rightX} y={y(spot) + 3.5} fontSize={9.5} fontWeight={600} fill="#ededed" fontFamily={MONO} data-corridor-spot>
              {fmtPrice(spot)}
            </text>
            {/* today's path — a faint ghost when the market is shut and the corridor is the next session's */}
            {pathD && <path d={pathD} fill="none" stroke="#ededed" strokeOpacity={clock.inSession ? 0.85 : 0.35} strokeWidth={1.25} data-corridor-path />}
            {clock.inSession ? (
              <>
                <line x1={x(start)} x2={x(start)} y1={PM.t} y2={PH - PM.b} stroke={LIVE} strokeOpacity={0.6} strokeWidth={1} />
                <text x={x(start)} y={PM.t - 7} textAnchor="middle" fontSize={9} fontWeight={600} fill={LIVE} fontFamily={MONO}>
                  now {hhmm(start)}
                </text>
              </>
            ) : (
              <text x={x(OPEN_MIN) + 4} y={PM.t - 7} fontSize={9} fill="#8a909c" fontFamily={MONO}>
                the last session's path, faint · the corridor is drawn for the next open
              </text>
            )}
            {last && <circle cx={x(last.min)} cy={y(last.price)} r={3} fill="#0e0e0f" stroke={SILVER} strokeWidth={1.5} />}
            {/* the pointer: a hairline at its minute, the corridor's edges as dots, the line's price as a dot and an axis readout */}
            {hoverX != null && showCard && (
              <g data-corridor-cursor>
                <line x1={hoverX} x2={hoverX} y1={PM.t} y2={PH - PM.b} stroke={SILVER} strokeOpacity={0.45} strokeWidth={1} />
                {at && (
                  <>
                    <circle cx={hoverX} cy={y(at.hi1)} r={2.5} fill={SILVER} />
                    <circle cx={hoverX} cy={y(at.lo1)} r={2.5} fill={SILVER} />
                  </>
                )}
                {traced && (
                  <>
                    <circle cx={x(traced.min)} cy={y(traced.price)} r={3} fill="#0e0e0f" stroke={SILVER} strokeWidth={1.5} />
                    <text x={rightX} y={y(traced.price) + 3.5} fontSize={9.5} fontWeight={600} fill={SILVER} fontFamily={MONO} data-traced-price>
                      {fmtPrice(traced.price)}
                    </text>
                  </>
                )}
                {/* the minute, at the foot of the pane — the top carries "now" and the closed-market caption */}
                <text x={hoverX} y={PH - 1} textAnchor="middle" fontSize={9} fill={SILVER} fontFamily={MONO}>
                  {hhmm(hoverMin!)}
                </text>
              </g>
            )}
          </svg>
          {showCard && (
            <div
              className="absolute top-3 w-[216px] rounded-lg border border-borderMuted bg-card/95 px-3 py-2.5 shadow-[0_12px_32px_rgba(0,0,0,0.55)] animate-soft-in pointer-events-none"
              style={{ left: `${cardLeftPct}%`, transform: cardOnRight ? 'translateX(14px)' : 'translateX(calc(-100% - 14px))' }}
              data-corridor-card
            >
              <div className="font-mono text-[11px] font-semibold tnum" style={{ color: SILVER }}>
                {hhmm(hoverMin!)}
              </div>
              <div className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[10px]">
                {traced && (
                  <>
                    <span className="text-textMuted">{clock.inSession ? 'Price' : 'Last session'}</span>
                    <span className="font-mono text-[11px] tnum text-textPrimary" data-traced-card>
                      {fmtPrice(traced.price)}
                    </span>
                  </>
                )}
                {at && (
                  <>
                    <span className="text-textMuted">Likely</span>
                    <span className="font-mono text-[11px] tnum text-textPrimary">
                      {fmtPrice(at.lo1)} – {fmtPrice(at.hi1)}
                    </span>
                    <span className="text-textMuted">Rarer</span>
                    <span className="font-mono text-[11px] tnum text-textSecondary">
                      {fmtPrice(at.lo2)} – {fmtPrice(at.hi2)}
                    </span>
                  </>
                )}
                {hoveredBlock && !hoveredBlock.past && (
                  <>
                    <span className="text-textMuted">Dealers</span>
                    <span className="font-mono text-[11px] tnum whitespace-nowrap" style={{ color: hoveredBlock.flow >= 0 ? GREEN : RED }}>
                      {verbOf(hoveredBlock.flow)} {fmtDollars(hoveredBlock.flow)} <span className="text-textMuted">of stock</span>
                    </span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* LANE 2 — WHAT DEALERS MUST TRADE: its head, then the half hours on the same minutes */}
        <div className="px-5 pt-1 pb-1 flex items-baseline gap-x-5 gap-y-1 flex-wrap" data-flow-head>
          {/* TWO NAMED READS (2026-09-09): the clock is CHARM, the vol move is VANNA — said as such */}
          <span className="text-[11px] text-textSecondary whitespace-nowrap">
            The clock <span className="text-[9px] uppercase tracking-widest text-textMuted">· charm</span>
          </span>
          <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
            <span className="text-[10px] text-textMuted">{clock.inSession ? 'into the close' : 'over the session'}</span>
            <span className="font-mono text-[11px] tnum" style={{ color: ink }} data-flow-total>
              {verbOf(toClose)} {fmtDollars(toClose)}
            </span>
          </span>
          <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
            <span className="text-[10px] text-textMuted">biggest</span>
            <span className="font-mono text-[11px] tnum text-textPrimary" data-flow-biggest>
              {biggest ? `${hhmm(biggest.from)}–${hhmm(biggest.to)} · ${fmtDollars(biggest.flow)}` : '—'}
            </span>
          </span>
          <span className="text-[11px] text-textSecondary whitespace-nowrap">
            A vol move <span className="text-[9px] uppercase tracking-widest text-textMuted">· vanna</span>
          </span>
          <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
            {vol ? (
              <>
                <span className="text-[10px] text-textMuted">if vol {volWords(vol.points)}</span>
                <span className="font-mono text-[11px] tnum" style={{ color: vol.flow >= 0 ? GREEN : RED }} data-flow-vol>
                  {verbOf(vol.flow)} {fmtDollars(vol.flow)}
                </span>
              </>
            ) : (
              <span className="text-[10px] text-textMuted" data-flow-vol>
                none in hand
              </span>
            )}
          </span>
          <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
            <span className="text-[10px] text-textMuted">expires at 4:00</span>
            <span className="font-mono text-[11px] tnum" style={{ color: SUPREME }} data-flow-bell>
              {bellShare != null ? `${bellShare}%` : '—'}
            </span>
          </span>
        </div>
        <div className="px-3">
          <svg ref={flowRef} viewBox={`0 0 ${W} ${FH}`} width="100%" role="img" aria-label="Dollars dealers must trade in each half hour of the session, the biggest lit" onPointerMove={onFlowMove} data-flow-svg>
            {hours.map(t => (
              <g key={t}>
                <line x1={x(t)} x2={x(t)} y1={FM.t} y2={fBottom} stroke="#ffffff" strokeOpacity={0.04} />
                <text x={x(t)} y={FH - 7} textAnchor={t === OPEN_MIN ? 'start' : t === CLOSE_MIN ? 'end' : 'middle'} fontSize={9} fill="#7c8290" fontFamily={MONO}>
                  {t === CLOSE_MIN ? '16:00' : hhmm(t)}
                </text>
              </g>
            ))}
            <line x1={M.l} x2={W - M.r} y1={fBottom} y2={fBottom} stroke="#ffffff" strokeOpacity={0.12} />
            {/* the half hours already gone, flat on the floor */}
            {blocks.filter(b => b.past).map(b => (
              <rect key={b.from} x={x(b.from) + 1} y={fBottom - 2} width={Math.max(0, x(b.to) - x(b.from) - 2)} height={2} fill="#ffffff" fillOpacity={0.1} data-flow-past />
            ))}
            {/* the rest as one silhouette, the lit ones over it */}
            {silhouette && <path d={silhouette} fill="#ffffff" fillOpacity={0.06} stroke="#ffffff" strokeOpacity={0.16} strokeWidth={1} data-flow-silhouette />}
            {litBlocks.map(b => (
              <g key={b.from} data-flow-lit={b === biggest ? 'biggest' : 'hover'}>
                <rect x={leftOf(b) + 0.5} y={topOf(b)} width={Math.max(0, x(b.to) - leftOf(b) - 1)} height={fBottom - topOf(b)} fill={b.flow >= 0 ? GREEN : RED} fillOpacity={b === biggest ? 0.5 : 0.32} />
                <text x={(x(b.from) + x(b.to)) / 2} y={topOf(b) - 6} textAnchor="middle" fontSize={9} fontWeight={600} fill={b.flow >= 0 ? GREEN : RED} fontFamily={MONO}>
                  {verbOf(b.flow)} {fmtDollars(b.flow)}
                </text>
              </g>
            ))}
            {clock.inSession && <line x1={x(start)} x2={x(start)} y1={FM.t} y2={fBottom} stroke={LIVE} strokeOpacity={0.6} strokeWidth={1} />}
            {hoverMin != null && <line x1={x(hoverMin)} x2={x(hoverMin)} y1={FM.t} y2={fBottom} stroke={SILVER} strokeOpacity={0.35} strokeWidth={1} />}
          </svg>
        </div>
        {/* ONE FIXED READ LINE, never a card over the lane */}
        <div className="px-5 h-[18px] font-mono text-[10px] text-textSecondary truncate" data-flow-read>
          {readLine}
        </div>
      </div>

      <div className="px-5 pb-4 pt-2">
        <p className="text-[12px] leading-relaxed text-textSecondary" data-corridor-sentence>
          {corridor.sentence}
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-textSecondary" data-flow-sentence>
          {schedule.sentence}
        </p>
        {vol && (
          <p className="mt-1 text-[12px] leading-relaxed text-textSecondary" data-vol-sentence>
            {vol.sentence}
          </p>
        )}
      </div>
    </section>
  );
};

export default AheadCorridor;
