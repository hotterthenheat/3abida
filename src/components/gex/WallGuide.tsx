/*
==================================================
  SLAYER TERMINAL - HOW TO READ THE WALL
  (components/gex/WallGuide.tsx)

  The guide for the At the wall page, in the house
  pattern: a focus-and-blur card, each figure the
  surface drawn small, one or two sentences each,
  "Today" from the numbers on screen.
==================================================
*/

import type { ReactNode } from 'react';
import { CALL_WALL, PUT_WALL, THERMAL_COOL, THERMAL_WARM } from './paletteInk';
import { fmtDollars, fmtStrike, type AheadClock } from '../../data/ahead';
import type { WallBoard } from '../../data/wall';

const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */
/** The surface's inks: breaks is the calendar's warm side, a shelf's weight its cool side */
const WARM = THERMAL_WARM;
const COOL = THERMAL_COOL;
const MONO = 'ui-monospace, Menlo, monospace';
const SANS = 'ui-sans-serif, system-ui, sans-serif';

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

/* The beam, small: reached above it, holds on the left, breaks on the right, the seam at the odds */
const BeamFigure = () => (
  <Figure label="The beam: the odds price reaches the wall above, the odds it holds as the silver share of one bar, breaks as the rest" h={74}>
    <text x={14} y={16} fontSize={7} fill="#7c8290" fontFamily={MONO} letterSpacing={0.8}>
      IF PRICE GETS THERE
    </text>
    <text x={406} y={16} fontSize={7} textAnchor="end" fill="#7c8290" fontFamily={MONO} letterSpacing={0.8}>
      REACHED BY THE CLOSE <tspan fill="#ededed">61%</tspan>
    </text>
    <rect x={14} y={26} width={392} height={12} rx={6} fill="#ffffff" fillOpacity={0.06} />
    <rect x={14} y={26} width={392 * 0.72} height={12} rx={6} fill={SILVER} fillOpacity={0.85} />
    <rect x={14 + 392 * 0.72 - 1} y={26} width={2} height={12} fill="#0a0a0a" />
    <text x={14} y={56} fontSize={9} fill={SILVER} fontFamily={MONO}>
      holds 72%
    </text>
    <text x={406} y={56} fontSize={9} textAnchor="end" fill={WARM} fontFamily={MONO}>
      breaks 28%
    </text>
    <text x={210} y={68} fontSize={7.5} textAnchor="middle" fill="#7c8290" fontFamily={SANS}>
      two different odds: getting there, and holding once there
    </text>
  </Figure>
);

/* Three reason rows, small: the fact, the push meter, the clause */
const ReasonsFigure = () => {
  const rows = [
    { label: 'What it is made of', fact: '$347M per 1% · 1.7× the market', push: 0.4, words: 'harder than the market pushes' },
    { label: 'Tested today', fact: '3× · held 3 · broke 0', push: 0.6, words: 'every touch held' },
    { label: 'Expires at 4:00', fact: '24% of it · 1h 25m left', push: -0.25, words: 'thins into the close' },
  ];
  const meterX = 236;
  const mid = meterX + 30;
  return (
    <Figure label="Three reasons: a fact in mono, a meter that fills right for holding and left for breaking, and a clause" h={96}>
      <g fontFamily={MONO} fontSize={6.5} fill="#7c8290" letterSpacing={0.6}>
        <text x={10} y={12}>REASON</text>
        <text x={108} y={12}>THE FACT</text>
        <text x={mid} y={12} textAnchor="middle">
          <tspan fill={WARM}>◂ BREAKS</tspan> · <tspan fill={SILVER}>HOLDS ▸</tspan>
        </text>
        <text x={318} y={12}>IN WORDS</text>
      </g>
      {rows.map((r, i) => {
        const y = 30 + i * 22;
        const w = Math.abs(r.push) * 30;
        return (
          <g key={r.label}>
            <line x1={10} x2={410} y1={y - 11} y2={y - 11} stroke="#ffffff" strokeOpacity={0.05} />
            <text x={10} y={y + 3} fontSize={8} fill="#a3a3a3" fontFamily={SANS}>
              {r.label}
            </text>
            <text x={108} y={y + 3} fontSize={7.5} fill={i === 0 ? COOL : 'rgb(var(--text-primary))'} fontFamily={MONO}>
              {r.fact}
            </text>
            <rect x={meterX} y={y - 1.5} width={60} height={3} rx={1.5} fill="#ffffff" fillOpacity={0.06} />
            <rect x={mid - 0.5} y={y - 3} width={1} height={6} fill="#ffffff" fillOpacity={0.25} />
            <rect x={r.push >= 0 ? mid : mid - w} y={y - 1.5} width={w} height={3} rx={1.5} fill={r.push >= 0 ? SILVER : WARM} fillOpacity={0.9} />
            <text x={318} y={y + 3} fontSize={7.5} fill="#7c8290" fontFamily={SANS}>
              {r.words}
            </text>
          </g>
        );
      })}
    </Figure>
  );
};

/* The two paths, small: spot, the wall, the break run over an empty stretch, the way back */
const PathsFigure = () => {
  const x = (t: number) => 30 + t * 360;
  const spot = 0.32;
  const K = 0.5;
  const breakTo = 0.86;
  const holdTo = 0.12;
  return (
    <Figure label="The two paths on the strike axis: spot, the wall as a thick tick, a dashed arrow to the next shelf across an empty stretch, a silver arrow back toward the flip" h={104}>
      {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
        <text key={i} x={x(t)} y={98} textAnchor="middle" fontSize={7.5} fill="#7c8290" fontFamily={MONO}>
          {480 + i * 5}
        </text>
      ))}
      <rect x={x(K)} y={12} width={x(breakTo) - x(K)} height={74} fill="#ffffff" fillOpacity={0.035} />
      <text x={(x(K) + x(breakTo)) / 2} y={82} textAnchor="middle" fontSize={7} fill="#7c8290" fontFamily={SANS}>
        almost nothing in between
      </text>
      <line x1={x(spot)} x2={x(spot)} y1={12} y2={86} stroke="#ededed" strokeOpacity={0.55} strokeDasharray="1 3" />
      <text x={x(spot)} y={9} textAnchor="middle" fontSize={7.5} fontWeight={600} fill="#ededed" fontFamily={MONO}>
        486.40
      </text>
      <rect x={x(K) - 1.5} y={18} width={3} height={62} rx={1.5} fill={CALL_WALL} fillOpacity={0.9} />
      <text x={x(K) + 6} y={24} fontSize={7.5} fill={CALL_WALL} fontFamily={SANS}>
        call wall 490
      </text>
      <line x1={x(K)} x2={x(breakTo) - 6} y1={46} y2={46} stroke={WARM} strokeOpacity={0.9} strokeDasharray="3 3" />
      <path d={`M${x(breakTo) - 6},${43} L${x(breakTo)},${46} L${x(breakTo) - 6},${49} Z`} fill={WARM} fillOpacity={0.9} />
      <text x={x(K) + 8} y={40} fontSize={7.5} fill={WARM} fontFamily={SANS}>
        if it breaks · runs to 497 · $210M of dealer buying on the way
      </text>
      <line x1={x(K)} x2={x(holdTo) + 6} y1={66} y2={66} stroke={SILVER} strokeOpacity={0.9} />
      <path d={`M${x(holdTo) + 6},${63} L${x(holdTo)},${66} L${x(holdTo) + 6},${69} Z`} fill={SILVER} />
      <text x={x(K) - 8} y={76} textAnchor="end" fontSize={7.5} fill={SILVER} fontFamily={SANS}>
        if it holds · back toward 484 · $90M of dealer selling
      </text>
      <text x={x(holdTo)} y={9} textAnchor="middle" fontSize={7} fill={PUT_WALL} fontFamily={SANS}>
        flip
      </text>
    </Figure>
  );
};

/* The figures that matter, lit: white mono for a number, the beam's silver for the hold odds */
const Num = ({ children, silver = false }: { children: ReactNode; silver?: boolean }) => (
  <span className="font-mono tnum font-semibold text-textPrimary" style={silver ? { color: SILVER } : undefined}>
    {children}
  </span>
);
const pct = (v: number) => `${Math.round(v * 100)}%`;

export const WallGuide = ({ board, clock }: { board: WallBoard; clock: AheadClock }) => {
  const w = board.focus;
  const who = w.role ? `the ${w.role} at` : '';
  const weakest = board.walls.find(x => x.strike === board.weakest);
  const strongest = board.walls.find(x => x.strike === board.strongest);
  const flow = (v: number) =>
    v !== 0 ? (
      <>
        , <Num>{fmtDollars(v)}</Num> of forced dealer {v > 0 ? 'buying' : 'selling'} on the way
      </>
    ) : null;
  return (
    <div data-wall-guide>
      <Section title="Two odds, not one">
        <p>Above the beam: the odds price gets there {clock.inSession ? 'by the close' : 'next session'}. The beam: the odds it holds once it does — silver holds, the rest breaks.</p>
        <BeamFigure />
      </Section>
      <Section title="The reasons">
        <p>
          Seven measured facts, each with its push — the clock's is charm, the vol drop's is vanna — <span style={{ color: SILVER }}>silver to the right for holding</span>, <span style={{ color: WARM }}>warm to the left for breaking</span>, the calendar's own inks. They add up to the beam; nothing else does.
        </p>
        <ReasonsFigure />
      </Section>
      <Section title="The two paths">
        <p>Spot, the wall, then the run to the next shelf if it breaks (dashed) and the way back if it holds (silver) — each with the stock dealers must trade on the way.</p>
        <PathsFigure />
      </Section>
      <Section title="Where the odds come from">
        <p>
          The hedging at the wall, in dollars per 1% move, against the <Num>{fmtDollars(board.marketPer1Pct)}</Num> it takes to move this name 1% today; the tests, the build, the expiry, the speed and the prints on top. Model odds — real history will tune the constants.
        </p>
      </Section>
      <Section title="Today">
        {w.weight > 0 ? (
          <p>
            {who ? `${who[0].toUpperCase()}${who.slice(1)} ` : ''}
            <Num>{fmtStrike(w.strike)}</Num> is reached {clock.inSession ? 'by the close' : 'by the next close'} <Num>{pct(w.reach)}</Num> of the time and holds <Num silver>{pct(w.hold)}</Num> when it is.
            {w.breakPath.to != null ? (
              <>
                {' '}
                A break {w.side === 'call' ? 'above' : 'below'} runs to <Num>{fmtStrike(w.breakPath.to)}</Num>
                {w.breakPath.pocket ? ' with almost nothing in between' : ''}
                {flow(w.breakPath.flow)}.
              </>
            ) : (
              <> A break {w.side === 'call' ? 'above' : 'below'} has no shelf behind it on the strikes shown.</>
            )}
            {w.holdPath.to != null && (
              <>
                {' '}
                A hold sends price back toward <Num>{fmtStrike(w.holdPath.to)}</Num>
                {flow(w.holdPath.flow)}.
              </>
            )}
          </p>
        ) : (
          <p>
            <Num>{fmtStrike(w.strike)}</Num> is not a wall: the hedging there pushes moves along rather than back.
          </p>
        )}
        {weakest && strongest && weakest.strike !== strongest.strike && (
          <p className="mt-1 text-textMuted">
            The weakest wall in reach is <Num>{fmtStrike(weakest.strike)}</Num>
            {weakest.role ? `, the ${weakest.role}` : ''}, holding <Num silver>{pct(weakest.hold)}</Num>; the strongest is <Num>{fmtStrike(strongest.strike)}</Num>
            {strongest.role ? `, the ${strongest.role}` : ''} at <Num silver>{pct(strongest.hold)}</Num>.
          </p>
        )}
      </Section>
    </div>
  );
};

export default WallGuide;
