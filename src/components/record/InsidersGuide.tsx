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

/* One row of the grid: when, the name, who, the trade, the figures, the flag */
const RowFigure = () => (
  <Figure label="One row of the grid: yesterday, BLK BlackRock, an EVP, Bought in green, 20,800 shares at $347.21 for $7M, 2.4% of the stake, CHOSEN in bold, 2 filers" h={58}>
    <Head x={10} y={12}>WHEN</Head>
    <Head x={58} y={12}>NAME</Head>
    <Head x={150} y={12}>WHO</Head>
    <Head x={236} y={12}>TRADE</Head>
    <Head x={300} y={12} anchor="end">VALUE</Head>
    <Head x={344} y={12} anchor="end">OF STAKE</Head>
    <Head x={368} y={12}>CHOSE TO?</Head>
    <line x1={10} x2={410} y1={18} y2={18} stroke="#ffffff" strokeOpacity={0.08} />
    <text x={10} y={40} fontSize={7.5} fill={SECOND} fontFamily={MONO}>
      yesterday
    </text>
    <rect x={58} y={30} width={14} height={14} rx={3} fill="#1f1f1f" stroke="#2a2a2a" strokeWidth={0.6} />
    <text x={65} y={40} textAnchor="middle" fontSize={4.5} fontWeight={700} fill={INK} fontFamily={MONO}>
      BLK
    </text>
    <text x={77} y={37} fontSize={8} fontWeight={700} fill={INK} fontFamily={MONO}>
      BLK
    </text>
    <text x={77} y={46} fontSize={6} fill={MUTED} fontFamily={SANS}>
      BlackRock
    </text>
    <text x={150} y={37} fontSize={7.5} fontWeight={600} fill={INK} fontFamily={SANS}>
      Imani Okoro
    </text>
    <text x={150} y={46} fontSize={6} fill={MUTED} fontFamily={SANS}>
      EVP
    </text>
    <text x={236} y={40} fontSize={7.5} fill={BULL} fontFamily={MONO}>
      Bought
    </text>
    <text x={300} y={40} textAnchor="end" fontSize={7.5} fontWeight={700} fill={INK} fontFamily={MONO}>
      $7M
    </text>
    <text x={344} y={40} textAnchor="end" fontSize={7.5} fill={SECOND} fontFamily={MONO}>
      2.4%
    </text>
    <text x={368} y={40} fontSize={6} letterSpacing={1} fontWeight={700} fill={INK} fontFamily={MONO}>
      CHOSEN
    </text>
  </Figure>
);

/* The flag: chosen, planned, unstated — and why a chosen purchase is the loudest */
const FlagFigure = () => (
  <Figure label="Three trades with their flag: a purchase marked CHOSEN in bold white, a sale marked PLANNED in grey, a sale marked UNSTATED in grey" h={76}>
    {[
      { y: 18, trade: 'Bought', ink: BULL, flag: 'CHOSEN', flagInk: INK, bold: true, why: 'the insider decided — one reason to buy' },
      { y: 42, trade: 'Sold', ink: BEAR, flag: 'PLANNED', flagInk: MUTED, bold: false, why: 'a 10b5-1 schedule set months ago — no view on the day' },
      { y: 66, trade: 'Sold', ink: BEAR, flag: 'UNSTATED', flagInk: MUTED, bold: false, why: 'the filing carried no box either way' },
    ].map(r => (
      <g key={r.flag}>
        <text x={10} y={r.y} fontSize={7.5} fill={r.ink} fontFamily={MONO}>
          {r.trade}
        </text>
        <text x={56} y={r.y} fontSize={6} letterSpacing={1} fontWeight={r.bold ? 700 : 400} fill={r.flagInk} fontFamily={MONO}>
          {r.flag}
        </text>
        <text x={120} y={r.y} fontSize={7} fill={SECOND} fontFamily={SANS}>
          {r.why}
        </text>
      </g>
    ))}
  </Figure>
);

/* Of stake: the holding as a bar, the slice traded */
const StakeFigure = () => (
  <Figure label="Two holdings as bars: one with a thin red slice sold, 2% of the stake; one with a wide red slice, 32%" h={64}>
    {[
      { y: 20, pct: 0.024, word: 'sold 2.4% of what they held — a nibble' },
      { y: 46, pct: 0.32, word: 'sold 32% of what they held — a third of the position' },
    ].map(r => (
      <g key={r.word}>
        <rect x={10} y={r.y - 4} width={160} height={8} rx={2} fill="#ffffff" fillOpacity={0.08} />
        <rect x={10 + 160 * (1 - r.pct)} y={r.y - 4} width={160 * r.pct} height={8} rx={2} fill={BEAR} fillOpacity={0.85} />
        <text x={180} y={r.y + 3} fontSize={7.5} fontWeight={700} fill={INK} fontFamily={MONO}>
          {(r.pct * 100).toFixed(1)}%
        </text>
        <text x={216} y={r.y + 3} fontSize={7} fill={SECOND} fontFamily={SANS}>
          {r.word}
        </text>
      </g>
    ))}
  </Figure>
);

/* Others: filers doing the same in one name inside thirty days */
const ClusterFigure = () => (
  <Figure label="A thirty-day bracket under GS with three green filer marks inside it, reading 3 filers bought; beside it one mark alone reading a lone buyer" h={62}>
    <text x={10} y={14} fontSize={8} fontWeight={700} fill={INK} fontFamily={MONO}>
      GS
    </text>
    <line x1={10} x2={190} y1={40} y2={40} stroke="#ffffff" strokeOpacity={0.15} />
    <line x1={10} x2={10} y1={36} y2={44} stroke="#ffffff" strokeOpacity={0.3} />
    <line x1={190} x2={190} y1={36} y2={44} stroke="#ffffff" strokeOpacity={0.3} />
    <text x={100} y={54} textAnchor="middle" fontSize={6} letterSpacing={0.8} fill={MUTED} fontFamily={MONO}>
      30 DAYS
    </text>
    {[40, 96, 150].map(x => (
      <circle key={x} cx={x} cy={40} r={4} fill={BULL} stroke="#0a0a0a" strokeWidth={1} />
    ))}
    <text x={200} y={43} fontSize={7.5} fill={INK} fontFamily={MONO}>
      3 filers
    </text>
    <text x={236} y={43} fontSize={7} fill={SECOND} fontFamily={SANS}>
      bought — a cluster
    </text>
    <text x={320} y={14} fontSize={8} fontWeight={700} fill={INK} fontFamily={MONO}>
      MS
    </text>
    <line x1={320} x2={410} y1={40} y2={40} stroke="#ffffff" strokeOpacity={0.15} />
    <circle cx={366} cy={40} r={4} fill={BULL} stroke="#0a0a0a" strokeWidth={1} />
    <text x={365} y={54} textAnchor="middle" fontSize={6.5} fill={MUTED} fontFamily={SANS}>
      one buyer · —
    </text>
    <circle cx={300} cy={40} r={0} fill="none" stroke={SILVER} />
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

export default InsidersGuide;
