/*
==================================================
  SLAYER TERMINAL - AT THE WALL
  (components/gex/AtTheWall.tsx)

  Box 1 of the At the wall page (2026-09-08): one
  wall — the shared strike when set, else the
  nearest — read top to bottom:

    THE BEAM      one bar, holds on the left in
                  the where-you-are silver, breaks
                  on the right, the seam at the
                  odds; above it, the odds price
                  reaches the wall by the close
    THE REASONS   seven facts, each with the push it
                  gives — a small meter to the
                  right for holding, to the left
                  for breaking — and one clause
    THE TWO PATHS the strike axis: spot, the wall,
                  the break run to the next shelf
                  (the empty stretch shaded) and
                  the way back if it holds, each
                  with the dealer flow it forces
    THE SENTENCE

  One labelled dropdown picks the wall (it follows
  the shared strike); the figures ease. Model odds,
  said so on the surface.
==================================================
*/

import { useMemo, useState, type ReactNode } from 'react';
import CompanyLogo from '../ui/CompanyLogo';
import DropdownSelect, { type DropdownOption } from '../ui/DropdownSelect';
import GuideFocus, { GuideDoor } from '../ui/GuideFocus';
import { WallGuide } from './WallGuide';
import { CALL_WALL, FLIP, PUT_WALL, SUPREME, THERMAL_COOL, THERMAL_WARM, alpha } from './paletteInk';
import { PATHS_H, PATHS_M, PATHS_W, REASON_COLUMNS } from './wallSkeletons';
import { fmtDollars, fmtStrike, type AheadClock } from '../../data/ahead';
import type { WallBoard, WallOdds } from '../../data/wall';

const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */
const MONO = 'ui-monospace, Menlo, monospace';
const SANS = 'ui-sans-serif, system-ui, sans-serif';
const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';
export const ROLE_INK: Record<string, string> = { 'call wall': CALL_WALL, 'put wall': PUT_WALL, supreme: SUPREME, flip: FLIP };
/* THE PAGE'S TWO WORDS IN THE CALENDAR'S INKS (Noah, 2026-09-08, "should this
   hold more colour?"): BREAKS is the warm side of the thermal ramp — hedging
   that pushes a move along — and a shelf's own weight is the cool side, the
   ink its bar wears on the board. HOLDS stays silver, the beam's ink. */
const WARM = THERMAL_WARM;
const COOL = THERMAL_COOL;
const pct = (v: number) => `${Math.round(v * 100)}%`;

/** A round tick step for the axis */
const niceStep = (raw: number) => {
  const p = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-9))));
  const m = raw / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
};

/* ---- the push meter: right for holding, left for breaking ------------------------ */
const Push = ({ push }: { push: number }) => {
  const w = Math.min(50, Math.abs(push) * 50);
  return (
    <span className="relative block h-[4px] w-full rounded-full bg-ink/[0.06]" aria-hidden>
      <span className="absolute inset-y-0 left-1/2 w-px bg-ink/25" />
      <span
        className="absolute inset-y-0 rounded-full transition-[width,left] duration-700"
        style={{ left: push >= 0 ? '50%' : `${50 - w}%`, width: `${w}%`, background: push >= 0 ? SILVER : WARM, opacity: 0.9, transitionTimingFunction: EASE }}
      />
    </span>
  );
};

/* ---- the two paths on the strike axis --------------------------------------------- */
const W = PATHS_W;
const PH = PATHS_H;
const M = PATHS_M;

const Paths = ({ wall, spot }: { wall: WallOdds; spot: number }) => {
  const K = wall.strike;
  const pts = [spot, K, wall.breakPath.to, wall.holdPath.to].filter((v): v is number => v != null);
  const lo0 = Math.min(...pts);
  const hi0 = Math.max(...pts);
  const span = Math.max(hi0 - lo0, Math.abs(K - spot) * 2, spot * 0.004);
  const mid = (lo0 + hi0) / 2;
  const lo = mid - span / 2 - span * 0.14;
  const hi = mid + span / 2 + span * 0.14;
  const x = (k: number) => M.l + ((k - lo) / (hi - lo || 1)) * (W - M.l - M.r);
  const step = niceStep((hi - lo) / 8);
  const ticks: number[] = [];
  for (let k = Math.ceil(lo / step) * step; k <= hi + 1e-9; k += step) ticks.push(Number(k.toFixed(4)));
  const ink = wall.role ? ROLE_INK[wall.role] : wall.weight > 0 ? COOL : SILVER;
  const yBreak = 62;
  const yHold = 96;
  const dir = wall.side === 'call' ? 1 : -1;
  const arrow = (from: number, to: number, y: number, stroke: string, dashed: boolean, opacity: number) => {
    const head = to > from ? -7 : 7;
    return (
      <g opacity={opacity}>
        <line x1={x(from)} x2={x(to) + head} y1={y} y2={y} stroke={stroke} strokeWidth={1.25} strokeDasharray={dashed ? '4 4' : undefined} />
        <path d={`M${x(to) + head},${y - 4} L${x(to)},${y} L${x(to) + head},${y + 4} Z`} fill={stroke} />
      </g>
    );
  };
  const breakTo = wall.breakPath.to;
  const holdTo = wall.holdPath.to;
  const flowWords = (flow: number) => (flow === 0 ? '' : ` · ${fmtDollars(flow)} of dealer ${flow > 0 ? 'buying' : 'selling'} on the way`);
  return (
    <svg viewBox={`0 0 ${W} ${PH}`} width="100%" role="img" aria-label="The strike axis with spot, the wall, the run if it breaks and the way back if it holds" data-wall-paths>
      {ticks.map(k => (
        <g key={k}>
          <line x1={x(k)} x2={x(k)} y1={14} y2={PH - 20} stroke="#ffffff" strokeOpacity={0.05} />
          <text x={x(k)} y={PH - 6} textAnchor="middle" fontSize={9} fill="#7c8290" fontFamily={MONO}>
            {fmtStrike(k)}
          </text>
        </g>
      ))}
      {/* the empty stretch a break crosses */}
      {wall.breakPath.pocket && breakTo != null && (
        <g>
          <rect x={Math.min(x(K), x(breakTo))} y={14} width={Math.abs(x(breakTo) - x(K))} height={PH - 34} fill="#ffffff" fillOpacity={0.035} />
          <text x={(x(K) + x(breakTo)) / 2} y={PH - 24} textAnchor="middle" fontSize={8.5} fill="#7c8290" fontFamily={SANS}>
            almost nothing in between
          </text>
        </g>
      )}
      {/* spot */}
      <line x1={x(spot)} x2={x(spot)} y1={12} y2={PH - 18} stroke="#ededed" strokeOpacity={0.55} strokeDasharray="1 3" />
      <text x={x(spot)} y={9} textAnchor="middle" fontSize={9} fontWeight={600} fill="#ededed" fontFamily={MONO}>
        {fmtStrike(spot)}
      </text>
      {/* the wall */}
      <rect x={x(K) - 2} y={22} width={4} height={PH - 44} rx={2} fill={ink} fillOpacity={0.9} />
      <text x={x(K) + (dir > 0 ? 8 : -8)} y={30} textAnchor={dir > 0 ? 'start' : 'end'} fontSize={9} fontWeight={500} fill={ink} fontFamily={SANS}>
        {wall.role ?? (wall.weight > 0 ? 'shelf' : 'strike')} {fmtStrike(K)}
      </text>
      {/* if it breaks: onward */}
      {breakTo != null ? (
        <g data-wall-break>
          {arrow(K, breakTo, yBreak, WARM, true, 0.9)}
          <text x={x(K) + dir * 10} y={yBreak - 8} textAnchor={dir > 0 ? 'start' : 'end'} fontSize={9} fill={WARM} fontFamily={SANS}>
            if it breaks · runs to {fmtStrike(breakTo)}
            {flowWords(wall.breakPath.flow)}
          </text>
        </g>
      ) : (
        <text x={x(K) + dir * 10} y={yBreak + 3} textAnchor={dir > 0 ? 'start' : 'end'} fontSize={9} fill={WARM} fillOpacity={0.8} fontFamily={SANS}>
          if it breaks · no shelf behind it on the strikes shown
        </text>
      )}
      {/* if it holds: back */}
      {holdTo != null && (
        <g data-wall-hold-path>
          {arrow(K, holdTo, yHold, SILVER, false, 0.9)}
          <text x={x(K) - dir * 10} y={yHold + 14} textAnchor={dir > 0 ? 'end' : 'start'} fontSize={9} fill={SILVER} fontFamily={SANS}>
            if it holds · back toward {fmtStrike(holdTo)}
            {flowWords(wall.holdPath.flow)}
          </text>
        </g>
      )}
    </svg>
  );
};

/* ---- the box ------------------------------------------------------------------------ */

interface Props {
  board: WallBoard;
  ticker: string;
  clock: AheadClock;
  onPick: (strike: number) => void;
  updatedAt: string;
  scope?: ReactNode;
  /** On a desk tile the tile head names the box — only the door and the facts stay (2026-09-08) */
  headless?: boolean;
}

const AtTheWall = ({ board, ticker, clock, onPick, updatedAt, scope, headless = false }: Props) => {
  const [guideOpen, setGuideOpen] = useState(false);
  const wall = board.focus;
  const ink = wall.role ? ROLE_INK[wall.role] : wall.weight > 0 ? COOL : SILVER;
  const options = useMemo<DropdownOption<number>[]>(() => {
    const list = board.walls.map(w => ({ value: w.strike, label: `${w.role ?? 'shelf'} ${fmtStrike(w.strike)}`, hint: `holds ${pct(w.hold)} if reached · reached ${pct(w.reach)}` }));
    if (!list.some(o => o.value === wall.strike)) list.unshift({ value: wall.strike, label: `strike ${fmtStrike(wall.strike)}`, hint: wall.weight > 0 ? `holds ${pct(wall.hold)} if reached` : 'not a wall — its hedging pushes moves along' });
    return list;
  }, [board.walls, wall]);
  const reachedWord = clock.inSession ? 'Reached by the close' : 'Reached next session';

  return (
    <section className="relative flex flex-col min-w-0" data-wall-band>
      <GuideFocus open={guideOpen} onClose={() => setGuideOpen(false)} title="How to read the wall" testId="wall-guide" viewport>
        <WallGuide board={board} clock={clock} />
      </GuideFocus>

      {/* THE HEAD */}
      <div className={`${headless ? 'px-4 pt-3 pb-2' : 'px-5 pt-4 pb-3'} flex items-start gap-6 flex-wrap`}>
        {headless ? (
          <div className="shrink-0 h-[35px] flex items-center">
            <GuideDoor open={guideOpen} onClick={() => setGuideOpen(v => !v)} title="What the beam, the reasons and the two paths mean" testId="wall-guide" />
          </div>
        ) : (
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="text-[15px] font-semibold leading-tight text-textPrimary">At the wall</h3>
              {scope}
              <GuideDoor open={guideOpen} onClick={() => setGuideOpen(v => !v)} title="What the beam, the reasons and the two paths mean" testId="wall-guide" />
            </div>
            <p className="mt-0.5 text-[11px] text-textMuted whitespace-nowrap">Whether it holds when price gets there, and what follows either way · model odds, not a forecast</p>
          </div>
        )}
        <dl className={`grid grid-cols-5 gap-x-6 ${headless ? 'ml-auto' : ''}`}>
          <div>
            <dt className="text-[10px] text-textMuted">The wall</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum whitespace-nowrap" style={{ color: ink }} data-wall-name>
              {fmtStrike(wall.strike)} <span className="text-[9px] uppercase tracking-widest">{wall.role ?? (wall.weight > 0 ? `shelf ${wall.side === 'call' ? 'above' : 'below'}` : wall.side === 'call' ? 'above' : 'below')}</span>
            </dd>
          </div>
          <div>
            <dt className="text-[10px] text-textMuted">{reachedWord}</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap" data-wall-reach>
              {pct(wall.reach)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] text-textMuted">Holds if reached</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum whitespace-nowrap" style={{ color: SILVER }} data-wall-hold-pct>
              {wall.weight > 0 ? pct(wall.hold) : 'not a wall'}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] text-textMuted">If it breaks</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap">{wall.breakPath.to != null ? `runs to ${fmtStrike(wall.breakPath.to)}` : 'no shelf behind'}</dd>
          </div>
          <div>
            <dt className="text-[10px] text-textMuted">If it holds</dt>
            <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary whitespace-nowrap">{wall.holdPath.to != null ? `back to ${fmtStrike(wall.holdPath.to)}` : '—'}</dd>
          </div>
        </dl>
      </div>

      {/* THE ONE LINE OF CONTROLS */}
      <div className="px-5 pb-2 flex items-center gap-2 flex-wrap" data-wall-controls>
        <DropdownSelect label="Wall" value={wall.strike} options={options} onChange={onPick} title="Which wall to read" testId="wall-pick" />
        <span className="ml-auto inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-widest text-textMuted whitespace-nowrap" data-wall-updated>
          <CompanyLogo ticker={ticker} size={11} />
          {ticker} · updated {updatedAt} · every 10s
        </span>
      </div>

      {/* THE BEAM */}
      <div className="px-5 pt-1 pb-3" data-wall-beam>
        <div className="h-[14px] flex items-center justify-between text-[9px] uppercase tracking-widest text-textMuted">
          <span>If price gets there</span>
          <span>
            {reachedWord} <span className="font-mono normal-case tracking-normal text-textPrimary tnum">{pct(wall.reach)}</span> · {wall.distanceSigma.toFixed(1)}× the expected move away
          </span>
        </div>
        <div className="relative mt-1.5 h-[14px] rounded-full bg-ink/[0.06] overflow-hidden">
          <div className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700" style={{ width: `${(wall.weight > 0 ? wall.hold : 0) * 100}%`, background: `linear-gradient(90deg, ${alpha(SILVER, 0.6)}, ${SILVER})`, transitionTimingFunction: EASE }} data-wall-hold-fill />
          <div className="absolute inset-y-0 w-[2px] bg-panel transition-[left] duration-700" style={{ left: `calc(${(wall.weight > 0 ? wall.hold : 0) * 100}% - 1px)`, transitionTimingFunction: EASE }} />
        </div>
        <div className="mt-1 h-[16px] flex items-center justify-between font-mono text-[11px] tnum">
          <span style={{ color: SILVER }} data-wall-holds-word>
            {wall.weight > 0 ? `holds ${pct(wall.hold)}` : 'holds 0% · a trapdoor'}
          </span>
          <span style={{ color: WARM }}>{wall.weight > 0 ? `breaks ${pct(1 - wall.hold)}` : 'pushes the move along'}</span>
        </div>
      </div>

      {/* THE REASONS */}
      <div className="px-5 pb-2" data-wall-reasons>
        <div className="grid items-center gap-x-4 h-[14px] text-[9px] uppercase tracking-widest text-textMuted" style={{ gridTemplateColumns: REASON_COLUMNS }}>
          <span>Reason</span>
          <span>The fact</span>
          <span className="whitespace-nowrap">
            <span style={{ color: WARM }}>◂ breaks</span> · <span style={{ color: SILVER }}>holds ▸</span>
          </span>
          <span>In words</span>
        </div>
        {wall.factors.map(f => (
          <div key={f.key} className="grid items-center gap-x-4 h-[28px] border-t border-borderSubtle/40" style={{ gridTemplateColumns: REASON_COLUMNS }} data-wall-factor={f.key}>
            <span className="text-[11px] text-textSecondary truncate">{f.label}</span>
            <span className="font-mono text-[11px] tnum text-textPrimary truncate" style={f.key === 'weight' && wall.weight > 0 ? { color: COOL } : undefined}>
              {f.fact}
            </span>
            <Push push={f.push} />
            <span className="text-[11px] text-textMuted truncate">{f.words}</span>
          </div>
        ))}
      </div>

      {/* THE TWO PATHS */}
      <div className="px-3 pt-1 pb-1">
        <Paths wall={wall} spot={board.spot} />
      </div>

      <p className="px-5 pb-4 pt-2 text-[12px] leading-relaxed text-textSecondary" data-wall-sentence>
        {wall.sentence}
      </p>
    </section>
  );
};

export default AtTheWall;
