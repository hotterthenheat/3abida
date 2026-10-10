/*
==================================================
  SLAYER TERMINAL - HOW TO READ THE FILINGS
  (components/record/InsidersGuide.tsx)

  The Insiders page's guide in the house pattern:
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

/* One row of the grid: when, the name, who, the trade, the figures, the flag */
const RowFigure = () => (
  <Figure label="One row of the grid: yesterday, BLK BlackRock, an EVP, Bought in green, $7M, 2.4% of the stake, Chosen in bold" h={60}>
    {({ w }) => (
      <>
        <Head x={10} y={14} s={w}>
          When
        </Head>
        <Head x={74} y={14} s={w}>
          Name
        </Head>
        <Head x={160} y={14} s={w}>
          Who
        </Head>
        <Head x={256} y={14} s={w}>
          Trade
        </Head>
        <Head x={330} y={14} s={w} anchor="end">
          Value
        </Head>
        <Head x={410} y={14} s={w} anchor="end">
          Chose to?
        </Head>
        <line x1={10} x2={410} y1={20} y2={20} stroke="#ffffff" strokeOpacity={0.08} />
        <text x={10} y={38} fontSize={w} fill={SECOND} fontFamily={FIG}>
          yesterday
        </text>
        <rect x={74} y={27} width={15} height={15} rx={3} fill="#1f1f1f" stroke="#2a2a2a" strokeWidth={0.6} />
        <text x={94} y={38} fontSize={w} fontWeight={700} fill={INK} fontFamily={FIG}>
          BLK
        </text>
        <text x={94} y={52} fontSize={w} fill={MUTED} fontFamily={SANS}>
          BlackRock
        </text>
        <text x={160} y={38} fontSize={w} fontWeight={600} fill={INK} fontFamily={SANS}>
          Imani Okoro
        </text>
        <text x={160} y={52} fontSize={w} fill={MUTED} fontFamily={SANS}>
          EVP
        </text>
        <text x={256} y={38} fontSize={w} fill={BULL} fontFamily={FIG}>
          Bought
        </text>
        <text x={330} y={38} textAnchor="end" fontSize={w} fontWeight={700} fill={INK} fontFamily={FIG}>
          $7M
        </text>
        <text x={256} y={52} fontSize={w} fill={SECOND} fontFamily={FIG}>
          2.4% of stake
        </text>
        <text x={410} y={38} textAnchor="end" fontSize={w} fontWeight={700} fill={INK} fontFamily={FIG}>
          Chosen
        </text>
      </>
    )}
  </Figure>
);

/* The flag: chosen, planned, unstated — and why a chosen purchase is the loudest */
const FlagFigure = () => (
  <Figure label="Three trades with their flag: a purchase marked Chosen in bold white, a sale marked Planned in grey, a sale marked Unstated in grey" h={88}>
    {({ w }) =>
      [
        { y: 16, trade: 'Bought', ink: BULL, flag: 'Chosen', flagInk: INK, bold: true, why: ['the insider decided — one reason to buy'] },
        { y: 42, trade: 'Sold', ink: BEAR, flag: 'Planned', flagInk: MUTED, bold: false, why: ['a 10b5-1 schedule set months ago —', 'no view on the day'] },
        { y: 82, trade: 'Sold', ink: BEAR, flag: 'Unstated', flagInk: MUTED, bold: false, why: ['the filing carried no box either way'] },
      ].map(r => (
        <g key={r.flag}>
          <text x={10} y={r.y} fontSize={w} fill={r.ink} fontFamily={FIG}>
            {r.trade}
          </text>
          <text x={58} y={r.y} fontSize={w} fontWeight={r.bold ? 700 : 400} fill={r.flagInk} fontFamily={FIG}>
            {r.flag}
          </text>
          {r.why.map((line, i) => (
            <text key={line} x={120} y={r.y + i * 14} fontSize={w} fill={SECOND} fontFamily={SANS}>
              {line}
            </text>
          ))}
        </g>
      ))
    }
  </Figure>
);

/* Of stake: the holding as a bar, the slice traded */
const StakeFigure = () => (
  <Figure label="Two holdings as bars: one with a thin red slice sold, 2% of the stake; one with a wide red slice, 32%" h={76}>
    {({ w }) =>
      [
        { y: 18, pct: 0.024, word: ['sold 2.4% of what they held —', 'a nibble'] },
        { y: 54, pct: 0.32, word: ['sold 32% of what they held —', 'a third of the position'] },
      ].map(r => (
        <g key={r.word[1]}>
          <rect x={10} y={r.y - 6} width={120} height={8} rx={2} fill="#ffffff" fillOpacity={0.08} />
          <rect x={10 + 120 * (1 - r.pct)} y={r.y - 6} width={120 * r.pct} height={8} rx={2} fill={BEAR} fillOpacity={0.85} />
          <text x={138} y={r.y + 2} fontSize={w} fontWeight={700} fill={INK} fontFamily={FIG}>
            {(r.pct * 100).toFixed(1)}%
          </text>
          <text x={184} y={r.y + 2} fontSize={w} fill={SECOND} fontFamily={SANS}>
            {r.word[0]}
          </text>
          <text x={184} y={r.y + 16} fontSize={w} fill={SECOND} fontFamily={SANS}>
            {r.word[1]}
          </text>
        </g>
      ))
    }
  </Figure>
);

/* Others: filers doing the same in one name inside thirty days */
const ClusterFigure = () => (
  <Figure label="A thirty-day bracket under GS with three green filer marks inside it, reading 3 filers bought; beside it one mark alone reading a lone buyer" h={66}>
    {({ w }) => (
      <>
        <text x={10} y={16} fontSize={w} fontWeight={700} fill={INK} fontFamily={FIG}>
          GS
        </text>
        <line x1={10} x2={190} y1={40} y2={40} stroke="#ffffff" strokeOpacity={0.15} />
        <line x1={10} x2={10} y1={36} y2={44} stroke="#ffffff" strokeOpacity={0.3} />
        <line x1={190} x2={190} y1={36} y2={44} stroke="#ffffff" strokeOpacity={0.3} />
        <text x={100} y={60} textAnchor="middle" fontSize={w} fill={MUTED} fontFamily={FIG}>
          30 days
        </text>
        {[40, 96, 150].map(x => (
          <circle key={x} cx={x} cy={40} r={4} fill={BULL} stroke="rgb(var(--night))" strokeWidth={1} />
        ))}
        <text x={200} y={38} fontSize={w} fill={INK} fontFamily={FIG}>
          3 filers
        </text>
        <text x={200} y={52} fontSize={w} fill={SECOND} fontFamily={SANS}>
          bought — a cluster
        </text>
        <text x={320} y={16} fontSize={w} fontWeight={700} fill={INK} fontFamily={FIG}>
          MS
        </text>
        <line x1={320} x2={410} y1={40} y2={40} stroke="#ffffff" strokeOpacity={0.15} />
        <circle cx={366} cy={40} r={4} fill={BULL} stroke="rgb(var(--night))" strokeWidth={1} />
        <text x={365} y={60} textAnchor="middle" fontSize={w} fill={MUTED} fontFamily={SANS}>
          one buyer · —
        </text>
        <circle cx={300} cy={40} r={0} fill="none" stroke={SILVER} />
      </>
    )}
  </Figure>
);

export const InsidersGuide = () => (
  <div data-insiders-guide>
    <Section title="A row">
      <p>A Form 4 filing: who inside the company traded its shares, what they did, how much, and what share of their own holding that was.</p>
      <RowFigure />
    </Section>
    <Section title="Chose to?">
      <p>Most insider selling runs off a plan adopted months earlier; a chosen purchase is the loudest row here, because there are many reasons to sell and one reason to buy.</p>
      <FlagFigure />
    </Section>
    <Section title="Of stake">
      <p>The trade as a share of what the insider held, so a sale reads against what they kept.</p>
      <StakeFigure />
    </Section>
    <Section title="Others">
      <p>How many filers did the same in one name inside thirty days — a cluster of buyers is a stronger read than one.</p>
      <ClusterFigure />
    </Section>
  </div>
);
