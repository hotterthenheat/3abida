/*
==================================================
  SLAYER TERMINAL - HOW TO READ A SETUP
  (components/compass/SetupGuide.tsx)

  The setup page's guide in the house pattern (the
  walk, 2026-09-11): a figure per thing, the
  surface drawn small in its own inks, one sentence
  under each.
==================================================
*/

import type { ReactNode } from 'react';

const SILVER = 'rgb(var(--silver))'; /* the silver token — deep steel on the light terminal (2026-09-12) */
const BULL = 'rgb(var(--bull))';
const BEAR = 'rgb(var(--bear))';
const WARN = 'rgb(var(--warn))';
const MUTED = '#7c8290';
const SECOND = 'rgb(var(--text-secondary))';
const INK = 'rgb(var(--text-primary))';
const MONO = 'ui-monospace, Menlo, monospace';

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

/* The chart: candles, the entry's silver dot and rule, the target ladder at the right edge (a won rung filled, its candle arrowed), the floor's red rule */
const ChartFigure = () => {
  const candles = [52, 50, 54, 57, 55, 60, 63, 61, 66, 64, 69, 72, 70, 74, 71, 76];
  return (
    <Figure label="Candles rising left to right: a silver dot marks the entry on its candle with a thin silver rule running right from it, at the right edge two green ticks numbered 1 and 2 (the first filled in, its candle carrying a green arrow), and a thin red rule below running right to its figure" h={104}>
      {candles.map((c, i) => {
        const x = 14 + i * 22;
        const o = c - 3 + ((i * 7) % 5);
        const up = c >= o;
        const top = 90 - Math.max(c, o);
        const hgt = Math.max(2, Math.abs(c - o));
        return (
          <g key={i}>
            <line x1={x + 4} x2={x + 4} y1={90 - Math.max(c, o) - 3} y2={90 - Math.min(c, o) + 3} stroke={up ? BULL : BEAR} strokeWidth={1} />
            <rect x={x} y={top} width={8} height={hgt} fill={up ? BULL : BEAR} fillOpacity={0.85} />
          </g>
        );
      })}
      {/* the entry: a silver dot on its candle, a thin silver rule to the right edge, the premium at its end */}
      <circle cx={14 + 3 * 22 + 4} cy={90 - 57 + 9} r={2.4} fill={SILVER} />
      <line x1={14 + 3 * 22 + 4} x2={412} y1={90 - 57 + 9} y2={90 - 57 + 9} stroke={SILVER} strokeOpacity={0.7} strokeWidth={1} />
      <text x={412} y={90 - 57 + 5} textAnchor="end" fontSize={6.5} fontWeight={600} fill={SILVER} fontFamily={MONO}>
        entry 0.75
      </text>
      {/* the won rung's candle keeps its arrow */}
      <path d={`M ${14 + 11 * 22 + 4} ${90 - 72 - 7} l -3 4 h 6 z`} fill={BULL} />
      {/* the ladder at the edge: rung 1 won (filled), rung 2 still to be won */}
      <rect x={398} y={90 - 72 - 8} width={14} height={4} fill={BULL} />
      <text x={394} y={90 - 72 - 4} textAnchor="end" fontSize={6.5} fontWeight={700} fill={BULL} fontFamily={MONO}>
        1
      </text>
      <rect x={402} y={11} width={10} height={2} fill={BULL} fillOpacity={0.8} />
      <text x={398} y={15} textAnchor="end" fontSize={6.5} fontWeight={700} fill={BULL} fontFamily={MONO}>
        2
      </text>
      {/* the floor: a thin red rule from the entry candle to its figure */}
      <line x1={14 + 3 * 22 + 4} x2={412} y1={96} y2={96} stroke={BEAR} strokeOpacity={0.75} strokeWidth={1} />
      <text x={412} y={103} textAnchor="end" fontSize={6.5} fontWeight={600} fill={BEAR} fontFamily={MONO}>
        FLOOR
      </text>
    </Figure>
  );
};

/* The targets: the ladder, one banked in green, one working bright, the entry, the floor */
const TargetsFigure = () => (
  <Figure label="A four-column table: Target 2 pending with the price NVDA needs, Target 1 hit with a check in green, the Entry row, and the Floor row in red with the price it breaks below" h={96}>
    <g fontFamily={MONO} fontSize={6.5} fill={MUTED} letterSpacing={0.6}>
      <text x={12} y={12}>TARGET</text>
      <text x={200} y={12} textAnchor="end">PREMIUM</text>
      <text x={290} y={12} textAnchor="end">FROM ENTRY</text>
      <text x={408} y={12} textAnchor="end">NVDA NEEDS</text>
    </g>
    <line x1={0} x2={420} y1={17} y2={17} stroke="#ffffff" strokeOpacity={0.08} />
    {[
      { y: 32, t: 'Target 2', p: '$1.31', f: '+75%', n: '123.10', ink: INK, bold: true },
      { y: 52, t: '✓ Target 1', p: '$1.02', f: '+36%', n: '—', ink: BULL, bold: true },
      { y: 72, t: 'Entry', p: '$0.75', f: '—', n: '—', ink: SECOND, bold: false },
      { y: 92, t: 'Floor', p: '—', f: '—', n: 'below 118.90', ink: BEAR, bold: true },
    ].map(r => (
      <g key={r.t} fontFamily={MONO}>
        <text x={12} y={r.y} fontSize={8} fontWeight={r.bold ? 700 : 400} fill={r.ink}>
          {r.t}
        </text>
        <text x={200} y={r.y} textAnchor="end" fontSize={8.5} fontWeight={700} fill={r.p === '—' ? MUTED : INK}>
          {r.p}
        </text>
        <text x={290} y={r.y} textAnchor="end" fontSize={8} fill={r.f === '—' ? MUTED : r.t.includes('1') ? BULL : SECOND}>
          {r.f}
        </text>
        <text x={408} y={r.y} textAnchor="end" fontSize={8} fontWeight={r.t === 'Floor' ? 700 : 400} fill={r.n === '—' ? MUTED : INK}>
          {r.n}
        </text>
      </g>
    ))}
  </Figure>
);

/* The case: the four-step meter and its word — no figure of ours is drawn, here or on the page (2026-09-19) */
const CaseFigure = () => (
  <Figure label="Four meters of four steps each: all four lit in green reading a strong case, three in green a good case, two in orange caution, one in red a poor case" h={92}>
    {[
      { y: 18, lit: 4, ink: BULL, word: 'a strong case' },
      { y: 40, lit: 3, ink: BULL, word: 'a good case' },
      { y: 62, lit: 2, ink: WARN, word: 'caution' },
      { y: 84, lit: 1, ink: BEAR, word: 'a poor case' },
    ].map(m => (
      <g key={m.word} fontFamily={MONO}>
        <text x={12} y={m.y} fontSize={6.5} letterSpacing={0.8} fill={MUTED}>
          THE CASE
        </text>
        {[0, 1, 2, 3].map(i => (
          <rect key={i} x={80 + i * 36} y={m.y - 6} width={33} height={5} rx={2.5} fill={i < m.lit ? m.ink : '#ffffff'} fillOpacity={i < m.lit ? 0.85 : 0.06} />
        ))}
        <text x={236} y={m.y} fontSize={8} fontWeight={700} fill={m.ink}>
          {m.word}
        </text>
      </g>
    ))}
  </Figure>
);

/* The contracts around it: two rows, the setup's own in silver */
const AroundFigure = () => (
  <Figure label="Two rows: THIS CONTRACT in silver, NVDA 120P, its gamma share and exposure; CALL WALL, NVDA 125C, with its figures and an Open door" h={62}>
    <g fontFamily={MONO} fontSize={6.5} fill={MUTED} letterSpacing={0.6}>
      <text x={12} y={12}>ROLE</text>
      <text x={120} y={12}>CONTRACT</text>
      <text x={260} y={12} textAnchor="end">GAMMA</text>
      <text x={340} y={12} textAnchor="end">EXPOSURE</text>
    </g>
    <line x1={0} x2={420} y1={17} y2={17} stroke="#ffffff" strokeOpacity={0.08} />
    <rect x={0} y={22} width={420} height={18} fill={SILVER} fillOpacity={0.05} />
    <text x={12} y={34} fontSize={6.5} letterSpacing={0.6} fontWeight={700} fill={SILVER} fontFamily={MONO}>
      THIS CONTRACT
    </text>
    <text x={120} y={34} fontSize={8.5} fontWeight={700} fill={INK} fontFamily={MONO}>
      NVDA 120<tspan fill={BEAR}>P</tspan>
    </text>
    <text x={260} y={34} textAnchor="end" fontSize={8} fill={INK} fontFamily={MONO}>
      12.0%
    </text>
    <text x={340} y={34} textAnchor="end" fontSize={8} fontWeight={700} fill={BEAR} fontFamily={MONO}>
      $71.1M
    </text>
    <text x={12} y={54} fontSize={6.5} letterSpacing={0.6} fill={SECOND} fontFamily={MONO}>
      CALL WALL
    </text>
    <text x={120} y={54} fontSize={8.5} fontWeight={700} fill={INK} fontFamily={MONO}>
      NVDA 125<tspan fill={BULL}>C</tspan>
    </text>
    <text x={260} y={54} textAnchor="end" fontSize={8} fill={INK} fontFamily={MONO}>
      8.7%
    </text>
    <text x={340} y={54} textAnchor="end" fontSize={8} fontWeight={700} fill={BULL} fontFamily={MONO}>
      −$51.8M
    </text>
    <text x={408} y={54} textAnchor="end" fontSize={6.5} letterSpacing={0.6} fill={SECOND} fontFamily={MONO}>
      OPEN ↗
    </text>
  </Figure>
);

export const SetupGuide = () => (
  <div data-setup-guide>
    <Section title="The chart">
      <p>The stock, live, with the setup drawn on it: the entry on the bar the page opened, each target still to be won as a dashed green line, a target that was hit on the candle that hit it, and the floor in red. A close through the floor retires the setup. The Premium tab shows the contract's own price instead.</p>
      <ChartFigure />
    </Section>
    <Section title="The targets">
      <p>Each target is a premium the contract can reach, with what the stock needs to do to get it there. A hit target wears a check. The floor is the stock price that ends it. A poor case earns no targets and draws no lines.</p>
      <TargetsFigure />
    </Section>
    <Section title="The case">
      <p>The case is how sure the engine is, said in one word: strong, good, caution or poor. The meter beside it fills one step for each. The state in the head says where the setup sits in its life: proving itself, in place, trading like its trade, or retiring.</p>
      <CaseFigure />
    </Section>
    <Section title="The contracts around it">
      <p>The contracts whose hedging this setup trades through: its own row in silver, then the walls, the supreme, the pin and the heaviest strikes on the way to the last target. A row opens that contract's page, with this one as the way back.</p>
      <AroundFigure />
    </Section>
  </div>
);

export default SetupGuide;
