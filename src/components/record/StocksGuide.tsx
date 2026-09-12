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

const SUPREME = 'rgb(var(--supreme))';
const BULL = 'rgb(var(--bull))';
const BEAR = 'rgb(var(--bear))';
const FLIP = 'rgb(var(--flip))';
const WARN = 'rgb(var(--warn))';
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

/** A sleeve bar: the track, the fill to its value, green above the 50 line and red below */
const Bar = ({ x, y, w, v }: { x: number; y: number; w: number; v: number }) => (
  <g>
    <rect x={x} y={y} width={w} height={4} rx={2} fill="#ffffff" fillOpacity={0.08} />
    <rect x={x} y={y} width={(w * v) / 100} height={4} rx={2} fill={v > 50 ? BULL : BEAR} fillOpacity={v > 50 ? 1 : 0.7} />
  </g>
);

/* One row of the grid: the name, the price and the day, the line, four bars, the screen */
const RowFigure = () => (
  <Figure label="One row of the grid: NVDA NVIDIA, $138.60, +1.4% in green, a rising thirty-day line, four sleeve bars — three green, one red — and STRONG with a green dot" h={58}>
    <Head x={10} y={12}>NAME</Head>
    <Head x={118} y={12} anchor="end">LAST</Head>
    <Head x={156} y={12} anchor="end">TODAY</Head>
    <Head x={170} y={12}>30 DAYS</Head>
    <Head x={222} y={12}>TREND</Head>
    <Head x={262} y={12}>NUMBERS</Head>
    <Head x={302} y={12}>MONEY</Head>
    <Head x={342} y={12}>NEWS</Head>
    <Head x={382} y={12}>SCREEN</Head>
    <line x1={10} x2={410} y1={18} y2={18} stroke="#ffffff" strokeOpacity={0.08} />
    <rect x={10} y={30} width={14} height={14} rx={3} fill="#1f1f1f" stroke="#2a2a2a" strokeWidth={0.6} />
    <text x={17} y={40} textAnchor="middle" fontSize={4} fontWeight={700} fill={INK} fontFamily={MONO}>
      NV
    </text>
    <text x={29} y={37} fontSize={8} fontWeight={700} fill={INK} fontFamily={MONO}>
      NVDA
    </text>
    <text x={29} y={46} fontSize={6} fill={MUTED} fontFamily={SANS}>
      NVIDIA
    </text>
    <text x={118} y={40} textAnchor="end" fontSize={7.5} fill={INK} fontFamily={MONO}>
      $138.60
    </text>
    <text x={156} y={40} textAnchor="end" fontSize={7.5} fill={BULL} fontFamily={MONO}>
      +1.4%
    </text>
    <polyline points="170,44 176,42 182,43 188,38 194,39 200,35 206,36 212,32" fill="none" stroke={BULL} strokeWidth={1} />
    <Bar x={222} y={38} w={32} v={80} />
    <Bar x={262} y={38} w={32} v={62} />
    <Bar x={302} y={38} w={32} v={38} />
    <Bar x={342} y={38} w={32} v={70} />
    <circle cx={385} cy={39} r={2} fill={BULL} />
    <text x={390} y={41.5} fontSize={6.5} fontWeight={600} letterSpacing={0.6} fill={INK} fontFamily={MONO}>
      STRONG
    </text>
  </Figure>
);

/* The four sleeves: each a bar against the 50 line */
const SleeveFigure = () => (
  <Figure label="Two sleeve bars against a marked 50 line: one green past the line reading for the name, one red short of it reading against" h={70}>
    <line x1={90} x2={90} y1={12} y2={60} stroke="#ffffff" strokeOpacity={0.25} strokeDasharray="2 2" />
    <text x={90} y={68} textAnchor="middle" fontSize={6} letterSpacing={0.8} fill={MUTED} fontFamily={MONO}>
      THE 50 LINE
    </text>
    {[
      { y: 22, v: 74, word: 'past the line — the sleeve is for the name', ink: BULL },
      { y: 46, v: 32, word: 'short of it — the sleeve is against the name', ink: BEAR },
    ].map(r => (
      <g key={r.y}>
        <rect x={10} y={r.y - 2} width={160} height={4} rx={2} fill="#ffffff" fillOpacity={0.08} />
        <rect x={10} y={r.y - 2} width={160 * (r.v / 100)} height={4} rx={2} fill={r.ink} fillOpacity={r.ink === BULL ? 1 : 0.7} />
        <text x={182} y={r.y + 3} fontSize={7} fill={SECOND} fontFamily={SANS}>
          {r.word}
        </text>
      </g>
    ))}
  </Figure>
);

/* The rotation: three sector cards off the ladder */
const RotationFigure = () => (
  <Figure label="Three sector cards: 01 Technology with a full magenta bar and LEADING, 04 Energy with a grey bar at 70% and TURNING UP, 10 Utilities with a red bar at 40% and FALLING; each with its one-week and one-month figures" h={72}>
    {[
      { x: 10, rank: '01', name: 'Technology', bar: 1, ink: SUPREME, word: 'LEADING', w1: '+1.2%', m1: '+2.6%', up: [true, true] },
      { x: 150, rank: '04', name: 'Energy', bar: 0.7, ink: FLIP, word: 'TURNING UP', w1: '+0.8%', m1: '−1.1%', up: [true, false] },
      { x: 290, rank: '10', name: 'Utilities', bar: 0.4, ink: BEAR, word: 'FALLING', w1: '−0.9%', m1: '−2.4%', up: [false, false] },
    ].map(c => (
      <g key={c.rank}>
        <rect x={c.x} y={8} width={120} height={56} rx={4} fill="#121212" stroke="#2a2a2a" strokeWidth={0.8} />
        <text x={c.x + 8} y={24} fontSize={6} fill={MUTED} fontFamily={MONO}>
          {c.rank}
        </text>
        <text x={c.x + 22} y={24} fontSize={8} fontWeight={700} fill={INK} fontFamily={SANS}>
          {c.name}
        </text>
        <rect x={c.x + 8} y={31} width={104} height={4} rx={2} fill="#ffffff" fillOpacity={0.06} />
        <rect x={c.x + 8} y={31} width={104 * c.bar} height={4} rx={2} fill={c.ink} fillOpacity={c.ink === BEAR ? 0.8 : 1} />
        <text x={c.x + 8} y={50} fontSize={5.5} letterSpacing={1} fill={c.ink} fontFamily={MONO}>
          {c.word}
        </text>
        <text x={c.x + 112} y={50} textAnchor="end" fontSize={5.5} fontFamily={MONO}>
          <tspan fill={MUTED}>1w </tspan>
          <tspan fill={c.up[0] ? BULL : BEAR}>{c.w1}</tspan>
          <tspan fill={MUTED}> · 1m </tspan>
          <tspan fill={c.up[1] ? BULL : BEAR}>{c.m1}</tspan>
        </text>
      </g>
    ))}
    <text x={412} y={40} textAnchor="end" fontSize={6} fill={WARN} fontFamily={MONO}>
      …
    </text>
  </Figure>
);

/* Breadth: how many names sit above their trend */
const BreadthFigure = () => (
  <Figure label="Ten names as marks on a line: six green above it, four red below it, reading 60% above their trend" h={62}>
    <line x1={10} x2={250} y1={34} y2={34} stroke="#ffffff" strokeOpacity={0.2} />
    {['NVDA', 'AAPL', 'AMD', 'META', 'LLY', 'GS', 'XOM', 'PG', 'NEE', 'BA'].map((t, i) => {
      const up = i < 6;
      const x = 22 + i * 24;
      return (
        <g key={t}>
          <circle cx={x} cy={up ? 22 : 46} r={3} fill={up ? BULL : BEAR} fillOpacity={up ? 1 : 0.8} />
          <text x={x} y={up ? 14 : 57} textAnchor="middle" fontSize={4.5} fill={MUTED} fontFamily={MONO}>
            {t}
          </text>
        </g>
      );
    })}
    <text x={266} y={31} fontSize={9} fontWeight={700} fill={BULL} fontFamily={MONO}>
      60%
    </text>
    <text x={266} y={42} fontSize={7} fill={SECOND} fontFamily={SANS}>
      six of ten with the trend on their side
    </text>
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

export default StocksGuide;
