/*
==================================================
  SLAYER TERMINAL - HOW TO READ THE SCREENS
  (components/record/StocksGuide.tsx)

  The Stocks page's guide in the house pattern: a
  figure per thing, the surface drawn small in its
  own inks, one sentence under each.
==================================================
*/

import type { ReactNode } from 'react';
import { GuideSvg, type GuideType } from '../ui/GuideSvg';
import { FONT_SANS } from '../../theme/fonts';

const SUPREME = 'rgb(var(--supreme))';
const BULL = 'rgb(var(--bull))';
const BEAR = 'rgb(var(--bear))';
const FLIP = 'rgb(var(--flip))';
const WARN = 'rgb(var(--warn))';
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

/** A sleeve bar: the track, the fill to its value, green above the 50 line and red below */
const Bar = ({ x, y, w, v }: { x: number; y: number; w: number; v: number }) => (
  <g>
    <rect x={x} y={y} width={w} height={4} rx={2} fill="#ffffff" fillOpacity={0.08} />
    <rect x={x} y={y} width={(w * v) / 100} height={4} rx={2} fill={v > 50 ? BULL : BEAR} fillOpacity={v > 50 ? 1 : 0.7} />
  </g>
);

/* One row of the grid: the name, the price and the day, the line, the screen; the four bars under them */
const RowFigure = () => (
  <Figure label="One row of the grid: NVDA NVIDIA, $138.60, +1.4% in green, a rising thirty-day line, Strong with a green dot, and under them four sleeve bars — three green, one red" h={86}>
    {({ w }) => (
      <>
        <Head x={10} y={14} s={w}>
          Name
        </Head>
        <Head x={150} y={14} s={w} anchor="end">
          Last
        </Head>
        <Head x={198} y={14} s={w} anchor="end">
          Today
        </Head>
        <Head x={210} y={14} s={w}>
          30 days
        </Head>
        <Head x={346} y={14} s={w}>
          Screen
        </Head>
        <line x1={10} x2={410} y1={20} y2={20} stroke="#ffffff" strokeOpacity={0.08} />
        <rect x={10} y={27} width={15} height={15} rx={3} fill="#1f1f1f" stroke="#2a2a2a" strokeWidth={0.6} />
        <text x={31} y={38} fontSize={w} fontWeight={700} fill={INK} fontFamily={FIG}>
          NVDA
        </text>
        <text x={31} y={52} fontSize={w} fill={MUTED} fontFamily={SANS}>
          NVIDIA
        </text>
        <text x={150} y={38} textAnchor="end" fontSize={w} fill={INK} fontFamily={FIG}>
          $138.60
        </text>
        <text x={198} y={38} textAnchor="end" fontSize={w} fill={BULL} fontFamily={FIG}>
          +1.4%
        </text>
        <polyline points="210,42 218,40 226,41 234,36 242,37 250,33 258,34 266,30" fill="none" stroke={BULL} strokeWidth={1} />
        <circle cx={350} cy={34} r={2} fill={BULL} />
        <text x={356} y={38} fontSize={w} fontWeight={600} fill={INK} fontFamily={FIG}>
          Strong
        </text>
        {[
          { x: 10, name: 'Trend', v: 80 },
          { x: 108, name: 'Numbers', v: 62 },
          { x: 216, name: 'Money', v: 38 },
          { x: 312, name: 'News', v: 70 },
        ].map(s => (
          <g key={s.name}>
            <text x={s.x} y={76} fontSize={w} fill={MUTED} fontFamily={FIG}>
              {s.name}
            </text>
            <Bar x={s.x + (s.name === 'Numbers' ? 54 : s.name === 'Money' ? 42 : 38)} y={71} w={36} v={s.v} />
          </g>
        ))}
      </>
    )}
  </Figure>
);

/* The four sleeves: each a bar against the 50 line */
const SleeveFigure = () => (
  <Figure label="Two sleeve bars against a marked 50 line: one green past the line reading for the name, one red short of it reading against" h={94}>
    {({ w }) => (
      <>
        <line x1={80} x2={80} y1={8} y2={74} stroke="#ffffff" strokeOpacity={0.25} strokeDasharray="2 2" />
        <text x={80} y={88} textAnchor="middle" fontSize={w} fill={MUTED} fontFamily={FIG}>
          the 50 line
        </text>
        {[
          { y: 22, v: 74, word: ['past the line —', 'the sleeve is for the name'], ink: BULL },
          { y: 58, v: 32, word: ['short of it —', 'the sleeve is against the name'], ink: BEAR },
        ].map(r => (
          <g key={r.y}>
            <rect x={10} y={r.y - 6} width={140} height={4} rx={2} fill="#ffffff" fillOpacity={0.08} />
            <rect x={10} y={r.y - 6} width={140 * (r.v / 100)} height={4} rx={2} fill={r.ink} fillOpacity={r.ink === BULL ? 1 : 0.7} />
            <text x={162} y={r.y} fontSize={w} fill={SECOND} fontFamily={SANS}>
              {r.word[0]}
            </text>
            <text x={162} y={r.y + 14} fontSize={w} fill={SECOND} fontFamily={SANS}>
              {r.word[1]}
            </text>
          </g>
        ))}
      </>
    )}
  </Figure>
);

/* The rotation: three sector cards off the ladder */
const RotationFigure = () => (
  <Figure label="Three sector cards: 01 Technology with a full magenta bar and Leading, 04 Energy with a grey bar at 70% and Turning up, 10 Utilities with a red bar at 40% and Falling; each with its one-week and one-month figures" h={82}>
    {({ w }) => (
      <>
        {[
          { x: 4, rank: '01', name: 'Technology', bar: 1, ink: SUPREME, word: 'Leading', w1: '+1.2%', m1: '+2.6%', up: [true, true] },
          { x: 138, rank: '04', name: 'Energy', bar: 0.7, ink: FLIP, word: 'Turning up', w1: '+0.8%', m1: '−1.1%', up: [true, false] },
          { x: 272, rank: '10', name: 'Utilities', bar: 0.4, ink: BEAR, word: 'Falling', w1: '−0.9%', m1: '−2.4%', up: [false, false] },
        ].map(c => (
          <g key={c.rank}>
            <rect x={c.x} y={6} width={126} height={70} rx={4} fill="#121212" stroke="#2a2a2a" strokeWidth={0.8} />
            <text x={c.x + 8} y={24} fontSize={w} fill={MUTED} fontFamily={FIG}>
              {c.rank}
            </text>
            <text x={c.x + 26} y={24} fontSize={w} fontWeight={700} fill={INK} fontFamily={SANS}>
              {c.name}
            </text>
            <rect x={c.x + 8} y={31} width={110} height={4} rx={2} fill="#ffffff" fillOpacity={0.06} />
            <rect x={c.x + 8} y={31} width={110 * c.bar} height={4} rx={2} fill={c.ink} fillOpacity={c.ink === BEAR ? 0.8 : 1} />
            <text x={c.x + 8} y={52} fontSize={w} fill={c.ink} fontFamily={FIG}>
              {c.word}
            </text>
            <text x={c.x + 8} y={68} fontSize={w} fontFamily={FIG}>
              <tspan fill={MUTED}>1w </tspan>
              <tspan fill={c.up[0] ? BULL : BEAR}>{c.w1}</tspan>
              <tspan fill={MUTED}> · 1m </tspan>
              <tspan fill={c.up[1] ? BULL : BEAR}>{c.m1}</tspan>
            </text>
          </g>
        ))}
        <text x={414} y={44} textAnchor="end" fontSize={w} fill={WARN} fontFamily={FIG}>
          …
        </text>
      </>
    )}
  </Figure>
);

/* Breadth: how many names sit above their trend */
const BreadthFigure = () => (
  <Figure label="Ten names as marks on a line: six green above it, four red below it, reading 60% above their trend" h={92}>
    {({ w }) => (
      <>
        <line x1={10} x2={366} y1={38} y2={38} stroke="#ffffff" strokeOpacity={0.2} />
        {['NVDA', 'AAPL', 'AMD', 'META', 'LLY', 'GS', 'XOM', 'PG', 'NEE', 'BA'].map((t, i) => {
          const up = i < 6;
          const x = 26 + i * 36;
          return (
            <g key={t}>
              <circle cx={x} cy={up ? 26 : 50} r={3} fill={up ? BULL : BEAR} fillOpacity={up ? 1 : 0.8} />
              <text x={x} y={up ? 15 : 68} textAnchor="middle" fontSize={w} fill={MUTED} fontFamily={FIG}>
                {t}
              </text>
            </g>
          );
        })}
        <text x={376} y={43} fontSize={w * 1.2} fontWeight={700} fill={BULL} fontFamily={FIG}>
          60%
        </text>
        <text x={10} y={86} fontSize={w} fill={SECOND} fontFamily={SANS}>
          six of ten with the trend on their side
        </text>
      </>
    )}
  </Figure>
);

export const StocksGuide = () => (
  <div data-stocks-guide>
    <Section title="A row">
      <p>One name: the price and the day, its thirty days against the tape, the four sleeves as bars, the screen they add up to, and the read in plain words.</p>
      <RowFigure />
    </Section>
    <Section title="The four sleeves">
      <p>The trend, the numbers, the money and the news, each a bar against the 50 line — green past it, red short of it; the bar is the whole read.</p>
      <SleeveFigure />
    </Section>
    <Section title="The rotation">
      <p>Every sector ranked by its names' screens; the leader wears magenta, the others the direction of their strength over one week and one month.</p>
      <RotationFigure />
    </Section>
    <Section title="Above their trend">
      <p>How many of the names on the page have the trend on their side — the market's own screen.</p>
      <BreadthFigure />
    </Section>
  </div>
);
