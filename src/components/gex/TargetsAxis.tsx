/*
==================================================
  SLAYER TERMINAL - WHERE THEY SIT
  (components/gex/TargetsAxis.tsx)

  Box 2 of the Targets page: the agenda on the
  strike axis. Spot as the dotted rule, one expected
  move to the close each side of it as the ruler
  (the reach), every strike a tick as tall as what
  is at stake there — a wall's in the calendar's
  cool ink, a trapdoor's in its warm, the named
  levels in their own — and the first three wearing
  their rank. The list says the order; this says
  where the order is.
==================================================
*/

import { useState, type ReactNode } from 'react';
import { CALL_WALL, FLIP, PUT_WALL, SUPREME, THERMAL_COOL, THERMAL_WARM } from './paletteInk';
import { AXIS_BASE, AXIS_H, AXIS_M, AXIS_W } from './targetsSkeletons';
import { fmtDollars, fmtStrike, type AheadClock } from '../../data/ahead';
import type { Agenda, Target } from '../../data/agenda';

const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */
const MONO = 'ui-monospace, Menlo, monospace';
const SANS = 'ui-sans-serif, system-ui, sans-serif';
const ROLE_INK: Record<string, string> = { 'call wall': CALL_WALL, 'put wall': PUT_WALL, supreme: SUPREME, flip: FLIP };
const WARM = THERMAL_WARM;
const COOL = THERMAL_COOL;
const W = AXIS_W;
const H = AXIS_H;
const M = AXIS_M;
const BASE = AXIS_BASE;
/* THE BARS, READABLE (Noah, 2026-09-13: "where they sit again its nice looking
   but unreadable fix the bars"): wider, never fainter than half, every strike
   priced under its bar, the named levels and the first three worded above */
const TICK_MAX = 96;
const BAR_W = 8;

const niceStep = (raw: number) => {
  const p = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-9))));
  const m = raw / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
};
const THIN = '#6a6f7a';
const inkOf = (t: Target) => (t.role ? ROLE_INK[t.role] : t.isShelf ? COOL : t.isWall ? THIN : WARM);

interface Props {
  agenda: Agenda;
  clock: AheadClock;
  focus: number | null;
  onPick: (strike: number) => void;
  scope?: ReactNode;
}

const TargetsAxis = ({ agenda, clock, focus, onPick, scope }: Props) => {
  const [hover, setHover] = useState<number | null>(null);
  const { spot, sigmaLeft, targets } = agenda;
  const strikes = targets.map(t => t.strike);
  const lo0 = Math.min(spot - sigmaLeft * 2.2, ...strikes);
  const hi0 = Math.max(spot + sigmaLeft * 2.2, ...strikes);
  const pad = (hi0 - lo0) * 0.03;
  const lo = lo0 - pad;
  const hi = hi0 + pad;
  const x = (k: number) => M.l + ((k - lo) / (hi - lo || 1)) * (W - M.l - M.r);
  const step = niceStep((hi - lo) / 10);
  const ticks: number[] = [];
  for (let k = Math.ceil(lo / step) * step; k <= hi + 1e-9; k += step) ticks.push(Number(k.toFixed(4)));
  const maxStake = Math.max(1, ...targets.map(t => t.stake));
  const byMatters = agenda.first;
  const rankOf = new Map(byMatters.map((t, i) => [t.strike, i + 1]));
  const lit = hover ?? focus;
  const litT = lit != null ? targets.find(t => Math.abs(t.strike - lit) < 1e-9) : undefined;
  const wallsInReach = targets.filter(t => t.isShelf && t.reach >= 0.15).length;

  return (
    <section className="relative flex flex-col min-w-0" data-targets-axis-box>
      <div className="px-5 pt-4 pb-3 flex items-start gap-6 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="text-[15px] font-semibold leading-tight text-textPrimary">Where they sit</h3>
            {scope}
          </div>
          <p className="mt-0.5 text-[11px] text-textSecondary whitespace-nowrap">
            The agenda on the strike axis — a bar as tall as what is at stake, its figure on it, the ruler one expected move {clock.inSession ? 'to the close' : 'for the next session'} each side of spot
          </p>
        </div>
      </div>
      <div className="px-3 pt-1 pb-1">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Every strike as a tick on the price axis, as tall as what is at stake there, with the expected move to the close as a ruler around spot" data-targets-axis onPointerLeave={() => setHover(null)}>
          {/* the ruler: one expected move each side, two faintly */}
          <rect x={x(spot - 2 * sigmaLeft)} y={24} width={x(spot + 2 * sigmaLeft) - x(spot - 2 * sigmaLeft)} height={BASE - 24} fill="#ffffff" fillOpacity={0.018} />
          <rect x={x(spot - sigmaLeft)} y={24} width={x(spot + sigmaLeft) - x(spot - sigmaLeft)} height={BASE - 24} fill="#ffffff" fillOpacity={0.035} />
          <text x={x(spot + sigmaLeft)} y={BASE + 26} textAnchor="middle" fontSize={9} fill="#b8bcc6" fontFamily={SANS}>
            one expected move up
          </text>
          <text x={x(spot - sigmaLeft)} y={BASE + 26} textAnchor="middle" fontSize={9} fill="#b8bcc6" fontFamily={SANS}>
            one expected move down
          </text>
          {/* the axis */}
          <line x1={M.l} x2={W - M.r} y1={BASE} y2={BASE} stroke="#ffffff" strokeOpacity={0.12} />
          {ticks.map(k => (
            <line key={k} x1={x(k)} x2={x(k)} y1={BASE} y2={BASE + 3} stroke="#ffffff" strokeOpacity={0.25} />
          ))}
          {/* spot */}
          <line x1={x(spot)} x2={x(spot)} y1={12} y2={BASE + 6} stroke="#ededed" strokeOpacity={0.55} strokeDasharray="1 3" />
          <text x={x(spot)} y={9} textAnchor="middle" fontSize={10} fontWeight={700} fill="#ededed" fontFamily={MONO}>
            spot {spot.toFixed(2)}
          </text>
          {/* the ticks */}
          {targets.map(t => {
            const h = Math.max(4, Math.sqrt(t.stake / maxStake) * TICK_MAX);
            const isLit = lit != null && Math.abs(lit - t.strike) < 1e-9;
            const ink = isLit ? SILVER : inkOf(t);
            const r = rankOf.get(t.strike);
            return (
              <g key={t.strike} data-axis-tick={t.strike} className="cursor-pointer" onPointerEnter={() => setHover(t.strike)} onClick={() => onPick(t.strike)}>
                <rect x={x(t.strike) - 10} y={BASE - TICK_MAX - 4} width={20} height={TICK_MAX + 6} fill="transparent" />
                <rect x={x(t.strike) - BAR_W / 2} y={BASE - h} width={BAR_W} height={h} rx={2} fill={ink} fillOpacity={isLit ? 1 : 0.55 + 0.45 * t.reach} />
                {/* the figure at stake on every bar tall enough to carry it */}
                {h >= 22 && (
                  <text x={x(t.strike)} y={BASE - h - 5} textAnchor="middle" fontSize={8.5} fontWeight={600} fill="#ededed" fontFamily={MONO}>
                    {fmtDollars(t.stake)}
                  </text>
                )}
                {/* the rank, above the figure */}
                {r != null && (
                  <text x={x(t.strike)} y={BASE - h - (h >= 22 ? 16 : 5)} textAnchor="middle" fontSize={10} fontWeight={700} fill={r === 1 ? SUPREME : ink} fontFamily={MONO}>
                    #{r}
                  </text>
                )}
                {/* every strike priced under its bar, the named levels in their ink */}
                <text x={x(t.strike)} y={BASE + 12} textAnchor="middle" fontSize={8.5} fontWeight={t.role || r != null ? 700 : 400} fill={t.role ? ink : '#b8bcc6'} fontFamily={MONO}>
                  {fmtStrike(t.strike)}
                </text>
              </g>
            );
          })}
          {/* the strike in hand */}
          {litT && (
            <text x={x(litT.strike)} y={BASE - Math.max(4, Math.sqrt(litT.stake / maxStake) * TICK_MAX) - (rankOf.has(litT.strike) ? 28 : 17)} textAnchor="middle" fontSize={9.5} fontWeight={600} fill={SILVER} fontFamily={MONO}>
              {fmtStrike(litT.strike)} · {Math.round(litT.reach * 100)}% reached · {fmtDollars(litT.stake)} at stake{litT.role ? ` · ${litT.role}` : ''}
            </text>
          )}
        </svg>
        <div className="mt-1 pl-2 flex items-center gap-4 h-[14px] font-mono text-[9px] text-textSecondary" data-axis-key>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-[3px] h-2.5 rounded-sm" style={{ background: COOL }} /> a wall or shelf
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-[3px] h-2.5 rounded-sm" style={{ background: WARM }} /> a trapdoor
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-[3px] h-2.5 rounded-sm" style={{ background: THIN }} /> too thin to be a wall
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-[3px] h-2.5 rounded-sm" style={{ background: CALL_WALL }} /> the named levels in their inks
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-[3px] h-2.5 rounded-sm bg-ink/30" /> fainter the less likely price gets there
          </span>
        </div>
      </div>
      <p className="px-5 pb-4 pt-2 text-[12px] leading-relaxed text-textSecondary" data-axis-sentence>
        One expected move {clock.inSession ? 'to the close' : 'for the next session'} is ${sigmaLeft.toFixed(2)} either way · {wallsInReach} wall{wallsInReach === 1 ? '' : 's'} in reach
        {byMatters[0] ? ` · ${fmtStrike(byMatters[0].strike)} leads with ${fmtDollars(byMatters[0].stake)} at stake ${Math.round(byMatters[0].reach * 100)}% of the time` : ''}.
      </p>
    </section>
  );
};

export default TargetsAxis;
