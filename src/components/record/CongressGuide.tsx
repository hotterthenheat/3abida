/*
==================================================
  SLAYER TERMINAL - HOW TO READ THE REPORTS
  (components/record/CongressGuide.tsx)

  The Congress page's guide in the house pattern:
  a figure per thing, the surface drawn small in
  its own inks, one sentence under each.
==================================================
*/

import type { ReactNode } from 'react';

const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */
const BULL = 'rgb(var(--bull))';
const BEAR = 'rgb(var(--bear))';
const MUTED = '#7c8290';
const INK = 'rgb(var(--text-primary))';
const SECOND = 'rgb(var(--text-secondary))';
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

const Head = ({ x, y, children, anchor = 'start' }: { x: number; y: number; children: ReactNode; anchor?: 'start' | 'end' }) => (
  <text x={x} y={y} textAnchor={anchor} fontSize={6} letterSpacing={0.8} fill={MUTED} fontFamily={MONO}>
    {children}
  </text>
);

/** The ten rungs, lit to the bracket */
const Ladder = ({ x, y, lit }: { x: number; y: number; lit: number }) => (
  <g>
    {Array.from({ length: 10 }, (_, i) => (
      <rect key={i} x={x + i * 7} y={y - 4} width={5} height={8} rx={1} fill={i <= lit ? SILVER : '#ffffff'} fillOpacity={i === lit ? 1 : i < lit ? 0.55 : 0.08} />
    ))}
  </g>
);

/* One row: filed, the member with their committee, the asset, the type, the ladder, the lag */
const RowFigure = () => (
  <Figure label="One row of the grid: filed 5 days ago, a senator with Finance · own committee under the name, NVDA, Sale in red, the ladder lit to the fifth rung reading $50,001 – $100,000, a lag of 61 days marked late" h={58}>
    <Head x={10} y={12}>FILED</Head>
    <Head x={52} y={12}>MEMBER</Head>
    <Head x={176} y={12}>ASSET</Head>
    <Head x={228} y={12}>TYPE</Head>
    <Head x={268} y={12}>AMOUNT DISCLOSED</Head>
    <Head x={410} y={12} anchor="end">LAG</Head>
    <line x1={10} x2={410} y1={18} y2={18} stroke="#ffffff" strokeOpacity={0.08} />
    <text x={10} y={40} fontSize={7.5} fill={SECOND} fontFamily={MONO}>
      5d ago
    </text>
    <text x={52} y={37} fontSize={7.5} fontWeight={600} fill={INK} fontFamily={SANS}>
      Sen. M. Ashford <tspan fontSize={6} fill={MUTED} fontFamily={MONO}>D-VT</tspan>
    </text>
    <text x={52} y={46} fontSize={6} fill={SECOND} fontFamily={SANS}>
      Finance · <tspan fill={INK}>own committee</tspan>
    </text>
    <rect x={176} y={30} width={14} height={14} rx={3} fill="#1f1f1f" stroke="#2a2a2a" strokeWidth={0.6} />
    <text x={183} y={40} textAnchor="middle" fontSize={4} fontWeight={700} fill={INK} fontFamily={MONO}>
      NVDA
    </text>
    <text x={194} y={40} fontSize={8} fontWeight={700} fill={INK} fontFamily={MONO}>
      NVDA
    </text>
    <text x={228} y={40} fontSize={7.5} fill={BEAR} fontFamily={MONO}>
      Sale
    </text>
    <text x={268} y={40} fontSize={7.5} fill={INK} fontFamily={MONO}>
      $50,001 – $100,000
    </text>
    <text x={410} y={40} textAnchor="end" fontSize={7.5} fontWeight={600} fill={BEAR} fontFamily={MONO}>
      61d <tspan fontSize={5.5} letterSpacing={1}>LATE</tspan>
    </text>
  </Figure>
);

/* The ladder: brackets, never figures */
const LadderFigure = () => (
  <Figure label="Three ladders of ten rungs lit to different heights: the first rung $1,001 – $15,000, the fifth $50,001 – $100,000, the top over $50,000,000" h={82}>
    {[
      { y: 20, lit: 0, label: '$1,001 – $15,000', word: 'the first rung' },
      { y: 46, lit: 4, label: '$50,001 – $100,000', word: 'the fifth' },
      { y: 72, lit: 9, label: 'over $50,000,000', word: 'the top — the ceiling unknowable' },
    ].map(r => (
      <g key={r.label}>
        <Ladder x={10} y={r.y} lit={r.lit} />
        <text x={90} y={r.y + 3} fontSize={7.5} fontWeight={700} fill={INK} fontFamily={MONO}>
          {r.label}
        </text>
        <text x={220} y={r.y + 3} fontSize={7} fill={SECOND} fontFamily={SANS}>
          {r.word}
        </text>
      </g>
    ))}
  </Figure>
);

/* The owner: whose holding the report covers */
const OwnerFigure = () => (
  <Figure label="Four owner tags: SELF in the primary ink, SPOUSE, JOINT and DEPENDENT in grey" h={44}>
    {[
      { x: 10, word: 'SELF', ink: INK, why: "the member's own" },
      { x: 110, word: 'SPOUSE', ink: MUTED, why: 'often a managed account' },
      { x: 230, word: 'JOINT', ink: MUTED, why: 'shared' },
      { x: 320, word: 'DEPENDENT', ink: MUTED, why: 'a child' },
    ].map(o => (
      <g key={o.word}>
        <text x={o.x} y={20} fontSize={6.5} letterSpacing={1.2} fill={o.ink} fontFamily={MONO}>
          {o.word}
        </text>
        <text x={o.x} y={33} fontSize={6.5} fill={SECOND} fontFamily={SANS}>
          {o.why}
        </text>
      </g>
    ))}
  </Figure>
);

/* The lag: the trade, the filing, the 45-day line */
const LagFigure = () => (
  <Figure label="A timeline from the trade to the filing with the 45-day deadline marked: one filing lands at 20 days in grey, another at 61 days in red reading late" h={66}>
    <line x1={20} x2={400} y1={34} y2={34} stroke="#ffffff" strokeOpacity={0.15} />
    <circle cx={20} cy={34} r={3.5} fill={INK} />
    <text x={20} y={52} textAnchor="middle" fontSize={6.5} fill={MUTED} fontFamily={SANS}>
      the trade
    </text>
    <line x1={20 + 380 * (45 / 80)} x2={20 + 380 * (45 / 80)} y1={20} y2={48} stroke={SILVER} strokeOpacity={0.6} strokeDasharray="2 2" />
    <text x={20 + 380 * (45 / 80)} y={14} textAnchor="middle" fontSize={6} letterSpacing={0.8} fill={SILVER} fontFamily={MONO}>
      45 DAYS
    </text>
    <circle cx={20 + 380 * (20 / 80)} cy={34} r={3.5} fill={SECOND} />
    <text x={20 + 380 * (20 / 80)} y={52} textAnchor="middle" fontSize={6.5} fill={SECOND} fontFamily={MONO}>
      filed · 20d
    </text>
    <circle cx={20 + 380 * (61 / 80)} cy={34} r={3.5} fill={BEAR} />
    <text x={20 + 380 * (61 / 80)} y={52} textAnchor="middle" fontSize={6.5} fontWeight={700} fill={BEAR} fontFamily={MONO}>
      filed · 61d · LATE
    </text>
    <circle cx={0} cy={0} r={0} fill={BULL} />
  </Figure>
);

export const CongressGuide = () => (
  <div data-congress-guide>
    <Section title="A row">
      <p>A STOCK Act report: who filed it, whose holding, the stock, purchase or sale, the amount as a bracket, and how long they took to say so.</p>
      <RowFigure />
    </Section>
    <Section title="Amounts are brackets">
      <p>A member never discloses a figure, only one of ten rungs; the page lights the rung and never invents a midpoint.</p>
      <LadderFigure />
    </Section>
    <Section title="Whose holding">
      <p>The owner is on every row, because a spouse's managed account under the member's name is the commonest misreading of this data.</p>
      <OwnerFigure />
    </Section>
    <Section title="Lag, and own committee">
      <p>Days from the trade to the filing, late past 45; and under a member's name, their committee when the trade sits in a sector it oversees — the reading this data is for.</p>
      <LagFigure />
    </Section>
  </div>
);

export default CongressGuide;
