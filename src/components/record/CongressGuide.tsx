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
import { GuideSvg, type GuideType } from '../ui/GuideSvg';
import { FONT_SANS } from '../../theme/fonts';

const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */
const BULL = 'rgb(var(--bull))';
const BEAR = 'rgb(var(--bear))';
const MUTED = '#7c8290';
const INK = 'rgb(var(--text-primary))';
const SECOND = 'rgb(var(--text-secondary))';
/* the figures' voice — Helvetica's digits are tabular (theme/fonts.ts) */
const FIG = FONT_SANS;
const SANS = FONT_SANS;

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="px-5 py-4 border-b border-borderSubtle/60 last:border-b-0">
    <h4 className="text-[13px] font-semibold text-textPrimary">{title}</h4>
    <div className="mt-2 text-[12px] leading-relaxed text-textSecondary">{children}</div>
  </section>
);

const Figure = ({ children, label, h = 110 }: { children: (t: GuideType) => ReactNode; label: string; h?: number }) => (
  <figure data-theme="dark" className="mt-3 rounded-md border border-borderSubtle/60 bg-panel p-2">
    <GuideSvg w={420} h={h} label={label}>
      {children}
    </GuideSvg>
  </figure>
);

const Head = ({ x, y, s, children, anchor = 'start' }: { x: number; y: number; s: number; children: ReactNode; anchor?: 'start' | 'end' }) => (
  <text x={x} y={y} textAnchor={anchor} fontSize={s} fill={MUTED} fontFamily={FIG}>
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

/* One row: filed, the member with their committee, the asset and the amount, the type, the lag */
const RowFigure = () => (
  <Figure label="One row of the grid: filed 5 days ago, a senator with Finance · own committee under the name, NVDA with $50,001 – $100,000 under it, Sale in red, a lag of 61 days marked late" h={60}>
    {({ w }) => (
      <>
        <Head x={10} y={14} s={w}>
          Filed
        </Head>
        <Head x={56} y={14} s={w}>
          Member
        </Head>
        <Head x={214} y={14} s={w}>
          Asset · amount
        </Head>
        <Head x={306} y={14} s={w}>
          Type
        </Head>
        <Head x={410} y={14} s={w} anchor="end">
          Lag
        </Head>
        <line x1={10} x2={410} y1={20} y2={20} stroke="#ffffff" strokeOpacity={0.08} />
        <text x={10} y={38} fontSize={w} fill={SECOND} fontFamily={FIG}>
          5d ago
        </text>
        <text x={56} y={38} fontSize={w} fontWeight={600} fill={INK} fontFamily={SANS}>
          Sen. M. Ashford <tspan fill={MUTED} fontFamily={FIG}>D-VT</tspan>
        </text>
        <text x={56} y={52} fontSize={w} fill={SECOND} fontFamily={SANS}>
          Finance · <tspan fill={INK}>own committee</tspan>
        </text>
        <rect x={214} y={27} width={15} height={15} rx={3} fill="#1f1f1f" stroke="#2a2a2a" strokeWidth={0.6} />
        <text x={234} y={38} fontSize={w} fontWeight={700} fill={INK} fontFamily={FIG}>
          NVDA
        </text>
        <text x={214} y={52} fontSize={w} fill={INK} fontFamily={FIG}>
          $50,001 – $100,000
        </text>
        <text x={306} y={38} fontSize={w} fill={BEAR} fontFamily={FIG}>
          Sale
        </text>
        <text x={410} y={38} textAnchor="end" fontSize={w} fontWeight={600} fill={BEAR} fontFamily={FIG}>
          61d late
        </text>
      </>
    )}
  </Figure>
);

/* The ladder: brackets, never figures */
const LadderFigure = () => (
  <Figure label="Three ladders of ten rungs lit to different heights: the first rung $1,001 – $15,000, the fifth $50,001 – $100,000, the top over $50,000,000" h={82}>
    {({ w }) =>
      [
        { y: 18, lit: 0, label: '$1,001 – $15,000', word: 'the first rung' },
        { y: 44, lit: 4, label: '$50,001 – $100,000', word: 'the fifth' },
        { y: 70, lit: 9, label: 'over $50,000,000', word: 'the top — the ceiling unknowable' },
      ].map(r => (
        <g key={r.label}>
          <Ladder x={10} y={r.y} lit={r.lit} />
          <text x={88} y={r.y + 4} fontSize={w} fontWeight={700} fill={INK} fontFamily={FIG}>
            {r.label}
          </text>
          <text x={214} y={r.y + 4} fontSize={w} fill={SECOND} fontFamily={SANS}>
            {r.word}
          </text>
        </g>
      ))
    }
  </Figure>
);

/* The owner: whose holding the report covers */
const OwnerFigure = () => (
  <Figure label="Four owner tags: Self in the primary ink, Spouse, Joint and Dependent in grey" h={74}>
    {({ w }) =>
      [
        { x: 10, y: 16, word: 'Self', ink: INK, why: "the member's own" },
        { x: 214, y: 16, word: 'Spouse', ink: MUTED, why: 'often a managed account' },
        { x: 10, y: 52, word: 'Joint', ink: MUTED, why: 'shared' },
        { x: 214, y: 52, word: 'Dependent', ink: MUTED, why: 'a child' },
      ].map(o => (
        <g key={o.word}>
          <text x={o.x} y={o.y} fontSize={w} fontWeight={600} fill={o.ink} fontFamily={FIG}>
            {o.word}
          </text>
          <text x={o.x} y={o.y + 14} fontSize={w} fill={SECOND} fontFamily={SANS}>
            {o.why}
          </text>
        </g>
      ))
    }
  </Figure>
);

/* The lag: the trade, the filing, the 45-day line */
const LagFigure = () => (
  <Figure label="A timeline from the trade to the filing with the 45-day deadline marked: one filing lands at 20 days in grey, another at 61 days in red reading late" h={70}>
    {({ w }) => (
      <>
        <line x1={20} x2={400} y1={36} y2={36} stroke="#ffffff" strokeOpacity={0.15} />
        <circle cx={20} cy={36} r={3.5} fill={INK} />
        <text x={12} y={58} fontSize={w} fill={MUTED} fontFamily={SANS}>
          the trade
        </text>
        <line x1={20 + 380 * (45 / 80)} x2={20 + 380 * (45 / 80)} y1={22} y2={50} stroke={SILVER} strokeOpacity={0.6} strokeDasharray="2 2" />
        <text x={20 + 380 * (45 / 80)} y={14} textAnchor="middle" fontSize={w} fill={SILVER} fontFamily={FIG}>
          45 days
        </text>
        <circle cx={20 + 380 * (20 / 80)} cy={36} r={3.5} fill={SECOND} />
        <text x={20 + 380 * (20 / 80)} y={58} textAnchor="middle" fontSize={w} fill={SECOND} fontFamily={FIG}>
          filed · 20d
        </text>
        <circle cx={20 + 380 * (61 / 80)} cy={36} r={3.5} fill={BEAR} />
        <text x={20 + 380 * (61 / 80)} y={58} textAnchor="middle" fontSize={w} fontWeight={700} fill={BEAR} fontFamily={FIG}>
          filed · 61d · late
        </text>
        <circle cx={0} cy={0} r={0} fill={BULL} />
      </>
    )}
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
