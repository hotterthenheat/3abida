/*
==================================================
  SLAYER TERMINAL - HOW TO READ THE AGENDA
  (components/gex/TargetsGuide.tsx)

  The Targets page's guide, in the house pattern:
  a sentence or two per section, each figure the
  surface drawn small, the figures that matter lit.
==================================================
*/

import type { ReactNode } from 'react';
import { PUT_WALL, SUPREME, THERMAL_COOL, THERMAL_WARM } from './paletteInk';
import { fmtDollars, fmtStrike, type AheadClock } from '../../data/ahead';
import type { Agenda } from '../../data/agenda';

const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */
const MONO = 'ui-monospace, Menlo, monospace';
const SANS = 'ui-sans-serif, system-ui, sans-serif';
const WARM = THERMAL_WARM;
const COOL = THERMAL_COOL;
const pct = (v: number) => `${Math.round(v * 100)}%`;

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="px-5 py-4 border-b border-borderSubtle/60 last:border-b-0">
    <h4 className="text-[13px] font-semibold text-textPrimary">{title}</h4>
    <div className="mt-2 text-[12px] leading-relaxed text-textSecondary">{children}</div>
  </section>
);

const Figure = ({ children, label, h = 110 }: { children: ReactNode; label: string; h?: number }) => (
  <figure data-theme="dark" className="mt-3 rounded-md border border-borderSubtle/60 bg-panel p-2">
    <svg viewBox={`0 0 420 ${h}`} width="100%" role="img" aria-label={label} data-guide-figure>
      {children}
    </svg>
  </figure>
);

const Num = ({ children, silver = false, ink }: { children: ReactNode; silver?: boolean; ink?: string }) => (
  <span className="font-mono tnum font-semibold text-textPrimary" style={silver ? { color: SILVER } : ink ? { color: ink } : undefined}>
    {children}
  </span>
);

/* The order: three strikes, each a reach bar × a stake bar = a rank */
const OrderFigure = () => {
  const rows = [
    { k: '535', role: 'put wall', ink: PUT_WALL, reach: 0.82, stake: 0.52, rank: 1 },
    { k: '538', role: 'shelf', ink: COOL, reach: 0.3, stake: 1.0, rank: 2 },
    { k: '536', role: 'trapdoor', ink: WARM, reach: 0.84, stake: 0.15, rank: 3 },
  ];
  return (
    <Figure label="Three strikes: the odds price gets there as one bar, what is at stake as another, their product as the rank" h={96}>
      <g fontFamily={MONO} fontSize={6.5} fill="#7c8290" letterSpacing={0.6}>
        <text x={10} y={12}>STRIKE</text>
        <text x={100} y={12}>REACHED</text>
        <text x={210} y={12}>AT STAKE</text>
        <text x={340} y={12}>× = RANK</text>
      </g>
      {rows.map((r, i) => {
        const y = 32 + i * 22;
        return (
          <g key={r.k}>
            <line x1={10} x2={410} y1={y - 11} y2={y - 11} stroke="#ffffff" strokeOpacity={0.05} />
            <text x={10} y={y + 3} fontSize={8.5} fontWeight={700} fill="#ededed" fontFamily={MONO}>
              {r.k}
            </text>
            <text x={38} y={y + 3} fontSize={6} fill={r.ink} fontFamily={SANS} letterSpacing={0.5}>
              {r.role.toUpperCase()}
            </text>
            <rect x={100} y={y - 2} width={90} height={4} rx={2} fill="#ffffff" fillOpacity={0.06} />
            <rect x={100} y={y - 2} width={90 * r.reach} height={4} rx={2} fill="#ededed" fillOpacity={0.8} />
            <text x={196} y={y + 3} fontSize={7} fill="#ededed" fontFamily={MONO}>
              {pct(r.reach)}
            </text>
            <rect x={210} y={y - 2} width={110} height={4} rx={2} fill="#ffffff" fillOpacity={0.06} />
            <rect x={210} y={y - 2} width={110 * r.stake} height={4} rx={2} fill={r.ink} fillOpacity={0.85} />
            <text x={340} y={y + 3} fontSize={8.5} fontWeight={700} fill={r.rank === 1 ? SUPREME : 'rgb(var(--text-primary))'} fontFamily={MONO}>
              #{r.rank}
            </text>
            <text x={362} y={y + 3} fontSize={7} fill="#7c8290" fontFamily={MONO}>
              {(r.reach * r.stake * 2.2).toFixed(1)}×
            </text>
          </g>
        );
      })}
    </Figure>
  );
};

/* The row, small: strike and tag, reached, the beam, the break, the build, the stake bar */
const RowFigure = () => (
  <Figure label="One row: the strike and its tag, the odds it is reached, the beam for holds, what a break runs to, what was built today, the bar for what is at stake" h={66}>
    <g fontFamily={MONO} fontSize={6.5} fill="#7c8290" letterSpacing={0.6}>
      <text x={10} y={12}>#</text>
      <text x={30} y={12}>STRIKE</text>
      <text x={112} y={12} textAnchor="end">REACHED</text>
      <text x={172} y={12} textAnchor="end">HOLDS</text>
      <text x={186} y={12}>IF IT BREAKS</text>
      <text x={300} y={12}>BUILT TODAY</text>
      <text x={362} y={12}>AT STAKE</text>
    </g>
    <line x1={10} x2={410} y1={21} y2={21} stroke="#ffffff" strokeOpacity={0.08} />
    {[
      { y: 36, n: 4, k: '534', tag: 'SHELF', ink: COOL, reach: '52%', hold: 0.76, wall: true, brk: 'to 533 · $345M selling', built: 'building +$43M', stake: 0.73, lit: true },
      { y: 56, n: 5, k: '536', tag: 'TRAPDOOR', ink: WARM, reach: '84%', hold: 0, wall: false, brk: 'to 537 · $102M selling', built: 'steady', stake: 0.15, lit: false },
    ].map(r => (
      <g key={r.k}>
        <text x={10} y={r.y + 3} fontSize={7} fill="#7c8290" fontFamily={MONO}>
          #{r.n}
        </text>
        <text x={30} y={r.y + 3} fontSize={8.5} fontWeight={700} fill="#ededed" fontFamily={MONO}>
          {r.k}
        </text>
        <text x={54} y={r.y + 3} fontSize={5.5} fill={r.ink} fontFamily={SANS} letterSpacing={0.5}>
          {r.tag}
        </text>
        <text x={112} y={r.y + 3} textAnchor="end" fontSize={8} fill="#ededed" fontFamily={MONO}>
          {r.reach}
        </text>
        <text x={144} y={r.y + 3} textAnchor="end" fontSize={8} fontWeight={600} fill={r.wall ? SILVER : WARM} fontFamily={MONO}>
          {r.wall ? pct(r.hold) : '—'}
        </text>
        <rect x={148} y={r.y - 1.5} width={26} height={3} rx={1.5} fill="#ffffff" fillOpacity={0.06} />
        {r.wall ? <rect x={148} y={r.y - 1.5} width={26 * r.hold} height={3} rx={1.5} fill={SILVER} fillOpacity={0.85} /> : <rect x={148} y={r.y - 1.5} width={26} height={3} rx={1.5} fill={WARM} fillOpacity={0.35} />}
        <text x={186} y={r.y + 3} fontSize={7} fill="#a3a3a3" fontFamily={MONO}>
          {r.brk.split(' · ')[0]} · <tspan fill={WARM}>{r.brk.split(' · ')[1]}</tspan>
        </text>
        <text x={300} y={r.y + 3} fontSize={7} fill={r.lit ? 'rgb(var(--text-primary))' : '#7c8290'} fontFamily={MONO}>
          {r.built}
        </text>
        <rect x={362} y={r.y - 2} width={48} height={4} rx={2} fill="#ffffff" fillOpacity={0.06} />
        <rect x={362} y={r.y - 2} width={48 * r.stake} height={4} rx={2} fill={r.ink} fillOpacity={0.85} />
      </g>
    ))}
  </Figure>
);

/* The axis, small: the ruler, spot, ticks by stake in their inks, ranks on the first three */
const AxisFigure = () => {
  const x = (t: number) => 20 + t * 380;
  const base = 70;
  const ticks = [
    { t: 0.5, h: 44, ink: PUT_WALL, r: 1 },
    { t: 0.42, h: 58, ink: COOL, r: 2 },
    { t: 0.56, h: 22, ink: WARM, r: 3 },
    { t: 0.36, h: 36, ink: COOL },
    { t: 0.62, h: 40, ink: COOL },
    { t: 0.3, h: 30, ink: COOL },
    { t: 0.7, h: 26, ink: COOL },
    { t: 0.22, h: 20, ink: COOL },
    { t: 0.78, h: 34, ink: COOL },
    { t: 0.86, h: 16, ink: WARM },
  ];
  return (
    <Figure label="The strike axis: spot dotted, the expected move as a ruler around it, every strike a tick as tall as what is at stake, the first three numbered" h={96}>
      <rect x={x(0.34)} y={12} width={x(0.7) - x(0.34)} height={base - 12} fill="#ffffff" fillOpacity={0.035} />
      <line x1={20} x2={400} y1={base} y2={base} stroke="#ffffff" strokeOpacity={0.12} />
      <line x1={x(0.52)} x2={x(0.52)} y1={8} y2={base + 4} stroke="#ededed" strokeOpacity={0.55} strokeDasharray="1 3" />
      <text x={x(0.52)} y={6} textAnchor="middle" fontSize={7} fontWeight={600} fill="#ededed" fontFamily={MONO}>
        535.53
      </text>
      {ticks.map((k, i) => (
        <g key={i}>
          <rect x={x(k.t) - 1.5} y={base - k.h} width={3} height={k.h} rx={1} fill={k.ink} fillOpacity={0.85 - Math.abs(k.t - 0.52) * 1.2} />
          {k.r && (
            <text x={x(k.t)} y={base - k.h - 4} textAnchor="middle" fontSize={7.5} fontWeight={700} fill={k.r === 1 ? SUPREME : k.ink} fontFamily={MONO}>
              {k.r}
            </text>
          )}
        </g>
      ))}
      {[0.1, 0.3, 0.5, 0.7, 0.9].map((t, i) => (
        <text key={i} x={x(t)} y={base + 10} textAnchor="middle" fontSize={7} fill="#7c8290" fontFamily={MONO}>
          {531 + i * 2}
        </text>
      ))}
      <text x={x(0.34)} y={base + 20} textAnchor="middle" fontSize={7} fill="#7c8290" fontFamily={SANS}>
        one expected move
      </text>
      <text x={x(0.7)} y={base + 20} textAnchor="middle" fontSize={7} fill="#7c8290" fontFamily={SANS}>
        one expected move
      </text>
    </Figure>
  );
};

export const TargetsGuide = ({ agenda, clock }: { agenda: Agenda; clock: AheadClock }) => {
  const lead = agenda.first[0];
  const second = agenda.first[1];
  return (
    <div data-targets-guide>
      <Section title="The order">
        <p>
          Two questions, multiplied: how likely price gets there {clock.inSession ? 'by the close' : 'next session'}, and how much moves if it does — the hedging sitting at the strike plus what a move through it forces dealers to trade. A far wall ranks low however big; a thin strike at spot ranks low however near.
        </p>
        <OrderFigure />
      </Section>
      <Section title="The row">
        <p>
          Each figure is another page's answer for that strike: <Num silver>holds</Num> and <span style={{ color: WARM }}>a break</span> from At the wall, built or drained from Building, "closes here" from Ahead. A <span style={{ color: WARM }}>trapdoor</span> pushes the move along instead of back; its bar is warm. A strike too thin to be a wall shows no odds at all.
        </p>
        <RowFigure />
      </Section>
      <Section title="Where they sit">
        <p>The same strikes on the price axis — a tick as tall as what is at stake, fainter the less likely price gets there, the first three numbered. The ruler is one expected move each side of spot.</p>
        <AxisFigure />
      </Section>
      <Section title="Today">
        {lead ? (
          <p>
            Watch <Num>{fmtStrike(lead.strike)}</Num>
            {lead.role ? `, the ${lead.role}` : ''}: reached <Num>{pct(lead.reach)}</Num> of the time,{' '}
            {lead.isWall ? (
              <>
                holds <Num silver>{pct(lead.hold)}</Num>
              </>
            ) : (
              <span style={{ color: WARM }}>a trapdoor</span>
            )}
            , <Num>{fmtDollars(lead.stake)}</Num> at stake.
            {second ? (
              <>
                {' '}
                Then <Num>{fmtStrike(second.strike)}</Num> — reached <Num>{pct(second.reach)}</Num>, <Num>{fmtDollars(second.stake)}</Num> at stake.
              </>
            ) : null}
          </p>
        ) : (
          <p>No strikes on the window.</p>
        )}
        {agenda.weakestWall && agenda.closesNear && (
          <p className="mt-1 text-textMuted">
            The weakest wall in reach is <Num>{fmtStrike(agenda.weakestWall.strike)}</Num>, holding <Num silver>{pct(agenda.weakestWall.hold)}</Num>; the close leans to <Num>{fmtStrike(agenda.closesNear.strike)}</Num> at <Num>{agenda.closesNear.odds.toFixed(0)}%</Num>.
          </p>
        )}
      </Section>
    </div>
  );
};

export default TargetsGuide;
